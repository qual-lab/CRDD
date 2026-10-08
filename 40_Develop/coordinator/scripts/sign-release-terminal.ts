/**
 * 配布担当の署名入力と終了後の画面保持を固定入口へまとめる。
 *
 * @packageDocumentation
 * @responsibility 公開引数の受付、既存Signerへの同一Process接続、終了後だけのEnter待ちを所有する。
 * @trace ARCH-000004
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSupportedCoordinatorNodeRuntime } from "../src/host-execution/node-runtime-version.ts";
import {
  isCanonicalCrddUtcTimestamp,
  isCanonicalCrddVersion,
  isSupportedCrddRuntimeGitObjectId,
} from "../src/diagnostics/release-identity-grammar.ts";
import { main as runReleaseManifestCommand } from "./sign-release-manifest.ts";

/**
 * 固定入口が同一Processで使う端末とCommandの接続を表す。
 *
 * @responsibility 実端末と秘密を使わない契約試験を同じ有限の操作境界へ接続する。
 * @trace ARCH-000004
 * @shape 標準stream、TTYとNode観測、時刻および既存Command呼出しだけを持つ。
 * @invariant 子Process、保存先、秘密入力または署名Authorityの差替えを所有しない。
 * @boundary 固定入口と同一Processの端末／Commandの境界。
 * @security 秘密値を取得・記録する操作を公開しない。
 * @compatibility packageの公開APIへ輸出せず、この入口の接続だけに使用する。
 */
type ReleaseTerminalBindings = Readonly<{
  input: NodeJS.ReadableStream;
  output: NodeJS.WritableStream;
  errorOutput: NodeJS.WritableStream;
  stdinIsTTY: boolean;
  stdoutIsTTY: boolean;
  nodeVersion: string;
  now: () => Date;
  runCommand: (args: string[]) => Promise<void>;
}>;

/**
 * 非秘密の公開引数から既存Signerの引数列を作る。
 *
 * @responsibility 閉じた引数集合、排他的な有効期間指定と単一の現在UTCを所有する。
 * @trace ARCH-000004
 * @input args: 固定入口の公開引数列、now: 一度だけ観測した現在時刻。
 * @returns 既存Signerへ渡す引数列。
 * @precondition N/A: 不正な引数と時刻も拒否対象として受け取る。
 * @postcondition 発行時刻と期限は同じ現在UTCから導出される。
 * @effect N/A: 引数と局所値だけを扱う。
 * @failure 未知、重複、欠落、不正文法または表現不能な有効期間を拒否する。
 * @invariant 人間の期限指定を既定値で補わず、既存の意味固有検査をSignerに保持する。
 * @boundary 公開CLI引数から既存Signer引数への一意な変換。
 * @security passphraseの引数受付、入力値の出力および環境変更を行わない。
 * @concurrency N/A: 局所値だけを扱う同期変換である。
 */
function prepareReleaseTerminalArguments(args: string[], now: Date) {
  const requiredNames = [
    "--distribution-root",
    "--crdd-version",
    "--release-sequence",
    "--crdd-commit",
    "--crdd-tree",
  ];
  const valueNames = [...requiredNames, "--private-key", "--valid-for-days"];
  const values = new Map<string, string>();
  let hasNoExpiry = false;
  for (let index = 0; index < args.length; ) {
    const name = args[index];
    if (name === "--no-expiry") {
      if (hasNoExpiry) throw new Error("release_terminal_arguments_invalid");
      hasNoExpiry = true;
      index += 1;
      continue;
    }
    const value = args[index + 1];
    if (
      !name ||
      !value ||
      !valueNames.includes(name) ||
      values.has(name) ||
      value.includes("\0") ||
      value.startsWith("--")
    )
      throw new Error("release_terminal_arguments_invalid");
    values.set(name, value);
    index += 2;
  }
  if (
    requiredNames.some((name) => !values.has(name)) ||
    hasNoExpiry === values.has("--valid-for-days")
  )
    throw new Error("release_terminal_arguments_invalid");
  const sequence = values.get("--release-sequence") ?? "";
  const distributionRoot = values.get("--distribution-root") ?? "";
  const privateKeyPath = values.get("--private-key");
  if (
    !path.isAbsolute(distributionRoot) ||
    (privateKeyPath !== undefined && !path.isAbsolute(privateKeyPath)) ||
    !isCanonicalCrddVersion(values.get("--crdd-version")) ||
    !isSupportedCrddRuntimeGitObjectId(values.get("--crdd-commit")) ||
    !isSupportedCrddRuntimeGitObjectId(values.get("--crdd-tree")) ||
    !/^[1-9][0-9]*$/u.test(sequence) ||
    !Number.isSafeInteger(Number(sequence))
  )
    throw new Error("release_terminal_arguments_invalid");
  const issuedAt = now.toISOString();
  if (!isCanonicalCrddUtcTimestamp(issuedAt))
    throw new Error("release_terminal_time_invalid");
  const forwardedArgs = requiredNames.flatMap((name) => [
    name,
    values.get(name) ?? "",
  ]);
  if (privateKeyPath !== undefined)
    forwardedArgs.push("--private-key", privateKeyPath);
  forwardedArgs.push("--issued-at", issuedAt);
  if (hasNoExpiry) forwardedArgs.push("--no-expiry");
  else {
    const days = values.get("--valid-for-days") ?? "";
    const dayCount = Number(days);
    const expiresAtDate = new Date(now.getTime() + dayCount * 86_400_000);
    if (
      !/^[1-9][0-9]*$/u.test(days) ||
      !Number.isSafeInteger(dayCount) ||
      !Number.isFinite(expiresAtDate.getTime()) ||
      expiresAtDate.getTime() <= now.getTime()
    )
      throw new Error("release_terminal_validity_invalid");
    const expiresAt = expiresAtDate.toISOString();
    if (!isCanonicalCrddUtcTimestamp(expiresAt))
      throw new Error("release_terminal_validity_invalid");
    forwardedArgs.push("--expires-at", expiresAt);
  }
  return forwardedArgs;
}

/**
 * 一回の端末writeのcallbackまたはerrorを待つ。
 *
 * @responsibility 発行済み表示の非同期終端を観測し、局所error listenerを回収する。
 * @trace ARCH-000004
 * @input output: 表示先stream、value: 非秘密の表示文字列。
 * @returns callback成功時true、throw／callback失敗／error時false。
 * @precondition 呼出し側がOperation全体のerror observerを保持している。
 * @postcondition 発行したwriteのcallbackまたはerror後にだけ完了する。
 * @effect 指定streamへ非秘密の文字列を書き、一時的なerror listenerを接続する。
 * @failure writeの失敗をfalseとして返す。
 * @invariant 文字列を保存せず、署名結果を変更しない。
 * @boundary 端末表示要求と非同期完了通知の境界。
 * @security 秘密入力文字列を受け付ける用途へ流用しない。
 * @concurrency 最初のcallback、errorまたはthrowだけで完了する。
 */
async function writeReleaseTerminalText(
  output: NodeJS.WritableStream,
  value: string,
) {
  return await new Promise<boolean>((resolve) => {
    let isWriteSettled = false;
    const finish = (isSuccessful: boolean) => {
      if (isWriteSettled) return;
      isWriteSettled = true;
      output.off("error", onError);
      resolve(isSuccessful);
    };
    const onError = () => finish(false);
    output.once("error", onError);
    try {
      output.write(value, (error?: Error | null) => finish(!error));
    } catch {
      finish(false);
    }
  });
}

/**
 * 署名終了後だけEnter、EOFまたは取消を待って所有Listenerを回収する。
 *
 * @responsibility 画面保持用readerの終端と全Listenerの回収を所有する。
 * @trace ARCH-000004
 * @input input、output、errorOutput: 終了後の端末stream、hasOutputFailure: 出力失敗観測。
 * @returns readerの終了後に完了するPromise。
 * @precondition 既存Signerが正常または失敗で終了しており、秘密入力readerは終了している。
 * @postcondition 全経路で所有Listenerだけを解除し入力をpauseする。
 * @effect 端末へ案内を表示し、一時的に入力を読む。
 * @failure 入力、出力または取消時も待機を終了し、cleanup失敗だけを呼出し側へ返す。
 * @invariant 署名結果を変更せず、入力内容を永続保存しない。
 * @boundary 署名終了後の画面保持と対話端末の境界。
 * @security 秘密入力中にはこのreaderを作らず、署名を再実行しない。
 * @concurrency 最初のEnter、EOF、SIGINTまたはerrorだけでsettleし、raw modeを変更しない。
 */
async function waitForReleaseTerminalClose(
  input: NodeJS.ReadableStream,
  output: NodeJS.WritableStream,
  errorOutput: NodeJS.WritableStream,
  hasOutputFailure: () => boolean,
) {
  let finishWait = () => {};
  const completion = new Promise<void>((resolve) => {
    finishWait = resolve;
  });
  const onData = (chunk: string | Buffer) => {
    if (/[\r\n\u0003]/u.test(chunk.toString())) finishWait();
  };
  const onEnd = () => finishWait();
  const onError = () => finishWait();
  const onCancel = () => finishWait();
  try {
    input.on("data", onData);
    input.once("end", onEnd);
    input.once("error", onError);
    output.once("error", onError);
    errorOutput.once("error", onError);
    process.once("SIGINT", onCancel);
    if (hasOutputFailure() || !input.readable) finishWait();
    else {
      const wasPromptWritten = await writeReleaseTerminalText(
        output,
        "結果を確認したら Enter で閉じてください。\n",
      );
      if (!wasPromptWritten || hasOutputFailure()) finishWait();
      else input.resume();
    }
    await completion;
  } finally {
    input.off("data", onData);
    input.off("end", onEnd);
    input.off("error", onError);
    output.off("error", onError);
    errorOutput.off("error", onError);
    process.off("SIGINT", onCancel);
    input.pause();
  }
}

/**
 * 固定署名入口を実行し、画面保持後も元の終了codeを返す。
 *
 * @responsibility TTY／Runtime確認、既存Commandとの直列接続と終了code保持を所有する。
 * @trace ARCH-000004
 * @input args: 公開引数、bindings: 同一Processの端末と既存Command接続。
 * @returns 署名Command成功時0、拒否または失敗時1。
 * @precondition N/A: 非TTY、未対応Runtimeおよび不正引数も拒否対象として受け取る。
 * @postcondition Command終了後だけ画面を保持し、その失敗で署名結果を上書きしない。
 * @effect 既存署名Commandを呼び、端末へ結果と終了案内を表示する。
 * @failure Commandと受付の失敗は1、画面保持失敗は元codeを維持する。
 * @invariant 子Process、環境変更、自動再試行、独自Storeおよびlog fileを作らない。
 * @boundary 固定CLI入口、既存署名Commandおよび対話端末の境界。
 * @security 既存の秘密入力、静的検査、署名と配置の順序およびAuthorityを変更しない。
 * @concurrency Commandの完了をawaitした後にのみEnter readerを生成する。
 */
export async function runReleaseTerminalCommand(
  args: string[],
  bindings: ReleaseTerminalBindings = {
    input: process.stdin,
    output: process.stdout,
    errorOutput: process.stderr,
    stdinIsTTY: process.stdin.isTTY === true,
    stdoutIsTTY: process.stdout.isTTY === true,
    nodeVersion: process.versions.node,
    now: () => new Date(),
    runCommand: runReleaseManifestCommand,
  },
) {
  let exitCode = 1;
  let shouldHoldTerminal = false;
  let didFailOutput = false;
  const onOutputError = () => {
    didFailOutput = true;
  };
  bindings.output.on("error", onOutputError);
  bindings.errorOutput.on("error", onOutputError);
  try {
    try {
      assertSupportedCoordinatorNodeRuntime(bindings.nodeVersion);
      if (!bindings.stdinIsTTY || !bindings.stdoutIsTTY)
        throw new Error("release_terminal_interactive_terminal_required");
      shouldHoldTerminal = true;
      const forwardedArgs = prepareReleaseTerminalArguments(
        args,
        bindings.now(),
      );
      await bindings.runCommand(forwardedArgs);
      exitCode = 0;
    } catch (error: unknown) {
      await writeReleaseTerminalText(
        bindings.errorOutput,
        `${error instanceof Error ? error.message : "release_manifest_signing_failed"}\n`,
      );
    }
    // 既存Commandが発行したwriteも、空のwrite barrierとcheck phaseで終端を観測する。
    if (!didFailOutput) {
      const outputResults = await Promise.all([
        writeReleaseTerminalText(bindings.output, ""),
        writeReleaseTerminalText(bindings.errorOutput, ""),
      ]);
      if (outputResults.some((isSuccessful) => !isSuccessful))
        didFailOutput = true;
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (shouldHoldTerminal && !didFailOutput) {
      try {
        const wasExitWritten = await writeReleaseTerminalText(
          bindings.output,
          `SIGN_EXIT=${exitCode}\n`,
        );
        if (wasExitWritten && !didFailOutput)
          await waitForReleaseTerminalClose(
            bindings.input,
            bindings.output,
            bindings.errorOutput,
            () => didFailOutput,
          );
      } catch {
        // 画面保持の失敗は署名Commandの結果を上書きしない。
      }
    }
    return exitCode;
  } finally {
    // 最後のwrite callbackに続くerrorも観測してからOperation observerを解除する。
    await new Promise<void>((resolve) => setImmediate(resolve));
    bindings.output.off("error", onOutputError);
    bindings.errorOutput.off("error", onOutputError);
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  process.exitCode = await runReleaseTerminalCommand(process.argv.slice(2));
}

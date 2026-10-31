/**
 * 所有Windows子Processの開始・搬送・有界待機・tree終端を所有する。
 *
 * @responsibility 子Process・stream・終了補助Processを同じ所有Handleへ結合する。
 * @trace ARCH-000008
 */
import { spawn } from "node:child_process";

import {
  type ChildTreeTerminationHandle,
  startWindowsChildTreeTermination,
} from "../../../platform-access/src/index.ts";
import {
  type CommandExecution,
  STDOUT_LIMIT_BYTES,
  STDERR_LIMIT_BYTES,
} from "../execution/result.ts";
/**
 * docker-owned-processで使用するCommand Handleの値契約を定義する。
 *
 * @responsibility Command HandleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CommandHandleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CommandHandleで宣言した値と責務の対応を維持する。
 * @boundary N/A: CommandHandleの宣言は外部境界を開かない。
 * @security CommandHandleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CommandHandleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CommandHandle = Readonly<{
  wait: (timeoutMs: number) => Promise<CommandExecution | null>;
  terminateAndWait: (graceMs: number) => Promise<boolean>;
}>;
/**
 * docker-owned-processで使用する所有 Command Handleの値契約を定義する。
 *
 * @responsibility 所有 Command HandleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape OwnedCommandHandleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OwnedCommandHandleで宣言した値と責務の対応を維持する。
 * @boundary N/A: OwnedCommandHandleの宣言は外部境界を開かない。
 * @security OwnedCommandHandleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility OwnedCommandHandleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OwnedCommandHandle = CommandHandle &
  Readonly<{
    started: (timeoutMs: number) => Promise<boolean>;
    closed: () => boolean;
    terminationRequested?: () => boolean;
  }>;

/**
 * 固定呼出し元が選ぶstdioと有界出力の技術設定。
 * @responsibility 対話入力と捕捉出力を混在させず、同じProcess Ownerへ渡す。
 * @trace ARCH-000008
 * @shape 対話方式、cwd、出力上限、非対話stdoutの観測callback。
 * @invariant 対話方式では出力callbackを呼ばず秘密を捕捉しない。出力観測は同期voidに限定する。
 * @boundary Package内部の固定Docker呼出しと所有Process。
 * @security 設定自体は実行許可を発行しない。
 * @compatibility 省略時は既存の捕捉方式と上限を維持する。
 */
export type OwnedProcessOutputOptions = Readonly<{
  interactive?: boolean;
  workingDirectory?: string;
  stdoutLimitBytes?: number;
  stderrLimitBytes?: number;
  observeStdout?: (value: Buffer) => void;
}>;

/**
 * boundedを決定する。
 *
 * @responsibility boundedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input promise: Promise<T>、timeoutMs: number、fallback: T
 * @returns boundedの計算結果を返す。
 * @precondition 「promise: Promise<T>、timeoutMs: number、fallback: T」がboundedの入力契約を満たす。
 * @postcondition boundedの責務を完了した結果だけを返す。
 * @effect N/A: boundedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: boundedは独自の失敗分岐を所有しない。
 * @invariant boundedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security boundedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency boundedは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function bounded<T>(promise: Promise<T>, timeoutMs: number, fallback: T) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs);
    }),
  ]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * 所有 Processを開始する。
 *
 * @responsibility 所有 Processの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000008
 * @input executable、argv、environment、stdin: 検証済み実行記述。固定tree終端環境はPlatform Accessが内部で導出する。
 * @returns OwnedCommandHandleを返す。
 * @precondition 「executable: string、argv: readonly string[]、environment: Readonly<Record<string, string>>、stdin: string | null」がstartOwnedWindowsProcessの入力契約を満たす。
 * @postcondition startOwnedWindowsProcessの責務を完了した結果だけを返す。
 * @effect startOwnedWindowsProcessは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure startOwnedWindowsProcessは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startOwnedWindowsProcessは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security startOwnedWindowsProcessはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency startOwnedWindowsProcessは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function startOwnedWindowsProcess(
  executable: string,
  argv: readonly string[],
  environment: Readonly<Record<string, string>>,
  stdin: string | null,
  outputOptions?: OwnedProcessOutputOptions,
): OwnedCommandHandle {
  const options: OwnedProcessOutputOptions = outputOptions ?? Object.freeze({});
  const interactive = options.interactive === true;
  const stdoutLimit = options.stdoutLimitBytes ?? STDOUT_LIMIT_BYTES;
  const stderrLimit = options.stderrLimitBytes ?? STDERR_LIMIT_BYTES;
  if (
    !Number.isSafeInteger(stdoutLimit) ||
    stdoutLimit <= 0 ||
    stdoutLimit > STDOUT_LIMIT_BYTES ||
    !Number.isSafeInteger(stderrLimit) ||
    stderrLimit <= 0 ||
    stderrLimit > STDOUT_LIMIT_BYTES ||
    (interactive && (stdin !== null || options.observeStdout !== undefined))
  )
    throw new Error("docker_process_output_configuration_invalid");
  const child = spawn(executable, [...argv], {
    windowsHide: !interactive,
    shell: false,
    env: environment,
    ...(options.workingDirectory === undefined
      ? {}
      : { cwd: options.workingDirectory }),
    stdio: interactive
      ? "inherit"
      : [stdin === null ? "ignore" : "pipe", "pipe", "pipe"],
  });
  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  let exceeded = false;
  let closed = false;
  let terminationRequested = false;
  let terminationHelper: ChildTreeTerminationHandle | null = null;
  const startCompletion = new Promise<boolean>((resolve) => {
    let settled = false;
    const settle = (isValue: boolean) => {
      if (settled) return;
      settled = true;
      resolve(isValue);
    };
    child.once("spawn", () => {
      settle(
        Number.isSafeInteger(child.pid) &&
          Number(child.pid) > 0 &&
          (interactive ||
            (child.stdout !== null &&
              child.stderr !== null &&
              (stdin === null || child.stdin !== null))),
      );
    });
    child.once("error", () => settle(false));
    if (
      !interactive &&
      (!child.stdout || !child.stderr || (stdin !== null && !child.stdin))
    )
      settle(false);
  });
  // A spawn error is an execution result, not proof that all stdio closed.
  const closeCompletion = new Promise<void>((resolve) => {
    child.once("close", () => {
      closed = true;
      resolve();
    });
  });
  const append = (chunk: Buffer | string, isStdout: boolean) => {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    if (isStdout) stdoutBytes += value.byteLength;
    else stderrBytes += value.byteLength;
    if (stdoutBytes > stdoutLimit || stderrBytes > stderrLimit) {
      exceeded = true;
      void terminateAndWait(5_000);
      return;
    }
    (isStdout ? stdoutChunks : stderrChunks).push(value);
    if (isStdout) {
      try {
        const observed: unknown = options.observeStdout?.(value);
        if (observed !== undefined) {
          void Promise.resolve(observed).catch(() => {});
          throw new Error("docker_process_output_observer_invalid_return");
        }
      } catch {
        exceeded = true;
        void terminateAndWait(5_000);
      }
    }
  };
  const completion = new Promise<CommandExecution>((resolve) => {
    let settled = false;
    const settle = (status: number | null, signal: NodeJS.Signals | null) => {
      if (settled) return;
      settled = true;
      resolve(
        Object.freeze({
          status,
          signal,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          outputExceeded: exceeded,
        }),
      );
    };
    child.once("error", () => settle(null, null));
    child.once("close", (status, signal) => settle(status, signal));
    const failTransport = () => {
      settle(null, null);
    };
    // Own error/close before touching streams: EMFILE/ENFILE may return a
    // ChildProcess without stdio, then emit error on the next tick.
    try {
      child.stdout?.on("error", failTransport);
      child.stderr?.on("error", failTransport);
      child.stdin?.on("error", failTransport);
      child.stdout?.on("data", (chunk) => append(chunk, true));
      child.stderr?.on("data", (chunk) => append(chunk, false));
      if (
        !interactive &&
        (!child.stdout || !child.stderr || (stdin !== null && !child.stdin))
      ) {
        failTransport();
      } else if (stdin !== null) {
        child.stdin?.end(stdin, "utf8");
      }
    } catch {
      failTransport();
    }
  });

  /**
   * 所有元子と共通Windows終端補助を同じ期限内でjoinする。
   *
   * @responsibility 終端要求を一度だけ発行し、元子と補助子のcloseを別に観測する。
   * @trace ARCH-000008
   * @input graceMs: number
   * @returns terminateAndWaitの計算結果を返す。
   * @precondition 「graceMs: number」がterminateAndWaitの入力契約を満たす。
   * @postcondition terminateAndWaitの責務を完了した結果だけを返す。
   * @effect Platform Accessを通じて所有子の固定tree終端を要求し、必要時に補助子を回収する。
   * @failure 不正期限、元子または補助子のclose未確認はfalse。要求発行だけを終了根拠にしない。
   * @invariant terminateAndWaitは宣言した境界以外へEffectを拡張しない。
   * @boundary 所有Docker CLI子とPlatform Accessの固定Windows終了補助。
   * @security terminateAndWaitはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency 重複呼出しも同じ元子と補助Handleを再観測し、新しい要求を発行しない。
   */
  async function terminateAndWait(graceMs: number) {
    if (
      !Number.isSafeInteger(graceMs) ||
      graceMs < 0 ||
      graceMs > 2_147_483_647
    )
      return false;
    const deadline = Date.now() + graceMs;
    const remaining = () => Math.max(0, deadline - Date.now());
    if (!closed && !terminationRequested) {
      terminationRequested = true;
      terminationHelper = startWindowsChildTreeTermination(child);
    }
    if (terminationHelper && !terminationHelper.closed()) {
      await terminationHelper.wait(remaining());
      if (!terminationHelper.closed())
        await terminationHelper.terminateAndWait(remaining());
    }
    await bounded(closeCompletion, remaining(), undefined);
    return closed && (terminationHelper === null || terminationHelper.closed());
  }

  return Object.freeze({
    started: (timeoutMs: number) => bounded(startCompletion, timeoutMs, false),
    wait: (timeoutMs: number) => bounded(completion, timeoutMs, null),
    terminateAndWait,
    closed: () =>
      closed && (terminationHelper === null || terminationHelper.closed()),
    terminationRequested: () => terminationRequested,
  });
}

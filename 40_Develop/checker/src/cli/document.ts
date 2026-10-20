/**
 * 文書Checkerの引数受付・Root初回確認・表示と終了値を所有する。
 * @responsibility Repository観測は専用編成へ渡し、公開コマンドの出力契約を維持する。
 * @trace ARCH-000001
 */
import { writeDocumentReport } from "../report/output.ts";
import type { CheckerRunRequest, CheckerResult } from "../cli/types.ts";

import { lstatIfPresent } from "../repository/observe.ts";
import { inspectDocumentRepository } from "../repository/document.ts";
import path from "node:path";

/**
 * CheckerCommandExitが担う状態と操作を提供する。
 *
 * @responsibility CheckerCommandExitに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000001
 * @construction CheckerCommandExitの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle CheckerCommandExitが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: CheckerCommandExitの宣言自体は実行時Effectを発行しない。
 * @failure N/A: CheckerCommandExitの宣言自体は実行時失敗を所有しない。
 * @invariant CheckerCommandExitで宣言した値と責務の対応を維持する。
 * @boundary N/A: CheckerCommandExitの宣言は外部境界を開かない。
 * @security N/A: CheckerCommandExitはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: CheckerCommandExitは共有非同期状態を持たない同期処理である。
 */
class CheckerCommandExit extends Error {
  readonly exitCode: number;

  constructor(exitCode: number) {
    super("checker_command_exit");
    this.exitCode = exitCode;
  }
}

/**
 * 文書Checkerを実行する。
 *
 * @responsibility 文書Checkerの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000001
 * @input request: CheckerRunRequest
 * @returns CheckerResultを返す。
 * @precondition 「request: CheckerRunRequest」がrunCheckerの入力契約を満たす。
 * @postcondition runCheckerの責務を完了した結果だけを返す。
 * @effect RootとRepositoryを読取りし、既存の出力callbackへ報告する。Filesystem書込みは行わない。
 * @failure runCheckerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCheckerは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: runCheckerはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runCheckerは共有非同期状態を持たない同期処理である。
 */
export function runChecker(request: CheckerRunRequest): CheckerResult {
  try {
    const startedAt = new Date();
    const startedAtMs = Date.now();
    const args = request.arguments;
    let shouldOutputJson = false;
    let shouldOutputSummary = false;
    let rootValue = request.cwd;
    const scopeValues: string[] = [];
    let referencesValue: string | null = null;

    /**
     * cli Errorを決定する。
     *
     * @responsibility cli Errorの導出に必要な入力、判定規則、返却結果の境界を所有する。
     * @trace ARCH-000001
     * @input message: string
     * @returns neverを返す。
     * @precondition 「message: string」がcliErrorの入力契約を満たす。
     * @postcondition cliErrorの責務を完了した結果だけを返す。
     * @effect 入力拒否理由をrequest.writeErrorへ出力する。
     * @failure cliErrorは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant cliErrorは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: cliErrorはProcess内の同一Subsystemで完結する。
     * @security N/A: cliErrorはAuthority、秘密値または信頼判断を扱わない。
     * @concurrency N/A: cliErrorは共有非同期状態を持たない同期処理である。
     */
    function cliError(message: string): never {
      request.writeError(`${message}\n`);
      throw new CheckerCommandExit(2);
    }

    for (let index = 0; index < args.length; index += 1) {
      const argument = args[index];
      if (argument === "--json") {
        shouldOutputJson = true;
        continue;
      }
      if (argument === "--summary") {
        shouldOutputSummary = true;
        continue;
      }
      if (["--root", "--scope", "--references"].includes(argument)) {
        const value = args[index + 1];
        if (!value || value.startsWith("--")) {
          cliError(`${argument} requires a path.`);
        }
        if (argument === "--root") rootValue = value;
        if (argument === "--scope") scopeValues.push(value);
        if (argument === "--references") referencesValue = value;
        index += 1;
        continue;
      }
      cliError(`Unknown option: ${argument}`);
    }

    const root = path.resolve(rootValue);
    const rootStat = lstatIfPresent(root);
    if (!rootStat) cliError(`--root does not exist: ${root}`);
    if (rootStat.isSymbolicLink()) {
      cliError(`--root must not be a symbolic link or junction: ${root}`);
    }
    if (!rootStat.isDirectory()) {
      cliError(`--root is not a directory: ${root}`);
    }

    const report = inspectDocumentRepository(
      root,
      scopeValues,
      referencesValue,
      startedAt,
      startedAtMs,
      cliError,
    );

    writeDocumentReport(
      report,
      { json: shouldOutputJson, summary: shouldOutputSummary },
      (value) => request.writeOutput(value),
    );

    return {
      exitCode: report.findings.some((item) => item.severity === "error")
        ? 1
        : 0,
    };
  } catch (error) {
    if (error instanceof CheckerCommandExit)
      return { exitCode: error.exitCode };
    throw error;
  }
}

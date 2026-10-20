/**
 * Checkerの単一CLI受付を所有する。
 *
 * @responsibility 既存三モードを選び、mode指定を除いた要求を各実処理へ渡す。
 * @trace ARCH-000001
 * @trace ARCH-000003
 * @trace ARCH-000008
 * @boundary 自Packageのbinと既存三操作の境界。他Packageへは公開しない。
 * @effect 受付自体はProcess・保存を追加せず、選択した既存操作のEffectに従う。
 * @security CLI受付は新しいAuthorityや外部AI依頼を発行しない。
 */
import { runChecker } from "../cli/document.ts";
import { runSemanticCoverage } from "./semantic.ts";
import { runTestCatalog } from "./test-catalog.ts";
import type { CheckerRunRequest, CheckerResult } from "./types.ts";

/**
 * CLI要求を既存モードの実処理へ一度だけ接続する。
 *
 * @responsibility 旧binの選択順・flag除去と要求搬送を維持する。
 * @trace ARCH-000001
 * @trace ARCH-000003
 * @trace ARCH-000008
 * @input request: 引数、cwd、出力・エラーの搬送先。
 * @returns 選択した操作の終了結果をそのまま返す。
 * @precondition Process固有のargv・stream接続はbinが所有する。
 * @postcondition 既存三操作のうち一つだけを呼ぶ。
 * @effect 文書・台帳は読取りと表示、Semanticの明示writeだけは既存Domain保存へ接続する。
 * @failure 実処理・出力callbackの例外を成功へ補完しない。
 * @invariant 両mode指定の残存flag拒否を含め、旧binの引数の扱いを変えない。
 * @boundary Processに依存しない受付と既存実処理の境界。
 * @security 入力から独自の保存先や実行権限を作らない。
 * @concurrency 同期実行。Process・Lock・永続状態を新設しない。
 */
export function runCheckerCommand(request: CheckerRunRequest): CheckerResult {
  const argumentValues = request.arguments;
  const isSemanticRequested = argumentValues.includes("--semantic");
  const isTestCatalogRequested = argumentValues.includes("--test-catalog");
  const runOperation = isTestCatalogRequested
    ? runTestCatalog
    : isSemanticRequested
      ? runSemanticCoverage
      : runChecker;
  return runOperation({
    arguments:
      isSemanticRequested || isTestCatalogRequested
        ? argumentValues.filter(
            (value) =>
              value !==
              (isTestCatalogRequested ? "--test-catalog" : "--semantic"),
          )
        : argumentValues,
    cwd: request.cwd,
    writeOutput: request.writeOutput,
    writeError: request.writeError,
  });
}

/**
 * Checkerの公開コマンドAPI境界。
 * @packageDocumentation
 * @responsibility CLI型要求を受ける三操作と共有型だけを公開し、各操作は出力先へ結果を搬送して終了codeを返す。
 * @trace ARCH-000001
 * @trace ARCH-000003
 * @trace ARCH-000008
 * @boundary 検証済みRepositoryのFilesystem観測とChecker判断の境界。
 */
export { runChecker } from "./cli/document.ts";
export type { CheckerResult, CheckerRunRequest } from "./cli/types.ts";
export type { CheckerFinding } from "./report/types.ts";
export { runSemanticCoverage } from "./cli/semantic.ts";
export { runTestCatalog } from "./cli/test-catalog.ts";

/**
 * CRDD Current Profile Checkerの公開境界。
 * @packageDocumentation
 * @responsibility 検査要求を受け、構造化した検査結果だけを返す。
 * @trace ARCH-000001
 * @boundary 検証済みRepositoryのFilesystem観測とChecker判断の境界。
 */
export {
  runChecker,
  type CheckerResult,
  type CheckerRunRequest,
} from "./application/checker-command.ts";
export type { CheckerFinding } from "./findings/finding-model.ts";

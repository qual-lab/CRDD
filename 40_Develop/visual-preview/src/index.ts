/**
 * UI成果物のlocalhost Preview、ブラウザ測定と所有Processの終了を提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility 読取り専用Preview、ブラウザ測定と所有Process Treeの終了操作を公開する。
 * @trace ARCH-000003
 * @boundary Visual Preview SubsystemとCLI・検証Consumerの公開境界。
 * @effect localhost Listenerの開始・終了、通常Fileの読取り、ブラウザ測定と所有Process Treeの終了要求・観測を行う。
 * @security Previewは外部Bind、Repository越境、Symbolic Link、Directory一覧および書込みを許可しない。Process終了は呼出し元が起動した所有Processと世代確認済み子孫に限定する。
 */
export {
  type VisualPreviewHandle,
  type VisualPreviewRequest,
  startVisualPreview,
} from "./preview/server.ts";
export type {
  BrowserWindowSize,
  BrowserVisualProfile,
  BrowserZoomMeasurement,
  BrowserZoomVerificationRequest,
  BrowserZoomVerificationResult,
  LocalWebVisualTarget,
  LocalWebVisualVerificationRequest,
  LocalWebVisualVerificationResult,
} from "./browser/types.ts";
export {
  verifyLocalWebApplicationVisual,
  verifyBrowserZoom,
} from "./browser/verify.ts";
export { observeLocalListener } from "./browser/devtools.ts";
export { closeOwnedBrowserProcessTree } from "./browser/process.ts";

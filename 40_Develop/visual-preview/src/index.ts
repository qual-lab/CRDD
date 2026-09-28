/**
 * UI成果物のlocalhost Previewを提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility 検証済みRepository内の許可Rootをlocalhostへ読取り専用で公開する。
 * @trace ARCH-000003
 * @boundary Visual Preview SubsystemとCLI・検証Consumerの公開境界。
 * @effect localhost Listenerを開始・終了し、要求された通常Fileを読取る。
 * @security 外部Bind、Repository越境、Symbolic Link、Directory一覧および書込みを許可しない。
 */
export {
  type VisualPreviewHandle,
  type VisualPreviewRequest,
  startVisualPreview,
} from "./preview-server.ts";
export {
  type BrowserWindowSize,
  type BrowserVisualProfile,
  type BrowserZoomMeasurement,
  type BrowserZoomVerificationRequest,
  type BrowserZoomVerificationResult,
  type LocalWebVisualTarget,
  type LocalWebVisualVerificationRequest,
  type LocalWebVisualVerificationResult,
  observeLocalListener,
  verifyLocalWebApplicationVisual,
  verifyBrowserZoom,
} from "./browser-zoom-verifier.ts";

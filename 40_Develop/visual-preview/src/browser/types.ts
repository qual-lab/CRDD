/**
 * Browser検証の実共有要求・結果型を所有する。
 * @responsibility Browser検証の実共有要求・結果型を所有する。
 * @trace ARCH-000003
 */

/**
 * Browser Windowの物理的な大きさを定義する。
 *
 * @responsibility Zoom前の検証Window寸法を固定する。
 * @trace ARCH-000003
 * @shape widthとheightの正整数で構成する。
 * @invariant CSS ViewportではなくBrowser Windowへ渡す物理寸法である。
 * @boundary Visual検証要求とChromium Process引数の境界。
 * @security N/A: 秘密値またはAuthorityを含まない。
 * @compatibility Chromiumの`--window-size`へ変換できる。
 */
export type BrowserWindowSize = Readonly<{
  width: number;
  height: number;
}>;

/**
 * 実Browser Zoom検証の開始要求を定義する。
 *
 * @responsibility 公開Root、対象Document、Zoom倍率、Window寸法および任意Browser Pathを固定する。
 * @trace ARCH-000003
 * @shape Repository相対Pathと正の倍率・寸法で構成する。
 * @invariant 対象Documentは公開Root直下または配下の相対HTML Pathに限る。
 * @boundary CLI・検証ConsumerからVisual Browser検証への入力境界。
 * @security Browser Pathを出力へ複製せず、専用Profileだけを使用する。
 * @compatibility browserExecutablePath省略時は対応済みChrome配置を探索する。
 */
export type BrowserZoomVerificationRequest = Readonly<{
  workingDirectory: string;
  rootRelativePath: string;
  documentPaths: readonly string[];
  zoomFactors: readonly number[];
  windowSize: BrowserWindowSize;
  browserExecutablePath?: string;
}>;

/**
 * Web Applicationの表示Profileを定義する。
 *
 * @responsibility Desktop、Tablet、Mobile等の表示名と物理Window寸法を一体で固定する。
 * @trace ARCH-000003
 * @shape nameと正のwidth／heightで構成する。
 * @invariant nameはEvidence上の識別だけに用い、Browser実行引数へ直接展開しない。
 * @boundary Product固有Visual Gateと共通Browser検証器の境界。
 * @security N/A: 秘密値またはAuthorityを含まない。
 * @compatibility 新しいProfileは呼出し側が追加できる。
 */
export type BrowserVisualProfile = Readonly<{
  name: string;
  windowSize: BrowserWindowSize;
}>;

/**
 * Web Application内で一緒に表示確認する画面Targetを定義する。
 *
 * @responsibility Page Pathと、そのPageで可視でなければならないLogical ScreenのDOM IDを固定する。
 * @trace ARCH-000003
 * @shape pageId、同一Origin相対Path、重複しないtargetIdsで構成する。
 * @invariant Target IDは安定した製品側IDを参照し、CSS Selector一般を実行しない。
 * @boundary Product固有Screen Inventoryと実DOM観測の境界。
 * @security 外部Origin、Credential付きURLおよびScript式を許可しない。
 * @compatibility 一Pageで複数Logical Screenを確認できる。
 */
export type LocalWebVisualTarget = Readonly<{
  pageId: string;
  pagePath: string;
  targetIds: readonly string[];
}>;

/**
 * 起動済みlocalhost Web ApplicationのVisual検証要求を定義する。
 *
 * @responsibility Server lifecycleをProduct側に残したまま、Target、ProfileおよびZoomの全組合せを固定する。
 * @trace ARCH-000003
 * @shape Repository Root、loopback Base URL、Target、Profile、Zoomおよび任意Browser Pathで構成する。
 * @invariant 検証器はApplication Serverを開始・終了しない。
 * @boundary Product Serverと共通Browser Process／DevTools検証の境界。
 * @security localhost HTTPだけを許可し、通常Browser Profileを使用しない。
 * @compatibility Product固有Serverを変更せず利用できる。
 */
export type LocalWebVisualVerificationRequest = Readonly<{
  workingDirectory: string;
  baseUrl: string;
  targets: readonly LocalWebVisualTarget[];
  profiles: readonly BrowserVisualProfile[];
  zoomFactors: readonly number[];
  browserExecutablePath?: string;
}>;

/**
 * 一つのDocument・Zoom倍率で得た実測値を定義する。
 *
 * @responsibility 合否判定に必要なBrowser実測値だけを保持する。
 * @trace ARCH-000003
 * @shape Viewport、DPR、Overflow、文字、操作対象および合否で構成する。
 * @invariant Absolute Path、DOM本文、Credentialまたは外部URLを含まない。
 * @boundary Chromium RuntimeからVisual品質結果への観測境界。
 * @security 対象File名以外のRepository情報を公開しない。
 * @compatibility contract v1のResult Itemとして固定する。
 */
export type BrowserZoomMeasurement = Readonly<{
  documentPath: string;
  profileName: string;
  targetIds: readonly string[];
  missingTargetIds: readonly string[];
  hiddenTargetIds: readonly string[];
  requestedZoomFactor: number;
  observedDevicePixelRatio: number;
  innerWidth: number;
  innerHeight: number;
  outerWidth: number;
  outerHeight: number;
  documentScrollWidth: number;
  minimumVisibleFontSize: number | null;
  minimumInteractiveWidth: number | null;
  minimumInteractiveHeight: number | null;
  minimumInteractiveWidthKind: string | null;
  minimumInteractiveHeightKind: string | null;
  positiveTabIndexCount: number;
  focusableElementCount: number;
  unfocusableInteractiveCount: number;
  focusOrderValid: boolean;
  imageCount: number;
  loadedImageCount: number;
  failedImageCount: number;
  horizontalOverflow: boolean;
  zoomObserved: boolean;
  normalBrowserCloseAccepted: boolean;
  browserCloseMode: BrowserCloseMode;
  forcedBrowserCloseRequired: boolean;
  browserDescendantTerminationRequired: boolean;
  browserShutdownElapsedMilliseconds: number;
  browserProcessTreeExitConfirmed: boolean;
  browserProcessTreeExitObservationElapsedMilliseconds: number;
  browserDevToolsUnavailableAfterClose: boolean;
  profileCleanupConfirmed: boolean;
  passed: boolean;
  failures: readonly string[];
}>;

/**
 * Browser終了時に実際に成立した終了経路を定義する。
 *
 * @responsibility 正常終了、SIGTERM、SIGKILLおよび観測不能を相互排他的に記録する。
 * @trace ARCH-000003
 * @shape 四つの固定文字列のいずれかで構成する。
 * @invariant Signalを送った経路をnormalへ畳まない。
 * @boundary Browser Process終了操作と公開検証結果の境界。
 * @security Process IDまたは実行Pathを含まない。
 * @compatibility contract v1の追加観測値として扱う。
 */
export type BrowserCloseMode = "normal" | "sigterm" | "sigkill" | "unknown";

/**
 * localhost Listenerの観測状態を定義する。
 *
 * @responsibility 接続拒否による不存在、接続成立による存在および観測不能を分離する。
 * @trace ARCH-000003
 * @shape absent、present、unknownの固定文字列で構成する。
 * @invariant timeoutまたは分類不能Errorをabsentへ畳まない。
 * @boundary localhost TCP観測とcleanup判定の境界。
 * @security Host名またはPortを結果へ複製しない。
 * @compatibility BrowserとPreviewの終了後観測で共通利用する。
 */
export type ListenerObservation = "absent" | "present" | "unknown";

/**
 * 実Browser Zoom検証の完了結果を定義する。
 *
 * @responsibility 全対象の測定結果と一括合否をConsumerへ返す。
 * @trace ARCH-000003
 * @shape contract、status、Browser種別、閾値および測定値で構成する。
 * @invariant 一件でも不適合ならstatusはfailedである。
 * @boundary Visual Browser検証からCLI・品質Evidenceへの結果境界。
 * @security Host Path、Profile PathおよびDevTools Endpointを含まない。
 * @compatibility contractはv1として固定する。
 */
export type BrowserZoomVerificationResult = Readonly<{
  contract: "crdd/visual-browser-zoom-verification/v1";
  status: "passed" | "failed";
  browser: "chrome";
  minimumFontSize: 12;
  minimumInteractiveSize: 32;
  measurements: readonly BrowserZoomMeasurement[];
  previewListenerClosed: boolean;
  temporaryRootRemoved: boolean;
  cleanupConfirmed: boolean;
}>;

/**
 * 起動済みlocalhost Web ApplicationのVisual検証結果を定義する。
 *
 * @responsibility 全Target×Profile×Zoomの測定値とBrowser資源清掃結果を返す。
 * @trace ARCH-000003
 * @shape contract、status、閾値、測定一覧および一時Root清掃結果で構成する。
 * @invariant Application Listenerの終了確認はServer Ownerである呼出し側が行う。
 * @boundary 共通Browser検証器からProduct固有System Gateへの結果境界。
 * @security Absolute Path、PID、DOM本文およびProfile Pathを含まない。
 * @compatibility contract v1として固定する。
 */
export type LocalWebVisualVerificationResult = Readonly<{
  contract: "crdd/local-web-visual-verification/v1";
  status: "passed" | "failed";
  browser: "chrome";
  minimumFontSize: 12;
  minimumInteractiveSize: 32;
  measurements: readonly BrowserZoomMeasurement[];
  applicationListenerOwnedByCaller: true;
  temporaryRootRemoved: boolean;
  browserCleanupConfirmed: boolean;
}>;

/**
 * 実Browser ZoomでVisual成果物を検証する。
 *
 * @responsibility 専用Browser Profile、Chrome DevTools接続、表示計測および一時資源清掃を所有する。
 * @trace ARCH-000003
 */
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import { promisify } from "node:util";

import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../domain-model/src/storage/index.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../domain-model/src/repository/index.ts";
import {
  type VisualPreviewHandle,
  startVisualPreview,
} from "./preview-server.ts";

const CONTRACT = "crdd/visual-browser-zoom-verification/v1" as const;
const BROWSER_PROCESS_TREE_GRACE_MILLISECONDS = 5_000;
const BROWSER_PROCESS_TREE_EXIT_TIMEOUT_MILLISECONDS = 30_000;
const execFileAsync = promisify(execFile);

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
  contract: typeof CONTRACT;
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

/**
 * Chrome DevTools Protocolの応答を定義する。
 *
 * @responsibility Request IDと成功・失敗Payloadを型境界へ閉じる。
 * @trace ARCH-000003
 * @shape id、resultまたはerrorで構成する。
 * @invariant resultとerrorの意味を呼出し側が検査する。
 * @boundary WebSocket JSONとProcess内TypeScriptの境界。
 * @security 未検証Payloadを業務結果へ直接採用しない。
 * @compatibility Runtime.evaluateが返す最小Shapeだけを利用する。
 */
type DevToolsResponse = Readonly<{
  id?: number;
  result?: Readonly<{
    result?: Readonly<{ value?: unknown }>;
    exceptionDetails?: Readonly<{
      text?: string;
      exception?: Readonly<{ description?: string }>;
    }>;
  }>;
  error?: unknown;
}>;

/**
 * Visual計測Scriptの戻り値を定義する。
 *
 * @responsibility Browser内で観測した生の数値を検証側へ搬送する。
 * @trace ARCH-000003
 * @shape Viewport、DPR、文字、操作対象およびFocus情報で構成する。
 * @invariant Browser内のAbsolute Pathまたは本文を含まない。
 * @boundary Browser JavaScriptとNode.js検証器の境界。
 * @security DOM内容を返さない。
 * @compatibility 数値またはnullだけを使用する。
 */
type RawBrowserMeasurement = Readonly<{
  devicePixelRatio: number;
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
  imageCount: number;
  loadedImageCount: number;
  failedImageCount: number;
  missingTargetIds: readonly string[];
  hiddenTargetIds: readonly string[];
}>;

/**
 * OS Processの親子関係を定義する。
 *
 * @responsibility 所有Browser Process Treeを辿るためのPID関係だけを保持する。
 * @trace ARCH-000003
 * @shape pidとparentPidの正整数で構成する。
 * @invariant Command line、実行Pathまたは利用者情報を含まない。
 * @boundary OS Process一覧とVisual検証器の型境界。
 * @security 公開結果へPIDを含めない。
 * @compatibility Windows CIMとPOSIX psの結果を同じ形へ正規化する。
 */
export type ProcessPair = Readonly<{
  pid: number;
  parentPid: number;
  identity: string;
  terminationIdentityVerified: boolean;
}>;

/**
 * 実Browser Zoom検証Processの所有境界で使用するOwnedProcessIdentityの構造を固定する。
 *
 * @responsibility 実Browser Zoom検証Processの所有境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000003
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type OwnedProcessIdentity = Readonly<{
  pid: number;
  identity: string;
  terminationIdentityVerified: boolean;
  depth: number;
}>;

/**
 * 残存所有Processの限定終了処理が利用する依存を定義する。
 *
 * @responsibility 現在Process観測と終了Signalを分離し、安全反例を実Effectなしで検証可能にする。
 * @trace ARCH-000003
 * @shape Process Snapshot Readerと単一PID Terminatorで構成する。
 * @invariant Production既定値はOS Process一覧とNode.js Process APIだけを使用する。
 * @boundary 世代Identity判定とOS Process Effectの境界。
 * @security 試験以外のConsumerへ任意Process選択Authorityを公開入口から提供しない。
 * @compatibility visual-preview package内の直接境界試験だけが差し替える。
 */
export type OwnedProcessTerminationDependencies = Readonly<{
  readCurrentProcesses: () => Promise<readonly ProcessPair[]>;
  terminateProcess: (pid: number) => void;
}>;

/**
 * 所有Process Treeの終了後観測結果を定義する。
 *
 * @responsibility 不存在確認の成否と観測所要時間を一つの結果として保持する。
 * @trace ARCH-000003
 * @shape confirmedとelapsedMillisecondsで構成する。
 * @invariant PID、Process PathまたはCommand Lineを含まない。
 * @boundary OS Process Table観測からVisual検証結果への境界。
 * @security Process Identityを公開結果へ複製しない。
 * @compatibility Browser cleanup診断の内部契約として扱う。
 */
type ProcessTreeExitObservation = Readonly<{
  confirmed: boolean;
  elapsedMilliseconds: number;
}>;

/**
 * 実行中Processの親子関係を取得する。
 *
 * @responsibility 所有Browser Process Treeの終了後観測に必要なPIDと親PIDだけを取得する。
 * @trace ARCH-000003
 * @input N/A: 現在のOS Process一覧を使用する。
 * @returns PIDと親PIDの組を返す。
 * @precondition WindowsではPowerShell、Linuxではprocfs、その他POSIXではpsが利用可能である。
 * @postcondition Command出力のPath、引数または秘密値を保持しない。
 * @effect Windowsまたはその他POSIXでは外部Commandを一回実行し、Linuxではprocfsを読取る。
 * @failure Process一覧を決定論的に取得できない場合はErrorを投げる。
 * @invariant PIDと親PID以外を結果へ含めない。
 * @boundary Node.js ProcessとOS Process観測境界。
 * @security Command line、実行Pathおよび利用者情報を取得しない。
 * @concurrency 取得時点のSnapshotとして扱い、後続で終了を再観測する。
 */
async function readProcessPairs(): Promise<readonly ProcessPair[]> {
  if (process.platform === "win32") {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CreationDate | ConvertTo-Json -Compress",
      ],
      { windowsHide: true, timeout: 10_000 },
    );
    const parsed = JSON.parse(stdout) as
      | Readonly<{
          ProcessId?: unknown;
          ParentProcessId?: unknown;
          CreationDate?: unknown;
        }>
      | readonly Readonly<{
          ProcessId?: unknown;
          ParentProcessId?: unknown;
          CreationDate?: unknown;
        }>[];
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return Object.freeze(
      entries.flatMap((entry) => {
        const pid = Number(entry.ProcessId);
        const parentPid = Number(entry.ParentProcessId);
        const creationDate = entry.CreationDate;
        return Number.isInteger(pid) &&
          Number.isInteger(parentPid) &&
          typeof creationDate === "string" &&
          creationDate.length > 0
          ? [
              Object.freeze({
                pid,
                parentPid,
                identity: `${pid}:${creationDate}`,
                terminationIdentityVerified: true,
              }),
            ]
          : [];
      }),
    );
  }
  if (process.platform === "linux") {
    const entries = await readdir("/proc", { withFileTypes: true });
    const pairs = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && /^\d+$/u.test(entry.name))
        .map(async (entry): Promise<ProcessPair | undefined> => {
          try {
            const stat = await readFile(`/proc/${entry.name}/stat`, "utf8");
            const firstSpace = stat.indexOf(" ");
            const closingParenthesis = stat.lastIndexOf(")");
            if (firstSpace < 1 || closingParenthesis < firstSpace)
              return undefined;
            const pid = Number(stat.slice(0, firstSpace));
            const fields = stat
              .slice(closingParenthesis + 2)
              .trim()
              .split(/\s+/u);
            const parentPid = Number(fields[1]);
            const startTime = fields[19];
            return Number.isInteger(pid) &&
              Number.isInteger(parentPid) &&
              typeof startTime === "string" &&
              /^\d+$/u.test(startTime)
              ? Object.freeze({
                  pid,
                  parentPid,
                  identity: `${pid}:${startTime}`,
                  terminationIdentityVerified: true,
                })
              : undefined;
          } catch (error) {
            if (
              error instanceof Error &&
              "code" in error &&
              (error.code === "ENOENT" || error.code === "ESRCH")
            )
              return undefined;
            throw error;
          }
        }),
    );
    return Object.freeze(
      pairs.filter((pair): pair is ProcessPair => pair !== undefined),
    );
  }
  const { stdout } = await execFileAsync("ps", ["-A", "-o", "pid=,ppid="], {
    timeout: 10_000,
  });
  return Object.freeze(
    stdout
      .split(/\r?\n/u)
      .map((line) => line.trim().split(/\s+/u).map(Number))
      .flatMap(([pid, parentPid]) =>
        Number.isInteger(pid) && Number.isInteger(parentPid)
          ? [
              Object.freeze({
                pid: pid as number,
                parentPid: parentPid as number,
                identity: String(pid),
                terminationIdentityVerified: false,
              }),
            ]
          : [],
      ),
  );
}

/**
 * 起点PIDを含む所有Process TreeのPID集合を固定する。
 *
 * @responsibility Browser終了前Snapshotから起点Processと全子孫を抽出する。
 * @trace ARCH-000003
 * @input rootPidに現在の検証操作が起動したBrowser PIDを受け取る。
 * @returns 起点PIDを含む重複のないPID一覧を返す。
 * @precondition rootPidは正の整数であり、同じ操作がspawnしたProcessである。
 * @postcondition 名前一致または実行Path一致で別Processを混入しない。
 * @effect OS Process一覧を読取る。
 * @failure Process一覧を取得できない場合はErrorを投げる。
 * @invariant 親子Relationだけで閉包を作る。
 * @boundary Browser所有ProcessとOS Process一覧の境界。
 * @security PIDを公開結果へ含めない。
 * @concurrency Snapshot後に新設された子孫はDevTools停止とProfile削除でも補完確認する。
 */
export async function collectOwnedProcessIds(
  rootPid: number,
): Promise<readonly OwnedProcessIdentity[]> {
  const pairs = await readProcessPairs();
  const depths = new Map<number, number>([[rootPid, 0]]);
  let hasChanged = true;
  while (hasChanged) {
    hasChanged = false;
    for (const pair of pairs) {
      const parentDepth = depths.get(pair.parentPid);
      if (parentDepth !== undefined && !depths.has(pair.pid)) {
        depths.set(pair.pid, parentDepth + 1);
        hasChanged = true;
      }
    }
  }
  return Object.freeze(
    pairs
      .filter((pair) => depths.has(pair.pid))
      .map((pair) =>
        Object.freeze({
          pid: pair.pid,
          identity: pair.identity,
          terminationIdentityVerified: pair.terminationIdentityVerified,
          depth: depths.get(pair.pid) as number,
        }),
      )
      .sort((left, right) => left.depth - right.depth || left.pid - right.pid),
  );
}

/**
 * PIDが現在も存在するかを副作用なく確認する。
 *
 * @responsibility 所有Process Treeの終了後不存在をPID単位で観測する。
 * @trace ARCH-000003
 * @input pidに観測対象Process IDを受け取る。
 * @returns Processが存在すればtrue、存在しなければfalseを返す。
 * @precondition pidはcollectOwnedProcessIdsが返した正の整数である。
 * @postcondition 対象Processへ終了Signalを送らない。
 * @effect Signal 0によるOS Process存在確認だけを行う。
 * @failure 権限拒否は存在として扱い、不存在へ丸めない。
 * @invariant PIDをLogまたは公開結果へ出さない。
 * @boundary Node.js Process APIとOS Process Tableの境界。
 * @security 別Processを変更しない。
 * @concurrency 観測直後のPID再利用RiskをProfileとDevTools不存在確認で補う。
 */
function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(
      error instanceof Error &&
      "code" in error &&
      error.code === "ESRCH"
    );
  }
}

/**
 * 所有Process Treeの全PIDが終了するまで限定時間再観測する。
 *
 * @responsibility Browser親子Processの終了後0件を明示的に確認する。
 * @trace ARCH-000003
 * @input processIdsに終了前に固定した所有Process PID一覧を受け取る。
 * @returns 全PID不存在の確認結果と観測所要時間を返す。
 * @precondition processIdsは同じBrowser操作から導出されている。
 * @postcondition Processへ変更Signalを発行しない。
 * @effect OS Process存在確認を最大30秒間再実行する。
 * @failure 観測不能はconfirmed=falseとして成功へ畳まない。
 * @invariant 名前一致の別Browserを対象にしない。
 * @boundary Browser Process Treeの終了後観測境界。
 * @security PIDを外部へ公開しない。
 * @concurrency 全PIDが同じ観測回で不存在になるまで成功にしない。
 */
async function waitForProcessTreeExit(
  processIds: readonly OwnedProcessIdentity[],
  timeoutMilliseconds: number,
): Promise<ProcessTreeExitObservation> {
  const startedAt = Date.now();
  const createObservation = (confirmed: boolean): ProcessTreeExitObservation =>
    Object.freeze({
      confirmed,
      elapsedMilliseconds: Math.max(0, Date.now() - startedAt),
    });
  const deadline = startedAt + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (
      processIds.every((processIdentity) => !processExists(processIdentity.pid))
    )
      return createObservation(true);
    const currentIdentities = new Set(
      (await readProcessPairs()).map((processPair) => processPair.identity),
    );
    if (
      processIds.every(
        (processIdentity) => !currentIdentities.has(processIdentity.identity),
      )
    )
      return createObservation(true);
    await wait(500);
  }
  const currentIdentities = new Set(
    (await readProcessPairs()).map((processPair) => processPair.identity),
  );
  return createObservation(
    processIds.every(
      (processIdentity) => !currentIdentities.has(processIdentity.identity),
    ),
  );
}

/**
 * 正常終了後も残る所有Browser子Processだけへ終了を要求する。
 *
 * @responsibility Windowsで親Process終了が子Process Tree回収を保証しない場合の限定Fallbackを所有する。
 * @trace ARCH-000003
 * @input processIdsにBrowser開始後に固定した所有Process Identity一覧を受け取る。
 * @returns 同じIdentityを再確認して終了要求を発行したProcess数を返す。
 * @precondition processIdsは同じBrowser操作から親子Relationで導出されている。
 * @postcondition 一致した残存Processにだけ一回ずつ終了要求を発行する。
 * @effect 現在のProcess一覧を再観測し、Identity一致したProcessへSIGTERMを送る。
 * @failure Process一覧を観測できない、または一致Processへの終了要求に失敗した場合はErrorを投げる。
 * @invariant PID一致だけでは操作せず、生成時刻を含むIdentity一致を必須とする。
 * @boundary Browser所有Process TreeとOS Process APIの境界。
 * @security 別操作、通常Profileまたは利用者所有Browserを終了しない。
 * @concurrency 子孫から親の順に処置し、処置直前のIdentity Snapshotだけを使用する。
 */
export async function terminateRemainingOwnedBrowserProcesses(
  processIds: readonly OwnedProcessIdentity[],
  dependencies: OwnedProcessTerminationDependencies = Object.freeze({
    readCurrentProcesses: readProcessPairs,
    terminateProcess: (pid) => process.kill(pid, "SIGTERM"),
  }),
): Promise<number> {
  const currentProcessesByIdentity = new Map(
    (await dependencies.readCurrentProcesses()).map((processPair) => [
      processPair.identity,
      processPair,
    ]),
  );
  const remainingProcesses = [...processIds]
    .sort((left, right) => right.depth - left.depth || right.pid - left.pid)
    .flatMap((processIdentity) => {
      const currentProcess = currentProcessesByIdentity.get(
        processIdentity.identity,
      );
      return currentProcess === undefined
        ? []
        : [{ captured: processIdentity, current: currentProcess }];
    });
  if (
    remainingProcesses.some(
      ({ captured, current }) =>
        !captured.terminationIdentityVerified ||
        !current.terminationIdentityVerified,
    )
  )
    throw new Error("visual_zoom_owned_process_identity_unverified");
  let terminationRequestCount = 0;
  for (const { current } of remainingProcesses) {
    try {
      dependencies.terminateProcess(current.pid);
      terminationRequestCount += 1;
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ESRCH")
        continue;
      throw error;
    }
  }
  return terminationRequestCount;
}

/**
 * 所有Browser Process Treeの終了処理結果を定義する。
 *
 * @responsibility 正常終了受理、実終了経路、限定Fallback、最終不存在および途中Errorを分離する。
 * @trace ARCH-000003
 * @shape 終了観測値と全段cleanup後に集約したErrorで構成する。
 * @invariant 一段の失敗で後続cleanupを省略しない。
 * @boundary Browser正常終了要求、OS Process操作および呼出し側の結果判定境界。
 * @security PID、Process PathまたはCommand Lineを公開結果へ含めない。
 * @compatibility visual-preview内部試験から直接反証できる安定契約として扱う。
 */
export type OwnedBrowserProcessCleanupResult = Readonly<{
  normalCloseAccepted: boolean;
  closeMode: BrowserCloseMode;
  descendantTerminationRequired: boolean;
  processTreeExitConfirmed: boolean;
  processTreeExitObservationElapsedMilliseconds: number;
  shutdownElapsedMilliseconds: number;
  cleanupErrors: readonly unknown[];
}>;

/**
 * Browser終了直前の所有Treeを固定し、正常終了と限定Fallbackを順に実行する。
 *
 * @responsibility 終了直前に生成済みの全子孫を世代Identity付きで固定し、全cleanup段をbest effortで完了する。
 * @trace ARCH-000003
 * @input childに本操作が起動したBrowser、requestNormalCloseにBrowser固有の正常終了要求を受け取る。
 * @returns 終了経路、Fallback有無、最終不存在および全段実行後のError一覧を返す。
 * @precondition childは利用者の通常Browserではなく本検証操作専用Processである。
 * @postcondition Snapshot、正常終了、親Process停止、残存子孫処置および最終観測を可能な範囲ですべて試行する。
 * @effect exactな世代Identityを確認できた所有Processだけへ必要時に終了Signalを送る。
 * @failure Identity観測不能、停止失敗または最終残存をcleanupErrorsとfalse観測で返す。
 * @invariant 名前、PathまたはPIDだけで操作対象を広げない。
 * @boundary DevTools Browser.close、Node.js ChildProcessおよびOS Process Treeの終了境界。
 * @security Identityを確認できないPlatformではFallback Effect 0で失敗する。
 * @concurrency 終了要求直前のSnapshotを使用し、各cleanup段のErrorを集約して後続段を継続する。
 */
export async function closeOwnedBrowserProcessTree(
  child: ChildProcess,
  requestNormalClose: () => Promise<void>,
): Promise<OwnedBrowserProcessCleanupResult> {
  const startedAt = Date.now();
  const cleanupErrors: unknown[] = [];
  let ownedProcessIds: readonly OwnedProcessIdentity[] = [];
  let isNormalCloseAccepted = false;
  let closeMode: BrowserCloseMode = "unknown";
  let descendantTerminationRequired = false;
  let processTreeExitConfirmed = false;
  let processTreeExitObservationElapsedMilliseconds = 0;
  try {
    if (child.pid === undefined)
      throw new Error("visual_zoom_browser_pid_unavailable");
    ownedProcessIds = await collectOwnedProcessIds(child.pid);
    if (ownedProcessIds.length === 0)
      throw new Error("visual_zoom_owned_process_tree_unobserved");
  } catch (error) {
    cleanupErrors.push(error);
  }
  try {
    await requestNormalClose();
    isNormalCloseAccepted = true;
  } catch {
    isNormalCloseAccepted = false;
  }
  try {
    closeMode = await stopOwnedBrowser(child);
  } catch (error) {
    cleanupErrors.push(error);
  }
  if (ownedProcessIds.length > 0) {
    try {
      const gracefulObservation = await waitForProcessTreeExit(
        ownedProcessIds,
        BROWSER_PROCESS_TREE_GRACE_MILLISECONDS,
      );
      processTreeExitObservationElapsedMilliseconds +=
        gracefulObservation.elapsedMilliseconds;
      processTreeExitConfirmed = gracefulObservation.confirmed;
    } catch (error) {
      cleanupErrors.push(error);
    }
    if (!processTreeExitConfirmed) {
      try {
        descendantTerminationRequired =
          (await terminateRemainingOwnedBrowserProcesses(ownedProcessIds)) > 0;
      } catch (error) {
        cleanupErrors.push(error);
      }
      try {
        const finalObservation = await waitForProcessTreeExit(
          ownedProcessIds,
          BROWSER_PROCESS_TREE_EXIT_TIMEOUT_MILLISECONDS,
        );
        processTreeExitObservationElapsedMilliseconds +=
          finalObservation.elapsedMilliseconds;
        processTreeExitConfirmed = finalObservation.confirmed;
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
  }
  return Object.freeze({
    normalCloseAccepted: isNormalCloseAccepted,
    closeMode,
    descendantTerminationRequired,
    processTreeExitConfirmed,
    processTreeExitObservationElapsedMilliseconds,
    shutdownElapsedMilliseconds: Math.max(0, Date.now() - startedAt),
    cleanupErrors: Object.freeze([...cleanupErrors]),
  });
}

/**
 * Visual計測終了時に必ず試行するcleanup段を定義する。
 *
 * @responsibility Process、DevToolsおよびProfileの清掃責務を固定順序で明示する。
 * @trace ARCH-000003
 * @shape 三つの非同期cleanup関数で構成する。
 * @invariant 前段の失敗は後続段の実行可否を変更しない。
 * @boundary 条件別Visual計測と資源別cleanupの境界。
 * @security cleanup対象は各関数が既に所有確認した資源に限る。
 * @compatibility 新しい所有資源を追加する場合は本契約とERB-IT-020を同時更新する。
 */
export type VisualCleanupStages = Readonly<{
  closeProcessTree: () => Promise<void>;
  confirmDevToolsClosed: () => Promise<void>;
  removeProfile: () => Promise<void>;
}>;

/**
 * Visual計測のcleanup各段を独立して試行し、全Errorを返す。
 *
 * @responsibility 一段の例外で後続cleanupが省略されることを防ぐ。
 * @trace ARCH-000003
 * @input stagesにProcess、DevTools、Profileの用途限定cleanup関数を受け取る。
 * @returns 全段実行後に捕捉したError一覧を実行順で返す。
 * @precondition 各関数は同じVisual計測操作が所有する資源だけを対象とする。
 * @postcondition 三段を各一回試行し、Errorを成功へ畳まない。
 * @effect 渡されたcleanup関数をProcess、DevTools、Profileの順に一回ずつ実行する。
 * @failure 個別Errorは集約して返し、関数自身は途中でthrowしない。
 * @invariant cleanup段の順序と実行数を入力Errorで変更しない。
 * @boundary 資源別cleanupと計測全体の失敗判定境界。
 * @security 新しいAuthorityまたは対象Identityを生成しない。
 * @concurrency cleanup段は同じ操作内で直列実行する。
 */
export async function runVisualCleanupStages(
  stages: VisualCleanupStages,
): Promise<readonly unknown[]> {
  const errors: unknown[] = [];
  for (const stage of [
    stages.closeProcessTree,
    stages.confirmDevToolsClosed,
    stages.removeProfile,
  ]) {
    try {
      await stage();
    } catch (error) {
      errors.push(error);
    }
  }
  return Object.freeze([...errors]);
}

/**
 * DevTools Endpointが終了後に利用不能であることを確認する。
 *
 * @responsibility Browser終了後に同じDebugger Listenerが残っていないことを観測する。
 * @trace ARCH-000003
 * @input portに同じBrowserが使用したlocalhost DevTools Portを受け取る。
 * @returns 接続拒否ならabsent、接続成立ならpresent、観測不能ならunknownを返す。
 * @precondition portはwaitForDevToolsが同じ専用Profileから取得した値である。
 * @postcondition 外部Hostへ接続しない。
 * @effect localhost HTTP GETを限定回数実行する。
 * @failure timeout、Abortまたは分類不能Errorはunknownとし不存在へ畳まない。
 * @invariant 応答本文やEndpointを結果へ保存しない。
 * @boundary Chrome DevTools localhost Listenerの終了後観測境界。
 * @security localhost以外へ送信しない。
 * @concurrency 終了直後の遅延を最大5秒間再観測する。
 */
async function confirmDevToolsUnavailable(
  port: number,
): Promise<ListenerObservation> {
  const deadline = Date.now() + 5_000;
  let observation: ListenerObservation = "unknown";
  while (Date.now() < deadline) {
    observation = await observeLocalListener(port);
    if (observation === "absent") return observation;
    await wait(100);
  }
  return observation;
}

/**
 * Preview Listenerがclose後に接続を受理しないことを確認する。
 *
 * @responsibility HTTP Serverのclose完了と実際のListener不存在を別に観測する。
 * @trace ARCH-000003
 * @input healthUrlに同じPreview Handleが公開したlocalhost Health URLを受け取る。
 * @returns 接続拒否ならabsent、接続成立ならpresent、観測不能ならunknownを返す。
 * @precondition healthUrlはstartVisualPreviewが返したlocalhost URLである。
 * @postcondition 外部Hostへ接続しない。
 * @effect localhost HTTP GETを限定回数実行する。
 * @failure timeoutまたは分類不能Errorはunknownとしcleanup成功へ畳まない。
 * @invariant URLまたはResponse本文を公開結果へ含めない。
 * @boundary Visual Preview Listenerの終了後観測境界。
 * @security startVisualPreview由来のlocalhost URLだけを使用する。
 * @concurrency close直後の遅延を最大5秒間再観測する。
 */
async function confirmPreviewListenerClosed(
  healthUrl: string,
): Promise<ListenerObservation> {
  const url = new URL(healthUrl);
  if (url.hostname !== "127.0.0.1" || url.port.length === 0) return "unknown";
  const port = Number(url.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) return "unknown";
  const deadline = Date.now() + 5_000;
  let observation: ListenerObservation = "unknown";
  while (Date.now() < deadline) {
    observation = await observeLocalListener(port);
    if (observation === "absent") return observation;
    await wait(100);
  }
  return observation;
}

/**
 * localhost TCP Listenerの存在状態を一回だけ観測する。
 *
 * @responsibility 接続成立、明示的接続拒否および観測不能を混同せず分類する。
 * @trace ARCH-000003
 * @input portにlocalhost上の検証対象TCP Portを受け取る。
 * @returns present、absentまたはunknownを返す。
 * @precondition portは1から65535の整数である。
 * @postcondition 作成したSocketを必ず破棄する。
 * @effect localhostへのTCP接続を一回だけ試行する。
 * @failure ECONNREFUSED以外のErrorと500ms timeoutはunknownを返す。
 * @invariant 接続拒否だけをListener不存在の根拠にする。
 * @boundary Node.js Socketとlocalhost Listenerの観測境界。
 * @security localhost以外へ接続しない。
 * @concurrency connect、error、timeoutの最初の一件だけを採用する。
 */
export async function observeLocalListener(
  port: number,
): Promise<ListenerObservation> {
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) return "unknown";
  return await new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let isSettled = false;
    const settle = (observation: ListenerObservation): void => {
      if (isSettled) return;
      isSettled = true;
      socket.destroy();
      resolve(observation);
    };
    socket.setTimeout(500);
    socket.once("connect", () => settle("present"));
    socket.once("timeout", () => settle("unknown"));
    socket.once("error", (error: NodeJS.ErrnoException) =>
      settle(error.code === "ECONNREFUSED" ? "absent" : "unknown"),
    );
  });
}

/**
 * 指定時間だけ非同期に待機する。
 *
 * @responsibility Browser起動観測の短いPolling間隔を提供する。
 * @trace ARCH-000003
 * @input millisecondsに待機時間を受け取る。
 * @returns 待機完了時に解決するPromiseを返す。
 * @precondition millisecondsは0以上の有限値である。
 * @postcondition FilesystemまたはProcess状態を変更しない。
 * @effect Timerを一つ作成して解放する。
 * @failure N/A: Timer完了だけを扱う。
 * @invariant Busy Waitを行わない。
 * @boundary Node.js Timer境界。
 * @security N/A: 外部入力を処理しない。
 * @concurrency 他のEvent Loop処理を阻害しない。
 */
function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

/**
 * 対応済みChrome実行Fileを解決する。
 *
 * @responsibility 明示PathまたはWindowsの既知配置からChromeだけを選ぶ。
 * @trace ARCH-000003
 * @input explicitPathに任意の利用者指定Pathを受け取る。
 * @returns 存在するChrome実行FileのAbsolute Pathを返す。
 * @precondition 明示Pathを使う場合は現在Host上の通常Fileである。
 * @postcondition Browserを起動せずPathだけを返す。
 * @effect Filesystem上の存在を観測する。
 * @failure 対応済みChromeが見つからなければErrorを投げる。
 * @invariant Edge等を暗黙Fallbackとして使用しない。
 * @boundary Host FilesystemとBrowser Adapterの境界。
 * @security 解決したAbsolute Pathを公開結果へ含めない。
 * @concurrency N/A: 起動前の同期観測である。
 */
function resolveChromeExecutable(explicitPath?: string): string {
  const candidates = [
    explicitPath,
    process.env.PROGRAMFILES === undefined
      ? undefined
      : path.join(
          process.env.PROGRAMFILES,
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        ),
    process.env["PROGRAMFILES(X86)"] === undefined
      ? undefined
      : path.join(
          process.env["PROGRAMFILES(X86)"],
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        ),
    process.env.LOCALAPPDATA === undefined
      ? undefined
      : path.join(
          process.env.LOCALAPPDATA,
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        ),
  ];
  const resolved = candidates.find(
    (candidate): candidate is string =>
      candidate !== undefined && existsSync(candidate),
  );
  if (resolved === undefined) throw new Error("visual_zoom_chrome_unavailable");
  return resolved;
}

/**
 * Zoom倍率をChromiumのZoom Levelへ変換する。
 *
 * @responsibility Chromiumが使用する1.2基数のLevel値を決定論的に算出する。
 * @trace ARCH-000003
 * @input factorに正のZoom倍率を受け取る。
 * @returns Chromium Profileへ記録するZoom Levelを返す。
 * @precondition factorは0より大きい有限値である。
 * @postcondition 外部状態を変更せずLevelだけを返す。
 * @effect N/A: 数値計算だけを行う。
 * @failure 不正倍率ではErrorを投げる。
 * @invariant 100%はLevel 0になる。
 * @boundary CRDDの倍率表現とChromium Profile契約の境界。
 * @security N/A: 秘密値を扱わない。
 * @concurrency N/A: 共有状態を持たない純粋関数である。
 */
function toChromiumZoomLevel(factor: number): number {
  if (!Number.isFinite(factor) || factor <= 0)
    throw new Error("visual_zoom_factor_invalid");
  return Math.log(factor) / Math.log(1.2);
}

/**
 * Browser Processを終了し、完了を確認する。
 *
 * @responsibility 当該検証操作が起動したProcessだけを回収する。
 * @trace ARCH-000003
 * @input childに検証器が所有するBrowser Processを受け取る。
 * @returns 実際に成立した終了経路を返す。
 * @precondition childは現在の検証操作がspawnしたProcessである。
 * @postcondition Processが終了している。
 * @effect まずSignalなしで5秒待ち、必要時だけSIGTERM、さらに必要時だけSIGKILLを要求する。
 * @failure 最終期限後も終了を観測できなければunknownを返す。
 * @invariant 名前一致で別Browser Processを終了しない。
 * @boundary Node.js Child Process境界。
 * @security 所有していないProcessへ操作しない。
 * @concurrency exitとtimeoutの競合を一回の完了へ畳む。
 */
export async function stopOwnedBrowser(
  child: ChildProcess,
): Promise<BrowserCloseMode> {
  if (child.exitCode !== null || child.signalCode !== null) return "normal";
  if (await waitForChildExit(child, 5_000)) return "normal";
  child.kill("SIGTERM");
  if (await waitForChildExit(child, 5_000)) return "sigterm";
  child.kill("SIGKILL");
  if (await waitForChildExit(child, 5_000)) return "sigkill";
  return "unknown";
}

/**
 * Child Processを変更せず有限時間だけ終了観測する。
 *
 * @responsibility 正常終了待機と強制終了Signal発行を分離する。
 * @trace ARCH-000003
 * @input childに所有Process、timeoutMillisecondsに観測期限を受け取る。
 * @returns 期限内に終了を観測すればtrue、残存または観測不能ならfalseを返す。
 * @precondition childは現在の検証操作がspawnしたProcessである。
 * @postcondition この関数自身はProcessへSignalを送らない。
 * @effect exit EventまたはTimerを一度だけ待つ。
 * @failure Event未着でも終了状態を再確認し、残存をfalseへ返す。
 * @invariant ListenerとTimerを完了時に解放する。
 * @boundary Node.js Child Process終了通知の観測境界。
 * @security 所有していないProcessを参照しない。
 * @concurrency exitとtimeoutの先着一件だけを採用する。
 */
async function waitForChildExit(
  child: ChildProcess,
  timeoutMilliseconds: number,
): Promise<boolean> {
  if (child.exitCode !== null || child.signalCode !== null) return true;
  return await new Promise((resolve) => {
    let isSettled = false;
    const settle = (hasExited: boolean): void => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      child.off("exit", onExit);
      resolve(hasExited);
    };
    const onExit = (): void => settle(true);
    const timeout = setTimeout(
      () => settle(child.exitCode !== null || child.signalCode !== null),
      timeoutMilliseconds,
    );
    child.once("exit", onExit);
  });
}

/**
 * DevTools Active Port情報の生成を待つ。
 *
 * @responsibility BrowserのDebugger PortとWebSocket Pathを起動期限内に取得する。
 * @trace ARCH-000003
 * @input profileRootとBrowser Processを受け取る。
 * @returns PortとBrowser WebSocket Pathを返す。
 * @precondition Browserは同じprofileRootとremote-debugging-port=0で起動済みである。
 * @postcondition 有効なPortとPathだけを返す。
 * @effect Profile内のDevToolsActivePortを読取る。
 * @failure 30秒以内に生成されない、またはProcessが終了した場合はErrorを投げる。
 * @invariant 未完成Fileを成功として扱わない。
 * @boundary Chromium Profile Filesystem境界。
 * @security File内容を公開結果へ含めない。
 * @concurrency Browser書込みとPolling読取りの競合を再試行する。
 */
async function waitForDevTools(
  profileRoot: string,
  child: ChildProcess,
): Promise<Readonly<{ port: number; browserWebSocketPath: string }>> {
  const activePortPath = path.join(profileRoot, "DevToolsActivePort");
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error("visual_zoom_browser_exited");
    try {
      const [portLine, browserWebSocketPath] = (
        await readFile(activePortPath, "utf8")
      )
        .trim()
        .split(/\r?\n/u);
      const port = Number(portLine);
      if (
        Number.isInteger(port) &&
        port > 0 &&
        browserWebSocketPath?.startsWith("/devtools/browser/")
      )
        return Object.freeze({ port, browserWebSocketPath });
    } catch {
      // BrowserがFileを確定するまで再観測する。
    }
    await wait(100);
  }
  throw new Error("visual_zoom_browser_start_timeout");
}

/**
 * 最初のPage TargetのWebSocket URLを取得する。
 *
 * @responsibility localhost DevTools一覧からPage Targetを一つ選ぶ。
 * @trace ARCH-000003
 * @input portに専用BrowserのDebugger Port、expectedUrlに対象Preview URLを受け取る。
 * @returns Page TargetのWebSocket URLを返す。
 * @precondition Portは同じ操作が起動したlocalhost Browserに属する。
 * @postcondition type=pageのTargetだけを返す。
 * @effect localhost DevTools HTTP Endpointを読取る。
 * @failure Target不在、HTTP失敗または不正ShapeではErrorを投げる。
 * @invariant 外部Hostへ接続しない。
 * @boundary localhost DevTools HTTP境界。
 * @security Endpointを公開結果へ含めない。
 * @concurrency Target生成直後の遅延を短時間再試行する。
 */
async function resolvePageWebSocketUrl(
  port: number,
  expectedUrl: string,
): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = (await response.json()) as readonly Readonly<{
        type?: string;
        url?: string;
        webSocketDebuggerUrl?: string;
      }>[];
      const pageTarget = targets.find(
        (target) =>
          target.type === "page" &&
          target.url === expectedUrl &&
          typeof target.webSocketDebuggerUrl === "string",
      );
      if (pageTarget?.webSocketDebuggerUrl !== undefined)
        return pageTarget.webSocketDebuggerUrl;
    } catch {
      // Page Targetが公開されるまで再観測する。
    }
    await wait(100);
  }
  throw new Error("visual_zoom_page_target_unavailable");
}

/**
 * Page上で式を実行し、値を取得する。
 *
 * @responsibility 一回のRuntime.evaluate要求と応答相関を所有する。
 * @trace ARCH-000003
 * @input webSocketUrlとBrowser内で実行する固定式を受け取る。
 * @returns 式のJSON互換値を返す。
 * @precondition URLは同じ操作のlocalhost DevTools Targetに属する。
 * @postcondition WebSocketを閉じ、応答値だけを返す。
 * @effect localhost WebSocketを一つ開閉し、Page内の読取り式を実行する。
 * @failure 接続、Protocol、式評価またはtimeout失敗でErrorを投げる。
 * @invariant user gestureまたはFilesystem Effectを発行しない。
 * @boundary Chrome DevTools Protocol境界。
 * @security 式は実装内固定であり、利用者入力をScriptへ連結しない。
 * @concurrency Request ID 1の応答だけを受理する。
 */
async function evaluateInPage(
  webSocketUrl: string,
  expression: string,
): Promise<unknown> {
  const socket = new WebSocket(webSocketUrl);
  return await new Promise<unknown>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("visual_zoom_devtools_timeout"));
    }, 15_000);
    socket.addEventListener("open", () => {
      socket.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
        }),
      );
    });
    socket.addEventListener("message", (event) => {
      try {
        const response = JSON.parse(String(event.data)) as DevToolsResponse;
        if (response.id !== 1) return;
        clearTimeout(timeout);
        socket.close();
        if (
          response.error !== undefined ||
          response.result?.exceptionDetails !== undefined
        )
          reject(
            new Error(
              `visual_zoom_devtools_evaluation_failed:${
                response.result?.exceptionDetails?.exception?.description ??
                response.result?.exceptionDetails?.text ??
                (response.error === undefined
                  ? "protocol_error"
                  : JSON.stringify(response.error))
              }`,
            ),
          );
        else resolve(response.result?.result?.value);
      } catch {
        clearTimeout(timeout);
        socket.close();
        reject(new Error("visual_zoom_devtools_response_invalid"));
      }
    });
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("visual_zoom_devtools_connection_failed"));
    });
  });
}

/**
 * Browser全体へ正常終了を要求する。
 *
 * @responsibility DevToolsのBrowser.closeを用いて、RendererやCrash Handlerを含むBrowser Process Treeの終了を開始する。
 * @trace ARCH-000003
 * @input portとbrowserWebSocketPathに同じ操作が発行したDevTools Browser Endpointを受け取る。
 * @returns 終了要求の受理またはWebSocket切断を確認した時点で解決するPromiseを返す。
 * @precondition EndpointはwaitForDevToolsが同じ専用Profileから取得したlocalhost値である。
 * @postcondition Browserへ正常終了要求が一回送られ、WebSocketが閉じている。
 * @effect localhost WebSocketを一つ開閉し、Browser.closeを一回要求する。
 * @failure 接続前の失敗またはtimeoutではErrorを投げ、呼出し側の所有Process強制終了へ移る。
 * @invariant 外部Browserまたは通常Profileへ終了要求を送らない。
 * @boundary Chrome DevTools ProtocolのBrowser Process境界。
 * @security Endpointを結果やLogへ公開しない。
 * @concurrency 応答とBrowser終了によるWebSocket切断を同じ完了へ畳む。
 */
async function requestBrowserClose(
  port: number,
  browserWebSocketPath: string,
): Promise<void> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}${browserWebSocketPath}`);
  await new Promise<void>((resolve, reject) => {
    let isCommandSent = false;
    let isSettled = false;
    const finish = (error?: Error) => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      socket.close();
      if (error === undefined) resolve();
      else reject(error);
    };
    const timeout = setTimeout(
      () => finish(new Error("visual_zoom_browser_close_timeout")),
      5_000,
    );
    socket.addEventListener("open", () => {
      isCommandSent = true;
      socket.send(JSON.stringify({ id: 1, method: "Browser.close" }));
    });
    socket.addEventListener("message", (event) => {
      try {
        const response = JSON.parse(String(event.data)) as DevToolsResponse;
        if (response.id !== 1) return;
        if (response.error !== undefined)
          finish(new Error("visual_zoom_browser_close_rejected"));
        else finish();
      } catch {
        finish(new Error("visual_zoom_browser_close_response_invalid"));
      }
    });
    socket.addEventListener("close", () => {
      if (isCommandSent) finish();
      else finish(new Error("visual_zoom_browser_close_connection_lost"));
    });
    socket.addEventListener("error", () =>
      finish(new Error("visual_zoom_browser_close_connection_failed")),
    );
  });
}

/**
 * Browser内で実行する表示計測式を構築する。
 *
 * @responsibility 固定DOM IDの可視性とVisual品質値だけを返す式を生成する。
 * @trace ARCH-000003
 * @input targetIdsにProduct側が要求する安定DOM IDを受け取る。
 * @returns DOM本文を含まない自己実行JavaScript式を返す。
 * @precondition targetIdsは英数字とhyphenだけで構成される。
 * @postcondition IDはJSON文字列として埋め込み、Script断片として連結しない。
 * @effect N/A: 文字列を生成するだけである。
 * @failure N/A: 検証済みIDだけを決定論的に直列化する。
 * @invariant DOM本文、入力値またはCredentialを収集しない。
 * @boundary Node.js検証器とBrowser内JavaScriptの境界。
 * @security 一般CSS Selectorまたは任意Scriptを入力として受け付けない。
 * @concurrency N/A: 同期純粋処理である。
 */
function createMeasurementExpression(targetIds: readonly string[]): string {
  return `(async () => {
  if (document.readyState !== "complete") {
    await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  }
  await document.fonts.ready;
  const requiredTargetIds = ${JSON.stringify(targetIds)};
  const targetDeadline = Date.now() + 10_000;
  while (requiredTargetIds.some((id) => document.getElementById(id) === null) && Date.now() < targetDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const initialImages = [...document.querySelectorAll("img")];
  await Promise.all(initialImages.map((image) => {
    if (image.complete) return Promise.resolve();
    return new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        image.removeEventListener("load", settle);
        image.removeEventListener("error", settle);
        resolve();
      };
      const timeout = setTimeout(settle, 5_000);
      image.addEventListener("load", settle, { once: true });
      image.addEventListener("error", settle, { once: true });
      if (image.complete) settle();
    });
  }));
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const isVisible = (element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const visible = [...document.querySelectorAll("*")].filter((element) => {
    return isVisible(element);
  });
  const fontSizes = visible
    .filter((element) => [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && (node.textContent ?? "").trim().length > 0))
    .map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    .filter(Number.isFinite);
  const interactive = [...document.querySelectorAll("button, input, select, textarea, a[href], [role='button'], [tabindex]")]
    .filter((element) => isVisible(element) && !element.matches(":disabled"));
  const interactionRect = (element) => {
    if (element.matches("input[type='checkbox'], input[type='radio']")) {
      const label = element.closest("label");
      if (label !== null && isVisible(label)) return label.getBoundingClientRect();
    }
    return element.getBoundingClientRect();
  };
  const widths = interactive.map((element) => interactionRect(element).width);
  const heights = interactive.map((element) => interactionRect(element).height);
  const interactionKind = (element) => {
    const type = element instanceof HTMLInputElement ? element.type : "none";
    return element.tagName.toLowerCase() + ":" + type;
  };
  const minimumWidthIndex = widths.length === 0 ? -1 : widths.indexOf(Math.min(...widths));
  const minimumHeightIndex = heights.length === 0 ? -1 : heights.indexOf(Math.min(...heights));
  const images = [...document.querySelectorAll("img")];
  const loadedImages = images.filter((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
  const missingTargetIds = requiredTargetIds.filter((id) => document.getElementById(id) === null);
  const hiddenTargetIds = requiredTargetIds.filter((id) => {
    const element = document.getElementById(id);
    return element !== null && !isVisible(element);
  });
  return {
    devicePixelRatio: window.devicePixelRatio,
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    outerWidth: window.outerWidth,
    outerHeight: window.outerHeight,
    documentScrollWidth: document.documentElement.scrollWidth,
    minimumVisibleFontSize: fontSizes.length === 0 ? null : Math.min(...fontSizes),
    minimumInteractiveWidth: widths.length === 0 ? null : Math.min(...widths),
    minimumInteractiveHeight: heights.length === 0 ? null : Math.min(...heights),
    minimumInteractiveWidthKind: minimumWidthIndex < 0 ? null : interactionKind(interactive[minimumWidthIndex]),
    minimumInteractiveHeightKind: minimumHeightIndex < 0 ? null : interactionKind(interactive[minimumHeightIndex]),
    positiveTabIndexCount: visible.filter((element) => element.tabIndex > 0).length,
    focusableElementCount: interactive.filter((element) => element.tabIndex >= 0).length,
    unfocusableInteractiveCount: interactive.filter((element) => element.tabIndex < 0).length,
    imageCount: images.length,
    loadedImageCount: loadedImages.length,
    failedImageCount: images.length - loadedImages.length,
    missingTargetIds,
    hiddenTargetIds,
  };
})()`;
}

/**
 * 一つのDocumentを指定Zoom倍率で実測する。
 *
 * @responsibility Browser Profile作成、Process起動、DevTools観測、合否判定および清掃を一単位で行う。
 * @trace ARCH-000003
 * @input Browser実行Path、Profile Root、URL、Document Path、倍率およびWindow寸法を受け取る。
 * @returns 一条件のBrowserZoomMeasurementを返す。
 * @precondition URLは同じ操作のlocalhost Preview、Profile Rootは名前付きRepository Runtime Data tmp領域配下である。
 * @postcondition Browser ProcessとProfile Rootが残らない。
 * @effect 専用Profileを作成し、Headless Chromeを一つ起動・終了する。
 * @failure 起動、観測または清掃不能時はErrorを投げ、成功へ畳まない。
 * @invariant 実Zoomを狭幅Viewportだけの結果で代替しない。
 * @boundary Chromium Process、Profile Filesystem、localhost HTTPおよびDevTools境界。
 * @security RepositoryをBrowserへFile mountせず、localhost Preview URLだけを開く。
 * @concurrency Profileは一条件専用で共有しない。
 */
async function measureDocumentAtZoom(
  browserExecutablePath: string,
  profileRoot: string,
  url: string,
  documentPath: string,
  profileName: string,
  targetIds: readonly string[],
  zoomFactor: number,
  windowSize: BrowserWindowSize,
): Promise<BrowserZoomMeasurement> {
  await mkdir(path.join(profileRoot, "Default"), { recursive: true });
  await writeFile(
    path.join(profileRoot, "Default", "Preferences"),
    JSON.stringify({
      partition: {
        default_zoom_level: { x: toChromiumZoomLevel(zoomFactor) },
      },
    }),
    "utf8",
  );
  const child = spawn(
    browserExecutablePath,
    [
      `--user-data-dir=${profileRoot}`,
      "--remote-debugging-port=0",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-background-networking",
      "--disable-background-mode",
      "--disable-component-update",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-breakpad",
      "--disable-crash-reporter",
      "--disable-sync",
      "--metrics-recording-only",
      "--headless=new",
      `--window-size=${windowSize.width},${windowSize.height}`,
      url,
    ],
    { stdio: "ignore", windowsHide: true },
  );
  let devTools:
    | Readonly<{ port: number; browserWebSocketPath: string }>
    | undefined;
  let raw: RawBrowserMeasurement | undefined;
  let failures: string[] = [];
  let operationError: unknown;
  const cleanupErrors: unknown[] = [];
  let isNormalBrowserCloseAccepted = false;
  let browserCloseMode: BrowserCloseMode = "unknown";
  let browserDescendantTerminationRequired = false;
  let browserShutdownElapsedMilliseconds = 0;
  let browserProcessTreeExitConfirmed = false;
  let browserProcessTreeExitObservationElapsedMilliseconds = 0;
  let isBrowserDevToolsUnavailableAfterClose = false;
  let profileCleanupConfirmed = false;
  try {
    devTools = await waitForDevTools(profileRoot, child);
    let rawValue: unknown;
    const evaluationDeadline = Date.now() + 10_000;
    while (rawValue === undefined && Date.now() < evaluationDeadline) {
      const pageWebSocketUrl = await resolvePageWebSocketUrl(
        devTools.port,
        url,
      );
      await wait(250);
      try {
        rawValue = await evaluateInPage(
          pageWebSocketUrl,
          createMeasurementExpression(targetIds),
        );
      } catch (error) {
        if (
          !(error instanceof Error) ||
          !error.message.includes("Execution context was destroyed")
        )
          throw error;
        await wait(100);
      }
    }
    if (rawValue === undefined)
      throw new Error("visual_zoom_page_context_unavailable");
    raw = rawValue as RawBrowserMeasurement;
    if (
      typeof raw?.devicePixelRatio !== "number" ||
      typeof raw.innerWidth !== "number" ||
      typeof raw.documentScrollWidth !== "number"
    )
      throw new Error("visual_zoom_measurement_invalid");
    failures = [];
    const isZoomObserved = Math.abs(raw.devicePixelRatio - zoomFactor) <= 0.05;
    if (!isZoomObserved) failures.push("browser_zoom_not_observed");
    if (raw.documentScrollWidth > raw.innerWidth + 1)
      failures.push("horizontal_overflow");
    if (raw.minimumVisibleFontSize !== null && raw.minimumVisibleFontSize < 12)
      failures.push("font_size_below_12px");
    if (
      raw.minimumInteractiveWidth !== null &&
      raw.minimumInteractiveWidth < 32
    )
      failures.push("interactive_width_below_32px");
    if (
      raw.minimumInteractiveHeight !== null &&
      raw.minimumInteractiveHeight < 32
    )
      failures.push("interactive_height_below_32px");
    if (raw.positiveTabIndexCount > 0) failures.push("positive_tabindex");
    if (raw.unfocusableInteractiveCount > 0)
      failures.push("interactive_not_keyboard_focusable");
    if (raw.failedImageCount > 0) failures.push("image_load_failed");
    if (raw.missingTargetIds.length > 0)
      failures.push("required_screen_target_missing");
    if (raw.hiddenTargetIds.length > 0)
      failures.push("required_screen_target_hidden");
  } catch (error) {
    operationError = error;
  } finally {
    const cleanupObservation: {
      process: OwnedBrowserProcessCleanupResult | undefined;
    } = { process: undefined };
    cleanupErrors.push(
      ...(await runVisualCleanupStages({
        closeProcessTree: async () => {
          cleanupObservation.process = await closeOwnedBrowserProcessTree(
            child,
            async () => {
              if (devTools === undefined)
                throw new Error("visual_zoom_devtools_unavailable_for_close");
              await requestBrowserClose(
                devTools.port,
                devTools.browserWebSocketPath,
              );
            },
          );
        },
        confirmDevToolsClosed: async () => {
          isBrowserDevToolsUnavailableAfterClose =
            devTools !== undefined &&
            (await confirmDevToolsUnavailable(devTools.port)) === "absent";
        },
        removeProfile: async () => {
          await rm(profileRoot, {
            recursive: true,
            force: true,
            maxRetries: 10,
            retryDelay: 200,
          });
          profileCleanupConfirmed = !existsSync(profileRoot);
        },
      })),
    );
    const processCleanup = cleanupObservation.process;
    if (processCleanup !== undefined) {
      isNormalBrowserCloseAccepted = processCleanup.normalCloseAccepted;
      browserCloseMode = processCleanup.closeMode;
      browserDescendantTerminationRequired =
        processCleanup.descendantTerminationRequired;
      browserShutdownElapsedMilliseconds =
        processCleanup.shutdownElapsedMilliseconds;
      browserProcessTreeExitConfirmed = processCleanup.processTreeExitConfirmed;
      browserProcessTreeExitObservationElapsedMilliseconds =
        processCleanup.processTreeExitObservationElapsedMilliseconds;
      cleanupErrors.push(...processCleanup.cleanupErrors);
    }
  }
  const executionErrors = [
    ...(operationError === undefined ? [] : [operationError]),
    ...cleanupErrors,
  ];
  if (executionErrors.length > 0)
    throw new AggregateError(
      executionErrors,
      "visual_zoom_measurement_or_cleanup_failed",
    );
  if (raw === undefined) throw new Error("visual_zoom_measurement_unavailable");
  if (!browserProcessTreeExitConfirmed)
    failures.push("browser_process_tree_remaining_or_unobserved");
  if (!isBrowserDevToolsUnavailableAfterClose)
    failures.push("browser_devtools_listener_remaining_or_unobserved");
  if (!profileCleanupConfirmed)
    failures.push("browser_profile_remaining_or_unobserved");
  if (browserCloseMode === "unknown")
    failures.push("browser_close_mode_unknown");
  const isZoomObserved = Math.abs(raw.devicePixelRatio - zoomFactor) <= 0.05;
  return Object.freeze({
    documentPath,
    profileName,
    targetIds: Object.freeze([...targetIds]),
    missingTargetIds: Object.freeze([...raw.missingTargetIds]),
    hiddenTargetIds: Object.freeze([...raw.hiddenTargetIds]),
    requestedZoomFactor: zoomFactor,
    observedDevicePixelRatio: raw.devicePixelRatio,
    innerWidth: raw.innerWidth,
    innerHeight: raw.innerHeight,
    outerWidth: raw.outerWidth,
    outerHeight: raw.outerHeight,
    documentScrollWidth: raw.documentScrollWidth,
    minimumVisibleFontSize: raw.minimumVisibleFontSize,
    minimumInteractiveWidth: raw.minimumInteractiveWidth,
    minimumInteractiveHeight: raw.minimumInteractiveHeight,
    minimumInteractiveWidthKind: raw.minimumInteractiveWidthKind,
    minimumInteractiveHeightKind: raw.minimumInteractiveHeightKind,
    positiveTabIndexCount: raw.positiveTabIndexCount,
    focusableElementCount: raw.focusableElementCount,
    unfocusableInteractiveCount: raw.unfocusableInteractiveCount,
    focusOrderValid:
      raw.positiveTabIndexCount === 0 && raw.unfocusableInteractiveCount === 0,
    imageCount: raw.imageCount,
    loadedImageCount: raw.loadedImageCount,
    failedImageCount: raw.failedImageCount,
    horizontalOverflow: raw.documentScrollWidth > raw.innerWidth + 1,
    zoomObserved: isZoomObserved,
    normalBrowserCloseAccepted: isNormalBrowserCloseAccepted,
    browserCloseMode,
    forcedBrowserCloseRequired:
      browserCloseMode === "sigterm" ||
      browserCloseMode === "sigkill" ||
      browserDescendantTerminationRequired,
    browserDescendantTerminationRequired,
    browserShutdownElapsedMilliseconds,
    browserProcessTreeExitConfirmed,
    browserProcessTreeExitObservationElapsedMilliseconds,
    browserDevToolsUnavailableAfterClose:
      isBrowserDevToolsUnavailableAfterClose,
    profileCleanupConfirmed,
    passed: failures.length === 0,
    failures: Object.freeze(failures),
  });
}

/**
 * Visual成果物を実Browser Zoomで全数検証する。
 *
 * @responsibility Preview開始、対象×倍率の全数実測、一括判定および全資源清掃を所有する。
 * @trace ARCH-000003
 * @input requestにRepository相対Root、Document一覧、倍率一覧、Window寸法および任意Browser Pathを受け取る。
 * @returns 全測定と合否を含むBrowserZoomVerificationResultを返す。
 * @precondition 作業Directoryは検証済みRepository内であり、Documentは許可Root配下のHTMLである。
 * @postcondition 成否にかかわらずPreview Listener、Browser Processおよび一時Profileが残らない。
 * @effect localhost Listener、Repository-local一時ProfileおよびHeadless Chromeを順次開始・終了する。
 * @failure 入力不正、Browser不在、起動・観測・清掃不能はErrorとし、部分結果を全体PASSへ畳まない。
 * @invariant 全Document×全Zoom倍率を一件ずつ実測する。
 * @boundary Repository、localhost HTTP、Chromium Process、DevToolsおよび一時Filesystemの統合境界。
 * @security 外部Network、通常Browser Profile、Repository書込みおよび秘密値を使用しない。
 * @concurrency Browser Profile競合を避けるため測定を逐次実行する。
 */
export async function verifyBrowserZoom(
  request: BrowserZoomVerificationRequest,
): Promise<BrowserZoomVerificationResult> {
  if (
    request.documentPaths.length === 0 ||
    request.zoomFactors.length === 0 ||
    !Number.isInteger(request.windowSize.width) ||
    !Number.isInteger(request.windowSize.height) ||
    request.windowSize.width <= 0 ||
    request.windowSize.height <= 0
  )
    throw new Error("visual_zoom_request_invalid");
  for (const documentPath of request.documentPaths) {
    if (
      documentPath.length === 0 ||
      path.isAbsolute(documentPath) ||
      path.extname(documentPath).toLocaleLowerCase("en-US") !== ".html" ||
      documentPath.split(/[\\/]/u).some((segment) => segment === "..")
    )
      throw new Error("visual_zoom_document_invalid");
  }
  for (const zoomFactor of request.zoomFactors) toChromiumZoomLevel(zoomFactor);
  const temporaryArea = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      request.workingDirectory,
      "tmp",
    ),
    "visual_zoom_runtime_data_root_invalid",
  );
  const browserExecutablePath = resolveChromeExecutable(
    request.browserExecutablePath,
  );
  const operationRoot = path.join(
    temporaryArea.directory,
    `visual-browser-zoom-${randomUUID()}`,
  );
  await mkdir(operationRoot, { recursive: true });
  let preview: VisualPreviewHandle | undefined;
  const measurements: BrowserZoomMeasurement[] = [];
  let isPreviewListenerClosed = false;
  let temporaryRootRemoved = false;
  let cleanupConfirmed = false;
  try {
    preview = await startVisualPreview({
      workingDirectory: request.workingDirectory,
      rootRelativePath: request.rootRelativePath,
    });
    for (const documentPath of request.documentPaths) {
      for (const zoomFactor of request.zoomFactors) {
        measurements.push(
          await measureDocumentAtZoom(
            browserExecutablePath,
            path.join(operationRoot, randomUUID()),
            `${preview.baseUrl}/${documentPath
              .split("/")
              .map(encodeURIComponent)
              .join("/")}`,
            documentPath,
            "fixed-window",
            Object.freeze([]),
            zoomFactor,
            request.windowSize,
          ),
        );
      }
    }
  } finally {
    try {
      if (preview !== undefined) {
        await preview.close();
        isPreviewListenerClosed =
          (await confirmPreviewListenerClosed(preview.healthUrl)) === "absent";
      }
    } finally {
      await rm(operationRoot, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 200,
      });
      temporaryRootRemoved = !existsSync(operationRoot);
      cleanupConfirmed = isPreviewListenerClosed && temporaryRootRemoved;
    }
  }
  const isPassed =
    cleanupConfirmed && measurements.every((measurement) => measurement.passed);
  return Object.freeze({
    contract: CONTRACT,
    status: isPassed ? "passed" : "failed",
    browser: "chrome",
    minimumFontSize: 12,
    minimumInteractiveSize: 32,
    measurements: Object.freeze(measurements),
    previewListenerClosed: isPreviewListenerClosed,
    temporaryRootRemoved,
    cleanupConfirmed,
  });
}

/**
 * 起動済みlocalhost Web Applicationを全Target・Profile・Zoomで検証する。
 *
 * @responsibility Product Serverを所有せず、実Browser表示、Screen Target、Visual閾値およびBrowser資源清掃を全数確認する。
 * @trace ARCH-000003
 * @input requestにRepository Root、loopback Base URL、Target、Profile、Zoomおよび任意Browser Pathを受け取る。
 * @returns 全測定とBrowser側清掃結果を返す。
 * @precondition 呼出し側がProduction同等Serverを起動し、完了後にListenerを閉じて観測する。
 * @postcondition Browser Process Treeと専用Profileを残さず、Application Listenerには触れない。
 * @effect Repository-local一時ProfileとHeadless Chromeを順次開始・終了する。
 * @failure 入力不正、外部Origin、Browser不在、観測不能または清掃不能を成功へ畳まない。
 * @invariant 全Target×Profile×Zoomを一件ずつ実測する。
 * @boundary Product localhost Server、Chromium Process、DevToolsおよび一時Filesystemの統合境界。
 * @security loopback HTTPだけを許可し、通常Profile、外部NetworkまたはCredential付きURLを使用しない。
 * @concurrency Browser Profile競合を避けるため測定を逐次実行する。
 */
export async function verifyLocalWebApplicationVisual(
  request: LocalWebVisualVerificationRequest,
): Promise<LocalWebVisualVerificationResult> {
  let baseUrl: URL;
  try {
    baseUrl = new URL(request.baseUrl);
  } catch {
    throw new Error("local_web_visual_base_url_invalid");
  }
  if (
    baseUrl.protocol !== "http:" ||
    (baseUrl.hostname !== "127.0.0.1" && baseUrl.hostname !== "[::1]") ||
    baseUrl.username.length > 0 ||
    baseUrl.password.length > 0 ||
    baseUrl.pathname !== "/" ||
    baseUrl.search.length > 0 ||
    baseUrl.hash.length > 0 ||
    request.targets.length === 0 ||
    request.profiles.length === 0 ||
    request.zoomFactors.length === 0
  )
    throw new Error("local_web_visual_request_invalid");

  const pageIds = new Set<string>();
  for (const target of request.targets) {
    if (
      !/^[a-z0-9][a-z0-9-]*$/u.test(target.pageId) ||
      pageIds.has(target.pageId) ||
      !target.pagePath.startsWith("/") ||
      target.pagePath.startsWith("//") ||
      target.targetIds.length === 0 ||
      new Set(target.targetIds).size !== target.targetIds.length ||
      target.targetIds.some((id) => !/^[a-z0-9][a-z0-9-]*$/u.test(id))
    )
      throw new Error("local_web_visual_target_invalid");
    pageIds.add(target.pageId);
    const targetUrl = new URL(target.pagePath, baseUrl);
    if (targetUrl.origin !== baseUrl.origin)
      throw new Error("local_web_visual_target_origin_invalid");
  }

  const profileNames = new Set<string>();
  for (const profile of request.profiles) {
    if (
      !/^[a-z0-9][a-z0-9-]*$/u.test(profile.name) ||
      profileNames.has(profile.name) ||
      !Number.isInteger(profile.windowSize.width) ||
      !Number.isInteger(profile.windowSize.height) ||
      profile.windowSize.width <= 0 ||
      profile.windowSize.height <= 0
    )
      throw new Error("local_web_visual_profile_invalid");
    profileNames.add(profile.name);
  }
  for (const zoomFactor of request.zoomFactors) toChromiumZoomLevel(zoomFactor);

  const temporaryArea = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      request.workingDirectory,
      "tmp",
    ),
    "local_web_visual_runtime_data_root_invalid",
  );
  const browserExecutablePath = resolveChromeExecutable(
    request.browserExecutablePath,
  );
  const operationRoot = path.join(
    temporaryArea.directory,
    `local-web-visual-${randomUUID()}`,
  );
  await mkdir(operationRoot, { recursive: true });
  const measurements: BrowserZoomMeasurement[] = [];
  let temporaryRootRemoved = false;
  try {
    for (const target of request.targets) {
      const targetUrl = new URL(target.pagePath, baseUrl);
      for (const profile of request.profiles) {
        for (const zoomFactor of request.zoomFactors) {
          measurements.push(
            await measureDocumentAtZoom(
              browserExecutablePath,
              path.join(operationRoot, randomUUID()),
              targetUrl.href,
              target.pageId,
              profile.name,
              target.targetIds,
              zoomFactor,
              profile.windowSize,
            ),
          );
        }
      }
    }
  } finally {
    await rm(operationRoot, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
    temporaryRootRemoved = !existsSync(operationRoot);
  }
  const browserCleanupConfirmed = measurements.every(
    (measurement) =>
      measurement.browserProcessTreeExitConfirmed &&
      measurement.browserDevToolsUnavailableAfterClose &&
      measurement.profileCleanupConfirmed,
  );
  const isPassed =
    temporaryRootRemoved &&
    browserCleanupConfirmed &&
    measurements.every((measurement) => measurement.passed);
  return Object.freeze({
    contract: "crdd/local-web-visual-verification/v1" as const,
    status: isPassed ? "passed" : "failed",
    browser: "chrome" as const,
    minimumFontSize: 12 as const,
    minimumInteractiveSize: 32 as const,
    measurements: Object.freeze(measurements),
    applicationListenerOwnedByCaller: true as const,
    temporaryRootRemoved,
    browserCleanupConfirmed,
  });
}

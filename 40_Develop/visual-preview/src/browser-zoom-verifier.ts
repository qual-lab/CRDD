/**
 * 実Browser ZoomでVisual成果物を検証する。
 *
 * @responsibility 専用Browser Profile、Chrome DevTools接続、表示計測および一時資源清掃を所有する。
 * @trace ARCH-000003
 */
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import { promisify } from "node:util";

import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../runtime-data/src/index.ts";
import {
  type VisualPreviewHandle,
  startVisualPreview,
} from "./preview-server.ts";

const CONTRACT = "crdd/visual-browser-zoom-verification/v1" as const;
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
  positiveTabIndexCount: number;
  imageCount: number;
  loadedImageCount: number;
  failedImageCount: number;
  horizontalOverflow: boolean;
  zoomObserved: boolean;
  normalBrowserCloseAccepted: boolean;
  browserCloseMode: BrowserCloseMode;
  forcedBrowserCloseRequired: boolean;
  browserProcessTreeExitConfirmed: boolean;
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
  positiveTabIndexCount: number;
  imageCount: number;
  loadedImageCount: number;
  failedImageCount: number;
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
type ProcessPair = Readonly<{ pid: number; parentPid: number }>;

/**
 * 実行中Processの親子関係を取得する。
 *
 * @responsibility 所有Browser Process Treeの終了後観測に必要なPIDと親PIDだけを取得する。
 * @trace ARCH-000003
 * @input N/A: 現在のOS Process一覧を使用する。
 * @returns PIDと親PIDの組を返す。
 * @precondition PowerShellまたはpsが現在の実行環境で利用可能である。
 * @postcondition Command出力のPath、引数または秘密値を保持しない。
 * @effect OS Process一覧を読取る外部Commandを一回実行する。
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
        "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId | ConvertTo-Json -Compress",
      ],
      { windowsHide: true, timeout: 10_000 },
    );
    const parsed = JSON.parse(stdout) as
      | Readonly<{ ProcessId?: unknown; ParentProcessId?: unknown }>
      | readonly Readonly<{
          ProcessId?: unknown;
          ParentProcessId?: unknown;
        }>[];
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    return Object.freeze(
      entries.flatMap((entry) => {
        const pid = Number(entry.ProcessId);
        const parentPid = Number(entry.ParentProcessId);
        return Number.isInteger(pid) && Number.isInteger(parentPid)
          ? [Object.freeze({ pid, parentPid })]
          : [];
      }),
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
async function collectOwnedProcessIds(
  rootPid: number,
): Promise<readonly number[]> {
  const pairs = await readProcessPairs();
  const owned = new Set<number>([rootPid]);
  let hasChanged = true;
  while (hasChanged) {
    hasChanged = false;
    for (const pair of pairs) {
      if (owned.has(pair.parentPid) && !owned.has(pair.pid)) {
        owned.add(pair.pid);
        hasChanged = true;
      }
    }
  }
  return Object.freeze([...owned]);
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
 * @returns 全PID不存在ならtrue、期限内に残ればfalseを返す。
 * @precondition processIdsは同じBrowser操作から導出されている。
 * @postcondition Processへ変更Signalを発行しない。
 * @effect OS Process存在確認を最大10秒間再実行する。
 * @failure 観測不能はfalseとして成功へ畳まない。
 * @invariant 名前一致の別Browserを対象にしない。
 * @boundary Browser Process Treeの終了後観測境界。
 * @security PIDを外部へ公開しない。
 * @concurrency 全PIDが同じ観測回で不存在になるまで成功にしない。
 */
async function waitForProcessTreeExit(
  processIds: readonly number[],
): Promise<boolean> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (processIds.every((pid) => !processExists(pid))) return true;
    await wait(100);
  }
  return processIds.every((pid) => !processExists(pid));
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

const MEASUREMENT_EXPRESSION = `(async () => {
  if (document.readyState !== "complete") {
    await new Promise((resolve) => window.addEventListener("load", resolve, { once: true }));
  }
  await document.fonts.ready;
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const visible = [...document.querySelectorAll("*")].filter((element) => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  });
  const fontSizes = visible
    .filter((element) => (element.textContent ?? "").trim().length > 0)
    .map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
    .filter(Number.isFinite);
  const interactive = [...document.querySelectorAll("button, input, select, textarea, a[href], [role='button'], [tabindex]")]
    .filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
  const widths = interactive.map((element) => element.getBoundingClientRect().width);
  const heights = interactive.map((element) => element.getBoundingClientRect().height);
  const images = [...document.querySelectorAll("img")];
  const loadedImages = images.filter((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
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
    positiveTabIndexCount: visible.filter((element) => element.tabIndex > 0).length,
    imageCount: images.length,
    loadedImageCount: loadedImages.length,
    failedImageCount: images.length - loadedImages.length,
  };
})()`;

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
      "--disable-component-update",
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
  let ownedProcessIds: readonly number[] = [];
  let raw: RawBrowserMeasurement | undefined;
  let failures: string[] = [];
  let isNormalBrowserCloseAccepted = false;
  let browserCloseMode: BrowserCloseMode = "unknown";
  let browserProcessTreeExitConfirmed = false;
  let isBrowserDevToolsUnavailableAfterClose = false;
  let profileCleanupConfirmed = false;
  try {
    devTools = await waitForDevTools(profileRoot, child);
    if (child.pid === undefined)
      throw new Error("visual_zoom_browser_pid_unavailable");
    ownedProcessIds = await collectOwnedProcessIds(child.pid);
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
          MEASUREMENT_EXPRESSION,
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
    if (raw.failedImageCount > 0) failures.push("image_load_failed");
  } finally {
    if (devTools !== undefined) {
      try {
        await requestBrowserClose(devTools.port, devTools.browserWebSocketPath);
        isNormalBrowserCloseAccepted = true;
      } catch {}
    }
    browserCloseMode = await stopOwnedBrowser(child);
    browserProcessTreeExitConfirmed =
      ownedProcessIds.length > 0 &&
      (await waitForProcessTreeExit(ownedProcessIds));
    isBrowserDevToolsUnavailableAfterClose =
      devTools !== undefined &&
      (await confirmDevToolsUnavailable(devTools.port)) === "absent";
    await rm(profileRoot, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
    profileCleanupConfirmed = !existsSync(profileRoot);
  }
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
    positiveTabIndexCount: raw.positiveTabIndexCount,
    imageCount: raw.imageCount,
    loadedImageCount: raw.loadedImageCount,
    failedImageCount: raw.failedImageCount,
    horizontalOverflow: raw.documentScrollWidth > raw.innerWidth + 1,
    zoomObserved: isZoomObserved,
    normalBrowserCloseAccepted: isNormalBrowserCloseAccepted,
    browserCloseMode,
    forcedBrowserCloseRequired:
      browserCloseMode === "sigterm" || browserCloseMode === "sigkill",
    browserProcessTreeExitConfirmed,
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

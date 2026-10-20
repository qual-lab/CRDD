/**
 * 一条件のBrowser表示測定と全段資源回収を所有する。
 * @responsibility 一条件のBrowser表示測定と全段資源回収を所有する。
 * @trace ARCH-000003
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import type {
  BrowserWindowSize,
  BrowserZoomMeasurement,
  BrowserCloseMode,
} from "./types.ts";
import {
  waitForDevTools,
  resolvePageWebSocketUrl,
  evaluateInPage,
  requestBrowserClose,
  confirmDevToolsUnavailable,
} from "./devtools.ts";
import {
  type OwnedBrowserProcessCleanupResult,
  closeOwnedBrowserProcessTree,
} from "./process.ts";

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
export function toChromiumZoomLevel(factor: number): number {
  if (!Number.isFinite(factor) || factor <= 0)
    throw new Error("visual_zoom_factor_invalid");
  return Math.log(factor) / Math.log(1.2);
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
export async function measureDocumentAtZoom(
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

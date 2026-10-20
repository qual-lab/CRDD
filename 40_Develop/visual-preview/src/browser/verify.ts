/**
 * 静的Artifactと起動済みApplicationの検証条件を順次実行する。
 * @responsibility 静的Artifactと起動済みApplicationの検証条件を順次実行する。
 * @trace ARCH-000003
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import {
  startVisualPreview,
  type VisualPreviewHandle,
} from "../preview/server.ts";
import type {
  BrowserZoomVerificationRequest,
  BrowserZoomVerificationResult,
  BrowserZoomMeasurement,
  LocalWebVisualVerificationRequest,
  LocalWebVisualVerificationResult,
} from "./types.ts";
import { toChromiumZoomLevel, measureDocumentAtZoom } from "./measure.ts";
import { resolveChromeExecutable } from "./process.ts";
import { confirmPreviewListenerClosed } from "./devtools.ts";

const CONTRACT = "crdd/visual-browser-zoom-verification/v1" as const;

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

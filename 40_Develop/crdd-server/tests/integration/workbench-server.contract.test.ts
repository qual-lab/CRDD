/**
 * workbench:integration:production-shellの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Workbench Production Shellのloopback配信、公式ロゴ、固定RouteおよびListener清掃を直接境界で検証する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @trace ERB-IT-021
 * @trace ERP-IT-001
 * @trace PPR-IT-002
 * @trace RCM-IT-005
 * @trace RFD-IT-013
 * @trace RFD-IT-014
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @level IT
 * @scope workbench、localhost、official-logo、route-allowlist、cleanup
 * @boundary ERB-IT-021=Direct Boundary: Repository→Workbench Server→Browser相当Consumer
 * @boundary CPR-IT-010=Workbench操作→Domain保存→改訂・状態・確認結果。
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { ServerResponse } from "node:http";
import { syncBuiltinESMExports } from "node:module";
import { connect } from "node:net";
import path from "node:path";
import test from "node:test";
import { createCredentialMaterial } from "../../../access-management/src/credential/token.ts";
import type { AccessManagementState } from "../../../access-management/src/storage/types.ts";
import { getModelCatalog } from "@qual-lab/crdd-ai-adapter";
import {
  executionSelection,
  selectionConfig,
} from "../../../coordinator/tests/fixtures/ai-selection.ts";
import { storeFixtureExecution } from "../../../coordinator/tests/fixtures/execution-intelligence.ts";
import { createFilesystemStoreRoot } from "../../../access-management/src/initialization/root.ts";
import {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "@qual-lab/crdd-configuration-model";
import {
  getRepository,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "@qual-lab/crdd-version-control";
import { requestRaw, requestTransport } from "../support/workbench-http.ts";
import {
  createRepositoryWorkbenchActivityReader,
  readProjectViewData,
  startWorkbench,
  type WorkbenchActivityReader,
  type AiRequestCommand,
  type AiRequests,
} from "../../src/app.ts";
import type { ViewResponse } from "../../src/transport/api-types.ts";
import { assertViewResponse } from "../support/workbench-wire.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * UI Routeと同じQueryから、Browserへ公開されるJSON Read Modelを直接取得する。
 *
 * @responsibility CSRが受け取るJSON Read ModelをHTTP境界から取得する。
 * @trace ERB-IT-021
 * @trace CPR-IT-012
 * @trace CPR-IT-010
 * @precondition baseUrlが起動済みWorkbenchを指す。
 * @stimulus UI RouteをJSON API Routeへ変換してGETする。
 * @observation StatusとJSON本文を取得する。
 * @oracle HTTP 200の表示応答を返す。
 * @cleanup Request SocketはResponse完了時に閉じる。
 * @boundary ERB-IT-021=Direct Boundary: Browser Route Query→JSON Read Model API
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
async function requestClientModel(
  baseUrl: string,
  requestPath = "/",
): Promise<ViewResponse> {
  const requested = new URL(requestPath, baseUrl);
  const parameters = new URLSearchParams(requested.search);
  parameters.set(
    "route",
    requested.pathname === "/index.html" ? "/" : requested.pathname,
  );
  const response = await requestTransport(
    baseUrl,
    `/api/workbench/view?${parameters.toString()}`,
  );
  assert.equal(response.status, 200);
  return assertViewResponse(JSON.parse(response.body.toString("utf8")));
}

/**
 * Main Workbench JSON契約を取得し、別Viewへの誤配送を拒否する。
 *
 * @responsibility Main View試験へ判別済みのJSON Read Modelだけを渡す。
 * @trace ERB-IT-021
 * @trace CPR-IT-012
 * @trace CPR-IT-010
 * @precondition requestClientModelが表示応答を返す。
 * @stimulus 指定RouteのJSON Read Modelを取得する。
 * @observation view Discriminantを確認する。
 * @oracle main以外を固定Errorで拒否し、main Modelを返す。
 * @cleanup N/A: requestClientModelの資源契約を継承する。
 * @boundary ERB-IT-021=Direct Boundary: ViewResponse→Main View Model
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
async function requestMainModel(
  baseUrl: string,
  requestPath = "/",
): Promise<Extract<ViewResponse, { view: "main" }>> {
  const model = await requestClientModel(baseUrl, requestPath);
  assert.equal(model.view, "main");
  if (model.view !== "main") throw new Error("workbench_main_model_required");
  return model;
}

/**
 * Workbench試験Fixture内でGit Commandを実行する。
 *
 * @responsibility Production HTTP境界試験に必要なRepository初期状態だけを構築する。
 * @trace RFD-IT-014
 * @trace CPR-IT-012
 * @trace CPR-IT-010
 * @input cwdと固定Git引数を受け取る。
 * @returns UTF-8 stdoutを返す。
 * @precondition cwdはRepository-local試験領域内である。
 * @postcondition Command完了後に子Processを残さない。
 * @effect 試験Fixture Repositoryだけを変更する。
 * @failure 非0終了を試験失敗として送出する。
 * @invariant 実CRDD RepositoryへGit Effectを発行しない。
 * @stimulus gitの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary RFD-IT-014=Direct Boundary: workbench Test Source→対象契約
 * @security shellとCredentialを使わない。
 * @concurrency 同一Fixture内で直列実行する。
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
function git(cwd: string, ...args: readonly string[]): string {
  return execFileSync("git", args, {
    cwd,
    windowsHide: true,
    encoding: "utf8",
  }).trim();
}

/**
 * Direction A Shellと承認済み公式ロゴを固定Routeで配信することを検証する。
 *
 * @responsibility Production入口のBrand、主要Navigation、Runtime Query接続およびSecurity Headerの合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition 公式Logo AssetがRepository内に存在する。
 * @stimulus Shell、CSS、Logo、Health、HEADおよび不許可Methodを要求する。
 * @observation Response内容、Content-Type、Security HeaderおよびHealth結果を観測する。
 * @oracle 公式Logo RouteとDirection A Shellだけをloopbackから取得でき、書込みMethodを拒否する。
 * @cleanup Workbench Handleを閉じる。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 */
test("Direction A Shellと公式ロゴをloopback限定で配信する", async (t) => {
  const distribution = path.join(
    repositoryRoot,
    "40_Develop",
    "workbench-ui",
    "dist",
    "client",
  );
  for (const file of [
    "index.html",
    "workbench.css",
    "assets/workbench-client.js",
  ]) {
    await t.test(`UI配布物欠落で起動しない: ${file}`, async (context) => {
      const unavailable = path.join(distribution, file);
      const originalRead = fs.promises.readFile;
      const read = context.mock.method(
        fs.promises,
        "readFile",
        async (...args: Parameters<typeof originalRead>) => {
          if (args[0] === unavailable) throw new Error("fixture_asset_missing");
          return originalRead(...args);
        },
      );
      syncBuiltinESMExports();
      try {
        await assert.rejects(
          startWorkbench({ workingDirectory: repositoryRoot }),
          {
            message: "workbench_client_asset_unavailable",
          },
        );
      } finally {
        read.mock.restore();
        syncBuiltinESMExports();
      }
    });
  }
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  try {
    assert.match(handle.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/u);
    const shell = await requestRaw(handle.baseUrl, "/");
    const model = await requestClientModel(handle.baseUrl);
    assert.equal(model.view, "main");
    if (model.view !== "main") return;
    assert.deepEqual(model.connection, { state: "repository" });
    for (const operation of ["connect", "refresh", "disconnect"]) {
      const retired = await requestRaw(
        handle.baseUrl,
        "/connection/action",
        "POST",
        new URLSearchParams({
          actionToken: model.actionToken,
          operation,
          token: "fixture",
          mcpEndpoint: "http://127.0.0.1:1/mcp",
        }).toString(),
      );
      assert.equal(retired.status, 405);
    }
    assert.ok(model.aiSelection);
    const serializedModel = JSON.stringify(model);
    assert.equal(shell.status, 200);
    assert.deepEqual(
      shell.body,
      await readFile(path.join(distribution, "index.html")),
    );
    assert.match(shell.body.toString("utf8"), /CROS Workbench/u);
    assert.ok(
      model.aiSelection.catalog.catalog.models.some(
        (model) => model.modelIdentifier === "gpt-5.5",
      ),
    );
    assert.equal(Object.hasOwn(model, "logoPath"), false);
    assert.equal(
      model.projectData.context.repositoryId,
      "qual-lab.crdd-standard",
    );
    assert.match(serializedModel, /今どうなっているか/u);
    assert.match(serializedModel, /何が危ない、または止まっているか/u);
    assert.notEqual(model.executionActivity, undefined);
    assert.equal(model.projectData.plan.projection?.targetVersion, "v0.22.0");
    assert.equal(
      model.projectData.plan.projection?.targetReleaseDate,
      "2026-10-03",
    );
    assert.match(serializedModel, /Group B/u);
    const ownerSurface = await readProjectViewData(repositoryRoot);
    assert.equal(model.projectData.plan.state, "available");
    assert.equal(ownerSurface.plan.state, "available");
    assert.ok(model.projectData.plan.projection?.scheduleRisk);
    assert.equal(
      model.projectData.plan.projection?.scheduleRisk,
      ownerSurface.plan.projection?.scheduleRisk,
    );
    assert.notEqual(ownerSurface.quality.projection, null);
    assert.equal(
      model.projectData.quality.projection?.unobserved,
      ownerSurface.quality.projection?.unobserved,
    );
    assert.equal(
      model.projectData.quality.projection?.nextGate,
      ownerSurface.quality.projection?.nextGate,
    );
    assert.ok(model.projectData.ownerArtifacts.artifacts.length > 0);

    assert.equal(model.contract, "crdd/workbench/view/v1");
    for (const retiredKey of [
      "surface",
      "runtimeActivity",
      "topicMeetingResult",
    ])
      assert.equal(Object.hasOwn(model, retiredKey), false);
    assert.equal(Object.hasOwn(model, "topic"), false);
    assert.equal(Object.hasOwn(model, "meeting"), false);

    assert.match(shell.body.toString("utf8"), /data-workbench-react-root/u);
    assert.match(
      shell.body.toString("utf8"),
      /<script\b(?=[^>]*\btype="module")[^>]*\bsrc="\/assets\/workbench-client\.js"[^>]*><\/script>/u,
    );
    assert.match(
      shell.body.toString("utf8"),
      /<link\b(?=[^>]*\brel="stylesheet")[^>]*\bhref="\/workbench\.css"[^>]*>/u,
    );
    assert.match(shell.body.toString("utf8"), /aria-live="polite"/u);
    assert.match(shell.body.toString("utf8"), /Workbenchを読み込んでいます。/u);
    assert.equal(shell.headers["content-type"], "text/html; charset=utf-8");
    assert.match(
      String(shell.headers["content-security-policy"]),
      /default-src 'self'/u,
    );
    assert.match(
      String(shell.headers["content-security-policy"]),
      /script-src 'self'/u,
    );

    const client = await requestRaw(
      handle.baseUrl,
      "/assets/workbench-client.js",
    );
    assert.equal(client.status, 200);
    assert.equal(
      client.headers["content-type"],
      "text/javascript; charset=utf-8",
    );
    assert.match(client.body.toString("utf8"), /createRoot/u);
    assert.doesNotMatch(client.body.toString("utf8"), /hydrateRoot/u);

    const unlistedClientAsset = await requestRaw(
      handle.baseUrl,
      "/assets/other-client.js",
    );
    assert.equal(unlistedClientAsset.status, 404);
    const index = await requestRaw(handle.baseUrl, "/index.html");
    assert.equal(index.status, 200);
    assert.deepEqual(index.body, shell.body);

    const css = await requestRaw(handle.baseUrl, "/workbench.css");
    assert.equal(css.status, 200);
    assert.equal(css.headers["content-type"], "text/css; charset=utf-8");
    assert.deepEqual(
      css.body,
      await readFile(path.join(distribution, "workbench.css")),
    );
    const cssHead = await requestRaw(handle.baseUrl, "/workbench.css", "HEAD");
    assert.equal(cssHead.status, 200);
    assert.equal(cssHead.headers["content-length"], String(css.body.length));
    assert.equal(cssHead.body.length, 0);
    assert.match(css.body.toString("utf8"), /Noto Sans CJK JP/u);

    const logo = await requestRaw(
      handle.baseUrl,
      "/assets/crdd-brand-icon.jpg",
    );
    assert.equal(logo.status, 200);
    assert.equal(logo.headers["content-type"], "image/jpeg");
    assert.ok(logo.body.byteLength > 0);

    const roadmap = await requestRaw(
      handle.baseUrl,
      "/owner-artifact?path=99_Roadmap%2F01_Roadmap.md",
    );
    assert.equal(roadmap.status, 200);
    assert.equal(roadmap.headers["content-type"], "text/html; charset=utf-8");
    assert.match(roadmap.body.toString("utf8"), /data-workbench-react-root/u);
    const roadmapModel = await requestClientModel(
      handle.baseUrl,
      "/owner-artifact?path=99_Roadmap%2F01_Roadmap.md",
    );
    assert.equal(roadmapModel.view, "artifact");
    if (roadmapModel.view === "artifact")
      assert.match(roadmapModel.artifact.markdown, /^# CRDD Roadmap/mu);

    const filteredDocuments = await requestClientModel(
      handle.baseUrl,
      "/?documentQuery=Roadmap",
    );
    assert.equal(filteredDocuments.view, "main");
    if (filteredDocuments.view === "main") {
      assert.equal(Object.hasOwn(filteredDocuments, "documentQuery"), false);
      assert.equal(Object.hasOwn(filteredDocuments, "portfolioQuery"), false);
      assert.ok(
        filteredDocuments.projectData.ownerArtifacts.artifacts.some(
          (artifact) => artifact.relativePath === "99_Roadmap/01_Roadmap.md",
        ),
      );
    }

    const releaseProjection = await requestRaw(
      handle.baseUrl,
      "/owner-artifact?path=99_Roadmap%2F03_Releases.md",
    );
    assert.equal(releaseProjection.status, 200);
    const releaseModel = await requestClientModel(
      handle.baseUrl,
      "/owner-artifact?path=99_Roadmap%2F03_Releases.md",
    );
    assert.equal(releaseModel.view, "artifact");
    if (releaseModel.view === "artifact")
      assert.match(releaseModel.artifact.markdown, /^# CRDD Releases/mu);

    const arbitraryDocument = await requestRaw(
      handle.baseUrl,
      "/api/workbench/view?route=%2Fowner-artifact&path=package.json",
    );
    assert.equal(arbitraryDocument.status, 400);

    const traversal = await requestRaw(
      handle.baseUrl,
      "/api/workbench/view?route=%2Fowner-artifact&path=..%2Foutside.md",
    );
    assert.equal(traversal.status, 400);

    const health = await requestRaw(
      handle.baseUrl,
      "/.well-known/crdd-workbench-health",
    );
    assert.deepEqual(JSON.parse(health.body.toString("utf8")), {
      contract: "crdd/workbench/v1",
      status: "ready",
      host: "127.0.0.1",
      mode: "repository",
      readOnly: false,
    });

    const head = await requestRaw(handle.baseUrl, "/index.html", "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body.byteLength, 0);

    const post = await requestRaw(handle.baseUrl, "/", "POST");
    assert.equal(post.status, 405);
    assert.equal(post.headers.allow, "GET, HEAD");
  } finally {
    await handle.close();
  }
});

/**
 * Route分割の前後でraw URLの解釈とMethod拒否を維持する。
 * @responsibility dot segment・absolute-form・HEADを別操作へ読み替えず、同じ前段から処理する。
 * @trace ERB-IT-021
 * @precondition localhost Serverだけを起動し、処置前拒否に使う不正Workspace Formを用意する。
 * @stimulus 正規化を要するraw Path、管理GETとHEAD、旧Candidate入口、二重slashを含む絶対URLを逐次要求する。
 * @observation HTTP状態・固定本文・管理の非秘密な未構成結果を取得する。
 * @oracle Workspace不正入力は400、管理HEADは404、正規化された旧Candidateは410。二重slash Pathは404／405のままで正常入口へ変化せず、操作を発行しない。
 * @cleanup finallyで所有Serverをjoinし、終了後の接続拒否を確認する。
 * @boundary raw HTTPと現在のURL解釈・操作別Handler。外部AI・Docker・保存は使用しない。
 */
test("Route分割はraw URLの正規化と管理HEAD拒否を維持する", async () => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  try {
    const model = await requestMainModel(handle.baseUrl);
    const form = new URLSearchParams({
      actionToken: model.actionToken,
      repositoryId: model.projectData.context.repositoryId,
      command: "null",
    }).toString();
    for (const requestPath of [
      "/x/../api/workspace",
      "/x/%2e%2e/api/workspace",
      "http://workbench.invalid/x/../api/workspace",
    ]) {
      const result = await requestTransport(
        handle.baseUrl,
        requestPath,
        "POST",
        form,
        { Origin: handle.baseUrl },
      );
      assert.equal(result.status, 400, requestPath);
      assert.equal(
        result.body.toString("utf8"),
        "workspace_request_rejected\n",
      );
    }
    const current = await requestRaw(
      handle.baseUrl,
      "/x/../api/access?view=current",
    );
    assert.equal(current.status, 200);
    assert.deepEqual(JSON.parse(current.body.toString("utf8")), {
      status: "unavailable",
      reason: "management_not_configured",
    });
    const head = await requestRaw(
      handle.baseUrl,
      "/x/../api/access?view=current",
      "HEAD",
    );
    assert.equal(head.status, 404);
    assert.equal(head.body.byteLength, 0);
    const candidate = await requestRaw(
      handle.baseUrl,
      "http://workbench.invalid/x/../candidate/action",
      "POST",
    );
    assert.equal(candidate.status, 410);
    assert.equal(
      candidate.body.toString("utf8"),
      "legacy_bundle_candidate_route_removed\n",
    );
    for (const path of [
      ".well-known/crdd-workbench-health",
      "api/workbench/view",
      "api/access",
    ]) {
      const result = await requestRaw(
        handle.baseUrl,
        `http://synthetic.invalid//shadow/${path}`,
      );
      assert.equal(result.status, 404, path);
    }
    for (const operation of [
      "api/workspace",
      "api/repository",
      "api/records",
      "api/ai-selection",
      "api/ai-request",
    ]) {
      const shadow = await requestRaw(
        handle.baseUrl,
        `http://synthetic.invalid//shadow/${operation}`,
        "POST",
      );
      assert.equal(shadow.status, 405, operation);
      const trailing = await requestRaw(
        handle.baseUrl,
        `/${operation}/`,
        "POST",
      );
      assert.equal(trailing.status, 405, operation);
    }
    for (const [operation, reason] of [
      ["repository", "repository_action_rejected"],
      ["records", "topic_meeting_action_rejected"],
      ["ai-selection", "ai_selection_request_rejected"],
      ["ai-request", "ai_request_action_rejected"],
    ]) {
      const normalized = await requestRaw(
        handle.baseUrl,
        `http://synthetic.invalid/x/../api/${operation}`,
        "POST",
      );
      assert.equal(normalized.status, 400, operation);
      assert.equal(normalized.body.toString("utf8"), `${reason}\n`);
    }
  } finally {
    await handle.close();
  }
  await assert.rejects(requestRaw(handle.baseUrl, "/"));
});

/**
 * CROS Portfolio ProjectionをRepository単体表示と区別して描画することを検証する。
 *
 * @responsibility 許可済みProject、Source Coverageおよび部分状態をWorkbenchへ意味を変えずに搬送する。
 * @trace PPR-IT-002
 * @precondition 現在Repository Contextを含む許可済みPortfolio Projectionを用意する。
 * @stimulus Portfolio付きでWorkbenchを開始しShellを要求する。
 * @observation Project Identity、Source、状態およびFederation表示を観測する。
 * @oracle Projection内の値が表示され、単一Scoreや非開示Projectが追加されない。
 * @cleanup Workbench Handleを閉じる。
 * @boundary PPR-IT-002=Direct Boundary: workbench Test Source→対象契約
 */
test("許可済みPortfolioをSource Coverage付きで表示する", async () => {
  const surface = await readProjectViewData(repositoryRoot);
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    portfolio: {
      projects: [
        {
          projectId: surface.context.projectId,
          state: "partial" as const,
          sources: [
            {
              repositoryId: surface.context.repositoryId,
              revision: "test-revision",
              state: "complete" as const,
              repositoryRole: surface.context.repositoryRole,
              context: surface.context,
            },
            {
              repositoryId: "visible-missing-source",
              revision: null,
              state: "missing" as const,
              repositoryRole: null,
              context: null,
            },
          ],
        },
        ...Array.from({ length: 21 }, (_, index) => ({
          projectId: `PRJ-${String(100000 + index)}`,
          state: "partial" as const,
          sources: [
            {
              repositoryId: `visible-source-${String(index + 1).padStart(2, "0")}`,
              revision: null,
              state: "missing" as const,
              repositoryRole: null,
              context: null,
            },
          ],
        })),
      ].sort((left, right) => left.projectId.localeCompare(right.projectId)),
      retainedAsSourceOfTruth: false,
    },
  });
  try {
    const model = await requestClientModel(handle.baseUrl);
    assert.equal(model.view, "main");
    if (model.view !== "main") return;
    assert.notEqual(model.portfolio, null);
    assert.notEqual(model.portfolioPage.nextCursor, null);
    const filtered = await requestClientModel(
      handle.baseUrl,
      `/?portfolioQuery=${encodeURIComponent(surface.context.projectId)}&portfolioState=partial`,
    );
    assert.equal(filtered.view, "main");
    if (filtered.view !== "main") return;
    assert.deepEqual(
      filtered.portfolio?.projects.map((project) => project.projectId),
      [surface.context.projectId],
    );
    assert.equal(filtered.portfolio?.projects[0]?.state, "partial");
    assert.equal(filtered.portfolio?.projects[0]?.sources.length, 2);
    assert.equal(
      filtered.portfolio?.projects[0]?.sources[1]?.repositoryId,
      "visible-missing-source",
    );
    assert.equal(filtered.portfolio?.projects[0]?.sources[1]?.state, "missing");
    const mismatchedCursor = Buffer.from(
      JSON.stringify(["different-query", "partial", surface.context.projectId]),
      "utf8",
    ).toString("base64url");
    const rejectedCursor = await requestClientModel(
      handle.baseUrl,
      `/?portfolioQuery=${encodeURIComponent(surface.context.projectId)}&portfolioState=partial&portfolioCursor=${encodeURIComponent(mismatchedCursor)}`,
    );
    assert.equal(rejectedCursor.view, "main");
    if (rejectedCursor.view === "main")
      assert.equal(rejectedCursor.portfolioPage.cursorInvalid, true);
    const detail = await requestClientModel(
      handle.baseUrl,
      `/project?id=${encodeURIComponent(surface.context.projectId)}`,
    );
    assert.equal(detail.view, "project-detail");
    if (detail.view === "project-detail") {
      assert.equal(detail.project.projectId, surface.context.projectId);
      assert.equal(detail.project.sources.length, 2);
      assert.equal(
        detail.project.sources[0]?.context?.scenes[0]?.title,
        "今どうなっているか",
      );
      assert.equal(detail.project.sources[1]?.context, null);
    }
    const undisclosed = await requestRaw(
      handle.baseUrl,
      "/api/workbench/view?route=%2Fproject&id=PRJ-UNDISCLOSED",
    );
    assert.equal(undisclosed.status, 404);
  } finally {
    await handle.close();
  }
});

/**
 * 現在の管理者接続で鍵4操作と本人交換を専用HTTP応答へ接続することを検証する。
 *
 * @responsibility AM保存Ownerへの現在認可、閉じた入力、用途限定提示と交換終了を検証する。
 * @trace RFD-IT-013
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition Repository内の自己生成RootへAM v2管理状態と試験専用資格を保存する。
 * @stimulus 不正入力を拒否し、鍵4操作と本人交換を実HTTPで送る。交換の六保存点と秘密応答開始時の故障を注入する。
 * @observation 専用応答、非秘密一覧、改訂・資格・提示状態・交換記録と終了後不存在を読む。
 * @oracle 不正入力の保存変更0。鍵は専用presenting応答だけで、汎用GET・保存本文へ複製しない。
 * @cleanup 全Workbench Handleを閉じ、検証した自己生成Rootだけ削除して不存在を確認する。
 * @boundary RFD-IT-013=管理入力→AM現在認可・保存。RFD-IT-017=専用HTTP提示。RFD-IT-018=通常交換→fresh認可による記録終了。
 */
test("管理接続時だけCredentialを管理し生Tokenを専用POSTで一度だけ表示する", async (t) => {
  const directory = await mkdtemp(
    path.join(repositoryRoot, ".crdd", "tests", "workbench-am-"),
  );
  t.after(async () => {
    assert.equal(
      path.dirname(directory),
      path.join(repositoryRoot, ".crdd", "tests"),
    );
    await rm(directory, { recursive: true });
    await assert.rejects(lstat(directory), { code: "ENOENT" });
  });
  const adminId = "00000000-0000-4000-8000-000000000003";
  const developerId = "00000000-0000-4000-8000-000000000004";
  const material = createCredentialMaterial();
  const state: AccessManagementState = {
    contract: "crdd-access-management/state",
    schemaRevision: 2,
    revision: 1,
    operationId: "00000000-0000-4000-8000-000000000001",
    users: [
      { userId: adminId, username: "管理者", role: "administrator" },
      { userId: developerId, username: "開発者", role: "developer" },
    ],
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: [] },
    ],
    credentials: [
      {
        credentialId: material.credentialId,
        userId: adminId,
        tokenVersion: 1,
        tokenSalt: material.tokenSalt,
        tokenVerifier: material.tokenVerifier,
        revoked: false,
        operationId: "00000000-0000-4000-8000-000000000002",
        presentation: "confirmed",
      },
    ],
    registeredRepositories: [],
    exposure: [],
    unresolvedKeyExchanges: [],
    initialization: {
      stage: "completed",
      attemptId: "00000000-0000-4000-8000-000000000002",
      initialUserId: adminId,
      initialCredentialId: material.credentialId,
      confirmationCredentialId: material.credentialId,
      connection: "confirmed",
    },
  };
  const current = path.join(directory, "access-management.json");
  await writeFile(current, JSON.stringify(state));
  const root = createFilesystemStoreRoot(directory);
  assert.ok(root);
  const repositoryOnly = await startWorkbench({
    workingDirectory: repositoryRoot,
  });
  try {
    const shell = await requestClientModel(repositoryOnly.baseUrl);
    assert.equal(shell.view, "main");
    if (shell.view === "main")
      assert.equal(shell.credentials.state, "not_configured");
    assert.equal(
      (
        await requestRaw(
          repositoryOnly.baseUrl,
          "/api/access/credentials",
          "POST",
          "operation=issue&profile=developer",
        )
      ).status,
      400,
    );
    assert.equal(JSON.parse(await readFile(current, "utf8")).revision, 1);
  } finally {
    await repositoryOnly.close();
  }
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    credentialAdministration: { root, token: material.token },
  });
  try {
    const initial = await requestClientModel(handle.baseUrl);
    assert.equal(initial.view, "main");
    if (initial.view !== "main") return;
    assert.equal(initial.credentials.state, "available");
    assert.equal(initial.credentials.snapshot?.revision, 1);
    const beforeRejected = await readFile(current, "utf8");
    const validIssue = new URLSearchParams({
      actionToken: initial.actionToken,
      operation: "issue",
      userId: developerId,
      expectedRevision: "1",
    }).toString();
    for (const headers of [
      { Origin: "https://untrusted.invalid" },
      { Host: "untrusted.invalid" },
      { "Content-Type": "application/json" },
    ]) {
      const denied = await requestTransport(
        handle.baseUrl,
        "/api/access/credentials",
        "POST",
        validIssue,
        headers,
      );
      assert.equal(denied.status, 400);
      assert.equal(
        denied.body.toString("utf8"),
        "credential_action_rejected\n",
      );
      assert.equal(await readFile(current, "utf8"), beforeRejected);
    }
    for (const body of [
      `${validIssue}&operation=issue`,
      `${validIssue}&actionToken=${initial.actionToken}`,
      `${validIssue}&expectedRevision=1`,
      `${validIssue}&root=arbitrary`,
      validIssue.replace("expectedRevision=1", "expectedRevision=2"),
    ]) {
      const denied = await requestRaw(
        handle.baseUrl,
        "/api/access/credentials",
        "POST",
        body,
      );
      assert.equal(denied.status, 400);
      assert.equal(await readFile(current, "utf8"), beforeRejected);
    }
    for (const invalid of [
      {
        actionToken: initial.actionToken,
        operation: "issue",
        profile: "developer",
      },
      {
        actionToken: initial.actionToken,
        operation: "update_access",
        credentialId: material.credentialId,
      },
      {
        actionToken: initial.actionToken,
        operation: "rotate",
        credentialId: material.credentialId,
      },
      {
        actionToken: "invalid",
        operation: "issue",
        userId: developerId,
        expectedRevision: "1",
      },
    ])
      assert.equal(
        (
          await requestRaw(
            handle.baseUrl,
            "/api/access/credentials",
            "POST",
            new URLSearchParams(invalid).toString(),
          )
        ).status,
        400,
      );
    assert.equal(JSON.parse(await readFile(current, "utf8")).revision, 1);
    const issued = await requestRaw(
      handle.baseUrl,
      "/api/access/credentials",
      "POST",
      new URLSearchParams({
        actionToken: initial.actionToken,
        operation: "issue",
        userId: developerId,
        expectedRevision: "1",
      }).toString(),
    );
    assert.equal(issued.status, 200);
    assert.equal(issued.headers["cache-control"], "no-store");
    assert.equal(issued.headers.location, undefined);
    const result = JSON.parse(issued.body.toString("utf8"));
    assert.equal(result.status, "presenting");
    assert.equal(result.reason, "stored_key_response");
    assert.equal(typeof result.token, "string");
    const credentialId = result.credentialId;
    assert.equal(typeof credentialId, "string");
    const saved = JSON.parse(
      await readFile(current, "utf8"),
    ) as AccessManagementState;
    assert.equal(saved.credentials.length, 2);
    assert.equal(saved.credentials[0]?.revoked, false);
    assert.equal(saved.unresolvedKeyExchanges.length, 0);
    assert.equal(JSON.stringify(saved).includes(result.token), false);
    const fresh = await requestClientModel(handle.baseUrl);
    assert.equal(fresh.view, "main");
    assert.equal(JSON.stringify(fresh).includes(result.token), false);
    assert.equal(
      Object.hasOwn(fresh.view === "main" ? fresh.credentials : {}, "result"),
      false,
    );
    if (fresh.view !== "main" || !fresh.credentials.snapshot) return;
    const revoked = await requestRaw(
      handle.baseUrl,
      "/api/access/credentials",
      "POST",
      new URLSearchParams({
        actionToken: initial.actionToken,
        operation: "revoke",
        userId: developerId,
        credentialId,
        expectedRevision: String(fresh.credentials.snapshot.revision),
      }).toString(),
    );
    assert.equal(revoked.status, 200);
    const revocation = JSON.parse(revoked.body.toString("utf8"));
    assert.equal(revocation.status, "completed");
    assert.equal(Object.hasOwn(revocation, "token"), false);
    assert.equal(Object.hasOwn(revocation, "recoveryId"), false);
    const last = JSON.parse(
      await readFile(current, "utf8"),
    ) as AccessManagementState;
    assert.equal(last.credentials[0]?.revoked, false);
    assert.equal(last.credentials[1]?.revoked, true);
    assert.equal(last.credentials.length, 2);
    assert.equal(last.unresolvedKeyExchanges.length, 0);
    const targeted = await requestRaw(
      handle.baseUrl,
      "/api/access/credentials",
      "POST",
      new URLSearchParams({
        actionToken: initial.actionToken,
        operation: "exchange-user",
        userId: developerId,
        expectedRevision: String(last.revision),
        displayedOldCredentialIds: "[]",
      }).toString(),
    );
    assert.equal(targeted.status, 200);
    const targetReply = JSON.parse(targeted.body.toString("utf8"));
    assert.equal(targetReply.status, "presenting");
    assert.equal(typeof targetReply.token, "string");
    assert.equal(typeof targetReply.recoveryId, "string");
    const afterTarget = await requestClientModel(handle.baseUrl);
    assert.equal(afterTarget.view, "main");
    if (afterTarget.view !== "main" || !afterTarget.credentials.snapshot)
      return;
    assert.equal(afterTarget.credentials.snapshot.exchange, null);
    assert.equal(
      JSON.stringify(afterTarget).includes(targetReply.token),
      false,
    );
    const allIds = afterTarget.credentials.snapshot.credentials
      .filter((credential) => !credential.revoked)
      .map((credential) => credential.credentialId);
    const allForm = new URLSearchParams({
      actionToken: initial.actionToken,
      operation: "exchange-all",
      userId: adminId,
      expectedRevision: String(afterTarget.credentials.snapshot.revision),
      displayedOldCredentialIds: JSON.stringify(allIds),
    });
    assert.equal(
      (
        await requestRaw(
          handle.baseUrl,
          "/api/access/credentials",
          "POST",
          allForm.toString(),
        )
      ).status,
      400,
    );
    allForm.set("confirmed", "true");
    const all = await requestRaw(
      handle.baseUrl,
      "/api/access/credentials",
      "POST",
      allForm.toString(),
    );
    assert.equal(all.status, 200);
    const allReply = JSON.parse(all.body.toString("utf8"));
    assert.equal(allReply.status, "presenting");
    const afterAll = await requestClientModel(handle.baseUrl);
    assert.equal(afterAll.view, "main");
    if (afterAll.view === "main")
      assert.equal(afterAll.credentials.state, "unavailable");
    const finalState = JSON.parse(
      await readFile(current, "utf8"),
    ) as AccessManagementState;
    assert.equal(finalState.unresolvedKeyExchanges.length, 0);
    assert.equal(
      finalState.credentials.filter((credential) => !credential.revoked).length,
      1,
    );
    assert.equal(finalState.credentials.at(-1)?.userId, adminId);
    const reconnected = await startWorkbench({
      workingDirectory: repositoryRoot,
      credentialAdministration: { root, token: allReply.token },
    });
    try {
      const model = await requestClientModel(reconnected.baseUrl);
      assert.equal(model.view, "main");
      if (model.view !== "main" || !model.credentials.snapshot) return;
      const selfIds = model.credentials.snapshot.credentials
        .filter(
          (credential) => !credential.revoked && credential.userId === adminId,
        )
        .map((credential) => credential.credentialId);
      const self = await requestRaw(
        reconnected.baseUrl,
        "/api/access/credentials",
        "POST",
        new URLSearchParams({
          actionToken: model.actionToken,
          operation: "exchange-user",
          userId: adminId,
          expectedRevision: String(model.credentials.snapshot.revision),
          displayedOldCredentialIds: JSON.stringify(selfIds),
        }).toString(),
      );
      assert.equal(self.status, 200);
      assert.equal(JSON.parse(self.body.toString("utf8")).status, "presenting");
      const stale = await requestClientModel(reconnected.baseUrl);
      assert.equal(stale.view, "main");
      if (stale.view === "main")
        assert.equal(stale.credentials.state, "unavailable");
      const settled = JSON.parse(
        await readFile(current, "utf8"),
      ) as AccessManagementState;
      assert.equal(settled.unresolvedKeyExchanges.length, 0);
      assert.equal(
        settled.credentials.filter((credential) => !credential.revoked).length,
        1,
      );
      assert.equal(settled.credentials.at(-1)?.presentation, "confirmed");
    } finally {
      await reconnected.close();
    }
  } finally {
    await handle.close();
  }
  for (let failedPublication = 1; failedPublication <= 6; failedPublication++) {
    await t.test(
      `交換の出版${failedPublication}故障は既知段階と提示の限界を保持する`,
      async () => {
        const faultDirectory = path.join(
          directory,
          `publication-${failedPublication}`,
        );
        await mkdir(faultDirectory);
        const faultCurrent = path.join(
          faultDirectory,
          "access-management.json",
        );
        await writeFile(faultCurrent, JSON.stringify(state));
        const faultRoot = createFilesystemStoreRoot(faultDirectory);
        assert.ok(faultRoot);
        const faultHandle = await startWorkbench({
          workingDirectory: repositoryRoot,
          credentialAdministration: { root: faultRoot, token: material.token },
        });
        const rename = fs.renameSync;
        let publications = 0;
        try {
          const model = await requestClientModel(faultHandle.baseUrl);
          assert.equal(model.view, "main");
          if (model.view !== "main") return;
          fs.renameSync = (from, to) => {
            if (
              String(to) === faultCurrent &&
              ++publications === failedPublication
            )
              throw new Error("synthetic_credential_publication_failure");
            return rename(from, to);
          };
          const reply = await requestRaw(
            faultHandle.baseUrl,
            "/api/access/credentials",
            "POST",
            new URLSearchParams({
              actionToken: model.actionToken,
              operation: "exchange-user",
              userId: developerId,
              expectedRevision: "1",
              displayedOldCredentialIds: "[]",
            }).toString(),
          );
          await faultHandle.close();
          const response = JSON.parse(reply.body.toString("utf8"));
          assert.equal(reply.status, failedPublication <= 4 ? 409 : 200);
          assert.equal(
            response.status,
            failedPublication <= 4 ? "blocked" : "presenting",
          );
          assert.equal(
            Object.hasOwn(response, "token"),
            failedPublication >= 5,
          );
          assert.equal(reply.headers["cache-control"], "no-store");
          assert.equal(publications, failedPublication);
          const held = JSON.parse(
            await readFile(faultCurrent, "utf8"),
          ) as AccessManagementState;
          assert.equal(held.revision, failedPublication);
          assert.equal(held.credentials[0]?.revoked, false);
          assert.equal(held.credentials.length, failedPublication >= 4 ? 2 : 1);
          assert.equal(
            held.unresolvedKeyExchanges.length,
            failedPublication === 1 ? 0 : 1,
          );
          if (failedPublication >= 4) {
            assert.equal(
              held.unresolvedKeyExchanges[0]?.stage,
              "credential_stored",
            );
            assert.equal(
              held.credentials.at(-1)?.presentation,
              failedPublication === 4
                ? "not_attempted"
                : failedPublication === 5
                  ? "unconfirmed"
                  : "confirmed",
            );
          }
          if (typeof response.token === "string")
            assert.equal(JSON.stringify(held).includes(response.token), false);
        } finally {
          await faultHandle.close();
          fs.renameSync = rename;
        }
      },
    );
  }
  for (const failure of ["close", "throw"] as const) {
    await t.test(
      `秘密応答の${failure}故障は提示確認と交換終了を開始しない`,
      async () => {
        const faultDirectory = path.join(directory, `response-${failure}`);
        await mkdir(faultDirectory);
        const faultCurrent = path.join(
          faultDirectory,
          "access-management.json",
        );
        await writeFile(faultCurrent, JSON.stringify(state));
        const faultRoot = createFilesystemStoreRoot(faultDirectory);
        assert.ok(faultRoot);
        const faultHandle = await startWorkbench({
          workingDirectory: repositoryRoot,
          credentialAdministration: { root: faultRoot, token: material.token },
        });
        const end = ServerResponse.prototype.end;
        let interruptions = 0;
        try {
          const model = await requestClientModel(faultHandle.baseUrl);
          assert.equal(model.view, "main");
          if (model.view !== "main") return;
          ServerResponse.prototype.end = function (
            this: ServerResponse,
            ...arguments_: unknown[]
          ) {
            const body = arguments_[0];
            if (
              Buffer.isBuffer(body) &&
              this.getHeader("Content-Type") ===
                "application/json; charset=utf-8"
            ) {
              const value = JSON.parse(body.toString("utf8"));
              if (
                value.contract === "crdd/workbench/credential-action" &&
                value.status === "presenting"
              ) {
                interruptions++;
                if (failure === "throw")
                  throw new Error("synthetic_response_failure");
                this.destroy();
                return this;
              }
            }
            return Reflect.apply(end, this, arguments_);
          } as typeof ServerResponse.prototype.end;
          await assert.rejects(
            requestRaw(
              faultHandle.baseUrl,
              "/api/access/credentials",
              "POST",
              new URLSearchParams({
                actionToken: model.actionToken,
                operation: "exchange-user",
                userId: developerId,
                expectedRevision: "1",
                displayedOldCredentialIds: "[]",
              }).toString(),
            ),
            { code: "ECONNRESET" },
          );
          const closing = faultHandle.close();
          assert.equal(faultHandle.close(), closing);
          await closing;
          assert.equal(interruptions, 1);
          const held = JSON.parse(
            await readFile(faultCurrent, "utf8"),
          ) as AccessManagementState;
          assert.equal(held.revision, 5);
          assert.equal(held.credentials.length, 2);
          assert.equal(held.credentials[0]?.revoked, false);
          assert.equal(held.credentials.at(-1)?.presentation, "unconfirmed");
          assert.equal(held.unresolvedKeyExchanges.length, 1);
          assert.equal(
            held.unresolvedKeyExchanges[0]?.stage,
            "credential_stored",
          );
        } finally {
          await faultHandle.close();
          ServerResponse.prototype.end = end;
        }
      },
    );
  }
});

/**
 * Workbench操作Tokenを通じて選択PathだけをStage・Commitできることを検証する。
 *
 * @responsibility Browser Form→Workbench Application→Version Control Portの直接搬送と再観測を検証する。
 * @trace RFD-IT-014
 * @precondition Repository-local試験領域にProject Context、公式Logoおよび未反映変更を持つ実Git Repositoryを構築する。
 * @stimulus 不正Token、正しいTokenでStage、続けてCommitをHTTP Formから要求する。
 * @observation HTTP結果、再描画したStaged状態および操作結果を観測する。
 * @oracle 不正TokenはEffect 0で拒否され、正しいTokenでは選択Pathだけが処置される。
 * @cleanup Workbenchを閉じ、Fixtureを再帰削除する。
 * @boundary RFD-IT-014=Direct Boundary: workbench Test Source→対象契約
 */
test("Token付きRepository操作で選択PathだけをStage・Commit・通常公開する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-repository-"));
  const remote = await mkdtemp(path.join(testRoot, "workbench-remote-"));
  let handle: Awaited<ReturnType<typeof startWorkbench>> | null = null;
  try {
    await mkdir(path.join(fixture, "04_UI", "assets", "brand"), {
      recursive: true,
    });
    await copyFile(
      path.join(
        repositoryRoot,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
      path.join(
        fixture,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
    );
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
      "utf8",
    );
    await writeFile(path.join(fixture, "work.txt"), "base\n", "utf8");
    git(fixture, "init", "--initial-branch=main");
    git(fixture, "config", "user.name", "CRDD Test");
    git(fixture, "config", "user.email", "crdd-test@example.invalid");
    git(fixture, "add", ".");
    git(fixture, "commit", "--quiet", "--message", "base");
    git(remote, "init", "--bare");
    git(fixture, "remote", "add", "origin", remote);
    git(fixture, "push", "--quiet", "--set-upstream", "origin", "main");
    await writeFile(path.join(fixture, "work.txt"), "changed\n", "utf8");

    handle = await startWorkbench({ workingDirectory: fixture });
    const initial = await requestMainModel(handle.baseUrl);
    const token = initial.actionToken;
    assert.ok(
      initial.worktree.tree?.entries.some((entry) => entry.path === "work.txt"),
    );
    const diff = await requestMainModel(handle.baseUrl, "/?diffPath=work.txt");
    assert.match(diff.worktree.diff?.workingPatch ?? "", /\+changed/u);
    assert.ok(
      diff.projectData.repository.changeSet?.workingChanges.includes(
        "work.txt",
      ),
    );
    const invalidTree = await requestMainModel(
      handle.baseUrl,
      "/?treeDirectory=..%2Foutside",
    );
    assert.equal(invalidTree.worktree.state, "unknown");
    const rejected = await requestRaw(
      handle.baseUrl,
      "/api/repository",
      "POST",
      "actionToken=wrong&operation=prepare&path=work.txt",
    );
    assert.equal(rejected.status, 400);

    const staged = await requestRaw(
      handle.baseUrl,
      "/api/repository",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "prepare",
        path: "work.txt",
      }).toString(),
    );
    assert.equal(staged.status, 303);
    const afterStage = await requestMainModel(handle.baseUrl);
    assert.deepEqual(
      afterStage.projectData.repository.changeSet?.preparedChanges,
      ["work.txt"],
    );

    const committed = await requestRaw(
      handle.baseUrl,
      "/api/repository",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "create_revision",
        message: "workbench commit",
      }).toString(),
    );
    assert.equal(committed.status, 303);
    const afterCommit = await requestMainModel(handle.baseUrl);
    assert.equal(afterCommit.repositoryResult?.reason, "revision_created");
    const revisionIdentity = git(fixture, "rev-parse", "HEAD");
    const published = await requestRaw(
      handle.baseUrl,
      "/api/repository",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "publish_revision",
        destination: "origin",
        branch: "main",
        revisionIdentity,
        humanConfirmed: "true",
      }).toString(),
    );
    assert.equal(published.status, 303);
    const afterPublication = await requestMainModel(handle.baseUrl);
    assert.equal(
      afterPublication.repositoryResult?.reason,
      "publication_confirmed",
    );
    assert.equal(git(remote, "rev-parse", "refs/heads/main"), revisionIdentity);

    await writeFile(
      path.join(fixture, "after-publication.txt"),
      "new\n",
      "utf8",
    );
    await unlink(path.join(fixture, "PROJECT_CONTEXT.md"));
    const completedWithRefreshFailure = await requestRaw(
      handle.baseUrl,
      "/api/repository",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "prepare",
        path: "after-publication.txt",
      }).toString(),
    );
    assert.equal(completedWithRefreshFailure.status, 303);
    assert.equal(
      git(fixture, "diff", "--cached", "--name-only"),
      "after-publication.txt",
    );
    const afterRefreshFailure = await requestMainModel(handle.baseUrl);
    assert.equal(
      afterRefreshFailure.repositoryResult?.reason,
      "prepare_completed",
    );
    assert.equal(afterRefreshFailure.projectData.repository.state, "unknown");
  } finally {
    if (handle !== null) await handle.close();
    await rm(fixture, { recursive: true, force: true });
    await rm(remote, { recursive: true, force: true });
  }
});

/**
 * WorkbenchからTopicを登録・表示・編集・削除するを検証する。
 *
 * @responsibility WorkbenchからTopicを登録・表示・編集・削除するを検証するの検証責務を所有する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus WorkbenchからTopicを登録・表示・編集・削除するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: workbench Test Source→対象契約
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
test("WorkbenchからTopicを登録・表示・編集・削除する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  for (const directory of [path.join(repositoryRoot, ".crdd"), testRoot]) {
    try {
      const entry = await lstat(directory);
      assert.equal(entry.isSymbolicLink(), false);
      assert.equal(entry.isDirectory(), true);
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        await mkdir(directory);
      else throw error;
    }
  }
  const fixture = await mkdtemp(path.join(testRoot, "workbench-topic-"));
  let handle: Awaited<ReturnType<typeof startWorkbench>> | null = null;
  /**
   * topic用の試験入力または観測処理を提供する。
   *
   * @responsibility topic用の試験入力または観測処理を提供するの検証責務を所有する。
   * @trace CPR-IT-010
   * @trace CPR-IT-012
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus topicの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
   * @boundary CPR-IT-010=Direct Boundary: workbench Test Source→対象契約
   * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
   */
  const topic = (revision: number, state = "open") =>
    `# Workbench Topic\n\n成果物種別: Topic\nTopic ID: \`TOPIC-000042\`\nProject ID: \`PRJ-001\`\n状態: \`${state}\`\n改訂: \`${revision}\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\nWorkbench CRUDを確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| candidate | \`CHG-000010\` | 採用候補 |\n| related | \`TOPIC-999999\` | 欠落Relationの明示 |\n\n## 4. 次の行動\n\n| 行動 | Owner | 期限／再評価契機 | 完了条件 | 状態 |\n|---|---|---|---|---|\n| 確認する | PM | 次回 | 判断する | \`open\` |\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | \`N/A: open／waitingでは未処置\` |\n| 昇格先 | \`N/A: 未昇格\` |\n| 終了理由 | \`N/A: 未終了\` |\n| 残る影響 | \`N/A: 未終了\` |\n`;
  try {
    await mkdir(path.join(fixture, "04_UI", "assets", "brand"), {
      recursive: true,
    });
    await copyFile(
      path.join(
        repositoryRoot,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
      path.join(
        fixture,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
    );
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
      "utf8",
    );
    await mkdir(path.join(fixture, "99_Roadmap", "Changes", "CHG-000010"), {
      recursive: true,
    });
    await writeFile(
      path.join(fixture, "99_Roadmap", "Changes", "CHG-000010", "change.md"),
      "# Workbench Relation Change\n",
      "utf8",
    );
    git(fixture, "init", "--initial-branch=main");
    handle = await startWorkbench({ workingDirectory: fixture });
    const initial = await requestMainModel(handle.baseUrl);
    const token = initial.actionToken;
    const create = await requestRaw(
      handle.baseUrl,
      "/api/records",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "create",
        markdown: topic(1),
      }).toString(),
    );
    assert.equal(create.status, 303);
    const created = await requestMainModel(handle.baseUrl);
    assert.match(
      JSON.stringify(created.topicPage.records[0]),
      /"topicId":"TOPIC-000042"/u,
    );
    assert.equal(
      created.topicPage.records[0]?.summary,
      "Workbench CRUDを確認する。",
    );
    assert.equal(created.recordDocuments[0]?.id, "TOPIC-000042");
    const filtered = await requestMainModel(
      handle.baseUrl,
      "/?topicQuery=Workbench&topicState=open&topicOwner=Project%20Operator&topicSort=title_asc",
    );
    assert.equal(filtered.topicQuery.query, "Workbench");
    assert.match(
      JSON.stringify(filtered.topicPage.records[0]),
      /"topicId":"TOPIC-000042"/u,
    );
    const detail = await requestClientModel(
      handle.baseUrl,
      "/topic?id=TOPIC-000042",
    );
    assert.equal(detail.view, "record-detail");
    if (detail.view === "record-detail") {
      assert.equal(detail.record.id, "TOPIC-000042");
      assert.equal(detail.record.relations[0]?.id, "CHG-000010");
      assert.equal(detail.record.relations[0]?.state, "available");
      assert.match(detail.record.document.markdown, /Workbench CRUD/u);
    }
    const change = await requestRaw(handle.baseUrl, "/change?id=CHG-000010");
    assert.equal(change.status, 200);
    assert.match(change.body.toString("utf8"), /data-workbench-react-root/u);
    const changeModel = await requestClientModel(
      handle.baseUrl,
      "/change?id=CHG-000010",
    );
    assert.equal(changeModel.view, "artifact");
    if (changeModel.view === "artifact")
      assert.match(changeModel.artifact.markdown, /Workbench Relation Change/u);
    const missingChange = await requestRaw(
      handle.baseUrl,
      "/api/workbench/view?route=%2Fchange&id=CHG-999999",
    );
    assert.equal(missingChange.status, 404);
    const missingDetail = await requestRaw(
      handle.baseUrl,
      "/api/workbench/view?route=%2Ftopic&id=TOPIC-999999",
    );
    assert.equal(missingDetail.status, 404);
    const update = await requestRaw(
      handle.baseUrl,
      "/api/records",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "update",
        id: "TOPIC-000042",
        expectedRevision: "1",
        markdown: topic(2, "waiting"),
      }).toString(),
    );
    assert.equal(update.status, 303);
    const updated = await requestMainModel(handle.baseUrl);
    assert.equal(updated.topicPage.records[0]?.state, "waiting");
    const conflict = await requestRaw(
      handle.baseUrl,
      "/api/records",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "update",
        id: "TOPIC-000042",
        expectedRevision: "1",
        markdown: topic(3),
      }).toString(),
    );
    assert.equal(conflict.status, 303);
    const conflicted = await requestMainModel(handle.baseUrl);
    assert.equal(
      conflicted.recordActionResult?.reason,
      "record_revision_conflict",
    );
    assert.equal(conflicted.topicPage.records[0]?.revision, 2);
    const promote = await requestRaw(
      handle.baseUrl,
      "/api/records",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "promote-topic",
        id: "TOPIC-000042",
        expectedRevision: "2",
        changeId: "CHG-000010",
        reason: "具体的な変更を採用した",
        remainingResponsibility: "CHG完了後にCloseを判断する",
      }).toString(),
    );
    assert.equal(promote.status, 303);
    const promoted = await requestClientModel(
      handle.baseUrl,
      "/topic?id=TOPIC-000042",
    );
    assert.equal(promoted.view, "record-detail");
    if (promoted.view === "record-detail") {
      assert.equal(promoted.record.document.record.state, "promoted");
      assert.ok(
        promoted.record.relations.some(
          (relation) => relation.id === "CHG-000010",
        ),
      );
    }
    const unconfirmedDelete = await requestRaw(
      handle.baseUrl,
      "/api/records",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "delete",
        id: "TOPIC-000042",
        expectedRevision: "3",
        confirmed: "false",
      }).toString(),
    );
    assert.equal(unconfirmedDelete.status, 303);
    const unconfirmed = await requestMainModel(handle.baseUrl);
    assert.equal(
      unconfirmed.recordActionResult?.reason,
      "record_delete_confirmation_required",
    );
    assert.equal(unconfirmed.topicPage.records[0]?.revision, 3);
    const remove = await requestRaw(
      handle.baseUrl,
      "/api/records",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "delete",
        id: "TOPIC-000042",
        expectedRevision: "3",
        confirmed: "true",
      }).toString(),
    );
    assert.equal(remove.status, 303);
    const deleted = await requestMainModel(handle.baseUrl);
    assert.ok(
      deleted.topicPage.records.every(
        (record) => !("topicId" in record) || record.topicId !== "TOPIC-000042",
      ),
    );
    const topicDirectory = path.join(fixture, "22_Topics");
    const directoryState = await lstat(topicDirectory);
    assert.equal(directoryState.isSymbolicLink(), false);
    assert.equal(directoryState.isDirectory(), true);
    assert.deepEqual(await readdir(topicDirectory), []);
    await rm(topicDirectory, { recursive: true });
    const faultBytes = "owned-storage-fault\n";
    await writeFile(topicDirectory, faultBytes, "utf8");
    for (const invalid of [
      {
        actionToken: "invalid-token",
        kind: "topic",
        operation: "create",
        markdown: topic(1),
      },
      {
        actionToken: token,
        kind: "unknown",
        operation: "create",
        markdown: topic(1),
      },
      {
        actionToken: token,
        kind: "topic",
        operation: "unknown",
        markdown: topic(1),
      },
      {
        actionToken: token,
        kind: "topic",
        operation: "update",
        id: "bad",
        expectedRevision: "1",
        markdown: topic(2),
      },
      {
        actionToken: token,
        kind: "topic",
        operation: "update",
        id: "TOPIC-000042",
        expectedRevision: "0",
        markdown: topic(2),
      },
      {
        actionToken: token,
        kind: "topic",
        operation: "promote-topic",
        id: "TOPIC-000042",
        expectedRevision: "1",
        changeId: "bad",
      },
      {
        actionToken: token,
        kind: "meeting",
        operation: "treat-outcome",
        id: "MTG-000042",
        expectedRevision: "1",
        targetKind: "topic",
        targetReference: "bad",
      },
      {
        actionToken: token,
        kind: "topic",
        operation: "create",
        markdown: "invalid",
      },
      {
        actionToken: token,
        kind: "meeting",
        operation: "create",
        markdown: "invalid",
      },
    ]) {
      const rejected = await requestRaw(
        handle.baseUrl,
        "/api/records",
        "POST",
        new URLSearchParams(invalid).toString(),
      );
      assert.equal(rejected.status, 400);
      assert.equal(
        rejected.body.toString("utf8"),
        "topic_meeting_action_rejected\n",
      );
      assert.equal(await readFile(topicDirectory, "utf8"), faultBytes);
    }
    const failed = await requestRaw(
      handle.baseUrl,
      "/api/records",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "topic",
        operation: "create",
        markdown: topic(1),
      }).toString(),
    );
    assert.equal(failed.status, 500);
    assert.equal(failed.body.toString("utf8"), "topic_meeting_action_failed\n");
    assert.equal(await readFile(topicDirectory, "utf8"), faultBytes);
    const healthy = await requestRaw(
      handle.baseUrl,
      new URL(handle.healthUrl).pathname,
    );
    assert.equal(healthy.status, 200);
    await unlink(topicDirectory);
    const recoveredView = await requestMainModel(handle.baseUrl);
    assert.equal(recoveredView.topicPage.records.length, 0);
  } finally {
    try {
      if (handle !== null) {
        await handle.close();
        const endpoint = new URL(handle.baseUrl);
        await assert.rejects(
          new Promise<void>((_resolve, reject) => {
            const probe = connect({
              host: endpoint.hostname,
              port: Number(endpoint.port),
            });
            probe.once("connect", () => {
              probe.destroy();
              reject(new Error("closed_listener_still_available"));
            });
            probe.once("error", reject);
          }),
          { code: "ECONNREFUSED" },
        );
      }
    } finally {
      await rm(fixture, { recursive: true, force: true });
      await assert.rejects(lstat(fixture), { code: "ENOENT" });
    }
  }
});

/**
 * WorkbenchからMeeting Outcomeを処置してCloseするを検証する。
 *
 * @responsibility WorkbenchからMeeting Outcomeを処置してCloseするを検証するの検証責務を所有する。
 * @trace CPR-IT-010
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus WorkbenchからMeeting Outcomeを処置してCloseするの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-010=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchからMeeting Outcomeを処置してCloseする", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-meeting-"));
  let handle: Awaited<ReturnType<typeof startWorkbench>> | null = null;
  const meeting = `# Workbench Meeting\n\n成果物種別: Meeting\nMeeting ID: \`MTG-000042\`\nProject ID: \`PRJ-001\`\n状態: \`recorded\`\n開催日時: \`2026-09-27 10:00 JST\`\n改訂: \`1\`\n維持責任者: \`PM\`\n\n## 1. 目的と要約\n\n### 結論\n\nWorkbench Outcome処置を確認する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| \`OUT-001\` | Action | 確認する | \`pending\` | PM | 次回 | \`N/A: 未移管\` |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| \`OUT-001\` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | \`OPEN: Outcome処置後に評価する\` |\n| 未処置Outcome | \`OUT-001\` |\n| 訂正元／訂正先 | \`N/A: 訂正ではない\` |\n| 残る影響 | |\n`;
  try {
    await mkdir(path.join(fixture, "04_UI", "assets", "brand"), {
      recursive: true,
    });
    await copyFile(
      path.join(
        repositoryRoot,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
      path.join(
        fixture,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
    );
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
      "utf8",
    );
    git(fixture, "init", "--initial-branch=main");
    handle = await startWorkbench({ workingDirectory: fixture });
    const initial = await requestMainModel(handle.baseUrl);
    const token = initial.actionToken;
    const create = await requestRaw(
      handle.baseUrl,
      "/api/records",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "meeting",
        operation: "create",
        markdown: meeting,
      }).toString(),
    );
    assert.equal(create.status, 303);
    const treat = await requestRaw(
      handle.baseUrl,
      "/api/records",
      "POST",
      new URLSearchParams({
        actionToken: token,
        kind: "meeting",
        operation: "treat-outcome",
        id: "MTG-000042",
        expectedRevision: "1",
        outcomeId: "OUT-001",
        disposition: "completed",
        owner: "PM",
        reviewTrigger: "処置済み",
        targetKind: "none",
        targetReference: "N/A: 完了",
        treatment: "完了",
        completionCondition: "確認済み",
        result: "完了",
        closeMeeting: "true",
      }).toString(),
    );
    assert.equal(treat.status, 303);
    const completed = await requestMainModel(handle.baseUrl);
    assert.equal(
      completed.recordActionResult?.reason,
      "meeting_outcome_treated",
    );
    assert.equal(completed.meetingPage.records[0]?.state, "closed");
    assert.match(
      JSON.stringify(completed.meetingPage.records[0]),
      /"pendingOutcomeCount":0/u,
    );
    const filtered = await requestMainModel(
      handle.baseUrl,
      "/?meetingFrom=2026-09-27&meetingTo=2026-09-27&meetingState=closed&meetingSort=occurred_desc",
    );
    assert.equal(filtered.meetingQuery.occurredFrom, "2026-09-27");
    assert.match(
      JSON.stringify(filtered.meetingPage.records[0]),
      /"meetingId":"MTG-000042"/u,
    );
    const detail = await requestClientModel(
      handle.baseUrl,
      "/meeting?id=MTG-000042",
    );
    assert.equal(detail.view, "record-detail");
    if (
      detail.view === "record-detail" &&
      "pendingOutcomeCount" in detail.record.document.record
    ) {
      assert.equal(detail.record.document.record.pendingOutcomeCount, 0);
      assert.equal(
        detail.record.document.record.occurredAt,
        "2026-09-27 10:00 JST",
      );
    }
  } finally {
    await handle?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * Workbenchの現在Session AI依頼をApplication Portへ搬送することを検証する。
 *
 * @responsibility 作業分類・任意明示選択、Project Context参照、状態観測および意味区分表示の合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition 決定論的なFake AI Request Applicationを注入する。
 * @stimulus 作業分類・任意明示選択と依頼を送信し、完了Snapshotを再取得する。
 * @observation Application入力とBrowserへ返る四区分の結果を観測する。
 * @oracle 固定した完全選定とProject Contextだけが搬送され、外部Textはescapeされ、事実と推論を混同しない。
 * @cleanup Workbench Handleを閉じる。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 */
test("Workbenchの単発依頼は助言四分類とWorkspace編集を分け旧Bundleを公開しない", async () => {
  let received: AiRequestCommand | null = null;
  let calls = 0;
  let closed = false;
  const application: AiRequests = {
    start: async (command) => {
      received = command;
      calls++;
      return { status: "accepted", requestId: "request-test", reason: null };
    },
    observe: async (requestId) => ({
      resultAvailable: true,
      requestId,
      mode: received?.mode ?? "read_only_advice",
      executionSelection: executionSelection("advice"),
      status: "completed",
      reason: null,
      facts: [{ text: "<fact>", references: ["PROJECT_CONTEXT.md#1"] }],
      sharedAnalysis: [
        { text: "共有済み", references: ["PROJECT_CONTEXT.md#2"] },
      ],
      additionalInferences: [
        { text: "追加推論", references: ["PROJECT_CONTEXT.md#3"] },
      ],
      nextOptions: [{ text: "次の一手", references: ["PROJECT_CONTEXT.md#4"] }],
      candidate: null,
    }),
    cancel: async (requestId) => ({
      resultAvailable: false,
      requestId,
      mode: "read_only_advice",
      executionSelection: executionSelection("advice"),
      status: "cancelled",
      reason: "cancelled",
      facts: [],
      sharedAnalysis: [],
      additionalInferences: [],
      nextOptions: [],
      candidate: null,
    }),
    close: async () => {
      closed = true;
    },
  };
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    aiRequests: application,
  });
  try {
    const model = await requestMainModel(handle.baseUrl);
    const token = model.actionToken;
    for (const mode of ["read_only_advice", "workspace_edit"]) {
      const started = await requestRaw(
        handle.baseUrl,
        "/api/ai-request",
        "POST",
        new URLSearchParams({
          actionToken: token,
          operation: "start",
          mode,
          workType: "",
          prompt: "合成依頼",
          allowedPaths:
            mode === "workspace_edit" ? "40_Develop/crdd-server/src" : "",
        }).toString(),
      );
      assert.equal(started.status, 303);
      const result = await requestMainModel(handle.baseUrl);
      assert.equal(result.aiRequest.snapshot?.mode, mode);
      assert.equal(result.aiRequest.snapshot?.candidate, null);
      assert.equal(result.aiRequest.snapshot?.facts[0]?.text, "<fact>");
    }
    assert.equal(calls, 2);
    const legacy = await requestRaw(
      handle.baseUrl,
      "/candidate/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "adopt",
        candidateId: "candidate-old",
        confirmed: "true",
      }).toString(),
    );
    assert.equal(legacy.status, 410);
    const oldMode = await requestRaw(
      handle.baseUrl,
      "/api/ai-request",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "start",
        mode: "change_candidate",
        workType: "",
        prompt: "旧方式は拒否",
        allowedPaths: "source.txt",
      }).toString(),
    );
    assert.equal(oldMode.status, 400);
    assert.equal(calls, 2);
  } finally {
    await handle.close();
  }
  assert.equal(closed, true);
});

/**
 * WorkbenchがCoordinatorの現在投影を独立した実行状況面へ表示することを検証する。
 *
 * @responsibility Objective／Task、判断待ち、Recoveryおよび次処置を未接続や空状態へ畳まない合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition 決定論的なRuntime Activity Applicationを注入する。
 * @stimulus Workbench Shellを取得する。
 * @observation Runtime Activity Panelの状態、件数、判断および次処置を観測する。
 * @oracle 注入した現在投影だけが表示され、Project ContextからRuntime状態を推測しない。
 * @cleanup Workbench Handleを閉じる。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchはOrchestratorの現在投影を実行状況として表示する", async () => {
  const application: WorkbenchActivityReader = Object.freeze({
    observe: async (projectId) =>
      Object.freeze({
        state: "observed" as const,
        reason: "coordinator_state_observed",
        projection: Object.freeze({
          projectId,
          milestoneId: "MILESTONE-000001",
          generation: 3,
          milestoneState: "in_progress",
          objectiveCounts: Object.freeze({ running: 1, completed: 2 }),
          taskCounts: Object.freeze({ queued: 2, running: 1 }),
          objectiveTaskSummaries: Object.freeze([
            Object.freeze({
              objectiveId: "OBJ-000003",
              objectiveState: "running",
              taskCounts: Object.freeze({ queued: 2, running: 1 }),
            }),
          ]),
          workProgress: "in_progress",
          qualityState: "integration_pending",
          humanDecisionRequired: true,
          recoveryRequired: false,
          nextAction: "human_decision",
        }),
        eventState: "observed" as const,
        eventReason: "execution_events_observed",
        events: Object.freeze([
          Object.freeze({
            eventId: `execution-${"a".repeat(64)}`,
            occurredAt: "2026-09-27T23:50:00.000Z",
            objectiveId: "OBJ-000003",
            taskId: "TASK-000004",
            attemptId: "ATTEMPT-000001",
            status: "completed" as const,
            reason: "task_completed",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
          }),
        ]),
        eventContinuation: null,
      }),
  });
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    activityReader: application,
  });
  try {
    const model = await requestMainModel(handle.baseUrl);
    assert.equal(
      model.executionActivity?.projection?.milestoneId,
      "MILESTONE-000001",
    );
    assert.equal(
      model.executionActivity?.projection?.objectiveTaskSummaries[0]
        ?.objectiveId,
      "OBJ-000003",
    );
    assert.equal(
      model.executionActivity?.projection?.nextAction,
      "human_decision",
    );
    assert.equal(
      model.executionActivity?.projection?.humanDecisionRequired,
      true,
    );
    assert.equal(model.executionActivity?.events[0]?.taskId, "TASK-000004");
    assert.equal(model.executionActivity?.events[0]?.reason, "task_completed");
  } finally {
    await handle.close();
  }
});

/**
 * Repository Event StoreをProject限定かつ継続読込で表示できることを検証する。
 *
 * @responsibility Canonical Event Store、Project絞込み、新しい順、Cursorおよび重複なしの境界検証を所有する。
 * @trace ERP-IT-001
 * @precondition 隔離Repositoryへ対象Project 2件と別Project 1件のEventを保存する。
 * @stimulus limit 1で最初と次のPageを観測する。
 * @observation Event順序、Continuation、Project Identityおよび二Page間重複を観測する。
 * @oracle 対象Projectだけを新しい順で返し、Cursor後に同じEventを再掲しない。
 * @cleanup 隔離Repositoryを削除する。
 * @boundary ERP-IT-001=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchはRepository EventをProject限定で継続読込する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(
    path.join(testRoot, "workbench-runtime-events-"),
  );
  try {
    execFileSync("git", ["init", "--quiet", fixture], { windowsHide: true });
    const verified = getRepository(fixture);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") return;
    /**
     * event用の試験入力または観測処理を提供する。
     *
     * @responsibility event用の試験入力または観測処理を提供するの検証責務を所有する。
     * @trace ERP-IT-001
     * @precondition 対象契約を再現できる固定入力と依存を用意する。
     * @stimulus eventの対象操作を実行する。
     * @observation 返却値、状態、Effectおよび終了後条件を観測する。
     * @oracle Test本文のassertionがSummaryの期待条件を満たす。
     * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
     * @boundary ERP-IT-001=Direct Boundary: workbench Test Source→対象契約
     */
    const event = (projectId: string, taskId: string, occurredAt: string) =>
      ({
        executionId: `execution-${projectId}-${taskId}`,
        application: "CRDD",
        operation: "task_attempt",
        startedAt: occurredAt,
        metadata: {
          projectId,
          milestoneId: "milestone-a",
          objectiveId: "objective-a",
          taskId,
          attemptId: `attempt-${taskId}`,
          operationId: "operation-a",
        },
        state: "closed",
        completion: {
          endedAt: occurredAt,
          elapsedMs: {
            state: "not_observed",
            reason: "fixture_duration_not_observed",
          },
          outcome: {
            status: "completed",
            reason: "task_completed",
          },
          diagnostic: {
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
          },
          retention: "standard",
        },
      }) satisfies Parameters<typeof storeFixtureExecution>[1];
    assert.equal(
      storeFixtureExecution(
        verified.capability,
        event(
          "project-a",
          "task-old",
          new Date(Date.now() - 120000).toISOString(),
        ),
      ).status,
      "completed",
    );
    assert.equal(
      storeFixtureExecution(
        verified.capability,
        event(
          "project-a",
          "task-new",
          new Date(Date.now() - 60000).toISOString(),
        ),
      ).status,
      "completed",
    );
    assert.equal(
      storeFixtureExecution(
        verified.capability,
        event("project-b", "task-hidden", new Date().toISOString()),
      ).status,
      "completed",
    );
    execFileSync(
      "git",
      [
        "-C",
        fixture,
        "-c",
        "user.name=Fixture",
        "-c",
        "user.email=fixture@example.invalid",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "Activity fixture",
      ],
      { windowsHide: true },
    );
    const identity = {
      projectId: "project-a",
      repositoryId: "repository.fixture",
    };
    const application = createRepositoryWorkbenchActivityReader(
      fixture,
      identity,
    );
    identity.projectId = "project-b";
    const first = await application.observe("project-a", { limit: 1 });
    assert.equal(first.state, "absent");
    assert.equal(first.eventState, "observed");
    assert.equal(first.events[0]?.taskId, "task-new");
    assert.ok(first.eventContinuation);
    if (first.eventContinuation === null)
      throw new Error("runtime_event_continuation_missing");
    const second = await application.observe("project-a", {
      cursor: first.eventContinuation,
      limit: 1,
    });
    assert.equal(second.events[0]?.taskId, "task-old");
    assert.equal(second.eventContinuation, null);
    assert.notEqual(second.events[0]?.eventId, first.events[0]?.eventId);
    assert.doesNotMatch(JSON.stringify([first, second]), /task-hidden/u);
    const mismatch = await application.observe("project-b");
    assert.equal(mismatch.state, "unknown");
    assert.equal(mismatch.eventState, "unknown");
    assert.equal(mismatch.events.length, 0);
    await assert.rejects(
      application.observe("project-a", { cursor: "invalid" }),
    );
    await assert.rejects(application.observe("project-a", { limit: 51 }));
    await assert.rejects(
      application.observe("project-a", {
        cursor: Buffer.from(
          JSON.stringify([
            "2026-09-28T00:01:00.000Z",
            first.events[0]?.eventId,
          ]),
        ).toString("base64url"),
      }),
    );
    assert.equal(
      fs.existsSync(path.join(fixture, ".crdd", "orchestrator")),
      false,
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * Repository別AI設定と技術カタログを分離して表示することを検証する。
 *
 * @responsibility 同じRepository設定Ownerの現在Snapshotを利用し、技術対応を利用可能性へ昇格しない。
 * @trace RCM-IT-005
 * @precondition 自己生成Repositoryへ五役割の選択設定を保存する。
 * @stimulus 同じRepositoryからWorkbenchを開始しShellを取得する。
 * @observation 設定Identity・役割既定値と技術ModelをRead Modelで観測する。
 * @oracle 保存した設定を表示し、設定だけから認証済み・実行可能と表示しない。
 * @cleanup Workbench Handleと隔離Repositoryを削除する。
 * @boundary RCM-IT-005=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchはRepository別AI設定と技術対応を分離して表示する", async () => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-ai-profile-"));
  let handle: Awaited<ReturnType<typeof startWorkbench>> | null = null;
  try {
    await mkdir(path.join(fixture, "04_UI", "assets", "brand"), {
      recursive: true,
    });
    await copyFile(
      path.join(
        repositoryRoot,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
      path.join(
        fixture,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
    );
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
      "utf8",
    );
    git(fixture, "init", "--initial-branch=main");

    const verified = getRepository(fixture);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") throw Error("fixture_root_invalid");
    await mkdir(path.join(fixture, ".crdd", "config"), { recursive: true });
    const saved = saveRepositoryAiSelection(
      fixture,
      { expectedIdentity: null, config: selectionConfig() },
      () => true,
      getModelCatalog().catalog,
    );
    assert.equal(saved.status, "saved");
    handle = await startWorkbench({ workingDirectory: fixture });
    const model = await requestMainModel(handle.baseUrl);
    assert.ok(model.aiSelection);
    assert.equal(model.aiSelection.selection.status, "available");
    assert.equal(
      model.aiSelection.selection.snapshot?.config.roleDefaults.executor.model,
      "gpt-5.5",
    );
    assert.equal("observations" in model.aiSelection, false);
  } finally {
    await handle?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * WorkbenchからRepository別AI設定をCAS保存する。
 *
 * @responsibility 閉設定・現在Identity・保存不明と応答故障を実HTTP境界で検証する。
 * @trace RCM-IT-005
 * @precondition AI選択設定未作成の自己生成RepositoryからWorkbenchを開始する。
 * @stimulus 初回保存・競合・旧入力・公開後故障・有界の大きな設定を送る。
 * @observation 現在表示、結果理由、内容Identity・読戻しと保存回数を観測する。
 * @oracle 期待Identity一致だけ保存し、競合・旧入力・過大設定は保存0。公開後不明はunknownを保持しfresh GETで現在設定を観測する。
 * @cleanup Workbench Handleと隔離Repositoryを削除する。
 * @boundary RCM-IT-005=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchはRepository別AI設定をCAS保存し不明な出版を再送しない", async (context) => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testRoot, "workbench-ai-admin-"));
  let handle: Awaited<ReturnType<typeof startWorkbench>> | null = null;
  try {
    await mkdir(path.join(fixture, "04_UI", "assets", "brand"), {
      recursive: true,
    });
    await copyFile(
      path.join(
        repositoryRoot,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
      path.join(
        fixture,
        "04_UI",
        "assets",
        "brand",
        "crdd-brand-icon-512x512.jpg",
      ),
    );
    await writeFile(
      path.join(fixture, "PROJECT_CONTEXT.md"),
      await readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
      "utf8",
    );
    git(fixture, "init", "--initial-branch=main");
    handle = await startWorkbench({ workingDirectory: fixture });

    const initial = await requestMainModel(handle.baseUrl);
    assert.equal(initial.aiSelection?.selection.status, "missing");
    assert.equal(initial.aiSelectionManagement.allowed, true);
    const form = new URLSearchParams({
      actionToken: initial.actionToken,
      expectedIdentity: "",
      config: JSON.stringify(selectionConfig()),
    });
    const baseUrl = handle.baseUrl;
    /**
     * 自己生成設定のPOSTを同Originへ送る。
     * @responsibility 通常Form制限と用途限定容量を実HTTPで検証する。
     * @trace RCM-IT-005
     * @precondition 本番Serverと閉じた合成Form。
     * @stimulus 一回だけHTTP POSTする。
     * @observation 終了値と構造化保存結果。
     * @oracle 不正・過大入力で保存しない。
     * @cleanup Server終了とexact Root清掃は親Caseが所有する。
     * @boundary 自己生成設定と本番HTTP。実AIなし。
     */
    const post = (input: URLSearchParams) =>
      requestTransport(baseUrl, "/api/ai-selection", "POST", input.toString(), {
        Origin: baseUrl,
      });
    const invalid = new URLSearchParams(form);
    invalid.set("actionToken", "wrong");
    assert.equal((await post(invalid)).status, 400);
    const info = path.join(fixture, ".git", "info");
    const exclude = path.join(info, "exclude");
    const configDir = path.join(fixture, ".crdd", "config");
    assert.equal(fs.existsSync(configDir), false);
    fs.renameSync(info, `${info}.fixture`);
    try {
      const invalidConfig = new URLSearchParams(form);
      invalidConfig.set("config", "{}");
      const badSettings = JSON.parse(
        (await post(invalidConfig)).body.toString("utf8"),
      );
      assert.equal(badSettings.status, "blocked");
      assert.equal("setupFailure" in badSettings, false);
      const blocked = JSON.parse((await post(form)).body.toString("utf8"));
      assert.equal(blocked.status, "blocked");
      assert.equal(
        blocked.reason,
        "repository_runtime_data_ignore_registration_blocked",
      );
      assert.equal(blocked.setupFailure.effectIssued, false);
      assert.equal(blocked.setupFailure.effectStateUnknown, false);
      assert.equal(blocked.setupFailure.cleanupConfirmed, true);
      assert.equal(blocked.setupFailure.recoveryReference, null);
      assert.equal(fs.existsSync(configDir), false);
    } finally {
      fs.renameSync(`${info}.fixture`, info);
    }
    const publishIgnore = fs.renameSync;
    const readIgnore = fs.openSync;
    const recoveryReference = `repository-local-ignore.${createHash("sha256")
      .update(fs.realpathSync.native(fixture))
      .update("\0")
      .update(".crdd/")
      .digest("hex")}`;
    const ignoreLock = path.join(info, ".crdd-runtime-exclude.lock");
    const unlinkIgnore = fs.unlinkSync;
    const failPublish = context.mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof fs.renameSync>) => {
        if (args[1] === exclude)
          throw new Error("synthetic_ignore_publish_rejected");
        publishIgnore(...args);
      },
    );
    const failCleanup = context.mock.method(
      fs,
      "unlinkSync",
      (...args: Parameters<typeof fs.unlinkSync>) => {
        if (args[0] === ignoreLock)
          throw new Error("synthetic_ignore_cleanup_unconfirmed");
        unlinkIgnore(...args);
      },
    );
    try {
      const outcome = JSON.parse((await post(form)).body.toString("utf8"));
      assert.equal(outcome.status, "unknown");
      assert.equal(outcome.publication, "not_published");
      assert.deepEqual(outcome.setupFailure, {
        status: "blocked",
        reason: "repository_runtime_data_ignore_registration_blocked",
        effectIssued: false,
        effectStateUnknown: false,
        effectConfirmation: "not_issued",
        cleanupConfirmed: false,
        retryAllowed: false,
        recoveryReference,
        repositoryPathReported: false,
      });
      assert.equal(fs.existsSync(configDir), false);
      assert.equal(fs.existsSync(ignoreLock), true);
    } finally {
      failCleanup.mock.restore();
      failPublish.mock.restore();
      if (fs.existsSync(ignoreLock)) fs.unlinkSync(ignoreLock);
    }
    let excludePublished = false;
    let ignoreReadbackFailed = false;
    const publishProbe = context.mock.method(
      fs,
      "renameSync",
      (...args: Parameters<typeof fs.renameSync>) => {
        publishIgnore(...args);
        if (args[1] === exclude) excludePublished = true;
      },
    );
    const readProbe = context.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof fs.openSync>) => {
        if (excludePublished && !ignoreReadbackFailed && args[0] === exclude) {
          // 読戻しの一回だけを失敗させ、応答前の現在認可は観測可能にする。
          ignoreReadbackFailed = true;
          throw Object.assign(
            new Error("synthetic_ignore_readback_unavailable"),
            { code: "EIO" },
          );
        }
        return readIgnore(...args);
      },
    );
    try {
      const unknown = JSON.parse((await post(form)).body.toString("utf8"));
      assert.equal(ignoreReadbackFailed, true);
      assert.equal(unknown.status, "unknown");
      assert.equal(unknown.publication, "not_published");
      assert.deepEqual(unknown.setupFailure, {
        status: "blocked",
        reason: "repository_runtime_data_ignore_registration_blocked",
        effectIssued: true,
        effectStateUnknown: true,
        effectConfirmation: "unknown",
        cleanupConfirmed: true,
        retryAllowed: false,
        recoveryReference,
        repositoryPathReported: false,
      });
      assert.equal(fs.existsSync(configDir), false);
    } finally {
      readProbe.mock.restore();
      publishProbe.mock.restore();
    }
    assert.match(fs.readFileSync(exclude, "utf8"), /^\.crdd\/$/mu);
    const area = path.dirname(configDir);
    const sentinel = path.join(area, "existing.txt");
    fs.mkdirSync(area);
    fs.writeFileSync(sentinel, "preserved");
    const created = await post(form);
    assert.equal(created.status, 200);
    const first = JSON.parse(created.body.toString("utf8"));
    assert.equal(first.status, "saved");
    assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved");
    assert.deepEqual(fs.readdirSync(area).sort(), [
      "config",
      "existing.txt",
      "lock",
    ]);
    assert.deepEqual(fs.readdirSync(path.join(area, "lock")), []);
    const conflict = await post(form);
    assert.equal(JSON.parse(conflict.body.toString("utf8")).status, "conflict");
    const afterCreate = await requestMainModel(handle.baseUrl);
    assert.equal(
      afterCreate.aiSelection?.selection.snapshot?.identity,
      first.snapshot.identity,
    );
    const bad = new URLSearchParams(form);
    bad.set("profileId", "PROFILE-300001");
    assert.equal((await post(bad)).status, 400);
    const originalConfig = selectionConfig();
    const config = {
      ...originalConfig,
      roleDefaults: {
        ...originalConfig.roleDefaults,
        executor: { ...originalConfig.roleDefaults.executor, effort: "low" },
      },
    };
    const next = new URLSearchParams({
      actionToken: initial.actionToken,
      expectedIdentity: first.snapshot.identity,
      config: JSON.stringify(config),
    });
    let publications = 0;
    const rename = fs.renameSync;
    const failure = context.mock.method(
      fs,
      "renameSync",
      (source: fs.PathLike, target: fs.PathLike) => {
        rename(source, target);
        if (
          String(target) ===
          path.join(fixture, ".crdd", "config", "ai-selection.json")
        ) {
          publications++;
          throw Error("synthetic_publication_unconfirmed");
        }
      },
    );
    syncBuiltinESMExports();
    try {
      const unknown = await post(next);
      assert.equal(unknown.status, 200);
      assert.equal(JSON.parse(unknown.body.toString("utf8")).status, "unknown");
      assert.equal(publications, 1);
    } finally {
      failure.mock.restore();
      syncBuiltinESMExports();
    }
    const afterUnknown = await requestMainModel(handle.baseUrl);
    assert.equal(
      afterUnknown.aiSelection?.selection.snapshot?.config.roleDefaults.executor
        .effort,
      "low",
    );
    const verified = getRepository(fixture);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") throw Error("fixture_root_invalid");
    assert.equal(
      readRepositoryAiSelection(fixture, getModelCatalog().catalog).status,
      "available",
    );
    const observed = afterUnknown.aiSelection?.selection.snapshot;
    assert.ok(observed);
    let identity = observed.identity;
    for (const bytes of [24 * 1024, 1024 * 1024, 1024 * 1024 + 1]) {
      const large = structuredClone(selectionConfig());
      large.workTypes.coding = { label: "設定" };
      const baseline = Buffer.byteLength(`${JSON.stringify(large, null, 2)}\n`);
      large.workTypes.coding.label += "x".repeat(bytes - baseline);
      const input = new URLSearchParams({
        actionToken: initial.actionToken,
        expectedIdentity: identity,
        config: JSON.stringify(large),
      });
      const reply = await post(input);
      assert.equal(reply.status, 200);
      const value = JSON.parse(reply.body.toString("utf8"));
      assert.equal(value.status, "saved");
      identity = value.snapshot.identity;
      assert.equal(
        Buffer.byteLength(
          `${JSON.stringify(value.snapshot.config, null, 2)}\n`,
        ),
        bytes,
      );
    }
    const oversized = new URLSearchParams(form);
    oversized.set("config", "x".repeat(3 * 1024 * 1024 + 16 * 1024));
    assert.equal((await post(oversized)).status, 400);
    assert.equal(
      readRepositoryAiSelection(fixture, getModelCatalog().catalog).snapshot
        ?.identity,
      identity,
    );
  } finally {
    await handle?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});

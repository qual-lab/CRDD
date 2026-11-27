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
 * @level IT
 * @scope workbench、localhost、official-logo、route-allowlist、cleanup
 * @boundary ERB-IT-021=Direct Boundary: Repository→Workbench Server→Browser相当Consumer
 * @boundary CPR-IT-010=Workbench操作→Domain保存→改訂・状態・確認結果。
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */

import assert from "node:assert/strict";
import childProcess, { execFileSync } from "node:child_process";
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
import { syncBuiltinESMExports } from "node:module";
import { connect } from "node:net";
import path from "node:path";
import test from "node:test";
import { getModelCatalog } from "@qual-lab/crdd-ai-adapter";
import {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
} from "@qual-lab/crdd-configuration-model";
import {
  getRepository,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "@qual-lab/crdd-version-control";
import { prepareAccessStore } from "../support/access-store.ts";
import type { AccessManagementState } from "../../../access-management/src/storage/types.ts";
import {
  executionSelection,
  selectionConfig,
} from "../../../coordinator/tests/fixtures/ai-selection.ts";
import { storeFixtureExecution } from "../../../coordinator/tests/fixtures/execution-intelligence.ts";
import {
  type AiRequestCommand,
  type AiRequests,
  readProjectViewData,
  startWorkbench,
} from "../../src/app.ts";
import { readRepositoryExecutionActivity } from "../../src/service/execution.ts";
import type { ViewResponse } from "../../src/transport/api-types.ts";
import { startSharedFixture } from "../support/shared-sign-in.ts";
import { requestRaw, requestTransport } from "../support/workbench-http.ts";
import { assertViewResponse } from "../support/workbench-wire.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/** 単体の記録操作が読むManifestを、試験対象として明示して配置する。 @trace CPR-IT-010 */
async function copyRecordFixtureManifest(directory: string): Promise<void> {
  const config = path.join(".crdd", "config");
  const manifest = path.join(config, "repository-manifest.json");
  await mkdir(path.join(directory, config), { recursive: true });
  await copyFile(
    path.join(repositoryRoot, manifest),
    path.join(directory, manifest),
  );
}

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
    `/api/workbench/overview?${parameters.toString()}`,
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
    assert.equal(Object.hasOwn(model, "executionActivity"), false);
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
    const home = await requestMainModel(handle.baseUrl);
    const artifacts = `/api/repositories/${home.projectData.context.repositoryId}/artifacts`;
    const roadmapResource = await requestRaw(
      handle.baseUrl,
      `${artifacts}?path=99_Roadmap%2F01_Roadmap.md`,
    );
    assert.equal(roadmapResource.status, 200);
    const roadmapModel = JSON.parse(roadmapResource.body.toString("utf8"));
    assert.equal(roadmapModel.scope, "single");
    assert.match(roadmapModel.markdown, /^# CRDD Roadmap/mu);

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
    const releaseResource = await requestRaw(
      handle.baseUrl,
      `${artifacts}?path=99_Roadmap%2F03_Releases.md`,
    );
    assert.equal(releaseResource.status, 200);
    const releaseModel = JSON.parse(releaseResource.body.toString("utf8"));
    assert.equal(releaseModel.scope, "single");
    assert.match(releaseModel.markdown, /^# CRDD Releases/mu);

    const arbitraryDocument = await requestRaw(
      handle.baseUrl,
      `${artifacts}?path=package.json`,
    );
    assert.equal(arbitraryDocument.status, 400);

    const traversal = await requestRaw(
      handle.baseUrl,
      `${artifacts}?path=..%2Foutside.md`,
    );
    assert.equal(traversal.status, 400);
    const retired = await requestClientModel(
      handle.baseUrl,
      "/owner-artifact?path=99_Roadmap%2F03_Releases.md",
    );
    assert.equal(retired.view, "main");

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
 * @oracle Workspace不正入力は400、未登録APIはHEADも含め404。二重slash Pathは正常入口へ変化せず、操作を発行しない。
 * @cleanup finallyで所有Serverをjoinし、終了後の接続拒否を確認する。
 * @boundary raw HTTPと現在のURL解釈・操作別Handler。外部AI・Docker・保存は使用しない。
 */
test("Route分割はraw URLを正規化し、未登録APIと既知経路の非対応メソッドを区別する", async () => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  try {
    const model = await requestMainModel(handle.baseUrl);
    const workspacePath = `/api/repositories/${model.projectData.context.repositoryId}/workspaces`;
    for (const requestPath of [
      `/x/..${workspacePath}`,
      `/x/%2e%2e${workspacePath}`,
      `http://workbench.invalid/x/..${workspacePath}`,
    ]) {
      const result = await requestTransport(
        handle.baseUrl,
        requestPath,
        "POST",
        "null",
        { Origin: handle.baseUrl, "Content-Type": "application/json" },
      );
      assert.equal(result.status, 400, requestPath);
      assert.equal(result.body.toString("utf8"), '{"error":"invalid_request"}');
    }
    const current = await requestRaw(
      handle.baseUrl,
      "/x/../api/access?view=current",
    );
    assert.equal(current.status, 404);
    assert.equal(current.body.byteLength, 0);
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
    assert.equal(candidate.status, 405);
    assert.equal(candidate.body.toString("utf8"), "method_not_allowed\n");
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
      assert.equal(trailing.status, 404, operation);
    }
    const normalized = await requestRaw(
      handle.baseUrl,
      `http://synthetic.invalid/x/../api/repositories/${model.projectData.context.repositoryId}/staging`,
      "POST",
    );
    assert.equal(normalized.status, 400);
    assert.equal(
      normalized.body.toString("utf8"),
      "repository_action_rejected\n",
    );
    const retiredRepository = await requestRaw(
      handle.baseUrl,
      "http://synthetic.invalid/x/../api/repository",
      "POST",
    );
    assert.equal(retiredRepository.status, 404);
    const obsolete = await requestRaw(
      handle.baseUrl,
      "http://synthetic.invalid/x/../api/records",
      "POST",
    );
    assert.equal(obsolete.status, 404);
    const retiredSelection = await requestRaw(
      handle.baseUrl,
      "http://synthetic.invalid/x/../api/ai-selection",
      "POST",
    );
    assert.equal(retiredSelection.status, 404);
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
    assert.equal(model.portfolioAvailable, true);
    assert.equal(Object.hasOwn(model, "portfolio"), false);
    const readProjects = async (query: string) => {
      const reply = await requestRaw(handle.baseUrl, `/api/projects?${query}`);
      assert.equal(reply.status, 200);
      return JSON.parse(reply.body.toString("utf8"));
    };
    const page = await readProjects("limit=20");
    assert.equal(page.projects.length, 20);
    assert.notEqual(page.nextCursor, null);
    const next = await readProjects(
      `limit=20&cursor=${encodeURIComponent(page.nextCursor)}`,
    );
    assert.equal(next.projects.length, 2);
    assert.equal(next.nextCursor, null);
    const q = `q=${encodeURIComponent(surface.context.projectId)}&state=partial`;
    const filtered = await readProjects(q);
    assert.deepEqual(
      filtered.projects.map(
        (project: { projectId: string }) => project.projectId,
      ),
      [surface.context.projectId],
    );
    assert.equal(filtered.projects[0]?.state, "partial");
    assert.equal(filtered.projects[0]?.sources.length, 2);
    assert.equal(
      filtered.projects[0]?.sources[1]?.repositoryId,
      "visible-missing-source",
    );
    assert.equal(filtered.projects[0]?.sources[1]?.state, "missing");
    assert.equal(
      Object.hasOwn(filtered.projects[0]?.sources[0], "context"),
      false,
    );
    const mismatchedCursor = Buffer.from(
      JSON.stringify([
        "different-query",
        "partial",
        "",
        surface.context.projectId,
      ]),
      "utf8",
    ).toString("base64url");
    const rejectedCursor = await readProjects(
      `${q}&cursor=${encodeURIComponent(mismatchedCursor)}`,
    );
    assert.equal(rejectedCursor.cursorInvalid, true);
    assert.deepEqual(rejectedCursor.projects, []);
    const detail = await requestRaw(
      handle.baseUrl,
      `/api/projects/${encodeURIComponent(surface.context.projectId)}`,
    );
    assert.equal(detail.status, 200);
    const project = JSON.parse(detail.body.toString("utf8"));
    assert.equal(project.projectId, surface.context.projectId);
    assert.equal(project.sources.length, 2);
    assert.equal(
      project.sources[0]?.context?.scenes[0]?.title,
      "今どうなっているか",
    );
    assert.equal(project.sources[1]?.context, null);
    const oldSelector = await requestClientModel(
      handle.baseUrl,
      `/project?id=${encodeURIComponent(surface.context.projectId)}`,
    );
    assert.equal(oldSelector.view, "main");
    const undisclosed = await requestRaw(
      handle.baseUrl,
      "/api/projects/PRJ-UNDISCLOSED",
    );
    assert.equal(undisclosed.status, 404);
  } finally {
    await handle.close();
  }
});

/**
 * 共有の未認証要求はリポジトリ操作やAI依頼を開始しない。 @trace ARCH-000013
 */
test("共有の未認証要求はリポジトリ操作とAI依頼で管理状態を読まず保存しない", async (t) => {
  const testRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testRoot, { recursive: true });
  const directory = await mkdtemp(path.join(testRoot, "workbench-am-"));
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
  const state: AccessManagementState = {
    contract: "crdd-access-management/state",
    schemaRevision: 4,
    revision: 2,
    operationId: "00000000-0000-4000-8000-000000000001",
    users: [
      { userId: adminId, username: "管理者", role: "administrator" },
      { userId: developerId, username: "開発者", role: "developer" },
    ],
    registeredRepositories: [],
    initialization: {
      stage: "completed",
      attemptId: "00000000-0000-4000-8000-000000000002",
      initialUserId: adminId,
      connection: "account_confirmed",
    },
  };
  const { root, directory: store } = prepareAccessStore(directory);
  const current = path.join(store, "access-management.json");
  await writeFile(current, JSON.stringify(state));
  const before = await readFile(current);
  const initialEntries = (await readdir(store)).sort();
  const rename = fs.renameSync;
  let publications = 0;
  const observed = t.mock.method(
    fs,
    "renameSync",
    (...args: Parameters<typeof rename>) => {
      if (path.resolve(String(args[1])) === current) publications++;
      return rename(...args);
    },
  );
  t.after(() => observed.mock.restore());
  for (const configuration of [{}, { localAccessRoot: root }] as const) {
    const start =
      "localAccessRoot" in configuration ? startSharedFixture : startWorkbench;
    const handle = await start({
      workingDirectory: repositoryRoot,
      ...configuration,
    });
    try {
      const runningEntries = (await readdir(store)).sort();
      const model = await requestClientModel(handle.baseUrl);
      assert.ok("actionToken" in model);
      const headers = {
        Origin: handle.baseUrl,
        "Content-Type": "application/x-www-form-urlencoded",
      };
      const open = fs.openSync;
      let managementReads = 0;
      const stateReads = t.mock.method(
        fs,
        "openSync",
        (...args: Parameters<typeof open>) => {
          if (String(args[0]) === current) managementReads++;
          return open(...args);
        },
      );
      syncBuiltinESMExports();
      try {
        fs.closeSync(fs.openSync(current, "r"));
        assert.equal(managementReads, 1);
        managementReads = 0;
        if ("localAccessRoot" in configuration) {
          const stage = await requestTransport(
            handle.baseUrl,
            "/api/repositories/repository.fixture/staging",
            "POST",
            JSON.stringify({ path: "work.txt" }),
            {
              ...headers,
              "Content-Type": "application/json",
              "X-CRDD-Action-Token": model.actionToken,
            },
          );
          assert.equal(stage.status, 400);
          assert.equal(stage.body.toString(), "repository_action_rejected\n");
          const aiCollection =
            "/api/repositories/repository.fixture/ai-requests";
          const observation = await requestTransport(
            handle.baseUrl,
            `${aiCollection}/retired-ai-request`,
            "GET",
            undefined,
            headers,
          );
          assert.equal(observation.status, 403);
          assert.equal(observation.body.toString(), "ai_request_rejected\n");
          const start = await requestTransport(
            handle.baseUrl,
            aiCollection,
            "POST",
            JSON.stringify({
              requestId: "retired-ai-request",
              mode: "read_only_advice",
              prompt: "合成入力",
            }),
            {
              ...headers,
              "Content-Type": "application/json",
              "X-CRDD-Action-Token": model.actionToken,
            },
          );
          assert.equal(start.status, 403);
          assert.deepEqual(JSON.parse(start.body.toString()), {
            error: "ai_request_rejected",
          });
        }
      } finally {
        stateReads.mock.restore();
        syncBuiltinESMExports();
      }
      assert.equal(managementReads, 0);
      assert.equal(publications, 0);
      assert.deepEqual(await readFile(current), before);
      assert.deepEqual((await readdir(store)).sort(), runningEntries);
    } finally {
      await handle.close();
    }
    assert.deepEqual((await readdir(store)).sort(), initialEntries);
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
test("Token付きRepository操作で選択PathだけをStage・Commit・通常公開する", async (t) => {
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
    const repositoryPath = `/api/repositories/${initial.projectData.context.repositoryId}`;
    const readFiles = (suffix: string, method = "GET") =>
      fetch(`${handle?.baseUrl}${repositoryPath}/worktree${suffix}`, {
        method,
      });
    const dedicatedTree = await readFiles("/tree");
    assert.equal(dedicatedTree.status, 200);
    const tree = await dedicatedTree.json();
    assert.equal(tree.repositoryId, initial.projectData.context.repositoryId);
    assert.equal(tree.kind, "tree");
    assert.ok(
      tree.tree.entries.some(
        (entry: { path: string }) => entry.path === "work.txt",
      ),
    );
    assert.equal(Object.hasOwn(tree, "diff"), false);
    const dedicatedDiff = await readFiles("/diff?path=work.txt");
    assert.equal(dedicatedDiff.status, 200);
    const patch = await dedicatedDiff.json();
    assert.equal(patch.repositoryId, initial.projectData.context.repositoryId);
    assert.equal(patch.kind, "diff");
    assert.equal(patch.diff.path, "work.txt");
    assert.match(patch.diff.workingPatch, /\+changed/u);
    assert.equal(Object.hasOwn(patch, "tree"), false);
    const head = await readFiles("/tree", "HEAD");
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    const methodNotAllowed = await readFiles("/diff", "POST");
    assert.equal(methodNotAllowed.status, 405);
    assert.equal(methodNotAllowed.headers.get("allow"), "GET, HEAD");
    assert.equal(
      (await readFiles("/diff?path=work.txt&path=elsewhere")).status,
      400,
    );
    assert.equal((await readFiles("/tree?directory=..%2Foutside")).status, 503);
    assert.equal(
      (
        await fetch(
          `${handle.baseUrl}/api/repositories/repository.other/worktree/tree`,
        )
      ).status,
      404,
    );
    const manifestPath = path.join(
      fixture,
      ".crdd",
      "config",
      "repository-manifest.json",
    );
    await mkdir(path.dirname(manifestPath), { recursive: true });
    const manifest = {
      schema: "crdd/repository-manifest/v2",
      repositoryId: initial.projectData.context.repositoryId,
      projectId: initial.projectData.context.projectId,
      displayName: "試験リポジトリ",
      repositoryRole: "development",
      capabilities: [],
      contextSurfaces: [],
      externalSendPolicy: null,
    };
    const replaceManifest = (repositoryId: string) =>
      fs.writeFileSync(
        manifestPath,
        JSON.stringify({ ...manifest, repositoryId }),
      );
    replaceManifest("repository.changed");
    assert.equal((await readFiles("/diff?path=work.txt")).status, 404);
    replaceManifest(manifest.repositoryId);
    const originalSpawn = childProcess.spawnSync;
    let changedDuringDiff = false;
    const spawned = t.mock.method(
      childProcess,
      "spawnSync",
      (...args: Parameters<typeof originalSpawn>) => {
        const outcome = originalSpawn(...args);
        if (!changedDuringDiff && args[1]?.includes("--unified=3")) {
          changedDuringDiff = true;
          replaceManifest("repository.changed");
        }
        return outcome;
      },
    );
    syncBuiltinESMExports();
    try {
      const interrupted = await readFiles("/diff?path=work.txt");
      assert.equal(changedDuringDiff, true);
      assert.equal(interrupted.status, 503);
      assert.deepEqual(await interrupted.json(), {
        error: "repository_files_unavailable",
      });
    } finally {
      spawned.mock.restore();
      syncBuiltinESMExports();
      replaceManifest(manifest.repositoryId);
    }
    assert.equal((await readFiles("/diff?path=work.txt")).status, 200);
    const writeGit = (path: string, body: object, actionToken = token) =>
      fetch(`${handle?.baseUrl}${path}`, {
        method: "POST",
        headers: {
          origin: handle?.baseUrl ?? "",
          "content-type": "application/json",
          "x-crdd-action-token": actionToken,
        },
        body: JSON.stringify(body),
      });
    const overview = await requestMainModel(
      handle.baseUrl,
      "/?diffPath=work.txt&treeDirectory=.",
    );
    assert.equal(Object.hasOwn(overview, "worktree"), false);
    assert.ok(
      overview.projectData.repository.changeSet?.workingChanges.includes(
        "work.txt",
      ),
    );
    const rejected = await writeGit(
      `${repositoryPath}/staging`,
      { path: "work.txt" },
      "wrong",
    );
    assert.equal(rejected.status, 400);
    const stagePath = `${repositoryPath}/staging`;
    const stageBody = JSON.stringify({ path: "work.txt" });
    const stageHeaders = {
      Origin: handle.baseUrl,
      "Content-Type": "application/json",
      "X-CRDD-Action-Token": token,
    };
    for (const [label, headers] of [
      ["missing origin", { ...stageHeaders, Origin: [] }],
      [
        "duplicate origin",
        { ...stageHeaders, Origin: [handle.baseUrl, handle.baseUrl] },
      ],
      ["mismatched host", { ...stageHeaders, Host: "wrong.invalid" }],
      [
        "duplicate action token",
        { ...stageHeaders, "X-CRDD-Action-Token": [token, token] },
      ],
      [
        "duplicate media type",
        {
          ...stageHeaders,
          "Content-Type": ["application/json", "application/json"],
        },
      ],
    ] satisfies [string, Record<string, string | string[]>][]) {
      const denial = await requestTransport(
        handle.baseUrl,
        stagePath,
        "POST",
        stageBody,
        { ...headers },
      );
      assert.equal(denial.status, 400, label);
      assert.equal(
        denial.body.toString(),
        "repository_action_rejected\n",
        label,
      );
    }
    assert.equal(git(fixture, "diff", "--cached", "--name-only").trim(), "");
    const wrongRepository = await writeGit(
      "/api/repositories/repo.unknown/staging",
      { path: "work.txt" },
    );
    assert.equal(wrongRepository.status, 400);
    const retired = await writeGit("/api/repository", {
      operation: "prepare",
      path: "work.txt",
    });
    const unlisted = await writeGit("/api/repository-unknown", {
      operation: "prepare",
      path: "work.txt",
    });
    assert.equal(retired.status, unlisted.status);
    assert.equal(await retired.text(), await unlisted.text());

    const staged = await requestTransport(
      handle.baseUrl,
      stagePath,
      "POST",
      stageBody,
      { ...stageHeaders, "Content-Type": "application/json \t; charset=UTF-8" },
    );
    assert.equal(staged.status, 200);
    assert.equal(
      JSON.parse(staged.body.toString()).reason,
      "prepare_completed",
    );
    const afterStage = await requestMainModel(handle.baseUrl);
    assert.deepEqual(
      afterStage.projectData.repository.changeSet?.preparedChanges,
      ["work.txt"],
    );

    const committed = await writeGit(`${repositoryPath}/revisions`, {
      message: "workbench commit",
    });
    assert.equal(committed.status, 200);
    assert.equal((await committed.json()).reason, "revision_created");
    const afterCommit = await requestMainModel(handle.baseUrl);
    assert.equal(Object.hasOwn(afterCommit, "repositoryResult"), false);
    const revisionIdentity = git(fixture, "rev-parse", "HEAD");
    const published = await writeGit(
      `${repositoryPath}/revisions/${revisionIdentity}/publication`,
      {
        destination: "origin",
        branch: "main",
        humanConfirmed: true,
      },
    );
    assert.equal(published.status, 200);
    assert.equal((await published.json()).reason, "publication_confirmed");
    const afterPublication = await requestMainModel(handle.baseUrl);
    assert.equal(Object.hasOwn(afterPublication, "repositoryResult"), false);
    assert.equal(git(remote, "rev-parse", "refs/heads/main"), revisionIdentity);

    await writeFile(
      path.join(fixture, "after-publication.txt"),
      "new\n",
      "utf8",
    );
    await unlink(path.join(fixture, "PROJECT_CONTEXT.md"));
    const completedWithRefreshFailure = await writeGit(
      `${repositoryPath}/staging`,
      { path: "after-publication.txt" },
    );
    assert.equal(completedWithRefreshFailure.status, 200);
    assert.equal(
      (await completedWithRefreshFailure.json()).reason,
      "prepare_completed",
    );
    assert.equal(
      git(fixture, "diff", "--cached", "--name-only"),
      "after-publication.txt",
    );
    const afterRefreshFailure = await requestMainModel(handle.baseUrl);
    assert.equal(Object.hasOwn(afterRefreshFailure, "repositoryResult"), false);
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
test("WorkbenchからTopicを登録・表示・編集・削除する", async (t) => {
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
    `# Workbench Topic\n\n成果物種別: Topic\nTopic ID: \`TOPIC-000042\`\nProject ID: \`qual-lab.crdd\`\n状態: \`${state}\`\n改訂: \`${revision}\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\nWorkbench CRUDを確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| candidate | \`CHG-000010\` | 採用候補 |\n| related | \`TOPIC-999999\` | 欠落Relationの明示 |\n\n## 4. 次の行動\n\n| 行動 | Owner | 期限／再評価契機 | 完了条件 | 状態 |\n|---|---|---|---|---|\n| 確認する | PM | 次回 | 判断する | \`open\` |\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | \`N/A: open／waitingでは未処置\` |\n| 昇格先 | \`N/A: 未昇格\` |\n| 終了理由 | \`N/A: 未終了\` |\n| 残る影響 | \`N/A: 未終了\` |\n`;
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
    await copyRecordFixtureManifest(fixture);
    git(fixture, "init", "--initial-branch=main");
    handle = await startWorkbench({ workingDirectory: fixture });
    const initial = await requestMainModel(handle.baseUrl);
    const base = handle.baseUrl;
    const repository = `/api/repositories/${initial.projectData.context.repositoryId}`;
    const topics = `${repository}/topics`;
    const topicPath = `${topics}/TOPIC-000042`;
    const writeRecord = (
      target: string,
      method: string,
      body: object,
      origin = base,
    ) =>
      requestTransport(base, target, method, JSON.stringify(body), {
        "Content-Type": "application/json",
        Origin: origin,
      });
    const create = await writeRecord(topics, "POST", { markdown: topic(1) });
    assert.equal(create.status, 201);
    const retired = await requestTransport(
      base,
      "/api/records",
      "POST",
      "kind=topic&operation=create",
      { Origin: base },
    );
    assert.equal(retired.status, 404);
    const [created, concurrent] = await Promise.all([
      requestMainModel(base),
      requestMainModel(base),
    ]);
    assert.match(
      JSON.stringify(created.topicPage.records[0]),
      /"topicId":"TOPIC-000042"/u,
    );
    assert.equal(
      created.topicPage.records[0]?.summary,
      "Workbench CRUDを確認する。",
    );
    assert.equal(created.recordDocuments[0]?.id, "TOPIC-000042");
    // 更新印の消費順にかかわらず、同じ保存済み内容を返す。
    const cached = await requestMainModel(base);
    for (const model of [concurrent, cached]) {
      assert.deepEqual(model.projectData.topics, created.projectData.topics);
      assert.deepEqual(model.topicPage, created.topicPage);
      assert.deepEqual(model.recordDocuments, created.recordDocuments);
    }
    const filtered = await requestMainModel(
      handle.baseUrl,
      "/?topicQuery=Workbench&topicState=open&topicOwner=Project%20Operator&topicSort=title_asc",
    );
    assert.equal(filtered.topicQuery.query, "Workbench");
    assert.match(
      JSON.stringify(filtered.topicPage.records[0]),
      /"topicId":"TOPIC-000042"/u,
    );
    const source = path.join(fixture, "22_Topics", "TOPIC-000042", "topic.md");
    const readFileSync = fs.readFileSync;
    let sourceReads = 0;
    const observeSource = t.mock.method(
      fs,
      "readFileSync",
      (...args: Parameters<typeof fs.readFileSync>) => {
        if (args[0] === source) sourceReads++;
        return readFileSync(...args);
      },
    );
    syncBuiltinESMExports();
    const detail = await requestRaw(handle.baseUrl, topicPath).finally(() => {
      observeSource.mock.restore();
      syncBuiltinESMExports();
    });
    assert.equal(sourceReads, 1);
    assert.equal(detail.status, 200);
    const recordDetail = JSON.parse(detail.body.toString("utf8"));
    assert.equal(recordDetail.record.topicId, "TOPIC-000042");
    assert.equal(
      recordDetail.repositoryId,
      created.projectData.context.repositoryId,
    );
    assert.equal(recordDetail.writable, true);
    assert.equal(recordDetail.relations[0]?.id, "CHG-000010");
    assert.equal(recordDetail.relations[0]?.state, "available");
    assert.match(recordDetail.markdown, /Workbench CRUD/u);
    const change = await requestRaw(handle.baseUrl, "/change?id=CHG-000010");
    assert.equal(change.status, 200);
    assert.match(change.body.toString("utf8"), /data-workbench-react-root/u);
    const changes = `/api/repositories/${created.projectData.context.repositoryId}/changes`;
    const changeResource = await requestRaw(
      handle.baseUrl,
      `${changes}/CHG-000010`,
    );
    assert.equal(changeResource.status, 200);
    const changeModel = JSON.parse(changeResource.body.toString("utf8"));
    assert.equal(changeModel.scope, "single");
    assert.match(changeModel.markdown, /Workbench Relation Change/u);
    const missingChange = await requestRaw(
      handle.baseUrl,
      `${changes}/CHG-999999`,
    );
    assert.equal(missingChange.status, 404);
    const missingDetail = await requestRaw(
      handle.baseUrl,
      `${topics}/TOPIC-999999`,
    );
    assert.equal(missingDetail.status, 404);
    const update = await writeRecord(topicPath, "PATCH", {
      expectedRevision: 1,
      markdown: topic(2, "waiting"),
    });
    assert.equal(update.status, 200);
    const updated = await requestMainModel(handle.baseUrl);
    assert.equal(updated.topicPage.records[0]?.state, "waiting");
    const conflict = await writeRecord(topicPath, "PATCH", {
      expectedRevision: 1,
      markdown: topic(3),
    });
    assert.equal(conflict.status, 409);
    assert.equal(
      JSON.parse(conflict.body.toString("utf8")).reason,
      "record_revision_conflict",
    );
    const conflicted = await requestMainModel(handle.baseUrl);
    assert.equal(conflicted.topicPage.records[0]?.revision, 2);
    const promote = await writeRecord(`${topicPath}/promotion`, "POST", {
      expectedRevision: 2,
      changeId: "CHG-000010",
      reason: "具体的な変更を採用した",
      remainingResponsibility: "CHG完了後にCloseを判断する",
    });
    assert.equal(promote.status, 200);
    const promoted = await requestRaw(handle.baseUrl, topicPath);
    assert.equal(promoted.status, 200);
    const promotedRecord = JSON.parse(promoted.body.toString("utf8"));
    assert.equal(promotedRecord.record.state, "promoted");
    assert.ok(
      promotedRecord.relations.some(
        (relation: { id: string }) => relation.id === "CHG-000010",
      ),
    );
    const removal = { expectedRevision: 3, reason: "mistaken_registration" };
    const unconfirmedDelete = await writeRecord(topicPath, "DELETE", {
      ...removal,
      confirmed: false,
    });
    assert.equal(unconfirmedDelete.status, 409);
    assert.equal(
      JSON.parse(unconfirmedDelete.body.toString("utf8")).reason,
      "record_delete_confirmation_required",
    );
    const unconfirmed = await requestMainModel(handle.baseUrl);
    assert.equal(unconfirmed.topicPage.records[0]?.revision, 3);
    const remove = await writeRecord(topicPath, "DELETE", {
      ...removal,
      confirmed: true,
    });
    assert.equal(remove.status, 200);
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
    const foreignOrigin = await writeRecord(
      topics,
      "POST",
      { markdown: topic(1) },
      "http://127.0.0.1:1",
    );
    assert.equal(foreignOrigin.status, 403);
    assert.deepEqual(JSON.parse(foreignOrigin.body.toString("utf8")), {
      error: "request_rejected",
    });
    const invalidRoute = await writeRecord(`${repository}/unknown`, "POST", {
      markdown: topic(1),
    });
    assert.equal(invalidRoute.status, 404);
    for (const [target, method, body] of [
      [topics, "POST", { operation: "unknown", markdown: topic(1) }],
      [`${topics}/bad`, "PATCH", { expectedRevision: 1, markdown: topic(2) }],
      [topicPath, "PATCH", { expectedRevision: 0, markdown: topic(2) }],
      [
        `${topicPath}/promotion`,
        "POST",
        { expectedRevision: 1, changeId: "bad" },
      ],
      [
        `${repository}/meetings/MTG-000042/outcomes/OUT-001/treatment`,
        "PUT",
        {
          expectedRevision: 1,
          targetKind: "topic",
          targetReference: "bad",
        },
      ],
      [topics, "POST", { markdown: "invalid" }],
      [`${repository}/meetings`, "POST", { markdown: "invalid" }],
    ] as const) {
      const rejected = await writeRecord(target, method, body);
      assert.equal(rejected.status, 400, `${method} ${target}`);
      assert.deepEqual(JSON.parse(rejected.body.toString("utf8")), {
        error: "invalid_request",
      });
      assert.equal(await readFile(topicDirectory, "utf8"), faultBytes);
    }
    const failed = await writeRecord(topics, "POST", { markdown: topic(1) });
    assert.equal(failed.status, 503);
    assert.deepEqual(JSON.parse(failed.body.toString("utf8")), {
      error: "record_unavailable",
    });
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
  const meeting = `# Workbench Meeting\n\n成果物種別: Meeting\nMeeting ID: \`MTG-000042\`\nProject ID: \`qual-lab.crdd\`\n状態: \`recorded\`\n開催日時: \`2026-09-27 10:00 JST\`\n改訂: \`1\`\n維持責任者: \`PM\`\n\n## 1. 目的と要約\n\n### 結論\n\nWorkbench Outcome処置を確認する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| \`OUT-001\` | Action | 確認する | \`pending\` | PM | 次回 | \`N/A: 未移管\` |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| \`OUT-001\` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | \`OPEN: Outcome処置後に評価する\` |\n| 未処置Outcome | \`OUT-001\` |\n| 訂正元／訂正先 | \`N/A: 訂正ではない\` |\n| 残る影響 | |\n`;
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
    const meetings = `/api/repositories/${initial.projectData.context.repositoryId}/meetings`;
    await copyRecordFixtureManifest(fixture);
    const headers = {
      "Content-Type": "application/json",
      Origin: handle.baseUrl,
    };
    const create = await requestTransport(
      handle.baseUrl,
      meetings,
      "POST",
      JSON.stringify({ markdown: meeting }),
      headers,
    );
    assert.equal(create.status, 201);
    const treat = await requestTransport(
      handle.baseUrl,
      `${meetings}/MTG-000042/outcomes/OUT-001/treatment`,
      "PUT",
      JSON.stringify({
        expectedRevision: 1,
        disposition: "completed",
        owner: "PM",
        reviewTrigger: "処置済み",
        targetKind: "none",
        targetReference: "N/A: 完了",
        treatment: "完了",
        completionCondition: "確認済み",
        result: "完了",
        closeMeeting: true,
      }),
      headers,
    );
    assert.equal(treat.status, 200);
    assert.equal(
      JSON.parse(treat.body.toString("utf8")).reason,
      "meeting_outcome_treated",
    );
    const completed = await requestMainModel(handle.baseUrl);
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
    const detail = await requestRaw(handle.baseUrl, `${meetings}/MTG-000042`);
    assert.equal(detail.status, 200);
    const meetingDetail = JSON.parse(detail.body.toString("utf8"));
    assert.equal(meetingDetail.record.meetingId, "MTG-000042");
    assert.equal(meetingDetail.record.pendingOutcomeCount, 0);
    assert.equal(meetingDetail.record.occurredAt, "2026-09-27 10:00 JST");
    const manifestPath = path.join(
      fixture,
      ".crdd",
      "config",
      "repository-manifest.json",
    );
    await rm(manifestPath);
    const readOnly = await requestRaw(handle.baseUrl, `${meetings}/MTG-000042`);
    assert.equal(readOnly.status, 200);
    const readOnlyMeeting = JSON.parse(readOnly.body.toString("utf8"));
    assert.deepEqual(readOnlyMeeting.record, meetingDetail.record);
    assert.equal(readOnlyMeeting.writable, false);
    const unavailableList = await requestRaw(handle.baseUrl, meetings);
    assert.equal(unavailableList.status, 404);
    await writeFile(manifestPath, "invalid", "utf8");
    const blocked = await requestRaw(handle.baseUrl, `${meetings}/MTG-000042`);
    assert.equal(blocked.status, 404);
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
  let mismatch = false;
  const application: AiRequests = {
    start: async (command) => {
      received = command;
      calls++;
      return {
        status: "accepted",
        requestId: mismatch ? "unrelated-request" : command.requestId,
        reason: null,
      };
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
    const aiRequestsPath = `/api/repositories/${model.projectData.context.repositoryId}/ai-requests`;
    const headers = {
      Origin: handle.baseUrl,
      "Content-Type": "application/json",
      "X-CRDD-Action-Token": token,
    };
    const rawStart =
      '{"requestId":"fixture-rejected","mode":"read_only_advice","prompt":"fixture"}';
    for (const [body, requestHeaders] of [
      [rawStart, { ...headers, "X-CRDD-Action-Token": "wrong" }],
      [rawStart, { ...headers, Origin: "http://127.0.0.1:1" }],
      [`${rawStart.slice(0, -1)},"repositoryId":"elsewhere"}`, headers],
      [`${rawStart.slice(0, -1)},"prompt":"duplicate"}`, headers],
    ] as const) {
      const rejected = await requestTransport(
        handle.baseUrl,
        aiRequestsPath,
        "POST",
        body,
        requestHeaders,
      );
      assert.equal(rejected.status, 400);
      assert.equal(calls, 0);
    }
    for (const mode of ["read_only_advice", "workspace_edit"]) {
      const started = await requestTransport(
        handle.baseUrl,
        aiRequestsPath,
        "POST",
        JSON.stringify({
          requestId: `fixture-${mode}`,
          mode,
          workType: "",
          prompt: "合成依頼",
          allowedPaths:
            mode === "workspace_edit" ? "40_Develop/crdd-server/src" : "",
        }),
        headers,
      );
      assert.equal(started.status, 201);
      const result = await requestMainModel(handle.baseUrl);
      assert.equal(result.aiRequest.snapshot?.mode, mode);
      assert.equal(result.aiRequest.snapshot?.candidate, null);
      assert.equal(result.aiRequest.snapshot?.facts[0]?.text, "<fact>");
      assert.equal(result.aiRequest.notice, null);
      const refreshed = await requestMainModel(handle.baseUrl);
      assert.equal(refreshed.aiRequest.notice, null);
      assert.equal(refreshed.aiRequest.snapshot?.mode, mode);
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
    assert.equal(legacy.status, 405);
    assert.equal(legacy.body.toString("utf8"), "method_not_allowed\n");
    const oldMode = await requestTransport(
      handle.baseUrl,
      aiRequestsPath,
      "POST",
      JSON.stringify({
        requestId: "fixture-invalid-mode",
        mode: "change_candidate",
        workType: "",
        prompt: "旧方式は拒否",
        allowedPaths: "source.txt",
      }),
      headers,
    );
    assert.equal(oldMode.status, 400);
    assert.equal(calls, 2);
    mismatch = true;
    const inconsistent = await requestTransport(
      handle.baseUrl,
      aiRequestsPath,
      "POST",
      JSON.stringify({
        requestId: "fixture-mismatched-result",
        mode: "read_only_advice",
        prompt: "固定反証",
      }),
      headers,
    );
    assert.equal(inconsistent.status, 503);
    assert.deepEqual(JSON.parse(inconsistent.body.toString("utf8")), {
      error: "ai_request_outcome_unconfirmed",
    });
    assert.equal(
      (await requestMainModel(handle.baseUrl)).aiRequest.snapshot?.requestId,
      "fixture-workspace_edit",
    );
    assert.equal(calls, 3);
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
test("Workbench概要は実行状態を含めず、専用活動APIが対象を確認する", async () => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  try {
    const model = await requestMainModel(handle.baseUrl);
    assert.equal(Object.hasOwn(model, "executionActivity"), false);
    const wrong = await requestRaw(
      handle.baseUrl,
      "/api/repositories/nonexistent.fixture/activity",
    );
    assert.equal(wrong.status, 404);
    const activity = await requestRaw(
      handle.baseUrl,
      `/api/repositories/${model.projectData.context.repositoryId}/activity`,
    );
    assert.equal(activity.status, 200);
    const observed = JSON.parse(activity.body.toString("utf8"));
    assert.equal(observed.projectId, model.projectData.context.projectId);
    assert.deepEqual(
      observed.sources.map(
        (source: { repositoryId: string }) => source.repositoryId,
      ),
      [model.projectData.context.repositoryId],
    );
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
    await copyRecordFixtureManifest(fixture);
    const manifest = path.join(
      fixture,
      ".crdd",
      "config",
      "repository-manifest.json",
    );
    const seed = JSON.parse(await readFile(manifest, "utf8"));
    await writeFile(
      manifest,
      JSON.stringify({
        ...seed,
        projectId: "project-a",
        repositoryId: "repository.fixture",
      }),
      "utf8",
    );
    const readActivity = (
      page: { limit: number; cursor?: string },
      expectedProjectId = "project-a",
    ) =>
      readRepositoryExecutionActivity(
        "repository.fixture",
        page,
        { scope: "local", repositoryRoot: fixture },
        new AbortController().signal,
        expectedProjectId,
      );
    const first = await readActivity({ limit: 1 });
    assert.ok(first);
    assert.equal(first.state, "absent");
    assert.equal(first.eventState, "observed");
    assert.equal(first.events[0]?.taskId, "task-new");
    assert.ok(first.eventContinuation);
    if (first.eventContinuation === null)
      throw new Error("runtime_event_continuation_missing");
    const second = await readActivity({
      cursor: first.eventContinuation,
      limit: 1,
    });
    assert.ok(second);
    assert.equal(second.events[0]?.taskId, "task-old");
    assert.equal(second.eventContinuation, null);
    assert.notEqual(second.events[0]?.eventId, first.events[0]?.eventId);
    assert.doesNotMatch(JSON.stringify([first, second]), /task-hidden/u);
    assert.equal(await readActivity({ limit: 1 }, "project-b"), null);
    await assert.rejects(
      readActivity({ limit: 1, cursor: "invalid" }),
      /runtime_activity_cursor_invalid/u,
    );
    await assert.rejects(
      readActivity({
        limit: 1,
        cursor: Buffer.from(
          JSON.stringify([
            "2026-09-28T00:01:00.000Z",
            first.events[0]?.eventId,
          ]),
        ).toString("base64url"),
      }),
      /runtime_activity_cursor_invalid/u,
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
    const input = { expectedIdentity: null, config: selectionConfig() };
    const baseUrl = handle.baseUrl;
    /**
     * 自己生成設定のPUTを同Originへ送る。
     * @responsibility JSON入力と用途限定容量を実HTTPで検証する。
     * @trace RCM-IT-005
     * @precondition 本番Serverと閉じた合成入力。
     * @stimulus 一回だけHTTP PUTする。
     * @observation 終了値と構造化保存結果。
     * @oracle 不正・過大入力で保存しない。
     * @cleanup Server終了とexact Root清掃は親Caseが所有する。
     * @boundary 自己生成設定と本番HTTP。実AIなし。
     */
    const selectionPath = `/api/repositories/${initial.projectData.context.repositoryId}/ai-selection`;
    const put = (
      input: object | string,
      token = initial.actionToken,
      target = selectionPath,
    ) =>
      requestTransport(
        baseUrl,
        target,
        "PUT",
        typeof input === "string" ? input : JSON.stringify(input),
        {
          Origin: baseUrl,
          "Content-Type": "application/json",
          "X-CRDD-Action-Token": token,
        },
      );
    assert.equal((await put(input, "wrong")).status, 400);
    assert.equal(
      (
        await put(
          input,
          initial.actionToken,
          "/api/repositories/repository.foreign/ai-selection",
        )
      ).status,
      400,
    );
    assert.equal((await requestRaw(baseUrl, "/api/ai-selection")).status, 404);
    const selectionHead = await requestTransport(
      baseUrl,
      selectionPath,
      "HEAD",
    );
    assert.equal(selectionHead.status, 200);
    assert.equal(selectionHead.body.length, 0);
    assert.equal(
      (
        await put(
          '{"expectedIdentity":null,"config":{"revision":1,"revision":1}}',
        )
      ).status,
      400,
    );
    const info = path.join(fixture, ".git", "info");
    const exclude = path.join(info, "exclude");
    const configDir = path.join(fixture, ".crdd", "config");
    assert.equal(fs.existsSync(configDir), false);
    fs.renameSync(info, `${info}.fixture`);
    try {
      const badSettings = JSON.parse(
        (await put({ ...input, config: {} })).body.toString("utf8"),
      );
      assert.equal(badSettings.status, "blocked");
      assert.equal("setupFailure" in badSettings, false);
      const blocked = JSON.parse((await put(input)).body.toString("utf8"));
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
      const outcome = JSON.parse((await put(input)).body.toString("utf8"));
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
      const unknown = JSON.parse((await put(input)).body.toString("utf8"));
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
    const created = await put(input);
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
    const conflict = await put(input);
    assert.equal(conflict.status, 409);
    assert.equal(JSON.parse(conflict.body.toString("utf8")).status, "conflict");
    const afterCreate = await requestMainModel(handle.baseUrl);
    assert.equal(
      afterCreate.aiSelection?.selection.snapshot?.identity,
      first.snapshot.identity,
    );
    assert.equal(
      (await put({ ...input, profileId: "PROFILE-300001" })).status,
      400,
    );
    assert.equal(
      (await put({ ...input, repositoryId: "repository.foreign" })).status,
      400,
    );
    const originalConfig = selectionConfig();
    const config = {
      ...originalConfig,
      roleDefaults: {
        ...originalConfig.roleDefaults,
        executor: { ...originalConfig.roleDefaults.executor, effort: "low" },
      },
    };
    const next = {
      expectedIdentity: first.snapshot.identity,
      config,
    };
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
      const unknown = await put(next);
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
      const reply = await put({ expectedIdentity: identity, config: large });
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
    const oversized = await requestTransport(
      baseUrl,
      selectionPath,
      "PUT",
      undefined,
      {
        Origin: baseUrl,
        "Content-Type": "application/json",
        "Content-Length": String(3 * 1024 * 1024 + 16 * 1024 + 1),
        "X-CRDD-Action-Token": initial.actionToken,
      },
    );
    assert.equal(oversized.status, 413);
    assert.equal(oversized.headers.connection, "close");
    assert.equal(
      readRepositoryAiSelection(fixture, getModelCatalog().catalog).snapshot
        ?.identity,
      identity,
    );
    const startupId = initial.projectData.context.repositoryId;
    const changedId = "repository.changed";
    const contextPath = path.join(fixture, "PROJECT_CONTEXT.md");
    const contextText = await readFile(contextPath, "utf8");
    const changedContext = contextText.replace(
      `Repository ID: \`${startupId}\``,
      `Repository ID: \`${changedId}\``,
    );
    assert.notEqual(changedContext, contextText);
    await copyRecordFixtureManifest(fixture);
    await writeFile(contextPath, changedContext, "utf8");
    const refreshTrigger = await requestTransport(
      baseUrl,
      `/api/repositories/${startupId}/topics`,
      "POST",
      JSON.stringify({
        markdown: `# 試験用の表示更新\n\n成果物種別: Topic\nTopic ID: \`TOPIC-000099\`\nProject ID: \`${initial.projectData.context.projectId}\`\n状態: \`open\`\n改訂: \`1\`\n維持責任者: \`試験担当\`\n\n## 1. 現在の論点\n\n### 結論\n\n起動時の対象識別子を維持する。\n`,
      }),
      { Origin: baseUrl, "Content-Type": "application/json" },
    );
    assert.equal(refreshTrigger.status, 201);
    assert.equal(
      (await requestMainModel(baseUrl)).projectData.context.repositoryId,
      changedId,
    );
    const refused = await put(
      { expectedIdentity: identity, config },
      initial.actionToken,
      `/api/repositories/${changedId}/ai-selection`,
    );
    assert.equal(refused.status, 400);
    assert.equal((await requestRaw(baseUrl, selectionPath)).status, 200);
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

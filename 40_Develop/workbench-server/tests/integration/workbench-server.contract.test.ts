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
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import {
  createServer,
  request as httpRequest,
  ServerResponse,
} from "node:http";
import { connect } from "node:net";
import path from "node:path";
import test from "node:test";
import { createWorkbenchAiVerificationHttpClient } from "../../scripts/ai-verification-http.ts";
import {
  inspectWorkbenchClientModel,
  type WorkbenchClientModel,
} from "../../src/browser/client-model.ts";

import {
  defaultAiProfileCatalog,
  createRepositoryAiProfileCatalogStore,
} from "../../../ai-adapter/src/index.ts";
import {
  createTaskAttemptSettledEvent,
  usageNotObserved,
  verifyExecutionIntelligenceRepositoryRoot,
  writeExecutionIntelligenceEvent,
} from "../../../execution-intelligence/src/index.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  createCredentialMaterial,
  type AccessManagementState,
} from "../../../access-management/src/index.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import {
  readWorkbenchProjectSurface,
  createWorkbenchAiProfileSurface,
  createRepositoryWorkbenchActivityReader,
  startWorkbench,
  type WorkbenchAiRequests,
  type WorkbenchAiRequestCommand,
  type WorkbenchActivityReader,
} from "../../src/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * 廃止した別Host接続入力が単体利用へ暗黙に後退しないことを確認する。
 * @responsibility 現行起動構成の閉集合と外部通信0を検証する。
 * @trace ERB-IT-021
 * @precondition 現行Workbench公開入口とRepository Rootを使用する。
 * @stimulus 廃止済みRemote接続fieldを持つ起動要求を一回渡す。
 * @observation 固定構成拒否とfetch呼出し0を観測する。
 * @oracle Listener起動や単体Repositoryへのfallbackに進まない。
 * @cleanup fetch mockは試験終了時に復元される。生成資源なし。
 * @boundary 起動構成のみ。MCP Server自体の能力を変更しない。
 */
test("廃止したRemote起動構成は外部通信せず拒否する", async (t) => {
  const fetchSpy = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("unexpected_remote_fetch");
  });
  await assert.rejects(
    startWorkbench({
      workingDirectory: repositoryRoot,
      remoteConnection: {
        mcpEndpoint: "http://127.0.0.1:1/mcp",
        token: "fixture",
      },
    } as unknown as Parameters<typeof startWorkbench>[0]),
    {
      message: "workbench_configuration_invalid",
    },
  );
  assert.equal(fetchSpy.mock.callCount(), 0);
});

/**
 * Local CROSの接続専用Modelが未認証内容と秘密fieldを拒否する。
 * @responsibility 仮のMain Modelを使わず、接続と内容選択の境界を検査する。
 * @trace ERB-IT-021
 * @precondition ProductionのClient Model Inspectorを直接使用する。
 * @stimulus 正規未接続・認証済み空集合と、余剰秘密field／未認証内容を入力する。
 * @observation access判別子受理と固定Errorを確認する。
 * @oracle 未認証にPortfolio・資格Snapshotなし、未知fieldは全拒否。
 * @cleanup N/A: 純粋なModel検査だけ。
 * @boundary 接続JSON→CSR Model Inspector。
 */
test("Local CROS Client Modelは接続専用の閉集合と未認証境界を守る", () => {
  const model = {
    contract: "crdd/workbench/client-model/v1",
    view: "access",
    actionToken: "a".repeat(43),
    logoPath: "/assets/crdd-brand-icon.jpg",
    authenticated: false,
    notice: null,
    portfolio: null,
    credentials: { state: "not_configured", snapshot: null },
  };
  assert.equal(inspectWorkbenchClientModel(model).view, "access");
  const empty = { projects: [], retainedAsSourceOfTruth: false };
  assert.equal(
    inspectWorkbenchClientModel({
      ...model,
      authenticated: true,
      portfolio: empty,
    }).view,
    "access",
  );
  for (const value of [
    { ...model, token: "synthetic-secret" },
    { ...model, root: "synthetic-host-root" },
    { ...model, portfolio: empty },
    { ...model, credentials: { state: "available", snapshot: null } },
    { ...model, actionToken: "" },
    { ...model, logoPath: "https://external.invalid/logo" },
    {
      ...model,
      authenticated: true,
      portfolio: { projects: [], retainedAsSourceOfTruth: true },
    },
  ])
    assert.throws(() => inspectWorkbenchClientModel(value), {
      message: "workbench_client_model_invalid",
    });
});

/**
 * Browser JSON境界が不正Discriminantと必須構造欠落を拒否することを検証する。
 *
 * @responsibility TypeScript castだけで不正JSONを成功画面へ通さないことを反証する。
 * @trace ERB-IT-021
 * @precondition Client Model InspectorがProduction入口と同じ実装である。
 * @stimulus 不正contract、未知viewおよびmain必須構造欠落を入力する。
 * @observation 送出される固定Errorを観測する。
 * @oracle 全入力がworkbench_client_model_invalidで拒否される。
 * @cleanup N/A: 外部資源を使用しない。
 * @boundary ERB-IT-021=Direct Boundary: JSON unknown value→Client Model Inspector
 */
test("Workbench Clientは契約不正JSONを描画前に拒否する", () => {
  for (const value of [
    null,
    { contract: "invalid", view: "main" },
    { contract: "crdd/workbench/client-model/v1", view: "unknown" },
    { contract: "crdd/workbench/client-model/v1", view: "main" },
    {
      contract: "crdd/workbench/client-model/v1",
      view: "main",
      actionToken: "action-token",
      logoPath: "/assets/crdd-brand-icon.jpg",
      surface: {},
      connection: {},
      topic: {},
      meeting: {},
      credentials: {},
      aiRequest: {},
    },
    {
      contract: "crdd/workbench/client-model/v1",
      view: "project-detail",
      logoPath: "/assets/crdd-brand-icon.jpg",
      project: { projectId: "PRJ-001", state: "complete", sources: {} },
    },
    {
      contract: "crdd/workbench/client-model/v1",
      view: "record-detail",
      logoPath: "/assets/crdd-brand-icon.jpg",
      actionToken: "action-token",
      repositoryId: null,
      record: {
        kind: "topic",
        id: "TOPIC-000001",
        document: {
          markdown: "# Topic",
          record: {
            topicId: "TOPIC-000001",
            projectId: "PRJ-001",
            state: "unknown",
            revision: 1,
            owner: "Owner",
            title: "Topic",
            summary: "Summary",
          },
        },
        relations: [],
      },
    },
  ])
    assert.throws(
      () => inspectWorkbenchClientModel(value),
      /workbench_client_model_invalid/u,
    );
});

/**
 * WorkbenchへRaw HTTP Requestを送信する。
 *
 * @responsibility 固定Routeと拒否RouteのResponseをURL正規化前のRequest Targetで観測する。
 * @trace ERB-IT-021
 * @trace CPR-IT-012
 * @trace CPR-IT-010
 * @precondition baseUrlが起動済みWorkbenchを指す。
 * @stimulus methodとrequestPathをNode HTTP Clientから送信する。
 * @observation Status、Headerおよび本文bytesを取得する。
 * @oracle 呼出し側が配信・拒否・Security Headerを判定できる。
 * @cleanup Request SocketはResponse完了時に閉じる。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
async function requestTransport(
  baseUrl: string,
  requestPath: string,
  method = "GET",
  body?: string,
  headers: Readonly<Record<string, string>> = {},
): Promise<
  Readonly<{
    status: number;
    headers: NodeJS.Dict<string | string[]>;
    body: Buffer;
  }>
> {
  const url = new URL(baseUrl);
  return await new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        method,
        path: requestPath,
        headers: {
          ...(body === undefined
            ? {}
            : {
                "Content-Type": "application/x-www-form-urlencoded",
                "Content-Length": Buffer.byteLength(body),
              }),
          ...headers,
        },
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.once("end", () =>
          resolve(
            Object.freeze({
              status: incoming.statusCode ?? 0,
              headers: incoming.headers,
              body: Buffer.concat(chunks),
            }),
          ),
        );
      },
    );
    outgoing.once("error", reject);
    outgoing.end(body);
  });
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
 * @oracle HTTP 200のWorkbenchClientModelを返す。
 * @cleanup Request SocketはResponse完了時に閉じる。
 * @boundary ERB-IT-021=Direct Boundary: Browser Route Query→JSON Read Model API
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
async function requestClientModel(
  baseUrl: string,
  requestPath = "/",
): Promise<WorkbenchClientModel> {
  const requested = new URL(requestPath, baseUrl);
  const parameters = new URLSearchParams(requested.search);
  parameters.set(
    "route",
    requested.pathname === "/index.html" ? "/" : requested.pathname,
  );
  const response = await requestTransport(
    baseUrl,
    `/api/workbench-view?${parameters.toString()}`,
  );
  assert.equal(response.status, 200);
  return inspectWorkbenchClientModel(
    JSON.parse(response.body.toString("utf8")),
  );
}

/**
 * Main Workbench JSON契約を取得し、別Viewへの誤配送を拒否する。
 *
 * @responsibility Main View試験へ判別済みのJSON Read Modelだけを渡す。
 * @trace ERB-IT-021
 * @trace CPR-IT-012
 * @trace CPR-IT-010
 * @precondition requestClientModelがWorkbenchClientModelを返す。
 * @stimulus 指定RouteのJSON Read Modelを取得する。
 * @observation view Discriminantを確認する。
 * @oracle main以外を固定Errorで拒否し、main Modelを返す。
 * @cleanup N/A: requestClientModelの資源契約を継承する。
 * @boundary ERB-IT-021=Direct Boundary: WorkbenchClientModel→Main View Model
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
async function requestMainModel(
  baseUrl: string,
  requestPath = "/",
): Promise<Extract<WorkbenchClientModel, { view: "main" }>> {
  const model = await requestClientModel(baseUrl, requestPath);
  assert.equal(model.view, "main");
  if (model.view !== "main") throw new Error("workbench_main_model_required");
  return model;
}

/**
 * HTTP Responseを加工せず取得する。
 *
 * @responsibility Header、Statusおよび生本文を必要とする契約試験へResponseを渡す。
 * @trace ERB-IT-021
 * @trace CPR-IT-012
 * @trace CPR-IT-010
 * @precondition baseUrlが起動済みWorkbenchを指す。
 * @stimulus 指定method、pathおよび任意bodyを送信する。
 * @observation HTTP Responseを変換せず取得する。
 * @oracle 呼出し側が配信Headerと拒否本文を判定できる。
 * @cleanup Request SocketはResponse完了時に閉じる。
 * @boundary ERB-IT-021=Direct Boundary: Raw HTTP Request→Raw HTTP Response
 * @boundary CPR-IT-012=Workbench Form→Local保存先故障→固定HTTP応答。
 */
async function requestRaw(
  baseUrl: string,
  requestPath: string,
  method = "GET",
  body?: string,
): Promise<
  Readonly<{
    status: number;
    headers: NodeJS.Dict<string | string[]>;
    body: Buffer;
  }>
> {
  return await requestTransport(baseUrl, requestPath, method, body);
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
test("Direction A Shellと公式ロゴをloopback限定で配信する", async () => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  try {
    assert.match(handle.baseUrl, /^http:\/\/127\.0\.0\.1:\d+$/u);
    const shell = await requestRaw(handle.baseUrl, "/");
    const model = await requestClientModel(handle.baseUrl);
    assert.equal(model.view, "main");
    if (model.view !== "main") return;
    assert.deepEqual(model.connection, { state: "repository" });
    for (const connection of [
      { ...model.connection, endpoint: "http://127.0.0.1:1/mcp" },
      { ...model.connection, notice: null },
      { state: "cros_unavailable" },
    ])
      assert.throws(() =>
        inspectWorkbenchClientModel({ ...model, connection }),
      );
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
    assert.ok(model.aiProfiles);
    const serializedModel = JSON.stringify(model);
    assert.equal(shell.status, 200);
    assert.match(shell.body.toString("utf8"), /CROS Workbench/u);
    assert.ok(
      model.aiProfiles.catalog.profiles.some(
        (profile) => profile.profileId === "PROFILE-100003",
      ),
    );
    assert.equal(model.logoPath, "/assets/crdd-brand-icon.jpg");
    assert.equal(model.surface.context.repositoryId, "qual-lab.crdd-standard");
    assert.match(serializedModel, /今どうなっているか/u);
    assert.match(serializedModel, /何が危ない、または止まっているか/u);
    assert.notEqual(model.runtimeActivity, undefined);
    assert.equal(model.surface.plan.projection?.targetVersion, "v0.22.0");
    assert.equal(
      model.surface.plan.projection?.targetReleaseDate,
      "2026-10-03",
    );
    assert.match(serializedModel, /Group B/u);
    const ownerSurface = await readWorkbenchProjectSurface(repositoryRoot);
    assert.equal(model.surface.plan.state, "available");
    assert.equal(ownerSurface.plan.state, "available");
    assert.ok(model.surface.plan.projection?.scheduleRisk);
    assert.equal(
      model.surface.plan.projection?.scheduleRisk,
      ownerSurface.plan.projection?.scheduleRisk,
    );
    assert.notEqual(ownerSurface.quality.projection, null);
    assert.equal(
      model.surface.quality.projection?.unobserved,
      ownerSurface.quality.projection?.unobserved,
    );
    assert.equal(
      model.surface.quality.projection?.nextGate,
      ownerSurface.quality.projection?.nextGate,
    );
    assert.ok(model.surface.ownerArtifacts.artifacts.length > 0);

    assert.equal(model.aiProfileAdministration.snapshot?.revision, 0);
    assert.doesNotThrow(() =>
      inspectWorkbenchClientModel(structuredClone(model)),
    );
    for (const invalidRevision of [-1, 0.5]) {
      const invalidCatalogRevision = structuredClone(model) as unknown as {
        aiProfileAdministration: {
          snapshot: { revision: number } | null;
        };
      };
      assert.notEqual(
        invalidCatalogRevision.aiProfileAdministration.snapshot,
        null,
      );
      if (invalidCatalogRevision.aiProfileAdministration.snapshot !== null)
        invalidCatalogRevision.aiProfileAdministration.snapshot.revision =
          invalidRevision;
      assert.throws(
        () => inspectWorkbenchClientModel(invalidCatalogRevision),
        /workbench_client_model_invalid/u,
      );
    }

    const invalidQuality = structuredClone(model) as unknown as {
      surface: {
        quality: {
          projection: { rationale: Record<string, unknown> } | null;
        };
      };
    };
    assert.notEqual(invalidQuality.surface.quality.projection, null);
    if (invalidQuality.surface.quality.projection !== null) {
      invalidQuality.surface.quality.projection.rationale.既知Gap = {
        unsafe: true,
      };
    }
    assert.throws(
      () => inspectWorkbenchClientModel(invalidQuality),
      /workbench_client_model_invalid/u,
    );

    const invalidPlan = structuredClone(model) as unknown as {
      surface: {
        plan: {
          projection: { scope: unknown[] } | null;
        };
      };
    };
    assert.notEqual(invalidPlan.surface.plan.projection, null);
    if (invalidPlan.surface.plan.projection !== null) {
      invalidPlan.surface.plan.projection.scope = [
        { item: { unsafe: true }, disposition: "in_scope", rationale: "x" },
      ];
    }
    assert.throws(
      () => inspectWorkbenchClientModel(invalidPlan),
      /workbench_client_model_invalid/u,
    );

    const invalidPlanReason = structuredClone(model) as unknown as {
      surface: { plan: { reason: unknown } };
    };
    invalidPlanReason.surface.plan.reason = { unsafe: true };
    assert.throws(
      () => inspectWorkbenchClientModel(invalidPlanReason),
      /workbench_client_model_invalid/u,
    );

    for (const invalidSceneKeys of [
      ["current", "risk", "decision", "reason"],
      ["current", "risk", "decision", "reason", "reason"],
      ["risk", "current", "decision", "reason", "next"],
    ]) {
      const invalidScenes = structuredClone(model) as unknown as {
        surface: {
          context: {
            scenes: Array<Record<string, unknown>>;
          };
        };
      };
      invalidScenes.surface.context.scenes = invalidSceneKeys.map(
        (key, index) => ({
          ...invalidScenes.surface.context.scenes[index],
          key,
        }),
      );
      assert.throws(
        () => inspectWorkbenchClientModel(invalidScenes),
        /workbench_client_model_invalid/u,
      );
    }

    const invalidOperationRecord = structuredClone(model) as unknown as {
      topic: { page: { records: unknown[] } };
    };
    invalidOperationRecord.topic.page.records = [
      {
        kind: "meeting",
        topicId: "TOPIC-UNSAFE",
        meetingId: "MTG-000001",
        projectId: "PRJ-001",
        state: "recorded",
        occurredAt: "2026-09-28T00:00:00Z",
        revision: 1,
        owner: "Qual-Lab",
        title: "境界混同",
        summary: "MeetingへTopic Identityを混在させる。",
        pendingOutcomeCount: 0,
      },
    ];
    assert.throws(
      () => inspectWorkbenchClientModel(invalidOperationRecord),
      /workbench_client_model_invalid/u,
    );

    const invalidRecordIdentity = structuredClone(model) as unknown as {
      recordDocuments: unknown[];
    };
    invalidRecordIdentity.recordDocuments = [
      {
        kind: "topic",
        id: "TOPIC-000001",
        document: {
          markdown: "# Topic",
          record: {
            topicId: "TOPIC-000002",
            projectId: "PRJ-001",
            state: "open",
            revision: 1,
            owner: "Qual-Lab",
            title: "Identity不一致",
            summary: "外側と内側のIdentityを変える。",
          },
        },
        relations: [],
      },
    ];
    assert.throws(
      () => inspectWorkbenchClientModel(invalidRecordIdentity),
      /workbench_client_model_invalid/u,
    );

    const invalidFederation = structuredClone(model) as unknown as {
      portfolio: unknown;
    };
    invalidFederation.portfolio = {
      retainedAsSourceOfTruth: false,
      projects: [
        {
          projectId: model.surface.context.projectId,
          state: "complete",
          sources: [
            {
              repositoryId: "missing.repository",
              revision: "1",
              state: "missing",
              repositoryRole: null,
              context: null,
            },
          ],
        },
      ],
    };
    assert.throws(
      () => inspectWorkbenchClientModel(invalidFederation),
      /workbench_client_model_invalid/u,
    );

    const validFederatedProject = {
      retainedAsSourceOfTruth: false,
      projects: [
        {
          projectId: model.surface.context.projectId,
          state: "complete",
          sources: [
            {
              repositoryId: model.surface.context.repositoryId,
              revision: "1",
              state: "complete",
              repositoryRole: model.surface.context.repositoryRole,
              context: model.surface.context,
            },
          ],
        },
      ],
    };
    const mismatchedProjectContext = structuredClone(validFederatedProject);
    const projectContextSource = mismatchedProjectContext.projects
      .at(0)
      ?.sources.at(0);
    assert.ok(projectContextSource);
    projectContextSource.context = {
      ...model.surface.context,
      projectId: "PRJ-OTHER",
    };
    const mismatchedRepositoryContext = structuredClone(validFederatedProject);
    const repositoryContextSource = mismatchedRepositoryContext.projects
      .at(0)
      ?.sources.at(0);
    assert.ok(repositoryContextSource);
    repositoryContextSource.context = {
      ...model.surface.context,
      repositoryId: "other.repository",
    };
    const mismatchedRoleContext = structuredClone(validFederatedProject);
    const roleContextSource = mismatchedRoleContext.projects
      .at(0)
      ?.sources.at(0);
    assert.ok(roleContextSource);
    roleContextSource.repositoryRole = "management";
    const unorderedSources = {
      retainedAsSourceOfTruth: false,
      projects: [
        {
          projectId: model.surface.context.projectId,
          state: "partial",
          sources: [
            {
              repositoryId: "z.repository",
              revision: null,
              state: "missing",
              repositoryRole: null,
              context: null,
            },
            {
              repositoryId: "a.repository",
              revision: null,
              state: "missing",
              repositoryRole: null,
              context: null,
            },
          ],
        },
      ],
    };
    const duplicateSources = structuredClone(unorderedSources);
    const duplicateSource = duplicateSources.projects.at(0)?.sources.at(1);
    assert.ok(duplicateSource);
    duplicateSource.repositoryId = "z.repository";
    const contextOnMissingSource = {
      retainedAsSourceOfTruth: false,
      projects: [
        {
          projectId: model.surface.context.projectId,
          state: "partial",
          sources: [
            {
              repositoryId: model.surface.context.repositoryId,
              revision: "1",
              state: "missing",
              repositoryRole: model.surface.context.repositoryRole,
              context: model.surface.context,
            },
          ],
        },
      ],
    };
    for (const invalidPortfolio of [
      mismatchedProjectContext,
      mismatchedRepositoryContext,
      mismatchedRoleContext,
      unorderedSources,
      duplicateSources,
      contextOnMissingSource,
    ]) {
      const invalidPortfolioModel = structuredClone(model) as unknown as {
        portfolio: unknown;
      };
      invalidPortfolioModel.portfolio = invalidPortfolio;
      assert.throws(
        () => inspectWorkbenchClientModel(invalidPortfolioModel),
        /workbench_client_model_invalid/u,
      );
    }
    for (const sourceState of [
      "missing",
      "unavailable",
      "conflicting",
    ] as const) {
      const partialModel = {
        ...structuredClone(model),
        portfolio: structuredClone(validFederatedProject),
      };
      const project = partialModel.portfolio.projects[0];
      assert.ok(project);
      const source = project.sources[0];
      assert.ok(source);
      Object.assign(source, {
        state: sourceState,
        revision: null,
        context: null,
        repositoryRole: null,
      });
      Object.assign(project, {
        state: sourceState === "conflicting" ? "conflicting" : "partial",
      });
      assert.doesNotThrow(() => inspectWorkbenchClientModel(partialModel));
      for (const field of [
        "revision",
        "context",
        "repositoryRole",
        "state",
      ] as const) {
        const invalid = structuredClone(partialModel);
        const invalidSource = invalid.portfolio?.projects[0]?.sources[0];
        assert.ok(invalidSource);
        Object.assign(invalidSource, {
          [field]: field === "context" ? model.surface.context : "invalid",
        });
        assert.throws(
          () => inspectWorkbenchClientModel(invalid),
          /workbench_client_model_invalid/u,
        );
      }
      Object.assign(project, { state: "complete" });
      assert.throws(
        () => inspectWorkbenchClientModel(partialModel),
        /workbench_client_model_invalid/u,
      );
    }
    const nullComplete = {
      ...structuredClone(model),
      portfolio: structuredClone(validFederatedProject),
    };
    const completeSource = nullComplete.portfolio.projects[0]?.sources[0];
    assert.ok(completeSource);
    Object.assign(completeSource, {
      revision: null,
      context: null,
      repositoryRole: null,
    });
    assert.throws(
      () => inspectWorkbenchClientModel(nullComplete),
      /workbench_client_model_invalid/u,
    );

    const invalidQualityState = structuredClone(model) as unknown as {
      surface: {
        quality: {
          state: string;
          projection: unknown;
          reason: unknown;
        };
      };
    };
    invalidQualityState.surface.quality.state = "unknown";
    invalidQualityState.surface.quality.reason = "observation_failed";
    assert.throws(
      () => inspectWorkbenchClientModel(invalidQualityState),
      /workbench_client_model_invalid/u,
    );

    const invalidOwnerState = structuredClone(model) as unknown as {
      surface: {
        ownerArtifacts: { state: string; reason: unknown };
      };
    };
    invalidOwnerState.surface.ownerArtifacts.state = "unknown";
    invalidOwnerState.surface.ownerArtifacts.reason =
      "owner_artifact_observation_failed";
    assert.throws(
      () => inspectWorkbenchClientModel(invalidOwnerState),
      /workbench_client_model_invalid/u,
    );

    const invalidRepositoryState = structuredClone(model) as unknown as {
      surface: {
        repository: { state: string; reason: unknown };
      };
    };
    invalidRepositoryState.surface.repository.state = "unknown";
    invalidRepositoryState.surface.repository.reason = "observation_failed";
    assert.throws(
      () => inspectWorkbenchClientModel(invalidRepositoryState),
      /workbench_client_model_invalid/u,
    );

    const invalidCollectionState = structuredClone(model) as unknown as {
      surface: {
        topics: { state: string; items: unknown[]; reason: unknown };
      };
    };
    invalidCollectionState.surface.topics = {
      state: "unknown",
      items: [
        {
          topicId: "TOPIC-000001",
          projectId: "PRJ-001",
          state: "open",
          revision: 1,
          owner: "Qual-Lab",
          title: "観測不能",
          summary: "未知状態にPayloadを混在させる。",
        },
      ],
      reason: null,
    };
    assert.throws(
      () => inspectWorkbenchClientModel(invalidCollectionState),
      /workbench_client_model_invalid/u,
    );

    const invalidWorktree = structuredClone(model) as unknown as {
      worktree: { diff: unknown };
    };
    invalidWorktree.worktree.diff = {
      path: { unsafe: true },
      status: "modified",
      staged: false,
      binary: false,
      oldPath: null,
      patch: "diff",
      truncated: false,
      reason: null,
    };
    assert.throws(
      () => inspectWorkbenchClientModel(invalidWorktree),
      /workbench_client_model_invalid/u,
    );

    const invalidRuntime = structuredClone(model) as unknown as {
      runtimeActivity: Record<string, unknown> | null;
    };
    invalidRuntime.runtimeActivity = {
      state: "available",
      reason: "observed",
      eventState: "observed",
      eventReason: "observed",
      eventContinuation: null,
      projection: null,
      events: [
        {
          eventId: "EVT-1",
          occurredAt: "2026-09-28T00:00:00Z",
          objectiveId: "OBJ-1",
          taskId: "TASK-1",
          attemptId: "ATTEMPT-1",
          status: "completed",
          reason: { unsafe: true },
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
        },
      ],
    };
    assert.throws(
      () => inspectWorkbenchClientModel(invalidRuntime),
      /workbench_client_model_invalid/u,
    );

    const runtimeProjection = {
      projectId: "PRJ-001",
      milestoneId: "MILESTONE-1",
      generation: 1,
      milestoneState: "active",
      objectiveCounts: {},
      taskCounts: {},
      objectiveTaskSummaries: [],
      workProgress: "進行中",
      qualityState: "観測済み",
      humanDecisionRequired: false,
      recoveryRequired: false,
      nextAction: "継続",
    };
    const observedWithoutProjection = structuredClone(model) as unknown as {
      runtimeActivity: Record<string, unknown> | null;
    };
    observedWithoutProjection.runtimeActivity = {
      state: "observed",
      reason: "observed",
      projection: null,
      eventState: "observed",
      eventReason: "execution_events_observed",
      events: [],
      eventContinuation: null,
    };
    const absentWithProjection = structuredClone(model) as unknown as {
      runtimeActivity: Record<string, unknown> | null;
    };
    absentWithProjection.runtimeActivity = {
      state: "absent",
      reason: "not_found",
      projection: runtimeProjection,
      eventState: "observed",
      eventReason: "execution_events_observed",
      events: [],
      eventContinuation: null,
    };
    const unknownEventsWithPayload = structuredClone(model) as unknown as {
      runtimeActivity: Record<string, unknown> | null;
    };
    unknownEventsWithPayload.runtimeActivity = {
      state: "unknown",
      reason: "observation_failed",
      projection: null,
      eventState: "unknown",
      eventReason: "observation_failed",
      events: [
        {
          eventId: "EVT-1",
          occurredAt: "2026-09-28T00:00:00Z",
          objectiveId: "OBJ-1",
          taskId: "TASK-1",
          attemptId: "ATTEMPT-1",
          status: "completed",
          reason: "completed",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
        },
      ],
      eventContinuation: "cursor",
    };
    for (const invalidRuntimeCorrelation of [
      observedWithoutProjection,
      absentWithProjection,
      unknownEventsWithPayload,
    ])
      assert.throws(
        () => inspectWorkbenchClientModel(invalidRuntimeCorrelation),
        /workbench_client_model_invalid/u,
      );

    assert.match(shell.body.toString("utf8"), /data-workbench-react-root/u);
    assert.match(
      shell.body.toString("utf8"),
      /<script type="module" src="\/assets\/workbench-client\.js"><\/script>/u,
    );
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

    const css = await requestRaw(handle.baseUrl, "/workbench.css");
    assert.equal(css.status, 200);
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
      assert.equal(filteredDocuments.documentQuery, "Roadmap");
      assert.ok(
        filteredDocuments.surface.ownerArtifacts.artifacts.some(
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
      "/api/workbench-view?route=%2Fowner-artifact&path=package.json",
    );
    assert.equal(arbitraryDocument.status, 400);

    const traversal = await requestRaw(
      handle.baseUrl,
      "/api/workbench-view?route=%2Fowner-artifact&path=..%2Foutside.md",
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
 * Allowlist外Routeを拒否し終了後Listenerを残さないことを検証する。
 *
 * @responsibility Workbenchの公開Path境界とListener cleanupの合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition Workbenchが一時Portで起動済みである。
 * @stimulus 任意Repository PathとTraversalを要求し、Handleを二回閉じる。
 * @observation 拒否Statusとclose後Connection失敗を観測する。
 * @oracle Allowlist外は404で内部Pathを返さず、close後はConnectionを受理しない。
 * @cleanup 冪等closeにより所有ListenerとConnectionを終了する。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 */
test("Allowlist外Routeを拒否し終了後Listenerを残さない", async () => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  const baseUrl = handle.baseUrl;
  for (const forbidden of [
    "/package.json",
    "/../package.json",
    "/04_UI/assets/brand/crdd-brand-icon-512x512.jpg",
  ]) {
    const result = await requestRaw(baseUrl, forbidden);
    assert.equal(result.status, 404, forbidden);
    assert.doesNotMatch(
      result.body.toString("utf8"),
      /C:\\|CRDD|package\.json/u,
    );
  }
  await handle.close();
  await handle.close();
  await assert.rejects(requestRaw(baseUrl, "/"));
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
  const surface = await readWorkbenchProjectSurface(repositoryRoot);
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
      "/api/workbench-view?route=%2Fproject&id=PRJ-UNDISCLOSED",
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
          "/connection-credentials/action",
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
        "/connection-credentials/action",
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
        "/connection-credentials/action",
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
            "/connection-credentials/action",
            "POST",
            new URLSearchParams(invalid).toString(),
          )
        ).status,
        400,
      );
    assert.equal(JSON.parse(await readFile(current, "utf8")).revision, 1);
    const issued = await requestRaw(
      handle.baseUrl,
      "/connection-credentials/action",
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
      "/connection-credentials/action",
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
      "/connection-credentials/action",
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
          "/connection-credentials/action",
          "POST",
          allForm.toString(),
        )
      ).status,
      400,
    );
    allForm.set("confirmed", "true");
    const all = await requestRaw(
      handle.baseUrl,
      "/connection-credentials/action",
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
        "/connection-credentials/action",
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
            "/connection-credentials/action",
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
              "/connection-credentials/action",
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
      diff.surface.repository.changeSet?.workingChanges.includes("work.txt"),
    );
    const invalidTree = await requestMainModel(
      handle.baseUrl,
      "/?treeDirectory=..%2Foutside",
    );
    assert.equal(invalidTree.worktree.state, "unknown");
    const rejected = await requestRaw(
      handle.baseUrl,
      "/repository/action",
      "POST",
      "actionToken=wrong&operation=prepare&path=work.txt",
    );
    assert.equal(rejected.status, 400);

    const staged = await requestRaw(
      handle.baseUrl,
      "/repository/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "prepare",
        path: "work.txt",
      }).toString(),
    );
    assert.equal(staged.status, 303);
    const afterStage = await requestMainModel(handle.baseUrl);
    assert.deepEqual(afterStage.surface.repository.changeSet?.preparedChanges, [
      "work.txt",
    ]);

    const committed = await requestRaw(
      handle.baseUrl,
      "/repository/action",
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
      "/repository/action",
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
      "/repository/action",
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
    assert.equal(afterRefreshFailure.surface.repository.state, "unknown");
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
      "/topic-meeting/action",
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
      JSON.stringify(created.topic.page.records[0]),
      /"topicId":"TOPIC-000042"/u,
    );
    assert.equal(
      created.topic.page.records[0]?.summary,
      "Workbench CRUDを確認する。",
    );
    assert.equal(created.recordDocuments[0]?.id, "TOPIC-000042");
    const filtered = await requestMainModel(
      handle.baseUrl,
      "/?topicQuery=Workbench&topicState=open&topicOwner=Project%20Operator&topicSort=title_asc",
    );
    assert.equal(filtered.topic.query.query, "Workbench");
    assert.match(
      JSON.stringify(filtered.topic.page.records[0]),
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
      "/api/workbench-view?route=%2Fchange&id=CHG-999999",
    );
    assert.equal(missingChange.status, 404);
    const missingDetail = await requestRaw(
      handle.baseUrl,
      "/api/workbench-view?route=%2Ftopic&id=TOPIC-999999",
    );
    assert.equal(missingDetail.status, 404);
    const update = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
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
    assert.equal(updated.topic.page.records[0]?.state, "waiting");
    const conflict = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
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
      conflicted.topicMeetingResult?.reason,
      "record_revision_conflict",
    );
    assert.equal(conflicted.topic.page.records[0]?.revision, 2);
    const promote = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
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
      "/topic-meeting/action",
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
      unconfirmed.topicMeetingResult?.reason,
      "record_delete_confirmation_required",
    );
    assert.equal(unconfirmed.topic.page.records[0]?.revision, 3);
    const remove = await requestRaw(
      handle.baseUrl,
      "/topic-meeting/action",
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
      deleted.topic.page.records.every(
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
        "/topic-meeting/action",
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
      "/topic-meeting/action",
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
    assert.equal(recoveredView.topic.page.records.length, 0);
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
 * 公開HTTPの受付後故障と受信期限を有限な反証集合で検証する。
 *
 * @responsibility POST再送0、受付不明と再観測ID、所有HTTP接続の終了を判定する。
 * @trace ERB-IT-021
 * @precondition 実Workbenchから得た公開モデルを故障注入Serverの応答形式に使う。
 * @stimulus 受付後切断、不正redirect、不正モデル、400、上限超過と期限超過を注入する。
 * @observation POST件数、Errorの固定診断、再観測ID、取消と終了時間を読む。
 * @oracle 受付済みを未実行と断定せず、再送せず、観測可能な同じIDへ戻る。
 * @cleanup 所有HTTP ServerとConnectionをfinallyで終了する。
 * @boundary ERB-IT-021=検証HTTP接続部→故障注入HTTP Server。実Provider回収の証明ではない。
 */
test("実Provider検証HTTPの受付後故障は再送せず不明結果と同じIDを保持する", async (context) => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  let initial: Awaited<ReturnType<typeof requestMainModel>>;
  try {
    initial = await requestMainModel(handle.baseUrl);
  } finally {
    await handle.close();
  }
  for (const fault of [
    "cut",
    "location",
    "model-invalid",
    "model-unavailable",
    "internal-400",
    "body-limit",
    "body-incomplete",
    "header-timeout",
    "body-disconnect",
  ] as const) {
    await context.test(fault, async () => {
      let starts = 0;
      let cancels = 0;
      let afterStartReads = 0;
      let cancelled = false;
      const server = createServer((request, response) => {
        if (request.method === "GET") {
          if (starts > 0) afterStartReads += 1;
          if (starts > 0 && fault === "model-unavailable") {
            response.writeHead(503).end();
            return;
          }
          if (
            starts > 0 &&
            afterStartReads === 1 &&
            fault === "model-invalid"
          ) {
            response.writeHead(200).end("{}");
            return;
          }
          const model = {
            ...initial,
            aiRequest: {
              ...initial.aiRequest,
              snapshot:
                starts > 0
                  ? {
                      requestId: "AIREQ-FAULT-001",
                      mode: "read_only_advice",
                      profileId: "PROFILE-100001",
                      status: cancelled ? "cancelled" : "running",
                      reason: null,
                      facts: [],
                      sharedAnalysis: [],
                      additionalInferences: [],
                      nextOptions: [],
                      candidate: null,
                    }
                  : null,
            },
          };
          response
            .writeHead(200, { "Content-Type": "application/json" })
            .end(JSON.stringify(model));
          return;
        }
        let body = "";
        request.on("data", (chunk: Buffer) => {
          body += chunk.toString("utf8");
        });
        request.once("end", () => {
          const form = new URLSearchParams(body);
          assert.equal(form.get("actionToken"), initial.actionToken);
          if (form.get("operation") === "cancel") {
            cancels += 1;
            cancelled = true;
            assert.equal(form.get("requestId"), "AIREQ-FAULT-001");
            response.writeHead(303, { Location: "/#ai-request" }).end();
            return;
          }
          starts += 1;
          if (fault === "cut") {
            response.destroy();
            return;
          }
          if (fault === "internal-400") {
            response.writeHead(400).end();
            return;
          }
          if (fault === "header-timeout") return;
          response.writeHead(303, {
            Location: fault === "location" ? "/unexpected" : "/#ai-request",
          });
          if (fault === "body-limit") {
            response.end(Buffer.alloc(1024 * 1024 + 1, 65));
            return;
          }
          if (fault === "body-incomplete") {
            response.write("partial");
            return;
          }
          if (fault === "body-disconnect") {
            response.write("partial");
            setImmediate(() => response.destroy());
            return;
          }
          response.end();
        });
      });
      await new Promise<void>((resolve) =>
        server.listen(0, "127.0.0.1", resolve),
      );
      const address = server.address();
      assert.ok(address !== null && typeof address === "object");
      const baseUrl = `http://127.0.0.1:${address.port}`;
      try {
        const application =
          await createWorkbenchAiVerificationHttpClient(baseUrl);
        const begunAt = Date.now();
        let diagnostic: unknown;
        try {
          await application.start({
            mode: "read_only_advice",
            profileId: "PROFILE-100001",
            prompt: "固定故障検証",
            contextReferences: ["PROJECT_CONTEXT.md"],
            allowedPaths: [],
            externalSendConfirmed: true,
            workspaceId: null,
          });
          assert.fail("受付故障を成功へ畳んだ");
        } catch (error) {
          assert.ok(error instanceof Error);
          assert.equal(
            error.message,
            "workbench_ai_http_start_outcome_unknown",
          );
          diagnostic = error.cause;
        }
        assert.ok(
          Date.now() - begunAt < 19_000,
          "HTTP期限と清掃待機が有限である",
        );
        assert.equal(starts, 1);
        assert.ok(
          diagnostic !== null &&
            typeof diagnostic === "object" &&
            "requestId" in diagnostic,
        );
        if (
          [
            "body-limit",
            "body-incomplete",
            "body-disconnect",
            "header-timeout",
          ].includes(fault)
        ) {
          assert.ok("transportCause" in diagnostic);
          const cause = diagnostic.transportCause;
          assert.ok(
            cause !== null &&
              typeof cause === "object" &&
              "failureClass" in cause,
          );
          assert.equal(
            cause.failureClass,
            fault === "body-limit"
              ? "body_limit"
              : fault === "header-timeout"
                ? "headers_unobserved"
                : "read_failed",
          );
          if (fault === "header-timeout") {
            assert.ok("timedOut" in cause);
            assert.equal(cause.timedOut, true);
          }
        }
        assert.equal(
          diagnostic.requestId,
          fault === "model-unavailable" ? null : "AIREQ-FAULT-001",
        );
        if (fault !== "model-unavailable") {
          const result = await application.cancel("AIREQ-FAULT-001");
          assert.equal(result.status, "cancelled");
          assert.equal(cancels, 1);
        } else assert.equal(cancels, 0);
        assert.equal(starts, 1);
      } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
      }
      await assert.rejects(requestRaw(baseUrl, "/"));
    });
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
      "/topic-meeting/action",
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
      "/topic-meeting/action",
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
      completed.topicMeetingResult?.reason,
      "meeting_outcome_treated",
    );
    assert.equal(completed.meeting.page.records[0]?.state, "closed");
    assert.match(
      JSON.stringify(completed.meeting.page.records[0]),
      /"pendingOutcomeCount":0/u,
    );
    const filtered = await requestMainModel(
      handle.baseUrl,
      "/?meetingFrom=2026-09-27&meetingTo=2026-09-27&meetingState=closed&meetingSort=occurred_desc",
    );
    assert.equal(filtered.meeting.query.occurredFrom, "2026-09-27");
    assert.match(
      JSON.stringify(filtered.meeting.page.records[0]),
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
 * @responsibility Profile選択、Project Context参照、状態観測および意味区分表示の合否判定を所有する。
 * @trace ERB-IT-021
 * @precondition 決定論的なFake AI Request Applicationを注入する。
 * @stimulus Profileと依頼を送信し、完了Snapshotを再取得する。
 * @observation Application入力とBrowserへ返る四区分の結果を観測する。
 * @oracle 固定ProfileとProject Contextだけが搬送され、外部Textはescapeされ、事実と推論を混同しない。
 * @cleanup Workbench Handleを閉じる。
 * @boundary ERB-IT-021=Direct Boundary: workbench Test Source→対象契約
 */
test("Workbenchの単発依頼は助言四分類とWorkspace編集を分け旧Bundleを公開しない", async () => {
  let received: WorkbenchAiRequestCommand | null = null;
  let calls = 0;
  let closed = false;
  const application: WorkbenchAiRequests = {
    start: async (command) => {
      received = command;
      calls++;
      return { status: "accepted", requestId: "request-test", reason: null };
    },
    observe: async (requestId) => ({
      requestId,
      mode: received?.mode ?? "read_only_advice",
      profileId: received?.profileId ?? "PROFILE-100001",
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
      requestId,
      mode: "read_only_advice",
      profileId: "PROFILE-100001",
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
        "/ai-request/action",
        "POST",
        new URLSearchParams({
          actionToken: token,
          operation: "start",
          mode,
          profileId: "PROFILE-100001",
          prompt: "合成依頼",
          allowedPaths:
            mode === "workspace_edit" ? "40_Develop/workbench-server/src" : "",
          externalSendConfirmed: "yes",
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
      "/ai-request/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "start",
        mode: "change_candidate",
        profileId: "PROFILE-100001",
        prompt: "旧方式は拒否",
        allowedPaths: "source.txt",
        externalSendConfirmed: "yes",
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
 * WorkbenchがOrchestratorの現在投影を独立した実行状況面へ表示することを検証する。
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
        reason: "orchestrator_state_observed",
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
      model.runtimeActivity?.projection?.milestoneId,
      "MILESTONE-000001",
    );
    assert.equal(
      model.runtimeActivity?.projection?.objectiveTaskSummaries[0]?.objectiveId,
      "OBJ-000003",
    );
    assert.equal(
      model.runtimeActivity?.projection?.nextAction,
      "human_decision",
    );
    assert.equal(
      model.runtimeActivity?.projection?.humanDecisionRequired,
      true,
    );
    assert.equal(model.runtimeActivity?.events[0]?.taskId, "TASK-000004");
    assert.equal(model.runtimeActivity?.events[0]?.reason, "task_completed");
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
    const verified = verifyExecutionIntelligenceRepositoryRoot(fixture);
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
      createTaskAttemptSettledEvent({
        occurredAt,
        identity: {
          projectId,
          milestoneId: "milestone-a",
          objectiveId: "objective-a",
          taskId,
          attemptId: `attempt-${taskId}`,
          operationId: "operation-a",
        },
        execution: {
          role: "executor",
          provider: { state: "not_observed", reason: "provider_not_reported" },
          model: { state: "not_observed", reason: "model_not_reported" },
          inputStrategyRef: {
            state: "observed",
            value: "test/input/v1",
            source: "integration_fixture",
          },
          durationMs: {
            state: "observed",
            value: 10,
            source: "integration_clock",
          },
          usage: usageNotObserved("usage_not_reported"),
          humanActiveMs: {
            state: "not_observed",
            reason: "human_time_not_reported",
          },
        },
        outcome: {
          status: "completed",
          reason: "task_completed",
          effectState: "settled",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
        },
        quality: {
          state: "not_applicable",
          reason: "attempt_settlement_is_not_acceptance",
        },
      });
    assert.equal(
      writeExecutionIntelligenceEvent(
        verified.root,
        event("project-a", "task-old", "2026-09-28T00:00:00.000Z"),
      ).status,
      "completed",
    );
    assert.equal(
      writeExecutionIntelligenceEvent(
        verified.root,
        event("project-a", "task-new", "2026-09-28T00:01:00.000Z"),
      ).status,
      "completed",
    );
    assert.equal(
      writeExecutionIntelligenceEvent(
        verified.root,
        event("project-b", "task-hidden", "2026-09-28T00:02:00.000Z"),
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
 * Repository Ownerが採用したAI Profile CatalogをWorkbenchが表示することを検証する。
 *
 * @responsibility 既定Catalog固定ではなく、同じRepository設定Ownerの現在Snapshotを利用することを反証する。
 * @trace RCM-IT-005
 * @precondition 隔離Repositoryへ追加ProfileをRevision 1として採用する。
 * @stimulus 同じRepositoryからWorkbenchを開始しShellを取得する。
 * @observation 追加Profile IDとModelをBrowser表示で観測する。
 * @oracle 採用済みPROFILE-300001を表示し、設定だけから実行可能と表示しない。
 * @cleanup Workbench Handleと隔離Repositoryを削除する。
 * @boundary RCM-IT-005=Direct Boundary: workbench Test Source→対象契約
 */
test("WorkbenchはRepository Ownerの採用済みAI Profile Catalogを表示する", async () => {
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
    const adapter = createRepositoryAiProfileCatalogStore(fixture);
    assert.equal(adapter.status, "ready");
    assert.ok(adapter.store);
    const adoption = adapter.store.adopt({
      expectedRevision: 0,
      candidate: {
        ...defaultAiProfileCatalog,
        profiles: [
          ...defaultAiProfileCatalog.profiles,
          {
            profileId: "PROFILE-300001",
            adapterId: "codex-cli",
            family: "astra",
            exactModelId: "gpt-6-astra",
            selectionRoles: ["executor"],
            modelTiers: ["preferred"],
            speedMode: "normal",
            billingMode: "subscription_oauth",
            defaultReasoningEffort: "high",
            compatibilityReason: null,
          },
        ],
      },
    });
    assert.equal(adoption.status, "adopted");

    handle = await startWorkbench({ workingDirectory: fixture });
    const model = await requestMainModel(handle.baseUrl);
    assert.ok(model.aiProfiles);
    const profile = model.aiProfiles.catalog.profiles.find(
      (entry) => entry.profileId === "PROFILE-300001",
    );
    assert.equal(profile?.exactModelId, "gpt-6-astra");
    assert.equal(
      model.aiProfiles.observations.find(
        (entry) => entry.profileId === "PROFILE-300001",
      )?.availability.hostAvailable,
      null,
    );
  } finally {
    await handle?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * WorkbenchからRepository OwnerのAI Profileを限定管理する。
 *
 * @responsibility 登録Adapter／Modelだけの作成と確認付き削除をBrowser直接境界で検証する。
 * @trace RCM-IT-005
 * @precondition AI Profile Catalog未作成の隔離RepositoryからWorkbenchを開始する。
 * @stimulus Profileを作成し、未確認削除と確認済み削除を順に送信する。
 * @observation Browser表示、結果理由、Revisionおよび耐久Snapshotを観測する。
 * @oracle 通常の作成・確認済み削除を反映し、未確認削除はEffect 0。公開後不明は503後のGETを壊さず、表示注入時は無関係なStoreを読まない。
 * @cleanup Workbench Handleと隔離Repositoryを削除する。
 * @boundary RCM-IT-005=Direct Boundary: workbench Test Source→対象契約
 */
test("Workbenchは登録済みAdapterだけでAI Profileを作成し確認付きで削除する", async (context) => {
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
    const token = initial.actionToken;
    assert.equal(initial.aiProfileAdministration.owner, "Repository");

    const createForm = new URLSearchParams({
      actionToken: token,
      operation: "create",
      expectedRevision: "0",
      profileId: "PROFILE-300001",
      adapterModel: "codex-cli|gpt-6-astra",
      family: "astra",
      defaultReasoningEffort: "high",
      compatibilityReason: "",
    });
    createForm.append("selectionRole", "executor");
    createForm.append("modelTier", "preferred");
    const created = await requestRaw(
      handle.baseUrl,
      "/ai-profiles/action",
      "POST",
      createForm.toString(),
    );
    assert.equal(created.status, 303);
    const afterCreate = await requestMainModel(handle.baseUrl);
    assert.equal(
      afterCreate.aiProfileAdministration.result?.reason,
      "profile_created",
    );
    assert.equal(afterCreate.aiProfileAdministration.snapshot?.revision, 1);
    assert.equal(
      afterCreate.aiProfileAdministration.result?.snapshot.revision,
      1,
    );
    for (const invalidRevision of [-1, 0.5]) {
      const invalidResultRevision = structuredClone(afterCreate) as unknown as {
        aiProfileAdministration: {
          result: { snapshot: { revision: number } } | null;
        };
      };
      assert.notEqual(
        invalidResultRevision.aiProfileAdministration.result,
        null,
      );
      if (invalidResultRevision.aiProfileAdministration.result !== null)
        invalidResultRevision.aiProfileAdministration.result.snapshot.revision =
          invalidRevision;
      assert.throws(
        () => inspectWorkbenchClientModel(invalidResultRevision),
        /workbench_client_model_invalid/u,
      );
    }
    assert.ok(
      afterCreate.aiProfiles?.catalog.profiles.some(
        (profile) => profile.profileId === "PROFILE-300001",
      ),
    );

    const unconfirmed = await requestRaw(
      handle.baseUrl,
      "/ai-profiles/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "delete",
        expectedRevision: "1",
        profileId: "PROFILE-300001",
      }).toString(),
    );
    assert.equal(unconfirmed.status, 303);
    const afterUnconfirmed = await requestMainModel(handle.baseUrl);
    assert.equal(
      afterUnconfirmed.aiProfileAdministration.result?.reason,
      "profile_delete_confirmation_required",
    );
    assert.ok(
      afterUnconfirmed.aiProfiles?.catalog.profiles.some(
        (profile) => profile.profileId === "PROFILE-300001",
      ),
    );

    const confirmed = await requestRaw(
      handle.baseUrl,
      "/ai-profiles/action",
      "POST",
      new URLSearchParams({
        actionToken: token,
        operation: "delete",
        expectedRevision: "1",
        profileId: "PROFILE-300001",
        confirmed: "true",
      }).toString(),
    );
    assert.equal(confirmed.status, 303);
    const afterDelete = await requestMainModel(handle.baseUrl);
    assert.equal(
      afterDelete.aiProfileAdministration.result?.reason,
      "profile_deleted",
    );
    assert.equal(afterDelete.aiProfileAdministration.snapshot?.revision, 2);
    // 公開直後の故障は503。次のGETへunknownを残さず、実Snapshotを再観測する。
    let publications = 0;
    const originalLink = fs.linkSync;
    const failure = context.mock.method(
      fs,
      "linkSync",
      (source: fs.PathLike, target: fs.PathLike) => {
        originalLink(source, target);
        publications++;
        throw new Error("synthetic-publication-unconfirmed");
      },
    );
    syncBuiltinESMExports();
    try {
      const uncertainForm = new URLSearchParams(createForm);
      uncertainForm.set("expectedRevision", "2");
      const uncertain = await requestRaw(
        handle.baseUrl,
        "/ai-profiles/action",
        "POST",
        uncertainForm.toString(),
      );
      assert.equal(uncertain.status, 503);
      assert.equal(publications, 1);
    } finally {
      failure.mock.restore();
      syncBuiltinESMExports();
    }
    const afterUnknown = await requestMainModel(handle.baseUrl);
    assert.equal(afterUnknown.aiProfileAdministration.result, null);
    assert.equal(afterUnknown.aiProfileAdministration.snapshot?.revision, 3);
    assert.equal(publications, 1);
    const reopened = createRepositoryAiProfileCatalogStore(fixture);
    assert.equal(reopened.status, "ready");
    assert.ok(reopened.store);
    assert.equal(
      reopened.store
        .snapshot()
        .value?.catalog.profiles.some(
          (profile) => profile.profileId === "PROFILE-300001",
        ),
      true,
    );
    await handle.close();
    handle = null;
    let reads = 0;
    const originalRead = fs.readdirSync;
    const readFailure = context.mock.method(
      fs,
      "readdirSync",
      new Proxy(originalRead, {
        apply(target, receiver, args) {
          if (
            args[0] ===
            path.join(fixture, ".crdd", "config", "ai-profile-catalog")
          ) {
            reads++;
            throw Object.assign(new Error("synthetic-access-denied"), {
              code: "EACCES",
            });
          }
          return Reflect.apply(target, receiver, args);
        },
      }),
    );
    syncBuiltinESMExports();
    try {
      handle = await startWorkbench({
        workingDirectory: fixture,
        aiProfiles: createWorkbenchAiProfileSurface(defaultAiProfileCatalog),
      });
      assert.equal(reads, 0);
      await handle.close();
      handle = null;
      await assert.rejects(
        startWorkbench({ workingDirectory: fixture }),
        /ai_profile_catalog_read_failed/u,
      );
      assert.equal(reads, 1);
    } finally {
      readFailure.mock.restore();
      syncBuiltinESMExports();
    }
  } finally {
    await handle?.close();
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * 実Provider検証用接続部が公開HTTP受付を迂回しないことを確認する。
 *
 * @responsibility 同意、Token、同じ依頼Identity、取消とListener終了を直接境界で判定する。
 * @trace ERB-IT-021
 * @precondition 実Workbenchへ偽AI Applicationだけを注入する。
 * @stimulus 確認なし、不正Token、別ID取消と正常start／observe／cancelを要求する。
 * @observation Application呼出し件数、公開snapshotと終了後接続を読む。
 * @oracle 拒否入力は呼出し0、正常操作は同じIDと意味区分を保持する。
 * @cleanup finallyで所有Listenerを閉じる。実ProviderとDocker資源は作らない。
 * @boundary ERB-IT-021=検証接続部→HTTP Form／Read Model→偽Application。
 */
test("実Provider検証のHTTP接続部は同意と同じ依頼Identityを公開境界で照合する", async () => {
  let starts = 0;
  let cancels = 0;
  let received: WorkbenchAiRequestCommand | null = null;
  let status: "running" | "cancelled" = "running";
  const application: WorkbenchAiRequests = {
    start: async (request) => {
      starts += 1;
      received = request;
      return { status: "accepted", requestId: "AIREQ-HTTP-001", reason: null };
    },
    observe: async (requestId) => ({
      requestId,
      mode: requestId === "AIREQ-HTTP-001" ? "read_only_advice" : null,
      profileId: requestId === "AIREQ-HTTP-001" ? "PROFILE-100001" : null,
      status: requestId === "AIREQ-HTTP-001" ? status : "unknown",
      reason:
        requestId === "AIREQ-HTTP-001"
          ? null
          : "orchestrator_task_not_available",
      facts:
        requestId === "AIREQ-HTTP-001"
          ? [{ text: "公開結果", references: ["PROJECT_CONTEXT.md"] }]
          : [],
      sharedAnalysis: [],
      additionalInferences: [],
      nextOptions: [],
      candidate: null,
    }),
    cancel: async (requestId) => {
      cancels += 1;
      status = "cancelled";
      return application.observe(requestId);
    },
  };
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    aiRequests: application,
  });
  try {
    const transport = await createWorkbenchAiVerificationHttpClient(
      handle.baseUrl,
    );
    const command: WorkbenchAiRequestCommand = {
      mode: "read_only_advice",
      profileId: "PROFILE-100001",
      prompt: "固定検証依頼",
      contextReferences: ["PROJECT_CONTEXT.md"],
      allowedPaths: [],
      externalSendConfirmed: false,
      workspaceId: null,
    };
    assert.equal((await transport.start(command)).status, "blocked");
    assert.equal(starts, 0);
    const initial = await requestMainModel(handle.baseUrl);
    const wrongToken = await requestRaw(
      handle.baseUrl,
      "/ai-request/action",
      "POST",
      new URLSearchParams({
        actionToken: "wrong",
        operation: "start",
        mode: command.mode,
        profileId: command.profileId,
        prompt: command.prompt,
        externalSendConfirmed: "yes",
      }).toString(),
    );
    assert.equal(wrongToken.status, 400);
    assert.equal(starts, 0);
    const accepted = await transport.start({
      ...command,
      externalSendConfirmed: true,
      workspaceId: null,
    });
    assert.equal(accepted.status, "accepted");
    assert.equal(accepted.requestId, "AIREQ-HTTP-001");
    assert.equal(starts, 1);
    assert.deepEqual(received, { ...command, externalSendConfirmed: true });
    const observed = await transport.observe("AIREQ-HTTP-001");
    assert.equal(observed.status, "running");
    assert.equal(observed.facts[0]?.text, "公開結果");
    const wrongId = await requestRaw(
      handle.baseUrl,
      "/ai-request/action",
      "POST",
      new URLSearchParams({
        actionToken: initial.actionToken,
        operation: "cancel",
        requestId: "AIREQ-OTHER",
      }).toString(),
    );
    assert.equal(wrongId.status, 400);
    assert.equal(cancels, 0);
    await assert.rejects(
      transport.cancel("AIREQ-OTHER"),
      /workbench_verification_request_unknown/u,
    );
    assert.equal(cancels, 0);
    const cancelled = await transport.cancel("AIREQ-HTTP-001");
    assert.equal(cancelled.status, "cancelled");
    assert.equal(cancelled.requestId, accepted.requestId);
    assert.equal(cancels, 1);
  } finally {
    await handle.close();
  }
  await assert.rejects(
    requestRaw(handle.baseUrl, "/.well-known/crdd-workbench-health"),
  );
});

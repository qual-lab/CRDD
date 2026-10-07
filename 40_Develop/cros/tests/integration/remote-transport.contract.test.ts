/**
 * CROS Bearer Remote Transportの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility RequestごとのCredential検証、Workspace非開示、Registry revision分離およびToken非報告をHTTP境界で検証する。
 * @trace PPR-IT-002
 * @trace RFD-IT-013
 * @level IT
 * @scope cros、bearer、http、portfolio、non-disclosure
 * @boundary RFD-IT-013／PPR-IT-002=Direct Boundary: HTTP→Credential→Exposure→Portfolio
 */
import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import test from "node:test";

import {
  createAiProfileCatalogAdministration,
  createAiProfileCatalogRegistry,
  DEFAULT_AI_PROFILE_CATALOG,
} from "../../../ai-adapter/src/profile/index.ts";
import { parseRepositoryProjectContextMarkdown } from "../../../domain-model/src/project-context/index.ts";
import {
  createMemoryConnectionCredentialRegistry,
  issueConnectionCredential,
  readRemotePortfolio,
  readRemoteRuntimeActivity,
  startCrosRemoteTransport,
  type CrosRuntimeActivityReader,
  type RequestAccessContext,
} from "../../src/index.ts";

const ADMINISTRATOR: RequestAccessContext = Object.freeze({
  credentialId: "bootstrap-admin",
  profile: "administrator",
  workspaceIds: Object.freeze([]),
  systemAdmin: true,
  credentialRegistryRevision: 0,
});

/**
 * Remote試験用のProject Contextを固定形式から構築する。
 *
 * @responsibility Portfolio HTTP試験へ一つの検証済みRepository Projectionを提供する。
 * @trace PPR-IT-002
 * @input repositoryIdとrepositoryRoleを受け取る。
 * @returns 五場面を持つRepository Project Contextを返す。
 * @precondition 入力Identityは空でない。
 * @postcondition Project IDはPRJ-REMOTEに固定される。
 * @effect N/A: 文字列解析だけを行う。
 * @failure 不正形式はParser例外として試験を失敗させる。
 * @invariant 外部Repositoryまたは未観測値を追加しない。
 * @stimulus contextの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary PPR-IT-002=Direct Boundary: cros Test Source→対象契約
 * @security 合成した非秘密Fixtureだけを使用する。
 * @concurrency N/A: 同期的な純粋関数である。
 */
function context(repositoryId: string, repositoryRole: string) {
  /**
   * scene用の試験入力または観測処理を提供する。
   *
   * @responsibility scene用の試験入力または観測処理を提供するの検証責務を所有する。
   * @trace PPR-IT-002
   * @trace RFD-IT-013
   * @precondition 対象契約を再現できる固定入力と依存を用意する。
   * @stimulus sceneの対象操作を実行する。
   * @observation 返却値、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionがSummaryの期待条件を満たす。
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary PPR-IT-002／RFD-IT-013=Direct Boundary: cros Test Source→対象契約
   */
  const scene = (title: string) =>
    `## ${title}\n\n要約。\n\n| 項目 | 状態 | 根拠 |\n|---|---|---|\n| Sample | current | owner.md |`;
  return parseRepositoryProjectContextMarkdown(
    `# Project Context\n\nProject ID: \`PRJ-REMOTE\`\nRepository ID: \`${repositoryId}\`\nRepository Role: \`${repositoryRole}\`\n\n${scene("1. 今どうなっているか")}\n\n${scene("2. 何が危ない、または止まっているか")}\n\n${scene("3. 今、人間が決めることは何か")}\n\n${scene("4. なぜこの状態・判断になったか")}\n\n${scene("5. 次に何をすべきか")}\n`,
  );
}

/**
 * Raw HTTP ResponseをToken再送なしで観測する。
 *
 * @responsibility Remote境界試験のStatusと公開Bodyを取得する。
 * @trace RFD-IT-013
 * @input baseUrl、Authorization値および任意のPath／Method／JSON Bodyを受け取る。
 * @returns StatusとUTF-8 Bodyを返す。
 * @precondition Serverが起動済みである。
 * @postcondition Response完了後にClient Socketを残さない。
 * @effect HTTP GETまたはPOSTを一回発行する。
 * @failure Network失敗を試験失敗として送出する。
 * @invariant Tokenをlogへ出力しない。
 * @stimulus rawRequestの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 * @security Response Bodyだけを観測しCredential Storeを作らない。
 * @concurrency 一Requestだけを所有する。
 */
async function rawRequest(
  baseUrl: string,
  authorization: string,
  input: Readonly<{
    path?: string;
    method?: "GET" | "POST";
    body?: Readonly<Record<string, unknown>>;
  }> = {},
): Promise<Readonly<{ status: number; body: string }>> {
  const url = new URL(baseUrl);
  const body =
    input.body === undefined ? undefined : JSON.stringify(input.body);
  return await new Promise((resolve, reject) => {
    const outgoing = httpRequest(
      {
        hostname: url.hostname,
        port: url.port,
        path: input.path ?? "/v1/portfolio",
        method: input.method ?? "GET",
        headers: {
          Authorization: authorization,
          ...(body === undefined
            ? {}
            : {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(body),
              }),
        },
      },
      (incoming) => {
        const chunks: Buffer[] = [];
        incoming.on("data", (chunk: Buffer) => chunks.push(chunk));
        incoming.once("end", () =>
          resolve({
            status: incoming.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );
    outgoing.once("error", reject);
    outgoing.end(body);
  });
}

/**
 * Bearer認証から許可済みPortfolioだけを取得できることを検証する。
 *
 * @responsibility Credential RegistryとExposure Registryのrevisionを分けた実HTTP経路を検証する。
 * @trace RFD-IT-013
 * @precondition Developer Credential、DEV／MGMT Repositoryおよび別revisionのExposure Snapshotを用意する。
 * @stimulus 有効Tokenと無効TokenでPortfolio Routeを要求し、外部平文URLもClientへ与える。
 * @observation Project Source、HTTP拒否、Token非報告およびListener終了を観測する。
 * @oracle DEVだけを返し、MGMTを非開示とし、認証失敗と外部HTTPをEffect前に拒否する。
 * @cleanup Transport Handleを閉じる。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("Bearer認証から許可済みPortfolioだけを取得する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "developer",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const handle = await startCrosRemoteTransport({
    registry,
    readExposureSnapshot: () => ({
      revision: "exposure-7",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: "REPO-DEV",
          repositoryRevision: "dev-1",
          registryRevision: "exposure-7",
          active: true,
        },
        {
          workspaceId: "management",
          repositoryId: "REPO-MGMT",
          repositoryRevision: "mgmt-1",
          registryRevision: "exposure-7",
          active: true,
        },
      ],
      repositories: [
        {
          projectId: "PRJ-REMOTE",
          repositoryId: "REPO-DEV",
          bindingId: "BIND-DEV",
          revision: "dev-1",
          content: { projectContext: context("REPO-DEV", "development") },
        },
        {
          projectId: "PRJ-REMOTE",
          repositoryId: "REPO-MGMT",
          bindingId: "BIND-MGMT",
          revision: "mgmt-1",
          content: { projectContext: context("REPO-MGMT", "management") },
        },
      ],
    }),
  });
  try {
    const portfolio = await readRemotePortfolio(handle.baseUrl, issued.token);
    assert.deepEqual(
      portfolio.projects[0]?.sources.map((source) => source.repositoryId),
      ["REPO-DEV"],
    );
    assert.doesNotMatch(JSON.stringify(portfolio), /REPO-MGMT/u);
    const blocked = await rawRequest(handle.baseUrl, "Bearer invalid");
    assert.equal(blocked.status, 401);
    assert.match(blocked.body, /cros_remote_authentication_required/u);
    assert.doesNotMatch(blocked.body, /credential|REPO|workspace/iu);
    await assert.rejects(
      readRemotePortfolio("http://example.invalid", issued.token),
      /cros_remote_transport_tls_required/u,
    );
  } finally {
    await handle.close();
  }
  await assert.rejects(readRemotePortfolio(handle.baseUrl, issued.token));
});

/**
 * Remote Runtime Activityが許可済みRepositoryだけをReaderへ渡すことを検証する。
 *
 * @responsibility Content Grant、Project Identity、現在状態、Event Pageおよび非開示を同じHTTP経路で検証する。
 * @trace RFD-IT-013
 * @precondition DEVだけにGrantされたCredential、DEV／MGMT Repositoryおよび決定論的Readerを用意する。
 * @stimulus 対象Projectと未許可ProjectのRuntime Activity Routeを要求する。
 * @observation Reader入力、Response状態、Event、Continuationおよび拒否Bodyを観測する。
 * @oracle ReaderにはDEV Repositoryだけが渡り、未許可Projectの存在とMGMT Identityを開示しない。
 * @cleanup Transport Handleを閉じる。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("Remote Runtime Activityは許可済みRepositoryだけを投影する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "developer",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const observedRepositories: string[][] = [];
  const reader: CrosRuntimeActivityReader = Object.freeze({
    read: async ({ projectId, repositories }) => {
      observedRepositories.push(
        repositories.map((repository) => repository.repositoryId),
      );
      return Object.freeze({
        state: "observed" as const,
        reason: "cros_runtime_activity_observed",
        projection: Object.freeze({
          projectId,
          milestoneId: "v0.22",
          generation: 7,
          milestoneState: "executing" as const,
          objectiveCounts: Object.freeze({
            planned: 0,
            executing: 1,
            integration_pending: 0,
            accepted: 0,
            returned: 0,
            blocked: 0,
            cancelled: 0,
          }),
          taskCounts: Object.freeze({
            planned: 0,
            waiting_dependency: 0,
            ready: 0,
            starting: 0,
            running: 1,
            cleanup_pending: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            recovery_required: 0,
            superseded: 0,
          }),
          objectiveTaskSummaries: Object.freeze([
            Object.freeze({
              objectiveId: "objective-remote",
              objectiveState: "executing" as const,
              taskCounts: Object.freeze({
                planned: 0,
                waiting_dependency: 0,
                ready: 0,
                starting: 0,
                running: 1,
                cleanup_pending: 0,
                completed: 0,
                failed: 0,
                cancelled: 0,
                recovery_required: 0,
                superseded: 0,
              }),
            }),
          ]),
          workProgress: "in_progress" as const,
          qualityState: "not_evaluated" as const,
          humanDecisionRequired: false,
          recoveryRequired: false,
          nextAction: "wait_for_task" as const,
        }),
        eventState: "observed" as const,
        eventReason: "execution_events_observed",
        events: Object.freeze([
          Object.freeze({
            eventId: `execution-${"b".repeat(64)}`,
            occurredAt: "2026-09-28T00:15:00.000Z",
            objectiveId: "objective-remote",
            taskId: "task-remote",
            attemptId: "attempt-remote",
            status: "completed" as const,
            reason: "task_completed",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
          }),
        ]),
        eventContinuation: null,
      });
    },
  });
  const handle = await startCrosRemoteTransport({
    registry,
    readExposureSnapshot: () => ({
      revision: "exposure-runtime",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: "REPO-DEV",
          repositoryRevision: "dev-1",
          registryRevision: "exposure-runtime",
          active: true,
        },
        {
          workspaceId: "management",
          repositoryId: "REPO-MGMT",
          repositoryRevision: "mgmt-1",
          registryRevision: "exposure-runtime",
          active: true,
        },
      ],
      repositories: [
        {
          projectId: "PRJ-REMOTE",
          repositoryId: "REPO-DEV",
          bindingId: "BIND-DEV",
          revision: "dev-1",
          content: { projectContext: context("REPO-DEV", "development") },
        },
        {
          projectId: "PRJ-REMOTE",
          repositoryId: "REPO-MGMT",
          bindingId: "BIND-MGMT",
          revision: "mgmt-1",
          content: { projectContext: context("REPO-MGMT", "management") },
        },
      ],
    }),
    runtimeActivityReader: reader,
  });
  try {
    const observation = await readRemoteRuntimeActivity(
      handle.baseUrl,
      issued.token,
      "PRJ-REMOTE",
    );
    assert.equal(observation.state, "observed");
    assert.equal(observation.events[0]?.taskId, "task-remote");
    assert.deepEqual(observedRepositories, [["REPO-DEV"]]);
    const unavailable = await rawRequest(
      handle.baseUrl,
      `Bearer ${issued.token}`,
      { path: "/v1/projects/PRJ-HIDDEN/runtime-activity" },
    );
    assert.equal(unavailable.status, 404);
    assert.doesNotMatch(unavailable.body, /REPO|MGMT|workspace/iu);
  } finally {
    await handle.close();
  }
});

/**
 * systemAdminだけがRemote AI Profileを参照・変更できることを検証する。
 *
 * @responsibility Content GrantとSystem Administration Capabilityを分離し、Profile管理情報を非管理Credentialへ開示しない。
 * @trace RFD-IT-013
 * @precondition Administrator／Developer Credentialと既定AI Profile Catalogを用意する。
 * @stimulus 両Credentialで管理Routeを参照し、AdministratorからProfile作成を要求する。
 * @observation HTTP Status、非開示Body、Catalog revisionおよび作成Profileを観測する。
 * @oracle DeveloperはProfile件数を得ず、Administratorの閉じたMutationだけがCatalogを更新する。
 * @cleanup Transport Handleを閉じる。
 * @boundary RFD-IT-013=Direct Boundary: cros Test Source→対象契約
 */
test("systemAdminだけがRemote AI Profileを参照・変更する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const admin = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "administrator",
  });
  const developer = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "developer",
  });
  assert.equal(admin.status, "completed");
  assert.equal(developer.status, "completed");
  if (admin.status !== "completed" || developer.status !== "completed") return;
  const profileRegistry = createAiProfileCatalogRegistry(
    DEFAULT_AI_PROFILE_CATALOG,
  );
  const handle = await startCrosRemoteTransport({
    registry,
    readExposureSnapshot: () => ({
      revision: "exposure-profile-admin",
      exposures: [],
      repositories: [],
    }),
    aiProfileAdministration:
      createAiProfileCatalogAdministration(profileRegistry),
  });
  try {
    const blocked = await rawRequest(
      handle.baseUrl,
      `Bearer ${developer.token}`,
      { path: "/v1/ai-profiles" },
    );
    assert.equal(blocked.status, 403);
    assert.match(blocked.body, /cros_system_administration_required/u);
    assert.doesNotMatch(blocked.body, /PROFILE-|profiles|revision/iu);

    const available = await rawRequest(
      handle.baseUrl,
      `Bearer ${admin.token}`,
      { path: "/v1/ai-profiles" },
    );
    assert.equal(available.status, 200);
    assert.match(available.body, /PROFILE-100001/u);

    const created = await rawRequest(handle.baseUrl, `Bearer ${admin.token}`, {
      path: "/v1/ai-profiles",
      method: "POST",
      body: {
        operation: "create",
        expectedRevision: 1,
        profile: {
          profileId: "PROFILE-300001",
          adapterId: "codex-cli",
          family: "astra",
          exactModelId: "gpt-6-astra",
          selectionRoles: ["independent_reviewer"],
          modelTiers: ["upper_allowed"],
          speedMode: "normal",
          billingMode: "subscription_oauth",
          defaultReasoningEffort: "high",
          compatibilityReason: null,
        },
      },
    });
    assert.equal(created.status, 200);
    assert.match(created.body, /"status":"completed"/u);
    assert.equal(profileRegistry.snapshot().revision, 2);
    assert.equal(
      profileRegistry
        .snapshot()
        .catalog.profiles.some(
          (profile) => profile.profileId === "PROFILE-300001",
        ),
      true,
    );
  } finally {
    await handle.close();
  }
});

/**
 * CROS CredentialからProject Context MCPまでの実境界を検証する。
 *
 * @packageDocumentation
 * @responsibility RequestごとのCredential検証、Workspace絞込み、MCP搬送および非開示をHTTP境界で確認する。
 * @trace CPR-IT-008
 * @trace PPR-IT-002
 * @trace RFD-IT-013
 * @trace EST-IT-002
 * @trace EST-IT-014
 * @trace RCM-IT-005
 * @trace RCM-IT-010
 * @level IT
 * @scope mcp、cros、credential、project-context、http
 * @boundary Bearer HTTP→Credential→Workspace Exposure→Portfolio→MCP
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  DEFAULT_AI_PROFILE_CATALOG,
  createAiProfileCatalogRegistry,
  createAiProfileCatalogAdministration,
  type AiProfileCatalogMutationResult,
} from "../../../ai-adapter/src/index.ts";

import { createTopicOperations } from "../../../domain-model/src/index.ts";
import { createMeetingOperations } from "../../../domain-model/src/index.ts";
import { parseRepositoryProjectContextMarkdown } from "../../../domain-model/src/index.ts";
import {
  createMemoryConnectionCredentialRegistry,
  issueConnectionCredential,
  type CrosRuntimeActivityReader,
  type CrosRemoteRuntimeActivityObservation,
  type RequestAccessContext,
} from "../../../cros/src/index.ts";
import {
  createCrosProjectContextMcpResolver,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_RUNTIME_ACTIVITY_TOOL,
  MCP_AI_PROFILE_TOOLS,
  handleMcpAiProfileRequest,
  routeMcpRequest,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
  startMcpAuthenticatedStreamableHttp,
} from "../../src/index.ts";

const ADMINISTRATOR: RequestAccessContext = Object.freeze({
  credentialId: "bootstrap-admin",
  profile: "administrator",
  workspaceIds: Object.freeze([]),
  systemAdmin: true,
  credentialRegistryRevision: 0,
});

/**
 * Profile管理を認証済みHTTPから既存Catalogへ接続する。
 *
 * @responsibility 管理権限、通常CRUD、改訂競合とContent観測不要を共同確認する。
 * @trace RCM-IT-005
 * @trace RCM-IT-010
 * @precondition 管理者とDeveloper Credential、独立Catalogを用意する。
 * @stimulus 一覧、登録、更新、競合、確認なし削除、確認付き削除と不正入力を送る。
 * @observation HTTP結果、Store改訂、保存内容、操作回数とListener終了を観測する。
 * @oracle 管理者だけが操作し、拒否時に改訂を進めず、Content Readerを呼ばない。
 * @cleanup finallyでListenerとSocketを回収する。
 * @boundary 実HTTP認証→CROS管理権限→MCP→AI Adapter Catalog。
 */
test("Profile管理MCPはContent Grantなしで管理CRUDと改訂競合を保持する", async () => {
  const baseProfile = DEFAULT_AI_PROFILE_CATALOG.profiles[0];
  assert.ok(baseProfile);
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
  const store = createAiProfileCatalogRegistry(DEFAULT_AI_PROFILE_CATALOG);
  const administration = createAiProfileCatalogAdministration(store);
  let contentReads = 0;
  let mutations = 0;
  let catalogReads = 0;
  const resolver = createCrosProjectContextMcpResolver({
    registry,
    readExposureSnapshot: () => {
      contentReads += 1;
      throw new Error("content_must_not_be_read");
    },
    aiProfileAdministration: {
      snapshot: () => {
        catalogReads += 1;
        return administration.snapshot();
      },
      execute: (mutation) => {
        mutations += 1;
        return administration.execute(mutation);
      },
    },
  });
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const baseUrl = `http://${server.host}:${server.port}`;
  const profile = {
    ...baseProfile,
    profileId: "PROFILE-900001",
    family: "mcp-test",
  };
  try {
    for (const [token, expectedCount] of [
      [admin.token, 4],
      [developer.token, 0],
    ] as const) {
      const handler = await resolver(token);
      assert.ok(handler);
      const listed = await handler(
        {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {
            _meta: {
              "io.modelcontextprotocol/protocolVersion":
                MCP_ORCHESTRATOR_PROTOCOL_VERSION,
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          },
        },
        new AbortController().signal,
      );
      const body = JSON.parse(JSON.stringify(listed));
      assert.equal(
        body.result.tools.filter((item: { name: string }) =>
          Object.values(MCP_AI_PROFILE_TOOLS).includes(
            item.name as typeof MCP_AI_PROFILE_TOOLS.list,
          ),
        ).length,
        expectedCount,
      );
    }
    assert.equal(catalogReads, 0);
    const denied = await callCrosTool(
      baseUrl,
      developer.token,
      MCP_AI_PROFILE_TOOLS.list,
      {},
    );
    assert.equal((await denied.json()).error.code, -32601);
    assert.equal(mutations, 0);
    assert.equal(catalogReads, 0);
    const initial = await callCrosTool(
      baseUrl,
      admin.token,
      MCP_AI_PROFILE_TOOLS.list,
      {},
    );
    assert.equal((await initial.json()).result.structuredContent.revision, 1);
    const created = await callCrosTool(
      baseUrl,
      admin.token,
      MCP_AI_PROFILE_TOOLS.create,
      { expectedRevision: 1, profile },
    );
    assert.equal(
      (await created.json()).result.structuredContent.reason,
      "profile_created",
    );
    assert.equal(store.snapshot().revision, 2);
    const conflict = await callCrosTool(
      baseUrl,
      admin.token,
      MCP_AI_PROFILE_TOOLS.update,
      { expectedRevision: 1, profile: { ...profile, family: "rejected" } },
    );
    assert.equal(
      (await conflict.json()).result.structuredContent.reason,
      "revision_conflict",
    );
    assert.equal(store.snapshot().revision, 2);
    assert.equal(
      store
        .snapshot()
        .catalog.profiles.find((item) => item.profileId === profile.profileId)
        ?.family,
      "mcp-test",
    );
    const updated = await callCrosTool(
      baseUrl,
      admin.token,
      MCP_AI_PROFILE_TOOLS.update,
      { expectedRevision: 2, profile: { ...profile, family: "updated" } },
    );
    assert.equal(
      (await updated.json()).result.structuredContent.reason,
      "profile_updated",
    );
    assert.equal(store.snapshot().revision, 3);
    assert.equal(
      store
        .snapshot()
        .catalog.profiles.find((item) => item.profileId === profile.profileId)
        ?.family,
      "updated",
    );
    const unconfirmed = await callCrosTool(
      baseUrl,
      admin.token,
      MCP_AI_PROFILE_TOOLS.delete,
      { expectedRevision: 3, profileId: profile.profileId, confirmed: false },
    );
    assert.equal(
      (await unconfirmed.json()).result.structuredContent.reason,
      "profile_delete_confirmation_required",
    );
    assert.equal(store.snapshot().revision, 3);
    const beforeInvalid = mutations;
    for (const args of [
      { expectedRevision: -1, profile },
      { expectedRevision: 2, profile, operation: "delete" },
      { expectedRevision: 2, profile: { ...profile, command: "forbidden" } },
    ]) {
      const invalid = await callCrosTool(
        baseUrl,
        admin.token,
        MCP_AI_PROFILE_TOOLS.create,
        args,
      );
      assert.equal((await invalid.json()).error.code, -32602);
    }
    assert.equal(mutations, beforeInvalid);
    const deleted = await callCrosTool(
      baseUrl,
      admin.token,
      MCP_AI_PROFILE_TOOLS.delete,
      { expectedRevision: 3, profileId: profile.profileId, confirmed: true },
    );
    assert.equal(
      (await deleted.json()).result.structuredContent.reason,
      "profile_deleted",
    );
    assert.equal(store.snapshot().revision, 4);
    assert.equal(
      store
        .snapshot()
        .catalog.profiles.some((item) => item.profileId === profile.profileId),
      false,
    );
    assert.equal(contentReads, 0);
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 保存後の応答故障と取消を保存取消へ読み替えない。
 *
 * @responsibility 管理操作一回と再観測を確認し、暗黙再試行を禁止する。
 * @trace RCM-IT-005
 * @trace EST-IT-002
 * @precondition 独立Catalogと応答故障または取消を発生する同期管理操作を用意する。
 * @stimulus 事前取消、保存後例外、保存後取消を固定Requestへ与える。
 * @observation 呼出し回数、Store改訂、保存値とProtocol Errorを観測する。
 * @oracle 事前取消は操作0、保存後故障・取消は変更を保持し内部例外を公開しない。
 * @cleanup N/A: メモリCatalogだけを使用する。
 * @boundary MCP Adapter→同期Catalog採用→応答。
 */
test("Profile管理MCPは保存後故障と取消で自動再実行しない", async () => {
  const baseProfile = DEFAULT_AI_PROFILE_CATALOG.profiles[0];
  assert.ok(baseProfile);
  const store = createAiProfileCatalogRegistry(DEFAULT_AI_PROFILE_CATALOG);
  const administration = createAiProfileCatalogAdministration(store);
  const abort = new AbortController();
  let calls = 0;
  const profile = {
    ...baseProfile,
    profileId: "PROFILE-900002",
    family: "fault-test",
  };
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: MCP_AI_PROFILE_TOOLS.create,
      arguments: { expectedRevision: 1, profile },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_ORCHESTRATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const port = {
    snapshot: administration.snapshot,
    execute: (mutation: Parameters<typeof administration.execute>[0]) => {
      calls += 1;
      administration.execute(mutation);
      throw new Error("private_error_secret");
    },
  };
  abort.abort();
  const cancelled = await handleMcpAiProfileRequest(
    request,
    port,
    abort.signal,
  );
  assert.ok("error" in cancelled);
  assert.equal(cancelled.error.code, -32800);
  assert.equal(calls, 0);
  const failure = await handleMcpAiProfileRequest(
    request,
    port,
    new AbortController().signal,
  );
  assert.ok("error" in failure);
  assert.equal(failure.error.code, -32603);
  assert.doesNotMatch(JSON.stringify(failure), /private_error_secret/u);
  assert.equal(calls, 1);
  assert.equal(store.snapshot().revision, 2);
  assert.equal(
    store
      .snapshot()
      .catalog.profiles.some((item) => item.profileId === profile.profileId),
    true,
  );
  const afterAdoption = new AbortController();
  const final = await handleMcpAiProfileRequest(
    {
      ...request,
      params: {
        ...request.params,
        name: MCP_AI_PROFILE_TOOLS.update,
        arguments: {
          expectedRevision: 2,
          profile: { ...profile, family: "cancelled-after-save" },
        },
      },
    },
    {
      snapshot: administration.snapshot,
      execute: (mutation) => {
        calls += 1;
        const result = administration.execute(mutation);
        afterAdoption.abort();
        return result;
      },
    },
    afterAdoption.signal,
  );
  assert.ok("error" in final);
  assert.equal(final.error.code, -32800);
  assert.equal(calls, 2);
  assert.equal(store.snapshot().revision, 3);
  assert.equal(
    store
      .snapshot()
      .catalog.profiles.find((item) => item.profileId === profile.profileId)
      ?.family,
    "cancelled-after-save",
  );
});

/**
 * Profile管理の矛盾した成功・拒否を公開しない。
 *
 * @responsibility 操作・改訂・対象Profileの相関と所有結果を反証する。
 * @trace RCM-IT-005
 * @trace EST-IT-002
 * @precondition 正常Catalogと矛盾結果を返す合成管理操作を用意する。
 * @stimulus 対象欠落、旧値、削除後残存、誤改訂、誤拒否理由と実行可能Propertyを返す。
 * @observation Error、操作回数、hook回数と返却後の値を観測する。
 * @oracle 矛盾は内部故障、execute一回、hook0、正常応答は元値変更を受けない。
 * @cleanup N/A: 局所値だけを使用する。
 * @boundary MCP→Catalog操作結果→公開Snapshot。
 */
test("Profile管理MCPは結果相関の矛盾と実行可能Propertyを拒否する", async () => {
  const baseProfile = DEFAULT_AI_PROFILE_CATALOG.profiles[0];
  assert.ok(baseProfile);
  const profile = {
    ...baseProfile,
    profileId: "PROFILE-900003",
    family: "owned-result",
  };
  const validCatalog = structuredClone({
    ...DEFAULT_AI_PROFILE_CATALOG,
    profiles: [...DEFAULT_AI_PROFILE_CATALOG.profiles, profile],
  });
  const valid = {
    status: "completed",
    reason: "profile_created",
    snapshot: { revision: 2, catalog: validCatalog },
  };
  let hooks = 0;
  const getterResult = { ...valid };
  Object.defineProperty(getterResult, "snapshot", {
    enumerable: true,
    get: () => {
      hooks += 1;
      return valid.snapshot;
    },
  });
  const proxyCatalog = new Proxy(validCatalog, {
    ownKeys: () => {
      hooks += 1;
      return Reflect.ownKeys(validCatalog);
    },
  });
  const cases = [
    [
      MCP_AI_PROFILE_TOOLS.create,
      { expectedRevision: 1, profile },
      {
        ...valid,
        snapshot: { revision: 2, catalog: DEFAULT_AI_PROFILE_CATALOG },
      },
    ],
    [
      MCP_AI_PROFILE_TOOLS.create,
      { expectedRevision: 1, profile },
      { ...valid, snapshot: { revision: 1, catalog: validCatalog } },
    ],
    [
      MCP_AI_PROFILE_TOOLS.update,
      { expectedRevision: 1, profile: { ...baseProfile, family: "changed" } },
      {
        status: "completed",
        reason: "profile_updated",
        snapshot: { revision: 2, catalog: DEFAULT_AI_PROFILE_CATALOG },
      },
    ],
    [
      MCP_AI_PROFILE_TOOLS.delete,
      {
        expectedRevision: 1,
        profileId: baseProfile.profileId,
        confirmed: true,
      },
      {
        status: "completed",
        reason: "profile_deleted",
        snapshot: { revision: 2, catalog: DEFAULT_AI_PROFILE_CATALOG },
      },
    ],
    [
      MCP_AI_PROFILE_TOOLS.create,
      { expectedRevision: 1, profile },
      {
        ...valid,
        status: "rejected",
        reason: "profile_delete_confirmation_required",
        snapshot: { revision: 1, catalog: validCatalog },
      },
    ],
    [
      MCP_AI_PROFILE_TOOLS.create,
      { expectedRevision: 1, profile },
      {
        ...valid,
        status: "rejected",
        reason: "profile_already_exists",
        snapshot: { revision: 1, catalog: DEFAULT_AI_PROFILE_CATALOG },
      },
    ],
    [
      MCP_AI_PROFILE_TOOLS.create,
      { expectedRevision: 1, profile },
      getterResult,
    ],
    [
      MCP_AI_PROFILE_TOOLS.create,
      { expectedRevision: 1, profile },
      { ...valid, snapshot: { revision: 2, catalog: proxyCatalog } },
    ],
  ] as const;
  for (const [name, args, raw] of cases) {
    let calls = 0;
    const reply = await handleMcpAiProfileRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name,
          arguments: args,
          _meta: {
            "io.modelcontextprotocol/protocolVersion":
              MCP_ORCHESTRATOR_PROTOCOL_VERSION,
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      },
      {
        snapshot: () => {
          throw new Error("unexpected_read");
        },
        execute: () => {
          calls += 1;
          return raw as unknown as AiProfileCatalogMutationResult;
        },
      },
      new AbortController().signal,
    );
    assert.ok("error" in reply);
    assert.equal(reply.error.code, -32603);
    assert.equal(calls, 1);
  }
  assert.equal(hooks, 0);
  const owned = await handleMcpAiProfileRequest(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: MCP_AI_PROFILE_TOOLS.create,
        arguments: { expectedRevision: 1, profile },
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_ORCHESTRATOR_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    },
    {
      snapshot: () => {
        throw new Error("unexpected_read");
      },
      execute: () => valid as AiProfileCatalogMutationResult,
    },
    new AbortController().signal,
  );
  assert.ok("result" in owned);
  const before = JSON.stringify(owned);
  const originalRoles = validCatalog.profiles.at(-1)?.selectionRoles;
  assert.ok(originalRoles);
  (originalRoles as string[]).push("executor");
  validCatalog.profiles.pop();
  assert.equal(JSON.stringify(owned), before);
});

/**
 * Runtime活動MCPの認可・入力・欠測・故障を検証する。
 *
 * @responsibility 実HTTPとCROS認可から活動Readerへ到達する公開接続を確認する。
 * @trace RFD-IT-013
 * @trace EST-IT-002
 * @precondition DEV／MGMT、Developer／Admin Credentialと合成活動Readerを用意する。
 * @stimulus 正常、非許可、境界入力、観測不能、余剰結果と故障をToolへ渡す。
 * @observation Reader入力・回数、MCP結果、HTTP認証拒否とListener終了を観測する。
 * @oracle DEVだけを読み、Admin-onlyは読取り0、不正入力はdispatch0、故障を空成功にしない。
 * @cleanup 全経路でListenerと所有Socketを閉じ、終了後再接続を拒否する。
 * @boundary Bearer HTTP→MCP→CROS認可Scope→活動Reader。
 */
test("Runtime活動MCPは現在Grantと閉じた観測契約を保持する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const developer = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "developer",
  });
  const admin = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "administrator",
  });
  assert.equal(developer.status, "completed");
  assert.equal(admin.status, "completed");
  if (developer.status !== "completed" || admin.status !== "completed") return;
  const clean: CrosRemoteRuntimeActivityObservation = {
    state: "absent",
    reason: "no_current_task",
    projection: null,
    eventState: "observed",
    eventReason: "no_events",
    events: [],
    eventContinuation: null,
  };
  const inputs: unknown[] = [];
  let result: unknown = clean;
  let failed = false;
  const reader: CrosRuntimeActivityReader = {
    read: async (query) => {
      inputs.push(query);
      if (failed) throw new Error("private_reader_failure");
      return result as CrosRemoteRuntimeActivityObservation;
    },
  };
  const resolver = createCrosProjectContextMcpResolver({
    registry,
    readExposureSnapshot: () => ({
      revision: "activity-1",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: "REPO-DEV",
          repositoryRevision: "r1",
          registryRevision: "activity-1",
          active: true,
        },
        {
          workspaceId: "management",
          repositoryId: "REPO-MGMT",
          repositoryRevision: "r1",
          registryRevision: "activity-1",
          active: true,
        },
      ],
      repositories: [
        {
          projectId: "PRJ-MCP",
          repositoryId: "REPO-DEV",
          bindingId: "BIND-DEV",
          revision: "r1",
          content: { projectContext: context("REPO-DEV", "development") },
        },
        {
          projectId: "PRJ-MCP",
          repositoryId: "REPO-MGMT",
          bindingId: "BIND-MGMT",
          revision: "r1",
          content: { projectContext: context("REPO-MGMT", "management") },
        },
      ],
    }),
    runtimeActivityReader: reader,
  });
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const baseUrl = `http://${server.host}:${server.port}`;
  try {
    const handler = await resolver(developer.token);
    assert.ok(handler);
    const listed = await handler(
      {
        jsonrpc: "2.0",
        id: "activity-tools",
        method: "tools/list",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion":
              MCP_ORCHESTRATOR_PROTOCOL_VERSION,
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      },
      new AbortController().signal,
    );
    assert.ok("result" in listed);
    const listResult = listed.result;
    assert.ok(
      listResult && typeof listResult === "object" && "tools" in listResult,
    );
    assert.ok(Array.isArray(listResult.tools));
    assert.equal(
      listResult.tools.filter(
        (tool: unknown) =>
          tool !== null &&
          typeof tool === "object" &&
          "name" in tool &&
          tool.name === MCP_RUNTIME_ACTIVITY_TOOL,
      ).length,
      1,
    );
    assert.equal(inputs.length, 0);
    const available = await callCrosTool(
      baseUrl,
      developer.token,
      MCP_RUNTIME_ACTIVITY_TOOL,
    );
    assert.equal(available.status, 200);
    const body = await available.json();
    assert.deepEqual(body.result.structuredContent, clean);
    assert.equal(body.result.isError, false);
    assert.deepEqual(inputs, [
      {
        projectId: "PRJ-MCP",
        limit: 20,
        repositories: [
          {
            projectId: "PRJ-MCP",
            repositoryId: "REPO-DEV",
            bindingId: "BIND-DEV",
            revision: "r1",
            content: { projectContext: context("REPO-DEV", "development") },
          },
        ],
      },
    ]);
    for (const args of [
      { projectId: "PRJ-HIDDEN" },
      { projectId: "PRJ-MCP", limit: 0 },
      { projectId: "PRJ-MCP", limit: 51 },
      { projectId: "PRJ-MCP", limit: 1.5 },
      { projectId: "PRJ-MCP", cursor: 4 },
      { projectId: "PRJ-MCP", extra: true },
    ]) {
      const refused = await callCrosTool(
        baseUrl,
        developer.token,
        MCP_RUNTIME_ACTIVITY_TOOL,
        args,
      );
      const reply = await refused.json();
      assert.equal(inputs.length, 1);
      if (args.projectId === "PRJ-HIDDEN")
        assert.equal(reply.result.isError, true);
      else assert.equal(reply.error.code, -32602);
      assert.doesNotMatch(JSON.stringify(reply), /REPO-MGMT|PRJ-HIDDEN/u);
    }
    const denied = await callCrosTool(
      baseUrl,
      admin.token,
      MCP_RUNTIME_ACTIVITY_TOOL,
    );
    assert.equal((await denied.json()).result.isError, true);
    assert.equal(inputs.length, 1);
    result = {
      ...clean,
      state: "unknown",
      reason: "observation_unknown",
      eventState: "unknown",
      eventReason: "event_observation_unknown",
    };
    const unknown = await callCrosTool(
      baseUrl,
      developer.token,
      MCP_RUNTIME_ACTIVITY_TOOL,
      { projectId: "PRJ-MCP", cursor: "page-2", limit: 50 },
    );
    assert.deepEqual((await unknown.json()).result.structuredContent, result);
    const pageInput: unknown = inputs.at(1);
    assert.ok(
      pageInput &&
        typeof pageInput === "object" &&
        "cursor" in pageInput &&
        "limit" in pageInput,
    );
    assert.equal(pageInput.cursor, "page-2");
    assert.equal(pageInput.limit, 50);
    const event = {
      eventId: `execution-${"a".repeat(64)}`,
      occurredAt: "2026-10-09T00:00:00.000Z",
      objectiveId: "OBJ-1",
      taskId: "TASK-1",
      attemptId: "ATTEMPT-1",
      status: "completed",
      reason: "completed",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
    };
    let getterCalls = 0;
    let proxyCalls = 0;
    const accessor = { ...clean };
    Object.defineProperty(accessor, "reason", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "privateData";
      },
    });
    const proxy = new Proxy(
      { ...clean },
      {
        ownKeys(target) {
          proxyCalls += 1;
          return Reflect.ownKeys(target);
        },
      },
    );
    for (const invalid of [
      { ...clean, privateData: "must_not_escape" },
      { ...clean, state: "observed" },
      { ...clean, eventState: "unknown", events: [{}] },
      {
        ...clean,
        state: { toString: () => "absent", privateData: "must_not_escape" },
      },
      { ...clean, eventState: { toString: () => "observed" } },
      {
        ...clean,
        events: [{ ...event, status: { toString: () => "completed" } }],
      },
      { ...clean, events: [{ ...event, privateData: "must_not_escape" }] },
      { ...clean, projection: {} },
      accessor,
      proxy,
    ]) {
      result = invalid;
      const rejected = await callCrosTool(
        baseUrl,
        developer.token,
        MCP_RUNTIME_ACTIVITY_TOOL,
      );
      const reply = await rejected.json();
      assert.equal(reply.error.code, -32603);
      assert.doesNotMatch(
        JSON.stringify(reply),
        /must_not_escape|privateData/u,
      );
    }
    assert.equal(getterCalls, 0);
    assert.equal(proxyCalls, 0);
    const mutable = { ...clean, events: [{ ...event }] };
    const ownedReply = await routeMcpRequest(
      {
        jsonrpc: "2.0",
        id: "owned-result",
        method: "tools/call",
        params: {
          name: MCP_RUNTIME_ACTIVITY_TOOL,
          arguments: { projectId: "PRJ-MCP" },
          _meta: {
            "io.modelcontextprotocol/protocolVersion":
              MCP_ORCHESTRATOR_PROTOCOL_VERSION,
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      },
      {
        projectContext: {
          readPortfolio: async () => ({
            projects: [],
            retainedAsSourceOfTruth: false,
          }),
        },
        runtimeActivity: {
          read: async () => mutable as CrosRemoteRuntimeActivityObservation,
        },
      },
    );
    assert.ok("result" in ownedReply);
    mutable.reason = "must_not_escape";
    const mutableEvent = mutable.events[0];
    assert.ok(mutableEvent);
    mutableEvent.reason = "must_not_escape";
    Object.defineProperty(mutable, "privateData", {
      enumerable: true,
      value: "must_not_escape",
    });
    assert.doesNotMatch(
      JSON.stringify(ownedReply),
      /must_not_escape|privateData/u,
    );
    assert.ok(
      ownedReply.result &&
        typeof ownedReply.result === "object" &&
        "structuredContent" in ownedReply.result,
    );
    assert.ok(Object.isFrozen(ownedReply.result.structuredContent));
    failed = true;
    const fault = await callCrosTool(
      baseUrl,
      developer.token,
      MCP_RUNTIME_ACTIVITY_TOOL,
    );
    const faultReply = await fault.json();
    assert.equal(faultReply.error.code, -32603);
    assert.doesNotMatch(JSON.stringify(faultReply), /private_reader_failure/u);
    const unauthenticated = await callCrosTool(
      baseUrl,
      "invalid",
      MCP_RUNTIME_ACTIVITY_TOOL,
    );
    assert.equal(unauthenticated.status, 401);
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
  await assert.rejects(
    callCrosTool(baseUrl, developer.token, MCP_RUNTIME_ACTIVITY_TOOL),
  );
});

/**
 * Runtime活動の読取り中取消をjoin後に返すことを検証する。
 *
 * @responsibility 取消応答と読取り完了を混同しないProtocol境界を確認する。
 * @trace EST-IT-014
 * @precondition 解放まで保留するReaderとAbortControllerを用意する。
 * @stimulus Tool開始後に取消し、その後Readerを解放する。
 * @observation 応答保留、Reader完了と取消結果を確認する。
 * @oracle Reader完了前に結果を返さず、完了後-32800を返す。
 * @cleanup 保留gateをfinallyで解放し、開始済みPromiseをjoinする。
 * @boundary MCP Adapterと非取消Readerの境界。
 */
test("Runtime活動MCPは開始済みReaderをjoinしてから取消を返す", async () => {
  const controller = new AbortController();
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let readStarted = false;
  let readCompleted = false;
  let responseSettled = false;
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: MCP_RUNTIME_ACTIVITY_TOOL,
      arguments: { projectId: "PRJ-MCP" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_ORCHESTRATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const alreadyCancelled = new AbortController();
  alreadyCancelled.abort();
  let cancelledReadCount = 0;
  const refused = await routeMcpRequest(
    request,
    {
      projectContext: {
        readPortfolio: async () => ({
          projects: [],
          retainedAsSourceOfTruth: false,
        }),
      },
      runtimeActivity: {
        read: async () => {
          cancelledReadCount += 1;
          return null;
        },
      },
    },
    alreadyCancelled.signal,
  );
  assert.ok("error" in refused);
  assert.equal(refused.error.code, -32800);
  assert.equal(cancelledReadCount, 0);
  const pending = routeMcpRequest(
    request,
    {
      projectContext: {
        readPortfolio: async () => ({
          projects: [],
          retainedAsSourceOfTruth: false,
        }),
      },
      runtimeActivity: {
        read: async () => {
          readStarted = true;
          await gate;
          readCompleted = true;
          return null;
        },
      },
    },
    controller.signal,
  );
  void pending.then(() => {
    responseSettled = true;
  });
  try {
    assert.equal(readStarted, true);
    controller.abort();
    await Promise.resolve();
    assert.equal(responseSettled, false);
    assert.equal(readCompleted, false);
    release();
    const reply = await pending;
    assert.equal(readCompleted, true);
    assert.ok("error" in reply);
    assert.equal(reply.error.code, -32800);
  } finally {
    release();
    await pending;
  }
});

/** 五場面を持つProject Context Fixtureを作る。 */
/**
 * context用の試験入力または観測処理を提供する。
 *
 * @responsibility context用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace PPR-IT-002
 * @trace RFD-IT-013
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus contextの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary PPR-IT-002／RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
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
   * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
   * @boundary PPR-IT-002／RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
   */
  const scene = (title: string) =>
    `## ${title}\n\n要約。\n\n| 項目 | 状態 | 根拠 |\n|---|---|---|\n| Sample | current | owner.md |`;
  return parseRepositoryProjectContextMarkdown(
    `# Project Context\n\nProject ID: \`PRJ-MCP\`\nRepository ID: \`${repositoryId}\`\nRepository Role: \`${repositoryRole}\`\n\n${scene("1. 今どうなっているか")}\n\n${scene("2. 何が危ない、または止まっているか")}\n\n${scene("3. 今、人間が決めることは何か")}\n\n${scene("4. なぜこの状態・判断になったか")}\n\n${scene("5. 次に何をすべきか")}\n`,
  );
}

/** MCP Tool CallをBearer HTTPで送信する。 */
/**
 * callCrosTool用の試験入力または観測処理を提供する。
 *
 * @responsibility callCrosTool用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace PPR-IT-002
 * @trace RFD-IT-013
 * @trace EST-IT-002
 * @trace RCM-IT-005
 * @trace RCM-IT-010
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus callCrosToolの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary PPR-IT-002／RFD-IT-013／EST-IT-002／RCM-IT-005／RCM-IT-010=Direct Boundary: HTTPからProject Context、Runtime活動とProfile管理MCPを搬送する。
 */
async function callCrosTool(
  baseUrl: string,
  token: string,
  tool: string = MCP_PROJECT_CONTEXT_GET_TOOL,
  args: Readonly<Record<string, unknown>> = { projectId: "PRJ-MCP" },
): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": tool,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: tool,
        arguments: args,
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_ORCHESTRATOR_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

/** Remote CROS Topic登録をBearer HTTPで送信する。 */
/**
 * createRemoteTopic用の試験入力または観測処理を提供する。
 *
 * @responsibility createRemoteTopic用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-008
 * @trace RFD-IT-013
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus createRemoteTopicの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008／RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
 */
async function createRemoteTopic(
  baseUrl: string,
  token: string,
  repositoryId: string,
): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": "crdd.create_topic",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "crdd.create_topic",
        arguments: {
          repositoryId,
          markdown:
            "# Remote Topic\n\n成果物種別: Topic\nTopic ID: `TOPIC-000099`\nProject ID: `PRJ-MCP`\n状態: `open`\n改訂: `1`\n維持責任者: `Project Operator`\n\n## 1. 現在の論点\n\n### 結論\n\nRemote routingを確認する。\n",
        },
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_ORCHESTRATOR_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

/** Relationを持つTopic Fixtureを作る。 */
/**
 * relatedTopic用の試験入力または観測処理を提供する。
 *
 * @responsibility relatedTopic用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-008
 * @trace RFD-IT-013
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus relatedTopicの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008／RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
 */
function relatedTopic(id: string, relationId: string): string {
  return `# ${id}\n\n成果物種別: Topic\nTopic ID: \`${id}\`\nProject ID: \`PRJ-MCP\`\n状態: \`open\`\n改訂: \`1\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\nRepository間Relationを確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| related | \`${relationId}\` | 同じProjectの別Owner |\n`;
}

/** Remote CROS Topic詳細をBearer HTTPで取得する。 */
/**
 * getRemoteTopic用の試験入力または観測処理を提供する。
 *
 * @responsibility getRemoteTopic用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace CPR-IT-008
 * @trace RFD-IT-013
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus getRemoteTopicの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成した一時資源、ListenerまたはProcessを清掃する。
 * @boundary CPR-IT-008／RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
 */
async function getRemoteTopic(
  baseUrl: string,
  token: string,
  repositoryId: string,
  topicId: string,
): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": "crdd.get_topic",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "crdd.get_topic",
        arguments: { repositoryId, id: topicId },
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_ORCHESTRATOR_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

/**
 * CROS CredentialのWorkspace範囲だけをMCPへ搬送する。
 *
 * @responsibility Remote CROS MCPが固定Transport Tokenを追加せず、現在CredentialでPortfolioを絞ることを検証する。
 * @trace RFD-IT-013
 * @precondition Developer CredentialとDEV／MGMT Repositoryを用意する。
 * @stimulus 有効Tokenと無効Tokenから同じProject Contextを要求する。
 * @observation HTTP Status、Structured Contentおよび非開示Repository文字列を観測する。
 * @oracle 有効TokenはDEVだけを取得し、無効TokenはMGMTの存在を開示せず401となる。
 * @cleanup MCP listenerを閉じる。
 * @boundary RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
 */
test("CROS CredentialのWorkspace範囲だけをProject Context MCPへ搬送する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "developer",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  let authenticationReads = 0;
  let snapshotReads = 0;
  const resolver = createCrosProjectContextMcpResolver({
    registry: {
      inspect: () => {
        authenticationReads += 1;
        return registry.inspect();
      },
      publish: registry.publish,
    },
    /**
     * 元の入力Receiverを保持して公開範囲を観測する。
     *
     * @responsibility MCPの一Request一回観測とReceiver維持を検証する。
     * @trace RFD-IT-013
     * @input N/A: 引数を受け取らない。
     * @returns 固定公開範囲Snapshot。
     * @precondition Resolver入力ObjectがReceiverである。
     * @postcondition 観測回数を一つ進める。
     * @effect 試験内counterだけを更新する。
     * @failure Receiver喪失はassertionで拒否する。
     * @invariant Snapshot内容を変更しない。
     * @stimulus MCP RequestからReaderを呼ぶ。
     * @observation Receiverと呼出し回数を観測する。
     * @oracle Receiverはregistryを持つ元の入力Objectである。
     * @cleanup N/A: Process外資源を生成しない。
     * @boundary MCP Resolverと公開範囲Readerの境界。
     * @security 合成した非秘密値だけを使用する。
     * @concurrency N/A: Request内の同期処理である。
     */
    readExposureSnapshot() {
      assert.equal(this.registry.publish, registry.publish);
      snapshotReads += 1;
      return {
        revision: "exposure-mcp-1",
        exposures: [
          {
            workspaceId: "development",
            repositoryId: "REPO-DEV",
            repositoryRevision: "dev-1",
            registryRevision: "exposure-mcp-1",
            active: true,
          },
          {
            workspaceId: "management",
            repositoryId: "REPO-MGMT",
            repositoryRevision: "mgmt-1",
            registryRevision: "exposure-mcp-1",
            active: true,
          },
        ],
        repositories: [
          {
            projectId: "PRJ-MCP",
            repositoryId: "REPO-DEV",
            bindingId: "BIND-DEV",
            revision: "dev-1",
            content: { projectContext: context("REPO-DEV", "development") },
          },
          {
            projectId: "PRJ-MCP",
            repositoryId: "REPO-MGMT",
            bindingId: "BIND-MGMT",
            revision: "mgmt-1",
            content: { projectContext: context("REPO-MGMT", "management") },
          },
        ],
      };
    },
  });
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const baseUrl = `http://${server.host}:${server.port}`;
  try {
    const available = await callCrosTool(baseUrl, issued.token);
    assert.equal(authenticationReads, 1);
    assert.equal(snapshotReads, 1);
    assert.equal(available.status, 200);
    const body = JSON.stringify(await available.json());
    assert.match(body, /REPO-DEV/u);
    assert.doesNotMatch(body, /REPO-MGMT/u);

    const blocked = await callCrosTool(
      baseUrl,
      "invalid-token-value-that-is-long-enough-0000",
    );
    assert.equal(blocked.status, 401);
    assert.equal(authenticationReads, 2);
    assert.equal(snapshotReads, 1);
    assert.doesNotMatch(await blocked.text(), /REPO|workspace|credential/iu);
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
  }
});

/**
 * Remote CROS Topic書込みを明示Repositoryと現在Exposureへ拘束する。
 *
 * @responsibility Credential Grant外Repositoryへの書込みを非開示拒否し、許可Repositoryだけを対応ApplicationへRoutingする。
 * @trace RFD-IT-013
 * @precondition Development Credential、DEV ExposureおよびDEV Topic Repositoryを用意する。
 * @stimulus DEVと非許可MGMTのRepository IDを指定してTopic登録を要求する。
 * @observation MCP応答とDEV RepositoryのTopicを観測する。
 * @oracle DEVだけ一件作成し、MGMT要求は同じ非開示エラーでEffect 0となる。
 * @cleanup MCP Listenerと検証用Repository Rootを削除する。
 * @boundary RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
 */
test("CROSは許可済みRepositoryだけへTopic書込みをRoutingする", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-cros-topic-routing-"));
  const topicMeeting = Object.freeze({
    topic: createTopicOperations(root),
    meeting: createMeetingOperations(root),
  });
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "developer",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const resolver = createCrosProjectContextMcpResolver({
    registry,
    readExposureSnapshot: () => ({
      revision: "exposure-write-1",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: "REPO-DEV",
          repositoryRevision: "dev-1",
          registryRevision: "exposure-write-1",
          active: true,
        },
        {
          workspaceId: "management",
          repositoryId: "REPO-MGMT",
          repositoryRevision: "mgmt-1",
          registryRevision: "exposure-write-1",
          active: true,
        },
      ],
      repositories: [
        {
          projectId: "PRJ-MCP",
          repositoryId: "REPO-DEV",
          bindingId: "BIND-DEV",
          revision: "dev-1",
          content: { projectContext: context("REPO-DEV", "development") },
        },
        {
          projectId: "PRJ-MCP",
          repositoryId: "REPO-MGMT",
          bindingId: "BIND-MGMT",
          revision: "mgmt-1",
          content: { projectContext: context("REPO-MGMT", "management") },
        },
      ],
    }),
    resolveTopicMeetingAccess: (repository) =>
      repository.bindingId === "BIND-DEV" ? topicMeeting : null,
  });
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const baseUrl = `http://${server.host}:${server.port}`;
  try {
    const available = await createRemoteTopic(
      baseUrl,
      issued.token,
      "REPO-DEV",
    );
    assert.equal(available.status, 200);
    assert.match(JSON.stringify(await available.json()), /record_created/u);
    assert.equal(topicMeeting.topic.get("TOPIC-000099")?.revision, 1);

    const blocked = await createRemoteTopic(baseUrl, issued.token, "REPO-MGMT");
    assert.equal(blocked.status, 200);
    const blockedBody = JSON.stringify(await blocked.json());
    assert.match(blockedBody, /Invalid params/u);
    assert.doesNotMatch(blockedBody, /REPO-MGMT|management/u);
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 許可済みRepository間のRelationをOwner Repository付きで解決する。
 *
 * @responsibility FederationがTopic本文を複製せず、現在Principalに見える一意なOwnerへRelationを戻すことを検証する。
 * @trace RFD-IT-013
 * @precondition Management Credential、DEV／MGMT Exposureおよび別OwnerのTopicを用意する。
 * @stimulus DEV Topic詳細をRemote MCPから取得する。
 * @observation Structured ContentのRelation状態とOwner Repositoryを観測する。
 * @oracle RelationはavailableかつREPO-MGMT所有となり、対象本文をDEVへ複製しない。
 * @cleanup MCP Listenerと二つの検証用Repository Rootを削除する。
 * @boundary RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
 */
test("CROSはRepository間Relationを許可済みOwnerへ解決する", async () => {
  const devRoot = mkdtempSync(path.join(tmpdir(), "crdd-cros-rel-dev-"));
  const mgmtRoot = mkdtempSync(path.join(tmpdir(), "crdd-cros-rel-mgmt-"));
  const dev = Object.freeze({
    topic: createTopicOperations(devRoot),
    meeting: createMeetingOperations(devRoot),
  });
  const mgmt = Object.freeze({
    topic: createTopicOperations(mgmtRoot),
    meeting: createMeetingOperations(mgmtRoot),
  });
  assert.equal(
    dev.topic.create(relatedTopic("TOPIC-000101", "TOPIC-000201")).status,
    "completed",
  );
  assert.equal(
    mgmt.topic.create(relatedTopic("TOPIC-000201", "TOPIC-000101")).status,
    "completed",
  );
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "management",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const repositories = [
    {
      projectId: "PRJ-MCP",
      repositoryId: "REPO-DEV",
      bindingId: "BIND-DEV",
      revision: "dev-rel-1",
      content: { projectContext: context("REPO-DEV", "development") },
    },
    {
      projectId: "PRJ-MCP",
      repositoryId: "REPO-MGMT",
      bindingId: "BIND-MGMT",
      revision: "mgmt-rel-1",
      content: { projectContext: context("REPO-MGMT", "management") },
    },
  ] as const;
  const resolver = createCrosProjectContextMcpResolver({
    registry,
    readExposureSnapshot: () => ({
      revision: "exposure-rel-1",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: "REPO-DEV",
          repositoryRevision: "dev-rel-1",
          registryRevision: "exposure-rel-1",
          active: true,
        },
        {
          workspaceId: "management",
          repositoryId: "REPO-MGMT",
          repositoryRevision: "mgmt-rel-1",
          registryRevision: "exposure-rel-1",
          active: true,
        },
      ],
      repositories,
    }),
    resolveTopicMeetingAccess: (repository) =>
      repository.repositoryId === "REPO-DEV"
        ? dev
        : repository.repositoryId === "REPO-MGMT"
          ? mgmt
          : null,
  });
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  try {
    const response = await getRemoteTopic(
      `http://${server.host}:${server.port}`,
      issued.token,
      "REPO-DEV",
      "TOPIC-000101",
    );
    assert.equal(response.status, 200);
    const body = JSON.stringify(await response.json());
    assert.match(body, /TOPIC-000201/u);
    assert.match(body, /"state":"available"/u);
    assert.match(body, /"ownerRepositoryId":"REPO-MGMT"/u);
    assert.equal(dev.topic.get("TOPIC-000201"), null);
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
    rmSync(devRoot, { recursive: true, force: true });
    rmSync(mgmtRoot, { recursive: true, force: true });
  }
});

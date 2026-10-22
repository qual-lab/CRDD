/**
 * MCP Profile Adapterの現在認可、採用後故障、結果相関を検証する。
 * @packageDocumentation
 * @responsibility 既存AdapterのOracleを旧CROS構成と分離して保持する。
 * @trace RFD-IT-013
 * @trace RCM-IT-005
 * @trace RCM-IT-010
 * @trace EST-IT-002
 * @level IT
 * @scope 遅延認可、Profile採用後故障・取消、公開結果相関。
 * @boundary MCP Routing／Adapter→AI Adapter。Host資格・旧Gatewayは使わない。
 */
import assert from "node:assert/strict";
import { invokeMcpRequest } from "../fixtures/sdk-request.ts";
import test from "node:test";
import {
  defaultAiProfileCatalog,
  validateAiProfileCatalog,
  type AiProfileCatalogStore,
  type AiProfileCatalogSnapshot,
  createAiProfileCatalogAdministration,
  type AiProfileCatalogMutationResult,
} from "../../../ai-adapter/src/index.ts";
import {
  MCP_AI_PROFILE_TOOLS,
  handleMcpAiProfileRequest,
  MCP_COORDINATOR_PROTOCOL_VERSION,
} from "../../src/index.ts";

/**
 * Profile遅延認可の順序と静的依存の排他を確認する。
 * @responsibility 入力検査前の認可、古い許可の再利用、二依存fallbackを反証する。
 * @trace RFD-IT-013
 * @trace RCM-IT-010
 * @precondition 既存Catalog操作と要求毎に許可状態を変えるResolver。
 * @stimulus 一覧、許可後拒否、観測不能、不正入力、事前取消、二依存を送る。
 * @observation 認可・Catalog観測回数、固定Protocol結果。
 * @oracle 完全入力後だけ認可1回、deniedは非公開、unknownは内部エラー、二依存は認可/Store0。
 * @cleanup N/A: Process内Catalogのみで外部資源なし。
 * @boundary MCP Routing→遅延認可→同期Catalog。
 */
test("Profile遅延認可は現在判定と二依存拒否を分離する", async () => {
  const administration = createAiProfileCatalogAdministration(
    createTestCatalogStore(defaultAiProfileCatalog),
  );
  let resolutions = 0,
    reads = 0;
  let access: "allowed" | "denied" | "unavailable" = "allowed";
  const counted = {
    snapshot: () => {
      reads++;
      return administration.snapshot();
    },
    execute: administration.execute,
  };
  const dependencies = {
    projectContext: {
      readPortfolio: async () => {
        throw new Error("unexpected content");
      },
    },
    aiProfileAdministrationResolver: () => {
      resolutions++;
      if (access === "unavailable") throw new Error("private state");
      return access === "allowed" ? counted : null;
    },
  };
  const request = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: MCP_AI_PROFILE_TOOLS.list,
      arguments: {},
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_COORDINATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
  const listing = {
    ...request,
    method: "tools/list",
    params: { _meta: request.params._meta },
  };
  const first = await invokeMcpRequest(listing, dependencies);
  assert.equal(JSON.stringify(first).includes(MCP_AI_PROFILE_TOOLS.list), true);
  assert.equal(resolutions, 1);
  assert.equal(reads, 0);
  access = "denied";
  const denied = await invokeMcpRequest(request, dependencies);
  assert.ok("error" in denied);
  assert.equal(denied.error.code, -32601);
  assert.equal(resolutions, 2);
  assert.equal(reads, 0);
  access = "unavailable";
  const unknown = await invokeMcpRequest(listing, dependencies);
  assert.ok("error" in unknown);
  assert.equal(unknown.error.code, -32603);
  assert.equal(JSON.stringify(unknown).includes("private state"), false);
  const before = resolutions;
  const invalid = await invokeMcpRequest(
    { ...request, params: { ...request.params, arguments: { extra: true } } },
    dependencies,
  );
  assert.ok("error" in invalid);
  assert.equal(invalid.error.code, -32602);
  const abort = new AbortController();
  abort.abort();
  const cancelled = await invokeMcpRequest(request, dependencies, abort.signal);
  assert.ok("error" in cancelled);
  assert.equal(cancelled.error.code, -32800);
  const unknownTool = await invokeMcpRequest(
    { ...request, params: { ...request.params, name: "unknown" } },
    dependencies,
  );
  assert.ok("error" in unknownTool);
  assert.equal(unknownTool.error.code, -32601);
  for (const raw of [listing, request]) {
    const conflict = await invokeMcpRequest(raw, {
      ...dependencies,
      aiProfileAdministration: counted,
    });
    assert.ok("error" in conflict);
    assert.equal(conflict.error.code, -32603);
  }
  assert.equal(resolutions, before);
  assert.equal(reads, 0);
  access = "allowed";
  const result = await invokeMcpRequest(request, dependencies);
  assert.ok("result" in result);
  assert.equal(resolutions, before + 1);
  assert.equal(reads, 1);
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
  const baseProfile = defaultAiProfileCatalog.profiles[0];
  assert.ok(baseProfile);
  const store = createTestCatalogStore(defaultAiProfileCatalog);
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
          MCP_COORDINATOR_PROTOCOL_VERSION,
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
    () => port,
    abort.signal,
  );
  assert.ok("error" in cancelled);
  assert.equal(cancelled.error.code, -32800);
  assert.equal(calls, 0);
  const failure = await handleMcpAiProfileRequest(
    request,
    () => port,
    new AbortController().signal,
  );
  assert.ok("error" in failure);
  assert.equal(failure.error.code, -32603);
  assert.doesNotMatch(JSON.stringify(failure), /private_error_secret/u);
  assert.equal(calls, 1);
  assert.equal(store.snapshot().value?.revision, 2);
  assert.equal(
    store
      .snapshot()
      .value?.catalog.profiles.some(
        (item) => item.profileId === profile.profileId,
      ),
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
    () => ({
      snapshot: administration.snapshot,
      execute: (mutation) => {
        calls += 1;
        const result = administration.execute(mutation);
        afterAdoption.abort();
        return result;
      },
    }),
    afterAdoption.signal,
  );
  assert.ok("error" in final);
  assert.equal(final.error.code, -32800);
  assert.equal(calls, 2);
  assert.equal(store.snapshot().value?.revision, 3);
  assert.equal(
    store
      .snapshot()
      .value?.catalog.profiles.find(
        (item) => item.profileId === profile.profileId,
      )?.family,
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
  const baseProfile = defaultAiProfileCatalog.profiles[0];
  assert.ok(baseProfile);
  const profile = {
    ...baseProfile,
    profileId: "PROFILE-900003",
    family: "owned-result",
  };
  const validCatalog = structuredClone({
    ...defaultAiProfileCatalog,
    profiles: [...defaultAiProfileCatalog.profiles, profile],
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
        status: "unknown",
        reason: "ai_profile_catalog_save_unconfirmed",
        snapshot: null,
      },
    ],
    [
      MCP_AI_PROFILE_TOOLS.create,
      { expectedRevision: 1, profile },
      {
        status: "unknown",
        reason: "ai_profile_catalog_read_failed",
        snapshot: null,
      },
    ],
    [
      MCP_AI_PROFILE_TOOLS.create,
      { expectedRevision: 1, profile },
      {
        ...valid,
        snapshot: { revision: 2, catalog: defaultAiProfileCatalog },
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
        snapshot: { revision: 2, catalog: defaultAiProfileCatalog },
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
        snapshot: { revision: 2, catalog: defaultAiProfileCatalog },
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
        snapshot: { revision: 1, catalog: defaultAiProfileCatalog },
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
              MCP_COORDINATOR_PROTOCOL_VERSION,
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
            MCP_COORDINATOR_PROTOCOL_VERSION,
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
 * 管理操作試験用の局所Catalog保存代役を作る。
 * @responsibility 本番保存を使わず改訂競合と採用後のSnapshotを試験へ提供する。
 * @trace RCM-IT-005
 * @precondition 初期候補は既存Catalog Validatorで検証できる。
 * @stimulus snapshotとadoptを管理操作へ渡す。
 * @observation 改訂、採用値、拒否理由を返す。
 * @oracle 不正・競合は不変、妥当な採用だけ改訂を一つ進める。
 * @cleanup N/A: 試験内のメモリだけで資源を持たない。
 * @boundary 試験の保存代役であり本番の耐久保存を保証しない。
 */
function createTestCatalogStore(
  initialCandidate: unknown,
): AiProfileCatalogStore {
  const initialCatalog = validateAiProfileCatalog(initialCandidate).value;
  if (!initialCatalog) throw new Error("ai_profile_catalog_initial_invalid");
  let current: AiProfileCatalogSnapshot = Object.freeze({
    revision: 1,
    catalog: initialCatalog,
  });
  return Object.freeze({
    snapshot: () =>
      Object.freeze({ status: "read" as const, value: current, error: null }),
    adopt: (request) => {
      if (request.expectedRevision !== current.revision)
        return Object.freeze({
          status: "rejected" as const,
          reason: "revision_conflict" as const,
          revision: current.revision,
          snapshot: current,
        });
      const validated = validateAiProfileCatalog(request.candidate).value;
      if (!validated)
        return Object.freeze({
          status: "rejected" as const,
          reason: "catalog_invalid" as const,
          revision: current.revision,
          snapshot: current,
        });
      current = Object.freeze({
        revision: current.revision + 1,
        catalog: validated,
      });
      return Object.freeze({
        status: "adopted" as const,
        revision: current.revision,
        snapshot: current,
      });
    },
  });
}

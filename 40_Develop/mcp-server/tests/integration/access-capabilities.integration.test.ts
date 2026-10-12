/**
 * AMの現在認可から内容操作を実HTTPで搬送する。
 * @packageDocumentation
 * @responsibility 初回未完了・失効・空認可・本文不明と取消を非開示結果へ照合する。
 * @trace PPR-IT-002
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace RCM-IT-005
 * @trace RCM-IT-010
 * @trace EST-IT-002
 * @trace EST-IT-014
 * @level IT
 * @scope MCP専用Resolver、AM、Domain固定本文、HTTP。
 * @boundary 自己生成Store／Repositoryから既存HTTP Transportまで。公開Launcherの完成ではない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import test, { type TestContext } from "node:test";
import {
  createAiProfileCatalogAdministration,
  createRepositoryAiProfileCatalogStore,
  DEFAULT_AI_PROFILE_CATALOG,
} from "../../../ai-adapter/src/index.ts";
import {
  createInitialAdministrator,
  createInitialCredential,
  initializeAccessManagementState,
  registerRepository,
  updateExposure,
  type AccessManagementState,
} from "../../../access-management/src/index.ts";
import {
  createFilesystemStoreRoot,
  createTopicOperations,
  createMeetingOperations,
} from "../../../domain-model/src/index.ts";
import {
  createAccessMcpResolver,
  MCP_TOPIC_MEETING_TOOLS,
  MCP_AI_PROFILE_TOOLS,
  startMcpAuthenticatedStreamableHttp,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_RUNTIME_ACTIVITY_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
} from "../../src/index.ts";
import {
  createOrchestratorState,
  initializeOrchestratorSnapshot,
} from "../../../orchestrator/src/index.ts";
import { writeOrchestratorSnapshotState } from "../../../orchestrator/src/storage/current-state.ts";
import {
  createTaskAttemptSettledEvent,
  writeExecutionIntelligenceEvent,
  verifyExecutionIntelligenceRepositoryRoot,
  usageNotObserved,
} from "../../../execution-intelligence/src/index.ts";

/**
 * 共有Profile管理の現在Roleと四操作を実HTTPで接続する。
 * @responsibility 内容Grantを管理許可へ転用せず、現在Role・失効・観測不能を分離する。
 * @trace RFD-IT-013
 * @trace RCM-IT-005
 * @trace RCM-IT-010
 * @precondition 自己生成AM Store、通常資格、実Catalog Storeを用意する。
 * @stimulus 同Tokenをmanager/admin/developerへ変更し四操作・一覧・失効・破損を要求する。
 * @observation HTTP結果、Catalog改訂、Store呼出し回数、固定非開示エラー。
 * @oracle manager/adminだけ管理し、developerはStore0。失効・状態不明は通常拒否に畳まない。
 * @cleanup Server closeとFixture所有Rootの回収・不存在確認。
 * @boundary 実HTTP→現在AM認可→AI Adapterの実保存・応答。
 */
test("AM Profile MCPは現在Roleの四操作と非開示を実保存へ接続する", async (t) => {
  const f = fixture(t);
  const target = f.targets[0];
  assert.ok(target);
  const configured = createRepositoryAiProfileCatalogStore(target.target);
  assert.equal(configured.status, "ready");
  if (configured.status !== "ready")
    throw new Error("catalog fixture unavailable");
  const administration = createAiProfileCatalogAdministration(configured.store);
  let reads = 0,
    mutations = 0;
  const counted = {
    snapshot: () => {
      reads++;
      return administration.snapshot();
    },
    execute: (mutation: Parameters<typeof administration.execute>[0]) => {
      mutations++;
      return administration.execute(mutation);
    },
  };
  const resolver = createAccessMcpResolver(f.root, counted);
  const handler = await resolver(f.token);
  assert.ok(handler);
  const listRequest = {
    ...packet(),
    method: "tools/list",
    params: { _meta: packet().params._meta },
  };
  const state = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const user = state.users[0],
    credential = state.credentials[0];
  assert.ok(user && credential);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}`;
  try {
    const deniedList = await handler(listRequest, new AbortController().signal);
    assert.ok("result" in deniedList);
    assert.equal(
      JSON.stringify(deniedList).includes(MCP_AI_PROFILE_TOOLS.list),
      false,
    );
    const denied = await call(base, f.token, MCP_AI_PROFILE_TOOLS.list, {});
    assert.equal((await denied.json()).error.code, -32601);
    assert.equal(reads + mutations, 0);
    for (const role of ["manager", "administrator"] as const) {
      user.role = role;
      fs.writeFileSync(f.current, JSON.stringify(state));
      const listedTools = await handler(
        listRequest,
        new AbortController().signal,
      );
      for (const name of Object.values(MCP_AI_PROFILE_TOOLS))
        assert.equal(JSON.stringify(listedTools).includes(name), true);
      const listed = await (
        await call(base, f.token, MCP_AI_PROFILE_TOOLS.list, {})
      ).json();
      const revision = listed.result.structuredContent.revision;
      const original = DEFAULT_AI_PROFILE_CATALOG.profiles[0];
      assert.ok(original);
      const profile = {
        ...original,
        profileId: "PROFILE-900042",
        family: "am-profile-fixture",
      };
      for (const [name, args] of [
        [MCP_AI_PROFILE_TOOLS.create, { expectedRevision: revision, profile }],
        [
          MCP_AI_PROFILE_TOOLS.update,
          {
            expectedRevision: revision + 1,
            profile: { ...profile, family: "updated-fixture" },
          },
        ],
        [
          MCP_AI_PROFILE_TOOLS.delete,
          {
            expectedRevision: revision + 2,
            profileId: profile.profileId,
            confirmed: true,
          },
        ],
      ] as const) {
        const response = await (await call(base, f.token, name, args)).json();
        assert.equal(response.result.structuredContent.status, "completed");
      }
      assert.equal(administration.snapshot().revision, revision + 3);
    }
    user.role = "developer";
    fs.writeFileSync(f.current, JSON.stringify(state));
    const before = reads + mutations;
    const afterRoleChange = await handler(
      packet(MCP_AI_PROFILE_TOOLS.list, {}),
      new AbortController().signal,
    );
    assert.ok("error" in afterRoleChange);
    assert.equal(afterRoleChange.error.code, -32601);
    credential.revoked = true;
    fs.writeFileSync(f.current, JSON.stringify(state));
    const revoked = await handler(listRequest, new AbortController().signal);
    assert.ok("error" in revoked);
    assert.equal(revoked.error.code, -32603);
    assert.equal(
      (await call(base, f.token, MCP_AI_PROFILE_TOOLS.list, {})).status,
      401,
    );
    credential.revoked = false;
    assert.equal(state.initialization.stage, "completed");
    state.initialization = {
      stage: "credential_stored",
      attemptId: state.initialization.attemptId,
      userId: user.userId,
      initialCredentialId: credential.credentialId,
      confirmationCredentialId: credential.credentialId,
    };
    fs.writeFileSync(f.current, JSON.stringify(state));
    const unfinished = await handler(
      packet(MCP_AI_PROFILE_TOOLS.list, {}),
      new AbortController().signal,
    );
    assert.ok("error" in unfinished);
    assert.equal(unfinished.error.code, -32603);
    fs.writeFileSync(f.current, "{}");
    const unknown = await handler(listRequest, new AbortController().signal);
    assert.ok("error" in unknown);
    assert.equal(unknown.error.code, -32603);
    assert.equal(reads + mutations, before);
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 活動Ownerへの現在認可接続を実HTTPと自己生成保存領域で確認する。
 * @responsibility 別Projectと空公開範囲を非開示にし、毎Callの許可変更を反映する。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @precondition 初回完了済み資格と同Projectの二Repository。
 * @stimulus 不存在取得、別Rootへ状態／履歴保存、異Project、Exposure部分／全解除、資格失効を順に送る。
 * @observation 実HTTP応答、全Sourceと実Git改訂、現在Owner、状態・履歴の値と非秘密結果。
 * @oracle 不存在はabsent、Aの状態とBの履歴を同時搬送し、A解除後はB履歴だけ保持、空認可はunavailable、失効は401である。
 * @cleanup Listener終了後にFixture所有Rootを回収する。
 * @boundary 実HTTP→現在AM認可→実Orchestrator保存Reader。
 */
test("AM活動MCPは実保存観測と現在Exposure・失効を接続する", async (t) => {
  const f = fixture(t);
  const expectedSources = f.targets.map(({ id, target }) => {
    const committed = spawnSync(
      "git",
      [
        "-C",
        target,
        "-c",
        "user.name=Activity Fixture",
        "-c",
        "user.email=activity@example.invalid",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { encoding: "utf8", windowsHide: true },
    );
    assert.equal(committed.status, 0, committed.stderr);
    const revision = spawnSync("git", ["-C", target, "rev-parse", "HEAD"], {
      encoding: "utf8",
      windowsHide: true,
    });
    assert.equal(revision.status, 0, revision.stderr);
    return { repositoryId: id, revision: revision.stdout.trim() };
  });
  const server = await startMcpAuthenticatedStreamableHttp(
    createAccessMcpResolver(f.root),
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  try {
    const response = await call(base, f.token, MCP_RUNTIME_ACTIVITY_TOOL, {
      projectId: "project.fixture",
    });
    assert.equal(response.status, 200);
    const text = await response.text();
    const observed = JSON.parse(text).result.structuredContent;
    assert.equal(observed.projectId, "project.fixture");
    assert.equal(observed.state, "absent");
    assert.equal(observed.reason, "runtime_activity_state_absent");
    assert.deepEqual(observed.sources, expectedSources);
    assert.equal(observed.eventState, "observed");
    assert.deepEqual(observed.events, []);
    assert.equal(observed.eventContinuation, null);
    assert.equal(text.includes(f.token), false);
    for (const target of f.targets)
      assert.equal(text.includes(target.target), false);
    const foreign = await call(base, f.token, MCP_RUNTIME_ACTIVITY_TOOL, {
      projectId: "project.other",
    });
    assert.equal((await foreign.json()).result.isError, true);
    const a = f.targets[0],
      b = f.targets[1],
      sourceA = expectedSources[0];
    assert.ok(a && b && sourceA);
    const binding = `binding-${createHash("sha256").update(a.target).digest("hex").slice(0, 40)}`;
    assert.equal(
      initializeOrchestratorSnapshot(a.target, binding).status,
      "completed",
    );
    const saved = createOrchestratorState({
      projectId: "project.fixture",
      milestoneId: "milestone.fixture",
      repositoryRevision: sourceA.revision,
      maximumConcurrency: 1,
      milestoneAcceptanceCriteria: ["accepted"],
      objectives: [
        { id: "objective.fixture", acceptanceCriteria: ["accepted"] },
      ],
      tasks: [
        {
          id: "task.fixture",
          objectiveId: "objective.fixture",
          dependencies: [],
          allowedPaths: ["result.txt"],
          conflictKeys: [],
        },
      ],
      ownerGeneration: "owner.fixture",
    });
    assert.ok(saved.state);
    assert.equal(
      writeOrchestratorSnapshotState(
        a.target,
        binding,
        JSON.stringify(saved.state),
        0,
      ).status,
      "completed",
    );
    const history = createTaskAttemptSettledEvent({
      occurredAt: "2026-10-12T00:00:00.000Z",
      identity: {
        projectId: "project.fixture",
        milestoneId: "milestone.fixture",
        objectiveId: "objective.fixture",
        taskId: "task.history",
        attemptId: "attempt.history",
        operationId: "operation.history",
      },
      outcome: {
        status: "completed",
        reason: "task_completed",
        effectState: "settled",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        processRestartRequired: false,
      },
      execution: {
        role: "executor",
        provider: { state: "not_observed", reason: "provider_not_reported" },
        model: { state: "not_observed", reason: "model_not_reported" },
        inputStrategyRef: {
          state: "not_observed",
          reason: "input_not_reported",
        },
        durationMs: { state: "not_observed", reason: "duration_not_reported" },
        usage: usageNotObserved("usage_not_reported"),
        humanActiveMs: {
          state: "not_observed",
          reason: "human_time_not_reported",
        },
      },
      quality: {
        state: "not_applicable",
        reason: "attempt_settlement_is_not_acceptance",
      },
    });
    const ei = verifyExecutionIntelligenceRepositoryRoot(b.target);
    assert.equal(ei.status, "completed");
    if (ei.status !== "completed") throw new Error("fixture_ei_root_invalid");
    assert.equal(
      writeExecutionIntelligenceEvent(ei.root, history).status,
      "completed",
    );
    const presentResponse = await call(
      base,
      f.token,
      MCP_RUNTIME_ACTIVITY_TOOL,
      { projectId: "project.fixture" },
    );
    const presentText = await presentResponse.text();
    const present = JSON.parse(presentText).result.structuredContent;
    assert.equal(present.state, "observed");
    assert.equal(present.currentSourceRepositoryId, a.id);
    assert.equal(present.projection.projectId, "project.fixture");
    assert.equal(present.projection.milestoneId, "milestone.fixture");
    assert.equal(present.projection.taskCounts.ready, 1);
    assert.deepEqual(present.sources, expectedSources);
    assert.deepEqual(present.events, [
      {
        repositoryId: b.id,
        eventId: history.eventId,
        occurredAt: history.occurredAt,
        objectiveId: "objective.fixture",
        taskId: "task.history",
        attemptId: "attempt.history",
        status: "completed",
        reason: "task_completed",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
      },
    ]);
    assert.equal(presentText.includes(f.token), false);
    for (const target of f.targets)
      assert.equal(presentText.includes(target.target), false);
    const state = JSON.parse(
      fs.readFileSync(f.current, "utf8"),
    ) as AccessManagementState;
    state.exposure = state.exposure.filter(
      (entry) => entry.repositoryId !== a.id,
    );
    fs.writeFileSync(f.current, JSON.stringify(state));
    const partial = await call(base, f.token, MCP_RUNTIME_ACTIVITY_TOOL, {
      projectId: "project.fixture",
    });
    const partialText = await partial.text();
    const remaining = JSON.parse(partialText).result.structuredContent;
    assert.deepEqual(remaining.sources, [expectedSources[1]]);
    assert.equal(remaining.state, "absent");
    assert.equal(remaining.currentSourceRepositoryId, null);
    assert.equal(remaining.projection, null);
    assert.deepEqual(remaining.events, present.events);
    assert.equal(partialText.includes(a.id), false);
    assert.equal(partialText.includes("milestone.fixture"), false);
    state.exposure = [];
    fs.writeFileSync(f.current, JSON.stringify(state));
    const denied = await call(base, f.token, MCP_RUNTIME_ACTIVITY_TOOL, {
      projectId: "project.fixture",
    });
    const deniedBody = await denied.text();
    assert.equal(JSON.parse(deniedBody).result.isError, true);
    for (const target of f.targets)
      assert.equal(deniedBody.includes(target.id), false);
    const credential = state.credentials[0];
    assert.ok(credential);
    credential.revoked = true;
    fs.writeFileSync(f.current, JSON.stringify(state));
    assert.equal(
      (
        await call(base, f.token, MCP_RUNTIME_ACTIVITY_TOOL, {
          projectId: "project.fixture",
        })
      ).status,
      401,
    );
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 自己生成の管理Storeと二Repositoryを準備する。
 * @responsibility 実Hostや秘密値を使わず現在認証・登録・公開の前提を構成する。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @precondition Repository-localの試験Rootだけに書き込む。
 * @stimulus 初回公開保存APIと登録／Exposure APIを使用し、完了状態は試験fixtureで準備する。
 * @observation 保存状態・Git初期化・各公開管理結果。
 * @oracle 実配送成立は主張せず、二つの認可対象を同じProjectへ用意する。
 * @cleanup 呼出側のListener終了後に所有Directoryだけを削除し不存在を確認する。
 * @boundary 自己生成Filesystem、Git、AM公開保存入口。
 */
function fixture(t: TestContext, completed = true) {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  assert.ok(fs.statSync(path.join(repository, ".git")).isDirectory());
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(path.join(parent, "mcp-access-context-"));
  t.after(() => {
    assert.equal(path.dirname(directory), parent);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const store = path.join(directory, "store");
  fs.mkdirSync(store);
  const root = createFilesystemStoreRoot(store);
  assert.ok(root);
  const attempt = randomUUID();
  assert.equal(
    initializeAccessManagementState(root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  assert.equal(
    createInitialAdministrator(root, attempt, "試験管理者").status,
    "completed",
  );
  const issued = createInitialCredential(root, attempt);
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed" || !issued.value.token)
    throw new Error("fixture credential unavailable");
  const token = issued.value.token;
  const current = path.join(store, "access-management.json");
  const targets = ["repository.a", "repository.b"].map((id) => {
    const target = path.join(directory, id);
    fs.mkdirSync(target);
    const git = spawnSync("git", ["init", "--quiet", target], {
      encoding: "utf8",
    });
    assert.equal(git.status, 0, git.stderr);
    fs.mkdirSync(path.join(target, ".crdd", "config"), { recursive: true });
    fs.writeFileSync(
      path.join(target, ".crdd", "config", "repository-manifest.json"),
      JSON.stringify({
        schema: "crdd/repository-manifest/v2",
        projectId: "project.fixture",
        repositoryId: id,
        displayName: "試験",
        repositoryRole: "development",
        capabilities: [],
        contextSurfaces: [],
        externalSendPolicy: null,
      }),
    );
    const context =
      `# Project Context\n\nProject ID: project.fixture\nRepository ID: ${id}\nRepository Role: development\n` +
      [
        "今どうなっているか",
        "何が危ない、または止まっているか",
        "今、人間が決めることは何か",
        "なぜこの状態・判断になったか",
        "次に何をすべきか",
      ]
        .map(
          (heading, i) =>
            `\n## ${i + 1}. ${heading}\n\n### 結論\n\n自己生成試験。\n\n| 項目 | 内容 |\n|---|---|\n| 試験 | 固定 |\n`,
        )
        .join("");
    const body = path.join(target, "PROJECT_CONTEXT.md");
    fs.writeFileSync(body, context);
    return { id, target, body, context };
  });
  if (completed) {
    const state = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    const user = state.users[0],
      credential = state.credentials[0];
    assert.ok(user && credential);
    state.initialization = {
      stage: "completed",
      attemptId: attempt,
      initialUserId: user.userId,
      initialCredentialId: credential.credentialId,
      confirmationCredentialId: credential.credentialId,
      connection: "confirmed",
    };
    credential.presentation = "confirmed";
    fs.writeFileSync(current, JSON.stringify(state));
    let revision = state.revision;
    for (const target of targets) {
      assert.equal(
        registerRepository(
          root,
          token,
          revision++,
          randomUUID(),
          target.id,
          target.target,
        ).status,
        "completed",
      );
      assert.equal(
        updateExposure(root, token, revision++, randomUUID(), target.id, [
          "development",
        ]).status,
        "completed",
      );
    }
    const ready = JSON.parse(
      fs.readFileSync(current, "utf8"),
    ) as AccessManagementState;
    const actor = ready.users[0];
    assert.ok(actor);
    actor.role = "developer";
    fs.writeFileSync(current, JSON.stringify(ready));
  }
  return { root, token, current, targets };
}

/**
 * 内容ToolのJSON-RPC要求を作る。
 * @responsibility 実HTTPと直接Handlerで同じwire入力を使用する。
 * @trace PPR-IT-002
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 宣言済みToolと対応引数を指定する。
 * @stimulus 閉じたEnvelopeとProtocol metadataを構築する。
 * @observation JSON-RPC結果へ同じidが戻る。
 * @oracle Token・RootはTool引数へ含めない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary MCP入力Schema。
 */
function packet(
  tool = MCP_PROJECT_CONTEXT_GET_TOOL as string,
  args?: Record<string, unknown>,
) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: tool,
      arguments:
        args ??
        (tool === MCP_PROJECT_CONTEXT_LIST_TOOL
          ? {}
          : { projectId: "project.fixture" }),
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_ORCHESTRATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

/**
 * 認証済みHTTPで内容Toolを呼ぶ。
 * @responsibility 既存TransportのHeader・本文検査を迂回しない。
 * @trace PPR-IT-002
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @trace EST-IT-002
 * @precondition 起動済みloopback Listener。
 * @stimulus Bearerと固定metadataをPOSTする。
 * @observation HTTP statusとMCP body。
 * @oracle 秘密は認証Headerだけへ渡す。
 * @cleanup 呼出側がServerをcloseしてjoinする。
 * @boundary 実HTTP→MCP Adapter。
 */
function call(
  base: string,
  token: string,
  tool = MCP_PROJECT_CONTEXT_GET_TOOL as string,
  args?: Record<string, unknown>,
) {
  return fetch(`${base}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": tool,
    },
    body: JSON.stringify(packet(tool, args)),
  });
}

/**
 * Project拘束を検証するTopic本文を作る。
 * @responsibility 改訂・状態と明示Projectを持つ固定入力を提供する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 自己生成Repositoryのみで使用する。
 * @stimulus 指定改訂とProjectの本文を構成する。
 * @observation Parserと実保存結果。
 * @oracle Project以外の必須Meaningを欠落させない。
 * @cleanup N/A: メモリ文字列のみ。
 */
function topicMarkdown(
  revision = 1,
  project = "project.fixture",
  state = "open",
) {
  return `# Topic\n\n成果物種別: Topic\nTopic ID: \`TOPIC-000042\`\nProject ID: \`${project}\`\n状態: \`${state}\`\n改訂: \`${revision}\`\n維持責任者: \`PM\`\n\n## 1. 現在の論点\n\n### 結論\n\nHTTP接続を確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| related | \`MTG-000042\` | 同ProjectのMeeting |\n\n## 5. 終了・昇格\n\n| 項目 | 内容 |\n|---|---|\n| 処置 | \`N/A: 未処置\` |\n| 昇格先 | \`N/A: 未昇格\` |\n| 終了理由 | \`N/A: 未終了\` |\n| 残る影響 | \`N/A: 未終了\` |\n`;
}

/**
 * Outcomeを持つMeeting本文を作る。
 * @responsibility 明示Projectと改訂を持つ固定入力を提供する。
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @precondition 自己生成Repositoryのみで使用する。
 * @stimulus 未処置Outcomeを含む本文を構成する。
 * @observation Parserと実保存結果。
 * @oracle Outcome処置と通常更新を区別できる。
 * @cleanup N/A: メモリ文字列のみ。
 */
function meetingMarkdown(revision = 1, project = "project.fixture") {
  return `# Meeting\n\n成果物種別: Meeting\nMeeting ID: \`MTG-000042\`\nProject ID: \`${project}\`\n状態: \`recorded\`\n開催日時: \`2026-10-12 10:00 JST\`\n改訂: \`${revision}\`\n維持責任者: \`PM\`\n\n## 1. 目的と要約\n\n### 結論\n\nHTTP接続を確認する。\n\n## 4. Outcome\n\n| Local ID | 種別 | 内容 | 状態 | Owner | 期限／再評価契機 | 追跡先 |\n|---|---|---|---|---|---|---|\n| \`OUT-001\` | Action | 確認する | \`pending\` | PM | 次回 | \`N/A: 未移管\` |\n\n## 5. Actionと移管\n\n| Outcome | 処置 | 追跡先 | 完了条件 | 結果 |\n|---|---|---|---|---|\n| \`OUT-001\` | | | | |\n\n## 6. Close・訂正\n\n| 項目 | 内容 |\n|---|---|\n| Close判定 | \`OPEN: 未処置\` |\n| 未処置Outcome | \`OUT-001\` |\n| 訂正元／訂正先 | \`N/A: 訂正なし\` |\n| 残る影響 | |\n`;
}

/**
 * 全12操作を実HTTP・現在AM認可・実Domain保存へ接続する。
 * @responsibility Tool登録だけを操作成立とせず保存内容と結果を照合する。
 * @trace CPR-IT-010
 * @trace RFD-IT-013
 * @precondition 初回完了済み自己生成Store、二つの同Project Repository。
 * @stimulus 両種別のCRUD、Topic昇格、Meeting Outcomeを順に実行する。
 * @observation wire結果、実Record、Relation Ownerと不存在。
 * @oracle 公開12Toolすべて成功し、指定Repositoryだけを変更する。
 * @cleanup Server終了確認後に所有Fixtureを回収する。
 */
test("AM内容MCPの全12操作は指定Repositoryの実保存へ到達する", async (t) => {
  const f = fixture(t),
    a = f.targets[0],
    b = f.targets[1];
  assert.ok(a && b);
  const topic = createTopicOperations(a.target, "project.fixture");
  const meeting = createMeetingOperations(a.target, "project.fixture");
  const change = path.join(a.target, "99_Roadmap", "Changes", "CHG-000010");
  fs.mkdirSync(change, { recursive: true });
  fs.writeFileSync(path.join(change, "change.md"), "# Change\n");
  const server = await startMcpAuthenticatedStreamableHttp(
    createAccessMcpResolver(f.root),
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  const commands: [string, Record<string, unknown>][] = [
    ["crdd.create_topic", { markdown: topicMarkdown() }],
    ["crdd.create_meeting", { markdown: meetingMarkdown() }],
    ["crdd.list_topics", {}],
    ["crdd.list_meetings", {}],
    ["crdd.get_topic", { id: "TOPIC-000042" }],
    ["crdd.get_meeting", { id: "MTG-000042" }],
    [
      "crdd.update_topic",
      {
        id: "TOPIC-000042",
        expectedRevision: 1,
        markdown: topicMarkdown(2, "project.fixture", "waiting"),
      },
    ],
    [
      "crdd.update_meeting",
      { id: "MTG-000042", expectedRevision: 1, markdown: meetingMarkdown(2) },
    ],
    [
      "crdd.promote_topic",
      {
        topicId: "TOPIC-000042",
        expectedRevision: 2,
        changeId: "CHG-000010",
        reason: "採用",
        remainingResponsibility: "終了確認",
      },
    ],
    [
      "crdd.treat_meeting_outcome",
      {
        meetingId: "MTG-000042",
        expectedRevision: 2,
        outcomeId: "OUT-001",
        disposition: "completed",
        owner: "PM",
        reviewTrigger: "次回",
        targetKind: "none",
        targetReference: "N/A: 完了",
        treatment: "確認済み",
        completionCondition: "確認",
        result: "完了",
        closeMeeting: true,
      },
    ],
    [
      "crdd.delete_topic",
      {
        id: "TOPIC-000042",
        expectedRevision: 3,
        confirmed: true,
        reason: "mistaken_registration",
      },
    ],
    [
      "crdd.delete_meeting",
      {
        id: "MTG-000042",
        expectedRevision: 3,
        confirmed: true,
        reason: "mistaken_registration",
      },
    ],
  ];
  assert.deepEqual(
    commands.map(([name]) => name).sort(),
    [...MCP_TOPIC_MEETING_TOOLS].sort(),
  );
  try {
    const discovery = await fetch(`${base}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${f.token}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "mcp-protocol-version": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
        "mcp-method": "tools/list",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: { _meta: packet().params._meta },
      }),
    });
    assert.equal(discovery.status, 200);
    const tools = (await discovery.json()).result.tools as {
      name: string;
      inputSchema: {
        properties: Record<string, unknown>;
        required?: string[];
        additionalProperties: boolean;
      };
    }[];
    assert.deepEqual(
      tools.map(({ name }) => name).sort(),
      [
        MCP_PROJECT_CONTEXT_GET_TOOL,
        MCP_PROJECT_CONTEXT_LIST_TOOL,
        MCP_RUNTIME_ACTIVITY_TOOL,
        ...MCP_TOPIC_MEETING_TOOLS,
      ].sort(),
    );
    for (const tool of tools) {
      const topicMeeting = MCP_TOPIC_MEETING_TOOLS.includes(tool.name as never);
      assert.equal(
        Object.hasOwn(tool.inputSchema.properties, "repositoryId"),
        topicMeeting,
        tool.name,
      );
      assert.equal(
        tool.inputSchema.required?.includes("repositoryId") ?? false,
        topicMeeting,
        tool.name,
      );
      assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    }
    for (const [name, args] of commands) {
      const response = await call(base, f.token, name, {
        ...args,
        repositoryId: a.id,
      });
      assert.equal(response.status, 200);
      const text = await response.text(),
        result = JSON.parse(text);
      assert.equal(result.result?.isError, false, `${name}: ${text}`);
      assert.equal(text.includes(f.token), false);
      assert.equal(text.includes(a.target), false);
      if (name === "crdd.get_topic")
        assert.deepEqual(result.result.structuredContent.relations, [
          {
            id: "MTG-000042",
            kind: "meeting",
            state: "available",
            ownerRepositoryId: a.id,
          },
        ]);
      if (name === "crdd.update_topic")
        assert.equal(topic.get("TOPIC-000042")?.revision, 2);
      if (name === "crdd.update_meeting")
        assert.equal(meeting.get("MTG-000042")?.revision, 2);
      if (name === "crdd.promote_topic")
        assert.equal(topic.get("TOPIC-000042")?.state, "promoted");
      if (name === "crdd.treat_meeting_outcome")
        assert.equal(meeting.get("MTG-000042")?.state, "closed");
    }
    assert.equal(topic.get("TOPIC-000042"), null);
    assert.equal(meeting.get("MTG-000042"), null);
    assert.equal(
      createTopicOperations(b.target, "project.fixture").get("TOPIC-000042"),
      null,
    );
    assert.equal(
      createMeetingOperations(b.target, "project.fixture").get("MTG-000042"),
      null,
    );
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 初回未完了を通常Handlerへ昇格せず、開始前取消で本文を読まない。
 * @responsibility 認証と取消の負境界を直接確認する。
 * @trace RFD-IT-013
 * @trace EST-IT-014
 * @precondition 未完了と完了の自己生成Store。
 * @stimulus 各資格でResolverを呼び、完了Handlerへ取消済みSignalを渡す。
 * @observation null、固定取消結果、target open数。
 * @oracle 未完了Handler0、取消要求のRepository／本文観測0。
 * @cleanup fs hookを復元しFixtureの所有Rootを回収する。
 * @boundary 通常認証→要求Handler→同期読取り直前。
 */
test("未完了資格はHandlerなし、開始前取消は対象読取りなし", async (t) => {
  const initial = fixture(t, false),
    f = fixture(t);
  const open = fs.openSync;
  let reads = 0;
  fs.openSync = (file, flags, mode) => {
    if (
      [...initial.targets, ...f.targets].some(({ target }) =>
        String(file).startsWith(target),
      )
    )
      reads++;
    return open(file, flags, mode);
  };
  try {
    assert.equal(
      await createAccessMcpResolver(initial.root)(initial.token),
      null,
    );
    const handler = await createAccessMcpResolver(f.root)(f.token);
    assert.ok(handler);
    const discovery = await handler(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: { _meta: packet().params._meta },
      },
      new AbortController().signal,
    );
    assert.ok("result" in discovery);
    const discovered = discovery.result as { tools: { name: string }[] };
    assert.deepEqual(
      discovered.tools.map((tool) => tool.name).sort(),
      [
        MCP_PROJECT_CONTEXT_GET_TOOL,
        MCP_PROJECT_CONTEXT_LIST_TOOL,
        MCP_RUNTIME_ACTIVITY_TOOL,
        ...MCP_TOPIC_MEETING_TOOLS,
      ].sort(),
    );
    const controller = new AbortController();
    controller.abort();
    const result = await handler(packet(), controller.signal);
    assert.deepEqual(result, {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32800, message: "Request cancelled" },
    });
    assert.equal(reads, 0);
  } finally {
    fs.openSync = open;
  }
});

/**
 * 現在認可とProject拘束の拒否を実HTTPで確認する。
 * @responsibility 非許可・foreign本文・Root不明を保存成功へ畳まない。
 * @trace CPR-IT-012
 * @trace RFD-IT-013
 * @precondition 自己生成Storeと二Repository。
 * @stimulus 不明ID、公開解除、Role変更、資格失効、foreign登録／更新、Root欠測を入力する。
 * @observation 固定Protocol拒否、実本文の改訂と対象open数。
 * @oracle 認可拒否とforeign書込みは実データ不変。集合不明は部分成功なし。
 * @cleanup hook復元とServer終了後に所有Fixtureを回収する。
 */
test("AM内容MCPは現在認可とforeign Projectと集合欠測で停止する", async (t) => {
  const f = fixture(t),
    a = f.targets[0],
    b = f.targets[1];
  assert.ok(a && b);
  const original = fs.readFileSync(f.current);
  const topic = createTopicOperations(a.target, "project.fixture");
  const meeting = createMeetingOperations(a.target, "project.fixture");
  topic.create(topicMarkdown());
  meeting.create(meetingMarkdown());
  const topicBefore = topic.getDocument("TOPIC-000042")?.markdown;
  const meetingBefore = meeting.getDocument("MTG-000042")?.markdown;
  const server = await startMcpAuthenticatedStreamableHttp(
    createAccessMcpResolver(f.root),
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  const open = fs.openSync;
  let targetReads = 0;
  fs.openSync = (file, flags, mode) => {
    if (f.targets.some(({ target }) => String(file).startsWith(target)))
      targetReads++;
    return open(file, flags, mode);
  };
  try {
    for (const mode of ["unknown", "exposure", "role"] as const) {
      const state = JSON.parse(original.toString()) as AccessManagementState;
      if (mode === "exposure") state.exposure = [];
      if (mode === "role") {
        assert.ok(state.users[0]);
        state.users[0].role = "administrator";
      }
      fs.writeFileSync(f.current, JSON.stringify(state));
      targetReads = 0;
      const denied = await call(base, f.token, "crdd.create_topic", {
        repositoryId: mode === "unknown" ? "repository.unknown" : a.id,
        markdown: topicMarkdown(),
      });
      assert.deepEqual((await denied.json()).error, {
        code: -32602,
        message: "Invalid params",
      });
      if (mode !== "unknown") assert.equal(targetReads, 0);
    }
    fs.writeFileSync(f.current, original);
    for (const [name, args] of [
      [
        "crdd.create_topic",
        {
          markdown: topicMarkdown(1, "project.foreign").replaceAll(
            "TOPIC-000042",
            "TOPIC-000043",
          ),
        },
      ],
      [
        "crdd.update_topic",
        {
          id: "TOPIC-000042",
          expectedRevision: 1,
          markdown: topicMarkdown(2, "project.foreign"),
        },
      ],
      [
        "crdd.create_meeting",
        {
          markdown: meetingMarkdown(1, "project.foreign").replaceAll(
            "MTG-000042",
            "MTG-000043",
          ),
        },
      ],
      [
        "crdd.update_meeting",
        {
          id: "MTG-000042",
          expectedRevision: 1,
          markdown: meetingMarkdown(2, "project.foreign"),
        },
      ],
    ] as [string, Record<string, unknown>][]) {
      const result = await call(base, f.token, name, {
        ...args,
        repositoryId: a.id,
      });
      assert.deepEqual((await result.json()).error, {
        code: -32603,
        message: "Internal error",
      });
      assert.equal(topic.getDocument("TOPIC-000042")?.markdown, topicBefore);
      assert.equal(meeting.getDocument("MTG-000042")?.markdown, meetingBefore);
      assert.equal(topic.get("TOPIC-000043"), null);
      assert.equal(meeting.get("MTG-000043"), null);
    }
    fs.renameSync(
      path.join(b.target, ".git"),
      path.join(b.target, ".git-unavailable"),
    );
    const missing = await call(base, f.token, "crdd.get_topic", {
      repositoryId: a.id,
      id: "TOPIC-000042",
    });
    assert.deepEqual((await missing.json()).error, {
      code: -32603,
      message: "Internal error",
    });
    fs.renameSync(
      path.join(b.target, ".git-unavailable"),
      path.join(b.target, ".git"),
    );
    const state = JSON.parse(original.toString()) as AccessManagementState;
    assert.ok(state.credentials[0]);
    state.credentials[0].revoked = true;
    fs.writeFileSync(f.current, JSON.stringify(state));
    targetReads = 0;
    assert.equal(
      (
        await call(base, f.token, "crdd.get_topic", {
          repositoryId: a.id,
          id: "TOPIC-000042",
        })
      ).status,
      401,
    );
    assert.equal(targetReads, 0);
  } finally {
    fs.openSync = open;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 現在許可集合内だけでRelation Ownerの0／1／複数を判定する。
 * @responsibility 別Projectの同じIDを探索対象へ混ぜない。
 * @trace CPR-IT-010
 * @trace RFD-IT-013
 * @precondition 同Project二Repositoryと関連Topic。
 * @stimulus Meeting不在、一意、重複、第二Repositoryの異Project変更を順に入力する。
 * @observation 実HTTPのRelation状態とOwner ID。
 * @oracle 不在／競合ではOwnerなし、一意だけOwnerを返し異Project本文を探索しない。
 * @cleanup Server終了後に所有Fixtureを回収する。
 */
test("AM内容MCPのRelationは現在同Project集合に限定する", async (t) => {
  const f = fixture(t),
    a = f.targets[0],
    b = f.targets[1];
  assert.ok(a && b);
  createTopicOperations(a.target, "project.fixture").create(topicMarkdown());
  const server = await startMcpAuthenticatedStreamableHttp(
    createAccessMcpResolver(f.root),
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  try {
    for (const stage of [0, 1, 2, 3]) {
      if (stage === 1)
        createMeetingOperations(b.target, "project.fixture").create(
          meetingMarkdown(),
        );
      if (stage === 2)
        createMeetingOperations(a.target, "project.fixture").create(
          meetingMarkdown(),
        );
      if (stage === 3) {
        const manifest = path.join(
          b.target,
          ".crdd",
          "config",
          "repository-manifest.json",
        );
        const data = JSON.parse(fs.readFileSync(manifest, "utf8"));
        data.projectId = "project.other";
        fs.writeFileSync(manifest, JSON.stringify(data));
      }
      const response = await call(base, f.token, "crdd.get_topic", {
        repositoryId: a.id,
        id: "TOPIC-000042",
      });
      const result = await response.json();
      assert.equal(result.result.isError, false);
      assert.deepEqual(result.result.structuredContent.relations, [
        {
          id: "MTG-000042",
          kind: "meeting",
          state:
            stage === 0
              ? "unavailable"
              : stage === 2
                ? "conflicting"
                : "available",
          ...(stage === 1
            ? { ownerRepositoryId: b.id }
            : stage === 3
              ? { ownerRepositoryId: a.id }
              : {}),
        },
      ]);
    }
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 不正入力と開始前取消では内容認可も保存も開始しない。
 * @responsibility 構成拡張後も既存Adapterの検査順序を保持する。
 * @trace CPR-IT-012
 * @trace RFD-IT-013
 * @precondition 通常認証だけ完了した要求Handler。
 * @stimulus 全12Toolへ不正引数、正規登録へ取消済みSignalを渡す。
 * @observation 管理Storeと対象Repositoryのopen数、Protocol code。
 * @oracle 不正入力は-32602、事前取消は-32800、いずれも観測0。
 * @cleanup hook復元後に自己生成Fixtureを回収する。
 */
test("AM内容MCPの入力拒否と開始前取消は再認可前で閉じる", async (t) => {
  const f = fixture(t),
    a = f.targets[0];
  assert.ok(a);
  const handler = await createAccessMcpResolver(f.root)(f.token);
  assert.ok(handler);
  const open = fs.openSync;
  let observations = 0;
  fs.openSync = (file, flags, mode) => {
    if (
      String(file).startsWith(path.dirname(f.current)) ||
      f.targets.some(({ target }) => String(file).startsWith(target))
    )
      observations++;
    return open(file, flags, mode);
  };
  try {
    for (const tool of MCP_TOPIC_MEETING_TOOLS) {
      const rejected = await handler(
        packet(tool, { repositoryId: a.id, extra: true }),
        new AbortController().signal,
      );
      assert.ok("error" in rejected);
      assert.equal(rejected.error.code, -32602);
    }
    const abort = new AbortController();
    abort.abort();
    const cancelled = await handler(
      packet("crdd.create_topic", {
        repositoryId: a.id,
        markdown: topicMarkdown(),
      }),
      abort.signal,
    );
    assert.ok("error" in cancelled);
    assert.equal(cancelled.error.code, -32800);
    assert.equal(observations, 0);
  } finally {
    fs.openSync = open;
  }
});

/**
 * 実HTTPの許可集合と本文版を再評価し、本文不明で全体を止める。
 * @responsibility 空認可・欠測・部分成功と通常成功を区別する。
 * @trace PPR-IT-002
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @precondition 二RepositoryのProject Contextと現在developer資格。
 * @stimulus 反復取得、administrator空認可、二件目の本文欠測、失効資格を送る。
 * @observation Reader回数、完全／空Portfolio、固定MCPエラー、非秘密body、close後接続拒否。
 * @oracle 毎要求で本文二回、空認可本文0、欠測時は部分resultなし、失効は401。
 * @cleanup fs hook復元とServer close／join後にFixtureを回収する。
 * @boundary 実HTTP→AM→Domain固定本文→MCP応答。
 */
test("実HTTPは毎回現在集合と実本文を使い欠測で全体停止", async (t) => {
  const f = fixture(t),
    resolver = createAccessMcpResolver(f.root);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}`;
  const open = fs.openSync;
  let reads = 0;
  fs.openSync = (file, flags, mode) => {
    if (f.targets.some(({ body }) => String(file) === body)) reads++;
    return open(file, flags, mode);
  };
  try {
    for (let i = 0; i < 2; i++) {
      reads = 0;
      const response = await call(base, f.token);
      assert.equal(response.status, 200);
      const text = await response.text(),
        result = JSON.parse(text);
      assert.equal(result.result.structuredContent.project.state, "complete");
      assert.equal(result.result.structuredContent.project.sources.length, 2);
      assert.equal(reads, 2);
      for (const target of f.targets)
        assert.equal(text.includes(target.target), false);
      assert.equal(text.includes(f.token), false);
      assert.equal(text.includes("managementRevision"), false);
      assert.equal(text.includes("bindingId"), false);
    }
    const state = JSON.parse(
      fs.readFileSync(f.current, "utf8"),
    ) as AccessManagementState;
    const user = state.users[0],
      credential = state.credentials[0];
    assert.ok(user && credential);
    user.role = "administrator";
    fs.writeFileSync(f.current, JSON.stringify(state));
    reads = 0;
    const empty = await call(base, f.token, MCP_PROJECT_CONTEXT_LIST_TOOL);
    assert.deepEqual(
      (await empty.json()).result.structuredContent.projects,
      [],
    );
    assert.equal(reads, 0);
    user.role = "developer";
    fs.writeFileSync(f.current, JSON.stringify(state));
    const second = f.targets[1];
    assert.ok(second);
    fs.rmSync(second.body);
    const failed = await call(base, f.token);
    assert.deepEqual(await failed.json(), {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32603, message: "Project Context unavailable" },
    });
    credential.revoked = true;
    fs.writeFileSync(f.current, JSON.stringify(state));
    assert.equal((await call(base, f.token)).status, 401);
  } finally {
    fs.openSync = open;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
  await assert.rejects(fetch(`${base}/mcp`));
});

/**
 * 同期本文Reader開始後の取消を固定非公開エラーへ閉じる。
 * @responsibility 開始済みReaderの終了と後続読取り停止を直接観測する。
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @precondition 通常認証済みの要求Handlerと二Repository。
 * @stimulus 第一本体のopen後に同要求Signalをabortする。
 * @observation 当該descriptorのclose、各本文open数、固定エラーとresult不存在。
 * @oracle 第一本体open1／close1、第二本文0、暗黙再実行0。開始後取消は既存-32603分類。
 * @cleanup open／close hookを復元して自己生成Fixtureを回収する。
 * @boundary 同期Domain読取り→Resolver Signal検出→MCP固定拒否。
 */
test("同期読取り開始後の取消はclose後に固定拒否し後続を読まない", async (t) => {
  const f = fixture(t);
  const handler = await createAccessMcpResolver(f.root)(f.token);
  assert.ok(handler);
  const controller = new AbortController();
  const open = fs.openSync,
    close = fs.closeSync;
  let descriptor: number | undefined,
    closed = 0;
  const reads = [0, 0];
  fs.openSync = (file, flags, mode) => {
    const fd = open(file, flags, mode);
    const index = f.targets.findIndex(({ body }) => String(file) === body);
    if (index >= 0) reads[index] = (reads[index] ?? 0) + 1;
    if (index === 0) {
      descriptor = fd;
      controller.abort();
    }
    return fd;
  };
  fs.closeSync = (fd) => {
    close(fd);
    if (fd === descriptor) closed++;
  };
  try {
    const result = await handler(packet(), controller.signal);
    assert.deepEqual(result, {
      jsonrpc: "2.0",
      id: 1,
      error: { code: -32603, message: "Project Context unavailable" },
    });
    assert.equal(Object.hasOwn(result, "result"), false);
    assert.deepEqual(reads, [1, 0]);
    assert.equal(closed, 1);
  } finally {
    fs.openSync = open;
    fs.closeSync = close;
  }
});

/**
 * Header認証後の本文待機中に現在許可を変更する。
 * @responsibility Header時の本人確認を後続内容Authorityへ固定しない。
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @precondition 二Repositoryと実HTTP Server。
 * @stimulus Header認証完了後にExposure解除または資格失効を保存し本文を完結する。
 * @observation 空Portfolio／固定エラー、本文open数、Server回収。
 * @oracle 解除と失効を区別し、両方とも旧対象本文0。
 * @cleanup fs hook復元、要求終了とServer close後にFixtureを回収する。
 * @boundary 実stream本文待機→fresh AM認可→MCP結果。
 */
test("本文待機中のExposure解除と失効は内容Callへ反映", {
  timeout: 15000,
}, async (t) => {
  const f = fixture(t),
    resolver = createAccessMcpResolver(f.root);
  let authenticated: (() => void) | undefined;
  const server = await startMcpAuthenticatedStreamableHttp(
    async (token) => {
      const handler = await resolver(token);
      authenticated?.();
      return handler;
    },
    { port: 0 },
  );
  const base = `http://${server.host}:${server.port}`;
  const original = fs.readFileSync(f.current);
  const open = fs.openSync;
  let reads = 0;
  fs.openSync = (file, flags, mode) => {
    if (f.targets.some(({ body }) => String(file) === body)) reads++;
    return open(file, flags, mode);
  };
  try {
    for (const [tool, change] of [
      [MCP_PROJECT_CONTEXT_LIST_TOOL, "exposure"],
      [MCP_PROJECT_CONTEXT_LIST_TOOL, "revoked"],
      ["crdd.create_topic", "exposure"],
      ["crdd.create_topic", "revoked"],
    ] as const) {
      fs.writeFileSync(f.current, original);
      const headerReady = new Promise<void>((resolve) => {
        authenticated = resolve;
      });
      const body = JSON.stringify(
        packet(
          tool,
          tool === "crdd.create_topic"
            ? { repositoryId: "repository.a", markdown: topicMarkdown() }
            : undefined,
        ),
      );
      let finish: (() => void) | undefined;
      const response = new Promise<string>((resolve, reject) => {
        const request = httpRequest(
          `${base}/mcp`,
          {
            method: "POST",
            agent: false,
            headers: {
              authorization: `Bearer ${f.token}`,
              accept: "application/json, text/event-stream",
              "content-type": "application/json",
              "mcp-protocol-version": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
              "mcp-method": "tools/call",
              "mcp-name": tool,
            },
          },
          (incoming) => {
            let text = "";
            incoming.setEncoding("utf8");
            incoming.on("data", (chunk: string) => {
              text += chunk;
            });
            incoming.on("error", reject);
            incoming.on("end", () => resolve(text));
          },
        );
        request.on("error", reject);
        finish = () => request.end(body.slice(1));
        request.write(body.slice(0, 1));
      });
      await headerReady;
      const state = JSON.parse(original.toString()) as AccessManagementState;
      if (change === "exposure") state.exposure = [];
      else {
        const credential = state.credentials[0];
        assert.ok(credential);
        credential.revoked = true;
      }
      fs.writeFileSync(f.current, JSON.stringify(state));
      reads = 0;
      assert.ok(finish);
      finish();
      const result = JSON.parse(await response);
      if (tool === "crdd.create_topic")
        assert.deepEqual(result.error, {
          code: change === "exposure" ? -32602 : -32603,
          message: change === "exposure" ? "Invalid params" : "Internal error",
        });
      else if (change === "exposure")
        assert.deepEqual(result.result.structuredContent.projects, []);
      else
        assert.deepEqual(result.error, {
          code: -32603,
          message: "Project Context unavailable",
        });
      assert.equal(reads, 0);
      if (tool === "crdd.create_topic") {
        const target = f.targets[0];
        assert.ok(target);
        assert.equal(
          createTopicOperations(target.target, "project.fixture").get(
            "TOPIC-000042",
          ),
          null,
        );
      }
    }
  } finally {
    authenticated = undefined;
    fs.openSync = open;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

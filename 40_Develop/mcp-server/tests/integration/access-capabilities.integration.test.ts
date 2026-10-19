/**
 * AMの現在認可から内容操作を実HTTPで搬送する。
 * @packageDocumentation
 * @responsibility 初回未完了・失効・空認可・本文不明と取消を非開示結果へ照合する。
 * @trace PPR-IT-002
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @trace RCM-IT-005
 * @trace RCM-IT-010
 * @trace EST-IT-002
 * @trace EST-IT-014
 * @trace CPR-IT-001
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @level IT
 * @scope MCP専用Resolver、AM、Domain固定本文、HTTP。
 * @boundary 自己生成Store／Repositoryから既存HTTP Transportまで。公開Launcherの完成ではない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { request as httpRequest, ServerResponse } from "node:http";
import test, { type TestContext } from "node:test";

import {
  createAiProfileCatalogAdministration,
  createRepositoryAiProfileCatalogStore,
  defaultAiProfileCatalog,
} from "../../../ai-adapter/src/index.ts";
import {
  createInitialAdministrator,
  createInitialCredential,
  initializeAccessManagementState,
  registerRepository,
  updateExposure,
  readCurrentAccess,
  projectCurrentAccessResult,
  resolveRepositoryAccess,
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
  MCP_CURRENT_ACCESS_TOOL,
  type McpResponse,
} from "../../src/index.ts";
import {
  createOrchestratorState,
  initializeOrchestratorSnapshot,
  executeWorkspaceCommand,
} from "../../../orchestrator/src/index.ts";
import { writeOrchestratorSnapshotState } from "../../../orchestrator/src/storage/current-state.ts";
import { prepareWorkspaceSurface } from "../../../orchestrator/tests/fixtures/workspace-surface.ts";
import { startWorkbench } from "../../../workbench-server/src/index.ts";
import {
  createTaskAttemptSettledEvent,
  writeExecutionIntelligenceEvent,
  verifyExecutionIntelligenceRepositoryRoot,
  usageNotObserved,
} from "../../../execution-intelligence/src/index.ts";

/**
 * 通常三Roleの本人を他Userから推定せず実HTTPで取得する。
 * @responsibility 本人readの最小閉結果と要求毎の現在性を検証する。
 * @trace RFD-IT-013
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @precondition 完了した自己生成AM、本人と非公開別User、実HTTP。
 * @stimulus 三Role、時間だけの経過、入力不正、事前取消、初回未完了、資格失効を要求する。
 * @observation Tool一覧・閉結果・直接Owner結果・現在File保持を照合する。
 * @oracle 内部管理候補と他User、資格、Rootは0。拒否と不明を空本人にしない。
 * @cleanup HTTP close確認後fixtureが所有Rootを回収する。
 * @boundary AM本人Owner→通常MCP Resolver→実HTTP。公開Launcher完成ではない。
 */
test("MCP本人readは三Roleの現在本人だけを実HTTPへ返す", async (t) => {
  const f = fixture(t);
  const state = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const actor = state.users[0];
  assert.ok(actor);
  const otherId = randomUUID();
  state.users.push({
    ...actor,
    userId: otherId,
    username: "非公開別ユーザー",
    role: "developer",
  });
  const resolver = createAccessMcpResolver(f.root);
  const handler = await resolver(f.token);
  assert.ok(handler);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}`;
  try {
    for (const role of ["developer", "manager", "administrator"] as const) {
      actor.role = role;
      state.revision += 1;
      fs.writeFileSync(f.current, JSON.stringify(state));
      const listed: McpResponse = await handler(
        {
          ...packet(),
          method: "tools/list",
          params: { _meta: packet().params._meta },
        },
        new AbortController().signal,
      );
      const tools = (
        listed.result as { tools: { name: string; inputSchema: unknown }[] }
      ).tools;
      const definition = tools.find(
        (tool) => tool.name === MCP_CURRENT_ACCESS_TOOL,
      );
      assert.ok(definition);
      assert.deepEqual(definition.inputSchema, {
        type: "object",
        additionalProperties: false,
        required: [],
        properties: {},
      });
      assert.equal(tools.length, role === "developer" ? 18 : 28);
      assert.equal(
        tools.some((tool) => tool.name === "crdd.register_repository"),
        false,
      );
      const response = await (
        await call(base, f.token, MCP_CURRENT_ACCESS_TOOL, {})
      ).json();
      const result = response.result.structuredContent;
      assert.equal(result.status, "completed");
      assert.deepEqual(
        Object.keys(result).sort(),
        [
          "status",
          "revision",
          "user",
          "contentAccess",
          "permittedRepositories",
        ].sort(),
      );
      assert.deepEqual(result.user, {
        userId: actor.userId,
        username: actor.username,
        role,
      });
      assert.equal(result.revision, state.revision);
      assert.deepEqual(
        result,
        projectCurrentAccessResult(readCurrentAccess(f.root, f.token)),
      );
      const unchangedState = fs.readFileSync(f.current);
      const later = Date.now() + 365 * 24 * 60 * 60 * 1000;
      const clock = t.mock.method(Date, "now", () => later);
      try {
        const laterResponse = await (
          await call(base, f.token, MCP_CURRENT_ACCESS_TOOL, {})
        ).json();
        assert.deepEqual(laterResponse.result.structuredContent, result);
        assert.deepEqual(fs.readFileSync(f.current), unchangedState);
      } finally {
        clock.mock.restore();
      }
      const wire = JSON.stringify(response);
      for (const hidden of [
        otherId,
        "非公開別ユーザー",
        f.token,
        f.root.root,
        "managementOperations",
        "bindingId",
        "credentialId",
        "verifier",
        "salt",
      ])
        assert.equal(wire.includes(hidden), false);
    }
    const before = fs.readFileSync(f.current);
    assert.equal(
      (
        await handler(
          packet(MCP_CURRENT_ACCESS_TOOL, { userId: otherId }),
          new AbortController().signal,
        )
      ).error?.code,
      -32602,
    );
    const cancelled = new AbortController();
    cancelled.abort();
    assert.equal(
      (await handler(packet(MCP_CURRENT_ACCESS_TOOL, {}), cancelled.signal))
        .error?.code,
      -32800,
    );
    assert.deepEqual(fs.readFileSync(f.current), before);
    const credential = state.credentials[0];
    assert.ok(credential);
    credential.revoked = true;
    fs.writeFileSync(f.current, JSON.stringify(state));
    const denied = await handler(
      packet(MCP_CURRENT_ACCESS_TOOL, {}),
      new AbortController().signal,
    );
    assert.deepEqual(
      (denied.result as { structuredContent: unknown }).structuredContent,
      {
        status: "unavailable",
        reason: "current_access_authentication_rejected",
      },
    );
    assert.equal(await resolver(f.token), null);
    const initial = fixture(t, false);
    assert.equal(
      await createAccessMcpResolver(initial.root)(initial.token),
      null,
    );
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
  }
});

/**
 * 非鍵管理十操作を現在Roleから実HTTP保存へ接続する。
 * @responsibility 四読取り・六保存の結果、非開示、次要求の現在性を照合する。
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @trace EST-IT-002
 * @trace EST-IT-010
 * @precondition 自己生成の完了AM Storeと登録済みRepositoryを用意する。
 * @stimulus developer／managerの一覧、四readと六保存、禁止Role変更を要求する。
 * @observation 実HTTP構造結果と管理Fileの読戻し・保持状態。
 * @oracle 登録Tool・鍵・Root／Bindingは公開せず、現在管理認可と既知改訂を保持する。
 * @cleanup Server終了待ち後、fixtureが所有Rootの不存在を確認する。
 * @boundary AM保存Owner→MCP→実HTTP。公開Launcher成立ではない。
 */
test("非鍵管理MCPの十操作はRoleと閉結果を実保存へ接続する", async (t) => {
  const f = fixture(t);
  const [firstTarget, secondTarget] = f.targets;
  assert.ok(firstTarget && secondTarget);
  const resolver = createAccessMcpResolver(f.root);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}`;
  try {
    const listRequest = {
      ...packet(),
      method: "tools/list",
      params: { _meta: packet().params._meta },
    };
    const handler = await resolver(f.token);
    assert.ok(handler);
    const deniedList = await handler(listRequest, new AbortController().signal);
    assert.equal((deniedList.result as { tools: unknown[] }).tools.length, 18);
    const before = fs.readFileSync(f.current);
    const deniedRead = await (
      await call(base, f.token, "crdd.list_access_users", {})
    ).json();
    assert.deepEqual(deniedRead.result.structuredContent, {
      status: "unavailable",
      reason: "management_read_rejected",
    });
    assert.deepEqual(fs.readFileSync(f.current), before);

    const state = JSON.parse(before.toString("utf8")) as AccessManagementState;
    const actor = state.users[0];
    assert.ok(actor);
    actor.role = "manager";
    state.exposure = state.exposure.filter(
      (exposure) => exposure.repositoryId !== firstTarget.id,
    );
    fs.writeFileSync(f.current, JSON.stringify(state));
    const listed = await handler(listRequest, new AbortController().signal);
    const tools = (
      listed.result as {
        tools: {
          name: string;
          inputSchema: unknown;
        }[];
      }
    ).tools;
    assert.equal(tools.length, 28);
    assert.equal(new Set(tools.map((tool) => tool.name)).size, 28);
    assert.equal(
      tools.some((tool) => tool.name === "crdd.register_repository"),
      false,
    );
    for (const tool of tools.filter((tool) =>
      /access_users|role_content_access|registered_repositories|repository_exposure|register_user|update_user_name|change_user_role|unregister_repository/.test(
        tool.name,
      ),
    )) {
      const serialized = JSON.stringify(tool.inputSchema);
      for (const field of [
        "repositoryRoot",
        "bindingId",
        "token",
        "credentialId",
      ])
        assert.equal(serialized.includes(field), false);
    }
    for (const [name, field] of [
      ["crdd.list_access_users", "users"],
      ["crdd.list_role_content_access", "roles"],
      ["crdd.list_registered_repositories", "repositories"],
      ["crdd.list_repository_exposure", "repositories"],
    ]) {
      const response = await (await call(base, f.token, name, {})).json();
      const result = response.result.structuredContent;
      assert.equal(result.status, "completed");
      assert.equal(result.revision, state.revision);
      assert.deepEqual(
        Object.keys(result).sort(),
        [field, "revision", "status"].sort(),
      );
      for (const value of [f.token, "bindingId", "repositoryRoot", f.current])
        assert.equal(JSON.stringify(response).includes(value), false);
      if (field === "roles")
        assert.equal(
          result.roles.some(
            (role: { role: string }) => role.role === "administrator",
          ),
          false,
        );
      if (name === "crdd.list_repository_exposure")
        assert.equal(
          result.repositories.find(
            (repository: { repositoryId: string }) =>
              repository.repositoryId === firstTarget.id,
          )?.workspaceIds,
          null,
        );
    }
    let revision = state.revision;
    const registered = await (
      await call(base, f.token, "crdd.register_user", {
        expectedRevision: revision,
        operationId: randomUUID(),
        username: "登録ユーザー",
        plannedRole: "developer",
      })
    ).json();
    const created = registered.result.structuredContent;
    assert.equal(created.status, "completed");
    assert.equal(created.revision, ++revision);
    assert.equal(created.publication, "confirmed");
    assert.equal(created.cleanupConfirmed, true);
    const userId = created.userId as string;
    for (const [name, input] of [
      ["crdd.update_user_name", { userId, username: "変更ユーザー" }],
      [
        "crdd.change_user_role",
        { userId, currentRole: "developer", nextRole: "manager" },
      ],
      [
        "crdd.update_role_content_access",
        { targetRole: "developer", workspaceIds: [] },
      ],
      [
        "crdd.update_repository_exposure",
        { repositoryId: firstTarget.id, workspaceIds: [] },
      ],
      ["crdd.unregister_repository", { repositoryId: secondTarget.id }],
    ] as const) {
      const operationId = randomUUID();
      const response = await (
        await call(base, f.token, name, {
          ...input,
          operationId,
          expectedRevision: revision,
        })
      ).json();
      const result = response.result.structuredContent;
      assert.equal(result.status, "completed");
      assert.equal(result.operationId, operationId);
      assert.equal(result.expectedRevision, revision);
      assert.equal(result.revision, ++revision);
      assert.equal(result.publication, "confirmed");
      assert.equal(result.cleanupConfirmed, true);
    }
    const saved = JSON.parse(
      fs.readFileSync(f.current, "utf8"),
    ) as AccessManagementState;
    assert.equal(saved.revision, revision);
    assert.equal(
      saved.users.find((user) => user.userId === userId)?.role,
      "manager",
    );
    assert.equal(
      saved.users.find((user) => user.userId === userId)?.username,
      "変更ユーザー",
    );
    assert.deepEqual(
      saved.roleContentAccess.find((role) => role.role === "developer")
        ?.workspaceIds,
      [],
    );
    assert.equal(
      saved.registeredRepositories.some(
        (repository) => repository.repositoryId === secondTarget.id,
      ),
      false,
    );
    assert.equal(
      saved.exposure.some(
        (exposure) => exposure.repositoryId === secondTarget.id,
      ),
      false,
    );
    assert.deepEqual(
      saved.exposure.find(
        (exposure) => exposure.repositoryId === firstTarget.id,
      )?.workspaceIds,
      [],
    );
    assert.ok(fs.existsSync(secondTarget.body));
    const unchanged = fs.readFileSync(f.current);
    for (const [name, input] of [
      [
        "crdd.register_user",
        { username: "禁止管理者", plannedRole: "administrator" },
      ],
      [
        "crdd.change_user_role",
        { userId, currentRole: "manager", nextRole: "administrator" },
      ],
      [
        "crdd.update_role_content_access",
        { targetRole: "administrator", workspaceIds: [] },
      ],
    ] as const) {
      const response = await (
        await call(base, f.token, name, {
          ...input,
          expectedRevision: revision,
          operationId: randomUUID(),
        })
      ).json();
      assert.deepEqual(response.result.structuredContent, {
        status: "rejected",
        reason: "management_request_rejected",
      });
      assert.deepEqual(fs.readFileSync(f.current), unchanged);
    }
    const invalid = await (
      await call(base, f.token, "crdd.update_user_name", {
        expectedRevision: revision,
        operationId: randomUUID(),
        userId,
        username: "不採用",
        token: f.token,
      })
    ).json();
    assert.equal(invalid.error.code, -32602);
    assert.deepEqual(fs.readFileSync(f.current), unchanged);
    const cancelled = new AbortController();
    cancelled.abort();
    const cancellation = await handler(
      packet("crdd.update_user_name", {
        expectedRevision: revision,
        operationId: randomUUID(),
        userId,
        username: "取消",
      }),
      cancelled.signal,
    );
    assert.equal(cancellation.error?.code, -32800);
    assert.deepEqual(fs.readFileSync(f.current), unchanged);
    const pendingRegistration = await (
      await call(base, f.token, "crdd.register_repository", {})
    ).json();
    assert.equal(pendingRegistration.error.code, -32601);
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 通常管理の出版・清掃・解放故障をMCPで保持する。
 * @responsibility 最初の失敗と既知出版を分離し、自動再送0を確認する。
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @precondition 自己生成のmanager Storeと通常HTTP接続。
 * @stimulus 対象Rootのrename、pending清掃、保存後Lock清掃へ個別故障を注入する。
 * @observation 呼出し回数、HTTP閉結果、実現在Fileの改訂と名前。
 * @oracle publication_failed／cleanup_failed／release_unknownと既知publicationを保持する。
 * @cleanup 全差替えを復元しServerをjoinしてfixture所有Rootを回収する。
 * @boundary 実Filesystem→AM結果→MCP投影→HTTP。
 */
test("非鍵管理MCPは保存後の失敗分類と既知出版を保持する", async (t) => {
  for (const stage of ["publication", "cleanup", "release"] as const) {
    await t.test(stage, async (child) => {
      const f = fixture(child);
      const state = JSON.parse(
        fs.readFileSync(f.current, "utf8"),
      ) as AccessManagementState;
      const actor = state.users[0];
      assert.ok(actor);
      actor.role = "manager";
      fs.writeFileSync(f.current, JSON.stringify(state));
      const server = await startMcpAuthenticatedStreamableHttp(
        createAccessMcpResolver(f.root),
        { port: 0 },
      );
      const base = `http://${server.host}:${server.port}`;
      const rename = fs.renameSync,
        remove = fs.rmSync;
      const parent = path.dirname(f.current);
      let injected = 0,
        publications = 0;
      try {
        fs.renameSync = ((from, to) => {
          if (String(to) === f.current) {
            publications++;
            if (stage === "publication") {
              injected++;
              throw new Error("fixture_publication_failure");
            }
          }
          return rename(from, to);
        }) as typeof fs.renameSync;
        fs.rmSync = ((target, options) => {
          const file = String(target);
          if (
            stage === "cleanup" &&
            file === path.join(parent, "access-management.pending.json")
          ) {
            injected++;
            throw new Error("fixture_cleanup_failure");
          }
          if (
            stage === "release" &&
            file === path.join(parent, "access-management.lock") &&
            (
              JSON.parse(
                fs.readFileSync(f.current, "utf8"),
              ) as AccessManagementState
            ).revision ===
              state.revision + 1
          ) {
            injected++;
            throw new Error("fixture_release_failure");
          }
          return remove(target, options);
        }) as typeof fs.rmSync;
        const operationId = randomUUID();
        const response = await (
          await call(base, f.token, "crdd.update_user_name", {
            expectedRevision: state.revision,
            operationId,
            userId: actor.userId,
            username: "故障確認後の名前",
          })
        ).json();
        const result = response.result.structuredContent;
        assert.equal(result.status, "unavailable");
        assert.equal(result.reason, "management_operation_unavailable");
        assert.equal(result.operationId, operationId);
        assert.equal(result.expectedRevision, state.revision);
        assert.equal(
          result.primaryFailure,
          stage === "publication"
            ? "publication_failed"
            : stage === "cleanup"
              ? "cleanup_failed"
              : "release_unknown",
        );
        assert.equal(
          result.publication,
          stage === "publication" ? "unconfirmed" : "confirmed",
        );
        assert.equal(result.cleanupConfirmed, false);
        assert.equal(publications, 1);
        assert.equal(injected, 1);
        const observed = JSON.parse(
          fs.readFileSync(f.current, "utf8"),
        ) as AccessManagementState;
        assert.equal(
          observed.revision,
          state.revision + (stage === "publication" ? 0 : 1),
        );
        assert.equal(
          observed.users[0]?.username,
          stage === "publication" ? actor.username : "故障確認後の名前",
        );
        for (const forbidden of [
          f.token,
          f.current,
          "lockRecoveryId",
          "state_store_",
          "fixture_",
        ])
          assert.equal(JSON.stringify(response).includes(forbidden), false);
      } finally {
        fs.renameSync = rename;
        fs.rmSync = remove;
        assert.equal((await server.close()).cleanupConfirmed, true);
      }
    });
  }
});

/**
 * 実Client切断を保存後のTransport取消へ接続する。
 * @responsibility 同期保存の既知出版と成功応答の抑止を別に観測する。
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @precondition 自己生成manager、実HTTP、対象出版だけのrename hook。
 * @stimulus 出版直後にClientRequestをdestroyする。
 * @observation Handler取消、Client本文0、保存改訂一回、次要求の現在投影。
 * @oracle 観測済み取消は-32800、保存を戻さず自動再送しない。
 * @cleanup Client close、両Server closeとfixture清掃を確認する。
 * @boundary 実Client／Socket→Transport signal→同期AM保存後の公開。
 */
test("非鍵管理MCPは保存後のClient切断を取消として観測する", {
  timeout: 15000,
}, async (t) => {
  const f = fixture(t);
  const state = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const actor = state.users[0];
  assert.ok(actor);
  actor.role = "manager";
  fs.writeFileSync(f.current, JSON.stringify(state));
  const resolver = createAccessMcpResolver(f.root);
  let notify: () => void = () => {};
  const settled = new Promise<void>((resolve) => {
    notify = resolve;
  });
  let handlerError: number | undefined;
  const server = await startMcpAuthenticatedStreamableHttp(
    async (token) => {
      const handler = await resolver(token);
      assert.ok(handler);
      return async (request, signal) => {
        const result = await handler(request, signal);
        handlerError = result.error?.code;
        notify();
        return result;
      };
    },
    { port: 0 },
  );
  const operationId = randomUUID();
  const body = JSON.stringify(
    packet("crdd.update_user_name", {
      expectedRevision: state.revision,
      operationId,
      userId: actor.userId,
      username: "取消後の保存済み名前",
    }),
  );
  let receivedBytes = 0;
  const client = httpRequest(
    {
      host: server.host,
      port: server.port,
      path: "/mcp",
      method: "POST",
      headers: {
        authorization: `Bearer ${f.token}`,
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
        "mcp-protocol-version": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
        "mcp-method": "tools/call",
        "mcp-name": "crdd.update_user_name",
      },
    },
    (response) => {
      response.on("data", (chunk: Buffer) => {
        receivedBytes += chunk.length;
      });
    },
  );
  client.on("error", () => {});
  const closed = new Promise<void>((resolve) => client.once("close", resolve));
  const rename = fs.renameSync;
  let publications = 0;
  try {
    fs.renameSync = (from, to) => {
      rename(from, to);
      if (String(to) === f.current) {
        publications++;
        client.destroy();
      }
    };
    client.end(body);
    await closed;
    await settled;
    assert.equal(handlerError, -32800);
    assert.equal(receivedBytes, 0);
    assert.equal(publications, 1);
  } finally {
    fs.renameSync = rename;
    client.destroy();
    await closed;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
  const current = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  assert.equal(current.revision, state.revision + 1);
  assert.equal(current.operationId, operationId);
  assert.equal(current.users[0]?.username, "取消後の保存済み名前");
  const next = await startMcpAuthenticatedStreamableHttp(resolver, { port: 0 });
  try {
    const response = await (
      await call(
        `http://${next.host}:${next.port}`,
        f.token,
        "crdd.list_access_users",
        {},
      )
    ).json();
    assert.equal(response.result.structuredContent.revision, current.revision);
    assert.equal(
      response.result.structuredContent.users[0].username,
      "取消後の保存済み名前",
    );
  } finally {
    assert.equal((await next.close()).cleanupConfirmed, true);
  }
});

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
      const original = defaultAiProfileCatalog.profiles[0];
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
      assert.equal(administration.snapshot().value?.revision, revision + 3);
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
 * @trace RFD-IT-021
 * @trace EST-IT-010
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @precondition Repository-localの試験Rootだけに書き込む。
 * @stimulus 初回公開保存APIと登録／Exposure APIを使用し、完了状態は試験fixtureで準備する。
 * @observation 保存状態・Git初期化・各公開管理結果。
 * @oracle 実配送成立は主張せず、二つの認可対象を同じProjectへ用意する。
 * @cleanup 呼出側のListener終了後に所有Directoryだけを削除し不存在を確認する。
 * @boundary 自己生成Filesystem、Git、AM公開保存入口。
 */
/**
 * 両公開入口を同じ実Git／Writer／現在認可へ接続する。
 * @responsibility Transportの違いで業務処理と認可を複製しないことを反証する。
 * @trace CPR-IT-001
 * @trace CPR-IT-004
 * @trace CPR-IT-006
 * @trace EST-IT-002
 * @precondition 自己生成AM、二Repositoryと二受付。
 * @stimulus 三Role、management限定、余分なfield、固定・Merge・終了。
 * @observation 実HTTP、実Git二親、固定差分、認可拒否と他Root無変更。
 * @oracle development許可時だけ同一Ownerへ一回処置し自動採用しない。
 * @cleanup 両Listener終了後fixtureのexact Rootを回収する。
 * @boundary loopback HTTP、実Git、Snapshot。外部AI／Dockerなし。
 */
test("WorkspaceはWorkbenchとMCPから同じ現在認可・実Gitへ接続する", async (t) => {
  const f = fixture(t);
  const target = f.targets[0];
  assert.ok(target);
  /**
   * 公開Workspace試験の対象Repositoryへ固定Git要求を出す。
   * @responsibility 公開Workspace試験の対象Repositoryへ固定Git要求を出す。
   * @trace CPR-IT-001
   * @trace CPR-IT-004
   * @trace CPR-IT-006
   * @precondition 自己生成targetと固定argv。
   * @stimulus hooksと署名を無効化してGitを同期実行する。
   * @observation 終了statusとtrim済みstdout。
   * @oracle status0だけを正常な候補・Merge観測として返す。
   * @cleanup Server終了後にfixtureが所有Rootを回収する。
   * @boundary 合成Repositoryのlocal Git。外部AIなし。
   */
  const run = (args: string[]) => {
    const result = spawnSync(
      "git",
      [
        "-C",
        target.target,
        "-c",
        "core.hooksPath=NUL",
        "-c",
        "commit.gpgSign=false",
        ...args,
      ],
      { encoding: "utf8", windowsHide: true, timeout: 10000 },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  run(["symbolic-ref", "HEAD", "refs/heads/main"]);
  run(["config", "user.name", "Surface Test"]);
  run(["config", "user.email", "test@example.invalid"]);
  fs.mkdirSync(path.join(target.target, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(target.target, ".git", "info", "exclude"), "");
  fs.writeFileSync(path.join(target.target, ".gitignore"), ".crdd/\n");
  fs.writeFileSync(path.join(target.target, "source.txt"), "base\n");
  const namedSecret = "API_KEY=synthetic_value_123456789";
  fs.writeFileSync(
    path.join(target.target, "secret.txt"),
    `heading\n${namedSecret}\n`,
  );
  run(["add", "."]);
  run(["commit", "-m", "base"]);
  const base = run(["rev-parse", "HEAD"]);
  prepareWorkspaceSurface(target.target, "project.fixture", base);
  const mcp = await startMcpAuthenticatedStreamableHttp(
    createAccessMcpResolver(f.root),
    { port: 0 },
  );
  const wb = await startWorkbench({
    workingDirectory: path.resolve(import.meta.dirname, "../../../.."),
    localAccessRoot: f.root,
  });
  try {
    const mcpBase = `http://${mcp.host}:${mcp.port}`;
    const model = (await (
      await fetch(`${wb.baseUrl}/api/workbench-view`, {
        headers: { authorization: `Bearer ${f.token}` },
      })
    ).json()) as { actionToken: string };
    const state = JSON.parse(
      fs.readFileSync(f.current, "utf8"),
    ) as AccessManagementState;
    const actor = state.users[0];
    assert.ok(actor);
    state.roleContentAccess = state.roleContentAccess.map((r) =>
      r.role === "administrator" ? { ...r, workspaceIds: ["development"] } : r,
    );
    const workspaceId = randomUUID();
    const common = {
      projectId: "project.fixture",
      queueId: "queue-a",
      workspaceId,
    };
    const readOps = ["list", "get", "inspect", "candidate-diff"];
    /**
     * 現在資格とRepository IDでWorkspace MCP要求を送る。
     * @responsibility 現在資格とRepository IDでWorkspace MCP要求を送る。
     * @trace CPR-IT-001
     * @trace CPR-IT-004
     * @trace CPR-IT-006
     * @trace EST-IT-002
     * @precondition 起動済み認証HTTPと固定token・target ID。
     * @stimulus 読取り操作と管理操作に対応するToolへcommandを渡す。
     * @observation HTTPとMCPの公開JSON結果。
     * @oracle 選択Repositoryだけに配送し不正・失効結果を補完しない。
     * @cleanup 呼出し元がServerをcloseし所有fixtureを回収する。
     * @boundary 実HTTP→認可→Workspace Owner。Providerは呼ばない。
     */
    const sendMcp = async (command: Record<string, unknown>) =>
      (
        await call(
          mcpBase,
          f.token,
          readOps.includes(String(command.operation))
            ? "crdd.get_workspace"
            : "crdd.manage_workspace",
          { repositoryId: target.id, command },
        )
      ).json();
    const sendWb = async (
      command: Record<string, unknown>,
      extra: Record<string, string> = {},
    ) =>
      fetch(`${wb.baseUrl}/workspace/action`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${f.token}`,
          origin: wb.baseUrl,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          actionToken: model.actionToken,
          repositoryId: target.id,
          command: JSON.stringify(command),
          ...extra,
        }),
      });
    for (const role of ["developer", "manager", "administrator"] as const) {
      actor.role = role;
      state.revision++;
      fs.writeFileSync(f.current, JSON.stringify(state));
      const command = {
        operation: "list",
        projectId: "project.fixture",
        cursor: null,
        limit: 1,
      };
      const a = await sendMcp(command);
      const access = resolveRepositoryAccess(
        f.root,
        f.token,
        target.id,
        "development",
      );
      assert.equal(access.status, "completed", JSON.stringify(access));
      executeWorkspaceCommand(
        target.target,
        "project.fixture",
        command,
        () => true,
      );
      assert.ok(a.result?.structuredContent, JSON.stringify(a));
      const b = await sendWb(command);
      assert.equal(b.status, 200);
      assert.deepEqual(await b.json(), a.result.structuredContent);
    }
    const roles = state.roleContentAccess;
    state.roleContentAccess = roles.map((r) =>
      r.role === actor.role ? { ...r, workspaceIds: ["management"] } : r,
    );
    state.revision++;
    fs.writeFileSync(f.current, JSON.stringify(state));
    assert.ok(
      (
        await sendMcp({
          operation: "list",
          projectId: "project.fixture",
          cursor: null,
          limit: 20,
        })
      ).error,
    );
    assert.equal(
      (
        await sendWb({
          operation: "list",
          projectId: "project.fixture",
          cursor: null,
          limit: 20,
        })
      ).status,
      400,
    );
    state.roleContentAccess = roles;
    state.revision++;
    fs.writeFileSync(f.current, JSON.stringify(state));
    assert.ok(
      (await sendMcp({ ...common, operation: "get", ownerRoot: target.target }))
        .error,
    );
    assert.equal(
      (
        await sendWb(
          { ...common, operation: "get" },
          { referencesReleased: "true" },
        )
      ).status,
      400,
    );
    let response = await sendMcp({
      ...common,
      operation: "create",
      expectedGeneration: 0,
      baseCommit: base,
      name: "共有作業",
    });
    let view = response.result?.structuredContent.data.workspace;
    assert.ok(view, JSON.stringify(response));
    const tree = path.join(
      target.target,
      ".crdd",
      "workspaces",
      workspaceId,
      "worktree",
    );
    const syntheticSecret = ["sk", "-", "a".repeat(24)].join("");
    for (const content of [
      syntheticSecret,
      namedSecret,
      `heading\n${namedSecret}\n`,
    ]) {
      fs.writeFileSync(path.join(tree, "source.txt"), content);
      const deniedSecret = await sendMcp({
        ...common,
        operation: "inspect",
        path: "source.txt",
      });
      assert.ok(deniedSecret.error);
      assert.equal(JSON.stringify(deniedSecret).includes(content), false);
      const deniedWb = await sendWb({
        ...common,
        operation: "inspect",
        path: "source.txt",
      });
      assert.equal(deniedWb.status, 503);
      assert.equal((await deniedWb.text()).includes(content), false);
    }
    fs.writeFileSync(path.join(tree, "secret.txt"), "safe\n");
    for (const operation of ["inspect", "candidate-diff"]) {
      if (operation === "candidate-diff") {
        const fixedSecret = await sendMcp({
          ...common,
          operation: "freeze",
          expectedGeneration: view.generation,
          operationId: randomUUID(),
          baseCommit: base,
          expectedHead: view.head,
          selection: [
            {
              path: "secret.txt",
              mode: "100644",
              blobId: run([
                "-C",
                tree,
                "hash-object",
                "--no-filters",
                "secret.txt",
              ]),
            },
          ],
          candidateName: null,
          relatedChangeIds: [],
        });
        assert.equal(
          fixedSecret.result.structuredContent.data.status,
          "completed",
        );
        view = fixedSecret.result.structuredContent.data.workspace;
      }
      const denied = await sendMcp({
        ...common,
        operation,
        path: "secret.txt",
      });
      assert.ok(denied.error);
      assert.equal(JSON.stringify(denied).includes(namedSecret), false);
      const deniedWb = await sendWb({
        ...common,
        operation,
        path: "secret.txt",
      });
      assert.equal(deniedWb.status, 503);
      assert.equal((await deniedWb.text()).includes(namedSecret), false);
    }
    response = await sendMcp({
      ...common,
      operation: "close-candidate",
      expectedGeneration: view.generation,
      expectedCommit: view.candidate.candidateCommit,
      disposition: "rejected",
    });
    assert.equal(response.result.structuredContent.data.status, "completed");
    view = response.result.structuredContent.data.workspace;
    fs.writeFileSync(path.join(tree, "source.txt"), "selected\n");
    const previewResponse = await sendWb({
      ...common,
      operation: "inspect",
      path: "source.txt",
    });
    assert.equal(previewResponse.status, 200);
    const preview = (await previewResponse.json()) as {
      data: { selection: unknown };
    };
    const fixedResponse = await sendWb({
      ...common,
      operation: "freeze",
      expectedGeneration: view.generation,
      operationId: randomUUID(),
      baseCommit: base,
      expectedHead: view.head,
      selection: [preview.data.selection],
      candidateName: "共有候補",
      relatedChangeIds: [],
    });
    assert.equal(fixedResponse.status, 200);
    const fixed = (await fixedResponse.json()) as {
      data: { status: string; workspace: typeof view };
    };
    assert.equal(fixed.data.status, "completed", JSON.stringify(fixed));
    view = fixed.data.workspace;
    assert.equal(run(["rev-parse", "HEAD"]), base);
    fs.writeFileSync(path.join(tree, "source.txt"), "not-fixed\n");
    response = await sendMcp({
      ...common,
      operation: "candidate-diff",
      path: "source.txt",
    });
    assert.match(response.result.structuredContent.data.patch, /selected/u);
    assert.doesNotMatch(
      response.result.structuredContent.data.patch,
      /not-fixed/u,
    );
    const originalEnd = ServerResponse.prototype.end;
    let dropped = false;
    const drop = t.mock.method(
      ServerResponse.prototype,
      "end",
      function (this: ServerResponse, ...args: Parameters<typeof originalEnd>) {
        const body = args[0];
        if (
          !dropped &&
          typeof body === "string" &&
          body.includes('"operation":"adopt"') &&
          body.includes('"contract":"crdd-orchestrator/workspace-surface/v1"')
        ) {
          dropped = true;
          this.destroy();
          return this;
        }
        return Reflect.apply(originalEnd, this, args);
      },
    );
    try {
      await assert.rejects(
        sendWb({
          ...common,
          operation: "adopt",
          expectedGeneration: view.generation,
          candidateCommit: view.candidate.candidateCommit,
          targetBranch: "main",
          expectedTargetHead: base,
        }),
      );
    } finally {
      drop.mock.restore();
    }
    assert.equal(dropped, true);
    const mergedHead = run(["rev-parse", "HEAD"]);
    response = await sendMcp({ ...common, operation: "get" });
    view = response.result.structuredContent.data.workspace;
    assert.equal(view.candidate.phase, "merged");
    assert.equal(view.candidate.mergeCommit, mergedHead);
    assert.equal(run(["rev-parse", "HEAD"]), mergedHead);
    assert.equal(
      run(["rev-list", "--parents", "-n", "1", "HEAD"]).split(" ").length,
      3,
    );
    const closed = await sendWb({
      ...common,
      operation: "close-candidate",
      expectedGeneration: view.generation,
      expectedCommit: view.candidate.candidateCommit,
      disposition: "adopted",
    });
    assert.equal(closed.status, 200);
    view = ((await closed.json()) as { data: { workspace: typeof view } }).data
      .workspace;
    assert.equal(view.candidate, null);
    response = await sendMcp({
      ...common,
      operation: "discard",
      expectedGeneration: view.generation,
      expectedHead: view.head,
      discardChanges: true,
    });
    assert.equal(
      response.result.structuredContent.data.status,
      "completed",
      JSON.stringify(response),
    );
    assert.equal(fs.existsSync(tree), false);
    const entry = path.resolve(
      import.meta.dirname,
      "../../../../template/tools/crdd-mcp-server.ts",
    );
    const localCommand = {
      operation: "list",
      projectId: "project.fixture",
      cursor: null,
      limit: 20,
    };
    const localMcp = spawnSync(process.execPath, [entry, "--stdio"], {
      cwd: target.target,
      input: `${JSON.stringify(packet("crdd.get_workspace", { repositoryId: target.id, command: localCommand }))}\n`,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
    });
    assert.equal(localMcp.status, 0, localMcp.stderr);
    const localResult = JSON.parse(localMcp.stdout);
    assert.ok(
      localResult.result?.structuredContent,
      JSON.stringify(localResult),
    );
    const logo = "04_UI/assets/brand/crdd-brand-icon-512x512.jpg";
    fs.mkdirSync(path.dirname(path.join(target.target, logo)), {
      recursive: true,
    });
    fs.copyFileSync(
      path.resolve(import.meta.dirname, "../../../..", logo),
      path.join(target.target, logo),
    );
    const localWb = await startWorkbench({ workingDirectory: target.target });
    try {
      const localModel = (await (
        await fetch(`${localWb.baseUrl}/api/workbench-view`)
      ).json()) as { actionToken: string };
      const observed = await fetch(`${localWb.baseUrl}/workspace/action`, {
        method: "POST",
        headers: {
          origin: localWb.baseUrl,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          actionToken: localModel.actionToken,
          repositoryId: target.id,
          command: JSON.stringify(localCommand),
        }),
      });
      assert.equal(observed.status, 200);
      assert.deepEqual(
        await observed.json(),
        localResult.result.structuredContent,
      );
    } finally {
      await localWb.close();
    }
    assert.doesNotMatch(
      JSON.stringify(response),
      /candidate-index|repositoryBindingId|ownerRepositoryRoot/u,
    );
    const other = f.targets[1];
    assert.ok(other);
    assert.equal(
      fs.existsSync(path.join(other.target, ".crdd", "orchestrator")),
      false,
    );
    const credential = state.credentials[0];
    assert.ok(credential);
    credential.revoked = true;
    state.revision++;
    fs.writeFileSync(f.current, JSON.stringify(state));
    assert.ok(
      (
        await sendMcp({
          operation: "list",
          projectId: "project.fixture",
          cursor: null,
          limit: 20,
        })
      ).error,
    );
  } finally {
    await wb.close();
    await mcp.close();
  }
});

/**
 * 認証済み二Repositoryの実保存fixtureを用意する。
 * @responsibility 認証済み二Repositoryの実保存fixtureを用意する。
 * @trace EST-IT-002
 * @trace CPR-IT-010
 * @trace CPR-IT-012
 * @trace RFD-IT-013
 * @trace RFD-IT-021
 * @precondition Repository直下tests領域が非linkの通常Directory。
 * @stimulus AM初期化、固定資格、合成Git RootとProject Contextを作る。
 * @observation 検証済みStore Root、tokenと二つの対象。
 * @oracle 指定した初期化段階・Role・公開範囲を実Readerが読める。
 * @cleanup t.afterでexact所有Directoryだけを削除し不存在を確認する。
 * @boundary 実AM・Filesystem・local Git。tokenを公開本文やログへ出さない。
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
 * 内容・非鍵管理ToolのJSON-RPC要求を作る。
 * @responsibility 実HTTPと直接Handlerで同じwire入力を使用する。
 * @trace RFD-IT-021
 * @trace EST-IT-010
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
 * @trace RFD-IT-021
 * @trace EST-IT-010
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
 * @boundary 同Projectの固定Markdown入力生成だけ。保存・公開は呼出し元が検証する。
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
 * @boundary 同Projectの固定Markdown入力生成だけ。保存・公開は呼出し元が検証する。
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
 * @boundary 実認証HTTP→内容MCP→Domain保存。AIと外部通信はない。
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
        "crdd.get_workspace",
        "crdd.manage_workspace",
        MCP_PROJECT_CONTEXT_GET_TOOL,
        MCP_PROJECT_CONTEXT_LIST_TOOL,
        MCP_RUNTIME_ACTIVITY_TOOL,
        MCP_CURRENT_ACCESS_TOOL,
        ...MCP_TOPIC_MEETING_TOOLS,
      ].sort(),
    );
    for (const tool of tools) {
      const topicMeeting =
        MCP_TOPIC_MEETING_TOOLS.includes(tool.name as never) ||
        ["crdd.get_workspace", "crdd.manage_workspace"].includes(tool.name);
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
        "crdd.get_workspace",
        "crdd.manage_workspace",
        MCP_PROJECT_CONTEXT_GET_TOOL,
        MCP_PROJECT_CONTEXT_LIST_TOOL,
        MCP_RUNTIME_ACTIVITY_TOOL,
        MCP_CURRENT_ACCESS_TOOL,
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
 * @boundary 実HTTPの現在認可とProject境界。拒否時の対象本文保全を実観測する。
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
 * @boundary 現在許可されたRepository集合の実Relation探索。集合不明を空集合にしない。
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
 * @boundary MCP入力検証と取消済みSignal。対象open前の拒否を計数する。
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
 * 実HTTPの許可集合と本文版を再評価し、文書不完全性と全体停止を分ける。
 * @responsibility 空認可・欠測・部分成功と通常成功を区別する。
 * @trace PPR-IT-002
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @trace RFD-IT-013
 * @precondition 二RepositoryのProject Contextと現在developer資格。
 * @stimulus 反復取得と時刻だけ一年進めた同じ内容要求、administrator空認可、本文欠測・Identity競合・Root不成立、第一本文close後の管理改訂変更、失効資格を送る。
 * @observation Reader回数、完全／空／部分／競合Portfolio、公開前集合差の固定MCPエラーとresult不存在、非秘密body、close後接続拒否。
 * @oracle 毎要求で本文二回、空認可本文0、本文未確認・競合は明示した部分結果。実体不成立または読取り中の管理改訂差は全体エラー、失効は401。
 * @cleanup fs hook復元とServer close／join後にFixtureを回収する。
 * @boundary 実HTTP→AM→Domain固定本文→MCP応答。
 */
test("実HTTPは文書未確認・競合を部分表示し実体不明を全体停止する", async (t) => {
  const f = fixture(t),
    resolver = createAccessMcpResolver(f.root);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}`;
  const open = fs.openSync;
  let reads = 0;
  const readTargets: string[] = [];
  let baseline: unknown;
  fs.openSync = (file, flags, mode) => {
    if (f.targets.some(({ body }) => String(file) === body)) {
      reads++;
      readTargets.push(String(file));
    }
    return open(file, flags, mode);
  };
  try {
    for (let i = 0; i < 2; i++) {
      reads = 0;
      const response = await call(base, f.token);
      assert.equal(response.status, 200);
      const text = await response.text(),
        result = JSON.parse(text);
      baseline = result;
      assert.equal(result.result.structuredContent.project.state, "complete");
      assert.equal(result.result.structuredContent.project.sources.length, 2);
      assert.equal(reads, 2);
      for (const target of f.targets)
        assert.equal(text.includes(target.target), false);
      assert.equal(text.includes(f.token), false);
      assert.equal(text.includes("managementRevision"), false);
      assert.equal(text.includes("bindingId"), false);
    }
    const beforeTimeOnly = fs.readFileSync(f.current);
    readTargets.length = 0;
    reads = 0;
    const later = Date.now() + 365 * 24 * 60 * 60 * 1000;
    const clock = t.mock.method(Date, "now", () => later);
    try {
      const response = await call(base, f.token);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), baseline);
      assert.equal(reads, 2);
      assert.deepEqual(
        readTargets.sort(),
        f.targets.map(({ body }) => body).sort(),
      );
      assert.deepEqual(fs.readFileSync(f.current), beforeTimeOnly);
    } finally {
      clock.mock.restore();
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
    const close = fs.closeSync;
    let firstDescriptor: number | undefined;
    let currentChanged = false;
    fs.openSync = (file, flags, mode) => {
      const fd = open(file, flags, mode);
      if (f.targets.some(({ body }) => String(file) === body)) reads++;
      if (!currentChanged && String(file) === f.targets[0]?.body)
        firstDescriptor = fd;
      return fd;
    };
    fs.closeSync = (fd) => {
      close(fd);
      if (fd === firstDescriptor) {
        firstDescriptor = undefined;
        currentChanged = true;
        fs.writeFileSync(
          f.current,
          JSON.stringify({ ...state, revision: state.revision + 1 }),
        );
      }
    };
    try {
      reads = 0;
      const changed = await call(base, f.token);
      assert.deepEqual(await changed.json(), {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32603, message: "Project Context unavailable" },
      });
      assert.equal(currentChanged, true);
      assert.equal(reads, 2);
    } finally {
      fs.closeSync = close;
      fs.openSync = (file, flags, mode) => {
        if (f.targets.some(({ body }) => String(file) === body)) {
          reads++;
          readTargets.push(String(file));
        }
        return open(file, flags, mode);
      };
      fs.writeFileSync(f.current, JSON.stringify(state));
    }
    const second = f.targets[1];
    assert.ok(second);
    const originalContext = fs.readFileSync(second.body, "utf8");
    fs.rmSync(second.body);
    const failed = await call(base, f.token);
    const partial = (await failed.json()).result.structuredContent.project;
    assert.equal(partial.state, "partial");
    assert.equal(partial.sources[0].state, "complete");
    assert.deepEqual(partial.sources[1], {
      repositoryId: second.id,
      state: "unavailable",
      revision: null,
      repositoryRole: null,
      context: null,
    });
    for (const field of ["Project ID", "Repository ID", "Repository Role"]) {
      fs.writeFileSync(
        second.body,
        originalContext.replace(
          new RegExp(`${field}: [^\\r\\n]+`, "u"),
          `${field}: foreign-source`,
        ),
      );
      const response = await call(base, f.token);
      const text = await response.text();
      const conflict = JSON.parse(text).result.structuredContent.project;
      assert.equal(conflict.state, "conflicting", field);
      assert.deepEqual(conflict.sources[0], partial.sources[0], field);
      assert.deepEqual(
        conflict.sources[1],
        {
          repositoryId: second.id,
          state: "conflicting",
          revision: null,
          repositoryRole: null,
          context: null,
        },
        field,
      );
      assert.equal(text.includes("foreign-source"), false, field);
    }
    fs.writeFileSync(second.body, originalContext);
    const git = path.join(second.target, ".git"),
      heldGit = path.join(second.target, ".git-held");
    fs.renameSync(git, heldGit);
    try {
      reads = 0;
      const blocked = await call(base, f.token);
      assert.deepEqual(await blocked.json(), {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32603, message: "Project Context unavailable" },
      });
      assert.equal(reads, 0);
    } finally {
      fs.renameSync(heldGit, git);
    }
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
  const openDescriptors = new Set<number>();
  const reads = [0, 0];
  fs.openSync = (file, flags, mode) => {
    const fd = open(file, flags, mode);
    openDescriptors.add(fd);
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
    openDescriptors.delete(fd);
    if (fd === descriptor) {
      closed++;
      descriptor = undefined;
    }
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
    assert.equal(openDescriptors.size, 0);
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

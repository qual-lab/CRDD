/**
 * Workbench HTTPの受付と診断配信をServerの公開入口で確認する。
 * @packageDocumentation
 * @responsibility 旧構成拒否、固定Route、開発資料、Status・Header・Listener終了を確認する。
 * @trace ERB-IT-021
 * @level IT
 * @boundary loopback HTTPとServer公開入口。実AI・Dockerは使わない。
 */
import assert from "node:assert/strict";
import type { IncomingMessage } from "node:http";
import { Readable } from "node:stream";
import test from "node:test";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "@qual-lab/crdd-version-control";
import { startWorkbench } from "../../src/app.ts";
import {
  RequestBodyTooLarge,
  readJsonRequestBody,
} from "../../src/transport/api-http.ts";
import { requestRaw, requestTransport } from "../support/workbench-http.ts";
import { assertManagementResponse } from "../support/workbench-wire.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/** JSON読取りは曖昧な本文、壊れた符号化、上限超過を区別する。 @trace ERB-IT-021 */
test("HTTPの共通JSON読取りはUTF-8・重複キー・バイト上限を維持する", async () => {
  const body = (...chunks: Buffer[]) =>
    Object.assign(Readable.from(chunks), { headers: {} }) as IncomingMessage;
  const bytes = Buffer.from('{"name":"日本語"}');
  assert.deepEqual(
    await readJsonRequestBody(
      body(bytes.subarray(0, 10), bytes.subarray(10)),
      bytes.length,
    ),
    { name: "日本語" },
  );
  assert.equal(
    await readJsonRequestBody(body(Buffer.from('{"name":1,"name":2}')), 40),
    null,
  );
  await assert.rejects(
    readJsonRequestBody(
      body(Buffer.from('{"name":"'), Buffer.from([0xff]), Buffer.from('"}')),
      40,
    ),
    TypeError,
  );
  await assert.rejects(
    readJsonRequestBody(body(bytes), bytes.length - 1),
    RequestBodyTooLarge,
  );
});

/** 実HTTPを観測する試験側が不正な改訂・結果区分を成功として受理しない。 @trace ERB-IT-021 */
test("管理HTTPの観測は配列を状態値に変換せず未定義の改訂を拒否する", () => {
  const operationId = "a0000000-0000-4000-8000-000000000001";
  const completed = {
    status: "completed",
    operationId,
    expectedRevision: 1,
    revision: 2,
    publication: "confirmed",
    cleanupConfirmed: true,
    userId: operationId,
  };
  const unavailable = {
    status: "unavailable",
    reason: "management_operation_unavailable",
    operationId,
    expectedRevision: 1,
    observedRevision: null,
    primaryFailure: "prepare_failed",
    publication: "not_attempted",
    cleanupConfirmed: false,
  };
  assert.equal(assertManagementResponse(completed, "mutation"), completed);
  assert.equal(assertManagementResponse(unavailable, "mutation"), unavailable);
  for (const invalid of [
    { ...completed, expectedRevision: 0, revision: 1 },
    { ...unavailable, publication: ["confirmed"] },
    { ...unavailable, primaryFailure: ["prepare_failed"] },
  ])
    assert.throws(() => assertManagementResponse(invalid, "mutation"));
});

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
    "/openapi.json",
    "/docs",
    "/docs/swagger-ui-bundle.js",
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
 * 明示localhostモードのAPI仕様とSwagger UIを実HTTPで確認する。
 * @trace ERB-IT-021
 * @stimulus 固定5資産と未知Path・不許可Host／Methodを要求する。
 * @oracle OpenAPIは既存HTTP操作だけを記述し、UIは外部通信・操作実行・資格保持を有効化しない。
 * @cleanup 所有Listenerを終了し、再接続拒否を確認する。
 */
test("開発用API仕様は明示localhostモードで同一Originの固定資産だけを返す", async () => {
  const handle = await startWorkbench({
    workingDirectory: repositoryRoot,
    apiDocumentation: true,
  });
  try {
    const spec = await requestRaw(handle.baseUrl, "/openapi.json");
    assert.equal(spec.status, 200);
    assert.match(String(spec.headers["content-type"]), /^application\/json/u);
    const doc = JSON.parse(spec.body.toString("utf8"));
    assert.equal(doc.openapi, "3.1.1");
    assert.deepEqual(doc.servers, [
      { url: "/", description: "単体loopback配置（--docs）" },
    ]);
    const operationIds = Object.values(
      doc.paths as Record<string, Record<string, { operationId: string }>>,
    ).flatMap((operations) =>
      Object.entries(operations)
        .filter(([method]) =>
          /^(get|head|post|put|patch|delete|options|trace)$/u.test(method),
        )
        .map(([, { operationId }]) => operationId),
    );
    assert.ok(operationIds.every((id) => typeof id === "string" && id !== ""));
    assert.equal(new Set(operationIds).size, operationIds.length);
    assert.equal(doc.paths["/api/projects"].get.operationId, "list_projects");
    assert.deepEqual(
      doc.paths["/api/projects"].get.parameters.map(
        ({ name }: { name: string }) => name,
      ),
      ["repositoryId", "q", "state", "cursor", "limit"],
    );
    const repoRoute = "/api/repositories/{repositoryId}";
    for (const [resource, expectedParameters, invalidQuery] of [
      [
        "/api/projects",
        ["repositoryId", "q", "state", "cursor", "limit"],
        "?route=%2Fproject",
      ],
      [
        `${repoRoute}/activity`,
        ["repositoryId", "cursor", "limit"],
        "?limit=51",
      ],
      [
        `${repoRoute}/worktree/tree`,
        ["repositoryId", "directory", "cursor"],
        "?path=readme.md",
      ],
      [`${repoRoute}/worktree/diff`, ["repositoryId", "path"], ""],
    ] as const) {
      const described = doc.paths[resource];
      for (const method of ["get", "head"] as const)
        assert.deepEqual(
          (described[method].parameters ?? described.parameters).map(
            ({ name }: { name: string }) => name,
          ),
          [...expectedParameters],
          `${method} ${resource}`,
        );
      assert.equal(
        Object.hasOwn(described.head.responses["200"], "content"),
        false,
      );
      const url =
        resource.replace("{repositoryId}", "repository.example") + invalidQuery;
      const get = await requestRaw(handle.baseUrl, url, "GET");
      const head = await requestRaw(handle.baseUrl, url, "HEAD");
      assert.equal(get.status, 400, url);
      assert.equal(head.status, get.status, url);
      assert.equal(head.body.length, 0);
    }
    assert.ok(
      doc.paths["/api/workbench/overview"].get.parameters.every(
        ({ name }: { name: string }) =>
          !name.startsWith("portfolio") &&
          ![
            "treeDirectory",
            "treeCursor",
            "diffPath",
            "activityCursor",
          ].includes(name),
      ),
    );
    assert.equal(
      doc.paths["/api/workbench/context"].get.operationId,
      "readWorkbenchContext",
    );
    assert.equal(Object.hasOwn(doc.paths, "/api/workbench/view"), false);
    assert.equal(
      doc.paths["/api/projects/{projectId}"].get.operationId,
      "get_project",
    );
    assert.equal(
      doc.paths["/api/repositories/{repositoryId}/projects/{projectId}/context"]
        .get.operationId,
      "get_project_context",
    );
    assert.equal(Object.hasOwn(doc.paths, "/api/workspace"), false);
    const workspace = doc.paths["/api/repositories/{repositoryId}/workspaces"];
    assert.deepEqual(Object.keys(workspace).sort(), ["get", "post"]);
    assert.equal(workspace.get.operationId, "list_workspaces");
    assert.equal(workspace.post.operationId, "create_workspace");
    assert.ok(workspace.post.responses["201"]);
    assert.ok(workspace.post.responses["200"]);
    const workspaceCreate =
      workspace.post.requestBody.content["application/json"].schema;
    assert.equal(workspaceCreate.additionalProperties, false);
    assert.equal(Object.hasOwn(workspaceCreate.properties, "operation"), false);
    assert.equal(
      Object.hasOwn(workspaceCreate.properties, "repositoryId"),
      false,
    );
    const workspaceRename =
      doc.paths["/api/repositories/{repositoryId}/workspaces/{workspaceId}"]
        .patch;
    assert.ok(
      workspaceRename.parameters.some(
        (p: { name: string; in: string }) =>
          p.name === "workspaceId" && p.in === "path",
      ),
    );
    assert.equal(
      Object.hasOwn(
        workspaceRename.requestBody.content["application/json"].schema
          .properties,
        "workspaceId",
      ),
      false,
    );
    assert.equal(Object.hasOwn(doc.paths, "/api/repository"), false);
    const gitRepository = "/api/repositories/{repositoryId}";
    for (const [resource, operation, fields] of [
      ["tree", "readRepositoryTree", ["repositoryId", "directory", "cursor"]],
      ["diff", "readRepositoryFileDiff", ["repositoryId", "path"]],
    ] as const) {
      const read = doc.paths[`${gitRepository}/worktree/${resource}`];
      assert.equal(read.get.operationId, operation);
      assert.equal(Object.hasOwn(read.head.responses["200"], "content"), false);
      assert.deepEqual(
        read.parameters.map(({ name }: { name: string }) => name),
        fields,
      );
    }
    const staging = doc.paths[`${gitRepository}/staging`];
    assert.equal(staging.post.operationId, "stageRepositoryPath");
    assert.equal(staging.delete.operationId, "unstageRepositoryPath");
    const publication =
      doc.paths[`${gitRepository}/revisions/{revision}/publication`].post;
    assert.deepEqual(
      publication.requestBody.content["application/json"].schema.required,
      ["destination", "branch", "humanConfirmed"],
    );
    assert.equal(Object.hasOwn(doc.paths, "/api/records"), false);
    assert.equal(
      doc.paths["/api/repositories/{repositoryId}/activity"].get.operationId,
      "get_execution_activity",
    );
    for (const retired of [
      "/api/access",
      "/api/access/connection",
      "/api/access/credentials",
    ])
      assert.equal(Object.hasOwn(doc.paths, retired), false, retired);
    assert.equal(
      Object.hasOwn(doc.components?.securitySchemes ?? {}, "bearerAuth"),
      false,
    );
    assert.equal(Object.hasOwn(doc.paths, "/api/ai-request"), false);
    const aiRepository = "/api/repositories/{repositoryId}";
    for (const [target, names] of [
      ["ai-request", ["repositoryId"]],
      ["ai-requests/{requestId}", ["repositoryId", "requestId"]],
    ] as const) {
      const entry = doc.paths[`${aiRepository}/${target}`];
      assert.deepEqual(
        Object.keys(entry),
        target === "ai-request" ? ["get", "put"] : ["get"],
      );
      assert.deepEqual(
        entry.get.parameters.map(
          ({ name, in: source }: { name: string; in: string }) => [
            name,
            source,
          ],
        ),
        names.map((name) => [name, "path"]),
      );
    }
    assert.equal(
      doc.paths[`${aiRepository}/ai-requests`].post.operationId,
      "startAiRequest",
    );
    assert.equal(
      doc.paths[`${aiRepository}/ai-requests/{requestId}/cancellation`].post
        .operationId,
      "cancelAiRequest",
    );
    assert.equal(
      doc.paths[`${aiRepository}/ai-request`].put.operationId,
      "selectAiRequest",
    );
    assert.equal(Object.hasOwn(doc.paths, "/api/ai-selection"), false);
    const aiSelection =
      doc.paths["/api/repositories/{repositoryId}/ai-selection"];
    assert.deepEqual(Object.keys(aiSelection).sort(), [
      "get",
      "head",
      "parameters",
      "put",
    ]);
    assert.deepEqual(
      aiSelection.parameters.map(
        (parameter: { name: string }) => parameter.name,
      ),
      ["repositoryId"],
    );
    assert.equal(aiSelection.put.parameters[0].name, "X-CRDD-Action-Token");
    assert.deepEqual(
      Object.keys(
        aiSelection.put.requestBody.content["application/json"].schema
          .properties,
      ).sort(),
      ["config", "expectedIdentity"],
    );
    assert.deepEqual(Object.keys(doc.paths).sort(), [
      "/.well-known/crdd-workbench-health",
      "/api/projects",
      "/api/projects/{projectId}",
      "/api/repositories/{repositoryId}/activity",
      "/api/repositories/{repositoryId}/ai-request",
      "/api/repositories/{repositoryId}/ai-requests",
      "/api/repositories/{repositoryId}/ai-requests/{requestId}",
      "/api/repositories/{repositoryId}/ai-requests/{requestId}/cancellation",
      "/api/repositories/{repositoryId}/ai-selection",
      "/api/repositories/{repositoryId}/artifacts",
      "/api/repositories/{repositoryId}/changes/{changeId}",
      "/api/repositories/{repositoryId}/meetings",
      "/api/repositories/{repositoryId}/meetings/{meetingId}",
      "/api/repositories/{repositoryId}/meetings/{meetingId}/outcomes/{outcomeId}/treatment",
      "/api/repositories/{repositoryId}/projects/{projectId}/context",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/decisions",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/decisions/{decisionId}/answers",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/decisions/{decisionId}/application",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/decisions/{decisionId}/closure",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/definition",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/objectives",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/objectives/{objectiveId}",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/plan",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/runs",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/tasks",
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/tasks/{taskId}",
      "/api/repositories/{repositoryId}/revisions",
      "/api/repositories/{repositoryId}/revisions/{revision}/publication",
      "/api/repositories/{repositoryId}/runs/{requestId}",
      "/api/repositories/{repositoryId}/runs/{requestId}/cancellation",
      "/api/repositories/{repositoryId}/runs/{requestId}/resumption",
      "/api/repositories/{repositoryId}/selected-workspace",
      "/api/repositories/{repositoryId}/staging",
      "/api/repositories/{repositoryId}/topics",
      "/api/repositories/{repositoryId}/topics/{topicId}",
      "/api/repositories/{repositoryId}/topics/{topicId}/promotion",
      "/api/repositories/{repositoryId}/workspaces",
      "/api/repositories/{repositoryId}/workspaces/{workspaceId}",
      "/api/repositories/{repositoryId}/workspaces/{workspaceId}/adoption",
      "/api/repositories/{repositoryId}/workspaces/{workspaceId}/candidate/closure",
      "/api/repositories/{repositoryId}/workspaces/{workspaceId}/candidate/diff",
      "/api/repositories/{repositoryId}/workspaces/{workspaceId}/freeze",
      "/api/repositories/{repositoryId}/workspaces/{workspaceId}/hold",
      "/api/repositories/{repositoryId}/workspaces/{workspaceId}/inspection",
      "/api/repositories/{repositoryId}/worktree/diff",
      "/api/repositories/{repositoryId}/worktree/tree",
      "/api/workbench/context",
      "/api/workbench/overview",
    ]);
    const topics = doc.paths["/api/repositories/{repositoryId}/topics"];
    assert.equal(topics.get.operationId, "list_topics");
    assert.equal(topics.post.operationId, "create_topic");
    assert.deepEqual(
      Object.keys(topics.post.responses).filter((status) =>
        status.startsWith("2"),
      ),
      ["201"],
    );
    const topic =
      doc.paths["/api/repositories/{repositoryId}/topics/{topicId}"];
    assert.deepEqual(
      topic.patch.requestBody.content["application/json"].schema.required,
      ["expectedRevision", "markdown"],
    );
    const outcome =
      doc.paths[
        "/api/repositories/{repositoryId}/meetings/{meetingId}/outcomes/{outcomeId}/treatment"
      ].put;
    assert.equal(outcome.operationId, "treat_meeting_outcome");
    assert.ok(
      !Object.hasOwn(
        outcome.requestBody.content["application/json"].schema.properties,
        "outcomeId",
      ),
    );
    const viewResponse =
      doc.paths["/api/workbench/overview"].get.responses["200"];
    for (const name of ["crdd/workbench/view/v1", "projectData"])
      assert.ok(viewResponse.description.includes(name), name);
    const stateRoute =
      doc.paths["/api/repositories/{repositoryId}/runs/{requestId}"];
    assert.deepEqual(Object.keys(stateRoute), ["get"]);
    assert.equal(stateRoute.get.operationId, "get_execution_state");
    assert.deepEqual(
      stateRoute.get.parameters.map(
        ({
          name,
          in: location,
          required,
        }: {
          name: string;
          in: string;
          required: boolean;
        }) => [name, location, required],
      ),
      [
        ["repositoryId", "path", true],
        ["requestId", "path", true],
        ["projectId", "query", true],
        ["repositoryRevision", "query", true],
        ["queueId", "query", false],
      ],
    );
    const decisionCollection =
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/decisions";
    const decisionPathFields = [
      "operation",
      "repositoryId",
      "projectId",
      "milestoneId",
    ];
    const decisionVersionFields = ["generation", "repositoryRevision"];
    for (const [pathname, operationId, forbidden, required] of [
      [
        decisionCollection,
        "request_decision",
        decisionPathFields,
        [
          ...decisionVersionFields,
          "decisionId",
          "blockerId",
          "queueId",
          "question",
          "allowedOptions",
        ],
      ],
      [
        `${decisionCollection}/{decisionId}/answers`,
        "answer_decision",
        [...decisionPathFields, "decisionId", "status"],
        [...decisionVersionFields, "selectedOption"],
      ],
      [
        `${decisionCollection}/{decisionId}/application`,
        "apply_decision",
        [...decisionPathFields, "decisionId", "selectedOption"],
        decisionVersionFields,
      ],
      [
        `${decisionCollection}/{decisionId}/closure`,
        "close_decision",
        [...decisionPathFields, "decisionId", "selectedOption"],
        [...decisionVersionFields, "status", "reason"],
      ],
      [
        "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}/runs",
        "start_objective",
        ["operation", "repositoryId", "projectId", "milestoneId"],
        ["requestId", "plan", "taskInputs"],
      ],
      [
        "/api/repositories/{repositoryId}/runs/{requestId}/resumption",
        "resume_objective",
        ["operation", "repositoryId", "requestId"],
        ["projectId", "milestoneId", "plan", "taskInputs"],
      ],
      [
        "/api/repositories/{repositoryId}/runs/{requestId}/cancellation",
        "cancel_objective",
        ["operation", "repositoryId", "requestId"],
        ["projectId", "launchId"],
      ],
    ] as const) {
      const { post } = doc.paths[pathname];
      assert.deepEqual(Object.keys(doc.paths[pathname]), ["post"]);
      assert.equal(post.operationId, operationId);
      const body = post.requestBody.content["application/json"].schema;
      assert.equal(body.additionalProperties, false);
      for (const field of forbidden)
        assert.ok(!Object.hasOwn(body.properties, field), field);
      for (const field of required)
        assert.ok(body.required.includes(field), field);
      if (operationId === "answer_decision") {
        assert.ok(Object.hasOwn(body.properties, "comment"));
        assert.ok(!body.required.includes("comment"));
      }
      if (operationId === "cancel_objective") {
        assert.ok(!Object.hasOwn(post.responses, "200"));
        assert.deepEqual(body.required, ["projectId", "launchId"]);
        assert.equal(
          post.responses["202"].content["application/json"].schema.properties
            .status.const,
          "cancellation_requested",
        );
      }
      for (const [field, accepted, rejected] of [
        ["question", `\n${"問".repeat(8193)}`, " \n"],
        ["comment", "注".repeat(1025), "注\n"],
        ["reason", "理".repeat(1025), "理\u0000"],
      ] as const) {
        const schema = body.properties[field];
        if (schema === undefined) continue;
        assert.equal(schema.maxLength, undefined, field);
        const pattern = new RegExp(schema.pattern, "u");
        assert.ok(pattern.test(accepted), field);
        assert.ok(!pattern.test(rejected), field);
      }
      assert.ok(
        post.parameters.some(
          ({ name, in: location }: { name: string; in: string }) =>
            name === "X-CRDD-Action-Token" && location === "header",
        ),
      );
    }
    assert.equal(
      (
        await requestRaw(
          handle.baseUrl,
          "/api/execution/decisions/submit",
          "POST",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await requestRaw(
          handle.baseUrl,
          "/api/execution/objectives/run",
          "POST",
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await requestRaw(
          handle.baseUrl,
          "/api/repositories/sample/runs/run-1",
          "GET",
        )
      ).status,
      400,
    );
    assert.equal(
      (await requestRaw(handle.baseUrl, "/api/execution/state", "GET")).status,
      404,
    );
    const executionOrigin = new URL(handle.baseUrl).origin;
    const executionPath = "/api/repositories/sample/runs/run-1";
    const allowedHeaders = await requestTransport(
      handle.baseUrl,
      executionPath,
      "GET",
      undefined,
      { Origin: executionOrigin },
    );
    assert.equal(allowedHeaders.status, 400);
    const repeatedOrigin = await requestTransport(
      handle.baseUrl,
      executionPath,
      "GET",
      undefined,
      { Origin: [executionOrigin, executionOrigin] },
    );
    assert.equal(repeatedOrigin.status, 403);
    const rejectedRunHead = await requestRaw(
      handle.baseUrl,
      "/api/repositories/sample/runs/run-1",
      "HEAD",
    );
    assert.equal(rejectedRunHead.status, 400);
    assert.equal(rejectedRunHead.body.length, 0);
    assert.equal(
      (await requestRaw(handle.baseUrl, "/api/execution", "POST")).status,
      404,
    );
    assert.equal(
      (await requestRaw(handle.baseUrl, "/api/runtime-definition", "POST"))
        .status,
      404,
    );
    for (const legacy of [
      "/workspace/action",
      "/ai-selection/action",
      "/api/execution-definition",
      "/api/execution/definition",
    ])
      assert.equal(
        (await requestRaw(handle.baseUrl, legacy, "POST")).status,
        legacy.startsWith("/api/") ? 404 : 405,
      );
    const definitionBase =
      "/api/repositories/{repositoryId}/projects/{projectId}/milestones/{milestoneId}";
    assert.equal(Object.hasOwn(doc.paths, "/api/execution/definition"), false);
    for (const [resource, methods] of [
      ["definition", ["post"]],
      ["objectives", ["get", "post"]],
      ["objectives/{objectiveId}", ["delete", "patch"]],
      ["plan", ["get", "put"]],
      ["tasks", ["get", "post"]],
      ["tasks/{taskId}", ["delete", "patch"]],
    ] as const)
      assert.deepEqual(
        Object.keys(doc.paths[`${definitionBase}/${resource}`]).sort(),
        methods,
      );
    const taskItem = doc.paths[`${definitionBase}/tasks/{taskId}`];
    assert.deepEqual(
      taskItem.delete.requestBody.content["application/json"].schema.required,
      ["expected", "expectedDefinitionHash"],
    );
    const taskList = doc.paths[`${definitionBase}/tasks`].get.parameters;
    assert.equal(
      taskList.find(({ name }: { name: string }) => name === "queueId")
        ?.required,
      false,
    );
    const page = await requestRaw(handle.baseUrl, "/docs");
    assert.equal(page.status, 200);
    assert.match(page.body.toString("utf8"), /id="swagger-ui"/u);
    assert.match(
      String(page.headers["content-security-policy"]),
      /connect-src 'self'/u,
    );
    assert.equal(page.headers["cache-control"], "no-store");
    const docsWithLocalHost = await requestTransport(
      handle.baseUrl,
      "/docs",
      "GET",
      undefined,
      { Host: `localhost:${new URL(handle.baseUrl).port}` },
    );
    assert.equal(docsWithLocalHost.status, 200);
    const initializer = await requestRaw(
      handle.baseUrl,
      "/docs/swagger-initializer.js",
    );
    assert.equal(initializer.status, 200);
    assert.match(
      initializer.body.toString("utf8"),
      /supportedSubmitMethods: \[\]/u,
    );
    assert.match(initializer.body.toString("utf8"), /validatorUrl: null/u);
    assert.match(
      initializer.body.toString("utf8"),
      /persistAuthorization: false/u,
    );
    const assets = [
      ["/docs/swagger-ui.css", /^text\/css/u],
      ["/docs/swagger-ui-bundle.js", /^text\/javascript/u],
    ] as const;
    for (const [asset, mediaType] of assets) {
      const delivered = await requestRaw(handle.baseUrl, asset);
      assert.equal(delivered.status, 200);
      assert.match(String(delivered.headers["content-type"]), mediaType);
      assert.ok(delivered.body.length > 0);
    }
    const head = await requestRaw(handle.baseUrl, "/openapi.json", "HEAD");
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.equal(
      (await requestRaw(handle.baseUrl, "/docs", "POST")).status,
      405,
    );
    for (const forbidden of [
      "/docs/",
      "/docs/package.json",
      "/docs/%73wagger-ui.css",
    ])
      assert.equal((await requestRaw(handle.baseUrl, forbidden)).status, 404);
    const forwarded = await fetch(`${handle.baseUrl}/docs`, {
      headers: { "x-forwarded-host": "foreign.example" },
    });
    assert.equal(forwarded.status, 403);
  } finally {
    await handle.close();
  }
  await assert.rejects(requestRaw(handle.baseUrl, "/docs"));
});

/**
 * Expressの既定Routing・応答加工で既存のHTTP契約を広げない。
 * @responsibility 大小文字・末尾slash・encoded Path・Method・HEADと旧入口の拒否を公開HTTPで確認する。
 * @trace ERB-IT-021
 * @precondition 現在Repositoryを読取り、localhost Server一件だけを起動する。
 * @stimulus 固定の正常・境界・未知PathとMethodを逐次要求する。
 * @observation status、Allow、本文、容量Header、Security Headerを取得する。
 * @oracle 暗黙Route・OPTIONS応答・Express情報を追加せず、HEADは本文なし、撤去した候補操作は一般の未対応POSTとして拒否する。
 * @cleanup finallyで所有Serverをjoinし、終了後の接続拒否を確認する。
 * @boundary 実HTTPとExpress受付。外部AI・Docker・保存Effectは使用しない。
 */
test("Express受付は現行のPath・Method・HEAD・固定拒否を維持する", async () => {
  const handle = await startWorkbench({ workingDirectory: repositoryRoot });
  try {
    for (const [method, pathname, expectedStatus, expectedBody] of [
      ["GET", "/PROJECT", 404, "not_found\n"],
      ["GET", "/project/", 404, "not_found\n"],
      ["GET", "/%70roject", 404, "not_found\n"],
      ["GET", "/unknown", 404, "not_found\n"],
      ["GET", "/api/workbench/view", 404, ""],
      ["GET", "/api/workbench/view?route=%2Fproject", 404, ""],
      ["POST", "/unknown", 405, "method_not_allowed\n"],
      ["OPTIONS", "/", 405, "method_not_allowed\n"],
      ["PUT", "/", 405, "method_not_allowed\n"],
      ["POST", "/api/workspace/", 404, ""],
      ["POST", "/api/workspace", 404, ""],
      ["POST", "/api/projects/project.example", 405, "method_not_allowed\n"],
      ["POST", "/candidate/action", 405, "method_not_allowed\n"],
    ] as const) {
      const response = await fetch(`${handle.baseUrl}${pathname}`, {
        method,
        redirect: "manual",
      });
      assert.equal(response.status, expectedStatus, `${method} ${pathname}`);
      assert.equal(await response.text(), expectedBody);
      assert.equal(response.headers.get("x-powered-by"), null);
      assert.equal(response.headers.get("etag"), null);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      if (expectedStatus === 405)
        assert.equal(response.headers.get("allow"), "GET, HEAD");
    }
    const url = `${handle.baseUrl}/.well-known/crdd-workbench-health`;
    const get = await fetch(url);
    const body = await get.text();
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(get.status, 200);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
    assert.equal(
      head.headers.get("content-length"),
      String(Buffer.byteLength(body)),
    );
    assert.equal(
      head.headers.get("content-type"),
      get.headers.get("content-type"),
    );
    assert.equal(head.headers.get("x-powered-by"), null);
    const contextUrl = `${handle.baseUrl}/api/workbench/context`;
    const local = await fetch(contextUrl);
    assert.equal(local.status, 200);
    const jsonContext = await local.json();
    assert.deepEqual(Object.keys(jsonContext).sort(), [
      "contract",
      "mode",
      "repositoryId",
    ]);
    assert.equal(jsonContext.contract, "crdd/workbench/context/v1");
    assert.equal(jsonContext.mode, "single");
    assert.equal(typeof jsonContext.repositoryId, "string");
    const contextHead = await fetch(contextUrl, { method: "HEAD" });
    assert.equal(contextHead.status, 200);
    assert.equal(await contextHead.text(), "");
    assert.equal((await fetch(`${contextUrl}?route=%2Fproject`)).status, 400);
  } finally {
    await handle.close();
  }
  await assert.rejects(fetch(handle.healthUrl));
});

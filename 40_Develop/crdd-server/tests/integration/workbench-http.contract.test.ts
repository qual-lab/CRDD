/**
 * Workbench HTTPの受付と診断配信をServerの公開入口で確認する。
 * @packageDocumentation
 * @responsibility 旧構成拒否、固定Route、開発資料、Status・Header・Listener終了を確認する。
 * @trace ERB-IT-021
 * @level IT
 * @boundary loopback HTTPとServer公開入口。実AI・Dockerは使わない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "@qual-lab/crdd-version-control";
import { startWorkbench } from "../../src/app.ts";
import { requestRaw } from "../support/workbench-http.ts";
import { assertManagementResponse } from "../support/workbench-wire.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

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
    assert.deepEqual(doc.paths["/api/workspace"].post.security, []);
    assert.deepEqual(doc.paths["/api/repository"].post.security, []);
    assert.deepEqual(doc.paths["/api/records"].post.security, []);
    assert.deepEqual(doc.paths["/api/access"].get.security, [
      { bearerAuth: [] },
    ]);
    for (const pathname of [
      "/api/ai-request",
      "/api/ai-selection",
      "/api/execution/definition",
      "/api/execution/state",
      "/api/execution/objectives/run",
      "/api/execution/decisions/submit",
    ]) {
      const { get, post } = doc.paths[pathname];
      for (const parameter of get?.parameters ?? [])
        assert.notEqual(parameter.name, "repositoryId");
      if (post)
        assert.ok(
          !Object.hasOwn(
            post.requestBody.content["application/x-www-form-urlencoded"].schema
              .properties,
            "repositoryId",
          ),
        );
    }
    assert.deepEqual(Object.keys(doc.paths).sort(), [
      "/.well-known/crdd-workbench-health",
      "/api/access",
      "/api/access/connection",
      "/api/access/credentials",
      "/api/ai-request",
      "/api/ai-selection",
      "/api/execution/decisions/submit",
      "/api/execution/definition",
      "/api/execution/objectives/run",
      "/api/execution/state",
      "/api/records",
      "/api/repository",
      "/api/workbench/view",
      "/api/workspace",
    ]);
    for (const pathname of [
      "/api/access",
      "/api/ai-request",
      "/api/ai-selection",
    ])
      assert.deepEqual(Object.keys(doc.paths[pathname]).sort(), [
        "get",
        "post",
      ]);
    const viewResponse = doc.paths["/api/workbench/view"].get.responses["200"];
    for (const name of [
      "crdd/workbench/view/v1",
      "projectData",
      "executionActivity",
      "recordActionResult",
    ])
      assert.ok(viewResponse.description.includes(name), name);
    assert.deepEqual(Object.keys(doc.paths["/api/execution/state"]), ["get"]);
    assert.equal(
      doc.paths["/api/execution/state"].get.operationId,
      "getExecutionState",
    );
    for (const [pathname, operationId] of [
      ["/api/execution/objectives/run", "runObjective"],
      ["/api/execution/decisions/submit", "submitDecision"],
    ] as const) {
      const route = doc.paths[pathname];
      assert.deepEqual(Object.keys(route), ["post"]);
      assert.equal(route.post.operationId, operationId);
      const schema =
        route.post.requestBody.content["application/x-www-form-urlencoded"]
          .schema;
      assert.ok(!Object.hasOwn(schema.properties, "operation"));
      assert.equal(
        (await requestRaw(handle.baseUrl, pathname, "POST")).status,
        403,
      );
    }
    assert.equal(
      (await requestRaw(handle.baseUrl, "/api/execution/state", "GET")).status,
      400,
    );
    assert.equal(
      (await requestRaw(handle.baseUrl, "/api/execution", "POST")).status,
      405,
    );
    assert.equal(
      (await requestRaw(handle.baseUrl, "/api/runtime-definition", "POST"))
        .status,
      405,
    );
    for (const legacy of [
      "/workspace/action",
      "/ai-selection/action",
      "/api/execution-definition",
    ])
      assert.equal(
        (await requestRaw(handle.baseUrl, legacy, "POST")).status,
        405,
      );
    assert.ok(doc.paths["/api/execution/definition"].get);
    assert.ok(
      doc.paths["/api/execution/definition"].post.requestBody.content[
        "application/x-www-form-urlencoded"
      ],
    );
    const page = await requestRaw(handle.baseUrl, "/docs");
    assert.equal(page.status, 200);
    assert.match(page.body.toString("utf8"), /id="swagger-ui"/u);
    assert.match(
      String(page.headers["content-security-policy"]),
      /connect-src 'self'/u,
    );
    assert.equal(page.headers["cache-control"], "no-store");
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
 * @oracle 暗黙Route・OPTIONS応答・Express情報を追加せず、HEADは本文なし、旧Candidateは410のままとする。
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
      ["POST", "/unknown", 405, "method_not_allowed\n"],
      ["OPTIONS", "/", 405, "method_not_allowed\n"],
      ["PUT", "/", 405, "method_not_allowed\n"],
      ["POST", "/api/workspace/", 405, "method_not_allowed\n"],
      [
        "POST",
        "/candidate/action",
        410,
        "legacy_bundle_candidate_route_removed\n",
      ],
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
  } finally {
    await handle.close();
  }
  await assert.rejects(fetch(handle.healthUrl));
});

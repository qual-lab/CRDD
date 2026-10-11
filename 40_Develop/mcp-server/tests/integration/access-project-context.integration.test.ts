/**
 * AMの現在認可からProject Contextを実HTTPで搬送する。
 * @packageDocumentation
 * @responsibility 初回未完了・失効・空認可・本文不明と取消を非開示結果へ照合する。
 * @trace PPR-IT-002
 * @trace RFD-IT-013
 * @trace RFD-IT-019
 * @trace EST-IT-002
 * @trace EST-IT-014
 * @level IT
 * @scope MCP専用Resolver、AM、Domain固定本文、HTTP。
 * @boundary 自己生成Store／Repositoryから既存HTTP Transportまで。公開Launcherの完成ではない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { request as httpRequest } from "node:http";
import test, { type TestContext } from "node:test";
import {
  createInitialAdministrator,
  createInitialCredential,
  initializeAccessManagementState,
  registerRepository,
  updateExposure,
  type AccessManagementState,
} from "../../../access-management/src/index.ts";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  createAccessProjectContextMcpResolver,
  startMcpAuthenticatedStreamableHttp,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
} from "../../src/index.ts";

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
      delivery: "confirmed",
      receipt: "confirmed",
      normalConnection: "confirmed",
    };
    credential.delivery = "confirmed";
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
 * 固定Project Context ToolのJSON-RPC要求を作る。
 * @responsibility 実HTTPと直接Handlerで同じwire入力を使用する。
 * @trace PPR-IT-002
 * @precondition 固定二Toolだけを指定する。
 * @stimulus 閉じたEnvelopeとProtocol metadataを構築する。
 * @observation JSON-RPC結果へ同じidが戻る。
 * @oracle Token・RootはTool引数へ含めない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary MCP入力Schema。
 */
function packet(tool = MCP_PROJECT_CONTEXT_GET_TOOL as string) {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: tool,
      arguments:
        tool === MCP_PROJECT_CONTEXT_LIST_TOOL
          ? {}
          : { projectId: "project.fixture" },
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_ORCHESTRATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

/**
 * 認証済みHTTPでProject Context Toolを呼ぶ。
 * @responsibility 既存TransportのHeader・本文検査を迂回しない。
 * @trace PPR-IT-002
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
    body: JSON.stringify(packet(tool)),
  });
}

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
      await createAccessProjectContextMcpResolver(initial.root)(initial.token),
      null,
    );
    const handler = await createAccessProjectContextMcpResolver(f.root)(
      f.token,
    );
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
      [MCP_PROJECT_CONTEXT_GET_TOOL, MCP_PROJECT_CONTEXT_LIST_TOOL].sort(),
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
    resolver = createAccessProjectContextMcpResolver(f.root);
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
  const handler = await createAccessProjectContextMcpResolver(f.root)(f.token);
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
    resolver = createAccessProjectContextMcpResolver(f.root);
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
    for (const change of ["exposure", "revoked"] as const) {
      fs.writeFileSync(f.current, original);
      const headerReady = new Promise<void>((resolve) => {
        authenticated = resolve;
      });
      const body = JSON.stringify(packet(MCP_PROJECT_CONTEXT_LIST_TOOL));
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
              "mcp-name": MCP_PROJECT_CONTEXT_LIST_TOOL,
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
      if (change === "exposure")
        assert.deepEqual(result.result.structuredContent.projects, []);
      else
        assert.deepEqual(result.error, {
          code: -32603,
          message: "Project Context unavailable",
        });
      assert.equal(reads, 0);
    }
  } finally {
    authenticated = undefined;
    fs.openSync = open;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

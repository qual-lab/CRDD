/**
 * 初回限定discoverから確認保存と次要求の通常接続を検証する。
 * @packageDocumentation
 * @responsibility 完全要求前の確認0と保存後の非秘密応答を実HTTPへ接続する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @level IT
 * @scope MCP Resolver・限定Handler・既存Transport・AM実保存の局所接続。
 * @boundary loopback HTTPと自己生成Store。公開Launcher／Workbench／Host TTYは未接続。
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { request as httpRequest } from "node:http";
import test, { type TestContext } from "node:test";
import { createFilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import {
  initializeAccessManagementState,
  createInitialAdministrator,
  createInitialCredential,
  recordCredentialPresentation,
  type AccessManagementState,
} from "../../../access-management/src/index.ts";
import {
  createAccessMcpResolver,
  startMcpAuthenticatedStreamableHttp,
  MCP_ORCHESTRATOR_PROTOCOL_VERSION,
} from "../../src/index.ts";
import { handleMcpDiscoverRequest } from "../../src/request/discover.ts";

/**
 * 実Hostと分離した提示確認済み初回資格を作る。
 * @responsibility 本番保存Ownerを順に呼び、模擬鍵を短命メモリへ限定する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 検証済みRepository-localな.crdd/tests。
 * @stimulus 相関・User・資格・提示前後を保存する。
 * @observation 各保存completedと試験Rootのrealpathを確認する。
 * @oracle 生鍵非保存、Surfaceの実提示成功は主張しない。
 * @cleanup exact自己生成Rootをt.afterで削除し不存在を確認する。
 * @boundary AM内部保存→MCP用試験Root。
 */
function fixture(t: TestContext) {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  assert.ok(fs.statSync(path.join(repository, ".git")).isDirectory());
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const directory = fs.mkdtempSync(
    path.join(parent, "mcp-initial-connection-"),
  );
  t.after(() => {
    assert.equal(path.dirname(directory), parent);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const root = createFilesystemStoreRoot(directory);
  assert.ok(root);
  const attempt = crypto.randomUUID();
  assert.equal(
    initializeAccessManagementState(root, attempt, true, () => [
      "uninitialized",
      "absent",
    ]).status,
    "completed",
  );
  assert.equal(
    createInitialAdministrator(root, attempt, "模擬管理者").status,
    "completed",
  );
  const issued = createInitialCredential(root, attempt);
  assert.ok(issued.status === "completed" && issued.value.token);
  const start = recordCredentialPresentation(root, {
    credentialId: issued.value.credentialId,
    issuanceOperationId: attempt,
    expectedRevision: issued.value.revision,
    target: "unconfirmed",
  });
  assert.ok(start.status === "completed");
  assert.equal(
    recordCredentialPresentation(root, {
      credentialId: issued.value.credentialId,
      issuanceOperationId: attempt,
      expectedRevision: start.value.revision,
      presentationOperationId: start.value.presentationOperationId,
      target: "confirmed",
    }).status,
    "completed",
  );
  const current = path.join(directory, "access-management.json");
  const token = issued.value.token;
  return { root, directory, current, token };
}

/**
 * 完全な非秘密discover入力を作る。
 * @responsibility 通常と初回で同じProtocol Envelopeを使う。
 * @trace RFD-IT-024
 * @precondition N/A: 固定メモリ値だけ。
 * @stimulus 固定ID・method・二つの必須metaを構成する。
 * @observation 呼出し側が応答と保存差分を確認する。
 * @oracle MCP固定Protocol値と閉params。
 * @cleanup N/A: 外部資源なし。
 * @boundary Protocol入力。
 */
function packet() {
  return {
    jsonrpc: "2.0",
    id: 1,
    method: "server/discover",
    params: {
      _meta: {
        "io.modelcontextprotocol/protocolVersion":
          MCP_ORCHESTRATOR_PROTOCOL_VERSION,
        "io.modelcontextprotocol/clientCapabilities": {},
      },
    },
  };
}

/**
 * 現在の模擬鍵とProtocol相関をHTTP Headerへ渡す。
 * @responsibility Secretを本文へ混入させない。
 * @trace RFD-IT-024
 * @precondition 模擬短命鍵。
 * @stimulus 認証・Accept・Content-Type・method・versionを構成する。
 * @observation Transportの受理・拒否を呼出元が確認する。
 * @oracle 鍵はAuthorizationだけ。
 * @cleanup N/A: 要求内メモリだけ。
 * @boundary HTTP Header。
 */
function headers(token: string, method = "server/discover") {
  return {
    authorization: `Bearer ${token}`,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": MCP_ORCHESTRATOR_PROTOCOL_VERSION,
    "mcp-method": method,
  };
}

/**
 * 正規discoverだけが一回の確認保存後に固定応答を返す。
 * @responsibility 通常Tool依存0・保存順・次要求の通常一覧を確認する。
 * @trace RFD-IT-024
 * @precondition 初回資格・実loopback Listener・管理操作spy。
 * @stimulus 初回tools/list拒否、完全discover、次要求tools/listを送る。
 * @observation publication数・KDF数・current改訂・固定応答・管理spy。
 * @oracle 不正Toolは確認0、discover確認1・一出版、本人情報なし、次要求だけ通常Tool。
 * @cleanup Server.closeのcleanup成功後にfixtureを回収する。
 * @boundary 実HTTP→限定Handler→AM→固定応答。
 */
test("初回HTTPは完全discover一回だけ出版して次要求を通常へ移す", async (t) => {
  const f = fixture(t);
  let administrationCalls = 0;
  const resolver = createAccessMcpResolver(f.root, {
    snapshot: () => {
      administrationCalls++;
      throw new Error("not expected");
    },
    execute: () => {
      administrationCalls++;
      throw new Error("not expected");
    },
  });
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const base = `http://${server.host}:${server.port}/mcp`;
  const before = fs.readFileSync(f.current);
  const rename = fs.renameSync,
    scrypt = crypto.scryptSync;
  let publications = 0,
    kdfs = 0;
  fs.renameSync = (from, to) => {
    if (String(to) === f.current) publications++;
    rename(from, to);
  };
  crypto.scryptSync = (password, salt, length, options) => {
    kdfs++;
    return scrypt(password, salt, length, options);
  };
  try {
    const denied = await fetch(base, {
      method: "POST",
      headers: headers(f.token, "tools/list"),
      body: JSON.stringify({ ...packet(), method: "tools/list" }),
    });
    assert.equal(denied.status, 404);
    assert.equal((await denied.json()).error.code, -32601);
    assert.equal(kdfs, 1); // Header用途判定だけ。確認KDFは0。
    assert.equal(publications, 0);
    assert.deepEqual(fs.readFileSync(f.current), before);
    kdfs = 0;
    const response = await fetch(base, {
      method: "POST",
      headers: headers(f.token),
      body: JSON.stringify(packet()),
    });
    const value = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(value, handleMcpDiscoverRequest(packet()));
    assert.equal(kdfs, 2); // Header用途判定とfresh初回確認だけ。
    assert.equal(publications, 1);
    assert.equal(administrationCalls, 0);
    const state = JSON.parse(
      fs.readFileSync(f.current, "utf8"),
    ) as AccessManagementState;
    assert.equal(state.initialization.stage, "completed");
    assert.equal(
      state.revision,
      (JSON.parse(before.toString()) as AccessManagementState).revision + 1,
    );
    assert.equal(state.users.length, 1);
    assert.equal(state.credentials.length, 1);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
    for (const secret of [
      f.token,
      f.directory,
      state.users[0]?.userId,
      state.credentials[0]?.credentialId,
    ]) {
      assert.ok(secret);
      assert.equal(JSON.stringify(value).includes(secret), false);
    }
    const next = await fetch(base, {
      method: "POST",
      headers: headers(f.token, "tools/list"),
      body: JSON.stringify({ ...packet(), method: "tools/list" }),
    });
    const listed = await next.json();
    assert.ok(Array.isArray(listed.result.tools));
    // 本人一操作と通常管理十操作は独立先行中。Remote登録は判断待ちで含めない。
    assert.equal(listed.result.tools.length, 32);
    // 一覧Schemaの提示はCatalogの内容を読まない。
    assert.equal(administrationCalls, 0);
    assert.equal(publications, 1);
  } finally {
    fs.renameSync = rename;
    crypto.scryptSync = scrypt;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * Protocol・HTTP不正と取消を確認保存前で拒否する。
 * @responsibility Header認証観測と確認出版0を区別する。
 * @trace RFD-IT-024
 * @precondition 初回候補と実HTTP Listener。
 * @stimulus 不正ID/meta/params/method、曖昧JSON、Header差、超過、Origin等を送る。
 * @observation status・error、rename数とcurrent byte。直接HandlerのKDF0も確認する。
 * @oracle 全不正は確認出版0、通常Tool0。HTTP認証観測0とは主張しない。
 * @cleanup hook復元、Listener close、fixture不存在。
 * @boundary HTTP前段と限定Protocol検査。
 */
test("初回HTTPの不正要求は確認出版せず入力境界で拒否する", async (t) => {
  const f = fixture(t),
    resolver = createAccessMcpResolver(f.root);
  const handler = await resolver(f.token);
  assert.ok(handler);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const url = `http://${server.host}:${server.port}/mcp`;
  const before = fs.readFileSync(f.current),
    rename = fs.renameSync,
    scrypt = crypto.scryptSync;
  let publications = 0,
    confirmations = 0;
  fs.renameSync = (from, to) => {
    if (String(to) === f.current) publications++;
    rename(from, to);
  };
  crypto.scryptSync = (password, salt, length, options) => {
    confirmations++;
    return scrypt(password, salt, length, options);
  };
  try {
    for (const request of [
      null,
      { ...packet(), id: null },
      { ...packet(), extra: true },
      { ...packet(), params: { ...packet().params, extra: true } },
      { ...packet(), params: { _meta: {} } },
      { ...packet(), method: "keys/issue" },
      {
        ...packet(),
        method: "tools/call",
        params: {
          ...packet().params,
          name: "crdd.issue_credential",
          arguments: {},
        },
      },
      {
        ...packet(),
        method: "tools/call",
        params: {
          ...packet().params,
          name: "crdd.get_current_access",
          arguments: {},
        },
      },
    ]) {
      const result = await handler(request, new AbortController().signal);
      assert.ok(result.error);
    }
    const controller = new AbortController();
    controller.abort();
    assert.equal(
      (await handler(packet(), controller.signal)).error?.code,
      -32800,
    );
    assert.equal(confirmations, 0);
    const cases = [
      { body: JSON.stringify({ ...packet(), id: null }), override: {} },
      {
        body: JSON.stringify({ ...packet(), params: { _meta: {} } }),
        override: {},
      },
      {
        body: JSON.stringify({
          ...packet(),
          params: { ...packet().params, extra: true },
        }),
        override: {},
      },
      {
        body: JSON.stringify(packet()),
        override: { "mcp-method": "tools/list" },
      },
      {
        body: JSON.stringify(packet()),
        override: { "content-type": "text/plain" },
      },
      {
        body: JSON.stringify(packet()),
        override: { accept: "application/json" },
      },
      {
        body: JSON.stringify(packet()),
        override: { origin: "https://not-allowed.invalid" },
      },
      { body: '{"jsonrpc":"2.0","jsonrpc":"2.0"}', override: {} },
      { body: "x".repeat(128 * 1024 + 1), override: {} },
    ];
    for (const item of cases) {
      const response = await fetch(url, {
        method: "POST",
        headers: { ...headers(f.token), ...item.override },
        body: item.body,
      });
      assert.ok((await response.json()).error);
      assert.deepEqual(fs.readFileSync(f.current), before);
    }
    for (const [target, method] of [
      [`${url}/unknown`, "POST"],
      [url, "GET"],
    ] as const) {
      const response = await fetch(target, {
        method,
        headers: headers(f.token),
      });
      assert.ok((await response.json()).error);
    }
    assert.equal(publications, 0);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  } finally {
    fs.renameSync = rename;
    crypto.scryptSync = scrypt;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

/**
 * 本文待機中の失効・交換・別改訂をfresh確認で拒否する。
 * @responsibility Header時の候補を保存前の現在状態へ再結合する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition Resolver観測を待てる実HTTP要求と初回候補。
 * @stimulus Headerだけ送って候補成立を待ち、状態を変えてから本文を送る。
 * @observation 固定公開error、current byte・出版数。
 * @oracle 三条件は同じ非開示拒否で確認出版0。内部相関を応答へ透過しない。
 * @cleanup 要求完了、Listener close、fixture回収。
 * @boundary 実HTTP body保留とfresh AM確認。
 */
test("本文待機中の失効・交換・別改訂は同じ公開拒否へ閉じる", async (t) => {
  for (const change of ["revoked", "exchange", "revision"] as const) {
    const f = fixture(t),
      resolver = createAccessMcpResolver(f.root);
    let notify: () => void = () => {};
    const resolved = new Promise<void>((resolve) => {
      notify = resolve;
    });
    const server = await startMcpAuthenticatedStreamableHttp(
      (token) => {
        const handler = resolver(token);
        notify();
        return handler;
      },
      { port: 0 },
    );
    const body = JSON.stringify(packet());
    let request: ReturnType<typeof httpRequest> | undefined;
    const response = new Promise<string>((resolve, reject) => {
      request = httpRequest(
        {
          host: server.host,
          port: server.port,
          path: "/mcp",
          method: "POST",
          headers: {
            ...headers(f.token),
            "content-length": Buffer.byteLength(body),
          },
        },
        (incoming) => {
          let text = "";
          incoming.setEncoding("utf8");
          incoming.on("data", (data) => {
            text += data;
          });
          incoming.on("end", () => resolve(text));
          incoming.on("error", reject);
        },
      );
      request.on("error", reject);
      request.flushHeaders();
    });
    try {
      await resolved;
      const state = JSON.parse(
        fs.readFileSync(f.current, "utf8"),
      ) as AccessManagementState;
      const credential = state.credentials[0];
      assert.ok(credential);
      if (change === "revision") {
        state.revision++;
        state.operationId = crypto.randomUUID();
      } else {
        const operationId = crypto.randomUUID();
        state.unresolvedKeyExchanges = [
          {
            operationId,
            recoveryId: `access-management.key-exchange.${operationId}`,
            entry: "host",
            scope: "targeted",
            recipientUserId: credential.userId,
            oldCredentialIds: [credential.credentialId],
            stage: change === "revoked" ? "revoked" : "prepared",
          },
        ];
        credential.revoked = change === "revoked";
      }
      const before = Buffer.from(JSON.stringify(state));
      fs.writeFileSync(f.current, before);
      assert.ok(request);
      request.end(body);
      assert.deepEqual(JSON.parse(await response), {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32603, message: "Initial connection unavailable" },
      });
      assert.deepEqual(fs.readFileSync(f.current), before);
    } finally {
      assert.equal((await server.close()).cleanupConfirmed, true);
    }
  }
});

/**
 * 保存故障後の公開結果と次要求の再入場を観測する。
 * @responsibility 内部Failureを非開示にし、既知出版を再発行へ丸めない。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 既存材料なしの初回HTTP。
 * @stimulus 確認保存でrename・readback・pending・Lockの故障を注入する。
 * @observation 同じ公開error、current、次要求tools/list、材料不存在または保持。
 * @oracle 未出版は次要求401、出版済みはexact清掃後通常一覧、確認成功応答は0。
 * @cleanup hook復元、Server closeとfixture回収。
 * @boundary HTTP→実保存故障→次要求Resolver。
 */
test("初回HTTP保存故障は非開示で停止し次要求で出版事実を再観測する", async (t) => {
  for (const failure of ["rename", "readback", "pending", "lock"] as const) {
    const f = fixture(t);
    const server = await startMcpAuthenticatedStreamableHttp(
      createAccessMcpResolver(f.root),
      { port: 0 },
    );
    t.after(async () => {
      await server.close();
    });
    const url = `http://${server.host}:${server.port}/mcp`;
    const rename = fs.renameSync,
      open = fs.openSync,
      remove = fs.rmSync;
    let published = false;
    fs.renameSync = (from, to) => {
      if (failure === "rename" && String(to) === f.current)
        throw new Error("fixture rename");
      rename(from, to);
      if (String(to) === f.current) published = true;
    };
    fs.openSync = (target, flags, mode) => {
      if (
        failure === "readback" &&
        published &&
        String(target).endsWith("access-management.json")
      )
        throw new Error("fixture readback");
      return open(target, flags, mode);
    };
    fs.rmSync = (target, options) => {
      if (
        (failure === "pending" &&
          String(target).endsWith("access-management.pending.json")) ||
        (failure === "lock" &&
          published &&
          String(target).endsWith("access-management.lock"))
      )
        throw new Error("fixture cleanup");
      return remove(target, options);
    };
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: headers(f.token),
        body: JSON.stringify(packet()),
      });
      assert.deepEqual(await response.json(), {
        jsonrpc: "2.0",
        id: 1,
        error: { code: -32603, message: "Initial connection unavailable" },
      });
    } finally {
      fs.renameSync = rename;
      fs.openSync = open;
      fs.rmSync = remove;
    }
    try {
      const before = fs.readFileSync(f.current);
      const next = await fetch(url, {
        method: "POST",
        headers: headers(f.token, "tools/list"),
        body: JSON.stringify({ ...packet(), method: "tools/list" }),
      });
      assert.equal(next.status, failure === "rename" ? 401 : 200);
      const result = await next.json();
      if (failure === "rename") {
        assert.ok(result.error);
        assert.ok(
          fs.existsSync(
            path.join(f.directory, "access-management.pending.json"),
          ),
        );
      } else {
        assert.ok(Array.isArray(result.result.tools));
        assert.deepEqual(fs.readdirSync(f.directory), [
          "access-management.json",
        ]);
      }
      assert.deepEqual(fs.readFileSync(f.current), before);
    } finally {
      assert.equal((await server.close()).cleanupConfirmed, true);
    }
  }
});

/**
 * 初回候補の本文待機中の切断で確認を開始しない。
 * @responsibility Header認証後の切断を初回保存へ進めない。
 * @trace RFD-IT-024
 * @precondition 実HTTP要求とResolver観測、本文未送信。
 * @stimulus Header用途判定を待ってClient接続を切断する。
 * @observation 要求close・Server cleanup・current byteと材料不存在。
 * @oracle 初回確認出版0。認証の読取り0は主張しない。
 * @cleanup Client closeとServer closeをjoinしてfixtureを回収する。
 * @boundary 実HTTP保留・切断・取消。
 */
test("初回本文待機中の切断は確認保存を開始しない", async (t) => {
  const f = fixture(t),
    resolver = createAccessMcpResolver(f.root);
  let notify: () => void = () => {};
  const observed = new Promise<void>((resolve) => {
    notify = resolve;
  });
  const server = await startMcpAuthenticatedStreamableHttp(
    (token) => {
      const handler = resolver(token);
      notify();
      return handler;
    },
    { port: 0 },
  );
  const before = fs.readFileSync(f.current);
  const request = httpRequest({
    host: server.host,
    port: server.port,
    path: "/mcp",
    method: "POST",
    headers: {
      ...headers(f.token),
      "content-length": Buffer.byteLength(JSON.stringify(packet())),
    },
  });
  request.on("error", () => {});
  const closed = new Promise<void>((resolve) => request.once("close", resolve));
  request.flushHeaders();
  await observed;
  request.destroy();
  await closed;
  assert.equal((await server.close()).cleanupConfirmed, true);
  assert.deepEqual(fs.readFileSync(f.current), before);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
});

/**
 * 保存中の実Server停止は既知出版を保持し成功応答を送らない。
 * @responsibility 同期保存終了とTransport取消・joinを接続する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @precondition 初回HTTPと正式currentだけを対象にしたrename hook。
 * @stimulus completed出版直後にServer.closeで要求取消・切断を発行する。
 * @observation Client結果、Server cleanup、current完成、次Listenerの通常一覧。
 * @oracle 成功応答0、既知completed保持・一改訂、次要求だけ通常認証へ。
 * @cleanup hook復元と全Listener close、fixture回収。
 * @boundary 実保存→Server shutdown取消→Client切断→新要求。
 */
test("初回保存後のServer取消は成功応答を止め既知completedを保持する", async (t) => {
  const f = fixture(t),
    resolver = createAccessMcpResolver(f.root);
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const before = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const rename = fs.renameSync;
  const stopping: { value: ReturnType<typeof server.close> | null } = {
    value: null,
  };
  fs.renameSync = (from, to) => {
    rename(from, to);
    if (String(to) === f.current) stopping.value = server.close();
  };
  try {
    const result = await fetch(`http://${server.host}:${server.port}/mcp`, {
      method: "POST",
      headers: headers(f.token),
      body: JSON.stringify(packet()),
    }).then(
      async (response) => ({ delivered: true, body: await response.text() }),
      () => ({ delivered: false, body: "" }),
    );
    assert.equal(result.delivered, false);
    assert.ok(stopping.value);
    assert.equal((await stopping.value).cleanupConfirmed, true);
  } finally {
    fs.renameSync = rename;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
  const state = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  assert.equal(state.initialization.stage, "completed");
  assert.equal(state.revision, before.revision + 1);
  assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  const next = await startMcpAuthenticatedStreamableHttp(resolver, { port: 0 });
  try {
    const response = await fetch(`http://${next.host}:${next.port}/mcp`, {
      method: "POST",
      headers: headers(f.token, "tools/list"),
      body: JSON.stringify({ ...packet(), method: "tools/list" }),
    });
    assert.ok(Array.isArray((await response.json()).result.tools));
  } finally {
    assert.equal((await next.close()).cleanupConfirmed, true);
  }
});

/**
 * 同Bindingの二つの実HTTP要求を一出版へ収束させる。
 * @responsibility 両Headerで候補を確定してから同じ初回確認を競合させる。
 * @trace RFD-IT-024
 * @precondition 初回候補・二要求の本文待機と用途判定観測。
 * @stimulus 二Headerを先に送り、双方の候補成立後に本文を送る。
 * @observation 両固定応答、current改訂、正式出版rename数、材料不存在。
 * @oracle 一出版だけで双方再観測。資格/User各1、Tool/管理Effect0。
 * @cleanup 両要求をjoinしServer close後にfixtureを回収する。
 * @boundary 実HTTP二要求と同Lock確認。
 */
test("同Bindingの並行HTTPは一出版して同じdiscover成功を返す", async (t) => {
  const f = fixture(t),
    resolver = createAccessMcpResolver(f.root);
  let observations = 0,
    notify: () => void = () => {};
  const both = new Promise<void>((resolve) => {
    notify = resolve;
  });
  const server = await startMcpAuthenticatedStreamableHttp(
    (token) => {
      const handler = resolver(token);
      observations++;
      if (observations === 2) notify();
      return handler;
    },
    { port: 0 },
  );
  const body = JSON.stringify(packet());
  const requests: ReturnType<typeof httpRequest>[] = [];
  const responses = [0, 1].map(
    () =>
      new Promise<string>((resolve, reject) => {
        const request = httpRequest(
          {
            host: server.host,
            port: server.port,
            path: "/mcp",
            method: "POST",
            headers: {
              ...headers(f.token),
              "content-length": Buffer.byteLength(body),
            },
          },
          (response) => {
            let text = "";
            response.setEncoding("utf8");
            response.on("data", (data) => {
              text += data;
            });
            response.on("end", () => resolve(text));
            response.on("error", reject);
          },
        );
        request.on("error", reject);
        requests.push(request);
        request.flushHeaders();
      }),
  );
  const before = JSON.parse(
    fs.readFileSync(f.current, "utf8"),
  ) as AccessManagementState;
  const rename = fs.renameSync;
  let publications = 0;
  fs.renameSync = (from, to) => {
    if (String(to) === f.current) publications++;
    rename(from, to);
  };
  try {
    await both;
    for (const request of requests) request.end(body);
    const results = await Promise.allSettled(responses);
    for (const result of results) {
      assert.ok(result.status === "fulfilled");
      assert.deepEqual(
        JSON.parse(result.value),
        handleMcpDiscoverRequest(packet()),
      );
    }
    assert.equal(publications, 1);
    const state = JSON.parse(
      fs.readFileSync(f.current, "utf8"),
    ) as AccessManagementState;
    assert.equal(state.revision, before.revision + 1);
    assert.equal(state.users.length, 1);
    assert.equal(state.credentials.length, 1);
    assert.deepEqual(fs.readdirSync(f.directory), ["access-management.json"]);
  } finally {
    fs.renameSync = rename;
    assert.equal((await server.close()).cleanupConfirmed, true);
  }
});

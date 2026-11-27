/**
 * mcp:system:streamable-httpの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility mcp:system:streamable-httpが所有する検証責務を実行する。
 * @trace EST-ST-003
 * @level ST
 * @scope mcp、project、runtime、http、transport
 * @boundary EST-ST-003=System/E2E: 公開入口→同意Gate→Provider→結果帰還
 */
import assert from "node:assert/strict";
import { withCallerPlan } from "../../../execution-model/tests/fixtures/execution-plan.ts";
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { type FileHandle, open } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { createConnection } from "node:net";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { prepareHostInitializationRoot } from "../../../access-management/src/initialization/root.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "@qual-lab/crdd-version-control";

import {
  createMcpServerFactory,
  MCP_COORDINATOR_PROTOCOL_VERSION,
  createMcpHttpRequestHandler,
} from "../../src/transport/mcp-server.ts";
import { startMcpHttpFixture } from "../fixtures/sdk-request.ts";
import {
  type McpCoordinatorDependencies,
  readMcpServerConfiguration,
} from "../../src/transport/mcp-server.ts";
import {
  startMcpAuthenticatedStreamableHttp,
  closeMcpHttpOnProcessSignal,
} from "../support/mcp-http-listener.ts";

import { startCoordinatorHttpFixture } from "../fixtures/sdk-request.ts";

const TOKEN = "local-development-token-0123456789abcdef";
const revision = "a".repeat(40);
const META = Object.freeze({
  "io.modelcontextprotocol/protocolVersion": MCP_COORDINATOR_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": Object.freeze({}),
});

/**
 * 公式Clientが実HTTPで同じTool定義とOwnerへ到達することを検証する。
 * @responsibility SDKのHeader対応・discover・一覧・結果と非公開Tool拒否を照合する。
 * @trace EST-ST-003
 * @precondition 合成Portfolioと専用localhost Portだけを使用する。
 * @stimulus modern固定Clientで一覧・実行・旧名拒否を確認する。
 * @observation 読取り回数とSDKの型付き結果を確認する。
 * @oracle 正常一回、旧名では追加Owner呼出し0。
 * @cleanup ClientとServerを閉じて専用Socketを回収する。
 * @boundary 公式SDK Client→HTTP→Factory→合成Owner。
 */
test("公式SDK ClientはHTTPのdiscover・一覧・実行と旧名拒否を維持する", async () => {
  let reads = 0;
  const server = await startMcpHttpFixture(
    createMcpServerFactory({
      projectContext: {
        readPortfolio: async () => {
          reads += 1;
          return { projects: [], retainedAsSourceOfTruth: false };
        },
      },
    }),
    { port: 0, bearerToken: TOKEN },
  );
  const client = new Client(
    { name: "crdd-synthetic-test", version: "1" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } },
  );
  try {
    await client.connect(
      new StreamableHTTPClientTransport(
        new URL(`http://${server.host}:${server.port}${server.endpoint}`),
        { requestInit: { headers: { authorization: `Bearer ${TOKEN}` } } },
      ),
    );
    const listing = await client.listTools();
    assert.deepEqual(
      listing.tools.map((tool) => tool.name),
      ["crdd.list_projects", "crdd.get_project_context"],
    );
    const result = await client.callTool({
      name: "crdd.list_projects",
      arguments: {},
    });
    assert.notEqual(result.isError, true);
    assert.equal(reads, 1);
    await assert.rejects(
      client.callTool({ name: "crdd.get_runtime_activity", arguments: {} }),
    );
    assert.equal(reads, 1);
  } finally {
    await client.close();
    await server.close();
  }
});

/**
 * MCP専用設定を自己生成Repositoryだけから読む。
 * @responsibility 設定不存在、閉値、重複・余剰・容量・不正UTF8を区別する。
 * @trace EST-ST-003
 * @precondition 専用試験Directory内に新しいGit Rootを作る。実Hostは使用しない。
 * @stimulus 不存在、空設定、正規Origin、不正JSON、重複fieldと禁止Origin。最終File metadata取得後にdescriptorを閉じ、実config Directoryを置換する。
 * @observation 非秘密構成または固定拒否、試験Root終了後不存在。
 * @oracle 不正設定からlocalhost fallbackや補完値を生成しない。
 * @cleanup 検証済み親Directory内の自己生成Git Rootと設定だけを削除する。
 * @boundary Readerのみ。置換は終了境界への故障注入であり、実OS raceの再現ではない。CLI／実TLS終端は別検証。
 */
test("共有MCP設定Readerは当該Repositoryの閉設定だけを受理する", async (t) => {
  const root = resolveVerifiedRepositoryRootFromWorkingDirectory(
    import.meta.dirname,
  );
  const parent = path.join(root, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  const fixture = fs.mkdtempSync(path.join(parent, "mcp-config-"));
  assert.equal(path.dirname(fixture), parent);
  try {
    assert.equal(
      spawnSync("git", ["init", "--quiet", fixture], { windowsHide: true })
        .status,
      0,
    );
    assert.deepEqual(await readMcpServerConfiguration(fixture), {});
    const config = path.join(fixture, ".crdd", "config");
    fs.mkdirSync(config, { recursive: true });
    const file = path.join(config, "mcp-server.json");
    fs.writeFileSync(file, "{}");
    assert.deepEqual(await readMcpServerConfiguration(fixture), {});
    fs.writeFileSync(file, '{"publicOrigin":"https://mcp.example:443/"}');
    assert.deepEqual(await readMcpServerConfiguration(fixture), {
      publicOrigin: "https://mcp.example",
    });
    const probe = await open(file, "r");
    const prototype = Object.getPrototypeOf(probe);
    await probe.close();
    const originalStat = prototype.stat;
    const displaced = path.join(fixture, "displaced-config");
    let replacements = 0;
    let statistics = 0;
    const statMock = t.mock.method(
      prototype,
      "stat",
      async function (this: FileHandle, ...args: unknown[]) {
        const result = await Reflect.apply(originalStat, this, args);
        if (++statistics === 2) {
          // Windowsのopen中rename制約を避け、最終metadata取得後の置換を注入する。
          await this.close();
          fs.renameSync(config, displaced);
          fs.mkdirSync(config);
          fs.writeFileSync(path.join(config, "mcp-server.json"), "{}");
          replacements++;
        }
        return result;
      },
    );
    try {
      await assert.rejects(
        readMcpServerConfiguration(fixture),
        /mcp_server_configuration_invalid/u,
      );
      assert.equal(replacements, 1);
      assert.equal(statistics, 2);
    } finally {
      statMock.mock.restore();
      if (fs.existsSync(displaced)) {
        fs.rmSync(config, { recursive: true });
        fs.renameSync(displaced, config);
      }
    }
    assert.deepEqual(await readMcpServerConfiguration(fixture), {
      publicOrigin: "https://mcp.example",
    });
    for (const size of [16383, 16384, 16385, 65537]) {
      const body = '{"publicOrigin":"https://mcp.example"}';
      fs.writeFileSync(
        file,
        `${" ".repeat(size - Buffer.byteLength(body))}${body}`,
      );
      assert.deepEqual(await readMcpServerConfiguration(fixture), {
        publicOrigin: "https://mcp.example",
      });
    }
    const originalRead = prototype.read;
    const originalOpen = fs.promises.open;
    for (const fault of ["partial", "read", "eof", "close"]) {
      let closes = 0;
      const readMock = t.mock.method(
        prototype,
        "read",
        async function (
          this: FileHandle,
          buffer: Buffer,
          offset: number,
          length: number,
          position: number,
        ) {
          if (fault === "read") throw Error("injected_read");
          if (fault === "eof") return { bytesRead: 0, buffer };
          return Reflect.apply(originalRead, this, [
            buffer,
            offset,
            Math.min(length, 7),
            position,
          ]);
        },
      );
      const closeMock = t.mock.method(
        fs.promises,
        "open",
        async (...args: Parameters<typeof originalOpen>) => {
          const handle = await originalOpen(...args);
          const close = handle.close.bind(handle);
          handle.close = async () => {
            await close();
            closes++;
            if (fault === "close") throw Error("injected_close");
          };
          return handle;
        },
      );
      syncBuiltinESMExports();
      try {
        if (fault === "partial")
          assert.deepEqual(await readMcpServerConfiguration(fixture), {
            publicOrigin: "https://mcp.example",
          });
        else
          await assert.rejects(
            readMcpServerConfiguration(fixture),
            /mcp_server_configuration_invalid/u,
          );
        assert.equal(closes, 1, fault);
      } finally {
        readMock.mock.restore();
        closeMock.mock.restore();
        syncBuiltinESMExports();
      }
    }
    for (const invalid of [
      "null",
      "[]",
      '{"publicOrigin":null}',
      '{"publicOrigin":"https://mcp.example","extra":true}',
      '{"publicOrigin":"https://mcp.example","publicOrigin":"https://other.example"}',
      '{"publicOrigin":"https://mcp.example/path/.."}',
      '{"publicOrigin":"https://mcp.example?"}',
      " ".repeat(16385),
    ]) {
      fs.writeFileSync(file, invalid);
      await assert.rejects(
        readMcpServerConfiguration(fixture),
        /mcp_server_configuration_invalid/u,
      );
    }
    fs.writeFileSync(file, Buffer.from([0xff]));
    await assert.rejects(
      readMcpServerConfiguration(fixture),
      /mcp_server_configuration_invalid/u,
    );
    fs.rmSync(config, { recursive: true, force: true });
    const linked = path.join(fixture, "linked-config");
    fs.mkdirSync(linked);
    fs.writeFileSync(
      path.join(linked, "mcp-server.json"),
      '{"publicOrigin":"https://linked.example"}',
    );
    fs.symlinkSync(
      linked,
      config,
      process.platform === "win32" ? "junction" : "dir",
    );
    await assert.rejects(
      readMcpServerConfiguration(fixture),
      /mcp_server_configuration_invalid/u,
    );
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
    assert.equal(fs.existsSync(fixture), false);
  }
});

/**
 * MCPの共有公開構成をListener開始前に検査する。
 * @responsibility HTTPS Origin以外を受付構成へ昇格しない。
 * @trace EST-ST-003
 * @precondition 認証Resolverは呼出し回数だけを観測する自己生成関数。
 * @stimulus HTTP、userinfo、path、query、hash、空Origin。
 * @observation 固定構成拒否とResolver0。
 * @oracle 不正配置からListenerや認証を開始しない。
 * @cleanup N/A: すべて起動前拒否でFile生成なし。
 * @boundary 配置契約の局所検査。実TLS終端の証明ではない。
 */
test("共有MCPはHTTPS Origin以外の構成を拒否する", () => {
  let calls = 0;
  for (const publicOrigin of [
    "",
    "http://mcp.example",
    "https://u:p@mcp.example",
    "https://mcp.example/path",
    "https://mcp.example/?q=1",
    "https://mcp.example/#fragment",
    "https://mcp.example/path/..",
    "https://mcp.example?",
    "https://mcp.example#",
    "https://@mcp.example",
    " https://mcp.example ",
    "https://mcp.example\\path",
  ]) {
    assert.throws(
      () =>
        createMcpHttpRequestHandler(
          () => {
            calls++;
            return null;
          },
          { publicOrigin },
        ),
      { message: "mcp_http_configuration_invalid" },
    );
  }
  assert.equal(calls, 0);
});

/**
 * 同Host TLS終端案内の拒否を認証Resolverより前に確認する。
 * @responsibility Host・Forwarded・Originの欠測、重複、混在を実HTTPで反証する。
 * @trace EST-ST-003
 * @precondition loopback Listenerと自己生成Bearer Resolverだけを所有する。
 * @stimulus 正常配置Header、Originなし、偽装・重複Header、未知Bearer。
 * @observation HTTP状態、Resolver／Handler回数、close後の接続拒否。
 * @oracle 配置拒否時は認証0。TLS案内だけでBearer認証を省略しない。
 * @cleanup 所有Serverをcloseし、Listener終了後接続拒否を確認する。
 * @boundary TLS終端のHeader契約のみ。実証明書・Proxy配置・AM認可は別検証。
 */
test("共有MCPはTLS配置不一致を認証前に拒否する", async () => {
  let authenticationCalls = 0;
  let handlerCalls = 0;
  const server = await startMcpAuthenticatedStreamableHttp(
    (token) => {
      authenticationCalls++;
      return token === TOKEN
        ? async () => {
            handlerCalls++;
            return { jsonrpc: "2.0" as const, id: 1, result: { tools: [] } };
          }
        : null;
    },
    { port: 0, publicOrigin: "https://mcp.example" },
  );
  const url = new URL(`http://${server.host}:${server.port}${server.endpoint}`);
  const body = Buffer.from(
    JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: { _meta: META },
    }),
  );
  const valid: Record<string, string | string[]> = {
    ...headers("tools/list"),
    host: "mcp.example",
    "x-forwarded-proto": "https",
    "x-forwarded-host": "mcp.example",
  };
  try {
    for (const change of [
      { host: "127.0.0.1" },
      { "x-forwarded-proto": "http" },
      { "x-forwarded-proto": "https,http" },
      { "x-forwarded-host": "foreign.example" },
      { "x-forwarded-host": ["mcp.example", "mcp.example"] },
      { "x-forwarded-proto": ["https", "https"] },
      { origin: ["https://mcp.example", "https://mcp.example"] },
    ]) {
      assert.equal(await sendRaw(url, { ...valid, ...change }, body), 421);
      assert.equal(authenticationCalls, 0);
    }
    for (const missing of ["host", "x-forwarded-proto", "x-forwarded-host"]) {
      const candidate = { ...valid };
      delete candidate[missing];
      assert.equal(await sendRaw(url, candidate, body), 421);
      assert.equal(authenticationCalls, 0);
    }
    assert.equal(
      await sendRaw(url, { ...valid, origin: "https://foreign.example" }, body),
      403,
    );
    assert.equal(authenticationCalls, 0);
    assert.equal(await sendRaw(url, valid, body), 200);
    assert.equal(
      await sendRaw(url, { ...valid, origin: "https://mcp.example" }, body),
      200,
    );
    assert.equal(authenticationCalls, 2);
    assert.equal(handlerCalls, 2);
    assert.equal(
      await sendRaw(url, { ...valid, authorization: `Bearer ${TOKEN}x` }, body),
      401,
    );
    assert.equal(authenticationCalls, 3);
    assert.equal(handlerCalls, 2);
  } finally {
    assert.equal((await server.close()).cleanupConfirmed, true);
    await assert.rejects(fetch(url, { signal: AbortSignal.timeout(2000) }));
  }
});

/**
 * dependenciesのTest準備責務を実行する。
 *
 * @responsibility dependenciesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus dependenciesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
function dependencies(
  overrides: Partial<McpCoordinatorDependencies> = {},
): McpCoordinatorDependencies {
  return {
    authenticateClient: () => ({
      status: "verified",
      principalId: "principal-a",
    }),
    runObjective: async () => assert.fail("objective not expected"),
    getProjectState: async (request) => ({
      contract: "crdd-coordinator/state-query/v2",
      status: "completed",
      reason: "coordinator_state_absent",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "absent",
      projection: null,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "no_effect",
    }),
    ...overrides,
  };
}

/**
 * headersのTest準備責務を実行する。
 *
 * @responsibility headersがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus headersを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
function headers(method: string, name?: string) {
  return {
    authorization: `Bearer ${TOKEN}`,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": MCP_COORDINATOR_PROTOCOL_VERSION,
    "mcp-method": method,
    ...(name ? { "mcp-name": name } : {}),
  };
}

/**
 * sendRawのTest準備責務を実行する。
 *
 * @responsibility sendRawがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus sendRawを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
function sendRaw(
  url: URL,
  requestHeaders: Record<string, string | string[]>,
  body: Buffer,
) {
  return new Promise<number>((resolve, reject) => {
    const request = httpRequest(
      url,
      { method: "POST", headers: requestHeaders },
      (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode ?? 0));
      },
    );
    request.once("error", reject);
    request.end(body);
  });
}

/**
 * waitForListeningPortのTest準備責務を実行する。
 *
 * @responsibility waitForListeningPortがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace EST-ST-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus waitForListeningPortを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
function waitForListeningPort(
  child: ReturnType<typeof spawn>,
  deployment?: Readonly<{ origin: string; port: number }>,
) {
  return new Promise<number>((resolve, reject) => {
    let stdout = "";
    const stdoutStream = child.stdout;
    if (!stdoutStream) {
      reject(new Error("crdd_mcp_http_stdout_unavailable"));
      return;
    }
    const timeout = setTimeout(
      () => finish(new Error("crdd_mcp_http_start_timeout")),
      10000,
    );
    /**
     * 起動案内を有限の出力から読み取る。
     * @responsibility 実Listenerの案内と出力上限を照合する。
     * @trace EST-ST-003
     * @precondition 所有Childのstdoutを購読している。
     * @stimulus stdoutのBuffer受信。
     * @observation 固定案内のportまたは容量超過。
     * @oracle 案内未到達を起動成功にしない。
     * @cleanup 終了判定をfinishへ委譲する。
     * @boundary 所有CLIの起動出力。
     */
    const data = (chunk: Buffer) => {
      stdout += String(chunk);
      if (stdout.length > 65536)
        return finish(new Error("crdd_mcp_http_output_limit"));
      if (deployment && stdout.includes(`CRDD Server: ${deployment.origin}\n`))
        return finish(null, deployment.port);
      const match = stdout.match(/CRDD Server: http:\/\/127\.0\.0\.1:(\d+)/u);
      if (!match?.[1]) return;
      if (!deployment) finish(null, Number(match[1]));
    };
    /**
     * 案内前のChild終了を起動失敗にする。
     * @responsibility exitをListener成立と区別する。
     * @trace EST-ST-003
     * @precondition 起動案内の待機中である。
     * @stimulus 所有Childのexit通知。
     * @observation 固定起動失敗。
     * @oracle 起動前終了を成功に変換しない。
     * @cleanup finishが待機資源を解除する。
     * @boundary 所有Processの終了通知。
     */
    const exited = () =>
      finish(new Error("crdd_mcp_http_exited_before_listen"));
    /**
     * Childのerrorを固定起動失敗へ変換する。
     * @responsibility 生例外を公開せず待機を終了する。
     * @trace EST-ST-003
     * @precondition 所有Childのerrorを購読している。
     * @stimulus Process error通知。
     * @observation 固定失敗のPromise拒否。
     * @oracle errorを起動成功にしない。
     * @cleanup finishが自身のListenerとtimerを解除する。
     * @boundary 所有Processの起動失敗。
     */
    const failed = () => finish(new Error("crdd_mcp_http_process_failed"));
    /**
     * 起動観測の待機資源を解放して結果を返す。
     * @responsibility timerと自身のListenerを除去する。
     * @trace EST-ST-003
     * @precondition 所有Childとstderrが確定している。
     * @stimulus 案内到達または固定失敗。
     * @observation port解決またはPromise拒否。
     * @oracle 待機終了をChild終了の証明にしない。
     * @cleanup timer、data、exit、error購読を除去する。
     * @boundary 起動観測だけ。Child終了は別の所有者が確認する。
     */
    const finish = (error: Error | null, port?: number) => {
      clearTimeout(timeout);
      stdoutStream.off("data", data);
      child.off("exit", exited);
      child.off("error", failed);
      if (error) reject(error);
      else resolve(port as number);
    };
    stdoutStream.on("data", data);
    child.once("exit", exited);
    child.once("error", failed);
  });
}

/**
 * 単体の公開入口ではHTTP APIだけを起動する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 単体の実ProcessへHTTP API要求とMCP要求を送る。
 * @oracle HTTP APIは利用でき、MCPのHTTP入口は存在しない。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("単体の公開入口はHTTP APIを開始し、HTTPではMCPを公開しない", async () => {
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-server.ts", import.meta.url),
  );
  const hook =
    "data:text/javascript," +
    encodeURIComponent(
      `import {registerHooks} from 'node:module';registerHooks({resolve(s,c,n){if(s==='@qual-lab/crdd-coordinator'||s==='@qual-lab/crdd-executor'||s.includes('coordinator/')||s.includes('executor/'))throw Error('automation_unavailable');return n(s,c);}});`,
    );
  const child = spawn(
    process.execPath,
    ["--import", hook, entry, "--port", "0"],
    {
      cwd: path.dirname(entry),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  try {
    const port = await waitForListeningPort(child);
    const health = await fetch(
      `http://127.0.0.1:${port}/.well-known/crdd-workbench-health`,
    );
    assert.equal(health.status, 200);
    await health.text();
    const body = {
      jsonrpc: "2.0",
      id: "discover-http-process",
      method: "server/discover",
      params: { _meta: META },
    };
    const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
      method: "POST",
      headers: headers(body.method),
      body: JSON.stringify(body),
    });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
    assert.equal(response.headers.has("www-authenticate"), false);
    assert.equal(await response.text(), "method_not_allowed\n");
    for (const route of ["/mcp", "/.well-known/oauth-protected-resource/mcp"]) {
      const inactive = await fetch(`http://127.0.0.1:${port}${route}`);
      assert.equal(inactive.status, 404, route);
      assert.equal(inactive.headers.has("www-authenticate"), false, route);
      await inactive.arrayBuffer();
    }
  } finally {
    if (child.exitCode === null) child.kill();
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null) resolve();
      else child.once("exit", () => resolve());
    });
  }
});

/**
 * 公開CROS Launcherが不正modeと未設定Rootを開始前拒否する。
 * @responsibility 通常HTTP保護を維持し、CROSの暗黙初期化や資格fallbackを作らない。
 * @trace EST-ST-003
 * @precondition Repository内の未作成Rootを模擬Host領域として指定する。
 * @stimulus stdio・docs混在・引数不正・Root不在の実Processを起動する。
 * @observation Exit、固定案内、Listener案内なし、Root不存在を観測する。
 * @oracle 各拒否が非0、秘密非表示、Root作成0、Listener開始0。
 * @cleanup ProcessはspawnSyncでjoinし、Filesystem生成物なし。
 * @boundary 配布MCP起動入口とmode／Host設定の実Process境界。
 */
test("公開CROS入口は未設定Rootと不正TransportをEffect前拒否する", () => {
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-server.ts", import.meta.url),
  );
  const missing = path.resolve(
    import.meta.dirname,
    "../../../../.crdd/tests",
    `mcp-launch-missing-${randomUUID()}`,
  );
  assert.equal(fs.existsSync(missing), false);
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    CROS_TRUST_DOMAIN_ID: "launch-test",
    LOCALAPPDATA: missing,
    HOME: missing,
    XDG_STATE_HOME: missing,
  };
  const cases = [
    { args: ["--shared", "--mcp-stdio"], exit: 64 },
    { args: ["--shared", "--port", "0"], exit: 2 },
    { args: ["--shared", "--port", "-1"], exit: 64 },
    { args: ["--port", "0", "--shared", "--docs"], exit: 64 },
  ];
  for (const item of cases) {
    const result = spawnSync(process.execPath, [entry, ...item.args], {
      cwd: path.dirname(entry),
      env: environment,
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, item.exit);
    assert.equal(result.stderr.includes("is listening"), false);
    assert.equal(result.stderr.includes(TOKEN), false);
    assert.equal(fs.existsSync(missing), false);
  }
});

/**
 * 既存Host Rootでも未設定・破損・孤立材料を起動成功にしない。
 * @responsibility Root存在と管理状態成立を分離し、自動初期化・材料回収を行わない。
 * @trace EST-ST-003
 * @precondition 自己生成Host Rootに空状態または不正材料を用意する。
 * @stimulus 公開CROS HTTP Processを起動する。
 * @observation Exit2、Listener案内0、対象Directory一覧と各File byte。
 * @oracle 既存Rootのfresh／unknownで停止し、鍵発行・初期化0、材料不変。
 * @cleanup spawnSyncでProcessをjoinしてexact fixtureを回収する。
 * @boundary 配布Launcher→既存AM状態Readerの実Process境界。
 */
test("公開CROS入口は既存Rootの未設定と不正材料を変更せず拒否する", (t) => {
  const repository = resolveVerifiedRepositoryRootFromWorkingDirectory(
    path.resolve(import.meta.dirname, "../../../.."),
  );
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-server.ts", import.meta.url),
  );
  for (const mode of ["fresh", "corrupt", "pending", "replace"] as const) {
    const directory = fs.mkdtempSync(
      path.join(parent, "mcp-launch-invalid-state-"),
    );
    t.after(() => {
      assert.equal(path.dirname(directory), parent);
      assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
      fs.rmSync(directory, { recursive: true });
      assert.equal(fs.existsSync(directory), false);
    });
    const input =
      process.platform === "win32"
        ? {
            platform: "win32" as const,
            publisher: "qual-lab",
            application: "cros" as const,
            trustDomainId: "launch-test",
            localAppData: directory,
          }
        : {
            platform: "linux" as const,
            publisher: "qual-lab",
            application: "cros" as const,
            trustDomainId: "launch-test",
            homeDirectory: directory,
            xdgStateHome: directory,
          };
    const prepared = prepareHostInitializationRoot(input);
    assert.equal(prepared.status, "ready");
    if (prepared.status !== "ready") continue;
    const root = prepared.root.root;
    if (mode !== "fresh") {
      const name =
        mode === "corrupt"
          ? "access-management.json"
          : `access-management.${mode}.json`;
      fs.writeFileSync(path.join(root, name), "{synthetic-invalid-material");
    }
    const names = fs.readdirSync(root).sort();
    const bytes = names.map((name) => fs.readFileSync(path.join(root, name)));
    const environment: NodeJS.ProcessEnv = {
      ...process.env,
      CROS_TRUST_DOMAIN_ID: "launch-test",
      LOCALAPPDATA: directory,
      HOME: directory,
      XDG_STATE_HOME: directory,
      XDG_CONFIG_HOME: directory,
    };
    const result = spawnSync(
      process.execPath,
      [entry, "--shared", "--port", "0"],
      {
        cwd: path.dirname(entry),
        env: environment,
        encoding: "utf8",
        windowsHide: true,
        timeout: 10000,
      },
    );
    assert.equal(result.error, undefined);
    assert.equal(result.status, 2, mode);
    assert.equal(result.stderr.includes("is listening"), false);
    assert.deepEqual(fs.readdirSync(root).sort(), names);
    assert.deepEqual(
      names.map((name) => fs.readFileSync(path.join(root, name))),
      bytes,
    );
  }
});

/**
 * localhost HTTPは認証済み状態参照を同じ公開契約へ搬送するを検証する。
 *
 * @responsibility localhost HTTPは認証済み状態参照を同じ公開契約へ搬送するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus localhost HTTPは認証済み状態参照を同じ公開契約へ搬送するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("localhost HTTPは認証済み状態参照を同じ公開契約へ搬送する", async () => {
  const server = await startCoordinatorHttpFixture(dependencies(), {
    port: 0,
    bearerToken: TOKEN,
  });
  try {
    const body = {
      jsonrpc: "2.0",
      id: "state-a",
      method: "tools/call",
      params: {
        _meta: META,
        name: "crdd.get_execution_state",
        arguments: {
          requestId: "query-a",
          projectId: "project-a",
          repositoryRevision: revision,
        },
      },
    };
    const response = await fetch(
      `http://${server.host}:${server.port}${server.endpoint}`,
      {
        method: "POST",
        headers: headers(body.method, body.params.name),
        body: JSON.stringify(body),
      },
    );
    assert.equal(response.status, 200);
    const result = (await response.json()) as {
      result: {
        structuredContent: { observationState: string; effectState: string };
      };
    };
    assert.equal(result.result.structuredContent.observationState, "absent");
    assert.equal(result.result.structuredContent.effectState, "no_effect");
  } finally {
    assert.deepEqual(await server.close(), {
      status: "completed",
      cleanupConfirmed: true,
    });
  }
});

/**
 * HTTP終了は受信途中のbodyとidle socketを回収して冪等に完了するを検証する。
 *
 * @responsibility HTTP終了は受信途中のbodyとidle socketを回収して冪等に完了するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus HTTP終了は受信途中のbodyとidle socketを回収して冪等に完了するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("HTTP終了は受信途中のbodyとidle socketを回収して冪等に完了する", async () => {
  let semanticEffects = 0;
  const server = await startCoordinatorHttpFixture(
    dependencies({
      runObjective: async () => {
        semanticEffects += 1;
        return null;
      },
    }),
    { port: 0, bearerToken: TOKEN },
  );
  const socket = createConnection({ host: server.host, port: server.port });
  const socketClosed = new Promise<void>((resolve) =>
    socket.once("close", resolve),
  );
  await new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });
  socket.write(
    [
      "POST /mcp HTTP/1.1",
      `Host: ${server.host}:${server.port}`,
      `Authorization: Bearer ${TOKEN}`,
      "Accept: application/json, text/event-stream",
      "Content-Type: application/json",
      `MCP-Protocol-Version: ${MCP_COORDINATOR_PROTOCOL_VERSION}`,
      "MCP-Method: tools/call",
      "MCP-Name: crdd.start_objective",
      "Content-Length: 1000",
      "Connection: keep-alive",
      "",
      "{",
    ].join("\r\n"),
  );
  await new Promise((resolve) => setTimeout(resolve, 20));
  const first = server.close();
  const second = server.close();
  assert.equal(first, second);
  assert.deepEqual(
    await Promise.race([
      first,
      new Promise((_unusedResolve, reject) =>
        setTimeout(() => reject(new Error("http_close_timeout")), 1_000),
      ),
    ]),
    { status: "completed", cleanupConfirmed: true },
  );
  await socketClosed;
  assert.equal(socket.closed, true);
  assert.equal(semanticEffects, 0);
});

/**
 * HTTPは認証・Origin・mirror header不一致をApplication前で拒否するを検証する。
 *
 * @responsibility HTTPは認証・Origin・mirror header不一致をApplication前で拒否するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus HTTPは認証・Origin・mirror header不一致をApplication前で拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("HTTPは認証・Origin・mirror header不一致をApplication前で拒否する", async () => {
  let effects = 0;
  const server = await startCoordinatorHttpFixture(
    dependencies({
      getProjectState: async () => {
        effects += 1;
      },
    }),
    { port: 0, bearerToken: TOKEN },
  );
  const url = `http://${server.host}:${server.port}${server.endpoint}`;
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      _meta: META,
      name: "crdd.get_execution_state",
      arguments: {
        requestId: "query-a",
        projectId: "project-a",
        repositoryRevision: revision,
      },
    },
  };
  try {
    const unauthorized = await fetch(url, {
      method: "POST",
      headers: {
        ...headers(body.method, body.params.name),
        authorization: "Bearer invalid-invalid-invalid-invalid-invalid",
      },
      body: JSON.stringify(body),
    });
    assert.equal(unauthorized.status, 401);
    const origin = await fetch(url, {
      method: "POST",
      headers: {
        ...headers(body.method, body.params.name),
        origin: "https://example.invalid",
      },
      body: JSON.stringify(body),
    });
    assert.equal(origin.status, 403);
    const mismatch = await fetch(url, {
      method: "POST",
      headers: { ...headers(body.method, "crdd.start_objective") },
      body: JSON.stringify(body),
    });
    assert.equal(mismatch.status, 400);
    const get = await fetch(url, { method: "GET" });
    assert.equal(get.status, 405);
    assert.equal(effects, 0);
  } finally {
    await server.close();
  }
});

/**
 * HTTPは不正UTF-8・重複key・容量超過を意味処理前に拒否するを検証する。
 *
 * @responsibility HTTPは不正UTF-8・重複key・容量超過を意味処理前に拒否するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus HTTPは不正UTF-8・重複key・容量超過を意味処理前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("HTTPは不正UTF-8・重複key・容量超過を意味処理前に拒否する", async () => {
  let effects = 0;
  const server = await startCoordinatorHttpFixture(
    dependencies({
      getProjectState: async () => {
        effects += 1;
      },
    }),
    { port: 0, bearerToken: TOKEN },
  );
  const url = new URL(`http://${server.host}:${server.port}${server.endpoint}`);
  const requestHeaders = headers("tools/call", "crdd.get_execution_state");
  try {
    assert.equal(
      await sendRaw(url, requestHeaders, Buffer.from([0xc3, 0x28])),
      400,
    );
    const duplicate = Buffer.from(
      `{"jsonrpc":"2.0","id":1,"id":2,"method":"tools/call","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"${MCP_COORDINATOR_PROTOCOL_VERSION}","io.modelcontextprotocol/clientCapabilities":{}},"name":"crdd.get_execution_state","arguments":{}}}`,
      "utf8",
    );
    assert.equal(await sendRaw(url, requestHeaders, duplicate), 400);
    assert.equal(
      await sendRaw(url, requestHeaders, Buffer.alloc(128 * 1024 + 1, 0x20)),
      400,
    );
    assert.equal(effects, 0);
  } finally {
    await server.close();
  }
});

/**
 * HTTP response切断は進行中Objectiveへ取消を伝播して終了時にjoinするを検証する。
 *
 * @responsibility HTTP response切断は進行中Objectiveへ取消を伝播して終了時にjoinするの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus HTTP response切断は進行中Objectiveへ取消を伝播して終了時にjoinするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("HTTP response切断は進行中Objectiveへ取消を伝播して終了時にjoinする", async () => {
  let isCancellationObserved = false;
  let markStarted: (() => void) | null = null;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const server = await startCoordinatorHttpFixture(
    dependencies({
      runObjective: async (_request, signal) =>
        new Promise((resolve) => {
          markStarted?.();
          /**
           * cancelのTest準備責務を実行する。
           *
           * @responsibility cancelがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
           * @trace EST-ST-003
           * @precondition 呼出し元Test Caseが必要な入力を渡す。
           * @stimulus cancelを呼び出す。
           * @observation 返却値、生成fixtureまたは観測値を取得する。
           * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
           * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
           * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
           */
          const cancel = () => {
            isCancellationObserved = true;
            resolve({
              contract: "crdd-coordinator/objective-intake/v4",
              status: "cancelled",
              reason: "coordinator_transport_disconnected",
              requestId: "objective-a",
              projectId: "project-a",
              milestoneId: "milestone-a",
              queueId: null,
              projection: null,
              cleanupConfirmed: true,
              manualRecoveryRequired: false,
              processRestartRequired: false,
              recoveryIds: [],
              recoveryObligations: [],
              effectState: "settled",
            });
          };
          if (signal.aborted) cancel();
          else signal.addEventListener("abort", cancel, { once: true });
        }),
    }),
    { port: 0, bearerToken: TOKEN },
  );
  const controller = new AbortController();
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      _meta: META,
      name: "crdd.start_objective",
      arguments: withCallerPlan({
        requestId: "objective-a",
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: revision,
        objective: "Wait for disconnect.",
        acceptanceCriteria: ["Cancellation is observed."],
        allowedPaths: ["result.txt"],
        readPaths: ["README.md"],
        maximumConcurrency: 1,
        maximumReplans: 0,
        originLane: "interactive",
        adoptResult: false,
      }),
    },
  };
  const pending = fetch(
    `http://${server.host}:${server.port}${server.endpoint}`,
    {
      method: "POST",
      headers: headers(body.method, body.params.name),
      body: JSON.stringify(body),
      signal: controller.signal,
    },
  );
  await started;
  controller.abort();
  await assert.rejects(pending);
  await server.close();
  assert.equal(isCancellationObserved, true);
});

/**
 * 試験用ListenerのSignal処理は実行中Applicationの取消とjoin完了まで残るを検証する。
 *
 * @responsibility 試験用ListenerのSignal処理は実行中Applicationの取消とjoin完了まで残るの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 試験用ListenerのSignal処理は実行中Applicationの取消とjoin完了まで残るの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("試験用ListenerのSignal処理は実行中Applicationの取消とjoin完了まで残る", async () => {
  let markStarted: (() => void) | null = null;
  let markAborted: (() => void) | null = null;
  let releaseHandler: (() => void) | null = null;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const aborted = new Promise<void>((resolve) => {
    markAborted = resolve;
  });
  const server = await startCoordinatorHttpFixture(
    dependencies({
      runObjective: async (_request, signal) =>
        new Promise((resolve) => {
          markStarted?.();
          /**
           * cancelのTest準備責務を実行する。
           *
           * @responsibility cancelがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
           * @trace EST-ST-003
           * @precondition 呼出し元Test Caseが必要な入力を渡す。
           * @stimulus cancelを呼び出す。
           * @observation 返却値、生成fixtureまたは観測値を取得する。
           * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
           * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
           * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
           */
          const cancel = () => {
            markAborted?.();
            releaseHandler = () =>
              resolve({
                contract: "crdd-coordinator/objective-intake/v4",
                status: "cancelled",
                reason: "coordinator_transport_shutdown",
                requestId: "objective-signal",
                projectId: "project-a",
                milestoneId: "milestone-a",
                queueId: null,
                projection: null,
                cleanupConfirmed: true,
                manualRecoveryRequired: false,
                processRestartRequired: false,
                recoveryIds: [],
                recoveryObligations: [],
                effectState: "settled",
              });
          };
          if (signal.aborted) cancel();
          else signal.addEventListener("abort", cancel, { once: true });
        }),
    }),
    { port: 0, bearerToken: TOKEN },
  );
  const body = {
    jsonrpc: "2.0",
    id: "objective-signal",
    method: "tools/call",
    params: {
      _meta: META,
      name: "crdd.start_objective",
      arguments: withCallerPlan({
        requestId: "objective-signal",
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: revision,
        objective: "Wait for process shutdown.",
        acceptanceCriteria: ["Cancellation is joined."],
        allowedPaths: ["result.txt"],
        readPaths: ["README.md"],
        maximumConcurrency: 1,
        maximumReplans: 0,
        originLane: "interactive",
        adoptResult: false,
      }),
    },
  };
  const response = fetch(
    `http://${server.host}:${server.port}${server.endpoint}`,
    {
      method: "POST",
      headers: headers(body.method, body.params.name),
      body: JSON.stringify(body),
    },
  ).then(
    () => "completed" as const,
    () => "disconnected" as const,
  );
  await started;
  const signals = new EventEmitter();
  const closing = closeMcpHttpOnProcessSignal(server, signals);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  signals.emit("SIGTERM");
  await aborted;
  let isCloseSettled = false;
  closing.finally(() => {
    isCloseSettled = true;
  });
  signals.emit("SIGINT");
  signals.emit("SIGTERM");
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(isCloseSettled, false);
  assert.equal(signals.listenerCount("SIGINT"), 1);
  assert.equal(signals.listenerCount("SIGTERM"), 1);
  const release = releaseHandler as (() => void) | null;
  assert.ok(release);
  release();
  assert.deepEqual(await closing, {
    status: "completed",
    cleanupConfirmed: true,
  });
  assert.equal(await response, "disconnected");
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

/**
 * 試験用ListenerのSignal処理は終了失敗を成功へ変えずlistenerを解放するを検証する。
 *
 * @responsibility 試験用ListenerのSignal処理は終了失敗を成功へ変えずlistenerを解放するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 試験用ListenerのSignal処理は終了失敗を成功へ変えずlistenerを解放するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("試験用ListenerのSignal処理は終了失敗を成功へ変えずlistenerを解放する", async () => {
  const signals = new EventEmitter();
  const closing = closeMcpHttpOnProcessSignal(
    {
      close: async () => {
        throw new Error("cleanup_unconfirmed");
      },
    },
    signals,
  );
  signals.emit("SIGINT");
  await assert.rejects(closing, /cleanup_unconfirmed/u);
  assert.equal(signals.listenerCount("SIGINT"), 0);
  assert.equal(signals.listenerCount("SIGTERM"), 0);
});

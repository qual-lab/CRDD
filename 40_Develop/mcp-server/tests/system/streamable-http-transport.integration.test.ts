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
import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { type FileHandle, open } from "node:fs/promises";
import { type ClientRequest, request as httpRequest } from "node:http";
import {
  createServer as createHttpsServer,
  request as httpsRequest,
} from "node:https";
import { createConnection, createServer } from "node:net";
import path from "node:path";
import type { Duplex } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  issueCredential,
  prepareHostInitializationRoot,
  updateCredentialPresentationState,
  registerUser,
  revokeCredential,
} from "../../../access-management/src/index.ts";
import {
  createInitialAdministrator,
  createInitialCredential,
  initializeAccessManagementState,
} from "../../../access-management/src/initialization/execution.ts";
import { readAccessManagementState } from "../../../access-management/src/storage/store.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";

import {
  closeMcpHttpOnProcessSignal,
  createMcpServerFactory,
  startMcpStreamableHttp,
  MCP_ACCESS_MANAGEMENT_TOOLS,
  MCP_CURRENT_ACCESS_TOOL,
  MCP_COORDINATOR_PROTOCOL_VERSION,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
  MCP_EXECUTION_STATUS_TOOL,
  MCP_TOPIC_MEETING_TOOLS,
  type McpCoordinatorDependencies,
  readMcpServerConfiguration,
  startMcpAuthenticatedStreamableHttp,
  startMcpCoordinatorStreamableHttp,
} from "../../src/index.ts";

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
  const server = await startMcpStreamableHttp(
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
test("共有MCPはHTTPS Origin以外の構成を拒否する", async () => {
  const source = fs.readFileSync(
    new URL("../../src/transport/http.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /orchestrator_mcp_http_/u);
  assert.ok(source.includes('throw new Error("mcp_http_address_unavailable")'));
  assert.ok(source.includes('throw new Error("mcp_http_cleanup_unconfirmed")'));
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
    await assert.rejects(
      startMcpAuthenticatedStreamableHttp(
        () => {
          calls++;
          return null;
        },
        { port: 0, publicOrigin },
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
    submitDecision: async () => assert.fail("decision not expected"),
    getProjectState: async (request) => ({
      contract: "crdd-coordinator/orchestrator-state-query/v1",
      status: "completed",
      reason: "orchestrator_state_absent",
      requestId: request.requestId,
      projectId: request.projectId,
      repositoryRevision: request.repositoryRevision,
      observationState: "absent",
      intakeEpoch: "fixture-epoch",
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
    let stderr = "";
    const stderrStream = child.stderr;
    if (!stderrStream) {
      reject(new Error("crdd_mcp_http_stderr_unavailable"));
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
     * @precondition 所有Childのstderrを購読している。
     * @stimulus stderrのBuffer受信。
     * @observation 固定案内のportまたは容量超過。
     * @oracle 案内未到達を起動成功にしない。
     * @cleanup 終了判定をfinishへ委譲する。
     * @boundary 所有CLIの起動出力。
     */
    const data = (chunk: Buffer) => {
      stderr += String(chunk);
      if (stderr.length > 65536)
        return finish(new Error("crdd_mcp_http_output_limit"));
      if (
        deployment &&
        stderr.includes(`CRDD MCP is listening on ${deployment.origin}/mcp\n`)
      )
        return finish(null, deployment.port);
      const match = stderr.match(
        /CRDD MCP is listening on http:\/\/127\.0\.0\.1:(\d+)\/mcp/u,
      );
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
      stderrStream.off("data", data);
      child.off("exit", exited);
      child.off("error", failed);
      if (error) reject(error);
      else resolve(port as number);
    };
    stderrStream.on("data", data);
    child.once("exit", exited);
    child.once("error", failed);
  });
}

/**
 * 公開URLと内部観測先を分離するためport候補を得る。
 * @responsibility 短命loopback ListenerをcloseしてからCLIへ候補を渡す。
 * @trace EST-ST-003
 * @precondition 自己生成試験だけから呼ぶ。
 * @stimulus port0の待受とclose。
 * @observation 数値portとclose完了。
 * @oracle 後続CLIまで予約済みとは扱わず、競合時は起動失敗にする。
 * @cleanup 所有Listenerを返却前に終了する。
 * @boundary 試験準備だけ。
 */
async function availableMcpEntryPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  assert.ok(address && typeof address !== "string");
  return address.port;
}

/**
 * template toolsの公開入口はlocalhost HTTP discoveryへ到達するを検証する。
 *
 * @responsibility template toolsの公開入口はlocalhost HTTP discoveryへ到達するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus template toolsの公開入口はlocalhost HTTP discoveryへ到達するの対象操作を実行する。
 * @observation HTTP結果、discover metadataのServer識別名と終了後条件を観測する。
 * @oracle Server識別名はcrdd-mcp、要求IDとcomplete応答を保持する。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("template toolsの公開入口はlocalhost HTTP discoveryへ到達する", async () => {
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url),
  );
  const child = spawn(process.execPath, [entry, "--http", "--port", "0"], {
    cwd: path.dirname(entry),
    env: { ...process.env, CRDD_MCP_HTTP_BEARER_TOKEN: TOKEN },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  try {
    const port = await waitForListeningPort(child);
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
    assert.equal(response.status, 200);
    const result = (await response.json()) as {
      id: string;
      result: {
        resultType: string;
        _meta: { "io.modelcontextprotocol/serverInfo": { name: string } };
      };
    };
    assert.equal(result.id, "discover-http-process");
    assert.equal(result.result.resultType, "complete");
    assert.equal(
      result.result._meta["io.modelcontextprotocol/serverInfo"].name,
      "crdd-mcp",
    );
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
 * @stimulus stdio・固定Token混在・引数不正・Root不在の実Processを起動する。
 * @observation Exit、固定案内、Listener案内なし、Root不存在を観測する。
 * @oracle 各拒否が非0、秘密非表示、Root作成0、Listener開始0。
 * @cleanup ProcessはspawnSyncでjoinし、Filesystem生成物なし。
 * @boundary 配布MCP起動入口とmode／Host設定の実Process境界。
 */
test("公開CROS入口は未設定Rootと不正TransportをEffect前拒否する", () => {
  const entry = fileURLToPath(
    new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url),
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
  delete environment.CRDD_MCP_HTTP_BEARER_TOKEN;
  const cases = [
    { args: ["--cros", "--stdio"], token: undefined, exit: 64 },
    { args: ["--cros", "--http", "--port", "0"], token: TOKEN, exit: 64 },
    { args: ["--cros", "--http", "--port", "0"], token: undefined, exit: 2 },
    { args: ["--cros", "--http", "--port", "-1"], token: undefined, exit: 64 },
    { args: ["--http", "--port", "0", "--cros"], token: undefined, exit: 64 },
  ];
  for (const item of cases) {
    const result = spawnSync(process.execPath, [entry, ...item.args], {
      cwd: path.dirname(entry),
      env: {
        ...environment,
        ...(item.token === undefined
          ? {}
          : { CRDD_MCP_HTTP_BEARER_TOKEN: item.token }),
      },
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
    new URL("../../../../template/tools/crdd-mcp-server.ts", import.meta.url),
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
    delete environment.CRDD_MCP_HTTP_BEARER_TOKEN;
    const result = spawnSync(
      process.execPath,
      [entry, "--cros", "--http", "--port", "0"],
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
 * 所有MCP CLIだけへ転送する試験TLS終端を構成する。
 * @responsibility 明示CAによる実TLSとForwarded上書きを検証し、製品Gatewayを追加しない。
 * @trace EST-ST-003
 * @precondition 公開された試験専用証明書と自己生成loopback Backendを使用する。
 * @stimulus localhost HTTPS要求を所有MCP CLIへ転送する。
 * @observation TLS応答、所有Upstream・Socketの終了とfresh接続拒否。
 * @oracle Client由来Forwarded値を透過せず、終了開始後の転送を生成しない。
 * @cleanup 受付停止を先に発行し、Upstream・SocketとListenerの終了をjoinする。
 * @boundary 試験専用。運用Proxy・OS証明書Store・外部Hostは変更しない。
 */
async function createMcpEntryTlsProxy(backendPort: number) {
  const cert = fs.readFileSync(
    path.join(import.meta.dirname, "../fixtures/tls-test-certificate.pem"),
  );
  const key = fs.readFileSync(
    path.join(import.meta.dirname, "../fixtures/tls-test-key.pem"),
  );
  const sockets = new Set<Duplex>();
  const upstreams = new Set<ClientRequest>();
  const settlements = new Set<Promise<void>>();
  let origin = "";
  let closing = false;
  let closeOperation: Promise<void> | undefined;
  const server = createHttpsServer({ key, cert }, (incoming, response) => {
    if (closing) {
      incoming.destroy();
      response.destroy();
      return;
    }
    const forwarded = { ...incoming.headers };
    delete forwarded.forwarded;
    delete forwarded["x-forwarded-proto"];
    delete forwarded["x-forwarded-host"];
    forwarded["x-forwarded-proto"] = "https";
    forwarded["x-forwarded-host"] = new URL(origin).host;
    const upstream = httpRequest(
      {
        hostname: "127.0.0.1",
        port: backendPort,
        path: incoming.url,
        method: incoming.method,
        headers: forwarded,
      },
      (result) => {
        response.writeHead(result.statusCode ?? 500, result.headers);
        result.on("error", () => response.destroy());
        result.pipe(response);
      },
    );
    upstreams.add(upstream);
    const joined = new Promise<void>((resolve) =>
      upstream.once("close", () => {
        upstreams.delete(upstream);
        resolve();
      }),
    );
    settlements.add(joined);
    void joined.then(() => settlements.delete(joined));
    upstream.on("error", () => response.destroy());
    incoming.on("aborted", () => upstream.destroy());
    response.on("close", () => {
      if (!response.writableFinished) upstream.destroy();
    });
    incoming.pipe(upstream);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  origin = `https://localhost:${address.port}`;
  return {
    origin,
    ca: cert,
    close: () => {
      if (closeOperation) return closeOperation;
      closing = true;
      const listenerClosed = new Promise<Error | undefined>((resolve) =>
        server.close((error) => resolve(error)),
      );
      closeOperation = (async () => {
        const pending = [...settlements];
        for (const upstream of upstreams) upstream.destroy();
        for (const socket of sockets) socket.destroy();
        await Promise.all(pending);
        const closeError = await listenerClosed;
        if (closeError) throw closeError;
        assert.equal(upstreams.size, 0);
        assert.equal(sockets.size, 0);
        assert.equal(settlements.size, 0);
        await assert.rejects(
          new Promise<void>((resolve, reject) => {
            const request = httpsRequest(
              origin,
              { ca: cert, agent: false, signal: AbortSignal.timeout(2000) },
              (response) => {
                response.resume();
                resolve();
              },
            );
            request.on("error", reject);
            request.end();
          }),
          (error) => (error as NodeJS.ErrnoException).code === "ECONNREFUSED",
        );
      })();
      return closeOperation;
    },
  };
}

for (const mode of [
  "localhost",
  "public",
  "tls",
  "before_spawn_failure",
  "after_spawn_failure",
] as const) {
  /**
   * 公開CROS Processの初回接続と現在資格判定を確認する。
   * @responsibility 内部Resolver試験だけでなく、配布入口からAM保存へ接続する。
   * @trace EST-ST-003
   * @precondition 検証済みRepository内の自己生成Host Rootと模擬初回資格。
   * @stimulus localhost／公開Origin／実TLS設定の実CLIへ、初回Tool拒否、discover、通常本人取得、managerで旧四Tool拒否、失効後同鍵再要求、合成SIGTERMを送る。
   * @observation 公開案内と内部loopbackの分離、各HTTP結果、保存段階、鍵Tool不存在、終了Processと残存Root。
   * @oracle 初回完了前の通常Tool0、次要求の現在本人、失効後401、秘密非表示。
   * @cleanup 子Processをjoinしてからexact fixtureを削除し不存在を確認する。
   * @boundary 公開MCP Launcher→自己生成TLS終端またはHTTP→AM保存。実運用Proxy／OS Signal搬送は未検証。実HostやProviderは使わない。
   */
  test(
    mode === "before_spawn_failure" || mode === "after_spawn_failure"
      ? `公開CROS Process ${mode}の試験準備失敗を回収する`
      : `公開CROS Process ${mode}設定は初回限定接続後に本人を返し失効を再評価する`,
    async (t) => {
      const repository = resolveVerifiedRepositoryRootFromWorkingDirectory(
        path.resolve(import.meta.dirname, "../../../.."),
      );
      const parent = path.join(repository, ".crdd", "tests");
      fs.mkdirSync(parent, { recursive: true });
      assert.equal(fs.realpathSync.native(parent), parent);
      const directory = fs.mkdtempSync(path.join(parent, "mcp-launch-access-"));
      let processSettled = true;
      let listenerReady = false;
      let child: ReturnType<typeof spawn> | undefined;
      let termination:
        | Promise<{ code: number | null; signal: NodeJS.Signals | null }>
        | undefined;
      let selectedPort = 0;
      let tls: Awaited<ReturnType<typeof createMcpEntryTlsProxy>> | undefined;
      let output = "";
      const secrets: string[] = [];
      t.after(() => {
        assert.equal(processSettled, true, "owned_mcp_process_not_settled");
        assert.equal(path.dirname(directory), parent);
        assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
        fs.rmSync(directory, { recursive: true });
        assert.equal(fs.existsSync(directory), false);
      });
      /**
       * 当該modeの準備から終了までを一つの試験経路として実行する。
       * @responsibility Child未生成と生成済みを同じfinallyで分離し、異常でもjoinを確認する。
       * @trace EST-ST-003
       * @precondition 自己生成Directoryと清掃hookだけを登録済み。
       * @stimulus 正常接続、spawn前準備失敗、spawn後URL待機前失敗。
       * @observation 正常結果または固定注入例外、所有Process終了。
       * @oracle 注入失敗を製品成功と扱わず、Process終了未確認では清掃しない。
       * @cleanup Child生成後だけ所有terminationを待つ。
       * @boundary 試験Driverの異常経路だけ。
       */
      const run = async () => {
        try {
          const startup = path.join(directory, "startup");
          if (mode === "before_spawn_failure")
            throw new Error("fixture_before_spawn_failure");
          fs.mkdirSync(startup);
          assert.equal(
            spawnSync("git", ["init", "--quiet", startup], {
              windowsHide: true,
            }).status,
            0,
          );
          selectedPort = await availableMcpEntryPort();
          if (mode === "tls") tls = await createMcpEntryTlsProxy(selectedPort);
          const publicOrigin =
            mode === "public" ? "https://mcp.example" : tls?.origin;
          if (publicOrigin) {
            const config = path.join(startup, ".crdd", "config");
            fs.mkdirSync(config, { recursive: true });
            fs.writeFileSync(
              path.join(config, "mcp-server.json"),
              JSON.stringify({ publicOrigin }),
            );
          }
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
          if (prepared.status !== "ready") return;
          const root = prepared.root;
          const attempt = randomUUID();
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
          const token = issued.value.token;
          const pending = updateCredentialPresentationState(root, {
            credentialId: issued.value.credentialId,
            issuanceOperationId: attempt,
            expectedRevision: issued.value.revision,
            target: "unconfirmed",
          });
          assert.ok(pending.status === "completed");
          assert.equal(
            updateCredentialPresentationState(root, {
              credentialId: issued.value.credentialId,
              issuanceOperationId: attempt,
              expectedRevision: pending.value.revision,
              presentationOperationId: pending.value.presentationOperationId,
              target: "confirmed",
            }).status,
            "completed",
          );
          const entry = fileURLToPath(
            new URL(
              "../../../../template/tools/crdd-mcp-server.ts",
              import.meta.url,
            ),
          );
          const environment: NodeJS.ProcessEnv = {
            ...process.env,
            CROS_TRUST_DOMAIN_ID: "launch-test",
            LOCALAPPDATA: directory,
            HOME: directory,
            XDG_STATE_HOME: directory,
            XDG_CONFIG_HOME: directory,
          };
          delete environment.CRDD_MCP_HTTP_BEARER_TOKEN;
          child = spawn(
            process.execPath,
            [
              "--eval",
              "const {pathToFileURL}=require('node:url');process.once('message',()=>{process.emit('SIGTERM');process.disconnect();});void import(pathToFileURL(process.argv[1]).href);",
              entry,
              "--cros",
              "--http",
              "--port",
              String(selectedPort),
            ],
            {
              cwd: startup,
              env: environment,
              stdio: ["ignore", "pipe", "pipe", "ipc"],
              windowsHide: true,
            },
          );
          processSettled = false;
          const ownedChild = child;
          termination = new Promise<{
            code: number | null;
            signal: NodeJS.Signals | null;
          }>((resolve) => {
            /**
             * 所有Childの終了値を待機者へ返す。
             * @responsibility 終了通知と起動失敗を区別する。
             * @trace EST-ST-003
             * @precondition 直接所有するChildである。
             * @stimulus exitのcodeとsignal。
             * @observation 終了値の解決。
             * @oracle 通知前に終了済みと判断しない。
             * @cleanup 自身のerror購読を除去する。
             * @boundary 試験が所有するCLI Process。
             */
            const exited = (
              code: number | null,
              signal: NodeJS.Signals | null,
            ) => {
              ownedChild.off("error", failed);
              resolve({ code, signal });
            };
            /**
             * Process未生成の起動失敗だけを終了扱いにする。
             * @responsibility pidなしと生成後errorを分離する。
             * @trace EST-ST-003
             * @precondition 所有Childの終了を待機している。
             * @stimulus error通知。
             * @observation pidなしの場合だけnull終了値。
             * @oracle pidありのerrorからProcess不存在を推定しない。
             * @cleanup 未生成なら自身のexit購読を除去する。
             * @boundary 試験Processの生成と終了。
             */
            const failed = () => {
              if (ownedChild.pid === undefined) {
                ownedChild.off("exit", exited);
                resolve({ code: null, signal: null });
              }
            };
            ownedChild.once("exit", exited);
            ownedChild.on("error", failed);
          });
          if (mode === "after_spawn_failure")
            throw new Error("fixture_after_spawn_failure");
          secrets.push(token);
          JSON.stringify(
            JSON.parse(
              fs.readFileSync(
                path.join(root.root, "access-management.json"),
                "utf8",
              ),
            ),
            (key, value) => {
              if (
                /salt|verifier/u.test(key) &&
                typeof value === "string" &&
                value.length > 8
              )
                secrets.push(value);
              return value;
            },
          );
          child.stdout?.on("data", (chunk) => {
            output += String(chunk);
          });
          child.stderr?.on("data", (chunk) => {
            output += String(chunk);
          });
          const port = await waitForListeningPort(
            child,
            publicOrigin
              ? { origin: publicOrigin, port: selectedPort }
              : undefined,
          );
          listenerReady = true;
          if (tls) {
            const ownedTls = tls;
            await assert.rejects(
              new Promise<void>((resolve, reject) => {
                const request = httpsRequest(
                  ownedTls.origin,
                  {
                    ca: Buffer.alloc(0),
                    agent: false,
                    signal: AbortSignal.timeout(2000),
                  },
                  (response) => {
                    response.resume();
                    resolve();
                  },
                );
                request.on("error", reject);
                request.end();
              }),
              (error) =>
                [
                  "DEPTH_ZERO_SELF_SIGNED_CERT",
                  "SELF_SIGNED_CERT_IN_CHAIN",
                ].includes((error as NodeJS.ErrnoException).code ?? ""),
            );
          }
          const call = async (
            method: string,
            params: Record<string, unknown>,
            credential = token,
          ) => {
            const name =
              typeof params.name === "string" ? params.name : undefined;
            const requestHeaders = {
              ...headers(method, name),
              ...(mode === "public"
                ? {
                    host: "mcp.example",
                    "x-forwarded-proto": "https",
                    "x-forwarded-host": "mcp.example",
                  }
                : tls
                  ? {
                      forwarded: "host=foreign.example;proto=http",
                      "x-forwarded-proto": "http",
                      "x-forwarded-host": "foreign.example",
                    }
                  : {}),
              authorization: `Bearer ${credential}`,
            };
            const payload = JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method,
              params: { ...params, _meta: META },
            });
            const response = await new Promise<{
              status: number;
              body: string;
              headers: Record<string, unknown>;
            }>((resolve, reject) => {
              const request = (tls ? httpsRequest : httpRequest)(
                tls ? `${tls.origin}/mcp` : `http://127.0.0.1:${port}/mcp`,
                {
                  method: "POST",
                  headers: requestHeaders,
                  signal: AbortSignal.timeout(10000),
                  agent: false,
                  ...(tls ? { ca: tls.ca } : {}),
                },
                (response) => {
                  const chunks: Buffer[] = [];
                  let size = 0;
                  response.on("data", (chunk: Buffer) => {
                    size += chunk.length;
                    if (size > 1024 * 1024)
                      request.destroy(new Error("fixture_response_limit"));
                    else chunks.push(chunk);
                  });
                  response.on("error", reject);
                  response.on("aborted", () =>
                    reject(new Error("fixture_response_aborted")),
                  );
                  response.on("end", () =>
                    resolve({
                      status: response.statusCode ?? 500,
                      body: Buffer.concat(chunks).toString("utf8"),
                      headers: response.headers,
                    }),
                  );
                },
              );
              request.on("error", reject);
              request.end(payload);
            });
            const body = JSON.parse(response.body);
            const serialized = JSON.stringify({
              body,
              headers: response.headers,
            });
            for (const secret of secrets)
              assert.equal(serialized.includes(secret), false);
            return { status: response.status, body };
          };
          assert.equal((await call("tools/list", {})).status, 404);
          assert.equal((await call("server/discover", {})).status, 200);
          const observed = readAccessManagementState(root);
          assert.ok(observed.status === "completed");
          assert.equal(observed.value.initialization.stage, "completed");
          const listed = await call("tools/list", {});
          assert.equal(listed.status, 200);
          assert.ok(
            listed.body.result.tools.some(
              (tool: { name: string }) => tool.name === MCP_CURRENT_ACCESS_TOOL,
            ),
          );
          assert.deepEqual(
            listed.body.result.tools
              .map((tool: { name: string }) => tool.name)
              .sort(),
            [
              MCP_CURRENT_ACCESS_TOOL,
              ...Object.values(MCP_ACCESS_MANAGEMENT_TOOLS),
              ...MCP_TOPIC_MEETING_TOOLS,
              MCP_PROJECT_CONTEXT_LIST_TOOL,
              MCP_PROJECT_CONTEXT_GET_TOOL,
              MCP_EXECUTION_STATUS_TOOL,
              "crdd.get_workspace",
              "crdd.manage_workspace",
            ].sort(),
          );
          const current = await call("tools/call", {
            name: MCP_CURRENT_ACCESS_TOOL,
            arguments: {},
          });
          assert.equal(current.status, 200);
          assert.equal(
            current.body.result.structuredContent.user.role,
            "administrator",
          );
          const user = observed.value.users[0];
          assert.ok(user);
          assert.equal(
            registerUser(
              root,
              token,
              observed.value.revision,
              randomUUID(),
              "模擬manager",
              "manager",
            ).status,
            "completed",
          );
          const managerState = readAccessManagementState(root);
          assert.ok(managerState.status === "completed");
          const manager = managerState.value.users.find(
            (entry) => entry.username === "模擬manager",
          );
          assert.ok(manager);
          const managerCredential = issueCredential(
            root,
            token,
            managerState.value.revision,
            randomUUID(),
            manager.userId,
          );
          assert.ok(
            managerCredential.status === "completed" &&
              managerCredential.operation === "issueCredential",
          );
          secrets.push(managerCredential.token);
          for (const name of [
            "crdd.list_ai_profiles",
            "crdd.create_ai_profile",
            "crdd.update_ai_profile",
            "crdd.delete_ai_profile",
          ]) {
            const retired = await call(
              "tools/call",
              { name, arguments: {} },
              managerCredential.token,
            );
            assert.equal(retired.status, 200);
            assert.equal(retired.body.error.code, -32601);
          }
          const afterProfile = readAccessManagementState(root);
          assert.ok(afterProfile.status === "completed");
          assert.equal(afterProfile.value.revision, managerCredential.revision);
          assert.equal(
            revokeCredential(
              root,
              token,
              afterProfile.value.revision,
              randomUUID(),
              user.userId,
              issued.value.credentialId,
            ).status,
            "completed",
          );
          assert.equal((await call("tools/list", {})).status, 401);
        } finally {
          try {
            if (child && termination) {
              const ownedChild = child;
              if (!listenerReady) ownedChild.kill();
              else if (ownedChild.connected)
                ownedChild.send("synthetic_sigterm", () => {});
              let timer: ReturnType<typeof setTimeout> | undefined;
              try {
                const terminal = await Promise.race([
                  termination,
                  new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                      ownedChild.kill();
                      reject(new Error("owned_mcp_shutdown_unconfirmed"));
                    }, 10000);
                  }),
                ]);
                processSettled =
                  ownedChild.pid === undefined ||
                  ownedChild.exitCode !== null ||
                  ownedChild.signalCode !== null;
                assert.equal(processSettled, true);
                if (!listenerReady)
                  assert.ok(terminal.code !== null || terminal.signal !== null);
                else assert.deepEqual(terminal, { code: 0, signal: null });
                await assert.rejects(
                  fetch(`http://127.0.0.1:${selectedPort}/mcp`, {
                    signal: AbortSignal.timeout(2000),
                  }),
                );
              } finally {
                clearTimeout(timer);
              }
            }
            for (const secret of secrets)
              assert.equal(output.includes(secret), false);
          } finally {
            await tls?.close();
          }
        }
      };
      if (mode === "before_spawn_failure" || mode === "after_spawn_failure")
        await assert.rejects(run(), new RegExp(`fixture_${mode}`, "u"));
      else await run();
    },
  );
}

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
  const server = await startMcpCoordinatorStreamableHttp(dependencies(), {
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
        name: "crdd.get_coordinator_state",
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
  const server = await startMcpCoordinatorStreamableHttp(
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
      "MCP-Name: crdd.run_objective",
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
  const server = await startMcpCoordinatorStreamableHttp(
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
      name: "crdd.get_coordinator_state",
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
      headers: { ...headers(body.method, "crdd.run_objective") },
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
  const server = await startMcpCoordinatorStreamableHttp(
    dependencies({
      getProjectState: async () => {
        effects += 1;
      },
    }),
    { port: 0, bearerToken: TOKEN },
  );
  const url = new URL(`http://${server.host}:${server.port}${server.endpoint}`);
  const requestHeaders = headers("tools/call", "crdd.get_coordinator_state");
  try {
    assert.equal(
      await sendRaw(url, requestHeaders, Buffer.from([0xc3, 0x28])),
      400,
    );
    const duplicate = Buffer.from(
      `{"jsonrpc":"2.0","id":1,"id":2,"method":"tools/call","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"${MCP_COORDINATOR_PROTOCOL_VERSION}","io.modelcontextprotocol/clientCapabilities":{}},"name":"crdd.get_coordinator_state","arguments":{}}}`,
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
  const server = await startMcpCoordinatorStreamableHttp(
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
              contract: "crdd-coordinator/orchestrator-objective-intake/v1",
              status: "cancelled",
              reason: "orchestrator_transport_disconnected",
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
      name: "crdd.run_objective",
      arguments: {
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
        intakeEpoch: "fixture-epoch",
      },
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
 * 公開Launcherのsignal所有は実行中Applicationの取消とjoin完了まで残るを検証する。
 *
 * @responsibility 公開Launcherのsignal所有は実行中Applicationの取消とjoin完了まで残るの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開Launcherのsignal所有は実行中Applicationの取消とjoin完了まで残るの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("公開Launcherのsignal所有は実行中Applicationの取消とjoin完了まで残る", async () => {
  let markStarted: (() => void) | null = null;
  let markAborted: (() => void) | null = null;
  let releaseHandler: (() => void) | null = null;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });
  const aborted = new Promise<void>((resolve) => {
    markAborted = resolve;
  });
  const server = await startMcpCoordinatorStreamableHttp(
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
                contract: "crdd-coordinator/orchestrator-objective-intake/v1",
                status: "cancelled",
                reason: "orchestrator_transport_shutdown",
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
      name: "crdd.run_objective",
      arguments: {
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
        intakeEpoch: "fixture-epoch",
      },
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
 * 公開Launcherのsignal所有は終了失敗を成功へ変えずlistenerを解放するを検証する。
 *
 * @responsibility 公開Launcherのsignal所有は終了失敗を成功へ変えずlistenerを解放するの合否判定を所有する。
 * @trace EST-ST-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開Launcherのsignal所有は終了失敗を成功へ変えずlistenerを解放するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary EST-ST-003=Direct Boundary: mcp Test Source→対象契約
 */
test("公開Launcherのsignal所有は終了失敗を成功へ変えずlistenerを解放する", async () => {
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

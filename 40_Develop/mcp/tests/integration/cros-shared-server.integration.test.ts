/**
 * CROS Shared Serverの同一Origin、TLS配置および終了境界を検証する。
 *
 * @packageDocumentation
 * @responsibility RESTとMCPの同一Gateway、HTTPS終端情報、Credential非開示および全Listener回収を実HTTPで確認する。
 * @trace PPR-IT-002
 * @trace RFD-IT-013
 * @level IT
 * @scope cros、mcp、shared-server、same-origin、tls-termination、cleanup
 * @boundary RFD-IT-013／PPR-IT-002=Direct Boundary: TLS終端Header→Shared Gateway→CROS REST／MCP
 */
import assert from "node:assert/strict";
import test from "node:test";

import { parseRepositoryProjectContextMarkdown } from "../../../project-operation/src/index.ts";
import {
  createMemoryConnectionCredentialRegistry,
  issueConnectionCredential,
  type RequestAccessContext,
} from "../../../cros/src/index.ts";
import {
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  startCrosSharedServer,
} from "../../src/index.ts";

const PUBLIC_ORIGIN = "https://cros.example.test";
const ADMINISTRATOR: RequestAccessContext = Object.freeze({
  credentialId: "bootstrap-admin",
  profile: "administrator",
  workspaceIds: Object.freeze([]),
  systemAdmin: true,
  credentialRegistryRevision: 0,
});

/**
 * Shared Server試験用の五場面Project Contextを構築する。
 *
 * @responsibility RESTとMCPが同じSource Projectionを返すための検証済みFixtureを作る。
 * @trace PPR-IT-002
 * @input N/A: 固定Repository Identityを使用する。
 * @returns 一RepositoryのProject Contextを返す。
 * @precondition Project Context Parserが利用可能である。
 * @postcondition PRJ-SHARED／REPO-SHAREDの五場面を持つ。
 * @effect N/A: 文字列を解析するだけである。
 * @failure Parser契約違反は試験失敗として送出する。
 * @invariant 外部Repositoryまたは未観測Contextを追加しない。
 * @stimulus projectContextの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary PPR-IT-002=Direct Boundary: mcp Test Source→対象契約
 * @security 非秘密の合成値だけを使用する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function projectContext() {
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
   * @cleanup N/A: Process外資源を生成しない局所検証である。
   * @boundary PPR-IT-002／RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
   */
  const scene = (title: string) =>
    `## ${title}\n\n要約。\n\n| 項目 | 状態 | 根拠 |\n|---|---|---|\n| Shared | current | owner.md |`;
  return parseRepositoryProjectContextMarkdown(
    `# Project Context\n\nProject ID: \`PRJ-SHARED\`\nRepository ID: \`REPO-SHARED\`\nRepository Role: \`development\`\n\n${scene("1. 今どうなっているか")}\n\n${scene("2. 何が危ない、または止まっているか")}\n\n${scene("3. 今、人間が決めることは何か")}\n\n${scene("4. なぜこの状態・判断になったか")}\n\n${scene("5. 次に何をすべきか")}\n`,
  );
}

/**
 * Shared Gatewayが要求するTLS終端Headerを返す。
 *
 * @responsibility Test Client要求を期待公開OriginからのTLS終端後要求として表現する。
 * @trace RFD-IT-013
 * @input 任意の追加Headerを受け取る。
 * @returns Forwarded／Originと追加値を持つHeaderを返す。
 * @precondition PUBLIC_ORIGINが期待Shared Server Originである。
 * @postcondition proto=https、host=cros.example.testとなる。
 * @effect N/A: 局所Objectを構築するだけである。
 * @failure N/A: 固定値を返す。
 * @invariant Credentialは呼出し側が明示した場合だけ含む。
 * @stimulus gatewayHeadersの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
 * @security 秘密値を既定値へ持たない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function gatewayHeaders(
  additional: Readonly<Record<string, string>> = {},
): Record<string, string> {
  return {
    "x-forwarded-proto": "https",
    "x-forwarded-host": "cros.example.test",
    origin: PUBLIC_ORIGIN,
    ...additional,
  };
}

/**
 * Shared GatewayへProject Context MCP要求を送る。
 *
 * @responsibility RESTと同じGateway URL上の`/mcp`へ認証済みTool Callを発行する。
 * @trace RFD-IT-013
 * @trace PPR-IT-002
 * @input Gateway URLとBearer Tokenを受け取る。
 * @returns HTTP Responseを返す。
 * @precondition Shared Serverが起動済みである。
 * @postcondition 一つのMCP Tool Callだけを完了する。
 * @effect loopback GatewayへHTTP POSTを一回発行する。
 * @failure NetworkまたはProtocol失敗を呼出しTestへ返す。
 * @invariant TokenをURLまたはBodyへ含めない。
 * @stimulus callProjectContextの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary RFD-IT-013／PPR-IT-002=Direct Boundary: mcp Test Source→対象契約
 * @security TokenはAuthorization Headerだけで搬送する。
 * @concurrency 一Requestの完了を待つ。
 */
function callProjectContext(baseUrl: string, token: string): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: gatewayHeaders({
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": MCP_PROJECT_CONTEXT_GET_TOOL,
    }),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "shared-project-context",
      method: "tools/call",
      params: {
        name: MCP_PROJECT_CONTEXT_GET_TOOL,
        arguments: { projectId: "PRJ-SHARED" },
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

/**
 * Shared ServerがRESTとMCPを同一HTTPS Originへ閉じることを検証する。
 *
 * @responsibility 実Gatewayを通してTLS配置、同一Origin、Workspace絞込み、Credential非開示およびcleanupを確認する。
 * @trace RFD-IT-013
 * @precondition Development Credentialと一つの公開Repositoryを用意する。
 * @stimulus Health、Portfolio REST、Project Context MCP、不正TLS情報および不正Originを同じGatewayへ送る。
 * @observation URL、Status、Project／Repository Identity、拒否Bodyおよび終了後接続を観測する。
 * @oracle RESTとMCPが同一Gatewayで同じ許可Sourceを返し、不正配置は秘密非開示で拒否され、close後は再接続不能となる。
 * @cleanup Shared Server Handleを閉じて三Listenerと接続を回収する。
 * @boundary RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
 */
test("Shared ServerはRESTとMCPを同一Originへ安全に束ねる", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(registry, ADMINISTRATOR, {
    profile: "developer",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const server = await startCrosSharedServer({
    publicOrigin: PUBLIC_ORIGIN,
    registry,
    readExposureSnapshot: () => ({
      revision: "shared-exposure-1",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: "REPO-SHARED",
          repositoryRevision: "shared-1",
          registryRevision: "shared-exposure-1",
          active: true,
        },
      ],
      repositories: [
        {
          projectId: "PRJ-SHARED",
          repositoryId: "REPO-SHARED",
          bindingId: "BIND-SHARED",
          revision: "shared-1",
          content: { projectContext: projectContext() },
        },
      ],
    }),
  });
  assert.equal(server.publicOrigin, PUBLIC_ORIGIN);
  assert.equal(
    new URL(server.restPortfolioPath, server.publicOrigin).origin,
    new URL(server.mcpPath, server.publicOrigin).origin,
  );
  try {
    const health = await fetch(
      `${server.localGatewayUrl}/.well-known/cros-shared-health`,
      { headers: gatewayHeaders() },
    );
    assert.equal(health.status, 200);
    const healthText = await health.text();
    assert.match(healthText, /"restPortfolioPath":"\/v1\/portfolio"/u);
    assert.match(healthText, /"mcpPath":"\/mcp"/u);

    const portfolio = await fetch(
      `${server.localGatewayUrl}${server.restPortfolioPath}`,
      {
        headers: gatewayHeaders({
          authorization: `Bearer ${issued.token}`,
        }),
      },
    );
    assert.equal(portfolio.status, 200);
    assert.match(JSON.stringify(await portfolio.json()), /REPO-SHARED/u);

    const mcp = await callProjectContext(server.localGatewayUrl, issued.token);
    assert.equal(mcp.status, 200);
    assert.match(JSON.stringify(await mcp.json()), /REPO-SHARED/u);

    const missingTls = await fetch(
      `${server.localGatewayUrl}${server.restPortfolioPath}`,
      { headers: { authorization: `Bearer ${issued.token}` } },
    );
    assert.equal(missingTls.status, 421);
    assert.doesNotMatch(await missingTls.text(), new RegExp(issued.token, "u"));

    const wrongOrigin = await fetch(
      `${server.localGatewayUrl}${server.restPortfolioPath}`,
      {
        headers: {
          ...gatewayHeaders({ authorization: `Bearer ${issued.token}` }),
          origin: "https://attacker.example",
        },
      },
    );
    assert.equal(wrongOrigin.status, 403);
    assert.doesNotMatch(
      await wrongOrigin.text(),
      /REPO-SHARED|workspace|credential/iu,
    );
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
  }
  await assert.rejects(fetch(`${server.localGatewayUrl}/v1/portfolio`));
});

/**
 * Shared Serverが非HTTPSまたはOrigin以外の公開URLをEffect前に拒否することを検証する。
 *
 * @responsibility TLS終端を省略・曖昧化する運用設定からListenerを開始しないことを確認する。
 * @trace RFD-IT-013
 * @precondition 空のCredential Registryを用意する。
 * @stimulus HTTP URL、Path付きHTTPS URLおよび認証情報付きURLで起動を要求する。
 * @observation 起動例外とListener非作成を観測する。
 * @oracle 全候補が同じ安全な構成Errorで拒否される。
 * @cleanup N/A: Listenerは開始されない。
 * @boundary RFD-IT-013=Direct Boundary: mcp Test Source→対象契約
 */
test("Shared ServerはHTTPS Origin以外の公開設定をEffect前に拒否する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  for (const publicOrigin of [
    "http://cros.example.test",
    "https://cros.example.test/path",
    "https://user:secret@cros.example.test",
  ]) {
    await assert.rejects(
      startCrosSharedServer({
        publicOrigin,
        registry,
        readExposureSnapshot: () => ({
          revision: "shared-empty-1",
          exposures: [],
          repositories: [],
        }),
      }),
      /cros_shared_server_public_origin_invalid/u,
    );
  }
});

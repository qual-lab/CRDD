/**
 * CROS CredentialからProject Context MCPまでの実境界を検証する。
 *
 * @packageDocumentation
 * @responsibility RequestごとのCredential検証、Workspace絞込み、MCP搬送および非開示をHTTP境界で確認する。
 * @trace RFD-IT-013
 * @trace PPR-IT-002
 * @level IT
 * @scope mcp、cros、credential、project-context、http
 * @boundary Bearer HTTP→Credential→Workspace Exposure→Portfolio→MCP
 */
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createTopicMeetingApplication,
  createTopicMeetingRepository,
  parseRepositoryProjectContextMarkdown,
} from "../../../project-operation/src/index.ts";
import {
  createMemoryConnectionCredentialRegistry,
  issueConnectionCredential,
  type RequestAccessContext,
} from "../../../cros/src/index.ts";
import {
  createCrosProjectContextMcpResolver,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  startMcpAuthenticatedStreamableHttp,
} from "../../src/index.ts";

const administrator: RequestAccessContext = Object.freeze({
  credentialId: "bootstrap-admin",
  profile: "administrator",
  workspaceIds: Object.freeze([]),
  systemAdmin: true,
  credentialRegistryRevision: 0,
});

/** 五場面を持つProject Context Fixtureを作る。 */
function context(repositoryId: string, repositoryRole: string) {
  const scene = (title: string) =>
    `## ${title}\n\n要約。\n\n| 項目 | 状態 | 根拠 |\n|---|---|---|\n| Sample | current | owner.md |`;
  return parseRepositoryProjectContextMarkdown(
    `# Project Context\n\nProject ID: \`PRJ-MCP\`\nRepository ID: \`${repositoryId}\`\nRepository Role: \`${repositoryRole}\`\n\n${scene("1. 今どうなっているか")}\n\n${scene("2. 何が危ない、または止まっているか")}\n\n${scene("3. 今、人間が決めることは何か")}\n\n${scene("4. なぜこの状態・判断になったか")}\n\n${scene("5. 次に何をすべきか")}\n`,
  );
}

/** MCP Tool CallをBearer HTTPで送信する。 */
async function callProjectContext(
  baseUrl: string,
  token: string,
): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": MCP_PROJECT_CONTEXT_GET_TOOL,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: MCP_PROJECT_CONTEXT_GET_TOOL,
        arguments: { projectId: "PRJ-MCP" },
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

/** Remote CROS Topic登録をBearer HTTPで送信する。 */
async function createRemoteTopic(
  baseUrl: string,
  token: string,
  repositoryId: string,
): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": "crdd.create_topic",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "crdd.create_topic",
        arguments: {
          repositoryId,
          markdown:
            "# Remote Topic\n\n成果物種別: Topic\nTopic ID: `TOPIC-000099`\nProject ID: `PRJ-MCP`\n状態: `open`\n改訂: `1`\n維持責任者: `Project Operator`\n\n## 1. 現在の論点\n\n### 結論\n\nRemote routingを確認する。\n",
        },
        _meta: {
          "io.modelcontextprotocol/protocolVersion":
            MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

/** Relationを持つTopic Fixtureを作る。 */
function relatedTopic(id: string, relationId: string): string {
  return `# ${id}\n\n成果物種別: Topic\nTopic ID: \`${id}\`\nProject ID: \`PRJ-MCP\`\n状態: \`open\`\n改訂: \`1\`\n維持責任者: \`Project Operator\`\n\n## 1. 現在の論点\n\n### 結論\n\nRepository間Relationを確認する。\n\n## 3. 関係\n\n| 関係種別 | 対象ID／参照 | このTopicとの関係 |\n|---|---|---|\n| related | \`${relationId}\` | 同じProjectの別Owner |\n`;
}

/** Remote CROS Topic詳細をBearer HTTPで取得する。 */
async function getRemoteTopic(
  baseUrl: string,
  token: string,
  repositoryId: string,
  topicId: string,
): Promise<Response> {
  return fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
      "mcp-method": "tools/call",
      "mcp-name": "crdd.get_topic",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "crdd.get_topic",
        arguments: { repositoryId, id: topicId },
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
 * CROS CredentialのWorkspace範囲だけをMCPへ搬送する。
 *
 * @responsibility Remote CROS MCPが固定Transport Tokenを追加せず、現在CredentialでPortfolioを絞ることを検証する。
 * @trace RFD-IT-013
 * @trace PPR-IT-002
 * @precondition Developer CredentialとDEV／MGMT Repositoryを用意する。
 * @stimulus 有効Tokenと無効Tokenから同じProject Contextを要求する。
 * @observation HTTP Status、Structured Contentおよび非開示Repository文字列を観測する。
 * @oracle 有効TokenはDEVだけを取得し、無効TokenはMGMTの存在を開示せず401となる。
 * @cleanup MCP listenerを閉じる。
 * @boundary Bearer HTTP→CROS Access Context→Project Context MCP。
 */
test("CROS CredentialのWorkspace範囲だけをProject Context MCPへ搬送する", async () => {
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(registry, administrator, {
    profile: "developer",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const resolver = createCrosProjectContextMcpResolver({
    registry,
    readExposureSnapshot: () => ({
      revision: "exposure-mcp-1",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: "REPO-DEV",
          repositoryRevision: "dev-1",
          registryRevision: "exposure-mcp-1",
          active: true,
        },
        {
          workspaceId: "management",
          repositoryId: "REPO-MGMT",
          repositoryRevision: "mgmt-1",
          registryRevision: "exposure-mcp-1",
          active: true,
        },
      ],
      repositories: [
        {
          projectId: "PRJ-MCP",
          repositoryId: "REPO-DEV",
          bindingId: "BIND-DEV",
          revision: "dev-1",
          content: { projectContext: context("REPO-DEV", "development") },
        },
        {
          projectId: "PRJ-MCP",
          repositoryId: "REPO-MGMT",
          bindingId: "BIND-MGMT",
          revision: "mgmt-1",
          content: { projectContext: context("REPO-MGMT", "management") },
        },
      ],
    }),
  });
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const baseUrl = `http://${server.host}:${server.port}`;
  try {
    const available = await callProjectContext(baseUrl, issued.token);
    assert.equal(available.status, 200);
    const body = JSON.stringify(await available.json());
    assert.match(body, /REPO-DEV/u);
    assert.doesNotMatch(body, /REPO-MGMT/u);

    const blocked = await callProjectContext(
      baseUrl,
      "invalid-token-value-that-is-long-enough-0000",
    );
    assert.equal(blocked.status, 401);
    assert.doesNotMatch(await blocked.text(), /REPO|workspace|credential/iu);
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
  }
});

/**
 * Remote CROS Topic書込みを明示Repositoryと現在Exposureへ拘束する。
 *
 * @responsibility Credential Grant外Repositoryへの書込みを非開示拒否し、許可Repositoryだけを対応ApplicationへRoutingする。
 * @trace RFD-IT-013 CPR-IT-008
 * @precondition Development Credential、DEV ExposureおよびDEV Topic Repositoryを用意する。
 * @stimulus DEVと非許可MGMTのRepository IDを指定してTopic登録を要求する。
 * @observation MCP応答とDEV RepositoryのTopicを観測する。
 * @oracle DEVだけ一件作成し、MGMT要求は同じ非開示エラーでEffect 0となる。
 * @cleanup MCP Listenerと検証用Repository Rootを削除する。
 * @boundary Bearer HTTP→Credential→Workspace Exposure→Repository Binding→Topic Repository。
 */
test("CROSは許可済みRepositoryだけへTopic書込みをRoutingする", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "crdd-cros-topic-routing-"));
  const topicMeeting = createTopicMeetingApplication(
    createTopicMeetingRepository(root),
  );
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(registry, administrator, {
    profile: "developer",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const resolver = createCrosProjectContextMcpResolver({
    registry,
    readExposureSnapshot: () => ({
      revision: "exposure-write-1",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: "REPO-DEV",
          repositoryRevision: "dev-1",
          registryRevision: "exposure-write-1",
          active: true,
        },
        {
          workspaceId: "management",
          repositoryId: "REPO-MGMT",
          repositoryRevision: "mgmt-1",
          registryRevision: "exposure-write-1",
          active: true,
        },
      ],
      repositories: [
        {
          projectId: "PRJ-MCP",
          repositoryId: "REPO-DEV",
          bindingId: "BIND-DEV",
          revision: "dev-1",
          content: { projectContext: context("REPO-DEV", "development") },
        },
        {
          projectId: "PRJ-MCP",
          repositoryId: "REPO-MGMT",
          bindingId: "BIND-MGMT",
          revision: "mgmt-1",
          content: { projectContext: context("REPO-MGMT", "management") },
        },
      ],
    }),
    resolveTopicMeetingApplication: (repository) =>
      repository.bindingId === "BIND-DEV" ? topicMeeting : null,
  });
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  const baseUrl = `http://${server.host}:${server.port}`;
  try {
    const available = await createRemoteTopic(
      baseUrl,
      issued.token,
      "REPO-DEV",
    );
    assert.equal(available.status, 200);
    assert.match(JSON.stringify(await available.json()), /record_created/u);
    assert.equal(topicMeeting.get("topic", "TOPIC-000099")?.revision, 1);

    const blocked = await createRemoteTopic(baseUrl, issued.token, "REPO-MGMT");
    assert.equal(blocked.status, 200);
    const blockedBody = JSON.stringify(await blocked.json());
    assert.match(blockedBody, /Invalid params/u);
    assert.doesNotMatch(blockedBody, /REPO-MGMT|management/u);
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
    rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 許可済みRepository間のRelationをOwner Repository付きで解決する。
 *
 * @responsibility FederationがTopic本文を複製せず、現在Principalに見える一意なOwnerへRelationを戻すことを検証する。
 * @trace RFD-IT-013 CPR-IT-008
 * @precondition Management Credential、DEV／MGMT Exposureおよび別OwnerのTopicを用意する。
 * @stimulus DEV Topic詳細をRemote MCPから取得する。
 * @observation Structured ContentのRelation状態とOwner Repositoryを観測する。
 * @oracle RelationはavailableかつREPO-MGMT所有となり、対象本文をDEVへ複製しない。
 * @cleanup MCP Listenerと二つの検証用Repository Rootを削除する。
 * @boundary Bearer HTTP→Workspace Grant→Project Federation→Owner Repository Relation。
 */
test("CROSはRepository間Relationを許可済みOwnerへ解決する", async () => {
  const devRoot = mkdtempSync(path.join(tmpdir(), "crdd-cros-rel-dev-"));
  const mgmtRoot = mkdtempSync(path.join(tmpdir(), "crdd-cros-rel-mgmt-"));
  const dev = createTopicMeetingApplication(
    createTopicMeetingRepository(devRoot),
  );
  const mgmt = createTopicMeetingApplication(
    createTopicMeetingRepository(mgmtRoot),
  );
  assert.equal(
    dev.create("topic", relatedTopic("TOPIC-000101", "TOPIC-000201")).status,
    "completed",
  );
  assert.equal(
    mgmt.create("topic", relatedTopic("TOPIC-000201", "TOPIC-000101")).status,
    "completed",
  );
  const registry = createMemoryConnectionCredentialRegistry();
  const issued = issueConnectionCredential(registry, administrator, {
    profile: "management",
  });
  assert.equal(issued.status, "completed");
  if (issued.status !== "completed") return;
  const repositories = [
    {
      projectId: "PRJ-MCP",
      repositoryId: "REPO-DEV",
      bindingId: "BIND-DEV",
      revision: "dev-rel-1",
      content: { projectContext: context("REPO-DEV", "development") },
    },
    {
      projectId: "PRJ-MCP",
      repositoryId: "REPO-MGMT",
      bindingId: "BIND-MGMT",
      revision: "mgmt-rel-1",
      content: { projectContext: context("REPO-MGMT", "management") },
    },
  ] as const;
  const resolver = createCrosProjectContextMcpResolver({
    registry,
    readExposureSnapshot: () => ({
      revision: "exposure-rel-1",
      exposures: [
        {
          workspaceId: "development",
          repositoryId: "REPO-DEV",
          repositoryRevision: "dev-rel-1",
          registryRevision: "exposure-rel-1",
          active: true,
        },
        {
          workspaceId: "management",
          repositoryId: "REPO-MGMT",
          repositoryRevision: "mgmt-rel-1",
          registryRevision: "exposure-rel-1",
          active: true,
        },
      ],
      repositories,
    }),
    resolveTopicMeetingApplication: (repository) =>
      repository.repositoryId === "REPO-DEV"
        ? dev
        : repository.repositoryId === "REPO-MGMT"
          ? mgmt
          : null,
  });
  const server = await startMcpAuthenticatedStreamableHttp(resolver, {
    port: 0,
  });
  try {
    const response = await getRemoteTopic(
      `http://${server.host}:${server.port}`,
      issued.token,
      "REPO-DEV",
      "TOPIC-000101",
    );
    assert.equal(response.status, 200);
    const body = JSON.stringify(await response.json());
    assert.match(body, /TOPIC-000201/u);
    assert.match(body, /"state":"available"/u);
    assert.match(body, /"ownerRepositoryId":"REPO-MGMT"/u);
    assert.equal(dev.get("topic", "TOPIC-000201"), null);
  } finally {
    const closed = await server.close();
    assert.equal(closed.cleanupConfirmed, true);
    rmSync(devRoot, { recursive: true, force: true });
    rmSync(mgmtRoot, { recursive: true, force: true });
  }
});

/**
 * mcp:unit:project-contextの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Repository単体とFederationのProject Context MCP契約を検証する。
 * @trace PPR-UT-006
 * @level UT
 * @scope mcp、project-context、portfolio、non-disclosure
 * @boundary PPR-UT-006=N/A: Adapterの決定論的RoutingとProjectionをProcess内で検証する。
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { PortfolioProjection } from "../../../cros/src/index.ts";
import {
  handleMcpApplicationRequest,
  handleMcpProjectContextRequest,
  MCP_PROJECT_CONTEXT_GET_TOOL,
  MCP_PROJECT_CONTEXT_LIST_TOOL,
  MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  type McpApplicationDependencies,
} from "../../src/index.ts";

const META = Object.freeze({
  "io.modelcontextprotocol/protocolVersion":
    MCP_PROJECT_RUNTIME_PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": Object.freeze({}),
});

/**
 * Project Context Adapter用MCP要求を構築する。
 *
 * @responsibility TestごとのTool名と引数を正規MCP Envelopeへ閉じる。
 * @trace PPR-UT-006
 * @precondition 呼出し元がTool名とPlain Object引数を渡す。
 * @stimulus Tool Call Requestを構築する。
 * @observation Adapterへ渡せるObjectを返す。
 * @oracle JSON-RPC、Metadata、Tool名および引数が固定位置に存在する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PPR-UT-006=N/A: Process内Fixture構築である。
 */
function call(name: string, args: Readonly<Record<string, unknown>>) {
  return Object.freeze({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: Object.freeze({ _meta: META, name, arguments: args }),
  });
}

/**
 * 二Repositoryを持つ許可済みPortfolio Fixtureを構築する。
 *
 * @responsibility 五場面を持つSourceと欠測Sourceの両方を再現する。
 * @trace PPR-UT-006
 * @precondition N/A: 固定Fixtureを使用する。
 * @stimulus Portfolio Projectionを構築する。
 * @observation Adapterが一覧・取得に使用するSnapshotを返す。
 * @oracle 非開示Repositoryを含まず、completeとpartialを区別する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PPR-UT-006=N/A: Process内Fixture構築である。
 */
function portfolio(): PortfolioProjection {
  const scene = (key: "current" | "risk" | "decision" | "reason" | "next") =>
    Object.freeze({
      key,
      title: key,
      summary: `${key} summary`,
      table: Object.freeze({
        columns: Object.freeze(["項目", "内容"]),
        rows: Object.freeze([Object.freeze([key, `${key} value`])]),
      }),
    });
  const context = Object.freeze({
    projectId: "PRJ-001",
    repositoryId: "PRJ-001-DEV",
    repositoryRole: "development",
    scenes: Object.freeze([
      scene("current"),
      scene("risk"),
      scene("decision"),
      scene("reason"),
      scene("next"),
    ]),
  });
  return Object.freeze({
    projects: Object.freeze([
      Object.freeze({
        projectId: "PRJ-001",
        state: "complete" as const,
        sources: Object.freeze([
          Object.freeze({
            repositoryId: "PRJ-001-DEV",
            revision: "repository-current",
            state: "complete" as const,
            repositoryRole: "development",
            context,
          }),
        ]),
      }),
      Object.freeze({
        projectId: "PRJ-002",
        state: "partial" as const,
        sources: Object.freeze([
          Object.freeze({
            repositoryId: "PRJ-002-DEV",
            revision: "repository-current",
            state: "missing" as const,
            repositoryRole: null,
            context: null,
          }),
        ]),
      }),
    ]),
    retainedAsSourceOfTruth: false,
  });
}

/**
 * Repository単体とFederationが同じProject Context取得形を使用することを検証する。
 *
 * @responsibility Portfolio Source数によらず五場面を保持する取得結果を検証する。
 * @trace PPR-UT-006
 * @precondition 許可済みPortfolio Fixtureを使用する。
 * @stimulus crdd.get_project_contextを呼び出す。
 * @observation structuredContent内のProjectとSource Contextを取得する。
 * @oracle 五場面、Source状態および非正本宣言が入力どおり保持される。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PPR-UT-006=N/A: Process内Adapterを直接検証する。
 */
test("Project Context MCP preserves the five canonical scenes", async () => {
  let reads = 0;
  const response = await handleMcpProjectContextRequest(
    call(MCP_PROJECT_CONTEXT_GET_TOOL, { projectId: "PRJ-001" }),
    {
      readPortfolio: async () => {
        reads += 1;
        return portfolio();
      },
    },
  );
  assert.equal(reads, 1);
  assert.equal(response.error, undefined);
  const content = response.result as {
    structuredContent: {
      project: PortfolioProjection["projects"][number];
      retainedAsSourceOfTruth: boolean;
    };
  };
  assert.equal(content.structuredContent.project.projectId, "PRJ-001");
  assert.deepEqual(
    content.structuredContent.project.sources[0]?.context?.scenes.map(
      ({ key }) => key,
    ),
    ["current", "risk", "decision", "reason", "next"],
  );
  assert.equal(content.structuredContent.retainedAsSourceOfTruth, false);
});

/**
 * Project一覧が許可済みPortfolioの範囲だけを返すことを検証する。
 *
 * @responsibility 一覧の状態・件数投影とSource詳細の非公開を検証する。
 * @trace PPR-UT-006
 * @precondition 許可済みPortfolio Fixtureを使用する。
 * @stimulus crdd.list_projectsを呼び出す。
 * @observation structuredContent.projectsを取得する。
 * @oracle Project ID、状態、許可済みSource数だけを返す。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PPR-UT-006=N/A: Process内Adapterを直接検証する。
 */
test("Project Context MCP lists only the supplied portfolio", async () => {
  const response = await handleMcpProjectContextRequest(
    call(MCP_PROJECT_CONTEXT_LIST_TOOL, {}),
    { readPortfolio: async () => portfolio() },
  );
  const content = response.result as {
    structuredContent: {
      projects: readonly Readonly<Record<string, unknown>>[];
    };
  };
  assert.deepEqual(content.structuredContent.projects, [
    { projectId: "PRJ-001", state: "complete", sourceCount: 1 },
    { projectId: "PRJ-002", state: "partial", sourceCount: 1 },
  ]);
});

/**
 * 合成AdapterがRuntimeとContextを同じTool一覧へ公開することを検証する。
 *
 * @responsibility Capability追加後もTool一覧とRouting対象が一致することを検証する。
 * @trace PPR-UT-006
 * @precondition Runtime依存はTool一覧では呼び出されない。
 * @stimulus tools/listを合成Adapterへ渡す。
 * @observation 公開Tool名を取得する。
 * @oracle Project Context二ToolとProject Runtime三Toolが一度ずつ存在する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PPR-UT-006=N/A: Process内Compositionを直接検証する。
 */
test("MCP application publishes runtime and context tools without conflating them", async () => {
  const dependencies = {
    projectRuntime: {
      authenticateClient: () => ({ status: "unknown" as const }),
      runObjective: async () => ({}),
      submitDecision: async () => ({}),
      getProjectState: async () => ({}),
    },
    projectContext: { readPortfolio: async () => portfolio() },
  } satisfies McpApplicationDependencies;
  const response = await handleMcpApplicationRequest(
    Object.freeze({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: Object.freeze({ _meta: META }),
    }),
    dependencies,
  );
  const tools = (response.result as { tools: readonly { name: string }[] })
    .tools;
  assert.equal(new Set(tools.map(({ name }) => name)).size, 5);
  assert.ok(tools.some(({ name }) => name === MCP_PROJECT_CONTEXT_LIST_TOOL));
  assert.ok(tools.some(({ name }) => name === MCP_PROJECT_CONTEXT_GET_TOOL));
});

/**
 * 未提供Projectを非開示なUnavailableとして返すことを検証する。
 *
 * @responsibility Grant外または未知Projectの存在を区別しない拒否結果を検証する。
 * @trace PPR-UT-006
 * @precondition Portfolioに対象Projectを含めない。
 * @stimulus 未提供Project IDで取得Toolを呼び出す。
 * @observation structuredContentのstatusとreasonを取得する。
 * @oracle Repository名、件数、Roleまたは非開示Sourceを応答へ含めない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary PPR-UT-006=N/A: Process内Adapterを直接検証する。
 */
test("Project Context MCP does not disclose unavailable projects", async () => {
  const response = await handleMcpProjectContextRequest(
    call(MCP_PROJECT_CONTEXT_GET_TOOL, { projectId: "PRJ-HIDDEN" }),
    { readPortfolio: async () => portfolio() },
  );
  const serialized = JSON.stringify(response);
  assert.match(serialized, /project_context_not_available/u);
  assert.doesNotMatch(serialized, /repositoryId|repositoryRole|PRJ-001-DEV/u);
});

/**
 * Project ContextをMCPへ公開するProtocol契約。
 *
 * @packageDocumentation
 * @responsibility Project Contextの一覧・取得Tool名と入力Schemaを所有する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @boundary Project Context Read ModelとMCP Tool記述の境界。
 * @effect N/A: 固定されたTool記述だけを返す。
 * @concurrency N/A: 共有状態を持たない。
 * @security Tool記述から非開示ProjectやRepositoryの存在を推測させない。
 */

export const MCP_PROJECT_CONTEXT_LIST_TOOL = "crdd.list_projects" as const;
export const MCP_PROJECT_CONTEXT_GET_TOOL = "crdd.get_project_context" as const;

/**
 * Project Context Tool Definitionsを取得する。
 *
 * @responsibility Project Contextの一覧・取得入力を固定Schemaとして公開する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input N/A: 実行時引数を受け取らない。
 * @returns Project Context用MCP Tool記述を返す。
 * @precondition N/A: 固定契約だけを使用する。
 * @postcondition 一覧と取得の二Toolを固定順で返す。
 * @effect N/A: 入力、FilesystemまたはNetworkを変更しない。
 * @failure N/A: 固定値の構築に独自の失敗分岐を持たない。
 * @invariant Project Runtime状態ToolとProject Context Toolを同一名にしない。
 * @boundary MCP Clientへ公開するTool Schema境界。
 * @security Project ID以外のRepository IdentityやAuthority入力を要求しない。
 * @concurrency N/A: 同期的な純粋構築である。
 */
export function getMcpProjectContextToolDefinitions() {
  const projectId = Object.freeze({
    type: "string",
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
  });
  return Object.freeze([
    Object.freeze({
      name: MCP_PROJECT_CONTEXT_LIST_TOOL,
      title: "参照できるProjectの一覧を取得",
      description:
        "現在の接続から参照できるProject Contextだけを一覧として取得します。",
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        required: Object.freeze([]),
        properties: Object.freeze({}),
      }),
    }),
    Object.freeze({
      name: MCP_PROJECT_CONTEXT_GET_TOOL,
      title: "Project Contextを取得",
      description:
        "指定Projectの五場面とSource Coverageを、保存済み投影から取得します。",
      inputSchema: Object.freeze({
        type: "object",
        additionalProperties: false,
        required: Object.freeze(["projectId"]),
        properties: Object.freeze({ projectId }),
      }),
    }),
  ]);
}

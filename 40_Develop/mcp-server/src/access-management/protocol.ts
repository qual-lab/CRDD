/**
 * 鍵を含まないAccess Management操作のMCP入力を定義する。
 * @responsibility 管理四読取りと登録以外六保存の閉じたTool集合を所有する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary MCP公開入力とAMの現在認可・保存契約。
 * @security 資格、管理Root、Binding、鍵操作、Workbench限定のRepository登録を含めない。
 */

/**
 * 独立先行できる非鍵管理Tool名を固定する。
 * @responsibility 一覧とdispatchの操作Identityを共有する。
 * @trace ARCH-000012
 */
export const MCP_ACCESS_MANAGEMENT_TOOLS = Object.freeze({
  listUsers: "crdd.list_access_users",
  listRoleContentAccess: "crdd.list_role_content_access",
  listRepositories: "crdd.list_registered_repositories",
  listExposure: "crdd.list_repository_exposure",
  registerUser: "crdd.register_user",
  updateUserName: "crdd.update_user_name",
  changeUserRole: "crdd.change_user_role",
  updateRoleContentAccess: "crdd.update_role_content_access",
  unregisterRepository: "crdd.unregister_repository",
  updateExposure: "crdd.update_repository_exposure",
} as const);

/**
 * 通常本人readの操作名を管理操作から分離する。
 * @responsibility 全Roleに提供する本人操作Identityを固定する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
export const MCP_CURRENT_ACCESS_TOOL = "crdd.get_current_access" as const;
/**
 * 本人readの空閉入力を定義する。
 * @responsibility 資格・管理Root・他User指定を受け取らない。
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
export const MCP_CURRENT_ACCESS_TOOL_DEFINITION = Object.freeze({
  name: MCP_CURRENT_ACCESS_TOOL,
  title: "接続している本人と利用範囲",
  description:
    "本人と内容利用範囲を現在観測します。管理能力やToolの提供可否を示すものではありません。",
  inputSchema: {
    type: "object",
    additionalProperties: false,
    required: [],
    properties: {},
  },
});

/**
 * 管理Toolの構造Schemaだけを生成する。
 * @responsibility 操作固有入力と共通相関を閉じ、値の業務判定をAMに残す。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input N/A: 固定した十操作を生成する。
 * @returns 非鍵管理Toolの固定名・表示名・入力Schema。
 * @precondition Consumerは現在manager／administratorの一覧認可を別に確認する。
 * @postcondition 未知fieldを拒否するSchemaだけを返す。
 * @effect N/A: メモリ内の値を構成するだけ。
 * @failure N/A: 外部観測・保存を行わない。
 * @invariant 一覧表示は実行Authorityや最終Tool集合の完成ではない。
 * @boundary MCP SchemaとAMの現在値検査。
 * @security 秘密とHost Pathを入力へ追加しない。
 * @concurrency N/A: 共有する現在状態を読まない。
 */
export function getMcpAccessManagementToolDefinitions() {
  const role = {
    type: "string",
    enum: ["developer", "manager", "administrator"],
  };
  const userId = {
    type: "string",
    pattern:
      "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
  };
  const repositoryId = {
    type: "string",
    pattern: "^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$",
  };
  const workspaceIds = {
    type: "array",
    uniqueItems: true,
    maxItems: 2,
    items: { type: "string", enum: ["development", "management"] },
  };
  const definitions = [
    ["listUsers", "ユーザー一覧", {}],
    ["listRoleContentAccess", "Role内容範囲一覧", {}],
    ["listRepositories", "登録Repository一覧", {}],
    ["listExposure", "Repository公開範囲一覧", {}],
    [
      "registerUser",
      "ユーザー登録",
      { username: { type: "string" }, plannedRole: role },
    ],
    [
      "updateUserName",
      "ユーザー表示名変更",
      { userId, username: { type: "string" } },
    ],
    [
      "changeUserRole",
      "ユーザーRole変更",
      { userId, currentRole: role, nextRole: role },
    ],
    [
      "updateRoleContentAccess",
      "Role内容範囲変更",
      { targetRole: role, workspaceIds },
    ],
    ["unregisterRepository", "Repository登録解除", { repositoryId }],
    [
      "updateExposure",
      "Repository公開範囲変更",
      { repositoryId, workspaceIds },
    ],
  ] as const;
  return Object.freeze(
    definitions.map(([operation, title, fields]) => {
      const mutation = Object.keys(fields).length !== 0;
      const properties = mutation
        ? {
            operationId: userId,
            expectedRevision: {
              type: "integer",
              minimum: 1,
              maximum: Number.MAX_SAFE_INTEGER,
            },
            ...fields,
          }
        : {};
      return Object.freeze({
        name: MCP_ACCESS_MANAGEMENT_TOOLS[operation],
        title,
        description:
          "現在の管理権限で操作します。管理許可は内容閲覧や鍵操作の許可ではありません。",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          required: Object.keys(properties),
          properties,
        },
      });
    }),
  );
}

/**
 * Access Managementの実装済み固定管理判定を公開する。
 *
 * @packageDocumentation
 * @responsibility Roleと操作対象の純粋判定を明示公開し、保存・認証・鍵処置を未接続のまま区別する。
 * @trace ARCH-000013
 */
export {
  type AccessRole,
  evaluateManagementPermission,
  type ManagementPermission,
  type ManagementRequest,
} from "./access/management-permission.ts";

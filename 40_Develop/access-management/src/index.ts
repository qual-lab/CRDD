/**
 * Access Managementの管理分担・初回観測判定・状態parseを公開する。
 *
 * @packageDocumentation
 * @responsibility 純粋判定と内部状態検査を明示公開し、保存・認証・鍵処置を未接続のまま区別する。
 * @trace ARCH-000013
 */
export {
  type AccessRole,
  evaluateManagementPermission,
  type ManagementPermission,
  type ManagementRequest,
} from "./access/management-permission.ts";
export {
  evaluateHostInitializationState,
  type HostInitializationDecision,
} from "./initialization/state-evaluation.ts";
export {
  type AccessManagementState,
  type InitializationRecord,
  type KeyExchangeRecord,
  parseAccessManagementState,
  type StateParseResult,
} from "./state/parse.ts";

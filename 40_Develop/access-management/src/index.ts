/**
 * Access Managementの純粋判定と内部状態保存を公開する。
 *
 * @packageDocumentation
 * @responsibility 純粋判定・内部保存を明示公開し、認証・鍵処置・本番入口との未接続を区別する。
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
export {
  createInitialAdministrator,
  initializeAccessManagementState,
  readAccessManagementState,
  updateAccessManagementState,
  type StateStoreResult,
} from "./state/file-store.ts";

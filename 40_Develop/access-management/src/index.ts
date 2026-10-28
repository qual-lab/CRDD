/**
 * Access Managementの認証・認可・管理操作と型付き結果を公開する。
 *
 * @packageDocumentation
 * @responsibility 純粋判定・現在認証・管理操作・鍵管理・Host初期化と既存保存Ownerの公開集合を固定する。
 * @trace ARCH-000013
 * @boundary 同Hostの信頼された構成側とAccess Managementの専門API境界。
 * @effect 公開した管理操作は既存Host管理Rootの状態・資格を保存し得る。Transportは所有しない。
 * @security 秘密値は明示した発行・交換結果だけへ返し、一般状態読取りへ含めない。
 */

export { readCurrentAccess } from "./authorization/current.ts";
export { resolveRuntimeContentAccess } from "./repository/resolve.ts";
export {
  type AiProfileManagementPermission,
  evaluateManagementPermission,
  readManagementState,
  evaluateAiProfileManagementPermission,
} from "./authorization/management.ts";

export { authenticateNormalConnection } from "./credential/authentication.ts";
export {
  issueCredential,
  readCredentialAdministrationState,
  readCredentialIssuance,
  revokeCredential,
} from "./credential/crud.ts";
export {
  exchangeCredentials,
  exchangeCredentialsFromHost,
  finishKeyExchange,
  finishKeyExchangeFromHost,
  readKeyExchangeState,
  readKeyExchangeStateFromHost,
} from "./credential/exchange.ts";
export type { CredentialPresentationUpdate } from "./credential/presentation.ts";
export { updateCredentialPresentationState } from "./credential/presentation.ts";

export type {
  AuthenticatedRequest,
  ConnectionAuthenticationResult,
  CredentialAdministrationSnapshot,
  CredentialAdministrationStateResult,
  CredentialAuthenticationResult,
  CredentialIssuanceObservation,
  CredentialManagementResult,
  InitialConnectionBinding,
  KeyExchangeCompletionResult,
  KeyExchangeObservation,
  KeyExchangeResult,
} from "./credential/types.ts";
export {
  confirmInitialConnection,
  resolveConnectionAuthentication,
} from "./initialization/connection.ts";
export {
  type HostInitializationResult,
  initializeFromHost,
} from "./initialization/execution.ts";
export {
  type HostPreviousInputObservation,
  type HostRootPreparationResult,
  prepareHostInitializationRoot,
  readExistingHostRoot,
  resolveHostRootInput,
} from "./initialization/root.ts";
export type { HostInitializationStateResult } from "./initialization/state.ts";
export { readHostInitializationState } from "./initialization/state.ts";
export type {
  CurrentAccessOutcome,
  ManagementOperationOutcome,
  ManagementPermission,
  ManagementReadKind,
  ManagementReadOutcome,
  ManagementRequest,
} from "./permission/types.ts";
export { updateExposure } from "./repository/exposure.ts";
export {
  registerRepository,
  unregisterRepository,
} from "./repository/register.ts";
export {
  resolveRepositoryAccess,
  resolveRepositoryAccessCollection,
  sameAccessCollection,
} from "./repository/resolve.ts";
export type {
  AuthorizedRepository,
  RepositoryAccess,
  RepositoryAccessCollectionResult,
  RepositoryAccessResult,
} from "./repository/types.ts";
export { updateUserRole, updateRoleContentAccess } from "./role/assign.ts";
export type { AccessRole } from "./role/types.ts";

export { registerUser, updateUserName } from "./user/crud.ts";
export { readUserStatus, type UserStatusResult } from "./user/status.ts";

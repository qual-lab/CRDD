/**
 * Access Managementの純粋判定と内部状態保存を公開する。
 *
 * @packageDocumentation
 * @responsibility 純粋判定・認証・本人／管理対象読取り・User／Role・Repository管理・提示状態の内部保存を明示公開し、鍵管理・本番入口の未接続を区別する。
 * @trace ARCH-000013
 */
export type {
  RepositoryAccess,
  RepositoryAccessResult,
  AuthorizedRepository,
  RepositoryAccessCollectionResult,
} from "./access/repository-access.ts";
export type {
  CurrentAccessResult,
  CurrentAccessSnapshot,
} from "./access/current-access.ts";
export {
  resolveAiProfileManagementAccess,
  type AiProfileManagementAccess,
} from "./access/profile-management.ts";
export type {
  ManagementReadKind,
  ManagementStateResult,
  ManagementStateSnapshot,
} from "./management/read-state.ts";
export type {
  AuthenticatedRequest,
  CredentialAuthenticationResult,
} from "./credential/authentication.ts";
export type { CredentialPresentationUpdate } from "./credential/presentation.ts";
export type {
  InitialConnectionBinding,
  ConnectionAuthenticationResult,
} from "./credential/initial-connection.ts";
export {
  createCredentialMaterial,
  type CredentialMaterial,
  readCredentialId,
  verifyCredentialToken,
} from "./credential/token-material.ts";
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
export type { HostInitializationStateResult } from "./initialization/host-state.ts";
export {
  prepareHostInitializationRoot,
  type HostRootPreparationResult,
  type HostPreviousInputObservation,
} from "./initialization/prepare-host-root.ts";
export { runHostAccessCommand } from "./initialization/host-command.ts";
export {
  initializeFromHost,
  type HostInitializationResult,
} from "./initialization/initialize-from-host.ts";
export {
  type AccessManagementState,
  type InitializationRecord,
  type KeyExchangeRecord,
  parseAccessManagementState,
  type StateParseResult,
} from "./state/parse.ts";
export {
  exchangeCredentials,
  exchangeCredentialsFromHost,
  type KeyExchangeResult,
  readCredentialIssuance,
  type CredentialIssuanceObservation,
  issueCredential,
  revokeCredential,
  type CredentialManagementResult,
  registerRepository,
  unregisterRepository,
  updateExposure,
  type RepositoryExposureManagementResult,
  registerUser,
  updateUserName,
  changeUserRole,
  updateRoleContentAccess,
  type UserRoleManagementResult,
  createInitialAdministrator,
  authenticateCredential,
  authenticateNormalConnection,
  resolveConnectionAuthentication,
  confirmInitialConnection,
  readCurrentAccess,
  readManagementState,
  resolveRepositoryAccess,
  resolveRepositoryAccessCollection,
  createInitialCredential,
  recordCredentialPresentation,
  initializeAccessManagementState,
  readAccessManagementState,
  readHostInitializationState,
  updateAccessManagementState,
  type StateStoreResult,
} from "./state/file-store.ts";

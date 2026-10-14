/**
 * Access Managementの純粋判定と内部状態保存を公開する。
 *
 * @packageDocumentation
 * @responsibility 純粋判定・現在認証・管理操作・鍵管理・Host初期化と既存保存Ownerの公開集合を固定する。
 * @trace ARCH-000013
 * @boundary 同Hostの信頼された構成側とAccess Managementの専門API境界。
 * @effect 公開した管理操作は既存Host管理Rootの状態・資格を保存し得る。Transportは所有しない。
 * @security 秘密値は明示した発行・交換結果だけへ返し、一般状態読取りへ含めない。
 */
export type {
  RepositoryAccess,
  RepositoryAccessResult,
  AuthorizedRepository,
  RepositoryAccessCollectionResult,
} from "./access/repository-access.ts";
export { sameAccessCollection } from "./access/repository-access.ts";
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
export {
  projectManagementOperationResult,
  projectManagementReadResult,
  projectCurrentAccessResult,
  type ManagementOperationOutcome,
  type ManagementReadOutcome,
  type CurrentAccessOutcome,
} from "./management/result.ts";
export type {
  AuthenticatedRequest,
  CredentialAuthenticationResult,
} from "./credential/authentication.ts";
export type { CredentialPresentationUpdate } from "./credential/presentation.ts";
export type {
  CredentialAdministrationSnapshot,
  CredentialAdministrationStateResult,
} from "./credential/management.ts";
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
  resolveHostRootInput,
  readExistingHostRoot,
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
  finishKeyExchange,
  finishKeyExchangeFromHost,
  type KeyExchangeCompletionResult,
  readKeyExchangeState,
  readKeyExchangeStateFromHost,
  type KeyExchangeObservation,
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
  readCredentialAdministrationState,
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

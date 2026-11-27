/**
 * Access Managementの認証・認可・管理操作と型付き結果を公開する。
 *
 * @packageDocumentation
 * @responsibility 純粋判定・現在認証・管理操作・管理者初期化の公開集合を固定する。
 * @trace ARCH-000013
 * @boundary 同Hostの信頼された構成側とAccess Managementの専門API境界。
 * @effect 公開した管理操作は既存Host管理Rootの状態・資格を保存し得る。Transportは所有しない。
 * @security 旧接続鍵の発行・交換・提示操作を公開しない。
 */

export { readCurrentAccess } from "./authorization/current.ts";
export {
  readManagementState,
  readManagementUsersForDisplay,
} from "./authorization/management.ts";
export {
  describeManagementPermissions,
  evaluateManagementPermission,
} from "./permission/validation.ts";
export type { AccountAccessPrincipal } from "./authorization/types.ts";
export { initializeAdministratorFromHost } from "./initialization/execution.ts";
export type { FilesystemStoreRoot } from "./initialization/root.ts";
export {
  readExistingHostRoot,
  readFilesystemStoreDirectory,
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
export {
  checkGitHostLinkedRepositoryRegistration,
  registerRepository,
  unregisterRepository,
} from "./repository/register.ts";
export {
  observeGitHostLinkedExecutionBinding,
  readGitHostLinkedAccessCandidates,
  resolveGitHostLinkedAccessCollection,
  resolveGitHostLinkedAccessDirectories,
} from "./repository/resolve.ts";
export type {
  AuthorizedRepository,
  GitHostLinkedRepository,
  GitHostLinkedAccessCandidate,
  RepositoryAccessCollectionResult,
} from "./repository/types.ts";
export { updateUserRole } from "./role/assign.ts";
export type { AccessRole } from "./role/types.ts";
export { onAccessStatePublication } from "./storage/store.ts";
export {
  registerUser,
  renewInvitation,
  updateUserName,
} from "./user/crud.ts";
export {
  acceptInvitation,
  readAccount,
  readAdministratorFromHost,
  linkAccountFromHost,
} from "./user/account-link.ts";

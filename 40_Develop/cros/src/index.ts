/**
 * CROSのWorkspace access、Federation、HandoffおよびTool Registryを提供する公開境界。
 *
 * @packageDocumentation
 * @responsibility Credential Grantから許可済みRepository集合を解決し、構造化ContextをAuthority拡大なしに搬送する。
 * @trace ARCH-000013
 * @boundary CROS SubsystemとCLI／MCP／Coordinator／Workbench利用側の公開境界。
 * @effect N/A: 公開Symbolを明示再公開するだけである。
 * @security 管理能力をContent Accessへ昇格せず、非開示RepositoryのIdentityを公開しない。
 */
export {
  executeRemoteAiProfileMutation,
  readRemoteAiProfileCatalog,
  readRemotePortfolio,
  readRemoteRuntimeActivity,
  startCrosRemoteTransport,
  type CrosRemoteTransportHandle,
} from "./connection/http.ts";
export type { CrosExposureSnapshot } from "./access/types.ts";
export type {
  CrosRemoteRuntimeActivityObservation,
  CrosRemoteRuntimeEventProjection,
  CrosRuntimeActivityReader,
} from "./activity/types.ts";
export {
  closeCrosSession,
  createContextPackage,
  createCrosSession,
  createHandoff,
  executeRepositoryLocalOperation,
  resolveAiOperatingPlan,
  resolveRepository,
  resumeHandoff,
  type ContextItem,
  type ContextPackage,
  type CrosCredential,
  type CrosExposure,
  type CrosHandoff,
  type CrosRepository,
  type CrosSession,
} from "./access/session-context.ts";
export {
  createPortfolioProjection,
  resolveAuthorizedRepositories,
  type FederatedProjectProjection,
  type FederatedProjectSource,
  type PortfolioProjection,
} from "./federation/project.ts";
export {
  executeRegisteredTool,
  inspectRegisteredTool,
  type RegisteredTool,
  type ToolImplementationResult,
  type ToolExecutionRequest,
  type ToolSurface,
} from "./tool/registry.ts";
export {
  bindOperationSurface,
  createSurfaceOperationHandler,
  settleDelegatedResult,
  type CanonicalOperationOwner,
  type DelegatedResult,
  type OperationSurface,
  type SurfaceOperationHandler,
  type SurfaceOperationRequest,
  type SurfaceOperationResult,
} from "./surface/operation.ts";
export {
  authenticateConnectionCredential,
  createMemoryConnectionCredentialRegistry,
  issueConnectionCredential,
  listConnectionCredentials,
  resolveCredentialProfileDefaults,
  revokeConnectionCredential,
  rotateConnectionCredential,
  updateConnectionCredentialAccess,
  type ConnectionCredentialAuthenticationResult,
  type ConnectionCredentialChangeResult,
  type ConnectionCredentialIssueResult,
  type ConnectionCredentialListResult,
  type ConnectionCredentialMetadata,
  type ConnectionCredentialProfile,
  type ConnectionCredentialRecord,
  type ConnectionCredentialRegistry,
  type ConnectionCredentialRegistrySnapshot,
  type ConnectionCredentialRotationResult,
  type CredentialRandomBytes,
  type RequestAccessContext,
} from "./access/credential.ts";
export {
  createCredentialRegistryFileAdapter,
  type CredentialRegistryFileAdapterResult,
} from "./access/registry-file-adapter.ts";
export {
  applyCredentialAccessRecovery,
  planCredentialAccessRecovery,
  type CredentialAccessRecoveryMode,
  type CredentialAccessRecoveryPlan,
  type CredentialAccessRecoveryPlanResult,
  type CredentialAccessRecoveryRecorder,
  type CredentialAccessRecoveryResult,
} from "./access/recovery.ts";
export {
  createCredentialAccessRecoveryFileAdapter,
  type CredentialAccessRecoveryFileAdapterResult,
} from "./access/recovery-file-adapter.ts";
export {
  runCredentialAccessRecoveryCli,
  type CredentialAccessRecoveryCliIo,
} from "./access/recovery-cli.ts";
export {
  readCrosSharedServerOperationalConfig,
  type CrosSharedServerOperationalConfig,
} from "./configuration/shared-server-file-adapter.ts";

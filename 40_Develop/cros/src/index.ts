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
  type CrosExposureSnapshot,
  type CrosRemoteRuntimeActivityObservation,
  type CrosRemoteRuntimeEventProjection,
  type CrosRemoteTransportHandle,
  type CrosRuntimeActivityReader,
} from "./remote-transport.ts";
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
} from "./runtime.ts";
export {
  createPortfolioProjection,
  resolveAuthorizedRepositories,
  type FederatedProjectProjection,
  type FederatedProjectSource,
  type PortfolioProjection,
} from "./project-federation.ts";
export {
  executeRegisteredTool,
  inspectRegisteredTool,
  type RegisteredTool,
  type ToolImplementationResult,
  type ToolExecutionRequest,
  type ToolSurface,
} from "./tool-registry.ts";
export {
  bindOperationSurface,
  createSurfaceApplicationContract,
  settleDelegatedResult,
  type CanonicalOperationOwner,
  type DelegatedResult,
  type OperationSurface,
  type SurfaceApplicationContract,
  type SurfaceOperationRequest,
  type SurfaceOperationResult,
} from "./application-contract.ts";
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
} from "./connection-credential.ts";
export {
  createCredentialRegistryFileAdapter,
  type CredentialRegistryFileAdapterResult,
} from "./credential-registry-file-adapter.ts";
export {
  applyCredentialAccessRecovery,
  planCredentialAccessRecovery,
  type CredentialAccessRecoveryMode,
  type CredentialAccessRecoveryPlan,
  type CredentialAccessRecoveryPlanResult,
  type CredentialAccessRecoveryRecorder,
  type CredentialAccessRecoveryResult,
} from "./credential-access-recovery.ts";
export {
  createCredentialAccessRecoveryFileAdapter,
  type CredentialAccessRecoveryFileAdapterResult,
} from "./credential-access-recovery-file-adapter.ts";
export {
  runCredentialAccessRecoveryCli,
  type CredentialAccessRecoveryCliIo,
} from "./credential-access-recovery-cli.ts";
export {
  readCrosSharedServerOperationalConfig,
  type CrosSharedServerOperationalConfig,
} from "./shared-server-config-file-adapter.ts";

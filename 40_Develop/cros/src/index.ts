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
  createFileCanonicalOperationOwner,
  resumeDurableHandoff,
  settleDurableDelegatedResult,
  writeDurableHandoff,
} from "./durable-store.ts";

/**
 * Domain Modelの宣言済みCapabilityを公開するPackage境界。
 * @packageDocumentation
 * @responsibility 共通結果、成果物、Repository観測、RelationおよびTraceabilityの公開Symbolを実責務Fileから明示exportする。
 * @trace ARCH-000008
 * @boundary Repository観測Capabilityを利用側へ限定公開するPackage境界。
 * @effect Moduleの公開だけで操作は実行しない。公開操作の呼出しでは、各Ownerの契約に従いRepository読取り、認可済みCRUD、用途限定保存・排他・回収を行い得る。
 * @security Rootへの集約はAuthorityを追加せず、各実体の入力検証・Repository範囲・非公開内部操作の境界を維持する。
 */
export {
  type DomainIssue,
  type DomainLocation,
  type DomainOutcome,
  type DomainStatus,
  validateDomainOutcome,
} from "./outcome.ts";
export type {
  TopicState,
  TopicRecord,
  TopicPromotion,
  TopicOperations,
} from "./topic/types.ts";
export {
  parseTopicMarkdown,
  applyTopicPromotion,
} from "./topic/markdown.ts";
export { createTopicOperations } from "./topic/create-operations.ts";
export type {
  TopicMeetingAccess,
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingRelation,
  TopicMeetingWriteResult,
  TopicMeetingRepository,
  TopicMeetingListResult,
  TopicPromotionCommandResult,
  TemporaryEvidencePromotionReceipt,
  TemporaryOperationCapability,
  TemporaryOperationRecoveryReference,
  MeetingOutcomeCommandResult,
  MeetingOutcomeTarget,
} from "./storage/types.ts";
export {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data/snapshot.ts";
export {
  createFilesystemStoreRoot,
  type FilesystemStoreLockOwnerAbsenceProof,
  type FilesystemStoreRoot,
  observeFilesystemStoreLockOwnerAbsence,
  recoverFilesystemStoreLock,
  resolveFilesystemStorePath,
  withFilesystemStoreLock,
} from "./storage/root-and-lock.ts";
export {
  createCoordinatorRuntimeDataArea,
  ensureRepositoryRuntimeDataArea,
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
} from "./storage/ensure-area.ts";
export {
  createTemporaryOperation,
  resumeTemporaryOperation,
  settleTemporaryOperation,
  verifyTemporaryOperationEvidencePromotion,
} from "./storage/temporary-operation.ts";
export {
  readStableBoundedFileSnapshot,
  sameStableFileIdentity,
  type StableFileIdentity,
} from "./storage/bounded-file-snapshot.ts";
export type {
  MeetingState,
  MeetingRecord,
  MeetingOutcomeDisposition,
  MeetingOutcomeTreatment,
  MeetingOperations,
} from "./meeting/types.ts";
export {
  parseMeetingMarkdown,
  applyMeetingOutcomeTreatment,
} from "./meeting/markdown.ts";
export { createMeetingOperations } from "./meeting/create-operations.ts";
export {
  CROS_DIRECTORY_ID,
  CROS_TRUST_POLICY_SCHEMA,
  REPOSITORY_MANIFEST_SCHEMA,
  inspectCrosTrustPolicy,
  inspectRepositoryManifest,
} from "./configuration/validate-declarations.ts";
export {
  EXTERNAL_SEND_POLICY_RELATIVE_PATH,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
  TESTS_RELATIVE_PATH,
} from "./configuration/storage-paths.ts";
export {
  readOrchestratorConfig,
  readExecutionIntelligenceConfig,
  readCoordinatorConfig,
} from "./configuration/read-tool-config.ts";
export type {
  RepositoryManifest,
  CrosTrustPolicy,
  ToolRuntimeConfig,
  ToolRuntimeConfigResult,
} from "./configuration/types.ts";
export type {
  ArtifactModel,
  ArtifactRelation,
  ArtifactSection,
  ArtifactSource,
  ChecklistResult,
  SourceLocation,
} from "./artifact/types.ts";
export {
  type ArtifactGraph,
  type ArtifactGraphResult,
  type BuildArtifactGraphRequest,
  buildArtifactGraph,
} from "./artifact/graph.ts";
export { parseMarkdownArtifact } from "./artifact/parse-markdown.ts";
export {
  type ArtifactSchema,
  type ArtifactSchemaValidationResult,
  validateArtifactSchema,
} from "./artifact/validate-schema.ts";
export type {
  RepositoryDirectoryEntry,
  RepositoryDirectoryObservation,
  RepositoryEntryKind,
  RepositoryFileObservation,
  RepositoryObservationPort,
  RepositoryRootCapability,
  RepositoryRuntimeArea,
  RepositoryRuntimeDataAreaObservation,
  CrosRootInput,
} from "./repository/types.ts";
export { createFilesystemRepositoryObservationPort } from "./repository/create-observer.ts";
export {
  resolveRepositoryRuntimeDataPaths,
  resolveRepositoryRuntimeDataPathsFromWorkingDirectory,
  observeRepositoryRuntimeDataArea,
  resolveCrosRuntimeRoots,
} from "./repository/resolve-storage-paths.ts";
export {
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
} from "./repository/require-storage-area.ts";
export {
  type RealityRepositoryObservationIssue,
  type RealitySymbolRepositoryObservation,
  observeRealitySymbolRepository,
} from "./repository/observe-symbols.ts";
export {
  realitySymbolKinds,
  type LoadedRealitySymbolManifest,
  type RealitySymbol,
  type RealitySymbolKind,
  type RealitySymbolManifest,
} from "./reality-traceability/manifest.ts";
export {
  type RealitySymbolGraph,
  type RealitySymbolNode,
  createRealitySymbolGraph,
} from "./reality-traceability/graph.ts";
export { validateRealitySymbolManifest } from "./reality-traceability/validate-manifest.ts";
export {
  type RealitySymbolDiscoveryRequest,
  type RealitySymbolDiscoveryResult,
  type RealitySymbolDiscoverySource,
  discoverRealitySymbols,
} from "./reality-traceability/discover.ts";
export {
  applyProjectOperationCandidateDecision,
  projectProjectOperationSources,
} from "./project-context/source-projection.ts";
export { parseRepositoryProjectContextMarkdown } from "./project-context/parse-context.ts";
export { parseRepositoryReleaseProjectionMarkdown } from "./project-context/parse-release.ts";
export { parseRepositoryQualityProjectionMarkdown } from "./project-context/parse-quality.ts";
export type {
  ProjectOperationCandidate,
  ProjectOperationCandidateDecision,
  ProjectOperationCandidateDecisionResult,
  ProjectOperationProjection,
  ProjectOperationProjectionItem,
  ProjectOperationSource,
  ProjectOperationSourceState,
  RepositoryProjectContext,
  RepositoryProjectContextScene,
  RepositoryProjectContextSceneKey,
  RepositoryProjectContextTable,
  RepositoryReleaseDependency,
  RepositoryReleaseProjection,
  RepositoryReleaseScope,
  RepositoryQualityProjection,
} from "./project-context/types.ts";
export {
  fixQualityCandidate,
  integrateQualityGate,
  reenterQualityReview,
  type FixedQualityCandidate,
  type IntegratedQualityGate,
  type QualityCheckResult,
  type QualityCheckStatus,
} from "./quality-change-control/gate.ts";

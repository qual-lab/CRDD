/**
 * Domain Modelの宣言済みCapabilityを公開するPackage境界。
 * @packageDocumentation
 * @responsibility 共通結果、成果物、Repository観測、RelationおよびTraceabilityの公開Symbolを実責務Fileから明示exportする。
 * @trace ARCH-000008
 * @boundary Repository観測Capabilityを利用側へ限定公開するPackage境界。
 * @effect Moduleの公開だけで操作は実行しない。公開操作の呼出しでは、各Ownerの契約に従いRepository読取り、認可済みCRUD、用途限定保存・排他・回収を行い得る。
 * @security Rootへの集約はAuthorityを追加せず、各実体の入力検証・Repository範囲・非公開内部操作の境界を維持する。
 */
export { parseUnambiguousJsonDocument } from "./plain-data/json.ts";
export type {
  CoordinatorAcceptanceTarget,
  CoordinatorAcceptanceDecision,
  CoordinatorAcceptanceDecisionInput,
  CoordinatorAcceptanceDecisionRecord,
  CoordinatorAcceptanceDecisionEnvelope,
  CoordinatorDecisionRecord,
  CoordinatorDecisionRecoveryIntent,
} from "./decision/types.ts";
export {
  COORDINATOR_ACCEPTANCE_DECISION_STORE_CONTRACT,
  isCoordinatorDecisionRecord,
  validCoordinatorAcceptanceDecisionRecord,
  validCoordinatorDecisionRecoveryIntent,
} from "./decision/validation.ts";
export {
  validateAiSelectionConfig,
  type AiSelectionConfigResult,
} from "./ai-selection/validation.ts";
export type {
  AiSelectionCatalog,
  AiSelectionRole,
  AiSelectionChoice,
  AiSelectionConfig,
  AiSelectionSnapshot,
} from "./ai-selection/types.ts";
export {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
  type AiSelectionReadResult,
  type AiSelectionSaveResult,
  type AiSelectionTemporaryReference,
} from "./storage/ai-selection.ts";
export { normalizeRepositoryRelativePath } from "./repository/path.ts";
export {
  inspectExecutionPlan,
  type ExecutionPlanScope,
} from "./objective/validation.ts";
export { inspectCallerTaskInputs } from "./objective/validation.ts";
export type { ProjectTaskDefinition, CallerTaskInput } from "./task/types.ts";
export type {
  CoordinatorObjectivePlan,
  ProjectObjectiveState,
  ProjectMilestoneState,
  ProjectObjectiveDefinition,
  ProjectObjectiveRecord,
  ProjectMilestoneRecord,
} from "./objective/types.ts";
export {
  type DomainIssue,
  type DomainLocation,
  type DomainOutcome,
  type DomainStatus,
  validateDomainOutcome,
} from "./outcome.ts";
export {
  compileSemanticIr,
  type SemanticIr,
  type SemanticIrMeaning,
  type SemanticSourceDocument,
} from "./semantic/ir.ts";
export {
  compileQualitySemanticRelations,
  type QualitySemanticRelation,
} from "./semantic/relations.ts";
export {
  createSemanticBundle,
  createSemanticCoverageGraph,
  type SemanticBundleContent,
  type SemanticCoverageBundle,
  type SemanticCoverageGraph,
  type SemanticCoverageProjection,
} from "./semantic/coverage.ts";
export {
  publishSemanticCoverage,
  type PublishSemanticCoverageRequest,
  type PublishSemanticCoverageResult,
} from "./semantic/publish.ts";
export {
  createFilesystemSemanticBundlePublisher,
  type SemanticBundlePublisher,
  type SemanticBundlePublishReceipt,
  type SemanticBundlePublishRequest,
} from "./storage/semantic-store.ts";
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
export {
  federateTopicMeetingRelations,
  type TopicMeetingRelationSource,
} from "./activity/federate-relations.ts";
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
  MeetingOutcomeCommandResult,
  MeetingOutcomeTarget,
} from "./activity/types.ts";
export type {
  TemporaryEvidencePromotionReceipt,
  TemporaryOperationCapability,
  TemporaryOperationRecoveryReference,
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
  checkRepositoryRuntimeDataProtectionDirectory,
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
export {
  readRuntimeStateFile,
  createRuntimeStatePendingFile,
  flushRuntimeStateFile,
  classifyRuntimeSnapshotReentry,
  type RuntimeStateFileName,
  type RuntimeStatePendingFileName,
} from "./storage/state.ts";
export {
  RUNTIME_STATE_MAXIMUM_BYTES,
  encodeRuntimeStateValue,
  hashRuntimeStateContent,
} from "./state/codec.ts";
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
  ChecklistFailure,
  ChecklistResult,
  MarkdownFence,
  MarkdownFenceLine,
  MarkdownLinkReference,
  SourceLocation,
  UxFormalInputTarget,
} from "./artifact/types.ts";
export {
  type ArtifactGraph,
  type ArtifactGraphResult,
  type BuildArtifactGraphRequest,
  buildArtifactGraph,
} from "./artifact/graph.ts";
export {
  parseMarkdownAnchors,
  omitMarkdownFencedCode,
} from "./artifact/anchors.ts";
export {
  omitMarkdownCommentsAndFencedCode,
  omitMarkdownCommentsOutsideFencedCode,
  parseMarkdownTableRow,
  isMarkdownTableSeparator,
  readCanonicalDocumentHeader,
  parseMarkdownFences,
} from "./artifact/markdown.ts";
export {
  parseMarkdownLinkTargets,
  parseMarkdownLinkReference,
} from "./artifact/links.ts";
export { parseUxFormalInputTargets } from "./artifact/ux-inputs.ts";
export { parseMarkdownArtifact } from "./artifact/parse-markdown.ts";
export { inspectQualityDesignStates } from "./artifact/quality-state.ts";
export {
  inspectPhaseDiagramTemplates,
  phaseDiagramTemplatePaths,
} from "./artifact/phase-diagrams.ts";
export {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "./artifact/checklist.ts";
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
export { applyProjectOperationCandidateDecision } from "./project-context/candidate-decision.ts";
export { validateTopicMeetingListInput } from "./activity/operations.ts";
export { projectProjectOperationSources } from "./project-context/source-projection.ts";
export { parseRepositoryProjectContextMarkdown } from "./project-context/parse-context.ts";
export { readRepositoryProjectContext } from "./project-context/read-context.ts";
export type { RepositoryProjectContextReadResult } from "./project-context/types.ts";
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
export {
  createPortfolioProjection,
  type ProjectContextSource,
  type FederatedProjectSource,
  type FederatedProjectProjection,
  type PortfolioProjection,
} from "./project-context/portfolio.ts";
export {
  testLevels,
  type TestLevel,
  type TestCatalogEntry,
  type TestCatalog,
  type ResourceIntensiveTestAuthority,
  discoverRepositoryTestFiles,
  loadTestCatalog,
  inspectTestCatalog,
  inspectResourceIntensiveTestAuthority,
  selectRegressionStaticOwners,
  selectRegressionTests,
} from "./test-catalog/inspect.ts";
export {
  regressionStageOrder,
  type RegressionStage,
  type RegressionExecutionStep,
  type RegressionStageResult,
  type RegressionAggregateResult,
  type RegressionPlanEntry,
  type RegressionStagePlan,
  buildRegressionStagePlan,
  aggregateRegressionStageResults,
  normalizeExplicitChangedPaths,
} from "./test-catalog/plan.ts";
export {
  isProjectContextProjectionInvalid,
  isProjectContextManifestIdentityInvalid,
} from "./project-context/inspect.ts";

export { createPhaseChecklistItems } from "./artifact/phase-checklists.ts";
export { inspectArtifactSources } from "./artifact/inspect.ts";

export { hasSkippedTestDeclaration } from "./reality-traceability/test-source.ts";

export {
  isUxHandoffTargetSetExact,
  isUxRootHandoffValid,
} from "./artifact/ux-handoff.ts";

export {
  parseIaIndex,
  inspectIaAnalysis,
  inspectIaDefinition,
  inspectIaAnalysisCoverage,
  inspectIaIndexCoverage,
  inspectIaCrossProjection,
  inspectIaRelations,
  type IaIndexModel,
  type IaAnalysisModel,
  type IaDefinitionModel,
} from "./artifact/ia.ts";

export {
  parseUiIndex,
  inspectUiDetail,
  inspectUiAnalysis,
  inspectUiDefinition,
  inspectUiAnalysisCoverage,
  inspectUiIndexCoverage,
  inspectUiRelations,
  type UiRelationsModel,
  type UiIndexModel,
} from "./artifact/ui.ts";

export { inspectRealityTestCatalog } from "./reality-traceability/catalog.ts";

export {
  inspectChangeDocument,
  isChangeTemplateInvalid,
  isChangeNavigationInvalid,
} from "./artifact/change.ts";

export {
  inspectUxDefinition,
  inspectUxAnalysis,
  inspectUxFormalInput,
  inspectUxRelations,
  parseUxIndex,
  isUxProjectionIncomplete,
  parseUxJourneyRelations,
  type UxIndexModel,
  type UxAnalysisModel,
  type UxFormalInputObservation,
} from "./artifact/ux.ts";

export {
  inspectDiscoveryDefinition,
  inspectDiscoveryAnalysis,
  parseAdoptedDiscoveryRequirements,
} from "./artifact/discovery.ts";

export {
  inspectSpecAnalysis,
  inspectSpecAnalysisCoverage,
  inspectSpecDefinitionCoverage,
  inspectSpecCoverage,
  parseUiSpecPairs,
  inspectUiSpecRelations,
  inspectSpecDefinition,
  parseSpecIndex,
  type SpecAnalysisModel,
  type SpecDefinitionModel,
  type SpecIndexModel,
} from "./artifact/spec.ts";

export {
  inspectSpecDetailIndex,
  inspectSpecDetailCorrespondence,
  parseUiDetailBindings,
  parseSpecScreenRelations,
} from "./artifact/spec-details.ts";

export {
  parseSpecDetailDefinitionOwnership,
  parseSpecDetailAreaOwnership,
  parseSpecDetailCentralTrace,
  inspectSpecDetailDownstream,
  type SpecDetailDefinitionOwnership,
  type SpecDetailAreaOwnership,
  type SpecDetailCentralTrace,
  type SpecDetailDownstreamRequest,
} from "./artifact/spec-details.ts";

export {
  parseSpecCorrespondenceRevision,
  parseSpecCorrespondencePair,
  inspectSpecCorrespondencePairEvidence,
  inspectSpecCorrespondence,
  type SpecCorrespondencePair,
} from "./artifact/spec-correspondence.ts";

export {
  inspectArchitectureCrossModelIndex,
  inspectArchitectureCrossModel,
  type ArchitectureCrossModelIndex,
  inspectArchitectureAnalysis,
  inspectArchitectureDefinition,
  inspectArchitectureDetailTemplate,
  type ArchitectureBodyModel,
} from "./artifact/architecture.ts";

export {
  inspectArchitectureDetailMap,
  inspectArchitectureDetail,
  inspectArchitectureDetailCoverage,
  type ArchitectureDetailMapModel,
  type ArchitectureDetailModel,
  type ArchitectureDetailCoverageRequest,
} from "./artifact/architecture-details.ts";

export {
  inspectArchitectureAnalysisCoverage,
  parseArchitectureRegistry,
  inspectArchitectureRegistryCoverage,
  inspectArchitectureComponentCoverage,
  inspectArchitectureRelations,
  type ArchitectureRegistryModel,
  type ArchitectureAnalysisCoverageRequest,
  type ArchitectureRelationsRequest,
} from "./artifact/architecture-relations.ts";

export {
  inspectQualityDefinition,
  inspectQualityLocalItemOwnership,
  type QualityDefinitionModel,
  type QualityLocalItemOwnershipModel,
} from "./artifact/quality-definition.ts";

export {
  inspectQualityCenterState,
  inspectQualityRealityState,
} from "./artifact/quality-readiness.ts";

export {
  inspectQualityAnalysis,
  inspectQualityCrossModelGoals,
  inspectQualityDetailUnits,
} from "./artifact/quality-analysis.ts";

export {
  inspectQualityDefinitionRelations,
  inspectQualityLocalItemRelations,
  inspectQualityGoalLocalRelations,
  parseQualityDetailHandoff,
} from "./artifact/quality-relations.ts";

export {
  isQualityVerificationResultTemplateInvalid,
  isQualityAnalysisTemplateInvalid,
  isQualityIntegrationTemplateInvalid,
} from "./artifact/quality-templates.ts";

export {
  inspectBranchCoverageTable,
  inspectRemediationTable,
} from "./artifact/verification-tables.ts";

export { inspectRelatedOrder } from "./artifact/document-header.ts";

export { inspectChangelogRelease } from "./artifact/release.ts";

export { hasQualityOpenChecklist } from "./artifact/quality-readiness.ts";

export { parseQualityCoverageSections } from "./artifact/quality-analysis.ts";

export { isQualityLocalItemCountInvalid } from "./artifact/quality-relations.ts";

export {
  parseCandidateVersionHeader,
  parseReadmeVersion,
  inspectCanonicalDocumentVersions,
} from "./artifact/release.ts";

export {
  inspectDiscoveryIdentityLinks,
  inspectStableIdentityDefinitions,
} from "./artifact/identity.ts";

export {
  inspectStableCanonicalDocuments,
  inspectStableReadme,
  inspectStableChangelog,
  inspectStableReleaseHeader,
} from "./artifact/release.ts";

export { parseCanonicalReleaseHeader } from "./artifact/document-header.ts";
export {
  prepareCoordinatorUnifiedTaskSnapshot,
  hasProjectTaskResultAcceptanceConflict,
  normalizeCoordinatorTaskProjects,
} from "./task/crud.ts";
export {
  validateCoordinatorUnifiedTransition,
  assertCoordinatorSnapshotTransition,
  coordinatorQueueIsClosed,
  coordinatorAdoptionWasRejected,
  coordinatorRejectedAdoptionEvidenceCanRetire,
  coordinatorStandaloneAdoptionIsClosed,
  type CoordinatorSnapshotObservations,
  coordinatorSnapshotIntakeMatches,
} from "./state/transition.ts";
export { parseChangeTraceHeader } from "./artifact/change.ts";
export {
  getJsonCommitName,
  readCommittedJson,
  writeCommittedJson,
  removeCommittedJson,
} from "./storage/committed-json.ts";
export type { NetworkPolicy } from "./configuration/network-policy.ts";
export {
  readNetworkPolicy,
  type NetworkPolicyReadResult,
} from "./storage/network-policy.ts";
export {
  parseStableIdentityOccurrences,
  inspectStableIdentityOwnership,
} from "./artifact/identity.ts";
export {
  SECRET_MATERIAL_POLICY_CONTRACT,
  SECRET_MATERIAL_POLICY_CONTRACT_REVISION,
  containsRecognizedSecretText,
  isRecognizedSecretBearingPath,
  containsRecognizedSecretScope,
  containsRecognizedSecretMaterial,
  describeSecretMaterialPolicyContract,
} from "./plain-data/secret-validation.ts";

export {
  decodeRuntimeDomainSnapshot,
  prepareCoordinatorStateHistoryLine,
  hashRuntimeProjectDefinition,
  isSha256Hex,
  exactRecordKeys as hasRuntimeStateRecordKeys,
  projectCoordinatorTaskSettlement,
  validId,
  validCoordinatorTaskState,
  COORDINATOR_STATE_CONTRACT,
  COORDINATOR_STATE_SCHEMA,
  coordinatorOperationSummaryBytes,
  coordinatorHistoryLineBytes,
  snapshotPlainRecord as snapshotRuntimeStateRecord,
  plainObject as isRuntimeStateObject,
  exactKeys as hasRuntimeStateKeys,
  COORDINATOR_DURABLE_FOUNDATION_CONTRACT,
  validLeaseEvidence,
  digest as hashRuntimeStateValueText,
  leaseIdentity,
  leaseAcquisitionRecoveryId,
  historyRow,
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  snapshotPlainArray as snapshotRuntimeStateArray,
  validResultReference,
} from "./state/validation.ts";

export type {
  CoordinatorUnifiedSnapshot,
  RuntimeDomainSnapshot,
  RuntimeProjectDefinition,
  RuntimeManagedExecution,
  CoordinatorState,
  CoordinatorStoredTask,
  CoordinatorSnapshot,
  CoordinatorStateSnapshot,
  CoordinatorTaskSettlementFact,
  LeaseEvidenceEnvelope,
  Envelope as RuntimeStateEnvelope,
  LeaseEvidenceContent,
  HistoryRow,
  LeaseKind,
  CoordinatorLeaseKind,
} from "./state/types.ts";

export {
  validCoordinatorRepairOperation,
  coordinatorOperationNonce,
  parseDockerTaskRecoveryId,
  decodeDockerRestartCheckpoint,
  createDockerRestartRequestId,
  isDockerRestartCheckpointSettled,
  purposeResource,
  parseHostRecoveryToken,
  validateHostRecoveryTransitionLineage,
  validCoordinatorPrimaryFailure,
  validCoordinatorOutcome,
  coordinatorTaskResourcesAreSettled,
  validCoordinatorRepairRetentionReceipt,
  coordinatorRepairRetentionMatchesCheckpoint,
  coordinatorRepairCanSummarize,
  coordinatorRepairCanComplete,
  coordinatorRepairSummaryBytes,
  coordinatorRepairHistoryLineBytes,
  dockerProcessControllerPublicCompletionReasons,
  coordinatorAuthenticationClosureEvidence,
  validCoordinatorRepairSummary,
  PROVIDER_ADVICE_OUTPUT_REASONS,
  coordinatorAuthenticationUnknownCanClose,
} from "./attempt/validation.ts";

export type {
  ProjectResultAcceptance,
  ProjectTaskRecord,
  ProjectTaskResultFact,
  ProjectTaskRecoveryObligation,
  ProjectTaskState,
  ProjectTaskStartPhase,
  ProjectTaskRecoveryKind,
  ProjectDockerRecoveryAcknowledgement,
  ProjectQueueEntry,
  SingleTaskRecord,
  ProjectQueueState,
} from "./task/types.ts";

export {
  decodeProjectResultAcceptance,
  validCoordinatorState,
  validQueueEntry,
  coordinatorConsumerCompletionPolicy,
  inspectSingleTaskRecord,
} from "./task/validation.ts";

export type {
  CoordinatorStateTaskOperation,
  CoordinatorStateRepairOperation,
  CoordinatorStateOperation,
  DockerRestartCheckpoint,
  ProviderTurnCountDiagnostic,
  CoordinatorRepairRetentionReceipt,
} from "./attempt/types.ts";

export type {
  TaskExecutionSelections,
  ExecutionSelection,
  AiModelSelection,
  AiProvider,
  AiReasoningEffort,
} from "./ai-selection/types.ts";

export type {
  DockerRuntimeRepairCheckpoint,
  DockerRuntimeRepairDisposalCheckpoint,
  DockerRuntimeRepairRetentionTargets,
} from "./attempt/repair-types.ts";

export {
  validCoordinatorWorkspace,
  validCoordinatorResultRecord,
  validWorkspaceDisplayName,
  COORDINATOR_INTEGRATION_CONTRACT,
  validWorkspaceCandidateRequest,
  isWorkspaceCommitId,
} from "./workspace/validation.ts";

export type {
  CoordinatorWorkspace,
  CoordinatorResultRecord,
  CoordinatorWorkspaceCandidate,
  RepositoryWorktreeResult,
  WorkspaceCandidateRequest,
  WorkspaceCandidateResult,
  RepositoryWorktreeObservation,
  WorkspaceCandidateSelection,
  WorkspaceCandidateTemporary,
} from "./workspace/types.ts";

export {
  decodeDockerRuntimeRepairCheckpoint,
  decodeDockerRuntimeRepairDisposalCheckpoint,
  dockerRuntimeRepairDisposalIsSettled,
  dockerRuntimeRepairCheckpointIsSettled,
  actions as RUNTIME_REPAIR_ACTIONS,
  directories as RUNTIME_REPAIR_DIRECTORIES,
  decodeDockerRuntimeRepairRetentionTargets,
} from "./attempt/repair-validation.ts";

export {
  inspectExecutionSelection,
  inspectTaskExecutionSelections,
} from "./ai-selection/validation.ts";

export {
  decodeCoordinatorHistoryRows,
  prepareCoordinatorHistoryRetention,
} from "./state/history.ts";

export {
  prepareCoordinatorAuthenticationUnknownClosureSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateRepairSnapshot,
  prepareCoordinatorStateRepairCheckpointSnapshot,
  prepareCoordinatorStateRepairSessionSnapshot,
  prepareCoordinatorStateRepairRetentionHandoffSnapshot,
  validateCoordinatorStateRepairRetentionHandoffTransition,
  validateCoordinatorStateRepairSessionTransition,
  prepareCoordinatorStateRepairDisposalDecisionSnapshot,
  prepareCoordinatorStateRepairDisposalProgressSnapshot,
  validateCoordinatorStateRepairDisposalTransition,
  classifyCoordinatorRepairPublication,
  prepareCoordinatorStateResourceSnapshot,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateLifecycleSnapshot,
  prepareCoordinatorStateRestartSnapshot,
  prepareCoordinatorStateCleanupSnapshot,
  prepareCoordinatorStateReferencesSnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
  prepareCoordinatorRepairHistorySummary,
  prepareCoordinatorRepairHistorySnapshot,
  prepareCoordinatorRepairHistoryLine,
  prepareCoordinatorRepairHistoryPublication,
  prepareCoordinatorRecoveredHistoryPublication,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateRepairCompletionSnapshot,
  validateCoordinatorStateTransition,
  classifyCoordinatorResourcePublication,
} from "./state/crud.ts";

export {
  projectCoordinatorTaskSnapshot,
  prepareCoordinatorUnifiedTaskSections,
} from "./task/crud.ts";

export { validCoordinatorSnapshot } from "./state/validation.ts";

export {
  prepareDockerRuntimeRepairSessionCheckpoint,
  validateDockerRuntimeRepairCheckpointTransition,
} from "./attempt/repair-validation.ts";

/**
 * document-modelの完成操作と値契約を公開する。
 * @responsibility モデル固有の責務だけを公開し、他モデルを再exportしない。
 * @trace ARCH-000008
 * @boundary 他モデルへの直接依存を持たないPackage境界。
 */
export {
  federateTopicMeetingRelations,
  type TopicMeetingRelationSource,
} from "./activity/federate-relations.ts";
export {
  readTopicMeetingList,
  recordListQueryConstraints,
  type TopicMeetingListReadResult,
} from "./activity/operations.ts";
export type {
  MeetingOutcomeCommandResult,
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  TopicMeetingAccess,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingPage,
  TopicMeetingRelation,
  TopicMeetingWriteResult,
  TopicPromotionCommandResult,
} from "./activity/types.ts";
export {
  parseArchitectureAnalysis,
  parseArchitectureCrossModel,
  parseArchitectureDefinition,
  parseArchitectureDetail,
  parseArchitectureDetailMap,
  parseArchitectureIndex,
} from "./architecture/parse.ts";
export {
  type ArchitectureConsistencyRequest,
  inspectArchitectureConsistency,
} from "./architecture/relations.ts";
export type {
  ArchitectureAnalysis,
  ArchitectureCrossModel,
  ArchitectureDefinition,
  ArchitectureDetailMapModel,
  ArchitectureDetailModel,
  ArchitectureIndex,
} from "./architecture/types.ts";
export { inspectArtifactPlacement } from "./artifact/identity.ts";
export { parseMarkdownLinkReference } from "./artifact/links.ts";
export { parseArtifact } from "./artifact/parse-markdown.ts";
export type {
  ArtifactModel,
  ArtifactSource,
  DocumentIssue,
  MarkdownLinkReference,
  ParseResult,
  SourceLocation,
} from "./artifact/types.ts";
export {
  parseChangeDocument,
  parseChangeIndex,
} from "./change/parse.ts";
export type {
  ChangeDocument,
  ChangeIndex,
} from "./change/types.ts";
export {
  inspectChangeNavigation,
  inspectChangePlacement,
} from "./change/validation.ts";
export {
  type CommunicationDocument,
  parseCommunication,
} from "./communication/parse.ts";
export {
  parseDiscoveryAnalysis,
  parseDiscoveryDefinition,
  parseDiscoveryIndex,
} from "./discovery/parse.ts";
export type {
  DiscoveryAnalysis,
  DiscoveryDefinition,
  DiscoveryIndex,
} from "./discovery/types.ts";
export {
  inspectDiscoveryCoverage,
  parseDiscoveryReferences,
} from "./discovery/validation.ts";
export {
  parseIaAnalysis,
  parseIaDefinition,
  parseIaIndex,
  parseIaObjectRelation,
  parseIaStateVisibility,
  parseIaStructureNavigation,
} from "./ia/parse.ts";
export type {
  IaAnalysisModel,
  IaConsistencyRequest,
  IaDefinitionModel,
  IaIndexModel,
  IaObjectRelation,
  IaStateVisibility,
  IaStructureNavigation,
} from "./ia/types.ts";
export { inspectIaConsistency } from "./ia/validation.ts";
export { createMeetingOperations } from "./meeting/create-operations.ts";
export { parseMeetingMarkdown } from "./meeting/parse.ts";
export type {
  MeetingOperations,
  MeetingRecord,
  MeetingState,
} from "./meeting/types.ts";
export { applyProjectOperationCandidateDecision } from "./project-context/candidate-decision.ts";
export { parseRepositoryProjectContextMarkdown } from "./project-context/parse.ts";
export {
  createPortfolioProjection,
  type FederatedProjectProjection,
  type FederatedProjectSource,
  type PortfolioProjection,
  type ProjectContextSource,
} from "./project-context/portfolio.ts";
export { readRepositoryProjectContext } from "./project-context/read-context.ts";
export { projectProjectOperationSources } from "./project-context/source-projection.ts";
export type {
  ProjectOperationCandidate,
  ProjectOperationCandidateDecision,
  ProjectOperationCandidateDecisionResult,
  ProjectOperationProjection,
  ProjectOperationSource,
  RepositoryProjectContext,
  RepositoryProjectContextReadResult,
} from "./project-context/types.ts";
export {
  parseQualityAnalysis,
  parseQualityCenter,
  parseQualityDefinition,
  parseQualityDetailAnalysis,
  parseQualityIntegration,
  parseQualityRealityAudit,
  parseQualityStrategy,
  parseQualityTables,
  parseQualityVerificationDesign,
  parseQualityVerificationResult,
} from "./quality/parse.ts";
export type {
  QualityAnalysis,
  QualityCenter,
  QualityConsistencyRequest,
  QualityDefinitionModel,
  QualityDetailAnalysis,
  QualityIntegration,
  QualityLocalItemOwnershipModel,
  QualityRealityAudit,
  QualityStrategy,
  QualityTables,
  QualityVerificationDesign,
  QualityVerificationResult,
  RepositoryQualityProjection,
} from "./quality/types.ts";
export {
  inspectQualityAnalysis,
  inspectQualityConsistency,
  inspectQualityLocalItemOwnership,
} from "./quality/validation.ts";
export { parseRepositoryReleaseProjectionMarkdown } from "./release/parse.ts";
export type { RepositoryReleaseProjection } from "./release/types.ts";
export {
  type FixedQualityCandidate,
  fixQualityCandidate,
  type IntegratedQualityGate,
  integrateQualityGate,
  type QualityCheckResult,
  type QualityCheckStatus,
  reenterQualityReview,
} from "./quality-change-control/gate.ts";
export {
  parseRealityTestCatalog,
  type RealityTestCatalog,
} from "./reality-traceability/catalog.ts";
export {
  discoverRealitySymbols,
  type RealitySymbolDiscoveryRequest,
  type RealitySymbolDiscoveryResult,
  type RealitySymbolDiscoverySource,
} from "./reality-traceability/discover.ts";
export {
  createRealitySymbolGraph,
  type RealitySymbolGraph,
} from "./reality-traceability/graph.ts";
export type {
  LoadedRealitySymbolManifest,
  RealitySymbolManifest,
} from "./reality-traceability/manifest.ts";
export { parseRealitySymbolManifest } from "./reality-traceability/manifest.ts";
export {
  parseCanonicalDocument,
  parseChangelog,
  parseReadme,
} from "./release/parse.ts";
export type {
  CanonicalDocument,
  Changelog,
  Readme,
  ReleaseConsistencyRequest,
} from "./release/types.ts";
export {
  inspectReleaseConsistency,
  inspectReleaseDocuments,
} from "./release/validation.ts";
export { createFilesystemRepositoryObservationPort } from "./repository/create-observer.ts";
export {
  observeRealitySymbolRepository,
  type RealitySymbolRepositoryObservation,
} from "./repository/observe-symbols.ts";
export type { RepositoryObservationPort } from "./repository/types.ts";
export {
  createSemanticBundle,
  createSemanticCoverageGraph,
  type SemanticCoverageBundle,
  type SemanticCoverageGraph,
} from "./semantic/coverage.ts";
export {
  compileSemanticIr,
  type SemanticIr,
} from "./semantic/ir.ts";
export {
  type PublishSemanticCoverageRequest,
  type PublishSemanticCoverageResult,
  publishSemanticCoverage,
} from "./semantic/publish.ts";
export {
  compileQualitySemanticRelations,
  type DocumentRelationsRequest,
  evaluateDefinitionPairEvidence,
  inspectDocumentRelations,
  type QualitySemanticRelation,
} from "./semantic/relations.ts";
export {
  parseSpecAnalysis,
  parseSpecBehavior,
  parseSpecDefinition,
  parseSpecDefinitionCorrespondence,
  parseSpecDetailCorrespondence,
  parseSpecDetailIndex,
  parseSpecIndex,
  parseSpecSequence,
} from "./spec/parse.ts";
export type {
  SpecAnalysis,
  SpecBehavior,
  SpecConsistencyRequest,
  SpecDefinition,
  SpecDefinitionCorrespondence,
  SpecDetailCorrespondence,
  SpecDetailIndex,
  SpecIndex,
  SpecSequence,
} from "./spec/types.ts";
export { inspectSpecConsistency } from "./spec/validation.ts";
export {
  readTestCatalog,
  testCatalogPath,
  type TestCatalog,
  type TestCatalogEntry,
  type TestCatalogReadResult,
  type TestLevel,
  testLevels,
} from "./test-catalog/inspect.ts";
export { createTopicOperations } from "./topic/create-operations.ts";
export { parseTopicMarkdown } from "./topic/parse.ts";
export type {
  TopicOperations,
  TopicRecord,
  TopicState,
} from "./topic/types.ts";
export {
  parseUiAnalysis,
  parseUiArea,
  parseUiComponent,
  parseUiDefinition,
  parseUiDetailIndex,
  parseUiHandoff,
  parseUiIndex,
  parseUiScreen,
  parseUiVisualBaseline,
} from "./ui/parse.ts";
export type {
  UiAnalysis,
  UiArea,
  UiComponent,
  UiConsistencyRequest,
  UiDefinition,
  UiDetailIndex,
  UiHandoff,
  UiIndex,
  UiScreen,
  UiVisualBaseline,
} from "./ui/types.ts";
export { inspectUiConsistency } from "./ui/validation.ts";
export {
  parseUxAnalysis,
  parseUxDefinition,
  parseUxExperienceMap,
  parseUxIndex,
  parseUxPersonas,
  parseUxQualityExpectations,
  parseUxServiceBlueprint,
} from "./ux/parse.ts";
export type {
  UxAnalysisModel,
  UxConsistencyRequest,
  UxDefinitionModel,
  UxExperienceMap,
  UxIndexModel,
  UxPersonas,
  UxQualityExpectations,
  UxServiceBlueprint,
} from "./ux/types.ts";
export { inspectUxConsistency } from "./ux/validation.ts";

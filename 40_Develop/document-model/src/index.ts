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
export { validateTopicMeetingListInput } from "./activity/operations.ts";
export type {
  MeetingOutcomeCommandResult,
  MeetingOutcomeTarget,
  ProjectOperationRecord,
  ProjectOperationRecordKind,
  TopicMeetingAccess,
  TopicMeetingDocument,
  TopicMeetingListQuery,
  TopicMeetingListResult,
  TopicMeetingPage,
  TopicMeetingRelation,
  TopicMeetingRepository,
  TopicMeetingWriteResult,
  TopicPromotionCommandResult,
} from "./activity/types.ts";
export {
  type ArchitectureDetailMapModel,
  type ArchitectureDetailModel,
  parseArchitectureDetail,
  parseArchitectureDetailMap,
} from "./architecture/details.ts";
export {
  type ArchitectureAnalysis,
  type ArchitectureCrossModel,
  type ArchitectureDefinition,
  type ArchitectureIndex,
  parseArchitectureAnalysis,
  parseArchitectureCrossModel,
  parseArchitectureDefinition,
  parseArchitectureIndex,
} from "./architecture/validation.ts";
export { parseMarkdownAnchors } from "./artifact/anchors.ts";
export { inspectRelatedOrder } from "./artifact/document-header.ts";
export {
  type ArtifactGraph,
  type ArtifactGraphResult,
  type BuildArtifactGraphRequest,
  buildArtifactGraph,
} from "./artifact/graph.ts";
export { parseIdentityDocument } from "./artifact/identity.ts";
export { inspectArtifactSources } from "./artifact/inspect.ts";
export {
  parseMarkdownLinkReference,
  parseMarkdownLinkTargets,
} from "./artifact/links.ts";
export { parseMarkdownArtifact } from "./artifact/parse-markdown.ts";
export type {
  ArtifactModel,
  ArtifactRelation,
  ArtifactSection,
  ArtifactSource,
  ChecklistFailure,
  ChecklistResult,
  DocumentIssue,
  DocumentLocation,
  DocumentResult,
  DocumentStatus,
  MarkdownLinkReference,
  ParseResult,
  SourceLocation,
} from "./artifact/types.ts";
export {
  type ArtifactSchema,
  type ArtifactSchemaValidationResult,
  validateArtifactSchema,
} from "./artifact/validate-schema.ts";
export { parseChangeDocument, parseChangeIndex } from "./change/parse.ts";
export type { ChangeDocument, ChangeIndex } from "./change/types.ts";
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
  parseIaAnalysis,
  parseIaDefinition,
  parseIaIndex,
  parseIaObjectRelation,
  parseIaStateVisibility,
  parseIaStructureNavigation,
} from "./ia/parse.ts";
export type {
  IaAnalysisModel,
  IaDefinitionModel,
  IaIndexModel,
  IaObjectRelation,
  IaStateVisibility,
  IaStructureNavigation,
} from "./ia/types.ts";
export { createMeetingOperations } from "./meeting/create-operations.ts";
export { parseMeetingMarkdown } from "./meeting/markdown.ts";
export type {
  MeetingOperations,
  MeetingRecord,
  MeetingState,
} from "./meeting/types.ts";
export { applyProjectOperationCandidateDecision } from "./project-context/candidate-decision.ts";
export {
  isProjectContextManifestIdentityInvalid,
  isProjectContextProjectionInvalid,
} from "./project-context/inspect.ts";
export { parseRepositoryProjectContextMarkdown } from "./project-context/parse-context.ts";
export { parseRepositoryQualityProjectionMarkdown } from "./project-context/parse-quality.ts";
export { parseRepositoryReleaseProjectionMarkdown } from "./project-context/parse-release.ts";
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
  ProjectOperationProjectionItem,
  ProjectOperationSource,
  ProjectOperationSourceState,
  RepositoryProjectContext,
  RepositoryProjectContextReadResult,
  RepositoryProjectContextScene,
  RepositoryProjectContextSceneKey,
  RepositoryProjectContextTable,
  RepositoryQualityProjection,
  RepositoryReleaseDependency,
  RepositoryReleaseProjection,
  RepositoryReleaseScope,
} from "./project-context/types.ts";
export {
  parseQualityAnalysis,
  parseQualityDetailAnalysis,
  parseQualityIntegration,
  type QualityAnalysis,
  type QualityDetailAnalysis,
  type QualityIntegration,
} from "./quality/analysis.ts";
export {
  parseQualityDefinition,
  type QualityDefinitionModel,
} from "./quality/definition.ts";
export {
  parseQualityCenter,
  parseQualityRealityAudit,
  parseQualityStrategy,
  parseQualityVerificationDesign,
  parseQualityVerificationResult,
  type QualityCenter,
  type QualityRealityAudit,
  type QualityStrategy,
  type QualityVerificationDesign,
  type QualityVerificationResult,
} from "./quality/readiness.ts";
export {
  inspectBranchCoverageTable,
  inspectRemediationTable,
} from "./quality/verification-tables.ts";
export {
  type FixedQualityCandidate,
  fixQualityCandidate,
  type IntegratedQualityGate,
  integrateQualityGate,
  type QualityCheckResult,
  type QualityCheckStatus,
  reenterQualityReview,
} from "./quality-change-control/gate.ts";
export { inspectRealityTestCatalog } from "./reality-traceability/catalog.ts";
export {
  discoverRealitySymbols,
  type RealitySymbolDiscoveryRequest,
  type RealitySymbolDiscoveryResult,
  type RealitySymbolDiscoverySource,
} from "./reality-traceability/discover.ts";
export {
  createRealitySymbolGraph,
  type RealitySymbolGraph,
  type RealitySymbolNode,
} from "./reality-traceability/graph.ts";
export type {
  LoadedRealitySymbolManifest,
  RealitySymbol,
  RealitySymbolKind,
  RealitySymbolManifest,
} from "./reality-traceability/manifest.ts";
export { validateRealitySymbolManifest } from "./reality-traceability/validate-manifest.ts";
export {
  parseCanonicalDocument,
  parseChangelog,
  parseReadme,
} from "./release/parse.ts";
export type { CanonicalDocument, Changelog, Readme } from "./release/types.ts";

export { createFilesystemRepositoryObservationPort } from "./repository/create-observer.ts";
export {
  observeRealitySymbolRepository,
  type RealityRepositoryObservationIssue,
  type RealitySymbolRepositoryObservation,
} from "./repository/observe-symbols.ts";
export type {
  RepositoryDirectoryEntry,
  RepositoryDirectoryObservation,
  RepositoryEntryKind,
  RepositoryFileObservation,
  RepositoryObservationPort,
} from "./repository/types.ts";
export {
  createSemanticBundle,
  createSemanticCoverageGraph,
  type SemanticBundleContent,
  type SemanticCoverageBundle,
  type SemanticCoverageGraph,
  type SemanticCoverageProjection,
} from "./semantic/coverage.ts";
export {
  compileSemanticIr,
  type SemanticIr,
  type SemanticIrMeaning,
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
  inspectQualityAnalysis,
  inspectQualityLocalItemOwnership,
  inspectReleaseDocuments,
  type QualityLocalItemOwnershipModel,
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
} from "./spec/parse.ts";
export type {
  SpecAnalysis,
  SpecBehavior,
  SpecDefinition,
  SpecDefinitionCorrespondence,
  SpecDetailCorrespondence,
  SpecDetailIndex,
  SpecIndex,
} from "./spec/types.ts";
export {
  createFilesystemSemanticBundlePublisher,
  type SemanticBundlePublisher,
  type SemanticBundlePublishReceipt,
  type SemanticBundlePublishRequest,
} from "./storage/semantic-store.ts";
export {
  discoverRepositoryTestFiles,
  inspectTestCatalog,
  loadTestCatalog,
  type TestCatalog,
  type TestCatalogEntry,
  type TestLevel,
  testLevels,
} from "./test-catalog/inspect.ts";
export { createTopicOperations } from "./topic/create-operations.ts";
export { parseTopicMarkdown } from "./topic/markdown.ts";
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
  UiDefinition,
  UiDetailIndex,
  UiHandoff,
  UiIndex,
  UiScreen,
  UiVisualBaseline,
} from "./ui/types.ts";
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
  UxDefinitionModel,
  UxExperienceMap,
  UxFormalInputObservation,
  UxIndexModel,
  UxPersonas,
  UxQualityExpectations,
  UxServiceBlueprint,
} from "./ux/types.ts";

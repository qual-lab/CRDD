/**
 * Modelの固定公開契約を検証する。
 * @packageDocumentation
 * @responsibility 公開集合と内部境界、用途固有の操作を検査する。
 * @trace RCM-UT-014
 * @trace RCM-UT-016
 * @level UT
 * @scope 公開契約、実行時値、型、Package依存
 * @boundary 同一Processの境界検査。外部Effectなし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import * as domainLibrary from "../../src/index.ts";

/**
 * 型を含む明示export名をSourceから観測する。
 * @responsibility 採用済みの固定期待集合と比較する観測値だけを作る。
 * @trace RCM-UT-014
 * @precondition 相対Pathは試験内で固定する。
 * @stimulus 対象Moduleの公開宣言を列挙する。
 * @observation exportされた名前。
 * @oracle 呼出し元が固定literalと完全一致を確認する。
 * @cleanup 読取りのみ。
 * @boundary Package Rootの型宣言。
 */
function exportedNames(relativePath: string): readonly string[] {
  const source = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), relativePath),
    "utf8",
  );
  const names = [
    ...[
      ...source.matchAll(/export\s+(?:type\s+)?\{([\s\S]*?)\}\s*from/gu),
    ].flatMap((match) =>
      (match[1] ?? "")
        .split(",")
        .map(
          (entry) =>
            entry
              .trim()
              .replace(/^type\s+/u, "")
              .split(/\s+as\s+/u)
              .at(-1) ?? "",
        )
        .filter((entry) => entry.length > 0),
    ),
    ...[
      ...source.matchAll(
        /export\s+(?:type|interface|const|function|class)\s+([A-Za-z][A-Za-z0-9]*)/gu,
      ),
    ].map((match) => match[1] ?? ""),
  ];
  return names.filter((name) => name.length > 0).sort();
}

/**
 * 採用設計の公開集合とPackage入口を固定する。
 * @responsibility 実装から期待集合を生成せず欠落・余剰を拒否する。
 * @trace RCM-UT-014
 * @precondition 採用設計のSymbolをliteralで固定する。
 * @stimulus Rootとpackageの公開集合を取得する。
 * @observation 明示exportと実行値、Subpath。
 * @oracle 固定集合と完全一致する。
 * @cleanup 外部資源なし。
 * @boundary 公開Moduleと型契約。
 */
test("Package Rootは採用済みの固定公開集合だけを提供する", () => {
  assert.deepEqual(Object.keys(domainLibrary).sort(), [
    "aggregateRegressionStageResults",
    "applyMeetingOutcomeTreatment",
    "applyProjectOperationCandidateDecision",
    "applyTopicPromotion",
    "buildArtifactGraph",
    "buildRegressionStagePlan",
    "compileQualitySemanticRelations",
    "compileSemanticIr",
    "createFilesystemRepositoryObservationPort",
    "createFilesystemSemanticBundlePublisher",
    "createMeetingOperations",
    "createPhaseChecklistItems",
    "createPortfolioProjection",
    "createRealitySymbolGraph",
    "createSemanticBundle",
    "createSemanticCoverageGraph",
    "createTopicOperations",
    "discoverRealitySymbols",
    "discoverRepositoryTestFiles",
    "federateTopicMeetingRelations",
    "fixQualityCandidate",
    "hasQualityOpenChecklist",
    "inspectArchitectureAnalysis",
    "inspectArchitectureAnalysisCoverage",
    "inspectArchitectureComponentCoverage",
    "inspectArchitectureCrossModel",
    "inspectArchitectureCrossModelIndex",
    "inspectArchitectureDefinition",
    "inspectArchitectureDetail",
    "inspectArchitectureDetailCoverage",
    "inspectArchitectureDetailMap",
    "inspectArchitectureDetailTemplate",
    "inspectArchitectureRegistryCoverage",
    "inspectArchitectureRelations",
    "inspectArtifactSources",
    "inspectBranchCoverageTable",
    "inspectCanonicalDocumentVersions",
    "inspectChangeDocument",
    "inspectChangelogRelease",
    "inspectDiscoveryAnalysis",
    "inspectDiscoveryDefinition",
    "inspectDiscoveryIdentityLinks",
    "inspectEvaluatedChecklist",
    "inspectIaAnalysis",
    "inspectIaAnalysisCoverage",
    "inspectIaCrossProjection",
    "inspectIaDefinition",
    "inspectIaIndexCoverage",
    "inspectIaRelations",
    "inspectPhaseDiagramTemplates",
    "inspectQualityAnalysis",
    "inspectQualityCenterState",
    "inspectQualityCrossModelGoals",
    "inspectQualityDefinition",
    "inspectQualityDefinitionRelations",
    "inspectQualityDesignStates",
    "inspectQualityDetailUnits",
    "inspectQualityGoalLocalRelations",
    "inspectQualityLocalItemOwnership",
    "inspectQualityLocalItemRelations",
    "inspectQualityRealityState",
    "inspectRealityTestCatalog",
    "inspectRelatedOrder",
    "inspectRemediationTable",
    "inspectResourceIntensiveTestAuthority",
    "inspectSpecAnalysis",
    "inspectSpecAnalysisCoverage",
    "inspectSpecCorrespondence",
    "inspectSpecCorrespondencePairEvidence",
    "inspectSpecCoverage",
    "inspectSpecDefinition",
    "inspectSpecDefinitionCoverage",
    "inspectSpecDetailCorrespondence",
    "inspectSpecDetailDownstream",
    "inspectSpecDetailIndex",
    "inspectStableCanonicalDocuments",
    "inspectStableChangelog",
    "inspectStableIdentityDefinitions",
    "inspectStableIdentityOwnership",
    "inspectStableReadme",
    "inspectStableReleaseHeader",
    "inspectTemplateChecklist",
    "inspectTestCatalog",
    "inspectUiAnalysis",
    "inspectUiAnalysisCoverage",
    "inspectUiDefinition",
    "inspectUiDetail",
    "inspectUiIndexCoverage",
    "inspectUiRelations",
    "inspectUiSpecRelations",
    "inspectUxAnalysis",
    "inspectUxDefinition",
    "inspectUxFormalInput",
    "inspectUxRelations",
    "integrateQualityGate",
    "isChangeNavigationInvalid",
    "isChangeTemplateInvalid",
    "isMarkdownTableSeparator",
    "isProjectContextManifestIdentityInvalid",
    "isProjectContextProjectionInvalid",
    "isQualityAnalysisTemplateInvalid",
    "isQualityIntegrationTemplateInvalid",
    "isQualityLocalItemCountInvalid",
    "isQualityVerificationResultTemplateInvalid",
    "isUxHandoffTargetSetExact",
    "isUxProjectionIncomplete",
    "isUxRootHandoffValid",
    "loadTestCatalog",
    "normalizeExplicitChangedPaths",
    "observeRealitySymbolRepository",
    "omitMarkdownCommentsAndFencedCode",
    "omitMarkdownCommentsOutsideFencedCode",
    "omitMarkdownFencedCode",
    "parseAdoptedDiscoveryRequirements",
    "parseArchitectureRegistry",
    "parseCandidateVersionHeader",
    "parseCanonicalReleaseHeader",
    "parseChangeTraceHeader",
    "parseIaIndex",
    "parseMarkdownAnchors",
    "parseMarkdownArtifact",
    "parseMarkdownFences",
    "parseMarkdownLinkReference",
    "parseMarkdownLinkTargets",
    "parseMarkdownTableRow",
    "parseMeetingMarkdown",
    "parseQualityCoverageSections",
    "parseQualityDetailHandoff",
    "parseReadmeVersion",
    "parseRepositoryProjectContextMarkdown",
    "parseRepositoryQualityProjectionMarkdown",
    "parseRepositoryReleaseProjectionMarkdown",
    "parseSpecCorrespondencePair",
    "parseSpecCorrespondenceRevision",
    "parseSpecDetailAreaOwnership",
    "parseSpecDetailCentralTrace",
    "parseSpecDetailDefinitionOwnership",
    "parseSpecIndex",
    "parseSpecScreenRelations",
    "parseStableIdentityOccurrences",
    "parseTopicMarkdown",
    "parseUiDetailBindings",
    "parseUiIndex",
    "parseUiSpecPairs",
    "parseUxFormalInputTargets",
    "parseUxIndex",
    "parseUxJourneyRelations",
    "phaseDiagramTemplatePaths",
    "projectProjectOperationSources",
    "publishSemanticCoverage",
    "readCanonicalDocumentHeader",
    "readRepositoryProjectContext",
    "realitySymbolKinds",
    "reenterQualityReview",
    "regressionStageOrder",
    "selectRegressionStaticOwners",
    "selectRegressionTests",
    "testLevels",
    "validateArtifactSchema",
    "validateDomainOutcome",
    "validateRealitySymbolManifest",
    "validateTopicMeetingListInput",
  ]);
  assert.deepEqual(exportedNames("../../src/index.ts"), [
    "ArchitectureAnalysisCoverageRequest",
    "ArchitectureBodyModel",
    "ArchitectureCrossModelIndex",
    "ArchitectureDetailCoverageRequest",
    "ArchitectureDetailMapModel",
    "ArchitectureDetailModel",
    "ArchitectureRegistryModel",
    "ArchitectureRelationsRequest",
    "ArtifactGraph",
    "ArtifactGraphResult",
    "ArtifactModel",
    "ArtifactRelation",
    "ArtifactSchema",
    "ArtifactSchemaValidationResult",
    "ArtifactSection",
    "ArtifactSource",
    "BuildArtifactGraphRequest",
    "ChecklistFailure",
    "ChecklistResult",
    "DomainIssue",
    "DomainLocation",
    "DomainOutcome",
    "DomainStatus",
    "FederatedProjectProjection",
    "FederatedProjectSource",
    "FixedQualityCandidate",
    "IaAnalysisModel",
    "IaDefinitionModel",
    "IaIndexModel",
    "IntegratedQualityGate",
    "LoadedRealitySymbolManifest",
    "MarkdownFence",
    "MarkdownFenceLine",
    "MarkdownLinkReference",
    "MeetingOperations",
    "MeetingOutcomeCommandResult",
    "MeetingOutcomeDisposition",
    "MeetingOutcomeTarget",
    "MeetingOutcomeTreatment",
    "MeetingRecord",
    "MeetingState",
    "PortfolioProjection",
    "ProjectContextSource",
    "ProjectOperationCandidate",
    "ProjectOperationCandidateDecision",
    "ProjectOperationCandidateDecisionResult",
    "ProjectOperationProjection",
    "ProjectOperationProjectionItem",
    "ProjectOperationRecord",
    "ProjectOperationRecordKind",
    "ProjectOperationSource",
    "ProjectOperationSourceState",
    "PublishSemanticCoverageRequest",
    "PublishSemanticCoverageResult",
    "QualityCheckResult",
    "QualityCheckStatus",
    "QualityDefinitionModel",
    "QualityLocalItemOwnershipModel",
    "QualitySemanticRelation",
    "RealityRepositoryObservationIssue",
    "RealitySymbol",
    "RealitySymbolDiscoveryRequest",
    "RealitySymbolDiscoveryResult",
    "RealitySymbolDiscoverySource",
    "RealitySymbolGraph",
    "RealitySymbolKind",
    "RealitySymbolManifest",
    "RealitySymbolNode",
    "RealitySymbolRepositoryObservation",
    "RegressionAggregateResult",
    "RegressionExecutionStep",
    "RegressionPlanEntry",
    "RegressionStage",
    "RegressionStagePlan",
    "RegressionStageResult",
    "RepositoryDirectoryEntry",
    "RepositoryDirectoryObservation",
    "RepositoryEntryKind",
    "RepositoryFileObservation",
    "RepositoryObservationPort",
    "RepositoryProjectContext",
    "RepositoryProjectContextReadResult",
    "RepositoryProjectContextScene",
    "RepositoryProjectContextSceneKey",
    "RepositoryProjectContextTable",
    "RepositoryQualityProjection",
    "RepositoryReleaseDependency",
    "RepositoryReleaseProjection",
    "RepositoryReleaseScope",
    "ResourceIntensiveTestAuthority",
    "SemanticBundleContent",
    "SemanticBundlePublishReceipt",
    "SemanticBundlePublishRequest",
    "SemanticBundlePublisher",
    "SemanticCoverageBundle",
    "SemanticCoverageGraph",
    "SemanticCoverageProjection",
    "SemanticIr",
    "SemanticIrMeaning",
    "SemanticSourceDocument",
    "SourceLocation",
    "SpecAnalysisModel",
    "SpecCorrespondencePair",
    "SpecDefinitionModel",
    "SpecDetailAreaOwnership",
    "SpecDetailCentralTrace",
    "SpecDetailDefinitionOwnership",
    "SpecDetailDownstreamRequest",
    "SpecIndexModel",
    "TestCatalog",
    "TestCatalogEntry",
    "TestLevel",
    "TopicMeetingAccess",
    "TopicMeetingDocument",
    "TopicMeetingListQuery",
    "TopicMeetingListResult",
    "TopicMeetingPage",
    "TopicMeetingRelation",
    "TopicMeetingRelationSource",
    "TopicMeetingRepository",
    "TopicMeetingWriteResult",
    "TopicOperations",
    "TopicPromotion",
    "TopicPromotionCommandResult",
    "TopicRecord",
    "TopicState",
    "UiIndexModel",
    "UiRelationsModel",
    "UxAnalysisModel",
    "UxFormalInputObservation",
    "UxFormalInputTarget",
    "UxIndexModel",
    "aggregateRegressionStageResults",
    "applyMeetingOutcomeTreatment",
    "applyProjectOperationCandidateDecision",
    "applyTopicPromotion",
    "buildArtifactGraph",
    "buildRegressionStagePlan",
    "compileQualitySemanticRelations",
    "compileSemanticIr",
    "createFilesystemRepositoryObservationPort",
    "createFilesystemSemanticBundlePublisher",
    "createMeetingOperations",
    "createPhaseChecklistItems",
    "createPortfolioProjection",
    "createRealitySymbolGraph",
    "createSemanticBundle",
    "createSemanticCoverageGraph",
    "createTopicOperations",
    "discoverRealitySymbols",
    "discoverRepositoryTestFiles",
    "federateTopicMeetingRelations",
    "fixQualityCandidate",
    "hasQualityOpenChecklist",
    "inspectArchitectureAnalysis",
    "inspectArchitectureAnalysisCoverage",
    "inspectArchitectureComponentCoverage",
    "inspectArchitectureCrossModel",
    "inspectArchitectureCrossModelIndex",
    "inspectArchitectureDefinition",
    "inspectArchitectureDetail",
    "inspectArchitectureDetailCoverage",
    "inspectArchitectureDetailMap",
    "inspectArchitectureDetailTemplate",
    "inspectArchitectureRegistryCoverage",
    "inspectArchitectureRelations",
    "inspectArtifactSources",
    "inspectBranchCoverageTable",
    "inspectCanonicalDocumentVersions",
    "inspectChangeDocument",
    "inspectChangelogRelease",
    "inspectDiscoveryAnalysis",
    "inspectDiscoveryDefinition",
    "inspectDiscoveryIdentityLinks",
    "inspectEvaluatedChecklist",
    "inspectIaAnalysis",
    "inspectIaAnalysisCoverage",
    "inspectIaCrossProjection",
    "inspectIaDefinition",
    "inspectIaIndexCoverage",
    "inspectIaRelations",
    "inspectPhaseDiagramTemplates",
    "inspectQualityAnalysis",
    "inspectQualityCenterState",
    "inspectQualityCrossModelGoals",
    "inspectQualityDefinition",
    "inspectQualityDefinitionRelations",
    "inspectQualityDesignStates",
    "inspectQualityDetailUnits",
    "inspectQualityGoalLocalRelations",
    "inspectQualityLocalItemOwnership",
    "inspectQualityLocalItemRelations",
    "inspectQualityRealityState",
    "inspectRealityTestCatalog",
    "inspectRelatedOrder",
    "inspectRemediationTable",
    "inspectResourceIntensiveTestAuthority",
    "inspectSpecAnalysis",
    "inspectSpecAnalysisCoverage",
    "inspectSpecCorrespondence",
    "inspectSpecCorrespondencePairEvidence",
    "inspectSpecCoverage",
    "inspectSpecDefinition",
    "inspectSpecDefinitionCoverage",
    "inspectSpecDetailCorrespondence",
    "inspectSpecDetailDownstream",
    "inspectSpecDetailIndex",
    "inspectStableCanonicalDocuments",
    "inspectStableChangelog",
    "inspectStableIdentityDefinitions",
    "inspectStableIdentityOwnership",
    "inspectStableReadme",
    "inspectStableReleaseHeader",
    "inspectTemplateChecklist",
    "inspectTestCatalog",
    "inspectUiAnalysis",
    "inspectUiAnalysisCoverage",
    "inspectUiDefinition",
    "inspectUiDetail",
    "inspectUiIndexCoverage",
    "inspectUiRelations",
    "inspectUiSpecRelations",
    "inspectUxAnalysis",
    "inspectUxDefinition",
    "inspectUxFormalInput",
    "inspectUxRelations",
    "integrateQualityGate",
    "isChangeNavigationInvalid",
    "isChangeTemplateInvalid",
    "isMarkdownTableSeparator",
    "isProjectContextManifestIdentityInvalid",
    "isProjectContextProjectionInvalid",
    "isQualityAnalysisTemplateInvalid",
    "isQualityIntegrationTemplateInvalid",
    "isQualityLocalItemCountInvalid",
    "isQualityVerificationResultTemplateInvalid",
    "isUxHandoffTargetSetExact",
    "isUxProjectionIncomplete",
    "isUxRootHandoffValid",
    "loadTestCatalog",
    "normalizeExplicitChangedPaths",
    "observeRealitySymbolRepository",
    "omitMarkdownCommentsAndFencedCode",
    "omitMarkdownCommentsOutsideFencedCode",
    "omitMarkdownFencedCode",
    "parseAdoptedDiscoveryRequirements",
    "parseArchitectureRegistry",
    "parseCandidateVersionHeader",
    "parseCanonicalReleaseHeader",
    "parseChangeTraceHeader",
    "parseIaIndex",
    "parseMarkdownAnchors",
    "parseMarkdownArtifact",
    "parseMarkdownFences",
    "parseMarkdownLinkReference",
    "parseMarkdownLinkTargets",
    "parseMarkdownTableRow",
    "parseMeetingMarkdown",
    "parseQualityCoverageSections",
    "parseQualityDetailHandoff",
    "parseReadmeVersion",
    "parseRepositoryProjectContextMarkdown",
    "parseRepositoryQualityProjectionMarkdown",
    "parseRepositoryReleaseProjectionMarkdown",
    "parseSpecCorrespondencePair",
    "parseSpecCorrespondenceRevision",
    "parseSpecDetailAreaOwnership",
    "parseSpecDetailCentralTrace",
    "parseSpecDetailDefinitionOwnership",
    "parseSpecIndex",
    "parseSpecScreenRelations",
    "parseStableIdentityOccurrences",
    "parseTopicMarkdown",
    "parseUiDetailBindings",
    "parseUiIndex",
    "parseUiSpecPairs",
    "parseUxFormalInputTargets",
    "parseUxIndex",
    "parseUxJourneyRelations",
    "phaseDiagramTemplatePaths",
    "projectProjectOperationSources",
    "publishSemanticCoverage",
    "readCanonicalDocumentHeader",
    "readRepositoryProjectContext",
    "realitySymbolKinds",
    "reenterQualityReview",
    "regressionStageOrder",
    "selectRegressionStaticOwners",
    "selectRegressionTests",
    "testLevels",
    "validateArtifactSchema",
    "validateDomainOutcome",
    "validateRealitySymbolManifest",
    "validateTopicMeetingListInput",
  ]);
  const metadata = JSON.parse(
    fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(metadata.exports, { ".": "./src/index.ts" });
});

/**
 * TopicとMeetingの宣言済み操作がRootから利用でき、内部解析操作が公開されないことを検証する。
 *
 * @responsibility 活動種別ごとの公開操作を維持し、共通Markdown内部解析の公開を拒否する。
 * @trace RCM-UT-014
 * @precondition Package Rootの公開入口を読み込む。
 * @stimulus 実行時exportを列挙し、各解析・更新操作の存在と禁止操作の不存在を照合する。
 * @observation Public ModuleのPropertyを観測する。
 * @oracle TopicとMeetingの宣言済み操作は利用でき、内部表解析はRootに公開されない。
 * @cleanup N/A: 不変なModule exportだけを観測する。
 * @boundary RCM-UT-014=N/A: 同一Processの公開集合を検査し、外部資源を操作しない。
 */
test("TopicとMeetingの公開操作をRootから利用し内部解析は公開しない", () => {
  assert.equal(typeof domainLibrary.parseTopicMarkdown, "function");
  assert.equal(typeof domainLibrary.applyTopicPromotion, "function");
  assert.equal(typeof domainLibrary.parseMeetingMarkdown, "function");
  assert.equal(typeof domainLibrary.applyMeetingOutcomeTreatment, "function");
  for (const name of ["tableRange", "readMetadata"])
    assert.equal(name in domainLibrary, false, name);
});

/**
 * srcのDirectoryはCapability-firstかつ二階層以内に保つを検証する。
 *
 * @responsibility srcのDirectoryはCapability-firstかつ二階層以内に保つの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus srcのDirectoryはCapability-firstかつ二階層以内に保つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: document-model Test Source→対象契約
 */
test("srcのDirectoryはCapability-firstかつ二階層以内に保つ", () => {
  const sourceRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../src",
  );
  const prohibitedNames = new Set(["common", "helpers", "internal", "utils"]);
  const violations: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const target = path.join(directory, entry.name);
      const relativePath = path
        .relative(sourceRoot, target)
        .replaceAll("\\", "/");
      const depth = relativePath.split("/").length;
      if (depth > 2 || prohibitedNames.has(entry.name))
        violations.push(relativePath);
      visit(target);
    }
  };
  visit(sourceRoot);
  assert.deepEqual(violations, []);
});

/**
 * Artifactの公開操作から解析・Schema検証・関係Graphを利用するを検証する。
 *
 * @responsibility Artifactの公開操作から解析・Schema検証・関係Graphを利用するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Artifactの公開操作から解析・Schema検証・関係Graphを利用するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: document-model Test Source→対象契約
 */
test("Artifactの公開操作から解析・Schema検証・関係Graphを利用する", () => {
  const parsed = domainLibrary.parseMarkdownArtifact({
    path: "02_UX/Definitions/UX-000001/ux_definition.md",
    content: `# UX-000001 Sample

成果物種別: UX定義
UX ID: UX-000001
状態: Canonical
正式入力: REQ-000001

## Goal

[REQ-000001](../../../01_Discovery/Definitions/REQ-000001/requirement.md)

\`\`\`text
状態: Hidden
\`\`\`

<!-- 状態: Hidden -->

## Checklist

- [x] 意味を保持した
- OPEN: 人間確認待ち — 実利用を確認した
`,
  });
  assert.equal(parsed.canonicalId, "UX-000001");
  assert.deepEqual(parsed.formalInputs, ["REQ-000001"]);
  assert.equal(parsed.status, "Canonical");
  assert.deepEqual(
    parsed.checklist.map(({ result }) => result),
    ["passed", "open"],
  );

  const validation = domainLibrary.validateArtifactSchema(parsed, {
    id: "ux-definition",
    matches: () => true,
    requiredProperties: ["artifactType", "canonicalId", "status"],
    requiredSections: ["Missing"],
    allowedStatuses: ["Draft"],
  });
  assert.equal(validation.status, "invalid");
  assert.equal(validation.result, null);
  assert.deepEqual(validation.issues.map(({ kind }) => kind).sort(), [
    "artifact.schema.section-missing",
    "artifact.schema.status-invalid",
  ]);
  assert.equal(
    validation.issues.some(
      (issue) =>
        "code" in issue || "message" in issue || "summary" in issue.details,
    ),
    false,
  );
});

/**
 * RelationはArtifact Graphと中立Issueだけを公開するを検証する。
 *
 * @responsibility RelationはArtifact Graphと中立Issueだけを公開するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RelationはArtifact Graphと中立Issueだけを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: document-model Test Source→対象契約
 */
test("RelationはArtifact Graphと中立Issueだけを公開する", () => {
  assert.deepEqual(
    exportedNames("../../src/index.ts").filter(
      (name) => name.includes("ArtifactGraph") || name === "buildArtifactGraph",
    ),
    [
      "ArtifactGraph",
      "ArtifactGraphResult",
      "BuildArtifactGraphRequest",
      "buildArtifactGraph",
    ],
  );
  const source = domainLibrary.parseMarkdownArtifact({
    path: "one.md",
    content: "# REQ-000001 One\n\n要求ID: REQ-000001\n",
  });
  const duplicate = domainLibrary.parseMarkdownArtifact({
    path: "two.md",
    content: "# REQ-000001 Two\n\n要求ID: REQ-000001\n",
  });
  const outcome = domainLibrary.buildArtifactGraph({
    artifacts: [source, duplicate],
  });
  assert.equal(outcome.status, "partial");
  assert.equal(outcome.result?.artifactsById.get("REQ-000001"), source);
  assert.deepEqual(outcome.issues, [
    {
      kind: "artifact.relation.canonical-id-duplicate",
      targetIdentity: "REQ-000001",
      location: { path: "two.md", line: 1 },
      reason: "canonical_identity_not_unique",
      details: { canonicalId: "REQ-000001" },
    },
  ]);
});

/**
 * Reality Traceabilityの宣言済み操作をRootから利用するを検証する。
 *
 * @responsibility Reality Traceabilityの宣言済み操作をRootから利用するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality Traceabilityの宣言済み操作をRootから利用するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: document-model Test Source→対象契約
 */
test("Reality Traceabilityの宣言済み操作をRootから利用する", () => {
  assert.equal(typeof domainLibrary.createRealitySymbolGraph, "function");
  assert.equal(typeof domainLibrary.discoverRealitySymbols, "function");
  assert.equal(typeof domainLibrary.validateRealitySymbolManifest, "function");
  assert.ok(Array.isArray(domainLibrary.realitySymbolKinds));
});

/**
 * Reality DiscoveryはRepository観測済みSnapshotだけからManifestを構成するを検証する。
 *
 * @responsibility Reality DiscoveryはRepository観測済みSnapshotだけからManifestを構成するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality DiscoveryはRepository観測済みSnapshotだけからManifestを構成するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: document-model Test Source→対象契約
 */
test("Reality DiscoveryはRepository観測済みSnapshotだけからManifestを構成する", () => {
  const manifest = {
    contract: "crdd/reality-symbol-manifest",
    contractRevision: 1,
    subsystem: "sample",
    symbols: [
      {
        symbolId: "sample.entry",
        kind: "module",
        path: "src/index.ts",
        archIds: ["ARCH-000008"],
      },
    ],
  };
  const result = domainLibrary.discoverRealitySymbols({
    sources: [
      {
        subsystem: "sample",
        subsystemPath: "40_Develop/sample",
        manifestPath: "40_Develop/sample/symbol.json",
        manifestSource: JSON.stringify(manifest),
        symbolSources: new Map([["src/index.ts", "export {};\n"]]),
      },
    ],
    prerequisiteIssues: [],
  });
  assert.equal(result.status, "complete");
  assert.equal(result.result?.manifests[0]?.subsystemRoot, "40_Develop/sample");
});

/**
 * Reality Annotationは公開Discovery経由で検証しinternalを公開しないを検証する。
 *
 * @responsibility Reality Annotationは公開Discovery経由で検証しinternalを公開しないの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality Annotationは公開Discovery経由で検証しinternalを公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: document-model Test Source→対象契約
 */
test("Reality Annotationは公開Discovery経由で検証しinternalを公開しない", () => {
  const manifest = {
    contract: "crdd/reality-symbol-manifest",
    contractRevision: 1,
    subsystem: "sample",
    symbols: [
      {
        symbolId: "sample.entry",
        kind: "module",
        path: "src/index.ts",
        archIds: ["ARCH-000008"],
      },
    ],
  };
  const result = domainLibrary.discoverRealitySymbols({
    sources: [
      {
        subsystem: "sample",
        subsystemPath: "40_Develop/sample",
        manifestPath: "40_Develop/sample/symbol.json",
        manifestSource: JSON.stringify(manifest),
        symbolSources: new Map([
          ["src/index.ts", "// @crdd QA-000001\n// @crdd ARCH-000009"],
        ]),
      },
    ],
    prerequisiteIssues: [],
  });
  assert.equal(result.status, "invalid");
  assert.deepEqual(result.issues.map(({ kind }) => kind).sort(), [
    "annotation.architecture.relation-mismatch",
    "annotation.relation.domain-invalid",
  ]);
});

/**
 * 共通Outcomeは中立な処理結果契約だけを公開するを検証する。
 *
 * @responsibility 共通Outcomeは中立な処理結果契約だけを公開するの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 共通Outcomeは中立な処理結果契約だけを公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: document-model Test Source→対象契約
 */
test("共通Outcomeは中立な処理結果契約だけを公開する", () => {
  assert.deepEqual(exportedNames("../../src/outcome.ts"), [
    "DomainIssue",
    "DomainLocation",
    "DomainOutcome",
    "DomainStatus",
    "validateDomainOutcome",
  ]);
});

/**
 * Reality Domain IssueはChecker語彙と絶対Pathを公開しないを検証する。
 *
 * @responsibility Reality Domain IssueはChecker語彙と絶対Pathを公開しないの合否判定を所有する。
 * @trace RCM-UT-016
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reality Domain IssueはChecker語彙と絶対Pathを公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-016=Direct Boundary: document-model Test Source→対象契約
 */
test("Reality Domain IssueはChecker語彙と絶対Pathを公開しない", () => {
  const invalidContract = domainLibrary.validateRealitySymbolManifest(
    {
      contract: "wrong",
      contractRevision: 1,
      subsystem: "fixture",
      symbols: [],
    },
    "40_Develop/fixture/symbol.json",
  );
  assert.equal(invalidContract.status, "invalid");
  assert.equal(
    invalidContract.issues.some(
      (issue) => issue.kind === "symbol-manifest-contract-invalid",
    ),
    false,
  );
  assert.equal(
    invalidContract.issues.some(
      (issue) =>
        issue.reason === "contract must be crdd/reality-symbol-manifest.",
    ),
    false,
  );
  assert.equal(
    invalidContract.issues.some(
      (issue) => "code" in issue || "message" in issue,
    ),
    false,
  );

  const absolutePath = "C:\\secret\\symbol.json";
  const invalidLocation = domainLibrary.validateRealitySymbolManifest(
    {},
    absolutePath,
  );
  assert.equal(invalidLocation.status, "invalid");
  assert.equal(JSON.stringify(invalidLocation).includes(absolutePath), false);
});

/**
 * Repository観測はRootの公開操作から不正Capabilityを拒否するを検証する。
 *
 * @responsibility Repository観測はRootの公開操作から不正Capabilityを拒否するの合否判定を所有する。
 * @trace RCM-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不正CapabilityからFileとDirectoryを観測し、Root拒否を確認する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-UT-014=Direct Boundary: document-model Test Source→対象契約
 */
test("Repository観測はRootの公開操作から不正Capabilityを拒否する", () => {
  const forgedCapability = {
    contract: "crdd-version-control/repository-location/v1",
  } as never;
  assert.equal(
    domainLibrary
      .createFilesystemRepositoryObservationPort(forgedCapability)
      .observeFile("PROJECT_CONTEXT.md").status,
    "unobservable",
  );
  assert.equal(
    domainLibrary
      .createFilesystemRepositoryObservationPort(forgedCapability)
      .observeDirectory("40_Develop").status,
    "unobservable",
  );
  const repositoryEntrySource = fs.readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../src/repository/create-observer.ts",
    ),
    "utf8",
  );
  assert.match(
    repositoryEntrySource,
    /from "\.\.\/\.\.\/\.\.\/version-control\/src\/index\.ts"/u,
  );
  assert.doesNotMatch(
    repositoryEntrySource,
    /version-control\/src\/(?!index\.ts)/u,
  );
});

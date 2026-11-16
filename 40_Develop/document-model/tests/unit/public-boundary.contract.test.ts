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
import { buildArtifactGraph } from "../../src/artifact/graph.ts";
import { validateArtifactSchema } from "../../src/artifact/validate-schema.ts";
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
    "applyProjectOperationCandidateDecision",
    "compileQualitySemanticRelations",
    "compileSemanticIr",
    "createFilesystemRepositoryObservationPort",
    "createMeetingOperations",
    "createPortfolioProjection",
    "createRealitySymbolGraph",
    "createSemanticBundle",
    "createSemanticCoverageGraph",
    "createTopicOperations",
    "discoverRealitySymbols",
    "evaluateDefinitionPairEvidence",
    "federateTopicMeetingRelations",
    "fixQualityCandidate",
    "inspectArchitectureConsistency",
    "inspectArtifactPlacement",
    "inspectChangeNavigation",
    "inspectChangePlacement",
    "inspectDiscoveryCoverage",
    "inspectDocumentRelations",
    "inspectIaConsistency",
    "inspectQualityAnalysis",
    "inspectQualityConsistency",
    "inspectQualityLocalItemOwnership",
    "inspectReleaseConsistency",
    "inspectReleaseDocuments",
    "inspectSpecConsistency",
    "inspectUiConsistency",
    "inspectUxConsistency",
    "integrateQualityGate",
    "observeRealitySymbolRepository",
    "parseArchitectureAnalysis",
    "parseArchitectureCrossModel",
    "parseArchitectureDefinition",
    "parseArchitectureDetail",
    "parseArchitectureDetailMap",
    "parseArchitectureIndex",
    "parseArtifact",
    "parseCanonicalDocument",
    "parseChangeDocument",
    "parseChangeIndex",
    "parseChangelog",
    "parseCommunication",
    "parseDiscoveryAnalysis",
    "parseDiscoveryDefinition",
    "parseDiscoveryIndex",
    "parseDiscoveryReferences",
    "parseIaAnalysis",
    "parseIaDefinition",
    "parseIaIndex",
    "parseIaObjectRelation",
    "parseIaStateVisibility",
    "parseIaStructureNavigation",
    "parseMarkdownLinkReference",
    "parseMeetingMarkdown",
    "parseQualityAnalysis",
    "parseQualityCenter",
    "parseQualityDefinition",
    "parseQualityDetailAnalysis",
    "parseQualityIntegration",
    "parseQualityRealityAudit",
    "parseQualityStrategy",
    "parseQualityTables",
    "parseQualityVerificationDesign",
    "parseQualityVerificationResult",
    "parseReadme",
    "parseRealitySymbolManifest",
    "parseRealityTestCatalog",
    "parseRepositoryProjectContextMarkdown",
    "parseRepositoryQualityProjectionMarkdown",
    "parseRepositoryReleaseProjectionMarkdown",
    "parseSpecAnalysis",
    "parseSpecBehavior",
    "parseSpecDefinition",
    "parseSpecDefinitionCorrespondence",
    "parseSpecDetailCorrespondence",
    "parseSpecDetailIndex",
    "parseSpecIndex",
    "parseSpecSequence",
    "parseTopicMarkdown",
    "parseUiAnalysis",
    "parseUiArea",
    "parseUiComponent",
    "parseUiDefinition",
    "parseUiDetailIndex",
    "parseUiHandoff",
    "parseUiIndex",
    "parseUiScreen",
    "parseUiVisualBaseline",
    "parseUxAnalysis",
    "parseUxDefinition",
    "parseUxExperienceMap",
    "parseUxIndex",
    "parseUxPersonas",
    "parseUxQualityExpectations",
    "parseUxServiceBlueprint",
    "projectProjectOperationSources",
    "publishSemanticCoverage",
    "readRepositoryProjectContext",
    "readTestCatalog",
    "readTopicMeetingList",
    "reenterQualityReview",
    "testLevels",
  ]);
  assert.deepEqual(exportedNames("../../src/index.ts"), [
    "ArchitectureAnalysis",
    "ArchitectureConsistencyRequest",
    "ArchitectureCrossModel",
    "ArchitectureDefinition",
    "ArchitectureDetailMapModel",
    "ArchitectureDetailModel",
    "ArchitectureIndex",
    "ArtifactModel",
    "ArtifactSource",
    "CanonicalDocument",
    "ChangeDocument",
    "ChangeIndex",
    "Changelog",
    "CommunicationDocument",
    "DiscoveryAnalysis",
    "DiscoveryDefinition",
    "DiscoveryIndex",
    "DocumentIssue",
    "DocumentRelationsRequest",
    "FederatedProjectProjection",
    "FederatedProjectSource",
    "FixedQualityCandidate",
    "IaAnalysisModel",
    "IaConsistencyRequest",
    "IaDefinitionModel",
    "IaIndexModel",
    "IaObjectRelation",
    "IaStateVisibility",
    "IaStructureNavigation",
    "IntegratedQualityGate",
    "LoadedRealitySymbolManifest",
    "MarkdownLinkReference",
    "MeetingOperations",
    "MeetingOutcomeCommandResult",
    "MeetingRecord",
    "MeetingState",
    "ParseResult",
    "PortfolioProjection",
    "ProjectContextSource",
    "ProjectOperationCandidate",
    "ProjectOperationCandidateDecision",
    "ProjectOperationCandidateDecisionResult",
    "ProjectOperationProjection",
    "ProjectOperationRecord",
    "ProjectOperationRecordKind",
    "ProjectOperationSource",
    "PublishSemanticCoverageRequest",
    "PublishSemanticCoverageResult",
    "QualityAnalysis",
    "QualityCenter",
    "QualityCheckResult",
    "QualityCheckStatus",
    "QualityConsistencyRequest",
    "QualityDefinitionModel",
    "QualityDetailAnalysis",
    "QualityIntegration",
    "QualityLocalItemOwnershipModel",
    "QualityRealityAudit",
    "QualitySemanticRelation",
    "QualityStrategy",
    "QualityTables",
    "QualityVerificationDesign",
    "QualityVerificationResult",
    "Readme",
    "RealitySymbolDiscoveryRequest",
    "RealitySymbolDiscoveryResult",
    "RealitySymbolDiscoverySource",
    "RealitySymbolGraph",
    "RealitySymbolManifest",
    "RealitySymbolRepositoryObservation",
    "RealityTestCatalog",
    "ReleaseConsistencyRequest",
    "RepositoryObservationPort",
    "RepositoryProjectContext",
    "RepositoryProjectContextReadResult",
    "RepositoryQualityProjection",
    "RepositoryReleaseProjection",
    "SemanticCoverageBundle",
    "SemanticCoverageGraph",
    "SemanticIr",
    "SourceLocation",
    "SpecAnalysis",
    "SpecBehavior",
    "SpecConsistencyRequest",
    "SpecDefinition",
    "SpecDefinitionCorrespondence",
    "SpecDetailCorrespondence",
    "SpecDetailIndex",
    "SpecIndex",
    "SpecSequence",
    "TestCatalog",
    "TestCatalogEntry",
    "TestCatalogReadResult",
    "TestLevel",
    "TopicMeetingAccess",
    "TopicMeetingDocument",
    "TopicMeetingListQuery",
    "TopicMeetingListReadResult",
    "TopicMeetingPage",
    "TopicMeetingRelation",
    "TopicMeetingRelationSource",
    "TopicMeetingWriteResult",
    "TopicOperations",
    "TopicPromotionCommandResult",
    "TopicRecord",
    "TopicState",
    "UiAnalysis",
    "UiArea",
    "UiComponent",
    "UiConsistencyRequest",
    "UiDefinition",
    "UiDetailIndex",
    "UiHandoff",
    "UiIndex",
    "UiScreen",
    "UiVisualBaseline",
    "UxAnalysisModel",
    "UxConsistencyRequest",
    "UxDefinitionModel",
    "UxExperienceMap",
    "UxIndexModel",
    "UxPersonas",
    "UxQualityExpectations",
    "UxServiceBlueprint",
    "applyProjectOperationCandidateDecision",
    "compileQualitySemanticRelations",
    "compileSemanticIr",
    "createFilesystemRepositoryObservationPort",
    "createMeetingOperations",
    "createPortfolioProjection",
    "createRealitySymbolGraph",
    "createSemanticBundle",
    "createSemanticCoverageGraph",
    "createTopicOperations",
    "discoverRealitySymbols",
    "evaluateDefinitionPairEvidence",
    "federateTopicMeetingRelations",
    "fixQualityCandidate",
    "inspectArchitectureConsistency",
    "inspectArtifactPlacement",
    "inspectChangeNavigation",
    "inspectChangePlacement",
    "inspectDiscoveryCoverage",
    "inspectDocumentRelations",
    "inspectIaConsistency",
    "inspectQualityAnalysis",
    "inspectQualityConsistency",
    "inspectQualityLocalItemOwnership",
    "inspectReleaseConsistency",
    "inspectReleaseDocuments",
    "inspectSpecConsistency",
    "inspectUiConsistency",
    "inspectUxConsistency",
    "integrateQualityGate",
    "observeRealitySymbolRepository",
    "parseArchitectureAnalysis",
    "parseArchitectureCrossModel",
    "parseArchitectureDefinition",
    "parseArchitectureDetail",
    "parseArchitectureDetailMap",
    "parseArchitectureIndex",
    "parseArtifact",
    "parseCanonicalDocument",
    "parseChangeDocument",
    "parseChangeIndex",
    "parseChangelog",
    "parseCommunication",
    "parseDiscoveryAnalysis",
    "parseDiscoveryDefinition",
    "parseDiscoveryIndex",
    "parseDiscoveryReferences",
    "parseIaAnalysis",
    "parseIaDefinition",
    "parseIaIndex",
    "parseIaObjectRelation",
    "parseIaStateVisibility",
    "parseIaStructureNavigation",
    "parseMarkdownLinkReference",
    "parseMeetingMarkdown",
    "parseQualityAnalysis",
    "parseQualityCenter",
    "parseQualityDefinition",
    "parseQualityDetailAnalysis",
    "parseQualityIntegration",
    "parseQualityRealityAudit",
    "parseQualityStrategy",
    "parseQualityTables",
    "parseQualityVerificationDesign",
    "parseQualityVerificationResult",
    "parseReadme",
    "parseRealitySymbolManifest",
    "parseRealityTestCatalog",
    "parseRepositoryProjectContextMarkdown",
    "parseRepositoryQualityProjectionMarkdown",
    "parseRepositoryReleaseProjectionMarkdown",
    "parseSpecAnalysis",
    "parseSpecBehavior",
    "parseSpecDefinition",
    "parseSpecDefinitionCorrespondence",
    "parseSpecDetailCorrespondence",
    "parseSpecDetailIndex",
    "parseSpecIndex",
    "parseSpecSequence",
    "parseTopicMarkdown",
    "parseUiAnalysis",
    "parseUiArea",
    "parseUiComponent",
    "parseUiDefinition",
    "parseUiDetailIndex",
    "parseUiHandoff",
    "parseUiIndex",
    "parseUiScreen",
    "parseUiVisualBaseline",
    "parseUxAnalysis",
    "parseUxDefinition",
    "parseUxExperienceMap",
    "parseUxIndex",
    "parseUxPersonas",
    "parseUxQualityExpectations",
    "parseUxServiceBlueprint",
    "projectProjectOperationSources",
    "publishSemanticCoverage",
    "readRepositoryProjectContext",
    "readTestCatalog",
    "readTopicMeetingList",
    "reenterQualityReview",
    "testLevels",
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
  assert.equal(typeof domainLibrary.createTopicOperations, "function");
  assert.equal(typeof domainLibrary.parseMeetingMarkdown, "function");
  assert.equal(typeof domainLibrary.createMeetingOperations, "function");
  for (const name of [
    "tableRange",
    "readMetadata",
    "applyTopicPromotion",
    "applyMeetingOutcomeTreatment",
    "omitMarkdownFencedCode",
    "isMarkdownTableSeparator",
    "omitMarkdownCommentsOutsideFencedCode",
    "omitMarkdownCommentsAndFencedCode",
    "parseMarkdownFences",
    "parseMarkdownTableRow",
    "readCanonicalDocumentHeader",
  ])
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
  const releaseValidation = fs.readFileSync(
    path.join(sourceRoot, "release/validation.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    releaseValidation,
    /from\s+["'](?:\.\.\/semantic\/|\.\/parse\.ts)/u,
  );
  const semanticRelations = fs.readFileSync(
    path.join(sourceRoot, "semantic/relations.ts"),
    "utf8",
  );
  assert.doesNotMatch(
    semanticRelations,
    /case\s+["']stable_(?:canonical_documents|release_document|changelog|readme)["']/u,
  );
  const artifactRoot = path.join(sourceRoot, "artifact");
  assert.doesNotMatch(
    semanticRelations,
    /case\s+["'](?:change_navigation|discovery_identity_links)["']/u,
  );
  assert.doesNotMatch(
    semanticRelations,
    /case\s+["'](?:ux_(?:projection|formal_input|analysis_registration|relations)|ia_(?:analysis_coverage|index_coverage|projection|definition|relations))["']/u,
  );
  for (const domain of ["ui", "spec", "ux", "ia", "change", "discovery"]) {
    const validation = fs.readFileSync(
      path.join(sourceRoot, domain, "validation.ts"),
      "utf8",
    );
    assert.doesNotMatch(
      validation,
      /from\s+["'](?:\.\.\/semantic\/|\.\/parse\.ts)/u,
    );
  }
  assert.doesNotMatch(
    semanticRelations,
    /case\s+["'](?:ui_(?:analysis_coverage|index_coverage|relations|detail_coverage)|spec_(?:analysis_coverage|definition_coverage|coverage|detail_coverage))["']/u,
  );
  const architectureRelations = fs.readFileSync(
    path.join(sourceRoot, "architecture/relations.ts"),
    "utf8",
  );
  assert.doesNotMatch(architectureRelations, /from\s+["']\.\.\/semantic\//u);
  assert.doesNotMatch(
    semanticRelations,
    /case\s+["']architecture_(?:cross_model|detail_map_coverage|readiness|registry_coverage|component_coverage|relations|detail_coverage|inputs)["']/u,
  );
  for (const sourcePath of [
    "quality/analysis.ts",
    "quality/definition.ts",
    "quality/verification-tables.ts",
  ]) {
    const qualitySource = fs.readFileSync(
      path.join(sourceRoot, sourcePath),
      "utf8",
    );
    assert.doesNotMatch(qualitySource, /from\s+["']\.\.\/semantic\//u);
  }
  assert.doesNotMatch(
    semanticRelations,
    /case\s+["']quality_(?:design_states|reality_state|definition_relations|goal_local_relations|goals)["']/u,
  );
  const modelDependencies: string[] = [];
  for (const entry of fs.readdirSync(artifactRoot)) {
    if (!entry.endsWith(".ts")) continue;
    const source = fs.readFileSync(path.join(artifactRoot, entry), "utf8");
    for (const match of source.matchAll(/from\s+["'](\.\.\/[^"']+)["']/gu)) {
      modelDependencies.push(`${entry} -> ${match[1]}`);
    }
  }
  assert.deepEqual(modelDependencies, []);
  assert.doesNotMatch(
    fs.readFileSync(path.join(artifactRoot, "types.ts"), "utf8"),
    /UxFormalInputTarget/u,
  );
  assert.match(
    fs.readFileSync(path.join(sourceRoot, "ux", "types.ts"), "utf8"),
    /export type UxFormalInputTarget/u,
  );
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
  const parsed = domainLibrary.parseArtifact({
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
  }).result;
  assert.equal(parsed.canonicalId, "UX-000001");
  assert.deepEqual(parsed.formalInputs, ["REQ-000001"]);
  assert.equal(parsed.status, "Canonical");
  assert.deepEqual(
    parsed.checklist.map(({ result }) => result),
    ["passed", "open"],
  );

  const validation = validateArtifactSchema(parsed, {
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
    [],
  );
  const source = domainLibrary.parseArtifact({
    path: "one.md",
    content: "# REQ-000001 One\n\n要求ID: REQ-000001\n",
  }).result;
  const duplicate = domainLibrary.parseArtifact({
    path: "two.md",
    content: "# REQ-000001 Two\n\n要求ID: REQ-000001\n",
  }).result;
  const outcome = buildArtifactGraph({
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
  assert.equal(typeof domainLibrary.parseRealitySymbolManifest, "function");
  assert.equal("realitySymbolKinds" in domainLibrary, false);
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
  const types = exportedNames("../../src/artifact/types.ts");
  for (const name of [
    "DocumentIssue",
    "DocumentLocation",
    "DocumentResult",
    "DocumentStatus",
    "ParseResult",
  ])
    assert.ok(types.includes(name));
  assert.equal(
    fs.existsSync(new URL("../../src/outcome.ts", import.meta.url)),
    false,
  );
  assert.equal("validateDomainOutcome" in domainLibrary, false);
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
  const invalidContract = domainLibrary.parseRealitySymbolManifest(
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
  const invalidLocation = domainLibrary.parseRealitySymbolManifest(
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

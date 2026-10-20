/**
 * 診断型・収集・変換の表示契約を検証する。
 *
 * @packageDocumentation
 * @responsibility 二shapeの区別、追加順と重複、四Issueの全fieldと不正入力拒否を固定する。
 * @trace RCM-UT-001
 * @trace RCM-UT-002
 * @level UT
 * @scope report、diagnostics
 * @boundary RCM-UT-001=N/A: 純粋変換と局所配列。 / RCM-UT-002=N/A: Process内の不正値検査。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createFindingCollector } from "../../../src/report/collect.ts";
import {
  mapArtifactDomainIssueToCheckerFinding,
  mapUxDomainIssueToFinding,
  mapDiscoveryDomainIssueToFinding,
  mapSpecDomainIssueToFinding,
  mapArchitectureDomainIssueToFinding,
} from "../../../src/report/convert.ts";
import {
  inspectUxDefinition,
  inspectUxAnalysis,
  inspectUxFormalInput,
  inspectUxRelations,
  inspectDiscoveryDefinition,
  inspectDiscoveryAnalysis,
  inspectSpecAnalysis,
  inspectSpecDefinition,
  parseSpecIndex,
  inspectSpecAnalysisCoverage,
  inspectSpecDefinitionCoverage,
  inspectSpecCoverage,
  inspectUiSpecRelations,
  inspectSpecDetailIndex,
  inspectSpecDetailCorrespondence,
  inspectSpecDetailDownstream,
  parseSpecDetailCentralTrace,
  inspectSpecCorrespondence,
  inspectArchitectureAnalysis,
  inspectArchitectureDefinition,
  inspectArchitectureDetailTemplate,
  inspectArchitectureCrossModelIndex,
  inspectArchitectureCrossModel,
  inspectArchitectureDetailMap,
  inspectArchitectureDetail,
  inspectArchitectureDetailCoverage,
  inspectArchitectureAnalysisCoverage,
  parseArchitectureRegistry,
  inspectArchitectureRegistryCoverage,
  inspectArchitectureComponentCoverage,
  inspectArchitectureRelations,
} from "../../../../domain-model/src/index.ts";
import type {
  CheckerFinding,
  DocumentFinding,
} from "../../../src/report/types.ts";
import type { DomainIssue } from "../../../../domain-model/src/index.ts";

/**
 * Architecture集合検査の七診断を表示へ接続する。
 * @responsibility Domain実Issueの順序・位置と旧codeを固定する。
 * @trace RCM-UT-002
 * @precondition 件数・Directory・登録・Component・関係が不一致の入力を用意する。
 * @stimulus 五つのDomain APIと表示変換を実行する。
 * @observation 七診断のcode、重要度、位置と文言を取得する。
 * @oracle 既存の七分類と文言が同じ順序で返る。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期変換。
 */
test("Architectureの関係・網羅性は七つの旧診断へ接続する", () => {
  const one = new Set(["ARCH-000001"]),
    empty = new Set<string>();
  const issues = [
    ...inspectArchitectureAnalysisCoverage({
      sourcePath: "index.md",
      analysisPath: "Analysis",
      analyzedUi: empty,
      analyzedSpec: empty,
      uiIds: new Set(["UI-000001"]),
      specIds: empty,
      actualAnalysisIds: empty,
    }),
    ...inspectArchitectureRegistryCoverage(
      "index.md",
      parseArchitectureRegistry(""),
      one,
    ),
    ...inspectArchitectureComponentCoverage(
      { path: "component.md", content: "" },
      one,
    ),
    ...inspectArchitectureRelations({
      sourcePath: "index.md",
      analysisRelations: new Set(["UI-000001|ARCH-000001"]),
      definitionRelations: new Set(["UI-000002|ARCH-000001"]),
      definitionRelationEntries: [
        "UI-000002|ARCH-000001",
        "UI-000002|ARCH-000001",
      ],
      registryRelations: empty,
      registryRelationEntries: [],
    }),
  ];
  const findings = issues.map(mapArchitectureDomainIssueToFinding);
  assert.deepEqual(
    findings.map((f) => f.code),
    [
      "architecture-analysis-coverage-mismatch",
      "architecture-analysis-directory-coverage-mismatch",
      "architecture-definition-index-coverage-mismatch",
      "architecture-component-definition-coverage-mismatch",
      "architecture-relation-duplicate",
      "architecture-analysis-definition-closure-mismatch",
      "architecture-registry-relation-closure-mismatch",
    ],
  );
  assert.deepEqual(
    findings.map((f) => f.path),
    [
      "index.md",
      "Analysis",
      "index.md",
      "component.md",
      "index.md",
      "index.md",
      "index.md",
    ],
  );
  assert.ok(findings.every((f) => f.severity === "error"));
  assert.deepEqual(
    findings.map((f) => f.message),
    [
      "Architecture must analyze every canonical UI and SPEC definition exactly once.",
      "Architecture analysis directories and canonical UI/SPEC definitions must be an exact set.",
      "The Architecture registry and responsibility definition directories must be an exact set.",
      "The Component responsibility table must link every Architecture definition exactly once, without unknown or duplicate definitions.",
      "Architecture registry and responsibility definitions must not repeat the same input-to-responsibility relation.",
      "UI/SPEC analyses and Architecture definitions must expose the same duplicate-free input-to-responsibility relation set.",
      "The Architecture registry must expose the same UI/SPEC-to-responsibility relation set as the analyses and definitions.",
    ],
  );
});

/**
 * 詳細設計の五つの中立Issueを既存診断へ接続する。
 * @responsibility Map・本文・三閉包の表示順、理由、Pathと旧文言を固定する。
 * @trace RCM-UT-002
 * @precondition 不正なMapと本文、相違する領域・関係集合を用意する。
 * @stimulus Domain検査と既存表示変換を順に実行する。
 * @observation 診断四fieldと理由不足時の例外を取得する。
 * @oracle 五種類が順序どおりに変換され、Checklist理由を失わない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期変換。
 */
test("Architecture詳細設計の実Issueは五分類の旧診断へ届く", () => {
  const artifact = { path: "detail.md", content: "" };
  const issues = [
    ...inspectArchitectureDetailMap(artifact, new Set(["ARCH-000001"])).issues,
    ...inspectArchitectureDetail(artifact, "core", true, "missing_or_duplicate")
      .issues,
    ...inspectArchitectureDetailCoverage({
      sourcePath: artifact.path,
      registeredDetailAreas: new Set(["a"]),
      actualDetailAreas: new Set(["b"]),
      detailMapRelations: new Set(["a|ARCH-000001"]),
      detailDocumentRelations: new Set(["b|ARCH-000001"]),
      detailMapClosureRelations: new Set(["b|ARCH-000001"]),
      actualDefinitions: new Set(["ARCH-000001"]),
      detailCoveredDefinitions: new Set(),
      isArchitectureReady: true,
    }),
  ];
  const findings = issues.map(mapArchitectureDomainIssueToFinding);
  assert.deepEqual(
    findings.map((finding) => [finding.code, finding.path, finding.severity]),
    [
      ["architecture-detail-map-contract-invalid", "detail.md", "error"],
      ["architecture-detail-contract-invalid", "detail.md", "error"],
      ["architecture-detail-area-coverage-mismatch", "detail.md", "error"],
      ["architecture-detail-relation-closure-mismatch", "detail.md", "error"],
      ["architecture-detail-covered-owner-missing", "detail.md", "error"],
    ],
  );
  assert.equal(
    findings[0]?.message,
    "The detail map must expose the area registry and close every canonical ARCH-ID exactly once in its definition closure table.",
  );
  assert.equal(
    findings[1]?.message,
    "Each detailed design area must expose unique relation states, all ten applicability decisions, all eight concern decisions, all six implementation-structure decisions, a structured Quality handoff, one visible fully evaluated Checklist, and no unresolved item when Architecture Ready (missing_or_duplicate).",
  );
  assert.equal(
    findings[2]?.message,
    "The detailed design registry and Details directories must be an exact set.",
  );
  assert.equal(
    findings[3]?.message,
    "The detail map and area documents must expose the same many-to-many ARCH-ID relation set, covering every definition.",
  );
  assert.equal(
    findings[4]?.message,
    "Every canonical ARCH-ID must have at least one Covered detailed-design owner before Architecture Ready; Partial relations may only support that owner.",
  );
  const detail = issues[1];
  assert.ok(detail);
  assert.throws(
    () => mapArchitectureDomainIssueToFinding({ ...detail, details: {} }),
    /invalid_architecture_checklist_failure/u,
  );
});

/**
 * Architecture本文の実Issueを六つの旧診断へ接続する。
 * @responsibility 本文とひな型の分類・Checklist理由・不正入力拒否を固定する。
 * @trace RCM-UT-002
 * @precondition 不正な本文と既知のChecklist理由を用意する。
 * @stimulus Domain検査から表示変換まで実行する。
 * @observation code・Path・重要度・理由付き文言と拒否例外を取得する。
 * @oracle 六Issueが対応する旧診断へ届き、未知kindや理由不足を拒否する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な値変換。
 */
test("Architecture本文の実Issueは六分類の旧診断へ届く", () => {
  const artifact = { path: "architecture.md", content: "" };
  const issues = [
    ...inspectArchitectureAnalysis(
      artifact,
      "UI",
      "UI-000001",
      true,
      "missing_or_duplicate",
    ).issues,
    ...inspectArchitectureDefinition(artifact, "ARCH-000001", true, null)
      .issues,
    ...inspectArchitectureDetailTemplate(artifact, "definition"),
    ...inspectArchitectureDetailTemplate(artifact, "area"),
    ...inspectArchitectureCrossModelIndex(artifact).issues,
    ...inspectArchitectureCrossModel(
      artifact,
      "02_Component_and_Responsibility_Model.md",
      "",
      "",
    ),
  ];
  const findings = issues.map(mapArchitectureDomainIssueToFinding);
  assert.deepEqual(
    findings.map((item) => [item.code, item.path, item.severity]),
    [
      ["architecture-analysis-contract-invalid", "architecture.md", "error"],
      ["architecture-definition-contract-invalid", "architecture.md", "error"],
      [
        "architecture-detail-relation-contract-missing",
        "architecture.md",
        "error",
      ],
      ["architecture-detail-owner-mapping-missing", "architecture.md", "error"],
      ["architecture-cross-model-section-missing", "architecture.md", "error"],
      ["architecture-cross-model-contract-invalid", "architecture.md", "error"],
    ],
  );
  assert.ok(
    findings[0]?.message.endsWith("Architecture Ready (missing_or_duplicate)."),
  );
  assert.ok(findings[1]?.message.endsWith("Architecture Ready."));
  assert.equal(
    findings[4]?.message,
    "The official Architecture reconstruction must register all cross-cutting models before Architecture Ready.",
  );
  assert.equal(
    findings[5]?.message,
    "Architecture cross-cutting models must be registered and expose their required responsibility, boundary, flow, failure, deployment, and Quality handoff structures.",
  );
  const first = issues[0];
  assert.ok(first);
  assert.throws(
    () => mapArchitectureDomainIssueToFinding({ ...first, details: {} }),
    /invalid_architecture_checklist_failure/u,
  );
  assert.throws(
    () => mapArchitectureDomainIssueToFinding({ ...first, kind: "unknown" }),
    /unknown_architecture_domain_issue/u,
  );
});

/**
 * 定義対応Evidenceの全Issueを旧表示へ接続する。
 * @responsibility 閉包・根拠・改訂の三診断と順序、改訂detailsの拒否を固定する。
 * @trace RCM-UT-002
 * @precondition 対応表・理由・固定改訂が欠落する合成入力を用意する。
 * @stimulus Domainで生成したIssueを表示へ変換する。
 * @observation 診断四fieldと不正detailsの例外を取得する。
 * @oracle 旧code・文言・Path・severityと完全一致し、不足値を表示しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な値変換。
 */
test("SPEC定義対応の実Issueは三分類の旧診断へ届く", () => {
  const actual = "a".repeat(64);
  const issues = inspectSpecCorrespondence({
    artifact: { path: "correspondence.md", content: "" },
    pairs: [],
    reasons: [],
    expectedPairs: new Set(["UI-000001|SPEC-000001"]),
    hasInvalidPairEvidence: false,
    recordedFingerprint: undefined,
    actualFingerprint: actual,
  });
  assert.deepEqual(issues.map(mapSpecDomainIssueToFinding), [
    {
      severity: "error",
      code: "ui-spec-correspondence-closure-mismatch",
      path: "correspondence.md",
      message:
        "The UI/SPEC correspondence review must list the same duplicate-free pairs as both canonical definitions and the SPEC registry.",
    },
    {
      severity: "error",
      code: "ui-spec-correspondence-evidence-invalid",
      path: "correspondence.md",
      message:
        "Each UI/SPEC pair must record shared context, coverage, all contract review lenses, and a concrete UI fact, SPEC fact, and relation under one fixed revision.",
    },
    {
      severity: "error",
      code: "ui-spec-correspondence-revision-invalid",
      path: "correspondence.md",
      message: `The UI/SPEC correspondence review must pin the exact current UI/SPEC Definition-set SHA-256 fingerprint (recorded=missing, actual=${actual}).`,
    },
  ]);
  const revision = issues[2];
  assert.ok(revision);
  assert.throws(
    () => mapSpecDomainIssueToFinding({ ...revision, details: { actual } }),
    /invalid_spec_correspondence_recorded_fingerprint/u,
  );
  assert.throws(
    () =>
      mapSpecDomainIssueToFinding({ ...revision, details: { recorded: null } }),
    /invalid_artifact_domain_issue_detail:artifact\.spec\.correspondence-revision-invalid:actual/u,
  );
});

/**
 * Detailの実Issueが従来の表示診断へ変換されるか確認する。
 * @responsibility Domain生成からcode・Path・文言への接続を固定する。
 * @trace RCM-UT-002
 * @precondition 被覆と対応状態が不正な合成本文を用意する。
 * @stimulus 三つのDomain検査を実行し診断へ変換する。
 * @observation 診断の全fieldを取得する。
 * @oracle 旧診断のseverity・code・Path・文言と完全一致する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な値変換。
 */
test("SPEC Detailの実Issueは三分類の旧診断へ届く", () => {
  const issues = [
    ...inspectSpecDetailIndex(
      { path: "detail.md", content: "" },
      new Set(["SPEC-000001"]),
    ).issues,
    ...inspectSpecDetailCorrespondence(
      { path: "correspondence.md", content: "" },
      new Set(),
      [],
      0,
    ),
    ...inspectSpecDetailDownstream({
      path: "downstream.md",
      relations: new Map(),
      architectureDefinitions: [],
      qualityDefinitions: [],
      areas: [],
      central: parseSpecDetailCentralTrace("", ""),
      issued: { screens: new Set(), parts: new Set(), behaviors: new Set() },
      quality: { screens: new Set(), parts: new Set(), behaviors: new Set() },
      architectureDefinitionsCombined: "",
      qualityDefinitionsCombined: "",
      uiDefinitionCount: 1,
      specDefinitionCount: 0,
    }),
  ];
  assert.deepEqual(issues.map(mapSpecDomainIssueToFinding), [
    {
      severity: "error",
      code: "spec-detail-current-coverage-invalid",
      path: "detail.md",
      message:
        "Every current SPEC definition must appear exactly once with one canonical BHV and a derivation reason.",
    },
    {
      severity: "error",
      code: "ui-spec-detail-correspondence-state-invalid",
      path: "correspondence.md",
      message:
        "UI/SPEC Detail correspondence must remain Pass with one unique interaction-to-BHV relation for every Definition pair and bidirectional coverage.",
    },
    {
      severity: "error",
      code: "ui-spec-detail-downstream-coverage-invalid",
      path: "downstream.md",
      message:
        "All issued SCR, PRT, and BHV identities must be covered by Architecture definitions and Quality definitions without set loss.",
    },
  ]);
});

/**
 * SPEC集合照合の九分類を旧診断へ接続する。
 * @responsibility 観測境界ごとのIssue順・codeと表示文言の存在を確認する。
 * @trace RCM-UT-002
 * @precondition 網羅性・重複・件数・三者閉包が不正な合成集合を用意する。
 * @stimulus Domainの各結果を表示へ変換する。
 * @observation 九診断の順序・code・Path・文言を取得する。
 * @oracle 各Issueが元の診断へ届き、途中で省略・統合されない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な値変換。
 */
test("SPEC集合照合の実Issueは九分類の旧診断へ届く", () => {
  const empty = new Set<string>();
  const one = new Set(["a"]);
  const issues = [
    ...inspectSpecAnalysisCoverage({
      specIndexPath: "spec.md",
      specAnalysisRoot: "analysis",
      uxIds: one,
      iaIds: one,
      analyzedUx: empty,
      analyzedIa: empty,
      analysisRelationOccurrences: ["a", "a"],
    }),
    ...inspectSpecDefinitionCoverage({
      specDefinitionsRoot: "definitions",
      specIndexPath: "spec.md",
      definitionRelationOccurrences: ["a", "a"],
      definitionUiPairOccurrences: [],
      registryIds: one,
      actualIds: empty,
    }),
    ...inspectSpecCoverage({
      specIndexPath: "spec.md",
      indexCountRows: [],
      expectedIndexCounts: new Map([["UX定義", 1]]),
      registryRelations: one,
      analysisRelations: empty,
      definitionRelations: empty,
    }),
    ...inspectUiSpecRelations({
      uiDefinitionsRoot: "ui",
      specIndexPath: "spec.md",
      uiPairOccurrences: ["a", "a"],
      registryUiPairs: one,
      definitionUiPairs: empty,
      uiPairs: empty,
    }),
  ];
  const findings = issues.map(mapSpecDomainIssueToFinding);
  assert.deepEqual(
    findings.map((finding) => finding.code),
    [
      "spec-ux-analysis-coverage-mismatch",
      "spec-analysis-relation-duplicate",
      "spec-ia-analysis-coverage-mismatch",
      "spec-definition-relation-duplicate",
      "spec-definition-index-coverage-mismatch",
      "spec-root-coverage-count-mismatch",
      "spec-analysis-definition-closure-mismatch",
      "ui-spec-pair-duplicate",
      "ui-spec-pair-closure-mismatch",
    ],
  );
  for (const finding of findings) {
    assert.equal(finding.severity, "error");
    assert.ok(finding.path.length > 0);
    assert.ok(finding.message.length > 0);
  }
});

/**
 * SPEC本文モデルの全六分類を表示診断へ接続する。
 * @responsibility 実Issueから旧code・文言へ変換し未知分類・不足理由を拒否する。
 * @trace RCM-UT-002
 * @precondition 空分析・空定義と重複登録表を用意する。
 * @stimulus 各モデルを検査しIssueを変換する。
 * @observation code集合・文言・四fieldと例外を取得する。
 * @oracle 六分類が既存診断へ届き、不正な詳細を補完しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的なモデルと表示の接続。
 */
test("SPEC本文の実Issueは六分類の旧診断へ届く", () => {
  const row =
    "| [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | name | UX-000001 | IA-000001 | UI-000001 |";
  const issues = [
    ...inspectSpecAnalysis({ path: "analysis.md", content: "" }, "UX-000001")
      .issues,
    ...inspectSpecAnalysis({ path: "analysis.md", content: "" }, "IA-000001")
      .issues,
    ...inspectSpecDefinition(
      { path: "definition.md", content: "" },
      "SPEC-000001",
    ).issues,
    ...parseSpecIndex({ path: "spec.md", content: `${row}\n${row}` }).issues,
  ];
  const findings = issues.map(mapSpecDomainIssueToFinding);
  assert.deepEqual(
    [...new Set(findings.map((finding) => finding.code))],
    [
      "spec-ux-analysis-contract-invalid",
      "spec-analysis-checklist-invalid",
      "spec-ia-analysis-contract-invalid",
      "spec-definition-contract-invalid",
      "spec-definition-checklist-invalid",
      "spec-registry-relation-duplicate",
    ],
  );
  assert.equal(
    findings[0]?.message,
    "Each SPEC input must be analyzed independently from exactly its own UX or IA definition and must identify at least one SPEC disposition.",
  );
  for (const finding of findings)
    assert.deepEqual(Object.keys(finding), [
      "severity",
      "code",
      "path",
      "message",
    ]);
  const issue = issues[1] as DomainIssue;
  assert.throws(
    () =>
      mapSpecDomainIssueToFinding({ ...issue, kind: "artifact.spec.unknown" }),
    /unknown_spec_domain_issue/u,
  );
  assert.throws(
    () => mapSpecDomainIssueToFinding({ ...issue, details: {} }),
    /invalid_artifact_domain_issue_detail/u,
  );
});

/**
 * 正式入力と二関係閉包の実Issueを旧診断へ変換する。
 * @responsibility 三診断の全文・順序と位置を保持する。
 * @trace RCM-UT-002
 * @precondition 空本文・不正観測と空集合を用意する。
 * @stimulus DomainのIssueを表示へ変換する。
 * @observation 四field診断を取得する。
 * @oracle 正式入力・UX閉包・Journey閉包の旧code・文言と位置が一致する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的なDomainと表示の接続。
 */
test("UX正式入力と関係閉包の実Issueは旧診断を維持する", () => {
  const issues = [
    ...inspectUxFormalInput(
      { path: "analysis.md", content: "" },
      "REQ-000001",
      {
        definitionHasContent: false,
        matchingDefinitionOnly: false,
        hasSourceAnalysis: false,
        hasInvalidDiscoveryTarget: false,
        hasInvalidEntity: false,
        hasUnsafeTarget: false,
      },
    ),
    ...inspectUxRelations({
      uxIndexPath: "ux.md",
      experienceMapPath: "journey.md",
      index: { ids: new Set(), requirementRelations: new Set() },
      analysisRequirementRelations: new Set(),
      canonicalJourneyRelations: new Set(),
      analysisJourneyRelations: new Set(),
    }),
  ];
  assert.deepEqual(issues.map(mapUxDomainIssueToFinding), [
    {
      severity: "error",
      code: "ux-requirement-formal-input-invalid",
      path: "analysis.md",
      message:
        "Each UX requirement analysis must use only its matching Discovery Definition as the formal input; an incomplete Definition must return to Discovery instead of being supplemented from Source Analysis.",
    },
    {
      severity: "error",
      code: "ux-outcome-relation-closure-mismatch",
      path: "ux.md",
      message:
        "Canonical UX outcomes and requirement-analysis New/Same relations must form an exact, bidirectional (REQ, UX) pair set.",
    },
    {
      severity: "error",
      code: "ux-journey-relation-closure-mismatch",
      path: "journey.md",
      message:
        "The Experience Map and requirement analyses must form an exact, bidirectional (REQ, Journey) pair set.",
    },
  ]);
});

/**
 * 探索分析の実Issueを成果物専用の診断へ変換する。
 * @responsibility 定義用文言と混同せず二診断の全文・順序と不足理由拒否を確認する。
 * @trace RCM-UT-002
 * @precondition 空の合成分析を検査する。
 * @stimulus Domainの二Issueを表示へ変換する。
 * @observation 四field診断と例外を取得する。
 * @oracle 分析専用の旧code・文言を保持し理由不足を補完しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な値変換。
 */
test("Discovery分析の実Issueは旧診断を維持する", () => {
  const issues = inspectDiscoveryAnalysis(
    { path: "exploration.md", content: "" },
    "EXP-000001",
  );
  assert.deepEqual(issues.map(mapDiscoveryDomainIssueToFinding), [
    {
      severity: "error",
      code: "discovery-analysis-contract-invalid",
      path: "exploration.md",
      message:
        "Each Discovery analysis must declare its phase-owned artifact type and matching exploration ID.",
    },
    {
      severity: "error",
      code: "discovery-checklist-contract-invalid",
      path: "exploration.md",
      message:
        "Each canonical Discovery analysis must contain one visible, fully evaluated artifact-specific Checklist (missing_or_duplicate).",
    },
  ]);
  assert.throws(
    () =>
      mapDiscoveryDomainIssueToFinding({
        ...(issues[1] as DomainIssue),
        details: {},
      }),
    /invalid_artifact_domain_issue_detail/u,
  );
});

/**
 * 実Domain生成のDiscovery定義Issueを表示診断へ接続する。
 * @responsibility 二診断の全文・順序と未知kind／不足詳細の拒否を確認する。
 * @trace RCM-UT-002
 * @precondition 空の合成定義を検査する。
 * @stimulus 全Issueを表示診断へ変換する。
 * @observation 四field診断と不正入力例外を取得する。
 * @oracle 定義専用の旧code・文言・順序を維持し、不足を補完しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的なDomainと表示の接続。
 */
test("Discovery定義の実Issueは旧診断を維持する", () => {
  const issues = inspectDiscoveryDefinition(
    { path: "requirement.md", content: "" },
    "REQ-000001",
  );
  assert.deepEqual(issues.map(mapDiscoveryDomainIssueToFinding), [
    {
      severity: "error",
      code: "discovery-requirement-definition-contract-invalid",
      path: "requirement.md",
      message:
        "Each adopted Discovery requirement must have a self-contained canonical definition.",
    },
    {
      severity: "error",
      code: "discovery-checklist-contract-invalid",
      path: "requirement.md",
      message:
        "Each canonical Discovery requirement must contain one visible, fully evaluated artifact-specific Checklist (missing_or_duplicate).",
    },
  ]);
  const issue = issues[1] as DomainIssue;
  assert.throws(
    () =>
      mapDiscoveryDomainIssueToFinding({
        ...issue,
        kind: "artifact.discovery.unknown",
      }),
    /unknown_discovery_domain_issue/u,
  );
  assert.throws(
    () => mapDiscoveryDomainIssueToFinding({ ...issue, details: {} }),
    /invalid_artifact_domain_issue_detail/u,
  );
});

/**
 * 実Domain生成のUX分析Issueを全種類変換する。
 * @responsibility 分析専用の六診断の全文と順序、不足Checklist理由の拒否を確認する。
 * @trace RCM-UT-002
 * @precondition 空の合成分析を検査する。
 * @stimulus 全Issueを表示診断へ変換する。
 * @observation 四field診断と不正入力例外を取得する。
 * @oracle 分析専用の旧code・文言と順序を維持し、理由不足を補完しない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的なDomainと表示の接続。
 */
test("UX分析の実Issueは旧診断を維持する", () => {
  const model = inspectUxAnalysis(
    { path: "analysis.md", content: "" },
    "REQ-000001",
    0,
  );
  const messages = [
    [
      "ux-requirement-analysis-contract-invalid",
      "Each UX requirement analysis must declare its REQ and preserve the six-stage visual-first analysis contract from problem and user outcome through synthesis, critical experience, validation, and downstream handoff, with one registry link.",
    ],
    [
      "ux-direct-downstream-handoff-reintroduced",
      "Requirement-specific UX analysis must preserve downstream meaning through IA, Quality Analysis / UX, and post-IA UI/SPEC relations rather than a direct Architecture or Verification handoff.",
    ],
    [
      "ux-checklist-contract-invalid",
      "Each canonical UX analysis must contain one visible, fully evaluated artifact-specific Checklist (missing_or_duplicate).",
    ],
    [
      "ux-requirement-analysis-relation-invalid",
      "Each UX requirement analysis must connect every candidate to a canonical UX outcome and explain New or Same with requirement-specific reasoning.",
    ],
    [
      "ux-requirement-analysis-responsibility-header-invalid",
      "Each UX requirement analysis must declare exactly one responsibility boundary table with the canonical three-column header.",
    ],
    [
      "ux-requirement-analysis-blueprint-disposition-invalid",
      "Each UX requirement analysis must create a requirement-specific Service Blueprint when handoffs shape the experience, or state a reason and reevaluation condition when it is not applicable.",
    ],
  ];
  assert.deepEqual(
    model.issues.map(mapUxDomainIssueToFinding),
    messages.map(([code, message]) => ({
      severity: "error",
      code,
      path: "analysis.md",
      message,
    })),
  );
  assert.throws(
    () =>
      mapUxDomainIssueToFinding({
        ...(model.issues[2] as DomainIssue),
        details: {},
      }),
    /invalid_artifact_domain_issue_detail/u,
  );
});

/**
 * 実Domain生成のUX定義Issueを全種類変換する。
 * @responsibility 定義専用文言と四field、未知kindと不足理由の拒否を確認する。
 * @trace RCM-UT-002
 * @precondition 空の合成UX定義を検査する。
 * @stimulus 全Issueを表示診断へ変換する。
 * @observation code・message・path・severityと不正入力例外を取得する。
 * @oracle 既存三診断の全文と順序を維持し、不正入力を補完しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同期的なDomainと表示の接続。
 */
test("UX定義の実Issueは旧診断を維持する", () => {
  const issues = inspectUxDefinition(
    { path: "ux.md", content: "" },
    "UX-000001",
  );
  const messages = [
    [
      "ux-definition-contract-invalid",
      "Each canonical UX outcome must have a self-contained definition.",
    ],
    [
      "ux-direct-downstream-handoff-reintroduced",
      "Canonical UX definitions must not directly assign Architecture or Verification work; those obligations flow through IA, UI/SPEC, and Quality Analysis / UX.",
    ],
    [
      "ux-checklist-contract-invalid",
      "Each canonical UX definition must contain one visible, fully evaluated artifact-specific Checklist (missing_or_duplicate).",
    ],
  ];
  assert.deepEqual(
    issues.map(mapUxDomainIssueToFinding),
    messages.map(([code, message]) => ({
      severity: "error",
      code,
      path: "ux.md",
      message,
    })),
  );
  const issue = issues[2] as DomainIssue;
  assert.throws(
    () => mapUxDomainIssueToFinding({ ...issue, kind: "artifact.ux.unknown" }),
    /unknown_ux_domain_issue/u,
  );
  assert.throws(
    () => mapUxDomainIssueToFinding({ ...issue, details: {} }),
    /invalid_artifact_domain_issue_detail/u,
  );
});

/**
 * 収集先の独立性と既存診断shapeを検証する。
 *
 * @responsibility 追加順・重複・元Objectと四field文書診断を保持することを確認する。
 * @trace RCM-UT-001
 * @precondition 別々の収集先と同じRule診断を用意する。
 * @stimulus 診断を重複して追加する。
 * @observation 配列・参照・JSON keyを取得する。
 * @oracle 一方だけが追加順どおり変わり、shapeが混ざらない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: 局所配列を使う同期処理。
 */
test("診断収集は追加順・重複を保持し呼出し間で共有しない", () => {
  const first = createFindingCollector();
  const second = createFindingCollector();
  const warning: CheckerFinding = {
    severity: "warning",
    code: "z",
    path: "b.md",
    rule: "rule",
    message: "warning",
    evidence: ["e"],
  };
  const error: CheckerFinding = {
    severity: "error",
    code: "a",
    path: "a.md",
    rule: "rule",
    message: "error",
  };
  first.add(warning);
  first.add(error);
  first.add(warning);
  assert.deepEqual(first.findings, [warning, error, warning]);
  assert.equal(first.findings[0], warning);
  assert.deepEqual(second.findings, []);
  const document: DocumentFinding = {
    severity: "error",
    code: "a",
    path: "a.md",
    message: "document",
  };
  assert.deepEqual(Object.keys(document), [
    "severity",
    "code",
    "path",
    "message",
  ]);
  assert.equal("rule" in document, false);
});

/**
 * Artifact Issueの四種の変換を検証する。
 *
 * @responsibility 既存severity・code・Path・Rule・文言の全fieldを固定する。
 * @trace RCM-UT-001
 * @precondition 四kindと必要なdetailsを持つ固定Issueを使う。
 * @stimulus 本番変換へ渡す。
 * @observation 返却診断全fieldと入力Snapshotを取得する。
 * @oracle 固定期待値に一致し、入力を変更しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の純粋変換。
 */
test("Artifact診断の四kindは既存code・Rule・文言を維持する", () => {
  for (const [kind, code, rule, message] of [
    [
      "artifact.schema.property-missing",
      "artifact-schema-property-missing",
      "schema",
      "Required artifact property is missing: property.",
    ],
    [
      "artifact.schema.section-missing",
      "artifact-schema-section-missing",
      "schema",
      "Required artifact section is missing: Checklist.",
    ],
    [
      "artifact.schema.status-invalid",
      "artifact-schema-status-invalid",
      "schema",
      "Artifact status is outside the declared schema: Draft.",
    ],
    [
      "artifact.relation.canonical-id-duplicate",
      "artifact-canonical-id-duplicate",
      "relation.canonical-id-uniqueness",
      "Canonical ID is declared by more than one artifact: REQ-000001.",
    ],
  ]) {
    const issue: DomainIssue = {
      kind: kind ?? "",
      targetIdentity: "id",
      location: { path: "item.md", line: 4 },
      reason: "fixed",
      details: {
        schemaId: "schema",
        property: "property",
        section: "Checklist",
        status: "Draft",
        canonicalId: "REQ-000001",
      },
    };
    const before = JSON.stringify(issue);
    assert.deepEqual(mapArtifactDomainIssueToCheckerFinding(issue), {
      severity: "error",
      code,
      path: "item.md",
      rule,
      message,
    });
    assert.equal(JSON.stringify(issue), before);
  }
});

/**
 * 未知kindと必須detailの不正を検証する。
 *
 * @responsibility 表示不能を正常診断へ丸めない拒否を確認する。
 * @trace RCM-UT-002
 * @precondition 未知kind、空・数値・欠落detailを使う。
 * @stimulus 本番変換へ渡す。
 * @observation 固定例外を取得する。
 * @oracle いずれも明示拒否となる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-002=N/A: 同期検査。
 */
test("Artifact診断は未知kindと不正detailsを拒否する", () => {
  const base = {
    targetIdentity: "id",
    location: { path: "item.md" },
    reason: "fixed",
  };
  assert.throws(
    () =>
      mapArtifactDomainIssueToCheckerFinding({
        ...base,
        kind: "future",
        details: {},
      }),
    /unknown_artifact_domain_issue:future/u,
  );
  const invalidDetails: readonly DomainIssue["details"][] = [
    {},
    { schemaId: "" },
    { schemaId: 1 },
    { schemaId: "schema" },
  ];
  for (const details of invalidDetails)
    assert.throws(
      () =>
        mapArtifactDomainIssueToCheckerFinding({
          ...base,
          kind: "artifact.schema.property-missing",
          details,
        }),
      /invalid_artifact_domain_issue_detail/u,
    );
});

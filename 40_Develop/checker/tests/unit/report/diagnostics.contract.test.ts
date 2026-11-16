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
import {
  captureArchitectureDetailTemplate,
  captureArchitectureDocument,
} from "../../../../document-model/src/architecture/validation.ts";
import type { DocumentIssue } from "../../../../document-model/src/index.ts";
import {
  inspectArchitectureConsistency,
  inspectArtifactPlacement,
  inspectChangePlacement,
  inspectDiscoveryCoverage,
  inspectDocumentRelations,
  inspectQualityAnalysis,
  inspectQualityConsistency,
  inspectReleaseConsistency,
  inspectSpecConsistency,
  inspectUxConsistency,
  parseArchitectureAnalysis,
  parseArchitectureCrossModel,
  parseArchitectureDefinition,
  parseArchitectureDetail,
  parseArchitectureDetailMap,
  parseArchitectureIndex,
  parseCanonicalDocument,
  parseChangeDocument,
  parseCommunication,
  parseDiscoveryAnalysis,
  parseDiscoveryDefinition,
  parseDiscoveryIndex,
  parseQualityCenter,
  parseQualityDetailAnalysis,
  parseQualityIntegration,
  parseReadme,
  parseSpecAnalysis,
  parseSpecDefinition,
  parseSpecDefinitionCorrespondence,
  parseSpecDetailCorrespondence,
  parseSpecDetailIndex,
  parseSpecIndex,
  parseUiDefinition,
  parseUiIndex,
  parseUxAnalysis,
  parseUxDefinition,
  parseUxIndex,
  parseUxPersonas,
} from "../../../../document-model/src/index.ts";
import { createFindingCollector } from "../../../src/report/collect.ts";
import {
  mapArchitectureDomainIssueToFinding,
  mapArtifactDomainIssueToCheckerFinding,
  mapChangeDomainIssueToFinding,
  mapDiscoveryDomainIssueToFinding,
  mapSpecDomainIssueToFinding,
  mapUxDomainIssueToFinding,
} from "../../../src/report/convert.ts";
import {
  mapDocumentIdentityIssueToFinding,
  mapPhaseDiagramIssueToFinding,
  mapStableReleaseIssueToFinding,
  mapTemplateIssueToFinding,
} from "../../../src/report/document.ts";

/**
 * 移管した版・配置・ひな型Issueを旧表示へ接続する。
 * @responsibility 実Producerからcode・文言・Path・severityを全field固定する。
 * @trace RCM-UT-002
 * @precondition 既知不一致の合成モデル。
 * @stimulus 各完成操作とMapperを呼ぶ。
 * @observation 固定四field。
 * @oracle Rule再検査や文言の変化なし。
 * @cleanup N/A: I/Oなし。
 */
test("Release・配置・ひな型の完成操作は旧診断へ接続する", () => {
  const cases: readonly [
    readonly DocumentIssue[],
    (issue: DocumentIssue) => unknown,
    string,
    string,
    string,
  ][] = [
    [
      inspectReleaseConsistency({
        kind: "roadmap_title",
        document: parseCanonicalDocument({ path: "roadmap.md", content: "" })
          .result,
      }),
      mapDocumentIdentityIssueToFinding,
      "canonical-document-title-mismatch",
      "roadmap.md",
      'Expected canonical title "# CRDD Roadmap"; found "missing".',
    ],
    [
      inspectReleaseConsistency({
        kind: "readme_version",
        readme: parseReadme({ path: "README.md", content: "Version: v0.21.0" })
          .result,
        expectedVersion: "v0.22.0",
      }),
      mapDocumentIdentityIssueToFinding,
      "readme-version-mismatch",
      "README.md",
      "README=v0.21.0, canonical=v0.22.0",
    ],
    [
      inspectReleaseConsistency({
        kind: "stable_tag_identity",
        stableVersion: "v0.22.0",
        hasDifferentCandidateVersion: false,
        stableTagCommit: "a",
        currentHeadCommit: "b",
        path: ".git",
      }),
      mapStableReleaseIssueToFinding,
      "stable-release-tag-identity-mismatch",
      ".git",
      "Official v0.22.0 tag must resolve to the checked HEAD commit.",
    ],
    [
      inspectReleaseConsistency({
        kind: "release_evidence_navigation",
        index: parseCanonicalDocument({ path: "releases.md", content: "" })
          .result,
        evidencePaths: ["ref"],
      }),
      mapStableReleaseIssueToFinding,
      "release-evidence-navigation-incomplete",
      "releases.md",
      "Every Release-owned Evidence file must have one exact navigation link.",
    ],
    [
      inspectArtifactPlacement({ kind: "filename", path: "REQ-000001.md" }),
      mapDocumentIdentityIssueToFinding,
      "stable-id-in-filename",
      "REQ-000001.md",
      "REQ-000001: use the ID inside the owning artifact, not as a filename.",
    ],
    [
      inspectArtifactPlacement({ kind: "evidence_name", path: "old.md" }),
      mapDocumentIdentityIssueToFinding,
      "noncanonical-evidence-filename",
      "old.md",
      "Evidence filenames must use YYMMDD[-HHmm]_<type> with a collision suffix only when needed.",
    ],
    [
      inspectChangePlacement({ kind: "filename", path: "CHG-000001.md" }),
      mapChangeDomainIssueToFinding,
      "legacy-change-trace-layout",
      "CHG-000001.md",
      "Flat CHG Markdown files are not canonical. Use 99_Roadmap/Changes/<CHG-ID>/change.md.",
    ],
    [
      inspectChangePlacement({
        kind: "unrecognized",
        path: "change.md",
        repositoryMode: "generic",
        patterns: ["a", "b"],
      }),
      mapChangeDomainIssueToFinding,
      "change-trace-placement",
      "change.md",
      "The checker cannot recognize this Change Trace path in repository mode generic. Recognized inspection paths: a, b.",
    ],
    [
      parseCommunication(
        { path: "communication.md", content: "" },
        { mode: "template" },
      ).issues,
      mapTemplateIssueToFinding,
      "mandatory-applicability-template-invalid",
      "communication.md",
      "Conditional communication and sequence concerns must keep a visible mandatory applicability evaluation instead of a vague optional instruction.",
    ],
    [
      parseUiIndex(
        { path: "ui.md", content: "" },
        { mode: "template" },
      ).issues.filter(
        (issue) => issue.kind === "artifact.template.authority-invalid",
      ),
      mapTemplateIssueToFinding,
      "mandatory-authority-evaluation-template-invalid",
      "ui.md",
      "The official UI and Architecture root templates must require an owner, a default authority, and an evaluated item-specific authority exception.",
    ],
    [
      inspectChangePlacement({
        kind: "aggregate",
        aggregateName: "CHG-000001",
        document: parseChangeDocument(
          { path: "change.md", content: "" },
          { mode: "canonical" },
        ).result,
      }),
      mapChangeDomainIssueToFinding,
      "change-trace-aggregate-identity-mismatch",
      "change.md",
      "The aggregate directory ID and the Change ID declared by change.md must match exactly.",
    ],
  ];
  for (const [issues, map, code, path, message] of cases)
    assert.deepEqual(issues.map(map), [
      { severity: "error", code, path, message },
    ]);
});

import { mapQualityAnalysisIssueToFinding } from "../../../src/report/quality.ts";

/**
 * Qualityの四比較を旧診断へ接続する。
 * @responsibility 実Producerの複数違反が表示で欠落・統合されないことを固定する。
 * @trace RCM-UT-002
 * @precondition Coverage完備の分析、空リンク、実在余分、欠測件数を用意する。
 * @stimulus Checkerと同じ四比較順でIssueを変換する。
 * @observation code・severity・Path・文言と順序。
 * @oracle 四種類の旧診断を各一件、元順で返す。
 * @cleanup N/A: 外部I/Oなし。
 * @boundary RCM-UT-002=N/A: 同期的な値変換。
 */
test("Qualityの閉包・集合・単位・件数Issueは旧診断の全fieldと順序を保つ", () => {
  const integration = parseQualityIntegration({
    path: "integration.md",
    content: "",
  }).result;
  const analysis = {
    ...inspectQualityAnalysis([], new Set(), integration, "analysis"),
    hasCoverageSections: true,
  };
  const issues = [
    ...inspectQualityConsistency({
      kind: "quality_definition_closure",
      analysis,
      linkedDefinitionPaths: new Set(),
      analysisPath: "integration.md",
    }),
    ...inspectQualityConsistency({
      kind: "quality_definition_coverage",
      analysis,
      linkedDefinitionPaths: new Set(),
      physicalDefinitionPaths: new Set(["orphan.md"]),
      definitionsRoot: "Definitions",
    }),
    ...inspectDocumentRelations({
      kind: "quality_detail_unit_coverage",
      integration,
      physicalDetailUnits: new Set(["unit"]),
      analysisPath: "integration.md",
    }),
    ...inspectQualityConsistency({
      kind: "quality_local_item_count",
      document: parseQualityCenter({ path: "center.md", content: "" }).result,
      localItemOwners: new Map(),
    }),
  ];
  assert.deepEqual(issues.map(mapQualityAnalysisIssueToFinding), [
    {
      severity: "error",
      code: "quality-definition-closure-missing",
      path: "integration.md",
      message:
        "The Quality mapping must connect its verification obligations to meaningful verification definitions.",
    },
    {
      severity: "error",
      code: "quality-definition-set-mismatch",
      path: "Definitions",
      message:
        "The verification definitions on disk must exactly match the objective set linked from the canonical Quality mapping; orphan and unknown objectives are not allowed.",
    },
    {
      severity: "error",
      code: "quality-architecture-detail-unit-coverage-mismatch",
      path: "integration.md",
      message:
        "The Quality integration matrix must process the exact verification-unit set handed off by every current Architecture detail area.",
    },
    {
      severity: "error",
      code: "quality-local-verification-item-count-mismatch",
      path: "center.md",
      message:
        "The declared Local Item count must exist in the canonical design-set table and equal the exact Local Item set owned by current Quality Definitions.",
    },
  ]);
});

/**
 * 三つの被覆Issueを従来の診断へ一意に変換する。
 * @responsibility 実DM Producerから旧code・文言・位置・重要度への接続を固定する。
 * @trace RCM-UT-002
 * @precondition 空の実在集合と一件の期待集合を用意する。
 * @stimulus 既存表示変換へ中立Issueを渡す。
 * @observation 診断の全fieldと順序。
 * @oracle 三つの旧診断を追加・統合せず保持する。
 * @cleanup N/A: 同期値比較と変換のみ。
 * @boundary RCM-UT-002=N/A: 外部I/Oなし。
 */
test("UXとDiscoveryの被覆Issueは旧診断三種類へ接続する", () => {
  const index = {
    ...parseUxIndex({ path: "ux.md", content: "" }).result,
    ids: new Set(["UX-000001"]),
  };
  const discovery = {
    ...parseDiscoveryIndex({ path: "discovery.md", content: "" }).result,
    adoptedRequirementIds: new Set(["REQ-000001"]),
  };
  const observed = new Set<string>();
  const findings = [
    ...inspectUxConsistency({
      kind: "ux_analysis_coverage",
      index,
      expectedRequirementIds: discovery.adoptedRequirementIds,
      actualRequirementIds: observed,
    }).map(mapUxDomainIssueToFinding),
    ...inspectDiscoveryCoverage(discovery, observed).map(
      mapDiscoveryDomainIssueToFinding,
    ),
    ...inspectUxConsistency({
      kind: "ux_definition_coverage",
      index,
      actualIds: observed,
    }).map(mapUxDomainIssueToFinding),
  ];
  assert.deepEqual(findings, [
    {
      severity: "error",
      code: "ux-requirement-analysis-coverage-mismatch",
      path: "ux.md",
      message:
        "Every adopted Discovery requirement must have exactly one UX requirement-analysis directory, regardless of its primary related domains.",
    },
    {
      severity: "error",
      code: "discovery-requirement-definition-coverage-mismatch",
      path: "discovery.md",
      message:
        "Every adopted Discovery requirement must have exactly one canonical requirement definition.",
    },
    {
      severity: "error",
      code: "ux-definition-coverage-mismatch",
      path: "ux.md",
      message:
        "Every canonical UX outcome must have exactly one UX definition.",
    },
  ]);
});

import type {
  CheckerFinding,
  DocumentFinding,
} from "../../../src/report/types.ts";

/**
 * 基本図の実Issueを表示境界で変換し、既存の拒否を維持する。
 * @responsibility 原文判定を再実装せずcode・文言・明示Pathと空文字列の受理を固定する。
 * @trace RCM-UT-002
 * @precondition 実ParserのIssueと不正な搬送値を用意する。
 * @stimulus 専用表示変換へ渡す。
 * @observation 診断全field・入力非変更・固定例外理由を確認する。
 * @oracle 実Issueを旧文言へ変換し、未知kind／非文字列を拒否する。
 * @cleanup N/A: 同期値変換のみ。
 * @boundary RCM-UT-002=N/A: 外部I/Oなし。
 */
test("基本図Issueの表示変換は旧文言・Path・拒否条件を維持する", () => {
  const displayPath = "template/02_UX/01_User_Experience.md";
  const contract = parseUxIndex(
    { path: displayPath, content: "" },
    { mode: "template" },
  ).result.diagramContract;
  assert.ok(contract);
  const issue = contract.issues[0];
  assert.ok(issue);
  const before = JSON.stringify(issue);
  assert.deepEqual(mapPhaseDiagramIssueToFinding(issue, displayPath), {
    severity: "error",
    code: "phase_diagram_disposition_contract_invalid",
    path: displayPath,
    message:
      "工程の基本図処置契約が不完全です: section, `作成`, `既存参照`, `非該当`, `作成不能`, header, 利用の流れ, 重要場面・失敗／回復体験図, サービス提供の流れ",
  });
  assert.deepEqual(
    mapPhaseDiagramIssueToFinding(
      {
        ...issue,
        location: { path: "not-the-display-path.md" },
        details: { missingItems: "" },
      },
      displayPath,
    ),
    {
      severity: "error",
      code: "phase_diagram_disposition_contract_invalid",
      path: displayPath,
      message: "工程の基本図処置契約が不完全です: ",
    },
  );
  for (const invalid of [
    { ...issue, kind: "unknown" },
    { ...issue, details: {} },
    { ...issue, details: { missingItems: 1 } },
  ])
    assert.throws(
      () =>
        mapPhaseDiagramIssueToFinding(
          invalid as unknown as DocumentIssue,
          displayPath,
        ),
      { message: "invalid_phase_diagram_domain_issue" },
    );
  assert.equal(JSON.stringify(issue), before);
});

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
    ...inspectArchitectureConsistency({
      kind: "architecture_inputs",
      sourcePath: "index.md",
      analysisPath: "Analysis",
      analyses: [],
      uiIds: new Set(["UI-000001"]),
      specIds: empty,
      actualAnalysisIds: empty,
    }),
    ...inspectArchitectureConsistency({
      kind: "architecture_registry_coverage",
      sourcePath: "index.md",
      registry: parseArchitectureIndex({ path: "index.md", content: "" }).result
        .registry,
      actualDefinitions: one,
    }),
    ...inspectArchitectureConsistency({
      kind: "architecture_component_coverage",
      model: parseArchitectureCrossModel(
        { path: "component.md", content: "" },
        "02_Component_and_Responsibility_Model.md",
      ).result,
      actualDefinitions: one,
    }),
    ...inspectArchitectureConsistency({
      kind: "architecture_relations",
      ...{
        sourcePath: "index.md",
        analyses: [
          {
            ...architectureComparisonBase.analysis,
            relations: ["UI-000001|ARCH-000001"],
          },
        ],
        definitions: [
          {
            ...architectureComparisonBase.definition,
            relations: ["UI-000002|ARCH-000001", "UI-000002|ARCH-000001"],
          },
        ],
        registry: {
          ...architectureComparisonBase.registry,
          relations: empty,
          relationEntries: [],
        },
      },
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
    ...observeArchitectureMapFixture(
      parseArchitectureDetailMap(artifact),
      new Set(["ARCH-000001"]),
    ).issues,
    ...observeArchitectureFixture(
      parseArchitectureDetail(artifact, "core", {
        checklistSource: architectureChecklistFixture(
          "detail",
          "missing_or_duplicate",
        ),
      }),
      true,
      "detail",
    ).issues,
    ...inspectArchitectureConsistency({
      kind: "architecture_detail_coverage",
      ...{
        sourcePath: artifact.path,
        map: {
          ...architectureComparisonBase.map,
          areas: new Set(["a"]),
          relations: new Set(["a|ARCH-000001"]),
          closureRelations: new Set(["b|ARCH-000001"]),
        },
        details: [
          {
            ...architectureComparisonBase.detail,
            relations: new Set(["b|ARCH-000001"]),
            coveredDefinitions: new Set<string>(),
          },
        ],
        actualDetailAreas: new Set(["b"]),
        actualDefinitions: new Set(["ARCH-000001"]),
        isArchitectureReady: true,
      },
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
    ...observeArchitectureFixture(
      parseArchitectureAnalysis(artifact, "UI", "UI-000001", {
        checklistSource: architectureChecklistFixture(
          "analysis_ui",
          "missing_or_duplicate",
        ),
      }),
      true,
      "analysis",
    ).issues,
    ...observeArchitectureFixture(
      parseArchitectureDefinition(artifact, "ARCH-000001", {
        checklistSource: architectureChecklistFixture("definition", null),
      }),
      true,
      "definition",
    ).issues,
    ...captureArchitectureDetailTemplate(artifact, "definition").issues,
    ...captureArchitectureDetailTemplate(artifact, "area").issues,
    ...parseArchitectureIndex(artifact).issues,
    ...observeArchitectureCrossFixture(
      parseArchitectureCrossModel(
        artifact,
        "02_Component_and_Responsibility_Model.md",
      ),
      parseArchitectureIndex(artifact).result,
    ).issues,
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
  const issues = inspectDocumentRelations({
    kind: "ui_spec_evidence",
    correspondence: parseSpecDefinitionCorrespondence({
      path: "correspondence.md",
      content: "",
    }).result,
    evaluations: [],
    registry: parseSpecIndex({
      path: "registry.md",
      content:
        "| [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | 意味 | UX-000001 | IA-000001 | UI-000001 |",
    }).result,
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
    ...inspectSpecConsistency({
      kind: "spec_detail_coverage",
      detail: parseSpecDetailIndex({ path: "detail.md", content: "" }),
      actualIds: new Set(["SPEC-000001"]),
    }),
    ...inspectDocumentRelations({
      kind: "ui_spec_details",
      correspondence: parseSpecDetailCorrespondence({
        path: "correspondence.md",
        content: "",
      }).result,
      uiDetailIndex: null,
      specDetailIndex: null,
      screens: [],
      definitions: [],
    }),
    ...inspectDocumentRelations({
      kind: "ui_spec_downstream",
      definitions: [],
      uiDetailIndex: null,
      specDetailIndex: null,
      path: "downstream.md",
      architectureDefinitions: [],
      qualityDefinitions: [],
      areas: [],
      architectureTrace: parseArchitectureDetailMap({
        path: "downstream.md",
        content: "",
      }).result.trace,
      qualityTrace: parseQualityDetailAnalysis({
        path: "quality.md",
        content: "",
      }).result.trace,
      architectureDefinitionObservations: [],
      qualityDefinitionObservations: [],
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
  const ui = parseUiDefinition(
    {
      path: "ui.md",
      content:
        "## 対応するSPEC\n- pairs_with: [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md) [SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md)",
    },
    "UI-000001",
  );
  assert.ok(ui.result);
  const empty = new Set<string>();
  const one = new Set(["a"]);
  const issues = [
    ...inspectSpecConsistency({
      kind: "spec_analysis_coverage",
      ...{
        specIndexPath: "spec.md",
        specAnalysisRoot: "analysis",
        uxIds: one,
        iaIds: one,
        analyzedUx: empty,
        analyzedIa: empty,
        analyses: comparisonAnalyses(["a", "a"]),
      },
    }),
    ...inspectSpecConsistency({
      kind: "spec_definition_coverage",
      ...{
        specDefinitionsRoot: "definitions",
        specIndexPath: "spec.md",
        definitions: comparisonDefinitions(["a", "a"]),
        index: comparisonIndex(["a"]),
        actualIds: empty,
      },
    }),
    ...inspectSpecConsistency({
      kind: "spec_coverage",
      ...{
        specIndexPath: "spec.md",
        index: comparisonIndex(["a"], ["a"]),
        observedCounts: {
          uxDefinitions: 1,
          iaDefinitions: 0,
          analyses: 0,
          definitions: 0,
          uiDefinitions: 0,
        },
        analyses: [],
        definitions: [],
      },
    }),
    ...inspectDocumentRelations({
      kind: "ui_spec",
      uiDefinitionsRoot: "ui",
      specIndexPath: "spec.md",
      uiDefinitions: [ui.result],
      specDefinitions: [],
      registry: parseSpecIndex({ path: "spec.md", content: "" }).result,
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
    ...parseSpecAnalysis({ path: "analysis.md", content: "" }, "UX-000001")
      .issues,
    ...parseSpecAnalysis({ path: "analysis.md", content: "" }, "IA-000001")
      .issues,
    ...parseSpecDefinition(
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
  const issue = issues[1] as DocumentIssue;
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
  assert.deepEqual(
    inspectUxConsistency({
      kind: "ux_projection",
      projection: parseUxPersonas({ path: "projection.md", content: "" }).result
        .projection,
      canonicalIds: new Set(["UX-000001"]),
    }).map(mapUxDomainIssueToFinding),
    [
      {
        severity: "error",
        code: "ux-cross-cutting-projection-incomplete",
        path: "projection.md",
        message:
          "Each cross-cutting UX projection must process every canonical UX ID exactly once in its dedicated mapping section.",
      },
    ],
  );
  const issues = [
    ...inspectUxConsistency({
      kind: "ux_formal_input",
      analysis: parseUxAnalysis(
        { path: "analysis.md", content: "" },
        "REQ-000001",
      ).result,
      observation: {
        definitionHasContent: false,
        matchingDefinitionOnly: false,
        hasSourceAnalysis: false,
        hasInvalidDiscoveryTarget: false,
        hasInvalidEntity: false,
        hasUnsafeTarget: false,
      },
    }),
    ...inspectUxConsistency({
      kind: "ux_relations",
      ...{
        uxIndexPath: "ux.md",
        experienceMapPath: "journey.md",
        index: parseUxIndex({ path: "ux.md", content: "" }).result,
        analyses: [],
        experienceMap: null,
      },
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
  const issues = parseDiscoveryAnalysis(
    { path: "exploration.md", content: "" },
    "EXP-000001",
  ).issues;
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
        ...(issues[1] as DocumentIssue),
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
  const issues = parseDiscoveryDefinition(
    { path: "requirement.md", content: "" },
    "REQ-000001",
  ).issues;
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
  const issue = issues[1] as DocumentIssue;
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
  const parsed = parseUxAnalysis(
    { path: "analysis.md", content: "" },
    "REQ-000001",
  );
  const model = {
    ...parsed,
    issues: inspectUxConsistency({
      kind: "ux_analysis_registration",
      analysis: parsed,
      index: parseUxIndex({ path: "ux.md", content: "" }).result,
    }),
  };
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
        ...(model.issues[2] as DocumentIssue),
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
  const issues = parseUxDefinition(
    { path: "ux.md", content: "" },
    "UX-000001",
  ).issues;
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
  const issue = issues[2] as DocumentIssue;
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
    const issue: DocumentIssue = {
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
  const invalidDetails: readonly DocumentIssue["details"][] = [
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

/**
 * Discovery台帳とひな型の完成Parse診断を既存表示へ接続する。
 * @responsibility 旧code・文言・位置と失敗理由不足の拒否を維持する。
 * @trace RCM-UT-002
 * @precondition 空の台帳とひな型を公開Parserで解析する。
 * @stimulus 実Issueを表示変換へ渡す。
 * @observation 四fieldの完全一致と例外を確認する。
 * @oracle 取得側の旧表示と一致し、新しい構造診断を追加しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期値変換。
 */
test("Discovery台帳・ひな型の実Issueは旧Checklist診断を維持する", () => {
  const source = { path: "discovery.md", content: "" };
  const index = parseDiscoveryIndex(source);
  assert.deepEqual(index.issues.map(mapDiscoveryDomainIssueToFinding), [
    {
      severity: "error",
      code: "discovery-checklist-contract-invalid",
      path: "discovery.md",
      message:
        "The canonical Discovery entry must contain one visible, fully evaluated artifact-specific Checklist (missing_or_duplicate).",
    },
  ]);
  for (const parsed of [
    parseDiscoveryIndex(source, { mode: "template" }),
    parseDiscoveryAnalysis(source, "EXP-XXXXXX", { mode: "template" }),
    parseDiscoveryDefinition(source, "REQ-XXXXXX", { mode: "template" }),
  ]) {
    assert.deepEqual(parsed.issues.map(mapDiscoveryDomainIssueToFinding), [
      {
        severity: "error",
        code: "discovery-checklist-template-invalid",
        path: "discovery.md",
        message:
          "Each Discovery template must expose one visible artifact-specific Checklist with unevaluated items and result guidance (missing_or_duplicate).",
      },
    ]);
    assert.throws(
      () =>
        mapDiscoveryDomainIssueToFinding({
          ...(parsed.issues[0] as DocumentIssue),
          details: {},
        }),
      /invalid_artifact_domain_issue_detail/u,
    );
  }
});

/** 本文条件の既存反証へ独立したChecklist断面を与える試験準備。@trace RCM-UT-002 */
function architectureChecklistFixture(
  kind: "analysis_ui" | "analysis_spec" | "definition" | "detail",
  failure: unknown,
) {
  const expected = captureArchitectureDocument(
    { path: "checklist.md", content: "" },
    { kind, mode: "evaluated" },
  ).checklistContract.expectedItems;
  return {
    path: "checklist.md",
    content: failure
      ? ""
      : `## Checklist\n${expected.map((item) => `- [x] ${item}`).join("\n")}`,
  };
}
/** 局所ParseとReady横断比較を一回ずつ行う試験専用の観測。@trace RCM-UT-002 */
function observeArchitectureFixture<
  T extends {
    result: {
      hasUnresolvedResults: boolean;
      source: { path: string };
      checklistContract: { failure: unknown };
    };
    issues: readonly import("../../../../document-model/src/artifact/types.ts").DocumentIssue[];
  },
>(
  parsed: T,
  isReady: boolean,
  documentType: "analysis" | "definition" | "detail",
) {
  const issues = inspectArchitectureConsistency({
    kind: "architecture_readiness",
    document: parsed as never,
    isReady,
    documentType,
  });
  return { ...parsed, status: issues.length ? "partial" : "complete", issues };
}

/** 詳細Mapの局所Parseと外部定義被覆を別々に観測する試験準備。@trace RCM-UT-002 */
function observeArchitectureMapFixture(
  document: ReturnType<typeof parseArchitectureDetailMap>,
  actualDefinitions: ReadonlySet<string>,
) {
  const issues = inspectArchitectureConsistency({
    kind: "architecture_detail_map_coverage",
    document,
    actualDefinitions,
  });
  return {
    ...document,
    status: issues.length ? "partial" : "complete",
    issues,
  };
}

/** 横断本文の局所Parseと登録Index照合を別々に観測する試験準備。@trace RCM-UT-002 */
function observeArchitectureCrossFixture(
  document: ReturnType<typeof parseArchitectureCrossModel>,
  index: ReturnType<typeof parseArchitectureIndex>["result"],
) {
  const issues = inspectArchitectureConsistency({
    kind: "architecture_cross_model",
    document,
    index,
  });
  return {
    ...document,
    status: issues.length ? "partial" : "complete",
    issues,
  };
}

/** SPEC比較の不変の文書準備だけを共有する。 @trace RCM-UT-002 */
const comparisonBase = {
  analysis: parseSpecAnalysis({ path: "analysis.md", content: "" }, "UX-000001")
    .result,
  definition: parseSpecDefinition(
    { path: "definition.md", content: "" },
    "SPEC-000001",
  ).result,
  index: parseSpecIndex({ path: "spec.md", content: "" }).result,
};
/** 関係の出現と重複を持つ新しい分析モデル列を作る。 @trace RCM-UT-002 */
function comparisonAnalyses(keys: readonly string[]) {
  return keys.map((key) => {
    const [expectedIdentity = "", identity = "SPEC-000001"] = key.split("|");
    return {
      ...comparisonBase.analysis,
      expectedIdentity,
      targets: [
        {
          identity,
          target: "fixture.md",
          location: { path: "analysis.md", line: 1 },
        },
      ],
    };
  });
}
/** 関係の出現と重複を持つ新しい定義モデル列を作る。 @trace RCM-UT-002 */
function comparisonDefinitions(
  keys: readonly string[],
  pairKeys: readonly string[] = [],
) {
  const models = keys.map((key) => {
    const [identity = "", expectedIdentity = "SPEC-000001"] = key.split("|");
    return {
      ...comparisonBase.definition,
      expectedIdentity,
      analysisInputs: [
        {
          identity,
          target: "fixture.md",
          location: { path: "definition.md", line: 1 },
        },
      ],
      pairedInterfaces: [],
    };
  });
  return [
    ...models,
    ...pairKeys.map((key) => {
      const [identity = "", expectedIdentity = "SPEC-000001"] = key.split("|");
      return {
        ...comparisonBase.definition,
        expectedIdentity,
        analysisInputs: [],
        pairedInterfaces: [
          {
            identity,
            target: "fixture.md",
            location: { path: "definition.md", line: 1 },
          },
        ],
      };
    }),
  ];
}
/** 台帳登録と件数行を独立したモデルへ差し替える。 @trace RCM-UT-002 */
function comparisonIndex(
  ids: readonly string[],
  relations: readonly string[] = [],
  rows: readonly (readonly string[])[] = [],
) {
  return {
    ...comparisonBase.index,
    source: { ...comparisonBase.index.source },
    entries: ids.map((identity) => ({
      identity,
      name: "fixture",
      definitionTarget: "fixture.md",
      uxIds: relations
        .filter((key) => (key.split("|")[1] ?? ids[0]) === identity)
        .map((key) => key.split("|")[0] ?? ""),
      iaIds: [],
      uiIds: [],
      cells: [],
      location: { path: "spec.md", line: 1 },
    })),
    counts: rows.map((cells) => ({
      inputOrArtifact: cells[0] ?? "",
      count: cells[1] ?? "",
      disposition: cells[2] ?? "",
      cells: [...cells],
      location: { path: "spec.md", line: 1 },
    })),
  };
}

/**
 * 比較入力で変わらない解析済み本文を一度だけ用意する。
 * @responsibility 差分の関係列・集合は各Caseで独立に上書きする。
 * @trace RCM-UT-002
 */
const architectureComparisonBase = {
  analysis: parseArchitectureAnalysis(
    { path: "analysis.md", content: "" },
    "UI",
    "UI-000001",
  ).result,
  definition: parseArchitectureDefinition(
    { path: "definition.md", content: "" },
    "ARCH-000001",
  ).result,
  registry: parseArchitectureIndex({ path: "index.md", content: "" }).result
    .registry,
  map: parseArchitectureDetailMap({ path: "map.md", content: "" }).result,
  detail: parseArchitectureDetail(
    { path: "detail.md", content: "" },
    "area",
    {},
  ).result,
};

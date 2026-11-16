/**
 * Architecture本文モデルの受理条件と部分関係を検証する。
 * @packageDocumentation
 * @responsibility 九観点・入力境界・未確認表・Ready条件・引渡しひな型を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、architecture
 * @boundary RCM-UT-002=N/A: 合成の可視本文と観測済みChecklist理由の同期検査。
 */

import assert from "node:assert/strict";
import test from "node:test";

/**
 * Architectureの初回本文と二回目Checklistを別の出典として捕捉する。
 * @responsibility 局所ParseとReady比較の独立、取得後変更と二重診断の反証を行う。
 * @trace RCM-UT-002
 * @precondition 内容が異なる本文とChecklist本文を用意する。
 * @stimulus 完成Parse後にReadyの横断比較を行う。
 * @observation 両原文、失敗理由、未解決flagと診断数を読む。
 * @oracle Checklistを初回本文で代替せず、局所とReadyの併存を一件へ保つ。
 * @cleanup N/A: 局所値のみ。
 */
test("Architectureの完成Parseは二つの取得断面とReady比較を分離する", () => {
  const body = { path: "body.md", content: "## Checklist\n- OPEN: 未解決" };
  const checklistSource = architectureChecklistFixture("analysis_ui", null);
  const parsed = parseArchitectureAnalysis(body, "UI", "UI-000001", {
    checklistSource,
  });
  assert.equal(parsed.result.source.content, body.content);
  assert.equal(parsed.result.checklistSource.content, checklistSource.content);
  assert.equal(parsed.result.checklistContract.failure, null);
  assert.equal(parsed.result.hasUnresolvedResults, true);
  assert.equal(parsed.issues.length, 1);
  assert.equal(
    inspectArchitectureConsistency({
      kind: "architecture_readiness",
      documentType: "analysis",
      document: parsed,
      isReady: true,
    }).length,
    1,
  );
  body.content = "changed";
  checklistSource.content = "changed";
  assert.notEqual(parsed.result.source.content, body.content);
  assert.notEqual(
    parsed.result.checklistSource.content,
    checklistSource.content,
  );
  assert.throws(
    () =>
      parseArchitectureAnalysis(body, "UI", "UI-000001", {
        mode: null as never,
      }),
    /unknown_architecture_checklist_mode/u,
  );
});

import {
  captureArchitectureDetailTemplate,
  captureArchitectureDocument,
} from "../../../src/architecture/validation.ts";
import {
  inspectEvaluatedChecklist,
  inspectTemplateChecklist,
} from "../../../src/artifact/checklist.ts";
import { omitMarkdownCommentsAndFencedCode } from "../../../src/artifact/markdown.ts";
import {
  inspectArchitectureConsistency,
  parseArchitectureAnalysis,
  parseArchitectureCrossModel,
  parseArchitectureDefinition,
  parseArchitectureDetail,
  parseArchitectureDetailMap,
  parseArchitectureIndex,
} from "../../../src/index.ts";

/**
 * Architecture文書の内容と6種類のChecklist受付を検証する。
 * @responsibility 種別・方式・出典・部分本文と旧構文の失敗理由を保持する。
 * @trace RCM-UT-002
 * @precondition 6種類・両方式と正常／異常の合成本文。
 * @stimulus 原文と明示した条件を文書受付へ渡す。
 * @observation 原文・表・Checklist節・期待列・失敗理由を取得する。
 * @oracle 旧構文検査と一致し、期待列と原文を別受付と共有しない。
 * @cleanup N/A: 同期的な局所値のみ。
 * @boundary 原文からArchitecture内容モデルとChecklist条件。
 */
test("Architecture6種類のChecklistは内容・出典と検査結果を保持する", () => {
  for (const kind of [
    "analysis_ui",
    "analysis_spec",
    "definition",
    "definition_template",
    "detail",
    "detail_template",
  ] as const) {
    for (const mode of ["template", "evaluated"] as const) {
      const request = { kind, mode };
      const first = captureArchitectureDocument(
        { path: "architecture.md", content: "" },
        request,
      );
      const expected = first.checklistContract.expectedItems;
      const inspect =
        mode === "template"
          ? inspectTemplateChecklist
          : inspectEvaluatedChecklist;
      const body = `前文\n| A | B |\n## Checklist\n${mode === "template" ? "[x] [ ] OPEN FAIL N/A 理由\n" : ""}${expected.map((item) => `- [${mode === "template" ? " " : "x"}] ${item}`).join("\n")}`;
      for (const content of [
        "",
        body,
        `<!--\n${body}\n-->`,
        `\x60\x60\x60\n${body}\n\x60\x60\x60`,
        `${body}\n本文`,
        body.replace(expected[0] ?? "", "別項目"),
      ]) {
        const parsed = captureArchitectureDocument(
          { path: "architecture.md", content },
          request,
        );
        assert.equal(
          parsed.checklistContract.failure,
          inspect(content, expected),
        );
        assert.deepEqual(parsed.checklistContract.expectedItems, expected);
        assert.equal(parsed.source.content, content);
        assert.equal(parsed.checklistContract.kind, kind);
        assert.equal(parsed.checklistContract.mode, mode);
        assert.equal(Object.hasOwn(parsed, "issues"), false);
      }
      const source = { path: "architecture.md", content: body };
      const valid = captureArchitectureDocument(source, request);
      source.content = "changed";
      assert.equal(valid.source.content, body);
      assert.equal(valid.tableRows[0]?.location.line, 2);
      assert.equal(valid.checklist[0]?.heading.location.line, 3);
      assert.equal(valid.checklistContract.failure, null);
      (first.checklistContract.expectedItems as string[]).push("only-first");
      assert.notDeepEqual(
        first.checklistContract.expectedItems,
        valid.checklistContract.expectedItems,
      );
      assert.equal(
        captureArchitectureDocument(
          { path: "architecture.md", content: body },
          request,
        ).checklistContract.expectedItems.includes("only-first"),
        false,
      );
    }
  }
  assert.throws(
    () =>
      captureArchitectureDocument({ path: "architecture.md", content: "" }, {
        kind: "unknown",
        mode: "template",
      } as never),
    /unknown_architecture_checklist_kind/u,
  );
  assert.throws(
    () =>
      captureArchitectureDocument({ path: "architecture.md", content: "" }, {
        kind: "index",
        mode: "unknown",
      } as never),
    /unknown_architecture_checklist_mode/u,
  );
});

/**
 * 登録表の出現解析と三者閉包を検証する。
 * @responsibility 最初の定義Link、同一行の全入力、重複と三診断の順序を固定する。
 * @trace RCM-UT-002
 * @precondition 複数定義Linkと重複入力を含む登録行を用意する。
 * @stimulus 登録・Component・最終集合を検査する。
 * @observation 出現配列、集合、診断列を取得する。
 * @oracle 最初の定義だけへ全入力を対応付け、重複と同数差替えを拒否する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期本文・集合検査。
 */
test("Architecture登録表は出現重複と最初の定義Linkを保持する", () => {
  const row =
    "| UI-000001 UI-000001 SPEC-000001 | [A](Definitions/ARCH-000001/architecture_definition.md) [B](Definitions/ARCH-000002/architecture_definition.md) |";
  const registry = parseArchitectureIndex({
    path: "index.md",
    content: `## Architecture定義台帳\n${row}\n${row}\n## 次節\nUI-999999`,
  }).result.registry;
  assert.deepEqual(registry.definitionEntries, ["ARCH-000001", "ARCH-000001"]);
  assert.deepEqual(registry.relationEntries, [
    "UI-000001|ARCH-000001",
    "UI-000001|ARCH-000001",
    "SPEC-000001|ARCH-000001",
    "UI-000001|ARCH-000001",
    "UI-000001|ARCH-000001",
    "SPEC-000001|ARCH-000001",
  ]);
  assert.equal(
    inspectArchitectureConsistency({
      kind: "architecture_registry_coverage",
      sourcePath: "index.md",
      registry: registry,
      actualDefinitions: new Set(["ARCH-000001"]),
    }).length,
    1,
  );
  const single = parseArchitectureIndex({
    path: "index.md",
    content: `## Architecture定義台帳\n${row}`,
  }).result.registry;
  assert.deepEqual(
    inspectArchitectureConsistency({
      kind: "architecture_registry_coverage",
      sourcePath: "index.md",
      registry: single,
      actualDefinitions: new Set(["ARCH-000001"]),
    }),
    [],
  );
  assert.equal(
    inspectArchitectureConsistency({
      kind: "architecture_registry_coverage",
      sourcePath: "index.md",
      registry: single,
      actualDefinitions: new Set(["ARCH-000002"]),
    }).length,
    1,
  );
  const component = {
    path: "component.md",
    content:
      "## 3. Component責務表\n[A](Definitions/ARCH-000001/architecture_definition.md)",
  };
  assert.deepEqual(
    inspectArchitectureConsistency({
      kind: "architecture_component_coverage",
      model: parseArchitectureCrossModel(
        component,
        "02_Component_and_Responsibility_Model.md",
      ).result,
      actualDefinitions: new Set(["ARCH-000001"]),
    }),
    [],
  );
  assert.equal(
    inspectArchitectureConsistency({
      kind: "architecture_component_coverage",
      model: parseArchitectureCrossModel(
        {
          ...component,
          content: `${component.content}\n[A](Definitions/ARCH-000001/architecture_definition.md)`,
        },
        "02_Component_and_Responsibility_Model.md",
      ).result,
      actualDefinitions: new Set(["ARCH-000001"]),
    }).length,
    1,
  );
  const request = {
    sourcePath: "index.md",
    analysisRelations: new Set(["UI-000001|ARCH-000001"]),
    definitionRelations: new Set(["UI-000002|ARCH-000001"]),
    definitionRelationEntries: [
      "UI-000002|ARCH-000001",
      "UI-000002|ARCH-000001",
    ],
    registryRelations: registry.relations,
    registryRelationEntries: registry.relationEntries,
  };
  assert.deepEqual(
    inspectArchitectureConsistency({
      kind: "architecture_relations",
      ...request,
    }).map((issue) => issue.kind),
    [
      "artifact.architecture.relation-duplicate",
      "artifact.architecture.analysis-definition-closure-mismatch",
      "artifact.architecture.registry-relation-closure-mismatch",
    ],
  );
  const empty = new Set<string>();
  assert.deepEqual(
    inspectArchitectureConsistency({
      kind: "architecture_relations",
      ...{
        ...request,
        analysisRelations: empty,
        definitionRelations: empty,
        definitionRelationEntries: [],
        registryRelations: empty,
        registryRelationEntries: [],
      },
    }),
    [],
  );
  const missing = parseArchitectureIndex({ path: "index.md", content: "" })
    .result.registry;
  assert.deepEqual(missing.definitions, empty);
  assert.deepEqual(missing.definitionEntries, []);
  assert.deepEqual(missing.relations, empty);
  assert.deepEqual(missing.relationEntries, []);
  assert.deepEqual(missing.entries, []);
  assert.deepEqual(missing.sections, []);
  assert.equal(registry.entries[0]?.source.location.line, 2);
  assert.equal(registry.entries[1]?.source.location.line, 3);
  assert.deepEqual(registry.entries[0]?.inputs, [
    "UI-000001",
    "UI-000001",
    "SPEC-000001",
  ]);
  const source = {
    path: "index.md",
    content: `<!-- UI-999999 -->\n## Architecture定義台帳\n文中 UI-000001 [A](Definitions/ARCH-000001/architecture_definition.md)\n## Architecture定義台帳\n${row}`,
  };
  const captured = parseArchitectureIndex(source).result.registry;
  source.content = "changed";
  assert.notEqual(captured.source.content, source.content);
  assert.equal(captured.sections.length, 2);
  assert.equal(captured.entries.length, 1);
  assert.equal(captured.entries[0]?.source.location.line, 3);
  assert.deepEqual(captured.relationEntries, ["UI-000001|ARCH-000001"]);
  assert.equal(Object.hasOwn(captured, "issues"), false);
  assert.equal(
    parseArchitectureIndex({
      path: "index.md",
      content: "## Architecture定義台帳\n",
    }).result.registry.sections.length,
    1,
  );
});

/**
 * 詳細Mapの領域関係と定義閉包を検証する。
 * @responsibility 二種類の関係を区別し、同数の別定義と欠落Headerを拒否する。
 * @trace RCM-UT-002
 * @precondition 一定義・一領域の可視Map本文を用意する。
 * @stimulus 定義とHeaderを変更し、同じ行も反復する。
 * @observation 三集合とIssueを取得する。
 * @oracle 同一行の集合化を維持し、未知定義を同数で補完しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("Architecture詳細Mapは領域関係と閉包関係を分離する", () => {
  const row =
    "| [core](Details/core/01_Architecture.md) | ARCH-000001 | 責務 | Ready |";
  const content = `## 2. 詳細設計領域\n| 詳細設計領域 | 対応Architecture定義 | 責務 | 状態 |\n${row}\n${row}\n## 3. Architecture定義の閉包\n| Architecture定義 | 基本設計 | 接続する詳細設計領域 |\n| ARCH-000001 | 定義 | core、support |`;
  const artifact = { path: "map.md", content };
  const model = observeArchitectureMapFixture(
    parseArchitectureDetailMap(artifact),
    new Set(["ARCH-000001"]),
  );
  assert.deepEqual([...model.result.areas], ["core"]);
  assert.deepEqual([...model.result.relations], ["core|ARCH-000001"]);
  assert.deepEqual(
    [...model.result.closureRelations],
    ["core|ARCH-000001", "support|ARCH-000001"],
  );
  assert.deepEqual(model.issues, []);
  assert.equal(model.result.source.content, content);
  assert.notEqual(model.result.source, artifact);
  assert.equal(model.result.areaSections.length, 1);
  assert.equal(model.result.areaSections[0]?.heading.location.line, 1);
  assert.equal(Object.hasOwn(model.result, "issues"), false);
  assert.equal(
    observeArchitectureMapFixture(
      parseArchitectureDetailMap(artifact),
      new Set(["ARCH-000002"]),
    ).issues.length,
    1,
  );
  assert.equal(
    observeArchitectureMapFixture(
      parseArchitectureDetailMap({
        ...artifact,
        content: content.replace("対応Architecture定義", "対応定義"),
      }),
      new Set(["ARCH-000001"]),
    ).issues.length,
    1,
  );
});

/**
 * 詳細本文の部分関係、Concern、Readyの差を検証する。
 * @responsibility 不正本文からのCovered抽出と既存の適用語彙を維持する。
 * @trace RCM-UT-002
 * @precondition 全適用観点・Concern・構造・引渡しを持つ最小本文を用意する。
 * @stimulus 各表の状態、重複、欠落、Checklist理由とReadyを変更する。
 * @observation 関係・Covered定義・Issueを取得する。
 * @oracle Candidateで保持できるOPENとReady時の拒否を区別し、有効な引渡し一行の存在条件を維持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("Architecture詳細本文は部分関係と用途別Ready条件を維持する", () => {
  const relation =
    "| [ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md) | 責務 | Covered |";
  const applicabilityNames = [
    "Component Model",
    "Interface Model",
    "Data Flow",
    "State Model",
    "Sequence",
    "Failure／Recovery",
    "Deployment",
    "Observability",
    "Security Boundary",
    "Implementation Structure",
  ];
  const concerns = [
    "Concurrency",
    "Timing",
    "Resource Lifecycle",
    "External Boundary",
    "State／Consistency",
    "Failure／Recovery",
    "Observability",
    "Security／Trust",
  ];
  const structures = [
    "Variation",
    "Common Contract",
    "Creation／Selection",
    "State-dependent Behavior",
    "Composition／Recursion",
    "Lifecycle Ownership",
    "External Boundary",
  ];
  const content = `成果物種別: Architecture詳細設計\n詳細設計領域: core\n## 基本設計との関係\n${relation}\n## 詳細成果物の適用判断\n| 詳細成果物 | 判定 | 理由 | 正本節／成果物 |\n${applicabilityNames.map((name) => `| ${name} | N/A | 理由 | 根拠 |`).join("\n")}\n## Engineering Concern評価\n\`PASS\`: 詳細設計上\n\`N/A\`: Architecture上、そのConcern自体が存在しない\n\`OPEN\`: 未解決の設計事項\n\`FAIL\`: 必須設計と矛盾\n| Concern | Result | Rationale | Evidence／Related ID |\n${concerns.map((name) => `| ${name} | PASS | 理由 | [根拠](#section) |`).join("\n")}\n## Implementation Structure\n| 観点 | 適用 | 判定理由 | 成立させる構造 | 局所責務・不変条件 | 失敗・変更時の影響 | Qualityへの導出キー |\n${structures.map((name) => `| ${name} | N/A | 理由 | 構造 | 条件 | 影響 | key |`).join("\n")}\n## Qualityへの引渡し\n| 導出キー | 設計項目種別 | 対象 | 正常条件 | 反証する失敗 | 主な試験段階 | 外部境界の段階 | 観測 | 終了後条件 | 未確認 |\n| key | component | target | normal | failure | IT | boundary | observation | settled | none |\n| 不正な追加行 |\n## 現行実装との照合\n内容\n## Checklist\n- PASS: 評価済み`;
  const artifact = { path: "core.md", content };
  const model = observeArchitectureFixture(
    parseArchitectureDetail(artifact, "core", {
      checklistSource: architectureChecklistFixture("detail", null),
    }),
    true,
    "detail",
  );
  assert.equal(model.result.source.content, content);
  assert.notEqual(model.result.source, artifact);
  assert.equal(model.result.area, "core");
  assert.equal(model.result.concernSections.length, 1);
  assert.ok(model.result.implementationStructure?.text.includes("Variation"));
  assert.equal(Object.hasOwn(model.result, "issues"), false);
  assert.deepEqual(model.issues, []);
  assert.deepEqual([...model.result.relations], ["core|ARCH-000001"]);
  assert.deepEqual([...model.result.coveredDefinitions], ["ARCH-000001"]);
  const handoff = observeArchitectureFixture(
    parseArchitectureDetail(
      {
        path: "sample.md",
        content:
          "## Qualityへの引渡し\n| key | a | b | c | d | UT／IT | Direct Boundary／System/E2E |\n| key | a | b | c | d | ST | N/A |\n## 次",
      },
      "sample",
      { checklistSource: architectureChecklistFixture("detail", null) },
    ),
    false,
    "detail",
  ).result.qualityHandoff;
  assert.deepEqual([...handoff.units], ["sample|key"]);
  assert.deepEqual([...(handoff.levels.get("sample|key") ?? [])], ["ST"]);
  assert.equal(handoff.boundaryStages.get("sample|key"), "N/A");
  assert.equal(handoff.sections.length, 1);
  assert.equal(handoff.rows.length, 2);
  assert.equal(handoff.rows[0]?.location.line, 2);
  assert.equal(
    observeArchitectureFixture(
      parseArchitectureDetail(
        {
          path: "sample.md",
          content:
            "## Qualityへの引き渡し\n| key | a | b | c | d | IT | Direct Boundary |\n## 次",
        },
        "sample",
        { checklistSource: architectureChecklistFixture("detail", null) },
      ),
      false,
      "detail",
    ).result.qualityHandoff.units.size,
    1,
  );
  assert.equal(
    observeArchitectureFixture(
      parseArchitectureDetail(
        {
          path: "sample.md",
          content:
            "## Qualityへの引き渡し\n| key | a | b | c | d | IT | Direct Boundary |",
        },
        "sample",
        { checklistSource: architectureChecklistFixture("detail", null) },
      ),
      false,
      "detail",
    ).result.qualityHandoff.units.size,
    0,
  );
  for (const modified of [
    content.replace(relation, `${relation}\n${relation}`),
    content.replace("| Covered |", "| Covered | extra |"),
    content.replace("| Concurrency | PASS |", "| Concurrency | BAD |"),
    content.replace(
      "| Component Model | N/A | 理由 | 根拠 |",
      "| Component Model | Required | 理由 | 根拠 |",
    ),
    content.replace("| Variation | N/A | 理由 |", "| Variation | BAD | 理由 |"),
    content.replace("詳細設計領域: core", "詳細設計領域: other"),
  ]) {
    const invalid = observeArchitectureFixture(
      parseArchitectureDetail({ ...artifact, content: modified }, "core", {
        checklistSource: architectureChecklistFixture("detail", null),
      }),
      false,
      "detail",
    );
    assert.equal(invalid.issues.length, 1);
    assert.deepEqual([...invalid.result.coveredDefinitions], ["ARCH-000001"]);
  }
  for (const modified of [
    content.replace("| Concurrency | PASS |", "| Concurrency | OPEN |"),
    content.replace("| Covered |", "| Missing |"),
    content.replace("- PASS: 評価済み", "- OPEN: 未確認"),
  ]) {
    assert.deepEqual(
      observeArchitectureFixture(
        parseArchitectureDetail({ ...artifact, content: modified }, "core", {
          checklistSource: architectureChecklistFixture("detail", null),
        }),
        false,
        "detail",
      ).issues,
      [],
    );
    assert.equal(
      observeArchitectureFixture(
        parseArchitectureDetail({ ...artifact, content: modified }, "core", {
          checklistSource: architectureChecklistFixture("detail", null),
        }),
        true,
        "detail",
      ).issues.length,
      1,
    );
  }
  assert.deepEqual(
    observeArchitectureFixture(
      parseArchitectureDetail(
        {
          ...artifact,
          content: content.replace(
            "| Variation | N/A |",
            "| Variation | OPEN |",
          ),
        },
        "core",
        { checklistSource: architectureChecklistFixture("detail", null) },
      ),
      true,
      "detail",
    ).issues,
    [],
  );
  assert.deepEqual(
    observeArchitectureFixture(
      parseArchitectureDetail(
        { ...artifact, content: content.replace("| Covered |", "| Partial |") },
        "core",
        { checklistSource: architectureChecklistFixture("detail", null) },
      ),
      true,
      "detail",
    ).issues,
    [],
  );
  assert.equal(
    observeArchitectureFixture(
      parseArchitectureDetail(artifact, "core", {
        checklistSource: architectureChecklistFixture(
          "detail",
          "missing_or_duplicate",
        ),
      }),
      false,
      "detail",
    ).issues[0]?.details.checklistFailure,
    "missing_or_duplicate",
  );
});

/**
 * 詳細設計の三閉包診断と順序を検証する。
 * @responsibility 同数差替えとReady時だけのCovered不足を区別する。
 * @trace RCM-UT-002
 * @precondition 不整合な領域・関係・Covered集合を用意する。
 * @stimulus Readyと一致集合へ切り替える。
 * @observation Issue列を取得する。
 * @oracle 三不整合が固定順となり、CandidateではCovered不足だけを省略する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期集合検査。
 */
test("Architecture詳細閉包は領域・関係・Covered所有者を順に検査する", () => {
  const request = {
    sourcePath: "map.md",
    registeredDetailAreas: new Set(["a"]),
    actualDetailAreas: new Set(["b"]),
    detailMapRelations: new Set(["a|ARCH-000001"]),
    detailDocumentRelations: new Set(["b|ARCH-000001"]),
    detailMapClosureRelations: new Set(["b|ARCH-000001"]),
    actualDefinitions: new Set(["ARCH-000001"]),
    detailCoveredDefinitions: new Set<string>(),
    isArchitectureReady: true,
  };
  assert.deepEqual(
    inspectArchitectureConsistency({
      kind: "architecture_detail_coverage",
      ...request,
    }).map((issue) => issue.kind),
    [
      "artifact.architecture.detail-area-coverage-mismatch",
      "artifact.architecture.detail-relation-closure-mismatch",
      "artifact.architecture.detail-covered-owner-missing",
    ],
  );
  assert.equal(
    inspectArchitectureConsistency({
      kind: "architecture_detail_coverage",
      ...{
        ...request,
        isArchitectureReady: false,
      },
    }).length,
    2,
  );
  assert.deepEqual(
    inspectArchitectureConsistency({
      kind: "architecture_detail_coverage",
      ...{
        ...request,
        actualDetailAreas: new Set(["a"]),
        detailDocumentRelations: request.detailMapRelations,
        detailMapClosureRelations: request.detailMapRelations,
        detailCoveredDefinitions: request.actualDefinitions,
      },
    }),
    [],
  );
});

/**
 * 横断モデルの登録と二種類の本文表現を検証する。
 * @responsibility 固定取得順、空登録節、厳密な登録リンクとFence内構造を区別する。
 * @trace RCM-UT-002
 * @precondition 固定文書名と最小のComponentモデル本文を用意する。
 * @stimulus 登録節・リンク・見出し・構造断片を独立に変更する。
 * @observation 取得対象列とIssueを取得する。
 * @oracle 空登録節では取得対象なし、Fence内見出しは必須見出しを充足せず、図のFenceは構造として残る。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("Architecture横断モデルは登録順と可視本文・構造本文を区別する", () => {
  const file = "02_Component_and_Responsibility_Model.md";
  const artifact = { path: "index.md", content: "## Architecture横断モデル\n" };
  const missing = parseArchitectureIndex(artifact);
  assert.deepEqual(missing.result.files, []);
  assert.equal(
    missing.issues[0]?.kind,
    "artifact.architecture.cross-model-section-missing",
  );
  const index = `${artifact.content}[Component](${file})`;
  const capturedIndex = parseArchitectureIndex({
    ...artifact,
    content: index,
  });
  assert.equal(capturedIndex.result.source.content, index);
  assert.equal(capturedIndex.result.sections.length, 1);
  assert.equal(Object.hasOwn(capturedIndex.result, "issues"), false);
  assert.deepEqual(
    parseArchitectureIndex({ ...artifact, content: index }).result.files,
    [
      file,
      "03_Boundary_and_Interface_Model.md",
      "04_Runtime_and_Data_Flow_Model.md",
      "05_Failure_Recovery_and_Resilience_Model.md",
      "06_Deployment_and_Execution_Model.md",
    ],
  );
  const structureContent =
    "## 2. 全体ブロック図\n```text\n図\n```\n## 3. Component責務表\n| Component | 含むArchitecture定義 | 状態Owner | 所有すること | 所有しないこと |\n## 5. QAへ渡す検証単位\n内容";
  const content = omitMarkdownCommentsAndFencedCode(structureContent);
  const captured = observeArchitectureCrossFixture(
    parseArchitectureCrossModel(
      { path: file, content: structureContent },
      file,
    ),
    capturedIndex.result,
  );
  assert.equal(captured.result.source.content, structureContent);
  assert.equal(captured.result.file, file);
  assert.ok(
    captured.result.structureSections
      .get("## 2. 全体ブロック図")?.[0]
      ?.text.includes("```text"),
  );
  assert.equal(
    captured.result.visibleLines.some((line) => line.text.includes("```text")),
    false,
  );
  assert.equal(Object.hasOwn(captured.result, "issues"), false);
  assert.deepEqual(
    observeArchitectureCrossFixture(
      parseArchitectureCrossModel(
        { path: file, content: structureContent },
        file,
      ),
      parseArchitectureIndex({ ...artifact, content: index }).result,
    ).issues,
    [],
  );
  for (const [raw, registered] of [
    [structureContent, index.replace(`](${file})`, `](./${file})`)],
    [structureContent.replace("## 5. QAへ渡す検証単位", ""), index],
    [structureContent.replace("```text", "```mermaid"), index],
    [`\`\`\`text\n${structureContent}\n\`\`\``, index],
  ] as const) {
    assert.equal(
      observeArchitectureCrossFixture(
        parseArchitectureCrossModel({ path: file, content: raw }, file),
        parseArchitectureIndex({ ...artifact, content: registered }).result,
      ).issues[0]?.kind,
      "artifact.architecture.cross-model-contract-invalid",
    );
  }
  assert.throws(
    () =>
      observeArchitectureCrossFixture(
        parseArchitectureCrossModel({ path: file, content }, "unknown.md"),
        parseArchitectureIndex({ ...artifact, content: index }).result,
      ),
    /unknown_architecture_cross_model/u,
  );
});

/**
 * 分析の九観点とUI／SPEC正式入力・Ready条件を検証する。
 * @responsibility 同数差替えと語彙不整合を拒否し、不正本文でもRelationを保持する。
 * @trace RCM-UT-002
 * @precondition 二観点の正しい分析本文を用意する。
 * @stimulus 語彙・行数・入力・重複・Ready条件とChecklist理由を変えて検査する。
 * @observation 関係出現列とIssueを取得する。
 * @oracle 順序違いを受理し、部分関係を保持して各不整合を拒否する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("Architecture分析は九観点の語彙・正式入力・ReadyとRelation出現を維持する", () => {
  const names = [
    "Responsibility",
    "Boundary／Component／Interface",
    "Data／State Ownership",
    "Failure／Recovery",
    "Security／Trust",
    "Quality Constraint",
    "Human Input",
    "Open／Gap",
    "Verification Intent",
  ];
  for (const kind of ["UI", "SPEC"] as const) {
    const id = `${kind}-000001`;
    const rows = names.map(
      (name) =>
        `| ${name} | ${name === "Human Input" || name === "Open／Gap" ? "なし" : "評価済み"} | 具体的な根拠 |`,
    );
    const link =
      "[ARCH-000001](../../Definitions/ARCH-000001/architecture_definition.md)";
    const content = `成果物種別: Architecture分析（${kind}観点）\n分析単位: \`${id}\`\n## 1. 正式入力\n../../../${kind === "UI" ? "04_UI" : "05_SPEC"}/Definitions/${id}/${kind === "UI" ? "ui" : "spec"}_definition.md\n## 2. Architectureへ引き継ぐ${kind}契約\n内容\n## 3. Architecture観点の分析\n### 観点別評価\nHuman Inputの判断者\n| 観点 | 判定 | 根拠・引渡し |\n|---|---|---|\n${rows.join("\n")}\n## 4. Architecture処置\n${link}\n## 5. ${kind === "UI" ? "SPEC" : "UI"}観点との統合時に確認すること\n内容`;
    const artifact = { path: "analysis.md", content };
    const observed = observeArchitectureFixture(
      parseArchitectureAnalysis(artifact, kind, id, {
        checklistSource: architectureChecklistFixture(
          kind === "UI" ? "analysis_ui" : "analysis_spec",
          null,
        ),
      }),
      false,
      "analysis",
    );
    assert.deepEqual(observed.issues, []);
    assert.equal(observed.status, "complete");
    assert.equal(Object.hasOwn(observed.result, "issues"), false);
    assert.equal(observed.result.source.content, content);
    assert.equal(observed.result.view, kind);
    assert.equal(observed.result.expectedIdentity, id);
    assert.ok(observed.result.formalInput[0]?.text.includes(id));
    assert.equal(observed.result.formalInput[0]?.location.line, 3);
    assert.equal(observed.result.inheritedContract.length, 1);
    assert.ok(observed.result.disposition[0]?.text.includes(link));
    assert.equal(observed.result.evaluationRows?.length, 9);
    assert.equal(observed.result.evaluationRows?.[0]?.location.line, 12);
    const repeated = observeArchitectureFixture(
      parseArchitectureAnalysis(
        { ...artifact, content: `${content}\n## 1. 正式入力\nlater` },
        kind,
        id,
        {
          checklistSource: architectureChecklistFixture(
            kind === "UI" ? "analysis_ui" : "analysis_spec",
            null,
          ),
        },
      ),
      false,
      "analysis",
    );
    assert.equal(repeated.result.formalInput.length, 2);
    assert.equal(
      repeated.result.formalInput[0]?.text,
      observed.result.formalInput[0]?.text,
    );
    const malformed = observeArchitectureFixture(
      parseArchitectureAnalysis(
        {
          ...artifact,
          content: content.replace(rows[0] as string, `${rows[0]}\n| wrong |`),
        },
        kind,
        id,
        {
          checklistSource: architectureChecklistFixture(
            kind === "UI" ? "analysis_ui" : "analysis_spec",
            null,
          ),
        },
      ),
      false,
      "analysis",
    );
    assert.equal(malformed.result.evaluationRows, null);
    assert.ok(malformed.result.evaluation[0]?.text.includes("| wrong |"));
    assert.equal(malformed.status, "partial");
    assert.deepEqual(
      observeArchitectureFixture(
        parseArchitectureAnalysis(
          {
            ...artifact,
            content: content.replace(
              rows.join("\n"),
              [...rows].reverse().join("\n"),
            ),
          },
          kind,
          id,
          {
            checklistSource: architectureChecklistFixture(
              kind === "UI" ? "analysis_ui" : "analysis_spec",
              null,
            ),
          },
        ),
        false,
        "analysis",
      ).issues,
      [],
    );
    for (const modified of [
      content.replace(rows[0] as string, ""),
      content.replace(rows[0] as string, `${rows[0]}\n${rows[0]}`),
      content.replace("| Human Input | なし |", "| Human Input | 評価済み |"),
      content.replace("Human Inputの判断者", "判断者なし"),
      content.replace("## 1. 正式入力", "## 1. 正式入力\n01_Discovery"),
      content.replace(link, `${link}\n${link}`),
    ]) {
      const model = observeArchitectureFixture(
        parseArchitectureAnalysis(
          { ...artifact, content: modified },
          kind,
          id,
          {
            checklistSource: architectureChecklistFixture(
              kind === "UI" ? "analysis_ui" : "analysis_spec",
              null,
            ),
          },
        ),
        false,
        "analysis",
      );
      assert.equal(
        model.issues[0]?.kind,
        "artifact.architecture.analysis-contract-invalid",
      );
      assert.ok(model.result.relations.includes(`${id}|ARCH-000001`));
    }
    const blocked = {
      ...artifact,
      content: `${content}\n## Checklist\n- OPEN: 根拠を確認する`,
    };
    assert.deepEqual(
      observeArchitectureFixture(
        parseArchitectureAnalysis(blocked, kind, id, {
          checklistSource: architectureChecklistFixture(
            kind === "UI" ? "analysis_ui" : "analysis_spec",
            null,
          ),
        }),
        false,
        "analysis",
      ).issues,
      [],
    );
    assert.equal(
      observeArchitectureFixture(
        parseArchitectureAnalysis(blocked, kind, id, {
          checklistSource: architectureChecklistFixture(
            kind === "UI" ? "analysis_ui" : "analysis_spec",
            null,
          ),
        }),
        true,
        "analysis",
      ).issues.length,
      1,
    );
    assert.equal(
      observeArchitectureFixture(
        parseArchitectureAnalysis(artifact, kind, id, {
          checklistSource: architectureChecklistFixture(
            kind === "UI" ? "analysis_ui" : "analysis_spec",
            "missing_or_duplicate",
          ),
        }),
        false,
        "analysis",
      ).issues[0]?.details.checklistFailure,
      "missing_or_duplicate",
    );
  }
});

/**
 * 定義の統合入力・未確認表・説明用placeholderを検証する。
 * @responsibility 入力集合との完全一致と両観点統合を確認する。
 * @trace RCM-UT-002
 * @precondition 必須見出し・構造・二入力を持つ定義本文を用意する。
 * @stimulus 未確認表の差替え・説明不足・Ready条件を変えて検査する。
 * @observation 関係出現列とIssueを取得する。
 * @oracle 不正本文からも両関係を保持し、同数差替えとplaceholderを拒否する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("Architecture定義は両分析・未確認表・placeholderとReady条件を維持する", () => {
  const headings = [
    "1. 責務と境界",
    "2. UI観点の入力",
    "3. SPEC観点の入力",
    "4. 両観点の統合判断",
    "5. 構造と依存方向",
    "6. データ・状態・Interface",
    "7. 失敗・回復・観測",
    "8. 品質・保護・運用",
    "9. 互換性・移行・成立済み能力",
    "10. 実装と検証への引き渡し",
    "11. 情報源と現行照合",
  ];
  const structures = [
    "| 状態Owner |",
    "| 所有する責務 |",
    "| 所有しない責務 |",
    "| 主な外部境界 |",
    "| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |",
    "| 入力 | State Owner | Authority | Effect／非該当 |",
    "| 入力 | 保護する失敗境界 | 検証意図 |",
    "| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |",
  ];
  const unknown =
    "### 未確認事項・人間判断・戻り条件\nArchitecture固有の追加人間判断\n| 入力 | 継承する未確認事項 | 判断者 | 現在判定 | 再評価契機 |\n|---|---|---|---|---|\n| UI-000001 | なし | 所有者 | 解消 | 変更時 |\n| SPEC-000001 | なし | 所有者 | 解消 | 変更時 |";
  const content = `成果物種別: Architecture定義\nArchitecture ID: \`ARCH-000001\`\n${headings.map((heading, index) => `## ${heading}\n具体的な契約を説明する。\n${index === 1 ? "[UI-000001](../../Analysis/UI-000001/architecture_analysis.md)" : ""}${index === 2 ? "[SPEC-000001](../../Analysis/SPEC-000001/architecture_analysis.md)" : ""}${index === 3 ? unknown : ""}`).join("\n")}\n${structures.join("\n")}`;
  const artifact = { path: "definition.md", content };
  const observed = observeArchitectureFixture(
    parseArchitectureDefinition(artifact, "ARCH-000001", {
      checklistSource: architectureChecklistFixture("definition", null),
    }),
    false,
    "definition",
  );
  assert.deepEqual(observed.issues, []);
  assert.equal(Object.hasOwn(observed.result, "issues"), false);
  assert.equal(observed.result.expectedIdentity, "ARCH-000001");
  assert.ok(observed.result.uiInput[0]?.text.includes("UI-000001"));
  assert.ok(observed.result.specInput[0]?.text.includes("SPEC-000001"));
  assert.ok(observed.result.structure[0]?.text.includes("具体的な契約"));
  assert.equal(observed.result.unknownRows?.length, 2);
  const source = { ...artifact };
  const independent = observeArchitectureFixture(
    parseArchitectureDefinition(source, "ARCH-000001", {
      checklistSource: architectureChecklistFixture("definition", null),
    }),
    false,
    "definition",
  );
  source.content = "changed";
  assert.equal(independent.result.source.content, content);
  const repeated = observeArchitectureFixture(
    parseArchitectureDefinition(
      { ...artifact, content: `${content}\n## 1. 責務と境界\nlater` },
      "ARCH-000001",
      { checklistSource: architectureChecklistFixture("definition", null) },
    ),
    false,
    "definition",
  );
  assert.equal(repeated.result.responsibility.length, 2);
  assert.equal(
    repeated.result.responsibility[0]?.text,
    observed.result.responsibility[0]?.text,
  );
  for (const modified of [
    content.replace("| SPEC-000001 | なし |", "| SPEC-999999 | なし |"),
    content.replace(
      "## 5. 構造と依存方向\n具体的な契約を説明する。",
      "## 5. 構造と依存方向\n構造。",
    ),
    content.replace(
      "Architecture ID: `ARCH-000001`",
      "Architecture ID: `ARCH-000002`",
    ),
  ]) {
    const model = observeArchitectureFixture(
      parseArchitectureDefinition(
        { ...artifact, content: modified },
        "ARCH-000001",
        { checklistSource: architectureChecklistFixture("definition", null) },
      ),
      false,
      "definition",
    );
    assert.equal(model.issues.length, 1);
    assert.deepEqual(model.result.relations, [
      "UI-000001|ARCH-000001",
      "SPEC-000001|ARCH-000001",
    ]);
  }
  const blocked = {
    ...artifact,
    content: `${content}\n## Checklist\n- FAIL: 上流確認`,
  };
  assert.deepEqual(
    observeArchitectureFixture(
      parseArchitectureDefinition(blocked, "ARCH-000001", {
        checklistSource: architectureChecklistFixture("definition", null),
      }),
      false,
      "definition",
    ).issues,
    [],
  );
  assert.equal(
    observeArchitectureFixture(
      parseArchitectureDefinition(blocked, "ARCH-000001", {
        checklistSource: architectureChecklistFixture("definition", null),
      }),
      true,
      "definition",
    ).issues.length,
    1,
  );
});

/**
 * ひな型のDetail引渡し条件を固定二用途で検証する。
 * @responsibility 定義と領域の異なる見出し・表を混同しない。
 * @trace RCM-UT-002
 * @precondition 各用途の最小構造を持つ可視本文を用意する。
 * @stimulus 正しい用途と異なる用途で検査する。
 * @observation 中立Issueの有無・kindを取得する。
 * @oracle 正しい構造のみ受理し、用途別の既存Issueを返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("Architecture Detailひな型の二用途は既存構造を要求する", () => {
  const definition =
    "### 4.1 UI／SPEC Detailの配置制約\n| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |";
  const area =
    "## 上流UI／SPEC Detailとの関係\n| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |";
  assert.deepEqual(
    captureArchitectureDetailTemplate(
      { path: "template.md", content: definition },
      "definition",
    ).issues,
    [],
  );
  assert.deepEqual(
    captureArchitectureDetailTemplate(
      { path: "template.md", content: area },
      "area",
    ).issues,
    [],
  );
  assert.equal(
    captureArchitectureDetailTemplate(
      { path: "template.md", content: area },
      "definition",
    ).issues[0]?.kind,
    "artifact.architecture.detail-relation-contract-missing",
  );
  assert.equal(
    captureArchitectureDetailTemplate(
      { path: "template.md", content: definition },
      "area",
    ).issues[0]?.kind,
    "artifact.architecture.detail-owner-mapping-missing",
  );
});

/**
 * Architectureひな型の内容と可視評価の分離を検証する。
 * @responsibility 原文・表・必須表現の重複と不足を出典付きで残す。
 * @trace RCM-UT-002
 * @precondition 二種類の固定表現と非表示・重複・部分本文を用意する。
 * @stimulus 原文をひな型内容受付へ渡す。
 * @observation 原文・出現・valid・Issueを取得する。
 * @oracle 旧substring条件を維持し、非表示内容を適合へ読み替えない。
 * @cleanup N/A: 合成値のみ。
 * @boundary Architectureの取得済み原文と内容モデル。
 */
test("Architectureひな型は原文・可視表現・重複と不足を保持する", () => {
  for (const [kind, heading, table] of [
    [
      "definition",
      "### 4.1 UI／SPEC Detailの配置制約",
      "| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |",
    ],
    [
      "area",
      "## 上流UI／SPEC Detailとの関係",
      "| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |",
    ],
  ] as const) {
    const body = `${heading}\n${table}`;
    const source = { path: "template.md", content: `prefix ${body}\n${body}` };
    const parsed = captureArchitectureDetailTemplate(source, kind);
    source.content = "changed";
    assert.notEqual(parsed.result.source.content, source.content);
    assert.equal(parsed.result.valid, true);
    assert.equal(parsed.result.tableRows.length, 2);
    assert.equal(parsed.result.requirements[0]?.occurrences.length, 2);
    assert.equal(
      parsed.result.requirements[0]?.occurrences[1]?.location.line,
      3,
    );
    assert.equal(
      parsed.result.requirements[1]?.occurrences[0]?.location.line,
      2,
    );
    assert.equal(Object.hasOwn(parsed.result, "issues"), false);
    for (const content of [
      `<!--\n${body}\n-->`,
      `\x60\x60\x60md\n${body}\n\x60\x60\x60`,
    ]) {
      const hidden = captureArchitectureDetailTemplate(
        { path: "template.md", content },
        kind,
      );
      assert.equal(hidden.result.source.content, content);
      assert.equal(hidden.result.valid, false);
      assert.equal(hidden.issues.length, 1);
      assert.equal(hidden.status, "partial");
      assert.equal(
        hidden.result.requirements.every(
          (item) => item.occurrences.length === 0,
        ),
        true,
      );
    }
    const partial = captureArchitectureDetailTemplate(
      { path: "template.md", content: heading },
      kind,
    );
    assert.equal(partial.result.requirements[0]?.occurrences.length, 1);
    assert.equal(partial.result.requirements[1]?.occurrences.length, 0);
    assert.equal(partial.result.valid, false);
  }
  assert.throws(
    () =>
      captureArchitectureDetailTemplate(
        { path: "template.md", content: "" },
        "unknown" as never,
      ),
    /unknown_architecture_detail_template_kind/u,
  );
});

/**
 * 担当モデルが原文・出典と旧抽出条件を保持するか確認する。
 * @responsibility 最初の所属、列内の先頭ID、行内と別行の重複を区別する。
 * @trace RCM-UT-002
 * @precondition 明示担当と不正行・重複・非表示IDを含む取得済み本文。
 * @stimulus 工程Ownerの完成構築入口を呼ぶ。
 * @observation モデルの値・出典・原文と後勝ち対応。
 * @oracle 欠測を補完せず、担当宣言を実検証済みにしない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary 同一Processの工程モデル構築。
 */

test("Architecture担当モデルは定義・領域と原文出典を区別する", () => {
  const key = "PRT-000001.spec-000001";
  const assignment = `担当Interaction Relation: ${key}`;
  const content = `| SCR-000001 | UI-000001 UI-000002 |\n| BHV-000001 | SPEC-000001 SPEC-000002 |\n${assignment}\n${assignment}\n ${assignment}`;
  const source = { path: "definition.md", content };
  const definition = parseArchitectureDefinition(source, "ARCH-000001").result
    .assignment;
  assert.deepEqual([...definition.uiIds], ["UI-000001"]);
  assert.deepEqual([...definition.specIds], ["SPEC-000001"]);
  assert.deepEqual(definition.relations, [key, key]);
  assert.equal(definition.hasDuplicateRelations, false);
  assert.equal(definition.declarations[0]?.location.line, 3);
  assert.equal(definition.declarations[1]?.location.line, 4);
  assert.equal(definition.tableRows.length, 2);
  assert.equal(definition.expectedIdentity, "ARCH-000001");
  assert.equal(definition.kind, "definition");
  source.content = "replaced";
  assert.equal(definition.source.content, content);
  const area = parseArchitectureDetail(
    {
      path: "area.md",
      content: `[UI／SPEC Detail Architecture Traceability] ARCH-000001\n[UI／SPEC Detail Architecture Traceability] ARCH-000002\n${assignment} ${key}`,
    },
    "area",
  ).result.assignment;
  assert.deepEqual([...area.architectureIds], ["ARCH-000001"]);
  assert.deepEqual(area.relations, [key, key]);
  assert.equal(area.hasDuplicateRelations, true);
  assert.equal(area.architectureDeclaration?.location.line, 1);
  const absent = parseArchitectureDetail(
    {
      path: "area.md",
      content:
        "[UI／SPEC Detail Architecture Traceability]\n[UI／SPEC Detail Architecture Traceability] ARCH-000002",
    },
    "area",
  ).result.assignment;
  assert.deepEqual([...absent.architectureIds], []);
  assert.equal(absent.architectureDeclaration?.location.line, 1);
});

/**
 * 担当モデルが原文・出典と旧抽出条件を保持するか確認する。
 * @responsibility 最初の所属、列内の先頭ID、行内と別行の重複を区別する。
 * @trace RCM-UT-002
 * @precondition 明示担当と不正行・重複・非表示IDを含む取得済み本文。
 * @stimulus 工程Ownerの完成構築入口を呼ぶ。
 * @observation モデルの値・出典・原文と後勝ち対応。
 * @oracle 欠測を補完せず、担当宣言を実検証済みにしない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary 同一Processの工程モデル構築。
 */

test("Architecture中央担当モデルは不正行ID・空領域・後勝ちを保持する", () => {
  const key = "PRT-000001.spec-000001";
  const row = `| ${key} | BHV-000001 | ARCH-000001 | Single | | Covered |`;
  const content = `${row}\n${row.replace("BHV-000001", "BHV-000002")}\n${row} extra |\nSCR-000099\n<!-- SCR-999999 -->\n\`\`\`\nBHV-999999\n\`\`\``;
  const model = parseArchitectureDetailMap({ path: "trace.md", content }).result
    .trace;
  assert.equal(model.relationRows, 2);
  assert.equal(model.relations.get(key)?.bhv, "BHV-000002");
  assert.deepEqual([...(model.relations.get(key)?.areas ?? [])], [""]);
  assert.equal(model.hasDuplicateRelations, true);
  assert.deepEqual([...model.screens], ["SCR-000099"]);
  assert.deepEqual([...model.behaviors], ["BHV-000001", "BHV-000002"]);
  assert.equal(model.tableRows.length, 3);
  assert.equal(model.source.content, content);
  assert.equal(model.tableRows[1]?.location.line, 2);
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
    issues: readonly import("../../../src/artifact/types.ts").DocumentIssue[];
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

/**
 * 分析件数とDirectory完全集合の違いを検証する。
 * @responsibility 第一条件を集合一致へ強めず、余分なDirectoryを別条件で拒否する。
 * @trace RCM-UT-002
 * @precondition 期待入力と同数の別ID分析を用意する。
 * @stimulus 実Directoryと件数を独立に変更する。
 * @observation 診断kindと位置を取得する。
 * @oracle 件数だけの差とDirectory差を固定順で返し、空集合を受理する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期集合検査。
 */
test("Architecture分析は件数とDirectory集合の条件を区別する", () => {
  const request = {
    sourcePath: "index.md",
    analysisPath: "Analysis",
    analyses: [
      observeArchitectureFixture(
        parseArchitectureAnalysis(
          { path: "ui.md", content: "" },
          "UI",
          "UI-999999",
          {
            checklistSource: architectureChecklistFixture("analysis_ui", null),
          },
        ),
        false,
        "analysis",
      ).result,
      observeArchitectureFixture(
        parseArchitectureAnalysis(
          { path: "spec.md", content: "" },
          "SPEC",
          "SPEC-999999",
          {
            checklistSource: architectureChecklistFixture(
              "analysis_spec",
              null,
            ),
          },
        ),
        false,
        "analysis",
      ).result,
    ],
    uiIds: new Set(["UI-000001"]),
    specIds: new Set(["SPEC-000001"]),
    actualAnalysisIds: new Set(["UI-000001", "SPEC-000001"]),
  };
  assert.deepEqual(
    inspectArchitectureConsistency({ kind: "architecture_inputs", ...request }),
    [],
  );
  assert.deepEqual(
    inspectArchitectureConsistency({
      kind: "architecture_inputs",
      ...request,
      analyses: request.analyses.filter((model) => model.view === "SPEC"),
      actualAnalysisIds: new Set(["UI-999999", "SPEC-000001"]),
    }).map((issue) => [issue.kind, issue.location.path]),
    [
      ["artifact.architecture.analysis-coverage-mismatch", "index.md"],
      [
        "artifact.architecture.analysis-directory-coverage-mismatch",
        "Analysis",
      ],
    ],
  );
  assert.deepEqual(
    inspectArchitectureConsistency({
      kind: "architecture_inputs",
      ...request,
      analyses: [],
      uiIds: new Set(),
      specIds: new Set(),
      actualAnalysisIds: new Set(),
    }),
    [],
  );
});

/**
 * 未対応のArchitecture整合種別を正常へ読み替えない。
 * @trace RCM-UT-002
 */
test("未対応のArchitecture整合種別は拒否する", () => {
  assert.throws(
    () => inspectArchitectureConsistency({ kind: "unknown" } as never),
    /architecture_consistency_kind_invalid/u,
  );
});

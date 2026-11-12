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
import {
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
  omitMarkdownCommentsAndFencedCode,
} from "../../../src/index.ts";

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
    analyzedUi: new Set(["UI-999999"]),
    analyzedSpec: new Set(["SPEC-999999"]),
    uiIds: new Set(["UI-000001"]),
    specIds: new Set(["SPEC-000001"]),
    actualAnalysisIds: new Set(["UI-000001", "SPEC-000001"]),
  };
  assert.deepEqual(inspectArchitectureAnalysisCoverage(request), []);
  assert.deepEqual(
    inspectArchitectureAnalysisCoverage({
      ...request,
      analyzedUi: new Set(),
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
    inspectArchitectureAnalysisCoverage({
      ...request,
      analyzedUi: new Set(),
      analyzedSpec: new Set(),
      uiIds: new Set(),
      specIds: new Set(),
      actualAnalysisIds: new Set(),
    }),
    [],
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
  const registry = parseArchitectureRegistry(
    `## Architecture定義台帳\n${row}\n${row}\n## 次節\nUI-999999`,
  );
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
    inspectArchitectureRegistryCoverage(
      "index.md",
      registry,
      new Set(["ARCH-000001"]),
    ).length,
    1,
  );
  const single = parseArchitectureRegistry(`## Architecture定義台帳\n${row}`);
  assert.deepEqual(
    inspectArchitectureRegistryCoverage(
      "index.md",
      single,
      new Set(["ARCH-000001"]),
    ),
    [],
  );
  assert.equal(
    inspectArchitectureRegistryCoverage(
      "index.md",
      single,
      new Set(["ARCH-000002"]),
    ).length,
    1,
  );
  const component = {
    path: "component.md",
    content:
      "## 3. Component責務表\n[A](Definitions/ARCH-000001/architecture_definition.md)",
  };
  assert.deepEqual(
    inspectArchitectureComponentCoverage(component, new Set(["ARCH-000001"])),
    [],
  );
  assert.equal(
    inspectArchitectureComponentCoverage(
      {
        ...component,
        content: `${component.content}\n[A](Definitions/ARCH-000001/architecture_definition.md)`,
      },
      new Set(["ARCH-000001"]),
    ).length,
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
    inspectArchitectureRelations(request).map((issue) => issue.kind),
    [
      "artifact.architecture.relation-duplicate",
      "artifact.architecture.analysis-definition-closure-mismatch",
      "artifact.architecture.registry-relation-closure-mismatch",
    ],
  );
  const empty = new Set<string>();
  assert.deepEqual(
    inspectArchitectureRelations({
      ...request,
      analysisRelations: empty,
      definitionRelations: empty,
      definitionRelationEntries: [],
      registryRelations: empty,
      registryRelationEntries: [],
    }),
    [],
  );
  assert.deepEqual(parseArchitectureRegistry(""), {
    definitions: empty,
    definitionEntries: [],
    relations: empty,
    relationEntries: [],
  });
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
  const model = inspectArchitectureDetailMap(
    artifact,
    new Set(["ARCH-000001"]),
  );
  assert.deepEqual([...model.areas], ["core"]);
  assert.deepEqual([...model.relations], ["core|ARCH-000001"]);
  assert.deepEqual(
    [...model.closureRelations],
    ["core|ARCH-000001", "support|ARCH-000001"],
  );
  assert.deepEqual(model.issues, []);
  assert.equal(
    inspectArchitectureDetailMap(artifact, new Set(["ARCH-000002"])).issues
      .length,
    1,
  );
  assert.equal(
    inspectArchitectureDetailMap(
      {
        ...artifact,
        content: content.replace("対応Architecture定義", "対応定義"),
      },
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
  const model = inspectArchitectureDetail(artifact, "core", true, null);
  assert.deepEqual(model.issues, []);
  assert.deepEqual([...model.relations], ["core|ARCH-000001"]);
  assert.deepEqual([...model.coveredDefinitions], ["ARCH-000001"]);
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
    const invalid = inspectArchitectureDetail(
      { ...artifact, content: modified },
      "core",
      false,
      null,
    );
    assert.equal(invalid.issues.length, 1);
    assert.deepEqual([...invalid.coveredDefinitions], ["ARCH-000001"]);
  }
  for (const modified of [
    content.replace("| Concurrency | PASS |", "| Concurrency | OPEN |"),
    content.replace("| Covered |", "| Missing |"),
    content.replace("- PASS: 評価済み", "- OPEN: 未確認"),
  ]) {
    assert.deepEqual(
      inspectArchitectureDetail(
        { ...artifact, content: modified },
        "core",
        false,
        null,
      ).issues,
      [],
    );
    assert.equal(
      inspectArchitectureDetail(
        { ...artifact, content: modified },
        "core",
        true,
        null,
      ).issues.length,
      1,
    );
  }
  assert.deepEqual(
    inspectArchitectureDetail(
      {
        ...artifact,
        content: content.replace("| Variation | N/A |", "| Variation | OPEN |"),
      },
      "core",
      true,
      null,
    ).issues,
    [],
  );
  assert.deepEqual(
    inspectArchitectureDetail(
      { ...artifact, content: content.replace("| Covered |", "| Partial |") },
      "core",
      true,
      null,
    ).issues,
    [],
  );
  assert.equal(
    inspectArchitectureDetail(artifact, "core", false, "missing_or_duplicate")
      .issues[0]?.details.checklistFailure,
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
    inspectArchitectureDetailCoverage(request).map((issue) => issue.kind),
    [
      "artifact.architecture.detail-area-coverage-mismatch",
      "artifact.architecture.detail-relation-closure-mismatch",
      "artifact.architecture.detail-covered-owner-missing",
    ],
  );
  assert.equal(
    inspectArchitectureDetailCoverage({
      ...request,
      isArchitectureReady: false,
    }).length,
    2,
  );
  assert.deepEqual(
    inspectArchitectureDetailCoverage({
      ...request,
      actualDetailAreas: new Set(["a"]),
      detailDocumentRelations: request.detailMapRelations,
      detailMapClosureRelations: request.detailMapRelations,
      detailCoveredDefinitions: request.actualDefinitions,
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
  const missing = inspectArchitectureCrossModelIndex(artifact);
  assert.deepEqual(missing.files, []);
  assert.equal(
    missing.issues[0]?.kind,
    "artifact.architecture.cross-model-section-missing",
  );
  const index = `${artifact.content}[Component](${file})`;
  assert.deepEqual(
    inspectArchitectureCrossModelIndex({ ...artifact, content: index }).files,
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
  assert.deepEqual(
    inspectArchitectureCrossModel(
      { path: file, content },
      file,
      index,
      structureContent,
    ),
    [],
  );
  for (const [visible, registered, structure] of [
    [content, index.replace(`](${file})`, `](./${file})`), structureContent],
    [content.replace("## 5. QAへ渡す検証単位", ""), index, structureContent],
    [content, index, structureContent.replace("```text", "```mermaid")],
    [
      omitMarkdownCommentsAndFencedCode(
        `\`\`\`text\n${structureContent}\n\`\`\``,
      ),
      index,
      structureContent,
    ],
  ] as const) {
    assert.equal(
      inspectArchitectureCrossModel(
        { path: file, content: visible },
        file,
        registered,
        structure,
      )[0]?.kind,
      "artifact.architecture.cross-model-contract-invalid",
    );
  }
  assert.throws(
    () =>
      inspectArchitectureCrossModel(
        { path: file, content },
        "unknown.md",
        index,
        structureContent,
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
    assert.deepEqual(
      inspectArchitectureAnalysis(artifact, kind, id, false, null).issues,
      [],
    );
    assert.deepEqual(
      inspectArchitectureAnalysis(
        {
          ...artifact,
          content: content.replace(
            rows.join("\n"),
            [...rows].reverse().join("\n"),
          ),
        },
        kind,
        id,
        false,
        null,
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
      const model = inspectArchitectureAnalysis(
        { ...artifact, content: modified },
        kind,
        id,
        false,
        null,
      );
      assert.equal(
        model.issues[0]?.kind,
        "artifact.architecture.analysis-contract-invalid",
      );
      assert.ok(model.relations.includes(`${id}|ARCH-000001`));
    }
    const blocked = {
      ...artifact,
      content: `${content}\n## Checklist\n- OPEN: 根拠を確認する`,
    };
    assert.deepEqual(
      inspectArchitectureAnalysis(blocked, kind, id, false, null).issues,
      [],
    );
    assert.equal(
      inspectArchitectureAnalysis(blocked, kind, id, true, null).issues.length,
      1,
    );
    assert.equal(
      inspectArchitectureAnalysis(
        artifact,
        kind,
        id,
        false,
        "missing_or_duplicate",
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
  assert.deepEqual(
    inspectArchitectureDefinition(artifact, "ARCH-000001", false, null).issues,
    [],
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
    const model = inspectArchitectureDefinition(
      { ...artifact, content: modified },
      "ARCH-000001",
      false,
      null,
    );
    assert.equal(model.issues.length, 1);
    assert.deepEqual(model.relations, [
      "UI-000001|ARCH-000001",
      "SPEC-000001|ARCH-000001",
    ]);
  }
  const blocked = {
    ...artifact,
    content: `${content}\n## Checklist\n- FAIL: 上流確認`,
  };
  assert.deepEqual(
    inspectArchitectureDefinition(blocked, "ARCH-000001", false, null).issues,
    [],
  );
  assert.equal(
    inspectArchitectureDefinition(blocked, "ARCH-000001", true, null).issues
      .length,
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
    inspectArchitectureDetailTemplate(
      { path: "template.md", content: definition },
      "definition",
    ),
    [],
  );
  assert.deepEqual(
    inspectArchitectureDetailTemplate(
      { path: "template.md", content: area },
      "area",
    ),
    [],
  );
  assert.equal(
    inspectArchitectureDetailTemplate(
      { path: "template.md", content: area },
      "definition",
    )[0]?.kind,
    "artifact.architecture.detail-relation-contract-missing",
  );
  assert.equal(
    inspectArchitectureDetailTemplate(
      { path: "template.md", content: definition },
      "area",
    )[0]?.kind,
    "artifact.architecture.detail-owner-mapping-missing",
  );
});

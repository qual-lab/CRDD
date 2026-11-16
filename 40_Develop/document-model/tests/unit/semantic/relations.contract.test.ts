/**
 * 解析済み工程モデルの横断関係を検証する。
 * @packageDocumentation
 * @responsibility UI／SPEC閉包、Architecture入力網羅性と未対応種別の拒否を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope semantic、relations、ui、architecture
 * @boundary 同一Processの解析結果と比較結果。外部Effectなし。
 */

import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { captureArchitectureDocument } from "../../../src/architecture/validation.ts";
import {
  type DocumentRelationsRequest,
  evaluateDefinitionPairEvidence,
  inspectArchitectureConsistency,
  inspectDocumentRelations,
  parseArchitectureDefinition,
  parseArchitectureDetail,
  parseArchitectureDetailMap,
  parseQualityDefinition,
  parseQualityDetailAnalysis,
  parseQualityIntegration,
  parseSpecDefinition,
  parseSpecDefinitionCorrespondence,
  parseSpecDetailCorrespondence,
  parseSpecDetailIndex,
  parseSpecIndex,
  parseUiDefinition,
  parseUiDetailIndex,
  parseUiScreen,
} from "../../../src/index.ts";

/**
 * Architectureからの実在検証単位とQuality統合の被覆を比較する。
 * @responsibility 工程横断の集合一致をSemanticに固定する。
 * @trace RCM-UT-002
 * @precondition 基本モデルだけを共有し、観点ごとの可変集合は独立させる。
 * @stimulus 空・一致・不足・余分・同数差し替えを渡す。
 * @observation Issueの全fieldと集合の非変更。
 * @oracle 旧三条件のいずれかの違反だけを一件返す。
 * @cleanup N/A: 外部I/Oなし。
 * @boundary RCM-UT-002=N/A: 同一Processの値比較。
 */
test("ArchitectureとQualityの検証単位被覆は空集合と双方向の欠落を区別する", () => {
  const base = parseQualityIntegration({
    path: "integration.md",
    content: "",
  }).result;
  for (const [expected, actual, mismatch] of [
    [[], [], false],
    [["a"], ["a"], false],
    [["a"], [], true],
    [[], ["a"], true],
    [["a"], ["b"], true],
    [["a"], ["a", "b"], true],
  ] as const) {
    const analysisDetailUnits = new Set<string>(expected);
    const physicalDetailUnits = new Set<string>(actual);
    const integration = {
      ...base,
      detailUnitData: { ...base.detailUnitData, analysisDetailUnits },
    };
    assert.deepEqual(
      inspectDocumentRelations({
        kind: "quality_detail_unit_coverage",
        integration,
        physicalDetailUnits,
        analysisPath: "integration.md",
      }),
      mismatch
        ? [
            {
              kind: "artifact.quality-analysis.architecture-detail-unit-coverage-mismatch",
              targetIdentity: "integration.md",
              location: { path: "integration.md" },
              reason: "architecture-detail-unit-coverage-mismatch",
              details: {},
            },
          ]
        : [],
    );
    assert.deepEqual([...analysisDetailUnits], expected);
    assert.deepEqual([...physicalDetailUnits], actual);
  }
});

/**
 * 旧Detail対応試験をモデル間比較へ移し、同数差し替えと重複を維持する。
 * @responsibility モデルから期待対応を導出し、Caller製tuple集合を要求しない。
 * @trace RCM-UT-002
 * @precondition 一つの正しいDefinition・Detail・Screen・対応根拠を構築する。
 * @stimulus Screen重複、BHV差替え、根拠重複、Draft化、Definition件数差を独立に与える。
 * @observation 既存kindのIssue列を取得する。
 * @oracle 正常だけ空Issueとなり、各反例は既存combined Issue一件である。
 * @cleanup N/A: 局所値のみ。
 * @boundary 工程モデル間の純粋比較。
 */
test("Detailモデル比較は双方向被覆・出現重複・同数差替えを照合する", () => {
  const row =
    "| SCR-000001 PRT-000001.spec-000001 | BHV-000001 | UI-000001 | SPEC-000001 |";
  const content = `状態: Pass\nDefinition対応とDetail対応を分けた\nUIからBHVへのCoverageを全件評価した\nBHVからUIへのCoverageを全件評価した\n${row}`;
  const screenSource =
    "Screen ID: SCR-999999\n対象UI Definition: UI-000001\n| PRT-000001.spec-000001 | a | b | c | BHV-000001 |";
  const screen = parseUiScreen(
    { path: "screen.md", content: screenSource },
    "SCR-000001",
  ).result;
  const definition = parseSpecDefinition(
    {
      path: "spec.md",
      content:
        "## 対応するUI\n- pairs_with: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)",
    },
    "SPEC-000001",
  );
  assert.ok(definition.result);
  const request = {
    kind: "ui_spec_details" as const,
    correspondence: parseSpecDetailCorrespondence({
      path: "correspondence.md",
      content,
    }).result,
    screens: [screen],
    uiDetailIndex: parseUiDetailIndex({
      path: "ui-detail.md",
      content: "| UI-000001 | a | b | c | SCR-000001 PRT-000001 |",
    }).result,
    specDetailIndex: parseSpecDetailIndex({
      path: "spec-detail.md",
      content: "| SPEC-000001 | a | b | BHV-000001 |",
    }).result,
    definitions: [definition.result],
  };
  assert.deepEqual(inspectDocumentRelations(request), []);
  const extra = parseSpecDefinition(
    {
      path: "spec.md",
      content:
        "## 対応するUI\n- pairs_with: [UI-000002](../../../04_UI/Definitions/UI-000002/ui_definition.md)",
    },
    "SPEC-000001",
  );
  assert.ok(extra.result);
  for (const issues of [
    inspectDocumentRelations({ ...request, screens: [screen, screen] }),
    inspectDocumentRelations({
      ...request,
      screens: [
        parseUiScreen(
          {
            path: "screen.md",
            content: screenSource.replace("BHV-000001", "BHV-000002"),
          },
          "SCR-000001",
        ).result,
      ],
    }),
    inspectDocumentRelations({
      ...request,
      correspondence: parseSpecDetailCorrespondence({
        path: "correspondence.md",
        content: `${content}\n${row}`,
      }).result,
    }),
    inspectDocumentRelations({
      ...request,
      correspondence: parseSpecDetailCorrespondence({
        path: "correspondence.md",
        content: content.replace("状態: Pass", "状態: Draft"),
      }).result,
    }),
    inspectDocumentRelations({
      ...request,
      definitions: [definition.result, extra.result],
    }),
    inspectDocumentRelations({
      ...request,
      screens: [
        parseUiScreen(
          {
            path: "screen.md",
            content: screenSource.replace(
              "対象UI Definition: UI-000001",
              "missing",
            ),
          },
          "SCR-000001",
        ).result,
      ],
    }),
    inspectDocumentRelations({
      ...request,
      uiDetailIndex: null,
      specDetailIndex: null,
    }),
  ])
    assert.deepEqual(
      issues.map((issue) => issue.kind),
      ["artifact.spec.detail-correspondence-state-invalid"],
    );
  assert.deepEqual(
    inspectDocumentRelations({
      ...request,
      screens: [],
      uiDetailIndex: null,
      specDetailIndex: null,
      definitions: [],
      correspondence: parseSpecDetailCorrespondence({
        path: "correspondence.md",
        content: content.replace(row, ""),
      }).result,
    }),
    [],
  );
});

/**
 * 対応根拠のひな型・現行節名と完全関係の出現位置を保持する。
 * @responsibility 正本文書を改名せず、Gapと引渡しを名前付き内容として捕捉する。
 * @trace RCM-UT-002
 * @precondition 両節形、節外の複数ID、不完全行と隠れた行を与える。
 * @stimulus 完成Parserでモデル化する。
 * @observation 節、関係、位置、原文を取得する。
 * @oracle 完全行は最初のIDで取得し、不完全・隠れた行を新しい関係へ補完しない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋な対応根拠モデル構築。
 */
test("Detail対応根拠モデルは両節形と出典を保持する", () => {
  const row =
    "| SCR-000001 SCR-000002 PRT-000001.spec-000001 | BHV-000001 BHV-000002 | UI-000001 UI-000002 | SPEC-000001 SPEC-000002 |";
  const content = [
    "## 1. 対象範囲",
    "ひな型",
    "## 4. Definitionへ戻すGap",
    "不足を戻す",
    "## 5. Architecture／Qualityへの引き渡し",
    "未解決を渡す",
    "## 1. 対象と判定境界",
    "現行",
    "## 4. N:N Relation",
    row,
    "| SCR-000001 PRT-000001.spec-000001 | missing | UI-000001 | SPEC-000001 |",
    "## 5. Gap／戻り条件",
    "人間判断",
    "## 6. Architecture／Qualityへの引き渡し",
    "責務へ戻す",
    "```md",
    row,
    "```",
  ].join("\r\n");
  const model = parseSpecDetailCorrespondence({
    path: "correspondence.md",
    content,
  }).result;
  assert.equal(model.scope.length, 2);
  assert.equal(model.gaps.length, 2);
  assert.equal(model.handoff.length, 2);
  assert.equal(model.relations.length, 1);
  assert.equal(model.relations[0]?.location.line, 10);
  assert.equal(model.relations[0]?.screenId, "SCR-000001");
  assert.equal(model.relations[0]?.behaviorId, "BHV-000001");
  assert.equal(model.relations[0]?.uiId, "UI-000001");
  assert.equal(model.relations[0]?.specId, "SPEC-000001");
  assert.equal(model.source.content, content);
});

/**
 * 対応宣言値の実出現位置を改行形式によらず保持する。
 * @responsibility markerの行と値の行を区別し、旧来受理した複数行構文を強めない。
 * @trace RCM-UT-002
 * @precondition 同じ参照を同一行、次行、空行後、CRLFで提示する。
 * @stimulus UIとSPECの公開Parserを呼ぶ。
 * @observation 参照位置、順序、局所Issueを取得する。
 * @oracle 値の実出現行を返し、参照と局所Issueは変わらない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋な文書モデル構築。
 */
test("UIとSPECの対応参照は複数行でも実出現位置を保持する", () => {
  const uiLink =
    "[UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)";
  const specLink =
    "[SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md)";
  const baseUi = parseUiDefinition(
    { path: "ui.md", content: `## 対応するSPEC\n- pairs_with: ${specLink}` },
    "UI-000001",
  );
  const baseSpec = parseSpecDefinition(
    { path: "spec.md", content: `## 対応するUI\n- pairs_with: ${uiLink}` },
    "SPEC-000001",
  );
  for (const [gap, line] of [
    [" ", 2],
    ["\n  ", 3],
    ["\n\n  ", 4],
    ["\r\n\r\n  ", 4],
  ] as const) {
    const ui = parseUiDefinition(
      {
        path: "ui.md",
        content: `## 対応するSPEC\n- pairs_with:${gap}${specLink}  `,
      },
      "UI-000001",
    );
    const spec = parseSpecDefinition(
      {
        path: "spec.md",
        content: `## 対応するUI\n- pairs_with:${gap}${uiLink}  `,
      },
      "SPEC-000001",
    );
    assert.equal(ui.result?.pairedSpecifications[0]?.location.line, line);
    assert.equal(spec.result?.pairedInterfaces[0]?.location.line, line);
    assert.equal(spec.result?.interfaceDisposition?.location.line, line);
    assert.deepEqual(
      ui.result?.pairedSpecifications.map(({ identity }) => identity),
      ["SPEC-000001"],
    );
    assert.deepEqual(
      spec.result?.pairedInterfaces.map(({ identity }) => identity),
      ["UI-000001"],
    );
    assert.deepEqual(ui.issues, baseUi.issues);
    assert.deepEqual(spec.issues, baseSpec.issues);
  }
});

/**
 * UIの対応SPEC出現列と三者閉包を確認する。
 * @responsibility 重複を抽出結果に保持し、双方向の関係一致を検査する。
 * @trace RCM-UT-002
 * @precondition 同じ対応関係を二件持つUI本文を用意する。
 * @stimulus 対応関係を解析し閉包を検査する。
 * @observation 出現列とIssue順を取得する。
 * @oracle 重複を保持し、重複→閉包の二違反を返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な本文・集合検査。
 */
test("UI対SPECは出現重複と双方向閉包を維持する", () => {
  const link =
    "[SPEC-000001](../../../05_SPEC/Definitions/SPEC-000001/spec_definition.md)";
  const parsed = parseUiDefinition(
    {
      path: "ui.md",
      content: `## 対応するSPEC\n- pairs_with: ${link} ${link}\n## Next`,
    },
    "UI-000001",
  );
  assert.equal(parsed.status, "partial");
  assert.ok(parsed.result);
  const spec = parseSpecDefinition(
    {
      path: "spec.md",
      content:
        "## 対応するUI\n- pairs_with: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)",
    },
    "SPEC-000001",
  );
  assert.ok(spec.result);
  assert.deepEqual(
    parsed.result.pairedSpecifications.map((ref) => ref.identity),
    ["SPEC-000001", "SPEC-000001"],
  );
  const request = {
    uiDefinitionsRoot: "ui",
    specIndexPath: "spec.md",
    uiDefinitions: [parsed.result],
    specDefinitions: [],
    registry: parseSpecIndex({
      path: "spec.md",
      content:
        "| [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | name | UX-000001 | IA-000001 | UI-000001 |",
    }).result,
  };
  assert.deepEqual(
    inspectDocumentRelations({ kind: "ui_spec", ...request }).map(
      (issue) => issue.kind,
    ),
    [
      "artifact.spec.ui-spec-pair-duplicate",
      "artifact.spec.ui-spec-pair-closure-mismatch",
    ],
  );
  assert.deepEqual(
    inspectDocumentRelations({
      kind: "ui_spec",
      ...request,
      uiDefinitions: [
        {
          ...parsed.result,
          pairedSpecifications: parsed.result.pairedSpecifications.slice(0, 1),
        },
      ],
      specDefinitions: [spec.result],
    }),
    [],
  );
});

/**
 * 未対応種別を空結果や別比較へ切り替えないことを確認する。
 * @responsibility 契約外の判別値を明示的に拒否する。
 * @trace RCM-UT-002
 * @precondition 誤った比較種別の入力。
 * @stimulus 公開比較入口へ渡す。
 * @observation 例外を取得する。
 * @oracle 固定理由で拒否し、空列の成功へ畳まない。
 * @cleanup N/A: 外部資源なし。
 * @boundary 同一Processの入力受付。
 */
test("未対応の工程関係種別は拒否する", () => {
  assert.throws(
    () => inspectDocumentRelations({ kind: "unknown" } as never),
    /document_relation_kind_invalid/u,
  );
});

/**
 * 下流Ownerの三方式と最終被覆の反例を検証する。
 * @responsibility 共通集合・和集合・各OwnerのArea被覆と出現数を確認する。
 * @trace RCM-UT-002
 * @precondition Single・Shared・Jointの正しい合成所有モデルを用意する。
 * @stimulus 正常入力と重複・欠落・同数差替えを検査する。
 * @observation 中立Issueと入力の不変性を取得する。
 * @oracle 正常三方式は受理し、所有・Area・件数の不整合を拒否する。QAのID比較は元のサイズ条件を維持する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期集合照合。
 */
test("SPEC下流被覆はSingle・Shared・JointとOwner別Area・出現回数を照合する", () => {
  const key = "PRT-000001.spec-000001";
  const assignment = `担当Interaction Relation: ${key}`;
  const specification = parseSpecDefinition(
    {
      path: "spec.md",
      content:
        "## 対応するUI\n- pairs_with: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)",
    },
    "SPEC-000001",
  );
  assert.ok(specification.result);
  for (const mode of ["Single", "Shared", "Joint"]) {
    const numbers = mode === "Single" ? ["000001"] : ["000001", "000002"];
    const archOwners = numbers.map((number) => `ARCH-${number}`);
    const qaOwners = numbers.map((number) => `QA-${number}`);
    const architectureRow = `| ${key} | BHV-000001 | ${archOwners.join("、")} | ${mode} | checker | Covered |`;
    const qualityRow = `| ${key} | BHV-000001 | ${qaOwners.join("、")} | ${mode} | Mapped |`;
    const definitions = numbers.map(
      (number, index) =>
        parseArchitectureDefinition(
          {
            path: "architecture-definition.md",
            content: `${mode !== "Joint" || index === 0 ? "| SCR-000001 | UI-000001 |" : ""}\n${mode !== "Joint" || index === 1 ? "| BHV-000001 | SPEC-000001 |" : ""}\n${assignment}`,
          },
          `ARCH-${number}`,
        ).result.assignment,
    );
    const request: Extract<
      DocumentRelationsRequest,
      { kind: "ui_spec_downstream" }
    > = {
      path: "architecture.md",
      kind: "ui_spec_downstream",
      uiDetailIndex: parseUiDetailIndex({
        path: "ui-detail.md",
        content: "| UI-000001 | a | b | c | SCR-000001 PRT-000001 |",
      }).result,
      specDetailIndex: parseSpecDetailIndex({
        path: "spec-detail.md",
        content: "| SPEC-000001 | a | b | BHV-000001 |",
      }).result,
      definitions: [specification.result],
      architectureDefinitions: definitions,
      qualityDefinitions: definitions.map(
        (item, index) =>
          parseQualityDefinition(item.source, qaOwners[index] as string).result
            .assignment,
      ),
      areas: [
        parseArchitectureDetail(
          {
            path: "area.md",
            content: `[UI／SPEC Detail Architecture Traceability] ${archOwners.join("、")}\n${assignment}`,
          },
          "checker",
        ).result.assignment,
      ],
      architectureTrace: parseArchitectureDetailMap({
        path: "architecture.md",
        content: `SCR-000001\n${architectureRow}`,
      }).result.trace,
      qualityTrace: parseQualityDetailAnalysis({
        path: "quality.md",
        content: `SCR-000001\n${qualityRow}`,
      }).result.trace,
      architectureDefinitionObservations: [
        observeArchitectureFixture(
          parseArchitectureDefinition(
            { path: "arch.md", content: "SCR-000001 PRT-000001 BHV-000001" },
            "ARCH-000001",
            {
              checklistSource: architectureChecklistFixture("definition", null),
            },
          ),
          false,
          "definition",
        ).result,
      ],
      qualityDefinitionObservations: [
        parseQualityDefinition(
          { path: "qa.md", content: "SCR-000001 PRT-000001 BHV-000001" },
          "QA-000001",
        ).result,
      ],
      uiDefinitionCount: 1,
      specDefinitionCount: 1,
    };
    const before = structuredClone(request);
    assert.deepEqual(inspectDocumentRelations(request), []);
    assert.deepEqual(request, before);
    assert.deepEqual(
      inspectDocumentRelations({
        ...request,
        definitions: [specification.result, specification.result],
      }),
      [],
    );
    assert.deepEqual(
      inspectDocumentRelations({
        ...request,
        qualityTrace: {
          ...request.qualityTrace,
          screens: new Set(["SCR-999999"]),
        },
      }),
      [],
    );
    const firstArea = request.areas[0];
    assert.ok(firstArea);
    for (const invalid of [
      { ...request, definitions: [] },
      { ...request, uiDetailIndex: null },
      { ...request, specDetailIndex: null },
      {
        ...request,
        specDetailIndex: parseSpecDetailIndex({
          path: "spec-detail.md",
          content:
            "| SPEC-000001 | a | b | BHV-000001 |\n| SPEC-000001 | a | b | BHV-000002 |",
        }).result,
      },
      { ...request, architectureDefinitions: [] },
      { ...request, areas: [] },
      {
        ...request,
        areas: [
          {
            ...firstArea,
            architectureIds: new Set<string>(),
          },
        ],
      },
      {
        ...request,
        architectureDefinitions: definitions.map((item, index) =>
          index === 0
            ? {
                ...item,
                relations: [key, key],
              }
            : item,
        ),
      },
      {
        ...request,
        architectureTrace: parseArchitectureDetailMap({
          path: "architecture.md",
          content: `SCR-000001\n${architectureRow}\n${architectureRow}`,
        }).result.trace,
      },
      {
        ...request,
        architectureTrace: parseArchitectureDetailMap({
          path: "architecture.md",
          content:
            "SCR-000001\n" +
            architectureRow.replace("ARCH-000001", "ARCH-999999"),
        }).result.trace,
      },
      { ...request, uiDefinitionCount: 2 },
      {
        ...request,
        qualityDefinitionObservations: [
          parseQualityDefinition(
            { path: "qa.md", content: "SCR-000001 PRT-000001" },
            "QA-000001",
          ).result,
        ],
      },
      {
        ...request,
        qualityDefinitionObservations: [
          parseQualityDefinition(
            {
              path: "qa.md",
              content: "SCR-000001 PRT-000001 <!-- BHV-000001 -->",
            },
            "QA-000001",
          ).result,
        ],
      },
    ])
      assert.equal(
        inspectDocumentRelations(invalid)[0]?.kind,
        "artifact.spec.detail-downstream-coverage-invalid",
        mode,
      );
  }
});

/**
 * 定義対応Evidenceの改訂・正規行・八観点短絡を検証する。
 * @responsibility 可視本文だけの根拠評価と実際に訪問した理由の出現列を固定する。
 * @trace RCM-UT-002
 * @precondition 共有Contextと各見出しに根拠を持つ八観点本文を用意する。
 * @stimulus 正常、八行未満・超過、観点重複、前半／後半不正、Cell不足を検査する。
 * @observation 固定改訂、行モデル、invalidと理由列、全体Issueを取得する。
 * @oracle 正常のみ根拠成立し、先行条件不成立は理由0件、every短絡は訪問済み理由だけを返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 合成本文の同期解析。
 */
test("SPEC対応Evidenceは八観点の短絡と理由出現・改訂を保持する", () => {
  const lenses = [
    "State",
    "Trigger",
    "Result",
    "Failure",
    "Recovery",
    "Authority",
    "Visibility",
    "Constraint",
  ];
  const row =
    "| [UI-000001](../04_UI/Definitions/UI-000001/ui_definition.md) | [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | UX-000001／IA-000001 | Shared | 8観点 | 作成者確認済み | なし | [Evidence](#ui-000001spec-000001) |";
  const fingerprint = "a".repeat(64);
  const uiSource = `# UI-000001 題名\n## 正式入力と変換根拠\nUX-000001 IA-000001\n${["状態と表示差", "操作とFeedback", "制約", "表示面と情報の優先順位"].map((heading) => `## ${heading}\n表示の根拠本文。`).join("\n")}`;
  const specSource = `# SPEC-000001 題名\n## 正式入力と変換根拠\nUX-000001 IA-000001\n${["振る舞い・状態・結果", "契機・事前条件・Authority", "失敗・回復・副作用", "受入条件と検証義務", "制約"].map((heading) => `## ${heading}\n動作の根拠本文。`).join("\n")}`;
  const evidenceRows = lenses.map(
    (lens) =>
      `| ${lens} | UI-000001#root | SPEC-000001#root | 一致 | UI事実（UI-000001）「表示の根拠本文${lens}」／SPEC事実（SPEC-000001）「動作の根拠本文${lens}」／対応: 根拠を対応する${lens} |`,
  );
  const prefix =
    "### UI-000001／SPEC-000001\n| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |\n|---|---|---|---|---|\n";
  const content = prefix + evidenceRows.join("\n");
  const ui = parseUiDefinition(
    { path: "ui.md", content: uiSource },
    "UI-000001",
  ).result;
  const spec = parseSpecDefinition(
    { path: "spec.md", content: specSource },
    "SPEC-000001",
  ).result;
  // 各変異は完成Parserで独立した対応行と根拠を構築する。
  const evidencePair = (text: string, selectedRow = row) => {
    const pair = parseSpecDefinitionCorrespondence({
      path: "correspondence.md",
      content: `${selectedRow}\n${text}`,
    }).result.pairs[0];
    assert.ok(pair);
    return pair;
  };
  const valid = evaluateDefinitionPairEvidence(evidencePair(content), ui, spec);
  assert.equal(valid.invalid, false);
  assert.equal(valid.reasons.length, 8);
  for (const rows of [
    evidenceRows.slice(0, 7),
    [...evidenceRows, evidenceRows[0]],
    evidenceRows.map((value, index) =>
      index === 7 ? value.replace("Constraint", "State") : value,
    ),
  ]) {
    const result = evaluateDefinitionPairEvidence(
      evidencePair(prefix + rows.join("\n")),
      ui,
      spec,
    );
    assert.equal(result.invalid, true);
    assert.deepEqual(result.reasons, []);
  }
  for (const invalidIndex of [0, 7]) {
    const rows = evidenceRows.map((value, index) =>
      index === invalidIndex
        ? value.replace("UI-000001#root", "UI-000002#root")
        : value,
    );
    const result = evaluateDefinitionPairEvidence(
      evidencePair(prefix + rows.join("\n")),
      ui,
      spec,
    );
    assert.equal(result.invalid, true);
    assert.equal(result.reasons.length, invalidIndex + 1);
  }
  const shortRow = `${row.split(" | ").slice(0, 2).join(" | ")} |`;
  assert.throws(
    () =>
      evaluateDefinitionPairEvidence(evidencePair(content, shortRow), ui, spec),
    TypeError,
  );
  const artifact = {
    path: "correspondence.md",
    content: `## 1. レビュー対象\n| UI | SPEC | Shared UX／IA Context | Coverage分類 | 確認した観点 | 結果 | Gap Owner／人間判断 | Evidence |\n${row}\n${content}`,
  };
  const registry = parseSpecIndex({
    path: "registry.md",
    content:
      "| [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | 意味 | UX-000001 | IA-000001 | UI-000001 |",
  }).result;
  assert.ok(registry);
  const parsed = parseSpecDefinitionCorrespondence(artifact).result;
  const request = {
    kind: "ui_spec_evidence" as const,
    correspondence: { ...parsed, recordedFingerprint: fingerprint },
    evaluations: [valid],
    registry,
    actualFingerprint: fingerprint,
  };
  assert.deepEqual(inspectDocumentRelations(request), []);
  assert.deepEqual(
    inspectDocumentRelations({
      ...request,
      correspondence: {
        ...request.correspondence,
        pairs: [],
        recordedFingerprint: undefined,
      },
      evaluations: [],
    }).map((issue) => issue.kind),
    [
      "artifact.spec.correspondence-closure-mismatch",
      "artifact.spec.correspondence-evidence-invalid",
      "artifact.spec.correspondence-revision-invalid",
    ],
  );
  assert.deepEqual(
    inspectDocumentRelations({
      ...request,
      actualFingerprint: "b".repeat(64),
    }).map((issue) => issue.kind),
    ["artifact.spec.correspondence-revision-invalid"],
  );
});

/**
 * 比較用の定義節捕捉が旧exact見出し・先頭・H2境界を保持するか確認する。
 * @responsibility UI／SPECの局所捕捉と一般Section捕捉の意図した差を固定する。
 * @trace RCM-UT-002
 * @precondition 同名節、H3、空節、Tab見出しを含む定義本文。
 * @stimulus 両Ownerの完成モデルを構築する。
 * @observation 対応用題名・節値・出典と欠測を確認する。
 * @oracle 空節は存在、欠測はMap不在。H3では閉じず次H2で閉じる。
 * @cleanup N/A: 外部資源なし。
 * @boundary 同期的なモデル捕捉。
 */
test("対応根拠の定義節はexact見出し・先頭一致・H2終端を保持する", () => {
  for (const [parse, id] of [
    [parseUiDefinition, "UI-000001"],
    [parseSpecDefinition, "SPEC-000001"],
  ] as const) {
    const content = `# ${id} 題名\n## 制約\nfirst\n### 子\nchild\n## 制約\nsecond`;
    const model = parse({ path: "definition.md", content }, id).result;
    assert.equal(model.correspondenceTitle?.text, "題名");
    assert.equal(model.correspondenceTitle?.location.line, 1);
    assert.equal(
      model.correspondenceSections.get("## 制約")?.text,
      "\nfirst\n### 子\nchild\n",
    );
    assert.equal(model.correspondenceSections.get("## 制約")?.location.line, 2);
    const empty = parse(
      { path: "empty.md", content: "## 制約\n## 次\nnext" },
      id,
    ).result;
    assert.equal(empty.correspondenceSections.get("## 制約")?.text, "\n");
    const missing = parse(
      { path: "missing.md", content: "##\t制約\nignored" },
      id,
    ).result;
    assert.equal(missing.correspondenceSections.has("## 制約"), false);
    const multilineTitle = parse(
      { path: "title.md", content: `#\n${id} 題名` },
      id,
    ).result;
    assert.equal(multilineTitle.correspondenceTitle?.text, "題名");
    assert.equal(multilineTitle.correspondenceTitle?.location.line, 2);
  }
});

/**
 * Quality統合の解析済み参照をArchitecture正本の期待集合と比較する。
 * @responsibility Nodeの同じPath意味で重複・順序・不足・差替えを評価する。
 * @trace RCM-UT-002
 * @precondition 固定五文書の参照、同数の誤差替え、raw／EOF境界を用意する。
 * @stimulus Qualityモデルを構築し、横断関係の完成入口へ渡す。
 * @observation 参照出現と既存の不一致Issueを取得する。
 * @oracle 重複・順序は集合比較で受理し、欠落・余分・差替えは旧理由で拒否する。
 * @cleanup N/A: 文字列とPathの純粋計算のみ。
 * @boundary Quality内容モデルとArchitectureの固定横断契約。
 */
test("Qualityの横断モデル比較は解析済み参照と固定五文書を照合する", () => {
  const files = [
    "02_Component_and_Responsibility_Model.md",
    "03_Boundary_and_Interface_Model.md",
    "04_Runtime_and_Data_Flow_Model.md",
    "05_Failure_Recovery_and_Resilience_Model.md",
    "06_Deployment_and_Execution_Model.md",
  ];
  const root = path.resolve("fixture");
  for (const [names, expected] of [
    [files, 0],
    [[...files].reverse(), 0],
    [[...files, files[0]], 0],
    [files.slice(1), 1],
    [[...files, "Unknown.md"], 1],
    [[...files.slice(1), "Unknown.md"], 1],
  ] as const) {
    const content = `## 2. Architecture横断モデルの処置\n${names.map((file) => `[model](../06_Architecture/${file})`).join("\n")}\n## 3. 次節\n`;
    const source = { path: "07_Quality/04_Quality_Integration.md", content };
    const integration = parseQualityIntegration(source).result;
    source.content = "changed";
    assert.equal(integration.crossModelReferences.length, names.length);
    assert.equal(integration.source.content, content);
    const issues = inspectDocumentRelations({
      kind: "quality_architecture_models",
      integration,
      architectureRoot: path.join(root, "06_Architecture"),
      integrationDirectory: path.join(root, "07_Quality"),
      analysisPath: integration.source.path,
    });
    assert.equal(issues.length, expected);
    if (expected)
      assert.equal(
        issues[0]?.kind,
        "artifact.quality-analysis.architecture-cross-model-coverage-mismatch",
      );
  }
  const noBoundary = parseQualityIntegration({
    path: "quality.md",
    content:
      "## 2. Architecture横断モデルの処置\n[x](../06_Architecture/02_Component_and_Responsibility_Model.md)",
  }).result;
  assert.deepEqual(noBoundary.crossModelReferences, []);
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

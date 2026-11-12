/**
 * SPEC分析・登録表・定義の本文モデルを検証する。
 * @packageDocumentation
 * @responsibility 不正本文の部分関係・出現重複・Issue順と観点別条件を確認する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、spec
 * @boundary RCM-UT-002=N/A: 合成本文の同期解析。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectSpecAnalysis,
  inspectSpecDefinition,
  parseSpecIndex,
  inspectSpecAnalysisCoverage,
  inspectSpecDefinitionCoverage,
  inspectSpecCoverage,
  parseUiSpecPairs,
  inspectUiSpecRelations,
  parseUiDetailBindings,
  parseSpecScreenRelations,
  inspectSpecDetailIndex,
  inspectSpecDetailCorrespondence,
  parseSpecDetailDefinitionOwnership,
  parseSpecDetailAreaOwnership,
  parseSpecDetailCentralTrace,
  inspectSpecDetailDownstream,
  type SpecDetailDownstreamRequest,
  parseSpecCorrespondenceRevision,
  parseSpecCorrespondencePair,
  inspectSpecCorrespondencePairEvidence,
  inspectSpecCorrespondence,
} from "../../../src/index.ts";

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
  const pair = parseSpecCorrespondencePair(row);
  assert.ok(pair);
  assert.equal(
    parseSpecCorrespondencePair(row.replace("../04_UI/", "04_UI/")),
    null,
  );
  const fingerprint = "a".repeat(64);
  const revision = `| 項目 | 対象 |\n|---|---|\n| 対象改訂版 | UI／SPEC Definition集合 SHA-256: ${fingerprint} |`;
  assert.equal(parseSpecCorrespondenceRevision(revision), fingerprint);
  assert.equal(
    parseSpecCorrespondenceRevision(
      revision.replace(fingerprint, fingerprint.toUpperCase()),
    ),
    undefined,
  );
  const uiSource = `# UI-000001 題名\n## 正式入力と変換根拠\nUX-000001 IA-000001\n${["状態と表示差", "操作とFeedback", "制約", "表示面と情報の優先順位"].map((heading) => `## ${heading}\n表示の根拠本文。`).join("\n")}`;
  const specSource = `# SPEC-000001 題名\n## 正式入力と変換根拠\nUX-000001 IA-000001\n${["振る舞い・状態・結果", "契機・事前条件・Authority", "失敗・回復・副作用", "受入条件と検証義務", "制約"].map((heading) => `## ${heading}\n動作の根拠本文。`).join("\n")}`;
  const evidenceRows = lenses.map(
    (lens) =>
      `| ${lens} | UI-000001#root | SPEC-000001#root | 一致 | UI事実（UI-000001）「表示の根拠本文${lens}」／SPEC事実（SPEC-000001）「動作の根拠本文${lens}」／対応: 根拠を対応する${lens} |`,
  );
  const prefix =
    "### UI-000001／SPEC-000001\n| 観点 | UI側の根拠 | SPEC側の根拠 | 判定 | 理由 |\n|---|---|---|---|---|\n";
  const content = prefix + evidenceRows.join("\n");
  const valid = inspectSpecCorrespondencePairEvidence(
    pair,
    content,
    uiSource,
    specSource,
  );
  assert.equal(valid.invalid, false);
  assert.equal(valid.reasons.length, 8);
  for (const rows of [
    evidenceRows.slice(0, 7),
    [...evidenceRows, evidenceRows[0]],
    evidenceRows.map((value, index) =>
      index === 7 ? value.replace("Constraint", "State") : value,
    ),
  ]) {
    const result = inspectSpecCorrespondencePairEvidence(
      pair,
      prefix + rows.join("\n"),
      uiSource,
      specSource,
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
    const result = inspectSpecCorrespondencePairEvidence(
      pair,
      prefix + rows.join("\n"),
      uiSource,
      specSource,
    );
    assert.equal(result.invalid, true);
    assert.equal(result.reasons.length, invalidIndex + 1);
  }
  const shortPair = parseSpecCorrespondencePair(
    row.split(" | ").slice(0, 2).join(" | ") + " |",
  );
  assert.ok(shortPair);
  assert.throws(
    () =>
      inspectSpecCorrespondencePairEvidence(
        shortPair,
        content,
        uiSource,
        specSource,
      ),
    TypeError,
  );
  const artifact = {
    path: "correspondence.md",
    content: `## 1. レビュー対象\n| UI | SPEC | Shared UX／IA Context | Coverage分類 | 確認した観点 | 結果 | Gap Owner／人間判断 | Evidence |\n${content}`,
  };
  const request = {
    artifact,
    pairs: ["UI-000001|SPEC-000001"],
    reasons: valid.reasons,
    expectedPairs: new Set(["UI-000001|SPEC-000001"]),
    hasInvalidPairEvidence: false,
    recordedFingerprint: fingerprint,
    actualFingerprint: fingerprint,
  };
  assert.deepEqual(inspectSpecCorrespondence(request), []);
  assert.deepEqual(
    inspectSpecCorrespondence({
      ...request,
      pairs: [],
      reasons: [],
      recordedFingerprint: undefined,
    }).map((issue) => issue.kind),
    [
      "artifact.spec.correspondence-closure-mismatch",
      "artifact.spec.correspondence-evidence-invalid",
      "artifact.spec.correspondence-revision-invalid",
    ],
  );
  assert.deepEqual(
    inspectSpecCorrespondence({
      ...request,
      actualFingerprint: "b".repeat(64),
    }).map((issue) => issue.kind),
    ["artifact.spec.correspondence-revision-invalid"],
  );
});

/**
 * 下流所有モデルが列・行頭・出現回数の既存条件を保持するか確認する。
 * @responsibility Definition・Area・中央表の抽出境界を固定する。
 * @trace RCM-UT-002
 * @precondition 重複・複数ID・空Area・不正列数を含む本文を用意する。
 * @stimulus 三つの下流parserを呼ぶ。
 * @observation 所有集合・出現列・Map・行数・重複flagを取得する。
 * @oracle 最初の一致・後勝ち・空Area・行内と別行の区別を維持する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文解析。
 */
test("SPEC下流parserは最初の所有参照・後勝ち・重複出現を保持する", () => {
  const key = "PRT-000001.spec-000001";
  const assignment = `担当Interaction Relation: ${key}`;
  const definitionEntries = parseSpecDetailDefinitionOwnership(
    `| SCR-000001 | UI-000001 UI-000002 |\n| BHV-000001 | SPEC-000001 SPEC-000002 |\n${assignment}\n${assignment}\n ${assignment}`,
  );
  assert.deepEqual([...definitionEntries.uiIds], ["UI-000001"]);
  assert.deepEqual([...definitionEntries.specIds], ["SPEC-000001"]);
  assert.deepEqual(definitionEntries.relations, [key, key]);
  assert.equal(definitionEntries.hasDuplicateRelations, false);
  const area = parseSpecDetailAreaOwnership(
    `[UI／SPEC Detail Architecture Traceability] ARCH-000001\n[UI／SPEC Detail Architecture Traceability] ARCH-000002\n${assignment} ${key}`,
  );
  assert.deepEqual([...area.architectureIds], ["ARCH-000001"]);
  assert.deepEqual(area.relations, [key, key]);
  assert.equal(area.hasDuplicateRelations, true);
  const row = `| ${key} | BHV-000001 | ARCH-000001 | Single | | Covered |`;
  const central = parseSpecDetailCentralTrace(
    `${row}\n${row.replace("BHV-000001", "BHV-000002")}\n${row} extra |`,
    "",
  );
  assert.equal(central.architectureRows, 2);
  assert.equal(central.architectureRelations.get(key)?.bhv, "BHV-000002");
  const centralEntry = central.architectureRelations.get(key);
  assert.ok(centralEntry);
  assert.deepEqual([...centralEntry.areas], [""]);
  assert.equal(central.hasDuplicateRelations, true);
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
  for (const mode of ["Single", "Shared", "Joint"]) {
    const numbers = mode === "Single" ? ["000001"] : ["000001", "000002"];
    const archOwners = numbers.map((number) => `ARCH-${number}`);
    const qaOwners = numbers.map((number) => `QA-${number}`);
    const architectureRow = `| ${key} | BHV-000001 | ${archOwners.join("、")} | ${mode} | checker | Covered |`;
    const qualityRow = `| ${key} | BHV-000001 | ${qaOwners.join("、")} | ${mode} | Mapped |`;
    const definitions = numbers.map((number, index) => ({
      owner: `ARCH-${number}`,
      ownership: parseSpecDetailDefinitionOwnership(
        `${mode !== "Joint" || index === 0 ? "| SCR-000001 | UI-000001 |" : ""}\n${mode !== "Joint" || index === 1 ? "| BHV-000001 | SPEC-000001 |" : ""}\n${assignment}`,
      ),
    }));
    const request: SpecDetailDownstreamRequest = {
      path: "architecture.md",
      relations: new Map([
        [
          key,
          {
            bhv: "BHV-000001",
            ui: "UI-000001",
            spec: "SPEC-000001",
            scr: "SCR-000001",
          },
        ],
      ]),
      architectureDefinitions: definitions,
      qualityDefinitions: definitions.map((item, index) => ({
        ...item,
        owner: qaOwners[index] as string,
      })),
      areas: [
        {
          area: "checker",
          ownership: parseSpecDetailAreaOwnership(
            `[UI／SPEC Detail Architecture Traceability] ${archOwners.join("、")}\n${assignment}`,
          ),
        },
      ],
      central: parseSpecDetailCentralTrace(architectureRow, qualityRow),
      issued: {
        screens: new Set(["SCR-000001"]),
        parts: new Set(["PRT-000001"]),
        behaviors: new Set(["BHV-000001"]),
      },
      quality: {
        screens: new Set(["SCR-000001"]),
        parts: new Set(["PRT-000001"]),
        behaviors: new Set(["BHV-000001"]),
      },
      architectureDefinitionsCombined: "SCR-000001 PRT-000001 BHV-000001",
      qualityDefinitionsCombined: "SCR-000001 PRT-000001 BHV-000001",
      uiDefinitionCount: 1,
      specDefinitionCount: 1,
    };
    const before = structuredClone(request);
    assert.deepEqual(inspectSpecDetailDownstream(request), []);
    assert.deepEqual(request, before);
    assert.deepEqual(
      inspectSpecDetailDownstream({
        ...request,
        quality: { ...request.quality, screens: new Set(["SCR-999999"]) },
      }),
      [],
    );
    const firstArea = request.areas[0];
    assert.ok(firstArea);
    for (const invalid of [
      { ...request, architectureDefinitions: [] },
      { ...request, areas: [] },
      {
        ...request,
        areas: [
          {
            ...firstArea,
            ownership: {
              ...firstArea.ownership,
              architectureIds: new Set<string>(),
            },
          },
        ],
      },
      {
        ...request,
        architectureDefinitions: definitions.map((item, index) =>
          index === 0
            ? {
                ...item,
                ownership: { ...item.ownership, relations: [key, key] },
              }
            : item,
        ),
      },
      {
        ...request,
        central: parseSpecDetailCentralTrace(
          `${architectureRow}\n${architectureRow}`,
          qualityRow,
        ),
      },
      {
        ...request,
        central: parseSpecDetailCentralTrace(
          architectureRow.replace("ARCH-000001", "ARCH-999999"),
          qualityRow,
        ),
      },
      { ...request, uiDefinitionCount: 2 },
      { ...request, qualityDefinitionsCombined: "SCR-000001 PRT-000001" },
    ])
      assert.equal(
        inspectSpecDetailDownstream(invalid)[0]?.kind,
        "artifact.spec.detail-downstream-coverage-invalid",
        mode,
      );
  }
});

/**
 * Detailの表解析が後勝ち・最初の一致・重複出現を維持するか確認する。
 * @responsibility UI・BHV・Screen・対応表の部分関係を検証する。
 * @trace RCM-UT-002
 * @precondition 有効行・不正行・重複行を含む合成本文を用意する。
 * @stimulus 各Detail解析APIを呼ぶ。
 * @observation 対応Map・関係列・Issueを取得する。
 * @oracle 後勝ちMapと出現順を保持し、不正本文の抽出可能な関係を失わない。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文解析。
 */
test("SPEC Detail解析は部分関係と後勝ちMap・出現重複を保持する", () => {
  const bindingRow = "| UI-000001 | a | b | c | SCR-000001 PRT-000001 |";
  const bindings = parseUiDetailBindings(
    `${bindingRow}\n${bindingRow.replaceAll("000001", "000002").replace("UI-000002", "UI-000001")}`,
  );
  assert.deepEqual(
    [...bindings],
    [["UI-000001", { scr: "SCR-000002", prt: "PRT-000002" }]],
  );
  assert.equal(parseUiDetailBindings(`<!-- ${bindingRow} -->`).size, 0);
  const row = "| SPEC-000001 | a | Applicable／Covered | BHV-000001 | reason |";
  const valid = inspectSpecDetailIndex(
    { path: "detail.md", content: `状態: Canonical\n${row}` },
    new Set(["SPEC-000001"]),
  );
  assert.equal(valid.issues.length, 0);
  const invalid = inspectSpecDetailIndex(
    {
      path: "detail.md",
      content: `${row}\n${row.replace("BHV-000001", "BHV-000002")}`,
    },
    new Set(["SPEC-000001"]),
  );
  assert.deepEqual([...invalid.behaviors], [["SPEC-000001", "BHV-000002"]]);
  assert.equal(
    invalid.issues[0]?.kind,
    "artifact.spec.detail-current-coverage-invalid",
  );
  const screenRow =
    "| PRT-000001.spec-000001 | a | b | c | BHV-000001 BHV-000002 |";
  const tuple =
    "PRT-000001.spec-000001|BHV-000001|UI-000001|SPEC-000001|SCR-000007";
  assert.deepEqual(parseSpecScreenRelations(screenRow, "SCR-000007"), []);
  assert.deepEqual(
    parseSpecScreenRelations(
      `対象UI Definition: [UI-000001]\n${screenRow}\n${screenRow}`,
      "SCR-000007",
    ),
    [tuple, tuple],
  );
});

/**
 * Detail対応の双方向被覆と同数差替え・重複を検証する。
 * @responsibility 状態文言とDefinition・Screen・対応表の一致を確認する。
 * @trace RCM-UT-002
 * @precondition 一件の正しい関係と必須状態文言を用意する。
 * @stimulus 正常・重複・差替え・件数不一致を検査する。
 * @observation 中立Issue列と変換対象kindを取得する。
 * @oracle 正常だけ空Issueで、各反例は同じ既存条件のIssueを返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期集合照合。
 */
test("SPEC Detail対応は双方向被覆・出現重複・同数差替えを照合する", () => {
  const tuple =
    "PRT-000001.spec-000001|BHV-000001|UI-000001|SPEC-000001|SCR-000001";
  const row =
    "| SCR-000001 PRT-000001.spec-000001 | BHV-000001 | UI-000001 | SPEC-000001 |";
  const content = `状態: Pass\nDefinition対応とDetail対応を分けた\nUIからBHVへのCoverageを全件評価した\nBHVからUIへのCoverageを全件評価した\n${row}`;
  const artifact = { path: "correspondence.md", content };
  const expected = new Set([tuple]);
  assert.deepEqual(
    inspectSpecDetailCorrespondence(artifact, expected, [tuple], 1),
    [],
  );
  for (const issues of [
    inspectSpecDetailCorrespondence(artifact, expected, [tuple, tuple], 1),
    inspectSpecDetailCorrespondence(
      artifact,
      expected,
      [tuple.replace("BHV-000001", "BHV-000002")],
      1,
    ),
    inspectSpecDetailCorrespondence(
      { ...artifact, content: `${content}\n${row}` },
      expected,
      [tuple],
      1,
    ),
    inspectSpecDetailCorrespondence(
      { ...artifact, content: content.replace("状態: Pass", "状態: Draft") },
      expected,
      [tuple],
      1,
    ),
    inspectSpecDetailCorrespondence(artifact, expected, [tuple], 2),
  ])
    assert.equal(
      issues[0]?.kind,
      "artifact.spec.detail-correspondence-state-invalid",
    );
});

/**
 * 観点別の分析診断と不正本文の関係保持を確認する。
 * @responsibility 重複関係の出現列をSetへ畳まず後続へ渡す。
 * @trace RCM-UT-002
 * @precondition 構造不足だがSPEC処置関係を持つ合成本文を用意する。
 * @stimulus UX／IA分析を検査する。
 * @observation Issue順と関係出現列を取得する。
 * @oracle 観点別構造→Checklistの順で返し、重複関係を二件保持する。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("SPEC分析は観点別Issueと不正本文の重複関係を保持する", () => {
  for (const identity of ["UX-000001", "IA-000001"]) {
    const row =
      "[SPEC-000001](../../Definitions/SPEC-000001/spec_definition.md)";
    const content = `## ${identity.startsWith("UX") ? "5" : "6"}. SPEC処置\n${row}\n${row}\n## Next`;
    const model = inspectSpecAnalysis(
      { path: "analysis.md", content },
      identity,
    );
    assert.deepEqual(model.relations, [
      `${identity}|SPEC-000001`,
      `${identity}|SPEC-000001`,
    ]);
    assert.deepEqual(
      model.issues.map((issue) => issue.kind),
      [
        `artifact.spec.${identity.startsWith("UX") ? "ux" : "ia"}-analysis-contract-invalid`,
        "artifact.spec.analysis-checklist-invalid",
      ],
    );
    assert.equal(
      model.issues[1]?.details.checklistFailure,
      "missing_or_duplicate",
    );
  }
});

/**
 * 分析と定義の網羅性・重複診断の順を確認する。
 * @responsibility 不足IDと関係重複を独立に検査し、空集合一致を新たに拒否しない。
 * @trace RCM-UT-002
 * @precondition 空集合と不足・重複のある入力を用意する。
 * @stimulus 観測境界ごとの網羅性検査を実行する。
 * @observation 順序付きIssueを取得する。
 * @oracle 分析はUX→重複→IA、定義は重複→登録網羅性で返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期的な集合検査。
 */
test("SPEC網羅性は観測境界ごとのIssue順と空集合条件を維持する", () => {
  const empty = new Set<string>();
  assert.deepEqual(
    inspectSpecAnalysisCoverage({
      specIndexPath: "spec.md",
      specAnalysisRoot: "analysis",
      uxIds: empty,
      iaIds: empty,
      analyzedUx: empty,
      analyzedIa: empty,
      analysisRelationOccurrences: [],
    }),
    [],
  );
  const analysis = inspectSpecAnalysisCoverage({
    specIndexPath: "spec.md",
    specAnalysisRoot: "analysis",
    uxIds: new Set(["UX-000001"]),
    iaIds: new Set(["IA-000001"]),
    analyzedUx: empty,
    analyzedIa: empty,
    analysisRelationOccurrences: ["a", "a"],
  });
  assert.deepEqual(
    analysis.map((issue) => issue.kind),
    [
      "artifact.spec.ux-analysis-coverage-mismatch",
      "artifact.spec.analysis-relation-duplicate",
      "artifact.spec.ia-analysis-coverage-mismatch",
    ],
  );
  const definitionEntries = inspectSpecDefinitionCoverage({
    specDefinitionsRoot: "definitions",
    specIndexPath: "spec.md",
    definitionRelationOccurrences: ["a", "a"],
    definitionUiPairOccurrences: [],
    registryIds: new Set(["SPEC-000001"]),
    actualIds: empty,
  });
  assert.deepEqual(
    definitionEntries.map((issue) => issue.kind),
    [
      "artifact.spec.definition-relation-duplicate",
      "artifact.spec.definition-index-coverage-mismatch",
    ],
  );
});

/**
 * 件数と三者関係閉包を確認する。
 * @responsibility 件数の整数解析と同数の誤差し替えを検出する。
 * @trace RCM-UT-002
 * @precondition 一致する件数と関係集合を用意する。
 * @stimulus 件数と集合を変えて検査する。
 * @observation Issue順を取得する。
 * @oracle 正常を受理し、件数不一致→閉包不一致の順で返す。
 * @cleanup N/A: 局所値だけを使う。
 * @boundary RCM-UT-002=N/A: 同期的な集合検査。
 */
test("SPEC件数と三者閉包は同数の誤差し替えを拒否する", () => {
  const relations = new Set(["UX-000001|SPEC-000001"]);
  const request = {
    specIndexPath: "spec.md",
    indexCountRows: [["UX定義", "1", "current"]],
    expectedIndexCounts: new Map([["UX定義", 1]]),
    registryRelations: relations,
    analysisRelations: relations,
    definitionRelations: relations,
  };
  assert.deepEqual(inspectSpecCoverage(request), []);
  assert.deepEqual(
    inspectSpecCoverage({
      ...request,
      indexCountRows: [["UX定義", "0", "current"]],
      definitionRelations: new Set(["UX-000002|SPEC-000001"]),
    }).map((issue) => issue.kind),
    [
      "artifact.spec.root-coverage-count-mismatch",
      "artifact.spec.analysis-definition-closure-mismatch",
    ],
  );
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
  const pairs = parseUiSpecPairs(
    `## 対応するSPEC\n- pairs_with: ${link} ${link}\n## Next`,
    "UI-000001",
  );
  assert.deepEqual(pairs, ["UI-000001|SPEC-000001", "UI-000001|SPEC-000001"]);
  const request = {
    uiDefinitionsRoot: "ui",
    specIndexPath: "spec.md",
    uiPairOccurrences: pairs,
    registryUiPairs: new Set(["UI-000001|SPEC-000001"]),
    definitionUiPairs: new Set<string>(),
    uiPairs: new Set(pairs),
  };
  assert.deepEqual(
    inspectUiSpecRelations(request).map((issue) => issue.kind),
    [
      "artifact.spec.ui-spec-pair-duplicate",
      "artifact.spec.ui-spec-pair-closure-mismatch",
    ],
  );
  assert.deepEqual(
    inspectUiSpecRelations({
      ...request,
      uiPairOccurrences: pairs.slice(0, 1),
      definitionUiPairs: request.registryUiPairs,
    }),
    [],
  );
});

/**
 * 登録表の重複と件数表を解析する。
 * @responsibility 集合化後も行重複をIssueとして保持する。
 * @trace RCM-UT-002
 * @precondition 同じ登録行二件と三列件数表を用意する。
 * @stimulus 登録表を解析する。
 * @observation 集合・件数表・Issueを取得する。
 * @oracle IDと関係をSet化し、重複を消さず一Issueで返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期解析。
 */
test("SPEC登録表は重複違反と件数表を保持する", () => {
  const row =
    "| [SPEC-000001](Definitions/SPEC-000001/spec_definition.md) | name | UX-000001 | IA-000001 | UI-000001 |";
  const content = `${row}\n${row}\n| 入力／成果 | 件数 | 現在の処置 |\n| --- | --- | --- |\n| UX | 1 | current |`;
  const model = parseSpecIndex({ path: "spec.md", content });
  assert.deepEqual([...model.ids], ["SPEC-000001"]);
  assert.deepEqual(
    [...model.relations],
    ["UX-000001|SPEC-000001", "IA-000001|SPEC-000001"],
  );
  assert.deepEqual([...model.uiPairs], ["UI-000001|SPEC-000001"]);
  assert.deepEqual(model.countRows, [["UX", "1", "current"]]);
  assert.deepEqual(
    model.issues.map((issue) => issue.kind),
    ["artifact.spec.registry-relation-duplicate"],
  );
});

/**
 * 不正定義でもUX／IA・UI関係を保持する。
 * @responsibility 本文構造とChecklistを独立に検査し部分結果を後続へ返す。
 * @trace RCM-UT-002
 * @precondition 必須構造が不足する関係付き定義を用意する。
 * @stimulus SPEC定義を検査する。
 * @observation 出現列とIssue順を取得する。
 * @oracle 各関係を保持し、構造→Checklistの順で返す。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("SPEC定義は本文不正でも解析済み関係を保持する", () => {
  const content =
    "## UX観点の分析結果\n[UX-000001](../../Analysis/UX-000001/spec_analysis.md)\n## IA観点の分析結果\n[IA-000001](../../Analysis/IA-000001/spec_analysis.md)\n## 対応するUI\n- pairs_with: [UI-000001](../../../04_UI/Definitions/UI-000001/ui_definition.md)\n## Next";
  const model = inspectSpecDefinition(
    { path: "definition.md", content },
    "SPEC-000001",
  );
  assert.deepEqual(model.relations, [
    "UX-000001|SPEC-000001",
    "IA-000001|SPEC-000001",
  ]);
  assert.deepEqual(model.uiPairs, ["UI-000001|SPEC-000001"]);
  assert.deepEqual(
    model.issues.map((issue) => issue.kind),
    [
      "artifact.spec.definition-contract-invalid",
      "artifact.spec.definition-checklist-invalid",
    ],
  );
});

/**
 * Quality Definition本文とLocal ID所有の意味を検証する。
 * @packageDocumentation
 * @responsibility 部分関係、13列条件、段階・適用判断と先勝ち所有を固定する。
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、quality-definition
 * @boundary RCM-UT-002=N/A: 合成の生本文と局所Mapだけを使う同期検査。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectQualityDefinition,
  inspectQualityLocalItemOwnership,
} from "../../../src/index.ts";

/**
 * 一定義・一項目の完全な本文を構成する。
 * @responsibility 変異試験が独立した固定期待条件を持てる合成本文を返す。
 * @trace RCM-UT-002
 * @precondition 外部入力を使用しない。
 * @stimulus 合成本文の構築を呼び出す。
 * @observation 生本文文字列を取得する。
 * @oracle 各試験が変更した意味だけを判定できる固定表を含む。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 局所文字列の構成。
 */
function createQualityDefinitionSource(): string {
  return [
    "# QA-000001 合成検証",
    "Quality ID: `QA-000001`",
    "主な試験段階: Unit",
    "## 1. 情報源と網羅条件",
    "| [REQ-000001](source.md) | `req-000001.qa-000001` | Definition | 条件  を保存する | UT | `SAMPLE-UT-001` |",
    "### Architecture詳細設計入力",
    "[core](../../../06_Architecture/Details/core/01_Architecture.md)",
    "### 条件区分の適用",
    "| 正常 | Required | `SAMPLE-UT-001` | 通常条件を検証する |",
    "| 境界 | N/A | なし | 境界条件を持たない |",
    "| 準正常 | N/A | なし | 準正常条件を持たない |",
    "| 異常 | N/A | なし | 異常条件を持たない |",
    "| 回復 | N/A | なし | 回復条件を持たない |",
    "## 2. 検証項目",
    "| Local ID | 条件区分 | 試験段階 | 試験種別 | 対象／境界 | 外部境界の段階 | 事前状態／入力 | 操作／刺激 | 観測 | Oracle | Evidence | 終了後条件 | 実行形態 |",
    "|---|---|---|---|---|---|---|---|---|---|---|---|---|",
    "| `SAMPLE-UT-001` | 正常 | UT | Contract | Core | N/A | 入力 | 操作 | 観測 | 判定 | 根拠 | 終了 | Automated |",
    "## 3. 試験段階と外部境界の適用",
    "| UT | Required | Core | N/A | 単位検証 |",
    "| IT | N/A | なし | N/A | 結合なし |",
    "| ST | N/A | なし | N/A | Systemなし |",
    "| UAT | N/A | なし | N/A | 利用者判断なし |",
    "## 追加試験種別の適用",
    "| RT | N/A | なし | N/A | 追加回帰なし |",
    "| PT | N/A | なし | N/A | 性能条件なし |",
    "| LT | N/A | なし | N/A | 負荷条件なし |",
    "",
  ].join("\n");
}

/**
 * 正常本文と不正構造の部分モデルを検証する。
 * @responsibility 生本文・後勝ちMap・独立Local ID抽出を維持する。
 * @trace RCM-UT-002
 * @precondition 一定義の完全本文と固定Relationを用意する。
 * @stimulus Header、情報源、項目の列数、同じキーの行を変更する。
 * @observation Issueと関係集合・出現列・条件Mapを取得する。
 * @oracle 不正でも抽出したRelationを保持し、後勝ち条件と列不足IDを失わない。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("Quality Definitionは不正本文からも部分関係と独立Local IDを保持する", () => {
  const content = createQualityDefinitionSource();
  const artifact = { path: "QA-000001/quality_definition.md", content };
  const model = inspectQualityDefinition(artifact, "QA-000001");
  assert.deepEqual(model.issues, []);
  assert.deepEqual(
    [...model.sourceRelations],
    ["REQ-000001|QA-000001|SAMPLE-UT-001"],
  );
  assert.deepEqual(model.sourceRelationEntries, [
    "REQ-000001|QA-000001|SAMPLE-UT-001",
  ]);
  assert.equal(
    model.sourceConditions.get("REQ-000001|QA-000001"),
    "条件 を保存する",
  );
  assert.deepEqual([...model.detailGoalRelations], ["core|QA-000001"]);
  assert.deepEqual(model.localIds, ["SAMPLE-UT-001"]);
  const invalidHeader = inspectQualityDefinition(
    {
      ...artifact,
      content: content.replace("| Local ID | 条件区分 |", "| ID | 条件区分 |"),
    },
    "QA-000001",
  );
  assert.ok(
    invalidHeader.issues.some(
      (issue) => issue.reason === "verification-item-schema-invalid",
    ),
  );
  assert.equal(invalidHeader.localItemLevels.get("SAMPLE-UT-001"), "UT");
  const shortRow = inspectQualityDefinition(
    {
      ...artifact,
      content: content.replace(
        "| 根拠 | 終了 | Automated |",
        "| 根拠 | 終了 |",
      ),
    },
    "QA-000001",
  );
  assert.deepEqual(shortRow.localIds, ["SAMPLE-UT-001"]);
  assert.equal(shortRow.localItemLevels.size, 0);
  const rewritten = inspectQualityDefinition(
    {
      ...artifact,
      content: content.replace(
        "### Architecture詳細設計入力",
        "| [REQ-000001](source.md) | `wrong.key` | Definition | 新条件 | IT | `SAMPLE-UT-001` |\n### Architecture詳細設計入力",
      ),
    },
    "QA-000001",
  );
  assert.equal(
    rewritten.sourceConditions.get("REQ-000001|QA-000001"),
    "新条件",
  );
  assert.equal(
    rewritten.obligationKeys.get("REQ-000001|QA-000001"),
    "wrong.key",
  );
  assert.equal(rewritten.sourceRelationEntries.length, 2);
  assert.equal(
    rewritten.issues[0]?.reason,
    "definition-source-local-relation-incomplete",
  );
  // 既存どおり生本文を解析し、コメント／Fence除去を追加しない。
  assert.equal(
    inspectQualityDefinition(
      { ...artifact, content: `<!--\n${content}\n-->` },
      "QA-000001",
    ).localIds[0],
    "SAMPLE-UT-001",
  );
});

/**
 * 条件区分・段階・追加種別・境界到達を検証する。
 * @responsibility 独立した適用条件と不正項目の診断順を固定する。
 * @trace RCM-UT-002
 * @precondition 完全本文と原因別の変更文字列を用意する。
 * @stimulus 区分、段階、主表示、人間承認、外部境界、実行形態を変更する。
 * @observation 発生したIssueのreason列を取得する。
 * @oracle 変更した必須条件のIssueが発生し、同時不正の順序を維持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 同期本文検査。
 */
test("Quality Definitionは適用区分・段階・人間承認を独立に検査する", () => {
  const source = createQualityDefinitionSource();
  const cases: readonly (readonly [string, string, string])[] = [
    [
      "Quality ID: `QA-000001`",
      "Quality ID: `QA-000002`",
      "definition-identity-mismatch",
    ],
    [
      "| `SAMPLE-UT-001` | 正常 | UT |",
      "| `SAMPLE-UT-001` | 正常 | IT |",
      "verification-item-id-level-mismatch",
    ],
    [
      "| `SAMPLE-UT-001` | 正常 | UT |",
      "| `SAMPLE-UT-001` | 未知 | UT |",
      "verification-item-condition-class-invalid",
    ],
    [
      "主な試験段階: Unit",
      "主な試験段階: Integration",
      "primary-test-level-summary-mismatch",
    ],
    [
      "| PT | N/A | なし | N/A |",
      "| PT | Required | なし | N/A |",
      "expensive-test-authorization-invalid",
    ],
    [
      "| LT | N/A | なし | N/A |",
      "| LT | N/A | なし | Human Explicit Authorization |",
      "expensive-test-authorization-invalid",
    ],
    [
      "| Contract | Core | N/A |",
      "| Contract | Core | Direct Boundary |",
      "test-level-applicability-conflict",
    ],
    ["| Automated |", "| Robot |", "verification-item-execution-mode-invalid"],
    [
      "| 正常 | Required | `SAMPLE-UT-001` |",
      "| 正常 | N/A | なし |",
      "verification-state-applicability-invalid",
    ],
  ];
  for (const [from, to, reason] of cases) {
    const model = inspectQualityDefinition(
      { path: "definition.md", content: source.replace(from, to) },
      "QA-000001",
    );
    assert.ok(
      model.issues.some((issue) => issue.reason === reason),
      reason,
    );
  }
  const validAuthorization = source.replace(
    "| PT | N/A | なし | N/A |",
    "| PT | Required | なし | Human Explicit Authorization |",
  );
  assert.deepEqual(
    inspectQualityDefinition(
      { path: "definition.md", content: validAuthorization },
      "QA-000001",
    ).issues,
    [],
  );
  const multiple = inspectQualityDefinition(
    {
      path: "definition.md",
      content: source
        .replace("Quality ID: `QA-000001`", "Quality ID: `QA-000002`")
        .replace("| Local ID | 条件区分 |", "| ID | 条件区分 |")
        .replace("| Automated |", "| Robot |"),
    },
    "QA-000001",
  );
  assert.deepEqual(
    multiple.issues.map((issue) => issue.reason),
    [
      "definition-identity-mismatch",
      "verification-item-schema-invalid",
      "verification-item-execution-mode-invalid",
    ],
  );
});

/**
 * Local IDの先勝ち所有と出現ごとの重複を検証する。
 * @responsibility File間と同一File内の重複、入力不変、空Ownerの既存真偽条件を固定する。
 * @trace RCM-UT-002
 * @precondition 一つの既存Ownerと未所有IDを用意する。
 * @stimulus 同じIDを反復し、空文字Ownerも指定する。
 * @observation 新Owner MapとIssueの順序・detailsを取得する。
 * @oracle 最初のOwnerを保持し、入力を変えず後続出現ごとにIssueを返す。
 * @cleanup N/A: 外部資源なし。
 * @boundary RCM-UT-002=N/A: 局所Map処理。
 */
test("Quality Local ID所有は先勝ちで重複出現を失わない", () => {
  const owners = new Map([["SAMPLE-UT-001", "previous.md"]]);
  const model = inspectQualityLocalItemOwnership(
    "current.md",
    ["SAMPLE-UT-001", "NEW-UT-001", "NEW-UT-001", "SAMPLE-UT-001"],
    owners,
  );
  assert.deepEqual([...owners], [["SAMPLE-UT-001", "previous.md"]]);
  assert.deepEqual(
    [...model.owners],
    [
      ["SAMPLE-UT-001", "previous.md"],
      ["NEW-UT-001", "current.md"],
    ],
  );
  assert.deepEqual(
    model.issues.map((issue) => issue.details),
    [
      { localId: "SAMPLE-UT-001", previousOwner: "previous.md" },
      { localId: "NEW-UT-001", previousOwner: "current.md" },
      { localId: "SAMPLE-UT-001", previousOwner: "previous.md" },
    ],
  );
  const emptyOwner = inspectQualityLocalItemOwnership(
    "current.md",
    ["X-UT-001"],
    new Map([["X-UT-001", ""]]),
  );
  assert.deepEqual(emptyOwner.issues, []);
  assert.equal(emptyOwner.owners.get("X-UT-001"), "current.md");
});

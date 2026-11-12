/**
 * 品質設計成果物の状態条件を検証する。
 *
 * @packageDocumentation
 * @responsibility 旧正規化境界、中立Issueの全field・順序と入力不変を固定する。
 * @trace RCM-UT-001
 * @level UT
 * @scope artifact、quality、canonical-state
 * @boundary RCM-UT-001=N/A: 解析済みモデル間の純粋計算だけを扱う。
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectQualityDesignStates,
  parseMarkdownArtifact,
} from "../../../src/index.ts";

/**
 * 状態正規化の受理・拒否境界を検証する。
 *
 * @responsibility 欠落・版・括弧・空白・大小文字の既存差を保持する。
 * @trace RCM-UT-001
 * @precondition 明示した状態と期待する正規化結果を使う。
 * @stimulus 単一モデルへ状態検査を適用する。
 * @observation Issueの有無と元status・normalizedStatusを取得する。
 * @oracle 固定期待値に一致し、仕様改善による受理拡張を行わない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の純粋計算である。
 */
test("Canonical状態の旧正規化順序と拒否境界を維持する", () => {
  const cases: readonly (readonly [string | null, string])[] = [
    ["Canonical", "Canonical"],
    [" Canonical ", "Canonical"],
    ["v0.22.0 Canonical", "Canonical"],
    ["Canonical（Released Baseline: v0.21.0）", "Canonical"],
    ["v0.22.0 Canonical（Released Baseline: v0.21.0）", "Canonical"],
    [null, ""],
    ["", ""],
    ["Draft", "Draft"],
    ["Candidate", "Candidate"],
    ["canonical", "canonical"],
    [" v0.22.0 Canonical", "v0.22.0 Canonical"],
    [
      "Canonical (Released Baseline: v0.21.0)",
      "Canonical (Released Baseline: v0.21.0)",
    ],
    ["v0.22 Canonical", "v0.22 Canonical"],
    [
      "Canonical（Released Baseline: v0.21.0） ",
      "Canonical（Released Baseline: v0.21.0）",
    ],
  ];
  for (const [status, normalizedStatus] of cases) {
    const artifact = {
      ...parseMarkdownArtifact({
        path: "07_Quality/item.md",
        content: "# Item",
      }),
      status,
    };
    const issues = inspectQualityDesignStates([artifact]);
    assert.equal(
      issues.length,
      normalizedStatus === "Canonical" ? 0 : 1,
      String(status),
    );
    if (normalizedStatus !== "Canonical")
      assert.deepEqual(issues[0]?.details, { status, normalizedStatus });
  }
});

/**
 * Issueの中立契約・Identity・順序と入力不変を検証する。
 *
 * @responsibility 不正成果物ごとに一つの中立Issueを返し、Checkerの表示情報を混ぜない。
 * @trace RCM-UT-001
 * @precondition Canonical・Draft・欠落のモデルを混ぜ、IDの有無と行位置を与える。
 * @stimulus 同じモデル集合を二度検査する。
 * @observation 全Issueと入力Snapshotを比較する。
 * @oracle 全field・順序が一致し、入力・共有状態が変更されない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: Process内の純粋計算である。
 */
test("状態Issueは元値・Identity・行位置・入力順を保つ", () => {
  const base = parseMarkdownArtifact({
    path: "07_Quality/item.md",
    content: "# Item",
  });
  const artifacts = [
    { ...base, status: "Canonical" },
    {
      ...base,
      status: "Draft",
      canonicalId: "QA-000001",
      sourceLocation: { path: "07_Quality/first.md", line: 3 },
    },
    {
      ...base,
      status: null,
      sourceLocation: { path: "07_Quality/second.md", line: 8 },
    },
  ];
  const before = JSON.stringify(artifacts);
  const expectedKinds = [
    {
      kind: "artifact.quality-design.state-invalid",
      targetIdentity: "QA-000001",
      location: { path: "07_Quality/first.md", line: 3 },
      reason: "canonical_state_required",
      details: { status: "Draft", normalizedStatus: "Draft" },
    },
    {
      kind: "artifact.quality-design.state-invalid",
      targetIdentity: "07_Quality/second.md",
      location: { path: "07_Quality/second.md", line: 8 },
      reason: "canonical_state_required",
      details: { status: null, normalizedStatus: "" },
    },
  ];
  assert.deepEqual(inspectQualityDesignStates(artifacts), expectedKinds);
  assert.deepEqual(inspectQualityDesignStates(artifacts), expectedKinds);
  assert.equal(JSON.stringify(artifacts), before);
  assert.deepEqual(inspectQualityDesignStates([]), []);
});

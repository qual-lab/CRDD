/**
 * 共通結果の状態と不正相関の拒否を検証する。
 *
 * @packageDocumentation
 * @responsibility Surface変換を経由せず、Domain公開入口の四状態・必須情報・禁止fieldを確認する。
 * @trace RCM-UT-016
 * @level UT
 * @scope domain-outcome、validation
 * @boundary RCM-UT-016=N/A: 不変fixtureと同期検査だけを扱う。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateDomainOutcome } from "../../src/index.ts";

/**
 * 四状態の値と中立な問題情報を保持することを検証する。
 *
 * @responsibility 結果有無・Issue・状態を一組で確認し、Surface固有fieldを生成しないことを検証する。
 * @trace RCM-UT-016
 * @precondition 四状態の契約に適合した局所fixtureを使う。
 * @stimulus Package公開入口の妥当性検査へ渡す。
 * @observation 返却値全体と呼出し前後の入力を比較する。
 * @oracle 四状態と全Issue fieldが一致し、入力は不変である。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-016=N/A: Process内の同期検査。
 */
test("共通結果の直接検査は四状態と全Issue fieldを保持する", () => {
  const issue = {
    kind: "fixture.problem",
    targetIdentity: "fixture.item",
    location: { path: "item.md", line: 2 },
    reason: "fixture_reason",
    details: { text: "value", count: 1, observed: false, missing: null },
  };
  for (const [status, result, issues] of [
    ["complete", { value: 1 }, []],
    ["partial", { value: 1 }, [issue]],
    ["partial", null, [issue]],
    ["invalid", null, [issue]],
    ["unobservable", null, [issue]],
  ] as const) {
    const input = { status, result, issues };
    const before = JSON.stringify(input);
    assert.deepEqual(validateDomainOutcome(input), input);
    assert.equal(JSON.stringify(input), before);
    assert.deepEqual(Object.keys(validateDomainOutcome(input)), [
      "status",
      "result",
      "issues",
    ]);
  }
});

/**
 * 状態と結果・問題の不正相関を検証する。
 *
 * @responsibility 必須field欠落・不正状態・成功と問題の併存を拒否することを確認する。
 * @trace RCM-UT-016
 * @precondition 一条件ずつ契約違反にした固定入力を使う。
 * @stimulus 公開妥当性検査へ渡す。
 * @observation 固定例外理由を取得する。
 * @oracle 不正値を正常な共通結果へ補完しない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-016=N/A: Process内の同期検査。
 */
test("共通結果の直接検査は不正状態・欠落・不正相関を拒否する", () => {
  const issue = {
    kind: "fixture.problem",
    targetIdentity: "fixture.item",
    location: { path: "item.md" },
    reason: "fixture_reason",
    details: {},
  };
  const cases: readonly (readonly [unknown, string])[] = [
    [null, "domain_outcome_object_required"],
    [[], "domain_outcome_object_required"],
    [
      { status: "future", result: null, issues: [] },
      "domain_outcome_status_invalid",
    ],
    [{ status: "complete", issues: [] }, "domain_outcome_result_required"],
    [
      { status: "complete", result: {}, issues: null },
      "domain_outcome_issues_required",
    ],
    [
      { status: "complete", result: null, issues: [] },
      "domain_outcome_complete_result_required",
    ],
    [
      { status: "complete", result: {}, issues: [issue] },
      "domain_outcome_complete_issue_forbidden",
    ],
    ...["partial", "invalid", "unobservable"].map(
      (status) =>
        [
          { status, result: null, issues: [] },
          "domain_outcome_non_complete_issue_required",
        ] as const,
    ),
    ...["invalid", "unobservable"].map(
      (status) =>
        [
          { status, result: {}, issues: [issue] },
          "domain_outcome_failed_result_forbidden",
        ] as const,
    ),
    [
      { status: "invalid", result: null, issues: [issue], severity: "error" },
      "domain_outcome_property_forbidden:severity",
    ],
  ];
  for (const [value, reason] of cases)
    assert.throws(() => validateDomainOutcome(value), { message: reason });
});

/**
 * Issueの必須field・位置・detailsと禁止fieldを検証する。
 *
 * @responsibility Checker経由の専用試験に依存せず中立Issueの拒否条件を確認する。
 * @trace RCM-UT-016
 * @precondition Issueの一fieldだけを変更した固定入力を使う。
 * @stimulus 公開妥当性検査へ渡す。
 * @observation 固定例外理由と正常な未知kindの保持を取得する。
 * @oracle 構造不正は拒否するが、Surfaceの未知kind判定をDomainへ逆流させない。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary RCM-UT-016=N/A: Process内の同期検査。
 */
test("共通結果の直接検査はIssue構造を検証しkindの表示可否を判断しない", () => {
  const issue = {
    kind: "future.domain.issue",
    targetIdentity: "fixture.item",
    location: { path: "item.md" },
    reason: "fixture_reason",
    details: {},
  };
  const cases: readonly (readonly [unknown, string])[] = [
    [null, "domain_issue_object_required:0"],
    [[], "domain_issue_object_required:0"],
    [{ ...issue, kind: "" }, "domain_issue_kind_required:0"],
    [
      { ...issue, targetIdentity: undefined },
      "domain_issue_target_identity_required:0",
    ],
    [{ ...issue, reason: undefined }, "domain_issue_reason_required:0"],
    [{ ...issue, location: null }, "domain_issue_location_required:0"],
    [{ ...issue, location: {} }, "domain_issue_location_path_required:0"],
    [
      { ...issue, location: { path: "item.md", line: 0 } },
      "domain_issue_location_line_invalid:0",
    ],
    [
      { ...issue, location: { path: "item.md", extra: true } },
      "domain_issue_location_property_forbidden:0:extra",
    ],
    [{ ...issue, details: [] }, "domain_issue_details_required:0"],
    [
      { ...issue, details: { extra: {} } },
      "domain_issue_detail_invalid:0:extra",
    ],
    [
      { ...issue, code: "display-code" },
      "domain_issue_property_forbidden:0:code",
    ],
  ];
  for (const [value, reason] of cases)
    assert.throws(
      () =>
        validateDomainOutcome({
          status: "invalid",
          result: null,
          issues: [value],
        }),
      { message: reason },
    );
  assert.deepEqual(
    validateDomainOutcome({ status: "invalid", result: null, issues: [issue] })
      .issues,
    [issue],
  );
});

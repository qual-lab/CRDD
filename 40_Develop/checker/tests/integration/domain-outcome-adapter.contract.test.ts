/**
 * Domain OutcomeとChecker Adapterの直接境界を検証する。
 *
 * @packageDocumentation
 * @responsibility complete、partial、invalid、unobservableの保持、Issue変換、禁止fieldおよび不正相関の拒否を検証する。
 * @trace RCM-IT-011
 * @level IT
 * @scope domain-outcome、checker-adapter
 * @boundary RCM-IT-011=Direct Boundary: CRDD Domain LibraryのOutcome／IssueをChecker固有結果へ変換する。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { mapDomainOutcomeToCheckerResult } from "../../src/adapters/domain-outcome.ts";
import { mapRealityDomainIssueToCheckerFinding } from "../../src/adapters/reality-traceability.ts";

const issue = {
  kind: "graph.symbol.identity-duplicate",
  targetIdentity: "sample.duplicate",
  location: { path: "40_Develop/sample/symbol.json", line: 2 },
  reason: "declared_identity_is_not_unique",
  details: { symbolId: "sample.duplicate" },
} as const;

/**
 * Domain Outcomeの全状態をChecker結果へ意味を保って変換することを検証する。
 *
 * @responsibility complete、partial、invalid、unobservableの状態、result、Finding、未検査状態と終了Codeを対で確認する。
 * @trace RCM-IT-011
 * @precondition 全状態の固定Outcome fixtureと認識済みDomain Issueを使用する。
 * @stimulus Domain OutcomeをChecker Adapterへ渡す。
 * @observation 変換前後の状態、result、Finding、uncheckedおよびexitCodeを観測する。
 * @oracle completeだけが成功し、非complete状態は元の状態を保持して失敗する。
 * @cleanup N/A: Process内の不変fixtureだけを使用する。
 * @boundary RCM-IT-011=Direct Boundary: Domain結果からChecker結果への変換境界。
 */
test("Domain Outcomeの全状態をChecker結果へ意味を保って変換する", () => {
  const complete = mapDomainOutcomeToCheckerResult(
    { status: "complete", result: { value: 1 }, issues: [] },
    mapRealityDomainIssueToCheckerFinding,
  );
  assert.deepEqual(complete, {
    status: "complete",
    result: { value: 1 },
    findings: [],
    unchecked: false,
    exitCode: 0,
  });

  for (const [status, result] of [
    ["partial", { value: 1 }],
    ["invalid", null],
    ["unobservable", null],
  ] as const) {
    const mapped = mapDomainOutcomeToCheckerResult(
      { status, result, issues: [issue] },
      mapRealityDomainIssueToCheckerFinding,
    );
    assert.equal(mapped.status, status);
    assert.deepEqual(mapped.result, result);
    assert.equal(mapped.findings[0]?.code, "reality-symbol-id-duplicate");
    assert.equal(mapped.unchecked, status === "unobservable");
    assert.equal(mapped.exitCode, 1);
  }
});

/**
 * 不正相関、未知Issue kind、必須field欠落および禁止fieldを拒否することを検証する。
 *
 * @responsibility Domain契約とChecker変換契約を同じ直接境界でFail Closedにする。
 * @trace RCM-IT-011
 * @precondition 契約違反を一つずつ含む固定fixtureを使用する。
 * @stimulus 各fixtureをChecker Adapterへ渡す。
 * @observation 例外理由と変換結果の不存在を観測する。
 * @oracle completeとissueの併存、必須field欠落、禁止fieldおよび未知kindをすべて拒否する。
 * @cleanup N/A: Process内の不変fixtureだけを使用する。
 * @boundary RCM-IT-011=Direct Boundary: 未信頼Domain結果をCheckerへ受け入れる境界。
 */
test("不正相関、未知Issue kind、必須field欠落および禁止fieldを拒否する", () => {
  assert.throws(
    () =>
      mapDomainOutcomeToCheckerResult(
        { status: "complete", result: { value: 1 }, issues: [issue] },
        mapRealityDomainIssueToCheckerFinding,
      ),
    /domain_outcome_complete_issue_forbidden/,
  );
  assert.throws(
    () =>
      mapDomainOutcomeToCheckerResult(
        {
          status: "invalid",
          result: null,
          issues: [{ ...issue, reason: undefined }],
        },
        mapRealityDomainIssueToCheckerFinding,
      ),
    /domain_issue_reason_required/,
  );
  assert.throws(
    () =>
      mapDomainOutcomeToCheckerResult(
        { status: "invalid", result: null, issues: [issue], severity: "error" },
        mapRealityDomainIssueToCheckerFinding,
      ),
    /domain_outcome_property_forbidden:severity/,
  );
  assert.throws(
    () =>
      mapDomainOutcomeToCheckerResult(
        {
          status: "invalid",
          result: null,
          issues: [{ ...issue, kind: "future.domain.issue" }],
        },
        mapRealityDomainIssueToCheckerFinding,
      ),
    /unknown_reality_domain_issue:future\.domain\.issue/,
  );
});

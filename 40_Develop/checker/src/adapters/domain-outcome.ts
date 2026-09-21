/**
 * Domain OutcomeをChecker結果へ変換する境界。
 *
 * @packageDocumentation
 * @responsibility CRDD Domain Libraryの結果状態とIssueを、意味を弱めずCheckerの結果へ変換する。
 * @trace ARCH-000001
 * @boundary CRDD Domain LibraryとChecker固有Finding／終了状態とのAdapter境界。
 */
import {
  type DomainIssue,
  type DomainOutcome,
  validateDomainOutcome,
} from "../../../crdd-domain-library/src/index.ts";

/**
 * Checkerへ変換済みのDomain Outcomeを表す。
 *
 * @responsibility Domain状態、結果、Finding、未検査状態および終了Codeの相関を型境界として所有する。
 * @trace ARCH-000001
 * @shape status、result、findings、unchecked、exitCodeを一組で保持する。
 * @invariant completeだけがunchecked falseかつexitCode 0になり得る。
 * @boundary CRDD Domain Libraryの結果とChecker公開結果との型境界。
 * @security Domainの禁止fieldや未変換Issueを保持しない。
 * @compatibility Checker利用側は宣言済みPropertyと状態相関だけへ依存する。
 */
export type CheckerDomainOutcome<T, Finding> = Readonly<{
  status: DomainOutcome<T>["status"];
  result: T | null;
  findings: readonly Finding[];
  unchecked: boolean;
  exitCode: 0 | 1;
}>;

/**
 * Domain OutcomeをChecker固有結果へ変換する。
 *
 * @responsibility Domain状態を保持し、Issueの明示変換後にCheckerのFinding、未検査状態および終了Codeを決定する。
 * @trace ARCH-000001
 * @input value: 未信頼のDomain Outcome、mapIssue: Domain IssueをChecker Findingへ変換する関数。
 * @returns Domain状態、result、Finding、未検査状態および終了Codeを持つChecker結果を返す。
 * @precondition mapIssueは認識したDomain Issueだけを変換し、未知kindを拒否する。
 * @postcondition partial、invalid、unobservableをcompleteへ昇格せず、Domain固有fieldをChecker結果へ漏らさない。
 * @effect N/A: 入力の検証と値変換以外のEffectを発行しない。
 * @failure Domain契約違反または未知Issue kindを例外として拒否する。
 * @invariant completeだけがexitCode 0かつunchecked falseになり、非complete状態は必ずexitCode 1になる。
 * @boundary CRDD Domain LibraryのOutcome／IssueとChecker固有Finding／終了Codeとの直接境界。
 * @security 不明fieldと禁止fieldを結果へ転送せず、許可したFindingだけを公開する。
 * @concurrency N/A: 共有状態を持たない同期変換である。
 */
export function mapDomainOutcomeToCheckerResult<T, Finding>(
  value: unknown,
  mapIssue: (issue: DomainIssue) => Finding,
): CheckerDomainOutcome<T, Finding> {
  const outcome = validateDomainOutcome<T>(value);
  return {
    status: outcome.status,
    result: outcome.result,
    findings: outcome.issues.map(mapIssue),
    unchecked: outcome.status === "unobservable",
    exitCode: outcome.status === "complete" ? 0 : 1,
  };
}

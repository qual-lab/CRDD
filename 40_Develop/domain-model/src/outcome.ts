/**
 * outcomeに属する責務をまとめる。
 *
 * @responsibility DomainStatusを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */
/**
 * outcomeで使用するDomain Statusの値契約を定義する。
 *
 * @responsibility Domain StatusのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DomainStatusが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DomainStatusで宣言した値と責務の対応を維持する。
 * @boundary N/A: DomainStatusの宣言は外部境界を開かない。
 * @security N/A: DomainStatusはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DomainStatusの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DomainStatus = "complete" | "partial" | "invalid" | "unobservable";

/**
 * outcomeで使用するDomain Locationの値契約を定義する。
 *
 * @responsibility Domain LocationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DomainLocationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DomainLocationで宣言した値と責務の対応を維持する。
 * @boundary N/A: DomainLocationの宣言は外部境界を開かない。
 * @security N/A: DomainLocationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DomainLocationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DomainLocation = Readonly<{
  path: string;
  line?: number;
}>;

/**
 * outcomeで使用するDomain Issueの値契約を定義する。
 *
 * @responsibility Domain IssueのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DomainIssueが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DomainIssueで宣言した値と責務の対応を維持する。
 * @boundary N/A: DomainIssueの宣言は外部境界を開かない。
 * @security N/A: DomainIssueはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DomainIssueの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DomainIssue = Readonly<{
  kind: string;
  targetIdentity: string;
  location: DomainLocation;
  reason: string;
  details: Readonly<Record<string, string | number | boolean | null>>;
}>;

/**
 * outcomeで使用するDomain Outcomeの値契約を定義する。
 *
 * @responsibility Domain OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape DomainOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DomainOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: DomainOutcomeの宣言は外部境界を開かない。
 * @security N/A: DomainOutcomeはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DomainOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DomainOutcome<T> = Readonly<{
  status: DomainStatus;
  result: T | null;
  issues: readonly DomainIssue[];
}>;

/**
 * 未信頼の値をDomain Outcome契約として検証する。
 *
 * @responsibility Domain OutcomeとDomain Issueの必須field、禁止fieldおよび状態間の相関不変条件を実行時に検証する。
 * @trace ARCH-000008
 * @input value: 未信頼境界から受け取った値。
 * @returns 検証済みのDomain Outcomeを返す。
 * @precondition valueは未検証であり、任意のJavaScript値を取り得る。
 * @postcondition complete、partial、invalid、unobservableの相関不変条件と全field契約を満たす値だけを返す。
 * @effect N/A: 入力の読取り以外のEffectを発行しない。
 * @failure 契約外の状態、必須field欠落、禁止field、completeとissueの併存、不正なIssueを例外として拒否する。
 * @invariant completeは非null resultとissue 0件、invalid／unobservableはnull resultとissue 1件以上を持つ。
 * @boundary 未信頼の構造化値とCRDD Domain Libraryの型付きDomain Outcomeとの境界。
 * @security 不明fieldを保持せず、Checker固有fieldをDomain契約へ混入させない。
 * @concurrency N/A: 共有状態を持たない同期検証である。
 */
export function validateDomainOutcome<T = unknown>(
  value: unknown,
): DomainOutcome<T> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("domain_outcome_object_required");
  const record = value as Record<string, unknown>;
  const allowedOutcomeKeys = new Set(["status", "result", "issues"]);
  for (const key of Object.keys(record))
    if (!allowedOutcomeKeys.has(key))
      throw new Error(`domain_outcome_property_forbidden:${key}`);
  if (
    record.status !== "complete" &&
    record.status !== "partial" &&
    record.status !== "invalid" &&
    record.status !== "unobservable"
  )
    throw new Error("domain_outcome_status_invalid");
  if (!("result" in record)) throw new Error("domain_outcome_result_required");
  if (!Array.isArray(record.issues))
    throw new Error("domain_outcome_issues_required");

  const allowedIssueKeys = new Set([
    "kind",
    "targetIdentity",
    "location",
    "reason",
    "details",
  ]);
  const issues = record.issues.map((candidate, index): DomainIssue => {
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      Array.isArray(candidate)
    )
      throw new Error(`domain_issue_object_required:${index}`);
    const issue = candidate as Record<string, unknown>;
    for (const key of Object.keys(issue))
      if (!allowedIssueKeys.has(key))
        throw new Error(`domain_issue_property_forbidden:${index}:${key}`);
    if (typeof issue.kind !== "string" || issue.kind.length === 0)
      throw new Error(`domain_issue_kind_required:${index}`);
    if (
      typeof issue.targetIdentity !== "string" ||
      issue.targetIdentity.length === 0
    )
      throw new Error(`domain_issue_target_identity_required:${index}`);
    if (typeof issue.reason !== "string" || issue.reason.length === 0)
      throw new Error(`domain_issue_reason_required:${index}`);
    if (
      typeof issue.location !== "object" ||
      issue.location === null ||
      Array.isArray(issue.location)
    )
      throw new Error(`domain_issue_location_required:${index}`);
    const location = issue.location as Record<string, unknown>;
    for (const key of Object.keys(location))
      if (key !== "path" && key !== "line")
        throw new Error(
          `domain_issue_location_property_forbidden:${index}:${key}`,
        );
    if (typeof location.path !== "string" || location.path.length === 0)
      throw new Error(`domain_issue_location_path_required:${index}`);
    if (
      location.line !== undefined &&
      (!Number.isInteger(location.line) || (location.line as number) < 1)
    )
      throw new Error(`domain_issue_location_line_invalid:${index}`);
    if (
      typeof issue.details !== "object" ||
      issue.details === null ||
      Array.isArray(issue.details)
    )
      throw new Error(`domain_issue_details_required:${index}`);
    for (const [key, detail] of Object.entries(issue.details))
      if (
        detail !== null &&
        typeof detail !== "string" &&
        typeof detail !== "number" &&
        typeof detail !== "boolean"
      )
        throw new Error(`domain_issue_detail_invalid:${index}:${key}`);
    return {
      kind: issue.kind,
      targetIdentity: issue.targetIdentity,
      location: {
        path: location.path,
        ...(location.line === undefined
          ? {}
          : { line: location.line as number }),
      },
      reason: issue.reason,
      details: issue.details as DomainIssue["details"],
    };
  });

  if (record.status === "complete") {
    if (record.result === null)
      throw new Error("domain_outcome_complete_result_required");
    if (issues.length > 0)
      throw new Error("domain_outcome_complete_issue_forbidden");
  } else if (issues.length === 0) {
    throw new Error("domain_outcome_non_complete_issue_required");
  }
  if (
    (record.status === "invalid" || record.status === "unobservable") &&
    record.result !== null
  )
    throw new Error("domain_outcome_failed_result_forbidden");

  return {
    status: record.status,
    result: record.result as T | null,
    issues,
  };
}

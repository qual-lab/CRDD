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

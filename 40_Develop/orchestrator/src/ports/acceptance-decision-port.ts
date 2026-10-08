/**
 * Objective／Milestone受入判断のAuthorityと耐久記録Port。
 *
 * @responsibility Project Runtime CoreがHostへ要求する受入判断Authority検証と一回限り記録の境界を所有する。
 * @trace ARCH-000005
 */
import type {
  ProjectRuntimeAcceptanceDecision,
  ProjectRuntimeAcceptanceTarget,
} from "../core/project-runtime-state.ts";
import type { ProjectRuntimePortResult } from "./port-result.ts";

/**
 * 受入判断Authorityを検証するexactなBindingを定義する。
 *
 * @responsibility AuthorityをProject、Milestone、Revision、世代、対象、判断およびPrincipalへ縮小する。
 * @trace ARCH-000005
 * @shape Authority検証に必要な非秘密Propertyだけを表す。
 * @invariant `SPEC-000002`以外の入力Sourceを受入判断Authorityへ昇格しない。
 * @boundary Project Runtime CoreとHost Authority Adapterの境界。
 * @security Capability秘密値を含めず、検証対象Bindingだけを保持する。
 * @compatibility 利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeAcceptanceDecisionAuthorityBinding = Readonly<{
  sourceSpecId: "SPEC-000002";
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  target: ProjectRuntimeAcceptanceTarget;
  targetId: string;
  decision: ProjectRuntimeAcceptanceDecision;
  principalId: string;
}>;

/**
 * Host所有の受入判断Authority検証Portを定義する。
 *
 * @responsibility Hostで認証済みのPrincipalがexact Bindingへ許可されているかだけを返す。
 * @trace ARCH-000005
 * @shape `verify`操作と入力契約を表す。
 * @invariant CoreへAuthority生成、拡張または秘密値保存を許可しない。
 * @boundary Project運営者AuthorityとProject Runtime Coreの境界。
 * @security 認証済みPrincipal以外のCredential値を入力、記録または公開しない。
 * @compatibility 利用側は真偽の検証結果だけへ依存する。
 */
export type ProjectRuntimeAcceptanceDecisionAuthorityPort = Readonly<{
  verify: (
    binding: ProjectRuntimeAcceptanceDecisionAuthorityBinding,
  ) => boolean;
}>;

/**
 * 一回のObjective／Milestone受入判断記録を定義する。
 *
 * @responsibility 判断Identity、対象、根拠、状態適用前後および記録Dispositionを耐久境界として所有する。
 * @trace ARCH-000005
 * @shape 一つの明示判断とその適用状態を表す。
 * @invariant Capability秘密値、Task作成情報またはProvider Effect情報を保持しない。
 * @boundary Project Runtime Coreと受入判断Storeの境界。
 * @security Authority秘密値を保存せず、検証済みPrincipalとBindingだけを保持する。
 * @compatibility `prepared`から`finalized`への一方向遷移を維持する。
 */
export type ProjectRuntimeAcceptanceDecisionRecord = Readonly<{
  recordId: string;
  decisionId: string;
  sourceSpecId: "SPEC-000002";
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  target: ProjectRuntimeAcceptanceTarget;
  targetId: string;
  decision: ProjectRuntimeAcceptanceDecision;
  criterionEvidenceIds: readonly string[];
  principalId: string;
  disposition: "prepared" | "finalized";
  newGeneration: number | null;
}>;

/**
 * 一回限りの受入判断を耐久化するStore Portを定義する。
 *
 * @responsibility Record作成、exact読取りおよび比較交換を所有する。
 * @trace ARCH-000005
 * @shape `create`、`read`、`compareAndSet`の三操作を表す。
 * @invariant 同じRecord IDを別内容へ上書きせず、一つの論理Recordだけを保持する。
 * @boundary Project Runtime Coreと耐久Store Adapterの境界。
 * @security Capability秘密値を入力または保存しない。
 * @compatibility 利用側は`ProjectRuntimePortResult`の完了／停止境界だけへ依存する。
 */
export type ProjectRuntimeAcceptanceDecisionStore = Readonly<{
  create: (
    record: ProjectRuntimeAcceptanceDecisionRecord,
  ) => ProjectRuntimePortResult<ProjectRuntimeAcceptanceDecisionRecord>;
  read: (
    recordId: string,
  ) => ProjectRuntimePortResult<ProjectRuntimeAcceptanceDecisionRecord | null>;
  compareAndSet: (
    expected: ProjectRuntimeAcceptanceDecisionRecord,
    next: ProjectRuntimeAcceptanceDecisionRecord,
  ) => ProjectRuntimePortResult<ProjectRuntimeAcceptanceDecisionRecord>;
}>;

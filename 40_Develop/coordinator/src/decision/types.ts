/**
 * 人間判断・採用判断の値と依存契約を定義する。
 *
 * @responsibility 秘密値の発行や保存を行わず、判断Owner間の型境界を所有する。
 * @trace ARCH-000004
 */

import type {
  CoordinatorAcceptanceTarget,
  CoordinatorAcceptanceDecision,
} from "../state/model.ts";
import type {
  CoordinatorAcceptanceDecisionRecord,
  CoordinatorDecisionRecord,
  CoordinatorDecisionRecoveryIntent,
} from "./records.ts";
import type { CoordinatorPortResult } from "../state/result.ts";
import type { CoordinatorStatePort } from "../state/persistence.ts";
import type { COORDINATOR_ACCEPTANCE_DECISION_CONTRACT } from "./request.ts";

/**
 * 受入判断Authorityを検証するexactなBindingを定義する。
 *
 * @responsibility AuthorityをProject、Milestone、Revision、世代、対象、判断およびPrincipalへ縮小する。
 * @trace ARCH-000005
 * @shape Authority検証に必要な非秘密Propertyだけを表す。
 * @invariant `SPEC-000002`以外の入力Sourceを受入判断Authorityへ昇格しない。
 * @boundary Coordinator CoreとHost Authority Adapterの境界。
 * @security Capability秘密値を含めず、検証対象Bindingだけを保持する。
 * @compatibility 利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorAcceptanceDecisionAuthorityBinding = Readonly<{
  sourceSpecId: "SPEC-000002";
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  target: CoordinatorAcceptanceTarget;
  targetId: string;
  decision: CoordinatorAcceptanceDecision;
  principalId: string;
}>;

/**
 * Host所有の受入判断Authority検証Portを定義する。
 *
 * @responsibility Hostで認証済みのPrincipalがexact Bindingへ許可されているかだけを返す。
 * @trace ARCH-000005
 * @shape `verify`操作と入力契約を表す。
 * @invariant CoreへAuthority生成、拡張または秘密値保存を許可しない。
 * @boundary Project運営者AuthorityとCoordinator Coreの境界。
 * @security 認証済みPrincipal以外のCredential値を入力、記録または公開しない。
 * @compatibility 利用側は真偽の検証結果だけへ依存する。
 */
export type CoordinatorAcceptanceDecisionAuthorityPort = Readonly<{
  verify: (binding: CoordinatorAcceptanceDecisionAuthorityBinding) => boolean;
}>;

/**
 * 一回限りの受入判断を耐久化するStore Portを定義する。
 *
 * @responsibility Record作成、exact読取りおよび比較交換を所有する。
 * @trace ARCH-000005
 * @shape `create`、`read`、`compareAndSet`の三操作を表す。
 * @invariant 同じRecord IDを別内容へ上書きせず、一つの論理Recordだけを保持する。
 * @boundary Coordinator Coreと耐久Store Adapterの境界。
 * @security Capability秘密値を入力または保存しない。
 * @compatibility 利用側は`CoordinatorPortResult`の完了／停止境界だけへ依存する。
 */
export type CoordinatorAcceptanceDecisionStore = Readonly<{
  create: (
    record: CoordinatorAcceptanceDecisionRecord,
  ) => CoordinatorPortResult<CoordinatorAcceptanceDecisionRecord>;
  read: (
    recordId: string,
  ) => CoordinatorPortResult<CoordinatorAcceptanceDecisionRecord | null>;
  compareAndSet: (
    expected: CoordinatorAcceptanceDecisionRecord,
    next: CoordinatorAcceptanceDecisionRecord,
  ) => CoordinatorPortResult<CoordinatorAcceptanceDecisionRecord>;
}>;

/**
 * decision-capability-portで使用するCoordinator Decision Capabilityの値契約を定義する。
 *
 * @responsibility Coordinator Decision CapabilityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionCapabilityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionCapabilityで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionCapabilityの宣言は外部境界を開かない。
 * @security CoordinatorDecisionCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorDecisionCapabilityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionCapability = Readonly<{
  secret: string;
  hash: string;
}>;

/**
 * Host-owned cryptographic operations for one-time human decision capabilities.
 *
 * @responsibility Coordinator Decision Capability PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionCapabilityPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionCapabilityPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionCapabilityPortの宣言は外部境界を開かない。
 * @security CoordinatorDecisionCapabilityPortはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorDecisionCapabilityPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionCapabilityPort = Readonly<{
  issue: () => CoordinatorDecisionCapability;
  hash: (value: string) => string;
}>;

/**
 * decision-portで使用するCoordinator Decision Storeの値契約を定義する。
 *
 * @responsibility Coordinator Decision StoreのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionStoreが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionStoreで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionStoreの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionStoreはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionStoreの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionStore = Readonly<{
  create: (record: CoordinatorDecisionRecord) => unknown;
  read: (recordId: string) => unknown;
  compareAndSet: (
    expected: CoordinatorDecisionRecord,
    next: CoordinatorDecisionRecord,
  ) => unknown;
}>;

/**
 * decision-portで使用するCoordinator Decision 回復 Storeの値契約を定義する。
 *
 * @responsibility Coordinator Decision 回復 StoreのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionRecoveryStoreが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionRecoveryStoreで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionRecoveryStoreの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionRecoveryStoreはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionRecoveryStoreの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionRecoveryStore = Readonly<{
  create: (intent: CoordinatorDecisionRecoveryIntent) => unknown;
  read: (recoveryId: string) => unknown;
  compareAndSet: (
    expected: CoordinatorDecisionRecoveryIntent,
    next: CoordinatorDecisionRecoveryIntent,
  ) => unknown;
}>;

/**
 * decision-portで使用するCoordinator Decision Portの値契約を定義する。
 *
 * @responsibility Coordinator Decision PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionPort = Readonly<{
  store: CoordinatorDecisionStore;
  recoveryStore?: CoordinatorDecisionRecoveryStore;
}>;

/**
 * 受入判断Applicationの依存Portを定義する。
 *
 * @responsibility State、AuthorityおよびDecision Storeだけを依存として固定し、Task／Provider Portを除外する。
 * @trace ARCH-000005
 * @shape 三つの限定Portを表す。
 * @invariant Task作成またはProvider Effectを発行できる依存を追加しない。
 * @boundary Coordinator CoreとHost Adapterの境界。
 * @security Authority検証はHost Portだけが所有する。
 * @compatibility 利用側は宣言済みPort契約だけを実装する。
 */
export type CoordinatorAcceptanceDecisionDependencies = Readonly<{
  state: CoordinatorStatePort;
  authority: CoordinatorAcceptanceDecisionAuthorityPort;
  store: CoordinatorAcceptanceDecisionStore;
}>;

/**
 * 受入判断Applicationの公開結果を定義する。
 *
 * @responsibility 完了／停止、理由、Record Identity、世代および回復要否を公開する。
 * @trace ARCH-000005
 * @shape 利用側が次の処置を選ぶための非秘密結果を表す。
 * @invariant Authority秘密値や生Store内容を公開しない。
 * @boundary Coordinator CoreとTransportの結果境界。
 * @security 秘密値、絶対Pathまたは非公開Store情報を含めない。
 * @compatibility 利用側は宣言済み結果Fieldだけへ依存する。
 */
export type CoordinatorAcceptanceDecisionResult = Readonly<{
  contract: typeof COORDINATOR_ACCEPTANCE_DECISION_CONTRACT;
  status: "completed" | "blocked";
  reason: string;
  recordId: string | null;
  newGeneration: number | null;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
}>;

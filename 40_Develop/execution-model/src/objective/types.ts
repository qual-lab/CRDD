/**
 * Objectiveと実行計画の保存値と操作契約を定義する。
 * @responsibility 保存Schemaを変更せず、完成操作と検査が共有する型の正本を持つ。
 * @trace ARCH-000008
 */

import type { ProjectTaskDefinition } from "../task/types.ts";

/** モデルの値契約。型と利用側の投影は同じ定義を使用する。 */
export const OBJECTIVE_STATES = Object.freeze([
  "planned",
  "executing",
  "integration_pending",
  "accepted",
  "returned",
  "blocked",
  "cancelled",
] as const);

/**
 * Objective計画の共有型契約を定義する。
 *
 * @responsibility 受入条件、Objective集合とTask集合の型構造を共有する。
 * @trace ARCH-000004
 * @shape ObjectivePlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ObjectivePlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: ObjectivePlanの宣言は外部境界を開かない。
 * @security N/A: ObjectivePlanはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ObjectivePlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ObjectivePlan = Readonly<{
  milestoneAcceptanceCriteria: readonly string[];
  objectives: readonly ProjectObjectiveDefinition[];
  tasks: readonly ProjectTaskDefinition[];
}>;

/**
 * stateで使用するProject Objective 状態の値契約を定義する。
 *
 * @responsibility Project Objective 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectObjectiveStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectObjectiveStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectObjectiveStateの宣言は外部境界を開かない。
 * @security N/A: ProjectObjectiveStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectObjectiveStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectObjectiveState = (typeof OBJECTIVE_STATES)[number];

/**
 * stateで使用するProject Milestone 状態の値契約を定義する。
 *
 * @responsibility Project Milestone 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectMilestoneStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectMilestoneStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectMilestoneStateの宣言は外部境界を開かない。
 * @security N/A: ProjectMilestoneStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectMilestoneStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectMilestoneState =
  | "planned"
  | "executing"
  | "integrating"
  | "human_decision_required"
  | "recovery_required"
  | "accepted"
  | "returned"
  | "cancelled";

/**
 * stateで使用するProject Objective Definitionの値契約を定義する。
 *
 * @responsibility Project Objective DefinitionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectObjectiveDefinitionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectObjectiveDefinitionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectObjectiveDefinitionの宣言は外部境界を開かない。
 * @security N/A: ProjectObjectiveDefinitionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectObjectiveDefinitionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectObjectiveDefinition = Readonly<{
  id: string;
  acceptanceCriteria: readonly string[];
}>;

/**
 * stateで使用するProject Objective 記録の値契約を定義する。
 *
 * @responsibility Project Objective 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectObjectiveRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectObjectiveRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectObjectiveRecordの宣言は外部境界を開かない。
 * @security N/A: ProjectObjectiveRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectObjectiveRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectObjectiveRecord = Readonly<{
  definition: ProjectObjectiveDefinition;
  state: ProjectObjectiveState;
  criterionEvidenceIds: readonly string[];
}>;

/**
 * stateで使用するProject Milestone 記録の値契約を定義する。
 *
 * @responsibility Project Milestone 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectMilestoneRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectMilestoneRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectMilestoneRecordの宣言は外部境界を開かない。
 * @security N/A: ProjectMilestoneRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectMilestoneRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectMilestoneRecord = Readonly<{
  id: string;
  acceptanceCriteria: readonly string[];
  state: ProjectMilestoneState;
  criterionEvidenceIds: readonly string[];
}>;

/** 計画検査の外側の実行範囲。認可済みであることは表さない。 */
export type ExecutionPlanScope = Readonly<{ allowedPaths: readonly string[] }>;

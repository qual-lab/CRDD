/**
 * 状態の値契約・初期構築と共有する純粋検査を所有する。
 * @responsibility 状態の値契約・初期構築と共有する純粋検査を所有する。
 * @trace ARCH-000004
 */

import { snapshotPlainRecord } from "../input/plain-data-snapshot.ts";
import { normalizeRepositoryRelativePath } from "../input/repository-relative-path.ts";

export const ORCHESTRATOR_STATE_CONTRACT =
  "crdd-coordinator/orchestrator-state/v1" as const;

export const ORCHESTRATOR_MAXIMUM_CONCURRENCY = 5;

export const ORCHESTRATOR_MAXIMUM_OBJECTIVES = 128;

export const ORCHESTRATOR_MAXIMUM_TASKS = 1024;

/**
 * 同じ結果に対する上位の耐久受理本文を定義する。
 * @responsibility Repository・仕事・Attempt・結果と初回受理世代の結合を所有する。
 * @trace ARCH-000004
 * @shape 十一項目の固定本文。consumerはorchestratorだけ。
 * @invariant 実行操作IDで上位論理操作IDを代用しない。
 * @boundary Coordinatorの結果投影とOrchestratorの耐久保存。
 * @security Path・秘密値・処置Authorityを含めない。
 * @compatibility 旧Runtime領収書を新本文へ読み替えない。
 */
export type ProjectResultAcceptance = Readonly<{
  repositoryBindingId: string;
  projectId: string;
  milestoneId: string;
  taskId: string;
  attemptId: string;
  operationId: string;
  recoveryId: string;
  settlementGeneration: number;
  repositoryBinding: string;
  resultId: string;
  consumer: "orchestrator";
}>;

/**
 * 新しい結果受理本文の閉じた形式を検査する。
 * @responsibility 欠落・追加項目・旧形式と不正な識別子、Hash、世代を拒否する。
 * @trace ARCH-000004
 * @input value: 未検証の受理本文。
 * @returns 検査済み固定本文、またはnull。
 * @precondition N/A: 任意の入力を拒否可能な境界として扱う。
 * @postcondition 初回受理世代や入力の値を補完・更新しない。
 * @effect N/A: 局所値の検査だけ。
 * @failure 不正本文、getter、Proxy、欠落、旧項目、空値はnull。
 * @invariant 形式成立を保存・受理・cleanup成立へ昇格しない。
 * @boundary 上位の保存本文とその利用側。
 * @security 外部Authorityを発行せず入力の関数を呼ばない。
 * @concurrency N/A: 共有状態を持たない同期処理。
 */
export function decodeProjectResultAcceptance(
  value: unknown,
): ProjectResultAcceptance | null {
  const acceptance = snapshotPlainRecord(
    value,
    new Set([
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
      "settlementGeneration",
      "repositoryBinding",
      "resultId",
      "consumer",
    ]),
  );
  if (
    !acceptance ||
    [
      "repositoryBindingId",
      "projectId",
      "milestoneId",
      "taskId",
      "attemptId",
      "operationId",
      "recoveryId",
    ].some(
      (key) =>
        typeof acceptance[key] !== "string" ||
        acceptance[key].length === 0 ||
        acceptance[key].length > 1024,
    ) ||
    !Number.isSafeInteger(acceptance.settlementGeneration) ||
    Number(acceptance.settlementGeneration) < 1 ||
    acceptance.consumer !== "orchestrator" ||
    [acceptance.repositoryBinding, acceptance.resultId].some(
      (item) => typeof item !== "string" || !/^[a-f0-9]{64}$/u.test(item),
    )
  )
    return null;
  return Object.freeze(acceptance) as ProjectResultAcceptance;
}

/**
 * orchestrator-stateで使用するProject Task 状態の値契約を定義する。
 *
 * @responsibility Project Task 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskStateの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskState =
  | "planned"
  | "waiting_dependency"
  | "ready"
  | "starting"
  | "running"
  | "cleanup_pending"
  | "completed"
  | "failed"
  | "cancelled"
  | "recovery_required"
  | "superseded";

/**
 * orchestrator-stateで使用するProject Objective 状態の値契約を定義する。
 *
 * @responsibility Project Objective 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectObjectiveStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectObjectiveStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectObjectiveStateの宣言は外部境界を開かない。
 * @security N/A: ProjectObjectiveStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectObjectiveStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectObjectiveState =
  | "planned"
  | "executing"
  | "integration_pending"
  | "accepted"
  | "returned"
  | "blocked"
  | "cancelled";

/**
 * orchestrator-stateで使用するProject Milestone 状態の値契約を定義する。
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
 * Orchestratorの受入判断対象を定義する。
 *
 * @responsibility Objective判断とMilestone判断を混同しない対象区分を所有する。
 * @trace ARCH-000005
 * @shape `objective`または`milestone`のいずれか一つを表す。
 * @invariant Task、ProjectionまたはProviderを受入判断対象へ昇格しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: 型宣言はAuthorityや秘密値を保持しない。
 * @compatibility 利用側は宣言済みの二つの対象区分だけへ依存する。
 */
export type OrchestratorAcceptanceTarget = "objective" | "milestone";

/**
 * Orchestratorの明示的な受入判断を定義する。
 *
 * @responsibility 受入、差戻し、判断待ちを別の判断値として所有する。
 * @trace ARCH-000005
 * @shape `accept`、`return`、`wait`のいずれか一つを表す。
 * @invariant Task完了または下位状態から判断値を推定しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: 型宣言はAuthorityや秘密値を保持しない。
 * @compatibility 利用側は宣言済みの三つの判断値だけへ依存する。
 */
export type OrchestratorAcceptanceDecision = "accept" | "return" | "wait";

/**
 * Orchestrator受入判断の状態遷移入力を定義する。
 *
 * @responsibility exactな対象、判断および判断根拠の組を型境界として所有する。
 * @trace ARCH-000005
 * @shape 対象区分、対象ID、判断および根拠ID列を表す。
 * @invariant ObjectiveとMilestoneの対象IDを同じ入力で兼用しない。
 * @boundary N/A: 型宣言は外部境界を開かない。
 * @security N/A: Authority検証はApplication境界が所有し、本型は秘密値を保持しない。
 * @compatibility 利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorAcceptanceDecisionInput = Readonly<{
  target: OrchestratorAcceptanceTarget;
  targetId: string;
  decision: OrchestratorAcceptanceDecision;
  criterionEvidenceIds: readonly string[];
}>;

export const PROJECT_OBJECTIVE_STATES = Object.freeze([
  "planned",
  "executing",
  "integration_pending",
  "accepted",
  "returned",
  "blocked",
  "cancelled",
] as const);

export const PROJECT_TASK_STATES = Object.freeze([
  "planned",
  "waiting_dependency",
  "ready",
  "starting",
  "running",
  "cleanup_pending",
  "completed",
  "failed",
  "cancelled",
  "recovery_required",
  "superseded",
] as const);

/**
 * orchestrator-stateで使用するProject Objective Definitionの値契約を定義する。
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
 * orchestrator-stateで使用するProject Objective 記録の値契約を定義する。
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
 * orchestrator-stateで使用するProject Milestone 記録の値契約を定義する。
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

/**
 * orchestrator-stateで使用するProject Task Definitionの値契約を定義する。
 *
 * @responsibility Project Task DefinitionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskDefinitionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskDefinitionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskDefinitionの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskDefinitionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskDefinitionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskDefinition = Readonly<{
  id: string;
  objectiveId: string;
  dependencies: readonly string[];
  allowedPaths: readonly string[];
  conflictKeys: readonly string[];
}>;

/**
 * orchestrator-stateで使用するProject Task 回復 Kindの値契約を定義する。
 *
 * @responsibility Project Task 回復 KindのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskRecoveryKindが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskRecoveryKindで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskRecoveryKindの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskRecoveryKindはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskRecoveryKindの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskRecoveryKind =
  | "host"
  | "docker"
  | "candidate"
  | "candidate_store"
  | "runtime_process";

/**
 * orchestrator-stateで使用するProject Task 回復 Obligationの値契約を定義する。
 *
 * @responsibility Project Task 回復 ObligationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskRecoveryObligationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskRecoveryObligationで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskRecoveryObligationの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskRecoveryObligationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskRecoveryObligationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskRecoveryObligation = Readonly<{
  kind: ProjectTaskRecoveryKind;
  recoveryId: string;
  phase: "required" | "recovering" | "settled" | "acknowledged";
  acknowledgement?: ProjectDockerRecoveryAcknowledgement;
}>;

/**
 * orchestrator-stateで使用するProject Docker 回復 Acknowledgementの値契約を定義する。
 *
 * @responsibility Project Docker 回復 AcknowledgementのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectDockerRecoveryAcknowledgementが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectDockerRecoveryAcknowledgementで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectDockerRecoveryAcknowledgementの宣言は外部境界を開かない。
 * @security N/A: ProjectDockerRecoveryAcknowledgementはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectDockerRecoveryAcknowledgementの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectDockerRecoveryAcknowledgement = ProjectResultAcceptance;

/**
 * orchestrator-stateで使用するProject Task Start Phaseの値契約を定義する。
 *
 * @responsibility Project Task Start PhaseのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskStartPhaseが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskStartPhaseで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskStartPhaseの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskStartPhaseはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskStartPhaseの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskStartPhase =
  | "none"
  | "reserved"
  | "handoff_prepared"
  | "running"
  | "settled";

/**
 * orchestrator-stateで使用するProject Task 記録の値契約を定義する。
 *
 * @responsibility Project Task 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectTaskRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectTaskRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectTaskRecordの宣言は外部境界を開かない。
 * @security N/A: ProjectTaskRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectTaskRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectTaskRecord = Readonly<{
  definition: ProjectTaskDefinition;
  state: ProjectTaskState;
  attemptId: string | null;
  operationId: string | null;
  authorityBindingId: string | null;
  startPhase: ProjectTaskStartPhase;
  cleanupConfirmed: boolean;
  recoveryObligations: readonly ProjectTaskRecoveryObligation[];
  resultAcceptances: readonly ProjectResultAcceptance[];
  recoveryUnresolved: boolean;
  candidateId: string | null;
  retryCount: number;
  supersededBy: string | null;
}>;

/**
 * orchestrator-stateで使用するOrchestrator 状態の値契約を定義する。
 *
 * @responsibility Orchestrator 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorStateの宣言は外部境界を開かない。
 * @security N/A: OrchestratorStateはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorState = Readonly<{
  contract: typeof ORCHESTRATOR_STATE_CONTRACT;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  generation: number;
  ownerGeneration: string;
  decisionApplicationId: string | null;
  maximumConcurrency: number;
  milestone: ProjectMilestoneRecord;
  objectives: readonly ProjectObjectiveRecord[];
  tasks: readonly ProjectTaskRecord[];
}>;

/**
 * orchestrator-stateで使用する状態 結果の値契約を定義する。
 *
 * @responsibility 状態 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape StateResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StateResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: StateResultの宣言は外部境界を開かない。
 * @security N/A: StateResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility StateResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type StateResult =
  | Readonly<{
      status: "completed";
      reason: string;
      state: OrchestratorState;
      taskIds: readonly string[];
    }>
  | Readonly<{
      status: "blocked";
      reason: string;
      state: OrchestratorState | null;
      taskIds: readonly string[];
    }>;

/**
 * Identityが有効か判定する。
 *
 * @responsibility Identityの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns 共有Identityの形式が成立した場合だけ文字列へ型を絞る。
 * @precondition 「value: unknown」がvalidIdentityの入力契約を満たす。
 * @postcondition validIdentityの責務を完了した結果だけを返す。
 * @effect N/A: validIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdentityは独自の失敗分岐を所有しない。
 * @invariant validIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdentityは共有非同期状態を持たない同期処理である。
 */
export function validIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Revisionが有効か判定する。
 *
 * @responsibility Revisionの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns validRevisionの計算結果を返す。
 * @precondition 「value: unknown」がvalidRevisionの入力契約を満たす。
 * @postcondition validRevisionの責務を完了した結果だけを返す。
 * @effect N/A: validRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRevisionは独自の失敗分岐を所有しない。
 * @invariant validRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: validRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validRevisionは共有非同期状態を持たない同期処理である。
 */
function validRevision(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * Orchestrator 回復 Identityかを判定する。
 *
 * @responsibility Orchestrator 回復 Identityの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisOrchestratorRecoveryIdentityの入力契約を満たす。
 * @postcondition isOrchestratorRecoveryIdentityの責務を完了した結果だけを返す。
 * @effect N/A: isOrchestratorRecoveryIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isOrchestratorRecoveryIdentityは独自の失敗分岐を所有しない。
 * @invariant isOrchestratorRecoveryIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isOrchestratorRecoveryIdentityはProcess内の同一Subsystemで完結する。
 * @security N/A: isOrchestratorRecoveryIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isOrchestratorRecoveryIdentityは共有非同期状態を持たない同期処理である。
 */
export function isOrchestratorRecoveryIdentity(
  value: unknown,
): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Stringsを重複のない順序へ正規化する。
 *
 * @responsibility Stringsの重複判定、順序規則、結果集合境界を所有する。
 * @trace ARCH-000004
 * @input values: readonly string[]、maximum: number、kind: "identity_or_path" | "repository_path" | "human_text"
 * @returns readonly string[] | nullを返す。
 * @precondition 「values: readonly string[]、maximum: number、kind: "identity_or_path" | "repository_path" | "human_text"」がuniqueStringsの入力契約を満たす。
 * @postcondition uniqueStringsの責務を完了した結果だけを返す。
 * @effect N/A: uniqueStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: uniqueStringsは独自の失敗分岐を所有しない。
 * @invariant uniqueStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: uniqueStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: uniqueStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: uniqueStringsは共有非同期状態を持たない同期処理である。
 */
function uniqueStrings(
  values: readonly string[],
  maximum: number,
  kind: "identity_or_path" | "repository_path" | "human_text",
): readonly string[] | null {
  if (values.length > maximum) return null;
  const resultItems: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0 || value.length > 512)
      return null;
    const normalized =
      kind === "repository_path"
        ? normalizeRepositoryRelativePath(value)
        : kind === "identity_or_path"
          ? value.replaceAll("\\", "/")
          : value;
    if (normalized === null) return null;
    const key = kind === "human_text" ? normalized : normalized.toUpperCase();
    if (seen.has(key)) return null;
    seen.add(key);
    resultItems.push(normalized);
  }
  return Object.freeze(resultItems);
}

/**
 * Definitionを所有Snapshotへ変換する。
 *
 * @responsibility Definitionの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input definition: ProjectTaskDefinition
 * @returns ProjectTaskDefinition | nullを返す。
 * @precondition 「definition: ProjectTaskDefinition」がsnapshotDefinitionの入力契約を満たす。
 * @postcondition snapshotDefinitionの責務を完了した結果だけを返す。
 * @effect N/A: snapshotDefinitionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotDefinitionは独自の失敗分岐を所有しない。
 * @invariant snapshotDefinitionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotDefinitionはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotDefinitionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotDefinitionは共有非同期状態を持たない同期処理である。
 */
export function snapshotDefinition(
  definition: ProjectTaskDefinition,
): ProjectTaskDefinition | null {
  if (!validIdentity(definition.id) || !validIdentity(definition.objectiveId))
    return null;
  const dependencies = uniqueStrings(
    definition.dependencies,
    128,
    "identity_or_path",
  );
  const allowedPaths = uniqueStrings(
    definition.allowedPaths,
    128,
    "repository_path",
  );
  const conflictKeys = uniqueStrings(
    definition.conflictKeys,
    128,
    "identity_or_path",
  );
  if (
    !dependencies ||
    !allowedPaths ||
    !conflictKeys ||
    allowedPaths.length === 0
  )
    return null;
  return Object.freeze({
    id: definition.id,
    objectiveId: definition.objectiveId,
    dependencies,
    allowedPaths,
    conflictKeys,
  });
}

/**
 * Objective Definitionを所有Snapshotへ変換する。
 *
 * @responsibility Objective Definitionの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input definition: ProjectObjectiveDefinition
 * @returns ProjectObjectiveDefinition | nullを返す。
 * @precondition 「definition: ProjectObjectiveDefinition」がsnapshotObjectiveDefinitionの入力契約を満たす。
 * @postcondition snapshotObjectiveDefinitionの責務を完了した結果だけを返す。
 * @effect N/A: snapshotObjectiveDefinitionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotObjectiveDefinitionは独自の失敗分岐を所有しない。
 * @invariant snapshotObjectiveDefinitionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotObjectiveDefinitionはProcess内の同一Subsystemで完結する。
 * @security N/A: snapshotObjectiveDefinitionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: snapshotObjectiveDefinitionは共有非同期状態を持たない同期処理である。
 */
function snapshotObjectiveDefinition(
  definition: ProjectObjectiveDefinition,
): ProjectObjectiveDefinition | null {
  if (!validIdentity(definition.id)) return null;
  const acceptanceCriteria = uniqueStrings(
    definition.acceptanceCriteria,
    128,
    "human_text",
  );
  if (!acceptanceCriteria || acceptanceCriteria.length === 0) return null;
  return Object.freeze({ id: definition.id, acceptanceCriteria });
}

/**
 * Cycleが存在するかを判定する。
 *
 * @responsibility Cycleの存在条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input definitions: readonly ProjectTaskDefinition[]
 * @returns hasCycleの計算結果を返す。
 * @precondition 「definitions: readonly ProjectTaskDefinition[]」がhasCycleの入力契約を満たす。
 * @postcondition hasCycleの責務を完了した結果だけを返す。
 * @effect N/A: hasCycleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasCycleは独自の失敗分岐を所有しない。
 * @invariant hasCycleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hasCycleはProcess内の同一Subsystemで完結する。
 * @security N/A: hasCycleはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: hasCycleは共有非同期状態を持たない同期処理である。
 */
export function hasCycle(definitions: readonly ProjectTaskDefinition[]) {
  const dependencies = new Map(
    definitions.map((definition) => [definition.id, definition.dependencies]),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const dependency of dependencies.get(id) ?? []) {
      if (visit(dependency)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return definitions.some((definition) => visit(definition.id));
}

/**
 * 状態を公開結果へ投影する。
 *
 * @responsibility 状態の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input state: Omit<OrchestratorState, "contract">
 * @returns OrchestratorStateを返す。
 * @precondition 「state: Omit<OrchestratorState, "contract">」がprojectStateの入力契約を満たす。
 * @postcondition projectStateの責務を完了した結果だけを返す。
 * @effect N/A: projectStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectStateは独自の失敗分岐を所有しない。
 * @invariant projectStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectStateはProcess内の同一Subsystemで完結する。
 * @security N/A: projectStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectStateは共有非同期状態を持たない同期処理である。
 */
export function projectState(
  state: Omit<OrchestratorState, "contract">,
): OrchestratorState {
  return Object.freeze({
    contract: ORCHESTRATOR_STATE_CONTRACT,
    ...state,
    milestone: Object.freeze({ ...state.milestone }),
    objectives: Object.freeze([...state.objectives]),
    tasks: Object.freeze([...state.tasks]),
  });
}

/**
 * Orchestrator 状態を構築する。
 *
 * @responsibility Orchestrator 状態の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input input: Readonly<{ projectId: string; milestoneId: string; repositoryRevision: string; maximumConcurrency: number; milestoneAcceptanceCriteria: readonly string[]; objectives: readonly ProjectObjectiveDefinition[]; tasks: readonly ProjectTaskDefinition[]; ownerGeneration: string; }>
 * @returns StateResultを返す。
 * @precondition 「input: Readonly<{ projectId: string; milestoneId: string; repositoryRevision: string; maximumConcurrency: number; milestoneAcceptanceCriteria: readonly string[]; objectives: readonly ProjectObjectiveDefinition[]; tasks: readonly ProjectTaskDefinition[]; ownerGeneration: string; }>」がcreateOrchestratorStateの入力契約を満たす。
 * @postcondition createOrchestratorStateの責務を完了した結果だけを返す。
 * @effect N/A: createOrchestratorStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createOrchestratorStateは独自の失敗分岐を所有しない。
 * @invariant createOrchestratorStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createOrchestratorStateはProcess内の同一Subsystemで完結する。
 * @security N/A: createOrchestratorStateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createOrchestratorStateは共有非同期状態を持たない同期処理である。
 */
export function createOrchestratorState(
  input: Readonly<{
    projectId: string;
    milestoneId: string;
    repositoryRevision: string;
    maximumConcurrency: number;
    milestoneAcceptanceCriteria: readonly string[];
    objectives: readonly ProjectObjectiveDefinition[];
    tasks: readonly ProjectTaskDefinition[];
    ownerGeneration: string;
  }>,
): StateResult {
  if (
    !validIdentity(input.projectId) ||
    !validIdentity(input.milestoneId) ||
    !validIdentity(input.ownerGeneration) ||
    !validRevision(input.repositoryRevision) ||
    !Number.isSafeInteger(input.maximumConcurrency) ||
    input.maximumConcurrency < 1 ||
    input.maximumConcurrency > ORCHESTRATOR_MAXIMUM_CONCURRENCY ||
    input.tasks.length === 0 ||
    input.tasks.length > ORCHESTRATOR_MAXIMUM_TASKS ||
    input.objectives.length === 0 ||
    input.objectives.length > ORCHESTRATOR_MAXIMUM_OBJECTIVES
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_input_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const definitions = input.tasks.map(snapshotDefinition);
  const objectiveDefinitions = input.objectives.map(
    snapshotObjectiveDefinition,
  );
  const milestoneAcceptanceCriteria = uniqueStrings(
    input.milestoneAcceptanceCriteria,
    128,
    "human_text",
  );
  if (definitions.some((definition) => !definition)) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_definition_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  if (
    objectiveDefinitions.some((definition) => !definition) ||
    !milestoneAcceptanceCriteria ||
    milestoneAcceptanceCriteria.length === 0
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_acceptance_definition_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const completeDefinitions = definitions as readonly ProjectTaskDefinition[];
  const completeObjectiveDefinitions =
    objectiveDefinitions as readonly ProjectObjectiveDefinition[];
  const ids = new Set(completeDefinitions.map((definition) => definition.id));
  const objectiveIds = new Set(
    completeObjectiveDefinitions.map((definition) => definition.id),
  );
  if (
    ids.size !== completeDefinitions.length ||
    objectiveIds.size !== completeObjectiveDefinitions.length ||
    completeDefinitions.some(
      (definition) => !objectiveIds.has(definition.objectiveId),
    ) ||
    completeObjectiveDefinitions.some(
      (objective) =>
        !completeDefinitions.some(
          (definition) => definition.objectiveId === objective.id,
        ),
    ) ||
    completeDefinitions.some(
      (definition) =>
        definition.dependencies.includes(definition.id) ||
        definition.dependencies.some((dependency) => !ids.has(dependency)),
    ) ||
    hasCycle(completeDefinitions)
  ) {
    return Object.freeze({
      status: "blocked",
      reason: "orchestrator_task_graph_invalid",
      state: null,
      taskIds: Object.freeze([]),
    });
  }
  const tasks = completeDefinitions.map((definition) =>
    Object.freeze({
      definition,
      state:
        definition.dependencies.length === 0
          ? ("ready" as const)
          : ("waiting_dependency" as const),
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      startPhase: "none" as const,
      cleanupConfirmed: false,
      recoveryObligations: Object.freeze([]),
      resultAcceptances: Object.freeze([]),
      recoveryUnresolved: false,
      candidateId: null,
      retryCount: 0,
      supersededBy: null,
    }),
  );
  const state = projectState({
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    repositoryRevision: input.repositoryRevision,
    generation: 1,
    ownerGeneration: input.ownerGeneration,
    decisionApplicationId: null,
    maximumConcurrency: input.maximumConcurrency,
    milestone: Object.freeze({
      id: input.milestoneId,
      acceptanceCriteria: milestoneAcceptanceCriteria,
      state: "planned" as const,
      criterionEvidenceIds: Object.freeze([]),
    }),
    objectives: completeObjectiveDefinitions.map((definition) =>
      Object.freeze({
        definition,
        state: "planned" as const,
        criterionEvidenceIds: Object.freeze([]),
      }),
    ),
    tasks,
  });
  return Object.freeze({
    status: "completed",
    reason: "orchestrator_state_created",
    state,
    taskIds: Object.freeze(tasks.map((task) => task.definition.id)),
  });
}

/**
 * replace Taskを決定する。
 *
 * @responsibility replace Taskの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: OrchestratorState、taskId: string、update: (task: ProjectTaskRecord) => ProjectTaskRecord
 * @returns replaceTaskの計算結果を返す。
 * @precondition 「state: OrchestratorState、taskId: string、update: (task: ProjectTaskRecord) => ProjectTaskRecord」がreplaceTaskの入力契約を満たす。
 * @postcondition replaceTaskの責務を完了した結果だけを返す。
 * @effect N/A: replaceTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: replaceTaskは独自の失敗分岐を所有しない。
 * @invariant replaceTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: replaceTaskはProcess内の同一Subsystemで完結する。
 * @security N/A: replaceTaskはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: replaceTaskは共有非同期状態を持たない同期処理である。
 */
export function replaceTask(
  state: OrchestratorState,
  taskId: string,
  update: (task: ProjectTaskRecord) => ProjectTaskRecord,
) {
  return state.tasks.map((task) =>
    task.definition.id === taskId ? update(task) : task,
  );
}

/**
 * Orchestrator 状態 契約の公開契約を記述する。
 *
 * @responsibility Orchestrator 状態 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeOrchestratorStateContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeOrchestratorStateContractの入力契約を満たす。
 * @postcondition describeOrchestratorStateContractの責務を完了した結果だけを返す。
 * @effect N/A: describeOrchestratorStateContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeOrchestratorStateContractは独自の失敗分岐を所有しない。
 * @invariant describeOrchestratorStateContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeOrchestratorStateContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeOrchestratorStateContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeOrchestratorStateContractは共有非同期状態を持たない同期処理である。
 */
export function describeOrchestratorStateContract() {
  return Object.freeze({
    contract: ORCHESTRATOR_STATE_CONTRACT,
    maximumConcurrency: ORCHESTRATOR_MAXIMUM_CONCURRENCY,
    capacityStates: Object.freeze([
      "starting",
      "running",
      "cleanup_pending",
      "recovery_required_without_cleanup",
    ]),
    lockContract:
      "project_operation_then_short_project_state_transaction_never_held_across_single_task_runtime",
    staleResult:
      "generation_attempt_and_operation_identity_mismatch_blocks_without_projection",
    acceptanceContract:
      "task_completion_then_objective_integration_then_milestone_integration",
  });
}

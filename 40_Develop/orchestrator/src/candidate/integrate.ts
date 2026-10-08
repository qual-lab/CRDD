/**
 * orchestrator-integrationに属する責務をまとめる。
 *
 * @responsibility IntegrationInputを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import {
  requestOrchestratorHumanDecision,
  type OrchestratorState,
} from "../state/transitions.ts";
import type {
  OrchestratorCandidatePort,
  OrchestratorIntegrationCandidate,
} from "./operations.ts";
import type { OrchestratorIntegrationRecordPort } from "./record-writer.ts";
import type { OrchestratorPersistencePorts } from "../state/persistence.ts";
import { ORCHESTRATOR_INTEGRATION_CONTRACT } from "./integration-result.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../input/plain-data-snapshot.ts";
import {
  normalizeRepositoryRelativePath,
  repositoryPathWithin,
} from "../input/repository-relative-path.ts";
import { adoptOrchestratorExistingCandidate } from "./adopt.ts";

/**
 * orchestrator-integrationで使用するIntegration 入力の値契約を定義する。
 *
 * @responsibility Integration 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape IntegrationInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant IntegrationInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: IntegrationInputの宣言は外部境界を開かない。
 * @security N/A: IntegrationInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility IntegrationInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type IntegrationInput = Readonly<{
  projectId: string;
  milestoneId: string;
  queueId: string;
  taskCandidateIds?: readonly string[];
  allowedPaths: readonly string[];
  adoptionAuthorized: boolean;
}>;

/**
 * orchestrator-integrationで使用するIntegration Dependenciesの値契約を定義する。
 *
 * @responsibility Integration DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape IntegrationDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant IntegrationDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: IntegrationDependenciesの宣言は外部境界を開かない。
 * @security N/A: IntegrationDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility IntegrationDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type IntegrationDependencies = Readonly<{
  candidate: OrchestratorCandidatePort;
  records: OrchestratorIntegrationRecordPort;
  persistence: OrchestratorPersistencePorts;
}>;

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum
 * @returns value is stringを返す。
 * @precondition 「value: unknown、maximum」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown, maximum = 512): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Hashが有効か判定する。
 *
 * @responsibility Hashの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidHashの入力契約を満たす。
 * @postcondition validHashの責務を完了した結果だけを返す。
 * @effect N/A: validHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validHashは独自の失敗分岐を所有しない。
 * @invariant validHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validHashはProcess内の同一Subsystemで完結する。
 * @security N/A: validHashはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validHashは共有非同期状態を持たない同期処理である。
 */
function validHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

/**
 * Pathが有効か判定する。
 *
 * @responsibility Pathの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidPathの入力契約を満たす。
 * @postcondition validPathの責務を完了した結果だけを返す。
 * @effect N/A: validPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validPathは独自の失敗分岐を所有しない。
 * @invariant validPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validPathはProcess内の同一Subsystemで完結する。
 * @security N/A: validPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validPathは共有非同期状態を持たない同期処理である。
 */
function validPath(value: unknown): value is string {
  return normalizeRepositoryRelativePath(value) !== null;
}

/**
 * string Arrayを決定する。
 *
 * @responsibility string Arrayの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、validator
 * @returns stringArrayの計算結果を返す。
 * @precondition 「value: unknown、validator」がstringArrayの入力契約を満たす。
 * @postcondition stringArrayの責務を完了した結果だけを返す。
 * @effect N/A: stringArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stringArrayは独自の失敗分岐を所有しない。
 * @invariant stringArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stringArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: stringArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stringArrayは共有非同期状態を持たない同期処理である。
 */
function stringArray(value: unknown, validator = validId) {
  const snapshot = snapshotPlainArray(value, 1024);
  return snapshot.status === "ok" &&
    snapshot.value.every((entry) => validator(entry))
    ? Object.freeze([...(snapshot.value as readonly string[])])
    : null;
}

/**
 * 候補を観測する。
 *
 * @responsibility 候補の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、state: OrchestratorState
 * @returns OrchestratorIntegrationCandidate | nullを返す。
 * @precondition 「raw: unknown、state: OrchestratorState」がinspectCandidateの入力契約を満たす。
 * @postcondition inspectCandidateの責務を完了した結果だけを返す。
 * @effect N/A: inspectCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCandidateは独自の失敗分岐を所有しない。
 * @invariant inspectCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCandidateはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCandidateはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCandidateは共有非同期状態を持たない同期処理である。
 */
function inspectCandidate(
  raw: unknown,
  state: OrchestratorState,
): OrchestratorIntegrationCandidate | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "candidateId",
      "candidateHash",
      "baseRevision",
      "changedPaths",
      "objectiveEvidence",
      "milestoneEvidence",
      "conflicts",
      "cleanupConfirmed",
    ] as const),
  );
  if (
    value?.status !== "candidate" ||
    !validId(value.candidateId) ||
    !validHash(value.candidateHash) ||
    value.baseRevision !== state.repositoryRevision ||
    value.cleanupConfirmed !== true
  )
    return null;
  const changedPaths = stringArray(value.changedPaths, validPath);
  const conflicts = stringArray(value.conflicts, validId);
  const milestoneEvidence = stringArray(value.milestoneEvidence, validId);
  const objectiveIds = state.objectives.map(
    (objective) => objective.definition.id,
  );
  const rawObjectiveEvidence = snapshotPlainRecord(
    value.objectiveEvidence,
    new Set(objectiveIds),
  );
  if (
    !changedPaths ||
    !conflicts ||
    !milestoneEvidence ||
    !rawObjectiveEvidence
  )
    return null;
  const objectiveEvidence: Record<string, readonly string[]> = {};
  for (const objective of state.objectives) {
    const evidence = stringArray(
      rawObjectiveEvidence[objective.definition.id],
      validId,
    );
    if (!evidence) return null;
    objectiveEvidence[objective.definition.id] = evidence;
  }
  return Object.freeze({
    status: "candidate",
    candidateId: value.candidateId,
    candidateHash: value.candidateHash,
    baseRevision: value.baseRevision,
    changedPaths,
    objectiveEvidence: Object.freeze(objectiveEvidence),
    milestoneEvidence,
    conflicts,
    cleanupConfirmed: true,
  });
}

/**
 * path Within Allowedを決定する。
 *
 * @responsibility path Within Allowedの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input candidate: string、allowedPaths: readonly string[]
 * @returns pathWithinAllowedの計算結果を返す。
 * @precondition 「candidate: string、allowedPaths: readonly string[]」がpathWithinAllowedの入力契約を満たす。
 * @postcondition pathWithinAllowedの責務を完了した結果だけを返す。
 * @effect N/A: pathWithinAllowedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: pathWithinAllowedは独自の失敗分岐を所有しない。
 * @invariant pathWithinAllowedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: pathWithinAllowedはProcess内の同一Subsystemで完結する。
 * @security N/A: pathWithinAllowedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: pathWithinAllowedは共有非同期状態を持たない同期処理である。
 */
function pathWithinAllowed(candidate: string, allowedPaths: readonly string[]) {
  return repositoryPathWithin(candidate, allowedPaths);
}

/**
 * responseを決定する。
 *
 * @responsibility responseの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input input: IntegrationInput、status: "completed" | "blocked"、reason: string、state: OrchestratorState | null、options: Readonly<{ candidateId?: string | null; receiptId?: string | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; recoveryIds?: readonly string[]; effectIssued?: boolean; effectStateUnknown?: boolean; retryAllowed?: boolean; }>
 * @returns responseの計算結果を返す。
 * @precondition 「input: IntegrationInput、status: "completed" | "blocked"、reason: string、state: OrchestratorState | null、options: Readonly<{ candidateId?: string | null; receiptId?: string | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; recoveryIds?: readonly string[]; effectIssued?: boolean; effectStateUnknown?: boolean; retryAllowed?: boolean; }>」がresponseの入力契約を満たす。
 * @postcondition responseの責務を完了した結果だけを返す。
 * @effect N/A: responseは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: responseは独自の失敗分岐を所有しない。
 * @invariant responseは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: responseはProcess内の同一Subsystemで完結する。
 * @security N/A: responseはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: responseは共有非同期状態を持たない同期処理である。
 */
function response(
  input: IntegrationInput,
  status: "completed" | "blocked",
  reason: string,
  state: OrchestratorState | null,
  options: Readonly<{
    candidateId?: string | null;
    receiptId?: string | null;
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    recoveryIds?: readonly string[];
    effectIssued?: boolean;
    effectStateUnknown?: boolean;
    retryAllowed?: boolean;
  }> = {},
) {
  return Object.freeze({
    contract: ORCHESTRATOR_INTEGRATION_CONTRACT,
    status,
    reason,
    projectId: input.projectId,
    milestoneId: input.milestoneId,
    queueId: input.queueId,
    stateGeneration: state?.generation ?? null,
    candidateId: options.candidateId ?? null,
    receiptId: options.receiptId ?? null,
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    recoveryIds: Object.freeze([...(options.recoveryIds ?? [])]),
    ...(options.effectIssued === undefined
      ? {}
      : {
          effectIssued: options.effectIssued,
          effectStateUnknown: options.effectStateUnknown ?? false,
          retryAllowed: options.retryAllowed ?? false,
        }),
  });
}

/**
 * Integrate terminal Task candidates and, when explicitly authorized, adopt
 *
 * @responsibility orchestrator-integrationの入力からintegrate Orchestrator Operationを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: IntegrationDependencies、input: IntegrationInput
 * @returns integrateOrchestratorOperationの計算結果を返す。
 * @precondition 「dependencies: IntegrationDependencies、input: IntegrationInput」がintegrateOrchestratorOperationの入力契約を満たす。
 * @postcondition integrateOrchestratorOperationの責務を完了した結果だけを返す。
 * @effect N/A: integrateOrchestratorOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure integrateOrchestratorOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant integrateOrchestratorOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: integrateOrchestratorOperationはProcess内の同一Subsystemで完結する。
 * @security N/A: integrateOrchestratorOperationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency integrateOrchestratorOperationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function integrateOrchestratorOperation(
  dependencies: IntegrationDependencies,
  input: IntegrationInput,
) {
  const stateRead = dependencies.persistence.state.readState(input.projectId);
  const queueRead = dependencies.persistence.state.readQueue(input.queueId);
  if (
    stateRead.status !== "completed" ||
    stateRead.value === null ||
    queueRead.status !== "completed"
  )
    return response(
      input,
      "blocked",
      "orchestrator_integration_observation_unknown",
      null,
      {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      },
    );
  let state = stateRead.value;
  const queue = queueRead.value;
  const activeTasks = state.tasks.filter((task) => task.state !== "superseded");
  const persistedCandidateIds = activeTasks.map((task) => task.candidateId);
  const taskCandidateIds = input.taskCandidateIds ?? persistedCandidateIds;
  if (
    state.milestoneId !== input.milestoneId ||
    queue.projectId !== input.projectId ||
    queue.milestoneId !== input.milestoneId ||
    queue.state !== "integration_pending" ||
    queue.ownerGeneration !== null ||
    !activeTasks.every(
      (task) => task.state === "completed" && task.cleanupConfirmed,
    ) ||
    taskCandidateIds.length !== activeTasks.length ||
    new Set(taskCandidateIds).size !== taskCandidateIds.length ||
    !taskCandidateIds.every((id) => validId(id)) ||
    !taskCandidateIds.every(
      (id, index) => id === persistedCandidateIds[index],
    ) ||
    !input.allowedPaths.every(validPath)
  )
    return response(
      input,
      "blocked",
      "orchestrator_integration_precondition_failed",
      state,
    );

  let rawCandidate: unknown;
  try {
    rawCandidate = await dependencies.candidate.createCandidate({
      state,
      taskCandidateIds: Object.freeze([
        ...(taskCandidateIds as readonly string[]),
      ]),
    });
  } catch {
    rawCandidate = null;
  }
  const candidate = inspectCandidate(rawCandidate, state);
  if (!candidate)
    return response(
      input,
      "blocked",
      "orchestrator_integration_candidate_invalid",
      state,
      {
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      },
    );
  try {
    const recorded = dependencies.records.write({
      kind: "integration",
      identity: candidate.candidateId,
      value: candidate,
    });
    if (recorded.status !== "completed") throw new Error(recorded.reason);
  } catch {
    return response(
      input,
      "blocked",
      "orchestrator_integration_record_unknown",
      state,
      {
        candidateId: candidate.candidateId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      },
    );
  }
  if (
    candidate.conflicts.length > 0 ||
    candidate.changedPaths.some(
      (changedPath) => !pathWithinAllowed(changedPath, input.allowedPaths),
    )
  ) {
    const objective = state.objectives.find(
      (entry) => entry.state === "integration_pending",
    );
    if (objective) {
      const decision = requestOrchestratorHumanDecision(
        state,
        state.generation,
        objective.definition.id,
      );
      if (decision.status === "completed") {
        const written = dependencies.persistence.state.writeState(
          decision.state,
          state.generation,
        );
        if (written.status === "completed") state = decision.state;
      }
    }
    const decisionQueue = dependencies.persistence.state.updateQueue(
      input.queueId,
      queue.generation,
      {
        state: "human_decision_required",
        lease: null,
        resumeCondition: "integration_conflict",
        resultReference: candidate.candidateId,
      },
    );
    if (decisionQueue.status !== "completed")
      return response(input, "blocked", decisionQueue.reason, state, {
        candidateId: candidate.candidateId,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      });
    return response(
      input,
      "blocked",
      "orchestrator_integration_conflict",
      state,
      {
        candidateId: candidate.candidateId,
      },
    );
  }

  let receiptId: string | null = null;
  if (input.adoptionAuthorized) {
    const adoption = await adoptOrchestratorExistingCandidate(
      Object.freeze({
        candidate: dependencies.candidate,
        lease: dependencies.persistence.lease,
        records: dependencies.records,
      }),
      Object.freeze({
        projectId: input.projectId,
        candidate: Object.freeze({
          candidateId: candidate.candidateId,
          candidateHash: candidate.candidateHash,
          baseRevision: candidate.baseRevision,
          changedPaths: candidate.changedPaths,
        }),
        allowedPaths: input.allowedPaths,
        adoptionAuthorized: true,
      }),
    );
    if (adoption.status !== "completed")
      return response(input, "blocked", adoption.reason, state, {
        candidateId: candidate.candidateId,
        receiptId: adoption.receiptId,
        cleanupConfirmed: adoption.cleanupConfirmed,
        manualRecoveryRequired: adoption.manualRecoveryRequired,
        effectIssued: adoption.effectIssued,
        effectStateUnknown: adoption.effectStateUnknown,
        retryAllowed: adoption.retryAllowed,
        recoveryIds: adoption.recoveryIds,
      });
    receiptId = adoption.receiptId;
  }

  const completedQueue = dependencies.persistence.state.updateQueue(
    input.queueId,
    queue.generation,
    {
      state: "completed",
      lease: null,
      resumeCondition: null,
      resultReference: receiptId ?? candidate.candidateId,
    },
  );
  if (completedQueue.status !== "completed")
    return response(input, "blocked", completedQueue.reason, state, {
      candidateId: candidate.candidateId,
      receiptId,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
  return response(
    input,
    "completed",
    "orchestrator_acceptance_decision_required",
    state,
    {
      candidateId: candidate.candidateId,
      receiptId,
    },
  );
}

/**
 * Orchestrator Integration 契約の公開契約を記述する。
 *
 * @responsibility Orchestrator Integration 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeOrchestratorIntegrationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeOrchestratorIntegrationContractの入力契約を満たす。
 * @postcondition describeOrchestratorIntegrationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeOrchestratorIntegrationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeOrchestratorIntegrationContractは独自の失敗分岐を所有しない。
 * @invariant describeOrchestratorIntegrationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeOrchestratorIntegrationContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeOrchestratorIntegrationContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeOrchestratorIntegrationContractは共有非同期状態を持たない同期処理である。
 */
export function describeOrchestratorIntegrationContract() {
  return Object.freeze({
    contract: ORCHESTRATOR_INTEGRATION_CONTRACT,
    taskPassImpliesAcceptance: false,
    candidateAndAdoptionEffectsSeparated: true,
    canonicalAdoptionRequiresFreshRevisionAndScope: true,
    immutableIntegrationAndAdoptionRecords: true,
  });
}

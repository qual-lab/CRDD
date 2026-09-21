import {
  recordMilestoneIntegration,
  recordObjectiveIntegration,
  requestProjectRuntimeHumanDecision,
  type ProjectRuntimeState,
} from "../core/project-runtime-state.ts";
import type {
  ProjectRuntimeCandidateAdoptionReceipt,
  ProjectRuntimeCandidatePort,
  ProjectRuntimeIntegrationCandidate,
} from "../ports/candidate-port.ts";
import type { ProjectRuntimeIntegrationRecordPort } from "../ports/integration-record-port.ts";
import type { ProjectRuntimePersistencePorts } from "../ports/state-port.ts";
import { PROJECT_RUNTIME_INTEGRATION_CONTRACT } from "../public-contract/integration-result.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";
import {
  normalizeRepositoryRelativePath,
  repositoryPathWithin,
} from "../boundary/repository-relative-path.ts";

/**
 * IntegrationInputが扱う値の構造を表す。
 *
 * @responsibility IntegrationInputに必要な値と制約を一つの型契約として保持する。
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
 * IntegrationDependenciesが扱う値の構造を表す。
 *
 * @responsibility IntegrationDependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape IntegrationDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant IntegrationDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: IntegrationDependenciesの宣言は外部境界を開かない。
 * @security N/A: IntegrationDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility IntegrationDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type IntegrationDependencies = Readonly<{
  candidate: ProjectRuntimeCandidatePort;
  records: ProjectRuntimeIntegrationRecordPort;
  persistence: ProjectRuntimePersistencePorts;
}>;

/**
 * validIdの処理を実行する。
 *
 * @responsibility validIdに対応する入力処理と結果生成を所有する。
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
 * validRevisionの処理を実行する。
 *
 * @responsibility validRevisionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidRevisionの入力契約を満たす。
 * @postcondition validRevisionの責務を完了した結果だけを返す。
 * @effect N/A: validRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRevisionは独自の失敗分岐を所有しない。
 * @invariant validRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: validRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validRevisionは共有非同期状態を持たない同期処理である。
 */
function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * validHashの処理を実行する。
 *
 * @responsibility validHashに対応する入力処理と結果生成を所有する。
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
 * validPathの処理を実行する。
 *
 * @responsibility validPathに対応する入力処理と結果生成を所有する。
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
 * stringArrayの処理を実行する。
 *
 * @responsibility stringArrayに対応する入力処理と結果生成を所有する。
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
 * inspectCandidateの処理を実行する。
 *
 * @responsibility inspectCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、state: ProjectRuntimeState
 * @returns ProjectRuntimeIntegrationCandidate | nullを返す。
 * @precondition 「raw: unknown、state: ProjectRuntimeState」がinspectCandidateの入力契約を満たす。
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
  state: ProjectRuntimeState,
): ProjectRuntimeIntegrationCandidate | null {
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
 * inspectRepositoryの処理を実行する。
 *
 * @responsibility inspectRepositoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns inspectRepositoryの計算結果を返す。
 * @precondition 「raw: unknown」がinspectRepositoryの入力契約を満たす。
 * @postcondition inspectRepositoryの責務を完了した結果だけを返す。
 * @effect N/A: inspectRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRepositoryは独自の失敗分岐を所有しない。
 * @invariant inspectRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRepositoryはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectRepositoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRepositoryは共有非同期状態を持たない同期処理である。
 */
function inspectRepository(raw: unknown) {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "repositoryRevision",
      "dirty",
      "observedPaths",
    ] as const),
  );
  if (
    value?.status !== "observed" ||
    !validRevision(value.repositoryRevision) ||
    typeof value.dirty !== "boolean"
  )
    return null;
  const observedPaths = stringArray(value.observedPaths, validPath);
  return observedPaths
    ? Object.freeze({
        repositoryRevision: value.repositoryRevision,
        dirty: value.dirty,
        observedPaths,
      })
    : null;
}

/**
 * inspectCandidatePortBlockedの処理を実行する。
 *
 * @responsibility inspectCandidatePortBlockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns inspectCandidatePortBlockedの計算結果を返す。
 * @precondition 「raw: unknown」がinspectCandidatePortBlockedの入力契約を満たす。
 * @postcondition inspectCandidatePortBlockedの責務を完了した結果だけを返す。
 * @effect N/A: inspectCandidatePortBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCandidatePortBlockedは独自の失敗分岐を所有しない。
 * @invariant inspectCandidatePortBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCandidatePortBlockedはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectCandidatePortBlockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectCandidatePortBlockedは共有非同期状態を持たない同期処理である。
 */
function inspectCandidatePortBlocked(raw: unknown) {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "reason",
      "effectIssued",
      "effectStateUnknown",
      "cleanupConfirmed",
      "retryAllowed",
      "recoveryReference",
    ] as const),
  );
  if (
    value?.status !== "blocked" ||
    typeof value.reason !== "string" ||
    typeof value.effectIssued !== "boolean" ||
    typeof value.effectStateUnknown !== "boolean" ||
    typeof value.cleanupConfirmed !== "boolean" ||
    typeof value.retryAllowed !== "boolean" ||
    (value.recoveryReference !== null &&
      typeof value.recoveryReference !== "string")
  )
    return null;
  return Object.freeze({
    reason: value.reason,
    effectIssued: value.effectIssued,
    effectStateUnknown: value.effectStateUnknown,
    cleanupConfirmed: value.cleanupConfirmed,
    retryAllowed: value.retryAllowed,
    recoveryReference: value.recoveryReference as string | null,
  });
}

/**
 * inspectReceiptの処理を実行する。
 *
 * @responsibility inspectReceiptに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns ProjectRuntimeCandidateAdoptionReceipt | nullを返す。
 * @precondition 「raw: unknown」がinspectReceiptの入力契約を満たす。
 * @postcondition inspectReceiptの責務を完了した結果だけを返す。
 * @effect N/A: inspectReceiptは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectReceiptは独自の失敗分岐を所有しない。
 * @invariant inspectReceiptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectReceiptはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectReceiptはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectReceiptは共有非同期状態を持たない同期処理である。
 */
function inspectReceipt(
  raw: unknown,
): ProjectRuntimeCandidateAdoptionReceipt | null {
  const value = snapshotPlainRecord(
    raw,
    new Set([
      "status",
      "receiptId",
      "beforeRevision",
      "afterRevision",
      "changedPaths",
      "cleanupConfirmed",
    ] as const),
  );
  if (
    value?.status !== "completed" ||
    !validId(value.receiptId) ||
    !validRevision(value.beforeRevision) ||
    !validRevision(value.afterRevision) ||
    value.cleanupConfirmed !== true
  )
    return null;
  const changedPaths = stringArray(value.changedPaths, validPath);
  return changedPaths
    ? Object.freeze({
        status: "completed",
        receiptId: value.receiptId,
        beforeRevision: value.beforeRevision,
        afterRevision: value.afterRevision,
        changedPaths,
        cleanupConfirmed: true,
      })
    : null;
}

/**
 * pathWithinAllowedの処理を実行する。
 *
 * @responsibility pathWithinAllowedに対応する入力処理と結果生成を所有する。
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
 * responseの処理を実行する。
 *
 * @responsibility responseに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input input: IntegrationInput、status: "completed" | "blocked"、reason: string、state: ProjectRuntimeState | null、options: Readonly<{ candidateId?: string | null; receiptId?: string | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; recoveryIds?: readonly string[]; effectIssued?: boolean; effectStateUnknown?: boolean; retryAllowed?: boolean; }>
 * @returns responseの計算結果を返す。
 * @precondition 「input: IntegrationInput、status: "completed" | "blocked"、reason: string、state: ProjectRuntimeState | null、options: Readonly<{ candidateId?: string | null; receiptId?: string | null; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; recoveryIds?: readonly string[]; effectIssued?: boolean; effectStateUnknown?: boolean; retryAllowed?: boolean; }>」がresponseの入力契約を満たす。
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
  state: ProjectRuntimeState | null,
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
    contract: PROJECT_RUNTIME_INTEGRATION_CONTRACT,
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
 * @responsibility integrateProjectRuntimeOperationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input dependencies: IntegrationDependencies、input: IntegrationInput
 * @returns integrateProjectRuntimeOperationの計算結果を返す。
 * @precondition 「dependencies: IntegrationDependencies、input: IntegrationInput」がintegrateProjectRuntimeOperationの入力契約を満たす。
 * @postcondition integrateProjectRuntimeOperationの責務を完了した結果だけを返す。
 * @effect N/A: integrateProjectRuntimeOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure integrateProjectRuntimeOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant integrateProjectRuntimeOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: integrateProjectRuntimeOperationはProcess内の同一Subsystemで完結する。
 * @security N/A: integrateProjectRuntimeOperationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency integrateProjectRuntimeOperationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function integrateProjectRuntimeOperation(
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
      "project_runtime_integration_observation_unknown",
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
      "project_runtime_integration_precondition_failed",
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
      "project_runtime_integration_candidate_invalid",
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
      "project_runtime_integration_record_unknown",
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
      const rejected = recordObjectiveIntegration(
        state,
        state.generation,
        objective.definition.id,
        {
          accepted: false,
          criterionEvidenceIds:
            candidate.objectiveEvidence[objective.definition.id] ?? [],
        },
      );
      if (rejected.status === "completed") {
        const written = dependencies.persistence.state.writeState(
          rejected.state,
          state.generation,
        );
        if (written.status === "completed") state = rejected.state;
      }
      const decision = requestProjectRuntimeHumanDecision(
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
      "project_runtime_integration_conflict",
      state,
      {
        candidateId: candidate.candidateId,
      },
    );
  }

  let receipt: ProjectRuntimeCandidateAdoptionReceipt | null = null;
  if (input.adoptionAuthorized) {
    if (typeof dependencies.candidate.observeLeaseOwner !== "function")
      return response(
        input,
        "blocked",
        "project_runtime_lease_owner_observation_unavailable",
        state,
        {
          candidateId: candidate.candidateId,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        },
      );
    const prepared = dependencies.persistence.lease.reconcileAdoptionOwnerLoss(
      input.projectId,
      dependencies.candidate.observeLeaseOwner,
    );
    if (prepared.status !== "completed")
      return response(input, "blocked", prepared.reason, state, {
        candidateId: candidate.candidateId,
        cleanupConfirmed: !prepared.manualRecoveryRequired,
        manualRecoveryRequired: prepared.manualRecoveryRequired,
        ...(prepared.recoveryId === null
          ? {}
          : { recoveryIds: Object.freeze([prepared.recoveryId]) }),
      });
    const leaseResult = dependencies.persistence.lease.acquire(
      input.projectId,
      "canonical",
      "canonical-adoption",
    );
    if (leaseResult.status !== "completed")
      return response(input, "blocked", leaseResult.reason, state, {
        candidateId: candidate.candidateId,
        cleanupConfirmed: false,
        manualRecoveryRequired: leaseResult.manualRecoveryRequired,
      });
    const lease = leaseResult.value;
    let adoptionFailure: Readonly<{
      reason: string;
      cleanupConfirmed: boolean;
      manualRecoveryRequired: boolean;
      recoveryReference?: string | null;
      effectIssued?: boolean;
      effectStateUnknown?: boolean;
      retryAllowed?: boolean;
    }> | null = null;
    try {
      const rawObservation =
        dependencies.candidate.observeCanonicalRepository();
      const observationBlocked = inspectCandidatePortBlocked(rawObservation);
      const observed = inspectRepository(rawObservation);
      if (observationBlocked) {
        adoptionFailure = Object.freeze({
          reason: observationBlocked.reason,
          cleanupConfirmed: observationBlocked.cleanupConfirmed,
          effectIssued: observationBlocked.effectIssued,
          effectStateUnknown: observationBlocked.effectStateUnknown,
          retryAllowed: observationBlocked.retryAllowed,
          manualRecoveryRequired:
            observationBlocked.effectStateUnknown ||
            !observationBlocked.cleanupConfirmed,
          recoveryReference: observationBlocked.recoveryReference,
        });
      } else if (
        !observed ||
        observed.repositoryRevision !== candidate.baseRevision ||
        observed.dirty ||
        observed.observedPaths.some(
          (observedPath) =>
            !pathWithinAllowed(observedPath, input.allowedPaths),
        )
      ) {
        adoptionFailure = Object.freeze({
          reason: "project_runtime_adoption_revision_or_scope_mismatch",
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
        });
      } else {
        let rawReceipt: unknown;
        try {
          rawReceipt = await dependencies.candidate.adoptCandidate(candidate);
        } catch {
          rawReceipt = null;
        }
        const adoptionBlocked = inspectCandidatePortBlocked(rawReceipt);
        receipt = inspectReceipt(rawReceipt);
        if (adoptionBlocked) {
          adoptionFailure = Object.freeze({
            reason: adoptionBlocked.reason,
            cleanupConfirmed: adoptionBlocked.cleanupConfirmed,
            effectIssued: adoptionBlocked.effectIssued,
            effectStateUnknown: adoptionBlocked.effectStateUnknown,
            retryAllowed: adoptionBlocked.retryAllowed,
            manualRecoveryRequired:
              adoptionBlocked.effectStateUnknown ||
              !adoptionBlocked.cleanupConfirmed,
            recoveryReference: adoptionBlocked.recoveryReference,
          });
          receipt = null;
        } else if (
          !receipt ||
          receipt.beforeRevision !== candidate.baseRevision ||
          receipt.changedPaths.length !== candidate.changedPaths.length ||
          !receipt.changedPaths.every((value) =>
            candidate.changedPaths.includes(value),
          )
        ) {
          adoptionFailure = Object.freeze({
            reason: "project_runtime_adoption_receipt_invalid",
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
          });
          receipt = null;
        } else {
          const recorded = dependencies.records.write({
            kind: "adoption",
            identity: receipt.receiptId,
            value: receipt,
          });
          if (recorded.status !== "completed") throw new Error(recorded.reason);
        }
      }
    } catch {
      adoptionFailure = Object.freeze({
        reason: "project_runtime_adoption_observation_unknown",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      });
    } finally {
      const released = lease.release();
      if (released.status !== "completed") {
        adoptionFailure = Object.freeze({
          reason: "project_runtime_adoption_lease_release_unknown",
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        });
        receipt = null;
      }
    }
    if (adoptionFailure)
      return response(input, "blocked", adoptionFailure.reason, state, {
        candidateId: candidate.candidateId,
        cleanupConfirmed: adoptionFailure.cleanupConfirmed,
        manualRecoveryRequired: adoptionFailure.manualRecoveryRequired,
        effectIssued: adoptionFailure.effectIssued ?? false,
        effectStateUnknown: adoptionFailure.effectStateUnknown ?? false,
        retryAllowed: adoptionFailure.retryAllowed ?? false,
        ...(adoptionFailure.recoveryReference
          ? { recoveryIds: Object.freeze([adoptionFailure.recoveryReference]) }
          : {}),
      });
  }

  for (const objective of state.objectives.filter(
    (entry) => entry.state === "integration_pending",
  )) {
    const integrated = recordObjectiveIntegration(
      state,
      state.generation,
      objective.definition.id,
      {
        accepted: true,
        criterionEvidenceIds:
          candidate.objectiveEvidence[objective.definition.id] ?? [],
      },
    );
    if (integrated.status !== "completed")
      return response(input, "blocked", integrated.reason, state, {
        candidateId: candidate.candidateId,
        receiptId: receipt?.receiptId ?? null,
      });
    const written = dependencies.persistence.state.writeState(
      integrated.state,
      state.generation,
    );
    if (written.status !== "completed")
      return response(input, "blocked", written.reason, state, {
        candidateId: candidate.candidateId,
        receiptId: receipt?.receiptId ?? null,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      });
    state = integrated.state;
  }
  const milestone =
    state.milestone.state === "accepted"
      ? Object.freeze({
          status: "completed" as const,
          reason: "project_runtime_milestone_already_accepted",
          state,
          taskIds: Object.freeze([]),
        })
      : recordMilestoneIntegration(
          state,
          state.generation,
          candidate.milestoneEvidence,
        );
  if (milestone.status !== "completed")
    return response(input, "blocked", milestone.reason, state, {
      candidateId: candidate.candidateId,
      receiptId: receipt?.receiptId ?? null,
    });
  if (milestone.state.generation !== state.generation) {
    const milestoneWrite = dependencies.persistence.state.writeState(
      milestone.state,
      state.generation,
    );
    if (milestoneWrite.status !== "completed")
      return response(input, "blocked", milestoneWrite.reason, state, {
        candidateId: candidate.candidateId,
        receiptId: receipt?.receiptId ?? null,
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      });
  }
  const completedQueue = dependencies.persistence.state.updateQueue(
    input.queueId,
    queue.generation,
    {
      state: "completed",
      lease: null,
      resumeCondition: null,
      resultReference: receipt?.receiptId ?? candidate.candidateId,
    },
  );
  if (completedQueue.status !== "completed")
    return response(input, "blocked", completedQueue.reason, milestone.state, {
      candidateId: candidate.candidateId,
      receiptId: receipt?.receiptId ?? null,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    });
  return response(
    input,
    "completed",
    "project_runtime_milestone_accepted",
    milestone.state,
    {
      candidateId: candidate.candidateId,
      receiptId: receipt?.receiptId ?? null,
    },
  );
}

/**
 * describeProjectRuntimeIntegrationContractの処理を実行する。
 *
 * @responsibility describeProjectRuntimeIntegrationContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProjectRuntimeIntegrationContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProjectRuntimeIntegrationContractの入力契約を満たす。
 * @postcondition describeProjectRuntimeIntegrationContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProjectRuntimeIntegrationContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProjectRuntimeIntegrationContractは独自の失敗分岐を所有しない。
 * @invariant describeProjectRuntimeIntegrationContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeProjectRuntimeIntegrationContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeProjectRuntimeIntegrationContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeProjectRuntimeIntegrationContractは共有非同期状態を持たない同期処理である。
 */
export function describeProjectRuntimeIntegrationContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_INTEGRATION_CONTRACT,
    taskPassImpliesAcceptance: false,
    candidateAndAdoptionEffectsSeparated: true,
    canonicalAdoptionRequiresFreshRevisionAndScope: true,
    immutableIntegrationAndAdoptionRecords: true,
  });
}

/**
 * Taskの実行順序と保存・結果受領・配送終了を所有する。
 * @responsibility Taskの実行順序と保存・結果受領・配送終了を所有する。
 * @trace ARCH-000004
 */

import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { types } from "node:util";
import type {
  ProjectExecutionState,
  ProjectTaskRecoveryKind,
} from "../../../execution-model/src/index.ts";
import {
  createRuntimeProcessRecoveryIdentity,
  getRuntimeProcessInstanceIdentity,
  inspectRuntimeProcessRecoveryIdentity,
  poisonRuntimeProcessAfterCleanupUnknown,
} from "../execution/process-safety-state.ts";
import type { CoordinatorClockIdentityPort } from "../state/persistence.ts";
import { inspectTaskStartCandidates } from "../state/projection.ts";
import {
  isCoordinatorRecoveryIdentity,
  validIdentity,
} from "../state/validation.ts";
import { inspectWorkspaceResult } from "../workspace/record.ts";

import type {
  CoordinatorExecutionDependencies,
  CoordinatorExecutionHostAdapterOptions,
  CoordinatorExecutionResult,
  CoordinatorProcessSafetyPort,
  CoordinatorRecoveryTransition,
  CoordinatorSingleTaskResult,
  CoordinatorTaskExecution,
  CoordinatorTaskRecoveryHostDependencies,
  CoordinatorTaskRecoveryPort,
  ExecutionInput,
} from "./types.ts";

export const COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT =
  "crdd-coordinator/orchestrator-single-task-adapter" as const;
export const COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION = 3;

export const COORDINATOR_EXECUTION_CONTRACT =
  "crdd-coordinator/orchestrator-execution/v1" as const;

/**
 * Single Task 結果が有効か判定する。
 *
 * @responsibility Single Task 結果の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、runtimeIssuedRecoveryIds: ReadonlyMap< string, Readonly<{ attemptId: string; operationId: string }> >
 * @returns value is CoordinatorSingleTaskResultを返す。
 * @precondition 「value: unknown、runtimeIssuedRecoveryIds: ReadonlyMap< string, Readonly<{ attemptId: string; operationId: string }> >」がvalidSingleTaskResultの入力契約を満たす。
 * @postcondition validSingleTaskResultの責務を完了した結果だけを返す。
 * @effect N/A: validSingleTaskResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validSingleTaskResultは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validSingleTaskResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 下位の単発結果と上位Task調停の相関検査境界。
 * @security 下位結果だけでRuntime回復の発行を認めず、呼出しOwnerが捕捉した参照・Attempt・Operationの相関を照合する。
 * @concurrency N/A: validSingleTaskResultは共有非同期状態を持たない同期処理である。
 */
export function validSingleTaskResult(
  value: unknown,
  runtimeIssuedRecoveryIds: ReadonlyMap<
    string,
    Readonly<{ attemptId: string; operationId: string }>
  >,
): value is CoordinatorSingleTaskResult {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      types.isProxy(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    )
      return false;
    const expectedValues = [
      "attemptId",
      "authorityBindingId",
      "candidateId",
      "cleanupConfirmed",
      "contract",
      "effectState",
      "manualRecoveryRequired",
      "operationId",
      "processRestartRequired",
      "reason",
      "recoveryIds",
      "repositoryRevision",
      "status",
    ].sort();
    const expectedActualValues = [
      ...expectedValues,
      ...(Object.hasOwn(value, "recoveryObligations")
        ? ["recoveryObligations"]
        : []),
      ...(Object.hasOwn(value, "executorProvider") ? ["executorProvider"] : []),
      ...(Object.hasOwn(value, "workspaceResult") ? ["workspaceResult"] : []),
    ].sort();
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== expectedActualValues.length ||
      keys.some((key) => typeof key !== "string") ||
      ![...(keys as string[])]
        .sort()
        .every((key, index) => key === expectedActualValues[index])
    )
      return false;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (
      expectedActualValues.some(
        (key) =>
          !descriptors[key] ||
          !("value" in descriptors[key]) ||
          descriptors[key].get !== undefined ||
          descriptors[key].set !== undefined,
      )
    )
      return false;
    const record = value as Record<string, unknown>;
    if (
      Object.hasOwn(record, "workspaceResult") &&
      inspectWorkspaceResult(record.workspaceResult) === null
    )
      return false;
    if (
      record.contract !== "crdd-coordinator/orchestrator-single-task-adapter" ||
      !validIdentity(record.attemptId) ||
      !validIdentity(record.operationId) ||
      !validIdentity(record.authorityBindingId) ||
      typeof record.repositoryRevision !== "string" ||
      !/^[0-9a-f]{40,64}$/u.test(record.repositoryRevision) ||
      !["completed", "blocked", "cancelled"].includes(String(record.status)) ||
      typeof record.reason !== "string" ||
      record.reason.length === 0 ||
      record.reason.length > 256 ||
      !["no_effect", "settled", "unknown"].includes(
        String(record.effectState),
      ) ||
      typeof record.cleanupConfirmed !== "boolean" ||
      typeof record.manualRecoveryRequired !== "boolean" ||
      typeof record.processRestartRequired !== "boolean" ||
      (record.candidateId !== null &&
        (typeof record.candidateId !== "string" ||
          record.candidateId.length > 512)) ||
      !Array.isArray(record.recoveryIds) ||
      types.isProxy(record.recoveryIds) ||
      Reflect.ownKeys(record.recoveryIds).some(
        (key) =>
          key !== "length" &&
          (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/u.test(key)),
      )
    )
      return false;
    if (
      record.executorProvider !== undefined &&
      record.executorProvider !== "codex" &&
      record.executorProvider !== "claude"
    )
      return false;
    for (let index = 0; index < record.recoveryIds.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(
        record.recoveryIds,
        String(index),
      );
      if (
        !descriptor ||
        !("value" in descriptor) ||
        !isCoordinatorRecoveryIdentity(descriptor.value)
      )
        return false;
    }
    const rawObligations = record.recoveryObligations;
    if (rawObligations !== undefined) {
      if (!Array.isArray(rawObligations) || types.isProxy(rawObligations))
        return false;
      const identities = new Set<string>();
      const ids = new Set<string>();
      for (let index = 0; index < rawObligations.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(
          rawObligations,
          String(index),
        );
        if (!descriptor || !("value" in descriptor)) return false;
        const entry = descriptor.value;
        if (
          !entry ||
          typeof entry !== "object" ||
          Array.isArray(entry) ||
          types.isProxy(entry) ||
          ![Object.prototype, null].includes(Object.getPrototypeOf(entry))
        )
          return false;
        const entryKeys = Reflect.ownKeys(entry).sort();
        if (
          entryKeys.length !== 2 ||
          entryKeys[0] !== "kind" ||
          entryKeys[1] !== "recoveryId"
        )
          return false;
        const kind = (entry as { kind?: unknown }).kind;
        const recoveryId = (entry as { recoveryId?: unknown }).recoveryId;
        if (
          ![
            "host",
            "docker",
            "candidate",
            "candidate_store",
            "runtime_process",
          ].includes(String(kind)) ||
          !isCoordinatorRecoveryIdentity(recoveryId) ||
          (kind === "runtime_process" &&
            (runtimeIssuedRecoveryIds.get(String(recoveryId))?.attemptId !==
              record.attemptId ||
              runtimeIssuedRecoveryIds.get(String(recoveryId))?.operationId !==
                record.operationId)) ||
          identities.has(`${kind}\0${recoveryId}`)
        )
          return false;
        identities.add(`${kind}\0${recoveryId}`);
        ids.add(recoveryId);
      }
      if (
        ids.size !== new Set(record.recoveryIds as string[]).size ||
        [...ids].some((id) => !(record.recoveryIds as string[]).includes(id))
      )
        return false;
    } else if (record.recoveryIds.length > 0) return false;
    const status = String(record.status);
    const effectState = String(record.effectState);
    const cleanupConfirmed = record.cleanupConfirmed === true;
    const manualRecoveryRequired = record.manualRecoveryRequired === true;
    const processRestartRequired = record.processRestartRequired === true;
    const recoveryCount = record.recoveryIds.length;
    if (
      (status === "completed" &&
        (effectState !== "settled" ||
          !cleanupConfirmed ||
          manualRecoveryRequired ||
          processRestartRequired ||
          recoveryCount !== 0)) ||
      (status === "cancelled" &&
        (!cleanupConfirmed ||
          manualRecoveryRequired ||
          processRestartRequired ||
          recoveryCount !== 0 ||
          (effectState !== "no_effect" && effectState !== "settled"))) ||
      (effectState === "unknown" &&
        (cleanupConfirmed || !manualRecoveryRequired)) ||
      (!cleanupConfirmed &&
        (effectState !== "unknown" || !manualRecoveryRequired)) ||
      (recoveryCount > 0 && !manualRecoveryRequired) ||
      (processRestartRequired && status !== "blocked")
    )
      return false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Idを安定Identityへ変換する。
 *
 * @responsibility Idの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: CoordinatorExecutionDependencies、prefix: string、parts: readonly string[]
 * @returns stableIdの計算結果を返す。
 * @precondition 「dependencies: CoordinatorExecutionDependencies、prefix: string、parts: readonly string[]」がstableIdの入力契約を満たす。
 * @postcondition stableIdの責務を完了した結果だけを返す。
 * @effect N/A: stableIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stableIdは独自の失敗分岐を所有しない。
 * @invariant stableIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stableIdはProcess内の同一Subsystemで完結する。
 * @security N/A: stableIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stableIdは共有非同期状態を持たない同期処理である。
 */
function stableId(
  dependencies: CoordinatorExecutionDependencies,
  prefix: string,
  ...parts: readonly string[]
) {
  return dependencies.clockIdentity.createStableId(prefix, parts);
}

/**
 * resultを決定する。
 *
 * @responsibility resultの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input input: ExecutionInput、fields: Omit< CoordinatorExecutionResult, | "contract" | "projectId" | "queueId" | "processRestartRequired" | "recoveryIds" | "recoveryObligations" > & Readonly<{ processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string; }>[]; }>
 * @returns CoordinatorExecutionResultを返す。
 * @precondition 「input: ExecutionInput、fields: Omit< CoordinatorExecutionResult, | "contract" | "projectId" | "queueId" | "processRestartRequired" | "recoveryIds" | "recoveryObligations" > & Readonly<{ processRestartRequired?: boolean; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string; }>[]; }>」がresultの入力契約を満たす。
 * @postcondition resultの責務を完了した結果だけを返す。
 * @effect N/A: resultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resultは独自の失敗分岐を所有しない。
 * @invariant resultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resultはProcess内の同一Subsystemで完結する。
 * @security N/A: resultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: resultは共有非同期状態を持たない同期処理である。
 */
function result(
  input: ExecutionInput,
  fields: Omit<
    CoordinatorExecutionResult,
    | "contract"
    | "projectId"
    | "queueId"
    | "processRestartRequired"
    | "recoveryIds"
    | "recoveryObligations"
  > &
    Readonly<{
      processRestartRequired?: boolean;
      recoveryIds?: readonly string[];
      recoveryObligations?: readonly Readonly<{
        kind: ProjectTaskRecoveryKind;
        recoveryId: string;
      }>[];
    }>,
): CoordinatorExecutionResult {
  return Object.freeze({
    contract: COORDINATOR_EXECUTION_CONTRACT,
    projectId: input.projectId,
    queueId: input.queueId,
    ...fields,
    processRestartRequired: fields.processRestartRequired ?? false,
    recoveryIds: Object.freeze([...(fields.recoveryIds ?? [])]),
    recoveryObligations: Object.freeze([...(fields.recoveryObligations ?? [])]),
    completedTaskIds: Object.freeze([...fields.completedTaskIds]),
  });
}

/**
 * executionを停止結果として構築する。
 *
 * @responsibility executionの停止理由、未発行Effect、公開結果境界を所有する。
 * @trace ARCH-000004
 * @input input: ExecutionInput、reason: string、options: Readonly<{ state?: ProjectExecutionState | null; completedTaskIds?: readonly string[]; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; effectState?: "no_effect" | "settled" | "unknown"; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string; }>[]; }>
 * @returns blockedの計算結果を返す。
 * @precondition 「input: ExecutionInput、reason: string、options: Readonly<{ state?: ProjectExecutionState | null; completedTaskIds?: readonly string[]; cleanupConfirmed?: boolean; manualRecoveryRequired?: boolean; processRestartRequired?: boolean; effectState?: "no_effect" | "settled" | "unknown"; recoveryIds?: readonly string[]; recoveryObligations?: readonly Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string; }>[]; }>」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security N/A: blockedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(
  input: ExecutionInput,
  reason: string,
  options: Readonly<{
    state?: ProjectExecutionState | null;
    completedTaskIds?: readonly string[];
    cleanupConfirmed?: boolean;
    manualRecoveryRequired?: boolean;
    processRestartRequired?: boolean;
    effectState?: "no_effect" | "settled" | "unknown";
    recoveryIds?: readonly string[];
    recoveryObligations?: readonly Readonly<{
      kind: ProjectTaskRecoveryKind;
      recoveryId: string;
    }>[];
  }> = {},
) {
  return result(input, {
    status: "blocked",
    reason,
    stateGeneration: options.state?.generation ?? null,
    completedTaskIds: options.completedTaskIds ?? [],
    cleanupConfirmed: options.cleanupConfirmed ?? true,
    manualRecoveryRequired: options.manualRecoveryRequired ?? false,
    processRestartRequired: options.processRestartRequired ?? false,
    effectState: options.effectState ?? "no_effect",
    recoveryIds: options.recoveryIds ?? [],
    recoveryObligations: options.recoveryObligations ?? [],
  });
}

/**
 * task Execution Mapを決定する。
 *
 * @responsibility task Execution Mapの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: ProjectExecutionState、executions: readonly CoordinatorTaskExecution[]
 * @returns taskExecutionMapの計算結果を返す。
 * @precondition 「state: ProjectExecutionState、executions: readonly CoordinatorTaskExecution[]」がtaskExecutionMapの入力契約を満たす。
 * @postcondition taskExecutionMapの責務を完了した結果だけを返す。
 * @effect N/A: taskExecutionMapは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: taskExecutionMapは独自の失敗分岐を所有しない。
 * @invariant taskExecutionMapは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: taskExecutionMapはProcess内の同一Subsystemで完結する。
 * @security N/A: taskExecutionMapはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: taskExecutionMapは共有非同期状態を持たない同期処理である。
 */
function taskExecutionMap(
  state: ProjectExecutionState,
  executions: readonly CoordinatorTaskExecution[],
) {
  if (
    !Array.isArray(executions) ||
    executions.length !==
      state.tasks.filter((task) => task.state !== "superseded").length ||
    new Set(executions.map((entry) => entry.taskId)).size !== executions.length
  )
    return null;
  const result = new Map<string, CoordinatorTaskExecution>();
  for (const entry of executions) {
    if (
      !entry ||
      typeof entry !== "object" ||
      !state.tasks.some(
        (task) =>
          task.definition.id === entry.taskId && task.state !== "superseded",
      ) ||
      !validIdentity(entry.authorityBindingId)
    )
      return null;
    result.set(entry.taskId, entry);
  }
  return result;
}

/**
 * Own one durable Project operation from a queued request through all currently
 *
 * @responsibility Coordinator Operationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: CoordinatorExecutionDependencies、input: ExecutionInput
 * @returns Promise<CoordinatorExecutionResult>を返す。
 * @precondition 「dependencies: CoordinatorExecutionDependencies、input: ExecutionInput」がrunCoordinatorOperationの入力契約を満たす。
 * @postcondition runCoordinatorOperationの責務を完了した結果だけを返す。
 * @effect 検証済みRepositoryのState／Queueを保存し、許可されたTaskと結果受理・整理を既存Ownerへ委譲する。
 * @failure runCoordinatorOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCoordinatorOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runCoordinatorOperationはProcess内の同一Subsystemで完結する。
 * @security N/A: runCoordinatorOperationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency runCoordinatorOperationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runCoordinatorOperation(
  dependencies: CoordinatorExecutionDependencies,
  input: ExecutionInput,
): Promise<CoordinatorExecutionResult> {
  if (!(input.cancellationSignal instanceof AbortSignal))
    return blocked(input, "orchestrator_execution_input_invalid");
  const stateRead = dependencies.persistence.state.readState(input.projectId);
  const queueRead = dependencies.persistence.state.readQueue(input.queueId);
  if (
    stateRead.status !== "completed" ||
    stateRead.value === null ||
    queueRead.status !== "completed"
  )
    return blocked(input, "orchestrator_execution_observation_unknown", {
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  let state = stateRead.value;
  let startCandidates = inspectTaskStartCandidates(
    state,
    stateRead.taskStartCandidates,
  );
  if (!startCandidates)
    return blocked(input, "orchestrator_state_observation_unknown", {
      state,
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      effectState: "unknown",
    });
  let queue = queueRead.value;
  if (
    state.projectId !== input.projectId ||
    state.milestoneId !== input.milestoneId ||
    queue.projectId !== input.projectId ||
    queue.milestoneId !== input.milestoneId ||
    queue.repositoryRevision !== state.repositoryRevision
  )
    return blocked(input, "orchestrator_execution_identity_mismatch");
  if (queue.state === "integration_pending")
    return queue.ownerGeneration === null
      ? result(input, {
          status: "completed",
          reason: "orchestrator_tasks_already_integration_pending",
          stateGeneration: state.generation,
          completedTaskIds: state.tasks
            .filter((task) => task.state === "completed")
            .map((task) => task.definition.id),
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          effectState: "no_effect",
        })
      : blocked(input, "orchestrator_queue_release_not_settled", {
          state,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          effectState: "unknown",
        });
  if (queue.state !== "queued")
    return blocked(input, "orchestrator_queue_not_startable", {
      state,
      manualRecoveryRequired: [
        "leased",
        "running",
        "recovery_required",
      ].includes(queue.state),
    });
  const executions = taskExecutionMap(state, input.taskExecutions);
  if (!executions)
    return blocked(input, "orchestrator_task_execution_set_invalid", {
      state,
    });

  const leaseResult = dependencies.persistence.lease.acquire(
    input.projectId,
    input.queueId,
    "project-operation",
  );
  if (leaseResult.status !== "completed")
    return blocked(input, leaseResult.reason, {
      state,
      manualRecoveryRequired: leaseResult.manualRecoveryRequired,
      ...(leaseResult.recoveryId === null
        ? {}
        : { recoveryIds: Object.freeze([leaseResult.recoveryId]) }),
    });
  const lease = leaseResult.value;
  const workspaceResults: NonNullable<
    CoordinatorExecutionResult["workspaceResults"]
  >[number][] = [];
  const withWorkspaceResults = (value: CoordinatorExecutionResult) =>
    workspaceResults.length === 0
      ? value
      : Object.freeze({
          ...value,
          workspaceResults: Object.freeze([...workspaceResults]),
        });
  const completeWithoutOwnedQueue = (
    terminal: CoordinatorExecutionResult,
  ): CoordinatorExecutionResult => {
    const released = lease.release();
    return withWorkspaceResults(
      released.status === "completed"
        ? terminal
        : result(input, {
            status: "blocked",
            reason: released.reason,
            stateGeneration: terminal.stateGeneration,
            completedTaskIds: terminal.completedTaskIds,
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            processRestartRequired: terminal.processRestartRequired,
            recoveryIds: terminal.recoveryIds,
            recoveryObligations: terminal.recoveryObligations,
            effectState: "unknown",
          }),
    );
  };
  const completeOwnedQueue = (
    terminal: CoordinatorExecutionResult,
    terminalQueue: typeof queue,
  ): CoordinatorExecutionResult => {
    const released = lease.release();
    if (released.status !== "completed")
      return withWorkspaceResults(
        result(input, {
          status: "blocked",
          reason: released.reason,
          stateGeneration: terminal.stateGeneration,
          completedTaskIds: terminal.completedTaskIds,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          processRestartRequired: terminal.processRestartRequired,
          recoveryIds: terminal.recoveryIds,
          recoveryObligations: terminal.recoveryObligations,
          effectState: "unknown",
        }),
      );
    const settled = dependencies.persistence.state.settleQueueLeaseRelease(
      input.queueId,
      terminalQueue.generation,
      lease.ownerGeneration,
    );
    return withWorkspaceResults(
      settled.status === "completed"
        ? terminal
        : result(input, {
            status: "blocked",
            reason: settled.reason,
            stateGeneration: terminal.stateGeneration,
            completedTaskIds: terminal.completedTaskIds,
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            processRestartRequired: terminal.processRestartRequired,
            recoveryIds: terminal.recoveryIds,
            recoveryObligations: terminal.recoveryObligations,
            effectState: "unknown",
          }),
    );
  };
  const finalizeOwnedFailure = (
    reason: string,
    options: Readonly<{
      state: ProjectExecutionState;
      completedTaskIds?: readonly string[];
      processRestartRequired?: boolean;
      recoveryIds?: readonly string[];
      recoveryObligations?: CoordinatorExecutionResult["recoveryObligations"];
    }>,
  ): CoordinatorExecutionResult => {
    const recoveryObligations = [
      ...options.state.tasks.flatMap((task) =>
        task.recoveryObligations
          .filter((item) => item.phase !== "settled")
          .map(({ kind, recoveryId }) => ({ kind, recoveryId })),
      ),
      ...(options.recoveryObligations ?? []),
    ].filter(
      (item, index, all) =>
        all.findIndex(
          (other) =>
            other.kind === item.kind && other.recoveryId === item.recoveryId,
        ) === index,
    );
    const recoveryIds = [
      ...new Set([
        ...recoveryObligations.map((item) => item.recoveryId),
        ...(options.recoveryIds ?? []),
      ]),
    ];
    const terminal = blocked(input, reason, {
      state: options.state,
      completedTaskIds: options.completedTaskIds ?? [],
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      processRestartRequired: options.processRestartRequired ?? false,
      recoveryIds,
      recoveryObligations,
      effectState: "unknown",
    });
    const recoveryQueue = dependencies.persistence.state.updateQueue(
      input.queueId,
      queue.generation,
      {
        state: "recovery_required",
        lease,
        resumeCondition: "owned_operation_failure",
        resultReference: stableId(
          dependencies,
          "project-operation-recovery",
          input.projectId,
          input.queueId,
          lease.ownerGeneration,
        ),
      },
    );
    if (recoveryQueue.status === "completed") {
      queue = recoveryQueue.value;
      return completeOwnedQueue(terminal, recoveryQueue.value);
    }
    return completeWithoutOwnedQueue(
      blocked(input, recoveryQueue.reason, {
        state: options.state,
        completedTaskIds: options.completedTaskIds ?? [],
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        processRestartRequired: options.processRestartRequired ?? false,
        recoveryIds,
        recoveryObligations,
        effectState: "unknown",
      }),
    );
  };

  // Selection made before the binding-wide lease is only advisory. Re-read
  // the complete durable queue population while this process exclusively owns
  // the Project Operation boundary, then bind exactly that selected Queue.
  const selectedAfterLease =
    dependencies.persistence.state.selectNextOperation();
  if (selectedAfterLease.status !== "completed")
    return completeWithoutOwnedQueue(
      blocked(input, selectedAfterLease.reason, {
        state,
        cleanupConfirmed: false,
        manualRecoveryRequired: selectedAfterLease.manualRecoveryRequired,
        effectState: "unknown",
      }),
    );
  if (
    !selectedAfterLease.value ||
    selectedAfterLease.value.queueId !== input.queueId
  )
    return completeWithoutOwnedQueue(
      blocked(input, "orchestrator_queue_claim_priority_changed", {
        state,
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect",
      }),
    );

  const leaseQueue = dependencies.persistence.state.updateQueue(
    input.queueId,
    queue.generation,
    {
      state: "leased",
      lease,
      resumeCondition: null,
      resultReference: null,
    },
  );
  if (leaseQueue.status !== "completed")
    return completeWithoutOwnedQueue(
      blocked(input, leaseQueue.reason, {
        state,
        cleanupConfirmed: false,
        manualRecoveryRequired: leaseQueue.manualRecoveryRequired,
        effectState: "unknown",
      }),
    );
  queue = leaseQueue.value;
  if (input.cancellationSignal.aborted) {
    const cancelled = dependencies.persistence.state.updateQueue(
      input.queueId,
      queue.generation,
      {
        state: "cancelled",
        lease,
        resumeCondition: null,
        resultReference: null,
      },
    );
    if (cancelled.status !== "completed")
      return finalizeOwnedFailure(cancelled.reason, { state });
    return completeOwnedQueue(
      result(input, {
        status: "cancelled",
        reason: "orchestrator_cancelled_before_task_effect",
        stateGeneration: state.generation,
        completedTaskIds: [],
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect",
      }),
      cancelled.value,
    );
  }
  const runningQueue = dependencies.persistence.state.updateQueue(
    input.queueId,
    queue.generation,
    {
      state: "running",
      lease,
      resumeCondition: null,
      resultReference: null,
    },
  );
  if (runningQueue.status !== "completed")
    return finalizeOwnedFailure(runningQueue.reason, { state });
  queue = runningQueue.value;

  const completedTaskIds: string[] = [];
  let processRestartRequired = false;
  while (true) {
    // 同じWorkspaceの予約・実行・結果保存を一件ずつ閉じる。
    if (!inspectTaskStartCandidates(state, startCandidates))
      return finalizeOwnedFailure("orchestrator_state_observation_unknown", {
        state,
        completedTaskIds,
      });
    const taskId = startCandidates.taskIds[0];
    if (taskId === undefined) break;
    const execution = executions.get(taskId);
    if (!execution)
      return finalizeOwnedFailure("orchestrator_task_execution_missing", {
        state,
        completedTaskIds,
      });
    const attemptId = stableId(
      dependencies,
      "attempt",
      input.queueId,
      taskId,
      String(state.generation),
    );
    const operationId = stableId(
      dependencies,
      "operation",
      input.queueId,
      taskId,
      attemptId,
      execution.authorityBindingId,
    );
    const reserveWrite = dependencies.persistence.state.updateTask(
      {
        kind: "task_start",
        projectId: state.projectId,
        taskId,
        attemptId,
        authorityBindingId: execution.authorityBindingId,
      },
      state.generation,
    );
    if (reserveWrite.status !== "completed")
      return finalizeOwnedFailure(reserveWrite.reason, {
        state,
        completedTaskIds,
      });
    state = reserveWrite.value;
    startCandidates = inspectTaskStartCandidates(
      state,
      reserveWrite.taskStartCandidates,
    );
    if (!startCandidates)
      return finalizeOwnedFailure("orchestrator_state_observation_unknown", {
        state,
        completedTaskIds,
      });
    const preparedWrite = dependencies.persistence.state.updateTask(
      {
        kind: "task_handoff",
        projectId: state.projectId,
        taskId,
        attemptId,
        operationId,
      },
      state.generation,
    );
    if (preparedWrite.status !== "completed")
      return finalizeOwnedFailure(preparedWrite.reason, {
        state,
        completedTaskIds,
      });
    state = preparedWrite.value;
    startCandidates = inspectTaskStartCandidates(
      state,
      preparedWrite.taskStartCandidates,
    );
    if (!startCandidates)
      return finalizeOwnedFailure("orchestrator_state_observation_unknown", {
        state,
        completedTaskIds,
      });
    // 一件の予約を保存してから実行し、遅延・重複通知の保存順は別に保持する。
    let startObservationChain = Promise.resolve();
    let effectStarted = false;
    let delegated = false;
    const observeStarted = () => {
      const observation = startObservationChain.then(() => {
        const written = dependencies.persistence.state.updateTask(
          {
            kind: "task_started",
            projectId: state.projectId,
            taskId: taskId,
            attemptId: attemptId,
            operationId: operationId,
          },
          state.generation,
        );
        if (written.status !== "completed")
          throw Error("task_start_save_unconfirmed");
        state = written.value;
        startCandidates = inspectTaskStartCandidates(
          state,
          written.taskStartCandidates,
        );
        if (!startCandidates) throw Error("task_start_save_unconfirmed");
        effectStarted = true;
      });
      startObservationChain = observation.then(
        () => {},
        () => {},
      );
      return observation;
    };
    const runtimeIssuedRecoveryIds = new Map<
      string,
      Readonly<{ attemptId: string; operationId: string }>
    >();
    const outcome = await (async () => {
      try {
        if (input.cancellationSignal.aborted)
          return Object.freeze({
            contract:
              "crdd-coordinator/orchestrator-single-task-adapter" as const,
            attemptId: attemptId,
            operationId: operationId,
            authorityBindingId: execution.authorityBindingId,
            repositoryRevision: state.repositoryRevision,
            status: "cancelled" as const,
            reason: "single_task_cancelled_before_delegation",
            effectState: "no_effect" as const,
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            processRestartRequired: false,
            candidateId: null,
            recoveryIds: Object.freeze([]),
            recoveryObligations: Object.freeze([]),
          });
        const target = dependencies.persistence.state.readWorkspaceTaskTarget
          ? dependencies.persistence.state.readWorkspaceTaskTarget?.(
              input.queueId,
            )
          : null;
        if (
          (queue.workspaceId != null ||
            dependencies.persistence.state.readWorkspaceTaskTarget !==
              undefined) &&
          (target?.status !== "completed" ||
            target.value.workspaceId !== (queue.workspaceId ?? null))
        )
          return Object.freeze({
            contract:
              "crdd-coordinator/orchestrator-single-task-adapter" as const,
            attemptId: attemptId,
            operationId: operationId,
            authorityBindingId: execution.authorityBindingId,
            repositoryRevision: state.repositoryRevision,
            status: "blocked" as const,
            reason: "single_task_workspace_target_unavailable",
            effectState: "no_effect" as const,
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            processRestartRequired: false,
            candidateId: null,
            recoveryIds: Object.freeze([]),
            recoveryObligations: Object.freeze([]),
          });
        delegated = true;
        return await dependencies.runSingleTaskAttempt({
          attemptId: attemptId,
          operationId: operationId,
          authorityBindingId: execution.authorityBindingId,
          executionMetadata: {
            operation: "task_attempt",
            projectId: input.projectId,
            milestoneId: input.milestoneId,
            objectiveId:
              state.tasks.find((t) => t.definition.id === taskId)?.definition
                .objectiveId ?? "",
            taskId: taskId,
            attemptId: attemptId,
          },
          repositoryRevision: state.repositoryRevision,
          taskRequest: execution.taskRequest,
          repositoryRoot: execution.repositoryRoot,
          ...(target?.status === "completed"
            ? {
                workspaceId: target.value.workspaceId,
                ownerRepositoryRoot: target.value.ownerRepositoryRoot,
                executionTree: target.value.executionTree,
                workspaceBaseCommit: target.value.baseCommit,
                workspaceHead: target.value.head,
              }
            : {}),
          cancellationSignal: input.cancellationSignal,
          observeStarted,
        });
      } catch {
        return null;
      }
    })();
    let terminalState:
      | "recovery_required"
      | "replan_required"
      | "cancelled"
      | null = null;
    let terminalReference: string | null = null;
    const validatedOutcome = validSingleTaskResult(
      outcome,
      runtimeIssuedRecoveryIds,
    )
      ? outcome
      : null;
    const isExact =
      validatedOutcome !== null &&
      validatedOutcome.attemptId === attemptId &&
      validatedOutcome.operationId === operationId &&
      validatedOutcome.authorityBindingId === execution.authorityBindingId &&
      validatedOutcome.repositoryRevision === state.repositoryRevision &&
      (validatedOutcome.workspaceResult === undefined ||
        validatedOutcome.workspaceResult.workspaceId ===
          (queue.workspaceId ?? null));
    if (validatedOutcome && isExact && validatedOutcome.workspaceResult) {
      const observation = inspectWorkspaceResult(
        validatedOutcome.workspaceResult,
      );
      if (
        observation &&
        observation.workspaceId === (queue.workspaceId ?? null)
      )
        workspaceResults.push(
          Object.freeze({
            taskId: taskId,
            attemptId: attemptId,
            operationId: operationId,
            result: observation,
          }),
        );
    }
    const normalizedRecoveryObligations: Array<
      Readonly<{ kind: ProjectTaskRecoveryKind; recoveryId: string }>
    > =
      validatedOutcome && isExact
        ? [...(validatedOutcome.recoveryObligations ?? [])]
        : [];
    const isExactExternalRecoveryClosure =
      validatedOutcome !== null &&
      isExact &&
      normalizedRecoveryObligations.some(
        (entry) => entry.kind === "host" || entry.kind === "docker",
      );
    const isResultContradictsStartedEffect =
      effectStarted &&
      (!validatedOutcome ||
        !isExact ||
        validatedOutcome.effectState !== "settled");
    const isDelegatedResultIsUnknown =
      delegated &&
      !effectStarted &&
      (!validatedOutcome ||
        !isExact ||
        validatedOutcome.effectState === "unknown");
    const isExternalEffectUnresolved =
      (isResultContradictsStartedEffect || isDelegatedResultIsUnknown) &&
      !isExactExternalRecoveryClosure;
    const isProcessDiscardRequired =
      isResultContradictsStartedEffect ||
      isDelegatedResultIsUnknown ||
      validatedOutcome?.processRestartRequired === true;
    if (
      isProcessDiscardRequired &&
      !normalizedRecoveryObligations.some(
        (entry) => entry.kind === "runtime_process",
      )
    ) {
      const runtimeProcessRecoveryId =
        dependencies.processSafety.createRecoveryIdentity(
          attemptId,
          operationId,
        );
      dependencies.processSafety.poisonAfterCleanupUnknown();
      runtimeIssuedRecoveryIds.set(
        runtimeProcessRecoveryId,
        Object.freeze({
          attemptId: attemptId,
          operationId: operationId,
        }),
      );
      normalizedRecoveryObligations.push(
        Object.freeze({
          kind: "runtime_process" as const,
          recoveryId: runtimeProcessRecoveryId,
        }),
      );
    }
    const recoveryRequired =
      isResultContradictsStartedEffect ||
      isDelegatedResultIsUnknown ||
      (validatedOutcome !== null &&
        isExact &&
        (validatedOutcome.effectState === "unknown" ||
          !validatedOutcome.cleanupConfirmed ||
          validatedOutcome.manualRecoveryRequired ||
          validatedOutcome.processRestartRequired ||
          validatedOutcome.recoveryIds.length > 0));
    processRestartRequired ||= isProcessDiscardRequired;
    const recoveryObligations = recoveryRequired
      ? normalizedRecoveryObligations.map((entry) =>
          Object.freeze({ ...entry, phase: "required" as const }),
        )
      : [];
    const isRecoveryUnresolved =
      recoveryRequired &&
      (isExternalEffectUnresolved || recoveryObligations.length === 0);
    const settlementInput = {
      taskId: taskId,
      attemptId: attemptId,
      operationId: operationId,
      authorityBindingId: execution.authorityBindingId,
      outcome: recoveryRequired
        ? "recovery_required"
        : validatedOutcome?.status === "completed"
          ? "completed"
          : validatedOutcome?.status === "cancelled"
            ? "cancelled"
            : "failed",
      cleanupConfirmed:
        !effectStarted && (!validatedOutcome || !isExact)
          ? !delegated
          : !isResultContradictsStartedEffect &&
            !isDelegatedResultIsUnknown &&
            validatedOutcome?.processRestartRequired !== true &&
            isExact &&
            validatedOutcome?.cleanupConfirmed === true,
      recoveryObligations,
      recoveryUnresolved: isRecoveryUnresolved,
      candidateId: validatedOutcome?.candidateId ?? null,
    } as const;
    const savedTask = state.tasks.find((task) => task.definition.id === taskId);
    const savedStartMatches =
      savedTask?.state === "running" &&
      savedTask.startPhase === "running" &&
      savedTask.attemptId === attemptId &&
      savedTask.operationId === operationId &&
      savedTask.authorityBindingId === execution.authorityBindingId;
    const settlementRequest =
      effectStarted || savedStartMatches
        ? {
            kind: "task_settle" as const,
            projectId: state.projectId,
            ...settlementInput,
            resultUnresolved:
              !effectStarted && settlementInput.outcome === "completed"
                ? true
                : settlementInput.recoveryUnresolved,
          }
        : {
            kind: "task_settle_before_effect" as const,
            projectId: state.projectId,
            taskId: settlementInput.taskId,
            attemptId: settlementInput.attemptId,
            operationId: settlementInput.operationId,
            authorityBindingId: settlementInput.authorityBindingId,
            outcome:
              settlementInput.outcome === "completed"
                ? ("recovery_required" as const)
                : settlementInput.outcome,
            cleanupConfirmed:
              settlementInput.outcome === "completed"
                ? false
                : settlementInput.cleanupConfirmed,
            recoveryObligations: settlementInput.recoveryObligations,
            recoveryUnresolved:
              settlementInput.outcome === "completed"
                ? true
                : settlementInput.recoveryUnresolved,
          };
    const settlementWrite = dependencies.persistence.state.updateTask(
      settlementRequest,
      state.generation,
    );
    const nextStartCandidates =
      settlementWrite.status === "completed"
        ? inspectTaskStartCandidates(
            settlementWrite.value,
            settlementWrite.taskStartCandidates,
          )
        : null;
    if (settlementWrite.status !== "completed" || !nextStartCandidates)
      return finalizeOwnedFailure(
        settlementWrite.status === "completed"
          ? "orchestrator_state_observation_unknown"
          : settlementWrite.reason,
        {
          state,
          completedTaskIds,
          processRestartRequired,
          recoveryIds: normalizedRecoveryObligations.map(
            (item) => item.recoveryId,
          ),
          recoveryObligations: normalizedRecoveryObligations,
        },
      );
    state = settlementWrite.value;
    startCandidates = nextStartCandidates;
    if (!recoveryRequired && validatedOutcome?.status === "completed")
      completedTaskIds.push(taskId);
    if (recoveryRequired) {
      terminalState = "recovery_required";
    } else if ((!validatedOutcome || !isExact) && terminalState === null) {
      terminalState = "replan_required";
      terminalReference = stableId(
        dependencies,
        "task-result-invalid",
        taskId,
        attemptId,
      );
    } else if (
      validatedOutcome?.status === "cancelled" &&
      terminalState === null
    ) {
      terminalState = "cancelled";
    } else if (
      validatedOutcome?.status === "blocked" &&
      terminalState === null
    ) {
      terminalState = "replan_required";
      terminalReference = stableId(
        dependencies,
        "task-result",
        taskId,
        attemptId,
      );
    }
    if (terminalState) {
      if (terminalState === "recovery_required") {
        const exactRecoveries = state.tasks
          .filter((task) => task.state === "recovery_required")
          .flatMap((task) =>
            task.recoveryObligations.map(
              (entry) =>
                `${task.definition.id}:${entry.kind}:${entry.recoveryId}`,
            ),
          )
          .sort();
        terminalReference =
          exactRecoveries.length > 0
            ? stableId(
                dependencies,
                "project-recovery-application",
                input.projectId,
                input.queueId,
                ...exactRecoveries,
              )
            : stableId(
                dependencies,
                "project-unresolved-recovery",
                input.projectId,
                input.queueId,
                ...state.tasks
                  .filter((task) => task.recoveryUnresolved)
                  .map((task) => task.definition.id)
                  .sort(),
              );
      }
      const queueTerminal = dependencies.persistence.state.updateQueue(
        input.queueId,
        queue.generation,
        {
          state: terminalState,
          lease,
          resumeCondition:
            terminalState === "recovery_required" ? "exact_recovery" : null,
          resultReference: terminalReference,
        },
      );
      const terminal =
        queueTerminal.status === "completed"
          ? result(input, {
              status: terminalState === "cancelled" ? "cancelled" : "blocked",
              reason:
                terminalState === "recovery_required"
                  ? "orchestrator_task_recovery_required"
                  : terminalState === "cancelled"
                    ? "orchestrator_operation_cancelled"
                    : "orchestrator_replan_required",
              stateGeneration: state.generation,
              completedTaskIds,
              cleanupConfirmed: terminalState !== "recovery_required",
              manualRecoveryRequired: terminalState === "recovery_required",
              processRestartRequired,
              recoveryIds: state.tasks.flatMap((task) =>
                task.recoveryObligations.map((entry) => entry.recoveryId),
              ),
              recoveryObligations: state.tasks.flatMap((task) =>
                task.recoveryObligations.map(({ kind, recoveryId }) =>
                  Object.freeze({ kind, recoveryId }),
                ),
              ),
              effectState:
                terminalState === "recovery_required"
                  ? "unknown"
                  : completedTaskIds.length === 0 && !effectStarted
                    ? "no_effect"
                    : "settled",
            })
          : blocked(input, queueTerminal.reason, {
              state,
              completedTaskIds,
              cleanupConfirmed: false,
              manualRecoveryRequired: true,
              effectState: "unknown",
            });
      if (queueTerminal.status !== "completed")
        return finalizeOwnedFailure(queueTerminal.reason, {
          state,
          completedTaskIds,
          processRestartRequired,
        });
      return completeOwnedQueue(terminal, queueTerminal.value);
    }
  }

  if (!state.tasks.every((task) => task.state === "completed"))
    return finalizeOwnedFailure("orchestrator_no_schedulable_task", {
      state,
      completedTaskIds,
    });
  const integration = dependencies.persistence.state.updateQueue(
    input.queueId,
    queue.generation,
    {
      state: "integration_pending",
      lease,
      resumeCondition: "objective_integration",
      resultReference: stableId(
        dependencies,
        "project-result",
        input.projectId,
        input.queueId,
      ),
    },
  );
  if (integration.status !== "completed")
    return finalizeOwnedFailure(integration.reason, {
      state,
      completedTaskIds,
    });
  return completeOwnedQueue(
    result(input, {
      status: "completed",
      reason: "orchestrator_tasks_completed_integration_pending",
      stateGeneration: state.generation,
      completedTaskIds,
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      effectState: "settled",
    }),
    integration.value,
  );
}

/**
 * Coordinator Execution 契約の公開契約を記述する。
 *
 * @responsibility Coordinator Execution 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorExecutionContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorExecutionContractの入力契約を満たす。
 * @postcondition describeCoordinatorExecutionContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorExecutionContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorExecutionContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorExecutionContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorExecutionContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeCoordinatorExecutionContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeCoordinatorExecutionContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorExecutionContract() {
  return Object.freeze({
    contract: COORDINATOR_EXECUTION_CONTRACT,
    maximumConcurrency: 5,
    externalWaitWhileMutationLockHeld: false,
    cleanupUnknownDisposition: "durable_recovery_and_reservation_retained",
    staleOrOwnedQueueDisposition: "effect_zero_manual_reconciliation",
    taskManagementCapabilityComplete: false,
  });
}

/**
 * Build the Host-owned capabilities required by Coordinator execution.
 *
 * @responsibility Coordinator Execution Host Portsの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input options: CoordinatorExecutionHostAdapterOptions
 * @returns createCoordinatorExecutionHostPortsの計算結果を返す。
 * @precondition 「options: CoordinatorExecutionHostAdapterOptions」がcreateCoordinatorExecutionHostPortsの入力契約を満たす。
 * @postcondition createCoordinatorExecutionHostPortsの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorExecutionHostPortsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createCoordinatorExecutionHostPortsは独自の失敗分岐を所有しない。
 * @invariant createCoordinatorExecutionHostPortsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createCoordinatorExecutionHostPortsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createCoordinatorExecutionHostPortsは共有非同期状態を持たない同期処理である。
 */
export function createCoordinatorExecutionHostPorts(
  options: CoordinatorExecutionHostAdapterOptions = {},
) {
  return Object.freeze({
    clockIdentity: Object.freeze({
      now:
        options.now ??
        (() =>
          Object.freeze({
            monotonicMs: performance.now(),
            iso: new Date().toISOString(),
          })),
      createStableId: (prefix: string, parts: readonly string[]) =>
        `${prefix}-${createHash("sha256")
          .update(parts.join("\0"))
          .digest("hex")
          .slice(0, 40)}`,
      createContentHash: (content: string) =>
        createHash("sha256").update(content).digest("hex"),
    }) satisfies CoordinatorClockIdentityPort,
    processSafety: Object.freeze({
      getProcessInstanceIdentity: getRuntimeProcessInstanceIdentity,
      createRecoveryIdentity: createRuntimeProcessRecoveryIdentity,
      inspectRecoveryIdentity: inspectRuntimeProcessRecoveryIdentity,
      poisonAfterCleanupUnknown:
        options.poisonAfterCleanupUnknown ??
        poisonRuntimeProcessAfterCleanupUnknown,
    }) satisfies CoordinatorProcessSafetyPort,
  });
}

/**
 * Bind Coordinator recovery implementations to one verified Repository.
 *
 * @responsibility Coordinator Task 回復 Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input workingDirectory: string、repositoryBindingId: string、dependencies: CoordinatorTaskRecoveryHostDependencies
 * @returns CoordinatorTaskRecoveryPortを返す。
 * @precondition 「workingDirectory: string、repositoryBindingId: string、dependencies: CoordinatorTaskRecoveryHostDependencies」がcreateCoordinatorTaskRecoveryAdapterの入力契約を満たす。
 * @postcondition createCoordinatorTaskRecoveryAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createCoordinatorTaskRecoveryAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createCoordinatorTaskRecoveryAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createCoordinatorTaskRecoveryAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createCoordinatorTaskRecoveryAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency 回復操作の結果は通常APIへ返す。任意診断は同期発行だけを行い、返却Promiseを待たず拒否を捕捉する。後着から回復を再実行しない。
 */
export function createCoordinatorTaskRecoveryAdapter(
  dependencies: CoordinatorTaskRecoveryHostDependencies,
): CoordinatorTaskRecoveryPort {
  return Object.freeze({
    resolveCorrelations: (correlationIds: readonly string[]) =>
      dependencies.resolveTaskRecoveryCorrelations?.(correlationIds) ?? null,
    recover: (recoveryId: string, signal: AbortSignal) =>
      dependencies.recoverTaskRecovery?.(recoveryId, signal) ?? null,
    observeTransition: (event: CoordinatorRecoveryTransition) => {
      try {
        // 任意診断は回復を待たせない。後着は拒否の消費だけで再実行しない。
        void Promise.resolve(
          dependencies.observeRecoveryTransition?.(Object.freeze({ ...event })),
        ).catch(() => {});
      } catch {
        // Recovery correctness never depends on a diagnostic observer.
      }
    },
  });
}

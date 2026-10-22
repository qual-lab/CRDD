/**
 * 単発実行の値契約と結果・Runtime回復参照の相関検査を所有する。
 * @responsibility 単発実行の値契約と結果・Runtime回復参照の相関検査を所有する。
 * @trace ARCH-000004
 */
import type {
  OrchestratorExecutionObservationPublication,
  OrchestratorExecutionObservationPort,
} from "./observer.ts";
import {
  type ProjectResultAcceptance,
  type ProjectTaskRecoveryKind,
  isOrchestratorRecoveryIdentity,
  validIdentity,
} from "../state/model.ts";
import type { OrchestratorClockIdentityPort } from "../identity/clock-and-hash.ts";
import type {
  OrchestratorSingleTaskAttemptInput,
  OrchestratorSingleTaskResult,
} from "./executor.ts";
import type { OrchestratorProcessSafetyPort } from "../process/safety-contract.ts";
import type { OrchestratorPersistencePorts } from "../state/persistence.ts";
import { types as utilTypes } from "node:util";
import { snapshotCoordinatorWorkspaceResult } from "../execution/attempt.ts";

export const ORCHESTRATOR_EXECUTION_CONTRACT =
  "crdd-coordinator/orchestrator-execution/v1" as const;

/**
 * orchestrator-executionで使用するOrchestrator Task Executionの値契約を定義する。
 *
 * @responsibility Orchestrator Task ExecutionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorTaskExecutionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorTaskExecutionで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorTaskExecutionの宣言は外部境界を開かない。
 * @security N/A: OrchestratorTaskExecutionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorTaskExecutionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorTaskExecution = Readonly<{
  taskId: string;
  authorityBindingId: string;
  taskRequest: unknown;
  repositoryRoot: unknown;
}>;

/**
 * orchestrator-executionで使用するOrchestrator Execution Publication Observationの値契約を定義する。
 *
 * @responsibility Orchestrator Execution Publication ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorExecutionPublicationObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorExecutionPublicationObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorExecutionPublicationObservationの宣言は外部境界を開かない。
 * @security N/A: OrchestratorExecutionPublicationObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorExecutionPublicationObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorExecutionPublicationObservation =
  OrchestratorExecutionObservationPublication;

/**
 * orchestrator-executionで使用するOrchestrator Execution Dependenciesの値契約を定義する。
 *
 * @responsibility Orchestrator Execution DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorExecutionDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorExecutionDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorExecutionDependenciesの宣言は外部境界を開かない。
 * @security N/A: OrchestratorExecutionDependenciesはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorExecutionDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorExecutionDependencies = Readonly<{
  persistence: OrchestratorPersistencePorts;
  clockIdentity: OrchestratorClockIdentityPort;
  processSafety: OrchestratorProcessSafetyPort;
  runSingleTaskAttempt: (
    input: OrchestratorSingleTaskAttemptInput,
  ) => Promise<OrchestratorSingleTaskResult>;
  executionObservation?: OrchestratorExecutionObservationPort;
  resultDelivery?: Readonly<{
    repositoryBindingId: string;
    createAcceptanceReader: (
      acceptance: ProjectResultAcceptance,
    ) => (() => ProjectResultAcceptance | null) | null;
  }>;
}>;

/**
 * orchestrator-executionで使用するOrchestrator Execution 結果の値契約を定義する。
 *
 * @responsibility Orchestrator Execution 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorExecutionResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorExecutionResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorExecutionResultの宣言は外部境界を開かない。
 * @security N/A: OrchestratorExecutionResultはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorExecutionResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorExecutionResult = Readonly<{
  contract: typeof ORCHESTRATOR_EXECUTION_CONTRACT;
  status: "completed" | "blocked" | "cancelled";
  reason: string;
  projectId: string;
  queueId: string;
  stateGeneration: number | null;
  completedTaskIds: readonly string[];
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  recoveryIds: readonly string[];
  recoveryObligations: readonly Readonly<{
    kind: ProjectTaskRecoveryKind;
    recoveryId: string;
  }>[];
  effectState: "no_effect" | "settled" | "unknown";
  workspaceResults?: readonly Readonly<{
    taskId: string;
    attemptId: string;
    operationId: string;
    result: NonNullable<OrchestratorSingleTaskResult["workspaceResult"]>;
  }>[];
}>;

/**
 * orchestrator-executionで使用するExecution 入力の値契約を定義する。
 *
 * @responsibility Execution 入力のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ExecutionInputが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionInputで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionInputの宣言は外部境界を開かない。
 * @security N/A: ExecutionInputはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ExecutionInputの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ExecutionInput = Readonly<{
  projectId: string;
  milestoneId: string;
  queueId: string;
  taskExecutions: readonly OrchestratorTaskExecution[];
  cancellationSignal: AbortSignal;
}>;

/**
 * Single Task 結果が有効か判定する。
 *
 * @responsibility Single Task 結果の有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、runtimeIssuedRecoveryIds: ReadonlyMap< string, Readonly<{ attemptId: string; operationId: string }> >
 * @returns value is OrchestratorSingleTaskResultを返す。
 * @precondition 「value: unknown、runtimeIssuedRecoveryIds: ReadonlyMap< string, Readonly<{ attemptId: string; operationId: string }> >」がvalidSingleTaskResultの入力契約を満たす。
 * @postcondition validSingleTaskResultの責務を完了した結果だけを返す。
 * @effect N/A: validSingleTaskResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validSingleTaskResultは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validSingleTaskResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validSingleTaskResultはProcess内の同一Subsystemで完結する。
 * @security N/A: validSingleTaskResultはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validSingleTaskResultは共有非同期状態を持たない同期処理である。
 */
export function validSingleTaskResult(
  value: unknown,
  runtimeIssuedRecoveryIds: ReadonlyMap<
    string,
    Readonly<{ attemptId: string; operationId: string }>
  >,
): value is OrchestratorSingleTaskResult {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value) ||
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
      snapshotCoordinatorWorkspaceResult(record.workspaceResult) === null
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
      utilTypes.isProxy(record.recoveryIds) ||
      record.recoveryIds.length > 128 ||
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
        !isOrchestratorRecoveryIdentity(descriptor.value)
      )
        return false;
    }
    const rawObligations = record.recoveryObligations;
    if (rawObligations !== undefined) {
      if (
        !Array.isArray(rawObligations) ||
        utilTypes.isProxy(rawObligations) ||
        rawObligations.length > 128
      )
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
          utilTypes.isProxy(entry) ||
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
          !isOrchestratorRecoveryIdentity(recoveryId) ||
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

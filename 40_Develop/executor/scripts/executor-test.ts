/**
 * 外部AIを使わないPackage間試験の既存組立てを公開Rootから分離する。
 * @packageDocumentation
 * @responsibility 有限代役と内部検査だけを試験へ接続し製品の入口を増やさない。
 * @trace ARCH-000008
 * @boundary scripts/tests専用。実行許可や本番構成ではない。
 */
import { types as utilTypes } from "node:util";
import {
  readOwnDataProperty,
  isAttemptPlanValid,
  isAttemptFailureReason,
} from "../src/attempt/validation.ts";
import type {
  AttemptPlan,
  RuntimeState,
  IsolationRuntime,
  AttemptReference,
  ExecutorCallbacks,
  AttemptTerminalObservation as TechnicalObservation,
} from "../src/attempt/types.ts";
import type {
  ProcessStartedNotice,
  CompletionResult,
  StartResult,
  AttemptDiagnosticNotice as TechnicalDiagnosticNotice,
} from "../src/index.ts";
import {
  createDockerIsolationRuntime,
  startDockerCommandSessionCandidate,
  parseDockerTaskRecoveryId,
  describeDockerIsolationExecutionEnvironment,
  type DockerSessionCleanup,
  type DockerIsolationCommand,
  type DockerIsolationRuntimeOptions,
  type DockerSessionCommandHandle,
  type DockerCommandSession,
  type DockerExecutionCallbacks,
  type HomeLease,
  type DockerIsolationRuntime,
  type DockerIsolationRuntimePlan,
} from "../../docker-isolation/src/index.ts";

import { start, cancel, abandon } from "../src/attempt/execute.ts";
import {
  bindIsolationRuntime as bindTestIsolationRuntime,
  planIdentity,
  resolveValidatedPlan,
} from "../src/attempt/isolation.ts";
import { PURPOSES } from "../src/attempt/constants.ts";
import { createStartResult } from "../src/attempt/result.ts";
export { createAttemptRecoveryTestApi } from "./attempt-recovery-test.ts";
export const PREPARATION_LIFETIME_MS = 30_000;
export {
  projectAttemptStartResult,
  projectAttemptResult,
} from "../tests/support/result-validation.ts";
export { isAttemptFailureReason } from "../src/attempt/validation.ts";

const RECOVERY_START_FAILURE_STAGES = Object.freeze([
  "plan_validation",
  "operation_context",
  "provider_home",
  "home_lock",
  "operation_binding",
  "state_conflict",
  "operation_start_save",
  "settlement_binding",
  "host_submission",
  "home_lock_release",
  "unknown",
] as const);

/** 開始Ownerから受動診断へ渡す固定段階と、取得済みの場合だけの元参照。 */
type RecoveryStartFailureDiagnostic = Readonly<{
  stage: (typeof RECOVERY_START_FAILURE_STAGES)[number];
  recoveryId: string | null;
}>;

type AttemptDiagnosticNotice =
  | TechnicalDiagnosticNotice
  | Readonly<{
      event: "coordinator_provider_recovery_start_failed";
      taskRole: "executor" | "reviewer" | null;
      provider: "codex" | "claude";
      operationId: string;
      diagnostic: RecoveryStartFailureDiagnostic;
    }>;

type RecordedAttemptResult = CompletionResult &
  Readonly<{
    mountLeaseReleased: boolean;
    recoveryCompleted: boolean;
    recoveryFinalizationCapability: object | null;
  }>;

/** 試験側が所有する旧操作の有限代役。製品APIへ公開しない。 */
type ExecutionRecordOperations = Readonly<{
  verifyRevision: (managementCapability: unknown, plan: AttemptPlan) => unknown;
  beginRecovery: (
    plan: AttemptPlan,
    managementCapability: unknown,
    observeFailure?: (diagnostic: RecoveryStartFailureDiagnostic) => void,
  ) => Recovery | BlockedRecovery | null;
  abandonRecovery?: (recoveryCapability: object) => boolean;
  bindInitializationFailure?: (
    capability: unknown,
    recoveryId: unknown,
    managementCapability: unknown,
    homeHash: unknown,
    reason: unknown,
    result: object | null,
  ) => boolean;
  verifyRecoveryBinding: (
    recoveryCapability: unknown,
    recoveryId: unknown,
    managementCapability: unknown,
    stableLogicalHomeBindingHash: unknown,
  ) => boolean;
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  completeCleanup: (input: AttemptCleanupInput) => AttemptCleanupResult;
  markResourceSubmission?: (
    recoveryCapability: object,
    purpose: string,
  ) => boolean;
  recordProviderSubmission?: (recoveryCapability: object) => boolean;
  recordResourceNotIssued?: (
    recoveryCapability: object,
    purpose: string,
  ) => boolean;
  recordResourceReceipt?: (
    recoveryCapability: object,
    purpose: string,
    dockerId: string,
  ) => boolean;
  recordTerminalObservation?: (
    recoveryCapability: object,
    result: object,
    observation: AttemptTerminalObservation,
  ) => void;
  reportProviderProcessStarted?: (
    notice: ProcessStartedNotice,
  ) => Promise<boolean>;
  reportProviderBoundaryDiagnostic?: (
    notice: AttemptDiagnosticNotice,
  ) => Promise<boolean>;
  consumeProviderAuthority: (
    useCapability: unknown,
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{
    operationId: string;
    provider: string;
    providerHomeMountGrantRef: string;
    runtimeAuthorityIssued: true;
    providerEffectAllowed: true;
  }> | null;
}>;

type AttemptCleanupInput = Readonly<{
  plan: AttemptPlan;
  recoveryCapability: object;
  managementCapability: unknown;
  recoveryId: string;
  observations: DockerSessionCleanup["resourceObservations"];
  mountCompletion: Readonly<{ status: string }> | null;
  mountLeaseReleased: boolean;
  homeLeaseReleased: boolean;
}>;

type Recovery = Readonly<{
  status: "ready";
  recoveryId: string;
  recoveryCapability: object;
}>;

type BlockedRecovery = Readonly<{
  status: "blocked";
  reason?: string;
  recoveryId: string | null;
  manualRecoveryRequired?: boolean;
}>;

type ExecutionServices = Readonly<{
  effectExecutorAvailable: boolean;
  acquireHomeLease: (bindingHash: string) => HomeLease | null;
  startCommand?: (
    command: DockerIsolationCommand,
    plan: AttemptPlan,
    managementCapability: unknown,
  ) => DockerSessionCommandHandle;
  startExecution?: (
    plan: AttemptPlan,
    recoveryCapability: object,
    managementCapability: object,
    hooks: DockerExecutionCallbacks,
  ) => DockerCommandSession;
  cleanupOwnedResources: (
    plan: AttemptPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) => Promise<DockerSessionCleanup>;
  verifyCleanupOutcome?: (
    result: unknown,
    plan: AttemptPlan,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) => DockerSessionCleanup["resourceObservations"];
}>;

type AttemptCleanupResult = Readonly<{
  mountLeaseReleased: boolean;
  homeLeaseReleased: boolean;
  recoveryCompleted: boolean;
  recoveryFinalizationCapability: object | null;
}>;

type RuntimeDependencies = ExecutionRecordOperations & ExecutionServices;

/**
 * 合成Hostが所有する保存・解放操作。製品の入力契約ではない。
 * @responsibility 既存の有限試験を上位Hostの順序として組み立てる。
 * @trace ARCH-000008
 */
export type ExecutorTestCleanup = Readonly<{
  consumePreparedPlan: (
    prepared: unknown,
    management: unknown,
  ) => AttemptPlan | null;
  completeRecovery: (
    recoveryCapability: object,
    managementCapability: unknown,
    completion: Readonly<{
      plan: AttemptPlan;
      mountCompletion: Readonly<{ status: string }>;
    }>,
  ) => Readonly<{
    status: string;
    recoveryFinalizationCapability?: object;
  }>;
  verifyHomeLeaseRelease?: (
    recoveryCapability: unknown,
    managementCapability: unknown,
    operationId: unknown,
    recoveryId: unknown,
  ) => boolean;
  recordDockerAbsence?: (
    recoveryCapability: object,
    observations: DockerSessionCleanup["resourceObservations"],
  ) => boolean;
  recordMountCompletion?: (
    recoveryCapability: object,
    mountCompletion: Readonly<{ status: string }>,
  ) => boolean;
}>;
export type ExecutorTestHost = DockerIsolationRuntimeOptions &
  Omit<ExecutionRecordOperations, "completeCleanup"> &
  ExecutorTestCleanup &
  Readonly<{ acquireHomeLease?: RuntimeDependencies["acquireHomeLease"] }>;
export type ExecutorTestDependencies = Omit<
  RuntimeDependencies,
  "completeCleanup" | "acquireHomeLease"
> &
  ExecutorTestCleanup &
  Readonly<{ acquireHomeLease?: RuntimeDependencies["acquireHomeLease"] }>;

type RecordedStartResult =
  | Exclude<
      import("../src/attempt/types.ts").StartResult,
      { status: "started" }
    >
  | (Omit<
      Extract<
        import("../src/attempt/types.ts").StartResult,
        { status: "started" }
      >,
      "completion"
    > & { readonly completion: Promise<RecordedAttemptResult> });
type AttemptTerminalObservation = TechnicalObservation & {
  readonly mountLeaseReleased: boolean;
  readonly recoveryCompleted: boolean;
};

/**
 * 本番と状態を共有しない有限代役の試験Runtimeを作る。
 * @responsibility 外部AIなしの試験へ同じLifecycleを接続する。
 * @trace ARCH-000008
 * @input 試験が所有する有限操作。
 * @returns 開始・取消を持つ試験候補。
 * @precondition 試験側が代役の終了と清掃を所有する。
 * @postcondition productionAuthorityは常にfalse。
 * @effect 構築時はメモリだけ。実Effectは試験側の操作に依存する。
 * @failure 無効な開始は既存のblockedへ閉じる。
 * @invariant 本番OwnerのMapやAuthorityを借りない。
 * @boundary Package内の検証接続。
 * @security この候補を本番資格として受理しない。
 * @concurrency 同じControlへ取消とcompletionを結合する。
 */
export function createExecutorTestCandidate(
  dependencies: ExecutorTestDependencies,
) {
  let context: {
    plan: AttemptPlan;
    management: unknown;
    recovery: unknown;
  } | null = null;
  const runtime = createExecutorTestRuntime(
    {
      ...dependencies,
      startExecution:
        dependencies.startExecution ??
        ((plan, recovery, management, hooks) =>
          startDockerCommandSessionCandidate(
            plan.commands.map((c) => c.purpose),
            {
              startCommand: (purpose) => {
                const command = plan.commands.find(
                  (c) => c.purpose === purpose,
                );
                if (!command || !dependencies.startCommand)
                  throw Error("test_command_missing");
                return dependencies.startCommand(command, plan, management);
              },
              cleanup: () =>
                dependencies.cleanupOwnedResources(plan, recovery, management),
              verifyCleanup: (result) =>
                dependencies.verifyCleanupOutcome
                  ? dependencies.verifyCleanupOutcome(
                      result,
                      plan,
                      recovery,
                      management,
                    )
                  : (result.resourceObservations ?? null),
            },
            hooks,
          )),
      verifyCleanupOutcome: (result, plan, recovery, management) =>
        dependencies.verifyCleanupOutcome
          ? dependencies.verifyCleanupOutcome(
              result,
              plan,
              recovery,
              management,
            )
          : ((result as DockerSessionCleanup).resourceObservations ?? null),
      acquireHomeLease:
        dependencies.acquireHomeLease ??
        (() =>
          Object.freeze({
            release: () => {
              if (!context || !dependencies.verifyHomeLeaseRelease) return true;
              const r = context.recovery as {
                recoveryCapability?: unknown;
                recoveryId?: unknown;
              } | null;
              return (
                dependencies.verifyHomeLeaseRelease(
                  r?.recoveryCapability,
                  context.management,
                  context.plan.operationId,
                  r?.recoveryId,
                ) === true
              );
            },
          })),
    },
    false,
  );
  return Object.freeze({
    productionAuthority: runtime.productionAuthority,
    cancel: runtime.cancel,
    abandon: runtime.abandon,
    start: (
      prepared: unknown,
      management: unknown,
      handoff?: unknown,
      restriction?: unknown,
      observeStarted?: (notice: ProcessStartedNotice) => void | Promise<void>,
    ) => {
      if (!management || typeof management !== "object")
        return createStartResult({
          status: "blocked",
          reason: "docker_process_controller_effect_unavailable",
        });
      const plan = dependencies.consumePreparedPlan(prepared, management);
      if (!plan)
        return createStartResult({
          status: "blocked",
          reason: "docker_process_controller_plan_invalid",
        });
      context = { plan, management, recovery: null };
      return startHostAttempt(
        runtime,
        {
          dependencies: {
            ...dependencies,
            completeCleanup: (input) =>
              completeExecutorTestCleanup(dependencies, input),
            beginRecovery: (p, m, observe) => {
              const result = dependencies.beginRecovery(p, m, observe);
              if (context) context.recovery = result;
              return result;
            },
          },
        },
        plan,
        management,
        handoff ?? (() => true),
        restriction,
        observeStarted,
      );
    },
  });
}
/**
 * 試験Hostの終了順序を試験側だけで構成する。
 * @responsibility 製品Executorへ保存判断を戻さず、有限代役の同期拒否を維持する。
 * @trace ARCH-000008
 * @effect 合成Hostが指定した処理だけを順番に呼ぶ。
 * @invariant 実Homeの解放は専用の観測callbackがある場合だけその観測を使う。
 */
export function completeExecutorTestCleanup(
  dependencies: ExecutorTestDependencies | ExecutorTestHost,
  input: AttemptCleanupInput,
): AttemptCleanupResult {
  const { mountLeaseReleased, homeLeaseReleased } = input;
  let recoveryCompleted = false;
  let recoveryFinalizationCapability: object | null = null;
  try {
    const absence: unknown =
      dependencies.recordDockerAbsence?.(
        input.recoveryCapability,
        input.observations,
      ) ?? true;
    if (utilTypes.isPromise(absence)) void absence.catch(() => {});
    if (absence !== true) throw Error("synthetic_absence_unconfirmed");
    const mount = input.mountCompletion;
    if (mountLeaseReleased && mount) {
      const receipt: unknown =
        dependencies.recordMountCompletion?.(input.recoveryCapability, mount) ??
        true;
      if (utilTypes.isPromise(receipt)) void receipt.catch(() => {});
      if (receipt !== true) throw Error("synthetic_mount_unconfirmed");
      const result = dependencies.completeRecovery(
        input.recoveryCapability,
        input.managementCapability,
        Object.freeze({ plan: input.plan, mountCompletion: mount }),
      );
      recoveryFinalizationCapability =
        result.status === "completed" &&
        typeof result.recoveryFinalizationCapability === "object"
          ? (result.recoveryFinalizationCapability ?? null)
          : null;
      recoveryCompleted = recoveryFinalizationCapability !== null;
    }
  } catch {
    recoveryCompleted = false;
    recoveryFinalizationCapability = null;
  }
  if (!homeLeaseReleased) {
    recoveryCompleted = false;
    recoveryFinalizationCapability = null;
  }
  return Object.freeze({
    mountLeaseReleased,
    homeLeaseReleased,
    recoveryCompleted,
    recoveryFinalizationCapability,
  });
}

/**
 * 単独合成Hostと固定DIの検証接続を構成する。
 * @responsibility 試験側の保存判断だけを終了callbackへ結合する。
 * @trace ARCH-000008
 */
export function createExecutorLifecycleTestRuntime(host: ExecutorTestHost) {
  const fixed = createDockerIsolationRuntime({
    borrowPaths: host.borrowPaths,
    inspectReceipts: host.inspectReceipts,
  });
  const bound = bindTestIsolationRuntime(fixed, host.borrowPaths);
  const runtime = createExecutorTestRuntime(
    {
      acquireHomeLease: host.acquireHomeLease ?? fixed.acquireHomeLease,
      ...bound,
    },
    true,
  );
  return Object.freeze({
    cancel: runtime.cancel,
    abandon: runtime.abandon,
    start: (
      prepared: unknown,
      management: unknown,
      handoff?: unknown,
      restriction?: unknown,
    ) => {
      const plan = host.consumePreparedPlan(prepared, management);
      if (!plan)
        return createStartResult({
          status: "blocked",
          reason: "docker_process_controller_plan_invalid",
        });
      return startHostAttempt(
        runtime,
        {
          dependencies: {
            ...host,
            completeCleanup: (input) =>
              completeExecutorTestCleanup(host, input),
          },
        },
        plan,
        management,
        handoff,
        restriction,
      );
    },
  });
}
function settleInvalidRecoveryStart(
  state: Readonly<{ dependencies: ExecutionRecordOperations }>,
  plan: AttemptPlan,
  managementCapability: object,
  recoveryCapability: unknown,
  recoveryId: string | null,
  reason: string,
) {
  if (recoveryCapability && typeof recoveryCapability === "object") {
    try {
      state.dependencies.abandonRecovery?.(recoveryCapability);
    } catch {}
  }
  try {
    state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
  } catch {}
  return createStartResult({
    status: "blocked",
    reason: reason,
    cleanupConfirmed: false,
    recoveryId: recoveryId,
    manualRecoveryRequired: true,
  });
}

function commandRestrictionAllows(restriction: unknown, purpose: string) {
  if (restriction === undefined) return true;
  if (
    typeof restriction !== "function" ||
    utilTypes.isProxy(restriction) ||
    utilTypes.isAsyncFunction(restriction)
  )
    return false;
  try {
    const result: unknown = restriction(purpose);
    if (utilTypes.isPromise(result)) {
      // A mistakenly returned native Promise cannot authorize a synchronous
      // launch. Observe rejection without awaiting or invoking a custom then.
      void Promise.prototype.then.call(
        result,
        () => {},
        () => {},
      );
      return false;
    }
    return result === true;
  } catch {
    return false;
  }
}

/**
 * 上位が確定した一試行を実行し、技術通知を自身の保存へ接続する。
 * @responsibility 通知へ保存結果を返さず、上位の完了投影だけで耐久受理を表す。
 * @trace ARCH-000008
 * @effect 同じ記録への更新・Grant終了と、下位Executorの明示開始。
 */
function startRecordedAttempt(
  executor: Readonly<{
    start(
      plan: AttemptPlan,
      management: unknown,
      reference: AttemptReference,
      callbacks?: ExecutorCallbacks,
    ): StartResult;
  }>,
  plan: AttemptPlan,
  management: object,
  recovery: Recovery,
  operations: ExecutionRecordOperations,
  observeStarted?: (notice: ProcessStartedNotice) => void | Promise<void>,
  restriction?: unknown,
): RecordedStartResult {
  let restrictionRejected = false;
  let mountCompletion: Readonly<{ status: string }> | null = null;
  let cleanup: AttemptCleanupResult = {
    mountLeaseReleased: false,
    homeLeaseReleased: false,
    recoveryCompleted: false,
    recoveryFinalizationCapability: null,
  };
  let terminalObservation: TechnicalObservation | null = null;
  function requireRecorded(value: unknown): void {
    if (utilTypes.isPromise(value)) void value.catch(() => {});
    if (value !== true) throw Error("record_unconfirmed");
  }
  const callbacks: ExecutorCallbacks = {
    onCommandSubmitting: (purpose) => {
      if (!commandRestrictionAllows(restriction, purpose)) {
        restrictionRejected = true;
        throw Error("execution_restricted");
      }
      if (purpose.startsWith("create_") && operations.markResourceSubmission)
        requireRecorded(
          operations.markResourceSubmission(
            recovery.recoveryCapability,
            purpose,
          ),
        );
    },
    onCommandNotIssued: (purpose) => {
      if (operations.recordResourceNotIssued)
        requireRecorded(
          operations.recordResourceNotIssued(
            recovery.recoveryCapability,
            purpose,
          ),
        );
    },
    onProviderSubmitting: () => {
      if (operations.recordProviderSubmission)
        requireRecorded(
          operations.recordProviderSubmission(recovery.recoveryCapability),
        );
    },
    onResourceCreated: (purpose, id) => {
      if (operations.recordResourceReceipt)
        requireRecorded(
          operations.recordResourceReceipt(
            recovery.recoveryCapability,
            purpose,
            id,
          ),
        );
    },
    onStarted: async (notice) => {
      // 表示の失敗は保存の成否や後続実行を変更しない。
      try {
        const pending = operations.reportProviderProcessStarted?.(notice);
        if (pending) void pending.catch(() => {});
      } catch {
        // 任意表示だけの失敗。
      }
      if (observeStarted) {
        try {
          await observeStarted(notice);
        } catch {
          throw Error("provider_start_record_failed");
        }
      }
    },
    onDiagnostic: (notice) => {
      try {
        const pending = operations.reportProviderBoundaryDiagnostic?.(
          restrictionRejected &&
            notice.event === "coordinator_provider_boundary_settled"
            ? Object.freeze({
                ...notice,
                primaryFailure:
                  terminalObservation?.primaryFailure ?? notice.primaryFailure,
              })
            : notice,
        );
        if (pending) void pending.catch(() => {});
      } catch {
        // 任意診断は実行結果・元回復参照を変更しない。
      }
    },
    onResourcesClosed: () => {
      mountCompletion = operations.completeMount(
        plan.activeMountCapability,
        management,
      );
      cleanup = {
        ...cleanup,
        mountLeaseReleased: mountCompletion.status === "completed",
      };
    },
    onCleanupCompleted: (observation) => {
      terminalObservation =
        restrictionRejected && observation.primaryFailure
          ? Object.freeze({
              ...observation,
              primaryFailure: Object.freeze({
                ...observation.primaryFailure,
                stage: "command_restriction" as const,
                reason:
                  "docker_process_controller_execution_restricted" as const,
              }),
            })
          : observation;
      cleanup = {
        ...cleanup,
        homeLeaseReleased: observation.homeLeaseReleased,
      };
      if (
        !observation.processTreeTerminationConfirmed ||
        !observation.containersAbsent ||
        !observation.networksAbsent ||
        observation.resources === null
      )
        return;
      const saved = operations.completeCleanup({
        plan,
        managementCapability: management,
        recoveryCapability: recovery.recoveryCapability,
        recoveryId: recovery.recoveryId,
        observations: observation.resources,
        mountCompletion,
        mountLeaseReleased: cleanup.mountLeaseReleased,
        homeLeaseReleased: observation.homeLeaseReleased,
      });
      if (
        saved.mountLeaseReleased !== cleanup.mountLeaseReleased ||
        saved.homeLeaseReleased !== cleanup.homeLeaseReleased
      )
        throw Error("cleanup_record_inconsistent");
      cleanup = saved;
    },
  };
  const started = executor.start(plan, management, recovery, callbacks);
  if (started.status !== "started") {
    try {
      operations.completeMount(plan.activeMountCapability, management);
    } catch {}
    return started;
  }
  return Object.freeze({
    ...started,
    completion: started.completion.then(async (result) => {
      try {
        const observation = terminalObservation;
        if (!observation) throw Error("terminal_observation_missing");
        const revisionValid = !!operations.verifyRevision(management, plan);
        const taskCleanupConfirmed =
          result.cleanupConfirmed && cleanup.mountLeaseReleased;
        const final: RecordedAttemptResult = Object.freeze({
          ...result,
          ...cleanup,
          reason:
            restrictionRejected && result.cleanupConfirmed
              ? ("docker_process_controller_execution_restricted" as const)
              : result.reason,
          cleanupConfirmed: taskCleanupConfirmed,
          ...(!taskCleanupConfirmed
            ? {
                status: "blocked" as const,
                reason:
                  "docker_process_controller_cleanup_unconfirmed" as const,
                normalizedResult: null,
                resultSha256: null,
                resultBytes: 0,
                reviewFindings: null,
                providerExecutionObservation: null,
                providerTurnObservation: null,
              }
            : {}),
          recoveryId:
            taskCleanupConfirmed && cleanup.recoveryCompleted
              ? null
              : recovery.recoveryId,
          manualRecoveryRequired:
            result.manualRecoveryRequired ||
            !cleanup.mountLeaseReleased ||
            !cleanup.recoveryCompleted,
          ...(!revisionValid
            ? {
                status: "blocked" as const,
                reason: "repository_revision_changed" as const,
                normalizedResult: null,
                resultSha256: null,
                resultBytes: 0,
                reviewFindings: null,
              }
            : {}),
        });
        if (observation.resources !== null)
          await operations.recordTerminalObservation?.(
            recovery.recoveryCapability,
            final,
            Object.freeze({
              ...observation,
              mountLeaseReleased: cleanup.mountLeaseReleased,
              recoveryCompleted: cleanup.recoveryCompleted,
            }),
          );
        return final;
      } catch {
        return Object.freeze({
          ...result,
          ...cleanup,
          status: "blocked" as const,
          reason: "docker_process_controller_execution_failed_closed" as const,
          recoveryCompleted: false,
          recoveryFinalizationCapability: null,
          recoveryId: recovery.recoveryId,
          manualRecoveryRequired: true,
          normalizedResult: null,
          resultSha256: null,
          resultBytes: 0,
          reviewFindings: null,
        });
      }
    }),
  });
}

function startHostAttempt(
  executor: Readonly<{
    start(
      plan: AttemptPlan,
      management: unknown,
      reference: AttemptReference,
      callbacks?: ExecutorCallbacks,
    ): StartResult;
  }>,
  state: Readonly<{ dependencies: ExecutionRecordOperations }>,
  preparedCapability: unknown,
  managementCapability: unknown,
  registerRecoveryHandoff: unknown,
  commandRestriction: unknown,
  observeProviderStarted?: (
    notice: ProcessStartedNotice,
  ) => void | Promise<void>,
) {
  if (
    (observeProviderStarted !== undefined &&
      typeof observeProviderStarted !== "function") ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return createStartResult({
      status: "blocked",
      reason: "docker_process_controller_effect_unavailable",
    });
  }
  const plan = preparedCapability as AttemptPlan & {
    authorityUseCapability: object;
  };
  if (!plan || !isAttemptPlanValid(plan))
    return createStartResult({
      status: "blocked",
      reason: "docker_process_controller_plan_invalid",
    });
  if (!state.dependencies.verifyRevision(managementCapability, plan)) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createStartResult({
      status: "blocked",
      reason: "docker_process_controller_revision_invalid",
      cleanupConfirmed: completed.status === "completed",
    });
  }
  const authority = state.dependencies.consumeProviderAuthority(
    plan.authorityUseCapability,
    plan.activeMountCapability,
    managementCapability,
  );
  if (
    !authority ||
    authority.operationId !== plan.operationId ||
    authority.provider !== plan.provider ||
    authority.providerHomeMountGrantRef !== plan.grantRef ||
    authority.runtimeAuthorityIssued !== true ||
    authority.providerEffectAllowed !== true
  ) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createStartResult({
      status: "blocked",
      reason: "docker_process_controller_authority_invalid",
      cleanupConfirmed: completed.status === "completed",
    });
  }
  let recoveryStartFailure: RecoveryStartFailureDiagnostic | null = null;
  const proceed = () => {
    let failureObserved = false;
    const recovery = state.dependencies.beginRecovery(
      plan,
      managementCapability,
      (raw) => {
        if (failureObserved) return;
        failureObserved = true;
        const value = inspectRecoveryStartFailureDiagnostic(raw);
        recoveryStartFailure =
          value &&
          (value.recoveryId === null ||
            parseDockerTaskRecoveryId(value.recoveryId)
              ?.stableLogicalHomeBindingHash ===
              plan.stableLogicalHomeBindingHash)
            ? value
            : Object.freeze({ stage: "unknown", recoveryId: null });
      },
    );
    const readyRecovery = snapshotReadyRecovery(recovery);
    if (!readyRecovery) {
      if (failureObserved && recoveryStartFailure) {
        const diagnostic =
          recoveryStartFailure as RecoveryStartFailureDiagnostic;
        const returnedId = resolveRecoveryReference(
          readOwnDataProperty(recovery, "recoveryId"),
        );
        try {
          const pending = state.dependencies.reportProviderBoundaryDiagnostic?.(
            Object.freeze({
              event: "coordinator_provider_recovery_start_failed",
              taskRole: plan.taskRole,
              provider: plan.provider,
              operationId: plan.operationId,
              diagnostic:
                diagnostic.recoveryId === null ||
                diagnostic.recoveryId === returnedId
                  ? diagnostic
                  : Object.freeze({ stage: "unknown", recoveryId: null }),
            }),
          );
          if (pending) void pending.catch(() => {});
        } catch {
          // 合成Hostの診断失敗は、試行結果と元の回復参照を変更しない。
        }
      }
      const malformedCapability = readOwnDataProperty(
        recovery,
        "recoveryCapability",
      );
      const malformedRecoveryId = resolveRecoveryReference(
        readOwnDataProperty(recovery, "recoveryId"),
      );
      const exactBlocked = snapshotBlockedRecoveryWithExactId(
        recovery,
        plan.stableLogicalHomeBindingHash,
      );
      if (exactBlocked?.recoveryCapability) {
        const stopped = createStartResult({
          status: "blocked",
          reason: resolveRecoveryStartReason(exactBlocked.reason),
          cleanupConfirmed: false,
          recoveryId: exactBlocked.recoveryId,
          manualRecoveryRequired: true,
        });
        let isVerified = false;
        try {
          isVerified =
            state.dependencies.bindInitializationFailure?.(
              exactBlocked.recoveryCapability,
              exactBlocked.recoveryId,
              managementCapability,
              plan.stableLogicalHomeBindingHash,
              exactBlocked.reason,
              stopped,
            ) === true;
        } catch {}
        if (isVerified) {
          try {
            state.dependencies.abandonRecovery?.(
              exactBlocked.recoveryCapability,
            );
          } catch {}
          try {
            state.dependencies.completeMount(
              plan.activeMountCapability,
              managementCapability,
            );
          } catch {}
          return stopped;
        }
      }
      if (!malformedCapability && exactBlocked) {
        const completed = state.dependencies.completeMount(
          plan.activeMountCapability,
          managementCapability,
        );
        return createStartResult({
          status: "blocked",
          reason: resolveRecoveryStartReason(exactBlocked.reason),
          cleanupConfirmed: completed.status === "completed",
          recoveryId: exactBlocked.recoveryId,
          manualRecoveryRequired: true,
        });
      }
      if (malformedCapability || malformedRecoveryId)
        return settleInvalidRecoveryStart(
          state,
          plan,
          managementCapability,
          malformedCapability,
          malformedRecoveryId,
          "docker_process_controller_recovery_identity_invalid",
        );
      const completed = state.dependencies.completeMount(
        plan.activeMountCapability,
        managementCapability,
      );
      return createStartResult({
        status: "blocked",
        reason: resolveRecoveryStartReason(
          readOwnDataProperty(recovery, "reason"),
        ),
        cleanupConfirmed: completed.status === "completed",
        recoveryId: malformedRecoveryId,
        manualRecoveryRequired:
          readOwnDataProperty(recovery, "manualRecoveryRequired") === true,
      });
    }
    const parsedRecoveryId = parseDockerTaskRecoveryId(
      readyRecovery.recoveryId,
    );
    if (
      !parsedRecoveryId ||
      parsedRecoveryId.stableLogicalHomeBindingHash !==
        plan.stableLogicalHomeBindingHash ||
      state.dependencies.verifyRecoveryBinding(
        readyRecovery.recoveryCapability,
        parsedRecoveryId?.token ?? readyRecovery.recoveryId,
        managementCapability,
        plan.stableLogicalHomeBindingHash,
      ) !== true
    ) {
      return settleInvalidRecoveryStart(
        state,
        plan,
        managementCapability,
        readyRecovery.recoveryCapability,
        parsedRecoveryId?.token ?? null,
        "docker_process_controller_recovery_identity_invalid",
      );
    }
    if (
      typeof registerRecoveryHandoff !== "function" ||
      registerRecoveryHandoff(
        readyRecovery.recoveryCapability,
        parsedRecoveryId.token,
      ) !== true
    ) {
      return settleInvalidRecoveryStart(
        state,
        plan,
        managementCapability,
        readyRecovery.recoveryCapability,
        parsedRecoveryId.token,
        "docker_process_controller_recovery_handoff_unavailable",
      );
    }
    return startRecordedAttempt(
      executor,
      plan,
      managementCapability,
      readyRecovery,
      state.dependencies,
      observeProviderStarted,
      commandRestriction,
    );
  };
  return proceed();
}

/**
 * Ready 回復を所有Snapshotへ変換する。
 *
 * @responsibility Ready 回復の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns Recovery | nullを返す。
 * @precondition 「value: unknown」がsnapshotReadyRecoveryの入力契約を満たす。
 * @postcondition snapshotReadyRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: snapshotReadyRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotReadyRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotReadyRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotReadyRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotReadyRecoveryは共有非同期状態を持たない同期処理である。
 */
function snapshotReadyRecovery(value: unknown): Recovery | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  try {
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).sort().join("\0") !==
        ["recoveryCapability", "recoveryId", "status"].sort().join("\0")
    )
      return null;
  } catch {
    return null;
  }
  const status = readOwnDataProperty(value, "status");
  const recoveryId = readOwnDataProperty(value, "recoveryId");
  const recoveryCapability = readOwnDataProperty(value, "recoveryCapability");
  return status === "ready" &&
    typeof recoveryId === "string" &&
    recoveryCapability !== null &&
    typeof recoveryCapability === "object"
    ? Object.freeze({ status, recoveryId, recoveryCapability })
    : null;
}

/**
 * Blocked 回復 With Exact Idを所有Snapshotへ変換する。
 *
 * @responsibility Blocked 回復 With Exact Idの取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown、expectedStableLogicalHomeBindingHash: string
 * @returns snapshotBlockedRecoveryWithExactIdの計算結果を返す。
 * @precondition 「value: unknown、expectedStableLogicalHomeBindingHash: string」がsnapshotBlockedRecoveryWithExactIdの入力契約を満たす。
 * @postcondition snapshotBlockedRecoveryWithExactIdの責務を完了した結果だけを返す。
 * @effect N/A: snapshotBlockedRecoveryWithExactIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotBlockedRecoveryWithExactIdは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotBlockedRecoveryWithExactIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security snapshotBlockedRecoveryWithExactIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotBlockedRecoveryWithExactIdは共有非同期状態を持たない同期処理である。
 */
function snapshotBlockedRecoveryWithExactId(
  value: unknown,
  expectedStableLogicalHomeBindingHash: string,
) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  if (utilTypes.isProxy(value)) return null;
  let hasOwner = false;
  try {
    const keys = Object.keys(value).sort().join("\0");
    hasOwner =
      keys ===
      [
        "reason",
        "recoveryId",
        "status",
        "recoveryCapability",
        "manualRecoveryRequired",
      ]
        .sort()
        .join("\0");
    if (
      Object.getPrototypeOf(value) !== Object.prototype ||
      (keys !== ["reason", "recoveryId", "status"].sort().join("\0") &&
        !hasOwner)
    )
      return null;
  } catch {
    return null;
  }
  const status = readOwnDataProperty(value, "status");
  const reason = readOwnDataProperty(value, "reason");
  const recoveryId = resolveRecoveryReference(
    readOwnDataProperty(value, "recoveryId"),
  );
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  const capability = readOwnDataProperty(value, "recoveryCapability");
  if (
    hasOwner &&
    (!capability ||
      typeof capability !== "object" ||
      utilTypes.isProxy(capability) ||
      readOwnDataProperty(value, "manualRecoveryRequired") !== true)
  )
    return null;
  return status === "blocked" &&
    typeof reason === "string" &&
    recoveryId &&
    parsed?.stableLogicalHomeBindingHash ===
      expectedStableLogicalHomeBindingHash
    ? Object.freeze({
        status,
        reason,
        recoveryId,
        recoveryCapability: capability ?? null,
      })
    : null;
}

/** 有限試験だけの構成。製品の開始・取消・明示終了そのものを使用する。 */
export function createExecutorTestRuntime(
  isolation: IsolationRuntime,
  productionAuthority = false,
) {
  const state: Pick<RuntimeState, "controls"> = { controls: new WeakMap() };
  return Object.freeze({
    productionAuthority,
    start: (
      plan: AttemptPlan,
      management: unknown,
      reference: AttemptReference,
      callbacks: ExecutorCallbacks = {},
    ) => {
      try {
        return start(
          { ...state, isolation, callbacks },
          plan,
          management,
          reference,
        );
      } catch {
        return createStartResult({
          status: "blocked",
          reason: "docker_process_controller_start_failed_closed",
          recoveryId:
            parseDockerTaskRecoveryId(
              readOwnDataProperty(reference, "recoveryId"),
            )?.token ?? null,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
        });
      }
    },
    cancel: (control: unknown, management: unknown) =>
      cancel(state, control, management),
    abandon: (reference: unknown, management: unknown) =>
      abandon(state, reference, management),
  });
}

// 現行Hostの開始・在庫投影が返す有限理由だけを受ける。
// 旧保存方式のProducer不在理由を分類契約として保持しない。未知値は従来どおりunavailable。
const RECOVERY_START_REASON_CLASS = new Map<string, string>([
  [
    "docker_task_multiple_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  [
    "docker_task_recovery_inventory_available",
    "docker_process_controller_recovery_conflict",
  ],
  ...[
    "docker_task_recovery_home_lock_release_unconfirmed",
    "docker_task_recovery_host_lock_release_unconfirmed",
    "docker_task_runtime_state_lock_release_unconfirmed",
    "docker_task_recovery_begin_failed_closed",
    "docker_task_recovery_failed_closed",
  ].map(
    (reason) =>
      [
        reason,
        "docker_process_controller_recovery_observation_unknown",
      ] as const,
  ),
]);

/**
 * 技術結果の固定field集合を動的Propertyなしに捕捉する。
 * @responsibility 既存診断shapeの受理順序を変えず値を局所化する。
 * @trace ARCH-000008
 * @input 未検査値とこのModule内の固定Key集合。
 * @returns 凍結した浅い値又はnull。
 * @precondition 永続化・保存Schemaの判断は行わない。
 * @postcondition getter・Proxy・継承値を評価しない。
 * @effect N/A: 同期の検査のみ。
 * @failure 不正shape・取得不能はnull。
 * @invariant 観測不能を成功へ補完しない。
 * @boundary 結果・診断の内部捕捉。
 * @security 任意のfieldを公開結果へ混入させない。
 * @concurrency N/A: 共有状態なし。
 */
function snapshotRecoveryRecord<const K extends string>(
  value: unknown,
  allowedKeys: ReadonlySet<K>,
): Readonly<Record<K, unknown>> | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      utilTypes.isProxy(value) ||
      Array.isArray(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (
      keys.length !== allowedKeys.size ||
      keys.some((key) => typeof key !== "string" || !allowedKeys.has(key as K))
    )
      return null;
    const snapshot = Object.create(null) as Record<K, unknown>;
    for (const key of allowedKeys) {
      const descriptor = descriptors[key];
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        descriptor.get !== undefined ||
        descriptor.set !== undefined ||
        descriptor.enumerable !== true
      )
        return null;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/** 診断の未知値・余分な内容を拒否し、Authorityを伴わない値へ閉じる。 */
function inspectRecoveryStartFailureDiagnostic(
  raw: unknown,
): RecoveryStartFailureDiagnostic | null {
  const value = snapshotRecoveryRecord(raw, new Set(["stage", "recoveryId"]));
  if (
    !value ||
    !RECOVERY_START_FAILURE_STAGES.includes(
      value.stage as RecoveryStartFailureDiagnostic["stage"],
    ) ||
    (value.recoveryId !== null && !parseDockerTaskRecoveryId(value.recoveryId))
  )
    return null;
  return Object.freeze({
    stage: value.stage as RecoveryStartFailureDiagnostic["stage"],
    recoveryId: value.recoveryId as string | null,
  });
}

/**
 * public Docker 回復 Start Reasonを決定する。
 *
 * @responsibility public Docker 回復 Start Reasonの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input reason: unknown
 * @returns resolveRecoveryStartReasonの計算結果を返す。
 * @precondition 「reason: unknown」がresolveRecoveryStartReasonの入力契約を満たす。
 * @postcondition resolveRecoveryStartReasonの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryStartReasonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryStartReasonは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryStartReasonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryStartReasonはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryStartReasonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryStartReasonは共有非同期状態を持たない同期処理である。
 */
function resolveRecoveryStartReason(reason: unknown) {
  if (typeof reason === "string") {
    const classified = RECOVERY_START_REASON_CLASS.get(reason);
    if (classified) return classified;
  }
  return "docker_process_controller_recovery_unavailable";
}

/**
 * public Verified Docker 回復 Idを決定する。
 *
 * @responsibility public Verified Docker 回復 Idの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns resolveRecoveryReferenceの計算結果を返す。
 * @precondition 「value: unknown」がresolveRecoveryReferenceの入力契約を満たす。
 * @postcondition resolveRecoveryReferenceの責務を完了した結果だけを返す。
 * @effect N/A: resolveRecoveryReferenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resolveRecoveryReferenceは独自の失敗分岐を所有しない。
 * @invariant resolveRecoveryReferenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRecoveryReferenceはProcess内の同一Subsystemで完結する。
 * @security resolveRecoveryReferenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRecoveryReferenceは共有非同期状態を持たない同期処理である。
 */
function resolveRecoveryReference(value: unknown) {
  return parseDockerTaskRecoveryId(value)?.token ?? null;
}

/**
 * 一次失敗の固定診断だけを受理する。
 *
 * @responsibility 自由文や不整合な観測を検証記録へ搬送しない。
 * @trace ARCH-000004
 * @input value: JSONから取得した診断候補。
 * @returns nullまたは完全な固定診断ならtrue。
 * @precondition 値はJSON parserを通過している。
 * @postcondition 未知の項目、理由、例外分類を拒否する。
 * @effect N/A: 値の確認だけを行う。
 * @failure 不正値はfalseへ閉じる。
 * @invariant Handle、応答、記録の順序を逆転させない。
 * @boundary Runtime診断からE2Eの記録への搬送。
 * @security Path、秘密値や生出力を受理しない。
 * @concurrency N/A: 共有状態を変更しない。
 */
export function isPrimaryFailureDiagnostic(value: unknown): boolean {
  if (value === null) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const hasObservation = Object.hasOwn(record, "commandObservation");
  const hasAuthenticationStatus = Object.hasOwn(record, "authenticationStatus");
  const hasTurnCountDiagnostic = Object.hasOwn(record, "turnCountDiagnostic");
  const turnCount = record.turnCountDiagnostic as
    | Record<string, unknown>
    | undefined;
  const observation = record.commandObservation as
    | Record<string, unknown>
    | null
    | undefined;
  return (
    exactKeys(
      record,
      [
        "commandHandleObtained",
        "exceptionCode",
        "purpose",
        "reason",
        "receiptRecorded",
        "responseObserved",
        "stage",
        ...(hasObservation ? ["commandObservation"] : []),
        ...(hasAuthenticationStatus ? ["authenticationStatus"] : []),
        ...(hasTurnCountDiagnostic ? ["turnCountDiagnostic"] : []),
      ].sort(),
    ) &&
    (!hasObservation ||
      observation === null ||
      (observation !== undefined &&
        typeof observation === "object" &&
        exactKeys(observation, ["exitCode", "stderrBytes", "stdoutBytes"]) &&
        record.responseObserved === true &&
        (observation.exitCode === null ||
          (Number.isSafeInteger(observation.exitCode) &&
            Number(observation.exitCode) >= 0)) &&
        [observation.stdoutBytes, observation.stderrBytes].every(
          (v) => Number.isSafeInteger(v) && Number(v) >= 0,
        ))) &&
    (!hasAuthenticationStatus ||
      (record.purpose === "start_subscription_auth_probe_attached" &&
        ["execution_classification", "subscription_auth_verification"].includes(
          String(record.stage),
        ) &&
        record.responseObserved === true &&
        observation != null &&
        observation.exitCode !== null &&
        ["confirmed", "unconfirmed", "unknown"].includes(
          typeof record.authenticationStatus === "string"
            ? record.authenticationStatus
            : "",
        ))) &&
    (!hasTurnCountDiagnostic ||
      (record.purpose === "start_provider_attached" &&
        record.stage === "provider_result_normalization" &&
        record.reason === "workbench_ai_claude_turn_count_invalid" &&
        record.responseObserved === true &&
        observation?.exitCode === 0 &&
        turnCount != null &&
        typeof turnCount === "object" &&
        exactKeys(turnCount, ["numberText", "valueType"]) &&
        typeof turnCount.valueType === "string" &&
        [
          "missing",
          "null",
          "boolean",
          "number",
          "string",
          "array",
          "object",
        ].includes(turnCount.valueType) &&
        (turnCount.numberText === null ||
          (turnCount.valueType === "number" &&
            typeof turnCount.numberText === "string" &&
            turnCount.numberText.length <= 32 &&
            Number.isFinite(Number(turnCount.numberText)) &&
            String(Number(turnCount.numberText)) === turnCount.numberText &&
            (!Number.isSafeInteger(Number(turnCount.numberText)) ||
              Number(turnCount.numberText) < 1))))) &&
    (record.purpose === null ||
      (typeof record.purpose === "string" &&
        (PURPOSES as readonly string[]).includes(record.purpose))) &&
    typeof record.stage === "string" &&
    [
      "submission_record",
      "command_restriction",
      "command_start",
      "provider_start_observation",
      "command_wait",
      "execution_classification",
      "resource_receipt_record",
      "subscription_auth_verification",
      "provider_result_normalization",
    ].includes(record.stage) &&
    isAttemptFailureReason(record.reason) &&
    (record.exceptionCode === null ||
      (typeof record.exceptionCode === "string" &&
        [
          "unclassified_exception",
          "ENOENT",
          "EACCES",
          "EPERM",
          "ETIMEDOUT",
          "ECONNREFUSED",
          "EPIPE",
          "docker_effect_management_required",
          "docker_effect_plan_invalid",
          "docker_effect_plan_replaced",
          "docker_effect_command_not_owned",
          "docker_effect_platform_unsupported",
          "docker_effect_cli_untrusted",
          "docker_effect_cli_replaced",
          "docker_effect_path_invalid",
          "docker_effect_config_invalid",
          "docker_effect_config_replaced",
          "docker_effect_filesystem_identity_invalid",
          "owned_operation_management_binding_required",
          "owned_operation_unknown_child",
          "owned_operation_child_replaced",
          "owned_operation_mount_replaced",
        ].includes(record.exceptionCode))) &&
    typeof record.commandHandleObtained === "boolean" &&
    typeof record.responseObserved === "boolean" &&
    typeof record.receiptRecorded === "boolean" &&
    (record.responseObserved !== true ||
      record.commandHandleObtained === true) &&
    (record.receiptRecorded !== true ||
      (record.responseObserved === true &&
        typeof record.purpose === "string" &&
        record.purpose.startsWith("create_")))
  );
}

/**
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000015
 * @input value: Record<string, unknown>、keys: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: Record<string, unknown>、keys: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactKeysはProcess内の同一Subsystemで完結する。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  const actualKeys = Object.keys(value);
  return (
    actualKeys.length === keys.length &&
    keys.every((key) => actualKeys.includes(key))
  );
}
/**
 * 既存の単一Command検証を本番Session接続から分離する。
 * @responsibility 有限合成試験のCommand所属と正規構成を製品検査へ照合する。
 * @trace ARCH-000008
 * @input 試験の下位代役と一時領域の借用関数。
 * @returns 本番Session操作と試験専用の単一Command開始。
 * @effect 構築時は値だけ。単一Commandは渡された試験代役へ委譲する。
 * @boundary ./testing利用側のみ。通常Rootや製品の単一Command APIではない。
 */
export function bindIsolationRuntime(
  runtime: Omit<DockerIsolationRuntime, "acquireHomeLease">,
  borrowPaths: (managementCapability: object) => Readonly<{ tmp: string }>,
) {
  const bound = bindTestIsolationRuntime(runtime, borrowPaths);
  /** 同じ製品検査を通った構成だけを合成下位へ渡す。 */
  function project(
    plan: AttemptPlan,
    management: object,
  ): DockerIsolationRuntimePlan {
    const configuration = resolveValidatedPlan(
      plan,
      borrowPaths(management).tmp,
    );
    if (!configuration) throw new Error("docker_effect_plan_invalid");
    return Object.freeze({
      identity: planIdentity(plan),
      configuration,
      stdin: plan.providerInput,
    });
  }
  /** コピーされたCommandや別用途を代役に渡さない。 */
  function startCommand(
    command: DockerIsolationCommand,
    plan: AttemptPlan,
    managementCapability: unknown,
  ) {
    if (!managementCapability || typeof managementCapability !== "object")
      throw new Error("docker_effect_management_required");
    const expected = plan.commands.find(
      (candidate) => candidate.purpose === command.purpose,
    );
    if (!expected || expected !== command)
      throw new Error("docker_effect_command_not_owned");
    return runtime.startCommand(
      expected.purpose as DockerIsolationCommand["purpose"],
      project(plan, managementCapability),
      managementCapability,
    );
  }

  return Object.freeze({ ...bound, startCommand });
}

/**
 * 検証用の固定隔離仕様を既存DIの環境記述と合わせて返す。
 * @responsibility 説明値の照合だけを支援し、実環境の成立や実行許可を証明しない。
 * @trace ARCH-000008
 * @input N/A: 実行引数なし。
 * @returns 有限検証が比較する固定契約記述。
 * @effect N/A: 定義値の取得のみ。Engine・Processを照会しない。
 * @boundary ./testing専用。通常の製品公開APIには含めない。
 */
export function describeIsolationContract() {
  const environment = describeDockerIsolationExecutionEnvironment();
  return Object.freeze({
    contract: "crdd-executor/isolation",
    contractRevision: 10,
    dockerCli: environment.dockerCli,
    engine: environment.engine,
    environment: environment.environment,
    commandPlan:
      "exact_nine_command_subscription_preflight_provider_probe_isolated_task_or_workbench_advice",
    taskInput: "runtime_owned_task_or_advice_stdin_only_not_docker_argv",
    cleanup:
      "durable_create_receipt_exact_docker_id_name_label_image_and_network_configuration_then_exact_id_and_name_absence",
    processTreeTermination: environment.processTreeTermination,
    callerCommandAllowed: false,
    providerEffectAllowed: true,
  });
}

/**
 * 外部AIを使わないPackage間試験の既存組立てを公開Rootから分離する。
 * @packageDocumentation
 * @responsibility 有限代役と内部検査だけを試験へ接続し製品の入口を増やさない。
 * @trace ARCH-000008
 * @boundary scripts/tests専用。実行許可や本番構成ではない。
 */

import { createHash } from "node:crypto";
import path from "node:path";
import { types } from "node:util";
import type {
  IsolationCallbacks,
  IsolationExecutionResult,
  ResourceSnapshot,
} from "../../docker-isolation/src/index.ts";
import type { DockerResourceCleanupObservation } from "../../docker-isolation/tests/support/cleanup.ts";
import { parseDockerTaskRecoveryId } from "../../docker-isolation/tests/support/cleanup.ts";
import type {
  DockerCommandSession,
  DockerExecutionCallbacks,
  DockerIsolationCommand,
  DockerSessionCleanup,
  DockerSessionCommandHandle,
} from "../../docker-isolation/tests/support/session.ts";
import { startDockerCommandSessionCandidate } from "../../docker-isolation/tests/support/session.ts";
import type { LockResult } from "../../lock/src/index.ts";
import {
  abandon,
  cancel,
  PURPOSES,
  prepareAttempt as prepareProductAttempt,
  readOwnDataProperty,
  resolveIsolationCommandInput as resolveProductConfiguration,
  resolveProviderExecution,
  start,
  isAttemptPlanValid as validateProductPlan,
} from "../src/lifecycle/attempt.ts";
import type {
  DockerIsolationCommandInput,
  DockerIsolationRuntimeOptions,
  HomeLease,
  ResourcePreparation,
} from "../src/lifecycle/types.ts";
import {
  type DockerIsolationRuntime,
  type DockerIsolationRuntimePlan,
  describeDockerIsolationExecutionEnvironment,
} from "../tests/support/isolation-execution.ts";
import {
  dockerIsolationCommandsMatch,
  planDockerIsolationCommands,
  projectDockerProxyConfiguration,
} from "../tests/support/isolation-plan.ts";

export { resolveProviderExecution } from "../src/lifecycle/attempt.ts";

import type {
  CompletionResult,
  ProcessStartedNotice,
  StartResult,
  AttemptDiagnosticNotice as TechnicalDiagnosticNotice,
} from "../src/index.ts";
import { createStartResult } from "../src/lifecycle/attempt.ts";
import type {
  AttemptReference,
  AttemptRequest,
  ExecutorCallbacks,
  AttemptPlan as ProductAttemptPlan,
  RuntimeState,
  AttemptTerminalObservation as TechnicalObservation,
} from "../src/lifecycle/types.ts";

/** 旧有限Session Oracleだけが保持するCommand投影。製品Planへ戻さない。 */
/** 旧有限試験の入力だけに使用する。製品API・実行契約ではない。 @trace ARCH-000008 */
export interface IsolationRuntime {
  acquireHomeLease(
    bindingHash: string,
    homeSourcePath: string,
  ): LockResult<HomeLease>;
  startExecution(
    plan: ProductAttemptPlan,
    recovery: object,
    management: object,
    hooks: DockerExecutionCallbacks,
  ): DockerCommandSession;
  cleanupOwnedResources(
    plan: ProductAttemptPlan,
    recovery: object,
    management: unknown,
  ): Promise<DockerSessionCleanup>;
  verifyCleanupOutcome(
    result: unknown,
    plan: ProductAttemptPlan,
    recovery: unknown,
    management: unknown,
  ): DockerSessionCleanup["resourceObservations"];
}

export type TestAttemptPlan = ProductAttemptPlan &
  Readonly<{ commands: readonly DockerIsolationCommand[] }>;
type AttemptPlan = TestAttemptPlan;

/** 確定RequestのTokenを有限Oracleの技術構成へ搬送する。 */
export function resolveIsolationCommandInput(
  plan: ProductAttemptPlan,
  temporary: string,
  token?: string,
  execution = resolveProviderExecution(plan),
): DockerIsolationCommandInput | null {
  const legacy =
    "commands" in plan
      ? projectDockerProxyConfiguration(
          (plan as TestAttemptPlan).commands,
          plan.proxyImageDigest,
        )
      : null;
  const captured = legacy?.token ?? plan.isolationRequest?.proxy?.token;
  if (typeof (token ?? captured) !== "string") return null;
  return resolveProductConfiguration(
    plan,
    temporary,
    (token ?? captured) as string,
    execution,
  );
}

/** 旧Command Oracleを新しい内部Requestの構築へ接続する。 */
export function prepareAttempt(
  random: Readonly<{ randomBytes: (size: number) => Buffer }>,
  request: AttemptRequest,
): TestAttemptPlan | null {
  const paths = {
    tmp: request.target.temporarySourcePath,
    management: path.join(
      request.target.temporarySourcePath,
      "..",
      "management",
    ),
  };
  const plan = prepareProductAttempt(random, request, paths);
  if (!plan) return null;
  const configuration = resolveIsolationCommandInput(plan, paths.tmp);
  const commands = configuration
    ? planDockerIsolationCommands(configuration)
    : null;
  return commands ? Object.freeze({ ...plan, commands }) : null;
}

/** 旧有限試験のCommand差反証。製品のRequest検査を代替しない。 */
export function isAttemptPlanValid(plan: TestAttemptPlan): boolean {
  return (
    validateProductPlan(plan) &&
    Array.isArray(plan.commands) &&
    plan.commands.length === PURPOSES.length &&
    plan.commands.every(
      (c, i) =>
        c.purpose === PURPOSES[i] &&
        Array.isArray(c.argv) &&
        c.argv.length > 0 &&
        c.argv.every(
          (v: unknown) =>
            typeof v === "string" && v.length > 0 && !v.includes("\0"),
        ),
    )
  );
}

/** 旧Session代役へ渡す構成だけを完全照合する。 */
export function resolveValidatedPlan(
  plan: TestAttemptPlan,
  temporary: string,
): DockerIsolationCommandInput | null {
  if (
    !isAttemptPlanValid(plan) ||
    plan.executionSelection.purpose !==
      (plan.operationMode === "workbench_advice" ? "advice" : "task")
  )
    return null;
  const configuration = resolveIsolationCommandInput(plan, temporary);
  return configuration &&
    dockerIsolationCommandsMatch(configuration, plan.commands)
    ? configuration
    : null;
}

/** 既存の試験Recovery相関を保存形式・Home排他から分離して維持する。 */
export function planIdentity(plan: TestAttemptPlan): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        operationId: plan.operationId,
        executionSelection: plan.executionSelection,
        operationMode: plan.operationMode,
        taskRole: plan.taskRole,
        taskWorkload: plan.taskWorkload,
        adviceAllowedReferences: plan.adviceAllowedReferences ?? null,
        ownershipLabel: plan.ownershipLabel,
        commands: plan.commands,
      }),
    )
    .digest("hex");
}

export const PREPARATION_LIFETIME_MS = 30_000;

/**
 * 上位の計画投影を同じ下位Runtimeへ結合する。
 *
 * @responsibility 元計画の所属と意味を検証し、技術入力・元結果だけを搬送する。
 * @trace ARCH-000008
 * @input runtime: 固定下位API。paths: 検証済みの固定所在。
 * @returns 元計画の開始・清掃・元結果照合操作。
 * @precondition 同じ下位Runtimeを操作の生涯で保持する。
 * @postcondition raw Process・Filesystem primitiveを上位へ戻さない。
 * @effect N/A: 結合時には外部資源を取得しない。
 * @failure 元計画不一致は開始前拒否し、下位清掃失敗は未確認として返す。
 * @invariant ModelやTaskの意味とDocker技術所有を混在させない。
 * @boundary 上位の意味検証と下位の固定実行API。
 * @security 元Owner・計画Hash・元結果を別Authorityへ読み替えない。
 * @concurrency 下位の終了待機を完了するまで元Runtimeを保持する。
 */
export function bindTestIsolationRuntime(
  runtime: Pick<
    DockerIsolationRuntime,
    "startExecution" | "cleanupOwnedResources" | "verifyCleanupOutcome"
  >,
  paths: DockerIsolationRuntimeOptions["paths"],
) {
  /**
   * 上位の検証済み計画をDocker技術入力へ投影する。
   *
   * @responsibility Model・Task・許可の相関を上位で検証し、技術値だけを下位へ渡す。
   * @trace ARCH-000008
   * @input plan: 元計画。
   * @returns 同じ計画のHash、固定技術構成、限定stdin。
   * @precondition 固定所在と元計画の完全照合が成立する。
   * @postcondition 上位のState・Packet・Authorityを下位へ渡さない。
   * @effect 固定所在と既存配布物定義を投影する。Docker要求は発行しない。
   * @failure 所在不明・不正計画・構成不能では例外で停止する。
   * @invariant 元のHashを新しい実行許可へ昇格しない。
   * @boundary Executor内部の試行構成とDocker Isolationの実行入力。
   * @security Secretは限定stdinとContainer内payloadだけへ搬送し、診断しない。
   * @concurrency 同じ固定所在を搬送し、DIが元Directory実体を各要求前に再照合する。
   */
  function project(plan: AttemptPlan): DockerIsolationRuntimePlan {
    const configuration = resolveValidatedPlan(plan, paths.tmp);
    if (!configuration) throw new Error("docker_effect_plan_invalid");
    return Object.freeze({
      identity: planIdentity(plan),
      configuration,
      stdin: plan.providerInput,
    });
  }

  /**
   * 同じ計画の資源回収を技術Ownerへ委譲する。
   *
   * @responsibility 元の相関とReceipt Ownerを維持し、清掃結果を上書きしない。
   * @trace ARCH-000008
   * @input plan、recoveryCapability、managementCapability: 元の計画とOwner。
   * @returns 技術Ownerの元清掃結果、または明示未確認。
   * @precondition 同じ計画と回復Ownerを用いる。
   * @postcondition 観測不能を不存在や成功へ変換しない。
   * @effect 所有Process・Docker資源の回収を下位へ委譲する。
   * @failure 投影不能・清掃例外は明示未確認として返す。
   * @invariant 名前だけの削除や過去unknownの成功化を追加しない。
   * @boundary 上位相関と下位の資源終端の間。
   * @security 回復Identityや根拠から新しいAuthorityを作らない。
   * @concurrency 下位の終了待機と清掃観測を待つ。
   */
  async function cleanupOwnedResources(
    plan: AttemptPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) {
    try {
      if (!managementCapability || typeof managementCapability !== "object")
        throw new Error("docker_effect_management_required");
      return await runtime.cleanupOwnedResources(
        project(plan),
        recoveryCapability,
        managementCapability,
        null,
      );
    } catch {
      return Object.freeze({
        confirmed: false,
        processTreeTerminated: false,
        containersAbsent: false,
        networksAbsent: false,
        resourceObservations: null,
      });
    }
  }

  /**
   * 下位の元清掃結果を上位の元計画へ相関する。
   *
   * @responsibility 完了後の所在再取得を要求せず、元結果と元Hashを照合する。
   * @trace ARCH-000008
   * @input result、plan、recoveryCapability、managementCapability: 元結果と対象相関。
   * @returns 元結果の五資源観測。不一致・不明はnull。
   * @precondition 同じ下位Runtimeが返した結果objectを使う。
   * @postcondition コピー・別操作・別計画を拒否する。
   * @effect N/A: HashとProcess内元結果の照合だけで外部操作を発行しない。
   * @failure 元計画の取込み失敗・相関不一致はnull。
   * @invariant 表示・任意保存・所在清掃後のPathを完了条件にしない。
   * @boundary 技術清掃結果から上位保存Ownerへの境界。
   * @security 成功booleanだけをLease解放や処置許可にしない。
   * @concurrency N/A: 同期照合で追加待機を作らない。
   */
  function verifyCleanupOutcome(
    result: unknown,
    plan: AttemptPlan,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) {
    try {
      return runtime.verifyCleanupOutcome(
        result,
        planIdentity(plan),
        recoveryCapability,
        managementCapability,
      );
    } catch {
      return null;
    }
  }

  /**
   * 上位の元計画を一回の下位Sessionへ接続する。
   * @responsibility Task・許可の投影だけを行い、技術反復を下位へ委譲する。
   * @trace ARCH-000008
   * @input plan、recoveryCapability、managementCapability、hooks: 元相関と有限接続。
   * @returns 下位の元cancel／completion。
   * @precondition 同じOwnerと上位計画を用いる。
   * @postcondition raw HandleやOS手順を返さない。
   * @effect 固定Runtimeへ実行・取消・回収を委譲する。
   * @failure 投影不正は要求前に例外で停止する。
   * @invariant 新Authority・Store・回復管理を作らない。
   * @boundary 上位計画の意味と下位の技術生涯。
   * @security 任意primitiveを本番入口へ公開しない。
   * @concurrency 実行開始前に不透明cancelを受け取る。
   */
  function startExecution(
    plan: AttemptPlan,
    recoveryCapability: object,
    managementCapability: object,
    hooks: DockerExecutionCallbacks,
  ) {
    return runtime.startExecution(
      project(plan),
      recoveryCapability,
      managementCapability,
      hooks,
    );
  }

  return Object.freeze({
    startExecution,
    cleanupOwnedResources,
    verifyCleanupOutcome,
  });
}
export { isAttemptFailureReason } from "../src/lifecycle/attempt.ts";
export {
  projectAttemptResult,
  projectAttemptStartResult,
} from "../tests/support/result-validation.ts";

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

type RecordedAttemptResult = CompletionResult<"attempt"> &
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
  completeCleanup: (input: AttemptCleanupInput) => ResourceCleanupResult;
  markResourceSubmission?: (
    recoveryCapability: object,
    purpose: string,
    resources: ResourcePreparation,
  ) => boolean;
  recordProviderSubmission?: (recoveryCapability: object) => boolean;
  recordResourceNotIssued?: (
    recoveryCapability: object,
    purpose: string,
    resources: ResourcePreparation,
  ) => boolean;
  recordResourceReceipt?: (
    recoveryCapability: object,
    purpose: string,
    dockerId: string,
    resources: ResourcePreparation,
    source?: "receipt" | "identified",
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
  observations: TechnicalObservation["resources"];
  resourceSnapshot: TechnicalObservation["resourceSnapshot"];
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
  acquireHomeLease: (
    bindingHash: string,
    homeSourcePath: string,
  ) => LockResult<HomeLease>;
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

type ResourceCleanupResult = Readonly<{
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
    observations: TechnicalObservation["resources"],
    snapshot: TechnicalObservation["resourceSnapshot"],
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
      import("../src/lifecycle/types.ts").AttemptStartResult,
      { status: "started" }
    >
  | (Omit<
      Extract<
        import("../src/lifecycle/types.ts").AttemptStartResult,
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
        ((sourcePlan, recovery, management, hooks) => {
          const plan = sourcePlan as TestAttemptPlan;
          return startDockerCommandSessionCandidate(
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
          );
        }),
      verifyCleanupOutcome: (result, plan, recovery, management) =>
        dependencies.verifyCleanupOutcome
          ? dependencies.verifyCleanupOutcome(
              result,
              plan as TestAttemptPlan,
              recovery,
              management,
            )
          : ((result as DockerSessionCleanup).resourceObservations ?? null),
      acquireHomeLease:
        dependencies.acquireHomeLease ??
        (() =>
          Object.freeze({
            status: "acquired",
            lock: Object.freeze({
              // この有限代役は実OS Lockを取得せず、生存中の試験Leaseだけを表す。
              assertLive: () => true,
              release: () => {
                if (!context || !dependencies.verifyHomeLeaseRelease)
                  return true;
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
            }),
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
      const candidate = dependencies.consumePreparedPlan(prepared, management);
      const resolved = candidate ? resolveProviderExecution(candidate) : null;
      const plan =
        candidate && resolved
          ? candidate.providerPlan?.status === "ready" &&
            candidate.providerPlan.plan.provider === candidate.provider &&
            candidate.providerPlan.plan.purpose === resolved.purpose &&
            candidate.providerPlan.plan.resultContext.taskRole ===
              resolved.resultContext.taskRole
            ? candidate
            : Object.freeze({
                ...candidate,
                providerPlan: Object.freeze({
                  status: "ready" as const,
                  plan: resolved,
                  error: null,
                }),
              })
          : null;
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
): ResourceCleanupResult {
  const { mountLeaseReleased, homeLeaseReleased } = input;
  let recoveryCompleted = false;
  let recoveryFinalizationCapability: object | null = null;
  try {
    const absence: unknown =
      dependencies.recordDockerAbsence?.(
        input.recoveryCapability,
        input.observations,
        input.resourceSnapshot,
      ) ?? true;
    if (types.isPromise(absence)) void absence.catch(() => {});
    if (absence !== true) throw Error("synthetic_absence_unconfirmed");
    const mount = input.mountCompletion;
    if (mountLeaseReleased && mount) {
      const receipt: unknown =
        dependencies.recordMountCompletion?.(input.recoveryCapability, mount) ??
        true;
      if (types.isPromise(receipt)) void receipt.catch(() => {});
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
    types.isProxy(restriction) ||
    types.isAsyncFunction(restriction)
  )
    return false;
  try {
    const result: unknown = restriction(purpose);
    if (types.isPromise(result)) {
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
      callbacks?: ExecutorCallbacks<"attempt">,
    ): StartResult<"attempt">;
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
  let cleanup: ResourceCleanupResult = {
    mountLeaseReleased: false,
    homeLeaseReleased: false,
    recoveryCompleted: false,
    recoveryFinalizationCapability: null,
  };
  let terminalObservation: TechnicalObservation | null = null;
  function requireRecorded(value: unknown): void {
    if (types.isPromise(value)) void value.catch(() => {});
    if (value !== true) throw Error("record_unconfirmed");
  }
  const callbacks: ExecutorCallbacks<"attempt"> = {
    onCommandSubmitting: (purpose, resources) => {
      if (!commandRestrictionAllows(restriction, purpose)) {
        restrictionRejected = true;
        throw Error("execution_restricted");
      }
      if (purpose.startsWith("create_") && operations.markResourceSubmission)
        requireRecorded(
          operations.markResourceSubmission(
            recovery.recoveryCapability,
            purpose,
            resources,
          ),
        );
    },
    onCommandNotIssued: (purpose, resources) => {
      if (operations.recordResourceNotIssued)
        requireRecorded(
          operations.recordResourceNotIssued(
            recovery.recoveryCapability,
            purpose,
            resources,
          ),
        );
    },
    onProviderSubmitting: () => {
      if (operations.recordProviderSubmission)
        requireRecorded(
          operations.recordProviderSubmission(recovery.recoveryCapability),
        );
    },
    onResourceCreated: (purpose, id, resources) => {
      if (operations.recordResourceReceipt)
        requireRecorded(
          operations.recordResourceReceipt(
            recovery.recoveryCapability,
            purpose,
            id,
            resources,
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
        resourceSnapshot: observation.resourceSnapshot,
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
      callbacks?: ExecutorCallbacks<"attempt">,
    ): StartResult<"attempt">;
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
  if (types.isProxy(value)) return null;
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
      types.isProxy(capability) ||
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
      callbacks: ExecutorCallbacks<"attempt"> = {},
    ) => {
      try {
        return start(
          {
            ...state,
            ...bindLegacyTestIsolation(plan, management, reference, isolation),
            callbacks,
          },
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

/**
 * 既存の有限Session OracleをDIの型付き境界へ接続する試験専用変換。
 * @responsibility 欠測・unknownを成功へ補完せず、製品へ旧Session契約を戻さない。
 * @trace ERB-IT-004
 * @effect 試験が渡した代役だけ。実DIの実行・回収は呼ばない。
 */
export function bindLegacyTestIsolation(
  plan: ProductAttemptPlan,
  management: unknown,
  reference: AttemptReference,
  isolation: IsolationRuntime,
): Pick<
  RuntimeState,
  "acquireHomeLease" | "prepareIsolation" | "executeIsolation"
> {
  const request = plan.isolationRequest;
  const identities = new Map<string, string>();
  const submitted = new Set<string>();
  const notIssued = new Set<string>();
  const snapshot = (
    observations?: readonly DockerResourceCleanupObservation[] | null,
  ): ResourceSnapshot => ({
    resources: request.resources.map((resource) => {
      const observed = observations?.find((o) => o.purpose === resource.key);
      return {
        key: resource.key,
        identity: {
          kind: resource.kind,
          name: observed?.plannedResourceName ?? resource.name,
          ownershipLabel: resource.ownershipLabel,
          dockerId: observed
            ? observed.dockerId
            : (identities.get(resource.key) ?? null),
        },
        request: (observed ? observed.dockerId : identities.get(resource.key))
          ? "issued"
          : observed?.observation === "not_requested" ||
              notIssued.has(resource.key)
            ? "not_issued"
            : observed?.observation === "unknown" || submitted.has(resource.key)
              ? "unknown"
              : "not_issued",
        configuration: {
          image: null,
          command: null,
          environmentNames: null,
          mounts: null,
          networks: null,
          internal: null,
        },
      };
    }),
  });
  const step = (purpose: string) => {
    const found = request.steps.find((s) => s.key === purpose);
    if (!found) throw Error("test_isolation_step_missing");
    return found;
  };
  return {
    acquireHomeLease: isolation.acquireHomeLease,
    prepareIsolation: () => ({ resources: snapshot() }),
    executeIsolation: (_prepared, callbacks = {}) => {
      const hooks: DockerExecutionCallbacks = {
        onFailure: (failure) => {
          if (
            failure.stage === "command_wait" &&
            failure.kind === "threw" &&
            failure.purpose
          )
            callbacks.onObserved?.(step(failure.purpose), {
              observation: null,
              elapsedMs: 0,
              errorCode: "PROCESS_FAILURE",
              classification: { category: "deadline_exceeded" },
              exitClass: "not_observed",
            });
        },
        onCommandSubmitting: async (purpose) => {
          await callbacks.onSubmitting?.(step(purpose));
          if (purpose.startsWith("create_")) submitted.add(purpose);
        },
        onCommandNotIssued: async (purpose) => {
          if (purpose.startsWith("create_")) {
            submitted.delete(purpose);
            notIssued.add(purpose);
          }
          await callbacks.onNotIssued?.(step(purpose));
        },
        // 実DIはProvider予定をonSubmittingで通知する。旧Oracleの別通知は重複させない。
        onExecutionSubmitting() {},
        onResourceCreated: (purpose, id) => {
          identities.set(purpose, id);
          return callbacks.onCreated?.(
            { ...step(purpose), resource: purpose },
            snapshot(),
          );
        },
        onExecutionStarted: () =>
          callbacks.onStarted?.(step("start_provider_attached")),
        onCommandObserved: (purpose, observation, classification) => {
          const status = observation?.status;
          const exitClass = observation?.signal
            ? "signal"
            : status === 0
              ? "zero"
              : status === 1
                ? "one"
                : status === 126
                  ? "one_two_six"
                  : status === 127
                    ? "one_two_seven"
                    : typeof status === "number"
                      ? "other_nonzero"
                      : "not_observed";
          callbacks.onObserved?.(step(purpose), {
            observation,
            classification,
            exitClass,
            elapsedMs: 0,
            errorCode: null,
          });
        },
        onCommandCompleted: (purpose, observation) => {
          callbacks.onCompleted?.(step(purpose), {
            observation,
            classification: {
              category: "completed",
              stdoutBytes: Buffer.byteLength(observation.stdout),
              stderrBytes: Buffer.byteLength(observation.stderr),
            },
            exitClass: observation.status === 0 ? "zero" : "not_observed",
            elapsedMs: 0,
            errorCode: null,
          });
        },
      };
      const session = isolation.startExecution(
        plan,
        reference.recoveryCapability,
        management as object,
        hooks,
      );
      return {
        cancel: session.cancel,
        completion: session.completion.then(
          (result): IsolationExecutionResult => {
            const failure = result.failure;
            const notifications: Partial<
              Record<keyof DockerExecutionCallbacks, keyof IsolationCallbacks>
            > = {
              onCommandSubmitting: "onSubmitting",
              onCommandNotIssued: "onNotIssued",
              onExecutionSubmitting: "onSubmitting",
              onResourceCreated: "onCreated",
              onExecutionStarted: "onStarted",
              onCommandObserved: "onObserved",
              onCommandCompleted: "onCompleted",
            };
            const resources = snapshot(result.resourceObservations);
            return {
              resources,
              cancellationRequested: result.cancellationRequested,
              processTerminationConfirmed:
                result.processTreeTerminationConfirmed,
              notificationDeliveryConfirmed:
                result.notificationDeliveryConfirmed,
              callbackRegistrationReleased: result.callbackRegistrationReleased,
              failure: failure
                ? {
                    stepKey: failure.purpose,
                    stage:
                      failure.stage === "gate"
                        ? "notification"
                        : failure.stage === "command_start"
                          ? "start"
                          : "wait",
                    notification: failure.gate
                      ? (notifications[failure.gate] ?? null)
                      : null,
                    kind:
                      failure.kind === "rejected" ||
                      failure.kind === "invalid_plan"
                        ? "invalid_return"
                        : failure.kind,
                    reason: "test_session_failed",
                    exceptionCode: failure.exceptionCode,
                    commandHandleObtained: failure.commandHandleObtained,
                    responseObserved: failure.responseObserved,
                  }
                : null,
              cleanup: {
                confirmed: result.cleanup.confirmed,
                configCleanupConfirmed: result.cleanup.confirmed,
                observations: resources.resources.map((resource) => ({
                  key: resource.key,
                  observation:
                    result.resourceObservations?.find(
                      (o) => o.purpose === resource.key,
                    )?.observation ?? "unknown",
                })),
              },
            };
          },
        ),
      };
    },
  };
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
      types.isProxy(value) ||
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
  paths: DockerIsolationRuntimeOptions["paths"],
) {
  const bound = bindTestIsolationRuntime(runtime, paths);
  /** 同じ製品検査を通った構成だけを合成下位へ渡す。 */
  function project(plan: AttemptPlan): DockerIsolationRuntimePlan {
    const configuration = resolveValidatedPlan(plan, paths.tmp);
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
      project(plan),
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
    processTermination: environment.processTermination,
    callerCommandAllowed: false,
    providerEffectAllowed: true,
  });
}

/**
 * 単発AI実行の開始・取消・通知・完了を調整する。
 *
 * @responsibility 元のRuntimeと状態実体を保ち、隔離実行と結果受領のLifecycleを収束させる。
 * @trace ARCH-000008
 */

import {
  readRuntimeOwnedCoordinatorStateSnapshot,
  checkpointRuntimeOwnedCoordinatorHost,
  checkpointRuntimeOwnedCoordinatorCleanup,
} from "../storage/settlement-store.ts";
import {
  borrowRuntimeOwnedCoordinatorStateRepository,
  borrowOwnedHostRecoverySnapshot,
  completeOwnedDockerSubmissionRecovery,
  beginOwnedDockerSubmissionRecovery,
  type BorrowedExecutionTarget,
  inspectBorrowedExecutionTarget,
  verifyRuntimeOwnedRepositoryOperation,
  type ProductionOperationFailure,
  createProductionOperationRoot,
  createRuntimeOwnedCoordinatorOperation,
  activateOwnedHostOperationGenerationLock,
  confirmOwnedHostOperationGenerationLockReadiness,
  observeOwnedHostOperationGenerationLoss,
  verifyOwnedOperationCleanupOutcome,
  cleanupOwnedOperationDirectoriesAsync,
  throwProductionOperationFailure,
  inspectRepositoryObjectFormatCandidate,
  productionOperationFailure,
  abandonOwnedHostOperationGenerationLock,
  bindRuntimeOwnedRepositoryOperation,
  bindRuntimeOwnedExecutionSnapshot,
  projectReviewerReadContent,
  captureExecutionChangeSnapshot,
  verifyExecutionChangeSnapshot,
  projectBorrowedExecutionResult,
  borrowOwnedDockerExecutionPaths,
} from "./operation.ts";
import type { CoordinatorStateTaskOperation } from "../storage/model.ts";
import { parseHostRecoveryToken } from "./result.ts";
import {
  type CoordinatorTaskRecoveryObligation,
  bindRuntimeOwnedDockerInitializationFailure,
  beginRuntimeOwnedDockerRecovery,
  abandonRuntimeOwnedDockerRecovery,
  verifyRuntimeOwnedDockerRecoveryBinding,
  completeRuntimeOwnedDockerRecovery,
  verifyRuntimeOwnedDockerHomeLeaseRelease,
  markRuntimeOwnedDockerResourceSubmission,
  recordRuntimeOwnedDockerProviderSubmission,
  recordRuntimeOwnedDockerResourceNotIssued,
  recordRuntimeOwnedDockerResourceReceipt,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedNormalMountCompletion,
  readRuntimeOwnedDockerProjectResult,
  evaluateManagedDockerCleanupEligibility,
  inspectRuntimeOwnedDockerTaskAdmission,
  finalizeRuntimeOwnedDockerRecovery,
  prepareRuntimeOwnedDockerHostCleanup,
  recordRuntimeOwnedDockerHostCleanupReceipt,
  inspectRuntimeOwnedDockerResourceReceipts,
} from "./recovery.ts";
import { createHash } from "node:crypto";
import {
  verifyRuntimeOwnedProviderHomeMountCompletion,
  completeRuntimeOwnedProviderHomeMount,
  consumeRuntimeOwnedProviderAuthority,
  issueRuntimeOwnedDelegationSelectionGrant,
  preflightRuntimeOwnedDelegationExecutionSlate,
  revokeRuntimeOwnedDelegationSelectionGrant,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
  issueRuntimeOwnedProviderHomeMountGrant,
  consumeRuntimeOwnedProviderHomeMountGrant,
  revokeRuntimeOwnedProviderHomeMountGrant,
} from "./authority.ts";
import {
  type CoordinatorWorkspaceResult,
  type CoordinatorTaskAttemptResult,
  ownDataValue,
  publicVerifiedDockerRecoveryId,
  type DockerProcessControllerFinalReason,
  PURPOSES,
  isDockerSetupCommandPurpose,
  SETUP_COMMAND_FAILURE_REASONS,
  type PrimaryFailureDiagnostic,
  normalizeProviderTaskStructuredResult,
  isDockerProcessControllerPublicCompletionReason,
  publicDockerRecoveryStartReason,
  type CoordinatorTaskPublicReason,
  COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS,
  projectDockerProcessControllerStartResult,
  projectCoordinatorTaskPublicReason,
  projectDockerProcessControllerCompletionResult,
  projectCurrentDockerAdmission,
  classifyCoordinatorTaskTerminalLifecycleState,
  projectDevelopmentTaskResultAfterOuterCleanup,
} from "./result.ts";
import { types as utilTypes } from "node:util";
import {
  type ProviderProcessStartedNotice,
  observeCoordinatorTaskCompletion,
  type ProviderBoundaryDiagnosticNotice,
  createProviderObservationOwner,
  registerRuntimeOwnedProviderTerminalObservation,
  registerRuntimeOwnedProviderSubmissionNotice,
  revokeRuntimeOwnedProviderSubmissionNotice,
} from "./observation.ts";
import {
  type CoordinatorTaskAttemptInput,
  snapshotCoordinatorTaskRequest,
} from "./request.ts";
import {
  describeDockerCommandSessionContract,
  type CommandObservation as CommandExecution,
  type DockerResourceCleanupObservation,
  type DockerExecutionHooks,
  startDockerCommandSessionCandidate,
  projectDockerExecutionBoundary,
  parseDockerTaskRecoveryId,
  dockerIsolationResourceIdentityIsValid,
  type classifyDockerCommandExecution,
  type classifyDockerProcessExit,
  classifyDockerCommandException,
  type DockerIsolationCommand,
  STDOUT_LIMIT_BYTES,
  STDERR_LIMIT_BYTES,
  createDockerIsolationRuntime,
  type DockerIsolationRuntimePlan,
  describeDockerIsolationExecutionEnvironment,
} from "../../../docker-isolation/src/index.ts";
import type { Writable } from "node:stream";
import {
  projectCodexExecutionBoundary,
  convertProviderError,
  evaluateProviderAuthentication,
  normalizeCodexStructuredResult,
  normalizeClaudeStructuredResult,
  parseProviderResult,
  CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS,
} from "../../../ai-adapter/src/index.ts";
import {
  getRuntimeOwnedProviderDockerAdapter,
  issueRuntimeOwnedProviderTaskPacket,
  revokeRuntimeOwnedProviderTaskPacket,
  type PreparedPlan as isolationExecutionPreparedPlan,
  validatePlan,
  resolveIsolationCommandInput,
  planIdentity,
  type Command as isolationExecutionCommand,
} from "./preparation.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../../../domain-model/src/index.ts";
import {
  poisonRuntimeProcessAfterCleanupUnknown,
  isRuntimeProcessPoisoned,
  isRuntimeProcessEffectBlocked,
} from "./process-safety-state.ts";
import { requestRuntimeOwnedExternalSendGrant } from "../decision/external-send-grant.ts";
import { resolveRuntimeOwnedExternalSendPolicy } from "../decision/external-send-policy.ts";
import {
  createDevelopmentExecutionTiming,
  writeDevelopmentMeasurementProgress,
  reserveRuntimeOwnedDevelopmentMeasurementTask,
} from "./diagnostics.ts";
import type {
  CoordinatorTaskResultDelivery,
  CoordinatorSingleTaskAttemptInput,
  CoordinatorSingleTaskResult,
} from "../task/types.ts";
import {
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
  COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
} from "../task/dispatch.ts";

/**
 * Host開始の予定保存・実遷移・結果保存を同じ操作へ接続する。
 *
 * @responsibility Docker要求前にHost開始を現在状態へ確定し、中断後も同じ予定へ再入場する。
 * @trace ARCH-000008
 * @input managementCapability: 同じ実Host Owner、recoveryId: 保存済み操作のexact参照。
 * @returns 保存・排他解放・Host要求と確認を分けた結果と同じ回復参照。
 * @precondition 開始Identityが確定済みで、Home Leaseは開始Ownerが保持している。
 * @postcondition 予定保存後だけHostを遷移させ、実token照合後だけ予定を解消する。
 * @effect 同じRepositoryのstate.jsonと、所有済みHost記録の開始遷移のみ。
 * @failure 別操作、実Host不一致、保存・解放不明、遷移例外は予定と回復参照を保持して停止する。
 * @invariant Host開始確認をDocker受理・Provider開始・回復完了へ昇格しない。
 * @boundary 本番開始Owner、現在状態Writerと同じHost Owner。
 * @security 任意Path・予測token・Caller supplied遷移本文を受け付けない。
 * @concurrency 同期Host遷移の前後を実Ownerで再観測し、各保存は元版照合する。
 */
export function beginRuntimeOwnedCoordinatorHostSubmission(
  managementCapability: unknown,
  recoveryId: unknown,
) {
  return transitionRuntimeOwnedCoordinatorHostSubmission(
    managementCapability,
    recoveryId,
    false,
  );
}

/**
 * 実Hostの開始または通常復帰を同じ予定保存経路で確定する。
 * @responsibility 処置前保存と実Ownerの前後観測を共通化する。
 * @trace ARCH-000008
 * @input managementCapability、recoveryId: 対象。isCompletingSubmission: 内部で固定した遷移方向。
 * @returns 保存と実遷移の確認を分けた結果。
 * @precondition 通常復帰の呼出し側は実清掃とMount結果を照合済み。
 * @postcondition 後継tokenを観測できた場合だけ予定を解消する。
 * @effect 同じ操作のHost記録とstate.jsonのみ。
 * @failure 不一致・保存不明・応答喪失は予定とexact参照を保持する。
 * @invariant 保存tokenからAuthorityを作らず、後継観測時に処置を再発行しない。
 * @boundary 同じHost OwnerとRepository内の状態保存。
 * @security 任意PathとCaller supplied予定を受け付けない。
 * @concurrency 既存Writer排他と同期Host前後観測を用いる。
 */
function transitionRuntimeOwnedCoordinatorHostSubmission(
  managementCapability: unknown,
  recoveryId: unknown,
  isCompletingSubmission: boolean,
) {
  const currentState = isCompletingSubmission
    ? "docker_submission_started"
    : "host_only";
  const nextState = isCompletingSubmission
    ? "host_only"
    : "docker_submission_started";
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const repository =
    borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
  const blocked = {
    status: "blocked" as const,
    reason: "coordinator_host_submission_invalid",
    revision: null as number | null,
    payloadSha256: null as string | null,
    recoveryIds: Object.freeze([] as string[]),
    recoveryId: typeof recoveryId === "string" ? recoveryId : null,
    filesystemEffectIssued: false,
    snapshotConfirmed: false,
    lockReleased: current.lockReleased,
    hostTransitionRequested: false,
    hostTransitionConfirmed: false,
  };
  if (!repository || current.status !== "completed" || !current.value)
    return Object.freeze({
      ...blocked,
      reason: current.status === "blocked" ? current.reason : blocked.reason,
    });
  const operation = current.value.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === recoveryId,
  );
  if (
    operation?.phase !== "executing" ||
    operation.host.cleanup !== "not_requested" ||
    JSON.parse(operation.identityJson).operationId !== repository.operationId
  )
    return Object.freeze(blocked);
  let saved = blocked;
  let hostTransitionRequested = false;
  try {
    const host = borrowOwnedHostRecoverySnapshot(managementCapability);
    let transition: {
      currentToken: string;
      expectedToken: string;
      currentState: string;
      nextState: string;
    };
    if (operation.host.pendingTransitionJson === null) {
      if (
        host.snapshot.record.state !== currentState ||
        host.snapshot.token !== operation.host.currentToken
      )
        return Object.freeze(blocked);
      const parsed = parseHostRecoveryToken(host.snapshot.token);
      const nextHash = createHash("sha256")
        .update(
          `${JSON.stringify({ ...host.snapshot.record, state: nextState })}\n`,
        )
        .digest("hex");
      const intent = {
        currentToken: host.snapshot.token,
        expectedToken: `host.${parsed.rootName}.${parsed.nonce}.${nextHash}`,
        rootName: parsed.rootName,
        nonce: parsed.nonce,
        currentState,
        nextState,
        recordBefore: host.snapshot.record,
      };
      transition = intent;
      const intentSaved = checkpointRuntimeOwnedCoordinatorHost(
        managementCapability,
        recoveryId,
        {
          ...operation.host,
          pendingTransitionJson: `${JSON.stringify(intent)}\n`,
        },
      );
      if (intentSaved.status !== "completed")
        return Object.freeze({ ...blocked, ...intentSaved });
      saved = { ...blocked, ...intentSaved, status: "blocked" };
    } else {
      transition = JSON.parse(operation.host.pendingTransitionJson);
      if (
        transition.currentState !== currentState ||
        transition.nextState !== nextState
      )
        return Object.freeze(blocked);
    }
    const before = borrowOwnedHostRecoverySnapshot(managementCapability);
    if (before.snapshot.token === transition.currentToken) {
      hostTransitionRequested = true;
      const observed = isCompletingSubmission
        ? completeOwnedDockerSubmissionRecovery(
            managementCapability,
            transition.currentToken,
          )
        : beginOwnedDockerSubmissionRecovery(
            managementCapability,
            repository.operationId,
          );
      if (observed !== transition.expectedToken)
        throw new Error("coordinator_host_submission_unconfirmed");
    } else if (before.snapshot.token !== transition.expectedToken) {
      throw new Error("coordinator_host_submission_unconfirmed");
    }
    const after = borrowOwnedHostRecoverySnapshot(managementCapability);
    if (
      after.snapshot.token !== transition.expectedToken ||
      after.snapshot.record.state !== nextState
    )
      throw new Error("coordinator_host_submission_unconfirmed");
    const confirmed = checkpointRuntimeOwnedCoordinatorHost(
      managementCapability,
      recoveryId,
      {
        currentToken: transition.expectedToken,
        pendingTransitionJson: null,
        cleanup: operation.host.cleanup,
      },
    );
    return Object.freeze({
      ...blocked,
      ...confirmed,
      hostTransitionRequested,
      hostTransitionConfirmed: confirmed.status === "completed",
    });
  } catch {
    return Object.freeze({
      ...saved,
      reason: "coordinator_host_submission_unconfirmed",
      snapshotConfirmed: false,
      filesystemEffectIssued:
        saved.filesystemEffectIssued || hostTransitionRequested,
      hostTransitionRequested,
    });
  }
}

/**
 * 実資源回収とMount完了を照合してHostを通常状態へ戻す。
 * @responsibility 最終Controller結果に依存せず実終了根拠をHost復帰へ接続する。
 * @trace ARCH-000008
 * @input managementCapability、recoveryId、plan、recoveryCapability: 元対象。cleanupOutcome、mountCompletion: 各Ownerの元結果。
 * @returns 現在状態保存とHost実遷移の確認結果。
 * @precondition 元Docker清掃とMount終了が同じ本番Ownerから返却されている。
 * @postcondition exact五資源の回収を保存し、Host後継観測後だけ復帰予定を解消する。
 * @effect 同じRepositoryのstate.jsonと所有Host記録だけ。
 * @failure コピー・別対象・欠測・ID不明・保存不明はHost復帰前に拒否する。
 * @invariant Home Lease解放・Host領域清掃・結果受理は別条件として維持する。
 * @boundary 本番清掃・Mount・Hostの各Ownerと同じ操作の保存。
 * @security 任意の成功booleanや保存値を実終了根拠にしない。
 * @concurrency 各保存を既存排他で確定し、Host再入場では元結果を再照合する。
 */
export function completeRuntimeOwnedCoordinatorHostSubmission(
  managementCapability: unknown,
  recoveryId: unknown,
  plan: Parameters<typeof verifyRuntimeOwnedDockerCleanupOutcome>[1] &
    Readonly<{ consumer: "coordinator_cli" | "orchestrator" | "workbench" }>,
  recoveryCapability: unknown,
  cleanupOutcome: unknown,
  mountCompletion: unknown,
) {
  let cleanupEffectIssued = false;
  const current =
    readRuntimeOwnedCoordinatorStateSnapshot(managementCapability);
  const blocked = Object.freeze({
    status: "blocked" as const,
    reason: "coordinator_host_completion_invalid",
    recoveryId: typeof recoveryId === "string" ? recoveryId : null,
    snapshotConfirmed: false,
    filesystemEffectIssued: false,
    lockReleased: current.lockReleased,
    hostTransitionRequested: false,
    hostTransitionConfirmed: false,
  });
  try {
    const operation = current.value?.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    const repository =
      borrowRuntimeOwnedCoordinatorStateRepository(managementCapability);
    if (
      current.status !== "completed" ||
      !operation ||
      !repository ||
      operation.phase !== "executing"
    )
      return blocked;
    const identity = JSON.parse(operation.identityJson);
    if (
      !plan ||
      plan.operationId !== repository.operationId ||
      identity.operationId !== plan.operationId ||
      [
        "provider",
        "consumer",
        "grantRef",
        "profileId",
        "stableLogicalHomeBindingHash",
        "providerHomeIdentityHash",
        "providerHomeProtectionHash",
        "localUserBindingHash",
        "ownershipLabel",
        "operationMode",
      ].some(
        (key) =>
          identity[key] !== (plan as unknown as Record<string, unknown>)[key],
      ) ||
      (
        [
          ["auth", "authContainerName"],
          ["provider", "providerContainerName"],
          ["proxy", "proxyContainerName"],
          ["internal", "internalNetworkName"],
          ["egress", "egressNetworkName"],
        ] as const
      ).some(
        ([key, field]) =>
          identity.resources[key] !==
          (plan as unknown as Record<string, unknown>)[field],
      ) ||
      identity.images.provider !== plan.providerImageDigest ||
      identity.images.proxy !== plan.proxyImageDigest
    )
      return blocked;
    const host = borrowOwnedHostRecoverySnapshot(managementCapability);
    if (operation.host.pendingTransitionJson === null) {
      if (
        host.snapshot.record.state !== "docker_submission_started" ||
        host.snapshot.token !== operation.host.currentToken
      )
        return blocked;
    } else {
      const pending = JSON.parse(operation.host.pendingTransitionJson);
      if (
        pending.currentState !== "docker_submission_started" ||
        pending.nextState !== "host_only"
      )
        return blocked;
    }
    const observations = verifyRuntimeOwnedDockerCleanupOutcome(
      cleanupOutcome,
      plan,
      recoveryCapability,
      managementCapability,
    );
    if (
      observations?.length !== 5 ||
      observations.some(
        (item) =>
          item.observation !== "not_requested" && item.observation !== "absent",
      ) ||
      !verifyRuntimeOwnedProviderHomeMountCompletion(
        mountCompletion,
        managementCapability,
        plan.activeMountCapability,
        plan.operationId,
        plan.stableLogicalHomeBindingHash,
      )
    )
      return blocked;
    const cleanup = cleanupOutcome as Readonly<Record<string, unknown>>;
    if (
      cleanup.confirmed !== true ||
      cleanup.processTreeTerminated !== true ||
      cleanup.containersAbsent !== true ||
      cleanup.networksAbsent !== true
    )
      return blocked;
    const saved = checkpointRuntimeOwnedCoordinatorCleanup(
      managementCapability,
      recoveryId,
      observations,
    );
    cleanupEffectIssued = saved.filesystemEffectIssued;
    if (saved.status !== "completed")
      return Object.freeze({ ...blocked, ...saved });
    const transition = transitionRuntimeOwnedCoordinatorHostSubmission(
      managementCapability,
      recoveryId,
      true,
    );
    return Object.freeze({
      ...transition,
      filesystemEffectIssued:
        cleanupEffectIssued || transition.filesystemEffectIssued,
    });
  } catch {
    return Object.freeze({
      ...blocked,
      filesystemEffectIssued: cleanupEffectIssued,
    });
  }
}

const STABLE_IDENTITY = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;

/**
 * Workspace観測の閉じた値をsnapshotする。
 * @responsibility 欠測・null・空配列と方式別の変更相関を維持する。
 * @trace ARCH-000004
 * @input 未検証の観測値。
 * @returns 凍結metadata又はnull。
 * @precondition N/A: unknownを受ける。
 * @postcondition 元値の変更を搬送しない。
 * @effect N/A: 値検査のみ。
 * @failure 不正・不整合・getterはnull。
 * @invariant Pathは相対値であり内容・Host所在を含まない。
 * @boundary Coordinator結果から認可済み上位。
 * @security Authorityを新設しない。
 * @concurrency 純粋同期処理。
 */
export function snapshotCoordinatorWorkspaceResult(
  raw: unknown,
): CoordinatorWorkspaceResult | null {
  try {
    if (!isPlainContainer(raw)) return null;
    const keys = [
      "workspaceId",
      "changedPaths",
      "canonicalRepositoryChanged",
      "changeAttribution",
      "workspaceDeletionIssued",
    ];
    if (
      Reflect.ownKeys(raw).length !== keys.length ||
      keys.some(
        (key) =>
          !Object.hasOwn(
            Object.getOwnPropertyDescriptor(raw, key) ?? {},
            "value",
          ),
      )
    )
      return null;
    const id = ownDataProperty(raw, "workspaceId");
    const paths = ownDataProperty(raw, "changedPaths");
    const changed = ownDataProperty(raw, "canonicalRepositoryChanged");
    if (
      (id !== null &&
        (typeof id !== "string" ||
          !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(id))) ||
      ownDataProperty(raw, "changeAttribution") !== "unattributed" ||
      ownDataProperty(raw, "workspaceDeletionIssued") !== false ||
      (changed !== null && typeof changed !== "boolean")
    )
      return null;
    let snapshot: readonly string[] | null = null;
    if (paths !== null) {
      if (
        !Array.isArray(paths) ||
        utilTypes.isProxy(paths) ||
        paths.length > 1000 ||
        Reflect.ownKeys(paths).length !== paths.length + 1
      )
        return null;
      const values: string[] = [];
      for (let index = 0; index < paths.length; index++) {
        const value = ownDataProperty(paths, String(index));
        if (
          typeof value !== "string" ||
          value.length === 0 ||
          Buffer.byteLength(value) > 1024 ||
          /[\\:\0\r\n]/u.test(value) ||
          value
            .split("/")
            .some((part) => part === "" || part === "." || part === "..")
        )
          return null;
        values.push(value);
      }
      if (new Set(values).size !== values.length) return null;
      snapshot = Object.freeze(values);
    }
    if (
      id === null
        ? changed !== (snapshot === null ? null : snapshot.length > 0)
        : changed !== false
    )
      return null;
    return Object.freeze({
      workspaceId: id,
      changedPaths: snapshot,
      canonicalRepositoryChanged: changed,
      changeAttribution: "unattributed",
      workspaceDeletionIssued: false,
    });
  } catch {
    return null;
  }
}

/**
 * Pre-effect rejections thrown by the current Single Task Runtime before any
 * provider, container or repository effect starts. Exported so a binding test
 * can reconcile this population against the actual throw sites of
 * coordinator-task-runtime.ts. Any other synchronous throw is treated as
 * effect-unknown and fails closed.
 */
export const COORDINATOR_TASK_PRE_EFFECT_REJECTIONS = Object.freeze([
  "coordinator_task_process_restart_required",
  "coordinator_task_runtime_cleanup_in_progress",
  "coordinator_task_workspace_target_invalid",
] as const);

const preEffectRejectionSet: ReadonlySet<string> = new Set(
  COORDINATOR_TASK_PRE_EFFECT_REJECTIONS,
);

/**
 * task-attempt-runtimeで使用するCoordinator Single Task Dependenciesの値契約を定義する。
 *
 * @responsibility Coordinator Single Task DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorTaskDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorTaskDependenciesの宣言は外部境界を開かない。
 * @security CoordinatorTaskDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CoordinatorTaskDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorTaskDependencies = Readonly<{
  startTask: (
    taskRequest: unknown,
    repositoryRoot: unknown,
    recoveryCorrelationId?: string,
    observeProviderStarted?: (
      notice: ProviderProcessStartedNotice,
    ) => boolean | Promise<boolean>,
    workspaceTarget?: BorrowedExecutionTarget,
  ) => unknown;
  cancelTask: (controlCapability: object) => unknown;
}>;

/**
 * resultを決定する。
 *
 * @responsibility resultの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input input: Readonly<{ operationId: string | null; status: "completed" | "blocked" | "cancelled"; reason: string; effectState: "no_effect" | "settled" | "unknown"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations?: readonly CoordinatorTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }>
 * @returns CoordinatorTaskAttemptResultを返す。
 * @precondition 「input: Readonly<{ operationId: string | null; status: "completed" | "blocked" | "cancelled"; reason: string; effectState: "no_effect" | "settled" | "unknown"; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations?: readonly CoordinatorTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }>」がresultの入力契約を満たす。
 * @postcondition resultの責務を完了した結果だけを返す。
 * @effect N/A: resultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resultは独自の失敗分岐を所有しない。
 * @invariant resultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security resultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resultは共有非同期状態を持たない同期処理である。
 */
function result(
  input: Readonly<{
    operationId: string | null;
    status: "completed" | "blocked" | "cancelled";
    reason: string;
    effectState: "no_effect" | "settled" | "unknown";
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    candidateId: string | null;
    recoveryIds: readonly string[];
    recoveryObligations?: readonly CoordinatorTaskRecoveryObligation[];
    executorProvider?: "codex" | "claude";
    workspaceResult?: CoordinatorWorkspaceResult;
  }>,
): CoordinatorTaskAttemptResult {
  return Object.freeze({
    contract: "crdd-coordinator/task-attempt",
    ...input,
    recoveryIds: Object.freeze([...input.recoveryIds]),
    recoveryObligations: Object.freeze([...(input.recoveryObligations ?? [])]),
  });
}

/**
 * rejected Without Effectを決定する。
 *
 * @responsibility rejected Without Effectの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input operationId: string | null、reason: string、processRestartRequired
 * @returns CoordinatorTaskAttemptResultを返す。
 * @precondition 「operationId: string | null、reason: string、processRestartRequired」がrejectedWithoutEffectの入力契約を満たす。
 * @postcondition rejectedWithoutEffectの責務を完了した結果だけを返す。
 * @effect N/A: rejectedWithoutEffectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: rejectedWithoutEffectは独自の失敗分岐を所有しない。
 * @invariant rejectedWithoutEffectは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security rejectedWithoutEffectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: rejectedWithoutEffectは共有非同期状態を持たない同期処理である。
 */
function rejectedWithoutEffect(
  operationId: string | null,
  reason: string,
  processRestartRequired = false,
): CoordinatorTaskAttemptResult {
  return result({
    operationId,
    status: "blocked",
    reason,
    effectState: "no_effect",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired,
    candidateId: null,
    recoveryIds: [],
  });
}

/**
 * failed Closed Unknownを決定する。
 *
 * @responsibility failed Closed Unknownの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input operationId: string | null、reason: string
 * @returns CoordinatorTaskAttemptResultを返す。
 * @precondition 「operationId: string | null、reason: string」がfailedClosedUnknownの入力契約を満たす。
 * @postcondition failedClosedUnknownの責務を完了した結果だけを返す。
 * @effect N/A: failedClosedUnknownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: failedClosedUnknownは独自の失敗分岐を所有しない。
 * @invariant failedClosedUnknownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security failedClosedUnknownはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: failedClosedUnknownは共有非同期状態を持たない同期処理である。
 */
function failedClosedUnknown(
  operationId: string | null,
  reason: string,
): CoordinatorTaskAttemptResult {
  return result({
    operationId,
    status: "blocked",
    reason,
    effectState: "unknown",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: false,
    candidateId: null,
    recoveryIds: [],
  });
}

/**
 * Textが有効か判定する。
 *
 * @responsibility Textの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum: number
 * @returns value is stringを返す。
 * @precondition 「value: unknown、maximum: number」がvalidTextの入力契約を満たす。
 * @postcondition validTextの責務を完了した結果だけを返す。
 * @effect N/A: validTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTextは独自の失敗分岐を所有しない。
 * @invariant validTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security validTextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validTextは共有非同期状態を持たない同期処理である。
 */
function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !value.includes("\0")
  );
}

/**
 * optional Identityを決定する。
 *
 * @responsibility optional Identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is string | nullを返す。
 * @precondition 「value: unknown」がoptionalIdentityの入力契約を満たす。
 * @postcondition optionalIdentityの責務を完了した結果だけを返す。
 * @effect N/A: optionalIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: optionalIdentityは独自の失敗分岐を所有しない。
 * @invariant optionalIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security optionalIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: optionalIdentityは共有非同期状態を持たない同期処理である。
 */
function optionalIdentity(value: unknown): value is string | null {
  return value === null || validText(value, 512);
}

/**
 * Opaque Capabilityかを判定する。
 *
 * @responsibility Opaque Capabilityの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisOpaqueCapabilityの入力契約を満たす。
 * @postcondition isOpaqueCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: isOpaqueCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isOpaqueCapabilityは独自の失敗分岐を所有しない。
 * @invariant isOpaqueCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isOpaqueCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isOpaqueCapabilityは共有非同期状態を持たない同期処理である。
 */
function isOpaqueCapability(value: unknown): value is object {
  return (
    typeof value === "object" && value !== null && !utilTypes.isProxy(value)
  );
}

/**
 * Read one own data property exactly once. Accessor properties, prototype
 *
 * @responsibility task-attempt-runtimeの入力からown Data Propertyを導く規則と結果境界を所有する。
 * @trace ARCH-000004
 * @input container: object、key: string
 * @returns unknownを返す。
 * @precondition 「container: object、key: string」がownDataPropertyの入力契約を満たす。
 * @postcondition ownDataPropertyの責務を完了した結果だけを返す。
 * @effect N/A: ownDataPropertyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownDataPropertyは独自の失敗分岐を所有しない。
 * @invariant ownDataPropertyは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security ownDataPropertyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownDataPropertyは共有非同期状態を持たない同期処理である。
 */
function ownDataProperty(container: object, key: string): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(container, key);
  if (
    !descriptor ||
    !Object.hasOwn(descriptor, "value") ||
    descriptor.get !== undefined ||
    descriptor.set !== undefined
  )
    return undefined;
  return descriptor.value;
}

/**
 * Plain Containerかを判定する。
 *
 * @responsibility Plain Containerの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is objectを返す。
 * @precondition 「value: unknown」がisPlainContainerの入力契約を満たす。
 * @postcondition isPlainContainerの責務を完了した結果だけを返す。
 * @effect N/A: isPlainContainerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isPlainContainerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isPlainContainerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isPlainContainerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlainContainerは共有非同期状態を持たない同期処理である。
 */
function isPlainContainer(value: unknown): value is object {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

/**
 * Started Taskを観測する。
 *
 * @responsibility Started Taskの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns Readonly<{ controlCapability: object; completion: Promise<unknown>; }> | nullを返す。
 * @precondition 「value: unknown」がinspectStartedTaskの入力契約を満たす。
 * @postcondition inspectStartedTaskの責務を完了した結果だけを返す。
 * @effect N/A: inspectStartedTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectStartedTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectStartedTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security inspectStartedTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency inspectStartedTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function inspectStartedTask(value: unknown): Readonly<{
  controlCapability: object;
  completion: Promise<unknown>;
}> | null {
  try {
    if (!isPlainContainer(value)) return null;
    const controlCapability = ownDataProperty(value, "controlCapability");
    const completion = ownDataProperty(value, "completion");
    if (
      ownDataProperty(value, "status") !== "started" ||
      !isOpaqueCapability(controlCapability) ||
      !(completion instanceof Promise)
    )
      return null;
    return Object.freeze({ controlCapability, completion });
  } catch {
    return null;
  }
}

/**
 * Completion 記録を観測する。
 *
 * @responsibility Completion 記録の観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns Readonly<{ status: "completed" | "blocked"; reason: string; cleanupConfirmed: boolean; manualRecoveryRequired: boolean; processRestartRequired: boolean; candidateId: string | null; recoveryIds: readonly string[]; recoveryObligations: readonly CoordinatorTaskRecoveryObligation[]; executorProvider?: "codex" | "claude"; }> | nullを返す。
 * @precondition 「value: unknown」がinspectCompletionRecordの入力契約を満たす。
 * @postcondition inspectCompletionRecordの責務を完了した結果だけを返す。
 * @effect N/A: inspectCompletionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectCompletionRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectCompletionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security inspectCompletionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectCompletionRecordは共有非同期状態を持たない同期処理である。
 */
function inspectCompletionRecord(value: unknown): Readonly<{
  status: "completed" | "blocked";
  reason: string;
  cleanupConfirmed: boolean;
  manualRecoveryRequired: boolean;
  processRestartRequired: boolean;
  candidateId: string | null;
  recoveryIds: readonly string[];
  recoveryObligations: readonly CoordinatorTaskRecoveryObligation[];
  executorProvider?: "codex" | "claude";
  workspaceResult?: CoordinatorWorkspaceResult;
}> | null {
  try {
    if (!isPlainContainer(value)) return null;
    const status = ownDataProperty(value, "status");
    const reason = ownDataProperty(value, "reason");
    const cleanupConfirmed = ownDataProperty(value, "cleanupConfirmed");
    const manualRecoveryRequired = ownDataProperty(
      value,
      "manualRecoveryRequired",
    );
    const processRestartRequired = ownDataProperty(
      value,
      "processRestartRequired",
    );
    const candidateId = ownDataProperty(value, "candidateId");
    const hostRecoveryId = ownDataProperty(value, "hostRecoveryId");
    const candidateRecoveryId = ownDataProperty(value, "candidateRecoveryId");
    const candidateStoreRecoveryId = ownDataProperty(
      value,
      "candidateStoreRecoveryId",
    );
    const rawDockerRecoveryIds = ownDataProperty(value, "dockerRecoveryIds");
    const executorProviderDescriptor = Object.getOwnPropertyDescriptor(
      value,
      "executorProvider",
    );
    if (
      executorProviderDescriptor !== undefined &&
      !Object.hasOwn(executorProviderDescriptor, "value")
    )
      return null;
    const executorProvider = ownDataProperty(value, "executorProvider");
    const hasWorkspaceResult = Object.hasOwn(value, "workspaceResult");
    const workspaceResult = hasWorkspaceResult
      ? snapshotCoordinatorWorkspaceResult(
          ownDataProperty(value, "workspaceResult"),
        )
      : undefined;
    if (
      hasWorkspaceResult &&
      (!workspaceResult ||
        ownDataProperty(value, "canonicalRepositoryChanged") !==
          workspaceResult.canonicalRepositoryChanged)
    )
      return null;
    // The current completion record never carries status "cancelled": effect-era
    // cancellation settles as "blocked" with a runtime-owned cancellation
    // reason, and accepting values the producer cannot emit would widen the
    // observation surface beyond the real contract.
    if (
      (status !== "completed" && status !== "blocked") ||
      !validText(reason, 256) ||
      typeof cleanupConfirmed !== "boolean" ||
      typeof manualRecoveryRequired !== "boolean" ||
      typeof processRestartRequired !== "boolean" ||
      !optionalIdentity(candidateId) ||
      !optionalIdentity(hostRecoveryId) ||
      !optionalIdentity(candidateRecoveryId) ||
      !optionalIdentity(candidateStoreRecoveryId) ||
      !Array.isArray(rawDockerRecoveryIds) ||
      utilTypes.isProxy(rawDockerRecoveryIds) ||
      rawDockerRecoveryIds.length > 128 ||
      (executorProvider !== undefined &&
        executorProvider !== "codex" &&
        executorProvider !== "claude" &&
        !(status === "blocked" && executorProvider === null)) ||
      (status === "completed" && cleanupConfirmed !== true)
    )
      return null;
    const dockerRecoveryIds: string[] = [];
    for (let index = 0; index < rawDockerRecoveryIds.length; index += 1) {
      const id = ownDataProperty(rawDockerRecoveryIds, String(index));
      if (!isTaskRecoveryIdentity(id)) return null;
      dockerRecoveryIds.push(id);
    }
    const recoveryObligations = [
      ...(typeof hostRecoveryId === "string"
        ? [{ kind: "host" as const, recoveryId: hostRecoveryId }]
        : []),
      ...dockerRecoveryIds.map((recoveryId) => ({
        kind: "docker" as const,
        recoveryId,
      })),
      ...(typeof candidateRecoveryId === "string"
        ? [{ kind: "candidate" as const, recoveryId: candidateRecoveryId }]
        : []),
      ...(typeof candidateStoreRecoveryId === "string"
        ? [
            {
              kind: "candidate_store" as const,
              recoveryId: candidateStoreRecoveryId,
            },
          ]
        : []),
    ];
    const identities = recoveryObligations.map(
      (entry) => `${entry.kind}\0${entry.recoveryId}`,
    );
    if (new Set(identities).size !== identities.length) return null;
    const recoveryIds = [
      ...new Set(recoveryObligations.map((entry) => entry.recoveryId)),
    ];
    if (recoveryIds.some((id) => !isTaskRecoveryIdentity(id))) return null;
    return Object.freeze({
      status,
      reason,
      cleanupConfirmed,
      manualRecoveryRequired,
      processRestartRequired,
      candidateId,
      recoveryIds: Object.freeze(recoveryIds),
      recoveryObligations: Object.freeze(
        recoveryObligations.map((entry) => Object.freeze(entry)),
      ),
      ...(executorProvider === "codex" || executorProvider === "claude"
        ? { executorProvider }
        : {}),
      ...(workspaceResult ? { workspaceResult } : {}),
    });
  } catch {
    return null;
  }
}

const SETTLED_RUNTIME_CANCELLATION_REASONS = new Set([
  "coordinator_task_cancelled_before_stage_start",
  "coordinator_task_cancelled_after_provider_cleanup",
  "coordinator_task_cancelled_during_operation_creation",
  "coordinator_task_cancelled_during_external_send_authorization",
  "coordinator_task_cancelled_before_candidate_capture",
  "coordinator_task_cancelled_before_independent_review",
]);

/**
 * 一つのTask試行を開始し、完了と取消を同じ制御参照へ接続する。
 *
 * @responsibility Coordinator Single Task Attemptの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: CoordinatorTaskDependencies、input: CoordinatorTaskAttemptInput
 * @returns Promise<CoordinatorTaskAttemptResult>を返す。
 * @precondition 「dependencies: CoordinatorTaskDependencies、input: CoordinatorTaskAttemptInput」がrunCoordinatorTaskAttemptの入力契約を満たす。
 * @postcondition runCoordinatorTaskAttemptの責務を完了した結果だけを返す。
 * @effect 注入されたTask入口で単一Taskを開始し、同じ制御参照へ取消要求を渡し得る。
 * @failure runCoordinatorTaskAttemptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCoordinatorTaskAttemptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security runCoordinatorTaskAttemptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runCoordinatorTaskAttemptは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runCoordinatorTaskAttempt(
  dependencies: CoordinatorTaskDependencies,
  input: CoordinatorTaskAttemptInput,
): Promise<CoordinatorTaskAttemptResult> {
  if (
    !input ||
    typeof input !== "object" ||
    !validText(input.operationId, 128) ||
    !STABLE_IDENTITY.test(input.operationId) ||
    !(input.cancellationSignal instanceof AbortSignal) ||
    (input.observeStarted !== undefined &&
      typeof input.observeStarted !== "function")
  )
    return rejectedWithoutEffect(null, "single_task_input_invalid");
  const operationId = input.operationId;
  const workspaceTarget =
    input.workspaceTarget === undefined
      ? undefined
      : inspectBorrowedExecutionTarget(
          input.repositoryRoot,
          input.workspaceTarget,
        );
  if (workspaceTarget === null)
    return rejectedWithoutEffect(
      operationId,
      "single_task_workspace_target_invalid",
    );
  if (input.cancellationSignal.aborted)
    return result({
      operationId,
      status: "cancelled",
      reason: "single_task_cancelled_before_effect",
      effectState: "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      candidateId: null,
      recoveryIds: [],
    });
  let rawStarted: unknown;
  let isNotificationClosed = false;
  let firstStartObservation: Promise<boolean> | null = null;
  let notificationFailed = false;
  const observeStarted = input.observeStarted;
  /**
   * 同じTaskの初回Executor開始だけを上位保存へ搬送する。
   *
   * @responsibility 呼出し登録による相関、初回通知の直列化と終端後拒否を所有する。
   * @trace ARCH-000004
   * @input Controllerが観測したProvider接続用Host Processの開始通知。
   * @returns 上位保存が成立した場合だけtrue。
   * @precondition 通知は同じTask開始時に登録したController経路から届く。
   * @postcondition Reviewerや是正Executorで上位状態を二重更新しない。
   * @effect 登録済みの上位開始確認を一回呼び出す。
   * @failure 不正通知、終端後通知、上位拒否・例外はfalse。
   * @invariant 下位OP識別子を上位Operation IDと同一視しない。
   * @boundary CoordinatorのProcess開始通知と利用側の状態保存。
   * @security 通知はAuthorityやAI要求受理の証明ではない。
   * @concurrency 同時・重複通知は同じ保存Promiseへ結合する。
   */
  const forwardStarted = (
    notice: ProviderProcessStartedNotice,
  ): Promise<boolean> => {
    if (isNotificationClosed || input.cancellationSignal.aborted)
      return Promise.resolve(false);
    if (
      notice?.event !== "coordinator_provider_process_started" ||
      !validText(notice.operationId, 128) ||
      !STABLE_IDENTITY.test(notice.operationId) ||
      (notice.provider !== "codex" && notice.provider !== "claude") ||
      (notice.taskRole !== "executor" && notice.taskRole !== "reviewer")
    ) {
      notificationFailed = true;
      return Promise.resolve(false);
    }
    if (notice.taskRole === "reviewer")
      return firstStartObservation ?? Promise.resolve(false);
    firstStartObservation ??= Promise.resolve().then(async () => {
      try {
        const isObserved = (await observeStarted?.()) === true;
        notificationFailed ||= !isObserved;
        return isObserved;
      } catch {
        notificationFailed = true;
        return false;
      }
    });
    return firstStartObservation;
  };
  try {
    rawStarted = dependencies.startTask(
      input.taskRequest,
      input.repositoryRoot,
      input.operationId,
      observeStarted === undefined ? undefined : forwardStarted,
      workspaceTarget,
    );
  } catch (error) {
    isNotificationClosed = true;
    const message = error instanceof Error ? error.message : "";
    if (preEffectRejectionSet.has(message))
      return rejectedWithoutEffect(
        operationId,
        message,
        message === "coordinator_task_process_restart_required",
      );
    return failedClosedUnknown(
      operationId,
      "single_task_start_observation_invalid",
    );
  }
  const started = inspectStartedTask(rawStarted);
  if (!started) {
    isNotificationClosed = true;
    return failedClosedUnknown(
      operationId,
      "single_task_start_observation_invalid",
    );
  }
  const observation = await observeCoordinatorTaskCompletion(
    started,
    dependencies.cancelTask,
    input.cancellationSignal,
  );
  isNotificationClosed = true;
  if (firstStartObservation !== null) await firstStartObservation;
  if (observation.status === "unknown")
    return failedClosedUnknown(
      operationId,
      "single_task_completion_observation_invalid",
    );
  const { rawCompletion, cancellationTransferred } = observation;
  const completion = inspectCompletionRecord(rawCompletion);
  if (!completion)
    return failedClosedUnknown(
      operationId,
      "single_task_completion_observation_invalid",
    );
  if (
    workspaceTarget !== undefined &&
    (!completion.workspaceResult ||
      completion.workspaceResult.workspaceId !== workspaceTarget.workspaceId)
  )
    return failedClosedUnknown(
      operationId,
      "single_task_workspace_result_invalid",
    );
  const isRecoveryOrCleanupUnknown =
    completion.cleanupConfirmed !== true ||
    completion.manualRecoveryRequired === true ||
    completion.recoveryIds.length > 0;
  const isSettledRuntimeCancellation =
    cancellationTransferred &&
    input.cancellationSignal.aborted &&
    completion.status === "blocked" &&
    completion.cleanupConfirmed === true &&
    completion.manualRecoveryRequired === false &&
    completion.processRestartRequired === false &&
    completion.recoveryIds.length === 0 &&
    SETTLED_RUNTIME_CANCELLATION_REASONS.has(completion.reason);
  const completionStatus = isSettledRuntimeCancellation
    ? "cancelled"
    : isRecoveryOrCleanupUnknown && completion.status === "completed"
      ? "blocked"
      : completion.status;
  const completionReason = isSettledRuntimeCancellation
    ? "single_task_cancelled_after_effect_cleanup"
    : isRecoveryOrCleanupUnknown && completion.status === "completed"
      ? "single_task_completion_cleanup_unknown"
      : completion.reason;
  const isMissingRequiredStart =
    observeStarted !== undefined && firstStartObservation === null;
  const isInvalidCompletedNotification =
    completionStatus === "completed" &&
    (notificationFailed || isMissingRequiredStart);
  return result({
    operationId,
    status: isInvalidCompletedNotification ? "blocked" : completionStatus,
    reason: isInvalidCompletedNotification
      ? notificationFailed
        ? "single_task_start_notification_failed"
        : "single_task_start_notification_missing"
      : completionReason,
    effectState: isRecoveryOrCleanupUnknown ? "unknown" : "settled",
    cleanupConfirmed: completion.cleanupConfirmed,
    manualRecoveryRequired: isRecoveryOrCleanupUnknown
      ? true
      : completion.manualRecoveryRequired,
    processRestartRequired: completion.processRestartRequired,
    candidateId: isInvalidCompletedNotification ? null : completion.candidateId,
    recoveryIds: completion.recoveryIds,
    recoveryObligations: completion.recoveryObligations,
    ...(completion.executorProvider === undefined
      ? {}
      : { executorProvider: completion.executorProvider }),
    ...(completion.workspaceResult
      ? { workspaceResult: completion.workspaceResult }
      : {}),
  });
}

/**
 * 回復参照の保存可能な文字列範囲を確認する。
 * @responsibility Task結果に含む回復参照の長さと文字集合を固定する。
 * @trace ARCH-000004
 * @input value: 未検証の回復参照。
 * @returns 保存可能な文字列ならtrue。
 * @precondition N/A: unknownを受け取る。
 * @postcondition 値を変更せず真偽を返す。
 * @effect N/A: 純粋な値検査。
 * @failure 不正値はfalse。
 * @invariant 回復参照の形式を実資源不存在の根拠にしない。
 * @boundary 完了結果と保存可能な回復参照。
 * @security Authorityや回復許可を発行しない。
 * @concurrency N/A: 同期処理。
 */
function isTaskRecoveryIdentity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

const DOCKER_PROCESS_CONTROLLER_CONTRACT =
  "crdd-coordinator/docker-process-controller";

const DOCKER_PROCESS_CONTROLLER_CONTRACT_REVISION = 31;

const {
  setupTimeoutMs: SETUP_TIMEOUT_MS,
  providerTimeoutMs: PROVIDER_TIMEOUT_MS,
  cancellationGraceMs: CANCELLATION_GRACE_MS,
} = describeDockerCommandSessionContract();

/**
 * docker-process-controllerで使用するCommandの値契約を定義する。
 *
 * @responsibility CommandのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Commandが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Commandで宣言した値と責務の対応を維持する。
 * @boundary N/A: Commandの宣言は外部境界を開かない。
 * @security CommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Commandの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Command = Readonly<{ purpose: string; argv: readonly string[] }>;

/**
 * docker-process-controllerで使用するPrepared Planの値契約を定義する。
 *
 * @responsibility Prepared PlanのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape PreparedPlanが表すProperty、識別子およびRelationを型として固定する。
 * @invariant PreparedPlanで宣言した値と責務の対応を維持する。
 * @boundary N/A: PreparedPlanの宣言は外部境界を開かない。
 * @security PreparedPlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility PreparedPlanの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type PreparedPlan = Readonly<{
  networkPolicy:
    | import("../../../docker-isolation/src/index.ts").DockerNetworkPolicy
    | null;
  provider: "codex" | "claude";
  operationId: string;
  consumer: "coordinator_cli" | "workbench" | "orchestrator";
  recoveryCorrelationId?: string | null;
  grantRef: string;
  profileId: string;
  activeMountCapability: object;
  authorityUseCapability: object;
  providerHomeSourcePath: string;
  providerHomeIdentityHash: string;
  providerHomeProtectionHash: string;
  localUserBindingHash: string;
  stableLogicalHomeBindingHash: string;
  authContainerName: string;
  providerContainerName: string;
  proxyContainerName: string;
  internalNetworkName: string;
  egressNetworkName: string;
  ownershipLabel: string;
  providerImageDigest: string;
  proxyImageDigest: string;
  selectionRecordId: string;
  subscriptionOffering: "chatgpt_subscription_oauth" | "claude_max";
  selectedModel: string;
  selectedEffort: "low" | "medium" | "high";
  selectedModelTier: string;
  operationMode: "boolean_probe" | "isolated_task" | "workbench_advice";
  taskRole: "executor" | "reviewer" | null;
  taskWorkload?: unknown;
  taskPacketRef: string | null;
  taskPacketHash: string | null;
  advicePacketRef?: string | null;
  advicePacketHash?: string | null;
  adviceCommandHash?: string | null;
  providerInput: string | null;
  workspaceSourcePath: string | null;
  workspaceProtection?: Readonly<{
    gitSourcePath: string;
    internalSourcePath: string;
  }>;
  workspaceMountMode: "read_write" | "read_only" | null;
  commands: readonly Command[];
}>;

/**
 * docker-process-controllerで使用するCommand Handleの値契約を定義する。
 *
 * @responsibility Command HandleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CommandHandleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CommandHandleで宣言した値と責務の対応を維持する。
 * @boundary N/A: CommandHandleの宣言は外部境界を開かない。
 * @security CommandHandleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CommandHandleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CommandHandle = Readonly<{
  started: (timeoutMs: number) => Promise<boolean>;
  wait: (timeoutMs: number) => Promise<CommandExecution | null>;
  terminateAndWait: (graceMs: number) => Promise<boolean>;
}>;

/**
 * docker-process-controllerで使用する回復の値契約を定義する。
 *
 * @responsibility 回復のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape Recoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Recoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: Recoveryの宣言は外部境界を開かない。
 * @security RecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Recoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Recovery = Readonly<{
  status: "ready";
  recoveryId: string;
  recoveryCapability: object;
}>;

/**
 * docker-process-controllerで使用するBlocked 回復の値契約を定義する。
 *
 * @responsibility Blocked 回復のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape BlockedRecoveryが表すProperty、識別子およびRelationを型として固定する。
 * @invariant BlockedRecoveryで宣言した値と責務の対応を維持する。
 * @boundary N/A: BlockedRecoveryの宣言は外部境界を開かない。
 * @security BlockedRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility BlockedRecoveryの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type BlockedRecovery = Readonly<{
  status: "blocked";
  reason?: string;
  recoveryId: string | null;
  manualRecoveryRequired?: boolean;
}>;

/**
 * docker-process-controllerで使用する清掃 Observationの値契約を定義する。
 *
 * @responsibility 清掃 ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape CleanupObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CleanupObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CleanupObservationの宣言は外部境界を開かない。
 * @security CleanupObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CleanupObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CleanupObservation = Readonly<{
  confirmed: boolean;
  processTreeTerminated: boolean;
  containersAbsent: boolean;
  networksAbsent: boolean;
  resourceObservations?: readonly DockerResourceCleanupObservation[] | null;
}>;

/**
 * docker-process-controllerで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeDependencies = Readonly<{
  effectExecutorAvailable: boolean;
  verifyRevision: (managementCapability: unknown) => unknown;
  consumePreparedPlan: (
    preparedCapability: unknown,
    managementCapability: unknown,
  ) => PreparedPlan | null;
  beginRecovery: (
    plan: PreparedPlan,
    managementCapability: unknown,
  ) => Recovery | BlockedRecovery | null;
  abandonRecovery?: (recoveryCapability: object) => boolean;
  bindInitializationFailure?: typeof bindRuntimeOwnedDockerInitializationFailure;
  verifyRecoveryBinding: (
    recoveryCapability: unknown,
    recoveryId: unknown,
    managementCapability: unknown,
    stableLogicalHomeBindingHash: unknown,
  ) => boolean;
  startCommand?: (
    command: Command,
    plan: PreparedPlan,
    managementCapability: unknown,
  ) => CommandHandle;
  startExecution?: (
    plan: PreparedPlan,
    recoveryCapability: object,
    managementCapability: object,
    hooks: DockerExecutionHooks,
  ) => Pick<
    ReturnType<typeof startDockerCommandSessionCandidate>,
    "cancel" | "completion"
  >;
  cleanupOwnedResources: (
    plan: PreparedPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) => Promise<CleanupObservation>;
  verifyCleanupOutcome?: (
    result: unknown,
    plan: PreparedPlan,
    recoveryCapability: unknown,
    managementCapability: unknown,
  ) => CleanupObservation["resourceObservations"];
  completeMount: (
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{ status: string }>;
  completeRecovery: (
    recoveryCapability: object,
    managementCapability: unknown,
    completion: Readonly<{
      plan: PreparedPlan;
      cleanupOutcome: CleanupObservation;
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
  markResourceSubmission?: (
    recoveryCapability: object,
    purpose: string,
  ) => boolean;
  recordProviderSubmission?: (
    recoveryCapability: object,
    notice: object,
  ) => boolean;
  recordResourceNotIssued?: (
    recoveryCapability: object,
    purpose: string,
    notice: object,
  ) => boolean;
  recordResourceReceipt?: (
    recoveryCapability: object,
    purpose: string,
    dockerId: string,
  ) => boolean;
  recordDockerAbsence?: (
    recoveryCapability: object,
    observations: CleanupObservation["resourceObservations"],
  ) => boolean;
  recordMountCompletion?: (
    recoveryCapability: object,
    mountCompletion: Readonly<{ status: string }>,
  ) => boolean;
  reportProviderProcessStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => Promise<boolean>;
  reportProviderBoundaryDiagnostic?: (
    notice: ProviderBoundaryDiagnosticNotice,
  ) => Promise<boolean>;
  consumeProviderAuthority: (
    useCapability: unknown,
    activeMountCapability: unknown,
    managementCapability: unknown,
  ) => Readonly<{
    operationId: string;
    provider: string;
    profileId: string;
    providerHomeMountGrantRef: string;
    runtimeAuthorityIssued: true;
    providerEffectAllowed: true;
  }> | null;
}>;

/**
 * docker-process-controllerで使用するExecution 記録の値契約を定義する。
 *
 * @responsibility Execution 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ExecutionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionRecordの宣言は外部境界を開かない。
 * @security ExecutionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExecutionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ExecutionRecord = {
  managementCapability: object;
  commandRestriction: unknown;
  observeProviderStarted:
    | ((notice: ProviderProcessStartedNotice) => boolean | Promise<boolean>)
    | null;
  cancellationRequested: boolean;
  cancelExecution:
    | (() => Promise<
        Readonly<{
          cancellationRequested: true;
          processTerminationObserved: boolean;
        }>
      >)
    | null;
  completion: Promise<ExecutionResult> | null;
};

/**
 * docker-process-controllerで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  controls: WeakMap<object, ExecutionRecord>;
  observations: Pick<
    ReturnType<typeof createProviderObservationOwner>,
    "registerTerminal" | "registerSubmission" | "revokeSubmission"
  >;
}>;

/**
 * docker-process-controllerで使用するExecution 結果の値契約を定義する。
 *
 * @responsibility Execution 結果のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ExecutionResultが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ExecutionResultで宣言した値と責務の対応を維持する。
 * @boundary N/A: ExecutionResultの宣言は外部境界を開かない。
 * @security ExecutionResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ExecutionResultの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ExecutionResult = ReturnType<typeof createFinalResult>;

/**
 * Runtime 所有 Lifecycle Notice Reporterを構築する。
 *
 * @responsibility Runtime 所有 Lifecycle Notice Reporterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input stream: Writable
 * @returns createRuntimeOwnedLifecycleNoticeReporterの計算結果を返す。
 * @precondition 「stream: Writable」がcreateRuntimeOwnedLifecycleNoticeReporterの入力契約を満たす。
 * @postcondition createRuntimeOwnedLifecycleNoticeReporterの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeOwnedLifecycleNoticeReporterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeOwnedLifecycleNoticeReporterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeOwnedLifecycleNoticeReporterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createRuntimeOwnedLifecycleNoticeReporterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createRuntimeOwnedLifecycleNoticeReporterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function createRuntimeOwnedLifecycleNoticeReporter(stream: Writable) {
  return (
    notice: ProviderProcessStartedNotice | ProviderBoundaryDiagnosticNotice,
  ): Promise<boolean> => {
    if (!stream.writable || stream.destroyed) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => settle(false), CANCELLATION_GRACE_MS);
      const settle = (isValue: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        stream.off("error", onFailure);
        stream.off("close", onFailure);
        resolve(isValue);
      };
      const onFailure = () => settle(false);
      stream.once("error", onFailure);
      stream.once("close", onFailure);
      try {
        stream.write(
          `[Coordinator lifecycle] ${JSON.stringify(notice)}\n`,
          "utf8",
          (error) => {
            if (error === undefined || error === null) settle(true);
          },
        );
      } catch {
        settle(false);
      }
    });
  };
}

/**
 * provider Boundary Configurationを決定する。
 *
 * @responsibility provider Boundary Configurationの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input plan: PreparedPlan
 * @returns Extract< ProviderBoundaryDiagnosticNotice, { event: "coordinator_provider_boundary_configured" } >を返す。
 * @precondition 「plan: PreparedPlan」がproviderBoundaryConfigurationの入力契約を満たす。
 * @postcondition providerBoundaryConfigurationの責務を完了した結果だけを返す。
 * @effect N/A: providerBoundaryConfigurationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: providerBoundaryConfigurationは独自の失敗分岐を所有しない。
 * @invariant providerBoundaryConfigurationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security providerBoundaryConfigurationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: providerBoundaryConfigurationは共有非同期状態を持たない同期処理である。
 */
function providerBoundaryConfiguration(
  plan: PreparedPlan,
): Extract<
  ProviderBoundaryDiagnosticNotice,
  { event: "coordinator_provider_boundary_configured" }
> {
  const docker = projectDockerExecutionBoundary(
    plan.commands,
    plan.providerImageDigest,
  );
  const codex =
    plan.provider === "codex"
      ? projectCodexExecutionBoundary(docker?.payloadArgv ?? [])
      : null;
  return Object.freeze({
    event: "coordinator_provider_boundary_configured" as const,
    taskRole: plan.taskRole,
    provider: plan.provider,
    operationId: plan.operationId,
    approvalModeConfigured: codex?.approvalModeConfigured ?? "not_applicable",
    sandboxModeConfigured: codex?.sandboxModeConfigured ?? "not_applicable",
    workspaceMountModeConfigured: plan.workspaceMountMode,
    networkPolicyHash: plan.networkPolicy?.policyHash ?? null,
    rootFilesystemReadOnlyConfigured:
      docker?.rootFilesystemReadOnlyConfigured ?? false,
    nonRootUserConfigured: docker?.nonRootUserConfigured ?? false,
    workdirConfigured: docker?.workdirConfigured ?? false,
  });
}

/**
 * Passive Boundary Diagnosticを診断結果として報告する。
 *
 * @responsibility Passive Boundary Diagnosticの公開field、相関Identity、機密を含めない結果境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、notice: ProviderBoundaryDiagnosticNotice
 * @returns N/A: reportPassiveBoundaryDiagnosticは戻り値を返さない。
 * @precondition 「state: RuntimeState、notice: ProviderBoundaryDiagnosticNotice」がreportPassiveBoundaryDiagnosticの入力契約を満たす。
 * @postcondition reportPassiveBoundaryDiagnosticの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: reportPassiveBoundaryDiagnosticは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure reportPassiveBoundaryDiagnosticは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant reportPassiveBoundaryDiagnosticは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security reportPassiveBoundaryDiagnosticはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reportPassiveBoundaryDiagnosticは共有非同期状態を持たない同期処理である。
 */
function reportPassiveBoundaryDiagnostic(
  state: RuntimeState,
  notice: ProviderBoundaryDiagnosticNotice,
) {
  try {
    const pending =
      state.dependencies.reportProviderBoundaryDiagnostic?.(notice);
    if (pending) void pending.catch(() => {});
  } catch {
    // Diagnostics cannot grant authority or change the operation result.
  }
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
  const status = ownDataValue(value, "status");
  const recoveryId = ownDataValue(value, "recoveryId");
  const recoveryCapability = ownDataValue(value, "recoveryCapability");
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
  const status = ownDataValue(value, "status");
  const reason = ownDataValue(value, "reason");
  const recoveryId = publicVerifiedDockerRecoveryId(
    ownDataValue(value, "recoveryId"),
  );
  const parsed = parseDockerTaskRecoveryId(recoveryId);
  const capability = ownDataValue(value, "recoveryCapability");
  if (
    hasOwner &&
    (!capability ||
      typeof capability !== "object" ||
      utilTypes.isProxy(capability) ||
      ownDataValue(value, "manualRecoveryRequired") !== true)
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

/**
 * Blocked Startを構築する。
 *
 * @responsibility Blocked Startの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input reason: string、preEffectCleanupConfirmed、recoveryId: string | null、lowerManualRecoveryRequired
 * @returns createBlockedStartの計算結果を返す。
 * @precondition 「reason: string、preEffectCleanupConfirmed、recoveryId: string | null、lowerManualRecoveryRequired」がcreateBlockedStartの入力契約を満たす。
 * @postcondition createBlockedStartの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedStartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedStartは独自の失敗分岐を所有しない。
 * @invariant createBlockedStartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createBlockedStartはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedStartは共有非同期状態を持たない同期処理である。
 */
function createBlockedStart(
  reason: string,
  preEffectCleanupConfirmed = false,
  recoveryId: string | null = null,
  lowerManualRecoveryRequired = false,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    controlCapability: null,
    completion: null,
    operationId: null,
    recoveryId,
    cleanupConfirmed: preEffectCleanupConfirmed,
    manualRecoveryRequired:
      lowerManualRecoveryRequired ||
      !preEffectCleanupConfirmed ||
      recoveryId !== null,
    dockerEffectStarted: false,
    providerRequestStarted: false,
    normalizedResult: null,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

/**
 * Invalid 回復 Startを終端状態へ確定する。
 *
 * @responsibility Invalid 回復 Startの確定条件、最終状態、未解決義務の境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、plan: PreparedPlan、managementCapability: object、recoveryCapability: unknown、recoveryId: string | null、reason: string
 * @returns settleInvalidRecoveryStartの計算結果を返す。
 * @precondition 「state: RuntimeState、plan: PreparedPlan、managementCapability: object、recoveryCapability: unknown、recoveryId: string | null、reason: string」がsettleInvalidRecoveryStartの入力契約を満たす。
 * @postcondition settleInvalidRecoveryStartの責務を完了した結果だけを返す。
 * @effect N/A: settleInvalidRecoveryStartは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure settleInvalidRecoveryStartは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant settleInvalidRecoveryStartは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security settleInvalidRecoveryStartはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: settleInvalidRecoveryStartは共有非同期状態を持たない同期処理である。
 */
function settleInvalidRecoveryStart(
  state: RuntimeState,
  plan: PreparedPlan,
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
  return createBlockedStart(reason, false, recoveryId, true);
}

/**
 * Final 結果を構築する。
 *
 * @responsibility Final 結果の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input status: "completed" | "blocked" | "cancelled"、reason: DockerProcessControllerFinalReason、plan: PreparedPlan、recoveryId: string、details: Readonly<{ providerRequestStarted: boolean; cancellationRequested: boolean; processTreeTerminationConfirmed: boolean; containersAbsent: boolean; networksAbsent: boolean; mountLeaseReleased: boolean; recoveryCompleted: boolean; resultSha256: string | null; resultBytes: number; normalizedResult: unknown | null; subscriptionAuthConfirmed: boolean; recoveryFinalizationCapability: object | null; }>
 * @returns createFinalResultの計算結果を返す。
 * @precondition 「status: "completed" | "blocked" | "cancelled"、reason: DockerProcessControllerFinalReason、plan: PreparedPlan、recoveryId: string、details: Readonly<{ providerRequestStarted: boolean; cancellationRequested: boolean; processTreeTerminationConfirmed: boolean; containersAbsent: boolean; networksAbsent: boolean; mountLeaseReleased: boolean; recoveryCompleted: boolean; resultSha256: string | null; resultBytes: number; normalizedResult: unknown | null; subscriptionAuthConfirmed: boolean; recoveryFinalizationCapability: object | null; }>」がcreateFinalResultの入力契約を満たす。
 * @postcondition createFinalResultの責務を完了した結果だけを返す。
 * @effect N/A: createFinalResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createFinalResultは独自の失敗分岐を所有しない。
 * @invariant createFinalResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createFinalResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createFinalResultは共有非同期状態を持たない同期処理である。
 */
function createFinalResult(
  status: "completed" | "blocked" | "cancelled",
  reason: DockerProcessControllerFinalReason,
  plan: PreparedPlan,
  recoveryId: string,
  details: Readonly<{
    providerRequestStarted: boolean;
    cancellationRequested: boolean;
    processTreeTerminationConfirmed: boolean;
    containersAbsent: boolean;
    networksAbsent: boolean;
    mountLeaseReleased: boolean;
    recoveryCompleted: boolean;
    resultSha256: string | null;
    resultBytes: number;
    normalizedResult: unknown | null;
    subscriptionAuthConfirmed: boolean;
    recoveryFinalizationCapability: object | null;
  }>,
) {
  const cleanupConfirmed =
    details.processTreeTerminationConfirmed &&
    details.containersAbsent &&
    details.networksAbsent &&
    details.mountLeaseReleased &&
    details.recoveryCompleted;
  return Object.freeze({
    status: cleanupConfirmed ? status : ("blocked" as const),
    reason: cleanupConfirmed
      ? reason
      : "docker_process_controller_cleanup_unconfirmed",
    operationId: plan.operationId,
    selectionRecordId: plan.selectionRecordId,
    recoveryId: cleanupConfirmed ? null : recoveryId,
    manualRecoveryRequired: !cleanupConfirmed,
    dockerEffectStarted: true,
    providerRequestStarted: details.providerRequestStarted,
    cancellationRequested: details.cancellationRequested,
    processTreeTerminationConfirmed: details.processTreeTerminationConfirmed,
    containersAbsent: details.containersAbsent,
    networksAbsent: details.networksAbsent,
    mountLeaseReleased: details.mountLeaseReleased,
    recoveryCompleted: details.recoveryCompleted,
    cleanupConfirmed,
    resultSha256:
      cleanupConfirmed && status === "completed" ? details.resultSha256 : null,
    resultBytes:
      cleanupConfirmed && status === "completed" ? details.resultBytes : 0,
    normalizedResult:
      cleanupConfirmed && status === "completed"
        ? details.normalizedResult
        : null,
    subscriptionAuthConfirmed: details.subscriptionAuthConfirmed,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    recoveryFinalizationCapability: cleanupConfirmed
      ? details.recoveryFinalizationCapability
      : null,
  });
}

/**
 * Plan Validかを判定する。
 *
 * @responsibility Plan Validの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000008
 * @input plan: PreparedPlan
 * @returns isPlanValidの計算結果を返す。
 * @precondition 「plan: PreparedPlan」がisPlanValidの入力契約を満たす。
 * @postcondition isPlanValidの責務を完了した結果だけを返す。
 * @effect N/A: isPlanValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isPlanValidは独自の失敗分岐を所有しない。
 * @invariant isPlanValidは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security isPlanValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isPlanValidは共有非同期状態を持たない同期処理である。
 */
function isPlanValid(plan: PreparedPlan) {
  const isTaskPlan = plan.operationMode === "isolated_task";
  const isAdvicePlan = plan.operationMode === "workbench_advice";
  return (
    (plan.provider === "codex" || plan.provider === "claude") &&
    (plan.consumer === "coordinator_cli" ||
      plan.consumer === "workbench" ||
      plan.consumer === "orchestrator") &&
    /^OP-[0-9]{6,}$/u.test(plan.operationId) &&
    (plan.recoveryCorrelationId == null ||
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(plan.recoveryCorrelationId)) &&
    /^PHMGRANT-[A-Z0-9-]{6,80}$/u.test(plan.grantRef) &&
    /^PROFILE-[0-9]{6,}$/u.test(plan.profileId) &&
    /^MODELSEL-[A-Z0-9-]{8,80}$/u.test(plan.selectionRecordId) &&
    plan.subscriptionOffering ===
      (plan.provider === "codex"
        ? "chatgpt_subscription_oauth"
        : "claude_max") &&
    plan.activeMountCapability !== null &&
    typeof plan.activeMountCapability === "object" &&
    plan.authorityUseCapability !== null &&
    typeof plan.authorityUseCapability === "object" &&
    (plan.operationMode === "boolean_probe" || isTaskPlan || isAdvicePlan) &&
    (isTaskPlan
      ? (plan.taskRole === "executor" || plan.taskRole === "reviewer") &&
        /^TASKPKT-[A-F0-9]{32}$/u.test(plan.taskPacketRef ?? "") &&
        /^[a-f0-9]{64}$/u.test(plan.taskPacketHash ?? "") &&
        typeof plan.providerInput === "string" &&
        plan.providerInput.length > 0 &&
        typeof plan.workspaceSourcePath === "string" &&
        plan.workspaceSourcePath.length > 0 &&
        plan.workspaceMountMode ===
          (plan.taskRole === "executor" ? "read_write" : "read_only")
      : isAdvicePlan
        ? plan.taskRole === null &&
          plan.taskPacketRef === null &&
          plan.taskPacketHash === null &&
          /^ADVICEPKT-[A-F0-9]{32}$/u.test(plan.advicePacketRef ?? "") &&
          /^[a-f0-9]{64}$/u.test(plan.advicePacketHash ?? "") &&
          /^[a-f0-9]{64}$/u.test(plan.adviceCommandHash ?? "") &&
          typeof plan.providerInput === "string" &&
          plan.providerInput.length > 0 &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null
        : plan.taskRole === null &&
          plan.taskPacketRef === null &&
          plan.taskPacketHash === null &&
          (plan.advicePacketRef ?? null) === null &&
          (plan.advicePacketHash ?? null) === null &&
          (plan.adviceCommandHash ?? null) === null &&
          plan.providerInput === null &&
          plan.workspaceSourcePath === null &&
          plan.workspaceMountMode === null) &&
    dockerIsolationResourceIdentityIsValid({
      authenticationContainerName: plan.authContainerName,
      executionContainerName: plan.providerContainerName,
      proxyContainerName: plan.proxyContainerName,
      internalNetworkName: plan.internalNetworkName,
      egressNetworkName: plan.egressNetworkName,
      ownershipLabel: plan.ownershipLabel,
      executionImageDigest: plan.providerImageDigest,
      proxyImageDigest: plan.proxyImageDigest,
    }) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeIdentityHash) &&
    /^[a-f0-9]{64}$/u.test(plan.providerHomeProtectionHash) &&
    /^[a-f0-9]{64}$/u.test(plan.localUserBindingHash) &&
    /^[a-f0-9]{64}$/u.test(plan.stableLogicalHomeBindingHash) &&
    Array.isArray(plan.commands) &&
    plan.commands.length === PURPOSES.length &&
    plan.commands.every(
      (command, index) =>
        command.purpose === PURPOSES[index] &&
        Array.isArray(command.argv) &&
        command.argv.length > 0 &&
        command.argv.every(
          (value: unknown) =>
            typeof value === "string" &&
            value.length > 0 &&
            !value.includes("\0"),
        ),
    )
  );
}

/**
 * 下位の技術分類を公開用途別の理由へ投影する。
 *
 * @responsibility Docker Isolationの分類を再計算せず、Providerと用途の意味へ接続する。
 * @trace ARCH-000008
 * @input execution: 元の観測、purpose: 用途、provider: Provider、classified: 下位の技術分類。
 * @returns classifyExecutionの計算結果を返す。
 * @precondition 「execution: CommandExecution | null、purpose: string、provider: "codex" | "claude"」がclassifyExecutionの入力契約を満たす。
 * @postcondition classifyExecutionの責務を完了した結果だけを返す。
 * @effect N/A: classifyExecutionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyExecutionは独自の失敗分岐を所有しない。
 * @invariant classifyExecutionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security classifyExecutionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyExecutionは共有非同期状態を持たない同期処理である。
 */
function classifyExecution(
  execution: CommandExecution | null,
  purpose: string,
  provider: "codex" | "claude",
  classified: ReturnType<typeof classifyDockerCommandExecution>,
) {
  const isProvider = purpose === "start_provider_attached";
  if (classified.category === "deadline_exceeded")
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? "provider_deadline_exceeded"
        : "docker_setup_deadline_exceeded",
    });
  if (classified.category === "output_limit_exceeded")
    return Object.freeze({
      ok: false,
      reason: "provider_output_limit_exceeded",
    });
  if (classified.category === "signalled")
    return Object.freeze({ ok: false, reason: "provider_process_signalled" });
  if (classified.category === "nonzero_exit") {
    if (execution === null)
      throw new Error("docker_command_classification_inconsistent");
    return Object.freeze({
      ok: false,
      reason: isProvider
        ? convertProviderError(provider, execution).reason
        : isDockerSetupCommandPurpose(purpose)
          ? SETUP_COMMAND_FAILURE_REASONS[purpose]
          : "docker_setup_command_failed",
    });
  }
  return Object.freeze({
    ok: true,
    reason: "command_completed",
    stdoutBytes: classified.stdoutBytes,
  });
}

// This is an additional veto, never an authority source. Do not pass plans,
// credentials or capabilities to it, or use it on the existing cleanup path.
/**
 * command Restriction Allowsを決定する。
 *
 * @responsibility command Restriction Allowsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input restriction: unknown、purpose: string
 * @returns commandRestrictionAllowsの計算結果を返す。
 * @precondition 「restriction: unknown、purpose: string」がcommandRestrictionAllowsの入力契約を満たす。
 * @postcondition commandRestrictionAllowsの責務を完了した結果だけを返す。
 * @effect N/A: commandRestrictionAllowsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure commandRestrictionAllowsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant commandRestrictionAllowsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security commandRestrictionAllowsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency commandRestrictionAllowsは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
 * Planを実行する。
 *
 * @responsibility Planの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、record: ExecutionRecord、plan: PreparedPlan、recovery: Recovery
 * @returns executePlanの計算結果を返す。
 * @precondition 「state: RuntimeState、record: ExecutionRecord、plan: PreparedPlan、recovery: Recovery」がexecutePlanの入力契約を満たす。
 * @postcondition executePlanの責務を完了した結果だけを返す。
 * @effect N/A: executePlanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure executePlanは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executePlanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security executePlanはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency executePlanは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executePlan(
  state: RuntimeState,
  record: ExecutionRecord,
  plan: PreparedPlan,
  recovery: Recovery,
) {
  let reason: DockerProcessControllerFinalReason =
    "provider_operation_completed";
  let requestedStatus: "completed" | "blocked" | "cancelled" = "completed";
  let providerRequestStarted = false;
  let resultSha256: string | null = null;
  let resultBytes = 0;
  let normalizedResult: unknown | null = null;
  let isSubscriptionAuthConfirmed = false;
  let recoveryFinalizationCapability: object | null = null;
  let wasProviderContainerCreationObserved = false;
  let wasProviderProcessCompletionObserved = false;
  let providerExitStatusClass: ReturnType<typeof classifyDockerProcessExit> =
    "not_observed";
  let diagnosticPurpose: string | null = null;
  let diagnosticStage: PrimaryFailureDiagnostic["stage"] = "submission_record";
  let hasCommandHandle = false;
  let hasResponseObservation = false;
  let receiptRecorded = false;
  let commandObservation: PrimaryFailureDiagnostic["commandObservation"] = null;
  let primaryFailure: PrimaryFailureDiagnostic | null = null;
  let startConfirmation: Promise<void> | null = null;
  let lastStdoutBytes = 0;
  let cleanup: CleanupObservation = Object.freeze({
    confirmed: false,
    processTreeTerminated: false,
    containersAbsent: false,
    networksAbsent: false,
  });
  let verifiedResourceObservations: CleanupObservation["resourceObservations"] =
    null;
  let processTreeTerminationConfirmed = false;
  let sessionStarted = false;

  /**
   * 最初の上位失敗を元段階で固定する。
   * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
   * @trace ARCH-000008
   * @input next: 固定公開理由。
   * @returns N/A: 私有状態だけを更新する。
   * @precondition 同じ操作の検証済み計画とOwnerを使用する。
   * @postcondition raw HandleやOS手順を所有しない。
   * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
   * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
   * @invariant 新Authority・Store・回復管理を作らない。
   * @boundary 上位の意味と下位の技術実行。
   * @security 生出力・秘密値を公開通知へ複製しない。
   * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
   */
  function reject(next: DockerProcessControllerFinalReason) {
    if (requestedStatus !== "blocked") {
      requestedStatus = "blocked";
      reason = next;
    }
    primaryFailure ??= Object.freeze({
      purpose: diagnosticPurpose,
      stage: diagnosticStage,
      reason: next,
      exceptionCode: null,
      commandHandleObtained: hasCommandHandle,
      responseObserved: hasResponseObservation,
      receiptRecorded,
      commandObservation,
    });
    return false;
  }

  const hooks: DockerExecutionHooks = {
    /**
     * 実行制約だけを確認する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    allowCommand: (purpose) => {
      diagnosticPurpose = purpose;
      diagnosticStage = "command_restriction";
      hasCommandHandle = false;
      hasResponseObservation = false;
      receiptRecorded = false;
      commandObservation = null;
      return (
        commandRestrictionAllows(record.commandRestriction, purpose) ||
        reject("docker_process_controller_execution_restricted")
      );
    },
    /**
     * CREATE要求前の予定を保存する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    recordSubmission: (purpose) => {
      diagnosticStage = "submission_record";
      return (
        !state.dependencies.markResourceSubmission ||
        state.dependencies.markResourceSubmission(
          recovery.recoveryCapability,
          purpose,
        ) === true ||
        reject("docker_resource_submission_record_unavailable")
      );
    },
    /**
     * 予定保存後の未発行取消を記録する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    recordNotIssued: (purpose) => {
      if (
        !state.dependencies.markResourceSubmission ||
        !state.dependencies.recordResourceNotIssued
      )
        return true;
      const notice = Object.freeze({});
      state.observations.registerSubmission(
        notice,
        Object.freeze({
          managementCapability: record.managementCapability,
          recoveryCapability: recovery.recoveryCapability,
          operationId: plan.operationId,
          recoveryId: recovery.recoveryId,
          purpose,
          kind: "resource_not_issued",
        }),
      );
      let accepted = false;
      try {
        accepted =
          state.dependencies.recordResourceNotIssued(
            recovery.recoveryCapability,
            purpose,
            notice,
          ) === true;
      } finally {
        state.observations.revokeSubmission(notice);
      }
      return (
        accepted || reject("docker_resource_submission_record_unavailable")
      );
    },
    /**
     * AI本体の要求予定を元通知へ結合して保存する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input N/A: 元計画を使用する。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    recordExecutionSubmission: () => {
      diagnosticStage = "submission_record";
      if (!state.dependencies.recordProviderSubmission) return true;
      const notice = Object.freeze({});
      state.observations.registerSubmission(
        notice,
        Object.freeze({
          managementCapability: record.managementCapability,
          recoveryCapability: recovery.recoveryCapability,
          operationId: plan.operationId,
          recoveryId: recovery.recoveryId,
          purpose: "start_provider_attached",
          kind: "provider_submission",
        }),
      );
      let accepted = false;
      try {
        accepted =
          state.dependencies.recordProviderSubmission(
            recovery.recoveryCapability,
            notice,
          ) === true;
      } finally {
        state.observations.revokeSubmission(notice);
      }
      return (
        accepted || reject("docker_resource_submission_record_unavailable")
      );
    },
    /**
     * CREATEの元Receiptを上位Ownerへ保存する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。stdout: 下位の元応答。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    recordReceipt: (purpose, stdout) => {
      diagnosticStage = "resource_receipt_record";
      const accepted =
        !state.dependencies.recordResourceReceipt ||
        state.dependencies.recordResourceReceipt(
          recovery.recoveryCapability,
          purpose,
          stdout,
        ) === true;
      receiptRecorded =
        accepted && state.dependencies.recordResourceReceipt !== undefined;
      return accepted || reject("docker_resource_receipt_unavailable");
    },
    /**
     * 技術完了を既存の公開失敗分類へ接続する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose、execution、classification: 同じ下位観測。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    acceptCommandResult: (purpose, execution, classification) => {
      diagnosticStage = "execution_classification";
      hasCommandHandle = true;
      hasResponseObservation = execution !== null;
      commandObservation =
        execution === null
          ? null
          : Object.freeze({
              exitCode: execution.status,
              stdoutBytes: Buffer.byteLength(execution.stdout, "utf8"),
              stderrBytes: Buffer.byteLength(execution.stderr, "utf8"),
            });
      const classified = classifyExecution(
        execution,
        purpose,
        plan.provider,
        classification,
      );
      lastStdoutBytes =
        "stdoutBytes" in classification ? classification.stdoutBytes : 0;
      return classified.ok || reject(classified.reason);
    },
    /**
     * 認証とAI結果の意味を上位で受理する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input purpose: 固定用途。execution: 元の完了観測。
     * @returns 同期受理のbool。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    acceptOutput: (purpose, execution) => {
      if (purpose === "start_subscription_auth_probe_attached") {
        diagnosticStage = "subscription_auth_verification";
        if (
          evaluateProviderAuthentication(
            plan.provider,
            plan.subscriptionOffering,
            execution.stdout,
            execution.stderr,
          ).status !== "confirmed"
        )
          return reject("provider_subscription_auth_not_confirmed");
        isSubscriptionAuthConfirmed = true;
      }
      if (purpose === "start_provider_attached") {
        diagnosticStage = "provider_result_normalization";
        const providerResult =
          plan.operationMode === "isolated_task"
            ? normalizeProviderTaskStructuredResult(
                plan.provider,
                plan.taskRole,
                plan.selectedEffort,
                execution.stdout,
                plan.taskWorkload,
              )
            : plan.operationMode === "workbench_advice"
              ? normalizeWorkbenchAdviceProviderResult(
                  plan.provider,
                  execution.stdout,
                )
              : plan.provider === "codex"
                ? normalizeCodexStructuredResult(execution.stdout)
                : normalizeClaudeStructuredResult(execution.stdout);
        if (providerResult.status !== "confirmed")
          return reject(
            "reason" in providerResult &&
              isDockerProcessControllerPublicCompletionReason(
                providerResult.reason,
              )
              ? providerResult.reason
              : "provider_result_invalid",
          );
        normalizedResult = providerResult.normalizedResult;
        resultBytes = lastStdoutBytes;
        resultSha256 = createHash("sha256")
          .update(execution.stdout, "utf8")
          .digest("hex");
      }
      return true;
    },
    /**
     * 下位の開始factから上位確認を開始する。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input N/A: 元操作の開始fact。
     * @returns N/A: Promiseを下位へ返さない。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    onExecutionStarted: () => {
      providerRequestStarted = true;
      hasCommandHandle = true;
      const notice: ProviderProcessStartedNotice = Object.freeze({
        event: "coordinator_provider_process_started",
        taskRole: plan.taskRole,
        provider: plan.provider,
        operationId: plan.operationId,
      });
      startConfirmation = (async () => {
        let accepted = true;
        try {
          accepted =
            !state.dependencies.reportProviderProcessStarted ||
            (await state.dependencies.reportProviderProcessStarted(notice)) ===
              true;
          if (accepted && record.observeProviderStarted)
            accepted = (await record.observeProviderStarted(notice)) === true;
        } catch {
          accepted = false;
        }
        if (!accepted) {
          if (primaryFailure === null) {
            primaryFailure = Object.freeze({
              purpose: "start_provider_attached",
              stage: "provider_start_observation",
              reason:
                "docker_process_controller_provider_start_observation_failed",
              exceptionCode: null,
              commandHandleObtained: true,
              responseObserved: false,
              receiptRecorded: false,
              commandObservation: null,
            });
          }
          if (requestedStatus !== "blocked") {
            requestedStatus = "blocked";
            reason =
              "docker_process_controller_provider_start_observation_failed";
          }
          record.cancellationRequested = true;
          await record.cancelExecution?.();
        }
      })();
    },
    /**
     * 下位の一次停止点を清掃前に受け取る。
     * @responsibility 上位の元相関・保存・意味だけを下位の有限接続へ搬送する。
     * @trace ARCH-000008
     * @input failure: 元の固定技術停止点。
     * @returns N/A: 同期の値保存だけ。
     * @precondition 同じ操作の検証済み計画とOwnerを使用する。
     * @postcondition raw HandleやOS手順を所有しない。
     * @effect 既存上位Ownerの保存・受理・通知だけを呼ぶ。
     * @failure 不成立を固定理由へ閉じて後続実行を拒否する。
     * @invariant 新Authority・Store・回復管理を作らない。
     * @boundary 上位の意味と下位の技術実行。
     * @security 生出力・秘密値を公開通知へ複製しない。
     * @concurrency 同期Gateと上位開始確認Promiseを混在させない。
     */
    onFailure: (failure) => {
      if (primaryFailure !== null) return;
      diagnosticPurpose = failure.purpose;
      if (failure.stage !== "gate") diagnosticStage = failure.stage;
      hasCommandHandle = failure.commandHandleObtained;
      hasResponseObservation = failure.responseObserved;
      const next =
        failure.kind === "start_unconfirmed"
          ? "docker_process_controller_provider_start_failed"
          : failure.gate === "onExecutionStarted"
            ? "docker_process_controller_provider_start_observation_failed"
            : "docker_process_controller_execution_failed_closed";
      reject(next);
      const latched = primaryFailure as PrimaryFailureDiagnostic | null;
      if (latched)
        primaryFailure = Object.freeze({
          ...latched,
          exceptionCode: failure.exceptionCode,
        });
    },
  };

  reportPassiveBoundaryDiagnostic(state, providerBoundaryConfiguration(plan));
  try {
    if (!state.dependencies.startExecution)
      throw new Error("docker_process_controller_execution_unavailable");
    const session = state.dependencies.startExecution(
      plan,
      recovery.recoveryCapability,
      record.managementCapability,
      hooks,
    );
    sessionStarted = true;
    record.cancelExecution = session.cancel;
    if (record.cancellationRequested) void session.cancel();
    const outcome = await session.completion;
    providerRequestStarted = outcome.executionStarted;
    wasProviderContainerCreationObserved = outcome.executionContainerCreated;
    wasProviderProcessCompletionObserved = outcome.executionCompleted;
    providerExitStatusClass = outcome.executionExit;
    cleanup = outcome.cleanup;
    verifiedResourceObservations = outcome.resourceObservations;
    processTreeTerminationConfirmed = outcome.processTreeTerminationConfirmed;
    if (outcome.failure && primaryFailure === null)
      hooks.onFailure(outcome.failure);
  } catch (error) {
    if (primaryFailure === null) {
      reject("docker_process_controller_execution_failed_closed");
      const latched = primaryFailure as PrimaryFailureDiagnostic | null;
      if (latched)
        primaryFailure = Object.freeze({
          ...latched,
          exceptionCode: classifyDockerCommandException(error),
        });
    }
    if (!sessionStarted) {
      try {
        cleanup = await state.dependencies.cleanupOwnedResources(
          plan,
          recovery.recoveryCapability,
          record.managementCapability,
        );
      } catch {}
      try {
        verifiedResourceObservations = state.dependencies.verifyCleanupOutcome
          ? state.dependencies.verifyCleanupOutcome(
              cleanup,
              plan,
              recovery.recoveryCapability,
              record.managementCapability,
            )
          : cleanup.resourceObservations;
      } catch {
        verifiedResourceObservations = null;
      }
      processTreeTerminationConfirmed =
        cleanup.confirmed &&
        cleanup.processTreeTerminated &&
        (!state.dependencies.verifyCleanupOutcome ||
          verifiedResourceObservations != null);
    }
  }
  // Docker資源はここまでで終端済み。上位保存待ちは技術清掃を止めない。
  await startConfirmation;
  let mountLeaseReleased = false;
  let recoveryCompleted = false;
  if (
    processTreeTerminationConfirmed &&
    cleanup.containersAbsent &&
    cleanup.networksAbsent
  ) {
    try {
      const dockerAbsenceRecorded =
        !state.dependencies.recordDockerAbsence ||
        state.dependencies.recordDockerAbsence(
          recovery.recoveryCapability,
          verifiedResourceObservations,
        );
      if (!dockerAbsenceRecorded)
        throw new Error("docker_absence_record_failed");
      const mountCompletion = state.dependencies.completeMount(
        plan.activeMountCapability,
        record.managementCapability,
      );
      mountLeaseReleased = mountCompletion.status === "completed";
      if (mountLeaseReleased) {
        const mountCompletionRecorded =
          !state.dependencies.recordMountCompletion ||
          state.dependencies.recordMountCompletion(
            recovery.recoveryCapability,
            mountCompletion,
          );
        if (!mountCompletionRecorded)
          throw new Error("mount_completion_record_failed");
        const completion = state.dependencies.completeRecovery(
          recovery.recoveryCapability,
          record.managementCapability,
          Object.freeze({ plan, cleanupOutcome: cleanup, mountCompletion }),
        );
        recoveryFinalizationCapability =
          completion.status === "completed" &&
          completion.recoveryFinalizationCapability &&
          typeof completion.recoveryFinalizationCapability === "object"
            ? completion.recoveryFinalizationCapability
            : null;
        recoveryCompleted = recoveryFinalizationCapability !== null;
      }
    } catch {
      mountLeaseReleased = false;
      recoveryCompleted = false;
    }
  }
  if (requestedStatus === "completed") {
    try {
      if (!state.dependencies.verifyRevision(record.managementCapability)) {
        requestedStatus = "blocked";
        reason = "repository_revision_changed";
        resultSha256 = null;
        resultBytes = 0;
        normalizedResult = null;
      }
    } catch {
      requestedStatus = "blocked";
      reason = "repository_revision_changed";
      resultSha256 = null;
      resultBytes = 0;
      normalizedResult = null;
    }
  }
  // Cancellation remains live through cleanup. Re-settle after the final await
  // so a request received during cleanup cannot be published as completed.
  // A failure that already settled as blocked keeps the more specific failure;
  // cancellationRequested remains observable without erasing that diagnosis.
  if (record.cancellationRequested && requestedStatus === "completed") {
    requestedStatus = "cancelled";
    reason = "provider_operation_cancelled";
    resultSha256 = null;
    resultBytes = 0;
    normalizedResult = null;
  }
  reportPassiveBoundaryDiagnostic(
    state,
    Object.freeze({
      event: "coordinator_provider_boundary_settled" as const,
      primaryFailure,
      taskRole: plan.taskRole,
      provider: plan.provider,
      operationId: plan.operationId,
      providerContainerCreatedObserved: wasProviderContainerCreationObserved,
      providerProcessStartedObserved: providerRequestStarted,
      providerProcessCompletionObserved: wasProviderProcessCompletionObserved,
      providerProcessExitStatusClass: providerExitStatusClass,
      processTreeTerminationObserved: processTreeTerminationConfirmed,
      containersAbsentObserved: cleanup.containersAbsent,
      networksAbsentObserved: cleanup.networksAbsent,
      cleanupConfirmed:
        processTreeTerminationConfirmed &&
        cleanup.containersAbsent &&
        cleanup.networksAbsent &&
        mountLeaseReleased &&
        recoveryCompleted,
    }),
  );
  const finalResult = createFinalResult(
    requestedStatus,
    reason,
    plan,
    recovery.recoveryId,
    {
      providerRequestStarted,
      cancellationRequested: record.cancellationRequested,
      processTreeTerminationConfirmed,
      containersAbsent: cleanup.containersAbsent,
      networksAbsent: cleanup.networksAbsent,
      mountLeaseReleased,
      recoveryCompleted,
      resultSha256,
      resultBytes,
      normalizedResult,
      subscriptionAuthConfirmed: isSubscriptionAuthConfirmed,
      recoveryFinalizationCapability,
    },
  );
  let homeLeaseReleased = false;
  try {
    homeLeaseReleased =
      state.dependencies.verifyHomeLeaseRelease?.(
        recovery.recoveryCapability,
        record.managementCapability,
        plan.operationId,
        recovery.recoveryId,
      ) === true;
  } catch {
    homeLeaseReleased = false;
  }
  if (verifiedResourceObservations != null) {
    state.observations.registerTerminal(
      finalResult,
      Object.freeze({
        managementCapability: record.managementCapability,
        operationId: plan.operationId,
        recoveryId: recovery.recoveryId,
        resources: verifiedResourceObservations,
        primaryFailure,
        mountLeaseReleased,
        recoveryCompleted,
        homeLeaseReleased,
      }),
    );
  }
  return finalResult;
}

/**
 * Workbench助言Provider出力をProcess Controllerの内部正規形へ変換する。
 *
 * @responsibility Provider Envelopeを除去し、助言JSONだけをcleanup後の内部結果へ保持する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input provider: 実行Provider、stdout: 固定CLIの標準出力。
 * @returns confirmed時はadviceJsonを持つ内部正規形、失敗時は拒否理由。
 * @precondition workbench_advice PlanのProvider Processが終了している。
 * @postcondition 生Envelope、Session、CostおよびTool出力をnormalizedResultへ含めない。
 * @effect N/A: 出力検証と値生成だけを行う。
 * @failure Provider固有完了条件を満たさない出力をblockedへ閉じる。
 * @invariant 参照許可集合による意味検証は上位Advice Executorが所有する。
 * @boundary Provider CLI出力とCoordinator内部助言JSONの間。
 * @security 生Provider出力を公開結果へ複製しない。
 * @concurrency N/A: 共有状態を変更しない同期処理である。
 */
function normalizeWorkbenchAdviceProviderResult(
  provider: "codex" | "claude",
  stdout: string,
) {
  const extracted = parseProviderResult({
    provider,
    purpose: "advice",
    raw: stdout,
  });
  return extracted.status === "confirmed" && typeof extracted.value === "string"
    ? Object.freeze({
        status: "confirmed" as const,
        reason: null,
        normalizedResult: Object.freeze({
          contract: "crdd-coordinator/workbench-ai-advice-provider-output",
          contractRevision: 1,
          adviceJson: extracted.value,
        }),
      })
    : Object.freeze({
        status: "blocked" as const,
        reason:
          extracted.error?.reason ?? "workbench_ai_provider_output_invalid",
        normalizedResult: null,
      });
}

/**
 * docker-process-controllerを開始する。
 *
 * @responsibility docker-process-controllerの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、preparedCapability: unknown、managementCapability: unknown、registerRecoveryHandoff: unknown、commandRestriction: unknown
 * @returns startの計算結果を返す。
 * @precondition 「state: RuntimeState、preparedCapability: unknown、managementCapability: unknown、registerRecoveryHandoff: unknown、commandRestriction: unknown」がstartの入力契約を満たす。
 * @postcondition startの責務を完了した結果だけを返す。
 * @effect N/A: startは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: startは独自の失敗分岐を所有しない。
 * @invariant startは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security startはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startは共有非同期状態を持たない同期処理である。
 */
function start(
  state: RuntimeState,
  preparedCapability: unknown,
  managementCapability: unknown,
  registerRecoveryHandoff: unknown,
  commandRestriction: unknown,
  observeProviderStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => boolean | Promise<boolean>,
) {
  if (
    !state.dependencies.effectExecutorAvailable ||
    (observeProviderStarted !== undefined &&
      typeof observeProviderStarted !== "function") ||
    !managementCapability ||
    typeof managementCapability !== "object"
  ) {
    return createBlockedStart("docker_process_controller_effect_unavailable");
  }
  const plan = state.dependencies.consumePreparedPlan(
    preparedCapability,
    managementCapability,
  );
  if (!plan || !isPlanValid(plan))
    return createBlockedStart("docker_process_controller_plan_invalid");
  if (!state.dependencies.verifyRevision(managementCapability)) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createBlockedStart(
      "docker_process_controller_revision_invalid",
      completed.status === "completed",
    );
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
    authority.profileId !== plan.profileId ||
    authority.providerHomeMountGrantRef !== plan.grantRef ||
    authority.runtimeAuthorityIssued !== true ||
    authority.providerEffectAllowed !== true
  ) {
    const completed = state.dependencies.completeMount(
      plan.activeMountCapability,
      managementCapability,
    );
    return createBlockedStart(
      "docker_process_controller_authority_invalid",
      completed.status === "completed",
    );
  }
  const recovery = state.dependencies.beginRecovery(
    Object.freeze({
      ...plan,
      recoveryCorrelationId: plan.recoveryCorrelationId ?? null,
    }),
    managementCapability,
  );
  const readyRecovery = snapshotReadyRecovery(recovery);
  if (!readyRecovery) {
    const malformedCapability = ownDataValue(recovery, "recoveryCapability");
    const malformedRecoveryId = publicVerifiedDockerRecoveryId(
      ownDataValue(recovery, "recoveryId"),
    );
    const exactBlocked = snapshotBlockedRecoveryWithExactId(
      recovery,
      plan.stableLogicalHomeBindingHash,
    );
    if (exactBlocked?.recoveryCapability) {
      const stopped = createBlockedStart(
        publicDockerRecoveryStartReason(exactBlocked.reason),
        false,
        exactBlocked.recoveryId,
        true,
      );
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
          state.dependencies.abandonRecovery?.(exactBlocked.recoveryCapability);
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
      return createBlockedStart(
        publicDockerRecoveryStartReason(exactBlocked.reason),
        completed.status === "completed",
        exactBlocked.recoveryId,
        true,
      );
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
    return createBlockedStart(
      publicDockerRecoveryStartReason(ownDataValue(recovery, "reason")),
      completed.status === "completed",
      malformedRecoveryId,
      ownDataValue(recovery, "manualRecoveryRequired") === true,
    );
  }
  const parsedRecoveryId = parseDockerTaskRecoveryId(readyRecovery.recoveryId);
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
  const controlCapability = Object.freeze({});
  const record: ExecutionRecord = {
    managementCapability,
    commandRestriction,
    observeProviderStarted: observeProviderStarted ?? null,
    cancellationRequested: false,
    cancelExecution: null,
    completion: null,
  };
  state.controls.set(controlCapability, record);
  const completion = executePlan(state, record, plan, readyRecovery).finally(
    () => {
      record.observeProviderStarted = null;
      record.cancelExecution = null;
      state.controls.delete(controlCapability);
    },
  );
  record.completion = completion;
  return Object.freeze({
    status: "started" as const,
    reason: "docker_process_controller_started",
    controlCapability,
    completion,
    operationId: plan.operationId,
    recoveryId: parsedRecoveryId.token,
    dockerEffectStarted: true,
    providerRequestStarted: false,
    rawOutputReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
    normalizedResult: null,
    normalizedResultReportedAfterCleanupOnly: true,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
}

/**
 * docker-process-controllerを取り消す。
 *
 * @responsibility docker-process-controllerの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000008
 * @input state: RuntimeState、controlCapability: unknown、managementCapability: unknown
 * @returns cancelの計算結果を返す。
 * @precondition 「state: RuntimeState、controlCapability: unknown、managementCapability: unknown」がcancelの入力契約を満たす。
 * @postcondition cancelの責務を完了した結果だけを返す。
 * @effect N/A: cancelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelは独自の失敗分岐を所有しない。
 * @invariant cancelは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security cancelはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency cancelは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function cancel(
  state: RuntimeState,
  controlCapability: unknown,
  managementCapability: unknown,
) {
  if (!controlCapability || typeof controlCapability !== "object")
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  const record = state.controls.get(controlCapability);
  if (!record || record.managementCapability !== managementCapability)
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  if (record.cancellationRequested)
    return Object.freeze({ status: "blocked" as const, reason: "duplicate" });
  record.cancellationRequested = true;
  const terminated = record.cancelExecution
    ? (await record.cancelExecution()).processTerminationObserved
    : true;
  return Object.freeze({
    status: "requested" as const,
    reason: terminated
      ? "provider_cancellation_requested"
      : "provider_cancellation_grace_exceeded",
    cancellationRequested: true,
    processTerminationObserved: terminated,
  });
}

/**
 * 本番の元計画を固定隔離Sessionで実行する。
 * @responsibility 本番Ownerを維持して下位APIだけを接続する。
 * @trace ARCH-000008
 * @input plan、recoveryCapability、managementCapability、hooks: 元計画と有限同期接続。
 * @returns 本番下位の元Session。
 * @precondition 上位許可と元相関を確認している。
 * @postcondition raw Process・CLI構成を上位へ戻さない。
 * @effect 下位の固定実行と回収を委譲する。
 * @failure 不正投影は要求前停止。
 * @invariant Candidateを本番結果へ昇格しない。
 * @boundary CoordinatorとDocker Isolation本番Runtime。
 * @security 本番primitiveの差替え入力を受けない。
 * @concurrency 返却後に実行し、取消は同じSessionへ結合する。
 */
export function startRuntimeOwnedDockerExecution(
  plan: isolationExecutionPreparedPlan,
  recoveryCapability: object,
  managementCapability: object,
  hooks: DockerExecutionHooks,
) {
  return productionRuntime.startExecution(
    plan,
    recoveryCapability,
    managementCapability,
    hooks,
  );
}

/**
 * Runtime 所有 Docker Resourcesを清掃する。
 *
 * @responsibility Runtime 所有 Docker Resourcesの清掃対象、完了観測、残存時の失敗境界を所有する。
 * @trace ARCH-000008
 * @input plan: PreparedPlan、recoveryCapability: object、managementCapability: unknown
 * @returns cleanupRuntimeOwnedDockerResourcesの計算結果を返す。
 * @precondition 「plan: PreparedPlan、recoveryCapability: object、managementCapability: unknown」がcleanupRuntimeOwnedDockerResourcesの入力契約を満たす。
 * @postcondition cleanupRuntimeOwnedDockerResourcesの責務を完了した結果だけを返す。
 * @effect N/A: cleanupRuntimeOwnedDockerResourcesは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cleanupRuntimeOwnedDockerResourcesは独自の失敗分岐を所有しない。
 * @invariant cleanupRuntimeOwnedDockerResourcesは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cleanupRuntimeOwnedDockerResourcesはProcess内の同一Subsystemで完結する。
 * @security cleanupRuntimeOwnedDockerResourcesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cleanupRuntimeOwnedDockerResourcesは共有非同期状態を持たない同期処理である。
 */
export function cleanupRuntimeOwnedDockerResources(
  plan: isolationExecutionPreparedPlan,
  recoveryCapability: object,
  managementCapability: unknown,
) {
  return productionRuntime.cleanupOwnedResources(
    plan,
    recoveryCapability,
    managementCapability,
  );
}

/**
 * 本番Docker清掃結果を同じ操作・計画へ照合する。
 *
 * @responsibility 本番Effect Ownerの実返却だけから五purposeの終端観測を返す。
 * @trace ARCH-000008
 * @input result、plan、recoveryCapability、managementCapability: 本番清掃結果と対象相関。
 * @returns 同じ本番結果の観測、またはnull。
 * @precondition 本番清掃結果と元の計画・Capabilityを渡す。
 * @postcondition 模擬Runtimeやコピーした成功結果を拒否する。
 * @effect N/A: 本番Ownerの保持値の照合だけを行う。
 * @failure 相関が成立しない場合はnullを返す。
 * @invariant 新しい処置AuthorityやLease解放根拠を生成しない。
 * @boundary 本番Effect Ownerから終端保存利用側への根拠搬送。
 * @security Provider本文やHost Pathを返さない。
 * @concurrency N/A: 同期照合であり外部待機を行わない。
 */
export function verifyRuntimeOwnedDockerCleanupOutcome(
  result: unknown,
  plan: isolationExecutionPreparedPlan,
  recoveryCapability: unknown,
  managementCapability: unknown,
) {
  return productionRuntime.verifyCleanupOutcome(
    result,
    plan,
    recoveryCapability,
    managementCapability,
  );
}

const productionState: RuntimeState = Object.freeze({
  dependencies: Object.freeze({
    effectExecutorAvailable: true,
    verifyRevision: verifyRuntimeOwnedRepositoryOperation,
    consumePreparedPlan: (
      preparedCapability: unknown,
      managementCapability: unknown,
    ) =>
      getRuntimeOwnedProviderDockerAdapter(
        "claude",
      ).consumeForProcessController(preparedCapability, managementCapability) ??
      getRuntimeOwnedProviderDockerAdapter("codex").consumeForProcessController(
        preparedCapability,
        managementCapability,
      ),
    beginRecovery: beginRuntimeOwnedDockerRecovery,
    bindInitializationFailure: bindRuntimeOwnedDockerInitializationFailure,
    abandonRecovery: abandonRuntimeOwnedDockerRecovery,
    verifyRecoveryBinding: verifyRuntimeOwnedDockerRecoveryBinding,
    startExecution: startRuntimeOwnedDockerExecution,
    cleanupOwnedResources: cleanupRuntimeOwnedDockerResources,
    verifyCleanupOutcome: verifyRuntimeOwnedDockerCleanupOutcome,
    completeMount: completeRuntimeOwnedProviderHomeMount,
    completeRecovery: completeRuntimeOwnedDockerRecovery,
    verifyHomeLeaseRelease: verifyRuntimeOwnedDockerHomeLeaseRelease,
    markResourceSubmission: markRuntimeOwnedDockerResourceSubmission,
    recordProviderSubmission: recordRuntimeOwnedDockerProviderSubmission,
    recordResourceNotIssued: recordRuntimeOwnedDockerResourceNotIssued,
    recordResourceReceipt: recordRuntimeOwnedDockerResourceReceipt,
    recordDockerAbsence: recordRuntimeOwnedDockerAbsence,
    recordMountCompletion: recordRuntimeOwnedNormalMountCompletion,
    reportProviderProcessStarted: createRuntimeOwnedLifecycleNoticeReporter(
      process.stderr,
    ),
    reportProviderBoundaryDiagnostic: createRuntimeOwnedLifecycleNoticeReporter(
      process.stderr,
    ),
    consumeProviderAuthority: consumeRuntimeOwnedProviderAuthority,
  }),
  controls: new WeakMap(),
  observations: Object.freeze({
    registerTerminal: registerRuntimeOwnedProviderTerminalObservation,
    registerSubmission: registerRuntimeOwnedProviderSubmissionNotice,
    revokeSubmission: revokeRuntimeOwnedProviderSubmissionNotice,
  }),
});

/**
 * Runtime 所有 Docker Process Controllerを開始する。
 *
 * @responsibility Runtime 所有 Docker Process Controllerの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000008
 * @input preparedCapability: unknown、managementCapability: unknown、registerRecoveryHandoff: unknown、commandRestriction: unknown
 * @returns startRuntimeOwnedDockerProcessControllerの計算結果を返す。
 * @precondition 「preparedCapability: unknown、managementCapability: unknown、registerRecoveryHandoff: unknown、commandRestriction: unknown」がstartRuntimeOwnedDockerProcessControllerの入力契約を満たす。
 * @postcondition startRuntimeOwnedDockerProcessControllerの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDockerProcessControllerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure startRuntimeOwnedDockerProcessControllerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startRuntimeOwnedDockerProcessControllerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security startRuntimeOwnedDockerProcessControllerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startRuntimeOwnedDockerProcessControllerは共有非同期状態を持たない同期処理である。
 */
export function startRuntimeOwnedDockerProcessController(
  preparedCapability: unknown,
  managementCapability: unknown,
  registerRecoveryHandoff?: unknown,
  commandRestriction?: unknown,
  observeProviderStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => boolean | Promise<boolean>,
) {
  try {
    return start(
      productionState,
      preparedCapability,
      managementCapability,
      registerRecoveryHandoff,
      commandRestriction,
      observeProviderStarted,
    );
  } catch {
    return createBlockedStart("docker_process_controller_start_failed_closed");
  }
}

/**
 * Runtime 所有 Docker Process Controllerを取り消す。
 *
 * @responsibility Runtime 所有 Docker Process Controllerの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000008
 * @input controlCapability: unknown、managementCapability: unknown
 * @returns cancelRuntimeOwnedDockerProcessControllerの計算結果を返す。
 * @precondition 「controlCapability: unknown、managementCapability: unknown」がcancelRuntimeOwnedDockerProcessControllerの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedDockerProcessControllerの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedDockerProcessControllerは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure cancelRuntimeOwnedDockerProcessControllerは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant cancelRuntimeOwnedDockerProcessControllerは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security cancelRuntimeOwnedDockerProcessControllerはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency cancelRuntimeOwnedDockerProcessControllerは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function cancelRuntimeOwnedDockerProcessController(
  controlCapability: unknown,
  managementCapability: unknown,
) {
  try {
    return await cancel(
      productionState,
      controlCapability,
      managementCapability,
    );
  } catch {
    return Object.freeze({ status: "blocked" as const, reason: "invalid" });
  }
}

/**
 * Isolated Docker Process Controller 候補を構築する。
 *
 * @responsibility Isolated Docker Process Controller 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000008
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedDockerProcessControllerCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedDockerProcessControllerCandidateの入力契約を満たす。
 * @postcondition createIsolatedDockerProcessControllerCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDockerProcessControllerCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createIsolatedDockerProcessControllerCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createIsolatedDockerProcessControllerCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createIsolatedDockerProcessControllerCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDockerProcessControllerCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDockerProcessControllerCandidate(
  dependencies: RuntimeDependencies,
) {
  const startExecution: NonNullable<RuntimeDependencies["startExecution"]> =
    dependencies.startExecution ??
    ((plan, recoveryCapability, managementCapability, hooks) =>
      startDockerCommandSessionCandidate(
        plan.commands.map(
          (command) => command.purpose as DockerIsolationCommand["purpose"],
        ),
        {
          startCommand: (purpose) => {
            const command = plan.commands.find(
              (candidate) => candidate.purpose === purpose,
            );
            if (!command || !dependencies.startCommand)
              throw new Error("docker_effect_command_not_owned");
            return dependencies.startCommand(
              command,
              plan,
              managementCapability,
            );
          },
          cleanup: () =>
            dependencies.cleanupOwnedResources(
              plan,
              recoveryCapability,
              managementCapability,
            ),
          ...(dependencies.verifyCleanupOutcome
            ? {
                verifyCleanup: (result: CleanupObservation) =>
                  dependencies.verifyCleanupOutcome?.(
                    result,
                    plan,
                    recoveryCapability,
                    managementCapability,
                  ),
              }
            : {}),
        },
        hooks,
      ));
  const state = Object.freeze({
    dependencies: Object.freeze({ ...dependencies, startExecution }),
    controls: new WeakMap(),
    observations: createProviderObservationOwner(),
  }) satisfies RuntimeState;
  return Object.freeze({
    productionAuthority: false as const,
    verifyProviderSubmissionNotice: (
      notice: unknown,
      recoveryCapability: unknown,
      managementCapability: unknown,
      operationId: unknown,
      recoveryId: unknown,
    ) =>
      state.observations.verifyUnissuedNotice(
        notice,
        recoveryCapability,
        managementCapability,
        "start_provider_attached",
        operationId,
        recoveryId,
        "provider_submission",
      ),
    verifyUnissuedNotice: (
      notice: unknown,
      recoveryCapability: unknown,
      managementCapability: unknown,
      purpose: unknown,
      operationId: unknown,
      recoveryId: unknown,
    ) =>
      state.observations.verifyUnissuedNotice(
        notice,
        recoveryCapability,
        managementCapability,
        purpose,
        operationId,
        recoveryId,
      ),
    start: (
      preparedCapability: unknown,
      managementCapability: unknown,
      registerRecoveryHandoff: unknown = () => true,
      commandRestriction?: unknown,
      observeProviderStarted?: (
        notice: ProviderProcessStartedNotice,
      ) => boolean | Promise<boolean>,
    ) => {
      try {
        return start(
          state,
          preparedCapability,
          managementCapability,
          registerRecoveryHandoff,
          commandRestriction,
          observeProviderStarted,
        );
      } catch {
        return createBlockedStart(
          "docker_process_controller_start_failed_closed",
        );
      }
    },
    cancel: (controlCapability: unknown, managementCapability: unknown) =>
      cancel(state, controlCapability, managementCapability),
    borrowTerminalObservations: (
      result: unknown,
      managementCapability: unknown,
      operationId: unknown,
      recoveryId: unknown,
    ) =>
      state.observations.borrowTerminalObservations(
        result,
        managementCapability,
        operationId,
        recoveryId,
      ),
  });
}

/**
 * Docker Process Controller 契約の公開契約を記述する。
 *
 * @responsibility Docker Process Controller 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerProcessControllerContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerProcessControllerContractの入力契約を満たす。
 * @postcondition describeDockerProcessControllerContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerProcessControllerContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerProcessControllerContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerProcessControllerContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeDockerProcessControllerContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerProcessControllerContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerProcessControllerContract() {
  return Object.freeze({
    contract: DOCKER_PROCESS_CONTROLLER_CONTRACT,
    contractRevision: DOCKER_PROCESS_CONTROLLER_CONTRACT_REVISION,
    setupTimeoutMs: SETUP_TIMEOUT_MS,
    providerTimeoutMs: PROVIDER_TIMEOUT_MS,
    cancellationGraceMs: CANCELLATION_GRACE_MS,
    stdoutLimitBytes: STDOUT_LIMIT_BYTES,
    stderrLimitBytes: STDERR_LIMIT_BYTES,
    preparedPlan: "opaque_single_use_adapter_capability_only",
    recoveryBeforeDockerEffect: true,
    resourceJournal:
      "durable_submission_before_each_create_and_exact_id_receipt_after_success",
    providerAuthority:
      "opaque_single_use_reverified_and_consumed_before_recovery_or_docker_effect",
    additionalCommandRestriction:
      "optional_synchronous_exact_true_veto_before_each_command_never_authority_or_cleanup_gate",
    subscriptionAuthentication:
      "network_none_read_only_provider_home_probe_with_exact_provider_stdout_stderr_shape_required_before_provider_request",
    subscriptionOffering:
      "chatgpt_subscription_oauth_or_claude_max_exact_match_required",
    cancellation: "opaque_control_capability_exactly_once",
    cleanup:
      "owned_containers_and_networks_absent_then_mount_release_then_recovery_complete",
    cleanupFailure: "manual_recovery_required_fail_closed",
    structuredResult:
      "exact_provider_boolean_role_task_or_workbench_advice_result_published_after_cleanup_only",
    providerFailureClassification:
      "known_operational_nonzero_output_mapped_to_closed_public_reason_unknown_output_kept_generic",
    providerBoundaryDiagnostics:
      "configured_approval_sandbox_container_workspace_and_observed_process_cleanup_stages_without_raw_command_output_or_paths",
    providerTextPublication: "validated_then_discarded_not_reported",
    credentialAbsenceVerification: "not_claimed",
    taskPrompt: "runtime_owned_stdin_only_not_reported",
    workbenchAdvice:
      "provider_envelope_removed_and_advice_json_published_after_cleanup_only",
    rawOutputReported: false,
    hostPathReported: false,
    proxyCredentialReported: false,
    productionPreparedPlan: "runtime_owned_adapter_connected",
    productionRecovery:
      "runtime_state_docker_task_recovery_and_deferred_host_finalization_connected",
    productionMountCompletion: "runtime_owned_mount_lease_connected",
    productionRevisionBinding: "runtime_owned_repository_revision_connected",
    productionEffectExecutor: "fixed_docker_cli_connected",
  });
}

export const COORDINATOR_TASK_RUNTIME_CONTRACT =
  "crdd-coordinator/task-runtime";

export const COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION = 36;

const PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS = 10_000;

const EXTERNAL_SEND_CONFIRMATION_REASONS = new Set([
  "external_send_confirmation_declined_invalid",
  "external_send_confirmation_cancelled",
  "external_send_confirmation_timeout",
  "external_send_confirmation_unavailable",
  "external_send_confirmation_reader_failed",
  "external_send_confirmation_cleanup_unknown",
  "external_send_confirmation_cleanup_unknown_process_restart_required",
  "external_send_consent_cleanup_unknown_process_restart_required",
  "external_send_consent_manual_recovery_required",
]);

const PROCESS_CANCELLATION_RESULT_KEYS = new Set([
  "status",
  "reason",
  "cancellationRequested",
  "processTerminationObserved",
]);

const PROVIDER_TURN_OBSERVATION_KEYS = new Set([
  "provider",
  "taskRole",
  "requestedMaximumTurns",
  "providerReportedTurns",
  "resultAcceptanceMaximumTurns",
  "requestedTurnTargetExceeded",
]);

const REVIEWER_FINDING_DIAGNOSTIC_KEYS = new Set([
  "severity",
  "path",
  "category",
  "criterionNumber",
  "messageSha256",
]);

const PROVIDER_EXECUTION_OBSERVATION_KEYS = new Set([
  "transport",
  "turnCompleted",
  "commandExecutionStartedCount",
  "commandExecutionCompletedCount",
  "commandExecutionFailedCount",
  "commandExecutionDeclinedCount",
  "commandExecutionExitCode0Count",
  "commandExecutionExitCode1Count",
  "commandExecutionExitCode126Count",
  "commandExecutionExitCode127Count",
  "commandExecutionOtherNonzeroExitCodeCount",
  "commandExecutionMissingExitCodeCount",
  "commandFamilyPythonCount",
  "commandFamilyPosixTextCount",
  "commandFamilyGitCount",
  "commandFamilyApplyPatchCount",
  "commandFailurePermissionCount",
  "commandFailureReadOnlyFilesystemCount",
  "commandFailureMissingPathCount",
  "commandFailureCommandNotFoundCount",
  "commandFailureSyntaxCount",
  "commandFailureSandboxCount",
  "commandFailureUnclassifiedCount",
  "fileChangeStartedCount",
  "fileChangeCompletedCount",
  "fileChangeFailedCount",
  "fileChangeDeclinedCount",
  "rawEventReported",
  "commandReported",
  "pathReported",
  "providerTextReported",
]);

const REVIEWER_PROJECTION_KEYS = new Set([
  "status",
  "candidatePatchHash",
  "candidateContentManifestHash",
  "projectionHash",
  "totalBytes",
  "files",
]);

const REVIEWER_PROJECTION_FILE_KEYS = new Set([
  "path",
  "state",
  "byteLength",
  "sha256",
  "encoding",
  "content",
]);

const INVALID_CONTROL_CANCELLATION_RESULT = Object.freeze({
  status: "blocked" as const,
  reason: "coordinator_task_control_invalid" as const,
});

/**
 * coordinator-task-runtimeで使用するProviderの値契約を定義する。
 *
 * @responsibility ProviderのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";

/**
 * coordinator-task-runtimeで使用するTask Roleの値契約を定義する。
 *
 * @responsibility Task RoleのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskRoleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskRoleで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskRoleの宣言は外部境界を開かない。
 * @security TaskRoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskRoleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskRole = "executor" | "reviewer";

/**
 * coordinator-task-runtimeで使用するRuntime Lifecycle 状態の値契約を定義する。
 *
 * @responsibility Runtime Lifecycle 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeLifecycleStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeLifecycleStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeLifecycleStateの宣言は外部境界を開かない。
 * @security RuntimeLifecycleStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeLifecycleStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RuntimeLifecycleState =
  | "STATE-ADMISSION"
  | "STATE-OPERATION-ACQUIRING"
  | "STATE-OPERATION-READY"
  | "STATE-TASK-AUTHORIZED"
  | "STATE-EXECUTOR-CLEAN"
  | "STATE-CANDIDATE-CAPTURED"
  | "STATE-REVIEWER-CLEAN"
  | "STATE-REMEDIATION-AUTHORIZED"
  | "STATE-REMEDIATION-EXECUTOR-CLEAN"
  | "STATE-REMEDIATION-CANDIDATE-CAPTURED"
  | "STATE-REMEDIATION-REVIEWER-CLEAN"
  | "STATE-HOST-CLEAN"
  | "STATE-RESULT-PUBLISHED"
  | "STATE-BLOCKED-CLEAN"
  | "STATE-PROCESS-RESTART-REQUIRED"
  | "STATE-RECOVERY-REQUIRED"
  | "STATE-OPERATOR-TRANSFER-REQUIRED";

/**
 * coordinator-task-runtimeで使用するRuntime 記録の値契約を定義する。
 *
 * @responsibility Runtime 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeRecordの宣言は外部境界を開かない。
 * @security RuntimeRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeRecord = Readonly<Record<string, unknown>>;

const INTERNAL_TASK_OUTCOME = Symbol("internalTaskOutcome");

/**
 * coordinator-task-runtimeで使用するInternal Task Outcomeの値契約を定義する。
 *
 * @responsibility Internal Task OutcomeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape InternalTaskOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant InternalTaskOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: InternalTaskOutcomeの宣言は外部境界を開かない。
 * @security InternalTaskOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility InternalTaskOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type InternalTaskOutcome = Readonly<{
  [INTERNAL_TASK_OUTCOME]: true;
  publicResult: RuntimeRecord;
  dockerCleanupEligible: boolean;
}>;

/**
 * coordinator-task-runtimeで使用するTask Completion 記録の値契約を定義する。
 *
 * @responsibility Task Completion 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape TaskCompletionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskCompletionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskCompletionRecordの宣言は外部境界を開かない。
 * @security TaskCompletionRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskCompletionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type TaskCompletionRecord = RuntimeRecord &
  Readonly<{
    status: string;
    reason: CoordinatorTaskPublicReason;
    cleanupConfirmed: boolean;
    manualRecoveryRequired: boolean;
    processRestartRequired: boolean;
    hostRecoveryId: string | null;
    dockerRecoveryId: string | null;
    dockerRecoveryIds: readonly string[];
    candidateRecoveryId: string | null;
    candidateStoreRecoveryId: string | null;
    candidateRevision:
      | (RuntimeRecord & Readonly<{ changedPaths?: readonly string[] }>)
      | null;
    candidateId: string | null;
    expiresAtMs?: number | null;
    executorProvider: unknown;
    reviewerProvider: unknown;
    canonicalRepositoryChanged: boolean | null;
  }>;

/**
 * coordinator-task-runtimeで使用するOperationの値契約を定義する。
 *
 * @responsibility OperationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Operationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Operationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Operationの宣言は外部境界を開かない。
 * @security OperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Operationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type Operation = Readonly<{
  owned: object;
  mountCapability: object;
  managementCapability: object;
  operationId: string;
  hostRecoveryId: string;
  hostGenerationFailureDetected?: Promise<void>;
  hostGenerationLoss?: Promise<"cleanup_confirmed_failure" | "cleanup_unknown">;
  releaseHostGenerationDrain?: () => boolean;
}>;

/**
 * coordinator-task-runtimeで使用するHost 清掃 Statusの値契約を定義する。
 *
 * @responsibility Host 清掃 StatusのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape HostCleanupStatusが表すProperty、識別子およびRelationを型として固定する。
 * @invariant HostCleanupStatusで宣言した値と責務の対応を維持する。
 * @boundary N/A: HostCleanupStatusの宣言は外部境界を開かない。
 * @security HostCleanupStatusはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility HostCleanupStatusの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type HostCleanupStatus = "completed" | "protocol_failure_cleanup_confirmed";

/**
 * coordinator-task-runtimeで使用するRuntime Dependenciesの値契約を定義する。
 *
 * @responsibility Runtime DependenciesのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type taskRuntimeDependencies = Readonly<{
  beginInvocation?: (
    provider: Provider,
    role: TaskRole,
  ) => Readonly<{
    commandRestriction: (purpose: string) => boolean;
    settle: () => unknown;
  }> | null;
  observeLifecycleState?: (state: RuntimeLifecycleState) => void;
  inspectRepository: (repositoryRoot: string) => RuntimeRecord | null;
  createOperation: () => Operation | Promise<Operation>;
  classifyOperationCreationFailure: (
    error: unknown,
  ) => ProductionOperationFailure | null;
  cleanupOperation: (owned: object) => unknown | Promise<unknown>;
  classifyOperationCleanup: (
    outcome: unknown,
    owned: unknown,
  ) => HostCleanupStatus | null;
  abandonOperation: (managementCapability: object) => Promise<unknown>;
  poisonProcessAfterCleanupUnknown?: () => void;
  isProcessPoisoned?: () => boolean;
  bindRepository: (
    managementCapability: object,
    repositoryRoot: string,
  ) => RuntimeRecord | null;
  materializeWorkspace: (
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    readPaths: readonly string[],
    borrowedTarget?: BorrowedExecutionTarget,
  ) => RuntimeRecord | null;
  projectReviewerReadContent?: (
    workspaceCapability: object,
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    readPaths: readonly string[],
  ) => RuntimeRecord | null;
  issueSelection: (
    managementCapability: object,
    request: RuntimeRecord,
  ) => RuntimeRecord;
  preflightSlate: (
    managementCapability: object,
    request: RuntimeRecord,
  ) => RuntimeRecord;
  revokeSelection: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  observeProviderHome: (provider: Provider) => RuntimeRecord;
  issueMountGrant: (
    managementCapability: object,
    observationCapability: object,
    profileId: string,
  ) => RuntimeRecord;
  consumeMountGrant: (
    useCapability: object,
    managementCapability: object,
    observationCapability: object,
  ) => RuntimeRecord;
  revokeMountGrant: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  authorizeExternalSend: (
    managementCapability: object,
    repositoryBindingCapability: object,
    policyCapability: object,
    scope: RuntimeRecord,
    providers: readonly Provider[],
    cancellationSignal: AbortSignal,
  ) => RuntimeRecord | null | Promise<RuntimeRecord | null>;
  resolveExternalSendPolicy: (
    managementCapability: object,
    repositoryBindingCapability: object,
  ) => RuntimeRecord | null;
  prepareDockerRecoveryState: (repositoryRoot: string) => unknown;
  reportSelectionNotice: (notice: RuntimeRecord) => boolean;
  reportExternalSendNotice: (notice: RuntimeRecord) => boolean;
  issueTaskPacket: (
    managementCapability: object,
    repositoryBindingCapability: object,
    provider: Provider,
    taskRole: TaskRole,
    taskAttempt: 0 | 1,
    externalSendGrantCapability: object,
    remediationCapability: object | null,
    packet: RuntimeRecord,
  ) => RuntimeRecord | null;
  revokeTaskPacket: (
    controlCapability: object,
    managementCapability: object,
  ) => RuntimeRecord;
  prepareProvider: (
    provider: Provider,
    managementCapability: object,
    mountCapability: object,
    mountAuthorizationCapability: object,
    selectionUseCapability: object,
    taskPacketUseCapability: object,
    recoveryCorrelationId: string | null,
    consumer: "coordinator_cli" | "workbench" | "orchestrator",
  ) => RuntimeRecord;
  startProcess: (
    preparedCapability: object,
    managementCapability: object,
    registerRecoveryHandoff: (
      recoveryCapability: unknown,
      recoveryId: unknown,
    ) => boolean,
    commandRestriction?: unknown,
    observeProviderStarted?: (
      notice: ProviderProcessStartedNotice,
    ) => boolean | Promise<boolean>,
  ) => RuntimeRecord;
  cancelProcess: (
    controlCapability: object,
    managementCapability: object,
  ) => Promise<unknown>;
  captureCandidate: (
    workspaceCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
    allowedPaths: readonly string[],
  ) => RuntimeRecord | null;
  verifyCandidate: (
    candidateCapability: object,
    repositoryBindingCapability: object,
    managementCapability: object,
    mountCapability: object,
  ) => RuntimeRecord | null;
  finalizeDockerRecovery?: (capability: object) => RuntimeRecord;
  readDockerProjectResult?: typeof readRuntimeOwnedDockerProjectResult;
  prepareDockerHostCleanup?: (capability: object) => string | null;
  recordDockerHostCleanupReceipt?: (
    capability: object,
    completion: Readonly<{
      hostCleanupOutcome: unknown;
      dockerCompletion: unknown;
    }>,
  ) => boolean;
  abandonDockerRecovery?: (capability: object) => boolean;
  isolatedCancellationAckTimeoutMs?: number;
}>;

/**
 * coordinator-task-runtimeで使用するControl 記録の値契約を定義する。
 *
 * @responsibility Control 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ControlRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ControlRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ControlRecordの宣言は外部境界を開かない。
 * @security ControlRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ControlRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ControlRecord = {
  workspaceTarget?: BorrowedExecutionTarget;
  borrowedWorkspaceCapability?: object;
  lifecycleState: RuntimeLifecycleState;
  managementCapability: object;
  currentProcessControl: object | null;
  cancellationRequested: boolean;
  cancellationReceipt: Promise<RuntimeRecord> | null;
  cancellationSettlement: Promise<"confirmed" | "unknown"> | null;
  cancellationProtocolFailure: boolean;
  cancellationController: AbortController;
  ownedOperation: object | null;
  retainOperationRoot: boolean;
  processPoisoned: boolean;
  hostCleanupCompleted: boolean;
  hostRecoveryId: string | null;
  hostGenerationLossOutcome:
    | "cleanup_confirmed_failure"
    | "cleanup_unknown"
    | null;
  hostGenerationLoss: Promise<
    "cleanup_confirmed_failure" | "cleanup_unknown"
  > | null;
  hostGenerationLossHandling: Promise<void> | null;
  hostGenerationFailureHandling: Promise<void> | null;
  hostGenerationFailureObserved: boolean;
  releaseHostGenerationDrain: (() => boolean) | null;
  dockerFinalizations: Array<
    Readonly<{
      capability: object;
      recoveryId: string;
      dockerCompletion: unknown;
    }>
  >;
  dockerHandoffs: Array<{
    capability: object;
    recoveryId: string;
    state: "active" | "finalizable" | "finalized" | "abandoned";
  }>;
  recoveryCorrelationId: string | null;
  consumer: "coordinator_cli" | "workbench" | "orchestrator";
  observeProviderStarted:
    | ((notice: ProviderProcessStartedNotice) => boolean | Promise<boolean>)
    | undefined;
};

/**
 * coordinator-task-runtimeで使用するRuntime 状態の値契約を定義する。
 *
 * @responsibility Runtime 状態のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type taskRuntimeState = Readonly<{
  dependencies: taskRuntimeDependencies;
  controls: WeakMap<object, ControlRecord>;
}>;

/**
 * Lifecycle 状態を次の状態へ進める。
 *
 * @responsibility Lifecycle 状態の遷移条件、次状態、無効遷移の拒否境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、control: ControlRecord、next: RuntimeLifecycleState
 * @returns advanceLifecycleStateの計算結果を返す。
 * @precondition 「state: RuntimeState、control: ControlRecord、next: RuntimeLifecycleState」がadvanceLifecycleStateの入力契約を満たす。
 * @postcondition advanceLifecycleStateの責務を完了した結果だけを返す。
 * @effect N/A: advanceLifecycleStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure advanceLifecycleStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant advanceLifecycleStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: advanceLifecycleStateはProcess内の同一Subsystemで完結する。
 * @security advanceLifecycleStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: advanceLifecycleStateは共有非同期状態を持たない同期処理である。
 */
function advanceLifecycleState(
  state: taskRuntimeState,
  control: ControlRecord,
  next: RuntimeLifecycleState,
) {
  if (control.lifecycleState === next) return;
  control.lifecycleState = next;
  try {
    state.dependencies.observeLifecycleState?.(next);
  } catch {
    // Passive observation must not gain control over Runtime state or Effect.
  }
}

/**
 * final Projection 失敗を決定する。
 *
 * @responsibility final Projection 失敗の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input result: TaskCompletionRecord、control: ControlRecord
 * @returns finalProjectionFailureの計算結果を返す。
 * @precondition 「result: TaskCompletionRecord、control: ControlRecord」がfinalProjectionFailureの入力契約を満たす。
 * @postcondition finalProjectionFailureの責務を完了した結果だけを返す。
 * @effect N/A: finalProjectionFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finalProjectionFailureは独自の失敗分岐を所有しない。
 * @invariant finalProjectionFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finalProjectionFailureはProcess内の同一Subsystemで完結する。
 * @security finalProjectionFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finalProjectionFailureは共有非同期状態を持たない同期処理である。
 */
function finalProjectionFailure(
  result: TaskCompletionRecord,
  control: ControlRecord,
) {
  const dockerRecoveryIds = Object.freeze([
    ...new Set([
      ...result.dockerRecoveryIds,
      ...controlDockerRecoveryIds(control),
    ]),
  ]);
  return Object.freeze({
    ...result,
    status: "blocked" as const,
    reason: "coordinator_task_final_projection_failed_closed",
    cleanupConfirmed: false,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    hostRecoveryId: result.hostRecoveryId ?? control.hostRecoveryId,
    dockerRecoveryId:
      dockerRecoveryIds.length === 1 ? (dockerRecoveryIds[0] ?? null) : null,
    dockerRecoveryIds,
  }) as TaskCompletionRecord;
}

/**
 * Blockedを構築する。
 *
 * @responsibility Blockedの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input reason: string、manualRecoveryRequired、hostRecoveryId: string | null、dockerRecoveryId: string | null、candidateRecoveryId: string | null、isCleanupConfirmedOverride: boolean | null、candidateStoreRecoveryId: string | null、dockerRecoveryIds: readonly string[]
 * @returns createBlockedの計算結果を返す。
 * @precondition 「reason: string、manualRecoveryRequired、hostRecoveryId: string | null、dockerRecoveryId: string | null、candidateRecoveryId: string | null、isCleanupConfirmedOverride: boolean | null、candidateStoreRecoveryId: string | null、dockerRecoveryIds: readonly string[]」がcreateBlockedの入力契約を満たす。
 * @postcondition createBlockedの責務を完了した結果だけを返す。
 * @effect N/A: createBlockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createBlockedは独自の失敗分岐を所有しない。
 * @invariant createBlockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createBlockedはProcess内の同一Subsystemで完結する。
 * @security createBlockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createBlockedは共有非同期状態を持たない同期処理である。
 */
function createBlocked(
  reason: CoordinatorTaskPublicReason,
  manualRecoveryRequired = false,
  hostRecoveryId: string | null = null,
  dockerRecoveryId: string | null = null,
  candidateRecoveryId: string | null = null,
  isCleanupConfirmedOverride: boolean | null = null,
  candidateStoreRecoveryId: string | null = null,
  dockerRecoveryIds: readonly string[] = dockerRecoveryId
    ? [dockerRecoveryId]
    : [],
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    cleanupConfirmed:
      isCleanupConfirmedOverride === null
        ? !manualRecoveryRequired
        : isCleanupConfirmedOverride,
    manualRecoveryRequired,
    hostRecoveryId: manualRecoveryRequired ? hostRecoveryId : null,
    dockerRecoveryId: manualRecoveryRequired ? dockerRecoveryId : null,
    dockerRecoveryIds: manualRecoveryRequired
      ? Object.freeze([...new Set(dockerRecoveryIds)])
      : Object.freeze([]),
    candidateRecoveryId: manualRecoveryRequired ? candidateRecoveryId : null,
    candidateStoreRecoveryId: manualRecoveryRequired
      ? candidateStoreRecoveryId
      : null,
    executorProvider: null,
    reviewerProvider: null,
    executorSelectionNotice: null,
    reviewerSelectionNotice: null,
    candidateRevision: null,
    candidateId: null,
    executorResult: null,
    reviewerResult: null,
    canonicalRepositoryChanged: false,
    rawOutputReported: false,
    hostPathReported: false,
    untrustedProviderTextReported: false,
    credentialAbsenceVerified: false,
  });
}

const blocked = createBlocked;

/**
 * object Capabilityを決定する。
 *
 * @responsibility object Capabilityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns objectCapabilityの計算結果を返す。
 * @precondition 「value: unknown」がobjectCapabilityの入力契約を満たす。
 * @postcondition objectCapabilityの責務を完了した結果だけを返す。
 * @effect N/A: objectCapabilityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: objectCapabilityは独自の失敗分岐を所有しない。
 * @invariant objectCapabilityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: objectCapabilityはProcess内の同一Subsystemで完結する。
 * @security objectCapabilityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: objectCapabilityは共有非同期状態を持たない同期処理である。
 */
function objectCapability(value: unknown) {
  return value && typeof value === "object" ? (value as object) : null;
}

/**
 * string Valueを決定する。
 *
 * @responsibility string Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns stringValueの計算結果を返す。
 * @precondition 「value: unknown」がstringValueの入力契約を満たす。
 * @postcondition stringValueの責務を完了した結果だけを返す。
 * @effect N/A: stringValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: stringValueは独自の失敗分岐を所有しない。
 * @invariant stringValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: stringValueはProcess内の同一Subsystemで完結する。
 * @security stringValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stringValueは共有非同期状態を持たない同期処理である。
 */
function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * own Plain Data Valueを決定する。
 *
 * @responsibility own Plain Data Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、key: string
 * @returns ownPlainDataValueの計算結果を返す。
 * @precondition 「value: unknown、key: string」がownPlainDataValueの入力契約を満たす。
 * @postcondition ownPlainDataValueの責務を完了した結果だけを返す。
 * @effect N/A: ownPlainDataValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure ownPlainDataValueは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant ownPlainDataValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownPlainDataValueはProcess内の同一Subsystemで完結する。
 * @security ownPlainDataValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: ownPlainDataValueは共有非同期状態を持たない同期処理である。
 */
function ownPlainDataValue(value: unknown, key: string) {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return undefined;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor &&
      Object.hasOwn(descriptor, "value") &&
      descriptor.get === undefined &&
      descriptor.set === undefined &&
      descriptor.enumerable === true
      ? descriptor.value
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Provider Turn Observationを公開結果へ投影する。
 *
 * @responsibility Provider Turn Observationの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectProviderTurnObservationの計算結果を返す。
 * @precondition 「value: unknown」がprojectProviderTurnObservationの入力契約を満たす。
 * @postcondition projectProviderTurnObservationの責務を完了した結果だけを返す。
 * @effect N/A: projectProviderTurnObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectProviderTurnObservationは独自の失敗分岐を所有しない。
 * @invariant projectProviderTurnObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectProviderTurnObservationはProcess内の同一Subsystemで完結する。
 * @security projectProviderTurnObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectProviderTurnObservationは共有非同期状態を持たない同期処理である。
 */
function projectProviderTurnObservation(value: unknown) {
  const record = snapshotPlainRecord(value, PROVIDER_TURN_OBSERVATION_KEYS);
  if (!record) return null;
  const provider = record.provider;
  const taskRole = record.taskRole;
  const requestedMaximumTurns = record.requestedMaximumTurns;
  const providerReportedTurns = record.providerReportedTurns;
  const resultAcceptanceMaximumTurns = record.resultAcceptanceMaximumTurns;
  const requestedTurnTargetExceeded = record.requestedTurnTargetExceeded;
  if (
    provider !== "claude" ||
    (taskRole !== "executor" && taskRole !== "reviewer") ||
    !Number.isSafeInteger(requestedMaximumTurns) ||
    (requestedMaximumTurns as number) < 1 ||
    !Number.isSafeInteger(providerReportedTurns) ||
    (providerReportedTurns as number) < 1 ||
    !Number.isSafeInteger(resultAcceptanceMaximumTurns) ||
    resultAcceptanceMaximumTurns !== CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS ||
    (taskRole === "executor"
      ? (requestedMaximumTurns as number) < 8
      : (requestedMaximumTurns as number) < 4) ||
    (requestedMaximumTurns as number) >
      CLAUDE_RESULT_ACCEPTANCE_MAXIMUM_TURNS ||
    (providerReportedTurns as number) >
      (resultAcceptanceMaximumTurns as number) ||
    requestedTurnTargetExceeded !==
      (providerReportedTurns as number) > (requestedMaximumTurns as number)
  )
    return null;
  return Object.freeze({
    provider,
    taskRole,
    requestedMaximumTurns: requestedMaximumTurns as number,
    providerReportedTurns: providerReportedTurns as number,
    resultAcceptanceMaximumTurns: resultAcceptanceMaximumTurns as number,
    requestedTurnTargetExceeded,
  });
}

/**
 * sha256 Valueを決定する。
 *
 * @responsibility sha256 Valueの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がsha256Valueの入力契約を満たす。
 * @postcondition sha256Valueの責務を完了した結果だけを返す。
 * @effect N/A: sha256Valueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sha256Valueは独自の失敗分岐を所有しない。
 * @invariant sha256Valueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sha256ValueはProcess内の同一Subsystemで完結する。
 * @security sha256ValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sha256Valueは共有非同期状態を持たない同期処理である。
 */
function sha256Value(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
}

/**
 * Reviewer 結果 Diagnosticsを公開結果へ投影する。
 *
 * @responsibility Reviewer 結果 Diagnosticsの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectReviewerResultDiagnosticsの計算結果を返す。
 * @precondition 「value: unknown」がprojectReviewerResultDiagnosticsの入力契約を満たす。
 * @postcondition projectReviewerResultDiagnosticsの責務を完了した結果だけを返す。
 * @effect N/A: projectReviewerResultDiagnosticsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectReviewerResultDiagnosticsは独自の失敗分岐を所有しない。
 * @invariant projectReviewerResultDiagnosticsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectReviewerResultDiagnosticsはProcess内の同一Subsystemで完結する。
 * @security projectReviewerResultDiagnosticsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectReviewerResultDiagnosticsは共有非同期状態を持たない同期処理である。
 */
function projectReviewerResultDiagnostics(value: unknown) {
  const decision = ownPlainDataValue(value, "decision");
  const findingCount = ownPlainDataValue(value, "findingCount");
  const diagnostics = snapshotPlainArray<unknown>(
    ownPlainDataValue(value, "findingDiagnostics"),
    64,
  );
  if (
    (decision !== "approved" && decision !== "changes_requested") ||
    !Number.isSafeInteger(findingCount) ||
    (findingCount as number) < 0 ||
    diagnostics.status !== "ok" ||
    diagnostics.value.length !== findingCount
  )
    return null;
  const projectedDiagnostics = diagnostics.value.map((item) => {
    const record = snapshotPlainRecord(item, REVIEWER_FINDING_DIAGNOSTIC_KEYS);
    if (
      !record ||
      typeof record.severity !== "string" ||
      typeof record.path !== "string" ||
      typeof record.category !== "string" ||
      !Number.isSafeInteger(record.criterionNumber) ||
      !sha256Value(record.messageSha256)
    )
      return null;
    return Object.freeze({
      severity: record.severity,
      path: record.path,
      category: record.category,
      criterionNumber: record.criterionNumber,
      messageSha256: record.messageSha256,
    });
  });
  if (projectedDiagnostics.some((item) => item === null)) return null;
  return Object.freeze({
    decision,
    findingCount: findingCount as number,
    findingDiagnostics: Object.freeze(projectedDiagnostics),
  });
}

/**
 * Executor 結果 Diagnosticsを公開結果へ投影する。
 *
 * @responsibility Executor 結果 Diagnosticsの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectExecutorResultDiagnosticsの計算結果を返す。
 * @precondition 「value: unknown」がprojectExecutorResultDiagnosticsの入力契約を満たす。
 * @postcondition projectExecutorResultDiagnosticsの責務を完了した結果だけを返す。
 * @effect N/A: projectExecutorResultDiagnosticsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectExecutorResultDiagnosticsは独自の失敗分岐を所有しない。
 * @invariant projectExecutorResultDiagnosticsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectExecutorResultDiagnosticsはProcess内の同一Subsystemで完結する。
 * @security projectExecutorResultDiagnosticsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectExecutorResultDiagnosticsは共有非同期状態を持たない同期処理である。
 */
function projectExecutorResultDiagnostics(value: unknown) {
  const status = ownPlainDataValue(value, "status");
  const changedPaths = snapshotPlainArray<unknown>(
    ownPlainDataValue(value, "changedPaths"),
    1_000,
  );
  const verificationCount = ownPlainDataValue(value, "verificationCount");
  const observation = snapshotPlainRecord(
    ownPlainDataValue(value, "providerExecutionObservation"),
    PROVIDER_EXECUTION_OBSERVATION_KEYS,
  );
  if (
    status !== "completed" ||
    changedPaths.status !== "ok" ||
    !changedPaths.value.every((path) => typeof path === "string") ||
    !Number.isSafeInteger(verificationCount) ||
    (verificationCount as number) < 0
  )
    return null;
  let providerExecutionObservation = null;
  if (observation) {
    const countKeys = [
      "commandExecutionStartedCount",
      "commandExecutionCompletedCount",
      "commandExecutionFailedCount",
      "commandExecutionDeclinedCount",
      "commandExecutionExitCode0Count",
      "commandExecutionExitCode1Count",
      "commandExecutionExitCode126Count",
      "commandExecutionExitCode127Count",
      "commandExecutionOtherNonzeroExitCodeCount",
      "commandExecutionMissingExitCodeCount",
      "commandFamilyPythonCount",
      "commandFamilyPosixTextCount",
      "commandFamilyGitCount",
      "commandFamilyApplyPatchCount",
      "commandFailurePermissionCount",
      "commandFailureReadOnlyFilesystemCount",
      "commandFailureMissingPathCount",
      "commandFailureCommandNotFoundCount",
      "commandFailureSyntaxCount",
      "commandFailureSandboxCount",
      "commandFailureUnclassifiedCount",
      "fileChangeStartedCount",
      "fileChangeCompletedCount",
      "fileChangeFailedCount",
      "fileChangeDeclinedCount",
    ] as const;
    if (
      observation.transport !== "fixed_cli_jsonl_v0_149_1" ||
      observation.turnCompleted !== true ||
      !countKeys.every(
        (key) =>
          Number.isSafeInteger(observation[key]) &&
          (observation[key] as number) >= 0,
      ) ||
      observation.rawEventReported !== false ||
      observation.commandReported !== false ||
      observation.pathReported !== false ||
      observation.providerTextReported !== false
    )
      return null;
    providerExecutionObservation = Object.freeze({ ...observation });
  }
  return Object.freeze({
    status,
    changedPaths: Object.freeze([...changedPaths.value] as string[]),
    verificationCount: verificationCount as number,
    ...(providerExecutionObservation ? { providerExecutionObservation } : {}),
  });
}

/**
 * Reviewer Projection Evidenceを公開結果へ投影する。
 *
 * @responsibility Reviewer Projection Evidenceの公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns projectReviewerProjectionEvidenceの計算結果を返す。
 * @precondition 「value: unknown」がprojectReviewerProjectionEvidenceの入力契約を満たす。
 * @postcondition projectReviewerProjectionEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: projectReviewerProjectionEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectReviewerProjectionEvidenceは独自の失敗分岐を所有しない。
 * @invariant projectReviewerProjectionEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectReviewerProjectionEvidenceはProcess内の同一Subsystemで完結する。
 * @security projectReviewerProjectionEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectReviewerProjectionEvidenceは共有非同期状態を持たない同期処理である。
 */
function projectReviewerProjectionEvidence(value: unknown) {
  const record = snapshotPlainRecord(value, REVIEWER_PROJECTION_KEYS);
  const files = record
    ? snapshotPlainArray<unknown>(record.files, 1_000)
    : null;
  if (
    record?.status !== "projected" ||
    !sha256Value(record.candidatePatchHash) ||
    !sha256Value(record.candidateContentManifestHash) ||
    !sha256Value(record.projectionHash) ||
    !Number.isSafeInteger(record.totalBytes) ||
    (record.totalBytes as number) < 0 ||
    files?.status !== "ok"
  )
    return null;
  const projectedFiles = files.value.map((item) => {
    const file = snapshotPlainRecord(item, REVIEWER_PROJECTION_FILE_KEYS);
    if (
      !file ||
      typeof file.path !== "string" ||
      file.state !== "present" ||
      !Number.isSafeInteger(file.byteLength) ||
      (file.byteLength as number) < 0 ||
      !sha256Value(file.sha256) ||
      file.encoding !== "utf-8" ||
      typeof file.content !== "string"
    )
      return null;
    return Object.freeze({
      path: file.path,
      state: file.state,
      byteLength: file.byteLength,
      sha256: file.sha256,
      encoding: file.encoding,
    });
  });
  if (projectedFiles.some((item) => item === null)) return null;
  return Object.freeze({
    candidatePatchHash: record.candidatePatchHash,
    candidateContentManifestHash: record.candidateContentManifestHash,
    projectionHash: record.projectionHash,
    totalBytes: record.totalBytes,
    files: Object.freeze(projectedFiles),
    contentReported: false,
  });
}

/**
 * Runtime 記録を所有Snapshotへ変換する。
 *
 * @responsibility Runtime 記録の取得範囲、plain-data制約、拒否境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns RuntimeRecord | nullを返す。
 * @precondition 「value: unknown」がsnapshotRuntimeRecordの入力契約を満たす。
 * @postcondition snapshotRuntimeRecordの責務を完了した結果だけを返す。
 * @effect N/A: snapshotRuntimeRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotRuntimeRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotRuntimeRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotRuntimeRecordはProcess内の同一Subsystemで完結する。
 * @security snapshotRuntimeRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotRuntimeRecordは共有非同期状態を持たない同期処理である。
 */
function snapshotRuntimeRecord(value: unknown): RuntimeRecord | null {
  try {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value) ||
      utilTypes.isProxy(value)
    )
      return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const snapshot: Record<string, unknown> = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string") return null;
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
    if (
      typeof snapshot.status !== "string" ||
      typeof snapshot.reason !== "string"
    )
      return null;
    return Object.freeze(snapshot);
  } catch {
    return null;
  }
}

/**
 * Process Cancellation Receiptが完全一致するか判定する。
 *
 * @responsibility Process Cancellation Receiptの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns exactProcessCancellationReceiptの計算結果を返す。
 * @precondition 「value: unknown」がexactProcessCancellationReceiptの入力契約を満たす。
 * @postcondition exactProcessCancellationReceiptの責務を完了した結果だけを返す。
 * @effect N/A: exactProcessCancellationReceiptは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactProcessCancellationReceiptは独自の失敗分岐を所有しない。
 * @invariant exactProcessCancellationReceiptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactProcessCancellationReceiptはProcess内の同一Subsystemで完結する。
 * @security exactProcessCancellationReceiptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactProcessCancellationReceiptは共有非同期状態を持たない同期処理である。
 */
function exactProcessCancellationReceipt(value: unknown) {
  const receipt = snapshotPlainRecord(value, PROCESS_CANCELLATION_RESULT_KEYS);
  if (
    receipt?.status !== "requested" ||
    receipt.cancellationRequested !== true ||
    typeof receipt.processTerminationObserved !== "boolean" ||
    (receipt.processTerminationObserved === true &&
      receipt.reason !== "provider_cancellation_requested") ||
    (receipt.processTerminationObserved === false &&
      receipt.reason !== "provider_cancellation_grace_exceeded")
  )
    return null;
  return Object.freeze({ ...receipt });
}

/**
 * Control Cancellationを要求する。
 *
 * @responsibility Control Cancellationの要求条件、受理結果、Effect未成立との分離境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、control: ControlRecord
 * @returns requestControlCancellationの計算結果を返す。
 * @precondition 「state: RuntimeState、control: ControlRecord」がrequestControlCancellationの入力契約を満たす。
 * @postcondition requestControlCancellationの責務を完了した結果だけを返す。
 * @effect N/A: requestControlCancellationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requestControlCancellationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requestControlCancellationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requestControlCancellationはProcess内の同一Subsystemで完結する。
 * @security requestControlCancellationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency requestControlCancellationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function requestControlCancellation(
  state: taskRuntimeState,
  control: ControlRecord,
) {
  if (control.cancellationReceipt) return control.cancellationReceipt;
  control.cancellationRequested = true;
  control.cancellationController.abort();
  const processControl = control.currentProcessControl;
  const receipt = (async () => {
    if (!processControl)
      return Object.freeze({
        status: "requested" as const,
        reason: "provider_cancellation_requested",
        cancellationRequested: true,
        processTerminationObserved: true,
      });
    const observed = await state.dependencies.cancelProcess(
      processControl,
      control.managementCapability,
    );
    const receipt = exactProcessCancellationReceipt(observed);
    if (!receipt)
      throw new Error("coordinator_task_cancellation_receipt_invalid");
    return receipt;
  })();
  control.cancellationReceipt = receipt;
  const isolatedTimeout = state.dependencies.isolatedCancellationAckTimeoutMs;
  const timeoutMs =
    Number.isSafeInteger(isolatedTimeout) && Number(isolatedTimeout) > 0
      ? Number(isolatedTimeout)
      : PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS;
  control.cancellationSettlement = new Promise<"confirmed" | "unknown">(
    (resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;
      const settle = (outcome: "confirmed" | "unknown") => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (outcome === "unknown") {
          control.cancellationProtocolFailure = true;
          try {
            poisonRuntimeProcess(state, control);
          } catch {
            control.processPoisoned = true;
          }
        }
        resolve(outcome);
      };
      timeout = setTimeout(() => settle("unknown"), timeoutMs);
      try {
        Promise.prototype.then.call(
          receipt,
          () => settle("confirmed"),
          () => settle("unknown"),
        );
      } catch {
        settle("unknown");
      }
    },
  );
  return receipt;
}

/**
 * control Docker 回復 Idsを決定する。
 *
 * @responsibility control Docker 回復 Idsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input control: ControlRecord
 * @returns controlDockerRecoveryIdsの計算結果を返す。
 * @precondition 「control: ControlRecord」がcontrolDockerRecoveryIdsの入力契約を満たす。
 * @postcondition controlDockerRecoveryIdsの責務を完了した結果だけを返す。
 * @effect N/A: controlDockerRecoveryIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: controlDockerRecoveryIdsは独自の失敗分岐を所有しない。
 * @invariant controlDockerRecoveryIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: controlDockerRecoveryIdsはProcess内の同一Subsystemで完結する。
 * @security controlDockerRecoveryIdsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: controlDockerRecoveryIdsは共有非同期状態を持たない同期処理である。
 */
function controlDockerRecoveryIds(control: ControlRecord) {
  return Object.freeze([
    ...new Set(
      control.dockerHandoffs
        .filter((handoff) => handoff.state !== "finalized")
        .map((handoff) => handoff.recoveryId),
    ),
  ]);
}

/**
 * actionable Docker 回復 Idsを決定する。
 *
 * @responsibility actionable Docker 回復 Idsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input control: ControlRecord、preferredRecoveryIds: readonly string[]
 * @returns actionableDockerRecoveryIdsの計算結果を返す。
 * @precondition 「control: ControlRecord、preferredRecoveryIds: readonly string[]」がactionableDockerRecoveryIdsの入力契約を満たす。
 * @postcondition actionableDockerRecoveryIdsの責務を完了した結果だけを返す。
 * @effect N/A: actionableDockerRecoveryIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: actionableDockerRecoveryIdsは独自の失敗分岐を所有しない。
 * @invariant actionableDockerRecoveryIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: actionableDockerRecoveryIdsはProcess内の同一Subsystemで完結する。
 * @security actionableDockerRecoveryIdsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: actionableDockerRecoveryIdsは共有非同期状態を持たない同期処理である。
 */
function actionableDockerRecoveryIds(
  control: ControlRecord,
  preferredRecoveryIds: readonly string[] = [],
) {
  return Object.freeze([
    ...new Set([...preferredRecoveryIds, ...controlDockerRecoveryIds(control)]),
  ]);
}

/**
 * can Run Managed Docker 清掃を決定する。
 *
 * @responsibility can Run Managed Docker 清掃の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input result: RuntimeRecord、control: ControlRecord
 * @returns canRunManagedDockerCleanupの計算結果を返す。
 * @precondition 「result: RuntimeRecord、control: ControlRecord」がcanRunManagedDockerCleanupの入力契約を満たす。
 * @postcondition canRunManagedDockerCleanupの責務を完了した結果だけを返す。
 * @effect N/A: canRunManagedDockerCleanupは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure canRunManagedDockerCleanupは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant canRunManagedDockerCleanupは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canRunManagedDockerCleanupはProcess内の同一Subsystemで完結する。
 * @security canRunManagedDockerCleanupはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canRunManagedDockerCleanupは共有非同期状態を持たない同期処理である。
 */
function canRunManagedDockerCleanup(
  result: RuntimeRecord,
  control: ControlRecord,
) {
  try {
    const singularDescriptor = Object.getOwnPropertyDescriptor(
      result,
      "dockerRecoveryId",
    );
    const pluralDescriptor = Object.getOwnPropertyDescriptor(
      result,
      "dockerRecoveryIds",
    );
    if (
      !singularDescriptor ||
      !("value" in singularDescriptor) ||
      !pluralDescriptor ||
      !("value" in pluralDescriptor)
    )
      return false;
    const handoffs = Object.freeze(
      control.dockerHandoffs.map((handoff) =>
        Object.freeze({
          state: handoff.state,
          recoveryId: handoff.recoveryId,
          capability: handoff.capability,
        }),
      ),
    );
    const finalizations = Object.freeze(
      control.dockerFinalizations.map((finalization) =>
        Object.freeze({
          recoveryId: finalization.recoveryId,
          capability: finalization.capability,
        }),
      ),
    );
    return evaluateManagedDockerCleanupEligibility({
      raw: Object.freeze({
        singularPresent: singularDescriptor !== undefined,
        singular: singularDescriptor?.value,
        pluralPresent: pluralDescriptor !== undefined,
        plural: pluralDescriptor?.value,
      }),
      handoffs,
      finalizations,
    }).eligible;
  } catch {
    return false;
  }
}

/**
 * poison Runtime Processを決定する。
 *
 * @responsibility poison Runtime Processの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、control: ControlRecord
 * @returns N/A: poisonRuntimeProcessは戻り値を返さない。
 * @precondition 「state: RuntimeState、control: ControlRecord」がpoisonRuntimeProcessの入力契約を満たす。
 * @postcondition poisonRuntimeProcessの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: poisonRuntimeProcessは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: poisonRuntimeProcessは独自の失敗分岐を所有しない。
 * @invariant poisonRuntimeProcessは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: poisonRuntimeProcessはProcess内の同一Subsystemで完結する。
 * @security poisonRuntimeProcessはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: poisonRuntimeProcessは共有非同期状態を持たない同期処理である。
 */
function poisonRuntimeProcess(state: taskRuntimeState, control: ControlRecord) {
  control.processPoisoned = true;
  state.dependencies.poisonProcessAfterCleanupUnknown?.();
}

/**
 * Current Docker 回復を公開結果へ投影する。
 *
 * @responsibility Current Docker 回復の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input result: T、control: ControlRecord
 * @returns projectCurrentDockerRecoveryの計算結果を返す。
 * @precondition 「result: T、control: ControlRecord」がprojectCurrentDockerRecoveryの入力契約を満たす。
 * @postcondition projectCurrentDockerRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: projectCurrentDockerRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectCurrentDockerRecoveryは独自の失敗分岐を所有しない。
 * @invariant projectCurrentDockerRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectCurrentDockerRecoveryはProcess内の同一Subsystemで完結する。
 * @security projectCurrentDockerRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectCurrentDockerRecoveryは共有非同期状態を持たない同期処理である。
 */
function projectCurrentDockerRecovery<T extends RuntimeRecord>(
  result: T,
  control: ControlRecord,
) {
  const finalizedDockerRecoveryIds = new Set(
    control.dockerHandoffs
      .filter((handoff) => handoff.state === "finalized")
      .map((handoff) => handoff.recoveryId),
  );
  const hasExplicitNonDockerRecovery = Boolean(
    stringValue(result.hostRecoveryId) ||
      stringValue(result.candidateRecoveryId) ||
      stringValue(result.candidateStoreRecoveryId),
  );
  const rawDockerRecoveryIds = Array.isArray(result.dockerRecoveryIds)
    ? result.dockerRecoveryIds.filter(
        (value: unknown): value is string => typeof value === "string",
      )
    : [];
  const dockerRecoveryIds = Object.freeze([
    ...new Set(
      [
        ...rawDockerRecoveryIds,
        ...(stringValue(result.dockerRecoveryId)
          ? [String(result.dockerRecoveryId)]
          : []),
        ...controlDockerRecoveryIds(control),
      ].filter((value) => !finalizedDockerRecoveryIds.has(value)),
    ),
  ]);
  const hasRecoveryWithoutIdentifier =
    result.manualRecoveryRequired === true &&
    !hasExplicitNonDockerRecovery &&
    rawDockerRecoveryIds.length === 0 &&
    !stringValue(result.dockerRecoveryId);
  const manualRecoveryRequired =
    hasExplicitNonDockerRecovery ||
    dockerRecoveryIds.length > 0 ||
    hasRecoveryWithoutIdentifier;
  return Object.freeze({
    ...result,
    manualRecoveryRequired,
    cleanupConfirmed:
      manualRecoveryRequired === false
        ? true
        : result.cleanupConfirmed === true,
    dockerRecoveryId:
      dockerRecoveryIds.length === 1 ? dockerRecoveryIds[0] : null,
    dockerRecoveryIds,
  });
}

/**
 * selection Requestを決定する。
 *
 * @responsibility selection Requestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input request: RuntimeRecord、operationId: string、role: "executor" | "independent_reviewer"、subjectProvider: Provider | null、requestedProvider: Provider | null、isRequiresIndependentProvider: boolean
 * @returns selectionRequestの計算結果を返す。
 * @precondition 「request: RuntimeRecord、operationId: string、role: "executor" | "independent_reviewer"、subjectProvider: Provider | null、requestedProvider: Provider | null、isRequiresIndependentProvider: boolean」がselectionRequestの入力契約を満たす。
 * @postcondition selectionRequestの責務を完了した結果だけを返す。
 * @effect N/A: selectionRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectionRequestは独自の失敗分岐を所有しない。
 * @invariant selectionRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectionRequestはProcess内の同一Subsystemで完結する。
 * @security selectionRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: selectionRequestは共有非同期状態を持たない同期処理である。
 */
function selectionRequest(
  request: RuntimeRecord,
  operationId: string,
  role: "executor" | "independent_reviewer",
  subjectProvider: Provider | null,
  requestedProvider: Provider | null,
  isRequiresIndependentProvider: boolean,
) {
  const isIndependentReview = role === "independent_reviewer";
  return Object.freeze({
    frontProvider: request.frontProvider,
    delegationNeed: isIndependentReview ? "required" : "beneficial",
    delegationReason: isIndependentReview
      ? "independent_review_required"
      : "specialized_executor_benefit",
    requestedExecutorProvider: requestedProvider ?? "auto",
    requestedProfileId:
      role === "executor" && typeof request.requestedProfileId === "string"
        ? request.requestedProfileId
        : null,
    subjectProvider,
    requiresIndependentProvider:
      isIndependentReview && isRequiresIndependentProvider,
    role,
    workClass: isIndependentReview ? "bounded_verification" : request.workClass,
    planState: isIndependentReview ? "complete" : request.planState,
    risk: request.risk,
    difficulty: request.difficulty,
    decisionImpact: request.decisionImpact,
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: isIndependentReview
      ? false
      : request.hasUnresolvedDirection,
    requiresCrossContextAlignment: isIndependentReview
      ? false
      : request.requiresCrossContextAlignment,
    operationId,
    parentOperationId: null,
    ancestorOperationIds: Object.freeze([]),
    delegationDepth: 0,
  });
}

/**
 * packet Requestを決定する。
 *
 * @responsibility packet Requestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input request: RuntimeRecord、reviewerReadProjection: RuntimeRecord | null
 * @returns packetRequestの計算結果を返す。
 * @precondition 「request: RuntimeRecord、reviewerReadProjection: RuntimeRecord | null」がpacketRequestの入力契約を満たす。
 * @postcondition packetRequestの責務を完了した結果だけを返す。
 * @effect N/A: packetRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: packetRequestは独自の失敗分岐を所有しない。
 * @invariant packetRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: packetRequestはProcess内の同一Subsystemで完結する。
 * @security packetRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: packetRequestは共有非同期状態を持たない同期処理である。
 */
function packetRequest(
  request: RuntimeRecord,
  reviewerReadProjection: RuntimeRecord | null,
) {
  return Object.freeze({
    objective: request.objective,
    acceptanceCriteria: request.acceptanceCriteria,
    allowedPaths: request.allowedPaths,
    readPaths: request.readPaths,
    reviewerReadProjection,
  });
}

/**
 * external Send Scope Requestを決定する。
 *
 * @responsibility external Send Scope Requestの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input request: RuntimeRecord
 * @returns externalSendScopeRequestの計算結果を返す。
 * @precondition 「request: RuntimeRecord」がexternalSendScopeRequestの入力契約を満たす。
 * @postcondition externalSendScopeRequestの責務を完了した結果だけを返す。
 * @effect N/A: externalSendScopeRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: externalSendScopeRequestは独自の失敗分岐を所有しない。
 * @invariant externalSendScopeRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: externalSendScopeRequestはProcess内の同一Subsystemで完結する。
 * @security externalSendScopeRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: externalSendScopeRequestは共有非同期状態を持たない同期処理である。
 */
function externalSendScopeRequest(request: RuntimeRecord) {
  return Object.freeze({
    objective: request.objective,
    acceptanceCriteria: request.acceptanceCriteria,
    allowedPaths: request.allowedPaths,
    readPaths: request.readPaths,
  });
}

/**
 * Provider Preparation 失敗を公開結果へ投影する。
 *
 * @responsibility Provider Preparation 失敗の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input reason: unknown
 * @returns projectProviderPreparationFailureの計算結果を返す。
 * @precondition 「reason: unknown」がprojectProviderPreparationFailureの入力契約を満たす。
 * @postcondition projectProviderPreparationFailureの責務を完了した結果だけを返す。
 * @effect N/A: projectProviderPreparationFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectProviderPreparationFailureは独自の失敗分岐を所有しない。
 * @invariant projectProviderPreparationFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectProviderPreparationFailureはProcess内の同一Subsystemで完結する。
 * @security projectProviderPreparationFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: projectProviderPreparationFailureは共有非同期状態を持たない同期処理である。
 */
function projectProviderPreparationFailure(reason: unknown) {
  if (typeof reason !== "string")
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.prepareFailed;
  if (reason.endsWith("_docker_runtime_model_selection_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.modelSelectionInvalid;
  if (reason.endsWith("_docker_runtime_mount_authorization_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.mountAuthorizationInvalid;
  if (reason.endsWith("_docker_runtime_task_packet_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.taskPacketInvalid;
  if (reason.endsWith("_docker_runtime_plan_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.planInvalid;
  if (reason.endsWith("_docker_runtime_authority_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.authorityInvalid;
  if (reason.endsWith("_docker_runtime_recovery_correlation_invalid"))
    return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.recoveryCorrelationInvalid;
  return COORDINATOR_TASK_PROVIDER_PREPARATION_REASONS.prepareFailed;
}

/**
 * Provider Selectionが同一かを判定する。
 *
 * @responsibility Provider Selectionの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: RuntimeRecord、right: RuntimeRecord
 * @returns sameProviderSelectionの計算結果を返す。
 * @precondition 「left: RuntimeRecord、right: RuntimeRecord」がsameProviderSelectionの入力契約を満たす。
 * @postcondition sameProviderSelectionの責務を完了した結果だけを返す。
 * @effect N/A: sameProviderSelectionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameProviderSelectionは独自の失敗分岐を所有しない。
 * @invariant sameProviderSelectionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameProviderSelectionはProcess内の同一Subsystemで完結する。
 * @security sameProviderSelectionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameProviderSelectionは共有非同期状態を持たない同期処理である。
 */
function sameProviderSelection(left: RuntimeRecord, right: RuntimeRecord) {
  return (
    left.executorProvider === right.executorProvider &&
    left.profileId === right.profileId &&
    left.selectedModel === right.selectedModel &&
    left.selectedEffort === right.selectedEffort &&
    left.speedMode === right.speedMode &&
    left.selectionNotice === right.selectionNotice
  );
}

/**
 * Pathsが同一かを判定する。
 *
 * @responsibility Pathsの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: unknown、right: unknown
 * @returns samePathsの計算結果を返す。
 * @precondition 「left: unknown、right: unknown」がsamePathsの入力契約を満たす。
 * @postcondition samePathsの責務を完了した結果だけを返す。
 * @effect N/A: samePathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: samePathsは独自の失敗分岐を所有しない。
 * @invariant samePathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: samePathsはProcess内の同一Subsystemで完結する。
 * @security samePathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: samePathsは共有非同期状態を持たない同期処理である。
 */
function samePaths(left: unknown, right: unknown) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const normalize = (values: unknown[]) =>
    values.every((value) => typeof value === "string")
      ? [...(values as string[])].sort((a, b) =>
          Buffer.from(a).compare(Buffer.from(b)),
        )
      : null;
  const normalizedLeftPaths = normalize(left);
  const normalizedRightPaths = normalize(right);
  return (
    normalizedLeftPaths !== null &&
    normalizedRightPaths !== null &&
    normalizedLeftPaths.length === normalizedRightPaths.length &&
    normalizedLeftPaths.every(
      (value, index) => value === normalizedRightPaths[index],
    )
  );
}

/**
 * Stageを実行する。
 *
 * @responsibility Stageの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input args: Parameters<typeof executeStageBody>
 * @returns executeStageの計算結果を返す。
 * @precondition 「args: Parameters<typeof executeStageBody>」がexecuteStageの入力契約を満たす。
 * @postcondition executeStageの責務を完了した結果だけを返す。
 * @effect N/A: executeStageは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: executeStageは独自の失敗分岐を所有しない。
 * @invariant executeStageは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: executeStageはProcess内の同一Subsystemで完結する。
 * @security executeStageはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency executeStageは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeStage(...args: Parameters<typeof executeStageBody>) {
  const dependencies = args[0].dependencies;
  const invocation = dependencies.beginInvocation?.(args[8], args[5]);
  if (dependencies.beginInvocation && !invocation)
    return blocked("coordinator_task_development_invocation_not_authorized");
  args[11] = invocation?.commandRestriction;
  let result: Awaited<ReturnType<typeof executeStageBody>>;
  let settlement: unknown;
  try {
    result = await executeStageBody(...args);
  } finally {
    settlement = invocation?.settle();
  }
  return settlement === false
    ? blocked("coordinator_task_development_invocation_settlement_invalid")
    : result;
}

/**
 * Stage Bodyを実行する。
 *
 * @responsibility Stage Bodyの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、operation: Operation、request: RuntimeRecord、repositoryBindingCapability: object、externalSendGrantCapability: object、role: TaskRole、taskAttempt: 0 | 1、subjectProvider: Provider | null、expectedProvider: Provider、remediationCapability: object | null、control: ControlRecord、commandRestriction: unknown、reviewerReadProjection: RuntimeRecord | null
 * @returns executeStageBodyの計算結果を返す。
 * @precondition 「state: RuntimeState、operation: Operation、request: RuntimeRecord、repositoryBindingCapability: object、externalSendGrantCapability: object、role: TaskRole、taskAttempt: 0 | 1、subjectProvider: Provider | null、expectedProvider: Provider、remediationCapability: object | null、control: ControlRecord、commandRestriction: unknown、reviewerReadProjection: RuntimeRecord | null」がexecuteStageBodyの入力契約を満たす。
 * @postcondition executeStageBodyの責務を完了した結果だけを返す。
 * @effect executeStageBodyは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure executeStageBodyは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant executeStageBodyは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security executeStageBodyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency executeStageBodyは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function executeStageBody(
  state: taskRuntimeState,
  operation: Operation,
  request: RuntimeRecord,
  repositoryBindingCapability: object,
  externalSendGrantCapability: object,
  role: TaskRole,
  taskAttempt: 0 | 1,
  subjectProvider: Provider | null,
  expectedProvider: Provider,
  remediationCapability: object | null,
  control: ControlRecord,
  commandRestriction?: unknown,
  reviewerReadProjection: RuntimeRecord | null = null,
) {
  if (control.cancellationRequested) {
    return blocked("coordinator_task_cancelled_before_stage_start");
  }
  const selectionInput = selectionRequest(
    request,
    operation.operationId,
    role === "executor" ? "executor" : "independent_reviewer",
    subjectProvider,
    role === "executor" &&
      (request.requestedExecutorProvider === "codex" ||
        request.requestedExecutorProvider === "claude")
      ? request.requestedExecutorProvider
      : role === "reviewer" && expectedProvider === subjectProvider
        ? expectedProvider
        : null,
    role === "reviewer" ? expectedProvider !== subjectProvider : false,
  );
  let selection = state.dependencies.issueSelection(
    operation.managementCapability,
    selectionInput,
  );
  const provider =
    selection.executorProvider === "codex" ||
    selection.executorProvider === "claude"
      ? selection.executorProvider
      : null;
  const profileId = stringValue(selection.profileId);
  let selectionControl = objectCapability(selection.controlCapability);
  let startedProcessControl: object | null = null;
  let startedDockerRecoveryId: string | null = null;
  if (
    selection.status !== "issued" ||
    !provider ||
    !profileId ||
    !selectionControl ||
    !objectCapability(selection.useCapability)
  ) {
    return blocked("coordinator_task_selection_failed");
  }
  let mountControl: object | null = null;
  let taskControl: object | null = null;
  const revokeUnconsumed = () => {
    if (taskControl) {
      state.dependencies.revokeTaskPacket(
        taskControl,
        operation.managementCapability,
      );
    }
    if (mountControl) {
      state.dependencies.revokeMountGrant(
        mountControl,
        operation.managementCapability,
      );
    }
    if (selectionControl) {
      state.dependencies.revokeSelection(
        selectionControl,
        operation.managementCapability,
      );
    }
  };
  try {
    if (provider !== expectedProvider) {
      revokeUnconsumed();
      return blocked("coordinator_task_selection_slate_mismatch");
    }
    const first = state.dependencies.observeProviderHome(provider);
    const firstObservation = objectCapability(first.observationCapability);
    if (first.status !== "candidate" || !firstObservation) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_home_observation_failed");
    }
    const mount = state.dependencies.issueMountGrant(
      operation.managementCapability,
      firstObservation,
      profileId,
    );
    mountControl = objectCapability(mount.controlCapability);
    const mountUse = objectCapability(mount.useCapability);
    if (mount.status !== "issued" || !mountControl || !mountUse) {
      revokeUnconsumed();
      return blocked("coordinator_task_mount_grant_issue_failed");
    }
    const second = state.dependencies.observeProviderHome(provider);
    const secondObservation = objectCapability(second.observationCapability);
    if (second.status !== "candidate" || !secondObservation) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_home_reobservation_failed");
    }
    const consumedMount = state.dependencies.consumeMountGrant(
      mountUse,
      operation.managementCapability,
      secondObservation,
    );
    const mountAuthorization = objectCapability(
      consumedMount.mountAuthorizationCapability,
    );
    if (consumedMount.status !== "consumed" || !mountAuthorization) {
      revokeUnconsumed();
      return blocked("coordinator_task_mount_grant_consume_failed");
    }
    mountControl = null;
    const revokedSelection = state.dependencies.revokeSelection(
      selectionControl,
      operation.managementCapability,
    );
    selectionControl = null;
    if (revokedSelection.status !== "revoked") {
      return blocked(
        "coordinator_task_provider_selection_refresh_revoke_failed",
      );
    }
    const refreshedSelection = state.dependencies.issueSelection(
      operation.managementCapability,
      selectionInput,
    );
    const refreshedSelectionControl = objectCapability(
      refreshedSelection.controlCapability,
    );
    const refreshedSelectionUse = objectCapability(
      refreshedSelection.useCapability,
    );
    if (
      refreshedSelection.status !== "issued" ||
      !refreshedSelectionControl ||
      !refreshedSelectionUse
    ) {
      return blocked("coordinator_task_provider_selection_refresh_failed");
    }
    selectionControl = refreshedSelectionControl;
    if (!sameProviderSelection(selection, refreshedSelection)) {
      revokeUnconsumed();
      return blocked("coordinator_task_provider_selection_refresh_mismatch");
    }
    selection = refreshedSelection;
    if (
      !state.dependencies.reportSelectionNotice(
        Object.freeze({
          event: "coordinator_selection_before_provider_effect",
          taskRole: role,
          provider,
          model: selection.selectedModel,
          effort: selection.selectedEffort,
          speedMode: selection.speedMode,
          selectionReason: selection.selectionNotice,
          inputBasis:
            "caller_declared_task_attributes_plus_runtime_owned_preselection_candidate_with_deferred_provider_preflight",
          callerDeclaredAttributes: Object.freeze([
            "workClass",
            "planState",
            "risk",
            "difficulty",
            "decisionImpact",
          ]),
          highCostSelectionAllowed: false,
        }),
      )
    ) {
      revokeUnconsumed();
      return blocked("coordinator_task_selection_notice_unavailable");
    }
    const packet = state.dependencies.issueTaskPacket(
      operation.managementCapability,
      repositoryBindingCapability,
      provider,
      role,
      taskAttempt,
      externalSendGrantCapability,
      remediationCapability,
      packetRequest(
        request,
        role === "reviewer" ? reviewerReadProjection : null,
      ),
    );
    taskControl = objectCapability(packet?.controlCapability);
    const taskUse = objectCapability(packet?.useCapability);
    if (
      packet?.status === "blocked" &&
      packet.reason === "provider_task_packet_recognized_secret_rejected"
    ) {
      revokeUnconsumed();
      return blocked("coordinator_task_remediation_recognized_secret_rejected");
    }
    if (packet?.status !== "issued" || !taskControl || !taskUse) {
      revokeUnconsumed();
      return blocked("coordinator_task_packet_issue_failed");
    }
    const prepared = state.dependencies.prepareProvider(
      provider,
      operation.managementCapability,
      operation.mountCapability,
      mountAuthorization,
      refreshedSelectionUse,
      taskUse,
      control.recoveryCorrelationId,
      control.consumer,
    );
    selectionControl = null;
    taskControl = null;
    const preparedCapability = objectCapability(prepared.preparedCapability);
    if (prepared.status !== "prepared" || !preparedCapability) {
      return blocked(
        prepared.reason === "claude_task_workload_split_required"
          ? "coordinator_task_workload_split_required"
          : projectProviderPreparationFailure(prepared.reason),
      );
    }
    const rawProcess = state.dependencies.startProcess(
      preparedCapability,
      operation.managementCapability,
      (recoveryCapability, recoveryId) => {
        const capability = objectCapability(recoveryCapability);
        const id = publicVerifiedDockerRecoveryId(recoveryId);
        if (
          !capability ||
          !id ||
          control.dockerHandoffs.some(
            (handoff) =>
              handoff.capability === capability || handoff.recoveryId === id,
          )
        )
          return false;
        control.dockerHandoffs.push({
          capability,
          recoveryId: id,
          state: "active",
        });
        return true;
      },
      commandRestriction,
      control.observeProviderStarted,
    );
    const isProductionProcessContract =
      state.dependencies.startProcess ===
      startRuntimeOwnedDockerProcessController;
    const process = (
      isProductionProcessContract
        ? projectDockerProcessControllerStartResult(
            rawProcess,
            control.dockerHandoffs.at(-1)?.recoveryId ?? null,
            operation.operationId,
          )
        : rawProcess
    ) as RuntimeRecord | null;
    if (!process) {
      return blocked(
        "coordinator_task_process_start_contract_invalid",
        true,
        operation.hostRecoveryId,
        control.dockerHandoffs.at(-1)?.recoveryId ?? null,
      );
    }
    const processControl = objectCapability(process.controlCapability);
    const completion = process.completion;
    if (
      process.status !== "started" ||
      !processControl ||
      !(completion instanceof Promise)
    ) {
      const dockerRecoveryId = publicVerifiedDockerRecoveryId(
        process.recoveryId,
      );
      const manualRecoveryRequired =
        process.cleanupConfirmed !== true ||
        process.manualRecoveryRequired === true ||
        dockerRecoveryId !== null;
      return blocked(
        projectCoordinatorTaskPublicReason(
          process.reason,
          "coordinator_task_process_start_failed",
        ),
        manualRecoveryRequired,
        manualRecoveryRequired ? operation.hostRecoveryId : null,
        dockerRecoveryId,
        null,
        process.cleanupConfirmed === true,
      );
    }
    control.currentProcessControl = processControl;
    startedProcessControl = processControl;
    startedDockerRecoveryId = publicVerifiedDockerRecoveryId(
      process.recoveryId,
    );
    if (control.cancellationRequested) {
      await state.dependencies.cancelProcess(
        processControl,
        operation.managementCapability,
      );
    }
    const rawResult = await completion;
    const result = isProductionProcessContract
      ? projectDockerProcessControllerCompletionResult(
          rawResult,
          startedDockerRecoveryId,
          operation.operationId,
        )
      : (rawResult as RuntimeRecord);
    control.currentProcessControl = null;
    startedProcessControl = null;
    if (!result) {
      return blocked(
        "coordinator_task_process_completion_contract_invalid",
        true,
        operation.hostRecoveryId,
        startedDockerRecoveryId,
      );
    }
    const finalizationCapability = objectCapability(
      result.recoveryFinalizationCapability,
    );
    const handoff = control.dockerHandoffs.find(
      (candidate) => candidate.recoveryId === startedDockerRecoveryId,
    );
    if (result.cleanupConfirmed === true) {
      if (
        state.dependencies.finalizeDockerRecovery &&
        (!finalizationCapability ||
          !startedDockerRecoveryId ||
          !handoff ||
          handoff.capability !== finalizationCapability)
      ) {
        return blocked(
          "coordinator_task_docker_finalization_capability_missing",
          true,
          operation.hostRecoveryId,
          startedDockerRecoveryId,
        );
      }
      if (finalizationCapability && startedDockerRecoveryId) {
        if (handoff) handoff.state = "finalizable";
        control.dockerFinalizations.push(
          Object.freeze({
            capability: finalizationCapability,
            recoveryId: startedDockerRecoveryId,
            dockerCompletion: rawResult,
          }),
        );
      } else if (!state.dependencies.finalizeDockerRecovery && handoff) {
        handoff.state = "finalized";
      }
    }
    if (control.cancellationRequested) {
      const dockerRecoveryIds = controlDockerRecoveryIds(control);
      return Object.freeze({
        ...blocked("coordinator_task_cancelled_after_provider_cleanup"),
        dockerRecoveryId:
          dockerRecoveryIds.length === 1
            ? (dockerRecoveryIds[0] ?? null)
            : null,
        dockerRecoveryIds,
      });
    }
    if (result.status !== "completed" || result.cleanupConfirmed !== true) {
      const dockerRecoveryId = publicVerifiedDockerRecoveryId(
        result.recoveryId,
      );
      const manualRecoveryRequired =
        result.cleanupConfirmed !== true ||
        result.manualRecoveryRequired === true ||
        dockerRecoveryId !== null;
      const dockerRecoveryIds = controlDockerRecoveryIds(control);
      return Object.freeze({
        ...blocked(
          projectCoordinatorTaskPublicReason(
            result.reason,
            "coordinator_task_provider_failed",
          ),
          manualRecoveryRequired,
          manualRecoveryRequired ? operation.hostRecoveryId : null,
          dockerRecoveryId,
          null,
          result.cleanupConfirmed === true,
        ),
        dockerRecoveryId:
          manualRecoveryRequired && dockerRecoveryId
            ? dockerRecoveryId
            : dockerRecoveryIds.length === 1
              ? (dockerRecoveryIds[0] ?? null)
              : null,
        dockerRecoveryIds: manualRecoveryRequired
          ? Object.freeze([
              ...new Set([
                ...(dockerRecoveryId ? [dockerRecoveryId] : []),
                ...dockerRecoveryIds,
              ]),
            ])
          : dockerRecoveryIds,
      });
    }
    return Object.freeze({
      status: "completed" as const,
      provider,
      selectionNotice:
        stringValue(prepared.selectionNotice) ??
        stringValue(selection.selectionNotice),
      normalizedResult: result.normalizedResult,
      providerTurnObservation: projectProviderTurnObservation(
        ownPlainDataValue(result.normalizedResult, "providerTurnObservation"),
      ),
    });
  } catch {
    if (startedProcessControl) {
      try {
        await state.dependencies.cancelProcess(
          startedProcessControl,
          operation.managementCapability,
        );
      } catch {
        // The process state is already unknowable. The result below retains the
        // operation root and requires explicit recovery regardless.
      }
      control.currentProcessControl = null;
      return blocked(
        "coordinator_task_process_completion_unconfirmed",
        true,
        operation.hostRecoveryId,
        startedDockerRecoveryId,
      );
    }
    revokeUnconsumed();
    return blocked("coordinator_task_stage_failed_closed");
  }
}

/**
 * Coordinator Task Coreを実行する。
 *
 * @responsibility Coordinator Task Coreの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、rawRequest: unknown、repositoryRoot: unknown、control: ControlRecord
 * @returns runCoordinatorTaskCoreの計算結果を返す。
 * @precondition 「state: RuntimeState、rawRequest: unknown、repositoryRoot: unknown、control: ControlRecord」がrunCoordinatorTaskCoreの入力契約を満たす。
 * @postcondition runCoordinatorTaskCoreの責務を完了した結果だけを返す。
 * @effect N/A: runCoordinatorTaskCoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runCoordinatorTaskCoreは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCoordinatorTaskCoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runCoordinatorTaskCoreはProcess内の同一Subsystemで完結する。
 * @security runCoordinatorTaskCoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runCoordinatorTaskCoreは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function runCoordinatorTaskCore(
  state: taskRuntimeState,
  rawRequest: unknown,
  repositoryRoot: unknown,
  control: ControlRecord,
) {
  const blocked = (...args: Parameters<typeof createBlocked>) => {
    const source = createBlocked(...args);
    const dockerRecoveryIds = [
      ...new Set([
        ...source.dockerRecoveryIds,
        ...controlDockerRecoveryIds(control),
      ]),
    ];
    const manualRecoveryRequired =
      source.manualRecoveryRequired === true || dockerRecoveryIds.length > 0;
    return createBlocked(
      projectCoordinatorTaskPublicReason(
        source.reason,
        "coordinator_task_failed_closed",
      ),
      manualRecoveryRequired,
      stringValue(source.hostRecoveryId),
      dockerRecoveryIds.length === 1 ? (dockerRecoveryIds[0] ?? null) : null,
      stringValue(source.candidateRecoveryId),
      dockerRecoveryIds.length > 0 ? false : source.cleanupConfirmed === true,
      stringValue(source.candidateStoreRecoveryId),
      dockerRecoveryIds,
    );
  };
  const requestOutcome = snapshotCoordinatorTaskRequest(rawRequest);
  if (
    !requestOutcome ||
    typeof repositoryRoot !== "string" ||
    !repositoryRoot
  ) {
    return blocked("coordinator_task_request_invalid");
  }
  if (requestOutcome.status === "blocked") {
    return blocked(requestOutcome.reason);
  }
  const request = requestOutcome.request;
  const repositoryPreflight =
    state.dependencies.inspectRepository(repositoryRoot);
  if (repositoryPreflight?.status !== "candidate") {
    return blocked("coordinator_task_repository_preflight_failed");
  }
  if (repositoryPreflight.runtimeSupported !== true) {
    return blocked("coordinator_task_git_object_format_unsupported");
  }
  let dockerRecoveryState: unknown;
  try {
    dockerRecoveryState =
      state.dependencies.prepareDockerRecoveryState(repositoryRoot);
  } catch {
    dockerRecoveryState = null;
  }
  const admission = projectCurrentDockerAdmission(dockerRecoveryState);
  if (admission.status !== "completed") {
    return blocked(
      projectCoordinatorTaskPublicReason(
        admission.reason,
        "docker_process_controller_recovery_unavailable",
      ),
      true,
      null,
      null,
      null,
      false,
      null,
      Object.freeze([]),
    );
  }
  advanceLifecycleState(state, control, "STATE-OPERATION-ACQUIRING");
  let operation: Operation | null = null;
  let shouldRetainOperationRoot = false;
  try {
    operation = await state.dependencies.createOperation();
    control.ownedOperation = operation.owned;
    control.managementCapability = operation.managementCapability;
    control.hostRecoveryId = operation.hostRecoveryId;
    advanceLifecycleState(state, control, "STATE-OPERATION-READY");
    if (
      operation.hostGenerationFailureDetected &&
      operation.hostGenerationLoss
    ) {
      control.hostGenerationLoss = operation.hostGenerationLoss;
      control.hostGenerationFailureHandling =
        operation.hostGenerationFailureDetected.then(async () => {
          control.hostGenerationFailureObserved = true;
          const processControl = control.currentProcessControl;
          try {
            const cancellationResult = await requestControlCancellation(
              state,
              control,
            );
            if (processControl) {
              if (cancellationResult.processTerminationObserved !== true) {
                control.hostGenerationLossOutcome = "cleanup_unknown";
                poisonRuntimeProcess(state, control);
              }
            }
          } catch {
            control.hostGenerationLossOutcome = "cleanup_unknown";
            poisonRuntimeProcess(state, control);
          }
        });
      control.releaseHostGenerationDrain =
        operation.releaseHostGenerationDrain ?? null;
      control.hostGenerationLossHandling = operation.hostGenerationLoss.then(
        async (outcome) => {
          if (control.hostGenerationLossOutcome !== "cleanup_unknown")
            control.hostGenerationLossOutcome = outcome;
          if (control.hostGenerationFailureHandling)
            await control.hostGenerationFailureHandling;
        },
      );
    }
    if (control.cancellationRequested) {
      return blocked("coordinator_task_cancelled_during_operation_creation");
    }
    const repository = state.dependencies.bindRepository(
      operation.managementCapability,
      repositoryRoot,
    );
    const repositoryBinding = objectCapability(
      repository?.repositoryBindingCapability,
    );
    if (repository?.repositoryBound !== true || !repositoryBinding) {
      return blocked("coordinator_task_repository_binding_failed");
    }
    const externalSendPolicy = state.dependencies.resolveExternalSendPolicy(
      operation.managementCapability,
      repositoryBinding,
    );
    const externalSendPolicyCapability = objectCapability(
      externalSendPolicy?.capability,
    );
    if (
      externalSendPolicy?.status !== "resolved" ||
      !externalSendPolicyCapability
    ) {
      return blocked("coordinator_task_external_send_policy_unresolved");
    }
    const slate = state.dependencies.preflightSlate(
      operation.managementCapability,
      selectionRequest(
        request,
        operation.operationId,
        "executor",
        null,
        request.requestedExecutorProvider === "codex" ||
          request.requestedExecutorProvider === "claude"
          ? request.requestedExecutorProvider
          : null,
        false,
      ),
    );
    const slateExecutorProvider =
      slate.executorProvider === "codex" || slate.executorProvider === "claude"
        ? slate.executorProvider
        : null;
    const slateReviewerProvider =
      slate.reviewerProvider === "codex" || slate.reviewerProvider === "claude"
        ? slate.reviewerProvider
        : null;
    const reviewerIndependence =
      slate.reviewerIndependence === "provider_independent" ||
      slate.reviewerIndependence === "execution_context_independent"
        ? slate.reviewerIndependence
        : null;
    if (
      slate.status !== "candidate" ||
      !slateExecutorProvider ||
      !slateReviewerProvider ||
      !reviewerIndependence ||
      ((request.requestedExecutorProvider === "codex" ||
        request.requestedExecutorProvider === "claude") &&
        slateExecutorProvider !== request.requestedExecutorProvider) ||
      slate.providerEffectAllowed !== false
    ) {
      return blocked("coordinator_task_execution_slate_unavailable");
    }
    const slateProviders: readonly Provider[] = Object.freeze(
      slateExecutorProvider === slateReviewerProvider
        ? [slateExecutorProvider]
        : [slateExecutorProvider, slateReviewerProvider],
    );
    const networkPolicyHashes = snapshotPlainRecord(
      externalSendPolicy.networkPolicyHashes,
      new Set(["codex", "claude"]),
    );
    if (
      request.expectedNetworkPolicyHash !== null &&
      networkPolicyHashes?.[slateExecutorProvider] !==
        request.expectedNetworkPolicyHash
    )
      return blocked("coordinator_task_network_policy_changed");
    const externalSendGrant = await state.dependencies.authorizeExternalSend(
      operation.managementCapability,
      repositoryBinding,
      externalSendPolicyCapability,
      externalSendScopeRequest(request),
      slateProviders,
      control.cancellationController.signal,
    );
    if (control.cancellationRequested) {
      return blocked(
        "coordinator_task_cancelled_during_external_send_authorization",
      );
    }
    const externalSendGrantCapability = objectCapability(
      externalSendGrant?.capability,
    );
    if (
      externalSendGrant?.status !== "issued" ||
      !externalSendGrantCapability
    ) {
      const grantReason = stringValue(externalSendGrant?.reason);
      const reason =
        grantReason && EXTERNAL_SEND_CONFIRMATION_REASONS.has(grantReason)
          ? `coordinator_task_${grantReason}`
          : "coordinator_task_external_send_not_authorized";
      const manualRecoveryRequired =
        externalSendGrant?.manualRecoveryRequired === true;
      return blocked(
        projectCoordinatorTaskPublicReason(
          reason,
          "coordinator_task_external_send_not_authorized",
        ),
        manualRecoveryRequired,
        null,
      );
    }
    const externalSendAuthorizationMode = externalSendGrant.authorizationMode;
    if (
      externalSendAuthorizationMode !== "interactive_initial_consent" &&
      externalSendAuthorizationMode !== "reused_initial_consent"
    ) {
      return blocked(
        "coordinator_task_external_send_authorization_mode_invalid",
      );
    }
    const externalSendNotice = Object.freeze({
      event: "coordinator_external_send_authorized",
      authorizationMode: externalSendAuthorizationMode,
      providers: slateProviders,
      message:
        externalSendAuthorizationMode === "reused_initial_consent"
          ? "既存の送信許可の範囲内で続行します。追加の承認入力は不要です。"
          : "今回確認した送信許可の範囲内で続行します。",
    });
    let isNoticeReported = false;
    try {
      isNoticeReported =
        state.dependencies.reportExternalSendNotice(externalSendNotice) ===
        true;
    } catch {
      isNoticeReported = false;
    }
    if (!isNoticeReported) {
      return blocked("coordinator_task_external_send_notice_unavailable");
    }
    if (control.cancellationRequested) {
      return blocked(
        "coordinator_task_cancelled_during_external_send_authorization",
      );
    }
    const candidateNotIssued = (result: RuntimeRecord) =>
      Object.freeze({
        ...result,
        externalSendAuthorizationMode,
        candidateDisposition: "not_issued" as const,
      });
    const workspace = state.dependencies.materializeWorkspace(
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.readPaths as readonly string[],
      control.workspaceTarget,
    );
    const workspaceCapability = objectCapability(
      workspace?.workspaceCapability,
    );
    if (workspace?.status !== "materialized" || !workspaceCapability) {
      return candidateNotIssued(
        blocked(
          workspace?.reason ===
            "repository_read_projection_recognized_secret_rejected"
            ? "coordinator_task_read_projection_recognized_secret_rejected"
            : "coordinator_task_workspace_materialization_failed",
        ),
      );
    }
    if (control.workspaceTarget) {
      if (workspace.borrowed !== true)
        return candidateNotIssued(
          blocked("coordinator_task_workspace_borrowing_unavailable"),
        );
      control.borrowedWorkspaceCapability = workspaceCapability;
    }
    advanceLifecycleState(state, control, "STATE-TASK-AUTHORIZED");
    const executor = await executeStage(
      state,
      operation,
      request,
      repositoryBinding,
      externalSendGrantCapability,
      "executor",
      0,
      null,
      slateExecutorProvider,
      null,
      control,
    );
    if (executor.status !== "completed") {
      shouldRetainOperationRoot = executor.manualRecoveryRequired === true;
      return candidateNotIssued(executor);
    }
    advanceLifecycleState(state, control, "STATE-EXECUTOR-CLEAN");
    if (control.cancellationRequested) {
      return candidateNotIssued(
        blocked("coordinator_task_cancelled_before_candidate_capture"),
      );
    }
    let finalExecutor = executor;
    let executorResult = executor.normalizedResult as RuntimeRecord;
    const providerTurnObservations: Readonly<Record<string, unknown>>[] = [];
    const retainTurnObservation = (
      stage: Readonly<Record<string, unknown>>,
      attempt: number,
    ) => {
      const observation = projectProviderTurnObservation(
        stage.providerTurnObservation,
      );
      if (observation)
        providerTurnObservations.push(
          Object.freeze({ ...observation, attempt }),
        );
    };
    retainTurnObservation(executor, 0);
    let candidate = state.dependencies.captureCandidate(
      workspaceCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
      request.allowedPaths as readonly string[],
    );
    let candidateCapability = objectCapability(candidate?.candidateCapability);
    if (
      control.workspaceTarget &&
      Array.isArray(candidate?.unexpectedPaths) &&
      candidate.unexpectedPaths.length > 0
    )
      return candidateNotIssued(
        blocked("coordinator_task_workspace_unexpected_changes"),
      );
    if (
      candidate?.status !== "candidate" ||
      !candidateCapability ||
      executorResult?.status !== "completed" ||
      !samePaths(executorResult.changedPaths, candidate.changedPaths)
    ) {
      return candidateNotIssued(
        blocked(
          candidate?.reason === "candidate_recognized_secret_rejected"
            ? "coordinator_task_candidate_recognized_secret_rejected"
            : "coordinator_task_candidate_revision_invalid",
        ),
      );
    }
    advanceLifecycleState(state, control, "STATE-CANDIDATE-CAPTURED");
    if (control.cancellationRequested) {
      return candidateNotIssued(
        blocked("coordinator_task_cancelled_before_independent_review"),
      );
    }
    const reviewerReadProjection = state.dependencies.projectReviewerReadContent
      ? state.dependencies.projectReviewerReadContent(
          workspaceCapability,
          candidateCapability,
          repositoryBinding,
          operation.managementCapability,
          operation.mountCapability,
          request.readPaths as readonly string[],
        )
      : null;
    if (
      state.dependencies.projectReviewerReadContent &&
      reviewerReadProjection?.status !== "projected"
    ) {
      return candidateNotIssued(
        blocked("coordinator_task_reviewer_read_projection_failed"),
      );
    }
    let reviewer = await executeStage(
      state,
      operation,
      request,
      repositoryBinding,
      externalSendGrantCapability,
      "reviewer",
      0,
      executor.provider as Provider,
      slateReviewerProvider,
      null,
      control,
      undefined,
      reviewerReadProjection,
    );
    if (reviewer.status !== "completed") {
      shouldRetainOperationRoot = reviewer.manualRecoveryRequired === true;
      return candidateNotIssued(reviewer);
    }
    advanceLifecycleState(state, control, "STATE-REVIEWER-CLEAN");
    let reviewerResult = reviewer.normalizedResult as RuntimeRecord;
    let finalReviewerReadProjection = reviewerReadProjection;
    retainTurnObservation(reviewer, 0);
    let remediationPerformed = false;
    if (reviewerResult?.decision === "changes_requested") {
      advanceLifecycleState(state, control, "STATE-REMEDIATION-AUTHORIZED");
      const remediationCapability = objectCapability(
        reviewerResult.remediationCapability,
      );
      if (!remediationCapability || reviewerResult.findingCount === 0) {
        return candidateNotIssued(
          blocked("coordinator_task_review_remediation_invalid"),
        );
      }
      const remediation = await executeStage(
        state,
        operation,
        request,
        repositoryBinding,
        externalSendGrantCapability,
        "executor",
        1,
        null,
        executor.provider as Provider,
        remediationCapability,
        control,
      );
      if (remediation.status !== "completed") {
        shouldRetainOperationRoot = remediation.manualRecoveryRequired === true;
        return candidateNotIssued(remediation);
      }
      advanceLifecycleState(state, control, "STATE-REMEDIATION-EXECUTOR-CLEAN");
      remediationPerformed = true;
      finalExecutor = remediation;
      executorResult = remediation.normalizedResult as RuntimeRecord;
      retainTurnObservation(remediation, 1);
      candidate = state.dependencies.captureCandidate(
        workspaceCapability,
        repositoryBinding,
        operation.managementCapability,
        operation.mountCapability,
        request.allowedPaths as readonly string[],
      );
      candidateCapability = objectCapability(candidate?.candidateCapability);
      if (
        candidate?.status !== "candidate" ||
        !candidateCapability ||
        executorResult?.status !== "completed" ||
        !samePaths(executorResult.changedPaths, candidate.changedPaths)
      ) {
        return candidateNotIssued(
          blocked(
            candidate?.reason === "candidate_recognized_secret_rejected"
              ? "coordinator_task_candidate_recognized_secret_rejected"
              : "coordinator_task_remediated_candidate_invalid",
          ),
        );
      }
      advanceLifecycleState(
        state,
        control,
        "STATE-REMEDIATION-CANDIDATE-CAPTURED",
      );
      if (
        control.workspaceTarget &&
        Array.isArray(candidate.unexpectedPaths) &&
        candidate.unexpectedPaths.length > 0
      )
        return candidateNotIssued(
          blocked("coordinator_task_workspace_unexpected_changes"),
        );
      const remediationReviewerReadProjection = state.dependencies
        .projectReviewerReadContent
        ? state.dependencies.projectReviewerReadContent(
            workspaceCapability,
            candidateCapability,
            repositoryBinding,
            operation.managementCapability,
            operation.mountCapability,
            request.readPaths as readonly string[],
          )
        : null;
      if (
        state.dependencies.projectReviewerReadContent &&
        remediationReviewerReadProjection?.status !== "projected"
      ) {
        return candidateNotIssued(
          blocked("coordinator_task_reviewer_read_projection_failed"),
        );
      }
      reviewer = await executeStage(
        state,
        operation,
        request,
        repositoryBinding,
        externalSendGrantCapability,
        "reviewer",
        1,
        executor.provider as Provider,
        reviewer.provider as Provider,
        null,
        control,
        undefined,
        remediationReviewerReadProjection,
      );
      if (reviewer.status !== "completed") {
        shouldRetainOperationRoot = reviewer.manualRecoveryRequired === true;
        return candidateNotIssued(reviewer);
      }
      advanceLifecycleState(state, control, "STATE-REMEDIATION-REVIEWER-CLEAN");
      reviewerResult = reviewer.normalizedResult as RuntimeRecord;
      finalReviewerReadProjection = remediationReviewerReadProjection;
      retainTurnObservation(reviewer, 1);
    }
    const verified = state.dependencies.verifyCandidate(
      candidateCapability,
      repositoryBinding,
      operation.managementCapability,
      operation.mountCapability,
    );
    if (verified?.status !== "verified") {
      return Object.freeze({
        ...blocked("coordinator_task_candidate_verification_failed"),
        externalSendAuthorizationMode,
        candidateDisposition: "not_issued" as const,
      });
    }
    if (
      reviewerResult?.decision !== "approved" ||
      reviewerResult.findingCount !== 0
    ) {
      const executorDiagnostics =
        projectExecutorResultDiagnostics(executorResult);
      const reviewerDiagnostics =
        projectReviewerResultDiagnostics(reviewerResult);
      const reviewerProjectionEvidence = projectReviewerProjectionEvidence(
        finalReviewerReadProjection,
      );
      return Object.freeze({
        ...blocked("coordinator_task_independent_review_not_approved"),
        externalSendAuthorizationMode,
        candidateDisposition: "not_issued" as const,
        executorProvider: executor.provider,
        reviewerProvider: reviewer.provider,
        reviewerIndependence,
        remediationPerformed,
        candidateRevision: Object.freeze({
          baseCommit: verified.baseCommit,
          baseTree: verified.baseTree,
          patchHash: verified.patchHash,
          contentManifestHash: verified.contentManifestHash,
          allowedPathsHash: verified.allowedPathsHash,
          changedPaths: verified.changedPaths,
        }),
        executorResult: executorDiagnostics,
        reviewerResult: reviewerDiagnostics,
        reviewerProjectionEvidence,
      });
    }
    return Object.freeze({
      ...blocked("coordinator_task_workspace_review_completed"),
      status: "completed" as const,
      externalSendAuthorizationMode,
      candidateDisposition: "not_issued" as const,
      executorProvider: executor.provider,
      reviewerProvider: reviewer.provider,
      reviewerIndependence,
      remediationPerformed,
      executorSelectionNotice: finalExecutor.selectionNotice,
      reviewerSelectionNotice: reviewer.selectionNotice,
      providerTurnObservations: Object.freeze([...providerTurnObservations]),
      executorResult: projectExecutorResultDiagnostics(executorResult),
      reviewerResult: projectReviewerResultDiagnostics(reviewerResult),
    });
  } catch (error) {
    const creationFailure =
      state.dependencies.classifyOperationCreationFailure(error);
    if (creationFailure) {
      shouldRetainOperationRoot = !creationFailure.cleanupConfirmed;
      return blocked(
        projectCoordinatorTaskPublicReason(
          creationFailure.reason,
          "coordinator_task_operation_creation_failed",
        ),
        creationFailure.manualRecoveryRequired,
        creationFailure.hostRecoveryId,
        null,
        null,
        creationFailure.cleanupConfirmed,
      );
    }
    shouldRetainOperationRoot = true;
    return blocked(
      "coordinator_task_failed_closed",
      true,
      operation?.hostRecoveryId ?? null,
    );
  } finally {
    control.retainOperationRoot = shouldRetainOperationRoot;
  }
}

/**
 * Coordinator Taskを実行する。
 *
 * @responsibility Coordinator Taskの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、rawRequest: unknown、repositoryRoot: unknown、control: ControlRecord
 * @returns Promise<InternalTaskOutcome>を返す。
 * @precondition 「state: RuntimeState、rawRequest: unknown、repositoryRoot: unknown、control: ControlRecord」がrunCoordinatorTaskの入力契約を満たす。
 * @postcondition runCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: runCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runCoordinatorTaskは独自の失敗分岐を所有しない。
 * @invariant runCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security runCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runCoordinatorTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function runCoordinatorTask(
  state: taskRuntimeState,
  rawRequest: unknown,
  repositoryRoot: unknown,
  control: ControlRecord,
): Promise<InternalTaskOutcome> {
  const rawResult = await runCoordinatorTaskCore(
    state,
    rawRequest,
    repositoryRoot,
    control,
  );
  const snapshot = snapshotRuntimeRecord(rawResult);
  if (!snapshot)
    return Object.freeze({
      [INTERNAL_TASK_OUTCOME]: true as const,
      publicResult: blocked(
        "coordinator_task_result_observation_invalid",
        true,
        control.hostRecoveryId,
        null,
        null,
        false,
        null,
        controlDockerRecoveryIds(control),
      ),
      dockerCleanupEligible: false,
    });
  const dockerCleanupEligible = canRunManagedDockerCleanup(snapshot, control);
  const singularDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    "dockerRecoveryId",
  );
  const pluralDescriptor = Object.getOwnPropertyDescriptor(
    snapshot,
    "dockerRecoveryIds",
  );
  const plural = pluralDescriptor
    ? snapshotPlainArray<unknown>(pluralDescriptor.value, 128)
    : null;
  const isProjectionInvalid =
    !singularDescriptor ||
    !("value" in singularDescriptor) ||
    (singularDescriptor.value !== null &&
      !publicVerifiedDockerRecoveryId(singularDescriptor.value)) ||
    !pluralDescriptor ||
    !("value" in pluralDescriptor) ||
    plural?.status !== "ok" ||
    plural.value.some((value) => !publicVerifiedDockerRecoveryId(value)) ||
    new Set(plural.value).size !== plural.value.length;
  const observedIds = Object.freeze([
    ...new Set([
      ...(plural?.status === "ok"
        ? plural.value.filter(
            (value): value is string =>
              publicVerifiedDockerRecoveryId(value) !== null,
          )
        : []),
      ...(singularDescriptor &&
      "value" in singularDescriptor &&
      publicVerifiedDockerRecoveryId(singularDescriptor.value)
        ? [publicVerifiedDockerRecoveryId(singularDescriptor.value) as string]
        : []),
    ]),
  ]);
  const ids = Object.freeze([
    ...new Set([...observedIds, ...controlDockerRecoveryIds(control)]),
  ]);
  const publicResult = isProjectionInvalid
    ? blocked(
        "coordinator_task_docker_recovery_projection_invalid",
        true,
        control.hostRecoveryId,
        null,
        stringValue(snapshot.candidateRecoveryId),
        false,
        stringValue(snapshot.candidateStoreRecoveryId),
        ids,
      )
    : Object.freeze({
        ...snapshot,
        dockerRecoveryId: ids.length === 1 ? (ids[0] ?? null) : null,
        dockerRecoveryIds: ids,
      });
  return Object.freeze({
    [INTERNAL_TASK_OUTCOME]: true as const,
    publicResult,
    dockerCleanupEligible:
      dockerCleanupEligible === true && isProjectionInvalid === false,
  });
}

/**
 * Production Operationを構築する。
 *
 * @responsibility Production Operationの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns createProductionOperationの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がcreateProductionOperationの入力契約を満たす。
 * @postcondition createProductionOperationの責務を完了した結果だけを返す。
 * @effect N/A: createProductionOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createProductionOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProductionOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createProductionOperationはProcess内の同一Subsystemで完結する。
 * @security createProductionOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createProductionOperationは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function createProductionOperation() {
  const operation = createProductionOperationRoot(
    createRuntimeOwnedCoordinatorOperation,
    poisonRuntimeProcessAfterCleanupUnknown,
  );
  const {
    owned,
    mountCapability,
    managementCapability,
    operationId,
    hostRecoveryId,
  } = operation;
  let failureReason = "coordinator_task_operation_creation_failed";
  try {
    const activation =
      await activateOwnedHostOperationGenerationLock(managementCapability);
    if (activation !== "activated") {
      failureReason =
        activation === "cleanup_unknown"
          ? "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required"
          : activation === "cleanup_confirmed_failure"
            ? "coordinator_task_host_generation_lock_start_failed_cleanup_confirmed"
            : "coordinator_task_host_generation_lock_unavailable";
      throw new Error(
        "coordinator_task_host_generation_lock_activation_failed",
      );
    }
    const readiness =
      await confirmOwnedHostOperationGenerationLockReadiness(
        managementCapability,
      );
    if (readiness !== "ready") {
      failureReason =
        readiness === "cleanup_unknown"
          ? "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required"
          : "coordinator_task_host_generation_lock_not_ready_cleanup_confirmed";
      throw new Error("coordinator_task_host_generation_lock_not_ready");
    }
    const hostGenerationLoss =
      observeOwnedHostOperationGenerationLoss(managementCapability);
    return Object.freeze({
      owned,
      mountCapability,
      managementCapability,
      operationId,
      hostRecoveryId,
      hostGenerationFailureDetected: hostGenerationLoss.detected,
      hostGenerationLoss: hostGenerationLoss.outcome,
      releaseHostGenerationDrain: hostGenerationLoss.releaseDrain,
    });
  } catch {
    let cleanupConfirmed = false;
    let manualRecoveryRequired = false;
    try {
      const cleanup = verifyOwnedOperationCleanupOutcome(
        await cleanupOwnedOperationDirectoriesAsync(owned),
      );
      if (!cleanup)
        throw new Error("owned_operation_cleanup_outcome_unverified");
      cleanupConfirmed = true;
      if (cleanup === "protocol_failure_cleanup_confirmed")
        failureReason =
          "coordinator_task_host_generation_lock_protocol_failed_cleanup_confirmed";
    } catch {
      manualRecoveryRequired = true;
      poisonRuntimeProcessAfterCleanupUnknown();
      failureReason =
        "coordinator_task_host_generation_lock_cleanup_unknown_process_restart_required";
    }
    throwProductionOperationFailure(
      Object.freeze({
        reason: failureReason,
        hostRecoveryId,
        cleanupConfirmed,
        manualRecoveryRequired,
      }),
    );
  }
}

const productionDependencies: taskRuntimeDependencies = Object.freeze({
  inspectRepository: inspectRepositoryObjectFormatCandidate,
  createOperation: createProductionOperation,
  classifyOperationCreationFailure: productionOperationFailure,
  cleanupOperation: cleanupOwnedOperationDirectoriesAsync,
  classifyOperationCleanup: verifyOwnedOperationCleanupOutcome,
  abandonOperation: abandonOwnedHostOperationGenerationLock,
  poisonProcessAfterCleanupUnknown: poisonRuntimeProcessAfterCleanupUnknown,
  isProcessPoisoned: isRuntimeProcessPoisoned,
  bindRepository: bindRuntimeOwnedRepositoryOperation,
  materializeWorkspace: bindRuntimeOwnedExecutionSnapshot,
  projectReviewerReadContent: projectReviewerReadContent,
  issueSelection: issueRuntimeOwnedDelegationSelectionGrant,
  preflightSlate: preflightRuntimeOwnedDelegationExecutionSlate,
  revokeSelection: revokeRuntimeOwnedDelegationSelectionGrant,
  observeProviderHome: inspectRuntimeOwnedWindowsProviderHomeCandidate,
  issueMountGrant: issueRuntimeOwnedProviderHomeMountGrant,
  consumeMountGrant: consumeRuntimeOwnedProviderHomeMountGrant,
  revokeMountGrant: revokeRuntimeOwnedProviderHomeMountGrant,
  authorizeExternalSend: requestRuntimeOwnedExternalSendGrant,
  resolveExternalSendPolicy: resolveRuntimeOwnedExternalSendPolicy,
  prepareDockerRecoveryState: inspectRuntimeOwnedDockerTaskAdmission,
  reportSelectionNotice: (notice) => {
    try {
      process.stderr.write(
        `[Coordinator selection] ${JSON.stringify(notice)}\n`,
      );
      return true;
    } catch {
      return false;
    }
  },
  reportExternalSendNotice: (notice) => {
    try {
      process.stderr.write(
        `[Coordinator authorization] ${JSON.stringify(notice)}\n`,
      );
      return true;
    } catch {
      return false;
    }
  },
  issueTaskPacket: issueRuntimeOwnedProviderTaskPacket,
  revokeTaskPacket: revokeRuntimeOwnedProviderTaskPacket,
  prepareProvider: (
    provider,
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
    taskPacketUseCapability,
    recoveryCorrelationId,
    consumer,
  ) =>
    getRuntimeOwnedProviderDockerAdapter(provider).prepareTask(
      managementCapability,
      mountCapability,
      mountAuthorizationCapability,
      selectionUseCapability,
      taskPacketUseCapability,
      recoveryCorrelationId,
      consumer,
    ),
  startProcess: startRuntimeOwnedDockerProcessController,
  cancelProcess: cancelRuntimeOwnedDockerProcessController,
  captureCandidate: captureExecutionChangeSnapshot,
  verifyCandidate: verifyExecutionChangeSnapshot,
  finalizeDockerRecovery: finalizeRuntimeOwnedDockerRecovery,
  readDockerProjectResult: readRuntimeOwnedDockerProjectResult,
  prepareDockerHostCleanup: prepareRuntimeOwnedDockerHostCleanup,
  recordDockerHostCleanupReceipt: recordRuntimeOwnedDockerHostCleanupReceipt,
  abandonDockerRecovery: abandonRuntimeOwnedDockerRecovery,
});

/**
 * retain Runtime 回復 状態を決定する。
 *
 * @responsibility retain Runtime 回復 状態の導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input state: RuntimeState、control: ControlRecord
 * @returns N/A: retainRuntimeRecoveryStateは戻り値を返さない。
 * @precondition 「state: RuntimeState、control: ControlRecord」がretainRuntimeRecoveryStateの入力契約を満たす。
 * @postcondition retainRuntimeRecoveryStateの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: retainRuntimeRecoveryStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: retainRuntimeRecoveryStateは独自の失敗分岐を所有しない。
 * @invariant retainRuntimeRecoveryStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: retainRuntimeRecoveryStateはProcess内の同一Subsystemで完結する。
 * @security retainRuntimeRecoveryStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency retainRuntimeRecoveryStateは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function retainRuntimeRecoveryState(
  state: taskRuntimeState,
  control: ControlRecord,
) {
  control.retainOperationRoot = !control.hostCleanupCompleted;
  for (const handoff of control.dockerHandoffs) {
    if (handoff.state === "finalized" || handoff.state === "abandoned")
      continue;
    if (state.dependencies.abandonDockerRecovery?.(handoff.capability) === true)
      handoff.state = "abandoned";
  }
  if (!control.hostCleanupCompleted)
    await state.dependencies.abandonOperation(control.managementCapability);
}

/**
 * Runtimeを構築する。
 *
 * @responsibility Runtimeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: RuntimeDependencies
 * @returns createRuntimeの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateRuntimeの入力契約を満たす。
 * @postcondition createRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: createRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createRuntimeはProcess内の同一Subsystemで完結する。
 * @security createRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency createRuntimeは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function createRuntime(dependencies: taskRuntimeDependencies) {
  const state: taskRuntimeState = Object.freeze({
    dependencies: Object.freeze(dependencies),
    controls: new WeakMap(),
  });
  return Object.freeze({
    start: (
      rawRequest: unknown,
      repositoryRoot: unknown,
      recoveryCorrelationId: unknown = null,
      observeProviderStarted?: (
        notice: ProviderProcessStartedNotice,
      ) => boolean | Promise<boolean>,
      consumer:
        | "coordinator_cli"
        | "workbench"
        | "orchestrator" = "coordinator_cli",
      workspaceTarget?: BorrowedExecutionTarget,
    ) => {
      if (
        consumer !== "coordinator_cli" &&
        consumer !== "workbench" &&
        consumer !== "orchestrator"
      )
        throw new Error("coordinator_task_consumer_invalid");
      if (
        observeProviderStarted !== undefined &&
        typeof observeProviderStarted !== "function"
      )
        throw new Error("coordinator_task_start_observer_invalid");
      if (
        recoveryCorrelationId !== null &&
        (typeof recoveryCorrelationId !== "string" ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(recoveryCorrelationId))
      )
        throw new Error("coordinator_task_recovery_correlation_invalid");
      const controlCapability = Object.freeze({});
      const control: ControlRecord = {
        lifecycleState: "STATE-ADMISSION",
        managementCapability: Object.freeze({}),
        currentProcessControl: null,
        cancellationRequested: false,
        cancellationReceipt: null,
        cancellationSettlement: null,
        cancellationProtocolFailure: false,
        cancellationController: new AbortController(),
        ownedOperation: null,
        retainOperationRoot: false,
        processPoisoned: false,
        hostCleanupCompleted: false,
        hostRecoveryId: null,
        hostGenerationLossOutcome: null,
        hostGenerationLoss: null,
        hostGenerationLossHandling: null,
        hostGenerationFailureHandling: null,
        hostGenerationFailureObserved: false,
        releaseHostGenerationDrain: null,
        dockerFinalizations: [],
        dockerHandoffs: [],
        recoveryCorrelationId,
        consumer,
        observeProviderStarted,
        ...(workspaceTarget ? { workspaceTarget } : {}),
      };
      try {
        state.dependencies.observeLifecycleState?.("STATE-ADMISSION");
      } catch {
        // Passive observation must not gain control over Runtime admission.
      }
      state.controls.set(controlCapability, control);
      const completion: Promise<TaskCompletionRecord> = runCoordinatorTask(
        state,
        rawRequest,
        repositoryRoot,
        control,
      )
        .then(async (outcome) => {
          if (outcome[INTERNAL_TASK_OUTCOME] !== true)
            throw new Error("coordinator_task_internal_outcome_invalid");
          const rawResultRecord = snapshotRuntimeRecord(outcome.publicResult);
          if (!rawResultRecord) {
            await retainRuntimeRecoveryState(state, control);
            return blocked(
              "coordinator_task_result_observation_invalid",
              true,
              control.hostRecoveryId,
              null,
              null,
              false,
              null,
              controlDockerRecoveryIds(control),
            );
          }
          const cleanupProjectionEligible = outcome.dockerCleanupEligible;
          const observedDockerRecoveryIds = snapshotPlainArray<string>(
            rawResultRecord.dockerRecoveryIds,
            128,
          );
          const projectedDockerRecoveryIds = Object.freeze(
            observedDockerRecoveryIds.status === "ok"
              ? [...observedDockerRecoveryIds.value]
              : [...controlDockerRecoveryIds(control)],
          );
          let result: RuntimeRecord = Object.freeze({
            ...rawResultRecord,
            dockerRecoveryId:
              projectedDockerRecoveryIds.length === 1
                ? projectedDockerRecoveryIds[0]
                : null,
            dockerRecoveryIds: projectedDockerRecoveryIds,
          });
          const settleObservedHostLoss = async () => {
            if (
              !control.hostGenerationFailureObserved ||
              !control.hostGenerationLossHandling
            )
              return null;
            await control.hostGenerationLossHandling;
            return control.hostGenerationLossOutcome;
          };
          if ((await settleObservedHostLoss()) !== null) {
            if (control.hostGenerationLossOutcome === "cleanup_unknown") {
              result = blocked(
                "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
                true,
                control.hostRecoveryId,
                stringValue(result.dockerRecoveryId),
                stringValue(result.candidateRecoveryId),
                false,
                stringValue(result.candidateStoreRecoveryId),
                projectedDockerRecoveryIds,
              );
            } else if (
              control.hostGenerationLossOutcome === "cleanup_confirmed_failure"
            ) {
              result = Object.freeze({
                ...blocked(
                  "coordinator_task_host_generation_lost_cleanup_confirmed",
                ),
                cleanupConfirmed: false,
                manualRecoveryRequired:
                  rawResultRecord.manualRecoveryRequired === true,
                hostRecoveryId: stringValue(rawResultRecord.hostRecoveryId),
                dockerRecoveryId:
                  projectedDockerRecoveryIds.length === 1
                    ? projectedDockerRecoveryIds[0]
                    : null,
                dockerRecoveryIds: projectedDockerRecoveryIds,
                candidateRecoveryId: stringValue(
                  rawResultRecord.candidateRecoveryId,
                ),
                candidateStoreRecoveryId: stringValue(
                  rawResultRecord.candidateStoreRecoveryId,
                ),
              });
            }
          }
          try {
            let hostCleanupOutcome: unknown = null;
            let isHostProtocolFailure =
              control.hostGenerationLossOutcome === "cleanup_confirmed_failure";
            control.retainOperationRoot ||=
              control.hostGenerationLossOutcome === "cleanup_unknown" ||
              !cleanupProjectionEligible;
            if (control.retainOperationRoot)
              await retainRuntimeRecoveryState(state, control);
            for (const finalization of state.dependencies
              .prepareDockerHostCleanup && !control.retainOperationRoot
              ? control.dockerFinalizations
              : []) {
              const hostRecoveryId =
                state.dependencies.prepareDockerHostCleanup?.(
                  finalization.capability,
                );
              if (!hostRecoveryId) {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_host_cleanup_intent_unconfirmed",
                  true,
                  control.hostRecoveryId,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
              control.hostRecoveryId = hostRecoveryId;
            }
            if (control.ownedOperation && !control.retainOperationRoot) {
              const cleanupTarget = control.ownedOperation;
              const rawCleanup =
                await state.dependencies.cleanupOperation(cleanupTarget);
              const cleanup = state.dependencies.classifyOperationCleanup(
                rawCleanup,
                cleanupTarget,
              );
              if (!cleanup)
                throw new Error(
                  "coordinator_task_operation_cleanup_outcome_invalid",
                );
              if (cleanup === "protocol_failure_cleanup_confirmed")
                isHostProtocolFailure = true;
              hostCleanupOutcome = rawCleanup;
              control.hostCleanupCompleted = true;
              control.hostRecoveryId = null;
              control.ownedOperation = null;
              result = Object.freeze({ ...result, hostRecoveryId: null });
              if (
                result.status === "completed" &&
                (control.lifecycleState === "STATE-REVIEWER-CLEAN" ||
                  control.lifecycleState === "STATE-REMEDIATION-REVIEWER-CLEAN")
              )
                advanceLifecycleState(state, control, "STATE-HOST-CLEAN");
            }
            const lateHostLoss = await settleObservedHostLoss();
            if (lateHostLoss === "cleanup_unknown") {
              await retainRuntimeRecoveryState(state, control);
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              return blocked(
                "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
                true,
                control.hostRecoveryId,
                null,
                candidateRecoveryId,
                false,
                stringValue(result.candidateStoreRecoveryId),
                actionableDockerRecoveryIds(control),
              );
            }
            if (lateHostLoss === "cleanup_confirmed_failure")
              isHostProtocolFailure = true;
            for (const finalization of state.dependencies
              .recordDockerHostCleanupReceipt && !control.retainOperationRoot
              ? control.dockerFinalizations
              : []) {
              if (
                hostCleanupOutcome === null ||
                hostCleanupOutcome === undefined ||
                !state.dependencies.recordDockerHostCleanupReceipt?.(
                  finalization.capability,
                  Object.freeze({
                    hostCleanupOutcome,
                    dockerCompletion: finalization.dockerCompletion,
                  }),
                )
              ) {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_host_cleanup_receipt_unconfirmed",
                  true,
                  control.hostRecoveryId,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
            }
            const finalizeDockerRecovery =
              state.dependencies.finalizeDockerRecovery;
            for (const finalization of control.retainOperationRoot
              ? []
              : control.dockerFinalizations) {
              const finalized = finalizeDockerRecovery?.(
                finalization.capability,
              );
              if (finalized?.status !== "completed") {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_docker_recovery_finalization_unconfirmed",
                  true,
                  null,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
              const handoff = control.dockerHandoffs.find(
                (candidate) =>
                  candidate.capability === finalization.capability &&
                  candidate.recoveryId === finalization.recoveryId,
              );
              if (handoff?.state !== "finalizable") {
                await retainRuntimeRecoveryState(state, control);
                return blocked(
                  "coordinator_task_docker_recovery_handoff_state_invalid",
                  true,
                  null,
                  finalization.recoveryId,
                  stringValue(result.candidateRecoveryId),
                  false,
                  stringValue(result.candidateStoreRecoveryId),
                  actionableDockerRecoveryIds(control, [
                    finalization.recoveryId,
                  ]),
                );
              }
              handoff.state = "finalized";
            }
            const postDockerHostLoss = await settleObservedHostLoss();
            if (postDockerHostLoss === "cleanup_unknown") {
              await retainRuntimeRecoveryState(state, control);
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              return blocked(
                "coordinator_task_host_generation_lost_cleanup_unknown_process_restart_required",
                true,
                control.hostRecoveryId,
                null,
                candidateRecoveryId,
                false,
                stringValue(result.candidateStoreRecoveryId),
                actionableDockerRecoveryIds(control),
              );
            }
            if (postDockerHostLoss === "cleanup_confirmed_failure")
              isHostProtocolFailure = true;
            if (isHostProtocolFailure) {
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              const isCandidateStillRequiresRecovery = Boolean(
                candidateRecoveryId && true,
              );
              const dockerRecoveryIds = controlDockerRecoveryIds(control);
              const hostRecoveryId = control.retainOperationRoot
                ? control.hostRecoveryId
                : null;
              const candidateStoreRecoveryId = stringValue(
                result.candidateStoreRecoveryId,
              );
              const manualRecoveryRequired = Boolean(
                hostRecoveryId ||
                  dockerRecoveryIds.length > 0 ||
                  isCandidateStillRequiresRecovery ||
                  candidateStoreRecoveryId,
              );
              return blocked(
                "coordinator_task_host_generation_protocol_failed_cleanup_confirmed",
                manualRecoveryRequired,
                hostRecoveryId,
                dockerRecoveryIds.length === 1 ? dockerRecoveryIds[0] : null,
                isCandidateStillRequiresRecovery ? candidateRecoveryId : null,
                !manualRecoveryRequired,
                candidateStoreRecoveryId,
                dockerRecoveryIds,
              );
            }
            if (!cleanupProjectionEligible) {
              const candidateRecoveryId = stringValue(
                result.candidateRecoveryId,
              );
              return blocked(
                projectCoordinatorTaskPublicReason(
                  result.reason,
                  "coordinator_task_docker_recovery_projection_invalid",
                ),
                true,
                control.hostRecoveryId,
                projectedDockerRecoveryIds.length === 1
                  ? (projectedDockerRecoveryIds[0] ?? null)
                  : null,
                candidateRecoveryId,
                false,
                stringValue(result.candidateStoreRecoveryId),
                projectedDockerRecoveryIds,
              );
            }
            return projectCurrentDockerRecovery(result, control);
          } catch {
            await retainRuntimeRecoveryState(state, control);
            const candidateRecoveryId = stringValue(result.candidateRecoveryId);
            return blocked(
              result.reason ===
                "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_required"
                ? "coordinator_task_external_send_confirmation_cleanup_unknown_process_restart_and_operation_recovery_required"
                : "coordinator_task_operation_cleanup_unconfirmed",
              true,
              control.hostRecoveryId,
              null,
              candidateRecoveryId,
              null,
              null,
              actionableDockerRecoveryIds(control),
            );
          }
        })
        .catch(async () => {
          try {
            await retainRuntimeRecoveryState(state, control);
          } catch {
            poisonRuntimeProcess(state, control);
          }
          return blocked(
            "coordinator_task_operation_cleanup_unconfirmed",
            true,
            control.hostRecoveryId,
            null,
            null,
            null,
            null,
            controlDockerRecoveryIds(control),
          );
        })
        .then(async (settledResult): Promise<TaskCompletionRecord> => {
          let result = settledResult as TaskCompletionRecord;
          try {
            if (control.cancellationRequested && control.cancellationSettlement)
              await control.cancellationSettlement;
            if (control.hostGenerationFailureObserved) {
              if (result.manualRecoveryRequired === true)
                poisonRuntimeProcess(state, control);
              control.releaseHostGenerationDrain?.();
              control.releaseHostGenerationDrain = null;
            }
            control.processPoisoned ||=
              state.dependencies.isProcessPoisoned?.() === true;
            if (control.cancellationProtocolFailure) {
              const manualRecoveryRequired =
                result.manualRecoveryRequired === true;
              result = Object.freeze({
                ...result,
                status: "blocked" as const,
                reason: manualRecoveryRequired
                  ? "coordinator_task_cancellation_protocol_failed_cleanup_unknown"
                  : "coordinator_task_cancellation_protocol_failed_cleanup_confirmed",
                cleanupConfirmed:
                  !manualRecoveryRequired && result.cleanupConfirmed === true,
                manualRecoveryRequired,
                processRestartRequired: true,
              }) as TaskCompletionRecord;
            } else {
              result = Object.freeze({
                ...result,
                processRestartRequired: control.processPoisoned,
              }) as TaskCompletionRecord;
            }
          } catch {
            result = finalProjectionFailure(result, control);
          } finally {
            control.observeProviderStarted = undefined;
            state.controls.delete(controlCapability);
          }
          advanceLifecycleState(
            state,
            control,
            classifyCoordinatorTaskTerminalLifecycleState(result),
          );
          return result;
        })
        .then((result): TaskCompletionRecord => {
          if (control.workspaceTarget) {
            const workspaceResult = projectBorrowedExecutionResult(
              control.borrowedWorkspaceCapability,
              control.workspaceTarget,
            );
            result = Object.freeze({
              ...result,
              canonicalRepositoryChanged:
                workspaceResult.canonicalRepositoryChanged,
              workspaceResult,
            });
          }
          return result;
        });
      return Object.freeze({
        status: "started" as const,
        reason: "coordinator_task_started",
        controlCapability,
        completion,
        rawOutputReported: false,
        hostPathReported: false,
        untrustedProviderTextReported: false,
        credentialAbsenceVerified: false,
      });
    },
    captureResultDelivery: (controlCapability: unknown) => {
      if (!controlCapability || typeof controlCapability !== "object")
        return null;
      const control = state.controls.get(controlCapability);
      if (control?.consumer !== "orchestrator") return null;
      return captureProjectTaskResultDelivery(state, control);
    },
    cancel: (controlCapability: unknown) => {
      if (!controlCapability || typeof controlCapability !== "object") {
        return Promise.resolve(INVALID_CONTROL_CANCELLATION_RESULT);
      }
      const control = state.controls.get(controlCapability);
      if (!control) {
        return Promise.resolve(INVALID_CONTROL_CANCELLATION_RESULT);
      }
      return requestControlCancellation(state, control);
    },
  });
}

/**
 * 元Taskの終端結果だけを耐久保存Ownerへ渡す。
 * @responsibility 捕捉したControlと元Docker終了Ownerの対応を毎回照合する。
 * @trace ARCH-000004
 * @input state: 元Runtime、control: 実行中に捕捉した耐久ConsumerのControl。
 * @returns freshな固定結果集合を読み取る同期閉包。
 * @precondition 捕捉はcontrols削除前に行い、利用はHost清掃と全handoff終了後に限る。
 * @postcondition 結果集合は全件確認後にだけ返し、開始・取消権限を追加しない。
 * @effect 既存Ownerで固定結果を読取り、受領保存・配送解除は発行しない。
 * @failure 終端前、相関不一致、部分読取り、排他未解放を拒否する。
 * @invariant IDからOwnerを再生成せず、元capabilityと回復IDの一意な対を保持する。
 * @boundary 同ProcessのTaskとCoordinator耐久受領。
 * @security 閉包を公開Requestや永続Stateへ格納しない。
 * @concurrency Control削除後も捕捉済み参照だけを使い、各利用時に現在条件を再確認する。
 */
function captureProjectTaskResultDelivery(
  state: taskRuntimeState,
  control: ControlRecord,
) {
  const ready = () =>
    control.consumer === "orchestrator" &&
    control.hostCleanupCompleted &&
    control.ownedOperation === null &&
    (control.lifecycleState === "STATE-RESULT-PUBLISHED" ||
      control.lifecycleState === "STATE-BLOCKED-CLEAN") &&
    control.dockerFinalizations.length === control.dockerHandoffs.length &&
    control.dockerFinalizations.every(
      (item, index, results) =>
        results.findIndex((other) => other.recoveryId === item.recoveryId) ===
          index &&
        results.findIndex((other) => other.capability === item.capability) ===
          index &&
        control.dockerHandoffs.filter(
          (handoff) =>
            handoff.capability === item.capability &&
            handoff.recoveryId === item.recoveryId &&
            handoff.state === "finalized",
        ).length === 1,
    );
  return Object.freeze({
    readResults: () => {
      if (!ready())
        return Object.freeze({ status: "blocked" as const, results: null });
      if (control.dockerFinalizations.length === 0)
        return Object.freeze({
          status: "not_required" as const,
          results: null,
        });
      if (!state.dependencies.readDockerProjectResult)
        return Object.freeze({ status: "blocked" as const, results: null });
      const results = [];
      for (const item of control.dockerFinalizations) {
        const observed = state.dependencies.readDockerProjectResult(
          item.capability,
        );
        if (
          observed.status !== "completed" ||
          !observed.lockReleased ||
          observed.value?.consumer !== "orchestrator" ||
          observed.value.recoveryId !== item.recoveryId
        )
          return Object.freeze({ status: "blocked" as const, results: null });
        results.push(observed.value);
      }
      return Object.freeze({
        status: "completed" as const,
        results: Object.freeze(results),
      });
    },
  });
}

const taskProductionRuntime = createRuntime(productionDependencies);

/**
 * 実行中の元Taskから耐久結果配送の参照を捕捉する。
 * @responsibility orchestratorの真正Controlだけを固定結果配送へ接続する。
 * @trace ARCH-000004
 * @input controlCapability: 起動結果で受け取った元Control。
 * @returns 同Processの結果配送閉包、またはnull。
 * @precondition Task完了によるControl削除前に呼ぶ。
 * @postcondition 完了後の再捕捉とCLI・Workbenchへの提供を拒否する。
 * @effect N/A: 捕捉は既存参照だけを保持し、保存や外部処理を行わない。
 * @failure 偽Control、完了済みControl、別Consumerはnull。
 * @invariant 新しい台帳・Lock・回復Identityを作らない。
 * @boundary Taskの実行寿命と上位耐久保存の寿命。
 * @security 開始・取消・通常回復のAuthorityを返さない。
 * @concurrency 捕捉後も終端条件を各利用時に再確認する。
 */
export function captureRuntimeOwnedCoordinatorTaskResultDelivery(
  controlCapability: unknown,
) {
  return taskProductionRuntime.captureResultDelivery(controlCapability);
}

/**
 * Runtime 所有 Coordinator Taskを開始する。
 *
 * @responsibility Runtime 所有 Coordinator Taskの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input Task要求、Repository Root、回復相関ID、任意のProvider接続用Host Process開始確認と本番組立ての固定利用側。JSON要求から利用側を取得しない。
 * @returns startRuntimeOwnedCoordinatorTaskの計算結果を返す。
 * @precondition 実行Processの片付けが確定しており、要求・Root・回復相関IDが下位Runtimeの入力契約を満たす。
 * @postcondition startRuntimeOwnedCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect Taskを開始し、下位Runtimeの検査と外部送信許可が成立した場合だけ隔離実行を委譲する。
 * @failure startRuntimeOwnedCoordinatorTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startRuntimeOwnedCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 通常Task入口からRepository検査、外部送信許可、隔離実行への境界。
 * @security startRuntimeOwnedCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency Process停止条件を開始前に確認し、返したControlと完了Promiseで同じTaskを追跡する。
 */
export function startRuntimeOwnedCoordinatorTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  recoveryCorrelationId: unknown = null,
  observeProviderStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => boolean | Promise<boolean>,
  consumer:
    | "coordinator_cli"
    | "workbench"
    | "orchestrator" = "coordinator_cli",
  rawWorkspaceTarget?: BorrowedExecutionTarget,
) {
  if (isRuntimeProcessEffectBlocked()) {
    throw new Error(
      isRuntimeProcessPoisoned()
        ? "coordinator_task_process_restart_required"
        : "coordinator_task_runtime_cleanup_in_progress",
    );
  }
  if (
    observeProviderStarted !== undefined &&
    typeof observeProviderStarted !== "function"
  )
    throw new Error("coordinator_task_start_observer_invalid");
  const workspaceTarget =
    rawWorkspaceTarget === undefined
      ? null
      : inspectBorrowedExecutionTarget(repositoryRoot, rawWorkspaceTarget);
  if (workspaceTarget === null)
    throw new Error("coordinator_task_workspace_target_invalid");
  if (
    consumer !== "coordinator_cli" &&
    consumer !== "workbench" &&
    consumer !== "orchestrator"
  )
    throw new Error("coordinator_task_consumer_invalid");
  if (
    observeProviderStarted !== undefined &&
    typeof observeProviderStarted !== "function"
  )
    throw new Error("coordinator_task_start_observer_invalid");
  return taskProductionRuntime.start(
    rawRequest,
    repositoryRoot,
    recoveryCorrelationId,
    observeProviderStarted,
    consumer,
    workspaceTarget,
  );
}

/**
 * Runtime 所有 Coordinator Taskを取り消す。
 *
 * @responsibility Runtime 所有 Coordinator Taskの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000004
 * @input controlCapability: unknown
 * @returns cancelRuntimeOwnedCoordinatorTaskの計算結果を返す。
 * @precondition 「controlCapability: unknown」がcancelRuntimeOwnedCoordinatorTaskの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedCoordinatorTaskは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelRuntimeOwnedCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security cancelRuntimeOwnedCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelRuntimeOwnedCoordinatorTaskは共有非同期状態を持たない同期処理である。
 */
export function cancelRuntimeOwnedCoordinatorTask(controlCapability: unknown) {
  return taskProductionRuntime.cancel(controlCapability);
}

/** 開発用の限定受付は通常Taskの公開入口と分離する。 */
const developmentObjectiveCancellations = new WeakMap<
  object,
  () => Promise<unknown>
>();

/**
 * Runtime 所有 Development Taskを開始する。
 *
 * @responsibility Runtime 所有 Development Taskの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input Task要求、Repository Root、開発Session、候補処置、回復相関IDと任意のProvider接続用Host Process開始確認。
 * @returns startRuntimeOwnedDevelopmentTaskの計算結果を返す。
 * @precondition 「rawRequest: unknown、repositoryRoot: unknown、sessionCapability: object、candidateDisposition: "discard" | "orchestrator_owned"、recoveryCorrelationId: unknown」がstartRuntimeOwnedDevelopmentTaskの入力契約を満たす。
 * @postcondition startRuntimeOwnedDevelopmentTaskの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDevelopmentTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure startRuntimeOwnedDevelopmentTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant startRuntimeOwnedDevelopmentTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startRuntimeOwnedDevelopmentTaskはProcess内の同一Subsystemで完結する。
 * @security startRuntimeOwnedDevelopmentTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency startRuntimeOwnedDevelopmentTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
function startRuntimeOwnedDevelopmentTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  sessionCapability: object,
  candidateDisposition: "discard" | "orchestrator_owned",
  recoveryCorrelationId: unknown = null,
  observeProviderStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => boolean | Promise<boolean>,
  consumer: "coordinator_cli" | "orchestrator" = "coordinator_cli",
) {
  if (
    observeProviderStarted !== undefined &&
    typeof observeProviderStarted !== "function"
  )
    throw new Error("coordinator_task_start_observer_invalid");
  const timing = createDevelopmentExecutionTiming(
    undefined,
    writeDevelopmentMeasurementProgress,
  );
  const boundary = reserveRuntimeOwnedDevelopmentMeasurementTask(
    sessionCapability,
    rawRequest,
    repositoryRoot,
  );
  if (!boundary)
    throw new Error("coordinator_task_development_permission_required");
  /**
   * guardを決定する。
   *
   * @responsibility guardの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000004
   * @input action: (...args: Args) => Result
   * @returns guardの計算結果を返す。
   * @precondition 「action: (...args: Args) => Result」がguardの入力契約を満たす。
   * @postcondition guardの責務を完了した結果だけを返す。
   * @effect N/A: guardは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure guardは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant guardは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: guardはProcess内の同一Subsystemで完結する。
   * @security guardはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: guardは共有非同期状態を持たない同期処理である。
   */
  function guard<Args extends unknown[], Result>(
    action: (...args: Args) => Result,
  ) {
    return (...args: Args): Result => {
      if (!boundary?.checkNewWork())
        throw new Error("coordinator_task_development_permission_expired");
      return action(...args);
    };
  }
  const runtime = createRuntime({
    ...productionDependencies,
    observeLifecycleState: timing.observeLifecycleState,
    beginInvocation: boundary.beginInvocation,
    inspectRepository: guard(productionDependencies.inspectRepository),
    createOperation: guard(productionDependencies.createOperation),
    bindRepository: guard((management, root) => {
      const result = bindRuntimeOwnedRepositoryOperation(management, root);
      if (
        !result ||
        !boundary.bindOperation(management, result.repositoryBindingCapability)
      )
        return null;
      return result;
    }),
    prepareDockerRecoveryState: guard((root) =>
      root === boundary.repositoryRoot
        ? inspectRuntimeOwnedDockerTaskAdmission(root)
        : Object.freeze({
            status: "blocked",
            reason: "coordinator_current_admission_unconfirmed",
            lockReleased: true,
          }),
    ),
    observeProviderHome: (provider) =>
      inspectRuntimeOwnedWindowsProviderHomeCandidate(
        provider,
        boundary.context,
      ),
    materializeWorkspace: guard(productionDependencies.materializeWorkspace),
    preflightSlate: guard(productionDependencies.preflightSlate),
    issueSelection: guard(productionDependencies.issueSelection),
    issueMountGrant: guard(productionDependencies.issueMountGrant),
    consumeMountGrant: guard(productionDependencies.consumeMountGrant),
    issueTaskPacket: guard(productionDependencies.issueTaskPacket),
    prepareProvider: guard(productionDependencies.prepareProvider),
    captureCandidate: guard(productionDependencies.captureCandidate),
  });
  const started = runtime.start(
    boundary.request,
    boundary.repositoryRoot,
    recoveryCorrelationId,
    observeProviderStarted,
    consumer,
  );
  const cancel = () => runtime.cancel(started.controlCapability);
  let cancellation: Promise<unknown> | null = null;
  const requestCancellation = () => {
    cancellation ??= cancel();
    void cancellation.catch(() => {});
  };
  const timer = setTimeout(
    requestCancellation,
    Math.max(0, boundary.expiresAtMs - Date.now()),
  );
  boundary.signal.addEventListener("abort", requestCancellation, {
    once: true,
  });
  if (boundary.signal.aborted) requestCancellation();
  const completion = started.completion
    .then(async (taskResult) => {
      if (cancellation) await cancellation.catch(() => {});
      const cleanupConfirmed = taskResult.cleanupConfirmed === true;
      const publishedTaskResult = projectDevelopmentTaskResultAfterOuterCleanup(
        taskResult,
        cleanupConfirmed,
      );
      boundary.finish(cleanupConfirmed ? "finished" : "cleanup_unknown");
      timing.finish();
      return Object.freeze({
        status:
          taskResult.status === "completed" && cleanupConfirmed
            ? "completed"
            : "blocked",
        executionSourceKind: "fixed_development_candidate",
        releaseAuthorityConferred: false,
        taskResult: publishedTaskResult,
        cleanupConfirmed,
        manualRecoveryRequired:
          taskResult.manualRecoveryRequired || !cleanupConfirmed,
        executionTiming: timing.snapshot(),
      });
    })
    .catch((error: unknown) => {
      boundary.finish("cleanup_unknown");
      throw error;
    })
    .finally(() => {
      timing.finish();
      clearTimeout(timer);
      boundary.signal.removeEventListener("abort", requestCancellation);
      developmentObjectiveCancellations.delete(started.controlCapability);
    });
  if (candidateDisposition === "orchestrator_owned")
    developmentObjectiveCancellations.set(started.controlCapability, cancel);
  return Object.freeze({
    ...started,
    completion,
    cancel,
    readExecutionTiming: timing.snapshot,
  });
}

/**
 * Comparison-only development Tasks discard their candidates on completion.
 *
 * @responsibility Runtime 所有 Development Coordinator Taskの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input Task要求、Repository Root、開発Sessionと任意のProvider接続用Host Process開始確認。
 * @returns startRuntimeOwnedDevelopmentCoordinatorTaskの計算結果を返す。
 * @precondition 「rawRequest: unknown、repositoryRoot: unknown、sessionCapability: object」がstartRuntimeOwnedDevelopmentCoordinatorTaskの入力契約を満たす。
 * @postcondition startRuntimeOwnedDevelopmentCoordinatorTaskの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDevelopmentCoordinatorTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: startRuntimeOwnedDevelopmentCoordinatorTaskは独自の失敗分岐を所有しない。
 * @invariant startRuntimeOwnedDevelopmentCoordinatorTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startRuntimeOwnedDevelopmentCoordinatorTaskはProcess内の同一Subsystemで完結する。
 * @security startRuntimeOwnedDevelopmentCoordinatorTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startRuntimeOwnedDevelopmentCoordinatorTaskは共有非同期状態を持たない同期処理である。
 */
export function startRuntimeOwnedDevelopmentCoordinatorTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  sessionCapability: object,
  observeProviderStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => boolean | Promise<boolean>,
) {
  return startRuntimeOwnedDevelopmentTask(
    rawRequest,
    repositoryRoot,
    sessionCapability,
    "discard",
    null,
    observeProviderStarted,
  );
}

/**
 * Coordinator owns candidate integration and cleanup after Task completion.
 *
 * @responsibility Runtime 所有 Development Coordinator Taskの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000004
 * @input Task要求、Repository Root、開発Session、回復相関IDと任意のProvider接続用Host Process開始確認。
 * @returns startRuntimeOwnedDevelopmentObjectiveTaskの計算結果を返す。
 * @precondition 「rawRequest: unknown、repositoryRoot: unknown、sessionCapability: object、recoveryCorrelationId: unknown」がstartRuntimeOwnedDevelopmentObjectiveTaskの入力契約を満たす。
 * @postcondition startRuntimeOwnedDevelopmentObjectiveTaskの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDevelopmentObjectiveTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: startRuntimeOwnedDevelopmentObjectiveTaskは独自の失敗分岐を所有しない。
 * @invariant startRuntimeOwnedDevelopmentObjectiveTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startRuntimeOwnedDevelopmentObjectiveTaskはProcess内の同一Subsystemで完結する。
 * @security startRuntimeOwnedDevelopmentObjectiveTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startRuntimeOwnedDevelopmentObjectiveTaskは共有非同期状態を持たない同期処理である。
 */
export function startRuntimeOwnedDevelopmentObjectiveTask(
  rawRequest: unknown,
  repositoryRoot: unknown,
  sessionCapability: object,
  recoveryCorrelationId: unknown = null,
  observeProviderStarted?: (
    notice: ProviderProcessStartedNotice,
  ) => boolean | Promise<boolean>,
) {
  const started = startRuntimeOwnedDevelopmentTask(
    rawRequest,
    repositoryRoot,
    sessionCapability,
    "orchestrator_owned",
    recoveryCorrelationId,
    observeProviderStarted,
    "orchestrator",
  );
  return Object.freeze({
    status: started.status,
    controlCapability: started.controlCapability,
    completion: started.completion.then((outcome) => outcome.taskResult),
  });
}

/**
 * Runtime 所有 Development Coordinator Taskを取り消す。
 *
 * @responsibility Runtime 所有 Development Coordinator Taskの取消条件、終了状態、残存Effectの境界を所有する。
 * @trace ARCH-000004
 * @input controlCapability: object
 * @returns cancelRuntimeOwnedDevelopmentObjectiveTaskの計算結果を返す。
 * @precondition 「controlCapability: object」がcancelRuntimeOwnedDevelopmentObjectiveTaskの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedDevelopmentObjectiveTaskの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedDevelopmentObjectiveTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedDevelopmentObjectiveTaskは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedDevelopmentObjectiveTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelRuntimeOwnedDevelopmentObjectiveTaskはProcess内の同一Subsystemで完結する。
 * @security cancelRuntimeOwnedDevelopmentObjectiveTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency cancelRuntimeOwnedDevelopmentObjectiveTaskは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export function cancelRuntimeOwnedDevelopmentObjectiveTask(
  controlCapability: object,
) {
  const cancel = developmentObjectiveCancellations.get(controlCapability);
  return cancel ? cancel() : Promise.resolve(false);
}

/**
 * Isolated Coordinator Task Runtime 候補を構築する。
 *
 * @responsibility Isolated Coordinator Task Runtime 候補の構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedCoordinatorTaskRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedCoordinatorTaskRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedCoordinatorTaskRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedCoordinatorTaskRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedCoordinatorTaskRuntimeCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedCoordinatorTaskRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedCoordinatorTaskRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedCoordinatorTaskRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedCoordinatorTaskRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedCoordinatorTaskRuntimeCandidate(
  dependencies: taskRuntimeDependencies,
) {
  return Object.freeze({
    productionAuthority: false as const,
    ...createRuntime(dependencies),
  });
}

/**
 * Coordinator Task Runtime 契約の公開契約を記述する。
 *
 * @responsibility Coordinator Task Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorTaskRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorTaskRuntimeContractの入力契約を満たす。
 * @postcondition describeCoordinatorTaskRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorTaskRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorTaskRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorTaskRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCoordinatorTaskRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeCoordinatorTaskRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCoordinatorTaskRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorTaskRuntimeContract() {
  return Object.freeze({
    contract: COORDINATOR_TASK_RUNTIME_CONTRACT,
    contractRevision: COORDINATOR_TASK_RUNTIME_CONTRACT_REVISION,
    flow: "front_to_coordinator_to_executor_to_candidate_revision_to_independent_reviewer_to_result_integration",
    routes: Object.freeze([
      "front_codex__executor_codex",
      "front_codex__executor_claude",
      "front_claude__executor_codex",
      "front_claude__executor_claude",
    ]),
    providerSelection: "explainable_cross_provider_preferred_cost_bounded",
    executorConstraint:
      "optional_auto_codex_or_claude_normalized_once_and_enforced_by_the_same_slate_and_selection_gate",
    repositoryObjectFormat:
      "sha1_only_preflight_before_operation_external_send_or_workspace",
    selectionNotice:
      "safe_preselection_event_before_provider_effect_with_deferred_preflight_explicit",
    executorWorkspace: "caller_resolved_borrowed_working_tree_read_write",
    reviewerWorkspace: "same_exact_candidate_read_only",
    taskTransport: "opaque_single_use_provider_stdin_only",
    recognizedSecretBoundary:
      "task_scope_and_read_projection_before_executor_candidate_capture_before_each_reviewer_and_remediation_path_before_next_executor",
    completeSecretAbsenceVerified: false,
    productionPackageGate: "not_required_for_runtime_execution",
    processPoisonGate:
      "before_operation_console_workspace_provider_and_network",
    processRestartProjection:
      "runtime_owned_final_irreversible_process_poison_boolean_independent_from_recovery_identifiers_manual_recovery_reason_and_temporary_drain",
    cancellation: Object.freeze({
      liveControlReceipt:
        "exact_status_reason_cancellation_requested_process_termination_observed",
      reasonCorrelation:
        "termination_true_requested_or_termination_false_grace_exceeded",
      duplicateLiveOperation:
        "same_cancellation_effect_same_promise_same_frozen_receipt",
      invalidForeignOrExpiredControl:
        "exact_blocked_control_invalid_with_zero_effect",
      legacyReceiptFallbackAllowed: false,
      acknowledgmentTimeoutMs: PRODUCTION_CANCELLATION_ACK_TIMEOUT_MS,
      protocolFailure:
        "irreversible_process_poison_joined_before_completion_projection_while_resource_cleanup_continues",
      liveControlLifetime:
        "from_started_return_until_outer_completion_final_settlement_including_cleanup",
    }),
    completionOwnership:
      "production_producer_returns_exact_native_promise_and_owns_settlement_non_native_completion_is_not_runner_authority",
    hostOperationGenerationReadiness:
      "dedicated_supervisor_process_round_trip_then_same_generation_and_durable_record_file_hash_state_root_children_reconfirmation_before_any_following_effect",
    hostOperationSupervisorOutcomes:
      "acquired_unavailable_cleanup_confirmed_failure_or_cleanup_unknown_with_exact_recovery_and_process_poison",
    operationCreationCancellation:
      "rechecked_after_async_creation_before_repository_policy_slate_console_or_provider_effect",
    interactiveCleanupRecovery:
      "restart_only_without_operation_recovery_id_unless_operation_cleanup_also_fails",
    workspaceOwnership:
      "caller_creates_resolves_and_closes_coordinator_only_borrows",
    candidatePersistence: "not_issued_by_task_completion",
    dockerRecoveryPreflight:
      "runtime_owned_bounded_state_audit_before_task_operation",
    executionSlate:
      "executor_and_reviewer_preflighted_together_before_external_send_or_provider_effect",
    independentReview: Object.freeze({
      providerIndependent: "preferred_subject_provider_excluded",
      executionContextIndependent:
        "low_risk_local_bounded_only_with_separate_grant_packet_process_and_read_only_candidate",
      highRiskSameProviderAllowed: false,
    }),
    candidateReviewClassification:
      "candidate_integrity_verification_failure_is_distinct_from_independent_reviewer_semantic_rejection",
    boundedRemediation:
      "maximum_one_same_executor_then_same_independent_reviewer",
    providerTurnObservations:
      "validated_non_authority_requested_reported_absolute_limit_and_target_exceeded_after_cleanup_for_each_accepted_claude_stage",
    externalSendPolicy:
      "exact_bound_repository_commit_policy_plus_terminal_safe_full_scope_confirmation",
    recoveryIdentifiers: Object.freeze(["host", "docker_task"]),
    successfulHostRecoveryProjection: "explicit_null_never_omitted",
    resultPublication: "cleanup_and_candidate_reverification_required",
    directWorkingTreeEffectAllowed: true,
    implicitGitMutationAllowed: false,
    directProviderToProviderSpawnAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
    rawOutputReported: false,
  });
}

export const DOCKER_EFFECT_RUNTIME_CONTRACT =
  "crdd-coordinator/docker-effect-runtime";

export const DOCKER_EFFECT_RUNTIME_CONTRACT_REVISION = 10;

/**
 * 上位の計画投影を同じ下位Runtimeへ結合する。
 *
 * @responsibility 元計画の所属と意味を検証し、技術入力・元結果だけを搬送する。
 * @trace ARCH-000008
 * @input runtime: 固定下位API。borrowPaths: 既存Ownerの所在借用。
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
export function bindDockerIsolationRuntime(
  runtime: ReturnType<typeof createDockerIsolationRuntime>,
  borrowPaths: typeof borrowOwnedDockerExecutionPaths,
) {
  /**
   * 上位の検証済み計画をDocker技術入力へ投影する。
   *
   * @responsibility Model・Task・許可の相関を上位で検証し、技術値だけを下位へ渡す。
   * @trace ARCH-000008
   * @input plan: 元計画。managementCapability: 元の現在Owner。
   * @returns 同じ計画のHash、固定技術構成、限定stdin。
   * @precondition 既存Ownerの所在借用と元計画の完全照合が成立する。
   * @postcondition 上位のState・Packet・Authorityを下位へ渡さない。
   * @effect 既存Ownerの所在・固定配布物を観測する。Docker要求は発行しない。
   * @failure 所在不明・不正計画・構成不能では例外で停止する。
   * @invariant 元のHashを新しい実行許可へ昇格しない。
   * @boundary Coordinatorの意味検証とDocker Isolationの技術構成の間。
   * @security Secretは限定stdinとContainer内payloadだけへ搬送し、診断しない。
   * @concurrency 同じOwnerを操作直前に観測し、下位も借用所在を再照合する。
   */
  function project(
    plan: isolationExecutionPreparedPlan,
    managementCapability: object,
  ): DockerIsolationRuntimePlan {
    const paths = borrowPaths(managementCapability);
    if (!validatePlan(plan, paths.tmp))
      throw new Error("docker_effect_plan_invalid");
    const configuration = resolveIsolationCommandInput(plan, paths.tmp);
    if (!configuration) throw new Error("docker_effect_plan_invalid");
    return Object.freeze({
      identity: planIdentity(plan),
      configuration,
      stdin: plan.providerInput,
    });
  }

  /**
   * 元計画に所属する操作だけを技術Ownerで開始する。
   *
   * @responsibility command objectの同一性を照合して固定purposeを下位へ渡す。
   * @trace ARCH-000008
   * @input command、plan、managementCapability: 元の操作とOwner。
   * @returns 下位Ownerの元Handle。
   * @precondition commandは元計画の同じobjectである。
   * @postcondition raw argvを下位の公開開始入力へ渡さない。
   * @effect 下位Ownerへ固定Docker操作を委譲する。
   * @failure 不明Owner・別command・不正計画は開始前に拒否する。
   * @invariant Task・Provider判断と技術Process所有を複製しない。
   * @boundary 上位計画の所属照合から下位技術操作への境界。
   * @security コピーしたcommandや任意Docker操作を受理しない。
   * @concurrency 元の操作相関を同じ生涯で維持する。
   */
  function startCommand(
    command: isolationExecutionCommand,
    plan: isolationExecutionPreparedPlan,
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
    plan: isolationExecutionPreparedPlan,
    recoveryCapability: object,
    managementCapability: unknown,
  ) {
    try {
      if (!managementCapability || typeof managementCapability !== "object")
        throw new Error("docker_effect_management_required");
      return await runtime.cleanupOwnedResources(
        project(plan, managementCapability),
        recoveryCapability,
        managementCapability,
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
    plan: isolationExecutionPreparedPlan,
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
    plan: isolationExecutionPreparedPlan,
    recoveryCapability: object,
    managementCapability: object,
    hooks: DockerExecutionHooks,
  ) {
    return runtime.startExecution(
      project(plan, managementCapability),
      recoveryCapability,
      managementCapability,
      hooks,
    );
  }

  return Object.freeze({
    startExecution,
    startCommand,
    cleanupOwnedResources,
    verifyCleanupOutcome,
  });
}

const productionRuntime = bindDockerIsolationRuntime(
  createDockerIsolationRuntime({
    borrowPaths: borrowOwnedDockerExecutionPaths,
    inspectReceipts: inspectRuntimeOwnedDockerResourceReceipts,
  }),
  borrowOwnedDockerExecutionPaths,
);

/**
 * Runtime 所有 Docker Commandを開始する。
 *
 * @responsibility Runtime 所有 Docker Commandの開始条件、Effect発行、開始失敗時の終了境界を所有する。
 * @trace ARCH-000008
 * @input command: Command、plan: PreparedPlan、managementCapability: unknown
 * @returns startRuntimeOwnedDockerCommandの計算結果を返す。
 * @precondition 「command: Command、plan: PreparedPlan、managementCapability: unknown」がstartRuntimeOwnedDockerCommandの入力契約を満たす。
 * @postcondition startRuntimeOwnedDockerCommandの責務を完了した結果だけを返す。
 * @effect N/A: startRuntimeOwnedDockerCommandは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: startRuntimeOwnedDockerCommandは独自の失敗分岐を所有しない。
 * @invariant startRuntimeOwnedDockerCommandは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: startRuntimeOwnedDockerCommandはProcess内の同一Subsystemで完結する。
 * @security startRuntimeOwnedDockerCommandはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: startRuntimeOwnedDockerCommandは共有非同期状態を持たない同期処理である。
 */
export function startRuntimeOwnedDockerCommand(
  command: isolationExecutionCommand,
  plan: isolationExecutionPreparedPlan,
  managementCapability: unknown,
) {
  return productionRuntime.startCommand(command, plan, managementCapability);
}

/**
 * Docker Effect Runtime 契約の公開契約を記述する。
 *
 * @responsibility Docker Effect Runtime 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerEffectRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerEffectRuntimeContractの入力契約を満たす。
 * @postcondition describeDockerEffectRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeDockerEffectRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeDockerEffectRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerEffectRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeDockerEffectRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeDockerEffectRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerEffectRuntimeContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerEffectRuntimeContract() {
  const environment = describeDockerIsolationExecutionEnvironment();
  return Object.freeze({
    contract: DOCKER_EFFECT_RUNTIME_CONTRACT,
    contractRevision: DOCKER_EFFECT_RUNTIME_CONTRACT_REVISION,
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

export const COORDINATOR_SINGLE_TASK_PRE_EFFECT_REJECTIONS = Object.freeze([
  ...COORDINATOR_TASK_PRE_EFFECT_REJECTIONS,
]);

/**
 * 単一Task実行と結果配送の捕捉に必要な依存契約を定義する。
 *
 * @responsibility Coordinatorへの実行依存とCoordinatorの結果配送捕捉を結合する。
 * @trace ARCH-000004
 * @shape CoordinatorTaskDependenciesに任意のcaptureResultDelivery関数を加える。
 * @invariant 配送捕捉の欠落やnullを耐久受領の成功へ読み替えない。
 * @boundary CoordinatorのTask実行とCoordinatorの結果受領の間。
 * @security controlCapabilityは配送捕捉へ渡し、公開結果へ直接露出しない。
 * @compatibility Coordinatorの依存契約を維持し、配送捕捉を追加の結合点として扱う。
 */
export type CoordinatorSingleTaskDependencies = CoordinatorTaskDependencies &
  Readonly<{
    captureResultDelivery?: (
      controlCapability: unknown,
    ) => CoordinatorTaskResultDelivery | null;
  }>;

/**
 * IF-SINGLE-TASK adapter: run exactly one task attempt on the existing v0.18
 *
 * @responsibility Coordinator Single Task Attemptの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input dependencies: CoordinatorSingleTaskDependencies、input: CoordinatorSingleTaskAttemptInput
 * @returns Promise<CoordinatorSingleTaskResult>を返す。
 * @precondition 「dependencies: CoordinatorSingleTaskDependencies、input: CoordinatorSingleTaskAttemptInput」がrunCoordinatorSingleTaskAttemptの入力契約を満たす。
 * @postcondition runCoordinatorSingleTaskAttemptの責務を完了した結果だけを返す。
 * @effect 共通Task処理へ検証済み入力を渡し、許可された実行・取消を委譲する。
 * @failure runCoordinatorSingleTaskAttemptは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCoordinatorSingleTaskAttemptは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security runCoordinatorSingleTaskAttemptはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency runCoordinatorSingleTaskAttemptは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function runCoordinatorSingleTaskAttempt(
  dependencies: CoordinatorSingleTaskDependencies,
  input: CoordinatorSingleTaskAttemptInput,
): Promise<CoordinatorSingleTaskResult> {
  const ids =
    input && typeof input === "object"
      ? [input.attemptId, input.operationId, input.authorityBindingId]
      : [];
  const isValidInput =
    ids.length === 3 &&
    ids.every(
      (id) =>
        typeof id === "string" &&
        id.length > 0 &&
        id.length <= 128 &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id),
    ) &&
    typeof input.repositoryRevision === "string" &&
    /^[0-9a-f]{40,64}$/u.test(input.repositoryRevision) &&
    input.cancellationSignal instanceof AbortSignal &&
    (input.observeStarted === undefined ||
      typeof input.observeStarted === "function") &&
    (input.observeResultDelivery === undefined ||
      typeof input.observeResultDelivery === "function");
  if (!isValidInput)
    return Object.freeze({
      contract: COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
      attemptId: null,
      operationId: null,
      authorityBindingId: null,
      repositoryRevision: null,
      status: "blocked",
      reason: "single_task_input_invalid",
      effectState: "no_effect",
      cleanupConfirmed: true,
      manualRecoveryRequired: false,
      processRestartRequired: false,
      candidateId: null,
      recoveryIds: Object.freeze([]),
      recoveryObligations: Object.freeze([]),
    });
  const attemptId = input.attemptId;
  const authorityBindingId = input.authorityBindingId;
  const repositoryRevision = input.repositoryRevision;
  const completed = await runCoordinatorTaskAttempt(
    {
      ...dependencies,
      startTask: (...args) => {
        const started = dependencies.startTask(...args);
        if (input.observeResultDelivery) {
          let delivery: CoordinatorTaskResultDelivery | null = null;
          try {
            const descriptor =
              started &&
              typeof started === "object" &&
              !utilTypes.isProxy(started)
                ? Object.getOwnPropertyDescriptor(started, "controlCapability")
                : undefined;
            if (descriptor && "value" in descriptor)
              delivery =
                dependencies.captureResultDelivery?.(descriptor.value) ?? null;
          } catch {
            // 捕捉失敗は元TaskのEffectなしを意味しない。通常完了観測を維持する。
          }
          try {
            input.observeResultDelivery(delivery);
          } catch {
            // 上位通知失敗でも開始済みTaskの完了・取消・清掃を待つ。
          }
        }
        return started;
      },
    },
    {
      ...input,
      ...(input.executionTree !== undefined
        ? {
            workspaceTarget: {
              workspaceId: input.workspaceId ?? null,
              ownerRepositoryRoot: input.ownerRepositoryRoot ?? "",
              executionTree: input.executionTree,
              baseCommit: input.workspaceBaseCommit ?? null,
              head: input.workspaceHead ?? null,
            },
          }
        : {}),
    },
  );
  return Object.freeze({
    ...completed,
    contract: COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
    attemptId,
    authorityBindingId,
    repositoryRevision,
  });
}

/**
 * Coordinator Single Task Adapter 契約の公開契約を記述する。
 *
 * @responsibility Coordinator Single Task Adapter 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorSingleTaskAdapterContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorSingleTaskAdapterContractの入力契約を満たす。
 * @postcondition describeCoordinatorSingleTaskAdapterContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorSingleTaskAdapterContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorSingleTaskAdapterContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorSingleTaskAdapterContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security describeCoordinatorSingleTaskAdapterContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCoordinatorSingleTaskAdapterContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorSingleTaskAdapterContract() {
  return Object.freeze({
    contract: COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT,
    contractRevision: COORDINATOR_SINGLE_TASK_ADAPTER_CONTRACT_REVISION,
    taskRequestSchemaOwnership: "single_task_runtime",
    projectStateOwnership: "none",
    followUpTaskCreation: "none",
    acceptanceOwnership: "none",
    unknownSettlement: "fail_closed_manual_recovery",
    effectCancellationRepresentation:
      "pre_effect_and_confirmed_post_effect_cleanup_normalized_to_project_cancelled_other_effect_era_results_preserved",
  });
}

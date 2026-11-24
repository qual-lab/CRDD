/**
 * 現在状態・回復記録・実行履歴の読取り専用照会を所有する。
 *
 * @responsibility 確認済みの対象を既存State／履歴Readerへ接続し、同じ実行断面を共通の照会結果へ投影する。
 * @trace ARCH-000004
 * @trace ARCH-000005
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  type Execution,
  listExecutions,
} from "../../../execution-intelligence/src/index.ts";
import {
  ExecutionStorageBlockedError,
  isPrincipalId,
  type OperationRecord,
  parseDockerTaskRecoveryId,
  type ProjectExecutionState,
  readState,
} from "../../../execution-model/src/index.ts";
import {
  getRepository,
  readRepositorySnapshot,
  resolveVerifiedRepositoryRoot,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import {
  borrowCoordinatorRecoveryRepository,
  coordinatorDataBoundaryBlocked,
  getExecutionIntelligenceStore,
  recoveryStorageInput,
  RepositoryDataBlockedError,
  resolveExecutionStorageDirectory,
} from "./host.ts";
import {
  COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
  COORDINATOR_STATE_QUERY_CONTRACT,
  deriveCoordinatorRepositoryBindingId,
  inspectCoordinatorProjection,
  inspectCoordinatorStateQuery,
  inspectTaskStartCandidates,
  projectCoordinatorState,
  readExecutionCancellation,
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./validation.ts";
import type {
  ActivityRepository,
  ActivitySource,
  CoordinatorStateQuery,
  CoordinatorStateQueryResult,
  ExecutionActivityEvent,
  ExecutionActivityObservation,
  ExecutionActivityRequest,
} from "./types.ts";
import { workspacePlanReadyForAcceptance } from "./workspace.ts";

/**
 * 現在の回復記録を非秘密の保存観測へ投影する。
 * @responsibility 保存時点の状態だけを選び、実資源の現在性を推測しない。
 * @trace ARCH-000008
 * @input 既存Readerが検査した操作記録。
 * @returns Path・Identity本文を含まない保存観測。
 * @effect 外部Effectなし。
 * @security 資源ID、Mount、環境値、内部Hashを公開しない。
 */
function projectRecoveryRecord(
  operation: OperationRecord,
  operations: readonly OperationRecord[],
) {
  if (operation.kind === "host_operation")
    return Object.freeze({
      kind: operation.kind,
      phase: operation.phase,
      hostCleanup: operation.cleanup,
      outcome: null,
      historyConfirmed: null,
      resources:
        operation.resources === null
          ? null
          : Object.freeze(
              operation.resources.checkpoints.map((item) =>
                Object.freeze({
                  key: item.key,
                  submission: item.submission,
                  observation: item.observation,
                }),
              ),
            ),
    });
  const common = {
    phase: operation.phase,
    outcome:
      operation.outcome === null
        ? null
        : Object.freeze({
            status: operation.outcome.status,
            cleanupConfirmed: operation.outcome.cleanupConfirmed,
          }),
    historyConfirmed: operation.history?.confirmed ?? null,
  };
  if (operation.kind === "docker_repair")
    return Object.freeze({
      ...common,
      kind: operation.kind,
      disposition: operation.disposition,
      resources: null,
    });
  return Object.freeze({
    ...common,
    kind: operation.kind,
    lease: operation.lease,
    hostCleanup:
      operations.find(
        (r): r is Extract<OperationRecord, { kind: "host_operation" }> =>
          r.kind === "host_operation" &&
          r.operationId === JSON.parse(operation.identityJson).operationId,
      )?.cleanup ?? "unknown",
    resources:
      operation.resources === null
        ? null
        : Object.freeze(
            operation.resources.checkpoints.map((item) =>
              Object.freeze({
                key: item.key,
                submission: item.submission,
                observation: item.observation,
              }),
            ),
          ),
  });
}

/**
 * 元の回復参照に一致する現在の保存記録だけを照会する。
 * @responsibility 不一致、観測不能、保存時点の観測を分離する。
 * @trace ARCH-000008
 * @input exact回復ID、現在RepositoryのCapability、取消Signal。
 * @returns recorded／not_recorded／unknown。Docker資源の現在状態は観測しない。
 * @precondition 信頼した入口が現在Repositoryの読取りを許可している。
 * @postcondition 照会から回復・再起動・初期化・清掃を発行しない。
 * @effect 既存Readerの短期Lockと、Probeの元記録の読取りだけ。
 * @failure 不正ID、破損、途中保存、解放不明、取消は固定理由で停止する。
 * @invariant not_recordedを資源不存在又は再実行許可へ読み替えない。
 * @boundary 保存正本と公開照会。
 * @security 記録全体、Path、資格情報、生例外を返さない。
 * @concurrency 同じReader断面で相関し、Lock解放確認後だけ記録を公開する。
 */
export function readRecordedRecovery(
  recoveryId: string,
  rootCapability: unknown,
  signal: AbortSignal,
  confirmedDirectory?: string,
) {
  const result = (
    observationState: "recorded" | "not_recorded" | "unknown",
    reason: string,
    lockReleased: boolean,
    record: ReturnType<typeof projectRecoveryRecord> | null = null,
  ) =>
    Object.freeze({
      contract: "crdd-coordinator/recovery-observation/v1" as const,
      status:
        observationState === "unknown"
          ? ("blocked" as const)
          : ("completed" as const),
      reason,
      recoveryId,
      observationState,
      record,
      dockerResourcesObserved: false as const,
      lockReleased,
    });
  const cancellation = readExecutionCancellation(signal);
  if (cancellation !== false)
    return result(
      "unknown",
      cancellation === true
        ? "coordinator_recovery_observation_cancelled"
        : "coordinator_recovery_signal_invalid",
      true,
    );
  try {
    if (recoveryId.startsWith("docker-task.")) {
      if (!parseDockerTaskRecoveryId(recoveryId)) throw Error();
    } else if (recoveryId.startsWith("docker-repair.")) {
      if (!/^docker-repair\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(recoveryId))
        throw Error();
    } else if (recoveryId.startsWith("host-operation.")) {
      if (!/^host-operation\.OP-[0-9]{6,}$/u.test(recoveryId)) throw Error();
    } else throw Error();
  } catch {
    return result("unknown", "coordinator_recovery_id_invalid", true);
  }
  let lockReleased = false;
  try {
    const repository = borrowCoordinatorRecoveryRepository(
      rootCapability,
      confirmedDirectory,
    );
    const observed = readState(recoveryStorageInput(repository), {
      scope: "recovery",
    });
    lockReleased = observed.lockReleased;
    if (readExecutionCancellation(signal) !== false)
      return result(
        "unknown",
        "coordinator_recovery_observation_cancelled",
        lockReleased,
      );
    if (
      observed.status !== "completed" ||
      !lockReleased ||
      observed.value === null
    )
      return result(
        "unknown",
        "coordinator_recovery_observation_unknown",
        lockReleased,
      );
    const matches = observed.value.snapshot.operations.filter(
      (operation) => operation.recoveryId === recoveryId,
    );
    if (matches.length === 0)
      return result("not_recorded", "coordinator_recovery_not_recorded", true);
    if (matches.length !== 1 || !matches[0])
      return result(
        "unknown",
        "coordinator_recovery_observation_unknown",
        true,
      );
    const operation = matches[0];
    if (readExecutionCancellation(signal) !== false)
      return result(
        "unknown",
        "coordinator_recovery_observation_cancelled",
        true,
      );
    return result(
      "recorded",
      "coordinator_recovery_recorded",
      true,
      projectRecoveryRecord(operation, observed.value.snapshot.operations),
    );
  } catch {
    return result(
      "unknown",
      "coordinator_recovery_observation_unknown",
      lockReleased,
    );
  }
}

/**
 * 取得済みの実行データから指定Projectの状態を表示する。
 * @responsibility 同じ保存断面のProjectと開始候補を選び、照会結果を構築する。
 * @trace ARCH-000005
 * @input current: 読取り成功済みの保存断面、request: CoordinatorStateQuery。
 * @returns observed、absent又はunknownの照会結果。
 * @failure 候補欠測・複数一致・投影不能又は改訂不一致はunknown。
 * @effect N/A: 読取り・保存・権限発行を行わない。
 */
export function queryCoordinatorState(
  current: Readonly<{
    projects: readonly ProjectExecutionState[];
    taskStartCandidates: unknown;
  }>,
  request: CoordinatorStateQuery,
): CoordinatorStateQueryResult {
  const state =
    current.projects.find((item) => item.projectId === request.projectId) ??
    null;
  let projection: CoordinatorStateQueryResult["projection"] = null;
  if (state !== null) {
    try {
      const records = snapshotPlainArray(
        current.taskStartCandidates,
        Number.MAX_SAFE_INTEGER,
      );
      const matches =
        records.status === "ok"
          ? records.value
              .map((item) => inspectTaskStartCandidates(state, item))
              .filter((item) => item !== null)
          : [];
      if (matches.length === 1)
        projection = projectCoordinatorState(state, matches[0] ?? null);
    } catch {
      // 不正・欠測の候補を空の開始候補へ補完しない。
    }
  }
  const reason =
    state === null
      ? "coordinator_state_absent"
      : projection === null
        ? "coordinator_state_observation_unknown"
        : state.repositoryRevision !== request.repositoryRevision
          ? "coordinator_state_revision_mismatch"
          : "coordinator_state_observed";
  const observationState =
    reason === "coordinator_state_absent"
      ? "absent"
      : reason === "coordinator_state_observed"
        ? "observed"
        : "unknown";
  return Object.freeze({
    contract: COORDINATOR_STATE_QUERY_CONTRACT,
    status: observationState === "unknown" ? "blocked" : "completed",
    reason,
    requestId: request.requestId,
    projectId: request.projectId,
    repositoryRevision: request.repositoryRevision,
    observationState,
    projection: observationState === "observed" ? projection : null,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    effectState: "no_effect",
  });
}

/**
 * 認証済みの利用側へ同じ保存断面の状態を返す。
 *
 * @responsibility Coordinator Public 状態 Queryの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000004
 * @input rawRequest: unknown、workingDirectory、authenticationContext: 入口が認証・認可したPrincipal。
 * @returns queryStateの公開照会結果。
 * @precondition 入口が現在の認証・認可を確認する。Decision Storeの所在や可用性を本人確認へ使わない。
 * @postcondition 確認済みの対象について観測結果だけを返す。
 * @effect Repositoryと保存済みSnapshotを観測する。Task実行や状態変更は行わない。
 * @failure 既知の保存境界例外は元の確認・回復情報を保持して結果へ返し、他の例外は伝播する。
 * @invariant 読取りのみを行い、欠測・観測不能を正常な状態へ補完しない。
 * @boundary 公開照会入力→Repository・認証済み主体・保存済み状態の読取り境界を接続する。
 * @security 認証済み主体とRepository相関を確認し、認可した照会結果だけを返す。
 * @concurrency 返却される読取り処理の完了・失敗を呼出し側へ搬送する。
 */
export function queryState(
  rawRequest: unknown,
  workingDirectory = process.cwd(),
  authenticationContext?: Readonly<{ principalId: string }>,
) {
  try {
    const request = inspectCoordinatorStateQuery(rawRequest);
    if (!request)
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_state_query_invalid",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    if (
      authenticationContext === undefined ||
      !isPrincipalId(authenticationContext.principalId)
    )
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_authenticated_principal_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    let repositoryRoot: string;
    try {
      repositoryRoot =
        resolveVerifiedRepositoryRootFromWorkingDirectory(workingDirectory);
    } catch {
      return Object.freeze({
        contract: COORDINATOR_PUBLIC_RUNTIME_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_repository_root_not_verified",
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    }
    const identity = readRepositorySnapshot(
      getRepository(repositoryRoot).capability,
    );
    const adoptedPlan =
      identity && identity.revisionIdentity !== request.repositoryRevision
        ? readState(
            resolveExecutionStorageDirectory(repositoryRoot),
            deriveCoordinatorRepositoryBindingId(repositoryRoot),
            "execution",
          ).value?.projects.find(
            (plan) =>
              plan.projectId === request.projectId &&
              plan.repositoryRevision === request.repositoryRevision,
          )
        : null;
    if (
      !identity ||
      (identity.revisionIdentity !== request.repositoryRevision &&
        (!adoptedPlan ||
          !workspacePlanReadyForAcceptance(
            repositoryRoot,
            deriveCoordinatorRepositoryBindingId(repositoryRoot),
            request.projectId,
            adoptedPlan.milestoneId,
            request.repositoryRevision,
            identity.revisionIdentity,
          )))
    )
      return Object.freeze({
        contract: COORDINATOR_STATE_QUERY_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_state_revision_mismatch",
        requestId: request.requestId,
        projectId: request.projectId,
        repositoryRevision: request.repositoryRevision,
        observationState: "unknown" as const,
        projection: null,
        cleanupConfirmed: true as const,
        manualRecoveryRequired: false,
        effectState: "no_effect" as const,
      });
    const snapshot = readState(
      resolveExecutionStorageDirectory(repositoryRoot),
      deriveCoordinatorRepositoryBindingId(repositoryRoot),
      "execution",
    );
    if (
      snapshot.status !== "completed" ||
      snapshot.value === null ||
      snapshot.value.schemaRevision !== 9
    )
      return Object.freeze({
        contract: COORDINATOR_STATE_QUERY_CONTRACT,
        status: "blocked" as const,
        reason: "coordinator_snapshot_not_initialized",
        requestId: request.requestId,
        projectId: request.projectId,
        repositoryRevision: request.repositoryRevision,
        observationState: "unknown" as const,
        projection: null,
        cleanupConfirmed: true as const,
        manualRecoveryRequired:
          snapshot.status === "blocked" && snapshot.manualRecoveryRequired,
        effectState: "no_effect" as const,
      });
    return queryCoordinatorState(snapshot.value, request);
  } catch (error) {
    if (
      error instanceof ExecutionStorageBlockedError ||
      error instanceof RepositoryDataBlockedError
    )
      return coordinatorDataBoundaryBlocked(error);
    throw error;
  }
}

/**
 * 今回要求をI/O前に固定する。
 * @responsibility 未知fieldと不正対象を拒否しRoot能力を複製しない。
 * @trace ARCH-000004
 * @input 未信頼の要求。
 * @returns 検査済み要求。
 * @precondition 呼出側が今回要求の内容認可を済ませた同ProcessのConsumerである。
 * @postcondition 観測不能を成功へ変換せず、確認した出所だけを保持する。
 * @effect N/A: 値検査だけ。
 * @failure 不正・重複ID・異Project・空集合は固定例外。
 * @invariant 初期化・Task実行・回復・認可発行を行わない。
 * @boundary 実保存Ownerと活動読取りConsumer。
 * @security 資格、内部Pathと保存Bindingを公開しない。
 * @concurrency 一要求の観測だけを返し、共有Cacheや固定Snapshotを作らない。
 */
function inspectActivityRequest(
  input: ExecutionActivityRequest,
): ExecutionActivityRequest {
  if (!input || typeof input !== "object" || types.isProxy(input))
    throw new Error("runtime_activity_input_invalid");
  const record = snapshotPlainRecord(
    input,
    new Set(
      Object.hasOwn(input, "cursor")
        ? ["projectId", "repositories", "limit", "cursor"]
        : ["projectId", "repositories", "limit"],
    ),
  );
  const entries = snapshotPlainArray(record?.repositories, 10000);
  if (
    !record ||
    typeof record.projectId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(record.projectId) ||
    !Number.isInteger(record.limit) ||
    Number(record.limit) < 1 ||
    Number(record.limit) > 50 ||
    entries.status !== "ok" ||
    entries.value.length === 0 ||
    (Object.hasOwn(record, "cursor") &&
      (typeof record.cursor !== "string" ||
        !/^[A-Za-z0-9_-]{1,1024}$/u.test(record.cursor)))
  )
    throw new Error("runtime_activity_input_invalid");
  const repositories: ActivityRepository[] = [];
  const ids = new Set<string>();
  for (const raw of entries.value) {
    const entry = snapshotPlainRecord(
      raw,
      new Set(["projectId", "repositoryId", "root"]),
    );
    if (
      !entry ||
      entry.projectId !== record.projectId ||
      typeof entry.repositoryId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(entry.repositoryId) ||
      ids.has(entry.repositoryId) ||
      !entry.root ||
      typeof entry.root !== "object" ||
      types.isProxy(entry.root)
    )
      throw new Error("runtime_activity_input_invalid");
    ids.add(entry.repositoryId);
    repositories.push(
      Object.freeze({
        projectId: record.projectId,
        repositoryId: entry.repositoryId,
        root: entry.root as ActivityRepository["root"],
      }),
    );
  }
  repositories.sort((a, b) =>
    a.repositoryId < b.repositoryId
      ? -1
      : a.repositoryId > b.repositoryId
        ? 1
        : 0,
  );
  return Object.freeze({
    projectId: record.projectId,
    repositories: Object.freeze(repositories),
    limit: Number(record.limit),
    ...(typeof record.cursor === "string" ? { cursor: record.cursor } : {}),
  });
}

/**
 * 実Eventを非秘密の活動要約へ投影する。
 * @responsibility 既存Workbench投影を活動Ownerへ移す。
 * @trace ARCH-000004
 * @input 検査済みEventと認可済みRepository ID。
 * @returns 固定Event要約。
 * @precondition 呼出側が今回要求の内容認可を済ませた同ProcessのConsumerである。
 * @postcondition 観測不能を成功へ変換せず、確認した出所だけを保持する。
 * @effect N/A: メモリ投影だけ。
 * @failure N/A: 固定Propertyの選択だけ。
 * @invariant 初期化・Task実行・回復・認可発行を行わない。
 * @boundary 実保存Ownerと活動読取りConsumer。
 * @security 資格、内部Pathと保存Bindingを公開しない。
 * @concurrency 一要求の観測だけを返し、共有Cacheや固定Snapshotを作らない。
 */
function projectActivityEvent(
  event: Execution,
  repositoryId: string,
): ExecutionActivityEvent {
  const metadata = event.metadata;
  if (
    !metadata ||
    ["objectiveId", "taskId", "attemptId"].some(
      (k) =>
        typeof metadata[k] !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(metadata[k] as string),
    )
  )
    throw Error("activity_execution_context_invalid");
  const completion = event.completion;
  if (
    completion &&
    (typeof completion.diagnostic?.cleanupConfirmed !== "boolean" ||
      typeof completion.diagnostic?.manualRecoveryRequired !== "boolean")
  )
    throw Error("activity_execution_observation_invalid");
  const taskStatus = completion?.diagnostic?.taskStatus;
  const taskReason = completion?.diagnostic?.taskReason;
  if (
    completion &&
    (typeof taskStatus !== "string" ||
      !["completed", "blocked", "cancelled", "unknown"].includes(taskStatus) ||
      typeof taskReason !== "string" ||
      taskReason.length === 0)
  )
    throw Error("activity_task_settlement_not_observed");
  return Object.freeze({
    repositoryId,
    eventId: `execution-${createHash("sha256").update(event.executionId).digest("hex")}`,
    occurredAt: completion?.endedAt ?? event.startedAt,
    objectiveId: metadata.objectiveId as string,
    taskId: metadata.taskId as string,
    attemptId: metadata.attemptId as string,
    status:
      (taskStatus as
        | "completed"
        | "blocked"
        | "cancelled"
        | "unknown"
        | undefined) ?? "unknown",
    reason:
      typeof taskReason === "string"
        ? taskReason
        : "execution_completion_not_observed",
    cleanupConfirmed: completion?.diagnostic?.cleanupConfirmed === true,
    manualRecoveryRequired:
      completion?.diagnostic?.manualRecoveryRequired === true,
  });
}

/**
 * 認可済みRepositoryの活動を実保存から読む。
 * @responsibility 同一Snapshotの状態と既存EI履歴を読み全対象の結果を合成する。
 * @trace ARCH-000004
 * @input 内容認可済み短命要求と任意の取消Signal。
 * @returns 閉じた活動観測。
 * @precondition 呼出側が今回要求の内容認可を済ませた同ProcessのConsumerである。
 * @postcondition 観測不能を成功へ変換せず、確認した出所だけを保持する。
 * @effect Root・Git・状態・履歴の読取りと既存状態Readerの短期排他。保存・初期化なし。
 * @failure 開始前取消・入力・Cursor不正は例外。観測不能・競合は独立したunknown。
 * @invariant 初期化・Task実行・回復・認可発行を行わない。
 * @boundary 実保存Ownerと活動読取りConsumer。
 * @security 資格、内部Pathと保存Bindingを公開しない。
 * @concurrency 一要求の観測だけを返し、共有Cacheや固定Snapshotを作らない。
 */
export async function queryActivity(
  input: ExecutionActivityRequest,
  signal?: AbortSignal,
): Promise<ExecutionActivityObservation> {
  if (signal?.aborted) throw new Error("runtime_activity_cancelled");
  const request = inspectActivityRequest(input);
  const targets = request.repositories.map((repository) => ({
    repository,
    root: resolveVerifiedRepositoryRoot(repository.root),
  }));
  if (request.cursor !== undefined && targets.some(({ root }) => root === null))
    throw new Error("runtime_activity_cursor_invalid");
  const sourceHash = deriveActivitySourceCorrelation(
    request.projectId,
    request.repositories,
  );
  const cursor = decodeActivityCursor(request.cursor, sourceHash);
  const sources: ActivitySource[] = [];
  let stateUnknown = false,
    eventUnknown = false;
  const observed: {
    repositoryId: string;
    projection: NonNullable<ExecutionActivityObservation["projection"]>;
  }[] = [];
  const events: ExecutionActivityEvent[] = [];
  const singleTasks: NonNullable<
    ExecutionActivityObservation["singleTasks"]
  >[number][] = [];
  for (const { repository, root } of targets) {
    const source = {
      repositoryId: repository.repositoryId,
      revision: null as string | null,
    };
    sources.push(source);
    if (root === null) {
      stateUnknown = true;
      eventUnknown = true;
      continue;
    }
    const snapshot = readState(
      { directory: root },
      deriveCoordinatorRepositoryBindingId(root),
      "execution",
    );
    if (snapshot.status !== "completed") stateUnknown = true;
    else if (snapshot.value !== null) {
      const value = snapshot.value;
      const project = value.projects.find(
        (entry) => entry.projectId === request.projectId,
      );
      for (const queue of value.queueEntries) {
        const record = queue.singleTask;
        if (queue.projectId === request.projectId && record)
          singleTasks.push({
            repositoryId: repository.repositoryId,
            requestId: queue.queueId,
            mode: record.mode,
            phase: record.phase,
            status: record.status,
            cleanupConfirmed: record.cleanupConfirmed,
            recoveryRequired: queue.state === "recovery_required",
          });
      }
      if (project) {
        source.revision = project.repositoryRevision;
        const result = queryCoordinatorState(value, {
          requestId: "runtime-activity-observation",
          projectId: request.projectId,
          repositoryRevision: project.repositoryRevision,
        });
        if (result.observationState === "unknown") stateUnknown = true;
        else if (result.projection !== null)
          observed.push({
            repositoryId: repository.repositoryId,
            projection: result.projection,
          });
      }
    }
    try {
      const store = getExecutionIntelligenceStore(repository.root, false);
      if (store) {
        const history = listExecutions(store, {
          application: "CRDD",
          operation: "task_attempt",
          metadata: { projectId: request.projectId },
          limit: 10_000,
        });
        if (history.status !== "completed") eventUnknown = true;
        else
          for (const event of history.value.executions)
            events.push(projectActivityEvent(event, repository.repositoryId));
      }
    } catch {
      eventUnknown = true;
    }
  }
  if (new Set(events.map((event) => event.eventId)).size !== events.length)
    eventUnknown = true;
  const sorted = events.sort(compareActivityEventPositions);
  const after =
    cursor === null
      ? sorted
      : sorted.filter(
          (event) =>
            compareActivityEventPositions(event, {
              occurredAt: cursor[0],
              eventId: cursor[1],
            }) > 0,
        );
  const page = eventUnknown ? [] : after.slice(0, request.limit);
  const last = page.at(-1);
  const state =
    stateUnknown || observed.length > 1
      ? "unknown"
      : observed.length === 1
        ? "observed"
        : "absent";
  const result = parseExecutionActivityObservation({
    projectId: request.projectId,
    singleTasks: stateUnknown ? [] : singleTasks,
    state,
    reason:
      state === "unknown"
        ? "runtime_activity_state_unknown"
        : state === "observed"
          ? "runtime_activity_state_observed"
          : "runtime_activity_state_absent",
    projection: state === "observed" ? (observed[0]?.projection ?? null) : null,
    currentSourceRepositoryId:
      state === "observed" ? (observed[0]?.repositoryId ?? null) : null,
    sources,
    eventState: eventUnknown ? "unknown" : "observed",
    eventReason: eventUnknown
      ? "runtime_activity_events_unknown"
      : "runtime_activity_events_observed",
    events: page,
    eventContinuation:
      !eventUnknown && after.length > page.length && last
        ? encodeActivityCursor(last, sourceHash)
        : null,
  });
  if (result === null) throw new Error("runtime_activity_result_invalid");
  return result;
}

/**
 * Projectと正規Sourceの相関Hashを導出する。
 * @responsibility 同じ認可済み対象集合のIDを一つに結合する。
 * @trace ARCH-000004
 * @input Project IDとRepository ID昇順のSource。
 * @returns 64桁のSHA-256相関値。
 * @precondition 同じ要求の検査済みProjectと正規Source集合を使う。
 * @postcondition 出所・ページ境界を推測せず結合する。
 * @effect N/A: 同期値計算だけ。
 * @failure 不正入力は呼出側の境界検査で拒否する。
 * @invariant Cursorを認可や保存Snapshotにしない。
 * @boundary 活動Readerと結果Validatorの内部共用。
 * @security Root・Path・資格を符号化しない。
 * @concurrency N/A: 局所値だけ。
 */
export function deriveActivitySourceCorrelation(
  projectId: string,
  sources: readonly Pick<ActivitySource, "repositoryId">[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        projectId,
        sources.map(({ repositoryId }) => repositoryId),
      ]),
    )
    .digest("hex");
}

/**
 * 継続位置とSource相関を検査する。
 * @responsibility Source相関を認可へ変換せず不正・変更を明示拒否する。
 * @trace ARCH-000004
 * @input Cursor候補と今回の相関Hash。
 * @returns 時刻とEvent ID、または未指定のnull。
 * @precondition 呼出側が今回要求の内容認可を済ませた同ProcessのConsumerである。
 * @postcondition 観測不能を成功へ変換せず、確認した出所だけを保持する。
 * @effect N/A: 値解析だけ。
 * @failure 不正Cursor・Source不一致は固定例外。
 * @invariant 初期化・Task実行・回復・認可発行を行わない。
 * @boundary 実保存Ownerと活動読取りConsumer。
 * @security 資格、内部Pathと保存Bindingを公開しない。
 * @concurrency 一要求の観測だけを返し、共有Cacheや固定Snapshotを作らない。
 */
export function decodeActivityCursor(
  cursor: string | undefined,
  sourceHash: string,
): readonly [string, string] | null {
  if (cursor === undefined) return null;
  if (typeof cursor !== "string" || !/^[A-Za-z0-9_-]{1,1024}$/u.test(cursor))
    throw new Error("runtime_activity_cursor_invalid");
  let raw: unknown;
  try {
    raw = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("runtime_activity_cursor_invalid");
  }
  const parsed = snapshotPlainArray(raw, 3);
  if (
    parsed.status !== "ok" ||
    parsed.value.length !== 3 ||
    typeof parsed.value[0] !== "string" ||
    parsed.value[0].length === 0 ||
    parsed.value[0].length > 64 ||
    !Number.isFinite(Date.parse(parsed.value[0])) ||
    typeof parsed.value[1] !== "string" ||
    !/^execution-[0-9a-f]{64}$/u.test(parsed.value[1]) ||
    parsed.value[2] !== sourceHash
  )
    throw new Error("runtime_activity_cursor_invalid");
  return Object.freeze([parsed.value[0], parsed.value[1]]);
}

/**
 * 返却Page末尾を継続位置へ符号化する。
 * @responsibility 公開済み時刻・IDとSource相関を同じCursorへ閉じる。
 * @trace ARCH-000004
 * @input Page末尾Eventと同要求のSource Hash。
 * @returns URL安全な3要素Cursor。
 * @precondition 同じ要求の検査済みProjectと正規Source集合を使う。
 * @postcondition 出所・ページ境界を推測せず結合する。
 * @effect N/A: 同期値計算だけ。
 * @failure 不正入力は呼出側の境界検査で拒否する。
 * @invariant Cursorを認可や保存Snapshotにしない。
 * @boundary 活動Readerと結果Validatorの内部共用。
 * @security Root・Path・資格を符号化しない。
 * @concurrency N/A: 局所値だけ。
 */
export function encodeActivityCursor(
  event: Pick<ExecutionActivityEvent, "occurredAt" | "eventId">,
  sourceHash: string,
): string {
  return Buffer.from(
    JSON.stringify([event.occurredAt, event.eventId, sourceHash]),
    "utf8",
  ).toString("base64url");
}

/**
 * 活動位置を実時刻とEvent IDの降順で比較する。
 * @responsibility 表示順・ページ境界・Validatorへ同じ比較規則を提供する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @input 検査済みの日時文字列とEvent IDを持つ二位置。
 * @returns leftが先なら負、同instant・同IDなら0、後なら正。
 * @precondition 両日時はDate.parse可能で、Event IDは既存形式である。
 * @postcondition 同instantの場合だけIDを第2キーにする。
 * @effect N/A: 同期値計算だけ。
 * @failure N/A: 検査済みprimitiveを比較する。
 * @invariant 元日時の文字列とEI保存値を変更しない。
 * @boundary 活動Reader・Cursor・Validatorの内部共用。
 * @security Path・資格・Authorityを扱わない。
 * @concurrency N/A: 局所値だけ。
 */
export function compareActivityEventPositions(
  left: Pick<ExecutionActivityEvent, "occurredAt" | "eventId">,
  right: Pick<ExecutionActivityEvent, "occurredAt" | "eventId">,
): number {
  const time = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  return (
    time ||
    (left.eventId < right.eventId ? 1 : left.eventId > right.eventId ? -1 : 0)
  );
}

/**
 * 活動観測を所有済みの固定結果へ変換する。
 *
 * @responsibility Reader由来の参照を公開せず、許可した値だけを取得して固定する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @input value: 未信頼の活動観測。
 * @returns 所有済みの固定観測、契約不正ならnull。
 * @precondition 入力の型・Property取得・列挙を信頼しない。
 * @postcondition 入力の後続変更は返却結果へ影響しない。
 * @effect N/A: Proxyとaccessorを実行せず値を取得する。
 * @failure 不正Property、状態相関、列挙語彙または観測型はnull。
 * @invariant unknownを空成功へ変更しない。
 * @boundary Reader出力とHTTP／MCP公開結果の境界。
 * @security 余剰Property、Proxy、accessorと暗黙文字列化を拒否する。
 * @concurrency 同期取得した所有Snapshotだけを公開する。
 */
export function parseExecutionActivityObservation(
  value: unknown,
): ExecutionActivityObservation | null {
  const keys = new Set([
    "projectId",
    "state",
    "reason",
    "projection",
    "eventState",
    "eventReason",
    "events",
    "eventContinuation",
    "sources",
    "currentSourceRepositoryId",
  ]);
  const record =
    snapshotPlainRecord(value, keys) ??
    snapshotPlainRecord(
      value,
      new Set([
        "projectId",
        "state",
        "reason",
        "projection",
        "eventState",
        "eventReason",
        "events",
        "eventContinuation",
        "sources",
        "currentSourceRepositoryId",
        "singleTasks",
      ]),
    );
  if (!record) return null;
  if (
    typeof record.projectId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(record.projectId) ||
    typeof record.state !== "string" ||
    !["observed", "absent", "unknown"].includes(record.state) ||
    typeof record.reason !== "string" ||
    record.reason !== `runtime_activity_state_${record.state}` ||
    typeof record.eventState !== "string" ||
    !["observed", "unknown"].includes(record.eventState) ||
    typeof record.eventReason !== "string" ||
    record.eventReason !== `runtime_activity_events_${record.eventState}` ||
    (record.eventContinuation !== null &&
      typeof record.eventContinuation !== "string")
  )
    return null;
  if (record.projection !== null) {
    if (
      typeof record.projection !== "object" ||
      types.isProxy(record.projection)
    )
      return null;
    for (const key of [
      "milestoneState",
      "workProgress",
      "qualityState",
      "nextAction",
    ]) {
      const descriptor = Object.getOwnPropertyDescriptor(
        record.projection,
        key,
      );
      if (
        !descriptor ||
        !Object.hasOwn(descriptor, "value") ||
        typeof descriptor.value !== "string"
      )
        return null;
    }
  }
  const sources = parseActivitySources(record.sources);
  if (sources === null) return null;
  const sourceIds = new Set(sources.map((source) => source.repositoryId));
  const singleTasks: NonNullable<
    ExecutionActivityObservation["singleTasks"]
  >[number][] = [];
  if (Object.hasOwn(record, "singleTasks")) {
    const items = snapshotPlainArray(
      record.singleTasks,
      Number.MAX_SAFE_INTEGER,
    );
    if (items.status !== "ok") return null;
    for (const item of items.value) {
      const task = snapshotPlainRecord(
        item,
        new Set([
          "repositoryId",
          "requestId",
          "mode",
          "phase",
          "status",
          "cleanupConfirmed",
          "recoveryRequired",
        ]),
      );
      if (
        !task ||
        typeof task.repositoryId !== "string" ||
        !sourceIds.has(task.repositoryId) ||
        typeof task.requestId !== "string" ||
        !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(task.requestId) ||
        typeof task.mode !== "string" ||
        !["read_only_advice", "workspace_edit"].includes(task.mode) ||
        typeof task.phase !== "string" ||
        !["accepted", "starting", "running", "settled"].includes(task.phase) ||
        typeof task.status !== "string" ||
        !["pending", "completed", "blocked", "cancelled", "unknown"].includes(
          task.status,
        ) ||
        typeof task.cleanupConfirmed !== "boolean" ||
        typeof task.recoveryRequired !== "boolean" ||
        singleTasks.some(
          (previous) =>
            previous.repositoryId === task.repositoryId &&
            previous.requestId === task.requestId,
        )
      )
        return null;
      singleTasks.push(
        Object.freeze(task) as NonNullable<
          ExecutionActivityObservation["singleTasks"]
        >[number],
      );
    }
  }
  if (
    record.currentSourceRepositoryId !== null &&
    (typeof record.currentSourceRepositoryId !== "string" ||
      !sourceIds.has(record.currentSourceRepositoryId))
  )
    return null;
  const projection = inspectCoordinatorProjection(record.projection);
  if (
    record.state === "observed"
      ? projection === null || projection.projectId !== record.projectId
      : record.projection !== null
  )
    return null;
  if (
    (record.state === "observed"
      ? record.currentSourceRepositoryId === null ||
        sources.find(
          (source) => source.repositoryId === record.currentSourceRepositoryId,
        )?.revision === null
      : record.currentSourceRepositoryId !== null) ||
    (record.eventContinuation !== null &&
      (typeof record.eventContinuation !== "string" ||
        !/^[A-Za-z0-9_-]{1,1024}$/u.test(record.eventContinuation))) ||
    (record.eventState === "unknown" && record.eventContinuation !== null)
  )
    return null;
  const rawEvents = snapshotPlainArray(record.events, Number.MAX_SAFE_INTEGER);
  if (rawEvents.status !== "ok") return null;
  if (record.eventState === "unknown" && rawEvents.value.length !== 0)
    return null;
  const events: ExecutionActivityEvent[] = [];
  for (const raw of rawEvents.value) {
    const event = parseExecutionEvent(raw);
    if (
      event === null ||
      !sourceIds.has(event.repositoryId) ||
      events.some((previous) => previous.eventId === event.eventId)
    )
      return null;
    const previous = events.at(-1);
    if (previous && compareActivityEventPositions(previous, event) > 0)
      return null;
    events.push(event);
  }
  if (record.eventContinuation !== null) {
    const last = events.at(-1);
    if (last === undefined) return null;
    try {
      const correlation = deriveActivitySourceCorrelation(
        record.projectId,
        sources,
      );
      const decoded = decodeActivityCursor(
        record.eventContinuation,
        correlation,
      );
      if (
        decoded === null ||
        decoded[0] !== last.occurredAt ||
        decoded[1] !== last.eventId ||
        record.eventContinuation !== encodeActivityCursor(last, correlation)
      )
        return null;
    } catch {
      return null;
    }
  }
  return Object.freeze({
    projectId: record.projectId,
    singleTasks: Object.freeze(singleTasks),
    state: record.state as ExecutionActivityObservation["state"],
    reason: record.reason,
    projection,
    sources,
    currentSourceRepositoryId: record.currentSourceRepositoryId as
      | string
      | null,
    eventState: record.eventState as ExecutionActivityObservation["eventState"],
    eventReason: record.eventReason,
    events: Object.freeze(events),
    eventContinuation: record.eventContinuation,
  });
}

/**
 * Runtime Event要約を所有済みの固定値へ変換する。
 *
 * @responsibility Event要約のProperty、Identity、時刻、状態および真偽値を閉じたSchemaで検査する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @input valueにEvent要約候補を受け取る。
 * @returns 適合する場合は所有済みの固定Event要約、不正ならnull。
 * @precondition valueを信頼済みObjectと仮定しない。
 * @postcondition 余剰Propertyのない安全なEvent要約だけを受理する。
 * @effect N/A: 値を観測するだけである。
 * @failure 不正値はnullで拒否する。
 * @invariant Event時刻と結果を補正しない。
 * @boundary Remote JSONとCoordinator Event投影の境界。
 * @security 任意Objectまたは生Provider情報を透過しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function parseExecutionEvent(value: unknown): ExecutionActivityEvent | null {
  const record = snapshotPlainRecord(
    value,
    new Set([
      "repositoryId",
      "eventId",
      "occurredAt",
      "objectiveId",
      "taskId",
      "attemptId",
      "status",
      "reason",
      "cleanupConfirmed",
      "manualRecoveryRequired",
    ]),
  );
  if (!record) return null;
  const valid =
    typeof record.repositoryId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(record.repositoryId) &&
    typeof record.eventId === "string" &&
    /^execution-[0-9a-f]{64}$/u.test(record.eventId) &&
    typeof record.occurredAt === "string" &&
    record.occurredAt.length > 0 &&
    record.occurredAt.length <= 64 &&
    Number.isFinite(Date.parse(record.occurredAt)) &&
    ["objectiveId", "taskId", "attemptId"].every(
      (key) =>
        typeof record[key] === "string" &&
        /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(record[key] as string),
    ) &&
    typeof record.status === "string" &&
    ["completed", "blocked", "cancelled", "unknown"].includes(record.status) &&
    typeof record.reason === "string" &&
    record.reason.length > 0 &&
    record.reason.length <= 512 &&
    typeof record.cleanupConfirmed === "boolean" &&
    typeof record.manualRecoveryRequired === "boolean";
  return valid
    ? (Object.freeze({ ...record }) as ExecutionActivityEvent)
    : null;
}

/**
 * 観測出所を正規の所有配列へ固定する。
 * @responsibility 一意なRepository ID順とGit改訂の既知・不明を検査する。
 * @trace ARCH-000004
 * @input 未信頼のSource配列。
 * @returns 検査済みSource配列またはnull。
 * @precondition N/A: 任意値を検査する。
 * @postcondition 入力の後続変更が返却値へ影響しない。
 * @effect N/A: 同期値検査のみ。
 * @failure 重複・順序差・余分Property・不正改訂はnull。
 * @invariant null改訂を既知値へ補完しない。
 * @boundary Reader出力と公開観測。
 * @security Root・Path・資格を受理しない。
 * @concurrency N/A: 局所値のみ。
 */
function parseActivitySources(
  value: unknown,
): readonly ActivitySource[] | null {
  const raw = snapshotPlainArray(value, Number.MAX_SAFE_INTEGER);
  if (raw.status !== "ok" || raw.value.length === 0) return null;
  const sources: ActivitySource[] = [];
  for (const entry of raw.value) {
    const previous = sources.at(-1);
    const source = snapshotPlainRecord(
      entry,
      new Set(["repositoryId", "revision"]),
    );
    if (
      !source ||
      typeof source.repositoryId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(source.repositoryId) ||
      (source.revision !== null &&
        (typeof source.revision !== "string" ||
          !/^[0-9a-f]{40,64}$/u.test(source.revision))) ||
      (previous !== undefined && previous.repositoryId >= source.repositoryId)
    )
      return null;
    sources.push(
      Object.freeze({
        repositoryId: source.repositoryId,
        revision: source.revision as string | null,
      }),
    );
  }
  return Object.freeze(sources);
}

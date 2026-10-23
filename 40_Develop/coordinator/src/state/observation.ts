/**
 * 現在状態と実行履歴を読み取り、照会結果へ投影する。
 *
 * @responsibility 現在状態OwnerとExecution Intelligenceの履歴Ownerから得た観測を相関する。
 * @trace ARCH-000004
 */

import type {
  RuntimeActivityRequest,
  ActivityRepository,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
  ActivitySource,
} from "./types.ts";
import { types as utilTypes } from "node:util";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
  deriveCoordinatorRepositoryBindingId,
} from "./model.ts";
import {
  type TaskAttemptExecutionIntelligenceEvent,
  verifyExecutionIntelligenceRepositoryRoot,
  readExecutionIntelligence,
} from "../../../execution-intelligence/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  observeRepositoryRevision,
  gitRepositoryRevisionAdapter,
} from "../../../version-control/src/index.ts";
import {
  deriveActivitySourceCorrelation,
  decodeActivityCursor,
  compareActivityEventPositions,
  parseRuntimeActivityObservation,
  encodeActivityCursor,
} from "./projection.ts";
import { readCoordinatorSnapshot } from "../storage/current-state.ts";
import { queryCoordinatorState } from "./query.ts";

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
  input: RuntimeActivityRequest,
): RuntimeActivityRequest {
  if (!input || typeof input !== "object" || utilTypes.isProxy(input))
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
      utilTypes.isProxy(entry.root)
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
  event: TaskAttemptExecutionIntelligenceEvent,
  repositoryId: string,
): RuntimeActivityEvent {
  return Object.freeze({
    repositoryId,
    eventId: event.eventId,
    occurredAt: event.occurredAt,
    objectiveId: event.identity.objectiveId,
    taskId: event.identity.taskId,
    attemptId: event.identity.attemptId,
    status: event.outcome.status,
    reason: event.outcome.reason,
    cleanupConfirmed: event.outcome.cleanupConfirmed,
    manualRecoveryRequired: event.outcome.manualRecoveryRequired,
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
export async function readAuthorizedRuntimeActivity(
  input: RuntimeActivityRequest,
  signal?: AbortSignal,
): Promise<RuntimeActivityObservation> {
  if (signal?.aborted) throw new Error("runtime_activity_cancelled");
  const request = inspectActivityRequest(input);
  const targets = request.repositories.map((repository) => {
    const root = resolveVerifiedRepositoryRoot(repository.root);
    let revision: string | null = null;
    if (root !== null) {
      try {
        const target = observeRepositoryRevision(
          repository.root,
          gitRepositoryRevisionAdapter,
        );
        revision = target?.revisionIdentity ?? null;
      } catch {
        revision = null;
      }
    }
    return { repository, root, revision };
  });
  const sources: readonly ActivitySource[] = Object.freeze(
    targets.map(({ repository, revision }) =>
      Object.freeze({ repositoryId: repository.repositoryId, revision }),
    ),
  );
  const revisionsKnown = sources.every((source) => source.revision !== null);
  if (request.cursor !== undefined && !revisionsKnown)
    throw new Error("runtime_activity_cursor_revision_unknown");
  const sourceHash = deriveActivitySourceCorrelation(
    request.projectId,
    sources,
  );
  const cursor = decodeActivityCursor(request.cursor, sourceHash);
  let stateUnknown = false,
    eventUnknown = false;
  const observed: {
    repositoryId: string;
    projection: NonNullable<RuntimeActivityObservation["projection"]>;
  }[] = [];
  const events: RuntimeActivityEvent[] = [];
  const singleTasks: NonNullable<
    RuntimeActivityObservation["singleTasks"]
  >[number][] = [];
  for (const { repository, root, revision } of targets) {
    if (root === null) {
      stateUnknown = true;
      eventUnknown = true;
      continue;
    }
    if (revision === null) stateUnknown = true;
    else {
      const snapshot = readCoordinatorSnapshot(
        root,
        deriveCoordinatorRepositoryBindingId(root),
      );
      if (snapshot.status !== "completed") stateUnknown = true;
      else if (snapshot.value !== null) {
        const value = snapshot.value;
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
        const result = queryCoordinatorState(
          {
            readState: (projectId) =>
              Object.freeze({
                status: "completed",
                reason: "orchestrator_state_observed",
                value:
                  value.projects.find(
                    (project) => project.projectId === projectId,
                  ) ?? null,
              }),
          },
          {
            requestId: "runtime-activity-observation",
            projectId: request.projectId,
            repositoryRevision: revision,
          },
          value.intakeEpoch,
        );
        if (result.observationState === "unknown") stateUnknown = true;
        else if (result.projection !== null)
          observed.push({
            repositoryId: repository.repositoryId,
            projection: result.projection,
          });
      }
    }
    const verified = verifyExecutionIntelligenceRepositoryRoot(root);
    if (verified.status !== "completed") {
      eventUnknown = true;
      continue;
    }
    const history = readExecutionIntelligence(verified.root);
    if (history.status !== "completed") {
      eventUnknown = true;
      continue;
    }
    for (const event of history.events)
      if (
        event.eventType === "task_attempt_settled" &&
        event.identity.projectId === request.projectId
      )
        events.push(projectActivityEvent(event, repository.repositoryId));
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
  const result = parseRuntimeActivityObservation({
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
      !eventUnknown && revisionsKnown && after.length > page.length && last
        ? encodeActivityCursor(last, sourceHash)
        : null,
  });
  if (result === null) throw new Error("runtime_activity_result_invalid");
  return result;
}

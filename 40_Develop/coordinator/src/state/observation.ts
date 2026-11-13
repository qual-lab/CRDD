/**
 * 現在状態と実行履歴を読み取り、照会結果へ投影する。
 *
 * @responsibility 現在状態OwnerとExecution Intelligenceの履歴Ownerから得た観測を相関する。
 * @trace ARCH-000004
 */

import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  type Execution,
  listExecutions,
} from "../../../execution-intelligence/src/index.ts";
import { readState } from "../../../execution-model/src/index.ts";
import {
  readRepositoryRevision,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import { getExecutionIntelligenceStore } from "../execution/intelligence.ts";
import { verifyRuntimePersistenceRepository } from "../execution/persistence.ts";
import { snapshotPlainArray, snapshotPlainRecord } from "../input/snapshot.ts";

import { queryCoordinatorState } from "./query.ts";

import { deriveCoordinatorRepositoryBindingId } from "./validation.ts";

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
): RuntimeActivityEvent {
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
        const target = readRepositoryRevision(repository.root);
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
      const snapshot = readState(
        verifyRuntimePersistenceRepository(root),
        deriveCoordinatorRepositoryBindingId(root),
        "execution",
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

import { inspectCoordinatorProjection } from "./projection.ts";
import type {
  ActivityRepository,
  ActivitySource,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
  RuntimeActivityRequest,
} from "./types.ts";
/**
 * Projectと正規Sourceの相関Hashを導出する。
 * @responsibility 同じ対象集合と改訂のbyte表現を一つにする。
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
  sources: readonly ActivitySource[],
): string {
  return createHash("sha256")
    .update(JSON.stringify([projectId, sources]))
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
  event: Pick<RuntimeActivityEvent, "occurredAt" | "eventId">,
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
  left: Pick<RuntimeActivityEvent, "occurredAt" | "eventId">,
  right: Pick<RuntimeActivityEvent, "occurredAt" | "eventId">,
): number {
  const time = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  return (
    time ||
    (left.eventId < right.eventId ? 1 : left.eventId > right.eventId ? -1 : 0)
  );
}

/**
 * Remote Runtime Activity観測の閉じた構造を検証する。
 *
 * @responsibility Application ReaderまたはHTTP Responseの未信頼値を公開契約へ入る前に検証する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 * @input valueに観測候補を受け取る。
 * @returns 契約へ適合する場合trueを返す。
 * @precondition valueを信頼済み型と仮定しない。
 * @postcondition Property、状態相関、Event上限およびContinuationを検査する。
 * @effect N/A: 値を観測するだけである。
 * @failure 不正値はfalseで拒否する。
 * @invariant observedとprojectionの相関を崩さない。
 * @boundary Runtime Activity Reader／HTTP JSONとCoordinator公開契約の境界。
 * @security 余剰Propertyを受理して秘密値を透過しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function inspectRuntimeActivityObservation(
  value: unknown,
): value is RuntimeActivityObservation {
  return parseRuntimeActivityObservation(value) !== null;
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
export function parseRuntimeActivityObservation(
  value: unknown,
): RuntimeActivityObservation | null {
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
    RuntimeActivityObservation["singleTasks"]
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
          RuntimeActivityObservation["singleTasks"]
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
        !/^[A-Za-z0-9_-]{1,1024}$/u.test(record.eventContinuation) ||
        sources.some((source) => source.revision === null))) ||
    (record.eventState === "unknown" && record.eventContinuation !== null)
  )
    return null;
  const rawEvents = snapshotPlainArray(record.events, Number.MAX_SAFE_INTEGER);
  if (rawEvents.status !== "ok") return null;
  if (record.eventState === "unknown" && rawEvents.value.length !== 0)
    return null;
  const events: RuntimeActivityEvent[] = [];
  for (const raw of rawEvents.value) {
    const event = parseRuntimeEvent(raw);
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
    state: record.state as RuntimeActivityObservation["state"],
    reason: record.reason,
    projection,
    sources,
    currentSourceRepositoryId: record.currentSourceRepositoryId as
      | string
      | null,
    eventState: record.eventState as RuntimeActivityObservation["eventState"],
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
function parseRuntimeEvent(value: unknown): RuntimeActivityEvent | null {
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
  return valid ? (Object.freeze({ ...record }) as RuntimeActivityEvent) : null;
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

/**
 * Orchestrator Runtime活動の閉じた公開結果を検査する。
 *
 * @responsibility 現在状態とEventの相関・Property境界をTransport間で共用する。
 * @trace ARCH-000004
 * @trace ARCH-000007
 */
import { types as utilTypes } from "node:util";
import {
  deriveActivitySourceCorrelation,
  compareActivityEventPositions,
  decodeActivityCursor,
  encodeActivityCursor,
} from "./cursor.ts";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../input/plain-data-snapshot.ts";
import { inspectOrchestratorProjection } from "../state/query-contract.ts";
import type {
  RuntimeActivityObservation,
  RuntimeActivityEvent,
  ActivitySource,
} from "./types.ts";

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
 * @boundary Runtime Activity Reader／HTTP JSONとOrchestrator公開契約の境界。
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
  const record = snapshotPlainRecord(
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
      utilTypes.isProxy(record.projection)
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
  if (
    record.currentSourceRepositoryId !== null &&
    (typeof record.currentSourceRepositoryId !== "string" ||
      !sourceIds.has(record.currentSourceRepositoryId))
  )
    return null;
  const projection = inspectOrchestratorProjection(record.projection);
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
  const rawEvents = snapshotPlainArray(record.events, 50);
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
 * @boundary Remote JSONとOrchestrator Event投影の境界。
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
  const raw = snapshotPlainArray(value, 10000);
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

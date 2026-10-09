/**
 * CROS Runtime活動の閉じた公開結果を検査する。
 *
 * @responsibility 現在状態とEventの相関・Property境界をTransport間で共用する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 */
import { types as utilTypes } from "node:util";
import {
  snapshotPlainRecord,
  snapshotPlainArray,
} from "../../../domain-model/src/index.ts";
import { inspectOrchestratorProjection } from "../../../orchestrator/src/index.ts";
import type {
  CrosRemoteRuntimeActivityObservation,
  CrosRemoteRuntimeEventProjection,
} from "./types.ts";

/**
 * Remote Runtime Activity観測の閉じた構造を検証する。
 *
 * @responsibility Application ReaderまたはHTTP Responseの未信頼値を公開契約へ入る前に検証する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @input valueに観測候補を受け取る。
 * @returns 契約へ適合する場合trueを返す。
 * @precondition valueを信頼済み型と仮定しない。
 * @postcondition Property、状態相関、Event上限およびContinuationを検査する。
 * @effect N/A: 値を観測するだけである。
 * @failure 不正値はfalseで拒否する。
 * @invariant observedとprojectionの相関を崩さない。
 * @boundary Runtime Activity Reader／HTTP JSONとCROS公開契約の境界。
 * @security 余剰Propertyを受理して秘密値を透過しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function inspectCrosRuntimeActivityObservation(
  value: unknown,
): value is CrosRemoteRuntimeActivityObservation {
  return parseCrosRuntimeActivityObservation(value) !== null;
}

/**
 * 活動観測を所有済みの固定結果へ変換する。
 *
 * @responsibility Reader由来の参照を公開せず、許可した値だけを取得して固定する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
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
export function parseCrosRuntimeActivityObservation(
  value: unknown,
): CrosRemoteRuntimeActivityObservation | null {
  const record = snapshotPlainRecord(
    value,
    new Set([
      "state",
      "reason",
      "projection",
      "eventState",
      "eventReason",
      "events",
      "eventContinuation",
    ]),
  );
  if (!record) return null;
  if (
    typeof record.state !== "string" ||
    !["observed", "absent", "unknown"].includes(record.state) ||
    typeof record.reason !== "string" ||
    record.reason.length === 0 ||
    typeof record.eventState !== "string" ||
    !["observed", "unknown"].includes(record.eventState) ||
    typeof record.eventReason !== "string" ||
    record.eventReason.length === 0 ||
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
  const projection = inspectOrchestratorProjection(record.projection);
  if (
    record.state === "observed"
      ? projection === null
      : record.projection !== null
  )
    return null;
  const rawEvents = snapshotPlainArray(record.events, 50);
  if (rawEvents.status !== "ok") return null;
  if (record.eventState === "unknown" && rawEvents.value.length !== 0)
    return null;
  const events: CrosRemoteRuntimeEventProjection[] = [];
  for (const raw of rawEvents.value) {
    const event = parseRuntimeEvent(raw);
    if (event === null) return null;
    events.push(event);
  }
  return Object.freeze({
    state: record.state as CrosRemoteRuntimeActivityObservation["state"],
    reason: record.reason,
    projection,
    eventState:
      record.eventState as CrosRemoteRuntimeActivityObservation["eventState"],
    eventReason: record.eventReason,
    events: Object.freeze(events),
    eventContinuation: record.eventContinuation,
  });
}

/**
 * Runtime Event要約を所有済みの固定値へ変換する。
 *
 * @responsibility Event要約のProperty、Identity、時刻、状態および真偽値を閉じたSchemaで検査する。
 * @trace ARCH-000005
 * @trace ARCH-000007
 * @trace ARCH-000013
 * @input valueにEvent要約候補を受け取る。
 * @returns 適合する場合は所有済みの固定Event要約、不正ならnull。
 * @precondition valueを信頼済みObjectと仮定しない。
 * @postcondition 余剰Propertyのない安全なEvent要約だけを受理する。
 * @effect N/A: 値を観測するだけである。
 * @failure 不正値はnullで拒否する。
 * @invariant Event時刻と結果を補正しない。
 * @boundary Remote JSONとCROS Event投影の境界。
 * @security 任意Objectまたは生Provider情報を透過しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function parseRuntimeEvent(
  value: unknown,
): CrosRemoteRuntimeEventProjection | null {
  const record = snapshotPlainRecord(
    value,
    new Set([
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
    typeof record.eventId === "string" &&
    /^execution-[0-9a-f]{64}$/u.test(record.eventId) &&
    typeof record.occurredAt === "string" &&
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
    typeof record.cleanupConfirmed === "boolean" &&
    typeof record.manualRecoveryRequired === "boolean";
  return valid
    ? (Object.freeze({ ...record }) as CrosRemoteRuntimeEventProjection)
    : null;
}

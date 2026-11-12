/**
 * 実行履歴・記録退役の値検査と純粋な遷移・投影を所有する。
 * @responsibility I/Oや新しい権限を発行せず、モデル固有の受入条件を判定する。
 * @trace ARCH-000008
 */

import { createHash } from "node:crypto";
import { types } from "node:util";
import {
  isDockerRestartCheckpointSettled,
  parseDockerTaskRecoveryId,
  validCoordinatorOutcome,
  validCoordinatorPrimaryFailure,
  validCoordinatorRepairSummary,
} from "../attempt/validation.ts";
import {
  inspectDecisionHistoryEvent,
  projectDecisionHistory,
} from "../decision/validation.ts";
import type {
  CoordinatorSnapshot,
  CoordinatorSnapshotObservations,
} from "../state/types.ts";
import {
  COORDINATOR_PROJECT_SNAPSHOT_SCHEMA,
  coordinatorAdoptionWasRejected,
  coordinatorQueueIsClosed,
  coordinatorRejectedAdoptionEvidenceCanRetire,
  coordinatorStandaloneAdoptionIsClosed,
  decodeRuntimeDomainSnapshot,
  encodeRuntimeStateValue,
  hasRuntimeStateRecordKeys,
  historyRow,
  inspectCoordinatorProjection,
  isSha256Hex,
  snapshotRuntimeStateArray,
  snapshotRuntimeStateRecord,
} from "../state/validation.ts";
import { coordinatorConsumerCompletionPolicy } from "../task/validation.ts";
import type {
  ActivitySource,
  HistoryRow,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
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
  const parsed = snapshotRuntimeStateArray(raw, 3);
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
    snapshotRuntimeStateRecord(value, keys) ??
    snapshotRuntimeStateRecord(
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
    const items = snapshotRuntimeStateArray(
      record.singleTasks,
      Number.MAX_SAFE_INTEGER,
    );
    if (items.status !== "ok") return null;
    for (const item of items.value) {
      const task = snapshotRuntimeStateRecord(
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
  const rawEvents = snapshotRuntimeStateArray(
    record.events,
    Number.MAX_SAFE_INTEGER,
  );
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
  const record = snapshotRuntimeStateRecord(
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
  const raw = snapshotRuntimeStateArray(value, Number.MAX_SAFE_INTEGER);
  if (raw.status !== "ok" || raw.value.length === 0) return null;
  const sources: ActivitySource[] = [];
  for (const entry of raw.value) {
    const previous = sources.at(-1);
    const source = snapshotRuntimeStateRecord(
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

/**
 * 実行・判断履歴を全行検査し、exact行の相関だけを返す。
 * @responsibility 破損、部分行、重複、未知値を期間整理へ渡さない。
 * @trace ARCH-000008
 * @input bytes: 固定履歴Fileから安定読取りしたUTF-8本文。
 * @returns 正規行・時刻・回復参照・両Hashの不変集合、またはnull。
 * @precondition File実体とRootは物理Ownerが確認する。
 * @postcondition 全行を検証するまで部分結果を返さない。
 * @effect N/A: メモリ内の復号と検査だけ。
 * @failure 不正UTF-8、部分行、未知Schema、重複はnull。
 * @invariant 容量・破損を行削除で解消せず、履歴をAuthorityへ昇格しない。
 * @boundary 終了履歴の値契約と物理Writer。
 * @security 未検査fieldや任意Pathを許可せず、判断本文を現在のAuthorityへ昇格しない。
 * @concurrency 元Fileと元状態の再照合は物理Ownerが行う。
 */
export function decodeCoordinatorHistoryRows(bytes: unknown) {
  try {
    if (!Buffer.isBuffer(bytes)) return null;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (!Buffer.from(text, "utf8").equals(bytes)) return null;
    if (text === "") return Object.freeze([]);
    if (!text.endsWith("\n")) return null;
    const seen = new Set<string>();
    const rows = text
      .slice(0, -1)
      .split("\n")
      .map((line) => {
        const row = JSON.parse(line);
        const summary = row?.summary;
        if (summary?.schema === "crdd-coordinator/decision-event/v1") {
          const event = inspectDecisionHistoryEvent(summary.record);
          if (
            !event ||
            !hasRuntimeStateRecordKeys(row, [
              "schema",
              "occurredAt",
              "summary",
            ]) ||
            row.schema !== "crdd-coordinator/history-row/v2" ||
            !hasRuntimeStateRecordKeys(summary, ["schema", "record"]) ||
            row.occurredAt !== event.occurredAt ||
            `${encodeRuntimeStateValue(row)}\n` !== `${line}\n`
          )
            throw new Error("decision_history_row_invalid");
          const recoveryId = `decision-history.${event.eventId}`;
          if (seen.has(recoveryId))
            throw new Error("decision_history_identity_duplicate");
          seen.add(recoveryId);
          return Object.freeze({
            line: `${line}\n`,
            occurredAt: event.occurredAt,
            recoveryId,
            lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
            summarySha256: createHash("sha256")
              .update(`${encodeRuntimeStateValue(summary)}\n`)
              .digest("hex"),
          });
        }
        if (summary?.schema === "crdd-coordinator/task-summary/v1") {
          if (
            !hasRuntimeStateRecordKeys(row, [
              "schema",
              "occurredAt",
              "summary",
            ]) ||
            row.schema !== "crdd-coordinator/history-row/v2" ||
            !hasRuntimeStateRecordKeys(summary, ["schema", "record"]) ||
            `${encodeRuntimeStateValue(row)}\n` !== `${line}\n`
          )
            throw new Error("task_history_row_invalid");
          const record = historyRow(summary.record, Date.parse(row.occurredAt));
          const recoveryId = `task-history.${record.id}`;
          if (record.occurredAt !== row.occurredAt || seen.has(recoveryId))
            throw new Error("task_history_identity_invalid");
          seen.add(recoveryId);
          return Object.freeze({
            line: `${line}\n`,
            occurredAt: record.occurredAt,
            recoveryId,
            lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
            summarySha256: createHash("sha256")
              .update(`${encodeRuntimeStateValue(summary)}\n`)
              .digest("hex"),
          });
        }
        if (summary?.schema === "crdd-coordinator/repair-summary/v1") {
          if (
            !hasRuntimeStateRecordKeys(row, [
              "schema",
              "occurredAt",
              "summary",
            ]) ||
            row.schema !== "crdd-coordinator/history-row/v2" ||
            typeof row.occurredAt !== "string" ||
            !Number.isFinite(Date.parse(row.occurredAt)) ||
            new Date(row.occurredAt).toISOString() !== row.occurredAt ||
            `${encodeRuntimeStateValue(row)}\n` !== `${line}\n` ||
            !validCoordinatorRepairSummary(summary) ||
            (summary.retention !== undefined &&
              row.occurredAt !== summary.retention.decidedAt) ||
            seen.has(summary.recoveryId)
          )
            throw new Error("repair_history_row_invalid");
          seen.add(summary.recoveryId);
          return Object.freeze({
            line: `${line}\n`,
            occurredAt: row.occurredAt as string,
            ...(summary.retention === undefined
              ? {}
              : { reviewAfter: summary.retention.reviewAfter as string }),
            recoveryId: summary.recoveryId as string,
            lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
            summarySha256: createHash("sha256")
              .update(`${encodeRuntimeStateValue(summary)}\n`)
              .digest("hex"),
          });
        }
        if (
          !hasRuntimeStateRecordKeys(row, [
            "schema",
            "occurredAt",
            "summary",
          ]) ||
          row.schema !== "crdd-coordinator/history-row/v2" ||
          typeof row.occurredAt !== "string" ||
          !Number.isFinite(Date.parse(row.occurredAt)) ||
          new Date(Date.parse(row.occurredAt)).toISOString() !==
            row.occurredAt ||
          `${encodeRuntimeStateValue(row)}\n` !== `${line}\n` ||
          !hasRuntimeStateRecordKeys(summary, [
            "schema",
            ...(summary?.schema === "crdd-coordinator/operation-summary/v4"
              ? ["consumer", "recoveryCorrelationId"]
              : []),
            ...(summary?.schema === "crdd-coordinator/operation-summary/v3" ||
            (summary?.schema === "crdd-coordinator/operation-summary/v4" &&
              Object.hasOwn(summary, "dockerRestart"))
              ? ["dockerRestart"]
              : []),
            "operationId",
            "operationNonce",
            "recoveryId",
            "identitySha256",
            "primaryFailure",
            "execution",
            "outcome",
            "hostCleanup",
            "lease",
          ]) ||
          ![
            "crdd-coordinator/operation-summary/v2",
            "crdd-coordinator/operation-summary/v3",
            "crdd-coordinator/operation-summary/v4",
          ].includes(summary.schema) ||
          (summary.schema === "crdd-coordinator/operation-summary/v4" &&
            (coordinatorConsumerCompletionPolicy(summary.consumer) === null ||
              !(
                summary.recoveryCorrelationId === null ||
                (typeof summary.recoveryCorrelationId === "string" &&
                  /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(
                    summary.recoveryCorrelationId,
                  ))
              ))) ||
          ((summary.schema === "crdd-coordinator/operation-summary/v3" ||
            (summary.schema === "crdd-coordinator/operation-summary/v4" &&
              Object.hasOwn(summary, "dockerRestart"))) &&
            (summary.dockerRestart === null ||
              !isDockerRestartCheckpointSettled(summary.dockerRestart))) ||
          typeof summary.operationId !== "string" ||
          !/^OP-[0-9]{6,}$/u.test(summary.operationId) ||
          !isSha256Hex(summary.operationNonce) ||
          !isSha256Hex(summary.identitySha256) ||
          !validCoordinatorPrimaryFailure(summary.primaryFailure) ||
          !hasRuntimeStateRecordKeys(summary.execution, [
            "providerStart",
            "externalSend",
            "sharedWrite",
            "ownerEffect",
            "workspaceReusable",
          ]) ||
          !["not_started", "started", "unknown"].includes(
            summary.execution.providerStart,
          ) ||
          !["not_issued", "issued", "unknown"].includes(
            summary.execution.externalSend,
          ) ||
          !["not_issued", "possible", "unknown"].includes(
            summary.execution.sharedWrite,
          ) ||
          summary.execution.ownerEffect !== "disabled" ||
          summary.execution.workspaceReusable !== false ||
          !validCoordinatorOutcome(summary.outcome) ||
          summary.outcome?.cleanupConfirmed !== true ||
          summary.hostCleanup !== "confirmed" ||
          summary.lease !== "released"
        )
          throw new Error("history_row_invalid");
        const recovery = parseDockerTaskRecoveryId(summary.recoveryId);
        if (
          !recovery ||
          recovery.operationNonce !== summary.operationNonce ||
          recovery.baseHash !== summary.identitySha256 ||
          seen.has(summary.recoveryId)
        )
          throw new Error("history_identity_invalid");
        seen.add(summary.recoveryId);
        return Object.freeze({
          line: `${line}\n`,
          occurredAt: row.occurredAt as string,
          recoveryId: summary.recoveryId as string,
          lineSha256: createHash("sha256").update(`${line}\n`).digest("hex"),
          summarySha256: createHash("sha256")
            .update(`${encodeRuntimeStateValue(summary)}\n`)
            .digest("hex"),
        });
      });
    return Object.freeze(rows);
  } catch {
    return null;
  }
}

/**
 * 検査済み終了履歴から保持期間内・保持期限前・未終了参照の行を残す候補を作る。
 * @responsibility 期間整理と保存確認の順序を現在状態へ結合する。
 * @trace ARCH-000008
 * @input currentBytes: 現在Snapshot、historyBytes: 履歴本文、now: 固定UTC時刻、retentionDays: 設定日数、repositoryBinding: 現在結合。
 * @returns 元の行順と本文を維持した候補、またはnull。
 * @precondition 更新排他内の元File実体・版・設定を物理Writerが再照合する。
 * @postcondition 未確認行は期限外でも保持し、確認済みの欠落行を再追加しない。
 * @effect N/A: メモリ内の候補生成だけ。
 * @failure 全行検査失敗、設定不正、未確認行欠落または相関不一致はnull。
 * @invariant 件数・容量を理由に削除せず、状態の操作・搬送を変更しない。
 * @boundary 現在状態と通常履歴の保持期間。
 * @security 候補生成は実保存・読戻し・操作除去のAuthorityを発行しない。
 * @concurrency 判定時刻・設定と元本文への結合を保存側が保持する。
 */
export function prepareCoordinatorHistoryRetention(
  currentBytes: unknown,
  historyBytes: unknown,
  now: unknown,
  retentionDays: unknown,
  repositoryBinding: unknown,
): Buffer | null {
  const current = decodeRuntimeDomainSnapshot(currentBytes, repositoryBinding);
  const rows = decodeCoordinatorHistoryRows(historyBytes);
  if (
    !current ||
    !rows ||
    typeof now !== "string" ||
    !Number.isFinite(Date.parse(now)) ||
    new Date(Date.parse(now)).toISOString() !== now ||
    typeof retentionDays !== "number" ||
    !Number.isSafeInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 104249991
  )
    return null;
  const cutoff = Date.parse(now) - retentionDays * 86400000;
  if (!Number.isSafeInteger(cutoff)) return null;
  const byRecovery = new Map(rows.map((row) => [row.recoveryId, row]));
  const protectedRecoveries = new Set<string>();
  for (const decision of current.snapshot.decisions) {
    const events = projectDecisionHistory(decision);
    if (!events) return null;
    for (const event of events)
      protectedRecoveries.add(`decision-history.${event.eventId}`);
  }
  for (const row of current.snapshot.historyPending)
    protectedRecoveries.add(`task-history.${row.id}`);
  for (const delivery of current.snapshot.pendingDeliveries)
    protectedRecoveries.add(delivery.recoveryId);
  for (const recovery of current.snapshot.unresolvedRecoveries)
    protectedRecoveries.add(recovery.recoveryId);
  for (const operation of current.snapshot.operations) {
    if (!operation.history) continue;
    const activeRetention =
      operation.kind === "runtime_repair" && operation.retention !== undefined;
    const row = byRecovery.get(operation.recoveryId);
    if (
      (row &&
        (row.lineSha256 !== operation.history.lineSha256 ||
          row.summarySha256 !== operation.summarySha256)) ||
      (!row &&
        (!operation.history.confirmed ||
          activeRetention ||
          protectedRecoveries.has(operation.recoveryId)))
    )
      return null;
    if (!operation.history.confirmed || activeRetention)
      protectedRecoveries.add(operation.recoveryId);
  }
  return Buffer.from(
    rows
      .filter(
        (row) =>
          protectedRecoveries.has(row.recoveryId) ||
          ("reviewAfter" in row &&
            typeof row.reviewAfter === "string" &&
            Date.parse(now) < Date.parse(row.reviewAfter)) ||
          Date.parse(row.occurredAt) >= cutoff,
      )
      .map((row) => row.line)
      .join(""),
    "utf8",
  );
}

/**
 * 終了要約のpending候補を生成する。
 * @responsibility 同じ短期Ownerの用途固定観測を元の短絡位置で利用し対象外を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input fresh元版、用途固定の同期観測、必要な評価時刻。
 * @returns 元の固定結果封筒と候補又は無変更。
 * @precondition 同じ短期Ownerがfresh Snapshotを検証済み。履歴出版前に呼ぶ。
 * @postcondition 未解決・未搬送・参照中の記録を成功や退役へ補正しない。
 * @effect 値操作と同Ownerの有限同期観測。物理出版は呼ばない。
 * @failure 元の理由・観測順・再入場時のpendingを維持する。
 * @invariant 候補を保存・回復・排他解放の成立としない。
 * @boundary Domain値と既存Ownerへ束縛された履歴／資源観測。
 * @security 生Owner、publisher、handle、任意Snapshot callbackを受け取らない。
 * @concurrency 元の短期Owner内だけで適用する。観測値を対象間でmemoizeしない。
 */
export function prepareCoordinatorHistoryPending(
  current: CoordinatorSnapshot,
  now: number,
  observations: Readonly<{
    obligations: () => CoordinatorSnapshotObservations;
  }>,
) {
  if (
    !Number.isSafeInteger(now) ||
    now < 0 ||
    current.schema !== COORDINATOR_PROJECT_SNAPSHOT_SCHEMA
  )
    return blocked("orchestrator_history_time_invalid");
  const rows = current.queueEntries
    .filter(
      (queue) =>
        !current.historyPending.some((row) => row.id === queue.queueId) &&
        coordinatorQueueIsClosed(
          current,
          queue.queueId,
          observations.obligations(),
        ),
    )
    .map(
      (queue): HistoryRow => ({
        id: queue.queueId,
        occurredAt: new Date(now).toISOString(),
        outcome: queue.state === "cancelled" ? "cancelled" : "completed",
        primaryFailure: queue.state === "cancelled" ? "cancel" : null,
        cleanup: "confirmed",
      }),
    );
  for (const record of current.results) {
    if (
      current.historyPending.some((row) => row.id === record.identity) ||
      !coordinatorStandaloneAdoptionIsClosed(
        current,
        record.identity,
        observations.obligations(),
      )
    )
      continue;
    rows.push({
      id: record.identity,
      occurredAt: new Date(now).toISOString(),
      outcome: coordinatorAdoptionWasRejected(record) ? "failed" : "completed",
      primaryFailure: coordinatorAdoptionWasRejected(record)
        ? "execution"
        : null,
      cleanup: "confirmed",
    });
  }
  return completed("orchestrator_history_prepared", {
    next: rows.length
      ? { ...current, historyPending: [...current.historyPending, ...rows] }
      : null,
    value: rows.length,
  });
}

/**
 * 履歴出版成功後の終了記録退役候補を生成する。
 * @responsibility 同じ短期Ownerの用途固定観測を元の短絡位置で利用し対象外を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input fresh元版、用途固定の同期観測、必要な評価時刻。
 * @returns 元の固定結果封筒と候補又は無変更。
 * @precondition Coordinatorが必要な履歴出版を元の位置で成功させている。
 * @postcondition 未解決・未搬送・参照中の記録を成功や退役へ補正しない。
 * @effect 値操作と同Ownerの有限同期観測。物理出版は呼ばない。
 * @failure 元の理由・観測順・再入場時のpendingを維持する。
 * @invariant 候補を保存・回復・排他解放の成立としない。
 * @boundary Domain値と既存Ownerへ束縛された履歴／資源観測。
 * @security 生Owner、publisher、handle、任意Snapshot callbackを受け取らない。
 * @concurrency 元の短期Owner内だけで適用する。観測値を対象間でmemoizeしない。
 */
export function prepareCoordinatorTerminalRecordRetirement(
  current: CoordinatorSnapshot,
  observations: Readonly<{
    obligations: () => CoordinatorSnapshotObservations;
    historySettlement: (row: HistoryRow) => "recorded" | "expired" | null;
    nextEpoch: () => string;
  }>,
) {
  const retired = new Set<string>();
  for (const row of current.historyPending) {
    if (
      !coordinatorQueueIsClosed(current, row.id, observations.obligations()) &&
      !coordinatorStandaloneAdoptionIsClosed(
        current,
        row.id,
        observations.obligations(),
      )
    )
      continue;
    const disposition = observations.historySettlement(row);
    if (disposition !== "recorded" && disposition !== "expired")
      return blocked("orchestrator_history_transfer_unconfirmed", true);
    retired.add(row.id);
  }
  return completed("orchestrator_terminal_records_retired", {
    next: retired.size
      ? {
          ...current,
          intakeEpoch: current.queueEntries.some((queue) =>
            retired.has(queue.queueId),
          )
            ? observations.nextEpoch()
            : current.intakeEpoch,
          queueEntries: current.queueEntries.filter(
            (item) => !retired.has(item.queueId),
          ),
          intakeBindings: current.intakeBindings.filter(
            (item) => !retired.has(item.queueId),
          ),
          leaseEvidence: current.leaseEvidence.filter(
            (item) =>
              !current.queueEntries.some(
                (queue) =>
                  item.content.kind === "project-operation" &&
                  retired.has(queue.queueId) &&
                  queue.queueId === item.content.queueId &&
                  queue.projectId === item.projectId,
              ) &&
              !coordinatorRejectedAdoptionEvidenceCanRetire(
                current,
                {
                  ...current,
                  results: current.results.filter(
                    (record) => !retired.has(record.identity),
                  ),
                },
                item,
                observations.obligations(),
              ) &&
              !(
                item.content.kind === "canonical-adoption" &&
                !current.results.some(
                  (record) =>
                    record.kind === "adoption" &&
                    record.projectId === item.projectId &&
                    ((!retired.has(record.identity) &&
                      !current.queueEntries.some(
                        (queue) =>
                          retired.has(queue.queueId) &&
                          queue.queueId === record.queueId &&
                          queue.projectId === record.projectId &&
                          queue.milestoneId === record.milestoneId,
                      )) ||
                      current.projects.some(
                        (project) =>
                          project.milestone.criterionEvidenceIds.includes(
                            record.identity,
                          ) ||
                          project.objectives.some((objective) =>
                            objective.criterionEvidenceIds.includes(
                              record.identity,
                            ),
                          ),
                      ) ||
                      current.queueEntries.some(
                        (queue) =>
                          !retired.has(queue.queueId) &&
                          queue.resultReference === record.identity,
                      )),
                ) &&
                !current.queueEntries.some(
                  (queue) =>
                    queue.projectId === item.projectId &&
                    !retired.has(queue.queueId),
                ) &&
                current.historyPending.some(
                  (row) =>
                    retired.has(row.id) &&
                    (current.queueEntries.some(
                      (queue) =>
                        queue.queueId === row.id &&
                        queue.projectId === item.projectId,
                    ) ||
                      current.results.some(
                        (record) =>
                          record.identity === row.id &&
                          record.projectId === item.projectId &&
                          !coordinatorAdoptionWasRejected(record),
                      )),
                )
              ),
          ),
          results: current.results.filter(
            (item) =>
              (!current.queueEntries.some(
                (queue) =>
                  retired.has(queue.queueId) &&
                  queue.queueId === item.queueId &&
                  queue.projectId === item.projectId &&
                  queue.milestoneId === item.milestoneId,
              ) &&
                !retired.has(item.identity)) ||
              current.projects.some(
                (project) =>
                  project.milestone.criterionEvidenceIds.includes(
                    item.identity,
                  ) ||
                  project.objectives.some((objective) =>
                    objective.criterionEvidenceIds.includes(item.identity),
                  ),
              ) ||
              current.queueEntries.some(
                (queue) =>
                  !retired.has(queue.queueId) &&
                  queue.resultReference === item.identity,
              ),
          ),
          historyPending: current.historyPending.filter(
            (row) => !retired.has(row.id),
          ),
        }
      : null,
    value: retired.size,
  });
}

/**
 * 出版済みpendingの搬送確認候補を生成する。
 * @responsibility 同じ短期Ownerの用途固定観測を元の短絡位置で利用し対象外を保持する。
 * @trace ARCH-000004、ARCH-000008
 * @input fresh元版、用途固定の同期観測、必要な評価時刻。
 * @returns 元の固定結果封筒と候補又は無変更。
 * @precondition Coordinatorが必要な履歴出版を元の位置で成功させている。
 * @postcondition 未解決・未搬送・参照中の記録を成功や退役へ補正しない。
 * @effect 値操作と同Ownerの有限同期観測。物理出版は呼ばない。
 * @failure 元の理由・観測順・再入場時のpendingを維持する。
 * @invariant 候補を保存・回復・排他解放の成立としない。
 * @boundary Domain値と既存Ownerへ束縛された履歴／資源観測。
 * @security 生Owner、publisher、handle、任意Snapshot callbackを受け取らない。
 * @concurrency 元の短期Owner内だけで適用する。観測値を対象間でmemoizeしない。
 */
export function prepareCoordinatorHistoryTransfer(
  current: CoordinatorSnapshot,
  observations: Readonly<{
    historySettlement: (row: HistoryRow) => "recorded" | "expired" | null;
  }>,
) {
  let recorded = 0;
  let expired = 0;

  for (const row of current.historyPending) {
    const disposition = observations.historySettlement(row);
    if (disposition !== "recorded" && disposition !== "expired")
      return blocked("orchestrator_history_transfer_unconfirmed", true);
    if (disposition === "recorded") recorded += 1;
    else expired += 1;
  }
  return completed("orchestrator_history_transferred", {
    next: current.historyPending.length
      ? { ...current, historyPending: [] }
      : null,
    value: { recorded, expired },
  });
}

/** 元の成功封筒を局所値として返す。 */
function completed<T>(reason: string, value: T) {
  return Object.freeze({ status: "completed" as const, reason, value });
}

/** 元の固定拒否と手動回復フラグを保持する。 */
function blocked(reason: string, manualRecoveryRequired = false) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    value: null,
    manualRecoveryRequired,
    recoveryId: null,
  });
}

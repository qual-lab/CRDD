/**
 * 実行観測の非秘密要約とページ相関を検査する。
 * @packageDocumentation
 * @responsibility 共有値の閉形式と相関を検査し、実行・保存・認可を発行しない。
 * @trace ARCH-000004
 * @trace ARCH-000008
 * @boundary Domain値と利用側の入力・公開結果。
 */
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import type {
  ActivitySource,
  RuntimeActivityEvent,
  RuntimeActivityObservation,
} from "./projection-types.ts";
import { snapshotPlainArray, snapshotPlainRecord } from "./validation.ts";
import { inspectCoordinatorProjection } from "./projection.ts";
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
  const singleTasks: NonNullable<
    RuntimeActivityObservation["singleTasks"]
  >[number][] = [];
  if (Object.hasOwn(record, "singleTasks")) {
    const items = snapshotPlainArray(record.singleTasks, 10000);
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

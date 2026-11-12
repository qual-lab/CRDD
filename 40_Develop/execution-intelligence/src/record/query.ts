/**
 * ExecutionとGroupの単件参照・完全一致検索を提供する。
 * @responsibility 検索条件・期間・ページを検査し、観測不能と正常な不存在を区別する。
 * @trace ARCH-000007
 * @boundary 認可・Store選択は上位。履歴・Lock・Directoryを作成又は変更しない。
 */
import { readRecords } from "../storage/store.ts";
import type {
  Execution,
  ExecutionGroup,
  ExecutionQuery,
  GroupQuery,
  ReadResult,
  StoreOptions,
} from "./types.ts";
import { assertId, instant, snapshot } from "./validation.ts";

/** 検索条件だけを固定し、未知キーや期間・ページ境界を拒否する。 */
export function inspectQuery(
  input: ExecutionQuery | GroupQuery,
  execution: boolean,
) {
  const q = snapshot(input);
  const allowed = [
    "application",
    "operation",
    "role",
    "workType",
    "metadata",
    "status",
    "period",
    "limit",
    "offset",
    ...(execution ? ["groupId", "provider", "model"] : []),
  ];
  if (
    !q ||
    typeof q !== "object" ||
    Array.isArray(q) ||
    Object.keys(q).some((k) => !allowed.includes(k))
  )
    throw Error("query_invalid");
  for (const [k, v] of Object.entries(q)) {
    if (["limit", "offset", "metadata", "period"].includes(k)) continue;
    if (typeof v !== "string" || !v.length) throw Error("query_invalid");
  }
  const statuses = execution
    ? ["open", "completed", "failed", "blocked", "cancelled", "unknown"]
    : ["open", "completed", "failed", "cancelled"];
  if (q.status !== undefined && !statuses.includes(q.status))
    throw Error("query_status_invalid");
  if (
    q.metadata !== undefined &&
    (!q.metadata ||
      typeof q.metadata !== "object" ||
      Array.isArray(q.metadata) ||
      Object.values(q.metadata).some(
        (v) =>
          v !== null && !["string", "number", "boolean"].includes(typeof v),
      ))
  )
    throw Error("query_metadata_invalid");
  if (q.period !== undefined) {
    if (
      !q.period ||
      typeof q.period !== "object" ||
      Array.isArray(q.period) ||
      Object.keys(q.period).sort().join(",") !== "fromInclusive,toExclusive" ||
      instant(q.period.fromInclusive) >= instant(q.period.toExclusive)
    )
      throw Error("query_period_invalid");
  }
  if (
    (q.limit !== undefined &&
      (!Number.isSafeInteger(q.limit) || q.limit < 1)) ||
    (q.offset !== undefined &&
      (!Number.isSafeInteger(q.offset) || q.offset < 0))
  )
    throw Error("query_page_invalid");
  return q;
}
function matches(
  value: Execution | ExecutionGroup,
  query: ExecutionQuery | GroupQuery,
): boolean {
  for (const k of ["application", "operation", "role", "workType"] as const)
    if (query[k] !== undefined && value[k] !== query[k]) return false;
  if (
    query.metadata &&
    Object.entries(query.metadata).some(([k, v]) => value.metadata?.[k] !== v)
  )
    return false;
  if (
    query.period &&
    (Date.parse(value.startedAt) < Date.parse(query.period.fromInclusive) ||
      Date.parse(value.startedAt) >= Date.parse(query.period.toExclusive))
  )
    return false;
  const status =
    value.state === "open"
      ? "open"
      : "executionId" in value
        ? value.completion?.outcome.status
        : value.completion?.status;
  if (query.status !== undefined && status !== query.status) return false;
  if ("executionId" in value) {
    const q = query as ExecutionQuery;
    if (q.groupId !== undefined && value.groupId !== q.groupId) return false;
    for (const k of ["provider", "model"] as const)
      if (
        q[k] !== undefined &&
        (value.configuration?.[k]?.state !== "observed" ||
          value.configuration[k].value !== q[k])
      )
        return false;
  }
  return true;
}
/** 集計はページに切る前の同じ検索結果を利用する。 */
export function selectExecutions(
  store: StoreOptions,
  query: ExecutionQuery,
): ReadResult<readonly Execution[]> {
  try {
    const q = inspectQuery(query, true),
      read = readRecords(store);
    if (read.status !== "completed") return read;
    return {
      status: "completed",
      value: read.value.executions
        .filter((v) => matches(v, q))
        .sort(
          (a, b) =>
            Date.parse(a.startedAt) - Date.parse(b.startedAt) ||
            a.executionId.localeCompare(b.executionId),
        ),
    };
  } catch {
    return { status: "blocked", reason: "query_invalid" };
  }
}
/** 検索母集合の件数と指定ページを返す。入力不正やStore不明を正常空集合へ変換しない。 */
export function listExecutions(
  store: StoreOptions,
  query: ExecutionQuery = {},
): ReadResult<Readonly<{ executions: readonly Execution[]; total: number }>> {
  try {
    const q = inspectQuery(query, true),
      found = selectExecutions(store, q);
    if (found.status !== "completed") return found;
    return {
      status: "completed",
      value: {
        executions: found.value.slice(
          q.offset ?? 0,
          (q.offset ?? 0) + (q.limit ?? 100),
        ),
        total: found.value.length,
      },
    };
  } catch {
    return { status: "blocked", reason: "query_invalid" };
  }
}
/** Group自身の属性で検索する。子の状態を推測せず、Store拒否はblockedのまま返す。 */
export function listGroups(
  store: StoreOptions,
  query: GroupQuery = {},
): ReadResult<Readonly<{ groups: readonly ExecutionGroup[]; total: number }>> {
  try {
    const q = inspectQuery(query, false),
      found = readRecords(store);
    if (found.status !== "completed") return found;
    const groups = found.value.groups
      .filter((v) => matches(v, q))
      .sort(
        (a, b) =>
          Date.parse(a.startedAt) - Date.parse(b.startedAt) ||
          a.groupId.localeCompare(b.groupId),
      );
    return {
      status: "completed",
      value: {
        groups: groups.slice(q.offset ?? 0, (q.offset ?? 0) + (q.limit ?? 100)),
        total: groups.length,
      },
    };
  } catch {
    return { status: "blocked", reason: "query_invalid" };
  }
}
/** 指定IDの実行を読む。正常な不存在はnull、ID不正・読取り不能はblockedとして区別する。 */
export function getExecution(
  store: StoreOptions,
  id: string,
): ReadResult<Execution | null> {
  try {
    assertId(id);
    const r = readRecords(store);
    return r.status === "completed"
      ? {
          status: "completed",
          value: r.value.executions.find((e) => e.executionId === id) ?? null,
        }
      : r;
  } catch {
    return { status: "blocked", reason: "execution_id_invalid" };
  }
}
/** 指定IDのGroupを読む。正常な不存在はnull、観測不能はblockedとし、子から補完しない。 */
export function getGroup(
  store: StoreOptions,
  id: string,
): ReadResult<ExecutionGroup | null> {
  try {
    assertId(id);
    const r = readRecords(store);
    return r.status === "completed"
      ? {
          status: "completed",
          value: r.value.groups.find((g) => g.groupId === id) ?? null,
        }
      : r;
  } catch {
    return { status: "blocked", reason: "group_id_invalid" };
  }
}

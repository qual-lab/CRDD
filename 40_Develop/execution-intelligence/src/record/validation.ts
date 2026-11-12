/**
 * 実行記録と検索入力に用いる値の固定・構造検査。
 * @responsibility Getterを実行しない入力捕捉と、Identity・観測値・状態相関の検査を共有する。
 * @trace ARCH-000007
 * @trace ARCH-000018
 * @boundary 保存・検索の入力と履歴読取り。Filesystemや状態遷移は操作しない。
 */
import { types } from "node:util";
import type { Execution, ExecutionGroup } from "./types.ts";

const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;

/**
 * accessor・Proxy・循環・未定義を拒否し、入力を自前の凍結JSON値へ固定する。
 * @failure GetterやProxyを評価せず例外で拒否する。情報分類や未知Secret不存在は保証しない。
 * @effect 値の複製だけ。Filesystem・Lock・呼出し側Objectを変更しない。
 */
export function snapshot<T>(value: T): T {
  const ancestors = new Set<object>();
  function copy(v: unknown): unknown {
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "string") {
      if (v.includes("\0")) throw Error("record_string_invalid");
      return v;
    }
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (!v || typeof v !== "object" || types.isProxy(v) || ancestors.has(v))
      throw Error("record_input_invalid");
    if (
      !Array.isArray(v) &&
      Object.getPrototypeOf(v) !== Object.prototype &&
      Object.getPrototypeOf(v) !== null
    )
      throw Error("record_input_invalid");
    ancestors.add(v);
    const descriptors = Object.getOwnPropertyDescriptors(v);
    if (Reflect.ownKeys(descriptors).some((k) => typeof k !== "string"))
      throw Error("record_input_invalid");
    const result: Record<string, unknown> | unknown[] = Array.isArray(v)
      ? []
      : Object.create(null);
    for (const key of Object.keys(descriptors).sort()) {
      if (Array.isArray(v) && key === "length") continue;
      const d = descriptors[key];
      if (
        !d ||
        !Object.hasOwn(d, "value") ||
        !d.enumerable ||
        key === "__proto__"
      )
        throw Error("record_input_invalid");
      Object.defineProperty(result, key, {
        value: copy(d.value),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    ancestors.delete(v);
    return Object.freeze(result);
  }
  return copy(value) as T;
}
type ObjectValue = Record<string, unknown>;
/** 非null・非配列Objectを要求する。安全な捕捉は先行するsnapshotが担当する。 */
export function recordObject(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("record_object_invalid");
  return value as ObjectValue;
}
/** 必須fieldと許可fieldの閉集合を検査し、欠落・未知keyは例外で拒否する。 */
export function assertRecordFields(
  value: ObjectValue,
  required: string[],
  optional: string[] = [],
) {
  if (
    required.some((k) => !Object.hasOwn(value, k)) ||
    Object.keys(value).some(
      (k) => !required.includes(k) && !optional.includes(k),
    )
  )
    throw Error("record_fields_invalid");
}
function text(value: unknown) {
  if (typeof value !== "string" || !value.length)
    throw Error("record_text_invalid");
}
/** 呼出し側が確定した記録IDの形式を確認する。ID生成・所有権判断は行わない。 */
export function validRecordId(value: unknown): value is string {
  return typeof value === "string" && ID.test(value);
}
/** 不正IDを例外で拒否し、検索や保存の対象拡張を防ぐ。 */
export function assertId(value: unknown): asserts value is string {
  if (!validRecordId(value)) throw Error("record_id_invalid");
}
/** 日時文字列を比較用時刻へ変換する。不正・非有限値を拒否し、現在時刻を補完しない。 */
export function instant(value: unknown): number {
  text(value);
  const t = Date.parse(value as string);
  if (!/^\d{4}-\d\d-\d\dT/u.test(value as string) || !Number.isFinite(t))
    throw Error("record_time_invalid");
  return t;
}
function nonnegative(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > Number.MAX_SAFE_INTEGER
  )
    throw Error("measurement_invalid");
}
function metadata(value: unknown) {
  const v = recordObject(value);
  for (const [k, x] of Object.entries(v)) {
    if (
      !k.length ||
      !(x === null || ["string", "number", "boolean"].includes(typeof x))
    )
      throw Error("metadata_invalid");
  }
}
function observation(value: unknown, check: (v: unknown) => void) {
  const v = recordObject(value);
  if (v.state === "observed") {
    assertRecordFields(v, ["state", "value", "source"]);
    text(v.source);
    check(v.value);
  } else {
    assertRecordFields(v, ["state", "reason"]);
    if (v.state !== "not_observed" && v.state !== "not_applicable")
      throw Error("observation_invalid");
    text(v.reason);
  }
}
const CONTEXT = ["application", "operation", "role", "workType", "metadata"];
function context(value: ObjectValue) {
  for (const k of CONTEXT)
    if (Object.hasOwn(value, k)) {
      if (k === "metadata") metadata(value[k]);
      else text(value[k]);
    }
}
/** 新Schemaの必須field・相関を同じ検査で入力と履歴に適用する。 */
export function validateExecution(value: Execution): void {
  const v = recordObject(value);
  assertRecordFields(
    v,
    ["executionId", "startedAt", "state", "completion"],
    [...CONTEXT, "groupId", "configuration"],
  );
  assertId(v.executionId);
  if (v.groupId !== undefined) assertId(v.groupId);
  context(v);
  const start = instant(v.startedAt);
  if (v.configuration !== undefined) {
    const c = recordObject(v.configuration);
    assertRecordFields(
      c,
      [],
      ["provider", "model", "reasoningEffort", "configurationRef"],
    );
    for (const [k, x] of Object.entries(c))
      if (k === "configurationRef") text(x);
      else observation(x, text);
  }
  if (v.state === "open" && v.completion === null) return;
  if (v.state !== "closed" || v.completion === null)
    throw Error("execution_state_invalid");
  const c = recordObject(v.completion);
  assertRecordFields(
    c,
    ["endedAt", "elapsedMs", "outcome", "retention"],
    ["providerDurationMs", "usage", "diagnostic", "artifactRef"],
  );
  if (instant(c.endedAt) < start) throw Error("record_time_reversed");
  observation(c.elapsedMs, nonnegative);
  if (c.providerDurationMs !== undefined)
    observation(c.providerDurationMs, nonnegative);
  if (c.retention !== "standard" && c.retention !== "unresolved")
    throw Error("retention_invalid");
  const outcome = recordObject(c.outcome);
  assertRecordFields(outcome, ["status"], ["failureCategory", "reason"]);
  if (
    !["completed", "failed", "blocked", "cancelled", "unknown"].includes(
      outcome.status as string,
    )
  )
    throw Error("outcome_invalid");
  for (const k of ["failureCategory", "reason"])
    if (outcome[k] !== undefined) text(outcome[k]);
  if (c.diagnostic !== undefined) metadata(c.diagnostic);
  if (c.artifactRef !== undefined) text(c.artifactRef);
  if (c.usage !== undefined) {
    const u = recordObject(c.usage);
    assertRecordFields(
      u,
      [],
      [
        "inputTokens",
        "outputTokens",
        "cacheReadTokens",
        "cacheWriteTokens",
        "cost",
      ],
    );
    for (const [k, x] of Object.entries(u))
      observation(x, (y) => {
        if (k !== "cost") {
          nonnegative(y);
          if (!Number.isSafeInteger(y)) throw Error("token_count_invalid");
          return;
        }
        const cost = recordObject(y);
        assertRecordFields(cost, ["amount", "unit", "kind", "source"]);
        nonnegative(cost.amount);
        text(cost.unit);
        if (
          !["currency", "credit"].includes(cost.kind as string) ||
          !["reported", "estimated"].includes(cost.source as string)
        )
          throw Error("cost_invalid");
      });
  }
}
/** Group自身の開始・終了相関を検査する。子の完了をGroup終了条件へ追加しない。 */
export function validateGroup(value: ExecutionGroup): void {
  const v = recordObject(value);
  assertRecordFields(
    v,
    ["groupId", "startedAt", "state", "completion"],
    CONTEXT,
  );
  assertId(v.groupId);
  context(v);
  const start = instant(v.startedAt);
  if (v.state === "open" && v.completion === null) return;
  if (v.state !== "closed" || v.completion === null)
    throw Error("group_state_invalid");
  const c = recordObject(v.completion);
  assertRecordFields(c, ["endedAt", "status"]);
  if (
    instant(c.endedAt) < start ||
    !["completed", "failed", "cancelled"].includes(c.status as string)
  )
    throw Error("group_completion_invalid");
}

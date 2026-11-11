/** 明示Directoryの単一履歴を検査・出版する。旧形式・未知残存を自動回収しない。 */
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";
import { acquireHistoryLock } from "./lock.ts";
import type {
  Execution,
  ExecutionGroup,
  ReadResult,
  StoreOptions,
  WriteResult,
} from "../record/types.ts";

type Row =
  | Readonly<{
      contract: "execution-intelligence/history/v3";
      kind: "execution";
      value: Execution;
    }>
  | Readonly<{
      contract: "execution-intelligence/history/v3";
      kind: "group";
      value: ExecutionGroup;
    }>;
export type Records = { executions: Execution[]; groups: ExecutionGroup[] };
const CONTRACT = "execution-intelligence/history/v3";
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_RECORDS = 10_000;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u;

/** accessor・Proxy・循環・未定義・過大値を受理せず、入力を自前のJSON値へ固定する。 */
export function snapshot<T>(value: T): T {
  let nodes = 0;
  const ancestors = new Set<object>();
  function copy(v: unknown, depth: number): unknown {
    if (++nodes > 50_000 || depth > 12) throw Error("record_input_limit");
    if (v === null || typeof v === "boolean") return v;
    if (typeof v === "string") {
      if (v.length > 8192 || v.includes("\0"))
        throw Error("record_string_invalid");
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
        value: copy(d.value, depth + 1),
        enumerable: true,
        writable: true,
        configurable: true,
      });
    }
    ancestors.delete(v);
    return Object.freeze(result);
  }
  return copy(value, 0) as T;
}
type ObjectValue = Record<string, unknown>;
function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("record_object_invalid");
  return value as ObjectValue;
}
function keys(value: ObjectValue, required: string[], optional: string[] = []) {
  if (
    required.some((k) => !Object.hasOwn(value, k)) ||
    Object.keys(value).some(
      (k) => !required.includes(k) && !optional.includes(k),
    )
  )
    throw Error("record_fields_invalid");
}
function text(value: unknown) {
  if (typeof value !== "string" || !value.length || value.length > 8192)
    throw Error("record_text_invalid");
}
export function assertId(value: unknown): asserts value is string {
  if (typeof value !== "string" || !ID.test(value))
    throw Error("record_id_invalid");
}
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
  const v = object(value);
  if (Object.keys(v).length > 64) throw Error("metadata_limit");
  for (const [k, x] of Object.entries(v)) {
    if (
      !k.length ||
      k.length > 128 ||
      !(x === null || ["string", "number", "boolean"].includes(typeof x))
    )
      throw Error("metadata_invalid");
  }
}
function observation(value: unknown, check: (v: unknown) => void) {
  const v = object(value);
  if (v.state === "observed") {
    keys(v, ["state", "value", "source"]);
    text(v.source);
    check(v.value);
  } else {
    keys(v, ["state", "reason"]);
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
  const v = object(value);
  keys(
    v,
    ["executionId", "startedAt", "state", "completion"],
    [...CONTEXT, "groupId", "configuration"],
  );
  assertId(v.executionId);
  if (v.groupId !== undefined) assertId(v.groupId);
  context(v);
  const start = instant(v.startedAt);
  if (v.configuration !== undefined) {
    const c = object(v.configuration);
    keys(c, [], ["provider", "model", "reasoningEffort", "configurationRef"]);
    for (const [k, x] of Object.entries(c))
      if (k === "configurationRef") text(x);
      else observation(x, text);
  }
  if (v.state === "open" && v.completion === null) return;
  if (v.state !== "closed" || v.completion === null)
    throw Error("execution_state_invalid");
  const c = object(v.completion);
  keys(
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
  const outcome = object(c.outcome);
  keys(outcome, ["status"], ["failureCategory", "reason"]);
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
    const u = object(c.usage);
    keys(
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
        const cost = object(y);
        keys(cost, ["amount", "unit", "kind", "source"]);
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
export function validateGroup(value: ExecutionGroup): void {
  const v = object(value);
  keys(v, ["groupId", "startedAt", "state", "completion"], CONTEXT);
  assertId(v.groupId);
  context(v);
  const start = instant(v.startedAt);
  if (v.state === "open" && v.completion === null) return;
  if (v.state !== "closed" || v.completion === null)
    throw Error("group_state_invalid");
  const c = object(v.completion);
  keys(c, ["endedAt", "status"]);
  if (
    instant(c.endedAt) < start ||
    !["completed", "failed", "cancelled"].includes(c.status as string)
  )
    throw Error("group_completion_invalid");
}
function exists(file: string): boolean {
  try {
    fs.lstatSync(file);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
function directory(store: StoreOptions): fs.BigIntStats {
  keys(object(store), ["directory", "retentionDays"]);
  if (
    !Number.isSafeInteger(store.retentionDays) ||
    store.retentionDays < 1 ||
    store.retentionDays > 36500 ||
    !path.isAbsolute(store.directory) ||
    path.resolve(store.directory) !== store.directory
  )
    throw Error("store_options_invalid");
  const s = fs.lstatSync(store.directory, { bigint: true });
  const same = (a: string, b: string) =>
    process.platform === "win32"
      ? a.toLowerCase() === b.toLowerCase()
      : a === b;
  if (
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    !same(fs.realpathSync.native(store.directory), store.directory)
  )
    throw Error("store_directory_invalid");
  if (
    fs
      .readdirSync(store.directory)
      .some(
        (name) =>
          !["history.jsonl", "history.pending.jsonl", "history.lock"].includes(
            name,
          ),
      )
  )
    throw Error("store_unknown_residual");
  return s;
}
function sameDirectory(store: StoreOptions, original: fs.BigIntStats) {
  const now = directory(store);
  if (now.dev !== original.dev || now.ino !== original.ino)
    throw Error("store_directory_changed");
}
/** descriptor取得後も上限と元実体を確認し、固定長だけ読む。 */
function readBoundedFile(
  file: string,
  expectedIdentity?: fs.BigIntStats,
): Buffer {
  const before = fs.lstatSync(file, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1n ||
    before.size < 0n ||
    before.size > BigInt(MAX_BYTES) ||
    (expectedIdentity &&
      (before.dev !== expectedIdentity.dev ||
        before.ino !== expectedIdentity.ino))
  )
    throw Error("store_file_invalid");
  const fd = fs.openSync(file, "r");
  try {
    const opened = fs.fstatSync(fd, { bigint: true });
    if (
      !opened.isFile() ||
      opened.nlink !== 1n ||
      opened.size < 0n ||
      opened.size > BigInt(MAX_BYTES) ||
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.size !== before.size ||
      opened.mtimeNs !== before.mtimeNs
    )
      throw Error("store_file_changed");
    const bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const n = fs.readSync(fd, bytes, offset, bytes.length - offset, offset);
      if (!n) throw Error("store_file_changed");
      offset += n;
    }
    const after = fs.fstatSync(fd, { bigint: true }),
      named = fs.lstatSync(file, { bigint: true });
    if (
      after.size !== opened.size ||
      after.mtimeNs !== opened.mtimeNs ||
      after.nlink !== 1n ||
      named.dev !== opened.dev ||
      named.ino !== opened.ino ||
      named.mtimeNs !== opened.mtimeNs ||
      named.isSymbolicLink()
    )
      throw Error("store_file_changed");
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
}
function readHistory(store: StoreOptions): Records {
  const file = path.join(store.directory, "history.jsonl");
  if (!exists(file)) return { executions: [], groups: [] };
  const bytes = readBoundedFile(file);
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (decoded.length && !decoded.endsWith("\n"))
    throw Error("store_history_incomplete");
  const lines = decoded ? decoded.slice(0, -1).split("\n") : [];
  if (lines.length > MAX_RECORDS) throw Error("store_record_limit");
  const records: Records = { executions: [], groups: [] };
  const ids = new Set<string>();
  for (const line of lines) {
    const row = snapshot(JSON.parse(line)) as Row;
    if (row.contract !== CONTRACT)
      throw Error("store_schema_migration_required");
    keys(object(row), ["contract", "kind", "value"]);
    let id: string;
    if (row.kind === "execution") {
      validateExecution(row.value);
      records.executions.push(row.value);
      id = row.value.executionId;
    } else if (row.kind === "group") {
      validateGroup(row.value);
      records.groups.push(row.value);
      id = row.value.groupId;
    } else throw Error("store_record_kind_invalid");
    const key = `${row.kind}:${id}`;
    if (ids.has(key)) throw Error("store_identity_conflict");
    ids.add(key);
  }
  const groups = new Set(records.groups.map((g) => g.groupId));
  if (records.executions.some((e) => e.groupId && !groups.has(e.groupId)))
    throw Error("store_group_reference_missing");
  return records;
}
export function readRecords(input: StoreOptions): ReadResult<Records> {
  try {
    const store = snapshot(input),
      original = directory(store);
    if (
      exists(path.join(store.directory, "history.lock")) ||
      exists(path.join(store.directory, "history.pending.jsonl"))
    )
      throw Error("store_publication_pending");
    const records = readHistory(store);
    sameDirectory(store, original);
    if (
      exists(path.join(store.directory, "history.lock")) ||
      exists(path.join(store.directory, "history.pending.jsonl"))
    )
      throw Error("store_publication_pending");
    return { status: "completed", value: records };
  } catch (error) {
    return {
      status: "blocked",
      reason:
        error instanceof Error && /^[a-z][a-z0-9_]+$/u.test(error.message)
          ? error.message
          : "store_observation_unknown",
    };
  }
}
export function blockedWrite(recordId: string, reason: string): WriteResult {
  return {
    status: "blocked",
    reason,
    recordId: typeof recordId === "string" && ID.test(recordId) ? recordId : "",
    effectState: "no_effect",
    effectIssued: false,
    effectStateUnknown: false,
    cleanupConfirmed: true,
    retryAllowed: false,
    manualRecoveryRequired: false,
    residualArtifactIds: [],
    recoveryReference: null,
  };
}

/** 一操作を同じLock内で検査・保持整理・出版する。操作は用途でなく記録遷移。 */
export function writeRecord(
  input: StoreOptions,
  kind: Row["kind"],
  id: string,
  phase: "create" | "complete",
  value: unknown,
): WriteResult {
  let result = blockedWrite(id, "store_unavailable");
  let lock: ReturnType<typeof acquireHistoryLock> | null = null;
  let pendingOwned = false,
    publicationAttempted = false,
    descriptorClosed = true;
  let rootIdentity: fs.BigIntStats | null = null,
    pendingIdentity: fs.BigIntStats | null = null;
  let store: StoreOptions | null = null;
  try {
    const perform = (): WriteResult => {
      assertId(id);
      store = snapshot(input);
      const original = directory(store);
      rootIdentity = original;
      const data = snapshot(value);
      // 旧SchemaをLock・pending作成前にも検出する。
      const preflight = readRecords(store);
      if (preflight.status !== "completed")
        return blockedWrite(id, preflight.reason);
      lock = acquireHistoryLock(store.directory);
      if (lock.status !== "acquired")
        return {
          ...blockedWrite(id, lock.reason),
          cleanupConfirmed: lock.cleanupConfirmed,
          manualRecoveryRequired: !lock.cleanupConfirmed,
          recoveryReference: lock.cleanupConfirmed ? null : id,
          residualArtifactIds: lock.cleanupConfirmed ? [] : ["history.lock"],
        };
      if (exists(path.join(store.directory, "history.pending.jsonl")))
        throw Error("store_publication_pending");
      const records = readHistory(store);
      const list: (Execution | ExecutionGroup)[] =
        kind === "execution" ? records.executions : records.groups;
      const current = list.find(
        (v) => ("executionId" in v ? v.executionId : v.groupId) === id,
      );
      let candidate: Execution | ExecutionGroup;
      if (phase === "create") {
        if (
          Object.hasOwn(object(data), "state") ||
          Object.hasOwn(object(data), "completion")
        )
          throw Error("record_fields_invalid");
        candidate = { ...object(data), state: "open", completion: null } as
          | Execution
          | ExecutionGroup;
        if (
          (kind === "execution" &&
            (candidate as Execution).executionId !== id) ||
          (kind === "group" && (candidate as ExecutionGroup).groupId !== id)
        )
          throw Error("record_identity_invalid");
        if (current) {
          const {
            state: _state,
            completion: _completion,
            ...created
          } = current;
          if (JSON.stringify(snapshot(created)) !== JSON.stringify(data))
            throw Error("record_identity_conflict");
          return {
            ...blockedWrite(id, "record_already_created"),
            status: "completed",
            effectState: "settled",
          };
        }
      } else {
        if (!current) throw Error("record_not_found");
        if (current.state === "closed") {
          if (
            JSON.stringify(snapshot(current.completion)) !==
            JSON.stringify(data)
          )
            throw Error("record_completion_conflict");
          return {
            ...blockedWrite(id, "record_already_completed"),
            status: "completed",
            effectState: "settled",
          };
        }
        candidate = { ...current, state: "closed", completion: data } as
          | Execution
          | ExecutionGroup;
      }
      if (kind === "execution") {
        const execution = candidate as Execution;
        validateExecution(execution);
        if (
          phase === "create" &&
          execution.groupId &&
          !records.groups.some(
            (g) => g.groupId === execution.groupId && g.state === "open",
          )
        )
          throw Error("group_not_open");
        records.executions = records.executions.filter(
          (e) => e.executionId !== id,
        );
        records.executions.push(execution);
      } else {
        validateGroup(candidate as ExecutionGroup);
        records.groups = records.groups.filter((g) => g.groupId !== id);
        records.groups.push(candidate as ExecutionGroup);
      }
      const cutoff = Date.now() - store.retentionDays * 86400_000;
      records.executions = records.executions.filter(
        (e) =>
          e.completion === null ||
          e.completion?.retention === "unresolved" ||
          e.completion?.outcome.status === "unknown" ||
          Date.parse(e.completion.endedAt) >= cutoff ||
          (kind === "execution" && e.executionId === id),
      );
      const referenced = new Set(records.executions.map((e) => e.groupId));
      records.groups = records.groups.filter(
        (g) =>
          g.completion === null ||
          referenced.has(g.groupId) ||
          Date.parse(g.completion.endedAt) >= cutoff ||
          (kind === "group" && g.groupId === id),
      );
      const rows: Row[] = [
        ...records.groups.map(
          (v) => ({ contract: CONTRACT, kind: "group", value: v }) as Row,
        ),
        ...records.executions.map(
          (v) => ({ contract: CONTRACT, kind: "execution", value: v }) as Row,
        ),
      ];
      const expected = Buffer.from(
        rows.map((row) => `${JSON.stringify(snapshot(row))}\n`).join(""),
      );
      if (rows.length > MAX_RECORDS || expected.length > MAX_BYTES)
        throw Error("store_limit_exceeded");
      sameDirectory(store, original);
      if (!lock.lock.assertLive()) throw Error("store_lock_lost");
      const pending = path.join(store.directory, "history.pending.jsonl"),
        history = path.join(store.directory, "history.jsonl");
      const fd = fs.openSync(pending, "wx", 0o600);
      pendingOwned = true;
      descriptorClosed = false;
      try {
        pendingIdentity = fs.fstatSync(fd, { bigint: true });
        fs.writeFileSync(fd, expected);
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
        descriptorClosed = true;
      }
      if (
        !readBoundedFile(pending, pendingIdentity ?? undefined).equals(expected)
      )
        throw Error("store_pending_readback_mismatch");
      sameDirectory(store, original);
      if (!lock.lock.assertLive()) throw Error("store_lock_lost");
      publicationAttempted = true;
      fs.renameSync(pending, history);
      pendingOwned = false;
      if (
        exists(pending) ||
        !readBoundedFile(history, pendingIdentity ?? undefined).equals(expected)
      )
        throw Error("store_publication_unconfirmed");
      sameDirectory(store, original);
      result = {
        ...blockedWrite(id, "record_saved"),
        status: "completed",
        effectState: "settled",
        effectIssued: true,
      };
      return result;
    };
    result = perform();
  } catch (error) {
    result = {
      ...blockedWrite(
        id,
        error instanceof Error && /^[a-z][a-z0-9_]+$/u.test(error.message)
          ? error.message
          : "store_unavailable",
      ),
      effectState: publicationAttempted ? "unknown" : "no_effect",
      effectIssued: publicationAttempted,
      effectStateUnknown: publicationAttempted,
      recoveryReference: publicationAttempted ? id : null,
      manualRecoveryRequired: publicationAttempted,
    };
  } finally {
    const finalStore = store as StoreOptions | null;
    const finalLock = lock as ReturnType<typeof acquireHistoryLock> | null;
    if (pendingOwned && finalStore) {
      try {
        const root = rootIdentity as fs.BigIntStats | null,
          identity = pendingIdentity as fs.BigIntStats | null;
        if (root && identity && descriptorClosed) {
          sameDirectory(finalStore, root);
          const target = path.join(
              finalStore.directory,
              "history.pending.jsonl",
            ),
            current = fs.lstatSync(target, { bigint: true });
          if (
            current.isFile() &&
            !current.isSymbolicLink() &&
            current.nlink === 1n &&
            current.dev === identity.dev &&
            current.ino === identity.ino
          ) {
            fs.unlinkSync(target);
            pendingOwned = exists(target);
          }
        }
      } catch {
        /* 元Root・元pendingを確認できない場合は別実体を削除しない。 */
      }
    }
    const released =
      finalLock?.status !== "acquired" || finalLock.lock.release();
    if (!released || pendingOwned || !descriptorClosed)
      result = {
        ...result,
        status: "blocked",
        reason: "store_cleanup_unknown",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        recoveryReference: id,
        residualArtifactIds: [
          ...(pendingOwned ? ["history.pending.jsonl"] : []),
          ...(!released ? ["history.lock"] : []),
        ],
      };
  }
  return result;
}

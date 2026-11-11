/**
 * 明示Directory内の単一履歴を検査・出版する。
 * @responsibility 物理実体・容量・JSONL形式、共通排他、保存確認と今回資源の終了処置を所有する。
 * @trace ARCH-000018
 * @boundary 記録規則はrecord側に委ねる。旧形式・未知残存を変換・自動回収しない。
 */
import fs from "node:fs";
import path from "node:path";
import { acquireHistoryLock } from "./lock.ts";
import {
  recordObject,
  assertRecordFields,
  snapshot,
  assertId,
  validRecordId,
  validateExecution,
  validateGroup,
} from "../record/validation.ts";
import { applyRecord, retainRecords } from "../record/operations.ts";
import type {
  Execution,
  ExecutionGroup,
  ReadResult,
  StoreOptions,
  WriteResult,
  Records,
} from "../record/types.ts";

/** v3 JSONLの一行。確定履歴は種別ごとのIDを一意にし、旧Schemaを混在させない。 */
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
const CONTRACT = "execution-intelligence/history/v3";
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_RECORDS = 10_000;

/** ENOENTだけを不存在にし、権限拒否・観測不能は例外として保存Ownerへ返す。 */
function exists(file: string): boolean {
  try {
    fs.lstatSync(file);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw e;
  }
}
/** 明示Storeの所在・非リンク実体・固定File集合を確認する。親の作成や未知残存の削除はしない。 */
function directory(store: StoreOptions): fs.BigIntStats {
  assertRecordFields(recordObject(store), ["directory", "retentionDays"]);
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
/** 取得時と同じDirectory実体であることを再確認し、変更・観測不能では後続処理を止める。 */
function sameDirectory(store: StoreOptions, original: fs.BigIntStats) {
  const now = directory(store);
  if (now.dev !== original.dev || now.ino !== original.ino)
    throw Error("store_directory_changed");
}
/**
 * descriptor取得前後に同じ通常File・上限を照合し、固定長だけ読む。
 * @failure 途中変更・短い読取り・終了不明は例外とし、部分byteを正常履歴へ返さない。
 * @postcondition 今回取得したdescriptorをfinallyで閉じる。他のhandleやPathを回収しない。
 */
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
/** 固定JSONLを検査して記録集合へ戻す。旧Schema・重複・参照欠落はStore全体を拒否し、読み飛ばさない。 */
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
    assertRecordFields(recordObject(row), ["contract", "kind", "value"]);
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
/**
 * 所有Lockやpendingを作らず、読取り前後に出版中とDirectory実体を確認する。
 * @failure 不存在の履歴だけを空集合とする。破損・未知残存・出版中・観測不能はblocked。
 * @effect 固定Fileの読取りだけ。descriptor終了を待ち、記録の整理・再送・回復をしない。
 */
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
/** 出版前の拒否を構成する。未知IDを補完せず、後段で生じたEffect・残存はCallerが上書きする。 */
export function blockedWrite(recordId: string, reason: string): WriteResult {
  return {
    status: "blocked",
    reason,
    recordId: validRecordId(recordId) ? recordId : "",
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

/**
 * 同じLock内のfresh履歴へ記録規則を適用し、pendingを経て出版する。
 * @effect wx取得・書込み・fsync・読戻し・renameと、元pending／Lockの終了処置。
 * @failure 出版前拒否、出版不明、保存済みだが解放不明を分け、同じIDと残存参照を返す。
 * @concurrency 遷移・Group参照・保持判定をLock外へ前倒ししない。旧形式は取得前にも拒否する。
 * @postcondition 自分の元実体だけを回収し、不一致・close不明では保全する。自動再試行しない。
 */
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
      const unchanged = applyRecord(records, kind, id, phase, data);
      if (unchanged)
        return {
          ...blockedWrite(id, unchanged),
          status: "completed",
          effectState: "settled",
        };
      retainRecords(
        records,
        kind,
        id,
        Date.now() - store.retentionDays * 86400_000,
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

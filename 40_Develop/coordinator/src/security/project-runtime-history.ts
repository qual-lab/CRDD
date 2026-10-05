/**
 * Project Runtimeの終了要約を30日保持する保存試行を所有する。
 *
 * @responsibility 現在状態を変更せず履歴の検証、置換、再入場を行う。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
  resolveRepositoryRuntimeDataPathsFromWorkingDirectory,
} from "../../../runtime-data/src/index.ts";
import {
  acquireProjectRuntimeSnapshotPilotLock,
  isLiveProjectRuntimeSnapshotOwner,
  type ProjectRuntimeSnapshotOwner,
} from "./project-runtime-durable-foundation.ts";

const CONTRACT = "crdd-coordinator/project-runtime-history-pilot/v1";
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const HASH = /^[0-9a-f]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/**
 * 終了要約の固定値を定義する。
 *
 * @responsibility 自由記述を持たない履歴の値契約を所有する。
 * @trace ARCH-000004
 * @shape id、occurredAt、outcome、primaryFailure、cleanup。
 * @invariant 制御状態やAuthorityを含まない。
 * @boundary 履歴保存境界。
 * @security Prompt、秘密値、Pathを許可しない。
 * @compatibility 試行契約であり現在のPortを置換しない。
 */
export type HistoryRow = Readonly<{
  id: string;
  occurredAt: string;
  outcome: "completed" | "failed" | "cancelled";
  primaryFailure:
    | null
    | "execution"
    | "storage"
    | "delivery"
    | "cleanup"
    | "cancel";
  cleanup: "confirmed" | "unknown" | "not_required";
}>;

/**
 * 履歴の保存情報を定義する。
 *
 * @responsibility 変更前と候補の相関を固定する。
 * @trace ARCH-000004
 * @shape contract、revision、rootHash、baseHash、rowsHash、writtenAt。
 * @invariant 保存候補は一つの変更前Hashへ結合する。
 * @boundary Repository内の履歴。
 * @security HashはAuthorityではない。
 * @compatibility 試行契約名に結合する。
 */
type HistoryHeader = Readonly<{
  contract: typeof CONTRACT;
  revision: number;
  rootHash: string;
  baseHash: string | null;
  rowsHash: string;
  writtenAt: string;
}>;

/**
 * JSONの閉じたProperty集合を確認する。
 *
 * @responsibility 未知のPropertyや配列を拒否する。
 * @trace ARCH-000004
 * @input 未検証値と許可Key。
 * @returns 閉じたObject。
 * @precondition JSONから得た値。
 * @postcondition Keyの過不足を拒否済み。
 * @effect N/A: 局所値のみ。
 * @failure 不正shapeで例外。
 * @invariant 未知値を既知へ畳まない。
 * @boundary JSON入力。
 * @security 許可外情報を保存しない。
 * @concurrency N/A: 同期判定。
 */
function closedObject(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("shape");
  const record = value as Record<string, unknown>;
  const actualKeys = Object.keys(record).sort();
  if (JSON.stringify(actualKeys) !== JSON.stringify([...keys].sort()))
    throw new Error("keys");
  return record;
}

/**
 * UTC時刻を検証する。
 *
 * @responsibility 不正値と未来時刻を拒否する。
 * @trace ARCH-000004
 * @input ISO時刻と現在時刻。
 * @returns 検証済みISO時刻。
 * @precondition 現在時刻は安全な整数。
 * @postcondition 正規UTC表現で未来ではない。
 * @effect N/A: 局所値のみ。
 * @failure 時刻不正で例外。
 * @invariant 時計逆行を期限切れへ畳まない。
 * @boundary 保存時刻。
 * @security 時刻からAuthorityを発行しない。
 * @concurrency N/A: 同期判定。
 */
function timestamp(value: unknown, now: number): string {
  if (typeof value !== "string") throw new Error("time");
  const milliseconds = Date.parse(value);
  if (
    !Number.isSafeInteger(milliseconds) ||
    new Date(milliseconds).toISOString() !== value ||
    milliseconds > now
  )
    throw new Error("time");
  return value;
}

/**
 * 終了要約を固定順序へ検証する。
 *
 * @responsibility 保存可能な分類だけを受け入れる。
 * @trace ARCH-000004
 * @input JSON値と現在時刻。
 * @returns 閉じた終了要約。
 * @precondition 入力はJSON由来。
 * @postcondition ID、時刻、分類を検証済み。
 * @effect N/A: 局所値のみ。
 * @failure 許可外値で例外。
 * @invariant 未解決義務を履歴へ移さない。
 * @boundary 終了要約入力。
 * @security 自由記述や秘密値を拒否する。
 * @concurrency N/A: 同期判定。
 */
export function historyRow(value: unknown, now: number): HistoryRow {
  const row = closedObject(value, [
    "id",
    "occurredAt",
    "outcome",
    "primaryFailure",
    "cleanup",
  ]);
  if (typeof row.id !== "string" || !ID.test(row.id)) throw new Error("id");
  if (
    row.outcome !== "completed" &&
    row.outcome !== "failed" &&
    row.outcome !== "cancelled"
  )
    throw new Error("outcome");
  if (
    row.primaryFailure !== null &&
    row.primaryFailure !== "execution" &&
    row.primaryFailure !== "storage" &&
    row.primaryFailure !== "delivery" &&
    row.primaryFailure !== "cleanup" &&
    row.primaryFailure !== "cancel"
  )
    throw new Error("failure");
  if (
    row.cleanup !== "confirmed" &&
    row.cleanup !== "unknown" &&
    row.cleanup !== "not_required"
  )
    throw new Error("cleanup");
  return {
    id: row.id,
    occurredAt: timestamp(row.occurredAt, now),
    outcome: row.outcome,
    primaryFailure: row.primaryFailure,
    cleanup: row.cleanup,
  };
}

/**
 * 履歴を行単位で読み取る。
 *
 * @responsibility 部分行、alias、読取り中の置換を拒否する。
 * @trace ARCH-000004
 * @input exact File Path。
 * @returns 終端改行を持つASCII行。
 * @precondition Root内の履歴名。
 * @postcondition 全行読取り時に同じFile実体を確認する。
 * @effect 読取りhandleを開き、finallyで閉じる。
 * @failure 非通常File、破損、置換で例外。
 * @invariant 全体をメモリへ読み込まない。
 * @boundary Filesystem。
 * @security symbolic linkとhard linkを拒否する。
 * @concurrency 呼出し元がRoot排他を保持する。
 */
function* lines(file: string): Generator<string> {
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
    throw new Error("file");
  const fd = fs.openSync(file, "r");
  try {
    const opened = fs.fstatSync(fd);
    if (opened.ino !== before.ino || opened.dev !== before.dev)
      throw new Error("identity");
    const buffer = Buffer.alloc(4096);
    let remainder = "";
    let count = fs.readSync(fd, buffer);
    while (count > 0) {
      const chunk = buffer.subarray(0, count);
      for (const byte of chunk)
        if (byte !== 10 && (byte < 32 || byte > 126))
          throw new Error("encoding");
      remainder += chunk.toString("ascii");
      let end = remainder.indexOf("\n");
      while (end >= 0) {
        const line = remainder.slice(0, end);
        if (!line || line.length > 2048) throw new Error("line");
        yield line;
        remainder = remainder.slice(end + 1);
        end = remainder.indexOf("\n");
      }
      if (remainder.length > 2048) throw new Error("line");
      count = fs.readSync(fd, buffer);
    }
    if (remainder) throw new Error("partial");
    const after = fs.lstatSync(file);
    if (
      after.ino !== before.ino ||
      after.dev !== before.dev ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs ||
      after.isSymbolicLink() ||
      after.nlink !== 1
    )
      throw new Error("changed");
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * 全履歴を削除判断の前に検証する。
 *
 * @responsibility 保存情報、全行Hash、重複IDを検証する。
 * @trace ARCH-000004
 * @input exact Path、Root Hash、現在時刻、要約観測callback。
 * @returns 検証済み保存情報と全体Hash。
 * @precondition Root排他を保持する。
 * @postcondition 期限外を含め全行を検証済み。
 * @effect 読取りのみ。
 * @failure 不正Header、行、Hash、重複で例外。
 * @invariant 破損を期限切れとして捨てない。
 * @boundary 履歴File。
 * @security 許可外Propertyを拒否する。
 * @concurrency 同じ排他Ownerで走査する。
 */
function scan(
  file: string,
  rootHash: string,
  now: number,
  observe: (row: HistoryRow, line: string) => void,
) {
  const full = createHash("sha256");
  const rows = createHash("sha256");
  let header: HistoryHeader | null = null;
  const ids = new Set<string>();
  for (const line of lines(file)) {
    full.update(`${line}\n`);
    if (!header) {
      const value = closedObject(JSON.parse(line), [
        "contract",
        "revision",
        "rootHash",
        "baseHash",
        "rowsHash",
        "writtenAt",
      ]);
      if (
        value.contract !== CONTRACT ||
        value.rootHash !== rootHash ||
        typeof value.revision !== "number" ||
        !Number.isSafeInteger(value.revision) ||
        value.revision < 1 ||
        typeof value.rowsHash !== "string" ||
        !HASH.test(value.rowsHash) ||
        (value.baseHash !== null &&
          (typeof value.baseHash !== "string" || !HASH.test(value.baseHash)))
      )
        throw new Error("header");
      header = {
        contract: CONTRACT,
        revision: value.revision,
        rootHash,
        baseHash: value.baseHash,
        rowsHash: value.rowsHash,
        writtenAt: timestamp(value.writtenAt, now),
      };
      if (JSON.stringify(header) !== line) throw new Error("canonical");
    } else {
      const row = historyRow(JSON.parse(line), now);
      if (
        JSON.stringify(row) !== line ||
        ids.has(row.id) ||
        Date.parse(row.occurredAt) > Date.parse(header.writtenAt)
      )
        throw new Error("duplicate");
      ids.add(row.id);
      rows.update(`${line}\n`);
      observe(row, line);
    }
  }
  if (!header || rows.digest("hex") !== header.rowsHash)
    throw new Error("hash");
  return { header, hash: full.digest("hex") };
}

/**
 * 再入場したFileの書込み確定を要求する。
 *
 * @responsibility 前回fsync失敗を読取り成功だけで補完しない。
 * @trace ARCH-000004
 * @input Root内のexact履歴または候補Path。
 * @returns N/A: 確定不能は例外で返す。
 * @precondition 全行検証済みでRoot排他を保持する。
 * @postcondition 同じ単一File handleのfsyncが成功した。
 * @effect File handleを開きfsync後に閉じる。
 * @failure alias、実体変更、fsync失敗で停止する。
 * @invariant 内容を変更しない。
 * @boundary Windows Filesystem。
 * @security hard linkとsymbolic linkを拒否する。
 * @concurrency 同じ排他Ownerだけが呼ぶ。
 */
function flushRecoveredFile(file: string): void {
  const before = fs.lstatSync(file);
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1)
    throw new Error("file");
  const fd = fs.openSync(file, "r+");
  try {
    const opened = fs.fstatSync(fd);
    if (
      opened.ino !== before.ino ||
      opened.dev !== before.dev ||
      opened.nlink !== 1
    )
      throw new Error("identity");
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * 通常履歴を30日分へ置換し、中断候補へ再入場する。
 *
 * @responsibility Repository結合した一Writerで保存確認を行う。
 * @trace ARCH-000004
 * @input 発行済みOwner、終了要約JSONまたはnull、評価時刻。
 * @returns 履歴保存を確認した結果、または停止理由。借用Ownerは解放しない。
 * @precondition 旧Writerへ未接続の保存試行である。
 * @postcondition completedではread-backとpending不存在を確認済み。
 * @effect 履歴と短命置換候補だけを作成・置換・回収する。
 * @failure 不整合は候補を保持して停止する。
 * @invariant state、Queue、候補本体、Evidenceを削除しない。
 * @boundary 検証済みRepository内のproject-runtime。
 * @security 期限だけで由来不明Fileを削除しない。
 * @concurrency 同Rootの既存Named Pipe排他を借用し、自身では取得・解放しない。
 */
export function updateProjectRuntimeHistoryOwned(
  lock: ProjectRuntimeSnapshotOwner,
  recordJson: string | null,
  now = Date.now(),
) {
  if (!isLiveProjectRuntimeSnapshotOwner(lock))
    return {
      status: "blocked" as const,
      reason: "project_runtime_history_owner_invalid",
    };
  let result = {
    status: "blocked" as "blocked" | "completed",
    reason: "project_runtime_history_invalid",
  };
  try {
    if (
      !Number.isSafeInteger(now) ||
      now < RETENTION_MS ||
      now > 8_640_000_000_000_000
    )
      throw new Error("clock");
    if (
      recordJson !== null &&
      (typeof recordJson !== "string" || recordJson.length > 2048)
    )
      throw new Error("input");
    const incoming =
      recordJson === null ? null : historyRow(JSON.parse(recordJson), now);
    const resolved = resolveRepositoryRuntimeDataPathsFromWorkingDirectory(
      lock.repositoryRoot,
    );
    if (!resolved || resolved.repositoryRoot !== lock.repositoryRoot)
      throw new Error("root_binding");
    const area = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        lock.repositoryRoot,
        "project-runtime",
      ),
      "project_runtime_history_root_invalid",
    );
    const root = fs.realpathSync.native(area.repositoryRoot);
    const directory = fs.realpathSync.native(area.directory);
    if (
      directory !== area.directory ||
      fs.lstatSync(directory).isSymbolicLink()
    )
      throw new Error("root");
    const rootHash = createHash("sha256")
      .update(`crdd-project-runtime-verified-root-v1\0${root.toLowerCase()}`)
      .digest("hex");
    if (root !== lock.repositoryRoot || rootHash !== lock.repositoryRootHash)
      throw new Error("root_binding");
    const current = path.join(directory, "history.jsonl");
    const pending = path.join(directory, "history.pending.jsonl");
    // ENOENTだけを不存在とし、その他の観測失敗は停止へ伝える。
    /**
     * 真正不存在だけを区別する。
     * @responsibility 観測不能をfalseへ畳まない。
     * @trace ARCH-000004
     * @input Root内のexact Path。
     * @returns 存在の真偽。
     * @precondition Rootを検証済み。
     * @postcondition falseはENOENTだけ。
     * @effect 読取り観測のみ。
     * @failure その他の観測例外を伝搬する。
     * @invariant 観測不能を保持する。
     * @boundary Filesystem。
     * @security 存在をAuthorityへ昇格しない。
     * @concurrency Root排他下。
     */
    const exists = (file: string) => {
      try {
        fs.lstatSync(file);
        return true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw error;
      }
    };
    /**
     * 保存OwnerとRootの継続を確認する。
     * @responsibility 排他喪失後の書込みを拒否する。
     * @trace ARCH-000004
     * @input N/A: 取得時の結合を閉包で保持する。
     * @returns N/A: 継続不能は例外。
     * @precondition 取得時Rootと保存先を照合済み。
     * @postcondition 同Rootと保持handleが有効。
     * @effect Rootの再観測のみ。
     * @failure Root変更、alias、排他喪失で例外。
     * @invariant 別Rootへ書き込まない。
     * @boundary RootとOS排他。
     * @security Authorityを拡張しない。
     * @concurrency 単一Writerを保持する。
     */
    const assertOwner = () => {
      if (
        !lock.assertLive() ||
        fs.realpathSync.native(area.repositoryRoot) !== root ||
        fs.realpathSync.native(area.directory) !== directory ||
        fs.lstatSync(area.directory).isSymbolicLink()
      )
        throw new Error("owner");
    };
    if (exists(pending)) {
      const candidate = scan(pending, rootHash, now, () => {});
      const previous = exists(current)
        ? scan(current, rootHash, now, () => {})
        : null;
      assertOwner();
      if (previous?.hash === candidate.hash) {
        flushRecoveredFile(current);
        assertOwner();
        fs.unlinkSync(pending);
      } else if ((previous?.hash ?? null) === candidate.header.baseHash) {
        flushRecoveredFile(pending);
        assertOwner();
        fs.renameSync(pending, current);
      } else throw new Error("conflict");
      if (
        scan(current, rootHash, now, () => {}).hash !== candidate.hash ||
        exists(pending)
      )
        throw new Error("readback");
    }
    const retained = createHash("sha256");
    let isDuplicate = false;
    const old = exists(current)
      ? scan(current, rootHash, now, (row, line) => {
          if (incoming?.id === row.id) {
            if (JSON.stringify(incoming) !== line) throw new Error("conflict");
            isDuplicate = true;
          }
          if (Date.parse(row.occurredAt) >= now - RETENTION_MS)
            retained.update(`${line}\n`);
        })
      : null;
    const add =
      incoming &&
      !isDuplicate &&
      Date.parse(incoming.occurredAt) >= now - RETENTION_MS
        ? `${JSON.stringify(incoming)}\n`
        : "";
    retained.update(add);
    const header: HistoryHeader = {
      contract: CONTRACT,
      revision: (old?.header.revision ?? 0) + 1,
      rootHash,
      baseHash: old?.hash ?? null,
      rowsHash: retained.digest("hex"),
      writtenAt: new Date(now).toISOString(),
    };
    if (!Number.isSafeInteger(header.revision)) throw new Error("revision");
    assertOwner();
    const fd = fs.openSync(pending, "wx", 0o600);
    try {
      fs.writeFileSync(fd, `${JSON.stringify(header)}\n`, "utf8");
      if (
        old &&
        scan(current, rootHash, now, (row, line) => {
          if (Date.parse(row.occurredAt) >= now - RETENTION_MS)
            fs.writeFileSync(fd, `${line}\n`, "utf8");
        }).hash !== old.hash
      )
        throw new Error("changed");
      if (add) fs.writeFileSync(fd, add, "utf8");
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    const candidate = scan(pending, rootHash, now, () => {});
    assertOwner();
    if (
      (exists(current) ? scan(current, rootHash, now, () => {}).hash : null) !==
      header.baseHash
    )
      throw new Error("conflict");
    fs.renameSync(pending, current);
    if (
      scan(current, rootHash, now, () => {}).hash !== candidate.hash ||
      exists(pending)
    )
      throw new Error("readback");
    result = { status: "completed", reason: "project_runtime_history_saved" };
  } catch {
    result = { status: "blocked", reason: "project_runtime_history_invalid" };
  }
  return result;
}

/**
 * 単独の履歴保存を取得・保存・解放へ閉じる。
 * @responsibility 従来の単独入口の排他終了確認を維持する。
 * @trace ARCH-000004
 * @input workingDirectory、要約JSONまたはnull、評価時刻。
 * @returns 保存と解放の確認結果。
 * @precondition 検証できるRepositoryである。
 * @postcondition 借用本体の結果を解放確認後に返す。
 * @effect 履歴と短命pendingを更新する。
 * @failure 取得、保存、解放失敗は停止する。
 * @invariant 現在状態を削除しない。
 * @boundary RepositoryとOS排他。
 * @security 偽造Ownerへ保存を委譲しない。
 * @concurrency 同Rootの一Writerを保持する。
 */
export function updateProjectRuntimeHistoryPilot(
  workingDirectory: string,
  recordJson: string | null,
  now = Date.now(),
) {
  const acquired = acquireProjectRuntimeSnapshotPilotLock(workingDirectory);
  if (acquired.status !== "completed")
    return { status: "blocked" as const, reason: acquired.reason };
  const result = updateProjectRuntimeHistoryOwned(
    acquired.value,
    recordJson,
    now,
  );
  return acquired.value.release()
    ? result
    : {
        status: "blocked" as const,
        reason: "project_runtime_history_lock_release_unknown",
      };
}

/**
 * 未搬送要約の保存確定と期限処置を区別する。
 * @responsibility 現在状態から除去する前の履歴証拠を確認する。
 * @trace ARCH-000004
 * @input 発行済みOwner、exact要約、評価時刻。
 * @returns recorded、expired、または未確定のnull。
 * @precondition 同Rootの短期Ownerを保持する。
 * @postcondition 期限内は同内容行を確認済み、期限外は保存時の期限評価を確認済み。
 * @effect 固定履歴の読取りのみ。
 * @failure 破損、異内容、pending、観測不能はnull。
 * @invariant 履歴成功を未解決回復の削除許可にしない。
 * @boundary 現在状態と通常履歴。
 * @security 要約IDだけでは搬送済みとしない。
 * @concurrency 同じ発行済みOwnerを借用する。
 */
export function inspectProjectRuntimeHistorySettlement(
  lock: ProjectRuntimeSnapshotOwner,
  row: HistoryRow,
  now = Date.now(),
): "recorded" | "expired" | null {
  if (!isLiveProjectRuntimeSnapshotOwner(lock)) return null;
  try {
    const directory = path.join(
      lock.repositoryRoot,
      ".crdd",
      "project-runtime",
    );
    for (const parent of [path.dirname(directory), directory]) {
      if (
        fs.realpathSync.native(parent) !== parent ||
        !fs.lstatSync(parent).isDirectory() ||
        fs.lstatSync(parent).isSymbolicLink()
      )
        return null;
    }
    try {
      fs.lstatSync(path.join(directory, "history.pending.jsonl"));
      return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return null;
    }
    const expected = JSON.stringify(historyRow(row, now));
    let isMatched = false;
    const saved = scan(
      path.join(directory, "history.jsonl"),
      lock.repositoryRootHash,
      now,
      (item, line) => {
        if (item.id === row.id) {
          if (line !== expected) throw new Error("history_identity_conflict");
          isMatched = true;
        }
      },
    );
    if (!isLiveProjectRuntimeSnapshotOwner(lock)) return null;
    if (isMatched) return "recorded";
    if (Date.parse(row.occurredAt) >= now - RETENTION_MS) return null;
    return !isMatched &&
      Date.parse(row.occurredAt) <
        Date.parse(saved.header.writtenAt) - RETENTION_MS
      ? "expired"
      : null;
  } catch {
    return null;
  }
}

/**
 * CoordinatorのTask終了要約を共通履歴へ保存する。
 * @responsibility 技術要約と同じ保存Root・短期Owner・保持設定で履歴を確定する。
 * @trace ARCH-000004、ARCH-000008
 */
import fs from "node:fs";
import path from "node:path";
import {
  observeRepositoryRuntimeDataArea,
  readCoordinatorConfig,
} from "../../../domain-model/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  decodeCoordinatorHistoryRows,
  encodeCoordinatorStateValue,
  historyRow,
  prepareCoordinatorHistoryRetention,
  type HistoryRow,
} from "./model.ts";
import {
  acquireCoordinatorStorageOwner,
  isLiveCoordinatorStorageOwner,
  readCoordinatorStorageSnapshotOwned,
  type CoordinatorStorageOwner,
} from "./settlement-store.ts";
export { type HistoryRow, historyRow } from "./model.ts";

/**
 * 共通履歴の実体を固定して読み取る。
 * @responsibility 不存在と観測不能、aliasと通常Fileを区別する。
 * @trace ARCH-000004
 * @input file: 検証済みRoot内のexact Path。
 * @returns 安定したbyte、又は真正不存在のnull。
 * @precondition 保存Ownerを保持する。
 * @postcondition 開いた実体と読取り前後の同一性を確認する。
 * @effect Fileを読みfinallyでhandleを閉じる。
 * @failure 置換・link・過大・観測不能で例外。
 * @invariant 不明を空履歴へ畳まない。
 * @boundary Filesystemと履歴codec。
 * @security link先へ追従しない。
 * @concurrency 同じ短期Owner内で使用する。
 */
function readHistoryFile(file: string): Buffer | null {
  let before: fs.Stats;
  try {
    before = fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.nlink !== 1 ||
    before.size > 16 * 1024 * 1024
  )
    throw new Error("history_file_invalid");
  const fd = fs.openSync(file, "r");
  try {
    const opened = fs.fstatSync(fd);
    if (opened.dev !== before.dev || opened.ino !== before.ino)
      throw new Error("history_file_replaced");
    const bytes = fs.readFileSync(fd);
    const after = fs.lstatSync(file);
    if (
      !after.isFile() ||
      after.isSymbolicLink() ||
      after.nlink !== 1 ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeMs !== before.mtimeMs
    )
      throw new Error("history_file_changed");
    return bytes;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Task要約を共通履歴の閉じた行へ変換する。
 * @responsibility 技術操作の回復参照とTask要約IDの名前空間を分離する。
 * @trace ARCH-000004
 * @input row: 検査済み要約。
 * @returns 正規UTF-8の一行。
 * @precondition historyRow検査を完了している。
 * @postcondition 自由文や秘密値を追加しない。
 * @effect N/A: 同期変換。
 * @failure 値の符号化失敗は例外。
 * @invariant 同じIDと本文は同じbyteとなる。
 * @boundary Task要約と共通履歴。
 * @security 要約をAuthorityへ昇格しない。
 * @concurrency N/A: 純粋処理。
 */
function taskHistoryLine(row: HistoryRow): Buffer {
  return Buffer.from(
    `${encodeCoordinatorStateValue({
      schema: "crdd-coordinator/history-row/v2",
      occurredAt: row.occurredAt,
      summary: { schema: "crdd-coordinator/task-summary/v1", record: row },
    })}\n`,
  );
}

/**
 * Task要約を同じ保存Ownerで共通履歴へ確定する。
 * @responsibility 全行検査・保持期間・中断候補の完全一致・読戻しを接続する。
 * @trace ARCH-000004、ARCH-000008
 * @input owner: 真正保存Owner、recordJson: 一要約・同一保存意図の要約配列又はnull、now: 評価時刻。
 * @returns 履歴確定結果。借用Ownerは解放しない。
 * @precondition 統一state.jsonを初期化済み。
 * @postcondition completedでは確定履歴とpending不存在を観測済み。
 * @effect history.pending.jsonl作成・flush・rename・読戻し。
 * @failure 不一致・破損・不明では候補を保持して停止する。
 * @invariant 未搬送要約と未確認技術履歴は期間だけで削除しない。
 * @boundary 共通履歴と単一保存Root。
 * @security 任意Path・外部callbackを受け付けない。
 * @concurrency 同じOwnerを借用し外部待機をしない。
 */
export function updateCoordinatorHistoryOwned(
  owner: CoordinatorStorageOwner,
  recordJson: string | null,
  now = Date.now(),
) {
  const blocked = {
    status: "blocked" as const,
    reason: "coordinator_history_unconfirmed",
  };
  if (
    !isLiveCoordinatorStorageOwner(owner) ||
    !Number.isSafeInteger(now) ||
    now < 0 ||
    now > 8_640_000_000_000_000
  )
    return blocked;
  try {
    const root = verifyRepositoryRoot(owner.repositoryRoot);
    if (root.status !== "completed") return blocked;
    const area = observeRepositoryRuntimeDataArea(
      root.capability,
      "coordinator",
    );
    const policy = readCoordinatorConfig(root.capability);
    const state = readCoordinatorStorageSnapshotOwned(owner, "history");
    if (
      area.status !== "ready" ||
      policy.status !== "ready" ||
      state.status !== "completed" ||
      !state.value
    )
      return blocked;
    const directory = area.directory;
    const stateBytes = Buffer.from(
      `${encodeCoordinatorStateValue(state.value.snapshot)}\n`,
    );
    const currentFile = path.join(directory, "history.jsonl"),
      pendingFile = path.join(directory, "history.pending.jsonl");
    const assertOwner = () => {
      const fresh = observeRepositoryRuntimeDataArea(
        root.capability,
        "coordinator",
      );
      const config = readCoordinatorConfig(root.capability);
      if (
        !isLiveCoordinatorStorageOwner(owner) ||
        fresh.status !== "ready" ||
        fresh.boundaryIdentity !== area.boundaryIdentity ||
        !readHistoryFile(path.join(directory, "state.json"))?.equals(
          stateBytes,
        ) ||
        config.status !== "ready" ||
        config.config.historyRetentionDays !==
          policy.config.historyRetentionDays
      )
        throw new Error("history_owner_changed");
    };
    const before = readHistoryFile(currentFile) ?? Buffer.alloc(0);
    const rows = decodeCoordinatorHistoryRows(before);
    if (!rows || rows.some((row) => Date.parse(row.occurredAt) > now))
      return blocked;
    const parsed: unknown = recordJson === null ? [] : JSON.parse(recordJson);
    const incoming = Array.isArray(parsed) ? parsed : [parsed];
    const known = new Map<string, Buffer>(
      rows.map((row) => [row.recoveryId, Buffer.from(row.line)]),
    );
    const additions: Buffer[] = [];
    for (const value of incoming) {
      const record = historyRow(value, now);
      const line = taskHistoryLine(record);
      const id = `task-history.${record.id}`;
      const same = known.get(id);
      if (same && !line.equals(same)) return blocked;
      if (!same) {
        known.set(id, line);
        additions.push(line);
      }
    }
    const joined = additions.length
      ? Buffer.concat([before, ...additions])
      : before;
    const after = prepareCoordinatorHistoryRetention(
      stateBytes,
      joined,
      new Date(now).toISOString(),
      policy.config.historyRetentionDays,
      owner.repositoryBinding,
    );
    if (!after) return blocked;
    const pending = readHistoryFile(pendingFile);
    if (pending && !pending.equals(after)) return blocked;
    assertOwner();
    if (!after.equals(before)) {
      if (!pending) {
        const fd = fs.openSync(pendingFile, "wx", 0o600);
        try {
          fs.writeFileSync(fd, after);
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      }
      if (
        !readHistoryFile(pendingFile)?.equals(after) ||
        !(readHistoryFile(currentFile) ?? Buffer.alloc(0)).equals(before)
      )
        return blocked;
      assertOwner();
      const fd = fs.openSync(pendingFile, "r+");
      try {
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      if (!readHistoryFile(pendingFile)?.equals(after)) return blocked;
      assertOwner();
      fs.renameSync(pendingFile, currentFile);
    } else if (pending) {
      assertOwner();
      fs.unlinkSync(pendingFile);
    }
    if (
      !(readHistoryFile(currentFile) ?? Buffer.alloc(0)).equals(after) ||
      readHistoryFile(pendingFile) !== null
    )
      return blocked;
    assertOwner();
    return {
      status: "completed" as const,
      reason: "coordinator_history_saved",
    };
  } catch {
    return blocked;
  }
}

/**
 * 単独履歴要求を共通Ownerの取得・保存・一回解放へ閉じる。
 * @responsibility 借用保存と外側の解放を分離する。
 * @trace ARCH-000004
 * @input workingDirectory: Repository内、recordJson: 要約又はnull、now: 評価時刻。
 * @returns 保存と解放の確認結果。
 * @precondition Repositoryを検証できる。
 * @postcondition completedではOwnerを解放済み。
 * @effect 共通短期排他と履歴保存。
 * @failure 取得・保存・解放不明はblocked。
 * @invariant stateと保持物を削除しない。
 * @boundary 公開履歴入口と保存Owner。
 * @security 保存Rootを入力Pathから直接構築しない。
 * @concurrency 外部待機を含めない。
 */
export function updateCoordinatorHistoryPilot(
  workingDirectory: string,
  recordJson: string | null,
  now = Date.now(),
) {
  const owner = acquireCoordinatorStorageOwner(workingDirectory);
  if (!owner)
    return {
      status: "blocked" as const,
      reason: "coordinator_history_owner_unavailable",
    };
  const result = updateCoordinatorHistoryOwned(owner, recordJson, now);
  return owner.release()
    ? result
    : {
        status: "blocked" as const,
        reason: "coordinator_history_owner_release_unknown",
      };
}

/**
 * stateから除去するTask要約の確定行を確認する。
 * @responsibility 期限推定ではなく同じ本文の実保存を確認する。
 * @trace ARCH-000004
 * @input owner: 真正保存Owner、row: exact要約、now: 評価時刻。
 * @returns recorded又は観測不能のnull。
 * @precondition 同Rootの短期排他を保持する。
 * @postcondition 記録済みの場合は全履歴検査と同内容行を確認済み。
 * @effect 履歴とRootの読取りだけ。
 * @failure pending・破損・別本文・観測不能はnull。
 * @invariant historyPendingが保護されるため期限だけで搬送済みにしない。
 * @boundary 現在状態と履歴。
 * @security IDだけを根拠にしない。
 * @concurrency 同じOwnerを借用する。
 */
export function inspectCoordinatorHistorySettlement(
  owner: CoordinatorStorageOwner,
  row: HistoryRow,
  now = Date.now(),
): "recorded" | "expired" | null {
  if (!isLiveCoordinatorStorageOwner(owner)) return null;
  try {
    const root = verifyRepositoryRoot(owner.repositoryRoot);
    if (root.status !== "completed") return null;
    const area = observeRepositoryRuntimeDataArea(
      root.capability,
      "coordinator",
    );
    const policy = readCoordinatorConfig(root.capability);
    if (
      area.status !== "ready" ||
      policy.status !== "ready" ||
      readHistoryFile(path.join(area.directory, "history.pending.jsonl")) !==
        null
    )
      return null;
    const rows = decodeCoordinatorHistoryRows(
      readHistoryFile(path.join(area.directory, "history.jsonl")) ??
        Buffer.alloc(0),
    );
    const expected = taskHistoryLine(historyRow(row, now));
    const matched = rows?.some(
      (item) =>
        item.recoveryId === `task-history.${row.id}` &&
        expected.equals(Buffer.from(item.line)),
    );
    const final = observeRepositoryRuntimeDataArea(
      root.capability,
      "coordinator",
    );
    const finalPolicy = readCoordinatorConfig(root.capability);
    return matched &&
      finalPolicy.status === "ready" &&
      finalPolicy.config.historyRetentionDays ===
        policy.config.historyRetentionDays &&
      final.status === "ready" &&
      final.boundaryIdentity === area.boundaryIdentity &&
      isLiveCoordinatorStorageOwner(owner)
      ? "recorded"
      : null;
  } catch {
    return null;
  }
}

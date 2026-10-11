/**
 * Access Managementの単一現在状態を既存Root・Lockで保存する。
 * @packageDocumentation
 * @responsibility 完全Snapshotの読取り、通常更新と出版途中の照合を所有する。
 * @trace ARCH-000013
 */
import fs from "node:fs";
import crypto, { createHash } from "node:crypto";
import { evaluateHostInitializationState } from "../initialization/state-evaluation.ts";
import {
  type FilesystemStoreRoot,
  resolveFilesystemStorePath,
  readStableBoundedFileSnapshot,
  withFilesystemStoreLock,
  observeFilesystemStoreLockOwnerAbsence,
  recoverFilesystemStoreLock,
} from "../../../domain-model/src/index.ts";
import {
  type AccessManagementState,
  parseAccessManagementState,
} from "./parse.ts";

const CURRENT = "access-management.json";
const PENDING = "access-management.pending.json";
const REPLACE = "access-management.replace.json";
const LOCK = "access-management.lock";
const CURRENT_LIMIT = 16_777_216;
const PENDING_LIMIT = 17_825_792;
const HASH = /^[a-f0-9]{64}$/u;
const ATTEMPT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

/**
 * 初回相関の完全な基準状態を構築する。
 * @responsibility 初期Roleと空集合を一つの固定候補にする。
 * @trace ARCH-000013
 * @input 検査済み元試行UUID。
 * @returns revision1の所有Snapshot。
 * @precondition 内部Ownerがprimitive入力を検査済み。
 * @postcondition 操作IDと元試行が一致する。
 * @effect N/A: メモリ値だけ。
 * @failure N/A: 固定形状の構築のみ。
 * @invariant User・資格・登録・公開・交換は空。
 * @boundary 初回相関と初期状態。
 * @security Secret・認可Authorityは生成しない。
 * @concurrency N/A: 局所値だけ。
 */
function initialBaseline(attemptId: string): AccessManagementState {
  return {
    contract: "crdd-access-management/state",
    schemaRevision: 1,
    revision: 1,
    operationId: attemptId,
    users: [],
    credentials: [],
    registeredRepositories: [],
    exposure: [],
    unresolvedKeyExchanges: [],
    roleContentAccess: [
      { role: "developer", workspaceIds: ["development"] },
      { role: "manager", workspaceIds: ["development", "management"] },
      { role: "administrator", workspaceIds: [] },
    ],
    initialization: { stage: "correlated", attemptId },
  };
}

/**
 * 初回の元試行だけを排他的に保存・再観測する。
 * @responsibility 完全な同元試行baselineと未初期化・破損を分離する。
 * @trace ARCH-000013
 * @input 既存Root、元試行UUID、明示開始、旧管理状態と進行記録の観測tuple。
 * @returns 相関読戻し済みの改訂・元試行・新規作成有無、または未完了。
 * @precondition 信頼済みHostの内部Ownerだけが呼ぶ。旧入力は同じLockで安定化するか書込み不能である。観測callbackは同期read-onlyで、Promise・外部／永続Effect・UUID・鍵・別Store更新・応答を行わない。
 * @postcondition 新規または同元試行の完全baseline読戻し後だけcompletedを返す。
 * @effect Lock取得・排他的current作成・読取り。User UUID・鍵・Root準備は行わない。
 * @failure 別試行・途中材料・partial current・旧観測不明・保存失敗は保持停止。
 * @invariant 既存currentを置換・修復・削除せず、元試行をAuthorityへ変換しない。
 * @boundary AM内部初回保存Ownerと既存Filesystem保存部品。
 * @security 生Secret・Verifier・Pathを公開しない。鍵操作は未接続。
 * @concurrency 同じLock内で観測一回、wxで採用一件。旧Owner回収は既存exact経路だけ。
 */
export function initializeAccessManagementState(
  root: FilesystemStoreRoot,
  attemptId: string,
  isStartRequested: boolean,
  observePrevious: () => readonly [unknown, unknown],
): StateStoreResult<
  Readonly<{ revision: number; attemptId: string; created: boolean }>
> {
  if (
    typeof attemptId !== "string" ||
    !ATTEMPT_UUID.test(attemptId) ||
    isStartRequested !== true ||
    typeof observePrevious !== "function"
  )
    return {
      status: "unavailable",
      reason: "state_store_initialization_input_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    };
  return locked<
    Readonly<{ revision: number; attemptId: string; created: boolean }>
  >(root, () => {
    let publication: "not_attempted" | "unconfirmed" | "confirmed" =
      "not_attempted";
    let revision: number | null = null;
    try {
      const baseline = initialBaseline(attemptId);
      const expected = serialize(baseline);
      if (
        parseAccessManagementState(expected).status !== "parsed" ||
        isStartRequested !== true
      )
        return {
          status: "unavailable",
          reason: "state_store_initialization_input_rejected",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      if (present(root, PENDING) || present(root, REPLACE))
        return {
          status: "unavailable",
          reason: "state_store_initialization_material_present",
          publication,
          revision,
          cleanupConfirmed: false,
        };
      if (present(root, CURRENT)) {
        const current = readCurrent(root);
        if (!current.bytes.equals(expected))
          return {
            status: "unavailable",
            reason: "state_store_initialization_current_conflict",
            publication,
            revision: current.state.revision,
            cleanupConfirmed: true,
          };
        return {
          status: "completed",
          value: { revision: 1, attemptId, created: false },
          publication: "confirmed",
          revision: 1,
          cleanupConfirmed: true,
        };
      }
      const observation = observePrevious();
      if (
        !Array.isArray(observation) ||
        observation.length !== 2 ||
        !evaluateHostInitializationState(observation[0], observation[1], true)
          .canStart
      )
        return {
          status: "unavailable",
          reason: "state_store_initialization_observation_rejected",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      publication = "unconfirmed";
      writeExclusive(root, CURRENT, expected);
      const current = readCurrent(root);
      if (!current.bytes.equals(expected))
        throw new Error("read_back_mismatch");
      publication = "confirmed";
      revision = 1;
      return {
        status: "completed",
        value: { revision: 1, attemptId, created: true },
        publication,
        revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "state_store_initialization_failed",
        publication,
        revision,
        cleanupConfirmed: false,
      };
    }
  });
}

/**
 * 保存観測結果（StateStoreResult）を定義する。
 * @responsibility 内部保存結果と公開DTOを分離する。
 * @trace ARCH-000013
 * @shape completedは検査・処置・Lock解放済み。unavailableは最初の理由・出版事実・内部Lock回復参照を保持する。
 * @invariant 未確認をcompletedへ畳まない。
 * @boundary 内部保存Ownerだけが利用する値契約。
 * @security 内部SnapshotをTransportへ透過しない。
 * @compatibility 最新Schemaだけを扱い、旧形式を補完しない。
 */
export type StateStoreResult<T> =
  | Readonly<{
      status: "completed";
      value: T;
      cleanupConfirmed: true;
      publication: "not_attempted" | "confirmed";
      revision: number | null;
    }>
  | Readonly<{
      status: "unavailable";
      reason: string;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      revision: number | null;
      cleanupConfirmed: boolean;
      lockRecoveryId?: string;
      secondaryReason?: string;
    }>;

/**
 * 出版材料（PendingPublication）を定義する。
 * @responsibility 内部保存結果と公開DTOを分離する。
 * @trace ARCH-000013
 * @shape 固定包絡、基準／次改訂・Hash・操作ID・種別と完全nextSnapshot。
 * @invariant 未確認をcompletedへ畳まない。
 * @boundary 内部保存Ownerだけが利用する値契約。
 * @security 内部SnapshotをTransportへ透過しない。
 * @compatibility 最新Schemaだけを扱い、旧形式を補完しない。
 */
type PendingPublication = {
  contract: "crdd-access-management/pending";
  schemaRevision: 1;
  kind: "management" | "initialization" | "credential";
  baseRevision: number;
  baseSha256: string;
  nextRevision: number;
  nextSha256: string;
  operationId: string;
  nextSnapshot: AccessManagementState;
};

/**
 * 状態を一意のUTF-8 byteへ直列化する。
 * @responsibility Objectのkeyを辞書順、配列順は維持し、末尾改行を固定する。
 * @trace ARCH-000013
 * @input 検査済みの所有JSON値。
 * @returns 固定serializerのUTF-8 Buffer。
 * @precondition 内部保存Ownerが検査済みの所有JSON値を渡す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect N/A: メモリ内計算だけ。
 * @failure JSON値以外は利用側の検査で拒否する。
 * @invariant 同じJSON値は同じbyteとなる。
 * @boundary JSON値と保存byte。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency N/A: 同期局所処理。
 */
function serialize(value: unknown): Buffer {
  return Buffer.from(
    `${JSON.stringify(value, (_key, item: unknown) => {
      if (item !== null && typeof item === "object" && !Array.isArray(item))
        return Object.fromEntries(
          Object.entries(item).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
        );
      return item;
    })}\n`,
    "utf8",
  );
}

/**
 * 正確なbyteの照合Hashを計算する。
 * @responsibility SHA-256をAuthorityではなくbyte相関に用いる。
 * @trace ARCH-000013
 * @input UTF-8 byte。
 * @returns 64桁hex。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect N/A: 純粋計算。
 * @failure N/A: 固定bytesを計算する。
 * @invariant Hashから出版や認可成立を推定しない。
 * @boundary 保存byte相関。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency N/A: 同期局所処理。
 */
function hash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * 固定Fileの確認済み不存在を調べる。
 * @responsibility ENOENTだけを不存在とし、観測不能を隠さない。
 * @trace ARCH-000013
 * @input RootCapabilityと固定相対File名。
 * @returns 存在Boolean。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect Filesystem metadata読取り。
 * @failure 非ENOENTはthrowし利用側を停止する。
 * @invariant 権限拒否等をfalseへ丸めない。
 * @boundary 保存RootとFilesystem。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency 同じLockの同期区間で呼ぶ。
 */
function present(root: FilesystemStoreRoot, name: string): boolean {
  const file = resolveFilesystemStorePath(root, name);
  try {
    fs.lstatSync(file);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

/**
 * 現在状態を完全検査して読み取る。
 * @responsibility 既存bounded Readerと状態parserを組み合わせる。
 * @trace ARCH-000013
 * @input RootCapability。
 * @returns 完全状態と正確なbyte。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect 上限付きFile読取りとdescriptor開閉。
 * @failure 不在・破損・容量超過・Root差は停止する。
 * @invariant 不在を未初期化へ変換しない。
 * @boundary 保存RootとUTF-8状態。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency 同じLock内だけで読む。
 */
function readCurrent(root: FilesystemStoreRoot) {
  const snapshot = readStableBoundedFileSnapshot(
    resolveFilesystemStorePath(root, CURRENT),
    CURRENT_LIMIT,
  );
  const parsed = parseAccessManagementState(snapshot.bytes);
  if (parsed.status !== "parsed")
    throw new Error("state_store_current_invalid");
  return { state: parsed.state, bytes: snapshot.bytes };
}

/**
 * 保存材料の閉集合とbyte相関を確認する。
 * @responsibility 包絡・次Snapshot・改訂・Hash・操作IDを一体検査する。
 * @trace ARCH-000013
 * @input RootCapability。
 * @returns 検査済み包絡と次状態byte。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect 上限付きpending読取り。
 * @failure 未知field・Hash差・改訂差・不正状態は停止する。
 * @invariant 旧形式の推測や補完をしない。
 * @boundary 短命包絡と現在Schema。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency 同じLock内で読む。
 */
function readPending(root: FilesystemStoreRoot) {
  const bytes = readStableBoundedFileSnapshot(
    resolveFilesystemStorePath(root, PENDING),
    PENDING_LIMIT,
  ).bytes;
  const raw: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes),
  );
  const keys = [
    "contract",
    "schemaRevision",
    "kind",
    "baseRevision",
    "baseSha256",
    "nextRevision",
    "nextSha256",
    "operationId",
    "nextSnapshot",
  ];
  if (
    raw === null ||
    typeof raw !== "object" ||
    Array.isArray(raw) ||
    Object.keys(raw).length !== keys.length ||
    keys.some((k) => !Object.hasOwn(raw, k))
  )
    throw new Error("state_store_pending_invalid");
  const p = raw as PendingPublication;
  const nextBytes = serialize(p.nextSnapshot);
  const parsed = parseAccessManagementState(nextBytes);
  if (
    p.contract !== "crdd-access-management/pending" ||
    p.schemaRevision !== 1 ||
    !["management", "initialization", "credential"].includes(p.kind) ||
    !Number.isSafeInteger(p.baseRevision) ||
    p.baseRevision < 1 ||
    !Number.isSafeInteger(p.nextRevision) ||
    p.nextRevision !== p.baseRevision + 1 ||
    typeof p.baseSha256 !== "string" ||
    !HASH.test(p.baseSha256) ||
    typeof p.nextSha256 !== "string" ||
    !HASH.test(p.nextSha256) ||
    parsed.status !== "parsed" ||
    parsed.state.revision !== p.nextRevision ||
    parsed.state.operationId !== p.operationId ||
    hash(nextBytes) !== p.nextSha256
  )
    throw new Error("state_store_pending_invalid");
  return { pending: p, nextBytes };
}

/**
 * 短命出版材料を排他的に保存する。
 * @responsibility wx作成・write・flush・closeを行い、途中物を勝手に削除しない。
 * @trace ARCH-000013
 * @input Root・固定File名・byte。
 * @returns N/A: 保存完了時復帰。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect 同Rootに一件作成・書込み。
 * @failure write・flush・close失敗は停止し残存を保持する。
 * @invariant 既存Fileは上書きしない。
 * @boundary Filesystem出版材料。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency 同じLock下で同期保存。
 */
function writeExclusive(
  root: FilesystemStoreRoot,
  name: string,
  bytes: Buffer,
): void {
  const fd = fs.openSync(resolveFilesystemStorePath(root, name), "wx", 0o600);
  try {
    fs.writeFileSync(fd, bytes);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * 通常管理更新で保持する鍵・初回事実を照合する。
 * @responsibility 通常保存のbase一致破棄を鍵・初回へ一般化しない。
 * @trace ARCH-000013
 * @input 基準と次状態。
 * @returns 保持条件Boolean。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect N/A: 純粋比較。
 * @failure 対象外変更はfalse。
 * @invariant 資格・初回・交換状態と既存User IDは保持する。
 * @boundary 管理更新と鍵処置の境界。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency N/A: 同期局所処理。
 */
function ordinaryChange(
  base: AccessManagementState,
  next: AccessManagementState,
): boolean {
  return (
    base.initialization.stage === "completed" &&
    serialize(base.initialization).equals(serialize(next.initialization)) &&
    serialize(base.credentials).equals(serialize(next.credentials)) &&
    serialize(base.unresolvedKeyExchanges).equals(
      serialize(next.unresolvedKeyExchanges),
    ) &&
    base.users.every((user) =>
      next.users.some((candidate) => candidate.userId === user.userId),
    )
  );
}

/**
 * 保存途中の材料を現在byteと照合して処置する。
 * @responsibility base／next／不一致を分け、自動再出版しない。
 * @trace ARCH-000013
 * @input Rootと現在状態byte。
 * @returns none／discarded／published。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect 相関確認済み短命材料だけを削除し不存在確認。
 * @failure 孤立replace・破損・鍵由来base・不一致は保持停止。
 * @invariant 現在状態を変更せず、過去unknownを成功へ変えない。
 * @boundary Process喪失後のFilesystem再入場。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency 既存Lockを取得できたOwnerだけが処置する。
 */
function settlePending(
  root: FilesystemStoreRoot,
  current: ReturnType<typeof readCurrent>,
  recordPublication: () => void,
): "none" | "discarded" | "published" {
  const hasPending = present(root, PENDING);
  const hasReplace = present(root, REPLACE);
  if (!hasPending) {
    if (hasReplace) throw new Error("state_store_replace_orphaned");
    return "none";
  }
  const { pending, nextBytes } = readPending(root);
  const published =
    current.state.revision === pending.nextRevision &&
    current.state.operationId === pending.operationId &&
    hash(current.bytes) === pending.nextSha256;
  if (published) recordPublication();
  if (hasReplace) {
    const replacement = readStableBoundedFileSnapshot(
      resolveFilesystemStorePath(root, REPLACE),
      CURRENT_LIMIT,
    ).bytes;
    if (!replacement.equals(nextBytes))
      throw new Error("state_store_replace_invalid");
  }
  const base =
    current.state.revision === pending.baseRevision &&
    hash(current.bytes) === pending.baseSha256;
  if (
    !published &&
    !(
      base &&
      pending.kind === "management" &&
      ordinaryChange(current.state, pending.nextSnapshot)
    )
  )
    throw new Error("state_store_pending_unresolved");
  if (hasReplace) fs.rmSync(resolveFilesystemStorePath(root, REPLACE));
  if (present(root, REPLACE)) throw new Error("state_store_cleanup_unknown");
  fs.rmSync(resolveFilesystemStorePath(root, PENDING));
  if (present(root, PENDING)) throw new Error("state_store_cleanup_unknown");
  return published ? "published" : "discarded";
}

/**
 * 既存Lockのexact回収と結果を保存Ownerへ閉じる。
 * @responsibility 新排他を作らず、既知出版とLock解放不明を別に保持する。
 * @trace ARCH-000013
 * @input Rootと同期保存処理。
 * @returns 内部StateStoreResult。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect 既存Lock取得・必要時exact回収・解放。
 * @failure 競合・Owner存在・観測不能・解放不明は未完了。
 * @invariant 回収は同じIDと既存Owner不存在Proofだけ。
 * @boundary 保存OwnerとDomain排他。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency 再入場は一回だけ、無限再試行なし。
 */
function locked<T>(
  root: FilesystemStoreRoot,
  operation: () => StateStoreResult<T>,
): StateStoreResult<T> {
  let observed: StateStoreResult<T> = {
    status: "unavailable",
    reason: "state_store_observation_unknown",
    publication: "not_attempted",
    revision: null,
    cleanupConfirmed: false,
  };
  try {
    const execute = () => {
      observed = operation();
      return observed;
    };
    let lock = withFilesystemStoreLock(root, LOCK, execute);
    if (
      !lock.acquired &&
      lock.reason === "filesystem_store_lock_recovery_required"
    ) {
      const absence = observeFilesystemStoreLockOwnerAbsence(
        root,
        LOCK,
        lock.recoveryId,
      );
      if (
        absence.status === "confirmed" &&
        recoverFilesystemStoreLock(root, LOCK, absence.proof).status ===
          "completed"
      )
        lock = withFilesystemStoreLock(root, LOCK, execute);
    }
    if (!lock.acquired)
      return {
        status: "unavailable",
        reason: lock.reason,
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
        ...("recoveryId" in lock ? { lockRecoveryId: lock.recoveryId } : {}),
      };
    if (!lock.cleanupConfirmed)
      return {
        status: "unavailable",
        reason:
          observed.status === "unavailable" ? observed.reason : lock.reason,
        publication: observed.publication,
        revision: observed.revision,
        cleanupConfirmed: false,
        lockRecoveryId: lock.recoveryId,
        ...(observed.status === "unavailable"
          ? { secondaryReason: lock.reason }
          : {}),
      };
    return observed;
  } catch {
    const latest = observed as StateStoreResult<T>;
    return latest.status === "unavailable"
      ? { ...latest, cleanupConfirmed: false }
      : {
          status: "unavailable",
          reason: "state_store_lock_unknown",
          publication: latest.publication,
          revision: latest.revision,
          cleanupConfirmed: false,
        };
  }
}

/**
 * 内部の現在状態を同じLock下で読み取る。
 * @responsibility 保存途中の照合と完全Snapshot読取りを一つの排他へ閉じる。
 * @trace ARCH-000013
 * @input 既存の用途限定FilesystemStoreRoot。
 * @returns 内部Snapshotまたは未取得理由。
 * @precondition 同じ用途限定Rootと既存排他を使用する内部保存Ownerだけが呼び出す。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect 読取り・Lock・確認済み短命材料の清掃。
 * @failure 不在・破損・相関不能はunavailable。
 * @invariant 内部Snapshotは公開DTOではない。
 * @boundary AM保存OwnerとFilesystem。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency 全Writerと同じLockを使う。
 */
export function readAccessManagementState(
  root: FilesystemStoreRoot,
): StateStoreResult<AccessManagementState> {
  return locked(root, () => {
    let publication: "not_attempted" | "confirmed" = "not_attempted";
    let revision: number | null = null;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      settlePending(root, current, () => {
        publication = "confirmed";
      });
      return {
        status: "completed",
        value: current.state,
        cleanupConfirmed: true,
        publication,
        revision,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "state_store_read_unavailable",
        publication,
        revision,
        cleanupConfirmed: false,
      };
    }
  });
}

/**
 * 通常管理の次状態を同じLock下で保存・読戻しする。
 * @responsibility 現在認可の利用側callback、期待改訂、完全候補、出版、清掃を直列化する。
 * @trace ARCH-000013
 * @input Root・期待改訂・現在状態から次UTF-8 byteを返す同期callback。
 * @returns 読戻し済み改訂と操作ID、または段階・既知出版事実。
 * @precondition 内部保存Ownerだけが呼び出す。callbackは同期の認可評価とメモリ内候補構築だけに閉じ、Promise・外部I/O・鍵処置・別Store更新・利用者応答を行わない。
 * @postcondition 確認した事実だけを返し、観測不能を成功へ変換しない。
 * @effect 保存部品だけがpending・replace作成、current置換、短命材料清掃を行う。callback自身の外部・永続Effectは0。
 * @failure 競合・候補不正・出版／読戻し／清掃失敗は未完了。
 * @invariant 鍵・初回処置は受理せず、暗黙再更新・rollbackしない。
 * @boundary 通常管理保存OwnerとFilesystem。
 * @security Snapshot・Verifier・salt・内部Pathを外部応答や例外本文へ出さない。
 * @concurrency callbackは同期かつ現在認可を同じLock内で照合する。
 */
export function updateAccessManagementState(
  root: FilesystemStoreRoot,
  expectedRevision: number,
  createNext: (current: AccessManagementState) => Uint8Array,
): StateStoreResult<Readonly<{ revision: number; operationId: string }>> {
  return locked(root, () => {
    let publication: "not_attempted" | "unconfirmed" | "confirmed" =
      "not_attempted";
    let revision: number | null = null;
    let stage = "read";
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      stage = "pending";
      if (
        settlePending(root, current, () => {
          publication = "confirmed";
        }) !== "none"
      )
        return {
          status: "unavailable",
          reason: "state_store_previous_pending_settled",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      stage = "revision";
      if (
        !Number.isSafeInteger(expectedRevision) ||
        expectedRevision !== current.state.revision
      )
        return {
          status: "unavailable",
          reason: "state_store_revision_conflict",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      stage = "candidate";
      const parsed = parseAccessManagementState(
        createNext(structuredClone(current.state)),
      );
      if (
        parsed.status !== "parsed" ||
        parsed.state.revision !== expectedRevision + 1 ||
        parsed.state.operationId === current.state.operationId ||
        !ordinaryChange(current.state, parsed.state)
      )
        return {
          status: "unavailable",
          reason: "state_store_candidate_invalid",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      return publishState(root, current, parsed.state, "management");
    } catch {
      return {
        status: "unavailable",
        reason: `state_store_${stage}_failed`,
        publication,
        revision,
        cleanupConfirmed: false,
      };
    }
  });
}

/**
 * 検査済み次状態を共通の物理手順で出版する。
 * @responsibility pending・replace・読戻し・清掃と既知出版事実を所有する。
 * @trace ARCH-000013
 * @input 同じRootの基準byte、完全次状態、処置種別。
 * @returns 保存改訂・操作IDまたは主失敗と既知出版。
 * @precondition 呼出側がLock下で操作固有の遷移・改訂・認可・材料不存在を検査済み。
 * @postcondition 読戻しと清掃後だけcompleted。
 * @effect pending・replace作成、current置換、材料清掃。
 * @failure 容量・準備・出版・読戻し・清掃失敗を分離する。
 * @invariant 業務遷移を許可せず、失敗をrollbackへ丸めない。
 * @boundary AM内部保存OwnerとFilesystem。
 * @security Snapshotと内部Pathを公開しない。
 * @concurrency 呼出側の既存Lock内で同期実行。
 */
function publishState(
  root: FilesystemStoreRoot,
  current: ReturnType<typeof readCurrent>,
  next: AccessManagementState,
  kind: PendingPublication["kind"],
): StateStoreResult<Readonly<{ revision: number; operationId: string }>> {
  let publication: "not_attempted" | "unconfirmed" | "confirmed" =
    "not_attempted";
  let revision = current.state.revision;
  let stage = "prepare";
  try {
    const nextBytes = serialize(next);
    const pendingBytes = serialize({
      contract: "crdd-access-management/pending",
      schemaRevision: 1,
      kind,
      baseRevision: current.state.revision,
      baseSha256: hash(current.bytes),
      nextRevision: next.revision,
      nextSha256: hash(nextBytes),
      operationId: next.operationId,
      nextSnapshot: next,
    });
    if (
      nextBytes.byteLength > CURRENT_LIMIT ||
      pendingBytes.byteLength > PENDING_LIMIT
    )
      return {
        status: "unavailable",
        reason: "state_store_capacity_exceeded",
        publication,
        revision,
        cleanupConfirmed: true,
      };
    writeExclusive(root, PENDING, pendingBytes);
    if (!readPending(root).nextBytes.equals(nextBytes))
      throw new Error("pending_invalid");
    writeExclusive(root, REPLACE, nextBytes);
    if (
      !readStableBoundedFileSnapshot(
        resolveFilesystemStorePath(root, REPLACE),
        CURRENT_LIMIT,
      ).bytes.equals(nextBytes)
    )
      throw new Error("replace_invalid");
    stage = "publish";
    publication = "unconfirmed";
    fs.renameSync(
      resolveFilesystemStorePath(root, REPLACE),
      resolveFilesystemStorePath(root, CURRENT),
    );
    stage = "read_back";
    const published = readCurrent(root);
    if (!published.bytes.equals(nextBytes))
      throw new Error("publication_unconfirmed");
    publication = "confirmed";
    revision = published.state.revision;
    stage = "cleanup";
    if (
      settlePending(root, published, () => {
        publication = "confirmed";
      }) !== "published"
    )
      throw new Error("cleanup_unknown");
    return {
      status: "completed",
      value: { revision, operationId: published.state.operationId },
      cleanupConfirmed: true,
      publication,
      revision,
    };
  } catch {
    return {
      status: "unavailable",
      reason: `state_store_${stage}_failed`,
      publication,
      revision,
      cleanupConfirmed: false,
    };
  }
}

/**
 * 保存済み初回相関に最初の管理者を生成・保存する。
 * @responsibility 初回Userの生成と保存済み同Userの再観測を分離する。
 * @trace ARCH-000013
 * @input 既存Root・元試行UUID・表示専用username。
 * @returns 保存改訂・User ID・保存名・新規生成有無、または未完了。
 * @precondition 信頼済みHost内部保存Ownerだけが呼ぶ。元試行相関を保存済み。
 * @postcondition 完全user_storedの読戻し後だけcompleted。
 * @effect Lock、UUID生成、初回Userのpending・replace・current保存。
 * @failure 別試行・非canonical相関・途中材料・保存失敗は保持停止。
 * @invariant 保存済みUserを増やさず、名前を再要求で変更しない。鍵・認証・Root準備・Host完了は未接続。
 * @boundary 初回User保存段階とFilesystem。
 * @security primitive入力を先に検査し、User IDをAuthorityにしない。
 * @concurrency 同じLock内の一生成・一出版。base材料の再出版なし。
 */
export function createInitialAdministrator(
  root: FilesystemStoreRoot,
  attemptId: string,
  username: string,
): StateStoreResult<
  Readonly<{
    revision: number;
    userId: string;
    username: string;
    created: boolean;
  }>
> {
  if (
    typeof attemptId !== "string" ||
    !ATTEMPT_UUID.test(attemptId) ||
    typeof username !== "string" ||
    username !== username.trim() ||
    [...username].length < 1 ||
    [...username].length > 128 ||
    /[\p{Cc}\p{Cs}]/u.test(username)
  )
    return {
      status: "unavailable",
      reason: "state_store_initial_user_input_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    };
  return locked<
    Readonly<{
      revision: number;
      userId: string;
      username: string;
      created: boolean;
    }>
  >(root, () => {
    let publication: "not_attempted" | "confirmed" = "not_attempted";
    let revision: number | null = null;
    let cleanupConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      settlePending(root, current, () => {
        publication = "confirmed";
      });
      cleanupConfirmed = true;
      const expected = initialBaseline(attemptId);
      if (current.state.initialization.stage === "user_stored") {
        const user = current.state.users[0];
        if (
          !user ||
          user.userId === attemptId ||
          current.state.operationId === attemptId ||
          current.state.operationId === user.userId
        )
          throw new Error("initial_user_conflict");
        expected.revision = 2;
        expected.operationId = current.state.operationId;
        expected.users = [{ ...user }];
        expected.initialization = {
          stage: "user_stored",
          attemptId,
          userId: user.userId,
        };
        if (!serialize(expected).equals(current.bytes))
          throw new Error("initial_user_conflict");
        return {
          status: "completed",
          value: {
            revision: 2,
            userId: user.userId,
            username: user.username,
            created: false,
          },
          publication: "confirmed",
          revision: 2,
          cleanupConfirmed: true,
        };
      }
      if (!serialize(expected).equals(current.bytes))
        throw new Error("initial_baseline_conflict");
      expected.revision = 2;
      expected.operationId = "eeeeeeee-eeee-4eee-beee-eeeeeeeeeeee";
      const reservedUserId = "ffffffff-ffff-4fff-bfff-ffffffffffff";
      expected.users = [
        {
          userId: reservedUserId,
          username,
          role: "administrator",
        },
      ];
      expected.initialization = {
        stage: "user_stored",
        attemptId,
        userId: reservedUserId,
      };
      const reservation = serialize(expected);
      const pendingReservation = serialize({
        contract: "crdd-access-management/pending",
        schemaRevision: 1,
        kind: "initialization",
        baseRevision: current.state.revision,
        baseSha256: hash(current.bytes),
        nextRevision: expected.revision,
        nextSha256: hash(reservation),
        operationId: expected.operationId,
        nextSnapshot: expected,
      });
      if (
        reservation.byteLength > CURRENT_LIMIT ||
        pendingReservation.byteLength > PENDING_LIMIT
      )
        throw new Error("initial_user_capacity");
      const userId = crypto.randomUUID();
      const operationId = crypto.randomUUID();
      if (
        userId === attemptId ||
        operationId === attemptId ||
        operationId === userId ||
        !ATTEMPT_UUID.test(userId) ||
        !ATTEMPT_UUID.test(operationId)
      )
        throw new Error("uuid_collision");
      expected.operationId = operationId;
      expected.users = [{ userId, username, role: "administrator" }];
      expected.initialization = { stage: "user_stored", attemptId, userId };
      const parsed = parseAccessManagementState(serialize(expected));
      if (parsed.status !== "parsed") throw new Error("initial_user_invalid");
      const result = publishState(
        root,
        current,
        parsed.state,
        "initialization",
      );
      return result.status === "completed"
        ? { ...result, value: { revision: 2, userId, username, created: true } }
        : result;
    } catch {
      return {
        status: "unavailable",
        reason: "state_store_initial_user_failed",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
}

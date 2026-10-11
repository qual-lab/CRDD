/**
 * Access Managementの単一現在状態を既存Root・Lockで保存する。
 * @packageDocumentation
 * @responsibility 完全Snapshotの読取り、通常更新と出版途中の照合を所有する。
 * @trace ARCH-000013
 */
import fs from "node:fs";
import crypto, { createHash } from "node:crypto";
import { evaluateManagementPermission } from "../access/management-permission.ts";
import {
  acceptsRepositoryExposureChange,
  prepareRepositoryExposureChange,
  type RepositoryExposureChange,
} from "../management/repository-exposure.ts";
import { evaluateHostInitializationState } from "../initialization/state-evaluation.ts";
import {
  prepareUserRoleChange,
  type UserRoleChange,
} from "../management/user-role.ts";
import {
  createCredentialMaterial,
  readCredentialId,
} from "../credential/token-material.ts";
import {
  resolveCredentialAuthentication,
  type AuthenticatedRequest,
  type CredentialAuthenticationResult,
} from "../credential/authentication.ts";
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
 * 現在状態を読み同じLock区間内で資格の本人投影を解決する。
 * @responsibility 要求毎の現在改訂と認証結果を結合して非秘密結果へ閉じる。
 * @trace ARCH-000013
 * @input 既存Rootと信頼しないBearer文字列。
 * @returns 本人の固定投影、認証拒否または状態未確認。
 * @precondition Rootは既存内部Ownerが検証済み。公開Transportは入力境界を別検査する。
 * @postcondition 読戻し・認証・投影・Lock解放確認時だけcompleted。
 * @effect 既存Lock、現在状態読取り、確認済み短命材料清掃、同期KDF。
 * @failure 失効・不一致等は同一拒否、保存／排他不明では本人情報0。
 * @invariant 管理実行許可・内容取得・初回完了・永続Sessionを作らない。
 * @boundary AM専用認証入口と内部保存Owner。
 * @security 生鍵・salt・Verifier・Root・Lock回復IDを結果へ含めない。
 * @concurrency 全Writerと同じLock下の同一改訂。後続Effectは別の現在認可。
 */
export function authenticateCredential(
  root: FilesystemStoreRoot,
  token: string,
): CredentialAuthenticationResult {
  if (!readCredentialId(token))
    return {
      status: "unavailable",
      reason: "credential_authentication_rejected",
    };
  const result = locked<AuthenticatedRequest>(root, () => {
    try {
      const current = readCurrent(root);
      settlePending(root, current, () => {});
      const snapshot = resolveCredentialAuthentication(token, current.state);
      if (!snapshot)
        return {
          status: "unavailable",
          reason: "credential_authentication_rejected",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: true,
        };
      return {
        status: "completed",
        value: snapshot,
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "credential_authentication_state_unavailable",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? { status: "completed", snapshot: result.value }
    : {
        status: "unavailable",
        reason:
          result.reason === "credential_authentication_rejected" &&
          result.cleanupConfirmed
            ? "credential_authentication_rejected"
            : "credential_authentication_state_unavailable",
      };
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
    const { nextBytes, pendingBytes } = preparePublicationBytes(
      current,
      next,
      kind,
    );
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
 * 現在byteと次状態から同じ出版材料を構築する。
 * @responsibility 容量予約と実出版で同じbyte表現を使う。
 * @trace ARCH-000013
 * @input 完全現在byte・次状態・処置種別。
 * @returns 所有済みnext／pending bytes。
 * @precondition 同じ保存OwnerがLock内で使う。
 * @postcondition 予約と出版の包絡・Hash計算が一致する。
 * @effect N/A: メモリ内serialize・Hash計算だけ。
 * @failure Runtime故障は呼出元が未完了へ分類する。
 * @invariant placeholderによる予約byteは保存しない。
 * @boundary 私有保存準備と物理出版。
 * @security Verifierを含む内部byteを公開しない。
 * @concurrency 同じ同期Lock区間内だけ。
 */
function preparePublicationBytes(
  current: ReturnType<typeof readCurrent>,
  next: AccessManagementState,
  kind: PendingPublication["kind"],
): { nextBytes: Buffer; pendingBytes: Buffer } {
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
  return { nextBytes, pendingBytes };
}

/**
 * ユーザー・Role管理の非秘密結果を表す。
 * @responsibility 認可前拒否と今回操作の保存観測を分離する。
 * @trace ARCH-000013
 * @shape completedは操作・期待改訂・採用改訂・対象、unavailableは非開示拒否または認可後の保存観測。
 * @invariant completedは今回出版と全清掃確認を要求する。
 * @boundary Package管理APIから内部Consumerへ渡す結果。
 * @security 生鍵・salt・Verifier・全状態・内部Path・Lock回復参照を含めない。
 * @compatibility 通常4操作専用。HTTP／MCP Schemaの採用ではない。
 */
export type UserRoleManagementResult =
  | Readonly<{
      status: "completed";
      operationId: string;
      expectedRevision: number;
      revision: number;
      userId: string | null;
      publication: "confirmed";
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "management_operation_rejected";
    }>
  | Readonly<{
      status: "unavailable";
      reason: "management_operation_unavailable";
      primaryFailure: string;
      operationId: string;
      expectedRevision: number;
      observedRevision: number | null;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
    }>;

/**
 * 通常4操作の現在認可・変更・保存を直列化する。
 * @responsibility 非開示拒否と今回出版事実を既存保存部品へ接続する。
 * @trace ARCH-000013
 * @input 検証済みRoot、鍵、期待改訂、受付UUID、内部4操作入力。
 * @returns 非秘密の管理結果。
 * @precondition 用途限定Rootを使う内部Consumerだけが呼ぶ。入力は本関数も検査する。
 * @postcondition 今回の出版・読戻し・材料とLock清掃確認時だけcompleted。
 * @effect 既存Lock、登録時だけUUID一回、既存pending／replace／current出版。
 * @failure 認可前は固定拒否。認可後は最初の失敗と今回出版事実を保持する。
 * @invariant 先行pendingの出版を今回操作へ帰属せず、鍵・初回・Repository登録・Exposureを変更しない。
 * @boundary 通常User／Role管理と私有Filesystem保存。
 * @security 未認証・未許可に状態情報を返さず、資格材料と回復参照は常に非公開。
 * @concurrency 同じ既存Lock内で現在認証・期待改訂・容量・保存を評価する。
 */
function executeUserRoleManagementMutation(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  change: UserRoleChange,
): UserRoleManagementResult {
  if (
    typeof token !== "string" ||
    !readCredentialId(token) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId)
  )
    return { status: "unavailable", reason: "management_operation_rejected" };
  let admitted = false;
  let targetUserId: string | null = null;
  let currentPublication: "not_attempted" | "unconfirmed" | "confirmed" =
    "not_attempted";
  const result = locked(root, () => {
    let revision: number | null = null;
    let stage = "read";
    let materialsConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      stage = "authorization";
      if (
        current.state.revision !== expectedRevision ||
        current.state.operationId === operationId
      )
        return {
          status: "unavailable" as const,
          reason: "management_operation_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      const prepared = prepareUserRoleChange(
        token,
        current.state,
        change,
        expectedRevision,
        operationId,
      );
      if (!prepared)
        return {
          status: "unavailable" as const,
          reason: "management_operation_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      admitted = true;
      targetUserId = prepared.userId;
      stage = "pending";
      const settled = settlePending(root, current, () => {});
      materialsConfirmed = true;
      if (settled !== "none")
        return {
          status: "unavailable" as const,
          reason: "state_store_previous_pending_settled",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      stage = "capacity";
      const reservation = preparePublicationBytes(
        current,
        prepared.next,
        "management",
      );
      if (
        reservation.nextBytes.byteLength > CURRENT_LIMIT ||
        reservation.pendingBytes.byteLength > PENDING_LIMIT
      )
        return {
          status: "unavailable" as const,
          reason: "state_store_capacity_exceeded",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      if (prepared.registersUser) {
        stage = "identity";
        const userId = crypto.randomUUID();
        if (
          !ATTEMPT_UUID.test(userId) ||
          userId === operationId ||
          current.state.users.some((user) => user.userId === userId)
        )
          throw new Error("user_identity_invalid");
        const user = prepared.next.users.at(-1);
        if (!user) throw new Error("user_candidate_invalid");
        user.userId = userId;
        targetUserId = userId;
      }
      stage = "candidate";
      const parsed = parseAccessManagementState(serialize(prepared.next));
      if (
        parsed.status !== "parsed" ||
        !ordinaryChange(current.state, parsed.state)
      )
        throw new Error("user_role_candidate_invalid");
      const published = publishState(root, current, parsed.state, "management");
      currentPublication = published.publication;
      return published;
    } catch {
      return {
        status: "unavailable" as const,
        reason: `state_store_${stage}_failed`,
        publication: currentPublication,
        revision,
        cleanupConfirmed: materialsConfirmed,
      };
    }
  });
  if (!admitted)
    return { status: "unavailable", reason: "management_operation_rejected" };
  if (result.status === "completed")
    return {
      status: "completed",
      operationId,
      expectedRevision,
      revision: result.value.revision,
      userId: targetUserId,
      publication: "confirmed",
      cleanupConfirmed: true,
    };
  return {
    status: "unavailable",
    reason: "management_operation_unavailable",
    primaryFailure: result.reason,
    operationId,
    expectedRevision,
    observedRevision: result.revision,
    publication: currentPublication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 現在管理者が新しい最小ユーザーを登録する。
 * @responsibility 予定Roleの固定管理許可からUser一件だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、表示名、予定Role。
 * @returns 新User IDと保存観測、または非秘密拒否。
 * @precondition 初回設定が完了した用途限定Storeを使用する。
 * @postcondition 資格を発行せずUser一件だけ追加する。
 * @effect 認可・容量確認後のUUID一回と既存保存。
 * @failure 非認可・不正入力・競合・容量・生成・保存・清掃不明で未完了。
 * @invariant managerはadministratorを登録できない。
 * @boundary 通常ユーザー管理と同じLock内の保存。
 * @security 鍵・全内部状態を結果へ返さない。
 * @concurrency 現在資格と予定Roleの許可を保存直前に再評価する。
 */
export function registerUser(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  username: string,
  plannedRole: unknown,
): UserRoleManagementResult {
  return executeUserRoleManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "registerUser", username, plannedRole },
  );
}

/**
 * 既存ユーザーの管理用表示名だけを変更する。
 * @responsibility exact Userと現在Roleを確認し名前だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存User ID、新表示名。
 * @returns 対象User IDと保存観測、または非秘密拒否。
 * @precondition 完了初期化のStoreを使用する。
 * @postcondition User ID・Role・資格を保持する。
 * @effect 既存状態保存。UUID生成なし。
 * @failure 不正名・対象差・非認可・競合・保存／清掃不明で未完了。
 * @invariant managerはadministratorの表示名を変更できる。
 * @boundary 通常名前管理と保存Owner。
 * @security 他User一覧・資格材料を返さない。
 * @concurrency 同じ現在状態から対象と許可を再評価する。
 */
export function updateUserName(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  userId: string,
  username: string,
): UserRoleManagementResult {
  return executeUserRoleManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "updateUserName", userId, username },
  );
}

/**
 * 既存ユーザーの現在Roleを明示した次Roleへ変更する。
 * @responsibility 変更前Roleと固定管理許可を確認して一件のRoleだけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存User ID、変更前後Role。
 * @returns 対象User IDと保存観測、または非秘密拒否。
 * @precondition 完了初期化のStoreを使用する。
 * @postcondition 名前・ID・資格結合を保持し次要求が新Roleを評価する。
 * @effect 既存状態保存。資格発行・失効なし。
 * @failure 前Role差・非認可・不正値・競合・保存／清掃不明で未完了。
 * @invariant administratorが関わる変更はadministratorだけ。最終管理者guardを追加しない。
 * @boundary 通常Role管理と保存Owner。
 * @security 変更後Roleを変更前の実行許可へ使わない。
 * @concurrency 同じLock内の変更前認可を使用する。
 */
export function changeUserRole(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  userId: string,
  currentRole: unknown,
  nextRole: unknown,
): UserRoleManagementResult {
  return executeUserRoleManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "changeUserRole", userId, currentRole, nextRole },
  );
}

/**
 * Roleの明示内容範囲を更新する。
 * @responsibility 固定管理許可を保ちdevelopment／management集合だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、対象Role、明示内容範囲。
 * @returns 保存観測、または非秘密拒否。
 * @precondition 完了初期化のStoreを使用する。
 * @postcondition 固定管理分担・User・資格・Exposureを変更しない。
 * @effect 既存状態保存。新認可Frameworkなし。
 * @failure 未知／重複範囲・非認可・競合・保存／清掃不明で未完了。
 * @invariant administrator内容設定はadministratorだけ。
 * @boundary Role内容管理と保存Owner。
 * @security 内容範囲は実アクセス・管理操作の許可ではない。
 * @concurrency 同じLock内で対象Roleの現在許可を再評価する。
 */
export function updateRoleContentAccess(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  targetRole: unknown,
  workspaceIds: unknown,
): UserRoleManagementResult {
  return executeUserRoleManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "updateRoleContentAccess", targetRole, workspaceIds },
  );
}

/**
 * 登録／公開管理の非秘密な保存結果。
 * @responsibility 認可前拒否と認可後の既知出版を分離する。
 * @trace ARCH-000013
 * @shape 完了、固定拒否、認可後未完了の閉じた共用体。
 * @invariant 先行操作を今回の出版へ帰属しない。
 * @boundary AM保存と内部Consumer。
 * @security 全Snapshot・秘密・内部Pathを含めない。
 * @compatibility Transport公開の採用ではない。
 */
export type RepositoryExposureManagementResult =
  | Readonly<{
      status: "completed";
      operationId: string;
      expectedRevision: number;
      revision: number;
      repositoryId: string;
      publication: "confirmed";
      cleanupConfirmed: true;
    }>
  | Readonly<{ status: "unavailable"; reason: "management_operation_rejected" }>
  | Readonly<{
      status: "unavailable";
      reason: "management_operation_unavailable";
      primaryFailure: string;
      operationId: string;
      expectedRevision: number;
      observedRevision: number | null;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
    }>;

/**
 * 登録・解除・公開更新の現在認可と保存を直列化する。
 * @responsibility 認可前の外部Root観測・先行材料清掃を行わない。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、内部三操作。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect 既存Lock、登録時固定File観測、既存pending／replace／current出版。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
function executeRepositoryExposureMutation(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  change: RepositoryExposureChange,
): RepositoryExposureManagementResult {
  if (
    typeof token !== "string" ||
    !readCredentialId(token) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId)
  )
    return { status: "unavailable", reason: "management_operation_rejected" };
  let admitted = false;
  let currentPublication: "not_attempted" | "unconfirmed" | "confirmed" =
    "not_attempted";
  const result = locked(root, () => {
    let revision: number | null = null;
    let stage = "read";
    let materialsConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      stage = "authorization";
      const actor = resolveCredentialAuthentication(token, current.state);
      if (
        !actor ||
        current.state.initialization.stage !== "completed" ||
        revision !== expectedRevision ||
        current.state.operationId === operationId ||
        evaluateManagementPermission(actor.role, {
          operation: change.operation,
        }) !== "allowed" ||
        !acceptsRepositoryExposureChange(current.state, change)
      )
        return {
          status: "unavailable" as const,
          reason: "management_operation_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      admitted = true;
      stage = "pending";
      const settled = settlePending(root, current, () => {});
      materialsConfirmed = true;
      if (settled !== "none")
        return {
          status: "unavailable" as const,
          reason: "state_store_previous_pending_settled",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      stage = "repository_binding";
      const next = prepareRepositoryExposureChange(
        current.state,
        change,
        operationId,
      );
      if (!next) throw new Error("repository_binding_invalid");
      stage = "candidate";
      const parsed = parseAccessManagementState(serialize(next));
      if (
        parsed.status !== "parsed" ||
        !ordinaryChange(current.state, parsed.state)
      )
        throw new Error("repository_candidate_invalid");
      const published = publishState(root, current, parsed.state, "management");
      currentPublication = published.publication;
      return published;
    } catch {
      return {
        status: "unavailable" as const,
        reason: `state_store_${stage}_failed`,
        publication: currentPublication,
        revision,
        cleanupConfirmed: materialsConfirmed,
      };
    }
  });
  if (!admitted)
    return { status: "unavailable", reason: "management_operation_rejected" };
  if (result.status === "completed")
    return {
      status: "completed",
      operationId,
      expectedRevision,
      revision: result.value.revision,
      repositoryId: change.repositoryId as string,
      publication: "confirmed",
      cleanupConfirmed: true,
    };
  return {
    status: "unavailable",
    reason: "management_operation_unavailable",
    primaryFailure: result.reason,
    operationId,
    expectedRevision,
    observedRevision: result.revision,
    publication: currentPublication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 現在manager／administratorがRepositoryを登録する。
 * @responsibility Canonical Identityと検証Rootを登録するが公開しない。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、Repository ID、絶対Root。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect 認可後の固定File読取りと既存保存。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function registerRepository(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
  repositoryRoot: unknown,
): RepositoryExposureManagementResult {
  return executeRepositoryExposureMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "registerRepository", repositoryId, repositoryRoot },
  );
}

/**
 * Repository登録と対応Exposureを同じ改訂で解除する。
 * @responsibility 旧Rootの再検査を要求せず対象管理情報だけを除去する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存Repository ID。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect AM管理状態の保存だけ。対象Repository観測・変更0。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function unregisterRepository(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
): RepositoryExposureManagementResult {
  return executeRepositoryExposureMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "unregisterRepository", repositoryId },
  );
}

/**
 * 登録済みRepositoryの明示公開範囲を更新する。
 * @responsibility 空集合を含む明示範囲だけを保存する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存Repository ID、workspaceIds。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect AM管理状態の保存だけ。対象Repository観測・変更0。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function updateExposure(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
  workspaceIds: unknown,
): RepositoryExposureManagementResult {
  return executeRepositoryExposureMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "updateExposure", repositoryId, workspaceIds },
  );
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

/**
 * 保存済み初回管理者へ最初の鍵を一回だけ保存する。
 * @responsibility 完全資格の出版と保存済み資格の再観測を分離する。
 * @trace ARCH-000013
 * @input 既存Root・保存済み元試行UUID。
 * @returns 改訂・資格ID・生成有無と一回限りの短命鍵、または未完了。
 * @precondition 信頼済みHost内部Ownerだけが呼ぶ。初回Userを保存済み。
 * @postcondition 出版・読戻し・Lock解放が確認できた新規保存だけtokenを返す。
 * @effect 既存Lock、乱数・KDF、資格のpending・replace・current保存。
 * @failure 別試行・非canonical状態・途中材料・保存不明は保持停止。
 * @invariant 同元試行へ追加資格を生成せず、保存済みSecretを復元しない。
 * @boundary 初回資格保存とFilesystem。配送・認証・公開入口は別段階。
 * @security tokenは内部短命返却値だけ。current・ログ・診断へ保存しない。
 * @concurrency 同じLock内で容量検査から一生成・一出版まで行う。
 */
export function createInitialCredential(
  root: FilesystemStoreRoot,
  attemptId: string,
): StateStoreResult<
  Readonly<{
    revision: number;
    credentialId: string;
    created: boolean;
    token: string | null;
  }>
> {
  if (typeof attemptId !== "string" || !ATTEMPT_UUID.test(attemptId))
    return {
      status: "unavailable",
      reason: "state_store_initial_credential_input_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    };
  return locked<
    Readonly<{
      revision: number;
      credentialId: string;
      created: boolean;
      token: string | null;
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
      const user = current.state.users[0];
      if (
        user?.role !== "administrator" ||
        user.userId === attemptId ||
        current.state.operationId === attemptId ||
        current.state.operationId === user.userId
      )
        throw new Error("initial_user_conflict");
      const expected = initialBaseline(attemptId);
      expected.revision = current.state.revision;
      expected.operationId = current.state.operationId;
      expected.users = [{ ...user }];
      const initialization = current.state.initialization;
      if (initialization.stage === "credential_stored") {
        const credential = current.state.credentials[0];
        if (!credential || current.state.revision < 3)
          throw new Error("initial_credential_conflict");
        expected.credentials = [{ ...credential }];
        expected.initialization = {
          stage: "credential_stored",
          attemptId,
          userId: user.userId,
          credentialId: credential.credentialId,
          receipt: initialization.receipt,
          normalConnection: initialization.normalConnection,
        };
        if (!serialize(expected).equals(current.bytes))
          throw new Error("initial_credential_conflict");
        return {
          status: "completed",
          value: {
            revision: current.state.revision,
            credentialId: credential.credentialId,
            created: false,
            token: null,
          },
          publication: "confirmed",
          revision: current.state.revision,
          cleanupConfirmed: true,
        };
      }
      expected.initialization = {
        stage: "user_stored",
        attemptId,
        userId: user.userId,
      };
      if (
        current.state.revision !== 2 ||
        !serialize(expected).equals(current.bytes)
      )
        throw new Error("initial_user_conflict");
      expected.revision = 3;
      expected.operationId = "eeeeeeee-eeee-4eee-beee-eeeeeeeeeeee";
      expected.credentials = [
        {
          credentialId: "f".repeat(24),
          userId: user.userId,
          tokenVersion: 1,
          tokenSalt: "f".repeat(32),
          tokenVerifier: "f".repeat(64),
          revoked: false,
          operationId: attemptId,
          delivery: "not_attempted",
        },
      ];
      expected.initialization = {
        stage: "credential_stored",
        attemptId,
        userId: user.userId,
        credentialId: "f".repeat(24),
        receipt: "unconfirmed",
        normalConnection: "unconfirmed",
      };
      const reservation = serialize(expected);
      const pendingReservation = serialize({
        contract: "crdd-access-management/pending",
        schemaRevision: 1,
        kind: "initialization",
        baseRevision: current.state.revision,
        baseSha256: hash(current.bytes),
        nextRevision: 3,
        nextSha256: hash(reservation),
        operationId: expected.operationId,
        nextSnapshot: expected,
      });
      if (
        reservation.byteLength > CURRENT_LIMIT ||
        pendingReservation.byteLength > PENDING_LIMIT
      )
        throw new Error("initial_credential_capacity");
      const operationId = crypto.randomUUID();
      if (
        !ATTEMPT_UUID.test(operationId) ||
        operationId === attemptId ||
        operationId === user.userId ||
        operationId === current.state.operationId
      )
        throw new Error("uuid_collision");
      const material = createCredentialMaterial();
      expected.operationId = operationId;
      expected.credentials[0] = {
        userId: user.userId,
        tokenVersion: 1,
        revoked: false,
        operationId: attemptId,
        delivery: "not_attempted",
        credentialId: material.credentialId,
        tokenSalt: material.tokenSalt,
        tokenVerifier: material.tokenVerifier,
      };
      expected.initialization.credentialId = material.credentialId;
      const parsed = parseAccessManagementState(serialize(expected));
      if (parsed.status !== "parsed")
        throw new Error("initial_credential_invalid");
      const result = publishState(
        root,
        current,
        parsed.state,
        "initialization",
      );
      return result.status === "completed"
        ? {
            ...result,
            value: {
              revision: 3,
              credentialId: material.credentialId,
              created: true,
              token: material.token,
            },
          }
        : result;
    } catch {
      return {
        status: "unavailable",
        reason: "state_store_initial_credential_failed",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
}

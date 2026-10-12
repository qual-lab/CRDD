/**
 * Access Managementの単一現在状態を既存Root・Lockで保存する。
 * @packageDocumentation
 * @responsibility 完全Snapshotの読取り、通常更新と出版途中の照合を所有する。
 * @trace ARCH-000013
 */
import fs from "node:fs";
import {
  prepareKeyExchange,
  prepareKeyExchangeRevocation,
  prepareExchangedCredential,
  prepareKeyExchangeCompletion,
  readDisplayedCredentialIds,
  selectKeyExchangeContinuation,
  isKeyExchangeRecoveryId,
  projectKeyExchangeState,
  type KeyExchangeSnapshot,
} from "../credential/key-exchange.ts";
import {
  prepareCredentialChange,
  projectCredentialIssuance,
  type CredentialIssuanceSnapshot,
} from "../credential/management.ts";
import {
  readCredentialPresentationUpdate,
  selectCredentialPresentationTarget,
} from "../credential/presentation.ts";
import {
  readInitialConnectionBinding,
  selectConnectionAuthentication,
  selectInitialConnectionConfirmation,
  type ConnectionAuthenticationResult,
} from "../credential/initial-connection.ts";
import {
  selectRepositoryAccess,
  observeRepositoryAccess,
  type RepositoryAccess,
  type RepositoryAccessResult,
  type AuthorizedRepository,
  type RepositoryAccessCollectionResult,
} from "../access/repository-access.ts";
import crypto, { createHash } from "node:crypto";
import { evaluateManagementPermission } from "../access/management-permission.ts";
import {
  projectCurrentAccess,
  type CurrentAccessResult,
  type CurrentAccessSnapshot,
} from "../access/current-access.ts";
import {
  isManagementReadKind,
  projectManagementState,
  type ManagementStateResult,
  type ManagementStateSnapshot,
} from "../management/read-state.ts";
import {
  acceptsRepositoryExposureChange,
  prepareRepositoryExposureChange,
  type RepositoryExposureChange,
} from "../management/repository-exposure.ts";
import { evaluateHostInitializationState } from "../initialization/state-evaluation.ts";
import {
  projectHostInitializationState,
  type HostInitializationStateResult,
} from "../initialization/host-state.ts";
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
    schemaRevision: 2,
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
  return authenticateStoredCredential(root, token, false);
}

/**
 * 保存済みの初回元試行と段階をHost再入場へ返す。
 * @responsibility AM入力不存在と観測不能を区別し、same exact試行の再開を支える。
 * @trace ARCH-000013
 * @input 信頼されたHost Ownerの検証済み管理Root。
 * @returns 非Authorityなfresh／in_progress／existing、または固定unknown。
 * @precondition Host専用内部利用。旧入力・旧Writer停止・Root準備はHost切替Ownerが別に確認する。
 * @postcondition 完全状態・既知pending処置・Lock終了後だけ段階を返す。
 * @effect 既存Lock、current／pending／replaceの観測、既知出版材料のexact清掃。
 * @failure partial・base初回材料・孤立replace・旧版・解放不明はunknown。
 * @invariant UUID・鍵・User生成0、Secret再取得0。freshは初期化許可ではない。
 * @boundary 同Lock保存OwnerからHost内部再入場。公開状態照会ではない。
 * @security Secret・Verifier・salt・Root・Lock回復参照を返さない。
 * @concurrency 既存Writerと同じLock内の一改訂。旧CROS Writerへの排他は主張しない。
 */
export function readHostInitializationState(
  root: FilesystemStoreRoot,
): HostInitializationStateResult {
  const result = locked<HostInitializationStateResult>(root, () => {
    let publication: "not_attempted" | "confirmed" = "not_attempted";
    let revision: number | null = null;
    try {
      if (!present(root, CURRENT)) {
        if (present(root, PENDING) || present(root, REPLACE))
          throw new Error("initial_material_present");
        return {
          status: "completed",
          value: Object.freeze({ status: "fresh" }),
          publication,
          revision,
          cleanupConfirmed: true,
        };
      }
      const current = readCurrent(root);
      revision = current.state.revision;
      settlePending(root, current, () => {
        publication = "confirmed";
      });
      const value = projectHostInitializationState(current.state);
      if (value.status === "unknown")
        throw new Error("initial_projection_unknown");
      return {
        status: "completed",
        value,
        publication,
        revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "host_initialization_state_unavailable",
        publication,
        revision,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? result.value
    : { status: "unknown", reason: "host_initialization_state_unavailable" };
}

/**
 * 初回設定完了後の通常接続だけを認証する。
 * @responsibility 初回途中の本人確認と通常Surface接続を分離する。
 * @trace ARCH-000013
 * @input 検証済み管理Rootと信頼しないBearer文字列。
 * @returns 非秘密の本人投影、または既存の固定認証拒否・状態未確認。
 * @precondition Rootは既存保存Ownerが検証済み。
 * @postcondition 同改訂の有効資格と初回completed、清掃・Lock解放を確認した場合だけ成功。
 * @effect 既存Lock、状態読取り、同期KDF。認証成功後だけ短命材料を清掃する。
 * @failure 初回未完了・失効・不一致は同一拒否。状態・清掃・解放不明は本人情報なし。
 * @invariant 通常接続の受領記録・内容権限・永続Sessionを生成しない。
 * @boundary AM保存Ownerから通常Surfaceの要求内認証へ渡す。
 * @security 生鍵・内部Path・Verifierを返さず、認可対象Repositoryを観測しない。
 * @concurrency 同じLockの同改訂。後続内容操作は現在認可を取り直す。
 */
export function authenticateNormalConnection(
  root: FilesystemStoreRoot,
  token: string,
): CredentialAuthenticationResult {
  return authenticateStoredCredential(root, token, true);
}

/**
 * 通常本人か初回限定候補かを一回の同Lock認証で判定する。
 * @responsibility Lock外のstage読取りや二認証の組合せを排除する。
 * @trace ARCH-000013
 * @input 検証済み管理Rootと信頼しないBearer。
 * @returns 通常本人、非Authority初回相関、固定拒否／状態未確認。
 * @precondition Surfaceは初回候補を完全discover専用Handlerへ渡す。
 * @postcondition 認証・用途判定・材料清掃・Lock解放後だけ投影を返す。
 * @effect 既存Lock・状態読取り・KDF・許可後の既存pending処置。
 * @failure 不正資格・段階差は固定拒否、観測・清掃・解放不明は情報0。
 * @invariant 初回候補へ通常Role・内容・Toolの権限を付与しない。
 * @boundary AM要求内認証とSurfaceの用途別Handler。
 * @security 生鍵・Verifier・内部Path・状態Snapshotを返さない。
 * @concurrency 同じLock・同改訂で判定し、確認出版時はfreshに照合する。
 */
export function resolveConnectionAuthentication(
  root: FilesystemStoreRoot,
  token: string,
): ConnectionAuthenticationResult {
  if (!readCredentialId(token))
    return {
      status: "unavailable",
      reason: "connection_authentication_rejected",
    };
  const result = locked<
    Exclude<ConnectionAuthenticationResult, { status: "unavailable" }>
  >(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      const value =
        actor && selectConnectionAuthentication(current.state, actor);
      if (!value)
        return {
          status: "unavailable",
          reason: "connection_authentication_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      settlePending(root, current, () => {});
      return {
        status: "completed",
        value,
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "connection_state_unavailable",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? result.value
    : {
        status: "unavailable",
        reason:
          result.reason === "connection_authentication_rejected" &&
          result.cleanupConfirmed
            ? "connection_authentication_rejected"
            : "connection_state_unavailable",
      };
}

/**
 * 完全な限定要求の受理後に初回接続を保存確定する。
 * @responsibility freshな鍵・相関・提示・交換状態を同Lockで再照合する。
 * @trace ARCH-000013
 * @input 検証済みRoot、Bearer、閉じた初回相関、Consumer所有のAbortSignal。
 * @returns 保存／再観測と清掃・Lock終了済みの非秘密出版結果、または未完了。
 * @precondition 信頼済みConsumerが完全discoverを検査済み。入力相関だけでは許可しない。
 * @postcondition 一出版後は同歴史相関と直後改訂だけ再観測。通常Authorityは返さない。
 * @effect 既存Lock・fresh KDF・既存pending処置・completedの同期出版／読戻し／清掃。
 * @failure 開始前取消・不正相関はRoot観測0。状態・出版・清掃不明では成功を返さない。
 * @invariant 新User・資格・元試行は0。現在状態の出版Operation IDだけを生成する。
 * @boundary AM同期保存とSurfaceの完全要求検査・応答前取消再確認。
 * @security 生鍵を保存・返却せず、相関と内部保存結果を外部へ透過しない。
 * @concurrency Signalは開始前Gate。同期保存開始後は完了し、Consumerが取消後の応答を止める。
 */
export function confirmInitialConnection(
  root: FilesystemStoreRoot,
  token: string,
  input: unknown,
  signal: AbortSignal,
): StateStoreResult<Readonly<{ revision: number; operationId: string }>> {
  const binding = readInitialConnectionBinding(input);
  if (signal.aborted || !binding || !readCredentialId(token))
    return {
      status: "unavailable",
      reason: signal.aborted
        ? "initial_connection_cancelled"
        : "initial_connection_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    };
  return locked(root, () => {
    let publication: "not_attempted" | "confirmed" = "not_attempted";
    let revision: number | null = null;
    let cleanupConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      const actor = resolveCredentialAuthentication(token, current.state);
      const action =
        actor &&
        selectInitialConnectionConfirmation(current.state, actor, binding);
      if (!action)
        return {
          status: "unavailable",
          reason: "initial_connection_rejected",
          publication,
          revision,
          cleanupConfirmed,
        };
      const pending = settlePending(root, current, () => {
        publication = "confirmed";
      });
      cleanupConfirmed = true;
      if (action === "observed")
        return {
          status: "completed",
          value: { revision, operationId: current.state.operationId },
          publication: "confirmed",
          revision,
          cleanupConfirmed,
        };
      if (pending !== "none")
        return {
          status: "unavailable",
          reason: "state_store_previous_pending_settled",
          publication,
          revision,
          cleanupConfirmed,
        };
      const initial = current.state.initialization;
      if (initial.stage !== "credential_stored")
        throw new Error("initial_stage_mismatch");
      const operationId = crypto.randomUUID();
      if (
        !ATTEMPT_UUID.test(operationId) ||
        operationId === current.state.operationId ||
        operationId === initial.attemptId
      )
        throw new Error("uuid_collision");
      const next = structuredClone(current.state);
      next.revision += 1;
      next.operationId = operationId;
      next.initialization = {
        stage: "completed",
        attemptId: initial.attemptId,
        initialUserId: initial.userId,
        initialCredentialId: initial.initialCredentialId,
        confirmationCredentialId: initial.confirmationCredentialId,
        connection: "confirmed",
      };
      const parsed = parseAccessManagementState(serialize(next));
      if (parsed.status !== "parsed")
        throw new Error("initial_candidate_invalid");
      return publishState(root, current, parsed.state, "initialization");
    } catch {
      return {
        status: "unavailable",
        reason: "initial_connection_state_unavailable",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
}

/**
 * 用途別の初回完了条件を既存保存境界で照合する。
 * @responsibility 共通の資格照合・結果非開示・排他解放を重複させない。
 * @trace ARCH-000013
 * @input 管理Root、Bearer、通常接続の初回完了必須指定。
 * @returns 同改訂の本人投影、または固定の未取得結果。
 * @precondition 公開入口が用途を固定し、外部入力で用途を変更しない。
 * @postcondition 通常接続では有効資格と初回完了の確認前に材料を変更しない。
 * @effect 既存状態・Lock・KDFと短命材料清掃。新StoreやLockを作らない。
 * @failure 不正資格・未完了は拒否、観測・清掃・解放不明は状態未確認。
 * @invariant 初回本人確認の既存順序と結果を変更しない。
 * @boundary 二つの認証用途と単一保存Owner。
 * @security 対象Repository・生鍵・下位例外を公開しない。
 * @concurrency 同じ保存Lock内で認証と初回状態を照合する。
 */
function authenticateStoredCredential(
  root: FilesystemStoreRoot,
  token: string,
  requireCompletedInitialization: boolean,
): CredentialAuthenticationResult {
  if (!readCredentialId(token))
    return {
      status: "unavailable",
      reason: "credential_authentication_rejected",
    };
  const result = locked<AuthenticatedRequest>(root, () => {
    try {
      const current = readCurrent(root);
      if (!requireCompletedInitialization)
        settlePending(root, current, () => {});
      const snapshot = resolveCredentialAuthentication(token, current.state);
      if (
        !snapshot ||
        (requireCompletedInitialization &&
          current.state.initialization.stage !== "completed")
      )
        return {
          status: "unavailable",
          reason: "credential_authentication_rejected",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: true,
        };
      if (requireCompletedInitialization)
        settlePending(root, current, () => {});
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
 * 同じ保存改訂から本人の現在権限を読み取り、解放確認後に返す。
 * @responsibility 認証前の材料清掃を避け、本人投影と保存Ownerの終了を接続する。
 * @trace ARCH-000013
 * @input 検証済み用途限定Rootと信頼しないBearer文字列。
 * @returns 本人の非秘密投影、または固定の未取得理由。
 * @precondition Root検証は既存内部Owner、公開Transportの入力境界はConsumerが所有する。
 * @postcondition 認証・完全状態・投影・材料清掃・Lock解放を確認した場合だけcompleted。
 * @effect 既存Lock、状態読取り、認証後の短命材料清掃、同期KDF。
 * @failure 不成立資格は同一拒否。取得・観測・回収・解放不明ではSnapshotなし。
 * @invariant 初回途中の本人表示を初回完了・通常接続確認に昇格しない。
 * @boundary AM保存Ownerと本人表示Consumer。実Repositoryアクセスは別。
 * @security 生鍵・資格ID・保存Path・Lock回復参照・他Userを返さない。
 * @concurrency 全Writerと同じLock内の同改訂。次操作は現在認可を再確認する。
 */
export function readCurrentAccess(
  root: FilesystemStoreRoot,
  token: string,
): CurrentAccessResult {
  if (!readCredentialId(token))
    return {
      status: "unavailable",
      reason: "current_access_authentication_rejected",
    };
  const result = locked<CurrentAccessSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      if (!actor)
        return {
          status: "unavailable",
          reason: "current_access_authentication_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      try {
        settlePending(root, current, () => {});
      } catch {
        return {
          status: "unavailable",
          reason: "current_access_cleanup_pending",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: false,
        };
      }
      return {
        status: "completed",
        value: projectCurrentAccess(current.state, actor),
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "current_access_observation_unknown",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  if (result.status === "completed")
    return { status: "completed", snapshot: result.value };
  if (
    result.secondaryReason ||
    result.reason ===
      "filesystem_store_lock_operation_completed_cleanup_unknown" ||
    result.reason === "state_store_lock_unknown"
  )
    return { status: "unavailable", reason: "current_access_release_unknown" };
  if (result.reason === "current_access_authentication_rejected")
    return {
      status: "unavailable",
      reason: "current_access_authentication_rejected",
    };
  if (result.reason === "current_access_cleanup_pending")
    return { status: "unavailable", reason: "current_access_cleanup_pending" };
  return {
    status: "unavailable",
    reason: result.reason.startsWith("filesystem_store_lock_")
      ? "current_access_lock_unavailable"
      : "current_access_observation_unknown",
  };
}

/**
 * 今回内容要求の現在認可と実Repositoryを解決する。
 * @responsibility 未許可観測を防ぎ、清掃・解放確認後だけ内部Consumerへ渡す。
 * @trace ARCH-000013
 * @input 検証済み管理Root、Bearer、対象ID、development／management。
 * @returns 今回要求だけの内部RepositoryAccess、または非開示の固定理由。
 * @precondition 同Processの信頼したConsumerだけが利用し、Transportへ値を透過しない。
 * @postcondition 同改訂認可・bounded実体検証・Lock解放が全て成立時だけcompleted。
 * @effect 既存Lock・current認証・許可後pending清掃・固定Repository観測。
 * @failure 未認証・未登録・範囲外は同一拒否。清掃・実体・解放不明は値なし。
 * @invariant 後続変更は開始済み要求の取消を証明しない。別要求は必ずこの入口へ戻る。
 * @boundary AM現在認可とDomain／VC実アクセス。内容本文は解放後にConsumerが取得する。
 * @security token・内部Path・資格・Lock回復参照を返さず、結果を保存・cache・次要求へ再利用しない。
 * @concurrency 同じ管理Lock内の改訂で受理。技術的Root能力に失効機能があるとは主張しない。
 */
export function resolveRepositoryAccess(
  root: FilesystemStoreRoot,
  token: string,
  repositoryId: unknown,
  workspaceId: unknown,
): RepositoryAccessResult {
  if (
    typeof repositoryId !== "string" ||
    repositoryId.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(repositoryId) ||
    (workspaceId !== "development" && workspaceId !== "management") ||
    !readCredentialId(token)
  )
    return { status: "unavailable", reason: "repository_access_rejected" };
  const result = locked<RepositoryAccess>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      const registration = actor
        ? selectRepositoryAccess(
            current.state,
            actor,
            repositoryId,
            workspaceId,
          )
        : null;
      if (!registration)
        return {
          status: "unavailable",
          reason: "repository_access_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      try {
        settlePending(root, current, () => {});
      } catch {
        return {
          status: "unavailable",
          reason: "repository_access_cleanup_pending",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: false,
        };
      }
      const access = observeRepositoryAccess(
        registration,
        current.state.revision,
        workspaceId,
      );
      if (!access)
        return {
          status: "unavailable",
          reason: "repository_access_observation_unknown",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: true,
        };
      return {
        status: "completed",
        value: access,
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "repository_access_observation_unknown",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  if (result.status === "completed")
    return { status: "completed", access: result.value };
  if (
    result.secondaryReason ||
    result.reason ===
      "filesystem_store_lock_operation_completed_cleanup_unknown" ||
    result.reason === "state_store_lock_unknown"
  )
    return {
      status: "unavailable",
      reason: "repository_access_release_unknown",
    };
  if (
    result.reason === "repository_access_rejected" ||
    result.reason === "repository_access_cleanup_pending"
  )
    return { status: "unavailable", reason: result.reason };
  return {
    status: "unavailable",
    reason: result.reason.startsWith("filesystem_store_lock_")
      ? "repository_access_lock_unavailable"
      : "repository_access_observation_unknown",
  };
}

/**
 * 今回許可された全Repositoryを同じ管理改訂から解決する。
 * @responsibility 現在認可の集合を一度に確定し、確認不成立を部分成功へ変換しない。
 * @trace ARCH-000013
 * @input 検証済み管理Rootと信頼しないBearer。
 * @returns 管理改訂と一意な許可Repository集合、または固定取得不能理由。
 * @precondition 信頼した同ProcessのConsumerが今回要求だけに使用する。
 * @postcondition 完全状態・認証・初期化・清掃・全対象観測・Lock解放成立時だけcompleted。
 * @effect 既存Lockと現在認証、許可後材料清掃、対象ごとの固定manifest観測。
 * @failure 認証・初期化不成立は拒否。対象観測・清掃・解放不明では集合なし。
 * @invariant 内容範囲とExposureの積集合を保持し、管理能力を内容許可にしない。
 * @boundary AM現在認可→VC／Domain技術的観測。本文は解放後のConsumerが取得する。
 * @security Root・資格をTransportへ透過せず、cache・保存・次要求への再利用を禁止する。
 * @concurrency 同じ既存Lock内の改訂。観測量は既存16MiB状態内の登録数に比例する。
 */
export function resolveRepositoryAccessCollection(
  root: FilesystemStoreRoot,
  token: string,
): RepositoryAccessCollectionResult {
  if (!readCredentialId(token))
    return { status: "unavailable", reason: "repository_access_rejected" };
  const result = locked<{
    managementRevision: number;
    repositories: readonly AuthorizedRepository[];
  }>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      if (!actor || current.state.initialization.stage !== "completed")
        return {
          status: "unavailable",
          reason: "repository_access_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      const selected = current.state.registeredRepositories
        .map((registration) => ({
          registration,
          workspaceIds: actor.workspaceIds.filter((workspaceId) =>
            current.state.exposure.some(
              (exposure) =>
                exposure.repositoryId === registration.repositoryId &&
                exposure.workspaceIds.includes(workspaceId),
            ),
          ),
        }))
        .filter((item) => item.workspaceIds.length > 0)
        .sort((a, b) =>
          a.registration.repositoryId < b.registration.repositoryId
            ? -1
            : a.registration.repositoryId > b.registration.repositoryId
              ? 1
              : 0,
        );
      try {
        settlePending(root, current, () => {});
      } catch {
        return {
          status: "unavailable",
          reason: "repository_access_cleanup_pending",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: false,
        };
      }
      const repositories: AuthorizedRepository[] = [];
      for (const { registration, workspaceIds } of selected) {
        const workspaceId = workspaceIds[0];
        const access = workspaceId
          ? observeRepositoryAccess(
              registration,
              current.state.revision,
              workspaceId,
            )
          : null;
        if (!access)
          return {
            status: "unavailable",
            reason: "repository_access_observation_unknown",
            publication: "not_attempted",
            revision: current.state.revision,
            cleanupConfirmed: true,
          };
        repositories.push(
          Object.freeze({
            repositoryId: access.repositoryId,
            workspaceIds: Object.freeze(workspaceIds),
            bindingId: access.bindingId,
            manifest: access.manifest,
            root: access.root,
          }),
        );
      }
      return {
        status: "completed",
        value: Object.freeze({
          managementRevision: current.state.revision,
          repositories: Object.freeze(repositories),
        }),
        publication: "not_attempted",
        revision: current.state.revision,
        cleanupConfirmed: true,
      };
    } catch {
      return {
        status: "unavailable",
        reason: "repository_access_observation_unknown",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  if (result.status === "completed")
    return Object.freeze({ status: "completed", ...result.value });
  if (
    result.secondaryReason ||
    result.reason ===
      "filesystem_store_lock_operation_completed_cleanup_unknown" ||
    result.reason === "state_store_lock_unknown"
  )
    return {
      status: "unavailable",
      reason: "repository_access_release_unknown",
    };
  if (
    result.reason === "repository_access_rejected" ||
    result.reason === "repository_access_cleanup_pending"
  )
    return { status: "unavailable", reason: result.reason };
  return {
    status: "unavailable",
    reason: result.reason.startsWith("filesystem_store_lock_")
      ? "repository_access_lock_unavailable"
      : "repository_access_observation_unknown",
  };
}

/**
 * 現在許可された管理対象を同じ改訂から読み取り返す。
 * @responsibility 対象別認可前に保存材料を清掃せず、終了確認後だけDTOを公開する。
 * @trace ARCH-000013
 * @input 検証済みRoot、信頼しないBearer、管理対象kind。
 * @returns 対象別投影、または情報を含まない固定拒否・未取得理由。
 * @precondition Rootは既存内部Ownerが検証済み。Transport入力境界はConsumerが担当する。
 * @postcondition 完全状態・認証・対象別管理許可・清掃・解放確認時だけcompleted。
 * @effect 既存Lock、current読取り、同期KDF、許可後の短命材料清掃。
 * @failure 不正kind・developer・初回途中は同じ参照拒否。清掃・解放不明はDTOなし。
 * @invariant 管理参照を内容閲覧・更新・鍵処置のAuthorityへ転用しない。
 * @boundary AM保存Ownerと通常管理の表示Consumer。
 * @security 生鍵・資格材料・内部Path・Lock回復ID・種類外情報を返さない。
 * @concurrency 同じLock内の現在認証・改訂。後続処置は別要求で再認可する。
 */
export function readManagementState(
  root: FilesystemStoreRoot,
  token: string,
  kind: unknown,
): ManagementStateResult {
  if (!isManagementReadKind(kind))
    return { status: "unavailable", reason: "management_state_read_rejected" };
  if (!readCredentialId(token))
    return {
      status: "unavailable",
      reason: "management_state_authentication_rejected",
    };
  const result = locked<ManagementStateSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const actor = resolveCredentialAuthentication(token, current.state);
      if (!actor)
        return {
          status: "unavailable",
          reason: "management_state_authentication_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      const snapshot = projectManagementState(current.state, actor, kind);
      if (!snapshot)
        return {
          status: "unavailable",
          reason: "management_state_read_rejected",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: true,
        };
      try {
        settlePending(root, current, () => {});
      } catch {
        return {
          status: "unavailable",
          reason: "management_state_cleanup_pending",
          publication: "not_attempted",
          revision: current.state.revision,
          cleanupConfirmed: false,
        };
      }
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
        reason: "management_state_observation_unknown",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  if (result.status === "completed")
    return { status: "completed", snapshot: result.value };
  if (
    result.secondaryReason ||
    result.reason ===
      "filesystem_store_lock_operation_completed_cleanup_unknown" ||
    result.reason === "state_store_lock_unknown"
  )
    return {
      status: "unavailable",
      reason: "management_state_release_unknown",
    };
  if (result.reason === "management_state_authentication_rejected")
    return {
      status: "unavailable",
      reason: "management_state_authentication_rejected",
    };
  if (result.reason === "management_state_read_rejected")
    return { status: "unavailable", reason: "management_state_read_rejected" };
  if (result.reason === "management_state_cleanup_pending")
    return {
      status: "unavailable",
      reason: "management_state_cleanup_pending",
    };
  return {
    status: "unavailable",
    reason: result.reason.startsWith("filesystem_store_lock_")
      ? "management_state_lock_unavailable"
      : "management_state_observation_unknown",
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
          initialCredentialId: credential.credentialId,
          confirmationCredentialId: credential.credentialId,
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
          presentation: "not_attempted",
        },
      ];
      expected.initialization = {
        stage: "credential_stored",
        attemptId,
        userId: user.userId,
        initialCredentialId: "f".repeat(24),
        confirmationCredentialId: "f".repeat(24),
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
        presentation: "not_attempted",
        credentialId: material.credentialId,
        tokenSalt: material.tokenSalt,
        tokenVerifier: material.tokenVerifier,
      };
      expected.initialization.initialCredentialId = material.credentialId;
      expected.initialization.confirmationCredentialId = material.credentialId;
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

/**
 * 資格の提示前記録と出力観測後の記録を同じ保存Ownerで出版する。
 * @responsibility 非秘密exact相関をfresh照合し、対象presentationだけを一改訂進める。
 * @trace ARCH-000013
 * @input 検証済みRootと閉じた提示更新。confirmedは出力を観測した内部Ownerだけが要求する。
 * @returns 保存・清掃・Lock終了済みの非秘密相関、または既知出版と未完了。
 * @precondition 信頼済み内部Consumer用。相関入力やParser受理自体をAuthorityにしない。
 * @postcondition not_attempted→unconfirmedまたはunconfirmed→confirmedだけを保存し、再入場は提示許可を返さない。
 * @effect 既存Lock、current読取り、出版UUID、pending・replace・読戻し・材料清掃。
 * @failure 形式不正・失効・交換・改訂／提示不一致は更新0。保存／清掃／解放不明ではcompletedを返さない。
 * @invariant 他資格・User・Role・登録・初回歴史ID・未解決交換を変更しない。
 * @boundary 内部提示OwnerとAM保存。実TTY／HTTP観測・管理認可は呼出し側。
 * @security 生Secretを受け取らず返さず、遅延callbackは返した非秘密相関だけを保持する。
 * @concurrency 全Reader／Writerと同じLockで同期出版し、次更新は現在改訂を取り直す。
 */
export function recordCredentialPresentation(
  root: FilesystemStoreRoot,
  input: unknown,
): StateStoreResult<
  Readonly<{
    revision: number;
    operationId: string;
    credentialId: string;
    issuanceOperationId: string;
    presentationOperationId: string;
    presentation: "unconfirmed" | "confirmed";
  }>
> {
  const update = readCredentialPresentationUpdate(input);
  if (!update)
    return {
      status: "unavailable",
      reason: "state_store_presentation_input_rejected",
      publication: "not_attempted",
      revision: null,
      cleanupConfirmed: true,
    };
  return locked(root, () => {
    let publication: "not_attempted" | "confirmed" = "not_attempted";
    let revision: number | null = null;
    let cleanupConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
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
      cleanupConfirmed = true;
      const index = selectCredentialPresentationTarget(current.state, update);
      if (index === null)
        return {
          status: "unavailable",
          reason: "state_store_presentation_rejected",
          publication,
          revision,
          cleanupConfirmed,
        };
      const operationId = crypto.randomUUID();
      if (
        !ATTEMPT_UUID.test(operationId) ||
        operationId === current.state.operationId ||
        operationId === update.issuanceOperationId
      )
        throw new Error("uuid_collision");
      const next = structuredClone(current.state);
      const credential = next.credentials[index];
      if (!credential) throw new Error("presentation_target_missing");
      next.revision = current.state.revision + 1;
      next.operationId = operationId;
      credential.presentation = update.target;
      const parsed = parseAccessManagementState(serialize(next));
      if (parsed.status !== "parsed")
        throw new Error("presentation_candidate_invalid");
      const result = publishState(root, current, parsed.state, "credential");
      return result.status === "completed"
        ? {
            ...result,
            value: {
              revision: result.value.revision,
              operationId: result.value.operationId,
              credentialId: update.credentialId,
              issuanceOperationId: update.issuanceOperationId,
              presentationOperationId:
                update.target === "unconfirmed"
                  ? result.value.operationId
                  : update.presentationOperationId,
              presentation: update.target,
            },
          }
        : result;
    } catch {
      return {
        status: "unavailable",
        reason: "state_store_presentation_failed",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
}

/**
 * 通常鍵変更の内部結果を表す。
 * @responsibility 認可前拒否と今回の保存事実・一度の短命鍵を分離する。
 * @trace ARCH-000013
 * @shape completedは受付・対象・改訂、issueだけtoken。失敗は非秘密の出版観測。
 * @invariant 生鍵は保存・読戻し・材料清掃・Lock解放を確認した新規発行だけ。
 * @boundary 同Processの信頼済みWorkbench提示Owner。MCP結果ではない。
 * @security completedのtokenをlog・Evidence・通常readへ複製しない。
 * @compatibility 最新Schemaの通常発行・独立失効。交換・Host入口は別。
 */
export type CredentialManagementResult =
  | (Readonly<{
      status: "completed";
      operationId: string;
      expectedRevision: number;
      revision: number;
      userId: string;
      credentialId: string;
      publication: "confirmed";
      cleanupConfirmed: true;
    }> &
      (
        | Readonly<{ operation: "issueCredential"; token: string }>
        | Readonly<{ operation: "revokeCredential"; token?: never }>
      ))
  | Readonly<{
      status: "unavailable";
      reason: "credential_management_rejected";
    }>
  | Readonly<{
      status: "unavailable";
      reason: "credential_management_unavailable";
      primaryFailure: string;
      operationId: string;
      expectedRevision: number;
      observedRevision: number | null;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
    }>;

/**
 * 通常鍵変更の現在判定と物理保存を同じLockで実行する。
 * @responsibility 容量予約前の生成を禁止し、保存後の不明でSecretを返さない。
 * @trace ARCH-000013
 * @input 検証済みRoot・Bearer・期待改訂・受付UUID・固定操作・exact対象。
 * @returns 閉じた管理結果。新規成功発行だけ短命token。
 * @precondition 同Processの内部提示Ownerが呼ぶ。
 * @postcondition 対象外の資格・User・Role・登録・初回・交換状態を保持する。
 * @effect 既存Lockとpending／replace／current。issueだけ容量確認後に鍵生成。
 * @failure 認可前は固定拒否、認可後は主失敗と今回出版事実を保持する。
 * @invariant 先行出版を今回成功へ帰属せず、既失効を再出版しない。
 * @boundary 鍵変更の意味判断と既存保存Adapter。
 * @security Secretを失敗結果・例外本文へ含めず、内部Lock回復参照も公開しない。
 * @concurrency 既存Lock内で現在認可・対象・改訂・容量・保存を直列化する。
 */
function executeCredentialManagementMutation(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  operation: "issueCredential" | "revokeCredential",
  userId: unknown,
  credentialId?: unknown,
): CredentialManagementResult {
  if (
    typeof token !== "string" ||
    !readCredentialId(token) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId) ||
    typeof userId !== "string" ||
    !ATTEMPT_UUID.test(userId) ||
    (operation === "revokeCredential" &&
      (typeof credentialId !== "string" ||
        !/^[0-9a-f]{24}$/.test(credentialId)))
  )
    return { status: "unavailable", reason: "credential_management_rejected" };
  let admitted = false;
  let issuedToken: string | undefined;
  let targetCredentialId: string | null = null;
  let publication: "not_attempted" | "unconfirmed" | "confirmed" =
    "not_attempted";
  const result = locked(root, () => {
    let revision: number | null = null;
    let stage = "read";
    let cleanupConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      stage = "authorization";
      const prepared = prepareCredentialChange(
        token,
        current.state,
        expectedRevision,
        operationId,
        operation,
        userId,
        credentialId,
      );
      if (!prepared)
        return {
          status: "unavailable" as const,
          reason: "credential_management_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      admitted = true;
      stage = "pending";
      const settled = settlePending(root, current, () => {});
      cleanupConfirmed = true;
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
        "credential",
      );
      if (
        reservation.nextBytes.byteLength > CURRENT_LIMIT ||
        reservation.pendingBytes.byteLength > PENDING_LIMIT
      )
        throw new Error("credential_capacity");
      const target = prepared.next.credentials[prepared.credentialIndex];
      if (!target) throw new Error("credential_target_invalid");
      if (operation === "issueCredential") {
        stage = "generation";
        const material = createCredentialMaterial();
        if (
          current.state.credentials.some(
            (item) => item.credentialId === material.credentialId,
          )
        )
          throw new Error("credential_identity_collision");
        target.credentialId = material.credentialId;
        target.tokenSalt = material.tokenSalt;
        target.tokenVerifier = material.tokenVerifier;
        issuedToken = material.token;
      }
      targetCredentialId = target.credentialId;
      stage = "candidate";
      const parsed = parseAccessManagementState(serialize(prepared.next));
      if (parsed.status !== "parsed")
        throw new Error("credential_candidate_invalid");
      stage = "publication";
      const published = publishState(root, current, parsed.state, "credential");
      publication = published.publication;
      return published;
    } catch {
      return {
        status: "unavailable" as const,
        reason: `state_store_credential_${stage}_failed`,
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
  if (!admitted)
    return { status: "unavailable", reason: "credential_management_rejected" };
  if (result.status === "completed" && targetCredentialId !== null) {
    const completed = {
      status: "completed" as const,
      operationId,
      expectedRevision,
      revision: result.value.revision,
      userId,
      credentialId: targetCredentialId,
      publication: "confirmed" as const,
      cleanupConfirmed: true as const,
    };
    if (operation === "issueCredential" && typeof issuedToken === "string")
      return { ...completed, operation, token: issuedToken };
    if (operation === "revokeCredential") return { ...completed, operation };
  }
  return {
    status: "unavailable",
    reason: "credential_management_unavailable",
    primaryFailure:
      result.status === "unavailable"
        ? result.reason
        : "state_store_credential_result_invalid",
    operationId,
    expectedRevision,
    observedRevision: result.revision,
    publication: result.publication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 既存Userへ通常の鍵を一回発行して保存する。
 * @responsibility 現在administratorの要求だけを一資格追加へ接続する。
 * @trace ARCH-000013
 * @input Root・Bearer・期待改訂・受付UUID・既存userId。
 * @returns 新規成功保存時だけ短命鍵と非秘密相関、または未完了。
 * @precondition 通常Workbenchの同Process提示Ownerだけが呼ぶ。
 * @postcondition 既存資格失効0、元受付Identityを資格へ保存する。
 * @effect 容量予約後の鍵生成と既存状態出版。
 * @failure 生成・保存・清掃・解放不明ではSecret返却0。
 * @invariant 元発行の再要求からSecretを再取得・再発行しない。
 * @boundary 内部保存APIと一度提示Owner。
 * @security tokenをMCP・log・履歴へ公開しない。
 * @concurrency 既存同Lockで現在認可する。
 */
export function issueCredential(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  userId: unknown,
): CredentialManagementResult {
  return executeCredentialManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    "issueCredential",
    userId,
  );
}

/**
 * exact資格とUser結合だけを独立失効する。
 * @responsibility 新発行・交換・対象外失効を行わない。
 * @trace ARCH-000013
 * @input Root・Bearer・期待改訂・受付UUID・userId・credentialId。
 * @returns 今回出版の非秘密結果、または固定拒否／未完了。
 * @precondition 通常Workbenchの現在administrator。
 * @postcondition 元発行ID・提示状態・対象外情報を保持する。
 * @effect exact資格のrevokedと状態改訂だけを保存する。
 * @failure 既失効・不一致は出版0。応答喪失をrollbackへ戻さない。
 * @invariant 同request IDと既失効だけから元要求completedを推定しない。
 * @boundary 内部通常失効API。Host／MCPへ公開しない。
 * @security Secret・新資格・交換Recovery 0。
 * @concurrency 既存Lock下で現在認可とexact対象を照合する。
 */
export function revokeCredential(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  userId: unknown,
  credentialId: unknown,
): CredentialManagementResult {
  return executeCredentialManagementMutation(
    root,
    token,
    expectedRevision,
    operationId,
    "revokeCredential",
    userId,
    credentialId,
  );
}

/**
 * 現在資格観測の閉じた結果を表す。
 * @responsibility 現在の保存事実と元要求完了・未発行を区別する。
 * @trace ARCH-000013
 * @shape observedの非秘密snapshot、または固定unavailable。
 * @invariant unavailableは未発行・削除・元要求失敗の確定ではない。
 * @boundary 同Processの管理者向けConsumer。MCPに公開しない。
 * @security 秘密・内部Path・他資格・Recovery参照なし。
 * @compatibility 通常管理read四kindは不変更。
 */
export type CredentialIssuanceObservation =
  | Readonly<{ status: "observed"; snapshot: CredentialIssuanceSnapshot }>
  | Readonly<{
      status: "unavailable";
      reason: "credential_issuance_unavailable";
    }>;

/**
 * 現在管理者へ元発行IDとUserのexact保存事実だけを返す。
 * @responsibility 材料処置・Lock解放不明から古い資格事実を返さない。
 * @trace ARCH-000013
 * @input 検証済みRoot・Bearer・元発行UUID・User UUID。
 * @returns 非秘密の現在観測、または固定unavailable。
 * @precondition 同Processの信頼済みWorkbench Consumerが呼ぶ。
 * @postcondition 既存材料処置がnone、Lock解放確認済みの場合だけ事実を返す。
 * @effect 同Lock current読取り・現在認証・相関確認後だけ既存材料処置。
 * @failure 材料処置・清掃・観測・解放不明、未許可は事実0。
 * @invariant 生成・再表示・Receipt・元失効要求のcompleted推定0。
 * @boundary 専用の資格読取りと既存Filesystem保存Owner。
 * @security token・salt・Verifier・内部Root・他User情報を透過しない。
 * @concurrency 同じLock内で照合し、材料を処置した要求は次のfresh要求へ戻す。
 */
export function readCredentialIssuance(
  root: FilesystemStoreRoot,
  token: string,
  issuanceOperationId: string,
  userId: string,
): CredentialIssuanceObservation {
  const unavailable = Object.freeze({
    status: "unavailable" as const,
    reason: "credential_issuance_unavailable" as const,
  });
  if (
    typeof token !== "string" ||
    !readCredentialId(token) ||
    typeof issuanceOperationId !== "string" ||
    !ATTEMPT_UUID.test(issuanceOperationId) ||
    typeof userId !== "string" ||
    !ATTEMPT_UUID.test(userId)
  )
    return unavailable;
  const result = locked<CredentialIssuanceSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const snapshot = projectCredentialIssuance(
        token,
        current.state,
        issuanceOperationId,
        userId,
      );
      if (!snapshot || settlePending(root, current, () => {}) !== "none")
        return {
          status: "unavailable",
          reason: "credential_issuance_unavailable",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: false,
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
        reason: "credential_issuance_unavailable",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? Object.freeze({ status: "observed", snapshot: result.value })
    : unavailable;
}

/**
 * 鍵交換の保存済み段階と短命結果を分離する。
 * @responsibility core保存完了を提示・未解決record整理の完了にしない。
 * @trace ARCH-000013
 * @shape completedはcredential_storedの非秘密相関と新規時だけのtoken。拒否は固定理由、保存不明は最初の失敗と最後の確認段階。
 * @invariant 通常新規はprepared未確定でnull/null/not_started。引継ぎは旧record三値を新prepared確定後だけ新へ切替。失敗結果にtokenなし。
 * @boundary 同Process Workbench／信頼Hostの内部Consumer専用。
 * @security tokenは一回提示Ownerだけが扱い、MCP・log・履歴・一般DTOへ渡さない。
 * @compatibility 現Schema v2。提示Consumerは未接続、record終了は別内部入口。
 */
export type KeyExchangeResult =
  | Readonly<{
      status: "completed";
      operationId: string;
      recoveryId: string;
      entry: "workbench" | "host";
      scope: "targeted" | "all";
      userId: string;
      oldCredentialIds: readonly string[];
      credentialId: string;
      expectedRevision: number;
      revision: number;
      lastConfirmedStage: "credential_stored";
      token: string | null;
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_rejected";
      token?: never;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_unavailable";
      operationId: string;
      recoveryId: string | null;
      expectedRevision: number;
      observedRevision: number | null;
      lastConfirmedOperationId: string | null;
      lastConfirmedStage:
        | "not_started"
        | "prepared"
        | "revoked"
        | "credential_stored";
      firstFailure:
        | "read"
        | "pending"
        | "candidate"
        | "capacity"
        | "generation"
        | "prepare"
        | "publish"
        | "read_back"
        | "cleanup"
        | "release";
      secondaryFailure: "release" | null;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
      token?: never;
    }>;

/**
 * 交換の現在認可と三段階出版を同じLockで実行する。
 * @responsibility 失効前の相関確定と失効後の一生成を既存保存へ接続する。
 * @trace ARCH-000013
 * @input Root、入口・鍵、期待改訂、交換UUID、範囲、既存発行先、表示集合、確認。
 * @returns 保存完了結果または非秘密の拒否・未完了。
 * @precondition 同Processの提示Ownerまたはログイン済みHost入口。事前表示はConsumerが完了済み。
 * @postcondition 未解決recordと提示not_attemptedを保持し、新規保存・清掃・解放成功時だけtokenを返す。
 * @effect prepared・revoked・credential_storedを別出版。失効確定後だけ容量予約・一生成。
 * @failure 各境界不成立で先へ進まず、最初の失敗と最後の確認段階を分ける。
 * @invariant 同要求内で失効後の旧鍵再認可0。別要求はfresh認可。stored再生成0。
 * @boundary 現在Authority、Filesystem出版、短命提示用結果。
 * @security 生鍵保存・再表示・新Recovery・内部Path公開なし。
 * @concurrency 既存Lock一つ。同一要求のadmissionを次要求へ保存しない。
 */
function executeKeyExchange(
  root: FilesystemStoreRoot,
  entry: "workbench" | "host",
  token: string | null,
  expectedRevision: number,
  operationId: string,
  scope: "targeted" | "all",
  recipientUserId: string,
  displayedOldCredentialIds: unknown,
  confirmed: boolean,
  previousRecoveryId?: string,
): KeyExchangeResult {
  const displayed = readDisplayedCredentialIds(displayedOldCredentialIds);
  if (
    !displayed ||
    (previousRecoveryId !== undefined &&
      !isKeyExchangeRecoveryId(previousRecoveryId)) ||
    (entry !== "host" && entry !== "workbench") ||
    (entry === "host"
      ? token !== null
      : typeof token !== "string" || !readCredentialId(token)) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId) ||
    (scope !== "all" && scope !== "targeted") ||
    typeof recipientUserId !== "string" ||
    !ATTEMPT_UUID.test(recipientUserId) ||
    typeof confirmed !== "boolean" ||
    ((entry === "host" || scope === "all") && !confirmed)
  )
    return { status: "unavailable", reason: "key_exchange_rejected" };
  let admitted = false;
  let issuedToken: string | null = null;
  let recoveryId: string | null = null;
  let lastConfirmedOperationId: string | null = null;
  let lastConfirmedStage:
    | "not_started"
    | "prepared"
    | "revoked"
    | "credential_stored" = "not_started";
  let firstFailure: Extract<
    KeyExchangeResult,
    { reason: "key_exchange_unavailable" }
  >["firstFailure"] = "read";
  const result = locked(root, () => {
    let revision: number | null = null;
    let publication: "not_attempted" | "unconfirmed" | "confirmed" =
      "not_attempted";
    let cleanupConfirmed = false;
    try {
      let current = readCurrent(root);
      revision = current.state.revision;
      const continuation = selectKeyExchangeContinuation(
        current.state,
        entry,
        token,
        expectedRevision,
        operationId,
        scope,
        recipientUserId,
        displayed,
        confirmed,
        previousRecoveryId,
      );
      const prepared = continuation
        ? null
        : prepareKeyExchange(
            current.state,
            entry,
            token,
            expectedRevision,
            operationId,
            scope,
            recipientUserId,
            displayed,
            confirmed,
            previousRecoveryId,
          );
      if (!continuation && !prepared)
        return {
          status: "unavailable" as const,
          reason: "key_exchange_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      admitted = true;
      if (continuation) {
        recoveryId = continuation.recoveryId;
        lastConfirmedOperationId = continuation.operationId;
        lastConfirmedStage = continuation.stage;
      } else if (previousRecoveryId !== undefined) {
        const previous = current.state.unresolvedKeyExchanges[0];
        if (previous) {
          recoveryId = previous.recoveryId;
          lastConfirmedOperationId = previous.operationId;
          lastConfirmedStage = previous.stage;
        }
      }
      firstFailure = "pending";
      const settled = settlePending(root, current, () => {});
      cleanupConfirmed = true;
      if (settled !== "none")
        return {
          status: "unavailable" as const,
          reason: "state_store_previous_pending_settled",
          publication,
          revision,
          cleanupConfirmed: true,
        };
      let next = prepared;
      while (true) {
        const exchange = current.state.unresolvedKeyExchanges[0];
        if (!next && exchange?.stage === "credential_stored")
          return {
            status: "completed" as const,
            value: {
              exchange: structuredClone(exchange),
              revision: current.state.revision,
            },
            publication: "confirmed" as const,
            revision: current.state.revision,
            cleanupConfirmed: true as const,
          };
        firstFailure = "candidate";
        if (!next && exchange?.stage === "prepared")
          next = prepareKeyExchangeRevocation(
            current.state,
            exchange.recoveryId,
          );
        else if (!next && exchange?.stage === "revoked") {
          firstFailure = "capacity";
          const reservation = prepareExchangedCredential(
            current.state,
            exchange.recoveryId,
            {
              credentialId: "f".repeat(24),
              tokenSalt: "f".repeat(32),
              tokenVerifier: "f".repeat(64),
            },
          );
          if (!reservation) throw new Error("candidate");
          const reserved = preparePublicationBytes(
            current,
            reservation,
            "credential",
          );
          if (
            reserved.nextBytes.byteLength > CURRENT_LIMIT ||
            reserved.pendingBytes.byteLength > PENDING_LIMIT
          )
            throw new Error("capacity");
          firstFailure = "generation";
          const material = createCredentialMaterial();
          if (
            current.state.credentials.some(
              (item) => item.credentialId === material.credentialId,
            )
          )
            throw new Error("collision");
          next = prepareExchangedCredential(
            current.state,
            exchange.recoveryId,
            material,
          );
          issuedToken = material.token;
        }
        if (!next) throw new Error("candidate");
        const parsed = parseAccessManagementState(serialize(next));
        if (parsed.status !== "parsed") throw new Error("candidate");
        firstFailure = "prepare";
        publication = "not_attempted";
        cleanupConfirmed = false;
        const published = publishState(
          root,
          current,
          parsed.state,
          "credential",
        );
        publication = published.publication;
        revision = published.revision;
        cleanupConfirmed = published.cleanupConfirmed;
        if (published.publication === "confirmed") {
          const known = parsed.state.unresolvedKeyExchanges[0];
          if (known) {
            recoveryId = known.recoveryId;
            lastConfirmedOperationId = known.operationId;
            lastConfirmedStage = known.stage;
          }
        }
        if (published.status !== "completed") {
          firstFailure =
            published.reason === "state_store_publish_failed"
              ? "publish"
              : published.reason === "state_store_read_back_failed"
                ? "read_back"
                : published.reason === "state_store_cleanup_failed"
                  ? "cleanup"
                  : published.reason === "state_store_capacity_exceeded"
                    ? "capacity"
                    : "prepare";
          return published;
        }
        firstFailure = "read_back";
        current = readCurrent(root);
        if (!current.bytes.equals(serialize(parsed.state)))
          throw new Error("read_back");
        next = null;
      }
    } catch {
      return {
        status: "unavailable" as const,
        reason: "state_store_key_exchange_failed",
        publication,
        revision,
        cleanupConfirmed,
      };
    }
  });
  if (!admitted)
    return { status: "unavailable", reason: "key_exchange_rejected" };
  if (result.status === "completed") {
    const exchange = result.value.exchange;
    return {
      status: "completed",
      operationId,
      recoveryId: exchange.recoveryId,
      entry: exchange.entry,
      scope: exchange.scope,
      userId: exchange.recipientUserId,
      oldCredentialIds: Object.freeze([...exchange.oldCredentialIds]),
      credentialId: exchange.newCredentialId,
      expectedRevision,
      revision: result.value.revision,
      lastConfirmedStage: "credential_stored",
      token: issuedToken,
      cleanupConfirmed: true,
    };
  }
  const releaseFailure =
    !!result.secondaryReason ||
    !!result.lockRecoveryId ||
    result.reason === "state_store_lock_unknown";
  return {
    status: "unavailable",
    reason: "key_exchange_unavailable",
    operationId,
    recoveryId,
    expectedRevision,
    observedRevision: result.revision,
    lastConfirmedOperationId,
    lastConfirmedStage,
    firstFailure:
      releaseFailure &&
      result.reason !== "state_store_key_exchange_failed" &&
      !result.secondaryReason
        ? "release"
        : firstFailure,
    secondaryFailure:
      releaseFailure && result.secondaryReason ? "release" : null,
    publication: result.publication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 現在administratorの指定／全員交換を保存する。
 * @responsibility Workbench同Processだけを交換保存へ接続する。
 * @trace ARCH-000013
 * @input Root・現在鍵・期待改訂・交換UUID・範囲・発行先・表示旧集合・確認・任意の前交換参照。
 * @returns core保存結果。新規成功時だけ一度提示用token。
 * @precondition 事前表示済み。全員だけ明示確認。提示Ownerが後続処置を担う。
 * @postcondition recordと未提示事実を保持し、入力対象外を変更しない。
 * @effect 既存Lock内の三出版と一資格生成。
 * @failure 現在非管理者・別相関・保存／清掃／解放不明は停止。
 * @invariant Recoveryは認可ではなく、旧鍵の再認証は別要求だけ。
 * @boundary Workbench BackendからAMへの用途限定内部入口。
 * @security MCP公開・秘密保存・再表示0。
 * @concurrency 同期保存。同一受付は現在recordで再観測する。
 */
export function exchangeCredentials(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  scope: "targeted" | "all",
  recipientUserId: string,
  displayedOldCredentialIds: unknown,
  confirmed: boolean,
  previousRecoveryId?: string,
): KeyExchangeResult {
  return executeKeyExchange(
    root,
    "workbench",
    token,
    expectedRevision,
    operationId,
    scope,
    recipientUserId,
    displayedOldCredentialIds,
    confirmed,
    previousRecoveryId,
  );
}

/**
 * 信頼Hostの指定／全員交換とexact継続を保存する。
 * @responsibility 資格喪失でも新Recoveryや起点entry変更なしで進める。
 * @trace ARCH-000013
 * @input Root・期待改訂・交換UUID・範囲・発行先・表示旧集合・確認・任意の前交換参照。
 * @returns core保存結果。stored再入場はtoken null。
 * @precondition ログイン済みHost入口。双方事前表示と明示確認済み。
 * @postcondition 起点entryとexact相関を保持する。
 * @effect 既存保存処理だけ。追加認証・OS昇格なし。
 * @failure 不明・対象差・未確認・材料不明は停止。
 * @invariant 初回途中は同User指定だけ。初期化・Role修復へ転用しない。
 * @boundary Host対話Ownerから用途限定保存。
 * @security Remote／MCPから呼ばない。生鍵の再取得・保存0。
 * @concurrency 同じ既存Lockで現在状態を再照合する。
 */
export function exchangeCredentialsFromHost(
  root: FilesystemStoreRoot,
  expectedRevision: number,
  operationId: string,
  scope: "targeted" | "all",
  recipientUserId: string,
  displayedOldCredentialIds: unknown,
  confirmed: boolean,
  previousRecoveryId?: string,
): KeyExchangeResult {
  return executeKeyExchange(
    root,
    "host",
    null,
    expectedRevision,
    operationId,
    scope,
    recipientUserId,
    displayedOldCredentialIds,
    confirmed,
    previousRecoveryId,
  );
}

/**
 * 交換終了の確定と保存不明を区別する。
 * @responsibility 失敗理由を後続解放不明で上書きせず、秘密と内部Pathを返さない。
 * @trace ARCH-000013
 * @shape completedは改訂・終了操作・交換参照・清掃確認。拒否は固定理由。admit後不明は出版観測と二失敗。
 * @invariant record不在から終了済みを再構成しない。
 * @boundary 同Process Workbench／信頼Host内部Consumer。
 * @security 生鍵・Verifier・内部Lock相関を含めない。
 * @compatibility 現Schemaの確認済み交換だけ。
 */
export type KeyExchangeCompletionResult =
  | Readonly<{
      status: "completed";
      revision: number;
      operationId: string;
      recoveryId: string;
      cleanupConfirmed: true;
    }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_completion_rejected";
    }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_completion_unavailable";
      operationId: string;
      recoveryId: string;
      observedRevision: number | null;
      firstFailure:
        | "pending"
        | "prepare"
        | "publish"
        | "read_back"
        | "cleanup"
        | "capacity"
        | "release";
      secondaryFailure: "release" | null;
      publication: "not_attempted" | "unconfirmed" | "confirmed";
      cleanupConfirmed: boolean;
    }>;

/**
 * 確認済み交換の終了候補を既存保存へ接続する。
 * @responsibility 現在認可を材料処置前に検査し、recordだけを一出版で除去する。
 * @trace ARCH-000013
 * @input Root、入口・鍵、期待改訂、終了操作UUID、exact交換参照。
 * @returns 非秘密の確定結果または拒否・保存不明。
 * @precondition Workbench同Processまたはログイン済みHostの内部Owner。
 * @postcondition 資格・提示・初回・対象外field不変。
 * @effect 既存Lockとpending／replaceによる一出版・読戻し・材料清掃。
 * @failure 未確認は処置0。材料処置・保存・解放不明は停止。
 * @invariant Secret破棄やrecord不在を終了成功へ変換しない。
 * @boundary 現在認可・exact終了・Filesystem確定。
 * @security 生鍵なし。認可前に材料処置しない。
 * @concurrency 既存単一Lockへ閉じ、次要求はfresh再評価。
 */
function completeKeyExchange(
  root: FilesystemStoreRoot,
  entry: "workbench" | "host",
  token: string | null,
  expectedRevision: number,
  operationId: string,
  recoveryId: string,
): KeyExchangeCompletionResult {
  if (
    !isKeyExchangeRecoveryId(recoveryId) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId) ||
    (entry === "workbench" &&
      (typeof token !== "string" || !readCredentialId(token)))
  )
    return {
      status: "unavailable",
      reason: "key_exchange_completion_rejected",
    };
  let admitted = false;
  let firstFailure: Extract<
    KeyExchangeCompletionResult,
    { reason: "key_exchange_completion_unavailable" }
  >["firstFailure"] = "pending";
  const result = locked<Readonly<{ revision: number; operationId: string }>>(
    root,
    () => {
      let revision: number | null = null;
      let cleanupConfirmed = false;
      try {
        const current = readCurrent(root);
        revision = current.state.revision;
        const next = prepareKeyExchangeCompletion(
          current.state,
          entry,
          token,
          expectedRevision,
          operationId,
          recoveryId,
        );
        if (!next)
          return {
            status: "unavailable",
            reason: "state_store_completion_rejected",
            publication: "not_attempted",
            revision,
            cleanupConfirmed: true,
          };
        admitted = true;
        if (settlePending(root, current, () => {}) !== "none")
          return {
            status: "unavailable",
            reason: "state_store_previous_pending_settled",
            publication: "not_attempted",
            revision,
            cleanupConfirmed: true,
          };
        cleanupConfirmed = true;
        firstFailure = "prepare";
        const parsed = parseAccessManagementState(serialize(next));
        if (parsed.status !== "parsed") throw new Error("candidate");
        const published = publishState(
          root,
          current,
          parsed.state,
          "credential",
        );
        if (published.status !== "completed")
          firstFailure =
            published.reason === "state_store_publish_failed"
              ? "publish"
              : published.reason === "state_store_read_back_failed"
                ? "read_back"
                : published.reason === "state_store_cleanup_failed"
                  ? "cleanup"
                  : published.reason === "state_store_capacity_exceeded"
                    ? "capacity"
                    : "prepare";
        return published;
      } catch {
        return {
          status: "unavailable",
          reason: "state_store_completion_failed",
          publication: "not_attempted",
          revision,
          cleanupConfirmed,
        };
      }
    },
  );
  if (!admitted)
    return {
      status: "unavailable",
      reason: "key_exchange_completion_rejected",
    };
  if (result.status === "completed")
    return {
      status: "completed",
      revision: result.value.revision,
      operationId,
      recoveryId,
      cleanupConfirmed: true,
    };
  const releaseFailure =
    !!result.secondaryReason ||
    !!result.lockRecoveryId ||
    result.reason === "state_store_lock_unknown";
  return {
    status: "unavailable",
    reason: "key_exchange_completion_unavailable",
    operationId,
    recoveryId,
    observedRevision: result.revision,
    firstFailure:
      releaseFailure &&
      !result.secondaryReason &&
      result.reason !== "state_store_completion_failed"
        ? "release"
        : firstFailure,
    secondaryFailure:
      releaseFailure && result.secondaryReason ? "release" : null,
    publication: result.publication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 現在管理者の確認済み交換を閉じる。
 * @responsibility Workbench内部の終了処置を現在資格で認可する。
 * @trace ARCH-000013
 * @input Root、現在鍵、期待改訂、終了操作UUID、交換参照。
 * @returns 非秘密の終了結果。
 * @precondition 同Process内部Consumer、提示confirmed。
 * @postcondition record以外を保持する。
 * @effect 既存保存Ownerの一出版。
 * @failure 非管理者・未知・未確認・保存不明は停止。
 * @invariant 拒否とrecord不在から完了を推定しない。
 * @boundary Workbench内部とAM。
 * @security MCPへ公開しない。
 * @concurrency 既存Lockでfresh再認可。
 */
export function finishKeyExchange(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  recoveryId: string,
): KeyExchangeCompletionResult {
  return completeKeyExchange(
    root,
    "workbench",
    token,
    expectedRevision,
    operationId,
    recoveryId,
  );
}

/**
 * 信頼Hostの確認済み交換を閉じる。
 * @responsibility 資格喪失時も現在exact交換だけを整理する。
 * @trace ARCH-000013
 * @input Root、期待改訂、終了操作UUID、交換参照。
 * @returns 非秘密の終了結果。
 * @precondition ログイン済みHost内部入口。初回は同UserのHost指定だけ。
 * @postcondition record以外を保持する。
 * @effect 既存保存Ownerの一出版。
 * @failure 相関・提示・保存不明は停止。
 * @invariant 追加認証・初期化・Role修復をしない。
 * @boundary 信頼HostとAM。
 * @security Remote／MCPへ公開しない。
 * @concurrency 同じ既存Lockで再評価。
 */
export function finishKeyExchangeFromHost(
  root: FilesystemStoreRoot,
  expectedRevision: number,
  operationId: string,
  recoveryId: string,
): KeyExchangeCompletionResult {
  return completeKeyExchange(
    root,
    "host",
    null,
    expectedRevision,
    operationId,
    recoveryId,
  );
}

/**
 * 交換の非秘密観測と固定未取得を分離する。
 * @responsibility 記録不在・状態不明を過去の完了へ変換しない。
 * @trace ARCH-000013
 * @shape observedは現在投影、unavailableは固定理由だけ。
 * @invariant 読取りから失効・生成・提示・record終了を行わない。
 * @boundary 同Process Workbench／信頼Host Consumer。
 * @security 生鍵・内部Root・Lock回復情報を含めない。
 * @compatibility 現v2の交換参照のみ。MCP非公開。
 */
export type KeyExchangeObservation =
  | Readonly<{ status: "observed"; snapshot: KeyExchangeSnapshot }>
  | Readonly<{
      status: "unavailable";
      reason: "key_exchange_state_unavailable";
    }>;

/**
 * 現在Authorityとexact参照を既存Lockの読取りへ接続する。
 * @responsibility 認可前処置・材料処置後の旧事実返却を拒否する。
 * @trace ARCH-000013
 * @input Root、現在入口・鍵、exact Recovery。
 * @returns 凍結された非秘密観測または固定未取得。
 * @precondition Workbench同Processまたは信頼Host内部Ownerだけ。
 * @postcondition 材料処置noneとLock解放確認後だけ現在事実を返す。
 * @effect current・現在認可・相関を照合後、既存材料だけ処置する。
 * @failure 観測・清掃・解放不明では事実0。
 * @invariant 新出版・失効・生成・提示・record終了0。
 * @boundary 資格の投影とFilesystem保存Owner。
 * @security Snapshot内部材料・Secret・Lock参照の透過0。
 * @concurrency 同じLock一回。材料処置要求はfresh次要求へ戻す。
 */
function observeKeyExchange(
  root: FilesystemStoreRoot,
  entry: "workbench" | "host",
  token: string | null,
  recoveryId: string,
): KeyExchangeObservation {
  const unavailable = Object.freeze({
    status: "unavailable" as const,
    reason: "key_exchange_state_unavailable" as const,
  });
  if (
    !isKeyExchangeRecoveryId(recoveryId) ||
    (entry === "workbench" &&
      (typeof token !== "string" || !readCredentialId(token)))
  )
    return unavailable;
  const result = locked<KeyExchangeSnapshot>(root, () => {
    try {
      const current = readCurrent(root);
      const snapshot = projectKeyExchangeState(
        current.state,
        entry,
        token,
        recoveryId,
      );
      if (!snapshot || settlePending(root, current, () => {}) !== "none")
        return {
          status: "unavailable",
          reason: "key_exchange_state_unavailable",
          publication: "not_attempted",
          revision: null,
          cleanupConfirmed: false,
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
        reason: "key_exchange_state_unavailable",
        publication: "not_attempted",
        revision: null,
        cleanupConfirmed: false,
      };
    }
  });
  return result.status === "completed"
    ? Object.freeze({ status: "observed", snapshot: result.value })
    : unavailable;
}

/**
 * 現在administratorへHost起点も含めexact交換を非秘密観測する。
 * @responsibility 起点entryを維持し、継続の入口制約を弱めない。
 * @trace ARCH-000013
 * @input Root・現在Bearer・exact Recovery。
 * @returns 非秘密観測または固定未取得。
 * @precondition 同ProcessのWorkbench管理読取りOwnerだけ。
 * @postcondition 交換や提示を進めず、現在事実だけを返す。
 * @effect 既存Lock読取りと許可後の材料処置だけ。
 * @failure 非管理者・初回途中・不明は事実0。
 * @invariant 記録不存在からclosedを推定しない。
 * @boundary Workbench内部の状態読取り。
 * @security MCP公開・秘密値の返却0。
 * @concurrency 毎回現在Authorityを再照合する。
 */
export function readKeyExchangeState(
  root: FilesystemStoreRoot,
  token: string,
  recoveryId: string,
): KeyExchangeObservation {
  return observeKeyExchange(root, "workbench", token, recoveryId);
}

/**
 * 信頼Hostへexact交換の非秘密な現在状態だけを返す。
 * @responsibility 資格喪失時の観測を新交換やAuthority復元と分ける。
 * @trace ARCH-000013
 * @input Root・exact Recovery。
 * @returns 非秘密観測または固定未取得。
 * @precondition ログイン済みHostの内部Owner。初回は同User指定交換だけ。
 * @postcondition 追加確認・失効・生成・提示・終了処置なし。
 * @effect 既存Lockとcurrent観測、許可後の材料処置だけ。
 * @failure 相関・段階・観測不明は事実0。
 * @invariant Host信頼をRemoteへ転用しない。
 * @boundary Host内部状態確認。
 * @security token・Verifier・salt・内部Path公開0。
 * @concurrency 毎回完全currentで再評価する。
 */
export function readKeyExchangeStateFromHost(
  root: FilesystemStoreRoot,
  recoveryId: string,
): KeyExchangeObservation {
  return observeKeyExchange(root, "host", null, recoveryId);
}

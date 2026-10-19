/**
 * 管理状態の読取り・保存確定・読戻し・短命材料の清掃を所有する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { createHash } from "node:crypto";
import fs from "node:fs";
import {
  type FilesystemStoreRoot,
  readStableBoundedFileSnapshot,
  resolveFilesystemStorePath,
} from "../../../domain-model/src/index.ts";
import { locked } from "./lock.ts";
import { parseAccessManagementState } from "./parse.ts";
import type { AccessManagementState, StateStoreResult } from "./types.ts";

export const CURRENT = "access-management.json";

export const PENDING = "access-management.pending.json";

export const REPLACE = "access-management.replace.json";

export const CURRENT_LIMIT = 16_777_216;

export const PENDING_LIMIT = 17_825_792;

const HASH = /^[a-f0-9]{64}$/u;

export const ATTEMPT_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

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
export function serialize(value: unknown): Buffer {
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
export function hash(bytes: Uint8Array): string {
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
export function present(root: FilesystemStoreRoot, name: string): boolean {
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
export function readCurrent(root: FilesystemStoreRoot) {
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
export function writeExclusive(
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
export function ordinaryChange(
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
export function settlePending(
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
export function publishState(
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
export function preparePublicationBytes(
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

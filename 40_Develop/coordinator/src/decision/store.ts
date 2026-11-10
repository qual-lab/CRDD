/**
 * Coordinatorの判断記録を、保存先実体・排他・世代・Hash連続性を確認して保存する。
 *
 * @responsibility VerifiedRootを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import type { LockResult } from "../../../lock/src/index.ts";
import { poisonRuntimeProcessAfterCleanupUnknown } from "../execution/process-safety-state.ts";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { CoordinatorDecisionRecord } from "../../../domain-model/src/index.ts";
import {
  isCoordinatorDecisionRecord,
  readCommittedJson,
  writeCommittedJson,
} from "../../../domain-model/src/index.ts";
import { runtimeStateDirectoryCandidate } from "../execution/authority.ts";
import { acquireRuntimeStateLock } from "../execution/kernel-lock.ts";
import type { CoordinatorDecisionStore } from "./types.ts";

export const COORDINATOR_WINDOWS_DECISION_STORE_CONTRACT =
  "crdd-coordinator/orchestrator-windows-decision-store/v1" as const;

const ENTRY = /^project-decision-([0-9a-f]{40})-([0-9]{8})\.json$/u;

/**
 * windows-decision-storeで使用するVerified Rootの値契約を定義する。
 *
 * @responsibility Verified RootのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape VerifiedRootが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerifiedRootで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerifiedRootの宣言は外部境界を開かない。
 * @security VerifiedRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility VerifiedRootの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type VerifiedRoot = Readonly<{ rootPath: string; identity: string }>;
/**
 * windows-decision-storeで使用するEnvelopeの値契約を定義する。
 *
 * @responsibility EnvelopeのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape Envelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Envelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: Envelopeの宣言は外部境界を開かない。
 * @security EnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Envelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Envelope = Readonly<{
  contract: typeof COORDINATOR_WINDOWS_DECISION_STORE_CONTRACT;
  recordId: string;
  generation: number;
  previousHash: string | null;
  value: CoordinatorDecisionRecord;
}>;

/**
 * hashを決定する。
 *
 * @responsibility hashの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: string
 * @returns hashの計算結果を返す。
 * @precondition 「value: string」がhashの入力契約を満たす。
 * @postcondition hashの責務を完了した結果だけを返す。
 * @effect N/A: hashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hashは独自の失敗分岐を所有しない。
 * @invariant hashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security hashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hashは共有非同期状態を持たない同期処理である。
 */
function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Rootが同一かを判定する。
 *
 * @responsibility Rootの同一性Propertyと一致／不一致境界を所有する。
 * @trace ARCH-000004
 * @input left: VerifiedRoot、right: VerifiedRoot
 * @returns sameRootの計算結果を返す。
 * @precondition 「left: VerifiedRoot、right: VerifiedRoot」がsameRootの入力契約を満たす。
 * @postcondition sameRootの責務を完了した結果だけを返す。
 * @effect N/A: sameRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameRootは独自の失敗分岐を所有しない。
 * @invariant sameRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security sameRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameRootは共有非同期状態を持たない同期処理である。
 */
function sameRoot(left: VerifiedRoot, right: VerifiedRoot) {
  return left.rootPath === right.rootPath && left.identity === right.identity;
}

/**
 * envelopeを決定する。
 *
 * @responsibility envelopeの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is Envelopeを返す。
 * @precondition 「value: unknown」がenvelopeの入力契約を満たす。
 * @postcondition envelopeの責務を完了した結果だけを返す。
 * @effect N/A: envelopeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: envelopeは独自の失敗分岐を所有しない。
 * @invariant envelopeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security envelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: envelopeは共有非同期状態を持たない同期処理である。
 */
function envelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join("\0") ===
      ["contract", "generation", "previousHash", "recordId", "value"]
        .sort()
        .join("\0") &&
    record.contract === COORDINATOR_WINDOWS_DECISION_STORE_CONTRACT &&
    typeof record.recordId === "string" &&
    Number.isSafeInteger(record.generation) &&
    Number(record.generation) >= 1 &&
    (record.previousHash === null ||
      (typeof record.previousHash === "string" &&
        /^[0-9a-f]{64}$/u.test(record.previousHash))) &&
    isCoordinatorDecisionRecord(record.value)
  );
}

/**
 * entry Nameを決定する。
 *
 * @responsibility entry Nameの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input recordId: string、generation: number
 * @returns entryNameの計算結果を返す。
 * @precondition 「recordId: string、generation: number」がentryNameの入力契約を満たす。
 * @postcondition entryNameの責務を完了した結果だけを返す。
 * @effect N/A: entryNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: entryNameは独自の失敗分岐を所有しない。
 * @invariant entryNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security entryNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: entryNameは共有非同期状態を持たない同期処理である。
 */
function entryName(recordId: string, generation: number) {
  return `project-decision-${hash(recordId).slice(0, 40)}-${String(generation).padStart(8, "0")}.json`;
}

/**
 * 起動設定から固定Runtime保存先を確認する。
 * @responsibility Windowsの絶対正規形とDirectory実体を照合する。
 * @trace ARCH-000015
 * @input shouldInitialize: 固定末尾三段の作成を許可するか。
 * @effect 許可時のみ欠測Directoryを一段ずつ作成する。既存物を修復・削除しない。
 * @failure 設定不正、非対応OS、Link、不一致、観測不能はnullで停止する。
 * @boundary Node.js Filesystem。要求主体・SID・DACLの証明には使用しない。
 */
function inspectRoot(shouldInitialize: boolean): VerifiedRoot | null {
  if (process.platform !== "win32") return null;
  const rootPath = runtimeStateDirectoryCandidate();
  if (!rootPath) return null;
  return inspectDirectory(rootPath, shouldInitialize);
}

/**
 * 固定保存先までを一段ずつ確認し、最後の三段だけを必要時に作成する。
 * @responsibility 非リンク・正規所在とDirectory実体を確認し、観測不能は拒否する。
 * @trace ARCH-000015
 * @boundary Node.js Filesystem。SID・DACL・差替え競合の原子的な防止は保証しない。
 * @effect 許可時のみQual-Lab/CRDD/RuntimeStateを作成。既存物の修復・削除はしない。
 */
function inspectDirectory(
  rootPath: string,
  initialize: boolean,
): VerifiedRoot | null {
  try {
    if (!path.isAbsolute(rootPath) || path.normalize(rootPath) !== rootPath)
      return null;
    const paths: string[] = [];
    for (let current = rootPath; ; current = path.dirname(current)) {
      paths.unshift(current);
      if (path.dirname(current) === current) break;
    }
    const identities: string[] = [];
    for (let index = 0; index < paths.length; index++) {
      const current = paths[index];
      if (current === undefined) return null;
      try {
        fs.lstatSync(current);
      } catch (error) {
        if (
          !initialize ||
          (error as NodeJS.ErrnoException).code !== "ENOENT" ||
          index < paths.length - 3
        )
          return null;
        // 祖先を再確認した後、再帰作成せず一段だけ作る。競合EEXISTも後で同じ検査を通す。
        if (
          inspectDirectory(path.dirname(current), false)?.identity !==
          JSON.stringify(identities)
        )
          return null;
        try {
          fs.mkdirSync(current, { mode: 0o700 });
        } catch (creationError) {
          if ((creationError as NodeJS.ErrnoException).code !== "EEXIST")
            return null;
        }
      }
      const metadata = fs.lstatSync(current, { bigint: true });
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync.native(current) !== current ||
        metadata.ino === 0n
      )
        return null;
      identities.push(
        `${metadata.dev}:${metadata.ino}:${metadata.birthtimeNs}`,
      );
    }
    return Object.freeze({ rootPath, identity: JSON.stringify(identities) });
  } catch {
    return null;
  }
}

/**
 * currentを決定する。
 *
 * @responsibility currentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input root: VerifiedRoot、recordId: string
 * @returns currentの計算結果を返す。
 * @precondition 「root: VerifiedRoot、recordId: string」がcurrentの入力契約を満たす。
 * @postcondition currentの責務を完了した結果だけを返す。
 * @effect N/A: currentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure currentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant currentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security currentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: currentは共有非同期状態を持たない同期処理である。
 */
function current(root: VerifiedRoot, recordId: string) {
  const identity = hash(recordId).slice(0, 40);
  const candidates = fs
    .readdirSync(root.rootPath)
    .map((name) => ({ name, match: ENTRY.exec(name) }))
    .filter((entry) => entry.match?.[1] === identity)
    .sort(
      (left, right) =>
        Number(left.match?.[2] ?? 0) - Number(right.match?.[2] ?? 0),
    );
  let previousHash: string | null = null;
  let latest: Readonly<{
    envelope: Envelope;
    contentHash: string;
  }> | null = null;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!candidate) throw new Error("decision_store_inventory_invalid");
    const generation = Number(candidate.match?.[2]);
    if (generation !== index + 1)
      throw new Error("decision_store_generation_gap");
    const committed = readCommittedJson(
      path.join(root.rootPath, candidate.name),
      candidate.name,
    );
    if (
      !envelope(committed.value) ||
      committed.value.recordId !== recordId ||
      committed.value.generation !== generation ||
      committed.value.previousHash !== previousHash
    )
      throw new Error("decision_store_chain_invalid");
    latest = Object.freeze({
      envelope: committed.value,
      contentHash: committed.hash,
    });
    previousHash = committed.hash;
  }
  return latest;
}

/**
 * resultを決定する。
 *
 * @responsibility resultの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: CoordinatorDecisionRecord | null
 * @returns resultの計算結果を返す。
 * @precondition 「value: CoordinatorDecisionRecord | null」がresultの入力契約を満たす。
 * @postcondition resultの責務を完了した結果だけを返す。
 * @effect N/A: resultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resultは独自の失敗分岐を所有しない。
 * @invariant resultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resultは共有非同期状態を持たない同期処理である。
 */
function result(value: CoordinatorDecisionRecord | null) {
  return Object.freeze({ status: "completed" as const, value });
}
/**
 * unknownを決定する。
 *
 * @responsibility unknownの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns unknownの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がunknownの入力契約を満たす。
 * @postcondition unknownの責務を完了した結果だけを返す。
 * @effect N/A: unknownは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: unknownは独自の失敗分岐を所有しない。
 * @invariant unknownは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security unknownはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: unknownは共有非同期状態を持たない同期処理である。
 */
function unknown() {
  return Object.freeze({ status: "blocked" as const, value: null });
}

/**
 * with Lockを決定する。
 *
 * @responsibility with Lockの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000004
 * @input expectedRoot: VerifiedRoot、acquire: (directory: string) => LockResult、reobserve: () => VerifiedRoot | null、operation: (root: VerifiedRoot) => T
 * @returns T | nullを返す。
 * @precondition 「expectedRoot: VerifiedRoot、acquire: (directory: string) => LockResult、reobserve: () => VerifiedRoot | null、operation: (root: VerifiedRoot) => T」がwithLockの入力契約を満たす。
 * @postcondition withLockの責務を完了した結果だけを返す。
 * @effect wx Lockを取得し、Root再観測後に操作を行い、正常・失敗とも元Lockの解放を確認する。
 * @failure withLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant withLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security withLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: withLockは共有非同期状態を持たない同期処理である。
 */
function withLock<T>(
  expectedRoot: VerifiedRoot,
  acquire: (directory: string) => LockResult<Readonly<{ release(): boolean }>>,
  reobserve: () => VerifiedRoot | null,
  operation: (root: VerifiedRoot) => T,
): T | null {
  const acquisition = acquire(expectedRoot.rootPath);
  if (acquisition.status !== "acquired") {
    if (!acquisition.descriptorClosed)
      poisonRuntimeProcessAfterCleanupUnknown();
    return null;
  }
  const lock = acquisition.lock;
  let output: T | null = null;
  let isFailed = false;
  try {
    const rebound = reobserve();
    if (!rebound || !sameRoot(expectedRoot, rebound)) isFailed = true;
    else output = operation(rebound);
  } catch {
    isFailed = true;
  }
  let released = false;
  try {
    released = lock.release();
  } catch {
    released = false;
  }
  return isFailed || !released ? null : output;
}

/**
 * Storeを構築する。
 *
 * @responsibility Storeの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input root: VerifiedRoot、acquire: (directory: string) => LockResult、reobserve: () => VerifiedRoot | null
 * @returns createStoreの計算結果を返す。
 * @precondition 「root: VerifiedRoot、acquire: (directory: string) => LockResult、reobserve: () => VerifiedRoot | null」がcreateStoreの入力契約を満たす。
 * @postcondition createStoreの責務を完了した結果だけを返す。
 * @effect 構築時はI/Oなし。返す各操作はwithLockを介して記録を読み書きする。
 * @failure N/A: createStoreは独自の失敗分岐を所有しない。
 * @invariant createStoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createStoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createStoreは共有非同期状態を持たない同期処理である。
 */
function createStore(
  root: VerifiedRoot,
  acquire: (directory: string) => LockResult<Readonly<{ release(): boolean }>>,
  reobserve: () => VerifiedRoot | null,
) {
  const store: CoordinatorDecisionStore = Object.freeze({
    /**
     * windows-decision-storeを構築する。
     *
     * @responsibility windows-decision-storeの構築入力、生成結果、不正入力の拒否境界を所有する。
     * @trace ARCH-000004
     * @input record
     * @returns createの計算結果を返す。
     * @precondition 「record」がcreateの入力契約を満たす。
     * @postcondition createの責務を完了した結果だけを返す。
     * @effect N/A: createは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: createは独自の失敗分岐を所有しない。
     * @invariant createは入力から導いた結果以外の共有状態を変更しない。
     * @boundary FilesystemとProcess内Domain処理の境界。
     * @security createはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: createは共有非同期状態を持たない同期処理である。
     */
    create(record) {
      if (!isCoordinatorDecisionRecord(record)) return unknown();
      return (
        withLock(root, acquire, reobserve, (lockedRoot) => {
          if (current(lockedRoot, record.recordId)) return unknown();
          const value: Envelope = Object.freeze({
            contract: COORDINATOR_WINDOWS_DECISION_STORE_CONTRACT,
            recordId: record.recordId,
            generation: 1,
            previousHash: null,
            value: record,
          });
          const name = entryName(record.recordId, 1);
          writeCommittedJson(lockedRoot.rootPath, name, name, value);
          const observed = current(lockedRoot, record.recordId);
          return observed && observed.envelope.generation === 1
            ? result(observed.envelope.value)
            : unknown();
        }) ?? unknown()
      );
    },
    /**
     * windows-decision-storeを読み取る。
     *
     * @responsibility windows-decision-storeの読取り元、上限、読取不能時の結果境界を所有する。
     * @trace ARCH-000004
     * @input recordId
     * @returns readの計算結果を返す。
     * @precondition 「recordId」がreadの入力契約を満たす。
     * @postcondition readの責務を完了した結果だけを返す。
     * @effect N/A: readは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: readは独自の失敗分岐を所有しない。
     * @invariant readは入力から導いた結果以外の共有状態を変更しない。
     * @boundary FilesystemとProcess内Domain処理の境界。
     * @security readはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: readは共有非同期状態を持たない同期処理である。
     */
    read(recordId) {
      if (typeof recordId !== "string") return unknown();
      return (
        withLock(root, acquire, reobserve, (lockedRoot) =>
          result(current(lockedRoot, recordId)?.envelope.value ?? null),
        ) ?? unknown()
      );
    },
    /**
     * And Setを比較する。
     *
     * @responsibility And Setの比較軸、一致条件、差分結果の境界を所有する。
     * @trace ARCH-000004
     * @input expected、next
     * @returns compareAndSetの計算結果を返す。
     * @precondition 「expected、next」がcompareAndSetの入力契約を満たす。
     * @postcondition compareAndSetの責務を完了した結果だけを返す。
     * @effect N/A: compareAndSetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: compareAndSetは独自の失敗分岐を所有しない。
     * @invariant compareAndSetは入力から導いた結果以外の共有状態を変更しない。
     * @boundary FilesystemとProcess内Domain処理の境界。
     * @security compareAndSetはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: compareAndSetは共有非同期状態を持たない同期処理である。
     */
    compareAndSet(expected, next) {
      if (
        !isCoordinatorDecisionRecord(expected) ||
        !isCoordinatorDecisionRecord(next) ||
        expected.recordId !== next.recordId
      )
        return unknown();
      return (
        withLock(root, acquire, reobserve, (lockedRoot) => {
          const observed = current(lockedRoot, expected.recordId);
          if (
            !observed ||
            JSON.stringify(observed.envelope.value) !== JSON.stringify(expected)
          )
            return unknown();
          const generation = observed.envelope.generation + 1;
          const value: Envelope = Object.freeze({
            contract: COORDINATOR_WINDOWS_DECISION_STORE_CONTRACT,
            recordId: expected.recordId,
            generation,
            previousHash: observed.contentHash,
            value: next,
          });
          const name = entryName(expected.recordId, generation);
          writeCommittedJson(lockedRoot.rootPath, name, name, value);
          const readback = current(lockedRoot, expected.recordId);
          return readback && readback.envelope.generation === generation
            ? result(readback.envelope.value)
            : unknown();
        }) ?? unknown()
      );
    },
  });
  return store;
}

/**
 * 固定Runtime保存先を確認し、判断記録Storeを開く。
 * @responsibility 保存先の実体と操作ごとのwx排他・再照合を接続する。
 * @trace ARCH-000004
 * @input initializeIfMissing: falseならDirectoryを作成しない。
 * @effect 既定では固定末尾三段の欠測Directoryだけを作成する。
 * @failure 不正・観測不能はblocked。途中作成段を自動削除しない。
 * @boundary ローカル単一ユーザーのWindows。主体は上位が別に伝播する。
 */
export function openRuntimeOwnedWindowsProjectDecisionStore(
  options: Readonly<{
    initializeIfMissing?: boolean;
  }> = Object.freeze({}),
):
  | Readonly<{
      status: "completed";
      store: CoordinatorDecisionStore;
    }>
  | Readonly<{ status: "blocked"; store: null }> {
  const shouldInitializeIfMissing = options.initializeIfMissing !== false;
  const root = inspectRoot(shouldInitializeIfMissing);
  if (!root) return Object.freeze({ status: "blocked", store: null });
  return Object.freeze({
    status: "completed",
    store: createStore(root, acquireRuntimeStateLock, () => inspectRoot(false)),
  });
}

/**
 * Coordinator Windows Decision Store Testing Adapterを構築する。
 *
 * @responsibility Coordinator Windows Decision Store Testing Adapterの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000004
 * @input directory: string
 * @returns createCoordinatorWindowsDecisionStoreTestingAdapterの計算結果を返す。
 * @precondition 「directory: string」がcreateCoordinatorWindowsDecisionStoreTestingAdapterの入力契約を満たす。
 * @postcondition createCoordinatorWindowsDecisionStoreTestingAdapterの責務を完了した結果だけを返す。
 * @effect createCoordinatorWindowsDecisionStoreTestingAdapterはFilesystemの読取りまたは書込みを実行する。
 * @failure createCoordinatorWindowsDecisionStoreTestingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createCoordinatorWindowsDecisionStoreTestingAdapterは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createCoordinatorWindowsDecisionStoreTestingAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createCoordinatorWindowsDecisionStoreTestingAdapterは共有非同期状態を持たない同期処理である。
 */
export function createCoordinatorWindowsDecisionStoreTestingAdapter(
  directory: string,
) {
  const resolved = fs.realpathSync.native(directory);
  const metadata = fs.lstatSync(resolved);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("decision_store_testing_root_invalid");
  const root = Object.freeze({
    rootPath: resolved,
    identity: "testing-only",
  });
  return createStore(
    root,
    () =>
      Object.freeze({
        status: "acquired",
        lock: Object.freeze({ release: () => true }),
      }),
    () => root,
  );
}

/**
 * Coordinator Windows Decision Store 契約の公開契約を記述する。
 *
 * @responsibility Coordinator Windows Decision Store 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCoordinatorWindowsDecisionStoreContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCoordinatorWindowsDecisionStoreContractの入力契約を満たす。
 * @postcondition describeCoordinatorWindowsDecisionStoreContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCoordinatorWindowsDecisionStoreContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCoordinatorWindowsDecisionStoreContractは独自の失敗分岐を所有しない。
 * @invariant describeCoordinatorWindowsDecisionStoreContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeCoordinatorWindowsDecisionStoreContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCoordinatorWindowsDecisionStoreContractは共有非同期状態を持たない同期処理である。
 */
export function describeCoordinatorWindowsDecisionStoreContract() {
  return Object.freeze({
    contract: COORDINATOR_WINDOWS_DECISION_STORE_CONTRACT,
    root: "configured_runtime_state_non_link_directory_identity",
    mutation: "immutable_generation_chain_under_wx_lock",
    rawCapabilityPersisted: false,
    callerSuppliedPathAccepted: false,
    unsupportedPlatformFallback: "none",
  });
}

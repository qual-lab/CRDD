import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ProjectRuntimeDecisionRecord,
  ProjectRuntimeDecisionStore,
} from "../../../project-runtime/src/index.ts";
import { isProjectRuntimeDecisionRecord } from "../../../project-runtime/src/index.ts";
import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedRuntimeStateRootCapability,
  inspectRuntimeOwnedWindowsRuntimeState,
} from "./candidate-store-windows-adapter.ts";
import {
  readCommittedDockerRecoveryJson,
  writeCommittedDockerRecoveryJson,
} from "./docker-recovery-journal.ts";

export const PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT =
  "crdd-coordinator/project-runtime-windows-decision-store/v1" as const;

const ENTRY = /^project-decision-([0-9a-f]{40})-([0-9]{8})\.json$/u;

/**
 * VerifiedRootが扱う値の構造を表す。
 *
 * @responsibility VerifiedRootに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape VerifiedRootが表すProperty、識別子およびRelationを型として固定する。
 * @invariant VerifiedRootで宣言した値と責務の対応を維持する。
 * @boundary N/A: VerifiedRootの宣言は外部境界を開かない。
 * @security VerifiedRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility VerifiedRootの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type VerifiedRoot = NonNullable<
  ReturnType<typeof consumeRuntimeOwnedRuntimeStateRootCapability>
>;
/**
 * Envelopeが扱う値の構造を表す。
 *
 * @responsibility Envelopeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Envelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Envelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: Envelopeの宣言は外部境界を開かない。
 * @security EnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Envelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Envelope = Readonly<{
  contract: typeof PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT;
  recordId: string;
  generation: number;
  previousHash: string | null;
  value: ProjectRuntimeDecisionRecord;
}>;

/**
 * hashの処理を実行する。
 *
 * @responsibility hashに対応する入力処理と結果生成を所有する。
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
 * sameRootの処理を実行する。
 *
 * @responsibility sameRootに対応する入力処理と結果生成を所有する。
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
  return (
    left.rootPath === right.rootPath &&
    left.runtimeStateIdentityHash === right.runtimeStateIdentityHash &&
    left.runtimeStateProtectionHash === right.runtimeStateProtectionHash &&
    left.localUserBindingHash === right.localUserBindingHash &&
    left.stableLogicalHomeBindingHash === right.stableLogicalHomeBindingHash
  );
}

/**
 * envelopeの処理を実行する。
 *
 * @responsibility envelopeに対応する入力処理と結果生成を所有する。
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
    record.contract === PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT &&
    typeof record.recordId === "string" &&
    Number.isSafeInteger(record.generation) &&
    Number(record.generation) >= 1 &&
    (record.previousHash === null ||
      (typeof record.previousHash === "string" &&
        /^[0-9a-f]{64}$/u.test(record.previousHash))) &&
    isProjectRuntimeDecisionRecord(record.value)
  );
}

/**
 * entryNameの処理を実行する。
 *
 * @responsibility entryNameに対応する入力処理と結果生成を所有する。
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
 * inspectRootの処理を実行する。
 *
 * @responsibility inspectRootに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input shouldInitialize: boolean、developmentContext: object
 * @returns inspectRootの計算結果を返す。
 * @precondition 「shouldInitialize: boolean、developmentContext: object」がinspectRootの入力契約を満たす。
 * @postcondition inspectRootの責務を完了した結果だけを返す。
 * @effect N/A: inspectRootは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRootは独自の失敗分岐を所有しない。
 * @invariant inspectRootは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectRootはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRootは共有非同期状態を持たない同期処理である。
 */
function inspectRoot(shouldInitialize: boolean, developmentContext?: object) {
  const observation = inspectRuntimeOwnedWindowsRuntimeState(
    shouldInitialize,
    new Date().toISOString(),
    developmentContext,
  );
  const root = consumeRuntimeOwnedRuntimeStateRootCapability(
    observation.rootCapability,
  );
  return observation.status === "candidate" &&
    observation.selectedUserBindingVerified === true &&
    observation.protectionVerified === true &&
    observation.stableIdentityObserved === true &&
    root
    ? root
    : null;
}

/**
 * currentの処理を実行する。
 *
 * @responsibility currentに対応する入力処理と結果生成を所有する。
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
    const committed = readCommittedDockerRecoveryJson(
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
 * resultの処理を実行する。
 *
 * @responsibility resultに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: ProjectRuntimeDecisionRecord | null
 * @returns resultの計算結果を返す。
 * @precondition 「value: ProjectRuntimeDecisionRecord | null」がresultの入力契約を満たす。
 * @postcondition resultの責務を完了した結果だけを返す。
 * @effect N/A: resultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: resultは独自の失敗分岐を所有しない。
 * @invariant resultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resultは共有非同期状態を持たない同期処理である。
 */
function result(value: ProjectRuntimeDecisionRecord | null) {
  return Object.freeze({ status: "completed" as const, value });
}
/**
 * unknownの処理を実行する。
 *
 * @responsibility unknownに対応する入力処理と結果生成を所有する。
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
 * withLockの処理を実行する。
 *
 * @responsibility withLockに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input expectedRoot: VerifiedRoot、acquire: (bindingHash: string) => Readonly<{ release: () => boolean }> | null、reobserve: () => VerifiedRoot | null、operation: (root: VerifiedRoot) => T
 * @returns T | nullを返す。
 * @precondition 「expectedRoot: VerifiedRoot、acquire: (bindingHash: string) => Readonly<{ release: () => boolean }> | null、reobserve: () => VerifiedRoot | null、operation: (root: VerifiedRoot) => T」がwithLockの入力契約を満たす。
 * @postcondition withLockの責務を完了した結果だけを返す。
 * @effect N/A: withLockは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure withLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant withLockは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security withLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: withLockは共有非同期状態を持たない同期処理である。
 */
function withLock<T>(
  expectedRoot: VerifiedRoot,
  acquire: (bindingHash: string) => Readonly<{ release: () => boolean }> | null,
  reobserve: () => VerifiedRoot | null,
  operation: (root: VerifiedRoot) => T,
): T | null {
  const lock = acquire(expectedRoot.stableLogicalHomeBindingHash);
  if (!lock) return null;
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
 * createStoreの処理を実行する。
 *
 * @responsibility createStoreに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input root: VerifiedRoot、acquire: (bindingHash: string) => Readonly<{ release: () => boolean }> | null、reobserve: () => VerifiedRoot | null
 * @returns createStoreの計算結果を返す。
 * @precondition 「root: VerifiedRoot、acquire: (bindingHash: string) => Readonly<{ release: () => boolean }> | null、reobserve: () => VerifiedRoot | null」がcreateStoreの入力契約を満たす。
 * @postcondition createStoreの責務を完了した結果だけを返す。
 * @effect N/A: createStoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createStoreは独自の失敗分岐を所有しない。
 * @invariant createStoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createStoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createStoreは共有非同期状態を持たない同期処理である。
 */
function createStore(
  root: VerifiedRoot,
  acquire: (bindingHash: string) => Readonly<{ release: () => boolean }> | null,
  reobserve: () => VerifiedRoot | null,
) {
  const store: ProjectRuntimeDecisionStore = Object.freeze({
    /**
     * createの処理を実行する。
     *
     * @responsibility createに対応する入力処理と結果生成を所有する。
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
      if (!isProjectRuntimeDecisionRecord(record)) return unknown();
      return (
        withLock(root, acquire, reobserve, (lockedRoot) => {
          if (current(lockedRoot, record.recordId)) return unknown();
          const value: Envelope = Object.freeze({
            contract: PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT,
            recordId: record.recordId,
            generation: 1,
            previousHash: null,
            value: record,
          });
          const name = entryName(record.recordId, 1);
          writeCommittedDockerRecoveryJson(
            lockedRoot.rootPath,
            name,
            name,
            value,
          );
          const observed = current(lockedRoot, record.recordId);
          return observed && observed.envelope.generation === 1
            ? result(observed.envelope.value)
            : unknown();
        }) ?? unknown()
      );
    },
    /**
     * readの処理を実行する。
     *
     * @responsibility readに対応する入力処理と結果生成を所有する。
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
     * compareAndSetの処理を実行する。
     *
     * @responsibility compareAndSetに対応する入力処理と結果生成を所有する。
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
        !isProjectRuntimeDecisionRecord(expected) ||
        !isProjectRuntimeDecisionRecord(next) ||
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
            contract: PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT,
            recordId: expected.recordId,
            generation,
            previousHash: observed.contentHash,
            value: next,
          });
          const name = entryName(expected.recordId, generation);
          writeCommittedDockerRecoveryJson(
            lockedRoot.rootPath,
            name,
            name,
            value,
          );
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
 * openRuntimeOwnedWindowsProjectDecisionStoreの処理を実行する。
 *
 * @responsibility openRuntimeOwnedWindowsProjectDecisionStoreに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input options: Readonly<{ developmentContext?: object; initializeIfMissing?: boolean; }>
 * @returns | Readonly<{ status: "completed"; store: ProjectRuntimeDecisionStore; principalId: string; }> | Readonly<{ status: "blocked"; store: null; principalId: null }>を返す。
 * @precondition 「options: Readonly<{ developmentContext?: object; initializeIfMissing?: boolean; }>」がopenRuntimeOwnedWindowsProjectDecisionStoreの入力契約を満たす。
 * @postcondition openRuntimeOwnedWindowsProjectDecisionStoreの責務を完了した結果だけを返す。
 * @effect N/A: openRuntimeOwnedWindowsProjectDecisionStoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: openRuntimeOwnedWindowsProjectDecisionStoreは独自の失敗分岐を所有しない。
 * @invariant openRuntimeOwnedWindowsProjectDecisionStoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security openRuntimeOwnedWindowsProjectDecisionStoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: openRuntimeOwnedWindowsProjectDecisionStoreは共有非同期状態を持たない同期処理である。
 */
export function openRuntimeOwnedWindowsProjectDecisionStore(
  options: Readonly<{
    developmentContext?: object;
    initializeIfMissing?: boolean;
  }> = Object.freeze({}),
):
  | Readonly<{
      status: "completed";
      store: ProjectRuntimeDecisionStore;
      principalId: string;
    }>
  | Readonly<{ status: "blocked"; store: null; principalId: null }> {
  const shouldInitializeIfMissing = options.initializeIfMissing !== false;
  const root = inspectRoot(
    shouldInitializeIfMissing,
    options.developmentContext,
  );
  if (!root)
    return Object.freeze({ status: "blocked", store: null, principalId: null });
  return Object.freeze({
    status: "completed",
    store: createStore(
      root,
      acquireRuntimeOwnedDockerRuntimeStateKernelLock,
      () => inspectRoot(false, options.developmentContext),
    ),
    principalId: root.localUserBindingHash,
  });
}

/**
 * createProjectRuntimeWindowsDecisionStoreTestingAdapterの処理を実行する。
 *
 * @responsibility createProjectRuntimeWindowsDecisionStoreTestingAdapterに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input directory: string
 * @returns createProjectRuntimeWindowsDecisionStoreTestingAdapterの計算結果を返す。
 * @precondition 「directory: string」がcreateProjectRuntimeWindowsDecisionStoreTestingAdapterの入力契約を満たす。
 * @postcondition createProjectRuntimeWindowsDecisionStoreTestingAdapterの責務を完了した結果だけを返す。
 * @effect createProjectRuntimeWindowsDecisionStoreTestingAdapterはFilesystemの読取りまたは書込みを実行する。
 * @failure createProjectRuntimeWindowsDecisionStoreTestingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProjectRuntimeWindowsDecisionStoreTestingAdapterは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createProjectRuntimeWindowsDecisionStoreTestingAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimeWindowsDecisionStoreTestingAdapterは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeWindowsDecisionStoreTestingAdapter(
  directory: string,
) {
  const resolved = fs.realpathSync.native(directory);
  const metadata = fs.lstatSync(resolved);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("decision_store_testing_root_invalid");
  const root = Object.freeze({
    rootPath: resolved,
    runtimeStateIdentityHash: "a".repeat(64),
    runtimeStateProtectionHash: "b".repeat(64),
    localUserBindingHash: "c".repeat(64),
    stableLogicalHomeBindingHash: "d".repeat(64),
  });
  return createStore(
    root,
    () => Object.freeze({ release: () => true }),
    () => root,
  );
}

/**
 * describeProjectRuntimeWindowsDecisionStoreContractの処理を実行する。
 *
 * @responsibility describeProjectRuntimeWindowsDecisionStoreContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProjectRuntimeWindowsDecisionStoreContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProjectRuntimeWindowsDecisionStoreContractの入力契約を満たす。
 * @postcondition describeProjectRuntimeWindowsDecisionStoreContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProjectRuntimeWindowsDecisionStoreContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProjectRuntimeWindowsDecisionStoreContractは独自の失敗分岐を所有しない。
 * @invariant describeProjectRuntimeWindowsDecisionStoreContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeProjectRuntimeWindowsDecisionStoreContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProjectRuntimeWindowsDecisionStoreContractは共有非同期状態を持たない同期処理である。
 */
export function describeProjectRuntimeWindowsDecisionStoreContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_WINDOWS_DECISION_STORE_CONTRACT,
    root: "runtime_owned_os_managed_protected_runtime_state",
    mutation: "immutable_generation_chain_under_kernel_lock",
    rawCapabilityPersisted: false,
    callerSuppliedPathAccepted: false,
    unsupportedPlatformFallback: "none",
  });
}

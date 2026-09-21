import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  ProjectRuntimeDecisionRecoveryIntent,
  ProjectRuntimeDecisionRecoveryStore,
} from "../../../project-runtime/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../runtime-data/src/index.ts";

export const PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT =
  "crdd-coordinator/project-runtime-decision-recovery-store/v1" as const;

/**
 * Envelopeが扱う値の構造を表す。
 *
 * @responsibility Envelopeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape Envelopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Envelopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: Envelopeの宣言は外部境界を開かない。
 * @security EnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Envelopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Envelope = Readonly<{
  contract: typeof PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT;
  generation: number;
  previousHash: string | null;
  value: ProjectRuntimeDecisionRecoveryIntent;
}>;

const HASH = /^[0-9a-f]{64}$/u;
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;

/**
 * digestの処理を実行する。
 *
 * @responsibility digestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: string
 * @returns digestの計算結果を返す。
 * @precondition 「value: string」がdigestの入力契約を満たす。
 * @postcondition digestの責務を完了した結果だけを返す。
 * @effect N/A: digestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: digestは独自の失敗分岐を所有しない。
 * @invariant digestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security digestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: digestは共有非同期状態を持たない同期処理である。
 */
function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
/**
 * validIntentの処理を実行する。
 *
 * @responsibility validIntentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is ProjectRuntimeDecisionRecoveryIntentを返す。
 * @precondition 「value: unknown」がvalidIntentの入力契約を満たす。
 * @postcondition validIntentの責務を完了した結果だけを返す。
 * @effect N/A: validIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIntentは独自の失敗分岐を所有しない。
 * @invariant validIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validIntentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validIntentは共有非同期状態を持たない同期処理である。
 */
function validIntent(
  value: unknown,
): value is ProjectRuntimeDecisionRecoveryIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as ProjectRuntimeDecisionRecoveryIntent;
  return (
    [
      candidate.recoveryId,
      candidate.recordId,
      candidate.projectId,
      candidate.milestoneId,
      candidate.queueId,
    ].every((entry) => typeof entry === "string" && ID.test(entry)) &&
    (candidate.applicationId === null || ID.test(candidate.applicationId)) &&
    Number.isSafeInteger(candidate.expectedGeneration) &&
    candidate.expectedGeneration >= 1 &&
    (candidate.newGeneration === null ||
      (Number.isSafeInteger(candidate.newGeneration) &&
        candidate.newGeneration >= 2)) &&
    [
      "pending",
      "prepared",
      "finalized",
      "invalidated",
      "expired",
      "recovery_required",
      "unknown",
    ].includes(candidate.observedDisposition) &&
    typeof candidate.unknownBoundary === "string" &&
    ID.test(candidate.unknownBoundary) &&
    (candidate.disposition === "required" ||
      candidate.disposition === "settled")
  );
}
/**
 * validEnvelopeの処理を実行する。
 *
 * @responsibility validEnvelopeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is Envelopeを返す。
 * @precondition 「value: unknown」がvalidEnvelopeの入力契約を満たす。
 * @postcondition validEnvelopeの責務を完了した結果だけを返す。
 * @effect N/A: validEnvelopeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validEnvelopeは独自の失敗分岐を所有しない。
 * @invariant validEnvelopeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validEnvelopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validEnvelopeは共有非同期状態を持たない同期処理である。
 */
function validEnvelope(value: unknown): value is Envelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Envelope;
  return (
    candidate.contract === PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT &&
    Number.isSafeInteger(candidate.generation) &&
    candidate.generation >= 1 &&
    (candidate.previousHash === null || HASH.test(candidate.previousHash)) &&
    validIntent(candidate.value)
  );
}

/**
 * pathsの処理を実行する。
 *
 * @responsibility pathsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input projectRuntimeRoot: string、recoveryId: string
 * @returns pathsの計算結果を返す。
 * @precondition 「projectRuntimeRoot: string、recoveryId: string」がpathsの入力契約を満たす。
 * @postcondition pathsの責務を完了した結果だけを返す。
 * @effect N/A: pathsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: pathsは独自の失敗分岐を所有しない。
 * @invariant pathsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security pathsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pathsは共有非同期状態を持たない同期処理である。
 */
function paths(projectRuntimeRoot: string, recoveryId: string) {
  const identity = digest(recoveryId).slice(0, 40);
  const directory = path.join(
    projectRuntimeRoot,
    "recovery",
    "decisions",
    identity,
  );
  return Object.freeze({ directory });
}
/**
 * readChainの処理を実行する。
 *
 * @responsibility readChainに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、recoveryId: string
 * @returns readChainの計算結果を返す。
 * @precondition 「directory: string、recoveryId: string」がreadChainの入力契約を満たす。
 * @postcondition readChainの責務を完了した結果だけを返す。
 * @effect readChainはFilesystemの読取りまたは書込みを実行する。
 * @failure readChainは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readChainは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readChainはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readChainは共有非同期状態を持たない同期処理である。
 */
function readChain(directory: string, recoveryId: string) {
  if (!fs.existsSync(directory)) return null;
  const metadata = fs.lstatSync(directory);
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("decision_recovery_store_boundary_invalid");
  const entries = fs.readdirSync(directory).sort();
  if (entries.some((name) => !/^[0-9]{8}\.json$/u.test(name)))
    throw new Error("decision_recovery_store_inventory_invalid");
  let previousHash: string | null = null;
  let latest: Envelope | null = null;
  for (let index = 0; index < entries.length; index += 1) {
    const name = entries[index];
    if (!name || Number(name.slice(0, 8)) !== index + 1)
      throw new Error("decision_recovery_store_generation_gap");
    const bytes = fs.readFileSync(path.join(directory, name));
    if (bytes.byteLength > 32 * 1024)
      throw new Error("decision_recovery_store_record_too_large");
    const value: unknown = JSON.parse(bytes.toString("utf8"));
    if (
      !validEnvelope(value) ||
      value.generation !== index + 1 ||
      value.previousHash !== previousHash ||
      value.value.recoveryId !== recoveryId
    )
      throw new Error("decision_recovery_store_chain_invalid");
    latest = value;
    previousHash = digest(bytes.toString("utf8"));
  }
  return latest;
}
/**
 * writeGenerationの処理を実行する。
 *
 * @responsibility writeGenerationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、generation: number、previousHash: string | null、value: ProjectRuntimeDecisionRecoveryIntent
 * @returns writeGenerationの計算結果を返す。
 * @precondition 「directory: string、generation: number、previousHash: string | null、value: ProjectRuntimeDecisionRecoveryIntent」がwriteGenerationの入力契約を満たす。
 * @postcondition writeGenerationの責務を完了した結果だけを返す。
 * @effect writeGenerationはFilesystemの読取りまたは書込みを実行する。
 * @failure writeGenerationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeGenerationは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeGenerationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeGenerationは共有非同期状態を持たない同期処理である。
 */
function writeGeneration(
  directory: string,
  generation: number,
  previousHash: string | null,
  value: ProjectRuntimeDecisionRecoveryIntent,
) {
  fs.mkdirSync(directory, { recursive: true });
  const name = `${String(generation).padStart(8, "0")}.json`;
  const target = path.join(directory, name);
  const temporary = path.join(directory, `.${name}.${process.pid}.tmp`);
  const content = `${JSON.stringify({
    contract: PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT,
    generation,
    previousHash,
    value,
  })}\n`;
  const descriptor = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(descriptor, content, "utf8");
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.linkSync(temporary, target);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
  const readback = readChain(directory, value.recoveryId);
  if (!readback || JSON.stringify(readback.value) !== JSON.stringify(value))
    throw new Error("decision_recovery_store_readback_failed");
  return readback;
}
/**
 * completedの処理を実行する。
 *
 * @responsibility completedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: ProjectRuntimeDecisionRecoveryIntent | null
 * @returns completedの計算結果を返す。
 * @precondition 「value: ProjectRuntimeDecisionRecoveryIntent | null」がcompletedの入力契約を満たす。
 * @postcondition completedの責務を完了した結果だけを返す。
 * @effect N/A: completedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: completedは独自の失敗分岐を所有しない。
 * @invariant completedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security completedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: completedは共有非同期状態を持たない同期処理である。
 */
function completed(value: ProjectRuntimeDecisionRecoveryIntent | null) {
  return Object.freeze({ status: "completed" as const, value });
}
/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns blockedの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked() {
  return Object.freeze({ status: "blocked" as const, value: null });
}

/**
 * createProjectRuntimeDecisionRecoveryStoreの処理を実行する。
 *
 * @responsibility createProjectRuntimeDecisionRecoveryStoreに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input workingDirectory: string
 * @returns ProjectRuntimeDecisionRecoveryStoreを返す。
 * @precondition 「workingDirectory: string」がcreateProjectRuntimeDecisionRecoveryStoreの入力契約を満たす。
 * @postcondition createProjectRuntimeDecisionRecoveryStoreの責務を完了した結果だけを返す。
 * @effect createProjectRuntimeDecisionRecoveryStoreはFilesystemの読取りまたは書込みを実行する。
 * @failure createProjectRuntimeDecisionRecoveryStoreは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createProjectRuntimeDecisionRecoveryStoreは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createProjectRuntimeDecisionRecoveryStoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createProjectRuntimeDecisionRecoveryStoreは共有非同期状態を持たない同期処理である。
 */
export function createProjectRuntimeDecisionRecoveryStore(
  workingDirectory: string,
): ProjectRuntimeDecisionRecoveryStore {
  const runtimeArea = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      workingDirectory,
      "project-runtime",
    ),
    "decision_recovery_repository_root_invalid",
  );
  const projectRuntimeRoot = runtimeArea.directory;
  /**
   * guardedの処理を実行する。
   *
   * @responsibility guardedに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000008
   * @input recoveryId: string、operation: (directory: string) => T
   * @returns guardedの計算結果を返す。
   * @precondition 「recoveryId: string、operation: (directory: string) => T」がguardedの入力契約を満たす。
   * @postcondition guardedの責務を完了した結果だけを返す。
   * @effect guardedはFilesystemの読取りまたは書込みを実行する。
   * @failure guardedは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant guardedは宣言した境界以外へEffectを拡張しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security guardedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: guardedは共有非同期状態を持たない同期処理である。
   */
  function guarded<T>(recoveryId: string, operation: (directory: string) => T) {
    const location = paths(projectRuntimeRoot, recoveryId);
    const directories = [
      path.join(projectRuntimeRoot, "recovery"),
      path.join(projectRuntimeRoot, "recovery", "decisions"),
    ];
    let parent = projectRuntimeRoot;
    for (const current of directories) {
      if (path.dirname(current) !== parent)
        throw new Error("decision_recovery_store_boundary_invalid");
      try {
        fs.mkdirSync(current, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const metadata = fs.lstatSync(current);
      if (!metadata.isDirectory() || metadata.isSymbolicLink())
        throw new Error("decision_recovery_store_boundary_invalid");
      parent = current;
    }
    return operation(location.directory);
  }
  return Object.freeze({
    /**
     * createの処理を実行する。
     *
     * @responsibility createに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000008
     * @input intent
     * @returns createの計算結果を返す。
     * @precondition 「intent」がcreateの入力契約を満たす。
     * @postcondition createの責務を完了した結果だけを返す。
     * @effect N/A: createは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure createは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant createは入力から導いた結果以外の共有状態を変更しない。
     * @boundary FilesystemとProcess内Domain処理の境界。
     * @security createはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: createは共有非同期状態を持たない同期処理である。
     */
    create(intent) {
      if (!validIntent(intent)) return blocked();
      try {
        return guarded(intent.recoveryId, (directory) => {
          if (readChain(directory, intent.recoveryId)) return blocked();
          writeGeneration(directory, 1, null, intent);
          return completed(intent);
        });
      } catch {
        return blocked();
      }
    },
    /**
     * readの処理を実行する。
     *
     * @responsibility readに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000008
     * @input recoveryId
     * @returns readの計算結果を返す。
     * @precondition 「recoveryId」がreadの入力契約を満たす。
     * @postcondition readの責務を完了した結果だけを返す。
     * @effect N/A: readは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure readは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant readは入力から導いた結果以外の共有状態を変更しない。
     * @boundary FilesystemとProcess内Domain処理の境界。
     * @security readはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: readは共有非同期状態を持たない同期処理である。
     */
    read(recoveryId) {
      if (!ID.test(recoveryId)) return blocked();
      try {
        return guarded(recoveryId, (directory) =>
          completed(readChain(directory, recoveryId)?.value ?? null),
        );
      } catch {
        return blocked();
      }
    },
    /**
     * compareAndSetの処理を実行する。
     *
     * @responsibility compareAndSetに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000008
     * @input expected、next
     * @returns compareAndSetの計算結果を返す。
     * @precondition 「expected、next」がcompareAndSetの入力契約を満たす。
     * @postcondition compareAndSetの責務を完了した結果だけを返す。
     * @effect N/A: compareAndSetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure compareAndSetは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant compareAndSetは入力から導いた結果以外の共有状態を変更しない。
     * @boundary FilesystemとProcess内Domain処理の境界。
     * @security compareAndSetはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: compareAndSetは共有非同期状態を持たない同期処理である。
     */
    compareAndSet(expected, next) {
      if (
        !validIntent(expected) ||
        !validIntent(next) ||
        expected.recoveryId !== next.recoveryId
      )
        return blocked();
      try {
        return guarded(expected.recoveryId, (directory) => {
          const current = readChain(directory, expected.recoveryId);
          if (
            !current ||
            JSON.stringify(current.value) !== JSON.stringify(expected)
          )
            return blocked();
          writeGeneration(
            directory,
            current.generation + 1,
            digest(`${JSON.stringify(current)}\n`),
            next,
          );
          return completed(next);
        });
      } catch {
        return blocked();
      }
    },
  });
}

/**
 * describeProjectRuntimeDecisionRecoveryStoreContractの処理を実行する。
 *
 * @responsibility describeProjectRuntimeDecisionRecoveryStoreContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeProjectRuntimeDecisionRecoveryStoreContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeProjectRuntimeDecisionRecoveryStoreContractの入力契約を満たす。
 * @postcondition describeProjectRuntimeDecisionRecoveryStoreContractの責務を完了した結果だけを返す。
 * @effect N/A: describeProjectRuntimeDecisionRecoveryStoreContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeProjectRuntimeDecisionRecoveryStoreContractは独自の失敗分岐を所有しない。
 * @invariant describeProjectRuntimeDecisionRecoveryStoreContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeProjectRuntimeDecisionRecoveryStoreContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeProjectRuntimeDecisionRecoveryStoreContractは共有非同期状態を持たない同期処理である。
 */
export function describeProjectRuntimeDecisionRecoveryStoreContract() {
  return Object.freeze({
    contract: PROJECT_RUNTIME_DECISION_RECOVERY_STORE_CONTRACT,
    root: "repository_local_runtime_owned_recovery_store",
    authority: "none",
    mutation: "immutable_generation_chain_with_atomic_no_replace_publish",
    unknownState: "fail_closed",
  });
}

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { acquireRuntimeOwnedCandidateStoreKernelLock } from "./candidate-store-kernel-lock.ts";
import {
  consumeRuntimeOwnedCandidateStoreRootCapability,
  inspectRuntimeOwnedWindowsCandidateStore,
} from "./candidate-store-windows-adapter.ts";
import { parseUnambiguousJsonDocument } from "./claude-structured-result.ts";
import { inspectRuntimeOwnedDevelopmentOperationContext } from "./development-measurement-session.ts";
import { containsRecognizedSecretMaterial } from "./secret-material-policy.ts";

export const CANDIDATE_BUNDLE_STORE_CONTRACT =
  "crdd-coordinator/candidate-bundle-store";
export const CANDIDATE_BUNDLE_STORE_CONTRACT_REVISION = 5;

const STORE_DIRECTORY_NAME = "crdd-coordinator-candidates-v2";
const STORE_LOCK_NAME = "candidate-store.lock";
const CANDIDATE_ID_PATTERN = /^candidate\.([0-9a-f]{64})\.([0-9a-f]{64})$/u;
const RECOVERY_ID_PATTERN =
  /^candidate-recovery\.([0-9a-f]{64})\.([0-9a-f]{64})$/u;
const STORE_RECOVERY_ID_PATTERN = /^candidate-store-recovery\.([0-9a-f]{64})$/u;
const STORE_ENTRY_PATTERN =
  /^(?:(?:candidate|staged)-[0-9a-f]{64}\.json|pending-[0-9a-f]{64}\.tmp)$/u;
const MAXIMUM_BUNDLE_BYTES = 24 * 1024 * 1024;
const MAXIMUM_STORE_ENTRIES = 128;
const MAXIMUM_STORE_BYTES = 256 * 1024 * 1024;
const MAXIMUM_INVENTORY_SCAN_ENTRIES = 512;
const STORE_LOCK_ATTEMPTS = 25;
const STORE_LOCK_RETRY_MILLISECONDS = 10;
const STORE_LOCK_STALE_OBSERVATION_MILLISECONDS = 5 * 60 * 1_000;

/**
 * CandidateBundleが扱う値の構造を表す。
 *
 * @responsibility CandidateBundleに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape CandidateBundleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateBundleで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateBundleの宣言は外部境界を開かない。
 * @security CandidateBundleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateBundleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateBundle = Readonly<{
  schema: "crdd-coordinator-candidate-bundle/v1";
  baseCommit: string;
  baseTree: string;
  baseManifestHash: string;
  patchHash: string;
  contentManifestHash: string;
  allowedPathsHash: string;
  changedPaths: readonly string[];
  entries: readonly Readonly<{
    relativePath: string;
    operation: "upsert" | "delete";
    byteLength: number;
    sha256: string | null;
    contentBase64: string | null;
  }>[];
}>;
/**
 * StoredCandidateが扱う値の構造を表す。
 *
 * @responsibility StoredCandidateに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape StoredCandidateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StoredCandidateで宣言した値と責務の対応を維持する。
 * @boundary N/A: StoredCandidateの宣言は外部境界を開かない。
 * @security StoredCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StoredCandidateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StoredCandidate = Readonly<{
  schema: "crdd-coordinator/stored-candidate/v2";
  createdAtMs: number;
  expiresAtMs: number;
  informationClassification: "public" | "internal" | "confidential";
  bundle: CandidateBundle;
}>;

/**
 * CandidateStoreFaultOperationが扱う値の構造を表す。
 *
 * @responsibility CandidateStoreFaultOperationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape CandidateStoreFaultOperationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateStoreFaultOperationで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateStoreFaultOperationの宣言は外部境界を開かない。
 * @security CandidateStoreFaultOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateStoreFaultOperationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateStoreFaultOperation =
  | "after_pending_rename"
  | "after_publish_rename"
  | "before_discard_remove"
  | "before_gc_remove"
  | "before_lock_remove"
  | "before_pending_open"
  | "before_pending_sync"
  | "before_pending_write"
  | "before_staged_verify"
  | "before_published_verify";

/**
 * CandidateStoreRuntimeが扱う値の構造を表す。
 *
 * @responsibility CandidateStoreRuntimeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape CandidateStoreRuntimeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateStoreRuntimeで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateStoreRuntimeの宣言は外部境界を開かない。
 * @security CandidateStoreRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateStoreRuntimeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateStoreRuntime = Readonly<{
  securityBoundary: "production" | "testing";
  shouldCollectExpiredEntries: boolean;
  developmentContext?: object;
  shouldInitializeRoot?: boolean;
  assertNewWork?: () => void;
  recordOwnedCandidate?: (candidateRecoveryId: string) => void;
  temporaryDirectory: () => string;
  nowMs: () => number;
  randomBytes: (size: number) => Buffer;
  injectFault: (operation: CandidateStoreFaultOperation) => void;
}>;

/**
 * CandidateStoreTestingOptionsが扱う値の構造を表す。
 *
 * @responsibility CandidateStoreTestingOptionsに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape CandidateStoreTestingOptionsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CandidateStoreTestingOptionsで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateStoreTestingOptionsの宣言は外部境界を開かない。
 * @security CandidateStoreTestingOptionsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CandidateStoreTestingOptionsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CandidateStoreTestingOptions = Readonly<{
  temporaryDirectory: string;
  shouldCollectExpiredEntries?: boolean;
  nowMs?: () => number;
  randomBytes?: (size: number) => Buffer;
  injectFault?: (operation: CandidateStoreFaultOperation) => void;
}>;

const productionRuntime: CandidateStoreRuntime = Object.freeze({
  securityBoundary: "production",
  shouldCollectExpiredEntries: true,
  temporaryDirectory: () => "",
  nowMs: Date.now,
  randomBytes,
  injectFault: () => {},
});

/**
 * CandidateStoreFailureが担う状態と操作を提供する。
 *
 * @responsibility CandidateStoreFailureに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000015
 * @construction CandidateStoreFailureの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle CandidateStoreFailureが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: CandidateStoreFailureの宣言自体は実行時Effectを発行しない。
 * @failure N/A: CandidateStoreFailureの宣言自体は実行時失敗を所有しない。
 * @invariant CandidateStoreFailureで宣言した値と責務の対応を維持する。
 * @boundary N/A: CandidateStoreFailureの宣言は外部境界を開かない。
 * @security CandidateStoreFailureはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: CandidateStoreFailureは共有非同期状態を持たない同期処理である。
 */
class CandidateStoreFailure extends Error {
  readonly recoveryId: string | null;
  readonly storeRecoveryId: string | null;
  readonly manualRecoveryRequired: boolean;

  constructor(
    reason: string,
    recoveryId: string | null = null,
    manualRecoveryRequired = false,
    storeRecoveryId: string | null = null,
  ) {
    super(reason);
    this.recoveryId = recoveryId;
    this.storeRecoveryId = storeRecoveryId;
    this.manualRecoveryRequired = manualRecoveryRequired;
  }
}

/**
 * errorCodeの処理を実行する。
 *
 * @responsibility errorCodeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input error: unknown
 * @returns errorCodeの計算結果を返す。
 * @precondition 「error: unknown」がerrorCodeの入力契約を満たす。
 * @postcondition errorCodeの責務を完了した結果だけを返す。
 * @effect N/A: errorCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: errorCodeは独自の失敗分岐を所有しない。
 * @invariant errorCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security errorCodeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: errorCodeは共有非同期状態を持たない同期処理である。
 */
function errorCode(error: unknown) {
  return error && typeof error === "object" && "code" in error
    ? (error as { code?: unknown }).code
    : null;
}

/**
 * storeDirectoryの処理を実行する。
 *
 * @responsibility storeDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime
 * @returns storeDirectoryの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime」がstoreDirectoryの入力契約を満たす。
 * @postcondition storeDirectoryの責務を完了した結果だけを返す。
 * @effect storeDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure storeDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant storeDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security storeDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: storeDirectoryは共有非同期状態を持たない同期処理である。
 */
function storeDirectory(runtime: CandidateStoreRuntime) {
  if (runtime.securityBoundary === "production") {
    const observation = inspectRuntimeOwnedWindowsCandidateStore(
      runtime.shouldInitializeRoot !== false,
      new Date().toISOString(),
      runtime.developmentContext,
    );
    const root = consumeRuntimeOwnedCandidateStoreRootCapability(
      observation.rootCapability,
    );
    if (
      observation.status !== "candidate" ||
      !root ||
      observation.selectedUserBindingVerified !== true ||
      observation.protectionVerified !== true ||
      observation.stableIdentityObserved !== true
    ) {
      throw new CandidateStoreFailure(
        observation.reason,
        null,
        observation.manualRecoveryRequired === true,
      );
    }
    return Object.freeze({
      store: root.rootPath,
      candidateStoreIdentityHash: root.candidateStoreIdentityHash,
      candidateStoreProtectionHash: root.candidateStoreProtectionHash,
      localUserBindingHash: root.localUserBindingHash,
    });
  }
  const temporaryParent = fs.realpathSync.native(runtime.temporaryDirectory());
  const parentMetadata = fs.lstatSync(temporaryParent);
  if (!parentMetadata.isDirectory() || parentMetadata.isSymbolicLink())
    throw new Error("candidate_store_parent_invalid");
  const store = path.join(temporaryParent, STORE_DIRECTORY_NAME);
  try {
    fs.mkdirSync(store, { mode: 0o700 });
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw error;
  }
  const metadata = fs.lstatSync(store);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    fs.realpathSync.native(store) !== store ||
    path.dirname(store) !== temporaryParent
  ) {
    throw new Error("candidate_store_directory_invalid");
  }
  return Object.freeze({
    store,
    candidateStoreIdentityHash: "testing",
    candidateStoreProtectionHash: "testing",
    localUserBindingHash: "testing",
  });
}

/**
 * verifyProductionStoreDirectoryの処理を実行する。
 *
 * @responsibility verifyProductionStoreDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime、expected: ReturnType<typeof storeDirectory>
 * @returns verifyProductionStoreDirectoryの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime、expected: ReturnType<typeof storeDirectory>」がverifyProductionStoreDirectoryの入力契約を満たす。
 * @postcondition verifyProductionStoreDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: verifyProductionStoreDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: verifyProductionStoreDirectoryは独自の失敗分岐を所有しない。
 * @invariant verifyProductionStoreDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security verifyProductionStoreDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: verifyProductionStoreDirectoryは共有非同期状態を持たない同期処理である。
 */
function verifyProductionStoreDirectory(
  runtime: CandidateStoreRuntime,
  expected: ReturnType<typeof storeDirectory>,
) {
  if (runtime.securityBoundary !== "production") return true;
  const observation = inspectRuntimeOwnedWindowsCandidateStore(
    false,
    new Date().toISOString(),
    runtime.developmentContext,
  );
  const root = consumeRuntimeOwnedCandidateStoreRootCapability(
    observation.rootCapability,
  );
  return (
    observation.status === "candidate" &&
    root !== null &&
    root.candidateStoreIdentityHash === expected.candidateStoreIdentityHash &&
    root.candidateStoreProtectionHash ===
      expected.candidateStoreProtectionHash &&
    root.localUserBindingHash === expected.localUserBindingHash &&
    root.rootPath === expected.store
  );
}

/**
 * candidateLocationの処理を実行する。
 *
 * @responsibility candidateLocationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input rawCandidateId: unknown
 * @returns candidateLocationの計算結果を返す。
 * @precondition 「rawCandidateId: unknown」がcandidateLocationの入力契約を満たす。
 * @postcondition candidateLocationの責務を完了した結果だけを返す。
 * @effect N/A: candidateLocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: candidateLocationは独自の失敗分岐を所有しない。
 * @invariant candidateLocationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security candidateLocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: candidateLocationは共有非同期状態を持たない同期処理である。
 */
function candidateLocation(rawCandidateId: unknown) {
  if (typeof rawCandidateId !== "string") return null;
  const published = CANDIDATE_ID_PATTERN.exec(rawCandidateId);
  const recovery = RECOVERY_ID_PATTERN.exec(rawCandidateId);
  const match = published ?? recovery;
  if (!match?.[1] || !match[2]) return null;
  return Object.freeze({
    candidateId: rawCandidateId,
    storageId: match[1],
    expectedHash: match[2],
    kind: published ? ("published" as const) : ("staged" as const),
  });
}

/**
 * validDigestの処理を実行する。
 *
 * @responsibility validDigestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: unknown、bytes: 20 | 32
 * @returns validDigestの計算結果を返す。
 * @precondition 「value: unknown、bytes: 20 | 32」がvalidDigestの入力契約を満たす。
 * @postcondition validDigestの責務を完了した結果だけを返す。
 * @effect N/A: validDigestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validDigestは独自の失敗分岐を所有しない。
 * @invariant validDigestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validDigestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validDigestは共有非同期状態を持たない同期処理である。
 */
function validDigest(value: unknown, bytes: 20 | 32) {
  return (
    typeof value === "string" &&
    new RegExp(`^[0-9a-f]{${bytes * 2}}$`, "u").test(value)
  );
}

/**
 * validRelativePathの処理を実行する。
 *
 * @responsibility validRelativePathに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns validRelativePathの計算結果を返す。
 * @precondition 「value: unknown」がvalidRelativePathの入力契約を満たす。
 * @postcondition validRelativePathの責務を完了した結果だけを返す。
 * @effect N/A: validRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRelativePathは独自の失敗分岐を所有しない。
 * @invariant validRelativePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validRelativePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validRelativePathは共有非同期状態を持たない同期処理である。
 */
function validRelativePath(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= 1_024 &&
    !path.isAbsolute(value) &&
    !value.includes("\\") &&
    value
      .split("/")
      .every((segment) => segment && segment !== "." && segment !== "..")
  );
}

/**
 * normalizeBundleの処理を実行する。
 *
 * @responsibility normalizeBundleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input rawBundle: unknown
 * @returns CandidateBundle | nullを返す。
 * @precondition 「rawBundle: unknown」がnormalizeBundleの入力契約を満たす。
 * @postcondition normalizeBundleの責務を完了した結果だけを返す。
 * @effect N/A: normalizeBundleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeBundleは独自の失敗分岐を所有しない。
 * @invariant normalizeBundleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security normalizeBundleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeBundleは共有非同期状態を持たない同期処理である。
 */
function normalizeBundle(rawBundle: unknown): CandidateBundle | null {
  if (!rawBundle || typeof rawBundle !== "object" || Array.isArray(rawBundle))
    return null;
  const bundle = rawBundle as Record<string, unknown>;
  const keys = Object.keys(bundle).sort();
  const expectedKeys = [
    "allowedPathsHash",
    "baseCommit",
    "baseManifestHash",
    "baseTree",
    "changedPaths",
    "contentManifestHash",
    "entries",
    "patchHash",
    "schema",
  ].sort();
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key, index) => key !== expectedKeys[index])
  )
    return null;
  if (
    bundle.schema !== "crdd-coordinator-candidate-bundle/v1" ||
    !validDigest(bundle.baseCommit, 20) ||
    !validDigest(bundle.baseTree, 20) ||
    !validDigest(bundle.baseManifestHash, 32) ||
    !validDigest(bundle.patchHash, 32) ||
    !validDigest(bundle.contentManifestHash, 32) ||
    !validDigest(bundle.allowedPathsHash, 32) ||
    !Array.isArray(bundle.changedPaths) ||
    !Array.isArray(bundle.entries) ||
    bundle.changedPaths.length > 1_000 ||
    bundle.entries.length !== bundle.changedPaths.length
  ) {
    return null;
  }
  const changedPaths: string[] = [];
  const entries: Array<CandidateBundle["entries"][number]> = [];
  for (let index = 0; index < bundle.changedPaths.length; index += 1) {
    const relativePath = bundle.changedPaths[index];
    const rawEntry = bundle.entries[index];
    if (
      !validRelativePath(relativePath) ||
      !rawEntry ||
      typeof rawEntry !== "object" ||
      Array.isArray(rawEntry)
    ) {
      return null;
    }
    const entry = rawEntry as Record<string, unknown>;
    if (
      Object.keys(entry).sort().join("\0") !==
        ["byteLength", "contentBase64", "operation", "relativePath", "sha256"]
          .sort()
          .join("\0") ||
      entry.relativePath !== relativePath ||
      (entry.operation !== "upsert" && entry.operation !== "delete") ||
      !Number.isSafeInteger(entry.byteLength) ||
      (entry.byteLength as number) < 0
    ) {
      return null;
    }
    if (entry.operation === "delete") {
      if (
        entry.byteLength !== 0 ||
        entry.sha256 !== null ||
        entry.contentBase64 !== null
      ) {
        return null;
      }
    } else {
      if (
        !validDigest(entry.sha256, 32) ||
        typeof entry.contentBase64 !== "string"
      ) {
        return null;
      }
      const content = Buffer.from(entry.contentBase64, "base64");
      if (
        content.byteLength !== entry.byteLength ||
        content.toString("base64") !== entry.contentBase64 ||
        createHash("sha256").update(content).digest("hex") !== entry.sha256
      ) {
        return null;
      }
    }
    changedPaths.push(relativePath);
    entries.push(
      Object.freeze({
        relativePath,
        operation: entry.operation,
        byteLength: entry.byteLength as number,
        sha256: entry.sha256 as string | null,
        contentBase64: entry.contentBase64 as string | null,
      }),
    );
  }
  const sortedPaths = [...changedPaths].sort((left, right) =>
    Buffer.from(left).compare(Buffer.from(right)),
  );
  if (
    new Set(changedPaths).size !== changedPaths.length ||
    changedPaths.some((value, index) => value !== sortedPaths[index])
  ) {
    return null;
  }
  return Object.freeze({
    schema: "crdd-coordinator-candidate-bundle/v1",
    baseCommit: bundle.baseCommit as string,
    baseTree: bundle.baseTree as string,
    baseManifestHash: bundle.baseManifestHash as string,
    patchHash: bundle.patchHash as string,
    contentManifestHash: bundle.contentManifestHash as string,
    allowedPathsHash: bundle.allowedPathsHash as string,
    changedPaths: Object.freeze(changedPaths),
    entries: Object.freeze(entries),
  });
}

/**
 * normalizeStoredCandidateの処理を実行する。
 *
 * @responsibility normalizeStoredCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input raw: unknown
 * @returns StoredCandidate | nullを返す。
 * @precondition 「raw: unknown」がnormalizeStoredCandidateの入力契約を満たす。
 * @postcondition normalizeStoredCandidateの責務を完了した結果だけを返す。
 * @effect N/A: normalizeStoredCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeStoredCandidateは独自の失敗分岐を所有しない。
 * @invariant normalizeStoredCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security normalizeStoredCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeStoredCandidateは共有非同期状態を持たない同期処理である。
 */
function normalizeStoredCandidate(raw: unknown): StoredCandidate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (
    Object.keys(value).sort().join("\0") !==
      [
        "bundle",
        "createdAtMs",
        "expiresAtMs",
        "informationClassification",
        "schema",
      ]
        .sort()
        .join("\0") ||
    value.schema !== "crdd-coordinator/stored-candidate/v2" ||
    !Number.isSafeInteger(value.createdAtMs) ||
    !Number.isSafeInteger(value.expiresAtMs) ||
    (value.createdAtMs as number) < 0 ||
    (value.expiresAtMs as number) <= (value.createdAtMs as number) ||
    !["public", "internal", "confidential"].includes(
      value.informationClassification as string,
    )
  ) {
    return null;
  }
  const bundle = normalizeBundle(value.bundle);
  return bundle
    ? Object.freeze({
        schema: "crdd-coordinator/stored-candidate/v2" as const,
        createdAtMs: value.createdAtMs as number,
        expiresAtMs: value.expiresAtMs as number,
        informationClassification: value.informationClassification as
          | "public"
          | "internal"
          | "confidential",
        bundle,
      })
    : null;
}

/**
 * containsRecognizedSecretの処理を実行する。
 *
 * @responsibility containsRecognizedSecretに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input bundle: CandidateBundle
 * @returns containsRecognizedSecretの計算結果を返す。
 * @precondition 「bundle: CandidateBundle」がcontainsRecognizedSecretの入力契約を満たす。
 * @postcondition containsRecognizedSecretの責務を完了した結果だけを返す。
 * @effect N/A: containsRecognizedSecretは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: containsRecognizedSecretは独自の失敗分岐を所有しない。
 * @invariant containsRecognizedSecretは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security containsRecognizedSecretはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: containsRecognizedSecretは共有非同期状態を持たない同期処理である。
 */
function containsRecognizedSecret(bundle: CandidateBundle) {
  return bundle.entries.some((entry) => {
    return containsRecognizedSecretMaterial(
      entry.relativePath,
      entry.operation === "upsert" && entry.contentBase64 !== null
        ? Buffer.from(entry.contentBase64, "base64")
        : "",
    );
  });
}

/**
 * StableFileIdentityが扱う値の構造を表す。
 *
 * @responsibility StableFileIdentityに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape StableFileIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant StableFileIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: StableFileIdentityの宣言は外部境界を開かない。
 * @security StableFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility StableFileIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type StableFileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  size: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}>;

/**
 * stableFileIdentityの処理を実行する。
 *
 * @responsibility stableFileIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input metadata: fs.BigIntStats
 * @returns StableFileIdentityを返す。
 * @precondition 「metadata: fs.BigIntStats」がstableFileIdentityの入力契約を満たす。
 * @postcondition stableFileIdentityの責務を完了した結果だけを返す。
 * @effect N/A: stableFileIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure stableFileIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableFileIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stableFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stableFileIdentityは共有非同期状態を持たない同期処理である。
 */
function stableFileIdentity(metadata: fs.BigIntStats): StableFileIdentity {
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 0n) {
    throw new CandidateStoreFailure("candidate_store_entry_invalid");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    size: metadata.size,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
  });
}

/**
 * sameStableFileIdentityの処理を実行する。
 *
 * @responsibility sameStableFileIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input left: StableFileIdentity、right: StableFileIdentity
 * @returns sameStableFileIdentityの計算結果を返す。
 * @precondition 「left: StableFileIdentity、right: StableFileIdentity」がsameStableFileIdentityの入力契約を満たす。
 * @postcondition sameStableFileIdentityの責務を完了した結果だけを返す。
 * @effect N/A: sameStableFileIdentityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameStableFileIdentityは独自の失敗分岐を所有しない。
 * @invariant sameStableFileIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security sameStableFileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameStableFileIdentityは共有非同期状態を持たない同期処理である。
 */
function sameStableFileIdentity(
  left: StableFileIdentity,
  right: StableFileIdentity,
) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

/**
 * candidateStoreRecoveryIdの処理を実行する。
 *
 * @responsibility candidateStoreRecoveryIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input name: string、identity: StableFileIdentity
 * @returns candidateStoreRecoveryIdの計算結果を返す。
 * @precondition 「name: string、identity: StableFileIdentity」がcandidateStoreRecoveryIdの入力契約を満たす。
 * @postcondition candidateStoreRecoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: candidateStoreRecoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: candidateStoreRecoveryIdは独自の失敗分岐を所有しない。
 * @invariant candidateStoreRecoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security candidateStoreRecoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: candidateStoreRecoveryIdは共有非同期状態を持たない同期処理である。
 */
function candidateStoreRecoveryId(name: string, identity: StableFileIdentity) {
  return `candidate-store-recovery.${createHash("sha256")
    .update("crdd-candidate-store-recovery-v1\0")
    .update(name, "utf8")
    .update("\0")
    .update(identity.dev.toString(16))
    .update("\0")
    .update(identity.ino.toString(16))
    .update("\0")
    .update(identity.birthtimeNs.toString(16))
    .update("\0")
    .update(identity.size.toString(16))
    .update("\0")
    .update(identity.mtimeNs.toString(16))
    .update("\0")
    .update(identity.ctimeNs.toString(16))
    .digest("hex")}`;
}

/**
 * waitForLockRetryの処理を実行する。
 *
 * @responsibility waitForLockRetryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: waitForLockRetryは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がwaitForLockRetryの入力契約を満たす。
 * @postcondition waitForLockRetryの責務を完了して呼出し元へ制御を戻す。
 * @effect N/A: waitForLockRetryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: waitForLockRetryは独自の失敗分岐を所有しない。
 * @invariant waitForLockRetryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security waitForLockRetryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: waitForLockRetryは共有非同期状態を持たない同期処理である。
 */
function waitForLockRetry() {
  Atomics.wait(
    new Int32Array(new SharedArrayBuffer(4)),
    0,
    0,
    STORE_LOCK_RETRY_MILLISECONDS,
  );
}

/**
 * stableRemoveの処理を実行する。
 *
 * @responsibility stableRemoveに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime、target: string、identity: StableFileIdentity、faultOperation: CandidateStoreFaultOperation
 * @returns N/A: stableRemoveは戻り値を返さない。
 * @precondition 「runtime: CandidateStoreRuntime、target: string、identity: StableFileIdentity、faultOperation: CandidateStoreFaultOperation」がstableRemoveの入力契約を満たす。
 * @postcondition stableRemoveの責務を完了して呼出し元へ制御を戻す。
 * @effect stableRemoveはFilesystemの読取りまたは書込みを実行する。
 * @failure stableRemoveは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableRemoveは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stableRemoveはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stableRemoveは共有非同期状態を持たない同期処理である。
 */
function stableRemove(
  runtime: CandidateStoreRuntime,
  target: string,
  identity: StableFileIdentity,
  faultOperation: CandidateStoreFaultOperation,
) {
  const current = stableFileIdentity(fs.lstatSync(target, { bigint: true }));
  if (!sameStableFileIdentity(identity, current)) {
    throw new CandidateStoreFailure("candidate_store_entry_changed");
  }
  runtime.injectFault(faultOperation);
  fs.rmSync(target);
  try {
    fs.lstatSync(target);
    throw new CandidateStoreFailure("candidate_store_cleanup_unconfirmed");
  } catch (error) {
    if (error instanceof CandidateStoreFailure) throw error;
    if (errorCode(error) !== "ENOENT") throw error;
  }
}

/**
 * withStoreLockの処理を実行する。
 *
 * @responsibility withStoreLockに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime、operation: (store: string, nowMs: number) => T
 * @returns withStoreLockの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime、operation: (store: string, nowMs: number) => T」がwithStoreLockの入力契約を満たす。
 * @postcondition withStoreLockの責務を完了した結果だけを返す。
 * @effect withStoreLockはFilesystemの読取りまたは書込みを実行する。
 * @failure withStoreLockは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant withStoreLockは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security withStoreLockはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: withStoreLockは共有非同期状態を持たない同期処理である。
 */
function withStoreLock<T>(
  runtime: CandidateStoreRuntime,
  operation: (store: string, nowMs: number) => T,
) {
  let resolvedStore: ReturnType<typeof storeDirectory>;
  try {
    resolvedStore = storeDirectory(runtime);
  } catch (error) {
    const failure =
      error instanceof CandidateStoreFailure
        ? error
        : new CandidateStoreFailure("candidate_store_root_unavailable");
    return Object.freeze({
      status: "blocked" as const,
      reason: failure.message,
      value: null,
      recoveryId: failure.recoveryId,
      storeRecoveryId: failure.storeRecoveryId,
      manualRecoveryRequired: failure.manualRecoveryRequired,
    });
  }
  const store = resolvedStore.store;
  if (runtime.securityBoundary === "production") {
    const kernelLock = acquireRuntimeOwnedCandidateStoreKernelLock(
      resolvedStore.candidateStoreProtectionHash,
    );
    if (!kernelLock) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_store_kernel_lock_unavailable",
        value: null,
        recoveryId: null,
        storeRecoveryId: null,
        manualRecoveryRequired: false,
      });
    }
    let value: T | null = null;
    let failure: CandidateStoreFailure | null = null;
    try {
      const nowMs = runtime.nowMs();
      if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
        throw new CandidateStoreFailure("candidate_store_clock_invalid");
      }
      value = operation(store, nowMs);
      if (!verifyProductionStoreDirectory(runtime, resolvedStore)) {
        throw new CandidateStoreFailure(
          "candidate_store_root_changed_recovery_required",
          recoverableCandidateIdFromValue(value),
          true,
        );
      }
    } catch (error) {
      failure =
        error instanceof CandidateStoreFailure
          ? error
          : new CandidateStoreFailure("candidate_store_operation_failed");
    }
    if (!kernelLock.release()) {
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_store_kernel_lock_release_unconfirmed",
        value,
        recoveryId:
          failure?.recoveryId ?? recoverableCandidateIdFromValue(value),
        storeRecoveryId: failure?.storeRecoveryId ?? null,
        manualRecoveryRequired: true,
      });
    }
    return failure
      ? Object.freeze({
          status: "blocked" as const,
          reason: failure.message,
          value,
          recoveryId: failure.recoveryId,
          storeRecoveryId: failure.storeRecoveryId,
          manualRecoveryRequired: failure.manualRecoveryRequired,
        })
      : Object.freeze({
          status: "completed" as const,
          reason: "candidate_store_operation_completed",
          value: value as T,
          recoveryId: null,
          storeRecoveryId: null,
          manualRecoveryRequired: false,
        });
  }
  const lockTarget = path.join(store, STORE_LOCK_NAME);
  let handle: number | null = null;
  for (let attempt = 0; attempt < STORE_LOCK_ATTEMPTS; attempt += 1) {
    try {
      handle = fs.openSync(lockTarget, "wx", 0o600);
      break;
    } catch (error) {
      if (errorCode(error) !== "EEXIST") {
        return Object.freeze({
          status: "blocked" as const,
          reason: "candidate_store_lock_create_failed",
          value: null,
          recoveryId: null,
          storeRecoveryId: null,
          manualRecoveryRequired: true,
        });
      }
      if (attempt + 1 < STORE_LOCK_ATTEMPTS) waitForLockRetry();
    }
  }
  if (handle === null) {
    let isStale = false;
    try {
      const metadata = fs.lstatSync(lockTarget, { bigint: true });
      stableFileIdentity(metadata);
      const nowMs = runtime.nowMs();
      isStale =
        Number.isSafeInteger(nowMs) &&
        nowMs >= 0 &&
        metadata.mtimeNs +
          BigInt(STORE_LOCK_STALE_OBSERVATION_MILLISECONDS) * 1_000_000n <=
          BigInt(nowMs) * 1_000_000n;
    } catch {
      isStale = true;
    }
    return Object.freeze({
      status: "blocked" as const,
      reason: isStale
        ? "candidate_store_stale_lock_manual_recovery_required"
        : "candidate_store_lock_unavailable",
      value: null,
      recoveryId: null,
      storeRecoveryId: null,
      manualRecoveryRequired: isStale,
    });
  }

  let lockIdentity: StableFileIdentity;
  try {
    const nowMs = runtime.nowMs();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
      throw new CandidateStoreFailure("candidate_store_clock_invalid");
    }
    fs.writeFileSync(
      handle,
      Buffer.from(
        `${JSON.stringify({ schema: "crdd-coordinator/candidate-store-lock/v1", acquiredAtMs: nowMs })}\n`,
        "utf8",
      ),
    );
    fs.fsyncSync(handle);
    lockIdentity = stableFileIdentity(fs.fstatSync(handle, { bigint: true }));
  } catch (error) {
    fs.closeSync(handle);
    try {
      const identity = stableFileIdentity(
        fs.lstatSync(lockTarget, { bigint: true }),
      );
      stableRemove(runtime, lockTarget, identity, "before_lock_remove");
    } catch {
      return Object.freeze({
        status: "blocked" as const,
        reason: "candidate_store_lock_initialization_recovery_required",
        value: null,
        recoveryId: null,
        storeRecoveryId: null,
        manualRecoveryRequired: true,
      });
    }
    return Object.freeze({
      status: "blocked" as const,
      reason:
        error instanceof CandidateStoreFailure
          ? error.message
          : "candidate_store_lock_initialization_failed",
      value: null,
      recoveryId: null,
      storeRecoveryId: null,
      manualRecoveryRequired: false,
    });
  }

  let value: T | null = null;
  let failure: CandidateStoreFailure | null = null;
  try {
    value = operation(store, runtime.nowMs());
  } catch (error) {
    failure =
      error instanceof CandidateStoreFailure
        ? error
        : new CandidateStoreFailure("candidate_store_operation_failed");
  } finally {
    fs.closeSync(handle);
  }
  try {
    stableRemove(runtime, lockTarget, lockIdentity, "before_lock_remove");
  } catch {
    return Object.freeze({
      status: "blocked" as const,
      reason: "candidate_store_lock_release_recovery_required",
      value,
      recoveryId: failure?.recoveryId ?? null,
      storeRecoveryId: failure?.storeRecoveryId ?? null,
      manualRecoveryRequired: true,
    });
  }
  return failure
    ? Object.freeze({
        status: "blocked" as const,
        reason: failure.message,
        value,
        recoveryId: failure.recoveryId,
        storeRecoveryId: failure.storeRecoveryId,
        manualRecoveryRequired: failure.manualRecoveryRequired,
      })
    : Object.freeze({
        status: "completed" as const,
        reason: "candidate_store_operation_completed",
        value: value as T,
        recoveryId: null,
        storeRecoveryId: null,
        manualRecoveryRequired: false,
      });
}

/**
 * readStableCandidateの処理を実行する。
 *
 * @responsibility readStableCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input target: string、expectedHash: string、runtime: CandidateStoreRuntime、verifyFault: CandidateStoreFaultOperation
 * @returns readStableCandidateの計算結果を返す。
 * @precondition 「target: string、expectedHash: string、runtime: CandidateStoreRuntime、verifyFault: CandidateStoreFaultOperation」がreadStableCandidateの入力契約を満たす。
 * @postcondition readStableCandidateの責務を完了した結果だけを返す。
 * @effect readStableCandidateはFilesystemの読取りまたは書込みを実行する。
 * @failure readStableCandidateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readStableCandidateは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readStableCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readStableCandidateは共有非同期状態を持たない同期処理である。
 */
function readStableCandidate(
  target: string,
  expectedHash: string,
  runtime?: CandidateStoreRuntime,
  verifyFault?: CandidateStoreFaultOperation,
) {
  if (runtime && verifyFault) runtime.injectFault(verifyFault);
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size <= 0n ||
      before.size > BigInt(MAXIMUM_BUNDLE_BYTES)
    ) {
      throw new Error("candidate_bundle_file_invalid");
    }
    const content = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < content.byteLength) {
      const readBytes = fs.readSync(
        handle,
        content,
        offset,
        content.byteLength - offset,
        offset,
      );
      if (readBytes <= 0) throw new Error("candidate_bundle_file_changed");
      offset += readBytes;
    }
    const after = fs.fstatSync(handle, { bigint: true });
    const current = fs.lstatSync(target, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      !current.isFile() ||
      current.isSymbolicLink() ||
      current.dev !== before.dev ||
      current.ino !== before.ino ||
      current.birthtimeNs !== before.birthtimeNs ||
      createHash("sha256").update(content).digest("hex") !== expectedHash
    ) {
      throw new Error("candidate_bundle_file_changed");
    }
    return content;
  } finally {
    fs.closeSync(handle);
  }
}

/**
 * storedCandidateの処理を実行する。
 *
 * @responsibility storedCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input content: Buffer
 * @returns storedCandidateの計算結果を返す。
 * @precondition 「content: Buffer」がstoredCandidateの入力契約を満たす。
 * @postcondition storedCandidateの責務を完了した結果だけを返す。
 * @effect N/A: storedCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: storedCandidateは独自の失敗分岐を所有しない。
 * @invariant storedCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security storedCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: storedCandidateは共有非同期状態を持たない同期処理である。
 */
function storedCandidate(content: Buffer) {
  const parsed = parseUnambiguousJsonDocument(
    new TextDecoder("utf-8", { fatal: true }).decode(content),
  );
  return normalizeStoredCandidate(parsed);
}

/**
 * recoveryIdの処理を実行する。
 *
 * @responsibility recoveryIdに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input storageId: string、bundleHash: string
 * @returns recoveryIdの計算結果を返す。
 * @precondition 「storageId: string、bundleHash: string」がrecoveryIdの入力契約を満たす。
 * @postcondition recoveryIdの責務を完了した結果だけを返す。
 * @effect N/A: recoveryIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoveryIdは独自の失敗分岐を所有しない。
 * @invariant recoveryIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security recoveryIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryIdは共有非同期状態を持たない同期処理である。
 */
function recoveryId(storageId: string, bundleHash: string) {
  return `candidate-recovery.${storageId}.${bundleHash}`;
}

/**
 * physicalTargetsの処理を実行する。
 *
 * @responsibility physicalTargetsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input store: string、storageId: string
 * @returns physicalTargetsの計算結果を返す。
 * @precondition 「store: string、storageId: string」がphysicalTargetsの入力契約を満たす。
 * @postcondition physicalTargetsの責務を完了した結果だけを返す。
 * @effect N/A: physicalTargetsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: physicalTargetsは独自の失敗分岐を所有しない。
 * @invariant physicalTargetsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security physicalTargetsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: physicalTargetsは共有非同期状態を持たない同期処理である。
 */
function physicalTargets(store: string, storageId: string) {
  return Object.freeze({
    pending: path.join(store, `pending-${storageId}.tmp`),
    staged: path.join(store, `staged-${storageId}.json`),
    published: path.join(store, `candidate-${storageId}.json`),
  });
}

/**
 * existingTargetsの処理を実行する。
 *
 * @responsibility existingTargetsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input store: string、storageId: string
 * @returns existingTargetsの計算結果を返す。
 * @precondition 「store: string、storageId: string」がexistingTargetsの入力契約を満たす。
 * @postcondition existingTargetsの責務を完了した結果だけを返す。
 * @effect existingTargetsはFilesystemの読取りまたは書込みを実行する。
 * @failure existingTargetsは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant existingTargetsは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security existingTargetsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: existingTargetsは共有非同期状態を持たない同期処理である。
 */
function existingTargets(store: string, storageId: string) {
  const targets = physicalTargets(store, storageId);
  return Object.freeze(
    (Object.entries(targets) as Array<[keyof typeof targets, string]>).flatMap(
      ([kind, target]) => {
        try {
          const identity = stableFileIdentity(
            fs.lstatSync(target, { bigint: true }),
          );
          return [Object.freeze({ kind, target, identity })];
        } catch (error) {
          if (errorCode(error) === "ENOENT") return [];
          throw error;
        }
      },
    ),
  );
}

/**
 * storeInventoryAndGcの処理を実行する。
 *
 * @responsibility storeInventoryAndGcに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime、store: string、nowMs: number
 * @returns storeInventoryAndGcの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime、store: string、nowMs: number」がstoreInventoryAndGcの入力契約を満たす。
 * @postcondition storeInventoryAndGcの責務を完了した結果だけを返す。
 * @effect storeInventoryAndGcはFilesystemの読取りまたは書込みを実行する。
 * @failure storeInventoryAndGcは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant storeInventoryAndGcは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security storeInventoryAndGcはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: storeInventoryAndGcは共有非同期状態を持たない同期処理である。
 */
function storeInventoryAndGc(
  runtime: CandidateStoreRuntime,
  store: string,
  nowMs: number,
) {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) {
    throw new CandidateStoreFailure("candidate_store_clock_invalid");
  }
  const directory = fs.opendirSync(store);
  const entries: Array<{
    name: string;
    target: string;
    identity: StableFileIdentity;
  }> = [];
  let scannedBytes = 0;
  try {
    while (true) {
      const entry = directory.readSync();
      if (!entry) break;
      if (entry.name === STORE_LOCK_NAME) continue;
      if (entries.length >= MAXIMUM_INVENTORY_SCAN_ENTRIES) {
        throw new CandidateStoreFailure(
          "candidate_store_inventory_scan_budget_exceeded",
        );
      }
      if (!entry.isFile() || !STORE_ENTRY_PATTERN.test(entry.name)) {
        let storeRecoveryId: string | null = null;
        if (entry.isFile()) {
          try {
            const identity = stableFileIdentity(
              fs.lstatSync(path.join(store, entry.name), { bigint: true }),
            );
            storeRecoveryId = candidateStoreRecoveryId(entry.name, identity);
          } catch {
            storeRecoveryId = null;
          }
        }
        throw new CandidateStoreFailure(
          "candidate_store_unknown_entry",
          null,
          true,
          storeRecoveryId,
        );
      }
      const target = path.join(store, entry.name);
      const identity = stableFileIdentity(
        fs.lstatSync(target, { bigint: true }),
      );
      scannedBytes += Number(identity.size);
      if (scannedBytes > MAXIMUM_STORE_BYTES) {
        throw new CandidateStoreFailure("candidate_store_byte_budget_exceeded");
      }
      entries.push({
        name: entry.name,
        target,
        identity,
      });
    }
  } finally {
    directory.closeSync();
  }

  let deletedEntries = 0;
  for (const entry of entries) {
    let stored: StoredCandidate | null = null;
    let hash: string | null = null;
    try {
      if (
        entry.identity.size <= 0n ||
        entry.identity.size > BigInt(MAXIMUM_BUNDLE_BYTES)
      ) {
        continue;
      }
      const content = fs.readFileSync(entry.target);
      hash = createHash("sha256").update(content).digest("hex");
      stored = storedCandidate(content);
    } catch {
      stored = null;
    }
    if (!stored) {
      throw new CandidateStoreFailure(
        "candidate_store_damaged_entry",
        null,
        true,
        candidateStoreRecoveryId(entry.name, entry.identity),
      );
    }
    if (stored.expiresAtMs > nowMs || !runtime.shouldCollectExpiredEntries)
      continue;
    const storageId = /-([0-9a-f]{64})\.(?:json|tmp)$/u.exec(entry.name)?.[1];
    const ownedRecoveryId =
      storageId && hash ? recoveryId(storageId, hash) : null;
    try {
      stableRemove(runtime, entry.target, entry.identity, "before_gc_remove");
      deletedEntries += 1;
    } catch {
      throw new CandidateStoreFailure(
        "candidate_store_gc_cleanup_recovery_required",
        ownedRecoveryId,
        true,
      );
    }
  }

  let count = 0;
  let totalBytes = 0;
  const refreshed = fs.opendirSync(store);
  try {
    while (true) {
      const entry = refreshed.readSync();
      if (!entry) break;
      if (entry.name === STORE_LOCK_NAME) continue;
      if (!entry.isFile() || !STORE_ENTRY_PATTERN.test(entry.name)) {
        let storeRecoveryId: string | null = null;
        if (entry.isFile()) {
          try {
            const identity = stableFileIdentity(
              fs.lstatSync(path.join(store, entry.name), { bigint: true }),
            );
            storeRecoveryId = candidateStoreRecoveryId(entry.name, identity);
          } catch {
            storeRecoveryId = null;
          }
        }
        throw new CandidateStoreFailure(
          "candidate_store_unknown_entry",
          null,
          true,
          storeRecoveryId,
        );
      }
      count += 1;
      if (count > MAXIMUM_STORE_ENTRIES) {
        throw new CandidateStoreFailure(
          "candidate_store_entry_budget_exceeded",
        );
      }
      const metadata = stableFileIdentity(
        fs.lstatSync(path.join(store, entry.name), { bigint: true }),
      );
      totalBytes += Number(metadata.size);
      if (totalBytes > MAXIMUM_STORE_BYTES) {
        throw new CandidateStoreFailure("candidate_store_byte_budget_exceeded");
      }
    }
  } finally {
    refreshed.closeSync();
  }
  return Object.freeze({ count, totalBytes, deletedEntries });
}

/**
 * blockedResultの処理を実行する。
 *
 * @responsibility blockedResultに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input reason: string、candidateRecoveryId: string | null、manualRecoveryRequired: boolean、candidateStoreRecoveryId: string | null
 * @returns blockedResultの計算結果を返す。
 * @precondition 「reason: string、candidateRecoveryId: string | null、manualRecoveryRequired: boolean、candidateStoreRecoveryId: string | null」がblockedResultの入力契約を満たす。
 * @postcondition blockedResultの責務を完了した結果だけを返す。
 * @effect N/A: blockedResultは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedResultは独自の失敗分岐を所有しない。
 * @invariant blockedResultは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security blockedResultはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedResultは共有非同期状態を持たない同期処理である。
 */
function blockedResult(
  reason: string,
  candidateRecoveryId: string | null,
  manualRecoveryRequired: boolean,
  candidateStoreRecoveryId: string | null = null,
) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    candidateRecoveryId,
    candidateStoreRecoveryId,
    manualRecoveryRequired,
    hostPathReported: false,
  });
}

/**
 * recoverableCandidateIdFromValueの処理を実行する。
 *
 * @responsibility recoverableCandidateIdFromValueに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns recoverableCandidateIdFromValueの計算結果を返す。
 * @precondition 「value: unknown」がrecoverableCandidateIdFromValueの入力契約を満たす。
 * @postcondition recoverableCandidateIdFromValueの責務を完了した結果だけを返す。
 * @effect N/A: recoverableCandidateIdFromValueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoverableCandidateIdFromValueは独自の失敗分岐を所有しない。
 * @invariant recoverableCandidateIdFromValueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security recoverableCandidateIdFromValueはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverableCandidateIdFromValueは共有非同期状態を持たない同期処理である。
 */
function recoverableCandidateIdFromValue(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Readonly<Record<string, unknown>>;
  if (
    typeof record.candidateRecoveryId === "string" &&
    RECOVERY_ID_PATTERN.test(record.candidateRecoveryId)
  ) {
    return record.candidateRecoveryId;
  }
  if (
    typeof record.candidateId === "string" &&
    CANDIDATE_ID_PATTERN.test(record.candidateId)
  ) {
    const location = candidateLocation(record.candidateId);
    return location
      ? recoveryId(location.storageId, location.expectedHash)
      : null;
  }
  return null;
}

/**
 * persistRuntimeOwnedCandidateBundleWithRuntimeの処理を実行する。
 *
 * @responsibility persistRuntimeOwnedCandidateBundleWithRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime、rawBundle: unknown、rawPolicy: unknown
 * @returns persistRuntimeOwnedCandidateBundleWithRuntimeの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime、rawBundle: unknown、rawPolicy: unknown」がpersistRuntimeOwnedCandidateBundleWithRuntimeの入力契約を満たす。
 * @postcondition persistRuntimeOwnedCandidateBundleWithRuntimeの責務を完了した結果だけを返す。
 * @effect persistRuntimeOwnedCandidateBundleWithRuntimeはFilesystemの読取りまたは書込みを実行する。
 * @failure persistRuntimeOwnedCandidateBundleWithRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant persistRuntimeOwnedCandidateBundleWithRuntimeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security persistRuntimeOwnedCandidateBundleWithRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistRuntimeOwnedCandidateBundleWithRuntimeは共有非同期状態を持たない同期処理である。
 */
function persistRuntimeOwnedCandidateBundleWithRuntime(
  runtime: CandidateStoreRuntime,
  rawBundle: unknown,
  rawPolicy: unknown,
) {
  try {
    const bundle = normalizeBundle(rawBundle);
    if (!rawPolicy || typeof rawPolicy !== "object" || Array.isArray(rawPolicy))
      return null;
    const policy = rawPolicy as Record<string, unknown>;
    if (
      !bundle ||
      containsRecognizedSecret(bundle) ||
      policy.candidatePersistenceAllowed !== true ||
      !Number.isSafeInteger(policy.candidateRetentionHours) ||
      (policy.candidateRetentionHours as number) < 1 ||
      (policy.candidateRetentionHours as number) > 168 ||
      !["public", "internal", "confidential"].includes(
        policy.informationClassification as string,
      )
    ) {
      return null;
    }
    const nowMs = runtime.nowMs();
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) return null;
    const stored = Object.freeze({
      schema: "crdd-coordinator/stored-candidate/v2" as const,
      createdAtMs: nowMs,
      expiresAtMs:
        nowMs + (policy.candidateRetentionHours as number) * 60 * 60 * 1_000,
      informationClassification: policy.informationClassification as
        | "public"
        | "internal"
        | "confidential",
      bundle,
    });
    const serialized = Buffer.from(`${JSON.stringify(stored)}\n`, "utf8");
    if (serialized.byteLength > MAXIMUM_BUNDLE_BYTES) return null;
    const bundleHash = createHash("sha256").update(serialized).digest("hex");
    const storageId = createHash("sha256")
      .update("crdd-candidate-storage-v1\0")
      .update(runtime.randomBytes(32))
      .digest("hex");
    const ownedRecoveryId = recoveryId(storageId, bundleHash);
    const locked = withStoreLock(runtime, (store, lockedNowMs) => {
      const inventory = storeInventoryAndGc(runtime, store, lockedNowMs);
      if (
        inventory.count >= MAXIMUM_STORE_ENTRIES ||
        inventory.totalBytes + serialized.byteLength > MAXIMUM_STORE_BYTES
      ) {
        throw new CandidateStoreFailure(
          "candidate_store_capacity_reservation_failed",
        );
      }
      const targets = physicalTargets(store, storageId);
      let handle: number | null = null;
      let pendingIdentity: StableFileIdentity | null = null;
      let ownedEntityCreated = false;
      try {
        runtime.injectFault("before_pending_open");
        runtime.assertNewWork?.();
        handle = fs.openSync(targets.pending, "wx", 0o600);
        ownedEntityCreated = true;
        runtime.recordOwnedCandidate?.(ownedRecoveryId);
        pendingIdentity = stableFileIdentity(
          fs.fstatSync(handle, { bigint: true }),
        );
        runtime.injectFault("before_pending_write");
        fs.writeFileSync(handle, serialized);
        runtime.injectFault("before_pending_sync");
        fs.fsyncSync(handle);
        pendingIdentity = stableFileIdentity(
          fs.fstatSync(handle, { bigint: true }),
        );
        fs.closeSync(handle);
        handle = null;
        fs.renameSync(targets.pending, targets.staged);
        runtime.injectFault("after_pending_rename");
        readStableCandidate(
          targets.staged,
          bundleHash,
          runtime,
          "before_staged_verify",
        );
      } catch {
        if (handle !== null) {
          try {
            pendingIdentity = stableFileIdentity(
              fs.fstatSync(handle, { bigint: true }),
            );
          } catch {
            pendingIdentity = null;
          }
          try {
            fs.closeSync(handle);
          } catch {
            throw new CandidateStoreFailure(
              "candidate_store_persist_recovery_required",
              ownedRecoveryId,
              true,
            );
          }
        }
        let existingTargetEntries: ReturnType<typeof existingTargets>;
        try {
          existingTargetEntries = existingTargets(store, storageId);
        } catch {
          throw new CandidateStoreFailure(
            "candidate_store_persist_recovery_required",
            ownedEntityCreated ? ownedRecoveryId : null,
            ownedEntityCreated,
          );
        }
        const stagedOrPublishedEntries = existingTargetEntries.filter(
          (entry) => entry.kind === "staged" || entry.kind === "published",
        );
        if (stagedOrPublishedEntries.length > 0) {
          throw new CandidateStoreFailure(
            "candidate_store_persist_recovery_required",
            ownedRecoveryId,
            false,
          );
        }
        const pending = existingTargetEntries.find(
          (entry) => entry.kind === "pending",
        );
        if (pending) {
          try {
            stableRemove(
              runtime,
              pending.target,
              pendingIdentity ?? pending.identity,
              "before_discard_remove",
            );
          } catch {
            throw new CandidateStoreFailure(
              "candidate_store_persist_recovery_required",
              ownedRecoveryId,
              true,
            );
          }
        }
        throw new CandidateStoreFailure("candidate_store_persist_failed");
      }
      return Object.freeze({
        status: "staged" as const,
        candidateRecoveryId: ownedRecoveryId,
        bundleHash,
        byteLength: serialized.byteLength,
        expiresAtMs: stored.expiresAtMs,
        hostPathReported: false,
        secretScanHeuristic: true,
        credentialAbsenceVerified: false,
      });
    });
    if (locked.status === "completed") return locked.value;
    const remainingRecoveryId =
      locked.recoveryId ?? locked.value?.candidateRecoveryId ?? null;
    return Object.freeze({
      ...blockedResult(
        locked.reason,
        remainingRecoveryId,
        locked.manualRecoveryRequired,
        locked.storeRecoveryId,
      ),
      bundleHash,
      byteLength: serialized.byteLength,
      expiresAtMs: stored.expiresAtMs,
      secretScanHeuristic: true,
      credentialAbsenceVerified: false,
    });
  } catch {
    return null;
  }
}

/**
 * readRuntimeOwnedCandidateBundleWithRuntimeの処理を実行する。
 *
 * @responsibility readRuntimeOwnedCandidateBundleWithRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime、rawCandidateId: unknown
 * @returns readRuntimeOwnedCandidateBundleWithRuntimeの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime、rawCandidateId: unknown」がreadRuntimeOwnedCandidateBundleWithRuntimeの入力契約を満たす。
 * @postcondition readRuntimeOwnedCandidateBundleWithRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: readRuntimeOwnedCandidateBundleWithRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readRuntimeOwnedCandidateBundleWithRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readRuntimeOwnedCandidateBundleWithRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readRuntimeOwnedCandidateBundleWithRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readRuntimeOwnedCandidateBundleWithRuntimeは共有非同期状態を持たない同期処理である。
 */
function readRuntimeOwnedCandidateBundleWithRuntime(
  runtime: CandidateStoreRuntime,
  rawCandidateId: unknown,
) {
  try {
    const location = candidateLocation(rawCandidateId);
    if (location?.kind !== "published") return null;
    const locked = withStoreLock(runtime, (store, nowMs) => {
      storeInventoryAndGc(runtime, store, nowMs);
      const target = physicalTargets(store, location.storageId).published;
      const content = readStableCandidate(target, location.expectedHash);
      const stored = storedCandidate(content);
      if (!stored || stored.expiresAtMs <= nowMs) {
        throw new CandidateStoreFailure("candidate_bundle_not_exportable");
      }
      return Object.freeze({
        status: "exported" as const,
        candidateId: location.candidateId,
        informationClassification: stored.informationClassification,
        expiresAtMs: stored.expiresAtMs,
        bundle: stored.bundle,
        hostPathReported: false,
        secretScanHeuristic: true,
        credentialAbsenceVerified: false,
      });
    });
    if (locked.status === "completed") return locked.value;
    return locked.reason === "candidate_store_operation_failed" &&
      !locked.manualRecoveryRequired &&
      !locked.recoveryId &&
      !locked.storeRecoveryId
      ? null
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return null;
  }
}

/**
 * publishRuntimeOwnedCandidateBundleWithRuntimeの処理を実行する。
 *
 * @responsibility publishRuntimeOwnedCandidateBundleWithRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime、rawRecoveryId: unknown
 * @returns publishRuntimeOwnedCandidateBundleWithRuntimeの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime、rawRecoveryId: unknown」がpublishRuntimeOwnedCandidateBundleWithRuntimeの入力契約を満たす。
 * @postcondition publishRuntimeOwnedCandidateBundleWithRuntimeの責務を完了した結果だけを返す。
 * @effect publishRuntimeOwnedCandidateBundleWithRuntimeはFilesystemの読取りまたは書込みを実行する。
 * @failure publishRuntimeOwnedCandidateBundleWithRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant publishRuntimeOwnedCandidateBundleWithRuntimeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security publishRuntimeOwnedCandidateBundleWithRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: publishRuntimeOwnedCandidateBundleWithRuntimeは共有非同期状態を持たない同期処理である。
 */
function publishRuntimeOwnedCandidateBundleWithRuntime(
  runtime: CandidateStoreRuntime,
  rawRecoveryId: unknown,
) {
  try {
    const location = candidateLocation(rawRecoveryId);
    if (location?.kind !== "staged") return null;
    const locked = withStoreLock(runtime, (store, nowMs) => {
      try {
        storeInventoryAndGc(runtime, store, nowMs);
        const existingTargetEntries = existingTargets(
          store,
          location.storageId,
        );
        if (existingTargetEntries.length !== 1) {
          throw new CandidateStoreFailure(
            existingTargetEntries.length > 1
              ? "candidate_bundle_recovery_ambiguous"
              : "candidate_bundle_not_available",
            existingTargetEntries.length > 1 ? location.candidateId : null,
          );
        }
        const current = existingTargetEntries[0];
        if (!current) {
          throw new CandidateStoreFailure("candidate_bundle_not_available");
        }
        if (current.kind === "pending") {
          throw new CandidateStoreFailure(
            "candidate_bundle_pending_recovery_required",
            location.candidateId,
          );
        }
        const verifyFault =
          current.kind === "staged"
            ? "before_staged_verify"
            : "before_published_verify";
        const content = readStableCandidate(
          current.target,
          location.expectedHash,
          runtime,
          verifyFault,
        );
        const stored = storedCandidate(content);
        if (!stored || stored.expiresAtMs <= nowMs) {
          throw new CandidateStoreFailure(
            "candidate_bundle_not_publishable",
            location.candidateId,
          );
        }
        const targets = physicalTargets(store, location.storageId);
        if (current.kind === "staged") {
          runtime.assertNewWork?.();
          fs.renameSync(current.target, targets.published);
          runtime.injectFault("after_publish_rename");
          readStableCandidate(
            targets.published,
            location.expectedHash,
            runtime,
            "before_published_verify",
          );
        }
        return Object.freeze({
          status: "published" as const,
          candidateId: `candidate.${location.storageId}.${location.expectedHash}`,
          expiresAtMs: stored.expiresAtMs,
          hostPathReported: false,
        });
      } catch (error) {
        if (error instanceof CandidateStoreFailure) throw error;
        let isOwnedEntityPresent = false;
        try {
          isOwnedEntityPresent =
            existingTargets(store, location.storageId).length > 0;
        } catch {
          isOwnedEntityPresent = true;
        }
        throw new CandidateStoreFailure(
          "candidate_bundle_publish_recovery_required",
          isOwnedEntityPresent ? location.candidateId : null,
          isOwnedEntityPresent,
        );
      }
    });
    return locked.status === "completed"
      ? locked.value
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return null;
  }
}

/**
 * discardRuntimeOwnedCandidateBundleWithRuntimeの処理を実行する。
 *
 * @responsibility discardRuntimeOwnedCandidateBundleWithRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime、rawCandidateId: unknown
 * @returns discardRuntimeOwnedCandidateBundleWithRuntimeの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime、rawCandidateId: unknown」がdiscardRuntimeOwnedCandidateBundleWithRuntimeの入力契約を満たす。
 * @postcondition discardRuntimeOwnedCandidateBundleWithRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: discardRuntimeOwnedCandidateBundleWithRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure discardRuntimeOwnedCandidateBundleWithRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant discardRuntimeOwnedCandidateBundleWithRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security discardRuntimeOwnedCandidateBundleWithRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: discardRuntimeOwnedCandidateBundleWithRuntimeは共有非同期状態を持たない同期処理である。
 */
function discardRuntimeOwnedCandidateBundleWithRuntime(
  runtime: CandidateStoreRuntime,
  rawCandidateId: unknown,
) {
  try {
    const location = candidateLocation(rawCandidateId);
    if (!location) return Object.freeze({ status: "blocked" as const });
    const ownedRecoveryId = recoveryId(
      location.storageId,
      location.expectedHash,
    );
    const locked = withStoreLock(runtime, (store) => {
      const existingTargetEntries = existingTargets(
        store,
        location.storageId,
      ).filter(
        (entry) => location.kind === "staged" || entry.kind === "published",
      );
      if (existingTargetEntries.length !== 1) {
        throw new CandidateStoreFailure(
          existingTargetEntries.length > 1
            ? "candidate_bundle_recovery_ambiguous"
            : "candidate_bundle_not_available",
          existingTargetEntries.length > 1 ? ownedRecoveryId : null,
        );
      }
      const target = existingTargetEntries[0];
      if (!target) {
        throw new CandidateStoreFailure("candidate_bundle_not_available");
      }
      if (target.kind !== "pending") {
        readStableCandidate(target.target, location.expectedHash);
      }
      try {
        stableRemove(
          runtime,
          target.target,
          target.identity,
          "before_discard_remove",
        );
      } catch {
        throw new CandidateStoreFailure(
          "candidate_bundle_discard_recovery_required",
          ownedRecoveryId,
          true,
        );
      }
      return Object.freeze({ status: "discarded" as const });
    });
    return locked.status === "completed"
      ? locked.value
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return Object.freeze({ status: "blocked" as const });
  }
}

/**
 * recoverRuntimeOwnedCandidateStoreWithRuntimeの処理を実行する。
 *
 * @responsibility recoverRuntimeOwnedCandidateStoreWithRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime、rawRecoveryId: unknown
 * @returns recoverRuntimeOwnedCandidateStoreWithRuntimeの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime、rawRecoveryId: unknown」がrecoverRuntimeOwnedCandidateStoreWithRuntimeの入力契約を満たす。
 * @postcondition recoverRuntimeOwnedCandidateStoreWithRuntimeの責務を完了した結果だけを返す。
 * @effect recoverRuntimeOwnedCandidateStoreWithRuntimeはFilesystemの読取りまたは書込みを実行する。
 * @failure recoverRuntimeOwnedCandidateStoreWithRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoverRuntimeOwnedCandidateStoreWithRuntimeは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security recoverRuntimeOwnedCandidateStoreWithRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverRuntimeOwnedCandidateStoreWithRuntimeは共有非同期状態を持たない同期処理である。
 */
function recoverRuntimeOwnedCandidateStoreWithRuntime(
  runtime: CandidateStoreRuntime,
  rawRecoveryId: unknown,
) {
  try {
    if (
      typeof rawRecoveryId !== "string" ||
      !STORE_RECOVERY_ID_PATTERN.test(rawRecoveryId)
    ) {
      return blockedResult("candidate_store_recovery_id_invalid", null, false);
    }
    const locked = withStoreLock(runtime, (store) => {
      const directory = fs.opendirSync(store);
      const matches: Array<{
        target: string;
        identity: StableFileIdentity;
      }> = [];
      let scannedEntries = 0;
      try {
        while (true) {
          const entry = directory.readSync();
          if (!entry) break;
          if (entry.name === STORE_LOCK_NAME) continue;
          scannedEntries += 1;
          if (scannedEntries > MAXIMUM_INVENTORY_SCAN_ENTRIES) {
            throw new CandidateStoreFailure(
              "candidate_store_inventory_scan_budget_exceeded",
            );
          }
          if (!entry.isFile()) continue;
          const target = path.join(store, entry.name);
          const identity = stableFileIdentity(
            fs.lstatSync(target, { bigint: true }),
          );
          let isRecoverable = !STORE_ENTRY_PATTERN.test(entry.name);
          if (!isRecoverable) {
            try {
              if (
                identity.size <= 0n ||
                identity.size > BigInt(MAXIMUM_BUNDLE_BYTES)
              ) {
                isRecoverable = true;
              } else {
                isRecoverable =
                  storedCandidate(fs.readFileSync(target)) === null;
              }
            } catch {
              isRecoverable = true;
            }
          }
          if (
            isRecoverable &&
            candidateStoreRecoveryId(entry.name, identity) === rawRecoveryId
          ) {
            matches.push({ target, identity });
          }
        }
      } finally {
        directory.closeSync();
      }
      if (matches.length !== 1 || !matches[0]) {
        throw new CandidateStoreFailure(
          matches.length > 1
            ? "candidate_store_recovery_ambiguous"
            : "candidate_store_recovery_target_unavailable",
          null,
          true,
          rawRecoveryId,
        );
      }
      try {
        stableRemove(
          runtime,
          matches[0].target,
          matches[0].identity,
          "before_discard_remove",
        );
      } catch {
        throw new CandidateStoreFailure(
          "candidate_store_recovery_cleanup_unconfirmed",
          null,
          true,
          rawRecoveryId,
        );
      }
      return Object.freeze({
        status: "recovered" as const,
        reason: "candidate_store_exact_entry_recovered",
        manualRecoveryRequired: false,
        hostPathReported: false,
      });
    });
    return locked.status === "completed"
      ? locked.value
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return blockedResult("candidate_store_recovery_failed", null, true);
  }
}

/**
 * runCandidateStoreGcWithRuntimeの処理を実行する。
 *
 * @responsibility runCandidateStoreGcWithRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input runtime: CandidateStoreRuntime
 * @returns runCandidateStoreGcWithRuntimeの計算結果を返す。
 * @precondition 「runtime: CandidateStoreRuntime」がrunCandidateStoreGcWithRuntimeの入力契約を満たす。
 * @postcondition runCandidateStoreGcWithRuntimeの責務を完了した結果だけを返す。
 * @effect N/A: runCandidateStoreGcWithRuntimeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runCandidateStoreGcWithRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runCandidateStoreGcWithRuntimeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security runCandidateStoreGcWithRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runCandidateStoreGcWithRuntimeは共有非同期状態を持たない同期処理である。
 */
function runCandidateStoreGcWithRuntime(runtime: CandidateStoreRuntime) {
  try {
    const locked = withStoreLock(runtime, (store, nowMs) =>
      storeInventoryAndGc(runtime, store, nowMs),
    );
    return locked.status === "completed"
      ? Object.freeze({
          status: "completed" as const,
          reason: "candidate_store_gc_completed",
          deletedEntries: locked.value.deletedEntries,
          hostPathReported: false,
        })
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return blockedResult("candidate_store_gc_failed", null, true);
  }
}

const developmentCandidates = new WeakMap<object, Set<string>>();

/**
 * runtimeForOperationの処理を実行する。
 *
 * @responsibility runtimeForOperationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、purpose: "persist" | "read" | "publish" | "discard"、candidateId: unknown
 * @returns CandidateStoreRuntime | nullを返す。
 * @precondition 「managementCapability: unknown、purpose: "persist" | "read" | "publish" | "discard"、candidateId: unknown」がruntimeForOperationの入力契約を満たす。
 * @postcondition runtimeForOperationの責務を完了した結果だけを返す。
 * @effect N/A: runtimeForOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure runtimeForOperationは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant runtimeForOperationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security runtimeForOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runtimeForOperationは共有非同期状態を持たない同期処理である。
 */
function runtimeForOperation(
  managementCapability: unknown,
  purpose: "persist" | "read" | "publish" | "discard",
  candidateId?: unknown,
): CandidateStoreRuntime | null {
  const development =
    inspectRuntimeOwnedDevelopmentOperationContext(managementCapability);
  if (!development) return productionRuntime;
  if (!managementCapability || typeof managementCapability !== "object")
    return null;
  let candidateIds = developmentCandidates.get(managementCapability);
  if (purpose === "persist") {
    if (!development.checkNewWork()) return null;
    if (!candidateIds) {
      candidateIds = new Set<string>();
      developmentCandidates.set(managementCapability, candidateIds);
    }
  } else {
    const location = candidateLocation(candidateId);
    if (
      !location ||
      !candidateIds?.has(recoveryId(location.storageId, location.expectedHash))
    )
      return null;
  }
  const ownedIds = candidateIds;
  const context =
    purpose === "discard"
      ? development.cleanupContext
      : development.newWorkContext;
  if (!context || !ownedIds) return null;
  return Object.freeze({
    ...productionRuntime,
    shouldCollectExpiredEntries: false,
    shouldInitializeRoot: purpose === "persist",
    developmentContext: context,
    assertNewWork: () => {
      if (!development.checkNewWork())
        throw new CandidateStoreFailure(
          "candidate_store_development_permission_expired",
        );
    },
    recordOwnedCandidate: (id: string) => {
      ownedIds.add(id);
    },
  });
}

/**
 * persistRuntimeOwnedCandidateBundleの処理を実行する。
 *
 * @responsibility persistRuntimeOwnedCandidateBundleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input rawBundle: unknown、rawPolicy: unknown、managementCapability: unknown
 * @returns persistRuntimeOwnedCandidateBundleの計算結果を返す。
 * @precondition 「rawBundle: unknown、rawPolicy: unknown、managementCapability: unknown」がpersistRuntimeOwnedCandidateBundleの入力契約を満たす。
 * @postcondition persistRuntimeOwnedCandidateBundleの責務を完了した結果だけを返す。
 * @effect N/A: persistRuntimeOwnedCandidateBundleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: persistRuntimeOwnedCandidateBundleは独自の失敗分岐を所有しない。
 * @invariant persistRuntimeOwnedCandidateBundleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security persistRuntimeOwnedCandidateBundleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: persistRuntimeOwnedCandidateBundleは共有非同期状態を持たない同期処理である。
 */
export function persistRuntimeOwnedCandidateBundle(
  rawBundle: unknown,
  rawPolicy: unknown,
  managementCapability?: unknown,
) {
  const runtime = runtimeForOperation(managementCapability, "persist");
  if (!runtime) return null;
  return persistRuntimeOwnedCandidateBundleWithRuntime(
    runtime,
    rawBundle,
    rawPolicy,
  );
}

/**
 * readRuntimeOwnedCandidateBundleの処理を実行する。
 *
 * @responsibility readRuntimeOwnedCandidateBundleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input rawCandidateId: unknown、managementCapability: unknown
 * @returns readRuntimeOwnedCandidateBundleの計算結果を返す。
 * @precondition 「rawCandidateId: unknown、managementCapability: unknown」がreadRuntimeOwnedCandidateBundleの入力契約を満たす。
 * @postcondition readRuntimeOwnedCandidateBundleの責務を完了した結果だけを返す。
 * @effect N/A: readRuntimeOwnedCandidateBundleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readRuntimeOwnedCandidateBundleは独自の失敗分岐を所有しない。
 * @invariant readRuntimeOwnedCandidateBundleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readRuntimeOwnedCandidateBundleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readRuntimeOwnedCandidateBundleは共有非同期状態を持たない同期処理である。
 */
export function readRuntimeOwnedCandidateBundle(
  rawCandidateId: unknown,
  managementCapability?: unknown,
) {
  const runtime = runtimeForOperation(
    managementCapability,
    "read",
    rawCandidateId,
  );
  if (!runtime) return null;
  return readRuntimeOwnedCandidateBundleWithRuntime(runtime, rawCandidateId);
}

/**
 * publishRuntimeOwnedCandidateBundleの処理を実行する。
 *
 * @responsibility publishRuntimeOwnedCandidateBundleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input rawRecoveryId: unknown、managementCapability: unknown
 * @returns publishRuntimeOwnedCandidateBundleの計算結果を返す。
 * @precondition 「rawRecoveryId: unknown、managementCapability: unknown」がpublishRuntimeOwnedCandidateBundleの入力契約を満たす。
 * @postcondition publishRuntimeOwnedCandidateBundleの責務を完了した結果だけを返す。
 * @effect N/A: publishRuntimeOwnedCandidateBundleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: publishRuntimeOwnedCandidateBundleは独自の失敗分岐を所有しない。
 * @invariant publishRuntimeOwnedCandidateBundleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security publishRuntimeOwnedCandidateBundleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: publishRuntimeOwnedCandidateBundleは共有非同期状態を持たない同期処理である。
 */
export function publishRuntimeOwnedCandidateBundle(
  rawRecoveryId: unknown,
  managementCapability?: unknown,
) {
  const runtime = runtimeForOperation(
    managementCapability,
    "publish",
    rawRecoveryId,
  );
  if (!runtime) return null;
  return publishRuntimeOwnedCandidateBundleWithRuntime(runtime, rawRecoveryId);
}

/**
 * discardRuntimeOwnedCandidateBundleの処理を実行する。
 *
 * @responsibility discardRuntimeOwnedCandidateBundleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input rawCandidateId: unknown、managementCapability: unknown
 * @returns discardRuntimeOwnedCandidateBundleの計算結果を返す。
 * @precondition 「rawCandidateId: unknown、managementCapability: unknown」がdiscardRuntimeOwnedCandidateBundleの入力契約を満たす。
 * @postcondition discardRuntimeOwnedCandidateBundleの責務を完了した結果だけを返す。
 * @effect N/A: discardRuntimeOwnedCandidateBundleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: discardRuntimeOwnedCandidateBundleは独自の失敗分岐を所有しない。
 * @invariant discardRuntimeOwnedCandidateBundleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security discardRuntimeOwnedCandidateBundleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: discardRuntimeOwnedCandidateBundleは共有非同期状態を持たない同期処理である。
 */
export function discardRuntimeOwnedCandidateBundle(
  rawCandidateId: unknown,
  managementCapability?: unknown,
) {
  const runtime = runtimeForOperation(
    managementCapability,
    "discard",
    rawCandidateId,
  );
  if (!runtime)
    return blockedResult(
      "candidate_store_development_target_not_authorized",
      null,
      false,
    );
  return discardRuntimeOwnedCandidateBundleWithRuntime(runtime, rawCandidateId);
}

/**
 * recoverRuntimeOwnedCandidateStoreの処理を実行する。
 *
 * @responsibility recoverRuntimeOwnedCandidateStoreに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input rawRecoveryId: unknown
 * @returns recoverRuntimeOwnedCandidateStoreの計算結果を返す。
 * @precondition 「rawRecoveryId: unknown」がrecoverRuntimeOwnedCandidateStoreの入力契約を満たす。
 * @postcondition recoverRuntimeOwnedCandidateStoreの責務を完了した結果だけを返す。
 * @effect N/A: recoverRuntimeOwnedCandidateStoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: recoverRuntimeOwnedCandidateStoreは独自の失敗分岐を所有しない。
 * @invariant recoverRuntimeOwnedCandidateStoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security recoverRuntimeOwnedCandidateStoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoverRuntimeOwnedCandidateStoreは共有非同期状態を持たない同期処理である。
 */
export function recoverRuntimeOwnedCandidateStore(rawRecoveryId: unknown) {
  return recoverRuntimeOwnedCandidateStoreWithRuntime(
    productionRuntime,
    rawRecoveryId,
  );
}

/**
 * runRuntimeOwnedCandidateStoreStartupGcの処理を実行する。
 *
 * @responsibility runRuntimeOwnedCandidateStoreStartupGcに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns runRuntimeOwnedCandidateStoreStartupGcの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がrunRuntimeOwnedCandidateStoreStartupGcの入力契約を満たす。
 * @postcondition runRuntimeOwnedCandidateStoreStartupGcの責務を完了した結果だけを返す。
 * @effect N/A: runRuntimeOwnedCandidateStoreStartupGcは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runRuntimeOwnedCandidateStoreStartupGcは独自の失敗分岐を所有しない。
 * @invariant runRuntimeOwnedCandidateStoreStartupGcは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security runRuntimeOwnedCandidateStoreStartupGcはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runRuntimeOwnedCandidateStoreStartupGcは共有非同期状態を持たない同期処理である。
 */
export function runRuntimeOwnedCandidateStoreStartupGc() {
  return runCandidateStoreGcWithRuntime(productionRuntime);
}

/**
 * Read-only inventory, apart from acquiring the existing store lock/root.
 *
 * @responsibility inspectRuntimeOwnedDevelopmentCandidateStoreに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input developmentContext: object
 * @returns inspectRuntimeOwnedDevelopmentCandidateStoreの計算結果を返す。
 * @precondition 「developmentContext: object」がinspectRuntimeOwnedDevelopmentCandidateStoreの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedDevelopmentCandidateStoreの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedDevelopmentCandidateStoreは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectRuntimeOwnedDevelopmentCandidateStoreは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectRuntimeOwnedDevelopmentCandidateStoreは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security inspectRuntimeOwnedDevelopmentCandidateStoreはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedDevelopmentCandidateStoreは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedDevelopmentCandidateStore(
  developmentContext: object,
) {
  const runtime = Object.freeze({
    ...productionRuntime,
    developmentContext,
    shouldCollectExpiredEntries: false,
  });
  try {
    const locked = withStoreLock(runtime, (store, nowMs) =>
      storeInventoryAndGc(runtime, store, nowMs),
    );
    return locked.status === "completed"
      ? Object.freeze({
          status: "completed" as const,
          reason: "candidate_store_inventory_confirmed",
          deletedEntries: 0,
        })
      : blockedResult(
          locked.reason,
          locked.recoveryId,
          locked.manualRecoveryRequired,
          locked.storeRecoveryId,
        );
  } catch {
    return blockedResult("candidate_store_inventory_unavailable", null, true);
  }
}

/**
 * createCandidateBundleStoreTestingAdapterの処理を実行する。
 *
 * @responsibility createCandidateBundleStoreTestingAdapterに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input options: CandidateStoreTestingOptions
 * @returns createCandidateBundleStoreTestingAdapterの計算結果を返す。
 * @precondition 「options: CandidateStoreTestingOptions」がcreateCandidateBundleStoreTestingAdapterの入力契約を満たす。
 * @postcondition createCandidateBundleStoreTestingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: createCandidateBundleStoreTestingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure createCandidateBundleStoreTestingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createCandidateBundleStoreTestingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security createCandidateBundleStoreTestingAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createCandidateBundleStoreTestingAdapterは共有非同期状態を持たない同期処理である。
 */
export function createCandidateBundleStoreTestingAdapter(
  options: CandidateStoreTestingOptions,
) {
  if (
    !options ||
    typeof options.temporaryDirectory !== "string" ||
    !path.isAbsolute(options.temporaryDirectory)
  ) {
    throw new Error("candidate_store_testing_options_invalid");
  }
  const runtime = Object.freeze({
    securityBoundary: "testing" as const,
    shouldCollectExpiredEntries: options.shouldCollectExpiredEntries !== false,
    temporaryDirectory: () => options.temporaryDirectory,
    nowMs: options.nowMs ?? Date.now,
    randomBytes: options.randomBytes ?? randomBytes,
    injectFault: options.injectFault ?? (() => {}),
  });
  return Object.freeze({
    persist: (rawBundle: unknown, rawPolicy: unknown) =>
      persistRuntimeOwnedCandidateBundleWithRuntime(
        runtime,
        rawBundle,
        rawPolicy,
      ),
    read: (rawCandidateId: unknown) =>
      readRuntimeOwnedCandidateBundleWithRuntime(runtime, rawCandidateId),
    publish: (rawRecoveryId: unknown) =>
      publishRuntimeOwnedCandidateBundleWithRuntime(runtime, rawRecoveryId),
    discard: (rawCandidateId: unknown) =>
      discardRuntimeOwnedCandidateBundleWithRuntime(runtime, rawCandidateId),
    recoverStore: (rawRecoveryId: unknown) =>
      recoverRuntimeOwnedCandidateStoreWithRuntime(runtime, rawRecoveryId),
    startupGc: () => runCandidateStoreGcWithRuntime(runtime),
    testingStoreDirectory: () => storeDirectory(runtime).store,
  });
}

/**
 * describeCandidateBundleStoreContractの処理を実行する。
 *
 * @responsibility describeCandidateBundleStoreContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCandidateBundleStoreContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCandidateBundleStoreContractの入力契約を満たす。
 * @postcondition describeCandidateBundleStoreContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCandidateBundleStoreContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCandidateBundleStoreContractは独自の失敗分岐を所有しない。
 * @invariant describeCandidateBundleStoreContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeCandidateBundleStoreContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeCandidateBundleStoreContractは共有非同期状態を持たない同期処理である。
 */
export function describeCandidateBundleStoreContract() {
  return Object.freeze({
    contract: CANDIDATE_BUNDLE_STORE_CONTRACT,
    contractRevision: CANDIDATE_BUNDLE_STORE_CONTRACT_REVISION,
    persistence: "approved_candidate_only_local_user_transient_store",
    lifecycle: "staged_then_published_after_operation_cleanup",
    retention:
      "repository_policy_bounded_1_to_168_hours_export_blocked_at_expiry_with_bounded_startup_and_entry_gc",
    physicalDeletion:
      "best_effort_bounded_gc_without_strict_instant_deletion_claim",
    crossProcessSerialization:
      "selected_user_sid_store_identity_and_protection_bound_windows_kernel_named_pipe_lock_released_on_process_termination",
    rootProtection:
      "windows_known_folder_fixed_volume_non_reparse_selected_user_owner_exact_protected_dacl_observed_before_and_after",
    recovery:
      "pending_staged_or_published_exact_one_candidate_recovery_and_unknown_or_damaged_exact_entry_store_recovery",
    capacity: Object.freeze({
      maximumEntries: MAXIMUM_STORE_ENTRIES,
      maximumBytes: MAXIMUM_STORE_BYTES,
    }),
    integrity: "candidate_id_bound_sha256_exact_bundle",
    canonicalRepositoryWriteAllowed: false,
    apiKeyFallbackAllowed: false,
    recognizedSecretPersistenceAllowed: false,
    credentialAbsenceVerified: false,
    hostPathReported: false,
  });
}

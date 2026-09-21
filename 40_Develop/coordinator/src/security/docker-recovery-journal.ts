import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  classifyCleanupDirectoryState,
  classifyCommittedPairDeleteState,
  classifyCommittedPairMoveState,
} from "./docker-recovery-state-machine.ts";

const MAX_RECORD_BYTES = 262_144;
const COMMIT_SUFFIX = ".crdd-commit.json";
const TEMP_PREFIX = ".crdd-pending-";
const DELETE_PREFIX = ".crdd-delete-";
const MOVE_PREFIX = ".crdd-move-";
const CLEANUP_PREFIX = ".crdd-cleanup-";
const INTENT_PENDING_SUFFIX = ".pending";

/**
 * FileIdentityが扱う値の構造を表す。
 *
 * @responsibility FileIdentityに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape FileIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FileIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FileIdentityの宣言は外部境界を開かない。
 * @security FileIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility FileIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type FileIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
}>;

/**
 * CommittedJsonが扱う値の構造を表す。
 *
 * @responsibility CommittedJsonに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape CommittedJsonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CommittedJsonで宣言した値と責務の対応を維持する。
 * @boundary N/A: CommittedJsonの宣言は外部境界を開かない。
 * @security CommittedJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility CommittedJsonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type CommittedJson = Readonly<{
  target: string;
  commit: string;
  serialized: string;
  hash: string;
  identity: FileIdentity;
  identityText: string;
  logicalKey: string;
  value: unknown;
}>;

/**
 * DiscoveredJournalJsonが扱う値の構造を表す。
 *
 * @responsibility DiscoveredJournalJsonに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DiscoveredJournalJsonが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DiscoveredJournalJsonで宣言した値と責務の対応を維持する。
 * @boundary N/A: DiscoveredJournalJsonの宣言は外部境界を開かない。
 * @security DiscoveredJournalJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility DiscoveredJournalJsonの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DiscoveredJournalJson = Readonly<{
  serialized: string;
  hash: string;
  identityText: string;
  logicalKey: string;
  value: unknown;
}>;

/**
 * canonicalの処理を実行する。
 *
 * @responsibility canonicalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns canonicalの計算結果を返す。
 * @precondition 「value: unknown」がcanonicalの入力契約を満たす。
 * @postcondition canonicalの責務を完了した結果だけを返す。
 * @effect N/A: canonicalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: canonicalは独自の失敗分岐を所有しない。
 * @invariant canonicalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: canonicalはProcess内の同一Subsystemで完結する。
 * @security canonicalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: canonicalは共有非同期状態を持たない同期処理である。
 */
function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

/**
 * identityOfの処理を実行する。
 *
 * @responsibility identityOfに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input metadata: fs.BigIntStats
 * @returns FileIdentityを返す。
 * @precondition 「metadata: fs.BigIntStats」がidentityOfの入力契約を満たす。
 * @postcondition identityOfの責務を完了した結果だけを返す。
 * @effect N/A: identityOfは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: identityOfは独自の失敗分岐を所有しない。
 * @invariant identityOfは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityOfはProcess内の同一Subsystemで完結する。
 * @security identityOfはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityOfは共有非同期状態を持たない同期処理である。
 */
function identityOf(metadata: fs.BigIntStats): FileIdentity {
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
  });
}

/**
 * identityTextの処理を実行する。
 *
 * @responsibility identityTextに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input identity: FileIdentity
 * @returns identityTextの計算結果を返す。
 * @precondition 「identity: FileIdentity」がidentityTextの入力契約を満たす。
 * @postcondition identityTextの責務を完了した結果だけを返す。
 * @effect N/A: identityTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: identityTextは独自の失敗分岐を所有しない。
 * @invariant identityTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: identityTextはProcess内の同一Subsystemで完結する。
 * @security identityTextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: identityTextは共有非同期状態を持たない同期処理である。
 */
function identityText(identity: FileIdentity) {
  return `${identity.dev}:${identity.ino}:${identity.birthtimeNs}`;
}

/**
 * exactKeysの処理を実行する。
 *
 * @responsibility exactKeysに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown、keys: readonly string[]
 * @returns exactKeysの計算結果を返す。
 * @precondition 「value: unknown、keys: readonly string[]」がexactKeysの入力契約を満たす。
 * @postcondition exactKeysの責務を完了した結果だけを返す。
 * @effect N/A: exactKeysは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: exactKeysは独自の失敗分岐を所有しない。
 * @invariant exactKeysは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactKeysはProcess内の同一Subsystemで完結する。
 * @security exactKeysはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactKeysは共有非同期状態を持たない同期処理である。
 */
function exactKeys(value: unknown, keys: readonly string[]) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype &&
    Object.keys(value as Record<string, unknown>)
      .sort()
      .join("\0") === [...keys].sort().join("\0")
  );
}

/**
 * readStableFileの処理を実行する。
 *
 * @responsibility readStableFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input file: string
 * @returns readStableFileの計算結果を返す。
 * @precondition 「file: string」がreadStableFileの入力契約を満たす。
 * @postcondition readStableFileの責務を完了した結果だけを返す。
 * @effect readStableFileはFilesystemの読取りまたは書込みを実行する。
 * @failure readStableFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readStableFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security readStableFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readStableFileは共有非同期状態を持たない同期処理である。
 */
function readStableFile(file: string) {
  const before = fs.lstatSync(file, { bigint: true });
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.size <= 0n ||
    before.size > BigInt(MAX_RECORD_BYTES)
  )
    throw new Error("docker_task_recovery_record_invalid");
  const serialized = fs.readFileSync(file, "utf8");
  const after = fs.lstatSync(file, { bigint: true });
  if (
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.birthtimeNs !== after.birthtimeNs ||
    before.size !== after.size
  )
    throw new Error("docker_task_recovery_record_changed");
  return Object.freeze({ serialized, identity: identityOf(before) });
}

/**
 * stableDirectoryIdentityの処理を実行する。
 *
 * @responsibility stableDirectoryIdentityに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string
 * @returns stableDirectoryIdentityの計算結果を返す。
 * @precondition 「directory: string」がstableDirectoryIdentityの入力契約を満たす。
 * @postcondition stableDirectoryIdentityの責務を完了した結果だけを返す。
 * @effect stableDirectoryIdentityはFilesystemの読取りまたは書込みを実行する。
 * @failure stableDirectoryIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableDirectoryIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security stableDirectoryIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: stableDirectoryIdentityは共有非同期状態を持たない同期処理である。
 */
function stableDirectoryIdentity(directory: string) {
  const metadata = fs.lstatSync(directory, { bigint: true });
  if (!metadata.isDirectory() || metadata.isSymbolicLink())
    throw new Error("docker_recovery_directory_invalid");
  return identityText(identityOf(metadata));
}

/**
 * hashTextの処理を実行する。
 *
 * @responsibility hashTextに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input serialized: string
 * @returns hashTextの計算結果を返す。
 * @precondition 「serialized: string」がhashTextの入力契約を満たす。
 * @postcondition hashTextの責務を完了した結果だけを返す。
 * @effect N/A: hashTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hashTextは独自の失敗分岐を所有しない。
 * @invariant hashTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hashTextはProcess内の同一Subsystemで完結する。
 * @security hashTextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hashTextは共有非同期状態を持たない同期処理である。
 */
function hashText(serialized: string) {
  return createHash("sha256").update(serialized).digest("hex");
}

/**
 * observePathの処理を実行する。
 *
 * @responsibility observePathに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns observePathの計算結果を返す。
 * @precondition 「target: string」がobservePathの入力契約を満たす。
 * @postcondition observePathの責務を完了した結果だけを返す。
 * @effect observePathはFilesystemの読取りまたは書込みを実行する。
 * @failure observePathは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observePathは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observePathはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observePathは共有非同期状態を持たない同期処理である。
 */
function observePath(target: string) {
  try {
    return fs.lstatSync(target, { bigint: true });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return null;
    throw new Error("docker_recovery_path_observation_unknown");
  }
}

/**
 * pathPresentの処理を実行する。
 *
 * @responsibility pathPresentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns pathPresentの計算結果を返す。
 * @precondition 「target: string」がpathPresentの入力契約を満たす。
 * @postcondition pathPresentの責務を完了した結果だけを返す。
 * @effect N/A: pathPresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: pathPresentは独自の失敗分岐を所有しない。
 * @invariant pathPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: pathPresentはProcess内の同一Subsystemで完結する。
 * @security pathPresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pathPresentは共有非同期状態を持たない同期処理である。
 */
function pathPresent(target: string) {
  return observePath(target) !== null;
}

/**
 * regularFilePresentの処理を実行する。
 *
 * @responsibility regularFilePresentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns regularFilePresentの計算結果を返す。
 * @precondition 「target: string」がregularFilePresentの入力契約を満たす。
 * @postcondition regularFilePresentの責務を完了した結果だけを返す。
 * @effect N/A: regularFilePresentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure regularFilePresentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant regularFilePresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: regularFilePresentはProcess内の同一Subsystemで完結する。
 * @security regularFilePresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: regularFilePresentは共有非同期状態を持たない同期処理である。
 */
function regularFilePresent(target: string) {
  const metadata = observePath(target);
  if (metadata === null) return false;
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("docker_recovery_path_observation_unknown");
  return true;
}

/**
 * exactFileの処理を実行する。
 *
 * @responsibility exactFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input file: string、serialized: string、identity: string
 * @returns exactFileの計算結果を返す。
 * @precondition 「file: string、serialized: string、identity: string」がexactFileの入力契約を満たす。
 * @postcondition exactFileの責務を完了した結果だけを返す。
 * @effect N/A: exactFileは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure exactFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant exactFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: exactFileはProcess内の同一Subsystemで完結する。
 * @security exactFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: exactFileは共有非同期状態を持たない同期処理である。
 */
function exactFile(file: string, serialized: string, identity: string) {
  if (!regularFilePresent(file)) return false;
  const observed = readStableFile(file);
  if (
    observed.serialized !== serialized ||
    identityText(observed.identity) !== identity
  )
    throw new Error("docker_recovery_intent_third_state");
  return true;
}

/**
 * writeIntentAnchorの処理を実行する。
 *
 * @responsibility writeIntentAnchorに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input anchor: string、value: unknown
 * @returns writeIntentAnchorの計算結果を返す。
 * @precondition 「anchor: string、value: unknown」がwriteIntentAnchorの入力契約を満たす。
 * @postcondition writeIntentAnchorの責務を完了した結果だけを返す。
 * @effect writeIntentAnchorはFilesystemの読取りまたは書込みを実行する。
 * @failure writeIntentAnchorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeIntentAnchorは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeIntentAnchorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeIntentAnchorは共有非同期状態を持たない同期処理である。
 */
function writeIntentAnchor(anchor: string, value: unknown) {
  const serialized = canonical(value);
  const pending = `${anchor}${INTENT_PENDING_SUFFIX}`;
  if (pathPresent(anchor)) return;
  if (pathPresent(pending)) {
    const observed = readStableFile(pending);
    if (observed.serialized !== serialized)
      throw new Error("docker_recovery_intent_third_state");
  } else {
    const handle = fs.openSync(pending, "wx", 0o600);
    try {
      fs.writeFileSync(handle, serialized, "utf8");
      fs.fsyncSync(handle);
    } finally {
      fs.closeSync(handle);
    }
    if (readStableFile(pending).serialized !== serialized)
      throw new Error("docker_recovery_record_changed");
  }
  if (pathPresent(anchor))
    throw new Error("docker_recovery_intent_third_state");
  fs.renameSync(pending, anchor);
  if (readStableFile(anchor).serialized !== serialized)
    throw new Error("docker_recovery_record_changed");
}

/**
 * readIntentAnchorの処理を実行する。
 *
 * @responsibility readIntentAnchorに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input anchor: string
 * @returns readIntentAnchorの計算結果を返す。
 * @precondition 「anchor: string」がreadIntentAnchorの入力契約を満たす。
 * @postcondition readIntentAnchorの責務を完了した結果だけを返す。
 * @effect N/A: readIntentAnchorは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readIntentAnchorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readIntentAnchorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readIntentAnchorはProcess内の同一Subsystemで完結する。
 * @security readIntentAnchorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readIntentAnchorは共有非同期状態を持たない同期処理である。
 */
function readIntentAnchor(anchor: string) {
  const record = readStableFile(anchor);
  const value = JSON.parse(record.serialized);
  if (canonical(value) !== record.serialized)
    throw new Error("docker_recovery_intent_noncanonical");
  return value as Record<string, unknown>;
}

/**
 * committedPairEvidenceの処理を実行する。
 *
 * @responsibility committedPairEvidenceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input source: CommittedJson
 * @returns committedPairEvidenceの計算結果を返す。
 * @precondition 「source: CommittedJson」がcommittedPairEvidenceの入力契約を満たす。
 * @postcondition committedPairEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: committedPairEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: committedPairEvidenceは独自の失敗分岐を所有しない。
 * @invariant committedPairEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: committedPairEvidenceはProcess内の同一Subsystemで完結する。
 * @security committedPairEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: committedPairEvidenceは共有非同期状態を持たない同期処理である。
 */
function committedPairEvidence(source: CommittedJson) {
  const commit = readStableFile(source.commit);
  return Object.freeze({
    logicalKey: source.logicalKey,
    contentName: path.basename(source.target),
    contentSerialized: source.serialized,
    contentHash: source.hash,
    contentIdentity: source.identityText,
    contentBytes: Buffer.byteLength(source.serialized, "utf8"),
    commitName: path.basename(source.commit),
    commitSerialized: commit.serialized,
    commitHash: hashText(commit.serialized),
    commitIdentity: identityText(commit.identity),
    commitBytes: Buffer.byteLength(commit.serialized, "utf8"),
  });
}

/**
 * validPairEvidenceの処理を実行する。
 *
 * @responsibility validPairEvidenceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns validPairEvidenceの計算結果を返す。
 * @precondition 「value: unknown」がvalidPairEvidenceの入力契約を満たす。
 * @postcondition validPairEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: validPairEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validPairEvidenceは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validPairEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validPairEvidenceはProcess内の同一Subsystemで完結する。
 * @security validPairEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validPairEvidenceは共有非同期状態を持たない同期処理である。
 */
function validPairEvidence(value: unknown) {
  if (
    !exactKeys(value, [
      "logicalKey",
      "contentName",
      "contentSerialized",
      "contentHash",
      "contentIdentity",
      "contentBytes",
      "commitName",
      "commitSerialized",
      "commitHash",
      "commitIdentity",
      "commitBytes",
    ])
  )
    return false;
  const evidence = value as Record<string, unknown>;
  if (
    !(
      typeof evidence.logicalKey === "string" &&
      typeof evidence.contentName === "string" &&
      path.basename(evidence.contentName) === evidence.contentName &&
      typeof evidence.commitName === "string" &&
      evidence.commitName === `${evidence.contentName}${COMMIT_SUFFIX}` &&
      typeof evidence.contentSerialized === "string" &&
      typeof evidence.commitSerialized === "string" &&
      evidence.contentHash === hashText(evidence.contentSerialized) &&
      evidence.commitHash === hashText(evidence.commitSerialized) &&
      typeof evidence.contentIdentity === "string" &&
      typeof evidence.commitIdentity === "string" &&
      evidence.contentBytes ===
        Buffer.byteLength(evidence.contentSerialized, "utf8") &&
      evidence.commitBytes ===
        Buffer.byteLength(evidence.commitSerialized, "utf8")
    )
  )
    return false;
  try {
    const contentValue = JSON.parse(evidence.contentSerialized);
    const commitValue = JSON.parse(evidence.commitSerialized);
    return (
      canonical(contentValue) === evidence.contentSerialized &&
      canonical(commitValue) === evidence.commitSerialized &&
      exactKeys(commitValue, [
        "schema",
        "logicalKey",
        "contentHash",
        "contentIdentity",
        "contentBytes",
      ]) &&
      commitValue.schema === "crdd-coordinator-durable-json-commit/v1" &&
      commitValue.logicalKey === evidence.logicalKey &&
      commitValue.contentHash === evidence.contentHash &&
      commitValue.contentIdentity === evidence.contentIdentity &&
      commitValue.contentBytes === evidence.contentBytes
    );
  } catch {
    return false;
  }
}

/**
 * finalIntentNameの処理を実行する。
 *
 * @responsibility finalIntentNameに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input anchor: string
 * @returns finalIntentNameの計算結果を返す。
 * @precondition 「anchor: string」がfinalIntentNameの入力契約を満たす。
 * @postcondition finalIntentNameの責務を完了した結果だけを返す。
 * @effect N/A: finalIntentNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: finalIntentNameは独自の失敗分岐を所有しない。
 * @invariant finalIntentNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: finalIntentNameはProcess内の同一Subsystemで完結する。
 * @security finalIntentNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: finalIntentNameは共有非同期状態を持たない同期処理である。
 */
function finalIntentName(anchor: string) {
  const name = path.basename(anchor);
  return name.endsWith(INTENT_PENDING_SUFFIX)
    ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
    : name;
}

/**
 * validateIntentAnchorNameの処理を実行する。
 *
 * @responsibility validateIntentAnchorNameに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input anchor: string、value: Record<string, unknown>
 * @returns validateIntentAnchorNameの計算結果を返す。
 * @precondition 「anchor: string、value: Record<string, unknown>」がvalidateIntentAnchorNameの入力契約を満たす。
 * @postcondition validateIntentAnchorNameの責務を完了した結果だけを返す。
 * @effect N/A: validateIntentAnchorNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure validateIntentAnchorNameは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateIntentAnchorNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validateIntentAnchorNameはProcess内の同一Subsystemで完結する。
 * @security validateIntentAnchorNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateIntentAnchorNameは共有非同期状態を持たない同期処理である。
 */
function validateIntentAnchorName(
  anchor: string,
  value: Record<string, unknown>,
) {
  const directory = path.dirname(anchor);
  let digest: string;
  if (value.schema === "crdd-coordinator-durable-json-delete/v1") {
    const pair = value.pair as Record<string, unknown>;
    digest = hashText(
      `${String(pair.contentName)}\0${String(pair.contentHash)}\0${String(pair.contentIdentity)}`,
    );
    if (finalIntentName(anchor) !== `${DELETE_PREFIX}${digest}.json`)
      throw new Error("docker_recovery_delete_intent_invalid");
    return;
  }
  if (value.schema === "crdd-coordinator-durable-json-move/v1") {
    const pair = value.pair as Record<string, unknown>;
    const source = path.join(directory, String(pair.contentName));
    const target = path.join(
      String(value.targetDirectory),
      String(value.targetContentName),
    );
    digest = hashText(
      `${source}\0${target}\0${String(pair.contentHash)}\0${String(pair.contentIdentity)}`,
    );
    if (finalIntentName(anchor) !== `${MOVE_PREFIX}${digest}.json`)
      throw new Error("docker_recovery_move_intent_invalid");
    return;
  }
  digest = hashText(
    `${String(value.cleanupName)}\0${String(value.cleanupIdentity)}\0${String(value.recoveryId)}`,
  );
  if (finalIntentName(anchor) !== `${CLEANUP_PREFIX}${digest}.json`)
    throw new Error("docker_recovery_cleanup_intent_invalid");
}

/**
 * recoveryIdFromIntentの処理を実行する。
 *
 * @responsibility recoveryIdFromIntentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: Record<string, unknown>
 * @returns recoveryIdFromIntentの計算結果を返す。
 * @precondition 「value: Record<string, unknown>」がrecoveryIdFromIntentの入力契約を満たす。
 * @postcondition recoveryIdFromIntentの責務を完了した結果だけを返す。
 * @effect N/A: recoveryIdFromIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure recoveryIdFromIntentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant recoveryIdFromIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: recoveryIdFromIntentはProcess内の同一Subsystemで完結する。
 * @security recoveryIdFromIntentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: recoveryIdFromIntentは共有非同期状態を持たない同期処理である。
 */
function recoveryIdFromIntent(value: Record<string, unknown>) {
  if (
    value.schema === "crdd-coordinator-recovery-cleanup-delete/v1" &&
    typeof value.recoveryId === "string"
  )
    return value.recoveryId;
  if (
    value.schema !== "crdd-coordinator-durable-json-delete/v1" &&
    value.schema !== "crdd-coordinator-durable-json-move/v1"
  )
    return null;
  const pair = value.pair as Record<string, unknown>;
  try {
    const content = JSON.parse(String(pair.contentSerialized)) as Record<
      string,
      unknown
    >;
    if (
      typeof content.recoveryId === "string" &&
      /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
        content.recoveryId,
      )
    )
      return content.recoveryId;
    if (
      content.schema === "crdd-coordinator-task-docker-recovery/v1" &&
      typeof content.operationNonce === "string" &&
      typeof content.stableLogicalHomeBindingHash === "string"
    ) {
      const token = `docker-task.${content.stableLogicalHomeBindingHash}.${content.operationNonce}.${String(pair.contentHash)}`;
      if (
        /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(token)
      )
        return token;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * validRuntimeStateBindingEvidenceの処理を実行する。
 *
 * @responsibility validRuntimeStateBindingEvidenceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns validRuntimeStateBindingEvidenceの計算結果を返す。
 * @precondition 「value: unknown」がvalidRuntimeStateBindingEvidenceの入力契約を満たす。
 * @postcondition validRuntimeStateBindingEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: validRuntimeStateBindingEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRuntimeStateBindingEvidenceは独自の失敗分岐を所有しない。
 * @invariant validRuntimeStateBindingEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRuntimeStateBindingEvidenceはProcess内の同一Subsystemで完結する。
 * @security validRuntimeStateBindingEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validRuntimeStateBindingEvidenceは共有非同期状態を持たない同期処理である。
 */
function validRuntimeStateBindingEvidence(value: unknown) {
  return (
    exactKeys(value, [
      "runtimeStateIdentityHash",
      "runtimeStateProtectionHash",
      "localUserBindingHash",
      "runtimeStateBindingHash",
    ]) &&
    Object.values(value as Record<string, unknown>).every(
      (item) => typeof item === "string" && /^[a-f0-9]{64}$/u.test(item),
    )
  );
}

/**
 * sameRuntimeStateBindingEvidenceの処理を実行する。
 *
 * @responsibility sameRuntimeStateBindingEvidenceに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input left: unknown、right: unknown
 * @returns sameRuntimeStateBindingEvidenceの計算結果を返す。
 * @precondition 「left: unknown、right: unknown」がsameRuntimeStateBindingEvidenceの入力契約を満たす。
 * @postcondition sameRuntimeStateBindingEvidenceの責務を完了した結果だけを返す。
 * @effect N/A: sameRuntimeStateBindingEvidenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: sameRuntimeStateBindingEvidenceは独自の失敗分岐を所有しない。
 * @invariant sameRuntimeStateBindingEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: sameRuntimeStateBindingEvidenceはProcess内の同一Subsystemで完結する。
 * @security sameRuntimeStateBindingEvidenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: sameRuntimeStateBindingEvidenceは共有非同期状態を持たない同期処理である。
 */
function sameRuntimeStateBindingEvidence(left: unknown, right: unknown) {
  if (
    !validRuntimeStateBindingEvidence(left) ||
    !validRuntimeStateBindingEvidence(right)
  )
    return false;
  const leftBinding = left as Record<string, unknown>;
  const rightBinding = right as Record<string, unknown>;
  return (
    leftBinding.runtimeStateIdentityHash ===
      rightBinding.runtimeStateIdentityHash &&
    leftBinding.runtimeStateProtectionHash ===
      rightBinding.runtimeStateProtectionHash &&
    leftBinding.localUserBindingHash === rightBinding.localUserBindingHash &&
    leftBinding.runtimeStateBindingHash === rightBinding.runtimeStateBindingHash
  );
}

/**
 * runtimeStateBindingFromIntentの処理を実行する。
 *
 * @responsibility runtimeStateBindingFromIntentに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: Record<string, unknown>
 * @returns runtimeStateBindingFromIntentの計算結果を返す。
 * @precondition 「value: Record<string, unknown>」がruntimeStateBindingFromIntentの入力契約を満たす。
 * @postcondition runtimeStateBindingFromIntentの責務を完了した結果だけを返す。
 * @effect N/A: runtimeStateBindingFromIntentは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runtimeStateBindingFromIntentは独自の失敗分岐を所有しない。
 * @invariant runtimeStateBindingFromIntentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runtimeStateBindingFromIntentはProcess内の同一Subsystemで完結する。
 * @security runtimeStateBindingFromIntentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: runtimeStateBindingFromIntentは共有非同期状態を持たない同期処理である。
 */
function runtimeStateBindingFromIntent(value: Record<string, unknown>) {
  if (
    value.schema === "crdd-coordinator-recovery-cleanup-delete/v1" &&
    validRuntimeStateBindingEvidence(value.runtimeStateBinding)
  )
    return value.runtimeStateBinding as Readonly<Record<string, unknown>>;
  if (
    (value.schema === "crdd-coordinator-durable-json-delete/v1" ||
      value.schema === "crdd-coordinator-durable-json-move/v1") &&
    validPairEvidence(value.pair)
  ) {
    const pair = value.pair as Record<string, unknown>;
    const content = JSON.parse(String(pair.contentSerialized)) as Record<
      string,
      unknown
    >;
    if (validRuntimeStateBindingEvidence(content.runtimeStateBinding))
      return content.runtimeStateBinding as Readonly<Record<string, unknown>>;
  }
  return null;
}

/**
 * resolveRuntimeStateBindingForRecoveryの処理を実行する。
 *
 * @responsibility resolveRuntimeStateBindingForRecoveryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、recoveryId: string、intents: readonly Record<string, unknown>[]
 * @returns resolveRuntimeStateBindingForRecoveryの計算結果を返す。
 * @precondition 「directory: string、recoveryId: string、intents: readonly Record<string, unknown>[]」がresolveRuntimeStateBindingForRecoveryの入力契約を満たす。
 * @postcondition resolveRuntimeStateBindingForRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: resolveRuntimeStateBindingForRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure resolveRuntimeStateBindingForRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resolveRuntimeStateBindingForRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: resolveRuntimeStateBindingForRecoveryはProcess内の同一Subsystemで完結する。
 * @security resolveRuntimeStateBindingForRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resolveRuntimeStateBindingForRecoveryは共有非同期状態を持たない同期処理である。
 */
function resolveRuntimeStateBindingForRecovery(
  directory: string,
  recoveryId: string,
  intents: readonly Record<string, unknown>[],
) {
  const candidates: Readonly<Record<string, unknown>>[] = [];
  for (const intent of intents) {
    if (recoveryIdFromIntent(intent) !== recoveryId) continue;
    const binding = runtimeStateBindingFromIntent(intent);
    if (binding) candidates.push(binding);
  }
  const match =
    /^docker-task\.([a-f0-9]{64})\.([a-f0-9]{64})\.([a-f0-9]{64})$/u.exec(
      recoveryId,
    );
  if (!match?.[2] || !match[3])
    throw new Error("docker_recovery_target_invalid");
  for (const file of [
    path.join(directory, `docker-task-${match[2]}`, "base.json"),
    path.join(directory, `pending-docker-task-${match[2]}.json`),
  ]) {
    if (!pathPresent(file)) continue;
    try {
      const base = readCommittedDockerRecoveryJson(file, "base.json");
      const value = base.value as Record<string, unknown>;
      if (
        base.hash === match[3] &&
        value.operationNonce === match[2] &&
        value.stableLogicalHomeBindingHash === match[1] &&
        validRuntimeStateBindingEvidence(value.runtimeStateBinding)
      )
        candidates.push(
          value.runtimeStateBinding as Readonly<Record<string, unknown>>,
        );
    } catch {
      // A split committed pair is represented by its validated move/delete
      // intent and must not be guessed from a partial filesystem state.
    }
  }
  const baseCommitIntentPresent = intents.some((intent) => {
    if (recoveryIdFromIntent(intent) !== recoveryId) return false;
    const pair = intent.pair as Record<string, unknown>;
    return validPairEvidence(pair) && pair.logicalKey === "base-commit.json";
  });
  const splitBase = path.join(
    directory,
    `docker-task-${match[2]}`,
    "base.json",
  );
  if (baseCommitIntentPresent && pathPresent(splitBase)) {
    const stable = readStableFile(splitBase);
    const value = JSON.parse(stable.serialized) as Record<string, unknown>;
    if (
      canonical(value) !== stable.serialized ||
      hashText(stable.serialized) !== match[3] ||
      value.operationNonce !== match[2] ||
      value.stableLogicalHomeBindingHash !== match[1] ||
      !validRuntimeStateBindingEvidence(value.runtimeStateBinding)
    )
      throw new Error("docker_recovery_target_binding_mismatch");
    candidates.push(
      value.runtimeStateBinding as Readonly<Record<string, unknown>>,
    );
  }
  if (candidates.length === 0)
    throw new Error("docker_recovery_target_binding_missing");
  const first = candidates[0];
  if (
    !first ||
    candidates.some(
      (candidate) => !sameRuntimeStateBindingEvidence(candidate, first),
    )
  )
    throw new Error("docker_recovery_target_binding_mismatch");
  return first;
}

/**
 * resumeDeleteAnchorの処理を実行する。
 *
 * @responsibility resumeDeleteAnchorに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input anchor: string
 * @returns resumeDeleteAnchorの計算結果を返す。
 * @precondition 「anchor: string」がresumeDeleteAnchorの入力契約を満たす。
 * @postcondition resumeDeleteAnchorの責務を完了した結果だけを返す。
 * @effect resumeDeleteAnchorはFilesystemの読取りまたは書込みを実行する。
 * @failure resumeDeleteAnchorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resumeDeleteAnchorは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resumeDeleteAnchorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resumeDeleteAnchorは共有非同期状態を持たない同期処理である。
 */
function resumeDeleteAnchor(anchor: string) {
  const intent = readIntentAnchor(anchor);
  if (
    !exactKeys(intent, ["schema", "parentIdentity", "pair"]) ||
    intent.schema !== "crdd-coordinator-durable-json-delete/v1" ||
    stableDirectoryIdentity(path.dirname(anchor)) !== intent.parentIdentity ||
    !validPairEvidence(intent.pair)
  )
    throw new Error("docker_recovery_delete_intent_invalid");
  const pair = intent.pair as Record<string, unknown>;
  const target = path.join(path.dirname(anchor), String(pair.contentName));
  const commit = path.join(path.dirname(anchor), String(pair.commitName));
  const targetPresent = exactFile(
    target,
    String(pair.contentSerialized),
    String(pair.contentIdentity),
  );
  const commitPresent = exactFile(
    commit,
    String(pair.commitSerialized),
    String(pair.commitIdentity),
  );
  const state = classifyCommittedPairDeleteState(targetPresent, commitPresent);
  if (state === "third_state")
    throw new Error("docker_recovery_delete_intent_third_state");
  if (state === "remove_content") fs.rmSync(target);
  if (state !== "complete") {
    if (regularFilePresent(target))
      throw new Error("docker_recovery_delete_incomplete");
    if (regularFilePresent(commit)) fs.rmSync(commit);
  }
  if (regularFilePresent(target) || regularFilePresent(commit))
    throw new Error("docker_recovery_delete_incomplete");
  fs.rmSync(anchor);
  if (regularFilePresent(anchor))
    throw new Error("docker_recovery_delete_incomplete");
  return true;
}

/**
 * inspectMoveAnchorStateの処理を実行する。
 *
 * @responsibility inspectMoveAnchorStateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input anchor: string
 * @returns inspectMoveAnchorStateの計算結果を返す。
 * @precondition 「anchor: string」がinspectMoveAnchorStateの入力契約を満たす。
 * @postcondition inspectMoveAnchorStateの責務を完了した結果だけを返す。
 * @effect N/A: inspectMoveAnchorStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectMoveAnchorStateは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectMoveAnchorStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectMoveAnchorStateはProcess内の同一Subsystemで完結する。
 * @security inspectMoveAnchorStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectMoveAnchorStateは共有非同期状態を持たない同期処理である。
 */
function inspectMoveAnchorState(anchor: string) {
  const intent = validateIntentSnapshot(anchor);
  if (intent.schema !== "crdd-coordinator-durable-json-move/v1")
    throw new Error("docker_recovery_move_intent_invalid");
  const pair = intent.pair as Record<string, unknown>;
  const sourceDirectory = path.dirname(anchor);
  const targetDirectory = String(intent.targetDirectory);
  const sourceTarget = path.join(sourceDirectory, String(pair.contentName));
  const sourceCommit = path.join(sourceDirectory, String(pair.commitName));
  const target = path.join(targetDirectory, String(intent.targetContentName));
  const targetCommit = path.join(
    targetDirectory,
    String(intent.targetCommitName),
  );
  const sourceTargetPresent = exactFile(
    sourceTarget,
    String(pair.contentSerialized),
    String(pair.contentIdentity),
  );
  const sourceCommitPresent = exactFile(
    sourceCommit,
    String(pair.commitSerialized),
    String(pair.commitIdentity),
  );
  const targetPresent = exactFile(
    target,
    String(pair.contentSerialized),
    String(pair.contentIdentity),
  );
  const targetCommitPresent = exactFile(
    targetCommit,
    String(pair.commitSerialized),
    String(pair.commitIdentity),
  );
  const state = classifyCommittedPairMoveState(
    sourceTargetPresent,
    sourceCommitPresent,
    targetPresent,
    targetCommitPresent,
  );
  if (state === "third_state")
    throw new Error("docker_recovery_move_intent_third_state");
  return Object.freeze({
    intent,
    pair,
    state,
    sourceDirectory,
    targetDirectory,
    sourceTarget,
    sourceCommit,
    target,
    targetCommit,
    record: Object.freeze({
      serialized: String(pair.contentSerialized),
      hash: String(pair.contentHash),
      identityText: String(pair.contentIdentity),
      logicalKey: String(pair.logicalKey),
      value: JSON.parse(String(pair.contentSerialized)),
    }),
  });
}

/**
 * resumeMoveAnchorの処理を実行する。
 *
 * @responsibility resumeMoveAnchorに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input anchor: string
 * @returns resumeMoveAnchorの計算結果を返す。
 * @precondition 「anchor: string」がresumeMoveAnchorの入力契約を満たす。
 * @postcondition resumeMoveAnchorの責務を完了した結果だけを返す。
 * @effect resumeMoveAnchorはFilesystemの読取りまたは書込みを実行する。
 * @failure resumeMoveAnchorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resumeMoveAnchorは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resumeMoveAnchorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resumeMoveAnchorは共有非同期状態を持たない同期処理である。
 */
function resumeMoveAnchor(anchor: string) {
  const inspected = inspectMoveAnchorState(anchor);
  const { pair, sourceTarget, sourceCommit, target, targetCommit, state } =
    inspected;
  if (state === "move_content") fs.renameSync(sourceTarget, target);
  if (state !== "complete") {
    if (!pathPresent(target) || pathPresent(sourceTarget))
      throw new Error("docker_recovery_move_incomplete");
    if (pathPresent(sourceCommit)) fs.renameSync(sourceCommit, targetCommit);
  }
  if (
    !exactFile(
      target,
      String(pair.contentSerialized),
      String(pair.contentIdentity),
    ) ||
    !exactFile(
      targetCommit,
      String(pair.commitSerialized),
      String(pair.commitIdentity),
    )
  )
    throw new Error("docker_recovery_move_incomplete");
  fs.rmSync(anchor);
  if (pathPresent(anchor)) throw new Error("docker_recovery_move_incomplete");
  return readCommittedDockerRecoveryJson(target, String(pair.logicalKey));
}

/**
 * validCleanupEntryの処理を実行する。
 *
 * @responsibility validCleanupEntryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns validCleanupEntryの計算結果を返す。
 * @precondition 「value: unknown」がvalidCleanupEntryの入力契約を満たす。
 * @postcondition validCleanupEntryの責務を完了した結果だけを返す。
 * @effect N/A: validCleanupEntryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validCleanupEntryは独自の失敗分岐を所有しない。
 * @invariant validCleanupEntryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validCleanupEntryはProcess内の同一Subsystemで完結する。
 * @security validCleanupEntryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validCleanupEntryは共有非同期状態を持たない同期処理である。
 */
function validCleanupEntry(value: unknown) {
  if (!exactKeys(value, ["name", "type", "hash", "identity", "bytes"]))
    return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.name === "string" &&
    path.basename(entry.name) === entry.name &&
    (entry.type === "file" || entry.type === "empty_directory") &&
    typeof entry.hash === "string" &&
    /^[a-f0-9]{64}$/u.test(entry.hash) &&
    typeof entry.identity === "string" &&
    Number.isSafeInteger(entry.bytes) &&
    Number(entry.bytes) >= 0
  );
}

/**
 * validateIntentSnapshotの処理を実行する。
 *
 * @responsibility validateIntentSnapshotに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input anchor: string
 * @returns validateIntentSnapshotの計算結果を返す。
 * @precondition 「anchor: string」がvalidateIntentSnapshotの入力契約を満たす。
 * @postcondition validateIntentSnapshotの責務を完了した結果だけを返す。
 * @effect validateIntentSnapshotはFilesystemの読取りまたは書込みを実行する。
 * @failure validateIntentSnapshotは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant validateIntentSnapshotは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security validateIntentSnapshotはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validateIntentSnapshotは共有非同期状態を持たない同期処理である。
 */
function validateIntentSnapshot(anchor: string) {
  const value = readIntentAnchor(anchor);
  if (value.schema === "crdd-coordinator-durable-json-delete/v1") {
    if (
      !exactKeys(value, ["schema", "parentIdentity", "pair"]) ||
      stableDirectoryIdentity(path.dirname(anchor)) !== value.parentIdentity ||
      !validPairEvidence(value.pair)
    )
      throw new Error("docker_recovery_delete_intent_invalid");
    validateIntentAnchorName(anchor, value);
    return value;
  }
  if (value.schema === "crdd-coordinator-durable-json-move/v1") {
    if (
      !exactKeys(value, [
        "schema",
        "sourceParentIdentity",
        "targetParentIdentity",
        "targetDirectory",
        "pair",
        "targetContentName",
        "targetCommitName",
      ]) ||
      stableDirectoryIdentity(path.dirname(anchor)) !==
        value.sourceParentIdentity ||
      typeof value.targetDirectory !== "string" ||
      !path.isAbsolute(value.targetDirectory) ||
      stableDirectoryIdentity(value.targetDirectory) !==
        value.targetParentIdentity ||
      !validPairEvidence(value.pair) ||
      typeof value.targetContentName !== "string" ||
      path.basename(value.targetContentName) !== value.targetContentName ||
      value.targetCommitName !== `${value.targetContentName}${COMMIT_SUFFIX}`
    )
      throw new Error("docker_recovery_move_intent_invalid");
    validateIntentAnchorName(anchor, value);
    return value;
  }
  if (
    value.schema !== "crdd-coordinator-recovery-cleanup-delete/v1" ||
    !exactKeys(value, [
      "schema",
      "rootIdentity",
      "cleanupName",
      "cleanupIdentity",
      "recoveryId",
      "runtimeStateBinding",
      "entries",
    ]) ||
    stableDirectoryIdentity(path.dirname(anchor)) !== value.rootIdentity ||
    typeof value.cleanupName !== "string" ||
    path.basename(value.cleanupName) !== value.cleanupName ||
    typeof value.cleanupIdentity !== "string" ||
    typeof value.recoveryId !== "string" ||
    !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
      value.recoveryId,
    ) ||
    !validRuntimeStateBindingEvidence(value.runtimeStateBinding) ||
    !Array.isArray(value.entries) ||
    value.entries.length > 100 ||
    !value.entries.every(validCleanupEntry)
  )
    throw new Error("docker_recovery_cleanup_intent_invalid");
  validateIntentAnchorName(anchor, value);
  const cleanupDirectory = path.join(path.dirname(anchor), value.cleanupName);
  if (pathPresent(cleanupDirectory)) {
    if (stableDirectoryIdentity(cleanupDirectory) !== value.cleanupIdentity)
      throw new Error("docker_recovery_cleanup_intent_third_state");
    const expected = new Map(
      (value.entries as Array<Record<string, unknown>>).map((entry) => [
        String(entry.name),
        entry,
      ]),
    );
    for (const name of fs.readdirSync(cleanupDirectory)) {
      const entry = expected.get(name);
      if (!entry) throw new Error("docker_recovery_cleanup_intent_third_state");
      const target = path.join(cleanupDirectory, name);
      const metadata = fs.lstatSync(target, { bigint: true });
      if (identityText(identityOf(metadata)) !== entry.identity)
        throw new Error("docker_recovery_cleanup_intent_third_state");
      if (entry.type === "file") {
        const observed = readStableFile(target);
        if (
          hashText(observed.serialized) !== entry.hash ||
          Buffer.byteLength(observed.serialized, "utf8") !== entry.bytes
        )
          throw new Error("docker_recovery_cleanup_intent_third_state");
      } else if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.readdirSync(target).length !== 0
      )
        throw new Error("docker_recovery_cleanup_intent_third_state");
    }
  }
  return value;
}

/**
 * resumeCleanupAnchorの処理を実行する。
 *
 * @responsibility resumeCleanupAnchorに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input anchor: string
 * @returns resumeCleanupAnchorの計算結果を返す。
 * @precondition 「anchor: string」がresumeCleanupAnchorの入力契約を満たす。
 * @postcondition resumeCleanupAnchorの責務を完了した結果だけを返す。
 * @effect resumeCleanupAnchorはFilesystemの読取りまたは書込みを実行する。
 * @failure resumeCleanupAnchorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resumeCleanupAnchorは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resumeCleanupAnchorはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resumeCleanupAnchorは共有非同期状態を持たない同期処理である。
 */
function resumeCleanupAnchor(anchor: string) {
  const intent = readIntentAnchor(anchor);
  if (
    !exactKeys(intent, [
      "schema",
      "rootIdentity",
      "cleanupName",
      "cleanupIdentity",
      "recoveryId",
      "runtimeStateBinding",
      "entries",
    ]) ||
    intent.schema !== "crdd-coordinator-recovery-cleanup-delete/v1" ||
    stableDirectoryIdentity(path.dirname(anchor)) !== intent.rootIdentity ||
    typeof intent.cleanupName !== "string" ||
    path.basename(intent.cleanupName) !== intent.cleanupName ||
    typeof intent.cleanupIdentity !== "string" ||
    typeof intent.recoveryId !== "string" ||
    !validRuntimeStateBindingEvidence(intent.runtimeStateBinding) ||
    !Array.isArray(intent.entries) ||
    intent.entries.length > 100 ||
    !intent.entries.every(validCleanupEntry)
  )
    throw new Error("docker_recovery_cleanup_intent_invalid");
  const cleanupDirectory = path.join(
    path.dirname(anchor),
    String(intent.cleanupName),
  );
  if (!pathPresent(cleanupDirectory)) {
    if (classifyCleanupDirectoryState(false, false, false, 0) !== "complete")
      throw new Error("docker_recovery_cleanup_intent_third_state");
    fs.rmSync(anchor);
    if (pathPresent(anchor))
      throw new Error("docker_recovery_cleanup_incomplete");
    return true;
  }
  if (stableDirectoryIdentity(cleanupDirectory) !== intent.cleanupIdentity)
    throw new Error("docker_recovery_cleanup_intent_third_state");
  const expected = new Map(
    (intent.entries as Array<Record<string, unknown>>).map((entry) => [
      String(entry.name),
      entry,
    ]),
  );
  for (const observedName of fs.readdirSync(cleanupDirectory)) {
    if (!expected.has(observedName))
      throw new Error("docker_recovery_cleanup_intent_third_state");
  }
  if (
    classifyCleanupDirectoryState(
      true,
      false,
      false,
      fs.readdirSync(cleanupDirectory).length,
    ) === "third_state"
  )
    throw new Error("docker_recovery_cleanup_intent_third_state");
  for (const entry of expected.values()) {
    const target = path.join(cleanupDirectory, String(entry.name));
    if (!pathPresent(target)) continue;
    const metadata = fs.lstatSync(target, { bigint: true });
    if (identityText(identityOf(metadata)) !== entry.identity)
      throw new Error("docker_recovery_cleanup_intent_third_state");
    if (entry.type === "empty_directory") {
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.readdirSync(target).length !== 0 ||
        entry.bytes !== 0
      )
        throw new Error("docker_recovery_cleanup_intent_third_state");
      fs.rmdirSync(target);
      if (pathPresent(target))
        throw new Error("docker_recovery_cleanup_incomplete");
      continue;
    }
    if (!metadata.isFile() || metadata.isSymbolicLink())
      throw new Error("docker_recovery_cleanup_intent_third_state");
    const observed = readStableFile(target);
    if (
      hashText(observed.serialized) !== entry.hash ||
      Buffer.byteLength(observed.serialized, "utf8") !== entry.bytes
    )
      throw new Error("docker_recovery_cleanup_intent_third_state");
    fs.rmSync(target);
    if (pathPresent(target))
      throw new Error("docker_recovery_cleanup_incomplete");
  }
  if (fs.readdirSync(cleanupDirectory).length !== 0)
    throw new Error("docker_recovery_cleanup_incomplete");
  fs.rmdirSync(cleanupDirectory);
  if (pathPresent(cleanupDirectory))
    throw new Error("docker_recovery_cleanup_incomplete");
  fs.rmSync(anchor);
  if (pathPresent(anchor))
    throw new Error("docker_recovery_cleanup_incomplete");
  return true;
}

/**
 * writeAtomicFileの処理を実行する。
 *
 * @responsibility writeAtomicFileに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、target: string、serialized: string
 * @returns writeAtomicFileの計算結果を返す。
 * @precondition 「directory: string、target: string、serialized: string」がwriteAtomicFileの入力契約を満たす。
 * @postcondition writeAtomicFileの責務を完了した結果だけを返す。
 * @effect writeAtomicFileはFilesystemの読取りまたは書込みを実行する。
 * @failure writeAtomicFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeAtomicFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security writeAtomicFileはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeAtomicFileは共有非同期状態を持たない同期処理である。
 */
function writeAtomicFile(
  directory: string,
  target: string,
  serialized: string,
) {
  if (pathPresent(target))
    throw new Error("docker_recovery_record_already_exists");
  const temporary = path.join(
    directory,
    `${TEMP_PREFIX}${path.basename(target)}-${randomBytes(16).toString("hex")}.tmp`,
  );
  const handle = fs.openSync(temporary, "wx", 0o600);
  try {
    fs.writeFileSync(handle, serialized, "utf8");
    fs.fsyncSync(handle);
  } finally {
    fs.closeSync(handle);
  }
  const temporaryRecord = readStableFile(temporary);
  if (temporaryRecord.serialized !== serialized)
    throw new Error("docker_recovery_record_changed");
  if (pathPresent(target))
    throw new Error("docker_recovery_record_already_exists");
  fs.renameSync(temporary, target);
  const finalRecord = readStableFile(target);
  const isSameRenamedFileObject =
    finalRecord.identity.dev === temporaryRecord.identity.dev &&
    finalRecord.identity.ino === temporaryRecord.identity.ino &&
    (process.platform === "win32" ||
      finalRecord.identity.birthtimeNs ===
        temporaryRecord.identity.birthtimeNs);
  if (finalRecord.serialized !== serialized || !isSameRenamedFileObject)
    throw new Error("docker_recovery_record_changed");
  return finalRecord;
}

/**
 * dockerRecoveryCommitNameの処理を実行する。
 *
 * @responsibility dockerRecoveryCommitNameに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input name: string
 * @returns dockerRecoveryCommitNameの計算結果を返す。
 * @precondition 「name: string」がdockerRecoveryCommitNameの入力契約を満たす。
 * @postcondition dockerRecoveryCommitNameの責務を完了した結果だけを返す。
 * @effect N/A: dockerRecoveryCommitNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: dockerRecoveryCommitNameは独自の失敗分岐を所有しない。
 * @invariant dockerRecoveryCommitNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dockerRecoveryCommitNameはProcess内の同一Subsystemで完結する。
 * @security dockerRecoveryCommitNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: dockerRecoveryCommitNameは共有非同期状態を持たない同期処理である。
 */
export function dockerRecoveryCommitName(name: string) {
  return `${name}${COMMIT_SUFFIX}`;
}

/**
 * isDockerRecoveryJournalTemporaryNameの処理を実行する。
 *
 * @responsibility isDockerRecoveryJournalTemporaryNameに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input name: string
 * @returns isDockerRecoveryJournalTemporaryNameの計算結果を返す。
 * @precondition 「name: string」がisDockerRecoveryJournalTemporaryNameの入力契約を満たす。
 * @postcondition isDockerRecoveryJournalTemporaryNameの責務を完了した結果だけを返す。
 * @effect N/A: isDockerRecoveryJournalTemporaryNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDockerRecoveryJournalTemporaryNameは独自の失敗分岐を所有しない。
 * @invariant isDockerRecoveryJournalTemporaryNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDockerRecoveryJournalTemporaryNameはProcess内の同一Subsystemで完結する。
 * @security isDockerRecoveryJournalTemporaryNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isDockerRecoveryJournalTemporaryNameは共有非同期状態を持たない同期処理である。
 */
export function isDockerRecoveryJournalTemporaryName(name: string) {
  return (
    name.startsWith(TEMP_PREFIX) && /^[.a-z0-9_-]{1,220}\.tmp$/u.test(name)
  );
}

/**
 * writeCommittedDockerRecoveryJsonの処理を実行する。
 *
 * @responsibility writeCommittedDockerRecoveryJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、name: string、logicalKey: string、value: unknown
 * @returns CommittedJsonを返す。
 * @precondition 「directory: string、name: string、logicalKey: string、value: unknown」がwriteCommittedDockerRecoveryJsonの入力契約を満たす。
 * @postcondition writeCommittedDockerRecoveryJsonの責務を完了した結果だけを返す。
 * @effect N/A: writeCommittedDockerRecoveryJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure writeCommittedDockerRecoveryJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeCommittedDockerRecoveryJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeCommittedDockerRecoveryJsonはProcess内の同一Subsystemで完結する。
 * @security writeCommittedDockerRecoveryJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeCommittedDockerRecoveryJsonは共有非同期状態を持たない同期処理である。
 */
export function writeCommittedDockerRecoveryJson(
  directory: string,
  name: string,
  logicalKey: string,
  value: unknown,
): CommittedJson {
  const target = path.join(directory, name);
  const commit = path.join(directory, dockerRecoveryCommitName(name));
  if (pathPresent(target) || pathPresent(commit))
    throw new Error("docker_recovery_record_already_exists");
  const serialized = canonical(value);
  const content = writeAtomicFile(directory, target, serialized);
  const hash = createHash("sha256").update(serialized).digest("hex");
  const commitValue = Object.freeze({
    schema: "crdd-coordinator-durable-json-commit/v1",
    logicalKey,
    contentHash: hash,
    contentIdentity: identityText(content.identity),
    contentBytes: Buffer.byteLength(serialized, "utf8"),
  });
  const commitSerialized = canonical(commitValue);
  writeAtomicFile(directory, commit, commitSerialized);
  return Object.freeze({
    target,
    commit,
    serialized,
    hash,
    identity: content.identity,
    identityText: identityText(content.identity),
    logicalKey,
    value,
  });
}

/**
 * Complete or reuse one exact committed pair.  This is the create-side
 *
 * @responsibility writeOrResumeCommittedDockerRecoveryJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、name: string、logicalKey: string、value: unknown
 * @returns CommittedJsonを返す。
 * @precondition 「directory: string、name: string、logicalKey: string、value: unknown」がwriteOrResumeCommittedDockerRecoveryJsonの入力契約を満たす。
 * @postcondition writeOrResumeCommittedDockerRecoveryJsonの責務を完了した結果だけを返す。
 * @effect N/A: writeOrResumeCommittedDockerRecoveryJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure writeOrResumeCommittedDockerRecoveryJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant writeOrResumeCommittedDockerRecoveryJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: writeOrResumeCommittedDockerRecoveryJsonはProcess内の同一Subsystemで完結する。
 * @security writeOrResumeCommittedDockerRecoveryJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: writeOrResumeCommittedDockerRecoveryJsonは共有非同期状態を持たない同期処理である。
 */
export function writeOrResumeCommittedDockerRecoveryJson(
  directory: string,
  name: string,
  logicalKey: string,
  value: unknown,
): CommittedJson {
  const target = path.join(directory, name);
  const commit = path.join(directory, dockerRecoveryCommitName(name));
  const targetPresent = pathPresent(target);
  const commitPresent = pathPresent(commit);
  if (!targetPresent && !commitPresent)
    return writeCommittedDockerRecoveryJson(directory, name, logicalKey, value);
  if (!targetPresent)
    throw new Error("docker_recovery_record_create_third_state");
  const serialized = canonical(value);
  const content = readStableFile(target);
  if (content.serialized !== serialized)
    throw new Error("docker_recovery_record_create_mismatch");
  const hash = createHash("sha256").update(serialized).digest("hex");
  if (!commitPresent) {
    writeAtomicFile(
      directory,
      commit,
      canonical(
        Object.freeze({
          schema: "crdd-coordinator-durable-json-commit/v1",
          logicalKey,
          contentHash: hash,
          contentIdentity: identityText(content.identity),
          contentBytes: Buffer.byteLength(serialized, "utf8"),
        }),
      ),
    );
  }
  const observed = readCommittedDockerRecoveryJson(target, logicalKey);
  if (observed.serialized !== serialized)
    throw new Error("docker_recovery_record_create_mismatch");
  return observed;
}

/**
 * readCommittedDockerRecoveryJsonの処理を実行する。
 *
 * @responsibility readCommittedDockerRecoveryJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input file: string、expectedLogicalKey
 * @returns CommittedJsonを返す。
 * @precondition 「file: string、expectedLogicalKey」がreadCommittedDockerRecoveryJsonの入力契約を満たす。
 * @postcondition readCommittedDockerRecoveryJsonの責務を完了した結果だけを返す。
 * @effect N/A: readCommittedDockerRecoveryJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure readCommittedDockerRecoveryJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readCommittedDockerRecoveryJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readCommittedDockerRecoveryJsonはProcess内の同一Subsystemで完結する。
 * @security readCommittedDockerRecoveryJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readCommittedDockerRecoveryJsonは共有非同期状態を持たない同期処理である。
 */
export function readCommittedDockerRecoveryJson(
  file: string,
  expectedLogicalKey = path.basename(file),
): CommittedJson {
  const content = readStableFile(file);
  const value = JSON.parse(content.serialized);
  if (canonical(value) !== content.serialized)
    throw new Error("docker_task_recovery_record_noncanonical");
  const hash = createHash("sha256").update(content.serialized).digest("hex");
  const commit = `${file}${COMMIT_SUFFIX}`;
  if (!pathPresent(commit))
    throw new Error("docker_task_recovery_commit_missing");
  const commitRecord = readStableFile(commit);
  const commitValue = JSON.parse(commitRecord.serialized);
  if (
    canonical(commitValue) !== commitRecord.serialized ||
    !exactKeys(commitValue, [
      "schema",
      "logicalKey",
      "contentHash",
      "contentIdentity",
      "contentBytes",
    ]) ||
    commitValue.schema !== "crdd-coordinator-durable-json-commit/v1" ||
    commitValue.logicalKey !== expectedLogicalKey ||
    commitValue.contentHash !== hash ||
    commitValue.contentIdentity !== identityText(content.identity) ||
    commitValue.contentBytes !== Buffer.byteLength(content.serialized, "utf8")
  )
    throw new Error("docker_task_recovery_commit_invalid");
  return Object.freeze({
    target: file,
    commit,
    serialized: content.serialized,
    hash,
    identity: content.identity,
    identityText: identityText(content.identity),
    logicalKey: expectedLogicalKey,
    value,
  });
}

/**
 * moveCommittedDockerRecoveryJsonの処理を実行する。
 *
 * @responsibility moveCommittedDockerRecoveryJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input source: CommittedJson、target: string
 * @returns moveCommittedDockerRecoveryJsonの計算結果を返す。
 * @precondition 「source: CommittedJson、target: string」がmoveCommittedDockerRecoveryJsonの入力契約を満たす。
 * @postcondition moveCommittedDockerRecoveryJsonの責務を完了した結果だけを返す。
 * @effect N/A: moveCommittedDockerRecoveryJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure moveCommittedDockerRecoveryJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant moveCommittedDockerRecoveryJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: moveCommittedDockerRecoveryJsonはProcess内の同一Subsystemで完結する。
 * @security moveCommittedDockerRecoveryJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: moveCommittedDockerRecoveryJsonは共有非同期状態を持たない同期処理である。
 */
export function moveCommittedDockerRecoveryJson(
  source: CommittedJson,
  target: string,
) {
  const targetCommit = `${target}${COMMIT_SUFFIX}`;
  const sourceDirectory = path.dirname(source.target);
  const targetDirectory = path.dirname(target);
  const pair = committedPairEvidence(source);
  const digest = hashText(
    `${source.target}\0${target}\0${source.hash}\0${source.identityText}`,
  );
  const anchor = path.join(sourceDirectory, `${MOVE_PREFIX}${digest}.json`);
  if (
    !pathPresent(anchor) &&
    !pathPresent(`${anchor}${INTENT_PENDING_SUFFIX}`) &&
    (pathPresent(target) || pathPresent(targetCommit))
  )
    throw new Error("docker_recovery_record_already_exists");
  writeIntentAnchor(
    anchor,
    Object.freeze({
      schema: "crdd-coordinator-durable-json-move/v1",
      sourceParentIdentity: stableDirectoryIdentity(sourceDirectory),
      targetParentIdentity: stableDirectoryIdentity(targetDirectory),
      targetDirectory,
      pair,
      targetContentName: path.basename(target),
      targetCommitName: path.basename(targetCommit),
    }),
  );
  return resumeMoveAnchor(anchor);
}

/**
 * removeCommittedDockerRecoveryJsonの処理を実行する。
 *
 * @responsibility removeCommittedDockerRecoveryJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input file: string、expectedLogicalKey
 * @returns removeCommittedDockerRecoveryJsonの計算結果を返す。
 * @precondition 「file: string、expectedLogicalKey」がremoveCommittedDockerRecoveryJsonの入力契約を満たす。
 * @postcondition removeCommittedDockerRecoveryJsonの責務を完了した結果だけを返す。
 * @effect N/A: removeCommittedDockerRecoveryJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: removeCommittedDockerRecoveryJsonは独自の失敗分岐を所有しない。
 * @invariant removeCommittedDockerRecoveryJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: removeCommittedDockerRecoveryJsonはProcess内の同一Subsystemで完結する。
 * @security removeCommittedDockerRecoveryJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeCommittedDockerRecoveryJsonは共有非同期状態を持たない同期処理である。
 */
export function removeCommittedDockerRecoveryJson(
  file: string,
  expectedLogicalKey = path.basename(file),
) {
  const source = readCommittedDockerRecoveryJson(file, expectedLogicalKey);
  const directory = path.dirname(file);
  const digest = hashText(
    `${path.basename(file)}\0${source.hash}\0${source.identityText}`,
  );
  const anchor = path.join(directory, `${DELETE_PREFIX}${digest}.json`);
  writeIntentAnchor(
    anchor,
    Object.freeze({
      schema: "crdd-coordinator-durable-json-delete/v1",
      parentIdentity: stableDirectoryIdentity(directory),
      pair: committedPairEvidence(source),
    }),
  );
  return resumeDeleteAnchor(anchor);
}

/**
 * removeExactUncommittedDockerRecoveryJsonの処理を実行する。
 *
 * @responsibility removeExactUncommittedDockerRecoveryJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input file: string、expectedValue: unknown
 * @returns removeExactUncommittedDockerRecoveryJsonの計算結果を返す。
 * @precondition 「file: string、expectedValue: unknown」がremoveExactUncommittedDockerRecoveryJsonの入力契約を満たす。
 * @postcondition removeExactUncommittedDockerRecoveryJsonの責務を完了した結果だけを返す。
 * @effect removeExactUncommittedDockerRecoveryJsonはFilesystemの読取りまたは書込みを実行する。
 * @failure removeExactUncommittedDockerRecoveryJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant removeExactUncommittedDockerRecoveryJsonは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security removeExactUncommittedDockerRecoveryJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeExactUncommittedDockerRecoveryJsonは共有非同期状態を持たない同期処理である。
 */
export function removeExactUncommittedDockerRecoveryJson(
  file: string,
  expectedValue: unknown,
) {
  const commit = `${file}${COMMIT_SUFFIX}`;
  const observe = (target: string) => {
    try {
      return fs.lstatSync(target, { bigint: true });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT")
        return null;
      throw new Error("docker_recovery_uncommitted_record_observation_unknown");
    }
  };
  if (observe(file) === null || observe(commit) !== null)
    throw new Error("docker_recovery_uncommitted_record_state_invalid");
  const parentIdentity = stableDirectoryIdentity(path.dirname(file));
  const expectedSerialized = canonical(expectedValue);
  const before = readStableFile(file);
  if (before.serialized !== expectedSerialized)
    throw new Error("docker_recovery_uncommitted_record_mismatch");
  const beforeIdentity = identityText(before.identity);
  const immediatelyBeforeRemoval = readStableFile(file);
  if (
    immediatelyBeforeRemoval.serialized !== expectedSerialized ||
    identityText(immediatelyBeforeRemoval.identity) !== beforeIdentity ||
    observe(commit) !== null ||
    stableDirectoryIdentity(path.dirname(file)) !== parentIdentity
  )
    throw new Error("docker_recovery_uncommitted_record_changed");
  fs.unlinkSync(file);
  if (
    observe(file) !== null ||
    observe(commit) !== null ||
    stableDirectoryIdentity(path.dirname(file)) !== parentIdentity
  )
    throw new Error("docker_recovery_uncommitted_record_removal_unknown");
  return true;
}

/**
 * isDockerRecoveryJournalIntentNameの処理を実行する。
 *
 * @responsibility isDockerRecoveryJournalIntentNameに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input name: string
 * @returns isDockerRecoveryJournalIntentNameの計算結果を返す。
 * @precondition 「name: string」がisDockerRecoveryJournalIntentNameの入力契約を満たす。
 * @postcondition isDockerRecoveryJournalIntentNameの責務を完了した結果だけを返す。
 * @effect N/A: isDockerRecoveryJournalIntentNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDockerRecoveryJournalIntentNameは独自の失敗分岐を所有しない。
 * @invariant isDockerRecoveryJournalIntentNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDockerRecoveryJournalIntentNameはProcess内の同一Subsystemで完結する。
 * @security isDockerRecoveryJournalIntentNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isDockerRecoveryJournalIntentNameは共有非同期状態を持たない同期処理である。
 */
export function isDockerRecoveryJournalIntentName(name: string) {
  return /^(?:\.crdd-delete-|\.crdd-move-|\.crdd-cleanup-)[a-f0-9]{64}\.json(?:\.pending)?$/u.test(
    name,
  );
}

/**
 * removeDockerRecoveryCleanupDirectoryの処理を実行する。
 *
 * @responsibility removeDockerRecoveryCleanupDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input rootDirectory: string、cleanupDirectory: string、recoveryId: string、runtimeStateBinding: Readonly<{ runtimeStateIdentityHash: string; runtimeStateProtectionHash: string; localUserBindingHash: string; runtimeStateBindingHash: string; }>
 * @returns removeDockerRecoveryCleanupDirectoryの計算結果を返す。
 * @precondition 「rootDirectory: string、cleanupDirectory: string、recoveryId: string、runtimeStateBinding: Readonly<{ runtimeStateIdentityHash: string; runtimeStateProtectionHash: string; localUserBindingHash: string; runtimeStateBindingHash: string; }>」がremoveDockerRecoveryCleanupDirectoryの入力契約を満たす。
 * @postcondition removeDockerRecoveryCleanupDirectoryの責務を完了した結果だけを返す。
 * @effect removeDockerRecoveryCleanupDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure removeDockerRecoveryCleanupDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant removeDockerRecoveryCleanupDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security removeDockerRecoveryCleanupDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: removeDockerRecoveryCleanupDirectoryは共有非同期状態を持たない同期処理である。
 */
export function removeDockerRecoveryCleanupDirectory(
  rootDirectory: string,
  cleanupDirectory: string,
  recoveryId: string,
  runtimeStateBinding: Readonly<{
    runtimeStateIdentityHash: string;
    runtimeStateProtectionHash: string;
    localUserBindingHash: string;
    runtimeStateBindingHash: string;
  }>,
) {
  if (
    path.dirname(cleanupDirectory) !== rootDirectory ||
    path.basename(cleanupDirectory) === cleanupDirectory ||
    typeof recoveryId !== "string" ||
    recoveryId.length > 240 ||
    !validRuntimeStateBindingEvidence(runtimeStateBinding)
  )
    throw new Error("docker_recovery_cleanup_intent_invalid");
  const cleanupIdentity = stableDirectoryIdentity(cleanupDirectory);
  const entries = fs.readdirSync(cleanupDirectory, { withFileTypes: true });
  if (entries.length > 100)
    throw new Error("docker_recovery_cleanup_entry_limit_exceeded");
  const evidence = entries
    .map((entry) => {
      const target = path.join(cleanupDirectory, entry.name);
      const metadata = fs.lstatSync(target, { bigint: true });
      const identity = identityText(identityOf(metadata));
      if (entry.isDirectory() && !entry.isSymbolicLink()) {
        if (fs.readdirSync(target).length !== 0)
          throw new Error("docker_recovery_cleanup_intent_invalid");
        return Object.freeze({
          name: entry.name,
          type: "empty_directory" as const,
          hash: hashText(""),
          identity,
          bytes: 0,
        });
      }
      if (!entry.isFile() || entry.isSymbolicLink())
        throw new Error("docker_recovery_cleanup_intent_invalid");
      const observed = readStableFile(target);
      return Object.freeze({
        name: entry.name,
        type: "file" as const,
        hash: hashText(observed.serialized),
        identity,
        bytes: Buffer.byteLength(observed.serialized, "utf8"),
      });
    })
    .sort((left, right) => left.name.localeCompare(right.name));
  const digest = hashText(
    `${path.basename(cleanupDirectory)}\0${cleanupIdentity}\0${recoveryId}`,
  );
  const anchor = path.join(rootDirectory, `${CLEANUP_PREFIX}${digest}.json`);
  writeIntentAnchor(
    anchor,
    Object.freeze({
      schema: "crdd-coordinator-recovery-cleanup-delete/v1",
      rootIdentity: stableDirectoryIdentity(rootDirectory),
      cleanupName: path.basename(cleanupDirectory),
      cleanupIdentity,
      recoveryId,
      runtimeStateBinding,
      entries: Object.freeze(evidence),
    }),
  );
  return resumeCleanupAnchor(anchor);
}

/**
 * resumeDockerRecoveryJournalDirectoryの処理を実行する。
 *
 * @responsibility resumeDockerRecoveryJournalDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string
 * @returns resumeDockerRecoveryJournalDirectoryの計算結果を返す。
 * @precondition 「directory: string」がresumeDockerRecoveryJournalDirectoryの入力契約を満たす。
 * @postcondition resumeDockerRecoveryJournalDirectoryの責務を完了した結果だけを返す。
 * @effect resumeDockerRecoveryJournalDirectoryはFilesystemの読取りまたは書込みを実行する。
 * @failure resumeDockerRecoveryJournalDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resumeDockerRecoveryJournalDirectoryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resumeDockerRecoveryJournalDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resumeDockerRecoveryJournalDirectoryは共有非同期状態を持たない同期処理である。
 */
export function resumeDockerRecoveryJournalDirectory(directory: string) {
  stableDirectoryIdentity(directory);
  const names = fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort();
  for (const name of names) {
    if (name.endsWith(INTENT_PENDING_SUFFIX)) {
      const anchor = path.join(
        directory,
        name.slice(0, -INTENT_PENDING_SUFFIX.length),
      );
      if (pathPresent(anchor))
        throw new Error("docker_recovery_intent_third_state");
      fs.renameSync(path.join(directory, name), anchor);
    }
  }
  const anchors = fs
    .readdirSync(directory)
    .filter(
      (name) =>
        isDockerRecoveryJournalIntentName(name) &&
        !name.endsWith(INTENT_PENDING_SUFFIX),
    )
    .sort();
  for (const name of anchors) {
    const anchor = path.join(directory, name);
    const value = readIntentAnchor(anchor);
    if (value.schema === "crdd-coordinator-durable-json-delete/v1")
      resumeDeleteAnchor(anchor);
    else if (value.schema === "crdd-coordinator-durable-json-move/v1")
      resumeMoveAnchor(anchor);
    else if (value.schema === "crdd-coordinator-recovery-cleanup-delete/v1")
      resumeCleanupAnchor(anchor);
    else throw new Error("docker_recovery_intent_invalid");
  }
  return true;
}

/**
 * RuntimeState recovery is authorized for one exact recovery generation.  The
 *
 * @responsibility resumeDockerRecoveryJournalDirectoryForRecoveryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、recoveryId: string、runtimeStateBinding: Readonly<{ runtimeStateIdentityHash: string; runtimeStateProtectionHash: string; localUserBindingHash: string; runtimeStateBindingHash: string; }>
 * @returns resumeDockerRecoveryJournalDirectoryForRecoveryの計算結果を返す。
 * @precondition 「directory: string、recoveryId: string、runtimeStateBinding: Readonly<{ runtimeStateIdentityHash: string; runtimeStateProtectionHash: string; localUserBindingHash: string; runtimeStateBindingHash: string; }>」がresumeDockerRecoveryJournalDirectoryForRecoveryの入力契約を満たす。
 * @postcondition resumeDockerRecoveryJournalDirectoryForRecoveryの責務を完了した結果だけを返す。
 * @effect resumeDockerRecoveryJournalDirectoryForRecoveryはFilesystemの読取りまたは書込みを実行する。
 * @failure resumeDockerRecoveryJournalDirectoryForRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant resumeDockerRecoveryJournalDirectoryForRecoveryは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security resumeDockerRecoveryJournalDirectoryForRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: resumeDockerRecoveryJournalDirectoryForRecoveryは共有非同期状態を持たない同期処理である。
 */
export function resumeDockerRecoveryJournalDirectoryForRecovery(
  directory: string,
  recoveryId: string,
  runtimeStateBinding: Readonly<{
    runtimeStateIdentityHash: string;
    runtimeStateProtectionHash: string;
    localUserBindingHash: string;
    runtimeStateBindingHash: string;
  }>,
) {
  stableDirectoryIdentity(directory);
  if (
    !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
      recoveryId,
    ) ||
    !validRuntimeStateBindingEvidence(runtimeStateBinding)
  )
    throw new Error("docker_recovery_target_invalid");
  const snapshots = fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()
    .map((name) => {
      const anchorName = name.endsWith(INTENT_PENDING_SUFFIX)
        ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
        : name;
      if (
        name.endsWith(INTENT_PENDING_SUFFIX) &&
        pathPresent(path.join(directory, anchorName))
      )
        throw new Error("docker_recovery_intent_third_state");
      const anchor = path.join(directory, name);
      const stable = readStableFile(anchor);
      const value = validateIntentSnapshot(anchor);
      const intentRecoveryId = recoveryIdFromIntent(value);
      if (!intentRecoveryId)
        throw new Error("docker_recovery_intent_recovery_id_missing");
      return Object.freeze({
        name,
        anchorName,
        serialized: stable.serialized,
        identity: identityText(stable.identity),
        value,
        target: intentRecoveryId === recoveryId,
      });
    });
  const targetBinding = resolveRuntimeStateBindingForRecovery(
    directory,
    recoveryId,
    snapshots.map((snapshot) => snapshot.value),
  );
  if (!sameRuntimeStateBindingEvidence(targetBinding, runtimeStateBinding))
    throw new Error("docker_recovery_target_binding_mismatch");
  for (const snapshot of snapshots) {
    if (!snapshot.target) continue;
    let anchor = path.join(directory, snapshot.name);
    if (snapshot.name.endsWith(INTENT_PENDING_SUFFIX)) {
      const finalAnchor = path.join(directory, snapshot.anchorName);
      if (pathPresent(finalAnchor))
        throw new Error("docker_recovery_intent_third_state");
      fs.renameSync(anchor, finalAnchor);
      anchor = finalAnchor;
    }
    const value = readIntentAnchor(anchor);
    if (recoveryIdFromIntent(value) !== recoveryId)
      throw new Error("docker_recovery_target_changed");
    if (value.schema === "crdd-coordinator-durable-json-delete/v1")
      resumeDeleteAnchor(anchor);
    else if (value.schema === "crdd-coordinator-durable-json-move/v1")
      resumeMoveAnchor(anchor);
    else if (value.schema === "crdd-coordinator-recovery-cleanup-delete/v1")
      resumeCleanupAnchor(anchor);
    else throw new Error("docker_recovery_intent_invalid");
  }
  for (const snapshot of snapshots) {
    if (snapshot.target) continue;
    const anchor = path.join(directory, snapshot.name);
    const current = readStableFile(anchor);
    if (
      current.serialized !== snapshot.serialized ||
      identityText(current.identity) !== snapshot.identity
    )
      throw new Error("docker_recovery_non_target_intent_changed");
  }
  return true;
}

/**
 * hasDockerRecoveryJournalIntentForRecoveryの処理を実行する。
 *
 * @responsibility hasDockerRecoveryJournalIntentForRecoveryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、recoveryId: string
 * @returns hasDockerRecoveryJournalIntentForRecoveryの計算結果を返す。
 * @precondition 「directory: string、recoveryId: string」がhasDockerRecoveryJournalIntentForRecoveryの入力契約を満たす。
 * @postcondition hasDockerRecoveryJournalIntentForRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: hasDockerRecoveryJournalIntentForRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: hasDockerRecoveryJournalIntentForRecoveryは独自の失敗分岐を所有しない。
 * @invariant hasDockerRecoveryJournalIntentForRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: hasDockerRecoveryJournalIntentForRecoveryはProcess内の同一Subsystemで完結する。
 * @security hasDockerRecoveryJournalIntentForRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: hasDockerRecoveryJournalIntentForRecoveryは共有非同期状態を持たない同期処理である。
 */
export function hasDockerRecoveryJournalIntentForRecovery(
  directory: string,
  recoveryId: string,
) {
  stableDirectoryIdentity(directory);
  return fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .some((name) => {
      const anchor = path.join(directory, name);
      return (
        recoveryIdFromIntent(validateIntentSnapshot(anchor)) === recoveryId
      );
    });
}

/**
 * inspectDockerRecoveryMoveJournalForRecoveryの処理を実行する。
 *
 * @responsibility inspectDockerRecoveryMoveJournalForRecoveryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、recoveryId: string、logicalKey: string、targetDirectory: string、targetContentName: string
 * @returns inspectDockerRecoveryMoveJournalForRecoveryの計算結果を返す。
 * @precondition 「directory: string、recoveryId: string、logicalKey: string、targetDirectory: string、targetContentName: string」がinspectDockerRecoveryMoveJournalForRecoveryの入力契約を満たす。
 * @postcondition inspectDockerRecoveryMoveJournalForRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: inspectDockerRecoveryMoveJournalForRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectDockerRecoveryMoveJournalForRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDockerRecoveryMoveJournalForRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectDockerRecoveryMoveJournalForRecoveryはProcess内の同一Subsystemで完結する。
 * @security inspectDockerRecoveryMoveJournalForRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectDockerRecoveryMoveJournalForRecoveryは共有非同期状態を持たない同期処理である。
 */
export function inspectDockerRecoveryMoveJournalForRecovery(
  directory: string,
  recoveryId: string,
  logicalKey: string,
  targetDirectory: string,
  targetContentName: string,
) {
  stableDirectoryIdentity(directory);
  stableDirectoryIdentity(targetDirectory);
  if (
    !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
      recoveryId,
    ) ||
    path.basename(targetContentName) !== targetContentName
  )
    throw new Error("docker_recovery_target_invalid");
  const matches = fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()
    .flatMap((name) => {
      const anchor = path.join(directory, name);
      const value = validateIntentSnapshot(anchor);
      if (value.schema !== "crdd-coordinator-durable-json-move/v1") return [];
      const inspected = inspectMoveAnchorState(anchor);
      if (
        recoveryIdFromIntent(value) !== recoveryId ||
        inspected.record.logicalKey !== logicalKey ||
        inspected.targetDirectory !== targetDirectory ||
        value.targetContentName !== targetContentName ||
        value.targetCommitName !== dockerRecoveryCommitName(targetContentName)
      )
        return [];
      return [
        Object.freeze({
          ...inspected.record,
          moveState: inspected.state,
        }),
      ];
    });
  const match = matches[0];
  if (matches.length !== 1 || !match)
    throw new Error("docker_recovery_move_target_unverified");
  return match;
}

/**
 * inspectDockerRecoveryJournalDirectoryの処理を実行する。
 *
 * @responsibility inspectDockerRecoveryJournalDirectoryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string
 * @returns inspectDockerRecoveryJournalDirectoryの計算結果を返す。
 * @precondition 「directory: string」がinspectDockerRecoveryJournalDirectoryの入力契約を満たす。
 * @postcondition inspectDockerRecoveryJournalDirectoryの責務を完了した結果だけを返す。
 * @effect N/A: inspectDockerRecoveryJournalDirectoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure inspectDockerRecoveryJournalDirectoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant inspectDockerRecoveryJournalDirectoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectDockerRecoveryJournalDirectoryはProcess内の同一Subsystemで完結する。
 * @security inspectDockerRecoveryJournalDirectoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectDockerRecoveryJournalDirectoryは共有非同期状態を持たない同期処理である。
 */
export function inspectDockerRecoveryJournalDirectory(directory: string) {
  stableDirectoryIdentity(directory);
  const values: Array<
    Readonly<{
      schema: string;
      recoveryId: string | null;
      name: string;
      runtimeStateBinding: Readonly<Record<string, unknown>> | null;
      pairLogicalKey: string | null;
      pairContentName: string | null;
      pairCommitName: string | null;
      targetContentName: string | null;
      targetCommitName: string | null;
      moveState: "move_content" | "move_commit" | "complete" | null;
    }>
  > = [];
  for (const name of fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()) {
    const anchorName = name.endsWith(INTENT_PENDING_SUFFIX)
      ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
      : name;
    if (
      name.endsWith(INTENT_PENDING_SUFFIX) &&
      pathPresent(path.join(directory, anchorName))
    )
      throw new Error("docker_recovery_intent_third_state");
    const value = validateIntentSnapshot(path.join(directory, name));
    const schema = typeof value.schema === "string" ? value.schema : "";
    if (
      schema !== "crdd-coordinator-durable-json-delete/v1" &&
      schema !== "crdd-coordinator-durable-json-move/v1" &&
      schema !== "crdd-coordinator-recovery-cleanup-delete/v1"
    )
      throw new Error("docker_recovery_intent_invalid");
    const moveInspection =
      schema === "crdd-coordinator-durable-json-move/v1"
        ? inspectMoveAnchorState(path.join(directory, name))
        : null;
    values.push(
      Object.freeze({
        schema,
        recoveryId: recoveryIdFromIntent(value),
        name,
        runtimeStateBinding:
          schema === "crdd-coordinator-recovery-cleanup-delete/v1"
            ? (value.runtimeStateBinding as Readonly<Record<string, unknown>>)
            : null,
        pairLogicalKey:
          schema === "crdd-coordinator-durable-json-delete/v1" ||
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String((value.pair as Record<string, unknown>).logicalKey)
            : null,
        pairContentName:
          schema === "crdd-coordinator-durable-json-delete/v1" ||
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String((value.pair as Record<string, unknown>).contentName)
            : null,
        pairCommitName:
          schema === "crdd-coordinator-durable-json-delete/v1" ||
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String((value.pair as Record<string, unknown>).commitName)
            : null,
        targetContentName:
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String(value.targetContentName)
            : null,
        targetCommitName:
          schema === "crdd-coordinator-durable-json-move/v1"
            ? String(value.targetCommitName)
            : null,
        moveState: moveInspection?.state ?? null,
      }),
    );
  }
  return Object.freeze(values);
}

/**
 * discoverDockerRecoveryJournalJsonの処理を実行する。
 *
 * @responsibility discoverDockerRecoveryJournalJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、logicalKey: string
 * @returns discoverDockerRecoveryJournalJsonの計算結果を返す。
 * @precondition 「directory: string、logicalKey: string」がdiscoverDockerRecoveryJournalJsonの入力契約を満たす。
 * @postcondition discoverDockerRecoveryJournalJsonの責務を完了した結果だけを返す。
 * @effect N/A: discoverDockerRecoveryJournalJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure discoverDockerRecoveryJournalJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant discoverDockerRecoveryJournalJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: discoverDockerRecoveryJournalJsonはProcess内の同一Subsystemで完結する。
 * @security discoverDockerRecoveryJournalJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: discoverDockerRecoveryJournalJsonは共有非同期状態を持たない同期処理である。
 */
export function discoverDockerRecoveryJournalJson(
  directory: string,
  logicalKey: string,
) {
  stableDirectoryIdentity(directory);
  const matches: DiscoveredJournalJson[] = [];
  for (const name of fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()) {
    const anchorName = name.endsWith(INTENT_PENDING_SUFFIX)
      ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
      : name;
    if (
      name.endsWith(INTENT_PENDING_SUFFIX) &&
      pathPresent(path.join(directory, anchorName))
    )
      throw new Error("docker_recovery_intent_third_state");
    const value = validateIntentSnapshot(path.join(directory, name));
    if (
      (value.schema !== "crdd-coordinator-durable-json-move/v1" &&
        value.schema !== "crdd-coordinator-durable-json-delete/v1") ||
      !validPairEvidence(value.pair)
    )
      continue;
    const pair = value.pair as Record<string, unknown>;
    if (pair.logicalKey !== logicalKey) continue;
    const serialized = String(pair.contentSerialized);
    const parsed = JSON.parse(serialized);
    if (canonical(parsed) !== serialized)
      throw new Error("docker_recovery_intent_noncanonical");
    matches.push(
      Object.freeze({
        serialized,
        hash: String(pair.contentHash),
        identityText: String(pair.contentIdentity),
        logicalKey,
        value: parsed,
      }),
    );
  }
  if (matches.length > 1) throw new Error("docker_recovery_intent_third_state");
  return matches[0] ?? null;
}

/**
 * discoverDockerRecoveryJournalJsonForRecoveryの処理を実行する。
 *
 * @responsibility discoverDockerRecoveryJournalJsonForRecoveryに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input directory: string、logicalKey: string、recoveryId: string
 * @returns discoverDockerRecoveryJournalJsonForRecoveryの計算結果を返す。
 * @precondition 「directory: string、logicalKey: string、recoveryId: string」がdiscoverDockerRecoveryJournalJsonForRecoveryの入力契約を満たす。
 * @postcondition discoverDockerRecoveryJournalJsonForRecoveryの責務を完了した結果だけを返す。
 * @effect N/A: discoverDockerRecoveryJournalJsonForRecoveryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure discoverDockerRecoveryJournalJsonForRecoveryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant discoverDockerRecoveryJournalJsonForRecoveryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: discoverDockerRecoveryJournalJsonForRecoveryはProcess内の同一Subsystemで完結する。
 * @security discoverDockerRecoveryJournalJsonForRecoveryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: discoverDockerRecoveryJournalJsonForRecoveryは共有非同期状態を持たない同期処理である。
 */
export function discoverDockerRecoveryJournalJsonForRecovery(
  directory: string,
  logicalKey: string,
  recoveryId: string,
) {
  stableDirectoryIdentity(directory);
  if (
    !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(recoveryId)
  )
    throw new Error("docker_recovery_target_invalid");
  const matches: DiscoveredJournalJson[] = [];
  for (const name of fs
    .readdirSync(directory)
    .filter(isDockerRecoveryJournalIntentName)
    .sort()) {
    const anchorName = name.endsWith(INTENT_PENDING_SUFFIX)
      ? name.slice(0, -INTENT_PENDING_SUFFIX.length)
      : name;
    if (
      name.endsWith(INTENT_PENDING_SUFFIX) &&
      pathPresent(path.join(directory, anchorName))
    )
      throw new Error("docker_recovery_intent_third_state");
    const value = validateIntentSnapshot(path.join(directory, name));
    if (
      (value.schema !== "crdd-coordinator-durable-json-move/v1" &&
        value.schema !== "crdd-coordinator-durable-json-delete/v1") ||
      !validPairEvidence(value.pair)
    )
      continue;
    const pair = value.pair as Record<string, unknown>;
    if (
      pair.logicalKey !== logicalKey ||
      recoveryIdFromIntent(value) !== recoveryId
    )
      continue;
    const serialized = String(pair.contentSerialized);
    const parsed = JSON.parse(serialized);
    if (canonical(parsed) !== serialized)
      throw new Error("docker_recovery_intent_noncanonical");
    matches.push(
      Object.freeze({
        serialized,
        hash: String(pair.contentHash),
        identityText: String(pair.contentIdentity),
        logicalKey,
        value: parsed,
      }),
    );
  }
  if (matches.length > 1) throw new Error("docker_recovery_intent_third_state");
  return matches[0] ?? null;
}

/**
 * describeDockerRecoveryJournalContractの処理を実行する。
 *
 * @responsibility describeDockerRecoveryJournalContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeDockerRecoveryJournalContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeDockerRecoveryJournalContractの入力契約を満たす。
 * @postcondition describeDockerRecoveryJournalContractの責務を完了した結果だけを返す。
 * @effect describeDockerRecoveryJournalContractはFilesystemの読取りまたは書込みを実行する。
 * @failure N/A: describeDockerRecoveryJournalContractは独自の失敗分岐を所有しない。
 * @invariant describeDockerRecoveryJournalContractは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security describeDockerRecoveryJournalContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeDockerRecoveryJournalContractは共有非同期状態を持たない同期処理である。
 */
export function describeDockerRecoveryJournalContract() {
  return Object.freeze({
    commitSchema: "crdd-coordinator-durable-json-commit/v1",
    processCrashBoundary:
      "fsynced_temp_atomic_rename_then_fsynced_commit_atomic_rename",
    uncommittedFinalTreatment: "retain_and_fail_closed",
    orphanTemporaryTreatment: "retain_and_fail_closed",
    deleteBoundary: "single_atomic_anchor_then_target_commit_anchor",
    moveBoundary: "single_atomic_anchor_then_content_commit_anchor",
    runtimeStateResumeAuthority:
      "exact_recovery_id_and_creation_binding_non_target_unchanged",
    powerLossDurabilityClaimed: false,
  });
}

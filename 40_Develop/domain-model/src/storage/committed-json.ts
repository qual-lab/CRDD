/**
 * JSON本文と確定sidecarの同一性を検証して保存・読取り・削除する。
 * @responsibility 実体・Hash・byteの確定と観測不能拒否だけを所有し、Task・Docker回復ID・認可を解釈しない。
 * @trace ARCH-000008
 * @trace ARCH-000003
 * @boundary 呼出し元が検証した保存Rootと同一FileIdentity。Lock・利用許可・業務Schemaは呼出し元が所有する。
 * @compatibility 既存commit Schema・suffix・有限失敗理由を維持する。停電耐久性は保証しない。
 */
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAX_RECORD_BYTES = 262_144;
const COMMIT_SUFFIX = ".crdd-commit.json";
const TEMP_PREFIX = ".crdd-pending-";
const DELETE_PREFIX = ".crdd-delete-";
const INTENT_PENDING_SUFFIX = ".pending";

/**
 * committed-jsonで使用するFile Identityの値契約を定義する。
 *
 * @responsibility File IdentityのProperty、Identity、状態制約を型境界として所有する。
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
 * committed-jsonで使用するCommitted Jsonの値契約を定義する。
 *
 * @responsibility Committed JsonのProperty、Identity、状態制約を型境界として所有する。
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
 * canonicalを決定する。
 *
 * @responsibility canonicalの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * identity Ofを決定する。
 *
 * @responsibility identity Ofの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * identity Textを決定する。
 *
 * @responsibility identity Textの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * Keysが完全一致するか判定する。
 *
 * @responsibility Keysの比較対象、完全一致条件、判定結果境界を所有する。
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
 * Stable Fileを読み取る。
 *
 * @responsibility Stable Fileの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input file: string
 * @returns readStableFileの計算結果を返す。
 * @precondition 「file: string」がreadStableFileの入力契約を満たす。
 * @postcondition readStableFileの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure readStableFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readStableFileは宣言した境界以外へEffectを拡張しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * Directory Identityを安定Identityへ変換する。
 *
 * @responsibility Directory Identityの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000008
 * @input directory: string
 * @returns stableDirectoryIdentityの計算結果を返す。
 * @precondition 「directory: string」がstableDirectoryIdentityの入力契約を満たす。
 * @postcondition stableDirectoryIdentityの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure stableDirectoryIdentityは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableDirectoryIdentityは宣言した境界以外へEffectを拡張しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * hash Textを決定する。
 *
 * @responsibility hash Textの導出に必要な入力、判定規則、返却結果の境界を所有する。
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
 * Pathを観測する。
 *
 * @responsibility Pathの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns observePathの計算結果を返す。
 * @precondition 「target: string」がobservePathの入力契約を満たす。
 * @postcondition observePathの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure observePathは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observePathは宣言した境界以外へEffectを拡張しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * path Presentを決定する。
 *
 * @responsibility path Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns pathPresentの計算結果を返す。
 * @precondition 「target: string」がpathPresentの入力契約を満たす。
 * @postcondition pathPresentの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure N/A: pathPresentは独自の失敗分岐を所有しない。
 * @invariant pathPresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
 * @security pathPresentはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: pathPresentは共有非同期状態を持たない同期処理である。
 */
function pathPresent(target: string) {
  return observePath(target) !== null;
}

/**
 * regular File Presentを決定する。
 *
 * @responsibility regular File Presentの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input target: string
 * @returns regularFilePresentの計算結果を返す。
 * @precondition 「target: string」がregularFilePresentの入力契約を満たす。
 * @postcondition regularFilePresentの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure regularFilePresentは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant regularFilePresentは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * Fileが完全一致するか判定する。
 *
 * @responsibility Fileの比較対象、完全一致条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input file: string、serialized: string、identity: string
 * @returns exactFileの計算結果を返す。
 * @precondition 「file: string、serialized: string、identity: string」がexactFileの入力契約を満たす。
 * @postcondition exactFileの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure exactFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant exactFileは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * Intent Anchorを書き込む。
 *
 * @responsibility Intent Anchorの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input anchor: string、value: unknown
 * @returns writeIntentAnchorの計算結果を返す。
 * @precondition 「anchor: string、value: unknown」がwriteIntentAnchorの入力契約を満たす。
 * @postcondition writeIntentAnchorの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure writeIntentAnchorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 指定named pairと同じRootの確定用短命物以外を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * Intent Anchorを読み取る。
 *
 * @responsibility Intent Anchorの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input anchor: string
 * @returns readIntentAnchorの計算結果を返す。
 * @precondition 「anchor: string」がreadIntentAnchorの入力契約を満たす。
 * @postcondition readIntentAnchorの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure readIntentAnchorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readIntentAnchorは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * committed Pair Evidenceを決定する。
 *
 * @responsibility committed Pair Evidenceの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input source: CommittedJson
 * @returns committedPairEvidenceの計算結果を返す。
 * @precondition 「source: CommittedJson」がcommittedPairEvidenceの入力契約を満たす。
 * @postcondition committedPairEvidenceの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure N/A: committedPairEvidenceは独自の失敗分岐を所有しない。
 * @invariant committedPairEvidenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * Pair Evidenceが有効か判定する。
 *
 * @responsibility Pair Evidenceの有効条件、拒否条件、判定結果境界を所有する。
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
 * resume Delete Anchorを決定する。
 *
 * @responsibility resume Delete Anchorの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input anchor: string
 * @returns resumeDeleteAnchorの計算結果を返す。
 * @precondition 「anchor: string」がresumeDeleteAnchorの入力契約を満たす。
 * @postcondition resumeDeleteAnchorの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure resumeDeleteAnchorは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 指定named pairと同じRootの確定用短命物以外を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * Atomic Fileを書き込む。
 *
 * @responsibility Atomic Fileの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、target: string、serialized: string
 * @returns writeAtomicFileの計算結果を返す。
 * @precondition 「directory: string、target: string、serialized: string」がwriteAtomicFileの入力契約を満たす。
 * @postcondition writeAtomicFileの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure writeAtomicFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 指定named pairと同じRootの確定用短命物以外を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
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
 * docker 回復 Commit Nameを決定する。
 *
 * @responsibility docker 回復 Commit Nameの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000008
 * @input name: string
 * @returns getJsonCommitNameの計算結果を返す。
 * @precondition 「name: string」がgetJsonCommitNameの入力契約を満たす。
 * @postcondition getJsonCommitNameの責務を完了した結果だけを返す。
 * @effect N/A: getJsonCommitNameは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: getJsonCommitNameは独自の失敗分岐を所有しない。
 * @invariant getJsonCommitNameは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: getJsonCommitNameはProcess内の同一Subsystemで完結する。
 * @security getJsonCommitNameはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: getJsonCommitNameは共有非同期状態を持たない同期処理である。
 */
export function getJsonCommitName(name: string) {
  return `${name}${COMMIT_SUFFIX}`;
}

/**
 * 確定JSONを書き込む。
 *
 * @responsibility 確定JSONの書込み先、確定条件、部分書込みの失敗境界を所有する。
 * @trace ARCH-000008
 * @input directory: string、name: string、logicalKey: string、value: unknown
 * @returns CommittedJsonを返す。
 * @precondition 呼出し元がRoot・exact Path・basenameと権限を検証し、排他を保持している。
 * @postcondition writeCommittedJsonの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure writeCommittedJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant 指定named pairと同じRootの確定用短命物以外を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
 * @security symlinkと同一Path置換を拒否する。別名hardlinkの発見・拒否・消去や秘密の完全消去は保証しない。
 * @concurrency N/A: writeCommittedJsonは共有非同期状態を持たない同期処理である。
 */
export function writeCommittedJson(
  directory: string,
  name: string,
  logicalKey: string,
  value: unknown,
): CommittedJson {
  const target = path.join(directory, name);
  const commit = path.join(directory, getJsonCommitName(name));
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
 * 確定JSONを読み取る。
 *
 * @responsibility 確定JSONの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000008
 * @input file: string、expectedLogicalKey
 * @returns CommittedJsonを返す。
 * @precondition 呼出し元がRoot・exact Path・basenameと権限を検証し、排他を保持している。
 * @postcondition readCommittedJsonの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure readCommittedJsonは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readCommittedJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
 * @security symlinkと同一Path置換を拒否する。別名hardlinkの発見・拒否・消去や秘密の完全消去は保証しない。
 * @concurrency N/A: readCommittedJsonは共有非同期状態を持たない同期処理である。
 */
export function readCommittedJson(
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
 * 確定JSONを除去する。
 *
 * @responsibility 確定JSONの対象Identity、除去条件、終了後状態の境界を所有する。
 * @trace ARCH-000008
 * @input file: string、expectedLogicalKey
 * @returns removeCommittedJsonの計算結果を返す。
 * @precondition 呼出し元がRoot・exact Path・basenameと権限を検証し、排他を保持している。
 * @postcondition removeCommittedJsonの責務を完了した結果だけを返す。
 * @effect 呼出し元が検証・排他したRoot内で、対象Fileと確定用短命物のI/Oだけを行う。
 * @failure N/A: removeCommittedJsonは独自の失敗分岐を所有しない。
 * @invariant 指定named pairと同じRootの確定用短命物以外を変更しない。
 * @boundary 検証済み保存RootとFilesystem。同時操作の排他は呼出し元が所有する。
 * @security symlinkと同一Path置換を拒否する。別名hardlinkの発見・拒否・消去や秘密の完全消去は保証しない。
 * @concurrency N/A: removeCommittedJsonは共有非同期状態を持たない同期処理である。
 */
export function removeCommittedJson(
  file: string,
  expectedLogicalKey = path.basename(file),
) {
  const source = readCommittedJson(file, expectedLogicalKey);
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
 * Committed Pair Delete 状態を分類する。
 *
 * @responsibility Committed Pair Delete 状態の分類条件、相互排他的な結果、判断不能境界を所有する。
 * @trace ARCH-000008
 * @input contentPresent: boolean、commitPresent: boolean
 * @returns classifyCommittedPairDeleteStateの計算結果を返す。
 * @precondition 「contentPresent: boolean、commitPresent: boolean」がclassifyCommittedPairDeleteStateの入力契約を満たす。
 * @postcondition classifyCommittedPairDeleteStateの責務を完了した結果だけを返す。
 * @effect N/A: classifyCommittedPairDeleteStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: classifyCommittedPairDeleteStateは独自の失敗分岐を所有しない。
 * @invariant classifyCommittedPairDeleteStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: classifyCommittedPairDeleteStateはProcess内の同一Subsystemで完結する。
 * @security classifyCommittedPairDeleteStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: classifyCommittedPairDeleteStateは共有非同期状態を持たない同期処理である。
 */
function classifyCommittedPairDeleteState(
  contentPresent: boolean,
  commitPresent: boolean,
) {
  if (contentPresent && commitPresent) return "remove_content" as const;
  if (!contentPresent && commitPresent) return "remove_commit" as const;
  if (!contentPresent && !commitPresent) return "complete" as const;
  return "third_state" as const;
}

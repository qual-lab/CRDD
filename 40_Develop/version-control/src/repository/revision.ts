/**
 * 現在Revision・形式と固定Identityの契約・Git読取りを所有する。
 * @responsibility 現在Revision・形式と固定Identityの契約・Git読取りを所有する。
 * @trace ARCH-000002
 */
import {
  observeVerifiedRepositoryLayout,
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "./location.ts";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { inspectGitCommitTreeCandidate } from "../git/objects.ts";
import {
  inspectRepositoryGitObjectFormatCandidate,
  type RepositoryGitLayout,
  resolveRepositoryGitLayout,
} from "./layout.ts";

export const FIXED_REVISION_IDENTITY_CONTRACT =
  "crdd-version-control/fixed-revision-identity/v1";

export const FIXED_REVISION_IDENTITY_CONTRACT_REVISION = 1;

/**
 * fixed-revisionで使用するFixed Revision Identityの値契約を定義する。
 *
 * @responsibility Fixed Revision IdentityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape FixedRevisionIdentityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FixedRevisionIdentityで宣言した値と責務の対応を維持する。
 * @boundary N/A: FixedRevisionIdentityの宣言は外部境界を開かない。
 * @security N/A: FixedRevisionIdentityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FixedRevisionIdentityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FixedRevisionIdentity = Readonly<{
  contract: typeof FIXED_REVISION_IDENTITY_CONTRACT;
  contractRevision: typeof FIXED_REVISION_IDENTITY_CONTRACT_REVISION;
  status: "observed";
  repositoryIdentity: string;
  repositoryInstanceIdentity: string;
  repositoryForm: "primary" | "linked" | "embedded";
  revisionIdentity: string;
  snapshotIdentity: string;
  objectFormat: "sha1";
  observationComplete: true;
  repositoryPathReported: false;
}>;

/**
 * fixed-revisionで使用するFixed Revision Identity Adapterの値契約を定義する。
 *
 * @responsibility Fixed Revision Identity AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape FixedRevisionIdentityAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant FixedRevisionIdentityAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: FixedRevisionIdentityAdapterの宣言は外部境界を開かない。
 * @security N/A: FixedRevisionIdentityAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility FixedRevisionIdentityAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type FixedRevisionIdentityAdapter = (
  repositoryRoot: string,
) => FixedRevisionIdentity | null;

/**
 * Fixed Revision Identityを観測する。
 *
 * @responsibility Fixed Revision Identityの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、adapter: FixedRevisionIdentityAdapter
 * @returns FixedRevisionIdentity | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、adapter: FixedRevisionIdentityAdapter」がobserveFixedRevisionIdentityの入力契約を満たす。
 * @postcondition observeFixedRevisionIdentityの責務を完了した結果だけを返す。
 * @effect 指定AdapterへRepositoryの改訂または形式の観測を委譲する。
 * @failure N/A: observeFixedRevisionIdentityは独自の失敗分岐を所有しない。
 * @invariant observeFixedRevisionIdentityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 指定Adapterの外部観測と型付き観測結果の境界。
 * @security observeFixedRevisionIdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeFixedRevisionIdentityは共有非同期状態を持たない同期処理である。
 */
export function observeFixedRevisionIdentity(
  capability: VerifiedRepositoryRoot,
  adapter: FixedRevisionIdentityAdapter,
): FixedRevisionIdentity | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null ? null : adapter(repositoryRoot);
}

const MAX_HEAD_BYTES = 4_096;

const MAX_PACKED_REFS_BYTES = 4 * 1024 * 1024;

const OBJECT_ID = /^[a-f0-9]{40}$/u;

const SAFE_REF = /^refs\/(?:heads|tags)\/[A-Za-z0-9._/-]{1,1024}$/u;

/**
 * Fileを安定Identityへ変換する。
 *
 * @responsibility Fileの正規化条件、一意性、変換不能時の拒否境界を所有する。
 * @trace ARCH-000002
 * @input target: string、maximumBytes: number
 * @returns Bufferを返す。
 * @precondition 「target: string、maximumBytes: number」がstableFileの入力契約を満たす。
 * @postcondition stableFileの責務を完了した結果だけを返す。
 * @effect 指定Fileを有界で読み取りdescriptorを閉じる。書込みは行わない。
 * @failure stableFileは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant stableFileは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: stableFileはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: stableFileは共有非同期状態を持たない同期処理である。
 */
function stableFile(target: string, maximumBytes: number): Buffer {
  const handle = fs.openSync(target, "r");
  try {
    const before = fs.fstatSync(handle, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 1n ||
      before.size > BigInt(maximumBytes)
    )
      throw new Error("fixed_revision_file_invalid");
    const bytes = Buffer.alloc(Number(before.size));
    let offset = 0;
    while (offset < bytes.byteLength) {
      const read = fs.readSync(
        handle,
        bytes,
        offset,
        bytes.byteLength - offset,
        offset,
      );
      if (read <= 0) throw new Error("fixed_revision_file_changed");
      offset += read;
    }
    const after = fs.fstatSync(handle, { bigint: true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.birthtimeNs !== after.birthtimeNs ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs
    )
      throw new Error("fixed_revision_file_changed");
    return bytes;
  } finally {
    fs.closeSync(handle);
  }
}

/**
 * Controlを検証済み値へ復号する。
 *
 * @responsibility Controlの入力形式、復号結果、不正byte列の拒否境界を所有する。
 * @trace ARCH-000002
 * @input bytes: Buffer
 * @returns stringを返す。
 * @precondition 「bytes: Buffer」がdecodeControlの入力契約を満たす。
 * @postcondition decodeControlの責務を完了した結果だけを返す。
 * @effect N/A: decodeControlは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure decodeControlは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant decodeControlは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: decodeControlはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: decodeControlは共有非同期状態を持たない同期処理である。
 */
function decodeControl(bytes: Buffer): string {
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (/\0|\r(?!\n)/u.test(source))
    throw new Error("fixed_revision_file_invalid");
  return source.replace(/\r?\n$/u, "");
}

/**
 * Packedを読み取る。
 *
 * @responsibility Packedの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000002
 * @input commonDirectory: string、ref: string
 * @returns stringを返す。
 * @precondition 「commonDirectory: string、ref: string」がreadPackedの入力契約を満たす。
 * @postcondition readPackedの責務を完了した結果だけを返す。
 * @effect packed-refsを有界で読み取る。書込みは行わない。
 * @failure readPackedは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readPackedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: readPackedはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readPackedは共有非同期状態を持たない同期処理である。
 */
function readPacked(commonDirectory: string, ref: string): string {
  const matches = decodeControl(
    stableFile(
      path.join(commonDirectory, "packed-refs"),
      MAX_PACKED_REFS_BYTES,
    ),
  )
    .split("\n")
    .filter((line) => !line.startsWith("#") && !line.startsWith("^"))
    .map((line) => line.split(" "))
    .filter((parts) => parts.length === 2 && parts[1] === ref);
  if (matches.length !== 1 || !OBJECT_ID.test(matches[0]?.[0] ?? ""))
    throw new Error("fixed_revision_ref_invalid");
  return matches[0]?.[0] as string;
}

/**
 * Revisionを読み取る。
 *
 * @responsibility Revisionの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000002
 * @input layout: RepositoryGitLayout
 * @returns stringを返す。
 * @precondition 「layout: RepositoryGitLayout」がreadRevisionの入力契約を満たす。
 * @postcondition readRevisionの責務を完了した結果だけを返す。
 * @effect HEADとRefを有界で読み取る。書込みは行わない。
 * @failure readRevisionは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: readRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readRevisionは共有非同期状態を持たない同期処理である。
 */
function readRevision(layout: RepositoryGitLayout): string {
  const head = decodeControl(
    stableFile(path.join(layout.gitDirectory.realPath, "HEAD"), MAX_HEAD_BYTES),
  );
  if (OBJECT_ID.test(head)) return head;
  if (!head.startsWith("ref: ")) throw new Error("fixed_revision_head_invalid");
  const ref = head.slice(5);
  if (
    !SAFE_REF.test(ref) ||
    ref.includes("..") ||
    ref.includes("//") ||
    ref.endsWith("/")
  )
    throw new Error("fixed_revision_ref_invalid");
  try {
    const revision = decodeControl(
      stableFile(
        path.join(layout.commonDirectory.realPath, ...ref.split("/")),
        MAX_HEAD_BYTES,
      ),
    );
    if (!OBJECT_ID.test(revision))
      throw new Error("fixed_revision_ref_invalid");
    return revision;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
    return readPacked(layout.commonDirectory.realPath, ref);
  }
}

/**
 * identityを決定する。
 *
 * @responsibility identityの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000002
 * @input domain: string、entity: RepositoryGitLayout["root"]
 * @returns stringを返す。
 * @precondition 「domain: string、entity: RepositoryGitLayout["root"]」がidentityの入力契約を満たす。
 * @postcondition identityの責務を完了した結果だけを返す。
 * @effect N/A: identityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: identityは独自の失敗分岐を所有しない。
 * @invariant identityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: identityはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: identityは共有非同期状態を持たない同期処理である。
 */
function identity(domain: string, entity: RepositoryGitLayout["root"]): string {
  return createHash("sha256")
    .update(domain)
    .update("\0")
    .update(entity.identity.dev.toString())
    .update("\0")
    .update(entity.identity.ino.toString())
    .update("\0")
    .update(entity.identity.birthtimeNs.toString())
    .digest("hex");
}

export const gitRepositoryRevisionAdapter: RepositoryRevisionAdapter = (
  repositoryRoot,
) => {
  try {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const revision = readRevision(layout);
    const repositoryForm =
      layout.kind === "normal_worktree"
        ? ("primary" as const)
        : layout.kind === "linked_worktree"
          ? ("linked" as const)
          : ("embedded" as const);
    return Object.freeze({
      repositoryIdentity: identity(
        "crdd-logical-repository-v1",
        layout.commonDirectory,
      ),
      repositoryInstanceIdentity: identity(
        "crdd-repository-instance-v1",
        layout.root,
      ),
      repositoryForm,
      revisionIdentity: revision,
      objectFormat: "sha1" as const,
      observationComplete: true as const,
      repositoryPathReported: false as const,
    });
  } catch {
    return null;
  }
};

/**
 * 保存先に結合するRepository実体だけを観測する。
 * @responsibility 未Commitの新品Repositoryと改訂の観測不能を混同しない。
 * @trace ARCH-000002
 * @input capability: 検証済みRoot。
 * @returns 論理・実体Identityと配置種別、又はnull。
 * @precondition 呼出し側は保存用途に限り、実行対象Commitは別途検証する。
 * @postcondition HEADを推測せず、前後で同じRootとGit管理実体を確認する。
 * @effect Git配置とFilesystem実体の読取りだけ。
 * @failure 不正配置、実体変更、観測不能はnull。
 * @invariant 成功をRevision観測や実行Authorityへ昇格しない。
 * @boundary 保存Rootの結合とVersion Control。
 * @security 任意PathやGit管理情報を書き換えない。
 * @concurrency 更新排他は呼出し側が保持する。
 */
export function observeRepositoryStorageIdentity(
  capability: VerifiedRepositoryRoot,
) {
  try {
    const initial = observeVerifiedRepositoryLayout(capability);
    if (initial === null) return null;
    const before = initial.layout;
    const value = {
      repositoryIdentity: identity(
        "crdd-logical-repository-v1",
        before.commonDirectory,
      ),
      repositoryInstanceIdentity: identity(
        "crdd-repository-instance-v1",
        before.root,
      ),
      repositoryForm:
        before.kind === "normal_worktree"
          ? "primary"
          : before.kind === "linked_worktree"
            ? "linked"
            : "embedded",
    };
    const final = observeVerifiedRepositoryLayout(capability);
    if (final === null) return null;
    const after = final.layout;
    return final.root === initial.root &&
      before.kind === after.kind &&
      value.repositoryIdentity ===
        identity("crdd-logical-repository-v1", after.commonDirectory) &&
      value.repositoryInstanceIdentity ===
        identity("crdd-repository-instance-v1", after.root)
      ? Object.freeze(value)
      : null;
  } catch {
    return null;
  }
}

export const gitRepositoryFormatAdapter: RepositoryFormatAdapter = (
  repositoryRoot,
) => {
  const result = inspectRepositoryGitObjectFormatCandidate(repositoryRoot);
  return result?.status === "candidate"
    ? Object.freeze({ objectFormat: result.objectFormat })
    : null;
};

export const gitFixedRevisionIdentityAdapter: FixedRevisionIdentityAdapter = (
  repositoryRoot,
) => {
  const current = gitRepositoryRevisionAdapter(repositoryRoot);
  if (!current) return null;
  const layout = resolveRepositoryGitLayout(repositoryRoot);
  const snapshot = inspectGitCommitTreeCandidate({
    commonDirectory: layout.commonDirectory.realPath,
    revision: current.revisionIdentity,
  });
  return snapshot?.status === "candidate" &&
    snapshot.commit === current.revisionIdentity
    ? Object.freeze({
        contract: "crdd-version-control/fixed-revision-identity/v1" as const,
        contractRevision: 1 as const,
        status: "observed" as const,
        ...current,
        snapshotIdentity: snapshot.tree,
      })
    : null;
};

/**
 * repository-revisionで使用するRepository Revision Observationの値契約を定義する。
 *
 * @responsibility Repository Revision ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape RepositoryRevisionObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRevisionObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRevisionObservationの宣言は外部境界を開かない。
 * @security N/A: RepositoryRevisionObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRevisionObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryRevisionObservation = Readonly<{
  repositoryIdentity: string;
  repositoryInstanceIdentity: string;
  repositoryForm: "primary" | "linked" | "embedded";
  revisionIdentity: string;
  objectFormat: "sha1";
  observationComplete: true;
  repositoryPathReported: false;
}>;

/**
 * repository-revisionで使用するRepository Revision Adapterの値契約を定義する。
 *
 * @responsibility Repository Revision AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape RepositoryRevisionAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryRevisionAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryRevisionAdapterの宣言は外部境界を開かない。
 * @security N/A: RepositoryRevisionAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryRevisionAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryRevisionAdapter = (
  repositoryRoot: string,
) => RepositoryRevisionObservation | null;

/**
 * repository-revisionで使用するRepository Format Adapterの値契約を定義する。
 *
 * @responsibility Repository Format AdapterのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000002
 * @shape RepositoryFormatAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RepositoryFormatAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: RepositoryFormatAdapterの宣言は外部境界を開かない。
 * @security N/A: RepositoryFormatAdapterはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RepositoryFormatAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RepositoryFormatAdapter = (
  repositoryRoot: string,
) => Readonly<{ objectFormat: "sha1" | "sha256" }> | null;

/**
 * Repository Revisionを観測する。
 *
 * @responsibility Repository Revisionの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input capability: VerifiedRepositoryRoot、adapter: RepositoryRevisionAdapter
 * @returns RepositoryRevisionObservation | nullを返す。
 * @precondition 「capability: VerifiedRepositoryRoot、adapter: RepositoryRevisionAdapter」がobserveRepositoryRevisionの入力契約を満たす。
 * @postcondition observeRepositoryRevisionの責務を完了した結果だけを返す。
 * @effect 指定AdapterへRepositoryの改訂または形式の観測を委譲する。
 * @failure N/A: observeRepositoryRevisionは独自の失敗分岐を所有しない。
 * @invariant observeRepositoryRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 指定Adapterの外部観測と型付き観測結果の境界。
 * @security observeRepositoryRevisionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeRepositoryRevisionは共有非同期状態を持たない同期処理である。
 */
export function observeRepositoryRevision(
  capability: VerifiedRepositoryRoot,
  adapter: RepositoryRevisionAdapter,
): RepositoryRevisionObservation | null {
  const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
  return repositoryRoot === null ? null : adapter(repositoryRoot);
}

/**
 * Repository Formatを観測する。
 *
 * @responsibility Repository Formatの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000002
 * @input repositoryRoot: unknown、adapter: RepositoryFormatAdapter
 * @returns inspectRepositoryFormatの計算結果を返す。
 * @precondition 「repositoryRoot: unknown、adapter: RepositoryFormatAdapter」がinspectRepositoryFormatの入力契約を満たす。
 * @postcondition inspectRepositoryFormatの責務を完了した結果だけを返す。
 * @effect 指定AdapterへRepositoryの改訂または形式の観測を委譲する。
 * @failure N/A: inspectRepositoryFormatは独自の失敗分岐を所有しない。
 * @invariant inspectRepositoryFormatは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 指定Adapterの外部観測と型付き観測結果の境界。
 * @security N/A: inspectRepositoryFormatはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectRepositoryFormatは共有非同期状態を持たない同期処理である。
 */
export function inspectRepositoryFormat(
  repositoryRoot: unknown,
  adapter: RepositoryFormatAdapter,
) {
  return typeof repositoryRoot === "string" ? adapter(repositoryRoot) : null;
}

/**
 * Repository実体と現在HEADの候補を観測する。
 * @responsibility Git読取りからIdentity候補を作り、観測不能と相関差を拒否する。
 * @trace ARCH-000002
 * @input repositoryRoot: 通常またはLinked WorktreeのRoot。
 * @returns Logical／Instance／Revisionの候補値。
 * @precondition 入力を信頼済みPathと仮定しない。
 * @postcondition 観測だけで書込み許可または実行Authorityを与えない。
 * @effect 固定Git管理情報・Commit・TreeをFilesystemから読取る。外部Git CLIを起動しない。
 * @failure 不正Root、欠測、破損、観測不能または読取り間の差はnull（内部helperは例外）となる。
 * @invariant 異なるRepository実体や改訂の観測を一つのIdentityへ補完しない。
 * @boundary Git管理情報とProcess内の読取り候補の境界。
 * @security Rootの絶対Pathを返却せず、Hook・外部Diff・書込み操作を発行しない。
 * @concurrency 同期読取り。呼出し側のLockや実行排他を新設しない。
 */
function observeRepositoryCandidateIdentity(repositoryRoot: string) {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("repository_root_invalid");
  const observed = observeRepositoryRevision(
    verified.capability,
    gitRepositoryRevisionAdapter,
  );
  if (!observed) throw new Error("repository_revision_invalid");
  return Object.freeze({
    repositoryKind: observed.repositoryForm,
    logicalRepositoryIdentity: observed.repositoryIdentity,
    repositoryInstanceIdentity: observed.repositoryInstanceIdentity,
    revision: observed.revisionIdentity,
  });
}

/**
 * 現在HEADとCommit Treeを読取り専用候補として観測する。
 * @responsibility Git読取りからIdentity候補を作り、観測不能と相関差を拒否する。
 * @trace ARCH-000002
 * @input repositoryRoot: 未検証のRoot候補。
 * @returns 固定HEAD／Tree候補。不正または観測不能時はnull。
 * @precondition 入力を信頼済みPathと仮定しない。
 * @postcondition 観測だけで書込み許可または実行Authorityを与えない。
 * @effect 固定Git管理情報・Commit・TreeをFilesystemから読取る。外部Git CLIを起動しない。
 * @failure 不正Root、欠測、破損、観測不能または読取り間の差はnull（内部helperは例外）となる。
 * @invariant 異なるRepository実体や改訂の観測を一つのIdentityへ補完しない。
 * @boundary Git管理情報とProcess内の読取り候補の境界。
 * @security Rootの絶対Pathを返却せず、Hook・外部Diff・書込み操作を発行しない。
 * @concurrency 同期読取り。呼出し側のLockや実行排他を新設しない。
 */
export function inspectRepositoryRevisionCandidate(repositoryRoot: unknown) {
  try {
    if (
      typeof repositoryRoot !== "string" ||
      !path.isAbsolute(repositoryRoot) ||
      repositoryRoot.length > 4_096 ||
      /[\0-\x1f\x7f]/u.test(repositoryRoot)
    ) {
      return null;
    }
    const verified = verifyRepositoryRoot(repositoryRoot);
    if (verified.status !== "completed") return null;
    const identity = observeFixedRevisionIdentity(
      verified.capability,
      gitFixedRevisionIdentityAdapter,
    );
    return identity
      ? Object.freeze({
          status: "candidate" as const,
          commit: identity.revisionIdentity,
          tree: identity.snapshotIdentity,
          repositoryKind: identity.repositoryForm,
          externalGitCliUsed: false,
          repositoryPathReported: false,
        })
      : null;
  } catch {
    return null;
  }
}

/**
 * 前後のRepository実体とHEAD／Treeが一致するIdentity候補を返す。
 * @responsibility Git読取りからIdentity候補を作り、観測不能と相関差を拒否する。
 * @trace ARCH-000002
 * @input repositoryRoot: 未検証のRoot候補。
 * @returns 同じ実体・改訂に結合した候補、またはnull。
 * @precondition 入力を信頼済みPathと仮定しない。
 * @postcondition 観測だけで書込み許可または実行Authorityを与えない。
 * @effect 固定Git管理情報・Commit・TreeをFilesystemから読取る。外部Git CLIを起動しない。
 * @failure 不正Root、欠測、破損、観測不能または読取り間の差はnull（内部helperは例外）となる。
 * @invariant 異なるRepository実体や改訂の観測を一つのIdentityへ補完しない。
 * @boundary Git管理情報とProcess内の読取り候補の境界。
 * @security Rootの絶対Pathを返却せず、Hook・外部Diff・書込み操作を発行しない。
 * @concurrency 同期読取り。呼出し側のLockや実行排他を新設しない。
 */
export function inspectRepositoryIdentityCandidate(repositoryRoot: unknown) {
  try {
    if (typeof repositoryRoot !== "string") return null;
    const before = observeRepositoryCandidateIdentity(repositoryRoot);
    const revision = inspectRepositoryRevisionCandidate(repositoryRoot);
    const after = observeRepositoryCandidateIdentity(repositoryRoot);
    if (
      !revision ||
      revision.commit !== before.revision ||
      JSON.stringify(before) !== JSON.stringify(after)
    )
      return null;
    return Object.freeze({ ...before, ...revision });
  } catch {
    return null;
  }
}

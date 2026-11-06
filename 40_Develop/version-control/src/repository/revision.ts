/**
 * 現在Revision・形式と固定Identityの契約・Git読取りを所有する。
 * @responsibility 現在Revision・形式と固定Identityの契約・Git読取りを所有する。
 * @trace ARCH-000002
 */
import { executeGit } from "../git/execute.ts";
import { readReference } from "./reference.ts";
import type { ReferenceResult } from "./types.ts";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { inspectGitCommitTreeCandidate } from "../git/objects.ts";
import {
  inspectRepositoryGitObjectFormatCandidate,
  type RepositoryGitLayout,
  resolveRepositoryGitLayout,
} from "./layout.ts";
import {
  observeVerifiedRepositoryLayout,
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "./location.ts";

export const FIXED_REVISION_IDENTITY_CONTRACT =
  "crdd-version-control/fixed-revision-identity/v1";

export const FIXED_REVISION_IDENTITY_CONTRACT_REVISION = 1;

const MAX_HEAD_BYTES = 4_096;
const MAX_PACKED_REFS_BYTES = 4 * 1024 * 1024;
const OBJECT_ID = /^[a-f0-9]{40}$/u;
const SAFE_REF = /^refs\/(?:heads|tags)\/[A-Za-z0-9._/-]{1,1024}$/u;

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
 * 同じRepository実体の現在Commit・TreeとIdentityを一度の完成観測として返す。
 * @responsibility 前後の実体・HEADと中央のCommit／Treeを照合し、混在と観測不能を拒否する。
 * @trace ARCH-000002
 * @effect Git管理情報とObjectの有界読取りのみ。書込み・Git Process起動なし。
 * @failure 未Commit、不正原本、欠測Object、途中変更はnull。
 * @security Pathを返さず、観測を操作許可へ昇格しない。
 */
export function readRepositorySnapshot(
  capability: Repository | null,
): FixedRevisionIdentity | null {
  try {
    if (capability === null) return null;
    const initial = observeVerifiedRepositoryLayout(capability);
    if (initial === null) return null;
    const before = readRootRevision(initial.root);
    if (before?.objectFormat !== "sha1") return null;
    const snapshot = inspectGitCommitTreeCandidate({
      commonDirectory: initial.layout.commonDirectory.realPath,
      revision: before.revisionIdentity,
    });
    const after = readRootRevision(initial.root);
    const final = observeVerifiedRepositoryLayout(capability);
    if (
      snapshot?.status !== "candidate" ||
      snapshot.commit !== before.revisionIdentity ||
      JSON.stringify(before) !== JSON.stringify(after) ||
      final === null ||
      final.root !== initial.root ||
      final.layout.kind !== initial.layout.kind ||
      before.repositoryIdentity !==
        identity(
          "crdd-logical-repository-v1",
          initial.layout.commonDirectory,
        ) ||
      before.repositoryInstanceIdentity !==
        identity("crdd-repository-instance-v1", initial.layout.root) ||
      before.repositoryIdentity !==
        identity("crdd-logical-repository-v1", final.layout.commonDirectory) ||
      before.repositoryInstanceIdentity !==
        identity("crdd-repository-instance-v1", final.layout.root)
    )
      return null;
    return Object.freeze({
      contract: FIXED_REVISION_IDENTITY_CONTRACT,
      contractRevision: FIXED_REVISION_IDENTITY_CONTRACT_REVISION,
      status: "observed",
      ...before,
      objectFormat: before.objectFormat,
      snapshotIdentity: snapshot.tree,
    });
  } catch {
    return null;
  }
}

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

/** Git管理領域からHEADを読み、共有RepositoryとWorktreeの実体Identityを対応付ける。
 * @responsibility Main／LinkedのHEADと共有Object領域を混同せずに観測する。
 * @trace ARCH-000002
 */
function readRootRevision(
  repositoryRoot: string,
  selector?: string,
): RepositoryRevisionObservation | null {
  try {
    const layout = resolveRepositoryGitLayout(repositoryRoot);
    const revision =
      selector === undefined
        ? readRevision(layout)
        : readSelectedRevision(repositoryRoot, selector);
    if (revision === null) return null;
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
      objectFormat:
        revision.length === 64 ? ("sha256" as const) : ("sha1" as const),
      observationComplete: true as const,
      repositoryPathReported: false as const,
    });
  } catch {
    return null;
  }
}

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
export function readRepositoryStorageIdentity(capability: Repository) {
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
  objectFormat: "sha1" | "sha256";
  observationComplete: true;
  repositoryPathReported: false;
}>;

/**
 * 検証済みRepositoryの現在HEADと技術的Identityを読み取る。
 * @responsibility Git実装を固定し、読取り対象の原本確認とRevision観測を一つの完成操作で行う。
 * @trace ARCH-000002
 * @effect Git管理領域の読取りのみ。外部Process・書込みなし。
 * @failure 不正Root、未Commit、破損または観測不能はnull。
 * @security 絶対Pathや生のGit診断を返さない。
 */
export function readRepositoryRevision(
  capability: Repository | null,
  request: Readonly<{ revision: string }>,
): RepositoryRevisionObservation | null;
export function readRepositoryRevision(
  capability: Repository | null,
): RepositoryRevisionObservation | null;
export function readRepositoryRevision(
  capability: Repository,
  request: Readonly<{ reference: string }>,
): ReferenceResult;
export function readRepositoryRevision(
  capability: Repository | null,
  request?: Readonly<{ reference: string }> | Readonly<{ revision: string }>,
): RepositoryRevisionObservation | ReferenceResult | null {
  if (request !== undefined && "reference" in request) {
    if (capability === null) throw Error("verified_repository_root_required");
    return readReference(capability, request.reference);
  }
  const root =
    capability === null ? null : resolveVerifiedRepositoryRoot(capability);
  return root === null
    ? null
    : readRootRevision(
        root,
        request && "revision" in request ? request.revision : undefined,
      );
}

/** 検証済みRepositoryのObject形式を読み取る。未CommitのRepositoryも対象とする。 */
export function readRepositoryFormat(
  capability: Repository | null,
): Readonly<{ objectFormat: "sha1" | "sha256" }> | null {
  const root =
    capability === null ? null : resolveVerifiedRepositoryRoot(capability);
  if (root === null) return null;
  const result = inspectRepositoryGitObjectFormatCandidate(root);
  return result?.status === "candidate"
    ? Object.freeze({ objectFormat: result.objectFormat })
    : null;
}

/** 固定selectorを同じGit実行条件でOIDへ読む。解析・文字列置換を上位へ分散させない。 */
function readSelectedRevision(root: string, selector: string): string | null {
  if (
    typeof selector !== "string" ||
    selector.length === 0 ||
    selector.length > 1024 ||
    /[\x00-\x1f\x7f]/u.test(selector) ||
    selector.startsWith("-")
  )
    return null;
  const result = executeGit(root, ["rev-parse", "--verify", selector], {
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.signal || result.status !== 0) return null;
  const value = result.stdout.toString("utf8").trim().toLowerCase();
  return /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value) ? value : null;
}

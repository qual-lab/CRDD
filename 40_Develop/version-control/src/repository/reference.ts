/**
 * 上位が指定したGit Referenceを期待値付きで作成・削除する。
 * @responsibility 共有の直接Branch Ref（refs/heads/）の文法・実体・使用状態・CASと読戻し。命名と保持判断は所有しない。
 * @trace ARCH-000009
 * @boundary ローカルGitのみ。業務ID、新しいRegistry・Store・自動再送を持たない。
 */
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { cleanCommitTemporary } from "./commit.ts";
import { createWorktreeGitContext } from "../worktree/crud.ts";
import path from "node:path";
import { executeGit } from "../git/execute.ts";
import {
  isBranchName,
  observeBranchCommit,
  type ObservedBranchCommit,
} from "../git/read.ts";
import { resolveRepositoryGitLayout, type EntitySnapshot } from "./layout.ts";
import {
  observeVerifiedRepositoryLayout,
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "./location.ts";
import { readWorktreeCreationDirty } from "./working-directory.ts";
import type {
  ReferenceCreateRequest,
  ReferenceRemoveRequest,
  ReferenceResult,
} from "./types.ts";

/** 通常Fileとして存在するRef祖先だけを許し、packed Refの不存在とは区別する。 @trace ARCH-000009 */
function assertReferencePath(root: string, name: string) {
  let cursor = resolveRepositoryGitLayout(root).commonDirectory.realPath;
  const parts = name.split("/");
  for (const [i, part] of parts.entries()) {
    cursor = path.join(cursor, part);
    try {
      const info = fs.lstatSync(cursor);
      if (
        info.isSymbolicLink() ||
        (i < parts.length - 1
          ? !info.isDirectory()
          : !info.isFile() || info.nlink !== 1)
      )
        throw Error("reference_path_invalid");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") break;
      throw error;
    }
  }
}

/** 直接BranchのOIDとCommit種別を一緒に読み、同じRepositoryの作成基準を返す。 @trace ARCH-000009 */
export function readBranchHead(
  repository: Repository,
  branch: string,
): ObservedBranchCommit | null {
  return observeRepositoryBranchHead(repository, branch, null);
}

/** 作成受付の状態・基準を取り、読取りとcheckoutのfilter設定を一度に照合する。 @trace ARCH-000009 */
export function readWorktreeCreationSource(
  repository: Repository,
  branch: string,
) {
  const before = observeVerifiedRepositoryLayout(repository, true)?.layout
    .configSnapshot;
  const dirty = readWorktreeCreationDirty(repository);
  const after = observeVerifiedRepositoryLayout(repository, true)?.layout
    .configSnapshot;
  return {
    dirty,
    observedBase: observeRepositoryBranchHead(
      repository,
      branch,
      before?.contentSha256 && isDeepStrictEqual(before, after) ? before : null,
    ),
  };
}

/** checkout観測済みの扱いは同じVC受付の中だけで有効化する。 @trace ARCH-000009 */
function observeRepositoryBranchHead(
  repository: Repository,
  branch: string,
  checkedConfiguration: EntitySnapshot | null,
): ObservedBranchCommit | null {
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null || !isBranchName(branch) || branch.length > 1013)
    return null;
  const name = `refs/heads/${branch}`;
  try {
    assertReferencePath(root, name);
    return observeBranchCommit(
      repository,
      name,
      (args) => {
        const result = executeGit(root, args, {
          maxBuffer: 4 * 1024 * 1024,
          timeout: 30_000,
        });
        if (result.error || result.signal)
          throw Error("reference_observation_unknown");
        return {
          status: result.status,
          stdout: result.stdout.toString("utf8"),
          stderr: result.stderr.toString("utf8"),
        };
      },
      checkedConfiguration,
    );
  } catch {
    return null;
  }
}

/**
 * 作成／削除を同じ対象照合・Git CAS・読戻しで実行する。
 * @responsibility 既存Refの上書き、Symbolic Ref経由、checkout中Branchの削除を拒否する。
 * @trace ARCH-000009
 * @input 検証済みRepository、exact Ref名・Commit ID、作成か削除か。
 * @returns 実体観測、Effect発行と確認を区別した結果。
 * @precondition 上位が現在の実行許可・排他・保持判断を成立させている。
 * @postcondition 完了は期待OID又は明示不存在を読戻した後だけ返す。
 * @effect 固定update-refのCAS。Git標準Lock以外の管理機構を作らない。
 * @failure 不正入力は発行前拒否、発行後の観測不能はunknownで停止する。
 * @invariant 任意の上書き・Force・Object削除・再送を行わない。
 * @security Ref祖先のlinkと別Commitへの差替えを処置対象にしない。
 * @concurrency 期待不存在／期待OIDをGitへ渡す。非協調Filesystem差替えの原子性は主張しない。
 */
function changeReference(
  repository: Repository,
  name: string,
  commitId: string | null,
  create: boolean | null,
): ReferenceResult {
  const root = resolveVerifiedRepositoryRoot(repository);
  if (root === null) throw Error("verified_repository_root_required");
  if (
    typeof name !== "string" ||
    name.length > 1024 ||
    !name.startsWith("refs/heads/") ||
    /[\u0000-\u0020\u007f]/u.test(name) ||
    (commitId !== null &&
      (typeof commitId !== "string" ||
        !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(commitId))) ||
    (create === true && commitId === null)
  )
    throw Error("reference_input_invalid");
  let effectIssued = false,
    effectConfirmed = false;
  let present: boolean | null = null;
  let status: ReferenceResult["status"] = "blocked",
    reason = "reference_not_started";
  const deadline = performance.now() + 30_000;
  const run = (args: readonly string[]) => {
    const timeout = Math.ceil(deadline - performance.now());
    if (timeout <= 0) throw Error("reference_deadline_exceeded");
    const result = executeGit(root, args, {
      maxBuffer: 4 * 1024 * 1024,
      timeout,
    });
    if (result.error || result.signal)
      throw Error("reference_observation_unknown");
    return result;
  };
  const read = (): string | null => {
    const symbolic = run(["symbolic-ref", "--quiet", name]);
    if (symbolic.status !== 1 || symbolic.stdout.length !== 0)
      throw Error("reference_not_direct");
    const observed = run(["rev-parse", "--verify", "--quiet", name]);
    if (observed.status === 1 && observed.stdout.length === 0) {
      present = false;
      return null;
    }
    const value = observed.stdout.toString("utf8").trim();
    if (
      observed.status !== 0 ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u.test(value)
    )
      throw Error("reference_observation_unknown");
    present = true;
    return value;
  };
  try {
    if (run(["check-ref-format", name]).status !== 0)
      throw Error("reference_name_invalid");
    assertReferencePath(root, name);
    const previous = read();
    if (create === null) {
      commitId = previous;
      status = "completed";
      reason = previous === null ? "reference_absent" : "reference_observed";
    } else {
      if (previous !== null && previous !== commitId)
        throw Error("reference_commit_changed");
      if ((create && previous === commitId) || (!create && previous === null)) {
        status = "completed";
        reason = create
          ? "reference_already_created"
          : "reference_already_absent";
      } else {
        if (commitId === null) throw Error("reference_commit_changed");
        if (create) {
          const object = run(["cat-file", "-t", commitId]);
          if (
            object.status !== 0 ||
            object.stdout.toString("utf8").trim() !== "commit"
          )
            throw Error("reference_commit_unavailable");
        } else {
          const trees = run(["worktree", "list", "--porcelain", "-z"]);
          const text = new TextDecoder("utf8", { fatal: true }).decode(
            trees.stdout,
          );
          if (
            trees.status !== 0 ||
            !text.startsWith("worktree ") ||
            !text.endsWith("\0")
          )
            throw Error("reference_worktree_observation_unavailable");
          if (text.split("\0").includes(`branch ${name}`))
            throw Error("reference_checked_out");
        }
        // 対象RootをEffect直前にも検証する。上位への逆照会は追加しない。
        if (resolveVerifiedRepositoryRoot(repository) !== root)
          throw Error("reference_repository_changed");
        effectIssued = true;
        present = null;
        const updated = run(
          create
            ? [
                "update-ref",
                "--no-deref",
                name,
                commitId,
                "0".repeat(commitId.length),
              ]
            : ["update-ref", "--no-deref", "-d", name, commitId],
        );
        if (updated.status !== 0) throw Error("reference_update_rejected");
        const current = read();
        if (create ? current !== commitId : current !== null)
          throw Error("reference_result_unconfirmed");
        effectConfirmed = true;
        status = "completed";
        reason = create ? "reference_created" : "reference_removed";
      }
    }
  } catch (error) {
    reason =
      error instanceof Error && /^reference_[a-z_]+$/u.test(error.message)
        ? error.message
        : "reference_observation_unknown";
    status = effectIssued ? "unknown" : "blocked";
  }
  return Object.freeze({
    status,
    reason,
    name,
    commitId,
    effectIssued,
    effectConfirmed,
    present,
    cleanupConfirmed: true,
    temporary: null,
  });
}

/** 上位指定名へ期待不存在のCASでCommitを結び付ける。既存の同値は実観測後に完了する。 */
export function createReference(
  repository: Repository,
  request: ReferenceCreateRequest,
): ReferenceResult {
  return changeReference(repository, request.name, request.commitId, true);
}

/** 期待Commit付きでRefを削除する。指定された自己生成一時Indexは先に照合・回収する。Commit ObjectとWorktreeは削除しない。 */
export function removeReference(
  repository: Repository,
  request: ReferenceRemoveRequest,
): ReferenceResult {
  if (request.temporaryIndex) {
    const observed = readReference(repository, request.name);
    if (observed.status !== "completed")
      return {
        ...observed,
        cleanupConfirmed: false,
        temporary: request.temporaryIndex.value,
      };
    if (observed.present && observed.commitId !== request.expectedCommitId)
      return {
        ...observed,
        status: "blocked",
        reason: "reference_commit_changed",
        cleanupConfirmed: false,
        temporary: request.temporaryIndex.value,
      };
    try {
      cleanCommitTemporary(
        createWorktreeGitContext(repository),
        request.temporaryIndex.directory,
        request.temporaryIndex.value,
      );
    } catch {
      return {
        ...observed,
        status: "blocked",
        reason: "reference_temporary_cleanup_unconfirmed",
        cleanupConfirmed: false,
        temporary: request.temporaryIndex.value,
      };
    }
  }
  return changeReference(
    repository,
    request.name,
    request.expectedCommitId,
    false,
  );
}

/** 同じ対象照合で読取りだけを行い、明示不存在と観測不能を分ける。内部接続。 */
export function readReference(
  repository: Repository,
  name: string,
): ReferenceResult {
  return changeReference(repository, name, null, null);
}

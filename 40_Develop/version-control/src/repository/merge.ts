/**
 * 現在Worktreeへ固定CommitをMergeし、親順序・Tree・途中状態を確認する。
 * @responsibility 業務採否やRef命名を持たずGit標準Mergeの技術結果だけを返す。
 * @trace ARCH-000009
 */
import fs from "node:fs";
import path from "node:path";
import { createWorktreeGitContext } from "../worktree/crud.ts";
import { resolveRepositoryGitLayout } from "./layout.ts";
import { temporaryIdentity, isCommitId } from "./commit.ts";
import type { Repository } from "./location.ts";
import type { CommitMergeRequest, CommitMergeResult } from "./types.ts";

/** 同一の固定Commitを現在WorktreeのHEADへ二親Mergeする。自動abortや再送はしない。 */
export function mergeCommit(
  repository: Repository,
  request: CommitMergeRequest,
): CommitMergeResult {
  const result: {
    status: "completed" | "blocked";
    reason: string;
    sourceCommit: string;
    commitId: string | null;
    effectIssued: boolean;
  } = {
    status: "blocked",
    reason: "commit_merge_input_invalid",
    sourceCommit: request.sourceCommit,
    commitId: null,
    effectIssued: false,
  };
  try {
    if (
      !isCommitId(request.baseCommit) ||
      typeof request.message !== "string" ||
      !request.message.trim() ||
      request.message.length > 4096 ||
      /[\x00\x7f]/u.test(request.message)
    )
      throw Error("commit_merge_input_invalid");
    const ctx = createWorktreeGitContext(repository);
    const drivers = ctx.run(ctx.target, [
      "config",
      "--includes",
      "--null",
      "--name-only",
      "--get-regexp",
      "^merge\\..*\\.driver$",
    ]);
    if (drivers.status !== 1 || drivers.stdout !== "")
      throw Error("commit_merge_driver_unsupported");
    const target = {
      sourceCommit: request.sourceCommit,
      targetBranch: request.targetBranch,
      expectedTargetHead: request.expectedHead,
    };
    if (
      !isCommitId(target.sourceCommit) ||
      !isCommitId(target.expectedTargetHead) ||
      target.sourceCommit.length !== request.baseCommit.length ||
      target.expectedTargetHead.length !== request.baseCommit.length ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(target.targetBranch)
    )
      throw new Error("commit_merge_target_invalid");

    /**
     * 取込先を所属Rootへ固定してGit要求を送る。
     * @responsibility Worktreeや親環境による対象差替えを避ける。
     * @trace ARCH-000009
     * @input args: 内部で構築した引数列。
     * @returns 終了値と有界出力。
     * @precondition Rootはcontext検証済み。
     * @postcondition 非0を呼出し元へ保持。
     * @effect 引数で明示したローカルGit操作。
     * @failure 起動・応答不明はthrow。
     * @invariant Shell・外部送信なし。
     * @boundary 実Git。
     * @security hook／親Git環境を遮断。
     * @concurrency 既存採用Lease下。
     */
    const run = (args: string[]) => ctx.run(ctx.target, args);
    /**
     * 同じ固定二Commitから期待Merge Treeを再計算する。
     * @responsibility 初回と再入場の内容判定を共用する。
     * @trace ARCH-000009
     * @input N/A: 検証済みtargetと候補を閉包する。
     * @returns Git標準3-way計算のTree OID。
     * @precondition Commit Identityは検証済み。
     * @postcondition Working Tree／Refは更新しない。
     * @effect Git Object生成要求はあり得る。
     * @failure 競合と観測不能を分けて停止。
     * @invariant Tree一致を認可にしない。
     * @boundary 実Git。
     * @security 外部merge driverを使わない。
     * @concurrency 固定OIDを参照。
     */
    const expectedMergeTree = () => {
      result.effectIssued = true;
      const preview = run([
        "merge-tree",
        "--write-tree",
        target.expectedTargetHead,
        target.sourceCommit,
      ]);
      if (preview.status === 1) throw new Error("commit_merge_conflict");
      if (preview.status !== 0 || !isCommitId(preview.stdout.trim()))
        throw new Error("commit_merge_preview_unavailable");
      return preview.stdout.trim();
    };
    const branch = run(["symbolic-ref", "--quiet", "HEAD"]);
    if (
      branch.status !== 0 ||
      branch.stdout.trim() !== `refs/heads/${target.targetBranch}`
    )
      throw new Error("commit_merge_target_mismatch");
    const head = run(["rev-parse", "--verify", "HEAD"]);
    if (head.status !== 0 || !isCommitId(head.stdout.trim()))
      throw new Error("commit_merge_target_unavailable");
    const current = head.stdout.trim();
    const parents = run(["rev-list", "--parents", "-n", "1", current]);
    if (parents.status !== 0)
      throw new Error("commit_merge_target_unavailable");
    if (
      parents.stdout.trim() ===
      `${current} ${target.expectedTargetHead} ${target.sourceCommit}`
    ) {
      const expected = expectedMergeTree();
      const actual = run(["rev-parse", `${current}^{tree}`]);
      if (actual.status !== 0 || actual.stdout.trim() !== expected)
        throw new Error("commit_merge_tree_mismatch");
      result.commitId = current;
      result.reason = "commit_merge_existing_confirmed";
      return { ...result, status: "completed" };
    }
    if (current !== target.expectedTargetHead)
      throw new Error("commit_merge_target_changed");
    const baseIncluded = run([
      "merge-base",
      "--is-ancestor",
      request.baseCommit,
      current,
    ]);
    if (baseIncluded.status === 1)
      throw new Error("commit_merge_base_not_integrated");
    if (baseIncluded.status !== 0)
      throw new Error("commit_merge_ancestry_unavailable");
    const ancestor = run([
      "merge-base",
      "--is-ancestor",
      target.sourceCommit,
      current,
    ]);
    if (ancestor.status === 0) {
      result.reason = "commit_merge_already_integrated";
      return { ...result, status: "completed" };
    }
    if (ancestor.status !== 1)
      throw new Error("commit_merge_ancestry_unavailable");
    const inProgress = readCommitMergeHead(ctx.target);
    const resuming = inProgress === target.sourceCommit;
    if (!resuming && inProgress !== null)
      throw new Error("commit_merge_in_progress");
    const expectedTree = expectedMergeTree();
    const status = run([
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ]);
    if (status.status !== 0) throw new Error("commit_merge_status_unavailable");
    const message = request.message;
    const fresh = run(["rev-parse", "HEAD"]);
    const freshStatus = run([
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ]);
    if (
      fresh.status !== 0 ||
      fresh.stdout.trim() !== current ||
      freshStatus.status !== 0 ||
      freshStatus.stdout !== status.stdout
    )
      throw new Error("commit_merge_target_changed");
    result.effectIssued = true;
    if (!resuming) {
      const merged = run([
        "-c",
        "merge.renormalize=false",
        "merge",
        "--no-ff",
        "--no-commit",
        "--no-edit",
        "--no-autostash",
        "--no-gpg-sign",
        "-m",
        message,
        target.sourceCommit,
      ]);
      if (merged.status !== 0) throw new Error("commit_merge_failed");
    }
    if (readCommitMergeHead(ctx.target) !== target.sourceCommit)
      throw new Error("commit_merge_in_progress");
    const stagedTree = run(["write-tree"]);
    const commitHead = run(["rev-parse", "HEAD"]);
    if (
      stagedTree.status !== 0 ||
      stagedTree.stdout.trim() !== expectedTree ||
      commitHead.status !== 0 ||
      commitHead.stdout.trim() !== current
    )
      throw new Error("commit_merge_content_changed");
    if (readCommitMergeHead(ctx.target) !== target.sourceCommit)
      throw new Error("commit_merge_in_progress");
    const committed = run(["commit", "--no-gpg-sign", "-m", message]);
    if (committed.status !== 0) throw new Error("commit_merge_commit_failed");
    const after = run(["rev-parse", "HEAD"]);
    const observed = after.stdout.trim();
    const afterParents = run(["rev-list", "--parents", "-n", "1", observed]);
    const tree = run(["rev-parse", `${observed}^{tree}`]);
    if (
      after.status !== 0 ||
      !isCommitId(observed) ||
      afterParents.status !== 0 ||
      afterParents.stdout.trim() !==
        `${observed} ${current} ${target.sourceCommit}` ||
      tree.status !== 0 ||
      tree.stdout.trim() !== expectedTree
    )
      throw new Error("commit_merge_unconfirmed");
    result.commitId = observed;
    result.reason = "commit_merge_completed";
    result.status = "completed";
  } catch (error) {
    result.reason =
      error instanceof Error &&
      /^(?:commit_merge|worktree)_[a-z_]+$/u.test(error.message)
        ? error.message
        : "commit_merge_outcome_unknown";
  }
  return result;
}

/**
 * Git管理領域のMerge親を一行の実fileとして読む。
 * @responsibility rev-parseが先頭OIDだけを返す場合も複数親を拒否する。
 * @trace ARCH-000009
 * @input owner: 検証済み所属Root。
 * @returns 不存在又は単一OID。
 * @precondition 既存採用排他下。
 * @postcondition 欠測・不明・複数行を候補一致へ丸めない。
 * @effect 有界Filesystem読取りだけ。
 * @failure link・多重親・変化・読取り失敗はthrow。
 * @invariant Merge状態を自動修正しない。
 * @boundary Git管理領域。
 * @security 通常単linkfileだけを読む。
 * @concurrency descriptor前後の実体・更新を照合する。
 */
function readCommitMergeHead(owner: string): string | null {
  const file = path.join(
    resolveRepositoryGitLayout(owner).gitDirectory.realPath,
    "MERGE_HEAD",
  );
  let info: fs.Stats;
  try {
    info = fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("commit_merge_state_unavailable");
  }
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.nlink !== 1 ||
    info.size > 256
  )
    throw new Error("commit_merge_in_progress");
  const descriptor = fs.openSync(file, "r");
  try {
    const before = fs.fstatSync(descriptor);
    const bytes = Buffer.alloc(257);
    const length = fs.readSync(descriptor, bytes, 0, bytes.length, 0);
    const after = fs.fstatSync(descriptor);
    if (
      temporaryIdentity(info) !== temporaryIdentity(before) ||
      temporaryIdentity(before) !== temporaryIdentity(after) ||
      before.size !== length ||
      after.size !== length ||
      info.mtimeMs !== before.mtimeMs ||
      before.mtimeMs !== after.mtimeMs
    )
      throw new Error("commit_merge_state_unavailable");
    const value = bytes.subarray(0, length).toString("utf8");
    const matched = /^([a-f0-9]{40}|[a-f0-9]{64})(?:\r?\n)?$/u.exec(value);
    if (!matched?.[1]) throw new Error("commit_merge_in_progress");
    return matched[1];
  } finally {
    fs.closeSync(descriptor);
  }
}

/**
 * 固定Candidateを明示統合し、取込先・二親・Treeと途中状態を確認する。
 * @responsibility 固定Candidateを明示統合し、取込先・二親・Treeと途中状態を確認する。
 * @trace ARCH-000002
 * @trace ARCH-000009
 */
import {
  isWorkspaceCommitId,
  type WorkspaceCandidateRequest,
  type WorkspaceCandidateResult,
} from "../../../domain-model/src/index.ts";
import fs from "node:fs";
import path from "node:path";
import type { VerifiedRepositoryRoot } from "../repository/location.ts";
import { resolveRepositoryGitLayout } from "../repository/layout.ts";
import {
  operateCandidate,
  verifyCandidate,
  temporaryIdentity,
} from "./candidate.ts";

/**
 * 固定Candidateを指定Branchへ二親Mergeする。
 * @responsibility 事前競合評価、直前照合と同操作の二重Merge拒否。
 * @trace ARCH-000009
 * @input 固定要求、候補OID、取込先Branchと期待HEAD。
 * @returns 実Merge Commit又は既取込・停止結果。
 * @precondition 上位は別操作の採用認可と非使用を保持。
 * @postcondition 新Mergeの親順序を読戻す。
 * @effect Git標準Mergeのみ。通常Pushはしない。
 * @failure Conflict・変更・unknownは停止、自動abortしない。
 * @invariant 自動Stash／Reset／Clean／Rebaseなし。
 * @boundary 所属Rootの現在Branch。
 * @security Messageは非Authority、Shellは使用しない。
 * @concurrency Git標準保護と既存上位Leaseを使う。
 */
export function mergeWorkspaceCandidate(
  capability: VerifiedRepositoryRoot,
  request: WorkspaceCandidateRequest,
  target: Readonly<{
    candidateCommit: string;
    targetBranch: string;
    expectedTargetHead: string;
  }>,
): WorkspaceCandidateResult {
  return operateCandidate(capability, request, (ctx, result) => {
    if (
      !isWorkspaceCommitId(target.candidateCommit) ||
      !isWorkspaceCommitId(target.expectedTargetHead) ||
      target.candidateCommit.length !== request.baseCommit.length ||
      target.expectedTargetHead.length !== request.baseCommit.length ||
      !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/u.test(target.targetBranch)
    )
      throw new Error("candidate_target_invalid");
    result.candidateCommit = target.candidateCommit;
    result.changedPaths = verifyCandidate(ctx, request, target.candidateCommit);
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
    const run = (args: string[]) => ctx.run(ctx.owner, args);
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
        target.candidateCommit,
      ]);
      if (preview.status === 1) throw new Error("candidate_conflict");
      if (preview.status !== 0 || !isWorkspaceCommitId(preview.stdout.trim()))
        throw new Error("candidate_preview_unavailable");
      return preview.stdout.trim();
    };
    const fixed = run([
      "rev-parse",
      "--verify",
      "--quiet",
      result.candidateRef as string,
    ]);
    if (fixed.status !== 0 || fixed.stdout.trim() !== target.candidateCommit)
      throw new Error("candidate_ref_mismatch");
    const branch = run(["symbolic-ref", "--quiet", "HEAD"]);
    if (
      branch.status !== 0 ||
      branch.stdout.trim() !== `refs/heads/${target.targetBranch}`
    )
      throw new Error("candidate_target_mismatch");
    const head = run(["rev-parse", "--verify", "HEAD"]);
    if (head.status !== 0 || !isWorkspaceCommitId(head.stdout.trim()))
      throw new Error("candidate_target_unavailable");
    const current = head.stdout.trim();
    const parents = run(["rev-list", "--parents", "-n", "1", current]);
    if (parents.status !== 0) throw new Error("candidate_target_unavailable");
    if (
      parents.stdout.trim() ===
      `${current} ${target.expectedTargetHead} ${target.candidateCommit}`
    ) {
      const expected = expectedMergeTree();
      const actual = run(["rev-parse", `${current}^{tree}`]);
      if (actual.status !== 0 || actual.stdout.trim() !== expected)
        throw new Error("candidate_merge_tree_mismatch");
      result.mergeCommit = current;
      result.reason = "candidate_merge_existing";
      return;
    }
    if (current !== target.expectedTargetHead)
      throw new Error("candidate_target_changed");
    const baseIncluded = run([
      "merge-base",
      "--is-ancestor",
      request.baseCommit,
      current,
    ]);
    if (baseIncluded.status === 1)
      throw new Error("candidate_base_not_integrated");
    if (baseIncluded.status !== 0)
      throw new Error("candidate_ancestry_unavailable");
    const ancestor = run([
      "merge-base",
      "--is-ancestor",
      target.candidateCommit,
      current,
    ]);
    if (ancestor.status === 0) {
      result.reason = "candidate_already_integrated";
      return;
    }
    if (ancestor.status !== 1)
      throw new Error("candidate_ancestry_unavailable");
    const inProgress = readCandidateMergeHead(ctx.owner);
    const resuming = inProgress === target.candidateCommit;
    if (!resuming && inProgress !== null)
      throw new Error("candidate_merge_in_progress");
    const expectedTree = expectedMergeTree();
    const status = run([
      "status",
      "--porcelain=v1",
      "-z",
      "--untracked-files=all",
    ]);
    if (status.status !== 0) throw new Error("candidate_status_unavailable");
    const message = [
      `Merge Candidate: ${request.candidateName ?? request.operationId}`,
      "",
      ...(request.workspaceName ? [`Workspace: ${request.workspaceName}`] : []),
      `Workspace-ID: ${request.workspaceId}`,
      `Base-Commit: ${request.baseCommit}`,
      `Candidate-Commit: ${target.candidateCommit}`,
      ...request.relatedChangeIds.map((id) => `Related-CHG: ${id}`),
    ].join("\n");
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
      throw new Error("candidate_target_changed");
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
        target.candidateCommit,
      ]);
      if (merged.status !== 0) throw new Error("candidate_merge_failed");
    }
    if (readCandidateMergeHead(ctx.owner) !== target.candidateCommit)
      throw new Error("candidate_merge_in_progress");
    const stagedTree = run(["write-tree"]);
    const commitHead = run(["rev-parse", "HEAD"]);
    if (
      stagedTree.status !== 0 ||
      stagedTree.stdout.trim() !== expectedTree ||
      commitHead.status !== 0 ||
      commitHead.stdout.trim() !== current
    )
      throw new Error("candidate_merge_content_changed");
    if (readCandidateMergeHead(ctx.owner) !== target.candidateCommit)
      throw new Error("candidate_merge_in_progress");
    const committed = run(["commit", "--no-gpg-sign", "-m", message]);
    if (committed.status !== 0)
      throw new Error("candidate_merge_commit_failed");
    const after = run(["rev-parse", "HEAD"]);
    const observed = after.stdout.trim();
    const afterParents = run(["rev-list", "--parents", "-n", "1", observed]);
    const tree = run(["rev-parse", `${observed}^{tree}`]);
    if (
      after.status !== 0 ||
      !isWorkspaceCommitId(observed) ||
      afterParents.status !== 0 ||
      afterParents.stdout.trim() !==
        `${observed} ${current} ${target.candidateCommit}` ||
      tree.status !== 0 ||
      tree.stdout.trim() !== expectedTree
    )
      throw new Error("candidate_merge_unconfirmed");
    result.mergeCommit = observed;
    result.reason = "candidate_merged";
  });
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
function readCandidateMergeHead(owner: string): string | null {
  const file = path.join(
    resolveRepositoryGitLayout(owner).gitDirectory.realPath,
    "MERGE_HEAD",
  );
  let info: fs.Stats;
  try {
    info = fs.lstatSync(file);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Error("candidate_merge_state_unavailable");
  }
  if (
    !info.isFile() ||
    info.isSymbolicLink() ||
    info.nlink !== 1 ||
    info.size > 256
  )
    throw new Error("candidate_merge_in_progress");
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
      throw new Error("candidate_merge_state_unavailable");
    const value = bytes.subarray(0, length).toString("utf8");
    const matched = /^([a-f0-9]{40}|[a-f0-9]{64})(?:\r?\n)?$/u.exec(value);
    if (!matched?.[1]) throw new Error("candidate_merge_in_progress");
    return matched[1];
  } finally {
    fs.closeSync(descriptor);
  }
}

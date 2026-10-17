/**
 * Workspaceから選択した固定候補と二親Mergeを標準Gitへ接続する。
 * @responsibility index非混入、Base単一親、期待Ref更新と結果読戻し。
 * @trace ARCH-000009
 * @boundary Repository-local Git。採否・認可・非使用は上位が所有する。
 * @security 名前をPath／Ref／Authorityへ使わず、生stderrを公開しない。
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { VerifiedRepositoryRoot } from "../repository/location.ts";
import { resolveRepositoryGitLayout } from "./layout.ts";
import { createWorktreeGitContext } from "./worktree-management.ts";

/**
 * 人間が確認したファイル全体又は明示削除を表す。
 * @responsibility 欠測と削除、内容とmodeを区別する。
 * @trace ARCH-000009
 * @shape Repository相対Path、変換前bytesのGit Blob ID、mode。
 * @invariant 部分行・Directory・glob選択は扱わない。
 * @boundary 明示固定入力。blobIdとmodeが共にnullの場合だけ削除。
 * @security 内容確認値は採用Authorityではない。
 * @compatibility Git標準Object Formatに従う。
 */
export type WorkspaceCandidateSelection = Readonly<{
  path: string;
  blobId: string | null;
  mode: "100644" | "100755" | null;
}>;

/**
 * 固定候補と同操作再入場の閉じた要求を表す。
 * @responsibility 名前の説明用途と機械Identityを分ける。
 * @trace ARCH-000009
 * @shape Workspace、操作UUID、Base、選択、固定時表示名とCHG。
 * @invariant Candidate Refは操作UUIDへ結合しWorkspace HEADを動かさない。
 * @boundary VC公開API。
 * @security 呼出し元が現在認可と内容確認を所有する。
 * @compatibility 名前は省略可能・非一意。
 */
export type WorkspaceCandidateRequest = Readonly<{
  workspaceId: string;
  operationId: string;
  baseCommit: string;
  expectedWorkspaceHead: string;
  selection: readonly WorkspaceCandidateSelection[];
  workspaceName: string | null;
  candidateName: string | null;
  relatedChangeIds: readonly string[];
}>;

/**
 * 自己生成した短命indexの未回収参照を表す。
 * @responsibility 再入場で別の一時物を清掃済みと誤認しない。
 * @trace ARCH-000009
 * @shape 限定相対PathとDirectory実体の照合Hash。
 * @invariant 参照だけを削除許可にしない。
 * @boundary 既存候補結果のみ。
 * @security 親・実体・内容を処置直前に再確認する。
 * @compatibility 新形式のみ。
 */
export type WorkspaceCandidateTemporary = Readonly<{
  relativePath: string;
  identity: string | null;
}>;

/**
 * Git Effectと結果・一時物清掃を分離する。
 * @responsibility 成功、拒否、発行後不明を失わず上位へ返す。
 * @trace ARCH-000009
 * @shape 対象Ref、候補Commit、統合Commit、変更Pathと清掃状態。
 * @invariant nullを不存在／成功へ補完しない。
 * @boundary VCから既存上位記録への搬送。
 * @security この結果は採用許可ではない。
 * @compatibility Git Object即時消去は保証しない。
 */
export type WorkspaceCandidateResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  candidateRef: string | null;
  candidateCommit: string | null;
  mergeCommit: string | null;
  effectIssued: boolean;
  cleanupConfirmed: boolean;
  temporary: WorkspaceCandidateTemporary | null;
  changedPaths: readonly string[];
}>;

const oid = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;

/**
 * 説明用の一行名を検査する。
 * @responsibility 制御文字・空名・過大入力をMessageへ流さない。
 * @trace ARCH-000009
 * @input value: 任意表示名。
 * @returns 説明用として有効か。
 * @precondition N/A: 未検証値も受け付ける。
 * @postcondition Identity・認可判定は変えない。
 * @effect N/A: 値検査。
 * @failure 不正値はfalse。
 * @invariant nullは名前省略。
 * @boundary 同一Process。
 * @security Shell・Ref用の安全性を意味しない。
 * @concurrency N/A: 状態なし。
 */
export function validWorkspaceDisplayName(
  value: unknown,
): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      value.trim() === value &&
      value.length > 0 &&
      [...value].length <= 120 &&
      !/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(value))
  );
}

/**
 * 固定要求の閉じた値契約を保存前とGit発行前で共用する。
 * @responsibility 管理Path・重複・欠測と明示削除の混同を拒否する。
 * @trace ARCH-000009
 * @input value: 未検証JSON値。
 * @returns 固定要求として有効か。
 * @precondition N/A: 未検証値を受け付ける。
 * @postcondition 内容実測・認可・Git実体確認は別に残す。
 * @effect N/A: 値検査。
 * @failure 不正はfalse。
 * @invariant 形式成立をEffect許可にしない。
 * @boundary VC／既存Snapshot codec。
 * @security Directory・glob・管理Pathを拒否。
 * @concurrency N/A: 局所値だけ。
 */
export function validWorkspaceCandidateRequest(
  value: unknown,
): value is WorkspaceCandidateRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const r = value as Record<string, unknown>;
  if (
    Object.keys(r).sort().join(",") !==
      "baseCommit,candidateName,expectedWorkspaceHead,operationId,relatedChangeIds,selection,workspaceId,workspaceName" ||
    typeof r.operationId !== "string" ||
    !uuid.test(r.operationId) ||
    typeof r.workspaceId !== "string" ||
    !uuid.test(r.workspaceId) ||
    typeof r.baseCommit !== "string" ||
    !oid.test(r.baseCommit) ||
    typeof r.expectedWorkspaceHead !== "string" ||
    !oid.test(r.expectedWorkspaceHead) ||
    r.baseCommit.length !== r.expectedWorkspaceHead.length ||
    !validWorkspaceDisplayName(r.workspaceName) ||
    !validWorkspaceDisplayName(r.candidateName) ||
    !Array.isArray(r.relatedChangeIds) ||
    r.relatedChangeIds.length > 20 ||
    r.relatedChangeIds.some(
      (id) => typeof id !== "string" || !/^CHG-\d{6}$/u.test(id),
    ) ||
    new Set(r.relatedChangeIds).size !== r.relatedChangeIds.length ||
    !Array.isArray(r.selection) ||
    r.selection.length < 1 ||
    r.selection.length > 1000
  )
    return false;
  const selected = new Set<string>();
  for (const item of r.selection) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).sort().join(",") !== "blobId,mode,path" ||
      typeof item.path !== "string" ||
      item.path.length > 1000 ||
      item.path
        .split("/")
        .some(
          (segment: string) =>
            !segment ||
            segment === "." ||
            segment === ".." ||
            segment.trim() !== segment ||
            /[. ]$/u.test(segment) ||
            /^\.(?:git|crdd)$/iu.test(segment) ||
            /[\\:\x00-\x1f\x7f*?[\]]/u.test(segment),
        ) ||
      !(
        (item.blobId === null && item.mode === null) ||
        (typeof item.blobId === "string" &&
          oid.test(item.blobId) &&
          item.blobId.length === r.baseCommit.length &&
          ["100644", "100755"].includes(item.mode))
      )
    )
      return false;
    const key = item.path.toLowerCase();
    if (selected.has(key)) return false;
    selected.add(key);
  }
  return true;
}

/**
 * 失敗を同じ対象へ結合する実行枠を作る。
 * @responsibility 例外・Effect発行・清掃失敗を別の事実として返す。
 * @trace ARCH-000009
 * @input capability、request、固定Git処理。
 * @returns 非秘密の閉じた結果。
 * @precondition 上位が既存Leaseと現在認可を保持する。
 * @postcondition 生例外を公開しない。
 * @effect actionが指定したGit操作だけ。
 * @failure 未分類はoutcome_unknown。
 * @invariant 自動Rollback・新Recoveryなし。
 * @boundary ローカル子ProcessとFilesystem。
 * @security OperationとRefの一対一を保持。
 * @concurrency 非協調Hostの変更は完全原子化しない。
 */
function operateCandidate(
  capability: VerifiedRepositoryRoot,
  request: WorkspaceCandidateRequest,
  action: (
    ctx: ReturnType<typeof createWorktreeGitContext>,
    result: {
      status: "completed" | "blocked";
      reason: string;
      candidateRef: string | null;
      candidateCommit: string | null;
      mergeCommit: string | null;
      effectIssued: boolean;
      cleanupConfirmed: boolean;
      temporary: WorkspaceCandidateTemporary | null;
      changedPaths: readonly string[];
    },
  ) => void,
  previousTemporary: WorkspaceCandidateTemporary | null = null,
): WorkspaceCandidateResult {
  const result = {
    status: "blocked" as "completed" | "blocked",
    reason: "candidate_input_invalid",
    candidateRef: null as string | null,
    candidateCommit: null as string | null,
    mergeCommit: null as string | null,
    effectIssued: false,
    cleanupConfirmed: previousTemporary === null,
    temporary: previousTemporary,
    changedPaths: [] as readonly string[],
  };
  try {
    if (!validWorkspaceCandidateRequest(request))
      throw new Error("candidate_input_invalid");
    const ctx = createWorktreeGitContext(capability, request.workspaceId);
    result.candidateRef = `refs/heads/crdd/candidate/${request.workspaceId}/${request.operationId}`;
    const symbolic = ctx.run(ctx.owner, [
      "symbolic-ref",
      "--quiet",
      result.candidateRef,
    ]);
    if (symbolic.status !== 1 || symbolic.stdout !== "")
      throw new Error("candidate_ref_not_direct");
    const drivers = ctx.run(ctx.owner, [
      "config",
      "--includes",
      "--null",
      "--name-only",
      "--get-regexp",
      "^merge\\..*\\.driver$",
    ]);
    if (drivers.status !== 1 || drivers.stdout !== "")
      throw new Error("candidate_merge_driver_unsupported");
    action(ctx, result);
    if (result.cleanupConfirmed) result.status = "completed";
    else result.reason = "candidate_temporary_cleanup_unconfirmed";
  } catch (error) {
    result.reason =
      error instanceof Error &&
      /^(?:candidate|worktree)_[a-z_]+$/u.test(error.message)
        ? error.message
        : "candidate_outcome_unknown";
  }
  return result;
}

/**
 * 一候補Commitの親・選択内容・選択外不変を読戻す。
 * @responsibility Ref存在だけで固定成功へしない。
 * @trace ARCH-000009
 * @input Git context、固定要求、対象Commit。
 * @returns Baseとの差分Path。
 * @precondition Commitは同じRepositoryのObject。
 * @postcondition 親はBase一件、変更は選択集合内。
 * @effect 有界Git読取り。
 * @failure 不一致・観測不能はthrow。
 * @invariant Message一致は根拠にしない。
 * @boundary 実Git。
 * @security 管理Pathを選択しない。
 * @concurrency 固定OIDを読む。
 */
function verifyCandidate(
  ctx: ReturnType<typeof createWorktreeGitContext>,
  request: WorkspaceCandidateRequest,
  commit: string,
) {
  const parents = ctx.run(ctx.owner, [
    "rev-list",
    "--parents",
    "-n",
    "1",
    commit,
  ]);
  if (
    parents.status !== 0 ||
    parents.stdout.trim() !== `${commit} ${request.baseCommit}`
  )
    throw new Error("candidate_parent_mismatch");
  const diff = ctx.run(ctx.owner, [
    "diff-tree",
    "--no-commit-id",
    "--name-only",
    "--no-renames",
    "-r",
    "-z",
    request.baseCommit,
    commit,
  ]);
  if (diff.status !== 0) throw new Error("candidate_diff_unavailable");
  const paths = diff.stdout.split("\0").filter(Boolean);
  if (
    !paths.length ||
    paths.some((p) => !request.selection.some((s) => s.path === p))
  )
    throw new Error("candidate_selection_mismatch");
  for (const item of request.selection) {
    const entry = ctx.run(ctx.owner, [
      "ls-tree",
      "-z",
      commit,
      "--",
      item.path,
    ]);
    const expected =
      item.blobId === null
        ? ""
        : `${item.mode} blob ${item.blobId}\t${item.path}\0`;
    if (entry.status !== 0 || entry.stdout !== expected)
      throw new Error("candidate_content_mismatch");
  }
  return paths;
}

/**
 * Baseと選択bytesから独立Candidate Branchを固定する。
 * @responsibility 通常index・Workspace HEADと未選択Commitを混入させない。
 * @trace ARCH-000009
 * @input capability、固定Base・選択Blob・同操作UUID。
 * @returns 固定Ref／Commitと差分。
 * @precondition 選択はファイル全体。上位が確認と非使用を維持。
 * @postcondition Ref作成前にTreeと親を検証。
 * @effect Git Object・専用Refと自己所有短命index。
 * @failure 内容変更・不正Path・Ref差は停止。
 * @invariant Working Tree／通常index／HEADは書き換えない。
 * @boundary 実Gitと検証済みWorkspace。
 * @security filter／改行変換をせず確認したraw bytesだけをBlob化する。
 * @concurrency Refは期待不存在付き作成。同operation再入場は元OID。
 */
export function freezeWorkspaceCandidate(
  capability: VerifiedRepositoryRoot,
  request: WorkspaceCandidateRequest,
  previousCommit: string | null = null,
  previousTemporary: WorkspaceCandidateTemporary | null = null,
): WorkspaceCandidateResult {
  return operateCandidate(
    capability,
    request,
    (ctx, result) => {
      if (result.temporary) {
        cleanCandidateTemporary(ctx, request.workspaceId, result.temporary);
        result.temporary = null;
        result.cleanupConfirmed = true;
      }
      const existing = ctx.run(ctx.owner, [
        "rev-parse",
        "--verify",
        "--quiet",
        result.candidateRef as string,
      ]);
      if (existing.status === 0 && oid.test(existing.stdout.trim())) {
        if (
          previousCommit !== null &&
          previousCommit !== existing.stdout.trim()
        )
          throw new Error("candidate_ref_mismatch");
        result.candidateCommit = existing.stdout.trim();
        result.changedPaths = verifyCandidate(
          ctx,
          request,
          result.candidateCommit,
        );
        result.reason = "candidate_fixed_existing";
        return;
      }
      if (existing.status !== 1 || existing.stdout !== "")
        throw new Error("candidate_ref_unavailable");
      if (previousCommit !== null) {
        if (!oid.test(previousCommit))
          throw new Error("candidate_input_invalid");
        result.changedPaths = verifyCandidate(ctx, request, previousCommit);
        result.candidateCommit = previousCommit;
        result.effectIssued = true;
        const restored = ctx.run(ctx.owner, [
          "update-ref",
          result.candidateRef as string,
          previousCommit,
          "0".repeat(previousCommit.length),
        ]);
        const observed = ctx.run(ctx.owner, [
          "rev-parse",
          "--verify",
          result.candidateRef as string,
        ]);
        if (
          restored.status !== 0 ||
          observed.status !== 0 ||
          observed.stdout.trim() !== previousCommit
        )
          throw new Error("candidate_ref_unconfirmed");
        result.reason = "candidate_fixed_existing";
        return;
      }
      const observation = ctx.inspect();
      if (
        !observation.registered ||
        !observation.directoryPresent ||
        observation.locked ||
        observation.prunable ||
        observation.head !== request.expectedWorkspaceHead ||
        observation.branchHead !== request.expectedWorkspaceHead
      )
        throw new Error("candidate_workspace_mismatch");
      const temporary = fs.mkdtempSync(
        path.join(path.dirname(ctx.target), "candidate-index-"),
      );
      result.temporary = {
        relativePath: path
          .relative(ctx.owner, temporary)
          .split(path.sep)
          .join("/"),
        identity: null,
      };
      result.cleanupConfirmed = false;
      const indexFile = path.join(temporary, "index");
      /**
       * 自己所有の一時indexだけへGit操作を結合する。
       * @responsibility 通常indexを更新せず非0を一次失敗へ返す。
       * @trace ARCH-000009
       * @input args: 固定Git引数、input: 確認済みraw bytes。
       * @returns 有界stdout。
       * @precondition 親は本操作が作成した一時Directory。
       * @postcondition index指定を全要求へ維持。
       * @effect argsで指定したGit Object／一時index操作。
       * @failure 非0・応答不明は停止。
       * @invariant Shellを使わない。
       * @boundary 実Git。
       * @security 生stderrを返さない。
       * @concurrency 既存上位Lease下。
       */
      const run = (args: string[], input?: Buffer) => {
        const response = ctx.run(ctx.owner, args, {
          indexFile,
          ...(input === undefined ? {} : { input }),
        });
        if (response.status !== 0) throw new Error("candidate_git_failed");
        return response.stdout.trim();
      };
      try {
        result.temporary = {
          ...result.temporary,
          identity: temporaryIdentity(fs.lstatSync(temporary)),
        };
        run(["read-tree", request.baseCommit]);
        for (const item of request.selection) {
          let cursor = ctx.target;
          const segments = item.path.split("/");
          for (const segment of segments.slice(0, -1)) {
            cursor = path.join(cursor, segment);
            const info = fs.lstatSync(cursor);
            if (
              !info.isDirectory() ||
              info.isSymbolicLink() ||
              fs.existsSync(path.join(cursor, ".git"))
            )
              throw new Error("candidate_path_invalid");
          }
          const absolute = path.join(ctx.target, ...segments);
          if (item.blobId === null) {
            try {
              fs.lstatSync(absolute);
              throw new Error("candidate_deletion_mismatch");
            } catch (error) {
              if ((error as NodeJS.ErrnoException).code !== "ENOENT")
                throw error;
            }
            run(["update-index", "--force-remove", "--", item.path]);
          } else {
            const info = fs.lstatSync(absolute);
            if (
              !info.isFile() ||
              info.isSymbolicLink() ||
              info.nlink !== 1 ||
              info.size > 64 * 1024 * 1024
            )
              throw new Error("candidate_path_invalid");
            const bytes = fs.readFileSync(absolute);
            const calculated = createHash(
              item.blobId.length === 40 ? "sha1" : "sha256",
            )
              .update(`blob ${bytes.length}\0`)
              .update(bytes)
              .digest("hex");
            if (calculated !== item.blobId)
              throw new Error("candidate_content_changed");
            result.effectIssued = true;
            if (run(["hash-object", "-w", "--stdin"], bytes) !== item.blobId)
              throw new Error("candidate_blob_mismatch");
            run([
              "update-index",
              "--add",
              "--cacheinfo",
              item.mode as string,
              item.blobId,
              item.path,
            ]);
          }
        }
        result.effectIssued = true;
        const tree = run(["write-tree"]);
        const commit = run([
          "commit-tree",
          tree,
          "-p",
          request.baseCommit,
          "-m",
          `Candidate: ${request.candidateName ?? request.operationId}`,
        ]);
        result.candidateCommit = commit;
        result.changedPaths = verifyCandidate(ctx, request, commit);
        if (ctx.inspect().head !== request.expectedWorkspaceHead)
          throw new Error("candidate_workspace_mismatch");
        result.effectIssued = true;
        run([
          "update-ref",
          result.candidateRef as string,
          commit,
          "0".repeat(commit.length),
        ]);
        if (
          run(["rev-parse", "--verify", result.candidateRef as string]) !==
          commit
        )
          throw new Error("candidate_ref_mismatch");
        result.reason = "candidate_fixed";
      } finally {
        try {
          cleanCandidateTemporary(ctx, request.workspaceId, result.temporary);
          result.temporary = null;
          result.cleanupConfirmed = true;
        } catch {
          result.cleanupConfirmed = false;
        }
      }
    },
    previousTemporary,
  );
}

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
      !oid.test(target.candidateCommit) ||
      !oid.test(target.expectedTargetHead) ||
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
      if (preview.status !== 0 || !oid.test(preview.stdout.trim()))
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
    if (head.status !== 0 || !oid.test(head.stdout.trim()))
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
      !oid.test(observed) ||
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
 * 終了確認済みCandidateの専用Refだけを期待Commit付きで回収する。
 * @responsibility Workspace寿命と候補Refを分離する。
 * @trace ARCH-000009
 * @input 同固定要求、期待Candidate Commit。
 * @returns 元Refの不存在又は停止。
 * @precondition 上位が採否・必要参照・保持・非使用を確認済み。
 * @postcondition 他Ref／Tree／Git Objectは削除しない。
 * @effect 標準update-ref -dのみ。
 * @failure Ref差・使用中・unknownは停止。
 * @invariant 参照名だけで無条件削除しない。
 * @boundary 同Repositoryの専用Ref。
 * @security この入力は処置許可を代替しない。
 * @concurrency Git標準の期待値更新を使う。
 */
export function removeWorkspaceCandidate(
  capability: VerifiedRepositoryRoot,
  request: WorkspaceCandidateRequest,
  expectedCommit: string | null,
  previousTemporary: WorkspaceCandidateTemporary | null = null,
): WorkspaceCandidateResult {
  return operateCandidate(
    capability,
    request,
    (ctx, result) => {
      if (result.temporary) {
        cleanCandidateTemporary(ctx, request.workspaceId, result.temporary);
        result.temporary = null;
        result.cleanupConfirmed = true;
      }
      if (expectedCommit !== null && !oid.test(expectedCommit))
        throw new Error("candidate_input_invalid");
      result.candidateCommit = expectedCommit;
      const ref = result.candidateRef as string;
      const current = ctx.run(ctx.owner, [
        "rev-parse",
        "--verify",
        "--quiet",
        ref,
      ]);
      if (current.status === 1 && current.stdout === "") {
        result.reason = "candidate_ref_absent";
        return;
      }
      if (expectedCommit === null) throw new Error("candidate_ref_unexpected");
      if (current.status !== 0 || current.stdout.trim() !== expectedCommit)
        throw new Error("candidate_ref_mismatch");
      verifyCandidate(ctx, request, expectedCommit);
      const list = ctx.run(ctx.owner, [
        "worktree",
        "list",
        "--porcelain",
        "-z",
      ]);
      if (list.status !== 0) throw new Error("candidate_usage_unavailable");
      if (list.stdout.split("\0").includes(`branch ${ref}`))
        throw new Error("candidate_ref_in_use");
      result.effectIssued = true;
      const removed = ctx.run(ctx.owner, [
        "update-ref",
        "-d",
        ref,
        expectedCommit,
      ]);
      const after = ctx.run(ctx.owner, [
        "rev-parse",
        "--verify",
        "--quiet",
        ref,
      ]);
      if (removed.status !== 0 || after.status !== 1 || after.stdout !== "")
        throw new Error("candidate_ref_removal_unconfirmed");
      result.reason = "candidate_ref_removed";
    },
    previousTemporary,
  );
}

/**
 * 一時Directoryの実体照合値を作る。
 * @responsibility 名前が同じ別実体の誤回収を避ける。
 * @trace ARCH-000009
 * @input info: lstat結果。
 * @returns 非秘密の照合Hash。
 * @precondition 自己生成Directory。
 * @postcondition Authorityは発行しない。
 * @effect N/A: 局所計算。
 * @failure 計算失敗を呼出し元へ返す。
 * @invariant Pathだけに依存しない。
 * @boundary 同一Process。
 * @security dev・ino・生成時刻を使用する。
 * @concurrency 内容更新によって変わらない識別属性だけを使う。
 */
function temporaryIdentity(info: fs.Stats): string {
  return createHash("sha256")
    .update(JSON.stringify([info.dev, info.ino, info.birthtimeMs]))
    .digest("hex");
}

/**
 * 同じ候補の既知一時indexだけを再照合して回収する。
 * @responsibility 不存在と観測不能を区別し兄弟領域を触らない。
 * @trace ARCH-000009
 * @input 検証済みGit context、Workspace ID、既存一時参照。
 * @returns 正常終了時だけ不存在確認済み。
 * @precondition 上位が同Workspaceの既存操作排他を保持。
 * @postcondition Path・実体・限定内容が違えば削除しない。
 * @effect 自己所有indexとそのDirectoryの削除。
 * @failure 観測不能・不一致・削除失敗はthrow。
 * @invariant 新Registry・再帰探索なし。
 * @boundary Repository-local .crdd。
 * @security linkと未知の内容を拒否する。
 * @concurrency 非協調Hostの競合を完全原子化したとは扱わない。
 */
function cleanCandidateTemporary(
  ctx: ReturnType<typeof createWorktreeGitContext>,
  workspaceId: string,
  temporary: WorkspaceCandidateTemporary,
): void {
  const prefix = `.crdd/workspaces/${workspaceId}/candidate-index-`;
  if (
    !temporary.relativePath.startsWith(prefix) ||
    !/^[A-Za-z0-9]{6}$/u.test(temporary.relativePath.slice(prefix.length)) ||
    temporary.identity === null ||
    !/^[a-f0-9]{64}$/u.test(temporary.identity)
  )
    throw new Error("candidate_temporary_identity_mismatch");
  const parent = path.dirname(ctx.target);
  if (
    fs.realpathSync.native(parent) !== parent ||
    fs.lstatSync(parent).isSymbolicLink()
  )
    throw new Error("candidate_temporary_identity_mismatch");
  const target = path.join(ctx.owner, ...temporary.relativePath.split("/"));
  if (path.dirname(target) !== parent)
    throw new Error("candidate_temporary_identity_mismatch");
  let info: fs.Stats;
  try {
    info = fs.lstatSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  if (
    !info.isDirectory() ||
    info.isSymbolicLink() ||
    temporaryIdentity(info) !== temporary.identity
  )
    throw new Error("candidate_temporary_identity_mismatch");
  for (const name of fs.readdirSync(target)) {
    const item = fs.lstatSync(path.join(target, name));
    if (
      !["index", "index.lock"].includes(name) ||
      !item.isFile() ||
      item.isSymbolicLink() ||
      item.nlink !== 1
    )
      throw new Error("candidate_temporary_contents_unknown");
  }
  fs.rmSync(target, { recursive: true });
  try {
    fs.lstatSync(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
    throw error;
  }
  throw new Error("candidate_temporary_cleanup_unconfirmed");
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

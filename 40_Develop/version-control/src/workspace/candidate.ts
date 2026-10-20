/**
 * 選択差分の固定・共有検査・専用Candidate Refの回収を所有する。
 * @responsibility 選択差分の固定・共有検査・専用Candidate Refの回収を所有する。
 * @trace ARCH-000002
 * @trace ARCH-000009
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { VerifiedRepositoryRoot } from "../repository/location.ts";
import { createWorktreeGitContext } from "./worktree.ts";

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

export const oid = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/u;

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u;

/**
 * 選択fileの確認内容を固定要求へ結合する。
 * @responsibility Base・HEAD・raw Blobと表示差分を同じ対象から観測する。
 * @trace ARCH-000009
 * @input 検証済みRoot、Workspace ID、Base、相対Path。
 * @returns 確認用内容と固定用selection。binary本文は返さない。
 * @precondition 呼出し元が現在認可を保持している。
 * @postcondition 読取りだけでCommit／Refを発行しない。
 * @effect 有界file／Git読取り。
 * @failure 不正Path、link、欠測、過大、変化はthrow。
 * @invariant 一覧や表示を固定許可へ変換しない。
 * @boundary VCと公開投影Owner。
 * @security 管理Pathと入れ子Gitを読まない。
 * @concurrency 観測後の変更は固定時のBlob比較で再検出する。
 */
export function inspectWorkspaceFile(
  capability: VerifiedRepositoryRoot,
  workspaceId: string,
  baseCommit: string,
  selectedPath: string,
) {
  if (
    !validWorkspaceCandidateRequest({
      workspaceId,
      operationId: workspaceId,
      baseCommit,
      expectedWorkspaceHead: baseCommit,
      selection: [{ path: selectedPath, mode: null, blobId: null }],
      workspaceName: null,
      candidateName: null,
      relatedChangeIds: [],
    })
  )
    throw new Error("candidate_input_invalid");
  const ctx = createWorktreeGitContext(capability, workspaceId);
  const before = ctx.inspect();
  if (
    !before.registered ||
    !before.directoryPresent ||
    before.locked ||
    before.prunable ||
    !before.head
  )
    throw new Error("candidate_workspace_mismatch");
  const segments = selectedPath.split("/");
  let directory = ctx.target;
  for (const segment of segments.slice(0, -1)) {
    directory = path.join(directory, segment);
    const info = fs.lstatSync(directory);
    if (
      !info.isDirectory() ||
      info.isSymbolicLink() ||
      fs.existsSync(path.join(directory, ".git"))
    )
      throw new Error("candidate_path_invalid");
  }
  const file = path.join(ctx.target, ...segments);
  let bytes: Buffer | null = null;
  let mode: "100644" | "100755" | null = null;
  try {
    const info = fs.lstatSync(file);
    if (
      !info.isFile() ||
      info.isSymbolicLink() ||
      info.nlink !== 1 ||
      info.size > 1024 * 1024
    )
      throw new Error("candidate_path_invalid");
    bytes = fs.readFileSync(file);
    if (bytes.length > 1024 * 1024)
      throw new Error("candidate_content_too_large");
    const tracked = ctx.run(ctx.owner, [
      "ls-tree",
      baseCommit,
      "--",
      selectedPath,
    ]);
    if (tracked.status !== 0)
      throw new Error("candidate_observation_unavailable");
    mode = (
      process.platform === "win32"
        ? tracked.stdout.startsWith("100755 ")
        : (info.mode & 0o111) !== 0
    )
      ? "100755"
      : "100644";
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const diff = ctx.run(ctx.target, [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    baseCommit,
    "--",
    selectedPath,
  ]);
  if (diff.status !== 0 || Buffer.byteLength(diff.stdout) > 256 * 1024)
    throw new Error("candidate_observation_unavailable");
  if (ctx.inspect().head !== before.head)
    throw new Error("candidate_workspace_mismatch");
  if (bytes !== null) {
    const fresh = fs.lstatSync(file);
    if (
      !fresh.isFile() ||
      fresh.isSymbolicLink() ||
      fresh.nlink !== 1 ||
      fresh.size > 1024 * 1024 ||
      !fs.readFileSync(file).equals(bytes)
    )
      throw new Error("candidate_content_changed");
  } else {
    try {
      fs.lstatSync(file);
      throw new Error("candidate_content_changed");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const blobId =
    bytes === null
      ? null
      : createHash(baseCommit.length === 40 ? "sha1" : "sha256")
          .update(`blob ${bytes.length}\0`)
          .update(bytes)
          .digest("hex");
  let content: string | null = null;
  let binary = false;
  if (bytes !== null) {
    try {
      content = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      binary = bytes.includes(0);
    } catch {
      binary = true;
    }
    if (binary) content = null;
  }
  return {
    baseCommit,
    head: before.head,
    selection: {
      path: selectedPath,
      blobId,
      mode,
    } as WorkspaceCandidateSelection,
    content,
    binary,
    patch: diff.stdout,
    truncated: false as const,
  };
}

/**
 * 固定候補の変更を現在Working Treeと混ぜずに読む。
 * @responsibility 人間が採用対象Commitの差分を確認できるようにする。
 * @trace ARCH-000009
 * @input 検証済みRoot、固定要求、Candidate Commit、選択Path。
 * @returns Baseと固定Commitに結合した有界patch。
 * @precondition 現在認可済み。
 * @postcondition 現在fileの変更を固定差分へ含めない。
 * @effect 固定Git Objectの読取りだけ。
 * @failure 別Path・親／Tree不一致・過大・観測不能はthrow。
 * @invariant Ref・index・Treeの書換えなし。
 * @boundary VCと公開投影。
 * @security 未選択Path・外部diff／textconvを利用しない。
 * @concurrency 固定OIDだけを参照する。
 */
export function inspectWorkspaceCandidatePatch(
  capability: VerifiedRepositoryRoot,
  request: WorkspaceCandidateRequest,
  commit: string,
  selectedPath: string,
) {
  if (!validWorkspaceCandidateRequest(request) || !oid.test(commit))
    throw new Error("candidate_input_invalid");
  const selection = request.selection.find(
    (item) => item.path === selectedPath,
  );
  if (!selection) throw new Error("candidate_path_invalid");
  const ctx = createWorktreeGitContext(capability, request.workspaceId);
  verifyCandidate(ctx, request, commit);
  const result = ctx.run(ctx.owner, [
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--no-renames",
    request.baseCommit,
    commit,
    "--",
    selectedPath,
  ]);
  if (result.status !== 0 || Buffer.byteLength(result.stdout) > 256 * 1024)
    throw new Error("candidate_observation_unavailable");
  return {
    baseCommit: request.baseCommit,
    head: commit,
    candidateCommit: commit,
    selection,
    content: null,
    binary: result.stdout.includes("Binary files "),
    patch: result.stdout,
    truncated: false as const,
  };
}

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
export function operateCandidate(
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
export function verifyCandidate(
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
export function temporaryIdentity(info: fs.Stats): string {
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

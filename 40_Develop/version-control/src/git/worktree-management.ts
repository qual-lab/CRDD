/**
 * 独立作業用Worktreeと専用Branchの標準Git操作を所有する。
 * @responsibility 固定対象の作成・観測・明示削除と部分成立の返却。
 * @trace ARCH-000009
 * @boundary Repository-local領域と共有Git管理情報。
 * @security 採否・利用調停・認可は呼出し元。秘密・生stderrは返さない。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { devNull } from "node:os";
import path from "node:path";
import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../repository/location.ts";
import { resolveRepositoryGitLayout } from "./layout.ts";

/**
 * 登録・実体・Refを独立観測した値。
 * @responsibility 不存在と観測不能を混同せず、部分状態を表す。
 * @trace ARCH-000009
 * @shape 登録、実体、専用Branch、変更とlock。
 * @invariant branchHeadのnullは専用Ref不存在、headのnullは登録HEADなし、dirtyのnullは状態未取得。観測不能時は結果全体のobservationがnull。
 * @boundary Git／Filesystemの観測結果。
 * @security PathとBranchは固定相対値のみ。
 * @compatibility 上位Task保存Schemaではない。
 */
export type RepositoryWorktreeObservation = Readonly<{
  registered: boolean;
  directoryPresent: boolean;
  branchHead: string | null;
  head: string | null;
  locked: boolean;
  prunable: boolean;
  dirty: boolean | null;
}>;

/**
 * 要求と終了段階を結合した結果。
 * @responsibility 発行前拒否と発行後不明、部分削除を区別する。
 * @trace ARCH-000009
 * @shape 固定対象、一次理由、Effect発行と段階別不存在。
 * @invariant 完了は実観測後だけ。失敗時も同対象を保持する。
 * @boundary Package公開API。
 * @security この値自体は削除Authorityではない。
 * @compatibility 呼出し元が採否・非使用を所有する。
 */
export type RepositoryWorktreeResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  workspaceId: string;
  relativePath: string | null;
  branch: string | null;
  expectedCommit: string | null;
  effectIssued: boolean;
  worktreeRemoved: boolean | null;
  branchRemoved: boolean | null;
  workspaceDirectoryRetained: boolean | null;
  observation: RepositoryWorktreeObservation | null;
}>;

type RecordEntry = {
  root: string;
  head: string | null;
  branch: string | null;
  locked: boolean;
  prunable: boolean;
  bare: boolean;
};

/**
 * 一要求のGit起動・一覧と固定配置を作る。
 * @responsibility 親Git設定の遮断、所属Root解決、Pathの限定。
 * @trace ARCH-000009
 * @input capability: 既存Root、workspaceId: 上位UUID。
 * @returns 寿命が一要求に閉じる技術操作。
 * @precondition 認可と非使用の調停は上位が所有する。
 * @postcondition 所属Rootの固定Pathだけが操作候補となる。
 * @effect 有界Git読取りのみ。
 * @failure 不正・別Root・外部filter・観測不能はthrow。
 * @invariant 新台帳・独自Lockなし。
 * @boundary ローカルGit子Process。
 * @security hook・親Git環境・lazy fetchを無効にする。
 * @concurrency 非協調Host変更の原子性は保証しない。
 */
function context(capability: VerifiedRepositoryRoot, workspaceId: string) {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u.test(
      workspaceId,
    )
  )
    throw new Error("worktree_id_invalid");
  const root = resolveVerifiedRepositoryRoot(capability);
  if (root === null) throw new Error("worktree_repository_invalid");
  const layout = resolveRepositoryGitLayout(root);
  const empty = process.platform === "win32" ? "NUL" : devNull;
  const env = {
    ...Object.fromEntries(
      Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
    ),
    GIT_CONFIG_GLOBAL: empty,
    GIT_CONFIG_SYSTEM: empty,
    GIT_TERMINAL_PROMPT: "0",
    GIT_NO_LAZY_FETCH: "1",
  };
  const deadline = performance.now() + 30_000;
  let commandRoot = root;
  const run = (at: string, args: readonly string[]) => {
    const timeout = Math.ceil(deadline - performance.now());
    if (timeout <= 0) throw new Error("worktree_deadline_exceeded");
    const atLayout = resolveRepositoryGitLayout(at);
    const result = spawnSync(
      "git",
      [
        "--no-pager",
        "--no-optional-locks",
        ...(args[0] === "check-ignore" ? [] : ["--literal-pathspecs"]),
        "--no-replace-objects",
        `--git-dir=${atLayout.gitDirectory.realPath}`,
        `--work-tree=${at}`,
        "-c",
        "core.bare=false",
        "-c",
        "core.fsmonitor=false",
        "-c",
        `core.hooksPath=${empty}`,
        ...args,
      ],
      {
        cwd: at,
        env,
        encoding: "utf8",
        windowsHide: true,
        shell: false,
        timeout,
        maxBuffer: 2 * 1024 * 1024,
      },
    );
    if (result.error || result.signal)
      throw new Error("worktree_git_outcome_unknown");
    return result;
  };
  const list = () => {
    const result = run(commandRoot, ["worktree", "list", "--porcelain", "-z"]);
    if (result.status !== 0) throw new Error("worktree_list_unavailable");
    const entries: RecordEntry[] = [];
    let entry: RecordEntry | null = null;
    for (const field of result.stdout.split("\0")) {
      if (field === "") {
        if (entry) entries.push(entry);
        entry = null;
        continue;
      }
      const separator = field.indexOf(" ");
      const key = separator < 0 ? field : field.slice(0, separator);
      const value = separator < 0 ? "" : field.slice(separator + 1);
      if (key === "worktree") {
        if (entry || !path.isAbsolute(value))
          throw new Error("worktree_list_invalid");
        entry = {
          root: path.resolve(value),
          head: null,
          branch: null,
          locked: false,
          prunable: false,
          bare: false,
        };
      } else if (!entry) throw new Error("worktree_list_invalid");
      else if (key === "HEAD" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(value))
        entry.head = value;
      else if (key === "branch" && value.startsWith("refs/heads/"))
        entry.branch = value.slice(11);
      else if (key === "locked") entry.locked = true;
      else if (key === "prunable") entry.prunable = true;
      else if (key === "bare") entry.bare = true;
      else if (key !== "detached") throw new Error("worktree_list_invalid");
    }
    if (
      entry ||
      entries.length === 0 ||
      new Set(entries.map((item) => pathKey(item.root))).size !== entries.length
    )
      throw new Error("worktree_list_invalid");
    return entries;
  };
  const primary = list()[0];
  if (!primary || primary.bare) throw new Error("worktree_owner_invalid");
  const owner = resolveRepositoryGitLayout(primary.root);
  if (
    pathKey(owner.commonDirectory.realPath) !==
      pathKey(layout.commonDirectory.realPath) ||
    owner.kind === "linked_worktree"
  )
    throw new Error("worktree_owner_invalid");
  commandRoot = owner.root.realPath;
  const filters = run(root, [
    "config",
    "--includes",
    "--null",
    "--name-only",
    "--get-regexp",
    "^filter\\..*\\.(clean|smudge|process)$",
  ]);
  if (filters.status !== 1 || filters.stdout !== "")
    throw new Error("worktree_external_filter_unsupported");
  const relativePath = `.crdd/workspaces/${workspaceId}/worktree`;
  const target = path.join(owner.root.realPath, ...relativePath.split("/"));
  const branch = `crdd/workspace/${workspaceId}`;
  const inspect = (): RepositoryWorktreeObservation => {
    const entries = list();
    const registered = entries.find(
      (entry) => pathKey(entry.root) === pathKey(target),
    );
    const present = safeDirectoryPath(owner.root.realPath, target);
    const symbolic = run(commandRoot, [
      "symbolic-ref",
      "--quiet",
      `refs/heads/${branch}`,
    ]);
    if (symbolic.status !== 1 || symbolic.stdout !== "")
      throw new Error("worktree_branch_not_direct");
    const ref = run(commandRoot, [
      "rev-parse",
      "--verify",
      "--quiet",
      `refs/heads/${branch}`,
    ]);
    let branchHead: string | null = null;
    if (
      ref.status === 0 &&
      /^(?:[0-9a-f]{40}|[0-9a-f]{64})\r?\n$/u.test(ref.stdout)
    )
      branchHead = ref.stdout.trim();
    else if (ref.status !== 1 || ref.stdout !== "")
      throw new Error("worktree_ref_unavailable");
    if (registered && registered.branch !== branch)
      throw new Error("worktree_target_mismatch");
    if (
      entries.some(
        (entry) =>
          entry.branch === branch && pathKey(entry.root) !== pathKey(target),
      )
    )
      throw new Error("worktree_branch_in_use");
    let dirty: boolean | null = null;
    if (present && registered) {
      const targetLayout = resolveRepositoryGitLayout(target);
      if (
        pathKey(targetLayout.commonDirectory.realPath) !==
        pathKey(owner.commonDirectory.realPath)
      )
        throw new Error("worktree_target_mismatch");
      const result = run(target, [
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--ignored=matching",
      ]);
      if (result.status !== 0) throw new Error("worktree_status_unavailable");
      dirty = result.stdout.length > 0;
    }
    return {
      registered: !!registered,
      directoryPresent: present,
      branchHead,
      head: registered?.head ?? null,
      locked: registered?.locked ?? false,
      prunable: registered?.prunable ?? false,
      dirty,
    };
  };
  return {
    root: commandRoot,
    owner: owner.root.realPath,
    target,
    relativePath,
    branch,
    run,
    inspect,
  };
}

/**
 * OSのPath比較規則へ正規化する。
 * @responsibility Git表示とFilesystem Pathの照合。
 * @trace ARCH-000009
 * @input value: 絶対Path。
 * @returns 比較用文字列。
 * @precondition Pathは実体検証と併用する。
 * @postcondition 表記差だけを吸収する。
 * @effect N/A: 局所計算。
 * @failure N/A: 独自失敗なし。
 * @invariant 文字列比較を実体保証にしない。
 * @boundary N/A: 同一Process。
 * @security 操作許可を発行しない。
 * @concurrency N/A: 共有状態なし。
 */
function pathKey(value: string) {
  const normalized = path.resolve(value);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

/**
 * 所属Rootから対象までのDirectoryを非追従で検証する。
 * @responsibility 不存在と観測不能、祖先linkを区別する。
 * @trace ARCH-000009
 * @input root: 検証済みRoot、target: 固定子Path。
 * @returns 全Directoryが存在する場合true。
 * @precondition targetはroot配下。
 * @postcondition link・非Directoryは拒否。
 * @effect Filesystem読取り。
 * @failure ENOENT以外は上位へ保持。
 * @invariant 他Rootを操作しない。
 * @boundary ローカルFilesystem。
 * @security symlink／junction経由の削除を防ぐ。
 * @concurrency 非協調差替えの原子性は保証しない。
 */
function safeDirectoryPath(root: string, target: string) {
  const relative = path.relative(root, target);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("worktree_path_invalid");
  let cursor = root;
  for (const segment of relative.split(path.sep)) {
    cursor = path.join(cursor, segment);
    try {
      const info = fs.lstatSync(cursor);
      if (
        !info.isDirectory() ||
        info.isSymbolicLink() ||
        pathKey(fs.realpathSync.native(cursor)) !== pathKey(cursor)
      )
        throw new Error("worktree_path_invalid");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }
  }
  return true;
}

/**
 * submoduleと入れ子Gitを含む削除を拒否する。
 * @responsibility force削除を専用作業Treeだけへ限定する。
 * @trace ARCH-000009
 * @input context: 一要求の固定対象。
 * @returns N/A: 検証のみ。
 * @precondition 登録と実体は検証済み。
 * @postcondition gitlink・入れ子Git・link Directoryなし。
 * @effect 有界Filesystem／Git読取り。
 * @failure 不明・上限超過は拒否。
 * @invariant 入れ子Repositoryを再帰削除しない。
 * @boundary 専用Worktree。
 * @security linkは追従しない。
 * @concurrency 上位の利用調停が必要。
 */
function rejectNestedRepositories(ctx: ReturnType<typeof context>) {
  const tracked = ctx.run(ctx.target, ["ls-files", "--stage", "-z"]);
  if (
    tracked.status !== 0 ||
    tracked.stdout.split("\0").some((line) => line.startsWith("160000 "))
  )
    throw new Error("worktree_nested_repository_unsupported");
  const directories = [ctx.target];
  let count = 0;
  while (directories.length) {
    const current = directories.pop();
    if (!current) break;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (++count > 100_000) throw new Error("worktree_scan_limit");
      if (entry.name.toLowerCase() === ".git") {
        if (current !== ctx.target)
          throw new Error("worktree_nested_repository_unsupported");
        continue;
      }
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) directories.push(path.join(current, entry.name));
    }
  }
}

/**
 * 一操作を実行し、失敗後も同対象と確定済み段階を返す。
 * @responsibility 全return／throwの部分Effect保持。
 * @trace ARCH-000009
 * @input Root、ID、期待Commitと操作。
 * @returns 非秘密のRepositoryWorktreeResult。
 * @precondition 呼出し元が認可・利用調停を維持する。
 * @postcondition unknownを不存在へ変換しない。
 * @effect 渡された固定操作のGit／Filesystem更新。
 * @failure 生stderrやHost Pathを公開せず一次分類を保持。
 * @invariant 自動Rollback・別対象retryなし。
 * @boundary Packageと技術操作。
 * @security 入力値はAuthorityではない。
 * @concurrency 同期処理、一要求内の30秒枠。
 */
function operate(
  capability: VerifiedRepositoryRoot,
  workspaceId: string,
  expectedCommit: string | null,
  action: (
    ctx: ReturnType<typeof context>,
    result: {
      effectIssued: boolean;
      worktreeRemoved: boolean | null;
      branchRemoved: boolean | null;
      workspaceDirectoryRetained: boolean | null;
    },
  ) => RepositoryWorktreeObservation,
): RepositoryWorktreeResult {
  let ctx: ReturnType<typeof context> | null = null;
  const progress = {
    effectIssued: false,
    worktreeRemoved: null as boolean | null,
    branchRemoved: null as boolean | null,
    workspaceDirectoryRetained: null as boolean | null,
  };
  try {
    if (
      expectedCommit !== null &&
      !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/u.test(expectedCommit)
    )
      throw new Error("worktree_commit_invalid");
    ctx = context(capability, workspaceId);
    const observation = action(ctx, progress);
    return {
      status: "completed",
      reason: "worktree_operation_completed",
      workspaceId,
      relativePath: ctx.relativePath,
      branch: ctx.branch,
      expectedCommit,
      ...progress,
      observation,
    };
  } catch (error) {
    const reason =
      error instanceof Error && /^worktree_[a-z_]+$/u.test(error.message)
        ? error.message
        : "worktree_observation_or_effect_failed";
    return {
      status: "blocked",
      reason,
      workspaceId,
      relativePath: ctx?.relativePath ?? null,
      branch: ctx?.branch ?? null,
      expectedCommit,
      ...progress,
      observation: null,
    };
  }
}

/**
 * 固定Commitから専用Branch／Worktreeを作る。
 * @responsibility 衝突拒否、共有dirty非継承、作成後照合。
 * @trace ARCH-000009
 * @input 検証済みRoot、workspaceId、full baseCommit。
 * @returns 作成結果又は同対象の部分失敗。
 * @precondition 上位が作成許可を確認する。
 * @postcondition HEAD・Branch・登録・clean一致時だけcompleted。
 * @effect 固定Directory、専用BranchとGit登録を作成。
 * @failure 衝突・外部filter・不明は停止。部分生成を消さない。
 * @invariant 元Tree／Branchをresetしない。
 * @boundary ローカルGitとRepository-local領域。
 * @security fixed Path／Baseのみ。
 * @concurrency Git標準排他を使用する。
 */
export function createRepositoryWorktree(
  capability: VerifiedRepositoryRoot,
  request: Readonly<{ workspaceId: string; baseCommit: string }>,
) {
  return operate(
    capability,
    request.workspaceId,
    request.baseCommit,
    (ctx, progress) => {
      const before = ctx.inspect();
      if (before.registered || before.directoryPresent || before.branchHead)
        throw new Error("worktree_target_exists");
      const base = ctx.run(ctx.root, [
        "rev-parse",
        "--verify",
        `${request.baseCommit}^{commit}`,
      ]);
      if (base.status !== 0 || base.stdout.trim() !== request.baseCommit)
        throw new Error("worktree_commit_invalid");
      const tree = ctx.run(ctx.root, [
        "ls-tree",
        "-r",
        "-z",
        request.baseCommit,
      ]);
      if (
        tree.status !== 0 ||
        tree.stdout.split("\0").some((entry) => entry.startsWith("160000 "))
      )
        throw new Error("worktree_nested_repository_unsupported");
      const ignored = ctx.run(ctx.owner, [
        "check-ignore",
        "--quiet",
        "--no-index",
        "--",
        ctx.relativePath,
      ]);
      if (ignored.status !== 0) throw new Error("worktree_runtime_not_ignored");
      const parent = path.dirname(ctx.target);
      if (safeDirectoryPath(ctx.owner, parent))
        throw new Error("worktree_target_exists");
      progress.effectIssued = true;
      // 各階層を個別作成・検証し、既存成果のあるWorkspaceを再利用しない。
      for (const relative of [".crdd", ".crdd/workspaces"]) {
        const directory = path.join(ctx.owner, relative);
        if (!safeDirectoryPath(ctx.owner, directory)) fs.mkdirSync(directory);
        safeDirectoryPath(ctx.owner, directory);
      }
      fs.mkdirSync(parent);
      if (!safeDirectoryPath(ctx.owner, parent))
        throw new Error("worktree_path_invalid");
      const added = ctx.run(ctx.owner, [
        "worktree",
        "add",
        "--no-track",
        "-b",
        ctx.branch,
        "--",
        ctx.target,
        request.baseCommit,
      ]);
      if (added.status !== 0) throw new Error("worktree_create_failed");
      const after = ctx.inspect();
      if (
        !after.registered ||
        !after.directoryPresent ||
        after.head !== request.baseCommit ||
        after.branchHead !== request.baseCommit ||
        after.dirty !== false
      )
        throw new Error("worktree_create_unconfirmed");
      return after;
    },
  );
}

/**
 * 同じ対象の登録・実体・Branch・dirtyを観測する。
 * @responsibility 作成／削除途中を通常の観測で再発見する。
 * @trace ARCH-000009
 * @input 検証済みRootとWorkspace UUID。
 * @returns 独立観測又はblocked。
 * @precondition 上位が閲覧許可を確認する。
 * @postcondition 不明を不存在へ補完しない。
 * @effect 有界Git／Filesystem読取りのみ。
 * @failure 対象不一致・観測不能は停止。
 * @invariant Worktree／Branch更新0。
 * @boundary ローカル実Git。
 * @security Host Path／生stderr非公開。
 * @concurrency 結果は現在観測であり将来状態の予約ではない。
 */
export function observeRepositoryWorktree(
  capability: VerifiedRepositoryRoot,
  workspaceId: string,
) {
  return operate(capability, workspaceId, null, (ctx) => ctx.inspect());
}

/**
 * 明示終了した専用WorktreeとBranchを順に削除する。
 * @responsibility exact期待HEAD、破棄範囲と段階別不存在確認。
 * @trace ARCH-000009
 * @input 検証済みRoot、UUID、期待HEAD、discardChanges（既定false）。
 * @returns 部分削除も同対象で返す。
 * @precondition 上位が採否・成果保全・非使用を処置期間中保証する。
 * @postcondition completedでは登録／Worktree／専用Ref不存在。
 * @effect 対象Worktree、専用Ref、空の親Directoryだけを削除。
 * @failure dirty未許可・lock・別HEAD・入れ子Git・不明は停止。
 * @invariant Direct、他Workspace、通常Branchは削除しない。
 * @boundary 標準Gitのworktree removeと期待値付きupdate-ref。
 * @security forceは明示破棄時一指定のみ。lock突破なし。
 * @concurrency Git Ref期待値比較と上位利用調停を併用する。
 */
export function disposeRepositoryWorktree(
  capability: VerifiedRepositoryRoot,
  request: Readonly<{
    workspaceId: string;
    expectedHead: string;
    discardChanges?: boolean;
  }>,
) {
  return operate(
    capability,
    request.workspaceId,
    request.expectedHead,
    (ctx, progress) => {
      let state = ctx.inspect();
      if (
        state.branchHead !== null &&
        state.branchHead !== request.expectedHead
      )
        throw new Error("worktree_head_changed");
      if (state.registered !== state.directoryPresent || state.prunable)
        throw new Error("worktree_target_mismatch");
      if (state.locked) throw new Error("worktree_locked");
      if (state.registered) {
        if (
          state.head !== request.expectedHead ||
          state.branchHead !== request.expectedHead
        )
          throw new Error("worktree_head_changed");
        if (state.dirty !== false && request.discardChanges !== true)
          throw new Error("worktree_changes_not_discarded");
        rejectNestedRepositories(ctx);
        // 処置直前にもGit登録・HEADと実体を再観測する。
        state = ctx.inspect();
        if (
          state.head !== request.expectedHead ||
          state.branchHead !== request.expectedHead ||
          state.locked ||
          state.prunable ||
          !state.registered ||
          !state.directoryPresent
        )
          throw new Error("worktree_target_changed");
        if (state.dirty !== false && request.discardChanges !== true)
          throw new Error("worktree_changes_not_discarded");
        progress.effectIssued = true;
        const removed = ctx.run(ctx.owner, [
          "worktree",
          "remove",
          ...(request.discardChanges === true ? ["--force"] : []),
          "--",
          ctx.target,
        ]);
        if (removed.status !== 0) throw new Error("worktree_remove_failed");
      }
      state = ctx.inspect();
      if (state.registered || state.directoryPresent)
        throw new Error("worktree_remove_unconfirmed");
      progress.worktreeRemoved = true;
      if (state.branchHead !== null) {
        if (state.branchHead !== request.expectedHead)
          throw new Error("worktree_head_changed");
        progress.effectIssued = true;
        const removed = ctx.run(ctx.owner, [
          "update-ref",
          "--no-deref",
          "-d",
          `refs/heads/${ctx.branch}`,
          request.expectedHead,
        ]);
        if (removed.status !== 0)
          throw new Error("worktree_branch_remove_failed");
      }
      state = ctx.inspect();
      if (
        state.branchHead !== null ||
        state.registered ||
        state.directoryPresent
      )
        throw new Error("worktree_branch_remove_unconfirmed");
      progress.branchRemoved = true;
      const parent = path.dirname(ctx.target);
      if (
        safeDirectoryPath(ctx.owner, parent) &&
        fs.readdirSync(parent).length === 0
      )
        fs.rmdirSync(parent);
      progress.workspaceDirectoryRetained = safeDirectoryPath(
        ctx.owner,
        parent,
      );
      return state;
    },
  );
}

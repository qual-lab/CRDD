/**
 * Worktreeの作成・観測・明示破棄を合成Repositoryの実Gitで確認する。
 * @responsibility dirty非継承、残存回収、対象拘束と途中失敗の反証。
 * @trace RFD-IT-029
 * @level IT
 * @scope Version Control技術APIのみ。上位Task・Merge判断・Dockerは対象外。
 * @boundary Repository-local試験領域とローカル実Git。
 */
import assert from "node:assert/strict";
import childProcess, { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { devNull } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import {
  createRepositoryWorktree,
  disposeRepositoryWorktree,
  observeRepositoryWorktree,
  verifyRepositoryRoot,
} from "../../src/index.ts";

const repository = path.resolve(
  fileURLToPath(new URL("../../../..", import.meta.url)),
);
const testsRoot = path.join(repository, ".crdd", "tests");
const empty = process.platform === "win32" ? "NUL" : devNull;

/**
 * 自己生成fixtureへ準備用Gitを発行する。
 * @responsibility 実験の対照とCommit操作を製品入口から区別する。
 * @trace RFD-IT-029
 * @precondition rootは本試験所有領域。
 * @stimulus 明示したGit引数。
 * @observation stdoutと終了値。
 * @oracle 正常終了だけを返す。
 * @cleanup fixture終了時にまとめて回収。
 * @boundary 実Git、外部通信なし。
 */
function git(root: string, args: string[], hooks = false) {
  return execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "commit.gpgSign=false",
      ...(!hooks ? ["-c", `core.hooksPath=${empty}`] : []),
      ...args,
    ],
    {
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
        ),
        GIT_CONFIG_GLOBAL: empty,
        GIT_CONFIG_SYSTEM: empty,
        GIT_TERMINAL_PROMPT: "0",
      },
      encoding: "utf8",
      windowsHide: true,
      timeout: 10_000,
    },
  ).trim();
}

/**
 * 固定Root内に合成Repositoryと回収hookを用意する。
 * @responsibility 全生成物をRepository-localへ閉じる。
 * @trace RFD-IT-029
 * @precondition testsRootは実Directoryである。
 * @stimulus 最小Commitとignoreを生成。
 * @observation Base Commitと検証済みRoot。
 * @oracle 検証成功、試験終了後Root不存在。
 * @cleanup 自己生成Rootのみをafterで削除。
 * @boundary 本体Git・認証・Dockerには触れない。
 */
function fixture(t: TestContext) {
  assert.equal(fs.lstatSync(testsRoot).isSymbolicLink(), false);
  assert.equal(fs.realpathSync.native(testsRoot), testsRoot);
  const root = fs.mkdtempSync(path.join(testsRoot, "worktree-management-"));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  git(root, ["init", "--initial-branch=main", "--template="]);
  git(root, ["config", "user.name", "Synthetic Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(
    path.join(root, ".gitignore"),
    ".crdd/\nignored.txt\n.env\n",
  );
  fs.writeFileSync(path.join(root, "source.txt"), "base\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "base"]);
  const base = git(root, ["rev-parse", "HEAD"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("fixture_root_invalid");
  const target = (id: string) =>
    path.join(root, ".crdd", "workspaces", id, "worktree");
  return { root, base, capability: verified.capability, target };
}

/**
 * 共有dirty非継承、linked起動、明示破棄と全不存在への再入場を確認する。
 * @responsibility 既存Treeと他Workspace保全、dirty等の削除許可を検証。
 * @trace RFD-IT-029
 * @precondition 固定Baseと二つのUUID。
 * @stimulus 作成、linkedから二件目作成、未採用変更を破棄。
 * @observation Tree内容、登録、専用Ref、元dirty。
 * @oracle 対象だけ消え、他作業は残る。
 * @cleanup fixtureのafter。
 * @boundary 実Git技術API、上位採否は代役。
 */
test("dirty共有Treeから独立作成し、明示破棄でWorktreeと未mergeBranchを残さない", (t) => {
  const f = fixture(t);
  const first = randomUUID();
  const second = randomUUID();
  fs.writeFileSync(path.join(f.root, "source.txt"), "human dirty\n");
  git(f.root, ["add", "source.txt"]);
  const originalIndex = fs.readFileSync(path.join(f.root, ".git", "index"));
  const created = createRepositoryWorktree(f.capability, {
    workspaceId: first,
    baseCommit: f.base,
  });
  assert.equal(created.status, "completed", JSON.stringify(created));
  assert.equal(
    fs.readFileSync(path.join(f.target(first), "source.txt"), "utf8"),
    "base\n",
  );
  const linked = verifyRepositoryRoot(f.target(first));
  assert.equal(linked.status, "completed");
  if (linked.status !== "completed") return;
  const other = createRepositoryWorktree(linked.capability, {
    workspaceId: second,
    baseCommit: f.base,
  });
  assert.equal(other.status, "completed", JSON.stringify(other));
  assert.equal(fs.existsSync(path.join(f.target(first), ".crdd")), false);
  fs.writeFileSync(
    path.join(f.target(first), "source.txt"),
    "rejected staged\n",
  );
  git(f.target(first), ["add", "source.txt"]);
  git(f.target(first), ["commit", "-m", "rejected commit"]);
  const head = git(f.target(first), ["rev-parse", "HEAD"]);
  fs.writeFileSync(
    path.join(f.target(first), "source.txt"),
    "rejected dirty\n",
  );
  fs.writeFileSync(path.join(f.target(first), "untracked.txt"), "untracked\n");
  fs.writeFileSync(path.join(f.target(first), "ignored.txt"), "generated\n");
  fs.writeFileSync(
    path.join(f.target(first), ".env"),
    "SYNTHETIC=not-a-credential\n",
  );
  const denied = disposeRepositoryWorktree(f.capability, {
    workspaceId: first,
    expectedHead: head,
  });
  assert.equal(denied.reason, "worktree_changes_not_discarded");
  assert.equal(denied.effectIssued, false);
  const disposed = disposeRepositoryWorktree(linked.capability, {
    workspaceId: first,
    expectedHead: head,
    discardChanges: true,
  });
  assert.equal(disposed.status, "completed", JSON.stringify(disposed));
  assert.equal(disposed.worktreeRemoved, true);
  assert.equal(disposed.branchRemoved, true);
  assert.equal(disposed.workspaceDirectoryRetained, false);
  assert.equal(fs.existsSync(path.dirname(f.target(first))), false);
  assert.equal(
    observeRepositoryWorktree(f.capability, first).observation?.branchHead,
    null,
  );
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: first,
      expectedHead: head,
    }).status,
    "completed",
  );
  assert.equal(
    observeRepositoryWorktree(f.capability, second).observation?.registered,
    true,
  );
  assert.equal(
    fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
    "human dirty\n",
  );
  assert.deepEqual(
    fs.readFileSync(path.join(f.root, ".git", "index")),
    originalIndex,
  );
  assert.equal(git(f.root, ["branch", "--show-current"]), "main");
  assert.equal(git(f.root, ["cat-file", "-t", head]), "commit");
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: second,
      expectedHead: f.base,
    }).status,
    "completed",
  );
});

/**
 * 採用取込後の不要WorktreeとBranchを回収する。
 * @responsibility 取込成果保全と親判断資料のOwner境界を検証。
 * @trace RFD-IT-029
 * @precondition 合成mainへfast-forward済み。
 * @stimulus 対象の明示終了。
 * @observation main内容、Refと親資料。
 * @oracle 採用成果・資料が残り、専用TreeとBranchは消える。
 * @cleanup fixtureのafter。
 * @boundary 採用判断は試験が代役、Git削除は製品API。
 */
test("採用取込後は成果をmainへ残し専用資源だけ削除する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).status,
    "completed",
  );
  fs.writeFileSync(path.join(f.target(id), "source.txt"), "adopted\n");
  git(f.target(id), ["add", "source.txt"]);
  git(f.target(id), ["commit", "-m", "adopted"]);
  const head = git(f.target(id), ["rev-parse", "HEAD"]);
  git(f.root, ["merge", "--ff-only", `crdd/workspace/${id}`]);
  const record = path.join(path.dirname(f.target(id)), "merge-result.md");
  fs.writeFileSync(record, "synthetic adoption record\n");
  const result = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: head,
  });
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(result.workspaceDirectoryRetained, true);
  assert.equal(
    fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
    "adopted\n",
  );
  assert.equal(fs.existsSync(record), true);
  assert.equal(fs.existsSync(f.target(id)), false);
});

/**
 * 衝突・期待HEAD・lock・入れ子Git・祖先linkを拒否する。
 * @responsibility 明示破棄でも技術対象の確認を省略しない。
 * @trace RFD-IT-029
 * @precondition 自己生成Worktreeと別Repository。
 * @stimulus 不正ID、既存対象、lock、gitlink、入れ子Git。
 * @observation Effect発行なしと資源保持。
 * @oracle Direct通常Branch・別対象の破壊0。
 * @cleanup fixtureのafter。
 * @boundary 実Git／Filesystem。
 */
test("衝突・lock・別HEAD・入れ子Gitは明示破棄でも拒否する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: "../main",
      baseCommit: f.base,
    }).reason,
    "worktree_id_invalid",
  );
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: "main",
    }).effectIssued,
    false,
  );
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).status,
    "completed",
  );
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).reason,
    "worktree_target_exists",
  );
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: "0".repeat(40),
      discardChanges: true,
    }).reason,
    "worktree_head_changed",
  );
  git(f.root, ["worktree", "lock", f.target(id)]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_locked",
  );
  git(f.root, ["worktree", "unlock", f.target(id)]);
  const nested = path.join(f.target(id), "nested");
  fs.mkdirSync(nested);
  git(nested, ["init", "--template="]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_nested_repository_unsupported",
  );
  fs.rmSync(nested, { recursive: true, force: true });
  git(f.target(id), [
    "update-index",
    "--add",
    "--cacheinfo",
    `160000,${f.base},module`,
  ]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_nested_repository_unsupported",
  );
  git(f.target(id), ["update-index", "--force-remove", "module"]);
  const moved = path.join(f.root, ".crdd", "moved");
  git(f.root, ["worktree", "move", f.target(id), moved]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_branch_in_use",
  );
  git(f.root, ["worktree", "move", moved, f.target(id)]);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).status,
    "completed",
  );
  assert.equal(git(f.root, ["branch", "--show-current"]), "main");
});

/**
 * 実作成後の通知喪失とBranch削除失敗を同対象で再入場する。
 * @responsibility 過去のunknownを成功化せず現在状態から終了する。
 * @trace RFD-IT-029
 * @precondition 固定Gitの実処理に限定したProcess代役。
 * @stimulus 作成実行後timeout、Worktree除去後Ref失敗。
 * @observation 返却段階と実Git登録・Ref。
 * @oracle 同IDで再観測・回収、別ID再試行なし。
 * @cleanup Process差替えを必ず復元しfixture回収。
 * @boundary 実Git＋失敗通知代役。実時間timeoutの実証ではない。
 */
test("部分作成とWorktree削除後のBranch失敗は同じ対象で収束する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  const original = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    const result = Reflect.apply(original, childProcess, args);
    if (
      Array.isArray(args[1]) &&
      args[1].includes("add") &&
      args[1].includes("worktree")
    )
      return {
        ...result,
        error: Object.assign(new Error("synthetic timeout"), {
          code: "ETIMEDOUT",
        }),
      };
    return result;
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  const created = createRepositoryWorktree(f.capability, {
    workspaceId: id,
    baseCommit: f.base,
  });
  assert.equal(created.reason, "worktree_git_outcome_unknown");
  assert.equal(created.effectIssued, true);
  assert.equal(created.workspaceId, id);
  childProcess.spawnSync = original;
  syncBuiltinESMExports();
  assert.equal(
    observeRepositoryWorktree(f.capability, id).observation?.registered,
    true,
  );
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    if (Array.isArray(args[1]) && args[1].includes("update-ref"))
      return {
        pid: 0,
        output: [],
        stdout: "",
        stderr: "synthetic",
        status: 1,
        signal: null,
      };
    return Reflect.apply(original, childProcess, args);
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  const disposed = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: f.base,
  });
  assert.equal(disposed.reason, "worktree_branch_remove_failed");
  assert.equal(disposed.worktreeRemoved, true);
  assert.equal(disposed.branchRemoved, null);
  childProcess.spawnSync = original;
  syncBuiltinESMExports();
  const middle = observeRepositoryWorktree(f.capability, id);
  assert.deepEqual(middle.observation, {
    registered: false,
    directoryPresent: false,
    branchHead: f.base,
    head: null,
    locked: false,
    prunable: false,
    dirty: null,
  });
  const retried = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: f.base,
  });
  assert.equal(retried.status, "completed", JSON.stringify(retried));
  assert.equal(retried.branchRemoved, true);
});

/**
 * 外部filter設定を拒否し、checkout hookを起動しない。
 * @responsibility 版展開は読取りdiffと別境界として反証する。
 * @trace RFD-IT-029
 * @precondition 無害なmarkerの発火対照。
 * @stimulus post-checkout hookとsmudge設定。
 * @observation markerとAPI結果。
 * @oracle 対照は発火、本番は非発火／要求前拒否。
 * @cleanup fixtureのafter。
 * @boundary 実Gitと合成shell hookのみ。外部通信なし。
 */
test("checkout hookを抑止しclean・smudge・process設定を拒否する", (t) => {
  const f = fixture(t);
  const marker = path.join(f.root, ".crdd", "hook-marker");
  fs.mkdirSync(path.dirname(marker), { recursive: true });
  const hook = path.join(f.root, ".git", "hooks", "post-checkout");
  fs.mkdirSync(path.dirname(hook), { recursive: true });
  fs.writeFileSync(
    hook,
    `#!/bin/sh\nprintf fired > '${marker.replaceAll("\\", "/")}'\n`,
    { mode: 0o755 },
  );
  git(f.root, ["checkout", "main"], true);
  assert.equal(fs.existsSync(marker), true);
  fs.unlinkSync(marker);
  const id = randomUUID();
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).status,
    "completed",
  );
  assert.equal(fs.existsSync(marker), false);
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
    }).status,
    "completed",
  );
  for (const type of ["clean", "smudge", "process"]) {
    git(f.root, ["config", `filter.synthetic.${type}`, "must-not-execute"]);
    const result = createRepositoryWorktree(f.capability, {
      workspaceId: randomUUID(),
      baseCommit: f.base,
    });
    assert.equal(result.reason, "worktree_external_filter_unsupported");
    assert.equal(result.effectIssued, false);
    git(f.root, ["config", "--unset", `filter.synthetic.${type}`]);
  }
  // 実checkoutがsmudgeを起動する対照を作り、本番拒否の根拠とする。
  fs.writeFileSync(
    path.join(f.root, ".gitattributes"),
    "source.txt filter=synthetic\n",
  );
  git(f.root, ["add", ".gitattributes"]);
  git(f.root, ["commit", "-m", "attribute"]);
  const current = git(f.root, ["rev-parse", "HEAD"]);
  const filterMarker = path.join(f.root, ".crdd", "filter-marker");
  const script = path.join(f.root, ".crdd", "filter.ts");
  fs.writeFileSync(
    script,
    `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(filterMarker)}, 'fired'); process.stdout.write(fs.readFileSync(0));`,
  );
  git(f.root, [
    "config",
    "filter.synthetic.smudge",
    `"${process.execPath.replaceAll("\\", "/")}" "${script.replaceAll("\\", "/")}"`,
  ]);
  const control = path.join(f.root, ".crdd", "control");
  git(f.root, ["worktree", "add", "--detach", control, current]);
  assert.equal(fs.existsSync(filterMarker), true);
  fs.unlinkSync(filterMarker);
  const rejected = createRepositoryWorktree(f.capability, {
    workspaceId: randomUUID(),
    baseCommit: current,
  });
  assert.equal(rejected.reason, "worktree_external_filter_unsupported");
  assert.equal(rejected.effectIssued, false);
  assert.equal(fs.existsSync(filterMarker), false);
  git(f.root, ["worktree", "remove", "--force", control]);
});

/**
 * 祖先junction／symlinkと既存Branchは衝突として停止する。
 * @responsibility 別Pathへの作成・削除0を実Filesystemで反証する。
 * @trace RFD-IT-029
 * @precondition 自己生成Directory間のlink。
 * @stimulus workspaces祖先差替えと専用Branchだけの残存。
 * @observation blocked、marker、Ref。
 * @oracle link先非変更、既存Branch非変更。
 * @cleanup fixtureのafter。
 * @boundary ローカル合成Filesystemのみ。
 */
test("祖先linkと既存Branchを上書きしない", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  fs.mkdirSync(path.join(f.root, ".crdd"));
  const elsewhere = path.join(f.root, "elsewhere");
  fs.mkdirSync(elsewhere);
  const link = path.join(f.root, ".crdd", "workspaces");
  fs.symlinkSync(
    elsewhere,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  const linked = createRepositoryWorktree(f.capability, {
    workspaceId: id,
    baseCommit: f.base,
  });
  assert.equal(linked.reason, "worktree_path_invalid");
  assert.equal(linked.effectIssued, false);
  assert.deepEqual(fs.readdirSync(elsewhere), []);
  fs.unlinkSync(link);
  git(f.root, ["branch", `crdd/workspace/${id}`, f.base]);
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).reason,
    "worktree_target_exists",
  );
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
    }).status,
    "completed",
  );
});

/**
 * Base gitlink、ignoredのみ、削除直前dirty化を個別に反証する。
 * @responsibility 同時刺激で隠れる拒否条件を独立Oracleにする。
 * @trace RFD-IT-029
 * @precondition 各刺激前は条件外のclean状態。
 * @stimulus gitlink Base、ignored一件、二観測間の合成変更。
 * @observation Effect発行、remove要求数、元内容とRef。
 * @oracle 各拒否と対象保全。直前dirtyではremove要求0。
 * @cleanup Process差替え復元、自己生成fixture回収。
 * @boundary 実Gitと二観測間の変更を発生させる代役。
 */
test("Base gitlinkとignored残存と削除直前dirtyを個別に拒否する", (t) => {
  const f = fixture(t);
  const invalidId = randomUUID();
  git(f.root, [
    "update-index",
    "--add",
    "--cacheinfo",
    `160000,${f.base},module`,
  ]);
  git(f.root, ["commit", "-m", "gitlink base"]);
  const gitlinkBase = git(f.root, ["rev-parse", "HEAD"]);
  const rejectedBase = createRepositoryWorktree(f.capability, {
    workspaceId: invalidId,
    baseCommit: gitlinkBase,
  });
  assert.equal(rejectedBase.reason, "worktree_nested_repository_unsupported");
  assert.equal(rejectedBase.effectIssued, false);
  assert.equal(fs.existsSync(path.dirname(f.target(invalidId))), false);
  assert.equal(
    observeRepositoryWorktree(f.capability, invalidId).observation?.branchHead,
    null,
  );
  const id = randomUUID();
  assert.equal(
    createRepositoryWorktree(f.capability, {
      workspaceId: id,
      baseCommit: f.base,
    }).status,
    "completed",
  );
  const ignored = path.join(f.target(id), "ignored.txt");
  fs.writeFileSync(ignored, "keep until explicit discard\n");
  const refused = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: f.base,
  });
  assert.equal(refused.reason, "worktree_changes_not_discarded");
  assert.equal(refused.effectIssued, false);
  assert.equal(
    fs.readFileSync(ignored, "utf8"),
    "keep until explicit discard\n",
  );
  fs.unlinkSync(ignored);
  const original = childProcess.spawnSync;
  let statusCount = 0;
  let removes = 0;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  childProcess.spawnSync = ((
    ...args: Parameters<typeof childProcess.spawnSync>
  ) => {
    if (Array.isArray(args[1]) && args[1].includes("remove")) removes++;
    const result = Reflect.apply(original, childProcess, args);
    if (
      Array.isArray(args[1]) &&
      args[1].includes("status") &&
      ++statusCount === 1
    )
      fs.writeFileSync(ignored, "late ignored\n");
    return result;
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  const late = disposeRepositoryWorktree(f.capability, {
    workspaceId: id,
    expectedHead: f.base,
  });
  childProcess.spawnSync = original;
  syncBuiltinESMExports();
  assert.equal(statusCount, 2);
  assert.equal(removes, 0);
  assert.equal(late.reason, "worktree_changes_not_discarded");
  assert.equal(late.effectIssued, false);
  assert.equal(fs.readFileSync(ignored, "utf8"), "late ignored\n");
  assert.equal(
    observeRepositoryWorktree(f.capability, id).observation?.registered,
    true,
  );
  assert.equal(
    disposeRepositoryWorktree(f.capability, {
      workspaceId: id,
      expectedHead: f.base,
      discardChanges: true,
    }).status,
    "completed",
  );
});

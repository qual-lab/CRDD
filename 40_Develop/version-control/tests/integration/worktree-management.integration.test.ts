/**
 * Worktreeの作成・観測・明示破棄を合成Repositoryの実Gitで確認する。
 * @packageDocumentation
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
  createCommit,
  mergeCommit,
  readRepositoryRevision,
  createWorktree,
  removeWorktree,
  getWorktree,
  getRepository,
  createReference,
  removeReference,
} from "../../src/index.ts";

const repository = path.resolve(
  fileURLToPath(new URL("../../../..", import.meta.url)),
);
const testsRoot = path.join(repository, ".crdd", "tests");
const empty = process.platform === "win32" ? "NUL" : devNull;

/**
 * 上位が選んだRefだけをCAS作成・削除し、別OID・Symbolic Ref・使用中Branchを拒否する。
 * @responsibility Ref操作がWorkspaceやCandidateの名前を生成しないことを実Gitで確認する。
 * @trace RFD-IT-029
 * @precondition 自己生成Repositoryと確認済みCommit。
 * @stimulus 作成・同値再入場・別OID・別名参照・使用中・削除・不存在再入場。
 * @observation 元Ref／Commit、HEADと各Effect結果。
 * @oracle 期待値不一致では更新せず、削除後は明示不存在、ObjectとHEADは不変。
 * @cleanup 元fixture全体を通常のafterで回収する。
 * @boundary Repository-local実Gitのみ。送信・Provider・Dockerなし。
 */
test("Referenceは上位指定名と期待OIDを保持し別対象と使用中Branchを処置しない", (t) => {
  const f = fixture(t);
  const name = `refs/heads/synthetic-held/${randomUUID()}`;
  const created = createReference(f.capability, { name, commitId: f.base });
  assert.equal(created.status, "completed", created.reason);
  assert.equal(created.present, true);
  assert.equal(created.effectConfirmed, true);
  assert.equal(git(f.root, ["rev-parse", name]), f.base);
  const repeated = createReference(f.capability, { name, commitId: f.base });
  assert.equal(repeated.status, "completed");
  assert.equal(repeated.effectIssued, false);
  const changed = removeReference(f.capability, {
    name,
    expectedCommitId: "0".repeat(f.base.length),
  });
  assert.equal(changed.reason, "reference_commit_changed");
  assert.equal(changed.effectIssued, false);
  const alias = `refs/heads/synthetic-alias/${randomUUID()}`;
  git(f.root, ["symbolic-ref", alias, name]);
  assert.equal(
    removeReference(f.capability, { name: alias, expectedCommitId: f.base })
      .reason,
    "reference_not_direct",
  );
  assert.equal(git(f.root, ["rev-parse", name]), f.base);
  git(f.root, ["symbolic-ref", "--delete", alias]);
  const active = removeReference(f.capability, {
    name: "refs/heads/main",
    expectedCommitId: f.base,
  });
  assert.equal(active.reason, "reference_checked_out");
  assert.equal(active.effectIssued, false);
  const removed = removeReference(f.capability, {
    name,
    expectedCommitId: f.base,
  });
  assert.equal(removed.status, "completed", removed.reason);
  assert.equal(removed.present, false);
  assert.equal(removed.effectConfirmed, true);
  const absent = removeReference(f.capability, {
    name,
    expectedCommitId: f.base,
  });
  assert.equal(absent.status, "completed");
  assert.equal(absent.present, false);
  assert.equal(absent.effectIssued, false);
  assert.equal(git(f.root, ["cat-file", "-t", f.base]), "commit");
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  assert.throws(
    () =>
      createReference(f.capability, { name: "../outside", commitId: f.base }),
    /reference_input_invalid/u,
  );
  const linked = path.join(f.root, "linked-ref-observation");
  git(f.root, ["worktree", "add", "--detach", linked, f.base]);
  const verifiedLinked = getRepository(linked);
  assert.equal(verifiedLinked.status, "completed");
  if (verifiedLinked.status !== "completed")
    throw Error("linked_fixture_invalid");
  const original = childProcess.spawnSync;
  let commands = 0;
  childProcess.spawnSync = (() => {
    commands++;
    throw Error("unexpected_git_command");
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  try {
    for (const privateName of [
      "refs/worktree/held",
      "refs/bisect/held",
      "refs/rewritten/held",
    ]) {
      assert.throws(
        () =>
          createReference(verifiedLinked.capability, {
            name: privateName,
            commitId: f.base,
          }),
        /reference_input_invalid/u,
      );
      assert.throws(
        () =>
          removeReference(verifiedLinked.capability, {
            name: privateName,
            expectedCommitId: f.base,
          }),
        /reference_input_invalid/u,
      );
    }
    assert.equal(commands, 0);
  } finally {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  }
  git(f.root, ["worktree", "remove", linked]);
  childProcess.spawnSync = (() => ({
    error: Object.assign(new Error("synthetic spawn failure"), {
      code: "ENOENT",
    }),
    signal: null,
    status: null,
    stdout: null,
    stderr: null,
    output: [],
    pid: 0,
  })) as unknown as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  try {
    const unavailable = getWorktree(
      f.capability,
      workspaceWorktreeTarget(randomUUID()),
    );
    assert.equal(unavailable.reason, "worktree_git_outcome_unknown");
    assert.equal(unavailable.effectIssued, false);
  } finally {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  }
});

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
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("fixture_root_invalid");
  /**
   * 所有Worktreeの固定相対配置を試験Rootへ結合する。
   * @responsibility 所有Worktreeの固定相対配置を試験Rootへ結合する。
   * @trace RFD-IT-029
   * @precondition fixtureのRepo Rootと試験UUID。
   * @stimulus 固定workspaces配置へidを結合する。
   * @observation 期待するWorktree絶対Path。
   * @oracle 作成・観測・削除の結果を同じ対象Pathへ照合する。
   * @cleanup 実WorktreeとRefは呼出し元が正式処理で回収する。
   * @boundary 試験の期待Path計算のみ。資源は生成しない。
   */
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
  const created = createWorktree(f.capability, {
    ...workspaceWorktreeTarget(first),
    baseCommit: f.base,
  });
  assert.equal(created.status, "completed", JSON.stringify(created));
  assert.equal(
    fs.readFileSync(path.join(f.target(first), "source.txt"), "utf8"),
    "base\n",
  );
  const linked = getRepository(f.target(first));
  assert.equal(linked.status, "completed");
  if (linked.status !== "completed") return;
  const other = createWorktree(linked.capability, {
    ...workspaceWorktreeTarget(second),
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
  const denied = removeWorktree(f.capability, {
    ...workspaceWorktreeTarget(first),
    expectedHead: head,
  });
  assert.equal(denied.reason, "worktree_changes_not_discarded");
  assert.equal(denied.effectIssued, false);
  const disposed = removeWorktree(linked.capability, {
    ...workspaceWorktreeTarget(first),
    expectedHead: head,
    discardChanges: true,
  });
  assert.equal(disposed.status, "completed", JSON.stringify(disposed));
  assert.equal(disposed.worktreeRemoved, true);
  assert.equal(disposed.branchRemoved, true);
  assert.equal(disposed.parentDirectoryRetained, true);
  assert.equal(fs.existsSync(path.dirname(f.target(first))), true);
  assert.equal(
    getWorktree(f.capability, workspaceWorktreeTarget(first)).observation
      ?.branchHead,
    null,
  );
  assert.equal(
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(first),
      expectedHead: head,
    }).status,
    "completed",
  );
  assert.equal(
    getWorktree(f.capability, workspaceWorktreeTarget(second)).observation
      ?.registered,
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
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(second),
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
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
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
  const result = removeWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
    expectedHead: head,
  });
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(result.parentDirectoryRetained, true);
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
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget("../main"),
      baseCommit: f.base,
    }).reason,
    "worktree_target_invalid",
  );
  assert.equal(
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      baseCommit: "main",
    }).effectIssued,
    false,
  );
  assert.equal(
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      baseCommit: f.base,
    }).status,
    "completed",
  );
  assert.equal(
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      baseCommit: f.base,
    }).reason,
    "worktree_target_exists",
  );
  assert.equal(
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      expectedHead: "0".repeat(40),
      discardChanges: true,
    }).reason,
    "worktree_head_changed",
  );
  git(f.root, ["worktree", "lock", f.target(id)]);
  assert.equal(
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
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
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
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
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_nested_repository_unsupported",
  );
  git(f.target(id), ["update-index", "--force-remove", "module"]);
  const moved = path.join(f.root, ".crdd", "moved");
  git(f.root, ["worktree", "move", f.target(id), moved]);
  assert.equal(
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      expectedHead: f.base,
      discardChanges: true,
    }).reason,
    "worktree_branch_in_use",
  );
  git(f.root, ["worktree", "move", moved, f.target(id)]);
  assert.equal(
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
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
  const created = createWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
    baseCommit: f.base,
  });
  assert.equal(created.reason, "worktree_git_outcome_unknown");
  assert.equal(created.effectIssued, true);
  assert.equal(created.relativePath, workspaceWorktreeTarget(id).relativePath);
  childProcess.spawnSync = original;
  syncBuiltinESMExports();
  assert.equal(
    getWorktree(f.capability, workspaceWorktreeTarget(id)).observation
      ?.registered,
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
  const disposed = removeWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
    expectedHead: f.base,
  });
  assert.equal(disposed.reason, "worktree_branch_remove_failed");
  assert.equal(disposed.worktreeRemoved, true);
  assert.equal(disposed.branchRemoved, null);
  childProcess.spawnSync = original;
  syncBuiltinESMExports();
  const middle = getWorktree(f.capability, workspaceWorktreeTarget(id));
  assert.deepEqual(middle.observation, {
    registered: false,
    directoryPresent: false,
    branchHead: f.base,
    head: null,
    locked: false,
    prunable: false,
    dirty: null,
  });
  const retried = removeWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
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
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      baseCommit: f.base,
    }).status,
    "completed",
  );
  assert.equal(fs.existsSync(marker), false);
  assert.equal(
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      expectedHead: f.base,
    }).status,
    "completed",
  );
  for (const type of ["clean", "smudge", "process"]) {
    git(f.root, ["config", `filter.synthetic.${type}`, "must-not-execute"]);
    const result = createWorktree(f.capability, {
      ...workspaceWorktreeTarget(randomUUID()),
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
  const rejected = createWorktree(f.capability, {
    ...workspaceWorktreeTarget(randomUUID()),
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
  const linked = createWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
    baseCommit: f.base,
  });
  assert.equal(linked.reason, "worktree_path_invalid");
  assert.equal(linked.effectIssued, false);
  assert.deepEqual(fs.readdirSync(elsewhere), []);
  fs.unlinkSync(link);
  git(f.root, ["branch", `crdd/workspace/${id}`, f.base]);
  assert.equal(
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      baseCommit: f.base,
    }).reason,
    "worktree_target_exists",
  );
  assert.equal(
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
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
  const rejectedBase = createWorktree(f.capability, {
    ...workspaceWorktreeTarget(invalidId),
    baseCommit: gitlinkBase,
  });
  assert.equal(rejectedBase.reason, "worktree_nested_repository_unsupported");
  assert.equal(rejectedBase.effectIssued, false);
  assert.equal(fs.existsSync(path.dirname(f.target(invalidId))), false);
  assert.equal(
    getWorktree(f.capability, workspaceWorktreeTarget(invalidId)).observation
      ?.branchHead,
    null,
  );
  const id = randomUUID();
  assert.equal(
    createWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      baseCommit: f.base,
    }).status,
    "completed",
  );
  const ignored = path.join(f.target(id), "ignored.txt");
  fs.writeFileSync(ignored, "keep until explicit discard\n");
  const refused = removeWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
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
  const late = removeWorktree(f.capability, {
    ...workspaceWorktreeTarget(id),
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
    getWorktree(f.capability, workspaceWorktreeTarget(id)).observation
      ?.registered,
    true,
  );
  assert.equal(
    removeWorktree(f.capability, {
      ...workspaceWorktreeTarget(id),
      expectedHead: f.base,
      discardChanges: true,
    }).status,
    "completed",
  );
});

function workspaceWorktreeTarget(workspaceId: string) {
  return {
    relativePath: `.crdd/workspaces/${workspaceId}/worktree`,
    branch: `crdd/workspace/${workspaceId}`,
  };
}

/**
 * 用途名を持たない対象でMain／Linkedを同じ入口から観測する。
 * @responsibility Path／Branch選択が利用側にあり、Mainを削除しないことを確認する。
 * @trace RFD-IT-029
 * @precondition 自己生成Repository。
 * @stimulus Main取得、任意の技術名でLinked生成・取得・削除。
 * @observation 実HEAD・Branch・登録・親Directory。
 * @oracle 同じ入口で対象が一致し、共有HEADと既存親は不変。
 * @cleanup fixture afterで今回領域だけを回収。
 * @boundary ローカル実Gitのみ。
 */
test("Worktreeは用途名なしのPathとBranchでMain／Linkedを共通観測する", (t) => {
  const f = fixture(t);
  const main = getWorktree(f.capability);
  assert.equal(main.status, "completed", main.reason);
  assert.equal(main.relativePath, ".");
  assert.equal(main.branch, "main");
  assert.equal(main.observation?.head, f.base);
  const target = {
    relativePath: `.crdd/technical/${randomUUID()}/tree`,
    branch: `synthetic/${randomUUID()}`,
  };
  fs.mkdirSync(path.dirname(path.join(f.root, target.relativePath)), {
    recursive: true,
  });
  const created = createWorktree(f.capability, {
    ...target,
    baseCommit: f.base,
  });
  assert.equal(created.status, "completed", created.reason);
  const linked = getRepository(path.join(f.root, target.relativePath));
  assert.equal(linked.status, "completed");
  if (linked.status !== "completed") throw Error("linked_unavailable");
  const current = getWorktree(linked.capability);
  assert.equal(current.status, "completed", current.reason);
  assert.equal(current.relativePath, target.relativePath);
  assert.equal(current.branch, target.branch);
  assert.equal(current.observation?.head, f.base);
  const mainRemoval = removeWorktree(f.capability, {
    relativePath: ".",
    branch: "main",
    expectedHead: f.base,
  });
  assert.equal(mainRemoval.status, "blocked");
  assert.equal(mainRemoval.effectIssued, false);
  const removed = removeWorktree(linked.capability, {
    ...target,
    expectedHead: f.base,
  });
  assert.equal(removed.status, "completed", removed.reason);
  assert.equal(removed.parentDirectoryRetained, true);
  assert.equal(
    fs
      .lstatSync(path.dirname(path.join(f.root, target.relativePath)))
      .isDirectory(),
    true,
  );
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
});

/**
 * Main外の正規Linkedと未CommitのMainを実体から区別する。
 * @responsibility 相対Pathの見かけや全0HEADを実Commitへ昇格しない。
 * @trace RFD-IT-029
 * @precondition 新品試験Rootと正規Git登録。
 * @stimulus Main兄弟のLinked取得、未Commit Repository取得。
 * @observation 同じRepositoryのHEADとnullable head。
 * @oracle Linkedを正常観測し、未Commitはnull。
 * @cleanup 今回作成したexact Rootだけ回収する。
 * @boundary 非AI・非Dockerの実Git。
 */
test("getWorktreeはMain外の正規Linkedと未Commitを原本から観測する", (t) => {
  const f = fixture(t);
  const sibling = `${f.root}-linked`;
  t.after(() => fs.rmSync(sibling, { recursive: true, force: true }));
  git(f.root, ["worktree", "add", "--detach", sibling, f.base]);
  const linked = getRepository(sibling);
  assert.equal(linked.status, "completed");
  if (linked.status !== "completed") throw Error("linked_missing");
  const observed = getWorktree(linked.capability);
  assert.equal(observed.status, "completed", observed.reason);
  assert.equal(observed.observation?.head, f.base);
  const unborn = fs.mkdtempSync(path.join(testsRoot, "worktree-unborn-"));
  t.after(() => fs.rmSync(unborn, { recursive: true, force: true }));
  git(unborn, ["init", "--initial-branch=main", "--template="]);
  const root = getRepository(unborn);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") throw Error("unborn_root_missing");
  const empty = getWorktree(root.capability);
  assert.equal(empty.status, "completed", empty.reason);
  assert.equal(empty.observation?.head, null);
  assert.equal(empty.observation?.branchHead, null);
});

/**
 * 完成操作がMain／LinkedのIndex・HEAD・Refを変更せず選択Commitだけを生成する。
 * @responsibility 上位の保持Ref確保とCommit Object生成を分離する。
 * @trace RFD-IT-029
 * @precondition 新品Mainと任意の技術名のLinked。
 * @stimulus createCommit単独、明示Ref観測、Ref確保。
 * @observation raw Index、HEAD、全Ref、選択Blobと返却OID。
 * @oracle Commit単独ではIndex・HEAD・Ref不変、Ref読取り不明は不存在へ畳まない。
 * @cleanup fixture afterで今回Rootのみ回収する。
 * @boundary ローカル実Git。AI・Docker・送信なし。
 */
test("createCommitはMain／Linkedで通常IndexとHEADとRefを更新しない", (t) => {
  for (const mode of ["main", "linked"]) {
    const f = fixture(t);
    const id = randomUUID();
    const target = {
      relativePath: `.crdd/technical/${id}/tree`,
      branch: `synthetic/${id}`,
    };
    let directory = f.root;
    let repository = f.capability;
    if (mode === "linked") {
      const created = createWorktree(f.capability, {
        ...target,
        baseCommit: f.base,
      });
      assert.equal(created.status, "completed", created.reason);
      directory = path.join(f.root, target.relativePath);
      const acquired = getRepository(directory);
      assert.equal(acquired.status, "completed");
      if (acquired.status !== "completed") throw Error("linked_missing");
      repository = acquired.capability;
    }
    const temporaryDirectory = `.crdd/commit-area/${id}`;
    fs.mkdirSync(path.join(f.root, temporaryDirectory), { recursive: true });
    const indexName = git(directory, ["rev-parse", "--git-path", "index"]);
    const index = path.resolve(directory, indexName);
    const before = fs.readFileSync(index);
    const refs = git(f.root, [
      "for-each-ref",
      "--format=%(refname) %(objectname)",
    ]);
    fs.writeFileSync(path.join(directory, "source.txt"), "selected\n");
    const blob = git(directory, ["hash-object", "--no-filters", "source.txt"]);
    const result = createCommit(repository, {
      baseCommit: f.base,
      expectedHead: f.base,
      selection: [{ path: "source.txt", mode: "100644", blobId: blob }],
      message: "synthetic selected commit",
      temporaryDirectory,
    });
    assert.equal(result.status, "completed", result.reason);
    assert.equal(result.cleanupConfirmed, true);
    assert.ok(result.commitId);
    assert.equal(git(directory, ["rev-parse", "HEAD"]), f.base);
    assert.deepEqual(fs.readFileSync(index), before);
    assert.equal(
      git(f.root, ["for-each-ref", "--format=%(refname) %(objectname)"]),
      refs,
    );
    const reference = `refs/heads/held/${id}`;
    const absent = readRepositoryRevision(f.capability, { reference });
    assert.equal(absent.status, "completed");
    assert.equal(absent.present, false);
    assert.equal(absent.commitId, null);
    const original = childProcess.spawnSync;
    childProcess.spawnSync = ((command, args, options) => {
      const value = Reflect.apply(original, childProcess, [
        command,
        args,
        options,
      ]);
      return Array.isArray(args) &&
        args.includes("rev-parse") &&
        args.includes(reference)
        ? { ...value, status: 2 }
        : value;
    }) as typeof childProcess.spawnSync;
    syncBuiltinESMExports();
    try {
      const unknown = readRepositoryRevision(f.capability, { reference });
      assert.notEqual(unknown.status, "completed");
      assert.equal(unknown.present, null);
    } finally {
      childProcess.spawnSync = original;
      syncBuiltinESMExports();
    }
    assert.equal(
      createReference(f.capability, {
        name: reference,
        commitId: result.commitId,
      }).status,
      "completed",
    );
    assert.equal(git(f.root, ["rev-parse", reference]), result.commitId);
  }
});

/**
 * LinkedへのMergeをMainのHEAD／Index／MERGE_HEADへ誤配送しない。
 * @responsibility 現在Worktree固有の技術対象を維持する。
 * @trace RFD-IT-029
 * @precondition MainとLinkedが同じBaseを共有する。
 * @stimulus 選択Commitを生成しLinkedへ二親Merge。
 * @observation 双方のHEAD・File内容と実Merge親。
 * @oracle Linkedだけが二親Commitへ進み、Mainは不変。
 * @cleanup fixture afterで今回Rootだけ回収する。
 * @boundary 実Git、外部送信なし。
 */
test("mergeCommitは入力LinkedのHEADとIndexだけを更新する", (t) => {
  const f = fixture(t);
  const id = randomUUID();
  const target = {
    relativePath: `.crdd/technical/${id}/tree`,
    branch: `synthetic/${id}`,
  };
  assert.equal(
    createWorktree(f.capability, { ...target, baseCommit: f.base }).status,
    "completed",
  );
  const temporaryDirectory = `.crdd/commit-area/${id}`;
  fs.mkdirSync(path.join(f.root, temporaryDirectory), { recursive: true });
  fs.writeFileSync(path.join(f.root, "source.txt"), "selected\n");
  const blob = git(f.root, ["hash-object", "--no-filters", "source.txt"]);
  const fixed = createCommit(f.capability, {
    baseCommit: f.base,
    expectedHead: f.base,
    selection: [{ path: "source.txt", blobId: blob, mode: "100644" }],
    message: "fixed technical content",
    temporaryDirectory,
  });
  assert.equal(fixed.status, "completed", fixed.reason);
  assert.ok(fixed.commitId);
  fs.writeFileSync(path.join(f.root, "source.txt"), "base\n");
  const mainIndex = fs.readFileSync(path.join(f.root, ".git", "index"));
  const linked = getRepository(path.join(f.root, target.relativePath));
  assert.equal(linked.status, "completed");
  if (linked.status !== "completed") throw Error("linked_missing");
  const merged = mergeCommit(linked.capability, {
    baseCommit: f.base,
    sourceCommit: fixed.commitId,
    targetBranch: target.branch,
    expectedHead: f.base,
    message: "synthetic merge",
  });
  assert.equal(merged.status, "completed", merged.reason);
  assert.ok(merged.commitId);
  assert.equal(git(f.root, ["rev-parse", "HEAD"]), f.base);
  assert.deepEqual(
    fs.readFileSync(path.join(f.root, ".git", "index")),
    mainIndex,
  );
  assert.equal(
    fs.readFileSync(path.join(f.root, "source.txt"), "utf8"),
    "base\n",
  );
  assert.equal(
    git(path.join(f.root, target.relativePath), [
      "rev-list",
      "--parents",
      "-n",
      "1",
      "HEAD",
    ]),
    `${merged.commitId} ${f.base} ${fixed.commitId}`,
  );
  assert.equal(
    fs.readFileSync(
      path.join(f.root, target.relativePath, "source.txt"),
      "utf8",
    ),
    "selected\n",
  );
});

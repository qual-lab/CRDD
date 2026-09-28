/**
 * Repository Worktree Tree／Diff公開契約を実Git境界で検証する。
 *
 * @packageDocumentation
 * @responsibility 遅延Tree、変更区分、Query拘束Cursor、選択File差分およびPath拒否の合否判定を所有する。
 * @trace RFD-IT-008
 * @level IT
 * @scope version-control、worktree-view
 * @boundary RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  gitRepositoryWorktreeViewAdapter,
  observeRepositoryWorktreeFileDiff,
  observeRepositoryWorktreeTree,
  verifyRepositoryRoot,
} from "../../src/index.ts";

/**
 * Test Repositoryへ固定Git Commandを実行する。
 *
 * @responsibility Worktree View試験のRepository前提を決定論的に構築する。
 * @trace RFD-IT-008
 * @precondition rootはTestが作成した一時Repositoryである。
 * @stimulus shellを使わずGit CLIへ固定引数を渡す。
 * @observation stdoutをUTF-8 Textとして返す。
 * @oracle Exit 0以外をTest失敗として扱う。
 * @cleanup 呼出し元Testのafter hookがRepositoryを削除する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
function git(root: string, gitArguments: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...gitArguments], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

/**
 * Repository TreeをDirectory単位で展開し選択FileのPrepared／Working差分を読むことを検証する。
 *
 * @responsibility TreeとDiffが同じ検証済みRepository境界と変更区分を保持することを確認する。
 * @trace RFD-IT-008
 * @precondition 追跡済みDirectory、Prepared変更、Working変更および未追跡Fileを持つRepositoryを構築する。
 * @stimulus Root／Directory Pageと二つの変更File差分を要求する。
 * @observation Entry順序、変更Flag、Cursor、Patchおよび未追跡状態を観測する。
 * @oracle Directoryを全再帰展開せず、Prepared／Workingを混同せず、別Directory Cursorと越境Pathを拒否する。
 * @cleanup Test Repositoryを再帰削除する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
test("Repository Treeを遅延展開し選択Fileの差分を区分して読む", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-tree-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(
    path.join(root, "docs", "prepared.md"),
    "baseline\n",
    "utf8",
  );
  fs.writeFileSync(path.join(root, "docs", "working.md"), "baseline\n", "utf8");
  fs.writeFileSync(path.join(root, "root.txt"), "root\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "baseline"]);
  fs.writeFileSync(
    path.join(root, "docs", "prepared.md"),
    "prepared\n",
    "utf8",
  );
  git(root, ["add", "docs/prepared.md"]);
  fs.writeFileSync(path.join(root, "docs", "working.md"), "working\n", "utf8");
  fs.writeFileSync(path.join(root, "docs", "new.md"), "new\n", "utf8");

  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const changes = {
    preparedChanges: ["docs/prepared.md"],
    workingChanges: ["docs/working.md"],
    unregisteredPaths: ["docs/new.md"],
  } as const;
  const first = observeRepositoryWorktreeTree(
    verified.capability,
    changes,
    "",
    undefined,
    1,
    gitRepositoryWorktreeViewAdapter,
  );
  assert.deepEqual(first.entries, [
    {
      path: "docs",
      name: "docs",
      kind: "directory",
      prepared: true,
      working: true,
      unregistered: true,
    },
  ]);
  assert.ok(first.nextCursor);
  const second = observeRepositoryWorktreeTree(
    verified.capability,
    changes,
    "",
    first.nextCursor,
    1,
    gitRepositoryWorktreeViewAdapter,
  );
  assert.equal(second.entries[0]?.path, "root.txt");
  const docs = observeRepositoryWorktreeTree(
    verified.capability,
    changes,
    "docs",
    undefined,
    50,
    gitRepositoryWorktreeViewAdapter,
  );
  assert.deepEqual(
    docs.entries.map((entry) => [
      entry.path,
      entry.prepared,
      entry.working,
      entry.unregistered,
    ]),
    [
      ["docs/new.md", false, false, true],
      ["docs/prepared.md", true, false, false],
      ["docs/working.md", false, true, false],
    ],
  );
  const prepared = observeRepositoryWorktreeFileDiff(
    verified.capability,
    changes,
    "docs/prepared.md",
    gitRepositoryWorktreeViewAdapter,
  );
  assert.match(prepared.preparedPatch, /\+prepared/u);
  assert.equal(prepared.workingPatch, "");
  const working = observeRepositoryWorktreeFileDiff(
    verified.capability,
    changes,
    "docs/working.md",
    gitRepositoryWorktreeViewAdapter,
  );
  assert.match(working.workingPatch, /\+working/u);
  assert.throws(
    () =>
      observeRepositoryWorktreeTree(
        verified.capability,
        changes,
        "docs",
        first.nextCursor,
        10,
        gitRepositoryWorktreeViewAdapter,
      ),
    /repository_worktree_cursor_invalid/u,
  );
  assert.throws(
    () =>
      observeRepositoryWorktreeFileDiff(
        verified.capability,
        changes,
        "../outside.txt",
        gitRepositoryWorktreeViewAdapter,
      ),
    /repository_worktree_path_invalid/u,
  );
});

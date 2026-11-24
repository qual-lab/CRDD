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
import childProcess, { execFileSync } from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import test from "node:test";

import { readFileDiff } from "../../src/repository/changes.ts";
import { readFile } from "../../src/index.ts";
import { readWorkingSelections } from "../../src/repository/files.ts";
import { readTree, validateRelativePath } from "../../src/repository/files.ts";
import { getRepository } from "../../src/repository/location.ts";

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
 * 一括選択の変更分類、拒否条件とGit起動回数を実Worktreeで照合する。
 * @trace RFD-IT-008
 * @scope 同じ基準Commitの既存・新規・削除・両方欠測で単件観測と比較する。
 * @boundary 新品の試験Repository。元HEADを更新する試験操作は禁止する。
 */
test("一括選択はファイルごとにGitを起動せず欠測と削除を分ける", (t) => {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "crdd-vc-selection-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init", "--initial-branch=main"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  for (const name of ["modified.txt", "removed.txt", "unchanged.txt"])
    fs.writeFileSync(path.join(root, name), "original\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "baseline"]);
  const base = git(root, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(root, "modified.txt"), "changed\n");
  fs.writeFileSync(path.join(root, "new.txt"), "new\n");
  fs.unlinkSync(path.join(root, "removed.txt"));
  const { capability } = getRepository(root);
  assert.ok(capability);
  const paths = ["modified.txt", "removed.txt", "new.txt", "unchanged.txt"];
  const request = { baseCommit: base, expectedHead: base, paths };
  const commands: string[][] = [];
  const spawn = childProcess.spawnSync;
  const monitor = t.mock.method(childProcess, "spawnSync", ((
    ...args: Parameters<typeof spawn>
  ) => {
    if (Array.isArray(args[1])) commands.push([...args[1]]);
    return Reflect.apply(spawn, childProcess, args);
  }) as typeof spawn);
  syncBuiltinESMExports();
  let batch: ReturnType<typeof readWorkingSelections>;
  try {
    readFile(capability, { baseCommit: base, path: "modified.txt" });
    const fileCount = commands.length;
    commands.length = 0;
    readWorkingSelections(capability, { ...request, paths: ["modified.txt"] });
    const singleCount = commands.length;
    assert.equal(singleCount, 7);
    commands.length = 0;
    batch = readWorkingSelections(capability, {
      ...request,
      paths: [...paths, "absent.txt"],
    });
    assert.equal(commands.length, singleCount);
    assert.equal(commands.filter((args) => args.includes("ls-tree")).length, 1);
    assert.equal(
      commands.filter((args) => args.includes("for-each-ref")).length,
      2,
    );
    assert.equal(
      commands.filter((args) => args.includes("worktree")).length,
      3,
    );
    t.diagnostic(
      `Git起動回数: 単件読取り=${fileCount}、一括1 Path=${singleCount}、一括5 Path=${commands.length}`,
    );
    assert.equal(
      commands.some((args) => args.includes("status") || args.includes("diff")),
      false,
    );
  } finally {
    monitor.mock.restore();
    syncBuiltinESMExports();
  }
  assert.deepEqual(
    batch.selection,
    paths.map(
      (relativePath) =>
        readFile(capability, { baseCommit: base, path: relativePath })
          .selection,
    ),
  );
  assert.deepEqual(batch.changedPaths, [
    "modified.txt",
    "removed.txt",
    "new.txt",
  ]);
  assert.throws(
    () =>
      readWorkingSelections(capability, {
        ...request,
        expectedHead: "0".repeat(base.length),
      }),
    /repository_file_worktree_mismatch/u,
  );
  const empty = readWorkingSelections(capability, { ...request, paths: [] });
  assert.deepEqual(empty, { selection: [], changedPaths: [] });
  assert.ok(
    Object.isFrozen(empty.selection) && Object.isFrozen(empty.changedPaths),
  );
  assert.throws(
    () =>
      readWorkingSelections(capability, {
        ...request,
        paths: [],
        expectedHead: "0".repeat(base.length),
      }),
    /repository_file_worktree_mismatch/u,
  );
  assert.throws(
    () =>
      readWorkingSelections(
        { ...capability },
        {
          ...request,
          paths: [],
        },
      ),
    /worktree_repository_invalid/u,
  );
  const read = fs.readSync;
  const broken = t.mock.method(fs, "readSync", ((
    ...args: Parameters<typeof read>
  ) => {
    if (
      fs.fstatSync(args[0]).ino ===
      fs.statSync(path.join(root, "modified.txt")).ino
    )
      throw Object.assign(new Error("fixture-read-failed"), { code: "ENOENT" });
    return Reflect.apply(read, fs, args);
  }) as typeof read);
  try {
    assert.throws(
      () => readWorkingSelections(capability, request),
      /fixture-read-failed/u,
    );
  } finally {
    broken.mock.restore();
  }
  const alternate = git(root, [
    "commit-tree",
    git(root, ["rev-parse", "HEAD^{tree}"]),
    "-p",
    base,
    "-m",
    "alternate",
  ]);
  git(root, ["update-ref", "refs/heads/alternate", alternate]);
  for (const kind of ["head", "symbolic"]) {
    let injected = false;
    const mutation = t.mock.method(childProcess, "spawnSync", ((
      ...args: Parameters<typeof spawn>
    ) => {
      const command = kind === "head" ? "ls-tree" : "for-each-ref";
      if (!injected && Array.isArray(args[1]) && args[1].includes(command)) {
        injected = true;
        if (kind === "head")
          git(root, ["update-ref", "refs/heads/main", alternate]);
        else
          git(root, [
            "symbolic-ref",
            "refs/heads/main",
            "refs/heads/alternate",
          ]);
      }
      return Reflect.apply(spawn, childProcess, args);
    }) as typeof spawn);
    syncBuiltinESMExports();
    try {
      assert.throws(
        () => readWorkingSelections(capability, request),
        kind === "head"
          ? /repository_file_worktree_mismatch/u
          : /worktree_branch_not_direct/u,
      );
      assert.equal(injected, true);
    } finally {
      mutation.mock.restore();
      syncBuiltinESMExports();
      git(root, ["update-ref", "--no-deref", "refs/heads/main", base]);
    }
  }
  git(root, ["update-ref", "--no-deref", "HEAD", base]);
  try {
    assert.deepEqual(
      readWorkingSelections(capability, request).changedPaths,
      batch.changedPaths,
    );
  } finally {
    git(root, ["symbolic-ref", "HEAD", "refs/heads/main"]);
  }
  assert.equal(git(root, ["rev-parse", "HEAD"]), base);
});

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
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "crdd-vc-tree-"));
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
  for (const name of ["a.txt", "B.txt", "é.txt", "あ.txt"])
    fs.writeFileSync(path.join(root, "docs", name), "page\n", "utf8");
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

  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const changes = {
    preparedChanges: ["docs/prepared.md"],
    workingChanges: ["docs/working.md"],
    unregisteredPaths: ["docs/new.md"],
  } as const;
  const first = readTree(verified.capability, changes, "", undefined, 1);
  const longPath = `${"segment/".repeat(600)}file.txt`;
  assert.equal(validateRelativePath(longPath, false), longPath);
  assert.throws(() => validateRelativePath(`${longPath}/../outside`, false));
  const paddedCursor = Buffer.from(
    ` ${" ".repeat(8193)}${JSON.stringify(["", "docs"])}`,
    "utf8",
  ).toString("base64url");
  assert.ok(paddedCursor.length > 8192);
  const resumed = readTree(verified.capability, changes, "", paddedCursor, 1);
  assert.ok(resumed.entries.every((entry) => entry.path > "docs"));
  assert.throws(() =>
    readTree(verified.capability, changes, "docs", paddedCursor, 1),
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
  const second = readTree(
    verified.capability,
    changes,
    "",
    first.nextCursor,
    1,
  );
  assert.equal(second.entries[0]?.path, "root.txt");
  const docs = readTree(verified.capability, changes, "docs", undefined, 50);
  const paged: string[] = [];
  let cursor: string | null = null;
  do {
    const page = readTree(verified.capability, changes, "docs", cursor, 1);
    paged.push(...page.entries.map((entry) => entry.path));
    assert.ok(paged.length <= docs.entries.length);
    cursor = page.nextCursor;
  } while (cursor !== null);
  assert.deepEqual(
    paged,
    docs.entries.map((entry) => entry.path),
  );
  assert.deepEqual(paged, [...new Set(paged)].sort());
  assert.deepEqual(
    docs.entries.map((entry) => [
      entry.path,
      entry.prepared,
      entry.working,
      entry.unregistered,
    ]),
    [
      ["docs/B.txt", false, false, false],
      ["docs/a.txt", false, false, false],
      ["docs/new.md", false, false, true],
      ["docs/prepared.md", true, false, false],
      ["docs/working.md", false, true, false],
      ["docs/é.txt", false, false, false],
      ["docs/あ.txt", false, false, false],
    ],
  );
  const prepared = readFileDiff(
    verified.capability,
    changes,
    "docs/prepared.md",
  );
  assert.match(prepared.preparedPatch, /\+prepared/u);
  assert.equal(prepared.workingPatch, "");
  const working = readFileDiff(verified.capability, changes, "docs/working.md");
  assert.match(working.workingPatch, /\+working/u);
  assert.throws(
    () => readTree(verified.capability, changes, "docs", first.nextCursor, 10),
    /repository_worktree_cursor_invalid/u,
  );
  assert.throws(
    () => readFileDiff(verified.capability, changes, "../outside.txt"),
    /repository_worktree_path_invalid/u,
  );
});

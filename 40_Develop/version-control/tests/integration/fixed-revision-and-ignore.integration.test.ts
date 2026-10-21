/**
 * version-control:integration:fixed-revision-and-ignoreの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility version-control:integration:fixed-revision-and-ignoreが所有する検証責務を実行する。
 * @trace RFD-IT-008
 * @level IT
 * @scope version-control、fixed-revision、repository-local-ignore、lifecycle
 * @boundary RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { gitFixedRevisionIdentityAdapter } from "../../src/repository/revision.ts";
import {
  gitRepositoryLocalIgnoreAdapter,
  writeRepositoryLocalExclude,
} from "../../src/repository/ignore.ts";
import { observeFixedRevisionIdentity } from "../../src/repository/revision.ts";
import { registerRepositoryLocalIgnore } from "../../src/repository/ignore.ts";
import { verifyRepositoryRoot } from "../../src/repository/location.ts";
import { resolveRepositoryGitLayout } from "../../src/repository/layout.ts";
import {
  inspectRepositoryIdentityCandidate,
  inspectRepositoryRevisionCandidate,
} from "../../src/index.ts";

/**
 * 自己生成Git試験領域をRepository内だけに作成する。
 * @responsibility 既存Suiteの一時領域を用途限定tests Rootへ閉じる。
 * @trace RFD-IT-008
 * @precondition 呼出し元が自己生成Rootの終了清掃を登録する。
 * @stimulus 用途名を接頭辞として空Directoryを作る。
 * @observation 確定した専用Rootを返す。
 * @oracle OS一時領域・本体RepositoryへGit書込みしない。
 * @cleanup 呼出し元の既存after hookが専用Rootだけを回収する。
 * @boundary RFD-IT-008=Direct Boundary: 試験→Repository-local Filesystem
 */
function createFixtureDirectory(prefix: string): string {
  const root = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(root, { recursive: true });
  return fs.mkdtempSync(path.join(root, prefix));
}

/**
 * 移管したGit観測をRepository内の自己生成fixtureで検証する。
 * @responsibility Git設定・履歴・Worktreeを試験専用Rootに閉じる。
 * @trace RFD-IT-008
 * @precondition 試験だけが使うRepository-local tests Rootがある。
 * @stimulus 空Repositoryに合成File一件をCommitする。
 * @observation Gitが確定したRootとHEADを利用側へ渡す。
 * @oracle 正本Repositoryや認証領域を変更しない。
 * @cleanup 登録した終了処理が自己生成Rootだけを回収する。
 * @boundary RFD-IT-008=Direct Boundary: 試験→実Git／Filesystem
 */
function observationRepository(t: test.TestContext) {
  const testsRoot = path.resolve(
    import.meta.dirname,
    "../../../../.crdd/tests",
  );
  fs.mkdirSync(testsRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(testsRoot, "vc-revision-observation-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init", "--initial-branch=main"]);
  fs.writeFileSync(path.join(root, "source.txt"), "synthetic\n");
  git(root, ["add", "--", "source.txt"]);
  git(root, [
    "-c",
    "user.name=CRDD Test",
    "-c",
    "user.email=test@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-m",
    "synthetic base",
  ]);
  return root;
}

/**
 * 不正入力をGit観測候補へ補完しない。
 * @responsibility 既存null契約と非文字列・相対Path拒否を維持する。
 * @trace RFD-IT-008
 * @precondition 正式Repositoryを指さない合成入力だけを使う。
 * @stimulus 二つの公開観測へ不正入力を渡す。
 * @observation 戻り値を比較する。
 * @oracle 全入力がnullになる。
 * @cleanup N/A: 生成物なし。
 * @boundary RFD-IT-008=N/A: 公開観測の入力拒否
 */
test("Repository候補観測は不正Rootをnullで拒否する", () => {
  for (const value of [null, {}, 1, "", "relative", "C:\\invalid\u0000root"]) {
    assert.equal(inspectRepositoryRevisionCandidate(value), null);
    assert.equal(inspectRepositoryIdentityCandidate(value), null);
  }
});

/**
 * 現在HEAD／Treeと実体Identityを同じ実Gitへ結合する。
 * @responsibility dirty・stage・未追跡をHEAD変更と誤認しない。
 * @trace RFD-IT-008
 * @precondition 合成Repositoryに一つの確定Commitがある。
 * @stimulus 二観測の後にdirty・stage・未追跡Fileを追加する。
 * @observation HEAD／Tree／実体HashとGit indexを読取る。
 * @oracle 観測は同じHEAD／Tree／Identityで、作業内容を変更しない。
 * @cleanup 自己生成Rootを終了処理で回収する。
 * @boundary RFD-IT-008=Direct Boundary: 公開観測→実Git管理情報
 */
test("Repository候補観測はHEADとTreeを結合し既存作業を変更しない", (t) => {
  const root = observationRepository(t);
  const before = inspectRepositoryIdentityCandidate(root);
  assert.ok(before);
  assert.equal(before.commit, git(root, ["rev-parse", "HEAD"]));
  assert.equal(before.tree, git(root, ["rev-parse", "HEAD^{tree}"]));
  assert.equal(before.revision, before.commit);
  assert.equal(before.repositoryKind, "primary");
  assert.equal(before.repositoryPathReported, false);
  assert.equal(before.externalGitCliUsed, false);
  fs.writeFileSync(path.join(root, "source.txt"), "staged\n");
  git(root, ["add", "--", "source.txt"]);
  fs.writeFileSync(path.join(root, "source.txt"), "dirty\n");
  fs.writeFileSync(path.join(root, "untracked.txt"), "untracked\n");
  const status = git(root, ["status", "--porcelain=v1"]);
  assert.deepEqual(inspectRepositoryIdentityCandidate(root), before);
  assert.equal(inspectRepositoryRevisionCandidate(root)?.tree, before.tree);
  assert.equal(git(root, ["status", "--porcelain=v1"]), status);
  assert.equal(JSON.stringify(before).includes(root), false);
});

/**
 * Linked Worktreeの共通Repositoryと個別実体を区別する。
 * @responsibility 共有Git Identityと実行TreeのIdentityを混同しない。
 * @trace RFD-IT-008
 * @precondition 自己生成の通常Repositoryがある。
 * @stimulus 同じCommitからLinked Worktreeを一件作る。
 * @observation 両Rootの候補を比較する。
 * @oracle Logical Identityは同じ、Instance Identityは異なりHEAD／Treeは同じ。
 * @cleanup 自己生成Root配下のWorktreeとGit管理領域を一緒に回収する。
 * @boundary RFD-IT-008=Direct Boundary: 公開観測→実Linked Worktree
 */
test("Repository候補観測はLinked Worktreeの個別実体を区別する", (t) => {
  const root = observationRepository(t);
  const linked = path.join(root, "linked");
  git(root, ["worktree", "add", "--detach", linked, "HEAD"]);
  const primary = inspectRepositoryIdentityCandidate(root);
  const observed = inspectRepositoryIdentityCandidate(linked);
  assert.ok(primary);
  assert.ok(observed);
  assert.equal(observed.repositoryKind, "linked");
  assert.equal(
    observed.logicalRepositoryIdentity,
    primary.logicalRepositoryIdentity,
  );
  assert.notEqual(
    observed.repositoryInstanceIdentity,
    primary.repositoryInstanceIdentity,
  );
  assert.equal(observed.commit, primary.commit);
  assert.equal(observed.tree, primary.tree);
});

/**
 * HEADとCommit Objectの破損を候補成功へ補完しない。
 * @responsibility 一部のGit観測成立だけで上位Identityを返さない。
 * @trace RFD-IT-008
 * @precondition 自己生成の確定Repositoryがある。
 * @stimulus HEADを不正化し、次に存在しないCommitを指すHEADへ変える。
 * @observation 二つの公開候補観測を実行する。
 * @oracle どちらもnull。既知HEADだけからTreeを推測しない。
 * @cleanup 自己生成Rootを終了処理で回収する。
 * @boundary RFD-IT-008=Direct Boundary: 公開観測→破損Git管理情報
 */
test("Repository候補観測は不正HEADと欠測Commitを拒否する", (t) => {
  const root = observationRepository(t);
  const headPath = path.join(root, ".git", "HEAD");
  const head = fs.readFileSync(headPath);
  fs.writeFileSync(headPath, "invalid\n");
  assert.equal(inspectRepositoryRevisionCandidate(root), null);
  assert.equal(inspectRepositoryIdentityCandidate(root), null);
  fs.writeFileSync(headPath, head);
  const commit = git(root, ["rev-parse", "HEAD"]);
  const missingCommit = "f".repeat(40);
  assert.notEqual(commit, missingCommit);
  fs.writeFileSync(headPath, `${missingCommit}\n`);
  assert.equal(inspectRepositoryRevisionCandidate(root), null);
  assert.equal(inspectRepositoryIdentityCandidate(root), null);
});

/**
 * gitのTest準備責務を実行する。
 *
 * @responsibility gitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus gitを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
function git(root: string, commandArguments: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...commandArguments], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

/**
 * repositoryのTest準備責務を実行する。
 *
 * @responsibility repositoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus repositoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
function repository(t: test.TestContext): string {
  const root = createFixtureDirectory("crdd-vc-revision-");
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  return root;
}

/**
 * 現在の固定Revision Identityは未Commit変更に依存しないを検証する。
 *
 * @responsibility 現在の固定Revision Identityは未Commit変更に依存しないの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 現在の固定Revision Identityは未Commit変更に依存しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
test("現在の固定Revision Identityは未Commit変更に依存しない", (t) => {
  const root = repository(t);
  const revision = git(root, ["rev-parse", "HEAD"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "working\n", "utf8");
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const identity = observeFixedRevisionIdentity(
    verified.capability,
    gitFixedRevisionIdentityAdapter,
  );
  assert.equal(identity?.revisionIdentity, revision);
  assert.equal(identity?.repositoryForm, "primary");
  assert.equal(JSON.stringify(identity).includes(root), false);
});

/**
 * Repository-local ignore登録は原子的・冪等でreadbackされるを検証する。
 *
 * @responsibility Repository-local ignore登録は原子的・冪等でreadbackされるの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository-local ignore登録は原子的・冪等でreadbackされるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
test("Repository-local ignore登録は原子的・冪等でreadbackされる", (t) => {
  const root = repository(t);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const first = registerRepositoryLocalIgnore(
    verified.capability,
    ".crdd/",
    gitRepositoryLocalIgnoreAdapter,
  );
  const second = registerRepositoryLocalIgnore(
    verified.capability,
    ".crdd/",
    gitRepositoryLocalIgnoreAdapter,
  );
  assert.equal(first.status, "registered");
  assert.equal(second.status, "registered");
  if (first.status !== "registered" || second.status !== "registered") return;
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(first.effectIssued, true);
  assert.equal(first.effectConfirmation, "confirmed");
  assert.notEqual(first.beforeContentIdentity, first.afterContentIdentity);
  assert.equal(second.beforeContentIdentity, second.afterContentIdentity);
  assert.match(
    fs.readFileSync(path.join(root, ".git", "info", "exclude"), "utf8"),
    /^\.crdd\/$/mu,
  );
});

/**
 * Repository-local ignoreは失敗段階ごとにEffectと後始末を区別するを検証する。
 *
 * @responsibility Repository-local ignoreは失敗段階ごとにEffectと後始末を区別するの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository-local ignoreは失敗段階ごとにEffectと後始末を区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
test("Repository-local ignoreは失敗段階ごとにEffectと後始末を区別する", async (t) => {
  const phases = [
    "lock_open",
    "write",
    "fsync",
    "close",
    "rename",
    "post_rename_readback",
    "post_readback",
  ] as const;
  for (const phase of phases) {
    await t.test(phase, () => {
      const root = repository(t);
      const verified = verifyRepositoryRoot(root);
      assert.equal(verified.status, "completed");
      if (verified.status !== "completed") return;
      const result = registerRepositoryLocalIgnore(
        verified.capability,
        ".crdd/",
        (repositoryRoot, entry) =>
          writeRepositoryLocalExclude(
            resolveRepositoryGitLayout(repositoryRoot),
            entry,
            (current) => {
              if (current === phase) throw new Error(`injected_${phase}`);
            },
          ),
      );
      assert.equal(result.status, "blocked");
      if (result.status !== "blocked") return;
      const isAfterRename =
        phase === "post_rename_readback" || phase === "post_readback";
      assert.equal(result.effectIssued, isAfterRename);
      assert.equal(
        result.effectConfirmation,
        isAfterRename ? "unknown" : "not_issued",
      );
      assert.equal(result.effectStateUnknown, isAfterRename);
      assert.equal(result.cleanupConfirmed, true);
    });
  }
});

/**
 * Repository-local ignoreは競合Writerを未変更として扱わないを検証する。
 *
 * @responsibility Repository-local ignoreは競合Writerを未変更として扱わないの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository-local ignoreは競合Writerを未変更として扱わないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
test("Repository-local ignoreは競合Writerを未変更として扱わない", (t) => {
  const root = repository(t);
  const lockPath = path.join(
    root,
    ".git",
    "info",
    ".crdd-runtime-exclude.lock",
  );
  fs.writeFileSync(lockPath, "other-writer\n", "utf8");
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const result = registerRepositoryLocalIgnore(
    verified.capability,
    ".crdd/",
    gitRepositoryLocalIgnoreAdapter,
  );
  assert.equal(result.status, "blocked");
  if (result.status !== "blocked") return;
  assert.equal(result.effectIssued, false);
  assert.equal(result.effectConfirmation, "not_issued");
  assert.equal(result.retryAllowed, true);
  assert.equal(fs.readFileSync(lockPath, "utf8"), "other-writer\n");
});

/**
 * Repository-local ignoreは二つの実Process競合後も内容と再入場を保つを検証する。
 *
 * @responsibility Repository-local ignoreは二つの実Process競合後も内容と再入場を保つの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository-local ignoreは二つの実Process競合後も内容と再入場を保つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
test("Repository-local ignoreは二つの実Process競合後も内容と再入場を保つ", async (t) => {
  const root = repository(t);
  const exchange = createFixtureDirectory("crdd-vc-writers-");
  t.after(() => fs.rmSync(exchange, { recursive: true, force: true }));
  const startPath = path.join(exchange, "start");
  const fixture = path.resolve(
    import.meta.dirname,
    "../fixtures/repository-ignore-writer.ts",
  );
  const childProcesses = [".crdd/", ".cros/"].map((entry, index) => {
    const readyPath = path.join(exchange, `ready-${index}`);
    const resultPath = path.join(exchange, `result-${index}.json`);
    return Object.freeze({
      entry,
      readyPath,
      resultPath,
      child: spawn(
        process.execPath,
        [fixture, root, entry, readyPath, startPath, resultPath],
        { stdio: "ignore", windowsHide: true },
      ),
    });
  });
  const deadline = Date.now() + 10_000;
  while (!childProcesses.every(({ readyPath }) => fs.existsSync(readyPath))) {
    if (Date.now() >= deadline) throw new Error("writer_ready_timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  fs.writeFileSync(startPath, "start\n", { flag: "wx" });
  await Promise.all(
    childProcesses.map(
      ({ child }) =>
        new Promise<void>((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", (code) =>
            code === 0
              ? resolve()
              : reject(new Error(`writer_exit_${String(code)}`)),
          );
        }),
    ),
  );
  const results = childProcesses.map(({ resultPath }) =>
    JSON.parse(fs.readFileSync(resultPath, "utf8")),
  );
  assert.equal(
    results.filter((result) => result.status === "completed").length,
    1,
  );
  assert.equal(
    results.filter((result) => result.status === "blocked").length,
    1,
  );
  const blockedIndex = results.findIndex(
    (result) => result.status === "blocked",
  );
  assert.notEqual(blockedIndex, -1);
  const blockedWriter = childProcesses[blockedIndex];
  if (!blockedWriter) return;
  const retry = writeRepositoryLocalExclude(
    resolveRepositoryGitLayout(root),
    blockedWriter.entry,
  );
  assert.equal(retry.status, "completed");
  const content = fs.readFileSync(
    path.join(root, ".git", "info", "exclude"),
    "utf8",
  );
  assert.match(content, /^\.crdd\/$/mu);
  assert.match(content, /^\.cros\/$/mu);
  assert.equal(
    fs.existsSync(
      path.join(root, ".git", "info", ".crdd-runtime-exclude.lock"),
    ),
    false,
  );
});

/**
 * linked worktreeからのRepository-local ignoreは共有common directoryへ一度だけ登録するを検証する。
 *
 * @responsibility linked worktreeからのRepository-local ignoreは共有common directoryへ一度だけ登録するの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus linked worktreeからのRepository-local ignoreは共有common directoryへ一度だけ登録するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
test("linked worktreeからのRepository-local ignoreは共有common directoryへ一度だけ登録する", (t) => {
  const root = createFixtureDirectory("crdd-vc-linked-main-");
  const linked = createFixtureDirectory("crdd-vc-linked-");
  fs.rmSync(linked, { recursive: true });
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  t.after(() => {
    try {
      git(root, ["worktree", "remove", "--force", linked]);
    } catch {
      // The outer temporary repository cleanup is the final fallback.
    }
    fs.rmSync(linked, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  });
  git(root, ["worktree", "add", "-b", "linked-ignore", linked]);
  const verified = verifyRepositoryRoot(linked);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const result = registerRepositoryLocalIgnore(
    verified.capability,
    ".crdd/",
    gitRepositoryLocalIgnoreAdapter,
  );
  assert.equal(result.status, "registered");
  assert.match(
    fs.readFileSync(path.join(root, ".git", "info", "exclude"), "utf8"),
    /^\.crdd\/$/mu,
  );
});

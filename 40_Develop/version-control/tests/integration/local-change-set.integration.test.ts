/**
 * version-control:integration:local-change-setの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility version-control:integration:local-change-setが所有する検証責務を実行する。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @level IT
 * @scope version-control、change-set、regression
 * @boundary RFD-IT-005=Direct Boundary: Project Runtime Port→Version Control Adapter / RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createGitLocalChangeSetAdapter } from "../../src/git/local-change-set-adapter.ts";
import {
  changedPaths,
  gitLocalChangeSetAdapter,
  observeLocalChangeSet,
  verifyRepositoryRoot,
} from "../../src/index.ts";

/**
 * gitのTest準備責務を実行する。
 *
 * @responsibility gitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus gitを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-005=Direct Boundary: Project Runtime Port→Version Control Adapter / RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
function git(root: string, commandArguments: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...commandArguments], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

/**
 * 実RepositoryのRevision・準備・作業・未登録変更を分離して観測するを検証する。
 *
 * @responsibility 実RepositoryのRevision・準備・作業・未登録変更を分離して観測するの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実RepositoryのRevision・準備・作業・未登録変更を分離して観測するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
test("実RepositoryのRevision・準備・作業・未登録変更を分離して観測する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-changes-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  for (const name of ["revision.txt", "prepared.txt", "working.txt"])
    fs.writeFileSync(path.join(root, name), "baseline\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "baseline"]);
  const base = git(root, ["rev-parse", "HEAD"]);

  fs.writeFileSync(path.join(root, "revision.txt"), "revision\n", "utf8");
  git(root, ["add", "revision.txt"]);
  git(root, ["commit", "-m", "revision"]);
  fs.writeFileSync(path.join(root, "prepared.txt"), "prepared\n", "utf8");
  git(root, ["add", "prepared.txt"]);
  fs.writeFileSync(path.join(root, "working.txt"), "working\n", "utf8");
  fs.writeFileSync(path.join(root, "unregistered.txt"), "new\n", "utf8");

  const rootResult = verifyRepositoryRoot(root);
  assert.equal(rootResult.status, "completed");
  if (rootResult.status !== "completed") return;
  const observed = observeLocalChangeSet(
    rootResult.capability,
    base,
    gitLocalChangeSetAdapter,
  );
  assert.deepEqual(observed.revisionChanges, ["revision.txt"]);
  assert.deepEqual(observed.preparedChanges, ["prepared.txt"]);
  assert.deepEqual(observed.workingChanges, ["working.txt"]);
  assert.deepEqual(observed.unregisteredPaths, ["unregistered.txt"]);
  assert.deepEqual(changedPaths(observed), [
    "prepared.txt",
    "revision.txt",
    "unregistered.txt",
    "working.txt",
  ]);
  assert.equal(JSON.stringify(observed).includes(root), false);
});

/**
 * 未Commit状態と差替Adapterで同じPort契約を利用できることを検証する。
 *
 * @responsibility 通常のRepository作業がCommit SHAまたはGit具象Adapterを成立条件にせず、検証済みRootとVersion Control Portの情報だけで継続できることを確認する。
 * @trace RFD-IT-005
 * @precondition Test Fileが未Commit変更を持つ実Repositoryと、同じLocalChangeSetAdapter契約を実装する差替Adapterを構築する。
 * @stimulus 両Adapterを使って同じobserveLocalChangeSet操作を実行する。
 * @observation 両結果の契約、変更集合、Adapter受領入力およびRepositoryの未Commit状態を観測する。
 * @oracle 両経路が同じPort契約と変更集合を返し、Git具象情報またはCommit SHAをCore結果へ漏らさない。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-005=Direct Boundary: Project Runtime Port→Version Control Adapter
 */
test("未Commit状態と差替Adapterで同じPort契約を利用できる", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-port-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  git(root, ["add", "tracked.txt"]);
  git(root, ["commit", "-m", "baseline"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "working\n", "utf8");
  fs.writeFileSync(path.join(root, "unregistered.txt"), "new\n", "utf8");

  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;

  const gitObserved = observeLocalChangeSet(
    verified.capability,
    "HEAD",
    gitLocalChangeSetAdapter,
  );
  let replacementInput: Readonly<{
    repositoryRoot: string;
    comparisonBase: string;
  }> | null = null;
  const replacementObserved = observeLocalChangeSet(
    verified.capability,
    "working-baseline",
    (repositoryRoot, comparisonBase) => {
      replacementInput = Object.freeze({ repositoryRoot, comparisonBase });
      return {
        revisionChanges: [],
        preparedChanges: [],
        workingChanges: ["tracked.txt"],
        unregisteredPaths: ["unregistered.txt"],
      };
    },
  );

  assert.deepEqual(changedPaths(gitObserved), [
    "tracked.txt",
    "unregistered.txt",
  ]);
  assert.deepEqual(replacementObserved, {
    ...gitObserved,
    workingChanges: ["tracked.txt"],
    unregisteredPaths: ["unregistered.txt"],
  });
  assert.deepEqual(replacementInput, {
    repositoryRoot: root,
    comparisonBase: "working-baseline",
  });
  assert.equal(git(root, ["status", "--porcelain"]).length > 0, true);
  assert.equal(JSON.stringify(replacementObserved).includes(root), false);
  assert.equal(JSON.stringify(replacementObserved).includes("git"), false);
});

/**
 * 四つの観測のどこで失敗しても部分的な変更集合を公開しないを検証する。
 *
 * @responsibility 四つの観測のどこで失敗しても部分的な変更集合を公開しないの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 四つの観測のどこで失敗しても部分的な変更集合を公開しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
test("四つの観測のどこで失敗しても部分的な変更集合を公開しない", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-failure-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "tracked.txt"), "baseline\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "baseline"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const phases = [
    "revision_changes",
    "prepared_changes",
    "working_changes",
    "unregistered_paths",
  ];
  for (const [failureIndex, phase] of phases.entries()) {
    let call = 0;
    const adapter = createGitLocalChangeSetAdapter(() => {
      const current = call;
      call += 1;
      return {
        status: current === failureIndex ? 1 : 0,
        stdout: Buffer.from("observed.ts\0", "utf8"),
      };
    });
    assert.throws(
      () => observeLocalChangeSet(verified.capability, "HEAD", adapter),
      new RegExp(`local_change_set_observation_failed:${phase}`, "u"),
    );
  }
});

/**
 * 表現できないbackslashを含む名前を別Pathへ変換せず拒否するを検証する。
 *
 * @responsibility 表現できないbackslashを含む名前を別Pathへ変換せず拒否するの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 表現できないbackslashを含む名前を別Pathへ変換せず拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
test("表現できないbackslashを含む名前を別Pathへ変換せず拒否する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-verbatim-path-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const adapter = createGitLocalChangeSetAdapter(() => ({
    status: 0,
    stdout: Buffer.from("directory\\name.ts\0", "utf8"),
  }));
  assert.throws(
    () => observeLocalChangeSet(verified.capability, "HEAD", adapter),
    /local_change_set_observation_invalid:revision_changes/u,
  );
});

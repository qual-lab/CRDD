/**
 * version-control:integration:local-change-setの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility version-control:integration:local-change-setが所有する検証責務を実行する。
 * @trace RFD-IT-005
 * @trace RFD-IT-008
 * @level IT
 * @scope version-control、change-set、regression
 * @boundary RFD-IT-005=Direct Boundary: Coordinator Port→Version Control Adapter / RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
import assert from "node:assert/strict";
import childProcess, { execFileSync } from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readWorkingChanges } from "../../src/repository/working-directory.ts";
import { getRepository } from "../../src/repository/location.ts";

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
 * @boundary RFD-IT-005／RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
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
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
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

  const rootResult = getRepository(root);
  assert.equal(rootResult.status, "completed");
  if (rootResult.status !== "completed") return;
  const observed = readWorkingChanges(rootResult.capability, base);
  assert.deepEqual(observed.revisionChanges, ["revision.txt"]);
  assert.deepEqual(observed.preparedChanges, ["prepared.txt"]);
  assert.deepEqual(observed.workingChanges, ["working.txt"]);
  assert.deepEqual(observed.unregisteredPaths, ["unregistered.txt"]);
  assert.deepEqual(observed.changedPaths, [
    "prepared.txt",
    "revision.txt",
    "unregistered.txt",
    "working.txt",
  ]);
  assert.equal(JSON.stringify(observed).includes(root), false);
});

/**
 * 未Commit変更を完成したGit読取り操作だけで観測できることを検証する。
 *
 * @responsibility 未Commitの作業変更を完成操作で読み取り、原本と入力の拒否条件を確認する。
 * @trace RFD-IT-005
 * @precondition 未Commit変更を持つ合成Repositoryを構築する。
 * @stimulus 正規対象、複製した対象、不正な比較基準を完成操作へ渡す。
 * @observation 四区分の変更集合、拒否理由、元の未Commit状態を観測する。
 * @oracle Gitの変更を返し、不正な原本・入力を拒否し、絶対Pathを結果へ含めない。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-005=Direct Boundary: version-control Test Source→対象契約
 */
test("未Commit変更を完成したGit読取り操作で観測し原本以外を拒否する", (t) => {
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

  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;

  const gitObserved = readWorkingChanges(verified.capability, "HEAD");

  assert.deepEqual(gitObserved.changedPaths, [
    "tracked.txt",
    "unregistered.txt",
  ]);
  assert.throws(
    () => readWorkingChanges({ ...verified.capability }, "HEAD"),
    /verified_repository_root_required/u,
  );
  assert.throws(
    () => readWorkingChanges(verified.capability, "--unsafe"),
    /change_comparison_base_invalid/u,
  );
  assert.equal(git(root, ["status", "--porcelain"]).length > 0, true);
  assert.equal(JSON.stringify(gitObserved).includes(root), false);
  assert.equal(JSON.stringify(gitObserved).includes("git"), false);
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
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
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
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const phases = [
    "revision_changes",
    "prepared_changes",
    "working_changes",
    "unregistered_paths",
  ];
  const original = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  for (const [failureIndex, phase] of phases.entries()) {
    let call = 0;
    childProcess.spawnSync = ((_command: unknown, argv: readonly string[]) => {
      if (argv.includes("config"))
        return { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) };
      const current = call;
      call += 1;
      return {
        status: current === failureIndex ? 1 : 0,
        stdout: Buffer.from("observed.ts\0", "utf8"),
      };
    }) as unknown as typeof childProcess.spawnSync;
    syncBuiltinESMExports();
    assert.throws(
      () => readWorkingChanges(verified.capability, "HEAD"),
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
 * @boundary RFD-IT-008=Direct Boundary: version-control Test Source→対象契約
 */
test("表現できないbackslashを含む名前を別Pathへ変換せず拒否する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-verbatim-path-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const original = childProcess.spawnSync;
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  childProcess.spawnSync = ((_command: unknown, argv: readonly string[]) =>
    argv.includes("config")
      ? { status: 1, stdout: Buffer.alloc(0), stderr: Buffer.alloc(0) }
      : {
          status: 0,
          stdout: Buffer.from("directory\\name.ts\0", "utf8"),
          stderr: Buffer.alloc(0),
        }) as unknown as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  assert.throws(
    () => readWorkingChanges(verified.capability, "HEAD"),
    /local_change_set_observation_invalid:revision_changes/u,
  );
});

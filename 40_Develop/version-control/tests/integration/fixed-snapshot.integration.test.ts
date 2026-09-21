/**
 * version-control:integration:fixed-snapshotの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility version-control:integration:fixed-snapshotが所有する検証責務を実行する。
 * @trace RCM-IT-003
 * @trace RFD-IT-008
 * @level IT
 * @scope version-control、fixed-snapshot、candidate、cleanup
 * @boundary RCM-IT-003=Related 2 Blocks: Producer→Consumer→公開・署名・Release・Recovery / RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  type CandidateOutputCapability,
  gitFixedSnapshotAdapter,
  inspectFixedSnapshot,
  materializeFixedSnapshotCandidate,
  readFixedSnapshotFile,
  verifyCandidateOutputDirectory,
  verifyRepositoryRoot,
} from "../../src/index.ts";

/**
 * gitのTest準備責務を実行する。
 *
 * @responsibility gitがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus gitを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-003=Related 2 Blocks: Producer→Consumer→公開・署名・Release・Recovery
 */
function git(root: string, commandArguments: readonly string[]): string {
  return execFileSync("git", ["-C", root, ...commandArguments], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

/**
 * 固定RevisionのIdentity・本文・候補を同じSnapshotから復元するを検証する。
 *
 * @responsibility 固定RevisionのIdentity・本文・候補を同じSnapshotから復元するの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定RevisionのIdentity・本文・候補を同じSnapshotから復元するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
test("固定RevisionのIdentity・本文・候補を同じSnapshotから復元する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-snapshot-"));
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-candidate-"),
  );
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.mkdirSync(path.join(root, "docs"));
  fs.writeFileSync(path.join(root, "docs", "fixed.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  const revision = git(root, ["rev-parse", "HEAD"]);
  const expectedSnapshot = git(root, ["rev-parse", "HEAD^{tree}"]);
  fs.writeFileSync(path.join(root, "docs", "fixed.txt"), "working\n", "utf8");

  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const identity = inspectFixedSnapshot(
    verified.capability,
    revision,
    gitFixedSnapshotAdapter,
  );
  assert.equal(identity?.revisionIdentity, revision);
  assert.equal(identity?.snapshotIdentity, expectedSnapshot);
  assert.equal(JSON.stringify(identity).includes(root), false);

  const file = readFixedSnapshotFile(
    verified.capability,
    revision,
    "docs/fixed.txt",
    gitFixedSnapshotAdapter,
  );
  assert.equal(file?.bytes.toString("utf8"), "fixed\n");
  assert.equal(file?.revisionIdentity, revision);

  const outputOwner = Object.freeze({});
  const output = verifyCandidateOutputDirectory(
    workspace,
    outputOwner,
    workspace,
  );
  assert.equal(output.status, "completed");
  if (output.status !== "completed") return;
  const materialized = materializeFixedSnapshotCandidate(
    verified.capability,
    revision,
    outputOwner,
    output.capability,
    ["docs/fixed.txt"],
    null,
    gitFixedSnapshotAdapter,
  );
  assert.equal(materialized?.status, "materialized");
  assert.equal(
    fs.readFileSync(path.join(workspace, "docs", "fixed.txt"), "utf8"),
    "fixed\n",
  );
});

/**
 * 不明Revision・Path逸脱・内容Policy拒否をEffect前に閉じるを検証する。
 *
 * @responsibility 不明Revision・Path逸脱・内容Policy拒否をEffect前に閉じるの合否判定を所有する。
 * @trace RCM-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不明Revision・Path逸脱・内容Policy拒否をEffect前に閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-003=Related 2 Blocks: Producer→Consumer→公開・署名・Release・Recovery
 */
test("不明Revision・Path逸脱・内容Policy拒否をEffect前に閉じる", (t) => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-snapshot-reject-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "fixed.txt"), "reject\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  const revision = git(root, ["rev-parse", "HEAD"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  assert.equal(
    inspectFixedSnapshot(
      verified.capability,
      "0".repeat(40),
      gitFixedSnapshotAdapter,
    ),
    null,
  );
  assert.equal(
    readFixedSnapshotFile(
      verified.capability,
      revision,
      "../escape.txt",
      gitFixedSnapshotAdapter,
    ),
    null,
  );
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-policy-"));
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  const outputOwner = Object.freeze({});
  const output = verifyCandidateOutputDirectory(
    workspace,
    outputOwner,
    workspace,
  );
  assert.equal(output.status, "completed");
  if (output.status !== "completed") return;
  const rejected = materializeFixedSnapshotCandidate(
    verified.capability,
    revision,
    outputOwner,
    output.capability,
    null,
    () => true,
    gitFixedSnapshotAdapter,
  );
  assert.equal(rejected?.status, "blocked");
  assert.equal(fs.existsSync(workspace), false);
});

/**
 * Candidate出力はopaque Capabilityを要求し、部分生成を後始末するを検証する。
 *
 * @responsibility Candidate出力はopaque Capabilityを要求し、部分生成を後始末するの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Candidate出力はopaque Capabilityを要求し、部分生成を後始末するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
test("Candidate出力はopaque Capabilityを要求し、部分生成を後始末する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-output-"));
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-output-work-"),
  );
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "fixed.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const forged = materializeFixedSnapshotCandidate(
    verified.capability,
    git(root, ["rev-parse", "HEAD"]),
    Object.freeze({}),
    Object.freeze({
      contract: "crdd-version-control/candidate-output/v1",
    }) as unknown as CandidateOutputCapability,
    null,
    null,
    gitFixedSnapshotAdapter,
  );
  assert.equal(forged?.status, "blocked");
  assert.equal(forged?.reason, "candidate_output_invalid");

  const outputOwner = Object.freeze({});
  const output = verifyCandidateOutputDirectory(
    workspace,
    outputOwner,
    workspace,
  );
  assert.equal(output.status, "completed");
  if (output.status !== "completed") return;
  const partial = materializeFixedSnapshotCandidate(
    verified.capability,
    git(root, ["rev-parse", "HEAD"]),
    outputOwner,
    output.capability,
    null,
    null,
    {
      ...gitFixedSnapshotAdapter,
      materialize(_repositoryRoot, _revision, target) {
        fs.writeFileSync(path.join(target, "partial.txt"), "partial\n", "utf8");
        return null;
      },
    },
  );
  assert.equal(partial?.status, "blocked");
  assert.equal(partial?.reason, "candidate_materialization_failed");
  assert.equal(partial?.effectIssued, true);
  assert.equal(partial?.cleanupConfirmed, true);
  assert.equal(fs.existsSync(workspace), false);
});

/**
 * Candidate出力Capabilityは発行元Owner以外へ流用できないを検証する。
 *
 * @responsibility Candidate出力Capabilityは発行元Owner以外へ流用できないの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Candidate出力Capabilityは発行元Owner以外へ流用できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
test("Candidate出力Capabilityは発行元Owner以外へ流用できない", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-owner-root-"));
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-vc-owner-"));
  t.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(workspace, { recursive: true, force: true });
  });
  git(root, ["init"]);
  git(root, ["config", "user.name", "CRDD Test"]);
  git(root, ["config", "user.email", "test@example.invalid"]);
  fs.writeFileSync(path.join(root, "fixed.txt"), "fixed\n", "utf8");
  git(root, ["add", "."]);
  git(root, ["commit", "-m", "fixed"]);
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const owner = Object.freeze({});
  const otherOwner = Object.freeze({});
  const output = verifyCandidateOutputDirectory(workspace, owner, workspace);
  assert.equal(output.status, "completed");
  if (output.status !== "completed") return;
  const result = materializeFixedSnapshotCandidate(
    verified.capability,
    git(root, ["rev-parse", "HEAD"]),
    otherOwner,
    output.capability,
    null,
    null,
    gitFixedSnapshotAdapter,
  );
  assert.equal(result?.status, "blocked");
  assert.equal(result?.reason, "candidate_output_invalid");
});

/**
 * Candidate出力Capabilityは空で安定したDirectoryだけに発行するを検証する。
 *
 * @responsibility Candidate出力Capabilityは空で安定したDirectoryだけに発行するの合否判定を所有する。
 * @trace RFD-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Candidate出力Capabilityは空で安定したDirectoryだけに発行するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-008=Direct Boundary: Version Control Port→working tree・revision Observer→単一Snapshot
 */
test("Candidate出力Capabilityは空で安定したDirectoryだけに発行する", (t) => {
  const workspace = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-output-nonempty-"),
  );
  t.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  fs.writeFileSync(path.join(workspace, "existing.txt"), "existing\n", "utf8");
  assert.equal(
    verifyCandidateOutputDirectory(workspace, Object.freeze({}), workspace)
      .status,
    "blocked",
  );
  const ownedRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-output-owner-"),
  );
  const outside = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-vc-output-outside-"),
  );
  t.after(() => fs.rmSync(ownedRoot, { recursive: true, force: true }));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  assert.equal(
    verifyCandidateOutputDirectory(outside, Object.freeze({}), ownedRoot)
      .status,
    "blocked",
  );
});

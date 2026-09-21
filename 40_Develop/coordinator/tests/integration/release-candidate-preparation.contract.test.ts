/**
 * coordinator:integration:release-candidate-preparationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:release-candidate-preparationが所有する検証責務を実行する。
 * @trace CPR-IT-001
 * @level IT
 * @scope release、candidate、preparation、filesystem
 * @boundary Direct Boundary: 観測結果→Candidate Store
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  parseReleaseCandidateArguments,
  prepareReleaseCandidate,
} from "../../scripts/prepare-release-candidate.ts";

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CPR-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 観測結果→Candidate Store
 */
function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-release-candidate-"),
  );
  execFileSync("git", ["init", "--quiet"], { cwd: root });
  execFileSync("git", ["config", "user.email", "test@example.invalid"], {
    cwd: root,
  });
  execFileSync("git", ["config", "user.name", "CRDD Test"], { cwd: root });
  fs.writeFileSync(path.join(root, "README.md"), "candidate\n");
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "entry.ts"), "export {};\n");
  fs.writeFileSync(
    path.join(root, "security-example.txt"),
    "-----BEGIN PRIVATE KEY----- is documentation, not a key.\n",
  );
  execFileSync("git", ["add", "."], { cwd: root });
  execFileSync("git", ["commit", "--quiet", "-m", "fixture"], { cwd: root });
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const tree = execFileSync("git", ["show", "-s", "--format=%T", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  return { root, revision, tree };
}

/**
 * 固定Commitをshellなしで準備Directoryから完成候補へ公開するを検証する。
 *
 * @responsibility 固定Commitをshellなしで準備Directoryから完成候補へ公開するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Commitをshellなしで準備Directoryから完成候補へ公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 観測結果→Candidate Store
 */
test("固定Commitをshellなしで準備Directoryから完成候補へ公開する", () => {
  const value = fixture();
  try {
    const result = prepareReleaseCandidate({
      repositoryRoot: value.root,
      revision: value.revision,
      candidateName: "candidate-01",
    });
    assert.equal(result.status, "prepared");
    if (result.status !== "prepared") assert.fail("candidate was not prepared");
    assert.equal(result.commit, value.revision);
    assert.equal(result.tree, value.tree);
    assert.equal(result.externalGitCliUsed, false);
    assert.equal(result.shellUsed, false);
    assert.equal(
      fs.readFileSync(
        path.join(value.root, ".crdd", "release", "candidate-01", "README.md"),
        "utf8",
      ),
      "candidate\n",
    );
    assert.equal(
      fs.existsSync(
        path.join(value.root, ".crdd", "release", "candidate-01.preparing"),
      ),
      false,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * 既存候補と準備残存を上書きせず不正RevisionをEffect前に拒否するを検証する。
 *
 * @responsibility 既存候補と準備残存を上書きせず不正RevisionをEffect前に拒否するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 既存候補と準備残存を上書きせず不正RevisionをEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 観測結果→Candidate Store
 */
test("既存候補と準備残存を上書きせず不正RevisionをEffect前に拒否する", () => {
  const value = fixture();
  try {
    const first = prepareReleaseCandidate({
      repositoryRoot: value.root,
      revision: value.revision,
      candidateName: "candidate-02",
    });
    assert.equal(first.status, "prepared");
    const existing = prepareReleaseCandidate({
      repositoryRoot: value.root,
      revision: value.revision,
      candidateName: "candidate-02",
    });
    assert.equal(existing.status, "blocked");
    assert.equal(existing.reason, "release_candidate_destination_exists");
    const invalid = prepareReleaseCandidate({
      repositoryRoot: value.root,
      revision: "f".repeat(40),
      candidateName: "candidate-03",
    });
    assert.equal(invalid.status, "blocked");
    assert.equal(invalid.reason, "release_candidate_revision_invalid");
    assert.equal(
      fs.existsSync(path.join(value.root, ".crdd", "release", "candidate-03")),
      false,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * CLI引数は3組のexact値だけを受理するを検証する。
 *
 * @responsibility CLI引数は3組のexact値だけを受理するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI引数は3組のexact値だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 観測結果→Candidate Store
 */
test("CLI引数は3組のexact値だけを受理する", () => {
  const root = path.resolve("fixture");
  const revision = "a".repeat(40);
  assert.deepEqual(
    parseReleaseCandidateArguments([
      "--revision",
      revision,
      "--candidate-name",
      "candidate-04",
      "--repository-root",
      root,
    ]),
    { repositoryRoot: root, revision, candidateName: "candidate-04" },
  );
  assert.equal(
    parseReleaseCandidateArguments([
      "--repository-root",
      root,
      "--revision",
      revision,
    ]),
    null,
  );
  assert.equal(
    parseReleaseCandidateArguments([
      "--repository-root",
      root,
      "--revision",
      revision,
      "--candidate-name",
      "candidate-04",
      "extra",
    ]),
    null,
  );
});

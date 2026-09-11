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
        path.join(
          value.root,
          ".crdd",
          "release-staging",
          "candidate-01",
          "README.md",
        ),
        "utf8",
      ),
      "candidate\n",
    );
    assert.equal(
      fs.existsSync(
        path.join(
          value.root,
          ".crdd",
          "release-staging",
          "candidate-01.preparing",
        ),
      ),
      false,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

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
      fs.existsSync(
        path.join(value.root, ".crdd", "release-staging", "candidate-03"),
      ),
      false,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

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

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertCoverageRunRoot,
  createCoverageRunRoot,
} from "../../scripts/platform-access-coverage-path.ts";

function withTemporaryRoot(runTest: (temporaryRoot: string) => void): void {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-coverage-boundary-"),
  );
  try {
    runTest(temporaryRoot);
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
}

test("coverage runは実crate直下のtargetへ専用Directoryを作る", () => {
  withTemporaryRoot((temporaryRoot) => {
    const crateRoot = path.join(temporaryRoot, "platform-access");
    fs.mkdirSync(crateRoot);
    const runRoot = createCoverageRunRoot(crateRoot);
    assert.equal(path.dirname(runRoot.targetRoot), crateRoot);
    assert.equal(path.dirname(runRoot.coverageRoot), runRoot.targetRoot);
    assert.match(path.basename(runRoot.coverageRoot), /^coverage-/u);
    assert.doesNotThrow(() => assertCoverageRunRoot(runRoot));
  });
});

test("coverage runはtargetのfileとjunctionを変更せず拒否する", () => {
  withTemporaryRoot((temporaryRoot) => {
    const fileCrateRoot = path.join(temporaryRoot, "file-crate");
    fs.mkdirSync(fileCrateRoot);
    fs.writeFileSync(path.join(fileCrateRoot, "target"), "sentinel", "utf8");
    assert.throws(() => createCoverageRunRoot(fileCrateRoot));
    assert.equal(
      fs.readFileSync(path.join(fileCrateRoot, "target"), "utf8"),
      "sentinel",
    );

    const junctionCrateRoot = path.join(temporaryRoot, "junction-crate");
    const junctionDestination = path.join(temporaryRoot, "destination");
    fs.mkdirSync(junctionCrateRoot);
    fs.mkdirSync(junctionDestination);
    const sentinelPath = path.join(junctionDestination, "sentinel.txt");
    fs.writeFileSync(sentinelPath, "outside", "utf8");
    fs.symlinkSync(
      junctionDestination,
      path.join(junctionCrateRoot, "target"),
      "junction",
    );
    assert.throws(() => createCoverageRunRoot(junctionCrateRoot));
    assert.equal(fs.readFileSync(sentinelPath, "utf8"), "outside");
  });
});

test("coverage runはcrate Rootのjunctionを拒否する", () => {
  withTemporaryRoot((temporaryRoot) => {
    const destination = path.join(temporaryRoot, "crate-destination");
    const linkedCrate = path.join(temporaryRoot, "crate-link");
    fs.mkdirSync(destination);
    fs.symlinkSync(destination, linkedCrate, "junction");
    assert.throws(() => createCoverageRunRoot(linkedCrate));
  });
});

test("coverage runはtargetまたはrun Directoryの同名置換を拒否する", () => {
  withTemporaryRoot((temporaryRoot) => {
    const targetReplacementCrate = path.join(
      temporaryRoot,
      "target-replacement",
    );
    fs.mkdirSync(targetReplacementCrate);
    const targetRunRoot = createCoverageRunRoot(targetReplacementCrate);
    fs.renameSync(targetRunRoot.targetRoot, `${targetRunRoot.targetRoot}-old`);
    fs.mkdirSync(targetRunRoot.targetRoot);
    assert.throws(() => assertCoverageRunRoot(targetRunRoot));

    const runReplacementCrate = path.join(temporaryRoot, "run-replacement");
    fs.mkdirSync(runReplacementCrate);
    const replacedRunRoot = createCoverageRunRoot(runReplacementCrate);
    fs.renameSync(
      replacedRunRoot.coverageRoot,
      `${replacedRunRoot.coverageRoot}-old`,
    );
    fs.mkdirSync(replacedRunRoot.coverageRoot);
    assert.throws(() => assertCoverageRunRoot(replacedRunRoot));
  });
});

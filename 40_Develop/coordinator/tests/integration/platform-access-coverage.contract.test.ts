/**
 * coordinator:integration:platform-access-coverageの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:platform-access-coverageが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @level IT
 * @scope platform、access、coverage
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertCoverageRunRoot,
  createCoverageRunRoot,
} from "../../scripts/platform-access-coverage-path.ts";

/**
 * withTemporaryRootのTest準備責務を実行する。
 *
 * @responsibility withTemporaryRootがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus withTemporaryRootを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
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

/**
 * coverage runは実crate直下のtargetへ専用Directoryを作るを検証する。
 *
 * @responsibility coverage runは実crate直下のtargetへ専用Directoryを作るの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus coverage runは実crate直下のtargetへ専用Directoryを作るの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
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

/**
 * coverage runはtargetのfileとjunctionを変更せず拒否するを検証する。
 *
 * @responsibility coverage runはtargetのfileとjunctionを変更せず拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus coverage runはtargetのfileとjunctionを変更せず拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
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

/**
 * coverage runはcrate Rootのjunctionを拒否するを検証する。
 *
 * @responsibility coverage runはcrate Rootのjunctionを拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus coverage runはcrate Rootのjunctionを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("coverage runはcrate Rootのjunctionを拒否する", () => {
  withTemporaryRoot((temporaryRoot) => {
    const destination = path.join(temporaryRoot, "crate-destination");
    const linkedCrate = path.join(temporaryRoot, "crate-link");
    fs.mkdirSync(destination);
    fs.symlinkSync(destination, linkedCrate, "junction");
    assert.throws(() => createCoverageRunRoot(linkedCrate));
  });
});

/**
 * coverage runはtargetまたはrun Directoryの同名置換を拒否するを検証する。
 *
 * @responsibility coverage runはtargetまたはrun Directoryの同名置換を拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus coverage runはtargetまたはrun Directoryの同名置換を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
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

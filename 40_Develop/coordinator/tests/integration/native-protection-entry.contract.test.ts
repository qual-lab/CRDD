/**
 * Native保護試験入口の残存停止と入力一致を確認する。
 *
 * @packageDocumentation
 * @responsibility 成功・Build失敗・中断を模した局所fixtureの保全と、Hash差の拒否を確認する。
 * @trace ERB-IT-001
 * @level IT
 * @scope 同一Repository内の自己生成fixture。Native実行・実回復は行わない。
 * @boundary Node→自己生成tests領域。実署名・Provider・旧verificationは対象外。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { areNativeTerminalBoundariesUnchanged } from "../../scripts/verify-native-terminal-namespace.ts";
import {
  areInputsUnchanged,
  assertNoPreviousNativeRuns,
  nodeIdentity,
} from "../../scripts/verify-native-protection.ts";

/**
 * 試験用の小さな自己生成領域を確保する。
 *
 * @responsibility 検証済みRepository内に限定し、他のrunを使わない。
 * @trace ERB-IT-001
 * @precondition ModuleのRepository内tests Rootが通常Directoryである。
 * @stimulus mkdtempで一意な領域を作る。
 * @observation 新しいDirectory Path。
 * @oracle 全祖先の非aliasとRepository内の実Path一致。
 * @cleanup 呼出し側が作成した通常FileとDirectoryだけを明示削除する。
 * @boundary Node→Repository-local tests領域。
 */
function fixtureRoot(): string {
  const repository = path.resolve(
    fileURLToPath(new URL("../../../../", import.meta.url)),
  );
  const testsRoot = path.join(repository, ".crdd", "tests");
  for (const directory of [
    repository,
    path.join(repository, ".crdd"),
    testsRoot,
  ]) {
    assert.equal(fs.lstatSync(directory).isDirectory(), true);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(directory), directory);
  }
  return fs.mkdtempSync(path.join(testsRoot, "native-preflight-contract-"));
}

/**
 * 末端を維持した中間Directory置換を観測する。
 * @responsibility depsだけの同一性から全祖先不変を推定しない。
 * @trace ERB-IT-001
 * @precondition 自己生成した三Directoryだけを使用する。
 * @stimulus 中間を退避し新しい同名Directoryへdepsを戻す。
 * @observation 末端Identity一致と中間Identity不一致。
 * @oracle 全境界比較が不一致を検出する。
 * @cleanup 自己生成対象だけを非再帰で回収する。
 * @boundary Node→Repository-local fixture。
 */
test("Native protection: unchanged deps cannot hide intermediate directory replacement", () => {
  const root = fixtureRoot();
  const middle = path.join(root, "debug");
  const deps = path.join(middle, "deps");
  const old = path.join(root, "old");
  fs.mkdirSync(middle);
  fs.mkdirSync(deps);
  const paths = [middle, deps].map((file) => file.replaceAll("\\", "/"));
  const previousEntries = paths.map(nodeIdentity);
  try {
    fs.renameSync(middle, old);
    fs.mkdirSync(middle);
    fs.renameSync(path.join(old, "deps"), deps);
    const subsequentEntries = paths.map(nodeIdentity);
    assert.equal(previousEntries[1], subsequentEntries[1]);
    assert.notDeepEqual(previousEntries, subsequentEntries);
  } finally {
    fs.rmdirSync(deps);
    fs.rmdirSync(middle);
    fs.rmdirSync(old);
    fs.rmdirSync(root);
  }
});

/**
 * 前回runの状態に関係なく、記録と領域を変更せず次生成を止める。
 *
 * @responsibility 成功／Build失敗／中断残存を非該当として省略しない。
 * @trace ERB-IT-001
 * @precondition 試験自身の小さなfixtureだけを使う。
 * @stimulus 三種類の記録を置いて同じ本番preflight関数を呼ぶ。
 * @observation 拒否、子名の前後一致、記録bytesの前後一致。
 * @oracle 全三例で拒否し、新File・Directory 0、元bytes不変。
 * @cleanup 自分が作成した二Fileと二Directoryだけを非再帰で回収する。
 * @boundary Node→自己生成tests fixture。
 */
test("Native protection: prior success, failed build and interrupted runs stop generation", () => {
  const root = fixtureRoot();
  const prior = path.join(root, "native-protection-fixture");
  fs.mkdirSync(prior);
  try {
    for (const state of ["success", "build_failed", "interrupted"]) {
      const started = path.join(prior, "started.json");
      const result = path.join(prior, "result.json");
      const bytes = Buffer.from(JSON.stringify({ fixtureOnly: true, state }));
      fs.writeFileSync(started, bytes);
      if (state !== "interrupted") fs.writeFileSync(result, bytes);
      const childNames = fs.readdirSync(root);
      const files = fs.readdirSync(prior);
      assert.throws(
        () => assertNoPreviousNativeRuns(root),
        /previous_native_protection_run_requires_settlement/u,
      );
      assert.deepEqual(fs.readdirSync(root), childNames);
      assert.deepEqual(fs.readdirSync(prior), files);
      assert.deepEqual(fs.readFileSync(started), bytes);
      if (state !== "interrupted") {
        assert.deepEqual(fs.readFileSync(result), bytes);
        fs.unlinkSync(result);
      }
      fs.unlinkSync(started);
    }
    fs.rmdirSync(prior);
    assert.doesNotThrow(() => assertNoPreviousNativeRuns(root));
  } finally {
    fs.rmdirSync(root);
  }
});

/**
 * 同じ入力確認でHash差と観測不能を拒否する。
 *
 * @responsibility 別の比較式でなく正式入口の入力一致関数を検証する。
 * @trace ERB-IT-001
 * @precondition 自己生成したFileだけを入力とする。
 * @stimulus 内容一致、差、観測不能を順に作る。
 * @observation true、false、明示例外。
 * @oracle 差をtrueへ、不存在を一致へ畳まない。
 * @cleanup Fileと親Directoryを非再帰で回収する。
 * @boundary Node→自己生成tests fixture。
 */
test("Native protection: changed or unavailable direct input cannot match", () => {
  const root = fixtureRoot();
  const file = path.join(root, "input");
  try {
    fs.writeFileSync(file, "before");
    const inputs = [
      { file, sha256: createHash("sha256").update("before").digest("hex") },
    ];
    assert.equal(areInputsUnchanged(inputs), true);
    fs.writeFileSync(file, "after");
    assert.equal(areInputsUnchanged(inputs), false);
    fs.unlinkSync(file);
    assert.throws(() => areInputsUnchanged(inputs));
    assert.throws(() => assertNoPreviousNativeRuns(path.join(root, "missing")));
  } finally {
    fs.rmdirSync(root);
  }
});

/**
 * 失敗結果でも置換した祖先へ保存・清掃しない。
 * @responsibility 成功判定のfalseが保存境界確認を迂回しないことを検証する。
 * @trace ERB-IT-001
 * @precondition 自己生成小領域と固定した祖先Identityを使う。
 * @stimulus 保存親をjunctionへ置換し、起動失敗・timeout相当のfalseと組み合わせる。
 * @observation 保存・清掃要求数と置換先内容。
 * @oracle 境界確認false、要求0、置換先不変。
 * @cleanup 自己生成junctionと空Directoryだけを非再帰回収する。
 * @boundary Node→Repository-local試験Directory。
 */
test("Native terminal: failed result cannot bypass changed ancestor", () => {
  const root = fixtureRoot();
  const parent = path.join(root, "parent");
  const destination = path.join(root, "destination");
  fs.mkdirSync(parent);
  fs.mkdirSync(destination);
  const normalized = parent.replaceAll("\\", "/");
  const expectedEntries = [nodeIdentity(normalized)];
  assert.equal(
    areNativeTerminalBoundariesUnchanged([normalized], expectedEntries),
    true,
  );
  fs.renameSync(parent, parent + "-old");
  fs.symlinkSync(destination, parent, "junction");
  try {
    for (const failure of ["timeout", "launch_failed"]) {
      assert.ok(failure);
      const isPermitted = areNativeTerminalBoundariesUnchanged(
        [normalized],
        expectedEntries,
      );
      assert.equal(isPermitted, false);
      let writes = 0;
      if (isPermitted) {
        writes++;
        fs.writeFileSync(path.join(parent, "result.json"), "{}");
      }
      assert.equal(writes, 0);
      assert.deepEqual(fs.readdirSync(destination), []);
    }
    assert.equal(
      areNativeTerminalBoundariesUnchanged(
        [normalized + "/missing"],
        expectedEntries,
      ),
      false,
    );
  } finally {
    fs.unlinkSync(parent);
    fs.rmdirSync(parent + "-old");
    fs.rmdirSync(destination);
    fs.rmdirSync(root);
  }
});

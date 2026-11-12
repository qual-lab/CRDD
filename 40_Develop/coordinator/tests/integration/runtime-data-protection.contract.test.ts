/**
 * Coordinatorの保護Mount用Root準備を実Filesystemへ接続する。
 * @packageDocumentation
 * @responsibility モデル分離後も既存内容の保全と観測不能時の作成0を確認する。
 * @trace PRL-IT-013
 * @level IT
 * @scope 自己生成Repository-localの通常Directoryのみ。
 * @boundary Coordinatorの技術Root観測。AI・Docker・過去保持物は使用しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import {
  checkRepositoryRuntimeDataProtectionDirectory,
  ensureRepositoryRuntimeDataArea,
  requireReadyRepositoryRuntimeDataArea,
} from "../../src/configuration/runtime-data.ts";

/**
 * 固定Git構造を持つ新品Rootを用途限定領域へ作る。
 * @responsibility 試験物の所在と終了清掃を同じ実体へ結合する。
 * @trace PRL-IT-013
 * @precondition 現RepositoryをVCで検証できる。
 * @stimulus .crdd/tests下の新Directoryへ固定Git管理情報を作る。
 * @observation 検証済みRootと試験終了時の不存在。
 * @oracle 現Repository外又は過去保持物へ書き込まない。
 * @cleanup 新Rootだけを非Link・所在確認後に回収する。
 * @boundary Repository-local実Filesystem。
 */
function fixture(t: test.TestContext) {
  const current = getRepositoryFromWorkingDirectory(import.meta.dirname);
  assert.equal(current.status, "completed");
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(current.capability, "tests"),
    "protection_test_area_invalid",
  );
  const root = fs.mkdtempSync(path.join(area.directory, "co-protection-"));
  t.after(() => {
    assert.equal(path.dirname(root), area.directory);
    assert.equal(fs.realpathSync.native(root), root);
    assert.equal(fs.lstatSync(root).isSymbolicLink(), false);
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  });
  fs.mkdirSync(path.join(root, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  return {
    root,
    repository: verified.capability,
    internal: path.join(root, ".crdd"),
  };
}

/**
 * @trace PRL-IT-013
 * @precondition 新Rootには内部保存領域がまだない。
 * @stimulus observe、prepare、既存状態Fileを置いて再prepareする。
 * @observation absent／readyと元File内容。
 * @oracle observeは作成せず、再prepareは既存内容を破壊しない。
 * @cleanup fixtureのexact Root回収。
 * @boundary 保護Rootの実準備。
 */
test("保護Mountのprepareは既存状態を初期化も削除もしない", (t) => {
  const f = fixture(t);
  assert.equal(
    checkRepositoryRuntimeDataProtectionDirectory(f.repository, "observe"),
    "absent",
  );
  assert.equal(fs.existsSync(f.internal), false);
  assert.equal(
    checkRepositoryRuntimeDataProtectionDirectory(f.repository, "prepare"),
    "ready",
  );
  const sentinel = path.join(f.internal, "existing-state.json");
  fs.writeFileSync(sentinel, "preserved");
  assert.equal(
    checkRepositoryRuntimeDataProtectionDirectory(f.repository, "prepare"),
    "ready",
  );
  assert.equal(
    checkRepositoryRuntimeDataProtectionDirectory(f.repository, "observe"),
    "ready",
  );
  assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved");
});

/**
 * @trace PRL-IT-013
 * @precondition 通常の保護Rootと既存状態を用意する。
 * @stimulus RootのlstatへEACCESを注入しobserve／prepareする。
 * @observation blocked、mkdir回数0と既存File不変。
 * @oracle 観測不能を不存在へ変換せず作成しない。
 * @cleanup mockを復元しfixtureだけを回収する。
 * @boundary Node.jsの読取り失敗と作成境界。
 */
test("保護Rootの観測不能はprepareでもmkdirを発行しない", (t) => {
  const f = fixture(t);
  fs.mkdirSync(f.internal);
  const sentinel = path.join(f.internal, "existing-state.json");
  fs.writeFileSync(sentinel, "preserved");
  const original = fs.lstatSync;
  const lstat = t.mock.method(fs, "lstatSync", ((
    target: fs.PathLike,
    ...args: unknown[]
  ) => {
    if (String(target) === f.internal)
      throw Object.assign(new Error("synthetic_denied"), { code: "EACCES" });
    return Reflect.apply(original, fs, [target, ...args]);
  }) as typeof fs.lstatSync);
  const mkdir = t.mock.method(fs, "mkdirSync");
  try {
    assert.equal(
      checkRepositoryRuntimeDataProtectionDirectory(f.repository, "observe"),
      "blocked",
    );
    assert.equal(
      checkRepositoryRuntimeDataProtectionDirectory(f.repository, "prepare"),
      "blocked",
    );
    assert.equal(mkdir.mock.calls.length, 0);
  } finally {
    lstat.mock.restore();
    mkdir.mock.restore();
  }
  assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved");
});

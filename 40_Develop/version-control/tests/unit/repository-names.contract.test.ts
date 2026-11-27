/**
 * Gitの実行前に使うパス・ブランチ名の文法を検証する。
 * @trace RFD-UT-035 ARCH-000009
 * @level UT
 * @boundary 文字列の検査のみ。Gitもファイル操作も行わない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { isBranchName } from "../../src/git/read.ts";
import { validateRelativePath } from "../../src/repository/files.ts";

test("通常のブランチ名と不正な構成要素を区別する", () => {
  for (const branch of [
    "main",
    "feature/修正",
    "release/v0.22",
    "users/qa-team",
  ]) {
    assert.equal(isBranchName(branch), true, branch);
  }
  for (const branch of [
    null,
    "",
    "topic/",
    "topic//draft",
    "draft space",
    "release.lock",
    ".hidden/topic",
  ]) {
    assert.equal(isBranchName(branch), false, String(branch));
  }
});

test("リポジトリ内の相対パスを正規化し、空はRootを許す場合だけ受け付ける", () => {
  assert.equal(
    validateRelativePath("src\\domain/file.ts", false),
    "src/domain/file.ts",
  );
  assert.equal(validateRelativePath("", true), "");
  for (const value of ["", "src//file.ts", "src/./file.ts", "/absolute", 42]) {
    assert.throws(() => validateRelativePath(value, false), {
      message: "repository_worktree_path_invalid",
    });
  }
});

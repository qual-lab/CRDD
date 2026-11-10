/**
 * Gitユーザー設定の実Git・公開bin境界を検証する。
 * @trace RFD-IT-001
 * @trace PRL-IT-012
 * @level IT
 * @scope Repository設定、Main/Linked、CLI
 * @boundary 実GitとNode子Process。外部通信・AI・Dockerなし。
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getRepository, readGitUser } from "../../src/index.ts";

const testsRoot = path.resolve(import.meta.dirname, "../../../../.crdd/tests");

/** 自己生成したGit Repositoryだけを操作し、終了後に回収する。 */
function fixture(t: test.TestContext) {
  const repositoryRoot = path.resolve(testsRoot, "../..");
  assert.equal(getRepository(repositoryRoot).status, "completed");
  assert.equal(fs.realpathSync.native(repositoryRoot), repositoryRoot);
  for (const directory of [path.dirname(testsRoot), testsRoot]) {
    if (!fs.existsSync(directory)) fs.mkdirSync(directory);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(directory), directory);
  }
  const root = fs.mkdtempSync(path.join(testsRoot, "git-user-"));
  t.after(() => {
    assert.equal(path.dirname(root), testsRoot);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  const git = (...args: string[]) =>
    execFileSync("git", ["-C", root, ...args], {
      encoding: "utf8",
      windowsHide: true,
      timeout: 10000,
    });
  git("init", "--quiet");
  // 明示local設定でHostの下位設定に結果を依存させない。
  git("config", "user.name", "Fixture User");
  git("config", "user.email", "Fixture@Example.invalid");
  const repository = getRepository(root);
  assert.equal(repository.status, "completed");
  assert.ok(repository.capability);
  return { root, git, repository: repository.capability };
}

test("公開APIは有効設定を読み、名前・メール以外を返さない", (t) => {
  const f = fixture(t);
  f.git("config", "credential.helper", "never-execute-this");
  f.git("config", "--add", "user.email", "last@example.invalid");
  assert.deepEqual(readGitUser(f.repository), {
    status: "completed",
    name: "Fixture User",
    email: "last@example.invalid",
  });
  assert.equal(fs.existsSync(path.join(f.root, "never-execute-this")), false);
});

test("空設定と観測不能は区別し、履歴やAuthor環境へfallbackしない", (t) => {
  const f = fixture(t);
  f.git("config", "user.name", "");
  f.git("config", "user.email", "");
  const before = process.env.GIT_AUTHOR_EMAIL;
  try {
    process.env.GIT_AUTHOR_EMAIL = "ambient@example.invalid";
    assert.deepEqual(readGitUser(f.repository), {
      status: "completed",
      name: null,
      email: null,
    });
  } finally {
    if (before === undefined) delete process.env.GIT_AUTHOR_EMAIL;
    else process.env.GIT_AUTHOR_EMAIL = before;
  }
  fs.appendFileSync(path.join(f.root, ".git/config"), "\n[invalid\n");
  assert.notEqual(readGitUser(f.repository).status, "completed");
});

test("includeとMain/Linkedの実効設定を同じAPIで読む", (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, "file.txt"), "fixture\n");
  f.git("add", "file.txt");
  f.git("-c", "core.hooksPath=NUL", "commit", "--quiet", "-m", "fixture");
  const linked = path.join(f.root, "linked");
  f.git("worktree", "add", "--quiet", "--detach", linked, "HEAD");
  const linkedRepository = getRepository(linked);
  assert.ok(linkedRepository.capability);
  assert.equal(readGitUser(linkedRepository.capability).status, "completed");
  assert.deepEqual(readGitUser(linkedRepository.capability), {
    status: "completed",
    name: "Fixture User",
    email: "Fixture@Example.invalid",
  });
  fs.writeFileSync(
    path.join(f.root, "extra.config"),
    "[user]\nemail = included@example.invalid\n",
  );
  // Repository-local includesは既存Layoutが拒否する。globalのincludeだけを新品Homeで検証する。
  f.git("config", "--unset-all", "user.email");
  const home = path.join(f.root, "profile");
  fs.mkdirSync(home);
  fs.writeFileSync(
    path.join(home, ".gitconfig"),
    `[include]\npath = ${JSON.stringify(path.join(f.root, "extra.config").replaceAll("\\", "/"))}\n`,
  );
  const names = ["HOME", "USERPROFILE", "XDG_CONFIG_HOME"];
  const previous = names.map((name) => process.env[name]);
  try {
    for (const name of names) process.env[name] = home;
    assert.deepEqual(readGitUser(f.repository), {
      status: "completed",
      name: "Fixture User",
      email: "included@example.invalid",
    });
  } finally {
    for (const [index, name] of names.entries()) {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }
  }
});

test("binは対象RepositoryのJSONだけを返し、不正引数ではGitを読まない", (t) => {
  const f = fixture(t);
  const bin = path.resolve(import.meta.dirname, "../../bin/version-control.ts");
  const result = spawnSync(process.execPath, [bin, "read-git-user", "--json"], {
    cwd: f.root,
    encoding: "utf8",
    timeout: 15000,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), readGitUser(f.repository));
  const invalid = spawnSync(process.execPath, [bin, "--arbitrary-command"], {
    cwd: f.root,
    encoding: "utf8",
    timeout: 15000,
    windowsHide: true,
  });
  assert.equal(invalid.status, 64);
  assert.deepEqual(JSON.parse(invalid.stdout), {
    status: "blocked",
    reason: "version_control_arguments_invalid",
  });
});

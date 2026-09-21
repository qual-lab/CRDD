/**
 * coordinator:integration:repository-git-layoutの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:repository-git-layoutが所有する検証責務を実行する。
 * @trace RFD-IT-001
 * @level IT
 * @scope repository、git、layout
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import {
  describeGitRepositoryLayoutAdapterContract,
  inspectGitRepositoryLayoutCandidate,
} from "../../../version-control/src/git/repository-layout-adapter.ts";
import { inspectRepositoryGitObjectFormatCandidate } from "../../../version-control/src/git/repository-layout.ts";
import { assertPresent, errorCode } from "../support/test-support.ts";

/**
 * temporaryRootのTest準備責務を実行する。
 *
 * @responsibility temporaryRootがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus temporaryRootを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
function temporaryRoot(t: TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-repository-layout-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

/**
 * makeGitDirectoryのTest準備責務を実行する。
 *
 * @responsibility makeGitDirectoryがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RFD-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus makeGitDirectoryを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
function makeGitDirectory(target: string) {
  fs.mkdirSync(path.join(target, "info"), { recursive: true });
  fs.writeFileSync(path.join(target, "HEAD"), "ref: refs/heads/main\n", "utf8");
  fs.writeFileSync(
    path.join(target, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
    "utf8",
  );
}

/**
 * 通常worktreeのcommon metadata候補をPath非保持で識別するを検証する。
 *
 * @responsibility 通常worktreeのcommon metadata候補をPath非保持で識別するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常worktreeのcommon metadata候補をPath非保持で識別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("通常worktreeのcommon metadata候補をPath非保持で識別する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const result = inspectGitRepositoryLayoutCandidate({ repositoryRoot });
  assert.equal(result.status, "candidate");
  assertPresent(result.layout);
  assert.equal(result.layout.kind, "normal_worktree");
  assert.equal(
    result.layout.excludeBackend,
    "common_git_directory_info_exclude",
  );
  assert.equal(JSON.stringify(result).includes(repositoryRoot), false);
});

/**
 * linked worktreeはcommondirを解決するを検証する。
 *
 * @responsibility linked worktreeはcommondirを解決するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus linked worktreeはcommondirを解決するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("linked worktreeはcommondirを解決する", (t) => {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "linked");
  const commonGitDirectory = path.join(parent, "main.git");
  const gitDirectory = path.join(commonGitDirectory, "worktrees", "linked");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(commonGitDirectory);
  fs.mkdirSync(gitDirectory, { recursive: true });
  fs.writeFileSync(
    path.join(gitDirectory, "HEAD"),
    "ref: refs/heads/linked\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(repositoryRoot, ".git"),
    `gitdir: ${gitDirectory}\n`,
    "utf8",
  );
  fs.writeFileSync(path.join(gitDirectory, "commondir"), "../..\n", "utf8");
  const result = inspectGitRepositoryLayoutCandidate({ repositoryRoot });
  assert.equal(result.status, "candidate");
  assertPresent(result.layout);
  assert.equal(result.layout.kind, "linked_worktree");
});

/**
 * core.worktreeを使わない限定gitfile worktreeを候補化するを検証する。
 *
 * @responsibility core.worktreeを使わない限定gitfile worktreeを候補化するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus core.worktreeを使わない限定gitfile worktreeを候補化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("core.worktreeを使わない限定gitfile worktreeを候補化する", (t) => {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "dependency");
  const gitDirectory = path.join(parent, ".git", "modules", "dependency");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(gitDirectory);
  fs.writeFileSync(
    path.join(repositoryRoot, ".git"),
    `gitdir: ${gitDirectory}\n`,
    "utf8",
  );
  const result = inspectGitRepositoryLayoutCandidate({ repositoryRoot });
  assert.equal(result.status, "candidate");
  assertPresent(result.layout);
  assert.equal(result.layout.kind, "gitfile_worktree");
  assert.equal(result.layout.referencedRepositoriesModified, false);
});

/**
 * 標準submodule自身のcore.worktree構成をexact Rootとして受理するを検証する。
 *
 * @responsibility 標準submodule自身のcore.worktree構成をexact Rootとして受理するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 標準submodule自身のcore.worktree構成をexact Rootとして受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("標準submodule自身のcore.worktree構成をexact Rootとして受理する", (t) => {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "dependency");
  const gitDirectory = path.join(parent, ".git", "modules", "dependency");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(gitDirectory);
  fs.writeFileSync(
    path.join(gitDirectory, "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tworktree = ../../../dependency\n",
    "utf8",
  );
  fs.writeFileSync(
    path.join(repositoryRoot, ".git"),
    `gitdir: ${gitDirectory}\n`,
    "utf8",
  );
  const result = inspectGitRepositoryLayoutCandidate({ repositoryRoot });
  assert.equal(result.status, "candidate");
  assertPresent(result.layout);
  assert.equal(result.layout.kind, "gitfile_worktree");
});

/**
 * 別Rootを指すcore.worktreeは全てのGit観測経路で拒否するを検証する。
 *
 * @responsibility 別Rootを指すcore.worktreeは全てのGit観測経路で拒否するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 別Rootを指すcore.worktreeは全てのGit観測経路で拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("別Rootを指すcore.worktreeは全てのGit観測経路で拒否する", (t) => {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "dependency");
  const otherRoot = path.join(parent, "other");
  const gitDirectory = path.join(parent, ".git", "modules", "dependency");
  fs.mkdirSync(repositoryRoot);
  fs.mkdirSync(otherRoot);
  makeGitDirectory(gitDirectory);
  fs.writeFileSync(
    path.join(gitDirectory, "config"),
    `[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tworktree = ${otherRoot.replaceAll("\\", "/")}\n`,
    "utf8",
  );
  fs.writeFileSync(
    path.join(repositoryRoot, ".git"),
    `gitdir: ${gitDirectory}\n`,
    "utf8",
  );
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).status,
    "blocked",
  );
  assert.equal(inspectRepositoryGitObjectFormatCandidate(repositoryRoot), null);
});

/**
 * bare Repositoryと不正gitfileを拒否するを検証する。
 *
 * @responsibility bare Repositoryと不正gitfileを拒否するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus bare Repositoryと不正gitfileを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("bare Repositoryと不正gitfileを拒否する", (t) => {
  const bare = temporaryRoot(t);
  fs.writeFileSync(path.join(bare, "HEAD"), "ref: refs/heads/main\n", "utf8");
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot: bare }).reason,
    "repository_worktree_required",
  );
  const invalid = path.join(bare, "worktree");
  fs.mkdirSync(invalid);
  fs.writeFileSync(path.join(invalid, ".git"), "not-a-gitdir\n", "utf8");
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot: invalid }).reason,
    "repository_git_file_invalid",
  );
});

/**
 * Git directoryのHEADまたは共通configが欠落する候補を拒否するを検証する。
 *
 * @responsibility Git directoryのHEADまたは共通configが欠落する候補を拒否するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Git directoryのHEADまたは共通configが欠落する候補を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("Git directoryのHEADまたは共通configが欠落する候補を拒否する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  fs.mkdirSync(path.join(repositoryRoot, ".git"));
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).status,
    "blocked",
  );
});

/**
 * 限定Repository formatだけをAuthority候補として受理するを検証する。
 *
 * @responsibility 限定Repository formatだけをAuthority候補として受理するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 限定Repository formatだけをAuthority候補として受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("限定Repository formatだけをAuthority候補として受理する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  const gitDirectory = path.join(repositoryRoot, ".git");
  makeGitDirectory(gitDirectory);
  const config = path.join(gitDirectory, "config");
  fs.writeFileSync(config, "[core]\n\trepositoryformatversion = 0\n", "utf8");
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).reason,
    "repository_git_config_unsupported",
  );
  for (const value of ["true", "", "yes", "on", "1", "no", "off", "0"]) {
    fs.writeFileSync(
      config,
      `[core]\n\trepositoryformatversion = 0\n\tbare = ${value}\n`,
      "utf8",
    );
    assert.equal(
      inspectGitRepositoryLayoutCandidate({ repositoryRoot }).reason,
      "repository_git_config_unsupported",
    );
  }
  fs.writeFileSync(
    config,
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tbare = false\n",
    "utf8",
  );
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).reason,
    "repository_git_config_unsupported",
  );
  fs.writeFileSync(
    config,
    "[core]\n\trepositoryformatversion = 1\n[extensions]\n\tworktreeConfig = true\n",
    "utf8",
  );
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).reason,
    "repository_git_config_unsupported",
  );
  fs.writeFileSync(
    config,
    "[core]\n\trepositoryformatversion = 0\n\tworktree = ../other\n",
    "utf8",
  );
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).reason,
    "repository_git_config_unsupported",
  );
  fs.writeFileSync(
    config,
    "[core]\n\trepositoryformatversion = 0\n[include]\n\tpath = ../shared\n",
    "utf8",
  );
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).reason,
    "repository_git_config_unsupported",
  );
  fs.writeFileSync(
    config,
    '[core "not-the-core-section"]\n\trepositoryformatversion = 0\n',
    "utf8",
  );
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).reason,
    "repository_git_config_unsupported",
  );
  fs.writeFileSync(
    config,
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n\tignorecase = true\n",
    "utf8",
  );
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).status,
    "candidate",
  );
});

/**
 * control fileは上限ちょうどを受理し上限+1を拒否するを検証する。
 *
 * @responsibility control fileは上限ちょうどを受理し上限+1を拒否するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus control fileは上限ちょうどを受理し上限+1を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("control fileは上限ちょうどを受理し上限+1を拒否する", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const head = path.join(repositoryRoot, ".git", "HEAD");
  fs.writeFileSync(head, "a".repeat(4096), "utf8");
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).status,
    "candidate",
  );
  fs.writeFileSync(head, "a".repeat(4097), "utf8");
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).status,
    "blocked",
  );
});

/**
 * lstat後にcontrol fileを同名の別実体へ置換しても読まないを検証する。
 *
 * @responsibility lstat後にcontrol fileを同名の別実体へ置換しても読まないの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus lstat後にcontrol fileを同名の別実体へ置換しても読まないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("lstat後にcontrol fileを同名の別実体へ置換しても読まない", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const marker = path.join(repositoryRoot, ".git");
  const originalOpen = fs.openSync;
  let hasReplaced = false;
  fs.openSync = (target, ...args) => {
    if (!hasReplaced && target === path.join(marker, "HEAD")) {
      hasReplaced = true;
      fs.renameSync(target, `${target}.original`);
      fs.writeFileSync(target, "b".repeat(4097), "utf8");
    }
    return originalOpen.call(fs, target, ...args);
  };
  try {
    assert.equal(
      inspectGitRepositoryLayoutCandidate({ repositoryRoot }).status,
      "blocked",
    );
  } finally {
    fs.openSync = originalOpen;
  }
});

/**
 * 同一handleの読取り中にsizeが変わる場合はblockedへ閉じるを検証する。
 *
 * @responsibility 同一handleの読取り中にsizeが変わる場合はblockedへ閉じるの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同一handleの読取り中にsizeが変わる場合はblockedへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("同一handleの読取り中にsizeが変わる場合はblockedへ閉じる", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const originalRead = fs.readSync;
  let hasChanged = false;
  Reflect.set(fs, "readSync", (descriptor: number, ...args: unknown[]) => {
    if (!hasChanged) {
      hasChanged = true;
      fs.ftruncateSync(descriptor, 1);
    }
    return Reflect.apply(originalRead, fs, [descriptor, ...args]);
  });
  try {
    assert.equal(
      inspectGitRepositoryLayoutCandidate({ repositoryRoot }).status,
      "blocked",
    );
  } finally {
    Reflect.set(fs, "readSync", originalRead);
  }
});

/**
 * realpath解決中にRepository directoryを別実体へ置換しても候補化しないを検証する。
 *
 * @responsibility realpath解決中にRepository directoryを別実体へ置換しても候補化しないの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus realpath解決中にRepository directoryを別実体へ置換しても候補化しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("realpath解決中にRepository directoryを別実体へ置換しても候補化しない", (t) => {
  const parent = temporaryRoot(t);
  const repositoryRoot = path.join(parent, "repository");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const originalNative = fs.realpathSync.native;
  let hasReplaced = false;
  Reflect.set(
    fs.realpathSync,
    "native",
    (target: unknown, ...args: unknown[]) => {
      if (!hasReplaced && target === repositoryRoot) {
        hasReplaced = true;
        fs.renameSync(repositoryRoot, `${repositoryRoot}.original`);
        fs.mkdirSync(repositoryRoot);
        makeGitDirectory(path.join(repositoryRoot, ".git"));
      }
      return Reflect.apply(originalNative, fs.realpathSync, [target, ...args]);
    },
  );
  try {
    assert.equal(
      inspectGitRepositoryLayoutCandidate({ repositoryRoot }).status,
      "blocked",
    );
  } finally {
    Reflect.set(fs.realpathSync, "native", originalNative);
  }
});

/**
 * control fileのclose失敗を成功へ流用しないを検証する。
 *
 * @responsibility control fileのclose失敗を成功へ流用しないの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus control fileのclose失敗を成功へ流用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("control fileのclose失敗を成功へ流用しない", (t) => {
  const repositoryRoot = temporaryRoot(t);
  makeGitDirectory(path.join(repositoryRoot, ".git"));
  const originalClose = fs.closeSync;
  let hasFailed = false;
  fs.closeSync = (descriptor) => {
    originalClose.call(fs, descriptor);
    if (!hasFailed) {
      hasFailed = true;
      throw new Error("fixture-close-failure");
    }
  };
  try {
    assert.equal(
      inspectGitRepositoryLayoutCandidate({ repositoryRoot }).status,
      "blocked",
    );
  } finally {
    fs.closeSync = originalClose;
  }
});

/**
 * Git markerのlinkを拒否するを検証する。
 *
 * @responsibility Git markerのlinkを拒否するの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Git markerのlinkを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("Git markerのlinkを拒否する", (t) => {
  const parent = temporaryRoot(t);
  const target = path.join(parent, "target.git");
  const repositoryRoot = path.join(parent, "repository");
  fs.mkdirSync(repositoryRoot);
  makeGitDirectory(target);
  try {
    fs.symlinkSync(
      target,
      path.join(repositoryRoot, ".git"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    const code = errorCode(error);
    if (["EPERM", "EACCES", "ENOTSUP"].includes(code ?? "")) {
      t.skip(`link unavailable: ${code}`);
      return;
    }
    throw error;
  }
  assert.equal(
    inspectGitRepositoryLayoutCandidate({ repositoryRoot }).reason,
    "repository_git_marker_link_rejected",
  );
});

/**
 * accessorとProxyを実行せずblockedへ閉じるを検証する。
 *
 * @responsibility accessorとProxyを実行せずblockedへ閉じるの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus accessorとProxyを実行せずblockedへ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("accessorとProxyを実行せずblockedへ閉じる", () => {
  let calls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "repositoryRoot", {
    enumerable: true,
    get() {
      calls += 1;
      return path.resolve("fixture");
    },
  });
  assert.equal(inspectGitRepositoryLayoutCandidate(accessor).status, "blocked");
  assert.equal(calls, 0);
  const target = { repositoryRoot: path.resolve("fixture") };
  const proxy = new Proxy(target, {
    ownKeys() {
      calls += 1;
      return ["repositoryRoot"];
    },
  });
  assert.equal(inspectGitRepositoryLayoutCandidate(proxy).status, "blocked");
  assert.equal(calls, 0);
});

/**
 * Repository形態contractは参照Repository非変更と未実装境界を保つを検証する。
 *
 * @responsibility Repository形態contractは参照Repository非変更と未実装境界を保つの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository形態contractは参照Repository非変更と未実装境界を保つの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-IT-001=Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("Repository形態contractは参照Repository非変更と未実装境界を保つ", () => {
  const contract = describeGitRepositoryLayoutAdapterContract();
  assert.deepEqual(contract.supportedWorktreeForms, [
    "normal_worktree",
    "linked_worktree",
    "gitfile_worktree_without_core_worktree",
    "gitfile_worktree_with_matching_core_worktree",
  ]);
  assert.equal(contract.bareRepositorySupported, false);
  assert.equal(contract.referencedSubmodulesModified, false);
  assert.equal(contract.referencedRepositoriesModified, false);
  assert.equal(contract.multiRepositoryWriteOperationSupported, false);
  assert.equal(contract.filesystemResolutionCore, "implemented");
  assert.equal(
    contract.supportedRepositoryFormat,
    "version_0_without_extensions_or_includes",
  );
  assert.equal(contract.gitCliAuthorityRequired, false);
  assert.equal(
    contract.repositoryIdentityVerification,
    "repository_location_port",
  );
  assert.equal(
    contract.metadataPlacementLayoutVerification,
    "implemented_narrow_parser",
  );
  assert.equal(
    contract.metadataWriteIntegration,
    "repository_local_ignore_port",
  );
  assert.equal(contract.runtimeCapabilityIssued, false);
});

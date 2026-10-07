/**
 * 履歴保持設定の読取りを実Filesystemで確認する。
 * @packageDocumentation
 * @responsibility 不存在の既定値と不正設定の停止を反証する。
 * @trace RDL-IT-001
 * @level IT
 * @scope 履歴保持設定。
 * @boundary RDL-IT-001=Direct Boundary: 設定Reader→Repository Filesystem。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../src/storage/index.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../src/repository/index.ts";
import {
  readProjectRuntimeConfig,
  readExecutionIntelligenceConfig,
} from "../../src/configuration/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";

/**
 * 自己所有Rootで設定の全分岐を反証する。
 * @responsibility 読取り専用、閉じたSchema、aliasと観測不能の拒否を確認する。
 * @trace RDL-IT-001
 * @precondition Repository-local tmpを使用する。
 * @stimulus 不存在、有効値、未知値、不正日数、hard link、読取り失敗を与える。
 * @observation ready、blocked、File内容とDirectory一覧。
 * @oracle 不存在だけが30日既定値となり、設定を自動修正しない。
 * @cleanup exact自己所有Rootを回収し不存在を確認する。
 * @boundary RDL-IT-001=Direct Boundary: 設定Reader→Filesystem。
 */
test("保持設定は読取り専用で閉じたSchemaと真正不存在を区別する", (t) => {
  const readConfig = readProjectRuntimeConfig;
  const temporary = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      path.resolve(import.meta.dirname, "../../../.."),
      "tmp",
    ),
    "fixture_root_invalid",
  ).directory;
  const root = fs.mkdtempSync(path.join(temporary, "history-retention-"));
  t.after(() => {
    assert.equal(path.dirname(root), temporary);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  });
  fs.mkdirSync(path.join(root, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("fixture");
  const initialEntries = fs.readdirSync(root);
  const defaults = readConfig(verified.capability);
  assert.equal(defaults.status, "ready");
  if (defaults.status !== "ready") throw new Error("defaults");
  assert.equal(defaults.source, "default");
  assert.equal(defaults.config.historyRetentionDays, 30);
  const eiDefaults = readExecutionIntelligenceConfig(verified.capability);
  assert.equal(eiDefaults.status, "ready");
  if (eiDefaults.status !== "ready") throw new Error("ei_defaults");
  assert.equal(eiDefaults.config.historyRetentionDays, 30);
  assert.deepEqual(fs.readdirSync(root), initialEntries);
  assert.equal(readConfig({ ...verified.capability }).status, "blocked");
  const config = path.join(root, ".crdd", "config");
  fs.mkdirSync(config, { recursive: true });
  const file = path.join(config, "project-runtime.json");
  const eiFile = path.join(config, "execution-intelligence.json");
  const valid = {
    schemaRevision: 1,
    historyRetentionDays: 7,
  };
  fs.writeFileSync(file, JSON.stringify(valid));
  const result = readConfig(verified.capability);
  assert.equal(result.status, "ready");
  if (result.status !== "ready") throw new Error("valid");
  assert.deepEqual(result.config, valid);
  assert.equal(result.source, "file");
  assert.equal(Object.isFrozen(result.config), true);
  fs.writeFileSync(eiFile, "invalid_other_tool");
  assert.equal(readConfig(verified.capability).status, "ready");
  assert.equal(
    readExecutionIntelligenceConfig(verified.capability).status,
    "blocked",
  );
  fs.writeFileSync(
    eiFile,
    JSON.stringify({ schemaRevision: 1, historyRetentionDays: 90 }),
  );
  fs.writeFileSync(file, "invalid_other_tool");
  assert.equal(readConfig(verified.capability).status, "blocked");
  const ei = readExecutionIntelligenceConfig(verified.capability);
  assert.equal(ei.status, "ready");
  if (ei.status !== "ready") throw new Error("ei_valid");
  assert.equal(ei.config.historyRetentionDays, 90);
  for (const invalid of [
    { ...valid, unknown: true },
    { ...valid, schemaRevision: 2 },
    { schemaRevision: 1 },
    { historyRetentionDays: 7 },
    ...[0, -1, 0.5, "30", 104249992].map((historyRetentionDays) => ({
      ...valid,
      historyRetentionDays,
    })),
  ]) {
    const body = JSON.stringify(invalid);
    fs.writeFileSync(file, body);
    assert.equal(readConfig(verified.capability).status, "blocked");
    assert.equal(fs.readFileSync(file, "utf8"), body);
  }
  fs.writeFileSync(file, JSON.stringify(valid));
  const alias = path.join(config, "alias.json");
  fs.linkSync(file, alias);
  assert.equal(readConfig(verified.capability).status, "blocked");
  fs.unlinkSync(alias);
  const mock = t.mock.method(fs, "readFileSync", () => {
    throw new Error("read_unknown");
  });
  try {
    assert.equal(readConfig(verified.capability).status, "blocked");
  } finally {
    mock.mock.restore();
  }
  fs.unlinkSync(file);
  assert.equal(readConfig(verified.capability).status, "ready");
  fs.rmSync(config, { recursive: true });
  fs.writeFileSync(config, "not_directory");
  assert.equal(readConfig(verified.capability).status, "blocked");
  fs.unlinkSync(config);
  const target = path.join(root, "config-target");
  fs.mkdirSync(target);
  fs.writeFileSync(
    path.join(target, "project-runtime.json"),
    JSON.stringify(valid),
  );
  fs.symlinkSync(
    target,
    config,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(readConfig(verified.capability).status, "blocked");
  fs.unlinkSync(config);
  fs.renameSync(path.join(root, ".git"), path.join(root, "git-removed"));
  assert.equal(readConfig(verified.capability).status, "blocked");
});

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
import { ensureRepositoryRuntimeDataAreaFromWorkingDirectory } from "../../src/storage/ensure-area.ts";
import { requireReadyRepositoryRuntimeDataArea } from "../../src/repository/require-storage-area.ts";
import {
  readOrchestratorConfig,
  readExecutionIntelligenceConfig,
  readCoordinatorConfig,
} from "../../src/configuration/read-tool-config.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";

/**
 * Coordinator設定の配布例とSchemaがReader契約へ一致することを確認する。
 * @responsibility 非秘密設定の既定値と閉じた項目集合の配布時の乖離を検出する。
 * @trace RDL-IT-001
 * @precondition 現在のRepository内の設定、配布例、Schemaを読み取れる。
 * @stimulus 三成果物の値とSchema制約を照合する。
 * @observation 設定値、必須項目、未知項目の扱いと整数上限。
 * @oracle 実設定と配布例が同じ30日設定で、SchemaはReaderと同じ二項目に閉じる。
 * @cleanup N/A: 読取りだけでFileを作成・変更しない。
 * @boundary RDL-IT-001=Direct Boundary: 設定配布契約→Repository Filesystem。
 */
test("Coordinator設定の実ファイルと配布例とSchemaは同じ契約を保持する", () => {
  const repository = path.resolve(import.meta.dirname, "../../../..");
  const actual = JSON.parse(
    fs.readFileSync(
      path.join(repository, ".crdd/config/coordinator.json"),
      "utf8",
    ),
  );
  const example = JSON.parse(
    fs.readFileSync(
      path.join(repository, "template/.crdd/config/coordinator.example.json"),
      "utf8",
    ),
  );
  const schema = JSON.parse(
    fs.readFileSync(
      path.join(
        repository,
        "template/tools/schemas/coordinator-config-schema.json",
      ),
      "utf8",
    ),
  );
  assert.deepEqual(actual, { schemaRevision: 1, historyRetentionDays: 30 });
  assert.deepEqual(example, actual);
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, ["schemaRevision", "historyRetentionDays"]);
  assert.deepEqual(
    Object.keys(schema.properties).sort(),
    [...schema.required].sort(),
  );
  assert.deepEqual(schema.properties.schemaRevision, { const: 1 });
  assert.equal(schema.properties.historyRetentionDays.type, "integer");
  assert.equal(schema.properties.historyRetentionDays.minimum, 1);
  assert.equal(schema.properties.historyRetentionDays.maximum, 104249991);
  assert.equal(Number.isSafeInteger(104249991 * 86_400_000), true);
  assert.equal(Number.isSafeInteger(104249992 * 86_400_000), false);
});

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
  const readConfig = readOrchestratorConfig;
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
  const coordinatorDefaults = readCoordinatorConfig(verified.capability);
  assert.equal(coordinatorDefaults.status, "ready");
  if (coordinatorDefaults.status !== "ready")
    throw new Error("coordinator_defaults");
  assert.equal(coordinatorDefaults.source, "default");
  assert.equal(coordinatorDefaults.config.historyRetentionDays, 30);
  assert.deepEqual(fs.readdirSync(root), initialEntries);
  assert.equal(readConfig({ ...verified.capability }).status, "blocked");
  const config = path.join(root, ".crdd", "config");
  fs.mkdirSync(config, { recursive: true });
  const file = path.join(config, "orchestrator.json");
  const eiFile = path.join(config, "execution-intelligence.json");
  const coordinatorFile = path.join(config, "coordinator.json");
  const retiredFile = path.join(config, "unregistered-tool.json");
  fs.writeFileSync(retiredFile, "retired_config_must_not_be_read");
  const currentDefault = readConfig(verified.capability);
  assert.equal(currentDefault.status, "ready");
  if (currentDefault.status !== "ready") throw new Error("current_default");
  assert.equal(currentDefault.source, "default");
  assert.equal(currentDefault.config.historyRetentionDays, 30);
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
  assert.equal(
    fs.readFileSync(retiredFile, "utf8"),
    "retired_config_must_not_be_read",
  );
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
  fs.writeFileSync(
    coordinatorFile,
    JSON.stringify({ schemaRevision: 1, historyRetentionDays: 60 }),
  );
  const coordinator = readCoordinatorConfig(verified.capability);
  assert.equal(coordinator.status, "ready");
  if (coordinator.status !== "ready") throw new Error("coordinator_valid");
  assert.equal(coordinator.config.historyRetentionDays, 60);
  assert.equal(coordinator.source, "file");
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
    fs.writeFileSync(coordinatorFile, body);
    assert.equal(readConfig(verified.capability).status, "blocked");
    assert.equal(readCoordinatorConfig(verified.capability).status, "blocked");
    assert.equal(fs.readFileSync(coordinatorFile, "utf8"), body);
    assert.equal(fs.readFileSync(file, "utf8"), body);
  }
  fs.writeFileSync(file, JSON.stringify(valid));
  fs.writeFileSync(coordinatorFile, JSON.stringify(valid));
  const alias = path.join(config, "alias.json");
  fs.linkSync(file, alias);
  assert.equal(readConfig(verified.capability).status, "blocked");
  fs.unlinkSync(alias);
  fs.linkSync(coordinatorFile, alias);
  assert.equal(readCoordinatorConfig(verified.capability).status, "blocked");
  fs.unlinkSync(alias);
  const mock = t.mock.method(fs, "readFileSync", () => {
    throw new Error("read_unknown");
  });
  try {
    assert.equal(readConfig(verified.capability).status, "blocked");
    assert.equal(readCoordinatorConfig(verified.capability).status, "blocked");
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
    path.join(target, "orchestrator.json"),
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

/**
 * coordinator:integration:project-runtime-integration-record-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-integration-record-adapterが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、integration、record、adapter
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createProjectRuntimeIntegrationRecordAdapter,
  readLegacyProjectRuntimeResultInputs,
} from "../../src/security/project-runtime-integration-record-adapter.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../runtime-data/src/index.ts";

/**
 * 空の旧結果でもAreaの途中置換を拒否する。
 * @responsibility 開始と終了の境界Identityを相関させる。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryに空results領域を作る。
 * @stimulus 列挙中にproject-runtimeを別Directoryへ置換する。
 * @observation Readerの停止結果と両Directoryの存在を確認する。
 * @oracle 空結果をcompletedにせず、いずれの実体も削除しない。
 * @cleanup Mockを復元しfixtureがexact Rootだけを回収する。
 * @boundary PRL-IT-005=Direct Boundary: 共通Area観測→旧結果Reader
 */
test("空の旧結果もAreaの途中置換を正常観測へ畳まない", (t) => {
  const { root } = fixture(t);
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      root,
      "project-runtime",
    ),
    "fixture_area_invalid",
  );
  const directory = path.join(area.directory, "results");
  fs.mkdirSync(directory);
  const displaced = path.join(root, "displaced-runtime");
  const readdir = fs.readdirSync;
  let isReplaced = false;
  const mocked = t.mock.method(fs, "readdirSync", ((
    location: fs.PathLike,
    ...args: unknown[]
  ) => {
    if (String(location) === directory && !isReplaced) {
      fs.renameSync(area.directory, displaced);
      fs.mkdirSync(directory, { recursive: true });
      isReplaced = true;
      return [];
    }
    return Reflect.apply(readdir, fs, [location, ...args]);
  }) as typeof fs.readdirSync);
  try {
    assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "blocked");
    assert.equal(isReplaced, true);
    assert.equal(fs.existsSync(displaced), true);
    assert.equal(fs.existsSync(directory), true);
  } finally {
    mocked.mock.restore();
  }
});

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture(t: test.TestContext) {
  const repository = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(repository, "tmp"),
    "fixture_repository_root_invalid",
  );
  const parent = fs.realpathSync.native(area.directory);
  const root = fs.mkdtempSync(
    path.join(parent, "crdd-project-integration-record-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => {
    assert.equal(fs.realpathSync.native(root), root);
    assert.equal(path.dirname(root), parent);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  return { root };
}

/**
 * 本番Writerの公開結果を変更せず全件抽出する。
 *
 * @responsibility kindとProjectをまたぐ結果・元Byte列Hashの保持を確認する。
 * @trace PRL-IT-005
 * @precondition 自己所有Repositoryへ本番Writerで記録を作る。
 * @stimulus 抽出入口を二度呼ぶ。
 * @observation 全値、導出元Hash、読取り前後Byte列を比較する。
 * @oracle valueと結合は不変で、migrationCommittedはfalse。
 * @cleanup fixtureのRootだけを回収する。
 * @boundary 旧Writer→Filesystem→移行入力。
 */
test("旧結果の全kind・Projectを非変更で抽出し、受領済みとは扱わない", (t) => {
  const { root } = fixture(t);
  for (const kind of ["integration", "adoption"] as const) {
    for (const project of ["project-a", "project-b"]) {
      assert.equal(
        adapter(root, project).write({
          kind,
          identity: `record-${kind}`,
          value: { status: kind, applied: kind === "adoption" },
        }).status,
        "completed",
      );
    }
  }
  const read = readLegacyProjectRuntimeResultInputs(root);
  assert.equal(read.status, "completed");
  if (read.status !== "completed") throw new Error("read_failed");
  assert.equal(read.value.records.length, 4);
  assert.equal(read.value.sourceRecords.length, 4);
  assert.equal(read.value.migrationCommitted, false);
  for (const source of read.value.sourceRecords) {
    const bytes = fs.readFileSync(
      path.join(root, ".crdd", "project-runtime", source.relativePath),
    );
    assert.equal(
      source.sha256,
      createHash("sha256").update(bytes).digest("hex"),
    );
  }
  assert.deepEqual(readLegacyProjectRuntimeResultInputs(root), read);
});

/**
 * 破損・結合差・残存候補を黙って捨てないことを確認する。
 *
 * @responsibility 不正結果を空入力へ畳まず既存Byte列を保全する。
 * @trace PRL-IT-005
 * @precondition 本番Writerが保存した結果を使う。
 * @stimulus 未知key、kind、Project、Identity、Hash、pending、hardlinkを注入する。
 * @observation 停止結果とFile内容を確認する。
 * @oracle 一件でも不正なら全体を停止し移行候補を返さない。
 * @cleanup fixtureのRootだけを回収する。
 * @boundary 旧結果の全数検証。
 */
test("旧結果のHash・結合・未知項目とpending・hardlinkを拒否し保全する", (t) => {
  const { root } = fixture(t);
  assert.equal(
    adapter(root).write({
      kind: "adoption",
      identity: "receipt-a",
      value: { applied: true },
    }).status,
    "completed",
  );
  const directory = path.join(
    root,
    ".crdd",
    "project-runtime",
    "results",
    "adoption",
    "project-a",
  );
  const target = path.join(directory, "receipt-a.json");
  const original = fs.readFileSync(target, "utf8");
  for (const change of [
    { extra: true },
    { kind: "integration" },
    { projectId: "project-b" },
    { identity: "receipt-b" },
    { contentHash: "0".repeat(64) },
    { value: { applied: false } },
  ]) {
    const invalid = JSON.stringify({ ...JSON.parse(original), ...change });
    fs.writeFileSync(target, invalid);
    const result = readLegacyProjectRuntimeResultInputs(root);
    assert.equal(result.status, "blocked");
    assert.equal(
      result.status === "blocked" && result.manualRecoveryRequired,
      false,
    );
    assert.equal(fs.readFileSync(target, "utf8"), invalid);
  }
  fs.writeFileSync(target, original);
  const pending = path.join(directory, ".pending-trial.tmp");
  fs.writeFileSync(pending, "unfinished");
  assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "blocked");
  assert.equal(fs.readFileSync(pending, "utf8"), "unfinished");
  fs.unlinkSync(pending);
  const link = path.join(root, "receipt-hardlink");
  fs.linkSync(target, link);
  assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "blocked");
  fs.unlinkSync(link);
  assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "completed");
});

/**
 * 真正不存在と観測不能・列挙後消失・親aliasを区別する。
 *
 * @responsibility 不明を空結果へ読み替えない。
 * @trace PRL-IT-005
 * @precondition 自己所有の試験Repositoryを使う。
 * @stimulus ENOENT、EACCES、親junctionと上限超過を注入する。
 * @observation 空結果と停止結果、元Fileの保全を確認する。
 * @oracle 親の真正不存在だけ成功し、他は停止する。
 * @cleanup Mockを復元しfixtureのRootだけを回収する。
 * @boundary Repository Root・親領域・個別File読取り。
 */
test("旧結果は真正不存在だけ空とし、観測不能・途中消失・alias・超過を停止する", (t) => {
  const { root } = fixture(t);
  const absent = readLegacyProjectRuntimeResultInputs(root);
  assert.equal(absent.status, "completed");
  if (absent.status !== "completed") throw new Error("absent_failed");
  assert.equal(absent.value.records.length, 0);
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  assert.equal(
    adapter(root).write({
      kind: "integration",
      identity: "candidate-a",
      value: {},
    }).status,
    "completed",
  );
  const target = path.join(
    root,
    ".crdd",
    "project-runtime",
    "results",
    "integration",
    "project-a",
    "candidate-a.json",
  );
  const lstat = fs.lstatSync;
  for (const code of ["EACCES", "ENOENT"]) {
    const mock = t.mock.method(fs, "lstatSync", ((
      location: fs.PathLike,
      ...args: unknown[]
    ) => {
      if (String(location) === target)
        throw Object.assign(new Error("injected"), { code });
      return Reflect.apply(lstat, fs, [location, ...args]);
    }) as typeof fs.lstatSync);
    try {
      assert.equal(
        readLegacyProjectRuntimeResultInputs(root).status,
        "blocked",
      );
    } finally {
      mock.mock.restore();
    }
  }
  const original = fs.readFileSync(target);
  fs.writeFileSync(target, "x".repeat(16 * 1024 * 1024 + 1));
  assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "blocked");
  fs.writeFileSync(target, original);
  const project = path.dirname(target);
  const displaced = path.join(root, "displaced");
  fs.renameSync(project, displaced);
  fs.symlinkSync(
    displaced,
    project,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "blocked");
  fs.unlinkSync(project);
  fs.renameSync(displaced, project);
  assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "completed");
});

/**
 * 観測済み祖先の消失と不正encodingを正常入力へ畳まない。
 *
 * @responsibility 存在確認後の失敗と置換文字を使ったHash一致の反証を固定する。
 * @trace PRL-IT-005
 * @precondition 本番Writer結果と自己所有Repositoryを使う。
 * @stimulus 親realpathのENOENT、空返却前祖先EACCES、不正UTF-8を注入する。
 * @observation 停止結果と元bytesの不変を確認する。
 * @oracle いずれも空入力や受理へ変換しない。
 * @cleanup Mockを復元しfixtureのRootだけを回収する。
 * @boundary Filesystem観測とJSON復号。
 */
test("旧結果は親の途中消失・祖先再確認失敗・不正UTF8を拒否する", (t) => {
  const { root } = fixture(t);
  const lstat = fs.lstatSync;
  let rootReads = 0;
  const ancestorMock = t.mock.method(fs, "lstatSync", ((
    location: fs.PathLike,
    ...args: unknown[]
  ) => {
    if (String(location) === root && ++rootReads >= 2)
      throw Object.assign(new Error("injected"), { code: "EACCES" });
    return Reflect.apply(lstat, fs, [location, ...args]);
  }) as typeof fs.lstatSync);
  try {
    assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "blocked");
  } finally {
    ancestorMock.mock.restore();
  }
  assert.equal(
    adapter(root).write({
      kind: "integration",
      identity: "candidate-a",
      value: { text: "\uFFFD" },
    }).status,
    "completed",
  );
  const parent = path.join(root, ".crdd");
  const realpath = fs.realpathSync.native;
  const parentMock = t.mock.method(fs.realpathSync, "native", ((
    location: fs.PathLike,
    ...args: unknown[]
  ) => {
    if (String(location) === parent)
      throw Object.assign(new Error("injected"), { code: "ENOENT" });
    return Reflect.apply(realpath, fs.realpathSync, [location, ...args]);
  }) as typeof fs.realpathSync.native);
  try {
    assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "blocked");
  } finally {
    parentMock.mock.restore();
  }
  const target = path.join(
    root,
    ".crdd",
    "project-runtime",
    "results",
    "integration",
    "project-a",
    "candidate-a.json",
  );
  const original = fs.readFileSync(target);
  const replacement = Buffer.from("\uFFFD");
  const index = original.indexOf(replacement);
  assert.notEqual(index, -1);
  const invalid = Buffer.concat([
    original.subarray(0, index),
    Buffer.from([0xff]),
    original.subarray(index + replacement.length),
  ]);
  assert.equal(invalid.toString("utf8"), original.toString("utf8"));
  fs.writeFileSync(target, invalid);
  assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "blocked");
  assert.deepEqual(fs.readFileSync(target), invalid);
  fs.writeFileSync(target, original);
  assert.equal(readLegacyProjectRuntimeResultInputs(root).status, "completed");
});

/**
 * adapterのTest準備責務を実行する。
 *
 * @responsibility adapterがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus adapterを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function adapter(root: string, projectId = "project-a") {
  return createProjectRuntimeIntegrationRecordAdapter({
    workingDirectory: root,
    repositoryBindingId: "binding-a",
    projectId,
    milestoneId: "milestone-a",
    queueId: "queue-a",
  });
}

/**
 * integration records are immutable and an identical retry is idempotentを検証する。
 *
 * @responsibility integration records are immutable and an identical retry is idempotentの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus integration records are immutable and an identical retry is idempotentの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("integration records are immutable and an identical retry is idempotent", (t) => {
  const { root } = fixture(t);
  const records = adapter(root);
  const record = {
    kind: "integration" as const,
    identity: "candidate-a",
    value: { status: "candidate", changedPaths: ["result.txt"] },
  };
  assert.equal(records.write(record).status, "completed");
  assert.equal(records.write(record).status, "completed");
  const target = path.join(
    root,
    ".crdd",
    "project-runtime",
    "results",
    "integration",
    "project-a",
    "candidate-a.json",
  );
  assert.equal(fs.existsSync(target), true);
  assert.equal(
    JSON.parse(fs.readFileSync(target, "utf8")).identity,
    "candidate-a",
  );
});

/**
 * 正規Candidate IdentityをIntegration Recordとして保存できることを検証する。
 *
 * @responsibility Candidate Storeが発行する完全なCandidate IDとIntegration Record境界の互換性を判定する。
 * @trace PRL-IT-005
 * @precondition Candidate IDは`candidate.<64hex>.<64hex>`の正規形式である。
 * @stimulus 正規Candidate IDをIdentityとするIntegration Recordを書き込む。
 * @observation 書込み結果と生成Recordを取得する。
 * @oracle 128文字を超える正規Identityを長さだけで拒否せず、完全なIdentityを保持する。
 * @cleanup 登録済みhookが一時Repositoryを清掃する。
 * @boundary PRL-IT-005=Related 2 Blocks: Candidate Store→Integration Record Adapter
 */
test("canonical candidate identity is preserved by the integration record", (t) => {
  const { root } = fixture(t);
  const records = adapter(root);
  const candidateId = `candidate.${"a".repeat(64)}.${"b".repeat(64)}`;
  const result = records.write({
    kind: "integration",
    identity: candidateId,
    value: { status: "candidate", changedPaths: ["result.txt"] },
  });
  assert.equal(result.status, "completed");
  const target = path.join(
    root,
    ".crdd",
    "project-runtime",
    "results",
    "integration",
    "project-a",
    `${candidateId}.json`,
  );
  assert.equal(
    JSON.parse(fs.readFileSync(target, "utf8")).identity,
    candidateId,
  );
  assert.deepEqual(fs.readdirSync(path.dirname(target)), [
    `${candidateId}.json`,
  ]);
});

/**
 * an identity collision is blocked without replacing the first recordを検証する。
 *
 * @responsibility an identity collision is blocked without replacing the first recordの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus an identity collision is blocked without replacing the first recordの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("an identity collision is blocked without replacing the first record", (t) => {
  const { root } = fixture(t);
  const records = adapter(root);
  const first = {
    kind: "adoption" as const,
    identity: "receipt-a",
    value: { afterRevision: "a".repeat(40) },
  };
  assert.equal(records.write(first).status, "completed");
  const directory = path.join(
    root,
    ".crdd",
    "project-runtime",
    "results",
    "adoption",
    "project-a",
  );
  const target = path.join(directory, "receipt-a.json");
  const original = fs.readFileSync(target);
  const collision = records.write({
    ...first,
    value: { afterRevision: "b".repeat(40) },
  });
  assert.equal(collision.status, "blocked");
  assert.equal(
    collision.status === "blocked" && collision.manualRecoveryRequired,
    true,
  );
  assert.deepEqual(fs.readFileSync(target), original);
  assert.deepEqual(fs.readdirSync(directory), ["receipt-a.json"]);
});

/**
 * invalid path identities fail before creating a record directoryを検証する。
 *
 * @responsibility invalid path identities fail before creating a record directoryの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus invalid path identities fail before creating a record directoryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("invalid path identities fail before creating a record directory", (t) => {
  const { root } = fixture(t);
  const escaped = `escape-${path.basename(root)}`;
  const outside = path.join(root, "..", escaped);
  const result = adapter(root, `../${escaped}`).write({
    kind: "integration",
    identity: "candidate-a",
    value: {},
  });
  assert.equal(result.status, "blocked");
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
  assert.equal(fs.existsSync(outside), false);
});

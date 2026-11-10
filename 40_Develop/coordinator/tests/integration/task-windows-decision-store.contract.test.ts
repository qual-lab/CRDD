/**
 * coordinator:integration:task-windows-decision-storeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:task-windows-decision-storeが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、windows、decision、store
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import type { CoordinatorDecisionRecord } from "../../../domain-model/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import {
  createCoordinatorWindowsDecisionStoreTestingAdapter,
  openRuntimeOwnedWindowsProjectDecisionStore,
} from "../../src/decision/store.ts";

/**
 * 判断保存試験の一時領域を現在Repositoryへ限定する。
 * @responsibility 自己生成Rootの実体と親を清掃直前にも確認する。
 * @trace PRL-IT-005
 * @precondition 現在Repositoryを検証できる。
 * @stimulus 既存Runtime Data APIから試験Rootを作成する。
 * @observation Rootの実体と終了後不存在。
 * @oracle OS一時領域や過去保持物へ書込み・削除しない。
 * @cleanup このCaseが作ったRootだけを回収する。
 * @boundary 試験準備のみ。保護されたHostの真正性を主張しない。
 */
function fixture(t: test.TestContext) {
  const parent = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      fileURLToPath(new URL("../../../../", import.meta.url)),
      "tests",
    ),
    "fixture_repository_invalid",
  ).directory;
  const root = fs.mkdtempSync(path.join(parent, "crdd-decision-store-"));
  const identity = fs.lstatSync(root, { bigint: true });
  t.after(() => {
    assert.equal(path.dirname(root), parent);
    assert.equal(fs.realpathSync.native(root), root);
    const current = fs.lstatSync(root, { bigint: true });
    assert.equal(current.dev, identity.dev);
    assert.equal(current.ino, identity.ino);
    assert.equal(current.birthtimeNs, identity.birthtimeNs);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  return root;
}

/**
 * recordのTest準備責務を実行する。
 *
 * @responsibility recordがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-005
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus recordを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
function record(): CoordinatorDecisionRecord {
  return Object.freeze({
    recordId: "decision-a",
    decisionId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    repositoryRevision: "a".repeat(40),
    expectedGeneration: 2,
    principalId: "local.email.fixture@example.invalid",
    allowedOptions: Object.freeze(["resume"] as const),
    capabilityHash: "d".repeat(64),
    expiresAtEpochMs: 10_000,
    disposition: "pending",
    applicationId: null,
    selectedOption: null,
    newGeneration: null,
    replacementRequestId: null,
  });
}

/**
 * protected decision store retains an immutable CAS generation chainを検証する。
 *
 * @responsibility protected decision store retains an immutable CAS generation chainの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus protected decision store retains an immutable CAS generation chainの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("protected decision store retains an immutable CAS generation chain", (t) => {
  const root = fixture(t);
  const store = createCoordinatorWindowsDecisionStoreTestingAdapter(root);
  const first = record();
  assert.deepEqual(store.create(first), { status: "completed", value: first });
  const prepared = Object.freeze({
    ...first,
    disposition: "prepared" as const,
    applicationId: "application-a",
    selectedOption: "resume" as const,
    newGeneration: 3,
  });
  assert.deepEqual(store.compareAndSet(first, prepared), {
    status: "completed",
    value: prepared,
  });
  assert.deepEqual(store.read(first.recordId), {
    status: "completed",
    value: prepared,
  });
  assert.equal(
    (store.compareAndSet(first, prepared) as { status: string }).status,
    "blocked",
  );
  assert.equal(
    fs
      .readdirSync(root)
      .filter((name) =>
        /^project-decision-[0-9a-f]{40}-[0-9]{8}\.json$/u.test(name),
      ).length,
    2,
  );
});

/**
 * missing generation or changed immutable record fails closedを検証する。
 *
 * @responsibility missing generation or changed immutable record fails closedの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus missing generation or changed immutable record fails closedの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-005=Direct Boundary: coordinator Test Source→対象契約
 */
test("missing generation or changed immutable record fails closed", (t) => {
  const root = fixture(t);
  const store = createCoordinatorWindowsDecisionStoreTestingAdapter(root);
  const first = record();
  assert.equal((store.create(first) as { status: string }).status, "completed");
  const recordPath = fs
    .readdirSync(root)
    .find((name) => name.endsWith(".json"));
  assert.ok(recordPath);
  fs.appendFileSync(path.join(root, recordPath), " ");
  assert.equal(
    (store.read(first.recordId) as { status: string }).status,
    "blocked",
  );
});

/**
 * 新品のRepository内領域を本番の固定所在設定として渡す。
 * @responsibility 実Local AppDataを操作せず、設定は同期区間の終了時に戻す。
 * @trace PRL-IT-005
 * @boundary 公開Store入口→Node.js Filesystemと共通wx Lock。
 */
function withLocalData(
  t: test.TestContext,
  run: (base: string, root: string) => void,
) {
  const base = fixture(t);
  const before = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = base;
  try {
    run(base, path.join(base, "Qual-Lab", "CRDD", "RuntimeState"));
  } finally {
    if (before === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = before;
  }
}

test("Node固定保存先は未作成を読取りでは作らず、初期化後は同じ記録を再入場で読む", {
  skip: process.platform !== "win32",
}, (t) => {
  withLocalData(t, (base, root) => {
    assert.equal(
      openRuntimeOwnedWindowsProjectDecisionStore({
        initializeIfMissing: false,
      }).status,
      "blocked",
    );
    assert.deepEqual(fs.readdirSync(base), []);
    const opened = openRuntimeOwnedWindowsProjectDecisionStore();
    assert.equal(opened.status, "completed");
    assert.ok(opened.store);
    assert.equal(
      (opened.store.create(record()) as { status: string }).status,
      "completed",
    );
    assert.equal(fs.existsSync(path.join(root, "docker-state.lock")), false);
    const reentered = openRuntimeOwnedWindowsProjectDecisionStore({
      initializeIfMissing: false,
    });
    assert.ok(reentered.store);
    assert.equal(
      (reentered.store.read(record().recordId) as { status: string }).status,
      "completed",
    );
  });
});

test("Node固定保存先は途中Fileを上書きせず停止する", {
  skip: process.platform !== "win32",
}, (t) => {
  withLocalData(t, (base) => {
    const obstruction = path.join(base, "Qual-Lab");
    fs.writeFileSync(obstruction, "preserve");
    assert.equal(
      openRuntimeOwnedWindowsProjectDecisionStore().status,
      "blocked",
    );
    assert.equal(fs.readFileSync(obstruction, "utf8"), "preserve");
    assert.deepEqual(fs.readdirSync(base), ["Qual-Lab"]);
  });
});

test("Node固定保存先はJunctionをたどらず対象先を変更しない", {
  skip: process.platform !== "win32",
}, (t) => {
  withLocalData(t, (base) => {
    const target = path.join(base, "untouched");
    fs.mkdirSync(target);
    fs.symlinkSync(target, path.join(base, "Qual-Lab"), "junction");
    assert.equal(
      openRuntimeOwnedWindowsProjectDecisionStore().status,
      "blocked",
    );
    assert.deepEqual(fs.readdirSync(target), []);
  });
});

test("Node固定保存先はRoot置換後に元Storeから書かない", {
  skip: process.platform !== "win32",
}, (t) => {
  withLocalData(t, (_base, root) => {
    const opened = openRuntimeOwnedWindowsProjectDecisionStore();
    assert.ok(opened.store);
    fs.renameSync(root, `${root}-original`);
    fs.mkdirSync(root);
    assert.notEqual(
      (opened.store.create(record()) as { status: string }).status,
      "completed",
    );
    assert.deepEqual(fs.readdirSync(root), []);
    assert.deepEqual(fs.readdirSync(`${root}-original`), []);
  });
});

test("Node固定保存先は残存Lockを自動回収しない", {
  skip: process.platform !== "win32",
}, (t) => {
  withLocalData(t, (_base, root) => {
    const opened = openRuntimeOwnedWindowsProjectDecisionStore();
    assert.ok(opened.store);
    const lock = path.join(root, "docker-state.lock");
    fs.writeFileSync(lock, "unknown-lock");
    assert.notEqual(
      (opened.store.create(record()) as { status: string }).status,
      "completed",
    );
    assert.equal(fs.readFileSync(lock, "utf8"), "unknown-lock");
  });
});

test("Node固定保存先は初期化途中の失敗で既作成段を保全し、明示再実行できる", {
  skip: process.platform !== "win32",
}, (t) => {
  withLocalData(t, (base, root) => {
    const original = fs.mkdirSync;
    const failure = t.mock.method(
      fs,
      "mkdirSync",
      (...args: Parameters<typeof fs.mkdirSync>) => {
        if (args[0] === path.join(base, "Qual-Lab", "CRDD"))
          throw Object.assign(new Error("fixture_denied"), { code: "EACCES" });
        return Reflect.apply(original, fs, args);
      },
    );
    try {
      assert.equal(
        openRuntimeOwnedWindowsProjectDecisionStore().status,
        "blocked",
      );
      assert.deepEqual(fs.readdirSync(base), ["Qual-Lab"]);
      assert.deepEqual(fs.readdirSync(path.join(base, "Qual-Lab")), []);
      assert.equal(fs.existsSync(root), false);
    } finally {
      failure.mock.restore();
    }
    assert.equal(
      openRuntimeOwnedWindowsProjectDecisionStore().status,
      "completed",
    );
    assert.deepEqual(fs.readdirSync(root), []);
  });
});

test("Node固定保存先は相対設定を拒否し保存物を作らない", {
  skip: process.platform !== "win32",
}, (t) => {
  withLocalData(t, (base) => {
    process.env.LOCALAPPDATA = "relative-root";
    assert.equal(
      openRuntimeOwnedWindowsProjectDecisionStore().status,
      "blocked",
    );
    assert.deepEqual(fs.readdirSync(base), []);
  });
});

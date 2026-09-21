/**
 * coordinator:integration:project-runtime-windows-decision-storeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-windows-decision-storeが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、windows、decision、store
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import type { ProjectRuntimeDecisionRecord } from "../../../project-runtime/src/index.ts";
import { createProjectRuntimeWindowsDecisionStoreTestingAdapter } from "../../src/security/project-runtime-windows-decision-store.ts";

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
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function record(): ProjectRuntimeDecisionRecord {
  return Object.freeze({
    recordId: "decision-a",
    decisionId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    repositoryRevision: "a".repeat(40),
    expectedGeneration: 2,
    principalId: "c".repeat(64),
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
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("protected decision store retains an immutable CAS generation chain", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-decision-store-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createProjectRuntimeWindowsDecisionStoreTestingAdapter(root);
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
 * @boundary PRL-IT-005=Related 2 Blocks: Task State→Authority Gate→Runtime
 */
test("missing generation or changed immutable record fails closed", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-decision-store-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const store = createProjectRuntimeWindowsDecisionStoreTestingAdapter(root);
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

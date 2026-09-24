/**
 * coordinator:integration:project-runtime-decision-recovery-storeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-decision-recovery-storeが所有する検証責務を実行する。
 * @trace PRL-IT-013
 * @level IT
 * @scope project、runtime、decision、recovery、store
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createProjectRuntimeDecisionRecoveryStore } from "../../src/security/project-runtime-decision-recovery-store.ts";
import type { ProjectRuntimeDecisionRecoveryIntent } from "../../../project-runtime/src/index.ts";

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-decision-recovery-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}
/**
 * intentのTest準備責務を実行する。
 *
 * @responsibility intentがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus intentを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
function intent(): ProjectRuntimeDecisionRecoveryIntent {
  return Object.freeze({
    recoveryId: "decision-recovery-a",
    recordId: "decision-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    queueId: "queue-a",
    applicationId: "application-a",
    expectedGeneration: 2,
    newGeneration: 3,
    observedDisposition: "prepared",
    unknownBoundary: "project_readback",
    disposition: "required",
  });
}

/**
 * independent decision recovery intent survives a fresh store and settles by CASを検証する。
 *
 * @responsibility independent decision recovery intent survives a fresh store and settles by CASの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus independent decision recovery intent survives a fresh store and settles by CASの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
test("independent decision recovery intent survives a fresh store and settles by CAS", (t) => {
  const root = fixture(t);
  const first = createProjectRuntimeDecisionRecoveryStore(root);
  const value = intent();
  assert.equal((first.create(value) as { status: string }).status, "completed");
  const reopened = createProjectRuntimeDecisionRecoveryStore(root);
  assert.deepEqual(
    (reopened.read(value.recoveryId) as { value: unknown }).value,
    value,
  );
  const settled = Object.freeze({ ...value, disposition: "settled" as const });
  assert.equal(
    (reopened.compareAndSet(value, settled) as { status: string }).status,
    "completed",
  );
  assert.deepEqual(
    (reopened.read(value.recoveryId) as { value: unknown }).value,
    settled,
  );
});

/**
 * recovery intent store rejects duplicate creation and a stale CASを検証する。
 *
 * @responsibility recovery intent store rejects duplicate creation and a stale CASの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus recovery intent store rejects duplicate creation and a stale CASの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
test("recovery intent store rejects duplicate creation and a stale CAS", (t) => {
  const store = createProjectRuntimeDecisionRecoveryStore(fixture(t));
  const value = intent();
  assert.equal((store.create(value) as { status: string }).status, "completed");
  assert.equal((store.create(value) as { status: string }).status, "blocked");
  const stale = Object.freeze({ ...value, unknownBoundary: "queue_update" });
  assert.equal(
    (
      store.compareAndSet(stale, {
        ...stale,
        disposition: "settled",
      }) as { status: string }
    ).status,
    "blocked",
  );
});

/**
 * unknown files fail closed without replacing the recovery historyを検証する。
 *
 * @responsibility unknown files fail closed without replacing the recovery historyの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus unknown files fail closed without replacing the recovery historyの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Related 2 Blocks: Task／Recovery Store→再入場Application
 */
test("unknown files fail closed without replacing the recovery history", (t) => {
  const root = fixture(t);
  const store = createProjectRuntimeDecisionRecoveryStore(root);
  const value = intent();
  assert.equal((store.create(value) as { status: string }).status, "completed");
  const identity = fs
    .readdirSync(
      path.join(root, ".crdd", "project-runtime", "recovery", "decisions"),
    )
    .find((entry) => !entry.endsWith(".lock"));
  assert.ok(identity);
  fs.writeFileSync(
    path.join(
      root,
      ".crdd",
      "project-runtime",
      "recovery",
      "decisions",
      identity,
      "unexpected",
    ),
    "x",
  );
  assert.equal(
    (store.read(value.recoveryId) as { status: string }).status,
    "blocked",
  );
});

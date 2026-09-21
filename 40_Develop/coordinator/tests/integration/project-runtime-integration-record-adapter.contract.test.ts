/**
 * coordinator:integration:project-runtime-integration-record-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:project-runtime-integration-record-adapterが所有する検証責務を実行する。
 * @trace PRL-IT-005
 * @level IT
 * @scope project、runtime、integration、record、adapter
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createProjectRuntimeIntegrationRecordAdapter } from "../../src/security/project-runtime-integration-record-adapter.ts";

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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
 */
function fixture(t: test.TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-project-integration-record-"),
  );
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root };
}

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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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
 * an identity collision is blocked without replacing the first recordを検証する。
 *
 * @responsibility an identity collision is blocked without replacing the first recordの合否判定を所有する。
 * @trace PRL-IT-005
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus an identity collision is blocked without replacing the first recordの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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
  const collision = records.write({
    ...first,
    value: { afterRevision: "b".repeat(40) },
  });
  assert.equal(collision.status, "blocked");
  assert.equal(
    collision.status === "blocked" && collision.manualRecoveryRequired,
    true,
  );
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
 * @boundary Related 2 Blocks: Task State→Authority Gate→Runtime
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

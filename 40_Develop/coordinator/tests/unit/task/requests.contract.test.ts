/**
 * 単発依頼の閉入力と公開結果投影を検証する。
 * @packageDocumentation
 * @responsibility 不正入力を実行前に拒否し、成功理由と一次失敗の相関を保持する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 値検査のみ。
 * @boundary Surface入力と単発Owner。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../../domain-model/tests/support/source-declaration.ts";
import { inspectSingleTaskCommand } from "../../../src/task/requests.ts";

/**
 * 固定ContextとmodeごとのPath条件を照合する。
 * @responsibility 作業指示のPathを技術的ACLや任意Root許可にしない。
 * @trace PRL-UT-006
 * @precondition 合成の非秘密入力だけを使う。
 * @stimulus mode、対象、同意、余剰field、getterとProxyを変更する。
 * @observation 閉じたSnapshot又はnullとgetter呼出し0。
 * @oracle 明示した入力だけ受理し旧change_candidateを拒否する。
 * @cleanup Process内値だけ。
 * @boundary 公開要求値の固定。
 */
test("単発入力はROとWorkspaceを分け越境・旧Bundle・余剰値を拒否する", () => {
  const command = {
    mode: "read_only_advice",
    workType: null,
    prompt: "合成入力",
    contextReferences: ["PROJECT_CONTEXT.md"],
    allowedPaths: [],
    externalSendConfirmed: true,
    expectedNetworkPolicyHash: "a".repeat(64),
    workspaceId: null,
  };
  assert.ok(inspectSingleTaskCommand(command));
  assert.ok(
    inspectSingleTaskCommand({
      ...command,
      mode: "workspace_edit",
      allowedPaths: ["src/file.ts"],
    }),
  );
  for (const invalid of [
    { ...command, mode: "change_candidate" },
    { ...command, externalSendConfirmed: false },
    { ...command, expectedNetworkPolicyHash: undefined },
    { ...command, expectedNetworkPolicyHash: "wrong" },
    { ...command, contextReferences: ["secret.txt"] },
    { ...command, allowedPaths: ["src"] },
    { ...command, mode: "workspace_edit" },
    { ...command, mode: "workspace_edit", allowedPaths: ["../other"] },
    { ...command, mode: "workspace_edit", allowedPaths: ["C:/other"] },
    { ...command, mode: "workspace_edit", allowedPaths: ["src", "src"] },
    { ...command, workspaceId: "wrong" },
    { ...command, candidateId: "old" },
    { ...command, profileId: "PROFILE-100001" },
    { ...command, choice: { provider: "codex" } },
    new Proxy(command, {}),
  ])
    assert.equal(inspectSingleTaskCommand(invalid), null);
  let reads = 0;
  const getter = { ...command };
  Object.defineProperty(getter, "prompt", {
    enumerable: true,
    get: () => {
      reads++;
      return "not_read";
    },
  });
  assert.equal(inspectSingleTaskCommand(getter), null);
  assert.equal(reads, 0);
});

/**
 * 成功理由と一次失敗を公開状態・実行状態の相関で区別する。
 * @responsibility 成功理由の混入だけを除き、失敗・取消・未確認と回復参照を保全する。
 * @trace PRL-UT-006
 * @precondition 製品の純粋view本文と合成状態だけを用いる。
 * @stimulus 公開状態・実行状態・理由・記録欠測を組み合わせる。
 * @observation reason、primaryFailure、元回復配列。
 * @oracle 両completedだけ一次失敗null、他状態の理由とexact参照は不変。
 * @cleanup N/A: メモリ内の純粋投影。
 * @boundary 単発Ownerの公開Snapshot。
 */
test("公開完了は成功理由を一次失敗へ複写せず不明・取消の原因を保持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/task/requests.ts", import.meta.url),
    "utf8",
  );
  const project = runInNewContext(
    `(${stripTypeScriptTypes(sourceDeclaration(source, "view"))})`,
  ) as (
    id: string,
    record: Record<string, unknown> | null,
    status: string,
    reason: string | null,
  ) => Record<string, unknown>;
  const recoveryIds = ["same-exact-recovery"];
  for (const status of [
    "completed",
    "blocked",
    "cancelled",
    "unknown",
    "accepted",
    "running",
  ] as const) {
    const record = {
      status:
        status === "accepted" || status === "running" ? "pending" : status,
      reason: "coordinator_task_workspace_review_completed",
      recoveryIds,
      cleanupConfirmed: false,
    };
    const result = project("request-synthetic", record, status, record.reason);
    assert.equal(result.reason, record.reason);
    assert.equal(
      result.primaryFailure,
      status === "completed" ? null : record.reason,
    );
    assert.equal(result.recoveryIds, recoveryIds);
    assert.equal(result.cleanupConfirmed, false);
  }
  for (const [status, executionStatus] of [
    ["unknown", "completed"],
    ["completed", "unknown"],
    ["blocked", "completed"],
  ] as const) {
    const result = project(
      "request-synthetic",
      { status: executionStatus, reason: "original_failure", recoveryIds },
      status,
      "save_unconfirmed",
    );
    assert.equal(result.primaryFailure, "original_failure");
    assert.equal(result.reason, "save_unconfirmed");
    assert.equal(result.recoveryIds, recoveryIds);
  }
  const missing = project(
    "request-synthetic",
    null,
    "unknown",
    "record_unavailable",
  );
  assert.equal(missing.primaryFailure, "record_unavailable");
  assert.equal(
    project(
      "request-synthetic",
      { status: "completed", reason: null },
      "completed",
      null,
    ).primaryFailure,
    null,
  );
});

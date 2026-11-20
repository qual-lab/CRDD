/**
 * 終了要約の固定byte・Hashと拒否条件をDomain値Ownerで反証する。
 * @packageDocumentation
 * @responsibility 純粋な要約投影を物理履歴保存・清掃の成立と区別する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 固定Identity、三利用側、一次失敗、元本文Hashと終端前の拒否。
 * @boundary メモリ内だけ。Filesystem・実行Owner・外部AIを使用しない。
 */

import { hashExecutionStateContent } from "../../../src/state/operations.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  decodeStateSnapshot,
  prepareStateHistorySummary,
  prepareStateOperationSnapshot,
} from "../../../src/state/validation.ts";
import { encodeStateValue } from "../../../src/state/operations.ts";
import { createResourceOperationFixture } from "../../support/resource-operation.ts";

const binding = "a".repeat(64);

/**
 * 正規の初期Operationから終了要約用の合成状態を作る。
 * @responsibility 製品の値検査を通したIdentityを固定し、技術的完了を捏造しない。
 * @trace PRL-UT-006
 * @precondition 非秘密の固定利用側だけを渡す。
 * @stimulus 初期候補を作り、phaseと結果だけを設定する。
 * @observation 元状態・結果状態・正規bytes・exact回復参照。
 * @oracle Provider実行や清掃成功を補完しない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary Domain公開候補と同Owner内の要約検査。
 */
function summaryFixture(
  consumer: "orchestrator" | "coordinator_cli" | "workbench" = "orchestrator",
) {
  const nonce = "b".repeat(64);
  const identity = {
    schema: "crdd-coordinator/operation-identity/v6",
    operationNonce: nonce,
    provider: "claude",
    consumer,
    operationId: "OP-123456",
    recoveryCorrelationId: "task-operation-a",
    executionSelection: {
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      reasoningEffort: "low",
      purpose: "task",
      catalogIdentity: "1".repeat(64),
      configIdentity: "2".repeat(64),
      role: "executor",
      workType: null,
      source: "explicit",
    },
    taskAttempt: 0,
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    repositoryBinding: binding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
  };
  const identityJson = `${JSON.stringify(identity)}\n`;

  const fixture = createResourceOperationFixture();
  const original = decodeStateSnapshot(fixture.bytes, binding);
  assert.ok(original);
  const host = original.snapshot.operations.find(
    (item) => item.kind === "host_operation",
  );
  assert.ok(host);
  const hostBytes = Buffer.from(
    `${encodeStateValue({ ...original.snapshot, operations: [host] })}\n`,
  );
  const bytes = prepareStateOperationSnapshot(hostBytes, identityJson, binding);
  assert.ok(bytes);
  const decoded = decodeStateSnapshot(bytes, binding);
  assert.ok(decoded);
  const initial = decoded.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(initial);
  const operation = {
    ...initial,
    phase: "settling" as const,
    execution: {
      providerStart: "unknown" as const,
      externalSend: "unknown" as const,
      sharedWrite: "unknown" as const,
      ownerEffect: "unknown" as const,
      workspaceReusable: false,
    },
    lease: "unknown" as const,
  };
  const snapshot = { ...decoded.snapshot, operations: [host, operation] };
  const identitySha256 = createHash("sha256")
    .update(identityJson)
    .digest("hex");
  const recoveryId = operation.recoveryId;
  const historyState = {
    ...snapshot,
    operations: [
      host,
      {
        ...operation,
        outcome: {
          status: "completed",
          reason: "provider_operation_completed",
          cleanupConfirmed: false,
        },
      },
    ],
  };
  const historyBytes = Buffer.from(`${encodeStateValue(historyState)}\n`);
  return {
    nonce,
    identity,
    identitySha256,
    recoveryId,
    snapshot,
    historyState,
    historyBytes,
  };
}

/**
 * 正規要約の全文とHash、未終端・別対象・一次失敗を検査する。
 * @responsibility 移管前の直接Oracleを保存Ownerから分離して維持する。
 * @trace PRL-UT-006
 * @precondition 実行していない合成Operationを使用する。
 * @stimulus 正常とbinding・ID・phase・summary Hashの不正を与える。
 * @observation 正規bytes、二つのHashと拒否値。
 * @oracle 一次失敗・unknownはそのまま残し、誤相関はnull。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 純粋終了要約。
 */
test("終了要約はexact本文・元Hash・一次失敗を保持し誤相関を拒否する", () => {
  const {
    nonce,
    identity,
    identitySha256,
    recoveryId,
    snapshot,
    historyState,
    historyBytes,
  } = summaryFixture();
  const history = prepareStateHistorySummary(historyBytes, recoveryId, binding);
  assert.ok(history);
  const goldenTaskSummary = `{"execution":{"externalSend":"unknown","ownerEffect":"unknown","providerStart":"unknown","sharedWrite":"unknown","workspaceReusable":false},"identitySha256":"${identitySha256}","lease":"unknown","operationId":"OP-123456","operationNonce":"${nonce}","outcome":{"cleanupConfirmed":false,"reason":"provider_operation_completed","status":"completed"},"primaryFailure":null,"recoveryCorrelationId":"task-operation-a","recoveryId":"${recoveryId}","schema":"crdd-execution-model/operation-summary/v6"}\n`;
  assert.equal(history.summaryBytes.toString("utf8"), goldenTaskSummary);
  assert.equal(
    history.summarySha256,
    createHash("sha256").update(goldenTaskSummary).digest("hex"),
  );
  const summary = JSON.parse(history.summaryBytes.toString("utf8"));
  assert.equal(summary.operationId, identity.operationId);
  assert.equal(Object.hasOwn(summary, "hostCleanup"), false);
  assert.equal(summary.lease, "unknown");
  assert.equal(summary.outcome.cleanupConfirmed, false);
  assert.equal(summary.primaryFailure, null);
  assert.equal("hostPaths" in summary, false);
  assert.equal("identityJson" in summary, false);
  assert.equal(
    history.sourcePayloadSha256,
    hashExecutionStateContent(historyState),
  );
  assert.equal(
    history.summarySha256,
    createHash("sha256").update(history.summaryBytes).digest("hex"),
  );
  assert.equal(
    prepareStateHistorySummary(historyBytes, recoveryId, "wrong"),
    null,
  );
  assert.equal(
    prepareStateHistorySummary(historyBytes, `${recoveryId}x`, binding),
    null,
  );
  assert.equal(
    prepareStateHistorySummary(
      Buffer.from(`${encodeStateValue(snapshot)}\n`),
      recoveryId,
      binding,
    ),
    null,
  );
  for (const changed of [
    {
      ...historyState.operations.find((item) => item.kind === "docker_task"),
      phase: "executing",
    },
    {
      ...historyState.operations.find((item) => item.kind === "docker_task"),
      summarySha256: "e".repeat(64),
    },
  ])
    assert.equal(
      prepareStateHistorySummary(
        Buffer.from(
          `${encodeStateValue({ ...historyState, operations: historyState.operations.map((item) => (item.kind === "docker_task" ? changed : item)) })}\n`,
        ),
        recoveryId,
        binding,
      ),
      null,
    );
  const fixedSummary = prepareStateHistorySummary(
    Buffer.from(
      `${encodeStateValue({ ...historyState, operations: historyState.operations.map((item) => (item.kind === "docker_task" ? { ...item, summarySha256: history.summarySha256 } : item)) })}\n`,
    ),
    recoveryId,
    binding,
  );
  assert.equal(fixedSummary, null);

  const primaryFailure = {
    purpose: "create_provider",
    stage: "command_wait",
    reason: "provider_result_invalid",
    exceptionCode: null,
    commandHandleObtained: true,
    responseObserved: true,
    receiptRecorded: false,
  };
  const failedSummary = prepareStateHistorySummary(
    Buffer.from(
      `${encodeStateValue({
        ...historyState,
        operations: historyState.operations.map((item) =>
          item.kind === "docker_task" ? { ...item, primaryFailure } : item,
        ),
      })}\n`,
    ),
    recoveryId,
    binding,
  );
  assert.ok(failedSummary);
  assert.deepEqual(
    JSON.parse(failedSummary.summaryBytes.toString("utf8")).primaryFailure,
    primaryFailure,
  );
  assert.notEqual(failedSummary.summarySha256, history.summarySha256);

  for (const consumer of ["coordinator_cli", "workbench"] as const) {
    const fixture = summaryFixture(consumer);
    const summary = prepareStateHistorySummary(
      fixture.historyBytes,
      fixture.recoveryId,
      binding,
    );
    assert.ok(summary);
    const value = JSON.parse(summary.summaryBytes.toString("utf8"));
    assert.equal(Object.hasOwn(value, "consumer"), false);
    assert.equal(value.schema, "crdd-execution-model/operation-summary/v6");
    assert.equal(
      value.recoveryCorrelationId,
      fixture.identity.recoveryCorrelationId,
    );
    assert.equal(value.execution.externalSend, "unknown");
  }
});

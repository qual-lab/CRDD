import assert from "node:assert/strict";
import test from "node:test";

import {
  describeCommandReportContract,
  renderSafeHumanCommandReport,
} from "../src/core/command-report.ts";

const digestA = "a".repeat(64);
const digestB = "b".repeat(64);

test("人間向けTask結果はCandidate、期限、全Recovery IDと手動回復要否を保持する", () => {
  const rendered = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason: "candidate_store_root_changed_recovery_required",
    filesystemEffectIssued: true,
    candidateId: `candidate.${digestA}.${digestB}`,
    expiresAtMs: 2_000_000_000_000,
    manualRecoveryRequired: true,
    processRestartRequired: true,
    hostRecoveryId: `host.root.${digestA}.${digestB}`,
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([
      `docker-task.${digestA}.${digestB}.${digestA}`,
      `docker-task.${digestB}.${digestA}.${digestB}`,
    ]),
    candidateRecoveryId: `candidate-recovery.${digestA}.${digestB}`,
    candidateStoreRecoveryId: `candidate-store-recovery.${digestA}`,
  });
  assert.match(
    rendered,
    new RegExp(`candidate ID: candidate\\.${digestA}\\.${digestB}`, "u"),
  );
  assert.match(rendered, /candidate export expires at:/u);
  assert.match(rendered, /host recovery ID: host\./u);
  assert.match(rendered, /restart Coordinator Runtime/u);
  assert.match(rendered, /recovery is not promised/u);
  assert.match(rendered, /Docker recovery ID: docker-task\./u);
  assert.equal(
    rendered.match(/coordinator doctor --recover-isolation docker-task\./gu)
      ?.length,
    2,
  );
  assert.match(rendered, /Candidate recovery ID: candidate-recovery\./u);
  assert.match(
    rendered,
    /Candidate Store recovery ID: candidate-store-recovery\./u,
  );
  assert.match(rendered, /manual recovery required: yes/u);
});

test("人間向け投影は未知値、Path、Credentialらしい値と不正IDを出力しない", () => {
  const rendered = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason: "safe_reason",
    candidateId: "C:\\secret\\candidate.json",
    hostRecoveryId: "sk-secret-value",
    candidateStoreRecoveryId: "candidate-store-recovery.invalid",
    ...({
      rawProviderOutput: "untrusted-provider-text",
      credential: "credential-value",
    } as object),
  });
  assert.doesNotMatch(
    rendered,
    /C:\\secret|sk-secret|untrusted-provider|credential-value/u,
  );
  assert.equal(
    describeCommandReportContract().rawProviderOutputReported,
    false,
  );
});

test("cleanup確認済みprotocol失敗の人間表示はHost Recoveryを要求しない", () => {
  const rendered = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason:
      "coordinator_task_host_generation_protocol_failed_cleanup_confirmed",
    manualRecoveryRequired: false,
    hostRecoveryId: null,
  });
  assert.match(rendered, /manual recovery required: no/u);
  assert.doesNotMatch(rendered, /host recovery ID|restart Coordinator/u);
});

test("cleanup不明でactionable IDがない場合も再起動とoperator移送を表示する", () => {
  const rendered = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason: "coordinator_task_operation_cleanup_unconfirmed",
    manualRecoveryRequired: true,
    processRestartRequired: true,
  });
  assert.match(rendered, /restart Coordinator Runtime/u);
  assert.match(rendered, /runtime operator/u);
  assert.match(rendered, /manual recovery required: yes/u);
});

test("Process再起動案内はRecovery IDと直交しruntime-owned booleanだけに従う", () => {
  const dockerRecoveryId = `docker-task.${digestA}.${digestB}.${digestA}`;
  const poisoned = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason: "cleanup_unknown",
    manualRecoveryRequired: true,
    processRestartRequired: true,
    dockerRecoveryId,
  });
  assert.match(poisoned, /recover-isolation/u);
  assert.equal(poisoned.match(/restart Coordinator Runtime/gu)?.length, 1);
  const recoverable = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason: "recovery_required",
    manualRecoveryRequired: true,
    processRestartRequired: false,
    hostRecoveryId: `host.root.${digestA}.${digestB}`,
  });
  assert.match(recoverable, /host recovery ID/u);
  assert.doesNotMatch(recoverable, /restart Coordinator Runtime/u);
});

test("cleanup確認済みの再起動だけの表示はoperator移送やRecoveryを要求しない", () => {
  const rendered = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason: "coordinator_task_cancellation_protocol_failed_cleanup_confirmed",
    manualRecoveryRequired: false,
    processRestartRequired: true,
    hostRecoveryId: null,
    dockerRecoveryIds: [],
    candidateRecoveryId: null,
    candidateStoreRecoveryId: null,
  });
  assert.match(rendered, /restart Coordinator Runtime/u);
  assert.match(rendered, /manual recovery required: no/u);
  assert.doesNotMatch(rendered, /runtime operator|recovery ID/u);

  const completed = renderSafeHumanCommandReport({
    command: "task",
    status: "completed",
    reason: "coordinator_task_completed",
    candidateId: `candidate.${digestA}.${digestB}`,
    manualRecoveryRequired: false,
    processRestartRequired: true,
    hostRecoveryId: null,
    dockerRecoveryIds: [],
    candidateRecoveryId: null,
    candidateStoreRecoveryId: null,
  });
  assert.match(completed, /candidate/u);
  assert.match(completed, /restart Coordinator Runtime/u);
  assert.match(completed, /manual recovery required: no/u);
  assert.doesNotMatch(completed, /runtime operator|recovery ID/u);
});

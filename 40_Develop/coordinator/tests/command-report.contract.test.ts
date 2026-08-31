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
    new RegExp(`候補ID: candidate\\.${digestA}\\.${digestB}`, "u"),
  );
  assert.match(rendered, /候補の書き出し期限:/u);
  assert.match(rendered, /Host回復ID: host\./u);
  assert.match(rendered, /Coordinator Runtimeを再起動/u);
  assert.match(rendered, /回復義務は再起動だけでは解消しません/u);
  assert.match(rendered, /Docker回復ID: docker-task\./u);
  assert.equal(rendered.match(/Docker回復ID: docker-task\./gu)?.length, 2);
  assert.match(rendered, /候補回復ID: candidate-recovery\./u);
  assert.match(rendered, /候補保存領域の回復ID: candidate-store-recovery\./u);
  assert.match(rendered, /手動回復の必要性: あり/u);
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
  assert.match(rendered, /手動回復の必要性: なし/u);
  assert.doesNotMatch(rendered, /Host回復ID|Coordinator Runtimeを再起動/u);
});

test("cleanup不明でactionable IDがない場合も再起動とoperator移送を表示する", () => {
  const rendered = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason: "coordinator_task_operation_cleanup_unconfirmed",
    manualRecoveryRequired: true,
    processRestartRequired: true,
  });
  assert.match(rendered, /Coordinator Runtimeを再起動/u);
  assert.match(rendered, /実行担当者へ引き渡して/u);
  assert.match(rendered, /手動回復の必要性: あり/u);
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
  assert.match(poisoned, /Docker回復ID/u);
  assert.equal(poisoned.match(/Coordinator Runtimeを再起動/gu)?.length, 1);
  const recoverable = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason: "recovery_required",
    manualRecoveryRequired: true,
    processRestartRequired: false,
    hostRecoveryId: `host.root.${digestA}.${digestB}`,
  });
  assert.match(recoverable, /Host回復ID/u);
  assert.doesNotMatch(recoverable, /Coordinator Runtimeを再起動/u);
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
  assert.match(rendered, /Coordinator Runtimeを再起動/u);
  assert.match(rendered, /手動回復の必要性: なし/u);
  assert.doesNotMatch(rendered, /実行担当者へ引き渡して|回復ID/u);

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
  assert.match(completed, /候補ID/u);
  assert.match(completed, /Coordinator Runtimeを再起動/u);
  assert.match(completed, /手動回復の必要性: なし/u);
  assert.doesNotMatch(completed, /実行担当者へ引き渡して|回復ID/u);
});

test("未取得と否定観測は区別し、未知の文字列を表示しない", () => {
  const rendered = renderSafeHumanCommandReport({
    command: "C:\\private",
    status: "\u001b[31munknown",
    reason: "sk-test-secret",
  });
  assert.match(rendered, /操作不明 — 判定不能/u);
  assert.match(rendered, /ファイル操作の発行: 未確認/u);
  assert.match(rendered, /手動回復の必要性: 未確認/u);
  assert.match(rendered, /Process再起動の必要性: 未確認/u);
  assert.doesNotMatch(rendered, /private|sk-test|\u001b/u);
});

test("候補操作の案内は完了・回収済み・再起動不要のTaskだけに限定する", () => {
  const base = {
    command: "task",
    status: "completed",
    reason: "coordinator_task_completed",
    candidateId: `candidate.${digestA}.${digestB}`,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    processRestartRequired: false,
  };
  assert.match(
    renderSafeHumanCommandReport(base),
    /coordinator candidate export/u,
  );
  for (const variant of [
    { status: "blocked" },
    { cleanupConfirmed: false },
    { manualRecoveryRequired: true },
    { processRestartRequired: true },
    { effectStateUnknown: true },
    { recoveryIdentityAmbiguous: true },
    { hostRecoveryId: `host.root.${digestA}` },
  ]) {
    const rendered = renderSafeHumanCommandReport({ ...base, ...variant });
    assert.match(rendered, /候補ID:/u);
    assert.doesNotMatch(rendered, /coordinator candidate (?:export|discard)/u);
  }
  for (const field of [
    "cleanupConfirmed",
    "manualRecoveryRequired",
    "processRestartRequired",
  ] as const) {
    const missing = { ...base } as Omit<typeof base, typeof field> &
      Partial<Pick<typeof base, typeof field>>;
    delete missing[field];
    assert.doesNotMatch(
      renderSafeHumanCommandReport(missing),
      /coordinator candidate (?:export|discard)/u,
    );
  }
});

test("候補操作の成功を未取得理由から失敗表示にしない", () => {
  for (const [command, status] of [
    ["candidate export", "exported"],
    ["candidate discard", "discarded"],
    ["candidate recover-store", "recovered"],
  ] as const) {
    const rendered = renderSafeHumanCommandReport({
      command,
      status,
      reason: "",
    });
    assert.match(rendered, /対象の操作が完了しました/u);
    assert.doesNotMatch(rendered, /詳しい原因|取得できない/u);
  }
});

test("全形式の回復IDを重複なく保持し、再起動案内を候補操作より先に置く", () => {
  const oldDockerId = `docker.crdd-coordinator-doctor-test.${"a".repeat(36)}.${"b".repeat(36)}.${digestA}`;
  const rendered = renderSafeHumanCommandReport({
    command: "task",
    status: "blocked",
    reason: "unmapped",
    manualRecoveryRequired: true,
    processRestartRequired: true,
    dockerRecoveryId: oldDockerId,
    dockerRecoveryIds: [
      oldDockerId,
      `docker-task.${digestA}.${digestB}.${digestA}`,
    ],
    candidateId: `candidate.${digestA}.${digestB}`,
  });
  assert.equal(rendered.split(oldDockerId).length - 1, 1);
  assert.equal(rendered.match(/Docker回復ID:/gu)?.length, 2);
  assert.ok(
    rendered.indexOf("Coordinator Runtimeを再起動") <
      rendered.indexOf("候補ID:"),
  );
  assert.doesNotMatch(rendered, /coordinator candidate export/u);
});

test("Date範囲外の期限は例外や誤った期限ではなく未確認になる", () => {
  for (const expiresAtMs of [Number.MAX_SAFE_INTEGER, -1, NaN, Infinity]) {
    assert.match(
      renderSafeHumanCommandReport({
        command: "task",
        status: "blocked",
        reason: "unmapped",
        candidateId: `candidate.${digestA}.${digestB}`,
        expiresAtMs,
      }),
      /候補の書き出し期限: 未確認/u,
    );
  }
});

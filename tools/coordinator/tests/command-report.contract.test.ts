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
    hostRecoveryId: `host.root.${digestA}.${digestB}`,
    dockerRecoveryId: `docker-task.${digestA}.${digestB}.${digestA}`,
    candidateRecoveryId: `candidate-recovery.${digestA}.${digestB}`,
    candidateStoreRecoveryId: `candidate-store-recovery.${digestA}`,
  });
  assert.match(
    rendered,
    new RegExp(`candidate ID: candidate\\.${digestA}\\.${digestB}`, "u"),
  );
  assert.match(rendered, /candidate export expires at:/u);
  assert.match(rendered, /host recovery ID: host\./u);
  assert.match(rendered, /Docker recovery ID: docker-task\./u);
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

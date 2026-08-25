import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import path from "node:path";
import test from "node:test";

import {
  createSignedGeneralTaskVerificationRequest,
  describeSignedGeneralTaskVerificationContract,
  runSignedGeneralTaskVerification,
} from "../scripts/verify-signed-general-task.ts";

const targetPath = "tools/coordinator/runtime/general-task-verification.txt";
const expectedContent = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";
const candidateId = `candidate.${"1".repeat(64)}.${"2".repeat(64)}`;

function release(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    status: "candidate",
    qualLabManifestCryptographicMatch: true,
    runtimeOwnedReleaseTrustConfirmed: true,
    releaseIdentityRuntimeOwned: true,
    crddDistributionConfirmed: true,
    crddVersion: "v0.18.0",
    releaseSequence: 1,
    ...overrides,
  });
}

function taskResult(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    status: "completed",
    reason: "coordinator_task_candidate_approved",
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    executorProvider: "claude",
    reviewerProvider: "codex",
    candidateRevision: Object.freeze({
      changedPaths: Object.freeze([targetPath]),
    }),
    executorResult: Object.freeze({
      changedPaths: Object.freeze([targetPath]),
    }),
    reviewerResult: Object.freeze({ decision: "approved", findingCount: 0 }),
    canonicalRepositoryChanged: false,
    rawOutputReported: false,
    hostPathReported: false,
    untrustedProviderTextReported: false,
    hostRecoveryId: null,
    dockerRecoveryId: null,
    dockerRecoveryIds: Object.freeze([]),
    candidateRecoveryId: null,
    candidateStoreRecoveryId: null,
    candidateId,
    ...overrides,
  });
}

function candidate(content = expectedContent) {
  const bytes = Buffer.from(content, "utf8");
  return Object.freeze({
    status: "exported",
    candidateId,
    bundle: Object.freeze({
      schema: "crdd-coordinator-candidate-bundle/v1",
      changedPaths: Object.freeze([targetPath]),
      entries: Object.freeze([
        Object.freeze({
          relativePath: targetPath,
          operation: "upsert",
          byteLength: bytes.byteLength,
          sha256: createHash("sha256").update(bytes).digest("hex"),
          contentBase64: bytes.toString("base64"),
        }),
      ]),
    }),
  });
}

function dependencies(
  options: {
    release?: Readonly<Record<string, unknown>>;
    result?: Readonly<Record<string, unknown>>;
    candidate?: Readonly<Record<string, unknown>> | null;
    discard?: Readonly<Record<string, unknown>>;
  } = {},
) {
  const calls = {
    starts: 0,
    reads: 0,
    discards: 0,
    bound: 0,
    unbound: 0,
  };
  return Object.freeze({
    calls,
    value: Object.freeze({
      verifyPackage: () => options.release ?? release(),
      startTask: () => {
        calls.starts += 1;
        return Object.freeze({
          controlCapability: Object.freeze({}),
          completion: Promise.resolve(options.result ?? taskResult()),
        });
      },
      cancelTask: () => Object.freeze({ status: "requested" }),
      readCandidate: () => {
        calls.reads += 1;
        return options.candidate === undefined
          ? candidate()
          : options.candidate;
      },
      discardCandidate: () => {
        calls.discards += 1;
        return options.discard ?? Object.freeze({ status: "discarded" });
      },
      now: () => "2026-08-25T00:00:00.000Z",
      bindCancellation: () => {
        calls.bound += 1;
        return () => {
          calls.unbound += 1;
        };
      },
    }),
  });
}

test("固定公開Taskをprocess内で構成しShell搬送を契約から除外する", () => {
  const request = createSignedGeneralTaskVerificationRequest();
  assert.equal(request.frontProvider, "codex");
  assert.deepEqual(request.allowedPaths, [targetPath]);
  assert.equal(request.isLocalCandidateOnly, true);

  const contract = describeSignedGeneralTaskVerificationContract();
  assert.equal(contract.requestShellTransportAllowed, false);
  assert.equal(contract.powershellTextPipelineAllowed, false);
  assert.equal(contract.temporaryRequestFileAllowed, false);
  assert.equal(contract.longShellCommandReconstructionAllowed, false);
  assert.equal(contract.normalTaskStdinContractChanged, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.paidApiFallbackAllowed, false);
});

test("署名Release不成立時はTaskを開始しない", async () => {
  const fixture = dependencies({
    release: release({ runtimeOwnedReleaseTrustConfirmed: false }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "signed_general_task_release_verification_failed",
  );
  assert.equal(fixture.calls.starts, 0);
  assert.equal(fixture.calls.reads, 0);
  assert.equal(fixture.calls.discards, 0);
});

test("Claude実装、Codex独立Review、exact Candidate、discardを一つのPassへ結合する", async () => {
  const fixture = dependencies();
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "completed");
  assert.equal(result.reason, "signed_general_task_verification_completed");
  assert.equal(result.exactCandidateContentVerified, true);
  assert.equal(result.candidateDiscarded, true);
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.manualRecoveryRequired, false);
  assert.equal(result.canonicalRepositoryChanged, false);
  assert.deepEqual(result.changedPaths, [targetPath]);
  assert.equal(fixture.calls.starts, 1);
  assert.equal(fixture.calls.reads, 1);
  assert.equal(fixture.calls.discards, 1);
  assert.equal(fixture.calls.bound, 1);
  assert.equal(fixture.calls.unbound, 1);
});

test("Route、cleanup、RecoveryまたはCandidate byte差をFail Closedにする", async () => {
  const cases = [
    dependencies({ result: taskResult({ executorProvider: "codex" }) }),
    dependencies({
      result: taskResult({
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
        hostRecoveryId: "host.test",
      }),
    }),
    dependencies({ candidate: candidate("different\n") }),
  ];
  for (const fixture of cases) {
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.canonicalRepositoryChanged, false);
  }
  assert.equal(
    (
      await runSignedGeneralTaskVerification(
        path.resolve("."),
        dependencies({
          result: taskResult({
            executorProvider: "codex",
            canonicalRepositoryChanged: true,
          }),
        }).value,
      )
    ).canonicalRepositoryChanged,
    true,
  );
  assert.equal(cases[0]?.calls.reads, 0);
  assert.equal(cases[1]?.calls.reads, 0);
  assert.equal(cases[2]?.calls.discards, 1);
});

test("Candidate discard不成立は残存0とせず手動処置対象を返す", async () => {
  const fixture = dependencies({
    discard: Object.freeze({
      status: "blocked",
      reason: "candidate_bundle_discard_recovery_required",
      manualRecoveryRequired: true,
      candidateRecoveryId: `candidate-recovery.${"1".repeat(64)}.${"2".repeat(64)}`,
      candidateStoreRecoveryId: null,
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    path.resolve("."),
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "signed_general_task_candidate_discard_failed");
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(
    (result as Readonly<Record<string, unknown>>).candidateIdForManualDiscard,
    candidateId,
  );
});

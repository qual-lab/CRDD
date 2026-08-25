import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import path from "node:path";
import test from "node:test";

import {
  bindSignedGeneralTaskCancellation,
  createSignedGeneralTaskVerificationRequest,
  describeSignedGeneralTaskVerificationContract,
  runSignedGeneralTaskVerification,
} from "../scripts/verify-signed-general-task.ts";

const TARGET_PATH = "tools/coordinator/runtime/general-task-verification.txt";
const EXPECTED_CONTENT = "CRDD_COORDINATOR_GENERAL_TASK_OK\n";
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const candidateId = `candidate.${"1".repeat(64)}.${"2".repeat(64)}`;
const baseCommit = "a".repeat(40);
const baseTree = "b".repeat(40);
const baseManifestHash = "c".repeat(64);
const contentManifestHash = "d".repeat(64);
const allowedPathsHash = "e".repeat(64);
const patchHash = createHash("sha256")
  .update("crdd-candidate-revision-v1\0")
  .update(baseCommit)
  .update("\0")
  .update(baseTree)
  .update("\0")
  .update(baseManifestHash)
  .update("\0")
  .update(contentManifestHash)
  .update("\0")
  .update(allowedPathsHash)
  .update("\0")
  .update(TARGET_PATH)
  .digest("hex");

function release(overrides: Record<string, unknown> = {}) {
  return Object.freeze({
    status: "candidate",
    stableFilesystemIdentityObserved: true,
    runtimeOwnedPackageRoot: true,
    manifestHash: "f".repeat(64),
    packageContentRootSha256: "0".repeat(64),
    qualLabManifestCryptographicMatch: true,
    runtimeOwnedReleaseTrustConfirmed: true,
    releaseIdentityRuntimeOwned: true,
    crddDistributionConfirmed: true,
    crddVersion: "v0.18.0",
    releaseSequence: 1,
    crddCommit: baseCommit,
    crddTree: baseTree,
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
      baseCommit,
      baseTree,
      patchHash,
      contentManifestHash,
      allowedPathsHash,
      changedPaths: Object.freeze([TARGET_PATH]),
    }),
    executorResult: Object.freeze({
      changedPaths: Object.freeze([TARGET_PATH]),
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

function candidate(content = EXPECTED_CONTENT) {
  const bytes = Buffer.from(content, "utf8");
  return Object.freeze({
    status: "exported",
    candidateId,
    bundle: Object.freeze({
      schema: "crdd-coordinator-candidate-bundle/v1",
      baseCommit,
      baseTree,
      baseManifestHash,
      patchHash,
      contentManifestHash,
      allowedPathsHash,
      changedPaths: Object.freeze([TARGET_PATH]),
      entries: Object.freeze([
        Object.freeze({
          relativePath: TARGET_PATH,
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
    runtimeVersion?: string;
    interactiveConsole?: boolean;
    completionRejects?: boolean;
    readThrows?: boolean;
    discardThrows?: boolean;
    cancellationRequested?: boolean;
  } = {},
) {
  const calls = {
    verifies: 0,
    starts: 0,
    reads: 0,
    discards: 0,
    bound: 0,
    unbound: 0,
  };
  return Object.freeze({
    calls,
    value: Object.freeze({
      verifyPackage: () => {
        calls.verifies += 1;
        return options.release ?? release();
      },
      startTask: () => {
        calls.starts += 1;
        return Object.freeze({
          controlCapability: Object.freeze({}),
          completion: options.completionRejects
            ? Promise.reject(new Error("fixture_completion_rejected"))
            : Promise.resolve(options.result ?? taskResult()),
        });
      },
      cancelTask: () => Object.freeze({ status: "requested" }),
      readCandidate: () => {
        calls.reads += 1;
        if (options.readThrows) throw new Error("fixture_read_failed");
        return options.candidate === undefined
          ? candidate()
          : options.candidate;
      },
      discardCandidate: () => {
        calls.discards += 1;
        if (options.discardThrows) throw new Error("fixture_discard_failed");
        return options.discard ?? Object.freeze({ status: "discarded" });
      },
      now: () => "2026-08-25T00:00:00.000Z",
      runtimeVersion: () => options.runtimeVersion ?? "24.19.0",
      inspectInteractiveConsole: () => options.interactiveConsole ?? true,
      bindCancellation: () => {
        calls.bound += 1;
        return Object.freeze({
          unbind: () => {
            calls.unbound += 1;
          },
          requested: () => options.cancellationRequested ?? false,
        });
      },
    }),
  });
}

test("固定公開Taskをprocess内で構成しShell搬送を契約から除外する", () => {
  const request = createSignedGeneralTaskVerificationRequest();
  assert.deepEqual(request, {
    frontProvider: "codex",
    objective:
      "Create the one bounded verification file with the exact required content.",
    acceptanceCriteria: [
      `The only changed path is ${TARGET_PATH}.`,
      `The file contains exactly ${JSON.stringify(EXPECTED_CONTENT)} as UTF-8 bytes.`,
    ],
    allowedPaths: [TARGET_PATH],
    readPaths: ["tools/coordinator/README.md", TARGET_PATH],
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  });

  const contract = describeSignedGeneralTaskVerificationContract();
  assert.equal(contract.requestShellTransportAllowed, false);
  assert.equal(contract.powershellTextPipelineAllowed, false);
  assert.equal(contract.temporaryRequestFileAllowed, false);
  assert.equal(contract.longShellCommandReconstructionAllowed, false);
  assert.equal(contract.normalTaskStdinContractChanged, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.paidApiFallbackAllowed, false);
  assert.equal(contract.minimumNodeVersion, "24.12.0");
  assert.equal(contract.nodeSelection, "absolute_preverified_executable_only");
});

test("CLIは余分argvを単一JSONとexit 2でEffect前に拒否する", () => {
  const script = path.join(
    coordinatorRoot,
    "scripts/verify-signed-general-task.ts",
  );
  const result = spawnSync(process.execPath, [script, "unexpected"], {
    cwd: coordinatorRoot,
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  assert.equal(result.status, 2);
  assert.equal(result.stderr, "");
  const parsed = JSON.parse(result.stdout) as Readonly<Record<string, unknown>>;
  assert.equal(parsed.status, "blocked");
  assert.equal(
    parsed.reason,
    "signed_general_task_verification_arguments_invalid",
  );
  assert.equal(parsed.canonicalRepositoryChanged, false);
});

test("Node 24.12未満または対話Console不成立をRelease検証前に拒否する", async () => {
  for (const fixture of [
    dependencies({ runtimeVersion: "24.11.9" }),
    dependencies({ runtimeVersion: "22.18.0" }),
    dependencies({ interactiveConsole: false }),
  ]) {
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(fixture.calls.verifies, 0);
    assert.equal(fixture.calls.starts, 0);
  }
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
  assert.deepEqual(result.changedPaths, [TARGET_PATH]);
  assert.equal(result.crddCommit, baseCommit);
  assert.equal(result.crddTree, baseTree);
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
  assert.equal(cases[0]?.calls.reads, 1);
  assert.equal(cases[0]?.calls.discards, 1);
  assert.equal(cases[1]?.calls.reads, 1);
  assert.equal(cases[1]?.calls.discards, 1);
  assert.equal(cases[2]?.calls.discards, 1);
});

test("ReleaseとCandidate RevisionのIdentity欠落・差を拒否しCandidateをdiscardする", async () => {
  const exportedCandidate = candidate();
  const exportedBundle = exportedCandidate.bundle as Readonly<
    Record<string, unknown>
  >;
  const cases = [
    dependencies({ release: release({ crddCommit: undefined }) }),
    dependencies({
      result: taskResult({
        candidateRevision: Object.freeze({
          baseCommit: "9".repeat(40),
          baseTree,
          patchHash,
          contentManifestHash,
          allowedPathsHash,
          changedPaths: Object.freeze([TARGET_PATH]),
        }),
      }),
    }),
    dependencies({
      candidate: Object.freeze({
        ...exportedCandidate,
        bundle: Object.freeze({
          ...exportedBundle,
          patchHash: "8".repeat(64),
        }),
      }),
    }),
  ];
  for (const [index, fixture] of cases.entries()) {
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    if (index === 0) assert.equal(fixture.calls.starts, 0);
    else assert.equal(fixture.calls.discards, 1);
  }
});

test("completion reject、取消、Candidate Store例外をPassへ流さない", async () => {
  const rejected = dependencies({ completionRejects: true });
  const rejectedResult = await runSignedGeneralTaskVerification(
    path.resolve("."),
    rejected.value,
  );
  assert.equal(rejectedResult.status, "blocked");
  assert.equal(rejectedResult.manualRecoveryRequired, true);
  assert.equal(rejected.calls.unbound, 1);

  const cancelled = dependencies({ cancellationRequested: true });
  const cancelledResult = await runSignedGeneralTaskVerification(
    path.resolve("."),
    cancelled.value,
  );
  assert.equal(cancelledResult.status, "blocked");
  assert.equal(cancelledResult.reason, "signed_general_task_cancelled");
  assert.equal(cancelled.calls.discards, 1);
  assert.equal(cancelled.calls.unbound, 1);

  for (const fixture of [
    dependencies({ readThrows: true }),
    dependencies({ discardThrows: true }),
  ]) {
    const result = await runSignedGeneralTaskVerification(
      path.resolve("."),
      fixture.value,
    );
    assert.equal(result.status, "blocked");
    assert.equal(fixture.calls.unbound, 1);
  }
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

test("Taskとdiscardの複合Recoveryは全IDを保持し競合を明示する", async () => {
  const fixture = dependencies({
    result: taskResult({
      status: "blocked",
      reason: "coordinator_task_cleanup_unconfirmed",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      hostRecoveryId: "host-recovery-task",
      dockerRecoveryId: "docker-recovery-task-a",
      dockerRecoveryIds: Object.freeze([
        "docker-recovery-task-a",
        "docker-recovery-task-b",
      ]),
      candidateRecoveryId: "candidate-recovery-task",
    }),
    discard: Object.freeze({
      status: "blocked",
      reason: "candidate_bundle_discard_recovery_required",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
      hostRecoveryId: "host-recovery-discard",
      dockerRecoveryId: "docker-recovery-discard",
      candidateRecoveryId: "candidate-recovery-discard",
      candidateStoreRecoveryId: "candidate-store-recovery-discard",
    }),
  });
  const result = await runSignedGeneralTaskVerification(
    coordinatorRoot,
    fixture.value,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.manualRecoveryRequired, true);
  assert.equal(result.hostRecoveryId, null);
  assert.deepEqual(result.hostRecoveryIds, [
    "host-recovery-task",
    "host-recovery-discard",
  ]);
  assert.deepEqual(result.dockerRecoveryIds, [
    "docker-recovery-task-a",
    "docker-recovery-task-b",
    "docker-recovery-discard",
  ]);
  assert.equal(result.candidateRecoveryId, null);
  assert.deepEqual(result.candidateRecoveryIds, [
    "candidate-recovery-task",
    "candidate-recovery-discard",
  ]);
  assert.deepEqual(result.candidateStoreRecoveryIds, [
    "candidate-store-recovery-discard",
  ]);
  assert.equal(result.recoveryIdentityAmbiguous, true);
  assert.equal(fixture.calls.discards, 1);
});

test("SIGINT／SIGTERMは取消をexact onceにしunbind後は不発火にする", () => {
  const signals = new EventEmitter();
  const controlCapability = Object.freeze({});
  let cancellations = 0;
  const binding = bindSignedGeneralTaskCancellation(
    signals,
    controlCapability,
    (observed) => {
      assert.equal(observed, controlCapability);
      cancellations += 1;
    },
  );
  signals.emit("SIGINT");
  signals.emit("SIGINT");
  signals.emit("SIGTERM");
  assert.equal(binding.requested(), true);
  assert.equal(cancellations, 1);
  binding.unbind();
  binding.unbind();
  signals.emit("SIGTERM");
  assert.equal(cancellations, 1);
});

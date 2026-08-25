import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../src/security/candidate-store-kernel-lock.ts";
import {
  abandonRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecovery,
  beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver,
  completeRuntimeOwnedDockerRecovery,
  createIsolatedDockerRecoveryRuntimeCandidate,
  describeDockerRecoveryRuntimeContract,
  finalizeRuntimeOwnedDockerRecovery,
  prepareRuntimeOwnedDockerHostCleanup,
  recordRuntimeOwnedDockerAbsence,
  recordRuntimeOwnedDockerHostCleanupReceipt,
  recordRuntimeOwnedNormalMountCompletion,
  recoverExactDockerResourceWithRunner,
  recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver,
} from "../src/security/docker-recovery-runtime.ts";
import {
  abandonOwnedHostOperationGenerationLock,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  recoverOwnedOperationDirectories,
  verifyOwnedOperationManagementCapability,
} from "../src/security/execution-environment.ts";
import { loadHostRecoveryRecordByToken } from "../src/security/host-recovery-record.ts";

const FIRST_RECOVERY =
  "host.crdd-coordinator-doctor-abcdef.00000000-0000-0000-0000-000000000001.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECOND_RECOVERY =
  "host.crdd-coordinator-doctor-abcdef.00000000-0000-0000-0000-000000000001.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const STABLE_HOME = "1".repeat(64);
const OPERATION_NONCE = "2".repeat(64);
const BASE_HASH = "3".repeat(64);
const DOCKER_TASK_RECOVERY_ID = `docker-task.${STABLE_HOME}.${OPERATION_NONCE}.${BASE_HASH}`;

function verifiedRoot(rootPath: string) {
  return Object.freeze({
    rootPath,
    runtimeStateIdentityHash: "4".repeat(64),
    runtimeStateProtectionHash: "5".repeat(64),
    localUserBindingHash: "6".repeat(64),
    stableLogicalHomeBindingHash: "7".repeat(64),
  });
}

function productionPlan(operationId: string, stableHome: string) {
  return Object.freeze({
    provider: "claude" as const,
    operationId,
    grantRef: "PHMGRANT-123456",
    profileId: "PROFILE-123456",
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    stableLogicalHomeBindingHash: stableHome,
    authContainerName: "crdd-auth-0123456789abcdef",
    providerContainerName: "crdd-claude-0123456789abcdef",
    proxyContainerName: "crdd-proxy-0123456789abcdef",
    internalNetworkName: "crdd-internal-0123456789abcdef",
    egressNetworkName: "crdd-egress-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    providerImageDigest: `sha256:${"a".repeat(64)}`,
    proxyImageDigest: `sha256:${"b".repeat(64)}`,
    operationMode: "isolated_task" as const,
    workspaceMountMode: "read_write" as const,
  });
}

function providerHomeForPlan(plan: ReturnType<typeof productionPlan>) {
  return Object.freeze({
    providerHomeIdentityHash: plan.providerHomeIdentityHash,
    providerHomeProtectionHash: plan.providerHomeProtectionHash,
    localUserBindingHash: plan.localUserBindingHash,
    stableLogicalHomeBindingHash: plan.stableLogicalHomeBindingHash,
  });
}

function createKilledProductionCleanupRoot() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-recovery-test-"),
  );
  const cleanupName = `cleanup-docker-task-${STABLE_HOME}-${OPERATION_NONCE}-${BASE_HASH}`;
  const moduleUrl = pathToFileURL(
    path.resolve("src/security/docker-recovery-journal.ts"),
  ).href;
  const source = `
    import fs from "node:fs";
    import path from "node:path";
    const journal = await import(${JSON.stringify(moduleUrl)});
    const root = process.argv[1];
    const cleanupName = process.argv[2];
    const recoveryId = process.argv[3];
    const cleanup = path.join(root, cleanupName);
    fs.mkdirSync(cleanup);
    journal.writeCommittedDockerRecoveryJson(
      cleanup,
      "record.json",
      "record.json",
      { schema: "fixture/v1", value: true },
    );
    fs.mkdirSync(path.join(cleanup, "empty"));
    const originalRm = fs.rmSync;
    fs.rmSync = (...args) => {
      const result = originalRm(...args);
      process.kill(process.pid, "SIGKILL");
      return result;
    };
    journal.removeDockerRecoveryCleanupDirectory(root, cleanup, recoveryId, {
      runtimeStateIdentityHash: "4".repeat(64),
      runtimeStateProtectionHash: "5".repeat(64),
      localUserBindingHash: "6".repeat(64),
      runtimeStateBindingHash: "7".repeat(64),
    });
  `;
  const crashed = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "-e",
      source,
      root,
      cleanupName,
      DOCKER_TASK_RECOVERY_ID,
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
  assert.notEqual(crashed.status, 0);
  assert.ok(fs.readdirSync(root).length > 0);
  return root;
}

function createKilledFullProductionRecoveryRoot(
  hostPhase: "previous" | "expected" = "expected",
) {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-full-recovery-test-"),
  );
  const root = path.join(parent, "runtime-state");
  const handoff = path.join(parent, "handoff.json");
  fs.mkdirSync(root);
  const dockerRecoveryUrl = pathToFileURL(
    path.resolve("src/security/docker-recovery-runtime.ts"),
  ).href;
  const executionEnvironmentUrl = pathToFileURL(
    path.resolve("src/security/execution-environment.ts"),
  ).href;
  const hostRecoveryRecordUrl = pathToFileURL(
    path.resolve("src/security/host-recovery-record.ts"),
  ).href;
  const source = `
    import fs from "node:fs";
    const recovery = await import(${JSON.stringify(dockerRecoveryUrl)});
    const host = await import(${JSON.stringify(executionEnvironmentUrl)});
    const hostRecord = await import(${JSON.stringify(hostRecoveryRecordUrl)});
    const rootPath = process.argv[1];
    const handoff = process.argv[2];
    const hostPhase = process.argv[3];
    const owned = host.createOwnedOperationDirectories();
    const context = host.createOwnedOperationContextCapability(owned);
    const mounts = host.createOwnedMountCapability(owned);
    const management = host.createOwnedOperationManagementCapability(context, mounts);
    const operation = host.verifyOwnedOperationManagementCapability(management);
    const localUserBindingHash = "6".repeat(64);
    const stableLogicalHomeBindingHash = "c".repeat(64);
    const runtimeRoot = Object.freeze({
      rootPath,
      runtimeStateIdentityHash: "4".repeat(64),
      runtimeStateProtectionHash: "5".repeat(64),
      localUserBindingHash,
      stableLogicalHomeBindingHash: "7".repeat(64),
    });
    const providerHome = Object.freeze({
      providerHomeIdentityHash: "8".repeat(64),
      providerHomeProtectionHash: "9".repeat(64),
      localUserBindingHash,
      stableLogicalHomeBindingHash,
    });
    let begun;
    try {
      const plan = Object.freeze({
        provider: "claude",
        operationId: operation.operationId,
        grantRef: "PHMGRANT-123456",
        profileId: "PROFILE-123456",
        providerHomeIdentityHash: providerHome.providerHomeIdentityHash,
        providerHomeProtectionHash: providerHome.providerHomeProtectionHash,
        localUserBindingHash,
        stableLogicalHomeBindingHash,
        authContainerName: "crdd-auth-0123456789abcdef",
        providerContainerName: "crdd-claude-0123456789abcdef",
        proxyContainerName: "crdd-proxy-0123456789abcdef",
        internalNetworkName: "crdd-internal-0123456789abcdef",
        egressNetworkName: "crdd-egress-0123456789abcdef",
        ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
        providerImageDigest: "sha256:" + "a".repeat(64),
        proxyImageDigest: "sha256:" + "b".repeat(64),
        operationMode: "isolated_task",
        workspaceMountMode: "read_write",
      });
      if (hostPhase === "previous") {
        begun = recovery.beginRuntimeOwnedDockerRecoveryWithHostBeginObserver(
          plan,
          management,
          providerHome,
          runtimeRoot,
          (recoveryId) => {
            const currentHostRecoveryId =
              host.getOwnedHostRecoveryIdByManagementCapability(management);
            fs.writeFileSync(
              handoff,
              JSON.stringify({
                recoveryId,
                hostRoot: owned.root,
                hostMarker:
                  hostRecord.loadHostRecoveryRecordByToken(currentHostRecoveryId).marker,
              }),
              "utf8",
            );
            process.kill(process.pid, "SIGKILL");
          },
          () => runtimeRoot,
        );
      } else {
        begun = recovery.beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
          plan,
          management,
          providerHome,
          runtimeRoot,
          () => runtimeRoot,
        );
      }
    } catch (error) {
      fs.writeFileSync(
        handoff,
        JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        "utf8",
      );
      process.exit(70);
    }
    if (!begun || begun.status !== "ready") {
      fs.writeFileSync(
        handoff,
        JSON.stringify({ diagnostic: begun, operationId: operation.operationId }),
        "utf8",
      );
      process.exit(71);
    }
    fs.writeFileSync(
      handoff,
      JSON.stringify({
        recoveryId: begun.recoveryId,
        hostRoot: owned.root,
        hostMarker: hostRecord.loadHostRecoveryRecordByToken(
          host.getOwnedHostRecoveryIdByManagementCapability(management),
        ).marker,
      }),
      "utf8",
    );
    if (!host.abandonOwnedHostOperationGenerationLock(management)) process.exit(72);
    process.kill(process.pid, "SIGKILL");
  `;
  const crashed = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "-e", source, root, handoff, hostPhase],
    { windowsHide: true, encoding: "utf8", timeout: 15_000 },
  );
  assert.notEqual(crashed.status, 0, crashed.stderr);
  assert.equal(fs.existsSync(handoff), true, crashed.stderr);
  const handoffText = fs.readFileSync(handoff, "utf8");
  const childDiagnostic = `${handoffText}\n${crashed.stderr}`;
  assert.notEqual(crashed.status, 70, childDiagnostic);
  assert.notEqual(crashed.status, 71, childDiagnostic);
  const result = JSON.parse(handoffText) as {
    recoveryId: string;
    hostRoot: string;
    hostMarker: string;
  };
  fs.rmSync(handoff);
  return Object.freeze({ parent, root, ...result });
}

function dockerResult(stdout = "") {
  return Object.freeze({
    status: 0,
    signal: null,
    stdout,
    stderr: "",
    error: null,
  });
}

function exactContainerRunner(overrides: Record<string, unknown> = {}) {
  let exists = true;
  let removeCount = 0;
  const dockerId = "a".repeat(64);
  const inspected = Object.freeze({
    Id: dockerId,
    Name: "/provider",
    Config: Object.freeze({
      User: "65534:65534",
      Image: `sha256:${"b".repeat(64)}`,
      Labels: Object.freeze({ "crdd.coordinator.runtime": "0123456789abcdef" }),
    }),
    HostConfig: Object.freeze({
      ReadonlyRootfs: true,
      Privileged: false,
      CapDrop: Object.freeze(["ALL"]),
      CapAdd: Object.freeze([]),
      SecurityOpt: Object.freeze(["no-new-privileges:true"]),
      PidsLimit: 64,
    }),
    NetworkSettings: Object.freeze({
      Networks: Object.freeze({ internal: Object.freeze({}) }),
    }),
    Mounts: Object.freeze([
      Object.freeze({
        Type: "bind",
        Destination: "/provider-home",
        RW: true,
        Propagation: "rprivate",
      }),
      Object.freeze({
        Type: "bind",
        Destination: "/tmp",
        RW: true,
        Propagation: "rprivate",
      }),
      Object.freeze({
        Type: "bind",
        Destination: "/work",
        RW: true,
        Propagation: "rprivate",
      }),
    ]),
    ...overrides,
  });
  return Object.freeze({
    dockerId,
    removeCount: () => removeCount,
    run(argv: readonly string[]) {
      if (argv[1] === "inspect")
        return dockerResult(JSON.stringify([inspected]));
      if (argv[1] === "rm") {
        exists = false;
        removeCount += 1;
        return dockerResult();
      }
      if (argv.includes(`id=${dockerId}`))
        return dockerResult(exists ? `${dockerId}\n` : "");
      if (argv.some((value) => value.startsWith("name=")))
        return dockerResult();
      return Object.freeze({
        status: 1,
        signal: null,
        stdout: "",
        stderr: "unexpected",
        error: null,
      });
    },
  });
}

function createIsolatedFixture() {
  const managementCapability = Object.freeze({});
  const otherManagementCapability = Object.freeze({});
  let beginCount = 0;
  let completeCount = 0;
  const runtime = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: (capability) => {
      if (capability !== managementCapability)
        throw new Error("management_invalid");
      return Object.freeze({ operationId: "OP-123456" });
    },
    beginDurableRecovery: (capability, operationId) => {
      assert.equal(capability, managementCapability);
      assert.equal(operationId, "OP-123456");
      beginCount += 1;
      return FIRST_RECOVERY;
    },
    completeDurableRecovery: (capability, recoveryId) => {
      assert.equal(capability, managementCapability);
      assert.equal(recoveryId, FIRST_RECOVERY);
      completeCount += 1;
      return SECOND_RECOVERY;
    },
  });
  return {
    runtime,
    managementCapability,
    otherManagementCapability,
    counts: () => ({ beginCount, completeCount }),
  };
}

test("Docker RecoveryはOperation bindingを確認してからdurable stateを開始する", () => {
  const fixture = createIsolatedFixture();
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "OP-999999" }),
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(fixture.counts().beginCount, 0);
  const begun = fixture.runtime.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.equal(begun.recoveryId, FIRST_RECOVERY);
  assert.deepEqual(fixture.counts(), { beginCount: 1, completeCount: 0 });
});

test("Docker Recovery capabilityは同一管理権限で一度だけ完了できる", () => {
  const fixture = createIsolatedFixture();
  const begun = fixture.runtime.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.otherManagementCapability,
    ),
    { status: "blocked" },
  );
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "completed" },
  );
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );
  assert.deepEqual(fixture.counts(), { beginCount: 1, completeCount: 1 });
});

test("Docker Recoveryは不正入力と依存例外をfail closedする", () => {
  const fixture = createIsolatedFixture();
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "invalid" }),
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "OP-123456" }),
      fixture.otherManagementCapability,
    ),
    null,
  );
  assert.deepEqual(fixture.runtime.complete(Object.freeze({}), null), {
    status: "blocked",
  });
  assert.deepEqual(fixture.runtime.complete(null, null), {
    status: "blocked",
  });

  let verificationCount = 0;
  const operationChanges = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => {
      verificationCount += 1;
      return Object.freeze({
        operationId: verificationCount === 1 ? "OP-123456" : "OP-654321",
      });
    },
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => SECOND_RECOVERY,
  });
  const begun = operationChanges.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.deepEqual(
    operationChanges.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  const unchanged = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => FIRST_RECOVERY,
  });
  const unchangedBegun = unchanged.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(unchangedBegun);
  assert.deepEqual(
    unchanged.complete(
      unchangedBegun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  const dependencyFailure = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => {
      throw new Error("begin_failed");
    },
    completeDurableRecovery: () => {
      throw new Error("complete_failed");
    },
  });
  assert.equal(
    dependencyFailure.begin(
      Object.freeze({ operationId: "OP-123456" }),
      fixture.managementCapability,
    ),
    null,
  );

  const completeFailure = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => {
      throw new Error("complete_failed");
    },
  });
  const completeFailureBegun = completeFailure.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(completeFailureBegun);
  assert.deepEqual(
    completeFailure.complete(
      completeFailureBegun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  assert.equal(
    beginRuntimeOwnedDockerRecovery(
      Object.freeze({ operationId: "OP-123456" }) as never,
      Object.freeze({}),
    ),
    null,
  );
  assert.deepEqual(
    completeRuntimeOwnedDockerRecovery(Object.freeze({}), Object.freeze({})),
    { status: "blocked" },
  );
});

test("Production Docker Recoveryは不完全なTask planをEffect前に拒否する", () => {
  assert.equal(
    beginRuntimeOwnedDockerRecovery(
      Object.freeze({ operationId: "OP-123456" }) as never,
      Object.freeze({}),
    ),
    null,
  );
});

test("production共有回復engineはcleanup途中のprocess killから残存0へ収束する", () => {
  const root = createKilledProductionCleanupRoot();
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        DOCKER_TASK_RECOVERY_ID,
        verifiedRoot(root),
        () => verifiedRoot(root),
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_cleanup_tombstone_completed",
        recoveryId: null,
      },
    );
    assert.deepEqual(fs.readdirSync(root), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("production共有回復engineはHost expected世代のprocess killを残存0へ収束する", () => {
  const fixture = createKilledFullProductionRecoveryRoot();
  const root = verifiedRoot(fixture.root);
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_completed",
        recoveryId: null,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root), []);
    assert.equal(fs.existsSync(fixture.hostRoot), false);
    assert.equal(fs.existsSync(fixture.hostMarker), false);
  } finally {
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("production共有回復engineはHost previous世代のprocess killをEffect前として残存0へ収束する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      ),
      {
        status: "recovered",
        reason: "docker_task_recovery_completed_before_submission",
        recoveryId: null,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root), []);
    assert.equal(fs.existsSync(fixture.hostRoot), false);
    assert.equal(fs.existsSync(fixture.hostMarker), false);
  } finally {
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("production正常完了経路はHost cleanup receipt後だけfinalizeして残存0へ収束する", () => {
  const runtimeParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-normal-recovery-test-"),
  );
  const runtimeRootPath = path.join(runtimeParent, "runtime-state");
  fs.mkdirSync(runtimeRootPath);
  const root = verifiedRoot(runtimeRootPath);
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  const plan = productionPlan(operation.operationId, "d".repeat(64));
  const initialHost = loadHostRecoveryRecordByToken(owned.hostRecoveryId);
  let recoveryCapability: object | null = null;
  try {
    const begun = beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
      plan,
      management,
      providerHomeForPlan(plan),
      root,
      () => root,
    );
    assert.ok(begun && begun.status === "ready");
    recoveryCapability = begun.recoveryCapability;
    assert.equal(recordRuntimeOwnedDockerAbsence(recoveryCapability), true);
    assert.equal(
      recordRuntimeOwnedNormalMountCompletion(recoveryCapability),
      true,
    );
    const completed = completeRuntimeOwnedDockerRecovery(
      recoveryCapability,
      management,
    );
    assert.equal(completed.status, "completed");
    assert.equal(
      finalizeRuntimeOwnedDockerRecovery(recoveryCapability).status,
      "blocked",
    );
    const hostCleanupToken =
      prepareRuntimeOwnedDockerHostCleanup(recoveryCapability);
    assert.equal(typeof hostCleanupToken, "string");
    assert.equal(abandonOwnedHostOperationGenerationLock(management), true);
    assert.deepEqual(recoverOwnedOperationDirectories(hostCleanupToken), {
      status: "recovered",
      reason: "host_cleanup_recovered",
    });
    assert.equal(
      recordRuntimeOwnedDockerHostCleanupReceipt(recoveryCapability),
      true,
    );
    assert.deepEqual(finalizeRuntimeOwnedDockerRecovery(recoveryCapability), {
      status: "completed",
    });
    recoveryCapability = null;
    assert.deepEqual(fs.readdirSync(runtimeRootPath), []);
    assert.equal(fs.existsSync(owned.root), false);
    assert.equal(fs.existsSync(initialHost.marker), false);
  } finally {
    if (recoveryCapability)
      void abandonRuntimeOwnedDockerRecovery(recoveryCapability);
    void abandonOwnedHostOperationGenerationLock(management);
    fs.rmSync(owned.root, { recursive: true, force: true });
    fs.rmSync(initialHost.marker, { force: true });
    fs.rmSync(runtimeParent, { recursive: true, force: true });
  }
});

test("production共有回復engineはHost third世代を上書きせずfail closedする", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  const beforeEntries = fs.readdirSync(fixture.root).sort();
  try {
    const hostRecord = JSON.parse(
      fs.readFileSync(fixture.hostMarker, "utf8"),
    ) as Record<string, unknown>;
    fs.writeFileSync(
      fixture.hostMarker,
      `${JSON.stringify({ ...hostRecord, state: "docker_absent_confirmed" })}\n`,
      "utf8",
    );
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => root,
      ),
      {
        status: "blocked",
        reason: "docker_task_recovery_host_transition_third_state",
        recoveryId: fixture.recoveryId,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root).sort(), beforeEntries);
    assert.equal(fs.existsSync(fixture.hostRoot), true);
    assert.equal(fs.existsSync(fixture.hostMarker), true);
  } finally {
    fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
    fs.rmSync(fixture.hostMarker, { force: true });
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("production共有回復engineはselected-user再bind不一致をEffect前に停止する", () => {
  const fixture = createKilledFullProductionRecoveryRoot("previous");
  const root = verifiedRoot(fixture.root);
  const changedUserRoot = Object.freeze({
    ...root,
    localUserBindingHash: "0".repeat(64),
  });
  const beforeEntries = fs.readdirSync(fixture.root).sort();
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        fixture.recoveryId,
        root,
        () => changedUserRoot,
      ),
      {
        status: "blocked",
        reason: "docker_task_runtime_state_audit_failed",
        recoveryId: fixture.recoveryId,
      },
    );
    assert.deepEqual(fs.readdirSync(fixture.root).sort(), beforeEntries);
    assert.equal(fs.existsSync(fixture.hostRoot), true);
    assert.equal(fs.existsSync(fixture.hostMarker), true);
  } finally {
    fs.rmSync(fixture.hostRoot, { recursive: true, force: true });
    fs.rmSync(fixture.hostMarker, { force: true });
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("cleanup-only回復も作成時selected-user再bind不一致を削除前に停止する", () => {
  const rootPath = createKilledProductionCleanupRoot();
  const root = verifiedRoot(rootPath);
  const changedUserRoot = Object.freeze({
    ...root,
    localUserBindingHash: "0".repeat(64),
  });
  const beforeEntries = fs.readdirSync(rootPath).sort();
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        DOCKER_TASK_RECOVERY_ID,
        root,
        () => changedUserRoot,
      ),
      {
        status: "blocked",
        reason: "docker_task_runtime_state_audit_failed",
        recoveryId: DOCKER_TASK_RECOVERY_ID,
      },
    );
    assert.deepEqual(fs.readdirSync(rootPath).sort(), beforeEntries);
  } finally {
    fs.rmSync(rootPath, { recursive: true, force: true });
  }
});

test("production beginはlock取得後のRuntimeState再bind不一致を初回記録前に停止する", () => {
  const runtimeParent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-production-begin-rebind-test-"),
  );
  const runtimeRootPath = path.join(runtimeParent, "runtime-state");
  fs.mkdirSync(runtimeRootPath);
  const root = verifiedRoot(runtimeRootPath);
  const changedRoot = Object.freeze({
    ...root,
    runtimeStateProtectionHash: "0".repeat(64),
  });
  const owned = createOwnedOperationDirectories();
  const context = createOwnedOperationContextCapability(owned);
  const mounts = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(context, mounts);
  const operation = verifyOwnedOperationManagementCapability(management);
  const plan = productionPlan(operation.operationId, "e".repeat(64));
  const initialHost = loadHostRecoveryRecordByToken(owned.hostRecoveryId);
  try {
    assert.deepEqual(
      beginRuntimeOwnedDockerRecoveryWithRuntimeStateObserver(
        plan,
        management,
        providerHomeForPlan(plan),
        root,
        () => changedRoot,
      ),
      {
        status: "blocked",
        recoveryId: null,
        manualRecoveryRequired: true,
        reason: "docker_recovery_initialization_failed_closed",
      },
    );
    assert.deepEqual(fs.readdirSync(runtimeRootPath), []);
    assert.equal(
      loadHostRecoveryRecordByToken(owned.hostRecoveryId).record.state,
      "host_only",
    );
  } finally {
    void abandonOwnedHostOperationGenerationLock(management);
    fs.rmSync(owned.root, { recursive: true, force: true });
    fs.rmSync(initialHost.marker, { force: true });
    fs.rmSync(runtimeParent, { recursive: true, force: true });
  }
});

test("production共有回復engineは同じHomeをexact-oneにし別Homeを妨げない", () => {
  const blockedRoot = createKilledProductionCleanupRoot();
  const sameHomeLock =
    acquireRuntimeOwnedLogicalProviderHomeKernelLock(STABLE_HOME);
  assert.ok(sameHomeLock);
  try {
    assert.deepEqual(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        DOCKER_TASK_RECOVERY_ID,
        verifiedRoot(blockedRoot),
        () => verifiedRoot(blockedRoot),
      ),
      {
        status: "blocked",
        reason: "docker_task_process_generation_active_or_unknown",
        recoveryId: DOCKER_TASK_RECOVERY_ID,
      },
    );
  } finally {
    assert.equal(sameHomeLock.release(), true);
    fs.rmSync(blockedRoot, { recursive: true, force: true });
  }

  const completedRoot = createKilledProductionCleanupRoot();
  const otherHomeLock = acquireRuntimeOwnedLogicalProviderHomeKernelLock(
    "8".repeat(64),
  );
  assert.ok(otherHomeLock);
  try {
    assert.equal(
      recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver(
        DOCKER_TASK_RECOVERY_ID,
        verifiedRoot(completedRoot),
        () => verifiedRoot(completedRoot),
      ).status,
      "recovered",
    );
    assert.deepEqual(fs.readdirSync(completedRoot), []);
  } finally {
    assert.equal(otherHomeLock.release(), true);
    fs.rmSync(completedRoot, { recursive: true, force: true });
  }
});

test("production共有Docker回復はexact IDと全構成一致だけを削除する", () => {
  const fixture = exactContainerRunner();
  assert.equal(
    recoverExactDockerResourceWithRunner(
      fixture.run,
      "container",
      fixture.dockerId,
      "provider",
      "crdd.coordinator.runtime=0123456789abcdef",
      `sha256:${"b".repeat(64)}`,
      null,
      "create_provider",
      Object.freeze(["internal"]),
      "isolated_task",
      "read_write",
    ),
    true,
  );
  assert.equal(fixture.removeCount(), 1);
});

test("production共有Docker回復はreplacement構成を削除せずEvidenceを保持する", () => {
  const fixture = exactContainerRunner({ Name: "/replacement" });
  assert.equal(
    recoverExactDockerResourceWithRunner(
      fixture.run,
      "container",
      fixture.dockerId,
      "provider",
      "crdd.coordinator.runtime=0123456789abcdef",
      `sha256:${"b".repeat(64)}`,
      null,
      "create_provider",
      Object.freeze(["internal"]),
      "isolated_task",
      "read_write",
    ),
    false,
  );
  assert.equal(fixture.removeCount(), 0);
});

test("Docker Recovery contractはEffect前記録とcleanup後完了を固定する", () => {
  assert.deepEqual(describeDockerRecoveryRuntimeContract(), {
    contract: "crdd-coordinator/docker-recovery-runtime",
    contractRevision: 6,
    durableStateBeforeDockerEffect: "docker_submission_started",
    durableStateAfterCleanup: "host_only",
    capability: "opaque_process_local_single_completion",
    crashRecovery: "durable_recovery_id_returned_for_manual_recovery",
    runtimeStateRoot:
      "selected_user_runtime_owned_fixed_known_folder_protected_root",
    runtimeStateRevalidation:
      "root_identity_protection_selected_user_and_full_inventory_before_each_mutation_and_after_effect",
    runtimeStateCreationBinding:
      "base_cleanup_manifest_and_root_cleanup_anchor_bind_creation_identity_protection_selected_user_and_runtime_state_hash",
    logicalHomeLease:
      "stable_sid_provider_namespace_kernel_lock_and_durable_active_pointer",
    resourceJournal:
      "file_fsync_base_commit_pointer_identity_host_active_binding_then_exact_docker_id_receipt",
    offlineRecovery:
      "exact_id_and_configuration_only_unknown_create_outcome_never_adopted",
    hostFinalization:
      "host_generation_owner_and_inventory_then_cleanup_intent_receipt_and_exact_removal",
    synchronizationRelease:
      "runtime_state_home_and_host_generation_release_confirmed_before_success",
    cleanupRequiredBeforeCompletion: true,
    callerRecoveryIdAccepted: false,
    providerEffectAllowed: false,
  });
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

import { renderDockerRecoveryDoctorReport } from "../src/core/docker-recovery-command-report.ts";
import { dispatchDockerDesktopRepairDoctorCommand } from "../src/core/docker-desktop-repair-doctor-dispatch.ts";
import { inspectDockerRecoveryRootSnapshotWithLock } from "../src/security/docker-recovery-runtime-internal.ts";

const recoveryId = `docker-task.${"1".repeat(64)}.${"2".repeat(64)}.${"3".repeat(64)}`;
const hostRecoveryId = `host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.${"a".repeat(64)}`;

function invokeCli(isJson: boolean) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      path.resolve("bin/coordinator.ts"),
      "doctor",
      "--recover-isolation",
      recoveryId,
      ...(isJson ? ["--json"] : []),
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
}

function addCleanupRecovery(root: string, discriminator: string) {
  const token = `docker-task.${discriminator.repeat(64)}.${discriminator.repeat(64)}.${discriminator.repeat(64)}`;
  const cleanup = path.join(
    root,
    `cleanup-docker-task-${discriminator.repeat(64)}-${discriminator.repeat(64)}-${discriminator.repeat(64)}`,
  );
  const journalUrl = pathToFileURL(
    path.resolve("src/security/docker-recovery-journal.ts"),
  ).href;
  const source = `
    import fs from "node:fs";
    const journal = await import(${JSON.stringify(journalUrl)});
    fs.mkdirSync(process.argv[2]);
    fs.writeFileSync(process.argv[2] + "/payload.json", "{}\\n", "utf8");
    const original = fs.rmSync;
    fs.rmSync = (...args) => { original(...args); process.kill(process.pid, "SIGKILL"); };
    journal.removeDockerRecoveryCleanupDirectory(process.argv[1], process.argv[2], process.argv[3], {
      runtimeStateIdentityHash: "4".repeat(64),
      runtimeStateProtectionHash: "5".repeat(64),
      localUserBindingHash: "6".repeat(64),
      runtimeStateBindingHash: "7".repeat(64),
    });
  `;
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "-e", source, root, cleanup, token],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
  assert.notEqual(result.status, 0);
  return token;
}

function inventory(rootPath: string) {
  return inspectDockerRecoveryRootSnapshotWithLock(
    Object.freeze({
      rootPath,
      runtimeStateIdentityHash: "4".repeat(64),
      runtimeStateProtectionHash: "5".repeat(64),
      localUserBindingHash: "6".repeat(64),
      stableLogicalHomeBindingHash: "7".repeat(64),
    }),
    () => Object.freeze({ release: () => true }),
  );
}

test("実CLIのdocker-task dispatchはJSONでexact IDと安全なblocked理由を返す", () => {
  const result = invokeCli(true);
  assert.equal(result.status, 2, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "blocked",
    reason: "docker_task_runtime_state_unavailable",
    recoveryId: recoveryId,
    manualRecoveryRequired: true,
    evidenceState: "unknown",
  });
  assert.equal(result.stderr, "");
});

test("実CLIのDocker Desktop最終砦はinvalid IDをusage 64、未成立境界をblocked 2へ投影する", () => {
  const executable = path.resolve("bin/coordinator.ts");
  const invalid = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      executable,
      "doctor",
      "--close-docker-desktop-runtime-repair",
      "invalid",
      "--json",
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(invalid.status, 64, invalid.stderr);
  assert.equal(JSON.parse(invalid.stdout).status, "blocked");

  const syntacticallyValid = `docker-desktop-repair.${"a".repeat(32)}`;
  const blocked = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      executable,
      "doctor",
      "--close-docker-desktop-runtime-repair",
      syntacticallyValid,
      "--json",
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(blocked.status, 2, blocked.stderr);
  const report = JSON.parse(blocked.stdout);
  assert.equal(report.status, "blocked");
  assert.equal(report.pathReported, false);
  assert.equal(report.credentialReported, false);

  const repair = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      executable,
      "doctor",
      "--repair-docker-desktop-runtime",
      "--json",
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(repair.status, 2, repair.stderr);
  assert.equal(JSON.parse(repair.stdout).status, "blocked");

  const human = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      executable,
      "doctor",
      "--close-docker-desktop-runtime-repair",
      syntacticallyValid,
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(human.status, 2, human.stderr);
  assert.doesNotMatch(human.stdout, /C:\\|credential|password|token/iu);
});

test("Docker Desktop専用dispatcherはrepair／closeの2・0・throwを同じrendererへ投影する", async () => {
  const repairId = `docker-desktop-repair.${"b".repeat(32)}`;
  const terminal = Object.freeze({
    contract: "crdd-coordinator/docker-desktop-runtime-repair",
    contractRevision: 4,
    status: "closed_retained",
    reason: "docker_desktop_repair_evidence_retention_closed",
    repairId,
    operationState: "closed_retained",
    manualRecoveryRequired: false,
    processEffectIssued: true,
    processEffectConfirmation: "confirmed",
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed",
    engineReady: true,
    staleRuntimeDirectory: "retained",
    evidenceState: "preserved",
    disposition: "retained_by_human_decision",
    nativeHelperCleanupConfirmed: true,
    effectStateUnknown: false,
    operatorActionRequired: false,
    newRepairPermitted: true,
    deletionPerformed: false,
    pathReported: false,
    credentialReported: false,
    providerEffectIssued: false,
  });
  for (const json of [true, false]) {
    const repair = await dispatchDockerDesktopRepairDoctorCommand(
      {
        json,
        repairDockerDesktopRuntime: true,
        closeDockerDesktopRepairId: null,
      },
      {
        repair: async () => ({
          ...terminal,
          status: "recovered_pending_close",
          newRepairPermitted: false,
        }),
        close: async () => terminal,
      },
    );
    assert.equal(repair?.exitCode, 2);
    const close = await dispatchDockerDesktopRepairDoctorCommand(
      {
        json,
        repairDockerDesktopRuntime: false,
        closeDockerDesktopRepairId: repairId,
      },
      { repair: async () => terminal, close: async () => terminal },
    );
    assert.equal(close?.exitCode, 0);
    assert.doesNotMatch(close?.stdout ?? "", /C:\\/u);
    const failed = await dispatchDockerDesktopRepairDoctorCommand(
      {
        json,
        repairDockerDesktopRuntime: true,
        closeDockerDesktopRepairId: null,
      },
      {
        repair: async () => {
          throw new Error("C:\\secret\\token");
        },
        close: async () => terminal,
      },
    );
    assert.equal(failed?.exitCode, 2);
    assert.doesNotMatch(failed?.stdout ?? "", /secret|token|C:\\/u);
    if (json) {
      const fallback = JSON.parse(failed?.stdout ?? "{}") as Record<
        string,
        unknown
      >;
      assert.equal(fallback.manualRecoveryRequired, true);
      assert.equal(fallback.effectStateUnknown, true);
      assert.equal(fallback.operatorActionRequired, true);
      assert.equal(fallback.newRepairPermitted, false);
      assert.equal(fallback.processEffectIssued, null);
      assert.equal(fallback.filesystemEffectIssued, null);
      assert.equal(fallback.disposition, "unknown");
    }
  }
});

test("実CLIの人間表示はmanual recoveryとEvidence不明を示し反復実行を誘導しない", () => {
  const result = invokeCli(false);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /Coordinator environment: blocked/u);
  assert.match(result.stdout, new RegExp(`recovery ID: ${recoveryId}`, "u"));
  assert.match(result.stdout, /automatic recovery stopped/u);
  assert.match(result.stdout, /evidence: preservation unknown/u);
  assert.doesNotMatch(result.stdout, /next: coordinator doctor/u);
  assert.doesNotMatch(result.stdout, /C:\\/u);
  assert.equal(result.stderr, "");
});

test("CLI共通projectorはEvidenceの保持・非保持・不明を推測せず分離する", () => {
  for (const [evidenceState, expected] of [
    ["preserved", /recovery evidence: preserved/u],
    ["not_preserved", /recovery evidence: not preserved/u],
    ["unknown", /recovery evidence: preservation unknown/u],
  ] as const) {
    const human = renderDockerRecoveryDoctorReport(
      {
        status: "blocked",
        reason: "docker_task_recovery_create_outcome_unknown",
        recoveryId: evidenceState === "not_preserved" ? null : recoveryId,
        manualRecoveryRequired: true,
        evidenceState,
      },
      false,
    );
    assert.match(human.stdout, expected);
    if (evidenceState === "not_preserved") {
      assert.match(human.stdout, /no reusable recovery ID is available/u);
      assert.match(
        human.stdout,
        /provide the reason and recovery evidence state/u,
      );
      assert.match(human.stdout, /must not be removed by name or label alone/u);
      assert.doesNotMatch(human.stdout, /next: coordinator doctor/u);
    }
  }
});

test("CLI共通projectorはHost release不明時もexact IDと再実行commandを保持する", () => {
  const report = Object.freeze({
    status: "blocked",
    reason: "host_recovery_generation_release_unconfirmed",
    recoveryId: hostRecoveryId,
  });
  const json = renderDockerRecoveryDoctorReport(report, true);
  assert.equal(json.exitCode, 2);
  assert.deepEqual(JSON.parse(json.stdout), report);
  const human = renderDockerRecoveryDoctorReport(report, false);
  assert.equal(human.exitCode, 2);
  assert.match(human.stdout, new RegExp(hostRecoveryId, "u"));
  assert.match(
    human.stdout,
    new RegExp(
      `next: coordinator doctor --recover-isolation ${hostRecoveryId}`,
      "u",
    ),
  );
  assert.doesNotMatch(human.stdout, /C:\\/u);
});

test("CLI共通projectorはvalid単一／複数inventoryをJSON／人間表示へexact投影する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cli-inventory-"));
  try {
    const first = addCleanupRecovery(root, "a");
    const single = inventory(root);
    assert.equal(single.status, "completed");
    const singleJson = renderDockerRecoveryDoctorReport(
      { status: "blocked", dockerTaskRecovery: single, blockers: [] },
      true,
    );
    assert.equal(singleJson.exitCode, 2);
    assert.deepEqual(JSON.parse(singleJson.stdout).dockerTaskRecovery, single);
    const second = addCleanupRecovery(root, "b");
    const multiple = inventory(root);
    assert.equal(
      multiple.reason,
      "docker_task_multiple_recovery_inventory_available",
    );
    assert.deepEqual(multiple.dockerRecoveryIds, [first, second]);
    const human = renderDockerRecoveryDoctorReport(
      { status: "blocked", dockerTaskRecovery: multiple, blockers: [] },
      false,
    );
    assert.match(human.stdout, /Docker Task recoveries: 2/u);
    assert.match(human.stdout, new RegExp(first, "u"));
    assert.match(human.stdout, new RegExp(second, "u"));
    assert.doesNotMatch(human.stdout, /C:\\/u);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI共通projectorはthird stateをblocked、回復成功をexit 0へ分離する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-cli-third-state-"));
  try {
    addCleanupRecovery(root, "c");
    fs.writeFileSync(path.join(root, "unknown"), "unknown", "utf8");
    const third = inventory(root);
    assert.equal(third.status, "blocked");
    const blocked = renderDockerRecoveryDoctorReport(third, false);
    assert.equal(blocked.exitCode, 2);
    assert.match(blocked.stdout, /docker_task_runtime_state_unknown_entry/u);
    const recovered = renderDockerRecoveryDoctorReport(
      {
        status: "recovered",
        reason: "docker_task_recovery_completed",
        recoveryId: null,
      },
      true,
    );
    assert.equal(recovered.exitCode, 0);
    assert.equal(JSON.parse(recovered.stdout).status, "recovered");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

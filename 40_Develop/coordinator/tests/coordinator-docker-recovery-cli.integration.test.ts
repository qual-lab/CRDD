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

test("実CLIの再起動Fence付きdocker-task dispatchは修復記録の生成元配布RootをRecoveryへ渡す", () => {
  const repairId = `docker-desktop-repair.${"4".repeat(32)}`;
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      path.resolve("bin/coordinator.ts"),
      "doctor",
      "--recover-isolation",
      recoveryId,
      "--after-docker-desktop-repair",
      repairId,
      "--repair-release-root",
      path.resolve("fixture-historical-release"),
      "--json",
    ],
    { windowsHide: true, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 2, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.status, "blocked");
  assert.match(report.reason, /^docker_task_recovery_restart_fence_/u);
  assert.equal(report.restartFenceVerified, false);
  assert.equal(report.recoveryId, recoveryId);
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
    contractRevision: 5,
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
  for (const isJson of [true, false]) {
    const adoption = await dispatchDockerDesktopRepairDoctorCommand(
      {
        json: isJson,
        repairDockerDesktopRuntime: false,
        closeDockerDesktopRepairId: null,
        adoptDockerDesktopRepairId: repairId,
        repairReleaseRoot: "C:\\old-release",
      },
      {
        repair: async () => assert.fail("adoption must not repair"),
        close: async () => assert.fail("adoption must not close"),
        adopt: async (id, root) => {
          assert.equal(id, repairId);
          assert.equal(root, "C:\\old-release");
          return {
            ...terminal,
            status: "historical_recovered_pending_close",
            newRepairPermitted: false,
            effectStateUnknown: true,
          };
        },
      },
    );
    assert.equal(adoption?.exitCode, 2);
    assert.doesNotMatch(adoption?.stdout ?? "", /C:\\/u);
    const repair = await dispatchDockerDesktopRepairDoctorCommand(
      {
        json: isJson,
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
        json: isJson,
        repairDockerDesktopRuntime: false,
        closeDockerDesktopRepairId: repairId,
      },
      { repair: async () => terminal, close: async () => terminal },
    );
    assert.equal(close?.exitCode, 0);
    assert.doesNotMatch(close?.stdout ?? "", /C:\\/u);
    const failed = await dispatchDockerDesktopRepairDoctorCommand(
      {
        json: isJson,
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
    const closeFailed = await dispatchDockerDesktopRepairDoctorCommand(
      {
        json: isJson,
        repairDockerDesktopRuntime: false,
        closeDockerDesktopRepairId: repairId,
      },
      {
        repair: async () => terminal,
        close: async () => {
          throw new Error("C:\\secret\\close-token");
        },
      },
    );
    assert.equal(closeFailed?.exitCode, 2);
    assert.doesNotMatch(closeFailed?.stdout ?? "", /secret|token|C:\\/u);
    if (isJson) {
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
      const closeFallback = JSON.parse(closeFailed?.stdout ?? "{}") as Record<
        string,
        unknown
      >;
      assert.equal(closeFallback.repairId, null);
    }
  }
});

test("実CLIの人間表示はmanual recoveryとEvidence不明を示し反復実行を誘導しない", () => {
  const result = invokeCli(false);
  assert.equal(result.status, 2, result.stderr);
  assert.match(result.stdout, /Coordinator環境診断: blocked/u);
  assert.match(result.stdout, new RegExp(`回復ID: ${recoveryId}`, "u"));
  assert.match(result.stdout, /自動回復は停止しました/u);
  assert.match(result.stdout, /回復根拠: 保持状況は未確認/u);
  assert.doesNotMatch(result.stdout, /次の操作: coordinator doctor/u);
  assert.doesNotMatch(result.stdout, /C:\\/u);
  assert.equal(result.stderr, "");
});

test("CLI共通projectorはEvidenceの保持・非保持・不明を推測せず分離する", () => {
  for (const [evidenceState, expected] of [
    ["preserved", /回復根拠: 保持済み/u],
    ["not_preserved", /回復根拠: 保持されていません/u],
    ["unknown", /回復根拠: 保持状況は未確認/u],
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
      assert.match(human.stdout, /再利用できる回復IDは取得できていません/u);
      assert.match(
        human.stdout,
        /理由と回復根拠の保持状況をRuntime運用担当者へ渡してください/u,
      );
      assert.match(
        human.stdout,
        /名前やラベルだけを根拠に資源を削除しないでください/u,
      );
      assert.doesNotMatch(human.stdout, /次の操作: coordinator doctor/u);
    }
  }
});

test("日本語の復旧表示は三値とJSON・終了コードを保持する", () => {
  for (const [observationConfirmed, expected] of [
    [true, "はい"],
    [false, "いいえ"],
    [null, "未確認"],
    [undefined, "未確認"],
  ] as const) {
    const report = Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "closed_retained",
      reason: "docker_desktop_repair_evidence_retention_closed",
      repairId: `docker-desktop-repair.${"a".repeat(32)}`,
      engineReady: observationConfirmed,
      processEffectIssued: observationConfirmed,
      filesystemEffectIssued: observationConfirmed,
      nativeHelperCleanupConfirmed: observationConfirmed,
      newRepairPermitted: observationConfirmed,
      staleRuntimeDirectory: "retained",
    });
    const human = renderDockerRecoveryDoctorReport(report, false);
    const json = renderDockerRecoveryDoctorReport(report, true);
    assert.equal(json.stdout, `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(human.exitCode, observationConfirmed === true ? 0 : 2);
    assert.equal(json.exitCode, human.exitCode);
    for (const label of [
      "Docker Engineの準備完了",
      "プロセス操作の発行",
      "ファイルシステム操作の発行",
      "ネイティブ補助プロセスの資源回収確認",
      "新しい復旧操作の許可",
    ])
      assert.ok(human.stdout.includes(`- ${label}: ${expected}\n`));
    assert.match(human.stdout, /プロセス操作の確認状態: unknown/u);
    assert.match(human.stdout, /ファイルシステム操作の確認状態: unknown/u);
    assert.match(human.stdout, /復旧根拠の保持状態: unknown/u);
    assert.match(human.stdout, /削除の実行: なし/u);
  }
});

test("日本語の手動復旧案内は復旧記録上限時の再試行・削除・改名禁止を保持する", () => {
  for (const reason of [
    "docker_desktop_repair_record_capacity_unavailable",
    "docker_desktop_repair_operation_capacity_unavailable",
  ]) {
    const report = Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      status: "blocked",
      reason,
      repairId: `docker-desktop-repair.${"b".repeat(32)}`,
      manualRecoveryRequired: true,
      operatorActionRequired: true,
      newRepairPermitted: false,
      nativeHelperCleanupConfirmed: null,
    });
    const human = renderDockerRecoveryDoctorReport(report, false);
    const json = renderDockerRecoveryDoctorReport(report, true);
    assert.equal(json.stdout, `${JSON.stringify(report, null, 2)}\n`);
    assert.equal(human.exitCode, 2);
    assert.equal(json.exitCode, human.exitCode);
    assert.ok(human.stdout.includes(`- 理由: ${reason}\n`));
    assert.match(
      human.stdout,
      /新しい復旧の試行を止め、Runtime運用担当者へ連絡/u,
    );
    assert.match(
      human.stdout,
      /保持した根拠や段階記録を手動で削除・改名しない/u,
    );
    assert.match(
      human.stdout,
      /復旧記録の上限: 再試行や復旧記録の削除・圧縮をしない/u,
    );
    assert.doesNotMatch(human.stdout, /--close-docker-desktop-runtime-repair/u);
  }
});

test("日本語の環境診断は未実行・状態変更なし・認証値非記録を明示する", () => {
  const report = Object.freeze({
    status: "blocked",
    providers: {
      codex: { located: true },
      claude: { located: false },
    },
    credentials: { valuesRecorded: false },
    filesystem: { enforcement: "fixture_filesystem_enforcement" },
    egress: { providerAllowlist: "fixture_provider_allowlist" },
    runtimeRootEvaluation: { status: "candidate" },
    blockers: [{ id: "fixture_check", reason: "fixture_reason" }],
  });
  const human = renderDockerRecoveryDoctorReport(report, false);
  const json = renderDockerRecoveryDoctorReport(report, true);
  assert.equal(json.stdout, `${JSON.stringify(report, null, 2)}\n`);
  assert.equal(human.exitCode, 2);
  assert.equal(json.exitCode, human.exitCode);
  assert.match(
    human.stdout,
    /codex: 実行ファイルを検出; 実行による確認は行っていません/u,
  );
  assert.match(
    human.stdout,
    /claude: 実行ファイルが見つかりません; 実行による確認は行っていません/u,
  );
  assert.match(human.stdout, /認証情報の値の記録: なし/u);
  assert.match(
    human.stdout,
    /ファイルシステム制約の強制状態: fixture_filesystem_enforcement/u,
  );
  assert.match(
    human.stdout,
    /Provider外部送信先の許可リスト: fixture_provider_allowlist/u,
  );
  assert.match(
    human.stdout,
    /Runtimeルートの評価: candidate; 状態変更は行っていません/u,
  );
  assert.match(human.stdout, /実行を妨げる事項: 1/u);
  assert.match(human.stdout, /fixture_check: fixture_reason/u);
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
      `次の操作: coordinator doctor --recover-isolation ${hostRecoveryId}`,
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
    assert.match(human.stdout, /Dockerタスクの回復対象数: 2/u);
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

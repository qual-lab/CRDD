import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  parseCandidateArguments,
  parseDoctorArguments,
  parseTaskArguments,
} from "../../src/core/cli-options.ts";
import { renderDockerRecoveryDoctorReport } from "../../src/core/docker-recovery-command-report.ts";
import { assertPresent } from "../support/test-support.ts";

const coordinatorExecutable = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../bin/coordinator.ts",
);
const publicCoordinatorLauncher = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../template/tools/crdd-coordinator.ts",
);

test("検証付き再起動と記録後回復はexact Taskを指定する別操作", () => {
  const id = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const restart = parseDoctorArguments(
    ["--restart-docker-for-recovery", id, "--json"],
    undefined,
  );
  assert.equal(restart.status, "ok");
  assert.equal(restart.value?.restartDockerForRecoveryId, id);
  const recover = parseDoctorArguments(
    ["--recover-isolation", id, "--after-recorded-docker-restart"],
    undefined,
  );
  assert.equal(recover.status, "ok");
  assert.equal(recover.value?.afterRecordedDockerRestart, true);
  for (const argumentsList of [
    ["--restart-docker-for-recovery"],
    ["--restart-docker-for-recovery", "invalid"],
    ["--restart-docker-for-recovery", id, "--isolation"],
    ["--restart-docker-for-recovery", id, "--recover-isolation", id],
    ["--restart-docker-for-recovery", id, "--repair-docker-desktop-runtime"],
    ["--restart-docker-for-recovery", id, "--after-recorded-docker-restart"],
    ["--after-recorded-docker-restart"],
    ["--recover-isolation", "host.invalid", "--after-recorded-docker-restart"],
    [
      "--recover-isolation",
      id,
      "--after-recorded-docker-restart",
      "--after-docker-desktop-repair",
      `docker-desktop-repair.${"a".repeat(32)}`,
      "--repair-release-root",
      "C:\\old",
    ],
  ])
    assert.equal(
      parseDoctorArguments(argumentsList, undefined).status,
      "blocked",
      JSON.stringify(argumentsList),
    );
});

test("再起動元配布候補は再起動専用引数であり修復元を代用しない", () => {
  const id = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const option = "--restart-origin-release-root";
  const root = "C:\\origin";
  for (const args of [
    ["--restart-docker-for-recovery", id, option, root],
    [option, root, "--restart-docker-for-recovery", id, "--json"],
  ]) {
    const result = parseDoctorArguments(args, undefined);
    assert.equal(result.status, "ok");
    assert.equal(result.value?.restartOriginReleaseRoot, root);
    assert.equal(result.value?.repairReleaseRoot, undefined);
  }
  for (const args of [
    [option],
    [option, root],
    ["--restart-docker-for-recovery", id, option],
    ["--restart-docker-for-recovery", id, option, "--json"],
    ["--restart-docker-for-recovery", id, option, root, option, root],
    [
      "--restart-docker-for-recovery",
      id,
      option,
      root,
      "--repair-release-root",
      root,
    ],
    ["--recover-isolation", id, option, root],
    ["--isolation", option, root],
    ["--repair-docker-desktop-runtime", option, root],
  ])
    assert.equal(
      parseDoctorArguments(args, undefined).status,
      "blocked",
      JSON.stringify(args),
    );
});

test("再起動結果はTask回復を成功へ混同せずcleanup不明を拒否する", () => {
  const base = {
    contract: "crdd-coordinator/docker-restart-for-recovery",
    status: "completed",
    reason: "docker_restart_settled",
    restartCompleted: true,
    taskRecoveryCompleted: false,
    cleanupConfirmed: true,
  };
  assert.equal(renderDockerRecoveryDoctorReport(base, true).exitCode, 0);
  assert.match(
    renderDockerRecoveryDoctorReport(base, false).stdout,
    /Taskの復旧・再実行は行っていません/u,
  );
  for (const patch of [
    { cleanupConfirmed: false },
    { restartCompleted: false },
    { taskRecoveryCompleted: true },
    { status: "blocked" },
  ]) {
    assert.equal(
      renderDockerRecoveryDoctorReport({ ...base, ...patch }, true).exitCode,
      2,
    );
  }
});

test("旧版修復記録の引継ぎはexact IDと修復記録の生成元配布Rootだけを受理する", () => {
  const id = `docker-desktop-repair.${"a".repeat(32)}`;
  const args = [
    "--adopt-docker-desktop-repair",
    id,
    "--repair-release-root",
    "C:\\old-release",
    "--json",
  ];
  const parsed = parseDoctorArguments(args, undefined);
  assert.equal(parsed.status, "ok");
  assert.deepEqual(parsed.value, {
    json: true,
    activeIsolation: false,
    recoveryId: null,
    repairDockerDesktopRuntime: false,
    closeDockerDesktopRepairId: null,
    adoptDockerDesktopRepairId: id,
    repairReleaseRoot: "C:\\old-release",
  });
  for (const invalidArguments of [
    ["--adopt-docker-desktop-repair", id],
    ["--repair-release-root", "C:\\old-release"],
    ["--adopt-docker-desktop-repair", id, "--from-release", "C:\\old-release"],
    [...args, "--repair-docker-desktop-runtime"],
    [...args, "--isolation"],
    [...args, "--recover-isolation", "host.example"],
  ]) {
    assert.equal(
      parseDoctorArguments(invalidArguments, undefined).status,
      "blocked",
    );
  }
});

test("Docker Taskの未確定createはexact復旧ID・検証済み再起動・修復記録の生成元配布Rootの組だけを受理する", () => {
  const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const repairId = `docker-desktop-repair.${"d".repeat(32)}`;
  const parsed = parseDoctorArguments(
    [
      "--recover-isolation",
      recoveryId,
      "--after-docker-desktop-repair",
      repairId,
      "--repair-release-root",
      "C:\\old-release",
      "--json",
    ],
    undefined,
  );
  assert.equal(parsed.status, "ok");
  assert.deepEqual(parsed.value, {
    json: true,
    activeIsolation: false,
    recoveryId,
    repairDockerDesktopRuntime: false,
    closeDockerDesktopRepairId: null,
    afterDockerDesktopRepairId: repairId,
    repairReleaseRoot: "C:\\old-release",
  });
  for (const invalidValues of [
    [
      "--recover-isolation",
      recoveryId,
      "--after-docker-desktop-repair",
      repairId,
    ],
    [
      "--after-docker-desktop-repair",
      repairId,
      "--repair-release-root",
      "C:\\old-release",
    ],
    [
      "--recover-isolation",
      "host.example",
      "--after-docker-desktop-repair",
      repairId,
      "--repair-release-root",
      "C:\\old-release",
    ],
  ])
    assert.equal(
      parseDoctorArguments(invalidValues, undefined).status,
      "blocked",
    );
});

test("doctorは診断と復旧に必要な引数だけを受理する", () => {
  assert.equal(parseDoctorArguments([], undefined).status, "ok");
  assert.equal(
    parseDoctorArguments(
      ["--recover-isolation", "host.safe", "--json"],
      undefined,
    ).status,
    "ok",
  );
  for (const argumentValues of [
    ["--json", "--json"],
    ["--unknown"],
    ["extra"],
    ["--recover-isolation", "host.safe", "--isolation"],
    ["--enable-runtime"],
    ["--runtime-root", path.resolve("runtime-root")],
  ]) {
    assert.equal(
      parseDoctorArguments(argumentValues, undefined).status,
      "blocked",
    );
  }
});

test("Docker Desktop最終復旧は単独の明示doctor処置としてだけ受理する", () => {
  const repair = parseDoctorArguments(
    ["--repair-docker-desktop-runtime", "--json"],
    undefined,
  );
  assert.equal(repair.status, "ok");
  assertPresent(repair.value);
  assert.equal(repair.value.repairDockerDesktopRuntime, true);

  const repairId = `docker-desktop-repair.${"a".repeat(32)}`;
  const close = parseDoctorArguments(
    ["--close-docker-desktop-runtime-repair", repairId, "--json"],
    undefined,
  );
  assert.equal(close.status, "ok");
  assertPresent(close.value);
  assert.equal(close.value.closeDockerDesktopRepairId, repairId);
  assert.equal(
    parseDoctorArguments(
      ["--repair-docker-desktop-runtime", "--isolation"],
      undefined,
    ).reason,
    "doctor_arguments_incompatible",
  );
});

test("taskは明示stdin入力だけを受理しrequestをargvへ置かない", () => {
  const parsed = parseTaskArguments(["--request-stdin", "--json"]);
  assert.equal(parsed.status, "ok");
  assertPresent(parsed.value);
  assert.equal(parsed.value.requestFromStdin, true);
  for (const argumentValues of [
    [],
    ["--json"],
    ["--request-stdin", "--request-stdin"],
    ["--request", "secret-like-content"],
  ]) {
    assert.equal(parseTaskArguments(argumentValues).status, "blocked");
  }
});

test("candidateはopaque IDの明示Export、DiscardまたはStore Recoveryだけを受理する", () => {
  const candidateId = `candidate.${"1".repeat(64)}.${"2".repeat(64)}`;
  assert.equal(
    parseCandidateArguments(["export", "--candidate-id", candidateId, "--json"])
      .status,
    "ok",
  );
  assert.equal(
    parseCandidateArguments(["discard", "--candidate-id", candidateId]).status,
    "ok",
  );
  assert.equal(
    parseCandidateArguments(["export", "--candidate-id", candidateId]).status,
    "blocked",
  );
  const recoveryId = `candidate-store-recovery.${"3".repeat(64)}`;
  assert.equal(
    parseCandidateArguments([
      "recover-store",
      "--recovery-id",
      recoveryId,
      "--confirm",
      "--json",
    ]).status,
    "ok",
  );
});

test("公開Capability表示はLocal Personalの成立済み入口だけを返す", () => {
  const result = spawnSync(
    process.execPath,
    [coordinatorExecutable, "capabilities", "--json"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), {
    contract: "crdd-coordinator/capabilities",
    contractRevision: 4,
    profile: "local_personal",
    commands: [
      {
        command: "task",
        availability: "available",
        invocation: "task --request-stdin --json",
      },
      { command: "doctor", availability: "available" },
      { command: "candidate", availability: "available" },
      {
        command: "project",
        availability: "development_candidate",
        invocation: "project --request-stdin --json",
      },
    ],
  });
});

test("template toolsの安定入口はCoordinator共通Launcherへ同一Processで接続する", () => {
  const result = spawnSync(
    process.execPath,
    [publicCoordinatorLauncher, "automation", "capabilities", "--json"],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 0, result.stderr);
  const output = JSON.parse(result.stdout);
  assert.equal(output.contract, "crdd-coordinator/capabilities");
  assert.equal(output.contractRevision, 4);
  assert.equal(
    output.commands.some(
      (entry: { command?: string }) => entry.command === "mcp",
    ),
    false,
  );
});

test("削除したcommandは互換処理へ入らず未知commandとして拒否される", () => {
  for (const command of ["activate", "disable", "provision", "mcp"]) {
    const result = spawnSync(
      process.execPath,
      [coordinatorExecutable, command, "--json"],
      {
        encoding: "utf8",
        windowsHide: true,
      },
    );
    assert.equal(result.status, 64);
    assert.equal(result.stderr.includes("Unknown command"), true);
    assert.equal(result.stdout.includes(`"command":"${command}"`), false);
  }
});

test("helpは通常Taskと現在利用可能なcommandだけを案内する", () => {
  const result = spawnSync(process.execPath, [coordinatorExecutable, "help"], {
    encoding: "utf8",
    windowsHide: true,
  });
  assert.equal(result.status, 0);
  assert.equal(
    result.stdout.includes("coordinator task --request-stdin"),
    true,
  );
  assert.equal(result.stdout.includes("coordinator capabilities --json"), true);
  assert.equal(result.stdout.includes("--repair-release-root"), true);
  assert.equal(
    result.stdout.includes("it is not the Docker task origin"),
    true,
  );
  assert.equal(result.stdout.includes("--from-release"), false);
  assert.equal(result.stdout.includes("coordinator activate"), false);
  assert.equal(result.stdout.includes("coordinator disable"), false);
  assert.equal(result.stdout.includes("coordinator provision"), false);
  assert.equal(result.stdout.includes("coordinator mcp"), false);
});

test("実task CLIは曖昧JSONと未検証source checkoutを全Effect前に拒否する", () => {
  const ambiguous = spawnSync(
    process.execPath,
    [coordinatorExecutable, "task", "--request-stdin", "--json"],
    {
      input: '{"frontProvider":"codex","frontProvider":"claude"}',
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(ambiguous.status, 64);
  assert.equal(
    JSON.parse(ambiguous.stdout).reason,
    "task_request_invalid_json",
  );

  const invalidRepository = spawnSync(
    process.execPath,
    [coordinatorExecutable, "task", "--request-stdin", "--json"],
    {
      cwd: os.tmpdir(),
      input: JSON.stringify({ frontProvider: "codex" }),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(invalidRepository.status, 2);
  assert.equal(
    JSON.parse(invalidRepository.stdout).reason,
    "coordinator_task_release_verification_required",
  );
});

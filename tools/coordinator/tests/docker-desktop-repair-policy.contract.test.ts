import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import test from "node:test";

import {
  describeDockerDesktopRepairPolicyContract,
  observeRuntimeOwnedDockerDesktopRepairPolicy,
  WINDOWS_DOCKER_DESKTOP_REPAIR_POLICY_RELATIVE_PATH,
} from "../src/security/docker-desktop-repair-policy.ts";
import {
  createDockerDesktopRepairNativeHelperSessionUsingChild,
  describeDockerDesktopRepairNativeHelperContract,
} from "../src/security/docker-desktop-repair-native-helper.ts";

test("署名対象PolicyはDocker DesktopとEngineと全成果物を単一authorityへ固定する", () => {
  const policy = observeRuntimeOwnedDockerDesktopRepairPolicy();
  assert.ok(policy);
  assert.equal(policy.dockerDesktopVersion, "4.41.2");
  assert.equal(policy.engineVersion, "28.1.1");
  assert.deepEqual(
    [...policy.artifacts.keys()],
    [
      "docker_cli",
      "desktop_cli",
      "launcher",
      "frontend",
      "backend",
      "build",
      "dev_envs",
    ],
  );
  assert.equal(policy.policySha256.length, 64);
  assert.equal(
    fs
      .readFileSync(
        new URL(
          "../policies/windows-docker-desktop-4.41.2.policy",
          import.meta.url,
        ),
        "utf8",
      )
      .startsWith("CRDD_WINDOWS_DOCKER_DESKTOP_REPAIR_POLICY_V1\n"),
    true,
  );
  assert.equal(
    WINDOWS_DOCKER_DESKTOP_REPAIR_POLICY_RELATIVE_PATH,
    "tools/coordinator/policies/windows-docker-desktop-4.41.2.policy",
  );
  assert.equal(
    describeDockerDesktopRepairPolicyContract().arbitraryPolicyPathAccepted,
    false,
  );
});

test("native helperはPIDでなく同じkernel handleを停止authorityにする", () => {
  const contract = describeDockerDesktopRepairNativeHelperContract();
  assert.equal(contract.pidAsTerminationAuthority, false);
  assert.equal(contract.processTreeTermination, false);
  assert.equal(
    contract.processTermination,
    "same_verified_kernel_process_handle_query_terminate_wait_close",
  );
  assert.equal(
    contract.parentLoss,
    "stdin_eof_releases_mutex_artifact_and_process_handles",
  );
});

test("native helper adapterは固定frameを順序処理しQ応答とexit 0までcleanup確認する", async () => {
  const hash = "a".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xaa);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR02"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("data",(chunk)=>{for(const value of chunk){',
    "const command=String.fromCharCode(value);",
    'const status=command==="I"?"V":command==="K"?"T":command==="V"?"V":command==="Q"?"C":"U";',
    "process.stdout.write(frame(status));",
    'if(command==="Q")process.exitCode=0;',
    "}});",
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperSessionUsingChild(
    child,
    hash,
  );
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(await created.session.inspectProcesses(), "verified");
  assert.equal(await created.session.terminateProcesses(), "terminated");
  assert.equal(await created.session.verifyArtifacts(), "verified");
  assert.equal(await created.session.release(), "released");
});

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

test("exact PolicyはWindows checkoutでもLFを維持する属性へ固定する", () => {
  const attributes = fs.readFileSync(
    new URL("../../../.gitattributes", import.meta.url),
    "utf8",
  );
  assert.equal(
    attributes,
    "tools/coordinator/policies/windows-docker-desktop-4.41.2.policy text eol=lf\n",
  );
  const bytes = fs.readFileSync(
    new URL(
      "../policies/windows-docker-desktop-4.41.2.policy",
      import.meta.url,
    ),
  );
  assert.equal(bytes.includes(0x0d), false);
  assert.equal(bytes.at(-1), 0x0a);
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
  assert.equal(
    contract.cancellationCleanup,
    "close_stdin_and_join_exit_child_close_and_all_stdio_within_bound",
  );
});

test("native helper adapterは固定frameを順序処理しQ応答とexit 0までcleanup確認する", async () => {
  const hash = "a".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xaa);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR04"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("data",(chunk)=>{for(const value of chunk){',
    "const command=String.fromCharCode(value);",
    'const status=command==="I"?"V":command==="K"?"T":command==="L"?"S":command==="V"?"V":command==="Q"?"C":"U";',
    "process.stdout.write(frame(status));",
    'if(command==="Q")setTimeout(()=>process.exit(0),75);',
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
  assert.equal(await created.session.launchDesktop(), "started");
  const releaseStarted = Date.now();
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
  assert.ok(Date.now() - releaseStarted >= 50);
});

test("native helper喪失はcommand失敗とbounded cleanup確認を分離する", async () => {
  const hash = "b".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xbb);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR04"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.once("data",()=>{process.stderr.write("failure");setTimeout(()=>process.exit(7),75);});',
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
  assert.equal(await created.session.verifyArtifacts(), "unknown");
  const cleanupStarted = Date.now();
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "failed",
  });
  assert.ok(Date.now() - cleanupStarted >= 50);
});

test("正常な取消cleanupはprotocol failureへ変換しない", async () => {
  const hash = "f".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xff);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR04"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("end",()=>setTimeout(()=>process.exit(0),50));',
    "process.stdin.resume();",
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
  assert.deepEqual(await created.session.abort(), {
    cleanup: "confirmed",
    protocol: "not_applicable",
  });
});

test("helper failure後のabortはprotocol failureを保持する", async () => {
  const hash = "1".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0x11);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR04"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.once("data",()=>{process.stderr.write("failure");setTimeout(()=>process.exit(7),50);});',
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
  assert.equal(await created.session.verifyArtifacts(), "unknown");
  assert.deepEqual(await created.session.abort(), {
    cleanup: "confirmed",
    protocol: "failed",
  });
});

test("不正initial frameはprotocol failureとしてbounded cleanupへ閉じる", async () => {
  const hash = "2".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0x22);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR04"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("X"));',
    'process.stdin.on("end",()=>setTimeout(()=>process.exit(9),50));',
    "process.stdin.resume();",
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
  assert.equal(await created.waitForInitial(), "X");
  assert.deepEqual(await created.failProtocol(), {
    cleanup: "confirmed",
    protocol: "failed",
  });
});

test("native launcherはCreateProcess後のidentity不明をissued済みとして保持する", async () => {
  const hash = "c".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xcc);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR04"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("data",(chunk)=>{for(const value of chunk){',
    "const command=String.fromCharCode(value);",
    'process.stdout.write(frame(command==="L"?"P":command==="Q"?"C":"V"));',
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
  assert.equal(await created.session.launchDesktop(), "partial_or_unknown");
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
});

test("native K/NはEffect非発行とProcess不存在を混同しない", async () => {
  const hash = "e".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xee);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR04"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("data",(chunk)=>{for(const value of chunk){',
    "const command=String.fromCharCode(value);",
    'process.stdout.write(frame(command==="K"?"N":command==="Q"?"C":"V"));',
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
  assert.equal(
    await created.session.terminateProcesses(),
    "not_issued_unknown",
  );
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "completed",
  });
});

test("release中の不正frameは資源回収完了まで待ちprotocol成功と分離する", async () => {
  const hash = "d".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xdd);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR04"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.once("data",()=>{process.stdout.write(frame("X"));setTimeout(()=>process.exit(9),75);});',
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
  const started = Date.now();
  const first = created.session.release();
  const second = created.session.release();
  assert.deepEqual(await first, {
    cleanup: "confirmed",
    protocol: "failed",
  });
  assert.deepEqual(await second, {
    cleanup: "confirmed",
    protocol: "failed",
  });
  assert.ok(Date.now() - started >= 50);
});

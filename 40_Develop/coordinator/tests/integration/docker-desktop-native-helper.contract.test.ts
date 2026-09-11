import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { describeDockerDesktopCurrentArtifactTrustContract } from "../../src/security/docker-desktop-current-artifact-trust.ts";
import { describeDockerDesktopRepairNativeHelperContract } from "../../src/security/docker-desktop-repair-native-helper.ts";
import { createDockerDesktopRepairNativeHelperLifecycle } from "../../src/security/docker-desktop-repair-native-helper-lifecycle-internal.ts";

for (const status of ["N", "T", "P", "X"] as const) {
  test(`restart S distinguishes command outcome ${status} from Docker completion`, async () => {
    const source = `const frame=s=>Buffer.concat([Buffer.from("CRDDDS01"),Buffer.from(s),Buffer.alloc(32,0xaa)]);process.stdout.write(frame("R"));process.stdin.on("data",c=>{const k=c.toString();if(k==="S")process.stdout.write(frame("${status}"));else if(k==="Q"){process.stdout.write(frame("C"));setTimeout(()=>process.exit(0),25)}else process.exit(3)});`;
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(
      child,
      "a".repeat(64),
      "restart",
    );
    assert.equal(await created.waitForInitial(), "R");
    assert.equal(
      await created.session.stopDesktop(),
      status === "N"
        ? "not_issued"
        : status === "T"
          ? "command_completed"
          : "outcome_unknown",
    );
    assert.equal((await created.session.release()).cleanup, "confirmed");
  });
}

for (const status of ["A", "V", "U"] as const) {
  test(`restart B client observation maps ${status} without issuing termination`, async () => {
    const source = `const frame=s=>Buffer.concat([Buffer.from("CRDDDS01"),Buffer.from(s),Buffer.alloc(32,0xaa)]);process.stdout.write(frame("R"));process.stdin.on("data",c=>{const k=c.toString();if(k==="B")process.stdout.write(frame("${status}"));else if(k==="Q"){process.stdout.write(frame("C"));setTimeout(()=>process.exit(0),25)}else process.exit(3)});`;
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(
      child,
      "a".repeat(64),
      "restart",
    );
    assert.equal(await created.waitForInitial(), "R");
    assert.equal(
      await created.session.inspectClientProcesses(),
      status === "A" ? "absent" : status === "V" ? "verified" : "unknown",
    );
    assert.deepEqual(await created.session.release(), {
      cleanup: "confirmed",
      protocol: "completed",
    });
  });
}

for (const entry of [
  {
    protocol: "restart" as const,
    magic: "CRDDDS01",
    correctHash: true,
    accepted: true,
  },
  {
    protocol: "repair" as const,
    magic: "CRDDDR05",
    correctHash: true,
    accepted: true,
  },
  {
    protocol: "restart" as const,
    magic: "CRDDDR05",
    correctHash: true,
    accepted: false,
  },
  {
    protocol: "repair" as const,
    magic: "CRDDDS01",
    correctHash: true,
    accepted: false,
  },
  {
    protocol: "repair" as const,
    magic: "CRDDDR04",
    correctHash: true,
    accepted: false,
  },
  {
    protocol: "restart" as const,
    magic: "CRDDDS01",
    correctHash: false,
    accepted: false,
  },
]) {
  test(`Native protocol separation ${JSON.stringify(entry)}`, async () => {
    const policy =
      "CRDD_DOCKER_RESTART_TRUST_V1|official-fixed-paths|Docker Inc|cache-only|deny-write-delete|optional-dev-envs";
    const hash = createHash("sha256").update(policy, "ascii").digest("hex");
    const source = [
      `const hash=Buffer.from(${JSON.stringify(entry.correctHash ? hash : "0".repeat(64))},"hex");`,
      `const frame=(s)=>Buffer.concat([Buffer.from(${JSON.stringify(entry.magic)}),Buffer.from(s),hash]);`,
      'process.stdout.write(frame("R"));',
      'process.stdin.on("data",(c)=>{process.stdout.write(frame(c.toString()==="Q"?"C":"V"));if(c.toString()==="Q")setTimeout(()=>process.exit(0),25);});',
      'process.stdin.on("end",()=>process.exit(0));',
    ].join("");
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(
      child,
      hash,
      entry.protocol,
    );
    assert.equal(await created.waitForInitial(), entry.accepted ? "R" : null);
    if (entry.accepted) {
      assert.equal(await created.session.verifyArtifacts(), "verified");
      assert.deepEqual(await created.session.release(), {
        cleanup: "confirmed",
        protocol: "completed",
      });
    } else {
      assert.deepEqual(await created.failProtocol(), {
        cleanup: "confirmed",
        protocol: "failed",
      });
    }
  });
}

test("署名対象の固定textはWindows checkoutでもLFを維持する", () => {
  const attributes = fs.readFileSync(
    new URL("../../../../.gitattributes", import.meta.url),
    "utf8",
  );
  const attributeLines = new Set(attributes.trimEnd().split("\n"));
  assert.equal(attributeLines.has("* text=auto eol=lf"), true);
  assert.equal(
    attributeLines.has(
      "40_Develop/coordinator/runtime/general-task-verification.txt text eol=lf",
    ),
    true,
  );
  const bytes = fs.readFileSync(
    new URL("../../runtime/general-task-verification.txt", import.meta.url),
  );
  assert.equal(bytes.includes(0x0d), false);
  assert.equal(bytes.at(-1), 0x0a);
});

test("native helperはPIDでなく同じkernel handleを停止authorityにする", () => {
  const contract = describeDockerDesktopRepairNativeHelperContract();
  assert.equal(contract.pidAsTerminationAuthority, false);
  assert.equal(contract.processTreeTermination, false);
  assert.equal(contract.legacyVersionPolicyUsedForCurrentAuthority, false);
  assert.equal(
    contract.currentRepairAndRestartTrustBoundary,
    "official_fixed_paths_valid_docker_inc_publisher_same_operation_identity_hash",
  );
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

test("現在の障害修復と再起動はDocker更新を許容し操作中の実体だけを固定する", () => {
  const contract = describeDockerDesktopCurrentArtifactTrustContract();
  assert.equal(contract.publisherOrganization, "Docker Inc");
  assert.equal(contract.authenticodeRequired, true);
  assert.equal(contract.exactVersionRequired, false);
  assert.equal(contract.exactHashRequiredAcrossOperations, false);
  assert.equal(contract.sameIdentityAndHashRequiredWithinOperation, true);
  const adapter = fs.readFileSync(
    new URL(
      "../../src/security/docker-desktop-repair-native-helper.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(adapter.includes("docker-desktop-repair-policy.ts"), false);
  assert.equal(adapter.includes('protocol === "repair"'), true);
  assert.equal(adapter.includes('protocol === "restart"'), false);
  assert.equal(adapter.includes("const helperMode ="), true);
  assert.equal(adapter.includes("spawn(executablePath, [helperMode]"), true);
});

test("native helper adapterは固定frameを順序処理しQ応答とexit 0までcleanup確認する", async () => {
  const hash = "a".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xaa);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
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
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  assert.equal(await created.session.inspectClientProcesses(), "unknown");
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

test("native helperはC応答後の非0 exitをcleanup成功と分離してprotocol失敗にする", async () => {
  const hash = "6".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0x66);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("data",()=>{process.stdout.write(frame("C"));setTimeout(()=>process.exit(7),50);});',
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
  assert.equal(await created.waitForInitial(), "R");
  assert.deepEqual(await created.session.release(), {
    cleanup: "confirmed",
    protocol: "failed",
  });
});

test("native helper喪失はcommand失敗とbounded cleanup確認を分離する", async () => {
  const hash = "b".repeat(64);
  const source = [
    "const hash=Buffer.alloc(32,0xbb);",
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.once("data",()=>{process.stderr.write("failure");setTimeout(()=>process.exit(7),75);});',
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
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
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.on("end",()=>setTimeout(()=>process.exit(0),50));',
    "process.stdin.resume();",
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
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
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.once("data",()=>{process.stderr.write("failure");setTimeout(()=>process.exit(7),50);});',
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
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
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("X"));',
    'process.stdin.on("end",()=>setTimeout(()=>process.exit(9),50));',
    "process.stdin.resume();",
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
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
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
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
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
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
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
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
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
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
    'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
    'process.stdout.write(frame("R"));',
    'process.stdin.once("data",()=>{process.stdout.write(frame("X"));setTimeout(()=>process.exit(9),75);});',
  ].join("");
  const child = spawn(process.execPath, ["-e", source], {
    shell: false,
    windowsHide: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
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

test("Q確認後のstdin.end throw／errorはprotocol成功とcleanupを直交させる", async () => {
  for (const mode of ["throw", "error"] as const) {
    const hash = mode === "throw" ? "3".repeat(64) : "4".repeat(64);
    const byte = mode === "throw" ? "0x33" : "0x44";
    const source = [
      `const hash=Buffer.alloc(32,${byte});`,
      'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
      'process.stdout.write(frame("R"));',
      'process.stdin.on("data",()=>process.stdout.write(frame("C")));',
      'process.stdin.on("end",()=>process.exit(0));',
    ].join("");
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
    assert.equal(await created.waitForInitial(), "R");
    Object.defineProperty(child.stdin, "end", {
      configurable: true,
      value: (mode === "throw"
        ? () => {
            throw new Error("synthetic end failure");
          }
        : () => {
            process.nextTick(() =>
              child.stdin.emit("error", new Error("synthetic EPIPE")),
            );
            return child.stdin;
          }) as typeof child.stdin.end,
    });
    const outcome = await created.session.release();
    assert.equal(outcome.protocol, "completed");
    assert.equal(outcome.cleanup, "confirmed");
  }
});

test("active protocol中の全stdio errorは恒久listenerからfailure cleanupへ収束する", async () => {
  for (const streamName of ["stdin", "stdout", "stderr"] as const) {
    const hash = "5".repeat(64);
    const source = [
      "const hash=Buffer.alloc(32,0x55);",
      'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
      'process.stdout.write(frame("R"));',
      "process.stdin.resume();",
    ].join("");
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
    assert.equal(await created.waitForInitial(), "R");
    child[streamName].emit("error", new Error("synthetic stdio failure"));
    await created.session.failureDetected;
    const outcome = await created.session.abort();
    assert.equal(outcome.protocol, "failed");
    assert.equal(outcome.cleanup, "confirmed");
  }
});

test("C確認後のstdout／stderr errorもprotocol Evidence不明として失敗する", async () => {
  for (const streamName of ["stdout", "stderr"] as const) {
    const hash = "7".repeat(64);
    const source = [
      "const hash=Buffer.alloc(32,0x77);",
      'const frame=(status)=>Buffer.concat([Buffer.from("CRDDDR05"),Buffer.from(status),hash]);',
      'process.stdout.write(frame("R"));',
      'process.stdin.once("data",()=>{process.stdout.write(frame("C"));setTimeout(()=>process.exit(0),75);});',
    ].join("");
    const child = spawn(process.execPath, ["-e", source], {
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    const created = createDockerDesktopRepairNativeHelperLifecycle(child, hash);
    assert.equal(await created.waitForInitial(), "R");
    child.stdout.once("data", (chunk: Buffer) => {
      if (chunk.subarray(8, 9).toString("ascii") === "C")
        child[streamName].emit(
          "error",
          new Error("synthetic post-C stdio failure"),
        );
    });
    assert.deepEqual(await created.session.release(), {
      cleanup: "confirmed",
      protocol: "failed",
    });
  }
});

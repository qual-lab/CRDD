import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { syncBuiltinESMExports } from "node:module";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { acquireRuntimeOwnedDockerDesktopRestartNativeHelper } from "../../src/security/docker-desktop-repair-native-helper.ts";
import { createDockerRestartMachine } from "../../src/security/docker-restart-machine.ts";
import { observePlatformAccessReleaseArtifactCandidate } from "../../src/security/platform-access-release.ts";
import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "../../src/security/candidate-store-kernel-lock.ts";
import { observeSystemWindowsDirectory } from "../../src/security/windows-directory-bootstrap.ts";
import { createWindowsNativeHelperEnvironment } from "../../src/core/windows-child-environment.ts";

test("Windows environment observation completes with three runtime lock workers", {
  skip: process.env.CRDD_REAL_DOCKER_OBSERVATION !== "1",
  timeout: 60_000,
}, () => {
  const locks = [];
  try {
    for (let index = 0; index < 3; index += 1) {
      const lock = acquireRuntimeOwnedDockerRuntimeStateKernelLock(
        randomBytes(32).toString("hex"),
      );
      assert.ok(lock);
      locks.push(lock);
    }
    for (let index = 0; index < 20; index += 1) {
      assert.ok(createWindowsNativeHelperEnvironment());
    }
  } finally {
    const releaseResults = locks.map((lock) => lock.release());
    assert.equal(releaseResults.length, locks.length);
    assert.ok(releaseResults.every((wasReleased) => wasReleased === true));
  }
});

test("Windows directory bootstrap rejects incomplete or failed native results", {
  skip: process.platform !== "win32",
}, () => {
  const original = childProcess.spawnSync;
  const payload = Buffer.from("C:\\Windows", "utf16le");
  const frame = Buffer.alloc(12 + payload.length);
  frame.write("CRDDWD01", 0, "ascii");
  frame.writeUInt32LE(payload.length / 2, 8);
  payload.copy(frame, 12);
  const success = {
    pid: 1,
    status: 0,
    signal: null,
    stdout: frame,
    stderr: Buffer.alloc(0),
    output: [],
  };
  try {
    for (const [label, result, expected] of [
      ["valid", success, "C:\\Windows"],
      ["exit", { ...success, status: 2 }, null],
      ["signal", { ...success, signal: "SIGTERM" }, null],
      ["error", { ...success, error: new Error("timeout") }, null],
      ["stderr", { ...success, stderr: Buffer.from("unexpected") }, null],
      ["truncated", { ...success, stdout: frame.subarray(0, -1) }, null],
      [
        "extra",
        { ...success, stdout: Buffer.concat([frame, Buffer.from([0])]) },
        null,
      ],
      ["magic", { ...success, stdout: Buffer.alloc(frame.length) }, null],
    ] as const) {
      childProcess.spawnSync = (() =>
        result) as unknown as typeof childProcess.spawnSync;
      syncBuiltinESMExports();
      assert.equal(observeSystemWindowsDirectory(), expected, label);
    }
  } finally {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  }
});

// Explicit, read-only real-environment IT. No stop/start or Provider invocation.
for (const hasRuntimeLock of [false, true]) {
  test(`real Native and WSL observation with runtime lock=${hasRuntimeLock}`, {
    skip: process.env.CRDD_REAL_DOCKER_OBSERVATION !== "1",
    timeout: 60_000,
  }, async (context) => {
    assert.equal(process.platform, "win32");
    const root = fileURLToPath(new URL("../../../../", import.meta.url));
    const artifact = observePlatformAccessReleaseArtifactCandidate(root);
    assert.equal(artifact.status, "candidate");
    const acquired = await acquireRuntimeOwnedDockerDesktopRestartNativeHelper(
      artifact.artifact,
    );
    assert.equal(acquired.status, "acquired");
    const session = acquired.session;
    assert.ok(session);
    const lock = hasRuntimeLock
      ? acquireRuntimeOwnedDockerRuntimeStateKernelLock(
          randomBytes(32).toString("hex"),
        )
      : null;
    try {
      if (hasRuntimeLock) assert.ok(lock);
      let observedClientState: "absent" | "verified" | null = null;
      let observedProcessState: "absent" | "verified" | null = null;
      for (let index = 0; index < 3; index += 1) {
        assert.equal(await session.verifyArtifacts(), "verified");
        const clientState = await session.inspectClientProcesses();
        const processState = await session.inspectProcesses();
        if (clientState === "unknown" || processState === "unknown")
          assert.fail("native process observation must be determinate");
        observedClientState ??= clientState;
        observedProcessState ??= processState;
        assert.equal(clientState, observedClientState);
        assert.equal(processState, observedProcessState);
        context.diagnostic(`native observation ${index + 1} completed`);
      }
      const machine = createDockerRestartMachine(
        session,
        () => true,
        new AbortController().signal,
      );
      context.diagnostic("entering composed Native/Engine/WSL observation");
      const wslState = machine.observeWslState();
      assert.notEqual(wslState, "unknown");
      assert.equal(
        await machine.observeReady(),
        true,
        "a verified Linux Engine response is ready independently of the optional WSL backend state",
      );
      assert.equal(
        await machine.observeStopped(),
        false,
        "an Engine that answered as ready cannot simultaneously be observed as stopped",
      );
      context.diagnostic("composed observation completed");
    } finally {
      const released = await session.release();
      if (lock) assert.equal(lock.release(), true);
      assert.equal(released.cleanup, "confirmed");
      assert.equal(released.protocol, "completed");
    }
  });
}

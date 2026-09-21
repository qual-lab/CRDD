/**
 * coordinator:integration:docker-restart-real-observationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-restart-real-observationが所有する検証責務を実行する。
 * @trace ERB-IT-014
 * @level IT
 * @scope docker、restart、real-observation
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { acquireRuntimeOwnedDockerDesktopRestartNativeHelper } from "../../src/security/docker-desktop-repair-native-process.ts";
import { createDockerRestartMachine } from "../../src/security/docker-restart-machine.ts";
import { observePlatformAccessReleaseArtifactCandidate } from "../../src/security/platform-access-release.ts";
import { acquireRuntimeOwnedDockerRuntimeStateKernelLock } from "../../src/security/candidate-store-kernel-lock.ts";
import { observeSystemWindowsDirectory } from "../../src/security/windows-directory-bootstrap.ts";
import {
  createInteractiveConsoleReaderEnvironment,
  createWindowsNativeHelperEnvironment,
} from "../../src/core/windows-child-environment.ts";

/**
 * 中立化したRuntime子Processから実Docker CLIのPublisher Trustを確認できるを検証する。
 *
 * @responsibility 中立化したRuntime子Processから実Docker CLIのPublisher Trustを確認できるの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 中立化したRuntime子Processから実Docker CLIのPublisher Trustを確認できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
test("中立化したRuntime子Processから実Docker CLIのPublisher Trustを確認できる", {
  skip:
    process.platform !== "win32" ||
    process.env.CRDD_REAL_DOCKER_OBSERVATION !== "1",
  timeout: 30_000,
}, () => {
  const parentEnvironment = createInteractiveConsoleReaderEnvironment();
  assert.ok(parentEnvironment);
  const profile = fs.realpathSync.native(os.userInfo().homedir);
  const temporary = fs.realpathSync.native(
    path.join(profile, "AppData", "Local", "Temp"),
  );
  const moduleUrl = pathToFileURL(
    path.resolve("src", "security", "docker-cli-trust.ts"),
  ).href;
  const source = [
    `import { observeTrustedDockerCli } from ${JSON.stringify(moduleUrl)};`,
    "try{const observed=observeTrustedDockerCli();process.stdout.write(JSON.stringify({status:'completed',trustBasis:observed.trustBasis,publisherOrganization:observed.publisherOrganization,bytesPositive:observed.bytes>0,sha256Length:observed.sha256.length}));}catch(error){process.stdout.write(JSON.stringify({status:'blocked',reason:error instanceof Error?error.message:String(error)}));process.exitCode=2;}",
  ].join("");
  const result = childProcess.spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", source],
    {
      cwd: path.resolve("."),
      env: { ...parentEnvironment, TEMP: temporary, TMP: temporary },
      encoding: "utf8",
      windowsHide: true,
      timeout: 20_000,
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "completed",
    trustBasis: "windows_authenticode_valid_docker_inc_publisher",
    publisherOrganization: "Docker Inc",
    bytesPositive: true,
    sha256Length: 64,
  });
});

/**
 * Windows environment observation completes with three runtime lock workersを検証する。
 *
 * @responsibility Windows environment observation completes with three runtime lock workersの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows environment observation completes with three runtime lock workersの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
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

/**
 * Windows directory bootstrap rejects incomplete or failed native resultsを検証する。
 *
 * @responsibility Windows directory bootstrap rejects incomplete or failed native resultsの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows directory bootstrap rejects incomplete or failed native resultsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
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
  /**
   * real Native and WSL observation with runtime lock=${hasRuntimeLock}を検証する。
   *
   * @responsibility real Native and WSL observation with runtime lock=${hasRuntimeLock}の合否判定を所有する。
   * @trace ERB-IT-014
   * @precondition Test Fileが構築するfixtureと入力を使用する。
   * @stimulus real Native and WSL observation with runtime lock=${hasRuntimeLock}の対象操作を実行する。
   * @observation 結果、状態、Effectおよび終了後条件を観測する。
   * @oracle Test本文のassertionが期待条件を満たす。
   * @cleanup Test本文または登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
   */
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
      context.diagnostic(`observed WSL backend state: ${wslState}`);
      if (process.env.CRDD_EXPECT_NON_WSL_DOCKER_BACKEND === "1")
        assert.equal(
          wslState,
          "stopped",
          "the explicitly selected non-WSL backend profile must keep the Docker WSL distribution stopped",
        );
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

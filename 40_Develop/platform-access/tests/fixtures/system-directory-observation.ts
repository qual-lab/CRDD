/**
 * 固定System Directory観測の異常入力fixture。
 * @packageDocumentation
 * @responsibility 実Nativeを起動せず固定Artifact・Process応答を境界ごとに差し替える。
 * @trace ERB-IT-001 ERB-IT-002
 * @level IT
 * @scope System Directoryの前後Artifact・固定Process・Protocol検査
 * @boundary 試験Module差替え。実OS保証は別の実Native観測で確認する。
 */
import assert from "node:assert/strict";
import { ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { mock } from "node:test";

const scenario = process.argv[2];
const scenarios = [
  "normal",
  "artifact_missing",
  "hash_mismatch",
  "artifact_changed",
  "spawn_error",
  "status",
  "signal",
  "stderr",
  "prefix",
  "length",
  "relative",
  "nul",
  "noncanonical",
  "utf16",
];
assert.ok(scenario && scenarios.includes(scenario));
const token = Object.freeze({});
let begins = 0;
let verifies = 0;
let spawns = 0;
const artifactPath =
  "template/tools/coordinator/windows-x64/crdd-platform-access.exe";
await mock.module(
  new URL("../../src/artifact/identity-observation.ts", import.meta.url).href,
  {
    namedExports: {
      PLATFORM_ACCESS_TARGET: "x86_64-pc-windows-msvc",
      PLATFORM_ACCESS_RUST_TOOLCHAIN: "1.94.1",
      PLATFORM_ACCESS_PROTOCOL_REVISION: 3,
      PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256:
        "ce265feabf5ef08aa0ab103078746fc40941db4fdf2d100eb7316711a4f6fddc",
      PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES: 16 * 1024 * 1024,
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH: artifactPath,
      observePlatformAccessArtifactCandidate: () => null,
      beginPlatformAccessArtifactObservation: () => {
        begins += 1;
        return scenario === "artifact_missing"
          ? null
          : {
              token,
              artifact: {
                sha256:
                  scenario === "hash_mismatch"
                    ? "0".repeat(64)
                    : "ce265feabf5ef08aa0ab103078746fc40941db4fdf2d100eb7316711a4f6fddc",
              },
            };
      },
      beginPlatformAccessBootstrapObservation: () => {
        throw new Error("system_directory_does_not_use_bootstrap_composition");
      },
      verifyPlatformAccessArtifactObservation: (value: object) => {
        assert.equal(value, token);
        verifies += 1;
        return scenario !== "artifact_changed";
      },
    },
  },
);
await mock.module("node:child_process", {
  namedExports: {
    ChildProcess,
    spawn,
    spawnSync: (
      executable: string,
      argv: string[],
      options: Record<string, unknown>,
    ) => {
      spawns += 1;
      assert.equal(
        executable,
        path.join(String(options.cwd), ...artifactPath.split("/")),
      );
      assert.deepEqual(argv, ["--system-windows-directory"]);
      assert.deepEqual(options.env, {});
      assert.equal(options.shell, false);
      assert.equal(options.windowsHide, true);
      assert.equal(options.timeout, 5_000);
      assert.equal(options.maxBuffer, 65_548);
      assert.equal(options.encoding, "buffer");
      const directory =
        scenario === "relative"
          ? "Windows"
          : scenario === "nul"
            ? "C:\\Windows\0"
            : scenario === "noncanonical"
              ? "C:\\Windows\\..\\Windows"
              : "C:\\Windows";
      const body =
        scenario === "utf16"
          ? Buffer.from([0x00, 0xd8])
          : Buffer.from(directory, "utf16le");
      const stdout = Buffer.alloc(12 + body.length);
      stdout.write(scenario === "prefix" ? "BADFRAME" : "CRDDWD01", "ascii");
      stdout.writeUInt32LE(scenario === "length" ? 0 : body.length / 2, 8);
      body.copy(stdout, 12);
      return {
        error: scenario === "spawn_error" ? new Error("fixture") : undefined,
        status: scenario === "status" ? 1 : 0,
        signal: scenario === "signal" ? "SIGTERM" : null,
        stderr:
          scenario === "stderr" ? Buffer.from("fixture") : Buffer.alloc(0),
        stdout,
      };
    },
  },
});
const { observeSystemWindowsDirectory } = await import("../../src/index.ts");
const result = observeSystemWindowsDirectory();
assert.equal(begins, 1);
assert.equal(result, scenario === "normal" ? "C:\\Windows" : null);
assert.equal(
  spawns,
  scenario === "artifact_missing" || scenario === "hash_mismatch" ? 0 : 1,
);
assert.equal(verifies, spawns);
process.stdout.write(
  JSON.stringify({
    scenario,
    observed: result !== null,
    begins,
    verifies,
    spawns,
  }),
);

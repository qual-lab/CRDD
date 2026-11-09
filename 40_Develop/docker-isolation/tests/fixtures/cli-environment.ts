/**
 * 明示設定からDocker専用環境を構築する有限fixture。
 * @packageDocumentation
 * @responsibility 親環境・PA・Nativeに依存しない固定投影を確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 別Node試験Process。Docker・Provider・実Native操作0。
 * @boundary 設定値とDocker環境構築のみ。
 */
import assert from "node:assert/strict";
import { mock } from "node:test";

const scenario = process.argv[2];
assert.ok(
  [
    "normal",
    "ambient_changed",
    "native_unavailable",
    "independent_settings",
  ].includes(scenario ?? ""),
);
let processRequests = 0;
await mock.module("node:child_process", {
  namedExports: {
    spawn: () => {
      processRequests++;
      throw Error("unexpected_process");
    },
    spawnSync: () => {
      processRequests++;
      throw Error("unexpected_process");
    },
    execFileSync: () => {
      processRequests++;
      throw Error("unexpected_process");
    },
  },
});
const {
  createDockerCliEnvironment,
  createDockerDesktopRepairHelperEnvironment,
  createDockerProcessEnvironment,
  createWindowsPowerShellAuthenticodeEnvironment,
} = await import("../../src/docker-cli/environment.ts");
const settings = Object.freeze({
  windowsDirectory: "D:\\Windows",
  userHomeDirectory: "D:\\Users\\fixture",
});
if (scenario === "ambient_changed") {
  process.env.SystemRoot = "Z:\\untrusted";
  process.env.USERPROFILE = "Z:\\untrusted-home";
  process.env.NODE_OPTIONS = "--ambient";
  process.env.HTTPS_PROXY = "http://ambient";
}
for (const [dockerConfig, dockerHome] of [
  [null, "D:\\owned-home"],
  ["D:\\owned-config", null],
  ["relative", "D:\\owned-home"],
  ["D:\\owned-config", "relative"],
  ["D:\\config\0bad", "D:\\owned-home"],
] as const)
  assert.equal(
    createDockerCliEnvironment(settings, { dockerConfig, dockerHome }),
    null,
  );
const base = createDockerProcessEnvironment(settings);
assert.ok(Object.isFrozen(base));
assert.equal(Object.getPrototypeOf(base), null);
assert.equal(base.SystemRoot, "D:\\Windows");
assert.equal(base.WINDIR, "D:\\Windows");
assert.equal(base.HOME, "");
assert.equal(base.USERPROFILE, "");
assert.equal(base.NODE_OPTIONS, "");
assert.equal(base.HTTPS_PROXY, "");
assert.equal(base.DOCKER_CLI_HINTS, "false");
const owned = createDockerCliEnvironment(settings, {
  dockerConfig: "D:\\config",
  dockerHome: "D:\\home",
});
assert.equal(owned?.DOCKER_CONFIG, "D:\\config");
assert.equal(owned?.HOME, "D:\\home");
assert.equal(owned?.USERPROFILE, "D:\\home");
assert.equal(owned?.SystemRoot, settings.windowsDirectory);
const repair = createDockerDesktopRepairHelperEnvironment(settings);
assert.equal(repair.USERPROFILE, settings.userHomeDirectory);
assert.equal(repair.SYSTEMDRIVE, "D:");
const authenticode = createWindowsPowerShellAuthenticodeEnvironment(settings);
assert.deepEqual(authenticode, {
  SystemRoot: "D:\\Windows",
  WINDIR: "D:\\Windows",
  USERPROFILE: "D:\\Users\\fixture",
  PATH: "D:\\Windows\\System32;D:\\Windows;D:\\Windows\\System32\\WindowsPowerShell\\v1.0",
  PATHEXT: ".COM;.EXE;.BAT;.CMD",
});
assert.ok(Object.isFrozen(authenticode));
const other = Object.freeze({
  windowsDirectory: "E:\\Windows",
  userHomeDirectory: "E:\\Users\\other",
});
assert.equal(createDockerProcessEnvironment(other).SystemRoot, "E:\\Windows");
assert.equal(
  createDockerProcessEnvironment(settings).SystemRoot,
  "D:\\Windows",
);
assert.equal(processRequests, 0);
process.stdout.write(
  JSON.stringify({
    scenario,
    fixedEnvironmentVerified: true,
    realNativeOrDockerIssued: false,
  }),
);

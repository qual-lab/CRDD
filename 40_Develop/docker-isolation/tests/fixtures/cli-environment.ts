/**
 * Docker環境構成を固定OS観測値へ接続する試験fixture。
 * @packageDocumentation
 * @responsibility 下位の固定key構成と観測不能時の停止を実Native起動と区別して検証する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope Platform Access観測は差替え。Docker・Provider・実Native操作0。
 * @boundary Docker環境構成→Platform Access公開観測の試験境界。
 */
import assert from "node:assert/strict";
import { mock } from "node:test";

const scenario = process.argv[2];
assert.ok(
  ["normal", "console_unknown", "native_unknown", "drive_unknown"].includes(
    scenario ?? "",
  ),
);
const neutral = Object.freeze(
  Object.assign(Object.create(null), {
    SystemRoot: "D:\\Windows",
    WINDIR: "D:\\Windows",
    HOME: "",
    USERPROFILE: "",
    HTTPS_PROXY: "",
    SYSTEMDRIVE: "",
  }),
);
let consoleObservations = 0;
let processRequests = 0;
await mock.module("node:child_process", {
  namedExports: {
    spawn: () => {
      processRequests += 1;
      throw new Error("environment_must_not_start_process");
    },
    spawnSync: () => {
      processRequests += 1;
      throw new Error("environment_must_not_start_process");
    },
    execFileSync: () => {
      processRequests += 1;
      throw new Error("environment_must_not_start_process");
    },
  },
});
await mock.module(
  new URL("../../../platform-access/src/index.ts", import.meta.url).href,
  {
    namedExports: {
      createInteractiveConsoleReaderEnvironment: (platform: string) => {
        assert.equal(platform, "win32");
        consoleObservations += 1;
        return scenario === "console_unknown" ? null : neutral;
      },
      createWindowsNativeHelperEnvironment: () =>
        scenario === "native_unknown"
          ? null
          : Object.freeze({ ...neutral, USERPROFILE: "D:\\Users\\fixture" }),
      deriveWindowsSystemDrive: (directory: unknown) => {
        assert.equal(directory, "D:\\Windows");
        return scenario === "drive_unknown" ? null : "D:";
      },
    },
  },
);
const {
  createDockerCliEnvironment,
  createDockerDesktopRepairHelperEnvironment,
  createDockerProcessEnvironment,
} = await import("../../src/execution/cli-environment.ts");

for (const [dockerConfig, dockerHome] of [
  [null, "D:\\owned-home"],
  ["D:\\owned-config", null],
  ["relative", "D:\\owned-home"],
  ["D:\\owned-config", "relative"],
  ["D:\\owned-config\0invalid", "D:\\owned-home"],
  ["D:\\owned-config", "D:\\owned-home\0invalid"],
] as const) {
  const before = consoleObservations;
  assert.equal(createDockerCliEnvironment({ dockerConfig, dockerHome }), null);
  assert.equal(consoleObservations, before);
}
const defaultEnvironment = createDockerCliEnvironment({
  dockerConfig: null,
  dockerHome: null,
});
if (scenario === "console_unknown") {
  assert.equal(defaultEnvironment, null);
  assert.throws(
    () => createDockerProcessEnvironment(),
    /docker_effect_environment_unavailable/u,
  );
} else {
  assert.deepEqual(
    defaultEnvironment,
    Object.assign(Object.create(null), neutral, { DOCKER_CLI_HINTS: "false" }),
  );
  assert.ok(Object.isFrozen(defaultEnvironment));
  assert.equal(Object.getPrototypeOf(defaultEnvironment), null);
  assert.deepEqual(createDockerProcessEnvironment(), defaultEnvironment);
  const owned = createDockerCliEnvironment({
    dockerConfig: "D:\\owned-config",
    dockerHome: "D:\\owned-home",
  });
  assert.deepEqual(
    owned,
    Object.assign(Object.create(null), neutral, {
      DOCKER_CLI_HINTS: "false",
      DOCKER_CONFIG: "D:\\owned-config",
      HOME: "D:\\owned-home",
      USERPROFILE: "D:\\owned-home",
    }),
  );
  assert.ok(Object.isFrozen(owned));
  assert.deepEqual(
    Object.keys(neutral).sort(),
    [
      "HOME",
      "HTTPS_PROXY",
      "SYSTEMDRIVE",
      "SystemRoot",
      "USERPROFILE",
      "WINDIR",
    ].sort(),
  );
}
const repair = createDockerDesktopRepairHelperEnvironment();
if (scenario === "native_unknown" || scenario === "drive_unknown") {
  assert.equal(repair, null);
} else {
  assert.deepEqual(repair, {
    ...neutral,
    USERPROFILE: "D:\\Users\\fixture",
    SYSTEMDRIVE: "D:",
  });
  assert.ok(Object.isFrozen(repair));
}
assert.equal(processRequests, 0);
process.stdout.write(
  JSON.stringify({
    scenario,
    fixedEnvironmentVerified: true,
    realNativeOrDockerIssued: false,
  }),
);

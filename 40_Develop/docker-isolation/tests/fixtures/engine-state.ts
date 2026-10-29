/**
 * 用途固定Engine観測のProcess・出所・pipe境界を差し替える。
 * @packageDocumentation
 * @responsibility 実Docker・Publisher・Host pipeを触らず、公開APIの要求と結果を照合する。
 * @trace ERB-IT-014
 * @trace ERB-IT-001
 * @level IT
 * @scope 別NodeのModule差替え、固定結果。
 * @boundary 合成境界。実環境成立を主張しない。
 */
import assert from "node:assert/strict";
import * as childProcess from "node:child_process";
import fs from "node:fs";
import { mock } from "node:test";
import * as cliTrust from "../../src/docker-cli/trust.ts";
import * as cliEnvironment from "../../src/docker-cli/environment.ts";

const purpose = process.argv[2];
const scenario = process.argv[3];
const injectCloseMismatch = process.argv[4] === "wrong-close";
assert.ok(
  purpose === "runtime" || purpose === "repair" || purpose === "desktop_repair",
);
assert.ok(
  [
    "ready",
    "absent",
    "present",
    "pipe-fault",
    "close-fault",
    "timeout",
    "signal",
    "environment",
    "publisher-before",
    "publisher-after",
    "unsupported",
  ].includes(String(scenario)),
);
if (scenario === "unsupported")
  Object.defineProperty(process, "platform", { value: "linux" });
const environment = Object.freeze({
  DOCKER_CONFIG: "fixture",
  HOME: "fixture",
});
const configurationRoot = "C:\\fixture\\configuration";
const snapshot = Object.freeze({ executablePath: "C:\\fixture\\docker.exe" });
const requests: { executable: unknown; argv: unknown; options: unknown }[] = [];
const environments: unknown[] = [];
const pipes: unknown[] = [];
let publishersBefore = 0;
let publishersAfter = 0;
const verifiedSnapshots: unknown[] = [];
await mock.module(
  new URL("../../src/docker-cli/environment.ts", import.meta.url).href,
  {
    namedExports: {
      ...cliEnvironment,
      createDockerCliEnvironment: (input: unknown) => {
        environments.push(input);
        return scenario === "environment" ? null : environment;
      },
    },
  },
);
await mock.module(
  new URL("../../src/docker-cli/trust.ts", import.meta.url).href,
  {
    namedExports: {
      ...cliTrust,
      observeTrustedDockerCli: () => {
        publishersBefore += 1;
        if (scenario === "publisher-before") throw new Error("fixture");
        return snapshot;
      },
      verifyTrustedDockerCliSnapshot: (observed: unknown) => {
        publishersAfter += 1;
        verifiedSnapshots.push(observed);
        if (scenario === "publisher-after") throw new Error("fixture");
        return snapshot.executablePath;
      },
    },
  },
);
await mock.module("node:child_process", {
  namedExports: {
    ...childProcess,
    spawnSync: (executable: unknown, argv: unknown, options: unknown) => {
      requests.push({ executable, argv, options });
      return {
        pid: 1,
        status: scenario === "ready" || scenario === "publisher-after" ? 0 : 1,
        signal: scenario === "signal" ? "SIGTERM" : null,
        error:
          scenario === "timeout"
            ? Object.assign(new Error("fixture"), { code: "ETIMEDOUT" })
            : undefined,
        stdout:
          scenario === "ready" || scenario === "publisher-after"
            ? JSON.stringify({
                Os: "linux",
                Arch: "amd64",
                Version: "29.1.0",
                ApiVersion: "1.52",
              })
            : "",
        stderr:
          scenario === "ready" || scenario === "publisher-after"
            ? ""
            : "fixture",
      };
    },
  },
});
const fixtureFs = {
  ...fs,
  openSync: (endpoint: unknown, flags: unknown) => {
    pipes.push(["open", endpoint, flags]);
    if (scenario === "absent")
      throw Object.assign(new Error("fixture"), { code: "ENOENT" });
    if (scenario === "pipe-fault")
      throw Object.assign(new Error("fixture"), { code: "EACCES" });
    return 1;
  },
  closeSync: (handle: unknown) => {
    pipes.push(["close", injectCloseMismatch ? 2 : handle]);
    if (scenario === "close-fault") throw new Error("fixture");
  },
};
await mock.module("node:fs", {
  defaultExport: fixtureFs,
  namedExports: fixtureFs,
});
const api = await import("../../src/index.ts");
const observed =
  purpose === "runtime"
    ? api.observeDockerRuntimeEngine()
    : purpose === "repair"
      ? api.observeDockerRepairEngine(configurationRoot)
      : (
          await import("../../src/docker-desktop/engine.ts")
        ).observeDockerDesktopRepairEngine();
assert.equal("observeDockerDesktopRepairEngine" in api, false);
const preRejected = ["environment", "publisher-before", "unsupported"].includes(
  String(scenario),
);
assert.equal(requests.length, preRejected ? 0 : 1);
if (requests.length)
  assert.deepEqual(requests[0], {
    executable: snapshot.executablePath,
    argv: [
      "--host",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
      ...(purpose === "repair" ? ["--config", configurationRoot] : []),
      "version",
      "--format",
      "{{json .Server}}",
    ],
    options: {
      env: environment,
      shell: false,
      windowsHide: true,
      timeout: 5_000,
      maxBuffer: purpose === "runtime" ? 16_384 : 4_096,
      encoding: "utf8",
    },
  });
if (environments.length)
  assert.deepEqual(environments, [
    {
      dockerConfig: purpose === "repair" ? configurationRoot : null,
      dockerHome: purpose === "repair" ? configurationRoot : null,
    },
  ]);
assert.equal(
  publishersBefore,
  scenario === "unsupported" ||
    (scenario === "environment" && purpose !== "runtime")
    ? 0
    : 1,
);
assert.equal(publishersAfter, requests.length);
assert.ok(verifiedSnapshots.every((observed) => observed === snapshot));
const pipeExpected = [
  "absent",
  "present",
  "pipe-fault",
  "close-fault",
].includes(String(scenario));
const expectedPipes = pipeExpected
  ? [
      ["open", "\\\\.\\pipe\\dockerDesktopLinuxEngine", "r+"],
      ...(["present", "close-fault"].includes(String(scenario))
        ? [["close", 1]]
        : []),
    ]
  : [];
try {
  assert.deepEqual(pipes, expectedPipes);
} catch (error) {
  if (injectCloseMismatch)
    process.stderr.write("engine_close_handle_oracle_rejected\n");
  throw error;
}
assert.deepEqual(observed, {
  state:
    scenario === "ready"
      ? "ready"
      : scenario === "absent"
        ? "known_unavailable"
        : scenario === "timeout" && purpose !== "runtime"
          ? "transient_unavailable"
          : "unknown",
  cleanup: scenario === "close-fault" ? "unknown" : "confirmed",
});
process.stdout.write(
  JSON.stringify({ purpose, scenario, observed, realDockerIssued: false }),
);

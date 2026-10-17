/**
 * backend観測の固定Process境界を差し替える。
 * @packageDocumentation
 * @responsibility 実WSL・Nativeを起動せず、Root APIの固定構成と失敗分類を確認する。
 * @trace ERB-IT-002
 * @level IT
 * @scope OS所在・固定argv・有界Process結果。
 * @boundary Module差替え。実環境成立とは区別する。
 */
import assert from "node:assert/strict";
import * as childProcess from "node:child_process";
import { mock } from "node:test";
import * as platformAccess from "../../../platform-access/src/index.ts";

const scenario = process.argv[2];
assert.ok(
  [
    "stopped",
    "running",
    "status",
    "signal",
    "stderr",
    "encoding",
    "throw",
    "environment",
    "unsupported",
  ].includes(String(scenario)),
);
if (scenario === "unsupported")
  Object.defineProperty(process, "platform", { value: "linux" });
const environment = Object.freeze({
  SystemRoot: "C:\\Windows",
  PATH: "",
  NODE_OPTIONS: "",
});
let requests = 0;
await mock.module(
  new URL("../../../platform-access/src/index.ts", import.meta.url).href,
  {
    namedExports: {
      ...platformAccess,
      createWindowsNativeHelperEnvironment: () =>
        scenario === "environment" ? null : environment,
    },
  },
);
await mock.module("node:child_process", {
  namedExports: {
    ...childProcess,
    spawnSync: (
      executable: string,
      argv: string[],
      options: Record<string, unknown>,
    ) => {
      requests += 1;
      assert.equal(executable, "C:\\Windows\\System32\\wsl.exe");
      assert.deepEqual(
        argv,
        requests === 1
          ? ["--list", "--quiet"]
          : ["--list", "--running", "--quiet"],
      );
      assert.deepEqual(options, {
        env: environment,
        shell: false,
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 65_536,
        encoding: "buffer",
      });
      if (scenario === "throw") throw Error("fixture");
      return {
        status: scenario === "status" ? 1 : 0,
        signal: scenario === "signal" ? "SIGTERM" : null,
        stderr:
          scenario === "stderr" ? Buffer.from("fixture") : Buffer.alloc(0),
        stdout:
          scenario === "encoding"
            ? Buffer.from([0x00, 0xd8])
            : Buffer.from(
                requests === 1
                  ? "docker-desktop\nUbuntu\n"
                  : scenario === "running"
                    ? "docker-desktop\n"
                    : "Ubuntu\n",
                "utf16le",
              ),
      };
    },
  },
});
const { observeDockerRuntimeBackendState } = await import("../../src/index.ts");
const state = observeDockerRuntimeBackendState();
assert.equal(
  state,
  scenario === "stopped" || scenario === "running" ? scenario : "unknown",
);
assert.equal(
  requests,
  scenario === "environment" || scenario === "unsupported"
    ? 0
    : scenario === "throw"
      ? 1
      : 2,
);
process.stdout.write(
  JSON.stringify({ scenario, state, requests, realWslOrDockerIssued: false }),
);

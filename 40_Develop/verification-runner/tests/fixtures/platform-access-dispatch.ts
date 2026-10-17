/**
 * Platform Access両言語のRunner搬送観測fixture。
 * @packageDocumentation
 * @responsibility 実Compiler・Rust試験を開始せず本番Runnerの要求順と停止を観測する。
 * @trace CQS-IT-011 CQS-IT-012
 * @level IT
 * @scope Node／Cargo静的検査・段階実行
 * @boundary 本番Runner→試験用spawn応答。実試験成功とは区別する。
 */
import assert from "node:assert/strict";
import { mock } from "node:test";
import path from "node:path";

const failure = process.argv[2] ?? "none";
const mode = process.argv[3] ?? "platform";
assert.ok(
  ["platform", "multi", "host", "host_source", "portable_only"].includes(mode),
);
assert.ok(
  [
    "none",
    "node_static",
    "rust_static",
    "rust_unit",
    "node_test",
    "rust_integration",
    "windows_test",
    "windows_coordinator",
    "windows_docker",
  ].includes(failure),
);
const calls: { kind: string; owner: string }[] = [];
const requests: {
  kind: string;
  owner: string;
  files: string[];
  skip: string | null;
}[] = [];
await mock.module("node:child_process", {
  namedExports: {
    spawnSync: (command: string, args: string[], options: { cwd: string }) => {
      const owner = path.basename(options.cwd);
      const kind =
        command === "cargo"
          ? args.includes("check")
            ? "rust_static"
            : args.includes("--bin")
              ? "rust_unit"
              : "rust_integration"
          : args.includes("--test")
            ? args.some((arg) => arg.startsWith("--test-name-pattern="))
              ? "windows_test"
              : "node_test"
            : "node_static";
      calls.push({ kind, owner });
      requests.push({
        kind,
        owner,
        files: args.filter((arg) => arg.endsWith(".test.ts")),
        skip:
          args.find((arg) => arg.startsWith("--test-skip-pattern=")) ?? null,
      });
      if (kind === "node_test" || kind === "windows_test") {
        assert.ok(args.some((arg) => arg.endsWith(".test.ts")));
        assert.equal(
          args.some((arg) => arg.endsWith(".rs")),
          false,
        );
      }
      if (kind === "windows_test") {
        assert.ok(
          args.includes(
            "--test-name-pattern=^(Windows Process Gate:|Host Windows:)",
          ),
        );
        assert.ok(
          ["docker-isolation", "coordinator", "platform-access"].includes(
            owner,
          ),
        );
        if (mode !== "host")
          assert.deepEqual(
            args.filter((arg) => arg.endsWith(".test.ts")),
            owner === "docker-isolation"
              ? [
                  "./tests/integration/native-process.contract.test.ts",
                  "./tests/integration/owned-process.integration.test.ts",
                ]
              : owner === "platform-access"
                ? ["./tests/integration/entry-observation.contract.test.ts"]
                : mode === "platform"
                  ? [
                      "./tests/integration/development-native-observation.integration.test.ts",
                      "./tests/integration/native-git-provenance.contract.test.ts",
                    ]
                  : [
                      "./tests/integration/docker-isolation-host.integration.test.ts",
                      "./tests/integration/runtime-repair-owner.contract.test.ts",
                    ],
          );
      } else if (
        kind === "node_test" &&
        args.some((arg) => arg.includes("/integration/"))
      ) {
        assert.equal(
          args.includes(
            "--test-skip-pattern=^(Windows Process Gate:|Host Windows:)",
          ),
          mode !== "portable_only",
        );
      } else if (kind === "node_test") {
        assert.equal(
          args.some((arg) => arg.startsWith("--test-skip-pattern=")),
          false,
        );
      }
      if (command === "cargo") {
        assert.ok(args.includes("--target"));
        assert.ok(args.includes("x86_64-pc-windows-msvc"));
        assert.ok(args.includes("--frozen"));
        if (kind === "rust_unit") {
          assert.equal(args[args.indexOf("--bin") + 1], "crdd-platform-access");
          assert.equal(args.includes("--test"), false);
        } else if (kind === "rust_integration") {
          assert.equal(args[args.indexOf("--test") + 1], "cli");
          assert.equal(args.includes("--bin"), false);
        }
      }
      return {
        status:
          (kind === failure &&
            (owner === "platform-access" || kind === "windows_test")) ||
          (kind === "windows_test" &&
            failure ===
              `windows_${owner === "coordinator" ? "coordinator" : "docker"}`)
            ? 1
            : 0,
        stdout: "",
        stderr: "",
      };
    },
  },
});
const { runRegression } = await import("../../src/index.ts");
const reports: unknown[] = [];
const result = runRegression({
  arguments: [
    "--changed",
    mode === "portable_only"
      ? "40_Develop/coordinator/tests/integration/runtime-retirement.contract.test.ts"
      : mode === "host_source"
        ? "40_Develop/coordinator/src/host-execution/recovery-record.ts"
        : mode === "host"
          ? "40_Develop/coordinator/tests/integration/host-recovery-record.contract.test.ts"
          : mode === "platform"
            ? "40_Develop/platform-access/src/artifact/identity-observation.ts"
            : "40_Develop/docker-isolation/src/index.ts",
    "--levels",
    "unit,integration",
    "--windows-process-control-authorized",
    ...(mode === "host_source" ? ["--plan"] : []),
  ],
  emit: (value) => reports.push(value),
});
process.stdout.write(
  JSON.stringify({ result, calls, requests, final: reports.at(-1) }),
);

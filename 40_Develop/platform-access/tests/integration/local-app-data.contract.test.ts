/**
 * 固定LocalAppData観測のNode／Native境界を検証する。
 * @packageDocumentation
 * @responsibility 所在観測とRoot Authorityを分離し、異常時の取得不能を確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 固定Process、Artifact前後、用途frame、Directory前後観測。
 * @boundary ERB-IT-001=Direct Boundary: Node→固定Native／Filesystem観測。
 * @boundary ERB-IT-002=Direct Boundary: 不正応答・観測不能の拒否。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  observeWindowsLocalAppDataDirectory,
  observeSystemWindowsDirectory,
} from "../../src/index.ts";
import {
  PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
} from "../../src/artifact/identity.ts";

/**
 * 本番観測本文の独立した失敗点と固定要求を反証する。
 * @responsibility frameやDirectoryの不明を所在取得成功へ補完しない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 本番本文と模擬Artifact／Process／Filesystemだけ。
 * @stimulus 未対応OS、前後Artifact差、全Process条件、frameとPath、Directory差を渡す。
 * @observation 要求全列・件数、Artifact照合とFilesystem読取り、結果。
 * @oracle 正常だけNativeが示すPathを返し、環境値や旧保存Rootを使わない。
 * @cleanup N/A: 実ProcessやFilesystem変更を行わない。
 * @boundary ERB-IT-001=Direct Boundary: 固定観測→模擬外部境界。
 * @boundary ERB-IT-002=Direct Boundary: 開始前拒否と開始後の観測不能。
 */
test("LocalAppDataは固定Native・frame・安定Directoryの全条件を要求する", () => {
  const source = fs.readFileSync(
    new URL("../../src/filesystem/local-app-data.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export function observeWindowsLocalAppDataDirectory(",
  );
  assert.ok(start >= 0);
  const body = stripTypeScriptTypes(
    source.slice(start).replace("export function", "function"),
  );
  const directory = "C:\\Users\\fixture\\AppData\\Local";
  for (const scenario of [
    "normal",
    "extended_realpath",
    "case_realpath",
    "non_windows",
    "artifact_missing",
    "hash",
    "artifact_changed",
    "spawn_throw",
    "error",
    "status",
    "signal",
    "stderr",
    "magic",
    "system_magic",
    "zero",
    "length_large",
    "short",
    "odd",
    "extra",
    "nul",
    "utf16",
    "bom",
    "relative",
    "root",
    "unc",
    "noncanonical",
    "file",
    "link",
    "stat_throw",
    "realpath_throw",
    "realpath_other",
    "after_changed",
    "after_link",
    "after_file",
    "after_throw",
  ]) {
    let begins = 0,
      verifies = 0,
      spawns = 0,
      stats = 0,
      realpaths = 0;
    const token = {};
    const selected =
      scenario === "relative"
        ? "relative"
        : scenario === "root"
          ? "C:\\"
          : scenario === "unc"
            ? "\\\\server\\share"
            : scenario === "noncanonical"
              ? `${directory}\\..\\Local`
              : scenario === "nul"
                ? `${directory}\0`
                : scenario === "bom"
                  ? `\ufeff${directory}`
                  : directory;
    const observe = runInNewContext(
      `${body}; observeWindowsLocalAppDataDirectory`,
      {
        Buffer,
        TextDecoder,
        path,
        process: {
          platform: scenario === "non_windows" ? "linux" : "win32",
          env: { LOCALAPPDATA: "C:\\not-the-OS-value" },
        },
        distributionRoot: "C:\\fixed-distribution",
        PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256,
        PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
        beginPlatformAccessArtifactObservation(root: string) {
          begins++;
          assert.equal(root, "C:\\fixed-distribution");
          return scenario === "artifact_missing"
            ? null
            : {
                token,
                artifact: {
                  sha256:
                    scenario === "hash"
                      ? "0".repeat(64)
                      : PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256,
                },
              };
        },
        verifyPlatformAccessArtifactObservation(received: unknown) {
          verifies++;
          assert.equal(received, token);
          return scenario !== "artifact_changed";
        },
        spawnSync(executable: string, args: string[], options: object) {
          spawns++;
          assert.equal(
            executable,
            path.join(
              "C:\\fixed-distribution",
              ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
            ),
          );
          assert.deepEqual(Array.from(args), ["--local-app-data-directory"]);
          assert.deepEqual(JSON.parse(JSON.stringify(options)), {
            env: {},
            cwd: "C:\\fixed-distribution",
            shell: false,
            windowsHide: true,
            timeout: 5000,
            maxBuffer: 65548,
            encoding: "buffer",
          });
          if (scenario === "spawn_throw") throw new Error("spawn");
          const payload =
            scenario === "utf16"
              ? Buffer.from([0, 0xd8])
              : Buffer.from(selected, "utf16le");
          let stdout = Buffer.alloc(12 + payload.length);
          stdout.write(
            scenario === "magic"
              ? "WRONG001"
              : scenario === "system_magic"
                ? "CRDDWD01"
                : "CRDDLA01",
            "ascii",
          );
          stdout.writeUInt32LE(
            scenario === "zero"
              ? 0
              : scenario === "length_large"
                ? 32768
                : payload.length / 2,
            8,
          );
          payload.copy(stdout, 12);
          if (scenario === "short") stdout = stdout.subarray(0, 10);
          if (scenario === "odd")
            stdout = stdout.subarray(0, stdout.length - 1);
          if (scenario === "extra")
            stdout = Buffer.concat([stdout, Buffer.from([0])]);
          return {
            stdout,
            stderr:
              scenario === "stderr" ? Buffer.from("private") : Buffer.alloc(0),
            status: scenario === "status" ? 1 : 0,
            signal: scenario === "signal" ? "SIGTERM" : null,
            error: scenario === "error" ? new Error("timeout") : undefined,
          };
        },
        fs: {
          lstatSync(value: string, options: object) {
            stats++;
            assert.equal(value, directory);
            assert.deepEqual(JSON.parse(JSON.stringify(options)), {
              bigint: true,
            });
            if (
              scenario === "stat_throw" ||
              (scenario === "after_throw" && stats === 2)
            )
              throw new Error("stat");
            return {
              dev: 1n,
              ino: scenario === "after_changed" && stats === 2 ? 9n : 2n,
              birthtimeNs: 3n,
              isDirectory: () =>
                scenario !== "file" &&
                !(scenario === "after_file" && stats === 2),
              isSymbolicLink: () =>
                scenario === "link" ||
                (scenario === "after_link" && stats === 2),
            };
          },
          realpathSync: {
            native(value: string) {
              realpaths++;
              assert.equal(value, directory);
              if (scenario === "realpath_throw") throw new Error("realpath");
              return scenario === "realpath_other"
                ? "C:\\other"
                : scenario === "extended_realpath"
                  ? `\\\\?\\${directory}`
                  : scenario === "case_realpath"
                    ? directory.toLowerCase()
                    : directory;
            },
          },
        },
      },
    ) as () => string | null;
    const successful = [
      "normal",
      "extended_realpath",
      "case_realpath",
    ].includes(scenario);
    assert.equal(observe(), successful ? directory : null, scenario);
    assert.equal(begins, scenario === "non_windows" ? 0 : 1, scenario);
    const started = !["non_windows", "artifact_missing", "hash"].includes(
      scenario,
    );
    assert.equal(spawns, started ? 1 : 0, scenario);
    assert.equal(
      verifies,
      started && scenario !== "spawn_throw" ? 1 : 0,
      scenario,
    );
    if (successful) {
      assert.equal(stats, 2);
      assert.equal(realpaths, 1);
    }
    if (
      [
        "non_windows",
        "artifact_missing",
        "hash",
        "artifact_changed",
        "magic",
        "system_magic",
        "zero",
        "length_large",
        "short",
        "odd",
        "extra",
        "nul",
        "utf16",
        "bom",
        "relative",
        "root",
        "unc",
        "noncanonical",
      ].includes(scenario)
    )
      assert.equal(stats, 0, scenario);
  }
});

/**
 * 配布Nativeからの実OS所在観測を合成試験と分けて確認する。
 * @responsibility 新HashのNativeが新旧二用途を実際に受理することを確認する。
 * @trace ERB-IT-001
 * @precondition 固定Windows Nativeを同じ候補からBuild・配置済み。
 * @stimulus 公開Rootの二つの固定観測を実行する。
 * @observation 非link Directory、絶対PathとSystem Directoryの維持。
 * @oracle 新旧両観測が成功する。修復・ACL・Authorityは主張しない。
 * @cleanup 各同期Native Processの終了を待つ。書込みなし。
 * @boundary ERB-IT-001=Direct Boundary: 公開Node→配布Native→実OS。
 */
test("配布Nativeの新旧Directory観測が実Windowsで成立する", {
  skip: process.platform !== "win32",
}, () => {
  const local = observeWindowsLocalAppDataDirectory();
  const windows = observeSystemWindowsDirectory();
  assert.ok(local);
  assert.ok(windows);
  assert.equal(path.win32.isAbsolute(local), true);
  assert.equal(fs.lstatSync(local).isDirectory(), true);
  assert.equal(fs.lstatSync(local).isSymbolicLink(), false);
});

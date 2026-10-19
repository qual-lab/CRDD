/**
 * 単一entry観測の固定Processとraw応答を検証する。
 * @packageDocumentation
 * @responsibility 不正応答・観測不能を不存在や削除許可へ補完しない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 模擬Nativeによる固定要求／raw応答反証と、Hostでの公開Root→配布Native→自己生成実体観測。
 * @boundary ERB-IT-001=Direct Boundary: 実本文→模擬Process、およびHost公開Root→配布Native→実Filesystem。
 * @boundary ERB-IT-002=Direct Boundary: 入力・応答・Artifact不明の拒否。実Hostは別profileで確認する。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
} from "../../src/artifact/identity-observation.ts";
import { observeWindowsFilesystemEntry } from "../../src/index.ts";

/**
 * 本番本文へ固定要求・異常frameを搬送する。
 * @responsibility 一条件ずつ壊した応答を成功へ補完しない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 実観測本文と模擬Artifact／Process。
 * @stimulus 正常file・Directory・AF_UNIX・未知tag・不存在と独立した異常を渡す。
 * @observation 要求全列、呼出し数、凍結結果、異常時null。
 * @oracle raw値だけを返し、kind・Path・処置許可を追加しない。
 * @cleanup N/A: Process・Filesystem変更なし。
 * @boundary ERB-IT-001=Direct Boundary: 固定Native要求。
 * @boundary ERB-IT-002=Direct Boundary: 異常観測の拒否。
 */
test("単一entry観測は固定Process・完全frame・Artifact前後を要求する", () => {
  const source = fs.readFileSync(
    new URL("../../src/windows/entry-observation.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export type WindowsEntryObservation");
  assert.ok(start > 0);
  const body = stripTypeScriptTypes(
    source.slice(start).replace(/^export /gmu, ""),
  );
  for (const scenario of [
    "file",
    "directory",
    "socket",
    "unknown_tag",
    "absent",
    "non_windows",
    "relative",
    "nul",
    "ads",
    "dot",
    "unc",
    "long",
    "artifact_missing",
    "artifact_hash",
    "artifact_changed",
    "spawn_throw",
    "error",
    "status",
    "signal",
    "stderr",
    "short",
    "extra",
    "magic",
    "magic_highbit",
    "state",
    "absent_dirty",
    "attributes_zero",
    "tag_missing",
    "tag_without_reparse",
    "volume_zero",
    "index_zero",
    "creation_zero",
    "links_zero",
    "stdout_not_buffer",
  ]) {
    let begins = 0,
      verifies = 0,
      spawns = 0;
    const token = {};
    const entryPath = "C:\\fixed\\old-runtime\\entry.sock";
    const context = {
      Buffer,
      path,
      process: { platform: scenario === "non_windows" ? "linux" : "win32" },
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
                  scenario === "artifact_hash"
                    ? "0".repeat(64)
                    : PLATFORM_ACCESS_BOOTSTRAP_ARTIFACT_SHA256,
              },
            };
      },
      verifyPlatformAccessArtifactObservation(value: unknown) {
        verifies++;
        assert.equal(value, token);
        return scenario !== "artifact_changed";
      },
      spawnSync(executable: string, args: string[], options: unknown) {
        spawns++;
        assert.equal(
          executable,
          path.join(
            "C:\\fixed-distribution",
            ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
          ),
        );
        assert.deepEqual(Array.from(args), ["--filesystem-entry", entryPath]);
        assert.deepEqual(JSON.parse(JSON.stringify(options)), {
          env: {},
          cwd: "C:\\fixed-distribution",
          shell: false,
          windowsHide: true,
          timeout: 5000,
          maxBuffer: 42,
          encoding: "buffer",
        });
        if (scenario === "spawn_throw") throw new Error("fixture");
        let frame = Buffer.alloc(41);
        frame.write("CRDDFE01");
        frame[8] = 80;
        frame.writeUInt32LE(
          scenario === "directory"
            ? 0x10
            : scenario === "socket" ||
                scenario === "unknown_tag" ||
                scenario === "tag_missing"
              ? 0x420
              : 0x20,
          9,
        );
        frame.writeUInt32LE(
          scenario === "socket"
            ? 0x80000023
            : scenario === "unknown_tag"
              ? 0x80000024
              : scenario === "tag_without_reparse"
                ? 0x80000023
                : 0,
          13,
        );
        frame.writeUInt32LE(7, 17);
        frame.writeBigUInt64LE(9007199254740993n, 21);
        frame.writeBigUInt64LE(133000000000000000n, 29);
        frame.writeUInt32LE(1, 37);
        if (scenario === "absent" || scenario === "absent_dirty") {
          frame.fill(0, 9);
          frame[8] = 65;
          if (scenario === "absent_dirty") frame[40] = 1;
        }
        if (scenario === "short") frame = frame.subarray(0, 40);
        if (scenario === "extra")
          frame = Buffer.concat([frame, Buffer.from([0])]);
        if (scenario === "magic") frame[0] = 0;
        if (scenario === "magic_highbit") frame[0] = 0xc3;
        if (scenario === "state") frame[8] = 0;
        if (scenario === "attributes_zero") frame.writeUInt32LE(0, 9);
        if (scenario === "volume_zero") frame.writeUInt32LE(0, 17);
        if (scenario === "index_zero") frame.writeBigUInt64LE(0n, 21);
        if (scenario === "creation_zero") frame.writeBigUInt64LE(0n, 29);
        if (scenario === "links_zero") frame.writeUInt32LE(0, 37);
        return {
          error: scenario === "error" ? new Error("fixture") : undefined,
          status: scenario === "status" ? 2 : 0,
          signal: scenario === "signal" ? "SIGTERM" : null,
          stderr: Buffer.from(scenario === "stderr" ? "x" : ""),
          stdout:
            scenario === "stdout_not_buffer" ? frame.toString("hex") : frame,
        };
      },
    };
    const observe = runInNewContext(
      `${body}; observeWindowsFilesystemEntry`,
      context,
    ) as (input: unknown) => unknown;
    const inputs: Record<string, unknown> = {
      relative: "relative",
      nul: `${entryPath}\0`,
      ads: `${entryPath}:data`,
      dot: "C:\\fixed\\.\\entry",
      unc: "\\\\server\\share\\entry",
      long: `C:\\${"x".repeat(4097)}`,
    };
    const result = observe(inputs[scenario] ?? entryPath);
    const accepted = [
      "file",
      "directory",
      "socket",
      "unknown_tag",
      "absent",
    ].includes(scenario);
    if (!accepted) {
      assert.equal(result, null, scenario);
    } else {
      assert.ok(result && typeof result === "object", scenario);
      assert.ok(Object.isFrozen(result));
      const value = JSON.parse(JSON.stringify(result));
      const identity = {
        volumeSerialNumber: 7,
        fileIndex: "9007199254740993",
        creationTime: "133000000000000000",
      };
      const expected: Record<string, unknown> = {
        file: {
          status: "present",
          attributes: 32,
          reparseTag: 0,
          identity,
          linkCount: 1,
        },
        directory: {
          status: "present",
          attributes: 16,
          reparseTag: 0,
          identity,
          linkCount: 1,
        },
        socket: {
          status: "present",
          attributes: 1056,
          reparseTag: 2147483683,
          identity,
          linkCount: 1,
        },
        unknown_tag: {
          status: "present",
          attributes: 1056,
          reparseTag: 2147483684,
          identity,
          linkCount: 1,
        },
        absent: { status: "confirmed_absent" },
      };
      assert.deepEqual(value, expected[scenario], scenario);
      if (scenario !== "absent") {
        assert.ok(Object.isFrozen((result as { identity: object }).identity));
        if (scenario === "socket") {
          const token = "    reparseTag,";
          assert.equal(body.split(token).length, 2);
          const changed = body.replace(token, "    reparseTag: 2147483684,");
          const mutant = runInNewContext(
            `${changed}; observeWindowsFilesystemEntry`,
            context,
          ) as (input: unknown) => unknown;
          assert.throws(() =>
            assert.deepEqual(
              JSON.parse(JSON.stringify(mutant(entryPath))),
              expected[scenario],
            ),
          );
        }
      }
    }
    const beforeArtifact = ["non_windows", ...Object.keys(inputs)].includes(
      scenario,
    );
    const calls = scenario === "socket" ? 2 : 1;
    assert.equal(begins, beforeArtifact ? 0 : calls, scenario);
    assert.equal(
      spawns,
      beforeArtifact ||
        scenario === "artifact_missing" ||
        scenario === "artifact_hash"
        ? 0
        : calls,
      scenario,
    );
    assert.equal(
      verifies,
      spawns && scenario !== "spawn_throw" ? calls : 0,
      scenario,
    );
  }
});

/**
 * 固定配布Native経由のraw観測を自己生成の実体へ結合する。
 * @responsibility 通常実体・hardlink・junctionを異なるraw値として返し、処置許可を出さない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition Windowsと同候補の固定配布Native。検証したRepository-local試験Rootのみ。
 * @stimulus file／Directory／hardlink／junction／不存在を公開Rootから観測する。
 * @observation 前後の実体、tag、linkCount、内容不変と試験Root不存在。
 * @oracle 同対象は同実体、hardlinkは同実体でnlink2、junctionは別tag。不明を成功へ補完しない。
 * @cleanup 同期Processをjoin後、自己生成した固定名だけを非再帰で除去する。
 * @boundary ERB-IT-001／ERB-IT-002=Direct Boundary: 公開Node→配布Native→実Filesystem。
 */
test("Host Windows: 配布Nativeのentry観測はfile・Directory・junction・hardlinkを混同しない", {
  skip: process.platform !== "win32",
}, (t) => {
  const repositoryRoot = path.resolve(
    fileURLToPath(new URL("../../../..", import.meta.url)),
  );
  const git = spawnSync(
    "git",
    ["-C", repositoryRoot, "rev-parse", "--show-toplevel"],
    { encoding: "utf8", windowsHide: true, timeout: 5000 },
  );
  assert.equal(git.status, 0);
  assert.equal(
    fs.realpathSync.native(path.resolve(git.stdout.trim())),
    fs.realpathSync.native(repositoryRoot),
  );
  const testsRoot = path.join(repositoryRoot, ".crdd", "tests");
  for (const parent of [path.dirname(testsRoot), testsRoot]) {
    assert.equal(fs.lstatSync(parent).isDirectory(), true);
    assert.equal(fs.lstatSync(parent).isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(parent), parent);
  }
  const root = fs.mkdtempSync(path.join(testsRoot, "entry-observation-"));
  const target = path.join(root, "target");
  const file = path.join(root, "value.txt");
  const hardlink = path.join(root, "value-link.txt");
  const junction = path.join(root, "junction");
  const identities = [
    [testsRoot, fs.lstatSync(testsRoot, { bigint: true })],
    [root, fs.lstatSync(root, { bigint: true })],
  ] as const;
  t.after(() => {
    assert.equal(path.dirname(root), testsRoot);
    assert.match(path.basename(root), /^entry-observation-[a-zA-Z0-9]+$/u);
    for (const [directory, before] of identities) {
      const current = fs.lstatSync(directory, { bigint: true });
      assert.equal(before.isDirectory() && !before.isSymbolicLink(), true);
      assert.equal(current.isDirectory() && !current.isSymbolicLink(), true);
      assert.ok(before.dev > 0n && before.ino > 0n && before.birthtimeNs > 0n);
      assert.equal(current.dev, before.dev);
      assert.equal(current.ino, before.ino);
      assert.equal(current.birthtimeNs, before.birthtimeNs);
      assert.equal(fs.realpathSync.native(directory), directory);
    }
    for (const [entry, directory] of [
      [junction, true],
      [hardlink, false],
      [file, false],
      [target, true],
    ] as const) {
      try {
        fs.lstatSync(entry);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      if (directory) fs.rmdirSync(entry);
      else fs.unlinkSync(entry);
    }
    fs.rmdirSync(root);
    assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
  });
  fs.mkdirSync(target);
  const content = Buffer.from("self-generated entry observation fixture\n");
  fs.writeFileSync(file, content, { flag: "wx" });
  const observed = observeWindowsFilesystemEntry(file);
  assert.ok(observed && observed.status === "present");
  assert.equal(observed.attributes & 0x410, 0);
  assert.equal(observed.reparseTag, 0);
  assert.equal(observed.linkCount, 1);
  assert.deepEqual(observeWindowsFilesystemEntry(file), observed);
  const directory = observeWindowsFilesystemEntry(target);
  assert.ok(directory && directory.status === "present");
  assert.equal(directory.attributes & 0x410, 0x10);
  assert.notDeepEqual(directory.identity, observed.identity);
  fs.linkSync(file, hardlink);
  const linked = observeWindowsFilesystemEntry(hardlink);
  assert.ok(linked && linked.status === "present");
  assert.deepEqual(linked.identity, observed.identity);
  assert.equal(linked.linkCount, 2);
  fs.symlinkSync(target, junction, "junction");
  const junctionValue = observeWindowsFilesystemEntry(junction);
  assert.ok(junctionValue && junctionValue.status === "present");
  assert.equal(junctionValue.attributes & 0x410, 0x410);
  assert.equal(junctionValue.reparseTag, 0xa0000003);
  assert.notDeepEqual(junctionValue.identity, directory.identity);
  assert.deepEqual(observeWindowsFilesystemEntry(path.join(root, "absent")), {
    status: "confirmed_absent",
  });
  assert.deepEqual(fs.readFileSync(file), content);
  assert.equal(fs.statSync(target).isDirectory(), true);
});

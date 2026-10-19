/**
 * Native検証Toolの構築・選択・終了待機を実本文へ接続する。
 *
 * @packageDocumentation
 * @responsibility 旧署名graphを再実装せず通常の起動構成を保全する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope Cargo構築、artifact選択、Native子のclose待機の局所断面。
 * @boundary 実Cargo・Native・OS資源を生成せず実境界成立は主張しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

const tools = [
  "verify-native-protection.ts",
  "verify-native-terminal-namespace.ts",
  "verify-native-terminal-fixtures.ts",
] as const;

/**
 * 現行Toolだけを現在のCheckoutから読み取る。
 *
 * @responsibility 複製Sourceや旧結果を現在の実装として扱わない。
 * @trace ERB-IT-001
 * @precondition nameは固定三Toolのいずれかである。
 * @stimulus Sourceを読み改行だけを正規化する。
 * @observation 現在の実装本文。
 * @oracle 実ファイルの欠測は試験失敗になる。
 * @cleanup N/A: 読取りだけ。
 * @boundary 現在Source→局所VM。
 */
function readTool(name: (typeof tools)[number]): string {
  return fs
    .readFileSync(
      new URL(["../../scripts/", name].join(""), import.meta.url),
      "utf8",
    )
    .replaceAll("\r\n", "\n");
}

/**
 * 一意な開始点と次の終了点で実断面を取得する。
 *
 * @responsibility 試験側に別の構築処理を複製しない。
 * @trace ERB-IT-001
 * @precondition 既存Sourceの固定開始・終了markerを渡す。
 * @stimulus markerを照合してその間の実本文を取得する。
 * @observation 型除去前のSource断面。
 * @oracle 開始の欠測・重複と終了欠測を拒否する。
 * @cleanup N/A: メモリ上の文字列処理だけ。
 * @boundary 通常実装の局所観測であり任意Sourceの構文解析ではない。
 */
function toolFragment(
  source: string,
  startMarker: string,
  endMarker: string,
): string {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, startMarker);
  assert.equal(
    source.indexOf(startMarker, start + startMarker.length),
    -1,
    startMarker,
  );
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(end > start, endMarker);
  return source.slice(start, end);
}

/**
 * Cargo起動の実helperを固定期待へ照合する。
 *
 * @responsibility 検証Toolのtoolchain・target・入力と非shell構成を保全する。
 * @trace ERB-IT-001
 * @precondition Process生成は実行せずspawnSyncだけを代役へ置換する。
 * @stimulus 三Toolの四helperを実本文から呼び出す。
 * @observation exe、argvとoptionsの全文。
 * @oracle 実本文が渡した値を独立期待へ比較し、呼出し一回と元結果を保持する。
 * @cleanup N/A: Cargo・子Process・一時領域を生成しない。
 * @boundary 構築断面だけ。実Build成功は主張しない。
 */
test("Native検証Toolは固定Cargo構成を一回だけ要求する", () => {
  const repository = "/fixed/repository";
  const crate = "/fixed/repository/40_Develop/platform-access";
  const target = "/fixed/repository/40_Develop/platform-access/target";
  const prefix = ["+1.94.1-x86_64-pc-windows-msvc"];
  for (const item of [
    {
      file: tools[0],
      name: "lintNativeProtectionArtifact",
      args: [
        ...prefix,
        "clippy",
        "--manifest-path",
        [crate, "/Cargo.toml"].join(""),
        "--frozen",
        "--bin",
        "crdd-platform-access",
        "--tests",
        "--target",
        "x86_64-pc-windows-msvc",
        "--target-dir",
        target,
        "--",
        "-D",
        "warnings",
      ],
    },
    {
      file: tools[0],
      name: "buildNativeProtectionArtifact",
      args: [
        ...prefix,
        "test",
        "--manifest-path",
        [crate, "/Cargo.toml"].join(""),
        "--frozen",
        "--bin",
        "crdd-platform-access",
        "--target",
        "x86_64-pc-windows-msvc",
        "--no-run",
        "--message-format=json",
        "--target-dir",
        target,
      ],
    },
    {
      file: tools[1],
      name: "buildNativeTerminalNamespaceArtifact",
      args: [
        ...prefix,
        "test",
        "--manifest-path",
        [crate, "/Cargo.toml"].join(""),
        "--locked",
        "--no-run",
        "--target",
        "x86_64-pc-windows-msvc",
        "--target-dir",
        target,
        "--message-format=json",
      ],
    },
    {
      file: tools[2],
      name: "buildNativeTerminalFixtureArtifact",
      args: [
        ...prefix,
        "test",
        "--manifest-path",
        [crate, "/Cargo.toml"].join(""),
        "--locked",
        "--no-run",
        "--target",
        "x86_64-pc-windows-msvc",
        "--target-dir",
        target,
        "--message-format=json",
      ],
    },
  ]) {
    const fragment = toolFragment(
      readTool(item.file),
      ["  function ", item.name, "("].join(""),
      "\n  }\n",
    );
    let calls = 0;
    const result = Object.freeze({ status: 0, stdout: "fixed-output" });
    const returned: unknown = runInNewContext(
      stripTypeScriptTypes(
        [fragment, "  }", [item.name, "();"].join("")].join("\n"),
      ),
      {
        repository,
        crate,
        crateRoot: crate,
        target,
        buildRoot: target,
        spawnSync: (exe: unknown, args: unknown, options: unknown) => {
          calls += 1;
          assert.equal(exe, "cargo");
          assert.deepEqual(JSON.parse(JSON.stringify(args)), item.args);
          assert.deepEqual(JSON.parse(JSON.stringify(options)), {
            cwd: repository,
            encoding: "utf8",
            ...(item.file === tools[0] ? { shell: false } : {}),
            windowsHide: true,
            timeout: item.file === tools[0] ? 180_000 : 120_000,
            maxBuffer: (item.file === tools[0] ? 4 : 8) * 1024 * 1024,
          });
          return result;
        },
      },
    );
    assert.equal(calls, 1);
    assert.equal(returned, result);
  }
});

/**
 * 一意artifact選択と実体確認を実断面で反証する。
 *
 * @responsibility 0件・複数件・不正実体を検証実行物へ昇格しない。
 * @trace ERB-IT-001
 * @precondition Build応答とFilesystem読取りはメモリ代役を使用する。
 * @stimulus 正常一件と件数・file種別・link・nlink・realpathの各差を与える。
 * @observation 実断面のbinary返却またはAssertionError。
 * @oracle 正常だけ同じbinaryを返し各拒否は実選択・実体assertへ到達する。
 * @cleanup N/A: 実artifact・Directoryを作成しない。
 * @boundary 公式Native成果物検証や実Buildの代替にはしない。
 */
test("Native検証Toolは一件の通常実体だけを選択する", () => {
  const crate = "/fixed/repository/40_Develop/platform-access";
  const target = [crate, "/target"].join("");
  const binary = [target, "/x86_64-pc-windows-msvc/debug/deps/native.exe"].join(
    "",
  );
  for (const file of tools) {
    const source = readTool(file);
    const protection = file === tools[0];
    const fragment = toolFragment(
      source,
      protection
        ? "  const artifacts: string[] = [];"
        : "  const artifacts = build.stdout",
      protection ? "  const cacheAncestors:" : "  const expectedHash =",
    );
    for (const fault of [
      "normal",
      "zero",
      "two",
      "nonfile",
      "link",
      "hardlink",
      "realpath",
    ]) {
      const row = JSON.stringify({
        reason: "compiler-artifact",
        target: { name: "crdd-platform-access", kind: ["bin"] },
        profile: { test: true },
        executable: binary,
      });
      const stdout =
        fault === "zero"
          ? JSON.stringify({ reason: "build-finished", success: true })
          : fault === "two"
            ? [row, row].join("\n")
            : row;
      /**
       * 選択したNative成果物の実Path差だけを故障として注入する。
       * @responsibility 他Pathを読まず同じ成果物のalias拒否を反証する。
       * @trace ERB-IT-001
       * @precondition 固定binaryと一つのfaultを選択している。
       * @stimulus realpath反例だけ別Pathを返し通常対照は同じPathを返す。
       * @observation 実体検査の拒否と渡された対象Path。
       * @oracle 固定binary以外の観測や非canonical成果物の受理を失敗とする。
       * @cleanup N/A: Filesystem観測値の有限代役のみ。
       * @boundary 成果物選択の実本文。実Native成果物やlinkは生成しない。
       */
      const realpath = (selected: string) => {
        assert.equal(selected, binary);
        return fault === "realpath" ? [selected, ".other"].join("") : selected;
      };
      const context = {
        assert,
        path,
        crateRoot: crate,
        buildRoot: target,
        target,
        nodeIdentity: (selected: string) => selected,
        build: { stdout },
        fs: {
          lstatSync: (selected: string, options?: { bigint: boolean }) => {
            assert.equal(selected, binary);
            return {
              isFile: () => fault !== "nonfile",
              isSymbolicLink: () => fault === "link",
              nlink: options?.bigint
                ? fault === "hardlink"
                  ? 2n
                  : 1n
                : fault === "hardlink"
                  ? 2
                  : 1,
            };
          },
          realpathSync: Object.assign(realpath, { native: realpath }),
        },
      };
      /**
       * 三Toolの成果物選択断面へ同じ正常値と反例を入力する。
       * @responsibility 試験側の複製判定でなく実選択本文を評価する。
       * @trace ERB-IT-001
       * @precondition Cargo出力と実体観測を同じfaultへ結合している。
       * @stimulus 型除去した選択本文を有限contextのVMで評価する。
       * @observation 選択されたbinaryまたはassertion拒否。
       * @oracle 正常一件だけ受理し欠落・複数・不正実体は拒否する。
       * @cleanup N/A: VMの値だけでProcessや実Fileを生成しない。
       * @boundary 検証Toolの成果物選択。実Build成立は主張しない。
       */
      const run = () =>
        runInNewContext(
          stripTypeScriptTypes(
            [
              protection
                ? "const previousBuildBoundaries = [crateRoot, buildRoot];"
                : "",
              fragment,
              "binary;",
            ].join("\n"),
          ),
          context,
        );
      if (fault === "normal") assert.equal(run(), binary);
      else
        assert.throws(run, {
          name: "AssertionError",
        });
    }
  }
});

/**
 * Native子の開始構成とclose待機を実断面で確認する。
 *
 * @responsibility error・exitとcloseを分け所有timerの回収まで待つ。
 * @trace ERB-IT-002
 * @precondition EventEmitter子と仮timerだけを使い実Processを起動しない。
 * @stimulus 正常・error・timeoutの後にexit、最後にcloseを通知する。
 * @observation 実spawn入力、Promise未完了、終了fieldとtimer回収回数。
 * @oracle close前は未完了、close後は一回だけ完了しSignal listenerを解除する。
 * @cleanup 仮timerと局所listenerだけ。OS資源の回収成立は主張しない。
 * @boundary 実Tool全体・実Native E2Eではない。
 */
test("Native検証Toolはerrorとexitだけで完了せずcloseまで待つ", async () => {
  const binary = "/fixed/native.exe";
  const repository = "/fixed/repository";
  const runRoot = "/fixed/run";
  const fixture = "/fixed/run/fixture";
  const exactTest =
    "filesystem::host_record::protection_tests::terminal_protection_fixture_observes_handle_sharing";
  for (const file of tools) {
    const protection = file === tools[0];
    const fragment = toolFragment(
      readTool(file),
      protection
        ? "  const started = Date.now();"
        : file === tools[1]
          ? '  let stdout = "";'
          : '    let stdout = "";',
      protection
        ? "  const matchingEntries = output"
        : file === tools[1]
          ? "  const result = { stdout"
          : "    const result = { stdout",
    );
    for (const scenario of ["normal", "error", "timeout"]) {
      const child = Object.assign(new EventEmitter(), {
        stdout: new EventEmitter(),
        stderr: new EventEmitter(),
        kill: () => {
          killed += 1;
          return true;
        },
      });
      const host = Object.assign(new EventEmitter(), {
        env: { PRESERVED: "fixed" },
        execPath: "/fixed/node.exe",
      });
      let killed = 0;
      let calls = 0;
      let cleared = 0;
      let deadline: (() => void) | undefined;
      const timer = Object.freeze({});
      let settled = false;
      const code = [
        "(async () => {",
        fragment,
        protection
          ? "return { isExitObserved, isCloseObserved, isTimedOut, failed: isErrorObserved };"
          : "return { isExitObserved, isCloseObserved, isTimedOut, failed: error !== undefined };",
        "})()",
      ].join("\n");
      const pending = runInNewContext(stripTypeScriptTypes(code), {
        binary,
        repository,
        runRoot,
        fixture,
        exactTest,
        verificationOperation: "fixed-operation",
        fixtureCase: {
          test: "fixed-fixture",
          env: "CRDD_FIXED_RUN",
          kind: "target",
        },
        process: host,
        Buffer,
        createHash,
        fs: {
          readFileSync: (selected: string) => {
            assert.equal(selected, host.execPath);
            return Buffer.from("fixed-node");
          },
        },
        setTimeout: (callback: () => void, milliseconds: number) => {
          assert.equal(milliseconds, protection ? 30_000 : 15_000);
          deadline = callback;
          return timer;
        },
        clearTimeout: (selected: unknown) => {
          assert.equal(selected, timer);
          cleared += 1;
        },
        spawn: (exe: unknown, args: unknown, options: unknown) => {
          calls += 1;
          assert.equal(exe, binary);
          const expectedArgs = protection
            ? [
                exactTest,
                "--ignored",
                "--exact",
                "--nocapture",
                "--test-threads=1",
              ]
            : [
                file === tools[1]
                  ? "filesystem::host_record::tests::terminal_namespace_fixture"
                  : "fixed-fixture",
                "--exact",
                "--ignored",
                "--nocapture",
                "--test-threads=1",
              ];
          assert.deepEqual(JSON.parse(JSON.stringify(args)), expectedArgs);
          const env = protection
            ? {
                PRESERVED: "fixed",
                CRDD_NATIVE_PROTECTION_RUN: "fixed-operation",
                CRDD_NATIVE_PROTECTION_ROOT: runRoot,
                CRDD_NATIVE_PROTECTION_EXE: binary,
                TEMP: "/fixed/run/tmp",
                TMP: "/fixed/run/tmp",
              }
            : file === tools[1]
              ? {
                  PRESERVED: "fixed",
                  CRDD_TERMINAL_NAMESPACE_RUN: "fixed-operation",
                  CRDD_TERMINAL_NAMESPACE_ROOT: fixture,
                  TEMP: fixture,
                  TMP: fixture,
                }
              : {
                  PRESERVED: "fixed",
                  CRDD_FIXED_RUN: "fixed-operation",
                  CRDD_TERMINAL_FIXTURE_ROOT: runRoot,
                  CRDD_TEST_NODE_BINARY: host.execPath,
                  CRDD_TEST_NODE_SHA256: createHash("sha256")
                    .update("fixed-node")
                    .digest("hex"),
                  TEMP: fixture,
                  TMP: fixture,
                };
          assert.deepEqual(JSON.parse(JSON.stringify(options)), {
            cwd: repository,
            shell: false,
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            env,
          });
          return child;
        },
      }) as Promise<{
        isExitObserved: boolean;
        isCloseObserved: boolean;
        isTimedOut: boolean;
        failed: boolean;
      }>;
      void pending.then(() => {
        settled = true;
      });
      assert.equal(calls, 1);
      assert.ok(deadline);
      if (scenario === "error") child.emit("error", new Error("fixed-failure"));
      if (scenario === "timeout") deadline();
      child.emit("exit", scenario === "error" ? 1 : 0, null);
      await Promise.resolve();
      assert.equal(settled, false);
      assert.equal(cleared, 0);
      child.emit("close");
      const result = await pending;
      assert.equal(settled, true);
      assert.equal(result.isCloseObserved, true);
      assert.equal(result.isExitObserved, true);
      assert.equal(result.failed, scenario === "error");
      assert.equal(result.isTimedOut, scenario === "timeout");
      assert.equal(killed, scenario === "timeout" ? 1 : 0);
      assert.equal(cleared, 1);
      assert.equal(host.listenerCount("SIGINT"), 0);
      assert.equal(host.listenerCount("SIGTERM"), 0);
      child.emit("close");
      assert.equal(cleared, 1);
    }
  }
});

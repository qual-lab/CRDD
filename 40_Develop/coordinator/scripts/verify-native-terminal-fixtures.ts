/**
 * 自己生成Native終端試験を共有ビルドから能力別に確認する。
 *
 * @packageDocumentation
 * @responsibility 入力不変、private境界の実観測、子終了と自作対象の不存在を分ける。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @level IT
 * @scope 十能力・十一実行。実OS親・旧Root・公開Recoveryは対象外。
 * @boundary 固定Node→未署名Native。coldと排他互換試験だけ固定検証子を起動する。Docker/Providerは0。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  verifyRepositoryRoot,
  resolveVerifiedRepositoryRoot,
} from "../../version-control/src/repository-location.ts";
import {
  type NativeTerminalFixtureKind,
  validateNativeTerminalFixture,
} from "../tests/fixtures/native-terminal-oracles.ts";
import { nodeIdentity } from "./verify-native-protection.ts";
import { areNativeTerminalBoundariesUnchanged } from "./verify-native-terminal-namespace.ts";

type FixtureCase = {
  kind: NativeTerminalFixtureKind | "interop";
  test: string;
  env: string;
  run: string;
  child: string;
  contract: string;
  mode?: "before" | "after";
};
const cases: readonly FixtureCase[] = [
  {
    kind: "interop",
    test: "windows::terminal::tests::terminal_generation_node_interoperation",
    env: "CRDD_TERMINAL_INTEROP_RUN",
    run: "current-node-native-interop",
    child: "interop",
    contract: "no-packet-rust-assertions",
  },
  {
    kind: "target",
    test: "windows::terminal::tests::terminal_target_fixture",
    env: "CRDD_TERMINAL_TARGET_RUN",
    run: "target.261004.9da03fb1.r3",
    child: "target-r3",
    contract: "crdd-native/terminal-target-fixture",
  },
  {
    kind: "save",
    test: "windows::terminal::tests::terminal_save_fixture",
    env: "CRDD_TERMINAL_SAVE_RUN",
    run: "save.261003.c8d1092a.r1",
    child: "save-r1",
    contract: "crdd-native/terminal-save-fixture",
  },
  {
    kind: "capacity",
    test: "windows::terminal::tests::terminal_capacity_fixture",
    env: "CRDD_TERMINAL_CAPACITY_RUN",
    run: "capacity.261003.c8d1092a.r3-before",
    child: "capacity-r3-before",
    contract: "crdd-native/terminal-capacity-fixture",
    mode: "before",
  },
  {
    kind: "capacity",
    test: "windows::terminal::tests::terminal_capacity_fixture",
    env: "CRDD_TERMINAL_CAPACITY_RUN",
    run: "capacity.261003.c8d1092a.r3-after",
    child: "capacity-r3-after",
    contract: "crdd-native/terminal-capacity-fixture",
    mode: "after",
  },
  {
    kind: "current",
    test: "windows::terminal::tests::terminal_current_candidate_fixture",
    env: "CRDD_TERMINAL_CURRENT_RUN",
    run: "current.261003.73c9d18f.r1",
    child: "fixture-current-r1",
    contract: "crdd-native/terminal-current-candidate-fixture",
  },
  {
    kind: "cold",
    test: "windows::terminal::tests::terminal_cold_observation_fixture",
    env: "CRDD_TERMINAL_COLD_RUN",
    run: "cold.261003.219b9b53.r1",
    child: "fixture-cold-r1",
    contract: "crdd-native/terminal-cold-observation-fixture",
  },
  {
    kind: "rename",
    test: "windows::terminal::tests::terminal_rename_candidate_fixture",
    env: "CRDD_TERMINAL_PUBLICATION_RUN",
    run: "rename.261003.219b9b53.r1",
    child: "fixture-rename-r1",
    contract: "crdd-native/terminal-rename-candidate-fixture",
  },
  {
    kind: "publication",
    test: "windows::terminal::tests::terminal_publication_fixture",
    env: "CRDD_TERMINAL_PUBLICATION_RUN",
    run: "publication.261003.219b9b53.r4",
    child: "fixture-r4",
    contract: "crdd-native/terminal-rename-publication-fixture",
  },
  {
    kind: "disposition",
    test: "windows::terminal::tests::terminal_disposition_fixture",
    env: "CRDD_TERMINAL_DISPOSITION_RUN",
    run: "disposition.261004.61d28f4a.r3",
    child: "disposition-r3",
    contract: "crdd-native/terminal-disposition-fixture",
  },
  {
    kind: "known-file",
    test: "windows::terminal::tests::terminal_known_file_fixture",
    env: "CRDD_TERMINAL_KNOWN_FILE_RUN",
    run: "known-file.261004.f17052e1.r1",
    child: "known-file-r1",
    contract: "crdd-native/terminal-known-file-fixture",
  },
];

/**
 * 入力の実体と全bytesを前後比較する。
 *
 * @responsibility Node metadataをNative五fieldへ変換しない。
 * @trace ERB-IT-001
 * @precondition 固定Repository内の入力だけ。
 * @stimulus lstat/realpath/同期読取り。
 * @observation Node実体値とHash。
 * @oracle 非symlink、実Path一致、前後同一。
 * @cleanup N/A: 同期読取りだけ。
 * @boundary Node→Windows read-only filesystem。
 */
function inputIdentity(target: string): string {
  const value = fs.lstatSync(target, { bigint: true });
  assert.equal(value.isSymbolicLink(), false);
  assert.equal(fs.realpathSync(target).replaceAll("\\", "/"), target);
  const hash = value.isFile()
    ? createHash("sha256").update(fs.readFileSync(target)).digest("hex")
    : "directory";
  return `${value.dev}:${value.ino}:${value.birthtimeNs}:${hash}`;
}

/**
 * 自己生成Native試験の再実行と短命結果の回収を所有する。
 * @responsibility Buildから能力別の元Oracle・終了・不存在・入力不変まで共同確認する。
 * @trace ERB-IT-001
 * @precondition Windows、Repository Root、前回run処置済み、静的検査成功。
 * @stimulus 固定Cargoとexact Native test一件を実行する。
 * @observation 今回実行物、閉packet、exit/closeと直接不存在。
 * @oracle 全条件成立だけを限定成功とする。
 * @cleanup 成功時は自己生成小領域だけ回収し、失敗は保持する。
 * @boundary 未署名開発Native。Docker・本番Recovery・E2Eは対象外。
 */
async function runNativeTerminalFixtures(): Promise<void> {
  const repository = path
    .resolve(fileURLToPath(new URL("../../..", import.meta.url)))
    .replaceAll("\\", "/");
  assert.equal(process.platform, "win32");
  assert.deepEqual(process.argv.slice(2), []);
  assert.equal(process.cwd().replaceAll("\\", "/"), repository);
  const verified = verifyRepositoryRoot(repository);
  assert.equal(verified.status, "completed", "repository_root_unconfirmed");
  if (verified.status !== "completed")
    throw new Error("repository_root_unconfirmed");
  assert.equal(
    resolveVerifiedRepositoryRoot(verified.capability)?.replaceAll("\\", "/"),
    repository,
  );
  const crate = `${repository}/40_Develop/platform-access`;
  const tests = `${repository}/.crdd/tests`;
  const target = `${crate}/target`;
  for (const directory of [
    repository,
    `${repository}/40_Develop`,
    crate,
    `${repository}/.crdd`,
    tests,
    target,
  ])
    nodeIdentity(directory);
  assert.equal(
    fs.readdirSync(tests).some((name) => name.startsWith("native-terminal-")),
    false,
    "previous_native_terminal_run_requires_settlement",
  );
  const sources = [
    `${crate}/Cargo.toml`,
    `${crate}/Cargo.lock`,
    `${crate}/build.rs`,
    `${crate}/rust-toolchain.toml`,
    fileURLToPath(import.meta.url).replaceAll("\\", "/"),
    `${repository}/40_Develop/coordinator/scripts/verify-native-protection.ts`,
    `${repository}/40_Develop/coordinator/scripts/verify-native-terminal-namespace.ts`,
    repository +
      "/40_Develop/coordinator/tests/fixtures/native-terminal-oracles.ts",
  ];
  for (const directory of [`${crate}/src`, `${crate}/tests`]) {
    for (const file of fs
      .readdirSync(directory, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".rs")))
      sources.push(path.join(directory, file).replaceAll("\\", "/"));
  }
  sources.push(
    process.execPath.replaceAll("\\", "/"),
    `${repository}/40_Develop/coordinator/tests/fixtures/host-terminal-generation-worker.ts`,
  );
  for (const file of fs
    .readdirSync(`${repository}/40_Develop/coordinator/src`, {
      recursive: true,
      encoding: "utf8",
    })
    .filter((name) => name.endsWith(".ts")))
    sources.push(
      path
        .join(`${repository}/40_Develop/coordinator/src`, file)
        .replaceAll("\\", "/"),
    );
  const sourceBefore = sources.map(inputIdentity);
  const build = spawnSync(
    "cargo",
    [
      "+1.94.1-x86_64-pc-windows-msvc",
      "test",
      "--manifest-path",
      `${crate}/Cargo.toml`,
      "--locked",
      "--no-run",
      "--target",
      "x86_64-pc-windows-msvc",
      "--target-dir",
      target,
      "--message-format=json",
    ],
    {
      cwd: repository,
      encoding: "utf8",
      timeout: 120000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
    },
  );
  assert.equal(build.error, undefined);
  assert.equal(build.status, 0);
  const artifacts = build.stdout
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line) as Record<string, unknown>)
    .filter(
      (row) =>
        row.reason === "compiler-artifact" &&
        typeof row.executable === "string" &&
        (row.profile as Record<string, unknown>)?.test === true &&
        (row.target as Record<string, unknown>)?.name ===
          "crdd-platform-access",
    );
  assert.equal(artifacts.length, 1);
  const binary = String(artifacts[0]?.executable).replaceAll("\\", "/");
  assert.equal(
    path.dirname(binary),
    `${target}/x86_64-pc-windows-msvc/debug/deps`,
  );
  const binaryStat = fs.lstatSync(binary, { bigint: true });
  assert.equal(binaryStat.isFile(), true);
  assert.equal(binaryStat.isSymbolicLink(), false);
  assert.equal(binaryStat.nlink, 1n);
  assert.equal(fs.realpathSync(binary).replaceAll("\\", "/"), binary);
  const expectedHash = createHash("sha256")
    .update(fs.readFileSync(binary))
    .digest("hex");
  for (const fixtureCase of cases) {
    const runRoot = `${tests}/native-terminal-${randomUUID()}`;
    fs.mkdirSync(runRoot);
    fs.mkdirSync(`${runRoot}/tmp`);
    const fixture = `${runRoot}/${fixtureCase.child}`;
    const run = fixtureCase.run;
    const boundaries = [
      repository,
      `${repository}/40_Develop`,
      crate,
      target,
      `${target}/x86_64-pc-windows-msvc`,
      `${target}/x86_64-pc-windows-msvc/debug`,
      path.dirname(binary),
      `${repository}/.crdd`,
      tests,
      runRoot,
      `${runRoot}/tmp`,
    ];
    const boundaryBefore = boundaries.map(nodeIdentity);
    fs.writeFileSync(
      `${runRoot}/started.json`,
      `${JSON.stringify({
        contract: "crdd-coordinator/native-terminal-fixture-started",
        contractRevision: 1,
        startedAt: new Date().toISOString(),
        run,
      })}\n`,
      { flag: "wx" },
    );
    /**
     * 自作対象の不存在と観測不能を区別する。
     *
     * @responsibility ENOENT以外を不存在にしない。
     * @trace ERB-IT-001
     * @precondition 固定fresh fixtureだけ。
     * @stimulus lstat。
     * @observation present/absent/unknown。
     * @oracle unknownは拒否。
     * @cleanup N/A: 読取りのみ。
     * @boundary Node→Windows filesystem。
     */
    function presence(target: string): string {
      try {
        fs.lstatSync(target);
        return "present";
      } catch (error) {
        return error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
          ? "absent"
          : "unknown";
      }
    }

    const inputs = [...sources, binary];
    const before = inputs.map(inputIdentity);
    assert.equal(
      createHash("sha256").update(fs.readFileSync(binary)).digest("hex"),
      expectedHash,
    );
    assert.equal(presence(fixture), "absent");
    const utcStarted = new Date().toISOString();
    const started = performance.now();

    let stdout = "";
    let stderr = "";
    let error: Error | undefined;
    let status: number | null = null;
    let signal: NodeJS.Signals | null = null;
    let exitObserved = false;
    let closeObserved = false;
    let timedOut = false;
    let outputExceeded = false;
    await new Promise<void>((resolve) => {
      const child = spawn(
        binary,
        [
          fixtureCase.test,
          "--exact",
          "--ignored",
          "--nocapture",
          "--test-threads=1",
        ],
        {
          cwd: repository,
          shell: false,
          windowsHide: true,
          env: {
            ...process.env,
            [fixtureCase.env]: run,
            CRDD_TERMINAL_FIXTURE_ROOT: runRoot,
            CRDD_TEST_NODE_BINARY: process.execPath,
            CRDD_TEST_NODE_SHA256: createHash("sha256")
              .update(fs.readFileSync(process.execPath))
              .digest("hex"),
            TEMP: fixtureCase.kind === "target" ? fixture : `${runRoot}/tmp`,
            TMP: fixtureCase.kind === "target" ? fixture : `${runRoot}/tmp`,
          },
          stdio: ["ignore", "pipe", "pipe"],
        },
      );
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, 15000);
      child.stdout?.on("data", (chunk: Buffer) => {
        if (outputExceeded) return;
        if (
          Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + chunk.length >
          65536
        ) {
          outputExceeded = true;
          child.kill();
          return;
        }
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        if (outputExceeded) return;
        if (
          Buffer.byteLength(stdout) + Buffer.byteLength(stderr) + chunk.length >
          65536
        ) {
          outputExceeded = true;
          child.kill();
          return;
        }
        stderr += chunk.toString("utf8");
      });
      child.once("error", (failure) => {
        error = failure;
      });
      child.once("exit", (code, termination) => {
        exitObserved = true;
        status = code;
        signal = termination;
      });
      child.once("close", () => {
        closeObserved = true;
        clearTimeout(timer);
        resolve();
      });
    });
    const result = { stdout, stderr, error, status, signal };

    const literal = `{"contract":"${fixtureCase.contract}"`;
    const lines =
      result.stdout?.split(/\r?\n/u).flatMap((line) => {
        const offset = line.indexOf(literal);
        return offset < 0 ? [] : [line.slice(offset)];
      }) ?? [];
    let parsed: unknown = null;
    try {
      parsed = lines.length === 1 ? JSON.parse(lines[0] ?? "null") : null;
    } catch {
      parsed = null;
    }
    const native =
      parsed !== null && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    const nativeVerified =
      fixtureCase.kind === "interop"
        ? /test result: ok[.] 1 passed; 0 failed;/u.test(stdout)
        : validateNativeTerminalFixture(
            fixtureCase.kind,
            parsed,
            fixtureCase.mode,
          );
    const after = inputs.map((target) => {
      try {
        return inputIdentity(target);
      } catch {
        return "unknown";
      }
    });
    const inputUnchanged = before.every(
      (value, index) => value === after[index],
    );
    const fixturePresence = presence(fixture);
    const boundaryUnchanged = areNativeTerminalBoundariesUnchanged(
      boundaries,
      boundaryBefore,
    );
    const success =
      !result.error &&
      exitObserved &&
      closeObserved &&
      !timedOut &&
      !outputExceeded &&
      /test result: ok[.] 1 passed; 0 failed;/u.test(stdout) &&
      sourceBefore.every(
        (value, index) => value === inputIdentity(sources[index] ?? ""),
      ) &&
      boundaryUnchanged &&
      result.status === 0 &&
      result.signal === null &&
      nativeVerified &&
      inputUnchanged &&
      fixturePresence === "absent";
    const observation = {
      contract: "crdd-coordinator/native-terminal-fixture-observation",
      contractRevision: 1,
      status: success ? "observed" : "unconfirmed",
      utcStarted,
      utcFinished: new Date().toISOString(),
      durationMilliseconds: Math.round(performance.now() - started),
      binarySha256: expectedHash,
      before,
      after,
      inputUnchanged,
      boundaryUnchanged,
      nativeVerified,
      native,
      kind: fixtureCase.kind,
      mode: fixtureCase.mode ?? null,
      reparseObservation:
        fixtureCase.kind === "known-file"
          ? native?.reparseResult
          : "not_applicable",
      exitCode: result.status,
      signal: result.signal,
      launchOrTimeoutError:
        result.error && "code" in result.error ? result.error.code : null,
      fixturePresence,
      exitObserved,
      closeObserved,
      timedOut,
      outputExceeded,
      rawNativeOutputReported: false,
      productionIntegrationVerified: false,
      fullE2eVerified: false,
    };
    if (!areNativeTerminalBoundariesUnchanged(boundaries, boundaryBefore)) {
      console.log(
        JSON.stringify({
          ...observation,
          status: "unconfirmed",
          reason: "native_terminal_result_boundary_changed",
          resultSaved: false,
        }),
      );
      process.exitCode = 2;
      return;
    }
    fs.writeFileSync(
      `${runRoot}/result.json`,
      `${JSON.stringify(observation)}\n`,
      {
        flag: "wx",
      },
    );
    console.log(JSON.stringify(observation));
    if (success) {
      if (!areNativeTerminalBoundariesUnchanged(boundaries, boundaryBefore)) {
        process.exitCode = 2;
        return;
      }
      fs.rmdirSync(`${runRoot}/tmp`);
      fs.unlinkSync(`${runRoot}/started.json`);
      fs.unlinkSync(`${runRoot}/result.json`);
      fs.rmdirSync(runRoot);
    }
    process.exitCode = success ? 0 : 2;
    if (!success) return;
  }
  console.log(
    JSON.stringify({
      contract: "crdd-coordinator/native-terminal-fixture-suite",
      status: "completed",
      capabilities: 10,
      executions: cases.length,
      fullE2eVerified: false,
    }),
  );
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await runNativeTerminalFixtures();
}

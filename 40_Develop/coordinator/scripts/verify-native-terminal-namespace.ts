/**
 * 新しい固定保存境界fixtureを直接子一件で確認する。
 *
 * @packageDocumentation
 * @responsibility 入力不変、private境界の実観測、子終了と自作対象の不存在を分ける。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @level IT
 * @scope 固定namespace読取りだけ。実OS親・旧Root・公開Recoveryは対象外。
 * @boundary 固定Node→固定unsigned Native子一件。Docker/Provider/追加Processは0。
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
} from "../../version-control/src/index.ts";
import { nodeIdentity } from "./verify-native-protection.ts";

/**
 * 結果保存と清掃の直前に全保存境界を再照合する。
 * @responsibility 成否に依存せず、置換・観測不能時の書込みと清掃を拒否する。
 * @trace ERB-IT-001
 * @precondition 実行前に固定したPathとIdentityを同じ順序で渡す。
 * @stimulus 全Directoryの現在Identityを読む。
 * @observation 全一致、または不一致・読取り失敗。
 * @oracle 不一致と観測不能はfalseとし、処置許可へ変換しない。
 * @cleanup N/A: 同期読取りのみ。
 * @boundary Node→Repository-local filesystem。
 */
export function areNativeTerminalBoundariesUnchanged(
  boundaries: readonly string[],
  expectedEntries: readonly string[],
): boolean {
  if (boundaries.length !== expectedEntries.length || boundaries.length === 0)
    return false;
  try {
    return boundaries.every(
      (directory, index) => nodeIdentity(directory) === expectedEntries[index],
    );
  } catch {
    return false;
  }
}
/**
 * 自己生成namespace試験の再実行と短命結果の回収を所有する。
 * @responsibility Buildから19拒否例・終了・不存在・入力不変まで共同確認する。
 * @trace ERB-IT-001
 * @precondition Windows、Repository Root、前回run処置済み、静的検査成功。
 * @stimulus 固定Cargoとexact Native test一件を実行する。
 * @observation 今回実行物、閉packet、exit/closeと直接不存在。
 * @oracle 全条件成立だけを限定成功とする。
 * @cleanup 成功時は自己生成小領域だけ回収し、失敗は保持する。
 * @boundary 未署名開発Native。Docker・本番Recovery・E2Eは対象外。
 */
async function runNativeTerminalNamespace(): Promise<void> {
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
  const crate = repository + "/40_Develop/platform-access";
  const tests = repository + "/.crdd/tests";
  const target = crate + "/target";
  for (const directory of [
    repository,
    repository + "/40_Develop",
    crate,
    repository + "/.crdd",
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
    crate + "/Cargo.toml",
    crate + "/Cargo.lock",
    crate + "/build.rs",
    crate + "/rust-toolchain.toml",
    fileURLToPath(import.meta.url).replaceAll("\\", "/"),
  ];
  for (const directory of [crate + "/src", crate + "/tests"]) {
    for (const file of fs
      .readdirSync(directory, { recursive: true, encoding: "utf8" })
      .filter((name) => name.endsWith(".rs")))
      sources.push(path.join(directory, file).replaceAll("\\", "/"));
  }
  const previousSources = sources.map(inputIdentity);
  /**
   * 固定終端namespace試験の実行物をCargo出力として取得する。
   *
   * @responsibility 固定toolchain・target・共有Build Rootのno-run起動だけを所有する。
   * @trace ERB-IT-001
   * @precondition 親がRepository、入力集合とBuild Rootを検証済みである。
   * @stimulus 現行の固定Cargo test引数を同期要求する。
   * @observation 起動Error、終了値と構造化artifact出力。
   * @oracle 親が成功終了と一意な試験実行物を検査する。
   * @cleanup 親の入力不変・Directory同一性とrun保持契約に従う。
   * @boundary Nodeから固定Cargoへの検証専用境界。Native試験はここでは起動しない。
   */
  function buildNativeTerminalNamespaceArtifact() {
    return spawnSync(
      "cargo",
      [
        "+1.94.1-x86_64-pc-windows-msvc",
        "test",
        "--manifest-path",
        crate + "/Cargo.toml",
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
  }
  const build = buildNativeTerminalNamespaceArtifact();
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
    target + "/x86_64-pc-windows-msvc/debug/deps",
  );
  const binaryStat = fs.lstatSync(binary, { bigint: true });
  assert.equal(binaryStat.isFile(), true);
  assert.equal(binaryStat.isSymbolicLink(), false);
  assert.equal(binaryStat.nlink, 1n);
  assert.equal(fs.realpathSync(binary).replaceAll("\\", "/"), binary);
  const expectedHash = createHash("sha256")
    .update(fs.readFileSync(binary))
    .digest("hex");
  const runRoot = tests + "/native-terminal-" + randomUUID();
  fs.mkdirSync(runRoot);
  fs.mkdirSync(runRoot + "/tmp");
  const fixture = runRoot + "/namespace-r2";
  const verificationOperation = "namespace.261003.b17f28d1.r2";
  const boundaries = [
    repository,
    repository + "/40_Develop",
    crate,
    target,
    target + "/x86_64-pc-windows-msvc",
    target + "/x86_64-pc-windows-msvc/debug",
    path.dirname(binary),
    repository + "/.crdd",
    tests,
    runRoot,
    runRoot + "/tmp",
  ];
  const previousBoundaries = boundaries.map(nodeIdentity);
  fs.writeFileSync(
    runRoot + "/started.json",
    JSON.stringify({
      contract: "crdd-coordinator/native-terminal-namespace-started",
      contractRevision: 1,
      startedAt: new Date().toISOString(),
      run: verificationOperation,
    }) + "\n",
    { flag: "wx" },
  );
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
  const previousEntries = inputs.map(inputIdentity);
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
  let isExitObserved = false;
  let isCloseObserved = false;
  let isTimedOut = false;
  let outputExceeded = false;
  await new Promise<void>((resolve) => {
    const child = spawn(
      binary,
      [
        "filesystem::host_record::tests::terminal_namespace_fixture",
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
          CRDD_TERMINAL_NAMESPACE_RUN: verificationOperation,
          CRDD_TERMINAL_NAMESPACE_ROOT: fixture,
          TEMP: fixture,
          TMP: fixture,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const timer = setTimeout(() => {
      isTimedOut = true;
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
      isExitObserved = true;
      status = code;
      signal = termination;
    });
    child.once("close", () => {
      isCloseObserved = true;
      clearTimeout(timer);
      resolve();
    });
  });
  const result = { stdout, stderr, error, status, signal };

  const literal = '{"contract":"crdd-native/terminal-namespace-fixture"';
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
  const fields = [
    "contract",
    "contractRevision",
    "run",
    "observed",
    "phase",
    "normalVerified",
    "createdDirectories",
    "cleanupDirectories",
    "checkedCloses",
    "checkedClosesConfirmed",
    "fixturePresence",
    "rejections",
    "recordSaves",
    "productionIntegrationVerified",
    "osFaultInjectionVerified",
  ];
  const rows = Array.isArray(native?.rejections)
    ? (native.rejections as Record<string, unknown>[])
    : [];
  const isNativeVerified =
    native !== null &&
    Object.keys(native).length === fields.length &&
    Object.keys(native).every((key) => fields.includes(key)) &&
    native.contract === "crdd-native/terminal-namespace-fixture" &&
    native.contractRevision === 1 &&
    native.run === verificationOperation &&
    native.observed === true &&
    native.phase === "complete" &&
    native.normalVerified === true &&
    native.createdDirectories === 3 &&
    native.cleanupDirectories === 3 &&
    native.checkedClosesConfirmed === true &&
    typeof native.checkedCloses === "number" &&
    native.checkedCloses > 0 &&
    native.fixturePresence === "absent" &&
    native.recordSaves === 0 &&
    native.productionIntegrationVerified === false &&
    native.osFaultInjectionVerified === false &&
    rows.length === 19 &&
    rows.every((row, index) => {
      const expectedReasons =
        index < 15
          ? [
              "terminal_namespace_identity_mismatch",
              "terminal_directory_identity_mismatch",
            ]
          : index === 15
            ? ["terminal_selected_user_mismatch"]
            : index === 16
              ? ["terminal_namespace_expected_duplicate"]
              : ["terminal_open_failed"];
      return (
        row !== null &&
        typeof row === "object" &&
        Object.keys(row).length === 6 &&
        expectedReasons.includes(String(row.reason)) &&
        row.operationReason === row.reason &&
        row.tokensAcquired === (index === 16 ? 0 : 2) &&
        Array.isArray(row.tokenCloses) &&
        row.tokenCloses.length === row.tokensAcquired &&
        row.tokenCloses.every((closed) => closed === true) &&
        Number.isSafeInteger(row.directoriesAcquired) &&
        Number(row.directoriesAcquired) >= 0 &&
        Array.isArray(row.directoryCloses) &&
        row.directoryCloses.length === row.directoriesAcquired &&
        row.directoryCloses.every((closed) => closed === true)
      );
    });
  const subsequentEntries = inputs.map((target) => {
    try {
      return inputIdentity(target);
    } catch {
      return "unknown";
    }
  });
  const isInputUnchanged = previousEntries.every(
    (value, index) => value === subsequentEntries[index],
  );
  const fixturePresence = presence(fixture);
  const isBoundaryUnchanged = areNativeTerminalBoundariesUnchanged(
    boundaries,
    previousBoundaries,
  );
  const isSuccess =
    !result.error &&
    isExitObserved &&
    isCloseObserved &&
    !isTimedOut &&
    !outputExceeded &&
    /test result: ok[.] 1 passed; 0 failed;/u.test(stdout) &&
    previousSources.every(
      (value, index) => value === inputIdentity(sources[index] ?? ""),
    ) &&
    isBoundaryUnchanged &&
    result.status === 0 &&
    result.signal === null &&
    isNativeVerified &&
    isInputUnchanged &&
    fixturePresence === "absent";
  const observation = {
    contract: "crdd-coordinator/native-terminal-namespace-observation",
    contractRevision: 1,
    status: isSuccess ? "observed" : "unconfirmed",
    utcStarted,
    utcFinished: new Date().toISOString(),
    durationMilliseconds: Math.round(performance.now() - started),
    binarySha256: expectedHash,
    before: previousEntries,
    after: subsequentEntries,
    inputUnchanged: isInputUnchanged,
    boundaryUnchanged: isBoundaryUnchanged,
    nativeVerified: isNativeVerified,
    native,
    exitCode: result.status,
    signal: result.signal,
    launchOrTimeoutError:
      result.error && "code" in result.error ? result.error.code : null,
    fixturePresence,
    exitObserved: isExitObserved,
    closeObserved: isCloseObserved,
    timedOut: isTimedOut,
    outputExceeded,
    rawNativeOutputReported: false,
    productionIntegrationVerified: false,
    fullE2eVerified: false,
  };
  if (!areNativeTerminalBoundariesUnchanged(boundaries, previousBoundaries)) {
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
    runRoot + "/result.json",
    JSON.stringify(observation) + "\n",
    {
      flag: "wx",
    },
  );
  console.log(JSON.stringify(observation));
  if (isSuccess) {
    if (!areNativeTerminalBoundariesUnchanged(boundaries, previousBoundaries)) {
      process.exitCode = 2;
      return;
    }
    fs.rmdirSync(runRoot + "/tmp");
    fs.unlinkSync(runRoot + "/started.json");
    fs.unlinkSync(runRoot + "/result.json");
    fs.rmdirSync(runRoot);
  }
  process.exitCode = isSuccess ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await runNativeTerminalNamespace();
}

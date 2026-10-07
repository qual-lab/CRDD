/**
 * 固定Native fixtureの実行と別読取りを所有する。
 *
 * @packageDocumentation
 * @responsibility Repository-local試験だけを一回起動し、exit、close、原記録と直接不存在を区別する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope Windows共有handleの同一・別Process局所実測。
 * @boundary Node→固定Native test binary。署名Runtimeと実Recoveryには接続しない。
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

/**
 * 試験境界のDirectory Identityを観測する。
 * @responsibility 共有cacheを含む前後比較へ通常Directoryの同一性を渡す。
 * @trace ERB-IT-001
 * @precondition 固定Repository内の正規絶対Pathを使用する。
 * @stimulus lstatとrealpathを読む。
 * @observation Directory、非symlink、実Path、dev/ino/birthtime。
 * @oracle 同名置換を前後一致としない。
 * @cleanup N/A: 同期読取りだけで新資源を生成しない。
 * @boundary Node→Windows filesystem metadata。
 */
export function nodeIdentity(target: string): string {
  const stat = fs.lstatSync(target, { bigint: true });
  assert.equal(stat.isDirectory(), true);
  assert.equal(stat.isSymbolicLink(), false);
  assert.equal(fs.realpathSync(target).replaceAll("\\", "/"), target);
  return `${stat.dev}:${stat.ino}:${stat.birthtimeNs}`;
}

/**
 * 前回試験の処置前に新しい領域を増やさない。
 *
 * @responsibility 残存と列挙不能を停止として返し、名前から削除許可を作らない。
 * @trace ERB-IT-001
 * @precondition 呼出し側がtests RootのRepository境界と実体を検証している。
 * @stimulus 直接の子名を一回列挙する。
 * @observation 前回run名の存在または列挙失敗。
 * @oracle 前回runが一件でもあれば新run作成前に拒否する。
 * @cleanup N/A: 読取りだけで、過去の状態や根拠を変更しない。
 * @boundary Node→検証済みtests Root。
 */
export function assertNoPreviousNativeRuns(testsRoot: string): void {
  assert.equal(
    fs
      .readdirSync(testsRoot)
      .some((name) => name.startsWith("native-protection-")),
    false,
    "previous_native_protection_run_requires_settlement",
  );
}

/**
 * 直接Build入力の前後一致を確認する。
 *
 * @responsibility Hash差と観測不能を完成条件へ伝え、未観測を一致にしない。
 * @trace ERB-IT-001
 * @precondition 呼出し側が固定した直接入力のPathとSHA-256を渡す。
 * @stimulus 全Fileを再読取りしてHashを比較する。
 * @observation 全入力一致、または不一致／読取り失敗。
 * @oracle 全入力一致だけをtrueとする。
 * @cleanup N/A: 同期read-only処理で新資源を作らない。
 * @boundary Node→固定されたBuild入力。
 */
export function areInputsUnchanged(
  inputs: readonly { file: string; sha256: string }[],
): boolean {
  return inputs.every(
    ({ file, sha256 }) =>
      createHash("sha256").update(fs.readFileSync(file)).digest("hex") ===
      sha256,
  );
}

/**
 * 正式な保護試験一件を自己生成対象へ実行する。
 *
 * @responsibility 静的確認、Build、拒否例、正常例と終了観測を順に接続する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition Windows、Repository Root cwd、前回runの処置完了。
 * @stimulus 一意なNative test実行物からexactな親と役割別Workerを起動する。
 * @observation 閉じた結果、入力Hash、終了と生成対象の不存在。
 * @oracle 共同成立条件だけを限定成功とし、署名や本番回復へ昇格しない。
 * @cleanup 生成物は正式記録後にフロントAIがexact回収する。失敗／中断は保持する。
 * @boundary Node→Cargo→Native親／子→Repository-local tests。
 */
async function runNativeProtection(): Promise<void> {
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
  for (const boundary of [repository, repository + "/.crdd"])
    nodeIdentity(boundary);
  const testsRoot = repository + "/.crdd/tests";
  if (presence(testsRoot) === "absent") fs.mkdirSync(testsRoot);
  nodeIdentity(testsRoot);
  assertNoPreviousNativeRuns(testsRoot);
  const run = "native-protection-" + randomUUID();
  const runRoot = testsRoot + "/" + run;
  fs.mkdirSync(runRoot);
  nodeIdentity(runRoot);
  fs.writeFileSync(
    path.join(runRoot, "started.json"),
    JSON.stringify({
      contract: "crdd-coordinator/native-protection-probe-started",
      contractRevision: 1,
      run,
      startedAt: new Date().toISOString(),
      status: "started",
    }) + "\n",
    { flag: "wx" },
  );
  console.log(JSON.stringify({ event: "native_protection_started", run }));
  fs.mkdirSync(runRoot + "/tmp");
  const source =
    repository +
    "/40_Develop/platform-access/tests/fixtures/windows_protection.rs";
  const exactTest =
    "filesystem::host_record::protection_tests::terminal_protection_fixture_observes_handle_sharing";
  const crateRoot = repository + "/40_Develop/platform-access";
  const buildRoot = crateRoot + "/target";
  nodeIdentity(crateRoot);
  if (presence(buildRoot) === "absent") fs.mkdirSync(buildRoot);
  const buildBoundaryBefore = [crateRoot, buildRoot].map(nodeIdentity);
  const sources = [
    crateRoot + "/Cargo.toml",
    crateRoot + "/Cargo.lock",
    crateRoot + "/build.rs",
    crateRoot + "/rust-toolchain.toml",
  ];
  for (const directory of [crateRoot + "/src", crateRoot + "/tests"]) {
    const files = fs.readdirSync(directory, {
      recursive: true,
      encoding: "utf8",
    });
    for (const file of files.filter((file) => file.endsWith(".rs")))
      sources.push(path.join(directory, file));
  }
  const sourceInputHashes = sources.sort().map((file) => ({
    file,
    sha256: createHash("sha256").update(fs.readFileSync(file)).digest("hex"),
  }));
  /**
   * 固定Native入力の既存lintだけを同期起動する。
   * @responsibility argv、期限、出力上限と終了判定を変更しない。
   * @trace ERB-IT-001
   * @precondition 親が入力とrunを固定済み。
   * @stimulus 固定Cargo clippyを要求する。
   * @observation 既存spawnSync結果。
   * @oracle 親がerror/statusを判定する。
   * @cleanup 親runの既存保持契約に従う。
   * @boundary Node→固定Cargo CLI。
   */
  function lintNativeProtectionArtifact() {
    return spawnSync(
      "cargo",
      [
        "+1.94.1-x86_64-pc-windows-msvc",
        "clippy",
        "--manifest-path",
        crateRoot + "/Cargo.toml",
        "--frozen",
        "--bin",
        "crdd-platform-access",
        "--tests",
        "--target",
        "x86_64-pc-windows-msvc",
        "--target-dir",
        buildRoot,
        "--",
        "-D",
        "warnings",
      ],
      {
        cwd: repository,
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
  }
  const nativeLint = lintNativeProtectionArtifact();
  assert.equal(nativeLint.error, undefined, "native_lint_unconfirmed");
  assert.equal(nativeLint.status, 0, "native_lint_failed");
  /**
   * 固定Native試験Buildだけを同期起動する。
   * @responsibility 固定入力、argvと生成物の既存境界を維持する。
   * @trace ERB-IT-001
   * @precondition 親が入力とrunを固定済み。
   * @stimulus 固定Cargo testのno-run Buildを要求する。
   * @observation 既存spawnSync結果とJSON artifact情報。
   * @oracle 親が終了値と一意なartifactを判定する。
   * @cleanup 親runの既存保持契約に従う。
   * @boundary Node→固定Cargo CLI。
   */
  function buildNativeProtectionArtifact() {
    return spawnSync(
      "cargo",
      [
        "+1.94.1-x86_64-pc-windows-msvc",
        "test",
        "--manifest-path",
        crateRoot + "/Cargo.toml",
        "--frozen",
        "--bin",
        "crdd-platform-access",
        "--target",
        "x86_64-pc-windows-msvc",
        "--no-run",
        "--message-format=json",
        "--target-dir",
        buildRoot,
      ],
      {
        cwd: repository,
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 180_000,
        maxBuffer: 4 * 1024 * 1024,
      },
    );
  }
  const build = buildNativeProtectionArtifact();
  assert.equal(build.error, undefined, "native_build_unconfirmed");
  assert.equal(build.status, 0, "native_build_failed");
  const artifacts: string[] = [];
  for (const line of build.stdout.trim().split(/\r?\n/u)) {
    const message = JSON.parse(line);
    if (
      message.reason === "compiler-artifact" &&
      message.target?.name === "crdd-platform-access" &&
      message.target?.kind?.length === 1 &&
      message.target.kind[0] === "bin" &&
      message.profile?.test === true &&
      typeof message.executable === "string"
    ) {
      artifacts.push(message.executable.replaceAll("\\", "/"));
    }
  }
  assert.equal(artifacts.length, 1, "native_test_executable_not_unique");
  const binary = artifacts[0] as string;
  assert.equal(
    binary.startsWith(buildRoot + "/x86_64-pc-windows-msvc/debug/deps/"),
    true,
  );
  assert.deepEqual(
    [crateRoot, buildRoot].map(nodeIdentity),
    buildBoundaryBefore,
  );
  const executableStat = fs.lstatSync(binary);
  assert.equal(
    executableStat.isFile() &&
      !executableStat.isSymbolicLink() &&
      executableStat.nlink === 1,
    true,
  );
  assert.equal(fs.realpathSync.native(binary).replaceAll("\\", "/"), binary);
  const cacheAncestors: string[] = [];
  for (
    let ancestor = path.dirname(binary).replaceAll("\\", "/");
    ancestor !== crateRoot;
    ancestor = path.dirname(ancestor).replaceAll("\\", "/")
  ) {
    nodeIdentity(ancestor);
    cacheAncestors.push(ancestor);
  }

  /**
   * 同期読取りの明示不存在と不明を分ける。
   *
   * @responsibility ENOENT以外を不存在に畳まない。
   * @trace ERB-IT-001
   * @trace ERB-IT-002
   * @precondition 固定fixture二名だけを渡す。
   * @stimulus lstatを読む。
   * @observation absent、present、unknown。
   * @oracle ENOENTだけをabsentとする。
   * @cleanup N/A: read-onlyで削除を発行しない。
   * @boundary Node→Windows filesystem metadata。
   */
  function presence(target: string): "absent" | "present" | "unknown" {
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

  assert.equal(process.cwd().replaceAll("\\", "/"), repository);
  const boundaries = [
    repository,
    repository + "/40_Develop",
    crateRoot,
    buildRoot,
    ...cacheAncestors,
    `${repository}/.crdd`,
    `${repository}/.crdd/tests`,
    runRoot,
  ];
  const before = boundaries.map(nodeIdentity);
  const fixtureNames = ["fixture", "fixture-renamed"].map((name) =>
    path.join(runRoot, name),
  );
  assert.deepEqual(fixtureNames.map(presence), ["absent", "absent"]);
  const ownerFile = fileURLToPath(import.meta.url);
  const ownerSha256 = createHash("sha256")
    .update(fs.readFileSync(ownerFile))
    .digest("hex");
  const guardResults: {
    case: string;
    rejected: boolean;
    fixtureAbsent: boolean;
  }[] = [];
  const guardCases = [
    {
      case: "root_mismatch",
      root: repository,
      run,
      exe: binary,
      cwd: repository,
    },
    {
      case: "run_invalid",
      root: runRoot,
      run: "invalid",
      exe: binary,
      cwd: repository,
    },
    {
      case: "exe_mismatch",
      root: runRoot,
      run,
      exe: binary + ".other",
      cwd: repository,
    },
    { case: "cwd_mismatch", root: runRoot, run, exe: binary, cwd: runRoot },
  ];
  for (const guard of guardCases) {
    /**
     * 親の固定拒否ケースだけを同期実行する。
     * @responsibility 現在のguard閉包以外の入力を受けない。
     * @trace ERB-IT-002
     * @precondition 親が一意なNative artifactとguardを固定済み。
     * @stimulus 同じ固定試験を拒否条件で要求する。
     * @observation 既存spawnSync結果。
     * @oracle 親が拒否終了値とfixture不存在を判定する。
     * @cleanup 親の既存run終了条件を維持する。
     * @boundary Node→固定Native試験artifact。
     */
    function executeNativeProtectionGuard() {
      return spawnSync(
        binary,
        [exactTest, "--ignored", "--exact", "--nocapture", "--test-threads=1"],
        {
          cwd: guard.cwd,
          encoding: "utf8",
          shell: false,
          windowsHide: true,
          timeout: 30_000,
          maxBuffer: 65_536,
          env: {
            ...process.env,
            CRDD_NATIVE_PROTECTION_ROOT: guard.root,
            CRDD_NATIVE_PROTECTION_RUN: guard.run,
            CRDD_NATIVE_PROTECTION_EXE: guard.exe,
            TEMP: runRoot + "/tmp",
            TMP: runRoot + "/tmp",
          },
        },
      );
    }
    const attempt = executeNativeProtectionGuard();
    const rejected =
      attempt.error === undefined &&
      attempt.status === 101 &&
      /running 1 test/u.test(attempt.stdout) &&
      /0 passed; 1 failed;/u.test(attempt.stdout);
    const fixtureAbsent = fixtureNames
      .map(presence)
      .every((value) => value === "absent");
    guardResults.push({ case: guard.case, rejected, fixtureAbsent });
    assert.equal(rejected && fixtureAbsent, true, "native_guard_unconfirmed");
    assert.deepEqual(boundaries.map(nodeIdentity), before);
  }
  /**
   * 固定ゼロケース反例だけを同期実行する。
   * @responsibility ケース不足を成功と誤認しない既存Oracleを保持する。
   * @trace ERB-IT-002
   * @precondition 親が一意なNative artifactを固定済み。
   * @stimulus 存在しないexact test名を要求する。
   * @observation 既存spawnSync結果。
   * @oracle 親が0 testを正常1 testから区別する。
   * @cleanup 親の既存fixture不存在条件を維持する。
   * @boundary Node→固定Native試験artifact。
   */
  function executeNativeProtectionZeroCase() {
    return spawnSync(binary, [exactTest + ".missing", "--ignored", "--exact"], {
      cwd: repository,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      timeout: 30_000,
      maxBuffer: 65_536,
    });
  }
  const zeroCase = executeNativeProtectionZeroCase();
  assert.equal(zeroCase.error, undefined);
  assert.equal(zeroCase.status, 0);
  assert.match(zeroCase.stdout, /running 0 tests/u);
  assert.equal(/running 1 test/u.test(zeroCase.stdout), false);
  assert.deepEqual(fixtureNames.map(presence), ["absent", "absent"]);
  const sourceSha256 = createHash("sha256")
    .update(fs.readFileSync(source))
    .digest("hex");
  const binarySha256 = createHash("sha256")
    .update(fs.readFileSync(binary))
    .digest("hex");
  assert.equal(fs.lstatSync(binary).isSymbolicLink(), false);

  const started = Date.now();
  const child = spawn(
    binary,
    [exactTest, "--ignored", "--exact", "--nocapture", "--test-threads=1"],
    {
      cwd: repository,
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CRDD_NATIVE_PROTECTION_RUN: run,
        CRDD_NATIVE_PROTECTION_ROOT: runRoot,
        CRDD_NATIVE_PROTECTION_EXE: binary,
        TEMP: `${runRoot}/tmp`,
        TMP: `${runRoot}/tmp`,
      },
    },
  );
  let stopped = false;
  let timedOut = false;
  const stop = () => {
    stopped = true;
    child.kill();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  const deadline = setTimeout(() => {
    timedOut = true;
    stop();
  }, 30_000);
  let bytes = 0;
  let output = "";
  let outputExceeded = false;
  let errorObserved = false;
  let exitObserved = false;
  let exitCode: number | null = null;
  let exitSignal: NodeJS.Signals | null = null;
  for (const stream of [child.stdout, child.stderr]) {
    stream.on("data", (value: Buffer) => {
      bytes += value.length;
      if (bytes > 65536) {
        outputExceeded = true;
        stop();
      } else {
        output += value.toString("utf8");
      }
    });
  }
  child.on("error", () => {
    errorObserved = true;
  });
  child.on("exit", (code, signal) => {
    exitObserved = true;
    exitCode = code;
    exitSignal = signal;
  });
  await new Promise<void>((resolve) => {
    child.once("close", () => resolve());
  });
  const closeObserved = true;
  clearTimeout(deadline);
  process.removeListener("SIGINT", stop);
  process.removeListener("SIGTERM", stop);
  const matching = output
    .split(/\r?\n/u)
    .filter((line) =>
      line.startsWith('{"contract":"crdd-native/terminal-protection-fixture"'),
    );
  let native: unknown = null;
  let parseConfirmed = false;
  if (!outputExceeded && matching.length === 1) {
    try {
      native = JSON.parse(matching[0] ?? "");
      parseConfirmed = true;
    } catch {
      /* No raw Native output is emitted. */
    }
  }
  const reasons = new Set([
    "fixed_fixture_verified",
    "token_unavailable",
    "user_unavailable",
    "system_unavailable",
    "descriptor_creation_failed",
    "creation_cutoff_or_parent_changed",
    "directory_creation_failed",
    "directory_hold_failed",
    "file_creation_cutoff",
    "file_creation_failed",
    "creation_handle_close_unknown",
    "counterexample_cutoff",
    "child_write_open_failed",
    "child_write_or_close_failed",
    "directory_rename_cutoff",
    "directory_rename_oracle_failed",
    "file_hold_failed",
    "child_read_open_failed",
    "read_or_close_failed",
    "unexpected_access_granted",
    "wrong_access_rejection",
    "rename_cutoff",
    "file_delete_oracle_failed",
    "file_rename_cutoff",
    "file_rename_oracle_failed",
    "fresh_identity_or_cutoff_failed",
    "receipts_missing",
    "after_close_write_failed",
    "after_close_handle_unknown",
    "file_rename_positive_cutoff",
    "after_close_file_rename_failed",
    "file_restore_cutoff",
    "file_restore_failed",
    "directory_rename_positive_cutoff",
    "after_close_directory_rename_failed",
    "directory_restore_cutoff",
    "directory_restore_failed",
    "cleanup_identity_or_cutoff_failed",
    "file_cleanup_failed",
    "file_absence_unconfirmed",
    "directory_cleanup_identity_or_cutoff_failed",
    "directory_cleanup_failed",
    "directory_absence_unconfirmed",
    "panic_or_handle_close_unknown",
    "identity_open_failed",
    "identity_observation_failed",
    "identity_or_close_unconfirmed",
    "descriptor_unavailable",
    "descriptor_mismatch",
    "ace_count_mismatch",
    "ace_unavailable",
    "ace_shape_mismatch",
    "ace_access_mismatch",
    "ace_sid_unavailable",
    "ace_principal_mismatch",
    "descriptor_free_unconfirmed",
    "worker_role_invalid",
    "worker_executable_mismatch",
    "worker_start_cutoff",
    "worker_start_not_issued",
    "worker_start_unissued_cleanup_unknown",
    "worker_start_failed_cleanup_confirmed",
    "worker_start_failed_cleanup_unknown",
    "worker_exit_cleanup_unknown",
    "worker_timeout_cleanup_unknown",
    "worker_cancel_cleanup_unknown",
    "worker_observation_cleanup_unknown",
    "worker_unexpected_exit_cleanup_confirmed",
    "worker_timeout_cleanup_confirmed",
    "worker_cancel_cleanup_confirmed",
    "worker_observation_cleanup_confirmed",
  ]);
  const phases = new Set([
    "preflight",
    "directory_creation",
    "file_creation",
    "directory_only_counterexample",
    "file_hold",
    "held_worker",
    "after_close_positive",
    "released_worker",
    "cleanup",
  ]);
  const nativeSupported =
    parseConfirmed &&
    typeof native === "object" &&
    native !== null &&
    "contract" in native &&
    native.contract === "crdd-native/terminal-protection-fixture" &&
    "revision" in native &&
    native.revision === 2 &&
    "run" in native &&
    native.run === run &&
    "status" in native &&
    (native.status === "observed" || native.status === "failed_retained") &&
    "reason" in native &&
    typeof native.reason === "string" &&
    reasons.has(native.reason) &&
    "phase" in native &&
    typeof native.phase === "string" &&
    phases.has(native.phase) &&
    "fixtureHandleClosuresConfirmed" in native &&
    typeof native.fixtureHandleClosuresConfirmed === "boolean" &&
    "heldWorkerVerified" in native &&
    typeof native.heldWorkerVerified === "boolean" &&
    "releasedWorkerVerified" in native &&
    typeof native.releasedWorkerVerified === "boolean" &&
    "productionIntegrationVerified" in native &&
    native.productionIntegrationVerified === false &&
    "separateProcessProtectionVerified" in native &&
    typeof native.separateProcessProtectionVerified === "boolean" &&
    "strictDeadlineClaimed" in native &&
    native.strictDeadlineClaimed === false &&
    Object.keys(native).length === 12;
  const nativeRecord = nativeSupported
    ? (native as {
        status: "observed" | "failed_retained";
        reason: string;
        phase: string;
        fixtureHandleClosuresConfirmed: boolean;
        heldWorkerVerified: boolean;
        releasedWorkerVerified: boolean;
        separateProcessProtectionVerified: boolean;
      })
    : null;
  const nativeConfirmed =
    nativeRecord !== null &&
    nativeRecord.status === "observed" &&
    nativeRecord.reason === "fixed_fixture_verified" &&
    nativeRecord.phase === "cleanup" &&
    nativeRecord.fixtureHandleClosuresConfirmed &&
    nativeRecord.heldWorkerVerified &&
    nativeRecord.releasedWorkerVerified &&
    nativeRecord.separateProcessProtectionVerified;
  const failureConfirmed =
    nativeRecord !== null &&
    nativeRecord.status === "failed_retained" &&
    nativeRecord.reason !== "fixed_fixture_verified" &&
    !nativeRecord.fixtureHandleClosuresConfirmed &&
    !nativeRecord.separateProcessProtectionVerified;
  const after = boundaries.map(nodeIdentity);
  const fixturePresence = fixtureNames.map(presence);
  const sourceInputsUnchanged = areInputsUnchanged(sourceInputHashes);
  const caseCountConfirmed =
    /running 1 test/u.test(output) &&
    /test result: ok\. 1 passed; 0 failed;/u.test(output);
  const inputUnchanged =
    ownerSha256 ===
      createHash("sha256").update(fs.readFileSync(ownerFile)).digest("hex") &&
    sourceInputsUnchanged &&
    sourceSha256 ===
      createHash("sha256").update(fs.readFileSync(source)).digest("hex") &&
    binarySha256 ===
      createHash("sha256").update(fs.readFileSync(binary)).digest("hex");
  const boundaryUnchanged =
    JSON.stringify(before) === JSON.stringify(after) &&
    JSON.stringify(buildBoundaryBefore) ===
      JSON.stringify([crateRoot, buildRoot].map(nodeIdentity));
  const completed =
    nativeConfirmed &&
    caseCountConfirmed &&
    !stopped &&
    !timedOut &&
    exitObserved &&
    closeObserved &&
    exitCode === 0 &&
    exitSignal === null &&
    !errorObserved &&
    !outputExceeded &&
    inputUnchanged &&
    boundaryUnchanged &&
    fixturePresence.every((value) => value === "absent");
  const result = {
    contract: "crdd-coordinator/native-protection-probe-result",
    contractRevision: 3,
    ownerSha256,
    guardResults,
    zeroCaseRejectedAsPass: true,
    run,
    startedAt: new Date(started).toISOString(),
    completedAt: new Date().toISOString(),
    caseCountConfirmed,
    timedOut,
    stopped,
    sourceInputs: sourceInputHashes.map(({ file, sha256 }) => ({
      path: path.relative(repository, file).replaceAll("\\", "/"),
      sha256,
    })),
    status: completed ? "observed" : "failed_or_unconfirmed",
    nativeObservation:
      nativeRecord !== null && (nativeConfirmed || failureConfirmed)
        ? {
            status: nativeRecord.status,
            reason: nativeRecord.reason,
            phase: nativeRecord.phase,
            fixtureHandleClosuresConfirmed:
              nativeRecord.fixtureHandleClosuresConfirmed,
            heldWorkerVerified: nativeRecord.heldWorkerVerified,
            releasedWorkerVerified: nativeRecord.releasedWorkerVerified,
            productionIntegrationVerified: false,
            separateProcessProtectionVerified:
              nativeRecord.separateProcessProtectionVerified,
            strictDeadlineClaimed: false,
          }
        : null,
    nativeFailureConfirmed: failureConfirmed,
    sourceSha256,
    binarySha256,
    inputUnchanged,
    nodeBoundaryUnchanged: boundaryUnchanged,
    nativeAndNodeIdentitiesEquated: false,
    exitObserved,
    closeObserved,
    exitCode,
    exitSignal,
    errorObserved,
    outputExceeded,
    outputBytes: bytes,
    fixturePresence,
    durationMilliseconds: Date.now() - started,
    rawNativeOutputReported: false,
    productionIntegrationVerified: false,
    hardDeadlineGuaranteeClaimed: false,
    parentProcessLossVerified: false,
  };
  fs.writeFileSync(
    path.join(runRoot, "result.json"),
    JSON.stringify(result, null, 2) + "\n",
    { flag: "wx" },
  );
  console.log(JSON.stringify(result));
  process.exitCode = completed ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await runNativeProtection();
}

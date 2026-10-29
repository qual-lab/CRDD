/**
 * 抽出したDocker隔離Ownerを実Windows Dockerで確認する。
 *
 * @packageDocumentation
 * @responsibility 固定CLI・本番下位Runtimeによる実資源の構成と回収を観測する。
 * @trace ERB-IT-002
 * @trace ERB-IT-017
 * @trace ERB-IT-031
 * @level IT
 * @scope 実Dockerの三Container・二Network、既存認証記録と別Process再入場、公式Imageの版・Hash。AI依頼・認証・Desktop修復は含めない。
 * @boundary Host Process→Docker Engine→資源不存在。
 */
import { planProviderExecution } from "../../../ai-adapter/src/index.ts";
import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { describeProviderAuthentication } from "../../../ai-adapter/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  createProviderAuthenticationDependencies,
  createProviderAuthenticationPlan,
  createProviderAuthenticationRecoveryRecord,
  readProviderAuthenticationResources,
} from "../../src/execution/authority.ts";
import {
  createDockerIsolationRuntime,
  createDockerAuthenticationRuntimeFactory,
  createDockerProcessEnvironment,
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
  planDockerAuthenticationCommands,
  planDockerAuthenticationResourceRecovery,
  type DockerAuthenticationInput,
  type DockerIsolationRuntimePlan,
  type DockerResourceReceipts,
} from "../../../docker-isolation/src/index.ts";
import { describeDockerProviderExecutionLocations } from "../../../docker-isolation/src/index.ts";
import { describeDockerProviderAssets } from "../../../docker-isolation/src/index.ts";

import buildInputs from "../../../docker-isolation/images/build-inputs.json" with {
  type: "json",
};

/**
 * 固定編集CLIの引数受付と三Mountの書込み境界を外部AIなしで確認する。
 * @responsibility 起動前の拒否とProvider依頼を分離し、元IDで試験物を回収する。
 * @trace ERB-IT-031
 * @precondition 明示承認済み、起動中Engine、取得済み固定Image。
 * @stimulus 通常Entrypointのexec --helpと、別Containerの固定Python一回。
 * @observation 数値終了、固定エラー分類、構成、合成Sourceと保護領域。
 * @oracle none・資格Mountなし・非root・readonly Rootを維持し、自己資源不存在。
 * @cleanup 元ID・Label・Image・構成を確認したContainerだけ削除。不明時はRoot保持。
 * @boundary ヘルプ成功は実Task・認証・モデル利用可能の証明ではない。
 */
test("Windows Process Gate: Codex編集CLI起動と借用三Mountを無通信で確認する", {
  timeout: 120_000,
}, () => {
  const repository = path.resolve(
    fileURLToPath(new URL("../../../../", import.meta.url)),
  );
  assert.equal(verifyRepositoryRoot(repository).status, "completed");
  const parent = path.join(repository, ".crdd", "tests");
  for (const directory of [path.join(repository, ".crdd"), parent]) {
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    assert.equal(fs.realpathSync.native(directory), directory);
  }
  const plan =
    planProviderExecution(
      {
        provider: "codex",
        purpose: "task",
        modelSelection: {
          provider: "codex",
          modelIdentifier: "gpt-5.5",
          identifierKind: "exact",
          reasoningEffort: "low",
        },
        input: {
          provider: "codex",
          mode: "isolated_task",
          effort: "low",
          taskRole: "executor",
        },
      },
      describeDockerProviderExecutionLocations("codex", "task"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  assert.equal(plan.status, "candidate");
  if (plan.status !== "candidate") throw new Error("probe_plan_unavailable");
  const image = describeDockerProviderAssets("codex").fixedImageDigest;
  const snapshot = observeTrustedDockerCli();
  const env = createDockerProcessEnvironment();
  /**
   * 信頼を前後再確認して固定Engineへ試験用Docker要求を出す。
   * @responsibility 信頼を前後再確認して固定Engineへ試験用Docker要求を出す。
   * @trace ERB-IT-031
   * @precondition 明示許可されたHost試験と検証済みCLI観測。
   * @stimulus 固定npipe・中立環境・有限出力と期限で同期実行する。
   * @observation 終了値、signal、error、stdoutと前後CLI観測。
   * @oracle CLI同一性の差や失敗を呼出し元が成功へ畳まない。
   * @cleanup 作成資源はCaseがexact構成照合後に回収する。
   * @boundary 明示Host経路だけ実Docker。通常回帰では呼ばない。
   */
  const docker = (args: string[]) => {
    const result = spawnSync(
      verifyTrustedDockerCliSnapshot(snapshot),
      ["--host", "npipe:////./pipe/dockerDesktopLinuxEngine", ...args],
      {
        env,
        encoding: "utf8",
        windowsHide: true,
        shell: false,
        timeout: 20_000,
        maxBuffer: 65_536,
      },
    );
    verifyTrustedDockerCliSnapshot(snapshot);
    return result;
  };
  /**
   * Docker要求の正常終了を確認して標準出力を渡す。
   * @responsibility Docker要求の正常終了を確認して標準出力を渡す。
   * @trace ERB-IT-031
   * @precondition 同Caseの固定Docker実行関数。
   * @stimulus 要求を発行しerror・signal・statusを検査する。
   * @observation 正常終了のstdout。
   * @oracle errorなし・signalなし・status0だけ受理する。
   * @cleanup 資源の不存在確認はCaseのfinallyが所有する。
   * @boundary Host試験の同期CLI終了。終了0だけで回収を推定しない。
   */
  const completed = (args: string[]) => {
    const result = docker(args);
    assert.equal(result.error, undefined, "probe_command_error");
    assert.equal(result.signal, null, "probe_command_signalled");
    assert.equal(result.status, 0, "probe_command_failed");
    return result.stdout;
  };
  completed(["version", "--format", "{{.Server.Version}}"]);
  assert.equal(JSON.parse(completed(["image", "inspect", image]))[0].Id, image);
  const directory = fs.mkdtempSync(path.join(parent, "codex-startup-"));
  const tree = path.join(directory, "tree");
  const git = path.join(directory, "git-protection");
  const internal = path.join(directory, "internal-protection");
  for (const entry of [
    tree,
    git,
    internal,
    path.join(tree, ".git"),
    path.join(tree, ".crdd"),
  ])
    fs.mkdirSync(entry);
  fs.writeFileSync(path.join(tree, "source.txt"), "BASE\n");
  const label = `crdd.coordinator.startup-probe=${randomBytes(12).toString("hex")}`;
  const [labelKey, labelValue] = label.split("=");
  assert.ok(labelKey && labelValue);
  const resources: {
    id: string | null;
    name: string;
    removed: boolean;
    argv: string[];
    python: boolean;
  }[] = [];
  const observations: Record<string, unknown>[] = [];
  let primaryFailure: string | null = null;
  let cleanupFailure: string | null = null;
  const inspect = (resource: (typeof resources)[number]) => {
    assert.ok(resource.id);
    const value = JSON.parse(
      completed(["container", "inspect", resource.id]),
    )[0];
    assert.equal(value.Id, resource.id);
    assert.equal(value.Name, `/${resource.name}`);
    assert.equal(value.Image, image);
    assert.equal(value.Config.Labels[labelKey], labelValue);
    assert.equal(value.Config.User, "65534:65534");
    assert.equal(value.Config.WorkingDir, "/work");
    assert.deepEqual(value.Config.Cmd, resource.argv);
    assert.deepEqual(value.Config.Entrypoint, [
      resource.python ? "/usr/local/bin/python3" : plan.command,
    ]);
    assert.equal(value.HostConfig.NetworkMode, "none");
    assert.equal(value.HostConfig.ReadonlyRootfs, true);
    assert.equal(value.HostConfig.Privileged, false);
    assert.deepEqual(value.HostConfig.Tmpfs, {
      "/tmp": "rw,nosuid,nodev,size=16m",
    });
    assert.deepEqual(value.HostConfig.CapDrop, ["ALL"]);
    assert.ok(value.HostConfig.SecurityOpt.includes("no-new-privileges"));
    assertStartupProbeMounts(value.Mounts, tree, git, internal);
    return value;
  };
  const python = [
    "import errno,json",
    "with open('/work/source.txt','w') as f: f.write('PROBE_OK\\n')",
    "for target in ['/work/.git/probe','/work/.crdd/probe']:",
    " try:",
    "  with open(target,'w') as f: f.write('forbidden')",
    " except OSError as e:",
    "  assert e.errno in [errno.EROFS,errno.EACCES,errno.EPERM]",
    " else: raise RuntimeError('protected_write_succeeded')",
    "print(json.dumps({'sourceWrite':True,'gitWriteDenied':True,'internalWriteDenied':True}))",
  ].join("\n");
  try {
    for (const isPython of [false, true]) {
      const argv = isPython
        ? ["-c", python]
        : [...plan.argv.slice(0, -1), "--help"];
      const resource = {
        id: null as string | null,
        name: `crdd-startup-${randomBytes(12).toString("hex")}`,
        removed: false,
        argv,
        python: isPython,
      };
      resources.push(resource);
      fs.writeFileSync(
        path.join(directory, "resources.json"),
        JSON.stringify({ image, label, resources }),
      );
      const created = docker([
        "create",
        "--pull=never",
        "--name",
        resource.name,
        "--label",
        label,
        "--network",
        "none",
        "--read-only",
        "--user",
        "65534:65534",
        "--cap-drop",
        "ALL",
        "--security-opt",
        "no-new-privileges",
        "--tmpfs",
        "/tmp:rw,nosuid,nodev,size=16m",
        "--mount",
        `type=bind,src=${tree},dst=/work`,
        "--mount",
        `type=bind,src=${git},dst=/work/.git,readonly`,
        "--mount",
        `type=bind,src=${internal},dst=/work/.crdd,readonly`,
        ...(isPython ? ["--entrypoint", "/usr/local/bin/python3"] : []),
        image,
        ...argv,
      ]);
      assert.equal(created.error, undefined, "probe_create_error");
      assert.equal(created.status, 0, "probe_create_failed");
      assert.match(
        created.stdout.trim(),
        /^[a-f0-9]{64}$/u,
        "probe_create_identity_unknown",
      );
      resource.id = created.stdout.trim();
      fs.writeFileSync(
        path.join(directory, "resources.json"),
        JSON.stringify({ image, label, resources }),
      );
      inspect(resource);
      const result = docker(["start", "--attach", resource.id]);
      const after = inspect(resource);
      observations.push({
        purpose: isPython ? "three_mount_python" : "codex_exec_help",
        dockerExitCode: result.status,
        containerExitCode: after.State.ExitCode,
        signal: result.signal,
        stdoutBytes: Buffer.byteLength(result.stdout),
        stderrBytes: Buffer.byteLength(result.stderr),
        argumentRejected:
          /unexpected (?:argument|option)|unknown (?:argument|option)|invalid (?:argument|option)/iu.test(
            result.stderr,
          ),
        errorMentionsApproveForMe: result.stderr.includes("--approve-for-me"),
        helpDisplayed: !isPython && /Usage:|USAGE:/u.test(result.stdout),
        ...(isPython && result.status === 0
          ? { mountResult: JSON.parse(result.stdout) }
          : {}),
      });
      assert.equal(result.error, undefined, "probe_start_observation_error");
      assert.equal(result.signal, null, "probe_start_signalled");
      assert.ok(Number.isInteger(result.status), "probe_exit_unobserved");
      assert.equal(after.State.Running, false, "probe_still_running");
      completed(["rm", resource.id]);
      const absent = docker(["container", "inspect", resource.id]);
      assert.equal(absent.status, 1);
      assert.match(absent.stderr, /No such (?:object|container)/iu);
      resource.removed = true;
      if (isPython) {
        assert.equal(result.status, 0, "probe_mount_execution_failed");
        assert.equal(
          fs.readFileSync(path.join(tree, "source.txt"), "utf8"),
          "PROBE_OK\n",
        );
      }
      // ヘルプの拒否も観測結果として残し、別のAI起動や引数変更はしない。
    }
  } catch (error) {
    primaryFailure =
      error instanceof Error
        ? (error.message.split("\n")[0] ?? "probe_failed")
        : "probe_failed";
  } finally {
    for (const resource of resources.filter(
      (r) => !r.removed && r.id !== null,
    )) {
      try {
        const value = inspect(resource);
        if (value.State.Running) {
          cleanupFailure = "probe_still_running";
          continue;
        }
        completed(["rm", resource.id as string]);
        const absent = docker(["container", "inspect", resource.id as string]);
        assert.equal(absent.status, 1);
        assert.match(absent.stderr, /No such (?:object|container)/iu);
        resource.removed = true;
      } catch {
        cleanupFailure = "probe_container_cleanup_unconfirmed";
      }
    }
    const clean =
      cleanupFailure === null &&
      resources.every((r) => r.id !== null && r.removed);
    const report: Record<string, unknown> = {
      contract: "crdd/codex-offline-startup-probe",
      image,
      observations,
      primaryFailure,
      cleanupFailure,
      resourcesRemoved: clean,
      externalAiRequested: false,
      credentialsMounted: false,
      fullE2eVerified: false,
      rootRemoved: false,
    };
    try {
      fs.writeFileSync(
        path.join(directory, "result.json"),
        JSON.stringify(report, null, 2),
      );
    } catch {
      cleanupFailure ??= "probe_result_save_failed";
    }
    if (clean && cleanupFailure === null) {
      try {
        assert.equal(fs.realpathSync.native(directory), directory);
        assert.equal(path.dirname(directory), parent);
        fs.rmSync(directory, { recursive: true, force: true });
        report.rootRemoved = !fs.existsSync(directory);
        if (report.rootRemoved !== true)
          cleanupFailure = "probe_root_removal_unconfirmed";
      } catch {
        cleanupFailure = "probe_root_removal_failed";
      }
    }
    report.cleanupFailure = cleanupFailure;
    console.log(JSON.stringify(report));
  }
  assert.equal(cleanupFailure, null);
  assert.equal(primaryFailure, null);
  assert.equal(
    resources.every((r) => r.removed),
    true,
  );
});

/**
 * 元の合成三領域へのbindだけを受理する。
 * @responsibility Destinationの一致だけで別Sourceを回収対象にしない。
 * @trace ERB-IT-031
 * @precondition 既存Engineのinspect値と元作成Path。
 * @stimulus bind構成を照合する。
 * @observation 不一致時はthrowし後続rmへ進まない。
 * @oracle 種別・Source・Destination・RW全件一致。
 * @cleanup N/A: 純粋判定。
 * @boundary 既存inspect結果の純粋照合。Container削除要求自体は呼出し側が所有する。
 */
function assertStartupProbeMounts(
  value: unknown,
  tree: string,
  git: string,
  internal: string,
) {
  assert.ok(Array.isArray(value));
  assert.ok(
    value.every(
      (m) =>
        m.Type === "bind" || (m.Type === "tmpfs" && m.Destination === "/tmp"),
    ),
  );
  assert.deepEqual(
    value
      .filter((m) => m.Type === "bind")
      .map((m) => [m.Type, m.Source, m.Destination, m.RW])
      .sort((a, b) => String(a[2]).localeCompare(String(b[2]))),
    [
      ["bind", tree, "/work", true],
      ["bind", internal, "/work/.crdd", false],
      ["bind", git, "/work/.git", false],
    ],
  );
}

/**
 * 起動欠測と清掃失敗を実試験器の制御断面で反証する。
 * @trace ERB-IT-031
 * @precondition 合成inspectのみ。Dockerなし。
 * @stimulus error／Signal／終了値欠測と結果保存・Root削除失敗。
 * @observation 後続作成代役と終了report。
 * @oracle 次Container作成0、一次理由保持、清掃失敗別記録、削除未確認を成功にしない。
 * @cleanup N/A: 外部資源なし。
 * @responsibility 起動終了の欠測で次の作成を止め、一次失敗と保存・回収失敗を分離する。
 * @boundary 本番試験器のtry/finally本文をVMで評価し、実Dockerは呼ばない。
 */
test("起動確認は終了欠測で次Containerへ進まず清掃失敗を一次へ上書きしない", () => {
  const source = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  const start = source.indexOf(
    '      assert.equal(result.error, undefined, "probe_start_observation_error");',
  );
  const end = source.indexOf("      assert.equal(after.State.Running", start);
  assert.ok(start > 0 && end > start);
  const guard = source.slice(start, end);
  for (const result of [
    { error: new Error("fixture"), signal: null, status: null },
    { error: undefined, signal: "SIGTERM", status: null },
    { error: undefined, signal: null, status: null },
  ]) {
    let creates = 0;
    assert.throws(() =>
      runInNewContext(`${guard}\nnext();`, {
        assert,
        result,
        next: () => creates++,
      }),
    );
    assert.equal(creates, 0);
  }
  const reportStart = source.indexOf("    const clean =", end);
  const reportEnd = source.indexOf(
    "\n  }\n  assert.equal(cleanupFailure",
    reportStart,
  );
  assert.ok(reportStart > end && reportEnd > reportStart);
  const block = stripTypeScriptTypes(source.slice(reportStart, reportEnd));
  for (const failure of ["none", "save", "remove", "remains"]) {
    let report: Record<string, unknown> | undefined;
    const primaryFailure = failure === "none" ? null : "original_start_failure";
    runInNewContext(`let cleanupFailure = null; ${block}`, {
      primaryFailure,
      resources: [{ id: "fixture", removed: true }],
      image: "fixture",
      observations: [],
      directory: "C:\\fixture\\probe",
      parent: "C:\\fixture",
      path,
      assert,
      fs: {
        writeFileSync() {
          if (failure === "save") throw new Error("fixture");
        },
        realpathSync: { native: (p: string) => p },
        rmSync() {
          if (failure === "remove") throw new Error("fixture");
        },
        existsSync: () => failure === "remains",
      },
      console: {
        log: (value: string) => {
          report = JSON.parse(value);
        },
      },
    });
    assert.ok(report);
    assert.equal(report.primaryFailure, primaryFailure);
    assert.equal(report.rootRemoved, failure === "none");
    assert.equal(report.cleanupFailure === null, failure === "none");
  }
});

/**
 * 構成差で処置へ進まない有限反例。
 * @trace ERB-IT-031
 * @precondition 合成inspectのみ。Dockerなし。
 * @stimulus 同じDestinationの別Source・別種別・書込み可否差。
 * @observation 削除代役の呼出し数。
 * @oracle すべて拒否しrm0。
 * @cleanup N/A: 外部資源なし。
 * @responsibility 元ContainerのMount Sourceが変われば回収要求0とする。
 * @boundary inspect構成の有限代役。実Containerを削除しない。
 */
test("起動確認のMount照合はSource差替えで削除へ進まない", () => {
  const mounts = [
    { Type: "bind", Source: "tree", Destination: "/work", RW: true },
    { Type: "bind", Source: "git", Destination: "/work/.git", RW: false },
    { Type: "bind", Source: "internal", Destination: "/work/.crdd", RW: false },
  ];
  assertStartupProbeMounts(mounts, "tree", "git", "internal");
  let removes = 0;
  for (const change of [
    { Source: "other" },
    { Type: "volume" },
    { RW: false },
  ]) {
    assert.throws(() => {
      assertStartupProbeMounts(
        [{ ...mounts[0], ...change }, ...mounts.slice(1)],
        "tree",
        "git",
        "internal",
      );
      removes++;
    });
  }
  assert.equal(removes, 0);
});

/**
 * 公式配置物の二つの観測を同じ実Imageへ結合する。
 * @responsibility 通常入口の版表示と別の三実行物Hashを混同せず判定する。
 * @trace ERB-IT-031
 * @precondition 観測は認証情報のない固定版表示とHash専用Processから取得する。
 * @stimulus 元終了値・Signal・出力上限と本文、両Containerの実Image IDを渡す。
 * @observation 版、三Hash、Image一致、元Warning。
 * @oracle 公式配布Identityに完全一致し、警告を消去しない。
 * @cleanup N/A: 純粋判定で資源を取得しない。
 * @boundary ERB-IT-031=固定Imageの二観測から試験結果への投影。
 */
function assertAdviceImageObservation(
  version: Readonly<{
    status: number | null;
    signal: string | null;
    error?: unknown;
    stdout: string;
    stderr: string;
  }>,
  hashes: Readonly<{
    status: number | null;
    signal: string | null;
    error?: unknown;
    stdout: string;
    stderr: string;
  }>,
  versionImageId: string,
  hashesImageId: string,
) {
  const expected = {
    ...buildInputs.codex.identity,
    ...buildInputs.codex.adviceIdentity,
    ...describeDockerProviderAssets("codex").adviceIdentity,
  };
  for (const result of [version, hashes]) {
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    assert.ok(Buffer.byteLength(result.stdout, "utf8") <= 16_384);
    assert.ok(Buffer.byteLength(result.stderr, "utf8") <= 16_384);
  }
  assert.equal(versionImageId, expected.fixedImageDigest);
  assert.equal(hashesImageId, versionImageId);
  assert.equal(version.stdout.trim(), `codex-cli ${expected.exactVersion}`);
  const observed: unknown = JSON.parse(hashes.stdout);
  assert.deepEqual(observed, {
    [expected.executablePath]: expected.binarySha256,
    [expected.hostExecutablePath]: expected.hostBinarySha256,
    [expected.bwrapBinaryPath]: expected.bwrapBinarySha256,
  });
  return Object.freeze({
    imageId: versionImageId,
    exactVersion: expected.exactVersion,
    versionWarnings: version.stderr,
    hashProbeWarnings: hashes.stderr,
  });
}

/**
 * 配布観測の版・Hash・Image・Warningの対応を反証する。
 * @responsibility 部分成功や出力欠測を公式配置物成立へ変換しない。
 * @trace ERB-IT-031
 * @precondition メモリ上の固定観測だけを使う。
 * @stimulus 版・各Hash・項目数・Image・終了値・Signal・JSON・容量を変える。
 * @observation 拒否と警告の厳密保持。
 * @oracle 各単独故障を拒否し、警告ありの正常観測はそのまま返す。
 * @cleanup N/A: Process・Filesystem・Docker操作なし。
 * @boundary ERB-IT-031=実境界試験の判定部分だけ。実Imageの存在は証明しない。
 */
test("公式助言Imageの観測Oracleは三Hash・版・実Imageと警告を分離する", () => {
  const identity = {
    ...buildInputs.codex.identity,
    ...buildInputs.codex.adviceIdentity,
    ...describeDockerProviderAssets("codex").adviceIdentity,
  };
  const values: Record<string, string> = {
    [identity.executablePath]: identity.binarySha256,
    [identity.hostExecutablePath]: identity.hostBinarySha256,
    [identity.bwrapBinaryPath]: identity.bwrapBinarySha256,
  };
  const version = {
    status: 0,
    signal: null,
    error: undefined,
    stdout: `codex-cli ${identity.exactVersion}\n`,
    stderr: "fixture version warning\n",
  };
  const hashes = {
    ...version,
    stdout: JSON.stringify(values),
    stderr: "fixture hash warning\n",
  };
  const actual = assertAdviceImageObservation(
    version,
    hashes,
    identity.fixedImageDigest,
    identity.fixedImageDigest,
  );
  assert.equal(actual.versionWarnings, version.stderr);
  assert.equal(actual.hashProbeWarnings, hashes.stderr);
  for (const key of Object.keys(values)) {
    const missing = { ...values };
    delete missing[key];
    for (const wrong of [missing, { ...values, [key]: "0".repeat(64) }])
      assert.throws(() =>
        assertAdviceImageObservation(
          version,
          { ...hashes, stdout: JSON.stringify(wrong) },
          identity.fixedImageDigest,
          identity.fixedImageDigest,
        ),
      );
  }
  for (const result of [
    { ...version, stdout: "codex-cli 0.0.0\n" },
    { ...version, status: 1 },
    { ...version, signal: "SIGTERM" },
    { ...version, error: new Error("probe failed") },
    { ...version, stderr: "x".repeat(16_385) },
  ])
    assert.throws(() =>
      assertAdviceImageObservation(
        result,
        hashes,
        identity.fixedImageDigest,
        identity.fixedImageDigest,
      ),
    );
  for (const stdout of [
    "",
    "{}\n{}",
    "null",
    "[]",
    JSON.stringify({ ...values, extra: "0".repeat(64) }),
    "x".repeat(16_385),
  ])
    assert.throws(() =>
      assertAdviceImageObservation(
        version,
        { ...hashes, stdout },
        identity.fixedImageDigest,
        identity.fixedImageDigest,
      ),
    );
  for (const result of [
    { ...hashes, status: null },
    { ...hashes, signal: "SIGTERM" },
    { ...hashes, error: new Error("probe failed") },
    { ...hashes, stderr: "x".repeat(16_385) },
  ])
    assert.throws(() =>
      assertAdviceImageObservation(
        version,
        result,
        identity.fixedImageDigest,
        identity.fixedImageDigest,
      ),
    );
  for (const [first, second] of [
    [`sha256:${"0".repeat(64)}`, identity.fixedImageDigest],
    [identity.fixedImageDigest, `sha256:${"0".repeat(64)}`],
  ]) {
    assert.ok(first && second);
    assert.throws(() =>
      assertAdviceImageObservation(version, hashes, first, second),
    );
  }
});

/**
 * 未起動認証資源の実wire構成を元create結果へ結合する。
 * @responsibility Windows Source・tmpfs・Image既定値を実Dockerで確認する。
 * @trace ERB-IT-002
 * @precondition 固定Imageと起動済みDockerだけを使い、自己生成Homeには認証値がない。
 * @stimulus 未起動の三Containerと二Networkを本番認証Runtimeで生成する。
 * @observation 実IDReceiptと構成一致。生Envや秘密値は結果へ出さない。
 * @oracle 五createの直後観測が一致し全実IDと名前の不存在を確認する。
 * @cleanup 元create stdoutの実IDと自己生成名前を照合して実ID指定で回収する。
 * @boundary Windows Docker Desktopの認証隔離構成。Provider起動・外部送信は対象外。
 */
test("Windows Process Gate: 未起動認証五資源の実構成と作成Receiptを確認する", {
  timeout: 120_000,
}, async () => {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const parent = path.join(root, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(parent, "docker-authentication-host-")),
  );
  const home = path.join(directory, "home");
  fs.mkdirSync(home);
  const nonce = randomBytes(8).toString("hex");
  const input: DockerAuthenticationInput = {
    action: "login",
    providerHomeSourcePath: home,
    providerImageDigest:
      "sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a",
    proxyImageDigest: describeDockerProviderAssets("claude").proxy.imageDigest,
    ownershipLabel: `crdd.coordinator.authentication=${nonce}`,
    internalNetworkName: `crdd-internal-${nonce}`,
    egressNetworkName: `crdd-egress-${nonce}`,
    proxyContainerName: `crdd-proxy-${nonce}`,
    loginContainerName: `crdd-claude-${nonce}`,
    probeContainerName: `crdd-auth-${nonce}`,
    proxyToken: randomBytes(32).toString("hex"),
    proxyPort: 8080,
    proxyProfile: "claude",
    authenticationCli: {
      loginArgv: describeProviderAuthentication("claude").loginArgv,
      statusArgv: describeProviderAuthentication("claude").statusArgv,
      environment: describeProviderAuthentication("claude").environment,
    },
  };
  const plan = planDockerAuthenticationCommands(input);
  const createRuntime = createDockerAuthenticationRuntimeFactory();
  const runtime = createRuntime(plan);
  const snapshot = observeTrustedDockerCli();
  const environment = createDockerProcessEnvironment();
  const receipts: Array<{ kind: string; name: string; id: string }> = [];
  const freshPlan = planDockerAuthenticationCommands({
    ...input,
    proxyToken: randomBytes(32).toString("hex"),
  });
  const cleanupRuntime = createRuntime(freshPlan);
  let failure: unknown = null;
  let cleaned = true;
  try {
    for (const command of plan.commands.filter((item) =>
      item.purpose.startsWith("create_"),
    )) {
      const result = await runtime.execute(command, () => true);
      const id = result.stdout.trim();
      const network = command.purpose.endsWith("_network");
      const name = network
        ? command.argv.at(-1)
        : command.argv[command.argv.indexOf("--name") + 1];
      if (/^[a-f0-9]{64}$/u.test(id) && name)
        receipts.push({ kind: network ? "network" : "container", name, id });
      fs.writeFileSync(
        path.join(directory, "resources.json"),
        JSON.stringify(receipts),
      );
      assert.equal(result.processCompletionConfirmed, true);
      let discrepancy = command.purpose;
      if (
        result.resourceCreationConfirmed !== true &&
        /^[a-f0-9]{64}$/u.test(id)
      ) {
        const observed = spawnSync(
          verifyTrustedDockerCliSnapshot(snapshot),
          [
            "-H",
            "npipe:////./pipe/dockerDesktopLinuxEngine",
            network ? "network" : "container",
            "inspect",
            id,
          ],
          {
            env: environment,
            encoding: "utf8",
            shell: false,
            windowsHide: true,
            timeout: 10_000,
            maxBuffer: 1_048_576,
          },
        );
        try {
          const value = JSON.parse(observed.stdout)[0];
          discrepancy = JSON.stringify({
            purpose: command.purpose,
            tmpfsPresent: Object.hasOwn(value.HostConfig ?? {}, "Tmpfs"),
            tmpfs: value.HostConfig?.Tmpfs,
            networkMode: value.HostConfig?.NetworkMode,
            networks: Object.keys(value.NetworkSettings?.Networks ?? {}),
            sourceMatches: value.Mounts?.[0]?.Source === home,
            mountTypes: value.Mounts?.map(
              (mount: { Type: string }) => mount.Type,
            ),
            propagation: value.Mounts?.[0]?.Propagation,
            readWrite: value.Mounts?.[0]?.RW,
            securityOptions: value.HostConfig?.SecurityOpt,
            init: value.HostConfig?.Init,
            workingDirectory: value.Config?.WorkingDir,
            argvMatches:
              JSON.stringify(value.Config?.Cmd) ===
              JSON.stringify(["--version"]),
          });
        } catch {
          discrepancy = `${command.purpose}:diagnostic_unobserved`;
        }
      }
      assert.equal(result.resourceCreationConfirmed, true, discrepancy);
      assert.equal(result.resourceReceipt?.dockerId, id);
    }
    const connect = plan.commands.find(
      (command) => command.purpose === "connect_proxy_egress",
    );
    assert.ok(connect);
    const connected = await runtime.execute(connect, () => true);
    assert.equal(connected.processCompletionConfirmed, true);
    assert.equal(connected.status, 0);
  } catch (error) {
    failure = error;
  } finally {
    for (const receipt of [...receipts].reverse()) {
      const executable = verifyTrustedDockerCliSnapshot(snapshot);
      const options = {
        env: environment,
        encoding: "utf8" as const,
        shell: false,
        windowsHide: true,
        timeout: 10_000,
        maxBuffer: 1_048_576,
      };
      const inspected = spawnSync(
        executable,
        [
          "-H",
          "npipe:////./pipe/dockerDesktopLinuxEngine",
          receipt.kind,
          "inspect",
          receipt.id,
        ],
        options,
      );
      let exact = false;
      try {
        const values = JSON.parse(inspected.stdout);
        exact =
          inspected.status === 0 &&
          values.length === 1 &&
          values[0].Id === receipt.id &&
          values[0].Name ===
            (receipt.kind === "container" ? `/${receipt.name}` : receipt.name);
      } catch {
        exact = false;
      }
      if (!exact) {
        cleaned = false;
        continue;
      }
      const operations = planDockerAuthenticationResourceRecovery(
        freshPlan,
        receipt.name,
        receipt.id,
      );
      let removed: Readonly<{
        status: number | null;
        error?: Error | undefined;
      }>;
      try {
        const observation = await cleanupRuntime.execute(
          operations.ownershipCommand,
          () => true,
        );
        assert.equal(
          observation.resourceConfigurationConfirmed,
          true,
          receipt.kind,
        );
        removed = await cleanupRuntime.execute(
          operations.cleanupCommand,
          () => true,
        );
      } catch (error) {
        failure ??= error;
        removed = spawnSync(
          executable,
          [
            "-H",
            "npipe:////./pipe/dockerDesktopLinuxEngine",
            ...(receipt.kind === "container"
              ? ["rm", "--force", receipt.id]
              : ["network", "rm", receipt.id]),
          ],
          options,
        );
      }
      if (removed.error || removed.status !== 0) {
        cleaned = false;
        continue;
      }
      for (const locator of [receipt.id, receipt.name]) {
        const absent = await cleanupRuntime.execute(
          locator === receipt.id
            ? operations.identityAbsenceCommand
            : operations.absenceCommand,
          () => true,
        );
        const expected =
          receipt.kind === "container"
            ? `Error: No such container: ${locator}`
            : `Error response from daemon: network ${locator} not found`;
        if (
          absent.error ||
          absent.status !== 1 ||
          absent.stdout.trim() !== "[]" ||
          ![
            expected,
            ...(receipt.kind === "container"
              ? [`Error response from daemon: No such container: ${locator}`]
              : []),
          ].includes(absent.stderr.trim())
        )
          cleaned = false;
      }
    }
    if (cleaned && path.dirname(directory) === fs.realpathSync(parent))
      fs.rmSync(directory, { recursive: true });
  }
  assert.equal(
    cleaned,
    true,
    "exact authentication fixture cleanup unconfirmed",
  );
  if (failure) throw failure;
});

/**
 * 別Processで保存した実IDから本番認証清掃へ再入場する。
 * @responsibility 資源順、作成順、記録読戻し、現在排他とfresh清掃を一体で確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-017
 * @precondition 起動済みDockerと自己生成Provider Home、固定Imageを使う。
 * @stimulus 子が未起動五資源を保存し終了、親が本番依存構成でexisting_idleへ再入場する。
 * @observation 保存実ID、構成確認、一回削除、ID／名前不存在、settledと排他解放。
 * @oracle 五資源の全確認後だけ完了し、Providerを開始しない。
 * @cleanup 全不存在・保存完了・排他解放後だけ自己生成Rootを削除する。
 * @boundary 別Process→既存認証記録→実Docker清掃。
 */
test("Windows Process Gate: 認証保存記録から別Processの本番清掃へ再入場する", {
  timeout: 180_000,
}, async () => {
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const parent = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(parent, "claude-authentication-record-")),
  );
  const home = path.join(directory, "ProviderHomes", "claude");
  fs.mkdirSync(home, { recursive: true });
  const hash = randomBytes(32).toString("hex");
  const fixture = fileURLToPath(
    new URL(
      "../fixtures/provider-authentication-create-recovery-fixture.ts",
      import.meta.url,
    ),
  );
  const child = spawnSync(process.execPath, [fixture, directory, hash], {
    env: createDockerProcessEnvironment(),
    shell: false,
    windowsHide: true,
    encoding: "utf8",
    timeout: 120_000,
    maxBuffer: 1_048_576,
  });
  assert.equal(child.error, undefined);
  assert.equal(
    child.status,
    0,
    "creation fixture failed; exact record retained",
  );
  assert.deepEqual(JSON.parse(child.stdout.trim()), {
    completed: true,
    lockReleased: true,
  });
  const plan = createProviderAuthenticationPlan(
    "claude",
    "login",
    home,
    hash.slice(0, 16),
    randomBytes(32).toString("hex"),
  );
  assert.ok(plan);
  const record = createProviderAuthenticationRecoveryRecord(home, hash, plan);
  assert.ok(record);
  const dependencies = createProviderAuthenticationDependencies();
  const lock = dependencies.acquireProviderHomeLock(hash);
  assert.ok(lock);
  let complete = false;
  let released = false;
  try {
    assert.equal(dependencies.beginRecovery(record), "existing_idle");
    const receipts = readProviderAuthenticationResources(record);
    assert.ok(
      receipts &&
        receipts.length === 5 &&
        receipts.every((item) => /^[a-f0-9]{64}$/u.test(item.dockerId ?? "")),
    );
    for (let index = 0; index < 5; index += 1) {
      const operations = dependencies.recoveryCommands(record, plan, index);
      assert.ok(
        operations?.cleanupCommand && operations.identityAbsenceCommand,
      );
      for (const command of [
        operations.ownershipCommand,
        operations.cleanupCommand,
        operations.identityAbsenceCommand,
        operations.absenceCommand,
      ]) {
        assert.equal(
          dependencies.setRecoveryCommandState(
            record,
            "in_flight",
            command.purpose,
          ),
          true,
        );
        const result = await dependencies.run(command, lock.assertLive, plan);
        assert.equal(result.processCompletionConfirmed, true);
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        if (command.purpose.startsWith("confirm_")) {
          const locator = command.argv.at(-1);
          const expected = command.purpose.includes("network")
            ? [`Error response from daemon: network ${locator} not found`]
            : [
                `Error: No such container: ${locator}`,
                `Error response from daemon: No such container: ${locator}`,
              ];
          assert.equal(result.status, 1);
          assert.equal(result.stdout.trim(), "[]");
          assert.ok(expected.includes(result.stderr.trim()));
        } else {
          assert.equal(result.status, 0);
          if (command.purpose.startsWith("observe_"))
            assert.equal(
              result.stdout.trim(),
              plan.ownershipLabel.split("=")[1],
            );
        }
        assert.equal(lock.assertLive(), true);
        assert.equal(
          dependencies.setRecoveryCommandState(record, "idle", null),
          true,
        );
      }
    }
    assert.equal(dependencies.completeRecovery(record), true);
    const settled = JSON.parse(fs.readFileSync(record.recordPath, "utf8"));
    assert.equal(settled.state, "settled");
    assert.deepEqual(settled.resources, receipts);
    complete = true;
  } finally {
    released = lock.release();
    if (
      complete &&
      released &&
      path.dirname(directory) === fs.realpathSync(parent)
    )
      fs.rmSync(directory, { recursive: true });
  }
  assert.equal(released, true);
});

/**
 * 本番技術Ownerで使い捨て資源を作成・実行・回収する。
 *
 * @responsibility 元Docker IDと五Receiptに基づく構成確認・不存在を検証する。
 * @trace ERB-IT-002
 * @precondition Windows、通常起動済みEngine、固定Imageがローカルに存在する。
 * @stimulus 認証値を持たないHomeと--versionだけで三Container・二Networkを作る。
 * @observation Process開始・正常終了、清掃結果、実IDと名前の不存在を得る。
 * @oracle 本番下位Runtimeの全清掃fieldがtrueとなり元結果だけを受理する。
 * @cleanup 同じ元Receiptの実IDを回収し、全確認後だけ自己生成試験Directoryを削除する。
 * @boundary 固定Docker Process構成とEngineの実資源。
 */
test("Windows Process Gate: Docker Isolation本番Ownerが五資源を実IDで回収する", {
  timeout: 90_000,
}, async () => {
  assert.equal(process.platform, "win32");
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  assert.ok(fs.statSync(path.join(root, ".git")).isDirectory());
  const parent = path.join(root, ".crdd", "tests");
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(parent, "docker-isolation-host-")),
  );
  const home = path.join(directory, "home");
  const tmp = path.join(directory, "tmp");
  const management = path.join(directory, "management");
  for (const child of [home, tmp, management]) fs.mkdirSync(child);
  const nonce = randomBytes(8).toString("hex");
  const owner = Object.freeze({});
  const recovery = Object.freeze({});
  const receipts: {
    -readonly [Key in keyof DockerResourceReceipts]: {
      submitted: boolean;
      dockerId: string | null;
    };
  } = {
    create_subscription_auth_probe: { submitted: false, dockerId: null },
    create_provider: { submitted: false, dockerId: null },
    create_proxy: { submitted: false, dockerId: null },
    create_internal_network: { submitted: false, dockerId: null },
    create_egress_network: { submitted: false, dockerId: null },
  };
  const plan: DockerIsolationRuntimePlan = {
    identity: randomBytes(32).toString("hex"),
    stdin: null,
    configuration: {
      authenticationContainerName: `crdd-auth-${nonce}`,
      executionContainerName: `crdd-codex-${nonce}`,
      proxyContainerName: `crdd-proxy-${nonce}`,
      internalNetworkName: `crdd-internal-${nonce}`,
      egressNetworkName: `crdd-egress-${nonce}`,
      ownershipLabel: `crdd.coordinator.runtime=${nonce}`,
      executionImageDigest:
        "sha256:4f35a6542ee0b412714d558bc38e578bcea00490ec2a1f02f02b88c1226f924e",
      proxyImageDigest: describeDockerProviderAssets("codex").proxy.imageDigest,
      homeSourcePath: home,
      temporarySourcePath: tmp,
      workspace: null,
      authentication: { argv: ["--version"], environment: {} },
      execution: {
        argv: ["--version"],
        environment: {},
        interactive: false,
        initRequired: false,
        seccompProfile: null,
      },
      proxy: {
        profile: "codex",
        token: randomBytes(32).toString("hex"),
        port: 8080,
        extendedProxyEnvironment: true,
      },
    },
  };
  const runtime = createDockerIsolationRuntime({
    borrowPaths: (candidate) => {
      assert.equal(candidate, owner);
      return { tmp, management };
    },
    inspectReceipts: (candidate) => {
      assert.equal(candidate, recovery);
      return receipts;
    },
  });
  const fixtureRecord = path.join(directory, "resources.json");
  /**
   * 元の作成要求と実IDを試験終了まで保持する。
   *
   * @responsibility 失敗時に同じ自己生成資源の相関を再構成可能にする。
   * @trace ERB-IT-002
   * @precondition 正式Runtime状態やEvidenceとして使用しない。
   * @stimulus 元Receiptの変更を一つの試験記録へ上書きする。
   * @observation 相関、nonce、実IDとImageだけを保存する。
   * @oracle Token・認証・Provider本文を記録しない。
   * @cleanup 全実資源不存在の確認後に試験Directoryごと削除する。
   * @boundary 自己生成試験領域内の一時相関。
   */
  const recordFixture = () =>
    fs.writeFileSync(
      fixtureRecord,
      JSON.stringify({
        identity: plan.identity,
        nonce,
        receipts,
        executionImageDigest: plan.configuration.executionImageDigest,
        proxyImageDigest: plan.configuration.proxyImageDigest,
      }),
    );
  recordFixture();
  let cleanupConfirmed = false;
  let primaryFailure: unknown = null;
  let cleanupFailure: unknown = null;
  try {
    for (const purpose of [
      "create_subscription_auth_probe",
      "start_subscription_auth_probe_attached",
      "create_internal_network",
      "create_egress_network",
      "create_proxy",
      "connect_proxy_egress",
      "create_provider",
      "start_provider_attached",
    ] as const) {
      const receipt =
        purpose in receipts
          ? receipts[purpose as keyof DockerResourceReceipts]
          : null;
      if (receipt) receipt.submitted = true;
      recordFixture();
      const handle = runtime.startCommand(purpose, plan, owner);
      assert.equal(
        await handle.started(10_000),
        true,
        `${purpose}: process start unconfirmed`,
      );
      const result = await handle.wait(10_000);
      assert.ok(result, `${purpose}: result unobserved`);
      assert.equal(result.status, 0, `${purpose}: nonzero exit`);
      assert.equal(result.signal, null);
      assert.equal(result.outputExceeded, false);
      assert.equal(handle.closed(), true);
      if (receipt) {
        assert.match(result.stdout.trim(), /^[a-f0-9]{64}$/u);
        receipt.dockerId = result.stdout.trim();
        recordFixture();
      }
    }
  } catch (error) {
    primaryFailure = error;
  } finally {
    try {
      const outcome = await runtime.cleanupOwnedResources(
        plan,
        recovery,
        owner,
      );
      if (!outcome.confirmed)
        fs.writeFileSync(
          path.join(directory, "cleanup.json"),
          JSON.stringify(outcome),
        );
      cleanupConfirmed = outcome.confirmed;
      if (cleanupConfirmed) {
        assert.equal(outcome.processTreeTerminated, true);
        assert.equal(outcome.containersAbsent, true);
        assert.equal(outcome.networksAbsent, true);
        assert.ok(
          runtime.verifyCleanupOutcome(outcome, plan.identity, recovery, owner),
        );
        assert.equal(
          runtime.verifyCleanupOutcome(
            { ...outcome },
            plan.identity,
            recovery,
            owner,
          ),
          null,
        );
        assert.equal(path.dirname(directory), fs.realpathSync(parent));
        fs.rmSync(directory, { recursive: true });
      }
    } catch (error) {
      cleanupFailure = error;
    }
  }
  if (primaryFailure !== null) throw primaryFailure;
  if (cleanupFailure !== null) throw cleanupFailure;
  assert.equal(
    cleanupConfirmed,
    true,
    "Docker cleanup unconfirmed; exact fixture retained",
  );
});

/**
 * 公式Imageの通常起動と三実行物Hashを実Image IDで結合する。
 * @responsibility 配布Identityと実配置物、隔離構成、終了後不存在を一組で検証する。
 * @trace ERB-IT-031
 * @precondition 通常起動済みEngineと既存固定Image。別途人間が実行を許可する。
 * @stimulus 通常entrypointの版表示とHash専用Pythonを二Containerで順次実行する。
 * @observation 実Image、構成、版、三Hash、終了値と有界Warning。
 * @oracle 固定Identity完全一致、none・非root・readonly・Host mountなし、元ID回収と不存在。
 * @cleanup 各Containerは元ID・名前・Label・固定構成を再確認して回収する。不明createは名前だけで削除しない。
 * @boundary 固定Imageの局所起動。認証・AI依頼・再Build・Host機能・助言成立は対象外。
 */
test("Windows Process Gate: 公式助言Imageの版と三Hashを実配置物で確認する", {
  timeout: 120_000,
}, () => {
  const expected = {
    ...buildInputs.codex.identity,
    ...buildInputs.codex.adviceIdentity,
    ...describeDockerProviderAssets("codex").adviceIdentity,
  };
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const parent = path.join(repository, ".crdd", "tests");
  const snapshot = observeTrustedDockerCli();
  const environment = createDockerProcessEnvironment();
  fs.mkdirSync(parent, { recursive: true });
  const directory = fs.realpathSync(
    fs.mkdtempSync(path.join(parent, "advice-image-host-")),
  );
  const label = `crdd.coordinator.distribution=${randomBytes(16).toString("hex")}`;
  const [labelKey, labelValue] = label.split("=");
  assert.ok(labelKey && labelValue);
  const record = path.join(directory, "resources.json");
  const resources: { name: string; id: string | null; removed: boolean }[] = [];
  let primaryFailure: unknown = null;
  let cleanupFailure: unknown = null;
  let summary: ReturnType<typeof assertAdviceImageObservation> | null = null;
  const observations: { result: SpawnSyncReturns<string>; imageId: string }[] =
    [];
  const hashScript = [
    "import hashlib,json,sys",
    "result={}",
    "for name in json.loads(sys.argv[1]):",
    " with open(name,'rb') as stream:",
    "  result[name]=hashlib.file_digest(stream,'sha256').hexdigest()",
    "print(json.dumps(result,sort_keys=True))",
  ].join("\n");
  /**
   * 固定Docker CLIを同じsnapshot・最小環境で呼ぶ。
   * @responsibility 試験のProcess要求を有界にし出所を毎回確認する。
   * @trace ERB-IT-031
   * @precondition argvは本Caseが構築する固定用途だけ。
   * @stimulus 元CLIへ引数を配列で渡す。
   * @observation 終了値・Signal・error・有界出力。
   * @oracle shellを使わず、返却後も元実体を検証する。
   * @cleanup 同期子Processの終了後に返る。不明時は失敗として保持する。
   * @boundary Hostから固定Engineへの試験専用呼出し。
   */
  const docker = (argv: string[]) => {
    const result = spawnSync(
      verifyTrustedDockerCliSnapshot(snapshot),
      ["--host", "npipe:////./pipe/dockerDesktopLinuxEngine", ...argv],
      {
        env: environment,
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 20_000,
        maxBuffer: 65_536,
      },
    );
    verifyTrustedDockerCliSnapshot(snapshot);
    return result;
  };
  /**
   * CLIの完了結果を明示的に検証する。
   * @responsibility error・Signal・未終了を正常終了へ丸めない。
   * @trace ERB-IT-031
   * @precondition 同じ試験CLIの元結果。
   * @stimulus 終了値と出力を読む。
   * @observation 正常終了時の本文。
   * @oracle errorなし・Signalなし・終了値0のみ受理する。
   * @cleanup N/A: Processを作成しない。
   * @boundary 試験Process結果の純粋判定。
   */
  const completed = (result: ReturnType<typeof docker>) => {
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0);
    return result.stdout;
  };
  /**
   * 元createと現在ContainerのIdentity・隔離構成を照合する。
   * @responsibility 名前やLabel単独の回収を禁止する。
   * @trace ERB-IT-031
   * @precondition 完全な元IDと元引数を持つ。
   * @stimulus 元IDをinspectする。
   * @observation 実Image・名前・Label・User・Entrypoint・Cmd・隔離設定。
   * @oracle 本Caseの固定構成全体に一致する。
   * @cleanup N/A: 読取りのみ。
   * @boundary 実Containerの現在構成と試験所有の照合。
   */
  const inspect = (
    id: string,
    name: string,
    argv: string[],
    hashProbe: boolean,
  ) => {
    const values = JSON.parse(completed(docker(["container", "inspect", id])));
    assert.equal(values.length, 1);
    const value = values[0];
    assert.equal(value.Id, id);
    assert.equal(value.Name, `/${name}`);
    assert.equal(value.Image, expected.fixedImageDigest);
    assert.equal(value.Config.Labels[labelKey], labelValue);
    assert.equal(value.Config.User, "65534:65534");
    assert.equal(value.Config.WorkingDir, "/work");
    assert.deepEqual(value.Config.Entrypoint, [
      hashProbe ? "/usr/local/bin/python3" : expected.executablePath,
    ]);
    assert.deepEqual(value.Config.Cmd, argv);
    assert.equal(value.HostConfig.NetworkMode, "none");
    assert.equal(value.HostConfig.ReadonlyRootfs, true);
    assert.equal(value.HostConfig.Privileged, false);
    assert.deepEqual(value.HostConfig.CapDrop, ["ALL"]);
    assert.deepEqual(value.HostConfig.SecurityOpt, ["no-new-privileges"]);
    assert.deepEqual(value.Mounts, []);
    return value;
  };
  try {
    const images = JSON.parse(
      completed(docker(["image", "inspect", expected.fixedImageDigest])),
    );
    assert.equal(images.length, 1);
    assert.equal(images[0].Id, expected.fixedImageDigest);
    assert.deepEqual(images[0].Config.Entrypoint, [expected.executablePath]);
    assert.equal(images[0].Config.User, "65534:65534");
    assert.equal(images[0].Config.WorkingDir, "/work");
    for (const hashProbe of [false, true]) {
      const name = `crdd-image-${randomBytes(12).toString("hex")}`;
      const resource = { name, id: null as string | null, removed: false };
      resources.push(resource);
      fs.writeFileSync(
        record,
        JSON.stringify({
          imageId: expected.fixedImageDigest,
          label,
          resources,
        }),
      );
      const argv = hashProbe
        ? [
            "-c",
            hashScript,
            JSON.stringify([
              expected.executablePath,
              expected.hostExecutablePath,
              expected.bwrapBinaryPath,
            ]),
          ]
        : ["--version"];
      try {
        const created = docker([
          "create",
          "--pull=never",
          "--network=none",
          "--read-only",
          "--cap-drop=ALL",
          "--security-opt=no-new-privileges",
          "--user=65534:65534",
          "--workdir=/work",
          "--name",
          name,
          "--label",
          label,
          ...(hashProbe ? ["--entrypoint", "/usr/local/bin/python3"] : []),
          expected.fixedImageDigest,
          ...argv,
        ]);
        if (/^[a-f0-9]{64}$/u.test(created.stdout.trim()))
          resource.id = created.stdout.trim();
        fs.writeFileSync(
          record,
          JSON.stringify({
            imageId: expected.fixedImageDigest,
            label,
            resources,
          }),
        );
        completed(created);
        assert.ok(resource.id);
        const before = inspect(resource.id, name, argv, hashProbe);
        assert.equal(before.State.Running, false);
        const result = docker(["start", "--attach", resource.id]);
        const after = inspect(resource.id, name, argv, hashProbe);
        assert.equal(after.State.Running, false);
        assert.equal(after.State.ExitCode, 0);
        observations.push({ result, imageId: after.Image });
      } catch (error) {
        primaryFailure = error;
      } finally {
        if (resource.id) {
          try {
            inspect(resource.id, name, argv, hashProbe);
            assert.equal(
              completed(
                docker(["container", "rm", "--force", resource.id]),
              ).trim(),
              resource.id,
            );
            for (const filters of [
              [`id=${resource.id}`],
              [`name=^/${name}$`],
              [`label=${label}`],
            ]) {
              assert.equal(
                completed(
                  docker([
                    "container",
                    "ls",
                    "--all",
                    "--no-trunc",
                    ...filters.flatMap((filter) => ["--filter", filter]),
                    "--format",
                    "{{.ID}}",
                  ]),
                ).trim(),
                "",
              );
            }
            resource.removed = true;
          } catch (error) {
            cleanupFailure = error;
          }
        }
        fs.writeFileSync(
          record,
          JSON.stringify({
            imageId: expected.fixedImageDigest,
            label,
            resources,
          }),
        );
      }
      if (primaryFailure || cleanupFailure) break;
    }
    if (primaryFailure === null && cleanupFailure === null) {
      assert.equal(observations.length, 2);
      const [version, hashes] = observations;
      assert.ok(version && hashes);
      summary = assertAdviceImageObservation(
        version.result,
        hashes.result,
        version.imageId,
        hashes.imageId,
      );
    }
  } catch (error) {
    primaryFailure ??= error;
  } finally {
    if (resources.every((resource) => resource.removed)) {
      try {
        assert.equal(fs.realpathSync(parent), path.dirname(directory));
        assert.equal(fs.realpathSync(directory), directory);
        fs.rmSync(directory, { recursive: true });
        assert.throws(() => fs.lstatSync(directory), { code: "ENOENT" });
      } catch (error) {
        cleanupFailure ??= error;
      }
    }
  }
  if (primaryFailure !== null || cleanupFailure !== null) {
    process.stdout.write(
      `${JSON.stringify({ contract: "crdd-coordinator/advice-image-observation", status: "blocked", primaryFailureObserved: primaryFailure !== null, cleanupFailureObserved: cleanupFailure !== null, exactResources: resources, providerRequestIssued: false, authenticationUsed: false })}\n`,
    );
    if (primaryFailure !== null) throw primaryFailure;
    throw cleanupFailure;
  }
  assert.ok(summary);
  assert.ok(resources.every((resource) => resource.removed));
  process.stdout.write(
    `${JSON.stringify({ contract: "crdd-coordinator/advice-image-observation", status: "completed", ...summary, threeHashesVerified: true, containersAbsent: true, rootCleanupConfirmed: true, providerRequestIssued: false, authenticationUsed: false })}\n`,
  );
});

/**
 * 実試験器の終了分類がcleanup単独失敗を一次失敗へ複製しないことを確認する。
 * @responsibility 既知の二失敗を外側catchへ再投入しない制御を反証する。
 * @trace ERB-IT-031
 * @precondition 現在Sourceの一意なOracle前処置を読み取り、実操作は代役にする。
 * @stimulus 一次のみ・清掃のみ・両方の失敗を渡す。
 * @observation 元の二失敗Identityと後続Oracleの呼出し数。
 * @oracle 二失敗の組合せを保ち、後続の観測判定を実行しない。
 * @cleanup N/A: VM内の局所値のみ。Docker・Process・Filesystem書込みなし。
 * @boundary 実Host試験器の制御断面。資源回収成立の証明ではない。
 */
test("公式助言Image試験器は一次と清掃の失敗を別々に保持する", () => {
  const source = fs.readFileSync(fileURLToPath(import.meta.url), "utf8");
  const startMarker = [
    "    if (",
    "primaryFailure === null && cleanupFailure === null) {",
  ].join("");
  const start = source.indexOf(startMarker);
  assert.ok(start > 0);
  assert.equal(source.indexOf(startMarker, start + startMarker.length), -1);
  const end = source.indexOf("\n  } finally {", start);
  assert.ok(end > start);
  const block = source.slice(start, end);
  for (const kind of ["primary", "cleanup", "both"]) {
    const primary = kind === "cleanup" ? null : new Error("primary fixture");
    const cleanup = kind === "primary" ? null : new Error("cleanup fixture");
    let oracleCalls = 0;
    const result = runInNewContext(
      `(() => {
      let primaryFailure = primary, cleanupFailure = cleanup;
      try { ${block}
      }
      return { primaryFailure, cleanupFailure };
    })()`,
      {
        primary,
        cleanup,
        assert: {
          equal() {
            oracleCalls++;
            throw new Error("unexpected oracle");
          },
        },
      },
    );
    assert.equal(result.primaryFailure, primary, kind);
    assert.equal(result.cleanupFailure, cleanup, kind);
    assert.equal(oracleCalls, 0, kind);
  }
});

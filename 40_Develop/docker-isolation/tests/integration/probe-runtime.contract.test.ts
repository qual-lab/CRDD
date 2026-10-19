/**
 * 固定Probe profileと保存を跨がない作成境界を検証する。
 * @packageDocumentation
 * @responsibility 既存payloadの一致、要求一回、未知選択の要求前拒否を確認する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実DI実行群と固定CLI代役。実Docker／Host保存は実施しない。
 * @boundary ERB-IT-004=Related 2 Blocks: DI profile選択→固定command。
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { syncBuiltinESMExports, stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { types as utilTypes } from "node:util";
import test from "node:test";
import {
  createDockerProbeContainer,
  observeDockerProbeEngine,
  runDockerProbeToCompletion,
  planDockerProbeCreation,
  describeDockerProbeConfiguration,
  describeDockerProbeResource,
  type DockerProbeProfile,
} from "../../src/index.ts";

/**
 * 同期読取りが返した拒否Promiseの未処理通知を実子で観測する。
 * @responsibility 同期拒否と後着rejectの消費を分け、即時終了による偽陰性を避ける。
 * @trace ERB-IT-004
 * @precondition 現行factory本文と固定依存だけを子のVMで使用する。
 * @stimulus then getter付きの真正拒否Promiseを返し、二回のevent-loop turnを待つ。
 * @observation 読取り数、mkdir数、未処理reject、getter実行数と同期理由。
 * @oracle 読取り1、mkdir0、未処理reject0、getter0、既存の所在拒否理由。
 * @cleanup 子の終了とstdio回収を同期確認する。Filesystem・Dockerは操作しない。
 * @boundary ERB-IT-004=Direct Boundary: 同期factoryとNode拒否通知。
 */
test("Probe bindingの拒否Promiseは同期拒否後も未処理通知を残さない", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/probe-runtime.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf(
    "export function createDockerProbeRuntimeBinding(",
  );
  const end = source.indexOf("\n/**", begin);
  assert.ok(begin > 0 && end > begin);
  const body = stripTypeScriptTypes(source.slice(begin, end)).replace(
    "export function",
    "function",
  );
  const script = `
    import {runInNewContext} from 'node:vm';
    import {types as utilTypes} from 'node:util';
    import path from 'node:path';
    let reads=0, mkdir=0, unhandled=0, getters=0, reason=null;
    process.on('unhandledRejection',()=>{unhandled++;});
    const factory=runInNewContext(${JSON.stringify(`${body};createDockerProbeRuntimeBinding`)},{
      process:{platform:'win32'},utilTypes,path,
      observeTrustedDockerCli:()=>({}),verifyTrustedDockerCliSnapshot:()=> 'fixed',
      fs:{mkdirSync:()=>{mkdir++;}},createDockerCliEnvironment:()=>({}),
    });
    try { factory(()=>{
      reads++;
      const rejected=Promise.reject(new Error('fixed_reader_rejection'));
      Object.defineProperty(rejected,'then',{get(){getters++;throw Error('then_getter');}});
      return rejected;
    }); } catch(error){reason=error.message;}
    await new Promise(resolve=>setImmediate(resolve));
    await new Promise(resolve=>setImmediate(resolve));
    console.log(JSON.stringify({reads,mkdir,unhandled,getters,reason}));
  `;
  const result = childProcess.spawnSync(
    process.execPath,
    ["--input-type=module"],
    { input: script, encoding: "utf8", timeout: 10_000 },
  );
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    reads: 1,
    mkdir: 0,
    unhandled: 0,
    getters: 0,
    reason: "owned_operation_mount_replaced",
  });
});
/**
 * 保存用技術値と全profileの作成計画を一致させる。
 * @responsibility 上位回復記録と実argvのImage・Name・Labelが分岐しないことを確認する。
 * @trace ERB-IT-004
 * @precondition 独立固定値と既存六profileを使用する。
 * @stimulus 記述と六つの作成計画を取得する。
 * @observation 全field、凍結状態、argvの同値。
 * @oracle 固定値全文と一致し、全profileのImage・Name・Labelが同じ記述に結合する。
 * @cleanup N/A: 純粋値のみ。
 * @boundary ERB-IT-004=Direct Boundary: 保存向け記述と実command planner。
 */
test("Probe保存用記述は六profileの実作成計画と同じ固定構成を返す", () => {
  const resource = describeDockerProbeResource("probe-123");
  assert.deepEqual(resource, {
    image:
      "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
    name: "crdd-coordinator-probe-probe-123",
    label: "crdd.coordinator.probe=probe-123",
    labelName: "crdd.coordinator.probe",
    engine: "docker_desktop_linux_named_pipe",
    runtimeProfile: {
      backend: "docker_desktop_linux",
      endpoint: "local_named_pipe",
      dockerCliTrust:
        "fixed_path_valid_windows_authenticode_docker_inc_and_operation_snapshot",
      imagePinnedByDigest: true,
      networkMode: "none",
    },
  });
  assert.equal(Object.isFrozen(resource), true);
  assert.equal(Object.isFrozen(resource.runtimeProfile), true);
  for (const profile of [
    "normal",
    "timeout",
    "output_limit",
    "invalid_output",
    "nonzero_exit",
    "cancellation",
  ] as const) {
    const argv = planDockerProbeCreation(profile, "probe-123", {
      workspace: path.resolve("fixture/work"),
      providerHome: path.resolve("fixture/home"),
      tmp: path.resolve("fixture/tmp"),
    });
    assert.equal(argv[argv.indexOf("--name") + 1], resource.name);
    assert.equal(argv[argv.indexOf("--label") + 1], resource.label);
    assert.equal(argv.filter((value) => value === resource.image).length, 1);
  }
});

/**
 * 固定bindingの順序と同snapshot再確認を反証する。
 * @responsibility 上位の読取りと下位のCLI・環境構成を分離し、失敗優先順を保持する。
 * @trace ERB-IT-004
 * @precondition 本番factory本文をVMへ読み、OS・CLI・Filesystemだけを代役にする。
 * @stimulus platform／CLI／読取り／環境の複合故障と二要求前のCLI差を与える。
 * @observation 読取り回数、mkdir要求、環境引数、同snapshotと順序。
 * @oracle CLI観測前は読取り0、読取り拒否はmkdir0、正常は一回捕捉し各要求前に同snapshotを検証する。
 * @cleanup VMと局所値を破棄する。実Filesystem・Dockerを操作しない。
 * @boundary ERB-IT-004=Direct Boundary: 本番binding factory→技術依存の代役。
 */
test("本番Probe bindingは旧順序と同期所在一回・同snapshotを維持する", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/probe-runtime.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf(
    "export function createDockerProbeRuntimeBinding(",
  );
  assert.ok(begin > 0);
  const end = source.indexOf("\n/**", begin);
  assert.ok(end > begin);
  const body = stripTypeScriptTypes(source.slice(begin, end)).replace(
    "export function",
    "function",
  );
  for (const mode of [
    "platform",
    "cli",
    "mount",
    "promise",
    "empty",
    "relative",
    "noncanonical",
    "mkdir",
    "environment",
    "normal",
  ] as const) {
    const events: string[] = [];
    const snapshot = Object.freeze({ identity: "fixed" });
    let replaced = false;
    const management = path.resolve("probe-binding-fixture", "management");
    const environment = Object.freeze({ HOME: "fixed" });
    const factory = runInNewContext(
      `${body}; createDockerProbeRuntimeBinding`,
      {
        utilTypes,
        process: { platform: mode === "platform" ? "linux" : "win32" },
        path,
        observeTrustedDockerCli: () => {
          events.push("observe");
          if (mode === "cli") throw new Error("raw_cli_failure");
          return snapshot;
        },
        verifyTrustedDockerCliSnapshot: (value: unknown) => {
          assert.equal(value, snapshot);
          events.push("verify");
          if (replaced) throw new Error("raw_replacement");
          return "fixed-docker";
        },
        fs: {
          mkdirSync: (target: string) => {
            events.push(`mkdir:${path.basename(target)}`);
            assert.equal(path.dirname(target), management);
            if (mode === "mkdir") throw new Error("fixed_mkdir_failure");
          },
        },
        createDockerCliEnvironment: (options: {
          dockerConfig: string;
          dockerHome: string;
        }) => {
          events.push("environment");
          assert.equal(
            options.dockerConfig,
            path.join(management, "docker-config"),
          );
          assert.equal(
            options.dockerHome,
            path.join(management, "docker-home"),
          );
          return mode === "environment" ? null : environment;
        },
      },
    ) as (reader: () => unknown) => {
      verifyCli: () => string;
      environment: () => unknown;
    };
    /**
     * ProbeのCLI・環境・Mount読取りへ故障値を与える。
     * @responsibility ProbeのCLI・環境・Mount読取りへ故障値を与える。
     * @trace ERB-IT-004
     * @precondition 読取り段階と故障modeの組。
     * @stimulus 例外、Promise、空・相対・非canonical値を返す。
     * @observation Reader到達列と上位の固定拒否理由。
     * @oracle 不正な技術観測をProbe起動許可にしない。
     * @cleanup N/A: Readerは局所値と計数だけを変更する。
     * @boundary 境界観測の代役。実CLIは実行しない。
     */
    const reader = () => {
      events.push("read");
      if (["platform", "cli", "mount"].includes(mode))
        throw new Error("fixed_mount_failure");
      if (mode === "promise") return Promise.resolve(management);
      if (mode === "empty") return "";
      if (mode === "relative") return "relative";
      if (mode === "noncanonical")
        return `${management}${path.sep}..${path.sep}management`;
      return management;
    };
    if (mode !== "normal") {
      const reason =
        mode === "platform"
          ? "docker_backend_platform_unsupported"
          : mode === "cli"
            ? "docker_cli_untrusted"
            : mode === "mount"
              ? "fixed_mount_failure"
              : mode === "mkdir"
                ? "fixed_mkdir_failure"
                : mode === "environment"
                  ? "docker_runtime_environment_unavailable"
                  : "owned_operation_mount_replaced";
      assert.throws(() => factory(reader), new RegExp(reason));
      assert.equal(
        events.filter((event) => event === "read").length,
        ["platform", "cli"].includes(mode) ? 0 : 1,
      );
      if (!["mkdir", "environment"].includes(mode))
        assert.equal(
          events.filter((event) => event.startsWith("mkdir:")).length,
          0,
        );
      continue;
    }
    const binding = factory(reader);
    assert.deepEqual(events, [
      "observe",
      "read",
      "mkdir:docker-config",
      "mkdir:docker-home",
      "environment",
    ]);
    assert.equal(Object.isFrozen(binding), true);
    assert.equal(binding.environment(), environment);
    assert.equal(binding.verifyCli(), "fixed-docker");
    replaced = true;
    assert.throws(binding.verifyCli, /docker_cli_untrusted/u);
    assert.equal(events.filter((event) => event === "read").length, 1);
    assert.equal(events.filter((event) => event === "verify").length, 2);
  }
});

/**
 * 固定選択とEngineの元条件を実要求列で反証する。
 * @responsibility 二保存の間にstartを自動発行しない下位契約を検証する。
 * @trace ERB-IT-004
 * @precondition 移管前版の六payload Hashを独立期待値にする。
 * @stimulus 六profile、作成応答不明、Engine失敗、未知選択名を与える。
 * @observation 全argv、期限、CLI確認数、返却field。
 * @oracle 作成一回・start0・完全IDだけを返し、既存payloadを保持する。
 * @cleanup 差替えたspawnSyncを終了hookで復元する。Fileを作らない。
 * @boundary DI→固定CLI代役。実Engine・保存・回収の証明ではない。
 */
test("固定Probe作成は元payloadと二保存の間の一要求を維持する", (t) => {
  // 基準715d79053d654ac56914d5087126d4170501c4e8のUTF-8 payloadから独立取得。
  const expected = {
    normal: "d89bbc245e6590f186d7f8fb2eb675a725660629310c3307658955da7834f562",
    timeout: "c0355c363f4e1b17eb9f4090239a00eacfe87ca7588e49de49426994ca4b3dc0",
    output_limit:
      "4524f9bd262baf982967c0cc03565d559f626c9e9123b9b21e1191e1bfc5fcfc",
    invalid_output:
      "b271f090525406b4adec60c3474b4ae5f5bb2d5b638ca047b9d09347a12972ef",
    nonzero_exit:
      "00424bf5c82e69b5c3528316c9d071d86b8e7a4949a4c3b352d17ce62dc2c699",
    cancellation:
      "ad76728317787a69087ae0e4b603545b31603b50f7331a7c9666595c5aff0cb3",
  } satisfies Record<DockerProbeProfile, string>;
  const original = childProcess.spawnSync;
  const requests: string[][] = [];
  let stdout = "a".repeat(64);
  let status = 0;
  let error: Error | undefined;
  let timeout = 30_000;
  let checks = 0;
  const binding = {
    verifyCli: () => {
      checks++;
      return "fixture-docker";
    },
    environment: () => ({}),
  };
  childProcess.spawnSync = ((
    executable: unknown,
    argv: unknown,
    options: unknown,
  ) => {
    assert.equal(executable, "fixture-docker");
    assert.ok(Array.isArray(argv));
    requests.push([...argv]);
    assert.equal((options as { timeout: number }).timeout, timeout);
    assert.equal((options as { shell: boolean }).shell, false);
    return {
      status,
      error,
      signal: null,
      stdout,
      stderr: "",
      output: [null, stdout, ""],
      pid: 1,
    };
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
  });
  const mounts = {
    workspace: path.resolve("fixture-workspace"),
    providerHome: path.resolve("fixture-home"),
    tmp: path.resolve("fixture-tmp"),
  };
  for (const profile of [
    "normal",
    "timeout",
    "output_limit",
    "invalid_output",
    "nonzero_exit",
    "cancellation",
  ] as const) {
    requests.length = 0;
    checks = 0;
    assert.deepEqual(
      createDockerProbeContainer(binding, profile, "probe-123", mounts),
      { status: "confirmed", id: "a".repeat(64) },
    );
    assert.equal(checks, 1);
    assert.equal(requests.length, 1);
    const payload = requests[0]?.at(-1);
    assert.equal(typeof payload, "string");
    assert.equal(
      createHash("sha256")
        .update(payload ?? "")
        .digest("hex"),
      expected[profile],
    );
    assert.deepEqual(
      planDockerProbeCreation(profile, "probe-123", mounts),
      requests[0],
    );
    const configuration = describeDockerProbeConfiguration(
      profile,
      { id: "a".repeat(64), probeId: "probe-123" },
      mounts,
    );
    assert.deepEqual(configuration.sourceCandidates, [payload]);
    assert.equal(configuration.id, "a".repeat(64));
    assert.equal(configuration.probeId, "probe-123");
    assert.deepEqual({ ...configuration.mounts }, mounts);
    assert.equal(Object.isFrozen(configuration.sourceCandidates), true);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0], [
      "-H",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      "crdd-coordinator-probe-probe-123",
      "--label",
      "crdd.coordinator.probe=probe-123",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65532:65532",
      "--workdir=/operation/workspace",
      "--env",
      "HOME=/operation/provider-home",
      "--env",
      "TMPDIR=/operation/tmp",
      "--mount",
      `type=bind,src=${mounts.workspace},dst=/operation/workspace`,
      "--mount",
      `type=bind,src=${mounts.providerHome},dst=/operation/provider-home`,
      "--mount",
      `type=bind,src=${mounts.tmp},dst=/operation/tmp`,
      "--entrypoint",
      "python",
      "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
      "-c",
      payload,
    ]);
  }
  for (const invalid of ["constructor", "toString", "unknown", null, {}]) {
    requests.length = 0;
    checks = 0;
    assert.throws(
      () =>
        createDockerProbeContainer(
          binding,
          invalid as DockerProbeProfile,
          "probe-123",
          mounts,
        ),
      /docker_probe_profile_invalid/u,
    );
    assert.equal(checks, 0);
    assert.deepEqual(requests, []);
    assert.throws(
      () =>
        planDockerProbeCreation(
          invalid as DockerProbeProfile,
          "probe-123",
          mounts,
        ),
      /docker_probe_profile_invalid/u,
    );
    assert.throws(
      () =>
        describeDockerProbeConfiguration(
          invalid as DockerProbeProfile,
          { id: "a".repeat(64), probeId: "probe-123" },
          mounts,
        ),
      /docker_probe_profile_invalid/u,
    );
  }
  for (const invalid of [undefined, ""])
    assert.throws(
      () =>
        describeDockerProbeConfiguration(
          invalid as DockerProbeProfile,
          { id: "a".repeat(64), probeId: "probe-123" },
          mounts,
        ),
      /docker_probe_profile_invalid/u,
    );
  const legacy = describeDockerProbeConfiguration(
    "legacy_recovery",
    { id: "a".repeat(64), probeId: "probe-123" },
    mounts,
  );
  assert.deepEqual(
    legacy.sourceCandidates.map((payload) =>
      createHash("sha256").update(payload).digest("hex"),
    ),
    Object.values(expected),
  );
  assert.equal(new Set(legacy.sourceCandidates).size, 6);
  for (const changed of [
    legacy.sourceCandidates.slice(1),
    [...legacy.sourceCandidates, "print('extra')"],
    [legacy.sourceCandidates[0] ?? ""],
  ])
    assert.throws(
      () =>
        assert.deepEqual(
          changed.map((payload) =>
            createHash("sha256").update(payload).digest("hex"),
          ),
          Object.values(expected),
        ),
      { code: "ERR_ASSERTION" },
    );
  assert.throws(
    () =>
      planDockerProbeCreation(
        "legacy_recovery" as DockerProbeProfile,
        "probe-123",
        mounts,
      ),
    /docker_probe_profile_invalid/u,
  );
  for (const result of [
    { stdout: "", status: 0 },
    { stdout: "a".repeat(64), status: 1 },
    { stdout: "short", status: 0 },
  ]) {
    stdout = result.stdout;
    status = result.status;
    requests.length = 0;
    assert.deepEqual(
      createDockerProbeContainer(binding, "normal", "probe-123", mounts),
      { status: "blocked", reason: "docker_container_identity_unknown" },
    );
    assert.equal(requests.length, 1);
  }
  timeout = 10_000;
  for (const result of [
    { stdout: "linux\n", status: 0, accepted: true },
    { stdout: "windows", status: 0, accepted: false },
    { stdout: "linux", status: 1, accepted: false },
  ]) {
    stdout = result.stdout;
    status = result.status;
    requests.length = 0;
    assert.equal(observeDockerProbeEngine(binding), result.accepted);
    assert.deepEqual(requests, [
      [
        "-H",
        "npipe:////./pipe/dockerDesktopLinuxEngine",
        "version",
        "--format",
        "{{.Server.Os}}",
      ],
    ]);
  }
  stdout = "linux";
  status = 0;
  error = new Error("fixture-failure");
  assert.equal(observeDockerProbeEngine(binding), false);
});

/**
 * 完了まで待つ固定診断の期限と時計測を確認する。
 * @responsibility profile別期限・同実ID・閉じた結果と計測範囲を検証する。
 * @trace ERB-IT-004
 * @precondition 実CLIの代役と局所時計だけを使用する。
 * @stimulus 通常・四故障profileと禁止した取消profileを与える。
 * @observation 全argv、期限、CLI／環境確認、計測、返却field。
 * @oracle profile期限を独立期待へ照合し、CLI確認を含む21msを計測する。
 * @cleanup spawnSyncとperformanceを元のdescriptorへ復元する。
 * @boundary DI同期実行→固定Process代役。実Dockerは使用しない。
 */
test("保存後Probe実行はprofile期限とCLI確認を含む時計測を閉じる", (t) => {
  const original = childProcess.spawnSync;
  const clockDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "performance",
  );
  assert.ok(clockDescriptor);
  let clock = 100;
  Object.defineProperty(globalThis, "performance", {
    configurable: true,
    value: { now: () => clock },
  });
  let expectedTimeout = 30_000;
  let issued = 0;
  const output = JSON.stringify({
    marker: "crdd-coordinator-isolation-v1",
    allowed_writes: { workspace: true, "provider-home": true, tmp: true },
    runtime_paths_absent: true,
    credential_names_absent: true,
    network_blocked: true,
    home_isolated: true,
    tmp_isolated: true,
  });
  const binding = {
    verifyCli: () => {
      clock += 7;
      return "fixed-cli";
    },
    environment: () => {
      clock += 3;
      return { FIXED: "fixture" };
    },
  };
  const id = "a".repeat(64);
  childProcess.spawnSync = ((
    executable: unknown,
    argv: unknown,
    options: unknown,
  ) => {
    issued++;
    clock += 11;
    assert.equal(executable, "fixed-cli");
    assert.deepEqual(argv, [
      "-H",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
      "start",
      "--attach",
      id,
    ]);
    const configured = options as {
      timeout: number;
      env: object;
      shell: boolean;
    };
    assert.equal(configured.timeout, expectedTimeout);
    assert.equal(Object.getPrototypeOf(configured.env), null);
    assert.deepEqual(Object.entries(configured.env), [["FIXED", "fixture"]]);
    assert.equal(configured.shell, false);
    return {
      status: 0,
      signal: null,
      stdout: output,
      stderr: "",
      pid: 1,
      output: [null, output, ""],
    };
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  t.after(() => {
    childProcess.spawnSync = original;
    syncBuiltinESMExports();
    Object.defineProperty(globalThis, "performance", clockDescriptor);
  });
  for (const [profile, timeout] of [
    ["normal", 30_000],
    ["timeout", 250],
    ["output_limit", 10_000],
    ["invalid_output", 10_000],
    ["nonzero_exit", 10_000],
  ] as const) {
    expectedTimeout = timeout;
    const before = issued;
    const result = runDockerProbeToCompletion(binding, profile, id);
    assert.equal(issued, before + 1);
    assert.deepEqual(result, {
      isolation: {
        status: "confirmed",
        reason: "docker_fake_provider_isolation_confirmed",
      },
      lifecycleStatus: "candidate",
      lifecycleReason: "dynamic_fake_provider_result_observed",
      elapsedMs: 21,
      stdoutBytes: Buffer.byteLength(output),
      stderrBytes: 0,
      exitCode: 0,
      signal: null,
      timedOut: false,
    });
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.isolation), true);
  }
  const before = issued;
  assert.throws(
    () => runDockerProbeToCompletion(binding, "cancellation", id),
    /docker_probe_profile_invalid/u,
  );
  assert.equal(issued, before);
});

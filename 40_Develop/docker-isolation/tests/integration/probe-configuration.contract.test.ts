/**
 * Probeの固定構成とRepository内mountのFilesystem照合を検証する。
 * @packageDocumentation
 * @responsibility 固定構成差・payload差・Path観測不能を一致へ丸めない。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実Repository-local Directoryと同期realpath。Docker実行・回収は含まない。
 * @boundary ERB-IT-004=Direct Boundary: DI構成判定→実Filesystem。
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import { types as utilTypes } from "node:util";
import { stripTypeScriptTypes, syncBuiltinESMExports } from "node:module";
import {
  verifyRepositoryRoot,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  dockerProbeConfigurationMatches,
  describeDockerProbeResource,
  planDockerProbeCommand,
  inspectDockerProbeContainer,
  observeDockerProbeContainerAbsence,
  cleanupDockerProbeContainer,
  executeDockerProbeCommand,
  type DockerProbeConfigurationExpectation,
} from "../../src/index.ts";

/**
 * 検証済みRepository内の三mountと独立したinspect正対照を作る。
 * @responsibility 自己生成範囲だけを作成し、実Filesystem照合を成立させる。
 * @trace ERB-IT-004
 * @precondition 最寄りRepositoryがCRDD Rootと一致する。
 * @stimulus 一意な試験Directoryと三子Directoryを作成する。
 * @observation 期待構成、独立inspect値と自己生成Root。
 * @oracle 固定Probe構成と三Pathだけを再現する。
 * @cleanup 試験終了時にmockを戻して同じ自己生成Rootだけを削除する。
 * @boundary Repository-localの自己生成Filesystem。
 */
function fixture(t: TestContext) {
  const root = fileURLToPath(new URL("../../../../", import.meta.url));
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  assert.ok(verified.capability);
  assert.equal(
    resolveVerifiedRepositoryRoot(verified.capability),
    path.resolve(root),
  );
  const tests = path.join(path.resolve(root), ".crdd", "tests");
  fs.mkdirSync(tests, { recursive: true });
  assert.equal(fs.realpathSync.native(tests), tests);
  const directory = fs.mkdtempSync(path.join(tests, "probe-configuration-"));
  const mounts = {
    workspace: path.join(directory, "workspace"),
    providerHome: path.join(directory, "provider-home"),
    tmp: path.join(directory, "tmp"),
  };
  for (const value of Object.values(mounts)) fs.mkdirSync(value);
  t.after(() => {
    t.mock.restoreAll();
    assert.equal(fs.realpathSync.native(directory), directory);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    fs.rmSync(directory, { recursive: true });
    assert.equal(fs.existsSync(directory), false);
  });
  const expected: DockerProbeConfigurationExpectation = {
    id: "a".repeat(64),
    probeId: "probe-123",
    sourceCandidates: ["probe-a", "probe-b"],
    mounts,
  };
  const inspect = {
    Id: expected.id,
    Name: "/crdd-coordinator-probe-probe-123",
    Config: {
      Labels: { "crdd.coordinator.probe": "probe-123" },
      Image:
        "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
      User: "65532:65532",
      Entrypoint: ["python"],
      Cmd: ["-c", "probe-a"],
    },
    HostConfig: {
      NetworkMode: "none",
      ReadonlyRootfs: true,
      Privileged: false,
      PidsLimit: 64,
      CapDrop: ["ALL"],
      CapAdd: null,
      Devices: null,
      SecurityOpt: ["no-new-privileges"],
    },
    Mounts: [
      {
        Destination: "/operation/workspace",
        Source: mounts.workspace,
        Type: "bind",
        RW: true,
      },
      {
        Destination: "/operation/provider-home",
        Source: mounts.providerHome,
        Type: "bind",
        RW: true,
      },
      {
        Destination: "/operation/tmp",
        Source: mounts.tmp,
        Type: "bind",
        RW: true,
      },
    ],
  };
  return { directory, expected, inspect };
}

/**
 * 独立fixtureの一fieldだけを変更する。
 * @responsibility 本番判定を再利用せず単独反例を作る。
 * @trace ERB-IT-004
 * @precondition 自己生成JSONの既知Pathだけを指定する。
 * @stimulus 指定した末端値を置き換える。
 * @observation 同じ試験値。
 * @oracle 他のfieldへ変更を広げない。
 * @cleanup N/A: メモリ値だけ。
 * @boundary 試験fixture内。
 */
function changeField(value: object, location: string, replacement: unknown) {
  const keys = location.split(".");
  let current = value as Record<string, unknown>;
  for (const key of keys.slice(0, -1))
    current = current[key] as Record<string, unknown>;
  const key = keys.at(-1);
  assert.ok(key);
  current[key] = replacement;
}

/**
 * 構成観測から実ID限定削除・三軸不存在までの要求順を反証する。
 * @responsibility 上位のHost保存と独立したDocker技術群を実本文で確認する。
 * @trace ERB-IT-004
 * @precondition 実三mountと独立inspect値を使用し、CLI Processだけを代役にする。
 * @stimulus 正常、構成差、応答不明、削除失敗、各不存在軸の差を与える。
 * @observation 固定argv、再確認数、閉じた結果と要求順。
 * @oracle fresh inspect→remove→ID→名前→label共同成功だけをconfirmedとする。
 * @cleanup Builtinを復元しfixtureが自己生成Rootを回収する。
 * @boundary DI技術群→模擬CLI・実mount realpath。実Dockerは使わない。
 */
test("Probe観測と回収はfresh構成・実ID・三軸を同じ技術群で閉じる", (t) => {
  const f = fixture(t);
  const originalSpawn = childProcess.spawnSync;
  const calls: string[] = [];
  let inspected: unknown = { ...f.inspect, State: { Running: true } };
  let fault: string | null = null;
  let cliChecks = 0;
  let expectedProbeId = f.expected.probeId;
  const binding = {
    verifyCli: () => {
      cliChecks++;
      return "fixture-docker";
    },
    environment: () => Object.freeze({}),
  };
  childProcess.spawnSync = ((...values: unknown[]) => {
    assert.equal(values[0], "fixture-docker");
    assert.ok(Array.isArray(values[1]));
    const argv = values[1] as string[];
    assert.deepEqual(argv.slice(0, 2), [
      "-H",
      "npipe:////./pipe/dockerDesktopLinuxEngine",
    ]);
    const request = argv.slice(2);
    const filter = request.at(-1) ?? "";
    const purpose =
      request[1] === "inspect"
        ? "inspect"
        : request[1] === "rm"
          ? "remove"
          : filter.startsWith("id=")
            ? "id"
            : filter.startsWith("name=")
              ? "name"
              : "label";
    calls.push(purpose);
    if (purpose === "inspect")
      assert.deepEqual(request, ["container", "inspect", f.expected.id]);
    if (purpose === "remove")
      assert.deepEqual(request, ["container", "rm", "--force", f.expected.id]);
    if (["id", "name", "label"].includes(purpose))
      assert.deepEqual(request, [
        "container",
        "ls",
        "--all",
        "--quiet",
        "--no-trunc",
        "--filter",
        purpose === "id"
          ? `id=${f.expected.id}`
          : purpose === "name"
            ? `name=^/crdd-coordinator-probe-${expectedProbeId}$`
            : `label=crdd.coordinator.probe=${expectedProbeId}`,
      ]);
    const options = values[2] as {
      shell: boolean;
      timeout: number;
      maxBuffer: number;
      env: object;
    };
    assert.equal(options.shell, false);
    assert.equal(options.timeout, 10_000);
    assert.equal(options.maxBuffer, 64 * 1024);
    assert.deepEqual(Object.keys(options.env), []);
    if (fault === `throw-${purpose}`) throw new Error("fixture_cli_failure");
    const stdout =
      purpose === "inspect"
        ? fault === "inspect-invalid"
          ? "invalid"
          : JSON.stringify([inspected])
        : fault === purpose
          ? `${f.expected.id}\n`
          : "";
    return {
      status: fault === `failed-${purpose}` ? 1 : 0,
      signal: null,
      stdout,
      stderr: "",
      pid: 1,
      output: [null, stdout, ""],
    };
  }) as typeof childProcess.spawnSync;
  syncBuiltinESMExports();
  t.after(() => {
    childProcess.spawnSync = originalSpawn;
    syncBuiltinESMExports();
  });
  assert.equal(
    inspectDockerProbeContainer(binding, f.expected)?.runningConfirmed,
    true,
  );
  inspected = { ...f.inspect };
  assert.equal(
    inspectDockerProbeContainer(binding, f.expected)?.runningConfirmed,
    false,
  );
  inspected = { ...f.inspect, State: { Running: false } };
  assert.equal(
    inspectDockerProbeContainer(binding, f.expected)?.runningConfirmed,
    false,
  );
  calls.length = 0;
  cliChecks = 0;
  assert.deepEqual(cleanupDockerProbeContainer(binding, f.expected), {
    confirmed: true,
    reason: "docker_probe_absence_confirmed",
  });
  assert.deepEqual(calls, ["inspect", "remove", "id", "name", "label"]);
  assert.equal(cliChecks, 5);
  for (const scenario of [
    "inspect-invalid",
    "failed-inspect",
    "failed-remove",
    "id",
    "name",
    "label",
    "failed-id",
    "failed-name",
    "failed-label",
  ]) {
    fault = scenario;
    calls.length = 0;
    const outcome = cleanupDockerProbeContainer(binding, f.expected);
    assert.equal(outcome.confirmed, false, scenario);
    assert.equal(
      outcome.reason,
      scenario.includes("inspect")
        ? "docker_container_identity_mismatch"
        : "docker_probe_cleanup_failed",
    );
    assert.deepEqual(
      calls,
      scenario.includes("inspect")
        ? ["inspect"]
        : scenario === "failed-remove"
          ? ["inspect", "remove"]
          : ["inspect", "remove", "id", "name", "label"],
    );
  }
  fault = null;
  inspected = { ...f.inspect, Id: "b".repeat(64) };
  calls.length = 0;
  assert.equal(
    cleanupDockerProbeContainer(binding, f.expected).confirmed,
    false,
  );
  assert.deepEqual(calls, ["inspect"]);
  inspected = { ...f.inspect };
  calls.length = 0;
  assert.deepEqual(
    observeDockerProbeContainerAbsence(binding, {
      id: f.expected.id,
      probeId: f.expected.probeId,
    }),
    { status: "confirmed", reason: "docker_probe_absence_confirmed" },
  );
  assert.deepEqual(calls, ["id", "name", "label"]);
  fault = "throw-id";
  calls.length = 0;
  assert.throws(
    () => cleanupDockerProbeContainer(binding, f.expected),
    /fixture_cli_failure/u,
  );
  assert.deepEqual(calls, ["inspect", "remove", "id"]);
  fault = null;
  calls.length = 0;
  let getters = 0;
  const accessor = Object.defineProperty({ ...f.expected }, "id", {
    get() {
      getters++;
      return f.expected.id;
    },
    enumerable: true,
  });
  for (const invalid of [
    accessor,
    { ...f.expected, extra: true },
    { ...f.expected, sourceCandidates: [] },
    { ...f.expected, sourceCandidates: ["probe-a", "probe-a"] },
  ])
    assert.throws(
      () => cleanupDockerProbeContainer(binding, invalid),
      /docker_probe_projection_invalid/u,
    );
  assert.equal(getters, 0);
  assert.deepEqual(calls, []);
  for (const probeId of ["probe.test", "x".repeat(65), "probe_test"]) {
    const checksBefore: number = cliChecks;
    for (const invoke of [
      () => inspectDockerProbeContainer(binding, { ...f.expected, probeId }),
      () => cleanupDockerProbeContainer(binding, { ...f.expected, probeId }),
      () =>
        observeDockerProbeContainerAbsence(binding, {
          id: f.expected.id,
          probeId,
        }),
    ])
      assert.throws(invoke, /docker_probe_projection_invalid/u);
    assert.equal(cliChecks, checksBefore);
    assert.deepEqual(calls, []);
  }
  const aggregateSource = fs.readFileSync(
    new URL("../../src/execution/probe-container.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    aggregateSource.slice(aggregateSource.indexOf("function captureFields(")),
  ).replaceAll("export function ", "function ");
  for (const [needle, replacement, expectedCalls] of [
    [
      '{ purpose: "list_id", containerId: captured.id }',
      '{ purpose: "list_id", containerId: "b".repeat(64) }',
      ["id"],
    ],
    [
      '{ purpose: "list_name", probeId: captured.probeId }',
      '{ purpose: "list_name", probeId: "other-probe" }',
      ["id", "name"],
    ],
    [
      '{ purpose: "list_label", probeId: captured.probeId }',
      '{ purpose: "list_label", probeId: "other-probe" }',
      ["id", "name", "label"],
    ],
  ] as const) {
    assert.equal(body.split(needle).length, 2);
    const mutated = runInNewContext(
      `(()=>{${body.replace(needle, replacement)}; return observeDockerProbeContainerAbsence;})()`,
      {
        Object,
        utilTypes,
        executeDockerProbeCommand: (
          ...args: Parameters<typeof executeDockerProbeCommand>
        ) =>
          executeDockerProbeCommand(args[0], structuredClone(args[1]), args[2]),
        normalizeContainerAbsence: () => ({
          status: "confirmed",
          reason: "docker_probe_absence_confirmed",
        }),
      },
    ) as typeof observeDockerProbeContainerAbsence;
    calls.length = 0;
    assert.throws(
      () =>
        mutated(binding, { id: f.expected.id, probeId: f.expected.probeId }),
      { code: "ERR_ASSERTION" },
    );
    assert.deepEqual(calls, expectedCalls);
  }
  calls.length = 0;
  expectedProbeId = "x".repeat(64);
  assert.equal(
    observeDockerProbeContainerAbsence(binding, {
      id: f.expected.id,
      probeId: "x".repeat(64),
    }).status,
    "confirmed",
  );
  expectedProbeId = f.expected.probeId;
  const mutable = structuredClone(f.expected);
  const initial = mutable.mounts.workspace;
  const mutatingBinding = {
    ...binding,
    verifyCli: () => {
      Object.defineProperty(mutable.mounts, "workspace", {
        value: "changed-after-capture",
        enumerable: true,
        configurable: true,
        writable: true,
      });
      return "fixture-docker";
    },
  };
  assert.equal(
    inspectDockerProbeContainer(mutatingBinding, mutable)?.runningConfirmed,
    false,
  );
  assert.notEqual(mutable.mounts.workspace, initial);
});

/**
 * 固定構成とpayload候補を一軸ずつ反証する。
 * @responsibility 別の既知payloadでも単一候補指定を迂回できないことを確認する。
 * @trace ERB-IT-004
 * @precondition 実三Directoryと独立inspectの正対照がある。
 * @stimulus 各Docker fieldと候補集合を単独変更する。
 * @observation boolean、入力不変、plannerの固定値。
 * @oracle 正常だけ一致。既存の文字列pids・追加SecurityOpt・null/空Capabilityは維持。
 * @cleanup fixtureの終了hookで回収する。
 * @boundary 実Filesystem照合。Docker要求0。
 */
test("Probe構成の固定fieldとpayload候補を等価に照合する", (t) => {
  const f = fixture(t);
  const before = structuredClone(f.inspect);
  assert.equal(dockerProbeConfigurationMatches(f.inspect, f.expected), true);
  assert.deepEqual(f.inspect, before);
  const args = planDockerProbeCommand({
    purpose: "create",
    probeId: f.expected.probeId,
    source: "probe-a",
    mounts: f.expected.mounts,
  });
  assert.equal(args[args.indexOf("--name") + 1], f.inspect.Name.slice(1));
  assert.equal(
    args[args.indexOf("--label") + 1],
    "crdd.coordinator.probe=probe-123",
  );
  assert.equal(args.at(-3), f.inspect.Config.Image);
  for (const candidate of f.expected.sourceCandidates) {
    const value = structuredClone(f.inspect);
    value.Config.Cmd[1] = candidate;
    assert.equal(dockerProbeConfigurationMatches(value, f.expected), true);
  }
  const second = structuredClone(f.inspect);
  second.Config.Cmd[1] = "probe-b";
  assert.equal(
    dockerProbeConfigurationMatches(second, {
      ...f.expected,
      sourceCandidates: ["probe-a"],
    }),
    false,
  );
  for (const [field, value] of [
    ["Id", "b".repeat(64)],
    ["Name", "/other"],
    ["Config.Image", "other"],
    ["Config.User", "root"],
    ["Config.Labels.crdd.coordinator.probe", "other"],
    ["Config.Labels", {}],
    ["Config.Entrypoint", ["sh"]],
    ["Config.Cmd", ["-c", "unknown"]],
    ["Config.Cmd", ["-c", "probe-a", "extra"]],
    ["HostConfig.NetworkMode", "bridge"],
    ["HostConfig.ReadonlyRootfs", false],
    ["HostConfig.Privileged", true],
    ["HostConfig.PidsLimit", 63],
    ["HostConfig.CapDrop", []],
    ["HostConfig.CapAdd", ["ALL"]],
    ["HostConfig.Devices", [{}]],
    ["HostConfig.SecurityOpt", []],
  ] as const) {
    const input = structuredClone(f.inspect);
    if (field === "Config.Labels.crdd.coordinator.probe")
      input.Config.Labels["crdd.coordinator.probe"] = "other";
    else changeField(input, field, value);
    assert.equal(
      dockerProbeConfigurationMatches(input, f.expected),
      false,
      field,
    );
  }
  const permissive = structuredClone(f.inspect);
  changeField(permissive, "HostConfig.PidsLimit", "64");
  changeField(permissive, "HostConfig.CapAdd", []);
  changeField(permissive, "HostConfig.Devices", []);
  permissive.HostConfig.SecurityOpt.push("another-option");
  assert.equal(dockerProbeConfigurationMatches(permissive, f.expected), true);
  const accessor = structuredClone(f.inspect);
  let getters = 0;
  Object.defineProperty(accessor.Config, "Image", {
    get() {
      getters++;
      return f.inspect.Config.Image;
    },
  });
  assert.equal(dockerProbeConfigurationMatches(accessor, f.expected), false);
  assert.equal(getters, 0);
});

/**
 * 三mountの実体とrealpathの順序・失敗を検査する。
 * @responsibility 構成一致だけで別Pathや観測不能を受理しない。
 * @trace ERB-IT-004
 * @precondition Repository内の実三Directoryが存在する。
 * @stimulus 順序・表記差、欠落・余分・重複、Source／Type／RW差と読取りthrow。
 * @observation 実realpathへの要求先・回数とboolean。
 * @oracle 観測側→期待側の計6回。同じcanonical Pathだけ一致し、例外はfalse。
 * @cleanup mockを復元し自己生成Directoryを削除する。
 * @boundary 実Filesystem＋失敗注入。実Docker成功は主張しない。
 */
test("Probe三mountの実Path照合は差と観測不能を拒否する", (t) => {
  const f = fixture(t);
  const original = fs.realpathSync.native;
  const reads: unknown[] = [];
  let failAt = -1;
  t.mock.method(
    fs.realpathSync,
    "native",
    (...args: Parameters<typeof fs.realpathSync.native>) => {
      reads.push(args[0]);
      if (reads.length === failAt) throw new Error("fixture_read_failure");
      return Reflect.apply(original, fs.realpathSync, args);
    },
  );
  assert.equal(dockerProbeConfigurationMatches(f.inspect, f.expected), true);
  assert.deepEqual(
    reads,
    Object.values(f.expected.mounts).flatMap((x) => [x, x]),
  );
  const alias = structuredClone(f.inspect);
  alias.Mounts.reverse();
  for (const mount of alias.Mounts) mount.Source += `${path.sep}.`;
  const expectedByDestination = new Map([
    ["/operation/workspace", f.expected.mounts.workspace],
    ["/operation/provider-home", f.expected.mounts.providerHome],
    ["/operation/tmp", f.expected.mounts.tmp],
  ]);
  const aliasReads = alias.Mounts.flatMap((mount) => [
    mount.Source,
    expectedByDestination.get(mount.Destination),
  ]);
  reads.length = 0;
  assert.equal(dockerProbeConfigurationMatches(alias, f.expected), true);
  assert.deepEqual(reads, aliasReads);
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/execution/probe-configuration.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import fs from "node:fs";\r?\n/m, "")
    .replace(
      /^import \{ describeDockerProbeResource \} from "\.\/probe-command.ts";\r?\n/m,
      "",
    )
    .replaceAll("export function ", "function ");
  const originalOrder =
    /const observedSource = fs\.realpathSync\.native\(sourcePath\);\s*const expectedSource = fs\.realpathSync\.native\(source\);/u;
  assert.ok(originalOrder.test(source));
  const reversed = runInNewContext(
    `(()=>{${source.replace(originalOrder, "const expectedSource = fs.realpathSync.native(source); const observedSource = fs.realpathSync.native(sourcePath);")};return dockerProbeConfigurationMatches})()`,
    {
      process: { platform: process.platform },
      fs,
      describeDockerProbeResource,
    },
  ) as typeof dockerProbeConfigurationMatches;
  reads.length = 0;
  assert.equal(reversed(alias, f.expected), true);
  assert.throws(() => assert.deepEqual(reads, aliasReads));
  for (const mode of ["missing", "extra", "duplicate"]) {
    const value = structuredClone(f.inspect);
    const first = value.Mounts[0];
    assert.ok(first);
    if (mode === "missing") value.Mounts.pop();
    if (mode === "extra") value.Mounts.push({ ...first });
    if (mode === "duplicate") value.Mounts[1] = { ...first };
    assert.equal(
      dockerProbeConfigurationMatches(value, f.expected),
      false,
      mode,
    );
  }
  for (let axis = 0; axis < 3; axis++)
    for (const [key, value] of [
      ["Source", f.directory],
      ["Type", "volume"],
      ["RW", false],
    ] as const) {
      const input = structuredClone(f.inspect);
      changeField(input, `Mounts.${axis}.${key}`, value);
      assert.equal(dockerProbeConfigurationMatches(input, f.expected), false);
    }
  for (const read of [1, 2, 3, 4, 5, 6]) {
    reads.length = 0;
    failAt = read;
    assert.equal(dockerProbeConfigurationMatches(f.inspect, f.expected), false);
    assert.equal(reads.length, read);
  }
});

/**
 * OS別比較と局所条件省略を実本文で反証する。
 * @responsibility Windows大小文字と他OS完全一致を混同せず、payload・Path・RW条件の省略を検出する。
 * @trace ERB-IT-004
 * @precondition 実DI本文を使用し、Filesystemとplatformだけ局所代役化する。
 * @stimulus 大小文字差と単独条件省略。
 * @observation boolean。
 * @oracle Windowsのcase差のみ受理。各省略変異は独立した拒否期待に反する。
 * @cleanup fixtureの実Directoryを終了hookで回収する。
 * @boundary このVM部分は実Filesystemの証明ではない。
 */
test("Probe構成のOS比較と条件省略変異を区別する", (t) => {
  const f = fixture(t);
  const text = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/execution/probe-configuration.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import fs from "node:fs";\r?\n/m, "")
    .replace(
      /^import \{ describeDockerProbeResource \} from "\.\/probe-command.ts";\r?\n/m,
      "",
    )
    .replaceAll("export function ", "function ");
  for (const platform of ["win32", "linux"]) {
    let call = 0;
    const match = runInNewContext(
      `(()=>{${text};return dockerProbeConfigurationMatches})()`,
      {
        process: { platform },
        describeDockerProbeResource,
        fs: {
          realpathSync: {
            native: () => (++call % 2 ? "C:/UPPER" : "c:/upper"),
          },
        },
      },
    ) as typeof dockerProbeConfigurationMatches;
    assert.equal(match(f.inspect, f.expected), platform === "win32");
  }
  const membership = "!expected.sourceCandidates.includes(command[1])";
  assert.ok(text.includes(membership));
  const mutant = runInNewContext(
    `(()=>{${text.replace(membership, "false")};return dockerProbeConfigurationMatches})()`,
    {
      process: { platform: process.platform },
      fs,
      describeDockerProbeResource,
    },
  ) as typeof dockerProbeConfigurationMatches;
  const other = structuredClone(f.inspect);
  other.Config.Cmd[1] = "unknown";
  assert.equal(dockerProbeConfigurationMatches(other, f.expected), false);
  assert.throws(() => assert.equal(mutant(other, f.expected), false));
  const pathComparison =
    /if \(\s*process\.platform === "win32"[\s\S]*?\)\s*return false;/u;
  assert.ok(pathComparison.test(text));
  const noPathCheck = runInNewContext(
    `(()=>{${text.replace(pathComparison, "")};return dockerProbeConfigurationMatches})()`,
    {
      process: { platform: process.platform },
      fs,
      describeDockerProbeResource,
    },
  ) as typeof dockerProbeConfigurationMatches;
  for (let axis = 0; axis < 3; axis++) {
    const value = structuredClone(f.inspect);
    changeField(value, `Mounts.${axis}.Source`, f.directory);
    assert.equal(dockerProbeConfigurationMatches(value, f.expected), false);
    assert.throws(() => assert.equal(noPathCheck(value, f.expected), false));
  }
  const rwCheck = 'ownProbeInspectValue(mount, "RW") !== true';
  assert.ok(text.includes(rwCheck));
  const noRwCheck = runInNewContext(
    `(()=>{${text.replace(rwCheck, "false")};return dockerProbeConfigurationMatches})()`,
    {
      process: { platform: process.platform },
      fs,
      describeDockerProbeResource,
    },
  ) as typeof dockerProbeConfigurationMatches;
  for (let axis = 0; axis < 3; axis++) {
    const value = structuredClone(f.inspect);
    changeField(value, `Mounts.${axis}.RW`, false);
    assert.equal(dockerProbeConfigurationMatches(value, f.expected), false);
    assert.throws(() => assert.equal(noRwCheck(value, f.expected), false));
  }
});

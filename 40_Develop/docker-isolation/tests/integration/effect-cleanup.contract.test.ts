/**
 * 技術清掃の既存反証を責務Ownerへ移管する。
 * @packageDocumentation
 * @responsibility Receipt・所有Handle・実構成・ID/名前不存在を同じ技術Runtimeで照合する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 模擬Docker Process。実Provider成功は主張しない。
 * @boundary 技術Plan→固定実行→清掃と現在観測。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  planDockerIsolationCommands,
  dockerContainerInitObservationMatches,
  type DockerIsolationCommandInput,
  type DockerIsolationCommand,
  type DockerIsolationRuntimePlan,
  type OwnedCommandHandle,
} from "../../src/index.ts";
import { createDockerIsolationRuntimeCandidate } from "../../src/execution/execute.ts";

/**
 * createEffectFixtureのTest準備責務を実行する。
 *
 * @responsibility createEffectFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createEffectFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
function createEffectFixture(
  options: Readonly<{
    protectedWorkspace?: boolean;
    initRequired?: boolean;
    configEntries?: readonly string[];
    outputForInvocation?: (
      argv: readonly string[],
      invocationIndex: number,
    ) => Readonly<{
      status: number | null;
      signal: NodeJS.Signals | null;
      stdout: string;
      stderr: string;
      outputExceeded: boolean;
    }>;
    internalNetworkReceiptId?: string;
    authReceiptId?: string;
    proxyReceiptId?: string;
    providerReceiptId?: string;
    missingReceiptPurpose?: string;
    withFullReceipts?: boolean;
    unknownReceiptPurpose?: string;
    handleForInvocation?: (
      invocationIndex: number,
    ) => OwnedCommandHandle | null;
  }> = {},
) {
  const managementCapability = Object.freeze({});
  const configuration: DockerIsolationCommandInput = {
    authenticationContainerName: "crdd-auth-0101010101010101",
    executionContainerName: "crdd-codex-0202020202020202",
    proxyContainerName: "crdd-proxy-0303030303030303",
    internalNetworkName: "crdd-internal-0404040404040404",
    egressNetworkName: "crdd-egress-0505050505050505",
    ownershipLabel: "crdd.coordinator.runtime=0606060606060606",
    executionImageDigest: `sha256:${"a".repeat(64)}`,
    proxyImageDigest: `sha256:${"b".repeat(64)}`,
    homeSourcePath: path.resolve("fixture-home"),
    temporarySourcePath: path.resolve("fixture-tmp"),
    workspace: options.protectedWorkspace
      ? {
          sourcePath: path.resolve("fixture-workspace"),
          readOnly: false,
          protection: {
            gitSourcePath: path.resolve("mask-git"),
            internalSourcePath: path.resolve("mask-internal"),
          },
        }
      : null,
    authentication: { argv: ["auth", "status"], environment: {} },
    execution: {
      argv: ["exec"],
      environment: {},
      interactive: true,
      initRequired: options.initRequired ?? false,
      seccompProfile: null,
    },
    proxy: {
      profile: "fixture",
      token: "7".repeat(64),
      port: 8080,
      extendedProxyEnvironment: true,
    },
  };
  const commands = planDockerIsolationCommands(configuration);
  assert.ok(commands);
  const plan = Object.freeze({
    identity: "a".repeat(64),
    configuration,
    stdin: "fixed input",
    commands,
    authContainerName: configuration.authenticationContainerName,
    providerContainerName: configuration.executionContainerName,
    proxyContainerName: configuration.proxyContainerName,
    internalNetworkName: configuration.internalNetworkName,
    egressNetworkName: configuration.egressNetworkName,
    ownershipLabel: configuration.ownershipLabel,
    providerImageDigest: configuration.executionImageDigest,
    proxyImageDigest: configuration.proxyImageDigest,
  });
  const invocations: Array<{
    executable: string;
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
    stdin: string | null;
  }> = [];
  let configCreated = 0;
  let configRemoved = 0;
  const candidate = createDockerIsolationRuntimeCandidate({
    environment: () => Object.freeze({ SystemRoot: "C:\\Windows" }),
    platform: "win32",
    borrowPaths: () =>
      Object.freeze({
        tmp: configuration.temporarySourcePath,
        management: "C:\\operation\\management",
      }),
    readCli: () =>
      Object.freeze({
        executablePath:
          "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
        rootIdentity: "root",
        executableIdentity: "executable",
        bytes: 43_247_024,
        sha256:
          "60028870931EA6E91955BFEAEE358EC6C6920F6162C17A3D828C3C82AB3C3599",
        publisherOrganization: "Docker Inc",
        trustBasis: "windows_authenticode_valid_docker_inc_publisher",
      }),
    verifyCli: () => undefined,
    createConfig: () => {
      configCreated += 1;
      return Object.freeze({
        directory: "C:\\operation\\management\\docker-cli-config",
        identity: "config",
      });
    },
    verifyConfig: () => undefined,
    configEntries: () => Object.freeze([...(options.configEntries ?? [])]),
    removeConfig: () => {
      configRemoved += 1;
    },
    startProcess: (executable, argv, environment, stdin) => {
      invocations.push({ executable, argv, environment, stdin });
      const injectedHandle = options.handleForInvocation?.(
        invocations.length - 1,
      );
      if (injectedHandle) return injectedHandle;
      let closed = false;
      const completion = Object.freeze(
        options.outputForInvocation?.(argv, invocations.length - 1) ?? {
          status: 0,
          signal: null,
          stdout: "",
          stderr: "",
          outputExceeded: false,
        },
      );
      return Object.freeze({
        started: async () => true,
        wait: async () => {
          closed = true;
          return completion;
        },
        terminateAndWait: async () => {
          closed = true;
          return true;
        },
        closed: () => closed,
      });
    },
    ...(options.internalNetworkReceiptId ||
    options.authReceiptId ||
    options.proxyReceiptId ||
    options.providerReceiptId ||
    options.missingReceiptPurpose ||
    options.withFullReceipts
      ? {
          inspectReceipts: () =>
            // 欠落fieldの負例を維持し、型保証ではなくRuntime検査へ渡す。
            Object.freeze(
              Object.fromEntries(
                Object.entries({
                  create_subscription_auth_probe: Object.freeze({
                    submitted: options.authReceiptId !== undefined,
                    dockerId: options.authReceiptId ?? null,
                  }),
                  create_internal_network: Object.freeze({
                    submitted: options.internalNetworkReceiptId !== undefined,
                    dockerId: options.internalNetworkReceiptId ?? null,
                  }),
                  create_egress_network: Object.freeze({
                    submitted: false,
                    dockerId: null,
                  }),
                  create_proxy: Object.freeze({
                    submitted: options.proxyReceiptId !== undefined,
                    dockerId: options.proxyReceiptId ?? null,
                  }),
                  create_provider: Object.freeze({
                    submitted: options.providerReceiptId !== undefined,
                    dockerId: options.providerReceiptId ?? null,
                  }),
                })
                  .filter(
                    ([purpose]) => purpose !== options.missingReceiptPurpose,
                  )
                  .map(([purpose, receipt]) => [
                    purpose,
                    purpose === options.unknownReceiptPurpose
                      ? Object.freeze({ submitted: true, dockerId: null })
                      : receipt,
                  ]),
              ),
            ) as unknown as ReturnType<
              NonNullable<
                Parameters<
                  typeof createDockerIsolationRuntimeCandidate
                >[0]["inspectReceipts"]
              >
            >,
        }
      : {}),
  });
  // この試験用表記変換はPurpose選択とidentity fieldだけを搬送する。
  // Docker構成・Receipt・清掃判定はcandidate実装だけが行う。
  const runtime = Object.freeze({
    startCommand: (
      command: DockerIsolationCommand,
      input: DockerIsolationRuntimePlan,
      owner: object,
    ) => candidate.startCommand(command.purpose, input, owner),
    cleanupOwnedResources: candidate.cleanupOwnedResources,
    verifyCleanupOutcome: (
      result: unknown,
      input: DockerIsolationRuntimePlan,
      recovery: unknown,
      owner: unknown,
    ) =>
      candidate.verifyCleanupOutcome(result, input.identity, recovery, owner),
  });
  return {
    runtime,
    plan,
    managementCapability,
    recoveryCapability: Object.freeze({}),
    invocations,
    counts: () => ({ configCreated, configRemoved }),
  };
}

/**
 * 保護付き計画を通常回収本体のinspectへ接続する。
 * @responsibility 単体Oracleだけでなく実Runtimeの期待値搬送を反証する。
 * @trace ERB-IT-004
 * @precondition 固定五Mount観測と有限Docker Transport。
 * @stimulus 正常、保護欠落、RW化、Source差。
 * @observation cleanup結果と元IDのrm発行。
 * @oracle 正常だけ回収し、不整合ではrm0。
 * @cleanup 実Docker・Process資源は作らない。
 * @boundary 本番command-runtime→inspect構成照合→清掃。
 */
test("通常Runtimeは保護付きWorkspaceの五Mountを照合して回収する", async () => {
  for (const mode of ["normal", "missing", "rw", "source"] as const) {
    const dockerId = "d".repeat(64);
    let fixture: ReturnType<typeof createEffectFixture>;
    fixture = createEffectFixture({
      protectedWorkspace: true,
      providerReceiptId: dockerId,
      outputForInvocation: (argv) => {
        const c = fixture.plan.configuration;
        const protection = c.workspace?.protection;
        assert.ok(protection);
        let mounts = [
          {
            Type: "bind",
            Source: c.homeSourcePath,
            Destination: "/provider-home",
            RW: true,
            Propagation: "rprivate",
          },
          {
            Type: "bind",
            Source: c.temporarySourcePath,
            Destination: "/tmp",
            RW: true,
            Propagation: "rprivate",
          },
          {
            Type: "bind",
            Source: c.workspace?.sourcePath,
            Destination: "/work",
            RW: true,
            Propagation: "rprivate",
          },
          {
            Type: "bind",
            Source: protection.gitSourcePath,
            Destination: "/work/.git",
            RW: false,
            Propagation: "rprivate",
          },
          {
            Type: "bind",
            Source: protection.internalSourcePath,
            Destination: "/work/.crdd",
            RW: false,
            Propagation: "rprivate",
          },
        ];
        if (mode === "missing") mounts = mounts.slice(0, -1);
        if (mode === "rw")
          mounts = mounts.map((m) =>
            m.Destination === "/work/.git" ? { ...m, RW: true } : m,
          );
        if (mode === "source")
          mounts = mounts.map((m) =>
            m.Destination === "/work/.git"
              ? { ...m, Source: path.resolve("different") }
              : m,
          );
        const observed = {
          Id: dockerId,
          Name: "/" + c.executionContainerName,
          Config: {
            Labels: {
              "crdd.coordinator.runtime": c.ownershipLabel.split("=")[1],
            },
            Image: c.executionImageDigest,
            User: "65534:65534",
          },
          HostConfig: {
            ReadonlyRootfs: true,
            Privileged: false,
            CapDrop: ["ALL"],
            CapAdd: null,
            SecurityOpt: ["no-new-privileges"],
            PidsLimit: 0,
            Init: false,
          },
          NetworkSettings: { Networks: { [c.internalNetworkName]: {} } },
          Mounts: mounts,
        };
        return {
          status: 0,
          signal: null,
          stdout: argv.includes("inspect") ? JSON.stringify([observed]) : "",
          stderr: "",
          outputExceeded: false,
        };
      },
    });
    const cleanup = await fixture.runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    );
    assert.equal(cleanup.confirmed, mode === "normal", mode);
    assert.equal(
      fixture.invocations.some(
        ({ argv }) => argv.includes("rm") && argv.includes(dockerId),
      ),
      mode === "normal",
      mode,
    );
  }
});

type SanitizedAuthProbeInspectFixture = Readonly<{
  source: string;
  engineVersion: string;
  createArgv: readonly string[];
  inspect: Readonly<Record<string, unknown>>;
}>;

/**
 * loadSanitizedAuthProbeInspectFixtureのTest準備責務を実行する。
 *
 * @responsibility loadSanitizedAuthProbeInspectFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus loadSanitizedAuthProbeInspectFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
function loadSanitizedAuthProbeInspectFixture() {
  return JSON.parse(
    fs.readFileSync(
      new URL(
        "../fixtures/docker-auth-probe-inspect-none.json",
        import.meta.url,
      ),
      "utf8",
    ),
  ) as SanitizedAuthProbeInspectFixture;
}

/**
 * authProbeInspectOutputのTest準備責務を実行する。
 *
 * @responsibility authProbeInspectOutputがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus authProbeInspectOutputを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
function authProbeInspectOutput(
  fixture: ReturnType<typeof createEffectFixture>,
  dockerId: string,
  networks: Readonly<Record<string, unknown>>,
) {
  const observed = loadSanitizedAuthProbeInspectFixture();
  assert.equal(observed.source, "sanitized_real_docker_inspect_subset");
  assert.equal(observed.engineVersion, "28.1.1");
  const observedNetworkArguments = observed.createArgv.filter((value) =>
    value.startsWith("--network"),
  );
  const authCommand = fixture.plan.commands.find(
    (command) => command.purpose === "create_subscription_auth_probe",
  );
  assert.ok(authCommand);
  const plannedNetworkArguments = authCommand.argv.filter((value) =>
    value.startsWith("--network"),
  );
  assert.deepEqual(observedNetworkArguments, ["--network=none"]);
  assert.deepEqual(plannedNetworkArguments, observedNetworkArguments);
  const inspect = structuredClone(observed.inspect) as Record<string, unknown>;
  inspect.Id = dockerId;
  inspect.Name = `/${fixture.plan.authContainerName}`;
  const config = inspect.Config as Record<string, unknown>;
  config.Image = fixture.plan.providerImageDigest;
  config.Labels = {
    "crdd.coordinator.runtime": fixture.plan.ownershipLabel.slice(
      fixture.plan.ownershipLabel.indexOf("=") + 1,
    ),
  };
  (inspect.NetworkSettings as Record<string, unknown>).Networks = networks;
  return JSON.stringify([inspect]);
}

/**
 * 全purposeの未評価を未要求・不存在へ補完しないことを確認する。
 *
 * @responsibility Receipt欠測時の資源処置停止と診断領域保持を反証する。
 * @trace ERB-IT-004
 * @precondition 模擬Dockerと完全Receiptを生成する自己所有Fixtureを使う。
 * @stimulus 五purposeを一つずつ欠測させ、通常清掃を呼ぶ。
 * @observation 清掃結果、Docker要求数、config保持を確認する。
 * @oracle 欠測は回収未確認であり、削除要求とconfig除去を発行しない。
 * @cleanup N/A: FixtureはProcessとFilesystemを模擬し、実Docker資源を作らない。
 * @boundary ERB-IT-004=Direct Boundary: 清掃利用側と完全Receipt契約。
 */
test("通常Effect cleanupは一purposeのReceipt欠測を未要求へ補完しない", async () => {
  for (const missingReceiptPurpose of [
    "create_provider",
    "create_proxy",
    "create_subscription_auth_probe",
    "create_internal_network",
    "create_egress_network",
  ]) {
    const fixture = createEffectFixture({ missingReceiptPurpose });
    const cleanup = await fixture.runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    );
    assert.equal(cleanup.confirmed, false);
    assert.equal(cleanup.containersAbsent, false);
    assert.equal(cleanup.networksAbsent, false);
    assert.equal(cleanup.resourceObservations, null);
    assert.equal(fixture.invocations.length, 0);
    assert.equal(fixture.counts().configRemoved, 0);
    const command = fixture.plan.commands[0];
    assert.ok(command);
    assert.throws(
      () =>
        fixture.runtime.startCommand(
          command,
          fixture.plan,
          fixture.managementCapability,
        ),
      /docker_effect_attempt_stopped/u,
    );
    assert.equal(fixture.invocations.length, 0);
  }
});

/**
 * Handle終端だけでは不明なCreate結果を清掃成功にしないことを確認する。
 *
 * @responsibility Process終端とDocker資源不存在の独立した観測義務を確認する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Create結果とReceiptが不明なHandleを終端して清掃を要求する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
test("handle終了だけではCreate結果不明を資源不存在へ昇格しない", async () => {
  const fixture = createEffectFixture();
  const firstCommand = fixture.plan.commands[0];
  assert.ok(firstCommand);
  const handle = fixture.runtime.startCommand(
    firstCommand,
    fixture.plan,
    fixture.managementCapability,
  );
  await handle.wait(10_000);
  const cleanup = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recoveryCapability,
    fixture.managementCapability,
  );
  assert.deepEqual(cleanup, {
    confirmed: false,
    processTreeTerminated: true,
    containersAbsent: false,
    networksAbsent: false,
    resourceObservations: null,
  });
  const invocationCount = fixture.invocations.length;
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        firstCommand,
        fixture.plan,
        fixture.managementCapability,
      ),
    /docker_effect_attempt_stopped/u,
  );
  assert.equal(fixture.invocations.length, invocationCount);
  assert.deepEqual(fixture.counts(), {
    configCreated: 1,
    configRemoved: 0,
  });
  assert.equal(fixture.invocations.length, 1);
});

/**
 * 実清掃返却と操作・計画の相関を確認する。
 *
 * @responsibility 清掃成功のコピーや別Ownerの返却を終端根拠から排除する。
 * @trace ERB-IT-004
 * @precondition 全五purposeを未要求として模擬する独立Runtimeを使う。
 * @stimulus 清掃後に同じ返却、コピー、別Capabilityと別計画を照合する。
 * @observation 五purpose観測またはnullとDocker要求数を確認する。
 * @oracle 同じRuntime・対象だけが観測を返し、本番Ownerは模擬結果を拒否する。
 * @cleanup N/A: Process・Filesystem・Dockerを模擬し実資源を作らない。
 * @boundary ERB-IT-004=Direct Boundary: 実清掃返却→終端相関。
 */
test("清掃結果の真正相関はコピー・別操作・別計画・別Runtimeを拒否する", async () => {
  const fixture = createEffectFixture({ withFullReceipts: true });
  const result = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recoveryCapability,
    fixture.managementCapability,
  );
  assert.equal(result.confirmed, true);
  const verify = fixture.runtime.verifyCleanupOutcome;
  assert.equal(
    verify(
      result,
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    ),
    result.resourceObservations,
  );
  assert.equal(result.resourceObservations?.length, 5);
  for (const [value, plan, recovery, management] of [
    [
      { ...result },
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    ],
    [result, fixture.plan, {}, fixture.managementCapability],
    [result, fixture.plan, fixture.recoveryCapability, {}],
    [
      result,
      { ...fixture.plan, identity: "b".repeat(64) },
      fixture.recoveryCapability,
      fixture.managementCapability,
    ],
  ] as const)
    assert.equal(verify(value, plan, recovery, management), null);
  const other = createEffectFixture({ withFullReceipts: true });
  assert.equal(
    other.runtime.verifyCleanupOutcome(
      result,
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(fixture.invocations.length, 0);
});

/**
 * Process終端後も結果不明のCreateを成功根拠にしない。
 *
 * @responsibility 五purposeのID不明を未要求や不存在へ丸めないことを確認する。
 * @trace ERB-IT-004
 * @precondition 一種類だけ発行済み・ID不明で、他の四種類は未要求である。
 * @stimulus 全Handle終了可能なFixtureで通常清掃と真正結果照合を行う。
 * @observation 清掃状態、対象観測、結果借用、同じ計画の再要求と発行数。
 * @oracle 全purposeで不明が維持され、成功根拠と再要求を拒否する。
 * @cleanup Fixtureは実Docker、Process、Filesystem資源を作成しない。
 * @boundary Effect OwnerのCreate結果不明から終端根拠への境界。
 */
test("五purposeのCreate結果不明はProcess終端だけで清掃成功にならない", async () => {
  for (const purpose of [
    "create_egress_network",
    "create_internal_network",
    "create_provider",
    "create_proxy",
    "create_subscription_auth_probe",
  ]) {
    const fixture = createEffectFixture({
      withFullReceipts: true,
      unknownReceiptPurpose: purpose,
    });
    const result = await fixture.runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    );
    assert.equal(result.processTreeTerminated, true);
    assert.equal(result.confirmed, false);
    assert.equal(
      result.resourceObservations?.find((value) => value.purpose === purpose)
        ?.observation,
      "unknown",
    );
    assert.equal(
      fixture.runtime.verifyCleanupOutcome(
        result,
        fixture.plan,
        fixture.recoveryCapability,
        fixture.managementCapability,
      ),
      null,
    );
    assert.equal(fixture.counts().configRemoved, 0);
    const command = fixture.plan.commands[0];
    assert.ok(command);
    assert.throws(
      () =>
        fixture.runtime.startCommand(
          command,
          fixture.plan,
          fixture.managementCapability,
        ),
      /docker_effect_attempt_stopped/u,
    );
    assert.equal(fixture.invocations.length, 0);
  }
});

/**
 * 実行errorの後もstartCommandの未close handleを回収まで保持するを検証する。
 *
 * @responsibility 実行errorの後もstartCommandの未close handleを回収まで保持するの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行errorの後もstartCommandの未close handleを回収まで保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
test("実行errorの後もstartCommandの未close handleを回収まで保持する", async () => {
  let closed = false;
  let terminationCalls = 0;
  const handle = Object.freeze({
    started: async () => true,
    wait: async () =>
      Object.freeze({
        status: null,
        signal: null,
        stdout: "",
        stderr: "",
        outputExceeded: false,
      }),
    terminateAndWait: async () => {
      terminationCalls += 1;
      return closed;
    },
    closed: () => closed,
  });
  const fixture = createEffectFixture({
    handleForInvocation: (index) => (index === 0 ? handle : null),
  });
  const command = fixture.plan.commands[0];
  assert.ok(command);
  const owned = fixture.runtime.startCommand(
    command,
    fixture.plan,
    fixture.managementCapability,
  );
  assert.equal((await owned.wait(10))?.status, null);
  const first = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recoveryCapability,
    fixture.managementCapability,
  );
  assert.equal(first.confirmed, false);
  assert.equal(first.processTreeTerminated, false);
  assert.equal(fixture.counts().configRemoved, 0);
  closed = true;
  const second = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recoveryCapability,
    fixture.managementCapability,
  );
  assert.equal(second.confirmed, false);
  assert.equal(second.processTreeTerminated, true);
  assert.equal(second.resourceObservations, null);
  assert.equal(terminationCalls, 2);
  assert.deepEqual(fixture.counts(), { configCreated: 1, configRemoved: 0 });
});

/**
 * candidate/receipt cleanup中のrunShort errorもcloseまで所有し設定を保持するを検証する。
 *
 * @responsibility candidate/receipt cleanup中のrunShort errorもcloseまで所有し設定を保持するの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus candidate/receipt cleanup中のrunShort errorもcloseまで所有し設定を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
test("candidate/receipt cleanup中のrunShort errorもcloseまで所有し設定を保持する", async () => {
  for (const shouldUseReceipts of [true]) {
    let closed = false;
    let terminationCalls = 0;
    const authReceiptId = "a".repeat(64);
    const handle = Object.freeze({
      started: async () => true,
      wait: async () =>
        Object.freeze({
          status: null,
          signal: null,
          stdout: "",
          stderr: "",
          outputExceeded: false,
        }),
      terminateAndWait: async () => {
        terminationCalls += 1;
        return closed;
      },
      closed: () => closed,
    });
    const fixture = createEffectFixture({
      ...(shouldUseReceipts ? { authReceiptId } : {}),
      handleForInvocation: (index) => (index === 0 ? handle : null),
      outputForInvocation: (argv) =>
        Object.freeze({
          status: 0,
          signal: null,
          stdout: argv.includes("inspect")
            ? authProbeInspectOutput(fixture, authReceiptId, { none: {} })
            : "",
          stderr: "",
          outputExceeded: false,
        }),
    });
    const first = await fixture.runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    );
    assert.equal(first.containersAbsent, false);
    assert.equal(first.networksAbsent, true);
    assert.equal(first.processTreeTerminated, false);
    assert.equal(first.confirmed, false);
    if (shouldUseReceipts) {
      assert.equal(
        first.resourceObservations?.find(
          (resource) => resource.purpose === "create_subscription_auth_probe",
        )?.observation,
        "unknown",
      );
    } else {
      assert.equal(first.resourceObservations, null);
    }
    assert.equal(fixture.counts().configRemoved, 0);
    assert.equal(terminationCalls, 1);
    const second = await fixture.runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    );
    assert.equal(second.confirmed, false);
    assert.equal(second.processTreeTerminated, false);
    assert.equal(second.containersAbsent, true);
    assert.equal(second.networksAbsent, true);
    assert.equal(terminationCalls, 2);
    assert.equal(fixture.counts().configRemoved, 0);
    closed = true;
    const third = await fixture.runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    );
    assert.equal(third.confirmed, true);
    assert.equal(terminationCalls, 3);
    assert.deepEqual(fixture.counts(), { configCreated: 1, configRemoved: 1 });
  }
});

/**
 * foreign labelまたはconfig残存はcleanupとRecovery完了を止めるを検証する。
 *
 * @responsibility foreign labelまたはconfig残存はcleanupとRecovery完了を止めるの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus foreign labelまたはconfig残存はcleanupとRecovery完了を止めるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
test("foreign labelまたはconfig残存はcleanupとRecovery完了を止める", async () => {
  const foreign = createEffectFixture({
    outputForInvocation: (argv) =>
      argv.includes("container") && argv.includes("ls")
        ? Object.freeze({
            status: 0,
            signal: null,
            stdout: `${argv[argv.indexOf("--filter") + 1]?.replace("name=^/", "").replace("$", "")}|foreign\n`,
            stderr: "",
            outputExceeded: false,
          })
        : Object.freeze({
            status: 0,
            signal: null,
            stdout: "",
            stderr: "",
            outputExceeded: false,
          }),
  });
  const foreignCleanup = await foreign.runtime.cleanupOwnedResources(
    foreign.plan,
    foreign.recoveryCapability,
    foreign.managementCapability,
  );
  assert.equal(foreignCleanup.confirmed, false);
  assert.equal(foreignCleanup.containersAbsent, false);
  assert.equal(foreign.counts().configRemoved, 0);

  const residue = createEffectFixture({
    withFullReceipts: true,
    configEntries: ["unexpected.json"],
  });
  const residueCleanup = await residue.runtime.cleanupOwnedResources(
    residue.plan,
    residue.recoveryCapability,
    residue.managementCapability,
  );
  assert.equal(residueCleanup.confirmed, false);
  assert.equal(residueCleanup.containersAbsent, true);
  assert.equal(residueCleanup.networksAbsent, true);
  assert.equal(residue.counts().configRemoved, 0);
});

/**
 * exact ID削除後に同名replacementが残ればcleanupを完了しないを検証する。
 *
 * @responsibility exact ID削除後に同名replacementが残ればcleanupを完了しないの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus exact ID削除後に同名replacementが残ればcleanupを完了しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
test("exact ID削除後に同名replacementが残ればcleanupを完了しない", async () => {
  const dockerId = "a".repeat(64);
  let expectedName = "";
  const fixture = createEffectFixture({
    internalNetworkReceiptId: dockerId,
    outputForInvocation: (argv) => {
      if (argv.includes("inspect")) {
        expectedName = fixture.plan.internalNetworkName;
        return Object.freeze({
          status: 0,
          signal: null,
          stdout: JSON.stringify([
            {
              Id: dockerId,
              Name: expectedName,
              Labels: {
                "crdd.coordinator.runtime": fixture.plan.ownershipLabel.slice(
                  fixture.plan.ownershipLabel.indexOf("=") + 1,
                ),
              },
              Driver: "bridge",
              Scope: "local",
              Internal: true,
            },
          ]),
          stderr: "",
          outputExceeded: false,
        });
      }
      const isNameAbsenceCheck = argv.some(
        (value) => value === `name=^${expectedName}$`,
      );
      return Object.freeze({
        status: 0,
        signal: null,
        stdout: isNameAbsenceCheck ? `${"b".repeat(64)}\n` : "",
        stderr: "",
        outputExceeded: false,
      });
    },
  });
  const cleanup = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recoveryCapability,
    fixture.managementCapability,
  );
  assert.equal(cleanup.confirmed, false);
  assert.equal(cleanup.networksAbsent, false);
  assert.equal(fixture.counts().configRemoved, 0);
});

/**
 * 通常Effect cleanupは実測同形の認証Probe none Networkだけを回収するを検証する。
 *
 * @responsibility 通常Effect cleanupは実測同形の認証Probe none Networkだけを回収するの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常Effect cleanupは実測同形の認証Probe none Networkだけを回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
test("通常Effect cleanupは実測同形の認証Probe none Networkだけを回収する", async () => {
  const dockerId = "c".repeat(64);
  let fixture: ReturnType<typeof createEffectFixture>;
  fixture = createEffectFixture({
    authReceiptId: dockerId,
    outputForInvocation: (argv) =>
      Object.freeze({
        status: 0,
        signal: null,
        stdout: argv.includes("inspect")
          ? authProbeInspectOutput(fixture, dockerId, { none: {} })
          : "",
        stderr: "",
        outputExceeded: false,
      }),
  });
  const cleanup = await fixture.runtime.cleanupOwnedResources(
    fixture.plan,
    fixture.recoveryCapability,
    fixture.managementCapability,
  );
  assert.deepEqual(cleanup, {
    confirmed: true,
    processTreeTerminated: true,
    containersAbsent: true,
    networksAbsent: true,
    resourceObservations: [
      {
        purpose: "create_egress_network",
        plannedResourceName: fixture.plan.egressNetworkName,
        dockerId: null,
        observation: "not_requested",
      },
      {
        purpose: "create_internal_network",
        plannedResourceName: fixture.plan.internalNetworkName,
        dockerId: null,
        observation: "not_requested",
      },
      {
        purpose: "create_provider",
        plannedResourceName: fixture.plan.providerContainerName,
        dockerId: null,
        observation: "not_requested",
      },
      {
        purpose: "create_proxy",
        plannedResourceName: fixture.plan.proxyContainerName,
        dockerId: null,
        observation: "not_requested",
      },
      {
        purpose: "create_subscription_auth_probe",
        plannedResourceName: fixture.plan.authContainerName,
        dockerId,
        observation: "absent",
      },
    ],
  });
  assert.equal(
    fixture.invocations.some(
      ({ argv }) =>
        argv.includes("rm") &&
        argv.includes("--force") &&
        argv.includes(dockerId),
    ),
    true,
  );
  assert.equal(fixture.counts().configRemoved, 1);
});

/**
 * 通常Effect cleanupは認証Probeの空・別・追加Networkを削除しないを検証する。
 *
 * @responsibility 通常Effect cleanupは認証Probeの空・別・追加Networkを削除しないの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 通常Effect cleanupは認証Probeの空・別・追加Networkを削除しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: docker-isolation Test Source→対象契約
 */
test("通常Effect cleanupは認証Probeの空・別・追加Networkを削除しない", async () => {
  const cases = [
    Object.freeze({}),
    Object.freeze({ foreign: Object.freeze({}) }),
    Object.freeze({ none: Object.freeze({}), foreign: Object.freeze({}) }),
  ];
  for (const [index, networks] of cases.entries()) {
    const dockerId = String(index + 1).repeat(64);
    let fixture: ReturnType<typeof createEffectFixture>;
    fixture = createEffectFixture({
      authReceiptId: dockerId,
      outputForInvocation: (argv) =>
        Object.freeze({
          status: 0,
          signal: null,
          stdout: argv.includes("inspect")
            ? authProbeInspectOutput(fixture, dockerId, networks)
            : "",
          stderr: "",
          outputExceeded: false,
        }),
    });
    const cleanup = await fixture.runtime.cleanupOwnedResources(
      fixture.plan,
      fixture.recoveryCapability,
      fixture.managementCapability,
    );
    assert.equal(cleanup.confirmed, false);
    assert.equal(cleanup.containersAbsent, false);
    assert.equal(
      fixture.invocations.some(
        ({ argv }) => argv.includes("rm") && argv.includes("--force"),
      ),
      false,
    );
    assert.equal(fixture.counts().configRemoved, 0);
  }
});

/**
 * 通常清掃でもCodex助言専用initの欠測と対象外混入を拒否する。
 *
 * @responsibility 起動計画に結合したProvider receiptを清掃前に再検査する。
 * @trace ERB-IT-004
 * @precondition init要否を指定した技術Planと合成inspect応答を使う。
 * @stimulus 通常清掃へexact Provider receiptを渡す。
 * @observation 構成判定、削除発行と清掃完了値を観測する。
 * @oracle Codex助言はtrueだけ、Claude助言は未記載／null／falseだけを受理し、不一致で削除0となる。
 * @cleanup N/A: 疑似Docker Processは各waitで終了し実Containerを作らない。
 * @boundary ERB-IT-004=Direct Boundary: Provider receipt→清掃前inspect
 */
test("通常清掃でもCodex助言専用initの欠測と対象外混入を拒否する", async () => {
  for (const initRequired of [true, false]) {
    for (const init of [true, null, false, undefined, "false", 1]) {
      const isExpected = initRequired
        ? init === true
        : init === undefined || init === null || init === false;
      const providerId = "c".repeat(64);
      const fixture = createEffectFixture({
        initRequired,
        providerReceiptId: providerId,
        outputForInvocation: (argv) => {
          const observed = structuredClone(
            loadSanitizedAuthProbeInspectFixture().inspect,
          ) as Record<string, unknown>;
          observed.Id = providerId;
          observed.Name = `/${fixture.plan.providerContainerName}`;
          observed.Config = {
            User: "65534:65534",
            Image: fixture.plan.providerImageDigest,
            Labels: {
              "crdd.coordinator.runtime":
                fixture.plan.ownershipLabel.split("=")[1],
            },
          };
          observed.HostConfig = {
            ...(observed.HostConfig as Record<string, unknown>),
            PidsLimit: 0,
            Init: init,
          };
          observed.Mounts = ["/provider-home", "/tmp"].map((destination) => ({
            Type: "bind",
            Destination: destination,
            RW: true,
            Propagation: "rprivate",
          }));
          observed.NetworkSettings = {
            Networks: { [fixture.plan.internalNetworkName]: {} },
          };
          return Object.freeze({
            status: 0,
            signal: null,
            stdout: argv.includes("inspect") ? JSON.stringify([observed]) : "",
            stderr: "",
            outputExceeded: false,
          });
        },
      });
      const result = await fixture.runtime.cleanupOwnedResources(
        fixture.plan,
        fixture.recoveryCapability,
        fixture.managementCapability,
      );
      assert.equal(result.confirmed, isExpected);
      assert.equal(
        fixture.invocations.filter((call) => call.argv.includes("rm")).length,
        isExpected ? 1 : 0,
      );
    }
  }
});

/**
 * Initの省略と不正なHostConfigを混同しない。
 *
 * @responsibility 通常清掃と回復が共有するwire判定の拒否境界を確認する。
 * @trace ERB-IT-004
 * @precondition DockerのJSON形と、JSONでは到達しない不正構造を用意する。
 * @stimulus 必須／対象外の両方で判定を呼び出す。
 * @observation 判定値とaccessor呼出し回数を観測する。
 * @oracle 必須はown trueのみ、対象外は未記載／null／falseのみ、不正構造と型は拒否する。
 * @cleanup N/A: 局所値だけを使い外部資源を作らない。
 * @boundary ERB-IT-004=Direct Boundary: inspect JSON→共有構成判定
 */
test("Initの省略と不正なHostConfigを混同しない", () => {
  let getterCalls = 0;
  const accessor = Object.defineProperty({}, "Init", {
    get: () => {
      getterCalls += 1;
      return true;
    },
  });
  for (const isInitRequired of [false, true]) {
    for (const invalid of [
      undefined,
      null,
      [],
      "HostConfig",
      { Init: undefined },
      { Init: "false" },
      { Init: 1 },
      { Init: {} },
      Object.create({ Init: true }),
      accessor,
    ])
      assert.equal(
        dockerContainerInitObservationMatches(invalid, isInitRequired),
        false,
      );
    assert.equal(
      dockerContainerInitObservationMatches({}, isInitRequired),
      !isInitRequired,
    );
    assert.equal(
      dockerContainerInitObservationMatches({ Init: null }, isInitRequired),
      !isInitRequired,
    );
    assert.equal(
      dockerContainerInitObservationMatches({ Init: false }, isInitRequired),
      !isInitRequired,
    );
    assert.equal(
      dockerContainerInitObservationMatches({ Init: true }, isInitRequired),
      isInitRequired,
    );
  }
  assert.equal(getterCalls, 0);
});

/**
 * 通常清掃でProxyと認証ProbeのInit未指定を解釈する。
 *
 * @responsibility 二用途のwire表現を通常終了でも同じ判定へ接続する。
 * @trace ERB-IT-004
 * @precondition 固定技術Planと用途別の合成inspect応答を使う。
 * @stimulus Init未記載／null／false／true／不正型を通常清掃へ渡す。
 * @observation 回収完了とrm発行件数を読む。
 * @oracle 未記載／null／falseだけで回収し、trueと不正型では削除0となる。
 * @cleanup N/A: 模擬Docker実行であり実Containerを作らない。
 * @boundary ERB-IT-004=Direct Boundary: 通常清掃→Proxy／認証Probe inspect
 */
test("通常清掃でProxyと認証ProbeのInit未指定を解釈する", async () => {
  for (const purpose of ["proxy", "auth"] as const) {
    for (const init of [undefined, null, false, true, "false", 1]) {
      const dockerId = "e".repeat(64);
      const fixture = createEffectFixture({
        initRequired: true,
        ...(purpose === "proxy"
          ? { proxyReceiptId: dockerId }
          : { authReceiptId: dockerId }),
        outputForInvocation: (argv) => {
          const observed = structuredClone(
            loadSanitizedAuthProbeInspectFixture().inspect,
          ) as Record<string, unknown>;
          observed.Id = dockerId;
          observed.Name = `/${purpose === "proxy" ? fixture.plan.proxyContainerName : fixture.plan.authContainerName}`;
          observed.Config = {
            User: "65534:65534",
            Image:
              purpose === "proxy"
                ? fixture.plan.proxyImageDigest
                : fixture.plan.providerImageDigest,
            Labels: {
              "crdd.coordinator.runtime":
                fixture.plan.ownershipLabel.split("=")[1],
            },
          };
          const hostConfig = observed.HostConfig as Record<string, unknown>;
          if (init === undefined) delete hostConfig.Init;
          else hostConfig.Init = init;
          hostConfig.PidsLimit = 0;
          if (purpose === "proxy") {
            hostConfig.Tmpfs = { "/tmp": "rw,noexec,nosuid,size=16777216" };
            observed.Mounts = [];
            observed.NetworkSettings = {
              Networks: {
                [fixture.plan.internalNetworkName]: {},
                [fixture.plan.egressNetworkName]: {},
              },
            };
          } else observed.NetworkSettings = { Networks: { none: {} } };
          return Object.freeze({
            status: 0,
            signal: null,
            stdout: argv.includes("inspect") ? JSON.stringify([observed]) : "",
            stderr: "",
            outputExceeded: false,
          });
        },
      });
      const result = await fixture.runtime.cleanupOwnedResources(
        fixture.plan,
        fixture.recoveryCapability,
        fixture.managementCapability,
      );
      const isExpected = init === undefined || init === null || init === false;
      assert.equal(result.confirmed, isExpected, `${purpose}:${String(init)}`);
      assert.equal(
        fixture.invocations.filter((call) => call.argv.includes("rm")).length,
        isExpected ? 1 : 0,
      );
    }
  }
});

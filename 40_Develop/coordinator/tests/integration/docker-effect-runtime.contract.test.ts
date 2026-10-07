/**
 * coordinator:integration:docker-effect-runtimeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-effect-runtimeが所有する検証責務を実行する。
 * @trace ERB-IT-004
 * @level IT
 * @scope docker、effect、runtime
 * @boundary ERB-IT-004=Direct Boundary: Observer→Effect Gate
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createIsolatedClaudeDockerRuntimeAdapterCandidate } from "../../src/provider/claude-docker-runtime-adapter.ts";
import { createIsolatedCodexDockerRuntimeAdapterCandidate } from "../../src/provider/codex-docker-runtime-adapter.ts";
import { dockerContainerInitObservationMatches } from "../../src/docker-runtime/docker-container-init-observation.ts";
import {
  createIsolatedDockerEffectRuntimeCandidate,
  describeDockerEffectRuntimeContract,
} from "../../src/docker-runtime/docker-effect-runtime.ts";
import type { OwnedCommandHandle } from "../../src/docker-runtime/docker-owned-process.ts";
import { planWorkbenchAiAdviceProviderCommand } from "../../src/workbench-ai/workbench-ai-advice-provider-command.ts";

/**
 * createPlanFixtureのTest準備責務を実行する。
 *
 * @responsibility createPlanFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createPlanFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
function createPlanFixture(
  taskRole: "executor" | "reviewer" | null = null,
  isAdvice = false,
  provider: "codex" | "claude" = "claude",
  isCompatibilityTask = false,
) {
  const profileId =
    provider === "codex"
      ? isCompatibilityTask
        ? "PROFILE-100003"
        : "PROFILE-100001"
      : "PROFILE-200001";
  const model =
    provider === "codex"
      ? isCompatibilityTask
        ? "gpt-5.5"
        : "gpt-6.1-sol"
      : "opus";
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const mountAuthorizationCapability = Object.freeze({});
  const selectionUseCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  const authorityUseCapability = Object.freeze({});
  const authorityControlCapability = Object.freeze({});
  let randomValue = 0;
  const createAdapter =
    provider === "codex"
      ? createIsolatedCodexDockerRuntimeAdapterCandidate
      : createIsolatedClaudeDockerRuntimeAdapterCandidate;
  const adapter = createAdapter({
    verifyOperationMount: () =>
      Object.freeze({
        operationId: "OP-123456",
        createdAt: "2026-08-25T00:00:00.000Z",
        mounts: Object.freeze({
          workspace: "C:\\operation\\workspace",
          providerHome: "C:\\operation\\provider-home",
          tmp: "C:\\operation\\tmp",
          events: "C:\\operation\\events",
          projection: "C:\\operation\\projection",
          management: "C:\\operation\\management",
        }),
      }),
    activateMount: () =>
      Object.freeze({
        status: "activated",
        grant: Object.freeze({
          grantRef: "PHMGRANT-123456",
          provider,
          profileId,
          operationId: "OP-123456",
          providerHomeIdentityHash: "d".repeat(64),
          providerHomeProtectionHash: "e".repeat(64),
          localUserBindingHash: "f".repeat(64),
          stableLogicalHomeBindingHash: "1".repeat(64),
        }),
        activeMountCapability,
      }),
    borrowMountSource: () => `C:\\provider-homes\\${provider}`,
    completeMount: () => Object.freeze({ status: "completed" }),
    wallNow: () => 1_000,
    monotonicNow: () => 2_000,
    randomBytes: (size) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
    consumeModelSelection: () =>
      Object.freeze({
        selectionRecordId: "MODELSEL-12345678",
        operationId: "OP-123456",
        frontProvider: "codex" as const,
        executorProvider: provider,
        route: `front_codex__executor_${provider}`,
        profileId,
        model,
        basis: Object.freeze({
          provider,
          role: "executor" as const,
          workClass: "bounded_implementation" as const,
          planState: "complete" as const,
          risk: "low" as const,
          difficulty: isCompatibilityTask
            ? ("medium" as const)
            : ("low" as const),
          decisionImpact: "limited" as const,
          isLocalCandidateOnly: true,
          hasUnresolvedDirection: false,
          requiresCrossContextAlignment: false,
        }),
        effort: isCompatibilityTask ? ("medium" as const) : ("low" as const),
        modelTier: "preferred",
        speedMode: "normal" as const,
        selectionNotice:
          "[委譲経路選定] front=codex executor=claude\n選定理由=complete_bounded_local_plan\n高コスト選択=no",
        delegationDepth: 1,
      }),
    consumeTaskPacket: () =>
      Object.freeze({
        operationId: "OP-123456",
        taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
        taskRole: taskRole ?? "executor",
        taskWorkload: {
          readPathCount: 1,
          allowedPathCount: 1,
          acceptanceCriterionCount: 1,
          remediationFindingCount: 0,
        },
        taskPacketHash: "d".repeat(64),
        prompt: "Execute the exact isolated task.",
        promptTransport: "provider_stdin_only" as const,
      }),
    consumeAdvicePacket: () => {
      const providerCommand = planWorkbenchAiAdviceProviderCommand({
        provider,
        exactModelId: model,
        reasoningEffort: "low",
      });
      return Object.freeze({
        contract: "crdd-coordinator/workbench-ai-advice-runtime-packet",
        contractRevision: 1,
        packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
        operationId: "OP-123456",
        profileId,
        provider,
        taskHash: "2".repeat(64),
        projectionHash: "3".repeat(64),
        commandHash: createHash("sha256")
          .update(JSON.stringify(providerCommand), "utf8")
          .digest("hex"),
        packetHash: "5".repeat(64),
        providerCommand,
        providerPrompt: "Give advice from the supplied projection.",
        repositoryMounted: false as const,
        workspaceMounted: false as const,
        toolsAllowed: false as const,
        sessionPersistenceAllowed: false as const,
      });
    },
    issueProviderAuthority: () =>
      Object.freeze({
        status: "issued",
        useCapability: authorityUseCapability,
        controlCapability: authorityControlCapability,
        operationId: "OP-123456",
        provider,
        profileId,
        providerHomeMountGrantRef: "PHMGRANT-123456",
        runtimeAuthorityIssued: true,
      }),
    revokeProviderAuthority: () => Object.freeze({ status: "revoked" }),
  });
  const prepared = isAdvice
    ? adapter.prepareAdvice(
        managementCapability,
        mountCapability,
        mountAuthorizationCapability,
        selectionUseCapability,
        Object.freeze({}),
        Object.freeze({}),
      )
    : taskRole
      ? adapter.prepareTask(
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
          Object.freeze({}),
        )
      : adapter.prepare(
          managementCapability,
          mountCapability,
          mountAuthorizationCapability,
          selectionUseCapability,
        );
  assert.equal(prepared.status, "prepared");
  const plan = adapter.consumeForProcessController(
    prepared.preparedCapability,
    managementCapability,
  );
  assert.ok(plan);
  return { plan, managementCapability };
}

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
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
function createEffectFixture(
  options: Readonly<{
    taskRole?: "executor" | "reviewer";
    isAdvice?: boolean;
    provider?: "codex" | "claude";
    configEntries?: readonly string[];
    outputForInvocation?: (
      argv: readonly string[],
      invocationIndex: number,
    ) => Readonly<{
      status: number | null;
      signal: string | null;
      stdout: string;
      stderr: string;
      outputExceeded: boolean;
    }>;
    internalNetworkReceiptId?: string;
    authReceiptId?: string;
    proxyReceiptId?: string;
    providerReceiptId?: string;
    handleForInvocation?: (
      invocationIndex: number,
    ) => OwnedCommandHandle | null;
  }> = {},
) {
  const { plan, managementCapability } = createPlanFixture(
    options.taskRole ?? null,
    options.isAdvice ?? false,
    options.provider ?? "claude",
  );
  const invocations: Array<{
    executable: string;
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
    stdin: string | null;
  }> = [];
  let configCreated = 0;
  let configRemoved = 0;
  const runtime = createIsolatedDockerEffectRuntimeCandidate({
    platform: "win32",
    borrowPaths: () =>
      Object.freeze({
        tmp: "C:\\operation\\tmp",
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
    options.providerReceiptId
      ? {
          inspectReceipts: () =>
            Object.freeze({
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
            }),
        }
      : {}),
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
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
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
 * 固定planのcommandだけを固定CLI・Engine・最小環境へ渡すを検証する。
 *
 * @responsibility 固定planのcommandだけを固定CLI・Engine・最小環境へ渡すの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定planのcommandだけを固定CLI・Engine・最小環境へ渡すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("固定planのcommandだけを固定CLI・Engine・最小環境へ渡す", async () => {
  const fixture = createEffectFixture();
  const firstCommand = fixture.plan.commands[0];
  assert.ok(firstCommand);
  const handle = fixture.runtime.startCommand(
    firstCommand,
    fixture.plan,
    fixture.managementCapability,
  );
  assert.equal((await handle.wait(10_000))?.status, 0);
  assert.equal(fixture.invocations.length, 1);
  const invocation = fixture.invocations[0];
  assert.ok(invocation);
  assert.equal(
    invocation.executable,
    "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
  );
  assert.deepEqual(invocation.argv.slice(0, 4), [
    "--host",
    "npipe:////./pipe/dockerDesktopLinuxEngine",
    "--config",
    "C:\\operation\\management\\docker-cli-config",
  ]);
  assert.equal(invocation.environment.SystemRoot, "C:\\Windows");
  assert.equal(invocation.environment.WINDIR, "C:\\Windows");
  assert.equal(invocation.environment.DOCKER_CLI_HINTS, "false");
  for (const name of [
    "PATH",
    "USERPROFILE",
    "HOME",
    "HTTPS_PROXY",
    "NODE_OPTIONS",
  ]) {
    assert.equal(invocation.environment[name], "");
  }
  assert.equal(fixture.counts().configCreated, 1);
});

/**
 * Claude終了後に同じ管理領域でCodex用configを再作成できることを確認する。
 *
 * @responsibility 旧単発診断の実Filesystem境界と計画の終了前差替え拒否を正式試験へ保持する。
 * @trace ERB-IT-004
 * @precondition Repository-local tests内に自己生成した空領域を使用する。
 * @stimulus 固定Sourceのprivate config処理でClaudeとCodexの計画を順に開始・清掃する。
 * @observation configの実作成・Identity検証・削除回数と試験領域の空を読む。
 * @oracle 清掃前の計画変更は拒否され、清掃後のCodex開始と二回の回収が成立する。
 * @cleanup 自己生成した一意な試験領域だけをfinallyで回収する。
 * @boundary ERB-IT-004=Direct Boundary: 実Filesystem。CLI信頼とProcessは差替え、Docker/Provider要求は0。
 */
test("実config清掃後はClaudeからCodexへ同じ管理領域を再利用できる", async () => {
  const claude = createPlanFixture("executor", false, "claude").plan;
  const codex = createPlanFixture("reviewer", false, "codex", true).plan;
  const claudeCommand = claude.commands[0];
  const codexCommand = codex.commands[0];
  assert.ok(claudeCommand && codexCommand);
  const source = fs.readFileSync(
    new URL(
      "../../src/docker-runtime/docker-effect-runtime.ts",
      import.meta.url,
    ),
    "utf8",
  );
  // Productionへ試験専用Exportを追加せず、固定Sourceの三private関数だけを使用する。
  const bodies = [
    "filesystemIdentity",
    "createConfigDirectory",
    "verifyConfigDirectory",
  ].map((name) => {
    const begin = source.indexOf(`function ${name}(`);
    const end = source.indexOf("\n/**", begin);
    assert.ok(begin >= 0 && end > begin);
    return stripTypeScriptTypes(source.slice(begin, end));
  });
  const configFunctions = new Function(
    "fs",
    "path",
    `${bodies.join("\n")}\nconst DOCKER_CONFIG_DIRECTORY = "docker-cli-config"; return { createConfigDirectory, verifyConfigDirectory };`,
  )(fs, path) as {
    createConfigDirectory(directory: string): {
      directory: string;
      identity: string;
    };
    verifyConfigDirectory(directory: string, identity: string): void;
  };
  const testsRoot = fileURLToPath(
    new URL("../../../../.crdd/tests/", import.meta.url),
  );
  const directory = fs.mkdtempSync(
    path.join(testsRoot, "docker-config-sequential-"),
  );
  let creationCount = 0;
  let removalCount = 0;
  const runtime = createIsolatedDockerEffectRuntimeCandidate({
    platform: "win32",
    borrowPaths: () => ({ tmp: "C:\\operation\\tmp", management: directory }),
    readCli: () => ({
      executablePath:
        "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
      rootIdentity: "fixture",
      executableIdentity: "fixture",
      bytes: 1,
      sha256: "a".repeat(64),
      publisherOrganization: "Docker Inc",
      trustBasis: "windows_authenticode_valid_docker_inc_publisher",
    }),
    verifyCli: () => undefined,
    createConfig: (parent) => {
      creationCount += 1;
      return configFunctions.createConfigDirectory(parent);
    },
    verifyConfig: configFunctions.verifyConfigDirectory,
    configEntries: (target) => fs.readdirSync(target),
    removeConfig: (target) => {
      fs.rmdirSync(target);
      removalCount += 1;
    },
    startProcess: () => {
      let isClosed = false;
      return {
        started: async () => true,
        wait: async () => {
          isClosed = true;
          return {
            status: 0,
            signal: null,
            stdout: "",
            stderr: "",
            outputExceeded: false,
          };
        },
        closed: () => isClosed,
        terminateAndWait: async () => {
          isClosed = true;
          return true;
        },
      };
    },
  });
  const sharedManagement = Object.freeze({});
  try {
    await runtime.startCommand(claudeCommand, claude, sharedManagement).wait(1);
    assert.throws(
      () => runtime.startCommand(codexCommand, codex, sharedManagement),
      /docker_effect_plan_replaced/u,
    );
    assert.equal(
      (await runtime.cleanupOwnedResources(claude, {}, sharedManagement))
        .confirmed,
      true,
    );
    await runtime.startCommand(codexCommand, codex, sharedManagement).wait(1);
    assert.equal(
      (await runtime.cleanupOwnedResources(codex, {}, sharedManagement))
        .confirmed,
      true,
    );
    assert.equal(creationCount, 2);
    assert.equal(removalCount, 2);
    assert.deepEqual(fs.readdirSync(directory), []);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

/**
 * plain command copyと変更planはDocker processを開始しないを検証する。
 *
 * @responsibility plain command copyと変更planはDocker processを開始しないの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus plain command copyと変更planはDocker processを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("plain command copyと変更planはDocker processを開始しない", () => {
  const fixture = createEffectFixture();
  const firstCommand = fixture.plan.commands[0];
  assert.ok(firstCommand);
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        Object.freeze({
          purpose: firstCommand.purpose,
          argv: firstCommand.argv,
        }),
        fixture.plan,
        fixture.managementCapability,
      ),
    /command_not_owned/u,
  );
  const changed = Object.freeze({
    ...fixture.plan,
    selectedModel: "sonnet",
  });
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        firstCommand,
        changed,
        fixture.managementCapability,
      ),
    /plan_invalid/u,
  );
  assert.equal(fixture.invocations.length, 0);
});

/**
 * Task本文はprovider startのstdinだけへ渡しDocker argvへ含めないを検証する。
 *
 * @responsibility Task本文はprovider startのstdinだけへ渡しDocker argvへ含めないの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task本文はprovider startのstdinだけへ渡しDocker argvへ含めないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("Task本文はprovider startのstdinだけへ渡しDocker argvへ含めない", async () => {
  const fixture = createEffectFixture({ taskRole: "executor" });
  const providerStart = fixture.plan.commands.find(
    (command) => command.purpose === "start_provider_attached",
  );
  assert.ok(providerStart);
  const handle = fixture.runtime.startCommand(
    providerStart,
    fixture.plan,
    fixture.managementCapability,
  );
  assert.equal((await handle.wait(10_000))?.status, 0);
  assert.equal(fixture.invocations.length, 1);
  const invocation = fixture.invocations[0];
  assert.ok(invocation);
  assert.equal(invocation.stdin, "Execute the exact isolated task.");
  assert.equal(invocation.argv.includes(invocation.stdin ?? ""), false);
  assert.equal(invocation.argv.includes("--interactive"), true);
});

/**
 * Workbench助言本文を非共有Providerのstdinだけへ渡すことを検証する。
 *
 * @responsibility Advice Packet由来PromptとRepository非共有Docker PlanのEffect直前一致を判定する。
 * @trace ERB-IT-004
 * @precondition Adapterが生成したworkbench_advice Planを使用する。
 * @stimulus Provider start commandをDocker Effectへ渡す。
 * @observation stdin、argv、Workspace Mount有無を観測する。
 * @oracle Promptはstdinだけにあり、interactiveで、`/work` Mountを持たない。
 * @cleanup fixtureの疑似Processはwaitで終了する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("Workbench助言本文を非共有Providerのstdinだけへ渡す", async () => {
  const fixture = createEffectFixture({ isAdvice: true });
  const providerStart = fixture.plan.commands.find(
    (command) => command.purpose === "start_provider_attached",
  );
  const providerCreate = fixture.plan.commands.find(
    (command) => command.purpose === "create_provider",
  );
  assert.ok(providerStart);
  assert.ok(providerCreate);
  assert.equal(providerCreate.argv.includes("--init"), false);
  const changedCreate = Object.freeze({
    ...providerCreate,
    argv: Object.freeze(["create", "--init", ...providerCreate.argv.slice(1)]),
  });
  const changedPlan = Object.freeze({
    ...fixture.plan,
    commands: Object.freeze(
      fixture.plan.commands.map((command) =>
        command === providerCreate ? changedCreate : command,
      ),
    ),
  });
  assert.throws(() =>
    fixture.runtime.startCommand(
      changedCreate,
      changedPlan,
      fixture.managementCapability,
    ),
  );
  assert.equal(fixture.invocations.length, 0);
  assert.equal(
    providerCreate.argv[providerCreate.argv.indexOf("--max-turns") + 1],
    "2",
  );
  for (const turnLimit of ["1", "3"]) {
    const changedCommands = fixture.plan.commands.map((command) =>
      command.purpose !== "create_provider"
        ? command
        : {
            ...command,
            argv: command.argv.map((value, index, argv) =>
              argv[index - 1] === "--max-turns" ? turnLimit : value,
            ),
          },
    );
    assert.throws(() =>
      fixture.runtime.startCommand(
        providerStart,
        { ...fixture.plan, commands: changedCommands },
        fixture.managementCapability,
      ),
    );
    assert.equal(fixture.invocations.length, 0);
  }
  const handle = fixture.runtime.startCommand(
    providerStart,
    fixture.plan,
    fixture.managementCapability,
  );
  assert.equal((await handle.wait(10_000))?.status, 0);
  const invocation = fixture.invocations[0];
  assert.ok(invocation);
  assert.equal(invocation.stdin, "Give advice from the supplied projection.");
  assert.equal(invocation.argv.includes(invocation.stdin ?? ""), false);
  assert.equal(invocation.argv.includes("--interactive"), true);
  assert.equal(
    providerCreate.argv.some((value) => value.includes("dst=/work")),
    false,
  );
});

/**
 * Taskの上限改変と同じ上限になる作業量の差替えを拒否するを検証する。
 *
 * @responsibility Taskの上限改変と同じ上限になる作業量の差替えを拒否するの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Taskの上限改変と同じ上限になる作業量の差替えを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("Taskの上限改変と同じ上限になる作業量の差替えを拒否する", async () => {
  const fixture = createEffectFixture({ taskRole: "executor" });
  const first = fixture.plan.commands[0];
  assert.ok(first);
  const handle = fixture.runtime.startCommand(
    first,
    fixture.plan,
    fixture.managementCapability,
  );
  await handle.wait(10_000);
  const before = fixture.invocations.length;
  const changed = {
    ...fixture.plan,
    taskWorkload: {
      readPathCount: 2,
      allowedPathCount: 1,
      acceptanceCriterionCount: 1,
      remediationFindingCount: 0,
    },
  };
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        first,
        changed,
        fixture.managementCapability,
      ),
    /docker_effect_plan_replaced/u,
  );
  const commands = fixture.plan.commands.map((command) =>
    command.purpose !== "create_provider"
      ? command
      : {
          ...command,
          argv: command.argv.map((value, index, argv) =>
            argv[index - 1] === "--max-turns" ? "16" : value,
          ),
        },
  );
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        first,
        { ...fixture.plan, commands },
        fixture.managementCapability,
      ),
    /plan_invalid/u,
  );
  assert.equal(fixture.invocations.length, before);
});

/**
 * cleanupは全handle終了と所有resource不存在後だけconfigを除去するを検証する。
 *
 * @responsibility cleanupは全handle終了と所有resource不存在後だけconfigを除去するの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanupは全handle終了と所有resource不存在後だけconfigを除去するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("cleanupは全handle終了と所有resource不存在後だけconfigを除去する", async () => {
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
    confirmed: true,
    processTreeTerminated: true,
    containersAbsent: true,
    networksAbsent: true,
  });
  assert.deepEqual(fixture.counts(), {
    configCreated: 1,
    configRemoved: 1,
  });
  assert.equal(fixture.invocations.length, 6);
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
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
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
  assert.equal(second.confirmed, true);
  assert.equal(terminationCalls, 2);
  assert.deepEqual(fixture.counts(), { configCreated: 1, configRemoved: 1 });
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
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("candidate/receipt cleanup中のrunShort errorもcloseまで所有し設定を保持する", async () => {
  for (const shouldUseReceipts of [false, true]) {
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
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
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

  const residue = createEffectFixture({ configEntries: ["unexpected.json"] });
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
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
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
 * @precondition 実Adapter由来のCodex／Claude助言Planと合成inspect応答を使う。
 * @stimulus 通常清掃へexact Provider receiptを渡す。
 * @observation 構成判定、削除発行と清掃完了値を観測する。
 * @oracle Codex助言はtrueだけ、Claude助言は未記載／null／falseだけを受理し、不一致で削除0となる。
 * @cleanup N/A: 疑似Docker Processは各waitで終了し実Containerを作らない。
 * @boundary ERB-IT-004=Direct Boundary: Provider receipt→清掃前inspect
 */
test("通常清掃でもCodex助言専用initの欠測と対象外混入を拒否する", async () => {
  for (const provider of ["codex", "claude"] as const) {
    for (const init of [true, null, false, undefined, "false", 1]) {
      const isExpected =
        provider === "codex"
          ? init === true
          : init === undefined || init === null || init === false;
      const providerId = "c".repeat(64);
      const fixture = createEffectFixture({
        isAdvice: true,
        provider,
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
            PidsLimit: 64,
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
 * @precondition 実AdapterのPlanと用途別の合成inspect応答を使う。
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
        isAdvice: true,
        provider: "codex",
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
          hostConfig.PidsLimit = purpose === "proxy" ? 64 : 32;
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

/**
 * Docker Effect contractは発行者Trustと任意command禁止を公開するを検証する。
 *
 * @responsibility Docker Effect contractは発行者Trustと任意command禁止を公開するの合否判定を所有する。
 * @trace ERB-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker Effect contractは発行者Trustと任意command禁止を公開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("Docker Effect contractは発行者Trustと任意command禁止を公開する", () => {
  const contract = describeDockerEffectRuntimeContract();
  assert.equal(contract.contractRevision, 10);
  assert.equal(contract.dockerCli.exactVersionRequired, false);
  assert.equal(contract.dockerCli.exactHashRequiredAcrossOperations, false);
  assert.equal(
    contract.dockerCli.sameIdentityAndHashRequiredWithinOperation,
    true,
  );
  assert.equal(contract.dockerCli.publisherOrganization, "Docker Inc");
  assert.equal(contract.dockerCli.pathLookupAllowed, false);
  assert.equal(contract.dockerCli.shellAllowed, false);
  assert.equal(contract.environment, "runtime_owned_minimal_replacement");
  assert.equal(
    contract.commandPlan,
    "exact_nine_command_subscription_preflight_provider_probe_isolated_task_or_workbench_advice",
  );
  assert.equal(
    contract.taskInput,
    "runtime_owned_task_or_advice_stdin_only_not_docker_argv",
  );
  assert.equal(contract.callerCommandAllowed, false);
  assert.equal(contract.providerEffectAllowed, true);
});

/**
 * coordinator:unit:claude-docker-runtime-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:claude-docker-runtime-adapterが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope claude、docker、runtime、adapter
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */

import assert from "node:assert/strict";
import test from "node:test";
import { planExecution } from "../../../../ai-adapter/src/index.ts";
import { describeDockerProviderExecutionLocations } from "../../../../docker-isolation/src/image/assets.ts";
import { startDockerProcessController } from "../../../src/lifecycle/execution.ts";
import { cancelExecutorAttempt } from "../../../src/lifecycle/environment.ts";
import { executionSelection } from "../../fixtures/ai-selection.ts";
import {
  createAttemptPreparation,
  createReviewerWorkspaceReader,
  reviewerSnapshotId,
  reviewerWorkspaceRoot,
} from "../../fixtures/attempt-preparation.ts";

const fixedSelection = executionSelection("independent_reviewer", {
  provider: "claude",
  model: "opus",
  effort: "low",
});

/**
 * createFixtureのTest準備責務を実行する。
 *
 * @responsibility createFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
function createFixture(
  overrides: Partial<
    Parameters<typeof createAttemptPreparation<"claude">>[1]
  > & { executionSelection?: ReturnType<typeof executionSelection> } = {},
  prepare?: ReturnType<typeof createReviewerWorkspaceReader>,
) {
  const { executionSelection: selectedOverride, ...hostOverrides } = overrides;
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  let randomValue = 0;
  let technicalPlan:
    | import("../../../../executor/tests/support/executor-test.ts").TestAttemptPlan
    | null = null;
  const dependencies = {
    verifyOperationMount: (management: unknown, mount: unknown) => {
      assert.equal(management, managementCapability);
      assert.equal(mount, mountCapability);
      return Object.freeze({
        operationId: "OP-123456",
        createdAt: "2026-08-24T00:00:00.000Z",
        mounts: Object.freeze({
          workspace: "C:\\crdd\\operation\\workspace",
          providerHome: "C:\\crdd\\operation\\provider-home",
          tmp: "C:\\crdd\\operation\\tmp",
          events: "C:\\crdd\\operation\\events",
          projection: "C:\\crdd\\operation\\projection",
          management: "C:\\crdd\\operation\\management",
        }),
      });
    },
    randomBytes: (size: number) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
    consumeTaskPacket: () =>
      Object.freeze({
        operationId: "OP-123456",
        taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
        taskRole: "reviewer" as const,
        reviewerReadProjection: { candidateSnapshotId: reviewerSnapshotId },
        taskAttempt: 0 as const,
        executionSelection: fixedSelection,
        taskWorkload: {
          readPathCount: 1,
          allowedPathCount: 1,
          acceptanceCriterionCount: 1,
          remediationFindingCount: 0,
        },
        taskPacketHash: "b".repeat(64),
        prompt: "Review the exact local candidate.",
        additionalHosts: Object.freeze([]),
        promptTransport: "provider_stdin_only" as const,
      }),
    ...hostOverrides,
  };
  const adapter = createAttemptPreparation(
    "claude",
    dependencies,
    (_upper, lower) => {
      technicalPlan = lower;
    },
    prepare ?? createReviewerWorkspaceReader(() => managementCapability),
  );
  return {
    adapter,
    getTechnicalPlan: () => {
      if (!technicalPlan) throw Error("fixture_plan_missing");
      return technicalPlan;
    },
    managementCapability,
    mountCapability,
    executionSelection: selectedOverride ?? fixedSelection,
    providerHome: Object.freeze({
      provider: "claude" as const,
      providerHomeSourcePath:
        "C:\\Users\\person\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\claude",
      providerHomeIdentityHash: "a".repeat(64),
      stableLogicalHomeBindingHash: "1".repeat(64),
    }),
  };
}

/**
 * Workbench助言をRepository非共有のClaude Planへ固定することを検証する。
 *
 * @responsibility 第3実行モードのIdentity、標準入力およびMount境界を判定する。
 * @trace PRL-UT-014
 * @precondition 固定Model Selectionと有効なAdvice Packetを使用する。
 * @stimulus prepareAdvice相当の入力を準備し、返された計画を確認する。
 * @observation operationMode、Packet Identity、CommandおよびWorkspace Mountを観測する。
 * @oracle workbench_adviceでありRepository／Workspaceを共有しない。
 * @cleanup Provider Effectを発行しないため外部資源はない。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Workbench助言をRepository非共有のClaude Planへ固定する", () => {
  const providerCommand =
    planExecution(
      {
        provider: "claude",
        purpose: "advice",
        modelSelection: {
          provider: "claude",
          modelIdentifier: "opus",
          reasoningEffort: "low",
          identifierKind: "alias",
        },
        allowedReferences: ["synthetic-reference"],
      },
      describeDockerProviderExecutionLocations("claude", "primary"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  const fixture = createFixture({
    executionSelection: executionSelection("advice", {
      provider: "claude",
      model: "opus",
      effort: "low",
    }),
    consumeAdvicePacket: () =>
      Object.freeze({
        contract: "crdd-executor/advice-input",
        contractRevision: 2,
        executionSelection: executionSelection("advice", {
          provider: "claude",
          model: "opus",
          effort: "low",
        }),
        packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
        operationId: "OP-123456",

        provider: "claude" as const,
        taskHash: "2".repeat(64),
        projectionHash: "3".repeat(64),

        packetHash: "5".repeat(64),
        additionalHosts: Object.freeze([]),
        providerPrompt: "Give advice from the supplied projection.",
        allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
        repositoryMounted: false as const,
        workspaceMounted: false as const,
        toolsAllowed: false as const,
        sessionPersistenceAllowed: false as const,
      }),
  });
  const prepared = fixture.adapter.prepare({
    purpose: "advice",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "workbench",
    packetCapability: Object.freeze({}),
    packetOwnerCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  const plan = fixture.getTechnicalPlan();
  assert.ok(plan);
  assert.equal(plan.operationMode, "workbench_advice");
  assert.equal(
    prepared.plan.advicePacketRef,
    "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
  );
  assert.equal(plan.providerInput, "Give advice from the supplied projection.");
  assert.equal(plan.workspaceSourcePath, null);
  assert.equal(plan.workspaceMountMode, null);
  const createProvider = plan.commands.find(
    (command) => command.purpose === "create_provider",
  );
  assert.ok(createProvider);
  assert.equal(
    createProvider.argv.includes("C:\\crdd\\operation\\workspace"),
    false,
  );
  assert.deepEqual(
    createProvider.argv.slice(-providerCommand.argv.length),
    providerCommand.argv,
  );
});

/**
 * 低推論選定を固定計画と元Executorの再開始拒否へ接続するを検証する。
 *
 * @responsibility 低推論選定を固定計画と元Executorの再開始拒否へ接続するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 低推論選定を固定計画と元Executorの再開始拒否へ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("低推論選定を固定計画と元Executorの再開始拒否へ接続する", () => {
  const randomCalls: number[] = [];
  const fixture = createFixture({
    randomBytes: (size: number) => {
      randomCalls.push(size);
      return Buffer.alloc(size, size === 8 ? 1 : 2);
    },
  });
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetCapability: {},
    packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.plan.executionSelection.modelIdentifier, "opus");
  assert.equal(prepared.plan.executionSelection.reasoningEffort, "low");
  assert.equal(Object.hasOwn(prepared, "selectedModelTier"), false);
  const { plan: internalPlan, ...presentation } = prepared;
  assert.strictEqual(internalPlan.executor, prepared.plan.executor);
  const publicJson = JSON.stringify({
    ...presentation,
    recordProjection: internalPlan.executor.recordProjection,
  });
  assert.doesNotMatch(publicJson, /Users\\\\person/);
  assert.doesNotMatch(publicJson, /CRDD_PROXY_AUTH/);
  assert.doesNotMatch(publicJson, /create_provider/);

  const plan = fixture.getTechnicalPlan();
  assert.ok(plan);
  assert.deepEqual(randomCalls, [8, 32]);
  const expectedNames = {
    internalNetworkName: `crdd-internal-${"01".repeat(8)}`,
    egressNetworkName: `crdd-egress-${"01".repeat(8)}`,
    proxyContainerName: `crdd-proxy-${"01".repeat(8)}`,
    authContainerName: `crdd-auth-${"01".repeat(8)}`,
    providerContainerName: `crdd-claude-${"a".repeat(16)}`,
    ownershipLabel: `crdd.coordinator.runtime=${"01".repeat(8)}`,
  };
  /**
   * 実計画の資源名と全操作の対象を同じ固定期待へ照合する。
   * @responsibility 正常計画とコピー変異へ同じ位置依存Oracleを適用する。
   * @trace PRL-UT-014
   * @precondition 本番準備が返したplanまたはその一軸変異を使う。
   * @stimulus 各fieldとname／label／操作対象を比較する。
   * @observation 固定flag直後と対象位置の値。
   * @oracle 五資源名・labelと九操作の相関が全て一致する。
   * @cleanup N/A: 計画値だけを読み実資源を扱わない。
   * @boundary PRL-UT-014=Direct Boundary: 準備結果→DI command。
   */
  const assertResourceBinding = (candidate: NonNullable<typeof plan>) => {
    for (const [key, expected] of Object.entries(expectedNames))
      assert.equal(candidate[key as keyof typeof expectedNames], expected);
    for (const [purpose, name] of [
      ["create_subscription_auth_probe", expectedNames.authContainerName],
      ["create_internal_network", expectedNames.internalNetworkName],
      ["create_egress_network", expectedNames.egressNetworkName],
      ["create_proxy", expectedNames.proxyContainerName],
      ["create_provider", expectedNames.providerContainerName],
    ]) {
      const command = candidate.commands.find(
        (entry) => entry.purpose === purpose,
      );
      assert.ok(command && name);
      const label = command.argv.indexOf("--label");
      assert.ok(label >= 0);
      assert.equal(
        command.argv.filter((value) => value === "--label").length,
        1,
      );
      assert.equal(command.argv[label + 1], expectedNames.ownershipLabel);
      if (purpose?.includes("network")) assert.equal(command.argv.at(-1), name);
      else {
        const nameIndex = command.argv.indexOf("--name");
        assert.ok(nameIndex >= 0);
        assert.equal(
          command.argv.filter((value) => value === "--name").length,
          1,
        );
        assert.equal(command.argv[nameIndex + 1], name);
      }
    }
    for (const [purpose, tail] of [
      [
        "start_subscription_auth_probe_attached",
        [expectedNames.authContainerName],
      ],
      [
        "connect_proxy_egress",
        [expectedNames.egressNetworkName, expectedNames.proxyContainerName],
      ],
      ["start_proxy", [expectedNames.proxyContainerName]],
      ["start_provider_attached", [expectedNames.providerContainerName]],
    ] as const) {
      const command = candidate.commands.find(
        (entry) => entry.purpose === purpose,
      );
      assert.ok(command);
      assert.deepEqual(command.argv.slice(-tail.length), tail);
    }
  };
  assertResourceBinding(plan);
  for (const changed of [
    {
      ...plan,
      providerContainerName: expectedNames.providerContainerName.replace(
        /codex|claude/u,
        (value) => (value === "codex" ? "claude" : "codex"),
      ),
    },
    {
      ...plan,
      providerContainerName: expectedNames.providerContainerName.replace(
        /[ab]{16}$/u,
        "c".repeat(16),
      ),
    },
    { ...plan, internalNetworkName: `crdd-internal-${"03".repeat(8)}` },
  ])
    assert.throws(() => assertResourceBinding(changed));
  for (const [purpose, flag] of [
    ["create_provider", "--name"],
    ["create_provider", "--label"],
    ["create_internal_network", "target"],
    ["connect_proxy_egress", "target"],
    ["start_subscription_auth_probe_attached", "target"],
    ["start_proxy", "target"],
    ["start_provider_attached", "target"],
  ]) {
    const commands = plan.commands.map((command) => {
      if (command.purpose !== purpose) return command;
      const argv = [...command.argv];
      const index =
        flag === "target" ? argv.length - 1 : argv.indexOf(flag ?? "") + 1;
      const original = argv[index];
      argv[index] =
        flag === "--label"
          ? `crdd.coordinator.runtime=${"03".repeat(8)}`
          : `crdd-proxy-${"03".repeat(8)}`;
      if (flag !== "target" && original) argv.push(original);
      return { ...command, argv };
    });
    assert.throws(() => assertResourceBinding({ ...plan, commands }));
  }
  assert.equal(plan.providerContainerName, `crdd-claude-${"a".repeat(16)}`);

  const purposes = plan.commands.map((candidate) => candidate.purpose);
  assert.deepEqual(purposes, [
    "create_subscription_auth_probe",
    "start_subscription_auth_probe_attached",
    "create_internal_network",
    "create_egress_network",
    "create_proxy",
    "connect_proxy_egress",
    "create_provider",
    "start_proxy",
    "start_provider_attached",
  ]);
  const authProbe = plan.commands[0];
  assert.equal(authProbe?.purpose, "create_subscription_auth_probe");
  assert.deepEqual(
    authProbe?.argv.filter((value) => value.startsWith("--network")),
    ["--network=none"],
  );
  const internalNetworkArguments = plan.commands[2]?.argv ?? [];
  assert.equal(internalNetworkArguments.includes("--internal"), true);
  const provider = plan.commands.find(
    (candidate) => candidate.purpose === "create_provider",
  );
  assert.ok(provider);
  assert.equal(provider.argv.includes("--pull=never"), true);
  assert.equal(provider.argv.includes("--network=none"), false);
  assert.match(
    provider.argv[provider.argv.indexOf("--network") + 1] ?? "",
    /^crdd-internal-/u,
  );
  assert.equal(provider.argv.includes("--read-only"), true);
  assert.equal(provider.argv.includes("--fallback-model"), false);
  const modelIndex = provider.argv.indexOf("--model");
  const effortIndex = provider.argv.indexOf("--effort");
  assert.ok(modelIndex >= 0 && effortIndex >= 0);
  assert.equal(provider.argv[modelIndex + 1], "opus");
  assert.equal(provider.argv[effortIndex + 1], "low");
  assert.equal(
    provider.argv.some((value) => value.startsWith("HTTPS_PROXY=")),
    true,
  );
  assert.equal(
    provider.argv.some((value) => value.startsWith("HTTP_PROXY=")),
    true,
  );
  assert.equal(
    provider.argv.some((value) => value.startsWith("ALL_PROXY=")),
    true,
  );
  assert.equal(provider.argv.includes("NO_PROXY="), true);
  assert.equal(
    provider.argv.some((value) => value.startsWith("ANTHROPIC_API_KEY=")),
    false,
  );
  const firstStart = prepared.plan.executor.start({
    managementCapability: fixture.managementCapability,
    reference: { recoveryId: "invalid", recoveryCapability: {} },
  });
  assert.equal(firstStart.status, "blocked");
  const duplicateStart = prepared.plan.executor.start({
    managementCapability: fixture.managementCapability,
    reference: {
      recoveryId: `docker-task.${prepared.plan.stableLogicalHomeBindingHash}.${"1".repeat(64)}.${"2".repeat(64)}`,
      recoveryCapability: {},
    },
  });
  assert.equal(duplicateStart.status, "blocked");
  assert.equal(duplicateStart.reason, "docker_process_controller_plan_invalid");
  assert.equal(duplicateStart.dockerEffectStarted, false);
  assert.equal(duplicateStart.providerRequestStarted, false);
});

/**
 * 乱数の不正取得と例外が準備後の権限発行へ進まないことを確認する。
 * @responsibility 取得順と計画拒否を既存準備から観測する。
 * @trace PRL-UT-014
 * @precondition 固定選定と模擬Mountを持つ実準備Adapterを使う。
 * @stimulus 各取得の短長違反と例外を与える。
 * @observation 乱数呼出列、準備結果、計画拒否回数。
 * @oracle 不正Bufferでも二取得を維持し、例外以後は取得しない。Provider実行0。
 * @cleanup N/A: 値fixtureのみでDocker・外部AI・実Mountを取得しない。
 * @boundary PRL-UT-014=Direct Boundary: 準備Owner→DI値生成。
 */
test("DI乱数検査の不成立は発行前停止を保つ", () => {
  for (const mode of [
    "short8",
    "long8",
    "short32",
    "long32",
    "throw8",
    "throw32",
  ]) {
    const randomCalls: number[] = [];
    const fixture = createFixture({
      randomBytes: (size: number) => {
        randomCalls.push(size);
        if (mode === `throw${size}`) throw new Error("fixed_random_failure");
        return Buffer.alloc(
          mode === `short${size}`
            ? size - 1
            : mode === `long${size}`
              ? size + 1
              : size,
          1,
        );
      },
    });
    const prepared = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      providerHome: fixture.providerHome,
      packetCapability: {},
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    });
    assert.equal(prepared.status, "blocked");
    assert.deepEqual(randomCalls, mode === "throw8" ? [8] : [8, 32]);

    assert.equal(prepared.dockerEffectIssued, false);
  }
});
/**
 * Task Packetをstdin専用入力と隔離workspace RO mountへ結合するを検証する。
 *
 * @responsibility Task Packetをstdin専用入力と隔離workspace RO mountへ結合するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task Packetをstdin専用入力と隔離workspace RO mountへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Task Packetをstdin専用入力と隔離workspace RO mountへ結合する", () => {
  let management = Object.freeze({});
  const prepare = createReviewerWorkspaceReader(() => management);
  const fixture = createFixture({}, prepare);
  management = fixture.managementCapability;
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
    packetCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  const plan = fixture.getTechnicalPlan();
  assert.ok(plan);
  assert.equal(plan.operationMode, "isolated_task");
  assert.equal(plan.taskRole, "reviewer");
  assert.equal(plan.workspaceMountMode, "read_only");
  assert.equal(plan.workspaceSourcePath, reviewerWorkspaceRoot);
  assert.equal(plan.providerInput, "Review the exact local candidate.");
  const argv = plan.commands.flatMap((command) => command.argv);
  assert.equal(argv.includes(plan.providerInput), false);
  assert.equal(argv.includes("--interactive"), true);
  assert.equal(
    argv.some(
      (value) => value.includes("dst=/work") && value.includes("readonly"),
    ),
    true,
  );
  const provider = plan.commands.find(
    (command) => command.purpose === "create_provider",
  );
  assert.ok(provider);
  const permissionModeIndex = provider.argv.indexOf("--permission-mode");
  const disallowedToolsIndex = provider.argv.indexOf("--disallowedTools");
  assert.equal(provider.argv[permissionModeIndex + 1], "dontAsk");
  assert.equal(
    provider.argv[provider.argv.indexOf("--tools") + 1],
    "Read,Glob,Grep",
  );
  assert.equal(
    provider.argv[disallowedToolsIndex + 1],
    "Bash,WebFetch,WebSearch,Task,NotebookEdit,mcp__*",
  );
  const resource = plan.isolationRequest.resources.find(
    (item) => item.key === "create_provider",
  );
  assert.ok(resource?.kind === "container");
  assert.deepEqual(
    resource.mounts
      .filter(({ readOnly }) => readOnly)
      .map(({ target }) => target),
    ["/work", "/work/.git", "/work/.crdd", "/work/.env", "/work/private"],
  );
});

/**
 * Executor Task PacketをacceptEditsと隔離workspace RW mountへ結合するを検証する。
 *
 * @responsibility Executor Task PacketをacceptEditsと隔離workspace RW mountへ結合するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Executor Task PacketをacceptEditsと隔離workspace RW mountへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Executor Task PacketをacceptEditsと隔離workspace RW mountへ結合する", () => {
  const fixture = createFixture({
    executionSelection: executionSelection("executor", {
      provider: "claude",
      model: "opus",
      effort: "low",
    }),
    consumeTaskPacket: () =>
      Object.freeze({
        operationId: "OP-123456",
        taskPacketRef: "TASKPKT-FFEEDDCCBBAA99887766554433221100",
        taskRole: "executor" as const,
        taskAttempt: 0 as const,
        executionSelection: executionSelection("executor", {
          provider: "claude",
          model: "opus",
          effort: "low",
        }),
        taskWorkload: {
          readPathCount: 1,
          allowedPathCount: 1,
          acceptanceCriterionCount: 1,
          remediationFindingCount: 0,
        },
        taskPacketHash: "c".repeat(64),
        prompt: "Create the exact bounded candidate change.",
        additionalHosts: Object.freeze([]),
        promptTransport: "provider_stdin_only" as const,
      }),
  });
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetRef: "TASKPKT-FFEEDDCCBBAA99887766554433221100",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
    packetCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  const plan = fixture.getTechnicalPlan();
  assert.ok(plan);
  assert.equal(plan.operationMode, "isolated_task");
  assert.equal(plan.taskRole, "executor");
  assert.equal(plan.workspaceMountMode, "read_write");
  assert.equal(
    plan.providerInput,
    "Create the exact bounded candidate change.",
  );
  const provider = plan.commands.find(
    (command) => command.purpose === "create_provider",
  );
  assert.ok(provider);
  const permissionModeIndex = provider.argv.indexOf("--permission-mode");
  const toolsIndex = provider.argv.indexOf("--tools");
  const disallowedToolsIndex = provider.argv.indexOf("--disallowedTools");
  assert.equal(provider.argv[permissionModeIndex + 1], "acceptEdits");
  assert.equal(provider.argv[toolsIndex + 1], "Read,Glob,Grep,Edit,Write");
  assert.equal(
    provider.argv[disallowedToolsIndex + 1],
    "Bash,WebFetch,WebSearch,Task,NotebookEdit,mcp__*",
  );
  const workspaceMount = provider.argv.find((value) =>
    value.includes("dst=/work"),
  );
  assert.ok(workspaceMount);
  assert.equal(workspaceMount.includes("readonly"), false);
  assert.equal(provider.argv.includes(plan.providerInput), false);
});

/**
 * 検証済み作業量を固定argvへ接続し、過大・不明ならPlan発行前に計画発行を拒否するを検証する。
 *
 * @responsibility 検証済み作業量を固定argvへ接続し、過大・不明ならPlan発行前に計画発行を拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 検証済み作業量を固定argvへ接続し、過大・不明ならPlan発行前に計画発行を拒否するの対象操作を実行する。
 * @observation 技術計画、拒否理由、上位診断と計画用乱数の要求回数を観測する。
 * @oracle 正常時に上位診断せず、作業量拒否時は乱数取得なしで元の理由を一度だけ診断する。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("検証済み作業量を固定argvへ接続し、過大・不明ならPlan発行前に計画発行を拒否する", () => {
  let management = Object.freeze({});
  const prepare = createReviewerWorkspaceReader(() => management);
  for (const readPathCount of [6, 12, 13, 0]) {
    let diagnosticCalls = 0;
    const randomSizes: number[] = [];
    const taskWorkload = {
      readPathCount,
      allowedPathCount: 1,
      acceptanceCriterionCount: 4,
      remediationFindingCount: 0,
    };
    const fixture = createFixture(
      {
        diagnoseTaskPlanning: new Proxy(planExecution, {
          apply(target, receiver, args) {
            diagnosticCalls++;
            return Reflect.apply(target, receiver, args);
          },
        }),
        randomBytes: (size) => {
          randomSizes.push(size);
          return Buffer.alloc(size, randomSizes.length);
        },
        consumeTaskPacket: () => ({
          operationId: "OP-123456",
          taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
          taskRole: "reviewer",
          reviewerReadProjection: { candidateSnapshotId: reviewerSnapshotId },
          taskAttempt: 0 as const,
          executionSelection: fixedSelection,
          taskWorkload,
          taskPacketHash: "b".repeat(64),
          prompt: "Review the exact local candidate.",
          additionalHosts: Object.freeze([]),
          promptTransport: "provider_stdin_only",
        }),
      },
      prepare,
    );
    management = fixture.managementCapability;
    const prepared = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      providerHome: fixture.providerHome,
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
      packetCapability: Object.freeze({}),
    });
    if (readPathCount === 0 || readPathCount === 13) {
      assert.equal(prepared.status, "blocked");
      assert.equal(diagnosticCalls, 1);
      assert.deepEqual(randomSizes, []);
      assert.equal(
        prepared.reason,
        readPathCount === 13
          ? "claude_task_workload_split_required"
          : "claude_task_workload_invalid",
      );

      assert.equal(prepared.providerRequestIssued, false);
    } else {
      assert.equal(prepared.status, "prepared");
      assert.equal(diagnosticCalls, 0);
      assert.deepEqual(randomSizes, [8, 32]);
      const plan = fixture.getTechnicalPlan();
      assert.ok(plan);
      assert.deepEqual(
        { ...(plan.taskWorkload as Record<string, unknown>) },
        taskWorkload,
      );
      const argv = plan.commands.find(
        (command) => command.purpose === "create_provider",
      )?.argv;
      assert.ok(argv);
      assert.equal(
        argv[argv.indexOf("--max-turns") + 1],
        String(readPathCount + 4),
      );
    }
  }
});

/**
 * production adapterは偽造Operationを実行前に拒否するを検証する。
 *
 * @responsibility production adapterは未発行のCapabilityと未接続Selection 選定入力を拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production adapterは未発行のCapabilityと未接続Selection 選定入力を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("production adapterは未発行のCapabilityと未接続Selection 選定入力を拒否する", () => {
  const prepared = startDockerProcessController(
    "claude",
    {
      purpose: "task",
      packetCapability: {},
      managementCapability: {},
      mountCapability: {},
      providerHome: {
        provider: "claude",
        providerHomeSourcePath: "C:\\home",
        providerHomeIdentityHash: "a".repeat(64),
        stableLogicalHomeBindingHash: "b".repeat(64),
      },
      packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
      taskAttempt: 0,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    },
    () => true,
    undefined,
    {},
    [],
  );
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.providerRequestStarted, false);
  void cancelExecutorAttempt({}, {}).then((result) =>
    assert.equal(result.status, "blocked"),
  );
});

/**
 * 固定選定を実際のProvider準備へ搬送し、fallbackを追加しない。
 * @trace PRL-UT-014
 * @precondition 固定選定と有限Host代役で準備する。
 * @stimulus Taskの技術計画を組み立てる。
 * @observation 元選定、購読種別、Providerの引数と開始前の結果。
 * @oracle 固定選定と隔離・ProxyのProvider差を維持し、公開向け結果に生の引数を出さない。
 * @cleanup N/A: 外部資源を開始しない。
 * @boundary Coordinatorの準備とExecutorの技術計画。
 */
test("固定選定とProxy条件を実計画で確認しfallbackを追加しない", () => {
  const fixture = createFixture();
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    providerHome: fixture.providerHome,
    packetCapability: {},
    packetRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "prepared");
  assert.deepEqual(
    prepared.plan.executionSelection,
    fixture.executionSelection,
  );
  assert.equal(
    prepared.plan.executionSelection.modelIdentifier,
    fixture.executionSelection.modelIdentifier,
  );
  assert.equal(prepared.plan.subscriptionOffering, "claude_max");
  assert.equal(prepared.providerRequestIssued, false);
  assert.equal(prepared.dockerEffectIssued, false);
  assert.equal("commands" in prepared.plan, false);
  assert.equal("providerAuthority" in prepared.plan, false);
  const provider = fixture
    .getTechnicalPlan()
    .commands.find((candidate) => candidate.purpose === "create_provider");
  assert.ok(provider);
  assert.equal(provider.argv.includes("--fallback-model"), false);
  assert.match(
    provider.argv[provider.argv.indexOf("--network") + 1] ?? "",
    /^crdd-internal-/u,
  );
  assert.equal(
    provider.argv[provider.argv.indexOf("--model") + 1],
    fixture.executionSelection.modelIdentifier,
  );
  assert.ok(provider.argv.some((arg) => arg.startsWith("HTTPS_PROXY=")));
  for (const key of ["HTTP_PROXY", "ALL_PROXY", "NO_PROXY"])
    assert.ok(provider.argv.some((arg) => arg.startsWith(`${key}=`)));
});

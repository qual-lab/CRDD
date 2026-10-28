/**
 * 上位の計画投影・所属照合と下位API接続を検証する。
 * @packageDocumentation
 * @responsibility Provider意味を上位へ、技術実行Oracleを下位へ分離する。
 * @trace ERB-IT-004
 * @trace ERB-IT-003
 * @level IT
 * @scope 実Adapter・本番binderと実Host Owner失効。Docker開始は記録代役とし実Dockerは別試験で確認する。
 * @boundary Adapter→Coordinator投影→Docker Isolation Root API、および実Host世代・Kernel排他。
 */
import { parseHostRecoveryToken } from "../../../domain-model/src/index.ts";
import { createProviderDockerRuntimeAdapterCandidate } from "../../../executor/src/index.ts";
import { planProviderExecution } from "../../../ai-adapter/src/index.ts";
import { hashProviderAdviceCommand } from "../../../executor/src/index.ts";
import assert from "node:assert/strict";
import { executionSelection } from "../fixtures/ai-selection.ts";
import { hashExecutionSelection } from "../../../domain-model/src/index.ts";
import { prepareDockerNetworkPolicy } from "../../../docker-isolation/src/index.ts";
import fs from "node:fs";
import path from "node:path";
import test, { mock } from "node:test";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import {
  activateOwnedHostOperationGenerationLock,
  acquireHostOperationRecoveryGenerationByIdentity,
  borrowOwnedDockerExecutionPaths,
  borrowOwnedHostRecoverySnapshot,
  cleanupOwnedOperationDirectoriesAsync,
  createOwnedMountCapability,
  createOwnedOperationContextCapability,
  createOwnedOperationDirectories,
  createOwnedOperationManagementCapability,
  releaseHostOperationRecoveryGeneration,
  verifyOwnedOperationManagementMountBinding,
  verifyOwnedOperationCleanupOutcome,
} from "../../src/execution/operation.ts";

import { loadHostRecoveryRecordByToken } from "../../src/execution/recovery.ts";
import {
  planDockerIsolationCommands,
  startDockerCommandSessionCandidate,
  type DockerExecutionHooks,
  type DockerIsolationRuntimePlan,
} from "../../../docker-isolation/src/index.ts";
import { verifyRuntimeOwnedDockerCleanupOutcome } from "../../src/execution/provider-executor.ts";
import {
  bindDockerIsolationRuntime,
  describeDockerEffectRuntimeContract,
} from "../../../executor/src/index.ts";
import { describeAdviceResultSchema } from "../../../executor/src/index.ts";
import { describeDockerProviderExecutionLocations } from "../../../docker-isolation/src/index.ts";
import { bindProviderAdviceCommand } from "../../../executor/src/index.ts";

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
  ownerBinding?: Readonly<{
    managementCapability: object;
    mountBinding: ReturnType<typeof verifyOwnedOperationManagementMountBinding>;
  }>,
) {
  const selected = executionSelection(
    isAdvice
      ? "advice"
      : taskRole === "reviewer"
        ? "independent_reviewer"
        : "executor",
    {
      provider,
      model:
        provider === "codex" ? (isAdvice ? "gpt-5.6-sol" : "gpt-5.5") : "opus",
      effort: isCompatibilityTask ? "medium" : "low",
    },
  );
  const model = selected.modelIdentifier;
  const managementCapability =
    ownerBinding?.managementCapability ?? Object.freeze({});
  const operationId = ownerBinding?.mountBinding.operationId ?? "OP-123456";
  const mountCapability = Object.freeze({});
  const mountAuthorizationCapability = Object.freeze({});
  const selectionUseCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  const authorityUseCapability = Object.freeze({});
  const authorityControlCapability = Object.freeze({});
  let randomValue = 0;
  const adapter = createProviderDockerRuntimeAdapterCandidate(provider, {
    verifyOperationMount: () =>
      Object.freeze({
        operationId,
        createdAt: "2026-08-25T00:00:00.000Z",
        mounts:
          ownerBinding?.mountBinding.mounts ??
          Object.freeze({
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
          operationId,
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
        operationId,
        executorProvider: provider,
        model,
        executionSelection: selected,
        selectionHash: hashExecutionSelection(selected) as string,
        taskAttempt: 0 as const,
        effort: isCompatibilityTask ? ("medium" as const) : ("low" as const),
        speedMode: "normal" as const,
        selectionNotice:
          "[委譲経路選定] front=codex executor=claude\n選定理由=complete_bounded_local_plan\n高コスト選択=no",
      }),
    consumeTaskPacket: () =>
      Object.freeze({
        operationId,
        taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
        taskRole: taskRole ?? "executor",
        taskAttempt: 0 as const,
        selectionHash: hashExecutionSelection(selected) as string,
        taskWorkload: {
          readPathCount: 1,
          allowedPathCount: 1,
          acceptanceCriterionCount: 1,
          remediationFindingCount: 0,
        },
        taskPacketHash: "d".repeat(64),
        prompt: "Execute the exact isolated task.",
        networkPolicy: (() => {
          const result = prepareDockerNetworkPolicy(provider, []);
          if (result.status !== "ready") throw new Error("fixture");
          return result.policy;
        })(),
        promptTransport: "provider_stdin_only" as const,
      }),
    consumeAdvicePacket: () => {
      const providerCommand = bindProviderAdviceCommand(
        planProviderExecution(
          {
            provider: {
              provider,
              exactModelId: model,
              reasoningEffort: "low",
            }.provider,
            purpose: "advice",
            modelSelection: {
              provider,
              modelIdentifier: model,
              reasoningEffort: "low",
              identifierKind: provider === "codex" ? "exact" : "alias",
            },
            resultSchema: describeAdviceResultSchema(),
          },
          describeDockerProviderExecutionLocations(
            {
              provider,
              exactModelId: model,
              reasoningEffort: "low",
            }.provider,
            "advice",
          ),
        ).plan ?? assert.fail("provider_execution_plan_not_ready"),
      );
      return Object.freeze({
        contract: "crdd-coordinator/workbench-ai-advice-runtime-packet",
        contractRevision: 2,
        packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
        operationId,
        executionSelection: selected,
        provider,
        taskHash: "2".repeat(64),
        projectionHash: "3".repeat(64),
        commandHash:
          hashProviderAdviceCommand(providerCommand) ??
          assert.fail("invalid_command_fixture"),
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
        operationId,
        provider,
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
 * 上位の投影だけを記録する狭い下位Runtimeを接続する。
 * @responsibility Docker実行・清掃判定を再実装せず引数と返却値を観測する。
 * @trace ERB-IT-004
 * @precondition 実Adapterから生成したPlanを利用する。
 * @stimulus 本番と同じbinderを呼び出す。
 * @observation purpose、技術Plan、元Ownerと元Handle。
 * @oracle 下位へ渡る値と返る値が縮約されない。
 * @cleanup N/A: 実資源を取得しない。
 * @boundary Coordinator投影と模擬下位Runtime。
 */
function createEffectFixture(
  options: Readonly<{
    taskRole?: "executor" | "reviewer";
    isAdvice?: boolean;
  }> = {},
) {
  const { plan, managementCapability } = createPlanFixture(
    options.taskRole ?? null,
    options.isAdvice ?? false,
  );
  const projections: Array<{
    purpose: string;
    input: DockerIsolationRuntimePlan;
    owner: unknown;
  }> = [];
  const invocations: Array<{ argv: readonly string[]; stdin: string | null }> =
    [];
  let reject = false;
  const runtime = bindDockerIsolationRuntime(
    {
      startExecution: () => {
        throw new Error("fixture_session_unused");
      },
      startCommand: (purpose, input, owner) => {
        projections.push({ purpose, input, owner });
        if (reject) {
          reject = false;
          throw new Error("docker_effect_plan_replaced");
        }
        const commands = planDockerIsolationCommands(input.configuration);
        assert.ok(commands);
        const command = commands.find((value) => value.purpose === purpose);
        assert.ok(command);
        invocations.push({ argv: command.argv, stdin: input.stdin });
        let closed = false;
        return {
          started: async () => true,
          wait: async () => {
            closed = true;
            return {
              status: 0,
              signal: null,
              stdout: "",
              stderr: "",
              outputExceeded: false,
            };
          },
          terminateAndWait: async () => {
            closed = true;
            return true;
          },
          closed: () => closed,
        };
      },
      cleanupOwnedResources: async () => {
        throw new Error("fixture_cleanup_not_configured");
      },
      verifyCleanupOutcome: () => null,
    },
    () =>
      Object.freeze({
        tmp: "C:\\operation\\tmp",
        management: "C:\\operation\\management",
      }),
  );
  return {
    runtime,
    plan,
    managementCapability,
    invocations,
    projections,
    rejectNextStart: () => {
      reject = true;
    },
  };
}

/**
 * 本番binderの実行単位を下位へ一度だけ搬送する。
 * @responsibility 上位が技術手順を再実装せず元Owner・hooks・返却参照を維持することを確認する。
 * @trace ERB-IT-004
 * @precondition 実Adapterの計画と実Sessionの非本番候補を使用する。
 * @stimulus binderのstartExecutionから最初のGate拒否へ進める。
 * @observation 投影、Owner、hooks、元Session、回収数。
 * @oracle 下位へ一度接続し、元Sessionをそのまま返す。Docker要求0、模擬回収1。
 * @cleanup 元Sessionの完了を待つ。実Docker・Filesystemは操作しない。
 * @boundary Coordinator計画投影→Docker Isolation実行単位。
 */
test("実行単位のbinderは元Ownerとhooksを下位へ直接接続する", async () => {
  const { plan, managementCapability } = createPlanFixture();
  const recovery = Object.freeze({});
  const hooks: DockerExecutionHooks = {
    allowCommand: () => false,
    recordSubmission: () => true,
    recordNotIssued: () => true,
    recordExecutionSubmission: () => true,
    recordReceipt: () => true,
    acceptCommandResult: () => true,
    acceptOutput: () => true,
    onExecutionStarted: () => assert.fail("unexpected_provider_start"),
    onFailure: () => {},
  };
  let connections = 0;
  let cleanups = 0;
  let original: ReturnType<typeof startDockerCommandSessionCandidate> | null =
    null;
  const runtime = bindDockerIsolationRuntime(
    {
      startExecution: (input, suppliedRecovery, owner, suppliedHooks) => {
        connections++;
        assert.equal(suppliedRecovery, recovery);
        assert.equal(owner, managementCapability);
        assert.equal(suppliedHooks, hooks);
        const commands = planDockerIsolationCommands(input.configuration);
        assert.ok(commands);
        original = startDockerCommandSessionCandidate(
          commands.map((command) => command.purpose),
          {
            startCommand: () => {
              throw new Error("unexpected_docker_request");
            },
            cleanup: async () => {
              cleanups++;
              return {
                confirmed: true,
                processTreeTerminated: true,
                containersAbsent: true,
                networksAbsent: true,
              };
            },
          },
          suppliedHooks,
        );
        return original;
      },
      startCommand: () => {
        throw new Error("unexpected_upper_command");
      },
      cleanupOwnedResources: async () => {
        throw new Error("unexpected_upper_cleanup");
      },
      verifyCleanupOutcome: () => null,
    },
    () => ({
      tmp: "C:\\operation\\tmp",
      management: "C:\\operation\\management",
    }),
  );
  const session = runtime.startExecution(
    plan,
    recovery,
    managementCapability,
    hooks,
  );
  assert.equal(Object.is(session, original), true);
  assert.equal(connections, 1);
  assert.equal(cleanups, 0);
  const result = await session.completion;
  assert.equal(result.failure?.gate, "allowCommand");
  assert.equal(result.cleanup.confirmed, true);
  assert.equal(cleanups, 1);
});

/**
 * 元清掃結果と同じOwner・回復相関を縮約せず搬送する。
 * @responsibility binderの投影と下位の真正結果検査を分離する。
 * @trace ERB-IT-004
 * @precondition 実Adapterの計画と狭い模擬下位結果を用意する。
 * @stimulus 清掃・照合・下位例外を本番binderへ渡す。
 * @observation 元object、技術identity、Capability引数と未確認返却。
 * @oracle 元objectを保持し、本番Runtimeは模擬結果を拒否する。
 * @cleanup N/A: 実資源を取得しない。
 * @boundary 上位結果投影と下位元結果Owner。
 */
test("元清掃結果と回復Ownerを投影し下位例外を成功へ補完しない", async () => {
  const { plan, managementCapability } = createPlanFixture();
  const recovery = Object.freeze({});
  const result = Object.freeze({
    confirmed: false,
    processTreeTerminated: true,
    containersAbsent: false,
    networksAbsent: false,
    resourceObservations: null,
  });
  let cleanupInput: DockerIsolationRuntimePlan | null = null;
  let verification: unknown[] = [];
  let fail = false;
  const runtime = bindDockerIsolationRuntime(
    {
      startExecution: () => {
        throw new Error("fixture_session_unused");
      },
      startCommand: () => {
        throw new Error("fixture_start_unused");
      },
      cleanupOwnedResources: async (input, recoveryOwner, owner) => {
        assert.equal(recoveryOwner, recovery);
        assert.equal(owner, managementCapability);
        cleanupInput = input;
        if (fail) throw new Error("fixture_cleanup_failure");
        return result;
      },
      verifyCleanupOutcome: (...args) => {
        verification = args;
        return null;
      },
    },
    () =>
      Object.freeze({
        tmp: "C:\\operation\\tmp",
        management: "C:\\operation\\management",
      }),
  );
  assert.equal(
    await runtime.cleanupOwnedResources(plan, recovery, managementCapability),
    result,
  );
  assert.ok(cleanupInput);
  assert.equal(
    runtime.verifyCleanupOutcome(result, plan, recovery, managementCapability),
    null,
  );
  assert.equal(verification[0], result);
  assert.equal(
    verification[1],
    (cleanupInput as DockerIsolationRuntimePlan).identity,
  );
  assert.equal(verification[2], recovery);
  assert.equal(verification[3], managementCapability);
  assert.equal(
    verifyRuntimeOwnedDockerCleanupOutcome(
      result,
      plan,
      recovery,
      managementCapability,
    ),
    null,
  );
  fail = true;
  assert.deepEqual(
    await runtime.cleanupOwnedResources(plan, recovery, managementCapability),
    {
      confirmed: false,
      processTreeTerminated: false,
      containersAbsent: false,
      networksAbsent: false,
      resourceObservations: null,
    },
  );
});

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
test("固定planの所属と借用所在を技術Runtimeへ投影する", async () => {
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
  const projection = fixture.projections[0];
  assert.ok(projection);
  assert.equal(projection.purpose, firstCommand.purpose);
  assert.equal(projection.owner, fixture.managementCapability);
  assert.equal(
    projection.input.configuration.homeSourcePath,
    fixture.plan.providerHomeSourcePath,
  );
  assert.equal(
    projection.input.configuration.temporarySourcePath,
    "C:\\operation\\tmp",
  );
  assert.equal(projection.input.stdin, fixture.plan.providerInput);
  assert.deepEqual(invocation.argv, firstCommand.argv);
});

/**
 * 正常清掃後の旧Ownerから認証create／startを再生成できないことを確認する。
 * @responsibility 実Host失効と本番binderの毎回借用を生成点まで接続する。
 * @trace ERB-IT-004
 * @trace ERB-IT-003
 * @precondition 自己生成Repository-local領域と実Windows世代排他を使う。
 * @stimulus 生存中の元二commandを開始し、正常清掃後に回復世代保持中と解放後で再試行する。
 * @observation 元Owner拒否、下位開始・Handle・構成準備の増分0、Root不存在。
 * @oracle 同じcommandの肯定到達を先に確認し、cached借用変異を同じゼロOracleが拒否する。
 * @cleanup 真正清掃のcompleted後だけ自己生成親を削除し、回復世代をfinally解放する。
 * @boundary 実Host／Kernelと本番投影。下位開始は記録代役でDocker・外部Processを作らない。
 */
test("Host Windows: 清掃後の旧Ownerは認証createとstartを再生成しない", async () => {
  assert.equal(process.platform, "win32");
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "retired_owner_test",
  );
  const parent = fs.mkdtempSync(path.join(area.directory, "retired-owner-"));
  const owned = createOwnedOperationDirectories(parent);
  const mount = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    mount,
  );
  let cleaned = false;
  let generation: object | null = null;
  try {
    assert.equal(
      await activateOwnedHostOperationGenerationLock(management),
      "activated",
    );
    const mountBinding = verifyOwnedOperationManagementMountBinding(
      management,
      mount,
    );
    const { plan } = createPlanFixture(null, false, "claude", false, {
      managementCapability: management,
      mountBinding,
    });
    const commands = [
      "create_subscription_auth_probe",
      "start_subscription_auth_probe_attached",
    ].map((purpose) => {
      const command = plan.commands.find((value) => value.purpose === purpose);
      assert.ok(command, purpose);
      return command;
    });
    const nonce = parseHostRecoveryToken(
      borrowOwnedHostRecoverySnapshot(management).snapshot.token,
    ).nonce;
    const cached = borrowOwnedDockerExecutionPaths(management);
    // 下位代役の到達印であり、実構成・実Handle生成の観測ではない。
    const calls = { starts: 0, configurations: 0, handles: 0 };
    const arrivals: Array<{ purpose: string; owner: unknown }> = [];
    const lower = {
      startExecution: () => {
        throw new Error("fixture_session_unused");
      },
      startCommand: (
        purpose: string,
        _input: DockerIsolationRuntimePlan,
        owner: unknown,
      ) => {
        arrivals.push({ purpose, owner });
        calls.starts++;
        calls.configurations++;
        calls.handles++;
        return {
          started: async () => true,
          wait: async () => ({
            status: 0,
            signal: null,
            stdout: "",
            stderr: "",
            outputExceeded: false,
          }),
          terminateAndWait: async () => true,
          closed: () => true,
        };
      },
      cleanupOwnedResources: async () => {
        throw new Error("unused_cleanup");
      },
      verifyCleanupOutcome: () => null,
    };
    const runtime = bindDockerIsolationRuntime(
      lower,
      borrowOwnedDockerExecutionPaths,
    );
    for (const command of commands) {
      const before = { ...calls };
      const count = arrivals.length;
      await runtime.startCommand(command, plan, management).wait(1);
      assert.deepEqual(calls, {
        starts: before.starts + 1,
        configurations: before.configurations + 1,
        handles: before.handles + 1,
      });
      assert.equal(arrivals.length, count + 1);
      assert.deepEqual(arrivals[count], {
        purpose: command.purpose,
        owner: management,
      });
      assert.equal(arrivals[count]?.owner, management);
    }
    assert.deepEqual(calls, { starts: 2, configurations: 2, handles: 2 });
    const cleanup = await cleanupOwnedOperationDirectoriesAsync(owned);
    assert.equal(
      verifyOwnedOperationCleanupOutcome(cleanup, owned),
      "completed",
    );
    cleaned = true;
    assert.equal(fs.existsSync(owned.root), false);
    assert.throws(() => borrowOwnedDockerExecutionPaths(management));
    generation = acquireHostOperationRecoveryGenerationByIdentity(
      owned.root,
      nonce,
    );
    assert.ok(generation);
    const baseline = { ...calls };
    for (const command of commands) {
      const before = { ...calls };
      const count = arrivals.length;
      assert.throws(() => runtime.startCommand(command, plan, management));
      assert.deepEqual(calls, before);
      assert.equal(arrivals.length, count);
    }
    assert.deepEqual(calls, baseline);
    assert.equal(releaseHostOperationRecoveryGeneration(generation), true);
    generation = null;
    for (const command of commands) {
      const before = { ...calls };
      const count = arrivals.length;
      assert.throws(() => runtime.startCommand(command, plan, management));
      assert.deepEqual(calls, before);
      assert.equal(arrivals.length, count);
    }
    assert.deepEqual(calls, baseline);
    const mutant = bindDockerIsolationRuntime(lower, () => cached);
    for (const command of commands) {
      const before = { ...calls };
      const count = arrivals.length;
      await mutant.startCommand(command, plan, management).wait(1);
      assert.deepEqual(calls, {
        starts: before.starts + 1,
        configurations: before.configurations + 1,
        handles: before.handles + 1,
      });
      assert.equal(arrivals.length, count + 1);
      assert.deepEqual(arrivals[count], {
        purpose: command.purpose,
        owner: management,
      });
      assert.equal(arrivals[count]?.owner, management);
      assert.throws(() => assert.deepEqual(calls, before));
    }
    assert.equal(fs.existsSync(owned.root), false);
  } finally {
    if (generation)
      assert.equal(releaseHostOperationRecoveryGeneration(generation), true);
    if (!cleaned) {
      const cleanup = await cleanupOwnedOperationDirectoriesAsync(owned);
      assert.equal(
        verifyOwnedOperationCleanupOutcome(cleanup, owned),
        "completed",
      );
      cleaned = true;
    }
    if (cleaned) {
      assert.equal(fs.realpathSync(parent), parent);
      fs.rmSync(parent, { recursive: true });
      assert.equal(fs.existsSync(parent), false);
    }
  }
});

/**
 * Root存続中のSupervisor失効を本番世代状態と実binderへ接続する。
 * @responsibility liveを戻しても元Ownerからの後発要求を復活させない。
 * @trace ERB-IT-003
 * @trace ERB-IT-004
 * @precondition Kernel取得だけ代役とし、実Filesystemとfreshな本番moduleを使う。
 * @stimulus 元auth create／startの肯定到達後、assertLiveをfalse・trueの順にする。
 * @observation false観測到達、各commandの下位増分0、実体・marker本文不変、解放一回。
 * @oracle 元Owner拒否は不可逆であり、cached借用変異だけが個別ゼロOracleを破る。
 * @cleanup 同じmoduleの真正清掃とmock復元を別finallyで保証する。
 * @boundary 論理Kernel故障・実Filesystem・本番private世代。実Kernel故障やDaemon終端は証明しない。
 */
test("Host Windows: Root存続中の世代失効は旧Ownerを復活させない", async () => {
  const kernelUrl = new URL(
    "../../src/execution/kernel-lock.ts",
    import.meta.url,
  );
  const kernel = await import(kernelUrl.href);
  let live = true,
    falseObservations = 0,
    releases = 0;
  const kernelMock = mock.module(kernelUrl.href, {
    namedExports: {
      ...kernel,
      acquireRuntimeOwnedHostOperationSupervisorLock: async () => ({
        status: "acquired",
        lock: {
          assertLive: () => {
            if (!live) falseObservations++;
            return live;
          },
          release: async () => {
            releases++;
            return "released";
          },
        },
      }),
    },
  });
  try {
    const host = (await import(
      new URL(
        "../../src/execution/operation.ts?generation-loss-test",
        import.meta.url,
      ).href
    )) as typeof import("../../src/execution/operation.ts");
    const area = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "generation_loss_test",
    );
    const parent = fs.mkdtempSync(
      path.join(area.directory, "generation-loss-"),
    );
    const owned = host.createOwnedOperationDirectories(parent);
    const mount = host.createOwnedMountCapability(owned);
    const management = host.createOwnedOperationManagementCapability(
      host.createOwnedOperationContextCapability(owned),
      mount,
    );
    try {
      assert.equal(
        await host.activateOwnedHostOperationGenerationLock(management),
        "activated",
      );
      const mountBinding = host.verifyOwnedOperationManagementMountBinding(
        management,
        mount,
      );
      const { plan } = createPlanFixture(null, false, "claude", false, {
        managementCapability: management,
        mountBinding,
      });
      assert.equal(plan.operationId, mountBinding.operationId);
      const commands = [
        "create_subscription_auth_probe",
        "start_subscription_auth_probe_attached",
      ].map((purpose) => {
        const command = plan.commands.find((item) => item.purpose === purpose);
        assert.ok(command);
        return command;
      });
      const marker = loadHostRecoveryRecordByToken(
        host.borrowOwnedHostRecoverySnapshot(management).snapshot.token,
        owned.root,
      ).marker;
      const beforeRoot = fs.lstatSync(owned.root, { bigint: true });
      const beforeMarker = fs.lstatSync(marker, { bigint: true });
      const markerBytes = fs.readFileSync(marker);
      const cached = host.borrowOwnedDockerExecutionPaths(management);
      const arrivals: Array<{ purpose: string; owner: unknown }> = [];
      const lower = {
        startExecution: () => {
          throw new Error("fixture_session_unused");
        },
        startCommand: (
          purpose: string,
          _input: DockerIsolationRuntimePlan,
          owner: unknown,
        ) => {
          arrivals.push({ purpose, owner });
          return {
            started: async () => true,
            wait: async () => ({
              status: 0,
              signal: null,
              stdout: "",
              stderr: "",
              outputExceeded: false,
            }),
            terminateAndWait: async () => true,
            closed: () => true,
          };
        },
        cleanupOwnedResources: async () => {
          throw new Error("unused_cleanup");
        },
        verifyCleanupOutcome: () => null,
      };
      const runtime = bindDockerIsolationRuntime(
        lower,
        host.borrowOwnedDockerExecutionPaths,
      );
      for (const command of commands) {
        const count = arrivals.length;
        await runtime.startCommand(command, plan, management).wait(1);
        assert.equal(arrivals.length, count + 1);
        assert.equal(arrivals[count]?.purpose, command.purpose);
        assert.equal(arrivals[count]?.owner, management);
      }
      for (const active of [false, true]) {
        live = active;
        for (const command of commands) {
          const count = arrivals.length;
          assert.throws(() => runtime.startCommand(command, plan, management));
          assert.equal(arrivals.length, count);
        }
        assert.throws(() => host.borrowOwnedDockerExecutionPaths(management));
        assert.equal(falseObservations, 1);
      }
      const afterRoot = fs.lstatSync(owned.root, { bigint: true });
      const afterMarker = fs.lstatSync(marker, { bigint: true });
      for (const key of ["dev", "ino", "birthtimeNs"] as const) {
        assert.equal(afterRoot[key], beforeRoot[key]);
        assert.equal(afterMarker[key], beforeMarker[key]);
      }
      assert.deepEqual(fs.readFileSync(marker), markerBytes);
      const mutant = bindDockerIsolationRuntime(lower, () => cached);
      for (const command of commands) {
        const count = arrivals.length;
        await mutant.startCommand(command, plan, management).wait(1);
        assert.equal(arrivals.length, count + 1);
        assert.equal(arrivals[count]?.purpose, command.purpose);
        assert.equal(arrivals[count]?.owner, management);
        assert.throws(() => assert.equal(arrivals.length, count));
      }
    } finally {
      const outcome = await host.cleanupOwnedOperationDirectoriesAsync(owned);
      assert.equal(
        host.verifyOwnedOperationCleanupOutcome(outcome, owned),
        "completed",
      );
      assert.equal(releases, 1);
      assert.equal(fs.existsSync(owned.root), false);
      assert.equal(fs.realpathSync(parent), parent);
      fs.rmSync(parent, { recursive: true });
      assert.equal(fs.existsSync(parent), false);
    }
  } finally {
    kernelMock.restore();
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
  for (const changes of [
    ...[
      "authContainerName",
      "providerContainerName",
      "proxyContainerName",
      "internalNetworkName",
      "egressNetworkName",
      "ownershipLabel",
      "providerImageDigest",
      "proxyImageDigest",
    ].map((key) => ({ [key]: "invalid" })),
    { proxyContainerName: fixture.plan.authContainerName },
  ]) {
    assert.throws(
      () =>
        fixture.runtime.startCommand(
          firstCommand,
          { ...fixture.plan, ...changes },
          fixture.managementCapability,
        ),
      /plan_invalid/u,
    );
  }
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
  const wrongProxyProfile = {
    ...fixture.plan,
    commands: fixture.plan.commands.map((command) =>
      command.purpose === "create_proxy"
        ? {
            ...command,
            argv: command.argv.map((value) =>
              value.startsWith("CRDD_PROXY_PROFILE=")
                ? `CRDD_PROXY_PROFILE=${fixture.plan.provider === "codex" ? "claude" : "codex"}`
                : value,
            ),
          }
        : command,
    ),
  };
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        firstCommand,
        wrongProxyProfile,
        fixture.managementCapability,
      ),
    /plan_invalid/u,
  );
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
  fixture.rejectNextStart();
  assert.throws(
    () =>
      fixture.runtime.startCommand(
        first,
        changed,
        fixture.managementCapability,
      ),
    /docker_effect_plan_replaced/u,
  );
  assert.notEqual(
    fixture.projections[0]?.input.identity,
    fixture.projections[1]?.input.identity,
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
  assert.equal(contract.engine, "npipe:////./pipe/dockerDesktopLinuxEngine");
  assert.equal(
    contract.processTreeTermination,
    "taskkill_exact_pid_tree_then_close",
  );
  assert.deepEqual(contract.dockerCli, {
    contract: "crdd-coordinator/docker-cli-trust",
    contractRevision: 1,
    absolutePath:
      "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe",
    pathLookupAllowed: false,
    publisherOrganization: "Docker Inc",
    trustBasis: "windows_authenticode_valid_docker_inc_publisher",
    exactVersionRequired: false,
    exactHashRequiredAcrossOperations: false,
    sameIdentityAndHashRequiredWithinOperation: true,
    unknownOrInvalidSignatureEffect: "fail_closed_before_docker_effect",
    shellAllowed: false,
  });
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

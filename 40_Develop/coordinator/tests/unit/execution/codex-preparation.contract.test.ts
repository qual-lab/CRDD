/**
 * coordinator:unit:codex-docker-runtime-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:codex-docker-runtime-adapterが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope codex、docker、runtime、adapter
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */
import {
  executionSelection,
  preparationSelection as attemptSelection,
} from "../../fixtures/ai-selection.ts";
import { hashExecutionSelection } from "../../../../domain-model/src/index.ts";
import {
  createProviderDockerRuntimeDependencies,
  describeProviderDockerRuntimeAdapterContract,
} from "../../../src/execution/preparation.ts";
import {
  startRuntimeOwnedDockerProcessController,
  cancelRuntimeOwnedDockerProcessController,
} from "../../../src/execution/provider-executor.ts";
import { createAttemptPreparation } from "../../fixtures/attempt-preparation.ts";
import { planProviderExecution } from "../../../../ai-adapter/src/index.ts";
import { describeAdviceResultSchema } from "../../../../ai-adapter/src/index.ts";
import assert from "node:assert/strict";
import { prepareDockerNetworkPolicy } from "../../../../docker-isolation/src/index.ts";
import test, { mock } from "node:test";
import fs from "node:fs";
import { createPreparationFailure } from "../../../src/execution/preparation.ts";
import { fileURLToPath } from "node:url";
import { createIsolatedDelegationSelectionGrantRuntimeCandidate } from "../../../src/execution/authority.ts";
import { bindIsolationRuntime } from "../../../../executor/scripts/executor-test.ts";
import { describeProviderAuthentication } from "../../../../ai-adapter/src/index.ts";
import { describeDockerProviderExecutionLocations } from "../../../../docker-isolation/src/index.ts";
import { bindAdviceCommand } from "../../../../docker-isolation/src/index.ts";
import { runInNewContext } from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { sourceDeclaration } from "../../../../domain-model/tests/support/source-declaration.ts";

/**
 * 上位の管理情報がExecutor向け実値へ流れないことを反証する。
 * @responsibility 型の削除だけでなく選定・Packet・Pathの明示投影を確認する。
 * @trace PRL-UT-014
 * @precondition 元宣言と合成Ownerの有限代役だけを用いる。
 * @stimulus 上位専用fieldを持つ値を消費し、Executor向けcallback結果を取得する。
 * @observation exact key、元相関値、上位正本の不変と消費回数。
 * @oracle 不要fieldを搬送せず、完全選定の結合と元PacketのHashは維持する。
 * @cleanup N/A: 合成値だけ。実Host・Docker・AIは利用しない。
 * @boundary 上位Ownerから単段入力への値投影。暗号検証の成立は別試験で確認する。
 */
test("Executor向け投影は上位の時刻・速度・助言管理Hashと不要Pathを搬送しない", () => {
  const source = fs.readFileSync(
    new URL("../../../src/execution/preparation.ts", import.meta.url),
    "utf8",
  );
  const completeSelection = { marker: "upper" };
  const technicalSelection = { marker: "technical" };
  const selection = {
    selectionRecordId: "selection",
    operationId: "operation",
    executorProvider: "codex",
    executionSelection: completeSelection,
    selectionHash: "hash",
    taskAttempt: 0,
    model: "model",
    effort: "low",
    speedMode: "normal",
    selectionNotice: "notice",
  };
  const packet = {
    allowedReferences: ["reference"],
    packetRef: "packet",
    operationId: "operation",
    executionSelection: technicalSelection,
    selectionHash: "hash",
    provider: "codex",
    taskHash: "upper-task",
    projectionHash: "upper-projection",
    commandHash: "command",
    packetHash: "packet-hash",
    providerCommand: {},
    providerPrompt: "synthetic",
    repositoryMounted: false,
    workspaceMounted: false,
    toolsAllowed: false,
    sessionPersistenceAllowed: false,
  };
  let selectionConsumed = 0,
    packetConsumed = 0,
    operationBound = 0,
    unexpected = 0;
  const unused = () => {
    unexpected++;
    throw Error("unexpected_effect");
  };
  const declarations = [
    "createProviderDockerRuntimeDependencies",
    "consumeAttemptAdvicePacket",
    "consumeAttemptModelSelection",
  ]
    .map((name) => stripTypeScriptTypes(sourceDeclaration(source, name)))
    .join("\n");
  const callbacks = runInNewContext(
    `${declarations};createProviderDockerRuntimeDependencies()`,
    {
      verifyOwnedOperationManagementMountBinding: () => ({
        operationId: "operation",
        createdAt: "upper-time",
        mounts: {
          workspace: "shared",
          providerHome: "home",
          tmp: "tmp",
          events: "events",
          projection: "projection",
          management: "management",
        },
      }),
      readBorrowedExecutionBinding: () => ({
        target: { executionTree: "execution" },
        protection: { gitSourcePath: "git", internalSourcePath: "internal" },
      }),
      activateRuntimeOwnedProviderHomeMount: unused,
      borrowRuntimeOwnedActiveProviderHomeMountSource: unused,
      completeRuntimeOwnedProviderHomeMount: unused,
      randomBytes: unused,
      performance: { now: unused },
      consumeRuntimeOwnedProviderTaskPacket: unused,
      issueRuntimeOwnedProviderAuthority: unused,
      revokeRuntimeOwnedProviderAuthority: unused,
      consumeRuntimeOwnedProviderAdvicePacket: () => {
        packetConsumed++;
        return packet;
      },
      consumeRuntimeOwnedDelegationSelectionGrant: () => {
        selectionConsumed++;
        return selection;
      },
      projectAttemptSelection: () => ({
        executionSelection: technicalSelection,
        selectionHash: "hash",
      }),
      bindOwnedOperationExecutionSelection: (
        _management: unknown,
        id: unknown,
        complete: unknown,
        ordinal: unknown,
      ) => {
        assert.equal(id, "selection");
        assert.strictEqual(complete, completeSelection);
        assert.equal(ordinal, 0);
        operationBound++;
        return true;
      },
    },
  );
  const binding = callbacks.verifyOperationMount({}, {});
  assert.deepEqual(
    Object.keys(binding).sort(),
    ["operationId", "mounts", "workspaceProtection"].sort(),
  );
  assert.deepEqual(
    Object.keys(binding.mounts).sort(),
    ["workspace", "tmp"].sort(),
  );
  assert.equal(binding.mounts.workspace, "execution");
  assert.equal(binding.operationId, "operation");
  assert.equal(binding.mounts.tmp, "tmp");
  assert.deepEqual(JSON.parse(JSON.stringify(binding.workspaceProtection)), {
    gitSourcePath: "git",
    internalSourcePath: "internal",
  });
  const model = callbacks.consumeModelSelection({}, {});
  assert.equal(Object.hasOwn(model, "speedMode"), false);
  assert.deepEqual(
    Object.keys(model).sort(),
    Object.keys(selection)
      .filter((key) => key !== "speedMode")
      .sort(),
  );
  for (const key of Object.keys(model)) {
    if (key !== "executionSelection")
      assert.strictEqual(
        model[key],
        selection[key as keyof typeof selection],
        key,
      );
  }
  assert.strictEqual(model.executionSelection, technicalSelection);
  const advice = callbacks.consumeAdvicePacket({}, {});
  assert.deepEqual(
    Object.keys(advice).sort(),
    Object.keys(packet)
      .filter((key) => key !== "taskHash" && key !== "projectionHash")
      .sort(),
  );
  assert.equal(advice.packetHash, packet.packetHash);
  for (const key of Object.keys(advice))
    assert.strictEqual(advice[key], packet[key as keyof typeof packet], key);
  assert.equal(packet.taskHash, "upper-task");
  assert.equal(packet.projectionHash, "upper-projection");
  assert.equal(selection.speedMode, "normal");
  assert.deepEqual(
    [selectionConsumed, packetConsumed, operationBound, unexpected],
    [1, 1, 1, 0],
  );
});

/**
 * 共通本番依存の組立てと拒否結果が準備状態を追加しないことを確認する。
 *
 * @responsibility 関数参照、凍結と外部Effect前の固定結果を照合する。
 * @trace PRL-UT-014
 * @precondition 同じCoordinator改訂版から共通組立てを読み込む。
 * @stimulus 本番依存を二回取得し、固定拒否結果を構築する。
 * @observation field集合、関数参照、時計、結果の凍結とEffect field。
 * @oracle 固定依存だけを保持し、StoreやCapabilityを生成せず、拒否結果は全Effect false。
 * @cleanup N/A: 関数参照と値だけを組み立て、資源取得関数を実行しない。
 * @boundary PRL-UT-014=Direct Boundary: 準備依存の共通組立て。
 */
test("共通Provider本番組立てはStoreを共有せず固定依存とEffect前拒否を保持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/execution/provider-executor.ts", import.meta.url),
    "utf8",
  );
  assert.equal([...source.matchAll(/=>\s*createExecutor\(/g)].length, 1);
  assert.doesNotMatch(source, /getRuntimeOwnedProviderDockerAdapter/);
  const first = createProviderDockerRuntimeDependencies();
  const second = createProviderDockerRuntimeDependencies();
  assert.equal(Object.isFrozen(first), true);
  assert.notEqual(first, second);
  assert.deepEqual(
    Object.keys(first).sort(),
    [
      "activateMount",
      "borrowMountSource",
      "completeMount",
      "consumeAdvicePacket",
      "consumeModelSelection",
      "consumeTaskPacket",
      "issueProviderAuthority",
      "monotonicNow",
      "randomBytes",
      "revokeProviderAuthority",
      "verifyOperationMount",
      "wallNow",
    ].sort(),
  );
  for (const key of Object.keys(first) as (keyof typeof first)[]) {
    assert.equal(typeof first[key], "function");
    if (key !== "monotonicNow" && key !== "verifyOperationMount")
      assert.equal(first[key], second[key]);
  }
  assert.equal(Number.isFinite(first.wallNow()), true);
  assert.equal(Number.isFinite(first.monotonicNow()), true);
  const result = createPreparationFailure("fixed_preparation_failure");
  assert.equal(Object.isFrozen(result), true);
  assert.deepEqual(result, {
    status: "blocked",
    reason: "fixed_preparation_failure",
    preparedCapability: null,
    operationId: null,
    grantRef: null,
    selectionRecordId: null,
    selectedModel: null,
    selectedEffort: null,
    selectionNotice: null,
    providerHomeMountLeaseActive: false,
    dockerEffectIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
    processEffectIssued: false,
    providerRequestIssued: false,
    runtimeAuthorityIssued: false,
    operationCapabilityIssued: false,
    hostPathReported: false,
    proxyCredentialReported: false,
  });
});

/**
 * 技術Command検査用の試験投影を介さず、本番の準備記録を確認する。
 * @responsibility 完全Planの往復廃止と記録用投影の狭さを実返却値で反証する。
 * @trace PRL-UT-014
 * @precondition 本番準備OwnerとRequestを受ける実Factory。Home・Docker操作は行わない。
 * @stimulus Probe・編集・レビューの準備を一回消費する。
 * @observation 上位記録とExecutorのkey、五資源・Image・Mode、元参照。
 * @oracle Command・本文・Authorityは記録投影へ出ず、Plan／prepareは公開されない。
 * @cleanup メモリ内の候補のみ。外部資源は生成しない。
 */
test("本番の準備記録は完全Planを受け戻さず試行専用Executorを保持する", () => {
  for (const mode of ["probe", "executor", "reviewer"] as const) {
    const fixture = createFixture(
      {},
      mode !== "probe",
      mode === "reviewer" ? "reviewer" : "executor",
    );
    const prepared = fixture.adapter.prepare({
      ...(mode === "probe"
        ? { purpose: "probe" as const }
        : { purpose: "task" as const, packetCapability: Object.freeze({}) }),
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      mountAuthorizationCapability: fixture.mountAuthorizationCapability,
      selectionUseCapability: fixture.selectionUseCapability,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    });
    assert.equal(prepared.status, "prepared");
    const owned = fixture.adapter.consumeRecord(
      prepared.preparedCapability,
      fixture.managementCapability,
    );
    assert.ok(owned);
    assert.equal("commands" in owned, false);
    assert.equal("providerInput" in owned, false);
    assert.equal("prepare" in owned.executor, false);
    assert.equal("plan" in owned.executor, false);
    assert.equal(Object.isFrozen(owned.executor), true);
    const projection = owned.executor.recordProjection;
    assert.equal(Object.isFrozen(projection), true);
    assert.deepEqual(
      Object.keys(projection).sort(),
      [
        "authContainerName",
        "providerContainerName",
        "proxyContainerName",
        "internalNetworkName",
        "egressNetworkName",
        "ownershipLabel",
        "providerImageDigest",
        "proxyImageDigest",
        "subscriptionOffering",
        "operationMode",
        "workspaceMountMode",
      ].sort(),
    );
    for (const key of Object.keys(projection) as (keyof typeof projection)[])
      assert.equal(projection[key], owned[key]);
    assert.equal(
      fixture.adapter.consumeRecord(
        prepared.preparedCapability,
        fixture.managementCapability,
      ),
      null,
    );
  }
});

const fixedSelection = executionSelection("executor", {
  provider: "codex",
  model: "gpt-5.5",
  effort: "low",
});
const MODEL_SELECTION = Object.freeze({
  selectionRecordId: "MODELSEL-12345678",
  operationId: "OP-123456",
  executorProvider: "codex" as const,
  ...attemptSelection(fixedSelection),
  selectionHash: hashExecutionSelection(fixedSelection) as string,
  taskAttempt: 0 as const,
  model: fixedSelection.modelIdentifier,
  effort: fixedSelection.reasoningEffort,
  speedMode: "normal" as const,
  selectionNotice: "受付時固定選定",
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
    Parameters<typeof createAttemptPreparation<"codex">>[1]
  > = {},
  isTaskMode = false,
  taskRole: "executor" | "reviewer" = "executor",
) {
  const selected = isTaskMode
    ? executionSelection(
        taskRole === "executor" ? "executor" : "independent_reviewer",
        {
          provider: "codex",
          model: "gpt-5.5",
          effort: taskRole === "executor" ? "low" : "medium",
        },
      )
    : fixedSelection;
  const managementCapability = Object.freeze({});
  const mountCapability = Object.freeze({});
  const mountAuthorizationCapability = Object.freeze({});
  const selectionUseCapability = Object.freeze({});
  const activeMountCapability = Object.freeze({});
  const authorityUseCapability = Object.freeze({});
  const authorityControlCapability = Object.freeze({});
  let wallClockMs = 1_000;
  let monotonicMs = 2_000;
  let completionCount = 0;
  let revocationCount = 0;
  let randomValue = 0;
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
    activateMount: (authorization: unknown, management: unknown) => {
      assert.equal(authorization, mountAuthorizationCapability);
      assert.equal(management, managementCapability);
      return Object.freeze({
        status: "activated",
        grant: Object.freeze({
          grantRef: "PHMGRANT-123456",
          provider: "codex",
          operationId: "OP-123456",
          providerHomeIdentityHash: "b".repeat(64),
          providerHomeProtectionHash: "e".repeat(64),
          localUserBindingHash: "f".repeat(64),
          stableLogicalHomeBindingHash: "1".repeat(64),
        }),
        activeMountCapability,
      });
    },
    borrowMountSource: (active: unknown, management: unknown) => {
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      return "C:\\Users\\person\\AppData\\Local\\Qual-Lab\\CRDD\\ProviderHomes\\codex";
    },
    completeMount: (active: unknown, management: unknown) => {
      assert.equal(active, activeMountCapability);
      assert.equal(management, managementCapability);
      completionCount += 1;
      return Object.freeze({ status: "completed" });
    },
    wallNow: () => wallClockMs,
    monotonicNow: () => monotonicMs,
    randomBytes: (size: number) => {
      randomValue += 1;
      return Buffer.alloc(size, randomValue);
    },
    consumeModelSelection: (selection: unknown, management: unknown) => {
      assert.equal(selection, selectionUseCapability);
      assert.equal(management, managementCapability);
      return Object.freeze({
        ...MODEL_SELECTION,
        ...attemptSelection(selected),
        selectionHash: hashExecutionSelection(selected) as string,
        model: selected.modelIdentifier,
        effort: selected.reasoningEffort,
      });
    },
    consumeTaskPacket: () =>
      Object.freeze({
        operationId: "OP-123456",
        taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
        taskRole,
        taskAttempt: 0 as const,
        selectionHash: hashExecutionSelection(selected) as string,
        taskPacketHash: "a".repeat(64),
        prompt: "Implement the bounded local candidate.",
        networkPolicy: (() => {
          const result = prepareDockerNetworkPolicy("codex", []);
          if (result.status !== "ready") throw new Error("fixture");
          return result.policy;
        })(),
        promptTransport: "provider_stdin_only" as const,
      }),
    issueProviderAuthority: (management: unknown, active: unknown) => {
      assert.equal(management, managementCapability);
      assert.equal(active, activeMountCapability);
      return Object.freeze({
        status: "issued",
        useCapability: authorityUseCapability,
        controlCapability: authorityControlCapability,
        operationId: "OP-123456",
        provider: "codex",
        providerHomeMountGrantRef: "PHMGRANT-123456",
        runtimeAuthorityIssued: true,
      });
    },
    revokeProviderAuthority: (control: unknown, management: unknown) => {
      assert.equal(control, authorityControlCapability);
      assert.equal(management, managementCapability);
      revocationCount += 1;
      return Object.freeze({ status: "revoked" });
    },
    ...overrides,
  };
  const adapter = createAttemptPreparation("codex", dependencies);
  return {
    adapter,
    managementCapability,
    mountCapability,
    mountAuthorizationCapability,
    selectionUseCapability,
    getCompletionCount: () => completionCount,
    getRevocationCount: () => revocationCount,
    advanceBeyondLifetime: () => {
      wallClockMs += 30_000;
      monotonicMs += 30_000;
    },
  };
}

/**
 * Workbench助言をRepository非共有のCodex Planへ固定することを検証する。
 *
 * @responsibility 第3実行モードのIdentity、標準入力およびMount境界を判定する。
 * @trace PRL-UT-014
 * @precondition 固定Model Selectionと有効なAdvice Packetを使用する。
 * @stimulus prepareAdviceを実行してPlanを一回消費する。
 * @observation operationMode、Packet Identity、CommandおよびWorkspace Mountを観測する。
 * @oracle workbench_adviceでありRepository／Workspaceを共有しない。
 * @cleanup Provider Effectを発行しないため外部資源はない。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Workbench助言をRepository非共有のCodex Planへ固定する", () => {
  const providerCommand = bindAdviceCommand(
    planProviderExecution(
      {
        provider: "codex",
        purpose: "advice",
        modelSelection: {
          provider: "codex",
          modelIdentifier: "gpt-5.6-sol",
          reasoningEffort: "low",
          identifierKind: "exact",
        },
        resultSchema: describeAdviceResultSchema(),
      },
      describeDockerProviderExecutionLocations("codex", "advice"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready"),
  );
  const dependencies = {
    consumeModelSelection: () => ({
      ...MODEL_SELECTION,
      ...attemptSelection(
        executionSelection("advice", {
          provider: "codex",
          model: "gpt-5.6-sol",
          effort: "low",
        }),
      ),
      selectionHash: hashExecutionSelection(
        executionSelection("advice", {
          provider: "codex",
          model: "gpt-5.6-sol",
          effort: "low",
        }),
      ) as string,
      model: "gpt-5.6-sol",
    }),
    consumeAdvicePacket: () =>
      Object.freeze({
        contract: "crdd-executor/advice-input",
        contractRevision: 2,
        packetRef: "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
        operationId: "OP-123456",
        ...attemptSelection(
          executionSelection("advice", {
            provider: "codex",
            model: "gpt-5.6-sol",
            effort: "low",
          }),
        ),
        provider: "codex" as const,
        taskHash: "2".repeat(64),
        projectionHash: "3".repeat(64),
        commandHash: "4".repeat(64),
        packetHash: "5".repeat(64),
        providerCommand,
        providerPrompt: "Give advice from the supplied projection.",
        allowedReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
        repositoryMounted: false as const,
        workspaceMounted: false as const,
        toolsAllowed: false as const,
        sessionPersistenceAllowed: false as const,
      }),
  };
  for (const change of [
    { operationId: "OP-654321" },
    { selectionHash: "f".repeat(64) },
    { provider: "claude" },
    { repositoryMounted: true },
    { workspaceMounted: true },
    { toolsAllowed: true },
    { sessionPersistenceAllowed: true },
    {
      executionSelection: {
        ...dependencies.consumeAdvicePacket().executionSelection,
        role: "coordinator",
      },
    },
  ]) {
    let authorities = 0;
    const rejected = createFixture(
      {
        ...dependencies,
        consumeAdvicePacket: () =>
          ({ ...dependencies.consumeAdvicePacket(), ...change }) as never,
        issueProviderAuthority: () => {
          authorities++;
          throw Error("unexpected_authority");
        },
      },
      true,
    );
    const result = rejected.adapter.prepare({
      purpose: "advice",
      managementCapability: rejected.managementCapability,
      mountCapability: rejected.mountCapability,
      mountAuthorizationCapability: rejected.mountAuthorizationCapability,
      selectionUseCapability: rejected.selectionUseCapability,
      recoveryCorrelationId: null,
      consumer: "workbench",
      packetCapability: {},
      packetOwnerCapability: {},
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.providerRequestIssued, false);
    assert.equal(result.dockerEffectIssued, false);
    assert.equal(authorities, 0);
    assert.equal(rejected.getCompletionCount(), 1);
  }
  const fixture = createFixture(dependencies, true);
  const prepared = fixture.adapter.prepare({
    purpose: "advice",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "workbench",
    packetCapability: Object.freeze({}),
    packetOwnerCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  const plan = fixture.adapter.consume(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(plan);
  assert.equal(plan.operationMode, "workbench_advice");
  assert.equal(plan.consumer, "workbench");
  assert.equal(
    plan.advicePacketRef,
    "ADVICEPKT-00112233445566778899AABBCCDDEEFF",
  );
  assert.equal(plan.providerInput, "Give advice from the supplied projection.");
  assert.equal(plan.workspaceSourcePath, null);
  assert.equal(plan.workspaceMountMode, null);
  const createProvider = plan.commands.find(
    (command) => command.purpose === "create_provider",
  );
  assert.ok(createProvider);
  assert.equal(createProvider.argv.includes("--init"), true);
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
 * Codex Executorの正規seccomp commandをDocker Effect利用側も同じ意味で受理するを検証する。
 *
 * @responsibility Codex Executorの正規seccomp commandをDocker Effect利用側も同じ意味で受理するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex Executorの正規seccomp commandをDocker Effect利用側も同じ意味で受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex Executorの正規seccomp commandをDocker Effect利用側も同じ意味で受理する", () => {
  const fixture = createFixture({}, true, "executor");
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
    packetCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  const plan = fixture.adapter.consume(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(plan);
  const firstCommand = plan.commands[0];
  assert.ok(firstCommand);
  const authenticationCli = describeProviderAuthentication("codex");
  assert.ok(Object.isFrozen(authenticationCli));
  assert.ok(Object.isFrozen(authenticationCli.statusArgv));
  assert.deepEqual(authenticationCli.statusArgv, ["login", "status"]);
  assert.equal(authenticationCli.homeEnvironmentVariable, "CODEX_HOME");
  assert.equal(authenticationCli.homeDirectoryName, "codex");
  assert.deepEqual(firstCommand.argv.slice(-2), authenticationCli.statusArgv);
  assert.ok(firstCommand.argv.includes("CODEX_HOME=/provider-home"));

  let closed = false;
  const effect = bindIsolationRuntime(
    {
      startExecution: () => {
        throw new Error("fixture_session_unused");
      },
      startCommand: () =>
        Object.freeze({
          started: async () => true,
          wait: async () => {
            closed = true;
            return Object.freeze({
              status: 0,
              signal: null,
              stdout: "",
              stderr: "",
              outputExceeded: false,
            });
          },
          terminateAndWait: async () => {
            closed = true;
            return true;
          },
          closed: () => closed,
        }),
      cleanupOwnedResources: async () => {
        throw new Error("fixture_cleanup_not_configured");
      },
      verifyCleanupOutcome: () => null,
    },
    () =>
      Object.freeze({
        tmp: "C:\\crdd\\operation\\tmp",
        management: "C:\\crdd\\operation\\management",
      }),
  );
  assert.doesNotThrow(() =>
    effect.startCommand(firstCommand, plan, fixture.managementCapability),
  );
});

/**
 * 説明可能な低推論選定を固定Docker command planへ一度だけ結合するを検証する。
 *
 * @responsibility 説明可能な低推論選定を固定Docker command planへ一度だけ結合するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 説明可能な低推論選定を固定Docker command planへ一度だけ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("説明可能な低推論選定を固定Docker command planへ一度だけ結合する", () => {
  const randomCalls: number[] = [];
  const fixture = createFixture({
    randomBytes: (size: number) => {
      randomCalls.push(size);
      return Buffer.alloc(size, size === 8 ? 1 : 2);
    },
  });
  const prepared = fixture.adapter.prepare({
    purpose: "probe",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.selectedModel, "gpt-5.5");
  assert.equal(prepared.selectedEffort, "low");
  assert.equal(Object.hasOwn(prepared, "selectedModelTier"), false);
  assert.equal(prepared.selectionNotice, "受付時固定選定");
  const publicJson = JSON.stringify(prepared);
  assert.doesNotMatch(publicJson, /Users\\\\person/);
  assert.doesNotMatch(publicJson, /CRDD_PROXY_AUTH/);
  assert.doesNotMatch(publicJson, /create_provider/);

  const plan = fixture.adapter.consume(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(plan);
  assert.deepEqual(randomCalls, [8, 32]);
  const expectedNames = {
    internalNetworkName: `crdd-internal-${"01".repeat(8)}`,
    egressNetworkName: `crdd-egress-${"01".repeat(8)}`,
    proxyContainerName: `crdd-proxy-${"01".repeat(8)}`,
    authContainerName: `crdd-auth-${"01".repeat(8)}`,
    providerContainerName: `crdd-codex-${"b".repeat(16)}`,
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
  assert.equal(plan.providerContainerName, `crdd-codex-${"b".repeat(16)}`);
  assert.equal(plan.selectionRecordId, "MODELSEL-12345678");
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
  assert.equal(provider.argv[modelIndex + 1], "gpt-5.6-sol");
  assert.equal(provider.argv.includes('model_reasoning_effort="low"'), true);
  const proxyUrl = provider.argv
    .find((value) => value.startsWith("HTTPS_PROXY="))
    ?.slice("HTTPS_PROXY=".length);
  assert.match(proxyUrl ?? "", /^http:\/\/crdd:[a-f0-9]{64}@proxy:8080$/u);
  assert.equal(provider.argv.includes(`HTTP_PROXY=${proxyUrl}`), true);
  assert.equal(provider.argv.includes(`ALL_PROXY=${proxyUrl}`), true);
  assert.equal(provider.argv.includes("NO_PROXY="), true);
  assert.equal(
    provider.argv.some((value) => value.startsWith("OPENAI_API_KEY=")),
    false,
  );
  assert.equal(
    fixture.adapter.consume(
      prepared.preparedCapability,
      fixture.managementCapability,
    ),
    null,
  );
});

/**
 * 乱数の不正取得と例外が準備後の権限発行へ進まないことを確認する。
 * @responsibility 取得順とMount返却を既存準備から観測する。
 * @trace PRL-UT-014
 * @precondition 固定選定と模擬Mountを持つ実準備Adapterを使う。
 * @stimulus 各取得の短長違反と例外を与える。
 * @observation 乱数呼出列、準備結果、Mount返却とAuthority件数。
 * @oracle 不正Bufferでも二取得を維持し、例外以後は取得しない。Mount返却1、Authority0。
 * @cleanup N/A: 値fixtureのみでDocker・外部AI・実Mountを取得しない。
 * @boundary PRL-UT-014=Direct Boundary: 準備Owner→DI値生成。
 */
test("DI乱数検査の不成立は既存準備のMount返却と発行前停止を保つ", () => {
  for (const mode of [
    "short8",
    "long8",
    "short32",
    "long32",
    "throw8",
    "throw32",
  ]) {
    const randomCalls: number[] = [];
    let authorityCalls = 0;
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
      issueProviderAuthority: () => {
        authorityCalls += 1;
        throw new Error("forbidden");
      },
    });
    const prepared = fixture.adapter.prepare({
      purpose: "probe",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      mountAuthorizationCapability: fixture.mountAuthorizationCapability,
      selectionUseCapability: fixture.selectionUseCapability,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    });
    assert.equal(prepared.status, "blocked");
    assert.deepEqual(randomCalls, mode === "throw8" ? [8] : [8, 32]);
    assert.equal(fixture.getCompletionCount(), 1);
    assert.equal(authorityCalls, 0);
    assert.equal(prepared.dockerEffectIssued, false);
  }
});
/**
 * cancelはMount leaseを完了しprepared capabilityを再利用不能にするを検証する。
 *
 * @responsibility cancelはMount leaseを完了しprepared capabilityを再利用不能にするの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cancelはMount leaseを完了しprepared capabilityを再利用不能にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("cancelはMount leaseを完了しprepared capabilityを再利用不能にする", () => {
  const fixture = createFixture();
  const prepared = fixture.adapter.prepare({
    purpose: "probe",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  const cancelled = fixture.adapter.cancel(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(cancelled.status, "cancelled");
  assert.equal(fixture.getCompletionCount(), 1);
  assert.equal(fixture.getRevocationCount(), 1);
  assert.equal(
    fixture.adapter.cancel(
      prepared.preparedCapability,
      fixture.managementCapability,
    ).status,
    "blocked",
  );
});

/**
 * Task Packetをstdin専用入力と隔離workspace RW mountへ結合するを検証する。
 *
 * @responsibility Task Packetをstdin専用入力と隔離workspace RW mountへ結合するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Task Packetをstdin専用入力と隔離workspace RW mountへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Task Packetをstdin専用入力と隔離workspace RW mountへ結合する", () => {
  const fixture = createFixture({}, true);
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: "recovery.fixture-executor",
    consumer: "coordinator_cli",
    packetCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.selectedModel, "gpt-5.5");
  const plan = fixture.adapter.consume(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(plan);
  assert.equal(plan.operationMode, "isolated_task");
  assert.equal(plan.taskRole, "executor");
  assert.equal(plan.recoveryCorrelationId, "recovery.fixture-executor");
  assert.equal(plan.consumer, "coordinator_cli");
  assert.equal(plan.workspaceMountMode, "read_write");
  assert.equal(plan.providerInput, "Implement the bounded local candidate.");
  const argv = plan.commands.flatMap((command) => command.argv);
  assert.equal(argv.includes(plan.providerInput), false);
  assert.equal(argv.includes("--interactive"), true);
  assert.equal(
    argv.includes(
      "--security-opt=seccomp=" +
        fileURLToPath(
          new URL(
            "../../../../docker-isolation/src/execution/codex-executor-seccomp.json",
            import.meta.url,
          ),
        ),
    ),
    true,
  );
  assert.equal(
    argv.some(
      (value) => value.includes("dst=/work") && !value.includes("readonly"),
    ),
    true,
  );
});

/**
 * Reviewerはread-only workspaceを使いExecutor専用seccomp profileを受け取らないを検証する。
 *
 * @responsibility Reviewerはread-only workspaceを使いExecutor専用seccomp profileを受け取らないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Reviewerはread-only workspaceを使いExecutor専用seccomp profileを受け取らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Reviewerはread-only workspaceを使いExecutor専用seccomp profileを受け取らない", () => {
  const fixture = createFixture(
    {
      consumeTaskPacket: () =>
        Object.freeze({
          operationId: "OP-123456",
          taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
          taskRole: "reviewer" as const,
          taskAttempt: 0 as const,
          selectionHash: hashExecutionSelection(
            executionSelection("independent_reviewer", {
              provider: "codex",
              model: "gpt-5.5",
              effort: "medium",
            }),
          ) as string,
          taskPacketHash: "a".repeat(64),
          prompt: "Review the bounded local candidate.",
          networkPolicy: (() => {
            const result = prepareDockerNetworkPolicy("codex", []);
            if (result.status !== "ready") throw new Error("fixture");
            return result.policy;
          })(),
          promptTransport: "provider_stdin_only" as const,
        }),
    },
    true,
    "reviewer",
  );
  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
    packetCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  const plan = fixture.adapter.consume(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.ok(plan);
  const provider = plan.commands.find(
    (candidate) => candidate.purpose === "create_provider",
  );
  assert.ok(provider);
  assert.equal(plan.workspaceMountMode, "read_only");
  assert.equal(
    provider.argv.some((value) => value.startsWith("--security-opt=seccomp=")),
    false,
  );
  assert.equal(
    provider.argv.some(
      (value) => value.includes("dst=/work") && value.endsWith(",readonly"),
    ),
    true,
  );
});

/**
 * Packet相関の拒否を上位へ移してもEffect前停止を維持する。
 *
 * @responsibility Operation・選定Hash・試行番号・本文搬送の相関拒否を固定する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Packetの四相関を一件ずつ差し替える。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Task Packetの相関不一致は上位準備で拒否しAuthorityを発行しない", () => {
  const selected = executionSelection("executor", {
    provider: "codex",
    model: "gpt-5.5",
    effort: "low",
  });
  const policy = prepareDockerNetworkPolicy("codex", []);
  assert.equal(policy.status, "ready");
  if (policy.status !== "ready") return;
  const base = {
    operationId: "OP-123456",
    taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
    taskRole: "executor",
    taskAttempt: 0,
    selectionHash: hashExecutionSelection(selected),
    taskPacketHash: "a".repeat(64),
    prompt: "synthetic",
    networkPolicy: policy.policy,
    promptTransport: "provider_stdin_only",
  };
  for (const change of [
    { operationId: "OP-654321" },
    { selectionHash: "f".repeat(64) },
    { taskAttempt: 1 },
    { promptTransport: "argv" },
  ]) {
    let authorities = 0;
    const fixture = createFixture(
      {
        consumeTaskPacket: () => ({ ...base, ...change }) as never,
        issueProviderAuthority: () => {
          authorities++;
          throw Error("unexpected_authority");
        },
      },
      true,
    );
    const result = fixture.adapter.prepare({
      purpose: "task",
      packetCapability: {},
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      mountAuthorizationCapability: fixture.mountAuthorizationCapability,
      selectionUseCapability: fixture.selectionUseCapability,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    });
    assert.equal(result.status, "blocked");
    assert.equal(authorities, 0);
    assert.equal(fixture.getCompletionCount(), 1);
  }
});

/**
 * 期限切れ候補を発行前に閉じる。
 * @responsibility 元の期限・Mount回収条件を維持する。
 * @trace PRL-UT-014
 * @precondition 有効な準備候補。
 * @stimulus 二時計を期限外へ進める。
 * @observation 消費拒否とMount終了回数。
 * @oracle Provider Effectを発行しない。
 * @cleanup 合成値だけ。
 */
test("期限切れprepared planはProvider EffectなしでMount leaseを回収する", () => {
  const fixture = createFixture();
  const prepared = fixture.adapter.prepare({
    purpose: "probe",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  fixture.advanceBeyondLifetime();
  assert.equal(
    fixture.adapter.consume(
      prepared.preparedCapability,
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(fixture.getCompletionCount(), 1);
});

/**
 * Executor seccomp profileを検証できなければProvider planを発行しないを検証する。
 *
 * @responsibility Executor seccomp profileを検証できなければProvider planを発行しないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Executor seccomp profileを検証できなければProvider planを発行しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Executor seccomp profileを検証できなければProvider planを発行しない", () => {
  const fixture = createFixture({}, true);
  const lstat = fs.lstatSync;
  let rejected = 0;
  const injected = mock.method(fs, "lstatSync", ((
    ...args: Parameters<typeof fs.lstatSync>
  ) => {
    if (String(args[0]).endsWith("codex-executor-seccomp.json")) {
      rejected += 1;
      throw new Error("injected_seccomp_observation_failure");
    }
    return Reflect.apply(lstat, fs, args);
  }) as typeof fs.lstatSync);
  let prepared: ReturnType<typeof fixture.adapter.prepare>;
  try {
    prepared = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      mountAuthorizationCapability: fixture.mountAuthorizationCapability,
      selectionUseCapability: fixture.selectionUseCapability,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
      packetCapability: Object.freeze({}),
    });
  } finally {
    injected.mock.restore();
  }
  assert.ok(rejected >= 1);
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_plan_invalid");
  assert.equal(prepared.providerRequestIssued, false);
  assert.equal(fixture.getCompletionCount(), 1);
  assert.equal(fixture.getRevocationCount(), 0);
});

/**
 * Operation不一致または高コスト根拠不正ではplanを作らずleaseを回収するを検証する。
 *
 * @responsibility Operation不一致または高コスト根拠不正ではplanを作らずleaseを回収するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Operation不一致または高コスト根拠不正ではplanを作らずleaseを回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Operation不一致または高コスト根拠不正ではplanを作らずleaseを回収する", () => {
  const fixture = createFixture({
    consumeModelSelection: () =>
      Object.freeze({
        ...MODEL_SELECTION,
        operationId: "OP-654321",
      }),
  });
  const prepared = fixture.adapter.prepare({
    purpose: "probe",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_plan_invalid");
  assert.equal(fixture.getCompletionCount(), 1);
});

/**
 * Selection Grantのopaque use aliasをCodex adapterへ一回だけ接続するを検証する。
 *
 * @responsibility Selection Grantのopaque use aliasをCodex adapterへ一回だけ接続するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Selection Grantのopaque use aliasをCodex adapterへ一回だけ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Selection Grantのopaque use aliasをCodex adapterへ一回だけ接続する", () => {
  let randomValue = 40;
  const selectionRuntime =
    createIsolatedDelegationSelectionGrantRuntimeCandidate({
      verifyOperation: () =>
        Object.freeze({
          operationId: "OP-123456",
          createdAt: "2026-08-24T00:00:00.000Z",
        }),
      observeProviderEligibility: () =>
        Object.freeze([
          Object.freeze({
            provider: "claude",
            status: "eligible",
            reason: "ready",
          }),
          Object.freeze({
            provider: "codex",
            status: "eligible",
            reason: "ready",
          }),
        ]),
      wallNow: () => 1_000,
      monotonicNow: () => 2_000,
      randomBytes: (size: number) => {
        randomValue += 1;
        return Buffer.alloc(size, randomValue);
      },
    });
  const fixture = createFixture(
    {
      consumeModelSelection: (selection, management) => {
        const consumed = selectionRuntime.consume(selection, management);
        return consumed
          ? { ...consumed, ...attemptSelection(consumed.executionSelection) }
          : null;
      },
    },
    true,
  );
  const issued = selectionRuntime.issue(fixture.managementCapability, {
    operationId: "OP-123456",
    taskAttempt: 0,
    executionSelection: fixedSelection,
  });
  assert.equal(issued.status, "issued");

  const prepared = fixture.adapter.prepare({
    purpose: "task",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: issued.useCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
    packetCapability: Object.freeze({}),
  });
  assert.equal(prepared.status, "prepared");
  assert.equal(prepared.selectionRecordId, issued.selectionRecordId);
  assert.equal(prepared.selectedModel, issued.selectedModel);
  assert.equal(
    selectionRuntime.consume(
      issued.useCapability,
      fixture.managementCapability,
    ),
    null,
  );
});

/**
 * Selection GrantをconsumeできなければMount leaseだけ回収して停止するを検証する。
 *
 * @responsibility Selection GrantをconsumeできなければMount leaseだけ回収して停止するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Selection GrantをconsumeできなければMount leaseだけ回収して停止するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Selection GrantをconsumeできなければMount leaseだけ回収して停止する", () => {
  const fixture = createFixture({
    consumeModelSelection: () => null,
  });
  const prepared = fixture.adapter.prepare({
    purpose: "probe",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_model_selection_invalid");
  assert.equal(fixture.getCompletionCount(), 1);
});

/**
 * Provider Authorityを発行できなければMount leaseを返しPlanを作らないを検証する。
 *
 * @responsibility Provider Authorityを発行できなければMount leaseを返しPlanを作らないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Authorityを発行できなければMount leaseを返しPlanを作らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider Authorityを発行できなければMount leaseを返しPlanを作らない", () => {
  const fixture = createFixture({
    issueProviderAuthority: () =>
      Object.freeze({
        status: "blocked",
        useCapability: null,
        controlCapability: null,
        operationId: null,
        provider: null,
        providerHomeMountGrantRef: null,
        runtimeAuthorityIssued: false,
      }),
  });
  const prepared = fixture.adapter.prepare({
    purpose: "probe",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_authority_invalid");
  assert.equal(fixture.getCompletionCount(), 1);
});

/**
 * 不一致の発行済みProvider Authorityは失効してMount leaseを返すを検証する。
 *
 * @responsibility 不一致の発行済みProvider Authorityは失効してMount leaseを返すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不一致の発行済みProvider Authorityは失効してMount leaseを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("不一致の発行済みProvider Authorityは失効してMount leaseを返す", () => {
  let revocations = 0;
  const fixture = createFixture({
    issueProviderAuthority: () =>
      Object.freeze({
        status: "issued",
        useCapability: Object.freeze({}),
        controlCapability: Object.freeze({}),
        operationId: "OP-654321",
        provider: "codex",
        providerHomeMountGrantRef: "PHMGRANT-123456",
        runtimeAuthorityIssued: true,
      }),
    revokeProviderAuthority: () => {
      revocations += 1;
      return Object.freeze({ status: "revoked" });
    },
  });
  const prepared = fixture.adapter.prepare({
    purpose: "probe",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.reason, "codex_docker_runtime_authority_invalid");
  assert.equal(fixture.getCompletionCount(), 1);
  assert.equal(revocations, 1);
});

/**
 * prepared取消はAuthority失効とMount解放の両方を要求するを検証する。
 *
 * @responsibility prepared取消はAuthority失効とMount解放の両方を要求するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus prepared取消はAuthority失効とMount解放の両方を要求するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("prepared取消はAuthority失効とMount解放の両方を要求する", () => {
  const fixture = createFixture({
    revokeProviderAuthority: () => Object.freeze({ status: "blocked" }),
  });
  const prepared = fixture.adapter.prepare({
    purpose: "probe",
    managementCapability: fixture.managementCapability,
    mountCapability: fixture.mountCapability,
    mountAuthorizationCapability: fixture.mountAuthorizationCapability,
    selectionUseCapability: fixture.selectionUseCapability,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  });
  assert.equal(prepared.status, "prepared");
  const cancelled = fixture.adapter.cancel(
    prepared.preparedCapability,
    fixture.managementCapability,
  );
  assert.equal(cancelled.status, "blocked");
  assert.equal(
    cancelled.reason,
    "codex_docker_runtime_authority_revoke_invalid",
  );
  assert.equal(fixture.getCompletionCount(), 1);
});

/**
 * production adapterは未発行のCapabilityと未接続Selection Grantを拒否するを検証する。
 *
 * @responsibility production adapterは未発行のCapabilityと未接続Selection Grantを拒否するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production adapterは未発行のCapabilityと未接続Selection Grantを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("production adapterは未発行のCapabilityと未接続Selection Grantを拒否する", () => {
  const prepared = startRuntimeOwnedDockerProcessController(
    "codex",
    {
      purpose: "probe",
      managementCapability: {},
      mountCapability: {},
      mountAuthorizationCapability: {},
      selectionUseCapability: {},
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
    },
    () => true,
  );
  assert.equal(prepared.status, "blocked");
  assert.equal(prepared.providerRequestStarted, false);
  void cancelRuntimeOwnedDockerProcessController({}, {}).then((result) =>
    assert.equal(result.status, "blocked"),
  );
});

/**
 * 公開契約はCoordinator選定とProvider fallbackを分離するを検証する。
 *
 * @responsibility 公開契約はCoordinator選定とProvider fallbackを分離するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約はCoordinator選定とProvider fallbackを分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開契約はCoordinator選定とProvider fallbackを分離する", () => {
  const contract = describeProviderDockerRuntimeAdapterContract("codex");
  assert.equal(contract.contractRevision, 8);
  assert.equal(
    contract.providerHomeCrossProcessLease,
    "docker_global_provider_home_identity_container_name_fail_closed",
  );
  assert.equal(contract.coordinatorPrelaunchModelSelectionAllowed, true);
  assert.equal(contract.providerAutomaticModelSwitchingAllowed, false);
  assert.equal(contract.midExecutionModelSwitchingAllowed, false);
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(contract.highCostSelection, "decisive_reason_required");
  assert.equal(contract.fallbackModelArgumentAllowed, false);
  assert.equal(contract.subscriptionOffering, "chatgpt_subscription_oauth");
  assert.equal(contract.providerDirectEgress, false);
  assert.deepEqual(contract.providerProxyEnvironment, [
    "HTTPS_PROXY",
    "HTTP_PROXY",
    "ALL_PROXY",
    "NO_PROXY_EMPTY",
  ]);
  assert.equal(contract.commandPlanReported, false);
  assert.match(contract.providerAuthority, /short_lived/u);
  assert.equal(
    contract.processController,
    "production_runtime_owned_controller_and_fixed_docker_effect_connected",
  );
});

/**
 * GrantとPacketの操作・役割・試行・選定Hashの差替えを起動前に拒否する。
 * @responsibility 完全選定の各fieldとstage相関を独立に反証する。
 * @trace PRL-UT-014
 * @precondition 正規Executor選定と同じPacket基準Hashを合成する。
 * @stimulus Grantだけ又はPacketだけの一項目を変更する。
 * @observation 拒否、Mount返却、Authority非発行とProvider要求非発行を確認する。
 * @oracle 不一致は全件blockedで、Authority発行0・Mount返却1。
 * @cleanup N/A: 実Docker・Processを作らない。
 * @boundary PRL-UT-014=N/A: 局所準備の代役。
 */
test("GrantとPacketの完全選定・stage差替えをProvider Effect前に拒否する", () => {
  const original = executionSelection("executor", {
    provider: "codex",
    model: "gpt-5.5",
    effort: "low",
  });
  const changes: Record<string, unknown>[] = [
    { provider: "claude" },
    { modelIdentifier: "other-model" },
    { identifierKind: "alias" },
    { reasoningEffort: "high" },
    { purpose: "advice" },
    { catalogIdentity: "f".repeat(64) },
    { configIdentity: "e".repeat(64) },
    { role: "independent_reviewer" },
    { workType: "other" },
    { source: "role_default" },
  ];
  for (const change of changes) {
    let authorities = 0;
    const selected = { ...original, ...change };
    const fixture = createFixture(
      {
        consumeModelSelection: () => ({
          ...MODEL_SELECTION,
          ...attemptSelection(selected as typeof original),
          selectionHash: hashExecutionSelection(selected) ?? "0".repeat(64),
          model:
            typeof selected.modelIdentifier === "string"
              ? selected.modelIdentifier
              : original.modelIdentifier,
          effort: selected.reasoningEffort as typeof original.reasoningEffort,
        }),
        issueProviderAuthority: () => {
          authorities++;
          throw Error("unexpected_authority");
        },
      },
      true,
    );
    const result = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      mountAuthorizationCapability: fixture.mountAuthorizationCapability,
      selectionUseCapability: fixture.selectionUseCapability,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
      packetCapability: Object.freeze({}),
    });
    assert.equal(result.status, "blocked", JSON.stringify(change));
    assert.equal(authorities, 0);
    assert.equal(fixture.getCompletionCount(), 1);
    assert.equal(result.providerRequestIssued, false);
  }
  for (const changed of [
    { operationId: "OP-999999" },
    { taskAttempt: 1 },
    { selectionHash: "d".repeat(64) },
    { taskRole: "reviewer" },
  ]) {
    let authorities = 0;
    const fixture = createFixture(
      {
        consumeTaskPacket: () =>
          ({
            operationId: "OP-123456",
            taskPacketRef: "TASKPKT-00112233445566778899AABBCCDDEEFF",
            taskRole: "executor" as const,
            taskAttempt: 0 as const,
            selectionHash: hashExecutionSelection(original) as string,
            taskPacketHash: "a".repeat(64),
            prompt: "Synthetic bounded instruction",
            networkPolicy: (() => {
              const r = prepareDockerNetworkPolicy("codex", []);
              if (r.status !== "ready") throw Error("fixture");
              return r.policy;
            })(),
            promptTransport: "provider_stdin_only" as const,
            ...changed,
          }) as ReturnType<
            NonNullable<
              Parameters<
                typeof createAttemptPreparation<"codex">
              >[1]["consumeTaskPacket"]
            >
          >,
        issueProviderAuthority: () => {
          authorities++;
          throw Error("unexpected_authority");
        },
      },
      true,
    );
    const result = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      mountAuthorizationCapability: fixture.mountAuthorizationCapability,
      selectionUseCapability: fixture.selectionUseCapability,
      recoveryCorrelationId: null,
      consumer: "coordinator_cli",
      packetCapability: Object.freeze({}),
    });
    assert.equal(result.status, "blocked", JSON.stringify(changed));
    assert.equal(authorities, 0);
    assert.equal(fixture.getCompletionCount(), 1);
  }
});

/**
 * 固定利用側を相関IDから独立して計画へ搬送し、不正値を準備前に拒否する。
 *
 * @responsibility 三利用側の搬送と不正値時のMount・Authority非発行を確認する。
 * @trace PRL-UT-014
 * @precondition 固定Task Packetと模擬Mountを持つ準備Adapterを使用する。
 * @stimulus 各利用側を相関あり・なしで準備し、不正値も渡す。
 * @observation 消費した計画、Mount有効化回数と返却理由を読む。
 * @oracle 利用側は入力定数と一致し、不正値時はMount有効化0で拒否する。
 * @cleanup N/A: Process外資源を生成しない。
 * @boundary PRL-UT-014=Direct Boundary: Task準備入口→固定Provider計画。
 */
test("固定利用側は相関IDと独立し不正値はMount有効化前に拒否する", () => {
  for (const consumer of [
    "coordinator_cli",
    "workbench",
    "orchestrator",
  ] as const) {
    for (const correlation of [null, "task-correlation"]) {
      const fixture = createFixture({}, true);
      const prepared = fixture.adapter.prepare({
        purpose: "task",
        managementCapability: fixture.managementCapability,
        mountCapability: fixture.mountCapability,
        mountAuthorizationCapability: fixture.mountAuthorizationCapability,
        selectionUseCapability: fixture.selectionUseCapability,
        recoveryCorrelationId: correlation,
        consumer: consumer,
        packetCapability: Object.freeze({}),
      });
      assert.equal(prepared.status, "prepared");
      const plan = fixture.adapter.consume(
        prepared.preparedCapability,
        fixture.managementCapability,
      );
      assert.ok(plan);
      assert.equal(plan.consumer, consumer);
      assert.equal(plan.recoveryCorrelationId, correlation);
    }
  }
  for (const consumer of [null, "transient", "durable", {}, 0]) {
    let activationCount = 0;
    const fixture = createFixture(
      {
        activateMount: () => {
          activationCount += 1;
          throw new Error("unexpected_mount_activation");
        },
      },
      true,
    );
    const result = fixture.adapter.prepare({
      purpose: "task",
      managementCapability: fixture.managementCapability,
      mountCapability: fixture.mountCapability,
      mountAuthorizationCapability: fixture.mountAuthorizationCapability,
      selectionUseCapability: fixture.selectionUseCapability,
      recoveryCorrelationId: null,
      consumer: consumer,
      packetCapability: Object.freeze({}),
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "codex_docker_runtime_consumer_invalid");
    assert.equal(activationCount, 0);
  }
});

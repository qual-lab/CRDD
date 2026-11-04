/**
 * 開始時の基本検査を固定Commandの完全照合と区別する。
 * @responsibility 三modeと開始拒否の基本条件を反証する。
 * @trace ERB-IT-004
 * @level UT
 * @scope 純粋な合成計画のみ。
 * @boundary Executorの基本計画検査。
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  planExecution,
  resolveModelSelection,
} from "../../../ai-adapter/src/index.ts";
import {
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "../../../docker-isolation/src/image/assets.ts";
import { prepareDockerNetworkPolicy } from "../../../docker-isolation/src/network/policy.ts";
import { planDockerIsolationCommands } from "../../../docker-isolation/tests/support/execution-plan.ts";
import type { TestAttemptPlan as AttemptPlan } from "../../scripts/executor-test.ts";
import {
  bindTestIsolationRuntime as bindIsolationRuntime,
  isAttemptPlanValid,
  planIdentity,
  prepareAttempt,
  resolveIsolationCommandInput,
  resolveProviderExecution,
  resolveValidatedPlan,
} from "../../scripts/executor-test.ts";
import type { AttemptRequest } from "../../src/attempt/types.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/**
 * 三用途の必須条件と不正変異を照合する。
 * @responsibility 検査移管でmode・consumer・Identity・Command順を緩めない。
 * @trace ERB-IT-004
 * @precondition 実Effectを持たない合成基本計画。
 * @stimulus Probe／編集／レビュー／助言と不正fieldを渡す。
 * @observation 基本検査と完全照合のbool。
 * @oracle 基本形は用途別に受理し、不正fieldと擬似Commandの完全照合は拒否。
 * @cleanup N/A: 外部資源なし。
 * @boundary ERB-IT-004=Direct Boundary: 計画検査。
 */
test("基本計画検査は用途とIdentityを維持し完全Command検査の代替にならない", () => {
  const probe = attemptPlan();
  const unsupported: AttemptPlan["commands"][number] = {
    // @ts-expect-error Docker Isolationが定義しない用途は型でも受理しない。
    purpose: "unsupported_command",
    argv: ["create_subscription_auth_probe"],
  };
  assert.equal(
    isAttemptPlanValid({
      ...probe,
      commands: [unsupported, ...probe.commands.slice(1)],
    }),
    false,
  );
  const task: AttemptPlan = {
    ...probe,
    operationMode: "isolated_task",
    taskRole: "executor",
    providerInput: "synthetic",
    workspaceSourcePath: "C:/synthetic/work",
    workspaceMountMode: "read_write",
  };
  const advice: AttemptPlan = {
    ...probe,
    operationMode: "workbench_advice",
    providerInput: "synthetic",
  };
  for (const plan of [
    probe,
    task,
    { ...task, taskRole: "reviewer", workspaceMountMode: "read_only" },
    advice,
  ]) {
    assert.equal(isAttemptPlanValid(plan as AttemptPlan), true);
  }
  for (const overrides of [
    { executionSelection: { ...probe.executionSelection, provider: "codex" } },
    { commands: [...probe.commands].reverse() },
    { commands: [] },
    { commands: probe.commands.map((c) => ({ ...c, argv: ["bad\0arg"] })) },
    { activeMountCapability: null },
    { stableLogicalHomeBindingHash: "bad" },
    {
      executionSelection: {
        ...probe.executionSelection,
        configIdentity: "a".repeat(64),
      },
    },
  ])
    assert.equal(
      isAttemptPlanValid({ ...probe, ...overrides } as unknown as AttemptPlan),
      false,
    );
  assert.equal(
    isAttemptPlanValid({ ...task, workspaceMountMode: "read_only" }),
    false,
  );
  assert.equal(isAttemptPlanValid({ ...advice, taskRole: "executor" }), false);
  assert.equal(resolveValidatedPlan(probe, "C:/synthetic/tmp"), null);
  for (const overrides of [
    {
      executionSelection: {
        ...probe.executionSelection,
        identifierKind: "exact" as const,
      },
    },
    {
      executionSelection: {
        ...probe.executionSelection,
        modelIdentifier: "other-model",
      },
    },
    {
      executionSelection: {
        ...probe.executionSelection,
        reasoningEffort: "high" as const,
      },
    },
  ])
    assert.notEqual(
      planIdentity(probe),
      planIdentity({ ...probe, ...overrides }),
    );
});

/**
 * 共通基本検査と追加の完全照合が同じ本番Session接続へ到達することを確認する。
 * @responsibility 二重管理を撤去しても各拒否条件と下位要求前停止を維持する。
 * @trace ERB-IT-004
 * @precondition 正規Builderと固定構成だけを使い、Runtimeは有限代役にする。
 * @stimulus 三用途・二役割の正例、基本形変異とbyte・Path・Hash・Command変異。
 * @observation 構成取得可否と下位Session開始回数。
 * @oracle 全負例はnull、基本不正は下位開始零、正例だけ代役へ到達する。
 * @cleanup N/A: ファイル書込み・Process・AI・Docker要求なし。
 */
test("共通基本検査と完全構成照合を通った計画だけをSessionへ渡す", () => {
  const synthetic = attemptPlan();
  const temporary = "C:/synthetic/tmp";
  const random = { randomBytes: (size: number) => Buffer.alloc(size, 1) };
  const target = {
    ...synthetic,
    workspaceSourcePath: "C:/synthetic/work",
    temporarySourcePath: temporary,
  };
  const probe = prepareAttempt(random, {
    kind: "attempt",
    purpose: "probe",
    selection: synthetic.executionSelection,
    target,
  });
  const codex = prepareAttempt(random, {
    kind: "attempt",
    purpose: "probe",
    selection: {
      provider: "codex",
      modelIdentifier: "gpt-5.5",
      identifierKind: "exact",
      reasoningEffort: "low",
      purpose: "task",
    },
    target: { ...target, provider: "codex" },
  });
  assert.ok(probe);
  assert.ok(codex);
  /** 既存の正規Docker構成を合成計画へ一度だけ反映する。 */
  function withCommands(plan: AttemptPlan): AttemptPlan {
    const configuration = resolveIsolationCommandInput(
      plan,
      temporary,
      "1".repeat(64),
    );
    assert.ok(configuration);
    const commands = planDockerIsolationCommands(configuration);
    assert.ok(commands);
    return { ...plan, commands };
  }
  const task = withCommands({
    ...codex,
    operationMode: "isolated_task",
    taskRole: "executor",
    providerInput: "synthetic",
    workspaceSourcePath: target.workspaceSourcePath,
    workspaceMountMode: "read_write",
  });
  const reviewer = withCommands({
    ...task,
    taskRole: "reviewer",
    workspaceMountMode: "read_only",
  });
  const adviceBase: AttemptPlan = {
    ...probe,
    operationMode: "workbench_advice",
    executionSelection: { ...probe.executionSelection, purpose: "advice" },
    providerInput: "synthetic",
    adviceAllowedReferences: ["synthetic-reference"],
  };
  const adviceExecution = resolveProviderExecution(adviceBase);
  assert.ok(adviceExecution);
  const advice = withCommands(adviceBase);
  for (const plan of [probe, task, reviewer, advice]) {
    assert.equal(isAttemptPlanValid(plan), true);
    assert.ok(resolveValidatedPlan(plan, temporary));
  }
  const basicFailures: AttemptPlan[] = [
    { ...probe, operationId: "bad" },
    { ...probe, grantRef: "bad" },
    { ...probe, provider: "codex" },
    { ...probe, subscriptionOffering: "chatgpt_subscription_oauth" },
    { ...probe, activeMountCapability: null as unknown as object },
    { ...probe, providerHomeIdentityHash: "bad" },
    { ...probe, providerHomeProtectionHash: "bad" },
    { ...probe, localUserBindingHash: "bad" },
    { ...probe, stableLogicalHomeBindingHash: "bad" },
    { ...probe, commands: [...probe.commands].reverse() },
    { ...task, workspaceMountMode: "read_only" },
  ];
  let starts = 0;
  const unexpectedHook = () => {
    throw Error("unexpected_hook");
  };
  const hooks = {
    onCommandSubmitting: unexpectedHook,
    onCommandNotIssued: unexpectedHook,
    onExecutionSubmitting: unexpectedHook,
    onResourceCreated: unexpectedHook,
    onCommandObserved: unexpectedHook,
    onCommandCompleted: unexpectedHook,
    onExecutionStarted: unexpectedHook,
    onFailure: unexpectedHook,
  };
  const bound = bindIsolationRuntime(
    {
      startExecution: () => {
        starts++;
        throw Error("synthetic_session_reached");
      },
      cleanupOwnedResources: async () => {
        throw Error("unused_cleanup");
      },
      verifyCleanupOutcome: () => null,
    },
    { tmp: temporary, management: "synthetic" },
  );
  assert.equal("startCommand" in bound, false);
  for (const plan of basicFailures) {
    assert.equal(isAttemptPlanValid(plan), false);
    assert.equal(resolveValidatedPlan(plan, temporary), null);
    assert.throws(
      () => bound.startExecution(plan, {}, {}, hooks),
      /docker_effect_plan_invalid/,
    );
  }
  assert.equal(starts, 0);
  assert.throws(
    () => bound.startExecution(probe, {}, {}, hooks),
    /synthetic_session_reached/,
  );
  assert.equal(starts, 1);
  const maximum = withCommands({
    ...task,
    providerInput: "x".repeat(128 * 1024),
  });
  assert.ok(resolveValidatedPlan(maximum, temporary));
  for (const plan of [
    { ...task, providerInput: "x".repeat(128 * 1024 + 1) },
    { ...task, workspaceSourcePath: "C:/synthetic,bad" },
    { ...probe, providerHomeSourcePath: "" },
    { ...probe, providerHomeSourcePath: "C:/synthetic\nbad" },
    {
      ...probe,
      commands: probe.commands.map((c, i) =>
        i ? c : { ...c, argv: [...c.argv, "unexpected"] },
      ),
    },
  ]) {
    assert.equal(resolveValidatedPlan(plan, temporary), null);
  }
});

/**
 * 上位へCommandを返さず、確定入力から従来と同じ助言構成を作る。
 * @responsibility 両Providerのargv・Image・通信境界と不正選定拒否を維持する。
 * @trace ERB-UT-023
 * @precondition 両Provider・三推論強度・Policy有無の合成入力。
 * @stimulus 既存Adapterの正規仕様とExecutor内部構成を比較する。
 * @observation Provider argv、固定Digest、Policy、Workspace非共有、不正入力拒否。
 * @oracle 12構成で同じ技術条件、Commandや専用Hashは上位入力に不要。
 * @cleanup N/A: 値構築だけ。実AI・Dockerなし。
 * @boundary 確定要求→Executor内部→Adapter／DI。
 */
test("助言の内部構築は両Providerの既存技術条件を維持する", () => {
  const base = attemptPlan();
  for (const provider of ["codex", "claude"] as const)
    for (const reasoningEffort of ["low", "medium", "high"] as const) {
      const chosen = resolveModelSelection({
        provider,
        modelIdentifier: provider === "codex" ? "gpt-5.6-sol" : "opus",
        reasoningEffort,
        purpose: "advice",
      });
      assert.equal(chosen.status, "resolved");
      if (chosen.status !== "resolved") throw Error("fixture");
      const selection = {
        provider,
        modelIdentifier: chosen.value.modelIdentifier,
        identifierKind: chosen.value.identifierKind,
        reasoningEffort,
        purpose: "advice" as const,
      };
      const policy = prepareDockerNetworkPolicy(provider, []);
      assert.equal(policy.status, "ready");
      if (policy.status !== "ready") throw Error("fixture");
      const expected = planExecution(
        {
          provider,
          purpose: "advice",
          modelSelection: {
            provider,
            modelIdentifier: selection.modelIdentifier,
            identifierKind: selection.identifierKind,
            reasoningEffort,
          },
          allowedReferences: ["synthetic-reference"],
        },
        describeDockerProviderExecutionLocations(
          provider,
          provider === "codex" ? "alternate" : "primary",
        ),
      );
      assert.equal(expected.status, "ready");
      if (expected.status !== "ready") throw Error("fixture");
      for (const additionalHosts of [null, Object.freeze([] as string[])]) {
        const request: AttemptRequest = {
          kind: "attempt",
          purpose: "advice" as const,
          input: "synthetic",
          additionalHosts,
          allowedReferences: ["ref"],
          selection,
          target: {
            ...base,
            provider,
            workspaceSourcePath: "C:/synthetic/work",
            temporarySourcePath: "C:/synthetic/tmp",
          },
        };
        const plan = prepareAttempt(
          { randomBytes: (size) => Buffer.alloc(size, 1) },
          request,
        );
        assert.ok(plan);
        assert.equal("adviceCommandHash" in plan, false);
        assert.equal(plan.workspaceSourcePath, null);
        assert.equal(plan.workspaceMountMode, null);
        assert.deepEqual(plan.additionalHosts, additionalHosts);
        const random = { randomBytes: (size: number) => Buffer.alloc(size, 1) };
        assert.equal(
          prepareAttempt(random, {
            ...request,
            command: {},
            commandHash: "a".repeat(64),
          } as unknown as AttemptRequest),
          null,
        );
        assert.equal(request.purpose, "advice");
        if (request.purpose !== "advice") assert.fail();
        const { additionalHosts: omitted, ...legacyRequest } = request;
        void omitted;
        assert.equal(
          prepareAttempt(random, legacyRequest as AttemptRequest),
          null,
        );
        const otherPolicy = prepareDockerNetworkPolicy(
          provider === "codex" ? "claude" : "codex",
          [],
        );
        assert.equal(otherPolicy.status, "ready");
        if (otherPolicy.status === "ready")
          assert.equal(
            prepareAttempt(random, {
              ...request,
              additionalHosts: Object.freeze(["https://invalid"]),
            }),
            null,
          );
        if (additionalHosts) {
          const mutable = [...additionalHosts];
          const captured = prepareAttempt(random, {
            ...request,
            additionalHosts: mutable,
          });
          assert.ok(captured);
          mutable.push("later.example");
          assert.deepEqual(captured.additionalHosts, additionalHosts);
        }
        const assets = describeDockerProviderAssets(provider);
        assert.equal(
          plan.providerImageDigest,
          provider === "codex"
            ? describeDockerProviderAssets("codex").alternateIdentity
                .fixedImageDigest
            : assets.fixedImageDigest,
        );
        const command = plan.commands.find(
          (command) => command.purpose === "create_provider",
        );
        assert.ok(command);
        assert.deepEqual(
          command.argv.slice(-expected.plan.argv.length),
          expected.plan.argv,
        );
        const changes: readonly Record<string, unknown>[] = [
          { purpose: "task" },
          { provider: "unsupported" },
          { modelIdentifier: "unsupported" },
          {
            identifierKind:
              chosen.value.identifierKind === "alias" ? "exact" : "alias",
          },
          { reasoningEffort: "unsupported" },
        ];
        for (const change of changes)
          assert.equal(
            prepareAttempt(
              { randomBytes: (size) => Buffer.alloc(size, 1) },
              {
                ...request,
                selection: { ...selection, ...change } as typeof selection,
              },
            ),
            null,
          );
      }
    }
});

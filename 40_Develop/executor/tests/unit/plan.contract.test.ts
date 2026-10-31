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
  isPlanValid,
  planIdentity,
  resolveValidatedPlan,
} from "../../src/attempt/isolation.ts";
import type { AttemptPlan } from "../../src/attempt/types.ts";
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
    isPlanValid({
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
    adviceCommandHash: "b".repeat(64),
    providerInput: "synthetic",
  };
  for (const plan of [
    probe,
    task,
    { ...task, taskRole: "reviewer", workspaceMountMode: "read_only" },
    advice,
  ]) {
    assert.equal(isPlanValid(plan as AttemptPlan), true);
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
      isPlanValid({ ...probe, ...overrides } as unknown as AttemptPlan),
      false,
    );
  assert.equal(
    isPlanValid({ ...task, workspaceMountMode: "read_only" }),
    false,
  );
  assert.equal(isPlanValid({ ...advice, taskRole: "executor" }), false);
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

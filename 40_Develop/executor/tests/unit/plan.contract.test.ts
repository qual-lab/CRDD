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
import type {
  ProviderAttemptPlan,
  PreparedAttemptPlan,
} from "../../src/attempt/types.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/**
 * 共通計画の再利用で準備時の必須項目とProvider相関を緩めない。
 * @responsibility 計画の段階差を型正負例とexact key集合で固定する。
 * @trace ERB-IT-004
 * @precondition 型検査用の合成値だけを扱い、実行へ渡さない。
 * @stimulus 両Provider正例、欠測、購読種別不一致、任意purposeを構築する。
 * @observation 型負例の拒否と、準備計画の全key一致。
 * @oracle 実行計画へ渡せても準備時の追加保証は失わない。
 * @cleanup N/A: 値の構築のみ。
 */
test("準備計画は共有項目を再利用しProvider相関と段階差を維持する", () => {
  const codex: PreparedAttemptPlan<"codex"> = {
    ...attemptPlan(),
    provider: "codex",
    subscriptionOffering: "chatgpt_subscription_oauth",
    recoveryCorrelationId: null,
    advicePacketRef: null,
    advicePacketHash: null,
    adviceCommandHash: null,
    adviceAllowedReferences: null,
    authorityControlCapability: {},
    preparedWallClockMs: 0,
    preparedMonotonicMs: 0,
    selectionNotice: "synthetic",
    workspaceProtection: {
      gitSourcePath: "synthetic",
      internalSourcePath: "synthetic",
    },
    commands: [{ purpose: "create_provider", argv: [] }],
  };
  const claude: PreparedAttemptPlan<"claude"> = {
    ...codex,
    provider: "claude",
    subscriptionOffering: "claude_max",
    taskWorkload: null,
  };
  const execution: ProviderAttemptPlan = codex;
  const mismatch: PreparedAttemptPlan<"codex"> = {
    ...codex,
    // @ts-expect-error Codexの購読種別を他Providerへ替えない。
    subscriptionOffering: "claude_max",
  };
  const extraWorkload: PreparedAttemptPlan<"codex"> = {
    ...codex,
    // @ts-expect-error Codexの新規計画へClaude専用項目を加えない。
    taskWorkload: null,
  };
  const invalidCommand: PreparedAttemptPlan<"codex"> = {
    ...codex,
    // @ts-expect-error 準備計画のpurposeを任意文字列へ広げない。
    commands: [{ purpose: "arbitrary", argv: [] }],
  };
  const { taskWorkload: ignoredWorkload, ...withoutWorkload } = claude;
  // @ts-expect-error Claudeの準備計画は仕事量を必須にする。
  const missingWorkload: PreparedAttemptPlan<"claude"> = withoutWorkload;
  const { recoveryCorrelationId: ignored0, ...without0 } = codex;
  // @ts-expect-error 準備時にrecoveryCorrelationIdを省略しない。
  const missing0: PreparedAttemptPlan<"codex"> = without0;
  void [ignored0, missing0];
  const { advicePacketRef: ignored1, ...without1 } = codex;
  // @ts-expect-error 準備時にadvicePacketRefを省略しない。
  const missing1: PreparedAttemptPlan<"codex"> = without1;
  void [ignored1, missing1];
  const { advicePacketHash: ignored2, ...without2 } = codex;
  // @ts-expect-error 準備時にadvicePacketHashを省略しない。
  const missing2: PreparedAttemptPlan<"codex"> = without2;
  void [ignored2, missing2];
  const { adviceCommandHash: ignored3, ...without3 } = codex;
  // @ts-expect-error 準備時にadviceCommandHashを省略しない。
  const missing3: PreparedAttemptPlan<"codex"> = without3;
  void [ignored3, missing3];
  const { adviceAllowedReferences: ignored4, ...without4 } = codex;
  // @ts-expect-error 準備時にadviceAllowedReferencesを省略しない。
  const missing4: PreparedAttemptPlan<"codex"> = without4;
  void [ignored4, missing4];
  const { authorityControlCapability: ignored5, ...without5 } = codex;
  // @ts-expect-error 準備時にauthorityControlCapabilityを省略しない。
  const missing5: PreparedAttemptPlan<"codex"> = without5;
  void [ignored5, missing5];
  const { preparedWallClockMs: ignored6, ...without6 } = codex;
  // @ts-expect-error 準備時にpreparedWallClockMsを省略しない。
  const missing6: PreparedAttemptPlan<"codex"> = without6;
  void [ignored6, missing6];
  const { preparedMonotonicMs: ignored7, ...without7 } = codex;
  // @ts-expect-error 準備時にpreparedMonotonicMsを省略しない。
  const missing7: PreparedAttemptPlan<"codex"> = without7;
  void [ignored7, missing7];
  const { selectionNotice: ignored8, ...without8 } = codex;
  // @ts-expect-error 準備時にselectionNoticeを省略しない。
  const missing8: PreparedAttemptPlan<"codex"> = without8;
  void [ignored8, missing8];
  const expectedKeys: Record<keyof PreparedAttemptPlan<"codex">, true> = {
    provider: true,
    operationId: true,
    recoveryCorrelationId: true,
    consumer: true,
    grantRef: true,
    executionSelection: true,
    selectionHash: true,
    taskAttempt: true,
    activeMountCapability: true,
    authorityUseCapability: true,
    authorityControlCapability: true,
    providerHomeSourcePath: true,
    providerHomeIdentityHash: true,
    providerHomeProtectionHash: true,
    localUserBindingHash: true,
    stableLogicalHomeBindingHash: true,
    preparedWallClockMs: true,
    preparedMonotonicMs: true,
    authContainerName: true,
    providerContainerName: true,
    proxyContainerName: true,
    internalNetworkName: true,
    egressNetworkName: true,
    ownershipLabel: true,
    providerImageDigest: true,
    proxyImageDigest: true,
    networkPolicy: true,
    selectionRecordId: true,
    subscriptionOffering: true,
    selectedModel: true,
    selectedEffort: true,
    selectionNotice: true,
    operationMode: true,
    taskRole: true,
    taskPacketRef: true,
    taskPacketHash: true,
    advicePacketRef: true,
    advicePacketHash: true,
    adviceCommandHash: true,
    adviceAllowedReferences: true,
    providerInput: true,
    workspaceSourcePath: true,
    workspaceProtection: true,
    workspaceMountMode: true,
    commands: true,
  };
  assert.deepEqual(
    Reflect.ownKeys(codex).sort(),
    Reflect.ownKeys(expectedKeys).sort(),
  );
  assert.deepEqual(
    Reflect.ownKeys(claude).sort(),
    [...Reflect.ownKeys(expectedKeys), "taskWorkload"].sort(),
  );
  void [
    execution,
    mismatch,
    extraWorkload,
    invalidCommand,
    ignoredWorkload,
    missingWorkload,
  ];
});

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
  const task: ProviderAttemptPlan = {
    ...probe,
    operationMode: "isolated_task",
    taskRole: "executor",
    taskPacketRef: `TASKPKT-${"A".repeat(32)}`,
    taskPacketHash: "a".repeat(64),
    providerInput: "synthetic",
    workspaceSourcePath: "C:/synthetic/work",
    workspaceMountMode: "read_write",
  };
  const advice: ProviderAttemptPlan = {
    ...probe,
    operationMode: "workbench_advice",
    advicePacketRef: `ADVICEPKT-${"A".repeat(32)}`,
    advicePacketHash: "a".repeat(64),
    adviceCommandHash: "b".repeat(64),
    providerInput: "synthetic",
  };
  for (const plan of [
    probe,
    task,
    { ...task, taskRole: "reviewer", workspaceMountMode: "read_only" },
    advice,
  ]) {
    assert.equal(isPlanValid(plan as ProviderAttemptPlan), true);
  }
  for (const overrides of [
    { consumer: "unknown" },
    { recoveryCorrelationId: "bad/id" },
    { taskAttempt: 2 },
    { executionSelection: { ...probe.executionSelection, provider: "codex" } },
    { commands: [...probe.commands].reverse() },
    { commands: [] },
    { commands: probe.commands.map((c) => ({ ...c, argv: ["bad\0arg"] })) },
    { activeMountCapability: null },
    { stableLogicalHomeBindingHash: "bad" },
    { selectionHash: "bad" },
    { selectionHash: "A".repeat(64) },
    {
      executionSelection: {
        ...probe.executionSelection,
        configIdentity: "a".repeat(64),
      },
    },
  ])
    assert.equal(
      isPlanValid({ ...probe, ...overrides } as unknown as ProviderAttemptPlan),
      false,
    );
  assert.equal(
    isPlanValid({ ...task, workspaceMountMode: "read_only" }),
    false,
  );
  assert.equal(isPlanValid({ ...advice, taskRole: "executor" }), false);
  assert.equal(resolveValidatedPlan(probe, "C:/synthetic/tmp"), null);
  for (const overrides of [
    { selectionHash: "f".repeat(64) },
    { selectionRecordId: "MODELSEL-87654321" },
    { taskAttempt: 1 as const },
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

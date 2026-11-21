/**
 * Provider準備の入力捕捉と計画契約を検査する。
 * @packageDocumentation
 * @responsibility 完全選定・用途・技術投影と不正入力を反証する。
 * @trace PRL-UT-014
 * @trace ERB-UT-023
 * @level UT
 * @scope Process内の値捕捉と有限準備依存のみ。
 * @boundary Coordinatorの準備OwnerとExecutorへの入力捕捉。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { parseAdviceReferences } from "../../../../ai-adapter/src/provider/advice-result.ts";
import { parseModelSelection } from "../../../../executor/src/lifecycle/attempt.ts";
import type { DockerIsolationRuntimeOptions } from "../../../../executor/src/lifecycle/types.ts";
import { attemptPlan } from "../../../../executor/tests/fixtures/attempt-plan.ts";
import {
  capturePreparationInput,
  createPreparationFailure,
} from "../../../src/lifecycle/selection.ts";
import type {
  PreparationFailure,
  PreparationResult,
  PreparedAttemptPlan,
  RecoveryPlan,
} from "../../../src/lifecycle/types.ts";
import {
  type AttemptPreparation,
  createAttemptPreparation,
} from "../../fixtures/attempt-preparation.ts";
import { executionSelection } from "../../fixtures/ai-selection.ts";

/**
 * 構成と準備結果の明示型が元の値契約を保持することを確認する。
 * @responsibility 必須callbackと拒否結果のnull／falseを型・実値の両方で固定する。
 * @trace PRL-UT-014
 * @precondition 合成値だけを扱い、実Hostや外部Effectを呼ばない。
 * @stimulus 必須／任意の構成と、両Providerの無効入力を渡す。
 * @observation 型負例の拒否、全拒否field、取消結果、一回消費不成立。
 * @oracle 型検査をcastで回避せず、拒否でEffectを発行しない。
 * @cleanup N/A: Process内の空Ownerだけ。
 */
/**
 * 共通計画の再利用で準備時の必須項目とProvider相関を緩めない。
 * @responsibility 計画の段階差を型正負例とexact key集合で固定する。
 * @trace ERB-UT-023
 * @precondition 型検査用の合成値だけを扱い、実行へ渡さない。
 * @stimulus 両Provider正例、欠測、購読種別不一致、任意purposeを構築する。
 * @observation 型負例の拒否と、準備計画の全key一致。
 * @oracle 実行計画へ渡せても準備時の追加保証は失わない。
 * @cleanup N/A: 値の構築のみ。
 * @boundary ERB-UT-023=N/A: 型・合成値・有限依存の検査。実AI・Docker・保存なし。
 */
test("準備計画は共有項目を再利用しProvider相関と段階差を維持する", () => {
  const {
    commands: _commands,
    providerInput: _input,
    isolationRequest: _request,
    providerPlan: _providerPlan,
    ...record
  } = attemptPlan();
  void [_commands, _input, _request, _providerPlan];
  const codex: PreparedAttemptPlan<"codex"> = {
    ...record,
    temporarySourcePath: "synthetic",
    workspaceSourcePath: "synthetic",
    executor: {} as never,
    consumer: "coordinator_cli",
    executionSelection: executionSelection(),
    taskAttempt: 0,
    taskPacketRef: null,
    taskPacketHash: null,
    provider: "codex",
    subscriptionOffering: "chatgpt_subscription_oauth",
    recoveryCorrelationId: null,
    advicePacketRef: null,
    advicePacketHash: null,
    adviceAllowedReferences: null,
    workspaceProtection: {
      gitSourcePath: "synthetic",
      internalSourcePath: "synthetic",
    },
  };
  const claude: PreparedAttemptPlan<"claude"> = {
    ...codex,
    provider: "claude",
    subscriptionOffering: "claude_max",
    taskWorkload: null,
  };
  const execution: RecoveryPlan = codex;
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
  const { adviceAllowedReferences: ignored4, ...without4 } = codex;
  // @ts-expect-error 準備時にadviceAllowedReferencesを省略しない。
  const missing4: PreparedAttemptPlan<"codex"> = without4;
  void [ignored4, missing4];
  const expectedKeys: Record<keyof PreparedAttemptPlan<"codex">, true> = {
    provider: true,
    operationId: true,
    recoveryCorrelationId: true,
    consumer: true,
    executionSelection: true,
    taskAttempt: true,
    providerHomeSourcePath: true,
    providerHomeIdentityHash: true,
    stableLogicalHomeBindingHash: true,
    authContainerName: true,
    providerContainerName: true,
    proxyContainerName: true,
    internalNetworkName: true,
    egressNetworkName: true,
    ownershipLabel: true,
    providerImageDigest: true,
    proxyImageDigest: true,
    additionalHosts: true,
    subscriptionOffering: true,
    operationMode: true,
    taskRole: true,
    taskPacketRef: true,
    taskPacketHash: true,
    advicePacketRef: true,
    advicePacketHash: true,
    adviceAllowedReferences: true,
    executor: true,
    temporarySourcePath: true,
    workspaceSourcePath: true,
    workspaceProtection: true,
    workspaceMountMode: true,
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
 * 準備構成の必須接続と開始拒否値を明示型・実値で固定する。
 * @responsibility 準備構成の必須接続と開始拒否値を明示型・実値で固定する。
 * @trace ERB-UT-023
 * @precondition 模擬Storeと両Providerの無効入力だけを使う。
 * @stimulus 構成の型負例と準備失敗・取消を与える。
 * @observation expect-error、拒否fieldと一回消費結果。
 * @oracle 必須項目を緩めず拒否時の外部Effectを零に保つ。
 * @cleanup N/A: 合成値とProcess内Storeのみ。
 * @boundary ERB-UT-023=N/A: 型・合成値・有限依存の検査。実AI・Docker・保存なし。
 */
test("明示した構成・準備型は既存必須項目と拒否値を保持する", () => {
  const paths: Pick<DockerIsolationRuntimeOptions, "paths"> = {
    paths: { tmp: "synthetic", management: "synthetic" },
  };
  // @ts-expect-error 所在借用は必須。
  const missing: Pick<DockerIsolationRuntimeOptions, "paths"> = {};
  const failure: PreparationFailure = createPreparationFailure("synthetic");
  const prepared: PreparationResult<"codex"> = failure;
  // @ts-expect-error 拒否時に操作参照を発行しない。
  const invalid: PreparationFailure = { ...failure, operationId: "synthetic" };
  assert.equal(failure.status, "blocked");
  assert.equal(failure.reason, "synthetic");
  const nullKeys = ["plan", "operationId"] as const;
  const falseKeys = [
    "dockerEffectIssued",
    "filesystemEffectIssued",
    "networkEffectIssued",
    "processEffectIssued",
    "providerRequestIssued",
    "operationCapabilityIssued",
    "hostPathReported",
    "proxyCredentialReported",
  ] as const;
  for (const key of nullKeys) assert.equal(failure[key], null, key);
  for (const key of falseKeys) assert.equal(failure[key], false, key);
  assert.deepEqual(
    Reflect.ownKeys(failure).sort(),
    ["status", "reason", ...nullKeys, ...falseKeys].sort(),
  );
  for (const provider of ["codex", "claude"] as const) {
    // 無効入力の拒否はHostの値を読まずに確定する。
    const owner: AttemptPreparation = createAttemptPreparation(
      provider,
      {} as never,
    );
    assert.equal(owner.productionAuthority, false);
    const result = owner.prepare({} as never);
    assert.equal(result.status, "blocked");
  }
  void [paths, missing, prepared, invalid];
});

/**
 * 回復参照の準備判定をOperation観測より前に行う。
 * @trace ERB-UT-023
 * @precondition 合成のprobe要求と観測に失敗するHost代役。
 * @stimulus 不正参照と、参照を持たない既存の二表現を渡す。
 * @observation Operation照合回数、拒否理由と外部要求の有無。
 * @oracle 不正参照は照合前に止まり、参照なしでは元の照合失敗を返す。
 * @cleanup N/A: メモリ内のみ。
 * @boundary Provider準備とHost照合の順序。
 */
test("準備は不正な回復参照をHost照合前に拒否し参照なしの扱いを維持する", () => {
  let verified = 0;
  const owner = createAttemptPreparation("codex", {
    verifyOperationMount: () => {
      verified++;
      throw new Error("fixture_unavailable");
    },
    randomBytes: () => assert.fail("Host照合失敗後に乱数を取得しない"),
  });
  const input = {
    purpose: "probe" as const,
    managementCapability: {},
    mountCapability: {},
    providerHome: {
      provider: "codex" as const,
      providerHomeSourcePath: "fixture",
      providerHomeIdentityHash: "a".repeat(64),
      stableLogicalHomeBindingHash: "b".repeat(64),
    },
    executionSelection: executionSelection(),
    taskAttempt: 0 as const,
    consumer: "coordinator_cli" as const,
  };
  for (const [recoveryCorrelationId, reason, count] of [
    [
      "invalid/reference",
      "codex_docker_runtime_recovery_correlation_invalid",
      0,
    ],
    [null, "codex_docker_runtime_preparation_failed_closed", 1],
    [undefined, "codex_docker_runtime_preparation_failed_closed", 2],
  ] as const) {
    const prepared = owner.prepare({
      ...input,
      recoveryCorrelationId: recoveryCorrelationId as string | null,
    });
    assert.equal(prepared.reason, reason);
    assert.equal(prepared.providerRequestIssued, false);
    assert.equal(verified, count);
  }
});

/**
 * 参照欠測時にTask／AdviceをProbeへ置き換えない。
 * @trace ERB-UT-023
 * @precondition 両Providerの合成選定と呼出し回数を記録する代役を使う。
 * @stimulus Task参照欠測、Adviceの両方又は片側欠測、明示Probeを渡す。
 * @observation 理由、Host観測・指示消費・計画用乱数の取得回数。
 * @oracle 欠測ではすべて0回、明示ProbeだけがHost照合へ進む。
 * @cleanup N/A: メモリのみ。
 */
test("TaskとAdviceの指示欠測はProbeに変換せず準備前に拒否する", () => {
  for (const provider of ["codex", "claude"] as const) {
    const calls: string[] = [];
    const owner = createAttemptPreparation(provider, {
      verifyOperationMount: () => {
        calls.push("host");
        throw Error("fixture_unavailable");
      },
      consumeTaskPacket: () => {
        calls.push("task");
        return null;
      },
      consumeAdvicePacket: () => {
        calls.push("advice");
        return null;
      },
      randomBytes: () => {
        calls.push("plan");
        return Buffer.alloc(0);
      },
    });
    const selection = executionSelection("executor", {
      provider,
      model: provider === "codex" ? "gpt-5.5" : "opus",
      effort: "medium",
    });
    const adviceSelection = executionSelection("advice", {
      provider,
      model: provider === "codex" ? "gpt-5.6-sol" : "opus",
      effort: "low",
    });
    const common = {
      managementCapability: {},
      mountCapability: {},
      providerHome: {
        provider,
        providerHomeSourcePath: "synthetic",
        providerHomeIdentityHash: "a".repeat(64),
        stableLogicalHomeBindingHash: "b".repeat(64),
      },
      taskAttempt: 0 as const,
      consumer: "workbench",
      recoveryCorrelationId: null,
    };
    for (const missing of [null, undefined]) {
      const task = owner.prepare({
        ...common,
        purpose: "task",
        executionSelection: selection,
        packetCapability: missing,
      });
      assert.equal(task.status, "blocked");
      assert.equal(
        task.reason,
        `${provider}_docker_runtime_task_packet_invalid`,
      );
      assert.equal(task.dockerEffectIssued, false);
      assert.equal(task.providerRequestIssued, false);
      for (const [use, control, reason] of [
        [missing, missing, "advice_packet_invalid"],
        [missing, {}, "input_mode_ambiguous"],
        [{}, missing, "input_mode_ambiguous"],
      ] as const) {
        const advice = owner.prepare({
          ...common,
          purpose: "advice",
          executionSelection: adviceSelection,
          packetCapability: use,
          packetOwnerCapability: control,
        });
        assert.equal(advice.status, "blocked");
        assert.equal(advice.reason, `${provider}_docker_runtime_${reason}`);
        assert.equal(advice.dockerEffectIssued, false);
        assert.equal(advice.providerRequestIssued, false);
      }
    }
    assert.deepEqual(calls, []);
    const probe = owner.prepare({
      ...common,
      purpose: "probe",
      executionSelection: selection,
    });
    assert.equal(
      probe.reason,
      `${provider}_docker_runtime_preparation_failed_closed`,
    );
    assert.deepEqual(calls, ["host"]);
  }
});

/**
 * 用途限定の捕捉と六技術項目を動的値から分離する。
 * @responsibility Domain非依存化で拒否条件を欠落させない。
 * @trace ERB-UT-023
 * @precondition 合成値のみ。
 * @stimulus 各field欠測・余剰・prototype・getter・Proxy・疎配列を渡す。
 * @observation null又は独立した凍結値、getter／trap零。
 * @oracle 保存元情報を受けず、実行Propertyを評価しない。
 * @cleanup N/A: 外部資源なし。
 * @boundary 上位Hostと準備・開始の局所値。
 */
test("用途限定入力は動的値・完全選定・欠測を拒否し技術五項目だけを固定する", () => {
  let calls = 0;
  const selection = {
    provider: "codex",
    modelIdentifier: "gpt-6.1-sol",
    identifierKind: "exact",
    reasoningEffort: "medium",
    purpose: "task",
  };
  const input = {
    purpose: "probe",
    managementCapability: {},
    mountCapability: {},
    providerHome: {
      provider: "codex",
      providerHomeSourcePath: "C:\\provider-home",
      providerHomeIdentityHash: "a".repeat(64),
      stableLogicalHomeBindingHash: "b".repeat(64),
    },
    executionSelection: executionSelection(),
    taskAttempt: 0,
    recoveryCorrelationId: null,
    consumer: "coordinator_cli",
  };
  for (const [base, inspect] of [
    [selection, parseModelSelection],
    [input, capturePreparationInput],
  ] as const) {
    assert.ok(inspect(base));
    for (const key of Object.keys(base)) {
      const missing: Record<string, unknown> = { ...base };
      delete missing[key];
      assert.equal(inspect(missing), null);
      const dynamic = Object.defineProperty({ ...base }, key, {
        get() {
          calls++;
          return "injected";
        },
        enumerable: true,
      });
      assert.equal(inspect(dynamic), null);
      const hidden = Object.defineProperty({ ...base }, key, {
        value: "injected",
        enumerable: false,
      });
      assert.equal(inspect(hidden), null);
    }
    for (const bad of [
      { ...base, extra: true },
      { ...base, [Symbol("x")]: true },
      Object.assign(Object.create({ inherited: true }), base),
      new Proxy(base, {
        ownKeys() {
          calls++;
          throw Error("must_not_read");
        },
      }),
    ])
      assert.equal(inspect(bad), null);
  }
  for (const key of Object.keys(selection))
    for (const bad of [null, "", {}, [], true])
      assert.equal(parseModelSelection({ ...selection, [key]: bad }), null);
  assert.equal(parseModelSelection({ ...selection, role: "executor" }), null);
  assert.equal(
    parseModelSelection({ ...selection, catalogIdentity: "a".repeat(64) }),
    null,
  );
  assert.equal(
    parseModelSelection({ ...selection, configIdentity: "b".repeat(64) }),
    null,
  );
  const captured = parseModelSelection(selection);
  assert.ok(captured && Object.isFrozen(captured));
  assert.notEqual(captured, selection);
  assert.deepEqual(
    Reflect.ownKeys(captured).sort(),
    Reflect.ownKeys(selection).sort(),
  );
  assert.equal(
    parseModelSelection({ ...selection, identifierKind: "alias" }),
    null,
  );
  assert.equal(
    parseModelSelection({
      ...selection,
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      reasoningEffort: "max",
    }),
    null,
  );
  const references = ["synthetic"];
  const parsedReferences = parseAdviceReferences(references);
  assert.equal(parsedReferences.status, "confirmed");
  const fixed = parsedReferences.references;
  references.push("later");
  assert.deepEqual(fixed, ["synthetic"]);
  assert.ok(Object.isFrozen(fixed));
  const longReference = "x".repeat(513);
  const longReferences = parseAdviceReferences([longReference]);
  assert.equal(longReferences.status, "confirmed");
  assert.deepEqual(longReferences.references, [longReference]);
  const sparse = new Array(1);
  const dynamic = Object.defineProperty(["synthetic"], "0", {
    get() {
      calls++;
      return "injected";
    },
    enumerable: true,
  });
  for (const bad of [
    [],
    sparse,
    dynamic,
    ["x", "x"],
    [""],
    ["x\0"],
    new Array(257).fill("x"),
    Object.assign(["x"], { extra: true }),
    new Proxy(["x"], {
      ownKeys() {
        calls++;
        throw Error("must_not_read");
      },
    }),
  ])
    assert.equal(parseAdviceReferences(bad).status, "blocked");
  assert.equal(calls, 0);
});

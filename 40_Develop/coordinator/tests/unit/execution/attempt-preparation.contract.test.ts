/**
 * Provider準備の私有Storeと一回消費を検査する。
 * @packageDocumentation
 * @responsibility 元Owner・二時計・取消後保持を両Providerで反証する。
 * @trace PRL-UT-014
 * @trace ERB-IT-004
 * @level UT
 * @scope Process内の模擬Storeのみ。
 * @boundary Coordinatorの準備OwnerとExecutorへの入力捕捉。
 */
import assert from "node:assert/strict";
import { createAttemptPreparation } from "../../fixtures/attempt-preparation.ts";
import type { RecoveryPlan } from "../../../src/execution/types.ts";
import type {
  AttemptPreparation,
  PreparedAttemptPlan,
} from "../../../src/execution/types.ts";
import { attemptPlan } from "../../../../executor/tests/fixtures/attempt-plan.ts";
import { parseModelSelection } from "../../../../executor/src/attempt/validation.ts";
import { parseAdviceReferences } from "../../../../ai-adapter/src/index.ts";
import test from "node:test";
import {
  cancelProviderDockerPreparation,
  consumeProviderDockerPreparation,
  createProviderDockerRuntimeState,
  createPreparationFailure,
  capturePreparationInput,
} from "../../../src/execution/preparation.ts";
import type { DockerIsolationRuntimeOptions } from "../../../../docker-isolation/src/index.ts";
import type {
  PreparationResult,
  PreparationCancellationResult,
  PreparationFailure,
} from "../../../src/execution/types.ts";

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
 * @trace ERB-IT-004
 * @precondition 型検査用の合成値だけを扱い、実行へ渡さない。
 * @stimulus 両Provider正例、欠測、購読種別不一致、任意purposeを構築する。
 * @observation 型負例の拒否と、準備計画の全key一致。
 * @oracle 実行計画へ渡せても準備時の追加保証は失わない。
 * @cleanup N/A: 値の構築のみ。
 */
test("準備計画は共有項目を再利用しProvider相関と段階差を維持する", () => {
  const {
    commands: _commands,
    providerInput: _input,
    ...record
  } = attemptPlan();
  void [_commands, _input];
  const codex: PreparedAttemptPlan<"codex"> = {
    ...record,
    authorityUseCapability: {},
    temporarySourcePath: "synthetic",
    workspaceSourcePath: "synthetic",
    executor: {} as never,
    consumer: "coordinator_cli",
    selectionRecordId: "MODELSEL-12345678",
    selectionHash: "e".repeat(64),
    taskAttempt: 0,
    taskPacketRef: null,
    taskPacketHash: null,
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
    selectionNotice: true,
    operationMode: true,
    taskRole: true,
    taskPacketRef: true,
    taskPacketHash: true,
    advicePacketRef: true,
    advicePacketHash: true,
    adviceCommandHash: true,
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

test("明示した構成・準備型は既存必須項目と拒否値を保持する", () => {
  const paths: Pick<
    DockerIsolationRuntimeOptions,
    "borrowPaths" | "inspectReceipts"
  > = {
    borrowPaths: () => ({ tmp: "synthetic", management: "synthetic" }),
  };
  // @ts-expect-error 所在借用は必須。
  const missing: Pick<
    DockerIsolationRuntimeOptions,
    "borrowPaths" | "inspectReceipts"
  > = {};
  const failure: PreparationFailure = createPreparationFailure("synthetic");
  const prepared: PreparationResult<"codex"> = failure;
  const cancelled: PreparationCancellationResult = failure;
  // @ts-expect-error 拒否時に操作参照を発行しない。
  const invalid: PreparationFailure = { ...failure, operationId: "synthetic" };
  assert.equal(failure.status, "blocked");
  assert.equal(failure.reason, "synthetic");
  const nullKeys = [
    "preparedCapability",
    "operationId",
    "grantRef",
    "selectionRecordId",
    "selectedModel",
    "selectedEffort",
    "selectionNotice",
  ] as const;
  const falseKeys = [
    "providerHomeMountLeaseActive",
    "dockerEffectIssued",
    "filesystemEffectIssued",
    "networkEffectIssued",
    "processEffectIssued",
    "providerRequestIssued",
    "runtimeAuthorityIssued",
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
    assert.deepEqual(
      owner.cancel(null, null),
      createPreparationFailure(
        `${provider}_docker_runtime_prepared_capability_invalid`,
      ),
    );
    assert.equal(owner.consume(null, null), null);
    assert.equal(owner.consume(null, null), null);
    for (const expired of [false, true]) {
      const capability = {},
        management = {};
      const plan = {
        operationId: "synthetic-operation",
        grantRef: "synthetic-grant",
        activeMountCapability: {},
        authorityControlCapability: {},
        preparedWallClockMs: 0,
        preparedMonotonicMs: 0,
      };
      const state = {
        prepared: new WeakMap([[capability, plan]]),
        managementCapabilities: new WeakMap([[capability, management]]),
        wallNow: () => (expired ? 30_000 : 29_999),
        monotonicNow: () => (expired ? 30_000 : 29_999),
        revokeProviderAuthority: () => ({ status: "revoked" }),
        completeMount: () => ({ status: "completed" }),
      };
      const result: PreparationCancellationResult =
        cancelProviderDockerPreparation(
          state,
          provider,
          createPreparationFailure,
          capability,
          management,
        );
      const status = expired ? "expired" : "cancelled";
      const reason = `${provider}_docker_runtime_preparation_${status}`;
      assert.deepEqual(result, {
        ...createPreparationFailure(reason),
        status,
        operationId: plan.operationId,
        grantRef: plan.grantRef,
      });
      assert.equal(state.prepared.has(capability), false);
      assert.equal(state.managementCapabilities.has(capability), false);
    }
  }
  void [paths, missing, prepared, cancelled, invalid];
});

/**
 * 用途限定の捕捉と六技術項目を動的値から分離する。
 * @responsibility Domain非依存化で拒否条件を欠落させない。
 * @trace ERB-IT-004
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
    mountAuthorizationCapability: {},
    selectionUseCapability: {},
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
    ["x".repeat(513)],
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

/**
 * 準備Storeを生成するだけではHost操作を呼ばず、Provider・Owner間で共有しない。
 * @responsibility 旧Owner直結Caseの私有Map Oracleを移管先で維持する。
 * @trace PRL-UT-014
 * @precondition Host操作は呼ばれれば失敗する有限代役。
 * @stimulus 同Provider二Ownerと別Provider一Ownerを生成する。
 * @observation 二Storeの実体差と元Capabilityの登録範囲。
 * @oracle 別Ownerは元登録を持たず、構築時のHost呼出しは零。
 * @cleanup N/A: Process内のWeakMapだけ。
 * @boundary Executor内の準備Owner。
 */
test("準備Mapは同Provider別Ownerと別Providerで共有しない", () => {
  let calls = 0;
  const unavailable = (): never => {
    calls++;
    throw Error("unexpected_host_call");
  };
  const dependencies = {
    verifyOperationMount: unavailable,
    activateMount: unavailable,
    borrowMountSource: unavailable,
    completeMount: unavailable,
    wallNow: unavailable,
    monotonicNow: unavailable,
    randomBytes: unavailable,
    consumeModelSelection: unavailable,
    consumeTaskPacket: unavailable,
    consumeAdvicePacket: unavailable,
    issueProviderAuthority: unavailable,
    revokeProviderAuthority: unavailable,
  };
  const first = createProviderDockerRuntimeState<"codex">(dependencies);
  const others = [
    createProviderDockerRuntimeState<"codex">(dependencies),
    createProviderDockerRuntimeState<"claude">(dependencies),
  ];
  const prepared = {},
    management = {};
  first.managementCapabilities.set(prepared, management);
  assert.equal(first.managementCapabilities.get(prepared), management);
  for (const other of others) {
    assert.equal(Object.isFrozen(other), true);
    assert.notEqual(first.prepared, other.prepared);
    assert.notEqual(first.managementCapabilities, other.managementCapabilities);
    assert.equal(other.managementCapabilities.has(prepared), false);
  }
  assert.equal(calls, 0);
});

/**
 * 共通準備Lifecycleは参照一致・二時計・回収順序を保持する。
 *
 * @responsibility 共通化による管理不一致の受理、期限緩和、回収未確認の参照消失を反証する。
 * @trace PRL-UT-014
 * @precondition Providerごとの独立した二WeakMapと同期回収観測を用意する。
 * @stimulus 管理不一致、新鮮消費、30秒境界と逆行・不明時計、回収失敗を適用する。
 * @observation 計画Identity、二Storeの残存、失効とMount解放の順序を観測する。
 * @oracle 新鮮値だけを一回消費し、期限切れは回収順序を維持し、Mount未確認では参照を残す。
 * @cleanup N/A: WeakMapだけを操作し、実AuthorityやMountを発行しない。
 * @boundary PRL-UT-014=Direct Boundary: Provider準備Owner→共通Lifecycle
 */
test("共通準備Lifecycleは管理一致・二時計境界・回収未確認の保持を両Providerで維持する", () => {
  for (const provider of ["codex", "claude"] as const) {
    for (const scenario of [
      "fresh",
      "expired",
      "monotonic_expired",
      "reversed",
      "unknown",
      "mount_unknown",
      "revoke_failed",
    ] as const) {
      const capability = {};
      const management = {};
      const plan = Object.freeze({
        operationId: "fixture-operation",
        grantRef: "fixture-grant",
        activeMountCapability: {},
        authorityControlCapability: {},
        preparedWallClockMs: 0,
        preparedMonotonicMs: 0,
        provider,
      });
      const effects: string[] = [];
      const state = {
        prepared: new WeakMap([[capability, plan]]),
        managementCapabilities: new WeakMap([[capability, management]]),
        wallNow: () =>
          scenario === "fresh" || scenario === "monotonic_expired"
            ? 29_999
            : scenario === "reversed"
              ? -1
              : scenario === "unknown"
                ? Number.NaN
                : 30_000,
        monotonicNow: () => (scenario === "fresh" ? 29_999 : 30_000),
        revokeProviderAuthority: () => {
          effects.push("revoke");
          return {
            status: scenario === "revoke_failed" ? "blocked" : "revoked",
          };
        },
        completeMount: () => {
          effects.push("mount");
          return {
            status: scenario === "mount_unknown" ? "unknown" : "completed",
          };
        },
      };
      assert.equal(
        consumeProviderDockerPreparation(state, capability, {}),
        null,
      );
      assert.deepEqual(effects, []);
      assert.strictEqual(state.prepared.get(capability), plan);
      if (scenario === "mount_unknown" || scenario === "revoke_failed") {
        const result = cancelProviderDockerPreparation(
          state,
          provider,
          (reason) => ({
            status: "blocked" as const,
            reason,
            operationId: null,
            grantRef: null,
          }),
          capability,
          management,
        );
        assert.equal(
          result.reason,
          `${provider}_docker_runtime_${scenario === "mount_unknown" ? "mount_release_unconfirmed" : "authority_revoke_invalid"}`,
        );
        assert.equal(result.status, "blocked");
        assert.deepEqual(effects, ["revoke", "mount"]);
        assert.equal(
          state.prepared.has(capability),
          scenario === "mount_unknown",
        );
        assert.equal(
          state.managementCapabilities.has(capability),
          scenario === "mount_unknown",
        );
      } else {
        const consumed = consumeProviderDockerPreparation(
          state,
          capability,
          management,
        );
        assert.strictEqual(consumed, scenario === "fresh" ? plan : null);
        assert.deepEqual(
          effects,
          scenario === "fresh" ? [] : ["revoke", "mount"],
        );
        assert.equal(state.prepared.has(capability), false);
        assert.equal(state.managementCapabilities.has(capability), false);
        assert.equal(
          consumeProviderDockerPreparation(state, capability, management),
          null,
        );
      }
    }
  }
});

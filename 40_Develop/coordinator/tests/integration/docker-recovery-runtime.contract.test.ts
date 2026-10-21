/**
 * 現在の回復開始・終了Capabilityと入力契約を検証する。
 *
 * @packageDocumentation
 * @responsibility 操作Binding、一度だけの終了、不正計画と環境観測前の拒否を確認する。
 * @trace PRL-IT-013
 * @level IT
 * @scope 現在開始／終了Capability、固定計画とConsumer。
 * @boundary PRL-IT-013=Related 2 Blocks: 現在開始Owner→操作確認・状態保存依存。物理回収・fresh再入場は別Suite。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  beginRuntimeOwnedDockerRecovery,
  createIsolatedDockerRecoveryRuntimeCandidate,
} from "../../src/execution/recovery.ts";

const FIRST_RECOVERY =
  "host.crdd-coordinator-doctor-abcdef.00000000-0000-0000-0000-000000000001.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SECOND_RECOVERY =
  "host.crdd-coordinator-doctor-abcdef.00000000-0000-0000-0000-000000000001.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

/**
 * productionPlanのTest準備責務を実行する。
 *
 * @responsibility productionPlanがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus productionPlanを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function productionPlan(operationId: string, stableHome: string) {
  return Object.freeze({
    provider: "claude" as const,
    consumer: "orchestrator" as const,
    operationId,
    grantRef: "PHMGRANT-123456",
    profileId: "PROFILE-123456",
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    stableLogicalHomeBindingHash: stableHome,
    authContainerName: "crdd-auth-0123456789abcdef",
    providerContainerName: "crdd-claude-0123456789abcdef",
    proxyContainerName: "crdd-proxy-0123456789abcdef",
    internalNetworkName: "crdd-internal-0123456789abcdef",
    egressNetworkName: "crdd-egress-0123456789abcdef",
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    providerImageDigest: `sha256:${"a".repeat(64)}`,
    proxyImageDigest: `sha256:${"b".repeat(64)}`,
    operationMode: "isolated_task" as const,
    workspaceMountMode: "read_write" as const,
  });
}

/**
 * createIsolatedFixtureのTest準備責務を実行する。
 *
 * @responsibility createIsolatedFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-IT-013
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus createIsolatedFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
function createIsolatedFixture() {
  const managementCapability = Object.freeze({});
  const otherManagementCapability = Object.freeze({});
  let beginCount = 0;
  let completeCount = 0;
  const runtime = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: (capability) => {
      if (capability !== managementCapability)
        throw new Error("management_invalid");
      return Object.freeze({ operationId: "OP-123456" });
    },
    beginDurableRecovery: (capability, operationId) => {
      assert.equal(capability, managementCapability);
      assert.equal(operationId, "OP-123456");
      beginCount += 1;
      return FIRST_RECOVERY;
    },
    completeDurableRecovery: (capability, recoveryId) => {
      assert.equal(capability, managementCapability);
      assert.equal(recoveryId, FIRST_RECOVERY);
      completeCount += 1;
      return SECOND_RECOVERY;
    },
  });
  return {
    runtime,
    managementCapability,
    otherManagementCapability,
    counts: () => ({ beginCount, completeCount }),
  };
}

/**
 * Docker RecoveryはOperation bindingを確認してからdurable stateを開始するを検証する。
 *
 * @responsibility Docker RecoveryはOperation bindingを確認してからdurable stateを開始するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker RecoveryはOperation bindingを確認してからdurable stateを開始するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Docker RecoveryはOperation bindingを確認してからdurable stateを開始する", () => {
  const fixture = createIsolatedFixture();
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "OP-999999" }),
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(fixture.counts().beginCount, 0);
  const begun = fixture.runtime.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.equal(begun.recoveryId, FIRST_RECOVERY);
  assert.deepEqual(fixture.counts(), { beginCount: 1, completeCount: 0 });
});

/**
 * Docker Recovery capabilityは同一管理権限で一度だけ完了できるを検証する。
 *
 * @responsibility Docker Recovery capabilityは同一管理権限で一度だけ完了できるの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker Recovery capabilityは同一管理権限で一度だけ完了できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Docker Recovery capabilityは同一管理権限で一度だけ完了できる", () => {
  const fixture = createIsolatedFixture();
  const begun = fixture.runtime.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.otherManagementCapability,
    ),
    { status: "blocked" },
  );
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "completed" },
  );
  assert.deepEqual(
    fixture.runtime.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );
  assert.deepEqual(fixture.counts(), { beginCount: 1, completeCount: 1 });
});

/**
 * Docker Recoveryは不正入力と依存例外をfail closedするを検証する。
 *
 * @responsibility Docker Recoveryは不正入力と依存例外をfail closedするの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker Recoveryは不正入力と依存例外をfail closedするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Docker Recoveryは不正入力と依存例外をfail closedする", () => {
  const fixture = createIsolatedFixture();
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "invalid" }),
      fixture.managementCapability,
    ),
    null,
  );
  assert.equal(
    fixture.runtime.begin(
      Object.freeze({ operationId: "OP-123456" }),
      fixture.otherManagementCapability,
    ),
    null,
  );
  assert.deepEqual(fixture.runtime.complete(Object.freeze({}), null), {
    status: "blocked",
  });
  assert.deepEqual(fixture.runtime.complete(null, null), {
    status: "blocked",
  });

  let verificationCount = 0;
  const operationChanges = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => {
      verificationCount += 1;
      return Object.freeze({
        operationId: verificationCount === 1 ? "OP-123456" : "OP-654321",
      });
    },
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => SECOND_RECOVERY,
  });
  const begun = operationChanges.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(begun);
  assert.deepEqual(
    operationChanges.complete(
      begun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  const unchanged = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => FIRST_RECOVERY,
  });
  const unchangedBegun = unchanged.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(unchangedBegun);
  assert.deepEqual(
    unchanged.complete(
      unchangedBegun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  const dependencyFailure = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => {
      throw new Error("begin_failed");
    },
    completeDurableRecovery: () => {
      throw new Error("complete_failed");
    },
  });
  assert.equal(
    dependencyFailure.begin(
      Object.freeze({ operationId: "OP-123456" }),
      fixture.managementCapability,
    ),
    null,
  );

  const completeFailure = createIsolatedDockerRecoveryRuntimeCandidate({
    verifyOperation: () => Object.freeze({ operationId: "OP-123456" }),
    beginDurableRecovery: () => FIRST_RECOVERY,
    completeDurableRecovery: () => {
      throw new Error("complete_failed");
    },
  });
  const completeFailureBegun = completeFailure.begin(
    Object.freeze({ operationId: "OP-123456" }),
    fixture.managementCapability,
  );
  assert.ok(completeFailureBegun);
  assert.deepEqual(
    completeFailure.complete(
      completeFailureBegun.recoveryCapability,
      fixture.managementCapability,
    ),
    { status: "blocked" },
  );

  assert.equal(
    beginRuntimeOwnedDockerRecovery(
      Object.freeze({ operationId: "OP-123456" }) as never,
      Object.freeze({}),
    ),
    null,
  );
});

/**
 * Production Docker Recoveryは不完全なTask planをEffect前に拒否するを検証する。
 *
 * @responsibility Production Docker Recoveryは不完全なTask planをEffect前に拒否するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Production Docker Recoveryは不完全なTask planをEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Production Docker Recoveryは不完全なTask planをEffect前に拒否する", () => {
  assert.equal(
    beginRuntimeOwnedDockerRecovery(
      Object.freeze({ operationId: "OP-123456" }) as never,
      Object.freeze({}),
    ),
    null,
  );
});

/**
 * 固定利用形態が欠けた計画を環境観測前に拒否する。
 * @responsibility 下位Ownerまでの利用形態伝播と観測未発行を検証する。
 * @trace PRL-IT-013
 * @precondition 他項目が有効な計画と観測回数を記録するModule差替えを使用する。
 * @stimulus 欠落・未知・非文字列のconsumerで本番開始を呼ぶ。
 * @observation 拒否結果とProvider Home／Runtime State観測回数を取得する。
 * @oracle 全負例がnullとなり、観測は0回である。
 * @cleanup Module差替えを復元する。外部資源は生成しない。
 * @boundary PRL-IT-013=本番開始入口→環境観測前の計画判定。
 */
test("Production Docker Recoveryは不正Consumerを環境観測前に拒否する", async (t) => {
  let observations = 0;
  /**
   * 不正Consumer時の環境観測を例外で検出する。
   *
   * @responsibility 観測の呼出しがないことを回数と例外で確認する。
   * @trace PRL-IT-013
   * @precondition observationsを0にしHome／Runtime観測をこの関数へ差し替える。
   * @stimulus 欠落、未知、非文字列のconsumerで本番開始を呼ぶ。
   * @observation 開始のnull結果とobservationsを取得する。
   * @oracle 全負例でobservationsは0となり観測例外は発生しない。
   * @cleanup TestContextのModule差替えを復元する。外部資源は生成しない。
   * @boundary 開始前の計画判定と環境観測未発行の境界。
   */
  const observe = () => {
    observations += 1;
    throw new Error("unexpected_environment_observation");
  };
  const providerMock = t.mock.module(
    "../../src/execution/provider-home-windows-adapter.ts",
    {
      namedExports: {
        inspectRuntimeOwnedWindowsProviderHomeCandidate: observe,
        consumeRuntimeOwnedProviderHomeObservationCapability: observe,
      },
    },
  );
  const stateMock = t.mock.module("../../src/execution/protected-root.ts", {
    namedExports: {
      inspectRuntimeOwnedWindowsRuntimeState: observe,
      consumeRuntimeOwnedRuntimeStateRootCapability: observe,
    },
  });
  try {
    const runtime = await import(
      new URL(
        "../../src/execution/recovery.ts?consumer-preflight",
        import.meta.url,
      ).href
    );
    const valid = productionPlan("OP-123456", "5".repeat(64));
    for (const consumer of [undefined, null, "unknown", 1, {}, true]) {
      const plan = { ...valid, consumer };
      if (consumer === undefined) Reflect.deleteProperty(plan, "consumer");
      assert.equal(
        runtime.beginRuntimeOwnedDockerRecovery(
          Object.freeze(plan),
          Object.freeze({}),
        ),
        null,
      );
    }
    assert.equal(observations, 0);
  } finally {
    stateMock.restore();
    providerMock.restore();
  }
});

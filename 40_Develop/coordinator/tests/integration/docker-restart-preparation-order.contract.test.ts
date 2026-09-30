/**
 * coordinator:integration:docker-restart-preparation-orderの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-restart-preparation-orderが所有する検証責務を実行する。
 * @trace ERB-IT-014
 * @level IT
 * @scope docker、restart、preparation、order
 * @boundary ERB-IT-014=Related 2 Blocks: Platform Adapter→Docker Desktop／Engine Observer
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { createDockerRestartHandoffRecord } from "../../src/security/docker-restart-handoff-record.ts";
import {
  createDockerRestartMigrationRecord,
  resolveDockerRestartHistory,
} from "../../src/security/docker-restart-continuation-record.ts";
import {
  createDockerRestartRecord,
  parseDockerRestartRecord,
  validateDockerRestartRecordChain,
} from "../../src/security/docker-restart-record.ts";

// Execute the production preparation body with observed read/write seams. This
// does not substitute for signed Windows integration or confer capabilities.
const source = fs.readFileSync(
  new URL(
    "../../src/security/docker-recovery-runtime-internal.ts",
    import.meta.url,
  ),
  "utf8",
);
const start = source.indexOf(
  "export function prepareRuntimeOwnedDockerRestart(",
);
const end = source.indexOf(
  "export function verifyRuntimeOwnedDockerRestartPreparation(",
  start,
);
assert.ok(start >= 0 && end > start);
const body = stripTypeScriptTypes(
  source.slice(start, end).replace("export function", "function"),
);
/**
 * runPreparationのTest準備責務を実行する。
 *
 * @responsibility runPreparationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runPreparationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
function runPreparation(
  isHistoryValid: boolean,
  shouldIncludeSecondRecovery = false,
) {
  const h = "a".repeat(64);
  const secondHome = "d".repeat(64);
  const secondNonce = "e".repeat(64);
  const secondBase = "f".repeat(64);
  const token = `docker-task.${h}.${h}.${h}`;
  const secondToken = `docker-task.${secondHome}.${secondNonce}.${secondBase}`;
  const root = {
    rootPath: path.resolve("fixture-root"),
    runtimeStateIdentityHash: h,
    runtimeStateProtectionHash: h,
    stableLogicalHomeBindingHash: h,
    localUserBindingHash: "c".repeat(64),
  };
  const binding = {
    recoveryId: token,
    operationNonce: h,
    runtimeExecutionIdentitySha256: h,
    localUserBindingHash: h,
    runtimeStateIdentityHash: h,
    runtimeStateProtectionHash: h,
    stableLogicalHomeBindingHash: h,
    pendingSubmissionSha256: h,
  };
  const origin = createDockerRestartRecord(binding, "stop_intent");
  let writes = 0;
  let releases = 0;
  const acquiredLocks: string[] = [];
  /**
   * lockのTest準備責務を実行する。
   *
   * @responsibility lockがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-014
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus lockを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
   */
  const lock = () => ({
    assertLive: () => true,
    release: () => {
      releases++;
      return true;
    },
  });
  const context = {
    Buffer,
    path,
    Object,
    Error,
    parseDockerTaskRecoveryId: (value: string) =>
      value === secondToken
        ? {
            token: secondToken,
            operationNonce: secondNonce,
            stableLogicalHomeBindingHash: secondHome,
            baseHash: secondBase,
          }
        : {
            token,
            operationNonce: h,
            stableLogicalHomeBindingHash: h,
            baseHash: h,
          },
    verifyBundledCoordinatorPackageFromFixedManifestCandidate: () => ({
      status: "candidate",
      runtimeOwnedReleaseTrustConfirmed: true,
      runtimeExecutionIdentityRuntimeOwned: true,
      crddDistributionConfirmed: true,
      runtimeExecutionIdentitySha256: "b".repeat(64),
      platformAccessArtifact: null,
    }),
    observeRuntimeStateRootFromWindows: () => root,
    restartPathIdentity: () => "fixed",
    discoverRecoveryHostBinding: (
      _root: string,
      recovery: { token: string },
    ) =>
      recovery.token === secondToken
        ? { hostRoot: "host-b", hostNonce: secondNonce }
        : { hostRoot: "host-a", hostNonce: h },
    acquireRuntimeOwnedHostOperationKernelLock: (
      name: string,
      nonce: string,
    ) => {
      acquiredLocks.push(`host:${name}:${nonce}`);
      return lock();
    },
    acquireRuntimeOwnedLogicalProviderHomeKernelLock: (home: string) => {
      acquiredLocks.push(`home:${home}`);
      return lock();
    },
    acquireRuntimeOwnedDockerRuntimeStateKernelLock: (state: string) => {
      acquiredLocks.push(`state:${state}`);
      return lock();
    },
    inspectDockerRecoveryRootSnapshot: () => ({
      status: "completed",
      dockerRecoveryIds: shouldIncludeSecondRecovery
        ? [secondToken, token]
        : [token],
      activeStableLogicalHomeBindingHashes: shouldIncludeSecondRecovery
        ? [secondHome, h]
        : [h],
    }),
    discoverRecoveryRuntimeStateBinding: () => ({
      runtimeStateIdentityHash: h,
      runtimeStateProtectionHash: h,
      runtimeStateBindingHash: h,
      localUserBindingHash: h,
    }),
    inventoryOperationDirectory: () => [
      "submission-create_subscription_auth_probe.json",
      "engine-restart-00.json",
    ],
    readExactJson: (name: string) => ({
      hash: h,
      serialized: name.endsWith("engine-restart-00.json")
        ? origin.toString()
        : "{}\n",
    }),
    parseDockerRestartRecord,
    validateDockerRestartRecordChain,
    createDockerRestartHandoffRecord,
    createDockerRestartMigrationRecord,
    resolveDockerRestartHistory,
    loadHistoricalReleaseManifestEnvelopeForVerification: () => ({
      envelope: {},
    }),
    getPinnedPlatformProvisionerReleaseSignerSpkiDer: () => null,
    verifyHistoricalPlatformProvisionerManifestCandidate: () =>
      isHistoryValid
        ? {
            historicalSignatureVerified: true,
            payload: { runtimeExecutionIdentitySha256: h },
          }
        : null,
    ensureDockerTaskSessionHandoff: () => {
      writes++;
    },
    normalizeDockerRestartScope: (values: readonly string[]) =>
      Object.freeze([...new Set(values)].sort()),
    sameDockerRestartScope: (
      leftValues: readonly string[],
      rightValues: readonly string[],
    ) => {
      const normalizedLeftValues = [...new Set(leftValues)].sort();
      const normalizedRightValues = [...new Set(rightValues)].sort();
      return (
        normalizedLeftValues.length === normalizedRightValues.length &&
        normalizedLeftValues.every(
          (value, index) => value === normalizedRightValues[index],
        )
      );
    },
    dockerRestartPreparations: new WeakMap(),
  };
  const result = runInNewContext(
    `${body}\nprepareRuntimeOwnedDockerRestart("id", ${JSON.stringify(path.resolve("old-release"))});`,
    context,
  );
  return { result, writes, releases, acquiredLocks, secondToken };
}
/**
 * invalid historical signature blocks before protected-root session handoffを検証する。
 *
 * @responsibility invalid historical signature blocks before protected-root session handoffの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus invalid historical signature blocks before protected-root session handoffの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("invalid historical signature blocks before protected-root session handoff", () => {
  const { result, writes, releases } = runPreparation(false);
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "docker_restart_origin_unverified");
  assert.equal(writes, 0);
  assert.equal(releases, 3);
});
/**
 * same stable user re-logon preserves the durable restart principal while preparing a fresh continuationを検証する。
 *
 * @responsibility same stable user re-logon preserves the durable restart principal while preparing a fresh continuationの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus same stable user re-logon preserves the durable restart principal while preparing a fresh continuationの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("same stable user re-logon preserves the durable restart principal while preparing a fresh continuation", () => {
  const { result, writes } = runPreparation(true);
  assert.equal(result.status, "prepared");
  assert.equal(result.currentPhase, "stop_intent");
  assert.equal(result.continuationSeedRequired, true);
  assert.equal(result.handoffPending, true);
  assert.equal(result.historicalStopIntent, true);
  assert.equal(writes, 1);
});

/**
 * 複数Recoveryの検証付き再起動は全Scopeを決定順で停止確認して対象を準備することを検証する。
 *
 * @responsibility 複数Recoveryが存在しても全Host・Home・Runtime Stateを固定して循環停止を作らないことを検証する。
 * @trace ERB-IT-014
 * @precondition 同じRuntime Stateに異なるHostと論理Homeを持つ2件のRecoveryが存在する。
 * @stimulus 先頭Recoveryの検証付き再起動準備を実行する。
 * @observation Lock取得順、準備結果、書込み回数および保持Recovery一覧を観測する。
 * @oracle 全Host、全Home、Runtime Stateの順に決定的にLockされ、対象Recoveryの準備が成立する。
 * @cleanup 準備CapabilityはTest VM内だけに存在し、Host資源を作成しない。
 * @boundary ERB-IT-014=Related 2 Blocks: Recovery Inventory→Docker Restart Preparation
 */
test("multiple recoveries are locked as one restart scope before one exact recovery is prepared", () => {
  const { result, writes, acquiredLocks } = runPreparation(true, true);
  assert.equal(result.status, "prepared");
  assert.equal(writes, 1);
  assert.equal(acquiredLocks.length, 5);
  assert.deepEqual(
    acquiredLocks.map((value) => value.split(":", 1)[0]),
    ["host", "host", "home", "home", "state"],
  );
  assert.ok(result.capability);
});

/**
 * restart revalidation consumes validated record inventory, not publication companionsを検証する。
 *
 * @responsibility restart revalidation consumes validated record inventory, not publication companionsの合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus restart revalidation consumes validated record inventory, not publication companionsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("restart revalidation consumes validated record inventory, not publication companions", () => {
  const verifierEnd = source.indexOf(
    "export function persistRuntimeOwnedDockerRestartPhase(",
    end,
  );
  assert.ok(verifierEnd > end);
  const verifierBody = stripTypeScriptTypes(
    source.slice(end, verifierEnd).replace("export function", "function"),
  );
  const hash = "a".repeat(64);
  const token = `docker-task.${hash}.${hash}.${hash}`;
  const capability = {};
  const directory = path.resolve("fixture-root", `docker-task-${hash}`);
  const record = {
    closed: false,
    persistenceFailed: false,
    locks: [{ assertLive: () => true }],
    root: { rootPath: path.dirname(directory) },
    rootIdentity: "fixed",
    directory,
    directoryIdentity: "fixed",
    submissionName: "submission-create_subscription_auth_probe.json",
    binding: { recoveryId: token, pendingSubmissionSha256: hash },
    recoveryIds: [token],
    activeStableLogicalHomeBindingHashes: [hash],
    continuation: true,
    originRecords: [Buffer.from("origin\n")],
    handoffs: [Buffer.from("handoff\n")],
    records: [],
  };
  const recordNames = [
    record.submissionName,
    "engine-restart-00.json",
    "engine-handoff-00.json",
  ];
  let inventoryReads = 0;
  let isInventoryValid = true;
  let observedRecoveryIds = [token];
  const context = {
    Buffer,
    path,
    capability,
    dockerRestartPreparations: new WeakMap([[capability, record]]),
    restartPathIdentity: () => "fixed",
    parseDockerTaskRecoveryId: () => ({
      token,
      operationNonce: hash,
      baseHash: hash,
    }),
    fs: {
      readdirSync: () =>
        recordNames.flatMap((name) => [name, `${name}.crdd-commit.json`]),
    },
    inventoryOperationDirectory: (...args: string[]) => {
      inventoryReads++;
      assert.deepEqual(args, [directory, token, hash, hash]);
      if (!isInventoryValid) throw new Error("invalid durable publication");
      return recordNames;
    },
    inspectDockerRecoveryRootSnapshot: () => ({
      status: "completed",
      dockerRecoveryIds: observedRecoveryIds,
      activeStableLogicalHomeBindingHashes: [hash],
    }),
    normalizeDockerRestartScope: (values: readonly string[]) =>
      Object.freeze([...new Set(values)].sort()),
    sameDockerRestartScope: (
      leftValues: readonly string[],
      rightValues: readonly string[],
    ) =>
      JSON.stringify([...leftValues].sort()) ===
      JSON.stringify([...rightValues].sort()),
    readExactJson: (name: string) => ({
      hash,
      serialized: name.endsWith("engine-restart-00.json")
        ? "origin\n"
        : "handoff\n",
    }),
  };
  /**
   * verifyのTest準備責務を実行する。
   *
   * @responsibility verifyがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-014
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus verifyを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
   */
  const verify = () =>
    runInNewContext(
      `${verifierBody}\nverifyRuntimeOwnedDockerRestartPreparation(capability);`,
      context,
    );
  assert.equal(verify(), true);
  assert.equal(inventoryReads, 1);
  observedRecoveryIds = [
    token,
    `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
  ];
  assert.equal(verify(), false);
  assert.equal(inventoryReads, 2);
  observedRecoveryIds = [token];
  isInventoryValid = false;
  assert.equal(verify(), false);
  assert.equal(inventoryReads, 3);
});

/**
 * recorded restart recovery resolves the exact target while another recovery remains after same-user re-logonを検証する。
 *
 * @responsibility 別Recoveryを保持したまま、記録済み再起動に結合した対象Recoveryだけを再入場させる合否判定を所有する。
 * @trace ERB-IT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus recorded restart recovery resolves the immutable operation principal after same-user re-logonの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("recorded restart recovery resolves the exact target while another recovery remains after same-user re-logon", () => {
  const recoveryStart = source.indexOf(
    "export function recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart(",
  );
  const recoveryEnd = source.indexOf(
    "export function classifyRuntimeOwnedDockerRecoveryEvidence(",
    recoveryStart,
  );
  assert.ok(recoveryStart >= 0 && recoveryEnd > recoveryStart);
  const recoveryBody = stripTypeScriptTypes(
    source
      .slice(recoveryStart, recoveryEnd)
      .replace("export function", "function"),
  );
  const h = "a".repeat(64);
  const currentRuntime = "b".repeat(64);
  const currentSession = "c".repeat(64);
  const token = `docker-task.${h}.${h}.${h}`;
  const first = {
    contract: "crdd-coordinator/docker-restart-record",
    contractRevision: 1,
    recoveryId: token,
    operationNonce: h,
    runtimeExecutionIdentitySha256: h,
    localUserBindingHash: h,
    runtimeStateIdentityHash: h,
    runtimeStateProtectionHash: h,
    stableLogicalHomeBindingHash: h,
    pendingSubmissionSha256: h,
    sequence: 0,
    previousRecordSha256: null,
    phase: "stop_intent",
  };
  const inventoryEntries = [
    "submission-create_subscription_auth_probe.json",
    "engine-restart-00.json",
    ...Array.from(
      { length: 5 },
      (_entry, index) =>
        `engine-continuation-${String(index).padStart(2, "0")}.json`,
    ),
    "engine-handoff-00.json",
  ];
  const resolvedBindings: Array<Record<string, unknown>> = [];
  const context = {
    Buffer,
    path,
    Object,
    Error,
    parseDockerTaskRecoveryId: () => ({
      token,
      operationNonce: h,
      stableLogicalHomeBindingHash: h,
      baseHash: h,
    }),
    verifyBundledCoordinatorPackageFromFixedManifestCandidate: () => ({
      status: "candidate",
      runtimeOwnedReleaseTrustConfirmed: true,
      runtimeExecutionIdentityRuntimeOwned: true,
      crddDistributionConfirmed: true,
      runtimeExecutionIdentitySha256: currentRuntime,
    }),
    observeRuntimeStateRootFromWindows: () => ({
      rootPath: path.resolve("fixture-root"),
      runtimeStateIdentityHash: h,
      runtimeStateProtectionHash: h,
      stableLogicalHomeBindingHash: h,
      localUserBindingHash: currentSession,
    }),
    inspectDockerRecoveryRootSnapshot: () => ({
      status: "completed",
      dockerRecoveryIds: [
        token,
        `docker-task.${"d".repeat(64)}.${"e".repeat(64)}.${"f".repeat(64)}`,
      ],
      activeStableLogicalHomeBindingHashes: [h, "d".repeat(64)],
    }),
    inventoryOperationDirectory: () => inventoryEntries,
    readExactJson: (name: string) => ({
      hash: name.endsWith("submission-create_subscription_auth_probe.json")
        ? h
        : "d".repeat(64),
      serialized: name.includes("engine-restart") ? "origin\n" : "record\n",
    }),
    parseDockerRestartContinuationRecord: () => ({ record: first }),
    canonical: () => "origin\n",
    parseDockerRestartRecord: () => first,
    resolveDockerRestartHistory: (
      _origin: unknown,
      binding: Record<string, unknown>,
    ) => {
      resolvedBindings.push(binding);
      return { records: [], rawRecords: [], currentPhase: "settled" };
    },
    validateDockerRestartRecordChain: () => null,
    selectPendingDockerSubmissionNamesFromInventory: () => [
      "submission-create_subscription_auth_probe.json",
    ],
    recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver: () => ({
      status: "completed",
      reason: "docker_task_recovery_completed",
    }),
    safeRecoveryReason: (error: unknown) => String(error),
  };
  const result = runInNewContext(
    `${recoveryBody}\nrecoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart("id");`,
    context,
  );
  assert.equal(result.status, "completed");
  const resolvedBinding = resolvedBindings[0];
  assert.ok(resolvedBinding);
  assert.equal(resolvedBinding.localUserBindingHash, h);
  assert.notEqual(resolvedBinding.localUserBindingHash, currentSession);
});

/**
 * Coordinator現在状態の固定encodingと相関を検証する。
 * @responsibility 保存内容検査を実資源の回収証明と分離して反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope coordinator-state-model
 * @boundary PRL-UT-006=Direct Boundary: メモリ内の保存本文。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  COORDINATOR_STATE_SCHEMA,
  coordinatorConsumerCompletionPolicy,
  coordinatorStateContentHash,
  decodeCoordinatorHistoryRows,
  decodeCoordinatorStateSnapshot,
  encodeCoordinatorStateValue,
  prepareCoordinatorHistoryRetention,
  prepareCoordinatorStateCleanupSnapshot,
  prepareCoordinatorStateCompletionSnapshot,
  prepareCoordinatorStateHistoryLine,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateHistorySummary,
  prepareCoordinatorStateHostSnapshot,
  prepareCoordinatorStateLifecycleSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateProjectAcceptanceSnapshot,
  prepareCoordinatorStateReferencesSnapshot,
  prepareCoordinatorStateResourceSnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
  validateCoordinatorStateTransition,
} from "../../../src/state-storage/model.ts";

const binding = "a".repeat(64);

/**
 * 結果受領方式を固定利用側からだけ導出する。
 * @responsibility Orchestratorの耐久ACKを任意指定で省略させない。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成値だけを使う。
 * @stimulus 既知三利用側、未知文字列、方式指定objectとhostile値を渡す。
 * @observation 返却方式とObject変換・getterの呼出し数。
 * @oracle CLIとWorkbenchだけtransient、Orchestratorはdurable、不正値はnull。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary 利用側識別子と保存モデルの値契約。
 */
test("結果受領方式: 固定利用側と任意降格の拒否", () => {
  assert.equal(
    coordinatorConsumerCompletionPolicy("coordinator_cli"),
    "transient",
  );
  assert.equal(coordinatorConsumerCompletionPolicy("workbench"), "transient");
  assert.equal(coordinatorConsumerCompletionPolicy("orchestrator"), "durable");
  let evaluations = 0;
  const hostile = Object.defineProperty({}, "consumer", {
    get() {
      evaluations += 1;
      throw new Error("not_evaluated");
    },
  });
  const proxy = new Proxy(
    {},
    {
      get() {
        evaluations += 1;
        throw new Error("not_evaluated");
      },
    },
  );
  for (const invalid of [
    "",
    "unknown_consumer",
    "transient",
    "durable",
    null,
    undefined,
    0,
    { consumer: "orchestrator", completionPolicy: "transient" },
    ["orchestrator"],
    new String("orchestrator"),
    hostile,
    proxy,
  ])
    assert.equal(coordinatorConsumerCompletionPolicy(invalid), null);
  assert.equal(evaluations, 0);
});
const empty = {
  schema: COORDINATOR_STATE_SCHEMA,
  revision: 1,
  previous: null,
  repositoryBinding: binding,
  operations: [],
  unresolvedRecoveries: [],
  pendingDeliveries: [],
};

/**
 * 正規本文と改訂相関、Repository結合を検証する。
 * @responsibility 現在状態codecの構造相関を検証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成入力だけを使う。
 * @stimulus 正常値と契約を破る値を復号する。
 * @observation 復号結果と不変性を確認する。
 * @oracle 正常値だけを受理し、不正値はnullまたは例外になる。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 保存byte列と純粋codec。
 */
test("Snapshot: 正規本文、改訂、結合と空集合", () => {
  const text = `${encodeCoordinatorStateValue(empty)}\n`;
  const result = decodeCoordinatorStateSnapshot(Buffer.from(text), binding);
  assert.ok(result);
  assert.equal(result.payloadSha256, coordinatorStateContentHash(empty));
  assert.ok(Object.isFrozen(result.snapshot.operations));
  for (const invalid of [
    { ...empty, repositoryBinding: "b".repeat(64) },
    { ...empty, revision: 0 },
    { ...empty, revision: 2 },
    { ...empty, unknown: true },
    { ...empty, pendingDeliveries: [{ operationNonce: binding }] },
  ])
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(`${encodeCoordinatorStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.from(`${JSON.stringify(empty)}\n`),
      binding,
    ),
    null,
  );
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.from(text.replace('"revision":1', '"revision":1,"revision":1')),
      binding,
    ),
    null,
  );
  assert.equal(
    decodeCoordinatorStateSnapshot(Buffer.from([0xff]), binding),
    null,
  );
  assert.equal(
    decodeCoordinatorStateSnapshot(Buffer.from(text), "wrong"),
    null,
  );
});

/**
 * getterやProxyを実行せず不正JSON値を拒否する。
 * @responsibility 現在状態codecの構造相関を検証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成入力だけを使う。
 * @stimulus 正常値と契約を破る値を復号する。
 * @observation 復号結果と不変性を確認する。
 * @oracle 正常値だけを受理し、不正値はnullまたは例外になる。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 保存byte列と純粋codec。
 */
test("Snapshot: hostile値と配列順", () => {
  let isInvoked = false;
  const hostile = Object.defineProperty({}, "value", {
    get() {
      isInvoked = true;
      return 1;
    },
  });
  assert.throws(() => encodeCoordinatorStateValue(hostile));
  const proxy = new Proxy(
    {},
    {
      ownKeys() {
        isInvoked = true;
        return [];
      },
    },
  );
  assert.throws(() => encodeCoordinatorStateValue(proxy));
  assert.equal(isInvoked, false);
  const bytes = Buffer.from(`${encodeCoordinatorStateValue(empty)}\n`);
  const proxyBytes = new Proxy(bytes, {
    get() {
      isInvoked = true;
      throw new Error("trap");
    },
  });
  assert.equal(decodeCoordinatorStateSnapshot(proxyBytes, binding), null);
  Object.defineProperty(bytes, "length", {
    get() {
      isInvoked = true;
      throw new Error("getter");
    },
  });
  assert.ok(decodeCoordinatorStateSnapshot(bytes, binding));
  assert.equal(isInvoked, false);
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.concat([
        Buffer.from([0xef, 0xbb, 0xbf]),
        Buffer.from(`${encodeCoordinatorStateValue(empty)}\n`),
      ]),
      binding,
    ),
    null,
  );
  assert.equal(
    encodeCoordinatorStateValue({ z: [2, 1], a: 0 }),
    '{"a":0,"z":[2,1]}',
  );
  assert.throws(() => encodeCoordinatorStateValue(new Array(2)));
  assert.throws(() => encodeCoordinatorStateValue(Number.NaN));
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.throws(() => encodeCoordinatorStateValue(cycle));
});

/**
 * 操作のexact参照とHost証明本文、unknown観測を保持する。
 * @responsibility 現在状態codecの構造相関を検証する。
 * @trace PRL-UT-006
 * @precondition メモリ内の自己生成入力だけを使う。
 * @stimulus 正常値と契約を破る値を復号する。
 * @observation 復号結果と不変性を確認する。
 * @oracle 正常値だけを受理し、不正値はnullまたは例外になる。
 * @cleanup N/A: 外部資源を作らない。
 * @boundary PRL-UT-006=Direct Boundary: 保存byte列と純粋codec。
 */
test("Snapshot: 固定Identity、資源とHost証明の相関", () => {
  const nonce = "b".repeat(64);
  const hostRecord = {
    schema: "crdd-coordinator-host-recovery/v1",
    state: "host_only",
    rootName: "crdd-coordinator-doctor-fixture",
    rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
    childIdentities: {
      management: {
        pathName: "management",
        dev: "1",
        ino: "3",
        birthtimeNs: "4",
      },
    },
    createdAt: "2026-08-25T00:00:00.000Z",
  };
  const hostHash = createHash("sha256")
    .update(`${JSON.stringify(hostRecord)}\n`)
    .digest("hex");
  const token =
    "host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc." +
    hostHash;
  const identity = {
    schema: "crdd-coordinator/operation-identity/v1",
    operationNonce: nonce,
    provider: "claude",
    consumer: "orchestrator",
    operationId: "OP-123456",
    recoveryCorrelationId: "task-operation-a",
    grantRef: "PHMGRANT-FIXTURE",
    profileId: "PROFILE-123456",
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    providerHomeProtectionHash: "9".repeat(64),
    localUserBindingHash: "6".repeat(64),
    repositoryBinding: binding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
    resources: {
      auth: "crdd-auth-0123456789abcdef",
      provider: "crdd-claude-0123456789abcdef",
      proxy: "crdd-proxy-0123456789abcdef",
      internal: "crdd-internal-0123456789abcdef",
      egress: "crdd-egress-0123456789abcdef",
    },
    images: {
      provider: `sha256:${"a".repeat(64)}`,
      proxy: `sha256:${"b".repeat(64)}`,
    },
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
    initialHostRecoveryId: token,
    initialHostRecovery: {
      token,
      recordHash: hostHash,
      directoryIdentity: "1:2:3",
      markerIdentity: "1:2:4",
      record: hostRecord,
    },
    hostPaths: { root: "host-root", marker: "host-marker" },
  };
  const identityJson = `${JSON.stringify(identity)}\n`;
  const identitySha256 = createHash("sha256")
    .update(identityJson)
    .digest("hex");
  const recoveryId =
    "docker-task." +
    identity.stableLogicalHomeBindingHash +
    "." +
    nonce +
    "." +
    identitySha256;
  const successor = { ...hostRecord, state: "docker_submission_started" };
  const expectedToken =
    token.slice(0, -64) +
    createHash("sha256")
      .update(`${JSON.stringify(successor)}\n`)
      .digest("hex");
  const transition = {
    currentToken: token,
    expectedToken,
    rootName: hostRecord.rootName,
    nonce: "12345678-1234-4234-8234-123456789abc",
    currentState: "host_only",
    nextState: "docker_submission_started",
    recordBefore: hostRecord,
  };
  const operation = {
    identityJson,
    identitySha256,
    recoveryId,
    phase: "settling",
    resources: [
      "create_egress_network",
      "create_internal_network",
      "create_provider",
      "create_proxy",
      "create_subscription_auth_probe",
    ].map((purpose) => ({
      purpose,
      request: purpose === "create_provider" ? "identified" : "not_requested",
      dockerId: purpose === "create_provider" ? "d".repeat(64) : null,
      receiptSource:
        purpose === "create_provider" ? "docker_create_result" : null,
      observation: "unknown",
      absence: null,
    })),
    host: {
      currentToken: token,
      pendingTransitionJson: `${JSON.stringify(transition)}\n`,
      cleanup: "unknown",
    },
    lease: "unknown",
    execution: {
      providerStart: "unknown",
      externalSend: "unknown",
      sharedWrite: "unknown",
      ownerEffect: "unknown",
      workspaceReusable: false,
    },
    primaryFailure: null,
    outcome: null,
    summarySha256: null,
    history: null,
  };
  const snapshot = { ...empty, operations: [operation] };
  const historyState = {
    ...snapshot,
    operations: [
      {
        ...operation,
        outcome: {
          status: "completed",
          reason: "provider_operation_completed",
          cleanupConfirmed: false,
        },
      },
    ],
  };
  const historyBytes = Buffer.from(
    `${encodeCoordinatorStateValue(historyState)}\n`,
  );
  const history = prepareCoordinatorStateHistorySummary(
    historyBytes,
    recoveryId,
    binding,
  );
  assert.ok(history);
  const summary = JSON.parse(history.summaryBytes.toString("utf8"));
  assert.equal(summary.operationId, identity.operationId);
  assert.equal(summary.hostCleanup, "unknown");
  assert.equal(summary.lease, "unknown");
  assert.equal(summary.outcome.cleanupConfirmed, false);
  assert.equal(summary.primaryFailure, null);
  assert.equal("hostPaths" in summary, false);
  assert.equal("identityJson" in summary, false);
  assert.equal(
    history.sourcePayloadSha256,
    coordinatorStateContentHash(historyState),
  );
  assert.equal(
    history.summarySha256,
    createHash("sha256").update(history.summaryBytes).digest("hex"),
  );
  assert.equal(
    prepareCoordinatorStateHistorySummary(historyBytes, recoveryId, "wrong"),
    null,
  );
  assert.equal(
    prepareCoordinatorStateHistorySummary(
      historyBytes,
      `${recoveryId}x`,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateHistorySummary(
      Buffer.from(`${encodeCoordinatorStateValue(snapshot)}\n`),
      recoveryId,
      binding,
    ),
    null,
  );
  for (const changed of [
    { ...historyState.operations[0], phase: "executing" },
    { ...historyState.operations[0], summarySha256: "e".repeat(64) },
  ])
    assert.equal(
      prepareCoordinatorStateHistorySummary(
        Buffer.from(
          `${encodeCoordinatorStateValue({ ...historyState, operations: [changed] })}\n`,
        ),
        recoveryId,
        binding,
      ),
      null,
    );
  const fixedSummary = prepareCoordinatorStateHistorySummary(
    Buffer.from(
      `${encodeCoordinatorStateValue({ ...historyState, operations: [{ ...historyState.operations[0], summarySha256: history.summarySha256 }] })}\n`,
    ),
    recoveryId,
    binding,
  );
  assert.equal(fixedSummary, null);
  const readyHistoryState = {
    ...historyState,
    operations: [
      {
        ...operation,
        resources: operation.resources.map((item) => ({
          ...item,
          request: "not_requested",
          dockerId: null,
          receiptSource: null,
          observation: "unobserved",
          absence: null,
        })),
        host: {
          ...operation.host,
          pendingTransitionJson: null,
          cleanup: "confirmed",
        },
        lease: "released",
        execution: { ...operation.execution, ownerEffect: "disabled" },
        outcome: {
          ...historyState.operations[0]?.outcome,
          cleanupConfirmed: true,
        },
      },
    ],
  };
  const readyHistoryBytes = Buffer.from(
    `${encodeCoordinatorStateValue(readyHistoryState)}\n`,
  );
  const occurredAt = "2026-10-08T00:00:00.000Z";
  assert.equal(
    prepareCoordinatorStateHistorySnapshot(
      historyBytes,
      recoveryId,
      occurredAt,
      false,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateHistorySnapshot(
      readyHistoryBytes,
      recoveryId,
      occurredAt,
      true,
      binding,
    ),
    null,
  );
  const pendingHistoryBytes = prepareCoordinatorStateHistorySnapshot(
    readyHistoryBytes,
    recoveryId,
    occurredAt,
    false,
    binding,
  );
  assert.ok(pendingHistoryBytes);
  const pendingHistory = decodeCoordinatorStateSnapshot(
    pendingHistoryBytes,
    binding,
  );
  assert.ok(pendingHistory);
  const pendingOperation = pendingHistory.snapshot.operations[0];
  assert.ok(pendingOperation?.history);
  assert.equal(pendingOperation.history.occurredAt, occurredAt);
  assert.equal(pendingOperation.history.confirmed, false);
  const confirmedHistoryBytes = prepareCoordinatorStateHistorySnapshot(
    pendingHistoryBytes,
    recoveryId,
    occurredAt,
    true,
    binding,
  );
  assert.ok(confirmedHistoryBytes);
  const confirmedHistory = decodeCoordinatorStateSnapshot(
    confirmedHistoryBytes,
    binding,
  );
  assert.ok(confirmedHistory);
  // 結果IDは履歴確認・改訂から独立し、再登録で既存受理を巻き戻さない。
  const registeredPending = prepareCoordinatorStateResultDeliverySnapshot(
    pendingHistoryBytes,
    recoveryId,
    ["orchestrator"],
    binding,
  );
  const registeredConfirmed = prepareCoordinatorStateResultDeliverySnapshot(
    confirmedHistoryBytes,
    recoveryId,
    ["orchestrator"],
    binding,
  );
  assert.ok(registeredPending);
  assert.ok(registeredConfirmed);
  for (const consumer of ["coordinator_cli", "workbench"]) {
    const transientIdentity = { ...identity, consumer };
    const transientJson = `${JSON.stringify(transientIdentity)}\n`;
    const transientHash = createHash("sha256")
      .update(transientJson)
      .digest("hex");
    const transientRecoveryId = `docker-task.${identity.stableLogicalHomeBindingHash}.${nonce}.${transientHash}`;
    const transientState = JSON.parse(readyHistoryBytes.toString("utf8"));
    transientState.operations[0].identityJson = transientJson;
    transientState.operations[0].identitySha256 = transientHash;
    transientState.operations[0].recoveryId = transientRecoveryId;
    transientState.operations[0].summarySha256 = null;
    transientState.operations[0].history = null;
    transientState.operations[0].execution = {
      ...transientState.operations[0].execution,
      providerStart: "not_started",
      externalSend: "not_issued",
      sharedWrite: "not_issued",
    };
    transientState.pendingDeliveries = [];
    transientState.unresolvedRecoveries = [];
    const transientUnfixed = Buffer.from(
      `${encodeCoordinatorStateValue(transientState)}\n`,
    );
    const transientSummary = prepareCoordinatorStateHistorySummary(
      transientUnfixed,
      transientRecoveryId,
      binding,
    );
    assert.ok(transientSummary);
    const transientFixed = prepareCoordinatorStateHistorySnapshot(
      transientUnfixed,
      transientRecoveryId,
      occurredAt,
      false,
      binding,
    );
    assert.ok(transientFixed);
    assert.deepEqual(
      prepareCoordinatorStateResultDeliverySnapshot(
        transientFixed,
        transientRecoveryId,
        [],
        binding,
      ),
      transientFixed,
    );
    assert.equal(
      prepareCoordinatorStateResultDeliverySnapshot(
        transientFixed,
        transientRecoveryId,
        ["orchestrator"],
        binding,
      ),
      null,
    );
    const transientCompletionReady = prepareCoordinatorStateHistorySnapshot(
      transientFixed,
      transientRecoveryId,
      occurredAt,
      true,
      binding,
    );
    assert.ok(transientCompletionReady);
    const transientCompleted = prepareCoordinatorStateCompletionSnapshot(
      transientCompletionReady,
      transientRecoveryId,
      binding,
    );
    assert.ok(transientCompleted);
    const transientCompletedSnapshot = decodeCoordinatorStateSnapshot(
      transientCompleted,
      binding,
    );
    assert.ok(transientCompletedSnapshot);
    assert.equal(transientCompletedSnapshot.snapshot.operations.length, 0);
    assert.equal(
      transientCompletedSnapshot.snapshot.pendingDeliveries.length,
      0,
    );
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(
        transientFixed,
        transientRecoveryId,
        binding,
      ),
      null,
    );
    for (const effect of ["providerStart", "externalSend", "sharedWrite"]) {
      const unknownBeforeFixed = JSON.parse(transientUnfixed.toString("utf8"));
      unknownBeforeFixed.operations[0].execution[effect] = "unknown";
      const unknownBytes = Buffer.from(
        `${encodeCoordinatorStateValue(unknownBeforeFixed)}\n`,
      );
      const unknownFixed = prepareCoordinatorStateHistorySnapshot(
        unknownBytes,
        transientRecoveryId,
        occurredAt,
        false,
        binding,
      );
      assert.ok(unknownFixed);
      const unknownConfirmed = prepareCoordinatorStateHistorySnapshot(
        unknownFixed,
        transientRecoveryId,
        occurredAt,
        true,
        binding,
      );
      assert.ok(unknownConfirmed);
      const unknownLine = prepareCoordinatorStateHistoryLine(
        unknownConfirmed,
        transientRecoveryId,
        binding,
      );
      assert.ok(unknownLine);
      const recorded = JSON.parse(unknownLine.toString("utf8"));
      assert.equal(recorded.summary.execution[effect], "unknown");
      assert.deepEqual(
        recorded.summary.outcome,
        unknownBeforeFixed.operations[0].outcome,
      );
      assert.deepEqual(
        recorded.summary.primaryFailure,
        unknownBeforeFixed.operations[0].primaryFailure,
      );
      assert.ok(decodeCoordinatorHistoryRows(unknownLine));
      assert.ok(
        prepareCoordinatorStateCompletionSnapshot(
          unknownConfirmed,
          transientRecoveryId,
          binding,
        ),
      );
      const oldRow = { ...recorded, schema: "crdd-coordinator/history-row/v1" };
      assert.equal(
        decodeCoordinatorHistoryRows(
          Buffer.from(`${encodeCoordinatorStateValue(oldRow)}\n`),
        ),
        null,
      );
      const unknownEffect = JSON.parse(
        transientCompletionReady.toString("utf8"),
      );
      unknownEffect.operations[0].execution[effect] = "unknown";
      assert.equal(
        prepareCoordinatorStateCompletionSnapshot(
          Buffer.from(`${encodeCoordinatorStateValue(unknownEffect)}\n`),
          transientRecoveryId,
          binding,
        ),
        null,
      );
    }
    const injectedPending = {
      ...JSON.parse(transientFixed.toString("utf8")),
      pendingDeliveries: [
        {
          operationNonce: nonce,
          recoveryId: transientRecoveryId,
          resultId: transientSummary.summarySha256,
          consumer: "orchestrator",
          acceptanceSha256: null,
        },
      ],
    };
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(`${encodeCoordinatorStateValue(injectedPending)}\n`),
        binding,
      ),
      null,
    );
  }
  const pendingResult = decodeCoordinatorStateSnapshot(
    registeredPending,
    binding,
  );
  const confirmedResult = decodeCoordinatorStateSnapshot(
    registeredConfirmed,
    binding,
  );
  assert.ok(pendingResult);
  assert.ok(confirmedResult);
  assert.deepEqual(
    pendingResult.snapshot.pendingDeliveries,
    confirmedResult.snapshot.pendingDeliveries,
  );
  assert.equal(
    confirmedResult.snapshot.pendingDeliveries[0]?.resultId,
    confirmedHistory.snapshot.operations[0]?.summarySha256,
  );
  const acknowledgement = {
    repositoryBindingId: "repository-a",
    projectId: "project-a",
    milestoneId: "milestone-a",
    taskId: "task-a",
    attemptId: "attempt-a",
    operationId: identity.recoveryCorrelationId,
    recoveryId,
    settlementGeneration: 7,
    repositoryBinding: binding,
    resultId: confirmedHistory.snapshot.operations[0]?.summarySha256,
    consumer: "orchestrator",
  };
  const projectAccepted = prepareCoordinatorStateProjectAcceptanceSnapshot(
    registeredConfirmed,
    acknowledgement,
    binding,
  );
  assert.ok(projectAccepted);
  const projectAcceptedState = decodeCoordinatorStateSnapshot(
    projectAccepted,
    binding,
  );
  assert.ok(projectAcceptedState);
  assert.deepEqual(
    projectAcceptedState.snapshot.operations,
    confirmedResult.snapshot.operations,
  );
  assert.deepEqual(
    projectAcceptedState.snapshot.unresolvedRecoveries,
    confirmedResult.snapshot.unresolvedRecoveries,
  );
  assert.equal(
    projectAcceptedState.snapshot.pendingDeliveries.find(
      (item) => item.consumer === "orchestrator",
    )?.acceptanceSha256,
    createHash("sha256")
      .update(`${encodeCoordinatorStateValue(acknowledgement)}\n`)
      .digest("hex"),
  );
  assert.equal(projectAcceptedState.snapshot.pendingDeliveries.length, 1);
  assert.deepEqual(
    prepareCoordinatorStateProjectAcceptanceSnapshot(
      projectAccepted,
      { ...acknowledgement },
      binding,
    ),
    projectAccepted,
  );
  for (const invalid of [
    { ...acknowledgement, consumer: "workbench" },
    { ...acknowledgement, repositoryBinding: "b".repeat(64) },
    { ...acknowledgement, operationId: "other-operation" },
    { ...acknowledgement, operationId: identity.operationId },
    { ...acknowledgement, recoveryId: "other-recovery" },
    { ...acknowledgement, resultId: "e".repeat(64) },
    { ...acknowledgement, settlementGeneration: 0 },
    { ...acknowledgement, settlementGeneration: 8 },
    { ...acknowledgement, taskId: "other-task" },
    { ...acknowledgement, attemptId: "other-attempt" },
    { ...acknowledgement, acceptanceSha256: "f".repeat(64) },
    { ...acknowledgement, receiptContentHash: "f".repeat(64) },
    { ...acknowledgement, occurredAt: "2026-10-08T00:00:00.000Z" },
  ])
    assert.equal(
      prepareCoordinatorStateProjectAcceptanceSnapshot(
        projectAccepted,
        invalid,
        binding,
      ),
      null,
    );
  assert.equal(
    prepareCoordinatorStateProjectAcceptanceSnapshot(
      confirmedHistoryBytes,
      acknowledgement,
      binding,
    ),
    null,
  );
  for (const key of Object.keys(acknowledgement)) {
    const missing = { ...acknowledgement } as Record<string, unknown>;
    delete missing[key];
    assert.equal(
      prepareCoordinatorStateProjectAcceptanceSnapshot(
        registeredConfirmed,
        missing,
        binding,
      ),
      null,
    );
  }
  let isGetterCalled = false;
  const getterAcknowledgement = { ...acknowledgement };
  Object.defineProperty(getterAcknowledgement, "taskId", {
    get() {
      isGetterCalled = true;
      return "task-a";
    },
  });
  assert.equal(
    prepareCoordinatorStateProjectAcceptanceSnapshot(
      registeredConfirmed,
      getterAcknowledgement,
      binding,
    ),
    null,
  );
  assert.equal(isGetterCalled, false);
  assert.equal(
    prepareCoordinatorStateProjectAcceptanceSnapshot(
      registeredConfirmed,
      new Proxy(acknowledgement, {}),
      binding,
    ),
    null,
  );
  const acceptedResultBytes = prepareCoordinatorStateReferencesSnapshot(
    registeredConfirmed,
    recoveryId,
    {
      recovery: null,
      deliveries: confirmedResult.snapshot.pendingDeliveries.map(
        (delivery) => ({
          ...delivery,
          acceptanceSha256: "f".repeat(64),
        }),
      ),
    },
    binding,
  );
  assert.ok(acceptedResultBytes);
  assert.deepEqual(
    prepareCoordinatorStateResultDeliverySnapshot(
      acceptedResultBytes,
      recoveryId,
      ["orchestrator"],
      binding,
    ),
    acceptedResultBytes,
  );
  for (const invalidConsumers of [
    [],
    ["orchestrator", "workbench"],
    ["workbench", "workbench"],
    ["unknown"],
    ["coordinator_cli"],
  ])
    assert.equal(
      prepareCoordinatorStateResultDeliverySnapshot(
        acceptedResultBytes,
        recoveryId,
        invalidConsumers,
        binding,
      ),
      null,
    );
  assert.equal(
    prepareCoordinatorStateResultDeliverySnapshot(
      readyHistoryBytes,
      recoveryId,
      ["orchestrator"],
      binding,
    ),
    null,
  );
  const knownBeforeFixed = JSON.parse(readyHistoryBytes.toString("utf8"));
  knownBeforeFixed.operations[0].execution = {
    ...knownBeforeFixed.operations[0].execution,
    providerStart: "not_started",
    externalSend: "not_issued",
    sharedWrite: "not_issued",
  };
  const knownFixed = prepareCoordinatorStateHistorySnapshot(
    Buffer.from(`${encodeCoordinatorStateValue(knownBeforeFixed)}\n`),
    recoveryId,
    occurredAt,
    false,
    binding,
  );
  assert.ok(knownFixed);
  const knownConfirmed = prepareCoordinatorStateHistorySnapshot(
    knownFixed,
    recoveryId,
    occurredAt,
    true,
    binding,
  );
  assert.ok(knownConfirmed);
  const knownHistory = decodeCoordinatorStateSnapshot(knownConfirmed, binding);
  assert.ok(knownHistory);
  const acceptedCompletionState = {
    ...knownHistory.snapshot,
    operations: knownHistory.snapshot.operations.map((value) => ({
      ...value,
      execution: {
        ...value.execution,
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
      },
    })),
    unresolvedRecoveries: [
      {
        operationNonce: nonce,
        recoveryId,
        reason: "provider_operation_completed",
        obligations: [
          "docker_resources",
          "host_cleanup",
          "lease_release",
          "result_delivery",
        ],
      },
    ],
    pendingDeliveries: ["orchestrator"].map((consumer) => ({
      operationNonce: nonce,
      recoveryId,
      resultId: knownHistory.snapshot.operations[0]?.summarySha256,
      consumer,
      acceptanceSha256: "f".repeat(64),
    })),
  };
  const acceptedCompletionBytes = Buffer.from(
    `${encodeCoordinatorStateValue(acceptedCompletionState)}\n`,
  );
  const sameHomeNextIdentity = `${JSON.stringify({
    ...identity,
    operationNonce: "0".repeat(64),
    operationId: "OP-654321",
  })}\n`;
  const deliveryOnlyState = {
    ...acceptedCompletionState,
    unresolvedRecoveries: acceptedCompletionState.unresolvedRecoveries.map(
      (value) => ({ ...value, obligations: ["result_delivery"] }),
    ),
    pendingDeliveries: acceptedCompletionState.pendingDeliveries.map(
      (value) => ({ ...value, acceptanceSha256: null }),
    ),
  };
  const deliveryOnlyBytes = Buffer.from(
    `${encodeCoordinatorStateValue(deliveryOnlyState)}\n`,
  );
  const sameHomeStarted = prepareCoordinatorStateOperationSnapshot(
    deliveryOnlyBytes,
    sameHomeNextIdentity,
    binding,
  );
  assert.ok(
    sameHomeStarted,
    "資源終端後の耐久ACK待ちだけでは同Home開始を妨げない",
  );
  const sameHomeStartedState = JSON.parse(sameHomeStarted.toString("utf8"));
  sameHomeStartedState.unresolvedRecoveries[0].obligations = [
    "docker_resources",
    "result_delivery",
  ];
  assert.equal(
    validateCoordinatorStateTransition(
      deliveryOnlyBytes,
      Buffer.from(`${encodeCoordinatorStateValue(sameHomeStartedState)}\n`),
      binding,
    ),
    false,
    "新操作追加と同時に旧操作へ資源義務を戻す候補を拒否する",
  );
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(
      acceptedCompletionBytes,
      sameHomeNextIdentity,
      binding,
    ),
    null,
    "資源回復義務が残る間は開始しない",
  );
  for (const invalidDeliveries of [
    [],
    acceptedCompletionState.pendingDeliveries.map((delivery) => ({
      ...delivery,
      resultId: "e".repeat(64),
    })),
    acceptedCompletionState.pendingDeliveries.map((delivery) => ({
      ...delivery,
      consumer: "workbench",
    })),
  ]) {
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(
        Buffer.from(
          `${encodeCoordinatorStateValue({ ...acceptedCompletionState, pendingDeliveries: invalidDeliveries })}\n`,
        ),
        recoveryId,
        binding,
      ),
      null,
    );
  }
  const completedBytes = prepareCoordinatorStateCompletionSnapshot(
    acceptedCompletionBytes,
    recoveryId,
    binding,
  );
  assert.ok(completedBytes);
  const completed = decodeCoordinatorStateSnapshot(completedBytes, binding);
  assert.ok(completed);
  assert.equal(
    completed.snapshot.revision,
    acceptedCompletionState.revision + 1,
  );
  assert.deepEqual(completed.snapshot.previous, {
    revision: acceptedCompletionState.revision,
    payloadSha256: createHash("sha256")
      .update(acceptedCompletionBytes)
      .digest("hex"),
  });
  assert.equal(completed.snapshot.operations.length, 0);
  assert.equal(completed.snapshot.unresolvedRecoveries.length, 0);
  assert.equal(completed.snapshot.pendingDeliveries.length, 0);
  assert.equal(
    validateCoordinatorStateTransition(
      acceptedCompletionBytes,
      completedBytes,
      binding,
    ),
    false,
  );
  assert.equal(
    prepareCoordinatorStateCompletionSnapshot(
      pendingHistoryBytes,
      recoveryId,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateCompletionSnapshot(
      acceptedCompletionBytes,
      "other",
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateCompletionSnapshot(
      acceptedCompletionBytes,
      recoveryId,
      "wrong",
    ),
    null,
  );
  for (const change of [
    { phase: "executing" },
    { lease: "unknown" },
    {
      host: {
        ...acceptedCompletionState.operations[0]?.host,
        cleanup: "unknown",
      },
    },
    {
      execution: {
        ...acceptedCompletionState.operations[0]?.execution,
        ownerEffect: "active",
      },
    },
    {
      execution: {
        ...acceptedCompletionState.operations[0]?.execution,
        externalSend: "unknown",
      },
    },
    {
      outcome: {
        ...acceptedCompletionState.operations[0]?.outcome,
        cleanupConfirmed: false,
      },
    },
  ]) {
    const input = Buffer.from(
      `${encodeCoordinatorStateValue({ ...acceptedCompletionState, operations: acceptedCompletionState.operations.map((value) => ({ ...value, ...change })) })}\n`,
    );
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(input, recoveryId, binding),
      null,
    );
  }
  const unaccepted = Buffer.from(
    `${encodeCoordinatorStateValue({ ...acceptedCompletionState, pendingDeliveries: acceptedCompletionState.pendingDeliveries.map((value) => ({ ...value, acceptanceSha256: null })) })}\n`,
  );
  assert.equal(
    prepareCoordinatorStateCompletionSnapshot(unaccepted, recoveryId, binding),
    null,
  );
  for (const consumer of ["orchestrator"]) {
    const missingAcceptance = Buffer.from(
      `${encodeCoordinatorStateValue({ ...acceptedCompletionState, pendingDeliveries: acceptedCompletionState.pendingDeliveries.map((value) => ({ ...value, acceptanceSha256: value.consumer === consumer ? null : value.acceptanceSha256 })) })}\n`,
    );
    assert.equal(
      prepareCoordinatorStateCompletionSnapshot(
        missingAcceptance,
        recoveryId,
        binding,
      ),
      null,
    );
  }
  assert.equal(
    confirmedHistory.snapshot.operations[0]?.history?.lineSha256,
    pendingOperation.history.lineSha256,
  );
  assert.equal(
    confirmedHistory.snapshot.operations[0]?.summarySha256,
    pendingOperation.summarySha256,
  );
  assert.equal(
    confirmedHistory.snapshot.operations[0]?.history?.confirmed,
    true,
  );
  const historyLine = prepareCoordinatorStateHistoryLine(
    pendingHistoryBytes,
    recoveryId,
    binding,
  );
  assert.ok(historyLine);
  const rows = decodeCoordinatorHistoryRows(historyLine);
  assert.ok(rows);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.recoveryId, recoveryId);
  assert.equal(rows[0]?.lineSha256, pendingOperation.history.lineSha256);
  assert.equal(rows[0]?.summarySha256, pendingOperation.summarySha256);
  assert.deepEqual(decodeCoordinatorHistoryRows(Buffer.alloc(0)), []);
  /**
   * 固定Repository結合で履歴保持候補を評価する。
   * @responsibility 期間と未確認相関の反例を同じモデル入口へ渡す。
   * @trace PRL-UT-006
   * @input bytes: Snapshot、history: 履歴、now: 判定時刻、days: 保持日数。
   * @returns 履歴候補またはnull。
   * @precondition Fixtureは各assertionで固定する。
   * @postcondition 入力本文を変更しない。
   * @effect N/A: メモリ内の評価だけ。
   * @failure 不正値はモデルのnullを返す。
   * @invariant 保存I/Oの成功を主張しない。
   * @boundary PRL-UT-006=履歴保持の値契約。
   * @security N/A: 固定非秘密Fixtureだけを利用する。
   * @concurrency N/A: 同期評価だけ。
   */
  const retain = (
    bytes: Buffer,
    history: Buffer,
    now: unknown,
    days: unknown,
  ) => prepareCoordinatorHistoryRetention(bytes, history, now, days, binding);
  const exactCutoff = new Date(
    Date.parse(occurredAt) + 30 * 86400000,
  ).toISOString();
  const afterCutoff = new Date(Date.parse(exactCutoff) + 1).toISOString();
  assert.deepEqual(
    retain(confirmedHistoryBytes, historyLine, exactCutoff, 30),
    historyLine,
  );
  assert.deepEqual(
    retain(confirmedHistoryBytes, historyLine, afterCutoff, 30),
    Buffer.alloc(0),
  );
  assert.deepEqual(
    retain(pendingHistoryBytes, historyLine, afterCutoff, 30),
    historyLine,
  );
  assert.deepEqual(
    retain(confirmedHistoryBytes, Buffer.alloc(0), afterCutoff, 30),
    Buffer.alloc(0),
  );
  assert.equal(
    retain(pendingHistoryBytes, Buffer.alloc(0), afterCutoff, 30),
    null,
  );
  assert.deepEqual(
    retain(confirmedHistoryBytes, historyLine, afterCutoff, 31),
    historyLine,
  );
  for (const days of [0, -1, 1.5, NaN, Infinity, 104249992, "30"])
    assert.equal(
      retain(confirmedHistoryBytes, historyLine, afterCutoff, days),
      null,
    );
  assert.equal(retain(confirmedHistoryBytes, historyLine, "invalid", 30), null);
  const row = JSON.parse(historyLine.toString("utf8"));
  for (const malformed of [
    historyLine.subarray(0, -1),
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), historyLine]),
    Buffer.from([0xff, 0x0a]),
    Buffer.concat([historyLine, historyLine]),
    Buffer.from(historyLine.toString("utf8").replace(/\n$/u, "\r\n")),
    Buffer.from(` ${historyLine.toString("utf8")}`),
    Buffer.from(`${encodeCoordinatorStateValue({ ...row, extra: true })}\n`),
    Buffer.from(
      `${encodeCoordinatorStateValue({ ...row, occurredAt: "invalid" })}\n`,
    ),
    Buffer.from(
      `${encodeCoordinatorStateValue({ ...row, summary: { ...row.summary, operationNonce: "0".repeat(64) } })}\n`,
    ),
    Buffer.from(
      `${encodeCoordinatorStateValue({ ...row, summary: { ...row.summary, outcome: { ...row.summary.outcome, cleanupConfirmed: false } } })}\n`,
    ),
    Buffer.from(
      `${encodeCoordinatorStateValue({ ...row, summary: { ...row.summary, primaryFailure: { stage: "unknown" } } })}\n`,
    ),
  ]) {
    assert.equal(decodeCoordinatorHistoryRows(malformed), null);
    assert.equal(
      retain(confirmedHistoryBytes, malformed, afterCutoff, 30),
      null,
    );
  }
  const differentLine = Buffer.from(
    `${encodeCoordinatorStateValue({ ...row, occurredAt: afterCutoff })}\n`,
  );
  assert.ok(decodeCoordinatorHistoryRows(differentLine));
  assert.equal(
    retain(pendingHistoryBytes, differentLine, afterCutoff, 30),
    null,
  );
  assert.equal(
    retain(confirmedHistoryBytes, differentLine, afterCutoff, 30),
    null,
  );
  assert.equal(
    createHash("sha256").update(historyLine).digest("hex"),
    pendingOperation.history.lineSha256,
  );
  assert.deepEqual(
    prepareCoordinatorStateHistoryLine(
      confirmedHistoryBytes,
      recoveryId,
      binding,
    ),
    historyLine,
  );
  for (const [bytes, id, root] of [
    [historyBytes, recoveryId, binding],
    [pendingHistoryBytes, "other-recovery", binding],
    [pendingHistoryBytes, recoveryId, "wrong-root"],
  ]) {
    assert.equal(prepareCoordinatorStateHistoryLine(bytes, id, root), null);
  }
  for (const [date, confirmed] of [
    ["2026-10-09T00:00:00.000Z", true],
    [occurredAt, false],
    ["2026-10-08", true],
    ["invalid", true],
  ] as const)
    assert.equal(
      prepareCoordinatorStateHistorySnapshot(
        confirmedHistoryBytes,
        recoveryId,
        date,
        confirmed,
        binding,
      ),
      null,
    );
  for (const changed of [
    { ...pendingOperation, history: null },
    { ...pendingOperation, summarySha256: null },
    {
      ...pendingOperation,
      history: { ...pendingOperation.history, lineSha256: "f".repeat(64) },
    },
    {
      ...pendingOperation,
      history: { ...pendingOperation.history, confirmed: "true" },
    },
    {
      ...pendingOperation,
      history: { ...pendingOperation.history, extra: true },
    },
  ])
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(
          `${encodeCoordinatorStateValue({ ...pendingHistory.snapshot, operations: [changed] })}\n`,
        ),
        binding,
      ),
      null,
    );
  const primaryFailure = {
    purpose: "create_provider",
    stage: "command_wait",
    reason: "provider_result_invalid",
    exceptionCode: null,
    commandHandleObtained: true,
    responseObserved: true,
    receiptRecorded: false,
  };
  const failedSummary = prepareCoordinatorStateHistorySummary(
    Buffer.from(
      `${encodeCoordinatorStateValue({
        ...historyState,
        operations: [{ ...historyState.operations[0], primaryFailure }],
      })}\n`,
    ),
    recoveryId,
    binding,
  );
  assert.ok(failedSummary);
  assert.deepEqual(
    JSON.parse(failedSummary.summaryBytes.toString("utf8")).primaryFailure,
    primaryFailure,
  );
  assert.notEqual(failedSummary.summarySha256, history.summarySha256);
  assert.deepEqual(
    historyBytes,
    Buffer.from(`${encodeCoordinatorStateValue(historyState)}\n`),
  );
  const prepared = prepareCoordinatorStateOperationSnapshot(
    null,
    identityJson,
    binding,
  );
  assert.ok(prepared);
  for (const invalidIdentity of [
    { ...identity, consumer: undefined },
    { ...identity, consumer: "durable" },
    { ...identity, consumer: { consumer: "orchestrator" } },
    { ...identity, completionPolicy: "transient" },
    { ...identity, schema: "crdd-coordinator-task-docker-recovery/v1" },
    { ...identity, repositoryBinding: "f".repeat(64) },
    { ...identity, runtimeStateBinding: {} },
    { ...identity, repositoryBinding: undefined },
    { ...identity, providerHomeIdentityHash: "invalid" },
    { ...identity, initialHostRecoveryId: "invalid" },
    { ...identity, resources: { ...identity.resources, auth: "invalid" } },
  ]) {
    assert.equal(
      prepareCoordinatorStateOperationSnapshot(
        null,
        `${JSON.stringify(invalidIdentity)}\n`,
        binding,
      ),
      null,
    );
  }
  const preparedState = decodeCoordinatorStateSnapshot(prepared, binding);
  assert.ok(preparedState);
  for (const consumer of ["coordinator_cli", "orchestrator", "workbench"]) {
    const consumerIdentity = `${JSON.stringify({ ...identity, consumer })}\n`;
    const consumerSnapshot = prepareCoordinatorStateOperationSnapshot(
      null,
      consumerIdentity,
      binding,
    );
    assert.ok(consumerSnapshot);
    const consumerState = decodeCoordinatorStateSnapshot(
      consumerSnapshot,
      binding,
    );
    assert.ok(consumerState);
    const consumerOperation = consumerState.snapshot.operations[0];
    assert.ok(consumerOperation);
    assert.equal(JSON.parse(consumerOperation.identityJson).consumer, consumer);
    if (consumer !== identity.consumer) {
      const replacement = JSON.parse(consumerSnapshot.toString("utf8"));
      replacement.revision = preparedState.snapshot.revision + 1;
      replacement.previous = {
        revision: preparedState.snapshot.revision,
        payloadSha256: preparedState.payloadSha256,
      };
      assert.equal(
        validateCoordinatorStateTransition(
          prepared,
          Buffer.from(`${encodeCoordinatorStateValue(replacement)}\n`),
          binding,
        ),
        false,
      );
    }
  }
  const initialOperation = preparedState.snapshot.operations[0];
  assert.equal(initialOperation?.recoveryId, recoveryId);
  assert.equal(initialOperation?.phase, "executing");
  assert.equal(initialOperation?.lease, "held");
  assert.equal(initialOperation?.host.pendingTransitionJson, null);
  assert.ok(initialOperation);
  const hostIntent = {
    ...initialOperation.host,
    pendingTransitionJson: `${JSON.stringify(transition)}\n`,
  };
  const hostIntentBytes = prepareCoordinatorStateHostSnapshot(
    prepared,
    recoveryId,
    hostIntent,
    binding,
  );
  assert.ok(hostIntentBytes);
  const hostReceipt = {
    ...hostIntent,
    currentToken: expectedToken,
    pendingTransitionJson: null,
  };
  const hostReceiptBytes = prepareCoordinatorStateHostSnapshot(
    hostIntentBytes,
    recoveryId,
    hostReceipt,
    binding,
  );
  assert.ok(hostReceiptBytes);
  assert.equal(
    decodeCoordinatorStateSnapshot(hostReceiptBytes, binding)?.snapshot
      .operations[0]?.host.currentToken,
    expectedToken,
  );
  assert.deepEqual(
    decodeCoordinatorStateSnapshot(hostReceiptBytes, binding)?.snapshot
      .operations[0]?.resources,
    initialOperation.resources,
  );
  for (const [before, update] of [
    [prepared, hostReceipt],
    [hostIntentBytes, initialOperation.host],
    [hostReceiptBytes, initialOperation.host],
    [prepared, { ...hostIntent, extra: true }],
    [
      prepared,
      {
        ...hostIntent,
        pendingTransitionJson: `${encodeCoordinatorStateValue(transition)}\n`,
      },
    ],
  ]) {
    assert.equal(
      prepareCoordinatorStateHostSnapshot(before, recoveryId, update, binding),
      null,
    );
  }
  const resource = initialOperation?.resources.find(
    (item) => item.purpose === "create_provider",
  );
  assert.ok(resource);
  const intent = prepareCoordinatorStateResourceSnapshot(
    prepared,
    recoveryId,
    { ...resource, request: "intent_saved" },
    binding,
  );
  assert.ok(intent);
  const directReceipt = {
    ...resource,
    request: "identified",
    dockerId: "d".repeat(64),
    receiptSource: "docker_create_result",
    observation: "unobserved",
    absence: null,
  };
  assert.ok(
    prepareCoordinatorStateResourceSnapshot(
      intent,
      recoveryId,
      directReceipt,
      binding,
    ),
  );
  for (const [current, value] of [
    [prepared, directReceipt],
    [intent, { ...directReceipt, dockerId: null }],
    [intent, { ...directReceipt, dockerId: "invalid" }],
    [intent, { ...directReceipt, receiptSource: "runtime_reconciliation" }],
    [intent, { ...directReceipt, observation: "present" }],
    [intent, { ...directReceipt, observation: "unknown" }],
    [intent, { ...directReceipt, absence: {} }],
  ] as const) {
    assert.equal(
      prepareCoordinatorStateResourceSnapshot(
        current,
        recoveryId,
        value,
        binding,
      ),
      null,
    );
  }
  const notIssued = prepareCoordinatorStateResourceSnapshot(
    intent,
    recoveryId,
    { ...resource, request: "not_issued" },
    binding,
  );
  assert.ok(notIssued);
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      prepared,
      recoveryId,
      { ...resource, request: "not_issued" },
      binding,
    ),
    null,
  );
  for (const request of [
    "not_requested",
    "intent_saved",
    "issued",
    "unknown",
  ] as const) {
    assert.equal(
      prepareCoordinatorStateResourceSnapshot(
        notIssued,
        recoveryId,
        { ...resource, request },
        binding,
      ),
      null,
    );
  }
  const issued = prepareCoordinatorStateResourceSnapshot(
    intent,
    recoveryId,
    { ...resource, request: "issued" },
    binding,
  );
  assert.ok(issued);
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      issued,
      recoveryId,
      { ...resource, request: "not_issued" },
      binding,
    ),
    null,
  );
  const unknown = prepareCoordinatorStateResourceSnapshot(
    issued,
    recoveryId,
    { ...resource, request: "unknown", observation: "unknown" },
    binding,
  );
  assert.ok(unknown);
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      unknown,
      recoveryId,
      { ...resource, request: "not_issued" },
      binding,
    ),
    null,
  );
  const receipt = {
    ...resource,
    request: "identified",
    dockerId: "d".repeat(64),
    receiptSource: "docker_create_result",
    observation: "present",
  };
  const identified = prepareCoordinatorStateResourceSnapshot(
    unknown,
    recoveryId,
    receipt,
    binding,
  );
  assert.ok(identified);
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      identified,
      recoveryId,
      { ...resource, request: "not_issued" },
      binding,
    ),
    null,
  );
  const identifiedState = decodeCoordinatorStateSnapshot(identified, binding);
  assert.ok(identifiedState);
  const identifiedOperation = identifiedState.snapshot.operations[0];
  assert.ok(identifiedOperation);
  const cleanupObservations = identifiedOperation.resources.map((item) => ({
    purpose: item.purpose,
    plannedResourceName:
      identity.resources[
        (
          {
            create_egress_network: "egress",
            create_internal_network: "internal",
            create_provider: "provider",
            create_proxy: "proxy",
            create_subscription_auth_probe: "auth",
          } as const
        )[item.purpose]
      ],
    dockerId: item.dockerId,
    observation: item.request === "not_requested" ? "not_requested" : "absent",
  }));
  const cleanupBytes = prepareCoordinatorStateCleanupSnapshot(
    identified,
    recoveryId,
    cleanupObservations,
    binding,
  );
  assert.ok(cleanupBytes);
  const unissuedCleanup = prepareCoordinatorStateCleanupSnapshot(
    notIssued,
    recoveryId,
    cleanupObservations.map((item) => ({
      ...item,
      dockerId: null,
      observation: "not_requested",
    })),
    binding,
  );
  assert.ok(unissuedCleanup);
  assert.equal(
    decodeCoordinatorStateSnapshot(
      unissuedCleanup,
      binding,
    )?.snapshot.operations[0]?.resources.find(
      (item) => item.purpose === resource.purpose,
    )?.request,
    "not_issued",
  );
  for (const observation of ["absent", "unknown"] as const) {
    assert.equal(
      prepareCoordinatorStateCleanupSnapshot(
        notIssued,
        recoveryId,
        cleanupObservations.map(
          (item): Record<string, unknown> => ({
            ...item,
            dockerId: null,
            observation:
              item.purpose === resource.purpose ? observation : "not_requested",
          }),
        ),
        binding,
      ),
      null,
    );
  }
  const cleanupState = decodeCoordinatorStateSnapshot(cleanupBytes, binding);
  assert.ok(cleanupState);
  assert.equal(
    cleanupState.snapshot.revision,
    identifiedState.snapshot.revision + 1,
  );
  assert.equal(
    cleanupState.snapshot.operations[0]?.resources.find(
      (item) => item.purpose === "create_provider",
    )?.observation,
    "absent",
  );
  assert.deepEqual(
    cleanupState.snapshot.operations[0]?.host,
    identifiedState.snapshot.operations[0]?.host,
  );
  for (const invalidValues of [
    null,
    [],
    cleanupObservations.slice(1),
    [...cleanupObservations].reverse(),
    cleanupObservations.map(() => cleanupObservations[0]),
    [...cleanupObservations, cleanupObservations[0]],
    cleanupObservations.map((item) => ({ ...item, dockerId: "e".repeat(64) })),
    cleanupObservations.map((item) => ({
      ...item,
      plannedResourceName: "foreign",
    })),
    cleanupObservations.map((item) => ({
      ...item,
      observation: "not_requested",
    })),
  ]) {
    assert.equal(
      prepareCoordinatorStateCleanupSnapshot(
        identified,
        recoveryId,
        invalidValues,
        binding,
      ),
      null,
    );
  }
  assert.equal(
    prepareCoordinatorStateCleanupSnapshot(
      unknown,
      recoveryId,
      cleanupObservations,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateCleanupSnapshot(
      identified,
      `${recoveryId}0`,
      cleanupObservations,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareCoordinatorStateCleanupSnapshot(
      identified,
      recoveryId,
      cleanupObservations,
      "b".repeat(64),
    ),
    null,
  );
  let isCleanupGetterInvoked = false;
  const hostileCleanup = Object.defineProperty({}, "purpose", {
    enumerable: true,
    get: () => {
      isCleanupGetterInvoked = true;
      return "create_provider";
    },
  });
  assert.equal(
    prepareCoordinatorStateCleanupSnapshot(
      identified,
      recoveryId,
      [hostileCleanup, ...cleanupObservations.slice(1)],
      binding,
    ),
    null,
  );
  assert.equal(isCleanupGetterInvoked, false);
  assert.equal(
    identifiedState.snapshot.revision,
    preparedState.snapshot.revision + 4,
  );
  assert.equal(
    identifiedState.snapshot.operations[0]?.identityJson,
    identityJson,
  );
  assert.deepEqual(
    identifiedState.snapshot.operations[0]?.host,
    initialOperation?.host,
  );
  assert.deepEqual(
    identifiedState.snapshot.operations[0]?.resources.filter(
      (item) => item.purpose !== "create_provider",
    ),
    initialOperation?.resources.filter(
      (item) => item.purpose !== "create_provider",
    ),
  );
  for (const [before, ref, update, owner] of [
    [prepared, recoveryId, { ...resource, request: "issued" }, binding],
    [intent, recoveryId, receipt, binding],
    [unknown, recoveryId, resource, binding],
    [identified, recoveryId, { ...receipt, dockerId: "e".repeat(64) }, binding],
    [
      prepared,
      `${recoveryId}0`,
      { ...resource, request: "intent_saved" },
      binding,
    ],
    [
      prepared,
      recoveryId,
      { ...resource, request: "intent_saved", extra: true },
      binding,
    ],
    [prepared, recoveryId, { ...resource, purpose: "other" }, binding],
    [prepared, recoveryId, resource, "b".repeat(64)],
  ])
    assert.equal(
      prepareCoordinatorStateResourceSnapshot(before, ref, update, owner),
      null,
    );
  let isResourceGetterInvoked = false;
  const hostileResource = Object.defineProperty({}, "purpose", {
    enumerable: true,
    get: () => {
      isResourceGetterInvoked = true;
      return "create_provider";
    },
  });
  assert.equal(
    prepareCoordinatorStateResourceSnapshot(
      prepared,
      recoveryId,
      hostileResource,
      binding,
    ),
    null,
  );
  assert.equal(isResourceGetterInvoked, false);
  const secondIdentityJson = `${JSON.stringify({
    ...identity,
    operationNonce: "0".repeat(64),
    operationId: "OP-654321",
    stableLogicalHomeBindingHash: "e".repeat(64),
  })}\n`;
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(
      prepared,
      `${JSON.stringify({ ...identity, operationNonce: "0".repeat(64), operationId: "OP-654321" })}\n`,
      binding,
    ),
    null,
    "未終了の同Home操作を追加しない",
  );
  const twoOperations = prepareCoordinatorStateOperationSnapshot(
    prepared,
    secondIdentityJson,
    binding,
  );
  assert.ok(twoOperations);
  const twoState = decodeCoordinatorStateSnapshot(twoOperations, binding);
  assert.ok(twoState);
  assert.equal(twoState.snapshot.operations.length, 2);
  assert.equal(
    twoState.snapshot.operations[0]?.identityJson,
    secondIdentityJson,
  );
  assert.deepEqual(twoState.snapshot.operations[1], initialOperation);
  assert.deepEqual(twoState.snapshot.previous, {
    revision: 1,
    payloadSha256: preparedState.payloadSha256,
  });
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(
      prepared,
      secondIdentityJson,
      "f".repeat(64),
    ),
    null,
  );
  assert.ok(
    initialOperation?.resources.every(
      (resource) =>
        resource.request === "not_requested" &&
        resource.observation === "unobserved",
    ),
  );
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(prepared, identityJson, binding),
    null,
  );
  const fromEmpty = prepareCoordinatorStateOperationSnapshot(
    Buffer.from(`${encodeCoordinatorStateValue(empty)}\n`),
    identityJson,
    binding,
  );
  assert.ok(fromEmpty);
  assert.deepEqual(
    decodeCoordinatorStateSnapshot(fromEmpty, binding)?.snapshot.previous,
    { revision: 1, payloadSha256: coordinatorStateContentHash(empty) },
  );
  for (const invalid of [
    "invalid",
    JSON.stringify(identity),
    `${JSON.stringify({ ...identity, operationNonce: "invalid" })}\n`,
  ])
    assert.equal(
      prepareCoordinatorStateOperationSnapshot(null, invalid, binding),
      null,
    );
  assert.equal(
    prepareCoordinatorStateOperationSnapshot(
      Buffer.from("invalid"),
      identityJson,
      binding,
    ),
    null,
  );
  for (const [currentState, nextState] of [
    ["host_only", "docker_active"],
    ["docker_absent_confirmed", "docker_submission_started"],
    ["host_only", "docker_absent_confirmed"],
  ]) {
    const before = { ...hostRecord, state: currentState };
    const after = { ...before, state: nextState };
    const invalidTransition = {
      ...transition,
      currentState,
      nextState,
      recordBefore: before,
      currentToken:
        token.slice(0, -64) +
        createHash("sha256")
          .update(`${JSON.stringify(before)}\n`)
          .digest("hex"),
      expectedToken:
        token.slice(0, -64) +
        createHash("sha256")
          .update(`${JSON.stringify(after)}\n`)
          .digest("hex"),
    };
    const invalid = {
      ...snapshot,
      operations: [
        {
          ...operation,
          host: {
            ...operation.host,
            currentToken: invalidTransition.currentToken,
            pendingTransitionJson: `${JSON.stringify(invalidTransition)}\n`,
          },
        },
      ],
    };
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(`${encodeCoordinatorStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  }
  const accepted = decodeCoordinatorStateSnapshot(
    Buffer.from(`${encodeCoordinatorStateValue(snapshot)}\n`),
    binding,
  );
  assert.ok(accepted);
  assert.equal(accepted.snapshot.operations[0]?.identityJson, identityJson);
  assert.equal(
    accepted.snapshot.operations[0]?.resources[2]?.dockerId,
    "d".repeat(64),
  );
  for (const replacement of [
    {
      ...operation,
      recoveryId: `${recoveryId.slice(0, -1)}${recoveryId.endsWith("0") ? "1" : "0"}`,
    },
    {
      ...operation,
      identityJson: `${encodeCoordinatorStateValue(identity)}\n`,
    },
    { ...operation, resources: [...operation.resources].reverse() },
    {
      ...operation,
      host: {
        ...operation.host,
        pendingTransitionJson: `${encodeCoordinatorStateValue(transition)}\n`,
      },
    },
  ])
    assert.equal(
      decodeCoordinatorStateSnapshot(
        Buffer.from(
          `${encodeCoordinatorStateValue({
            ...snapshot,
            operations: [replacement],
          })}\n`,
        ),
        binding,
      ),
      null,
    );
  const orphan = {
    ...snapshot,
    unresolvedRecoveries: [
      {
        operationNonce: "f".repeat(64),
        recoveryId,
        reason: "provider_result_invalid",
        obligations: ["docker_resources"],
      },
    ],
  };
  assert.equal(
    decodeCoordinatorStateSnapshot(
      Buffer.from(`${encodeCoordinatorStateValue(orphan)}\n`),
      binding,
    ),
    null,
  );
  const currentBytes = Buffer.from(
    `${encodeCoordinatorStateValue(snapshot)}\n`,
  );
  const next = {
    ...snapshot,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: coordinatorStateContentHash(snapshot),
    },
  };
  assert.equal(
    validateCoordinatorStateTransition(
      currentBytes,
      Buffer.from(`${encodeCoordinatorStateValue(next)}\n`),
      binding,
    ),
    true,
  );
  for (const invalid of [
    { ...next, previous: { ...next.previous, payloadSha256: "f".repeat(64) } },
    { ...next, operations: [] },
    {
      ...next,
      operations: [
        {
          ...operation,
          resources: operation.resources.map((resource) =>
            resource.purpose === "create_provider"
              ? { ...resource, dockerId: "e".repeat(64) }
              : resource,
          ),
        },
      ],
    },
    {
      ...next,
      operations: [
        {
          ...operation,
          resources: operation.resources.map((resource) =>
            resource.purpose === "create_provider"
              ? {
                  ...resource,
                  request: "unknown",
                  dockerId: null,
                  receiptSource: null,
                }
              : resource,
          ),
        },
      ],
    },
    { ...next, operations: [{ ...operation, phase: "executing" }] },
    {
      ...next,
      operations: [
        {
          ...operation,
          host: { ...operation.host, pendingTransitionJson: null },
        },
      ],
    },
  ])
    assert.equal(
      validateCoordinatorStateTransition(
        currentBytes,
        Buffer.from(`${encodeCoordinatorStateValue(invalid)}\n`),
        binding,
      ),
      false,
    );
  const failure = {
    purpose: "create_provider",
    stage: "command_wait",
    reason: "provider_result_invalid",
    exceptionCode: null,
    commandHandleObtained: true,
    responseObserved: true,
    receiptRecorded: false,
  };
  const stopped = {
    ...snapshot,
    operations: [
      {
        ...operation,
        primaryFailure: failure,
        outcome: {
          status: "blocked",
          reason: "provider_result_invalid",
          cleanupConfirmed: false,
        },
        summarySha256: null,
      },
    ],
    unresolvedRecoveries: [
      {
        operationNonce: nonce,
        recoveryId,
        reason: "provider_result_invalid",
        obligations: ["docker_resources"],
      },
    ],
    pendingDeliveries: [
      {
        operationNonce: nonce,
        recoveryId,
        resultId: "e".repeat(64),
        consumer: "orchestrator",
        acceptanceSha256: "f".repeat(64),
      },
    ],
  };
  const stoppedBytes = Buffer.from(`${encodeCoordinatorStateValue(stopped)}\n`);
  const lifecycle = {
    phase: operation.phase,
    lease: operation.lease,
    execution: operation.execution,
    primaryFailure: failure,
    outcome: stopped.operations[0]?.outcome,
    summarySha256: null,
  };
  const lifecycleBytes = prepareCoordinatorStateLifecycleSnapshot(
    currentBytes,
    recoveryId,
    lifecycle,
    binding,
  );
  assert.ok(lifecycleBytes);
  const lifecycleState = decodeCoordinatorStateSnapshot(
    lifecycleBytes,
    binding,
  );
  assert.ok(lifecycleState);
  assert.deepEqual(
    lifecycleState.snapshot.operations[0]?.primaryFailure,
    failure,
  );
  assert.deepEqual(
    lifecycleState.snapshot.operations[0]?.resources,
    operation.resources,
  );
  assert.deepEqual(lifecycleState.snapshot.operations[0]?.host, operation.host);
  const references = {
    recovery: stopped.unresolvedRecoveries[0],
    deliveries: stopped.pendingDeliveries.map((item) => ({
      ...item,
      acceptanceSha256: null,
    })),
  };
  const referencesBytes = prepareCoordinatorStateReferencesSnapshot(
    lifecycleBytes,
    recoveryId,
    references,
    binding,
  );
  assert.ok(referencesBytes);
  const acceptedReferences = {
    ...references,
    deliveries: stopped.pendingDeliveries,
  };
  const acceptedBytes = prepareCoordinatorStateReferencesSnapshot(
    referencesBytes,
    recoveryId,
    acceptedReferences,
    binding,
  );
  assert.ok(acceptedBytes);
  const acceptedState = decodeCoordinatorStateSnapshot(acceptedBytes, binding);
  assert.deepEqual(
    acceptedState?.snapshot.operations,
    lifecycleState.snapshot.operations,
  );
  assert.equal(
    acceptedState?.snapshot.pendingDeliveries[0]?.acceptanceSha256,
    "f".repeat(64),
  );
  for (const invalid of [
    { recovery: null, deliveries: [] },
    references,
    {
      ...acceptedReferences,
      deliveries: acceptedReferences.deliveries.map((item) => ({
        ...item,
        resultId: "a".repeat(64),
      })),
    },
    {
      ...acceptedReferences,
      recovery: { ...references.recovery, operationNonce: "0".repeat(64) },
    },
    {
      ...acceptedReferences,
      deliveries: [
        ...acceptedReferences.deliveries,
        ...acceptedReferences.deliveries,
      ],
    },
    { ...acceptedReferences, extra: true },
  ]) {
    assert.equal(
      prepareCoordinatorStateReferencesSnapshot(
        acceptedBytes,
        recoveryId,
        invalid,
        binding,
      ),
      null,
    );
  }
  for (const invalid of [
    { ...lifecycle, primaryFailure: null },
    {
      ...lifecycle,
      primaryFailure: { ...failure, reason: "provider_execution_failed" },
    },
    {
      ...lifecycle,
      outcome: {
        status: "completed",
        reason: "provider_operation_completed",
        cleanupConfirmed: true,
      },
    },
    { ...lifecycle, summarySha256: "e".repeat(64) },
    { ...lifecycle, identityJson },
    {
      ...lifecycle,
      execution: { ...operation.execution, externalSend: "not_issued" },
    },
    { phase: lifecycle.phase },
  ]) {
    assert.equal(
      prepareCoordinatorStateLifecycleSnapshot(
        lifecycleBytes,
        recoveryId,
        invalid,
        binding,
      ),
      null,
    );
  }
  const stoppedNext = {
    ...stopped,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: coordinatorStateContentHash(stopped),
    },
  };
  assert.equal(
    validateCoordinatorStateTransition(
      stoppedBytes,
      Buffer.from(
        `${encodeCoordinatorStateValue({ ...stoppedNext, operations: [{ ...stopped.operations[0], outcome: { ...stopped.operations[0]?.outcome, cleanupConfirmed: true } }] })}\n`,
      ),
      binding,
    ),
    true,
  );
  for (const invalid of [
    ...(
      [
        ["providerStart", "not_started"],
        ["externalSend", "not_issued"],
        ["sharedWrite", "not_issued"],
        ["ownerEffect", "active"],
      ] as const
    ).map(([field, value]) => ({
      ...stoppedNext,
      operations: [
        {
          ...stopped.operations[0],
          execution: { ...operation.execution, [field]: value },
        },
      ],
    })),
    { ...stoppedNext, unresolvedRecoveries: [] },
    { ...stoppedNext, pendingDeliveries: [] },
    {
      ...stoppedNext,
      pendingDeliveries: [
        { ...stopped.pendingDeliveries[0], resultId: "a".repeat(64) },
      ],
    },
    {
      ...stoppedNext,
      pendingDeliveries: [
        { ...stopped.pendingDeliveries[0], acceptanceSha256: null },
      ],
    },
    {
      ...stoppedNext,
      operations: [{ ...stopped.operations[0], primaryFailure: null }],
    },
    {
      ...stoppedNext,
      operations: [{ ...stopped.operations[0], summarySha256: "e".repeat(64) }],
    },
    {
      ...stoppedNext,
      operations: [
        {
          ...stopped.operations[0],
          outcome: {
            status: "completed",
            reason: "provider_operation_completed",
            cleanupConfirmed: true,
          },
        },
      ],
    },
  ])
    assert.equal(
      validateCoordinatorStateTransition(
        stoppedBytes,
        Buffer.from(`${encodeCoordinatorStateValue(invalid)}\n`),
        binding,
      ),
      false,
    );
});

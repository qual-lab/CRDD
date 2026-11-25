/**
 * Coordinator現在状態の固定encodingと相関を検証する。
 * @packageDocumentation
 * @responsibility 保存内容検査を実資源の回収証明と分離して反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope Domain保存codec・状態遷移・出版相関
 * @boundary PRL-UT-006=Direct Boundary: メモリ内の保存本文。
 */

import { hashExecutionStateContent } from "../../../src/composition/validation.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext, runInThisContext } from "node:vm";
import {
  decodeStateSnapshot,
  prepareHistoryRetention,
} from "../../../src/composition/transition.ts";
import { encodeStateValue } from "../../../src/composition/validation.ts";
import { validState } from "../../../src/task/validation.ts";
import { captureTaskExecutionUpdate, prepareTaskExecutionUpdate } from "../../../src/task/transition.ts";

/**
 * @responsibility 準備Readerの拒否理由と解放不明を内部結果へ保持する。
 * @trace PRL-UT-006
 * @precondition 同じ保存操作と正常Identityの有限観測を使用する。
 * @stimulus 準備成功、Reader拒否、解放不明を与える。
 * @observation Context、reason、lockReleased。
 * @oracle Context欠測へ丸めても未解放を解放済みへ変えない。
 * @cleanup Process内のMapだけ。
 * @boundary 内部準備Readerの結果搬送。
 */
test("終端準備はReaderの拒否理由とLock解放不明を保持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/attempt/crud.ts", import.meta.url),
    "utf8",
  );
  // 未束縛コードだけを一回準備し、依存値と内部Mapは各条件で生成する。
  const createExecution = runInThisContext(`(dependencies) => {
      const liveSettlements = new WeakMap();
      const { getConsumerCompletionPolicy, observeExecutionSettlementStorageAccess,
        captureExecutionCleanupVerification, readOperationStateStage } = dependencies;
      ${sourceDeclaration(source, "prepareOperationCompletion")}
      return prepareOperationCompletion;
    }`);
  for (const scenario of ["ready", "rejected", "unlock_unknown"]) {
    const execute = createExecution({
      getConsumerCompletionPolicy: () => "durable",
      observeExecutionSettlementStorageAccess: () => ({
        operationId: "operation",
      }),
      captureExecutionCleanupVerification: () => () => "confirmed",
      readOperationStateStage: () => ({
        status: scenario === "ready" ? "completed" : "blocked",
        reason:
          scenario === "unlock_unknown"
            ? "coordinator_state_lock_release_unconfirmed"
            : "coordinator_state_read_unconfirmed",
        lockReleased: scenario !== "unlock_unknown",
        value:
          scenario === "ready"
            ? {
                snapshot: {
                  operations: [
                    {
                      kind: "docker_task",
                      recoveryId: "exact",
                      identityJson: JSON.stringify({
                        operationId: "operation",
                        consumer: "coordinator",
                      }),
                    },
                  ],
                },
              }
            : null,
      }),
    });
    const result = execute({}, "exact", "coordinator");
    assert.equal(Boolean(result.context), scenario === "ready");
    assert.equal(result.lockReleased, scenario !== "unlock_unknown");
    assert.equal(
      result.reason,
      scenario === "ready"
        ? null
        : scenario === "unlock_unknown"
          ? "coordinator_state_lock_release_unconfirmed"
          : "coordinator_state_read_unconfirmed",
    );
  }
});

/**
 * 受理済み終了入力を例外後も同じ参照へ結合する。
 * @responsibility 入力受理と保存成立を分離し、上位の再入場材料を失わせない。
 * @trace PRL-UT-006
 * @precondition 本番の終了宣言と有限の同期観測だけを使用する。
 * @stimulus 受理後のReader・Snapshot取得・符号化に例外を注入する。
 * @observation 受理flag、回復参照、保存未確定、Writer到達数、別参照拒否。
 * @oracle 同じ入力は保持し、例外を保存成功又は清掃成功へ補完しない。
 * @cleanup 外部資源なし。
 * @boundary 終了結果搬送のみ。実I/Oの発行事実は既存Writer試験が確認する。
 */
test("終了入力の受理後例外でも元参照と未確定を返す", () => {
  const source = fs.readFileSync(
    new URL("../../../src/attempt/crud.ts", import.meta.url),
    "utf8",
  );
  // 未束縛コードだけを一回準備し、依存値と内部Mapは各条件で生成する。
  const createExecution = runInThisContext(`(dependencies) => {
      const { readLiveSettlement, observeExecutionTerminalForStorage,
        readOwnedSettlementSnapshot, writeStateSnapshot, encodeStateValue,
        writeOwnedSettlement, prepareStateCleanupSnapshot } = dependencies;
      ${sourceDeclaration(source, "captureOperationCompletionInputs")}
      ${sourceDeclaration(source, "completeOperation")}
      return completeOperation;
    }`);
  for (const fault of ["reader", "snapshot", "encoding"]) {
    const context = {},
      cleanup = {},
      completion = {};
    const settlement: {
      repository: { operationId: string; repositoryBinding: string };
      managementCapability: object;
      recoveryId: string;
      verifyCleanup: () => string;
      originalInputs?: { cleanupOutcome: unknown; dockerCompletion: unknown };
    } = {
      repository: { operationId: "operation", repositoryBinding: "binding" },
      managementCapability: {},
      recoveryId: "exact-recovery",
      verifyCleanup: () => "confirmed",
    };
    let writes = 0;
    let snapshotReads = 0;
    const terminal = {
      get resourceSnapshot() {
        snapshotReads++;
        throw new Error("snapshot read failure");
      },
    };
    const execute = createExecution({
      readLiveSettlement: (received: unknown) =>
        received === context ? settlement : null,
      observeExecutionTerminalForStorage: () => terminal,
      readOwnedSettlementSnapshot: () => {
        if (fault === "reader") throw new Error("reader failure");
        return {
          status: "completed",
          value: {
            snapshot: {
              operations: [
                {
                  kind: "docker_task",
                  recoveryId: settlement.recoveryId,
                  summarySha256: null,
                },
              ],
            },
          },
        };
      },
      writeStateSnapshot: () => ({
        status: "blocked",
        reason: "coordinator_state_input_invalid",
        filesystemEffectIssued: false,
        snapshotConfirmed: false,
        lockReleased: false,
      }),
      encodeStateValue: () => {
        if (fault === "encoding") throw new Error("encoding failure");
        return "{}";
      },
      writeOwnedSettlement: () => {
        writes++;
        throw new Error("unexpected writer");
      },
      prepareStateCleanupSnapshot: () => {
        throw new Error("unexpected preparation");
      },
    });
    const first = execute(context, cleanup, completion);
    assert.equal(first.inputAccepted, true);
    assert.equal(first.status, "blocked");
    assert.equal(first.snapshotConfirmed, false);
    assert.equal(first.recoveryId, settlement.recoveryId);
    assert.equal(writes, 0);
    assert.equal(execute(context, cleanup, completion).inputAccepted, true);
    assert.equal(
      execute(context, { ...cleanup }, completion).inputAccepted,
      false,
    );
    assert.equal(
      execute(context, cleanup, { ...completion }).inputAccepted,
      false,
    );
    assert.equal(writes, 0);
    assert.equal(snapshotReads, fault === "snapshot" ? 2 : 0);
  }
});

import {
  areTaskResourcesSettled,
  canCloseUnknownAuthentication,
  createDockerRestartRequestId,
  projectOperationState,
} from "../../../src/attempt/validation.ts";
import { decodeHistoryRows } from "../../../src/history/validation.ts";
import {
  applyResourceEvent,
  type ExecutionOperationRecord,
  type OperationResources,
  type ProjectExecutionState,
} from "../../../src/index.ts";
import type { ExecutionStateSnapshot } from "../../../src/composition/types.ts";
import {
  classifyResourcePublication,
  EXECUTION_STATE_SCHEMA,
  prepareRecoveredHistoryPublication,
  prepareStateCompletionSnapshot,
  projectTaskSettlement,
  validateStateTransition,
  validateUnifiedTransition,
} from "../../../src/composition/transition.ts";
import { prepareUnifiedTaskSnapshot } from "../../../src/composition/transition.ts";
import {
  createResourceBookFixture,
  createResourceOperationFixture,
} from "../../support/resource-operation.ts";
import { createManagedRuntimeSnapshotFixture } from "../../support/state-fixture.ts";
import { sourceDeclaration } from "../../support/source-declaration.ts";

/**
 * 終端候補の改訂をCleanupの有無から独立させて確認する。
 * @responsibility 本番の終端候補生成を実行し、保存直前の版・前Hash・拒否を反証する。
 * @trace PRL-UT-006
 * @precondition 資源未受領又は正式未発行の合成元版。保存端だけを捕捉する。
 * @stimulus Book有無と、未開始・未発行・Snapshot相関の不成立を渡す。
 * @observation 保存到達回数、候補bytes、元結果・回復IDと固定拒否結果。
 * @oracle 正常時は元版+1、前Hash一致。安全条件不成立は保存0、元版差は遷移拒否。
 * @cleanup N/A: メモリとSource読取りだけ。Filesystem・Lock・Dockerは変更しない。
 * @boundary 候補生成のUT。物理保存と実CASは既存保存ITが確認する。
 */
const completionSource = fs.readFileSync(
  new URL("../../../src/attempt/crud.ts", import.meta.url),
  "utf8",
);
// 同じ未束縛コードを六条件で使い、評価結果と入力は共有しない。
const createCompletionExecution = runInThisContext(`(dependencies) => {
      const { readLiveSettlement, captureOperationCompletionInputs,
        observeExecutionTerminalForStorage, readOwnedSettlementSnapshot,
        writeStateSnapshot, prepareStateCleanupSnapshot,
        decodeStateSnapshot, encodeStateValue, writeOwnedSettlement } = dependencies;
      ${sourceDeclaration(completionSource, "completeOperation")}
      return completeOperation;
    }`);
for (const scenario of [
  "without_resources",
  "with_resources",
  "provider_started",
  "external_send_unknown",
  "snapshot_not_received",
  "observation_unknown",
] as const) {
  test(`終了記録の改訂と安全条件: ${scenario}`, () => {
    const fixture = createResourceOperationFixture();
    const initial = decodeStateSnapshot(fixture.bytes, fixture.binding);
    assert.ok(initial);
    const frame = createResourceBookFixture(fixture.ownershipLabel);
    let book: OperationResources | null = null;
    if (scenario === "with_resources") {
      book = applyResourceEvent(null, {
        event: "submission",
        key: "container",
        snapshot: frame.snapshot,
        cleanup: frame.cleanup,
      });
      assert.ok(book);
      book = applyResourceEvent(book, {
        event: "not_issued",
        key: "container",
      });
      assert.ok(book);
    }
    const beforeBytes = Buffer.from(
      `${encodeStateValue({
        ...initial.snapshot,
        operations: initial.snapshot.operations.map((operation) =>
          operation.kind !== "docker_task"
            ? operation
            : {
                ...operation,
                resources: book,
                execution: {
                  ...operation.execution,
                  ...(scenario === "provider_started"
                    ? { providerStart: "started" }
                    : {}),
                  ...(scenario === "external_send_unknown"
                    ? { externalSend: "unknown" }
                    : {}),
                },
              },
        ),
      })}\n`,
    );
    const before = decodeStateSnapshot(beforeBytes, fixture.binding);
    assert.ok(before);
    const context = {},
      cleanup = {},
      completion = Object.freeze({
        status: "blocked",
        reason: "provider_result_invalid",
        cleanupConfirmed: true,
      });
    const terminal = {
      resourceSnapshot:
        book?.snapshot ??
        (scenario === "snapshot_not_received" ? frame.snapshot : null),
      resources: (book?.checkpoints ?? frame.checkpoints).map((item) => ({
        key: item.key,
        observation:
          scenario === "observation_unknown" ? "unknown" : "not_requested",
      })),
      homeLeaseReleased: true,
      recoveryCompleted: true,
      primaryFailure: null,
    };
    const captured: { writes: number; bytes: Buffer | null } = {
      writes: 0,
      bytes: null,
    };
    const execute = createCompletionExecution({
      readLiveSettlement: (value: unknown) => {
        assert.equal(value, context);
        return {
          repository: {
            repositoryBinding: fixture.binding,
            operationId: fixture.identity.operationId,
          },
          recoveryId: fixture.recoveryId,
          verifyCleanup: () => true,
        };
      },
      captureOperationCompletionInputs: (
        _context: unknown,
        receivedCleanup: unknown,
        receivedResult: unknown,
      ) => {
        assert.equal(receivedCleanup, cleanup);
        assert.equal(receivedResult, completion);
        return true;
      },
      observeExecutionTerminalForStorage: () => terminal,
      readOwnedSettlementSnapshot: () => ({
        status: "completed",
        value: before,
      }),
      writeStateSnapshot: () => ({
        status: "blocked",
        reason: "fixture_input_rejected",
        filesystemEffectIssued: false,
      }),
      prepareStateCleanupSnapshot,
      decodeStateSnapshot,
      encodeStateValue,
      writeOwnedSettlement: (
        _context: unknown,
        bytes: Buffer,
        receivedCleanup: unknown,
        receivedResult: unknown,
      ) => {
        assert.equal(_context, context);
        assert.equal(receivedCleanup, cleanup);
        assert.equal(receivedResult, completion);
        captured.writes++;
        captured.bytes = bytes;
        return {
          status: "blocked",
          reason: "fixture_storage_refused",
          lockReleased: false,
          filesystemEffectIssued: false,
        };
      },
    });
    const result = execute(context, cleanup, completion);
    const safe =
      scenario === "without_resources" || scenario === "with_resources";
    assert.equal(captured.writes, safe ? 1 : 0);
    assert.equal(result.status, "blocked");
    assert.equal(result.inputAccepted, true);
    assert.equal(result.recoveryId, fixture.recoveryId);
    assert.equal(
      result.reason,
      safe ? "fixture_storage_refused" : "fixture_input_rejected",
    );
    if (!safe) return;
    assert.equal(result.lockReleased, false);
    assert.ok(captured.bytes);
    const candidate = decodeStateSnapshot(captured.bytes, fixture.binding);
    assert.ok(candidate);
    assert.equal(candidate.snapshot.revision, before.snapshot.revision + 1);
    assert.deepEqual(candidate.snapshot.previous, {
      revision: before.snapshot.revision,
      payloadSha256: createHash("sha256").update(beforeBytes).digest("hex"),
    });
    assert.equal(
      validateStateTransition(beforeBytes, captured.bytes, fixture.binding),
      true,
    );
    for (const invalid of [
      { ...candidate.snapshot, revision: before.snapshot.revision },
      {
        ...candidate.snapshot,
        previous: {
          ...candidate.snapshot.previous,
          payloadSha256: "f".repeat(64),
        },
      },
    ])
      assert.equal(
        validateStateTransition(
          beforeBytes,
          Buffer.from(`${encodeStateValue(invalid)}\n`),
          fixture.binding,
        ),
        false,
      );
    assert.ok(
      fixture.bytes.equals(
        Buffer.from(`${encodeStateValue(initial.snapshot)}\n`),
      ),
    );
  });
}

const binding = "a".repeat(64);
const RESOURCE_KEYS = [
  "create_egress_network",
  "create_internal_network",
  "create_provider",
  "create_proxy",
  "create_subscription_auth_probe",
] as const;

/**
 * 実行だけを使う未初期化Task区画の合成値を返す。
 * @responsibility 新Schemaの純粋試験で物理保存・移行入力を作らない。
 * @trace PRL-UT-006
 * @returns 空の単一保存値。
 * @effect N/A: メモリ内のfixture生成だけ。
 * @precondition 固定Bindingと現行Domain Schemaを使用する。
 * @stimulus Task未初期化の空区画を組み立てる。
 * @observation 実行・回復・配送・Projectの空集合。
 * @oracle 架空の旧Profileや初期化済み状態を補完しない。
 * @cleanup N/A: 局所値のみ。
 * @boundary 純粋codec試験。実保存・実行を開始しない。
 */
function emptyExecutionStateSnapshot(): ExecutionStateSnapshot {
  return {
    schema: EXECUTION_STATE_SCHEMA,
    revision: 1,
    previous: null,
    repositoryBinding: binding,
    repositoryBindingId: null,
    operations: [],
    unresolvedRecoveries: [],
    projects: [],
    managedExecutions: [],
    queueEntries: [],
    workspaces: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
  };
}

const empty = {
  ...emptyExecutionStateSnapshot(),
  schema: EXECUTION_STATE_SCHEMA,
  revision: 1,
  previous: null,
  repositoryBinding: binding,
  operations: [],
  unresolvedRecoveries: [],
};

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
  const canonical = createResourceOperationFixture();
  const identity = canonical.identity;
  const nonce = identity.operationNonce;
  const canonicalState = decodeStateSnapshot(canonical.bytes, binding);
  assert.ok(canonicalState);
  const host = canonicalState.snapshot.operations.find(
    (item) => item.kind === "host_operation",
  );
  assert.ok(host);
  const closedHost = {
    ...host,
    phase: "terminal" as const,
    cleanup: "confirmed" as const,
  };
  const hostBefore = Buffer.from(
    `${encodeStateValue({ ...empty, operations: [host] })}\n`,
  );
  const identityJson = `${JSON.stringify(identity)}\n`;
  assert.ok(
    prepareStateOperationSnapshot(hostBefore, identityJson, binding),
    "正常な初期Host証明を現行model自身が受理する",
  );
  const technical = decodeStateSnapshot(
    prepareStateOperationSnapshot(hostBefore, identityJson, binding),
    binding,
  );
  assert.ok(technical);
  const domainTechnical = {
    ...technical.snapshot,
    schema: EXECUTION_STATE_SCHEMA,
    managedExecutions: [],
  };
  const domainRead = decodeStateSnapshot(
    Buffer.from(`${encodeStateValue(domainTechnical)}\n`),
    binding,
  );
  assert.ok(domainRead);
  assert.deepEqual(
    domainRead.snapshot.operations,
    technical.snapshot.operations,
  );
  assert.deepEqual(
    domainRead.snapshot.unresolvedRecoveries,
    technical.snapshot.unresolvedRecoveries,
  );
  for (const invalidIdentity of [
    { ...identity, schema: "crdd-coordinator/operation-identity/v1" },
    { ...identity, schema: "crdd-coordinator/operation-identity/v3" },
    { ...identity, schema: "crdd-coordinator/operation-identity/v4" },
    { ...identity, grantRef: "PHMGRANT-FIXTURE" },
    {
      ...identity,
      providerHomeProtectionHash: "b".repeat(64),
      localUserBindingHash: "d".repeat(64),
    },
    { ...identity, profileId: "PROFILE-123456" },
    { ...identity, taskAttempt: 2 },
    {
      ...identity,
      executionSelection: { ...identity.executionSelection, provider: "codex" },
    },
  ])
    assert.equal(
      prepareStateOperationSnapshot(
        hostBefore,
        `${JSON.stringify(invalidIdentity)}\n`,
        binding,
      ),
      null,
    );
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
  const resourceFrame = createResourceBookFixture(
    identity.ownershipLabel,
    "planned",
    RESOURCE_KEYS,
  );
  const providerIntent = applyResourceEvent(null, {
    event: "submission",
    key: "create_provider",
    snapshot: resourceFrame.snapshot,
    cleanup: resourceFrame.cleanup,
  });
  assert.ok(providerIntent);
  const providerBook = applyResourceEvent(providerIntent, {
    event: "receipt",
    key: "create_provider",
    cleanup: resourceFrame.cleanup,
    snapshot: {
      resources: resourceFrame.snapshot.resources.map((r) =>
        r.key === "create_provider"
          ? {
              ...r,
              request: "issued",
              identity: { ...r.identity, dockerId: "d".repeat(64) },
            }
          : r,
      ),
    },
  });
  assert.ok(providerBook);
  const operation = {
    kind: "docker_task" as const,
    dockerRestart: null,
    identityJson,
    identitySha256,
    recoveryId,
    phase: "settling",
    resources: providerBook,
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
  const snapshot = { ...empty, operations: [host, operation] };
  const limitedRestartId = createDockerRestartRequestId(
    binding,
    identitySha256,
    recoveryId,
    "f".repeat(64),
  );
  assert.ok(limitedRestartId);
  const limitedState = {
    ...snapshot,
    operations: [
      host,
      {
        ...operation,
        lease: "held",
        execution: {
          providerStart: "not_started",
          externalSend: "not_issued",
          sharedWrite: "not_issued",
          ownerEffect: "disabled",
          workspaceReusable: false,
        },
        resources: {
          ...resourceFrame,
          snapshot: {
            resources: resourceFrame.snapshot.resources.map((resource) =>
              resource.key === "create_subscription_auth_probe"
                ? { ...resource, request: "unknown" as const }
                : resource,
            ),
          },
          checkpoints: resourceFrame.checkpoints.map((resource) =>
            resource.key === "create_subscription_auth_probe"
              ? { ...resource, submission: "intent_saved" as const }
              : resource,
          ),
        },
        dockerRestart: {
          requestId: limitedRestartId,
          scopeSha256: "f".repeat(64),
          request: "confirmed",
          cleanup: "confirmed",
          result: {
            status: "completed",
            reason: "docker_restart_settled",
            request: "confirmed",
            effectOutcomeUnknown: false,
          },
        },
      },
    ],
  };
  const limitedBytes = Buffer.from(`${encodeStateValue(limitedState)}\n`);
  const limitedDecoded = decodeStateSnapshot(limitedBytes, binding);
  const limitedOperation = limitedDecoded?.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(limitedOperation?.kind === "docker_task");
  assert.equal(canCloseUnknownAuthentication(limitedOperation), true);
  assert.equal(areTaskResourcesSettled(limitedOperation), false);
  const limitedObservation = projectOperationState(limitedOperation);
  assert.equal(limitedObservation.kind, "docker_task");
  assert.equal(limitedObservation.operation, limitedOperation);
  assert.equal(Object.isFrozen(limitedObservation), true);
  if (limitedObservation.kind !== "docker_task")
    throw Error("wrong_operation_kind");
  assert.equal(limitedObservation.resourcesSettled, false);
  assert.equal(limitedObservation.authenticationClosureAllowed, true);
  const observations = [
    { round: 1, name: "absent", name_label: "absent" },
    { round: 2, name: "absent", name_label: "absent" },
  ];
  const limitedClosed = prepareAuthenticationUnknownClosureSnapshot(
    limitedBytes,
    recoveryId,
    observations,
    binding,
  );
  assert.ok(limitedClosed);
  const closedDecoded = decodeStateSnapshot(limitedClosed, binding);
  assert.ok(closedDecoded);
  const closedOperation = closedDecoded?.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(closedOperation?.kind === "docker_task");
  assert.equal(areTaskResourcesSettled(closedOperation), true);
  const closedState = projectOperationState(closedOperation);
  assert.equal(closedState.operation, closedOperation);
  if (closedState.kind !== "docker_task") throw Error("wrong_operation_kind");
  assert.equal(closedState.resourcesSettled, true);
  // 受付の前提は終端後も成立する。実行の要否はresourcesSettledと区別する。
  assert.equal(closedState.authenticationClosureAllowed, true);
  assert.equal(
    closedState.authenticationClosureAllowed,
    canCloseUnknownAuthentication(closedOperation),
  );
  assert.deepEqual(
    { ...closedOperation, resources: limitedOperation.resources },
    limitedOperation,
  );
  assert.ok(closedOperation.resources && limitedOperation.resources);
  const authClosed = closedOperation.resources.checkpoints.find(
    (item) => item.key === "create_subscription_auth_probe",
  );
  const authResource = closedOperation.resources.snapshot.resources.find(
    (item) => item.key === authClosed?.key,
  );
  assert.ok(authClosed?.absenceEvidenceSha256 && authResource);
  assert.equal(authClosed.submission, "intent_saved");
  assert.equal(authResource.request, "unknown");
  assert.equal(authResource.identity.dockerId, null);
  assert.equal(
    authClosed.absenceEvidenceSha256,
    createHash("sha256")
      .update(
        encodeStateValue({
          domain: "crdd-coordinator/authentication-unknown-absence/v1",
          identitySha256,
          recoveryId,
          purpose: "create_subscription_auth_probe",
          plannedResourceName: authResource.identity.name,
          ownershipLabel: identity.ownershipLabel,
          dockerId: null,
          restart: limitedOperation.dockerRestart,
          observations,
        }),
      )
      .digest("hex"),
  );
  assert.ok(
    prepareAuthenticationUnknownClosureSnapshot(
      limitedClosed,
      recoveryId,
      observations,
      binding,
    )?.equals(limitedClosed),
  );
  assert.equal(
    prepareStateResourceSnapshot(limitedBytes, recoveryId, authClosed, binding),
    null,
  );
  const observedUnknownAbsence = prepareStateCleanupSnapshot(
    limitedBytes,
    recoveryId,
    {
      snapshot: limitedOperation.resources.snapshot,
      observations: limitedOperation.resources.checkpoints.map((resource) => ({
        key: resource.key,
        observation:
          resource.key === authClosed.key ? "absent" : "not_requested",
      })),
    },
    binding,
  );
  assert.ok(observedUnknownAbsence);
  const unknownAbsenceState = decodeStateSnapshot(
    observedUnknownAbsence,
    binding,
  );
  const unknownAbsenceTask = unknownAbsenceState?.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(unknownAbsenceTask?.kind === "docker_task");
  assert.equal(
    areTaskResourcesSettled(unknownAbsenceTask),
    false,
    "観測の保存だけでは専用の終了確定を代替できない",
  );
  for (const invalid of [
    [],
    observations.slice(0, 1),
    [...observations, observations[0]],
    [{ ...observations[0], name: "unknown" }, observations[1]],
    [observations[0], { ...observations[1], name_label: "present" }],
  ])
    assert.equal(
      prepareAuthenticationUnknownClosureSnapshot(
        limitedBytes,
        recoveryId,
        invalid,
        binding,
      ),
      null,
    );
  for (const field of [
    "providerStart",
    "externalSend",
    "sharedWrite",
    "ownerEffect",
  ] as const) {
    const changed: ExecutionOperationRecord = {
      ...closedOperation,
      execution: { ...closedOperation.execution, [field]: "unknown" as const },
    };
    assert.equal(canCloseUnknownAuthentication(changed), false);
    assert.equal(areTaskResourcesSettled(changed), false);
  }
  for (const request of ["not_issued", "unknown", "issued"] as const) {
    assert.ok(closedOperation.dockerRestart);
    const changed: ExecutionOperationRecord = {
      ...closedOperation,
      dockerRestart: { ...closedOperation.dockerRestart, request },
    };
    assert.equal(canCloseUnknownAuthentication(changed), false);
    assert.equal(areTaskResourcesSettled(changed), false);
  }
  const badEvidence = {
    ...closedOperation,
    resources: {
      ...closedOperation.resources,
      checkpoints: closedOperation.resources.checkpoints.map((resource) =>
        resource === authClosed
          ? { ...resource, absenceEvidenceSha256: "0".repeat(64) }
          : resource,
      ),
    },
  };
  assert.equal(areTaskResourcesSettled(badEvidence), false);
  // 実Writer外側の値差分guardだけを分離する。Kernel/FSの成立はHost試験が所有する。
  const storeSource = fs.readFileSync(
    new URL("../../../src/storage/store.ts", import.meta.url),
    "utf8",
  );
  const helperSource = fs.readFileSync(
    new URL("../../../src/attempt/transition.ts", import.meta.url),
    "utf8",
  );
  const helperStart = helperSource.indexOf(
    "export function hasAuthenticationUnknownAbsence(",
  );
  const differenceStart = helperSource.indexOf(
    "export function authenticationUnknownAbsenceChanged(",
    helperStart,
  );
  assert.ok(differenceStart > helperStart);
  const nextHelper = helperSource.indexOf("\n/**", differenceStart);
  const helperEnd = nextHelper < 0 ? helperSource.length : nextHelper;
  const guardStart = storeSource.indexOf(
    "  if (\n    !currentAuthenticationClosure &&",
  );
  const guardEnd = storeSource.indexOf(
    "  const acquisition = historyOwner",
    guardStart,
  );
  assert.ok(
    helperStart > 0 &&
      helperEnd > helperStart &&
      guardStart > 0 &&
      guardEnd > guardStart,
  );
  const differenceBody = stripTypeScriptTypes(
    helperSource
      .slice(helperStart, helperEnd)
      .replaceAll("export function", "function"),
  );
  const outerBody = stripTypeScriptTypes(
    `function extractedGuard(){\n${storeSource.slice(guardStart, guardEnd)}\n}`,
  )
    .replace(/^function extractedGuard\(\)\s*\{/u, "")
    .replace(/\}\s*$/u, "");
  const alternateState = {
    ...closedDecoded.snapshot,
    revision: closedDecoded.snapshot.revision + 1,
    previous: {
      revision: closedDecoded.snapshot.revision,
      payloadSha256: closedDecoded.payloadSha256,
    },
  };
  const alternate = Buffer.from(`${encodeStateValue(alternateState)}\n`);
  assert.ok(decodeStateSnapshot(alternate, binding));
  const badAuthBytes = Buffer.from(
    `${encodeStateValue({ ...closedDecoded.snapshot, operations: [host, badEvidence] })}\n`,
  );
  assert.ok(decodeStateSnapshot(badAuthBytes, binding));
  const pairKinds = [
    "currentHistory",
    "currentCompletion",
    "currentRepair",
    "settlement.completion",
  ];
  for (const kind of pairKinds) {
    for (const scenario of [
      "normal",
      "before_invalid",
      "candidate_mismatch",
      "auth_changed",
      "multiple",
    ] as const) {
      const targetBytes =
        scenario === "candidate_mismatch"
          ? alternate
          : scenario === "auth_changed"
            ? badAuthBytes
            : limitedClosed;
      const decodedTarget = decodeStateSnapshot(targetBytes, binding);
      assert.ok(decodedTarget);
      const pair = {
        before:
          scenario === "before_invalid"
            ? Buffer.from("{}\n")
            : Buffer.from(limitedClosed),
        candidate:
          scenario === "candidate_mismatch"
            ? Buffer.from(limitedClosed)
            : Buffer.from(targetBytes),
      };
      const variants = [{ name: "original", body: outerBody }];
      if (scenario === "candidate_mismatch")
        variants.push({
          name: "candidate_guard_removed",
          body: outerBody.replace("fixed?.candidate.equals(bytes)", "true"),
        });
      if (scenario === "multiple")
        variants.push({
          name: "multiple_guard_removed",
          body: outerBody.replace(
            "fixedPairs.length === 1",
            "fixedPairs.length >= 1",
          ),
        });
      if (scenario === "auth_changed")
        variants.push({
          name: "difference_guard_removed",
          body: outerBody.replace(
            /authenticationUnknownAbsenceChanged\(\s*previousSnapshot,\s*candidate.snapshot,?\s*\)/u,
            "false",
          ),
        });
      for (const variant of variants) {
        if (variant.name !== "original")
          assert.notEqual(variant.body, outerBody);
        let requests = 0,
          reads = 0;
        const settlement: Record<string, unknown> = {};
        const environment: Record<string, unknown> = {
          Buffer,
          currentAuthenticationClosure: null,
          currentHistory: null,
          currentCompletion: null,
          currentRepair: null,
          taskHistoryState: null,
          settlement,
          candidate: decodedTarget,
          bytes: targetBytes,
          repository: { repositoryBinding: binding },
          attempt: {},
          encodeStateValue,
          decodeStateSnapshot: decodeStateSnapshot,
          readStateSnapshot: () => {
            reads++;
            return {
              status: "completed",
              lockReleased: true,
              value: closedDecoded,
            };
          },
          request: () => requests++,
        };
        if (kind.startsWith("settlement."))
          settlement[kind.slice("settlement.".length)] = pair;
        else environment[kind] = pair;
        if (scenario === "multiple") {
          if (kind === "currentHistory") environment.currentCompletion = pair;
          else environment.currentHistory = pair;
        }
        runInNewContext(
          `(function(){${differenceBody}\n${variant.body}\nrequest();})()`,
          environment,
        );
        assert.equal(
          requests,
          scenario === "normal" || variant.name !== "original" ? 1 : 0,
          `${kind}:${scenario}:${variant.name}`,
        );
        assert.equal(
          reads,
          0,
          `${kind}:${scenario}: no fresh Reader qualification`,
        );
        if (scenario !== "normal" && variant.name !== "original")
          assert.throws(() => assert.equal(requests, 0));
      }
    }
  }
  let readerOnlyRequests = 0,
    readerOnlyReads = 0;
  runInNewContext(
    `(function(){${differenceBody}\n${outerBody}\nrequest();})()`,
    {
      Buffer,
      currentAuthenticationClosure: null,
      currentHistory: null,
      currentDelivery: null,
      currentCompletion: null,
      currentRepair: null,
      taskHistoryState: null,
      settlement: {},
      candidate: closedDecoded,
      bytes: limitedClosed,
      repository: { repositoryBinding: binding },
      attempt: {},
      encodeStateValue,
      decodeStateSnapshot: decodeStateSnapshot,
      readStateSnapshot: () => {
        readerOnlyReads++;
        return { status: "blocked", value: null, lockReleased: true };
      },
      request: () => readerOnlyRequests++,
    },
  );
  assert.equal(readerOnlyRequests, 0);
  assert.equal(readerOnlyReads, 1);
  // 保存前の限定条件と保存後の相関を、同じ正常入力から一軸ずつ崩す。
  const closureSources: readonly ExecutionOperationRecord[] = [
    limitedOperation,
    closedOperation,
  ];
  for (const source of closureSources) {
    assert.ok(source.resources && source.dockerRestart?.result);
    const book = source.resources;
    const restart = source.dockerRestart;
    const mutations: ExecutionOperationRecord[] = [
      { ...source, phase: "executing" },
      ...(
        ["providerStart", "externalSend", "sharedWrite", "ownerEffect"] as const
      ).map((field) => ({
        ...source,
        execution: { ...source.execution, [field]: "unknown" as const },
      })),
      { ...source, dockerRestart: null },
      ...(["not_issued", "unknown", "issued"] as const).map((request) => ({
        ...source,
        dockerRestart: { ...restart, request },
      })),
      ...(["not_required", "pending", "unknown"] as const).map((cleanup) => ({
        ...source,
        dockerRestart: { ...restart, cleanup },
      })),
      { ...source, dockerRestart: { ...source.dockerRestart, result: null } },
      {
        ...source,
        dockerRestart: { ...source.dockerRestart, requestId: "0".repeat(64) },
      },
      {
        ...source,
        dockerRestart: {
          ...source.dockerRestart,
          result: {
            ...source.dockerRestart.result,
            effectOutcomeUnknown: true,
          },
        },
      },
      {
        ...source,
        resources: {
          ...book,
          snapshot: {
            resources: book.snapshot.resources.map((r) =>
              r.key === authClosed.key
                ? {
                    ...r,
                    identity: { ...r.identity, dockerId: "a".repeat(64) },
                  }
                : r,
            ),
          },
        },
      },
      ...(["docker_create_result", "docker_observation"] as const).map(
        (receiptSource) => ({
          ...source,
          resources: {
            ...book,
            checkpoints: book.checkpoints.map((c) =>
              c.key === authClosed.key ? { ...c, receiptSource } : c,
            ),
          },
        }),
      ),
      {
        ...source,
        resources: {
          ...book,
          checkpoints: book.checkpoints.map((c) =>
            c.key === authClosed.key
              ? { ...c, observation: "present" as const }
              : c,
          ),
        },
      },
      {
        ...source,
        resources: {
          ...book,
          checkpoints: book.checkpoints.map((c) =>
            c.key !== authClosed.key
              ? { ...c, submission: "intent_saved" as const }
              : c,
          ),
        },
      },
    ];
    for (const changed of mutations) {
      assert.equal(
        canCloseUnknownAuthentication(changed),
        false,
        JSON.stringify(changed),
      );
      const changedBytes = Buffer.from(
        encodeStateValue({ ...limitedState, operations: [host, changed] }) +
          "\n",
      );
      if (decodeStateSnapshot(changedBytes, binding))
        assert.equal(
          areTaskResourcesSettled(changed),
          false,
          JSON.stringify(changed),
        );
      assert.equal(
        prepareAuthenticationUnknownClosureSnapshot(
          Buffer.from(
            `${encodeStateValue({
              ...limitedState,
              operations: [host, changed],
            })}\n`,
          ),
          recoveryId,
          observations,
          binding,
        ),
        null,
      );
    }
  }
  for (const mode of ["hash", "name", "label", "id"] as const) {
    const book = closedOperation.resources;
    const changed: ExecutionOperationRecord = {
      ...closedOperation,
      resources: {
        ...book,
        snapshot: {
          resources: book.snapshot.resources.map((r) =>
            r.key === authClosed.key
              ? {
                  ...r,
                  identity: {
                    ...r.identity,
                    ...(mode === "name"
                      ? { name: "crdd-other" }
                      : mode === "label"
                        ? { ownershipLabel: "crdd.owner=foreign" }
                        : mode === "id"
                          ? { dockerId: "a".repeat(64) }
                          : {}),
                  },
                }
              : r,
          ),
        },
        checkpoints: book.checkpoints.map((c) =>
          c.key === authClosed.key && mode === "hash"
            ? { ...c, absenceEvidenceSha256: "f".repeat(64) }
            : c,
        ),
      },
    };
    if (mode === "label" || mode === "id")
      assert.equal(
        decodeStateSnapshot(
          Buffer.from(
            `${encodeStateValue({
              ...limitedState,
              operations: [host, changed],
            })}\n`,
          ),
          binding,
        ),
        null,
      );
    else assert.equal(areTaskResourcesSettled(changed), false);
  }
  assert.ok(
    decodeStateSnapshot(
      Buffer.from(
        `${encodeStateValue({ ...limitedState, operations: [host, badEvidence] })}\n`,
      ),
      binding,
    ),
    "偽Hashの拒否はcodec不正ではなく共同終了判定で行う",
  );
  // 専用不存在から三利用側の履歴・配送・ACK・除去・次受付へ搬送する。
  // ここは値契約であり、Host清掃や上位の耐久保存を実測するものではない。
  for (const consumer of [
    "coordinator_cli",
    "workbench",
    "coordinator",
  ] as const) {
    const consumerIdentity = { ...identity, consumer };
    const consumerJson = `${JSON.stringify(consumerIdentity)}\n`;
    const consumerHash = createHash("sha256")
      .update(consumerJson)
      .digest("hex");
    const consumerRecoveryId = `docker-task.${identity.stableLogicalHomeBindingHash}.${nonce}.${consumerHash}`;
    const consumerRestartId = createDockerRestartRequestId(
      binding,
      consumerHash,
      consumerRecoveryId,
      "f".repeat(64),
    );
    assert.ok(consumerRestartId);
    assert.ok(limitedOperation.dockerRestart);
    const consumerOperation: ExecutionOperationRecord = {
      ...limitedOperation,
      identityJson: consumerJson,
      identitySha256: consumerHash,
      recoveryId: consumerRecoveryId,
      dockerRestart: {
        ...limitedOperation.dockerRestart,
        requestId: consumerRestartId,
      },
    };
    const consumerBefore = Buffer.from(
      `${encodeStateValue({ ...empty, operations: [host, consumerOperation] })}\n`,
    );
    const consumerClosed = prepareAuthenticationUnknownClosureSnapshot(
      consumerBefore,
      consumerRecoveryId,
      observations,
      binding,
    );
    assert.ok(consumerClosed, consumer);
    const resourceClosed = decodeStateSnapshot(
      consumerClosed,
      binding,
    )?.snapshot.operations.find((item) => item.kind === "docker_task");
    assert.ok(resourceClosed?.kind === "docker_task");
    const terminalTask: ExecutionOperationRecord = {
      ...resourceClosed,
      lease: "released",
      outcome: {
        status: "blocked",
        reason: "docker_setup_create_subscription_auth_probe_failed",
        cleanupConfirmed: true,
      },
    };
    const terminalBytes = Buffer.from(
      `${encodeStateValue({ ...empty, operations: [closedHost, terminalTask] })}\n`,
    );
    assert.ok(decodeStateSnapshot(terminalBytes, binding), consumer);
    const time = "2026-10-16T00:00:00.000Z";
    const historyPending = prepareStateHistorySnapshot(
      terminalBytes,
      consumerRecoveryId,
      time,
      false,
      binding,
    );
    assert.ok(historyPending, consumer);
    const historyConfirmed = prepareStateHistorySnapshot(
      historyPending,
      consumerRecoveryId,
      time,
      true,
      binding,
    );
    assert.ok(historyConfirmed, consumer);
    const delivered = historyConfirmed;
    assert.ok(delivered, consumer);
    const accepted = delivered;
    const completed = prepareStateCompletionSnapshot(
      accepted,
      consumerRecoveryId,
      binding,
    );
    assert.ok(completed, consumer);
    const completedState = decodeStateSnapshot(completed, binding);
    assert.ok(completedState);
    assert.deepEqual(completedState.snapshot.operations, [closedHost]);
    assert.deepEqual(completedState.snapshot.unresolvedRecoveries, []);
    assert.equal(
      Object.hasOwn(completedState.snapshot, "pendingDeliveries"),
      false,
    );
    const nextIdentityJson = `${JSON.stringify({ ...consumerIdentity, operationNonce: "d".repeat(64), operationId: "OP-654321" })}\n`;
    const nextHost = {
      ...host,
      operationId: "OP-654321",
      recoveryId: "host-operation.OP-654321",
    };
    const nextBefore = JSON.parse(accepted.toString("utf8"));
    nextBefore.operations.splice(1, 0, nextHost);
    assert.ok(
      prepareStateOperationSnapshot(
        Buffer.from(`${encodeStateValue(nextBefore)}\n`),
        nextIdentityJson,
        binding,
      ),
      `${consumer}: settled predecessor permits next admission`,
    );
    const acceptedState = decodeStateSnapshot(accepted, binding);
    assert.ok(acceptedState);
    const acceptedTask = acceptedState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    );
    assert.ok(acceptedTask?.kind === "docker_task");
    const badTask: ExecutionOperationRecord = {
      ...acceptedTask,
      resources: acceptedTask.resources && {
        ...acceptedTask.resources,
        checkpoints: acceptedTask.resources.checkpoints.map((resource) =>
          resource.key === authClosed.key
            ? { ...resource, absenceEvidenceSha256: "0".repeat(64) }
            : resource,
        ),
      },
    };
    const rejected: Buffer = Buffer.from(
      `${encodeStateValue({ ...acceptedState.snapshot, operations: [host, nextHost, badTask] })}\n`,
    );
    assert.equal(
      decodeStateSnapshot(
        Buffer.from(
          `${encodeStateValue({ ...acceptedState.snapshot, operations: [closedHost, badTask] })}\n`,
        ),
        binding,
      ),
      null,
      "資源未終結をHost清掃済みとして保持しない",
    );
    assert.ok(
      decodeStateSnapshot(rejected, binding),
      `${consumer}: forged evidence is codec legal`,
    );
    assert.equal(
      prepareStateHistorySnapshot(
        rejected,
        consumerRecoveryId,
        time,
        true,
        binding,
      ),
      null,
      consumer,
    );

    assert.equal(
      prepareStateCompletionSnapshot(rejected, consumerRecoveryId, binding),
      null,
      consumer,
    );
    assert.equal(
      prepareStateOperationSnapshot(rejected, nextIdentityJson, binding),
      null,
      consumer,
    );
  }
  const historyState = {
    ...snapshot,
    operations: [
      host,
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
  const historyBytes = Buffer.from(`${encodeStateValue(historyState)}\n`);
  const readyHistoryState = {
    ...historyState,
    operations: [
      closedHost,
      {
        ...operation,
        resources: resourceFrame,
        lease: "released",
        execution: { ...operation.execution, ownerEffect: "disabled" },
        outcome: {
          ...historyState.operations.find((item) => item.kind === "docker_task")
            ?.outcome,
          cleanupConfirmed: true,
        },
      },
    ],
  };
  const readyHistoryBytes = Buffer.from(
    `${encodeStateValue(readyHistoryState)}\n`,
  );
  const occurredAt = "2026-10-08T00:00:00.000Z";
  assert.equal(
    prepareStateHistorySnapshot(
      historyBytes,
      recoveryId,
      occurredAt,
      false,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareStateHistorySnapshot(
      readyHistoryBytes,
      recoveryId,
      occurredAt,
      true,
      binding,
    ),
    null,
  );
  const pendingHistoryBytes = prepareStateHistorySnapshot(
    readyHistoryBytes,
    recoveryId,
    occurredAt,
    false,
    binding,
  );
  assert.ok(pendingHistoryBytes);
  const pendingHistory = decodeStateSnapshot(pendingHistoryBytes, binding);
  assert.ok(pendingHistory);
  const pendingOperation = pendingHistory.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(pendingOperation?.history);
  assert.equal(pendingOperation.history.occurredAt, occurredAt);
  assert.equal(pendingOperation.history.confirmed, false);
  const confirmedHistoryBytes = prepareStateHistorySnapshot(
    pendingHistoryBytes,
    recoveryId,
    occurredAt,
    true,
    binding,
  );
  assert.ok(confirmedHistoryBytes);
  const confirmedHistory = decodeStateSnapshot(confirmedHistoryBytes, binding);
  assert.ok(confirmedHistory);
  // 結果IDは履歴確認・改訂から独立し、再登録で既存受理を巻き戻さない。
  const registeredPending = pendingHistoryBytes;
  const registeredConfirmed = confirmedHistoryBytes;
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
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identityJson = transientJson;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identitySha256 = transientHash;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).recoveryId = transientRecoveryId;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).summarySha256 = null;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history = null;
    transientState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).execution = {
      ...transientState.operations.find(
        (item: { kind?: unknown }) => item.kind === "docker_task",
      ).execution,
      providerStart: "not_started",
      externalSend: "not_issued",
      sharedWrite: "not_issued",
    };
    transientState.unresolvedRecoveries = [];
    const transientUnfixed = Buffer.from(
      `${encodeStateValue(transientState)}\n`,
    );
    const transientFixed = prepareStateHistorySnapshot(
      transientUnfixed,
      transientRecoveryId,
      occurredAt,
      false,
      binding,
    );
    assert.ok(transientFixed);

    const transientCompletionReady = prepareStateHistorySnapshot(
      transientFixed,
      transientRecoveryId,
      occurredAt,
      true,
      binding,
    );
    assert.ok(transientCompletionReady);
    // 四つの終端利用側に同じ資源条件を搬送する。unknown/absentも
    // codecでは記録可能だが、通常終端の根拠には引き続き使用しない。
    for (const [request, observation, settled] of [
      ["not_requested", "unobserved", true],
      ["not_issued", "unobserved", true],
      ["identified", "absent", true],
      ["identified", "present", false],
      ["identified", "unknown", false],
      ["identified", "unobserved", false],
      ["unknown", "absent", false],
      ["issued", "absent", false],
      ["intent_saved", "absent", false],
    ] as const) {
      const matrixState = JSON.parse(transientCompletionReady.toString("utf8"));
      matrixState.operations[0] = settled ? closedHost : host;
      matrixState.operations.splice(1, 0, {
        ...host,
        operationId: "OP-654321",
        recoveryId: "host-operation.OP-654321",
      });
      const matrixOperation = matrixState.operations.find(
        (item: { kind?: unknown }) => item.kind === "docker_task",
      );
      const matrixIdentity = JSON.parse(matrixOperation.identityJson);
      const originalBook: OperationResources = matrixOperation.resources;
      const known = request === "identified";
      const unrequested =
        request === "not_requested" || request === "not_issued";
      matrixOperation.resources = {
        ...originalBook,
        snapshot: {
          resources: originalBook.snapshot.resources.map((r) =>
            r.key === "create_subscription_auth_probe"
              ? {
                  ...r,
                  request: known
                    ? "issued"
                    : unrequested
                      ? "not_issued"
                      : "unknown",
                  identity: {
                    ...r.identity,
                    dockerId: known ? "d".repeat(64) : null,
                  },
                }
              : r,
          ),
        },
        checkpoints: originalBook.checkpoints.map((c) =>
          c.key === "create_subscription_auth_probe"
            ? {
                ...c,
                submission:
                  request === "not_requested"
                    ? "none"
                    : request === "not_issued"
                      ? "not_issued"
                      : "intent_saved",
                receiptSource: known ? "docker_observation" : null,
                observation,
                absenceEvidenceSha256:
                  observation === "absent" ? "e".repeat(64) : null,
              }
            : c,
        ),
      };
      const matrixBytes = Buffer.from(`${encodeStateValue(matrixState)}\n`);
      assert.ok(decodeStateSnapshot(matrixBytes, binding));
      const label = `${consumer}: ${request}/${observation}`;
      assert.equal(
        prepareStateHistorySnapshot(
          matrixBytes,
          transientRecoveryId,
          occurredAt,
          true,
          binding,
        ) !== null,
        settled,
        `${label}: history`,
      );

      assert.equal(
        prepareStateCompletionSnapshot(
          matrixBytes,
          transientRecoveryId,
          binding,
        ) !== null,
        settled,
        `${label}: removal`,
      );
      assert.equal(
        prepareStateOperationSnapshot(
          matrixBytes,
          `${JSON.stringify({
            ...matrixIdentity,
            operationNonce: "0".repeat(64),
            operationId: "OP-654321",
          })}\n`,
          binding,
        ) !== null,
        settled,
        `${label}: next attempt`,
      );
      if (request !== "identified" && observation === "absent") {
        const decoded = decodeStateSnapshot(matrixBytes, binding);
        const task = decoded?.snapshot.operations.find(
          (item) => item.kind === "docker_task",
        );
        assert.ok(task?.kind === "docker_task");
        assert.equal(
          areTaskResourcesSettled(task),
          false,
          "ID未確認の観測を終端根拠にしない",
        );
      }
    }
    const transientCompleted = prepareStateCompletionSnapshot(
      transientCompletionReady,
      transientRecoveryId,
      binding,
    );
    assert.ok(transientCompleted);
    const transientCompletedSnapshot = decodeStateSnapshot(
      transientCompleted,
      binding,
    );
    assert.ok(transientCompletedSnapshot);
    assert.deepEqual(transientCompletedSnapshot.snapshot.operations, [
      closedHost,
    ]);
    assert.equal(
      Object.hasOwn(transientCompletedSnapshot.snapshot, "pendingDeliveries"),
      false,
    );
    assert.equal(
      prepareStateCompletionSnapshot(
        transientFixed,
        transientRecoveryId,
        binding,
      ),
      null,
    );
    for (const effect of ["providerStart", "externalSend", "sharedWrite"]) {
      const unknownBeforeFixed = JSON.parse(transientUnfixed.toString("utf8"));
      unknownBeforeFixed.operations.find(
        (item: { kind?: unknown }) => item.kind === "docker_task",
      ).execution[effect] = "unknown";
      const unknownBytes = Buffer.from(
        `${encodeStateValue(unknownBeforeFixed)}\n`,
      );
      const unknownFixed = prepareStateHistorySnapshot(
        unknownBytes,
        transientRecoveryId,
        occurredAt,
        false,
        binding,
      );
      assert.ok(unknownFixed);
      const unknownConfirmed = prepareStateHistorySnapshot(
        unknownFixed,
        transientRecoveryId,
        occurredAt,
        true,
        binding,
      );
      assert.ok(unknownConfirmed);
      const unknownLine = prepareStateHistoryLine(
        unknownConfirmed,
        transientRecoveryId,
        binding,
      );
      assert.ok(unknownLine);
      const recorded = JSON.parse(unknownLine.toString("utf8"));
      assert.equal(recorded.summary.execution[effect], "unknown");
      assert.deepEqual(
        recorded.summary.outcome,
        unknownBeforeFixed.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).outcome,
      );
      assert.deepEqual(
        recorded.summary.primaryFailure,
        unknownBeforeFixed.operations.find(
          (item: { kind?: unknown }) => item.kind === "docker_task",
        ).primaryFailure,
      );
      assert.ok(decodeHistoryRows(unknownLine));
      assert.ok(
        prepareStateCompletionSnapshot(
          unknownConfirmed,
          transientRecoveryId,
          binding,
        ),
      );
      const oldRow = { ...recorded, schema: "crdd-coordinator/history-row/v1" };
      assert.equal(
        decodeHistoryRows(Buffer.from(`${encodeStateValue(oldRow)}\n`)),
        null,
      );
      const unknownEffect = JSON.parse(
        transientCompletionReady.toString("utf8"),
      );
      unknownEffect.operations.find(
        (item: { kind?: unknown }) => item.kind === "docker_task",
      ).execution[effect] = "unknown";
      assert.equal(
        prepareStateCompletionSnapshot(
          Buffer.from(`${encodeStateValue(unknownEffect)}\n`),
          transientRecoveryId,
          binding,
        ),
        null,
      );
    }
    const injectedPending = {
      ...JSON.parse(transientFixed.toString("utf8")),
      pendingDeliveries: [],
    };
    assert.equal(
      decodeStateSnapshot(
        Buffer.from(`${encodeStateValue(injectedPending)}\n`),
        binding,
      ),
      null,
    );
  }
  const pendingResult = decodeStateSnapshot(registeredPending, binding);
  const confirmedResult = decodeStateSnapshot(registeredConfirmed, binding);
  assert.ok(pendingResult);
  assert.ok(confirmedResult);
  assert.equal(
    Object.hasOwn(pendingResult.snapshot, "pendingDeliveries"),
    false,
  );
  assert.equal(
    Object.hasOwn(confirmedResult.snapshot, "pendingDeliveries"),
    false,
  );
  assert.equal(
    Object.hasOwn(confirmedResult.snapshot, "pendingDeliveries"),
    false,
  );
  const knownBeforeFixed = JSON.parse(readyHistoryBytes.toString("utf8"));
  knownBeforeFixed.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).execution = {
    ...knownBeforeFixed.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).execution,
    providerStart: "not_started",
    externalSend: "not_issued",
    sharedWrite: "not_issued",
  };
  const knownFixed = prepareStateHistorySnapshot(
    Buffer.from(`${encodeStateValue(knownBeforeFixed)}\n`),
    recoveryId,
    occurredAt,
    false,
    binding,
  );
  assert.ok(knownFixed);
  const knownConfirmed = prepareStateHistorySnapshot(
    knownFixed,
    recoveryId,
    occurredAt,
    true,
    binding,
  );
  assert.ok(knownConfirmed);
  const knownHistory = decodeStateSnapshot(knownConfirmed, binding);
  assert.ok(knownHistory);
  const acceptedCompletionState = {
    ...knownHistory.snapshot,
    operations: knownHistory.snapshot.operations.map((value) =>
      value.kind !== "docker_task"
        ? value
        : {
            ...value,
            execution: {
              ...value.execution,
              providerStart: "not_started",
              externalSend: "not_issued",
              sharedWrite: "not_issued",
            },
          },
    ),
    unresolvedRecoveries: [
      {
        operationNonce: nonce,
        recoveryId,
        reason: "provider_operation_completed",
        obligations: ["docker_resources", "host_cleanup", "lease_release"],
      },
    ],
  };
  const acceptedCompletionBytes = Buffer.from(
    `${encodeStateValue(acceptedCompletionState)}\n`,
  );
  // 同一Hostの技術終端と、別Hostに必要な物理清掃を混同しない。
  {
    const foreignHost = {
      ...host,
      operationId: "OP-654321",
      recoveryId: "host-operation.OP-654321",
    };
    const normalOld = {
      ...operation,
      phase: "settling",
      lease: "released",
      resources: resourceFrame,
      execution: {
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
        ownerEffect: "disabled",
        workspaceReusable: false,
      },
    };
    const normalBefore = Buffer.from(
      `${encodeStateValue({ ...empty, operations: [host, foreignHost, normalOld] })}\n`,
    );
    assert.ok(decodeStateSnapshot(normalBefore, binding));
    const nextIdentity = {
      ...identity,
      operationNonce: "0".repeat(64),
    };
    const nextIdentityJson = `${JSON.stringify(nextIdentity)}\n`;
    const started = prepareStateOperationSnapshot(
      normalBefore,
      nextIdentityJson,
      binding,
    );
    assert.ok(
      started,
      "同一Hostの正常技術終端では物理清掃前に次roundを開始できる",
    );
    const startedValue = JSON.parse(started.toString("utf8"));
    assert.deepEqual(
      startedValue.operations.find(
        (item: { recoveryId: string }) => item.recoveryId === recoveryId,
      ),
      normalOld,
    );
    // 実行要求後のunknownを履歴として保持し、技術終端と次stage許可を混同しない。
    for (let mask = 0; mask < 8; mask += 1) {
      const old = structuredClone(normalOld);
      for (const [index, field] of [
        "providerStart",
        "externalSend",
        "sharedWrite",
      ].entries()) {
        if (mask & (1 << index))
          (old.execution as Record<string, unknown>)[field] = "unknown";
      }
      const before: Buffer = Buffer.from(
        `${encodeStateValue({ ...empty, operations: [host, foreignHost, old] })}\n`,
      );
      const next = prepareStateOperationSnapshot(
        before,
        nextIdentityJson,
        binding,
      );
      assert.ok(next, `same-owner continuation unknown mask ${mask}`);
      assert.deepEqual(
        JSON.parse(next.toString("utf8")).operations.find(
          (item: { recoveryId: string }) => item.recoveryId === recoveryId,
        ),
        old,
      );
      const foreign = `${JSON.stringify({ ...nextIdentity, operationId: "OP-654321" })}\n`;
      assert.equal(
        prepareStateOperationSnapshot(before, foreign, binding),
        null,
      );
    }
    const failedPrimary = {
      purpose: "create_provider",
      stage: "command_wait",
      reason: "provider_result_invalid",
      exceptionCode: null,
      commandHandleObtained: true,
      responseObserved: true,
      receiptRecorded: false,
    };
    for (const invalidOld of [
      { ...normalOld, phase: "executing" },
      { ...normalOld, lease: "held" },
      {
        ...normalOld,
        execution: { ...normalOld.execution, ownerEffect: "active" },
      },
      { ...normalOld, primaryFailure: failedPrimary },
      {
        ...normalOld,
        outcome: {
          status: "completed",
          reason: "provider_operation_completed",
          cleanupConfirmed: false,
        },
      },
      {
        ...normalOld,
        dockerRestart: {
          requestId: createDockerRestartRequestId(
            binding,
            identitySha256,
            recoveryId,
            "f".repeat(64),
          ),
          scopeSha256: "f".repeat(64),
          request: "not_issued",
          cleanup: "not_required",
          result: null,
        },
      },
      ...normalOld.resources.checkpoints.map((_, index) => ({
        ...normalOld,
        resources: {
          ...normalOld.resources,
          checkpoints: normalOld.resources.checkpoints.map((c, i) =>
            i === index ? { ...c, submission: "intent_saved" as const } : c,
          ),
        },
      })),
    ]) {
      const before: Buffer = Buffer.from(
        `${encodeStateValue({ ...empty, operations: [host, foreignHost, invalidOld] })}\n`,
      );
      assert.ok(
        decodeStateSnapshot(before, binding),
        JSON.stringify(invalidOld),
      );
      assert.equal(
        prepareStateOperationSnapshot(before, nextIdentityJson, binding),
        null,
      );
      const fabricated = {
        ...startedValue,
        previous: {
          revision: empty.revision,
          payloadSha256: createHash("sha256").update(before).digest("hex"),
        },
      };
      assert.equal(
        validateStateTransition(
          before,
          Buffer.from(`${encodeStateValue(fabricated)}\n`),
          binding,
        ),
        false,
        "同じ開始版で旧操作を正常形へ変更しない",
      );
    }
    for (const changedIdentity of [
      { ...nextIdentity, operationId: "OP-654321" },
      { ...nextIdentity, recoveryCorrelationId: "other-task-operation" },
    ]) {
      assert.equal(
        prepareStateOperationSnapshot(
          normalBefore,
          `${JSON.stringify(changedIdentity)}\n`,
          binding,
        ),
        null,
      );
    }
    const withObligation = {
      ...empty,
      operations: [host, foreignHost, normalOld],
      unresolvedRecoveries: [
        {
          operationNonce: nonce,
          recoveryId,
          reason: "provider_result_invalid",
          obligations: ["docker_resources"],
        },
      ],
    };
    const obligationBytes = Buffer.from(
      `${encodeStateValue(withObligation)}\n`,
    );
    assert.ok(decodeStateSnapshot(obligationBytes, binding));
    assert.equal(
      prepareStateOperationSnapshot(obligationBytes, nextIdentityJson, binding),
      null,
    );
    const badCandidate = structuredClone(startedValue);
    badCandidate.operations.find(
      (item: { recoveryId: string }) => item.recoveryId === recoveryId,
    ).execution.providerStart = "started";
    assert.ok(
      decodeStateSnapshot(
        Buffer.from(`${encodeStateValue(badCandidate)}\n`),
        binding,
      ),
    );
    assert.equal(
      validateStateTransition(
        normalBefore,
        Buffer.from(`${encodeStateValue(badCandidate)}\n`),
        binding,
      ),
      false,
    );
    const modelSource = fs.readFileSync(
      new URL("../../../src/attempt/transition.ts", import.meta.url),
      "utf8",
    );
    const guardStart = modelSource.indexOf("const sameHostContinuation =");
    const guardEnd = modelSource.indexOf("// 同じ更新内の終端偽装", guardStart);
    assert.ok(guardStart > 0 && guardEnd > guardStart);
    const guard = modelSource.slice(guardStart, guardEnd);
    const guardContext = {
      previousIdentity: identity,
      identity: { ...nextIdentity, operationId: "OP-654321" },
      before: normalOld,
      other: normalOld,
      encodeStateValue,
    };
    assert.equal(
      runInNewContext(
        `(() => { ${guard}; return sameHostContinuation; })()`,
        guardContext,
      ),
      false,
    );
    assert.throws(
      () =>
        assert.equal(
          runInNewContext(
            "(() => { const sameHostContinuation = true; return sameHostContinuation; })()",
            guardContext,
          ),
          false,
        ),
      { code: "ERR_ASSERTION" },
    );
  }
  assert.ok(
    prepareStateCompletionSnapshot(
      acceptedCompletionBytes,
      recoveryId,
      binding,
    ),
    "Taskに結合しない技術終端は独立したACKなしで整理できる",
  );
  assert.equal(
    prepareStateCompletionSnapshot(pendingHistoryBytes, recoveryId, binding),
    null,
  );
  assert.equal(
    prepareStateCompletionSnapshot(acceptedCompletionBytes, "other", binding),
    null,
  );
  assert.equal(
    prepareStateCompletionSnapshot(
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
      execution: {
        ...acceptedCompletionState.operations.find(
          (item) => item.kind === "docker_task",
        )?.execution,
        ownerEffect: "active",
      },
    },
    {
      execution: {
        ...acceptedCompletionState.operations.find(
          (item) => item.kind === "docker_task",
        )?.execution,
        externalSend: "unknown",
      },
    },
    {
      outcome: {
        ...acceptedCompletionState.operations.find(
          (item) => item.kind === "docker_task",
        )?.outcome,
        cleanupConfirmed: false,
      },
    },
  ]) {
    const input = Buffer.from(
      `${encodeStateValue({ ...acceptedCompletionState, operations: acceptedCompletionState.operations.map((value) => (value.kind === "docker_task" ? { ...value, ...change } : value)) })}\n`,
    );
    assert.equal(
      prepareStateCompletionSnapshot(input, recoveryId, binding),
      null,
    );
  }
  assert.equal(
    prepareStateCompletionSnapshot(
      Buffer.from(
        encodeStateValue({
          ...acceptedCompletionState,
          pendingDeliveries: [],
        }) + "\n",
      ),
      recoveryId,
      binding,
    ),
    null,
    "旧配送fieldは補完しない",
  );
  assert.equal(
    confirmedHistory.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.history?.lineSha256,
    pendingOperation.history.lineSha256,
  );
  assert.equal(
    confirmedHistory.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.summarySha256,
    pendingOperation.summarySha256,
  );
  assert.equal(
    confirmedHistory.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.history?.confirmed,
    true,
  );
  const historyLine = prepareStateHistoryLine(
    pendingHistoryBytes,
    recoveryId,
    binding,
  );
  assert.ok(historyLine);
  assert.deepEqual(
    projectTaskSettlement(
      {
        kind: "operations",
        recoveryIds: [recoveryId],
        resultUnresolved: false,
      },
      confirmedHistory.snapshot,
    ),
    { cleanupConfirmed: true, recoveryUnresolved: false },
  );
  assert.deepEqual(
    projectTaskSettlement(
      {
        kind: "operations",
        recoveryIds: [recoveryId],
        resultUnresolved: true,
      },
      confirmedHistory.snapshot,
    ),
    { cleanupConfirmed: false, recoveryUnresolved: true },
  );
  const terminalOperation = confirmedHistory.snapshot.operations.find(
    (item): item is ExecutionOperationRecord => item.kind === "docker_task",
  );
  assert.ok(terminalOperation);
  assert.ok(terminalOperation.outcome);
  {
    const projectFixture = {
      status: "completed",
      state: {
        contract: "crdd-execution-model/project-state/v3",
        taskExecutionSelections: {
          executor: {
            provider: "codex",
            modelIdentifier: "gpt-5.5",
            identifierKind: "exact",
            reasoningEffort: "medium",
            purpose: "task",
            catalogIdentity:
              "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
            configIdentity:
              "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
            role: "executor",
            workType: null,
            source: "role_default",
          },
          reviewer: {
            provider: "claude",
            modelIdentifier: "opus",
            identifierKind: "alias",
            reasoningEffort: "high",
            purpose: "task",
            catalogIdentity:
              "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
            configIdentity:
              "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
            role: "independent_reviewer",
            workType: null,
            source: "role_default",
          },
        },
        projectId: "project-a",
        milestoneId: "milestone-a",
        repositoryRevision: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        generation: 1,
        ownerGeneration: "owner-a",
        decisionApplicationId: null,
        maximumConcurrency: 1,
        milestone: {
          id: "milestone-a",
          acceptanceCriteria: ["accepted"],
          state: "planned",
          criterionEvidenceIds: [],
        },
        objectives: [
          {
            definition: { id: "objective-a", acceptanceCriteria: ["done"] },
            state: "planned",
            criterionEvidenceIds: [],
          },
        ],
        tasks: [
          {
            definition: {
              id: "task-a",
              objectiveId: "objective-a",
              dependencies: [],
              allowedPaths: ["source.txt"],
              conflictKeys: [],
            },
            state: "ready",
            attemptId: null,
            operationId: null,
            authorityBindingId: null,
            startPhase: "none",
            cleanupConfirmed: false,
            recoveryObligations: [],
            recoveryUnresolved: false,
            candidateId: null,
            retryCount: 0,
            supersededBy: null,
          },
        ],
      } as ProjectExecutionState,
    } as const;
    assert.equal(projectFixture.status, "completed");
    if (projectFixture.status !== "completed")
      throw new Error("project_fixture_invalid");
    const initialTask = projectFixture.state.tasks[0];
    assert.ok(initialTask);
    const {
      cleanupConfirmed: _cleanup,
      recoveryUnresolved: _unresolved,
      ...storedRecord
    } = initialTask;
    const boundTask = {
      ...storedRecord,
      state: "completed",
      attemptId: "attempt-a",
      operationId: identity.recoveryCorrelationId,
      authorityBindingId: "authority-a",
      startPhase: "settled",
      settlement: {
        kind: "operations",
        recoveryIds: [recoveryId],
        resultUnresolved: false,
      },
    };
    const { managedExecutions: _emptyManaged, ...emptyDefinitionFixture } =
      emptyExecutionStateSnapshot();
    const unifiedTerminal = {
      ...emptyDefinitionFixture,
      repositoryBindingId: "binding-a",
      operations: [closedHost, terminalOperation],
      projects: [{ ...projectFixture.state, tasks: [boundTask] }],
    };
    /**
     * 相関反証の単一状態を正規bytesへ固定する。
     * @responsibility 現行Schemaの値と実codecを使い、旧形を補完しない。
     * @trace PRL-UT-006
     * @precondition 自己生成の純粋状態値。
     * @stimulus 不正相関又は正常値を正規codecへ渡す。
     * @observation 遷移検査へ渡す正規bytes。
     * @oracle 相関不正・旧形式を成功へ畳まない。
     * @cleanup N/A: 局所値のみ。
     * @boundary 保存モデルの純粋試験。物理保存・実行なし。
     */
    const encodeUnified = (value: unknown) =>
      Buffer.from(
        `${encodeStateValue(createManagedRuntimeSnapshotFixture(value))}\n`,
      );
    const unifiedBefore = encodeUnified(unifiedTerminal);
    assert.ok(decodeStateSnapshot(unifiedBefore, binding));
    for (const taskUnresolved of [false, true]) {
      const unresolved = {
        ...unifiedTerminal,
        unresolvedRecoveries: [
          {
            operationNonce: nonce,
            recoveryId,
            reason: terminalOperation.outcome.reason,
            obligations: ["docker_resources"],
          },
        ],
        projects: [
          {
            ...projectFixture.state,
            tasks: [
              {
                ...boundTask,
                state: "recovery_required",
                settlement: {
                  ...boundTask.settlement,
                  resultUnresolved: taskUnresolved,
                },
                recoveryObligations: [
                  { kind: "docker", recoveryId, phase: "required" },
                ],
              },
            ],
          },
        ],
      };
      const before = encodeUnified(unresolved);
      const view = decodeStateSnapshot(before, binding)?.projects[0];
      assert.ok(view);
      assert.equal(view.tasks[0]?.recoveryUnresolved, taskUnresolved);
      const candidate = prepareUnifiedTaskSnapshot(
        before,
        { ...view, generation: view.generation + 1 },
        view.generation,
        binding,
      );
      assert.ok(candidate);
      const saved = decodeStateSnapshot(candidate, binding)?.snapshot;
      assert.ok(saved);
      assert.deepEqual(saved.managedExecutions[0]?.tasks[0]?.settlement, {
        kind: "operations",
        recoveryIds: [recoveryId],
        resultUnresolved: taskUnresolved,
      });
      const changedFact = prepareUnifiedTaskSnapshot(
        before,
        {
          ...view,
          generation: view.generation + 1,
          tasks: view.tasks.map((task) => ({
            ...task,
            cleanupConfirmed: taskUnresolved,
            recoveryUnresolved: !taskUnresolved,
          })),
        },
        view.generation,
        binding,
        [
          {
            taskId: "task-a",
            attemptId: "attempt-a",
            operationId: identity.recoveryCorrelationId,
            recoveryUnresolved: !taskUnresolved,
          },
        ],
      );
      assert.ok(changedFact);
      assert.deepEqual(
        decodeStateSnapshot(changedFact, binding)?.snapshot.managedExecutions[0]
          ?.tasks[0]?.settlement,
        {
          kind: "operations",
          recoveryIds: [recoveryId],
          resultUnresolved: !taskUnresolved,
        },
      );
      for (const facts of [
        [
          {
            taskId: "other-task",
            attemptId: "attempt-a",
            operationId: identity.recoveryCorrelationId,
            recoveryUnresolved: true,
          },
        ],
        [
          {
            taskId: "task-a",
            attemptId: "other-attempt",
            operationId: identity.recoveryCorrelationId,
            recoveryUnresolved: true,
          },
        ],
        [
          {
            taskId: "task-a",
            attemptId: "attempt-a",
            operationId: "other-operation",
            recoveryUnresolved: true,
          },
        ],
      ])
        assert.equal(
          prepareUnifiedTaskSnapshot(
            before,
            { ...view, generation: view.generation + 1 },
            view.generation,
            binding,
            facts,
          ),
          null,
        );
      const resolved = decodeStateSnapshot(
        encodeUnified({ ...saved, unresolvedRecoveries: [] }),
        binding,
      );
      assert.ok(resolved);
      assert.equal(
        resolved.projects[0]?.tasks[0]?.recoveryUnresolved,
        taskUnresolved,
      );
    }
    {
      const secondIdentity = {
        ...identity,
        operationNonce: "d".repeat(64),
        operationId: "OP-654321",
        stableLogicalHomeBindingHash: "e".repeat(64),
        ownershipLabel: "crdd.coordinator.runtime=fedcba9876543210",
      };
      const recoveryRoot = {
        ...unifiedTerminal,
        operations: [
          closedHost,
          {
            ...host,
            operationId: "OP-654321",
            recoveryId: "host-operation.OP-654321",
          },
          terminalOperation,
        ],
        projects: [
          {
            ...projectFixture.state,
            tasks: [
              {
                ...boundTask,
                state: "recovery_required",
                recoveryObligations: [
                  { kind: "docker", recoveryId, phase: "required" },
                ],
              },
            ],
          },
        ],
      };
      const registered = prepareStateOperationSnapshot(
        encodeUnified(recoveryRoot),
        `${JSON.stringify(secondIdentity)}\n`,
        binding,
      );
      assert.ok(registered);
      const physical = JSON.parse(registered.toString());
      const second = physical.operations.find(
        (item: { kind: string; identityJson: string }) =>
          item.kind === "docker_task" &&
          JSON.parse(item.identityJson).operationId ===
            secondIdentity.operationId,
      );
      assert.ok(second);
      second.resources = createResourceBookFixture(
        secondIdentity.ownershipLabel,
        "planned",
        RESOURCE_KEYS,
      );
      second.phase = "settling";
      second.lease = "released";
      second.execution = terminalOperation.execution;
      second.outcome = terminalOperation.outcome;
      Object.assign(
        physical.operations.find(
          (item: { kind: string; operationId: string }) =>
            item.kind === "host_operation" &&
            item.operationId === secondIdentity.operationId,
        ),
        { phase: "terminal", cleanup: "confirmed" },
      );
      physical.managedExecutions[0].tasks[0].recoveryObligations.push({
        kind: "docker",
        recoveryId: second.recoveryId,
        phase: "required",
      });
      let multi: Buffer = encodeUnified(physical);
      for (const confirmed of [false, true]) {
        const checkpoint = prepareStateHistorySnapshot(
          multi,
          second.recoveryId,
          occurredAt,
          confirmed,
          binding,
        );
        assert.ok(checkpoint);
        multi = checkpoint;
      }
      const decoded = decodeStateSnapshot(multi, binding);
      const view = decoded?.projects[0];
      assert.ok(decoded && view);
      const finalization = captureTaskExecutionUpdate({
        kind: "task_recovery_finalize",
        projectId: view.projectId,
        recoveries: view.tasks.flatMap((task) =>
          task.recoveryObligations
            .filter((item) => item.kind === "docker")
            .map(({ recoveryId }) => ({
              taskId: task.definition.id,
              recoveryId,
            })),
        ),
      });
      assert.ok(finalization);
      const candidate = prepareTaskExecutionUpdate(
        view,
        view.generation,
        finalization,
      );
      assert.equal(candidate.status, "completed");
      const proposed = candidate.state;
      assert.deepEqual(proposed, { ...view, generation: view.generation + 1 });
      const completed = prepareUnifiedTaskSnapshot(
        multi,
        proposed,
        view.generation,
        binding,
      );
      assert.ok(completed, "同じTaskの全技術終端をTask保存と同時に整理する");
      const saved = decodeStateSnapshot(completed, binding);
      assert.ok(saved);
      assert.deepEqual(
        saved.snapshot.operations,
        physical.operations.filter(
          (item: { kind: string }) => item.kind === "host_operation",
        ),
      );
      assert.equal(
        saved.snapshot.managedExecutions[0]?.tasks[0]?.settlement.kind,
        "executor_result",
      );
      assert.equal(
        saved.projects[0]?.tasks[0]?.recoveryObligations.every(
          (item) => item.phase === "settled",
        ),
        true,
      );
      for (const operation of decoded.snapshot.operations) {
        if (operation.kind !== "docker_task") continue;
        const unconfirmed: unknown = {
          ...decoded.snapshot,
          operations: decoded.snapshot.operations.map((item) =>
            item.kind === "docker_task" &&
            item.recoveryId === operation.recoveryId
              ? { ...item, history: { ...item.history, confirmed: false } }
              : item,
          ),
        };
        assert.equal(
          prepareUnifiedTaskSnapshot(
            encodeUnified(unconfirmed),
            proposed,
            view.generation,
            binding,
          ),
          null,
          "一つでも未確認なら一部だけ除去しない",
        );
      }
      const changedAttempt = {
        ...proposed,
        tasks: proposed.tasks.map((task) => ({
          ...task,
          attemptId: "other-attempt",
        })),
      };
      assert.equal(
        prepareUnifiedTaskSnapshot(
          multi,
          changedAttempt,
          view.generation,
          binding,
        ),
        null,
      );
      const omittedBoundTask = {
        ...proposed,
        tasks: proposed.tasks.map((task) => ({
          ...task,
          definition: { ...task.definition, id: "different-task" },
        })),
      };
      assert.equal(validState(omittedBoundTask), true);
      assert.equal(
        prepareUnifiedTaskSnapshot(
          multi,
          omittedBoundTask,
          view.generation,
          binding,
        ),
        null,
        "Operationに結合したTaskを省略して単独Completionへ迂回できない",
      );
    }

    const acceptedUnified = {
      ...unifiedTerminal,
      revision: 2,
      previous: {
        revision: 1,
        payloadSha256: createHash("sha256").update(unifiedBefore).digest("hex"),
      },
      operations: [closedHost],
      projects: [
        {
          ...projectFixture.state,
          generation: 2,
          tasks: [
            {
              ...boundTask,
              settlement: {
                kind: "executor_result",
                cleanupConfirmed: true,
                recoveryUnresolved: false,
              },
            },
          ],
        },
      ],
    };
    assert.ok(decodeStateSnapshot(encodeUnified(acceptedUnified), binding));
    const acceptedState = decodeStateSnapshot(
      encodeUnified(acceptedUnified),
      binding,
    )?.projects[0];
    assert.ok(acceptedState);
    const taskPublication = prepareUnifiedTaskSnapshot(
      unifiedBefore,
      acceptedState,
      1,
      binding,
    );
    assert.ok(taskPublication);
    assert.ok(taskPublication.equals(encodeUnified(acceptedUnified)));
    const requiredLine = prepareStateHistoryLine(
      unifiedBefore,
      recoveryId,
      binding,
    );
    assert.ok(requiredLine);
    const afterRetentionPeriod = "2027-01-01T00:00:00.000Z";
    assert.deepEqual(
      prepareHistoryRetention(
        unifiedBefore,
        requiredLine,
        afterRetentionPeriod,
        30,
        binding,
      ),
      requiredLine,
      "確認済みでも未受領の結果に必要な履歴を期限整理しない",
    );
    assert.equal(
      prepareHistoryRetention(
        unifiedBefore,
        Buffer.alloc(0),
        afterRetentionPeriod,
        30,
        binding,
      ),
      null,
    );
    assert.deepEqual(
      prepareHistoryRetention(
        taskPublication,
        requiredLine,
        afterRetentionPeriod,
        30,
        binding,
      ),
      Buffer.alloc(0),
      "受領・操作除去後は通常の期限整理へ戻す",
    );
    const acceptedDecoded = decodeStateSnapshot(taskPublication, binding);
    assert.ok(acceptedDecoded);
    const receiptRetained = prepareUnifiedTaskSnapshot(
      taskPublication,
      { ...acceptedState, generation: 3 },
      2,
      binding,
    );
    assert.ok(receiptRetained);
    assert.deepEqual(
      decodeStateSnapshot(receiptRetained, binding)?.snapshot.operations,
      acceptedDecoded.snapshot.operations,
    );
    assert.equal(
      validateUnifiedTransition(
        unifiedBefore,
        encodeUnified(acceptedUnified),
        binding,
      ),
      true,
    );
    const unbound = {
      ...unifiedTerminal,
      projects: [
        {
          ...projectFixture.state,
          tasks: [
            {
              ...storedRecord,
              settlement: { kind: "pending" },
            },
          ],
        },
      ],
    };
    const unboundBytes = encodeUnified(unbound);
    assert.ok(decodeStateSnapshot(unboundBytes, binding));
    const wrongLogicalReceipt = {
      ...acceptedUnified,
      previous: {
        revision: 1,
        payloadSha256: createHash("sha256").update(unifiedBefore).digest("hex"),
      },
      projects: [
        {
          ...acceptedUnified.projects[0],
          tasks: [
            {
              ...acceptedUnified.projects[0]?.tasks[0],
              operationId: "another-logical-operation",
            },
          ],
        },
      ],
    };
    assert.ok(decodeStateSnapshot(encodeUnified(wrongLogicalReceipt), binding));
    assert.equal(
      validateUnifiedTransition(
        unifiedBefore,
        encodeUnified(wrongLogicalReceipt),
        binding,
      ),
      false,
    );
    for (const invalid of [
      { ...acceptedUnified, projects: unifiedTerminal.projects },
      { ...acceptedUnified, operations: unifiedTerminal.operations },
      { ...acceptedUnified, resultReceipts: [] },
      { ...acceptedUnified, pendingDeliveries: [] },
    ])
      assert.equal(
        validateUnifiedTransition(
          unifiedBefore,
          encodeUnified(invalid),
          binding,
        ),
        false,
      );
    const secondIdentityJson = `${JSON.stringify({ ...identity, operationNonce: "f".repeat(64), operationId: "OP-234567" })}\n`;
    const secondHost = {
      ...host,
      operationId: "OP-234567",
      recoveryId: "host-operation.OP-234567",
    };
    const secondBytes = prepareStateOperationSnapshot(
      Buffer.from(
        `${encodeStateValue({ ...empty, operations: [secondHost] })}\n`,
      ),
      secondIdentityJson,
      binding,
    );
    assert.ok(secondBytes);
    const second = decodeStateSnapshot(
      secondBytes,
      binding,
    )?.snapshot.operations.find((item) => item.kind === "docker_task");
    assert.ok(second);
    const withSecond = {
      ...unifiedTerminal,
      operations: [closedHost, secondHost, terminalOperation, second],
      projects: [
        {
          ...projectFixture.state,
          tasks: [
            {
              ...boundTask,
              state: "recovery_required",
              settlement: {
                kind: "operations",
                recoveryIds: [recoveryId, second.recoveryId],
                resultUnresolved: true,
              },
              recoveryObligations: [
                {
                  kind: "docker",
                  recoveryId: second.recoveryId,
                  phase: "required",
                },
              ],
            },
          ],
        },
      ],
    };
    assert.equal(
      decodeStateSnapshot(encodeUnified(withSecond), binding)?.projects[0]
        ?.tasks[0]?.recoveryObligations[0]?.phase,
      "required",
    );
    assert.equal(
      decodeStateSnapshot(
        encodeUnified({
          ...withSecond,
          projects: [
            {
              ...withSecond.projects[0],
              tasks: [
                {
                  ...withSecond.projects[0]?.tasks[0],
                  settlement: {
                    kind: "operations",
                    recoveryIds: [recoveryId],
                    resultUnresolved: true,
                  },
                },
              ],
            },
          ],
        }),
        binding,
      ),
      null,
    );
    for (const phase of ["settled", "acknowledged", "unknown"])
      assert.equal(
        decodeStateSnapshot(
          encodeUnified({
            ...withSecond,
            projects: [
              {
                ...withSecond.projects[0],
                tasks: [
                  {
                    ...withSecond.projects[0]?.tasks[0],
                    recoveryObligations: [
                      { kind: "docker", recoveryId: second.recoveryId, phase },
                    ],
                  },
                ],
              },
            ],
          }),
          binding,
        ),
        null,
      );
  }
  const operationFact = {
    kind: "operations",
    recoveryIds: [recoveryId],
    resultUnresolved: false,
  };
  assert.deepEqual(
    projectTaskSettlement(operationFact, {
      ...confirmedHistory.snapshot,
      operations: [closedHost, terminalOperation],
    }),
    { cleanupConfirmed: true, recoveryUnresolved: false },
  );
  for (const change of [
    { phase: "executing" },
    { outcome: null },
    { outcome: { ...terminalOperation.outcome, cleanupConfirmed: false } },
    { lease: "unknown" },
    { execution: { ...terminalOperation.execution, ownerEffect: "unknown" } },
    {
      dockerRestart: {
        requestId: limitedRestartId,
        scopeSha256: "f".repeat(64),
        request: "issued",
        cleanup: "unknown",
        result: null,
      },
    },
    {
      resources: createResourceBookFixture(
        identity.ownershipLabel,
        "unknown",
        RESOURCE_KEYS,
      ),
    },
  ] satisfies readonly Partial<ExecutionOperationRecord>[]) {
    assert.deepEqual(
      projectTaskSettlement(operationFact, {
        ...confirmedHistory.snapshot,
        operations: [closedHost, { ...terminalOperation, ...change }],
      }),
      { cleanupConfirmed: false, recoveryUnresolved: false },
      JSON.stringify(change),
    );
  }
  for (const id of [recoveryId, "unrelated-recovery"] as const) {
    assert.deepEqual(
      projectTaskSettlement(operationFact, {
        ...confirmedHistory.snapshot,
        unresolvedRecoveries: [
          {
            operationNonce: nonce,
            recoveryId: id,
            reason: "provider_operation_completed",
            obligations: ["docker_resources"],
          },
        ],
      }),
      { cleanupConfirmed: true, recoveryUnresolved: false },
    );
  }
  const goldenTaskLine = `{"occurredAt":"2026-10-08T00:00:00.000Z","schema":"crdd-execution-model/history-row/v3","summary":{"execution":{"externalSend":"unknown","ownerEffect":"disabled","providerStart":"unknown","sharedWrite":"unknown","workspaceReusable":false},"identitySha256":"${identitySha256}","lease":"released","operationId":"OP-123456","operationNonce":"${nonce}","outcome":{"cleanupConfirmed":true,"reason":"provider_operation_completed","status":"completed"},"primaryFailure":null,"recoveryCorrelationId":"task-operation-a","recoveryId":"${recoveryId}","schema":"crdd-execution-model/operation-summary/v7"}}\n`;
  assert.equal(historyLine.toString("utf8"), goldenTaskLine);
  assert.equal(
    createHash("sha256").update(historyLine).digest("hex"),
    createHash("sha256").update(goldenTaskLine).digest("hex"),
  );
  const rows = decodeHistoryRows(historyLine);
  assert.ok(rows);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.recoveryId, recoveryId);
  assert.equal(rows[0]?.lineSha256, pendingOperation.history.lineSha256);
  assert.equal(rows[0]?.summarySha256, pendingOperation.summarySha256);
  const restartHistoryCheckpoint = {
    requestId: createDockerRestartRequestId(
      binding,
      identitySha256,
      recoveryId,
      "f".repeat(64),
    ),
    scopeSha256: "f".repeat(64),
    request: "issued",
    cleanup: "confirmed",
    result: {
      status: "blocked",
      reason: "docker_restart_start_unconfirmed",
      request: "issued",
      effectOutcomeUnknown: false,
    },
  };
  const restartHistoryRow = JSON.parse(goldenTaskLine);
  restartHistoryRow.summary.dockerRestart = restartHistoryCheckpoint;
  const restartHistoryLine = Buffer.from(
    `${encodeStateValue(restartHistoryRow)}\n`,
  );
  const restartHistoryRows = decodeHistoryRows(restartHistoryLine);
  assert.ok(restartHistoryRows);
  const v4Restart = structuredClone(restartHistoryRow);
  v4Restart.summary.schema = "crdd-coordinator/operation-summary/v4";
  v4Restart.summary.consumer = "workbench";
  v4Restart.summary.recoveryCorrelationId = "operation-a";
  assert.equal(
    decodeHistoryRows(Buffer.from(`${encodeStateValue(v4Restart)}\n`)),
    null,
  );
  for (const checkpoint of [
    null,
    { ...restartHistoryCheckpoint, cleanup: "unknown" },
    { unexpected: true },
  ]) {
    const invalid = structuredClone(restartHistoryRow);
    invalid.summary.dockerRestart = checkpoint;
    assert.equal(
      decodeHistoryRows(Buffer.from(`${encodeStateValue(invalid)}\n`)),
      null,
    );
  }
  assert.notEqual(restartHistoryRows[0]?.summarySha256, rows[0]?.summarySha256);
  assert.equal(
    prepareRecoveredHistoryPublication(
      pendingHistoryBytes,
      recoveryId,
      restartHistoryLine,
      null,
      30,
      binding,
    ),
    null,
    "固定済み要約へ異なる再起動情報の履歴を再結合しない",
  );
  for (const checkpoint of [
    null,
    { ...restartHistoryCheckpoint, result: null },
    { ...restartHistoryCheckpoint, cleanup: "unknown" },
    { ...restartHistoryCheckpoint, request: "unknown" },
    {
      ...restartHistoryCheckpoint,
      result: {
        ...restartHistoryCheckpoint.result,
        effectOutcomeUnknown: true,
      },
    },
    {
      ...restartHistoryCheckpoint,
      result: { ...restartHistoryCheckpoint.result, status: "completed" },
    },
  ]) {
    const row = structuredClone(restartHistoryRow);
    row.summary.dockerRestart = checkpoint;
    assert.equal(
      decodeHistoryRows(Buffer.from(`${encodeStateValue(row)}\n`)),
      null,
    );
  }
  for (const mutation of ["missing", "v2", "extra"]) {
    const row = structuredClone(restartHistoryRow);
    if (mutation === "missing") delete row.summary.recoveryCorrelationId;
    else if (mutation === "v2")
      row.summary.schema = "crdd-coordinator/operation-summary/v2";
    else row.summary.extra = true;
    assert.equal(
      decodeHistoryRows(Buffer.from(`${encodeStateValue(row)}\n`)),
      null,
    );
  }
  for (const [canonical, pending, changed] of [
    [Buffer.alloc(0), null, true],
    [Buffer.alloc(0), historyLine, true],
    [historyLine, null, false],
    [historyLine, historyLine, false],
  ] as const) {
    const publication = prepareRecoveredHistoryPublication(
      pendingHistoryBytes,
      recoveryId,
      canonical,
      pending,
      30,
      binding,
    );
    assert.ok(publication);
    assert.deepEqual(publication.historyBytes, historyLine);
    assert.deepEqual(publication.snapshotBytes, confirmedHistoryBytes);
    assert.equal(publication.historyChanged, changed);
    assert.deepEqual(
      prepareRecoveredHistoryPublication(
        pendingHistoryBytes,
        recoveryId,
        canonical,
        pending,
        30,
        binding,
      ),
      publication,
    );
  }
  const currentRow = JSON.parse(historyLine.toString());
  let bufferEvaluations = 0;
  for (const role of ["canonical", "pending"] as const) {
    for (const behavior of ["true", "false", "throw", "getter"] as const) {
      const hostile: Buffer =
        role === "canonical" ? Buffer.alloc(0) : Buffer.from(historyLine);
      const originalView: Uint8Array = new Uint8Array(
        hostile.buffer,
        hostile.byteOffset,
        hostile.byteLength,
      );
      const originalBytes: number[] = Array.from(originalView);
      for (const property of [
        "buffer",
        "byteOffset",
        "byteLength",
        "length",
        Symbol.iterator,
      ])
        Object.defineProperty(hostile, property, {
          configurable: true,
          get() {
            bufferEvaluations++;
            throw new Error("not_evaluated");
          },
        });
      Object.defineProperty(
        hostile,
        "equals",
        behavior === "getter"
          ? {
              configurable: true,
              get() {
                bufferEvaluations++;
                throw new Error("not_evaluated");
              },
            }
          : {
              configurable: true,
              value() {
                bufferEvaluations++;
                if (behavior === "throw") throw new Error("not_evaluated");
                return behavior === "true";
              },
            },
      );
      const descriptors: PropertyDescriptorMap =
        Object.getOwnPropertyDescriptors(hostile);
      const result = prepareRecoveredHistoryPublication(
        pendingHistoryBytes,
        recoveryId,
        role === "canonical" ? hostile : Buffer.alloc(0),
        role === "pending" ? hostile : null,
        30,
        binding,
      );
      assert.ok(result);
      assert.deepEqual(result.historyBytes, historyLine);
      assert.deepEqual(Array.from(originalView), originalBytes);
      assert.deepEqual(Object.getOwnPropertyDescriptors(hostile), descriptors);
    }
  }
  const falsePending = Buffer.from("different\n");
  Object.defineProperty(falsePending, "equals", {
    value() {
      bufferEvaluations++;
      return true;
    },
  });
  assert.equal(
    prepareRecoveredHistoryPublication(
      pendingHistoryBytes,
      recoveryId,
      Buffer.alloc(0),
      falsePending,
      30,
      binding,
    ),
    null,
  );
  const proxyBuffer = new Proxy(Buffer.from(historyLine), {
    get() {
      bufferEvaluations++;
      throw new Error("not_evaluated");
    },
    getPrototypeOf() {
      bufferEvaluations++;
      throw new Error("not_evaluated");
    },
  });
  for (const [canonical, pending] of [
    [proxyBuffer, null],
    [Buffer.alloc(0), proxyBuffer],
    [Buffer.alloc(16 * 1024 * 1024 + 1), null],
    [Buffer.alloc(0), Buffer.alloc(16 * 1024 * 1024 + 1)],
  ])
    assert.equal(
      prepareRecoveredHistoryPublication(
        pendingHistoryBytes,
        recoveryId,
        canonical,
        pending,
        30,
        binding,
      ),
      null,
    );
  assert.equal(bufferEvaluations, 0);
  const priorNonce = "7".repeat(64);
  const priorRow = {
    ...currentRow,
    occurredAt: new Date(Date.parse(occurredAt) - 31 * 86400000).toISOString(),
    summary: {
      ...currentRow.summary,
      operationNonce: priorNonce,
      recoveryId: `docker-task.${identity.stableLogicalHomeBindingHash}.${priorNonce}.${identitySha256}`,
      operationId: "OP-999999",
    },
  };
  const priorLine = Buffer.from(`${encodeStateValue(priorRow)}\n`);
  assert.ok(decodeHistoryRows(priorLine));
  const retainedPublication = prepareRecoveredHistoryPublication(
    pendingHistoryBytes,
    recoveryId,
    priorLine,
    historyLine,
    30,
    binding,
  );
  assert.ok(retainedPublication);
  assert.deepEqual(retainedPublication.historyBytes, historyLine);
  assert.equal(
    prepareRecoveredHistoryPublication(
      pendingHistoryBytes,
      recoveryId,
      priorLine,
      historyLine,
      60,
      binding,
    ),
    null,
  );
  for (const [bytes, id, canonical, pending, days, root] of [
    [historyBytes, recoveryId, Buffer.alloc(0), null, 30, binding],
    [confirmedHistoryBytes, recoveryId, historyLine, null, 30, binding],
    [pendingHistoryBytes, "different", Buffer.alloc(0), null, 30, binding],
    [pendingHistoryBytes, recoveryId, Buffer.alloc(0), null, 30, "wrong-root"],
    [pendingHistoryBytes, recoveryId, Buffer.alloc(0), null, 0, binding],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.concat([historyLine, historyLine]),
      null,
      30,
      binding,
    ],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.from("invalid\n"),
      null,
      30,
      binding,
    ],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.alloc(0),
      Buffer.alloc(0),
      30,
      binding,
    ],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.alloc(0),
      Buffer.concat([historyLine, priorLine]),
      30,
      binding,
    ],
    [pendingHistoryBytes, recoveryId, Buffer.alloc(0), undefined, 30, binding],
    [pendingHistoryBytes, recoveryId, Buffer.alloc(0), "pending", 30, binding],
    [
      pendingHistoryBytes,
      recoveryId,
      Buffer.from(
        `${encodeStateValue({ ...currentRow, occurredAt: new Date(Date.parse(occurredAt) + 1).toISOString() })}\n`,
      ),
      null,
      30,
      binding,
    ],
  ])
    assert.equal(
      prepareRecoveredHistoryPublication(
        bytes,
        id,
        canonical,
        pending,
        days,
        root,
      ),
      null,
    );
  assert.deepEqual(decodeHistoryRows(Buffer.alloc(0)), []);
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
  ) => prepareHistoryRetention(bytes, history, now, days, binding);
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
    historyLine,
    "現在のOperationが参照している間は終端行を保持する",
  );
  const noLongerCurrent = prepareStateCompletionSnapshot(
    knownConfirmed,
    recoveryId,
    binding,
  );
  assert.ok(noLongerCurrent);
  assert.deepEqual(
    retain(noLongerCurrent, historyLine, afterCutoff, 30),
    Buffer.alloc(0),
  );
  assert.deepEqual(
    retain(pendingHistoryBytes, historyLine, afterCutoff, 30),
    historyLine,
  );
  assert.equal(
    retain(confirmedHistoryBytes, Buffer.alloc(0), afterCutoff, 30),
    null,
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
    Buffer.from(`${encodeStateValue({ ...row, extra: true })}\n`),
    Buffer.from(`${encodeStateValue({ ...row, occurredAt: "invalid" })}\n`),
    Buffer.from(
      `${encodeStateValue({ ...row, summary: { ...row.summary, operationNonce: "0".repeat(64) } })}\n`,
    ),
    Buffer.from(
      `${encodeStateValue({ ...row, summary: { ...row.summary, outcome: { ...row.summary.outcome, cleanupConfirmed: false } } })}\n`,
    ),
    Buffer.from(
      `${encodeStateValue({ ...row, summary: { ...row.summary, primaryFailure: { stage: "unknown" } } })}\n`,
    ),
  ]) {
    assert.equal(decodeHistoryRows(malformed), null);
    assert.equal(
      retain(confirmedHistoryBytes, malformed, afterCutoff, 30),
      null,
    );
  }
  const differentLine = Buffer.from(
    `${encodeStateValue({ ...row, occurredAt: afterCutoff })}\n`,
  );
  assert.ok(decodeHistoryRows(differentLine));
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
    prepareStateHistoryLine(confirmedHistoryBytes, recoveryId, binding),
    historyLine,
  );
  for (const [bytes, id, root] of [
    [historyBytes, recoveryId, binding],
    [pendingHistoryBytes, "other-recovery", binding],
    [pendingHistoryBytes, recoveryId, "wrong-root"],
  ]) {
    assert.equal(prepareStateHistoryLine(bytes, id, root), null);
  }
  for (const [date, confirmed] of [
    ["2026-10-09T00:00:00.000Z", true],
    [occurredAt, false],
    ["2026-10-08", true],
    ["invalid", true],
  ] as const)
    assert.equal(
      prepareStateHistorySnapshot(
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
      decodeStateSnapshot(
        Buffer.from(
          `${encodeStateValue({ ...pendingHistory.snapshot, operations: [host, changed] })}\n`,
        ),
        binding,
      ),
      null,
    );
  assert.deepEqual(
    historyBytes,
    Buffer.from(`${encodeStateValue(historyState)}\n`),
  );
  const prepared = prepareStateOperationSnapshot(
    hostBefore,
    identityJson,
    binding,
  );
  assert.ok(prepared);
  const restartScope = "e".repeat(64);
  const restartRequest = {
    requestId: createDockerRestartRequestId(
      binding,
      identitySha256,
      recoveryId,
      restartScope,
    ),
    scopeSha256: restartScope,
    request: "not_issued",
    cleanup: "not_required",
    result: null,
  };
  const restartInitial = prepareStateRestartSnapshot(
    prepared,
    recoveryId,
    restartRequest,
    binding,
  );
  assert.ok(restartInitial);
  const restartSnapshot = decodeStateSnapshot(restartInitial, binding);
  assert.ok(restartSnapshot);
  const beforeRestart = decodeStateSnapshot(prepared, binding);
  assert.ok(beforeRestart);
  assert.deepEqual(
    restartSnapshot.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    ),
    {
      ...beforeRestart.snapshot.operations.find(
        (item) => item.kind === "docker_task",
      ),
      dockerRestart: restartRequest,
    },
  );
  assert.deepEqual(restartSnapshot.snapshot.previous, {
    revision: beforeRestart.snapshot.revision,
    payloadSha256: beforeRestart.payloadSha256,
  });
  for (const key of RESOURCE_KEYS) {
    const frame = {
      snapshot: resourceFrame.snapshot,
      cleanup: resourceFrame.cleanup,
      key,
    };
    const intent = prepareStateResourceSnapshot(
      prepared,
      recoveryId,
      { ...frame, event: "submission" },
      binding,
    );
    assert.ok(intent);
    assert.equal(
      prepareStateResourceSnapshot(
        restartInitial,
        recoveryId,
        { ...frame, event: "submission" },
        binding,
      ),
      null,
    );
    const initialized = prepareStateRestartSnapshot(
      intent,
      recoveryId,
      restartRequest,
      binding,
    );
    assert.ok(initialized);
    const receiptFrame = {
      ...frame,
      snapshot: {
        resources: frame.snapshot.resources.map((r) =>
          r.key === key
            ? {
                ...r,
                request: "issued" as const,
                identity: { ...r.identity, dockerId: "d".repeat(64) },
              }
            : r,
        ),
      },
    };
    const identified = prepareStateResourceSnapshot(
      initialized,
      recoveryId,
      { ...receiptFrame, event: "identified" },
      binding,
    );
    assert.ok(identified);
    const identifiedState = decodeStateSnapshot(identified, binding);
    const task = identifiedState?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    );
    assert.ok(task?.kind === "docker_task" && task.resources);
    const observations = task.resources.checkpoints.map((c) => ({
      key: c.key,
      observation: c.key === key ? "absent" : "not_requested",
    }));
    assert.ok(
      prepareStateCleanupSnapshot(
        identified,
        recoveryId,
        { snapshot: task.resources.snapshot, observations },
        binding,
      ),
    );
    const progressed = decodeStateSnapshot(intent, binding);
    assert.ok(progressed);
    const simultaneous = Buffer.from(
      `${encodeStateValue({
        ...progressed.snapshot,
        operations: progressed.snapshot.operations.map((op) =>
          op.kind === "docker_task"
            ? {
                ...op,
                dockerRestart: restartRequest,
              }
            : op,
        ),
      })}\n`,
    );
    assert.equal(
      validateStateTransition(prepared, simultaneous, binding),
      false,
      "再起動と新Intentを同時確定しない",
    );
  }
  for (const value of [
    { ...restartRequest, requestId: "f".repeat(64) },
    { ...restartRequest, scopeSha256: "f".repeat(64) },
    { ...restartRequest, request: "issued" },
    { ...restartRequest, extra: true },
  ])
    assert.equal(
      prepareStateRestartSnapshot(prepared, recoveryId, value, binding),
      null,
    );
  const restartPending = prepareStateRestartSnapshot(
    restartInitial,
    recoveryId,
    { ...restartRequest, request: "unknown", cleanup: "pending" },
    binding,
  );
  assert.ok(restartPending);
  assert.equal(
    prepareStateRestartSnapshot(
      restartPending,
      recoveryId,
      restartRequest,
      binding,
    ),
    null,
  );
  assert.equal(
    prepareStateRestartSnapshot(restartInitial, recoveryId, null, binding),
    null,
  );
  for (const invalidIdentity of [
    { ...identity, consumer: undefined },
    { ...identity, consumer: "invalid consumer" },
    { ...identity, consumer: { consumer: "coordinator" } },
    { ...identity, completionPolicy: "transient" },
    { ...identity, schema: "crdd-coordinator-task-docker-recovery/v1" },
    { ...identity, repositoryBinding: "f".repeat(64) },
    { ...identity, runtimeStateBinding: {} },
    { ...identity, repositoryBinding: undefined },
    { ...identity, providerHomeIdentityHash: "invalid" },
    { ...identity, initialHostRecoveryId: "invalid" },
    { ...identity, resources: { auth: "invalid" } },
  ]) {
    assert.equal(
      prepareStateOperationSnapshot(
        null,
        `${JSON.stringify(invalidIdentity)}\n`,
        binding,
      ),
      null,
    );
  }
  const preparedState = decodeStateSnapshot(prepared, binding);
  assert.ok(preparedState);
  for (const consumer of [
    "coordinator_cli",
    "coordinator",
    "workbench",
    "custom_client",
  ]) {
    const consumerIdentity = `${JSON.stringify({ ...identity, consumer })}\n`;
    const consumerSnapshot = prepareStateOperationSnapshot(
      hostBefore,
      consumerIdentity,
      binding,
    );
    assert.ok(consumerSnapshot);
    const consumerState = decodeStateSnapshot(consumerSnapshot, binding);
    assert.ok(consumerState);
    const consumerOperation = consumerState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    );
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
        validateStateTransition(
          prepared,
          Buffer.from(`${encodeStateValue(replacement)}\n`),
          binding,
        ),
        false,
      );
    }
  }
  const initialOperation = preparedState.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.equal(initialOperation?.recoveryId, recoveryId);
  assert.equal(initialOperation?.phase, "executing");
  assert.equal(initialOperation?.lease, "held");
  assert.ok(initialOperation);
  assert.equal(initialOperation.resources, null);
  const frame = {
    snapshot: resourceFrame.snapshot,
    cleanup: resourceFrame.cleanup,
    key: "create_provider",
  };
  const intent = prepareStateResourceSnapshot(
    prepared,
    recoveryId,
    { ...frame, event: "submission" },
    binding,
  );
  assert.ok(intent);
  const directReceipt = {
    ...frame,
    event: "receipt",
    snapshot: {
      resources: frame.snapshot.resources.map((r) =>
        r.key === frame.key
          ? {
              ...r,
              request: "issued" as const,
              identity: { ...r.identity, dockerId: "d".repeat(64) },
            }
          : r,
      ),
    },
  };
  const receiptCandidate = prepareStateResourceSnapshot(
    intent,
    recoveryId,
    directReceipt,
    binding,
  );
  assert.ok(receiptCandidate);
  assert.equal(
    classifyResourcePublication(intent, receiptCandidate, recoveryId, binding),
    "publish_pending",
  );
  assert.equal(
    classifyResourcePublication(
      receiptCandidate,
      receiptCandidate,
      recoveryId,
      binding,
    ),
    "remove_pending",
  );
  for (const [before, candidate, id, repository] of [
    [prepared, receiptCandidate, recoveryId, binding],
    [intent, receiptCandidate, "wrong", binding],
    [intent, receiptCandidate, recoveryId, "b".repeat(64)],
    [intent, Buffer.from("invalid"), recoveryId, binding],
    [null, receiptCandidate, recoveryId, binding],
    [
      intent,
      Buffer.from(JSON.stringify(JSON.parse(receiptCandidate.toString()))),
      recoveryId,
      binding,
    ],
  ])
    assert.equal(
      classifyResourcePublication(before, candidate, id, repository),
      null,
    );
  const alteredPublication = JSON.parse(receiptCandidate.toString());
  alteredPublication.operations.find(
    (item: { kind: string }) => item.kind === "docker_task",
  ).execution.externalSend = "unknown";
  assert.equal(
    classifyResourcePublication(
      intent,
      Buffer.from(`${encodeStateValue(alteredPublication)}\n`),
      recoveryId,
      binding,
    ),
    null,
  );
  const notIssued = prepareStateResourceSnapshot(
    intent,
    recoveryId,
    { event: "not_issued", key: frame.key },
    binding,
  );
  assert.ok(notIssued);
  assert.equal(
    prepareStateResourceSnapshot(
      receiptCandidate,
      recoveryId,
      { event: "not_issued", key: frame.key },
      binding,
    ),
    null,
  );
  for (const invalid of [
    { ...directReceipt, extra: true },
    { ...directReceipt, key: "other" },
    {
      ...directReceipt,
      snapshot: {
        resources: directReceipt.snapshot.resources.map((r) =>
          r.key === frame.key
            ? { ...r, identity: { ...r.identity, dockerId: "e".repeat(64) } }
            : r,
        ),
      },
    },
    { ...frame, event: "submission" },
    { event: "unknown", key: frame.key },
  ])
    assert.equal(
      prepareStateResourceSnapshot(
        receiptCandidate,
        recoveryId,
        invalid,
        binding,
      ),
      null,
    );
  assert.equal(
    prepareStateResourceSnapshot(prepared, recoveryId, directReceipt, binding),
    null,
    "Receipt前にIntent必須",
  );
  const identifiedState = decodeStateSnapshot(receiptCandidate, binding);
  const identifiedOperation = identifiedState?.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(
    identifiedOperation?.kind === "docker_task" &&
      identifiedOperation.resources,
  );
  const cleanupPayload = {
    snapshot: identifiedOperation.resources.snapshot,
    observations: identifiedOperation.resources.checkpoints.map((c) => ({
      key: c.key,
      observation: c.key === frame.key ? "absent" : "not_requested",
    })),
  };
  const cleanupBytes = prepareStateCleanupSnapshot(
    receiptCandidate,
    recoveryId,
    cleanupPayload,
    binding,
  );
  assert.ok(cleanupBytes);
  const cleanupState = decodeStateSnapshot(cleanupBytes, binding);
  const cleanupTask = cleanupState?.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(cleanupTask?.kind === "docker_task" && cleanupTask.resources);
  assert.equal(
    cleanupTask.resources.checkpoints.find((c) => c.key === frame.key)
      ?.receiptSource,
    "docker_create_result",
  );
  assert.equal(
    cleanupTask.resources.checkpoints.find((c) => c.key === frame.key)
      ?.observation,
    "absent",
  );
  assert.deepEqual(
    cleanupTask.resources.snapshot,
    identifiedOperation.resources.snapshot,
  );
  for (const invalid of [
    { ...cleanupPayload, observations: cleanupPayload.observations.slice(1) },
    {
      ...cleanupPayload,
      observations: cleanupPayload.observations.map(
        () => cleanupPayload.observations[0],
      ),
    },
    {
      ...cleanupPayload,
      observations: [
        ...cleanupPayload.observations,
        cleanupPayload.observations[0],
      ],
    },
    {
      ...cleanupPayload,
      snapshot: {
        resources: cleanupPayload.snapshot.resources.map((r) =>
          r.key === frame.key
            ? { ...r, identity: { ...r.identity, dockerId: "e".repeat(64) } }
            : r,
        ),
      },
    },
    {
      ...cleanupPayload,
      snapshot: {
        resources: cleanupPayload.snapshot.resources.map((r) =>
          r.key === frame.key
            ? {
                ...r,
                identity: {
                  ...r.identity,
                  ownershipLabel: "crdd.owner=foreign",
                },
              }
            : r,
        ),
      },
    },
  ])
    assert.equal(
      prepareStateCleanupSnapshot(
        receiptCandidate,
        recoveryId,
        invalid,
        binding,
      ),
      null,
    );
  let getterCalls = 0;
  const hostileResource = Object.defineProperty({}, "event", {
    enumerable: true,
    get() {
      getterCalls++;
      return "submission";
    },
  });
  assert.equal(
    prepareStateResourceSnapshot(
      prepared,
      recoveryId,
      hostileResource,
      binding,
    ),
    null,
  );
  const hostileCleanup = Object.defineProperty({}, "observations", {
    enumerable: true,
    get() {
      getterCalls++;
      return [];
    },
  });
  assert.equal(
    prepareStateCleanupSnapshot(
      receiptCandidate,
      recoveryId,
      hostileCleanup,
      binding,
    ),
    null,
  );
  assert.equal(getterCalls, 0);
  const secondIdentityJson = `${JSON.stringify({
    ...identity,
    operationNonce: "0".repeat(64),
    operationId: "OP-654321",
    stableLogicalHomeBindingHash: "e".repeat(64),
  })}\n`;
  const secondHost = {
    ...host,
    operationId: "OP-654321",
    recoveryId: "host-operation.OP-654321",
  };
  const secondAdmission = Buffer.from(
    `${encodeStateValue({ ...preparedState.snapshot, operations: [host, secondHost, initialOperation] })}\n`,
  );
  assert.equal(
    prepareStateOperationSnapshot(
      secondAdmission,
      `${JSON.stringify({ ...identity, operationNonce: "0".repeat(64), operationId: "OP-654321" })}\n`,
      binding,
    ),
    null,
    "未終了の同Home操作を追加しない",
  );
  const twoOperations = prepareStateOperationSnapshot(
    secondAdmission,
    secondIdentityJson,
    binding,
  );
  assert.ok(twoOperations);
  const twoState = decodeStateSnapshot(twoOperations, binding);
  assert.ok(twoState);
  assert.equal(twoState.snapshot.operations.length, 4);
  const twoRestart = prepareStateRestartSnapshot(
    twoOperations,
    recoveryId,
    restartRequest,
    binding,
  );
  assert.ok(twoRestart);
  const updatedRestarts = decodeStateSnapshot(twoRestart, binding);
  assert.ok(updatedRestarts);
  assert.deepEqual(
    updatedRestarts.snapshot.operations,
    twoState.snapshot.operations.map((item) =>
      item.recoveryId === recoveryId
        ? { ...item, dockerRestart: restartRequest }
        : item,
    ),
    "再起動更新は非対象操作を変えない",
  );
  const otherOperation = twoState.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(otherOperation);
  const otherRestart = {
    ...restartRequest,
    requestId: createDockerRestartRequestId(
      binding,
      otherOperation.identitySha256,
      otherOperation.recoveryId,
      restartScope,
    ),
  };
  assert.equal(
    prepareStateRestartSnapshot(
      twoRestart,
      otherOperation.recoveryId,
      otherRestart,
      binding,
    ),
    null,
    "同じSnapshot内の未解決要求を二件にしない",
  );
  const firstRestartPending = prepareStateRestartSnapshot(
    twoRestart,
    recoveryId,
    { ...restartRequest, request: "unknown", cleanup: "pending" },
    binding,
  );
  assert.ok(firstRestartPending);
  for (const checkpointRequest of ["unknown", "issued"] as const) {
    const requestBeforeResult =
      checkpointRequest === "unknown"
        ? firstRestartPending
        : prepareStateRestartSnapshot(
            firstRestartPending,
            recoveryId,
            { ...restartRequest, request: "issued", cleanup: "pending" },
            binding,
          );
    assert.ok(requestBeforeResult);
    for (const finalRequest of ["not_issued", "unknown", "issued", "confirmed"])
      for (const effectOutcomeUnknown of [false, true]) {
        const settled = prepareStateRestartSnapshot(
          requestBeforeResult,
          recoveryId,
          {
            ...restartRequest,
            request: checkpointRequest,
            cleanup: "confirmed",
            result: {
              status: "blocked",
              reason: "docker_restart_stop_unconfirmed",
              request: finalRequest,
              effectOutcomeUnknown,
            },
          },
          binding,
        );
        if (checkpointRequest === "issued" && finalRequest === "not_issued") {
          assert.equal(settled, null);
          continue;
        }
        assert.ok(settled);
        assert.equal(
          prepareStateRestartSnapshot(
            settled,
            otherOperation.recoveryId,
            otherRestart,
            binding,
          ) !== null,
          !effectOutcomeUnknown &&
            ((checkpointRequest === "unknown" &&
              finalRequest === "not_issued") ||
              (checkpointRequest === "issued" && finalRequest === "issued")),
          `未発行確定と発行済み既知失敗だけを未解決要求数から除外する: ${checkpointRequest}/${finalRequest}/${effectOutcomeUnknown}`,
        );
      }
  }
  assert.equal(
    twoState.snapshot.operations.find((item) => item.kind === "docker_task")
      ?.identityJson,
    secondIdentityJson,
  );
  assert.deepEqual(
    twoState.snapshot.operations.find((item) => item.recoveryId === recoveryId),
    initialOperation,
  );
  assert.deepEqual(twoState.snapshot.previous, {
    revision: preparedState.snapshot.revision,
    payloadSha256: createHash("sha256").update(secondAdmission).digest("hex"),
  });
  assert.equal(
    prepareStateOperationSnapshot(prepared, secondIdentityJson, "f".repeat(64)),
    null,
  );
  assert.equal(initialOperation.resources, null);
  assert.equal(
    prepareStateOperationSnapshot(prepared, identityJson, binding),
    null,
  );
  const fromEmpty = prepareStateOperationSnapshot(
    Buffer.from(`${encodeStateValue(empty)}\n`),
    identityJson,
    binding,
  );
  assert.equal(
    fromEmpty,
    null,
    "Host Intentを持たないStateからDocker実行を始めない",
  );
  for (const invalid of [
    "invalid",
    JSON.stringify(identity),
    `${JSON.stringify({ ...identity, operationNonce: "invalid" })}\n`,
  ])
    assert.equal(
      prepareStateOperationSnapshot(hostBefore, invalid, binding),
      null,
    );
  assert.equal(
    prepareStateOperationSnapshot(
      Buffer.from("invalid"),
      identityJson,
      binding,
    ),
    null,
  );
  const accepted = decodeStateSnapshot(
    Buffer.from(`${encodeStateValue(snapshot)}\n`),
    binding,
  );
  assert.ok(accepted);
  assert.equal(
    accepted.snapshot.operations.find((item) => item.kind === "docker_task")
      ?.identityJson,
    identityJson,
  );
  assert.equal(
    accepted.snapshot.operations
      .find((item) => item.kind === "docker_task")
      ?.resources?.snapshot.resources.find((r) => r.key === "create_provider")
      ?.identity.dockerId,
    "d".repeat(64),
  );
  for (const replacement of [
    {
      ...operation,
      recoveryId: `${recoveryId.slice(0, -1)}${recoveryId.endsWith("0") ? "1" : "0"}`,
    },
    {
      ...operation,
      identityJson: `${encodeStateValue(identity)}\n`,
    },
    {
      ...operation,
      resources: {
        ...operation.resources,
        snapshot: {
          resources: operation.resources.snapshot.resources.map((r, i) =>
            i === 0 ? { ...r, key: "create_provider" } : r,
          ),
        },
      },
    },
  ])
    assert.equal(
      decodeStateSnapshot(
        Buffer.from(
          `${encodeStateValue({
            ...snapshot,
            operations: [host, replacement],
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
    decodeStateSnapshot(Buffer.from(`${encodeStateValue(orphan)}\n`), binding),
    null,
  );
  const currentBytes = Buffer.from(`${encodeStateValue(snapshot)}\n`);
  const next = {
    ...snapshot,
    revision: 2,
    previous: {
      revision: 1,
      payloadSha256: hashExecutionStateContent(snapshot),
    },
  };
  assert.equal(
    validateStateTransition(
      currentBytes,
      Buffer.from(`${encodeStateValue(next)}\n`),
      binding,
    ),
    true,
  );
  for (const invalid of [
    { ...next, previous: { ...next.previous, payloadSha256: "f".repeat(64) } },
    { ...next, operations: [host] },
    {
      ...next,
      operations: [
        host,
        {
          ...operation,
          resources: {
            ...operation.resources,
            snapshot: {
              resources: operation.resources.snapshot.resources.map((r) =>
                r.key === "create_provider"
                  ? {
                      ...r,
                      identity: { ...r.identity, dockerId: "e".repeat(64) },
                    }
                  : r,
              ),
            },
          },
        },
      ],
    },
    {
      ...next,
      operations: [
        host,
        {
          ...operation,
          resources: {
            ...operation.resources,
            snapshot: {
              resources: operation.resources.snapshot.resources.map((r) =>
                r.key === "create_provider"
                  ? {
                      ...r,
                      request: "unknown",
                      identity: { ...r.identity, dockerId: null },
                    }
                  : r,
              ),
            },
          },
        },
      ],
    },
    { ...next, operations: [host, { ...operation, phase: "executing" }] },
  ])
    assert.equal(
      validateStateTransition(
        currentBytes,
        Buffer.from(`${encodeStateValue(invalid)}\n`),
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
      host,
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
  };
  const stoppedBytes = Buffer.from(`${encodeStateValue(stopped)}\n`);
  const lifecycle = {
    phase: operation.phase,
    lease: operation.lease,
    execution: operation.execution,
    primaryFailure: failure,
    outcome: stopped.operations.find((item) => item.kind === "docker_task")
      ?.outcome,
    summarySha256: null,
  };
  const lifecycleBytes = prepareStateLifecycleSnapshot(
    currentBytes,
    recoveryId,
    lifecycle,
    binding,
  );
  assert.ok(lifecycleBytes);
  const lifecycleState = decodeStateSnapshot(lifecycleBytes, binding);
  assert.ok(lifecycleState);
  assert.deepEqual(
    lifecycleState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.primaryFailure,
    failure,
  );
  assert.deepEqual(
    lifecycleState.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.resources,
    operation.resources,
  );
  assert.deepEqual(
    lifecycleState.snapshot.operations.find(
      (item) => item.kind === "host_operation",
    ),
    host,
  );
  const references = {
    recovery: stopped.unresolvedRecoveries[0],
  };
  const referencesBytes = prepareStateReferencesSnapshot(
    lifecycleBytes,
    recoveryId,
    references,
    binding,
  );
  assert.ok(referencesBytes);
  const acceptedReferences = {
    ...references,
  };
  const acceptedBytes = prepareStateReferencesSnapshot(
    referencesBytes,
    recoveryId,
    acceptedReferences,
    binding,
  );
  assert.ok(acceptedBytes);
  const acceptedState = decodeStateSnapshot(acceptedBytes, binding);
  assert.deepEqual(
    acceptedState?.snapshot.operations,
    lifecycleState.snapshot.operations,
  );
  assert.equal(
    Object.hasOwn(acceptedState.snapshot, "pendingDeliveries"),
    false,
  );
  for (const invalid of [
    { recovery: null, deliveries: [] },
    { ...references, deliveries: [] },
    {
      ...references,
      recovery: { ...references.recovery, operationNonce: "0".repeat(64) },
    },
    { ...acceptedReferences, extra: true },
  ]) {
    assert.equal(
      prepareStateReferencesSnapshot(
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
      prepareStateLifecycleSnapshot(
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
      payloadSha256: hashExecutionStateContent(stopped),
    },
  };
  assert.equal(
    validateStateTransition(
      stoppedBytes,
      Buffer.from(
        `${encodeStateValue({ ...stoppedNext, operations: [host, { ...stopped.operations.find((item) => item.kind === "docker_task"), outcome: { ...stopped.operations.find((item) => item.kind === "docker_task")?.outcome, cleanupConfirmed: true } }] })}\n`,
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
        host,
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
          execution: { ...operation.execution, [field]: value },
        },
      ],
    })),
    { ...stoppedNext, unresolvedRecoveries: [] },
    { ...stoppedNext, pendingDeliveries: [] },
    { ...stoppedNext, resultReceipts: [] },
    { ...stoppedNext, resultAcceptances: [] },
    {
      ...stoppedNext,
      operations: [
        host,
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
          primaryFailure: null,
        },
      ],
    },
    {
      ...stoppedNext,
      operations: [
        host,
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
          summarySha256: "e".repeat(64),
        },
      ],
    },
    {
      ...stoppedNext,
      operations: [
        host,
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
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
      validateStateTransition(
        stoppedBytes,
        Buffer.from(`${encodeStateValue(invalid)}\n`),
        binding,
      ),
      false,
    );
});

import {
  prepareAuthenticationUnknownClosureSnapshot,
  prepareStateCleanupSnapshot,
  prepareStateHistoryLine,
  prepareStateHistorySnapshot,
  prepareStateLifecycleSnapshot,
  prepareStateReferencesSnapshot,
  prepareStateResourceSnapshot,
  prepareStateRestartSnapshot,
} from "../../../src/composition/transition.ts";

import { prepareStateOperationSnapshot } from "../../../src/composition/transition.ts";

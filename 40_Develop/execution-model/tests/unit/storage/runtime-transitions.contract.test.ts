/**
 * Coordinator現在状態の固定encodingと相関を検証する。
 * @packageDocumentation
 * @responsibility 保存内容検査を実資源の回収証明と分離して反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope Domain保存codec・状態遷移・出版相関
 * @boundary PRL-UT-006=Direct Boundary: メモリ内の保存本文。
 */

import {
  decodeStateSnapshot,
  encodeStateValue,
} from "../../../src/state/validation.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext, runInThisContext } from "node:vm";
import { prepareHistoryRetention } from "../../../src/history/validation.ts";
import { prepareStateHostSnapshot } from "../../../src/state/validation.ts";

/**
 * 開始保存と終端準備を一つの完成操作として検証する。
 * @responsibility 保存済みの開始記録を準備失敗で未実施へ戻さない。
 * @trace PRL-UT-006
 * @precondition 同じ操作・Repositoryの合成読取りと保存結果を使う。
 * @stimulus 準備成功・拒否・例外、保存不明とReader解放不明を与える。
 * @observation 開始保存flag、Context、exact回復参照、Effectと呼出し順序。
 * @oracle 保存と排他確認後だけ準備し、失敗でも元参照と発行事実を保持する。
 * @cleanup 外部資源なし。
 * @boundary 完成操作の制御。実Filesystemは限定結合試験が確認する。
 */
test("開始保存後の終端準備失敗は元記録とEffectを保持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/attempt/crud.ts", import.meta.url),
    "utf8",
  );
  for (const scenario of [
    "ready",
    "refused",
    "throw",
    "write_unknown",
    "read_unlock_unknown",
    "prepare_unlock_unknown",
  ]) {
    const access = {},
      context = {};
    const identityJson = JSON.stringify({
      operationId: "operation-a",
      consumer: "orchestrator",
    });
    const operation = {
      kind: "docker_task",
      recoveryId: "exact-reference",
      identityJson,
    };
    const calls: string[] = [];
    const execute = runInThisContext(`(dependencies) => {
      const { observeOperationRepository, prepareStateOperationSnapshot,
        decodeStateSnapshot, readStateSnapshot, encodeStateValue,
        writeStateSnapshot, writeOwnedStateSnapshot, prepareOperationCompletion } = dependencies;
      ${sourceDeclaration(source, "saveOperationStart")}
      return saveOperationStart;
    }`)({
      observeOperationRepository: () => ({
        operationId: "operation-a",
        repositoryBinding: "binding",
      }),
      prepareStateOperationSnapshot: () => Buffer.from("candidate"),
      decodeStateSnapshot: () => ({ snapshot: { operations: [operation] } }),
      readStateSnapshot: () => ({
        status: "completed",
        reason: "read",
        lockReleased: scenario !== "read_unlock_unknown",
        value: { snapshot: { operations: [] } },
      }),
      encodeStateValue: () => "{}",
      writeStateSnapshot: () => ({
        status: "blocked",
        reason: "coordinator_state_input_invalid",
        snapshotConfirmed: false,
        filesystemEffectIssued: false,
        lockReleased: true,
      }),
      writeOwnedStateSnapshot: (received: unknown) => {
        assert.equal(received, access);
        calls.push("save");
        return {
          status: scenario === "write_unknown" ? "blocked" : "completed",
          reason: "write",
          snapshotConfirmed: scenario !== "write_unknown",
          filesystemEffectIssued: true,
          lockReleased: true,
        };
      },
      prepareOperationCompletion: (
        received: unknown,
        reference: unknown,
        consumer: unknown,
      ) => {
        calls.push("prepare");
        assert.equal(received, access);
        assert.equal(reference, operation.recoveryId);
        assert.equal(consumer, "orchestrator");
        if (scenario === "throw") throw new Error("prepare failure");
        return {
          context: scenario === "ready" ? context : null,
          reason:
            scenario === "prepare_unlock_unknown"
              ? "coordinator_state_lock_release_unconfirmed"
              : null,
          lockReleased: scenario !== "prepare_unlock_unknown",
        };
      },
    });
    const result = execute(access, identityJson);
    assert.equal(result.recoveryId, operation.recoveryId);
    assert.equal(result.status, scenario === "ready" ? "completed" : "blocked");
    assert.equal(
      result.completionContext,
      scenario === "ready" ? context : null,
    );
    assert.equal(
      result.startSaved,
      ["ready", "refused", "throw", "prepare_unlock_unknown"].includes(
        scenario,
      ),
    );
    assert.equal(
      result.lockReleased,
      !["read_unlock_unknown", "prepare_unlock_unknown", "throw"].includes(
        scenario,
      ),
    );
    if (scenario === "prepare_unlock_unknown")
      assert.equal(result.reason, "coordinator_state_lock_release_unconfirmed");
    assert.equal(
      result.filesystemEffectIssued,
      scenario !== "read_unlock_unknown",
    );
    assert.deepEqual(
      calls,
      scenario === "read_unlock_unknown"
        ? []
        : scenario === "write_unknown"
          ? ["save"]
          : ["save", "prepare"],
    );
  }
});

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
  for (const scenario of ["ready", "rejected", "unlock_unknown"]) {
    const execute = runInThisContext(`(dependencies) => {
      const liveSettlements = new WeakMap();
      const { getConsumerCompletionPolicy, observeExecutionSettlementStorageAccess,
        captureExecutionCleanupVerification, readOperationStateStage } = dependencies;
      ${sourceDeclaration(source, "prepareOperationCompletion")}
      return prepareOperationCompletion;
    }`)({
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
                        consumer: "orchestrator",
                      }),
                    },
                  ],
                },
              }
            : null,
      }),
    });
    const result = execute({}, "exact", "orchestrator");
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
    const execute = runInThisContext(`(dependencies) => {
      const { readLiveSettlement, observeExecutionTerminalForStorage,
        readOwnedSettlementSnapshot, writeStateSnapshot, encodeStateValue,
        writeOwnedSettlement, prepareStateCleanupSnapshot } = dependencies;
      ${sourceDeclaration(source, "captureOperationCompletionInputs")}
      ${sourceDeclaration(source, "completeOperation")}
      return completeOperation;
    }`)({
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
  applyResourceEvent,
  areTaskResourcesSettled,
  canCloseUnknownAuthentication,
  createDockerRestartRequestId,
  type ExecutionOperationRecord,
  type OperationResources,
  type ProjectExecutionState,
} from "../../../src/index.ts";
import { decodeHistoryRows } from "../../../src/history/validation.ts";
import type { UnifiedSnapshot } from "../../../src/state/types.ts";
import {
  classifyResourcePublication,
  EXECUTION_STATE_SCHEMA,
  hashExecutionStateContent,
  prepareRecoveredHistoryPublication,
  prepareStateCompletionSnapshot,
  projectTaskSettlement,
  validateStateTransition,
  validateUnifiedTransition,
} from "../../../src/state/validation.ts";
import { prepareUnifiedTaskSnapshot } from "../../../src/task/validation.ts";
import {
  createResourceBookFixture,
  createResourceOperationFixture,
} from "../../support/resource-operation.ts";
import { createManagedRuntimeSnapshotFixture } from "../../support/runtime-state.ts";
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
      mountLeaseReleased: true,
      recoveryCompleted: true,
      primaryFailure: null,
    };
    const captured: { writes: number; bytes: Buffer | null } = {
      writes: 0,
      bytes: null,
    };
    const source = fs.readFileSync(
      new URL("../../../src/attempt/crud.ts", import.meta.url),
      "utf8",
    );
    const execute = runInThisContext(`(dependencies) => {
      const { readLiveSettlement, captureOperationCompletionInputs,
        observeExecutionTerminalForStorage, readOwnedSettlementSnapshot,
        writeStateSnapshot, prepareStateCleanupSnapshot,
        decodeStateSnapshot, encodeStateValue, writeOwnedSettlement } = dependencies;
      ${sourceDeclaration(source, "completeOperation")}
      return completeOperation;
    }`)({
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
function emptyUnifiedSnapshot(): UnifiedSnapshot {
  return {
    schema: "crdd-domain/runtime-state/v3",
    revision: 1,
    previous: null,
    repositoryBinding: binding,
    repositoryBindingId: null,
    intakeEpoch: null,
    operations: [],
    unresolvedRecoveries: [],
    pendingDeliveries: [],
    projects: [],
    managedExecutions: [],
    queueEntries: [],
    workspaces: [],
    intakeBindings: [],
    leaseEvidence: [],
    leaseIntents: [],
    results: [],
    historyPending: [],
    decisions: [],
    blockers: [],
    resultReceipts: [],
  };
}

const empty = {
  ...emptyUnifiedSnapshot(),
  schema: EXECUTION_STATE_SCHEMA,
  revision: 1,
  previous: null,
  repositoryBinding: binding,
  operations: [],
  unresolvedRecoveries: [],
  pendingDeliveries: [],
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
    schema: "crdd-coordinator/operation-identity/v4",
    operationNonce: nonce,
    provider: "claude",
    consumer: "orchestrator",
    operationId: "OP-123456",
    recoveryCorrelationId: "task-operation-a",
    grantRef: "PHMGRANT-FIXTURE",
    executionSelection: {
      provider: "claude",
      modelIdentifier: "opus",
      identifierKind: "alias",
      reasoningEffort: "low",
      purpose: "task",
      catalogIdentity:
        "5e1d3387ad7fcfe61a6f2521291c2ed118fe0091f9db2aea63e1cd7aa067ed2c",
      configIdentity:
        "e70d12e5f16639d9774b9f1f2803deaa37528b28bdf3e938d8badd4f4c5cfb1f",
      role: "executor",
      workType: null,
      source: "explicit",
    },
    taskAttempt: 0,
    stableLogicalHomeBindingHash: "c".repeat(64),
    providerHomeIdentityHash: "8".repeat(64),
    repositoryBinding: binding,
    ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
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
  assert.ok(
    prepareStateOperationSnapshot(null, identityJson, binding),
    "正常な初期Host証明を現行model自身が受理する",
  );
  const technical = decodeStateSnapshot(
    prepareStateOperationSnapshot(null, identityJson, binding),
    binding,
  );
  assert.ok(technical);
  const domainTechnical = {
    ...technical.snapshot,
    schema: "crdd-domain/runtime-state/v3",
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
        null,
        `${JSON.stringify(invalidIdentity)}\n`,
        binding,
      ),
      null,
    );
  for (const initialHostRecovery of [
    { ...identity.initialHostRecovery, token: `${token.slice(0, -1)}0` },
    { ...identity.initialHostRecovery, recordHash: "0".repeat(64) },
    {
      ...identity.initialHostRecovery,
      record: {
        ...hostRecord,
        childIdentities: {
          management: {
            ...hostRecord.childIdentities.management,
            unexpected: "not-an-identity-field",
          },
        },
      },
    },
  ]) {
    assert.equal(
      prepareStateOperationSnapshot(
        null,
        `${JSON.stringify({ ...identity, initialHostRecovery })}\n`,
        binding,
      ),
      null,
      "token・Hash相関と子Identityの閉集合を緩めない",
    );
  }
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
      {
        ...operation,
        host: {
          ...operation.host,
          pendingTransitionJson: null,
          cleanup: "not_requested",
        },
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
  const limitedOperation = limitedDecoded?.snapshot.operations[0];
  assert.ok(limitedOperation?.kind === "docker_task");
  assert.equal(canCloseUnknownAuthentication(limitedOperation), true);
  assert.equal(areTaskResourcesSettled(limitedOperation), false);
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
  const closedOperation = closedDecoded?.snapshot.operations[0];
  assert.ok(closedOperation?.kind === "docker_task");
  assert.equal(areTaskResourcesSettled(closedOperation), true);
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
  const unknownAbsenceTask = unknownAbsenceState?.snapshot.operations[0];
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
    new URL("../../../src/state/crud.ts", import.meta.url),
    "utf8",
  );
  const helperSource = fs.readFileSync(
    new URL("../../../src/state/validation.ts", import.meta.url),
    "utf8",
  );
  const helperStart = helperSource.indexOf(
    "export function authenticationUnknownAbsenceChanged(",
  );
  const nextHelper = helperSource.indexOf("\n/**", helperStart);
  const helperEnd = nextHelper < 0 ? helperSource.length : nextHelper;
  const guardStart = storeSource.indexOf(
    "  if (\n    !currentAuthenticationClosure &&",
  );
  const guardEnd = storeSource.indexOf(
    "  const acquisition = acquireStorageOwnerForRepository(repository);",
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
    `${encodeStateValue({ ...closedDecoded.snapshot, operations: [badEvidence] })}\n`,
  );
  assert.ok(decodeStateSnapshot(badAuthBytes, binding));
  const pairKinds = [
    "currentHistory",
    "currentDelivery",
    "currentCompletion",
    "currentRepair",
    "settlement.completion",
    "hostCleanupPublication",
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
          currentDelivery: null,
          currentCompletion: null,
          currentRepair: null,
          hostCleanupPublication: null,
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
          if (kind === "currentHistory") environment.currentDelivery = pair;
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
      hostCleanupPublication: null,
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
      ...(["docker_create_result", "runtime_reconciliation"] as const).map(
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
        encodeStateValue({ ...limitedState, operations: [changed] }) + "\n",
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
              operations: [changed],
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
              operations: [changed],
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
        `${encodeStateValue({ ...limitedState, operations: [badEvidence] })}\n`,
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
    "orchestrator",
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
      `${encodeStateValue({ ...empty, operations: [consumerOperation] })}\n`,
    );
    const consumerClosed = prepareAuthenticationUnknownClosureSnapshot(
      consumerBefore,
      consumerRecoveryId,
      observations,
      binding,
    );
    assert.ok(consumerClosed, consumer);
    const resourceClosed = decodeStateSnapshot(consumerClosed, binding)
      ?.snapshot.operations[0];
    assert.ok(resourceClosed?.kind === "docker_task");
    const terminalTask: ExecutionOperationRecord = {
      ...resourceClosed,
      host: {
        ...resourceClosed.host,
        pendingTransitionJson: null,
        cleanup: "confirmed",
      },
      lease: "released",
      outcome: {
        status: "blocked",
        reason: "docker_setup_create_subscription_auth_probe_failed",
        cleanupConfirmed: true,
      },
    };
    const terminalBytes = Buffer.from(
      `${encodeStateValue({ ...empty, operations: [terminalTask] })}\n`,
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
    const delivered = prepareStateResultDeliverySnapshot(
      historyConfirmed,
      consumerRecoveryId,
      consumer === "orchestrator" ? ["orchestrator"] : [],
      binding,
    );
    assert.ok(delivered, consumer);
    const accepted = delivered;
    if (consumer === "orchestrator") {
      assert.equal(
        prepareStateCompletionSnapshot(delivered, consumerRecoveryId, binding),
        null,
      );
      continue;
    }
    const completed = prepareStateCompletionSnapshot(
      accepted,
      consumerRecoveryId,
      binding,
    );
    assert.ok(completed, consumer);
    const completedState = decodeStateSnapshot(completed, binding);
    assert.ok(completedState);
    assert.deepEqual(completedState.snapshot.operations, []);
    assert.deepEqual(completedState.snapshot.unresolvedRecoveries, []);
    assert.deepEqual(completedState.snapshot.pendingDeliveries, []);
    const nextIdentityJson = `${JSON.stringify({ ...consumerIdentity, operationNonce: "d".repeat(64), operationId: "OP-654321" })}\n`;
    assert.ok(
      prepareStateOperationSnapshot(accepted, nextIdentityJson, binding),
      `${consumer}: settled predecessor permits next admission`,
    );
    const acceptedState = decodeStateSnapshot(accepted, binding);
    assert.ok(acceptedState);
    const acceptedTask = acceptedState.snapshot.operations[0];
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
    const rejected = Buffer.from(
      `${encodeStateValue({ ...acceptedState.snapshot, operations: [badTask] })}\n`,
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
      prepareStateResultDeliverySnapshot(
        rejected,
        consumerRecoveryId,
        [],
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
      {
        ...operation,
        resources: resourceFrame,
        host: {
          ...operation.host,
          pendingTransitionJson: null,
          cleanup: "confirmed",
        },
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
  const registeredPending = prepareStateResultDeliverySnapshot(
    pendingHistoryBytes,
    recoveryId,
    ["orchestrator"],
    binding,
  );
  const registeredConfirmed = prepareStateResultDeliverySnapshot(
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
    transientState.pendingDeliveries = [];
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
    assert.deepEqual(
      prepareStateResultDeliverySnapshot(
        transientFixed,
        transientRecoveryId,
        [],
        binding,
      ),
      transientFixed,
    );
    assert.equal(
      prepareStateResultDeliverySnapshot(
        transientFixed,
        transientRecoveryId,
        ["orchestrator"],
        binding,
      ),
      null,
    );
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
                receiptSource: known ? "runtime_reconciliation" : null,
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
        prepareStateResultDeliverySnapshot(
          matrixBytes,
          transientRecoveryId,
          [],
          binding,
        ) !== null,
        settled,
        `${label}: delivery`,
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
        const task = decoded?.snapshot.operations[0];
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
    assert.equal(transientCompletedSnapshot.snapshot.operations.length, 0);
    assert.equal(
      transientCompletedSnapshot.snapshot.pendingDeliveries.length,
      0,
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
      pendingDeliveries: [
        {
          operationNonce: nonce,
          recoveryId: transientRecoveryId,
          resultId: decodeStateSnapshot(
            transientFixed,
            binding,
          )?.snapshot.operations.find((item) => item.kind === "docker_task")
            ?.summarySha256,
          consumer: "orchestrator",
          acceptanceSha256: null,
        },
      ],
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
  assert.deepEqual(
    pendingResult.snapshot.pendingDeliveries,
    confirmedResult.snapshot.pendingDeliveries,
  );
  assert.equal(
    confirmedResult.snapshot.pendingDeliveries[0]?.resultId,
    confirmedHistory.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.summarySha256,
  );
  const forgedAcceptedResultBytes = prepareStateReferencesSnapshot(
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
  assert.equal(
    forgedAcceptedResultBytes,
    null,
    "技術参照更新では受領を代筆できない",
  );
  const acceptedResultBytes = registeredConfirmed;
  assert.deepEqual(
    prepareStateResultDeliverySnapshot(
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
      prepareStateResultDeliverySnapshot(
        acceptedResultBytes,
        recoveryId,
        invalidConsumers,
        binding,
      ),
      null,
    );
  assert.equal(
    prepareStateResultDeliverySnapshot(
      readyHistoryBytes,
      recoveryId,
      ["orchestrator"],
      binding,
    ),
    null,
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
    operations: knownHistory.snapshot.operations
      .filter((item) => item.kind === "docker_task")
      .map((value) => ({
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
      resultId: knownHistory.snapshot.operations.find(
        (item) => item.kind === "docker_task",
      )?.summarySha256,
      consumer,
    })),
  };
  const acceptedCompletionBytes = Buffer.from(
    `${encodeStateValue(acceptedCompletionState)}\n`,
  );
  const sameHomeNextIdentity = `${JSON.stringify({
    ...identity,
    operationNonce: "0".repeat(64),
    operationId: "OP-654321",
  })}\n`;
  // 同一Hostの技術終端と、別Hostに必要な物理清掃を混同しない。
  {
    const normalOld = {
      ...operation,
      phase: "executing",
      lease: "released",
      resources: resourceFrame,
      host: {
        currentToken: token,
        pendingTransitionJson: null,
        cleanup: "not_requested",
      },
      execution: {
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
        ownerEffect: "disabled",
        workspaceReusable: false,
      },
    };
    const normalBefore = Buffer.from(
      `${encodeStateValue({ ...empty, operations: [normalOld] })}\n`,
    );
    assert.ok(decodeStateSnapshot(normalBefore, binding));
    const nextIdentity = {
      ...identity,
      operationNonce: "0".repeat(64),
      initialHostRecovery: {
        ...identity.initialHostRecovery,
        markerIdentity: "1:2:5",
      },
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
      const before = Buffer.from(
        `${encodeStateValue({ ...empty, operations: [old] })}\n`,
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
      { ...normalOld, phase: "settling" },
      { ...normalOld, lease: "held" },
      {
        ...normalOld,
        execution: { ...normalOld.execution, ownerEffect: "active" },
      },
      { ...normalOld, host: { ...normalOld.host, cleanup: "pending" } },
      { ...normalOld, host: { ...normalOld.host, cleanup: "confirmed" } },
      {
        ...normalOld,
        host: {
          ...normalOld.host,
          pendingTransitionJson: `${JSON.stringify(transition)}\n`,
        },
      },
      {
        ...normalOld,
        host: { ...normalOld.host, currentToken: expectedToken },
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
      const before = Buffer.from(
        `${encodeStateValue({ ...empty, operations: [invalidOld] })}\n`,
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
      {
        ...nextIdentity,
        hostPaths: { ...identity.hostPaths, root: "other-host-root" },
      },
      {
        ...nextIdentity,
        hostPaths: { ...identity.hostPaths, marker: "other-host-marker" },
      },
      {
        ...nextIdentity,
        initialHostRecovery: {
          ...nextIdentity.initialHostRecovery,
          directoryIdentity: "1:2:5",
        },
      },
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
      operations: [normalOld],
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
      new URL("../../../src/attempt/validation.ts", import.meta.url),
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
  const deliveryOnlyState = {
    ...acceptedCompletionState,
    unresolvedRecoveries: acceptedCompletionState.unresolvedRecoveries.map(
      (value) => ({ ...value, obligations: ["result_delivery"] }),
    ),
    pendingDeliveries: acceptedCompletionState.pendingDeliveries,
  };
  const deliveryOnlyBytes = Buffer.from(
    `${encodeStateValue(deliveryOnlyState)}\n`,
  );
  const sameHomeStarted = prepareStateOperationSnapshot(
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
    validateStateTransition(
      deliveryOnlyBytes,
      Buffer.from(`${encodeStateValue(sameHomeStartedState)}\n`),
      binding,
    ),
    false,
    "新操作追加と同時に旧操作へ資源義務を戻す候補を拒否する",
  );
  assert.equal(
    prepareStateOperationSnapshot(
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
      prepareStateCompletionSnapshot(
        Buffer.from(
          `${encodeStateValue({ ...acceptedCompletionState, pendingDeliveries: invalidDeliveries })}\n`,
        ),
        recoveryId,
        binding,
      ),
      null,
    );
  }
  assert.equal(
    prepareStateCompletionSnapshot(
      acceptedCompletionBytes,
      recoveryId,
      binding,
    ),
    null,
    "Taskを伴わない技術保存だけでは耐久配送を完了しない",
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
      host: {
        ...acceptedCompletionState.operations.find(
          (item) => item.kind === "docker_task",
        )?.host,
        cleanup: "unknown",
      },
    },
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
      `${encodeStateValue({ ...acceptedCompletionState, operations: acceptedCompletionState.operations.map((value) => ({ ...value, ...change })) })}\n`,
    );
    assert.equal(
      prepareStateCompletionSnapshot(input, recoveryId, binding),
      null,
    );
  }
  const unaccepted = Buffer.from(
    `${encodeStateValue({ ...acceptedCompletionState, pendingDeliveries: acceptedCompletionState.pendingDeliveries.map((value) => ({ ...value, acceptanceSha256: null })) })}\n`,
  );
  assert.equal(
    prepareStateCompletionSnapshot(unaccepted, recoveryId, binding),
    null,
  );
  for (const consumer of ["orchestrator"]) {
    const missingAcceptance = Buffer.from(
      `${encodeStateValue({ ...acceptedCompletionState, pendingDeliveries: acceptedCompletionState.pendingDeliveries.map((value) => ({ ...value, acceptanceSha256: value.consumer === consumer ? null : "forbidden" })) })}\n`,
    );
    assert.equal(
      prepareStateCompletionSnapshot(missingAcceptance, recoveryId, binding),
      null,
    );
  }
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
        contract: "crdd-coordinator/project-state/v2",
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
            resultAcceptances: [],
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
      resultAcceptances: _acceptances,
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
      resultAcceptanceIds: [],
    };
    const { managedExecutions: _emptyManaged, ...emptyDefinitionFixture } =
      emptyUnifiedSnapshot();
    const unifiedTerminal = {
      ...emptyDefinitionFixture,
      repositoryBindingId: "binding-a",
      intakeEpoch: "epoch-a",
      operations: [terminalOperation],
      projects: [{ ...projectFixture.state, tasks: [boundTask] }],
      pendingDeliveries: [
        {
          operationNonce: nonce,
          recoveryId,
          resultId: terminalOperation.summarySha256,
          consumer: "orchestrator",
        },
      ],
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
            obligations: ["result_delivery"],
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
                recoveryObligations: [{ kind: "docker", recoveryId }],
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
    const receipt = {
      repositoryBindingId: "binding-a",
      projectId: "project-a",
      milestoneId: "milestone-a",
      taskId: "task-a",
      attemptId: "attempt-a",
      operationId: identity.recoveryCorrelationId,
      recoveryId,
      settlementGeneration: 2,
      repositoryBinding: binding,
      resultId: terminalOperation.summarySha256,
      consumer: "orchestrator",
    };
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
        projects: [
          {
            ...projectFixture.state,
            tasks: [
              {
                ...boundTask,
                state: "recovery_required",
                recoveryObligations: [{ kind: "docker", recoveryId }],
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
        (item: { identityJson: string }) =>
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
      second.host.cleanup = "confirmed";
      second.lease = "released";
      second.execution = terminalOperation.execution;
      second.outcome = terminalOperation.outcome;
      physical.managedExecutions[0].tasks[0].recoveryObligations.push({
        kind: "docker",
        recoveryId: second.recoveryId,
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
      const delivered = prepareStateResultDeliverySnapshot(
        multi,
        second.recoveryId,
        ["orchestrator"],
        binding,
      );
      assert.ok(delivered);
      multi = delivered;
      for (const id of [recoveryId, second.recoveryId]) {
        const decoded = decodeStateSnapshot(multi, binding);
        const view = decoded?.projects[0];
        assert.ok(decoded && view);
        const operation = decoded.snapshot.operations.find(
          (item) => item.recoveryId === id,
        );
        assert.ok(operation?.kind === "docker_task");
        const acceptance = {
          ...receipt,
          recoveryId: id,
          resultId: operation.summarySha256,
          settlementGeneration: view.generation + 1,
        };
        const proposed = {
          ...view,
          generation: view.generation + 1,
          tasks: view.tasks.map((task) => ({
            ...task,
            recoveryObligations: task.recoveryObligations.map((item) =>
              item.recoveryId === id
                ? {
                    ...item,
                    phase: "acknowledged",
                    acknowledgement: acceptance,
                  }
                : item,
            ),
          })),
        };
        const next = prepareUnifiedTaskSnapshot(
          multi,
          proposed,
          view.generation,
          binding,
        );
        assert.ok(next, "二つの回復を同じTaskで一件ずつ耐久受領できる");
        const saved = JSON.parse(next.toString());
        const stored = saved.managedExecutions[0].tasks[0];
        assert.equal(saved.operations.length, id === recoveryId ? 1 : 0);
        assert.equal(
          stored.settlement.kind,
          id === recoveryId ? "operations" : "executor_result",
        );
        assert.equal(saved.resultReceipts.length, id === recoveryId ? 1 : 2);
        for (const mutate of [
          (value: typeof saved) => {
            value.resultReceipts = [];
          },
          (value: typeof saved) => {
            value.pendingDeliveries = decoded.snapshot.pendingDeliveries;
          },
          (value: typeof saved) => {
            value.managedExecutions[0].tasks[0].attemptId = "other-attempt";
          },
          (value: typeof saved) => {
            const fact = value.managedExecutions[0].tasks[0].settlement;
            if (fact.kind === "operations") fact.resultUnresolved = true;
            else fact.recoveryUnresolved = true;
          },
        ]) {
          const invalid = structuredClone(saved);
          mutate(invalid);
          assert.equal(
            validateUnifiedTransition(multi, encodeUnified(invalid), binding),
            false,
          );
        }
        if (id === recoveryId) {
          const premature = structuredClone(saved);
          premature.managedExecutions[0].tasks[0].settlement = {
            kind: "executor_result",
            cleanupConfirmed: true,
            recoveryUnresolved: false,
          };
          assert.equal(
            validateUnifiedTransition(multi, encodeUnified(premature), binding),
            false,
            "未受領のOperationが残る間は技術参照なし終端へ移れない",
          );
          for (const references of [
            [],
            [recoveryId],
            [recoveryId, second.recoveryId],
          ]) {
            const invalid = structuredClone(saved);
            invalid.managedExecutions[0].tasks[0].settlement.recoveryIds =
              references;
            assert.equal(
              validateUnifiedTransition(multi, encodeUnified(invalid), binding),
              false,
            );
          }
        }
        multi = next;
      }
      const receipts = decodeStateSnapshot(multi, binding)?.snapshot
        .resultReceipts;
      assert.equal(
        receipts?.find((item) => item.recoveryId === recoveryId)
          ?.settlementGeneration,
        2,
      );
    }
    const acceptedUnified = {
      ...unifiedTerminal,
      revision: 2,
      previous: {
        revision: 1,
        payloadSha256: createHash("sha256").update(unifiedBefore).digest("hex"),
      },
      operations: [],
      pendingDeliveries: [],
      resultReceipts: [receipt],
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
              resultAcceptanceIds: [recoveryId],
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
      decodeStateSnapshot(receiptRetained, binding)?.snapshot.resultReceipts,
      acceptedDecoded.snapshot.resultReceipts,
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
              resultAcceptanceIds: [],
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
        payloadSha256: createHash("sha256").update(unboundBytes).digest("hex"),
      },
      resultReceipts: [
        { ...receipt, operationId: "another-logical-operation" },
      ],
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
        unboundBytes,
        encodeUnified(wrongLogicalReceipt),
        binding,
      ),
      false,
    );
    for (const invalid of [
      { ...acceptedUnified, projects: unifiedTerminal.projects },
      { ...acceptedUnified, operations: unifiedTerminal.operations },
      {
        ...acceptedUnified,
        pendingDeliveries: unifiedTerminal.pendingDeliveries,
      },
      { ...acceptedUnified, resultReceipts: [] },
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
    const secondBytes = prepareStateOperationSnapshot(
      null,
      secondIdentityJson,
      binding,
    );
    assert.ok(secondBytes);
    const second = decodeStateSnapshot(secondBytes, binding)?.snapshot
      .operations[0];
    assert.ok(second);
    const withSecond = {
      ...unifiedTerminal,
      operations: [terminalOperation, second],
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
                { kind: "docker", recoveryId: second.recoveryId },
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
    for (const phase of ["settled", "acknowledged", "required"])
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
  for (const change of [
    { phase: "executing" },
    { outcome: null },
    { outcome: { ...terminalOperation.outcome, cleanupConfirmed: false } },
    { host: { ...terminalOperation.host, cleanup: "unknown" } },
    {
      host: {
        ...terminalOperation.host,
        pendingTransitionJson: `${JSON.stringify(transition)}\n`,
      },
    },
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
        operations: [{ ...terminalOperation, ...change }],
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
            obligations: ["result_delivery"],
          },
        ],
      }),
      { cleanupConfirmed: true, recoveryUnresolved: false },
    );
  }
  const goldenTaskLine = `{"occurredAt":"2026-10-08T00:00:00.000Z","schema":"crdd-coordinator/history-row/v2","summary":{"execution":{"externalSend":"unknown","ownerEffect":"disabled","providerStart":"unknown","sharedWrite":"unknown","workspaceReusable":false},"hostCleanup":"confirmed","identitySha256":"${identitySha256}","lease":"released","operationId":"OP-123456","operationNonce":"${nonce}","outcome":{"cleanupConfirmed":true,"reason":"provider_operation_completed","status":"completed"},"primaryFailure":null,"recoveryId":"${recoveryId}","schema":"crdd-coordinator/operation-summary/v2"}}\n`;
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
  restartHistoryRow.summary.schema = "crdd-coordinator/operation-summary/v3";
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
  assert.ok(decodeHistoryRows(Buffer.from(`${encodeStateValue(v4Restart)}\n`)));
  for (const checkpoint of [
    null,
    { ...restartHistoryCheckpoint, cleanup: "unknown" },
    { unexpected: true },
  ]) {
    const invalid = structuredClone(v4Restart);
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
    "固定済みv2結果へv3履歴を再結合しない",
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
    if (mutation === "missing") delete row.summary.dockerRestart;
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
          `${encodeStateValue({ ...pendingHistory.snapshot, operations: [changed] })}\n`,
        ),
        binding,
      ),
      null,
    );
  assert.deepEqual(
    historyBytes,
    Buffer.from(`${encodeStateValue(historyState)}\n`),
  );
  const prepared = prepareStateOperationSnapshot(null, identityJson, binding);
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
    const task = identifiedState?.snapshot.operations[0];
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
        operations: progressed.snapshot.operations.map((op) => ({
          ...op,
          dockerRestart: restartRequest,
        })),
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
    { ...identity, consumer: "durable" },
    { ...identity, consumer: { consumer: "orchestrator" } },
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
  for (const consumer of ["coordinator_cli", "orchestrator", "workbench"]) {
    const consumerIdentity = `${JSON.stringify({ ...identity, consumer })}\n`;
    const consumerSnapshot = prepareStateOperationSnapshot(
      null,
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
  assert.equal(initialOperation?.host.pendingTransitionJson, null);
  assert.ok(initialOperation);
  const hostIntent = {
    ...initialOperation.host,
    pendingTransitionJson: `${JSON.stringify(transition)}\n`,
  };
  const hostIntentBytes = prepareStateHostSnapshot(
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
  const hostReceiptBytes = prepareStateHostSnapshot(
    hostIntentBytes,
    recoveryId,
    hostReceipt,
    binding,
  );
  assert.ok(hostReceiptBytes);
  assert.equal(
    decodeStateSnapshot(hostReceiptBytes, binding)?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.host.currentToken,
    expectedToken,
  );
  assert.deepEqual(
    decodeStateSnapshot(hostReceiptBytes, binding)?.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    )?.resources,
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
        pendingTransitionJson: `${encodeStateValue(transition)}\n`,
      },
    ],
  ]) {
    assert.equal(
      prepareStateHostSnapshot(before, recoveryId, update, binding),
      null,
    );
  }
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
  alteredPublication.operations[0].execution.externalSend = "unknown";
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
  const identifiedOperation = identifiedState?.snapshot.operations[0];
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
  const cleanupTask = cleanupState?.snapshot.operations[0];
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
  assert.equal(
    prepareStateOperationSnapshot(
      prepared,
      `${JSON.stringify({ ...identity, operationNonce: "0".repeat(64), operationId: "OP-654321" })}\n`,
      binding,
    ),
    null,
    "未終了の同Home操作を追加しない",
  );
  const twoOperations = prepareStateOperationSnapshot(
    prepared,
    secondIdentityJson,
    binding,
  );
  assert.ok(twoOperations);
  const twoState = decodeStateSnapshot(twoOperations, binding);
  assert.ok(twoState);
  assert.equal(twoState.snapshot.operations.length, 2);
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
    twoState.snapshot.operations
      .filter((item) => item.kind === "docker_task")
      .map((item) =>
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
  assert.deepEqual(twoState.snapshot.operations[1], initialOperation);
  assert.deepEqual(twoState.snapshot.previous, {
    revision: 1,
    payloadSha256: preparedState.payloadSha256,
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
  assert.ok(fromEmpty);
  assert.deepEqual(decodeStateSnapshot(fromEmpty, binding)?.snapshot.previous, {
    revision: 1,
    payloadSha256: hashExecutionStateContent(empty),
  });
  for (const invalid of [
    "invalid",
    JSON.stringify(identity),
    `${JSON.stringify({ ...identity, operationNonce: "invalid" })}\n`,
  ])
    assert.equal(prepareStateOperationSnapshot(null, invalid, binding), null);
  assert.equal(
    prepareStateOperationSnapshot(
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
      decodeStateSnapshot(
        Buffer.from(`${encodeStateValue(invalid)}\n`),
        binding,
      ),
      null,
    );
  }
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
    {
      ...operation,
      host: {
        ...operation.host,
        pendingTransitionJson: `${encodeStateValue(transition)}\n`,
      },
    },
  ])
    assert.equal(
      decodeStateSnapshot(
        Buffer.from(
          `${encodeStateValue({
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
    { ...next, operations: [] },
    {
      ...next,
      operations: [
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
      (item) => item.kind === "docker_task",
    )?.host,
    operation.host,
  );
  const references = {
    recovery: stopped.unresolvedRecoveries[0],
    deliveries: stopped.pendingDeliveries,
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
    deliveries: stopped.pendingDeliveries,
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
    acceptedState?.snapshot.pendingDeliveries.some((item) =>
      Object.hasOwn(item, "acceptanceSha256"),
    ),
    false,
  );
  for (const invalid of [
    { recovery: null, deliveries: [] },
    {
      ...references,
      deliveries: references.deliveries.map((item) => ({
        ...item,
        acceptanceSha256: null,
      })),
    },
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
        `${encodeStateValue({ ...stoppedNext, operations: [{ ...stopped.operations.find((item) => item.kind === "docker_task"), outcome: { ...stopped.operations.find((item) => item.kind === "docker_task")?.outcome, cleanupConfirmed: true } }] })}\n`,
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
          ...stopped.operations.find((item) => item.kind === "docker_task"),
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
      operations: [
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
          primaryFailure: null,
        },
      ],
    },
    {
      ...stoppedNext,
      operations: [
        {
          ...stopped.operations.find((item) => item.kind === "docker_task"),
          summarySha256: "e".repeat(64),
        },
      ],
    },
    {
      ...stoppedNext,
      operations: [
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
  prepareStateResultDeliverySnapshot,
} from "../../../src/state/validation.ts";

/**
 * 初期Hostの保存モデル条件を実Host観測と分けて反証する。
 * @responsibility 全文一致・未解決参照・再起動終了の各条件と依存到達を維持する。
 * @trace PRL-UT-006
 * @precondition 有限の正規Operation fixtureを用いる。
 * @stimulus codec合法な一軸差分と、本文比較・再起動guardのメモリ変異。
 * @observation 正常の肯定、合法負例30件、各変異の拒否Oracle違反。
 * @oracle 許された退役・清掃差分と終了済み再起動以外はfalse。
 * @cleanup N/A: 値とSource読取りのみ。
 * @boundary EM内部の純粋モデル。Host・Docker・実保存を扱わない。
 */
test("初期Hostモデルは全文差分・参照・未終了再起動を拒否する", () => {
  const f = createResourceOperationFixture();
  const before = JSON.parse(f.bytes.toString("utf8"));
  const target = before.operations[0];
  const identity = f.identity;
  const stateModel = {
    prepareStateOperationSnapshot,
    decodeStateSnapshot,
    applyResourceEvent,
    applyResourceCleanup,
  };
  const source = fs.readFileSync(
    new URL("../../../src/state/validation.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function isInitialOperationHost(");
  const boundary = source.indexOf("\n/**", start);
  const end = boundary < 0 ? source.length : boundary;
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  const evaluate = runInThisContext(
    `(function(prepareStateOperationSnapshot, decodeStateSnapshot, encodeStateValue, isDockerRestartCheckpointSettled) { ${body}; return isInitialOperationHost; })`,
  )(
    prepareStateOperationSnapshot,
    stateModel.decodeStateSnapshot,
    encodeStateValue,
    isDockerRestartCheckpointSettled,
  );
  const comparisonStart = body.lastIndexOf("return (");
  assert.ok(comparisonStart > 0);
  assert.equal(body.split("encodeStateValue(operation)").length - 1, 1);
  const comparisonOmitted = `${body.slice(0, comparisonStart)}return true;\n}`;
  assert.notEqual(comparisonOmitted, body);
  const evaluateMutant = runInThisContext(
    `(function(prepareStateOperationSnapshot, decodeStateSnapshot, encodeStateValue, isDockerRestartCheckpointSettled) { ${comparisonOmitted}; return isInitialOperationHost; })`,
  )(
    prepareStateOperationSnapshot,
    stateModel.decodeStateSnapshot,
    encodeStateValue,
    isDockerRestartCheckpointSettled,
  );
  let legalRejections = 0;
  /**
   * codec合法な非初期操作を同じ拒否Oracleへ渡す。
   * @responsibility codec拒否と初期切断の限定判定を区別し、全文比較省略を検出する。
   * @trace PRL-UT-006
   * @trace PRL-UT-006
   * @precondition 実試験Identityを保持し、一軸だけ変更した操作を受け取る。
   * @stimulus 同じSnapshotへ戻してdecodeし、元判定とメモリ変異へ同じ引数を渡す。
   * @observation decode成功、元判定false、比較省略変異trueと到達数。
   * @oracle 合法負例は元判定だけが拒否し、同じfalse Oracleが変異を検出する。
   * @cleanup N/A: メモリ内だけで実Sourceと保存本文を変更しない。
   * @boundary 保存値の合法性と意味上の初期切断判定。物理Host観測の代用ではない。
   */
  function assertLegalRejected(changed: typeof target): void {
    const candidate = structuredClone(before);
    candidate.operations = candidate.operations.map((item: typeof target) =>
      item.recoveryId === changed.recoveryId ? changed : item,
    );
    const decoded = stateModel.decodeStateSnapshot(
      Buffer.from(`${encodeStateValue(candidate)}\n`),
      before.repositoryBinding,
    );
    assert.ok(decoded, "negative_must_be_codec_legal");
    const args = [
      changed,
      decoded.snapshot,
      changed.host.currentToken,
      "host_only",
    ];
    assert.equal(evaluate(...args), false);
    assert.throws(() => assert.equal(evaluateMutant(...args), false));
    legalRejections++;
  }
  const retired = structuredClone(target);
  retired.phase = "settling";
  retired.execution.ownerEffect = "disabled";
  for (const cleanup of ["not_requested", "pending"]) {
    retired.host.cleanup = cleanup;
    assert.equal(
      evaluate(retired, before, retired.host.currentToken, "host_only"),
      true,
    );
  }
  const settledRestart = {
    requestId: createDockerRestartRequestId(
      before.repositoryBinding,
      retired.identitySha256,
      retired.recoveryId,
      "b".repeat(64),
    ),
    scopeSha256: "b".repeat(64),
    request: "unknown",
    cleanup: "confirmed",
    result: {
      status: "blocked",
      reason: "docker_restart_stop_unconfirmed",
      request: "not_issued",
      effectOutcomeUnknown: false,
    },
  };
  const restartGuard =
    "!isDockerRestartCheckpointSettled(operation.dockerRestart)";
  assert.equal(body.split(restartGuard).length - 1, 1);
  const guardMutant = runInThisContext(
    `(function(prepareStateOperationSnapshot, decodeStateSnapshot, encodeStateValue, isDockerRestartCheckpointSettled) { ${body.replace(restartGuard, "false")}; return isInitialOperationHost; })`,
  )(
    prepareStateOperationSnapshot,
    stateModel.decodeStateSnapshot,
    encodeStateValue,
    isDockerRestartCheckpointSettled,
  );
  const restartOperation = {
    ...retired,
    dockerRestart: settledRestart,
  };
  /**
   * 実操作へ相関した候補の合法性を確認して評価引数へ戻す。
   * @responsibility codec拒否と初期Taskの意味上の拒否を分離する。
   * @trace PRL-UT-006
   * @precondition 同じIdentityを保持した候補操作を受け取る。
   * @stimulus 元Snapshotへ差し戻して実codecで復号する。
   * @observation 復号成功と対象操作の存在。
   * @oracle 不合法な候補をguardの負例として数えない。
   * @cleanup N/A: メモリだけを使用する。
   * @boundary 現在状態codecと純粋な初期Task判定。
   */
  function restartEvaluationArgs(changed: unknown): unknown[] {
    const candidate = structuredClone(before);
    candidate.operations = candidate.operations.map((item: typeof target) =>
      item.recoveryId === retired.recoveryId ? changed : item,
    );
    const decoded = stateModel.decodeStateSnapshot(
      Buffer.from(`${encodeStateValue(candidate)}\n`),
      before.repositoryBinding,
    );
    assert.ok(decoded, "restart_candidate_must_be_codec_legal");
    const operation = decoded.snapshot.operations.find(
      (item) => item.recoveryId === retired.recoveryId,
    );
    assert.ok(operation);
    return [
      operation,
      decoded.snapshot,
      retired.host.currentToken,
      "host_only",
    ];
  }
  const restartArgs = restartEvaluationArgs(restartOperation);
  assert.equal(evaluate(...restartArgs), true);
  const changedLeaseArgs = restartEvaluationArgs({
    ...restartOperation,
    lease: "released",
  });
  assert.equal(evaluate(...changedLeaseArgs), false);
  assert.throws(() => assert.equal(evaluateMutant(...changedLeaseArgs), false));
  for (const checkpoint of [
    { ...settledRestart, cleanup: "unknown" },
    { ...settledRestart, result: null },
    {
      ...settledRestart,
      result: { ...settledRestart.result, effectOutcomeUnknown: true },
    },
    {
      ...settledRestart,
      result: { ...settledRestart.result, request: "unknown" },
    },
  ]) {
    const args = restartEvaluationArgs({
      ...restartOperation,
      dockerRestart: checkpoint,
    });
    assert.equal(evaluate(...args), false);
    assert.throws(() => assert.equal(guardMutant(...args), false));
  }
  for (const field of [
    "phase",
    "lease",
    "dockerRestart",
    "primaryFailure",
    "outcome",
    "summarySha256",
    "history",
  ]) {
    const changed = structuredClone(retired);
    changed[field] =
      field === "phase"
        ? "awaiting_delivery"
        : field === "lease"
          ? "released"
          : { changed: true };
    assert.equal(
      evaluate(changed, before, changed.host.currentToken, "host_only"),
      false,
      field,
    );
  }
  for (const field of Object.keys(retired.execution)) {
    const changed = structuredClone(retired);
    changed.execution[field] =
      field === "workspaceReusable"
        ? true
        : field === "ownerEffect"
          ? "active"
          : "unknown";
    if (field === "workspaceReusable") {
      // codec自体が常にfalseを要求する項目で、合法負例には数えない。
      const invalid = structuredClone(before);
      invalid.operations = invalid.operations.map((item: typeof target) =>
        item.recoveryId === changed.recoveryId ? changed : item,
      );
      assert.equal(
        stateModel.decodeStateSnapshot(
          Buffer.from(`${encodeStateValue(invalid)}\n`),
          before.repositoryBinding,
        ),
        null,
      );
      assert.equal(
        evaluate(changed, before, changed.host.currentToken, "host_only"),
        false,
      );
    } else assertLegalRejected(changed);
  }
  for (let index = 0; index < 5; index++) {
    const frame = createResourceBookFixture(
      identity.ownershipLabel,
      "planned",
      [
        "create_egress_network",
        "create_internal_network",
        "create_provider",
        "create_proxy",
        "create_subscription_auth_probe",
      ],
    );
    const resource = frame.snapshot.resources[index];
    assert.ok(resource);
    for (const variant of [
      "intent",
      "not_issued",
      "receipt",
      "unknown",
      "absent",
    ]) {
      let book = stateModel.applyResourceEvent(null, {
        event: "submission",
        key: resource.key,
        snapshot: frame.snapshot,
        cleanup: frame.cleanup,
      });
      assert.ok(book);
      if (variant === "not_issued")
        book = stateModel.applyResourceEvent(book, {
          event: "not_issued",
          key: resource.key,
        });
      if (variant === "receipt" || variant === "absent") {
        const snapshot = {
          resources: frame.snapshot.resources.map((r) =>
            r.key === resource.key
              ? {
                  ...r,
                  request: "issued" as const,
                  identity: { ...r.identity, dockerId: "f".repeat(64) },
                }
              : r,
          ),
        };
        book = stateModel.applyResourceEvent(book, {
          event: "receipt",
          key: resource.key,
          snapshot,
          cleanup: frame.cleanup,
        });
        assert.ok(book);
        if (variant === "absent")
          book = stateModel.applyResourceCleanup(
            book,
            snapshot,
            snapshot.resources.map((r) => ({
              key: r.key,
              observation: r.key === resource.key ? "absent" : "not_requested",
            })),
            {
              recoveryId: retired.recoveryId,
              previousPayloadSha256: "a".repeat(64),
            },
          );
      }
      if (variant === "unknown") {
        assert.ok(book);
        book = stateModel.applyResourceCleanup(
          book,
          book.snapshot,
          book.snapshot.resources.map((r) => ({
            key: r.key,
            observation: r.key === resource.key ? "unknown" : "not_requested",
          })),
          {
            recoveryId: retired.recoveryId,
            previousPayloadSha256: "a".repeat(64),
          },
        );
      }
      assert.ok(book);
      const changed = structuredClone(retired);
      changed.resources = book;
      assertLegalRejected(changed);
    }
    const valid = createResourceBookFixture(
      identity.ownershipLabel,
      "absent",
      frame.snapshot.resources.map((r) => r.key),
    );
    for (const field of [
      "dockerId",
      "receiptSource",
      "observation",
      "absenceEvidenceSha256",
    ]) {
      const changed = structuredClone(retired);
      changed.resources = structuredClone(valid);
      if (field === "dockerId")
        changed.resources.snapshot.resources[index].identity.dockerId =
          "changed";
      else changed.resources.checkpoints[index][field] = "changed";
      assert.equal(
        evaluate(changed, before, changed.host.currentToken, "host_only"),
        false,
        index + ":" + field,
      );
    }
  }
  const initialHost = {
    parsed: {
      rootName: identity.initialHostRecovery.record.rootName,
      nonce: identity.initialHostRecoveryId.split(".")[2],
    },
    record: identity.initialHostRecovery.record,
  };
  const successor = structuredClone(retired);
  successor.host.currentToken = `host.${initialHost.parsed.rootName}.${initialHost.parsed.nonce}.${createHash(
    "sha256",
  )
    .update(
      `${JSON.stringify({ ...initialHost.record, state: "docker_submission_started" })}\n`,
    )
    .digest("hex")}`;
  assertLegalRejected(successor);
  assert.equal(legalRejections, 30);
  for (const field of ["currentToken", "pendingTransitionJson", "cleanup"]) {
    const changed = structuredClone(retired);
    changed.host[field] = "changed";
    assert.equal(
      evaluate(changed, before, changed.host.currentToken, "host_only"),
      false,
      field,
    );
  }
  for (const collection of ["unresolvedRecoveries", "pendingDeliveries"]) {
    for (const key of ["recoveryId", "operationNonce"]) {
      const changed = structuredClone(before);
      changed[collection].push({
        [key]:
          key === "recoveryId" ? retired.recoveryId : identity.operationNonce,
      });
      assert.equal(
        evaluate(retired, changed, retired.host.currentToken, "host_only"),
        false,
        `${collection}:${key}`,
      );
    }
  }

  const dependencies = {
    prepareStateOperationSnapshot,
    decodeStateSnapshot,
    encodeStateValue,
    isDockerRestartCheckpointSettled,
  };
  for (const omitted of Object.keys(dependencies)) {
    const keys = Object.keys(dependencies);
    const invoke = runInThisContext(
      "(function(" +
        keys.join(",") +
        ") { " +
        body +
        "; return isInitialOperationHost; })",
    )(
      ...Object.entries(dependencies).map(([key, value]) =>
        key === omitted ? undefined : value,
      ),
    );
    assert.throws(
      () => invoke(retired, before),
      { name: "TypeError" },
      omitted,
    );
  }
});

import {
  applyResourceCleanup,
  isDockerRestartCheckpointSettled,
} from "../../../src/index.ts";
import { prepareStateOperationSnapshot } from "../../../src/state/validation.ts";

/**
 * 正常終了の保存・履歴・配送相関をDomain保存Ownerで反証する。
 * @packageDocumentation
 * @responsibility 偽Context、元結果、pending、一次失敗、Consumer別終了と一回使用を検査する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @level IT
 * @scope 自己生成Repository、実保存、有限の合成Host観測。
 * @boundary 保存Ownerのみ。実Host・Docker・Providerの終了証明はCoordinator試験が担う。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { getRepository } from "../../../version-control/src/index.ts";
import {
  prepareOperationCompletion,
  publishOwnedHistory,
  readOwnedSettlementSnapshot,
  writeOwnedHistoryCheckpoint,
  writeOwnedSettlement,
} from "../../src/attempt/crud.ts";
import { createDockerRestartRequestId } from "../../src/attempt/validation.ts";
import { operationSummaryBytes } from "../../src/history/operations.ts";
import * as domain from "../../src/index.ts";
import {
  applyResourceEvent,
  type OperationResources,
} from "../../src/index.ts";
import { readState } from "../../src/state/crud.ts";
import {
  decodeStateSnapshot,
  prepareStateCompletionSnapshot,
} from "../../src/state/validation.ts";
import { encodeStateValue } from "../../src/state/operations.ts";
import * as stateKernelLocks from "../../src/storage/lock.ts";
import { observeExecutionStorageRepository } from "../../src/storage/lock.ts";
import { writeOwnedStateSnapshot } from "../../src/storage/publication.ts";
import * as areaRequirement from "../../src/storage/store.ts";
import * as areaInitialization from "../../src/storage/store.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
import { createResourceBookFixture } from "../support/resource-operation.ts";
import { createRuntimeStorageSourceFixture } from "../support/runtime-storage-source.ts";

/**
 * transient終了保存のReader故障をDomain自身で反証する。
 * @responsibility 解放不明・拒否・例外・二回目Owner失効・出版証拠欠落でWriterを呼ばない。
 * @trace ERB-IT-014
 * @precondition 私有の終了Writer本文と有限の同期観測だけを使う。
 * @stimulus 五つのReader故障を同じOwner借用へ与える。
 * @observation Writer到達零、Owner確認回数、理由・解放状態。
 * @oracle 観測失敗を正常保存へ補完せず元の有限結果を保持する。
 * @cleanup 値だけで外部資源なし。
 * @boundary Domain保存guardだけ。Host・Kernel・物理I/O成立は別試験。
 */
test("transient終了WriterはReader五故障を保存成功へ補完しない", () => {
  const source = fs.readFileSync(
    new URL("../../src/state/crud.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("export function completeRecovery(");
  const end = source.indexOf("\n/**", start);
  assert.ok(start >= 0 && end > start);
  const storeBody = stripTypeScriptTypes(
    source.slice(start, end).replaceAll("export function", "function"),
  );

  for (const scenario of [
    "reader_unlock_failed",
    "reader_rejected",
    "reader_throw",
    "reader_owner_expired",
    "reader_publication_missing",
  ]) {
    const receivedRoot = {},
      id = "exact",
      owner = () => true;
    const result = (() => {
      if (scenario.startsWith("reader_")) {
        let writes = 0;
        const save = runInNewContext(`${storeBody}; completeRecovery`, {
          Object,
          settlements: new WeakMap(),
          observeExecutionRecoveryRepository: () => ({}),
          readStateSnapshot: () => ({
            status: "completed",
            reason: "fixture_current_ready",
            lockReleased: true,
            value: { snapshot: { managedExecutions: [] } },
          }),
          readRecoveryState: (
            _root: unknown,
            request: { kind: string; recoveryId?: unknown },
          ) => {
            switch (request.kind) {
              case "execution_completion":
                return (() => {
                  if (scenario === "reader_throw") throw new Error("fixture");
                  if (
                    scenario === "reader_owner_expired" ||
                    scenario === "reader_publication_missing"
                  )
                    return {
                      status: "completed",
                      reason: "fixture_reader_ready",
                      lockReleased: true,
                      currentCompletionPublication:
                        scenario === "reader_publication_missing" ? null : {},
                      value: {
                        snapshot: {
                          operations: [{ kind: "docker_task", recoveryId: id }],
                        },
                      },
                    };
                  return {
                    status: "blocked",
                    reason: "fixture_reader_unconfirmed",
                    lockReleased: scenario !== "reader_unlock_failed",
                    currentCompletionPublication: null,
                    value: null,
                  };
                })();
              default:
                throw new Error("unexpected recovery read: " + request.kind);
            }
          },
          writeStateSnapshot(_a: unknown, repository: unknown) {
            if (repository) writes++;
            return {
              status: "blocked",
              reason: "coordinator_state_input_invalid",
              snapshotConfirmed: false,
              lockReleased: true,
              filesystemEffectIssued: false,
            };
          },
        }) as (
          root: unknown,
          id: string,
          owner: () => boolean,
          kind: "docker_task",
        ) => object;
        let confirmations = 0;
        const saved = save(
          receivedRoot,
          id,
          () => {
            confirmations++;
            return (
              owner() &&
              !(scenario === "reader_owner_expired" && confirmations === 3)
            );
          },
          "docker_task",
        );
        if (scenario === "reader_owner_expired") assert.equal(confirmations, 3);
        assert.equal(writes, 0, scenario);
        return saved;
      }

      throw Error("reader_fixture_unreachable");
    })() as Record<string, unknown>;
    assert.equal(result.status, "blocked", scenario);
    assert.equal(result.snapshotConfirmed, false, scenario);
    assert.equal(
      result.lockReleased,
      scenario !== "reader_unlock_failed",
      scenario,
    );
    assert.equal(
      result.reason,
      [
        "reader_throw",
        "reader_owner_expired",
        "reader_publication_missing",
      ].includes(scenario)
        ? "coordinator_state_input_invalid"
        : "fixture_reader_unconfirmed",
      scenario,
    );
  }
});

/**
 * 元の有限入力と保存結果を一つの実Storeで照合する。
 * @responsibility Hostの成功を型や保存値から推定しない。
 * @trace ERB-IT-014
 * @precondition 自己生成Gitと正規codecで確認した合成操作を用いる。
 * @stimulus 元の結果object、清掃照合、誤相関、保存故障と再入場を与える。
 * @observation state/history全文、改訂、pending、解放と後続停止。
 * @oracle 別Context・別結果・未確認・失効では成功せず、一次失敗と対象外を保全する。
 * @cleanup 全Module mock復元後に今回の試験Rootだけを清掃する。
 * @boundary 実保存と合成の有限Host観測。実行Authorityは発行しない。
 */
test("Host Windows: 正常終端保存は元入力・履歴・単独終了と一回証拠を同じOwnerへ結合する", {
  skip: process.platform !== "win32",
}, async (t) => {
  const directory = createRepositoryTestDirectory("runtime-settlement-");
  const root = directory.path;
  const otherRoot = path.join(root, "other-repository");
  execFileSync("git", ["init", "--quiet", otherRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      otherRoot,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "synthetic other",
    ],
    { windowsHide: true },
  );
  const verifiedOtherRoot = getRepository(otherRoot);
  assert.equal(verifiedOtherRoot.status, "completed");
  if (verifiedOtherRoot.status !== "completed")
    throw Error("fixture_other_root_invalid");
  assert.ok(verifiedOtherRoot.capability);
  const originalFsync = fs.fsyncSync;
  t.after(() => directory.cleanup());
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "synthetic",
    ],
    { windowsHide: true },
  );
  const verifiedRoot = getRepository(root);
  assert.equal(verifiedRoot.status, "completed");
  if (verifiedRoot.status !== "completed") throw Error("fixture_root_invalid");
  const observed = observeExecutionStorageRepository(verifiedRoot.capability);
  assert.ok(observed);
  const binding = observed.repositoryBinding;
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

  const initial = prepareStateOperationSnapshot(null, identityJson, binding);
  assert.ok(initial);
  const initialDecoded = decodeStateSnapshot(initial, binding);
  assert.ok(initialDecoded);
  const operation = initialDecoded.snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(operation?.kind === "docker_task");
  const frame = createResourceBookFixture(identity.ownershipLabel, "planned", [
    "create_egress_network",
    "create_internal_network",
    "create_provider",
    "create_proxy",
    "create_subscription_auth_probe",
  ]);
  const resource = {
    event: "submission",
    key: "create_provider",
    snapshot: frame.snapshot,
    cleanup: frame.cleanup,
  };
  const activeBook = applyResourceEvent(null, {
    ...resource,
    snapshot: {
      resources: frame.snapshot.resources.map((r) =>
        r.key === resource.key ? { ...r, request: "unknown" } : r,
      ),
    },
  });
  assert.ok(activeBook);
  let terminalBook = activeBook;
  const repository = { ...observed, operationId: identity.operationId };
  const cleanupObservations = frame.checkpoints.map((item) => ({
    key: item.key,
    observation: "not_requested",
  }));
  const lifecycle = {
    phase: "settling",
    lease: operation.lease,
    execution: {
      ...operation.execution,
      providerStart: "unknown",
      externalSend: "unknown",
      sharedWrite: "unknown",
      ownerEffect: "unknown",
    },
    primaryFailure: {
      purpose: "create_provider",
      stage: "command_wait",
      reason: "provider_result_invalid",
      exceptionCode: null,
      commandObservation: { exitCode: 1, stdoutBytes: 12, stderrBytes: 7 },
      commandHandleObtained: true,
      responseObserved: true,
      receiptRecorded: false,
    },
    outcome: {
      status: "blocked",
      reason: "provider_result_invalid",
      cleanupConfirmed: false,
    },
    summarySha256: null,
  };

  const current = {
    ...initialDecoded.snapshot,
    operations: [
      {
        ...operation,
        ...lifecycle,
        resources: activeBook,
      },
    ],
  };
  const checkpointBytes = Buffer.from(`${encodeStateValue(current)}\n`);
  assert.ok(decodeStateSnapshot(checkpointBytes, binding));
  const area = areaRequirement.requireReadyRepositoryExecutionDataArea(
    areaInitialization.ensureRepositoryExecutionDataAreaFromWorkingDirectory(
      root,
      "domain-model",
    ),
    "settlement_fixture",
  );
  fs.writeFileSync(path.join(area.directory, "state.json"), checkpointBytes, {
    flag: "wx",
  });
  const secondBytes = initial;
  let isCleaned = false;
  let cleanupOutcome: Record<string, unknown> | null = null;
  const management = {
    identity: Object.freeze({}),
    observeRepository: () =>
      isCleaned
        ? null
        : {
            purpose: "execution",
            root: verifiedRoot.capability,
            operationId: identity.operationId,
            historyRetentionDays: 30,
            revalidate: () => !isCleaned,
          },
    observeSettlementRepository: () => ({
      purpose: "settlement",
      root: verifiedRoot.capability,
      operationId: identity.operationId,
      historyRetentionDays: 30,
      revalidate: () => true,
    }),
    captureCleanupVerification: () => (outcome: unknown) =>
      cleanupOutcome !== null && outcome === cleanupOutcome
        ? "completed"
        : null,
    verifyNotIssued: () => false,
    observeTerminal(result: unknown, id: unknown, ref: unknown) {
      if (
        result !== simulatedCompletion ||
        id !== repository.operationId ||
        (ref !== operation.recoveryId &&
          (typeof ref !== "string" || !transientRecoveryIds.has(ref)))
      )
        return null;
      return Object.freeze({
        resourceSnapshot: {
          resources: terminalBook.snapshot.resources.map((item) =>
            item.key === "create_provider" &&
            terminalBook.checkpoints.some(
              (checkpoint) =>
                checkpoint.key === item.key &&
                checkpoint.submission === "intent_saved",
            )
              ? {
                  ...item,
                  request: observedProviderId ? "issued" : "unknown",
                  identity: { ...item.identity, dockerId: observedProviderId },
                }
              : item,
          ),
        },
        resources: terminalBook.checkpoints.map((item) => ({
          key: item.key,
          observation:
            item.key === "create_provider" && item.submission === "intent_saved"
              ? observedProviderId
                ? observedProviderObservation
                : "unknown"
              : "not_requested",
        })),
        homeLeaseReleased: true,
        mountLeaseReleased: true,
        recoveryCompleted: true,
        primaryFailure: lifecycle.primaryFailure,
      });
    },
  };
  const settlement = prepareOperationCompletion(
    management,
    operation.recoveryId,
    "orchestrator",
  ).context;
  assert.ok(settlement);
  // 生Writer固有の迂回反例は、実Hostの試験からDomain保存Ownerへ移管する。
  const intentFixture = prepareStateResourceSnapshot(
    initial,
    operation.recoveryId,
    resource,
    binding,
  );
  assert.ok(intentFixture);
  const notIssuedFixture = prepareStateResourceSnapshot(
    intentFixture,
    operation.recoveryId,
    { event: "not_issued", key: resource.key },
    binding,
  );
  assert.ok(notIssuedFixture);
  const stateFileForGuard = path.join(area.directory, "state.json");
  fs.writeFileSync(stateFileForGuard, intentFixture);
  const unissuedBypass = writeOwnedStateSnapshot(management, notIssuedFixture);
  assert.equal(unissuedBypass.status, "blocked");
  assert.equal(unissuedBypass.filesystemEffectIssued, false);
  assert.deepEqual(fs.readFileSync(stateFileForGuard), intentFixture);
  fs.writeFileSync(stateFileForGuard, checkpointBytes);
  const deliveryBypass = writeOwnedStateSnapshot(
    management,
    Buffer.from(`${encodeStateValue({ ...current, pendingDeliveries: [] })}\n`),
  );
  assert.equal(deliveryBypass.status, "blocked");
  assert.equal(deliveryBypass.snapshotConfirmed, false);
  assert.deepEqual(fs.readFileSync(stateFileForGuard), checkpointBytes);
  const staleBypass = writeOwnedStateSnapshot(management, initial);
  assert.equal(staleBypass.status, "blocked");
  assert.equal(staleBypass.filesystemEffectIssued, false);
  assert.deepEqual(fs.readFileSync(stateFileForGuard), checkpointBytes);
  // この追加経路だけDocker終了観測を模擬する。本番Controllerの肯定根拠ではない。
  const simulatedCompletion = Object.freeze({
    fixture: "docker-terminal",
    status: "blocked",
    reason: "provider_result_invalid",
    cleanupConfirmed: true,
  });
  let observedProviderId: string | null = null;
  let observedProviderObservation = "absent";
  const transientRecoveryIds = new Set<string>();
  let isCompletionReleaseObservationMissing = false;
  let completionReleaseMissingAt = 1;
  let completionReleaseCount = 0;
  let completionActualReleaseConfirmed = false;
  const completionLockObservationMock = t.mock.module(
    "../../src/storage/lock.ts",
    {
      namedExports: {
        ...stateKernelLocks,
        acquireExecutionStateLock: (hash: unknown, root: string) => {
          const acquired = stateKernelLocks.acquireExecutionStateLock(
            hash,
            root,
          );
          if (acquired.status !== "acquired") return acquired;
          return {
            ...acquired,
            lock: {
              ...acquired.lock,
              release: () => {
                const released = acquired.lock.release();
                if (isCompletionReleaseObservationMissing) {
                  completionReleaseCount += 1;
                  // 出版後の再入場は保持候補を使い、更新Writerの解放だけ欠測にする。
                  if (completionReleaseCount === completionReleaseMissingAt) {
                    completionActualReleaseConfirmed = released;
                    return false;
                  }
                }
                return released;
              },
            },
          };
        },
      },
    },
  );
  t.after(() => completionLockObservationMock.restore());
  const currentCompletionKernel = await import("../../src/storage/lock.ts");
  const historyStore = createRuntimeStorageSourceFixture(undefined, {
    acquireExecutionStateLock:
      currentCompletionKernel.acquireExecutionStateLock,
  });
  const historyRuntime = historyStore;
  const historySettlement = historyRuntime.prepareOperationCompletion(
    management,
    operation.recoveryId,
    "orchestrator",
  ).context;
  const historySettlementAgain = historyRuntime.prepareOperationCompletion(
    management,
    operation.recoveryId,
    "orchestrator",
  ).context;
  assert.ok(historySettlement);
  assert.ok(historySettlementAgain);
  const initialDriverIdentity = {
    ...JSON.parse(operation.identityJson),
    operationNonce: "d".repeat(64),
  };
  const initialDriverIdentityJson = `${JSON.stringify(initialDriverIdentity)}\n`;
  const initialDriverIdentitySha256 = createHash("sha256")
    .update(initialDriverIdentityJson)
    .digest("hex");
  const initialDriverRecoveryId = `docker-task.${initialDriverIdentity.stableLogicalHomeBindingHash}.${initialDriverIdentity.operationNonce}.${initialDriverIdentitySha256}`;
  const initialContextFixture = JSON.parse(checkpointBytes.toString("utf8"));
  initialContextFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identityJson = initialDriverIdentityJson;
  initialContextFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identitySha256 = initialDriverIdentitySha256;
  initialContextFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).recoveryId = initialDriverRecoveryId;
  initialContextFixture.unresolvedRecoveries = [];
  fs.writeFileSync(
    path.join(area.directory, "state.json"),
    `${encodeStateValue(initialContextFixture)}\n`,
  );
  transientRecoveryIds.add(initialDriverRecoveryId);
  const initialDriverSettlement = historyRuntime.prepareOperationCompletion(
    management,
    initialDriverRecoveryId,
    "orchestrator",
  ).context;
  assert.ok(initialDriverSettlement);
  const transientSettlements = [];
  for (const consumer of ["coordinator_cli", "workbench"] as const) {
    const transientIdentity = {
      ...JSON.parse(operation.identityJson),
      consumer,
    };
    const identityJson = `${JSON.stringify(transientIdentity)}\n`;
    const identitySha256 = createHash("sha256")
      .update(identityJson)
      .digest("hex");
    const recoveryId: string = operation.recoveryId.replace(
      operation.identitySha256,
      identitySha256,
    );
    const fixture = JSON.parse(checkpointBytes.toString("utf8"));
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identityJson = identityJson;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identitySha256 = identitySha256;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).recoveryId = recoveryId;
    fixture.unresolvedRecoveries = [];
    fs.writeFileSync(
      path.join(area.directory, "state.json"),
      `${encodeStateValue(fixture)}\n`,
    );
    const context = historyRuntime.prepareOperationCompletion(
      management,
      recoveryId,
      consumer,
    ).context;
    const freshContext = historyRuntime.prepareOperationCompletion(
      management,
      recoveryId,
      consumer,
    ).context;
    const driverContext = historyRuntime.prepareOperationCompletion(
      management,
      recoveryId,
      consumer,
    ).context;
    assert.ok(context);
    assert.ok(freshContext);
    assert.ok(driverContext);
    transientRecoveryIds.add(recoveryId);
    transientSettlements.push({
      context,
      freshContext,
      driverContext,
      identityJson,
      identitySha256,
      recoveryId,
    });
  }
  fs.writeFileSync(path.join(area.directory, "state.json"), checkpointBytes);
  assert.equal(
    prepareOperationCompletion({}, operation.recoveryId, "orchestrator")
      .context,
    null,
  );
  for (const consumer of [undefined, "durable", { consumer: "orchestrator" }]) {
    assert.equal(
      historyRuntime.prepareOperationCompletion(
        management,
        operation.recoveryId,
        consumer,
      ).context,
      null,
    );
  }
  for (const consumer of ["coordinator_cli", "workbench"]) {
    assert.equal(
      historyRuntime.prepareOperationCompletion(
        management,
        operation.recoveryId,
        consumer,
      ).context,
      null,
    );
  }
  const beforeTerminalBytes = fs.readFileSync(
    path.join(area.directory, "state.json"),
  );
  const beforeTerminal = JSON.parse(beforeTerminalBytes.toString("utf8"));
  const terminal = {
    ...beforeTerminal,
    revision: beforeTerminal.revision + 1,
    previous: {
      revision: beforeTerminal.revision,
      payloadSha256: createHash("sha256")
        .update(beforeTerminalBytes)
        .digest("hex"),
    },
    operations: beforeTerminal.operations.map((value: typeof operation) => ({
      ...value,
      host: { ...value.host, cleanup: "confirmed" },
      execution: { ...value.execution, ownerEffect: "disabled" },
    })),
  };
  const terminalBytes = Buffer.from(`${encodeStateValue(terminal)}\n`);
  const unconfirmed = writeOwnedSettlement(settlement, terminalBytes, {});
  assert.equal(unconfirmed.status, "blocked");
  assert.equal(unconfirmed.filesystemEffectIssued, false);
  cleanupOutcome = Object.freeze({ fixture: "host-cleanup" });
  isCleaned = true;
  const terminalRead = readOwnedSettlementSnapshot(settlement);
  assert.equal(terminalRead.status, "completed");
  assert.equal(terminalRead.lockReleased, true);
  assert.deepEqual(terminalRead.value?.snapshot, beforeTerminal);
  const cleanedOwnerRecoveryRead = readState(verifiedRoot.capability, {
    scope: "recovery",
  });
  assert.equal(cleanedOwnerRecoveryRead.status, "completed");
  assert.deepEqual(cleanedOwnerRecoveryRead.value, terminalRead.value);
  assert.equal(
    terminalRead.value?.payloadSha256,
    createHash("sha256").update(beforeTerminalBytes).digest("hex"),
  );
  const forgedRead = readOwnedSettlementSnapshot({});
  assert.equal(forgedRead.status, "blocked");
  assert.equal(forgedRead.value, null);
  assert.equal(readState(management, { scope: "operation" }).status, "blocked");
  assert.equal(
    writeOwnedStateSnapshot(management, secondBytes).filesystemEffectIssued,
    false,
  );
  assert.equal(
    prepareOperationCompletion(management, operation.recoveryId, "orchestrator")
      .context,
    null,
  );
  const forged = writeOwnedSettlement({}, terminalBytes, cleanupOutcome);
  assert.equal(forged.status, "blocked");
  assert.equal(forged.filesystemEffectIssued, false);
  // 診断の初回保存は、元Controller観測と完全に一致する場合だけ成立する。
  const diagnosticBefore = JSON.parse(beforeTerminalBytes.toString("utf8"));
  diagnosticBefore.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).primaryFailure = null;
  const diagnosticBeforeBytes = Buffer.from(
    `${encodeStateValue(diagnosticBefore)}\n`,
  );
  fs.writeFileSync(
    path.join(area.directory, "state.json"),
    diagnosticBeforeBytes,
  );
  for (const primaryFailure of [
    null,
    { ...lifecycle.primaryFailure, reason: "docker_setup_deadline_exceeded" },
    { ...lifecycle.primaryFailure, commandHandleObtained: false },
    {
      ...lifecycle.primaryFailure,
      responseObserved: false,
      commandObservation: null,
    },
    { ...lifecycle.primaryFailure, receiptRecorded: true },
    { ...lifecycle.primaryFailure, stage: "command_start" },
    { ...lifecycle.primaryFailure, purpose: "create_proxy" },
    { ...lifecycle.primaryFailure, exceptionCode: "EPIPE" },
  ]) {
    const candidate = prepareStateLifecycleSnapshot(
      diagnosticBeforeBytes,
      operation.recoveryId,
      {
        ...lifecycle,
        execution: { ...lifecycle.execution, ownerEffect: "disabled" },
        primaryFailure,
      },
      repository.repositoryBinding,
    );
    assert.ok(candidate);
    const rejected = historyRuntime.writeOwnedSettlement(
      historySettlement,
      candidate,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      diagnosticBeforeBytes,
    );
  }
  const matchingDiagnostic = prepareStateLifecycleSnapshot(
    diagnosticBeforeBytes,
    operation.recoveryId,
    {
      ...lifecycle,
      execution: { ...lifecycle.execution, ownerEffect: "disabled" },
    },
    repository.repositoryBinding,
  );
  assert.ok(matchingDiagnostic);
  const diagnosticSaved = historyRuntime.writeOwnedSettlement(
    historySettlement,
    matchingDiagnostic,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(diagnosticSaved.status, "completed", diagnosticSaved.reason);
  fs.writeFileSync(
    path.join(area.directory, "state.json"),
    beforeTerminalBytes,
  );
  const terminalSaved = writeOwnedSettlement(
    settlement,
    terminalBytes,
    cleanupOutcome,
  );
  assert.equal(terminalSaved.status, "completed");
  assert.equal(terminalSaved.snapshotConfirmed, true);
  assert.equal(terminalSaved.lockReleased, true);
  assert.deepEqual(
    fs.readFileSync(path.join(area.directory, "state.json")),
    terminalBytes,
  );
  for (const completion of [
    null,
    {},
    { status: "completed", cleanupConfirmed: true, homeLeaseReleased: true },
  ]) {
    const checkpoint = writeOwnedHistoryCheckpoint(
      settlement,
      cleanupOutcome,
      completion,
    );
    assert.equal(checkpoint.status, "blocked");
    assert.equal(checkpoint.filesystemEffectIssued, false);
    assert.equal(checkpoint.snapshotConfirmed, false);
    const publication = publishOwnedHistory(
      settlement,
      cleanupOutcome,
      completion,
    );
    assert.equal(publication.status, "blocked");
    assert.equal(publication.filesystemEffectIssued, false);
    assert.equal(publication.snapshotConfirmed, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      terminalBytes,
    );
    assert.equal(
      fs.existsSync(path.join(area.directory, "history.jsonl")),
      false,
    );
  }
  const savedTerminalRead = readOwnedSettlementSnapshot(settlement);
  assert.equal(savedTerminalRead.status, "completed");
  assert.deepEqual(savedTerminalRead.value?.snapshot, terminal);
  assert.equal(
    savedTerminalRead.value?.payloadSha256,
    createHash("sha256").update(terminalBytes).digest("hex"),
  );
  const missingTargetBytes = Buffer.from(
    `${encodeStateValue({ ...terminal, operations: [], unresolvedRecoveries: [] })}\n`,
  );
  const stateFile = path.join(area.directory, "state.json");
  fs.writeFileSync(stateFile, missingTargetBytes);
  const missingTargetRead = readOwnedSettlementSnapshot(settlement);
  assert.equal(missingTargetRead.status, "blocked");
  assert.equal(missingTargetRead.value, null);
  assert.equal(
    missingTargetRead.reason,
    "coordinator_state_settlement_target_invalid",
  );
  assert.deepEqual(fs.readFileSync(stateFile), missingTargetBytes);
  fs.writeFileSync(stateFile, terminalBytes);
  const gitDirectory = path.join(root, ".git");
  const retainedGitDirectory = path.join(root, "git-unavailable");
  fs.renameSync(gitDirectory, retainedGitDirectory);
  try {
    const changedRootRead = readOwnedSettlementSnapshot(settlement);
    assert.equal(changedRootRead.status, "blocked");
    assert.equal(changedRootRead.value, null);
    assert.deepEqual(fs.readFileSync(stateFile), terminalBytes);
  } finally {
    fs.renameSync(retainedGitDirectory, gitDirectory);
  }
  const pendingFile = path.join(area.directory, "state.pending.json");
  fs.writeFileSync(pendingFile, terminalBytes);
  const pendingRead = readOwnedSettlementSnapshot(settlement);
  assert.equal(pendingRead.status, "blocked");
  assert.equal(pendingRead.value, null);
  assert.equal(pendingRead.reason, "coordinator_state_reentry_required");
  assert.deepEqual(fs.readFileSync(pendingFile), terminalBytes);
  fs.unlinkSync(pendingFile);
  const unsafe = {
    ...terminal,
    revision: terminal.revision + 1,
    previous: {
      revision: terminal.revision,
      payloadSha256: createHash("sha256").update(terminalBytes).digest("hex"),
    },
    operations: terminal.operations.map((value: typeof operation) => ({
      ...value,
      phase: "executing",
    })),
  };
  const unprovenCleanup = {
    ...unsafe,
    operations: terminal.operations.map((value: typeof operation) => ({
      ...value,
      outcome: { ...value.outcome, cleanupConfirmed: true },
    })),
  };
  const unprovenLease = {
    ...unsafe,
    operations: terminal.operations.map((value: typeof operation) => ({
      ...value,
      lease: "released",
    })),
  };
  for (const invalid of [unsafe, unprovenCleanup, unprovenLease]) {
    const unsafeSaved = writeOwnedSettlement(
      settlement,
      Buffer.from(`${encodeStateValue(invalid)}\n`),
      cleanupOutcome,
    );
    assert.equal(unsafeSaved.status, "blocked");
    assert.equal(unsafeSaved.filesystemEffectIssued, false);
    assert.deepEqual(
      fs.readFileSync(path.join(area.directory, "state.json")),
      terminalBytes,
    );
  }
  const terminalOperation = decodeStateSnapshot(
    terminalBytes,
    repository.repositoryBinding,
  )?.snapshot.operations.find((item) => item.kind === "docker_task");
  assert.ok(terminalOperation);
  const summaryBytes = operationSummaryBytes(terminalOperation);
  const summary = {
    summarySha256: createHash("sha256").update(summaryBytes).digest("hex"),
  };
  const occurredAt = "2026-10-08T00:00:00.000Z";
  const line = Buffer.from(
    `${encodeStateValue({ schema: "crdd-coordinator/history-row/v2", occurredAt, summary: JSON.parse(summaryBytes.toString("utf8")) })}\n`,
  );
  const alteredState = structuredClone(terminal);
  const alteredTask = alteredState.operations.find(
    (item: { kind: string }) => item.kind === "docker_task",
  );
  assert.ok(alteredTask?.resources);
  alteredTask.resources = {
    ...alteredTask.resources,
    checkpoints: alteredTask.resources.checkpoints.map(
      (c: OperationResources["checkpoints"][number]) =>
        c.key === resource.key
          ? { ...c, observation: "unknown", absenceEvidenceSha256: null }
          : c,
    ),
  };
  const alteredResources = Buffer.from(`${encodeStateValue(alteredState)}\n`);
  assert.ok(decodeStateSnapshot(alteredResources, binding));
  for (const dockerCompletion of [
    undefined,
    Object.freeze({
      status: "completed",
      cleanupConfirmed: true,
      resourceObservations: cleanupObservations,
    }),
  ]) {
    const rejected = writeOwnedSettlement(
      settlement,
      alteredResources,
      cleanupOutcome,
      dockerCompletion,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), terminalBytes);
  }
  assert.ok(summary);
  for (const confirmed of [false, true]) {
    const bypass = {
      ...terminal,
      revision: terminal.revision + 1,
      previous: {
        revision: terminal.revision,
        payloadSha256: createHash("sha256").update(terminalBytes).digest("hex"),
      },
      operations: terminal.operations.map((value: typeof operation) => ({
        ...value,
        summarySha256: summary.summarySha256,
        history: {
          occurredAt,
          lineSha256: createHash("sha256").update(line).digest("hex"),
          confirmed,
        },
      })),
    };
    const rejected = writeOwnedSettlement(
      settlement,
      Buffer.from(`${encodeStateValue(bypass)}\n`),
      cleanupOutcome,
    );
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), terminalBytes);
  }
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
  // 保存の正例用に未要求五資源の終端fixtureを置く。実Provider完了を主張しない。
  const historyFixture = {
    ...terminal,
    operations: terminal.operations.map((value: typeof operation) => ({
      ...value,
      resources: frame,
      lease: "released",
      execution: {
        ...value.execution,
        providerStart: "not_started",
        externalSend: "not_issued",
        sharedWrite: "not_issued",
      },
      outcome: { ...value.outcome, cleanupConfirmed: true },
    })),
  };
  terminalBook = frame;
  fs.writeFileSync(stateFile, `${encodeStateValue(historyFixture)}\n`);
  const beforeHistoryCheckpoint = fs.readFileSync(stateFile);
  for (const [hostResult, completion] of [
    [{ ...cleanupOutcome }, simulatedCompletion],
    [cleanupOutcome, { ...simulatedCompletion }],
  ] as const) {
    const refused = historyRuntime.writeOwnedHistoryCheckpoint(
      historySettlement,
      hostResult,
      completion,
    );
    assert.equal(refused.status, "blocked");
    assert.equal(refused.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), beforeHistoryCheckpoint);
  }
  const fixed = historyRuntime.writeOwnedHistoryCheckpoint(
    historySettlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(fixed.status, "completed", fixed.reason);
  assert.equal(fixed.snapshotConfirmed, true);
  assert.equal(fixed.lockReleased, true);
  const fixedCheckpointBytes = fs.readFileSync(stateFile);
  const earlyCompletion = historyRuntime.completeOwnedSettlement(
    historySettlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(
    earlyCompletion.status,
    "blocked",
    "履歴未確認のOperationは除去しない",
  );
  assert.deepEqual(fs.readFileSync(stateFile), fixedCheckpointBytes);
  const unverifiedAcceptance = prepareStateReferencesSnapshot(
    fixedCheckpointBytes,
    operation.recoveryId,
    { recovery: null, deliveries: [] },
    repository.repositoryBinding,
  );
  assert.equal(unverifiedAcceptance, null, "廃止した配送入力を受理しない");
  const refusedAcceptance = historyRuntime.writeOwnedSettlement(
    historySettlement,
    unverifiedAcceptance,
    cleanupOutcome,
  );
  assert.equal(refusedAcceptance.status, "blocked");
  assert.equal(refusedAcceptance.snapshotConfirmed, false);
  assert.deepEqual(fs.readFileSync(stateFile), fixedCheckpointBytes);
  const fixedState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.equal(
    fixedState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history.confirmed,
    false,
  );
  const fixedTimestamp = fixedState.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).history.occurredAt;
  const fixedBytes = fs.readFileSync(stateFile);
  const forgedHistory = historyRuntime.publishOwnedHistory(
    historySettlement,
    cleanupOutcome,
    { ...simulatedCompletion },
  );
  assert.equal(forgedHistory.status, "blocked");
  assert.equal(forgedHistory.filesystemEffectIssued, false);
  assert.deepEqual(fs.readFileSync(stateFile), fixedBytes);
  const historyPendingFile = path.join(area.directory, "history.pending.jsonl");
  let historySyncFailed = false;
  fs.fsyncSync = (fd) => {
    if (!historySyncFailed && fs.existsSync(historyPendingFile)) {
      historySyncFailed = true;
      throw new Error("fixture_history_sync_failure");
    }
    originalFsync(fd);
  };
  try {
    const unflushed = historyRuntime.publishOwnedHistory(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(unflushed.status, "blocked");
    assert.equal(unflushed.snapshotConfirmed, false);
    assert.deepEqual(fs.readFileSync(stateFile), fixedBytes);
  } finally {
    fs.fsyncSync = originalFsync;
  }
  assert.equal(historySyncFailed, true);
  const pendingHistory = fs.readFileSync(historyPendingFile);
  fs.writeFileSync(historyPendingFile, Buffer.alloc(0));
  const alteredPending = historyRuntime.publishOwnedHistory(
    historySettlementAgain,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(alteredPending.status, "blocked");
  assert.deepEqual(fs.readFileSync(stateFile), fixedBytes);
  assert.equal(fs.readFileSync(historyPendingFile).length, 0);
  fs.writeFileSync(historyPendingFile, pendingHistory);
  // 履歴公開後・Snapshot公開前で失敗しても、別Contextから同じ行を再利用する。
  const originalRename = fs.renameSync;
  let statePublishFailed = false;
  fs.renameSync = (from, to) => {
    if (String(from).endsWith("state.pending.json") && !statePublishFailed) {
      statePublishFailed = true;
      throw new Error("fixture_state_publish_failure");
    }
    originalRename(from, to);
  };
  try {
    const interrupted = historyRuntime.publishOwnedHistory(
      historySettlement,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(interrupted.status, "blocked");
    assert.equal(interrupted.snapshotConfirmed, false);
  } finally {
    fs.renameSync = originalRename;
  }
  assert.equal(statePublishFailed, true);
  const historyFile = path.join(area.directory, "history.jsonl");
  const firstHistory = fs.readFileSync(historyFile);
  assert.equal(firstHistory.toString("utf8").trim().split("\n").length, 1);
  const resumed = historyRuntime.publishOwnedHistory(
    historySettlementAgain,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(resumed.status, "completed", resumed.reason);
  assert.equal(resumed.snapshotConfirmed, true);
  assert.equal(resumed.lockReleased, true);
  assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
  const confirmedState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.equal(
    confirmedState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history.confirmed,
    true,
  );
  assert.equal(
    confirmedState.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history.occurredAt,
    fixedTimestamp,
  );
  assert.equal(Object.hasOwn(confirmedState, "pendingDeliveries"), false);
  const repeated = historyRuntime.publishOwnedHistory(
    historySettlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(repeated.status, "completed", repeated.reason);
  assert.deepEqual(fs.readFileSync(historyFile), firstHistory);
  assert.deepEqual(fs.readdirSync(area.directory).sort(), [
    "history.jsonl",
    "state.json",
  ]);
  // 耐久結果の受領・Operation除去はTask原子保存の実Writer試験へ移管する。
  const acceptedProjectBytes = fs.readFileSync(stateFile);
  // 固定済み不存在根拠は再生成せず、元観測の意味を照合する。
  const identifiedFixture = JSON.parse(acceptedProjectBytes.toString("utf8"));
  const identifiedId = "a".repeat(64);
  identifiedFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).summarySha256 = null;
  identifiedFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).history = null;
  const identifiedTask = identifiedFixture.operations.find(
    (item: { kind: string }) => item.kind === "docker_task",
  );
  assert.ok(identifiedTask);
  const knownBook: OperationResources = {
    ...frame,
    snapshot: {
      resources: frame.snapshot.resources.map((r) =>
        r.key === resource.key
          ? {
              ...r,
              request: "issued",
              identity: { ...r.identity, dockerId: identifiedId },
            }
          : r,
      ),
    },
    checkpoints: frame.checkpoints.map((c) =>
      c.key === resource.key
        ? {
            ...c,
            submission: "intent_saved",
            receiptSource: "docker_create_result",
            observation: "absent",
            absenceEvidenceSha256: "c".repeat(64),
          }
        : c,
    ),
  };
  identifiedTask.resources = knownBook;
  const identifiedFixed = prepareStateHistorySnapshot(
    Buffer.from(`${encodeStateValue(identifiedFixture)}\n`),
    operation.recoveryId,
    fixedTimestamp,
    false,
    repository.repositoryBinding,
  );
  assert.ok(identifiedFixed);
  const identifiedReady = prepareStateHistorySnapshot(
    identifiedFixed,
    operation.recoveryId,
    fixedTimestamp,
    true,
    repository.repositoryBinding,
  );
  assert.ok(identifiedReady);
  fs.writeFileSync(stateFile, identifiedReady);
  terminalBook = knownBook;
  observedProviderId = identifiedId;
  try {
    const firstDriver = historyRuntime.completeOperation(
      historySettlementAgain,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(firstDriver.status, "completed", firstDriver.reason);
    assert.equal(Object.hasOwn(firstDriver, "deliveryPending"), false);
    assert.equal(Object.hasOwn(firstDriver, "result"), false);
    const identifiedDelivered = fs.readFileSync(stateFile);
    const repeatedDriver = historyRuntime.completeOperation(
      historySettlementAgain,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(repeatedDriver.status, "completed", repeatedDriver.reason);
    assert.equal(Object.hasOwn(repeatedDriver, "deliveryPending"), false);
    assert.deepEqual(fs.readFileSync(stateFile), identifiedDelivered);
    for (const mismatch of ["different_id", "unknown_observation"]) {
      observedProviderId =
        mismatch === "different_id" ? "b".repeat(64) : identifiedId;
      observedProviderObservation =
        mismatch === "unknown_observation" ? "unknown" : "absent";
      const rejectedDriver = historyRuntime.completeOperation(
        historySettlementAgain,
        cleanupOutcome,
        simulatedCompletion,
      );
      assert.equal(rejectedDriver.status, "blocked");
      assert.equal(rejectedDriver.filesystemEffectIssued, false);
      assert.deepEqual(fs.readFileSync(stateFile), identifiedDelivered);
    }
    observedProviderId = identifiedId;
    observedProviderObservation = "absent";
  } finally {
    observedProviderId = null;
    observedProviderObservation = "absent";
    terminalBook = frame;
  }
  // 未固定終端から履歴保存と単独Operation除去へ一度で接続する。
  const initialDriverFixture = JSON.parse(
    acceptedProjectBytes.toString("utf8"),
  );
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identityJson = initialDriverIdentityJson;
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).identitySha256 = initialDriverIdentitySha256;
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).recoveryId = initialDriverRecoveryId;
  initialDriverFixture.unresolvedRecoveries = [];
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).summarySha256 = null;
  initialDriverFixture.operations.find(
    (item: { kind?: unknown }) => item.kind === "docker_task",
  ).history = null;
  const initialDriverBytes = Buffer.from(
    `${encodeStateValue(initialDriverFixture)}\n`,
  );
  fs.writeFileSync(stateFile, initialDriverBytes);
  try {
    fs.unlinkSync(historyFile);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "ENOENT"
    )
      throw error;
  }
  for (const [context, host, completion] of [
    [{ ...initialDriverSettlement }, cleanupOutcome, simulatedCompletion],
    [initialDriverSettlement, { ...cleanupOutcome }, simulatedCompletion],
    [initialDriverSettlement, cleanupOutcome, { ...simulatedCompletion }],
  ]) {
    const refusedDriver = historyRuntime.completeOperation(
      context,
      host,
      completion,
    );
    assert.equal(refusedDriver.status, "blocked");
    assert.equal(refusedDriver.inputAccepted, false);
    assert.equal(refusedDriver.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), initialDriverBytes);
    assert.equal(fs.existsSync(historyFile), false);
  }
  const initialDriver = historyRuntime.completeOperation(
    initialDriverSettlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(initialDriver.status, "completed", initialDriver.reason);
  assert.equal(initialDriver.inputAccepted, true);
  assert.equal(Object.hasOwn(initialDriver, "deliveryPending"), false);
  assert.equal(Object.hasOwn(initialDriver, "result"), false);
  const initialDeliveredBytes = fs.readFileSync(stateFile);
  const initialHistoryBytes = fs.readFileSync(historyFile);
  const initialDelivered = JSON.parse(initialDeliveredBytes.toString("utf8"));
  assert.equal(
    initialDelivered.operations.some(
      (item: { recoveryId?: unknown }) =>
        item.recoveryId === initialDriverRecoveryId,
    ),
    false,
  );
  assert.match(initialHistoryBytes.toString("utf8"), /operation-summary\/v5/);
  assert.equal(Object.hasOwn(initialDelivered, "pendingDeliveries"), false);
  const repeatedInitialDriver = historyRuntime.completeOperation(
    initialDriverSettlement,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(
    repeatedInitialDriver.status,
    "completed",
    repeatedInitialDriver.reason,
  );
  assert.equal(Object.hasOwn(repeatedInitialDriver, "deliveryPending"), false);
  assert.deepEqual(fs.readFileSync(stateFile), initialDeliveredBytes);
  assert.deepEqual(fs.readFileSync(historyFile), initialHistoryBytes);
  fs.writeFileSync(historyFile, firstHistory);
  // 保存Identityと実Host清掃は固定し、Docker終端だけ模擬する一時返却のWriter試験。
  for (const transient of transientSettlements) {
    const fixture = JSON.parse(acceptedProjectBytes.toString("utf8"));
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identityJson = transient.identityJson;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).identitySha256 = transient.identitySha256;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).recoveryId = transient.recoveryId;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).summarySha256 = null;
    fixture.operations.find(
      (item: { kind?: unknown }) => item.kind === "docker_task",
    ).history = null;
    fixture.unresolvedRecoveries = [];
    fs.writeFileSync(stateFile, `${encodeStateValue(fixture)}\n`);
    fs.unlinkSync(historyFile);
    const transientDriver = historyRuntime.completeOperation(
      transient.driverContext,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(transientDriver.status, "completed", transientDriver.reason);
    assert.equal(Object.hasOwn(transientDriver, "deliveryPending"), false);
    assert.equal(Object.hasOwn(transientDriver, "result"), false);
    const transientDriverState = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    assert.equal(transientDriverState.operations.length, 0);
    assert.equal(
      Object.hasOwn(transientDriverState, "pendingDeliveries"),
      false,
    );
    assert.equal(
      fs.readFileSync(historyFile, "utf8").trim().split("\n").length,
      1,
    );
    // 完了した実保存と履歴を、統合した公開Readerから同じ相関で確認する。
    const completionRead = (
      correlationId: string,
    ): ReturnType<typeof readState> =>
      readState(verifiedRoot.capability, {
        scope: "recovery",
        input: {
          kind: "completion",
          recoveryId: transient.recoveryId,
          correlationId,
        },
      });
    const completedObservation = completionRead("task-operation-a");
    assert.equal(completedObservation.operationCompletionConfirmed, true);
    assert.equal(completedObservation.lockReleased, true);
    assert.equal(
      completionRead("different-operation").operationCompletionConfirmed,
      false,
    );
    const completionHistory = fs.readFileSync(historyFile);
    const completedState = fs.readFileSync(stateFile);
    for (const mutation of ["missing", "duplicate"] as const) {
      try {
        if (mutation === "missing") fs.unlinkSync(historyFile);
        else
          fs.writeFileSync(
            historyFile,
            Buffer.concat([completionHistory, completionHistory]),
          );
        assert.equal(
          completionRead("task-operation-a").operationCompletionConfirmed,
          false,
          mutation,
        );
        assert.deepEqual(fs.readFileSync(stateFile), completedState);
      } finally {
        fs.writeFileSync(historyFile, completionHistory);
      }
    }

    fs.writeFileSync(historyFile, firstHistory);
    const transientFixed = prepareStateHistorySnapshot(
      Buffer.from(`${encodeStateValue(fixture)}\n`),
      transient.recoveryId,
      "2026-10-08T00:00:00.000Z",
      false,
      repository.repositoryBinding,
    );
    assert.ok(transientFixed);
    const transientReady = prepareStateHistorySnapshot(
      transientFixed,
      transient.recoveryId,
      "2026-10-08T00:00:00.000Z",
      true,
      repository.repositoryBinding,
    );
    assert.ok(transientReady);
    fs.writeFileSync(stateFile, transientReady);
    const transientRemoval = prepareStateCompletionSnapshot(
      transientReady,
      transient.recoveryId,
      repository.repositoryBinding,
    );
    assert.ok(transientRemoval);
    const generalRemoval = historyRuntime.writeOwnedSettlement(
      transient.context,
      transientRemoval,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(generalRemoval.status, "blocked");
    assert.equal(generalRemoval.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(stateFile), transientReady);
    isCompletionReleaseObservationMissing = true;
    completionReleaseCount = 0;
    completionReleaseMissingAt = 2;
    let transientComplete: ReturnType<
      typeof historyRuntime.completeOwnedSettlement
    >;
    try {
      transientComplete = historyRuntime.completeOwnedSettlement(
        transient.context,
        cleanupOutcome,
        simulatedCompletion,
      );
    } finally {
      isCompletionReleaseObservationMissing = false;
      completionReleaseMissingAt = 1;
    }
    assert.equal(transientComplete.status, "blocked", transientComplete.reason);
    assert.equal(
      transientComplete.reason,
      "coordinator_state_lock_release_unconfirmed",
    );
    assert.equal(transientComplete.lockReleased, false);
    assert.equal(completionActualReleaseConfirmed, true);
    assert.equal(completionReleaseCount, 2);
    assert.equal(transientComplete.snapshotConfirmed, true);
    assert.deepEqual(fs.readFileSync(stateFile), transientRemoval);
    const transientReplay = historyRuntime.completeOwnedSettlement(
      transient.context,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(transientReplay.status, "completed", transientReplay.reason);
    const driverReplay = historyRuntime.completeOperation(
      transient.context,
      cleanupOutcome,
      simulatedCompletion,
    );
    assert.equal(driverReplay.status, "completed", driverReplay.reason);
    assert.equal(Object.hasOwn(driverReplay, "deliveryPending"), false);
    assert.equal(Object.hasOwn(driverReplay, "result"), false);
    assert.deepEqual(fs.readFileSync(stateFile), transientRemoval);
    for (const unconfirmedContext of [transient.freshContext, {}]) {
      const refusedDriver = historyRuntime.completeOperation(
        unconfirmedContext,
        cleanupOutcome,
        simulatedCompletion,
      );
      assert.equal(refusedDriver.status, "blocked");
      assert.equal(refusedDriver.filesystemEffectIssued, false);
      assert.deepEqual(fs.readFileSync(stateFile), transientRemoval);
    }
    assert.equal(
      historyRuntime.completeOwnedSettlement(
        transient.freshContext,
        cleanupOutcome,
        simulatedCompletion,
      ).status,
      "blocked",
    );
  }
  // 後続の既存履歴再入場試験へ自己生成fixtureを戻す。
  fs.writeFileSync(stateFile, acceptedProjectBytes);
  fs.writeFileSync(historyFile, firstHistory);
  // 未受領の結果が参照する履歴は欠落を成功へ補正せず、再追加もしない。
  fs.unlinkSync(historyFile);
  const afterRetention = historyRuntime.publishOwnedHistory(
    historySettlementAgain,
    cleanupOutcome,
    simulatedCompletion,
  );
  assert.equal(afterRetention.status, "blocked", afterRetention.reason);
  assert.equal(fs.existsSync(historyFile), false);
  assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
});

/**
 * 保存排他取得後のOwner失効を認証限定Writerが拒否する。
 * @responsibility 保存内部のfresh Owner照合と実解放を検証する。
 * @trace ERB-IT-014
 * @precondition 自己生成Rootと未開始認証unknownの正規合成値だけを使う。
 * @stimulus 実Kernel取得直後にOwnerを失効させ、同じ候補を通常Ownerで再確認する。
 * @observation 取得回数、Effect、解放、state全文と予定外File。
 * @oracle 失効時は無書込み、元unknown不変、解放後だけ通常操作が成功する。
 * @cleanup Domainの既存exact試験Root helperが自己生成物だけ回収する。
 * @boundary 実保存と合成Owner。Host終了・Docker再起動は実行しない。
 */
for (const consumer of ["workbench", "coordinator_cli"] as const) {
  test(`Host Windows: 認証限定保存は排他内Owner失効を拒否する ${consumer}`, {
    skip: process.platform !== "win32",
  }, (t) => {
    const directory = createRepositoryTestDirectory("runtime-auth-owner-");
    const root = directory.path;
    t.after(() => directory.cleanup());
    execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "synthetic",
      ],
      { windowsHide: true },
    );
    const verified = getRepository(root);
    assert.equal(verified.status, "completed");
    if (verified.status !== "completed") throw Error("fixture_root_invalid");
    const observed = observeExecutionStorageRepository(verified.capability);
    assert.ok(observed);
    const binding = observed.repositoryBinding;
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

    const authIdentity = {
      ...identity,
      consumer,
      operationMode: "workbench_advice",
      workspaceMountMode: null,
    };
    const identityJson = `${JSON.stringify(authIdentity)}\n`;
    const initial = prepareStateOperationSnapshot(null, identityJson, binding);
    assert.ok(initial);
    const decoded = decodeStateSnapshot(initial, binding);
    assert.ok(decoded);
    const operation = decoded.snapshot.operations.find(
      (item) => item.kind === "docker_task",
    );
    assert.ok(operation?.kind === "docker_task");
    const requestId = createDockerRestartRequestId(
      binding,
      operation.identitySha256,
      operation.recoveryId,
      "f".repeat(64),
    );
    assert.ok(requestId);
    const before = Buffer.from(
      `${encodeStateValue({
        ...decoded.snapshot,
        operations: [
          {
            ...operation,
            phase: "settling",
            execution: {
              providerStart: "not_started",
              externalSend: "not_issued",
              sharedWrite: "not_issued",
              ownerEffect: "disabled",
              workspaceReusable: false,
            },
            resources: (() => {
              const planned = createResourceBookFixture(
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
              return {
                ...planned,
                snapshot: {
                  resources: planned.snapshot.resources.map((r) =>
                    r.key === "create_subscription_auth_probe"
                      ? { ...r, request: "unknown" }
                      : r,
                  ),
                },
                checkpoints: planned.checkpoints.map((c) =>
                  c.key === "create_subscription_auth_probe"
                    ? { ...c, submission: "intent_saved" }
                    : c,
                ),
              };
            })(),
            dockerRestart: {
              requestId,
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
      })}\n`,
    );
    assert.ok(decodeStateSnapshot(before, binding));
    const area = areaRequirement.requireReadyRepositoryExecutionDataArea(
      areaInitialization.ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        root,
        "domain-model",
      ),
      "auth_owner_fixture",
    );
    const file = path.join(area.directory, "state.json");
    fs.writeFileSync(file, before, { flag: "wx" });
    const repository = { ...observed, operationId: identity.operationId };
    const observations = [
      { round: 1, name: "absent", name_label: "absent" },
      { round: 2, name: "absent", name_label: "absent" },
    ];
    const candidate = prepareAuthenticationUnknownClosureSnapshot(
      before,
      operation.recoveryId,
      observations,
      binding,
    );
    assert.ok(candidate);
    const genericAccess = {
      identity: Object.freeze({}),
      observeRepository: () => ({
        purpose: "execution" as const,
        root: verified.capability,
        operationId: identity.operationId,
        revalidate: observed.revalidate,
      }),
      verifyNotIssued: () => false,
    };
    const bypass = writeOwnedStateSnapshot(genericAccess, candidate);
    assert.equal(bypass.status, "blocked");
    assert.equal(
      bypass.reason,
      "coordinator_state_authentication_closure_owner_required",
    );
    assert.equal(bypass.filesystemEffectIssued, false);
    assert.equal(bypass.lockReleased, true);
    assert.deepEqual(fs.readFileSync(file), before);
    assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
    let live = true,
      acquisitions = 0;
    const worker = createRuntimeStorageSourceFixture(undefined, {
      acquireExecutionStateLock: (hash: unknown, root: string) => {
        const lock = stateKernelLocks.acquireExecutionStateLock(hash, root);
        assert.ok(lock);
        acquisitions++;
        live = false;
        return lock;
      },
    });
    const rejected = worker.saveRecoveryCheckpoint(
      repository,
      operation.recoveryId,
      before,
      {
        kind: "authentication_unknown_closure",
        observations: observations,
        assertOwner: () => live,
      },
    );
    assert.equal(acquisitions, 1);
    assert.equal(rejected.status, "blocked");
    assert.equal(rejected.filesystemEffectIssued, false);
    assert.equal(rejected.snapshotConfirmed, false);
    assert.equal(rejected.lockReleased, true);
    assert.deepEqual(fs.readFileSync(file), before);
    assert.deepEqual(fs.readdirSync(area.directory), ["state.json"]);
    const saved = domain.saveRecoveryCheckpoint(
      repository,
      operation.recoveryId,
      before,
      {
        kind: "authentication_unknown_closure",
        observations: observations,
        assertOwner: () => true,
      },
    );
    assert.equal(saved.status, "completed", saved.reason);
    assert.equal(saved.lockReleased, true);
    const after = decodeStateSnapshot(fs.readFileSync(file), binding);
    assert.ok(after);
    assert.equal(after.snapshot.operations[0]?.kind, "docker_task");
    if (after.snapshot.operations[0]?.kind === "docker_task")
      assert.equal(
        after.snapshot.operations[0].resources?.snapshot.resources.find(
          (item) => item.key === "create_subscription_auth_probe",
        )?.request,
        "unknown",
      );
  });
}

import {
  prepareAuthenticationUnknownClosureSnapshot,
  prepareStateHistorySnapshot,
  prepareStateLifecycleSnapshot,
  prepareStateOperationSnapshot,
  prepareStateReferencesSnapshot,
  prepareStateResourceSnapshot,
} from "../../src/state/validation.ts";

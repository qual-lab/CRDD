/**
 * Task終端保存試験の合成技術Operationと履歴を実Snapshotへ配置する。
 * @packageDocumentation
 * @responsibility 任意回復参照のfallbackを作らず、元Operationからexact結果を構成する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @level IT
 * @scope 自己生成Repository内の合成保存だけ。Docker・Providerなし。
 * @boundary 合成技術Operation→統合保存codecと実Filesystem。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  applyResourceCleanup,
  applyResourceEvent,
  type OperationResources,
  readState,
  saveOperationStart,
} from "../../../execution-model/src/index.ts";
import { createResourceBookFixture } from "../../../execution-model/tests/support/resource-operation.ts";
import { canonicalJson } from "../support/contract-assertions.ts";
import { executionSelection } from "./ai-selection.ts";

/**
 * fixture本文のSHA-256を計算する。
 * @responsibility 実Identity本文と結果を同じHashへ結合する。
 * @trace PRL-IT-012
 * @input value: fixtureの固定byte列。
 * @returns SHA-256。
 * @effect N/A: 純粋計算。
 */
function hash(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

/**
 * Taskに結合した未清掃の技術Operationを登録する。
 * @responsibility 現在Rootと論理操作に対応するexact参照を公開開始Writerから取得する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @input root: 自己生成Root、operationId: Task論理操作、count: 登録数。
 * @returns 元Operationのexact参照集合。
 * @effect fixture内の実Reader・Writerと共通Lockで開始記録を保存する。技術実行は発行しない。
 */
export function registerSyntheticOperations(
  root: string,
  operationId: string,
  count = 2,
) {
  const directory = path.join(root, ".crdd", "domain-model");
  const file = path.join(directory, "state.json");
  const binding = JSON.parse(fs.readFileSync(file, "utf8"))
    .repositoryBinding as string;
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  assert.ok(verified.capability);
  const results: {
    repositoryBinding: string;
    operationId: string;
    recoveryId: string;
  }[] = [];
  for (let index = 1; index <= count; index++) {
    const initial = JSON.parse(fs.readFileSync(file, "utf8"));
    const nonce = hash(operationId + ":" + index + ":" + initial.revision);
    const hostOperationId = "OP-" + BigInt("0x" + nonce).toString(10);
    const hostRecord = {
      kind: "host_operation",
      operationId: hostOperationId,
      recoveryId: "host-operation." + hostOperationId,
      purpose: "task",
      phase: "active",
      cleanup: "not_requested",
      createdAt: "2026-08-25T00:00:00.000Z",
      rootIdentity: { dev: "1", ino: "2", birthtimeNs: "3" },
      childIdentities: Object.fromEntries(
        [
          "events",
          "management",
          "projection",
          "providerHome",
          "tmp",
          "workspace",
        ].map((key, at) => [
          key,
          { dev: "1", ino: String(at + 3), birthtimeNs: "4" },
        ]),
      ),
      resources: null,
    };
    // 合成保存の前提値を宣言する。Hostの実作成・不存在の証拠にはしない。
    const hosts = [
      ...initial.operations.filter(
        (item: { kind: string }) => item.kind === "host_operation",
      ),
      hostRecord,
    ];
    const previous = {
      ...initial,
      operations: [
        ...hosts,
        ...initial.operations.filter(
          (item: { kind: string }) => item.kind !== "host_operation",
        ),
      ].sort((left, right) => {
        const leftKey =
          left.kind === "host_operation"
            ? left.operationId
            : JSON.parse(left.identityJson).operationNonce;
        const rightKey =
          right.kind === "host_operation"
            ? right.operationId
            : JSON.parse(right.identityJson).operationNonce;
        return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
      }),
    };
    const before = Buffer.from(canonicalJson(previous) + "\n");
    fs.writeFileSync(file, before);
    const suffix = index.toString(16).padStart(16, "0");
    const identity = {
      schema: "crdd-coordinator/operation-identity/v6",
      operationNonce: nonce,
      provider: "claude",
      consumer: "orchestrator",
      operationId: hostOperationId,
      recoveryCorrelationId: operationId,
      taskAttempt: 0 as const,
      executionSelection: executionSelection("executor", {
        provider: "claude",
        model: "opus",
        effort: "high",
      }),
      stableLogicalHomeBindingHash: (index + 2).toString(16).padStart(64, "0"),
      providerHomeIdentityHash: "8".repeat(64),
      repositoryBinding: binding,
      ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
      operationMode: "isolated_task",
      workspaceMountMode: "read_write",
    };
    const registered = saveOperationStart(
      {
        identity: Object.freeze({}),
        observeRepository: () => ({
          purpose: "execution" as const,
          root: verified.capability,
          operationId: identity.operationId,
          revalidate: () => true,
        }),
        observeSettlementRepository: () => ({
          purpose: "settlement" as const,
          root: verified.capability,
          operationId: identity.operationId,
          revalidate: () => true,
        }),
        // このfixtureは技術終了を証明しない。開始Contextの有限接続だけを提供する。
        captureCleanupVerification: () => () => null,
      },
      `${JSON.stringify(identity)}\n`,
    );
    assert.equal(registered.status, "completed", registered.reason);
    assert.equal(registered.startSaved, true);
    assert.equal(registered.snapshotConfirmed, true);
    assert.equal(registered.lockReleased, true);
    assert.ok(registered.recoveryId);
    const state = JSON.parse(fs.readFileSync(file, "utf8"));
    const operation = state.operations.find(
      (item: { recoveryId: string }) =>
        item.recoveryId === registered.recoveryId,
    );
    assert.ok(operation);
    assert.equal(operation.identityJson, `${JSON.stringify(identity)}\n`);
    assert.equal(operation.identitySha256, hash(operation.identityJson));
    assert.deepEqual(state.previous, {
      revision: previous.revision,
      payloadSha256: hash(before),
    });
    assert.equal(state.revision, previous.revision + 1);
    assert.deepEqual(
      {
        ...state,
        revision: previous.revision,
        previous: previous.previous,
        managedExecutions: previous.managedExecutions,
        operations: state.operations.filter(
          (item: { recoveryId: string }) =>
            item.recoveryId !== registered.recoveryId,
        ),
      },
      previous,
    );
    for (const [
      projectIndex,
      project,
    ] of previous.managedExecutions.entries()) {
      for (const [taskIndex, task] of project.tasks.entries()) {
        const actual = state.managedExecutions[projectIndex].tasks[taskIndex];
        if (task.operationId !== operationId) {
          assert.deepEqual(actual, task);
          continue;
        }
        assert.deepEqual({ ...actual, settlement: task.settlement }, task);
        assert.deepEqual(actual.settlement, {
          kind: "operations",
          recoveryIds: [
            ...results.map((item) => item.recoveryId),
            registered.recoveryId,
          ].sort((left, right) => {
            // 保存契約は登録順ではなくOperation nonceの昇順。
            const a =
              left.split(".")[2] ?? assert.fail("fixture_nonce_missing");
            const b =
              right.split(".")[2] ?? assert.fail("fixture_nonce_missing");
            return a < b ? -1 : a > b ? 1 : 0;
          }),
          resultUnresolved:
            task.settlement.kind === "operations"
              ? task.settlement.resultUnresolved
              : task.settlement.kind === "executor_result" &&
                task.settlement.recoveryUnresolved,
        });
      }
    }
    results.push({
      repositoryBinding: binding,
      operationId,
      recoveryId: operation.recoveryId,
    });
  }
  return results;
}
/**
 * 同じ合成Operationを技術終端・履歴・履歴確認済み終端まで進める。
 * @responsibility Task側の段階や受領を偽造せず、元技術正本だけを更新する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @input root: 自己生成Root、recoveryId: 登録済みexact参照。
 * @returns 同じ操作に結合した技術終端参照。
 * @effect fixtureのstate.jsonとhistory.jsonlを更新する。
 */
export function settleSyntheticOperation(root: string, recoveryId: string) {
  const directory = path.join(root, ".crdd", "domain-model");
  const file = path.join(directory, "state.json");
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  const binding = state.repositoryBinding as string;
  const operation = state.operations.find(
    (item: { recoveryId: string }) => item.recoveryId === recoveryId,
  );
  assert.ok(operation && operation.kind === "docker_task");
  const identity = JSON.parse(operation.identityJson);
  operation.phase = "settling";
  const host = state.operations.find(
    (item: { kind: string; operationId?: string }) =>
      item.kind === "host_operation" &&
      item.operationId === identity.operationId,
  );
  assert.ok(host);
  host.phase = "terminal";
  host.cleanup = "confirmed";
  operation.lease = "released";
  operation.execution = {
    providerStart: "started",
    externalSend: "issued",
    sharedWrite: "not_issued",
    ownerEffect: "disabled",
    workspaceReusable: false,
  };
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
  let book: OperationResources | null = null;
  let snapshot = planned.snapshot;
  for (const resource of snapshot.resources) {
    book = applyResourceEvent(book, {
      event: "submission",
      key: resource.key,
      snapshot,
      cleanup: planned.cleanup,
    });
    assert.ok(book);
    snapshot = {
      resources: snapshot.resources.map((r) =>
        r.key === resource.key
          ? {
              ...r,
              request: "issued" as const,
              identity: {
                ...r.identity,
                dockerId: hash(`${recoveryId}:${r.key}`),
              },
            }
          : r,
      ),
    };
    book = applyResourceEvent(book, {
      event: "receipt",
      key: resource.key,
      snapshot,
      cleanup: planned.cleanup,
    });
    assert.ok(book);
  }
  assert.ok(book);
  book = applyResourceCleanup(
    book,
    snapshot,
    snapshot.resources.map((r) => ({ key: r.key, observation: "absent" })),
    {
      recoveryId,
      previousPayloadSha256: hash(canonicalJson(state)),
    },
  );
  assert.ok(book);
  operation.resources = book;
  operation.outcome = {
    status: "completed",
    reason: "provider_operation_completed",
    cleanupConfirmed: true,
  };
  const bytes: Buffer = Buffer.from(`${canonicalJson(state)}\n`);
  fs.writeFileSync(file, bytes);
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  assert.ok(verified.capability);
  const placed = readState(verified.capability, { scope: "recovery" });
  assert.equal(placed.status, "completed", placed.reason);
  assert.equal(placed.lockReleased, true);
  assert.ok(placed.value);
  assert.deepEqual(Buffer.from(placed.value.sourceText, "utf8"), bytes);
  const borrowed = borrowRuntimeOwnedCoordinatorRecoveryRepository(
    verified.capability,
  );
  assert.ok(borrowed);
  assert.equal(borrowed.repositoryBinding, binding);
  const repository = {
    ...borrowed,
    root: verified.capability,
    operationId: identity.operationId,
    historyRetentionDays: 30,
  };
  const recorded = saveRecoveryHistory(
    repository,
    recoveryId,
    () => true,
    "docker_task",
  );
  assert.equal(recorded.status, "completed", recorded.reason);
  assert.equal(recorded.snapshotConfirmed, true);
  assert.equal(recorded.lockReleased, true);
  assert.equal(recorded.historyConfirmed, true);
  const saved = readState(verified.capability, { scope: "recovery" });
  assert.equal(saved.status, "completed", saved.reason);
  assert.ok(saved.value);
  const terminal = saved.value.snapshot.operations.find(
    (item) => item.recoveryId === recoveryId,
  );
  assert.ok(terminal);
  assert.ok(terminal.kind === "docker_task");
  assert.equal(terminal.history?.confirmed, true);
  return {
    repositoryBinding: binding,
    operationId: identity.recoveryCorrelationId ?? identity.operationId,
    recoveryId,
  };
}

/**
 * 通常受領試験用に二つの技術終端を構成する。
 * @responsibility 登録と終端の既存fixtureを同じ論理操作へ接続する。
 * @trace PRL-IT-012
 * @input root: 自己生成Root、operationId: Task論理操作、count: 登録数（省略時2）。
 * @returns exact結果集合。
 * @effect fixture内の技術状態と履歴を作る。
 */
export function settleSyntheticOperations(
  root: string,
  operationId: string,
  count = 2,
) {
  return registerSyntheticOperations(root, operationId, count).map((item) =>
    settleSyntheticOperation(root, item.recoveryId),
  );
}

import { saveRecoveryHistory } from "../../../execution-model/src/index.ts";
import { getRepository } from "../../../version-control/src/index.ts";
import { borrowRuntimeOwnedCoordinatorRecoveryRepository } from "../../src/lifecycle/host.ts";

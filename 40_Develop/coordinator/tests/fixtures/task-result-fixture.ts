/**
 * Task受領試験の合成技術Operationと履歴を実Snapshotへ配置する。
 * @packageDocumentation
 * @responsibility 任意回復参照のfallbackを作らず、元Operationからexact結果を構成する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @level IT
 * @scope 自己生成Repository内の合成保存だけ。Docker・Providerなし。
 * @boundary 合成技術Operation→統合保存codecと実Filesystem。
 */

import { encodeRuntimeStateValue } from "../../../domain-model/src/index.ts";
import { executionSelection } from "./ai-selection.ts";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  decodeCoordinatorUnifiedSnapshot as decodeCoordinatorStateSnapshot,
  prepareCoordinatorStateOperationSnapshot,
  prepareCoordinatorStateHistorySnapshot,
  prepareCoordinatorStateResultDeliverySnapshot,
} from "../../../domain-model/src/index.ts";
import { prepareCoordinatorStateHistoryLine } from "../../../domain-model/src/index.ts";

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
 * @responsibility 現在Rootと論理操作に対応するexact参照をcodecから取得する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @input root: 自己生成Root、operationId: Task論理操作、count: 登録数。
 * @returns 元Operationのexact参照集合。
 * @effect fixtureの現在状態だけを更新する。
 */
export function registerSyntheticOperations(
  root: string,
  operationId: string,
  count = 2,
) {
  const directory = path.join(root, ".crdd", "coordinator");
  const file = path.join(directory, "state.json");
  let bytes: Buffer = fs.readFileSync(file);
  const binding = JSON.parse(bytes.toString()).repositoryBinding as string;
  const results: {
    repositoryBinding: string;
    operationId: string;
    recoveryId: string;
    resultId: string;
    consumer: "orchestrator";
  }[] = [];
  for (let index = 1; index <= count; index++) {
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
    const hostHash = hash(`${JSON.stringify(hostRecord)}\n`);
    const token = `host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.${hostHash}`;
    const suffix = String(index).repeat(16);
    const identity = {
      schema: "crdd-coordinator/operation-identity/v2",
      operationNonce: String(index).repeat(64),
      provider: "claude",
      consumer: "orchestrator",
      operationId: `OP-${123456 + index}`,
      recoveryCorrelationId: operationId,
      grantRef: "PHMGRANT-FIXTURE",
      taskAttempt: 0 as const,
      executionSelection: executionSelection("executor", {
        provider: "claude",
        model: "opus",
        effort: "high",
      }),
      stableLogicalHomeBindingHash: String(index + 2).repeat(64),
      providerHomeIdentityHash: "8".repeat(64),
      providerHomeProtectionHash: "9".repeat(64),
      localUserBindingHash: "6".repeat(64),
      repositoryBinding: binding,
      ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
      resources: {
        auth: `crdd-auth-${suffix}`,
        provider: `crdd-claude-${suffix}`,
        proxy: `crdd-proxy-${suffix}`,
        internal: `crdd-internal-${suffix}`,
        egress: `crdd-egress-${suffix}`,
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
    const registered = prepareCoordinatorStateOperationSnapshot(
      bytes,
      `${JSON.stringify(identity)}\n`,
      binding,
    );
    assert.ok(registered, "合成の元操作を現在codecへ登録する");
    const state = JSON.parse(registered.toString());
    const operation = state.operations.find(
      (item: { identitySha256: string }) =>
        item.identitySha256 === hash(`${JSON.stringify(identity)}\n`),
    );
    assert.ok(operation);
    results.push({
      repositoryBinding: binding,
      operationId,
      recoveryId: operation.recoveryId,
      resultId: "",
      consumer: "orchestrator",
    });
    bytes = registered;
  }
  fs.writeFileSync(file, bytes);
  return results;
}
/**
 * 同じ合成Operationを技術終端・履歴・配送待ちまで進める。
 * @responsibility Task側の段階や受領を偽造せず、元技術正本だけを更新する。
 * @trace PRL-IT-005
 * @trace PRL-IT-012
 * @input root: 自己生成Root、recoveryId: 登録済みexact参照。
 * @returns 実配送登録に結合した五項目。
 * @effect fixtureのstate.jsonとhistory.jsonlを更新する。
 */
export function settleSyntheticOperation(root: string, recoveryId: string) {
  const directory = path.join(root, ".crdd", "coordinator");
  const file = path.join(directory, "state.json");
  const state = JSON.parse(fs.readFileSync(file, "utf8"));
  const binding = state.repositoryBinding as string;
  const operation = state.operations.find(
    (item: { recoveryId: string }) => item.recoveryId === recoveryId,
  );
  assert.ok(operation && operation.kind === "docker_task");
  const identity = JSON.parse(operation.identityJson);
  operation.phase = "settling";
  operation.host.cleanup = "confirmed";
  operation.lease = "released";
  operation.execution = {
    providerStart: "started",
    externalSend: "issued",
    sharedWrite: "not_issued",
    ownerEffect: "disabled",
    workspaceReusable: false,
  };
  operation.outcome = {
    status: "completed",
    reason: "provider_operation_completed",
    cleanupConfirmed: true,
  };
  let bytes: Buffer = Buffer.from(`${encodeRuntimeStateValue(state)}\n`);
  assert.ok(decodeCoordinatorStateSnapshot(bytes, binding));
  const at = new Date().toISOString();
  for (const confirmed of [false, true]) {
    const next = prepareCoordinatorStateHistorySnapshot(
      bytes,
      recoveryId,
      at,
      confirmed,
      binding,
    );
    assert.ok(next);
    bytes = next;
  }
  const line = prepareCoordinatorStateHistoryLine(bytes, recoveryId, binding);
  assert.ok(line);
  const delivered = prepareCoordinatorStateResultDeliverySnapshot(
    bytes,
    recoveryId,
    ["orchestrator"],
    binding,
  );
  assert.ok(delivered);
  bytes = delivered;
  const saved = decodeCoordinatorStateSnapshot(bytes, binding);
  const delivery = saved?.snapshot.pendingDeliveries.find(
    (item) => item.recoveryId === recoveryId,
  );
  assert.ok(delivery);
  const history = path.join(directory, "history.jsonl");
  const prior = fs.existsSync(history)
    ? fs.readFileSync(history)
    : Buffer.alloc(0);
  fs.writeFileSync(history, Buffer.concat([prior, line]));
  fs.writeFileSync(file, bytes);
  return {
    repositoryBinding: binding,
    operationId: identity.recoveryCorrelationId ?? identity.operationId,
    recoveryId,
    resultId: delivery.resultId,
    consumer: "orchestrator" as const,
  };
}

/**
 * 通常受領試験用に二つの技術終端を構成する。
 * @responsibility 登録と終端の既存fixtureを同じ論理操作へ接続する。
 * @trace PRL-IT-012
 * @input root: 自己生成Root、operationId: Task論理操作。
 * @returns exact結果集合。
 * @effect fixture内の技術状態と履歴を作る。
 */
export function registerSyntheticResults(root: string, operationId: string) {
  return registerSyntheticOperations(root, operationId).map((item) =>
    settleSyntheticOperation(root, item.recoveryId),
  );
}

/**
 * 新Identityと元Host相関を固定値として持つ有限の試験入力。
 * @responsibility 旧保存値の補完をせず自己生成した新形式だけを返す。
 * @trace ARCH-000008
 * @level UT
 * @boundary 純粋値だけ。実保存・Docker・AIを扱わない。
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { OperationResources } from "../../src/index.ts";

/** 新形式の有限入力。旧資源行の変換や実体不存在の推測は行わない。 */
export function createResourceBookFixture(
  ownershipLabel: string,
  state: "planned" | "absent" | "unknown" = "planned",
  keys: readonly string[] = ["container", "network"],
): OperationResources {
  return {
    snapshot: {
      resources: keys.map((key, index) => ({
        key,
        identity: {
          kind:
            key === "network" || key.endsWith("_network")
              ? ("network" as const)
              : ("container" as const),
          name: `crdd-fixture-${key}`,
          ownershipLabel,
          dockerId: state === "absent" ? String(index + 1).repeat(64) : null,
        },
        request:
          state === "planned"
            ? ("not_issued" as const)
            : state === "absent"
              ? ("issued" as const)
              : ("unknown" as const),
        configuration: {
          image: null,
          command: null,
          environmentNames: null,
          mounts: null,
          networks: null,
          internal: null,
        },
      })),
    },
    checkpoints: keys.map((key) => ({
      key,
      submission:
        state === "planned" ? ("none" as const) : ("intent_saved" as const),
      receiptSource:
        state === "absent" ? ("docker_create_result" as const) : null,
      observation:
        state === "absent" ? ("absent" as const) : ("unobserved" as const),
      absenceEvidenceSha256: state === "absent" ? "e".repeat(64) : null,
    })),
    cleanup: {
      cleanupOrder: [...keys],
      setupTimeoutMs: 1000,
      unreceiptedAbsence: "observe",
      verifyLabelAbsence: true,
    },
  };
}

export function createResourceOperationFixture() {
  const binding = "a".repeat(64);
  const ownershipLabel = "crdd.coordinator.runtime=0123456789abcdef";
  const identity = {
    schema: "crdd-coordinator/operation-identity/v6",
    operationNonce: "b".repeat(64),
    provider: "claude",
    consumer: "coordinator",
    operationId: "OP-123456",
    recoveryCorrelationId: "task-operation-a",
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
    ownershipLabel,
    operationMode: "isolated_task",
    workspaceMountMode: "read_write",
  };
  // 一つの既知入力だけを宣言する。任意Identityから保存候補を作るHelperではない。
  const identityJson = `${JSON.stringify(identity)}\n`;
  const identitySha256 =
    "697a04ea51581261d2844676b7b3998a6ca157b9bc4cdd0f09af0c1bd7031570";
  assert.equal(
    createHash("sha256").update(identityJson).digest("hex"),
    identitySha256,
  );
  // 固定fixtureは宣言順を保存JSONの正規順へ揃える。汎用codecを借用しない。
  const snapshot: import("../../src/index.ts").ExecutionStateSnapshot = {
    blockers: [],
    decisions: [],
    historyPending: [],
    leaseEvidence: [],
    leaseIntents: [],
    managedExecutions: [],
    operations: [
      {
        childIdentities: Object.fromEntries(
          [
            "events",
            "management",
            "projection",
            "providerHome",
            "tmp",
            "workspace",
          ].map((key, index) => [
            key,
            { birthtimeNs: "4", dev: "1", ino: String(index + 3) },
          ]),
        ),
        cleanup: "not_requested",
        createdAt: "2026-08-25T00:00:00.000Z",
        kind: "host_operation",
        operationId: "OP-123456",
        phase: "active",
        purpose: "task",
        recoveryId: "host-operation.OP-123456",
        resources: null,
        rootIdentity: { birthtimeNs: "3", dev: "1", ino: "2" },
      },
      {
        dockerRestart: null,
        execution: {
          externalSend: "not_issued",
          ownerEffect: "active",
          providerStart: "not_started",
          sharedWrite: "not_issued",
          workspaceReusable: false,
        },
        history: null,
        identityJson: identityJson,
        identitySha256: identitySha256,
        kind: "docker_task",
        lease: "held",
        outcome: null,
        phase: "executing",
        primaryFailure: null,
        recoveryId: `docker-task.${"c".repeat(64)}.${"b".repeat(64)}.${identitySha256}`,
        resources: null,
        summarySha256: null,
      },
    ],
    previous: null,
    projects: [],
    queueEntries: [],
    repositoryBinding: binding,
    repositoryBindingId: null,
    results: [],
    revision: 1,
    schema: "crdd-execution-model/state/v9",
    unresolvedRecoveries: [],
    workspaces: [],
  };
  const bytes = Buffer.from(JSON.stringify(snapshot) + "\n");
  const operation = snapshot.operations.find(
    (item) => item.kind === "docker_task",
  );
  assert.ok(operation?.kind === "docker_task");
  assert.equal(operation.resources, null);
  return {
    bytes,
    binding,
    ownershipLabel,
    recoveryId: operation.recoveryId,
    operation,
    identity,
  };
}

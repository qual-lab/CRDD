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
  const token = `host.crdd-coordinator-doctor-fixture.12345678-1234-4234-8234-123456789abc.${hostHash}`;
  const identity = {
    schema: "crdd-coordinator/operation-identity/v4",
    operationNonce: "b".repeat(64),
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
    ownershipLabel,
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
  // 一つの既知入力だけを宣言する。任意Identityから保存候補を作るHelperではない。
  const identityJson = `${JSON.stringify(identity)}\n`;
  const identitySha256 =
    "cb2c43f922c0797cf926c2336a25dfa3dfcc2ed41bbede7ea53512757e75f922";
  assert.equal(
    createHash("sha256").update(identityJson).digest("hex"),
    identitySha256,
  );
  // 固定fixtureは宣言順を保存JSONの正規順へ揃える。汎用codecを借用しない。
  const snapshot: import("../../src/index.ts").ExecutionStateSnapshot = {
    blockers: [],
    decisions: [],
    historyPending: [],
    intakeBindings: [],
    intakeEpoch: null,
    leaseEvidence: [],
    leaseIntents: [],
    managedExecutions: [],
    operations: [
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
        host: {
          cleanup: "not_requested",
          currentToken: token,
          pendingTransitionJson: null,
        },
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
    schema: "crdd-execution-model/state/v4",
    unresolvedRecoveries: [],
    workspaces: [],
  };
  const bytes = Buffer.from(JSON.stringify(snapshot) + "\n");
  const operation = snapshot.operations[0];
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

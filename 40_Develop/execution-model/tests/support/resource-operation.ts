/**
 * 新Identityと元Host相関を実Domain codecで構成する試験入力。
 * @responsibility 旧保存値の補完をせず自己生成した新形式だけを返す。
 * @trace ARCH-000008
 * @level UT
 * @boundary 純粋値だけ。実保存・Docker・AIを扱わない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  decodeRuntimeDomainSnapshot,
  prepareCoordinatorStateOperationSnapshot,
} from "../../src/index.ts";
import type { CoordinatorResourceBook } from "../../src/index.ts";

/** 新形式の有限入力。旧資源行の変換や実体不存在の推測は行わない。 */
export function createResourceBookFixture(
  ownershipLabel: string,
  state: "planned" | "absent" | "unknown" = "planned",
  keys: readonly string[] = ["container", "network"],
): CoordinatorResourceBook {
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
  const bytes = prepareCoordinatorStateOperationSnapshot(
    null,
    `${JSON.stringify(identity)}\n`,
    binding,
  );
  assert.ok(bytes);
  const read = decodeRuntimeDomainSnapshot(bytes, binding);
  assert.ok(read);
  const operation = read.snapshot.operations[0];
  assert.ok(operation?.kind === "docker_task");
  assert.equal(operation.resources, null);
  return {
    bytes,
    binding,
    ownershipLabel,
    recoveryId: operation.recoveryId,
    identity,
  };
}

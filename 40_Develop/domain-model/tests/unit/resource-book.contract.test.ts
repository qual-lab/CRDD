/**
 * 元Snapshotと記録checkpointの相関を有限値で確認する。
 * @responsibility Intent・Receipt・不存在を混同せず旧保存形式を拒否する。
 * @trace ARCH-000008
 * @level UT
 * @boundary 純粋な値更新のみ。Docker・外部AI・Filesystem操作を行わない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createResourceOperationFixture as operationState } from "../support/resource-operation.ts";
import type { ResourceSnapshot } from "../../../docker-isolation/src/index.ts";
import {
  applyCoordinatorResourceCleanup,
  applyCoordinatorResourceEvent,
} from "../../src/attempt/crud.ts";
import type { CoordinatorResourceBook } from "../../src/attempt/types.ts";
import {
  validateCoordinatorResourceBook,
  validateCoordinatorResourceBookTransition,
  validateCoordinatorOperationIdentity,
} from "../../src/attempt/validation.ts";
import {
  decodeRuntimeDomainSnapshot,
  prepareCoordinatorStateResourceSnapshot,
} from "../../src/index.ts";

const ID = "a".repeat(64);
const EVIDENCE = {
  recoveryId: "same-operation",
  previousPayloadSha256: "b".repeat(64),
};
const CLEANUP = {
  cleanupOrder: ["first", "second"],
  setupTimeoutMs: 1000,
  unreceiptedAbsence: "observe",
  verifyLabelAbsence: true,
} as const;

/** 初回Intent前のDI正規化Snapshotだけを構成する。 */
function snapshot(
  id: string | null = null,
  request: "not_issued" | "unknown" | "issued" = "not_issued",
): ResourceSnapshot {
  return {
    resources: ["first", "second"].map((key, index) => ({
      key,
      identity: {
        kind: "container",
        name: `crdd-${key}`,
        ownershipLabel: "crdd.owner=fixture",
        dockerId: index === 0 ? id : null,
      },
      request: index === 0 ? request : "not_issued",
      configuration: {
        image: null,
        command: null,
        environmentNames: null,
        mounts: null,
        networks: null,
        internal: null,
      },
    })),
  };
}

/** 必須通知の保存候補が成立した場合だけ次試験へ進む。 */
function initial(): CoordinatorResourceBook {
  const book = applyCoordinatorResourceEvent(null, {
    event: "submission",
    key: "first",
    snapshot: snapshot(),
    cleanup: CLEANUP,
  });
  assert.ok(book);
  return book;
}

/** 既存Host契約を満たす自己生成Operationを、製品codecで初期化する。 */

test("Operation Identityはv3だけを受理し旧資源名・Imageコピーを保存しない", () => {
  const { identity, binding } = operationState();
  assert.equal(
    validateCoordinatorOperationIdentity(
      identity,
      identity.operationNonce,
      binding,
    ),
    true,
  );
  for (const invalid of [
    { ...identity, schema: "crdd-coordinator/operation-identity/v2" },
    { ...identity, resources: {} },
    { ...identity, images: {} },
  ])
    assert.equal(
      validateCoordinatorOperationIdentity(
        invalid,
        identity.operationNonce,
        binding,
      ),
      false,
    );
});

test("保存codecは初回Snapshot＋Intentを同じ改訂へ結合し別OperationのLabelを拒否する", () => {
  const f = operationState();
  for (const foreign of ["none", "all", "mixed"]) {
    const original = snapshot();
    const resources = {
      resources: original.resources.map((r, i) => ({
        ...r,
        identity: {
          ...r.identity,
          ownershipLabel:
            foreign === "all" || (foreign === "mixed" && i === 1)
              ? "crdd.coordinator.runtime=fedcba9876543210"
              : f.ownershipLabel,
        },
      })),
    };
    const next = prepareCoordinatorStateResourceSnapshot(
      f.bytes,
      f.recoveryId,
      {
        event: "submission",
        key: "first",
        snapshot: resources,
        cleanup: CLEANUP,
      },
      f.binding,
    );
    if (foreign !== "none") {
      assert.equal(next, null);
      continue;
    }
    assert.ok(next);
    const read = decodeRuntimeDomainSnapshot(next, f.binding);
    assert.ok(read);
    assert.equal(read.snapshot.revision, 2);
    const operation = read.snapshot.operations[0];
    assert.ok(operation?.kind === "docker_task" && operation.resources);
    assert.deepEqual(operation.resources.snapshot, resources);
    assert.equal(
      operation.resources.checkpoints[0]?.submission,
      "intent_saved",
    );
    assert.equal(
      prepareCoordinatorStateResourceSnapshot(
        f.bytes,
        "other-operation",
        {
          event: "submission",
          key: "first",
          snapshot: resources,
          cleanup: CLEANUP,
        },
        f.binding,
      ),
      null,
    );
  }
});

test("初期Snapshotと最初のIntentは一つの記録として成立しIdentityを複製しない", () => {
  const book = initial();
  assert.deepEqual(
    book.checkpoints.map((c) => c.submission),
    ["intent_saved", "none"],
  );
  assert.equal(Object.hasOwn(book.checkpoints[0] ?? {}, "dockerId"), false);
  assert.equal(validateCoordinatorResourceBook(null), true);
  assert.equal(validateCoordinatorResourceBook([]), false);
  assert.equal(
    applyCoordinatorResourceEvent(null, {
      event: "receipt",
      key: "first",
      snapshot: snapshot(ID, "issued"),
      cleanup: CLEANUP,
    }),
    null,
  );
});

test("Receipt又は発見通知だけが実IDを確定しCleanupでは補完しない", () => {
  const before = initial();
  const observed = [
    { key: "first", observation: "absent" },
    { key: "second", observation: "not_requested" },
  ];
  assert.equal(
    applyCoordinatorResourceCleanup(
      before,
      snapshot(ID, "issued"),
      observed,
      EVIDENCE,
    ),
    null,
  );
  for (const event of ["receipt", "identified"]) {
    const recorded = applyCoordinatorResourceEvent(before, {
      event,
      key: "first",
      snapshot: snapshot(ID, "issued"),
      cleanup: CLEANUP,
    });
    assert.ok(recorded);
    assert.equal(
      recorded.checkpoints[0]?.receiptSource,
      event === "receipt" ? "docker_create_result" : "runtime_reconciliation",
    );
    const closed = applyCoordinatorResourceCleanup(
      recorded,
      recorded.snapshot,
      observed,
      EVIDENCE,
    );
    assert.ok(closed);
    assert.equal(closed.checkpoints[0]?.observation, "absent");
    const evidence = closed.checkpoints[0]?.absenceEvidenceSha256;
    assert.ok(evidence);
    assert.match(evidence, /^[a-f0-9]{64}$/u);
    const repeated = applyCoordinatorResourceCleanup(
      closed,
      closed.snapshot,
      observed,
      { ...EVIDENCE, previousPayloadSha256: "c".repeat(64) },
    );
    assert.deepEqual(
      repeated,
      closed,
      "同じ不存在の再導出で最初の証拠を変更しない",
    );
    assert.equal(
      applyCoordinatorResourceCleanup(
        recorded,
        snapshot("c".repeat(64), "issued"),
        observed,
        EVIDENCE,
      ),
      null,
    );
    assert.equal(
      applyCoordinatorResourceCleanup(recorded, snapshot(), observed, EVIDENCE),
      null,
    );
  }
});

test("未発行は元Snapshotが未発行の場合だけ記録でき、ID欠測から推測しない", () => {
  const before = initial();
  assert.ok(
    applyCoordinatorResourceEvent(before, {
      event: "not_issued",
      key: "first",
    }),
  );
  const unknown = { ...before, snapshot: snapshot(null, "unknown") };
  assert.equal(validateCoordinatorResourceBook(unknown), true);
  assert.equal(
    applyCoordinatorResourceEvent(unknown, {
      event: "not_issued",
      key: "first",
    }),
    null,
  );
  assert.equal(
    applyCoordinatorResourceCleanup(
      before,
      snapshot(),
      [
        { key: "first", observation: "not_requested" },
        { key: "second", observation: "not_requested" },
      ],
      EVIDENCE,
    ),
    null,
  );
});

test("構成観測の更新は許可するが実ID・名前・所有Label・回収契約の差替えを拒否する", () => {
  const before = initial();
  const next = structuredClone(before);
  const changed = {
    ...next,
    snapshot: {
      resources: next.snapshot.resources.map((r) => ({
        ...r,
        configuration: { ...r.configuration, image: "observed-image" },
      })),
    },
  };
  assert.equal(
    validateCoordinatorResourceBookTransition(before, changed),
    true,
  );
  for (const field of ["name", "ownershipLabel"] as const) {
    const invalid = {
      ...before,
      snapshot: {
        resources: before.snapshot.resources.map((r) => ({
          ...r,
          identity: { ...r.identity, [field]: "different" },
        })),
      },
    };
    assert.equal(
      validateCoordinatorResourceBookTransition(before, invalid),
      false,
    );
  }
  assert.equal(
    validateCoordinatorResourceBookTransition(before, {
      ...before,
      cleanup: { ...before.cleanup, setupTimeoutMs: 2000 },
    }),
    false,
  );
  assert.equal(validateCoordinatorResourceBookTransition(before, null), false);
});

test("欠測・重複key・未正規化Command・環境値を保存しない", () => {
  const book = initial();
  assert.equal(
    validateCoordinatorResourceBook({
      ...book,
      checkpoints: [book.checkpoints[0], book.checkpoints[0]],
    }),
    false,
  );
  assert.equal(
    validateCoordinatorResourceBook({
      ...book,
      cleanup: { ...book.cleanup, cleanupOrder: ["first", "first"] },
    }),
    false,
  );
  for (const configuration of [
    { command: ["raw-value"] },
    { environmentNames: ["TOKEN=value"] },
  ]) {
    const invalid = {
      ...book,
      snapshot: {
        resources: book.snapshot.resources.map((r) => ({
          ...r,
          configuration: { ...r.configuration, ...configuration },
        })),
      },
    };
    assert.equal(validateCoordinatorResourceBook(invalid), false);
  }
  assert.equal(
    applyCoordinatorResourceCleanup(
      book,
      book.snapshot,
      [
        { key: "first", observation: "unknown" },
        { key: "first", observation: "unknown" },
      ],
      EVIDENCE,
    ),
    null,
  );
});

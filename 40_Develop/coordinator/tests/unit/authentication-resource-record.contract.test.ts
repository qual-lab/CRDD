/**
 * 認証の元Snapshot・Intent・Receipt保存を有限Filesystemで反証する。
 * @responsibility 通知正常終了より前の保存読戻しと未要求窓の区別を確認する。
 * @trace ARCH-000010
 * @level UT
 * @scope Source宣言とメモリ内保存。実AI・Docker・Directory操作はない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import {
  applyCoordinatorResourceCleanup,
  applyCoordinatorResourceEvent,
  validateCoordinatorResourceBook,
  encodeRuntimeStateValue,
  type CoordinatorResourceBook,
} from "../../../domain-model/src/index.ts";

/** 認証記録の実宣言へ保存代役だけを接続する。 */
function fixture() {
  const source = fs.readFileSync(
    new URL("../../src/execution/authority.ts", import.meta.url),
    "utf8",
  );
  const expected = {
    contract: "provider-authentication",
    contractRevision: 2,
    provider: "codex",
    action: "status",
    recoveryId: "provider-auth.codex.status.fixture",
    stableLogicalHomeBindingHash: "a".repeat(64),
    suffix: "a".repeat(16),
    ownershipLabel: "crdd.owner=fixture",
    resources: null,
    state: "active",
    commandState: "idle",
    commandPurpose: null,
  };
  let saved = JSON.stringify(expected),
    writes = 0,
    failRead = false;
  let tamper: null | ((value: Record<string, unknown>) => unknown) = null;
  const names = [
    "sameRecoveryRecord",
    "setProviderAuthenticationRecoveryCommandState",
    "recordProviderAuthenticationResource",
    "readProviderAuthenticationResources",
  ];
  const api = runInNewContext(
    names.map((n) => sourceDeclaration(source, n)).join("\n") +
      ";({set:setProviderAuthenticationRecoveryCommandState,record:recordProviderAuthenticationResource,read:readProviderAuthenticationResources})",
    {
      Object,
      JSON,
      createHash,
      validateCoordinatorResourceBook,
      encodeRuntimeStateValue: (value: unknown) =>
        encodeRuntimeStateValue(JSON.parse(JSON.stringify(value))),
      applyCoordinatorResourceEvent: (
        before: CoordinatorResourceBook | null,
        event: unknown,
      ) =>
        applyCoordinatorResourceEvent(
          before,
          JSON.parse(JSON.stringify(event)),
        ),
      applyCoordinatorResourceCleanup,
      fs: {
        readFileSync: () => {
          if (failRead) throw Error("unavailable");
          return saved;
        },
        writeFileSync: (
          _path: string,
          bytes: string,
          options: { flush: boolean },
        ) => {
          assert.equal(options.flush, true);
          writes++;
          saved = tamper ? JSON.stringify(tamper(JSON.parse(bytes))) : bytes;
        },
      },
    },
  ) as {
    set(
      record: unknown,
      state: string,
      purpose: string | null,
      resources?: unknown,
      key?: string,
    ): boolean;
    record(record: unknown, event: unknown): boolean;
    read(
      record: unknown,
    ): Readonly<{ resources: CoordinatorResourceBook | null }> | null;
  };
  const material = {
    snapshot: {
      resources: [
        {
          key: "probe",
          request: "not_issued",
          identity: {
            kind: "container",
            name: "crdd-probe",
            dockerId: null,
            ownershipLabel: expected.ownershipLabel,
          },
          configuration: {
            image: null,
            command: null,
            environmentNames: null,
            mounts: null,
            networks: null,
            internal: null,
          },
        },
      ],
    },
    cleanup: {
      cleanupOrder: ["probe"],
      setupTimeoutMs: 1000,
      unreceiptedAbsence: "observe",
      verifyLabelAbsence: true,
    },
  };
  return {
    api,
    material,
    record: { ...expected, recordPath: "finite-record" },
    state: () => JSON.parse(saved),
    writes: () => writes,
    tamper(value: typeof tamper) {
      tamper = value;
    },
    failRead() {
      failRead = true;
    },
  };
}

test("認証は初回Intentと元Snapshotの保存読戻しが一致した時だけ通知を完了する", () => {
  for (const tamper of [
    null,
    (v: Record<string, unknown>) => ({ ...v, resources: null }),
  ]) {
    const f = fixture();
    f.tamper(tamper);
    const accepted = f.api.set(
      f.record,
      "in_flight",
      "create_probe",
      f.material,
      "probe",
    );
    assert.equal(accepted, tamper === null);
    assert.equal(f.writes(), 1);
    if (accepted)
      assert.equal(
        f.state().resources.checkpoints[0].submission,
        "intent_saved",
      );
  }
});

test("認証のReceiptは同じIntentへだけ保存し、終端結果から実IDを補完しない", () => {
  const f = fixture();
  assert.equal(
    f.api.set(f.record, "in_flight", "create_probe", f.material, "probe"),
    true,
  );
  const snapshot = structuredClone(f.material.snapshot);
  const resource = snapshot.resources[0];
  assert.ok(resource);
  const receiptSnapshot = {
    resources: [
      {
        ...resource,
        request: "issued",
        identity: { ...resource.identity, dockerId: "b".repeat(64) },
      },
    ],
  };
  assert.equal(
    f.api.record(f.record, {
      event: "cleanup",
      snapshot: receiptSnapshot,
      observations: [{ key: "probe", observation: "absent" }],
    }),
    false,
  );
  assert.equal(
    f.api.record(f.record, {
      ...f.material,
      snapshot: receiptSnapshot,
      event: "receipt",
      key: "probe",
    }),
    true,
  );
  assert.equal(f.api.set(f.record, "idle", null), true);
  assert.equal(
    f.api.record(f.record, {
      event: "cleanup",
      snapshot: receiptSnapshot,
      observations: [{ key: "probe", observation: "absent" }],
    }),
    true,
  );
  assert.equal(
    f.state().resources.checkpoints[0].receiptSource,
    "docker_create_result",
  );
});

test("認証の未要求を確認した読取りと観測不能・未終了Intentを区別する", () => {
  const f = fixture();
  const observed = f.api.read(f.record);
  assert.ok(observed);
  assert.equal(observed.resources, null);
  assert.equal(
    f.api.set(f.record, "in_flight", "create_probe", f.material, "probe"),
    true,
  );
  assert.equal(
    f.api.read(f.record),
    null,
    "未終了Intentを未要求窓へ変換しない",
  );
  const unavailable = fixture();
  unavailable.failRead();
  assert.equal(unavailable.api.read(unavailable.record), null);
  assert.equal(unavailable.writes(), 0);
});

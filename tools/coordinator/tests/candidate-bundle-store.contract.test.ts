import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createCandidateBundleStoreTestingAdapter,
  describeCandidateBundleStoreContract,
} from "../src/security/candidate-bundle-store.ts";

const PERSISTENCE_POLICY = Object.freeze({
  candidatePersistenceAllowed: true,
  candidateRetentionHours: 1,
  informationClassification: "public",
});

function bundle(content = Buffer.from("state=after\n", "utf8")) {
  return Object.freeze({
    schema: "crdd-coordinator-candidate-bundle/v1",
    baseCommit: "1".repeat(40),
    baseTree: "2".repeat(40),
    baseManifestHash: "3".repeat(64),
    patchHash: "4".repeat(64),
    contentManifestHash: "5".repeat(64),
    allowedPathsHash: "6".repeat(64),
    changedPaths: Object.freeze(["fixture.txt"]),
    entries: Object.freeze([
      Object.freeze({
        relativePath: "fixture.txt",
        operation: "upsert",
        byteLength: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
        contentBase64: content.toString("base64"),
      }),
    ]),
  });
}

function bundleAtPath(
  relativePath: string,
  operation: "upsert" | "delete" = "upsert",
) {
  const content = Buffer.from("ordinary value\n", "utf8");
  return Object.freeze({
    ...bundle(content),
    changedPaths: Object.freeze([relativePath]),
    entries: Object.freeze([
      Object.freeze({
        relativePath,
        operation,
        byteLength: operation === "upsert" ? content.byteLength : 0,
        sha256:
          operation === "upsert"
            ? createHash("sha256").update(content).digest("hex")
            : null,
        contentBase64:
          operation === "upsert" ? content.toString("base64") : null,
      }),
    ]),
  });
}

function fixture() {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-candidate-store-test-"),
  );
  let clock = Date.now();
  const faults = new Set<string>();
  const createAdapter = () =>
    createCandidateBundleStoreTestingAdapter({
      temporaryDirectory,
      nowMs: () => clock,
      injectFault: (operation) => {
        if (faults.has(operation)) throw new Error(operation);
      },
    });
  const adapter = createAdapter();
  return Object.freeze({
    adapter,
    createAdapter,
    faults,
    advance: (milliseconds: number) => {
      clock += milliseconds;
    },
    setClock: (milliseconds: number) => {
      clock = milliseconds;
    },
    cleanup: () =>
      fs.rmSync(temporaryDirectory, { recursive: true, force: true }),
  });
}

function requireRecoveryId(value: unknown) {
  assert.ok(value && typeof value === "object");
  const candidateRecoveryId = Reflect.get(value, "candidateRecoveryId");
  assert.match(
    candidateRecoveryId,
    /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
  );
  return candidateRecoveryId as string;
}

function requireStoreRecoveryId(value: unknown) {
  assert.ok(value && typeof value === "object");
  const candidateStoreRecoveryId = Reflect.get(
    value,
    "candidateStoreRecoveryId",
  );
  assert.match(
    candidateStoreRecoveryId,
    /^candidate-store-recovery\.[0-9a-f]{64}$/u,
  );
  return candidateStoreRecoveryId as string;
}

test("承認済みbundleをrestart後も冪等PublishしRecovery IDでDiscardする", () => {
  const value = fixture();
  try {
    const persisted = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    assert.equal(persisted?.status, "staged");
    const candidateRecoveryId = requireRecoveryId(persisted);
    assert.equal(value.adapter.read(candidateRecoveryId), null);

    const restarted = value.createAdapter();
    const published = restarted.publish(candidateRecoveryId);
    assert.equal(published?.status, "published");
    assert.deepEqual(restarted.publish(candidateRecoveryId), published);
    const exported = restarted.read(published?.candidateId);
    assert.equal(exported?.status, "exported");
    assert.deepEqual(exported?.bundle.changedPaths, ["fixture.txt"]);
    assert.equal(exported?.hostPathReported, false);
    assert.equal(
      JSON.stringify(exported).includes(value.adapter.testingStoreDirectory()),
      false,
    );
    value.faults.add("before_discard_remove");
    const blockedDiscard = restarted.discard(published?.candidateId);
    assert.equal(blockedDiscard.status, "blocked");
    assert.equal(
      Reflect.get(blockedDiscard, "candidateRecoveryId"),
      candidateRecoveryId,
    );
    value.faults.clear();
    assert.deepEqual(restarted.discard(candidateRecoveryId), {
      status: "discarded",
    });
    assert.equal(restarted.read(published?.candidateId), null);
  } finally {
    value.cleanup();
  }
});

test("期限到達後はExportせずstartupと公開入口GCでstagedとpublishedを削除する", () => {
  const value = fixture();
  try {
    value.faults.add("before_pending_sync");
    value.faults.add("before_discard_remove");
    const pending = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    assert.equal(pending?.status, "blocked");
    requireRecoveryId(pending);
    value.faults.clear();

    const staged = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    const stagedRecoveryId = requireRecoveryId(staged);
    value.advance(60 * 60 * 1_000);
    assert.equal(value.adapter.publish(stagedRecoveryId)?.status, "blocked");
    assert.equal(value.adapter.startupGc().status, "completed");
    assert.deepEqual(fs.readdirSync(value.adapter.testingStoreDirectory()), []);

    value.setClock(1_900_000_000_000);
    const next = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    const nextRecoveryId = requireRecoveryId(next);
    const published = value.adapter.publish(nextRecoveryId);
    assert.equal(published?.status, "published");
    value.advance(60 * 60 * 1_000);
    assert.equal(value.adapter.read(published?.candidateId), null);
    assert.deepEqual(fs.readdirSync(value.adapter.testingStoreDirectory()), []);
  } finally {
    value.cleanup();
  }
});

test("partial pendingはRecovery IDを失わず明示Discardだけが安定実体を削除する", () => {
  const value = fixture();
  try {
    value.faults.add("before_pending_sync");
    value.faults.add("before_discard_remove");
    const failed = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    assert.equal(failed?.status, "blocked");
    const candidateRecoveryId = requireRecoveryId(failed);
    assert.equal(
      fs
        .readdirSync(value.adapter.testingStoreDirectory())
        .some((entry) => entry.startsWith("pending-")),
      true,
    );
    value.faults.clear();
    assert.deepEqual(value.createAdapter().discard(candidateRecoveryId), {
      status: "discarded",
    });
  } finally {
    value.cleanup();
  }
});

test("staged障害とpublish rename後障害は同じRecovery IDで再開できる", () => {
  const value = fixture();
  try {
    value.faults.add("after_pending_rename");
    const stagedFailure = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    assert.equal(stagedFailure?.status, "blocked");
    const candidateRecoveryId = requireRecoveryId(stagedFailure);
    value.faults.clear();

    value.faults.add("after_publish_rename");
    const publishFailure = value.adapter.publish(candidateRecoveryId);
    assert.equal(publishFailure?.status, "blocked");
    assert.equal(publishFailure?.candidateRecoveryId, candidateRecoveryId);
    value.faults.clear();

    const published = value.createAdapter().publish(candidateRecoveryId);
    assert.equal(published?.status, "published");
    assert.deepEqual(value.adapter.discard(candidateRecoveryId), {
      status: "discarded",
    });
  } finally {
    value.cleanup();
  }
});

test("期限切れcleanup失敗はtyped Recoveryを返しstrict即時削除を主張しない", () => {
  const value = fixture();
  try {
    const persisted = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    const candidateRecoveryId = requireRecoveryId(persisted);
    const published = value.adapter.publish(candidateRecoveryId);
    assert.ok(published && "candidateId" in published);
    value.advance(60 * 60 * 1_000);
    value.faults.add("before_gc_remove");
    const blocked = value.adapter.read(published.candidateId);
    assert.equal(blocked?.status, "blocked");
    assert.equal(
      blocked?.reason,
      "candidate_store_gc_cleanup_recovery_required",
    );
    assert.equal(blocked?.manualRecoveryRequired, true);
    assert.equal(blocked?.candidateRecoveryId, candidateRecoveryId);
    value.faults.clear();
    assert.equal(value.adapter.startupGc().status, "completed");
  } finally {
    value.cleanup();
  }
});

test("同時writer lockとstale lockは推測削除せずboundedにFail Closedする", () => {
  const value = fixture();
  try {
    const store = value.adapter.testingStoreDirectory();
    const lock = path.join(store, "candidate-store.lock");
    fs.writeFileSync(lock, "held\n", { flag: "wx", mode: 0o600 });
    const concurrent = value.adapter.startupGc();
    assert.equal(concurrent.status, "blocked");
    assert.equal(concurrent.reason, "candidate_store_lock_unavailable");
    assert.equal(fs.existsSync(lock), true);

    fs.utimesSync(lock, new Date(0), new Date(0));
    const stale = value.adapter.startupGc();
    assert.equal(stale.status, "blocked");
    assert.equal(
      stale.reason,
      "candidate_store_stale_lock_manual_recovery_required",
    );
    assert.equal(stale.manualRecoveryRequired, true);
    assert.equal(fs.existsSync(lock), true);
    fs.rmSync(lock);
  } finally {
    value.cleanup();
  }
});

test("unknownとdamaged entryは推測削除せずexact明示Recoveryだけで回復する", () => {
  const value = fixture();
  try {
    const store = value.adapter.testingStoreDirectory();
    const damaged = path.join(store, `staged-${"a".repeat(64)}.json`);
    fs.writeFileSync(damaged, "not-json\n", { mode: 0o600 });
    const damagedResult = value.adapter.startupGc();
    assert.equal(damagedResult.status, "blocked");
    assert.equal(damagedResult.reason, "candidate_store_damaged_entry");
    assert.equal(fs.existsSync(damaged), true);
    assert.equal(
      value.adapter.recoverStore(requireStoreRecoveryId(damagedResult)).status,
      "recovered",
    );
    assert.equal(fs.existsSync(damaged), false);

    const unknown = path.join(store, "unknown-entry");
    fs.writeFileSync(unknown, "unknown\n", { mode: 0o600 });
    const result = value.adapter.startupGc();
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "candidate_store_unknown_entry");
    assert.equal(fs.existsSync(unknown), true);
    assert.equal(
      value.adapter.recoverStore(requireStoreRecoveryId(result)).status,
      "recovered",
    );
    assert.equal(fs.existsSync(unknown), false);
    assert.equal(value.adapter.startupGc().status, "completed");
  } finally {
    value.cleanup();
  }
});

test("個別Discardは無関係なunknown entryの全体GC失敗から独立する", () => {
  const value = fixture();
  try {
    const persisted = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    const candidateRecoveryId = requireRecoveryId(persisted);
    const unknown = path.join(
      value.adapter.testingStoreDirectory(),
      "unrelated-unknown-entry",
    );
    fs.writeFileSync(unknown, "unknown\n", { mode: 0o600 });
    assert.equal(value.adapter.startupGc().status, "blocked");
    assert.deepEqual(value.adapter.discard(candidateRecoveryId), {
      status: "discarded",
    });
    assert.equal(fs.existsSync(unknown), true);
  } finally {
    value.cleanup();
  }
});

test("Store Recovery ID取得後に実体が変わった場合は削除せず新しいIDを要求する", () => {
  const value = fixture();
  try {
    const unknown = path.join(
      value.adapter.testingStoreDirectory(),
      "unknown-entry",
    );
    fs.writeFileSync(unknown, "first\n", { mode: 0o600 });
    const first = value.adapter.startupGc();
    const firstRecoveryId = requireStoreRecoveryId(first);
    fs.writeFileSync(unknown, "second-content\n", { mode: 0o600 });
    const staleRecovery = value.adapter.recoverStore(firstRecoveryId);
    assert.equal(staleRecovery.status, "blocked");
    assert.equal(fs.existsSync(unknown), true);
    const second = value.adapter.startupGc();
    const secondRecoveryId = requireStoreRecoveryId(second);
    assert.notEqual(secondRecoveryId, firstRecoveryId);
    assert.equal(
      value.adapter.recoverStore(secondRecoveryId).status,
      "recovered",
    );
  } finally {
    value.cleanup();
  }
});

test("不正Schema、secret、clock異常とcapacity不足をCandidateへ昇格しない", () => {
  const value = fixture();
  try {
    assert.equal(
      value.adapter.persist({ ...bundle(), unknown: true }, PERSISTENCE_POLICY),
      null,
    );
    const secret = Buffer.from(`token=sk-${"A".repeat(24)}\n`, "utf8");
    assert.equal(
      value.adapter.persist(bundle(secret), PERSISTENCE_POLICY),
      null,
    );
    assert.equal(
      value.adapter.persist(bundleAtPath(".env"), PERSISTENCE_POLICY),
      null,
    );
    assert.equal(
      value.adapter.persist(
        bundleAtPath("keys/release.pfx", "delete"),
        PERSISTENCE_POLICY,
      ),
      null,
    );
    assert.equal(
      value.adapter.persist(
        bundleAtPath("src/session_token=abcdefghijklmnopqrstuvwx"),
        PERSISTENCE_POLICY,
      ),
      null,
    );
    assert.equal(
      value.adapter.persist(
        bundleAtPath("src/password=correct-horse-battery-staple", "delete"),
        PERSISTENCE_POLICY,
      ),
      null,
    );
    value.setClock(-1);
    assert.equal(value.adapter.persist(bundle(), PERSISTENCE_POLICY), null);

    value.setClock(2_000_000_000_000);
    for (let index = 0; index < 128; index += 1) {
      assert.equal(
        value.adapter.persist(bundle(), PERSISTENCE_POLICY)?.status,
        "staged",
      );
    }
    const capacity = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    assert.equal(capacity?.status, "blocked");
    assert.equal(
      capacity?.status === "blocked" ? capacity.reason : null,
      "candidate_store_capacity_reservation_failed",
    );
  } finally {
    value.cleanup();
  }
});

test("公開契約は排他、bounded GC、Recoveryと非canonical Effectを固定する", () => {
  const contract = describeCandidateBundleStoreContract();
  assert.equal(contract.contractRevision, 5);
  assert.match(contract.crossProcessSerialization, /kernel_named_pipe/u);
  assert.match(contract.rootProtection, /selected_user_owner/u);
  assert.match(contract.physicalDeletion, /without_strict_instant/u);
  assert.match(contract.recovery, /exact_one/u);
  assert.equal(contract.canonicalRepositoryWriteAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.hostPathReported, false);
});

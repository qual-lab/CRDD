/**
 * coordinator:integration:candidate-bundle-storeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:candidate-bundle-storeが所有する検証責務を実行する。
 * @trace CPR-IT-001
 * @level IT
 * @scope candidate、bundle、store
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createCandidateBundleStoreTestingAdapter,
  describeCandidateBundleStoreContract,
} from "../../src/security/candidate-bundle-store.ts";

const PERSISTENCE_POLICY = Object.freeze({
  candidatePersistenceAllowed: true,
  candidateRetentionHours: 1,
  informationClassification: "public",
});

/**
 * bundleのTest準備責務を実行する。
 *
 * @responsibility bundleがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CPR-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus bundleを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * bundleAtPathのTest準備責務を実行する。
 *
 * @responsibility bundleAtPathがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CPR-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus bundleAtPathを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CPR-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
function fixture() {
  const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-candidate-store-test-"),
  );
  let clock = Date.now();
  const faults = new Set<string>();
  /**
   * createAdapterのTest準備責務を実行する。
   *
   * @responsibility createAdapterがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace CPR-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus createAdapterを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
   */
  const createAdapter = (shouldCollectExpiredEntries = true) =>
    createCandidateBundleStoreTestingAdapter({
      temporaryDirectory,
      shouldCollectExpiredEntries,
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

/**
 * requireRecoveryIdのTest準備責務を実行する。
 *
 * @responsibility requireRecoveryIdがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CPR-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus requireRecoveryIdを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
function requireRecoveryId(value: unknown) {
  assert.ok(value && typeof value === "object");
  const candidateRecoveryId = Reflect.get(value, "candidateRecoveryId");
  assert.match(
    candidateRecoveryId,
    /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
  );
  return candidateRecoveryId as string;
}

/**
 * 限定inventoryは起動・保存・公開・読取りで既存の期限切れ候補を削除しないを検証する。
 *
 * @responsibility 限定inventoryは起動・保存・公開・読取りで既存の期限切れ候補を削除しないの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 限定inventoryは起動・保存・公開・読取りで既存の期限切れ候補を削除しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
test("限定inventoryは起動・保存・公開・読取りで既存の期限切れ候補を削除しない", () => {
  const value = fixture();
  try {
    const first = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    const firstId = requireRecoveryId(first);
    const published = value.adapter.publish(firstId);
    assert.equal(published?.status, "published");
    const store = value.adapter.testingStoreDirectory();
    const beforeEntries = fs.readdirSync(store);
    assert.equal(beforeEntries.length, 1);
    const original = beforeEntries[0];
    assert.ok(original);
    const originalBytes = fs.readFileSync(path.join(store, original));
    value.advance(3_600_001);
    const limited = value.createAdapter(false);
    assert.equal(limited.startupGc().status, "completed");
    assert.deepEqual(fs.readdirSync(store), beforeEntries);
    const second = limited.persist(
      bundle(Buffer.from("second\n")),
      PERSISTENCE_POLICY,
    );
    const secondId = requireRecoveryId(second);
    const secondPublished = limited.publish(secondId);
    assert.equal(secondPublished?.status, "published");
    if (!secondPublished || !("candidateId" in secondPublished))
      throw new Error("published candidate required");
    assert.ok(limited.read(secondPublished.candidateId));
    assert.deepEqual(
      fs.readFileSync(path.join(store, original)),
      originalBytes,
    );
    assert.equal(limited.discard(secondId).status, "discarded");
    assert.deepEqual(fs.readdirSync(store), beforeEntries);
    // A later explicitly selected ordinary GC still owns expiry deletion.
    assert.equal(value.adapter.startupGc().status, "completed");
    assert.deepEqual(fs.readdirSync(store), []);
  } finally {
    value.cleanup();
  }
});

/**
 * requireStoreRecoveryIdのTest準備責務を実行する。
 *
 * @responsibility requireStoreRecoveryIdがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace CPR-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus requireStoreRecoveryIdを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * 承認済みbundleをrestart後も冪等PublishしRecovery IDでDiscardするを検証する。
 *
 * @responsibility 承認済みbundleをrestart後も冪等PublishしRecovery IDでDiscardするの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 承認済みbundleをrestart後も冪等PublishしRecovery IDでDiscardするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * 期限到達後はExportせずstartupと公開入口GCでstagedとpublishedを削除するを検証する。
 *
 * @responsibility 期限到達後はExportせずstartupと公開入口GCでstagedとpublishedを削除するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 期限到達後はExportせずstartupと公開入口GCでstagedとpublishedを削除するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * partial pendingはRecovery IDを失わず明示Discardだけが安定実体を削除するを検証する。
 *
 * @responsibility partial pendingはRecovery IDを失わず明示Discardだけが安定実体を削除するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus partial pendingはRecovery IDを失わず明示Discardだけが安定実体を削除するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * pending保存失敗後のclose報告不明は同じ候補IDと実体を保持するを検証する。
 *
 * @responsibility pending保存失敗後のclose報告不明は同じ候補IDと実体を保持するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus pending保存失敗後のclose報告不明は同じ候補IDと実体を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
test("pending保存失敗後のclose報告不明は同じ候補IDと実体を保持する", (context) => {
  const value = fixture();
  const originalOpen = fs.openSync;
  const originalClose = fs.closeSync;
  let pendingHandle: number | null = null;
  let closeFailureCount = 0;
  try {
    value.faults.add("before_pending_sync");
    context.mock.method(
      fs,
      "openSync",
      (...args: Parameters<typeof fs.openSync>) => {
        const handle = originalOpen(...args);
        if (
          typeof args[0] === "string" &&
          path.basename(args[0]).startsWith("pending-")
        )
          pendingHandle = handle;
        return handle;
      },
    );
    context.mock.method(fs, "closeSync", (handle: number) => {
      originalClose(handle);
      if (handle === pendingHandle) {
        pendingHandle = null;
        closeFailureCount += 1;
        // 実handleは回収済みだが、呼出し側はその結果を確認できない。
        throw new Error("fixture_pending_close_outcome_unknown");
      }
    });
    const failed = value.adapter.persist(bundle(), PERSISTENCE_POLICY);
    context.mock.restoreAll();
    assert.equal(closeFailureCount, 1);
    assert.equal(failed?.status, "blocked");
    assert.equal(failed?.reason, "candidate_store_persist_recovery_required");
    assert.equal(failed?.manualRecoveryRequired, true);
    const candidateRecoveryId = requireRecoveryId(failed);
    const pendingNames = fs
      .readdirSync(value.adapter.testingStoreDirectory())
      .filter((name) => name.startsWith("pending-"));
    assert.equal(pendingNames.length, 1);
    const pendingName = pendingNames[0];
    assert.ok(pendingName);
    const pendingPath = path.join(
      value.adapter.testingStoreDirectory(),
      pendingName,
    );
    const pendingBytes = fs.readFileSync(pendingPath);
    assert.ok(pendingBytes.byteLength > 0);
    assert.equal(
      fs
        .readdirSync(value.adapter.testingStoreDirectory())
        .some(
          (name) => name.startsWith("staged-") || name.startsWith("published-"),
        ),
      false,
    );
    context.mock.restoreAll();
    value.faults.clear();
    assert.deepEqual(value.createAdapter().discard(candidateRecoveryId), {
      status: "discarded",
    });
    assert.equal(fs.existsSync(pendingPath), false);
  } finally {
    context.mock.restoreAll();
    if (pendingHandle !== null) originalClose(pendingHandle);
    value.cleanup();
  }
});

/**
 * staged障害とpublish rename後障害は同じRecovery IDで再開できるを検証する。
 *
 * @responsibility staged障害とpublish rename後障害は同じRecovery IDで再開できるの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus staged障害とpublish rename後障害は同じRecovery IDで再開できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * 期限切れcleanup失敗はtyped Recoveryを返しstrict即時削除を主張しないを検証する。
 *
 * @responsibility 期限切れcleanup失敗はtyped Recoveryを返しstrict即時削除を主張しないの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 期限切れcleanup失敗はtyped Recoveryを返しstrict即時削除を主張しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * 同時writer lockとstale lockは推測削除せずboundedにFail Closedするを検証する。
 *
 * @responsibility 同時writer lockとstale lockは推測削除せずboundedにFail Closedするの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同時writer lockとstale lockは推測削除せずboundedにFail Closedするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * unknownとdamaged entryは推測削除せずexact明示Recoveryだけで回復するを検証する。
 *
 * @responsibility unknownとdamaged entryは推測削除せずexact明示Recoveryだけで回復するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus unknownとdamaged entryは推測削除せずexact明示Recoveryだけで回復するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * 個別Discardは無関係なunknown entryの全体GC失敗から独立するを検証する。
 *
 * @responsibility 個別Discardは無関係なunknown entryの全体GC失敗から独立するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 個別Discardは無関係なunknown entryの全体GC失敗から独立するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * Store Recovery ID取得後に実体が変わった場合は削除せず新しいIDを要求するを検証する。
 *
 * @responsibility Store Recovery ID取得後に実体が変わった場合は削除せず新しいIDを要求するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Store Recovery ID取得後に実体が変わった場合は削除せず新しいIDを要求するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * 不正Schema、secret、clock異常とcapacity不足をCandidateへ昇格しないを検証する。
 *
 * @responsibility 不正Schema、secret、clock異常とcapacity不足をCandidateへ昇格しないの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 不正Schema、secret、clock異常とcapacity不足をCandidateへ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * 公開契約は排他、bounded GC、Recoveryと非canonical Effectを固定するを検証する。
 *
 * @responsibility 公開契約は排他、bounded GC、Recoveryと非canonical Effectを固定するの合否判定を所有する。
 * @trace CPR-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開契約は排他、bounded GC、Recoveryと非canonical Effectを固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary CPR-IT-001=Direct Boundary: 観測結果→Candidate Store
 */
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

/**
 * coordinator:integration:docker-desktop-repair-continuation-storeの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:docker-desktop-repair-continuation-storeが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @trace ERB-IT-012
 * @level IT
 * @scope docker、desktop、repair、continuation、store
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createDockerDesktopRepairContinuation,
  dockerDesktopRepairContinuationPaths,
  inspectDockerDesktopRepairContinuation,
  persistDockerDesktopRepairContinuationIntent,
  persistDockerDesktopRepairContinuationRecovered,
  persistDockerDesktopRepairContinuationSettlement,
} from "../../src/security/docker-desktop-repair-continuation-store.ts";
import {
  createDockerDesktopRepairOperation,
  type DockerDesktopRepairDirectoryIdentity,
  type DockerDesktopRepairHistoryVerifier,
  type DockerDesktopRepairOperation,
  type DockerDesktopRepairRecordBoundary,
  persistDockerDesktopRepairHistoricalAdoption,
  persistDockerDesktopRepairStage,
} from "../../src/security/docker-desktop-repair-record-store.ts";

const identity = (value: string): DockerDesktopRepairDirectoryIdentity =>
  Object.freeze({ dev: value, ino: value, birthtimeNs: value });

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
function fixture() {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-repair-continuation-"),
  );
  const operationId = "a".repeat(32);
  const operationDirectory = path.join(
    root,
    `docker-desktop-repair-${operationId}`,
  );
  fs.mkdirSync(operationDirectory);
  const boundary: DockerDesktopRepairRecordBoundary = Object.freeze({
    runtimeStateRoot: root,
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    runtimeStateBindingHash: "4".repeat(64),
    dockerPolicySha256: "5".repeat(64),
    crddManifestHash: "6".repeat(64),
    crddReleaseSequence: 1,
    runtimeExecutionIdentitySha256: "7".repeat(64),
    localAppData: path.join(root, "local"),
  });
  const operation: DockerDesktopRepairOperation = Object.freeze({
    operationId,
    repairId: `docker-desktop-repair.${operationId}`,
    operationDirectory,
    staleName: `run.crdd-stale-${operationId}`,
    staleDirectory: path.join(
      boundary.localAppData,
      "Docker",
      `run.crdd-stale-${operationId}`,
    ),
    runIdentity: identity("10"),
    stage: "renamed",
    sequence: 11,
    previousRecordSha256: "8".repeat(64),
    ledger: Object.freeze({
      processEffects: Object.freeze([]),
      processEffectIssued: false,
      processEffectConfirmation: "not_issued",
      filesystemEffects: Object.freeze([]),
      filesystemEffectIssued: false,
      filesystemEffectConfirmation: "not_issued",
      engineReady: false,
      staleState: "retained",
      hostSafety: "safe",
      evidenceState: "preserved",
      disposition: "not_applicable",
      liveRunIdentity: null,
    }),
  });
  return { root, boundary, operation };
}

/**
 * 失敗起動後の複数Runtime領域は同じ復旧IDへ追記し、Effectごとの意図と結果を保持するを検証する。
 *
 * @responsibility 失敗起動後の複数Runtime領域は同じ復旧IDへ追記し、Effectごとの意図と結果を保持するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 失敗起動後の複数Runtime領域は同じ復旧IDへ追記し、Effectごとの意図と結果を保持するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("失敗起動後の複数Runtime領域は同じ復旧IDへ追記し、Effectごとの意図と結果を保持する", () => {
  const { root, boundary, operation } = fixture();
  try {
    let continuation = createDockerDesktopRepairContinuation(
      boundary,
      operation,
      identity("20"),
      identity("30"),
    );
    assert.ok(continuation);
    assert.equal(continuation.stage, "prepared");
    for (const action of [
      "failed_launch_run_directory_rename",
      "secrets_engine_directory_rename",
      "desktop_relaunch",
    ] as const) {
      continuation = persistDockerDesktopRepairContinuationIntent(
        boundary,
        operation,
        continuation,
        action,
      );
      assert.ok(continuation);
      assert.equal(continuation.effects[action]?.phase, "intent_recorded");
      continuation = persistDockerDesktopRepairContinuationSettlement(
        boundary,
        operation,
        continuation,
        action,
        Object.freeze({ issued: true, confirmation: "confirmed" }),
      );
      assert.ok(continuation);
      assert.equal(continuation.effects[action]?.phase, "settled");
    }
    continuation = persistDockerDesktopRepairContinuationRecovered(
      boundary,
      operation,
      continuation,
    );
    assert.ok(continuation);
    assert.equal(continuation.stage, "recovered");
    const inspected = inspectDockerDesktopRepairContinuation(
      boundary,
      operation,
    );
    assert.equal(inspected.status, "valid");
    assert.equal(inspected.continuation?.sequence, 7);
    const paths = dockerDesktopRepairContinuationPaths(boundary, continuation);
    assert.equal(
      paths.failedRunStaleDirectory.endsWith(
        `run.crdd-stale-${operation.operationId}-restart`,
      ),
      true,
    );
    assert.equal(
      paths.secretsEngineStaleDirectory.endsWith(
        `docker-secrets-engine.crdd-stale-${operation.operationId}`,
      ),
      true,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 手組みHandoff Authorityでは旧Runtime／現在RuntimeのContinuationを受理しないことを検証する。
 *
 * @responsibility plain Operation fieldを署名済みRecord Storeの検証結果へ昇格させない合否判定を所有する。
 * @trace ERB-IT-012
 * @precondition 旧tupleと現在tupleのContinuation、および空Storeを含む構造上は正しいがRecord Storeを通っていないOperationを構築する。
 * @stimulus 手組みOperationで旧Continuationと現在Continuationの読取り、追記および初回作成を要求する。
 * @observation 読取り結果、追記結果、初回作成結果およびContinuation Directory不存在を観測する。
 * @oracle 読取りはinvalid、追記と初回作成はnullとなりFilesystem Effect 0を維持する。
 * @cleanup Test本文が一時Runtime Stateを再帰削除する。
 * @boundary ERB-IT-012=Related 2 Blocks: Coordinator→Repair Record→Platform Adapter
 */
test("手組みHandoff Authorityでは旧Runtime／現在RuntimeのContinuationを受理しない", () => {
  const { root, boundary, operation } = fixture();
  const {
    root: currentRoot,
    boundary: currentBoundary,
    operation: currentOperation,
  } = fixture();
  const {
    root: emptyRoot,
    boundary: emptyBoundary,
    operation: emptyOperation,
  } = fixture();
  try {
    let continuation = createDockerDesktopRepairContinuation(
      boundary,
      operation,
      identity("20"),
      identity("30"),
    );
    assert.ok(continuation);
    for (const action of [
      "failed_launch_run_directory_rename",
      "secrets_engine_directory_rename",
      "desktop_relaunch",
    ] as const) {
      continuation = persistDockerDesktopRepairContinuationIntent(
        boundary,
        operation,
        continuation,
        action,
      );
      assert.ok(continuation);
      continuation = persistDockerDesktopRepairContinuationSettlement(
        boundary,
        operation,
        continuation,
        action,
        Object.freeze({ issued: true, confirmation: "confirmed" }),
      );
      assert.ok(continuation);
    }
    assert.equal(continuation.sequence, 6);

    const migratedBoundary: DockerDesktopRepairRecordBoundary = Object.freeze({
      ...boundary,
      localUserBindingHash: "9".repeat(64),
      crddManifestHash: "a".repeat(64),
      crddReleaseSequence: 2,
      runtimeExecutionIdentitySha256: "b".repeat(64),
    });
    const migratedOperation: DockerDesktopRepairOperation = Object.freeze({
      ...operation,
      history: Object.freeze({
        adoptionSha256: "c".repeat(64),
        handoffTipSha256: "d".repeat(64),
        handoffCount: 1,
        originLocalUserBindingHash: boundary.localUserBindingHash,
        currentLocalUserBindingHash: migratedBoundary.localUserBindingHash,
        currentSessionBound: true,
        continuationAuthorities: Object.freeze([
          Object.freeze({
            localUserBindingHash: boundary.localUserBindingHash,
            manifestHash: boundary.crddManifestHash,
            releaseSequence: boundary.crddReleaseSequence,
            runtimeExecutionIdentitySha256:
              boundary.runtimeExecutionIdentitySha256,
          }),
          Object.freeze({
            localUserBindingHash: migratedBoundary.localUserBindingHash,
            manifestHash: migratedBoundary.crddManifestHash,
            releaseSequence: migratedBoundary.crddReleaseSequence,
            runtimeExecutionIdentitySha256:
              migratedBoundary.runtimeExecutionIdentitySha256,
          }),
        ]),
        closed: false,
        liveRunIdentity: null,
        staleState: "unknown",
      }),
    });

    assert.equal(
      inspectDockerDesktopRepairContinuation(
        migratedBoundary,
        migratedOperation,
      ).status,
      "invalid",
    );
    assert.equal(
      persistDockerDesktopRepairContinuationRecovered(
        migratedBoundary,
        migratedOperation,
        continuation,
      ),
      null,
    );

    let currentContinuation = createDockerDesktopRepairContinuation(
      currentBoundary,
      currentOperation,
      identity("40"),
      identity("50"),
    );
    assert.ok(currentContinuation);
    for (const action of [
      "failed_launch_run_directory_rename",
      "secrets_engine_directory_rename",
      "desktop_relaunch",
    ] as const) {
      currentContinuation = persistDockerDesktopRepairContinuationIntent(
        currentBoundary,
        currentOperation,
        currentContinuation,
        action,
      );
      assert.ok(currentContinuation);
      currentContinuation = persistDockerDesktopRepairContinuationSettlement(
        currentBoundary,
        currentOperation,
        currentContinuation,
        action,
        Object.freeze({ issued: true, confirmation: "confirmed" }),
      );
      assert.ok(currentContinuation);
    }
    const forgedCurrentOperation: DockerDesktopRepairOperation = Object.freeze({
      ...currentOperation,
      history: Object.freeze({
        adoptionSha256: "e".repeat(64),
        handoffTipSha256: "f".repeat(64),
        handoffCount: 0,
        originLocalUserBindingHash: currentBoundary.localUserBindingHash,
        currentLocalUserBindingHash: currentBoundary.localUserBindingHash,
        currentSessionBound: true,
        continuationAuthorities: Object.freeze([
          Object.freeze({
            localUserBindingHash: currentBoundary.localUserBindingHash,
            manifestHash: currentBoundary.crddManifestHash,
            releaseSequence: currentBoundary.crddReleaseSequence,
            runtimeExecutionIdentitySha256:
              currentBoundary.runtimeExecutionIdentitySha256,
          }),
        ]),
        closed: false,
        liveRunIdentity: null,
        staleState: "unknown",
      }),
    });
    assert.equal(
      inspectDockerDesktopRepairContinuation(
        currentBoundary,
        forgedCurrentOperation,
      ).status,
      "invalid",
    );
    assert.equal(
      persistDockerDesktopRepairContinuationRecovered(
        currentBoundary,
        forgedCurrentOperation,
        currentContinuation,
      ),
      null,
    );
    const forgedEmptyOperation: DockerDesktopRepairOperation = Object.freeze({
      ...emptyOperation,
      history: Object.freeze({
        adoptionSha256: "1".repeat(64),
        handoffTipSha256: "2".repeat(64),
        handoffCount: 0,
        originLocalUserBindingHash: emptyBoundary.localUserBindingHash,
        currentLocalUserBindingHash: emptyBoundary.localUserBindingHash,
        currentSessionBound: true,
        continuationAuthorities: Object.freeze([
          Object.freeze({
            localUserBindingHash: emptyBoundary.localUserBindingHash,
            manifestHash: emptyBoundary.crddManifestHash,
            releaseSequence: emptyBoundary.crddReleaseSequence,
            runtimeExecutionIdentitySha256:
              emptyBoundary.runtimeExecutionIdentitySha256,
          }),
        ]),
        closed: false,
        liveRunIdentity: null,
        staleState: "unknown",
      }),
    });
    assert.equal(
      createDockerDesktopRepairContinuation(
        emptyBoundary,
        forgedEmptyOperation,
        identity("60"),
        identity("70"),
      ),
      null,
    );
    assert.equal(
      fs.existsSync(
        path.join(emptyOperation.operationDirectory, "runtime-continuation"),
      ),
      false,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
    fs.rmSync(currentRoot, { recursive: true, force: true });
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});

/**
 * 実Record Storeの署名済みHandoff chainから旧Continuationを検証して追記することを検証する。
 *
 * @responsibility 検証済みRelease tuple、adoption、handoff、Process-local attestationおよびContinuation追記の結合を検証する。
 * @trace ERB-IT-012
 * @precondition 旧RuntimeのContinuationと、検証可能なorigin／adoption／handoff記録を実Storeへ保存する。
 * @stimulus 現在SessionのRecord StoreからOperationを再読取りし、旧Continuationを確認して次段階を追記する。
 * @observation Authority順序、現在境界結合、旧段階の受理および現在tupleでの追記を観測する。
 * @oracle Record Storeが検証したOperationだけが旧Continuationを受理し、sequence 7を現在境界で追記する。
 * @cleanup Test本文が一時Runtime Stateを再帰削除する。
 * @boundary ERB-IT-012=Related 2 Blocks: Coordinator→Repair Record→Platform Adapter
 */
test("実Record Storeの署名済みHandoff chainから旧Continuationを検証して追記する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-repair-chain-"));
  const runtimeStateRoot = path.join(root, "RuntimeState");
  const localAppData = path.join(root, "LocalAppData");
  fs.mkdirSync(runtimeStateRoot);
  fs.mkdirSync(path.join(localAppData, "Docker"), { recursive: true });
  const boundary: DockerDesktopRepairRecordBoundary = Object.freeze({
    runtimeStateRoot,
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    runtimeStateBindingHash: "4".repeat(64),
    dockerPolicySha256: "5".repeat(64),
    crddManifestHash: "6".repeat(64),
    crddReleaseSequence: 1,
    runtimeExecutionIdentitySha256: "7".repeat(64),
    localAppData,
  });
  try {
    const ledger = Object.freeze({
      processEffects: Object.freeze([]),
      processEffectIssued: false,
      processEffectConfirmation: "not_issued" as const,
      filesystemEffects: Object.freeze([]),
      filesystemEffectIssued: false,
      filesystemEffectConfirmation: "not_issued" as const,
      engineReady: false,
      staleState: "absent" as const,
      hostSafety: "safe" as const,
      evidenceState: "not_preserved" as const,
      disposition: "not_applicable" as const,
      liveRunIdentity: null,
    });
    const created = createDockerDesktopRepairOperation(
      boundary,
      identity("10"),
      ledger,
    );
    const recordedLedger = Object.freeze({
      ...ledger,
      filesystemEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action: "record_write" as const,
          phase: "settled" as const,
          issued: true,
          confirmation: "unknown" as const,
        }),
      ]),
      filesystemEffectIssued: true as const,
      filesystemEffectConfirmation: "unknown" as const,
    });
    const original = persistDockerDesktopRepairStage(
      boundary,
      created,
      "prepared",
      recordedLedger,
    );
    assert.ok(original);
    let continuation = createDockerDesktopRepairContinuation(
      boundary,
      original,
      identity("20"),
      identity("30"),
    );
    assert.ok(continuation);
    for (const action of [
      "failed_launch_run_directory_rename",
      "secrets_engine_directory_rename",
      "desktop_relaunch",
    ] as const) {
      continuation = persistDockerDesktopRepairContinuationIntent(
        boundary,
        original,
        continuation,
        action,
      );
      assert.ok(continuation);
      continuation = persistDockerDesktopRepairContinuationSettlement(
        boundary,
        original,
        continuation,
        action,
        Object.freeze({ issued: true, confirmation: "confirmed" }),
      );
      assert.ok(continuation);
    }

    const adoptedBoundary: DockerDesktopRepairRecordBoundary = Object.freeze({
      ...boundary,
      crddManifestHash: "a".repeat(64),
      crddReleaseSequence: 2,
      runtimeExecutionIdentitySha256: "b".repeat(64),
    });
    const currentBoundary: DockerDesktopRepairRecordBoundary = Object.freeze({
      ...adoptedBoundary,
      localUserBindingHash: "9".repeat(64),
      crddManifestHash: "c".repeat(64),
      crddReleaseSequence: 3,
      runtimeExecutionIdentitySha256: "d".repeat(64),
    });
    const originManifest = Object.freeze({ release: "origin" });
    const adoptedManifest = Object.freeze({ release: "adopted" });
    const currentManifest = Object.freeze({ release: "current" });
    /**
     * verifyHistoryのTest準備責務を実行する。
     *
     * @responsibility 署名済みRelease履歴の検証結果を決定論的に構築する。
     * @trace ERB-IT-012
     * @precondition Test Caseが既知のorigin、adoptionまたはhandoff manifestを渡す。
     * @stimulus verifyHistoryをmanifest候補で呼び出す。
     * @observation 対応するRelease tupleまたはnullを取得する。
     * @oracle 既知manifestだけが対応するRelease tupleへ解決され、未知manifestは拒否される。
     * @cleanup N/A: Test Helperは永続資源を作成しない。
     * @boundary ERB-IT-012=Related 2 Blocks: Coordinator→Repair Record→Platform Adapter
     */
    const verifyHistory: DockerDesktopRepairHistoryVerifier = (value) => {
      const selected =
        JSON.stringify(value) === JSON.stringify(originManifest)
          ? boundary
          : JSON.stringify(value) === JSON.stringify(adoptedManifest)
            ? adoptedBoundary
            : JSON.stringify(value) === JSON.stringify(currentManifest)
              ? currentBoundary
              : null;
      return selected
        ? Object.freeze({
            manifestHash: selected.crddManifestHash,
            releaseSequence: selected.crddReleaseSequence,
            runtimeExecutionIdentitySha256:
              selected.runtimeExecutionIdentitySha256,
            crddTree: "e".repeat(40),
            packageContentRootSha256: "f".repeat(64),
          })
        : null;
    };
    const adopted = persistDockerDesktopRepairHistoricalAdoption(
      adoptedBoundary,
      original,
      originManifest,
      adoptedManifest,
      verifyHistory,
    );
    assert.ok(adopted);
    const handedOff = persistDockerDesktopRepairHistoricalAdoption(
      currentBoundary,
      adopted,
      originManifest,
      currentManifest,
      verifyHistory,
    );
    assert.ok(handedOff);
    assert.deepEqual(
      handedOff.history?.continuationAuthorities?.map((value) => [
        value.localUserBindingHash,
        value.releaseSequence,
      ]),
      [
        [boundary.localUserBindingHash, 1],
        [adoptedBoundary.localUserBindingHash, 2],
        [currentBoundary.localUserBindingHash, 3],
      ],
    );
    assert.equal(
      inspectDockerDesktopRepairContinuation(currentBoundary, handedOff).status,
      "valid",
    );
    const recovered = persistDockerDesktopRepairContinuationRecovered(
      currentBoundary,
      handedOff,
      continuation,
    );
    assert.ok(recovered);
    assert.equal(recovered.sequence, 7);
    const recoveredRecord = JSON.parse(
      fs.readFileSync(
        path.join(
          handedOff.operationDirectory,
          "runtime-continuation",
          "continuation-07-recovered.json",
        ),
        "utf8",
      ),
    );
    assert.equal(
      recoveredRecord.crddManifestHash,
      currentBoundary.crddManifestHash,
    );
    assert.equal(
      recoveredRecord.localUserBindingHash,
      currentBoundary.localUserBindingHash,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 継続記録の改ざん・余分な項目・途中欠落はvalidへ昇格しないを検証する。
 *
 * @responsibility 継続記録の改ざん・余分な項目・途中欠落はvalidへ昇格しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 継続記録の改ざん・余分な項目・途中欠落はvalidへ昇格しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("継続記録の改ざん・余分な項目・途中欠落はvalidへ昇格しない", () => {
  for (const mutation of ["hash", "extra", "missing"] as const) {
    const { root, boundary, operation } = fixture();
    try {
      const continuation = createDockerDesktopRepairContinuation(
        boundary,
        operation,
        identity("20"),
        identity("30"),
      );
      assert.ok(continuation);
      const directory = path.join(
        operation.operationDirectory,
        "runtime-continuation",
      );
      const target = path.join(directory, "continuation-00-prepared.json");
      if (mutation === "missing") fs.unlinkSync(target);
      else {
        const parsed = JSON.parse(fs.readFileSync(target, "utf8"));
        if (mutation === "hash") parsed.operationTipSha256 = "f".repeat(64);
        else parsed.extra = true;
        fs.writeFileSync(target, `${JSON.stringify(parsed)}\n`, "utf8");
      }
      assert.equal(
        inspectDockerDesktopRepairContinuation(boundary, operation).status,
        "invalid",
        mutation,
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

/**
 * 全Host Effectがconfirmedでなければrecoveredを記録しないを検証する。
 *
 * @responsibility 全Host Effectがconfirmedでなければrecoveredを記録しないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 全Host Effectがconfirmedでなければrecoveredを記録しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
test("全Host Effectがconfirmedでなければrecoveredを記録しない", () => {
  const { root, boundary, operation } = fixture();
  try {
    let continuation = createDockerDesktopRepairContinuation(
      boundary,
      operation,
      identity("20"),
      identity("30"),
    );
    assert.ok(continuation);
    for (const action of [
      "failed_launch_run_directory_rename",
      "secrets_engine_directory_rename",
      "desktop_relaunch",
    ] as const) {
      continuation = persistDockerDesktopRepairContinuationIntent(
        boundary,
        operation,
        continuation,
        action,
      );
      assert.ok(continuation);
      continuation = persistDockerDesktopRepairContinuationSettlement(
        boundary,
        operation,
        continuation,
        action,
        action === "desktop_relaunch"
          ? Object.freeze({ issued: false, confirmation: "not_issued" })
          : Object.freeze({ issued: true, confirmation: "confirmed" }),
      );
      assert.ok(continuation);
    }
    assert.equal(
      persistDockerDesktopRepairContinuationRecovered(
        boundary,
        operation,
        continuation,
      ),
      null,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

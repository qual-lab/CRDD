/**
 * runtime-data:integration:temporary-operation-lifecycleの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility runtime-data:integration:temporary-operation-lifecycleが所有する検証責務を実行する。
 * @trace RDL-IT-003
 * @trace RDL-IT-004
 * @level IT
 * @scope runtime-data、temporary、lifecycle、cleanup、recovery
 * @boundary RDL-IT-003=Related 2 Blocks: Cleanup Planner→Filesystem Observer→Recovery Store / RDL-IT-004=Adjacent 1 Block: Runtime Data API→Path Policy→Filesystem
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { mock, type TestContext } from "node:test";

import {
  createTemporaryOperation,
  ensureRepositoryRuntimeDataArea,
  resumeTemporaryOperation,
  settleTemporaryOperation,
  type TemporaryOperationRecoveryReference,
  verifyTemporaryOperationEvidencePromotion,
} from "../../src/storage/index.ts";
import {
  requireReadyRepositoryRuntimeDataArea,
  resolveRepositoryRuntimeDataPaths,
} from "../../src/repository/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { settleTemporaryOperationWithRemovalForVerification } from "../../src/storage/temporary-operation-store.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * resumeWithNextIdentityのTest準備責務を実行する。
 *
 * @responsibility resumeWithNextIdentityがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RDL-IT-003
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus resumeWithNextIdentityを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-003=Direct Boundary: runtime-data Test Source→対象契約
 */
function resumeWithNextIdentity(
  capability: Parameters<typeof resumeTemporaryOperation>[0],
  reference: TemporaryOperationRecoveryReference,
  nextIdentity = randomUUID(),
) {
  return resumeTemporaryOperation(capability, reference, nextIdentity);
}

/**
 * 署名準備の保存不明と種別不一致を削除許可へ変換しない。
 * @responsibility 更新前・公開後・最終清掃の失敗でも既知参照を保持する。
 * @trace RDL-IT-004
 * @precondition この試験だけが自己生成signature領域を使用する。
 * @stimulus 文書種別置換とFilesystem失敗を局所注入する。
 * @observation 返却参照、世代、work・文書・Rootの存在を読む。
 * @oracle 不明をcompletedにせず、別profileを削除しない。
 * @cleanup mockを復元し、所有能力またはexact参照で回収する。空Rootだけは非再帰削除する。
 * @boundary Runtime Dataと署名用制御文書。実Process喪失は主張しない。
 */
test("署名準備の保存失敗とprofile置換でもexact参照を保持する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  for (const fault of [
    "profile",
    "update",
    "update-after",
    "rmdir",
    "publish-before",
    "publish-after",
    "readback",
  ] as const) {
    const opened = createTemporaryOperation(root.capability, {
      operationId: randomUUID(),
      identity: randomUUID(),
      owner: "coordinator-release-runtime",
      storage: "signature",
      purpose: "fixed-runtime-signing-preparation",
      allowedContent: ["runtime-files", "signed-manifest"],
      evidencePromotion: "not_required",
    });
    assert.equal(opened.status, "completed");
    if (opened.status !== "completed") return;
    const directory = path.dirname(opened.workDirectory);
    const document = path.join(directory, "preparation.json");
    const originalBytes = fs.readFileSync(document);
    if (fault === "profile") {
      const replaced = JSON.parse(originalBytes.toString("utf8"));
      replaced.schema = "crdd/runtime-data/temporary-operation/v3";
      delete replaced.storage;
      fs.writeFileSync(document, JSON.stringify(replaced));
      const rejected = settleTemporaryOperation(
        opened.capability,
        "completed",
        null,
      );
      assert.equal(rejected.status, "blocked");
      assert.deepEqual(rejected.recoveryReference, opened.recoveryReference);
      assert.equal(fs.existsSync(opened.workDirectory), true);
      fs.writeFileSync(document, originalBytes);
      assert.equal(
        settleTemporaryOperation(opened.capability, "completed", null)
          .cleanupConfirmed,
        true,
      );
      continue;
    }
    if (
      fault === "publish-before" ||
      fault === "publish-after" ||
      fault === "readback"
    ) {
      settleTemporaryOperation(opened.capability, "parent_lost", null);
      const rename = fs.renameSync;
      let readbackFailed = false;
      const read = fs.readFileSync;
      const injected =
        fault === "readback"
          ? mock.method(fs, "readFileSync", ((
              ...args: Parameters<typeof fs.readFileSync>
            ) => {
              const value = Reflect.apply(read, fs, args) as Buffer | string;
              if (
                args[0] === document &&
                !readbackFailed &&
                String(value).includes('"generation":2')
              ) {
                readbackFailed = true;
                throw new Error("injected_readback_failure");
              }
              return value;
            }) as typeof fs.readFileSync)
          : mock.method(
              fs,
              "renameSync",
              (from: fs.PathLike, to: fs.PathLike) => {
                if (to !== document) return rename(from, to);
                if (fault === "publish-after") rename(from, to);
                throw new Error("injected_publish_failure");
              },
            );
      const nextIdentity = randomUUID();
      let failed: ReturnType<typeof resumeTemporaryOperation>;
      try {
        failed = resumeTemporaryOperation(
          root.capability,
          opened.recoveryReference,
          nextIdentity,
        );
      } finally {
        injected.mock.restore();
      }
      assert.equal(failed.status, "blocked");
      assert.deepEqual(
        failed.recoveryReference,
        fault === "publish-before"
          ? opened.recoveryReference
          : {
              ...opened.recoveryReference,
              identity: nextIdentity,
              generation: 2,
            },
      );
      assert.ok(failed.recoveryReference);
      const retry = resumeTemporaryOperation(
        root.capability,
        failed.recoveryReference,
        randomUUID(),
      );
      assert.equal(retry.status, "completed");
      if (retry.status === "completed")
        assert.equal(
          settleTemporaryOperation(retry.capability, "completed", null)
            .cleanupConfirmed,
          true,
        );
      continue;
    }
    const rename = fs.renameSync;
    const rmdir = fs.rmdirSync;
    const injected =
      fault === "update" || fault === "update-after"
        ? mock.method(
            fs,
            "renameSync",
            (from: fs.PathLike, to: fs.PathLike) => {
              if (to === document) {
                if (fault === "update-after") rename(from, to);
                throw new Error("injected_update_failure");
              }
              return rename(from, to);
            },
          )
        : mock.method(fs, "rmdirSync", ((
            target: fs.PathLike,
            options?: fs.RmDirOptions,
          ) => {
            if (target === directory)
              throw new Error("injected_root_removal_failure");
            return rmdir(target, options);
          }) as typeof fs.rmdirSync);
    let failed: ReturnType<typeof settleTemporaryOperation>;
    try {
      failed = settleTemporaryOperation(opened.capability, "completed", null);
    } finally {
      injected.mock.restore();
    }
    assert.equal(failed.status, "blocked");
    assert.deepEqual(failed.recoveryReference, opened.recoveryReference);
    if (fault === "update-after") {
      assert.equal(failed.recoveryRequired, true);
      const retry = resumeTemporaryOperation(
        root.capability,
        opened.recoveryReference,
        randomUUID(),
      );
      assert.equal(retry.status, "completed");
      if (retry.status === "completed")
        assert.equal(
          settleTemporaryOperation(retry.capability, "completed", null)
            .cleanupConfirmed,
          true,
        );
    } else if (fault === "update") {
      assert.equal(failed.recoveryRequired, false);
      assert.equal(fs.existsSync(opened.workDirectory), true);
      assert.equal(
        settleTemporaryOperation(opened.capability, "completed", null)
          .cleanupConfirmed,
        true,
      );
    } else {
      assert.equal(failed.recoveryRequired, true);
      assert.equal(fs.existsSync(document), false);
      assert.equal(
        resumeTemporaryOperation(
          root.capability,
          opened.recoveryReference,
          randomUUID(),
        ).status,
        "blocked",
      );
      assert.deepEqual(fs.readdirSync(directory), []);
      fs.rmdirSync(directory);
    }
    assert.equal(fs.existsSync(directory), false);
  }
});

/**
 * 署名準備は固定一時領域だけを所有し、終了時に全体を回収する。
 * @responsibility 配置、排他、再入場、未知内容の保存を確認する。
 * @trace RDL-IT-004
 * @precondition 検証済みRepositoryでsignature領域が未使用である。
 * @stimulus 署名用操作の作成、中断、再入場、終了を実行する。
 * @observation 配置、制御記録、清掃結果を読み取る。
 * @oracle 異なる操作を拒否し、正常終了後はsignatureが不存在。
 * @cleanup 同じ能力またはexact回復参照で終了する。
 * @boundary Runtime DataとRepository-local署名一時領域。
 */
test("署名準備は固定領域を排他所有し再入場後にフォルダ全体を回収する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const input = {
    operationId: randomUUID(),
    identity: randomUUID(),
    owner: "coordinator-release-runtime",
    storage: "signature" as const,
    purpose: "fixed-runtime-signing-preparation",
    allowedContent: ["runtime-files", "signed-manifest"],
    evidencePromotion: "not_required" as const,
  };
  const opened = createTemporaryOperation(root.capability, input);
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const directory = path.join(repositoryRoot, ".crdd/tmp/signature");
  assert.equal(opened.workDirectory, path.join(directory, "work"));
  assert.deepEqual(fs.readdirSync(directory).sort(), [
    "preparation.json",
    "work",
  ]);
  assert.equal(
    JSON.parse(
      fs.readFileSync(path.join(directory, "preparation.json"), "utf8"),
    ).storage,
    "signature",
  );
  const rejected = createTemporaryOperation(root.capability, {
    ...input,
    operationId: randomUUID(),
    identity: randomUUID(),
  });
  assert.equal(rejected.status, "blocked");
  assert.equal(fs.existsSync(opened.workDirectory), true);
  const stopped = settleTemporaryOperation(
    opened.capability,
    "parent_lost",
    null,
  );
  assert.equal(stopped.status, "blocked");
  assert.deepEqual(stopped.recoveryReference, opened.recoveryReference);
  const resumed = resumeTemporaryOperation(
    root.capability,
    opened.recoveryReference,
    randomUUID(),
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  const unknown = path.join(directory, "unknown.txt");
  fs.writeFileSync(unknown, "do not remove");
  const blocked = settleTemporaryOperation(
    resumed.capability,
    "completed",
    null,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(fs.readFileSync(unknown, "utf8"), "do not remove");
  assert.equal(fs.existsSync(path.join(directory, "preparation.json")), true);
  fs.unlinkSync(unknown);
  assert.ok(blocked.recoveryReference);
  const retry = resumeTemporaryOperation(
    root.capability,
    blocked.recoveryReference,
    randomUUID(),
  );
  assert.equal(retry.status, "completed");
  if (retry.status !== "completed") return;
  assert.equal(
    settleTemporaryOperation(retry.capability, "completed", null)
      .cleanupConfirmed,
    true,
  );
  assert.equal(fs.existsSync(directory), false);
});

/**
 * tmp Operationは正常・失敗・取消・Timeoutで不存在まで確認するを検証する。
 *
 * @responsibility tmp Operationは正常・失敗・取消・Timeoutで不存在まで確認するの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus tmp Operationは正常・失敗・取消・Timeoutで不存在まで確認するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("tmp Operationは正常・失敗・取消・Timeoutで不存在まで確認する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  for (const outcome of [
    "completed",
    "failed",
    "cancelled",
    "timed_out",
  ] as const) {
    const operationId = `runtime-data-test-${outcome}-${process.pid}`;
    const opened = createTemporaryOperation(root.capability, {
      operationId,
      owner: "runtime-data-test",
      identity: randomUUID(),
      purpose: "temporary lifecycle verification",
      allowedContent: ["fixture"],
      evidencePromotion: "not_required",
    });
    assert.equal(opened.status, "completed");
    if (opened.status !== "completed") continue;
    fs.writeFileSync(
      path.join(opened.workDirectory, "fixture.txt"),
      "fixture\n",
    );
    const settled = settleTemporaryOperation(opened.capability, outcome, null);
    assert.equal(settled.status, "completed");
    assert.equal(settled.cleanupConfirmed, true);
    assert.equal(fs.existsSync(path.dirname(opened.workDirectory)), false);
  }
});

/**
 * 親Process喪失はexact Recovery参照を返し物理残存を削除しないを検証する。
 *
 * @responsibility 親Process喪失はexact Recovery参照を返し物理残存を削除しないの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 親Process喪失はexact Recovery参照を返し物理残存を削除しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("親Process喪失はexact Recovery参照を返し物理残存を削除しない", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-parent-lost-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "parent loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.equal(lost.status, "blocked");
  assert.equal(lost.recoveryReference?.operationId, operationId);
  assert.equal(fs.existsSync(path.dirname(opened.workDirectory)), true);
  assert.equal(
    settleTemporaryOperation(opened.capability, "failed", null).reason,
    "temporary_operation_capability_invalid",
  );
  assert.ok(opened.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    opened.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    resumeWithNextIdentity(root.capability, opened.recoveryReference).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const cleaned = settleTemporaryOperation(resumed.capability, "failed", null);
  assert.equal(cleaned.status, "completed");
});

/**
 * 再入場はexact Recovery Identity以外をEffect前に拒否するを検証する。
 *
 * @responsibility 再入場はexact Recovery Identity以外をEffect前に拒否するの合否判定を所有する。
 * @trace RDL-IT-003
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 再入場はexact Recovery Identity以外をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-003=Direct Boundary: runtime-data Test Source→対象契約
 */
test("再入場はexact Recovery Identity以外をEffect前に拒否する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-identity-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "recovery identity verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  assert.ok(opened.recoveryReference);
  assert.equal(
    resumeWithNextIdentity(root.capability, {
      ...opened.recoveryReference,
      identity: "different-identity",
    }).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  assert.equal(
    settleTemporaryOperation(opened.capability, "failed", null).status,
    "completed",
  );
});

/**
 * Evidence未昇格ではtmpを削除しないを検証する。
 *
 * @responsibility Evidence未昇格ではtmpを削除しないの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Evidence未昇格ではtmpを削除しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Evidence未昇格ではtmpを削除しない", (t) => {
  const fixture = createEvidencePromotionFixture(t);
  const root = fixture.root;
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-evidence-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "evidence promotion verification",
    allowedContent: ["fixture"],
    evidencePromotion: "required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const blocked = settleTemporaryOperation(
    opened.capability,
    "completed",
    null,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(fs.existsSync(path.dirname(opened.workDirectory)), true);
  const paths = resolveRepositoryRuntimeDataPaths(root.capability);
  assert.ok(paths);
  const artifactDirectory = path.join(
    fixture.repositoryRoot,
    "99_Roadmap",
    "Changes",
    "CHG-000001",
    "Evidence",
    operationId,
  );
  t.after(() => {
    fs.rmSync(artifactDirectory, {
      recursive: true,
      force: true,
    });
    fs.rmSync(path.join(paths.temporary, operationId), {
      recursive: true,
      force: true,
    });
  });
  fs.mkdirSync(artifactDirectory, { recursive: true });
  const artifact = path.join(artifactDirectory, "fixture");
  fs.writeFileSync(artifact, "promoted\n");
  const unrelated = verifyTemporaryOperationEvidencePromotion(
    root.capability,
    opened.capability,
    {
      evidenceRelativePath: `99_Roadmap/Changes/CHG-000001/Evidence/${operationId}/fixture`,
      artifactName: "fixture",
      sha256:
        "832d7e61059cd7375f9bec232c07f3d8deeab5687279bd589e3b9bf4ad758055",
    },
  );
  assert.equal(unrelated.status, "blocked");
  fs.writeFileSync(path.join(opened.workDirectory, "fixture"), "promoted\n");
  const promoted = verifyTemporaryOperationEvidencePromotion(
    root.capability,
    opened.capability,
    {
      evidenceRelativePath: `99_Roadmap/Changes/CHG-000001/Evidence/${operationId}/fixture`,
      artifactName: "fixture",
      sha256:
        "832d7e61059cd7375f9bec232c07f3d8deeab5687279bd589e3b9bf4ad758055",
    },
  );
  assert.equal(promoted.status, "completed");
  if (promoted.status === "completed") {
    fs.writeFileSync(artifact, "changed\n");
    assert.equal(
      settleTemporaryOperation(opened.capability, "completed", promoted.receipt)
        .reason,
      "temporary_operation_evidence_not_promoted",
    );
    fs.writeFileSync(artifact, "promoted\n");
    assert.equal(
      settleTemporaryOperation(opened.capability, "completed", promoted.receipt)
        .status,
      "completed",
    );
  }
});

/**
 * cleanup失敗は耐久状態へ遷移しexact参照で一度だけ再入場できるを検証する。
 *
 * @responsibility cleanup失敗は耐久状態へ遷移しexact参照で一度だけ再入場できるの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus cleanup失敗は耐久状態へ遷移しexact参照で一度だけ再入場できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("cleanup失敗は耐久状態へ遷移しexact参照で一度だけ再入場できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-cleanup-recovery-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "cleanup failure recovery verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const failed = settleTemporaryOperationWithRemovalForVerification(
    opened.capability,
    "failed",
    null,
    (directory) => {
      fs.rmSync(path.join(directory, "work"), { recursive: true });
      throw new Error("injected_remove_failure");
    },
  );
  assert.equal(failed.status, "blocked");
  assert.equal(failed.recoveryRequired, true);
  assert.ok(failed.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    failed.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    resumeWithNextIdentity(root.capability, failed.recoveryReference).status,
    "blocked",
  );
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

/**
 * Lock cleanup失敗はreleased Lockを残し再入場時に安全に回収するを検証する。
 *
 * @responsibility Lock cleanup失敗はreleased Lockを残し再入場時に安全に回収するの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock cleanup失敗はreleased Lockを残し再入場時に安全に回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Lock cleanup失敗はreleased Lockを残し再入場時に安全に回収する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-lock-recovery-${process.pid}`;
  const opened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "lock cleanup recovery verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const failed = settleTemporaryOperationWithRemovalForVerification(
    opened.capability,
    "failed",
    null,
    (directory) => fs.rmSync(directory, { recursive: true }),
    () => {
      throw new Error("injected_lock_remove_failure");
    },
  );
  assert.equal(failed.status, "blocked");
  assert.equal(failed.reason, "temporary_operation_lock_cleanup_unconfirmed");
  assert.equal(failed.recoveryRequired, true);
  assert.ok(failed.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    failed.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

/**
 * 初回Capability返却前に終了したpreparing世代は既知参照から回復できるを検証する。
 *
 * @responsibility 初回Capability返却前に終了したpreparing世代は既知参照から回復できるの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 初回Capability返却前に終了したpreparing世代は既知参照から回復できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("初回Capability返却前に終了したpreparing世代は既知参照から回復できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-process-loss-${process.pid}`;
  const identity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/create-temporary-operation-and-exit.ts"),
      repositoryRoot,
      operationId,
      identity,
      "after-control",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 83, child.stderr);
  assert.equal(child.stdout, "");
  const reference: TemporaryOperationRecoveryReference = Object.freeze({
    operationId,
    owner: "runtime-data-test",
    identity,
    generation: 1,
  });
  const resumed = resumeWithNextIdentity(root.capability, reference);
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

/**
 * Canonical公開前に終了した初回stagingは既知参照から回復できるを検証する。
 *
 * @responsibility Canonical公開前に終了した初回stagingは既知参照から回復できるの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Canonical公開前に終了した初回stagingは既知参照から回復できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Canonical公開前に終了した初回stagingは既知参照から回復できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-prepublish-${process.pid}`;
  const identity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/create-temporary-operation-and-exit.ts"),
      repositoryRoot,
      operationId,
      identity,
      "after-staging",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 83, child.stderr);
  const reference: TemporaryOperationRecoveryReference = Object.freeze({
    operationId,
    owner: "runtime-data-test",
    identity,
    generation: 1,
  });
  const resumed = resumeWithNextIdentity(root.capability, reference);
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * Canonical公開直後のProcess死は同一fileの初回staging aliasまで回収するを検証する。
 *
 * @responsibility Canonical公開直後のProcess死は同一fileの初回staging aliasまで回収するの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Canonical公開直後のProcess死は同一fileの初回staging aliasまで回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Canonical公開直後のProcess死は同一fileの初回staging aliasまで回収する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-linked-staging-${process.pid}`;
  const identity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/create-temporary-operation-and-exit.ts"),
      repositoryRoot,
      operationId,
      identity,
      "after-staging-linked",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 83, child.stderr);
  const reference: TemporaryOperationRecoveryReference = Object.freeze({
    operationId,
    owner: "runtime-data-test",
    identity,
    generation: 1,
  });
  const paths = resolveRepositoryRuntimeDataPaths(root.capability);
  assert.ok(paths);
  if (!paths) return;
  const stagingDocumentPath = path.join(
    paths.temporary,
    ".operations",
    ".staging",
    `${operationId}.${identity}.1.preparing.json`,
  );
  assert.equal(fs.existsSync(stagingDocumentPath), true);
  const resumed = resumeWithNextIdentity(root.capability, reference);
  assert.equal(resumed.status, "completed");
  assert.equal(fs.existsSync(stagingDocumentPath), false);
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * 初回staging書込み中のProcess死はexact stagingだけを不存在へ戻すを検証する。
 *
 * @responsibility 初回staging書込み中のProcess死はexact stagingだけを不存在へ戻すの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 初回staging書込み中のProcess死はexact stagingだけを不存在へ戻すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("初回staging書込み中のProcess死はexact stagingだけを不存在へ戻す", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const operationId = `runtime-data-test-partial-staging-${process.pid}`;
  const identity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/create-temporary-operation-and-exit.ts"),
      repositoryRoot,
      operationId,
      identity,
      "after-staging-created",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 83, child.stderr);
  const reference: TemporaryOperationRecoveryReference = Object.freeze({
    operationId,
    owner: "runtime-data-test",
    identity,
    generation: 1,
  });
  const cleaned = resumeWithNextIdentity(root.capability, reference);
  assert.equal(
    cleaned.reason,
    "temporary_operation_prepublication_cleanup_confirmed",
  );
  assert.equal(cleaned.cleanupConfirmed, true);
  const reopened = createTemporaryOperation(root.capability, {
    operationId,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "replacement after partial staging cleanup",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(reopened.status, "completed");
  if (reopened.status === "completed")
    assert.equal(
      settleTemporaryOperation(reopened.capability, "failed", null).status,
      "completed",
    );
});

/**
 * Lock公開前のProcess死はcaller-known Identityで再入場できるを検証する。
 *
 * @responsibility Lock公開前のProcess死はcaller-known Identityで再入場できるの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock公開前のProcess死はcaller-known Identityで再入場できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Lock公開前のProcess死はcaller-known Identityで再入場できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-lock-prepublish-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "lock prepublication process loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "after-lock-staging",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 84, child.stderr);
  const resumed = resumeWithNextIdentity(
    root.capability,
    lost.recoveryReference,
    nextIdentity,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * Lock公開直後のProcess死はCanonicalとstagingの両方を再入場で回収するを検証する。
 *
 * @responsibility Lock公開直後のProcess死はCanonicalとstagingの両方を再入場で回収するの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock公開直後のProcess死はCanonicalとstagingの両方を再入場で回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Lock公開直後のProcess死はCanonicalとstagingの両方を再入場で回収する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-lock-linked-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "linked lock process loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "after-lock-linked",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 84, child.stderr);
  const resumed = resumeWithNextIdentity(
    root.capability,
    lost.recoveryReference,
    nextIdentity,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * Lock staging書込み中のProcess死も同じ次世代Identityで回収するを検証する。
 *
 * @responsibility Lock staging書込み中のProcess死も同じ次世代Identityで回収するの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lock staging書込み中のProcess死も同じ次世代Identityで回収するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Lock staging書込み中のProcess死も同じ次世代Identityで回収する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-lock-partial-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "partial lock staging process loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "after-lock-staging-created",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 84, child.stderr);
  const resumed = resumeWithNextIdentity(
    root.capability,
    lost.recoveryReference,
    nextIdentity,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * 返却済み新世代の実Process死後も使用済み旧参照を拒否するを検証する。
 *
 * @responsibility 返却済み新世代の実Process死後も使用済み旧参照を拒否するの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 返却済み新世代の実Process死後も使用済み旧参照を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("返却済み新世代の実Process死後も使用済み旧参照を拒否する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-resume-crash-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "resumed process crash verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "after-return",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 0, child.stderr);
  const nextReference = JSON.parse(
    child.stdout.trim(),
  ) as TemporaryOperationRecoveryReference;
  assert.equal(
    resumeWithNextIdentity(root.capability, lost.recoveryReference).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const resumed = resumeWithNextIdentity(root.capability, nextReference);
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * 新世代公開後・Capability返却前のProcess死でも次世代参照を再構成できるを検証する。
 *
 * @responsibility 新世代公開後・Capability返却前のProcess死でも次世代参照を再構成できるの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 新世代公開後・Capability返却前のProcess死でも次世代参照を再構成できるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("新世代公開後・Capability返却前のProcess死でも次世代参照を再構成できる", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-resume-prereturn-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "resume pre-return process loss verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.ok(lost.recoveryReference);
  const nextIdentity = randomUUID();
  const child = spawnSync(
    process.execPath,
    [
      path.resolve("tests/fixtures/resume-temporary-operation-and-exit.ts"),
      repositoryRoot,
      Buffer.from(JSON.stringify(lost.recoveryReference)).toString("base64url"),
      nextIdentity,
      "before-return",
    ],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(child.status, 84, child.stderr);
  const nextReference: TemporaryOperationRecoveryReference = Object.freeze({
    ...lost.recoveryReference,
    identity: nextIdentity,
    generation: lost.recoveryReference.generation + 1,
  });
  assert.equal(
    resumeWithNextIdentity(root.capability, lost.recoveryReference).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const resumed = resumeWithNextIdentity(root.capability, nextReference);
  assert.equal(resumed.status, "completed");
  if (resumed.status === "completed")
    assert.equal(
      settleTemporaryOperation(resumed.capability, "failed", null).status,
      "completed",
    );
});

/**
 * 使用済みの旧世代Recovery参照は後続の親喪失後も再利用できないを検証する。
 *
 * @responsibility 使用済みの旧世代Recovery参照は後続の親喪失後も再利用できないの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 使用済みの旧世代Recovery参照は後続の親喪失後も再利用できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("使用済みの旧世代Recovery参照は後続の親喪失後も再利用できない", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-old-reference-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "single use recovery reference verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  const firstLost = settleTemporaryOperation(
    opened.capability,
    "parent_lost",
    null,
  );
  assert.ok(firstLost.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    firstLost.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  const secondLost = settleTemporaryOperation(
    resumed.capability,
    "parent_lost",
    null,
  );
  assert.ok(secondLost.recoveryReference);
  assert.equal(
    resumeWithNextIdentity(root.capability, firstLost.recoveryReference).reason,
    "temporary_operation_recovery_identity_mismatch",
  );
  const finalResume = resumeWithNextIdentity(
    root.capability,
    secondLost.recoveryReference,
  );
  assert.equal(finalResume.status, "completed");
  if (finalResume.status === "completed")
    assert.equal(
      settleTemporaryOperation(finalResume.capability, "failed", null).status,
      "completed",
    );
});

/**
 * active中の再入場・stale Capability・不正な終端値を拒否するを検証する。
 *
 * @responsibility active中の再入場・stale Capability・不正な終端値を拒否するの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus active中の再入場・stale Capability・不正な終端値を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("active中の再入場・stale Capability・不正な終端値を拒否する", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const opened = createTemporaryOperation(root.capability, {
    operationId: `runtime-data-test-owner-${process.pid}`,
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "single active owner verification",
    allowedContent: ["fixture"],
    evidencePromotion: "not_required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  assert.equal(
    resumeWithNextIdentity(root.capability, opened.recoveryReference).reason,
    "temporary_operation_recovery_not_required",
  );
  assert.equal(
    settleTemporaryOperation(opened.capability, "other" as never, null).reason,
    "temporary_operation_outcome_invalid",
  );
  const lost = settleTemporaryOperation(opened.capability, "parent_lost", null);
  assert.equal(lost.status, "blocked");
  assert.ok(lost.recoveryReference);
  const resumed = resumeWithNextIdentity(
    root.capability,
    lost.recoveryReference,
  );
  assert.equal(resumed.status, "completed");
  if (resumed.status !== "completed") return;
  assert.equal(
    settleTemporaryOperation(opened.capability, "failed", null).reason,
    "temporary_operation_capability_invalid",
  );
  assert.equal(
    settleTemporaryOperation(resumed.capability, "failed", null).status,
    "completed",
  );
});

/**
 * 既存Operationとの衝突では既存内容を削除せず内部Pathも返さないを検証する。
 *
 * @responsibility 既存Operationとの衝突では既存内容を削除せず内部Pathも返さないの合否判定を所有する。
 * @trace RDL-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 既存Operationとの衝突では既存内容を削除せず内部Pathも返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-004=Direct Boundary: runtime-data Test Source→対象契約
 */
test("既存Operationとの衝突では既存内容を削除せず内部Pathも返さない", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  assert.equal(root.status, "completed");
  if (root.status !== "completed") return;
  const paths = resolveRepositoryRuntimeDataPaths(root.capability);
  assert.ok(paths);
  const operationId = `runtime-data-test-collision-${process.pid}`;
  const directory = path.join(paths.temporary, operationId);
  const sentinel = path.join(directory, "sentinel.txt");
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(sentinel, "preserve\n");
  try {
    const blocked = createTemporaryOperation(root.capability, {
      operationId,
      owner: "runtime-data-test",
      identity: randomUUID(),
      purpose: "collision verification",
      allowedContent: ["fixture"],
      evidencePromotion: "not_required",
    });
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.reason, "temporary_operation_creation_failed");
    assert.equal(blocked.cleanupConfirmed, true);
    assert.equal(blocked.recoveryRequired, false);
    assert.equal(blocked.recoveryReference, null);
    assert.equal(fs.readFileSync(sentinel, "utf8"), "preserve\n");
    assert.equal(JSON.stringify(blocked).includes(repositoryRoot), false);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});

/**
 * 正式Evidence試験用の孤立Repositoryをnamed tests領域に作る。
 *
 * @responsibility 本番CHG／Release成果物を変更せず根拠昇格の実Filesystem境界を準備する。
 * @trace RDL-IT-004
 * @precondition 現在RepositoryのRootを検証できる。
 * @stimulus tests内に最小Git fixtureを作りRoot Capabilityを取得する。
 * @observation exact RootとCapabilityを返す。
 * @oracle 正式Evidenceとtmpが同じ孤立Repository内に閉じる。
 * @cleanup exact fixture Rootを回収し終了後不存在を確認する。
 * @boundary RDL-IT-004=Direct Boundary: Test fixture→Root検証／Filesystem
 */
function createEvidencePromotionFixture(t: TestContext) {
  const current = verifyRepositoryRoot(repositoryRoot);
  if (current.status !== "completed") throw new Error("fixture_root_invalid");
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(current.capability, "tests"),
    "fixture_area_invalid",
  );
  const fixtureRoot = fs.mkdtempSync(
    path.join(area.directory, "evidence-promotion-"),
  );
  t.after(() => {
    assert.equal(path.dirname(fixtureRoot), area.directory);
    assert.equal(fs.realpathSync.native(fixtureRoot), fixtureRoot);
    fs.rmSync(fixtureRoot, { recursive: true });
    assert.equal(fs.existsSync(fixtureRoot), false);
  });
  fs.mkdirSync(path.join(fixtureRoot, ".git", "info"), { recursive: true });
  fs.writeFileSync(
    path.join(fixtureRoot, ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  fs.writeFileSync(
    path.join(fixtureRoot, ".git", "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  const root = verifyRepositoryRoot(fixtureRoot);
  if (root.status !== "completed") throw new Error("fixture_root_invalid");
  return { root, repositoryRoot: fixtureRoot };
}

/**
 * 正式Evidenceの有限Path文法と実体境界だけを昇格済みとして受理する。
 *
 * @responsibility testsコピー、旧領域、absolute、dot segment、alias、hardlinkと観測不能を拒否する。
 * @trace RDL-IT-004
 * @precondition tests内の孤立RepositoryにsourceとCHG／Release Evidenceを用意する。
 * @stimulus 正常と各不正Path／実体を根拠receipt APIへ渡す。
 * @observation receipt、source／target byte、tmp残存とcleanup結果を観測する。
 * @oracle 正式CHG／Releaseだけ受理、負例はreceiptなし・tmp保存・copyや移行Effect0。
 * @cleanup 孤立Root全体をexact Identity確認後に回収する。
 * @boundary RDL-IT-004=Direct Boundary: 根拠昇格API→正式Evidence実体
 */
test("根拠昇格は正式CHG／Releaseを確認しtestsとPath別名を拒否する", (t) => {
  const fixture = createEvidencePromotionFixture(t);
  const opened = createTemporaryOperation(fixture.root.capability, {
    operationId: "promotion-boundary",
    owner: "runtime-data-test",
    identity: randomUUID(),
    purpose: "formal evidence boundary",
    allowedContent: ["fixture"],
    evidencePromotion: "required",
  });
  assert.equal(opened.status, "completed");
  if (opened.status !== "completed") return;
  fs.writeFileSync(path.join(opened.workDirectory, "fixture"), "promoted\n");
  const sha256 =
    "832d7e61059cd7375f9bec232c07f3d8deeab5687279bd589e3b9bf4ad758055";
  const formalPaths = [
    "99_Roadmap/Changes/CHG-000001/Evidence/fixture",
    "99_Roadmap/Releases/v0.22.0/Evidence/nested/fixture",
  ] as const;
  for (const relativePath of formalPaths) {
    const target = path.join(
      fixture.repositoryRoot,
      ...relativePath.split("/"),
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "promoted\n");
    assert.equal(
      verifyTemporaryOperationEvidencePromotion(
        fixture.root.capability,
        opened.capability,
        { evidenceRelativePath: relativePath, artifactName: "fixture", sha256 },
      ).status,
      "completed",
    );
  }
  const target = path.join(
    fixture.repositoryRoot,
    ...formalPaths[0].split("/"),
  );
  const testCopy = path.join(
    fixture.repositoryRoot,
    ".crdd",
    "tests",
    "run",
    "fixture",
  );
  fs.mkdirSync(path.dirname(testCopy), { recursive: true });
  fs.copyFileSync(target, testCopy);
  for (const evidenceRelativePath of [
    ".crdd/tests/run/fixture",
    ".crdd/tmp/fixture",
    ".crdd/verification/run/artifacts/fixture",
    target,
    "99_Roadmap/Changes/CHG-000001/Evidence/../fixture",
    "99_Roadmap/Changes/CHG-000001/Evidence/./fixture",
    "99_Roadmap/Changes/CHG-1/Evidence/fixture",
    "99_Roadmap/Changes/CHG-000001/Evidence/a\\fixture",
  ]) {
    const result = verifyTemporaryOperationEvidencePromotion(
      fixture.root.capability,
      opened.capability,
      { evidenceRelativePath, artifactName: "fixture", sha256 },
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.receipt, null);
  }
  const link = path.join(path.dirname(target), "linked");
  fs.linkSync(target, link);
  assert.equal(
    verifyTemporaryOperationEvidencePromotion(
      fixture.root.capability,
      opened.capability,
      {
        evidenceRelativePath: formalPaths[0],
        artifactName: "fixture",
        sha256,
      },
    ).status,
    "blocked",
  );
  fs.unlinkSync(link);
  const alias = path.join(path.dirname(target), "alias");
  fs.symlinkSync(path.dirname(target), alias, "junction");
  assert.equal(
    verifyTemporaryOperationEvidencePromotion(
      fixture.root.capability,
      opened.capability,
      {
        evidenceRelativePath:
          "99_Roadmap/Changes/CHG-000001/Evidence/alias/fixture",
        artifactName: "fixture",
        sha256,
      },
    ).status,
    "blocked",
  );
  fs.unlinkSync(alias);
  const originalLstat = fs.lstatSync;
  const failedObservation = mock.method(
    fs,
    "lstatSync",
    (observedPath: fs.PathLike, options?: unknown) => {
      if (String(observedPath) === path.dirname(target))
        throw Object.assign(new Error("fixture observation denied"), {
          code: "EACCES",
        });
      return originalLstat(
        observedPath,
        options as fs.StatOptions & { bigint: true },
      );
    },
  );
  try {
    assert.equal(
      verifyTemporaryOperationEvidencePromotion(
        fixture.root.capability,
        opened.capability,
        {
          evidenceRelativePath: formalPaths[0],
          artifactName: "fixture",
          sha256,
        },
      ).status,
      "blocked",
    );
  } finally {
    failedObservation.mock.restore();
  }
  assert.equal(fs.readFileSync(testCopy, "utf8"), "promoted\n");
  assert.equal(fs.existsSync(path.dirname(opened.workDirectory)), true);
  const valid = verifyTemporaryOperationEvidencePromotion(
    fixture.root.capability,
    opened.capability,
    { evidenceRelativePath: formalPaths[0], artifactName: "fixture", sha256 },
  );
  assert.equal(valid.status, "completed");
  if (valid.status === "completed")
    assert.equal(
      settleTemporaryOperation(opened.capability, "completed", valid.receipt)
        .status,
      "completed",
    );
});

for (const shouldResumeOperation of [false, true]) {
  /**
   * 同じHashの正式Evidenceでも別Repositoryからの昇格を拒否する。
   *
   * @responsibility 作成・再入場のOperation Rootをreceiptとcleanupまで保持することを確認する。
   * @trace RDL-IT-004
   * @precondition tests内の孤立Root AのOperationとRoot Bの同内容正式Evidenceを用意する。
   * @stimulus Root B能力とRoot A Operation能力を交差させ、receiptなしcleanupを要求する。
   * @observation receipt、target読取り件数、Operation文書とsource bytes、残存を取得する。
   * @oracle receiptなし・target読取り0・source／Operation不変・削除不可。同Root receiptなら完了する。
   * @cleanup 両孤立Rootをexact Identity確認後に回収する。
   * @boundary RDL-IT-004=Direct Boundary: Root能力／Operation能力→正式Evidence receipt／cleanup
   */
  test(`別Rootの同Hash Evidenceは${shouldResumeOperation ? "再入場" : "作成"}Operationの削除根拠にならない`, (t) => {
    const sourceFixture = createEvidencePromotionFixture(t);
    const otherFixture = createEvidencePromotionFixture(t);
    const created = createTemporaryOperation(sourceFixture.root.capability, {
      operationId: "cross-root-promotion",
      owner: "runtime-data-test",
      identity: randomUUID(),
      purpose: "same repository evidence binding",
      allowedContent: ["fixture"],
      evidencePromotion: "required",
    });
    assert.equal(created.status, "completed");
    if (created.status !== "completed") return;
    let capability = created.capability;
    let workDirectory = created.workDirectory;
    if (shouldResumeOperation) {
      const lost = settleTemporaryOperation(capability, "parent_lost", null);
      assert.equal(lost.status, "blocked");
      assert.ok(lost.recoveryReference);
      const resumed = resumeTemporaryOperation(
        sourceFixture.root.capability,
        lost.recoveryReference,
        randomUUID(),
      );
      assert.equal(resumed.status, "completed");
      if (resumed.status !== "completed") return;
      capability = resumed.capability;
      workDirectory = resumed.workDirectory;
    }
    const source = path.join(workDirectory, "fixture");
    fs.writeFileSync(source, "promoted\n");
    const evidenceRelativePath =
      "99_Roadmap/Changes/CHG-000001/Evidence/fixture";
    const foreignTarget = path.join(
      otherFixture.repositoryRoot,
      ...evidenceRelativePath.split("/"),
    );
    fs.mkdirSync(path.dirname(foreignTarget), { recursive: true });
    fs.writeFileSync(foreignTarget, "promoted\n");
    const control = path.join(
      sourceFixture.repositoryRoot,
      ".crdd",
      "tmp",
      ".operations",
      "cross-root-promotion.json",
    );
    const controlBefore = fs.readFileSync(control);
    let foreignTargetReads = 0;
    const originalLstat = fs.lstatSync;
    const observer = mock.method(
      fs,
      "lstatSync",
      (target: fs.PathLike, options?: unknown) => {
        if (String(target) === foreignTarget) foreignTargetReads += 1;
        return originalLstat(
          target,
          options as fs.StatOptions & { bigint: true },
        );
      },
    );
    try {
      const rejected = verifyTemporaryOperationEvidencePromotion(
        otherFixture.root.capability,
        capability,
        {
          evidenceRelativePath,
          artifactName: "fixture",
          sha256:
            "832d7e61059cd7375f9bec232c07f3d8deeab5687279bd589e3b9bf4ad758055",
        },
      );
      assert.equal(rejected.status, "blocked");
      assert.equal(rejected.receipt, null);
      assert.equal(rejected.reason, "temporary_operation_root_invalid");
      assert.equal(foreignTargetReads, 0);
    } finally {
      observer.mock.restore();
    }
    assert.deepEqual(fs.readFileSync(control), controlBefore);
    assert.equal(fs.readFileSync(source, "utf8"), "promoted\n");
    assert.equal(
      settleTemporaryOperation(capability, "completed", null).reason,
      "temporary_operation_evidence_not_promoted",
    );
    assert.deepEqual(fs.readFileSync(control), controlBefore);
    assert.equal(fs.existsSync(path.dirname(workDirectory)), true);
    const ownTarget = path.join(
      sourceFixture.repositoryRoot,
      ...evidenceRelativePath.split("/"),
    );
    fs.mkdirSync(path.dirname(ownTarget), { recursive: true });
    fs.copyFileSync(source, ownTarget);
    const accepted = verifyTemporaryOperationEvidencePromotion(
      sourceFixture.root.capability,
      capability,
      {
        evidenceRelativePath,
        artifactName: "fixture",
        sha256:
          "832d7e61059cd7375f9bec232c07f3d8deeab5687279bd589e3b9bf4ad758055",
      },
    );
    assert.equal(accepted.status, "completed");
    if (accepted.status === "completed")
      assert.equal(
        settleTemporaryOperation(capability, "completed", accepted.receipt)
          .status,
        "completed",
      );
    assert.equal(fs.existsSync(path.dirname(workDirectory)), false);
    assert.equal(fs.readFileSync(foreignTarget, "utf8"), "promoted\n");
  });
}

/**
 * 公式素材の判断、競合および収載照合をDomain境界間で検証する。
 *
 * @packageDocumentation
 * @responsibility 完全な判断だけが一回成立し、収載先から判断根拠へ戻れ、不完全・競合入力がEffect 0となることを検証する。
 * @trace OAG-IT-005
 * @trace OAG-IT-006
 * @trace OAG-IT-007
 * @level IT
 * @scope official-asset-governance、decision、revision、inclusion、traceability
 * @boundary OAG-IT-005=Related 2 Blocks、OAG-IT-006／OAG-IT-007=Direct Boundary。
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import {
  applyOfficialAssetDecision,
  createFileOfficialAssetStore,
  executeOfficialAssetDecision,
  type OfficialAssetDecisionInput,
  type OfficialAssetRecord,
  verifyOfficialAssetInclusion,
} from "../../src/index.ts";
import {
  createFilesystemStoreRoot,
  observeFilesystemStoreLockOwnerAbsence,
  recoverFilesystemStoreLock,
} from "../../../crdd-domain-library/src/filesystem-store-root/index.ts";

/**
 * 統合試験用の候補素材を構築する。
 *
 * @responsibility 判断と収載照合が共有する素材Identity、版および初期Revisionを固定する。
 * @trace OAG-IT-005
 * @trace OAG-IT-006
 * @trace OAG-IT-007
 * @precondition N/A: 固定値だけを使用する。
 * @stimulus 候補素材Recordを作成する。
 * @observation candidate状態のRecordを返す。
 * @oracle 権利、用途および判断者は未確定のまま保持される。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary OAG-IT-005=Related 2 Blocks、OAG-IT-006／OAG-IT-007=Direct Boundary。
 */
function candidate(): OfficialAssetRecord {
  return Object.freeze({
    assetId: "asset-brand-a",
    assetRevision: "sha256:asset-a",
    sourceStatement: "submitted by the asset owner",
    rightsBasis: null,
    allowedPurposes: Object.freeze([]),
    decisionAuthorityId: null,
    decidedAt: null,
    targetRelease: null,
    state: "candidate",
    recordRevision: 1,
  });
}

/**
 * 統合試験用の判断入力を構築する。
 *
 * @responsibility 素材版、期待Revision、権利根拠、用途、判断者および対象Releaseを同じ入力へ固定する。
 * @trace OAG-IT-006
 * @trace OAG-IT-007
 * @precondition overridesは固定契約内のfieldだけを置換する。
 * @stimulus 完全な採用判断へ指定差分を適用する。
 * @observation 不変の判断入力を返す。
 * @oracle 置換しないfieldは完全な採用条件を満たす。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary OAG-IT-006／OAG-IT-007=Direct Boundary。
 */
function decision(
  overrides: Partial<OfficialAssetDecisionInput> = {},
): OfficialAssetDecisionInput {
  return Object.freeze({
    assetId: "asset-brand-a",
    assetRevision: "sha256:asset-a",
    expectedRecordRevision: 1,
    decision: "approve",
    rightsBasis: "owner grant for documentation",
    allowedPurposes: Object.freeze(["documentation"]),
    decisionAuthorityId: "asset-owner-a",
    decidedAt: "2026-09-22T12:00:00.000Z",
    targetRelease: "v0.21.0",
    ...overrides,
  });
}

/**
 * 完全な判断の収載先から根拠へ戻れることを検証する。
 *
 * @responsibility 収載照合境界を同じ素材Identity、版、Record Revisionおよび用途で接続する。
 * @trace OAG-IT-005
 * @precondition 候補素材と完全な採用判断を用意する。
 * @stimulus 判断を適用し、その結果へ一致する収載Relationを照合する。
 * @observation 更新状態、Revision、用途、判断者および照合結果を観測する。
 * @oracle approved Revision 2となり、同じ用途・版・Releaseの収載だけがverifiedとなる。
 * @cleanup N/A: 外部公開、再配布およびFilesystem Effectを発行しない。
 * @boundary OAG-IT-005=Related 2 Blocks: Asset Record→Inclusion Relation→Official Repository。
 */
test("完全な判断の収載先から根拠へ戻れる", () => {
  const applied = applyOfficialAssetDecision(candidate(), decision());
  assert.equal(applied.status, "completed");
  if (applied.status !== "completed") return;
  assert.equal(applied.record.state, "approved");
  assert.equal(applied.record.recordRevision, 2);
  assert.equal(applied.record.decisionAuthorityId, "asset-owner-a");

  const inclusion = verifyOfficialAssetInclusion(applied.record, {
    inclusionId: "official-logo-a",
    assetId: "asset-brand-a",
    assetRevision: "sha256:asset-a",
    decisionRecordRevision: 2,
    allowedPurpose: "documentation",
    targetRelease: "v0.21.0",
  });
  assert.deepEqual(inclusion, {
    status: "verified",
    reason: "official_asset_inclusion_verified",
  });
});

/**
 * 完全な判断だけが素材状態へ一回適用されることを検証する。
 *
 * @responsibility 判断主体、用途、対象Revisionおよび権利根拠が揃う場合だけ公式素材Store更新を許可する。
 * @trace OAG-IT-007
 * @precondition 候補素材と完全な採用判断を用意する。
 * @stimulus 判断Recordを公式素材Domain境界へ適用する。
 * @observation 更新状態、Record Revision、判断者およびStore Effect許可を観測する。
 * @oracle approved Revision 2となり、一回のStore Effectだけが許可される。
 * @cleanup N/A: Domain結果だけを観測しFilesystem Effectを発行しない。
 * @boundary OAG-IT-007=Direct Boundary: Decision Record→Official Asset Store。
 */
test("完全な判断だけが素材状態へ一回適用される", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-asset-store-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storeRoot = createFilesystemStoreRoot(root);
  assert.ok(storeRoot);
  const store = createFileOfficialAssetStore(
    storeRoot,
    "asset.json",
    candidate(),
  );
  const applied = executeOfficialAssetDecision(
    store,
    { verify: (input) => input.decisionAuthorityId === "asset-owner-a" },
    decision(),
  );
  assert.equal(applied.status, "completed");
  if (applied.status !== "completed") return;
  assert.equal(applied.record.state, "approved");
  assert.equal(applied.record.recordRevision, 2);
  assert.equal(applied.record.decisionAuthorityId, "asset-owner-a");
  assert.equal(applied.storeEffectIssued, true);
  assert.equal(store.read().recordRevision, 2);
});

/**
 * Store更新後のLock解放不明をEffect 0へ畳まない。
 *
 * @responsibility 公開済みRevision、exact Recovery Identityおよびcleanup不明を同じ結果へ相関する。
 * @trace OAG-IT-007
 * @precondition 候補素材Storeを用意し、一回だけKernel Lock Workerのrelease messageを抑止する。
 * @stimulus 完全な判断を反映し、同じIdentityでcleanupへ再入場して同じ判断を再送する。
 * @observation 公開Revision、Effect状態、Recovery Identity、cleanup結果および再送Effectを観測する。
 * @oracle 初回はEffect済み・cleanup必要、cleanup後の再送はRevision競合かつ追加Effect 0となる。
 * @cleanup Worker prototypeを復元し、一時Directoryを削除する。
 * @boundary Decision Application→Filesystem Store Effect→Kernel cleanup再入場。
 */
test("Store Effect後のcleanup不明をexact ID付きで返す", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-asset-cleanup-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storeRoot = createFilesystemStoreRoot(root);
  assert.ok(storeRoot);
  const store = createFileOfficialAssetStore(
    storeRoot,
    "asset.json",
    candidate(),
  );
  const originalPostMessage = Worker.prototype.postMessage;
  Worker.prototype.postMessage = function suppressRelease(
    this: Worker,
    value: unknown,
  ): void {
    if (value !== "release") originalPostMessage.call(this, value);
  } as Worker["postMessage"];
  let applied: ReturnType<typeof executeOfficialAssetDecision>;
  try {
    applied = executeOfficialAssetDecision(
      store,
      { verify: () => true },
      decision(),
    );
  } finally {
    Worker.prototype.postMessage = originalPostMessage;
  }
  assert.equal(applied.status, "effect_issued_cleanup_required");
  if (applied.status !== "effect_issued_cleanup_required") return;
  assert.equal(applied.storeEffectIssued, true);
  assert.equal(applied.record.recordRevision, 2);
  assert.equal(store.read().recordRevision, 2);
  const deadline = Date.now() + 5_000;
  let observation: ReturnType<typeof observeFilesystemStoreLockOwnerAbsence>;
  while (true) {
    observation = observeFilesystemStoreLockOwnerAbsence(
      storeRoot,
      "asset.json.lock",
      applied.recoveryId,
    );
    if (observation.status === "confirmed") break;
    if (Date.now() >= deadline)
      throw new Error(
        "official asset cleanup obligation did not become observable",
      );
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(observation.status, "confirmed");
  if (observation.status !== "confirmed") return;
  assert.deepEqual(
    recoverFilesystemStoreLock(storeRoot, "asset.json.lock", observation.proof),
    { status: "completed", reason: "filesystem_store_lock_recovered" },
  );
  assert.deepEqual(
    executeOfficialAssetDecision(store, { verify: () => true }, decision()),
    {
      status: "blocked",
      reason: "official_asset_decision_revision_conflict",
      currentRecordRevision: 2,
      storeEffectIssued: false,
    },
  );
});

/**
 * Effect 0確定後のcleanup不明をfalseとexact IDで搬送する。
 * @responsibility Revision競合等でStore Effectが未発行と確定した結果をunknownや成功へ畳まないことを確認する。
 * @trace OAG-IT-007
 * @precondition cleanup_requiredかつeffectState not_issuedを返す固定Storeを用意する。
 * @stimulus 完全な判断をApplication境界へ渡す。
 * @observation 公開status、理由、Effect状態およびRecovery Identityを観測する。
 * @oracle blocked、storeEffectIssued falseおよび同じexact IDが返る。
 * @cleanup N/A: 固定Storeは外部Effectを持たない。
 * @boundary Store cleanup result→Official Asset公開結果。
 */
test("Store Effect 0後のcleanup不明をexact ID付きで返す", () => {
  const recoveryId = "filesystem-store-lock.asset-not-issued";
  const store = Object.freeze({
    read: () => candidate(),
    compareAndSet: () =>
      Object.freeze({
        status: "cleanup_required" as const,
        recoveryId,
        effectState: "not_issued" as const,
      }),
  });
  assert.deepEqual(
    executeOfficialAssetDecision(store, { verify: () => true }, decision()),
    {
      status: "blocked",
      reason: "official_asset_store_recovery_required",
      currentRecordRevision: 1,
      storeEffectIssued: false,
      recoveryId,
    },
  );
});

/**
 * Store Effect不明後のcleanup不明をnullとexact IDで搬送する。
 * @responsibility Operation失敗でEffect有無を確定できない結果をEffect 0へ畳まないことを確認する。
 * @trace OAG-IT-007
 * @precondition cleanup_requiredかつeffectState unknownを返す固定Storeを用意する。
 * @stimulus 完全な判断をApplication境界へ渡す。
 * @observation 公開status、理由、Effect状態およびRecovery Identityを観測する。
 * @oracle blocked、storeEffectIssued nullおよび同じexact IDが返る。
 * @cleanup N/A: 固定Storeは外部Effectを持たない。
 * @boundary Store cleanup result→Official Asset公開結果。
 */
test("Store Effect不明後のcleanup不明をexact ID付きで返す", () => {
  const recoveryId = "filesystem-store-lock.asset-unknown";
  const store = Object.freeze({
    read: () => candidate(),
    compareAndSet: () =>
      Object.freeze({
        status: "cleanup_required" as const,
        recoveryId,
        effectState: "unknown" as const,
      }),
  });
  assert.deepEqual(
    executeOfficialAssetDecision(store, { verify: () => true }, decision()),
    {
      status: "blocked",
      reason: "official_asset_store_effect_unknown_cleanup_required",
      currentRecordRevision: 1,
      storeEffectIssued: null,
      recoveryId,
    },
  );
});

/**
 * 不完全な判断を収載Effect前で拒否することを検証する。
 *
 * @responsibility 判断者、用途、根拠または対象版が不足する入力から公式収載可能状態を作らない。
 * @trace OAG-IT-007
 * @precondition 有効な候補素材を用意する。
 * @stimulus 空の権利根拠および用途を持つ採用判断を適用する。
 * @observation 理由code、現行RevisionおよびStore Effect許可を観測する。
 * @oracle input_invalid、Revision 1、Store Effect 0となる。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary OAG-IT-007=Direct Boundary: Decision Record→Official Asset Store。
 */
test("不完全な判断を収載Effect前で拒否する", () => {
  const result = applyOfficialAssetDecision(
    candidate(),
    decision({ rightsBasis: "", allowedPurposes: Object.freeze([]) }),
  );
  assert.deepEqual(result, {
    status: "blocked",
    reason: "official_asset_decision_input_invalid",
    currentRecordRevision: 1,
    storeEffectIssued: false,
  });
});

/**
 * 競合する同一Revision判断の後着側を上書きせず拒否することを検証する。
 *
 * @responsibility 共有最終状態、勝者Revision、敗者理由および要求別Effectを相関する。
 * @trace OAG-IT-006
 * @precondition 同じ候補Revisionを観測した採用判断と制限判断を用意する。
 * @stimulus 採用判断の更新結果へ古いRevisionの制限判断を適用する。
 * @observation 勝者状態、勝者Revision、敗者理由およびStore Effectを観測する。
 * @oracle 勝者approved Revision 2を保持し、敗者はrevision_conflictかつEffect 0となる。
 * @cleanup N/A: 純粋値だけを使用する。
 * @boundary OAG-IT-006=Direct Boundary: Concurrent Decision→Official Asset Store。
 */
test("競合する同一Revision判断は一方だけを確定する", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-asset-conflict-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storeRoot = createFilesystemStoreRoot(root);
  assert.ok(storeRoot);
  const storeFile = path.join(root, "asset.json");
  const store = createFileOfficialAssetStore(
    storeRoot,
    "asset.json",
    candidate(),
  );
  const worker = path.resolve("tests/fixtures/asset-decision-worker.ts");
  const startFile = path.join(root, "start");
  const readyFiles = [
    path.join(root, "ready-1"),
    path.join(root, "ready-2"),
  ] as const;
  const resultFiles = [
    path.join(root, "result-1"),
    path.join(root, "result-2"),
  ] as const;
  const operations = [
    { input: decision(), readyFile: readyFiles[0], resultFile: resultFiles[0] },
    {
      input: decision({
        decision: "restrict",
        allowedPurposes: Object.freeze(["internal-review"]),
      }),
      readyFile: readyFiles[1],
      resultFile: resultFiles[1],
    },
  ];
  const childProcesses = operations.map(({ input, readyFile, resultFile }) => {
    const child = spawn(
      process.execPath,
      [
        worker,
        root,
        storeFile,
        readyFile,
        startFile,
        resultFile,
        JSON.stringify(input),
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let standardError = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      standardError += chunk;
    });
    return { child, standardError: () => standardError };
  });
  while (!readyFiles.every((file) => fs.existsSync(file)))
    await new Promise((resolve) => setTimeout(resolve, 5));
  fs.writeFileSync(startFile, "start\n", { flag: "wx" });
  await Promise.all(
    childProcesses.map(
      ({ child, standardError }) =>
        new Promise<void>((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", (code) =>
            code === 0
              ? resolve()
              : reject(
                  new Error(
                    `asset worker exited ${String(code)}: ${standardError().trim()}`,
                  ),
                ),
          );
        }),
    ),
  );
  const results = resultFiles.map((file) =>
    JSON.parse(fs.readFileSync(file, "utf8")),
  );
  assert.equal(
    results.filter((result) => result.status === "completed").length,
    1,
  );
  assert.equal(
    results.filter(
      (result) =>
        result.status === "blocked" && result.storeEffectIssued === false,
    ).length,
    1,
  );
  assert.equal(store.read().recordRevision, 2);
});

/**
 * 残存LockをRevision競合へ畳まず回復義務として返す。
 *
 * @responsibility Store Lockのexact Recovery IdentityをApplication結果まで保持する。
 * @trace OAG-IT-007
 * @precondition 候補素材Storeと、Ownerが稼働中のLock Recordを用意する。
 * @stimulus 完全な判断を耐久Storeへ反映する。
 * @observation 理由、Recovery Identity、現行RevisionおよびStore Effectを観測する。
 * @oracle recovery_required、exact Recovery Identity、Revision 1、Effect 0となる。
 * @cleanup 一時Directoryを削除する。
 * @boundary Decision Application→Filesystem Store Lock→公開結果。
 */
test("残存Lockの回復義務をRevision競合へ畳まない", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-asset-recovery-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storeRoot = createFilesystemStoreRoot(root);
  assert.ok(storeRoot);
  const store = createFileOfficialAssetStore(
    storeRoot,
    "asset.json",
    candidate(),
  );
  const recoveryId = "filesystem-store-lock.asset-fixed";
  fs.writeFileSync(
    path.join(root, "asset.json.lock"),
    `${JSON.stringify({ recoveryId, ownerPid: process.pid })}\n`,
    { encoding: "utf8", flag: "wx", mode: 0o600 },
  );
  assert.deepEqual(
    executeOfficialAssetDecision(store, { verify: () => true }, decision()),
    {
      status: "blocked",
      reason: "official_asset_store_recovery_required",
      currentRecordRevision: 1,
      storeEffectIssued: false,
      recoveryId,
    },
  );
});

/**
 * 不完全LockをRecovery Identity付き結果へ昇格しない。
 *
 * @responsibility Store Lock観測不能をexact回復義務およびRevision競合から分離する。
 * @trace OAG-IT-007
 * @precondition 候補素材Storeと空のLock Recordを用意する。
 * @stimulus 完全な判断を耐久Storeへ反映する。
 * @observation 公開理由、現行Revision、EffectおよびRecovery Identity不存在を観測する。
 * @oracle observation_unknown、Revision 1、Effect 0となりRecovery Identityを発行しない。
 * @cleanup 一時Directoryを削除する。
 * @boundary Decision Application→不完全Filesystem Lock→公開結果。
 */
test("不完全LockをRecovery Identity付き結果へ昇格しない", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-asset-unknown-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const storeRoot = createFilesystemStoreRoot(root);
  assert.ok(storeRoot);
  const store = createFileOfficialAssetStore(
    storeRoot,
    "asset.json",
    candidate(),
  );
  fs.writeFileSync(path.join(root, "asset.json.lock"), "", {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  assert.deepEqual(
    executeOfficialAssetDecision(store, { verify: () => true }, decision()),
    {
      status: "blocked",
      reason: "official_asset_store_observation_unknown",
      currentRecordRevision: 1,
      storeEffectIssued: false,
    },
  );
});

/**
 * 判断Relationが異なる素材版、用途またはRevisionを収載済みと扱わないことを検証する。
 *
 * @responsibility 素材Recordと公式収載先の欠落・不一致を一意な拒否へ閉じる。
 * @trace OAG-IT-005
 * @precondition 完全な採用判断を適用済みである。
 * @stimulus 別用途の収載Relationを照合する。
 * @observation 照合状態と理由codeを観測する。
 * @oracle mismatchとなり、外部公開・再配布Effectは発行されない。
 * @cleanup N/A: 読取り済み値だけを比較する。
 * @boundary OAG-IT-005=Related 2 Blocks: Asset Record→Inclusion Relation→Official Repository。
 */
test("判断Relationが異なる用途を収載済みと扱わない", () => {
  const applied = applyOfficialAssetDecision(candidate(), decision());
  assert.equal(applied.status, "completed");
  if (applied.status !== "completed") return;

  assert.deepEqual(
    verifyOfficialAssetInclusion(applied.record, {
      inclusionId: "official-logo-a",
      assetId: "asset-brand-a",
      assetRevision: "sha256:asset-a",
      decisionRecordRevision: 2,
      allowedPurpose: "advertising",
      targetRelease: "v0.21.0",
    }),
    {
      status: "blocked",
      reason: "official_asset_inclusion_mismatch",
    },
  );
});

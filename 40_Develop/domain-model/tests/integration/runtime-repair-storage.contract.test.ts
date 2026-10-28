/**
 * 修復履歴の保存・出版・種別相関をDomain保存Ownerで反証する。
 * @packageDocumentation
 * @responsibility 専用Owner、fresh読取り、五有限形、故障窓と非対象保全を所有する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 合成技術値と自己生成Repositoryの実保存。実修復Sessionは使用しない。
 * @boundary Domain保存と実Filesystem／Kernel。Host／Docker処置はCoordinator試験の責務。
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import * as model from "../../src/index.ts";
import * as domain from "../../src/index.ts";
import * as stateStore from "../../src/index.ts";
import { encodeRuntimeStateValue } from "../../src/index.ts";
import * as kernel from "../../src/storage/runtime-kernel-lock.ts";
import { observeRuntimeStorageRepository } from "../../src/storage/runtime-repository.ts";
import { createRuntimeStorageSourceFixture } from "../support/runtime-storage-source.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
/**
 * 同値進捗の保存入口を実Readerの戻り値契約から独立に反証する。
 * @responsibility Readerの部分成立を保存済み同値へ補完しない。
 * @trace ERB-IT-014
 * @precondition 実modelの正規回収判断と、Reader境界だけを差し替えた本番Writer本文。
 * @stimulus 値欠測、Hash／本文差、解放不明、Kernel内Owner失効。
 * @observation Reader・物理Writer・Contextの到達と公開確認flag。
 * @oracle 完全同値だけcompletedで、Reader後の失敗も変更要求0。
 * @cleanup N/A: メモリVMだけ。
 * @boundary Readerの実観測は別のHost Caseが所有する。
 */
test("修復回収no-op: Reader部分成立とOwner失効を成功へ補完しない", () => {
  const binding = "a".repeat(64);
  const identity = {
    schema: "crdd-coordinator/runtime-repair-identity/v1",
    kind: "runtime_repair",
    operationNonce: "e".repeat(64),
    operationId: "OP-123456",
    repositoryBinding: binding,
    ownerBindingSha256: "b".repeat(64),
    scopeSha256: "c".repeat(64),
    consumer: "coordinator_cli",
  };
  const started = model.prepareCoordinatorStateRepairSnapshot(
    null,
    `${JSON.stringify(identity)}\n`,
    binding,
  );
  assert.ok(started);
  const raw = JSON.parse(started.toString());
  const actionNames = [
    "stop_runtime",
    "terminate_runtime",
    "stop_backend",
    "retain_runtime",
    "start_runtime",
    "stop_failed_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
    "restart_runtime",
  ];
  const directoryNames = ["primary", "failed", "auxiliary"];
  const technical = {
    actions: Object.fromEntries(
      actionNames.map((name) => [
        name,
        { intent: "saved", request: "issued", result: "confirmed" },
      ]),
    ),
    directories: Object.fromEntries(
      directoryNames.map((name, index) => {
        const exact = { dev: "1", ino: String(index + 2), birthtimeNs: "3" };
        return [
          name,
          {
            expected: exact,
            source: { state: "absent", identity: null },
            retained: { state: "present", identity: exact },
          },
        ];
      }),
    ),
    engine: "ready",
    stale: "retained",
    hostSafety: "safe",
    cleanup: "confirmed",
    cleanupFailure: null,
  };
  raw.operations[0] = {
    ...raw.operations[0],
    phase: "awaiting_disposition",
    disposition: "pending_human_decision",
    checkpoint: technical,
    outcome: {
      status: "recovered",
      reason: "runtime_repair_recovered",
      cleanupConfirmed: true,
    },
  };
  const waiting = Buffer.from(`${encodeRuntimeStateValue(raw)}\n`);
  assert.ok(model.decodeRuntimeDomainSnapshot(waiting, binding));
  const id = raw.operations[0].recoveryId as string;
  const bytes = model.prepareCoordinatorStateRepairDisposalDecisionSnapshot(
    waiting,
    id,
    "2026-10-17T00:00:00.000Z",
    binding,
  );
  assert.ok(bytes);
  const decoded = model.decodeRuntimeDomainSnapshot(bytes, binding);
  assert.ok(decoded);
  for (const mode of [
    "normal",
    "blocked",
    "missing",
    "release",
    "hash",
    "bytes",
    "owner_lost",
    "owner_throw",
    "owner_promise",
  ] as const) {
    let reads = 0,
      writes = 0,
      contexts = 0;
    const worker = stateStoreSource(
      (source) => {
        const reader = source.indexOf("function readCoordinatorStateSnapshot(");
        const readerEnd = source.indexOf("\n/**", reader);
        assert.ok(reader > 0 && readerEnd > reader);
        let changed =
          source.slice(0, reader) +
          "function readCoordinatorStateSnapshot(repository) { return readProbe(repository); }\n" +
          source.slice(readerEnd);
        const writer = changed.indexOf(
          "function writeCoordinatorStateSnapshot(",
        );
        const writerEnd = changed.indexOf("\n/**", writer);
        assert.ok(writer > 0 && writerEnd > writer);
        changed =
          changed.slice(0, writer) +
          "function writeCoordinatorStateSnapshot() { return writeProbe(); }\n" +
          changed.slice(writerEnd);
        return changed.replaceAll(
          "settlements.set(context, {",
          "contextProbe(); settlements.set(context, {",
        );
      },
      {
        borrowRuntimeOwnedCoordinatorRecoveryRepository: () => ({
          repositoryRoot: "unused",
          repositoryBinding: binding,
          revalidate: () => true,
        }),
        contextProbe: () => contexts++,
        writeProbe: () => {
          writes++;
          return {
            status: "blocked",
            snapshotConfirmed: false,
            filesystemEffectIssued: false,
            lockReleased: true,
          };
        },
        readProbe: (repository: { revalidate: () => boolean }) => {
          reads++;
          if (
            mode === "owner_lost" ||
            mode === "owner_throw" ||
            mode === "owner_promise"
          )
            assert.equal(repository.revalidate(), false);
          return {
            status: mode === "blocked" ? "blocked" : "completed",
            lockReleased: mode !== "release",
            value:
              mode === "missing"
                ? null
                : {
                    ...decoded,
                    payloadSha256:
                      mode === "hash" ? "0".repeat(64) : decoded.payloadSha256,
                    snapshot:
                      mode === "bytes"
                        ? {
                            ...decoded.snapshot,
                            revision: decoded.snapshot.revision + 1,
                          }
                        : decoded.snapshot,
                  },
          };
        },
      },
    );
    const saved = worker.write(
      {},
      id,
      bytes,
      bytes,
      () => {
        if (reads > 0 && mode === "owner_throw") throw new Error("owner_lost");
        if (reads > 0 && mode === "owner_promise") return Promise.resolve(true);
        return !(reads > 0 && mode === "owner_lost");
      },
      "disposal_primary",
    );
    assert.equal(saved.snapshotConfirmed, mode === "normal", mode);
    assert.equal(
      saved.status,
      mode === "normal" ? "completed" : "blocked",
      mode,
    );
    assert.equal(saved.filesystemEffectIssued, false);
    assert.equal(saved.lockReleased, mode !== "release");
    assert.equal(reads, 1);
    assert.equal(writes, 0);
    assert.equal(contexts, 0);
  }
});
/**
 * 私有Writerの反例を同一Domain閉包で構成する。
 * @responsibility 別Writer実装を作らず本番Sourceと固定依存だけを使用する。
 * @trace ERB-IT-014
 * @precondition 同Packageの自己生成試験だけ。
 * @stimulus 指定条件の変異とI/O故障だけを注入する。
 * @observation 同じ保存入口の結果。
 * @oracle productionの判定本文を維持する。
 * @cleanup caseが今回Rootとhookを終了する。
 * @boundary 試験内。製品公開APIではない。
 */
function stateStoreSource(
  transform: (source: string) => string,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const store = createRuntimeStorageSourceFixture(transform, overrides);
  return {
    resume: store.resumeRuntimeOwnedCoordinatorRepairPublication,
    write: store.writeRuntimeOwnedCoordinatorRepairSnapshot,
    readHistory: store.readRuntimeOwnedCoordinatorRepairHistorySnapshot,
    advanceHistory: store.advanceRuntimeOwnedCoordinatorRepairHistory,
    readCompletion: store.readRuntimeOwnedCoordinatorRepairCompletionSnapshot,
    complete: store.completeRuntimeOwnedCoordinatorRepair,
  };
}
const executionSelection = (_role?: unknown, _input?: unknown) => ({
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
});
/**
 * 終了済み修復の有限値だけを使い履歴保存の全相関を確認する。
 * @responsibility 技術処置を呼ばず、履歴出版とTask fallback不使用を反証する。
 * @trace ERB-IT-014
 * @precondition codec合法な合成checkpoint・結果を実Storeへ置く。
 * @stimulus 元版・実体・所有者・設定の差、各出版故障と種別変異。
 * @observation 実state/history、Hash、改訂、排他解放と対象外全文。
 * @oracle unknownや種別差をTask側の成功へ補完しない。
 * @cleanup 今回Rootだけを既存exact helperで清掃する。
 * @boundary 保存試験。合成checkpointを実修復完了の証明にしない。
 */
test("Host Windows: 修復履歴は専用Ownerで固定しfresh出版する", {
  skip: process.platform !== "win32",
}, async (t) => {
  const directoryOwner = createRepositoryTestDirectory(
    "runtime-repair-storage-",
  );
  const root = directoryOwner.path;
  t.after(() => directoryOwner.cleanup());
  execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      root,
      "-c",
      "user.name=CRDD Test",
      "-c",
      "user.email=test@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--allow-empty",
      "--quiet",
      "-m",
      "synthetic",
    ],
    { windowsHide: true },
  );
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw Error("fixture_root_invalid");
  const f = { root, capability: verified.capability };
  const borrowed = observeRuntimeStorageRepository(f.capability);
  assert.ok(borrowed);
  const identityJson =
    JSON.stringify({
      schema: "crdd-coordinator/runtime-repair-identity/v1",
      kind: "runtime_repair",
      operationNonce: "a".repeat(64),
      operationId: "OP-123456",
      repositoryBinding: borrowed.repositoryBinding,
      ownerBindingSha256: "b".repeat(64),
      scopeSha256: "c".repeat(64),
      consumer: "coordinator_cli",
    }) + "\n";
  const initial = model.prepareCoordinatorStateRepairSnapshot(
    null,
    identityJson,
    borrowed.repositoryBinding,
  );
  assert.ok(initial);
  const initialState = model.decodeRuntimeDomainSnapshot(
    initial,
    borrowed.repositoryBinding,
  );
  assert.ok(initialState);
  const initialOperation = initialState.snapshot.operations[0];
  assert.ok(initialOperation?.kind === "runtime_repair");
  const technicalCheckpoint = {
    actions: Object.fromEntries(
      model.RUNTIME_REPAIR_ACTIONS.map((action) => [
        action,
        { intent: "not_saved", request: "not_issued", result: "not_required" },
      ]),
    ),
    directories: Object.fromEntries(
      model.RUNTIME_REPAIR_DIRECTORIES.map((purpose) => [
        purpose,
        {
          expected: null,
          source: { state: "absent", identity: null },
          retained: { state: "absent", identity: null },
        },
      ]),
    ),
    engine: "ready",
    stale: "absent",
    hostSafety: "safe",
    cleanup: "confirmed",
    cleanupFailure: null,
  };
  assert.ok(model.decodeDockerRuntimeRepairCheckpoint(technicalCheckpoint));
  const lastPreOutcomeCheckpoint = Buffer.from(
    encodeRuntimeStateValue({
      ...initialState.snapshot,
      operations: [{ ...initialOperation, checkpoint: technicalCheckpoint }],
    }) + "\n",
  );
  assert.ok(
    model.decodeRuntimeDomainSnapshot(
      lastPreOutcomeCheckpoint,
      borrowed.repositoryBinding,
    ),
  );
  const original = Buffer.from(
    encodeRuntimeStateValue({
      ...initialState.snapshot,
      operations: [
        {
          ...initialOperation,
          phase: "settling",
          checkpoint: technicalCheckpoint,
          outcome: {
            status: "recovered",
            reason: "runtime_repair_recovered",
            cleanupConfirmed: true,
          },
        },
      ],
    }) + "\n",
  );
  assert.ok(
    model.decodeRuntimeDomainSnapshot(original, borrowed.repositoryBinding),
  );
  const stateArea = domain.requireReadyRepositoryRuntimeDataArea(
    domain.ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      root,
      "domain-model",
    ),
    "repair_storage_fixture",
  );
  const stateFile = path.join(stateArea.directory, "state.json");
  fs.writeFileSync(stateFile, original, { flag: "wx" });
  const id = initialOperation.recoveryId;
  const decoded = model.decodeRuntimeDomainSnapshot(
    original,
    borrowed.repositoryBinding,
  );
  const operation = decoded?.snapshot.operations.find(
    (item) => item.recoveryId === id,
  );
  assert.ok(operation?.kind === "runtime_repair");
  const repository = {
    ...borrowed,
    operationId: JSON.parse(operation.identityJson).operationId as string,
  };
  for (const mode of ["identity", "session_begin"] as const) {
    await t.test(`出版用途の変異をDomain保存で検出する ${mode}`, () => {
      const binding = borrowed.repositoryBinding;
      let before = lastPreOutcomeCheckpoint;
      let candidate: Buffer | null;
      let targetId = id;
      if (mode === "identity") {
        const other = {
          ...initialOperation,
          phase: "awaiting_delivery",
          checkpoint: null,
          primaryFailure: null,
          outcome: {
            status: "blocked",
            reason: "runtime_repair_failed_closed",
            cleanupConfirmed: true,
          },
        };
        before = Buffer.from(
          `${encodeRuntimeStateValue({ ...initialState.snapshot, operations: [other] })}\n`,
        );
        candidate = model.prepareCoordinatorStateRepairSnapshot(
          before,
          JSON.stringify({
            ...JSON.parse(initialOperation.identityJson),
            operationNonce: "f".repeat(64),
            operationId: "OP-999999",
          }) + "\n",
          binding,
        );
        assert.ok(candidate);
        const added = model
          .decodeRuntimeDomainSnapshot(candidate, binding)
          ?.snapshot.operations.find((item) => item.recoveryId !== id);
        assert.ok(added);
        targetId = added.recoveryId;
      } else {
        candidate = model.prepareCoordinatorStateRepairSessionSnapshot(
          before,
          id,
          binding,
        );
        assert.ok(candidate);
      }
      assert.ok(model.decodeRuntimeDomainSnapshot(before, binding));
      fs.writeFileSync(stateFile, before);
      const pending = path.join(path.dirname(stateFile), "state.pending.json"),
        marker = path.join(path.dirname(stateFile), "state.lock");
      fs.writeFileSync(pending, candidate, { flag: "wx" });
      fs.writeFileSync(
        marker,
        JSON.stringify({
          schema: "crdd-coordinator/state-lock/v1",
          repositoryBinding: binding,
        }) + "\n",
        { flag: "wx" },
      );
      const mutant = stateStoreSource((source) => {
        const token =
          mode === "session_begin"
            ? ": publication.mode,"
            : "!repairPublication?.candidate.equals(bytes)";
        assert.equal(source.split(token).length - 1, 1);
        return source.replace(
          token,
          mode === "session_begin"
            ? ': "checkpoint",'
            : '(repairPublication?.mode === "identity" || !repairPublication?.candidate.equals(bytes))',
        );
      }).resume;
      /**
       * 同じ物理出版Oracleを正常本文と変異本文へ適用する。
       * @responsibility 正例がmode固有の配線へ到達することを確認する。
       * @trace ERB-IT-014
       * @precondition exact pendingと現在Root。
       * @stimulus 実Sourceの出版入口。
       * @observation 保存・読戻し・解放と全byte列。
       * @oracle 完成共同条件と短命物不存在。
       * @cleanup 正常出版後の材料は残さない。
       * @boundary VM private Context→実物理Writer。
       */
      const publish = (
        resume: typeof stateStore.resumeRuntimeOwnedCoordinatorRepairPublication,
      ) => {
        const result = resume(f.capability, targetId, () => true);
        assert.equal(
          result.status,
          "completed",
          `publication_mode_must_complete:${"reason" in result ? result.reason : "no_pending"}`,
        );
        assert.equal(result.snapshotConfirmed, true);
        assert.equal(result.lockReleased, true);
        assert.ok(fs.readFileSync(stateFile).equals(candidate));
        assert.throws(() => fs.lstatSync(pending), { code: "ENOENT" });
        assert.throws(() => fs.lstatSync(marker), { code: "ENOENT" });
      };
      assert.throws(() => publish(mutant), /publication_mode_must_complete/u);
      assert.ok(fs.readFileSync(stateFile).equals(before));
      assert.ok(fs.readFileSync(pending).equals(candidate));
      publish(stateStoreSource((source) => source).resume);
    });
    fs.writeFileSync(stateFile, original);
  }
  await t.test(
    "回収進捗の用途固定と同bytes無書込みを保存Owner内で反証する",
    () => {
      const directory = path.dirname(stateFile);
      const marker = path.join(directory, "state.lock");
      const pending = path.join(directory, "state.pending.json");
      const retainedIdentity = { dev: "1", ino: "1", birthtimeNs: "3" };
      const original = Buffer.from(
        `${encodeRuntimeStateValue({ ...initialState.snapshot, operations: [{ ...initialOperation, phase: "awaiting_disposition", disposition: "pending_human_decision", checkpoint: { ...technicalCheckpoint, stale: "retained", actions: { ...technicalCheckpoint.actions, retain_runtime: { intent: "saved", request: "issued", result: "confirmed" } }, directories: { ...technicalCheckpoint.directories, primary: { expected: retainedIdentity, source: { state: "absent", identity: null }, retained: { state: "present", identity: retainedIdentity } } } }, outcome: { status: "recovered", reason: "runtime_repair_recovered", cleanupConfirmed: true } }] })}\n`,
      );
      assert.ok(
        model.decodeRuntimeDomainSnapshot(original, borrowed.repositoryBinding),
      );
      fs.writeFileSync(stateFile, original);
      const decision =
        model.prepareCoordinatorStateRepairDisposalDecisionSnapshot(
          original,
          id,
          "2026-10-17T00:00:00.000Z",
          borrowed.repositoryBinding,
        );
      assert.ok(decision);
      assert.equal(
        model.classifyCoordinatorRepairPublication(
          original,
          decision,
          id,
          borrowed.repositoryBinding,
        )?.mode,
        "disposal_decision",
      );
      for (const purpose of [
        "checkpoint",
        "session_begin",
        "disposal_primary",
      ] as const) {
        const refused = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
          f.capability,
          id,
          original,
          decision,
          () => true,
          purpose,
        );
        assert.equal(refused.snapshotConfirmed, false);
        assert.equal(refused.filesystemEffectIssued, false);
        assert.ok(fs.readFileSync(stateFile).equals(original));
      }
      for (const bypass of ["outer", "inner", "both"] as const) {
        const worker = stateStoreSource((source) => {
          const outer =
            /!validateRepairWriteCandidate\(\s*before,\s*candidateBytes,\s*recoveryId,\s*purpose,\s*repository\.repositoryBinding,\s*\)/u;
          const inner =
            /validateRepairWriteCandidate\(\s*currentBytes,\s*(?:pendingBytes|bytes),\s*currentRepair\.recoveryId,\s*currentRepair\.purpose,\s*repository\.repositoryBinding,\s*\)/gu;
          assert.equal(source.match(outer)?.length, 1);
          assert.equal([...source.matchAll(inner)].length, 2);
          let changed =
            bypass === "inner" ? source : source.replace(outer, "false");
          if (bypass !== "outer") changed = changed.replace(inner, "true");
          return changed;
        });
        const rejected = worker.write(
          f.capability,
          id,
          original,
          decision,
          () => true,
          "disposal_primary",
        );
        if (bypass === "both") {
          assert.equal(
            rejected.snapshotConfirmed,
            true,
            "both_guards_removed_must_break_oracle",
          );
          assert.throws(() => assert.equal(rejected.snapshotConfirmed, false));
          fs.writeFileSync(stateFile, original);
        } else {
          assert.equal(rejected.snapshotConfirmed, false);
          assert.equal(rejected.filesystemEffectIssued, false);
          assert.ok(fs.readFileSync(stateFile).equals(original));
        }
      }
      const saved = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
        f.capability,
        id,
        original,
        decision,
        () => true,
        "disposal_decision",
      );
      assert.equal(saved.status, "completed");
      assert.equal(saved.snapshotConfirmed, true);
      assert.equal(saved.lockReleased, true);
      let before = decision;
      for (const purpose of ["primary", "failed", "auxiliary"] as const) {
        const value = model.decodeRuntimeDomainSnapshot(
          before,
          borrowed.repositoryBinding,
        );
        const target = value?.snapshot.operations.find(
          (item) => item.recoveryId === id,
        );
        assert.ok(
          value && target?.kind === "runtime_repair" && target.disposal,
        );
        const nextCheckpoint = {
          ...target.disposal.checkpoint,
          directories: {
            ...target.disposal.checkpoint.directories,
            [purpose]: {
              intent: "saved",
              request: "not_issued",
              absence: "unobserved",
            },
          },
        };
        const next =
          model.prepareCoordinatorStateRepairDisposalProgressSnapshot(
            before,
            id,
            purpose,
            nextCheckpoint,
            borrowed.repositoryBinding,
          );
        assert.ok(next);
        const writePurpose = `disposal_${purpose}` as const;
        assert.equal(
          model.classifyCoordinatorRepairPublication(
            before,
            next,
            id,
            borrowed.repositoryBinding,
          )?.mode,
          writePurpose,
        );
        for (const wrong of [
          "checkpoint",
          "session_begin",
          purpose === "primary" ? "disposal_failed" : "disposal_primary",
        ] as const) {
          const refused = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
            f.capability,
            id,
            before,
            next,
            () => true,
            wrong,
          );
          assert.equal(refused.snapshotConfirmed, false);
          assert.equal(refused.filesystemEffectIssued, false);
        }
        const rename = fs.renameSync,
          unlink = fs.unlinkSync;
        let cut = 0;
        const renameHook = t.mock.method(
          fs,
          "renameSync",
          (from: fs.PathLike, to: fs.PathLike) => {
            if (purpose === "primary" && to === stateFile && cut === 0) {
              cut++;
              throw new Error("synthetic_disposal_before_rename");
            }
            return rename(from, to);
          },
        );
        const unlinkHook = t.mock.method(
          fs,
          "unlinkSync",
          (file: fs.PathLike) => {
            if (purpose === "failed" && file === marker && cut === 0) {
              cut++;
              throw new Error("synthetic_disposal_after_rename");
            }
            return unlink(file);
          },
        );
        try {
          const written = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
            f.capability,
            id,
            before,
            next,
            () => true,
            writePurpose,
          );
          assert.equal(written.snapshotConfirmed, purpose === "auxiliary");
          assert.equal(written.filesystemEffectIssued, true);
          assert.equal(written.lockReleased, true);
        } finally {
          unlinkHook.mock.restore();
          renameHook.mock.restore();
        }
        if (purpose === "primary") {
          assert.equal(cut, 1);
          assert.ok(fs.readFileSync(stateFile).equals(before));
          assert.ok(fs.readFileSync(pending).equals(next));
          const resumed = stateStoreSource((source) => source).resume(
            f.capability,
            id,
            () => true,
          );
          assert.equal(resumed.snapshotConfirmed, true);
          assert.equal(resumed.filesystemEffectIssued, true);
          assert.equal(resumed.lockReleased, true);
        } else if (purpose === "failed") {
          assert.equal(cut, 1);
          assert.ok(fs.readFileSync(stateFile).equals(next));
          assert.equal(fs.existsSync(pending), false);
          const cleaned = stateStore.cleanupRuntimeOwnedCoordinatorStateMarker(
            f.capability,
          );
          assert.equal(cleaned.storageConfirmed, true);
          assert.equal(cleaned.markerAbsentConfirmed, true);
        }
        assert.ok(fs.readFileSync(stateFile).equals(next));
        assert.equal(fs.existsSync(marker), false);
        assert.equal(fs.existsSync(pending), false);
        const noOpCandidate =
          model.prepareCoordinatorStateRepairDisposalProgressSnapshot(
            next,
            id,
            purpose,
            nextCheckpoint,
            borrowed.repositoryBinding,
          );
        assert.ok(noOpCandidate);
        assert.ok(noOpCandidate.equals(next));
        const identityBefore = fs.lstatSync(stateFile, { bigint: true });
        let mutations = 0;
        const mutationHooks = [
          "writeFileSync",
          "renameSync",
          "unlinkSync",
          "mkdirSync",
          "rmSync",
          "rmdirSync",
        ] as const;
        const hooks = mutationHooks.map((name) =>
          t.mock.method(fs, name, () => {
            mutations++;
            throw new Error("no_op_must_not_write");
          }),
        );
        try {
          const same = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
            f.capability,
            id,
            next,
            noOpCandidate,
            () => true,
            writePurpose,
          );
          assert.equal(same.status, "completed");
          assert.equal(same.snapshotConfirmed, true);
          assert.equal(same.filesystemEffectIssued, false);
          assert.equal(same.lockReleased, true);
          assert.equal(
            same.revision,
            model.decodeRuntimeDomainSnapshot(next, borrowed.repositoryBinding)
              ?.snapshot.revision,
          );
          assert.equal(mutations, 0);
        } finally {
          for (const hook of hooks.reverse()) hook.mock.restore();
        }
        const identityAfter = fs.lstatSync(stateFile, { bigint: true });
        assert.equal(identityAfter.ino, identityBefore.ino);
        assert.equal(identityAfter.mtimeNs, identityBefore.mtimeNs);
        assert.ok(fs.readFileSync(stateFile).equals(next));
        for (const entry of ["state.pending.json", "state.lock", "unknown"]) {
          fs.writeFileSync(path.join(directory, entry), "invalid");
          try {
            const rejected =
              stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
                f.capability,
                id,
                next,
                next,
                () => true,
                writePurpose,
              );
            assert.equal(rejected.snapshotConfirmed, false);
            assert.equal(rejected.filesystemEffectIssued, false);
          } finally {
            fs.unlinkSync(path.join(directory, entry));
          }
        }
        before = next;
      }
      const final = model.decodeRuntimeDomainSnapshot(
        before,
        borrowed.repositoryBinding,
      )?.snapshot.operations[0];
      const first = model.decodeRuntimeDomainSnapshot(
        original,
        borrowed.repositoryBinding,
      )?.snapshot.operations[0];
      assert.ok(
        final?.kind === "runtime_repair" && first?.kind === "runtime_repair",
      );
      assert.deepEqual(final.checkpoint, first.checkpoint);
      assert.deepEqual(final.outcome, first.outcome);
      assert.equal(final.primaryFailure, first.primaryFailure);

      fs.writeFileSync(stateFile, original);
    },
  );
  fs.writeFileSync(stateFile, original);
  await t.test("通常Writerは履歴用途を外側と排他内で拒否する", () => {
    const at = "2026-10-16T00:00:00.000Z";
    const initialHistory = model.prepareCoordinatorRepairHistorySnapshot(
      original,
      id,
      at,
      false,
      repository.repositoryBinding,
    );
    assert.ok(initialHistory);
    const confirmed = model.prepareCoordinatorRepairHistorySnapshot(
      initialHistory,
      id,
      at,
      true,
      repository.repositoryBinding,
    );
    assert.ok(confirmed);
    const readdir = fs.readdirSync;
    let reads = 0;
    const hook = t.mock.method(
      fs,
      "readdirSync",
      (...args: Parameters<typeof fs.readdirSync>) => {
        if (args[0] === path.dirname(stateFile)) reads++;
        return Reflect.apply(readdir, fs, args);
      },
    );
    try {
      for (const [before, candidate] of [
        [original, initialHistory],
        [initialHistory, confirmed],
      ] as const) {
        // 後半は未確認履歴を持つcodec合法なfixture。実保存の根拠にはしない。
        fs.writeFileSync(stateFile, before);
        for (const bypassOuter of [false, true]) {
          const writer = stateStoreSource((source) => {
            if (!bypassOuter) return source;
            const guard =
              /target\.summarySha256 !== \(previousTarget\?\.summarySha256 \?\? null\) \|\|\s*encodeRuntimeStateValue\(target\.history\) !==\s*encodeRuntimeStateValue\(previousTarget\?\.history \?\? null\) \|\|/u;
            assert.equal(source.match(guard)?.length, 1);
            return source.replace(guard, "");
          }).write;
          reads = 0;
          const blocked = writer(
            f.capability,
            id,
            before,
            candidate,
            () => true,
            "checkpoint",
          );
          assert.equal(blocked.status, "blocked");
          assert.equal(blocked.filesystemEffectIssued, false);
          assert.equal(blocked.lockReleased, true);
          assert.equal(reads > 0, bypassOuter, "inner_writer_must_be_reached");
          assert.ok(fs.readFileSync(stateFile).equals(before));
          assert.throws(
            () =>
              fs.lstatSync(
                path.join(path.dirname(stateFile), "state.pending.json"),
              ),
            { code: "ENOENT" },
          );
          assert.throws(
            () =>
              fs.lstatSync(path.join(path.dirname(stateFile), "state.lock")),
            { code: "ENOENT" },
          );
        }
      }
    } finally {
      hook.mock.restore();
    }

    fs.writeFileSync(stateFile, original);
  });
  assert.equal(
    stateStore.readRuntimeOwnedCoordinatorCurrentHistorySnapshot(
      f.capability,
      id,
    ).status,
    "blocked",
  );
  const taskResult = stateStore.advanceRuntimeOwnedCoordinatorRecoveryHistory(
    repository,
    id,
    () => true,
  );
  assert.equal(taskResult.status, "blocked");
  assert.ok(fs.readFileSync(stateFile).equals(original));
  const first = stateStoreSource((source) => source);
  const observed = first.readHistory(f.capability, id);
  assert.equal(observed.status, "completed");
  assert.equal(observed.currentHistoryPublication?.stage, "checkpoint");
  assert.equal(
    observed.currentHistoryPublication?.operationKind,
    "runtime_repair",
  );
  const fixed = first.advanceHistory(repository, id, () => true);
  assert.equal(fixed.status, "completed");
  assert.equal(fixed.historyConfirmed, false);
  assert.equal(fixed.lockReleased, true);
  const checkpointBytes = fs.readFileSync(stateFile);
  const checkpoint = model.decodeRuntimeDomainSnapshot(
    checkpointBytes,
    repository.repositoryBinding,
  );
  const fixedOperation = checkpoint?.snapshot.operations.find(
    (item) => item.recoveryId === id,
  );
  assert.ok(fixedOperation?.history && !fixedOperation.history.confirmed);
  const second = stateStoreSource((source) => source);
  assert.equal(
    second.readHistory(f.capability, id).currentHistoryPublication?.stage,
    "publish",
  );
  const published = second.advanceHistory(repository, id, () => true);
  assert.equal(published.status, "completed");
  assert.equal(published.historyConfirmed, true);
  assert.equal(published.lockReleased, true);
  const currentBytes = fs.readFileSync(stateFile);
  const current = model.decodeRuntimeDomainSnapshot(
    currentBytes,
    repository.repositoryBinding,
  );
  const finalOperation = current?.snapshot.operations.find(
    (item) => item.recoveryId === id,
  );
  assert.ok(finalOperation?.history?.confirmed);
  assert.equal(
    finalOperation.history.occurredAt,
    fixedOperation.history.occurredAt,
  );
  assert.equal(
    finalOperation.history.lineSha256,
    fixedOperation.history.lineSha256,
  );
  const historyFile = path.join(path.dirname(stateFile), "history.jsonl");
  const historyBytes = fs.readFileSync(historyFile);
  const rows = domain.decodeCoordinatorHistoryRows(historyBytes);
  assert.equal(rows?.length, 1);
  assert.equal(rows?.[0]?.recoveryId, id);
  await t.test("終了ReaderとWriterは履歴欠測を独立に拒否する", () => {
    const original = currentBytes;
    const candidate = model.prepareCoordinatorStateRepairCompletionSnapshot(
      original,
      id,
      repository.repositoryBinding,
    );
    assert.ok(candidate);
    const row = JSON.parse(historyBytes.toString("utf8"));
    row.summary.operationNonce = "9".repeat(64);
    row.summary.recoveryId = `docker-runtime-repair.${row.summary.operationNonce}.${row.summary.identitySha256}`;
    const otherHistory = Buffer.from(`${encodeRuntimeStateValue(row)}\n`);
    assert.equal(domain.decodeCoordinatorHistoryRows(otherHistory)?.length, 1);
    fs.writeFileSync(stateFile, original);
    fs.writeFileSync(historyFile, otherHistory);
    const readerNeedle = '(currentCompletionKind === "runtime_repair" && !row)';
    const writerNeedle =
      '(currentCompletion.operationKind === "runtime_repair" && !row)';
    const readerRelaxed = stateStoreSource((source) => {
      assert.equal(source.split(readerNeedle).length, 2);
      return source.replace(readerNeedle, "false");
    });
    assert.throws(() =>
      assert.equal(
        readerRelaxed.readCompletion(f.capability, id).status,
        "blocked",
      ),
    );
    // Reader側の欠落を仮定しても、排他内Writerが独立に拒否する。
    const writerRefused = readerRelaxed.complete(f.capability, id, () => true);
    assert.equal(writerRefused.status, "blocked");
    assert.equal(writerRefused.filesystemEffectIssued, false);
    assert.ok(fs.readFileSync(stateFile).equals(original));
    const writerRelaxed = stateStoreSource((source) => {
      assert.equal(source.split(writerNeedle).length, 2);
      return source
        .replace(readerNeedle, "false")
        .replace(writerNeedle, "false");
    });
    const bypass = writerRelaxed.complete(f.capability, id, () => true);
    assert.throws(() => assert.equal(bypass.status, "blocked"));
    assert.ok(fs.readFileSync(stateFile).equals(candidate));
  });
  fs.writeFileSync(stateFile, currentBytes);
  fs.writeFileSync(historyFile, historyBytes);
  assert.ok(lastPreOutcomeCheckpoint);
  const technicalBytes = Buffer.from(lastPreOutcomeCheckpoint);
  for (const historyCase of [
    "empty",
    "other",
    "same_id",
    "invalid",
    "pending",
  ] as const) {
    await t.test(`technical_${historyCase}`, async () => {
      const historyPath = path.join(
        path.dirname(stateFile),
        "history.pending.jsonl",
      );
      if (fs.existsSync(historyPath)) fs.unlinkSync(historyPath);
      if (fs.existsSync(historyFile)) fs.unlinkSync(historyFile);
      fs.writeFileSync(stateFile, technicalBytes);
      if (historyCase === "same_id")
        fs.writeFileSync(historyFile, historyBytes);
      if (historyCase === "invalid") fs.writeFileSync(historyFile, "invalid\n");
      if (historyCase === "pending")
        fs.writeFileSync(historyPath, historyBytes);
      if (historyCase === "other") {
        const row = JSON.parse(historyBytes.toString("utf8"));
        row.summary.operationNonce = "f".repeat(64);
        row.summary.identitySha256 = "e".repeat(64);
        row.summary.operationId = "OP-999997";
        row.summary.recoveryId = `docker-runtime-repair.${row.summary.operationNonce}.${row.summary.identitySha256}`;
        const bytes = Buffer.from(`${encodeRuntimeStateValue(row)}\n`);
        assert.equal(domain.decodeCoordinatorHistoryRows(bytes)?.length, 1);
        fs.writeFileSync(historyFile, bytes);
      }
      const read = stateStoreSource((source) => source).readHistory(
        f.capability,
        id,
      );
      const valid = historyCase === "empty" || historyCase === "other";
      assert.equal(read.status, valid ? "completed" : "blocked");
      assert.equal(read.repairHistoryState, valid ? "technical_state" : null);
      assert.equal(read.currentHistoryPublication, null);
      if (!valid) assert.ok(fs.readFileSync(stateFile).equals(technicalBytes));
    });
  }
  const technicalPending = path.join(
    path.dirname(stateFile),
    "history.pending.jsonl",
  );
  if (fs.existsSync(technicalPending)) fs.unlinkSync(technicalPending);
  fs.writeFileSync(stateFile, currentBytes);
  fs.writeFileSync(historyFile, historyBytes);
  const third = stateStoreSource((source) => source);
  const confirmed = third.advanceHistory(repository, id, () => true);
  assert.equal(confirmed.status, "completed");
  assert.equal(confirmed.filesystemEffectIssued, false);
  assert.equal(confirmed.historyConfirmed, true);
  assert.ok(fs.readFileSync(stateFile).equals(currentBytes));
  assert.ok(fs.readFileSync(historyFile).equals(historyBytes));
  const directory = path.dirname(stateFile);
  fs.writeFileSync(stateFile, checkpointBytes);
  fs.writeFileSync(historyFile, historyBytes);
  const ownerRefused = stateStoreSource((source) => source).advanceHistory(
    repository,
    id,
    () => false,
  );
  assert.equal(ownerRefused.status, "blocked");
  assert.equal(ownerRefused.filesystemEffectIssued, false);
  const wrongOperation = stateStoreSource((source) => source).advanceHistory(
    { ...repository, operationId: "OP-999999" },
    id,
    () => true,
  );
  assert.equal(wrongOperation.status, "blocked");
  assert.equal(wrongOperation.filesystemEffectIssued, false);
  assert.ok(fs.readFileSync(stateFile).equals(checkpointBytes));
  assert.ok(fs.readFileSync(historyFile).equals(historyBytes));
  for (const fault of [
    "checkpoint_before",
    "checkpoint_after",
    "publish_before",
    "publish_after",
    "confirm_after",
    "readback_unknown",
    "release_unknown",
    "file_changed",
    "config_changed",
    "state_changed",
    "owner_lost",
  ] as const) {
    await t.test(fault, () => {
      for (const name of [
        "history.jsonl",
        "history.pending.jsonl",
        "state.pending.json",
        "state.lock",
      ]) {
        const file = path.join(directory, name);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
      const startsCheckpoint = fault.startsWith("checkpoint_");
      const before = startsCheckpoint ? original : checkpointBytes;
      fs.writeFileSync(stateFile, before);
      if (["confirm_after", "release_unknown", "file_changed"].includes(fault))
        fs.writeFileSync(historyFile, historyBytes);
      let hit = 0,
        locks = 0,
        renamed = false,
        ownerLive = true;
      const configDirectory = path.join(f.root, ".crdd", "config");
      const configFile = path.join(configDirectory, "coordinator.json");
      const hostFs = {
        ...fs,
        renameSync: (source: fs.PathLike, target: fs.PathLike) => {
          const watched =
            startsCheckpoint || fault === "confirm_after"
              ? String(source) === path.join(directory, "state.pending.json")
              : String(source) ===
                path.join(directory, "history.pending.jsonl");
          if (
            watched &&
            hit === 0 &&
            ["checkpoint_before", "publish_before"].includes(fault)
          ) {
            hit++;
            throw new Error("synthetic_before_rename");
          }
          fs.renameSync(source, target);
          if (watched) renamed = true;
          if (
            watched &&
            hit === 0 &&
            ["checkpoint_after", "publish_after", "confirm_after"].includes(
              fault,
            )
          ) {
            hit++;
            throw new Error("synthetic_after_rename");
          }
        },
      };
      const worker = stateStoreSource((source) => source, {
        fs: hostFs,
        readStableBoundedFileSnapshot: (
          ...args: Parameters<typeof domain.readStableBoundedFileSnapshot>
        ) => {
          if (
            fault === "readback_unknown" &&
            renamed &&
            hit === 0 &&
            args[0] === historyFile
          ) {
            hit++;
            throw new Error("synthetic_readback_unknown");
          }
          return domain.readStableBoundedFileSnapshot(...args);
        },
        acquireRuntimeOwnedCoordinatorStateKernelLock: (
          ...args: Parameters<
            typeof kernel.acquireRuntimeOwnedCoordinatorStateKernelLock
          >
        ) => {
          const lock = kernel.acquireRuntimeOwnedCoordinatorStateKernelLock(
            ...args,
          );
          locks++;
          if (lock && locks === 2) {
            if (fault === "file_changed") {
              const previous = fs.lstatSync(historyFile, { bigint: true });
              const temporary = path.join(directory, "replacement.fixture");
              fs.writeFileSync(temporary, historyBytes);
              fs.renameSync(temporary, historyFile);
              assert.notEqual(
                fs.lstatSync(historyFile, { bigint: true }).ino,
                previous.ino,
              );
              hit++;
            } else if (fault === "config_changed") {
              fs.mkdirSync(configDirectory);
              fs.writeFileSync(
                configFile,
                `${JSON.stringify({ schemaRevision: 1, historyRetentionDays: 31 })}\n`,
              );
              hit++;
            } else if (fault === "state_changed") {
              fs.writeFileSync(stateFile, currentBytes);
              hit++;
            } else if (fault === "owner_lost") {
              ownerLive = false;
              hit++;
            }
            if (fault === "release_unknown")
              return {
                ...lock,
                release: () => {
                  assert.equal(lock.release(), true);
                  hit++;
                  return false;
                },
              };
          }
          return lock;
        },
      });
      try {
        const failed = worker.advanceHistory(repository, id, () => ownerLive);
        assert.equal(hit, 1, "fault_must_be_reached_once");
        assert.equal(failed.status, "blocked");
        assert.equal(failed.historyConfirmed, false);
        assert.equal(failed.lockReleased, fault !== "release_unknown");
        assert.equal(
          failed.filesystemEffectIssued,
          ![
            "file_changed",
            "config_changed",
            "state_changed",
            "owner_lost",
          ].includes(fault),
        );
        assert.equal(locks, 2, "repair_does_not_retry_or_fallback");
        if (["file_changed", "config_changed", "owner_lost"].includes(fault))
          assert.ok(fs.readFileSync(stateFile).equals(before));
        else if (fault === "state_changed")
          assert.ok(fs.readFileSync(stateFile).equals(currentBytes));
        else {
          let expectedCheckpoint: Buffer = checkpointBytes;
          let expectedConfirmed: Buffer = currentBytes;
          if (startsCheckpoint) {
            const captured = fs.readFileSync(
              fault === "checkpoint_before"
                ? path.join(directory, "state.pending.json")
                : stateFile,
            );
            const capturedState = model.decodeRuntimeDomainSnapshot(
              captured,
              repository.repositoryBinding,
            );
            const capturedOperation = capturedState?.snapshot.operations.find(
              (item) => item.recoveryId === id,
            );
            assert.ok(
              capturedOperation?.history &&
                !capturedOperation.history.confirmed,
            );
            const rebuilt = model.prepareCoordinatorRepairHistorySnapshot(
              original,
              id,
              capturedOperation.history.occurredAt,
              false,
              repository.repositoryBinding,
            );
            assert.ok(rebuilt && captured.equals(rebuilt));
            expectedCheckpoint = rebuilt;
            const rebuiltConfirmed =
              model.prepareCoordinatorRepairHistorySnapshot(
                rebuilt,
                id,
                capturedOperation.history.occurredAt,
                true,
                repository.repositoryBinding,
              );
            assert.ok(rebuiltConfirmed);
            expectedConfirmed = rebuiltConfirmed;
          }
          const fresh = stateStoreSource((source) => source);
          const resumed = fresh.advanceHistory(repository, id, () => true);
          assert.equal(resumed.status, "completed");
          assert.equal(resumed.lockReleased, true);
          assert.equal(resumed.historyConfirmed, fault !== "checkpoint_before");
          assert.ok(
            fs
              .readFileSync(stateFile)
              .equals(
                fault === "checkpoint_before"
                  ? expectedCheckpoint
                  : expectedConfirmed,
              ),
          );
          if (fault !== "checkpoint_before") {
            const expectedLine = model.prepareCoordinatorRepairHistoryLine(
              expectedConfirmed,
              id,
              repository.repositoryBinding,
            );
            assert.ok(
              expectedLine && fs.readFileSync(historyFile).equals(expectedLine),
            );
          }
        }
      } finally {
        if (fs.existsSync(configFile)) fs.unlinkSync(configFile);
        if (fs.existsSync(configDirectory)) fs.rmdirSync(configDirectory);
      }
    });
  }
  for (const mutant of [
    "checkpoint_kind",
    "publish_kind",
    "physical_publish_kind",
    "line_kind",
    "final_kind",
    "repair_scope",
  ] as const) {
    await t.test(mutant, () => {
      for (const name of [
        "history.jsonl",
        "history.pending.jsonl",
        "state.pending.json",
        "state.lock",
      ]) {
        const file = path.join(directory, name);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
      fs.writeFileSync(
        stateFile,
        mutant === "checkpoint_kind" || mutant === "repair_scope"
          ? original
          : checkpointBytes,
      );
      let matches = 0;
      const changed = stateStoreSource((source) => {
        if (mutant === "repair_scope") {
          const pattern =
            /repairHistoryScopeConfirmed =\s*currentHistory\.operationKind === "runtime_repair";/u;
          assert.ok(pattern.test(source));
          return source.replace(
            pattern,
            "repairHistoryScopeConfirmed = false;",
          );
        }
        const pattern =
          mutant === "checkpoint_kind"
            ? /currentHistory\.operationKind === "runtime_repair"\s*\? prepareCoordinatorRepairHistorySnapshot/u
            : mutant === "publish_kind" || mutant === "physical_publish_kind"
              ? /currentHistory\.operationKind === "runtime_repair"\s*\? prepareCoordinatorRepairHistoryPublication/gu
              : /currentHistory\?\.operationKind === "runtime_repair"\s*\? prepareCoordinatorRepairHistoryLine/gu;
        const count = [...source.matchAll(new RegExp(pattern.source, "gu"))]
          .length;
        assert.equal(count, mutant === "checkpoint_kind" ? 1 : 2);
        return source.replace(pattern, (value) => {
          matches++;
          if (
            (mutant === "line_kind" && matches !== 1) ||
            (mutant === "final_kind" && matches !== 2) ||
            (mutant === "publish_kind" && matches !== 1) ||
            (mutant === "physical_publish_kind" && matches !== 2)
          )
            return value;
          return value.replace('=== "runtime_repair"', '=== "docker_task"');
        });
      });
      const rejected = changed.advanceHistory(repository, id, () => true);
      assert.equal(
        rejected.status,
        "blocked",
        "same_positive_oracle_detects_wrong_dispatch",
      );
      assert.equal(rejected.filesystemEffectIssued, mutant === "final_kind");
      assert.ok(
        fs
          .readFileSync(stateFile)
          .equals(
            mutant === "final_kind"
              ? currentBytes
              : mutant === "checkpoint_kind" || mutant === "repair_scope"
                ? original
                : checkpointBytes,
          ),
      );
    });
  }
  for (const name of [
    "history.pending.jsonl",
    "state.pending.json",
    "state.lock",
  ]) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  await t.test("nonempty_other_operations", () => {
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
    const taskIdentity = {
      schema: "crdd-coordinator/operation-identity/v2",
      operationNonce: "b".repeat(64),
      provider: "claude",
      consumer: "orchestrator",
      operationId: "OP-234567",
      grantRef: "PHMGRANT-FIXTURE",
      executionSelection: executionSelection("executor", {
        provider: "claude",
        model: "opus",
        effort: "low",
      }),
      taskAttempt: 0,
      stableLogicalHomeBindingHash: "c".repeat(64),
      providerHomeIdentityHash: "8".repeat(64),
      providerHomeProtectionHash: "9".repeat(64),
      localUserBindingHash: "6".repeat(64),
      repositoryBinding: repository.repositoryBinding,
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
      resources: {
        auth: "crdd-auth-0123456789abcdef",
        provider: "crdd-claude-0123456789abcdef",
        proxy: "crdd-proxy-0123456789abcdef",
        internal: "crdd-internal-0123456789abcdef",
        egress: "crdd-egress-0123456789abcdef",
      },
      images: {
        provider: `sha256:${"a".repeat(64)}`,
        proxy: `sha256:${"b".repeat(64)}`,
      },
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
    const taskBytes = model.prepareCoordinatorStateOperationSnapshot(
      null,
      `${JSON.stringify(taskIdentity)}\n`,
      repository.repositoryBinding,
    );
    assert.ok(taskBytes);
    const task = model.decodeRuntimeDomainSnapshot(
      taskBytes,
      repository.repositoryBinding,
    )?.snapshot.operations[0];
    assert.ok(task?.kind === "docker_task");
    const otherBytes = model.prepareCoordinatorStateRepairSnapshot(
      null,
      `${JSON.stringify({ ...JSON.parse(operation.identityJson), operationNonce: "f".repeat(64), operationId: "OP-999998" })}\n`,
      repository.repositoryBinding,
    );
    assert.ok(otherBytes);
    const other = model.decodeRuntimeDomainSnapshot(
      otherBytes,
      repository.repositoryBinding,
    )?.snapshot.operations[0];
    assert.ok(other?.kind === "runtime_repair");
    assert.ok(decoded);
    const mixed = {
      ...decoded.snapshot,
      operations: [
        operation,
        {
          ...other,
          phase: "awaiting_delivery",
          outcome: {
            status: "blocked",
            reason: "runtime_repair_failed_closed",
            cleanupConfirmed: true,
          },
        },
        {
          ...task,
          phase: "settling",
          lease: "released",
          host: { ...task.host, cleanup: "confirmed" },
          execution: { ...task.execution, ownerEffect: "disabled" },
          outcome: {
            status: "cancelled",
            reason: "provider_operation_cancelled",
            cleanupConfirmed: true,
          },
        },
      ].sort((a, b) =>
        JSON.parse(a.identityJson).operationNonce.localeCompare(
          JSON.parse(b.identityJson).operationNonce,
        ),
      ),
      unresolvedRecoveries: [
        {
          operationNonce: taskIdentity.operationNonce,
          recoveryId: task.recoveryId,
          reason: "provider_operation_cancelled",
          obligations: ["host_cleanup"],
        },
      ],
      pendingDeliveries: [
        {
          operationNonce: taskIdentity.operationNonce,
          recoveryId: task.recoveryId,
          resultId: "4".repeat(64),
          consumer: "orchestrator",
        },
      ],
    };
    const mixedBytes = Buffer.from(`${encodeRuntimeStateValue(mixed)}\n`);
    assert.ok(
      model.decodeRuntimeDomainSnapshot(
        mixedBytes,
        repository.repositoryBinding,
      ),
    );
    if (fs.existsSync(historyFile)) fs.unlinkSync(historyFile);
    fs.writeFileSync(stateFile, mixedBytes);
    for (const stage of ["checkpoint", "publish"] as const) {
      const saved = stateStoreSource((source) => source).advanceHistory(
        repository,
        id,
        () => true,
      );
      assert.equal(saved.status, "completed");
      assert.equal(saved.historyConfirmed, stage === "publish");
      const after = model.decodeRuntimeDomainSnapshot(
        fs.readFileSync(stateFile),
        repository.repositoryBinding,
      );
      assert.ok(after);
      assert.deepEqual(
        after.snapshot.operations.filter((item) => item.recoveryId !== id),
        mixed.operations.filter((item) => item.recoveryId !== id),
      );
      assert.deepEqual(
        after.snapshot.unresolvedRecoveries,
        mixed.unresolvedRecoveries,
      );
      assert.deepEqual(
        after.snapshot.pendingDeliveries,
        mixed.pendingDeliveries,
      );
    }
  });
  fs.writeFileSync(stateFile, currentBytes);
  fs.writeFileSync(historyFile, Buffer.concat([historyBytes, historyBytes]));
  const blocked = third.advanceHistory(repository, id, () => true);
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.filesystemEffectIssued, false);
  assert.ok(fs.readFileSync(stateFile).equals(currentBytes));
  for (const mutant of [false, true]) {
    let locks = 0;
    const fallbackProbe = stateStoreSource(
      (source) => {
        if (!mutant) return source;
        const pattern =
          /operationKind === "docker_task" &&\s*observed.status !== "completed"/u;
        assert.ok(pattern.test(source));
        return source.replace(pattern, 'observed.status !== "completed"');
      },
      {
        acquireRuntimeOwnedCoordinatorStateKernelLock: (
          ...args: Parameters<
            typeof kernel.acquireRuntimeOwnedCoordinatorStateKernelLock
          >
        ) => {
          locks++;
          return kernel.acquireRuntimeOwnedCoordinatorStateKernelLock(...args);
        },
      },
    );
    const refused = fallbackProbe.advanceHistory(repository, id, () => true);
    assert.equal(refused.status, "blocked");
    assert.equal(refused.filesystemEffectIssued, false);
    assert.equal(
      locks,
      mutant ? 2 : 1,
      "repair_failure_has_no_task_delivery_fallback",
    );
    assert.ok(fs.readFileSync(stateFile).equals(currentBytes));
  }
});

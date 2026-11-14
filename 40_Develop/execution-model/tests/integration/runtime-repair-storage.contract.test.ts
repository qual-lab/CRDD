/**
 * 修復履歴の保存・出版・種別相関と保存codecをEM自身の期待値で反証する。
 * @packageDocumentation
 * @responsibility 専用Owner、fresh読取り、五有限形、故障窓と非対象保全を所有する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 独立した保存DTOの全field反証と自己生成Repositoryの実保存。DI実装は使用しない。
 * @boundary EM保存と実Filesystem／共通Lock。技術Producerとの接続はCoordinatorが所有する。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { getRepository } from "../../../version-control/src/index.ts";
import * as storedContract from "../../src/attempt/validation.ts";
import { decodeHistoryRows } from "../../src/history/validation.ts";
import type * as model from "../../src/index.ts";
import * as domain from "../../src/index.ts";
import * as stateStore from "../../src/index.ts";
import { decodeStateSnapshot } from "../../src/state/validation.ts";
import { encodeStateValue } from "../../src/state/operations.ts";

import * as kernel from "../../src/storage/lock.ts";
import { observeExecutionStorageRepository } from "../../src/storage/lock.ts";
import * as areaRequirement from "../../src/storage/store.ts";
import * as areaInitialization from "../../src/storage/store.ts";
import * as fileObservation from "../../src/storage/store.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
import { createRuntimeStorageSourceFixture } from "../support/runtime-storage-source.ts";

/**
 * 固定byte oracleの元改訂だけを公開Requestへ投影する。
 * @responsibility 保存本文そのものをWriterへの候補入力にしない。
 * @trace ERB-IT-014
 * @precondition 正規codecで読める試験本文。
 * @stimulus 改訂番号と本文Hashを読む。
 * @observation 論理Requestのexpected値。
 * @oracle 本文候補・用途・保存処理を生成しない。
 * @cleanup N/A: 値だけ。
 * @boundary 試験内の元版投影。
 */
function repairVersion(bytes: Buffer, binding: string): model.StateVersion {
  const value = decodeStateSnapshot(bytes, binding);
  assert.ok(value);
  return {
    revision: value.snapshot.revision,
    payloadSha256: value.payloadSha256,
  };
}

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
    schema: "crdd-coordinator/runtime-repair-identity/v2",
    kind: "runtime_repair",
    operationNonce: "e".repeat(64),
    operationId: "OP-123456",
    repositoryBinding: binding,
    consumer: "coordinator_cli",
  };
  const started = prepareStateRepairSnapshot(
    null,
    `${JSON.stringify(identity)}\n`,
    binding,
  );
  assert.ok(started);
  const raw = JSON.parse(started.toString());
  const actionNames = [
    "stop_runtime",
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
  const waiting = Buffer.from(`${encodeStateValue(raw)}\n`);
  assert.ok(decodeStateSnapshot(waiting, binding));
  const id = raw.operations[0].recoveryId as string;
  const bytes = prepareStateRepairDisposalDecisionSnapshot(
    waiting,
    id,
    "2026-10-17T00:00:00.000Z",
    binding,
  );
  assert.ok(bytes);
  const decoded = decodeStateSnapshot(bytes, binding);
  assert.ok(decoded);
  const operation = decoded.snapshot.operations[0];
  assert.ok(operation?.kind === "runtime_repair" && operation.disposal);
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
    "blocked_after",
    "missing_after",
    "release_after",
    "hash_after",
    "bytes_after",
    "owner_lost_after",
    "owner_throw_after",
    "owner_promise_after",
  ] as const) {
    let reads = 0,
      writes = 0,
      contexts = 0;
    const worker = stateStoreSource(
      (source) => {
        const reader = source.indexOf("function readStateSnapshot(");
        const readerEnd = source.indexOf("\n/**", reader);
        assert.ok(reader > 0 && readerEnd > reader);
        let changed =
          source.slice(0, reader) +
          "function readStateSnapshot(repository) { return readProbe(repository); }\n" +
          source.slice(readerEnd);
        const writer = changed.indexOf("function writeStateSnapshot(");
        const writerEnd = changed.indexOf("\n/**", writer);
        assert.ok(writer > 0 && writerEnd > writer);
        changed =
          changed.slice(0, writer) +
          "function writeStateSnapshot(...args) { return writeProbe(...args); }\n" +
          changed.slice(writerEnd);
        return changed.replaceAll(
          "settlements.set(context, {",
          "contextProbe(); settlements.set(context, {",
        );
      },
      {
        observeExecutionRecoveryRepository: () => ({
          repositoryRoot: "unused",
          repositoryBinding: binding,
          revalidate: () => true,
        }),
        contextProbe: () => contexts++,
        writeProbe: (_owner: unknown, repository: unknown) => {
          if (repository) writes++;
          return {
            status: "blocked",
            snapshotConfirmed: false,
            filesystemEffectIssued: false,
            lockReleased: true,
          };
        },
        readProbe: (repository: { revalidate: () => boolean }) => {
          reads++;
          const fault = mode.endsWith("_after")
            ? reads > 1
              ? mode.slice(0, -6)
              : "normal"
            : mode;
          if (
            fault === "owner_lost" ||
            fault === "owner_throw" ||
            fault === "owner_promise"
          )
            assert.equal(repository.revalidate(), false);
          return {
            status: fault === "blocked" ? "blocked" : "completed",
            lockReleased: fault !== "release",
            value:
              fault === "missing"
                ? null
                : {
                    ...decoded,
                    payloadSha256:
                      fault === "hash" ? "0".repeat(64) : decoded.payloadSha256,
                    snapshot:
                      fault === "bytes"
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
      {
        expected: repairVersion(bytes, binding),
        change: {
          kind: "disposal_progress",
          purpose: "primary",
          checkpoint: operation.disposal.checkpoint,
        },
      },
      () => {
        const fault = mode.endsWith("_after")
          ? reads > 1
            ? mode.slice(0, -6)
            : "normal"
          : reads > 0
            ? mode
            : "normal";
        if (fault === "owner_throw") throw new Error("owner_lost");
        if (fault === "owner_promise") return Promise.resolve(true);
        return fault !== "owner_lost";
      },
    );
    assert.equal(saved.snapshotConfirmed, mode === "normal", mode);
    if (mode === "normal") {
      assert.equal(saved.value?.checkpointSettled, true);
      assert.equal(saved.value?.operation.recoveryId, id);
    } else {
      assert.equal(saved.value, null, mode);
    }
    assert.equal(
      saved.status,
      mode === "normal" ? "completed" : "blocked",
      mode,
    );
    assert.equal(saved.filesystemEffectIssued, false);
    assert.equal(
      saved.lockReleased,
      mode !== "release" && mode !== "release_after",
    );
    assert.equal(reads, mode === "normal" || mode.endsWith("_after") ? 2 : 1);
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
    resume: store.resumeRepairRecordSave,
    write: store.saveRepairRecord,
    readHistory: (root: unknown, recoveryId: unknown) =>
      store.readState(root, {
        scope: "recovery",
        input: { kind: "repair_history", recoveryId },
      }),
    saveRecoveryHistory: store.saveRecoveryHistory,
    readCompletion: (root: unknown, recoveryId: unknown) =>
      store.readState(root, {
        scope: "recovery",
        input: { kind: "repair_completion", recoveryId },
      }),
    completeRecovery: store.completeRecovery,
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
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw Error("fixture_root_invalid");
  const f = { root, capability: verified.capability };
  const historyInput = {
    root: f.capability,
    historyRetentionDays: 30,
    revalidate(expected?: number) {
      if (expected === undefined) return true;
      try {
        const config = JSON.parse(
          fs.readFileSync(
            path.join(f.root, ".crdd", "config", "coordinator.json"),
            "utf8",
          ),
        );
        return config.historyRetentionDays === expected;
      } catch (error) {
        return (
          (error as NodeJS.ErrnoException).code === "ENOENT" && expected === 30
        );
      }
    },
  };
  const borrowed = observeExecutionStorageRepository(historyInput);
  assert.ok(borrowed);
  const identityJson = `${JSON.stringify({
    schema: "crdd-coordinator/runtime-repair-identity/v2",
    kind: "runtime_repair",
    operationNonce: "a".repeat(64),
    operationId: "OP-123456",
    repositoryBinding: borrowed.repositoryBinding,
    consumer: "coordinator_cli",
  })}\n`;
  const initial = prepareStateRepairSnapshot(
    null,
    identityJson,
    borrowed.repositoryBinding,
  );
  assert.ok(initial);
  const initialState = decodeStateSnapshot(initial, borrowed.repositoryBinding);
  assert.ok(initialState);
  const initialOperation = initialState.snapshot.operations[0];
  assert.ok(initialOperation?.kind === "runtime_repair");
  const technicalCheckpoint = {
    actions: Object.fromEntries(
      storedContract.REPAIR_ACTIONS.map((action) => [
        action,
        { intent: "not_saved", request: "not_issued", result: "not_required" },
      ]),
    ),
    directories: Object.fromEntries(
      storedContract.REPAIR_DIRECTORIES.map((purpose) => [
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
  assert.ok(
    storedContract.decodeEnvironmentRepairCheckpoint(technicalCheckpoint),
  );
  const lastPreOutcomeCheckpoint = Buffer.from(
    `${encodeStateValue({
      ...initialState.snapshot,
      operations: [{ ...initialOperation, checkpoint: technicalCheckpoint }],
    })}\n`,
  );
  assert.ok(
    decodeStateSnapshot(lastPreOutcomeCheckpoint, borrowed.repositoryBinding),
  );
  const original = Buffer.from(
    `${encodeStateValue({
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
    })}\n`,
  );
  assert.ok(decodeStateSnapshot(original, borrowed.repositoryBinding));
  const stateArea = areaRequirement.requireReadyRepositoryExecutionDataArea(
    areaInitialization.ensureRepositoryExecutionDataAreaFromWorkingDirectory(
      root,
      "domain-model",
    ),
    "repair_storage_fixture",
  );
  const stateFile = path.join(stateArea.directory, "state.json");
  fs.writeFileSync(stateFile, original, { flag: "wx" });
  const id = initialOperation.recoveryId;
  const decoded = decodeStateSnapshot(original, borrowed.repositoryBinding);
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
          phase: "terminal",
          checkpoint: null,
          primaryFailure: null,
          outcome: {
            status: "blocked",
            reason: "runtime_repair_failed_closed",
            cleanupConfirmed: true,
          },
        };
        before = Buffer.from(
          `${encodeStateValue({ ...initialState.snapshot, operations: [other] })}\n`,
        );
        candidate = prepareStateRepairSnapshot(
          before,
          `${JSON.stringify({
            ...JSON.parse(initialOperation.identityJson),
            operationNonce: "f".repeat(64),
            operationId: "OP-999999",
          })}\n`,
          binding,
        );
        assert.ok(candidate);
        const added = decodeStateSnapshot(
          candidate,
          binding,
        )?.snapshot.operations.find((item) => item.recoveryId !== id);
        assert.ok(added);
        targetId = added.recoveryId;
      } else {
        candidate = prepareStateRepairSessionSnapshot(before, id, binding);
        assert.ok(candidate);
      }
      assert.ok(decodeStateSnapshot(before, binding));
      fs.writeFileSync(stateFile, before);
      if (mode === "session_begin") {
        const sessionOperation = decodeStateSnapshot(
          candidate,
          binding,
        )?.snapshot.operations.find((item) => item.recoveryId === id);
        assert.ok(
          sessionOperation?.kind === "runtime_repair" &&
            sessionOperation.checkpoint,
        );
        const rejected = stateStore.saveRepairRecord(
          f.capability,
          id,
          {
            expected: repairVersion(before, binding),
            change: {
              kind: "session_begin",
              checkpoint: {
                ...sessionOperation.checkpoint,
                engine:
                  sessionOperation.checkpoint.engine === "ready"
                    ? "unobserved"
                    : "ready",
              },
            },
          },
          () => true,
        );
        assert.equal(rejected.status, "blocked");
        assert.equal(rejected.snapshotConfirmed, false);
        assert.equal(rejected.filesystemEffectIssued, false);
        assert.equal(rejected.value, null);
        assert.ok(fs.readFileSync(stateFile).equals(before));
        assert.equal(
          fs.existsSync(
            path.join(path.dirname(stateFile), "state.pending.json"),
          ),
          false,
        );
        assert.equal(
          fs.existsSync(path.join(path.dirname(stateFile), "state.lock")),
          false,
        );
      }
      const pending = path.join(path.dirname(stateFile), "state.pending.json"),
        marker = path.join(path.dirname(stateFile), "state.lock");
      fs.writeFileSync(pending, candidate, { flag: "wx" });

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
      const publish = (resume: typeof stateStore.resumeRepairRecordSave) => {
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
        `${encodeStateValue({ ...initialState.snapshot, operations: [{ ...initialOperation, phase: "awaiting_disposition", disposition: "pending_human_decision", checkpoint: { ...technicalCheckpoint, stale: "retained", actions: { ...technicalCheckpoint.actions, retain_runtime: { intent: "saved", request: "issued", result: "confirmed" } }, directories: { ...technicalCheckpoint.directories, primary: { expected: retainedIdentity, source: { state: "absent", identity: null }, retained: { state: "present", identity: retainedIdentity } } } }, outcome: { status: "recovered", reason: "runtime_repair_recovered", cleanupConfirmed: true } }] })}\n`,
      );
      assert.ok(decodeStateSnapshot(original, borrowed.repositoryBinding));
      fs.writeFileSync(stateFile, original);
      const decision = prepareStateRepairDisposalDecisionSnapshot(
        original,
        id,
        "2026-10-17T00:00:00.000Z",
        borrowed.repositoryBinding,
      );
      assert.ok(decision);
      assert.equal(
        classifyRepairPublication(
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
        const refused = stateStore.saveRepairRecord(
          f.capability,
          id,
          {
            expected: repairVersion(original, borrowed.repositoryBinding),
            change: {
              kind: purpose,
              candidate: decision,
            },
          } as unknown as model.RepairSaveRequest,
          () => true,
        );
        assert.equal(refused.snapshotConfirmed, false);
        assert.equal(refused.filesystemEffectIssued, false);
        assert.ok(fs.readFileSync(stateFile).equals(original));
      }
      for (const bypass of ["outer", "inner", "both"] as const) {
        const worker = stateStoreSource(
          (source) => {
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
          },
          {
            prepareStateRepairDisposalProgressSnapshot: () => decision,
          },
        );
        const decisionOperation = decodeStateSnapshot(
          decision,
          borrowed.repositoryBinding,
        )?.snapshot.operations[0];
        assert.ok(
          decisionOperation?.kind === "runtime_repair" &&
            decisionOperation.disposal,
        );
        const rejected = worker.write(
          f.capability,
          id,
          {
            expected: repairVersion(original, borrowed.repositoryBinding),
            change: {
              kind: "disposal_progress",
              purpose: "primary",
              checkpoint: decisionOperation.disposal.checkpoint,
            },
          },
          () => true,
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
      const saved = stateStore.saveRepairRecord(
        f.capability,
        id,
        {
          expected: repairVersion(original, borrowed.repositoryBinding),
          change: {
            kind: "disposal_decision",
            decidedAt: "2026-10-17T00:00:00.000Z",
          },
        },
        () => true,
      );
      assert.equal(saved.status, "completed");
      assert.equal(saved.snapshotConfirmed, true);
      assert.equal(saved.lockReleased, true);
      let before = decision;
      for (const purpose of ["primary", "failed", "auxiliary"] as const) {
        const value = decodeStateSnapshot(before, borrowed.repositoryBinding);
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
        const next = prepareStateRepairDisposalProgressSnapshot(
          before,
          id,
          purpose,
          nextCheckpoint,
          borrowed.repositoryBinding,
        );
        assert.ok(next);
        const writePurpose = `disposal_${purpose}` as const;
        assert.equal(
          classifyRepairPublication(
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
          const refused = stateStore.saveRepairRecord(
            f.capability,
            id,
            {
              expected: repairVersion(before, borrowed.repositoryBinding),
              change: {
                kind: wrong,
                candidate: next,
              },
            } as unknown as model.RepairSaveRequest,
            () => true,
          );
          assert.equal(refused.snapshotConfirmed, false);
          assert.equal(refused.filesystemEffectIssued, false);
        }
        const rename = fs.renameSync;
        let cut = 0;
        const renameHook = t.mock.method(
          fs,
          "renameSync",
          (from: fs.PathLike, to: fs.PathLike) => {
            if (purpose === "primary" && to === stateFile && cut === 0) {
              cut++;
              throw new Error("synthetic_disposal_before_rename");
            }
            const value = rename(from, to);
            if (purpose === "failed" && to === stateFile && cut === 0) {
              cut++;
              throw new Error("synthetic_disposal_after_rename");
            }
            return value;
          },
        );
        try {
          const written = stateStore.saveRepairRecord(
            f.capability,
            id,
            {
              expected: repairVersion(before, borrowed.repositoryBinding),
              change: {
                kind: "disposal_progress",
                purpose,
                checkpoint: nextCheckpoint,
              },
            },
            () => true,
          );
          assert.equal(written.snapshotConfirmed, purpose === "auxiliary");
          assert.equal(written.filesystemEffectIssued, true);
          assert.equal(written.lockReleased, true);
        } finally {
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
          const cleaned = stateStore.readState(f.capability, {
            scope: "recovery",
            input: { kind: "history" },
          });
          assert.equal(cleaned.status, "completed");
          assert.ok(cleaned.value);
        }
        assert.ok(fs.readFileSync(stateFile).equals(next));
        assert.equal(fs.existsSync(marker), false);
        assert.equal(fs.existsSync(pending), false);
        const noOpCandidate = prepareStateRepairDisposalProgressSnapshot(
          next,
          id,
          purpose,
          nextCheckpoint,
          borrowed.repositoryBinding,
        );
        assert.ok(noOpCandidate);
        assert.ok(noOpCandidate.equals(next));
        const identityBefore = fs.lstatSync(stateFile, { bigint: true });
        const lockDirectory = path.join(
          borrowed.repositoryRoot,
          ".crdd",
          "lock",
        );
        const lockPath = path.join(lockDirectory, "execution-model.state.lock");
        const lockParent = path.join(borrowed.repositoryRoot, ".crdd");
        assert.equal(fs.lstatSync(lockParent).isDirectory(), true);
        assert.equal(fs.lstatSync(lockParent).isSymbolicLink(), false);
        assert.equal(fs.lstatSync(lockDirectory).isDirectory(), true);
        assert.equal(fs.lstatSync(lockDirectory).isSymbolicLink(), false);
        assert.equal(fs.existsSync(lockPath), false);
        const lockDescriptors = new Set<number>();
        const open = fs.openSync;
        const close = fs.closeSync;
        const write = fs.writeFileSync;
        const mkdir = fs.mkdirSync;
        const remove = fs.rmSync;
        let lockWrites = 0;
        let lockRemovals = 0;
        let mutations = 0;
        const mutationHooks = [
          "renameSync",
          "unlinkSync",
          "rmdirSync",
        ] as const;
        const denied = () => {
          mutations++;
          throw new Error("no_op_must_not_write");
        };
        const opened = t.mock.method(
          fs,
          "openSync",
          (target: fs.PathLike, flags: fs.OpenMode, mode?: fs.Mode) => {
            const lockCreation = String(target) === lockPath && flags === "wx";
            if (
              !lockCreation &&
              flags !== "r" &&
              flags !== "rs" &&
              flags !== "sr" &&
              flags !== fs.constants.O_RDONLY
            )
              return denied();
            const descriptor = open(target, flags, mode);
            if (lockCreation) lockDescriptors.add(descriptor);
            return descriptor;
          },
        );
        const closed = t.mock.method(fs, "closeSync", (descriptor: number) => {
          lockDescriptors.delete(descriptor);
          return close(descriptor);
        });
        const written = t.mock.method(
          fs,
          "writeFileSync",
          (
            target: fs.PathOrFileDescriptor,
            data: string | NodeJS.ArrayBufferView,
            options?: fs.WriteFileOptions,
          ) => {
            if (typeof target !== "number" || !lockDescriptors.has(target))
              return denied();
            lockWrites++;
            return write(target, data, options);
          },
        );
        const created = t.mock.method(
          fs,
          "mkdirSync",
          (
            target: fs.PathLike,
            options?: fs.MakeDirectoryOptions | fs.Mode,
          ) => {
            if (
              String(target) !== lockDirectory &&
              String(target) !== lockParent
            )
              return denied();
            return mkdir(target, options);
          },
        );
        const removed = t.mock.method(
          fs,
          "rmSync",
          (target: fs.PathLike, options?: fs.RmOptions) => {
            if (String(target) !== lockPath) return denied();
            lockRemovals++;
            return remove(target, options);
          },
        );
        const hooks = mutationHooks.map((name) =>
          t.mock.method(fs, name, () => {
            return denied();
          }),
        );
        try {
          const same = stateStore.saveRepairRecord(
            f.capability,
            id,
            {
              expected: repairVersion(next, borrowed.repositoryBinding),
              change: {
                kind: "disposal_progress",
                purpose,
                checkpoint: nextCheckpoint,
              },
            },
            () => true,
          );
          assert.equal(same.status, "completed");
          assert.equal(same.snapshotConfirmed, true);
          assert.equal(same.filesystemEffectIssued, false);
          assert.equal(same.lockReleased, true);
          assert.equal(
            same.revision,
            decodeStateSnapshot(next, borrowed.repositoryBinding)?.snapshot
              .revision,
          );
          assert.equal(mutations, 0);
          assert.ok(lockWrites > 0);
          assert.ok(lockRemovals > 0);
        } finally {
          for (const hook of hooks.reverse()) hook.mock.restore();
          removed.mock.restore();
          created.mock.restore();
          written.mock.restore();
          closed.mock.restore();
          opened.mock.restore();
        }
        assert.equal(fs.existsSync(lockPath), false);
        assert.equal(fs.existsSync(pending), false);
        assert.equal(fs.existsSync(marker), false);
        const identityAfter = fs.lstatSync(stateFile, { bigint: true });
        assert.equal(identityAfter.ino, identityBefore.ino);
        assert.equal(identityAfter.mtimeNs, identityBefore.mtimeNs);
        assert.ok(fs.readFileSync(stateFile).equals(next));
        for (const entry of ["state.pending.json", "state.lock", "unknown"]) {
          fs.writeFileSync(path.join(directory, entry), "invalid");
          try {
            const rejected = stateStore.saveRepairRecord(
              f.capability,
              id,
              {
                expected: repairVersion(next, borrowed.repositoryBinding),
                change: {
                  kind: "disposal_progress",
                  purpose,
                  checkpoint: nextCheckpoint,
                },
              },
              () => true,
            );
            assert.equal(rejected.snapshotConfirmed, false);
            assert.equal(rejected.filesystemEffectIssued, false);
          } finally {
            fs.unlinkSync(path.join(directory, entry));
          }
        }
        before = next;
      }
      const final = decodeStateSnapshot(before, borrowed.repositoryBinding)
        ?.snapshot.operations[0];
      const first = decodeStateSnapshot(original, borrowed.repositoryBinding)
        ?.snapshot.operations[0];
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
    const initialHistory = prepareRepairHistorySnapshot(
      original,
      id,
      at,
      false,
      repository.repositoryBinding,
    );
    assert.ok(initialHistory);
    const confirmed = prepareRepairHistorySnapshot(
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
          let contexts = 0;
          const writer = stateStoreSource(
            (source) => {
              const guard =
                /target\.summarySha256 !== \(previousTarget\?\.summarySha256 \?\? null\) \|\|\s*encodeStateValue\(target\.history\) !==\s*encodeStateValue\(previousTarget\?\.history \?\? null\) \|\|/u;
              assert.equal(source.match(guard)?.length, 1);
              return (
                bypassOuter ? source.replace(guard, "") : source
              ).replaceAll(
                "settlements.set(context, binding);",
                "contextProbe(); settlements.set(context, binding);",
              );
            },
            {
              contextProbe: () => contexts++,
              prepareStateRepairCheckpointSnapshot: () => candidate,
            },
          ).write;
          const target = decodeStateSnapshot(
            before,
            repository.repositoryBinding,
          )?.snapshot.operations.find((item) => item.recoveryId === id);
          assert.ok(target?.kind === "runtime_repair");
          reads = 0;
          const blocked = writer(
            f.capability,
            id,
            {
              expected: repairVersion(before, repository.repositoryBinding),
              change: {
                kind: "checkpoint",
                update: {
                  phase: target.phase,
                  checkpoint: target.checkpoint,
                  disposition: target.disposition,
                  primaryFailure: target.primaryFailure,
                  outcome: target.outcome,
                },
              },
            },
            () => true,
          );
          assert.equal(blocked.status, "blocked");
          assert.equal(blocked.filesystemEffectIssued, false);
          assert.equal(blocked.lockReleased, true);
          assert.equal(
            contexts > 0,
            bypassOuter,
            "inner_writer_must_be_reached",
          );
          assert.ok(reads > 0, "expected版は候補生成前にfresh観測する");
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
    stateStore.readState(f.capability, {
      scope: "recovery",
      input: {
        kind: "execution_history",
        recoveryId: id,
      },
    }).status,
    "blocked",
  );
  const taskResult = stateStore.saveRecoveryHistory(
    repository,
    id,
    () => true,
    "docker_task",
  );
  assert.equal(taskResult.status, "blocked");
  assert.ok(fs.readFileSync(stateFile).equals(original));
  const first = stateStoreSource((source) => source);
  const observed = first.readHistory(historyInput, id);
  assert.equal(observed.status, "completed");
  assert.equal(observed.currentHistoryPublication?.stage, "checkpoint");
  assert.equal(
    observed.currentHistoryPublication?.operationKind,
    "runtime_repair",
  );
  const fixed = first.saveRecoveryHistory(
    repository,
    id,
    () =>
      !JSON.parse(fs.readFileSync(stateFile, "utf8")).operations.some(
        (item: { recoveryId: string; history: unknown }) =>
          item.recoveryId === id && item.history !== null,
      ),
    "runtime_repair",
  );
  assert.equal(fixed.status, "blocked");
  assert.equal(fixed.historyConfirmed, false);
  assert.equal(fixed.lockReleased, true);
  const checkpointBytes = fs.readFileSync(stateFile);
  const checkpoint = decodeStateSnapshot(
    checkpointBytes,
    repository.repositoryBinding,
  );
  const fixedOperation = checkpoint?.snapshot.operations.find(
    (item) => item.recoveryId === id,
  );
  assert.ok(fixedOperation?.history && !fixedOperation.history.confirmed);
  const second = stateStoreSource((source) => source);
  assert.equal(
    second.readHistory(historyInput, id).currentHistoryPublication?.stage,
    "publish",
  );
  const published = second.saveRecoveryHistory(
    repository,
    id,
    () => true,
    "runtime_repair",
  );
  assert.equal(published.status, "completed");
  assert.equal(published.historyConfirmed, true);
  assert.equal(published.lockReleased, true);
  const currentBytes = fs.readFileSync(stateFile);
  const current = decodeStateSnapshot(
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
  const rows = decodeHistoryRows(historyBytes);
  assert.equal(rows?.length, 1);
  assert.equal(rows?.[0]?.recoveryId, id);
  await t.test("終了ReaderとWriterは履歴欠測を独立に拒否する", () => {
    const original = currentBytes;
    const candidate = prepareStateRepairCompletionSnapshot(
      original,
      id,
      repository.repositoryBinding,
    );
    assert.ok(candidate);
    const row = JSON.parse(historyBytes.toString("utf8"));
    row.summary.operationNonce = "9".repeat(64);
    row.summary.recoveryId = `docker-runtime-repair.${row.summary.operationNonce}.${row.summary.identitySha256}`;
    const otherHistory = Buffer.from(`${encodeStateValue(row)}\n`);
    assert.equal(decodeHistoryRows(otherHistory)?.length, 1);
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
    const writerRefused = readerRelaxed.completeRecovery(
      f.capability,
      id,
      () => true,
      "runtime_repair",
    );
    assert.equal(writerRefused.status, "blocked");
    assert.equal(writerRefused.filesystemEffectIssued, false);
    assert.ok(fs.readFileSync(stateFile).equals(original));
    const writerRelaxed = stateStoreSource((source) => {
      assert.equal(source.split(writerNeedle).length, 2);
      return source
        .replace(readerNeedle, "false")
        .replace(writerNeedle, "false");
    });
    const bypass = writerRelaxed.completeRecovery(
      f.capability,
      id,
      () => true,
      "runtime_repair",
    );
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
        const bytes = Buffer.from(`${encodeStateValue(row)}\n`);
        assert.equal(decodeHistoryRows(bytes)?.length, 1);
        fs.writeFileSync(historyFile, bytes);
      }
      const read = stateStoreSource((source) => source).readHistory(
        historyInput,
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
  const confirmed = third.saveRecoveryHistory(
    repository,
    id,
    () => true,
    "runtime_repair",
  );
  assert.equal(confirmed.status, "completed");
  assert.equal(confirmed.filesystemEffectIssued, false);
  assert.equal(confirmed.historyConfirmed, true);
  assert.ok(fs.readFileSync(stateFile).equals(currentBytes));
  assert.ok(fs.readFileSync(historyFile).equals(historyBytes));
  const directory = path.dirname(stateFile);
  fs.writeFileSync(stateFile, checkpointBytes);
  fs.writeFileSync(historyFile, historyBytes);
  const ownerRefused = stateStoreSource((source) => source).saveRecoveryHistory(
    repository,
    id,
    () => false,
    "runtime_repair",
  );
  assert.equal(ownerRefused.status, "blocked");
  assert.equal(ownerRefused.filesystemEffectIssued, false);
  const wrongOperation = stateStoreSource(
    (source) => source,
  ).saveRecoveryHistory(
    { ...repository, operationId: "OP-999999" },
    id,
    () => true,
    "runtime_repair",
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
        readStableFileSnapshot: (
          ...args: Parameters<typeof fileObservation.readStableFileSnapshot>
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
          return fileObservation.readStableFileSnapshot(...args);
        },
        acquireExecutionStateLock: (
          ...args: Parameters<typeof kernel.acquireExecutionStateLock>
        ) => {
          const lock = kernel.acquireExecutionStateLock(...args);
          locks++;
          if (lock.status === "acquired" && locks === 2) {
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
                lock: {
                  ...lock.lock,
                  release: () => {
                    assert.equal(lock.lock.release(), true);
                    hit++;
                    return false;
                  },
                },
              };
          }
          return lock;
        },
      });
      try {
        const failed = worker.saveRecoveryHistory(
          repository,
          id,
          () => ownerLive,
          "runtime_repair",
        );
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
          let expectedConfirmed: Buffer = currentBytes;
          if (startsCheckpoint) {
            const captured = fs.readFileSync(
              fault === "checkpoint_before"
                ? path.join(directory, "state.pending.json")
                : stateFile,
            );
            const capturedState = decodeStateSnapshot(
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
            const rebuilt = prepareRepairHistorySnapshot(
              original,
              id,
              capturedOperation.history.occurredAt,
              false,
              repository.repositoryBinding,
            );
            assert.ok(rebuilt && captured.equals(rebuilt));
            const rebuiltConfirmed = prepareRepairHistorySnapshot(
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
          const resumed = fresh.saveRecoveryHistory(
            repository,
            id,
            () => true,
            "runtime_repair",
          );
          assert.equal(resumed.status, "completed");
          assert.equal(resumed.lockReleased, true);
          assert.equal(resumed.historyConfirmed, true);
          assert.ok(fs.readFileSync(stateFile).equals(expectedConfirmed));
          {
            const expectedLine = prepareRepairHistoryLine(
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
            ? /currentHistory\.operationKind === "runtime_repair"\s*\? prepareRepairHistorySnapshot/u
            : mutant === "publish_kind" || mutant === "physical_publish_kind"
              ? /currentHistory\.operationKind === "runtime_repair"\s*\? prepareRepairHistoryPublication/gu
              : /currentHistory\?\.operationKind === "runtime_repair"\s*\? prepareRepairHistoryLine/gu;
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
      const rejected = changed.saveRecoveryHistory(
        repository,
        id,
        () => true,
        "runtime_repair",
      );
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
      schema: "crdd-coordinator/operation-identity/v4",
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
      repositoryBinding: repository.repositoryBinding,
      ownershipLabel: "crdd.coordinator.runtime=0123456789abcdef",
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
    const taskBytes = prepareStateOperationSnapshot(
      null,
      `${JSON.stringify(taskIdentity)}\n`,
      repository.repositoryBinding,
    );
    assert.ok(taskBytes);
    const task = decodeStateSnapshot(taskBytes, repository.repositoryBinding)
      ?.snapshot.operations[0];
    assert.ok(task?.kind === "docker_task");
    const otherBytes = prepareStateRepairSnapshot(
      null,
      `${JSON.stringify({ ...JSON.parse(operation.identityJson), operationNonce: "f".repeat(64), operationId: "OP-999998" })}\n`,
      repository.repositoryBinding,
    );
    assert.ok(otherBytes);
    const other = decodeStateSnapshot(otherBytes, repository.repositoryBinding)
      ?.snapshot.operations[0];
    assert.ok(other?.kind === "runtime_repair");
    assert.ok(decoded);
    const mixed = {
      ...decoded.snapshot,
      operations: [
        operation,
        {
          ...other,
          phase: "terminal",
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
    };
    const mixedBytes = Buffer.from(`${encodeStateValue(mixed)}\n`);
    assert.ok(decodeStateSnapshot(mixedBytes, repository.repositoryBinding));
    if (fs.existsSync(historyFile)) fs.unlinkSync(historyFile);
    fs.writeFileSync(stateFile, mixedBytes);
    for (const repeated of [false, true]) {
      const saved = stateStoreSource((source) => source).saveRecoveryHistory(
        repository,
        id,
        () => true,
        "runtime_repair",
      );
      assert.equal(saved.status, "completed");
      assert.equal(saved.historyConfirmed, true);
      assert.equal(saved.filesystemEffectIssued, !repeated);
      const after = decodeStateSnapshot(
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
      assert.equal(Object.hasOwn(after.snapshot, "pendingDeliveries"), false);
      assert.equal(Object.hasOwn(mixed, "pendingDeliveries"), false);
    }
  });
  fs.writeFileSync(stateFile, currentBytes);
  fs.writeFileSync(historyFile, Buffer.concat([historyBytes, historyBytes]));
  const blocked = third.saveRecoveryHistory(
    repository,
    id,
    () => true,
    "runtime_repair",
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.filesystemEffectIssued, false);
  assert.ok(fs.readFileSync(stateFile).equals(currentBytes));
  for (const mutant of [false, true]) {
    let locks = 0;
    const fallbackProbe = stateStoreSource(
      (source) => {
        if (!mutant) return source;
        const target =
          "const publication = observed.currentHistoryPublication;";
        assert.equal(source.split(target).length, 2);
        // 現行入口には旧fallbackがないため、不正なTask再読を変異として導入する。
        return source.replace(
          target,
          `if (observed.status !== "completed") {
            readStateSnapshot(repository, recoveryId, null, recoveryId, null, "docker_task");
          }
          ${target}`,
        );
      },
      {
        acquireExecutionStateLock: (
          ...args: Parameters<typeof kernel.acquireExecutionStateLock>
        ) => {
          locks++;
          return kernel.acquireExecutionStateLock(...args);
        },
      },
    );
    const refused = fallbackProbe.saveRecoveryHistory(
      repository,
      id,
      () => true,
      "runtime_repair",
    );
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

/**
 * 修復値の全field母集団を、他Ownerのdecoderではなく独立した受理表へ照合する。
 * @responsibility 欠測・余剰・置換・実行Propertyの拒否と合法な置換の出力を区別する。
 * @trace ERB-IT-014
 * @precondition 固定4profileは非秘密の期待DTOとして構成し、実装から生成しない。
 * @stimulus 全Objectパスと全fieldへ元の15置換値・欠測・getter・Proxyを与える。
 * @observation 受理値・凍結・独立参照とhook未評価。
 * @oracle profile別literal表の受理時だけ入力と同じDTO、その他はnull。
 * @cleanup 値のみ。Process・File・Docker・保存を使わない。
 * @boundary EM保存モデルの値契約。保存や実処置の成立は主張しない。
 */
test("修復保存codecは全field母集団を独立期待値で検証する", () => {
  const actionNames = [
    "stop_runtime",
    "stop_backend",
    "retain_runtime",
    "start_runtime",
    "stop_failed_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
    "restart_runtime",
  ] as const;
  const purposes = ["primary", "failed", "auxiliary"] as const;
  const checkpoint = (continuation: boolean) => ({
    actions: Object.fromEntries(
      actionNames.map((name, index) => [
        name,
        continuation && (index === 2 || index === 3)
          ? { intent: "saved", request: "issued", result: "confirmed" }
          : {
              intent: "not_saved",
              request: "not_issued",
              result: continuation && index < 4 ? "not_required" : "unobserved",
            },
      ]),
    ),
    directories: Object.fromEntries(
      purposes.map((name) => [
        name,
        {
          expected:
            continuation && name === "primary"
              ? { dev: "1", ino: "4", birthtimeNs: "3" }
              : null,
          source: { state: "absent", identity: null },
          retained:
            continuation && name === "primary"
              ? {
                  state: "present",
                  identity: { dev: "1", ino: "4", birthtimeNs: "3" },
                }
              : { state: "absent", identity: null },
        },
      ]),
    ),
    engine: "unavailable",
    stale: continuation ? "retained" : "absent",
    hostSafety: "safe",
    cleanup: "pending",
    cleanupFailure: null,
  });
  const profiles = [
    {
      decode: storedContract.decodeEnvironmentRepairCheckpoint,
      base: checkpoint(false),
      kind: "initial",
    },
    {
      decode: storedContract.decodeEnvironmentRepairCheckpoint,
      base: checkpoint(true),
      kind: "continuation",
    },
    {
      decode: storedContract.decodeEnvironmentRepairDisposalCheckpoint,
      base: {
        directories: Object.fromEntries(
          purposes.map((name) => [
            name,
            {
              intent: "not_saved",
              request: "not_issued",
              absence: "unobserved",
            },
          ]),
        ),
      },
      kind: "disposal",
    },
    {
      decode: storedContract.decodeEnvironmentRepairRetentionTargets,
      base: {
        primary: { dev: "1", ino: "2", birthtimeNs: "3" },
        failed: null,
        auxiliary: null,
      },
      kind: "targets",
    },
  ] as const;
  const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
  const frozen = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    assert.equal(Object.isFrozen(value), true);
    for (const child of Object.values(value)) frozen(child);
  };
  const corpus: string[] = [];
  for (const profile of profiles) {
    const { decode, base, kind } = profile;
    const allowed = new Map<string, readonly unknown[]>();
    const allow = (field: string, ...values: unknown[]) =>
      allowed.set(field, values);
    if (kind === "initial" || kind === "continuation") {
      allow("engine", "unknown", "ready");
      if (kind === "initial") allow("stale", "absent");
      allow("hostSafety", "unknown");
      allow("cleanup", "pending", "confirmed", "unknown");
      allow("cleanupFailure", null);
      for (const [index, name] of actionNames.entries()) {
        if (index === 0 || (kind === "continuation" && index <= 4))
          allow("actions." + name + ".intent", "saved");
        if (kind === "continuation" && (index === 2 || index === 3)) {
          allow("actions." + name + ".request", "issued");
          // 後処置start_runtimeがsavedの継続profileでは、先行retainの未確定化は不正。
          allow(
            "actions." + name + ".result",
            ...(index === 2 ? ["confirmed"] : ["unknown", "confirmed"]),
          );
        }
      }
      for (const purpose of purposes) {
        const prefix = "directories." + purpose;
        const retained = kind === "continuation" && purpose === "primary";
        if (!retained) {
          allow(prefix + ".expected", null);
          allow(prefix + ".retained.identity", null);
        }
        allow(prefix + ".source.identity", null);
        allow(
          prefix + ".source.state",
          ...(retained ? ["absent"] : ["unknown", "absent"]),
        );
        allow(
          prefix + ".retained.state",
          ...(retained
            ? ["present"]
            : kind === "continuation"
              ? ["unknown", "absent"]
              : ["absent"]),
        );
      }
    } else if (kind === "disposal") {
      for (const purpose of purposes)
        allow("directories." + purpose + ".intent", "saved");
    } else {
      for (const purpose of purposes) allow(purpose, null);
    }
    const check = (value: unknown, expected: unknown = null) => {
      const actual = decode(value);
      assert.deepEqual(actual, expected, kind + ":" + corpus.at(-1));
      frozen(actual);
      if (actual && value && typeof value === "object")
        assert.notEqual(actual, value);
      return actual;
    };
    check(base, base);
    for (const [index, value] of [
      null,
      undefined,
      false,
      0,
      "unknown",
      [],
      {},
      new Proxy(
        {},
        {
          get() {
            throw Error("proxy_read");
          },
        },
      ),
    ].entries()) {
      corpus.push(kind + ":root:" + index);
      check(value);
    }
    const paths: string[][] = [[]];
    for (let index = 0; index < paths.length; index++) {
      let object: unknown = base;
      for (const key of paths[index] ?? [])
        object = (object as Record<string, unknown>)[key];
      if (!object || typeof object !== "object") continue;
      for (const key of Object.keys(object)) {
        const value = (object as Record<string, unknown>)[key];
        if (value && typeof value === "object")
          paths.push([...(paths[index] ?? []), key]);
      }
    }
    for (const at of paths) {
      const mutate = (change: (record: Record<string, unknown>) => void) => {
        const value = copy(base);
        let record: unknown = value;
        for (const key of at) record = (record as Record<string, unknown>)[key];
        change(record as Record<string, unknown>);
        return value;
      };
      corpus.push(kind + ":" + at.join(".") + ":extra");
      check(
        mutate((record) => {
          record.unexpected = true;
        }),
      );
      let original: unknown = base;
      for (const key of at)
        original = (original as Record<string, unknown>)[key];
      for (const key of Object.keys(original as object)) {
        const field = [...at, key].join(".");
        corpus.push(kind + ":" + field + ":missing");
        check(
          mutate((record) => {
            delete record[key];
          }),
        );
        for (const [index, invalid] of [
          undefined,
          null,
          false,
          0,
          "invalid",
          [],
          {},
          "saved",
          "issued",
          "unknown",
          "confirmed",
          "pending",
          "ready",
          "absent",
          "present",
        ].entries()) {
          corpus.push(kind + ":" + field + ":replace:" + index);
          const value = mutate((record) => {
            record[key] = invalid;
          });
          check(
            value,
            allowed.get(field)?.some((v) => Object.is(v, invalid))
              ? value
              : null,
          );
        }
        let reads = 0;
        corpus.push(kind + ":" + field + ":getter");
        check(
          mutate((record) => {
            Object.defineProperty(record, key, {
              enumerable: true,
              get() {
                reads++;
                throw Error("accessor_read");
              },
            });
          }),
        );
        assert.equal(reads, 0);
        corpus.push(kind + ":" + field + ":proxy");
        check(
          mutate((record) => {
            record[key] = new Proxy(
              {},
              {
                get() {
                  reads++;
                  throw Error("proxy_read");
                },
              },
            );
          }),
        );
        assert.equal(reads, 0);
      }
    }
    const mutable = copy(base),
      observed = check(mutable, base);
    (mutable as Record<string, unknown>).unexpected = true;
    assert.deepEqual(observed, base);
  }
  assert.equal(
    createHash("sha256").update(corpus.join("\n")).digest("hex"),
    "e9026a98858c8e37c2b5ad75758fe1e47ff780bed21b6785acc84269008ab30c",
  );
});

/**
 * 保存モデルの通知辺・終端・新Session準備を独立した状態列で確認する。
 * @responsibility 各slotの意図→発行→確定と回収巻戻し拒否をDIなしで反証する。
 * @trace ERB-IT-014
 * @precondition 前slotは明示不要、後slotは未観測の固定DTOを使う。
 * @stimulus 八slotの三段階、回収済み状態と三用途の不正な初回進捗。
 * @observation 復号値、遷移・終端・Session候補の結果。
 * @oracle 各合法辺はtrue、処置終端は最終slot確定後のみ。新Sessionだけcleanupをpendingへ戻す。
 * @cleanup メモリ値のみ。DI・保存・外部Processを使用しない。
 * @boundary EM自身の保存値契約。
 */
test("修復保存値の八処置辺・終端・Sessionと廃棄条件を独立検証する", () => {
  const actions = [
    "stop_runtime",
    "stop_backend",
    "retain_runtime",
    "start_runtime",
    "stop_failed_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
    "restart_runtime",
  ] as const;
  const purposes = ["primary", "failed", "auxiliary"] as const;
  for (const [index, action] of actions.entries()) {
    const raw = {
      actions: Object.fromEntries(
        actions.map((name, position) => [
          name,
          {
            intent: "not_saved",
            request: "not_issued",
            result: position < index ? "not_required" : "unobserved",
          },
        ]),
      ),
      directories: Object.fromEntries(
        purposes.map((name) => [
          name,
          {
            expected: null,
            source: { state: "absent", identity: null },
            retained: { state: "absent", identity: null },
          },
        ]),
      ),
      engine: "unavailable",
      stale: "absent",
      hostSafety: "safe",
      cleanup: "pending",
      cleanupFailure: null,
    };
    let previous = storedContract.decodeEnvironmentRepairCheckpoint(raw);
    assert.ok(previous);
    assert.deepEqual(previous, raw);
    for (const state of [
      { intent: "saved", request: "not_issued", result: "unobserved" },
      { intent: "saved", request: "issued", result: "unobserved" },
      { intent: "saved", request: "issued", result: "confirmed" },
    ]) {
      const expected = JSON.parse(JSON.stringify(previous));
      Object.assign(expected.actions[action], state);
      if (state.result === "confirmed" && action.startsWith("retain_")) {
        const purpose =
          action === "retain_runtime"
            ? "primary"
            : action === "retain_failed_runtime"
              ? "failed"
              : "auxiliary";
        const identity = { dev: "1", ino: String(index + 1), birthtimeNs: "3" };
        expected.directories[purpose] = {
          expected: identity,
          source: { state: "absent", identity: null },
          retained: { state: "present", identity },
        };
        expected.stale = "retained";
      }
      const next = storedContract.decodeEnvironmentRepairCheckpoint(expected);
      assert.ok(next);
      assert.deepEqual(next, expected);
      assert.equal(
        storedContract.validateEnvironmentRepairCheckpointTransition(
          previous,
          next,
        ),
        true,
      );
      assert.equal(
        storedContract.isRepairCheckpointSettled(next),
        index === 7 && state.result === "confirmed",
      );
      assert.equal(
        storedContract.prepareEnvironmentRepairSessionCheckpoint(next),
        null,
      );
      previous = next;
    }
    const completed = { ...previous, cleanup: "confirmed" };
    const fresh = { ...completed, cleanup: "pending" };
    assert.deepEqual(
      storedContract.prepareEnvironmentRepairSessionCheckpoint(completed),
      fresh,
    );
    assert.equal(
      storedContract.validateEnvironmentRepairCheckpointTransition(
        completed,
        fresh,
      ),
      false,
    );
  }
  const disposal = {
    directories: Object.fromEntries(
      purposes.map((name) => [
        name,
        { intent: "not_saved", request: "not_issued", absence: "unobserved" },
      ]),
    ),
  };
  for (const purpose of purposes)
    for (const request of ["not_issued", "issued", "unknown"] as const) {
      const next = JSON.parse(JSON.stringify(disposal));
      Object.assign(next.directories[purpose], {
        intent: "saved",
        request,
        absence: "unknown",
      });
      assert.equal(
        storedContract.validateEnvironmentRepairDisposalTransition(
          disposal,
          next,
          purpose,
        ),
        false,
      );
      assert.equal(storedContract.isRepairDisposalSettled(next), false);
    }
});

import {
  classifyRepairPublication,
  prepareStateRepairCheckpointSnapshot,
  prepareStateRepairCompletionSnapshot,
  prepareStateRepairDisposalDecisionSnapshot,
  prepareStateRepairDisposalProgressSnapshot,
  prepareStateRepairSessionSnapshot,
  prepareStateRepairSnapshot,
} from "../../src/state/validation.ts";

/**
 * 修復専用保存の公開Root・CAS・Session境界を実Filesystemで検査する。
 * @responsibility 偽TaskやCoordinatorの実行制御を使わずEM Writer自身の非対象保全を反証する。
 * @trace ERB-IT-014
 * @precondition 自己生成Git Rootと固定修復値。
 * @stimulus Root偽造、Owner失効、元版差、Session誤用途と部分初期化。
 * @observation 実保存本文・改訂・元Hash・一時File。
 * @oracle 元の全assertionと故障窓を維持し保存拒否を成功化しない。
 * @cleanup 既存Directory OwnerをGit初期化前に終了hookへ結合する。
 * @boundary EM公開Writerと実Filesystem。実Docker・AI・Co実行なし。
 */
test("Host Windows: 修復専用Ownerは偽Taskなしで同じ状態Writerを使う", (t) => {
  const directoryOwner = createRepositoryTestDirectory("repair-state-");
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
      "fixture",
    ],
    { windowsHide: true },
  );
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("root unavailable");
  const repository = kernel.observeExecutionRecoveryRepository(
    verified.capability,
  );
  assert.ok(repository);
  const identity = {
    schema: "crdd-coordinator/runtime-repair-identity/v2",
    kind: "runtime_repair",
    operationNonce: "a".repeat(64),
    operationId: "OP-123456",
    repositoryBinding: repository.repositoryBinding,
    consumer: "coordinator_cli",
  };
  const first = prepareStateRepairSnapshot(
    null,
    `${JSON.stringify(identity)}\n`,
    repository.repositoryBinding,
  );
  assert.ok(first);
  const initial = decodeStateSnapshot(first, repository.repositoryBinding);
  assert.ok(initial);
  const recoveryId = initial.snapshot.operations[0]?.recoveryId;
  assert.ok(recoveryId);
  // 新Requestの試験データと保存byte oracleを同じ正規fixtureから投影する。
  // 旧Writer引数を受ける互換Adapterや、Model候補生成の代替実装ではない。
  const versionFixture = (fixture: Buffer) => {
    const value = decodeStateSnapshot(fixture, repository.repositoryBinding);
    assert.ok(value);
    return {
      revision: value.snapshot.revision,
      payloadSha256: value.payloadSha256,
    };
  };
  const repairFixture = (
    fixture: Buffer,
    id: string,
    binding = repository.repositoryBinding,
  ) => {
    const value = decodeStateSnapshot(
      fixture,
      binding,
    )?.snapshot.operations.find((operation) => operation.recoveryId === id);
    assert.ok(value?.kind === "runtime_repair");
    return value;
  };
  const checkpointFixture = (fixture: Buffer, id: string) => {
    const value = repairFixture(fixture, id);
    return {
      phase: value.phase,
      checkpoint: value.checkpoint,
      disposition: value.disposition,
      primaryFailure: value.primaryFailure,
      outcome: value.outcome,
    };
  };
  for (const invalidRoot of [{}, { ...verified.capability }]) {
    const rejected = stateStore.saveRepairRecord(
      invalidRoot,
      recoveryId,
      {
        expected: null,
        change: {
          kind: "create",
          identityJson: repairFixture(
            first,
            recoveryId,
            repository.repositoryBinding,
          ).identityJson,
        },
      },
      () => true,
    );
    assert.equal(rejected.filesystemEffectIssued, false);
  }
  assert.equal(
    stateStore.saveRepairRecord(
      verified.capability,
      recoveryId,
      {
        expected: null,
        change: {
          kind: "create",
          identityJson: repairFixture(
            first,
            recoveryId,
            repository.repositoryBinding,
          ).identityJson,
        },
      },
      () => false,
    ).filesystemEffectIssued,
    false,
  );
  assert.equal(fs.existsSync(path.join(root, ".crdd", "domain-model")), false);
  const saved = stateStore.saveRepairRecord(
    verified.capability,
    recoveryId,
    {
      expected: null,
      change: {
        kind: "create",
        identityJson: repairFixture(
          first,
          recoveryId,
          repository.repositoryBinding,
        ).identityJson,
      },
    },
    () => true,
  );
  assert.equal(saved.status, "completed");
  assert.equal(saved.snapshotConfirmed, true);
  assert.equal(saved.lockReleased, true);
  assert.equal(saved.value?.checkpointSettled, false);
  const observedOperation = domain.readState(verified.capability, {
    scope: "recovery",
  });
  assert.ok(observedOperation.value);
  const observedState = observedOperation.value.operationStates[0];
  assert.equal(observedState?.kind, "runtime_repair");
  assert.equal(
    observedState?.operation,
    observedOperation.value.snapshot.operations[0],
  );
  assert.equal(Object.isFrozen(observedOperation.value.operationStates), true);
  assert.equal(Object.isFrozen(observedState), true);
  if (observedState?.kind !== "runtime_repair")
    throw Error("wrong_operation_kind");
  assert.equal(observedState.disposalSettled, false);
  const directory = path.join(root, ".crdd", "domain-model");
  const state = path.join(directory, "state.json");
  assert.ok(fs.readFileSync(state).equals(first));
  assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  const actionNames = [
    "stop_runtime",
    "stop_backend",
    "retain_runtime",
    "start_runtime",
    "stop_failed_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
    "restart_runtime",
  ];
  const technical = {
    actions: Object.fromEntries(
      actionNames.map((name) => [
        name,
        { intent: "not_saved", request: "not_issued", result: "not_required" },
      ]),
    ),
    directories: Object.fromEntries(
      ["primary", "failed", "auxiliary"].map((name) => [
        name,
        {
          expected: null,
          source: { state: "unobserved", identity: null },
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
  let prepared = prepareStateRepairCheckpointSnapshot(
    first,
    recoveryId,
    {
      phase: "repairing",
      checkpoint: {
        ...technical,
        actions: Object.fromEntries(
          actionNames.map((name) => [
            name,
            {
              intent: "not_saved",
              request: "not_issued",
              result: "unobserved",
            },
          ]),
        ),
        directories: Object.fromEntries(
          ["primary", "failed", "auxiliary"].map((name) => [
            name,
            {
              expected: null,
              source: { state: "unobserved", identity: null },
              retained: { state: "unobserved", identity: null },
            },
          ]),
        ),
        engine: "unobserved",
        stale: "unknown",
        hostSafety: "unknown",
        cleanup: "not_requested",
      },
      disposition: "not_applicable",
      primaryFailure: null,
      outcome: null,
    },
    repository.repositoryBinding,
  );
  assert.ok(prepared);
  assert.equal(
    stateStore.saveRepairRecord(
      verified.capability,
      recoveryId,
      {
        expected: versionFixture(first),
        change: {
          kind: "checkpoint",
          update: checkpointFixture(prepared, recoveryId),
        },
      },
      () => true,
    ).status,
    "completed",
  );
  const beforeSession = decodeStateSnapshot(
    prepared,
    repository.repositoryBinding,
  );
  const repair = beforeSession?.snapshot.operations[0];
  assert.ok(repair?.kind === "runtime_repair" && repair.checkpoint);
  const cleanSession = prepareStateRepairCheckpointSnapshot(
    prepared,
    recoveryId,
    {
      phase: "repairing",
      checkpoint: { ...repair.checkpoint, cleanup: "confirmed" },
      disposition: "not_applicable",
      primaryFailure: null,
      outcome: null,
    },
    repository.repositoryBinding,
  );
  assert.ok(cleanSession);
  assert.equal(
    stateStore.saveRepairRecord(
      verified.capability,
      recoveryId,
      {
        expected: versionFixture(prepared),
        change: {
          kind: "checkpoint",
          update: checkpointFixture(cleanSession, recoveryId),
        },
      },
      () => true,
    ).snapshotConfirmed,
    true,
  );
  const sessionBeginning = prepareStateRepairSessionSnapshot(
    cleanSession,
    recoveryId,
    repository.repositoryBinding,
  );
  assert.ok(sessionBeginning);
  const beginningCheckpoint = repairFixture(
    sessionBeginning,
    recoveryId,
  ).checkpoint;
  assert.ok(beginningCheckpoint);
  const refusedSession = stateStore.saveRepairRecord(
    verified.capability,
    recoveryId,
    {
      expected: versionFixture(cleanSession),
      change: {
        kind: "checkpoint",
        update: checkpointFixture(sessionBeginning, recoveryId),
      },
    },
    () => true,
  );
  assert.equal(refusedSession.filesystemEffectIssued, false);
  assert.equal(refusedSession.snapshotConfirmed, false);
  assert.ok(fs.readFileSync(state).equals(cleanSession));
  const resumed = stateStore.saveRepairRecord(
    verified.capability,
    recoveryId,
    {
      expected: versionFixture(cleanSession),
      change: {
        kind: "session_begin",
        checkpoint: beginningCheckpoint,
      },
    },
    () => true,
  );
  assert.equal(resumed.status, "completed");
  assert.equal(resumed.snapshotConfirmed, true);
  assert.equal(resumed.lockReleased, true);
  assert.ok(fs.readFileSync(state).equals(sessionBeginning));
  assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  const repeated = stateStore.saveRepairRecord(
    verified.capability,
    recoveryId,
    {
      expected: versionFixture(cleanSession),
      change: {
        kind: "session_begin",
        checkpoint: beginningCheckpoint,
      },
    },
    () => true,
  );
  assert.equal(repeated.filesystemEffectIssued, false);
  assert.equal(repeated.snapshotConfirmed, false);
  prepared = sessionBeginning;
  let complete = prepareStateRepairCheckpointSnapshot(
    prepared,
    recoveryId,
    {
      phase: "settling",
      checkpoint: technical,
      disposition: "not_applicable",
      primaryFailure: null,
      outcome: {
        status: "recovered",
        reason: "runtime_repair_recovered",
        cleanupConfirmed: true,
      },
    },
    repository.repositoryBinding,
  );
  assert.ok(complete);
  const failedOwner = stateStore.saveRepairRecord(
    verified.capability,
    recoveryId,
    {
      expected: versionFixture(prepared),
      change: {
        kind: "checkpoint",
        update: checkpointFixture(complete, recoveryId),
      },
    },
    () => false,
  );
  assert.equal(failedOwner.filesystemEffectIssued, false);
  assert.ok(fs.readFileSync(state).equals(prepared));
  const completed = stateStore.saveRepairRecord(
    verified.capability,
    recoveryId,
    {
      expected: versionFixture(prepared),
      change: {
        kind: "checkpoint",
        update: checkpointFixture(complete, recoveryId),
      },
    },
    () => true,
  );
  assert.equal(completed.status, "completed");
  assert.equal(completed.lockReleased, true);
  const stale = stateStore.saveRepairRecord(
    verified.capability,
    recoveryId,
    {
      expected: versionFixture(first),
      change: {
        kind: "checkpoint",
        update: checkpointFixture(complete, recoveryId),
      },
    },
    () => true,
  );
  assert.equal(stale.status, "blocked");
  assert.equal(stale.filesystemEffectIssued, false);
  // 複数Repairの保全用fixtureだけが既存codecの配送待ち値を用いる。
  // 現在CLIの生成経路ではなく、許可辺を飛び越えない二段保存として扱う。
  const settledValue = decodeStateSnapshot(
    complete,
    repository.repositoryBinding,
  );
  const settledRepair = settledValue?.snapshot.operations.find(
    (item) => item.recoveryId === recoveryId,
  );
  assert.ok(settledValue && settledRepair?.kind === "runtime_repair");
  const deliveredFixture = prepareStateRepairCheckpointSnapshot(
    complete,
    recoveryId,
    {
      phase: "terminal",
      checkpoint: settledRepair.checkpoint,
      disposition: settledRepair.disposition,
      primaryFailure: settledRepair.primaryFailure,
      outcome: settledRepair.outcome,
    },
    repository.repositoryBinding,
  );
  assert.ok(deliveredFixture);
  const deliveryValue = decodeStateSnapshot(
    deliveredFixture,
    repository.repositoryBinding,
  );
  assert.ok(deliveryValue);
  assert.equal(
    deliveryValue.snapshot.revision,
    settledValue.snapshot.revision + 1,
  );
  assert.deepEqual(deliveryValue.snapshot.previous, {
    revision: settledValue.snapshot.revision,
    payloadSha256: settledValue.payloadSha256,
  });
  assert.equal(
    stateStore.saveRepairRecord(
      verified.capability,
      recoveryId,
      {
        expected: versionFixture(complete),
        change: {
          kind: "checkpoint",
          update: checkpointFixture(deliveredFixture, recoveryId),
        },
      },
      () => true,
    ).status,
    "completed",
  );
  complete = deliveredFixture;
  const next = prepareStateRepairSnapshot(
    complete,
    `${JSON.stringify({ ...identity, operationNonce: "d".repeat(64), operationId: "OP-654321" })}\n`,
    repository.repositoryBinding,
  );
  assert.ok(next);
  const nextDecoded = decodeStateSnapshot(next, repository.repositoryBinding);
  assert.ok(nextDecoded);
  const nextId = nextDecoded.snapshot.operations.find(
    (item) => item.recoveryId !== recoveryId,
  )?.recoveryId;
  assert.ok(nextId);
  const added = stateStore.saveRepairRecord(
    verified.capability,
    nextId,
    {
      expected: versionFixture(complete),
      change: {
        kind: "create",
        identityJson: repairFixture(next, nextId, repository.repositoryBinding)
          .identityJson,
      },
    },
    () => true,
  );
  assert.equal(added.status, "completed");
  const observed = decodeStateSnapshot(
    fs.readFileSync(state),
    repository.repositoryBinding,
  );
  const prior = decodeStateSnapshot(complete, repository.repositoryBinding);
  assert.ok(observed && prior);
  assert.equal(
    encodeStateValue(
      observed.snapshot.operations.find(
        (item) => item.recoveryId === recoveryId,
      ),
    ),
    encodeStateValue(prior.snapshot.operations[0]),
  );
  assert.deepEqual(fs.readdirSync(directory), ["state.json"]);
  const failedRoot = path.join(root, "failed-initialization");
  fs.mkdirSync(failedRoot);
  execFileSync("git", ["init", "--quiet", failedRoot], { windowsHide: true });
  execFileSync(
    "git",
    [
      "-C",
      failedRoot,
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
      "fixture",
    ],
    { windowsHide: true },
  );
  const failedVerified = getRepository(failedRoot);
  assert.equal(failedVerified.status, "completed");
  if (failedVerified.status !== "completed")
    throw new Error("root unavailable");
  const failedBinding = kernel.observeExecutionRecoveryRepository(
    failedVerified.capability,
  );
  assert.ok(failedBinding);
  const failedFirst = prepareStateRepairSnapshot(
    null,
    `${JSON.stringify({ ...identity, repositoryBinding: failedBinding.repositoryBinding })}\n`,
    failedBinding.repositoryBinding,
  );
  assert.ok(failedFirst);
  const failedValue = decodeStateSnapshot(
    failedFirst,
    failedBinding.repositoryBinding,
  );
  const failedId = failedValue?.snapshot.operations[0]?.recoveryId;
  assert.ok(failedId);
  const failedDirectory = path.join(failedRoot, ".crdd", "domain-model");
  let sawCreatedArea = false;
  const lost = stateStore.saveRepairRecord(
    failedVerified.capability,
    failedId,
    {
      expected: null,
      change: {
        kind: "create",
        identityJson: repairFixture(
          failedFirst,
          failedId,
          failedBinding.repositoryBinding,
        ).identityJson,
      },
    },
    () => {
      if (!fs.existsSync(failedDirectory)) return true;
      if (!sawCreatedArea) {
        sawCreatedArea = true;
        return true;
      }
      return false;
    },
  );
  assert.equal(lost.status, "blocked");
  assert.equal(lost.reason, "coordinator_state_storage_unconfirmed");
  assert.equal(lost.snapshotConfirmed, false);
  assert.equal(lost.filesystemEffectIssued, true);
  assert.equal(lost.lockReleased, true);
  assert.equal(fs.existsSync(failedDirectory), true);
  assert.deepEqual(fs.readdirSync(failedDirectory), []);
});

import {
  prepareRepairHistoryLine,
  prepareRepairHistorySnapshot,
  prepareStateOperationSnapshot,
} from "../../src/state/validation.ts";

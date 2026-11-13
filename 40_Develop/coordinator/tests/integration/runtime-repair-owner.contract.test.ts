/**
 * 実修復呼出しと既存状態Writerの接続を確認する。
 * @packageDocumentation
 * @responsibility DI Root入口をUsingと模擬Scope・技術境界へ差替え、実Root・Kernel・Filesystem保存を通す。
 * @trace ERB-IT-014
 * @trace ERB-IT-002
 * @level IT
 * @scope 自己生成Repository。実Docker・Provider・認証要求0。
 * @boundary 修復呼出し→実Writer、実DI Runtime／Machine。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test, { mock, type TestContext } from "node:test";
import { isDeepStrictEqual } from "node:util";
import { runInThisContext } from "node:vm";
import * as directoryOperations from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import { runRepairSessionWithDependencies } from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import * as isolation from "../../../docker-isolation/src/index.ts";
import * as model from "../../../execution-model/src/index.ts";
import * as domain from "../../../execution-model/src/index.ts";
import * as stateStore from "../../../execution-model/src/index.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { getRepository } from "../../../version-control/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  observeRepositoryExecutionDataArea,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/configuration/runtime-data.ts";
import * as bindings from "../../src/execution/operation.ts";
import {
  historyRepositoryInput,
  withHistoryRetention,
} from "../../src/execution/persistence.ts";
import { snapshotJsonValue } from "../../src/input/snapshot.ts";
import { canonicalJson } from "../support/contract-assertions.ts";

/**
 * 固定本文の元版を論理保存Requestへ投影する。
 * @responsibility 公開Writerへ完成候補bytesを渡さない。
 * @trace ERB-IT-014
 * @precondition 正規保存本文または初期不存在。
 * @stimulus 元版のrevisionとpayloadHashを読む。
 * @observation expected値。
 * @oracle 保存候補や遷移は生成しない。
 * @cleanup N/A: 値だけ。
 * @boundary 試験fixtureの元版投影。
 */
function repairVersion(bytes: Buffer | null): model.StateVersion | null {
  if (bytes === null) return null;
  return {
    revision: JSON.parse(bytes.toString("utf8")).revision,
    payloadSha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

let acquireCount = 0;
let observeCount = 0;
let stateFile = "";
let delayedCheckpoint:
  | Parameters<typeof directoryOperations.runRepairSession>[0]["onCheckpoint"]
  | null = null;
let lastCheckpoint: model.RepairCheckpoint | null = null;
let lastRuntimeResult: Awaited<
  ReturnType<typeof runRepairSessionWithDependencies>
> | null = null;
let observeMode: "ready" | "incomplete" | "effect_unknown" | "retained" =
  "incomplete";
let runtimeEntries = 0;
let writeCalls = 0;
let lastWriteResult: unknown = null;
let lastOutcomeCheckpoint: Buffer | null = null;
let lastPreOutcomeCheckpoint: Buffer | null = null;
let lastRepairCompletionBefore: Buffer | null = null;
let faultHits = 0;
let faultStage: "none" | "identity" | "checkpoint" | "cleanup" | "outcome" =
  "none";
let faultKind: "reject" | "confirmation" | "release" | "throw" = "reject";
let faultedAt = 0;
let pauseBeforeDisposal = true;
let retentionReads = 0;
let refuseDisposalProgress = false;
const disposalCalls: string[] = [];
const storeModule = {
  namedExports: {
    ...stateStore,
    completeRepair: (...args: Parameters<typeof stateStore.completeRepair>) => {
      lastRepairCompletionBefore = fs.readFileSync(stateFile);
      return stateStore.completeRepair(...args);
    },
    saveRepairState: (
      ...args: Parameters<typeof stateStore.saveRepairState>
    ) => {
      writeCalls++;
      const change = args[2].change;
      if (
        (change.kind === "disposal_decision" && pauseBeforeDisposal) ||
        (change.kind === "disposal_progress" &&
          change.purpose === "primary" &&
          refuseDisposalProgress &&
          change.checkpoint.directories.primary.absence === "confirmed_absent")
      ) {
        if (change.kind === "disposal_progress") refuseDisposalProgress = false;
        return stateStore.saveRepairState(null, args[1], args[2], args[3]);
      }
      const matches =
        faultStage === "identity"
          ? change.kind === "create"
          : faultStage === "checkpoint"
            ? change.kind === "checkpoint" &&
              change.update.checkpoint?.cleanup === "pending"
            : faultStage === "cleanup"
              ? change.kind === "checkpoint" &&
                change.update.checkpoint?.cleanup === "confirmed" &&
                change.update.outcome === null
              : faultStage === "outcome"
                ? change.kind === "checkpoint" && change.update.outcome !== null
                : false;
      if (matches && faultHits === 0) {
        faultHits++;
        faultedAt = writeCalls;
        if (faultKind === "throw") throw new Error("synthetic_writer_failure");
        const rejected = stateStore.saveRepairState(
          null,
          args[1],
          args[2],
          args[3],
        );
        if (faultKind === "reject") return rejected;
        return {
          ...rejected,
          status: "completed",
          snapshotConfirmed: faultKind === "release",
          lockReleased: faultKind !== "release",
        };
      }
      const saved = stateStore.saveRepairState(...args);
      lastWriteResult = saved;
      const target = saved.value?.operation;
      if (
        saved.status === "completed" &&
        saved.snapshotConfirmed &&
        target &&
        target.outcome !== null &&
        target?.history === null
      )
        lastOutcomeCheckpoint = fs.readFileSync(stateFile);
      if (
        saved.status === "completed" &&
        saved.snapshotConfirmed &&
        target &&
        target.outcome === null &&
        target?.checkpoint?.cleanup === "confirmed"
      )
        lastPreOutcomeCheckpoint = fs.readFileSync(stateFile);
      return saved;
    },
  },
};

const isolationModule = {
  namedExports: {
    ...isolation,
    observeRepairDirectories: (
      input: Parameters<typeof directoryOperations.observeRepairDirectories>[0],
    ) => {
      retentionReads++;
      assert.equal(input.canObserve(), true);
      if (input.signal.aborted) return null;
      return {
        primary: input.checkpoint.directories.primary.retained.identity,
        failed: input.checkpoint.directories.failed.retained.identity,
        auxiliary: input.checkpoint.directories.auxiliary.retained.identity,
      };
    },
    cleanupRepairDirectory: async (
      input: import("../../../docker-isolation/src/docker-desktop/repair-session.ts").RepairDisposalInput,
    ) => {
      disposalCalls.push(input.purpose);
      assert.equal(input.canIssueEffect(), true);
      await Promise.resolve();
      assert.equal(input.canIssueEffect(), true);
      return {
        request:
          input.checkpoint.directories[input.purpose].expected === null
            ? "not_issued"
            : "issued",
        absence: "confirmed_absent",
      };
    },
    runRepairSession: (
      input: Parameters<typeof directoryOperations.runRepairSession>[0],
    ) => {
      runtimeEntries++;
      delayedCheckpoint = input.onCheckpoint;
      return runRepairSessionWithDependencies(input, {
        acquire: async () => {
          acquireCount++;
          return {
            cleanupConfirmed: true,
            operations: {
              verify: () => true,
              command: async () => {
                throw new Error("unexpected_effect");
              },
              close: async () => true,
            },
          };
        },
        prepare: async () => ({
          cleanupFailure: () => null,
          technical: {
            observe: async (checkpoint) => {
              observeCount++;
              const current = JSON.parse(fs.readFileSync(stateFile, "utf8"));
              assert.ok(current.revision >= 2);
              assert.equal(current.operations[0].checkpoint.cleanup, "pending");
              assert.equal(
                current.operations[0].identityJson.includes(
                  "ownerBindingSha256",
                ),
                false,
              );
              lastCheckpoint = checkpoint;
              if (observeMode === "incomplete")
                throw new Error("synthetic_observation_unknown");
              const id = { dev: "1", ino: "1", birthtimeNs: "3" };
              return {
                ...checkpoint,
                directories: Object.fromEntries(
                  Object.entries(checkpoint.directories).map(([key, pair]) => [
                    key,
                    observeMode === "retained" && key === "primary"
                      ? {
                          expected: id,
                          source:
                            checkpoint.actions.retain_runtime.result ===
                            "confirmed"
                              ? { state: "absent", identity: null }
                              : { state: "present", identity: id },
                          retained:
                            checkpoint.actions.retain_runtime.result ===
                            "confirmed"
                              ? { state: "present", identity: id }
                              : { state: "absent", identity: null },
                        }
                      : {
                          ...pair,
                          source:
                            pair.source.state === "unobserved"
                              ? { state: "absent", identity: null }
                              : pair.source,
                          retained:
                            pair.retained.state === "unobserved"
                              ? { state: "absent", identity: null }
                              : pair.retained,
                        },
                  ]),
                ) as typeof checkpoint.directories,
                engine:
                  observeMode === "retained" &&
                  checkpoint.actions.retain_runtime.result !== "confirmed"
                    ? "unavailable"
                    : "ready",
                hostSafety: "safe",
                stale:
                  observeMode === "retained" &&
                  checkpoint.actions.retain_runtime.result === "confirmed"
                    ? "retained"
                    : "absent",
              };
            },
            precondition: async (action) =>
              (observeMode === "effect_unknown" && action === "stop_runtime") ||
              (observeMode === "retained" && action === "retain_runtime")
                ? "proceed"
                : "not_required",
            execute: async (action, checkpoint) => {
              if (observeMode === "retained") {
                assert.equal(action, "retain_runtime");
                return {
                  issued: true,
                  confirmation: "confirmed",
                  observation: {
                    ...checkpoint,
                    stale: "retained",
                    directories: {
                      ...checkpoint.directories,
                      primary: {
                        expected: checkpoint.directories.primary.expected,
                        source: { state: "absent", identity: null },
                        retained: {
                          state: "present",
                          identity: checkpoint.directories.primary.expected,
                        },
                      },
                    },
                  },
                };
              }
              if (observeMode === "effect_unknown") {
                assert.equal(action, "stop_runtime");
                return {
                  issued: null,
                  confirmation: "unknown",
                  observation: checkpoint,
                };
              }
              throw new Error("unexpected_effect");
            },
            awaitEngine: async () => ({ state: "ready", continuation: null }),
          },
        }),
      }).then((result) => {
        lastRuntimeResult = result;
        return result;
      });
    },
  },
};

/**
 * 実修復関数の本文だけを、実Writerと明示的な模擬技術境界へ接続する。
 * @responsibility Moduleの先行評価順に依存せず、実Docker処理を呼出し対象から除外する。
 * @trace ERB-IT-014
 * @precondition Repository内の固定Sourceと既存の保存・技術fixtureだけを使用する。
 * @stimulus 実関数本文を型除去し、有限な名前付き依存へ結合する。
 * @observation 実Writerの保存・故障注入と模擬技術処理への到達数。
 * @oracle 技術三操作は同じ明示fixtureのみ。欠落依存を実処理で補完しない。
 * @cleanup N/A: 組立て自体はメモリだけ。試験Rootは各Caseの終了hookが回収する。
 * @boundary 実Filesystem保存と模擬Docker。公開API全体の実境界成立とは区別する。
 */
function createRepairOwnerFixture() {
  const body = sourceDeclaration(
    fs.readFileSync(
      new URL("../../src/execution/recovery.ts", import.meta.url),
      "utf8",
    ),
    "repairRuntimeOwnedDockerRuntime",
  );
  const dependencies = {
    ...model,
    ...storeModule.namedExports,
    Date,
    isDeepStrictEqual,
    snapshotJsonValue,
    createHash,
    randomBytes,
    randomUUID,
    historyRepositoryInput,
    withHistoryRetention,
    observeRepositoryExecutionDataArea,
    getRepository,
    borrowRuntimeOwnedCoordinatorRecoveryRepository:
      bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository,
    canonicalJson,
    runRepairSession: isolationModule.namedExports.runRepairSession,
    observeRepairDirectories:
      isolationModule.namedExports.observeRepairDirectories,
    cleanupRepairDirectory: isolationModule.namedExports.cleanupRepairDirectory,
  };
  const names = [
    "Date",
    "isDeepStrictEqual",
    "snapshotJsonValue",
    "createHash",
    "randomBytes",
    "randomUUID",
    "historyRepositoryInput",
    "withHistoryRetention",
    "observeRepositoryExecutionDataArea",
    "getRepository",
    "runRepairSession",
    "borrowRuntimeOwnedCoordinatorRecoveryRepository",
    "canonicalJson",
    "observeRepairDirectories",
    "readRecoveryState",
    "advanceOwnedRepairHistory",
    "completeRepair",
    "resumeRepairPublication",
    "completeStatePublication",
    "saveRepairState",
    "cleanupRepairDirectory",
  ] as const;
  const realOperations = {
    runRepairSession: directoryOperations.runRepairSession,
    observeRepairDirectories: directoryOperations.observeRepairDirectories,
    cleanupRepairDirectory: directoryOperations.cleanupRepairDirectory,
  };
  for (const name of [
    "runRepairSession",
    "observeRepairDirectories",
    "cleanupRepairDirectory",
  ] as const) {
    assert.notEqual(
      dependencies[name],
      realOperations[name],
      `real Docker dependency rejected: ${name}`,
    );
  }
  for (const name of names)
    assert.notEqual(
      dependencies[name],
      undefined,
      `missing fixture dependency: ${name}`,
    );
  return runInThisContext(
    `(function(deps){ const {${names.join(",")}} = deps; const getIsolationSettings = () => ({windowsDirectory:"C:/Windows",userHomeDirectory:"C:/Users/test"}); const restartDockerEnvironment = request => runRepairSession(request.input); const inspectResources = target => observeRepairDirectories(target.input); const cleanupResources = target => cleanupRepairDirectory(target.input); ${body}; return repairRuntimeOwnedDockerRuntime; })`,
  )(
    dependencies,
  ) as typeof import("../../src/execution/recovery.ts").repairRuntimeOwnedDockerRuntime;
}

const repairRuntimeOwnedDockerRuntime = createRepairOwnerFixture();

/**
 * 保存故障ごとに独立したRepositoryを用意する。
 * @responsibility 前の故障記録やRootを再利用していないことを保証する。
 * @trace ERB-IT-014
 * @precondition Repository-local試験領域だけを使う。
 * @stimulus 試験Contextの終了時回収へRootを登録する。
 * @observation 検証Root能力と現在状態の固定Path。
 * @oracle Git初期化とRoot検証が成功し、終了後に実体が存在しない。
 * @cleanup 自作Rootだけを削除し、共通領域は空の場合だけ除去する。
 * @boundary 実FilesystemとVersion Control。
 */
function prepareRepairOwnerFixture(t: TestContext) {
  const tests = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "test_root",
  );
  const root = fs.mkdtempSync(path.join(tests.directory, "repair-owner-"));
  t.after(() => {
    assert.equal(fs.realpathSync.native(root), root);
    assert.ok(root.startsWith(`${tests.directory}${path.sep}repair-owner-`));
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
    if (fs.readdirSync(tests.directory).length === 0)
      fs.rmdirSync(tests.directory);
  });
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
  ensureRepositoryExecutionDataAreaFromWorkingDirectory(root, "tests");
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("root_unavailable");
  stateFile = path.join(root, ".crdd", "domain-model", "state.json");
  acquireCount = 0;
  runtimeEntries = 0;
  observeCount = 0;
  writeCalls = 0;
  lastOutcomeCheckpoint = null;
  lastPreOutcomeCheckpoint = null;
  lastRepairCompletionBefore = null;
  faultHits = 0;
  faultedAt = 0;
  lastCheckpoint = null;
  delayedCheckpoint = null;
  lastRuntimeResult = null;
  pauseBeforeDisposal = true;
  retentionReads = 0;
  refuseDisposalProgress = false;
  disposalCalls.length = 0;
  return { root, capability: verified.capability };
}

/**
 * 実Callerの意図保存・回収結果保存・再入場を実Writerへ結合する。
 * @responsibility 模擬DIの肯定を保存成功や修復全体完成へ読み替えない。
 * @trace ERB-IT-014
 * @trace ERB-IT-002
 * @precondition 自己生成Repository、実Kernel／Filesystem Writer、DI処置だけ模擬。
 * @stimulus 判断保存拒否、primary結果保存拒否、同ID再入場と三用途確定。
 * @observation state.json全文、用途列、履歴一行、終了後のexact再入場、元結果不変。
 * @oracle 保存前DI0、処置後保存失敗で後続0、再入場request unknownを保全する。
 * @cleanup 既存fixtureが自己生成Rootだけを回収し不存在を確認する。
 * @boundary 実Root／Kernel／Writer。Docker・Provider・退避物削除0。
 */
test("Host Windows: 修復回収Callerは保存失敗後も同IDで三用途を確定する", async (t) => {
  const f = prepareRepairOwnerFixture(t);
  observeMode = "retained";
  faultStage = "none";
  t.after(() => {
    pauseBeforeDisposal = true;
    refuseDisposalProgress = false;
  });
  const first = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
  );
  assert.ok(first.recoveryId && first.outcomeConfirmed);
  assert.deepEqual(disposalCalls, []);
  const id = first.recoveryId;
  const borrowed = bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(
    f.capability,
  );
  assert.ok(borrowed);
  const original = model
    .readRecoveryState(f.capability)
    .value?.snapshot.operations.find(
      (operation) => operation.recoveryId === id,
    );
  assert.ok(original?.kind === "runtime_repair");
  const historyBefore = stateStore.readRecoveryState(
    historyRepositoryInput(f.capability),
    { kind: "repair_history", recoveryId: id },
  );
  assert.equal(historyBefore.status, "completed");
  assert.equal(historyBefore.repairHistoryState, "technical_state");
  assert.equal(historyBefore.currentHistoryPublication, null);
  const completionBefore = stateStore.readRecoveryState(f.capability, {
    kind: "repair_completion",
    recoveryId: id,
  });
  assert.equal(completionBefore.currentCompletionPublication, null);
  const acquired = acquireCount,
    entries = runtimeEntries;
  pauseBeforeDisposal = false;
  refuseDisposalProgress = true;
  const interrupted = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
    id,
  );
  assert.equal(interrupted.status, "blocked");
  assert.deepEqual(disposalCalls, ["primary"]);
  const saved = model
    .readRecoveryState(f.capability)
    .value?.snapshot.operations.find(
      (operation) => operation.recoveryId === id,
    );
  assert.ok(saved?.kind === "runtime_repair" && saved.disposal);
  assert.deepEqual(saved.disposal.checkpoint.directories.primary, {
    intent: "saved",
    request: "not_issued",
    absence: "unobserved",
  });
  const again = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
    id,
  );
  assert.equal(again.status, "observed");
  assert.equal(again.completionConfirmed, true);
  assert.deepEqual(disposalCalls, [
    "primary",
    "primary",
    "failed",
    "auxiliary",
  ]);
  assert.equal(acquireCount, acquired);
  assert.equal(runtimeEntries, entries);
  const final = (
    JSON.parse(
      Buffer.from(
        lastRepairCompletionBefore ?? assert.fail("missing_fixture_bytes"),
      ).toString("utf8"),
    ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot
  ).operations.find((operation) => operation.recoveryId === id);
  assert.ok(final?.kind === "runtime_repair" && final.disposal);
  assert.deepEqual(
    Object.values(final.disposal.checkpoint.directories).map(
      (item) => item.absence,
    ),
    ["confirmed_absent", "confirmed_absent", "confirmed_absent"],
  );
  assert.equal(
    final.disposal.checkpoint.directories.primary.request,
    "unknown",
  );
  assert.deepEqual(
    {
      checkpoint: final.checkpoint,
      outcome: final.outcome,
      primaryFailure: final.primaryFailure,
      identityJson: final.identityJson,
    },
    {
      checkpoint: original.checkpoint,
      outcome: original.outcome,
      primaryFailure: original.primaryFailure,
      identityJson: original.identityJson,
    },
  );
  const historyFile = path.join(path.dirname(stateFile), "history.jsonl");
  const history = fs.readFileSync(historyFile);
  const historyRead = domain.readRecoveryState(f.capability, {
    kind: "history",
  });
  assert.equal(historyRead.status, "completed", historyRead.reason);
  assert.equal(historyRead.lockReleased, true);
  assert.ok(historyRead.value && historyRead.historyRows);
  const rows = historyRead.historyRows;
  assert.equal(rows?.length, 1);
  assert.equal(
    JSON.parse(rows?.[0]?.line ?? "null").summary.disposal.checkpoint
      .directories.primary.request,
    "unknown",
  );
  assert.equal(
    model.readRecoveryState(f.capability).value?.snapshot.operations.length,
    0,
  );
  const completionAfter = stateStore.readRecoveryState(f.capability, {
    kind: "repair_completion",
    recoveryId: id,
  });
  assert.equal(completionAfter.currentCompletionPublication, null);
  assert.equal(completionAfter.status, "completed");
  assert.equal(completionAfter.repairCompletionAbsent, true);
  const reentry = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
    id,
  );
  assert.equal(reentry.completionConfirmed, true);
  assert.ok(fs.readFileSync(historyFile).equals(history));
  assert.deepEqual(disposalCalls, [
    "primary",
    "primary",
    "failed",
    "auxiliary",
  ]);
});

/**
 * 失敗履歴の物理切断点と除去済み誤分類を確認する。
 * @responsibility 不明結果を成功や再実行へ変換せず同じexact IDへ記録する。
 * @trace ERB-IT-014
 * @precondition 自作Repositoryと実Writerが保存した作成結果不明の修復。
 * @stimulus checkpoint／historyのpending・rename・marker・期間整理後欠測。
 * @observation 実ファイル全文、履歴行、Reader分類、技術取得件数。
 * @oracle 五切断形から履歴だけを確定し、失敗履歴で除去済み成功を返さない。
 * @cleanup 自作Rootと全fixtureの不存在を終了時に確認する。
 * @boundary Host保存のみ。Docker・Provider要求0。
 */
test("Host Windows: 失敗修復履歴は五切断点から再実行なしで確定する", async (t) => {
  const f = prepareRepairOwnerFixture(t);
  observeMode = "effect_unknown";
  faultStage = "none";
  const first = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
  );
  assert.ok(first.recoveryId && first.historyConfirmed);
  assert.equal(first.reason, "runtime_repair_effect_unknown");
  assert.equal(first.completionConfirmed, false);
  assert.ok(lastOutcomeCheckpoint);
  const original = Buffer.from(lastOutcomeCheckpoint);
  const id = first.recoveryId;
  const borrowed = bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(
    f.capability,
  );
  assert.ok(borrowed);
  const directory = path.dirname(stateFile),
    historyFile = path.join(directory, "history.jsonl");
  const priorHistory = fs.readFileSync(historyFile);
  const priorRead = model.readRecoveryState(f.capability, { kind: "history" });
  assert.equal(priorRead.status, "completed", priorRead.reason);
  assert.equal(priorRead.lockReleased, true);
  assert.ok(priorRead.value && priorRead.historyRows);
  assert.equal(priorRead.historyRows.length, 1);
  assert.equal(priorRead.historyRows[0]?.line, priorHistory.toString("utf8"));
  // 前の正常保存が解放済みのため、同じ自己生成Rootへ正規履歴開始前の切断材料を置く。
  fs.writeFileSync(stateFile, original);
  fs.unlinkSync(historyFile);
  const operation = (
    JSON.parse(
      Buffer.from(original ?? assert.fail("missing_fixture_bytes")).toString(
        "utf8",
      ),
    ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot
  ).operations.find((item) => item.recoveryId === id);
  assert.ok(operation);
  const repository = {
    ...borrowed,
    ...withHistoryRetention(borrowed, f.capability),
    operationId: JSON.parse(operation.identityJson).operationId,
  };
  const checkpointSaved = stateStore.advanceOwnedRepairHistory(
    repository,
    id,
    () => true,
  );
  assert.equal(checkpointSaved.status, "completed", checkpointSaved.reason);
  assert.equal(checkpointSaved.snapshotConfirmed, true);
  assert.equal(checkpointSaved.lockReleased, true);
  assert.equal(checkpointSaved.historyConfirmed, false);
  const checkpointBytes = fs.readFileSync(stateFile);
  const historySaved = stateStore.advanceOwnedRepairHistory(
    repository,
    id,
    () => true,
  );
  assert.equal(historySaved.status, "completed", historySaved.reason);
  assert.equal(historySaved.snapshotConfirmed, true);
  assert.equal(historySaved.lockReleased, true);
  assert.equal(historySaved.historyConfirmed, true);
  const currentBytes = fs.readFileSync(stateFile),
    historyBytes = fs.readFileSync(historyFile);
  const publishedRead = model.readRecoveryState(f.capability, {
    kind: "history",
  });
  assert.equal(publishedRead.status, "completed", publishedRead.reason);
  assert.equal(publishedRead.lockReleased, true);
  assert.ok(publishedRead.value && publishedRead.historyRows);
  assert.equal(publishedRead.historyRows.length, 1);
  assert.equal(
    publishedRead.historyRows[0]?.line,
    historyBytes.toString("utf8"),
  );
  const markerBytes = Buffer.from(
    `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: borrowed.repositoryBinding })}\n`,
  );
  const acquired = acquireCount,
    entries = runtimeEntries,
    observed = observeCount;
  for (const cut of [
    "checkpoint_pending",
    "history_pending",
    "history_renamed",
    "confirmed_marker",
    "confirmed_missing",
  ] as const)
    await t.test(cut, async () => {
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
        cut === "checkpoint_pending"
          ? original
          : cut === "confirmed_marker" || cut === "confirmed_missing"
            ? currentBytes
            : checkpointBytes,
      );
      if (cut === "checkpoint_pending")
        fs.writeFileSync(
          path.join(directory, "state.pending.json"),
          checkpointBytes,
        );
      if (cut === "history_pending")
        fs.writeFileSync(
          path.join(directory, "history.pending.jsonl"),
          historyBytes,
        );
      if (cut === "history_renamed" || cut === "confirmed_marker")
        fs.writeFileSync(historyFile, historyBytes);
      if (cut !== "history_renamed" && cut !== "confirmed_missing")
        fs.writeFileSync(path.join(directory, "state.lock"), markerBytes);
      const cancelled = new AbortController();
      cancelled.abort();
      const result = await repairRuntimeOwnedDockerRuntime(
        f.capability,
        cancelled.signal,
        id,
      );
      assert.equal(result.status, "observed");
      assert.equal(result.reason, "runtime_repair_effect_unknown");
      assert.equal(result.historyConfirmed, true);
      assert.equal(result.completionConfirmed, false);
      assert.ok(fs.readFileSync(stateFile).equals(currentBytes));
      if (cut === "confirmed_missing")
        assert.equal(fs.existsSync(historyFile), false);
      else assert.ok(fs.readFileSync(historyFile).equals(historyBytes));
      for (const name of [
        "state.pending.json",
        "history.pending.jsonl",
        "state.lock",
      ])
        assert.equal(fs.existsSync(path.join(directory, name)), false);
      assert.equal(acquireCount, acquired);
      assert.equal(runtimeEntries, entries);
      assert.equal(observeCount, observed);
    });
  // 現在操作だけ消えた破損fixtureを、失敗履歴から成功へ補完しない。
  const snapshot = {
    snapshot: JSON.parse(
      Buffer.from(
        currentBytes ?? assert.fail("missing_fixture_bytes"),
      ).toString("utf8"),
    ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
  };
  assert.ok(snapshot);
  fs.writeFileSync(
    stateFile,
    `${canonicalJson({ ...snapshot.snapshot, operations: [] })}\n`,
  );
  fs.writeFileSync(historyFile, historyBytes);
  const refused = stateStore.readRecoveryState(f.capability, {
    kind: "repair_completion",
    recoveryId: id,
  });
  assert.equal(refused.status, "blocked");
  assert.equal(refused.repairCompletionAbsent, false);
  assert.equal(acquireCount, acquired);
  assert.equal(runtimeEntries, entries);
});

/**
 * 回収判断と進捗の保存を実Writerと同IDの保存再開へ接続する。
 * @responsibility 同値通知を無書込みで確認し、保存切断を技術再発行へ変えない。
 * @trace ERB-IT-014
 * @precondition 実DI Machineと模擬技術観測が生成した保持判断待ち。
 * @stimulus 保持引渡しの通常保存、用途偽装、rename前／marker除去前切断、同値拒否。
 * @observation 元版・改訂・receipt全文と実state／pending／marker。
 * @oracle 専用用途だけが確定し、切断後も日時・対象を再生成しない。
 * @cleanup 自己生成Rootだけを既存fixtureで清掃し不存在確認。
 * @boundary 実Root・Kernel・Filesystem。Docker／Provider／退避物削除は対象外。
 */
test("Host Windows: 保持引渡しは専用保存と同一候補再開へ接続する", async (t) => {
  for (const stage of ["normal", "before_rename", "after_rename"] as const) {
    const f = prepareRepairOwnerFixture(t);
    observeMode = "retained";
    faultStage = "none";
    const result = await repairRuntimeOwnedDockerRuntime(
      f.capability,
      new AbortController().signal,
    );
    assert.ok(result.recoveryId && result.outcomeConfirmed);
    const id = result.recoveryId;
    const repository = bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(
      f.capability,
    );
    assert.ok(repository);
    const before = fs.readFileSync(stateFile);
    const value = {
      snapshot: JSON.parse(
        Buffer.from(before ?? assert.fail("missing_fixture_bytes")).toString(
          "utf8",
        ),
      ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
      payloadSha256: createHash("sha256")
        .update(before ?? assert.fail("missing_fixture_bytes"))
        .digest("hex"),
      sourceText: Buffer.from(
        before ?? assert.fail("missing_fixture_bytes"),
      ).toString("utf8"),
    };
    const operation = value?.snapshot.operations.find(
      (item) => item.recoveryId === id,
    );
    assert.ok(operation?.kind === "runtime_repair" && operation.checkpoint);
    const receipt = {
      decidedAt: "2026-10-17T00:00:00.000Z",
      reviewAfter: "2026-10-24T00:00:00.000Z",
      targets: {
        primary: operation.checkpoint.directories.primary.retained.identity,
        failed: operation.checkpoint.directories.failed.retained.identity,
        auxiliary: operation.checkpoint.directories.auxiliary.retained.identity,
      },
    };
    assert.ok(value);
    const candidate = Buffer.from(
      `${canonicalJson({
        ...value.snapshot,
        revision: value.snapshot.revision + 1,
        previous: {
          revision: value.snapshot.revision,
          payloadSha256: value.payloadSha256,
        },
        operations: value.snapshot.operations.map((item) =>
          item.recoveryId === id
            ? {
                ...item,
                phase: "settling",
                disposition: "retained_by_human_decision",
                retention: receipt,
              }
            : item,
        ),
      })}\n`,
    );
    for (const purpose of [
      "checkpoint",
      "session_begin",
      "disposal_decision",
      "disposal_primary",
      "disposal_failed",
      "disposal_auxiliary",
    ] as const) {
      const refused = stateStore.saveRepairState(
        f.capability,
        id,
        {
          expected: repairVersion(before),
          change: {
            kind: purpose,
            candidate,
          },
        } as unknown as model.RepairSaveRequest,
        () => true,
      );
      assert.equal(refused.snapshotConfirmed, false);
      assert.equal(refused.filesystemEffectIssued, false);
      assert.ok(fs.readFileSync(stateFile).equals(before));
    }
    const pending = path.join(path.dirname(stateFile), "state.pending.json");
    const marker = path.join(path.dirname(stateFile), "state.lock");
    if (stage === "normal") {
      const stopWasUnneeded =
        operation.checkpoint.actions.stop_runtime.result === "not_required";
      const decodedCandidate = {
        snapshot: JSON.parse(
          Buffer.from(
            candidate ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
      };
      assert.ok(decodedCandidate);
      const changed = Buffer.from(
        `${canonicalJson({
          ...decodedCandidate.snapshot,
          operations: decodedCandidate.snapshot.operations.map((item) =>
            item.kind !== "runtime_repair" || item.recoveryId !== id
              ? item
              : {
                  ...item,
                  checkpoint: {
                    ...item.checkpoint,
                    actions: {
                      ...item.checkpoint?.actions,
                      stop_runtime: stopWasUnneeded
                        ? {
                            intent: "saved",
                            request: "issued",
                            result: "confirmed",
                          }
                        : {
                            intent: "not_saved",
                            request: "not_issued",
                            result: "not_required",
                          },
                    },
                  },
                },
          ),
        })}\n`,
      );
      // 合法な差分と遷移拒否はERB-UT-036（repair-modelのlegal_source_change_before_oracle）。ここは公開Writerのcheckpoint拒否とEffect 0を検証する。
      const refused = stateStore.saveRepairState(
        f.capability,
        id,
        {
          expected: repairVersion(before),
          change: {
            kind: "retention_handoff",
            receipt,
            checkpoint: JSON.parse(changed.toString("utf8")).operations[0]
              .checkpoint,
          },
        } as unknown as model.RepairSaveRequest,
        () => true,
      );
      assert.equal(refused.snapshotConfirmed, false);
      assert.equal(refused.filesystemEffectIssued, false);
      assert.ok(fs.readFileSync(stateFile).equals(before));
      assert.equal(fs.existsSync(pending), false);
      assert.equal(fs.existsSync(marker), false);
    }
    const rename = fs.renameSync,
      unlink = fs.unlinkSync;
    let cut = 0;
    const renameHook = mock.method(
      fs,
      "renameSync",
      (from: fs.PathLike, to: fs.PathLike) => {
        if (stage === "before_rename" && to === stateFile && cut === 0) {
          cut++;
          throw new Error("synthetic_handoff_before_rename");
        }
        return rename(from, to);
      },
    );
    const unlinkHook = mock.method(fs, "unlinkSync", (file: fs.PathLike) => {
      if (stage === "after_rename" && file === marker && cut === 0) {
        cut++;
        throw new Error("synthetic_handoff_after_rename");
      }
      return unlink(file);
    });
    try {
      const saved = stateStore.saveRepairState(
        f.capability,
        id,
        {
          expected: repairVersion(before),
          change: {
            kind: "retention_handoff",
            receipt,
          },
        },
        () => true,
      );
      assert.equal(saved.snapshotConfirmed, stage === "normal");
      assert.equal(saved.status, stage === "normal" ? "completed" : "blocked");
      assert.equal(saved.filesystemEffectIssued, true);
      assert.equal(saved.lockReleased, true);
    } finally {
      unlinkHook.mock.restore();
      renameHook.mock.restore();
    }
    assert.equal(cut, stage === "normal" ? 0 : 1);
    if (stage === "before_rename") {
      assert.ok(fs.readFileSync(stateFile).equals(before));
      assert.ok(fs.readFileSync(pending).equals(candidate));
      const resumed = stateStore.resumeRepairPublication(
        historyRepositoryInput(f.capability),
        id,
        () => true,
      );
      assert.equal(resumed.snapshotConfirmed, true);
      assert.equal(resumed.status, "completed");
      assert.equal(resumed.lockReleased, true);
    } else if (stage === "after_rename") {
      assert.ok(fs.readFileSync(stateFile).equals(candidate));
      assert.equal(fs.existsSync(pending), false);
      assert.equal(fs.existsSync(marker), true);
      const cleaned = stateStore.completeStatePublication(f.capability);
      assert.equal(cleaned.storageConfirmed, true);
      assert.equal(cleaned.status, "completed");
      assert.equal(cleaned.lockReleased, true);
      assert.equal(cleaned.markerAbsentConfirmed, true);
    }
    assert.ok(fs.readFileSync(stateFile).equals(candidate));
    assert.equal(fs.existsSync(pending), false);
    assert.equal(fs.existsSync(marker), false);
    const actual = model.readRecoveryState(f.capability).value;
    const next = actual?.snapshot.operations.find(
      (item) => item.recoveryId === id,
    );
    assert.ok(actual && value && next?.kind === "runtime_repair");
    assert.equal(actual.snapshot.revision, value.snapshot.revision + 1);
    assert.deepEqual(actual.snapshot.previous, {
      revision: value.snapshot.revision,
      payloadSha256: value.payloadSha256,
    });
    assert.deepEqual(next, {
      ...operation,
      phase: "settling",
      disposition: "retained_by_human_decision",
      retention: receipt,
    });
    const same = stateStore.saveRepairState(
      f.capability,
      id,
      {
        expected: repairVersion(candidate),
        change: {
          kind: "retention_handoff",
          receipt,
        },
      },
      () => true,
    );
    assert.equal(same.snapshotConfirmed, false);
    assert.equal(same.filesystemEffectIssued, false);
    assert.ok(fs.readFileSync(stateFile).equals(candidate));
    if (stage === "normal") {
      const acquired = acquireCount,
        entries = runtimeEntries;
      for (let step = 0; step < 2; step++) {
        const read = stateStore.readRecoveryState(
          historyRepositoryInput(f.capability),
          { kind: "repair_history", recoveryId: id },
        );
        assert.equal(read.status, "completed");
        assert.equal(read.lockReleased, true);
        const saved = stateStore.advanceOwnedRepairHistory(
          {
            ...repository,
            ...withHistoryRetention(repository, f.capability),
            operationId: JSON.parse(operation.identityJson).operationId,
          },
          id,
          () => true,
        );
        assert.equal(saved.status, "completed");
        assert.equal(saved.snapshotConfirmed, true);
        assert.equal(saved.lockReleased, true);
      }
      const historyFile = path.join(path.dirname(stateFile), "history.jsonl");
      const history = fs.readFileSync(historyFile);
      const historyRead = domain.readRecoveryState(f.capability, {
        kind: "history",
      });
      assert.equal(historyRead.status, "completed", historyRead.reason);
      assert.equal(historyRead.lockReleased, true);
      assert.ok(historyRead.value && historyRead.historyRows);
      assert.equal(historyRead.historyRows.length, 1);
      assert.equal(historyRead.historyRows[0]?.line, history.toString("utf8"));
      const beforeCompletion = fs.readFileSync(stateFile);
      const ready = stateStore.readRecoveryState(f.capability, {
        kind: "repair_completion",
        recoveryId: id,
      });
      assert.equal(ready.status, "completed");
      assert.equal(ready.lockReleased, true);
      assert.equal(ready.repairCompletionAbsent, false);
      assert.equal(ready.repairRetentionReviewAfter, receipt.reviewAfter);
      assert.ok(ready.currentCompletionPublication);
      for (const fault of [
        "missing_receipt",
        "bad_deadline",
        "target_difference",
      ] as const) {
        const changed = JSON.parse(history.toString());
        if (fault === "missing_receipt") delete changed.summary.retention;
        else if (fault === "bad_deadline")
          changed.summary.retention.reviewAfter = "2026-10-24T00:00:00.001Z";
        else changed.summary.retention.targets.primary.ino += "1";
        fs.writeFileSync(historyFile, `${canonicalJson(changed)}\n`);
        const refused = stateStore.readRecoveryState(f.capability, {
          kind: "repair_completion",
          recoveryId: id,
        });
        assert.equal(refused.status, "blocked", fault);
        assert.equal(refused.repairRetentionReviewAfter, null, fault);
        assert.ok(fs.readFileSync(stateFile).equals(beforeCompletion));
      }
      fs.writeFileSync(historyFile, history);
      const saved = stateStore.completeRepair(f.capability, id, () => true);
      assert.equal(saved.status, "completed");
      assert.equal(saved.snapshotConfirmed, true);
      assert.equal(saved.lockReleased, true);
      const absent = stateStore.readRecoveryState(f.capability, {
        kind: "repair_completion",
        recoveryId: id,
      });
      assert.equal(absent.status, "completed");
      assert.equal(absent.lockReleased, true);
      assert.equal(absent.repairCompletionAbsent, true);
      assert.equal(absent.repairRetentionReviewAfter, receipt.reviewAfter);
      assert.ok(fs.readFileSync(historyFile).equals(history));
      const legacyRow = JSON.parse(history.toString());
      delete legacyRow.summary.retention;
      const legacyHistory = Buffer.from(`${canonicalJson(legacyRow)}\n`);
      try {
        fs.writeFileSync(historyFile, legacyHistory);
        const legacyRead = domain.readRecoveryState(f.capability, {
          kind: "history",
        });
        assert.equal(legacyRead.status, "completed", legacyRead.reason);
        assert.equal(legacyRead.lockReleased, true);
        assert.ok(legacyRead.value && legacyRead.historyRows);
        assert.equal(legacyRead.historyRows.length, 1);
        assert.equal(
          legacyRead.historyRows[0]?.line,
          legacyHistory.toString("utf8"),
        );
        const refused = stateStore.readRecoveryState(f.capability, {
          kind: "repair_completion",
          recoveryId: id,
        });
        assert.equal(refused.status, "blocked");
        assert.equal(refused.repairCompletionAbsent, false);
        assert.equal(refused.repairRetentionReviewAfter, null);
      } finally {
        fs.writeFileSync(historyFile, history);
      }
      assert.equal(
        model.readRecoveryState(f.capability).value?.snapshot.operations.length,
        0,
      );
      assert.equal(acquireCount, acquired);
      assert.equal(runtimeEntries, entries);
      fs.writeFileSync(historyFile, Buffer.alloc(0));
      const missing = stateStore.readRecoveryState(f.capability, {
        kind: "repair_completion",
        recoveryId: id,
      });
      assert.equal(missing.status, "blocked");
      assert.equal(missing.repairRetentionReviewAfter, null);
      fs.writeFileSync(historyFile, history);
    }
  }
});

/**
 * 修復終了の除去と有限な保存途中を実Writerで確認する。
 * @responsibility Task用終了Readerへの誤配線と実修復再発行を拒否する。
 * @trace ERB-IT-014
 * @precondition 自己生成Repositoryと履歴確認済みの退避物なし修復。
 * @stimulus 通常除去、exact pending、除去後marker、別pendingと履歴不一致。
 * @observation state／history全文、保存確認、排他、DI取得件数。
 * @oracle 対象だけ除去し、履歴不変、不明では停止、Native再取得0。
 * @cleanup 自作Rootだけを既存fixtureで削除し不存在を確認する。
 * @boundary 実Root・Kernel・Filesystem。Docker／Provider要求0。
 */
test("Host Windows: 修復終了は既存completion保存でexact対象だけ除去する", async (t) => {
  const f = prepareRepairOwnerFixture(t);
  observeMode = "ready";
  faultStage = "none";
  const result = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
  );
  assert.ok(result.recoveryId && result.historyConfirmed);
  assert.equal(result.completionConfirmed, true);
  const id = result.recoveryId;
  const directory = path.dirname(stateFile);
  const historyFile = path.join(directory, "history.jsonl");
  assert.ok(lastRepairCompletionBefore);
  const original = Buffer.from(lastRepairCompletionBefore);
  assert.equal(
    model.readRecoveryState(f.capability).value?.snapshot.operations.length,
    0,
  );
  const duplicate = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    AbortSignal.abort(),
    id,
  );
  assert.equal(duplicate.completionConfirmed, true);
  assert.equal(duplicate.finalCheckpointConfirmed, false);
  assert.equal(duplicate.operationCleanupConfirmed, false);
  fs.writeFileSync(stateFile, original);
  const history = fs.readFileSync(historyFile);
  const otherRow = JSON.parse(history.toString("utf8"));
  otherRow.summary.operationNonce = "9".repeat(64);
  otherRow.summary.recoveryId = `docker-runtime-repair.${otherRow.summary.operationNonce}.${otherRow.summary.identitySha256}`;
  const otherHistory = Buffer.from(`${canonicalJson(otherRow)}\n`);
  const borrowed = bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(
    f.capability,
  );
  assert.ok(borrowed);
  assert.ok(fs.readFileSync(stateFile).equals(original));
  const completionRead = stateStore.readRecoveryState(
    historyRepositoryInput(f.capability),
    { kind: "repair_completion", recoveryId: id },
  );
  assert.equal(completionRead.status, "completed");
  assert.equal(completionRead.lockReleased, true);
  assert.ok(completionRead.currentCompletionPublication);
  assert.ok(
    completionRead.currentCompletionPublication.before.equals(original),
  );
  const candidate = completionRead.currentCompletionPublication.candidate;
  const beforeCompletion = {
    snapshot: JSON.parse(
      Buffer.from(original ?? assert.fail("missing_fixture_bytes")).toString(
        "utf8",
      ),
    ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
    payloadSha256: createHash("sha256")
      .update(original ?? assert.fail("missing_fixture_bytes"))
      .digest("hex"),
    sourceText: Buffer.from(
      original ?? assert.fail("missing_fixture_bytes"),
    ).toString("utf8"),
  };
  const afterCompletion = {
    snapshot: JSON.parse(
      Buffer.from(candidate ?? assert.fail("missing_fixture_bytes")).toString(
        "utf8",
      ),
    ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
  };
  assert.ok(beforeCompletion && afterCompletion);
  assert.equal(
    beforeCompletion.snapshot.operations.filter(
      (item) => item.recoveryId === id,
    ).length,
    1,
  );
  assert.deepEqual(afterCompletion.snapshot, {
    ...beforeCompletion.snapshot,
    revision: beforeCompletion.snapshot.revision + 1,
    previous: {
      revision: beforeCompletion.snapshot.revision,
      payloadSha256: beforeCompletion.payloadSha256,
    },
    operations: beforeCompletion.snapshot.operations.filter(
      (item) => item.recoveryId !== id,
    ),
  });
  const markerFile = path.join(directory, "state.lock");
  const pendingFile = path.join(directory, "state.pending.json");
  const marker = Buffer.from(
    `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: borrowed.repositoryBinding })}\n`,
  );
  const acquired = acquireCount;
  const entries = runtimeEntries;
  for (const mode of [
    "normal",
    "pending",
    "wrong_pending",
    "no_marker",
    "missing_history",
    "other_history",
    "owner_lost",
  ] as const) {
    await t.test(mode, () => {
      for (const file of [pendingFile, markerFile])
        if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.writeFileSync(stateFile, original);
      fs.writeFileSync(historyFile, history);
      if (
        mode === "pending" ||
        mode === "wrong_pending" ||
        mode === "no_marker"
      ) {
        fs.writeFileSync(
          pendingFile,
          mode === "wrong_pending" ? original : candidate,
        );
        if (mode !== "no_marker") fs.writeFileSync(markerFile, marker);
      }
      if (mode === "missing_history")
        fs.writeFileSync(historyFile, Buffer.alloc(0));
      if (mode === "other_history") fs.writeFileSync(historyFile, otherHistory);
      const worker = stateStore;
      if (mode === "other_history") {
        const otherRead = domain.readRecoveryState(f.capability, {
          kind: "history",
        });
        assert.equal(otherRead.status, "completed", otherRead.reason);
        assert.equal(otherRead.lockReleased, true);
        assert.ok(otherRead.value && otherRead.historyRows);
        assert.equal(otherRead.historyRows.length, 1);
        assert.equal(
          otherRead.historyRows[0]?.recoveryId,
          otherRow.summary.recoveryId,
        );
        assert.equal(
          otherRead.historyRows[0]?.line,
          otherHistory.toString("utf8"),
        );
        const rejected = worker.readRecoveryState(f.capability, {
          kind: "repair_completion",
          recoveryId: id,
        });
        assert.equal(rejected.status, "blocked");
        assert.equal(rejected.currentCompletionPublication, null);
      }
      const saved = worker.completeRepair(
        f.capability,
        id,
        () => mode !== "owner_lost",
      );
      const success = mode === "normal" || mode === "pending";
      assert.equal(saved.status, success ? "completed" : "blocked");
      assert.equal(saved.snapshotConfirmed, success);
      assert.ok(
        fs.readFileSync(stateFile).equals(success ? candidate : original),
      );
      assert.ok(
        fs
          .readFileSync(historyFile)
          .equals(
            mode === "missing_history"
              ? Buffer.alloc(0)
              : mode === "other_history"
                ? otherHistory
                : history,
          ),
      );
      if (success) {
        assert.equal(saved.lockReleased, true);
        assert.equal(
          worker.readRecoveryState(f.capability, {
            kind: "repair_completion",
            recoveryId: id,
          }).repairCompletionAbsent,
          true,
        );
        assert.equal(
          stateStore.readRecoveryState(f.capability, {
            kind: "execution_completion",
            recoveryId: id,
          }).status,
          "blocked",
        );
      } else assert.equal(saved.filesystemEffectIssued, false);
    });
  }
  for (const file of [pendingFile, markerFile])
    if (fs.existsSync(file)) fs.unlinkSync(file);
  fs.writeFileSync(stateFile, candidate);
  fs.writeFileSync(historyFile, history);
  fs.writeFileSync(markerFile, marker);
  const afterRename = stateStore;
  const absent = afterRename.readRecoveryState(f.capability, {
    kind: "repair_completion",
    recoveryId: id,
  });
  assert.equal(absent.status, "completed");
  assert.equal(absent.repairCompletionAbsent, true);
  assert.equal(absent.repairRetentionReviewAfter, null);
  assert.equal(absent.currentCompletionPublication, null);
  const cleaned = stateStore.completeStatePublication(f.capability);
  assert.equal(cleaned.status, "completed");
  assert.equal(cleaned.markerAbsentConfirmed, true);
  assert.equal(
    afterRename.readRecoveryState(f.capability, {
      kind: "repair_completion",
      recoveryId: id,
    }).repairCompletionAbsent,
    true,
  );
  assert.ok(fs.readFileSync(stateFile).equals(candidate));
  fs.writeFileSync(historyFile, Buffer.alloc(0));
  assert.equal(
    afterRename.readRecoveryState(f.capability, {
      kind: "repair_completion",
      recoveryId: id,
    }).status,
    "blocked",
  );
  for (const cut of [
    "rename_before",
    "rename_after",
    "marker_after",
  ] as const) {
    await t.test(cut, async () => {
      for (const file of [pendingFile, markerFile])
        if (fs.existsSync(file)) fs.unlinkSync(file);
      fs.writeFileSync(stateFile, original);
      fs.writeFileSync(historyFile, history);
      const rename = fs.renameSync;
      const unlink = fs.unlinkSync;
      let hits = 0;
      const renameHook = mock.method(
        fs,
        "renameSync",
        (...args: Parameters<typeof fs.renameSync>) => {
          const matches =
            args[1] === stateFile && hits === 0 && cut.startsWith("rename");
          if (matches && cut === "rename_before") {
            hits++;
            throw new Error("completion_rename_before");
          }
          const value = Reflect.apply(rename, fs, args);
          if (matches) {
            hits++;
            throw new Error("completion_rename_after");
          }
          return value;
        },
      );
      const unlinkHook = mock.method(
        fs,
        "unlinkSync",
        (...args: Parameters<typeof fs.unlinkSync>) => {
          const value = Reflect.apply(unlink, fs, args);
          if (args[0] === markerFile && cut === "marker_after" && hits === 0) {
            hits++;
            throw new Error("completion_marker_after");
          }
          return value;
        },
      );
      let failed: Awaited<ReturnType<typeof repairRuntimeOwnedDockerRuntime>>;
      try {
        failed = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          AbortSignal.abort(),
          id,
        );
      } finally {
        renameHook.mock.restore();
        unlinkHook.mock.restore();
      }
      assert.equal(hits, 1);
      assert.equal(failed.status, "blocked");
      assert.equal(failed.historyConfirmed, true);
      assert.equal(failed.outcomeConfirmed, true);
      assert.equal(failed.completionConfirmed, false);
      const resumed = await repairRuntimeOwnedDockerRuntime(
        f.capability,
        AbortSignal.abort(),
        id,
      );
      assert.equal(resumed.status, "observed");
      assert.equal(resumed.completionConfirmed, true);
      assert.ok(fs.readFileSync(stateFile).equals(candidate));
      assert.ok(fs.readFileSync(historyFile).equals(history));
      assert.equal(acquireCount, acquired);
      assert.equal(runtimeEntries, entries);
    });
  }
  assert.equal(acquireCount, acquired);
  assert.equal(runtimeEntries, entries);
});

/**
 * 修復保存の準備先行・exact再入場・遅延通知拒否を確認する。
 * @responsibility Hash相関だけでなく実Root・Writerの保存結果を観測する。
 * @trace ERB-IT-014
 * @precondition 実Windows Kernel排他と自己生成Git Repository。
 * @stimulus 初回、同exact再入場、Scope差、pending状態、返却後通知。
 * @observation state.json全文・版・Identity・Native取得／Machine観測回数。
 * @oracle 準備二保存前のMachine0、同ID保持、不明後の新処置0、返却後Writer0。
 * @cleanup 自己生成Rootだけを境界確認後に削除し不存在を確認する。
 * @boundary 実物理Writerと最下位を模擬したDI接続。
 */
test("Host Windows: 修復呼出しは実Writerへ準備保存後にMachineを開始する", async (t) => {
  const verified = prepareRepairOwnerFixture(t);
  observeMode = "incomplete";
  faultStage = "none";
  const first = await repairRuntimeOwnedDockerRuntime(
    verified.capability,
    new AbortController().signal,
  );
  assert.equal(first.status, "observed");
  assert.equal(first.finalCheckpointConfirmed, true);
  assert.equal(first.operationCleanupConfirmed, true);
  assert.equal(acquireCount, 1);
  assert.ok(observeCount > 0);
  assert.ok(first.recoveryId);
  const before = fs.readFileSync(stateFile);
  const snapshot = JSON.parse(before.toString("utf8"));
  assert.equal(snapshot.operations[0].checkpoint.cleanup, "confirmed");
  assert.equal(snapshot.operations[0].phase, "repairing");
  assert.equal(snapshot.operations[0].outcome, null);
  assert.ok(lastCheckpoint);
  assert.ok(delayedCheckpoint);
  assert.throws(
    delayedCheckpoint.bind(null, lastCheckpoint),
    /docker_repair_record_unconfirmed/u,
  );
  assert.ok(fs.readFileSync(stateFile).equals(before));
  const next = await repairRuntimeOwnedDockerRuntime(
    verified.capability,
    new AbortController().signal,
    first.recoveryId,
  );
  assert.equal(
    next.status,
    "observed",
    JSON.stringify({ next, lower: lastRuntimeResult }),
  );
  assert.equal(next.recoveryId, first.recoveryId);
  const nextBytes = fs.readFileSync(stateFile);
  const nextSnapshot = JSON.parse(nextBytes.toString("utf8"));
  assert.equal(
    nextSnapshot.operations[0].identityJson,
    snapshot.operations[0].identityJson,
  );
  assert.ok(nextSnapshot.revision > snapshot.revision);
  const acquired = acquireCount;
  fs.writeFileSync(
    path.join(path.dirname(stateFile), "state.pending.json"),
    "fixture",
  );
  const pending = await repairRuntimeOwnedDockerRuntime(
    verified.capability,
    new AbortController().signal,
    first.recoveryId,
  );
  assert.equal(pending.status, "blocked");
  assert.equal(acquireCount, acquired);
  assert.ok(fs.readFileSync(stateFile).equals(nextBytes));
  fs.unlinkSync(path.join(path.dirname(stateFile), "state.pending.json"));
  observeMode = "ready";
  const completed = await repairRuntimeOwnedDockerRuntime(
    verified.capability,
    new AbortController().signal,
    first.recoveryId,
  );
  assert.equal(completed.status, "observed");
  assert.equal(completed.finalCheckpointConfirmed, true);
  assert.equal(completed.outcomeConfirmed, true);
  assert.equal(completed.historyConfirmed, true);
  assert.equal(completed.completionConfirmed, true);
  const terminalBytes = fs.readFileSync(stateFile);
  const terminal = JSON.parse(terminalBytes.toString("utf8"));
  assert.deepEqual(terminal.operations, []);
  const historyFile = path.join(path.dirname(stateFile), "history.jsonl");
  const historyBytes = fs.readFileSync(historyFile);
  const historyRead = domain.readRecoveryState(verified.capability, {
    kind: "history",
  });
  assert.equal(historyRead.status, "completed", historyRead.reason);
  assert.equal(historyRead.lockReleased, true);
  assert.ok(historyRead.value && historyRead.historyRows);
  const rows = historyRead.historyRows;
  assert.equal(rows?.length, 1);
  assert.equal(rows?.[0]?.recoveryId, first.recoveryId);
  const summary = JSON.parse(historyBytes.toString("utf8")).summary;
  assert.equal(summary.outcome.status, "recovered");
  assert.equal(summary.technical.cleanup, "confirmed");
  const terminalAcquired = acquireCount;
  const terminalWrites = writeCalls;
  const settled = await repairRuntimeOwnedDockerRuntime(
    verified.capability,
    new AbortController().signal,
    first.recoveryId,
  );
  assert.equal(settled.status, "observed");
  assert.equal(settled.reason, "runtime_repair_recovered");
  assert.equal(settled.completionConfirmed, true);
  assert.equal(acquireCount, terminalAcquired);
  assert.equal(writeCalls, terminalWrites);
  assert.ok(fs.readFileSync(stateFile).equals(terminalBytes));
  assert.ok(fs.readFileSync(historyFile).equals(historyBytes));
});

/**
 * 保持判断を既存物理Writerで保存し、切断後も技術再取得しない。
 * @responsibility 保持の保存確定と退避物の実在・引渡しを分離する。
 * @trace ERB-IT-014
 * @precondition 自己生成Repository、実DI Machine、模擬技術観測からの保持待ち。
 * @stimulus 通常保存とrename直前一回拒否後のfresh同ID出版。
 * @observation exact本文、短命File不存在、技術入口増分0、phase／disposition以外不変。
 * @oracle 期限と対象を再生成せず、一行出版・操作除去・exact再入場を確認する。
 * @cleanup 自己生成Rootを実体・範囲確認後に削除し不存在確認。
 * @boundary 実Windows Filesystem、Docker／Native技術操作は模擬。
 */
test("Host Windows: 修復保持は実Writerと保存途中のfresh出版へ接続する", async (t) => {
  for (const cut of ["none", "state", "history"] as const) {
    await t.test(cut, async (t) => {
      const f = prepareRepairOwnerFixture(t);
      observeMode = "retained";
      faultStage = "none";
      const first = await repairRuntimeOwnedDockerRuntime(
        f.capability,
        new AbortController().signal,
      );
      assert.ok(first.recoveryId);
      assert.equal(first.outcomeConfirmed, true);
      const before = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      const target = before.operations[0];
      assert.equal(target.phase, "awaiting_disposition");
      const acquired = acquireCount,
        entries = runtimeEntries,
        writes = writeCalls;
      const marker = path.join(path.dirname(stateFile), "state.lock");
      const pending = path.join(path.dirname(stateFile), "state.pending.json");
      const historyFile = path.join(path.dirname(stateFile), "history.jsonl");
      const historyPending = path.join(
        path.dirname(stateFile),
        "history.pending.jsonl",
      );
      const rename = fs.renameSync;
      let completion: Awaited<
        ReturnType<typeof repairRuntimeOwnedDockerRuntime>
      > | null = null;
      let hits = 0;
      const hook = mock.method(
        fs,
        "renameSync",
        (from: fs.PathLike, to: fs.PathLike) => {
          if (
            ((cut === "state" && to === stateFile) ||
              (cut === "history" && to === historyFile)) &&
            hits === 0
          ) {
            hits++;
            throw new Error("synthetic_retention_rename_cut");
          }
          return rename(from, to);
        },
      );
      try {
        const retained = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          new AbortController().signal,
          first.recoveryId,
          "retain",
        );
        completion = retained;
        assert.equal(retained.status, cut !== "none" ? "blocked" : "observed");
        assert.equal(
          "retentionConfirmed" in retained && retained.retentionConfirmed,
          cut !== "state",
        );
      } finally {
        hook.mock.restore();
      }
      assert.equal(writeCalls, writes + 1);
      if (cut !== "none") {
        assert.equal(hits, 1);
        assert.equal(
          JSON.parse(fs.readFileSync(stateFile, "utf8")).operations[0].phase,
          cut === "state" ? "awaiting_disposition" : "settling",
        );
        const expected = fs.readFileSync(cut === "state" ? pending : stateFile);
        if (cut === "history") {
          const beforeRead = fs.readFileSync(stateFile),
            pendingBytes = fs.readFileSync(historyPending);
          let markerBytes: Buffer | null = null;
          try {
            markerBytes = fs.readFileSync(marker);
          } catch (error) {
            assert.equal((error as NodeJS.ErrnoException).code, "ENOENT");
          }
          const read = domain.readRecoveryState(
            historyRepositoryInput(f.capability),
            { kind: "repair_history", recoveryId: first.recoveryId },
          );
          assert.equal(read.status, "completed", read.reason);
          assert.equal(read.lockReleased, true);
          assert.ok(read.value);
          assert.equal(read.repairHistoryState, "publication");
          assert.equal(read.currentHistoryPublication?.stage, "publish");
          const publication =
            read.currentHistoryPublication?.pendingHistoryFile;
          assert.ok(publication);
          assert.deepEqual(publication.bytes, pendingBytes);
          const lines = pendingBytes.toString("utf8").split("\n");
          assert.equal(lines.length, 2);
          assert.equal(lines[1], "");
          assert.equal(
            JSON.parse(lines[0] ?? "null").summary.recoveryId,
            first.recoveryId,
          );
          const operation = read.value.snapshot.operations.find(
            (item) => item.recoveryId === first.recoveryId,
          );
          assert.ok(operation?.history);
          assert.equal(
            createHash("sha256").update(pendingBytes).digest("hex"),
            operation.history.lineSha256,
          );
          assert.deepEqual(fs.readFileSync(stateFile), beforeRead);
          assert.deepEqual(fs.readFileSync(historyPending), pendingBytes);
          if (markerBytes === null)
            assert.throws(() => fs.readFileSync(marker), { code: "ENOENT" });
          else assert.deepEqual(fs.readFileSync(marker), markerBytes);
        }
        const resumed = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          new AbortController().signal,
          first.recoveryId,
          "retain",
        );
        completion = resumed;
        if (cut === "state") {
          assert.equal(resumed.statePublication?.status, "completed");
          assert.equal(resumed.statePublication?.snapshotConfirmed, true);
        }
        // 同呼出しのexact出版を確認し、判断の再保存はしない。
        assert.equal(resumed.status, "observed");
        assert.equal(
          "retentionConfirmed" in resumed && resumed.retentionConfirmed,
          true,
        );
        assert.equal(resumed.historyConfirmed, true);
        const intended = (
          JSON.parse(
            Buffer.from(
              expected ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot
        ).operations.find(
          (operation) => operation.recoveryId === first.recoveryId,
        );
        assert.ok(
          intended?.kind === "runtime_repair" &&
            intended.retention &&
            lastRepairCompletionBefore,
        );
        assert.equal(
          resumed.retentionReviewAfter,
          intended.retention.reviewAfter,
        );
        assert.deepEqual(
          JSON.parse(lastRepairCompletionBefore.toString()).operations[0]
            .retention,
          intended.retention,
        );
        assert.equal(writeCalls, writes + 1);
      }
      assert.equal(acquireCount, acquired);
      assert.equal(runtimeEntries, entries);
      assert.throws(() => fs.lstatSync(marker), { code: "ENOENT" });
      assert.throws(() => fs.lstatSync(pending), { code: "ENOENT" });
      assert.throws(() => fs.lstatSync(historyPending), { code: "ENOENT" });
      const after = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      assert.ok(
        completion?.completionConfirmed &&
          completion.retentionReviewAfter &&
          lastRepairCompletionBefore,
      );
      const savedReceipt = JSON.parse(lastRepairCompletionBefore.toString())
        .operations[0].retention;
      assert.equal(
        Date.parse(savedReceipt.reviewAfter) -
          Date.parse(savedReceipt.decidedAt),
        604800000,
      );
      assert.equal(completion.retentionReviewAfter, savedReceipt.reviewAfter);
      assert.deepEqual(savedReceipt.targets, {
        primary: target.checkpoint.directories.primary.retained.identity,
        failed: target.checkpoint.directories.failed.retained.identity,
        auxiliary: target.checkpoint.directories.auxiliary.retained.identity,
      });
      const expectedCompletion = Buffer.from(
        `${canonicalJson({
          ...before,
          revision: before.revision + 4,
          previous: {
            revision: before.revision + 3,
            payloadSha256: createHash("sha256")
              .update(lastRepairCompletionBefore)
              .digest("hex"),
          },
          operations: before.operations.filter(
            (item: model.OperationRecord) =>
              item.recoveryId !== first.recoveryId,
          ),
        })}\n`,
      );
      assert.ok(fs.readFileSync(stateFile).equals(expectedCompletion));
      assert.equal(after.operations.length, 0);
      assert.deepEqual(after.unresolvedRecoveries, before.unresolvedRecoveries);
      assert.ok(after);
      assert.equal(Object.hasOwn(after, "pendingDeliveries"), false);
      assert.ok(before);
      assert.equal(Object.hasOwn(before, "pendingDeliveries"), false);
      assert.equal(after.revision, before.revision + 4);
      const history = fs.readFileSync(historyFile);
      const historyRead = domain.readRecoveryState(f.capability, {
        kind: "history",
      });
      assert.equal(historyRead.status, "completed", historyRead.reason);
      assert.equal(historyRead.lockReleased, true);
      assert.ok(historyRead.value && historyRead.historyRows);
      assert.equal(historyRead.historyRows.length, 1);
      assert.equal(historyRead.historyRows[0]?.line, history.toString("utf8"));
      const observed = retentionReads;
      assert.equal(observed, 1);
      for (const purpose of ["repair", "retain"] as const) {
        const duplicate = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          new AbortController().signal,
          first.recoveryId,
          purpose,
        );
        assert.equal(duplicate.status, "observed");
        assert.equal(duplicate.completionConfirmed, true);
        assert.equal(duplicate.retentionConfirmed, true);
        assert.equal(duplicate.retentionReviewAfter, savedReceipt.reviewAfter);
        assert.equal(duplicate.finalCheckpointConfirmed, false);
        assert.equal(duplicate.operationCleanupConfirmed, false);
        assert.equal(retentionReads, observed);
        assert.equal(acquireCount, acquired);
        assert.equal(runtimeEntries, entries);
        assert.ok(fs.readFileSync(historyFile).equals(history));
        assert.ok(fs.readFileSync(stateFile).equals(expectedCompletion));
      }
    });
  }
});

/**
 * 保存の拒否・確認不明・解放不明・例外で後続処理を止める。
 * @responsibility 耐久済み事実だけを保持し、保存失敗を再試行しない。
 * @trace ERB-IT-014
 * @precondition 実RootとWriter、DI Root入口はUsingと模擬Scope・技術境界へ差替える。
 * @stimulus Identity・初checkpoint・join後cleanupの三段階に四故障を注入。
 * @observation Writer要求数、注入到達、Machine観測、状態本文、遅延通知。
 * @oracle 各注入一回、後続Writer0、成功返却0、既存本文不変。
 * @cleanup 各自己生成Rootの不存在を終了時確認する。
 * @boundary 既存Writerの結果確認と呼出しOwner。
 */
test("Host Windows: 修復保存の各切断窓で未確認を成功へ補完しない", async (t) => {
  observeMode = "incomplete";
  for (const stage of ["identity", "checkpoint", "cleanup"] as const) {
    for (const kind of [
      "reject",
      "confirmation",
      "release",
      "throw",
    ] as const) {
      await t.test(`${stage}:${kind}`, async (subtest) => {
        const f = prepareRepairOwnerFixture(subtest);
        faultStage = stage;
        faultKind = kind;
        const result = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          new AbortController().signal,
        );
        assert.equal(faultHits, 1);
        assert.equal(writeCalls, faultedAt);
        assert.equal(result.status, "blocked");
        assert.equal(result.finalCheckpointConfirmed, false);
        assert.equal(result.outcomeConfirmed, false);
        assert.equal(result.operationCleanupConfirmed, true);
        assert.equal(observeCount, stage === "cleanup" ? 1 : 0);
        assert.equal(acquireCount, 1);
        const before = fs.existsSync(stateFile)
          ? fs.readFileSync(stateFile)
          : null;
        if (stage === "identity") assert.equal(before, null);
        else {
          assert.ok(before);
          const saved = JSON.parse(before.toString("utf8"));
          assert.equal(saved.operations[0].recoveryId, result.recoveryId);
          assert.equal(saved.operations[0].outcome, null);
          assert.equal(
            saved.operations[0].checkpoint?.cleanup ?? null,
            stage === "checkpoint" ? null : "pending",
          );
        }
        const callback = delayedCheckpoint;
        const savedCheckpoint = lastCheckpoint;
        if (callback && savedCheckpoint)
          assert.throws(
            () => callback(savedCheckpoint),
            /docker_repair_record_unconfirmed/u,
          );
        assert.equal(writeCalls, faultedAt);
        if (before) assert.ok(fs.readFileSync(stateFile).equals(before));
        else assert.equal(fs.existsSync(stateFile), false);
        faultStage = "none";
      });
    }
  }
});

/**
 * 実Writerの切断点を新呼出しから記録だけ確定する。
 * @responsibility Source分岐がNative／DIの再取得を発行しないことを実保存で確認する。
 * @trace ERB-IT-014
 * @precondition 実Root・Kernel・Writer、DI RootはUsingと模擬技術境界。
 * @stimulus Effect不明の一次失敗保存後、outcome保存だけ拒否して同exact再入場。
 * @observation 保存本文、版、DI入口とNative取得回数、返却値。
 * @oracle phaseとblocked outcomeだけ一版進み、技術入口0。
 * @cleanup 自作Rootの終了後不存在を確認する。
 * @boundary 実Filesystem保存と記録限定再入場。
 */
test("Host Windows: 保存済み一次失敗はNative再取得なしに記録だけを確定する", async (t) => {
  const f = prepareRepairOwnerFixture(t);
  observeMode = "effect_unknown";
  faultStage = "outcome";
  faultKind = "reject";
  const first = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
  );
  assert.equal(first.status, "blocked");
  assert.equal(first.finalCheckpointConfirmed, true);
  assert.equal(first.outcomeConfirmed, false);
  assert.equal(faultHits, 1);
  assert.ok(first.recoveryId);
  const before = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.deepEqual(before.operations[0].primaryFailure, {
    stage: "repair",
    reason: "runtime_repair_effect_unknown",
  });
  assert.equal(before.operations[0].checkpoint.cleanup, "confirmed");
  faultStage = "none";
  const entries = runtimeEntries,
    acquired = acquireCount,
    observed = observeCount,
    writes = writeCalls;
  const cancelled = new AbortController();
  cancelled.abort();
  const result = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    cancelled.signal,
    first.recoveryId,
  );
  assert.equal(result.status, "observed");
  assert.equal(result.outcomeConfirmed, true);
  assert.equal(result.operationCleanupConfirmed, true);
  assert.equal(runtimeEntries, entries);
  assert.equal(acquireCount, acquired);
  assert.equal(observeCount, observed);
  assert.equal(writeCalls, writes + 1);
  const after = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  assert.equal(after.revision, before.revision + 3);
  assert.equal(after.operations[0].phase, "settling");
  assert.deepEqual(after.operations[0].outcome, {
    status: "blocked",
    reason: "runtime_repair_effect_unknown",
    cleanupConfirmed: true,
  });
  assert.deepEqual(
    {
      ...after.operations[0],
      phase: "repairing",
      outcome: null,
      history: null,
      summarySha256: null,
    },
    before.operations[0],
  );
  assert.equal(result.historyConfirmed, true);
  assert.equal(result.completionConfirmed, false);
});

/**
 * 実出版後に残ったmarkerを同じ修復入口で回収する。
 * @responsibility 出版済み履歴のcurrent本文を保全し、技術再取得もしない。
 * @trace ERB-IT-014
 * @precondition 実Root・Kernel・Writer、自己生成Repositoryだけ。
 * @stimulus 履歴確認出版後のexact marker unlinkを一回拒否し、Abort済みで再入場。
 * @observation 実current本文、marker存在／不存在、WriterとDI回数、清掃診断。
 * @oracle markerだけ除去、current全文不変、再保存・技術要求0。
 * @cleanup unlink差替えを必ず復元し、自作Rootの不存在を確認。
 * @boundary 上位修復入口と既存marker清掃・通常Reader。
 */
test("Host Windows: 修復結果出版後のmarkerを再入場で回収する", async (t) => {
  const f = prepareRepairOwnerFixture(t);
  observeMode = "effect_unknown";
  faultStage = "outcome";
  const first = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
  );
  assert.ok(first.recoveryId);
  assert.equal(first.outcomeConfirmed, false);
  faultStage = "none";
  const marker = path.join(path.dirname(stateFile), "state.lock");
  const unlink = fs.unlinkSync;
  let hits = 0;
  const hook = mock.method(fs, "unlinkSync", (file: fs.PathLike) => {
    if (
      file === marker &&
      hits === 0 &&
      JSON.parse(fs.readFileSync(stateFile, "utf8")).operations[0]?.history
        ?.confirmed === true
    ) {
      hits++;
      throw new Error("synthetic_marker_unlink_failure");
    }
    return unlink(file);
  });
  const cancelled = new AbortController();
  cancelled.abort();
  try {
    const interrupted = await repairRuntimeOwnedDockerRuntime(
      f.capability,
      cancelled.signal,
      first.recoveryId,
    );
    assert.equal(interrupted.outcomeConfirmed, true);
  } finally {
    hook.mock.restore();
  }
  assert.equal(hits, 1);
  assert.equal(fs.lstatSync(marker).isFile(), true);
  const published = fs.readFileSync(stateFile);
  assert.equal(
    JSON.parse(published.toString("utf8")).operations[0].outcome.status,
    "blocked",
  );
  assert.equal(
    JSON.parse(published.toString("utf8")).operations[0].history.confirmed,
    true,
  );
  const historyFile = path.join(path.dirname(stateFile), "history.jsonl");
  const historyBytes = fs.readFileSync(historyFile);
  const writes = writeCalls,
    entries = runtimeEntries,
    acquired = acquireCount;
  const resumed = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    cancelled.signal,
    first.recoveryId,
  );
  assert.equal(resumed.status, "observed", JSON.stringify(resumed));
  assert.equal(resumed.historyConfirmed, true);
  assert.equal(resumed.historyLockReleased, true);
  assert.throws(() => fs.lstatSync(marker), { code: "ENOENT" });
  assert.ok(fs.readFileSync(stateFile).equals(published));
  assert.ok(fs.readFileSync(historyFile).equals(historyBytes));
  assert.equal(writeCalls, writes);
  assert.equal(runtimeEntries, entries);
  assert.equal(acquireCount, acquired);
  const fresh = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    cancelled.signal,
    first.recoveryId,
  );
  assert.equal(fresh.historyConfirmed, true);
  assert.equal(fresh.historyEffectIssued, false);
  assert.equal(fresh.historyLockReleased, true);
  assert.equal(writeCalls, writes);
  assert.equal(runtimeEntries, entries);
  assert.ok(fs.readFileSync(stateFile).equals(published));
  assert.ok(fs.readFileSync(historyFile).equals(historyBytes));
});

/**
 * 実Writerのrename前切断を新呼出しのmetadata出版で閉じる。
 * @responsibility 初回・checkpoint・outcomeと既出版同値を技術再取得から分離する。
 * @trace ERB-IT-014
 * @precondition 自作Repositoryと実Root／Kernel／Writer。技術境界だけを模擬。
 * @stimulus 各保存候補のrenameを一回拒否し、取消済み同IDで再入場する。
 * @observation pending全文、current明示有無、出版結果、短命物不存在、DI回数、旧Writer再要求。
 * @oracle exact候補だけ確定、技術要求増分0、旧元版再要求拒否、同値で改訂増加0。
 * @cleanup rename差替えを復元し、既存fixtureがRoot不存在を確認する。
 * @boundary 現在保存Ownerの出版と新Native Sessionの再開を区別する。
 */
test("Host Windows: 修復の未出版pendingをexact本文だけ確定する", async (t) => {
  for (const stage of ["identity", "checkpoint", "outcome"] as const) {
    await t.test(stage, async (subtest) => {
      const f = prepareRepairOwnerFixture(subtest);
      faultStage = "none";
      observeMode = stage === "outcome" ? "effect_unknown" : "incomplete";
      const rename = fs.renameSync;
      let hits = 0;
      let expected: Buffer | null = null;
      let old: Buffer | null = null;
      const hook = mock.method(
        fs,
        "renameSync",
        (from: fs.PathLike, to: fs.PathLike) => {
          if (to === stateFile && hits === 0) {
            const candidate = fs.readFileSync(from);
            const target = JSON.parse(candidate.toString("utf8")).operations[0];
            if (
              (stage === "identity" && target.checkpoint === null) ||
              (stage === "checkpoint" &&
                target.checkpoint?.cleanup === "pending") ||
              (stage === "outcome" && target.outcome !== null)
            ) {
              hits++;
              expected = candidate;
              old = fs.existsSync(stateFile)
                ? fs.readFileSync(stateFile)
                : null;
              throw new Error("synthetic_before_rename");
            }
          }
          return rename(from, to);
        },
      );
      let first: Awaited<ReturnType<typeof repairRuntimeOwnedDockerRuntime>>;
      try {
        first = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          new AbortController().signal,
        );
      } finally {
        hook.mock.restore();
      }
      assert.equal(hits, 1);
      assert.ok(expected && first.recoveryId);
      const pending = path.join(path.dirname(stateFile), "state.pending.json");
      const marker = path.join(path.dirname(stateFile), "state.lock");
      assert.ok(fs.readFileSync(pending).equals(expected));
      const cancelled = new AbortController();
      cancelled.abort();
      const acquired = acquireCount,
        entries = runtimeEntries,
        observed = observeCount;
      if (stage === "identity") {
        const history = path.join(path.dirname(stateFile), "history.jsonl");
        fs.writeFileSync(history, "", { flag: "wx" });
        const rejected = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          cancelled.signal,
          first.recoveryId,
        );
        assert.equal(rejected.statePublication?.status, "blocked");
        assert.equal(fs.existsSync(stateFile), false);
        assert.ok(fs.readFileSync(pending).equals(expected));
        fs.unlinkSync(history);
      }
      const publications: Buffer[] = [];
      const startedAt = Date.now();
      const publicationHook = mock.method(
        fs,
        "renameSync",
        (from: fs.PathLike, to: fs.PathLike) => {
          const candidate = to === stateFile ? fs.readFileSync(from) : null;
          rename(from, to);
          if (candidate) publications.push(Buffer.from(candidate));
        },
      );
      let result: Awaited<ReturnType<typeof repairRuntimeOwnedDockerRuntime>>;
      try {
        result = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          cancelled.signal,
          first.recoveryId,
        );
      } finally {
        publicationHook.mock.restore();
      }
      const finishedAt = Date.now();
      assert.ok(publications[0]?.equals(expected));
      const publicationExpected = Buffer.from(expected);
      let finalExpected: Buffer = publicationExpected;
      let expectedHistory: Buffer | null = null;
      if (stage === "outcome") {
        assert.equal(publications.length, 3);
        const historyAt = JSON.parse(publications[1]?.toString("utf8") ?? "")
          .operations[0].history.occurredAt;
        assert.equal(new Date(historyAt).toISOString(), historyAt);
        assert.ok(Date.parse(historyAt) >= startedAt);
        assert.ok(Date.parse(historyAt) <= finishedAt);
        const repository =
          bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(
            f.capability,
          );
        assert.ok(repository);
        const settled = JSON.parse(publicationExpected.toString("utf8"))
          .operations[0];
        const identity = JSON.parse(settled.identityJson);
        const checkpoint = settled.checkpoint;
        assert.ok(checkpoint);
        // 保存Schemaの全fieldを明示する独立Oracle。モデルの内部生成関数を呼ばない。
        const summaryValue = {
          schema: "crdd-coordinator/repair-summary/v1",
          operationId: identity.operationId,
          operationNonce: identity.operationNonce,
          recoveryId: first.recoveryId,
          identitySha256: settled.identitySha256,
          primaryFailure: settled.primaryFailure,
          outcome: settled.outcome,
          disposition: settled.disposition,
          ...(settled.retention !== undefined
            ? { retention: settled.retention }
            : {}),
          ...(settled.disposition === "discard"
            ? { disposal: settled.disposal }
            : {}),
          technical: {
            actions: checkpoint.actions,
            engine: checkpoint.engine,
            stale: checkpoint.stale,
            hostSafety: checkpoint.hostSafety,
            cleanup: checkpoint.cleanup,
            cleanupFailure: checkpoint.cleanupFailure,
          },
        };
        const summary = {
          summarySha256: createHash("sha256")
            .update(`${canonicalJson(summaryValue)}\n`)
            .digest("hex"),
        };
        expectedHistory = Buffer.from(
          `${canonicalJson({ schema: "crdd-coordinator/history-row/v2", occurredAt: historyAt, summary: summaryValue })}\n`,
        );
        const lineSha256 = createHash("sha256")
          .update(expectedHistory)
          .digest("hex");
        const checkpointExpected = publications[1],
          confirmedExpected = publications[2];
        assert.ok(checkpointExpected && confirmedExpected);
        const initial = JSON.parse(publicationExpected.toString("utf8")),
          checkpointValue = JSON.parse(checkpointExpected.toString("utf8"));
        assert.deepEqual(checkpointValue, {
          ...initial,
          revision: initial.revision + 1,
          previous: {
            revision: initial.revision,
            payloadSha256: createHash("sha256").update(expected).digest("hex"),
          },
          operations: initial.operations.map((item: model.OperationRecord) =>
            item.recoveryId === first.recoveryId
              ? {
                  ...item,
                  summarySha256: summary.summarySha256,
                  history: {
                    occurredAt: historyAt,
                    lineSha256,
                    confirmed: false,
                  },
                }
              : item,
          ),
        });
        assert.deepEqual(JSON.parse(confirmedExpected.toString("utf8")), {
          ...checkpointValue,
          revision: checkpointValue.revision + 1,
          previous: {
            revision: checkpointValue.revision,
            payloadSha256: createHash("sha256")
              .update(checkpointExpected)
              .digest("hex"),
          },
          operations: checkpointValue.operations.map(
            (item: model.OperationRecord) =>
              item.recoveryId === first.recoveryId
                ? {
                    ...item,
                    history: {
                      occurredAt: historyAt,
                      lineSha256,
                      confirmed: true,
                    },
                  }
                : item,
          ),
        });
        finalExpected = confirmedExpected;
        assert.ok(
          fs
            .readFileSync(path.join(path.dirname(stateFile), "history.jsonl"))
            .equals(expectedHistory),
        );
        assert.equal(
          expectedHistory.toString("utf8").trimEnd().split("\n").length,
          1,
        );
        const originalState = JSON.parse(publicationExpected.toString("utf8"));
        const finalState = JSON.parse(finalExpected.toString("utf8"));
        assert.equal(finalState.revision, originalState.revision + 2);
        const {
          history: _oldHistory,
          summarySha256: _oldSummary,
          ...originalOperation
        } = originalState.operations[0];
        const {
          history: _newHistory,
          summarySha256: _newSummary,
          ...finalOperation
        } = finalState.operations[0];
        assert.deepEqual(finalOperation, originalOperation);
        assert.deepEqual(
          finalState.operations.slice(1),
          originalState.operations.slice(1),
        );
        assert.equal(result.historyConfirmed, true);
        assert.equal(result.completionConfirmed, false);
      } else {
        assert.equal(publications.length, 1);
      }
      assert.equal(observeCount, observed);
      assert.equal(result.statePublication?.status, "completed");
      assert.equal(result.statePublication?.snapshotConfirmed, true);
      assert.equal(result.statePublication?.lockReleased, true);
      assert.equal(acquireCount, acquired);
      assert.equal(runtimeEntries, entries);
      assert.ok(fs.readFileSync(stateFile).equals(finalExpected));
      assert.throws(() => fs.lstatSync(pending), { code: "ENOENT" });
      assert.throws(() => fs.lstatSync(marker), { code: "ENOENT" });
      const late = stateStore.saveRepairState(
        f.capability,
        first.recoveryId,
        {
          expected: repairVersion(old),
          change: {
            kind: "create",
            identityJson: JSON.parse(publicationExpected.toString("utf8"))
              .operations[0].identityJson,
          },
        },
        () => true,
      );
      assert.equal(late.status, "blocked");
      assert.equal(late.snapshotConfirmed, false);
      assert.ok(fs.readFileSync(stateFile).equals(finalExpected));
      // 既出版と同じ本文を持つ重複短命材料の有限形を、同じ正規bytesから構成する。
      const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      fs.writeFileSync(pending, fs.readFileSync(stateFile), { flag: "wx" });
      fs.writeFileSync(
        marker,
        `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: saved.repositoryBinding })}\n`,
        { flag: "wx" },
      );
      const same = await repairRuntimeOwnedDockerRuntime(
        f.capability,
        cancelled.signal,
        first.recoveryId,
      );
      assert.equal(same.statePublication?.status, "completed");
      assert.equal(observeCount, observed);
      if (expectedHistory) {
        assert.ok(
          fs
            .readFileSync(path.join(path.dirname(stateFile), "history.jsonl"))
            .equals(expectedHistory),
        );
      }
      assert.ok(fs.readFileSync(stateFile).equals(finalExpected));
      assert.equal(
        JSON.parse(fs.readFileSync(stateFile, "utf8")).revision,
        saved.revision,
      );
      assert.throws(() => fs.lstatSync(pending), { code: "ENOENT" });
      assert.throws(() => fs.lstatSync(marker), { code: "ENOENT" });
      assert.equal(acquireCount, acquired);
      assert.equal(runtimeEntries, entries);
    });
  }
});

/**
 * 読取り排他とWriter排他の間の同bytes別実体を拒否する。
 * @responsibility 最初の読取りを保存Authorityにしない。
 * @trace ERB-IT-014
 * @precondition 実Root・Kernel・出版済み同値の短命材料。
 * @stimulus 読取り最終列挙後のOwner確認でcurrentを同bytes新実体へ差替える。
 * @observation 注入一回、物理Writer拒否、current／pending全文、後続Native0。
 * @oracle 同bytesでも実体差を拒否し、fresh再入場だけで再観測する。
 * @cleanup fs差替えを復元し、既知の退避物を削除、自作Rootは既存fixtureが回収。
 * @boundary 読取りとWriterの短期排他間。
 */
test("Host Windows: 修復出版は排他間の同bytes実体差を拒否する", async (t) => {
  const f = prepareRepairOwnerFixture(t);
  faultStage = "none";
  observeMode = "effect_unknown";
  const first = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
  );
  assert.ok(first.recoveryId);
  const bytes = fs.readFileSync(stateFile);
  const snapshot = JSON.parse(bytes.toString("utf8"));
  const directory = path.dirname(stateFile);
  const pending = path.join(directory, "state.pending.json");
  const marker = path.join(directory, "state.lock");
  fs.writeFileSync(pending, bytes, { flag: "wx" });
  fs.writeFileSync(
    marker,
    `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: snapshot.repositoryBinding })}\n`,
    { flag: "wx" },
  );
  const readdir = fs.readdirSync;
  let enumerations = 0,
    swaps = 0;
  const displaced = path.join(
    f.root,
    ".crdd",
    "tests",
    "superseded-state.json",
  );
  const hook = mock.method(fs, "readdirSync", ((
    ...args: Parameters<typeof fs.readdirSync>
  ) => {
    const result = Reflect.apply(readdir, fs, args);
    if (args[0] === directory) enumerations++;
    return result;
  }) as typeof fs.readdirSync);
  let result: ReturnType<typeof stateStore.resumeRepairPublication>;
  try {
    result = stateStore.resumeRepairPublication(
      historyRepositoryInput(f.capability),
      first.recoveryId,
      () => {
        if (enumerations >= 2 && swaps === 0) {
          swaps++;
          fs.renameSync(stateFile, displaced);
          fs.writeFileSync(stateFile, bytes, { flag: "wx" });
        }
        return true;
      },
    );
  } finally {
    hook.mock.restore();
  }
  assert.equal(swaps, 1);
  assert.equal(result.status, "blocked");
  assert.equal(result.filesystemEffectIssued, false);
  assert.ok(fs.readFileSync(stateFile).equals(bytes));
  assert.ok(fs.readFileSync(pending).equals(bytes));
  fs.unlinkSync(displaced);
  const acquired = acquireCount,
    entries = runtimeEntries;
  const cancelled = new AbortController();
  cancelled.abort();
  const fresh = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    cancelled.signal,
    first.recoveryId,
  );
  assert.equal(fresh.statePublication?.status, "completed");
  assert.ok(fs.readFileSync(stateFile).equals(bytes));
  assert.equal(acquireCount, acquired);
  assert.equal(runtimeEntries, entries);
});

/**
 * Identity追加と新Session候補を実Writerと用途誤配線変異で確認する。
 * @responsibility モデル分類成功だけを物理出版の根拠にしない。
 * @trace ERB-IT-014
 * @precondition 実Producerの正常未終端checkpointと正規の非対象Repair fixture。
 * @stimulus exact pendingを出版し、用途を通常checkpointへ誤配線する変異も与える。
 * @observation private Context→実Writer、全本文、短命物、非対象・history・版相関。
 * @oracle 正規Sourceだけ出版、変異拒否、技術再取得0、未回収を成功化しない。
 * @cleanup Production不変更。自作Rootと短命fixtureは既存回収へ結合。
 * @boundary 試験限定VMの実Module本文→実Root／Kernel／Filesystem。
 */
test("Host Windows: 修復出版のIdentity追加とSession用途を物理接続する", async (t) => {
  for (const mode of ["identity", "session_begin"] as const) {
    await t.test(mode, async (subtest) => {
      const f = prepareRepairOwnerFixture(subtest);
      faultStage = "none";
      observeMode = "incomplete";
      const first = await repairRuntimeOwnedDockerRuntime(
        f.capability,
        new AbortController().signal,
      );
      assert.ok(first.recoveryId);
      const saved = JSON.parse(fs.readFileSync(stateFile, "utf8"));
      const binding = saved.repositoryBinding as string;
      let before = fs.readFileSync(stateFile);
      let candidate: Buffer | null;
      let id = first.recoveryId;
      if (mode === "identity") {
        const original = saved.operations[0];
        // 正規の非対象終端Repairを含むfixture。実処置の履歴を捏造するものではない。
        const other = {
          ...original,
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
          `${canonicalJson({ ...saved, operations: [other] })}\n`,
        );
        // 合法な複数RepairはEMのruntime-repair-storage「修復専用Ownerは偽Taskなしで同じ状態Writerを使う」。ここは後続createの受理と対象外保持を検証する。
        fs.writeFileSync(stateFile, before);
        const originalIdentity = JSON.parse(original.identityJson);
        const identity = `${JSON.stringify({ ...originalIdentity, operationNonce: originalIdentity.operationNonce === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64), operationId: "OP-999999" })}\n`;
        const identityValue = JSON.parse(identity);
        id = `docker-runtime-repair.${identityValue.operationNonce}.${createHash("sha256").update(identity).digest("hex")}`;
        const created = stateStore.saveRepairState(
          f.capability,
          id,
          {
            expected: repairVersion(before),
            change: { kind: "create", identityJson: identity },
          },
          () => true,
        );
        assert.equal(created.status, "completed", created.reason);
        assert.equal(created.snapshotConfirmed, true);
        assert.equal(created.lockReleased, true);
        candidate = fs.readFileSync(stateFile);
        const added = (
          JSON.parse(
            Buffer.from(
              candidate ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot
        ).operations.find((item) => item.recoveryId !== first.recoveryId);
        assert.ok(added);
        assert.equal(added.recoveryId, id);
        assert.equal(added.identityJson, identity);
        assert.equal(added.phase, "repairing");
        assert.equal(added.checkpoint, null);
      } else {
        const original = saved.operations.find(
          (item: model.OperationRecord) => item.recoveryId === id,
        );
        assert.ok(original?.checkpoint);
        assert.equal(original.checkpoint.cleanup, "confirmed");
        assert.equal(original.checkpoint.cleanupFailure, null);
        const checkpoint = { ...original.checkpoint, cleanup: "pending" };
        const begun = stateStore.saveRepairState(
          f.capability,
          id,
          {
            expected: repairVersion(before),
            change: { kind: "session_begin", checkpoint },
          },
          () => true,
        );
        assert.equal(begun.status, "completed", begun.reason);
        assert.equal(begun.snapshotConfirmed, true);
        assert.equal(begun.lockReleased, true);
        candidate = fs.readFileSync(stateFile);
        const result = (
          JSON.parse(
            Buffer.from(
              candidate ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot
        ).operations.find((item) => item.recoveryId === id);
        assert.ok(result?.kind === "runtime_repair");
        assert.deepEqual(result, { ...original, checkpoint });
      }
      const beforeCandidate = {
          snapshot: JSON.parse(
            Buffer.from(
              before ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
          payloadSha256: createHash("sha256")
            .update(before ?? assert.fail("missing_fixture_bytes"))
            .digest("hex"),
          sourceText: Buffer.from(
            before ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        },
        recorded = {
          snapshot: JSON.parse(
            Buffer.from(
              candidate ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
        };
      assert.ok(beforeCandidate && recorded);
      assert.equal(
        recorded.snapshot.revision,
        beforeCandidate.snapshot.revision + 1,
      );
      assert.deepEqual(recorded.snapshot.previous, {
        revision: beforeCandidate.snapshot.revision,
        payloadSha256: beforeCandidate.payloadSha256,
      });
      assert.deepEqual(
        recorded.snapshot.operations.filter((item) => item.recoveryId !== id),
        beforeCandidate.snapshot.operations.filter(
          (item) => item.recoveryId !== id,
        ),
      );
      const {
        operations: _priorOperations,
        revision: _priorRevision,
        previous: _priorPrevious,
        ...priorSections
      } = beforeCandidate.snapshot;
      const {
        operations: _recordedOperations,
        revision: _recordedRevision,
        previous: _recordedPrevious,
        ...recordedSections
      } = recorded.snapshot;
      assert.deepEqual(recordedSections, priorSections);
      for (const file of [
        "state.pending.json",
        "state.lock",
        "history.pending.jsonl",
      ])
        assert.equal(
          fs.existsSync(path.join(path.dirname(stateFile), file)),
          false,
        );
      // 確認済み・解放済みの正規段階だけを、自己生成Rootの切断fixtureとして再配置する。
      fs.writeFileSync(stateFile, before);
      const directory = path.dirname(stateFile);
      const pending = path.join(directory, "state.pending.json"),
        marker = path.join(directory, "state.lock"),
        history = path.join(directory, "history.jsonl");
      fs.writeFileSync(pending, candidate, { flag: "wx" });
      fs.writeFileSync(
        marker,
        `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: binding })}\n`,
        { flag: "wx" },
      );
      const historyBytes = Buffer.from(
        `${canonicalJson({
          schema: "crdd-coordinator/history-row/v2",
          occurredAt: "2026-10-16T00:00:00.000Z",
          summary: {
            schema: "crdd-coordinator/operation-summary/v2",
            operationId: "OP-111111",
            operationNonce: "1".repeat(64),
            recoveryId: `docker-task.${"a".repeat(64)}.${"1".repeat(64)}.${"2".repeat(64)}`,
            identitySha256: "2".repeat(64),
            primaryFailure: null,
            execution: {
              providerStart: "not_started",
              externalSend: "not_issued",
              sharedWrite: "not_issued",
              ownerEffect: "disabled",
              workspaceReusable: false,
            },
            outcome: {
              status: "cancelled",
              reason: "provider_operation_cancelled",
              cleanupConfirmed: true,
            },
            hostCleanup: "confirmed",
            lease: "released",
          },
        })}\n`,
      );
      // 旧Task行の形式はEM codec試験が所有し、ここでは出版後の実履歴を確認する。
      fs.writeFileSync(history, historyBytes, { flag: "wx" });
      const acquired = acquireCount,
        entries = runtimeEntries,
        observed = observeCount;
      // 同じ有限形を本番compositionからも通し、publisherのcompletedを保持する。
      const cancelled = new AbortController();
      cancelled.abort();
      const throughMain = await repairRuntimeOwnedDockerRuntime(
        f.capability,
        cancelled.signal,
        id,
      );
      assert.equal(throughMain.statePublication?.status, "completed");
      assert.equal(throughMain.statePublication?.snapshotConfirmed, true);
      assert.equal(throughMain.statePublication?.lockReleased, true);
      const historyRead = domain.readRecoveryState(f.capability, {
        kind: "history",
      });
      assert.equal(historyRead.status, "completed", historyRead.reason);
      assert.equal(historyRead.lockReleased, true);
      assert.ok(historyRead.value && historyRead.historyRows);
      assert.equal(historyRead.historyRows.length, 1);
      assert.equal(
        historyRead.historyRows[0]?.line,
        historyBytes.toString("utf8"),
      );
      assert.ok(fs.readFileSync(stateFile).equals(candidate));
      assert.equal(fs.existsSync(pending), false);
      assert.equal(fs.existsSync(marker), false);
      assert.equal(acquireCount, acquired);
      assert.equal(runtimeEntries, entries);
      assert.equal(observeCount, observed);
      assert.ok(fs.readFileSync(history).equals(historyBytes));
      const prior = {
          snapshot: JSON.parse(
            Buffer.from(
              before ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
          payloadSha256: createHash("sha256")
            .update(before ?? assert.fail("missing_fixture_bytes"))
            .digest("hex"),
          sourceText: Buffer.from(
            before ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        },
        next = {
          snapshot: JSON.parse(
            Buffer.from(
              candidate ?? assert.fail("missing_fixture_bytes"),
            ).toString("utf8"),
          ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
        };
      assert.ok(prior && next);
      assert.equal(next.snapshot.revision, prior.snapshot.revision + 1);
      assert.deepEqual(next.snapshot.previous, {
        revision: prior.snapshot.revision,
        payloadSha256: prior.payloadSha256,
      });
      assert.deepEqual(
        next.snapshot.unresolvedRecoveries,
        prior.snapshot.unresolvedRecoveries,
      );
      assert.ok(next.snapshot);
      assert.equal(Object.hasOwn(next.snapshot, "pendingDeliveries"), false);
      assert.ok(prior.snapshot);
      assert.equal(Object.hasOwn(prior.snapshot, "pendingDeliveries"), false);
      if (mode === "identity")
        assert.deepEqual(
          next.snapshot.operations.filter((item) => item.recoveryId !== id),
          prior.snapshot.operations,
        );
      else {
        const old = prior.snapshot.operations[0],
          current = next.snapshot.operations[0];
        assert.ok(
          old?.kind === "runtime_repair" && current?.kind === "runtime_repair",
        );
        assert.equal(current.checkpoint?.cleanup, "pending");
        assert.deepEqual({ ...current, checkpoint: old.checkpoint }, old);
        const stillBlocked = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          new AbortController().signal,
          id,
        );
        assert.equal(stillBlocked.status, "blocked");
        assert.equal(acquireCount, acquired);
        assert.equal(observeCount, observed);
        assert.ok(fs.readFileSync(stateFile).equals(candidate));
      }
    });
  }
});

/**
 * 実修復Callerから専用履歴と再入場へ接続する。
 * @responsibility 修復Ownerと公開保存APIを実Root／Kernel／Filesystemで照合する。
 * @trace ERB-IT-014
 * @precondition 自己生成Repositoryの修復処置済み状態。Docker技術境界は模擬。
 * @stimulus 正常出版、五有限形と五つの保存中断点から同IDで再入場する。
 * @observation state／history／短命File、時刻・Hash、既知Effect、排他解放・Kernel回数、対象外全文、技術入口増分。
 * @oracle exact一段確定、確認済み欠測の再追加0、発行後事実保全、技術再実行0、対象外全文不変。
 * @cleanup 自作Rootだけを実体確認後に削除し不存在を確認する。
 * @boundary 実保存境界。実Docker修復・Provider E2Eの証明ではない。
 */
test("Host Windows: 修復履歴は専用Ownerで固定しfresh出版する", async (t) => {
  const f = prepareRepairOwnerFixture(t);
  observeMode = "ready";
  faultStage = "none";
  const result = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
  );
  assert.ok(
    result.recoveryId && result.outcomeConfirmed,
    JSON.stringify({
      result,
      writeCalls,
      acquireCount,
      observeCount,
      lastRuntimeResult,
      lastWriteResult,
    }),
  );
  assert.equal(result.historyConfirmed, true);
  const id = result.recoveryId;
  const borrowed = bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(
    f.capability,
  );
  assert.ok(borrowed);
  assert.ok(lastOutcomeCheckpoint);
  // 保存部の切断fixtureには、実Writerが確定した履歴開始前の版を使う。
  const original = Buffer.from(lastOutcomeCheckpoint);
  fs.writeFileSync(stateFile, original);
  const initialHistoryFile = path.join(
    path.dirname(stateFile),
    "history.jsonl",
  );
  const initialHistory = fs.readFileSync(initialHistoryFile);
  const historyRead = domain.readRecoveryState(f.capability, {
    kind: "history",
  });
  assert.equal(historyRead.status, "completed", historyRead.reason);
  assert.equal(historyRead.lockReleased, true);
  assert.ok(historyRead.value && historyRead.historyRows);
  assert.equal(historyRead.historyRows.length, 1);
  assert.equal(
    historyRead.historyRows[0]?.line,
    initialHistory.toString("utf8"),
  );
  fs.unlinkSync(initialHistoryFile);
  const decoded = {
    snapshot: JSON.parse(
      Buffer.from(original ?? assert.fail("missing_fixture_bytes")).toString(
        "utf8",
      ),
    ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
  };
  const operation = decoded?.snapshot.operations.find(
    (item) => item.recoveryId === id,
  );
  assert.ok(operation?.kind === "runtime_repair");
  const repository = {
    ...borrowed,
    operationId: JSON.parse(operation.identityJson).operationId as string,
  };
  const acquired = acquireCount,
    entries = runtimeEntries;
  assert.equal(
    stateStore.readRecoveryState(historyRepositoryInput(f.capability), {
      kind: "execution_history",
      recoveryId: id,
    }).status,
    "blocked",
  );
  const taskResult = stateStore.advanceOwnedRecoveryHistory(
    { ...repository, ...withHistoryRetention(repository, f.capability) },
    id,
    () => true,
  );
  assert.equal(taskResult.status, "blocked");
  assert.ok(fs.readFileSync(stateFile).equals(original));
  const first = stateStore;
  const observed = first.readRecoveryState(
    historyRepositoryInput(f.capability),
    { kind: "repair_history", recoveryId: id },
  );
  assert.equal(observed.status, "completed");
  assert.equal(observed.currentHistoryPublication?.stage, "checkpoint");
  assert.equal(
    observed.currentHistoryPublication?.operationKind,
    "runtime_repair",
  );
  const fixed = first.advanceOwnedRepairHistory(
    { ...repository, ...withHistoryRetention(repository, f.capability) },
    id,
    () => true,
  );
  assert.equal(fixed.status, "completed");
  assert.equal(fixed.historyConfirmed, false);
  assert.equal(fixed.lockReleased, true);
  const checkpointBytes = fs.readFileSync(stateFile);
  const checkpoint = model.readRecoveryState(f.capability).value;
  const fixedOperation = checkpoint?.snapshot.operations.find(
    (item) => item.recoveryId === id,
  );
  assert.ok(fixedOperation?.history && !fixedOperation.history.confirmed);
  const second = stateStore;
  assert.equal(
    second.readRecoveryState(historyRepositoryInput(f.capability), {
      kind: "repair_history",
      recoveryId: id,
    }).currentHistoryPublication?.stage,
    "publish",
  );
  const published = second.advanceOwnedRepairHistory(
    { ...repository, ...withHistoryRetention(repository, f.capability) },
    id,
    () => true,
  );
  assert.equal(published.status, "completed");
  assert.equal(published.historyConfirmed, true);
  assert.equal(published.lockReleased, true);
  const currentBytes = fs.readFileSync(stateFile);
  const current = model.readRecoveryState(f.capability).value;
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
  const publishedRead = domain.readRecoveryState(f.capability, {
    kind: "history",
  });
  assert.equal(publishedRead.status, "completed", publishedRead.reason);
  assert.equal(publishedRead.lockReleased, true);
  assert.ok(publishedRead.value && publishedRead.historyRows);
  const rows = publishedRead.historyRows;
  assert.equal(rows?.length, 1);
  assert.equal(rows?.[0]?.recoveryId, id);
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
        const bytes = Buffer.from(`${canonicalJson(row)}\n`);
        fs.writeFileSync(historyFile, bytes);
        const otherRead = domain.readRecoveryState(f.capability, {
          kind: "history",
        });
        assert.equal(otherRead.status, "completed", otherRead.reason);
        assert.equal(otherRead.lockReleased, true);
        assert.ok(otherRead.value && otherRead.historyRows);
        assert.equal(otherRead.historyRows.length, 1);
        assert.equal(
          otherRead.historyRows[0]?.recoveryId,
          row.summary.recoveryId,
        );
        assert.equal(otherRead.historyRows[0]?.line, bytes.toString("utf8"));
      }
      const read = stateStore.readRecoveryState(
        historyRepositoryInput(f.capability),
        { kind: "repair_history", recoveryId: id },
      );
      const valid = historyCase === "empty" || historyCase === "other";
      assert.equal(read.status, valid ? "completed" : "blocked");
      assert.equal(read.repairHistoryState, valid ? "technical_state" : null);
      assert.equal(read.currentHistoryPublication, null);
      if (!valid) {
        const beforeCalls = writeCalls;
        const stopped = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          new AbortController().signal,
          id,
        );
        assert.equal(stopped.status, "blocked");
        assert.equal(writeCalls, beforeCalls);
        assert.equal(acquireCount, acquired);
        assert.equal(runtimeEntries, entries);
        assert.ok(fs.readFileSync(stateFile).equals(technicalBytes));
      }
    });
  }
  const technicalPending = path.join(
    path.dirname(stateFile),
    "history.pending.jsonl",
  );
  if (fs.existsSync(technicalPending)) fs.unlinkSync(technicalPending);
  fs.writeFileSync(stateFile, currentBytes);
  fs.writeFileSync(historyFile, historyBytes);
  const third = stateStore;
  const confirmed = third.advanceOwnedRepairHistory(
    { ...repository, ...withHistoryRetention(repository, f.capability) },
    id,
    () => true,
  );
  assert.equal(confirmed.status, "completed");
  assert.equal(confirmed.filesystemEffectIssued, false);
  assert.equal(confirmed.historyConfirmed, true);
  assert.ok(fs.readFileSync(stateFile).equals(currentBytes));
  assert.ok(fs.readFileSync(historyFile).equals(historyBytes));
  const directory = path.dirname(stateFile);
  const markerBytes = Buffer.from(
    `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
  );
  for (const cut of [
    "checkpoint_pending",
    "history_pending",
    "history_renamed",
    "confirmed_marker",
    "confirmed_missing",
  ] as const) {
    await t.test(cut, async () => {
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
        cut === "checkpoint_pending"
          ? original
          : cut === "confirmed_marker" || cut === "confirmed_missing"
            ? currentBytes
            : checkpointBytes,
      );
      if (cut === "checkpoint_pending")
        fs.writeFileSync(
          path.join(directory, "state.pending.json"),
          checkpointBytes,
        );
      if (cut === "history_pending")
        fs.writeFileSync(
          path.join(directory, "history.pending.jsonl"),
          historyBytes,
        );
      if (cut === "history_renamed" || cut === "confirmed_marker")
        fs.writeFileSync(historyFile, historyBytes);
      if (cut !== "history_renamed" && cut !== "confirmed_missing")
        fs.writeFileSync(path.join(directory, "state.lock"), markerBytes);
      const fresh = stateStore;
      const before = fs.readFileSync(stateFile);
      const observation = fresh.readRecoveryState(
        historyRepositoryInput(f.capability),
        { kind: "repair_history", recoveryId: id },
      );
      assert.equal(observation.status, "completed");
      const settled = await repairRuntimeOwnedDockerRuntime(
        f.capability,
        new AbortController().signal,
        id,
      );
      assert.equal(
        settled.status,
        cut === "confirmed_missing" ? "blocked" : "observed",
      );
      assert.equal(settled.completionLockReleased, true);
      assert.equal(settled.historyConfirmed, true);
      assert.equal(settled.completionConfirmed, cut !== "confirmed_missing");
      const confirmedState = {
        snapshot: JSON.parse(
          Buffer.from(
            currentBytes ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
        payloadSha256: createHash("sha256")
          .update(currentBytes ?? assert.fail("missing_fixture_bytes"))
          .digest("hex"),
        sourceText: Buffer.from(
          currentBytes ?? assert.fail("missing_fixture_bytes"),
        ).toString("utf8"),
      };
      assert.ok(confirmedState);
      assert.equal(
        confirmedState.snapshot.operations.filter(
          (item) => item.recoveryId === id,
        ).length,
        1,
      );
      const expected =
        cut === "confirmed_missing"
          ? currentBytes
          : Buffer.from(
              `${canonicalJson({
                ...confirmedState.snapshot,
                revision: confirmedState.snapshot.revision + 1,
                previous: {
                  revision: confirmedState.snapshot.revision,
                  payloadSha256: confirmedState.payloadSha256,
                },
                operations: confirmedState.snapshot.operations.filter(
                  (item) => item.recoveryId !== id,
                ),
              })}\n`,
            );
      assert.ok(expected);
      assert.ok(fs.readFileSync(stateFile).equals(expected));
      if (cut === "confirmed_missing") {
        assert.equal(settled.historyEffectIssued, false);
        assert.ok(fs.readFileSync(stateFile).equals(before));
        assert.equal(fs.existsSync(historyFile), false);
      } else assert.ok(fs.readFileSync(historyFile).equals(historyBytes));
      for (const name of [
        "state.pending.json",
        "history.pending.jsonl",
        "state.lock",
      ])
        assert.equal(fs.existsSync(path.join(directory, name)), false);
    });
  }
  assert.equal(acquireCount, acquired);
  assert.equal(runtimeEntries, entries);
});

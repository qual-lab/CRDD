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
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test, { mock, type TestContext } from "node:test";
import { createHash } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { runInThisContext } from "node:vm";
import { types } from "node:util";
import * as model from "../../src/storage/model.ts";
import * as domain from "../../../domain-model/src/index.ts";
import * as versionControl from "../../../version-control/src/index.ts";
import * as bindings from "../../src/workspace/binding.ts";
import * as kernel from "../../src/execution/kernel-lock.ts";
import * as stateStore from "../../src/storage/settlement-store.ts";
import * as isolation from "../../../docker-isolation/src/index.ts";
import { runDockerRuntimeRepairSessionUsing } from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";

let acquireCount = 0;
let scope = "c".repeat(64);
let observeCount = 0;
let stateFile = "";
let delayedCheckpoint:
  | Parameters<
      typeof isolation.runDockerRuntimeRepairSession
    >[0]["onCheckpoint"]
  | null = null;
let lastCheckpoint: isolation.DockerRuntimeRepairCheckpoint | null = null;
let lastRuntimeResult: Awaited<
  ReturnType<typeof runDockerRuntimeRepairSessionUsing>
> | null = null;
const owner = "b".repeat(64);
let observeMode: "ready" | "incomplete" | "effect_unknown" | "retained" =
  "incomplete";
let runtimeEntries = 0;
let writeCalls = 0;
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
mock.module("../../src/storage/settlement-store.ts", {
  namedExports: {
    ...stateStore,
    completeRuntimeOwnedCoordinatorRepair: (
      ...args: Parameters<
        typeof stateStore.completeRuntimeOwnedCoordinatorRepair
      >
    ) => {
      lastRepairCompletionBefore = fs.readFileSync(stateFile);
      return stateStore.completeRuntimeOwnedCoordinatorRepair(...args);
    },
    writeRuntimeOwnedCoordinatorRepairSnapshot: (
      ...args: Parameters<
        typeof stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot
      >
    ) => {
      writeCalls++;
      const candidate = JSON.parse(args[3].toString("utf8"));
      const target = candidate.operations.find(
        (value: { recoveryId: string }) => value.recoveryId === args[1],
      );
      if (
        (args[5] === "disposal_decision" && pauseBeforeDisposal) ||
        (args[5] === "disposal_primary" &&
          refuseDisposalProgress &&
          target.disposal?.checkpoint.directories.primary.absence ===
            "confirmed_absent")
      ) {
        if (args[5] === "disposal_primary") refuseDisposalProgress = false;
        return stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
          null,
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
        );
      }
      const matches =
        faultStage === "identity"
          ? target.checkpoint === null
          : faultStage === "checkpoint"
            ? target.checkpoint?.cleanup === "pending"
            : faultStage === "cleanup"
              ? target.checkpoint?.cleanup === "confirmed" &&
                target.outcome === null
              : faultStage === "outcome"
                ? target.outcome !== null
                : false;
      if (matches && faultHits === 0) {
        faultHits++;
        faultedAt = writeCalls;
        if (faultKind === "throw") throw new Error("synthetic_writer_failure");
        const rejected = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
          null,
          args[1],
          args[2],
          args[3],
          args[4],
          args[5],
        );
        if (faultKind === "reject") return rejected;
        return {
          ...rejected,
          status: "completed",
          snapshotConfirmed: faultKind === "release",
          lockReleased: faultKind !== "release",
        };
      }
      const saved = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
        ...args,
      );
      if (
        saved.status === "completed" &&
        saved.snapshotConfirmed &&
        target?.outcome !== null &&
        target?.history === null
      )
        lastOutcomeCheckpoint = Buffer.from(args[3]);
      if (
        saved.status === "completed" &&
        saved.snapshotConfirmed &&
        target?.outcome === null &&
        target?.checkpoint?.cleanup === "confirmed"
      )
        lastPreOutcomeCheckpoint = Buffer.from(args[3]);
      return saved;
    },
  },
});

mock.module("../../../docker-isolation/src/index.ts", {
  namedExports: {
    ...isolation,
    observeDockerRuntimeRepairRetention: (
      input: Parameters<
        typeof isolation.observeDockerRuntimeRepairRetention
      >[0],
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
    disposeDockerRuntimeRepairDirectory: async (
      input: isolation.DockerRuntimeRepairDisposalInput,
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
    runDockerRuntimeRepairSession: (
      input: Parameters<typeof isolation.runDockerRuntimeRepairSession>[0],
    ) => {
      runtimeEntries++;
      delayedCheckpoint = input.onCheckpoint;
      return runDockerRuntimeRepairSessionUsing(input, {
        acquire: async () => {
          acquireCount++;
          return {
            status: "acquired",
            ownerBindingSha256: owner,
            session: {
              assertLive: () => true,
              failureDetected: new Promise(() => {}),
              onFailureDetected: () => () => {},
              verifyArtifacts: async () => "verified",
              inspectProcesses: async () => "verified",
              terminateProcesses: async () => {
                throw new Error("unexpected_effect");
              },
              launchDesktop: async () => {
                throw new Error("unexpected_effect");
              },
              release: async () => ({
                cleanup: "confirmed",
                protocol: "completed",
              }),
              abort: async () => ({
                cleanup: "confirmed",
                protocol: "completed",
              }),
            },
          };
        },
        prepare: async () => ({
          scopeSha256: scope,
          cleanupFailure: () => null,
          technical: {
            observe: async (checkpoint) => {
              observeCount++;
              const current = JSON.parse(fs.readFileSync(stateFile, "utf8"));
              assert.ok(current.revision >= 2);
              assert.equal(current.operations[0].checkpoint.cleanup, "pending");
              assert.equal(
                current.operations[0].identityJson.includes(owner),
                true,
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
});
const { repairRuntimeOwnedDockerRuntime } = await import(
  "../../src/diagnostics/runtime-repair.ts"
);

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
  const tests = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
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
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "tests");
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw new Error("root_unavailable");
  stateFile = path.join(root, ".crdd", "coordinator", "state.json");
  acquireCount = 0;
  runtimeEntries = 0;
  observeCount = 0;
  writeCalls = 0;
  lastOutcomeCheckpoint = null;
  lastPreOutcomeCheckpoint = null;
  lastRepairCompletionBefore = null;
  faultHits = 0;
  faultedAt = 0;
  scope = "c".repeat(64);
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
    .decodeCoordinatorStateSnapshot(
      fs.readFileSync(stateFile),
      borrowed.repositoryBinding,
    )
    ?.snapshot.operations.find((operation) => operation.recoveryId === id);
  assert.ok(original?.kind === "runtime_repair");
  const historyBefore =
    stateStore.readRuntimeOwnedCoordinatorRepairHistorySnapshot(
      f.capability,
      id,
    );
  assert.equal(historyBefore.status, "completed");
  assert.equal(historyBefore.repairHistoryState, "technical_state");
  assert.equal(historyBefore.currentHistoryPublication, null);
  const completionBefore =
    stateStore.readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
      f.capability,
      id,
    );
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
    .decodeCoordinatorStateSnapshot(
      fs.readFileSync(stateFile),
      borrowed.repositoryBinding,
    )
    ?.snapshot.operations.find((operation) => operation.recoveryId === id);
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
  const final = model
    .decodeCoordinatorStateSnapshot(
      lastRepairCompletionBefore,
      borrowed.repositoryBinding,
    )
    ?.snapshot.operations.find((operation) => operation.recoveryId === id);
  assert.ok(final?.kind === "runtime_repair" && final.disposal);
  assert.equal(
    isolation.dockerRuntimeRepairDisposalIsSettled(final.disposal.checkpoint),
    true,
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
  const rows = model.decodeCoordinatorHistoryRows(history);
  assert.equal(rows?.length, 1);
  assert.equal(
    JSON.parse(rows?.[0]?.line ?? "null").summary.disposal.checkpoint
      .directories.primary.request,
    "unknown",
  );
  assert.equal(
    model.decodeCoordinatorStateSnapshot(
      fs.readFileSync(stateFile),
      borrowed.repositoryBinding,
    )?.snapshot.operations.length,
    0,
  );
  const completionAfter =
    stateStore.readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
      f.capability,
      id,
    );
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
  const at = "2026-10-16T00:00:00.000Z";
  const checkpointBytes = model.prepareCoordinatorRepairHistorySnapshot(
    original,
    id,
    at,
    false,
    borrowed.repositoryBinding,
  );
  assert.ok(checkpointBytes);
  const currentBytes = model.prepareCoordinatorRepairHistorySnapshot(
    checkpointBytes,
    id,
    at,
    true,
    borrowed.repositoryBinding,
  );
  const historyBytes = model.prepareCoordinatorRepairHistoryLine(
    checkpointBytes,
    id,
    borrowed.repositoryBinding,
  );
  assert.ok(currentBytes && historyBytes);
  const directory = path.dirname(stateFile);
  const historyFile = path.join(directory, "history.jsonl");
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
  const snapshot = model.decodeCoordinatorStateSnapshot(
    currentBytes,
    borrowed.repositoryBinding,
  );
  assert.ok(snapshot);
  fs.writeFileSync(
    stateFile,
    `${model.encodeCoordinatorStateValue({ ...snapshot.snapshot, operations: [] })}\n`,
  );
  fs.writeFileSync(historyFile, historyBytes);
  const refused =
    stateStore.readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
      f.capability,
      id,
    );
  assert.equal(refused.status, "blocked");
  assert.equal(refused.repairCompletionAbsent, false);
  assert.equal(acquireCount, acquired);
  assert.equal(runtimeEntries, entries);
});

/**
 * 実保存Moduleの私有ContextとWriterを同じVMへ組み立てる。
 * @responsibility 用途誤配線だけをメモリ変異し、物理境界を実体のまま使う。
 * @trace ERB-IT-014
 * @precondition Repository内の固定Source。依存は実Root／Kernel／Filesystem／model。
 * @stimulus 型・import／export構文の除去後に指定した一条件だけ変更する。
 * @observation 実Writerの出版・読戻し・拒否結果。
 * @oracle 代替classifierや模擬Writerを混入しない。
 * @cleanup Production本文は読取りのみ。
 * @boundary 試験限定VMと実Host保存境界。
 */
function stateStoreSource(
  transform: (source: string) => string,
  overrides: Readonly<Record<string, unknown>> = {},
) {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/storage/settlement-store.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace(/^export\s+/gmu, "");
  const body = transform(source);
  const dependencies = {
    createHash,
    fs,
    path,
    types,
    ...domain,
    ...versionControl,
    ...model,
    dockerRuntimeRepairDisposalIsSettled:
      isolation.dockerRuntimeRepairDisposalIsSettled,
    ...bindings,
    ...kernel,
    ...overrides,
  };
  const names = Object.keys(dependencies);
  return runInThisContext(
    `(function(${names.join(",")}){${body};return {resume:resumeRuntimeOwnedCoordinatorRepairPublication,write:writeRuntimeOwnedCoordinatorRepairSnapshot,readHistory:readRuntimeOwnedCoordinatorRepairHistorySnapshot,advanceHistory:advanceRuntimeOwnedCoordinatorRepairHistory,readCompletion:readRuntimeOwnedCoordinatorRepairCompletionSnapshot,complete:completeRuntimeOwnedCoordinatorRepair};})`,
  )(...Object.values(dependencies)) as {
    resume: typeof stateStore.resumeRuntimeOwnedCoordinatorRepairPublication;
    write: typeof stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot;
    readHistory: typeof stateStore.readRuntimeOwnedCoordinatorRepairHistorySnapshot;
    advanceHistory: typeof stateStore.advanceRuntimeOwnedCoordinatorRepairHistory;
    readCompletion: typeof stateStore.readRuntimeOwnedCoordinatorRepairCompletionSnapshot;
    complete: typeof stateStore.completeRuntimeOwnedCoordinatorRepair;
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
  const waiting = Buffer.from(`${model.encodeCoordinatorStateValue(raw)}\n`);
  assert.ok(model.decodeCoordinatorStateSnapshot(waiting, binding));
  const id = raw.operations[0].recoveryId as string;
  const bytes = model.prepareCoordinatorStateRepairDisposalDecisionSnapshot(
    waiting,
    id,
    "2026-10-17T00:00:00.000Z",
    binding,
  );
  assert.ok(bytes);
  const decoded = model.decodeCoordinatorStateSnapshot(bytes, binding);
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
    const value = model.decodeCoordinatorStateSnapshot(
      before,
      repository.repositoryBinding,
    );
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
    const candidate =
      model.prepareCoordinatorStateRepairRetentionHandoffSnapshot(
        before,
        id,
        receipt,
        repository.repositoryBinding,
      );
    assert.ok(candidate);
    assert.equal(
      model.classifyCoordinatorRepairPublication(
        before,
        candidate,
        id,
        repository.repositoryBinding,
      )?.mode,
      "retention_handoff",
    );
    for (const purpose of [
      "checkpoint",
      "session_begin",
      "disposal_decision",
      "disposal_primary",
      "disposal_failed",
      "disposal_auxiliary",
    ] as const) {
      const refused = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
        f.capability,
        id,
        before,
        candidate,
        () => true,
        purpose,
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
      const decodedCandidate = model.decodeCoordinatorStateSnapshot(
        candidate,
        repository.repositoryBinding,
      );
      assert.ok(decodedCandidate);
      const changed = Buffer.from(
        `${model.encodeCoordinatorStateValue({
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
      assert.ok(
        model.decodeCoordinatorStateSnapshot(
          changed,
          repository.repositoryBinding,
        ),
        "legal_checkpoint_difference",
      );
      const refused = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
        f.capability,
        id,
        before,
        changed,
        () => true,
        "retention_handoff",
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
      const saved = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
        f.capability,
        id,
        before,
        candidate,
        () => true,
        "retention_handoff",
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
      const resumed = stateStoreSource((source) => source).resume(
        f.capability,
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
      const cleaned = stateStore.cleanupRuntimeOwnedCoordinatorStateMarker(
        f.capability,
      );
      assert.equal(cleaned.storageConfirmed, true);
      assert.equal(cleaned.status, "completed");
      assert.equal(cleaned.lockReleased, true);
      assert.equal(cleaned.markerAbsentConfirmed, true);
    }
    assert.ok(fs.readFileSync(stateFile).equals(candidate));
    assert.equal(fs.existsSync(pending), false);
    assert.equal(fs.existsSync(marker), false);
    const actual = model.decodeCoordinatorStateSnapshot(
      fs.readFileSync(stateFile),
      repository.repositoryBinding,
    );
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
    const same = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
      f.capability,
      id,
      candidate,
      candidate,
      () => true,
      "retention_handoff",
    );
    assert.equal(same.snapshotConfirmed, false);
    assert.equal(same.filesystemEffectIssued, false);
    assert.ok(fs.readFileSync(stateFile).equals(candidate));
    if (stage === "normal") {
      const acquired = acquireCount,
        entries = runtimeEntries;
      for (let step = 0; step < 2; step++) {
        const read =
          stateStore.readRuntimeOwnedCoordinatorRepairHistorySnapshot(
            f.capability,
            id,
          );
        assert.equal(read.status, "completed");
        assert.equal(read.lockReleased, true);
        const saved = stateStore.advanceRuntimeOwnedCoordinatorRepairHistory(
          {
            ...repository,
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
      assert.equal(model.decodeCoordinatorHistoryRows(history)?.length, 1);
      const beforeCompletion = fs.readFileSync(stateFile);
      const ready =
        stateStore.readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
          f.capability,
          id,
        );
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
        fs.writeFileSync(
          historyFile,
          `${model.encodeCoordinatorStateValue(changed)}\n`,
        );
        const refused =
          stateStore.readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
            f.capability,
            id,
          );
        assert.equal(refused.status, "blocked", fault);
        assert.equal(refused.repairRetentionReviewAfter, null, fault);
        assert.ok(fs.readFileSync(stateFile).equals(beforeCompletion));
      }
      fs.writeFileSync(historyFile, history);
      const saved = stateStore.completeRuntimeOwnedCoordinatorRepair(
        f.capability,
        id,
        () => true,
      );
      assert.equal(saved.status, "completed");
      assert.equal(saved.snapshotConfirmed, true);
      assert.equal(saved.lockReleased, true);
      const absent =
        stateStore.readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
          f.capability,
          id,
        );
      assert.equal(absent.status, "completed");
      assert.equal(absent.lockReleased, true);
      assert.equal(absent.repairCompletionAbsent, true);
      assert.equal(absent.repairRetentionReviewAfter, receipt.reviewAfter);
      assert.ok(fs.readFileSync(historyFile).equals(history));
      const legacyRow = JSON.parse(history.toString());
      delete legacyRow.summary.retention;
      const legacyHistory = Buffer.from(
        `${model.encodeCoordinatorStateValue(legacyRow)}\n`,
      );
      assert.equal(
        model.decodeCoordinatorHistoryRows(legacyHistory)?.length,
        1,
        "legacy_retained_row_is_codec_legal",
      );
      try {
        fs.writeFileSync(historyFile, legacyHistory);
        const refused =
          stateStore.readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
            f.capability,
            id,
          );
        assert.equal(refused.status, "blocked");
        assert.equal(refused.repairCompletionAbsent, false);
        assert.equal(refused.repairRetentionReviewAfter, null);
      } finally {
        fs.writeFileSync(historyFile, history);
      }
      assert.equal(
        model.decodeCoordinatorStateSnapshot(
          fs.readFileSync(stateFile),
          repository.repositoryBinding,
        )?.snapshot.operations.length,
        0,
      );
      assert.equal(acquireCount, acquired);
      assert.equal(runtimeEntries, entries);
      fs.writeFileSync(historyFile, Buffer.alloc(0));
      const missing =
        stateStore.readRuntimeOwnedCoordinatorRepairCompletionSnapshot(
          f.capability,
          id,
        );
      assert.equal(missing.status, "blocked");
      assert.equal(missing.repairRetentionReviewAfter, null);
      fs.writeFileSync(historyFile, history);
    }
  }
});

/**
 * 回収用途別の保存・切断と同値読取りを確認する。
 * @responsibility 通常用途への迂回と同値再書込みを拒否する。
 * @trace ERB-IT-014
 * @precondition 自己生成Rootと模擬DI。
 * @stimulus 三用途の更新、保存前後切断、同値と不正短命物。
 * @observation 元版・改訂・実Filesystem変更・保存結果。
 * @oracle 専用用途だけ保存され、同値は書込み0。
 * @cleanup 既存fixtureで自己生成Rootを回収する。
 * @boundary 実Root／Writer。実Dockerなし。
 */
test("Host Windows: 修復回収進捗は専用保存と無書込み確認へ接続する", async (t) => {
  const f = prepareRepairOwnerFixture(t);
  observeMode = "retained";
  faultStage = "none";
  const result = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
  );
  assert.ok(result.recoveryId && result.outcomeConfirmed);
  const id = result.recoveryId;
  const borrowed = bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(
    f.capability,
  );
  assert.ok(borrowed);
  const directory = path.dirname(stateFile);
  const marker = path.join(directory, "state.lock");
  const pending = path.join(directory, "state.pending.json");
  const original = fs.readFileSync(stateFile);
  const acquired = acquireCount,
    entries = runtimeEntries;
  const decision = model.prepareCoordinatorStateRepairDisposalDecisionSnapshot(
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
    const value = model.decodeCoordinatorStateSnapshot(
      before,
      borrowed.repositoryBinding,
    );
    const target = value?.snapshot.operations.find(
      (item) => item.recoveryId === id,
    );
    assert.ok(value && target?.kind === "runtime_repair" && target.disposal);
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
    const next = model.prepareCoordinatorStateRepairDisposalProgressSnapshot(
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
    const renameHook = mock.method(
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
    const unlinkHook = mock.method(fs, "unlinkSync", (file: fs.PathLike) => {
      if (purpose === "failed" && file === marker && cut === 0) {
        cut++;
        throw new Error("synthetic_disposal_after_rename");
      }
      return unlink(file);
    });
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
      mock.method(fs, name, () => {
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
        model.decodeCoordinatorStateSnapshot(next, borrowed.repositoryBinding)
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
        const rejected = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
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
  const final = model.decodeCoordinatorStateSnapshot(
    before,
    borrowed.repositoryBinding,
  )?.snapshot.operations[0];
  const first = model.decodeCoordinatorStateSnapshot(
    original,
    borrowed.repositoryBinding,
  )?.snapshot.operations[0];
  assert.ok(
    final?.kind === "runtime_repair" && first?.kind === "runtime_repair",
  );
  assert.deepEqual(final.checkpoint, first.checkpoint);
  assert.deepEqual(final.outcome, first.outcome);
  assert.equal(final.primaryFailure, first.primaryFailure);
  assert.equal(acquireCount, acquired);
  assert.equal(runtimeEntries, entries);
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
    model.decodeCoordinatorStateSnapshot(
      fs.readFileSync(stateFile),
      JSON.parse(original.toString("utf8")).repositoryBinding,
    )?.snapshot.operations.length,
    0,
  );
  const duplicate = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    AbortSignal.abort(),
    id,
  );
  assert.equal(duplicate.completionConfirmed, true);
  assert.equal(duplicate.finalCheckpointConfirmed, false);
  assert.equal(duplicate.nativeCleanupConfirmed, false);
  fs.writeFileSync(stateFile, original);
  const history = fs.readFileSync(historyFile);
  const otherRow = JSON.parse(history.toString("utf8"));
  otherRow.summary.operationNonce = "9".repeat(64);
  otherRow.summary.recoveryId = `docker-runtime-repair.${otherRow.summary.operationNonce}.${otherRow.summary.identitySha256}`;
  const otherHistory = Buffer.from(
    `${model.encodeCoordinatorStateValue(otherRow)}\n`,
  );
  assert.equal(model.decodeCoordinatorHistoryRows(otherHistory)?.length, 1);
  const borrowed = bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(
    f.capability,
  );
  assert.ok(borrowed);
  const candidate = model.prepareCoordinatorStateRepairCompletionSnapshot(
    original,
    id,
    borrowed.repositoryBinding,
  );
  assert.ok(candidate);
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
      const worker = stateStoreSource((source) => source);
      if (mode === "other_history") {
        const rejected = worker.readCompletion(f.capability, id);
        assert.equal(rejected.status, "blocked");
        assert.equal(rejected.currentCompletionPublication, null);
      }
      const saved = worker.complete(
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
          worker.readCompletion(f.capability, id).repairCompletionAbsent,
          true,
        );
        assert.equal(
          stateStore.readRuntimeOwnedCoordinatorCurrentCompletionSnapshot(
            f.capability,
            id,
          ).status,
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
  const afterRename = stateStoreSource((source) => source);
  const absent = afterRename.readCompletion(f.capability, id);
  assert.equal(absent.status, "completed");
  assert.equal(absent.repairCompletionAbsent, true);
  assert.equal(absent.repairRetentionReviewAfter, null);
  assert.equal(absent.currentCompletionPublication, null);
  const cleaned = stateStore.cleanupRuntimeOwnedCoordinatorStateMarker(
    f.capability,
  );
  assert.equal(cleaned.status, "completed");
  assert.equal(cleaned.markerAbsentConfirmed, true);
  assert.equal(
    afterRename.readCompletion(f.capability, id).repairCompletionAbsent,
    true,
  );
  assert.ok(fs.readFileSync(stateFile).equals(candidate));
  fs.writeFileSync(historyFile, Buffer.alloc(0));
  assert.equal(afterRename.readCompletion(f.capability, id).status, "blocked");
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
    return source.replace(readerNeedle, "false").replace(writerNeedle, "false");
  });
  const bypass = writerRelaxed.complete(f.capability, id, () => true);
  assert.throws(() => assert.equal(bypass.status, "blocked"));
  assert.ok(fs.readFileSync(stateFile).equals(candidate));
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
  assert.equal(first.nativeCleanupConfirmed, true);
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
  assert.equal(delayedCheckpoint(lastCheckpoint), false);
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
  const priorObservations = observeCount;
  scope = "d".repeat(64);
  const mismatch = await repairRuntimeOwnedDockerRuntime(
    verified.capability,
    new AbortController().signal,
    first.recoveryId,
  );
  assert.equal(mismatch.status, "blocked");
  assert.equal(observeCount, priorObservations);
  assert.ok(fs.readFileSync(stateFile).equals(nextBytes));
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
  scope = "c".repeat(64);
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
  const rows = model.decodeCoordinatorHistoryRows(historyBytes);
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
        if (cut === "history")
          assert.equal(
            model.decodeCoordinatorHistoryRows(fs.readFileSync(historyPending))
              ?.length,
            1,
          );
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
        const intended = model
          .decodeCoordinatorStateSnapshot(expected, before.repositoryBinding)
          ?.snapshot.operations.find(
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
      const rawRetained =
        model.prepareCoordinatorStateRepairRetentionHandoffSnapshot(
          Buffer.from(`${model.encodeCoordinatorStateValue(before)}\n`),
          first.recoveryId,
          {
            decidedAt: savedReceipt.decidedAt,
            reviewAfter: savedReceipt.reviewAfter,
            targets: {
              primary: target.checkpoint.directories.primary.retained.identity,
              failed: target.checkpoint.directories.failed.retained.identity,
              auxiliary:
                target.checkpoint.directories.auxiliary.retained.identity,
            },
          },
          before.repositoryBinding,
        );
      assert.ok(rawRetained);
      const initialHistory = model.prepareCoordinatorRepairHistorySnapshot(
        rawRetained,
        first.recoveryId,
        savedReceipt.decidedAt,
        false,
        before.repositoryBinding,
      );
      assert.ok(initialHistory);
      const expectedPublication =
        model.prepareCoordinatorRepairHistoryPublication(
          initialHistory,
          first.recoveryId,
          Buffer.alloc(0),
          null,
          30,
          before.repositoryBinding,
        );
      assert.ok(expectedPublication);
      const expectedCompletion =
        model.prepareCoordinatorStateRepairCompletionSnapshot(
          expectedPublication.snapshotBytes,
          first.recoveryId,
          before.repositoryBinding,
        );
      assert.ok(expectedCompletion);
      assert.ok(fs.readFileSync(stateFile).equals(expectedCompletion));
      assert.equal(after.operations.length, 0);
      assert.deepEqual(after.unresolvedRecoveries, before.unresolvedRecoveries);
      assert.deepEqual(after.pendingDeliveries, before.pendingDeliveries);
      assert.equal(after.revision, before.revision + 4);
      const history = fs.readFileSync(historyFile);
      assert.equal(model.decodeCoordinatorHistoryRows(history)?.length, 1);
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
        assert.equal(duplicate.nativeCleanupConfirmed, false);
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
        assert.equal(result.nativeCleanupConfirmed, true);
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
          assert.equal(callback(savedCheckpoint), false);
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
  assert.equal(result.nativeCleanupConfirmed, true);
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
        const checkpointExpected =
          model.prepareCoordinatorRepairHistorySnapshot(
            expected,
            first.recoveryId,
            historyAt,
            false,
            repository.repositoryBinding,
          );
        assert.ok(checkpointExpected);
        const confirmedExpected = model.prepareCoordinatorRepairHistorySnapshot(
          checkpointExpected,
          first.recoveryId,
          historyAt,
          true,
          repository.repositoryBinding,
        );
        assert.ok(confirmedExpected);
        assert.ok(publications[1]?.equals(checkpointExpected));
        assert.ok(publications[2]?.equals(confirmedExpected));
        finalExpected = confirmedExpected;
        expectedHistory = model.prepareCoordinatorRepairHistoryLine(
          checkpointExpected,
          first.recoveryId,
          repository.repositoryBinding,
        );
        assert.ok(expectedHistory);
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
      const late = stateStore.writeRuntimeOwnedCoordinatorRepairSnapshot(
        f.capability,
        first.recoveryId,
        old,
        expected,
        () => true,
        "checkpoint",
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
      if (stage === "identity") {
        scope = "d".repeat(64);
        const observed = observeCount,
          writes = writeCalls;
        const mismatch = await repairRuntimeOwnedDockerRuntime(
          f.capability,
          new AbortController().signal,
          first.recoveryId,
        );
        assert.equal(mismatch.status, "blocked");
        assert.equal(acquireCount, acquired + 1);
        assert.equal(observeCount, observed);
        assert.equal(writeCalls, writes);
        assert.ok(fs.readFileSync(stateFile).equals(finalExpected));
        scope = "c".repeat(64);
      }
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
  let result: ReturnType<
    typeof stateStore.resumeRuntimeOwnedCoordinatorRepairPublication
  >;
  try {
    result = stateStore.resumeRuntimeOwnedCoordinatorRepairPublication(
      f.capability,
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
          `${model.encodeCoordinatorStateValue({ ...saved, operations: [other] })}\n`,
        );
        assert.ok(model.decodeCoordinatorStateSnapshot(before, binding));
        fs.writeFileSync(stateFile, before);
        const originalIdentity = JSON.parse(original.identityJson);
        const identity = `${JSON.stringify({ ...originalIdentity, operationNonce: originalIdentity.operationNonce === "f".repeat(64) ? "e".repeat(64) : "f".repeat(64), operationId: "OP-999999" })}\n`;
        candidate = model.prepareCoordinatorStateRepairSnapshot(
          before,
          identity,
          binding,
        );
        assert.ok(candidate);
        const added = model
          .decodeCoordinatorStateSnapshot(candidate, binding)
          ?.snapshot.operations.find(
            (item) => item.recoveryId !== first.recoveryId,
          );
        assert.ok(added);
        id = added.recoveryId;
      } else {
        candidate = model.prepareCoordinatorStateRepairSessionSnapshot(
          before,
          id,
          binding,
        );
        assert.ok(candidate);
      }
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
        `${model.encodeCoordinatorStateValue({
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
      assert.equal(model.decodeCoordinatorHistoryRows(historyBytes)?.length, 1);
      fs.writeFileSync(history, historyBytes, { flag: "wx" });
      const acquired = acquireCount,
        entries = runtimeEntries,
        observed = observeCount;
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
        const result = resume(f.capability, id, () => true);
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
      // 同じ有限形を本番compositionからも通し、publisherのcompletedを保持する。
      fs.writeFileSync(stateFile, before);
      fs.writeFileSync(pending, candidate, { flag: "wx" });
      fs.writeFileSync(
        marker,
        `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: binding })}\n`,
        { flag: "wx" },
      );
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
      assert.ok(fs.readFileSync(stateFile).equals(candidate));
      assert.equal(fs.existsSync(pending), false);
      assert.equal(fs.existsSync(marker), false);
      assert.equal(acquireCount, acquired);
      assert.equal(runtimeEntries, entries);
      assert.equal(observeCount, observed);
      assert.ok(fs.readFileSync(history).equals(historyBytes));
      const prior = model.decodeCoordinatorStateSnapshot(before, binding),
        next = model.decodeCoordinatorStateSnapshot(candidate, binding);
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
      assert.deepEqual(
        next.snapshot.pendingDeliveries,
        prior.snapshot.pendingDeliveries,
      );
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
 * 一般の修復保存から履歴確認を作れないことを実Writerで確認する。
 * @responsibility 外側検査の省略でも排他内の履歴用途制限を維持する。
 * @trace ERB-IT-014
 * @precondition 自己生成Repositoryの実修復結果。技術境界は模擬。
 * @stimulus 初回履歴固定とconfirmed更新を通常Writerへ渡し、外側guardだけを省略する。
 * @observation 外側ではI/O0、変異では保存領域読取り到達後の拒否、本文不変。
 * @oracle 専用未接続の候補を通常用途で保存しない。
 * @cleanup 自己生成Rootだけを範囲・実体確認後に削除し不存在確認。
 * @boundary 実Windows Root／Kernel／Writer。履歴出版の肯定証明ではない。
 */
test("Host Windows: 修復履歴は通常Writerの外側と排他内で拒否する", async (t) => {
  const f = prepareRepairOwnerFixture(t);
  observeMode = "ready";
  faultStage = "none";
  const result = await repairRuntimeOwnedDockerRuntime(
    f.capability,
    new AbortController().signal,
  );
  assert.ok(result.recoveryId && result.outcomeConfirmed);
  const repository = bindings.borrowRuntimeOwnedCoordinatorRecoveryRepository(
    f.capability,
  );
  assert.ok(repository);
  const at = "2026-10-16T00:00:00.000Z";
  assert.ok(lastOutcomeCheckpoint);
  const original = Buffer.from(lastOutcomeCheckpoint);
  fs.writeFileSync(stateFile, original);
  const initialHistory = model.prepareCoordinatorRepairHistorySnapshot(
    original,
    result.recoveryId,
    at,
    false,
    repository.repositoryBinding,
  );
  assert.ok(initialHistory);
  const confirmed = model.prepareCoordinatorRepairHistorySnapshot(
    initialHistory,
    result.recoveryId,
    at,
    true,
    repository.repositoryBinding,
  );
  assert.ok(confirmed);
  const acquired = acquireCount,
    entries = runtimeEntries;
  const readdir = fs.readdirSync;
  let reads = 0;
  const hook = mock.method(
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
            /target\.summarySha256 !== \(previousTarget\?\.summarySha256 \?\? null\) \|\|\s*encodeCoordinatorStateValue\(target\.history\) !==\s*encodeCoordinatorStateValue\(previousTarget\?\.history \?\? null\) \|\|/u;
          assert.equal(source.match(guard)?.length, 1);
          return source.replace(guard, "");
        }).write;
        reads = 0;
        const blocked = writer(
          f.capability,
          result.recoveryId,
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
          () => fs.lstatSync(path.join(path.dirname(stateFile), "state.lock")),
          { code: "ENOENT" },
        );
      }
    }
  } finally {
    hook.mock.restore();
  }
  assert.equal(acquireCount, acquired);
  assert.equal(runtimeEntries, entries);
});

/**
 * 専用修復履歴を実Writerで固定・出版しfresh Readerで確認する。
 * @responsibility 種別固定と保存段階を実Root／Kernel／Filesystemで照合する。
 * @trace ERB-IT-014
 * @precondition 自己生成Repositoryの修復処置済み状態。Docker技術境界は模擬。
 * @stimulus 正常出版、五有限形、十一故障・差替え、Owner／operationId差、非空混在、kind／scope／fallback変異。
 * @observation state／history／短命File、時刻・Hash、既知Effect、排他解放・Kernel回数、対象外全文、技術入口増分。
 * @oracle exact一段確定、確認済み欠測の再追加0、発行前拒否のEffect0、発行後事実保全、Task fallback0、対象外全文不変。
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
  assert.ok(result.recoveryId && result.outcomeConfirmed);
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
  assert.equal(
    model.decodeCoordinatorHistoryRows(fs.readFileSync(initialHistoryFile))
      ?.length,
    1,
  );
  fs.unlinkSync(initialHistoryFile);
  const decoded = model.decodeCoordinatorStateSnapshot(
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
  const acquired = acquireCount,
    entries = runtimeEntries;
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
  const checkpoint = model.decodeCoordinatorStateSnapshot(
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
  const current = model.decodeCoordinatorStateSnapshot(
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
  const rows = model.decodeCoordinatorHistoryRows(historyBytes);
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
        const bytes = Buffer.from(
          `${model.encodeCoordinatorStateValue(row)}\n`,
        );
        assert.equal(model.decodeCoordinatorHistoryRows(bytes)?.length, 1);
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
  const third = stateStoreSource((source) => source);
  const confirmed = third.advanceHistory(repository, id, () => true);
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
      const fresh = stateStoreSource((source) => source);
      const before = fs.readFileSync(stateFile);
      const observation = fresh.readHistory(f.capability, id);
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
      const expected =
        cut === "confirmed_missing"
          ? currentBytes
          : model.prepareCoordinatorStateRepairCompletionSnapshot(
              currentBytes,
              id,
              repository.repositoryBinding,
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
            const capturedState = model.decodeCoordinatorStateSnapshot(
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
      schema: "crdd-coordinator/operation-identity/v1",
      operationNonce: "b".repeat(64),
      provider: "claude",
      consumer: "orchestrator",
      operationId: "OP-234567",
      grantRef: "PHMGRANT-FIXTURE",
      profileId: "PROFILE-123456",
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
    const task = model.decodeCoordinatorStateSnapshot(
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
    const other = model.decodeCoordinatorStateSnapshot(
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
          acceptanceSha256: null,
        },
      ],
    };
    const mixedBytes = Buffer.from(
      `${model.encodeCoordinatorStateValue(mixed)}\n`,
    );
    assert.ok(
      model.decodeCoordinatorStateSnapshot(
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
      const after = model.decodeCoordinatorStateSnapshot(
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
  assert.equal(acquireCount, acquired);
  assert.equal(runtimeEntries, entries);
});

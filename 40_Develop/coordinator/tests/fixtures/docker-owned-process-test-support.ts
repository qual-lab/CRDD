/**
 * 上位取消試験の固定Node診断と正常Owner回復試験の共有準備を所有する。
 * @responsibility 元子のclose・不存在と、正常Ownerの保存・回収・模擬復元を確認する。
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @trace PRL-IT-013
 * @level IT
 * @scope Task Controller取消と自己生成Rootの正常Owner回復。実AI・Dockerなし。
 * @boundary 公開された固定診断API。任意Process起動を公開しない。
 */
import assert from "node:assert/strict";
import { prepareFixtureRecovery } from "../support/recovery-repository.ts";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import { parseStoredExecutionFixture } from "../../../execution-model/tests/fixtures/stored-execution.ts";
import { createServer } from "node:http";
import path from "node:path";
import type { TestContext } from "node:test";
import { mock } from "node:test";
import { createDockerProcessEnvironment } from "../../../docker-isolation/src/docker-cli/environment.ts";
import type * as directoryOperations from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import { runRepairSessionWithDependencies } from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import type * as isolation from "../../../docker-isolation/src/index.ts";
import type { OwnedCommandHandle } from "../../../docker-isolation/src/process/start.ts";
import { startOwnedAttachTerminationFixture } from "../../../docker-isolation/tests/support/probe-process.ts";
import * as stateModel from "../../../execution-model/src/index.ts";
import * as stateRuntime from "../../../execution-model/src/index.ts";
import { saveRepairRecord } from "../../../execution-model/src/index.ts";
import * as executorLibrary from "../../../executor/src/index.ts";
import type { Lock } from "../../../lock/src/index.ts";
import {
  getRepository,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/lifecycle/host.ts";
import * as homes from "../../src/lifecycle/environment.ts";
import * as locks from "../../src/lifecycle/host.ts";
import * as hostRuntime from "../../src/lifecycle/host.ts";
import * as repository from "../../src/lifecycle/host.ts";
import {
  operationStartInput,
  operationStateInput,
} from "../../src/lifecycle/host.ts";
import type { RecoveryPlan } from "../../src/lifecycle/types.ts";
import { executionSelection } from "../fixtures/ai-selection.ts";
import { canonicalJson } from "../support/contract-assertions.ts";
import type { HostCompletionTarget } from "../../src/lifecycle/types.ts";
import type { completeHostOperation } from "../../src/lifecycle/environment.ts";
import { recoveryEnvironmentFixtureUrl } from "../support/recovery.ts";

/**
 * Caller試験へ有限の完成終結操作を提供する。
 * @responsibility Callerの搬送・取消・公開結果を検証し、本番の全件照合とは区別する。
 * @trace ERB-IT-003
 * @precondition 自己生成の代役とopaque結果だけを与える。
 * @stimulus 元Hostとhandoffを一つの完成操作へ渡す。
 * @observation 清掃・退役の即時反映と後続待機を観測する。
 * @oracle 同じCaller進捗を更新し、失敗時に成功分を復活させない。
 * @cleanup N/A: 実資源は呼出し元の既存finallyが所有する。
 * @boundary 有限代役。実Owner・EM全件照合は本番完成操作の別試験が所有する。
 */
export function createHostCompletionFixture(
  boundary: Readonly<{
    cleanup: (owned: object) => unknown | Promise<unknown>;
    classify: (
      outcome: unknown,
      owned: object,
    ) => "completed" | "protocol_failure_cleanup_confirmed" | null;
    prepare?: ((capability: object) => string | null) | undefined;
    finish?:
      | ((
          capability: object,
          completion: Readonly<{
            hostCleanupOutcome: unknown;
            dockerCompletion: unknown;
          }>,
        ) => Readonly<Record<string, unknown>>)
      | undefined;
  }>,
): typeof completeHostOperation {
  return async (
    target: HostCompletionTarget,
    observeHostCleaned?: () => void,
  ) => {
    let hostCleanup: "completed" | "protocol_failure_cleanup_confirmed" | null =
      null;
    let recoveryId: string | null = null;
    const result = (
      status: "completed" | "blocked",
      stage: "intent" | "handoff" | "cleanup" | "receipt" | "finalization",
      error?: unknown,
    ) => {
      if (status === "completed") {
        assert.ok(hostCleanup);
        return Object.freeze({
          status,
          stage: "finalization" as const,
          recoveryId: null,
          hostCleanup,
          error: undefined,
        });
      }
      return Object.freeze({ status, stage, recoveryId, hostCleanup, error });
    };
    try {
      for (const handoff of target.dockerHandoffs) {
        recoveryId = handoff.recoveryId;
        if (boundary.prepare && !boundary.prepare(handoff.capability))
          return result("blocked", "intent");
      }
      if (!target.ownedOperation) return result("blocked", "cleanup");
      const owned = target.ownedOperation;
      const outcome = await boundary.cleanup(owned);
      hostCleanup = boundary.classify(outcome, owned);
      if (!hostCleanup) return result("blocked", "cleanup");
      target.hostCleanupCompleted = true;
      target.hostRecoveryId = null;
      target.ownedOperation = null;
      observeHostCleaned?.();
      for (const handoff of target.dockerHandoffs) {
        recoveryId = handoff.recoveryId;
        const finished = boundary.finish?.(
          handoff.capability,
          Object.freeze({
            hostCleanupOutcome: outcome,
            dockerCompletion: handoff.dockerCompletion,
          }),
        );
        if (boundary.finish && finished?.status !== "completed")
          return result(
            "blocked",
            finished?.stage === "finalization" ? "finalization" : "receipt",
          );
        handoff.state = "finalized";
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
      recoveryId = null;
      return result("completed", "finalization");
    } catch (error) {
      return result("blocked", "cleanup", error);
    }
  };
}

/**
 * 観測済みの自己生成PIDについて不存在を確認する。
 * @responsibility ESRCH以外を不存在に畳まない。
 * @trace ERB-IT-002
 * @precondition 固定fixtureが返したPIDだけを渡す。
 * @stimulus PIDへのsignal 0。
 * @observation 存在またはESRCH。
 * @oracle 観測不能は例外。
 * @cleanup N/A: 資源を取得しない。
 * @boundary OS Process観測。
 */
function isPresent(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

/**
 * 正常Ownerの実保存・Host回収と、必要な場合だけ利用側のHTTP一要求を結合する。
 * @responsibility 元の正常Owner試験本体と終了時回収を一意に所有する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @precondition 自己生成Repositoryと有限Docker技術代役のみ。
 * @stimulus 指定回数のbegin／complete後に各結果を完成保存・退役し、逆順再送を拒否する。三回形は利用側の一要求を重ねる。
 * @observation 元のWriter・Home排他・実Host記録・Root・履歴・HTTP時計。
 * @oracle 元の各assertで異常・部分成立・非対象変更を拒否する。
 * @cleanup 元のfinallyで全代役を復元し今回のexact Rootだけを清掃する。
 * @boundary Co実Host／Writerと有限技術代役。HTTP要求実装は利用側が所有する。
 */
export async function verifyNormalOwnerLifecycle(
  t: TestContext,
  repeatCount: number,
  retained: boolean,
  request?: (
    url: string,
    observe: (
      timing: Readonly<{ startedAt: number; completedAt: number }>,
    ) => void,
  ) => Promise<Readonly<{ status: number }>>,
) {
  const area = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "normal_owner_test",
  );
  const root = fs.mkdtempSync(path.join(area.directory, "normal-owner-"));
  // 共有Homeの排他も、このCaseで生成したRootの中だけを使う。
  const previousLocalAppData = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = root;
  t.after(() => {
    if (previousLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previousLocalAppData;
  });
  let owned: ReturnType<
    typeof hostRuntime.createOwnedOperationDirectories
  > | null = null;
  let otherOwned: ReturnType<
    typeof hostRuntime.createOwnedOperationDirectories
  > | null = null;
  let management: object | null = null;
  const pendingCapabilities = new Set<object>();
  let ownerRuntime: typeof import("../../src/lifecycle/environment.ts") | null =
    null;
  const substitutions: Array<{ restore(): void }> = [];
  let hostCleaned = false;
  let fixtureHomeLease: Lock | null = null;
  let failure: unknown = null;
  let repairClosed = repeatCount !== 1;
  let repairHistory: Buffer | null = null;
  let repairHistoryRows: NonNullable<
    ReturnType<typeof stateModel.readState>["historyRows"]
  > | null = null;
  let repairActiveState: Buffer | null = null;
  let repairCompletedState: Buffer | null = null;
  let httpServer: ReturnType<typeof createServer> | null = null;
  let httpPending: ReturnType<NonNullable<typeof request>> | null = null;
  const stageTimings: {
    stage: "receipt" | "finalize";
    startedAt: number;
    completedAt: number;
  }[] = [];
  const httpTimings: Readonly<{ startedAt: number; completedAt: number }>[] =
    [];
  let serverReceivedAt: number | null = null;
  let serverFinishedAt: number | null = null;
  const sourceDirectory = path.join(root, "old-runtime-fixture");
  const retainedDirectory = path.join(root, "retained-runtime-fixture");
  const retainedMarker = Buffer.from("retained-only-not-a-task-workspace\n");
  let retainedIdentity: {
    dev: string;
    ino: string;
    birthtimeNs: string;
  } | null = null;
  /**
   * 保持引渡し後の自己生成物を実体と内容で照合する。
   * @responsibility 後続Taskによる保持物の削除・差替え・再利用を検出する。
   * @trace ERB-IT-014
   * @precondition 保持あり形だけで実体Identityとmarkerを捕捉済み。
   * @stimulus 保持直後、Task開始後と終了後に再観測する。
   * @observation lstatの実体識別値とmarker bytes、元Directory不存在。
   * @oracle 保持物は同一実体・内容で元Directoryは存在しない。
   * @cleanup N/A: 読取りのみ。試験Rootの最終回収と製品の保持方針を分ける。
   * @boundary 自己生成Directoryだけ。実AppData・Native退避の証明ではない。
   */
  function assertRetainedArtifact(): void {
    if (!retained) return;
    assert.ok(retainedIdentity);
    const stat = fs.lstatSync(retainedDirectory, { bigint: true });
    assert.deepEqual(
      {
        dev: String(stat.dev),
        ino: String(stat.ino),
        birthtimeNs: String(stat.birthtimeNs),
      },
      retainedIdentity,
    );
    assert.deepEqual(
      fs.readFileSync(path.join(retainedDirectory, "marker")),
      retainedMarker,
    );
    assert.throws(() => fs.lstatSync(sourceDirectory), { code: "ENOENT" });
  }
  /**
   * 後続Taskの各段階で元修復履歴行を照合する。
   * @responsibility Task行の正当な追加と元修復行の変更・重複を区別する。
   * @trace ERB-IT-014
   * @precondition 修復直後の元行を捕捉済み。2回形には修復行がない。
   * @stimulus 同じhistory本文と、追加済みTask行の期待数を渡す。
   * @observation 実Fileと引数のbyte一致、公開Readerの行集合とexact回復IDを確認する。
   * @oracle 元行のbyte・時刻・両Hashは不変かつ一件。Task追加前は全byte一致。
   * @cleanup N/A: 公開Readerによる短期Lockは同Readerが解放し、保存本文を変更しない。
   * @boundary 実履歴本文と元修復行の相関。実修復技術の証明ではない。
   */
  function assertRepairHistory(bytes: Buffer, taskRows = 0): void {
    if (!repairHistory) return;
    const original = repairHistoryRows;
    assert.ok(original?.length === 1 && original[0]);
    const stateFile = path.join(root, ".crdd", "execution-model", "state.json");
    const historyFile = path.join(path.dirname(stateFile), "history.jsonl");
    assert.deepEqual(bytes, fs.readFileSync(historyFile));
    const before = fs.readFileSync(stateFile);
    const repository = getRepository(root);
    assert.equal(repository.status, "completed");
    assert.ok(repository.capability);
    const observed = stateModel.readState(
      prepareFixtureRecovery(repository.capability),
      {
        scope: "recovery",
        input: {
          kind: "history",
        },
      },
    );
    assert.equal(observed.status, "completed", observed.reason);
    assert.equal(observed.lockReleased, true);
    assert.ok(observed.value && observed.historyRows);
    assert.deepEqual(fs.readFileSync(stateFile), before);
    assert.deepEqual(fs.readFileSync(historyFile), bytes);
    const rows = observed.historyRows;
    assert.equal(rows.length, 1 + taskRows);
    assert.deepEqual(bytes.subarray(0, repairHistory.length), repairHistory);
    assert.deepEqual(
      rows.filter((row) => row.recoveryId === original[0]?.recoveryId),
      original,
    );
    if (taskRows === 0) assert.deepEqual(bytes, repairHistory);
  }
  try {
    const directory = homes.providerHomesDirectoryCandidate();
    assert.ok(directory);
    const relative = path.relative(root, directory);
    assert.ok(
      relative && !relative.startsWith("..") && !path.isAbsolute(relative),
    );
    fs.mkdirSync(directory, { recursive: true });
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
    if (repeatCount === 1) {
      const verified = getRepository(root);
      assert.equal(verified.status, "completed");
      if (verified.status !== "completed") throw new Error("root_unavailable");
      let acquisitions = 0;
      let observations = 0;
      let engineWaits = 0;
      let retentionReads = 0;
      let retentionEffects = 0;
      let disposalCalls = 0;
      let disposalDecisionRefusals = 0;
      if (retained) {
        fs.mkdirSync(sourceDirectory);
        fs.writeFileSync(path.join(sourceDirectory, "marker"), retainedMarker);
        const stat = fs.lstatSync(sourceDirectory, { bigint: true });
        retainedIdentity = {
          dev: String(stat.dev),
          ino: String(stat.ino),
          birthtimeNs: String(stat.birthtimeNs),
        };
      }
      const repairStatePath = path.join(
        root,
        ".crdd",
        "execution-model",
        "state.json",
      );
      let writerFault: ReturnType<typeof mock.module> | null = retained
        ? mock.module(
            new URL("../../../execution-model/src/index.ts", import.meta.url)
              .href,
            {
              namedExports: {
                ...stateRuntime,
                saveRepairRecord: (
                  ...args: Parameters<typeof saveRepairRecord>
                ) => {
                  if (args[2].change.kind === "disposal_decision") {
                    disposalDecisionRefusals++;
                    assert.equal(disposalDecisionRefusals, 1);
                    return saveRepairRecord(null, args[1], args[2], args[3]);
                  }
                  return saveRepairRecord(...args);
                },
              },
            },
          )
        : null;
      const technical = mock.module(
        new URL("../../../executor/src/index.ts", import.meta.url).href,
        {
          namedExports: {
            ...executorLibrary,
            cleanupResources: async () => {
              disposalCalls++;
              throw new Error("unexpected_fixture_disposal");
            },
            inspectResources: (
              target: Readonly<{
                kind: "docker_runtime_directory";
                input: Parameters<
                  typeof directoryOperations.observeRepairDirectories
                >[0];
              }>,
            ) => {
              assert.equal(target.kind, "docker_runtime_directory");
              const input = target.input;
              retentionReads++;
              assert.equal(retained, true);
              assert.equal(input.canObserve(), true);
              assert.equal(input.signal.aborted, false);
              assertRetainedArtifact();
              assert.deepEqual(
                input.checkpoint.directories.primary.retained.identity,
                retainedIdentity,
              );
              assert.equal(
                input.checkpoint.directories.failed.retained.identity,
                null,
              );
              assert.equal(
                input.checkpoint.directories.auxiliary.retained.identity,
                null,
              );
              return {
                primary: retainedIdentity,
                failed: null,
                auxiliary: null,
              };
            },
            restartDockerEnvironment: (
              request: isolation.DockerEnvironmentRequest,
            ) => {
              if (request.mode !== "repair")
                throw new Error("unexpected_fixture_restart");
              return runRepairSessionWithDependencies(request.input, {
                acquire: async () => {
                  acquisitions++;
                  return {
                    cleanupConfirmed: true,
                    operations: {
                      verify: () => true,
                      command: async () => {
                        throw Error("unexpected_repair_effect");
                      },
                      close: async () => true,
                    },
                  };
                },
                prepare: async () => ({
                  cleanupFailure: () => null,
                  technical: {
                    observe: async (checkpoint) => {
                      observations++;
                      repairActiveState = fs.readFileSync(repairStatePath);
                      const active = JSON.parse(
                        repairActiveState.toString("utf8"),
                      );
                      assert.equal(active.operations.length, 1);
                      assert.equal(active.operations[0].kind, "docker_repair");
                      assert.equal(
                        active.operations[0].checkpoint.cleanup,
                        "pending",
                      );
                      return {
                        ...checkpoint,
                        directories: Object.fromEntries(
                          Object.entries(checkpoint.directories).map(
                            ([key, pair]) => [
                              key,
                              retained && key === "primary"
                                ? {
                                    expected: retainedIdentity,
                                    source:
                                      checkpoint.actions.retain_runtime
                                        .result === "confirmed"
                                        ? { state: "absent", identity: null }
                                        : {
                                            state: "present",
                                            identity: retainedIdentity,
                                          },
                                    retained:
                                      checkpoint.actions.retain_runtime
                                        .result === "confirmed"
                                        ? {
                                            state: "present",
                                            identity: retainedIdentity,
                                          }
                                        : { state: "absent", identity: null },
                                  }
                                : {
                                    ...pair,
                                    source: {
                                      state: "absent",
                                      identity: null,
                                    },
                                    retained: {
                                      state: "absent",
                                      identity: null,
                                    },
                                  },
                            ],
                          ),
                        ) as typeof checkpoint.directories,
                        engine:
                          retained &&
                          checkpoint.actions.retain_runtime.result !==
                            "confirmed"
                            ? "unavailable"
                            : "ready",
                        hostSafety: "safe",
                        stale:
                          retained &&
                          checkpoint.actions.retain_runtime.result ===
                            "confirmed"
                            ? "retained"
                            : "absent",
                      };
                    },
                    precondition: async (action) =>
                      retained && action === "retain_runtime"
                        ? "proceed"
                        : "not_required",
                    execute: async (action, checkpoint) => {
                      assert.equal(retained, true);
                      assert.equal(action, "retain_runtime");
                      retentionEffects++;
                      assert.equal(retentionEffects, 1);
                      fs.renameSync(sourceDirectory, retainedDirectory);
                      assertRetainedArtifact();
                      return {
                        issued: true,
                        confirmation: "confirmed",
                        observation: {
                          ...checkpoint,
                          stale: "retained",
                          directories: {
                            ...checkpoint.directories,
                            primary: {
                              expected: retainedIdentity,
                              source: { state: "absent", identity: null },
                              retained: {
                                state: "present",
                                identity: retainedIdentity,
                              },
                            },
                          },
                        },
                      };
                    },
                    awaitEngine: async (stage, checkpoint) => {
                      engineWaits++;
                      assert.equal(stage, "after_initial_start");
                      assert.equal(
                        checkpoint.actions.start_runtime.result,
                        "not_required",
                      );
                      return { state: "ready", continuation: null };
                    },
                  },
                }),
              });
            },
          },
        },
      );
      try {
        let repair: typeof import("../../src/lifecycle/environment.ts") =
          await import(
            new URL(
              `../../src/lifecycle/environment.ts?normal-owner-ready-prefix-${retained}`,
              import.meta.url,
            ).href
          );
        let result = await repair.executeDockerRepair(
          verified.capability,
          new AbortController().signal,
          null,
          "repair",
        );
        if (retained) {
          assert.equal(disposalDecisionRefusals, 1);
          assert.equal(disposalCalls, 0);
          assert.ok(result.recoveryId);
          const waiting = JSON.parse(fs.readFileSync(repairStatePath, "utf8"));
          assert.equal(waiting.operations.length, 1);
          assert.equal(waiting.operations[0].phase, "awaiting_disposition");
          assert.equal(
            waiting.operations[0].disposition,
            "pending_human_decision",
          );
          assert.equal(result.completionConfirmed, false);
          assertRetainedArtifact();
          writerFault?.restore();
          writerFault = null;
          repair = await import(
            new URL(
              "../../src/lifecycle/environment.ts?normal-owner-retained-after-cut",
              import.meta.url,
            ).href
          );
          result = await repair.executeDockerRepair(
            verified.capability,
            new AbortController().signal,
            result.recoveryId,
            "retain",
          );
          assert.equal(result.retentionConfirmed, true, JSON.stringify(result));
          assert.equal(retentionReads, 1);
          assert.equal(retentionEffects, 1);
          assert.equal(disposalCalls, 0);
          assertRetainedArtifact();
        }
        assert.equal(result.historyConfirmed, true, JSON.stringify(result));
        assert.equal(result.completionConfirmed, true, JSON.stringify(result));
        assert.equal(acquisitions, 1);
        assert.equal(engineWaits, 1);
        assert.ok(observations > 0 && repairActiveState);
        repairCompletedState = fs.readFileSync(repairStatePath);
        const settled = JSON.parse(repairCompletedState.toString("utf8"));
        assert.deepEqual(settled.operations, []);
        assert.deepEqual(settled.unresolvedRecoveries, []);
        assert.equal(Object.hasOwn(settled, "pendingDeliveries"), false);
        repairHistory = fs.readFileSync(
          path.join(path.dirname(repairStatePath), "history.jsonl"),
        );
        const observed = stateModel.readState(
          prepareFixtureRecovery(verified.capability),
          {
            scope: "recovery",
            input: {
              kind: "history",
            },
          },
        );
        assert.equal(observed.status, "completed", observed.reason);
        assert.equal(observed.lockReleased, true);
        assert.ok(observed.value && observed.historyRows);
        repairHistoryRows = observed.historyRows;
        assert.equal(repairHistoryRows.length, 1);
        const row = repairHistoryRows[0];
        assert.ok(row);
        const savedRow = JSON.parse(repairHistory.toString("utf8"));
        assert.equal(row.recoveryId, result.recoveryId);
        assert.equal(row.line, repairHistory.toString("utf8"));
        assert.equal(row.occurredAt, savedRow.occurredAt);
        assert.equal(
          row.lineSha256,
          createHash("sha256").update(repairHistory).digest("hex"),
        );
        assert.equal(
          row.summarySha256,
          createHash("sha256")
            .update(`${canonicalJson(savedRow.summary)}\n`)
            .digest("hex"),
        );
        assert.deepEqual(
          fs.readFileSync(repairStatePath),
          repairCompletedState,
        );
        assert.deepEqual(
          fs.readFileSync(
            path.join(path.dirname(repairStatePath), "history.jsonl"),
          ),
          repairHistory,
        );
        assert.equal(
          JSON.parse(repairHistory.toString("utf8")).summary.schema,
          "crdd-coordinator/repair-summary/v1",
        );
        assertRepairHistory(repairHistory);
        if (retained) {
          const receipt = JSON.parse(repairHistory.toString("utf8")).summary
            .retention;
          assert.ok(receipt);
          assert.equal(
            Date.parse(receipt.reviewAfter) - Date.parse(receipt.decidedAt),
            604800000,
          );
          assert.equal(result.retentionReviewAfter, receipt.reviewAfter);
          for (const purpose of ["repair", "retain"] as const) {
            const repeated: Awaited<
              ReturnType<typeof repair.executeDockerRepair>
            > = await repair.executeDockerRepair(
              verified.capability,
              new AbortController().signal,
              result.recoveryId,
              purpose,
            );
            assert.equal(repeated.completionConfirmed, true);
            assert.equal(repeated.retentionConfirmed, true);
            assert.equal(repeated.retentionReviewAfter, receipt.reviewAfter);
            assert.equal(acquisitions, 1);
            assert.equal(retentionReads, 1);
            assert.equal(retentionEffects, 1);
            assert.deepEqual(
              fs.readFileSync(repairStatePath),
              repairCompletedState,
            );
            assertRepairHistory(
              fs.readFileSync(
                path.join(path.dirname(repairStatePath), "history.jsonl"),
              ),
            );
          }
        }
        const changed = JSON.parse(repairHistory.toString("utf8"));
        // 引数だけの改変・重複は実File不一致として拒否する。構文検査はEM試験が所有する。
        changed.occurredAt = new Date(
          Date.parse(changed.occurredAt) + 1,
        ).toISOString();
        assert.throws(() =>
          assertRepairHistory(Buffer.from(`${canonicalJson(changed)}\n`)),
        );
        const duplicated = Buffer.concat([repairHistory, repairHistory]);
        assert.throws(() => assertRepairHistory(duplicated));
        for (const name of [
          "state.lock",
          "state.pending.json",
          "history.pending.jsonl",
        ])
          assert.throws(
            () => fs.lstatSync(path.join(path.dirname(repairStatePath), name)),
            { code: "ENOENT" },
          );
        repairClosed = true;
      } finally {
        writerFault?.restore();
        technical.restore();
      }
    }
    const hostLocation = getRepository(root);
    assert.equal(hostLocation.status, "completed");
    if (hostLocation.status !== "completed") throw Error("root_unavailable");
    const hostRepository = hostLocation.capability;
    const hostInput = {
      root: hostRepository,
      purpose: "task" as const,
      recordingCurrent: () =>
        resolveVerifiedRepositoryRoot(hostRepository) === root,
    };
    owned = hostRuntime.createOwnedOperationDirectories(hostInput);
    otherOwned = hostRuntime.createOwnedOperationDirectories(hostInput);
    if (retained) {
      assertRetainedArtifact();
      assert.equal(
        path.relative(retainedDirectory, owned.root).startsWith(".."),
        true,
      );
      assert.equal(fs.existsSync(path.join(owned.root, "marker")), false);
    }
    management = hostRuntime.createOwnedOperationManagementCapability(
      hostRuntime.createOwnedOperationContextCapability(owned),
      hostRuntime.createOwnedMountCapability(owned),
    );
    const otherManagement =
      hostRuntime.createOwnedOperationManagementCapability(
        hostRuntime.createOwnedOperationContextCapability(otherOwned),
        hostRuntime.createOwnedMountCapability(otherOwned),
      );
    assert.ok(repository.bindRepositoryOperation(management, root));
    assert.ok(repository.bindRepositoryOperation(otherManagement, root));
    const binding = repository.borrowCoordinatorStateRepository(management);
    const otherBinding =
      repository.borrowCoordinatorStateRepository(otherManagement);
    assert.ok(binding && otherBinding);
    const initialized = stateModel.readState(
      prepareFixtureRecovery(hostRepository),
      {
        scope: "recovery",
      },
    );
    assert.equal(initialized.status, "completed");
    assert.equal(initialized.lockReleased, true);
    assert.ok(initialized.value);
    assert.equal(
      initialized.value.snapshot.operations.filter(
        (item) => item.kind === "host_operation",
      ).length,
      2,
    );
    const hash = randomBytes(32).toString("hex"),
      suffix = randomBytes(8).toString("hex");
    const resolvedSelection = executionSelection("executor", {
      provider: "codex",
      model: "gpt-5.5",
      effort: "low",
    });
    const plan = Object.freeze({
      provider: "codex" as const,
      consumer: "workbench" as const,
      operationId: binding.operationId,
      executionSelection: resolvedSelection,
      taskAttempt: 0 as const,
      providerHomeIdentityHash: hash,
      stableLogicalHomeBindingHash: hash,
      authContainerName: `crdd-auth-${suffix}`,
      providerContainerName: `crdd-codex-${suffix}`,
      proxyContainerName: `crdd-proxy-${suffix}`,
      internalNetworkName: `crdd-internal-${suffix}`,
      egressNetworkName: `crdd-egress-${suffix}`,
      ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
      providerImageDigest: `sha256:${hash}`,
      proxyImageDigest: `sha256:${hash}`,
      operationMode: "workbench_advice" as const,
      workspaceMountMode: null,
    });
    const baseOwner = await import("../../src/lifecycle/environment.ts");
    const otherIdentity = baseOwner.prepareRepositoryDockerOperationIdentity(
      {
        ...plan,
        operationId: otherBinding.operationId,
        stableLogicalHomeBindingHash: randomBytes(32).toString("hex"),
      },
      otherManagement,
      () => randomBytes(32).toString("hex"),
    );
    assert.ok(otherIdentity);
    const currentFile = path.join(
      root,
      ".crdd",
      "execution-model",
      "state.json",
    );
    const beforeStart = fs.readFileSync(currentFile);
    assert.equal(
      initialized.value.payloadSha256,
      createHash("sha256").update(beforeStart).digest("hex"),
    );
    if (repeatCount === 1) {
      assert.ok(repairCompletedState);
      const previous = JSON.parse(repairCompletedState.toString("utf8"));
      const actual = parseStoredExecutionFixture(beforeStart.toString("utf8"));
      assert.deepEqual(
        actual.operations.filter((item) => item.kind !== "host_operation"),
        previous.operations,
      );
      assert.deepEqual(
        {
          ...actual,
          operations: previous.operations,
          revision: previous.revision,
          previous: previous.previous,
        },
        previous,
      );
    }
    if (repairActiveState) {
      assert.ok(repairCompletedState);
      const activeRepair = JSON.parse(
        Buffer.from(repairActiveState).toString("utf8"),
      ).operations[0];
      assert.equal(activeRepair.kind, "docker_repair");
      const current = parseStoredExecutionFixture(beforeStart.toString("utf8"));
      const ordered = current.operations.map((value) => {
        assert.equal(value.kind, "host_operation");
        assert.ok("operationId" in value);
        return { key: value.operationId, value };
      });
      ordered.push({
        key: JSON.parse(activeRepair.identityJson).operationNonce,
        value: activeRepair,
      });
      ordered.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
      const activeWithHosts = Buffer.from(
        `${canonicalJson({
          ...current,
          operations: ordered.map(({ value }) => value),
        })}\n`,
      );
      fs.writeFileSync(currentFile, activeWithHosts);
      try {
        const active = stateModel.readState(
          prepareFixtureRecovery(hostRepository),
          {
            scope: "recovery",
          },
        );
        assert.equal(active.status, "completed", active.reason);
        assert.deepEqual(
          active.value?.snapshot.operations.filter(
            (item) => item.kind === "docker_repair",
          ),
          [activeRepair],
        );
        const refused = stateModel.saveOperationStart(
          operationStartInput(otherManagement, () => null),
          otherIdentity.identityJson,
        );
        assert.equal(refused.status, "blocked");
        assert.equal(refused.startSaved, false);
        assert.equal(refused.snapshotConfirmed, false);
        assert.equal(refused.filesystemEffectIssued, false);
        assert.equal(refused.lockReleased, true);
        assert.deepEqual(fs.readFileSync(currentFile), activeWithHosts);
        assert.equal(
          fs.existsSync(
            path.join(path.dirname(currentFile), "state.pending.json"),
          ),
          false,
        );
        assert.equal(
          fs.existsSync(path.join(path.dirname(currentFile), "state.lock")),
          false,
        );
      } finally {
        fs.writeFileSync(currentFile, beforeStart);
      }
    }
    const otherStarted = stateModel.saveOperationStart(
      operationStartInput(otherManagement, () => null),
      otherIdentity.identityJson,
    );
    assert.equal(otherStarted.status, "completed");
    assert.ok(otherStarted.recoveryId);
    if (repairHistory)
      assertRepairHistory(
        fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "history.jsonl"),
        ),
      );
    if (repairCompletedState) {
      const prior = initialized.value;
      const next = stateModel.readState(operationStateInput(management), {
        scope: "operation",
      }).value;
      assert.ok(prior && next);
      assert.equal(next.snapshot.revision, prior.snapshot.revision + 1);
      const nextBytes = fs.readFileSync(currentFile);
      assert.equal(
        next.payloadSha256,
        createHash("sha256").update(nextBytes).digest("hex"),
      );
      assert.deepEqual(
        parseStoredExecutionFixture(nextBytes.toString("utf8")).previous,
        {
          revision: prior.snapshot.revision,
          payloadSha256: prior.payloadSha256,
        },
      );
    }
    const otherBefore = stateModel
      .readState(operationStateInput(management), { scope: "operation" })
      .value?.snapshot.operations.find(
        (item) => item.recoveryId === otherStarted.recoveryId,
      );
    assert.ok(otherBefore);
    const otherHostBefore = hostRuntime.readOwnedHostOperation(otherManagement);
    const hostBefore = hostRuntime.readOwnedHostOperation(management);
    const proofs = new Map<
      object,
      {
        recoveryId: string;
        completionPlan: typeof plan;
        dockerResult: Readonly<{
          status: "completed";
          reason: "provider_operation_completed";
          cleanupConfirmed: true;
        }>;
      }
    >();
    const resourceSnapshot = {
      resources: (
        [
          ["create_egress_network", plan.egressNetworkName],
          ["create_internal_network", plan.internalNetworkName],
          ["create_provider", plan.providerContainerName],
          ["create_proxy", plan.proxyContainerName],
          ["create_subscription_auth_probe", plan.authContainerName],
        ] as const
      ).map(([key, name]) => ({
        key,
        identity: {
          kind: key.endsWith("_network")
            ? ("network" as const)
            : ("container" as const),
          name,
          ownershipLabel: plan.ownershipLabel,
          dockerId: null,
        },
        request: "not_issued" as const,
        configuration: {
          image: null,
          command: null,
          environmentNames: null,
          mounts: null,
          networks: null,
          internal: null,
        },
      })),
    };
    const resources = resourceSnapshot.resources.map((r) => ({
      key: r.key,
      observation: "not_requested" as const,
    }));
    const effects = await import("../../src/lifecycle/execution.ts");
    substitutions.push(
      mock.module(
        new URL("../../src/lifecycle/environment.ts", import.meta.url).href,
        {
          namedExports: {
            ...homes,
            inspectWindowsProviderHomeCandidate: (provider: unknown) => {
              assert.equal(provider, plan.provider);
              return {
                status: "candidate",
                providerHome: plan,
              };
            },
          },
        },
      ),
    );
    const actualStore: typeof stateRuntime = await import(
      new URL(
        `../../../execution-model/src/index.ts?normal-owner-physical-${repeatCount}-${retained}`,
        import.meta.url,
      ).href
    );
    let lastResourceSave: ReturnType<
      typeof stateRuntime.saveOperationCheckpoint
    > | null = null;
    substitutions.push(
      mock.module(
        new URL("../../../execution-model/src/index.ts", import.meta.url).href,
        {
          namedExports: {
            ...actualStore,
            saveOperationCheckpoint: (
              ...args: Parameters<typeof actualStore.saveOperationCheckpoint>
            ) => {
              const saved = actualStore.saveOperationCheckpoint(...args);
              if (args[2].kind === "resource") lastResourceSave = saved;
              return saved;
            },
          },
        },
      ),
    );
    // Module全体を再評価して現在の依存閉包へ接続する。宣言本文と手書きimportを組み立てない。
    const actualHostSubmission = await import(
      new URL(
        "../../src/lifecycle/execution.ts?normal-owner-host-" +
          repeatCount +
          "-" +
          retained,
        import.meta.url,
      ).href
    );
    substitutions.push(
      mock.module(
        new URL("../../src/lifecycle/execution.ts", import.meta.url).href,
        { namedExports: { ...effects, ...actualHostSubmission } },
      ),
    );
    const ownerFixtureUrl = recoveryEnvironmentFixtureUrl(
      new URL("../../src/lifecycle/environment.ts", import.meta.url),
    );
    // 同じ本文でも別CaseのModuleに残った代役・Owner Mapを再利用しない。
    ownerRuntime = await import(
      `${ownerFixtureUrl}#${randomBytes(16).toString("hex")}`
    );
    assert.ok(ownerRuntime);
    const statePath = path.join(root, ".crdd", "execution-model", "state.json");
    const completedOperations = new Map<string, unknown>();
    const nonces = new Set<string>();
    for (let round = 0; round < repeatCount; round++) {
      const beforeBegin = JSON.parse(fs.readFileSync(statePath, "utf8"));
      assert.equal(
        hostRuntime.readOwnedHostOperation(management).record.recoveryId,
        hostBefore.record.recoveryId,
      );
      const begun: ReturnType<typeof baseOwner.beginDockerRecovery> =
        ownerRuntime.beginDockerRecovery(plan, management);
      assert.ok(begun && begun.status === "ready", JSON.stringify(begun));
      assertRetainedArtifact();
      if (repairHistory)
        assertRepairHistory(
          fs.readFileSync(
            path.join(root, ".crdd", "execution-model", "history.jsonl"),
          ),
        );
      const capability: object = begun.recoveryCapability;
      const recoveryId: string = begun.recoveryId;
      pendingCapabilities.add(capability);
      assert.ok(
        ![...proofs.values()].some((proof) => proof.recoveryId === recoveryId),
      );
      const proof: NonNullable<ReturnType<typeof proofs.get>> = {
        recoveryId,
        completionPlan: Object.freeze({
          ...plan,
        }),
        dockerResult: Object.freeze({
          status: "completed" as const,
          reason: "provider_operation_completed" as const,
          cleanupConfirmed: true as const,
        }),
      };
      proofs.set(capability, proof);
      const afterBegin = JSON.parse(fs.readFileSync(statePath, "utf8"));
      assert.deepEqual(
        afterBegin.operations.filter(
          (item: { recoveryId: string }) => item.recoveryId !== recoveryId,
        ),
        beforeBegin.operations,
      );
      const added = afterBegin.operations.find(
        (item: { recoveryId: string }) => item.recoveryId === recoveryId,
      );
      assert.ok(added);
      const actualIdentity = JSON.parse(added.identityJson);
      assert.equal(actualIdentity.operationId, plan.operationId);
      assert.equal(actualIdentity.stableLogicalHomeBindingHash, hash);
      assert.ok(!nonces.has(actualIdentity.operationNonce));
      nonces.add(actualIdentity.operationNonce);
      // このCaseはExecutor技術処理を代役にする。Home排他の所有もそこで明示する。
      const executorHome = locks.acquireProviderHomeLock(
        hash,
        homes.providerHomesDirectoryCandidate(),
      );
      assert.equal(executorHome.status, "acquired");
      if (executorHome.status !== "acquired")
        throw new Error("fixture_home_lock_unavailable");
      fixtureHomeLease = executorHome.lock;
      const competingHome = locks.acquireProviderHomeLock(
        hash,
        homes.providerHomesDirectoryCandidate(),
      );
      if (competingHome.status === "acquired")
        assert.equal(competingHome.lock.release(), true);
      assert.equal(competingHome.status, "blocked");
      const startedHost = hostRuntime.readOwnedHostOperation(management);
      assert.equal(startedHost.record.phase, "active");
      assert.equal(startedHost.record.recoveryId, hostBefore.record.recoveryId);
      assert.equal(
        path.join(root, ".crdd", "coordinator", startedHost.record.operationId),
        owned.root,
      );
      // 有限Host試験はDocker要求を発行しない。元予定と明示未発行通知を保存する。
      const resourceFrame = {
        snapshot: resourceSnapshot,
        cleanup: {
          cleanupOrder: resourceSnapshot.resources.map((r) => r.key),
          setupTimeoutMs: 15000,
          unreceiptedAbsence: "retain",
          verifyLabelAbsence: true,
        },
      };
      assert.equal(
        ownerRuntime.recordDockerResourceEvent(
          capability,
          "create_subscription_auth_probe",
          resourceFrame,
          "submission",
        ),
        true,
        JSON.stringify({
          save: lastResourceSave,
          resourceValid:
            stateModel.applyResourceEvent(null, {
              ...resourceFrame,
              event: "submission",
              key: "create_subscription_auth_probe",
            }) !== null,
        }),
      );
      for (const resource of resourceSnapshot.resources)
        assert.equal(
          ownerRuntime.recordDockerResourceNotIssued(capability, resource.key),
          resource.key === "create_subscription_auth_probe",
        );
      const beforeComplete = fs.readFileSync(statePath);
      assert.equal(
        ownerRuntime.verifyDockerHomeLeaseRelease(
          capability,
          management,
          plan.operationId,
          recoveryId,
        ),
        false,
      );
      assert.equal(
        ownerRuntime.finishDockerRecovery(capability, {
          hostCleanupOutcome: null,
          dockerCompletion: null,
        }).status,
        "blocked",
      );
      assert.equal(
        ownerRuntime.completeDockerRecovery(
          { ...capability },
          management,
          proof.completionPlan,
        ).status,
        "blocked",
      );
      if (round > 0) {
        const previousProof = [...proofs.values()][0];
        assert.ok(previousProof);
        assert.equal(
          ownerRuntime.completeDockerRecovery(
            capability,
            management,
            previousProof.completionPlan,
          ).status,
          "blocked",
        );
      }
      assert.deepEqual(fs.readFileSync(statePath), beforeComplete);
      assert.ok(fixtureHomeLease);
      const homeLeaseReleased = fixtureHomeLease.release();
      assert.equal(homeLeaseReleased, true);
      fixtureHomeLease = null;
      const completed = ownerRuntime.recordAttemptCleanup({
        plan: proof.completionPlan as RecoveryPlan,
        recoveryCapability: capability,
        managementCapability: management,
        recoveryId,
        resourceSnapshot,
        observations: resources,
        homeLeaseReleased,
      });
      assert.equal(
        completed.recoveryCompleted,
        true,
        JSON.stringify(completed),
      );
      assert.equal(
        ownerRuntime.verifyDockerHomeLeaseRelease(
          capability,
          management,
          plan.operationId,
          recoveryId,
        ),
        true,
      );
      assert.equal(
        ownerRuntime.verifyDockerHomeLeaseRelease(
          { ...capability },
          management,
          plan.operationId,
          recoveryId,
        ),
        false,
      );
      const releaseProofState = fs.readFileSync(statePath);
      const releaseProofTuples: ReadonlyArray<
        readonly [object, string, string]
      > = [
        [otherManagement, plan.operationId, recoveryId],
        [management, otherBinding.operationId, recoveryId],
        [management, plan.operationId, otherStarted.recoveryId],
      ];
      for (const [
        proofOwner,
        proofOperation,
        proofRecovery,
      ] of releaseProofTuples) {
        assert.equal(
          ownerRuntime.verifyDockerHomeLeaseRelease(
            capability,
            proofOwner,
            proofOperation,
            proofRecovery,
          ),
          false,
        );
        assert.deepEqual(fs.readFileSync(statePath), releaseProofState);
        assert.equal(
          ownerRuntime.verifyDockerHomeLeaseRelease(
            capability,
            management,
            plan.operationId,
            recoveryId,
          ),
          true,
        );
      }
      const reacquiredAcquisition = locks.acquireProviderHomeLock(
        hash,
        homes.providerHomesDirectoryCandidate(),
      );
      assert.ok(reacquiredAcquisition.status === "acquired");
      const reacquired = reacquiredAcquisition.lock;
      assert.ok(reacquired);
      assert.equal(reacquired.release(), true);
      const completedHost = hostRuntime.readOwnedHostOperation(management);
      assert.equal(completedHost.record.phase, "active");
      assert.equal(
        completedHost.record.recoveryId,
        hostBefore.record.recoveryId,
      );
      const afterComplete = JSON.parse(fs.readFileSync(statePath, "utf8"));
      const completedOperation = afterComplete.operations.find(
        (item: { recoveryId: string }) => item.recoveryId === recoveryId,
      );
      assert.equal(completedOperation.lease, "released");
      assert.equal(completedOperation.execution.ownerEffect, "disabled");
      const submissionBefore = fs.readFileSync(statePath);
      assert.equal(
        ownerRuntime.recordDockerProviderSubmission(capability),
        false,
      );
      assert.deepEqual(fs.readFileSync(statePath), submissionBefore);
      assert.deepEqual(
        afterComplete.operations.filter(
          (item: { recoveryId: string }) => item.recoveryId !== recoveryId,
        ),
        beforeBegin.operations,
      );
      completedOperations.set(
        recoveryId,
        afterComplete.operations.find(
          (item: { recoveryId: string }) => item.recoveryId === recoveryId,
        ),
      );
      const beforeCleanup = fs.readFileSync(statePath);
      assert.equal(
        ownerRuntime.finishDockerRecovery(capability, {
          hostCleanupOutcome: null,
          dockerCompletion: proof.dockerResult,
        }).status,
        "blocked",
      );
      assert.deepEqual(fs.readFileSync(statePath), beforeCleanup);
      if (repairHistory)
        assert.deepEqual(
          fs.readFileSync(path.join(path.dirname(statePath), "history.jsonl")),
          repairHistory,
        );
      else
        assert.equal(
          fs.existsSync(path.join(path.dirname(statePath), "history.jsonl")),
          false,
        );
    }
    assert.equal(proofs.size, repeatCount);
    assert.equal(nonces.size, repeatCount);
    for (const [capability, proof] of proofs) {
      const before = JSON.parse(fs.readFileSync(statePath, "utf8"));
      for (const [id, expected] of completedOperations)
        assert.deepEqual(
          before.operations.find(
            (item: { recoveryId: string }) => item.recoveryId === id,
          ),
          expected,
        );
      const observed: ReturnType<typeof stateModel.readState> =
        stateModel.readState(operationStateInput(management), {
          scope: "operation",
        });
      assert.equal(observed.status, "completed");
      assert.equal(observed.lockReleased, true);
      assert.equal(
        ownerRuntime.canPrepareDockerHostCleanup(
          capability,
          observed.value?.operationStates.find(
            (state) => state.operation.recoveryId === proof.recoveryId,
          ),
        ),
        true,
      );
      assert.equal(
        hostRuntime.readOwnedHostOperation(management).record.recoveryId,
        hostBefore.record.recoveryId,
      );
      const after = JSON.parse(fs.readFileSync(statePath, "utf8"));
      assert.deepEqual(
        after.operations.filter(
          (item: { recoveryId: string }) =>
            item.recoveryId !== proof.recoveryId,
        ),
        before.operations.filter(
          (item: { recoveryId: string }) =>
            item.recoveryId !== proof.recoveryId,
        ),
      );
      completedOperations.set(
        proof.recoveryId,
        after.operations.find(
          (item: { recoveryId: string }) =>
            item.recoveryId === proof.recoveryId,
        ),
      );
    }
    const verifyHostCleanup =
      hostRuntime.captureOwnedOperationCleanupVerification(management);
    assert.ok(verifyHostCleanup);
    const cleanupResult =
      await hostRuntime.cleanupOwnedOperationDirectories(owned);
    assert.equal(verifyHostCleanup(cleanupResult), "completed");
    hostCleaned = true;
    if (repairHistory)
      assertRepairHistory(
        fs.readFileSync(
          path.join(root, ".crdd", "execution-model", "history.jsonl"),
        ),
      );
    assert.equal(fs.existsSync(owned.root), false);
    const hostAfter = stateModel.readState(
      prepareFixtureRecovery(hostRepository),
      {
        scope: "recovery",
      },
    );
    assert.equal(hostAfter.status, "completed");
    assert.equal(
      hostAfter.value?.snapshot.operations.find(
        (item) =>
          item.kind === "host_operation" &&
          item.recoveryId === hostBefore.record.recoveryId,
      )?.phase,
      "terminal",
    );
    if (repeatCount === 3) {
      if (!request) throw new Error("normal_owner_http_probe_required");
      let received!: () => void;
      const arrival = new Promise<void>((resolve) => {
        received = resolve;
      });
      httpServer = createServer((_request, response) => {
        serverReceivedAt = Date.now();
        response.once("finish", () => {
          serverFinishedAt = Date.now();
        });
        received();
        setImmediate(() => {
          response.setHeader("Content-Type", "application/json");
          response.end('{"status":"observed"}');
        });
      });
      const server = httpServer;
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
      });
      const address = httpServer.address();
      assert.ok(address && typeof address !== "string");
      httpPending = request(`http://127.0.0.1:${address.port}/`, (timing) =>
        httpTimings.push(timing),
      );
      await Promise.race([
        arrival,
        httpPending.then(() => {
          throw new Error("http_arrival_unconfirmed");
        }),
      ]);
    }
    for (const [capability, proof] of [...proofs].reverse()) {
      const terminalObservation = Object.freeze({
        operationId: plan.operationId,
        recoveryId: proof.recoveryId,
        resourceSnapshot,
        resources,
        primaryFailure: null,
        processTreeTerminationConfirmed: true,
        containersAbsent: true,
        networksAbsent: true,
        homeLeaseReleased: true,
        recoveryCompleted: true,
      });
      ownerRuntime.recordDockerTerminalObservation(
        capability,
        proof.dockerResult,
        terminalObservation,
      );
      const terminalOwner = ownerRuntime;
      assert.doesNotThrow(() =>
        terminalOwner.recordDockerTerminalObservation(
          capability,
          proof.dockerResult,
          terminalObservation,
        ),
      );
      assert.throws(
        () =>
          terminalOwner.recordDockerTerminalObservation(
            capability,
            proof.dockerResult,
            { ...terminalObservation, homeLeaseReleased: false },
          ),
        /executor_terminal_delivery_mismatch/,
      );
      const beforeReceipt = fs.readFileSync(statePath);
      const before = JSON.parse(beforeReceipt.toString("utf8"));
      assert.equal(
        ownerRuntime.finishDockerRecovery(capability, {
          hostCleanupOutcome: { ...cleanupResult },
          dockerCompletion: proof.dockerResult,
        }).status,
        "blocked",
      );
      if (repeatCount > 1) {
        const otherProof = [...proofs.values()].find((item) => item !== proof);
        assert.ok(otherProof);
        assert.equal(
          ownerRuntime.finishDockerRecovery(capability, {
            hostCleanupOutcome: cleanupResult,
            dockerCompletion: otherProof.dockerResult,
          }).status,
          "blocked",
        );
      }
      assert.deepEqual(fs.readFileSync(statePath), beforeReceipt);
      assert.equal(
        ownerRuntime.verifyDockerHomeLeaseRelease(
          capability,
          management,
          plan.operationId,
          proof.recoveryId,
        ),
        true,
      );
      const receiptStartedAt = Date.now();
      const recorded = ownerRuntime.finishDockerRecovery(capability, {
        hostCleanupOutcome: cleanupResult,
        dockerCompletion: proof.dockerResult,
      });
      stageTimings.push({
        stage: "receipt",
        startedAt: receiptStartedAt,
        completedAt: Date.now(),
      });
      assert.equal(recorded.status, "completed");
      // 本番Controllerと同じ、成功receiptの排他解放後だけI/Oへ返す。
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(
        ownerRuntime.verifyDockerHomeLeaseRelease(
          capability,
          management,
          plan.operationId,
          proof.recoveryId,
        ),
        false,
      );
      const after = JSON.parse(fs.readFileSync(statePath, "utf8"));
      assert.deepEqual(
        after.operations,
        before.operations.filter(
          (item: { recoveryId: string }) =>
            item.recoveryId !== proof.recoveryId,
        ),
      );
    }
    const afterReceipts = fs.readFileSync(statePath);
    const historyAfterReceipts = fs.readFileSync(
      path.join(path.dirname(statePath), "history.jsonl"),
    );
    for (const capability of [...proofs.keys()].reverse()) {
      const startedAt = Date.now();
      const finalized: Readonly<{ status: string }> =
        ownerRuntime.finishDockerRecovery(capability, {
          hostCleanupOutcome: cleanupResult,
          dockerCompletion: proofs.get(capability)?.dockerResult,
        });
      stageTimings.push({
        stage: "finalize",
        startedAt,
        completedAt: Date.now(),
      });
      assert.equal(finalized.status, "blocked", "確定後の再送は保存しない");
      assert.deepEqual(fs.readFileSync(statePath), afterReceipts);
      assert.deepEqual(
        fs.readFileSync(path.join(path.dirname(statePath), "history.jsonl")),
        historyAfterReceipts,
      );
      assert.equal(
        ownerRuntime.finishDockerRecovery(
          { ...capability },
          {
            hostCleanupOutcome: cleanupResult,
            dockerCompletion: proofs.get(capability)?.dockerResult,
          },
        ).status,
        "blocked",
      );
      assert.equal(
        ownerRuntime.finishDockerRecovery(capability, {
          hostCleanupOutcome: cleanupResult,
          dockerCompletion: proofs.get(capability)?.dockerResult,
        }).status,
        "blocked",
        "transient Ownerは確定後に退役する",
      );
      pendingCapabilities.delete(capability);
    }
    if (httpPending) {
      const result = await httpPending;
      assert.equal(result.status, 200);
      assert.equal(httpTimings.length, 1);
      const timing = httpTimings[0];
      const firstStage = stageTimings[0];
      const lastStage = stageTimings.at(-1);
      assert.ok(timing && firstStage && lastStage);
      assert.ok(serverReceivedAt !== null && serverFinishedAt !== null);
      assert.ok(serverReceivedAt <= firstStage.startedAt);
      const secondReceipt = stageTimings.filter(
        (stage) => stage.stage === "receipt",
      )[1];
      assert.ok(secondReceipt);
      assert.ok(firstStage.completedAt <= serverFinishedAt);
      assert.ok(serverFinishedAt <= secondReceipt.startedAt);
      assert.ok(serverFinishedAt <= lastStage.completedAt);
      assert.ok(timing.completedAt - timing.startedAt < 15_000);
      t.diagnostic(
        JSON.stringify({
          stageTimings,
          serverReceivedAt,
          serverFinishedAt,
          httpTimings,
          boundary:
            "実Writerと単純loopback応答の競合。Workbench全画面生成や実AIの証明ではない",
        }),
      );
    }
    const final = JSON.parse(fs.readFileSync(statePath, "utf8"));
    assert.deepEqual(
      final.operations.filter(
        (item: { kind: string }) => item.kind !== "host_operation",
      ),
      [otherBefore],
    );
    assert.deepEqual(
      final.operations.filter(
        (item: { kind: string }) => item.kind === "host_operation",
      ),
      hostAfter.value?.snapshot.operations.filter(
        (item) => item.kind === "host_operation",
      ),
    );
    assert.equal(final.operations.length, 3);
    assert.deepEqual(
      final.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId === otherHostBefore.record.recoveryId,
      ),
      otherHostBefore.record,
    );
    assert.deepEqual(final.unresolvedRecoveries, []);
    assert.equal(Object.hasOwn(final, "pendingDeliveries"), false);
    assertRetainedArtifact();
    const historyBytes = fs.readFileSync(
      path.join(path.dirname(statePath), "history.jsonl"),
    );
    if (repairHistory) {
      assertRepairHistory(historyBytes, repeatCount);
      assert.deepEqual(
        historyBytes.subarray(0, repairHistory.length),
        repairHistory,
      );
    }
    const allHistory = historyBytes
      .toString("utf8")
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(allHistory.length, repeatCount + (repairHistory ? 1 : 0));
    const history = allHistory.filter(
      (row) => row.summary.schema !== "crdd-coordinator/repair-summary/v1",
    );
    assert.equal(history.length, repeatCount);
    assert.deepEqual(
      new Set(history.map((row) => row.summary.recoveryId)),
      new Set([...proofs.values()].map((proof) => proof.recoveryId)),
    );
    assert.deepEqual(
      new Set(history.map((row) => row.summary.operationNonce)),
      nonces,
    );
    for (const row of history)
      assert.equal(row.summary.outcome.reason, "provider_operation_completed");
    for (const file of [
      "state.lock",
      "state.pending.json",
      "history.pending.jsonl",
    ])
      assert.equal(
        fs.existsSync(path.join(path.dirname(statePath), file)),
        false,
      );
    // 別操作は検証中ずっと不変に保った。ここからは、この試験が保存した未発行操作だけを終結する。
    assert.equal(otherBefore.kind, "docker_task");
    assert.equal(otherBefore.resources, null);
    assert.equal(otherBefore.execution.providerStart, "not_started");
    assert.equal(otherBefore.execution.externalSend, "not_issued");
    assert.equal(otherBefore.execution.sharedWrite, "not_issued");
    for (const lease of ["held", "released"] as const) {
      const settled = stateModel.saveOperationCheckpoint(
        operationStateInput(otherManagement),
        otherStarted.recoveryId,
        {
          kind: "lifecycle",
          value: {
            phase: "settling",
            lease,
            execution: { ...otherBefore.execution, ownerEffect: "disabled" },
            primaryFailure: null,
            outcome: null,
            summarySha256: null,
          },
        },
      );
      assert.equal(settled.status, "completed", settled.reason);
      assert.equal(settled.snapshotConfirmed, true);
      assert.equal(settled.lockReleased, true);
    }
  } catch (error) {
    failure = error;
  } finally {
    if (httpServer) {
      const server = httpServer;
      try {
        await httpPending?.catch(() => undefined);
        server.closeAllConnections();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        );
        assert.equal(httpServer.listening, false);
      } catch (error) {
        failure ??= error;
      }
    }
    // normal-owner-cleanup-begin
    let cleanupConfirmed = true;
    try {
      for (const cleanupStep of [
        async () => {
          if (fixtureHomeLease) {
            const lease = fixtureHomeLease;
            fixtureHomeLease = null;
            assert.equal(lease.release(), true);
          }
        },
        async () => {
          let released = true;
          if (ownerRuntime)
            for (const capability of pendingCapabilities) {
              try {
                released =
                  ownerRuntime.abandonDockerRecovery(capability) === true &&
                  released;
              } catch {
                released = false;
              }
            }
          assert.equal(released, true);
        },
        async () => {
          if (management && !hostCleaned)
            assert.equal(
              await hostRuntime.abandonOwnedHostOperationGenerationLock(
                management,
              ),
              true,
            );
        },
        async () => {
          if (owned && !hostCleaned) {
            const outcome =
              await hostRuntime.cleanupOwnedOperationDirectories(owned);
            assert.equal(
              hostRuntime.verifyOwnedOperationCleanupOutcome(outcome, owned),
              "completed",
            );
          }
        },
        async () => {
          if (otherOwned) {
            const outcome =
              await hostRuntime.cleanupOwnedOperationDirectories(otherOwned);
            assert.equal(
              hostRuntime.verifyOwnedOperationCleanupOutcome(
                outcome,
                otherOwned,
              ),
              "completed",
            );
          }
        },
      ]) {
        try {
          await cleanupStep();
        } catch (error) {
          cleanupConfirmed = false;
          failure ??= error;
        }
      }
      if (cleanupConfirmed && repairClosed) {
        try {
          assert.ok(
            path.dirname(root) === area.directory &&
              path.basename(root).startsWith("normal-owner-"),
          );
          fs.rmSync(root, { recursive: true });
          assert.equal(fs.existsSync(root), false);
        } catch (error) {
          failure ??= error;
        }
      }
    } finally {
      for (const substitution of substitutions.reverse()) {
        try {
          substitution.restore();
        } catch (error) {
          failure ??= error;
        }
      }
    }
    // normal-owner-cleanup-end
  }
  if (failure !== null) {
    t.diagnostic(
      JSON.stringify({
        stageTimings,
        serverReceivedAt,
        serverFinishedAt,
        httpTimings,
        boundary: "正常Owner保存と受信済みloopback応答の有限時計",
      }),
    );
    throw failure;
  }
}

/**
 * 固定単一Process診断を既存の上位所有Handleへ変換する。
 * @responsibility ready、close、元子不存在を別の事実として保持する。
 * @trace ERB-IT-002
 * @precondition Windows Process制御profileだけで実行する。
 * @stimulus 固定ready_processを開始し取消する。
 * @observation 元Handleと固定元PID。
 * @oracle 元PID不存在と元Handle closeが必要。
 * @cleanup 元Handleの停止をjoinする。
 * @boundary 下位固定診断と上位Controller試験。
 */
export function createOwnedProcessFixture() {
  let attached: ReturnType<
    typeof startOwnedAttachTerminationFixture<"ready_process">
  > | null = null;
  let ids: readonly [number] | null = null;
  let owned: OwnedCommandHandle | null = null;
  return {
    start() {
      assert.equal(attached, null);
      const current = startOwnedAttachTerminationFixture(
        "ready_process",
        createDockerProcessEnvironment(homes.getIsolationSettings()),
      );
      attached = current;
      owned = Object.freeze({
        started: async (timeoutMs: number) =>
          (await bounded(current.started, timeoutMs)) === true,
        wait: (timeoutMs: number) => bounded(current.completion, timeoutMs),
        closed: current.isClosed,
        terminationRequested: () => current.getTerminationRequestCount() > 0,
        terminateAndWait: async (_graceMs: number) =>
          (await current.terminateAndWait()) !== null && current.isClosed(),
      });
      return owned;
    },
    async ready() {
      const startDeadline = Date.now() + 5_000;
      while (!attached) {
        assert.ok(Date.now() < startDeadline, "fixture_start_timeout");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(await bounded(attached.ready, 5_000), true);
      const deadline = Date.now() + 5_000;
      ids = attached.observedProcessIds();
      while (!ids) {
        assert.ok(Date.now() < deadline, "fixture_pid_observation_timeout");
        await new Promise((resolve) => setTimeout(resolve, 10));
        ids = attached.observedProcessIds();
      }
      assert.ok(ids.every(isPresent));
      return [...ids];
    },
    assertAbsent() {
      assert.ok(ids);
      assert.ok(ids.every((pid) => !isPresent(pid)));
      assert.equal(owned?.closed(), true);
    },
    async dispose() {
      if (!attached) return;
      assert.ok(await attached.terminateAndWait());
      assert.equal(attached.isClosed(), true);
      if (ids) assert.ok(ids.every((pid) => !isPresent(pid)));
    },
  };
}

/**
 * 試験待機を上限付きにし、timeoutをnullとして返す。
 * @responsibility 成功Promiseと期限を混同せずtimerを回収する。
 * @trace ERB-IT-002
 * @precondition 非負の有限期限を渡す。
 * @stimulus 元観測Promiseを待つ。
 * @observation 元結果またはnull。
 * @oracle timeoutは成功ではない。
 * @cleanup timerをfinallyで解除する。
 * @boundary 同一Process内の試験待機。
 */
async function bounded<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

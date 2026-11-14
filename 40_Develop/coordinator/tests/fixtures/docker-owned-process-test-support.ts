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
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
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
import { saveRepairState } from "../../../execution-model/src/index.ts";
import * as executorLibrary from "../../../executor/src/index.ts";
import type { Lock } from "../../../lock/src/index.ts";
import { getRepository } from "../../../version-control/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/configuration/runtime-data.ts";
import * as homes from "../../src/execution/authority.ts";
import {
  providerHomesDirectoryCandidate,
  runtimeStateDirectoryCandidate,
} from "../../src/execution/authority.ts";
import { getIsolationSettings } from "../../src/execution/configuration.ts";
import * as locks from "../../src/execution/kernel-lock.ts";
import * as hostRuntime from "../../src/execution/operation.ts";
import * as repository from "../../src/execution/operation.ts";
import {
  readOperationStateStage,
  saveOperationStart,
} from "../../src/execution/persistence.ts";
import * as controller from "../../src/execution/provider-executor.ts";
import type { RecoveryPlan } from "../../src/execution/types.ts";
import { hashExecutionSelection } from "../../src/selection/resolve.ts";
import { executionSelection } from "../fixtures/ai-selection.ts";
import { canonicalJson } from "../support/contract-assertions.ts";

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
 * @stimulus 指定回数のbegin／completeと逆順の結果確定。三回形は利用側の一要求を重ねる。
 * @observation 元のWriter・Home排他・Host marker・履歴・HTTP時計。
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
  // 共有Home・Runtimeの排他も、このCaseで生成したRootの中だけを使う。
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
  let ownerRuntime: typeof import("../../src/execution/recovery.ts") | null =
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
    const stateFile = path.join(root, ".crdd", "domain-model", "state.json");
    const historyFile = path.join(path.dirname(stateFile), "history.jsonl");
    assert.deepEqual(bytes, fs.readFileSync(historyFile));
    const before = fs.readFileSync(stateFile);
    const repository = getRepository(root);
    assert.equal(repository.status, "completed");
    assert.ok(repository.capability);
    const observed = stateModel.readState(repository.capability, {
      scope: "recovery",
      input: {
        kind: "history",
      },
    });
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
    for (const directory of [
      providerHomesDirectoryCandidate(),
      runtimeStateDirectoryCandidate(),
    ]) {
      assert.ok(directory);
      const relative = path.relative(root, directory);
      assert.ok(
        relative && !relative.startsWith("..") && !path.isAbsolute(relative),
      );
      fs.mkdirSync(directory, { recursive: true });
    }
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
    const hosts = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(root, "tests"),
      "normal_owner_hosts",
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
        "domain-model",
        "state.json",
      );
      let writerFault: ReturnType<typeof mock.module> | null = retained
        ? mock.module(
            new URL("../../../execution-model/src/index.ts", import.meta.url)
              .href,
            {
              namedExports: {
                ...stateRuntime,
                saveRepairState: (
                  ...args: Parameters<typeof saveRepairState>
                ) => {
                  if (args[2].change.kind === "disposal_decision") {
                    disposalDecisionRefusals++;
                    assert.equal(disposalDecisionRefusals, 1);
                    return saveRepairState(null, args[1], args[2], args[3]);
                  }
                  return saveRepairState(...args);
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
                      assert.equal(active.operations[0].kind, "runtime_repair");
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
        let repair: typeof import("../../src/execution/recovery.ts") =
          await import(
            new URL(
              `../../src/execution/recovery.ts?normal-owner-ready-prefix-${retained}`,
              import.meta.url,
            ).href
          );
        let result = await repair.repairRuntimeOwnedDockerRuntime(
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
              "../../src/execution/recovery.ts?normal-owner-retained-after-cut",
              import.meta.url,
            ).href
          );
          result = await repair.repairRuntimeOwnedDockerRuntime(
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
        const observed = stateModel.readState(verified.capability, {
          scope: "recovery",
          input: {
            kind: "history",
          },
        });
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
              ReturnType<typeof repair.repairRuntimeOwnedDockerRuntime>
            > = await repair.repairRuntimeOwnedDockerRuntime(
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
    owned = hostRuntime.createOwnedOperationDirectories(hosts.directory);
    otherOwned = hostRuntime.createOwnedOperationDirectories(hosts.directory);
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
    assert.ok(repository.bindRuntimeOwnedRepositoryOperation(management, root));
    assert.ok(
      repository.bindRuntimeOwnedRepositoryOperation(otherManagement, root),
    );
    const binding =
      repository.borrowRuntimeOwnedCoordinatorStateRepository(management);
    const otherBinding =
      repository.borrowRuntimeOwnedCoordinatorStateRepository(otherManagement);
    assert.ok(binding && otherBinding);
    const initial = Buffer.from(
      `${canonicalJson({ schema: "crdd-execution-model/state/v4", revision: 1, repositoryBindingId: null, intakeEpoch: null, intakeBindings: [], projects: [], managedExecutions: [], workspaces: [], queueEntries: [], leaseEvidence: [], leaseIntents: [], results: [], historyPending: [], decisions: [], blockers: [], previous: null, repositoryBinding: binding.repositoryBinding, operations: [], unresolvedRecoveries: [] })}\n`,
    );
    if (repeatCount >= 2) {
      // 再入場Caseの初期値を自己生成領域へ配置する。初期化Writerの保証はDomainが検証する。
      // Schema検査はEM側で実施し、このCaseでは後続の公開操作と保存本文を検証する。
      const stateArea = requireReadyRepositoryExecutionDataArea(
        ensureRepositoryExecutionDataAreaFromWorkingDirectory(
          root,
          "domain-model",
        ),
        "reentry_state_fixture",
      );
      fs.writeFileSync(path.join(stateArea.directory, "state.json"), initial, {
        flag: "wx",
      });
    } else {
      assert.ok(repairCompletedState);
      assert.deepEqual(
        fs.readFileSync(path.join(root, ".crdd", "domain-model", "state.json")),
        repairCompletedState,
      );
      assert.equal(
        JSON.parse(repairCompletedState.toString("utf8")).repositoryBinding,
        binding.repositoryBinding,
      );
    }
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
      grantRef: "PHMGRANT-FIXTURE",
      executionSelection: resolvedSelection,
      selectionHash: hashExecutionSelection(resolvedSelection),
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
    const baseOwner = await import("../../src/execution/recovery.ts");
    const otherIdentity =
      baseOwner.prepareRuntimeOwnedRepositoryDockerOperationIdentity(
        {
          ...plan,
          operationId: otherBinding.operationId,
          stableLogicalHomeBindingHash: randomBytes(32).toString("hex"),
        },
        otherManagement,
        randomBytes(32).toString("hex"),
        "workbench",
      );
    assert.ok(otherIdentity);
    if (repairActiveState) {
      assert.ok(repairCompletedState);
      const currentFile = path.join(
        root,
        ".crdd",
        "domain-model",
        "state.json",
      );
      assert.deepEqual(fs.readFileSync(currentFile), repairCompletedState);
      fs.writeFileSync(currentFile, repairActiveState);
      const refused = saveOperationStart(
        otherManagement,
        otherIdentity,
        () => null,
      );
      assert.equal(refused.status, "blocked");
      assert.equal(refused.startSaved, false);
      assert.equal(refused.snapshotConfirmed, false);
      assert.equal(refused.filesystemEffectIssued, false);
      assert.equal(refused.lockReleased, true);
      assert.deepEqual(fs.readFileSync(currentFile), repairActiveState);
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
      fs.writeFileSync(currentFile, repairCompletedState);
    }
    const otherStarted = saveOperationStart(
      otherManagement,
      otherIdentity,
      () => null,
    );
    assert.equal(otherStarted.status, "completed");
    assert.ok(otherStarted.recoveryId);
    if (repairHistory)
      assertRepairHistory(
        fs.readFileSync(
          path.join(root, ".crdd", "domain-model", "history.jsonl"),
        ),
      );
    if (repairCompletedState) {
      const prior = {
        snapshot: JSON.parse(
          Buffer.from(
            repairCompletedState ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
        payloadSha256: createHash("sha256")
          .update(repairCompletedState ?? assert.fail("missing_fixture_bytes"))
          .digest("hex"),
        sourceText: Buffer.from(
          repairCompletedState ?? assert.fail("missing_fixture_bytes"),
        ).toString("utf8"),
      };
      const next = readOperationStateStage(management).value;
      assert.ok(prior && next);
      assert.equal(next.snapshot.revision, prior.snapshot.revision + 1);
      assert.deepEqual(next.snapshot.previous, {
        revision: prior.snapshot.revision,
        payloadSha256: prior.payloadSha256,
      });
    }
    const otherBefore = readOperationStateStage(
      management,
    ).value?.snapshot.operations.find(
      (item) => item.recoveryId === otherStarted.recoveryId,
    );
    assert.ok(otherBefore);
    assert.equal(
      await hostRuntime.activateOwnedHostOperationGenerationLock(management),
      "activated",
    );
    const hostBefore = hostRuntime.borrowOwnedHostRecoverySnapshot(management);
    const observation = Object.freeze({});
    const proofs = new Map<
      object,
      {
        recoveryId: string;
        mount: Readonly<{ status: "completed" }>;
        activeMount: object;
        completionPlan: object;
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
    const effects = await import("../../src/execution/controller.ts");
    substitutions.push(
      mock.module(
        new URL("../../src/execution/authority.ts", import.meta.url).href,
        {
          namedExports: {
            ...homes,
            inspectRuntimeOwnedWindowsProviderHomeCandidate: (
              provider: unknown,
            ) => {
              assert.equal(provider, plan.provider);
              return {
                status: "candidate",
                observationCapability: observation,
              };
            },
            consumeRuntimeOwnedProviderHomeObservationCapability: (
              value: unknown,
            ) => (value === observation ? plan : null),
            verifyRuntimeOwnedProviderHomeMountCompletion: (
              value: unknown,
              owner: unknown,
              active: unknown,
              operationId: unknown,
              home: unknown,
            ) =>
              [...proofs.values()].some(
                (proof) =>
                  value === proof.mount &&
                  owner === management &&
                  active === proof.activeMount &&
                  operationId === plan.operationId &&
                  home === hash,
              ),
          },
        },
      ),
    );
    substitutions.push(
      mock.module(
        new URL("../../src/execution/provider-executor.ts", import.meta.url)
          .href,
        {
          namedExports: {
            ...controller,
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
              owner: unknown,
              recoveryId: unknown,
              request: { kind: string; value: unknown },
            ) => {
              if (request.kind === "resource")
                return ((
                  ...args: [owner: unknown, recoveryId: unknown, value: unknown]
                ) => {
                  lastResourceSave = actualStore.saveOperationCheckpoint(
                    args[0],
                    args[1],
                    { kind: "resource", value: args[2] },
                  );
                  return lastResourceSave;
                })(owner, recoveryId, request.value);
              return actualStore.saveOperationCheckpoint(
                owner,
                recoveryId,
                request as Parameters<
                  typeof actualStore.saveOperationCheckpoint
                >[2],
              );
            },
          },
        },
      ),
    );
    // Module全体を再評価して現在の依存閉包へ接続する。宣言本文と手書きimportを組み立てない。
    const actualHostSubmission = await import(
      new URL(
        "../../src/execution/controller.ts?normal-owner-host-" +
          repeatCount +
          "-" +
          retained,
        import.meta.url,
      ).href
    );
    substitutions.push(
      mock.module(
        new URL("../../src/execution/controller.ts", import.meta.url).href,
        { namedExports: { ...effects, ...actualHostSubmission } },
      ),
    );
    // 開始と終端準備を接続する保存Ownerを同じ代役観測と実Writerで再評価する。
    const actualPersistence = await import(
      new URL(
        `../../src/execution/persistence.ts?normal-owner-physical-${repeatCount}-${retained}`,
        import.meta.url,
      ).href
    );
    substitutions.push(
      mock.module(
        new URL("../../src/execution/persistence.ts", import.meta.url).href,
        { namedExports: { ...actualPersistence } },
      ),
    );
    ownerRuntime = await import(
      new URL(
        `../../src/execution/recovery.ts?normal-owner-physical-${repeatCount}-${retained}`,
        import.meta.url,
      ).href
    );
    assert.ok(ownerRuntime);
    const statePath = path.join(root, ".crdd", "domain-model", "state.json");
    const completedOperations = new Map<string, unknown>();
    const nonces = new Set<string>();
    for (let round = 0; round < repeatCount; round++) {
      const beforeBegin = JSON.parse(fs.readFileSync(statePath, "utf8"));
      assert.equal(
        hostRuntime.borrowOwnedHostRecoverySnapshot(management).snapshot.token,
        hostBefore.snapshot.token,
      );
      const begun: ReturnType<
        typeof baseOwner.beginRuntimeOwnedDockerRecovery
      > = ownerRuntime.beginRuntimeOwnedDockerRecovery(plan, management);
      assert.ok(begun && begun.status === "ready", JSON.stringify(begun));
      assertRetainedArtifact();
      if (repairHistory)
        assertRepairHistory(
          fs.readFileSync(
            path.join(root, ".crdd", "domain-model", "history.jsonl"),
          ),
        );
      const capability: object = begun.recoveryCapability;
      const recoveryId: string = begun.recoveryId;
      pendingCapabilities.add(capability);
      assert.ok(
        ![...proofs.values()].some((proof) => proof.recoveryId === recoveryId),
      );
      const activeMount = Object.freeze({});
      const proof: NonNullable<ReturnType<typeof proofs.get>> = {
        recoveryId,
        mount: Object.freeze({ status: "completed" as const }),
        activeMount,
        completionPlan: Object.freeze({
          ...plan,
          activeMountCapability: activeMount,
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
        providerHomesDirectoryCandidate(),
      );
      assert.equal(executorHome.status, "acquired");
      if (executorHome.status !== "acquired")
        throw new Error("fixture_home_lock_unavailable");
      fixtureHomeLease = executorHome.lock;
      const competingHome = locks.acquireProviderHomeLock(
        hash,
        providerHomesDirectoryCandidate(),
      );
      if (competingHome.status === "acquired")
        assert.equal(competingHome.lock.release(), true);
      assert.equal(competingHome.status, "blocked");
      const startedHost =
        hostRuntime.borrowOwnedHostRecoverySnapshot(management);
      assert.equal(
        startedHost.snapshot.record.state,
        "docker_submission_started",
      );
      assert.notEqual(startedHost.snapshot.token, hostBefore.snapshot.token);
      assert.equal(startedHost.hostPaths.root, owned.root);
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
        ownerRuntime.markRuntimeOwnedDockerResourceSubmission(
          capability,
          "create_subscription_auth_probe",
          resourceFrame,
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
          ownerRuntime.recordRuntimeOwnedDockerResourceNotIssued(
            capability,
            resource.key,
          ),
          resource.key === "create_subscription_auth_probe",
        );
      const beforeComplete = fs.readFileSync(statePath);
      assert.equal(
        ownerRuntime.verifyRuntimeOwnedDockerHomeLeaseRelease(
          capability,
          management,
          plan.operationId,
          recoveryId,
        ),
        false,
      );
      assert.equal(
        ownerRuntime.finalizeRuntimeOwnedDockerRecovery(capability).status,
        "blocked",
      );
      assert.equal(
        ownerRuntime.completeRuntimeOwnedDockerRecovery(
          { ...capability },
          management,
          {
            plan: proof.completionPlan,
            mountCompletion: proof.mount,
          },
        ).status,
        "blocked",
      );
      assert.equal(
        ownerRuntime.recordRuntimeOwnedNormalMountCompletion(
          capability,
          proof.mount,
        ),
        true,
      );
      if (round > 0) {
        const previousProof = [...proofs.values()][0];
        assert.ok(previousProof);
        assert.equal(
          ownerRuntime.completeRuntimeOwnedDockerRecovery(
            capability,
            management,
            {
              plan: previousProof.completionPlan,
              mountCompletion: proof.mount,
            },
          ).status,
          "blocked",
        );
      }
      assert.deepEqual(fs.readFileSync(statePath), beforeComplete);
      assert.ok(fixtureHomeLease);
      const homeLeaseReleased = fixtureHomeLease.release();
      assert.equal(homeLeaseReleased, true);
      fixtureHomeLease = null;
      const completed = ownerRuntime.recordRuntimeOwnedAttemptCleanup({
        plan: proof.completionPlan as RecoveryPlan,
        recoveryCapability: capability,
        managementCapability: management,
        recoveryId,
        resourceSnapshot,
        observations: resources,
        mountCompletion: proof.mount,
        mountLeaseReleased: true,
        homeLeaseReleased,
      });
      assert.equal(
        completed.recoveryCompleted,
        true,
        JSON.stringify(completed),
      );
      assert.equal(
        ownerRuntime.verifyRuntimeOwnedDockerHomeLeaseRelease(
          capability,
          management,
          plan.operationId,
          recoveryId,
        ),
        true,
      );
      assert.equal(
        ownerRuntime.verifyRuntimeOwnedDockerHomeLeaseRelease(
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
          ownerRuntime.verifyRuntimeOwnedDockerHomeLeaseRelease(
            capability,
            proofOwner,
            proofOperation,
            proofRecovery,
          ),
          false,
        );
        assert.deepEqual(fs.readFileSync(statePath), releaseProofState);
        assert.equal(
          ownerRuntime.verifyRuntimeOwnedDockerHomeLeaseRelease(
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
        providerHomesDirectoryCandidate(),
      );
      assert.ok(reacquiredAcquisition.status === "acquired");
      const reacquired = reacquiredAcquisition.lock;
      assert.ok(reacquired);
      assert.equal(reacquired.release(), true);
      const completedHost =
        hostRuntime.borrowOwnedHostRecoverySnapshot(management);
      assert.equal(completedHost.snapshot.record.state, "host_only");
      assert.equal(completedHost.snapshot.token, hostBefore.snapshot.token);
      const afterComplete = JSON.parse(fs.readFileSync(statePath, "utf8"));
      const completedOperation = afterComplete.operations.find(
        (item: { recoveryId: string }) => item.recoveryId === recoveryId,
      );
      assert.equal(completedOperation.lease, "released");
      assert.equal(completedOperation.execution.ownerEffect, "disabled");
      const submissionBefore = fs.readFileSync(statePath);
      assert.equal(
        ownerRuntime.recordRuntimeOwnedDockerProviderSubmission(capability),
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
        ownerRuntime.finalizeRuntimeOwnedDockerRecovery(capability).status,
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
      assert.equal(
        ownerRuntime.prepareRuntimeOwnedDockerHostCleanup(capability),
        hostBefore.snapshot.token,
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
      await hostRuntime.cleanupOwnedOperationDirectoriesAsync(owned);
    assert.equal(verifyHostCleanup(cleanupResult), "completed");
    hostCleaned = true;
    if (repairHistory)
      assertRepairHistory(
        fs.readFileSync(
          path.join(root, ".crdd", "domain-model", "history.jsonl"),
        ),
      );
    assert.equal(fs.existsSync(owned.root), false);
    assert.equal(fs.existsSync(hostBefore.hostPaths.marker), false);
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
        mountLeaseReleased: true,
        homeLeaseReleased: true,
        recoveryCompleted: true,
      });
      ownerRuntime.recordRuntimeOwnedDockerTerminalObservation(
        capability,
        proof.dockerResult,
        terminalObservation,
      );
      const terminalOwner = ownerRuntime;
      assert.doesNotThrow(() =>
        terminalOwner.recordRuntimeOwnedDockerTerminalObservation(
          capability,
          proof.dockerResult,
          terminalObservation,
        ),
      );
      assert.throws(
        () =>
          terminalOwner.recordRuntimeOwnedDockerTerminalObservation(
            capability,
            proof.dockerResult,
            { ...terminalObservation, homeLeaseReleased: false },
          ),
        /executor_terminal_delivery_mismatch/,
      );
      const beforeReceipt = fs.readFileSync(statePath);
      const before = JSON.parse(beforeReceipt.toString("utf8"));
      assert.equal(
        ownerRuntime.recordRuntimeOwnedDockerHostCleanupReceipt(capability, {
          hostCleanupOutcome: { ...cleanupResult },
          dockerCompletion: proof.dockerResult,
        }),
        false,
      );
      if (repeatCount > 1) {
        const otherProof = [...proofs.values()].find((item) => item !== proof);
        assert.ok(otherProof);
        assert.equal(
          ownerRuntime.recordRuntimeOwnedDockerHostCleanupReceipt(capability, {
            hostCleanupOutcome: cleanupResult,
            dockerCompletion: otherProof.dockerResult,
          }),
          false,
        );
      }
      assert.deepEqual(fs.readFileSync(statePath), beforeReceipt);
      const receiptStartedAt = Date.now();
      const recorded = ownerRuntime.recordRuntimeOwnedDockerHostCleanupReceipt(
        capability,
        {
          hostCleanupOutcome: cleanupResult,
          dockerCompletion: proof.dockerResult,
        },
      );
      stageTimings.push({
        stage: "receipt",
        startedAt: receiptStartedAt,
        completedAt: Date.now(),
      });
      assert.equal(recorded, true);
      // 本番Controllerと同じ、成功receiptの排他解放後だけI/Oへ返す。
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(
        ownerRuntime.verifyRuntimeOwnedDockerHomeLeaseRelease(
          capability,
          management,
          plan.operationId,
          proof.recoveryId,
        ),
        true,
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
        ownerRuntime.finalizeRuntimeOwnedDockerRecovery(capability);
      stageTimings.push({
        stage: "finalize",
        startedAt,
        completedAt: Date.now(),
      });
      assert.equal(finalized.status, "completed", JSON.stringify(finalized));
      assert.deepEqual(fs.readFileSync(statePath), afterReceipts);
      assert.deepEqual(
        fs.readFileSync(path.join(path.dirname(statePath), "history.jsonl")),
        historyAfterReceipts,
      );
      assert.equal(
        ownerRuntime.finalizeRuntimeOwnedDockerRecovery({ ...capability })
          .status,
        "blocked",
      );
      assert.equal(
        ownerRuntime.finalizeRuntimeOwnedDockerRecovery(capability).status,
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
    assert.deepEqual(final.operations, [otherBefore]);
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
                  ownerRuntime.abandonRuntimeOwnedDockerRecovery(capability) ===
                    true && released;
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
              await hostRuntime.cleanupOwnedOperationDirectoriesAsync(owned);
            assert.equal(
              hostRuntime.verifyOwnedOperationCleanupOutcome(outcome, owned),
              "completed",
            );
          }
        },
        async () => {
          if (otherOwned) {
            const outcome =
              await hostRuntime.cleanupOwnedOperationDirectoriesAsync(
                otherOwned,
              );
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
        createDockerProcessEnvironment(getIsolationSettings()),
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

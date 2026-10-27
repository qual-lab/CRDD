/**
 * 修復の保存結果と技術結果の相関を実Sourceで反証する。
 * @packageDocumentation
 * @responsibility 実DI Runtime／Machineと純粋保存モデルをつなぎ、OS I/Oは別Host試験と区別する。
 * @trace ERB-IT-014
 * @trace ERB-IT-002
 * @level IT
 * @scope メモリ境界。保存故障・終了・回収Caller。実Docker・Native・Provider・Filesystem書込み0。
 * @boundary 修復呼出し→保存モデル／DI終了結果。
 */
import type { CoordinatorStateRepairOperation } from "../../../domain-model/src/index.ts";
import { encodeRuntimeStateValue } from "../../../domain-model/src/index.ts";
import assert from "node:assert/strict";
import { sourceDeclaration } from "../support/source-declaration.ts";
import fs from "node:fs";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { runInThisContext } from "node:vm";
import test from "node:test";
import type { repairRuntimeOwnedDockerRuntime } from "../../src/execution/recovery.ts";
import { runDockerRuntimeRepairSessionUsing } from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import {
  dockerRuntimeRepairCheckpointIsSettled,
  dockerRuntimeRepairDisposalIsSettled,
  type DockerRuntimeRepairDisposalInput,
} from "../../../docker-isolation/src/index.ts";
import * as model from "../../src/storage/state.ts";
import * as historyValues from "../../../domain-model/src/index.ts";
import * as stateValues from "../../src/state/validation.ts";
import { renderDockerRecoveryDoctorReport } from "../../src/cli/recovery-report.ts";

/**
 * 実呼出しSourceを固定したメモリ保存境界へ組み立てる。
 * @responsibility 保存分類の反証を実Windows I/Oの再試行から分離する。
 * @trace ERB-IT-014
 * @precondition Sourceは読取りのみ、実DIと保存modelを差替えない。
 * @stimulus 保存・Native終了・取消の局所故障を指定する。
 * @observation 確認済み本文、全保存候補、実Machine結果。
 * @oracle 実modelの遷移条件と元版全文一致を毎保存で確認する。
 * @cleanup N/A: メモリだけ。
 * @boundary 物理Writerの肯定証明は別Host試験。
 */
function fixture(transform: (source: string) => string = (source) => source) {
  type Input = Parameters<typeof runDockerRuntimeRepairSessionUsing>[0];
  const root = Object.freeze({});
  const binding = "a".repeat(64);
  const controller = new AbortController();
  const state = {
    alive: true,
    mode: "ready" as
      | "ready"
      | "incomplete"
      | "retained"
      | "cancel"
      | "helper_then_cancel"
      | "cancel_then_helper"
      | "effect_unknown",
    close: "clean" as
      | "clean"
      | "cancel"
      | "helper"
      | "unknown"
      | "protocol"
      | "cancel_unknown"
      | "cancel_protocol",
    fault: "none" as "none" | "cleanup" | "outcome",
    faultKind: "reject" as "reject" | "confirmation" | "release" | "throw",
    faultHits: 0,
    bytes: null as Buffer | null,
    calls: 0,
    joined: 0,
    effects: 0,
    observed: 0,
    observationCleanupUnknown: false,
    faultsAt: 0,
    lossAt: "none" as "none" | "prepared" | "effect",
    losses: 0,
    writesAtLoss: 0,
    bytesAtLoss: null as Buffer | null,
    entries: 0,
    acquired: 0,
    readerReleased: true,
    readers: 0,
    markers: 0,
    markerFaultAt: 0,
    publications: 0,
    publicationCompleted: false,
    publicationFault: "none" as
      | "none"
      | "status"
      | "snapshot"
      | "release"
      | "throw"
      | "owner",
    markerFault: "none" as
      | "none"
      | "status"
      | "storage"
      | "absence"
      | "release"
      | "throw"
      | "owner",
    cancelAfterWrite: false,
    historyBytes: Buffer.alloc(0) as Buffer,
    historyReads: 0,
    historyWrites: 0,
    historyAt: "2026-10-16T00:00:00.000Z",
    historyReadFaultAt: 0,
    historyReadFault: "reject" as "reject" | "release" | "throw" | "owner",
    historyFaultAt: 0,
    historyFault: "reject" as
      | "reject"
      | "release"
      | "throw"
      | "owner"
      | "after_effect",
    completionReads: 0,
    completionWrites: 0,
    retentionReads: 0,
    retentionObservationFails: false,
    completionDeadlineFault: "none" as "none" | "before" | "fresh",
    dateReads: 0,
    // 既存の保持試験は、回収判断の保存拒否で判断待ちを意図的に残す。
    pauseBeforeDisposal: true,
    disposalCalls: [] as string[],
    disposalBlockedPurpose: null as string | null,
    disposalProgressRefused: false,
    completionBefore: null as Buffer | null,
    completionReadFaultAt: 0,
    completionReadFault: "reject" as "reject" | "release" | "throw" | "owner",
    completionFault: "none" as
      | "none"
      | "reject"
      | "release"
      | "throw"
      | "owner"
      | "after_effect",
  };
  const saved: Buffer[] = [];
  let failure: (() => void) | null = null;
  let late: Input["onCheckpoint"] | null = null;
  /**
   * 専用Readerの値分類を実モデルから構成する。
   * @responsibility 履歴未開始と出版対象・拒否を区別する。
   * @trace ERB-IT-014
   * @precondition メモリ上の最新Snapshotと履歴。
   * @stimulus exact参照、読取り故障とOwner失効。
   * @observation 候補・段階・排他確認。
   * @oracle 壊れた履歴を技術状態へ補完しない。
   * @cleanup N/A: メモリだけ。
   * @boundary 実モデルと模擬I/O。
   */
  const readHistory = (_root: unknown, id: unknown) => {
    state.historyReads++;
    const refused = {
      status: "blocked",
      lockReleased: true,
      value: null,
      currentHistoryPublication: null,
      repairHistoryState: null,
    };
    if (state.historyReads === state.historyReadFaultAt) {
      if (state.historyReadFault === "throw")
        throw new Error("history_read_fault");
      if (state.historyReadFault === "owner") state.alive = false;
      return { ...refused, lockReleased: state.historyReadFault !== "release" };
    }
    const value = model.decodeCoordinatorStateSnapshot(state.bytes, binding);
    const operation = value?.snapshot.operations.find(
      (item) => item.kind === "runtime_repair" && item.recoveryId === id,
    );
    if (operation?.kind !== "runtime_repair") return refused;
    const rows = historyValues.decodeCoordinatorHistoryRows(state.historyBytes);
    if (
      _root !== root ||
      typeof id !== "string" ||
      !value ||
      !operation ||
      !rows
    )
      return refused;
    const before = Buffer.from(`${encodeRuntimeStateValue(value.snapshot)}\n`);
    if (
      operation.phase === "awaiting_disposition" ||
      !model.prepareCoordinatorRepairHistorySummary(before, id, binding)
    ) {
      return ((operation.phase === "repairing" && operation.outcome === null) ||
        (operation.outcome?.status === "recovered" &&
          operation.primaryFailure === null &&
          ((operation.phase === "awaiting_disposition" &&
            operation.disposition === "pending_human_decision" &&
            operation.disposal === null) ||
            (operation.phase === "settling" &&
              operation.disposition === "discard" &&
              operation.disposal !== null)))) &&
        operation.summarySha256 === null &&
        operation.history === null &&
        !rows.some((row) => row.recoveryId === id)
        ? {
            ...refused,
            status: "completed",
            value,
            repairHistoryState: "technical_state",
          }
        : refused;
    }
    const stage =
      operation.history === null
        ? "checkpoint"
        : operation.history.confirmed
          ? "confirmed"
          : "publish";
    const candidate =
      stage === "checkpoint"
        ? model.prepareCoordinatorRepairHistorySnapshot(
            before,
            id,
            operation.kind === "runtime_repair"
              ? (operation.retention?.decidedAt ?? state.historyAt)
              : state.historyAt,
            false,
            binding,
          )
        : stage === "publish"
          ? model.prepareCoordinatorRepairHistoryPublication(
              before,
              id,
              state.historyBytes,
              null,
              30,
              binding,
            )?.snapshotBytes
          : before;
    if (!candidate) return refused;
    return {
      status: "completed",
      lockReleased: state.readerReleased,
      value,
      repairHistoryState: "publication",
      currentHistoryPublication: {
        before,
        candidate,
        stage,
        needsWrite: stage !== "confirmed",
      },
    };
  };
  /**
   * 実モデルの一段保存を模擬し、履歴保存と技術結果を分離する。
   * @responsibility checkpoint／出版候補と故障時の既発生事実を保持する。
   * @trace ERB-IT-014
   * @precondition 現在Ownerとexact操作IDが一致する。
   * @stimulus 各段の拒否・発行後失敗・解放不明・例外。
   * @observation 次Snapshot、履歴行、保存件数。
   * @oracle 時刻と両Hashを実モデルから導出する。
   * @cleanup N/A: メモリだけ。
   * @boundary 実モデルと模擬Writer。
   */
  const advanceHistory = (
    repository: { operationId: string },
    id: string,
    owner: () => boolean,
  ) => {
    state.historyWrites++;
    assert.equal(owner(), true);
    const value = model.decodeCoordinatorStateSnapshot(state.bytes, binding);
    const operation = value?.snapshot.operations.find(
      (item) => item.kind === "runtime_repair" && item.recoveryId === id,
    );
    assert.ok(value && operation);
    assert.equal(
      JSON.parse(operation.identityJson).operationId,
      repository.operationId,
    );
    const before = Buffer.from(`${encodeRuntimeStateValue(value.snapshot)}\n`);
    const publication =
      operation.history === null
        ? null
        : model.prepareCoordinatorRepairHistoryPublication(
            before,
            id,
            state.historyBytes,
            null,
            30,
            binding,
          );
    const candidate =
      operation.history === null
        ? model.prepareCoordinatorRepairHistorySnapshot(
            before,
            id,
            operation.kind === "runtime_repair"
              ? (operation.retention?.decidedAt ?? state.historyAt)
              : state.historyAt,
            false,
            binding,
          )
        : publication?.snapshotBytes;
    assert.ok(candidate);
    const fault = state.historyWrites === state.historyFaultAt;
    if (fault && state.historyFault === "throw")
      throw new Error("history_write_fault");
    if (fault && state.historyFault === "owner") state.alive = false;
    const effect =
      !fault ||
      state.historyFault === "release" ||
      state.historyFault === "after_effect";
    if (effect) {
      state.bytes = Buffer.from(candidate);
      if (publication)
        state.historyBytes = Buffer.from(publication.historyBytes);
    }
    return {
      status: fault ? "blocked" : "completed",
      snapshotConfirmed: !fault || state.historyFault === "release",
      lockReleased: !fault || state.historyFault !== "release",
      filesystemEffectIssued: effect,
      historyConfirmed: !fault && publication !== null,
    };
  };
  const source = sourceDeclaration(
    fs.readFileSync(
      new URL("../../src/execution/recovery.ts", import.meta.url),
      "utf8",
    ),
    "repairRuntimeOwnedDockerRuntime",
  );
  const body = transform(source);
  /**
   * 終了候補と除去済み観測を実モデルで模擬する。
   * @responsibility 空操作集合だけから完了を推定しない。
   * @trace ERB-IT-014
   * @precondition 同じメモリRootとexact履歴。
   * @stimulus Reader故障、対象あり／除去済み。
   * @observation 実候補と正規履歴行。
   * @oracle 対象履歴欠測はblocked。
   * @cleanup N/A: メモリのみ。
   * @boundary 実モデルと模擬I/O。
   */
  const readCompletion = (_root: unknown, id: string) => {
    state.completionReads++;
    const refused = {
      status: "blocked",
      lockReleased: true,
      value: null,
      currentCompletionPublication: null,
      repairCompletionAbsent: false,
      repairRetentionReviewAfter: null as string | null,
    };
    if (state.completionReads === state.completionReadFaultAt) {
      if (state.completionReadFault === "throw")
        throw new Error("completion_reader");
      if (state.completionReadFault === "owner") state.alive = false;
      return {
        ...refused,
        lockReleased: state.completionReadFault !== "release",
      };
    }
    const value = model.decodeCoordinatorStateSnapshot(state.bytes, binding);
    const rows = historyValues.decodeCoordinatorHistoryRows(state.historyBytes);
    const row = rows?.find((item) => item.recoveryId === id);
    if (_root !== root || !value || !row) return refused;
    const operation = value.snapshot.operations.find(
      (item) => item.recoveryId === id,
    );
    const deadline = "reviewAfter" in row ? (row.reviewAfter as string) : null;
    const returnedDeadline =
      deadline !== null &&
      state.completionDeadlineFault === (operation ? "before" : "fresh")
        ? new Date(Date.parse(deadline) + 1).toISOString()
        : deadline;
    if (!operation)
      return {
        ...refused,
        status: "completed",
        value,
        repairCompletionAbsent: true,
        repairRetentionReviewAfter: returnedDeadline,
      };
    const candidate = model.prepareCoordinatorStateRepairCompletionSnapshot(
      state.bytes,
      id,
      binding,
    );
    return candidate
      ? {
          ...refused,
          status: "completed",
          value,
          currentCompletionPublication: { before: state.bytes, candidate },
          repairRetentionReviewAfter: returnedDeadline,
        }
      : refused;
  };
  const run = runInThisContext(
    `(function(deps){ const {Date,createHash,randomBytes,randomUUID,observeRepositoryRuntimeDataArea,verifyRepositoryRoot,runDockerRuntimeRepairSession,dockerRuntimeRepairCheckpointIsSettled,borrowRuntimeOwnedCoordinatorRecoveryRepository,decodeCoordinatorStateSnapshot,encodeRuntimeStateValue,prepareCoordinatorStateRepairSnapshot,prepareCoordinatorStateRepairCheckpointSnapshot,prepareCoordinatorStateRepairSessionSnapshot,prepareCoordinatorStateRepairRetentionHandoffSnapshot,observeDockerRuntimeRepairRetention,prepareCoordinatorRepairHistorySummary,readRuntimeOwnedCoordinatorRepairHistorySnapshot,advanceRuntimeOwnedCoordinatorRepairHistory,readRuntimeOwnedCoordinatorRepairCompletionSnapshot,completeRuntimeOwnedCoordinatorRepair,resumeRuntimeOwnedCoordinatorRepairPublication,cleanupRuntimeOwnedCoordinatorStateMarker,readRuntimeOwnedCoordinatorRecoverySnapshot,writeRuntimeOwnedCoordinatorRepairSnapshot,prepareCoordinatorStateRepairDisposalDecisionSnapshot,prepareCoordinatorStateRepairDisposalProgressSnapshot,disposeDockerRuntimeRepairDirectory,dockerRuntimeRepairDisposalIsSettled}=deps; ${body}; return repairRuntimeOwnedDockerRuntime;})`,
  )({
    createHash,
    randomBytes,
    randomUUID,
    ...model,
    ...stateValues,
    encodeRuntimeStateValue,
    Date: class extends Date {
      constructor(value?: string | number) {
        super(value ?? state.historyAt);
        if (value === undefined) state.dateReads++;
      }
    },
    observeDockerRuntimeRepairRetention: (
      input: Parameters<
        typeof import("../../../docker-isolation/src/index.ts").observeDockerRuntimeRepairRetention
      >[0],
    ) => {
      state.retentionReads++;
      if (
        !input.canObserve() ||
        input.signal.aborted ||
        state.retentionObservationFails
      )
        return null;
      return {
        primary: input.checkpoint.directories.primary.retained.identity,
        failed: input.checkpoint.directories.failed.retained.identity,
        auxiliary: input.checkpoint.directories.auxiliary.retained.identity,
      };
    },
    dockerRuntimeRepairDisposalIsSettled,
    disposeDockerRuntimeRepairDirectory: async (
      input: DockerRuntimeRepairDisposalInput,
    ) => {
      state.disposalCalls.push(input.purpose);
      if (input.canIssueEffect() !== true)
        return { request: "not_issued", absence: "unknown" };
      return {
        request:
          input.checkpoint.directories[input.purpose].expected === null
            ? "not_issued"
            : "issued",
        absence:
          state.disposalBlockedPurpose === input.purpose
            ? "unknown"
            : "confirmed_absent",
      };
    },
    readRuntimeOwnedCoordinatorRepairHistorySnapshot: readHistory,
    advanceRuntimeOwnedCoordinatorRepairHistory: advanceHistory,
    readRuntimeOwnedCoordinatorRepairCompletionSnapshot: readCompletion,
    completeRuntimeOwnedCoordinatorRepair: (
      _root: unknown,
      id: string,
      owner: () => boolean,
    ) => {
      state.completionWrites++;
      assert.equal(owner(), true);
      const observed = readCompletion(_root, id);
      const candidate = observed.currentCompletionPublication?.candidate;
      assert.ok(candidate);
      state.completionBefore = Buffer.from(state.bytes as Buffer);
      const fault = state.completionFault;
      if (fault === "throw") throw new Error("completion_writer");
      if (fault === "owner") state.alive = false;
      const effect =
        fault === "none" || fault === "release" || fault === "after_effect";
      if (effect) state.bytes = candidate;
      return {
        status: fault === "none" ? "completed" : "blocked",
        snapshotConfirmed: fault === "none" || fault === "release",
        lockReleased: fault !== "release",
        filesystemEffectIssued: effect,
      };
    },
    dockerRuntimeRepairCheckpointIsSettled,
    borrowRuntimeOwnedCoordinatorRecoveryRepository: (value: unknown) =>
      value === root
        ? {
            repositoryRoot: "synthetic-root",
            repositoryBinding: binding,
            revalidate: () => state.alive,
          }
        : null,
    verifyRepositoryRoot: () => ({ status: "completed", capability: root }),
    observeRepositoryRuntimeDataArea: () => ({
      status: state.bytes ? "ready" : "not_observed",
    }),
    resumeRuntimeOwnedCoordinatorRepairPublication: () => {
      state.publications++;
      if (state.publicationFault === "throw")
        throw new Error("publication_fault");
      if (state.publicationFault === "owner") state.alive = false;
      return {
        status:
          state.publicationFault === "none"
            ? state.publicationCompleted
              ? "completed"
              : "no_pending"
            : state.publicationFault === "status"
              ? "blocked"
              : "completed",
        lockReleased: state.publicationFault !== "release",
        snapshotConfirmed: state.publicationFault !== "snapshot",
        filesystemEffectIssued: state.publicationFault !== "none",
      };
    },
    cleanupRuntimeOwnedCoordinatorStateMarker: () => {
      state.markers++;
      const fault =
        state.markerFaultAt === 0 || state.markers === state.markerFaultAt
          ? state.markerFault
          : "none";
      if (fault === "throw") throw new Error("marker_fault");
      if (fault === "owner") state.alive = false;
      return {
        status: fault === "status" ? "blocked" : "completed",
        storageConfirmed: fault !== "storage",
        markerAbsentConfirmed: fault !== "absence",
        lockReleased: fault !== "release",
        filesystemEffectIssued: fault !== "none",
        markerRemoved: fault !== "none",
      };
    },
    readRuntimeOwnedCoordinatorRecoverySnapshot: () => {
      state.readers++;
      return {
        status: "completed",
        lockReleased: state.readerReleased,
        value: model.decodeCoordinatorStateSnapshot(state.bytes, binding),
      };
    },
    writeRuntimeOwnedCoordinatorRepairSnapshot: (
      _root: unknown,
      id: string,
      before: Buffer | null,
      candidate: Buffer,
      owner: () => unknown,
      purpose: string,
    ) => {
      state.calls++;
      if (purpose === "disposal_decision" && state.pauseBeforeDisposal)
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: true,
        };
      const decoded = model.decodeCoordinatorStateSnapshot(candidate, binding);
      assert.ok(decoded);
      assert.equal(owner(), true);
      assert.equal(
        state.bytes === null ? before === null : before?.equals(state.bytes),
        true,
      );
      assert.ok(
        purpose === "session_begin"
          ? model.validateCoordinatorStateRepairSessionTransition(
              before,
              candidate,
              id,
              binding,
            )
          : purpose === "retention_handoff"
            ? model.validateCoordinatorStateRepairRetentionHandoffTransition(
                before,
                candidate,
                id,
                binding,
              )
            : purpose.startsWith("disposal_")
              ? model.validateCoordinatorStateRepairDisposalTransition(
                  before,
                  candidate,
                  id,
                  purpose === "disposal_decision"
                    ? "decision"
                    : purpose.slice("disposal_".length),
                  binding,
                )
              : model.validateCoordinatorStateTransition(
                  before,
                  candidate,
                  binding,
                ),
      );
      const target = decoded.snapshot.operations.find(
        (value) => value.recoveryId === id,
      );
      assert.equal(target?.kind, "runtime_repair");
      if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
      if (
        purpose === "disposal_primary" &&
        state.disposalProgressRefused &&
        target.disposal?.checkpoint.directories.primary.absence ===
          "confirmed_absent"
      ) {
        state.disposalProgressRefused = false;
        return {
          status: "blocked",
          snapshotConfirmed: false,
          lockReleased: true,
        };
      }
      const match =
        state.fault === "cleanup"
          ? target.checkpoint?.cleanup === "confirmed" &&
            target.outcome === null
          : state.fault === "outcome"
            ? target.outcome !== null
            : false;
      if (match && state.faultHits === 0) {
        state.faultHits++;
        state.faultsAt = state.calls;
        if (state.faultKind === "throw")
          throw new Error("synthetic_writer_failure");
        return {
          status: state.faultKind === "reject" ? "blocked" : "completed",
          snapshotConfirmed: state.faultKind === "release",
          lockReleased: state.faultKind !== "release",
        };
      }
      state.bytes = Buffer.from(candidate);
      saved.push(Buffer.from(candidate));
      if (state.cancelAfterWrite) controller.abort();
      if (state.lossAt === "prepared" && state.calls === 2) {
        state.alive = false;
        state.losses++;
        state.writesAtLoss = state.calls;
        state.bytesAtLoss = Buffer.from(state.bytes);
      }
      return {
        status: "completed",
        snapshotConfirmed: true,
        lockReleased: true,
      };
    },
    runDockerRuntimeRepairSession: (input: Input) => {
      state.entries++;
      late = input.onCheckpoint;
      /**
       * Native Session終了時の通知・取消・回収結果を注入する。
       * @responsibility Native Session終了時の通知・取消・回収結果を注入する。
       * @trace ERB-IT-014
       * @precondition 固定modeと同じSession/controller。
       * @stimulus joinedを増やし選択modeの失敗通知とcleanup/protocolを返す。
       * @observation close回数、一次失敗とcleanup分類。
       * @oracle 後着取消や回収不明が元失敗を消さない。
       * @cleanup 親fixtureが同じSessionの一回joinと購読解除を確認する。
       * @boundary Session終了代役。実Native/Processは生成しない。
       */
      const close = async () => {
        state.joined++;
        if (state.close.startsWith("cancel")) controller.abort();
        if (state.close === "helper") failure?.();
        return {
          cleanup:
            state.close === "unknown" || state.close === "cancel_unknown"
              ? ("unknown" as const)
              : ("confirmed" as const),
          protocol:
            state.close === "protocol" || state.close === "cancel_protocol"
              ? ("failed" as const)
              : ("completed" as const),
        };
      };
      return runDockerRuntimeRepairSessionUsing(input, {
        acquire: async () => {
          state.acquired++;
          return {
            status: "acquired",
            ownerBindingSha256: "b".repeat(64),
            session: {
              assertLive: () => true,
              failureDetected: new Promise(() => {}),
              onFailureDetected: (callback) => {
                failure = callback;
                return () => {
                  failure = null;
                };
              },
              verifyArtifacts: async () => "verified",
              inspectProcesses: async () => "verified",
              terminateProcesses: async () => {
                throw new Error("unexpected_effect");
              },
              launchDesktop: async () => {
                throw new Error("unexpected_effect");
              },
              release: close,
              abort: close,
            },
          };
        },
        prepare: async () => ({
          scopeSha256: "c".repeat(64),
          cleanupFailure: () =>
            state.observationCleanupUnknown && state.observed > 0
              ? "observation_cleanup_unknown"
              : null,
          technical: {
            observe: async (checkpoint) => {
              state.observed++;
              if (state.mode === "incomplete")
                throw new Error("synthetic_observation_unknown");
              const id = { dev: "1", ino: "1", birthtimeNs: "3" };
              return {
                ...checkpoint,
                directories: Object.fromEntries(
                  Object.entries(checkpoint.directories).map(([key, pair]) => [
                    key,
                    state.mode === "retained" && key === "primary"
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
                  state.mode === "retained" &&
                  checkpoint.actions.retain_runtime.result !== "confirmed"
                    ? "unavailable"
                    : "ready",
                hostSafety: "safe",
                stale:
                  state.mode === "retained" &&
                  checkpoint.actions.retain_runtime.result === "confirmed"
                    ? "retained"
                    : "absent",
              };
            },
            precondition: async (action) =>
              (
                state.mode === "retained"
                  ? action === "retain_runtime"
                  : action === "stop_runtime" &&
                    !["ready", "incomplete"].includes(state.mode)
              )
                ? "proceed"
                : "not_required",
            execute: async (_action, checkpoint) => {
              state.effects++;
              if (state.lossAt === "effect") {
                state.alive = false;
                state.losses++;
                state.writesAtLoss = state.calls;
                state.bytesAtLoss =
                  state.bytes === null ? null : Buffer.from(state.bytes);
              }
              if (state.mode === "retained")
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
              if (state.mode === "helper_then_cancel") {
                failure?.();
                controller.abort();
              }
              if (state.mode === "cancel_then_helper") {
                controller.abort();
                failure?.();
              }
              if (state.mode === "cancel") controller.abort();
              return state.mode === "effect_unknown"
                ? {
                    issued: null,
                    confirmation: "unknown",
                    observation: checkpoint,
                  }
                : {
                    issued: true,
                    confirmation: "confirmed",
                    observation: checkpoint,
                  };
            },
            awaitEngine: async () => ({ state: "ready", continuation: null }),
          },
        }),
      });
    },
  }) as typeof repairRuntimeOwnedDockerRuntime;
  return {
    state,
    saved,
    controller,
    run: (id: string | null = null, purpose: "repair" | "retain" = "repair") =>
      run(root, controller.signal, id, purpose),
    late: () => late,
    snapshot: () =>
      model.decodeCoordinatorStateSnapshot(state.bytes, binding)?.snapshot,
  };
}

/**
 * 回収意図・部分結果・再入場を実modelの専用遷移へ接続する。
 * @responsibility 新Sessionを取得せず同IDの回収後に既存履歴を一度だけ確定する。
 * @trace ERB-IT-014
 * @trace ERB-IT-002
 * @precondition 実Caller・実model、WriterとDIはメモリ代役。
 * @stimulus 三用途成功、primary不明、処置後保存拒否からの再入場。
 * @observation 全DI用途列、元checkpoint／outcome、保存された要求履歴と不存在。
 * @oracle 不明で後続0、再入場はunknownを保全、全用途後だけ履歴と終了を確定する。
 * @cleanup N/A: 実Filesystem・Native・Docker要求0。
 * @boundary ERB-IT-014／ERB-IT-002=Direct Boundary: Caller→専用model／模擬Writer／模擬DI。
 */
test("修復回収接続: 三用途と保存失敗後の要求不明を同IDで保持する", async () => {
  const binding = "a".repeat(64);
  for (const failure of ["none", "unknown", "save"] as const) {
    const f = fixture();
    f.state.mode = "retained";
    f.state.pauseBeforeDisposal = false;
    if (failure === "unknown") f.state.disposalBlockedPurpose = "primary";
    if (failure === "save") f.state.disposalProgressRefused = true;
    const first = await f.run();
    assert.ok(first.recoveryId);
    assert.equal(first.status, failure === "none" ? "observed" : "blocked");
    const original =
      f.snapshot()?.operations[0] ??
      model.decodeCoordinatorStateSnapshot(f.state.completionBefore, binding)
        ?.snapshot.operations[0];
    assert.ok(original?.kind === "runtime_repair" && original.disposal);
    assert.equal(original.disposition, "discard");
    assert.equal(original.phase, "settling");
    assert.equal(first.completionConfirmed, failure === "none");
    assert.equal(f.state.historyWrites, failure === "none" ? 2 : 0);
    assert.equal(f.state.completionWrites, failure === "none" ? 1 : 0);
    assert.deepEqual(
      f.state.disposalCalls,
      failure === "none" ? ["primary", "failed", "auxiliary"] : ["primary"],
    );
    const before = {
      checkpoint: original.checkpoint,
      outcome: original.outcome,
      primaryFailure: original.primaryFailure,
      identityJson: original.identityJson,
    };
    const entries = f.state.entries;
    f.state.disposalBlockedPurpose = null;
    const again = await f.run(first.recoveryId);
    assert.equal(again.status, "observed");
    assert.equal(f.state.entries, entries);
    const final = model.decodeCoordinatorStateSnapshot(
      f.state.completionBefore,
      binding,
    )?.snapshot.operations[0];
    assert.ok(final?.kind === "runtime_repair" && final.disposal);
    assert.deepEqual(
      {
        checkpoint: final.checkpoint,
        outcome: final.outcome,
        primaryFailure: final.primaryFailure,
        identityJson: final.identityJson,
      },
      before,
    );
    assert.equal(
      dockerRuntimeRepairDisposalIsSettled(final.disposal.checkpoint),
      true,
    );
    assert.equal(
      final.disposal.checkpoint.directories.primary.request,
      failure === "save" ? "unknown" : "issued",
    );
    assert.deepEqual(
      f.state.disposalCalls,
      failure === "none"
        ? ["primary", "failed", "auxiliary"]
        : ["primary", "primary", "failed", "auxiliary"],
    );
    assert.equal(f.state.historyWrites, 2);
    assert.equal(f.state.completionWrites, 1);
    assert.equal(f.snapshot()?.operations.length, 0);
    const rows = historyValues.decodeCoordinatorHistoryRows(
      f.state.historyBytes,
    );
    assert.equal(rows?.length, 1);
    assert.equal(
      JSON.parse(rows?.[0]?.line ?? "null").summary.disposal.checkpoint
        .directories.primary.request,
      failure === "save" ? "unknown" : "issued",
    );
  }
});

/**
 * 修復・保持・exact再入場を履歴確認へ接続する。
 * @responsibility 二段保存と各段後fresh確認を技術処置から分離する。
 * @trace ERB-IT-014
 * @precondition 実compositionと実モデル、I/Oはメモリ代替。
 * @stimulus 新規成功、明示保持、確認済み再入場、取消済みmetadata確定。
 * @observation 履歴Writer件数、結果相関、技術入口増分。
 * @oracle 最大二段、確認済み再入場のWriter0、同exact・技術再取得0。
 * @cleanup N/A: メモリだけ。
 * @boundary 本番compositionの処理順。
 */
test("修復履歴接続: 成功・保持・取消後のexact確定を分ける", async () => {
  for (const retained of [false, true]) {
    const f = fixture();
    f.state.mode = retained ? "retained" : "ready";
    const repaired = await f.run();
    assert.ok(repaired.recoveryId);
    const result = retained
      ? await f.run(repaired.recoveryId, "retain")
      : repaired;
    assert.equal(result.status, "observed");
    assert.equal(result.historyConfirmed, true);
    assert.equal(result.outcomeConfirmed, true);
    assert.equal(result.historyEffectIssued, true);
    assert.equal(f.state.historyWrites, 2);
    const entries = f.state.entries,
      calls = f.state.calls,
      writes = f.state.historyWrites;
    const duplicate = await f.run(repaired.recoveryId);
    assert.equal(duplicate.status, "observed");
    assert.equal(duplicate.historyConfirmed, true);
    assert.equal(duplicate.retentionConfirmed, retained);
    assert.equal(duplicate.historyEffectIssued, false);
    assert.equal(f.state.historyWrites, writes);
    assert.equal(f.state.entries, entries);
    assert.equal(f.state.calls, calls);
  }
  const f = fixture();
  const original = await f.run();
  assert.ok(original.recoveryId);
  f.state.bytes = Buffer.from(f.saved.at(-1) ?? []);
  f.state.historyBytes = Buffer.alloc(0);
  f.controller.abort();
  const entries = f.state.entries,
    calls = f.state.calls,
    writes = f.state.historyWrites;
  const resumed = await f.run(original.recoveryId);
  assert.equal(resumed.status, "observed");
  assert.equal(resumed.historyConfirmed, true);
  assert.equal(f.state.historyWrites, writes + 2);
  assert.equal(f.state.entries, entries);
  assert.equal(f.state.calls, calls);
});

/**
 * 失敗履歴の再入場を技術処置と成功終了から分離する。
 * @responsibility 一次理由・回収不明とexact IDを保存故障後も維持する。
 * @trace ERB-IT-014
 * @precondition 実DI Machineと実値モデル、保存I/Oだけメモリ代替。
 * @stimulus 取消・境界故障・作成不明、二段保存の各故障、Abort済み再入場。
 * @observation 同ID履歴、操作本文、Native取得・completion件数。
 * @oracle 失敗理由不変、失敗操作保持、再実行0、再入場後の重複出版0。
 * @cleanup N/A: メモリだけ。
 * @boundary compositionの履歴接続。実物保存はHost試験。
 */
test("修復失敗履歴接続: 失敗と取消を記録し技術再実行しない", async () => {
  for (const mode of [
    "cancel",
    "helper_then_cancel",
    "cancel_then_helper",
    "effect_unknown",
  ] as const)
    for (const close of ["clean", "unknown", "protocol"] as const) {
      const f = fixture();
      f.state.mode = mode;
      f.state.close = close;
      const first = await f.run();
      assert.ok(first.recoveryId);
      const operation = f.snapshot()?.operations[0];
      assert.ok(operation?.kind === "runtime_repair" && operation.outcome);
      assert.equal(first.reason, operation.outcome.reason);
      assert.equal(first.historyConfirmed, true, `${mode}:${close}`);
      assert.equal(
        first.nativeCleanupConfirmed,
        operation.checkpoint?.cleanup === "confirmed",
      );
      assert.equal(first.completionConfirmed, false);
      assert.equal(f.state.completionWrites, 0);
      const rows = historyValues.decodeCoordinatorHistoryRows(
        f.state.historyBytes,
      );
      assert.equal(rows?.length, 1);
      const counts = {
        entries: f.state.entries,
        effects: f.state.effects,
        acquired: f.state.acquired,
        history: f.state.historyWrites,
        writes: f.state.calls,
      };
      const original = Buffer.from(f.state.bytes as Buffer);
      f.controller.abort();
      const again = await f.run(first.recoveryId);
      assert.equal(again.status, "observed");
      assert.equal(again.reason, first.reason);
      assert.equal(again.historyConfirmed, true);
      assert.equal(again.completionConfirmed, false);
      assert.equal(again.nativeCleanupConfirmed, first.nativeCleanupConfirmed);
      assert.ok(f.state.bytes?.equals(original));
      assert.deepEqual(
        {
          entries: f.state.entries,
          effects: f.state.effects,
          acquired: f.state.acquired,
          history: f.state.historyWrites,
          writes: f.state.calls,
        },
        counts,
      );
    }
  for (const stage of [1, 2])
    for (const fault of [
      "reject",
      "release",
      "throw",
      "owner",
      "after_effect",
    ] as const) {
      const f = fixture();
      f.state.mode = "effect_unknown";
      f.state.close = "unknown";
      f.state.historyFaultAt = stage;
      f.state.historyFault = fault;
      const failed = await f.run();
      assert.equal(failed.status, "blocked");
      assert.equal(failed.reason, "runtime_repair_effect_unknown");
      assert.equal(failed.outcomeConfirmed, true);
      assert.equal(failed.historyConfirmed, false);
      assert.equal(failed.nativeCleanupConfirmed, false);
      assert.equal(failed.completionConfirmed, false);
      assert.equal(f.state.historyWrites, stage);
      assert.equal(f.state.completionWrites, 0);
      assert.ok(failed.recoveryId);
      const entries = f.state.entries;
      f.state.alive = true;
      f.state.historyFaultAt = 0;
      f.controller.abort();
      const resumed = await f.run(failed.recoveryId);
      assert.equal(resumed.reason, failed.reason);
      assert.equal(resumed.historyConfirmed, true);
      assert.equal(resumed.completionConfirmed, false);
      assert.equal(f.state.entries, entries);
    }
  const retained = fixture();
  retained.state.mode = "retained";
  retained.state.close = "helper";
  const pending = await retained.run();
  const operation = retained.snapshot()?.operations[0];
  assert.ok(operation?.kind === "runtime_repair");
  assert.equal(operation.outcome?.status, "blocked");
  assert.equal(operation.disposition, "pending_human_decision");
  assert.equal(pending.historyConfirmed, false);
  assert.equal(retained.state.historyWrites, 0);
});

/**
 * 個別Native回収と観測資源を含む集約回収を混同しない。
 * @responsibility 同呼出しの既知成功を保持し、freshでは詳細を補完しない。
 * @trace ERB-IT-014
 * @precondition 実Runtimeの観測回収不明とNative回収成功。
 * @stimulus 正規履歴投影と既知trueを上書きする変異。
 * @observation first／freshのNative確認、集約checkpoint、履歴と取得回数。
 * @oracle firstはNative true・集約unknown、freshはNative false・本文不変・再取得0。
 * @cleanup N/A: メモリだけ。
 * @boundary 個別生涯結果と履歴の有限投影。
 */
test("修復失敗履歴: 既知Native回収と集約不明を別に保持する", async () => {
  for (const mutant of [false, true]) {
    const f = fixture((source) => {
      if (!mutant) return source;
      const changed = source.replace(
        /nativeCleanupConfirmed =\s*nativeCleanupConfirmed \|\|\s*(operation\.checkpoint\?\.cleanup === "confirmed");/u,
        "nativeCleanupConfirmed = $1;",
      );
      assert.notEqual(changed, source);
      return changed;
    });
    f.state.observationCleanupUnknown = true;
    const first = await f.run();
    assert.ok(first.recoveryId);
    const operation = f.snapshot()?.operations[0];
    assert.ok(operation?.kind === "runtime_repair");
    assert.equal(operation.checkpoint?.cleanup, "unknown");
    assert.equal(
      operation.checkpoint?.cleanupFailure,
      "observation_cleanup_unknown",
    );
    assert.equal(first.historyConfirmed, true);
    assert.equal(first.completionConfirmed, false);
    /**
     * 同呼出しで観測したNative回収成功を返却値で確認する。
     * @responsibility 正規実装と上書き変異へ同じOracleを適用する。
     * @trace ERB-IT-014
     * @precondition 実Runtimeの返却と集約回収不明を確認済み。
     * @stimulus firstのNative確認field。
     * @observation 同じassertionの成功または拒否。
     * @oracle 集約unknownでも既知Native trueを維持する。
     * @cleanup N/A: 同期の値確認だけ。
     * @boundary 個別回収と集約回収の区別。
     */
    const checkKnown = () => assert.equal(first.nativeCleanupConfirmed, true);
    if (mutant) {
      assert.throws(checkKnown);
      continue;
    }
    checkKnown();
    const before = Buffer.from(f.state.bytes as Buffer);
    const entries = f.state.entries,
      acquired = f.state.acquired;
    f.controller.abort();
    const fresh = await f.run(first.recoveryId);
    assert.equal(fresh.reason, first.reason);
    assert.equal(fresh.nativeCleanupConfirmed, false);
    assert.equal(fresh.historyConfirmed, true);
    assert.equal(fresh.completionConfirmed, false);
    assert.ok(f.state.bytes?.equals(before));
    assert.equal(f.state.entries, entries);
    assert.equal(f.state.acquired, acquired);
  }
});

/**
 * 現在状態除去と除去後のfresh再確認を本番compositionへ接続する。
 * @responsibility 履歴からNativeや技術結果の詳細を復元しない。
 * @trace ERB-IT-014
 * @precondition 同じ実モデルを使う修復成功。
 * @stimulus 通常終了、取消済み同ID再入場、保持済み。
 * @observation 現在操作、終了確認、技術入口と保存回数。
 * @oracle 対象除去とexact履歴、再入場DI0、保持物除去0。
 * @cleanup N/A: メモリだけ。
 * @boundary 本番compositionと模擬保存I/O。
 */
test("修復終了接続: 終了保存と除去後再確認を技術再実行から分ける", async () => {
  const cancelled = fixture();
  cancelled.controller.abort();
  const refused = await cancelled.run();
  assert.equal(refused.status, "blocked");
  assert.equal(cancelled.state.entries, 0);
  assert.equal(cancelled.state.calls, 0);
  assert.equal(cancelled.state.effects, 0);
  const f = fixture();
  const result = await f.run();
  assert.ok(result.recoveryId);
  assert.equal(result.completionConfirmed, true);
  assert.equal(result.historyConfirmed, true);
  assert.equal(result.outcomeConfirmed, true);
  assert.equal(result.completionEffectIssued, true);
  assert.equal(f.snapshot()?.operations.length, 0);
  assert.equal(
    historyValues.decodeCoordinatorHistoryRows(f.state.historyBytes)?.length,
    1,
  );
  const counts = {
    entries: f.state.entries,
    calls: f.state.calls,
    writes: f.state.completionWrites,
    history: f.state.historyWrites,
  };
  f.controller.abort();
  const duplicate = await f.run(result.recoveryId);
  assert.equal(duplicate.status, "observed");
  assert.equal(duplicate.completionConfirmed, true);
  assert.equal(duplicate.historyConfirmed, true);
  assert.equal(duplicate.outcomeConfirmed, false);
  assert.equal(duplicate.nativeCleanupConfirmed, false);
  assert.equal(duplicate.finalCheckpointConfirmed, false);
  assert.equal(duplicate.completionEffectIssued, false);
  assert.deepEqual(
    {
      entries: f.state.entries,
      calls: f.state.calls,
      writes: f.state.completionWrites,
      history: f.state.historyWrites,
    },
    counts,
  );
  const retained = fixture();
  retained.state.mode = "retained";
  const first = await retained.run();
  assert.ok(first.recoveryId);
  const kept = await retained.run(first.recoveryId, "retain");
  assert.equal(kept.completionConfirmed, true);
  assert.equal(retained.state.completionWrites, 1);
  assert.equal(retained.snapshot()?.operations.length, 0);
});

/**
 * 終了Writerの失敗後に先行結果を保持し同IDだけで再入場する。
 * @responsibility 保存不明を技術再試行へ読み替えない。
 * @trace ERB-IT-014
 * @precondition outcomeと履歴は同呼出しで確認済み。
 * @stimulus 拒否・解放不明・例外・Owner喪失・発行後失敗。
 * @observation 各確認値とEffect、再入場のDI／履歴Writer増分。
 * @oracle 先行事実true、completion false、技術再取得0。
 * @cleanup N/A: メモリだけ。
 * @boundary 本番compositionの終了保存。
 */
test("修復終了接続: Writer不明でも先行事実を保持しmetadataだけ再開する", async () => {
  for (const fault of [
    "reject",
    "release",
    "throw",
    "owner",
    "after_effect",
  ] as const) {
    const f = fixture();
    f.state.completionFault = fault;
    const result = await f.run();
    assert.ok(result.recoveryId);
    assert.equal(result.status, "blocked", fault);
    assert.equal(result.outcomeConfirmed, true, fault);
    assert.equal(result.historyConfirmed, true, fault);
    assert.equal(result.completionConfirmed, false, fault);
    assert.equal(
      result.completionEffectIssued,
      fault === "throw" ? null : ["release", "after_effect"].includes(fault),
      fault,
    );
    const counts = {
      entries: f.state.entries,
      calls: f.state.calls,
      history: f.state.historyWrites,
    };
    f.state.alive = true;
    f.state.completionFault = "none";
    f.controller.abort();
    const resumed = await f.run(result.recoveryId);
    assert.equal(resumed.status, "observed", fault);
    assert.equal(resumed.completionConfirmed, true, fault);
    assert.deepEqual(
      {
        entries: f.state.entries,
        calls: f.state.calls,
        history: f.state.historyWrites,
      },
      counts,
    );
  }
});

/**
 * 終了Readerとmarker清掃の失敗を段階ごとに停止する。
 * @responsibility 解放不明と例外を既知の成功へ補完しない。
 * @trace ERB-IT-014
 * @precondition 同呼出しで履歴確認後の終了処理。
 * @stimulus 初回／除去後Readerと清掃の各共同field欠落。
 * @observation 終了確認、先行事実、後段保存／DI件数。
 * @oracle completion false、先行結果保持、失敗後fallback0。
 * @cleanup N/A: メモリだけ。
 * @boundary Reader／Writer／markerの個別lifecycle。
 */
test("修復終了接続: Readerと清掃の不明はsticky停止する", async () => {
  for (const stage of [1, 3])
    for (const fault of ["reject", "release", "throw", "owner"] as const) {
      const f = fixture();
      f.state.completionReadFaultAt = stage;
      f.state.completionReadFault = fault;
      const result = await f.run();
      assert.equal(result.status, "blocked");
      assert.equal(result.completionConfirmed, false);
      assert.equal(result.historyConfirmed, true);
      assert.equal(result.outcomeConfirmed, true);
      assert.equal(f.state.completionWrites, stage === 1 ? 0 : 1);
      assert.equal(f.state.entries, 1);
      assert.equal(f.state.historyWrites, 2);
      assert.equal(
        result.completionLockReleased,
        fault === "throw" ? null : fault !== "release",
      );
    }
  for (const fault of [
    "status",
    "storage",
    "absence",
    "release",
    "throw",
    "owner",
  ] as const) {
    const f = fixture();
    f.state.markerFault = fault;
    f.state.markerFaultAt = 1;
    const result = await f.run();
    assert.equal(result.status, "blocked", fault);
    assert.equal(result.completionConfirmed, false, fault);
    assert.equal(result.historyConfirmed, true, fault);
    assert.equal(result.outcomeConfirmed, true, fault);
    assert.equal(f.state.completionWrites, 1);
    assert.equal(f.state.entries, 1);
    assert.equal(f.state.historyWrites, 2);
  }
});

/**
 * 履歴各段の失敗後に保存済み結果と既知Effectを保持する。
 * @responsibility 表示結果の失敗と技術失敗を混同しない。
 * @trace ERB-IT-014
 * @precondition 技術結果は同呼出し内で保存済み。
 * @stimulus 履歴一段目／二段目の拒否・例外・解放不明・Owner失効・発行後失敗。
 * @observation 確定済みoutcome、保持判断、exact参照と履歴Effect。
 * @oracle 失敗後の次段0、outcome巻戻し0、Native再実行0。
 * @cleanup N/A: メモリだけ。
 * @boundary compositionの結果搬送。
 */
test("修復履歴接続: 保存失敗でも技術結果と保持判断を失わない", async () => {
  for (const retained of [false, true])
    for (const stage of [1, 2])
      for (const fault of [
        "reject",
        "release",
        "throw",
        "owner",
        "after_effect",
      ] as const) {
        const f = fixture();
        f.state.mode = retained ? "retained" : "ready";
        let id: string | null = null;
        if (retained) id = (await f.run()).recoveryId;
        f.state.historyFaultAt = stage;
        f.state.historyFault = fault;
        const result = await f.run(id, retained ? "retain" : "repair");
        assert.equal(result.status, "blocked", `${retained}:${stage}:${fault}`);
        assert.equal(result.outcomeConfirmed, true);
        assert.equal(result.retentionConfirmed, retained);
        assert.equal(result.historyConfirmed, false);
        assert.equal(result.nativeCleanupConfirmed, true);
        assert.equal(result.finalCheckpointConfirmed, true);
        const target = f.snapshot()?.operations[0];
        assert.ok(target?.kind === "runtime_repair");
        assert.equal(target.outcome?.status, "recovered");
        assert.equal(result.recoveryId, target.recoveryId);
        assert.equal(f.state.historyWrites, stage);
        assert.equal(f.state.entries, 1);
        assert.equal(
          result.historyEffectIssued,
          stage === 2 || fault === "release" || fault === "after_effect"
            ? true
            : fault === "throw"
              ? null
              : false,
        );
      }
});

/**
 * 各保存後のfresh確認を欠いた成功を拒否する。
 * @responsibility 書込み結果だけで履歴完了としない。
 * @trace ERB-IT-014
 * @precondition 新規recovered結果の保存後。
 * @stimulus 初回・一段後・二段後Readerの拒否・解放不明・例外・Owner失効。
 * @observation 実モデルの保存事実と履歴確認の分離。
 * @oracle 先行outcomeと既知Effect保持、後段0。
 * @cleanup N/A: メモリだけ。
 * @boundary fresh観測と呼出し生存。
 */
test("修復履歴接続: 各段後のfresh確認不明で停止する", async () => {
  for (const stage of [1, 2, 3])
    for (const fault of ["reject", "release", "throw", "owner"] as const) {
      const f = fixture();
      f.state.historyReadFaultAt = stage;
      f.state.historyReadFault = fault;
      const result = await f.run();
      assert.equal(result.status, "blocked");
      assert.equal(result.outcomeConfirmed, true);
      assert.equal(result.historyConfirmed, false);
      assert.equal(result.historyEffectIssued, stage > 1);
      assert.equal(f.state.historyWrites, stage - 1);
      assert.equal(f.state.entries, 1);
      assert.equal(f.snapshot()?.operations[0]?.outcome?.status, "recovered");
    }
});

/**
 * 保持済みのexact再入場で過去の保持確認を落とさない。
 * @responsibility 新しい保持判断と保存済み保持事実の投影を区別する。
 * @trace ERB-IT-014
 * @precondition 保持判断が耐久済みの同exact修復。
 * @stimulus 履歴未開始・一段後・確認済みと一段目／二段目の故障。
 * @observation 保持・outcome・履歴確認と技術入口増分。
 * @oracle 保持事実true、履歴失敗後も事実保持、重複判断の発行0。
 * @cleanup N/A: メモリだけ。
 * @boundary metadata再入場と結果搬送。
 */
test("修復履歴接続: 保持済みの再入場でも保持確認を返す", async () => {
  for (const stage of [
    "unstarted",
    "checkpoint",
    "confirmed",
    "fail_first",
    "fail_second",
  ] as const) {
    const f = fixture();
    f.state.mode = "retained";
    const repaired = await f.run();
    assert.ok(repaired.recoveryId);
    await f.run(repaired.recoveryId, "retain");
    const raw = f.saved.at(-1);
    assert.ok(raw);
    if (stage !== "confirmed") {
      f.state.bytes = Buffer.from(raw);
      f.state.historyBytes = Buffer.alloc(0);
      if (stage === "checkpoint") {
        const candidate = model.prepareCoordinatorRepairHistorySnapshot(
          raw,
          repaired.recoveryId,
          f.state.historyAt,
          false,
          "a".repeat(64),
        );
        assert.ok(candidate);
        f.state.bytes = candidate;
      }
    }
    const writes = f.state.historyWrites,
      calls = f.state.calls,
      entries = f.state.entries;
    if (stage === "fail_first" || stage === "fail_second") {
      f.state.historyFaultAt = writes + (stage === "fail_first" ? 1 : 2);
      f.state.historyFault = "reject";
    }
    const result = await f.run(repaired.recoveryId);
    assert.equal(
      result.status,
      stage.startsWith("fail_") ? "blocked" : "observed",
    );
    assert.equal(result.outcomeConfirmed, stage !== "confirmed");
    assert.equal(result.retentionConfirmed, true);
    assert.equal(result.historyConfirmed, !stage.startsWith("fail_"));
    assert.equal(f.state.calls, calls);
    assert.equal(f.state.entries, entries);
    assert.equal(
      f.state.historyWrites - writes,
      stage === "confirmed"
        ? 0
        : stage === "checkpoint" || stage === "fail_first"
          ? 1
          : 2,
    );
  }
});

/**
 * 前置読取りの解放観測と限定metadata救済の結果を保持する。
 * @responsibility blockedを技術許可へ変換しない。
 * @trace ERB-IT-014
 * @precondition 同exact修復の確認済み履歴。
 * @stimulus 前置Reader拒否と解放不明。
 * @observation lock観測、publisher件数、後続Writer／DI。
 * @oracle 解放不明は全後段0、救済no_pendingはDI0。
 * @cleanup N/A: メモリだけ。
 * @boundary 前置観測とmetadataだけの再入場。
 */
test("修復履歴接続: 前置Reader拒否を技術再開に使わない", async () => {
  for (const fault of ["reject", "release"] as const) {
    const f = fixture();
    f.state.mode = "incomplete";
    const first = await f.run();
    assert.ok(first.recoveryId);
    f.state.historyReadFaultAt = f.state.historyReads + 1;
    f.state.historyReadFault = fault;
    const calls = f.state.calls,
      entries = f.state.entries,
      publications = f.state.publications,
      writes = f.state.historyWrites;
    const result = await f.run(first.recoveryId);
    assert.equal(result.status, "blocked");
    assert.equal(result.historyLockReleased, fault !== "release");
    assert.equal(
      f.state.publications - publications,
      fault === "reject" ? 1 : 0,
    );
    assert.equal(f.state.historyWrites, writes);
    assert.equal(f.state.calls, calls);
    assert.equal(f.state.entries, entries);
  }
});

/**
 * 明示保持の接続が技術Sessionへ再入場しないことを確認する。
 * @responsibility 保存判断と新しいDocker処置を分離する。
 * @trace ERB-IT-014
 * @precondition 実DIモデルの修復成功と保持待ちを保存済み。
 * @stimulus exact保持、保存後の取消、同じ判断の再入力。
 * @observation 保持保存一回と履歴二段、対象外全文・技術入口件数不変。
 * @oracle receipt保存・一行履歴・除去を分け、再入場で日時と観測を再生成しない。
 * @cleanup N/A: 模擬I/Oとメモリだけ。
 * @boundary 実compositionと実モデル。物理Writerは別Host試験。
 */
test("修復保持接続: 明示判断の保存だけを行い技術再操作しない", async () => {
  for (const cancelAfterWrite of [false, true]) {
    const f = fixture();
    f.state.mode = "retained";
    const repaired = await f.run();
    assert.equal(repaired.outcomeConfirmed, true);
    const before = f.snapshot();
    const target = before?.operations[0];
    assert.ok(before && target?.kind === "runtime_repair");
    assert.equal(target.phase, "awaiting_disposition");
    const counts = {
      writes: f.state.calls,
      entries: f.state.entries,
      acquired: f.state.acquired,
      effects: f.state.effects,
    };
    f.state.cancelAfterWrite = cancelAfterWrite;
    const result = await f.run(target.recoveryId, "retain");
    assert.equal(result.status, "observed");
    assert.equal(
      "retentionConfirmed" in result && result.retentionConfirmed,
      true,
    );
    assert.equal(result.technicalStatus, null);
    assert.equal(f.state.calls, counts.writes + 1);
    assert.equal(f.state.entries, counts.entries);
    assert.equal(f.state.acquired, counts.acquired);
    assert.equal(f.state.effects, counts.effects);
    assert.equal(f.controller.signal.aborted, cancelAfterWrite);
    assert.ok(target.checkpoint);
    const retained =
      model.prepareCoordinatorStateRepairRetentionHandoffSnapshot(
        Buffer.from(`${encodeRuntimeStateValue(before)}\n`),
        target.recoveryId,
        {
          decidedAt: f.state.historyAt,
          reviewAfter: "2026-10-23T00:00:00.000Z",
          targets: {
            primary: target.checkpoint.directories.primary.retained.identity,
            failed: target.checkpoint.directories.failed.retained.identity,
            auxiliary:
              target.checkpoint.directories.auxiliary.retained.identity,
          },
        },
        "a".repeat(64),
      );
    assert.ok(retained);
    const history = model.prepareCoordinatorRepairHistorySnapshot(
      retained,
      target.recoveryId,
      f.state.historyAt,
      false,
      "a".repeat(64),
    );
    assert.ok(history);
    const published = model.prepareCoordinatorRepairHistoryPublication(
      history,
      target.recoveryId,
      Buffer.alloc(0),
      null,
      30,
      "a".repeat(64),
    );
    assert.ok(published);
    const completed = model.prepareCoordinatorStateRepairCompletionSnapshot(
      published.snapshotBytes,
      target.recoveryId,
      "a".repeat(64),
    );
    assert.ok(completed);
    assert.deepEqual(
      f.snapshot(),
      model.decodeCoordinatorStateSnapshot(completed, "a".repeat(64))?.snapshot,
    );
    assert.equal(result.completionConfirmed, true);
    assert.equal(result.retentionReviewAfter, "2026-10-23T00:00:00.000Z");
    assert.equal(result.historyConfirmed, true);
    assert.equal(f.state.historyWrites, 2);
    assert.deepEqual(
      f.snapshot()?.unresolvedRecoveries,
      before.unresolvedRecoveries,
    );
    assert.deepEqual(f.snapshot()?.pendingDeliveries, before.pendingDeliveries);
    const saved = Buffer.from(f.state.bytes ?? []);
    const reads = f.state.retentionReads,
      dates = f.state.dateReads;
    const duplicate = await f.run(target.recoveryId, "retain");
    assert.equal(duplicate.status, "observed");
    assert.equal(duplicate.completionConfirmed, true);
    assert.equal(duplicate.retentionReviewAfter, result.retentionReviewAfter);
    assert.equal(duplicate.nativeCleanupConfirmed, false);
    assert.equal(duplicate.finalCheckpointConfirmed, false);
    assert.equal(f.state.retentionReads, reads);
    assert.equal(f.state.dateReads, dates);
    assert.equal(f.state.calls, counts.writes + 1);
    assert.ok(f.state.bytes?.equals(saved));
  }
});

/**
 * 保持観測と保存期限の不一致を成功へ丸めない。
 * @responsibility 旧保持の昇格とReader期限の差を拒否する。
 * @trace ERB-IT-014
 * @precondition 保持待ちの同一修復。
 * @stimulus 保持観測失敗、終了前後の期限差、旧receipt欠測。
 * @observation 保存済み期限、処置・日時生成件数、同ID再入場。
 * @oracle 観測失敗／旧保持は書込み0、期限差後も元receiptだけで再開する。
 * @cleanup N/A: メモリだけ。
 * @boundary 模擬Ownerの失効と実composition。
 */
test("修復保持接続: 期限差と旧保持を成功へ補完しない", async () => {
  for (const fault of ["observation", "before", "fresh", "legacy"] as const) {
    const f = fixture();
    f.state.mode = "retained";
    const repaired = await f.run();
    assert.ok(repaired.recoveryId);
    if (fault === "legacy") {
      const value = f.snapshot();
      assert.ok(value);
      f.state.bytes = Buffer.from(
        `${encodeRuntimeStateValue({ ...value, operations: value.operations.map((operation) => ({ ...operation, phase: "settling", disposition: "retained_by_human_decision" })) })}\n`,
      );
      assert.ok(
        model.decodeCoordinatorStateSnapshot(f.state.bytes, "a".repeat(64)),
      );
    }
    const before = Buffer.from(f.state.bytes as Buffer),
      writes = f.state.calls,
      dateReads = f.state.dateReads;
    if (fault === "observation") f.state.retentionObservationFails = true;
    if (fault === "before" || fault === "fresh")
      f.state.completionDeadlineFault = fault;
    const result = await f.run(repaired.recoveryId, "retain");
    assert.equal(result.status, "blocked", fault);
    assert.equal(result.completionConfirmed, false, fault);
    if (fault === "observation" || fault === "legacy") {
      assert.equal(result.retentionConfirmed, false);
      assert.equal(result.retentionReviewAfter, null);
      assert.equal(f.state.calls, writes);
      assert.equal(f.state.dateReads, dateReads);
      assert.ok(f.state.bytes?.equals(before));
    } else {
      assert.equal(result.retentionReviewAfter, "2026-10-23T00:00:00.000Z");
      const reads = f.state.retentionReads,
        dates = f.state.dateReads;
      f.state.completionDeadlineFault = "none";
      const retried = await f.run(repaired.recoveryId, "retain");
      assert.equal(retried.status, "observed");
      assert.equal(retried.completionConfirmed, true);
      assert.equal(retried.retentionReviewAfter, result.retentionReviewAfter);
      assert.equal(f.state.retentionReads, reads);
      assert.equal(f.state.dateReads, dates);
    }
  }
  for (const fault of ["marker", "fresh"] as const) {
    const f = fixture();
    f.state.mode = "retained";
    const repaired = await f.run();
    assert.ok(repaired.recoveryId);
    const completed = await f.run(repaired.recoveryId, "retain");
    assert.equal(completed.completionConfirmed, true);
    if (fault === "marker") f.state.markerFault = "absence";
    else {
      f.state.completionReadFaultAt = f.state.completionReads + 2;
      f.state.completionReadFault = "reject";
    }
    const reads = f.state.retentionReads,
      dates = f.state.dateReads;
    const stopped = await f.run(repaired.recoveryId, "retain");
    assert.equal(stopped.status, "blocked");
    assert.equal(stopped.retentionConfirmed, true);
    assert.equal(stopped.retentionReviewAfter, completed.retentionReviewAfter);
    assert.equal(stopped.completionConfirmed, false);
    assert.equal(stopped.finalCheckpointConfirmed, false);
    assert.equal(stopped.nativeCleanupConfirmed, false);
    const report = renderDockerRecoveryDoctorReport(
      {
        ...stopped,
        contract: "crdd-coordinator/current-runtime-repair",
        cliCleanupConfirmed: true,
        cliCleanupReason: null,
      },
      true,
    );
    assert.equal(report.exitCode, 2);
    assert.equal(
      JSON.parse(report.stdout).retentionReviewAfter,
      completed.retentionReviewAfter,
    );
    assert.equal(f.state.retentionReads, reads);
    assert.equal(f.state.dateReads, dates);
  }
});

/**
 * 保持前の明示拒否を新しい技術処置へ変換しない。
 * @responsibility 取消・参照欠測・別参照・Owner失効で保存を止める。
 * @trace ERB-IT-014
 * @precondition 保持待ちの同じ修復。
 * @stimulus 四種類の判断前拒否。
 * @observation 保存要求、技術取得、元本文。
 * @oracle 全処置0で元本文不変。
 * @cleanup N/A: メモリだけ。
 * @boundary 模擬I/Oと実composition。
 */
test("修復保持接続: 判断前の拒否では保存も技術取得も行わない", async () => {
  for (const fault of [
    "cancel",
    "missing_id",
    "different_id",
    "owner",
  ] as const) {
    const f = fixture();
    f.state.mode = "retained";
    await f.run();
    const target = f.snapshot()?.operations[0];
    assert.ok(target?.kind === "runtime_repair");
    const before = Buffer.from(f.state.bytes ?? []);
    const writes = f.state.calls,
      entries = f.state.entries;
    if (fault === "cancel") f.controller.abort();
    if (fault === "owner") f.state.markerFault = "owner";
    const result = await f.run(
      fault === "missing_id"
        ? null
        : fault === "different_id"
          ? `${target.recoveryId}0`
          : target.recoveryId,
      "retain",
    );
    assert.equal(result.status, "blocked", fault);
    assert.equal(f.state.calls, writes, fault);
    assert.equal(f.state.entries, entries, fault);
    assert.ok(f.state.bytes?.equals(before), fault);
  }
});

/**
 * 同じ呼出しの出版確認と保持済みの値を共同で要求する。
 * @responsibility fresh保存確定と単なる重複判断を区別する。
 * @trace ERB-IT-014
 * @precondition 保持済みの正規本文。物理出版の成立は別Host正例。
 * @stimulus completed／no_pendingと出版・Reader・Ownerの部分不成立。
 * @observation 保持確認、WriterとDI増分0、本文不変。
 * @oracle 当該呼出しの出版確認なしでは保持完了を返さない。
 * @cleanup N/A: 模擬I/Oとメモリだけ。
 * @boundary 実compositionと模擬publisherの結果搬送。
 */
test("修復保持接続: fresh出版確認だけを追加保存なしで返す", async () => {
  for (const fault of [
    "none",
    "no_pending",
    "reader",
    "different_id",
  ] as const) {
    const f = fixture();
    f.state.mode = "retained";
    const repaired = await f.run();
    assert.ok(repaired.recoveryId);
    f.state.historyFaultAt = 1;
    f.state.historyFault = "reject";
    const retained = await f.run(repaired.recoveryId, "retain");
    assert.equal(
      "retentionConfirmed" in retained && retained.retentionConfirmed,
      true,
    );
    assert.equal(retained.status, "blocked");
    f.state.historyFaultAt = 0;
    const before = Buffer.from(f.state.bytes ?? []);
    const writes = f.state.calls,
      entries = f.state.entries;
    f.state.publicationCompleted = fault !== "no_pending";
    if (fault === "reader") f.state.readerReleased = false;
    const result = await f.run(
      fault === "different_id"
        ? `${repaired.recoveryId}0`
        : repaired.recoveryId,
      "retain",
    );
    assert.equal(
      result.status,
      fault === "none" || fault === "no_pending" ? "observed" : "blocked",
      fault,
    );
    assert.equal(
      "retentionConfirmed" in result && result.retentionConfirmed === true,
      fault === "none" || fault === "no_pending",
      fault,
    );
    assert.equal(f.state.calls, writes, fault);
    assert.equal(f.state.entries, entries, fault);
    if (fault === "none" || fault === "no_pending") {
      assert.equal(f.snapshot()?.operations.length, 0);
      assert.equal(result.completionConfirmed, true);
    } else assert.ok(f.state.bytes?.equals(before), fault);
  }
});

/**
 * 保持保存の拒否・不明・解放不明・例外を別に確認する。
 * @responsibility 保存未確認を保持完了へ丸めない。
 * @trace ERB-IT-014
 * @precondition 保存前の保持待ち本文が確定済み。
 * @stimulus 既存Writerの四故障。
 * @observation 保存一回、停止、技術入口増分0、元本文不変。
 * @oracle 不明の自動再保存・技術再実行・終了整理なし。
 * @cleanup N/A: メモリだけ。
 * @boundary 物理故障の完全性はHost検証に残す。
 */
test("修復保持接続: 保存未確認を保持完了にしない", async () => {
  for (const kind of ["reject", "confirmation", "release", "throw"] as const) {
    const f = fixture();
    f.state.mode = "retained";
    await f.run();
    const target = f.snapshot()?.operations[0];
    assert.ok(target?.kind === "runtime_repair");
    const before = Buffer.from(f.state.bytes ?? []);
    const writes = f.state.calls,
      entries = f.state.entries;
    f.state.fault = "outcome";
    f.state.faultKind = kind;
    const result = await f.run(target.recoveryId, "retain");
    assert.equal(result.status, "blocked", kind);
    assert.equal(result.retentionConfirmed, false);
    assert.equal(f.state.calls, writes + 1, kind);
    assert.equal(f.state.entries, entries, kind);
    assert.ok(f.state.bytes?.equals(before), kind);
  }
});

/**
 * 完了と取消・Native故障・回収失敗を相関判定する。
 * @responsibility 後着取消で技術完了を巻戻さず、後着故障を成功へ畳まない。
 * @trace ERB-IT-014
 * @precondition 実Source・Runtime・Machine・保存model。
 * @stimulus 技術結果と終了時の五分類、取消とNative喪失の両順序。
 * @observation 耐久outcome・primary・cleanup・phase・保存順。
 * @oracle 正常共同条件だけrecovered、一次失敗と回収失敗は別fieldに保持する。
 * @cleanup 同Session join一回、返却後通知の保存0。
 * @boundary 模擬技術境界であり実Docker成功は主張しない。
 */
test("修復結果: 技術完了・first-wins・二版保存を混同しない", async () => {
  for (const mode of [
    "ready",
    "incomplete",
    "retained",
    "cancel",
    "helper_then_cancel",
    "cancel_then_helper",
    "effect_unknown",
  ] as const) {
    for (const close of mode === "ready"
      ? ([
          "clean",
          "cancel",
          "helper",
          "unknown",
          "protocol",
          "cancel_unknown",
          "cancel_protocol",
        ] as const)
      : mode === "effect_unknown"
        ? (["clean", "unknown"] as const)
        : (["clean"] as const)) {
      const f = fixture();
      f.state.mode = mode;
      f.state.close = close;
      const result = await f.run();
      assert.equal(
        result.status,
        mode === "retained" ? "blocked" : "observed",
        JSON.stringify({
          mode,
          close,
          result,
          calls: f.state.calls,
          observed: f.state.observed,
          snapshot: f.snapshot(),
        }),
      );
      assert.equal(result.finalCheckpointConfirmed, true);
      assert.equal(f.state.joined, 1);
      const target =
        f.snapshot()?.operations[0] ??
        model.decodeCoordinatorStateSnapshot(
          f.state.completionBefore,
          "a".repeat(64),
        )?.snapshot.operations[0];
      assert.equal(target?.kind, "runtime_repair");
      if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
      assertRepairResultFields(result, target, mode, close);
      if (result.completionConfirmed)
        assert.equal(f.snapshot()?.operations.length, 0);
      const expected =
        mode === "incomplete"
          ? null
          : mode === "retained" ||
              (mode === "ready" && ["clean", "cancel"].includes(close))
            ? "recovered"
            : mode === "cancel" || mode === "cancel_then_helper"
              ? "cancelled"
              : "blocked";
      assert.equal(
        target.outcome?.status ?? null,
        expected,
        `${mode}:${close}`,
      );
      assert.equal(result.outcomeConfirmed, expected !== null);
      assert.equal(
        target.phase,
        expected === null
          ? "repairing"
          : mode === "retained"
            ? "awaiting_disposition"
            : "settling",
      );
      if (mode === "retained")
        assert.equal(target.disposition, "pending_human_decision");
      assert.equal(
        target.primaryFailure?.reason ?? null,
        mode === "effect_unknown" ? "runtime_repair_effect_unknown" : null,
      );
      if (expected !== null) {
        const previous = model.decodeCoordinatorStateSnapshot(
          f.saved.at(-2),
          "a".repeat(64),
        )?.snapshot.operations[0];
        assert.equal(previous?.kind, "runtime_repair");
        if (previous?.kind !== "runtime_repair")
          throw new Error("wrong_previous");
        assert.equal(previous.outcome, null);
        assert.deepEqual(previous.checkpoint, target.checkpoint);
        assert.deepEqual(previous.primaryFailure, target.primaryFailure);
      }
      const beforeCalls = f.state.calls;
      const callback = f.late();
      if (callback && target.checkpoint)
        assert.equal(callback(target.checkpoint), false);
      assert.equal(f.state.calls, beforeCalls);
    }
  }
});

/**
 * 結果を決める共同fieldを独立した期待値へ照合する。
 * @responsibility statusだけ合う誤分類を見逃さない。
 * @trace ERB-IT-014
 * @precondition 実codecで復号した対象修復と返却値を使う。
 * @stimulus 技術結果と終了故障の固定組合せ。
 * @observation reason、outcome全文、primary、cleanup、Native回収確認。
 * @oracle 各共同fieldが独立期待値へ一致する。
 * @cleanup N/A: 値検査のみ。
 * @boundary 結果の保存値と利用側の返却値。
 */
function assertRepairResultFields(
  result: Awaited<ReturnType<typeof repairRuntimeOwnedDockerRuntime>>,
  target: CoordinatorStateRepairOperation,
  mode: ReturnType<typeof fixture>["state"]["mode"],
  close: ReturnType<typeof fixture>["state"]["close"],
) {
  const unknown = close === "unknown" || close === "cancel_unknown";
  const protocol = close === "protocol" || close === "cancel_protocol";
  const reason =
    mode === "incomplete"
      ? "runtime_repair_observation_unknown"
      : mode === "effect_unknown"
        ? "runtime_repair_effect_unknown"
        : mode === "cancel" || mode === "cancel_then_helper"
          ? "runtime_repair_cancelled"
          : mode === "helper_then_cancel" || close === "helper"
            ? "runtime_repair_boundary_unavailable"
            : unknown || protocol
              ? "runtime_repair_cleanup_unknown"
              : "runtime_repair_recovered";
  const status =
    mode === "incomplete"
      ? null
      : reason === "runtime_repair_recovered"
        ? "recovered"
        : reason === "runtime_repair_cancelled"
          ? "cancelled"
          : "blocked";
  assert.equal(
    result.reason,
    mode === "retained" ? "runtime_repair_state_unavailable" : reason,
    "outcome_reason_mismatch",
  );
  assert.equal(
    result.nativeCleanupConfirmed,
    !unknown,
    "native_cleanup_mismatch",
  );
  assert.equal(result.finalCheckpointConfirmed, true);
  assert.equal(result.outcomeConfirmed, status !== null);
  assert.deepEqual(
    target.outcome,
    status === null ? null : { status, reason, cleanupConfirmed: !unknown },
  );
  assert.deepEqual(
    target.primaryFailure,
    mode === "effect_unknown"
      ? { stage: "repair", reason: "runtime_repair_effect_unknown" }
      : null,
  );
  assert.equal(target.checkpoint?.cleanup, unknown ? "unknown" : "confirmed");
  assert.equal(
    target.checkpoint?.cleanupFailure,
    unknown
      ? "helper_cleanup_unknown"
      : protocol
        ? "helper_protocol_failed"
        : null,
  );
}

/**
 * 返却fieldを誤る変異を既存共同Oracleで拒否する。
 * @responsibility 回収確認と理由を独立に反証する。
 * @trace ERB-IT-014
 * @precondition 実Sourceをメモリ内で一箇所だけ変異する。
 * @stimulus Native確認の常trueと境界失敗理由の置換。
 * @observation 変異生成成立と同じassertRepairResultFieldsの失敗。
 * @oracle 正常Sourceの既存Oracleを弱めず変異を拒否する。
 * @cleanup 本番Source変更0。
 * @boundary 返却・保存共同field。
 */
test("修復結果: 回収確認と理由の誤返却を共同Oracleで検出する", async () => {
  for (const field of ["native", "reason"] as const) {
    const f = fixture((source) => {
      const mutated =
        field === "native"
          ? source.replaceAll(
              /^(\s*)nativeCleanupConfirmed,$/gmu,
              "$1nativeCleanupConfirmed: true,",
            )
          : source.replaceAll(
              '"runtime_repair_boundary_unavailable"',
              '"runtime_repair_failed_closed"',
            );
      assert.notEqual(mutated, source);
      return mutated;
    });
    f.state.close = field === "native" ? "unknown" : "helper";
    const result = await f.run();
    const target = f.snapshot()?.operations[0];
    assert.equal(target?.kind, "runtime_repair");
    if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
    assert.throws(
      () => assertRepairResultFields(result, target, "ready", f.state.close),
      field === "native"
        ? /native_cleanup_mismatch/u
        : /outcome_reason_mismatch/u,
    );
  }
});

/**
 * 保存拒否と独立した呼出しOwner失効を反証する。
 * @responsibility Effect前後で耐久事実と新規発行を区別する。
 * @trace ERB-IT-014
 * @precondition 実Source、失効を観測する模擬Root Owner。
 * @stimulus 準備保存後とEffect直後の失効、revalidate省略変異。
 * @observation 注入一回、Writer要求、既発行Effect、元本文、exact参照。
 * @oracle Effect前0／Effect後1を保持し、失効後Writer・追加Effect0。
 * @cleanup 返却後callbackも保存0、本番Source不変更。
 * @boundary 模擬Owner検証であり実Git失効の証明ではない。
 */
test("修復結果: 現在Owner失効後は既発行事実を推測保存しない", async () => {
  for (const point of ["prepared", "effect"] as const) {
    /**
     * Owner喪失後の保存とEffectを同じOracleで拒否する。
     * @responsibility Owner喪失後の保存とEffectを同じOracleで拒否する。
     * @trace ERB-IT-014
     * @precondition 準備前後で失効させるOwnerと対象Source変異。
     * @stimulus 実run本文またはguard変異を固定fixtureで呼ぶ。
     * @observation 保存回数、処置0/1とblocked理由。
     * @oracle 喪失点以降の書込み0、元失敗を保持し変異を検出する。
     * @cleanup fixtureの同じSessionを終了し代役を破棄する。
     * @boundary 実回復本文の局所故障注入。実Dockerなし。
     */
    const verify = async (mutant: boolean) => {
      const f = fixture((source) => {
        if (!mutant) return source;
        const guard = "repository?.revalidate() === true";
        assert.equal(source.split(guard).length, 2);
        return source.replace(guard, "true");
      });
      f.state.mode = "effect_unknown";
      f.state.lossAt = point;
      const result = await f.run();
      assert.equal(f.state.losses, 1);
      assert.equal(
        f.state.calls,
        f.state.writesAtLoss,
        "owner_loss_write_issued",
      );
      assert.equal(f.state.effects, point === "prepared" ? 0 : 1);
      assert.equal(result.status, "blocked");
      assert.equal(result.finalCheckpointConfirmed, false);
      assert.equal(result.outcomeConfirmed, false);
      assert.ok(f.state.bytesAtLoss);
      assert.ok(f.state.bytes?.equals(f.state.bytesAtLoss));
      const target = f.snapshot()?.operations[0];
      assert.equal(target?.recoveryId, result.recoveryId);
      if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
      const before = f.state.calls;
      const callback = f.late();
      if (callback && target.checkpoint)
        assert.equal(callback(target.checkpoint), false);
      assert.equal(f.state.calls, before);
    };
    await verify(false);
    await assert.rejects(() => verify(true), /owner_loss_write_issued/u);
  }
});

/**
 * cleanup版とoutcome版の保存不明を独立に反証する。
 * @responsibility 片方の保存成功を全結果の成功へ流用しない。
 * @trace ERB-IT-014
 * @precondition 実遷移modelで各候補を先に検査する。
 * @stimulus 二段階それぞれへ拒否・確認不明・解放不明・例外を一回注入。
 * @observation 注入到達、元本文、保存版、返却field、後続要求。
 * @oracle 最初の未確認保存以降要求0、outcome成功表示0、耐久済み段階を保持する。
 * @cleanup メモリだけ、Source変更0。
 * @boundary 保存結果のConsumer側契約。
 */
test("修復結果: 最終二保存の片側不成立を成功へ補完しない", async () => {
  for (const stage of ["cleanup", "outcome"] as const) {
    for (const kind of [
      "reject",
      "confirmation",
      "release",
      "throw",
    ] as const) {
      const f = fixture();
      f.state.fault = stage;
      f.state.faultKind = kind;
      const result = await f.run();
      assert.equal(f.state.faultHits, 1);
      assert.equal(f.state.calls, f.state.faultsAt);
      assert.equal(result.status, "blocked");
      assert.equal(result.outcomeConfirmed, false);
      assert.equal(result.finalCheckpointConfirmed, stage === "outcome");
      assert.equal(result.nativeCleanupConfirmed, true);
      const target = f.snapshot()?.operations[0];
      assert.equal(target?.kind, "runtime_repair");
      if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
      assert.equal(target.outcome, null);
      assert.equal(
        target.checkpoint?.cleanup,
        stage === "outcome" ? "confirmed" : "pending",
      );
      const beforeCalls = f.state.calls;
      const callback = f.late();
      if (callback && target.checkpoint)
        assert.equal(callback(target.checkpoint), false);
      assert.equal(f.state.calls, beforeCalls);
    }
  }
});

/**
 * 一次失敗保存後・outcome保存前の正規切断点を作る。
 * @responsibility 手組み成功値ではなく実Producerの中断状態を使う。
 * @trace ERB-IT-014
 * @precondition 実Source・DI・保存modelのメモリ境界。
 * @stimulus 不可逆なEffect不明とoutcome保存拒否。
 * @observation primaryとcleanupが耐久済み、outcomeだけnullの本文。
 * @oracle 注入一回、exact回復参照、最終checkpoint確認済み。
 * @cleanup メモリだけ。
 * @boundary 記録確定と技術再実行の分離。
 */
async function interruptedRepairOutcome(
  close: "clean" | "unknown" = "clean",
  transform?: (source: string) => string,
) {
  const f = fixture(transform);
  f.state.mode = "effect_unknown";
  f.state.close = close;
  f.state.fault = "outcome";
  const first = await f.run();
  assert.equal(first.status, "blocked");
  assert.equal(first.finalCheckpointConfirmed, true);
  assert.equal(first.outcomeConfirmed, false);
  assert.equal(f.state.faultHits, 1);
  assert.ok(first.recoveryId);
  f.state.fault = "none";
  f.state.faultHits = 0;
  return { f, id: first.recoveryId };
}

/**
 * 保存済みの不可逆失敗を技術再実行なしで確定する。
 * @responsibility 回収不明を正常化せず記録の閉鎖だけを行う。
 * @trace ERB-IT-014
 * @precondition 実Producerの正規切断点と通常Reader成功。
 * @stimulus cleanup confirmed／unknownから同exact参照で再入場。
 * @observation DI入口・Native取得・Effect、全文、revisionとprevious。
 * @oracle 新技術要求0、phase/outcome以外不変、一版だけ進む。
 * @cleanup 終端再入場も新要求0。
 * @boundary 保存済み事実だけを使う限定記録確定。
 */
test("修復記録: 一次失敗が耐久済みなら技術処置なしにblockedへ確定する", async () => {
  for (const close of ["clean", "unknown"] as const) {
    const { f, id } = await interruptedRepairOutcome(close);
    f.controller.abort();
    const before = f.snapshot();
    const decoded = model.decodeCoordinatorStateSnapshot(
      f.state.bytes,
      "a".repeat(64),
    );
    assert.ok(before && decoded);
    const old = before.operations[0];
    assert.equal(old?.kind, "runtime_repair");
    const counts = {
      entries: f.state.entries,
      acquired: f.state.acquired,
      effects: f.state.effects,
      writes: f.state.calls,
    };
    const result = await f.run(id);
    assert.equal(result.status, "observed");
    assert.equal(result.reason, "runtime_repair_effect_unknown");
    assert.equal(result.finalCheckpointConfirmed, true);
    assert.equal(result.outcomeConfirmed, true);
    assert.equal(result.nativeCleanupConfirmed, close === "clean");
    assert.equal(f.state.entries, counts.entries);
    assert.equal(f.state.acquired, counts.acquired);
    assert.equal(f.state.effects, counts.effects);
    assert.equal(f.state.calls, counts.writes + 1);
    const after = f.snapshot();
    assert.ok(after);
    const target = after.operations[0];
    assert.equal(target?.kind, "runtime_repair");
    if (target?.kind !== "runtime_repair") throw new Error("wrong_target");
    assert.equal(target.phase, "settling");
    assert.deepEqual(target.outcome, {
      status: "blocked",
      reason: "runtime_repair_effect_unknown",
      cleanupConfirmed: close === "clean",
    });
    assert.deepEqual(
      {
        ...target,
        phase: "repairing",
        outcome: null,
        summarySha256: null,
        history: null,
      },
      old,
    );
    assert.equal(result.historyConfirmed, true);
    assert.equal(result.completionConfirmed, false);
    assert.equal(after.revision, before.revision + 3);
    const outcomeBytes = f.saved.at(-1);
    assert.ok(outcomeBytes);
    const historyPending = model.prepareCoordinatorRepairHistorySnapshot(
      outcomeBytes,
      id,
      f.state.historyAt,
      false,
      "a".repeat(64),
    );
    assert.ok(historyPending);
    const priorHistory = model.decodeCoordinatorStateSnapshot(
      historyPending,
      "a".repeat(64),
    );
    assert.ok(priorHistory);
    assert.deepEqual(after.previous, {
      revision: priorHistory.snapshot.revision,
      payloadSha256: priorHistory.payloadSha256,
    });
    assert.deepEqual(after.unresolvedRecoveries, before.unresolvedRecoveries);
    assert.deepEqual(after.pendingDeliveries, before.pendingDeliveries);
    const terminalBytes = Buffer.from(f.state.bytes as Buffer);
    const refused = await f.run(id);
    assert.equal(refused.status, "observed");
    assert.equal(refused.reason, "runtime_repair_effect_unknown");
    assert.equal(refused.historyConfirmed, true);
    assert.equal(refused.completionConfirmed, false);
    assert.equal(f.state.entries, counts.entries);
    assert.equal(f.state.calls, counts.writes + 1);
    assert.ok(f.state.bytes?.equals(terminalBytes));
  }
});

/**
 * 取消による記録確定の遮断を負対照で検出する。
 * @responsibility 技術取消を耐久事実の保存Owner失効と混同しない。
 * @trace ERB-IT-014
 * @precondition 同じ実Producerの正規切断点。
 * @stimulus 入口へ取消拒否を戻すメモリ変異とAbort済み再入場。
 * @observation 変異生成成立、正例と同じoutcome確認Oracle。
 * @oracle 変異では記録確定が欠けるため同じOracleが拒否する。
 * @cleanup 本番Source変更0。
 * @boundary 取消と記録だけの確定。
 */
test("修復記録: 取消guardの早過ぎる適用を検出する", async () => {
  const { f, id } = await interruptedRepairOutcome("clean", (source) => {
    const changed = source.replace(
      "if (!repository || !currentOwner())",
      "if (!repository || !currentOwner() || signal.aborted)",
    );
    assert.notEqual(changed, source);
    return changed;
  });
  f.controller.abort();
  const result = await f.run(id);
  assert.throws(() => assert.equal(result.outcomeConfirmed, true));
});

/**
 * 限定記録確定の対象外を通常の技術処理へ紛れ込ませない。
 * @responsibility 既知primaryと回収段階の境界を直接反証する。
 * @trace ERB-IT-014
 * @precondition 正規切断点を基準に、Schema適合する反例だけを使う。
 * @stimulus primary分類差、checkpoint欠測、未回収、別ID、既存終端、Reader／Owner失効。
 * @observation decoder成功、Writer・DI入口・Native取得、元本文。
 * @oracle 記録確定Writer0、本文不変、primaryなしだけDI通常入口へ進む。
 * @cleanup メモリだけ、実Git失効は主張しない。
 * @boundary 値適合と記録確定条件を区別する。
 */
test("修復記録: 対象外の失敗や未回収状態を確定しない", async () => {
  for (const mode of [
    "primary_null",
    "primary_other",
    "checkpoint_null",
    "pending",
    "not_requested",
    "wrong_id",
    "reader",
    "owner",
  ] as const) {
    const { f, id } = await interruptedRepairOutcome();
    const snapshot = f.snapshot();
    assert.ok(snapshot);
    const prior = snapshot.operations[0];
    if (prior?.kind !== "runtime_repair") throw new Error("wrong_target");
    const changed =
      mode === "primary_null"
        ? { ...prior, primaryFailure: null }
        : mode === "primary_other"
          ? {
              ...prior,
              primaryFailure: {
                stage: "checkpoint",
                reason: "runtime_repair_state_unavailable",
              },
            }
          : mode === "checkpoint_null"
            ? { ...prior, checkpoint: null }
            : mode === "pending" || mode === "not_requested"
              ? {
                  ...prior,
                  checkpoint: {
                    ...prior.checkpoint,
                    cleanup: mode,
                    cleanupFailure: null,
                  },
                }
              : prior;
    f.state.bytes = Buffer.from(
      `${encodeRuntimeStateValue({ ...snapshot, operations: [changed] })}\n`,
    );
    assert.ok(
      model.decodeCoordinatorStateSnapshot(f.state.bytes, "a".repeat(64)),
      mode,
    );
    if (mode === "reader") f.state.readerReleased = false;
    if (mode === "owner") f.state.alive = false;
    const before = Buffer.from(f.state.bytes);
    const writes = f.state.calls,
      entries = f.state.entries,
      acquired = f.state.acquired;
    const result = await f.run(mode === "wrong_id" ? `${id}0` : id);
    assert.equal(result.status, "blocked", mode);
    assert.equal(f.state.calls, writes, mode);
    assert.equal(
      f.state.entries,
      entries + (mode === "primary_null" ? 1 : 0),
      mode,
    );
    assert.equal(f.state.acquired, acquired, mode);
    assert.ok(f.state.bytes.equals(before), mode);
    const afterEntries = f.state.entries;
    f.controller.abort();
    const cancelled = await f.run(mode === "wrong_id" ? `${id}0` : id);
    assert.equal(cancelled.status, "blocked", mode);
    assert.equal(f.state.entries, afterEntries, mode);
    assert.equal(f.state.acquired, acquired, mode);
    assert.equal(f.state.calls, writes, mode);
    assert.ok(f.state.bytes.equals(before), mode);
  }
});

/**
 * 記録確定の保存不明でも再試行・復元をしない。
 * @responsibility 通常Writerの三確認条件を終了限定経路でも維持する。
 * @trace ERB-IT-014
 * @precondition 正規切断点、Native新取得を伴わない。
 * @stimulus 拒否・確認不明・解放不明・例外。
 * @observation 注入一回、WriterとDIの回数、元版全文、返却確認。
 * @oracle 一要求だけ、outcome未確認、旧本文とexact ID保持。
 * @cleanup 本番Source不変更。
 * @boundary 記録だけの確定と保存結果。
 */
test("修復記録: 保存不成立では元失敗を保持して停止する", async () => {
  for (const kind of ["reject", "confirmation", "release", "throw"] as const) {
    const { f, id } = await interruptedRepairOutcome();
    f.state.fault = "outcome";
    f.state.faultKind = kind;
    const before = Buffer.from(f.state.bytes as Buffer);
    const writes = f.state.calls,
      entries = f.state.entries,
      acquired = f.state.acquired;
    const result = await f.run(id);
    assert.equal(f.state.faultHits, 1);
    assert.equal(f.state.calls, writes + 1);
    assert.equal(f.state.entries, entries);
    assert.equal(f.state.acquired, acquired);
    assert.equal(result.status, "blocked");
    assert.equal(result.outcomeConfirmed, false);
    assert.equal(result.finalCheckpointConfirmed, true);
    assert.equal(result.recoveryId, id);
    assert.ok(f.state.bytes?.equals(before));
  }
});

/**
 * marker清掃の共同条件を通常Readerより先に要求する。
 * @responsibility 清掃の部分成功を修復・保存成功へ変換しない。
 * @trace ERB-IT-014
 * @precondition 正規Producerがprimaryとcleanupを保存した切断点。
 * @stimulus 各確認fieldの単独不成立、例外、清掃直後Owner失効。
 * @observation 清掃一回、Reader／DI／Writer増分0、元本文と除去事実。
 * @oracle 失敗後の再試行0、正常再入場だけfresh Readerと記録保存へ進む。
 * @cleanup 実markerのFilesystem意味は既存清掃試験へ分離する。
 * @boundary 修復Ownerと既存保存marker清掃の接続。
 */
test("修復保存marker: 清掃確認前はReaderと技術処置へ進まない", async () => {
  for (const kind of [
    "status",
    "storage",
    "absence",
    "release",
    "throw",
    "owner",
  ] as const) {
    const { f, id } = await interruptedRepairOutcome();
    f.controller.abort();
    f.state.markerFault = kind;
    const before = Buffer.from(f.state.bytes as Buffer);
    const counts = {
      markers: f.state.markers,
      readers: f.state.readers,
      entries: f.state.entries,
      calls: f.state.calls,
    };
    const rejected = await f.run(id);
    assert.equal(rejected.status, "blocked", kind);
    assert.equal(f.state.markers, counts.markers + 1, kind);
    assert.equal(f.state.readers, counts.readers, kind);
    assert.equal(f.state.entries, counts.entries, kind);
    assert.equal(f.state.calls, counts.calls, kind);
    assert.ok(f.state.bytes?.equals(before), kind);
    if (kind !== "throw") {
      assert.equal(rejected.stateMarkerCleanup?.filesystemEffectIssued, true);
      assert.equal(rejected.stateMarkerCleanup?.markerRemoved, true);
    }
    f.state.markerFault = "none";
    f.state.alive = true;
    const resumed = await f.run(id);
    assert.equal(resumed.outcomeConfirmed, true, kind);
    assert.equal(f.state.readers, counts.readers + 1, kind);
    assert.equal(f.state.entries, counts.entries, kind);
    assert.equal(resumed.stateMarkerCleanup?.filesystemEffectIssued, false);
  }
});

/**
 * 出版の部分成立を通常Readerや技術再開へ搬送しない。
 * @responsibility no_pendingと保存不明を区別する。
 * @trace ERB-IT-014
 * @precondition 正規Producerの保存済み失敗、現在Owner。
 * @stimulus 出版status・確認・排他解放の不成立、例外、直後Owner失効。
 * @observation 出版一回、marker／Reader／DI／Writer増分0、元版全文。
 * @oracle 既発生Effect診断を保持し、後段はfresh確認後だけ進む。
 * @cleanup 実出版の意味は実Host試験へ分離する。
 * @boundary 出版結果と修復Ownerの接続。
 */
test("修復出版: 部分成立の後は新処置へ進まない", async () => {
  for (const kind of [
    "status",
    "snapshot",
    "release",
    "throw",
    "owner",
  ] as const) {
    const { f, id } = await interruptedRepairOutcome();
    f.controller.abort();
    f.state.publicationFault = kind;
    const bytes = Buffer.from(f.state.bytes as Buffer);
    const counts = {
      publications: f.state.publications,
      markers: f.state.markers,
      readers: f.state.readers,
      entries: f.state.entries,
      calls: f.state.calls,
    };
    const result = await f.run(id);
    assert.equal(result.status, "blocked");
    assert.equal(f.state.publications, counts.publications + 1);
    assert.equal(f.state.markers, counts.markers);
    assert.equal(f.state.readers, counts.readers);
    assert.equal(f.state.entries, counts.entries);
    assert.equal(f.state.calls, counts.calls);
    assert.ok(f.state.bytes?.equals(bytes));
    if (kind !== "throw")
      assert.equal(result.statePublication?.filesystemEffectIssued, true);
  }
});

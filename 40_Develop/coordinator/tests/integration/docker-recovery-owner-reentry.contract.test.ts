/**
 * 本番Ownerの途中失敗後の進行保持と正常終了の実Host結合を確認する。
 * @packageDocumentation
 * @responsibility 模擬下位境界による再入場と、実修復保存から同RootのTask・Home排他・Host・現在Writerによる正常終了への接続を検証する。
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @trace PRL-IT-013
 * @level IT
 * @scope 模擬境界によるProcess内再入場、退避なし／自動破棄保存前中断後の明示保持から実修復API・現在Writer／history／completionを経た同Root Taskへの接続、実Root・Home排他・Hostによる正常終了、認証create切断子の五通常例外。Native・Docker技術は代役とし実Docker処置は行わない。
 * @boundary ERB-IT-003=Owner→保存・Host境界の模擬接続と実Host結合。ERB-IT-014=実修復API／DI Machine／保存と、模擬Native・技術観測。
 */
import type {
  CoordinatorStateSnapshot,
  CoordinatorStateTaskOperation,
} from "../../../domain-model/src/index.ts";
import {
  coordinatorTaskResourcesAreSettled,
  COORDINATOR_STATE_SCHEMA,
} from "../../../domain-model/src/index.ts";
import {
  createDockerRestartRequestId,
  isDockerRestartCheckpointSettled,
} from "../../../domain-model/src/index.ts";
import { encodeRuntimeStateValue } from "../../../domain-model/src/index.ts";
import { executionSelection } from "../fixtures/ai-selection.ts";

import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { createServer } from "node:http";
import {
  requestInChild,
  type VerificationHttpTiming,
} from "../../../workbench-server/scripts/ai-verification-http.ts";
import { stripTypeScriptTypes } from "node:module";
import { sourceDeclaration } from "../support/source-declaration.ts";
import path from "node:path";
import { mock, test } from "node:test";
import { runInNewContext, runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import {
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
  requireReadyRepositoryRuntimeDataArea,
} from "../../../domain-model/src/index.ts";
import { startWindowsChildTreeTermination } from "../../../platform-access/src/index.ts";
import * as controller from "../../src/execution/observation.ts";
import * as locks from "../../src/execution/kernel-lock.ts";
import * as hostRuntime from "../../src/execution/operation.ts";
import { loadHostRecoveryRecordByToken } from "../../src/execution/recovery.ts";
import * as homes from "../../src/execution/authority.ts";
import * as repository from "../../src/execution/operation.ts";
import * as stateModel from "../../src/storage/state.ts";
import * as historyValues from "../../../domain-model/src/index.ts";

import * as stateRuntime from "../../src/storage/state.ts";
import * as development from "../../src/execution/diagnostics.ts";
import * as isolation from "../../../docker-isolation/src/index.ts";
import { runDockerRuntimeRepairSessionUsing } from "../../../docker-isolation/src/docker-desktop/repair-session.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";

/**
 * 実初期SnapshotでHost清掃の段階別故障反応を評価する。
 * @responsibility 実Source・実modelの論理反証を実Kernel／Filesystem故障と区別する。
 * @trace ERB-IT-003
 * @trace PRL-IT-013
 * @precondition 自己生成Repositoryの初期操作と対象exact IDをcodecで確認できる。
 * @stimulus 同一realmで本番五関数を評価し、下位観測・保存・Host返却だけへ故障を注入する。
 * @observation 到達一回、保存要求／反映、Host要求、現在本文、私有Ownerの停止状態。
 * @oracle 既発生Effectを保持し、段階別の後続0と非対象保全を要求する。
 * @cleanup N/A: メモリ評価だけ。実Source・保存本文・Kernel・Hostを変更しない。
 * @boundary 本番Host清掃Ownerと下位Reader／Writer／Host観測の論理接続。
 */
function verifyCurrentHostCleanupFailureBoundaries(
  snapshot: CoordinatorStateSnapshot,
  recoveryId: string,
): void {
  const source = fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const names = [
    "assertCurrentRecoveryOwner",
    "persistRuntimeOwnedDockerTaskRecoveryCheckpoint",
    "isUnsubmittedInitialTaskHost",
    "confirmRuntimeOwnedDockerTaskHostAbsence",
    "cleanupRuntimeOwnedDockerTaskHost",
  ];
  const bodies = names.map((name) => {
    const needle = `function ${name}(`;
    assert.equal(source.split(needle).length, 2);
    const start = source.indexOf(needle);
    const end = source.indexOf("\n/**", start);
    assert.ok(start > 0 && end > start);
    return stripTypeScriptTypes(source.slice(start, end));
  });
  const body = bodies.join("\n");
  const cleanupBody = bodies.at(-1);
  assert.ok(cleanupBody);
  const beforeEffectStart = cleanupBody.indexOf("const beforeEffect =");
  assert.ok(beforeEffectStart > 0);
  const beforeEffectEnd = cleanupBody.indexOf(
    "const result = recoverOwnedOperationDirectories",
    beforeEffectStart,
  );
  assert.ok(beforeEffectEnd > beforeEffectStart);
  const guarded = cleanupBody.slice(beforeEffectStart, beforeEffectEnd);
  const guard = "!assertCurrentRecoveryOwner(capability, record)";
  assert.equal(guarded.split(guard).length, 2);
  const mutantCleanup =
    cleanupBody.slice(0, beforeEffectStart) +
    guarded.replace(guard, "false") +
    cleanupBody.slice(beforeEffectEnd);
  const mutantBody = [...bodies.slice(0, -1), mutantCleanup].join("\n");
  assert.notEqual(mutantBody, body);
  const initialBytes = Buffer.from(`${encodeRuntimeStateValue(snapshot)}\n`);
  const verified = stateModel.decodeCoordinatorStateSnapshot(
    initialBytes,
    snapshot.repositoryBinding,
  );
  assert.ok(verified);
  const found = verified.snapshot.operations.find(
    (item): item is CoordinatorStateTaskOperation =>
      item.kind === "docker_task" && item.recoveryId === recoveryId,
  );
  assert.ok(found);
  const target: CoordinatorStateTaskOperation = found;
  const identity = JSON.parse(target.identityJson);
  const retiredCandidate = stateModel.prepareCoordinatorStateLifecycleSnapshot(
    initialBytes,
    recoveryId,
    {
      phase: "settling",
      lease: target.lease,
      execution: { ...target.execution, ownerEffect: "disabled" },
      primaryFailure: target.primaryFailure,
      outcome: target.outcome,
      summarySha256: target.summarySha256,
    },
    snapshot.repositoryBinding,
  );
  assert.ok(retiredCandidate);
  const retired: Buffer = retiredCandidate;
  const pendingCandidate = stateModel.prepareCoordinatorStateHostSnapshot(
    retired,
    recoveryId,
    { ...target.host, cleanup: "pending" },
    snapshot.repositoryBinding,
  );
  assert.ok(pendingCandidate);
  const pending: Buffer = pendingCandidate;
  const scenarios = [
    "normal",
    "already_pending",
    "root_before_effect",
    "lock_before_effect",
    "generation_before_effect",
    "version_before_effect",
    "pending_refused",
    "pending_throw",
    "pending_unconfirmed",
    "pending_release_unknown",
    "pending_readback_stale",
    "pending_readback_lock",
    "pending_readback_throw",
    "cleanup_blocked",
    "cleanup_throw",
    "cleanup_observation_unknown",
    "root_after_cleanup",
    "lock_after_cleanup",
    "confirmed_refused",
    "confirmed_throw",
    "confirmed_unconfirmed",
    "confirmed_release_unknown",
    "confirmed_readback_stale",
    "confirmed_readback_lock",
    "confirmed_readback_throw",
    "confirmed_readback_sha",
  ];
  /**
   * 一故障だけの独立した私有Ownerと保存代役を組み立てる。
   * @responsibility 反映済みcurrentとOwnerの確認済みbeforeを分けて観測する。
   * @trace ERB-IT-003
   * @trace PRL-IT-013
   * @precondition 同一realmへ一つのcapability／recordを登録する。
   * @stimulus 指定段階で一回だけ故障し、必要時は削除直前guardだけを省略する。
   * @observation 本文・改訂・Hash、各要求数、故障到達とsticky停止。
   * @oracle 保存後不明を旧版不変にせず、既知反映を保ったまま追加処置を止める。
   * @cleanup N/A: 全状態はこの呼出し内のメモリだけに閉じる。
   * @boundary 実Sourceの論理的な下位要求境界。OS故障成立は主張しない。
   */
  function evaluateScenario(mode: string, mutation = false) {
    let currentBytes: Buffer = Buffer.from(
      mode === "already_pending" ? pending : retired,
    );
    let rootLive = true,
      lockLive = true,
      generationLive = true;
    let physicalRoot = "present",
      physicalMarker = "present";
    let reads = 0,
      reached = 0,
      hostRequests = 0,
      pendingRequests = 0,
      pendingCommits = 0,
      finalRequests = 0,
      finalCommits = 0;
    const capability = Object.freeze({}),
      generation = Object.freeze({}),
      rootCapability = Object.freeze({});
    const record = {
      kind: "recovery",
      closed: false,
      persistenceFailed: false,
      cleanupUnknown: false,
      hostCleanup: "present",
      hostCleanupPublication: null,
      rootCapability,
      recoveryId,
      before: Buffer.from(currentBytes),
      hostToken: target.host.currentToken,
      hostRoot: identity.hostPaths.root,
      hostNonce: identity.initialHostRecoveryId.split(".")[2],
      hostGeneration: generation,
      repository: {
        repositoryBinding: snapshot.repositoryBinding,
        revalidate: () => rootLive,
      },
      locks: [{ assertLive: () => lockLive }],
    };
    const preparations = new WeakMap([[capability, record]]);
    /**
     * 現在本文の代役から実codec結果を返す。
     * @responsibility 故障段階だけを一回変え、保存済み本文を暗黙に戻さない。
     * @trace PRL-IT-013
     * @precondition currentBytesは実modelの有効候補である。
     * @stimulus pending読戻し、削除直前、confirmed読戻しで指定故障を与える。
     * @observation decode結果・lockReleasedと到達数。
     * @oracle 実Readerの成功や実排他成立を代役の返却から主張しない。
     * @cleanup N/A: メモリ観測だけ。
     * @boundary Reader返却契約の論理故障。
     */
    function readSnapshot() {
      reads++;
      const stage =
        pendingRequests > 0 && finalRequests === 0 && reads === 2
          ? "pending"
          : finalCommits > 0
            ? "confirmed"
            : null;
      if (reads === 3 && finalRequests === 0) {
        if (mode === "root_before_effect") {
          rootLive = false;
          reached++;
        }
        if (mode === "lock_before_effect") {
          lockLive = false;
          reached++;
        }
        if (mode === "generation_before_effect") {
          generationLive = false;
          reached++;
        }
        if (mode === "version_before_effect") {
          const candidate = stateModel.prepareCoordinatorStateHostSnapshot(
            currentBytes,
            recoveryId,
            { ...target.host, cleanup: "pending" },
            snapshot.repositoryBinding,
          );
          assert.ok(candidate);
          currentBytes = candidate;
          reached++;
        }
      }
      if (stage && mode === `${stage}_readback_throw`) {
        reached++;
        throw new Error("injected_readback");
      }
      let bytes = currentBytes;
      if (stage && mode === `${stage}_readback_stale`) {
        reached++;
        bytes = stage === "pending" ? retired : pending;
      }
      const value = stateModel.decodeCoordinatorStateSnapshot(
        bytes,
        snapshot.repositoryBinding,
      );
      assert.ok(value);
      let lockReleased = true;
      if (stage && mode === `${stage}_readback_lock`) {
        reached++;
        lockReleased = false;
      }
      if (stage === "confirmed" && mode === "confirmed_readback_sha") {
        reached++;
        return {
          status: "completed",
          lockReleased,
          value: { ...value, payloadSha256: "0".repeat(64) },
        };
      }
      return { status: "completed", lockReleased, value };
    }
    const dependencies = {
      coordinatorTaskResourcesAreSettled: coordinatorTaskResourcesAreSettled,
      isDockerRestartCheckpointSettled,
      dockerRecoveryPreparations: preparations,
      encodeRuntimeStateValue: encodeRuntimeStateValue,
      decodeCoordinatorStateSnapshot: stateModel.decodeCoordinatorStateSnapshot,
      prepareCoordinatorStateOperationSnapshot:
        stateModel.prepareCoordinatorStateOperationSnapshot,
      prepareCoordinatorStateHostSnapshot:
        stateModel.prepareCoordinatorStateHostSnapshot,
      verifyHostOperationRecoveryGeneration: (
        owner: object,
        root: string,
        nonce: string,
      ) => {
        assert.equal(owner, generation);
        assert.equal(root, record.hostRoot);
        assert.equal(nonce, record.hostNonce);
        if (!generationLive) throw new Error("injected_generation_loss");
      },
      loadHostRecoveryRecordByToken: (token: string, root: string) => {
        assert.equal(token, record.hostToken);
        assert.equal(root, record.hostRoot);
        return {
          parsed: { nonce: record.hostNonce },
          record: { state: "host_only" },
        };
      },
      observeHostRecoveryCleanup: () => ({
        root: physicalRoot,
        marker: physicalMarker,
      }),
      readRuntimeOwnedCoordinatorRecoverySnapshot: readSnapshot,
      readRuntimeOwnedCoordinatorHostCleanupRecoverySnapshot: readSnapshot,
      writeRuntimeOwnedCoordinatorRecoveryCheckpoint: (
        repositoryOwner: object,
        id: string,
        before: Buffer,
        kind: string,
        value: unknown,
        assertOwner: () => boolean,
      ) => {
        pendingRequests++;
        assert.equal(repositoryOwner, record.repository);
        assert.equal(id, recoveryId);
        assert.equal(kind, "host");
        assert.deepEqual(before, currentBytes);
        assert.equal(assertOwner(), true);
        if (mode === "pending_throw") {
          reached++;
          throw new Error("injected_pending_writer");
        }
        if (mode === "pending_refused") {
          reached++;
          return {
            status: "blocked",
            snapshotConfirmed: false,
            lockReleased: true,
          };
        }
        const candidate = stateModel.prepareCoordinatorStateHostSnapshot(
          currentBytes,
          recoveryId,
          value,
          snapshot.repositoryBinding,
        );
        assert.ok(candidate);
        currentBytes = candidate;
        pendingCommits++;
        const saved = stateModel.decodeCoordinatorStateSnapshot(
          currentBytes,
          snapshot.repositoryBinding,
        );
        assert.ok(saved);
        if (
          mode === "pending_unconfirmed" ||
          mode === "pending_release_unknown"
        )
          reached++;
        return {
          status: "completed",
          snapshotConfirmed: mode !== "pending_unconfirmed",
          lockReleased: mode !== "pending_release_unknown",
          revision: saved.snapshot.revision,
          payloadSha256: saved.payloadSha256,
        };
      },
      recoverOwnedOperationDirectories: (
        token: string,
        owner: object,
        root: string,
      ) => {
        hostRequests++;
        assert.equal(token, record.hostToken);
        assert.equal(owner, generation);
        assert.equal(root, record.hostRoot);
        if (mode === "cleanup_throw") {
          reached++;
          throw new Error("injected_cleanup");
        }
        if (mode === "cleanup_blocked") {
          reached++;
          return { status: "blocked" };
        }
        physicalRoot = "absent";
        physicalMarker = "absent";
        if (mode === "cleanup_observation_unknown") {
          reached++;
          physicalRoot = "unknown";
        }
        if (mode === "root_after_cleanup") {
          reached++;
          rootLive = false;
        }
        if (mode === "lock_after_cleanup") {
          reached++;
          lockLive = false;
        }
        return { status: "recovered" };
      },
      writeRuntimeOwnedCoordinatorRecoveredHostCleanup: (
        repositoryOwner: object,
        id: string,
        before: Buffer,
        assertOwner: () => boolean,
      ) => {
        finalRequests++;
        assert.equal(repositoryOwner, record.repository);
        assert.equal(id, recoveryId);
        assert.deepEqual(before, currentBytes);
        assert.equal(assertOwner(), true);
        if (mode === "confirmed_throw") {
          reached++;
          throw new Error("injected_final_writer");
        }
        if (mode === "confirmed_refused") {
          reached++;
          return {
            status: "blocked",
            snapshotConfirmed: false,
            lockReleased: true,
          };
        }
        const candidate = stateModel.prepareCoordinatorStateHostSnapshot(
          currentBytes,
          recoveryId,
          { ...target.host, cleanup: "confirmed" },
          snapshot.repositoryBinding,
        );
        assert.ok(candidate);
        currentBytes = candidate;
        finalCommits++;
        const saved = stateModel.decodeCoordinatorStateSnapshot(
          currentBytes,
          snapshot.repositoryBinding,
        );
        assert.ok(saved);
        if (
          mode === "confirmed_unconfirmed" ||
          mode === "confirmed_release_unknown"
        )
          reached++;
        return {
          status: "completed",
          snapshotConfirmed: mode !== "confirmed_unconfirmed",
          lockReleased: mode !== "confirmed_release_unknown",
          revision: saved.snapshot.revision,
          payloadSha256: saved.payloadSha256,
        };
      },
    };
    const runtime = runInThisContext(`(function(dependencies) {
      const { ${Object.keys(dependencies).join(",")} } = dependencies;
      ${mutation ? mutantBody : body}
      return { confirm: confirmRuntimeOwnedDockerTaskHostAbsence, cleanup: cleanupRuntimeOwnedDockerTaskHost };
    })`)(dependencies);
    assert.equal(runtime.confirm(capability), true);
    assert.equal(hostRequests, 0);
    assert.equal(pendingRequests, 0);
    assert.equal(finalRequests, 0);
    reads = 0;
    const result = runtime.cleanup(capability);
    const value = stateModel.decodeCoordinatorStateSnapshot(
      currentBytes,
      snapshot.repositoryBinding,
    );
    assert.ok(value);
    assert.deepEqual(
      value.snapshot.operations.filter(
        (item) => item.recoveryId !== recoveryId,
      ),
      snapshot.operations.filter((item) => item.recoveryId !== recoveryId),
    );
    assert.deepEqual(
      value.snapshot.unresolvedRecoveries,
      snapshot.unresolvedRecoveries,
    );
    assert.deepEqual(
      value.snapshot.pendingDeliveries,
      snapshot.pendingDeliveries,
    );
    assert.equal(
      value.snapshot.operations.some((item) => item.recoveryId === recoveryId),
      true,
    );
    const operation = value.snapshot.operations.find(
      (item): item is CoordinatorStateTaskOperation =>
        item.kind === "docker_task" && item.recoveryId === recoveryId,
    );
    assert.ok(operation);
    const sticky = record.persistenceFailed || record.cleanupUnknown;
    if (sticky) {
      rootLive = true;
      lockLive = true;
      generationLive = true;
      const counts = [
        pendingRequests,
        finalRequests,
        hostRequests,
        pendingCommits,
        finalCommits,
      ];
      assert.equal(runtime.cleanup(capability), false);
      assert.deepEqual(
        [
          pendingRequests,
          finalRequests,
          hostRequests,
          pendingCommits,
          finalCommits,
        ],
        counts,
      );
    }
    return {
      result,
      reached,
      hostRequests,
      pendingRequests,
      pendingCommits,
      finalRequests,
      finalCommits,
      physicalRoot,
      physicalMarker,
      currentBytes: Buffer.from(currentBytes),
      privateBefore: Buffer.from(record.before),
      cleanup: operation.host.cleanup,
      privateCleanup: JSON.parse(record.before.toString()).operations.find(
        (item: { recoveryId: string }) => item.recoveryId === recoveryId,
      ).host.cleanup,
      sticky,
    };
  }
  /**
   * 実行結果から独立した期待版へ状態全文を照合する。
   * @responsibility 同じcleanup値の別版や元版Hash差を見逃さない。
   * @trace PRL-IT-013
   * @precondition 期待本文は故障段階から実modelで導出する。
   * @stimulus 現在本文またはOwner確認済み本文を渡す。
   * @observation 全文bytes、revision、previous、payloadSha256。
   * @oracle 期待版と全項目が一致する。
   * @cleanup N/A: メモリ比較のみ。
   * @boundary 論理保存候補。物理Writerの耐久性は主張しない。
   */
  function assertSnapshotBytes(actual: Buffer, expected: Buffer, mode: string) {
    const actualValue = stateModel.decodeCoordinatorStateSnapshot(
      actual,
      snapshot.repositoryBinding,
    );
    const expectedValue = stateModel.decodeCoordinatorStateSnapshot(
      expected,
      snapshot.repositoryBinding,
    );
    assert.ok(actualValue, mode);
    assert.ok(expectedValue, mode);
    assert.deepEqual(actual, expected, mode);
    assert.deepEqual(actualValue.snapshot, expectedValue.snapshot, mode);
    assert.equal(
      actualValue.snapshot.revision,
      expectedValue.snapshot.revision,
      mode,
    );
    assert.deepEqual(
      actualValue.snapshot.previous,
      expectedValue.snapshot.previous,
      mode,
    );
    assert.equal(actualValue.payloadSha256, expectedValue.payloadSha256, mode);
  }
  const confirmed = stateModel.prepareCoordinatorStateHostSnapshot(
    pending,
    recoveryId,
    { ...target.host, cleanup: "confirmed" },
    snapshot.repositoryBinding,
  );
  const extraPending = stateModel.prepareCoordinatorStateHostSnapshot(
    pending,
    recoveryId,
    { ...target.host, cleanup: "pending" },
    snapshot.repositoryBinding,
  );
  assert.ok(confirmed);
  assert.ok(extraPending);
  for (const mode of scenarios) {
    const result = evaluateScenario(mode);
    const normal = mode === "normal" || mode === "already_pending";
    assert.equal(result.result, normal, mode);
    assert.equal(result.reached, normal ? 0 : 1, mode);
    const beforeHost =
      mode.includes("before_effect") || mode.startsWith("pending_");
    assert.equal(result.hostRequests, beforeHost ? 0 : 1, mode);
    const afterHostFailure =
      mode.startsWith("cleanup_") || mode.endsWith("after_cleanup");
    assert.equal(
      result.finalRequests,
      beforeHost || afterHostFailure ? 0 : 1,
      mode,
    );
    assert.equal(
      result.pendingRequests,
      mode === "already_pending" ? 0 : 1,
      mode,
    );
    assert.equal(
      result.pendingCommits,
      mode === "already_pending" ||
        mode === "pending_refused" ||
        mode === "pending_throw"
        ? 0
        : 1,
      mode,
    );
    const finalCommitted =
      normal ||
      (mode.startsWith("confirmed_") &&
        mode !== "confirmed_refused" &&
        mode !== "confirmed_throw");
    assert.equal(result.finalCommits, finalCommitted ? 1 : 0, mode);
    const expectedCurrent = finalCommitted
      ? confirmed
      : mode === "pending_refused" || mode === "pending_throw"
        ? retired
        : mode === "version_before_effect"
          ? extraPending
          : pending;
    const expectedBefore = normal
      ? confirmed
      : mode.startsWith("pending_")
        ? retired
        : pending;
    assertSnapshotBytes(result.currentBytes, expectedCurrent, mode);
    assertSnapshotBytes(result.privateBefore, expectedBefore, mode);
    assert.equal(
      result.cleanup,
      finalCommitted
        ? "confirmed"
        : result.pendingCommits
          ? "pending"
          : "not_requested",
      mode,
    );
    assert.equal(
      result.privateCleanup,
      normal
        ? "confirmed"
        : mode.startsWith("pending_")
          ? "not_requested"
          : "pending",
      mode,
    );
    if (beforeHost || mode === "cleanup_blocked" || mode === "cleanup_throw") {
      assert.equal(result.physicalRoot, "present", mode);
      assert.equal(result.physicalMarker, "present", mode);
    } else {
      assert.equal(
        result.physicalRoot,
        mode === "cleanup_observation_unknown" ? "unknown" : "absent",
        mode,
      );
      assert.equal(result.physicalMarker, "absent", mode);
    }
    if (!normal && mode !== "root_after_cleanup")
      assert.equal(result.sticky, true, mode);
  }
  assert.equal(scenarios.length, 26);
  assert.throws(() =>
    assertSnapshotBytes(extraPending, pending, "extra_version"),
  );
  const changedHashSnapshot = JSON.parse(pending.toString());
  assert.ok(changedHashSnapshot.previous);
  changedHashSnapshot.previous.payloadSha256 = "0".repeat(64);
  const changedHashBytes = Buffer.from(
    `${encodeRuntimeStateValue(changedHashSnapshot)}\n`,
  );
  assert.ok(
    stateModel.decodeCoordinatorStateSnapshot(
      changedHashBytes,
      snapshot.repositoryBinding,
    ),
  );
  assert.throws(() =>
    assertSnapshotBytes(changedHashBytes, pending, "changed_previous_hash"),
  );
  const changed = evaluateScenario("lock_before_effect", true);
  assert.equal(changed.reached, 1);
  assert.equal(changed.hostRequests, 1);
  assert.throws(() => assert.equal(changed.hostRequests, 0));
}

/**
 * 自己生成子の観測条件を有界待機する。
 * @responsibility 待機期限をcloseまたは成功へ読み替えない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 呼出し元が子の所有と回収を維持する。
 * @stimulus 局所観測を10ms間隔で確認する。
 * @observation 条件成立または期限例外。
 * @oracle 期限まで未成立なら失敗する。
 * @cleanup 各待機timerは解決後に残らない。
 * @boundary 同Process内の試験待機。
 */
async function waitForOwnedProcessObservation(
  observed: () => boolean,
  timeoutMs: number,
) {
  const deadline = Date.now() + timeoutMs;
  while (!observed()) {
    assert.ok(Date.now() < deadline, "owned_process_observation_timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

/**
 * 同期readyを通知した自己生成子を、外部親が既存のtree終端処理で終了する。
 * @responsibility ready、生存、終了要求、補助close、元子closeとstdio終了を分離する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 自己生成Repositoryと固定workerだけを渡す。
 * @stimulus 親から所有ChildProcessへ終了要求を一回だけ発行する。
 * @observation 同PIDの単一packet、終了値、元子と補助子のclose。
 * @oracle 生存readyと終端全確認の後だけ、呼出し元がfresh回復へ進める。
 * @cleanup 失敗時も同じ子・補助子を有界joinし、不明時はRootを保持する。
 * @boundary 実Windows Process。Docker・Providerは呼び出さない。
 */
async function runExternallyTerminatedProducer(worker: string, root: string) {
  const child = spawn(
    process.execPath,
    ["--experimental-test-module-mocks", worker, "parent_terminated"],
    {
      cwd: root,
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let stdout = "";
  let stderr = "";
  let closed = false;
  let status: number | null = null;
  let signal: NodeJS.Signals | null = null;
  let processError: Error | undefined;
  let primaryFailure: unknown;
  let cleanupFailure: unknown;
  let outcome: {
    status: number | null;
    signal: NodeJS.Signals | null;
    error: undefined;
    stdout: string;
    stderr: string;
    pid: number | undefined;
    parentTerminationConfirmed: true;
  } | null = null;
  let termination: ReturnType<typeof startWindowsChildTreeTermination> = null;
  let terminationRequests = 0;
  let cleanupFallbackIssued = false;
  let cleanupFallbackAccepted: boolean | null = null;
  /**
   * 所有子のstdoutを64KiB以内だけ捕捉する。
   * @responsibility 所有子のstdoutを64KiB以内だけ捕捉する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition 同じChildProcessの出力監視を登録している。
   * @stimulus 文字列chunkを受け取り累積容量を検査する。
   * @observation stdout本文と固定owned_producer_output_limit例外。
   * @oracle 上限超過を本文へ追加せずprocessErrorとして保持する。
   * @cleanup 所有子のjoin後に同じdata Listenerを解除する。
   * @boundary 実Windows子のstdio。秘密や無制限本文の収集に使わない。
   */
  const onOutput = (chunk: string) => {
    if (Buffer.byteLength(stdout) + Buffer.byteLength(chunk) > 64 * 1024)
      processError = new Error("owned_producer_output_limit");
    else stdout += chunk;
  };
  /**
   * 所有子のstderrを64KiB以内だけ捕捉する。
   * @responsibility 所有子のstderrを64KiB以内だけ捕捉する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition 同じChildProcessの出力監視を登録している。
   * @stimulus 文字列chunkを受け取り累積容量を検査する。
   * @observation stderr本文と固定owned_producer_error_limit例外。
   * @oracle 上限超過を本文へ追加せずprocessErrorとして保持する。
   * @cleanup 所有子のjoin後に同じdata Listenerを解除する。
   * @boundary 実Windows子のstdio。秘密や無制限本文の収集に使わない。
   */
  const onDiagnostic = (chunk: string) => {
    if (Buffer.byteLength(stderr) + Buffer.byteLength(chunk) > 64 * 1024)
      processError = new Error("owned_producer_error_limit");
    else stderr += chunk;
  };
  /**
   * 所有子のProcess errorを終了観測へ保持する。
   * @responsibility 所有子のProcess errorを終了観測へ保持する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition 同じ所有子のerror購読。
   * @stimulus 通知されたErrorをprocessErrorへ保存する。
   * @observation 返却または例外化されるProcess失敗。
   * @oracle closeだけから成功を推定せずerrorを参照する。
   * @cleanup 終了待機後に同じerror Listenerを解除する。
   * @boundary 所有ChildProcessの通知。DockerやProviderは起動しない。
   */
  const onError = (error: Error) => {
    processError = error;
  };
  const onClose = (
    code: number | null,
    receivedSignal: NodeJS.Signals | null,
  ) => {
    status = code;
    signal = receivedSignal;
    closed = true;
  };
  child.stdout.setEncoding("utf8").on("data", onOutput).on("error", onError);
  child.stderr
    .setEncoding("utf8")
    .on("data", onDiagnostic)
    .on("error", onError);
  child.once("error", onError);
  child.once("close", onClose);
  try {
    await waitForOwnedProcessObservation(
      () => stdout.includes("\n") || closed || processError !== undefined,
      90_000,
    );
    assert.equal(processError, undefined);
    assert.equal(closed, false);
    assert.equal(child.exitCode, null);
    assert.equal(child.signalCode, null);
    const lines = stdout.split("\n");
    assert.equal(lines.length, 2);
    assert.equal(lines[1], "");
    const packet = JSON.parse(lines[0] ?? "");
    assert.equal(packet.pid, child.pid);
    assert.equal(packet.phase, "parent_terminated");
    assert.equal(packet.operationRoot, root);
    assert.match(
      packet.recoveryId,
      /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u,
    );
    termination = startWindowsChildTreeTermination(child);
    assert.ok(termination);
    terminationRequests++;
    assert.equal(await termination.started(10_000), true);
    const result = await termination.wait(10_000);
    assert.ok(result);
    assert.equal(result.status, 0);
    assert.equal(result.signal, null);
    assert.equal(result.outputExceeded, false);
    assert.equal(termination.closed(), true);
    await waitForOwnedProcessObservation(() => closed, 10_000);
    assert.equal(child.stdout.readableEnded, true);
    assert.equal(child.stderr.readableEnded, true);
    assert.equal(processError, undefined);
    assert.equal(stdout.split("\n").length, 2);
    assert.equal(terminationRequests, 1);
    outcome = {
      status,
      signal,
      error: processError,
      stdout,
      stderr,
      pid: child.pid,
      parentTerminationConfirmed: true,
    };
  } catch (error) {
    primaryFailure = error;
  } finally {
    try {
      if (
        !closed &&
        !termination &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
        termination = startWindowsChildTreeTermination(child);
        if (termination) terminationRequests++;
      }
      if (termination) {
        assert.equal(await termination.terminateAndWait(10_000), true);
        assert.equal(termination.closed(), true);
      }
    } catch (error) {
      cleanupFailure = error;
    }
    try {
      if (!closed) {
        cleanupFallbackIssued = true;
        cleanupFallbackAccepted = child.kill("SIGKILL");
        assert.equal(cleanupFallbackAccepted, true);
      }
      await waitForOwnedProcessObservation(() => closed, 10_000);
      assert.equal(child.stdout.readableEnded, true);
      assert.equal(child.stderr.readableEnded, true);
    } catch (error) {
      cleanupFailure ??= error;
    } finally {
      child.stdout.off("data", onOutput).off("error", onError);
      child.stderr.off("data", onDiagnostic).off("error", onError);
      child.off("error", onError);
      child.off("close", onClose);
    }
  }
  if (cleanupFallbackIssued && primaryFailure === undefined)
    primaryFailure = new Error(
      "owned_producer_cleanup_fallback_not_positive_proof",
    );
  if (primaryFailure !== undefined || cleanupFailure !== undefined)
    throw Object.assign(
      new AggregateError(
        [primaryFailure, cleanupFailure].filter((value) => value !== undefined),
        "owned_producer_termination_unconfirmed",
      ),
      { cleanupFallbackIssued, cleanupFallbackAccepted, childClosed: closed },
    );
  assert.ok(outcome);
  return outcome;
}

/**
 * 親終端helperの実本文へ閉じたProcess通知を与える。
 * @responsibility 実Hostの正例と、要求・close・失敗時清掃の論理反証を分離する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 実本文と既知の一故障だけを選ぶ。
 * @stimulus 補助の拒否・非0・timeout、元子close／stdio欠測、遅延closeを与える。
 * @observation 終端要求、fallback、同じ子、利用側への成功搬送とlistener数。
 * @oracle 不明な元子終了から成功を返さず、一次失敗と清掃失敗を保持する。
 * @cleanup VM・局所EventEmitterだけで実Processを作成しない。
 * @boundary 本番同等の試験helper本文と模擬Process通知。実tree終了の証明ではない。
 */
async function evaluateParentTerminationScenario(
  mode:
    | "delayed_close"
    | "helper_null"
    | "helper_nonzero"
    | "helper_timeout"
    | "missing_close"
    | "missing_stdio"
    | "fallback_failure",
  source = stripTypeScriptTypes(runExternallyTerminatedProducer.toString()),
) {
  const output = Object.assign(new EventEmitter(), { readableEnded: false });
  const diagnostic = Object.assign(new EventEmitter(), {
    readableEnded: false,
  });
  Object.assign(output, { setEncoding: () => output });
  Object.assign(diagnostic, { setEncoding: () => diagnostic });
  const calls: string[] = [];
  let closed = false;
  let fallbackCalls = 0;
  let freshConsumerCalls = 0;
  let observations = 0;
  const child = Object.assign(new EventEmitter(), {
    pid: 12345,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    stdout: output,
    stderr: diagnostic,
    kill: () => {
      fallbackCalls++;
      calls.push("fallback");
      if (mode === "fallback_failure") return false;
      finish(true);
      return true;
    },
  });
  /**
   * 模擬した元子のcloseとstdioを別々に通知する。
   * @responsibility exitだけでcloseを成立させない。
   * @trace ERB-IT-003
   * @precondition この局所fixtureの子だけを対象とする。
   * @stimulus stdioを指定状態へ設定後closeを通知する。
   * @observation readableEnded、exitCode、close。
   * @oracle stdio=falseはclose後も未完了として残る。
   * @cleanup N/A: 実資源なし。
   * @boundary EventEmitter内。
   */
  function finish(stdio: boolean) {
    output.readableEnded = stdio;
    diagnostic.readableEnded = stdio;
    child.exitCode = 1;
    closed = true;
    child.emit("close", 1, null);
  }
  const candidate = runInNewContext(`(${source})`, {
    assert,
    Buffer,
    process: { execPath: "fixed-node" },
    spawn: () => {
      queueMicrotask(() =>
        output.emit(
          "data",
          `${JSON.stringify({ pid: child.pid, phase: "parent_terminated", operationRoot: "fixed-root", recoveryId: `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}` })}\n`,
        ),
      );
      return child;
    },
    waitForOwnedProcessObservation: async (observed: () => boolean) => {
      await Promise.resolve();
      observations++;
      calls.push(observations === 1 ? "wait_ready" : "wait_close");
      if (mode === "delayed_close" && observations === 2) finish(true);
      if (!observed()) throw new Error("fixture_observation_unconfirmed");
    },
    startWindowsChildTreeTermination: (value: unknown) => {
      assert.equal(value, child);
      calls.push("terminate");
      if (mode === "helper_null") return null;
      return {
        started: async () => true,
        wait: async () => {
          calls.push("helper_wait");
          if (mode === "helper_timeout") return null;
          if (mode === "missing_stdio") finish(false);
          if (mode === "missing_close") child.exitCode = 1;
          return {
            status: mode === "helper_nonzero" ? 1 : 0,
            signal: null,
            outputExceeded: false,
          };
        },
        closed: () => true,
        terminateAndWait: async () => true,
      };
    },
  }) as typeof runExternallyTerminatedProducer;
  let result: Awaited<ReturnType<typeof candidate>> | null = null;
  let error: unknown;
  try {
    result = await candidate("fixed-worker", "fixed-root");
    freshConsumerCalls++;
  } catch (failure) {
    error = failure;
  }
  assert.deepEqual(child.eventNames(), []);
  assert.deepEqual(output.eventNames(), []);
  assert.deepEqual(diagnostic.eventNames(), []);
  return { result, error, calls, closed, fallbackCalls, freshConsumerCalls };
}

/**
 * 親終了の成功証拠と負例時の清掃を独立に反証する。
 * @responsibility 補助成功・exitだけで元子closeや利用側再開を成立させない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 実helper本文を同realmの局所通知へ接続する。
 * @stimulus 五拒否形、fallback失敗、遅延closeと二つの省略変異。
 * @observation 正常返却、元primary／cleanup、fallback回数、利用側到達とlistener終了。
 * @oracle 完全な遅延closeだけ成功、失敗後のfallback成功は非成功のまま。
 * @cleanup 実Process／Filesystem／Dockerを生成しない。
 * @boundary 親試験helperの局所反証。実Host結果とは分離する。
 */
test("親終了は補助失敗と元子close／stdio欠測を成功へ補完しない", async () => {
  const positive = await evaluateParentTerminationScenario("delayed_close");
  assert.ok(positive.result);
  assert.equal(positive.error, undefined);
  assert.equal(positive.fallbackCalls, 0);
  assert.equal(positive.freshConsumerCalls, 1);
  assert.deepEqual(positive.calls, [
    "wait_ready",
    "terminate",
    "helper_wait",
    "wait_close",
    "wait_close",
  ]);
  for (const mode of [
    "helper_null",
    "helper_nonzero",
    "helper_timeout",
    "missing_close",
    "missing_stdio",
    "fallback_failure",
  ] as const) {
    const negative = await evaluateParentTerminationScenario(mode);
    assert.equal(negative.result, null);
    assert.ok(negative.error);
    assert.equal(negative.freshConsumerCalls, 0);
    assert.equal(negative.fallbackCalls, mode === "missing_stdio" ? 0 : 1);
    assert.equal(negative.closed, mode !== "fallback_failure");
    const errors = (negative.error as { errors: unknown[] }).errors;
    assert.equal(
      errors.length,
      mode === "missing_stdio" || mode === "fallback_failure" ? 2 : 1,
    );
  }
  const source = stripTypeScriptTypes(
    runExternallyTerminatedProducer.toString(),
  );
  const request = "termination = startWindowsChildTreeTermination(child);";
  assert.ok(source.includes(request));
  const noRequest = await evaluateParentTerminationScenario(
    "delayed_close",
    source.replace(request, "termination = null;"),
  );
  assert.equal(noRequest.result, null);
  assert.equal(noRequest.freshConsumerCalls, 0);
  const close =
    /await waitForOwnedProcessObservation\(\(\) => closed, 10_000\);\s*assert.equal\(child.stdout.readableEnded, true\);\s*assert.equal\(child.stderr.readableEnded, true\);/u;
  assert.ok(close.test(source));
  const noClose = await evaluateParentTerminationScenario(
    "delayed_close",
    source.replace(close, ""),
  );
  assert.equal(noClose.result, null);
  assert.equal(noClose.freshConsumerCalls, 0);
  assert.equal(noClose.fallbackCalls, 1);
});

/**
 * 放棄した実Ownerの終了後、別Processでexact回復を完了する。
 * @responsibility 排他解放と清掃を区別し、旧Process終了から本番consumerまで結合する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition Windowsと自己生成Repository、五資源未要求の固定Planを使う。
 * @stimulus begin／abandon後、保存直後、Host開始後、清掃観測を省略した正常exitと清掃途中二点の終了から別Processへ接続する。
 * @observation 各子の終了、実state全文と改訂、非対象本文／実体、履歴、Host／markerと短命物を個別確認する。
 * @oracle 放棄またはcleanup_withheldのexitだけでは清掃せず、本番回復後だけ対象を除去し非対象を全文保持する。
 * @cleanup 両子と対象清掃の確認後に自己生成Rootだけを回収し、不明時は保持する。
 * @boundary Process喪失とfresh回復。Home観測だけを模擬し実Dockerは使わない。
 */
for (const producerMode of [
  "producer",
  "state_saved",
  "host_started",
  "cleanup_withheld",
  "parent_terminated",
] as const) {
  /**
   * 放棄した実Ownerの終了後、別Processでexact回復を完了する。
   * @responsibility 排他解放と清掃を区別し、旧Process終了から本番consumerまで結合する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition Windowsと自己生成Repository、五資源未要求の固定Planを使う。
   * @stimulus begin／abandon後、保存直後、Host開始後、清掃観測を省略した正常exitと清掃途中二点の終了から別Processへ接続する。
   * @observation 各子の終了、実state全文と改訂、非対象本文／実体、履歴、Host／markerと短命物を個別確認する。
   * @oracle 放棄またはcleanup_withheldのexitだけでは清掃せず、本番回復後だけ対象を除去し非対象を全文保持する。
   * @cleanup 両子と対象清掃の確認後に自己生成Rootだけを回収し、不明時は保持する。
   * @boundary Process喪失とfresh回復。Home観測だけを模擬し実Dockerは使わない。
   */
  test(`Host Windows: Owner終了境界${producerMode}から別Processの本番回復へ結合する`, async () => {
    const area = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "abandon_owner_test",
    );
    const root = fs.mkdtempSync(path.join(area.directory, "abandon-owner-"));
    let cleanupConfirmed = false;
    try {
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
      const worker = fileURLToPath(
        new URL(
          "../fixtures/docker-recovery-abandon-worker.ts",
          import.meta.url,
        ),
      );
      const producer =
        producerMode === "parent_terminated"
          ? await runExternallyTerminatedProducer(worker, root)
          : spawnSync(
              process.execPath,
              ["--experimental-test-module-mocks", worker, producerMode],
              {
                cwd: root,
                encoding: "utf8",
                windowsHide: true,
                shell: false,
                timeout: 90_000,
                maxBuffer: 64 * 1024,
              },
            );
      assert.equal(producer.error, undefined);
      assert.equal(producer.signal, null);
      assert.equal(
        producer.status,
        producerMode === "producer" || producerMode === "cleanup_withheld"
          ? 0
          : 1,
        producer.stderr,
      );
      const emitted = JSON.parse(producer.stdout);
      if (producerMode === "parent_terminated") {
        assert.ok("parentTerminationConfirmed" in producer);
        assert.equal(producer.parentTerminationConfirmed, true);
      }
      if (
        producerMode === "cleanup_withheld" ||
        producerMode === "parent_terminated"
      ) {
        assert.equal(producer.stdout.trim().split(/\r?\n/u).length, 1);
        assert.equal(emitted.operationRoot, root);
        assert.equal(emitted.cleanupObserved, false);
        assert.equal(emitted.authCreateDockerCalls, 0);
      }
      assert.equal(typeof emitted.pid, "number");
      assert.equal(emitted.pid, producer.pid);
      assert.notEqual(emitted.pid, process.pid);
      if (producerMode === "producer") {
        assert.equal(emitted.generationReleased, true);
        assert.deepEqual(emitted.admissionChecks, [
          "invalid_current",
          "invalid_pending",
          "unknown_entry",
          "same_home_after_read",
          "durable_same_home_after_abandon",
          "root_invalid_after_home_acquire",
        ]);
      } else {
        assert.equal(emitted.phase, producerMode);
        assert.equal(
          emitted.hostStarts,
          producerMode === "state_saved" ? 0 : 1,
        );
        assert.equal("generationReleased" in emitted, false);
        assert.throws(
          () => fs.lstatSync(path.join(root, "unexpected-finally")),
          { code: "ENOENT" },
        );
      }
      const statePath = path.join(root, ".crdd", "coordinator", "state.json");
      const before = JSON.parse(fs.readFileSync(statePath, "utf8"));
      const target = before.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId === emitted.recoveryId,
      );
      assert.ok(target && target.kind === "docker_task");
      assert.equal(before.operations.length, 2);
      assert.equal(target.lease, "held");
      assert.equal(target.execution.ownerEffect, "active");
      if (
        producerMode === "cleanup_withheld" ||
        producerMode === "parent_terminated"
      ) {
        assert.equal(target.resources.length, 5);
        assert.ok(
          target.resources.every(
            (item: { request: string; dockerId: string | null }) =>
              item.request === "not_requested" && item.dockerId === null,
          ),
        );
        assert.equal(target.execution.providerStart, "not_started");
        assert.equal(target.execution.externalSend, "not_issued");
        assert.equal(target.execution.sharedWrite, "not_issued");
      }
      const identity = JSON.parse(target.identityJson);
      assert.equal(identity.operationNonce, emitted.recoveryId.split(".")[2]);
      if (producerMode === "state_saved") {
        verifyCurrentHostCleanupFailureBoundaries(before, emitted.recoveryId);
        const source = fs.readFileSync(
          new URL("../../src/execution/recovery.ts", import.meta.url),
          "utf8",
        );
        const start = source.indexOf("function isUnsubmittedInitialTaskHost(");
        const end = source.indexOf("\n/**", start);
        assert.ok(start > 0 && end > start);
        const body = stripTypeScriptTypes(source.slice(start, end));
        const evaluate = runInThisContext(
          `(function(prepareCoordinatorStateOperationSnapshot, decodeCoordinatorStateSnapshot, encodeRuntimeStateValue, isDockerRestartCheckpointSettled) { ${body}; return isUnsubmittedInitialTaskHost; })`,
        )(
          stateModel.prepareCoordinatorStateOperationSnapshot,
          stateModel.decodeCoordinatorStateSnapshot,
          encodeRuntimeStateValue,
          isDockerRestartCheckpointSettled,
        );
        const comparisonStart = body.lastIndexOf("return (");
        assert.ok(comparisonStart > 0);
        assert.equal(
          body.split("encodeRuntimeStateValue(operation)").length - 1,
          1,
        );
        const comparisonOmitted = `${body.slice(0, comparisonStart)}return true;\n}`;
        assert.notEqual(comparisonOmitted, body);
        const evaluateMutant = runInThisContext(
          `(function(prepareCoordinatorStateOperationSnapshot, decodeCoordinatorStateSnapshot, encodeRuntimeStateValue, isDockerRestartCheckpointSettled) { ${comparisonOmitted}; return isUnsubmittedInitialTaskHost; })`,
        )(
          stateModel.prepareCoordinatorStateOperationSnapshot,
          stateModel.decodeCoordinatorStateSnapshot,
          encodeRuntimeStateValue,
          isDockerRestartCheckpointSettled,
        );
        let legalRejections = 0;
        /**
         * codec合法な非初期操作を同じ拒否Oracleへ渡す。
         * @responsibility codec拒否と初期切断の限定判定を区別し、全文比較省略を検出する。
         * @trace PRL-IT-013
         * @trace ERB-IT-003
         * @precondition 実試験Identityを保持し、一軸だけ変更した操作を受け取る。
         * @stimulus 同じSnapshotへ戻してdecodeし、元判定とメモリ変異へ同じ引数を渡す。
         * @observation decode成功、元判定false、比較省略変異trueと到達数。
         * @oracle 合法負例は元判定だけが拒否し、同じfalse Oracleが変異を検出する。
         * @cleanup N/A: メモリ内だけで実Sourceと保存本文を変更しない。
         * @boundary 保存値の合法性と意味上の初期切断判定。物理Host観測の代用ではない。
         */
        function assertLegalRejected(changed: typeof target): void {
          const candidate = structuredClone(before);
          candidate.operations = candidate.operations.map(
            (item: typeof target) =>
              item.recoveryId === changed.recoveryId ? changed : item,
          );
          const decoded = stateModel.decodeCoordinatorStateSnapshot(
            Buffer.from(`${encodeRuntimeStateValue(candidate)}\n`),
            before.repositoryBinding,
          );
          assert.ok(decoded, "negative_must_be_codec_legal");
          const args = [
            changed,
            decoded.snapshot,
            changed.host.currentToken,
            "host_only",
          ];
          assert.equal(evaluate(...args), false);
          assert.throws(() => assert.equal(evaluateMutant(...args), false));
          legalRejections++;
        }
        const retired = structuredClone(target);
        retired.phase = "settling";
        retired.execution.ownerEffect = "disabled";
        for (const cleanup of ["not_requested", "pending"]) {
          retired.host.cleanup = cleanup;
          assert.equal(
            evaluate(retired, before, retired.host.currentToken, "host_only"),
            true,
          );
        }
        const settledRestart = {
          requestId: createDockerRestartRequestId(
            before.repositoryBinding,
            retired.identitySha256,
            retired.recoveryId,
            "b".repeat(64),
          ),
          scopeSha256: "b".repeat(64),
          request: "unknown",
          cleanup: "confirmed",
          result: {
            status: "blocked",
            reason: "docker_restart_stop_unconfirmed",
            request: "not_issued",
            effectOutcomeUnknown: false,
          },
        };
        const restartGuard =
          "!isDockerRestartCheckpointSettled(operation.dockerRestart)";
        assert.equal(body.split(restartGuard).length - 1, 1);
        const guardMutant = runInThisContext(
          `(function(prepareCoordinatorStateOperationSnapshot, decodeCoordinatorStateSnapshot, encodeRuntimeStateValue, isDockerRestartCheckpointSettled) { ${body.replace(restartGuard, "false")}; return isUnsubmittedInitialTaskHost; })`,
        )(
          stateModel.prepareCoordinatorStateOperationSnapshot,
          stateModel.decodeCoordinatorStateSnapshot,
          encodeRuntimeStateValue,
          isDockerRestartCheckpointSettled,
        );
        const restartOperation = {
          ...retired,
          dockerRestart: settledRestart,
        };
        /**
         * 実操作へ相関した候補の合法性を確認して評価引数へ戻す。
         * @responsibility codec拒否と初期Taskの意味上の拒否を分離する。
         * @trace PRL-IT-013
         * @precondition 同じIdentityを保持した候補操作を受け取る。
         * @stimulus 元Snapshotへ差し戻して実codecで復号する。
         * @observation 復号成功と対象操作の存在。
         * @oracle 不合法な候補をguardの負例として数えない。
         * @cleanup N/A: メモリだけを使用する。
         * @boundary 現在状態codecと純粋な初期Task判定。
         */
        function restartEvaluationArgs(changed: unknown): unknown[] {
          const candidate = structuredClone(before);
          candidate.operations = candidate.operations.map(
            (item: typeof target) =>
              item.recoveryId === retired.recoveryId ? changed : item,
          );
          const decoded = stateModel.decodeCoordinatorStateSnapshot(
            Buffer.from(`${encodeRuntimeStateValue(candidate)}\n`),
            before.repositoryBinding,
          );
          assert.ok(decoded, "restart_candidate_must_be_codec_legal");
          const operation = decoded.snapshot.operations.find(
            (item) => item.recoveryId === retired.recoveryId,
          );
          assert.ok(operation);
          return [
            operation,
            decoded.snapshot,
            retired.host.currentToken,
            "host_only",
          ];
        }
        const restartArgs = restartEvaluationArgs(restartOperation);
        assert.equal(evaluate(...restartArgs), true);
        const changedLeaseArgs = restartEvaluationArgs({
          ...restartOperation,
          lease: "released",
        });
        assert.equal(evaluate(...changedLeaseArgs), false);
        assert.throws(() =>
          assert.equal(evaluateMutant(...changedLeaseArgs), false),
        );
        for (const checkpoint of [
          { ...settledRestart, cleanup: "unknown" },
          { ...settledRestart, result: null },
          {
            ...settledRestart,
            result: { ...settledRestart.result, effectOutcomeUnknown: true },
          },
          {
            ...settledRestart,
            result: { ...settledRestart.result, request: "unknown" },
          },
        ]) {
          const args = restartEvaluationArgs({
            ...restartOperation,
            dockerRestart: checkpoint,
          });
          assert.equal(evaluate(...args), false);
          assert.throws(() => assert.equal(guardMutant(...args), false));
        }
        for (const field of [
          "phase",
          "lease",
          "dockerRestart",
          "primaryFailure",
          "outcome",
          "summarySha256",
          "history",
        ]) {
          const changed = structuredClone(retired);
          changed[field] =
            field === "phase"
              ? "awaiting_delivery"
              : field === "lease"
                ? "released"
                : { changed: true };
          assert.equal(
            evaluate(changed, before, changed.host.currentToken, "host_only"),
            false,
            field,
          );
        }
        for (const field of Object.keys(retired.execution)) {
          const changed = structuredClone(retired);
          changed.execution[field] =
            field === "workspaceReusable"
              ? true
              : field === "ownerEffect"
                ? "active"
                : "unknown";
          if (field === "workspaceReusable") {
            // codec自体が常にfalseを要求する項目で、合法負例には数えない。
            const invalid = structuredClone(before);
            invalid.operations = invalid.operations.map(
              (item: typeof target) =>
                item.recoveryId === changed.recoveryId ? changed : item,
            );
            assert.equal(
              stateModel.decodeCoordinatorStateSnapshot(
                Buffer.from(`${encodeRuntimeStateValue(invalid)}\n`),
                before.repositoryBinding,
              ),
              null,
            );
            assert.equal(
              evaluate(changed, before, changed.host.currentToken, "host_only"),
              false,
            );
          } else assertLegalRejected(changed);
        }
        for (let index = 0; index < 5; index++) {
          for (const request of [
            "not_issued",
            "intent_saved",
            "issued",
            "unknown",
            "identified",
          ]) {
            const changed = structuredClone(retired);
            changed.resources[index].request = request;
            if (request === "identified") {
              changed.resources[index].dockerId = "f".repeat(64);
              changed.resources[index].receiptSource = "docker_create_result";
            }
            assertLegalRejected(changed);
          }
          for (const field of [
            "dockerId",
            "receiptSource",
            "observation",
            "absence",
          ]) {
            // 以下はcodec不合法の防御反例。上の合法要求状態とは区別する。
            const changed = structuredClone(retired);
            changed.resources[index][field] = "changed";
            assert.equal(
              evaluate(changed, before, changed.host.currentToken, "host_only"),
              false,
              `${index}:${field}`,
            );
          }
        }
        const initialHost = loadHostRecoveryRecordByToken(
          retired.host.currentToken,
          identity.hostPaths.root,
        );
        const successor = structuredClone(retired);
        successor.host.currentToken = `host.${initialHost.parsed.rootName}.${initialHost.parsed.nonce}.${createHash(
          "sha256",
        )
          .update(
            `${JSON.stringify({ ...initialHost.record, state: "docker_submission_started" })}\n`,
          )
          .digest("hex")}`;
        assertLegalRejected(successor);
        assert.equal(legalRejections, 30);
        for (const state of [
          "initializing",
          "docker_submission_started",
          "docker_absent_confirmed",
          "unknown",
        ])
          assert.equal(
            evaluate(retired, before, retired.host.currentToken, state),
            false,
          );
        assert.equal(
          evaluate(retired, before, "different", "host_only"),
          false,
        );
        for (const field of [
          "currentToken",
          "pendingTransitionJson",
          "cleanup",
        ]) {
          const changed = structuredClone(retired);
          changed.host[field] = "changed";
          assert.equal(
            evaluate(changed, before, changed.host.currentToken, "host_only"),
            false,
            field,
          );
        }
        for (const collection of [
          "unresolvedRecoveries",
          "pendingDeliveries",
        ]) {
          for (const key of ["recoveryId", "operationNonce"]) {
            const changed = structuredClone(before);
            changed[collection].push({
              [key]:
                key === "recoveryId"
                  ? retired.recoveryId
                  : identity.operationNonce,
            });
            assert.equal(
              evaluate(
                retired,
                changed,
                retired.host.currentToken,
                "host_only",
              ),
              false,
              `${collection}:${key}`,
            );
          }
        }
      }
      assert.equal(fs.lstatSync(identity.hostPaths.root).isDirectory(), true);
      assert.equal(fs.lstatSync(identity.hostPaths.marker).isFile(), true);
      const physicalHost = loadHostRecoveryRecordByToken(
        target.host.currentToken,
        identity.hostPaths.root,
      );
      assert.equal(
        physicalHost.record.state,
        producerMode === "state_saved"
          ? "host_only"
          : "docker_submission_started",
      );
      assert.equal(target.host.pendingTransitionJson, null);
      if (producerMode === "state_saved")
        assert.equal(target.host.currentToken, identity.initialHostRecoveryId);
      else
        assert.notEqual(
          target.host.currentToken,
          identity.initialHostRecoveryId,
        );
      const releasedHome =
        locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(
          identity.stableLogicalHomeBindingHash,
        );
      assert.ok(releasedHome);
      assert.equal(releasedHome.release(), true);
      for (const name of [
        "state.lock",
        "state.pending.json",
        "history.pending.jsonl",
      ])
        assert.throws(
          () => fs.lstatSync(path.join(path.dirname(statePath), name)),
          { code: "ENOENT" },
        );
      const other = before.operations.find(
        (item: { recoveryId: string }) =>
          item.recoveryId !== emitted.recoveryId,
      );
      assert.ok(other);
      const otherIdentity = JSON.parse(other.identityJson);
      /**
       * 非対象Hostの実体とmarker本文を捕捉する。
       * @responsibility state本文の一致とは独立に兄弟Host保全を観測する。
       * @trace PRL-IT-013
       * @precondition 旧Processが作った非対象Identityを現在stateから取得済みである。
       * @stimulus 非対象の固定Rootとmarkerだけを読み取る。
       * @observation bigintのdev／ino／birthtimeNsとmarker bytesを取得する。
       * @oracle 欠測・link・種別違いを拒否し、回復前後で同じ実体と本文を要求する。
       * @cleanup N/A: 観測だけで資源を生成しない。
       * @boundary 実Filesystemの非対象Host。
       */
      const captureOtherHost = () => {
        const directory = fs.lstatSync(otherIdentity.hostPaths.root, {
          bigint: true,
        });
        const marker = fs.lstatSync(otherIdentity.hostPaths.marker, {
          bigint: true,
        });
        assert.equal(directory.isDirectory(), true);
        assert.equal(directory.isSymbolicLink(), false);
        assert.equal(marker.isFile(), true);
        assert.equal(marker.isSymbolicLink(), false);
        return {
          root: [directory.dev, directory.ino, directory.birthtimeNs].map(
            String,
          ),
          marker: [marker.dev, marker.ino, marker.birthtimeNs].map(String),
          bytes: fs.readFileSync(otherIdentity.hostPaths.marker),
        };
      };
      const otherHostBefore = captureOtherHost();
      if (producerMode === "state_saved") {
        const retired = stateModel.prepareCoordinatorStateLifecycleSnapshot(
          Buffer.from(`${encodeRuntimeStateValue(before)}\n`),
          emitted.recoveryId,
          {
            phase: "settling",
            lease: target.lease,
            execution: { ...target.execution, ownerEffect: "disabled" },
            primaryFailure: target.primaryFailure,
            outcome: target.outcome,
            summarySha256: target.summarySha256,
          },
          before.repositoryBinding,
        );
        assert.ok(retired);
        const resourceNames: Record<string, string> = {
          create_egress_network: identity.resources.egress,
          create_internal_network: identity.resources.internal,
          create_provider: identity.resources.provider,
          create_proxy: identity.resources.proxy,
          create_subscription_auth_probe: identity.resources.auth,
        };
        const cleanupObservation = target.resources.map(
          (resource: { purpose: string; dockerId: null }) => ({
            purpose: resource.purpose,
            plannedResourceName: resourceNames[resource.purpose],
            dockerId: resource.dockerId,
            observation: "not_requested",
          }),
        );
        const resourcesConfirmed =
          stateModel.prepareCoordinatorStateCleanupSnapshot(
            retired,
            emitted.recoveryId,
            cleanupObservation,
            before.repositoryBinding,
          );
        assert.ok(resourcesConfirmed);
        const retriedResourcesConfirmed =
          stateModel.prepareCoordinatorStateCleanupSnapshot(
            resourcesConfirmed,
            emitted.recoveryId,
            cleanupObservation,
            before.repositoryBinding,
          );
        assert.ok(retriedResourcesConfirmed);
        const expectedPending = stateModel.prepareCoordinatorStateHostSnapshot(
          retriedResourcesConfirmed,
          emitted.recoveryId,
          { ...target.host, cleanup: "pending" },
          before.repositoryBinding,
        );
        assert.ok(expectedPending);
        const expectedRemoval =
          stateModel.prepareCoordinatorStateCleanupSnapshot(
            expectedPending,
            emitted.recoveryId,
            cleanupObservation,
            before.repositoryBinding,
          );
        assert.ok(expectedRemoval);
        const pendingSnapshot = JSON.parse(expectedPending.toString("utf8"));
        const removalSnapshot = JSON.parse(expectedRemoval.toString("utf8"));
        assert.deepEqual(
          removalSnapshot.operations,
          pendingSnapshot.operations,
        );
        assert.deepEqual(
          removalSnapshot.unresolvedRecoveries,
          pendingSnapshot.unresolvedRecoveries,
        );
        assert.deepEqual(
          removalSnapshot.pendingDeliveries,
          pendingSnapshot.pendingDeliveries,
        );
        const terminated = new Set([process.pid, emitted.pid]);
        const expectedStates: Record<string, Buffer> = {
          pending_writer_blocked: resourcesConfirmed,
          pending_saved: expectedPending,
          host_removed: expectedRemoval,
          confirmed_writer_blocked: expectedRemoval,
        };
        for (const interruption of [
          "pending_writer_blocked",
          "pending_saved",
          "host_removed",
          "confirmed_writer_blocked",
        ]) {
          const interrupted = spawnSync(
            process.execPath,
            [
              "--experimental-test-module-mocks",
              worker,
              "recovery",
              emitted.recoveryId,
              interruption,
            ],
            {
              cwd: root,
              encoding: "utf8",
              windowsHide: true,
              shell: false,
              timeout: 90_000,
              maxBuffer: 64 * 1024,
            },
          );
          assert.equal(interrupted.error, undefined);
          assert.equal(interrupted.signal, null);
          const writerBlocked = interruption.endsWith("writer_blocked");
          assert.equal(
            interrupted.status,
            writerBlocked ? 0 : 1,
            interrupted.stderr,
          );
          const packet = JSON.parse(interrupted.stdout);
          assert.equal(packet.pid, interrupted.pid);
          assert.equal(terminated.has(packet.pid), false);
          terminated.add(packet.pid);
          assert.equal(packet.recoveryId, emitted.recoveryId);
          assert.equal(packet.phase, interruption);
          assert.equal(packet.reached, 1);
          assert.equal(
            packet.finalWriterCalls,
            interruption === "confirmed_writer_blocked" ? 1 : 0,
          );
          assert.equal(packet.underlyingFinalWriterCalls, 0);
          assert.equal(
            packet.hostRecoveryCalls,
            interruption === "host_removed" ? 1 : 0,
          );
          assert.equal(
            packet.checkpointWriterCalls,
            interruption === "pending_writer_blocked"
              ? 3
              : interruption === "pending_saved"
                ? 2
                : interruption === "host_removed"
                  ? 1
                  : 0,
          );
          assert.equal(
            packet.actualCheckpointWriterCalls,
            interruption === "pending_writer_blocked" ||
              interruption === "pending_saved"
              ? 2
              : interruption === "host_removed"
                ? 1
                : 0,
          );
          if (writerBlocked) {
            assert.equal(packet.report.status, "blocked");
            assert.equal(packet.report.recoveryId, emitted.recoveryId);
            assert.equal(packet.report.operationRetained, null);
            assert.equal(packet.report.operationRemovalConfirmed, false);
            assert.equal(packet.report.taskRecoveryCompleted, false);
            assert.equal(packet.report.locksReleased, true);
          }
          assert.equal(packet.observerRejectionConfirmed, true);
          assert.deepEqual(packet.violations, []);
          assert.ok(
            packet.calls.every((call: string) =>
              ["native", "supervisor", "git"].includes(call),
            ),
          );
          assert.throws(
            () => fs.lstatSync(path.join(root, "unexpected-recovery-finally")),
            { code: "ENOENT" },
          );
          const expected = expectedStates[interruption];
          assert.ok(expected);
          const expectedSnapshot = JSON.parse(expected.toString("utf8"));
          assert.deepEqual(fs.readFileSync(statePath), expected);
          const interruptedState = JSON.parse(
            fs.readFileSync(statePath, "utf8"),
          );
          assert.equal(interruptedState.revision, expectedSnapshot.revision);
          assert.deepEqual(
            interruptedState.previous,
            expectedSnapshot.previous,
          );
          assert.equal(
            interruptedState.operations.some(
              (item: typeof target) => item.recoveryId === emitted.recoveryId,
            ),
            true,
          );
          assert.deepEqual(
            interruptedState.operations.filter(
              (item: typeof target) => item.recoveryId !== emitted.recoveryId,
            ),
            before.operations.filter(
              (item: typeof target) => item.recoveryId !== emitted.recoveryId,
            ),
          );
          assert.deepEqual(
            interruptedState.unresolvedRecoveries,
            before.unresolvedRecoveries,
          );
          assert.deepEqual(
            interruptedState.pendingDeliveries,
            before.pendingDeliveries,
          );
          assert.deepEqual(captureOtherHost(), otherHostBefore);
          for (const location of [
            identity.hostPaths.root,
            identity.hostPaths.marker,
          ]) {
            if (
              interruption === "pending_saved" ||
              interruption === "pending_writer_blocked"
            ) {
              const stat = fs.lstatSync(location, { bigint: true });
              assert.equal(stat.isSymbolicLink(), false);
              assert.equal(
                location === identity.hostPaths.root
                  ? stat.isDirectory()
                  : stat.isFile(),
                true,
              );
              const initialRoot =
                identity.initialHostRecovery.record.rootIdentity;
              const expectedIdentity =
                location === identity.hostPaths.root
                  ? [
                      initialRoot.dev,
                      initialRoot.ino,
                      initialRoot.birthtimeNs,
                    ].join(":")
                  : identity.initialHostRecovery.markerIdentity;
              assert.equal(
                [stat.dev, stat.ino, stat.birthtimeNs].map(String).join(":"),
                expectedIdentity,
              );
            } else
              assert.throws(() => fs.lstatSync(location), { code: "ENOENT" });
          }
          const lease = locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(
            identity.stableLogicalHomeBindingHash,
          );
          assert.ok(lease);
          assert.equal(lease.release(), true);
          for (const name of [
            "state.lock",
            "state.pending.json",
            "history.pending.jsonl",
            "history.jsonl",
          ])
            assert.throws(
              () => fs.lstatSync(path.join(path.dirname(statePath), name)),
              { code: "ENOENT" },
            );
        }
      }
      const child = spawnSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          worker,
          "recovery",
          emitted.recoveryId,
          ...(producerMode === "producer" ? ["none", "verify_admission"] : []),
        ],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          shell: false,
          timeout: 90_000,
          maxBuffer: 64 * 1024,
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.signal, null);
      assert.equal(child.status, 0, child.stderr);
      const recovered = JSON.parse(child.stdout);
      assert.equal(recovered.pid, child.pid);
      assert.notEqual(recovered.pid, emitted.pid);
      assert.notEqual(recovered.pid, process.pid);
      assert.deepEqual(recovered.violations, []);
      assert.equal(recovered.observerRejectionConfirmed, true);
      assert.deepEqual(
        recovered.recoveryAdmissionChecks,
        producerMode === "producer"
          ? [
              "invalid_current",
              "pending_previous_mismatch",
              "unknown_entry",
              "binding_field_corrupt",
            ]
          : [],
      );
      assert.ok(
        recovered.calls.every((call: string) =>
          ["native", "supervisor", "git"].includes(call),
        ),
      );
      assert.equal(recovered.report.recoveryId, emitted.recoveryId);
      assert.equal(recovered.report.status, "recovered");
      const after = JSON.parse(fs.readFileSync(statePath, "utf8"));
      assert.deepEqual(
        after.operations,
        before.operations.filter(
          (item: { recoveryId: string }) =>
            item.recoveryId !== emitted.recoveryId,
        ),
      );
      assert.deepEqual(after.unresolvedRecoveries, before.unresolvedRecoveries);
      assert.deepEqual(after.pendingDeliveries, before.pendingDeliveries);
      assert.deepEqual(captureOtherHost(), otherHostBefore);
      for (const location of [
        otherIdentity.hostPaths.root,
        otherIdentity.hostPaths.marker,
      ]) {
        const missing = `${location}.oracle-missing`;
        assert.throws(() => fs.lstatSync(missing), { code: "ENOENT" });
        fs.renameSync(location, missing);
        try {
          assert.throws(() => captureOtherHost(), { code: "ENOENT" });
        } finally {
          fs.renameSync(missing, location);
        }
        assert.deepEqual(captureOtherHost(), otherHostBefore);
      }
      const history = fs
        .readFileSync(
          path.join(path.dirname(statePath), "history.jsonl"),
          "utf8",
        )
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line));
      assert.equal(
        history.filter((row) => row.summary.recoveryId === emitted.recoveryId)
          .length,
        1,
      );
      assert.equal(history.length, 1);
      assert.equal(history[0].summary.operationNonce, identity.operationNonce);
      for (const file of [
        identity.hostPaths.root,
        identity.hostPaths.marker,
        ...["state.lock", "state.pending.json", "history.pending.jsonl"].map(
          (name) => path.join(path.dirname(statePath), name),
        ),
      ])
        assert.throws(() => fs.lstatSync(file), { code: "ENOENT" });
      cleanupConfirmed = true;
    } finally {
      if (cleanupConfirmed) fs.rmSync(root, { recursive: true });
    }
  });
}

/**
 * 認証create切断子の通常例外で真正Ownerの解放と記録保持を確認する。
 * @responsibility 実Dockerなしの故障刺激と、実保存・実Home排他・Host保持を分離する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition Windowsの自己生成Repositoryと固定Docker代役だけを使用する。
 * @stimulus 作成前、作成後、unknown保存前後、packet直前を個別Processで失敗させる。
 * @observation 元例外、故障到達、要求列、abandon回数、実stateとHost・markerの保持。
 * @oracle 前半三形はintent_saved、後半二形はunknownで、実Docker0とHome再取得を要求する。
 * @cleanup 子終端・解放・自己生成実体の確認後に専用Rootを回収する。不明時は保持する。
 * @boundary 実Owner／Writer／KernelとDocker代役。Container回収や実restartは検証しない。
 */
for (const fault of [
  "image",
  "inspect",
  "before_unknown",
  "after_unknown",
  "packet",
]) {
  /**
   * 認証create切断子の通常例外で真正Ownerの解放と記録保持を確認する。
   * @responsibility 実Dockerなしの故障刺激と、実保存・実Home排他・Host保持を分離する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @precondition Windowsの自己生成Repositoryと固定Docker代役だけを使用する。
   * @stimulus 作成前、作成後、unknown保存前後、packet直前を個別Processで失敗させる。
   * @observation 元例外、故障到達、要求列、abandon回数、実stateとHost・markerの保持。
   * @oracle 前半三形はintent_saved、後半二形はunknownで、実Docker0とHome再取得を要求する。
   * @cleanup 子終端・解放・自己生成実体の確認後に専用Rootを回収する。不明時は保持する。
   * @boundary 実Owner／Writer／KernelとDocker代役。Container回収や実restartは検証しない。
   */
  test(`Host Windows: 認証create通常例外${fault}でOwner解放と現在記録を保持する`, () => {
    const area = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "auth_create_failure_test",
    );
    const root = fs.mkdtempSync(
      path.join(area.directory, "auth-create-failure-"),
    );
    let cleanupConfirmed = false;
    try {
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
      const worker = fileURLToPath(
        new URL(
          "../fixtures/docker-recovery-abandon-worker.ts",
          import.meta.url,
        ),
      );
      const child = spawnSync(
        process.execPath,
        [
          "--experimental-test-module-mocks",
          worker,
          "auth_create_failure",
          fault,
        ],
        {
          cwd: root,
          encoding: "utf8",
          windowsHide: true,
          shell: false,
          timeout: 90_000,
          maxBuffer: 64 * 1024,
        },
      );
      assert.equal(child.error, undefined);
      assert.equal(child.signal, null);
      assert.equal(child.status, 1, child.stderr);
      const report = JSON.parse(child.stdout);
      assert.equal(report.pid, child.pid);
      assert.notEqual(report.pid, process.pid);
      assert.equal(report.fault, fault);
      assert.equal(report.faultReached, 1);
      assert.equal(report.abandonCalls, 1);
      assert.equal(
        report.primaryFailure,
        `auth_create_fixture_failure:${fault}`,
      );
      assert.equal(report.generationReleased, true);
      assert.equal(report.homeLeaseReacquired, true);
      assert.equal(report.hostRetained, true);
      assert.equal(report.realDockerCalls, 0);
      assert.deepEqual(
        report.dockerCalls,
        fault === "image" ? ["image"] : ["image", "create", "inspect"],
      );
      const statePath = path.join(root, ".crdd", "coordinator", "state.json");
      const bytes = fs.readFileSync(statePath);
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        report.stateSha256,
      );
      const snapshot = JSON.parse(bytes.toString("utf8"));
      assert.equal(snapshot.operations.length, 2);
      const target = snapshot.operations.find(
        (value: { recoveryId: string }) =>
          value.recoveryId === report.recoveryId,
      );
      assert.ok(target && target.kind === "docker_task");
      const auth = target.resources.find(
        (value: { purpose: string }) =>
          value.purpose === "create_subscription_auth_probe",
      );
      assert.deepEqual(auth, {
        purpose: "create_subscription_auth_probe",
        request: ["after_unknown", "packet"].includes(fault)
          ? "unknown"
          : "intent_saved",
        dockerId: null,
        receiptSource: null,
        observation: "unobserved",
        absence: null,
      });
      const identity = JSON.parse(target.identityJson);
      for (const location of [
        identity.hostPaths.root,
        identity.hostPaths.marker,
      ])
        assert.equal(fs.lstatSync(location).isSymbolicLink(), false);
      for (const name of [
        "unexpected-finally",
        ".crdd/coordinator/state.lock",
        ".crdd/coordinator/state.pending.json",
      ])
        assert.throws(() => fs.lstatSync(path.join(root, name)), {
          code: "ENOENT",
        });
      cleanupConfirmed = true;
    } finally {
      if (cleanupConfirmed) {
        assert.equal(path.dirname(root), area.directory);
        assert.equal(fs.realpathSync(root), root);
        fs.rmSync(root, { recursive: true, force: true });
        assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
      }
    }
  });
}

/**
 * 正常完了Ownerを実Host・Home排他・現在Writerへ接続する。
 * @responsibility Docker証明の模擬とHost回収の実測を分け、結果保存までの本番結合を検証する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @trace ERB-IT-014
 * @precondition Windowsと自己生成Repositoryを使い、修復Native・技術観測、Home観測とDocker証明だけを模擬する。
 * @stimulus 1回形は退避なし、または自動破棄判断の保存直前を一回拒否して自己生成物を明示保持した後、同じstateを再初期化せずTaskへ渡す。2回形は同一Host・Homeで本番begin／正常completeを反復し、一度の実清掃後に逆順で結果を登録する。
 * @observation 実state本文、Home排他競合、Host marker、履歴、短命物と非対象操作を確認する。
 * @oracle 修復中のTask追加候補はnull。保持期限は七日で同ID再入場でも不変、保持物を再利用・削除せず、修復終了からの改訂・元版Hashと元修復履歴行を保全する。清掃前finalizeと複製結果は状態不変で拒否し、真正清掃後だけ対象を履歴化して現在状態から除く。
 * @cleanup 真正Ownerを放棄・解放し、確認済み自己生成HostとRepositoryだけを清掃する。
 * @boundary 実Owner／Kernel／Host／Writerと、模擬Docker cleanup・mount・terminal証明。
 */
for (const { repeatCount, retained } of [
  { repeatCount: 1, retained: false },
  { repeatCount: 1, retained: true },
  { repeatCount: 2, retained: false },
  { repeatCount: 3, retained: false },
]) {
  /**
   * 正常完了Ownerを実Host・Home排他・現在Writerへ接続する。
   * @responsibility Docker証明の模擬とHost回収の実測を分け、結果保存までの本番結合を検証する。
   * @trace PRL-IT-013
   * @trace ERB-IT-003
   * @trace ERB-IT-014
   * @precondition Windowsと自己生成Repositoryを使い、修復Native・技術観測、Home観測とDocker証明だけを模擬する。
   * @stimulus 1回形は退避なし、または自動破棄判断の保存直前を一回拒否して自己生成物を明示保持した後、同じstateを再初期化せずTaskへ渡す。複数回形は同一Host・Homeで本番begin／正常completeを反復し、一度の実清掃後に全結果受領→全最終確定を行う。3回形はServer受信済みのHTTP照会を重ねる。
   * @observation 実state本文、Home排他競合、Host marker、履歴、短命物と非対象操作を確認する。
   * @oracle 修復中のTask追加候補はnull。保持期限は七日で同ID再入場でも不変、保持物を再利用・削除せず、修復終了からの改訂・元版Hashと元修復履歴行を保全する。清掃前finalizeと複製結果は状態不変で拒否し、真正清掃後だけ対象を履歴化して現在状態から除く。
   * @cleanup 真正Ownerを放棄・解放し、確認済み自己生成HostとRepositoryだけを清掃する。
   * @boundary 実Owner／Kernel／Host／Writerと、模擬Docker cleanup・mount・terminal証明。
   */
  test(`Host Windows: 正常Owner${repeatCount}回${retained ? "・保持あり" : ""}から実Home解放・Host清掃・結果保存まで結合する`, async (t) => {
    const area = requireReadyRepositoryRuntimeDataArea(
      ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
        import.meta.dirname,
        "tests",
      ),
      "normal_owner_test",
    );
    const root = fs.mkdtempSync(path.join(area.directory, "normal-owner-"));
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
    let failure: unknown = null;
    let repairClosed = repeatCount !== 1;
    let repairHistory: Buffer | null = null;
    let repairActiveState: Buffer | null = null;
    let repairCompletedState: Buffer | null = null;
    let httpServer: ReturnType<typeof createServer> | null = null;
    let httpPending: ReturnType<typeof requestInChild> | null = null;
    const stageTimings: {
      stage: "receipt" | "finalize";
      startedAt: number;
      completedAt: number;
    }[] = [];
    const httpTimings: VerificationHttpTiming[] = [];
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
     * @observation raw byte、decoderの行集合とexact回復IDを確認する。
     * @oracle 元行のbyte・時刻・両Hashは不変かつ一件。Task追加前は全byte一致。
     * @cleanup N/A: 値比較だけでFilesystemを変更しない。
     * @boundary 実履歴本文と元修復行の相関。実修復技術の証明ではない。
     */
    function assertRepairHistory(bytes: Buffer, taskRows = 0): void {
      if (!repairHistory) return;
      const original =
        historyValues.decodeCoordinatorHistoryRows(repairHistory);
      const rows = historyValues.decodeCoordinatorHistoryRows(bytes);
      assert.ok(original?.length === 1 && original[0] && rows);
      assert.equal(rows.length, 1 + taskRows);
      assert.deepEqual(bytes.subarray(0, repairHistory.length), repairHistory);
      assert.deepEqual(
        rows.filter((row) => row.recoveryId === original[0]?.recoveryId),
        original,
      );
      if (taskRows === 0) assert.deepEqual(bytes, repairHistory);
    }
    try {
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
      const hosts = requireReadyRepositoryRuntimeDataArea(
        ensureRepositoryRuntimeDataAreaFromWorkingDirectory(root, "tests"),
        "normal_owner_hosts",
      );
      if (repeatCount === 1) {
        const verified = verifyRepositoryRoot(root);
        assert.equal(verified.status, "completed");
        if (verified.status !== "completed")
          throw new Error("root_unavailable");
        let acquisitions = 0;
        let observations = 0;
        let engineWaits = 0;
        let retentionReads = 0;
        let retentionEffects = 0;
        let disposalCalls = 0;
        let disposalDecisionRefusals = 0;
        if (retained) {
          fs.mkdirSync(sourceDirectory);
          fs.writeFileSync(
            path.join(sourceDirectory, "marker"),
            retainedMarker,
          );
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
          "coordinator",
          "state.json",
        );
        let writerFault: ReturnType<typeof mock.module> | null = retained
          ? mock.module(
              new URL("../../src/storage/state.ts", import.meta.url).href,
              {
                namedExports: {
                  ...stateRuntime,
                  writeRuntimeOwnedCoordinatorRepairSnapshot: (
                    ...args: Parameters<
                      typeof stateRuntime.writeRuntimeOwnedCoordinatorRepairSnapshot
                    >
                  ) => {
                    if (args[5] === "disposal_decision") {
                      disposalDecisionRefusals++;
                      assert.equal(disposalDecisionRefusals, 1);
                      return stateRuntime.writeRuntimeOwnedCoordinatorRepairSnapshot(
                        null,
                        args[1],
                        args[2],
                        args[3],
                        args[4],
                        args[5],
                      );
                    }
                    return stateRuntime.writeRuntimeOwnedCoordinatorRepairSnapshot(
                      ...args,
                    );
                  },
                },
              },
            )
          : null;
        const technical = mock.module(
          new URL("../../../docker-isolation/src/index.ts", import.meta.url)
            .href,
          {
            namedExports: {
              ...isolation,
              disposeDockerRuntimeRepairDirectory: async () => {
                disposalCalls++;
                throw new Error("unexpected_fixture_disposal");
              },
              observeDockerRuntimeRepairRetention: (
                input: Parameters<
                  typeof isolation.observeDockerRuntimeRepairRetention
                >[0],
              ) => {
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
              runDockerRuntimeRepairSession: (
                input: Parameters<
                  typeof isolation.runDockerRuntimeRepairSession
                >[0],
              ) =>
                runDockerRuntimeRepairSessionUsing(input, {
                  acquire: async () => {
                    acquisitions++;
                    return {
                      status: "acquired",
                      ownerBindingSha256: "b".repeat(64),
                      session: {
                        assertLive: () => true,
                        failureDetected: new Promise(() => {}),
                        onFailureDetected: () => () => {},
                        verifyArtifacts: async () => "verified",
                        inspectProcesses: async () => "verified",
                        terminateProcesses: async () => {
                          throw new Error("unexpected_repair_effect");
                        },
                        launchDesktop: async () => {
                          throw new Error("unexpected_repair_effect");
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
                    scopeSha256: "c".repeat(64),
                    cleanupFailure: () => null,
                    technical: {
                      observe: async (checkpoint) => {
                        observations++;
                        repairActiveState = fs.readFileSync(repairStatePath);
                        const active = JSON.parse(
                          repairActiveState.toString("utf8"),
                        );
                        assert.equal(active.operations.length, 1);
                        assert.equal(
                          active.operations[0].kind,
                          "runtime_repair",
                        );
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
                }),
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
            const waiting = JSON.parse(
              fs.readFileSync(repairStatePath, "utf8"),
            );
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
            assert.equal(
              result.retentionConfirmed,
              true,
              JSON.stringify(result),
            );
            assert.equal(retentionReads, 1);
            assert.equal(retentionEffects, 1);
            assert.equal(disposalCalls, 0);
            assertRetainedArtifact();
          }
          assert.equal(result.historyConfirmed, true, JSON.stringify(result));
          assert.equal(
            result.completionConfirmed,
            true,
            JSON.stringify(result),
          );
          assert.equal(acquisitions, 1);
          assert.equal(engineWaits, 1);
          assert.ok(observations > 0 && repairActiveState);
          repairCompletedState = fs.readFileSync(repairStatePath);
          const settled = JSON.parse(repairCompletedState.toString("utf8"));
          assert.deepEqual(settled.operations, []);
          assert.deepEqual(settled.unresolvedRecoveries, []);
          assert.deepEqual(settled.pendingDeliveries, []);
          repairHistory = fs.readFileSync(
            path.join(path.dirname(repairStatePath), "history.jsonl"),
          );
          const rows =
            historyValues.decodeCoordinatorHistoryRows(repairHistory);
          assert.equal(rows?.length, 1);
          assert.equal(rows?.[0]?.recoveryId, result.recoveryId);
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
          changed.occurredAt = new Date(
            Date.parse(changed.occurredAt) + 1,
          ).toISOString();
          assert.throws(() =>
            assertRepairHistory(
              Buffer.from(`${encodeRuntimeStateValue(changed)}\n`),
            ),
          );
          const duplicated = Buffer.concat([repairHistory, repairHistory]);
          assert.throws(() => assertRepairHistory(duplicated));
          for (const name of [
            "state.lock",
            "state.pending.json",
            "history.pending.jsonl",
          ])
            assert.throws(
              () =>
                fs.lstatSync(path.join(path.dirname(repairStatePath), name)),
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
      assert.ok(
        repository.bindRuntimeOwnedRepositoryOperation(management, root),
      );
      assert.ok(
        repository.bindRuntimeOwnedRepositoryOperation(otherManagement, root),
      );
      const binding =
        repository.borrowRuntimeOwnedCoordinatorStateRepository(management);
      const otherBinding =
        repository.borrowRuntimeOwnedCoordinatorStateRepository(
          otherManagement,
        );
      assert.ok(binding && otherBinding);
      const initial = Buffer.from(
        `${encodeRuntimeStateValue({ schema: COORDINATOR_STATE_SCHEMA, revision: 1, repositoryBindingId: null, intakeEpoch: null, intakeBindings: [], projects: [], workspaces: [], queueEntries: [], leaseEvidence: [], leaseIntents: [], results: [], historyPending: [], acceptanceDecisions: [], decisionRecoveries: [], resultReceipts: [], previous: null, repositoryBinding: binding.repositoryBinding, operations: [], unresolvedRecoveries: [], pendingDeliveries: [] })}\n`,
      );
      if (repeatCount >= 2) {
        assert.equal(
          stateRuntime.prepareRuntimeOwnedCoordinatorStateInitialization(
            management,
            initial,
          ).status,
          "prepared",
        );
        assert.equal(
          stateRuntime.writeRuntimeOwnedCoordinatorStateSnapshot(
            management,
            initial,
          ).status,
          "completed",
        );
      } else {
        assert.ok(repairCompletedState);
        assert.deepEqual(
          fs.readFileSync(
            path.join(root, ".crdd", "coordinator", "state.json"),
          ),
          repairCompletedState,
        );
        assert.equal(
          JSON.parse(repairCompletedState.toString("utf8")).repositoryBinding,
          binding.repositoryBinding,
        );
      }
      const hash = randomBytes(32).toString("hex"),
        suffix = randomBytes(8).toString("hex");
      const plan = Object.freeze({
        provider: "codex" as const,
        consumer: "workbench" as const,
        operationId: binding.operationId,
        grantRef: "PHMGRANT-FIXTURE",
        executionSelection: executionSelection("executor", {
          provider: "codex",
          model: "gpt-5.5",
          effort: "low",
        }),
        taskAttempt: 0 as const,
        providerHomeIdentityHash: hash,
        providerHomeProtectionHash: hash,
        localUserBindingHash: hash,
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
        assert.equal(
          stateModel.prepareCoordinatorStateOperationSnapshot(
            repairActiveState,
            otherIdentity,
            binding.repositoryBinding,
          ),
          null,
        );
      }
      const otherStarted =
        stateRuntime.saveRuntimeOwnedCoordinatorOperationStart(
          otherManagement,
          otherIdentity,
        );
      assert.equal(otherStarted.status, "completed");
      assert.ok(otherStarted.recoveryId);
      if (repairHistory)
        assertRepairHistory(
          fs.readFileSync(
            path.join(root, ".crdd", "coordinator", "history.jsonl"),
          ),
        );
      if (repairCompletedState) {
        const prior = stateModel.decodeCoordinatorStateSnapshot(
          repairCompletedState,
          binding.repositoryBinding,
        );
        const next =
          stateRuntime.readRuntimeOwnedCoordinatorStateSnapshot(
            management,
          ).value;
        assert.ok(prior && next);
        assert.equal(next.snapshot.revision, prior.snapshot.revision + 1);
        assert.deepEqual(next.snapshot.previous, {
          revision: prior.snapshot.revision,
          payloadSha256: prior.payloadSha256,
        });
      }
      const otherBefore = stateRuntime
        .readRuntimeOwnedCoordinatorStateSnapshot(management)
        .value?.snapshot.operations.find(
          (item) => item.recoveryId === otherStarted.recoveryId,
        );
      assert.ok(otherBefore);
      assert.equal(
        await hostRuntime.activateOwnedHostOperationGenerationLock(management),
        "activated",
      );
      const hostBefore =
        hostRuntime.borrowOwnedHostRecoverySnapshot(management);
      const observation = Object.freeze({});
      const submissionNotice = Object.freeze({});
      let submissionVerifications = 0;
      const proofs = new Map<
        object,
        {
          recoveryId: string;
          cleanup: object;
          mount: object;
          activeMount: object;
          completionPlan: object;
          dockerResult: Readonly<{
            status: "completed";
            reason: "provider_operation_completed";
            cleanupConfirmed: true;
          }>;
        }
      >();
      const resources = (
        [
          ["create_egress_network", plan.egressNetworkName],
          ["create_internal_network", plan.internalNetworkName],
          ["create_provider", plan.providerContainerName],
          ["create_proxy", plan.proxyContainerName],
          ["create_subscription_auth_probe", plan.authContainerName],
        ] as const
      ).map(([purpose, plannedResourceName]) => ({
        purpose,
        plannedResourceName,
        dockerId: null,
        observation: "not_requested",
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
      const cleanupExports = {
        ...effects,
        verifyRuntimeOwnedDockerCleanupOutcome: (
          value: unknown,
          input: unknown,
          cap: unknown,
          owner: unknown,
        ) => {
          const proof = cap && typeof cap === "object" ? proofs.get(cap) : null;
          return proof &&
            value === proof.cleanup &&
            input === proof.completionPlan &&
            owner === management
            ? resources
            : null;
        },
      };
      substitutions.push(
        mock.module(
          new URL("../../src/execution/observation.ts", import.meta.url).href,
          {
            namedExports: {
              ...controller,
              verifyRuntimeOwnedDockerProviderSubmissionNotice: (
                notice: unknown,
                cap: unknown,
                owner: unknown,
                operationId: unknown,
                id: unknown,
              ) => {
                const proof =
                  cap && typeof cap === "object" ? proofs.get(cap) : null;
                if (
                  notice !== submissionNotice ||
                  !proof ||
                  owner !== management ||
                  operationId !== plan.operationId ||
                  id !== proof.recoveryId
                )
                  return false;
                submissionVerifications++;
                return true;
              },
              borrowRuntimeOwnedDockerTerminalObservations: (
                value: unknown,
                owner: unknown,
                operationId: unknown,
                id: unknown,
              ) =>
                [...proofs.values()].some(
                  (proof) =>
                    value === proof.dockerResult &&
                    owner === management &&
                    operationId === plan.operationId &&
                    id === proof.recoveryId,
                )
                  ? {
                      resources,
                      primaryFailure: null,
                      mountLeaseReleased: true,
                      homeLeaseReleased: true,
                      recoveryCompleted: true,
                    }
                  : null,
            },
          },
        ),
      );
      const actualStore: typeof stateRuntime = await import(
        new URL(
          `../../src/storage/state.ts?normal-owner-physical-${repeatCount}-${retained}`,
          import.meta.url,
        ).href
      );
      substitutions.push(
        mock.module(
          new URL("../../src/storage/state.ts", import.meta.url).href,
          { namedExports: { ...actualStore } },
        ),
      );
      const hostSource = fs.readFileSync(
        new URL("../../src/execution/controller.ts", import.meta.url),
        "utf8",
      );
      const hostBody = [
        "beginRuntimeOwnedCoordinatorHostSubmission",
        "transitionRuntimeOwnedCoordinatorHostSubmission",
        "completeRuntimeOwnedCoordinatorHostSubmission",
      ]
        .map((name) => sourceDeclaration(hostSource, name))
        .join("\n");
      const cleanupKey = "__crddNormalOwnerCleanupVerification";
      (globalThis as Record<string, unknown>)[cleanupKey] =
        cleanupExports.verifyRuntimeOwnedDockerCleanupOutcome;
      const hostImports = [
        'import { createHash } from "node:crypto";',
        `import { hashExecutionSelection } from "${new URL("../../src/selection/validation.ts", import.meta.url).href}";`,
        `const verifyRuntimeOwnedDockerCleanupOutcome = globalThis[${JSON.stringify(cleanupKey)}];`,
        `import { beginOwnedDockerSubmissionRecovery, borrowOwnedHostRecoverySnapshot, completeOwnedDockerSubmissionRecovery, borrowRuntimeOwnedCoordinatorStateRepository } from "${new URL("../../src/execution/operation.ts", import.meta.url).href}";`,
        `import { parseHostRecoveryToken } from "${new URL("../../src/execution/result.ts", import.meta.url).href}";`,
        `import { verifyRuntimeOwnedProviderHomeMountCompletion } from "${new URL("../../src/execution/authority.ts", import.meta.url).href}";`,
        `import { checkpointRuntimeOwnedCoordinatorCleanup, checkpointRuntimeOwnedCoordinatorHost, readRuntimeOwnedCoordinatorStateSnapshot } from "${new URL("../../src/storage/state.ts", import.meta.url).href}";`,
      ].join("\n");
      const actualHostSubmission = await import(
        `data:text/javascript;base64,${Buffer.from(`// fixture: ${repeatCount}:${retained}\n${hostImports}\n${hostBody}\nexport { beginRuntimeOwnedCoordinatorHostSubmission, completeRuntimeOwnedCoordinatorHostSubmission };`).toString("base64")}`
      ).finally(() => {
        delete (globalThis as Record<string, unknown>)[cleanupKey];
      });
      substitutions.push(
        mock.module(
          new URL("../../src/execution/controller.ts", import.meta.url).href,
          { namedExports: { ...cleanupExports, ...actualHostSubmission } },
        ),
      );
      ownerRuntime = await import(
        new URL(
          `../../src/execution/recovery.ts?normal-owner-physical-${repeatCount}-${retained}`,
          import.meta.url,
        ).href
      );
      assert.ok(ownerRuntime);
      const statePath = path.join(root, ".crdd", "coordinator", "state.json");
      const completedOperations = new Map<string, unknown>();
      const nonces = new Set<string>();
      for (let round = 0; round < repeatCount; round++) {
        const beforeBegin = JSON.parse(fs.readFileSync(statePath, "utf8"));
        assert.equal(
          hostRuntime.borrowOwnedHostRecoverySnapshot(management).snapshot
            .token,
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
              path.join(root, ".crdd", "coordinator", "history.jsonl"),
            ),
          );
        const capability: object = begun.recoveryCapability;
        const recoveryId: string = begun.recoveryId;
        pendingCapabilities.add(capability);
        assert.ok(
          ![...proofs.values()].some(
            (proof) => proof.recoveryId === recoveryId,
          ),
        );
        const activeMount = Object.freeze({});
        const proof: NonNullable<ReturnType<typeof proofs.get>> = {
          recoveryId,
          mount: Object.freeze({}),
          activeMount,
          cleanup: Object.freeze({
            confirmed: true,
            processTreeTerminated: true,
            containersAbsent: true,
            networksAbsent: true,
          }),
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
        assert.equal(
          locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(hash),
          null,
        );
        const startedHost =
          hostRuntime.borrowOwnedHostRecoverySnapshot(management);
        assert.equal(
          startedHost.snapshot.record.state,
          "docker_submission_started",
        );
        assert.notEqual(startedHost.snapshot.token, hostBefore.snapshot.token);
        assert.equal(startedHost.hostPaths.root, owned.root);
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
              cleanupOutcome: proof.cleanup,
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
                plan: proof.completionPlan,
                cleanupOutcome: previousProof.cleanup,
                mountCompletion: proof.mount,
              },
            ).status,
            "blocked",
          );
        }
        assert.deepEqual(fs.readFileSync(statePath), beforeComplete);
        const completed = ownerRuntime.completeRuntimeOwnedDockerRecovery(
          capability,
          management,
          {
            plan: proof.completionPlan,
            cleanupOutcome: proof.cleanup,
            mountCompletion: proof.mount,
          },
        );
        assert.equal(completed.status, "completed", JSON.stringify(completed));
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
        const reacquired =
          locks.acquireRuntimeOwnedLogicalProviderHomeKernelLock(hash);
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
        const submissionBefore = fs.readFileSync(statePath),
          verificationBefore = submissionVerifications;
        assert.equal(
          ownerRuntime.recordRuntimeOwnedDockerProviderSubmission(
            capability,
            submissionNotice,
          ),
          false,
        );
        assert.equal(submissionVerifications, verificationBefore + 1);
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
            fs.readFileSync(
              path.join(path.dirname(statePath), "history.jsonl"),
            ),
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
            path.join(root, ".crdd", "coordinator", "history.jsonl"),
          ),
        );
      assert.equal(fs.existsSync(owned.root), false);
      assert.equal(fs.existsSync(hostBefore.hostPaths.marker), false);
      if (repeatCount === 3) {
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
        httpPending = requestInChild(
          `http://127.0.0.1:${address.port}/`,
          "/api/workbench-view?route=%2F",
          undefined,
          (timing) => httpTimings.push(timing),
        );
        await Promise.race([
          arrival,
          httpPending.then(() => {
            throw new Error("http_arrival_unconfirmed");
          }),
        ]);
      }
      for (const [capability, proof] of [...proofs].reverse()) {
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
          const otherProof = [...proofs.values()].find(
            (item) => item !== proof,
          );
          assert.ok(otherProof);
          assert.equal(
            ownerRuntime.recordRuntimeOwnedDockerHostCleanupReceipt(
              capability,
              {
                hostCleanupOutcome: cleanupResult,
                dockerCompletion: otherProof.dockerResult,
              },
            ),
            false,
          );
        }
        assert.deepEqual(fs.readFileSync(statePath), beforeReceipt);
        const receiptStartedAt = Date.now();
        const recorded =
          ownerRuntime.recordRuntimeOwnedDockerHostCleanupReceipt(capability, {
            hostCleanupOutcome: cleanupResult,
            dockerCompletion: proof.dockerResult,
          });
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
      assert.deepEqual(final.pendingDeliveries, []);
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
        const row =
          historyValues.decodeCoordinatorHistoryRows(repairHistory)?.[0];
        const rows = historyValues.decodeCoordinatorHistoryRows(historyBytes);
        assert.ok(row && rows);
        assert.deepEqual(
          rows.filter((value) => value.recoveryId === row.recoveryId),
          [row],
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
        assert.equal(
          row.summary.outcome.reason,
          "provider_operation_completed",
        );
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
            let released = true;
            if (ownerRuntime)
              for (const capability of pendingCapabilities) {
                try {
                  released =
                    ownerRuntime.abandonRuntimeOwnedDockerRecovery(
                      capability,
                    ) === true && released;
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
    if (failure !== null) throw failure;
  });
}

/**
 * 実Host Caseの清掃本文で例外時の後続回収と模擬復元を反証する。
 * @responsibility 清掃失敗が元の失敗を隠さず、次Caseへ差替えを残さないことを確認する。
 * @trace PRL-IT-013
 * @precondition 同Fileの固定清掃本文を一意に抽出する。
 * @stimulus 最初のHost清掃の例外、世代解放false、修復終了未確認に、元失敗あり・なしを与える。
 * @observation 全清掃試行、逆順復元、最初の失敗とRoot削除0を確認する。
 * @oracle 後続清掃と全復元を省略せず、元失敗がある場合は同じobjectを維持する。
 * @cleanup N/A: メモリ内の本文評価で実Host・Filesystemを使用しない。
 * @boundary 物理回収は別の実Host正例が所有し、このCaseは失敗時の制御だけを確認する。
 */
test("正常Owner試験の清掃例外は後続回収と全模擬復元を飛ばさない", async () => {
  const source = fs.readFileSync(import.meta.filename, "utf8");
  const startMarker = ["normal-owner", "cleanup-begin"].join("-");
  const endMarker = ["normal-owner", "cleanup-end"].join("-");
  assert.equal(source.split(startMarker).length, 2);
  assert.equal(source.split(endMarker).length, 2);
  const body = source.slice(
    source.indexOf(startMarker) + startMarker.length,
    source.indexOf(endMarker),
  );
  for (const fault of [
    "host_cleanup_throw",
    "generation_false",
    "repair_unconfirmed",
  ]) {
    for (const primary of [null, Error("fixture_primary_failure")]) {
      const calls: string[] = [];
      const cleanupError = Error("fixture_cleanup_failure");
      const own = Object.freeze({}),
        other = Object.freeze({});
      const result = await runInNewContext(
        `(async () => { let failure = primary; ${body}\n return failure; })()`,
        {
          primary,
          assert,
          pendingCapabilities: new Set(),
          ownerRuntime: null,
          management: fault === "generation_false" ? Object.freeze({}) : null,
          owned: own,
          otherOwned: other,
          hostCleaned: false,
          repairClosed: fault !== "repair_unconfirmed",
          hostRuntime: {
            abandonOwnedHostOperationGenerationLock: async () => {
              calls.push("generation");
              return false;
            },
            cleanupOwnedOperationDirectoriesAsync: async (value: unknown) => {
              calls.push(value === own ? "own" : "other");
              if (value === own && fault === "host_cleanup_throw")
                throw cleanupError;
              assert.ok(value === own || value === other);
              return value;
            },
            verifyOwnedOperationCleanupOutcome: (
              value: unknown,
              expected: unknown,
            ) =>
              value === expected && (value === own || value === other)
                ? "completed"
                : null,
          },
          substitutions: [1, 2].map((value) => ({
            restore: () => {
              calls.push(`restore${value}`);
            },
          })),
          fs: {
            rmSync: () => {
              calls.push("delete");
            },
          },
          root: path.join("fixture", "normal-owner-fixture"),
          area: { directory: "fixture" },
          path,
        },
      );
      if (primary !== null) assert.equal(result, primary);
      else if (fault === "host_cleanup_throw")
        assert.equal(result, cleanupError);
      else if (fault === "generation_false")
        assert.equal(result.code, "ERR_ASSERTION");
      else assert.equal(result, null);
      assert.deepEqual(calls, [
        ...(fault === "generation_false" ? ["generation"] : []),
        "own",
        "other",
        "restore2",
        "restore1",
      ]);
    }
  }
});

/**
 * 本番開始から復帰・清掃・終了の同じOwner再入場を検証する。
 * @responsibility 下位保存失敗後の元入力保持と処置の二重発行を反証する。
 * @trace ERB-IT-003
 * @trace PRL-IT-013
 * @precondition 下位Host・保存・Home境界は明示的に模擬する。
 * @stimulus 未登録入力、Host完了拒否、後続保存の停止と同じ元入力でのOwner再入場を順に発生させる。
 * @observation 復帰・Lease解放・Capability発行・token消費回数、元object同一性と停止結果field。
 * @oracle 未登録・Host完了拒否では状態・Hostと後段処置を不変に保ち、同入力再入場の復帰と消費は各一回。元objectを保持し、別入力と清掃開始後completeを拒否する。
 * @cleanup finallyでModule mockを逆順復元する。実Docker・Host・Filesystem資源は作成しない。
 * @boundary 本番Owner公開入口と模擬下位境界。
 */
test("本番Ownerは復帰・清掃予定・終了保存の失敗から同じ元入力で再入場する", async () => {
  const management = Object.freeze({});
  const context = Object.freeze({});
  const cleanup = Object.freeze({});
  const mount = Object.freeze({});
  const completion = Object.freeze({});
  const hash = "a".repeat(64);
  const plan = Object.freeze({
    provider: "codex" as const,
    consumer: "workbench" as const,
    operationId: "OP-123456",
    grantRef: "PHMGRANT-ABCDEF",
    executionSelection: executionSelection("executor", {
      provider: "codex",
      model: "gpt-5.5",
      effort: "low",
    }),
    taskAttempt: 0 as const,
    providerHomeIdentityHash: hash,
    providerHomeProtectionHash: hash,
    localUserBindingHash: hash,
    stableLogicalHomeBindingHash: hash,
    authContainerName: `crdd-auth-${"a".repeat(16)}`,
    providerContainerName: `crdd-codex-${"a".repeat(16)}`,
    proxyContainerName: `crdd-proxy-${"a".repeat(16)}`,
    internalNetworkName: `crdd-internal-${"a".repeat(16)}`,
    egressNetworkName: `crdd-egress-${"a".repeat(16)}`,
    ownershipLabel: `crdd.coordinator.runtime=${"a".repeat(16)}`,
    providerImageDigest: `sha256:${hash}`,
    proxyImageDigest: `sha256:${hash}`,
    operationMode: "workbench_advice" as const,
    workspaceMountMode: null,
  });
  let operations: Array<Record<string, unknown>> = [];
  let hostState = "host_only";
  let restoreCalls = 0;
  let releaseCalls = 0;
  let capabilityCalls = 0;
  let consumeCalls = 0;
  let lifecycleFails = true;
  let pendingFails = true;
  let driverFails = true;
  let driverCalls = 0;
  let startSaveFails = false;
  let contextFails = false;
  let hostBeginFails = false;
  let hostCompleteFails = false;
  let rejectedHostCompletions = 0;
  let lifecycleCalls = 0;
  let isReleaseSucceeds = true;
  let startCalls = 0;
  let fixedInputs: unknown[] | null = null;
  let fixedCandidate: unknown = null;
  const providerNotice = Object.freeze({});
  let savedLifecycle: unknown = null;
  let lifecycleConfirmed = true;
  let lifecycleLockReleased = true;
  let isProjectDelivery = false;
  let resultReadLockReleased = true;
  const projectResult = Object.freeze({
    repositoryBinding: hash,
    operationId: "upper-operation",
    recoveryId: "exact-id",
    resultId: "b".repeat(64),
    consumer: "orchestrator",
  });
  const hostSubmission = await import("../../src/execution/controller.ts");
  const mocks = [
    mock.module(
      new URL("../../src/execution/controller.ts", import.meta.url).href,
      {
        namedExports: {
          ...hostSubmission,
          beginRuntimeOwnedCoordinatorHostSubmission: () => {
            startCalls++;
            if (hostBeginFails)
              return {
                status: "blocked",
                reason: "host_begin_save_failed",
                hostTransitionConfirmed: false,
              };
            hostState = "docker_submission_started";
            return { status: "completed", hostTransitionConfirmed: true };
          },
          completeRuntimeOwnedCoordinatorHostSubmission: () => {
            if (hostCompleteFails) {
              rejectedHostCompletions++;
              return { status: "blocked", hostTransitionConfirmed: false };
            }
            restoreCalls++;
            hostState = "host_only";
            return { status: "completed", hostTransitionConfirmed: true };
          },
        },
      },
    ),
    mock.module(
      new URL("../../src/execution/observation.ts", import.meta.url).href,
      {
        namedExports: {
          ...controller,
          verifyRuntimeOwnedDockerProviderSubmissionNotice: (
            notice: unknown,
            _capability: unknown,
            owner: unknown,
            operationId: unknown,
            recoveryId: unknown,
          ) =>
            notice === providerNotice &&
            owner === management &&
            operationId === plan.operationId &&
            recoveryId === "exact-id",
        },
      },
    ),
    mock.module(
      new URL("../../src/execution/diagnostics.ts", import.meta.url).href,
      {
        namedExports: {
          ...development,
          inspectRuntimeOwnedDevelopmentOperationContext: () => null,
        },
      },
    ),
    mock.module(
      new URL("../../src/execution/authority.ts", import.meta.url).href,
      {
        namedExports: {
          ...homes,
          inspectRuntimeOwnedWindowsProviderHomeCandidate: () => ({
            status: "candidate",
            observationCapability: {},
          }),
          consumeRuntimeOwnedProviderHomeObservationCapability: () => plan,
        },
      },
    ),
    mock.module(
      new URL("../../src/execution/kernel-lock.ts", import.meta.url).href,
      {
        namedExports: {
          ...locks,
          acquireRuntimeOwnedLogicalProviderHomeKernelLock: () => ({
            release: () => {
              releaseCalls++;
              return isReleaseSucceeds;
            },
          }),
        },
      },
    ),
    mock.module(
      new URL("../../src/execution/operation.ts", import.meta.url).href,
      {
        namedExports: {
          ...repository,
          ...hostRuntime,
          borrowRuntimeOwnedCoordinatorStateRepository: () => ({
            operationId: plan.operationId,
            repositoryBinding: hash,
            revalidate: () => true,
          }),
          verifyOwnedOperationManagementCapability: () => ({
            operationId: plan.operationId,
          }),
          borrowOwnedHostRecoverySnapshot: () => ({
            snapshot: { token: "host-token", record: { state: hostState } },
            hostPaths: {},
          }),
          issueOwnedHostCleanupCapability: () => {
            capabilityCalls++;
            return {};
          },
          consumeOwnedHostRecoveryIdForCleanup: () => {
            consumeCalls++;
            return "host-token";
          },
        },
      },
    ),
    mock.module(new URL("../../src/storage/state.ts", import.meta.url).href, {
      namedExports: {
        ...stateModel,
        prepareCoordinatorStateOperationSnapshot: (
          _before: unknown,
          identityJson: string,
        ) =>
          Buffer.from(
            JSON.stringify({
              operations: [
                { kind: "docker_task", recoveryId: "exact-id", identityJson },
              ],
            }),
          ),
        decodeCoordinatorStateSnapshot: (bytes: Buffer) => ({
          snapshot: JSON.parse(bytes.toString("utf8")),
        }),
        prepareCoordinatorStateHostSnapshot: () =>
          Buffer.from("pending-candidate"),
        readRuntimeOwnedCoordinatorStateSnapshot: () => ({
          status: "completed",
          lockReleased: true,
          value: { snapshot: { operations } },
        }),
        saveRuntimeOwnedCoordinatorOperationStart: (
          _management: unknown,
          identityJson: string,
        ) => {
          operations = [
            {
              kind: "docker_task",
              recoveryId: "exact-id",
              identityJson,
              phase: "executing",
              lease: "held",
              execution: {
                providerStart: "not_started",
                externalSend: "not_issued",
                sharedWrite: "not_issued",
                ownerEffect: "active",
                workspaceReusable: false,
              },
              primaryFailure: null,
              outcome: null,
              summarySha256: null,
              host: {
                currentToken: "host-token",
                pendingTransitionJson: null,
                cleanup: "not_requested",
              },
            },
          ];
          return {
            status: startSaveFails ? "blocked" : "completed",
            reason: startSaveFails ? "start_save_failed" : "saved",
            snapshotConfirmed: !startSaveFails,
            lockReleased: true,
            recoveryId: "exact-id",
          };
        },
        checkpointRuntimeOwnedCoordinatorLifecycle: (
          _owner: unknown,
          _recoveryId: unknown,
          value: unknown,
        ) => {
          lifecycleCalls++;
          savedLifecycle = value;
          return lifecycleFails
            ? {
                status: "blocked",
                snapshotConfirmed: false,
                lockReleased: true,
              }
            : {
                status: "completed",
                snapshotConfirmed: lifecycleConfirmed,
                lockReleased: lifecycleLockReleased,
              };
        },
        writeRuntimeOwnedCoordinatorStateSnapshot: (
          _management: unknown,
          candidate: unknown,
        ) => {
          if (fixedCandidate) assert.equal(candidate, fixedCandidate);
          fixedCandidate = candidate;
          if (pendingFails)
            return {
              status: "blocked",
              snapshotConfirmed: false,
              lockReleased: true,
            };
          assert.ok(operations[0]);
          operations[0].host = {
            currentToken: "host-token",
            pendingTransitionJson: null,
            cleanup: "pending",
          };
          operations[0].lease = "released";
          return {
            status: "completed",
            snapshotConfirmed: true,
            lockReleased: true,
          };
        },
      },
    }),
    mock.module(
      new URL("../../src/execution/settlement.ts", import.meta.url).href,
      {
        namedExports: {
          prepareRuntimeOwnedCoordinatorSettlement: () =>
            contextFails ? null : context,
          readRuntimeOwnedCoordinatorSettlementResult: (
            receivedContext: unknown,
            consumer: unknown,
          ) => {
            assert.equal(receivedContext, context);
            assert.equal(consumer, "orchestrator");
            return {
              status: "completed",
              lockReleased: resultReadLockReleased,
              value: projectResult,
            };
          },
          captureRuntimeOwnedCoordinatorSettlementInputs: (
            _context: unknown,
            host: unknown,
            docker: unknown,
          ) => {
            if (fixedInputs)
              return fixedInputs[0] === host && fixedInputs[1] === docker;
            if (host !== cleanup || docker !== completion) return false;
            fixedInputs = [host, docker];
            return true;
          },
          settleRuntimeOwnedCoordinatorResult: (
            _context: unknown,
            host: unknown,
            docker: unknown,
          ) => {
            driverCalls++;
            assert.equal(host, cleanup);
            assert.equal(docker, completion);
            return {
              status: driverFails ? "blocked" : "completed",
              filesystemEffectIssued: true,
              deliveryPending: isProjectDelivery,
            };
          },
        },
      },
    ),
  ];
  try {
    const runtimeUrl = new URL(
      "../../src/execution/recovery.ts",
      import.meta.url,
    );
    runtimeUrl.search = "?owner-reentry";
    const runtime = (await import(
      runtimeUrl.href
    )) as typeof import("../../src/execution/recovery.ts");
    const unregisteredBefore = structuredClone(operations);
    const unregisteredHost = hostState;
    assert.deepEqual(
      runtime.completeRuntimeOwnedDockerRecovery(
        Object.freeze({}),
        Object.freeze({}),
        undefined,
      ),
      { status: "blocked" },
    );
    assert.equal(restoreCalls, 0);
    assert.equal(releaseCalls, 0);
    assert.equal(lifecycleCalls, 0);
    assert.equal(capabilityCalls, 0);
    assert.deepEqual(operations, unregisteredBefore);
    assert.equal(hostState, unregisteredHost);
    const begun = runtime.beginRuntimeOwnedDockerRecovery(plan, management);
    assert.ok(begun && "recoveryCapability" in begun);
    const capability = begun.recoveryCapability;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission({}, providerNotice),
      false,
    );
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability, {}),
      false,
    );
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    lifecycleFails = false;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      true,
    );
    assert.deepEqual(savedLifecycle, {
      phase: "executing",
      lease: "held",
      execution: {
        providerStart: "unknown",
        externalSend: "unknown",
        sharedWrite: "unknown",
        ownerEffect: "active",
        workspaceReusable: false,
      },
      primaryFailure: null,
      outcome: null,
      summarySha256: null,
    });
    lifecycleConfirmed = false;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    lifecycleConfirmed = true;
    lifecycleLockReleased = false;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    lifecycleLockReleased = true;
    assert.ok(operations[0]);
    operations[0].execution = {
      providerStart: "started",
      externalSend: "issued",
      sharedWrite: "possible",
      ownerEffect: "active",
      workspaceReusable: false,
    };
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      true,
    );
    assert.deepEqual(
      (savedLifecycle as { execution: unknown }).execution,
      operations[0].execution,
    );
    operations[0].summarySha256 = hash;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    operations[0].summarySha256 = null;
    operations[0].phase = "settled";
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(
        capability,
        providerNotice,
      ),
      false,
    );
    operations[0].phase = "executing";
    lifecycleFails = true;
    assert.equal(
      runtime.recordRuntimeOwnedNormalMountCompletion(capability, mount),
      true,
    );
    const raw = { plan, cleanupOutcome: cleanup, mountCompletion: mount };
    const refusedBefore = structuredClone(operations);
    const refusedHost = hostState;
    const refusedCounts = [
      restoreCalls,
      releaseCalls,
      lifecycleCalls,
      capabilityCalls,
    ];
    hostCompleteFails = true;
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "blocked",
    );
    assert.equal(rejectedHostCompletions, 1);
    assert.deepEqual(
      [restoreCalls, releaseCalls, lifecycleCalls, capabilityCalls],
      refusedCounts,
    );
    assert.deepEqual(operations, refusedBefore);
    assert.equal(hostState, refusedHost);
    assert.equal(
      runtime.verifyRuntimeOwnedDockerHomeLeaseRelease(
        capability,
        management,
        plan.operationId,
        begun.recoveryId,
      ),
      false,
    );
    assert.equal(
      runtime.prepareRuntimeOwnedDockerHostCleanup(capability),
      null,
    );
    assert.deepEqual(operations, refusedBefore);
    assert.deepEqual(
      [restoreCalls, releaseCalls, lifecycleCalls, capabilityCalls],
      refusedCounts,
    );
    hostCompleteFails = false;
    for (const [owner, value] of [
      [{}, raw],
      [management, { ...raw, mountCompletion: {} }],
      [management, undefined],
    ]) {
      const beforeCounts: number[] = [
        restoreCalls,
        releaseCalls,
        lifecycleCalls,
        capabilityCalls,
      ];
      const beforeOperations = structuredClone(operations);
      const beforeHost = hostState;
      assert.equal(
        runtime.completeRuntimeOwnedDockerRecovery(capability, owner, value)
          .status,
        "blocked",
      );
      assert.equal(restoreCalls, 0);
      assert.equal(releaseCalls, 0);
      assert.deepEqual(
        [restoreCalls, releaseCalls, lifecycleCalls, capabilityCalls],
        beforeCounts,
      );
      assert.deepEqual(operations, beforeOperations);
      assert.equal(hostState, beforeHost);
    }
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "blocked",
    );
    assert.equal(restoreCalls, 1);
    lifecycleFails = false;
    for (const fault of ["snapshot", "release"]) {
      lifecycleConfirmed = fault !== "snapshot";
      lifecycleLockReleased = fault !== "release";
      assert.equal(
        runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
          .status,
        "blocked",
      );
      assert.equal(capabilityCalls, 0);
      assert.equal(releaseCalls, 1);
    }
    lifecycleConfirmed = true;
    lifecycleLockReleased = true;
    for (const value of [
      { ...raw, cleanupOutcome: {} },
      { ...raw, plan: { ...plan } },
      { ...raw, mountCompletion: {} },
    ]) {
      assert.equal(
        runtime.completeRuntimeOwnedDockerRecovery(
          capability,
          management,
          value,
        ).status,
        "blocked",
      );
      assert.equal(restoreCalls, 1);
      assert.equal(releaseCalls, 1);
      assert.equal(capabilityCalls, 0);
    }
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "completed",
    );
    assert.equal(restoreCalls, 1);
    assert.equal(releaseCalls, 1);
    assert.equal(capabilityCalls, 1);
    assert.ok(operations[0]);
    operations[0].lease = "released";
    assert.equal(
      runtime.prepareRuntimeOwnedDockerHostCleanup(capability),
      null,
    );
    assert.equal(consumeCalls, 1);
    pendingFails = false;
    assert.equal(
      runtime.prepareRuntimeOwnedDockerHostCleanup(capability),
      "host-token",
    );
    assert.equal(consumeCalls, 1);
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "blocked",
    );
    assert.equal(capabilityCalls, 1);
    assert.equal(
      runtime.recordRuntimeOwnedDockerHostCleanupReceipt(capability, {
        hostCleanupOutcome: cleanup,
        dockerCompletion: completion,
      }),
      false,
    );
    assert.equal(
      runtime.recordRuntimeOwnedDockerHostCleanupReceipt(capability, {
        hostCleanupOutcome: {},
        dockerCompletion: completion,
      }),
      false,
    );
    const stopped = runtime.finalizeRuntimeOwnedDockerRecovery(capability);
    assert.equal(stopped.status, "blocked");
    assert.ok("filesystemEffectIssued" in stopped);
    assert.equal(stopped.filesystemEffectIssued, true);
    assert.equal(
      runtime.readRuntimeOwnedDockerProjectResult(capability).status,
      "blocked",
    );
    driverFails = false;
    const beforeRetry = driverCalls;
    assert.equal(
      runtime.finalizeRuntimeOwnedDockerRecovery(capability).status,
      "completed",
    );
    assert.equal(driverCalls, beforeRetry + 1, "blocked結果は再入場する");
    assert.equal(
      runtime.finalizeRuntimeOwnedDockerRecovery(capability).status,
      "blocked",
    );
    operations = [];
    hostState = "host_only";
    fixedInputs = null;
    fixedCandidate = null;
    isProjectDelivery = true;
    const projectPlan = { ...plan, consumer: "orchestrator" as const };
    const projectBegun = runtime.beginRuntimeOwnedDockerRecovery(
      projectPlan,
      management,
    );
    assert.ok(projectBegun && "recoveryCapability" in projectBegun);
    const projectCapability = projectBegun.recoveryCapability;
    assert.equal(
      runtime.readRuntimeOwnedDockerProjectResult(projectCapability).status,
      "blocked",
    );
    assert.equal(
      runtime.recordRuntimeOwnedNormalMountCompletion(projectCapability, mount),
      true,
    );
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(
        projectCapability,
        management,
        {
          plan: projectPlan,
          cleanupOutcome: cleanup,
          mountCompletion: mount,
        },
      ).status,
      "completed",
    );
    assert.ok(operations[0]);
    operations[0].lease = "released";
    assert.equal(
      runtime.prepareRuntimeOwnedDockerHostCleanup(projectCapability),
      "host-token",
    );
    assert.equal(
      runtime.recordRuntimeOwnedDockerHostCleanupReceipt(projectCapability, {
        hostCleanupOutcome: cleanup,
        dockerCompletion: completion,
      }),
      true,
    );
    const beforeFinalize = driverCalls;
    driverFails = true;
    for (let repeat = 0; repeat < 2; repeat++) {
      const finalized =
        runtime.finalizeRuntimeOwnedDockerRecovery(projectCapability);
      assert.equal(finalized.status, "completed");
      assert.equal(
        "deliveryPending" in finalized && finalized.deliveryPending,
        true,
      );
      assert.equal(
        driverCalls,
        beforeFinalize,
        "同Ownerで確定した真正結果だけを再利用する",
      );
    }
    driverFails = false;
    for (const fake of [{}, { ...projectCapability }, "exact-id"])
      assert.equal(
        runtime.readRuntimeOwnedDockerProjectResult(fake).status,
        "blocked",
      );
    resultReadLockReleased = false;
    assert.equal(
      runtime.readRuntimeOwnedDockerProjectResult(projectCapability).value,
      null,
    );
    resultReadLockReleased = true;
    assert.equal(
      runtime.readRuntimeOwnedDockerProjectResult(projectCapability).value,
      projectResult,
    );
    assert.equal(
      Object.hasOwn(runtime, "completeRuntimeOwnedDockerProjectResultDelivery"),
      false,
      "元Ownerは結果参照を返すだけで、上位保存後の二段ACKを持たない",
    );
    isProjectDelivery = false;
    for (const failure of ["save", "context", "host"]) {
      operations = [];
      hostState = "host_only";
      startSaveFails = failure === "save";
      contextFails = failure === "context";
      hostBeginFails = failure === "host";
      isReleaseSucceeds = false;
      const startsBefore = startCalls;
      const failed = runtime.beginRuntimeOwnedDockerRecovery(plan, management);
      assert.ok(failed && "recoveryCapability" in failed);
      assert.equal(failed.status, "blocked");
      assert.equal(failed.recoveryId, "exact-id");
      const expectedStarts = startsBefore + (failure === "host" ? 1 : 0);
      assert.equal(startCalls, expectedStarts);
      if (failure === "host")
        assert.equal(failed.reason, "host_begin_save_failed");
      const failedCapability = failed.recoveryCapability;
      const stoppedResult = Object.freeze({ status: "blocked" });
      const failureReason = failed.reason;
      assert.equal(
        runtime.bindRuntimeOwnedDockerInitializationFailure(
          failedCapability,
          "exact-id",
          management,
          hash,
          failureReason,
          stoppedResult,
        ),
        true,
      );
      for (const [owner, reference, coordinatorManager, home, reason] of [
        [{}, "exact-id", management, hash, failureReason],
        [failedCapability, "other-id", management, hash, failureReason],
        [failedCapability, "exact-id", {}, hash, failureReason],
        [
          failedCapability,
          "exact-id",
          management,
          "b".repeat(64),
          failureReason,
        ],
        [failedCapability, "exact-id", management, hash, "other_failure"],
        [stoppedResult, "exact-id", management, hash, failureReason],
      ]) {
        assert.equal(
          runtime.bindRuntimeOwnedDockerInitializationFailure(
            owner,
            reference,
            coordinatorManager,
            home,
            reason,
            null,
          ),
          false,
        );
      }
      assert.equal(
        runtime.abandonRuntimeOwnedDockerRecovery(stoppedResult),
        false,
      );
      assert.equal(
        runtime.markRuntimeOwnedDockerResourceSubmission(
          stoppedResult,
          "create_provider",
        ),
        false,
      );
      assert.equal(
        runtime.verifyRuntimeOwnedDockerRecoveryBinding(
          failedCapability,
          "exact-id",
          management,
          hash,
        ),
        false,
      );
      assert.equal(
        runtime.markRuntimeOwnedDockerResourceSubmission(
          failedCapability,
          "create_provider",
        ),
        false,
      );
      assert.equal(
        runtime.completeRuntimeOwnedDockerRecovery(
          failedCapability,
          management,
          raw,
        ).status,
        "blocked",
      );
      assert.equal(
        runtime.abandonRuntimeOwnedDockerRecovery(failedCapability),
        false,
      );
      isReleaseSucceeds = true;
      const unresolvedBeforeAbandon = structuredClone(operations);
      const restorationsBeforeAbandon: number = restoreCalls;
      assert.equal(
        runtime.abandonRuntimeOwnedDockerRecovery(failedCapability),
        true,
      );
      assert.deepEqual(operations, unresolvedBeforeAbandon);
      assert.equal(restoreCalls, restorationsBeforeAbandon);
      assert.equal(
        runtime.verifyRuntimeOwnedDockerHomeLeaseRelease(
          failedCapability,
          management,
          plan.operationId,
          failed.recoveryId,
        ),
        false,
      );
      assert.equal(startCalls, expectedStarts);
    }
  } finally {
    for (const fixture of mocks.reverse()) fixture.restore();
  }
});

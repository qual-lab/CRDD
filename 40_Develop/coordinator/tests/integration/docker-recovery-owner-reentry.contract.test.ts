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

import assert from "node:assert/strict";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { mock, test } from "node:test";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { runInNewContext, runInThisContext } from "node:vm";
import type {
  ExecutionOperationRecord,
  ExecutionStateSnapshot,
} from "../../../execution-model/src/index.ts";
import * as stateModel from "../../../execution-model/src/index.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { acquireLock } from "../../../lock/src/index.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  requireReadyRepositoryExecutionDataArea,
} from "../../src/configuration/runtime-data.ts";
import * as homes from "../../src/execution/authority.ts";
import * as development from "../../src/execution/diagnostics.ts";
import * as locks from "../../src/execution/kernel-lock.ts";
import * as hostRuntime from "../../src/execution/operation.ts";
import * as repository from "../../src/execution/operation.ts";
import * as controller from "../../src/execution/provider-executor.ts";
import { loadHostRecoveryRecordByToken } from "../../src/execution/recovery.ts";
import type { RecoveryPlan } from "../../src/execution/types.ts";
import { snapshotJsonValue } from "../../src/input/snapshot.ts";
import { executionSelection } from "../fixtures/ai-selection.ts";
import { verifyNormalOwnerLifecycle } from "../fixtures/docker-owned-process-test-support.ts";
import { expectedHostCheckpoint } from "../fixtures/task-result-fixture.ts";
import { canonicalJson } from "../support/contract-assertions.ts";

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
  snapshot: ExecutionStateSnapshot,
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
  const initialBytes = Buffer.from(`${canonicalJson(snapshot)}\n`);
  const verified = {
    snapshot: JSON.parse(
      Buffer.from(
        initialBytes ?? assert.fail("missing_fixture_bytes"),
      ).toString("utf8"),
    ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
    payloadSha256: createHash("sha256")
      .update(initialBytes ?? assert.fail("missing_fixture_bytes"))
      .digest("hex"),
    sourceText: Buffer.from(
      initialBytes ?? assert.fail("missing_fixture_bytes"),
    ).toString("utf8"),
  };
  assert.ok(verified);
  const found = verified.snapshot.operations.find(
    (item): item is ExecutionOperationRecord =>
      item.kind === "docker_task" && item.recoveryId === recoveryId,
  );
  assert.ok(found);
  const target: ExecutionOperationRecord = found;
  const identity = JSON.parse(target.identityJson);
  const retiredCandidate = Buffer.from(
    `${canonicalJson({
      ...verified.snapshot,
      revision: verified.snapshot.revision + 1,
      previous: {
        revision: verified.snapshot.revision,
        payloadSha256: verified.payloadSha256,
      },
      operations: verified.snapshot.operations.map((item) =>
        item.recoveryId === recoveryId
          ? {
              ...item,
              phase: "settling",
              execution: { ...target.execution, ownerEffect: "disabled" },
            }
          : item,
      ),
    })}\n`,
  );
  // Schema検査はEM側で実施し、このCaseでは後続の公開操作と保存本文を検証する。
  const retired: Buffer = retiredCandidate;
  const pendingCandidate = expectedHostCheckpoint(
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
      snapshot:
        (JSON.parse(
          Buffer.from(
            currentBytes ?? assert.fail("missing_fixture_bytes"),
          ).toString("utf8"),
        ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot) ??
        assert.fail("fixture_snapshot_invalid"),
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
    Object.assign(record, {
      operationStates: record.snapshot.operations.map((operation) => ({
        kind: "docker_task",
        operation,
        resourcesSettled: true,
        restartSettled: true,
        authenticationClosureAllowed: false,
      })),
    });
    /**
     * 有限fixtureの既知本文とHashをReader応答代役へ投影する。
     * @responsibility 故障段階だけを一回変え、保存済み本文を暗黙に戻さない。
     * @trace PRL-IT-013
     * @precondition currentBytesは実modelの有効候補である。
     * @stimulus pending読戻し、削除直前、confirmed読戻しで指定故障を与える。
     * @observation 本文投影・Hash・lockReleasedと到達数。
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
          const candidate = expectedHostCheckpoint(
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
      const decoded = {
        snapshot: JSON.parse(
          Buffer.from(bytes ?? assert.fail("missing_fixture_bytes")).toString(
            "utf8",
          ),
        ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
      };
      assert.ok(decoded);
      const value = {
        ...decoded,
        // この有限Host試験は技術回収済みの操作だけを搬送する。
        operationStates: decoded.snapshot.operations.map((operation) => ({
          kind: "docker_task" as const,
          operation,
          resourcesSettled: true,
          restartSettled: true,
          authenticationClosureAllowed: false,
          hostTransition:
            operation.kind !== "docker_task" ||
            operation.host.pendingTransitionJson === null
              ? null
              : (() => {
                  const intent = JSON.parse(
                    operation.host.pendingTransitionJson,
                  );
                  return {
                    currentToken: intent.currentToken,
                    expectedToken: intent.expectedToken,
                    current: stateModel.parseHostRecoveryToken(
                      intent.currentToken,
                    ),
                    expected: stateModel.parseHostRecoveryToken(
                      intent.expectedToken,
                    ),
                  };
                })(),
        })),
        payloadSha256: createHash("sha256").update(bytes).digest("hex"),
        sourceText: bytes.toString("utf8"),
      };
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
          unsubmittedHostRecoveryIds: [recoveryId],
          value: { ...value, payloadSha256: "0".repeat(64) },
        };
      }
      return {
        status: "completed",
        lockReleased,
        value,
        // この有限fixtureは初期操作の退役・清掃進捗だけを与える。モデルの反証はEM側で行う。
        unsubmittedHostRecoveryIds: [recoveryId],
      };
    }
    const dependencies = {
      dockerRecoveryPreparations: preparations,
      snapshotJsonValue,
      isDeepStrictEqual,
      canonicalJson: canonicalJson,
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
      readState: (
        _root: unknown,
        envelope: {
          scope: "recovery";
          input?: { kind: string; recoveryId?: unknown };
        },
      ) => {
        assert.equal(envelope.scope, "recovery");
        const request = envelope.input ?? {
          kind: "current",
          recoveryId: undefined,
        };
        switch (request.kind) {
          case "host_cleanup":
            return readSnapshot();
          default:
            return readSnapshot();
        }
      },
      saveRecoveryCheckpoint: (
        repository: unknown,
        recoveryId: string,
        before: Buffer,
        request: Parameters<
          typeof import("../../../execution-model/src/index.ts").saveRecoveryCheckpoint
        >[3],
      ) => {
        switch (request.kind) {
          case "host_cleanup":
            return Reflect.apply(
              (
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
                const candidate = expectedHostCheckpoint(
                  currentBytes,
                  recoveryId,
                  { ...target.host, cleanup: "confirmed" },
                  snapshot.repositoryBinding,
                );
                assert.ok(candidate);
                currentBytes = candidate;
                finalCommits++;
                const saved = {
                  snapshot: JSON.parse(
                    Buffer.from(
                      currentBytes ?? assert.fail("missing_fixture_bytes"),
                    ).toString("utf8"),
                  ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
                  payloadSha256: createHash("sha256")
                    .update(
                      currentBytes ?? assert.fail("missing_fixture_bytes"),
                    )
                    .digest("hex"),
                  sourceText: Buffer.from(
                    currentBytes ?? assert.fail("missing_fixture_bytes"),
                  ).toString("utf8"),
                };
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
              undefined,
              [
                repository,
                recoveryId,
                before,
                request.assertAbsentOwner,
                request.publication,
              ],
            );
          default:
            if (!("value" in request))
              throw new Error("unexpected recovery kind");
            return Reflect.apply(
              (
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
                const candidate = expectedHostCheckpoint(
                  currentBytes,
                  recoveryId,
                  value,
                  snapshot.repositoryBinding,
                );
                assert.ok(candidate);
                currentBytes = candidate;
                pendingCommits++;
                const saved = {
                  snapshot: JSON.parse(
                    Buffer.from(
                      currentBytes ?? assert.fail("missing_fixture_bytes"),
                    ).toString("utf8"),
                  ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
                  payloadSha256: createHash("sha256")
                    .update(
                      currentBytes ?? assert.fail("missing_fixture_bytes"),
                    )
                    .digest("hex"),
                  sourceText: Buffer.from(
                    currentBytes ?? assert.fail("missing_fixture_bytes"),
                  ).toString("utf8"),
                };
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
              undefined,
              [
                repository,
                recoveryId,
                before,
                request.kind,
                request.value,
                request.assertOwner,
              ],
            );
        }
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
    assert.deepEqual(
      Buffer.from(`${canonicalJson(record.snapshot)}\n`),
      record.before,
      mode,
    );
    const value = {
      snapshot: JSON.parse(
        Buffer.from(
          currentBytes ?? assert.fail("missing_fixture_bytes"),
        ).toString("utf8"),
      ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
    };
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
    assert.equal(Object.hasOwn(value.snapshot, "pendingDeliveries"), false);
    assert.equal(Object.hasOwn(snapshot, "pendingDeliveries"), false);
    assert.equal(
      value.snapshot.operations.some((item) => item.recoveryId === recoveryId),
      true,
    );
    const operation = value.snapshot.operations.find(
      (item): item is ExecutionOperationRecord =>
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
    const actualValue = {
      snapshot: JSON.parse(
        Buffer.from(actual ?? assert.fail("missing_fixture_bytes")).toString(
          "utf8",
        ),
      ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
      payloadSha256: createHash("sha256")
        .update(actual ?? assert.fail("missing_fixture_bytes"))
        .digest("hex"),
      sourceText: Buffer.from(
        actual ?? assert.fail("missing_fixture_bytes"),
      ).toString("utf8"),
    };
    const expectedValue = {
      snapshot: JSON.parse(
        Buffer.from(expected ?? assert.fail("missing_fixture_bytes")).toString(
          "utf8",
        ),
      ) as import("../../../execution-model/src/index.ts").ExecutionStateSnapshot,
      payloadSha256: createHash("sha256")
        .update(expected ?? assert.fail("missing_fixture_bytes"))
        .digest("hex"),
      sourceText: Buffer.from(
        expected ?? assert.fail("missing_fixture_bytes"),
      ).toString("utf8"),
    };
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
  const confirmed = expectedHostCheckpoint(
    pending,
    recoveryId,
    { ...target.host, cleanup: "confirmed" },
    snapshot.repositoryBinding,
  );
  const extraPending = expectedHostCheckpoint(
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
    `${canonicalJson(changedHashSnapshot)}\n`,
  );
  // Schema検査はEM側で実施し、このCaseでは後続の公開操作と保存本文を検証する。
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
 * 同期readyを通知した自己生成子を、外部親がNode.js標準で停止する。
 * @responsibility ready、生存、停止要求、元子closeとstdio終了を分離する。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 自己生成Repositoryと固定workerだけを渡す。
 * @stimulus 親から所有ChildProcessへ終了要求を一回だけ発行する。
 * @observation 同PIDの単一packet、終了Signal、元子のclose。
 * @oracle 生存readyと終端全確認の後だけ、呼出し元がfresh回復へ進める。
 * @cleanup 失敗時も同じ元子を有界joinし、不明時はRootを保持する。
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
  let terminationRequested = false;
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
    terminationRequested = true;
    terminationRequests++;
    assert.equal(child.kill("SIGKILL"), true);
    await waitForOwnedProcessObservation(() => closed, 10_000);
    assert.equal(closed, true);
    assert.equal(signal, "SIGKILL");
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
        !terminationRequested &&
        child.exitCode === null &&
        child.signalCode === null
      ) {
        terminationRequested = true;
        terminationRequests++;
        cleanupFallbackIssued = true;
        cleanupFallbackAccepted = child.kill("SIGKILL");
        assert.equal(cleanupFallbackAccepted, true);
      }
    } catch (error) {
      cleanupFailure = error;
    }
    try {
      await waitForOwnedProcessObservation(() => closed, 10_000);
      assert.equal(child.stdout.readableEnded, true);
      assert.equal(child.stderr.readableEnded, true);
    } catch (error) {
      cleanupFailure ??= error;
    } finally {
      const releaseListeners = () => {
        child.stdout.off("data", onOutput).off("error", onError);
        child.stderr.off("data", onDiagnostic).off("error", onError);
        child.off("error", onError);
        child.off("close", onClose);
      };
      if (closed) releaseListeners();
      else child.once("close", releaseListeners);
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
 * @stimulus kill拒否・例外、元子close／stdio欠測、遅延closeを与える。
 * @observation 終端要求、fallback、同じ子、利用側への成功搬送とlistener数。
 * @oracle 不明な元子終了から成功を返さず、一次失敗と清掃失敗を保持する。
 * @cleanup VM・局所EventEmitterだけで実Processを作成しない。
 * @boundary 本番同等の試験helper本文と模擬Process通知。実tree終了の証明ではない。
 */
async function evaluateParentTerminationScenario(
  mode:
    | "delayed_close"
    | "kill_false"
    | "kill_throw"
    | "missing_close"
    | "missing_stdio",
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
  let killCalls = 0;
  let freshConsumerCalls = 0;
  let observations = 0;
  const child = Object.assign(new EventEmitter(), {
    pid: 12345,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    stdout: output,
    stderr: diagnostic,
    kill: (signal: string) => {
      killCalls++;
      calls.push("kill");
      assert.equal(signal, "SIGKILL");
      if (mode === "kill_false") return false;
      if (mode === "kill_throw") throw Error("synthetic_kill_failure");
      if (mode === "missing_close") child.exitCode = 1;
      return true;
    },
  });
  function finish(stdio: boolean) {
    output.readableEnded = stdio;
    diagnostic.readableEnded = stdio;
    child.exitCode = null;
    child.signalCode = "SIGKILL";
    closed = true;
    child.emit("close", null, "SIGKILL");
  }
  const candidate = runInNewContext(`(${source})`, {
    assert,
    AggregateError,
    Buffer,
    process: { execPath: "fixed-node" },
    spawn: () => {
      queueMicrotask(() =>
        output.emit(
          "data",
          JSON.stringify({
            pid: child.pid,
            phase: "parent_terminated",
            operationRoot: "fixed-root",
            recoveryId:
              "docker-task." +
              "a".repeat(64) +
              "." +
              "b".repeat(64) +
              "." +
              "c".repeat(64),
          }) + "\n",
        ),
      );
      return child;
    },
    waitForOwnedProcessObservation: async (observed: () => boolean) => {
      await Promise.resolve();
      observations++;
      calls.push(observations === 1 ? "wait_ready" : "wait_close");
      if (observations >= 2 && mode === "delayed_close") finish(true);
      if (observations >= 2 && mode === "missing_stdio") finish(false);
      if (!observed()) throw Error("fixture_observation_unconfirmed");
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
  // A late close is cleanup only and must not revise the settled failure.
  if (!closed) finish(true);
  assert.deepEqual(child.eventNames(), []);
  assert.deepEqual(output.eventNames(), []);
  assert.deepEqual(diagnostic.eventNames(), []);
  return { result, error, calls, closed, killCalls, freshConsumerCalls };
}

/**
 * 親終了の停止要求とclose／stdioを独立に反証する。
 * @responsibility killの受理だけで元子終了やfresh回復を成立させない。
 * @trace PRL-IT-013
 * @trace ERB-IT-003
 * @precondition 本文を局所Process通知へ接続する。
 * @stimulus kill拒否・例外、close／stdio欠測、遅延closeと停止要求省略を与える。
 * @observation 正常返却、一次／清掃失敗、停止回数と利用側到達。
 * @oracle 正常な遅延closeだけ成功、拒否後に再要求せず後着closeで成功へ戻さない。
 * @cleanup 実Process・Filesystem・Dockerを作成しない。
 * @boundary 親停止試験の局所反証。実Host成功とは区別する。
 */
test("親停止はkill失敗と元子close／stdio欠測を成功へ補完しない", async () => {
  const positive = await evaluateParentTerminationScenario("delayed_close");
  assert.ok(positive.result);
  assert.equal(positive.result.status, null);
  assert.equal(positive.result.signal, "SIGKILL");
  assert.equal(positive.error, undefined);
  assert.equal(positive.killCalls, 1);
  assert.equal(positive.freshConsumerCalls, 1);
  for (const mode of [
    "kill_false",
    "kill_throw",
    "missing_close",
    "missing_stdio",
  ] as const) {
    const failed = await evaluateParentTerminationScenario(mode);
    assert.equal(failed.result, null, mode);
    assert.ok(failed.error instanceof AggregateError, mode);
    assert.equal(failed.killCalls, 1, mode);
    assert.equal(failed.freshConsumerCalls, 0, mode);
  }
  const source = stripTypeScriptTypes(
    runExternallyTerminatedProducer.toString(),
  );
  const request = 'assert.equal(child.kill("SIGKILL"), true);';
  assert.ok(source.includes(request));
  const omitted = await evaluateParentTerminationScenario(
    "delayed_close",
    source.replace(request, 'assert.fail("stop_request_omitted");'),
  );
  assert.equal(omitted.result, null);
  assert.equal(omitted.freshConsumerCalls, 0);
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
/**
 * join済みの固定子だけが保持した試験Lockを、停止下で明示回収する。
 * @boundary 新品Root・有限な親子だけ。製品の自動Recoveryではない。
 */
function recoverStoppedFixtureLocks(root: string, pid: number, value: unknown) {
  assert.ok(Array.isArray(value));
  const removals: {
    file: string;
    identity: readonly string[];
    bytes: Buffer;
  }[] = [];
  for (const entry of value) {
    assert.equal(typeof entry.path, "string");
    const file = path.resolve(root, entry.path);
    const directory = path.dirname(file);
    assert.ok(
      [
        path.join(root, ".crdd", "tests"),
        path.join(root, ".crdd", "tests", "reentry-home-locks"),
        path.join(root, ".crdd", "tests", "reentry-runtime-locks"),
      ].includes(directory),
    );
    assert.equal(fs.realpathSync(directory), directory);
    assert.match(
      path.basename(file),
      /^(?:host-operation\.[a-f0-9]{64}|provider-home\.[a-f0-9]{64}|docker-state)\.lock$/u,
    );
    const bytes = Buffer.from(entry.bytes, "base64");
    const record = JSON.parse(bytes.toString());
    assert.equal(record.schema, "crdd-lock/v1");
    assert.equal(record.owner.processId, pid);
    assert.match(record.owner.processIdentity, /^[a-f0-9-]{36}$/u);
    assert.match(record.generation, /^[a-f0-9-]{36}$/u);
    const name = path.basename(file);
    assert.equal(
      record.identity,
      name === "docker-state.lock"
        ? "docker-state:shared"
        : name.slice(0, -5).replace(".", ":"),
    );
    const stat = fs.lstatSync(file, { bigint: true });
    assert.equal(stat.isFile(), true);
    assert.equal(stat.isSymbolicLink(), false);
    assert.equal(stat.nlink, 1n);
    assert.deepEqual(
      [stat.dev, stat.ino, stat.birthtimeNs].map(String),
      entry.identity,
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
    const blocked = acquireLock({
      directory,
      name: path.basename(file),
      identity: record.identity,
    });
    assert.equal(blocked.status, "blocked");
    assert.equal(blocked.reason, "lock_exists");
    assert.equal(
      removals.some((item) => item.file === file),
      false,
    );
    removals.push({ file, identity: entry.identity, bytes });
  }
  for (const { file, identity, bytes } of removals) {
    const current = fs.lstatSync(file, { bigint: true });
    assert.equal(current.isFile(), true);
    assert.equal(current.isSymbolicLink(), false);
    assert.equal(current.nlink, 1n);
    assert.deepEqual(
      [current.dev, current.ino, current.birthtimeNs].map(String),
      identity,
    );
    assert.deepEqual(fs.readFileSync(file), bytes);
    // 元子はjoin済みで、次の子は未起動。親はこのScopeの取得を行っていない。
    fs.unlinkSync(file);
    assert.throws(() => fs.lstatSync(file), { code: "ENOENT" });
  }
}

/** 停止下処置の照合失敗を、File削除0で確認する。実Filesystemは使わない。 */
test("停止下Lock回収は元通知・Scope・実体が不一致なら削除しない", () => {
  const source = fs.readFileSync(new URL(import.meta.url), "utf8");
  const start = source.indexOf("function recoverStoppedFixtureLocks(");
  const end = source.indexOf("\n/**", start);
  assert.ok(start > 0 && end > start);
  const body = stripTypeScriptTypes(source.slice(start, end));
  const factory = runInThisContext(
    `(function(fs, path, acquireLock, assert) { ${body}; return recoverStoppedFixtureLocks; })`,
  );
  for (const fault of [
    "none",
    "owner",
    "scope",
    "generation",
    "path",
    "file",
    "late_file",
    "content",
    "late_content",
    "link",
    "hardlink",
    "nonfile",
    "unobservable",
    "duplicate",
    "second_invalid",
  ] as const) {
    const root = path.resolve("fixture-root");
    const record = {
      schema: "crdd-lock/v1",
      identity: `host-operation:${"a".repeat(64)}`,
      owner: {
        processId: 100,
        processIdentity: "11111111-1111-4111-8111-111111111111",
      },
      generation: "22222222-2222-4222-8222-222222222222",
    };
    if (fault === "owner") record.owner.processId = 101;
    if (fault === "scope") record.identity = `provider-home:${"a".repeat(64)}`;
    if (fault === "generation") record.generation = "invalid";
    const bytes = Buffer.from(JSON.stringify(record));
    const entry = {
      path: path.join(
        ".crdd",
        "tests",
        `host-operation.${"a".repeat(64)}.lock`,
      ),
      identity: ["1", "2", "3"],
      bytes: bytes.toString("base64"),
    };
    if (fault === "path") entry.path = "../foreign.lock";
    let reads = 0,
      deleted = 0;
    const runtime = factory(
      {
        realpathSync: (value: string) => value,
        lstatSync: () => {
          if (deleted > 0)
            throw Object.assign(new Error("absent"), { code: "ENOENT" });
          if (fault === "unobservable")
            throw new Error("observation unavailable");
          reads++;
          return {
            dev: 1n,
            ino:
              fault === "file" || (fault === "late_file" && reads > 1)
                ? 99n
                : 2n,
            birthtimeNs: 3n,
            nlink: fault === "hardlink" ? 2n : 1n,
            isFile: () => fault !== "nonfile",
            isSymbolicLink: () => fault === "link",
          };
        },
        readFileSync: () =>
          fault === "content" || (fault === "late_content" && reads > 1)
            ? Buffer.from("changed")
            : bytes,
        unlinkSync: () => {
          deleted++;
        },
      },
      path,
      () => ({ status: "blocked", reason: "lock_exists" }),
      assert,
    );
    const notices =
      fault === "duplicate"
        ? [entry, entry]
        : fault === "second_invalid"
          ? [entry, { ...entry, path: "../foreign.lock" }]
          : [entry];
    if (fault === "none") {
      runtime(root, 100, notices);
      assert.equal(deleted, 1);
    } else {
      assert.throws(() => runtime(root, 100, notices));
      assert.equal(deleted, 0, fault);
    }
  }
});

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
    const area = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
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
      assert.equal(
        producer.signal,
        producerMode === "parent_terminated" ? "SIGKILL" : null,
      );
      assert.equal(
        producer.status,
        producerMode === "parent_terminated"
          ? null
          : producerMode === "producer" || producerMode === "cleanup_withheld"
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
          "root_invalid_after_state_read",
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
      const statePath = path.join(root, ".crdd", "domain-model", "state.json");
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
        assert.equal(target.resources, null);
        assert.equal(target.execution.providerStart, "not_started");
        assert.equal(target.execution.externalSend, "not_issued");
        assert.equal(target.execution.sharedWrite, "not_issued");
      }
      const identity = JSON.parse(target.identityJson);
      assert.equal(identity.operationNonce, emitted.recoveryId.split(".")[2]);
      if (producerMode === "state_saved") {
        verifyCurrentHostCleanupFailureBoundaries(before, emitted.recoveryId);
        const helper = sourceDeclaration(
          fs.readFileSync(
            new URL("../../src/execution/recovery.ts", import.meta.url),
            "utf8",
          ),
          "isUnsubmittedInitialTaskHost",
        );
        const evaluate = runInThisContext(
          "(function(){ " +
            stripTypeScriptTypes(helper) +
            "; return isUnsubmittedInitialTaskHost; })",
        )();
        assert.equal(
          evaluate(target, true, target.host.currentToken, "host_only"),
          true,
        );
        assert.equal(
          evaluate(target, false, target.host.currentToken, "host_only"),
          false,
        );
        for (const hostState of [
          "initializing",
          "docker_submission_started",
          "docker_absent_confirmed",
          "unknown",
        ])
          assert.equal(
            evaluate(target, true, target.host.currentToken, hostState),
            false,
          );
        assert.equal(evaluate(target, true, "different", "host_only"), false);
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
      if (producerMode !== "producer")
        recoverStoppedFixtureLocks(root, emitted.pid, emitted.locks);
      const releasedHomeAcquisition = locks.acquireProviderHomeLock(
        identity.stableLogicalHomeBindingHash,
        path.join(root, ".crdd", "tests", "reentry-home-locks"),
      );
      assert.ok(releasedHomeAcquisition.status === "acquired");
      const releasedHome = releasedHomeAcquisition.lock;
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
        const retired = Buffer.from(
          `${canonicalJson({
            ...before,
            revision: before.revision + 1,
            previous: {
              revision: before.revision,
              payloadSha256: createHash("sha256")
                .update(canonicalJson(before) + "\n")
                .digest("hex"),
            },
            operations: before.operations.map(
              (item: stateModel.OperationRecord) =>
                item.recoveryId === emitted.recoveryId
                  ? {
                      ...item,
                      phase: "settling",
                      execution: {
                        ...target.execution,
                        ownerEffect: "disabled",
                      },
                    }
                  : item,
            ),
          })}\n`,
        );
        // Schema検査はEM側で実施し、このCaseでは後続の公開操作と保存本文を検証する。
        // 初回Intent前のexactな初期記録には資源Writerを発行しない。
        assert.equal(target.resources, null);
        const resourcesConfirmed = retired;
        const retriedResourcesConfirmed = retired;
        const expectedPending = expectedHostCheckpoint(
          retriedResourcesConfirmed,
          emitted.recoveryId,
          { ...target.host, cleanup: "pending" },
          before.repositoryBinding,
        );
        assert.ok(expectedPending);
        const expectedRemoval = expectedPending;
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
        assert.equal(
          Object.hasOwn(removalSnapshot, "pendingDeliveries"),
          false,
        );
        assert.equal(
          Object.hasOwn(pendingSnapshot, "pendingDeliveries"),
          false,
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
          // 資源未要求なので資源Writerを発行しない。Owner失効とHost意図だけ。
          const expectedKinds =
            interruption === "pending_writer_blocked"
              ? ["lifecycle", "host"]
              : interruption === "pending_saved"
                ? ["host"]
                : [];
          assert.deepEqual(packet.checkpointKinds, expectedKinds);
          assert.equal(packet.checkpointWriterCalls, expectedKinds.length);
          assert.equal(
            packet.actualCheckpointWriterCalls,
            expectedKinds.length -
              (interruption === "pending_writer_blocked" ? 1 : 0),
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
              ["native", "git"].includes(call),
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
          assert.equal(
            Object.hasOwn(interruptedState, "pendingDeliveries"),
            false,
          );
          assert.equal(Object.hasOwn(before, "pendingDeliveries"), false);
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
          if (!writerBlocked)
            recoverStoppedFixtureLocks(root, packet.pid, packet.locks);
          const leaseAcquisition = locks.acquireProviderHomeLock(
            identity.stableLogicalHomeBindingHash,
            path.join(root, ".crdd", "tests", "reentry-home-locks"),
          );
          assert.ok(leaseAcquisition.status === "acquired");
          const lease = leaseAcquisition.lock;
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
          ["native", "git"].includes(call),
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
      assert.equal(Object.hasOwn(after, "pendingDeliveries"), false);
      assert.equal(Object.hasOwn(before, "pendingDeliveries"), false);
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
    const area = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
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
      const statePath = path.join(root, ".crdd", "domain-model", "state.json");
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
      const auth = target.resources.snapshot.resources.find(
        (value: { key: string }) =>
          value.key === "create_subscription_auth_probe",
      );
      const checkpoint = target.resources.checkpoints.find(
        (value: { key: string }) => value.key === auth.key,
      );
      assert.equal(auth.request, "not_issued");
      assert.equal(auth.identity.dockerId, null);
      assert.deepEqual(checkpoint, {
        key: auth.key,
        submission: "intent_saved",
        receiptSource: null,
        observation: "unobserved",
        absenceEvidenceSha256: null,
      });
      const identity = JSON.parse(target.identityJson);
      for (const location of [
        identity.hostPaths.root,
        identity.hostPaths.marker,
      ])
        assert.equal(fs.lstatSync(location).isSymbolicLink(), false);
      for (const name of [
        "unexpected-finally",
        ".crdd/domain-model/state.lock",
        ".crdd/domain-model/state.pending.json",
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
 * @oracle 修復中のTask開始Writerは未保存・保存未確認・耐久Effectなし・Lock解放・元本文不変で拒否する。保持期限は七日で同ID再入場でも不変、保持物を再利用・削除せず、修復終了からの改訂・元版Hashと元修復履歴行を保全する。清掃前finalizeと複製結果は状態不変で拒否し、真正清掃後だけ対象を履歴化して現在状態から除く。
 * @cleanup 真正Ownerを放棄・解放し、確認済み自己生成HostとRepositoryだけを清掃する。
 * @boundary 実Owner／Kernel／Host／Writerと、模擬Docker cleanup・mount・terminal証明。
 */
for (const { repeatCount, retained } of [
  { repeatCount: 1, retained: false },
  { repeatCount: 1, retained: true },
  { repeatCount: 2, retained: false },
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
   * @oracle 修復中のTask開始Writerは未保存・保存未確認・耐久Effectなし・Lock解放・元本文不変で拒否する。保持期限は七日で同ID再入場でも不変、保持物を再利用・削除せず、修復終了からの改訂・元版Hashと元修復履歴行を保全する。清掃前finalizeと複製結果は状態不変で拒否し、真正清掃後だけ対象を履歴化して現在状態から除く。
   * @cleanup 真正Ownerを放棄・解放し、確認済み自己生成HostとRepositoryだけを清掃する。
   * @boundary 実Owner／Kernel／Host／Writerと、模擬Docker cleanup・mount・terminal証明。
   */
  test(`Host Windows: 正常Owner${repeatCount}回${retained ? "・保持あり" : ""}から実Home解放・Host清掃・結果保存まで結合する`, async (t) => {
    await verifyNormalOwnerLifecycle(t, repeatCount, retained);
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
  const source = fs.readFileSync(
    new URL(
      "../fixtures/docker-owned-process-test-support.ts",
      import.meta.url,
    ),
    "utf8",
  );
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
          fixtureHomeLease: null,
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
  let checkpointRevision = 1;
  let checkpointSaved = true,
    checkpointReleased = true,
    checkpointReadMatches = true;
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
  let fixedBefore: unknown = null;
  const providerNotice = Object.freeze({});
  let savedLifecycle: unknown = null;
  let lifecycleConfirmed = true;
  let lifecycleLockReleased = true;
  let taskBound = false;
  const hostSubmission = await import("../../src/execution/controller.ts");
  const hostPersistence = await import("../../src/execution/persistence.ts");
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
      new URL("../../src/execution/provider-executor.ts", import.meta.url).href,
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
          acquireProviderHomeLock: () => ({
            status: "acquired",
            lock: {
              release: () => {
                releaseCalls++;
                return isReleaseSucceeds;
              },
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
    mock.module(
      new URL("../../../execution-model/src/index.ts", import.meta.url).href,
      {
        namedExports: {
          ...stateModel,
          completeOperation: (
            _context: unknown,
            host: unknown,
            docker: unknown,
          ) => {
            const inputAccepted = fixedInputs
              ? fixedInputs[0] === host && fixedInputs[1] === docker
              : host === cleanup && docker === completion;
            if (!inputAccepted)
              return { status: "blocked", inputAccepted: false };
            fixedInputs = [host, docker];
            driverCalls++;
            assert.equal(host, cleanup);
            assert.equal(docker, completion);
            return {
              inputAccepted: true,
              status: driverFails ? "blocked" : "completed",
              filesystemEffectIssued: true,
              operationRetained: taskBound,
            };
          },
        },
      },
    ),
    mock.module(
      new URL("../../src/execution/persistence.ts", import.meta.url).href,
      {
        namedExports: {
          ...Object.fromEntries(
            Object.entries(hostPersistence).map(([name, value]) => [
              name,
              typeof value === "function"
                ? () => {
                    throw new Error(`unexpected_storage_call:${name}`);
                  }
                : value,
            ]),
          ),
          readOperationStateStage: (
            _owner: unknown,
            request?: {
              kind: string;
              recoveryId?: unknown;
              identityJson?: unknown;
            },
          ) =>
            request?.kind === "operation_start"
              ? {
                  kind: "operation_start",
                  status: "completed",
                  lockReleased: true,
                  value: null,
                  operationIdentity: {
                    recoveryId: "exact-id",
                    operationId: JSON.parse(request.identityJson as string)
                      .operationId,
                    identitySha256: createHash("sha256")
                      .update(request.identityJson as string)
                      .digest("hex"),
                  },
                }
              : {
                  status: "completed",
                  lockReleased: true,
                  value: {
                    snapshot: { operations, revision: checkpointRevision },
                    payloadSha256: checkpointReadMatches
                      ? hash
                      : "b".repeat(64),
                  },
                  hostCleanupPreparation:
                    request?.kind === "host_cleanup" &&
                    operations[0]?.lease === "released" &&
                    (operations[0].host as { cleanup: unknown }).cleanup ===
                      "not_requested"
                      ? {
                          recoveryId: "exact-id",
                          hostToken: "host-token",
                          before: Buffer.from(
                            `${canonicalJson({ operations, revision: checkpointRevision })}\n`,
                          ),
                        }
                      : null,
                },
          saveOperationCheckpoint: (
            owner: unknown,
            recoveryId: unknown,
            request: { kind: string; value: unknown },
          ) => {
            if (request.kind === "cleanup")
              return (() => ({
                status: "completed",
                snapshotConfirmed: checkpointSaved,
                lockReleased: checkpointReleased,
                revision: checkpointRevision,
                payloadSha256: hash,
              }))();
            if (request.kind === "lifecycle")
              return ((
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
              })(owner, recoveryId, request.value);
            throw new Error("unexpected_checkpoint_kind");
          },
          saveOperationStart: (_management: unknown, identityJson: string) => {
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
              status: startSaveFails || contextFails ? "blocked" : "completed",
              reason: startSaveFails
                ? "start_save_failed"
                : contextFails
                  ? "docker_recovery_settlement_binding_invalid"
                  : "saved",
              startSaved: !startSaveFails,
              completionContext: contextFails ? null : context,
              snapshotConfirmed: !startSaveFails,
              lockReleased: true,
              recoveryId: "exact-id",
            };
          },
          saveHostCleanupPreparation: (
            _management: unknown,
            recoveryId: unknown,
            before: unknown,
          ) => {
            assert.equal(recoveryId, "exact-id");
            if (fixedBefore) assert.equal(before, fixedBefore);
            fixedBefore = before;
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
    assert.equal(runtime.recordRuntimeOwnedDockerProviderSubmission({}), false);
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability),
      false,
    );
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability),
      false,
    );
    lifecycleFails = false;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability),
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
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability),
      false,
    );
    lifecycleConfirmed = true;
    lifecycleLockReleased = false;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability),
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
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability),
      true,
    );
    assert.deepEqual(
      (savedLifecycle as { execution: unknown }).execution,
      operations[0].execution,
    );
    operations[0].summarySha256 = hash;
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability),
      false,
    );
    operations[0].summarySha256 = null;
    operations[0].phase = "settled";
    assert.equal(
      runtime.recordRuntimeOwnedDockerProviderSubmission(capability),
      false,
    );
    operations[0].phase = "executing";
    lifecycleFails = true;
    assert.equal(
      runtime.recordRuntimeOwnedNormalMountCompletion(capability, mount),
      true,
    );
    const raw = { plan, mountCompletion: mount };
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "blocked",
    );
    assert.equal(restoreCalls, 0);
    for (const fault of ["snapshot", "release", "fresh"]) {
      checkpointSaved = fault !== "snapshot";
      checkpointReleased = fault !== "release";
      checkpointReadMatches = fault !== "fresh";
      assert.equal(
        runtime.recordRuntimeOwnedDockerAbsence(capability, []),
        false,
      );
    }
    checkpointSaved = checkpointReleased = checkpointReadMatches = true;
    assert.equal(runtime.recordRuntimeOwnedDockerAbsence(capability, []), true);
    assert.equal(
      runtime.recordRuntimeOwnedDockerAbsence(capability, []),
      false,
    );
    checkpointRevision++;
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "blocked",
    );
    assert.equal(restoreCalls, 0);
    checkpointRevision--;
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
    // Homeの実解放はExecutorが所有し、Coordinatorは完了通知を記録するだけ。
    const technical = runtime.recordRuntimeOwnedAttemptCleanup({
      plan: plan as unknown as RecoveryPlan,
      recoveryCapability: capability,
      managementCapability: management,
      recoveryId: "exact-id",
      resourceSnapshot: { resources: [] },
      observations: [],
      mountCompletion: null,
      mountLeaseReleased: false,
      homeLeaseReleased: true,
    });
    assert.equal(technical.homeLeaseReleased, true);
    for (const fault of ["snapshot", "release"]) {
      lifecycleConfirmed = fault !== "snapshot";
      lifecycleLockReleased = fault !== "release";
      assert.equal(
        runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
          .status,
        "blocked",
      );
      assert.equal(capabilityCalls, 0);
      assert.equal(releaseCalls, 0);
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
      assert.equal(releaseCalls, 0);
      assert.equal(capabilityCalls, 0);
    }
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(capability, management, raw)
        .status,
      "completed",
    );
    assert.equal(restoreCalls, 1);
    assert.equal(releaseCalls, 0);
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
    runtime.recordRuntimeOwnedDockerTerminalObservation(
      capability,
      completion,
      {
        operationId: plan.operationId,
        recoveryId: "exact-id",
        resourceSnapshot: { resources: [] },
        resources: [],
        primaryFailure: null,
        processTreeTerminationConfirmed: true,
        containersAbsent: true,
        networksAbsent: true,
        mountLeaseReleased: true,
        recoveryCompleted: true,
        homeLeaseReleased: true,
      },
    );
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
    fixedBefore = null;
    taskBound = true;
    const projectPlan = { ...plan, consumer: "orchestrator" as const };
    const projectBegun = runtime.beginRuntimeOwnedDockerRecovery(
      projectPlan,
      management,
    );
    assert.ok(projectBegun && "recoveryCapability" in projectBegun);
    const projectCapability = projectBegun.recoveryCapability;
    assert.equal(
      runtime.recordRuntimeOwnedDockerAbsence(projectCapability, []),
      true,
    );

    assert.equal(
      runtime.recordRuntimeOwnedNormalMountCompletion(projectCapability, mount),
      true,
    );
    assert.equal(
      runtime.recordRuntimeOwnedAttemptCleanup({
        plan: projectPlan as unknown as RecoveryPlan,
        recoveryCapability: projectCapability,
        managementCapability: management,
        recoveryId: "exact-id",
        resourceSnapshot: { resources: [] },
        observations: [],
        mountCompletion: null,
        mountLeaseReleased: false,
        homeLeaseReleased: true,
      }).homeLeaseReleased,
      true,
    );
    assert.equal(
      runtime.completeRuntimeOwnedDockerRecovery(
        projectCapability,
        management,
        {
          plan: projectPlan,
          mountCompletion: mount,
        },
      ).status,
      "completed",
    );
    runtime.recordRuntimeOwnedDockerTerminalObservation(
      projectCapability,
      completion,
      {
        operationId: projectPlan.operationId,
        recoveryId: "exact-id",
        resourceSnapshot: { resources: [] },
        resources: [],
        primaryFailure: null,
        processTreeTerminationConfirmed: true,
        containersAbsent: true,
        networksAbsent: true,
        mountLeaseReleased: true,
        recoveryCompleted: true,
        homeLeaseReleased: true,
      },
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
    const finalized =
      runtime.finalizeRuntimeOwnedDockerRecovery(projectCapability);
    assert.equal(finalized.status, "completed");
    assert.equal(
      "operationRetained" in finalized && finalized.operationRetained,
      true,
    );
    assert.equal(driverCalls, beforeFinalize, "確認済み終端を再保存しない");
    assert.equal(
      runtime.finalizeRuntimeOwnedDockerRecovery(projectCapability).status,
      "blocked",
    );
    for (const fake of [{}, { ...projectCapability }, "exact-id"])
      assert.equal(
        runtime.finalizeRuntimeOwnedDockerRecovery(fake).status,
        "blocked",
      );
    assert.equal(
      Object.hasOwn(runtime, "readRuntimeOwnedDockerProjectResult"),
      false,
    );
    assert.equal(
      Object.hasOwn(runtime, "completeRuntimeOwnedDockerProjectResultDelivery"),
      false,
    );
    taskBound = false;
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
          {
            snapshot: { resources: [] },
            cleanup: {
              cleanupOrder: [],
              setupTimeoutMs: 1000,
              unreceiptedAbsence: "retain",
              verifyLabelAbsence: false,
            },
          },
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
          {
            snapshot: { resources: [] },
            cleanup: {
              cleanupOrder: [],
              setupTimeoutMs: 1000,
              unreceiptedAbsence: "retain",
              verifyLabelAbsence: false,
            },
          },
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
      runtime.recordRuntimeOwnedAttemptCleanup({
        plan: plan as unknown as RecoveryPlan,
        recoveryCapability: failedCapability,
        managementCapability: management,
        recoveryId: "exact-id",
        resourceSnapshot: { resources: [] },
        observations: [],
        mountCompletion: null,
        mountLeaseReleased: false,
        homeLeaseReleased: true,
      });
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
        true,
      );
      assert.equal(startCalls, expectedStarts);
    }
  } finally {
    for (const fixture of mocks.reverse()) fixture.restore();
  }
});

/**
 * 完了結果の所見を、同じ上位Ownerの初回レビューだけへ結合する。
 * @responsibility 結果内容と次試行許可の発行条件を分離する。
 * @trace ERB-IT-003
 * @precondition メモリ内の元結果・既存Owner記録と所見を使用する。
 * @stimulus 正常、別結果、別相関、取消、清掃不明、二回目レビューを渡す。
 * @observation 既存許可発行関数の呼出し数と受け取った所見。
 * @oracle 同じ清掃済み初回レビューの原結果だけ一回の呼出しで発行する。
 * @cleanup N/A: 永続化、実Process、実AI、Dockerを使用しない。
 * @boundary 完了結果からCoordinatorの既存許可Ownerへの接続。
 */
test("レビュー所見からの是正許可は同じ終端結果と初回レビューへ限定する", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/recovery.ts", import.meta.url),
    "utf8",
  );
  const declaration = sourceDeclaration(
    source,
    "registerRuntimeOwnedReviewFindings",
  );
  for (const fault of [
    "none",
    "copy",
    "capability",
    "selection",
    "selection_hash",
    "selection_attempt",
    "selection_content",
    "operation",
    "terminal_missing",
    "terminal_operation",
    "terminal_recovery",
    "home",
    "mount",
    "recovery",
    "cleanup",
    "cancel",
    "blocked",
    "attempt1",
    "executor",
    "approved",
    "empty",
    "count",
    "restoration",
  ] as const) {
    const capability = Object.freeze({});
    const findings = Object.freeze([
      Object.freeze({ message: "SYNTHETIC_REVIEW_FINDING_PRIVATE" }),
    ]);
    const result = {
      status: "completed",
      cleanupConfirmed: true,
      cancellationRequested: false,
      operationId: "OP-123456",
      normalizedResult: { decision: "changes_requested", findingCount: 1 },
      reviewFindings: findings,
    };
    const plan = {
      operationId: "OP-123456",
      selectionRecordId: "selection",
      selectionHash: "selection-hash",
      executionSelection: { provider: "codex", modelIdentifier: "synthetic" },
      operationMode: "isolated_task",
      taskRole: "reviewer",
      taskAttempt: 0,
    };
    const terminal = {
      operationId: "OP-123456",
      recoveryId: "exact-recovery",
      homeLeaseReleased: true,
      mountLeaseReleased: true,
      recoveryCompleted: true,
    };
    const record = {
      managementCapability: {},
      operationId: "OP-123456",
      recoveryId: "exact-recovery",
      dockerCompletion: result,
      terminalObservation: terminal as typeof terminal | undefined,
      normalRestoration: { plan } as { plan: typeof plan } | undefined,
    };
    if (fault === "selection") plan.selectionRecordId = "other";
    if (fault === "selection_hash") plan.selectionHash = "other";
    if (fault === "selection_attempt") plan.taskAttempt = 1;
    if (fault === "selection_content")
      plan.executionSelection.modelIdentifier = "other";
    if (fault === "operation") result.operationId = "OP-654321";
    if (fault === "terminal_missing") record.terminalObservation = undefined;
    if (fault === "terminal_operation") terminal.operationId = "OP-654321";
    if (fault === "terminal_recovery") terminal.recoveryId = "other";
    if (fault === "home") terminal.homeLeaseReleased = false;
    if (fault === "mount") terminal.mountLeaseReleased = false;
    if (fault === "recovery") terminal.recoveryCompleted = false;
    if (fault === "cleanup") result.cleanupConfirmed = false;
    if (fault === "cancel") result.cancellationRequested = true;
    if (fault === "blocked") result.status = "blocked";
    if (fault === "attempt1") plan.taskAttempt = 1;
    if (fault === "executor") plan.taskRole = "executor";
    if (fault === "approved") result.normalizedResult.decision = "approved";
    if (fault === "empty") result.reviewFindings = Object.freeze([]);
    if (fault === "count") result.normalizedResult.findingCount = 2;
    if (fault === "restoration") record.normalRestoration = undefined;
    let issued = 0;
    const permit = Object.freeze({});
    const register = runInNewContext(
      `${declaration}\nregisterRuntimeOwnedReviewFindings`,
      {
        durableRecord: (c: object) => (c === capability ? record : null),
        borrowOwnedOperationExecutionSelection: (
          owner: unknown,
          id: unknown,
          hash: unknown,
          attempt: unknown,
          selection: { modelIdentifier: string },
        ) =>
          owner === record.managementCapability &&
          id === "selection" &&
          hash === "selection-hash" &&
          attempt === 0 &&
          selection.modelIdentifier === "synthetic"
            ? selection
            : null,
        registerTaskRemediation: (
          id: string,
          attempt: number,
          value: unknown,
        ) => {
          issued++;
          assert.equal(id, record.operationId);
          assert.equal(attempt, 0);
          assert.equal(value, findings);
          return permit;
        },
      },
    );
    const returned = register(
      fault === "capability" ? {} : capability,
      fault === "copy" ? { ...result } : result,
    );
    assert.equal(returned, fault === "none" ? permit : null, fault);
    assert.equal(issued, fault === "none" ? 1 : 0, fault);
  }
});

/**
 * 回復子の初回Intent前の前提を、実子本文のReader断片で確認する。
 * @responsibility null Bookを未作成の断定や旧配列へ変換しない。
 * @trace ERB-IT-014
 * @boundary Source内の前提だけ。実Host・Native・Dockerには接続しない。
 */
test("回復子は初回Intent前のnull Bookだけを受け付ける", () => {
  const source = fs.readFileSync(
    new URL("../fixtures/docker-recovery-abandon-worker.ts", import.meta.url),
    "utf8",
  );
  const matches = [
    ...source.matchAll(
      /const target = before\.operations\.find\([\s\S]*?(?=[ ]{2}const identity = JSON\.parse\(target\.identityJson\);)/gu,
    ),
  ];
  assert.equal(matches.length, 1);
  const body = matches[0]?.[0];
  assert.ok(body);
  for (const resources of [
    null,
    [],
    { snapshot: { resources: [] }, checkpoints: [] },
  ]) {
    const run = (): unknown =>
      runInNewContext(
        stripTypeScriptTypes(`(()=>{${body};return target;})()`),
        {
          assert,
          id: "exact-recovery",
          before: { operations: [{ recoveryId: "exact-recovery", resources }] },
        },
      );
    if (resources === null) {
      const actual = run();
      assert.ok(actual && typeof actual === "object" && "resources" in actual);
      assert.equal(actual.resources, null);
    } else assert.throws(run);
  }
});

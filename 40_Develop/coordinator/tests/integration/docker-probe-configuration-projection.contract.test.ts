/**
 * Probe回復の元Snapshot搬送を確認する。
 * @packageDocumentation
 * @responsibility DIの元構成と回復参照を維持し、不明時にHostを削除しない。
 * @trace ERB-IT-004
 * @level IT
 * @scope 有限Host／Executor代役。実Docker・実AIなし。
 * @boundary EMの元記録→Coordinator→既存Executor資源入口。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";

/**
 * 元構成と同じ資源入口を使い、不明・Receipt欠測でHost回収を拒否する。
 * @responsibility 回復ID・Snapshot・回収条件とOwnerの搬送を確認する。
 * @trace ERB-IT-004
 * @precondition 現回復本文と各Case独立の有限代役を使用する。
 * @stimulus 技術終了不明、Receipt欠測、現在Owner喪失を与える。
 * @observation 元ID・構成・処置回数・返却参照。
 * @oracle 元Snapshotを加工せず渡し、Host削除0・保存0・一回解放を維持する。
 * @cleanup 全Promiseを待機する。実資源なし。
 */
test("Probe回復は元SnapshotをExecutorへ渡し不明時にHostを削除しない", async () => {
  const body = sourceDeclaration(
    fs.readFileSync(
      new URL("../../src/lifecycle/environment.ts", import.meta.url),
      "utf8",
    ),
    "recoverDockerIsolationProbe",
  );
  assert.doesNotMatch(
    body,
    /createDockerProbeRuntimeBinding|inspectDockerContainer|cleanupDockerContainer/u,
  );
  for (const scenario of ["unknown", "receipt_missing", "owner_lost"]) {
    const recoveryId = "host-operation.OP-123";
    const generation = {};
    const snapshot = { resources: [{ key: "container", id: "a".repeat(64) }] };
    const cleanup = { expectedUser: "1000", expectedInit: true };
    const resources = {
      snapshot,
      cleanup,
      checkpoints: [
        {
          key: "container",
          submission: "intent_saved",
          receiptSource: scenario === "receipt_missing" ? null : "callback",
          observation: "unknown",
        },
      ],
    };
    let submissions = 0,
      hostCleanups = 0,
      saves = 0,
      releases = 0;
    const recover = runInNewContext(
      `(()=>{${body};return recoverDockerIsolationProbe})()`,
      {
        Object,
        Error,
        acquireHostOperationRecoveryGeneration: (
          _repository: unknown,
          id: string,
        ) => {
          assert.equal(id, recoveryId);
          return generation;
        },
        readHostRecoveryOperation: (owner: object) => {
          assert.equal(owner, generation);
          return { record: { purpose: "isolation_probe", resources } };
        },
        observeHostRecoveryRoot: () => "present",
        borrowHostRecoveryManagementDirectory: (id: string, owner: object) => {
          assert.equal(id, recoveryId);
          assert.equal(owner, generation);
          return {
            directory: "managed-directory",
            assertCurrent: () => scenario !== "owner_lost",
          };
        },
        getIsolationSettings: () => ({}),
        cleanupResources: (
          target: {
            resources: unknown;
            managementDirectory: string;
            expectedUser: string;
            expectedInit: boolean;
          },
          _settings: unknown,
          callbacks: { onCleanupSubmitting(): void },
        ) => {
          submissions++;
          assert.equal(target.resources, snapshot);
          assert.equal(target.managementDirectory, "managed-directory");
          assert.equal(target.expectedUser, cleanup.expectedUser);
          assert.equal(target.expectedInit, cleanup.expectedInit);
          callbacks.onCleanupSubmitting();
          return {
            cancel: async () => ({}),
            completion: Promise.resolve({
              processTerminationConfirmed: false,
              cleanup: { confirmed: false },
            }),
          };
        },
        recordHostRecoveryResources: () => {
          saves++;
        },
        recoverOwnedOperationDirectories: () => {
          hostCleanups++;
          throw Error("unexpected_host_cleanup");
        },
        releaseHostOperationRecoveryGeneration: (owner: object) => {
          assert.equal(owner, generation);
          releases++;
          return true;
        },
        normalizeFailure: (error: Error) => error.message,
      },
    ) as (
      id: string,
      repository: object,
      current: () => boolean,
    ) => Promise<unknown>;
    assert.deepEqual(
      JSON.parse(JSON.stringify(await recover(recoveryId, {}, () => true))),
      {
        status: "blocked",
        reason:
          scenario === "receipt_missing"
            ? "docker_recovery_container_identity_unknown"
            : scenario === "owner_lost"
              ? "docker_recovery_boundary_failed"
              : "docker_probe_cleanup_failed",
        recoveryId,
        hostCleanupCompleted: false,
      },
    );
    assert.equal(submissions, scenario === "receipt_missing" ? 0 : 1);
    assert.equal(hostCleanups, 0);
    assert.equal(saves, 0);
    assert.equal(releases, 1);
  }
});

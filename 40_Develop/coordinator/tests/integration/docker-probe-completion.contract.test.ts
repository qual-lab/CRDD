/**
 * Probe完了を現Executor通知とEM資源Bookへ直接接続する。
 * @packageDocumentation
 * @responsibility 実ID・終了・回収・Host後段と元factsの共同成立を反証する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 現Coordinator本文とEM値更新。Executor技術結果は合成。
 * @boundary 通知→資源更新→公開結果。実Docker・実保存は対象外。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {
  CompletionResult,
  IsolationProbeFacts,
} from "@qual-lab/crdd-executor";
import { createProbeExecutionFixture } from "../support/probe-executor.ts";

/**
 * 正常と各一軸の未確認を、同じ現在通知から評価する。
 * @responsibility Receipt差・終了不明・回収不明・Host失敗を成功へ変換しない。
 * @trace ERB-IT-004
 * @precondition 各Case独立のBookとExecutorを使う。
 * @stimulus 完了事実と必要保存の各条件を一つずつ変更する。
 * @observation Book、Host要求列、公開結果、時間・出力量・signal。
 * @oracle 技術完了と回収後だけHostを閉じ、lifecycle blockedはそのまま返す。
 * @cleanup メモリだけ。全completionを待機する。
 * @boundary 上位の終了判断。実資源の不存在は主張しない。
 */
test("Probe完了の閉factsは現通知と資源Bookで相関され公開される", async () => {
  for (const scenario of [
    "normal",
    "lifecycle",
    "id",
    "receipt",
    "process",
    "cleanup",
    "host",
    "cleanup_save",
    "facts",
    "isolation",
    "cancelled",
    "elapsed",
  ]) {
    const fixture = createProbeExecutionFixture(
      scenario === "host"
        ? "host"
        : scenario === "cleanup_save"
          ? "cleanup"
          : null,
    );
    const id = "a".repeat(64);
    const snapshot = {
      resources: fixture.planned.snapshot.resources.map((resource) => ({
        ...resource,
        request: "issued" as const,
        identity: { ...resource.identity, dockerId: id },
      })),
    };
    const facts: IsolationProbeFacts = {
      isolation: {
        status: scenario === "isolation" ? "blocked" : "confirmed",
        reason: "docker_fake_provider_isolation_confirmed",
      },
      lifecycleStatus: scenario === "lifecycle" ? "blocked" : "candidate",
      lifecycleReason:
        scenario === "lifecycle"
          ? "dynamic_fake_provider_execution_envelope_invalid"
          : "dynamic_fake_provider_result_observed",
      elapsedMs: scenario === "elapsed" ? null : 17,
      stdoutBytes: 111,
      stderrBytes: 13,
      exitCode: 0,
      signal: scenario === "lifecycle" ? "SIGTERM" : null,
      timedOut: false,
    };
    const completion: CompletionResult<"isolation_probe"> = {
      kind: "isolation_probe",
      status: "completed",
      reason: facts.isolation.reason,
      creationAttempted: true,
      containerId: scenario === "id" ? "b".repeat(64) : id,
      facts: scenario === "facts" ? null : facts,
      resourceSnapshot: snapshot,
      cleanupConfirmed: scenario !== "cleanup",
      processCompletionConfirmed: scenario !== "process",
      cancelled: scenario === "cancelled",
    };
    const result = await fixture.run((request, options) => {
      assert.equal(request.kind, "isolation_probe");
      assert.equal(request.probeId, "12345678-1234-4234-8234-123456789abc");
      assert.equal(options.settings, fixture.settings);
      assert.deepEqual(options.mounts, fixture.mounts);
      return {
        kind: "isolation_probe",
        cancel: async () => ({
          status: "requested",
          reason: "cancellation_requested",
          cancellationRequested: true,
          processTerminationObserved: false,
        }),
        start: (input) => {
          input.callbacks?.onCommandSubmitting?.(
            "create_isolation_probe",
            fixture.target(),
          );
          if (scenario !== "receipt")
            input.callbacks?.onResourceCreated?.(id, fixture.target(snapshot));
          return {
            kind: "isolation_probe",
            status: "started",
            completion: Promise.resolve(completion),
          };
        },
      };
    });
    const canClose = ![
      "id",
      "receipt",
      "process",
      "cleanup",
      "cleanup_save",
      "host",
    ].includes(scenario);
    assert.equal(
      result.status,
      scenario === "normal" ? "confirmed" : "blocked",
      scenario,
    );
    assert.equal(result.hostCleanupCompleted, canClose, scenario);
    assert.equal(
      result.recoveryId,
      canClose ? null : "host-operation.OP-123456",
      scenario,
    );
    assert.equal(result.retainOperationDirectories, !canClose, scenario);
    assert.equal(
      fixture.events.includes("host"),
      !["id", "receipt", "process", "cleanup", "cleanup_save"].includes(
        scenario,
      ),
      scenario,
    );
    assert.equal(
      result.fakeProviderLifecycle.diagnosticDockerContainerEffectIssued,
      true,
    );
    assert.equal(
      result.fakeProviderLifecycle.diagnosticFilesystemEffectIssued,
      true,
    );
    assert.equal(
      result.fakeProviderLifecycle.providerNetworkEffectIssued,
      false,
    );
    assert.equal(result.fakeProviderLifecycle.runtimeAuthorityIssued, false);
    assert.equal(result.fakeProviderLifecycle.operationCapabilityIssued, false);
    assert.equal(result.fakeProviderLifecycle.realProviderReadiness, false);
    if (canClose && scenario !== "facts") {
      assert.equal(result.fakeProviderLifecycle.stdoutBytes, 111);
      assert.equal(result.fakeProviderLifecycle.stderrBytes, 13);
      assert.equal(result.fakeProviderLifecycle.signal, facts.signal);
      assert.equal(result.fakeProviderLifecycle.elapsedMs, facts.elapsedMs);
      assert.equal(
        result.fakeProviderLifecycle.status,
        scenario === "normal" ? "verified" : "blocked",
      );
    }
    if (canClose)
      assert.equal(fixture.book()?.checkpoints[0]?.observation, "absent");
  }
});

/**
 * Probeの作成前・Receipt後の必須保存を現Executor通知で確認する。
 * @packageDocumentation
 * @responsibility 保存失敗・ID欠測を後続Effectへ進めず、取消と終了待機を維持する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 実上位本文とEM値更新、有限Executor。実Docker・耐久保存は行わない。
 * @boundary Coordinator通知受付とExecutorの技術完了。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { CompletionResult } from "../../../executor/src/index.ts";
import { createProbeExecutionFixture } from "../support/probe-executor.ts";

/**
 * 必須通知の失敗は有限Executorが捕捉し、それ以後の作成・実行を行わない。
 * @responsibility 旧Host二重保存を再現せず、同じDI SnapshotのIntentとReceiptを更新する。
 * @trace ERB-IT-004
 * @precondition CaseごとにBook・通知列・故障点が独立する。
 * @stimulus 作成前保存、Receipt保存、境界・ID差、未発行、開始拒否とHost失敗。
 * @observation 要求列、元回復参照、Bookと公開Effect表示。
 * @oracle 保存失敗に続くEffectは0、不明な作成を未発行へ補完しない。
 * @cleanup メモリだけ。生成completionを待機する。
 * @boundary 通知受付と有限技術結果。実作成・実回収を主張しない。
 */
test("Probe二保存は現通知のcreate前と実ID取得後をそれぞれ停止できる", async () => {
  for (const scenario of [
    "normal",
    "submission",
    "receipt",
    "purpose",
    "management",
    "retention",
    "receipt_id",
    "unknown",
    "not_issued",
    "start_blocked",
    "factory",
    "host",
  ]) {
    const fixture = createProbeExecutionFixture(
      scenario === "submission" || scenario === "receipt" || scenario === "host"
        ? scenario
        : null,
    );
    const id = "a".repeat(64);
    const issued = {
      resources: fixture.planned.snapshot.resources.map((resource) => ({
        ...resource,
        request: "issued" as const,
        identity: { ...resource.identity, dockerId: id },
      })),
    };
    let created = 0,
      executed = 0;
    const outcome = (
      creationAttempted: boolean,
      snapshot = fixture.planned.snapshot,
    ): CompletionResult<"isolation_probe"> => ({
      kind: "isolation_probe",
      status: "blocked",
      reason: "fixture_probe_blocked",
      creationAttempted,
      containerId: creationAttempted ? id : null,
      facts: null,
      resourceSnapshot: snapshot,
      processCompletionConfirmed: true,
      cleanupConfirmed: true,
      cancelled: false,
    });
    const result = await fixture.run(() =>
      scenario === "factory"
        ? null
        : {
            kind: "isolation_probe",
            cancel: async () => ({
              status: "requested",
              reason: "cancellation_requested",
              cancellationRequested: true,
              processTerminationObserved: false,
            }),
            start: (input) => {
              if (scenario === "start_blocked")
                return {
                  kind: "isolation_probe",
                  status: "blocked",
                  reason: "fixture_start_blocked",
                  completion: null,
                };
              let completion: CompletionResult<"isolation_probe">;
              try {
                const target = fixture.target();
                input.callbacks?.onCommandSubmitting?.(
                  scenario === "purpose" ? "foreign" : "create_isolation_probe",
                  scenario === "management"
                    ? { ...target, managementDirectory: "foreign" }
                    : scenario === "retention"
                      ? { ...target, unreceiptedAbsence: "observe" }
                      : target,
                );
                if (scenario === "not_issued") completion = outcome(false);
                else {
                  created++;
                  if (scenario === "unknown")
                    completion = {
                      ...outcome(true),
                      containerId: null,
                      resourceSnapshot: null,
                    };
                  else {
                    input.callbacks?.onResourceCreated?.(
                      scenario === "receipt_id" ? "b".repeat(64) : id,
                      fixture.target(issued),
                    );
                    executed++;
                    completion = outcome(true, issued);
                  }
                }
              } catch {
                completion = outcome(
                  created > 0,
                  created ? issued : fixture.planned.snapshot,
                );
              }
              return {
                kind: "isolation_probe",
                status: "started",
                completion: Promise.resolve(completion),
              };
            },
          },
    );
    assert.equal(
      created,
      ["normal", "receipt", "receipt_id", "unknown", "host"].includes(scenario)
        ? 1
        : 0,
      scenario,
    );
    assert.equal(
      executed,
      ["normal", "host"].includes(scenario) ? 1 : 0,
      scenario,
    );
    assert.equal(result.status, "blocked");
    const closed = [
      "normal",
      "submission",
      "purpose",
      "management",
      "retention",
      "not_issued",
      "start_blocked",
      "factory",
    ].includes(scenario);
    assert.equal(result.hostCleanupCompleted, closed, scenario);
    assert.equal(
      result.recoveryId,
      closed ? null : "host-operation.OP-123456",
      scenario,
    );
    assert.equal(
      result.fakeProviderLifecycle.diagnosticDockerContainerEffectIssued,
      created > 0,
    );
    if (scenario === "submission")
      assert.deepEqual(fixture.events, ["submission", "host"]);
    if (scenario === "receipt")
      assert.deepEqual(fixture.events, ["submission", "receipt"]);
    if (scenario === "receipt_id" || scenario === "unknown")
      assert.deepEqual(fixture.events, ["submission"]);
    if (scenario === "not_issued")
      assert.deepEqual(fixture.events, ["submission", "not_issued", "host"]);
    if (scenario === "normal" || scenario === "host")
      assert.deepEqual(fixture.events, [
        "submission",
        "receipt",
        "cleanup",
        "host",
      ]);
  }
});

/**
 * 取消要求を同じExecutorへ配送し、completion前にHost回収・結果返却しない。
 * @responsibility Listener解放と終了待機を要求受理とは区別する。
 * @trace ERB-IT-004
 * @precondition 各実行は独立したAbortControllerと未完了Promiseを持つ。
 * @stimulus 実行中取消、完了後の追加Abort、開始前取消を与える。
 * @observation cancel回数、Promise完了、Host清掃順。
 * @oracle 完了まで待機し、終了後のAbortから取消を追加配送しない。
 * @cleanup 全Promiseを解決しListener解除を追加Abortで確認する。
 * @boundary 同一Process内の取消と有限Executorのみ。
 */
test("Probe取消は元Executorの完了を待ち終了後のListenerを解放する", async () => {
  for (const preAborted of [false, true]) {
    const fixture = createProbeExecutionFixture();
    const controller = new AbortController();
    if (preAborted) controller.abort();
    let finish:
      | ((value: CompletionResult<"isolation_probe">) => void)
      | undefined;
    const completion = new Promise<CompletionResult<"isolation_probe">>(
      (resolve) => {
        finish = resolve;
      },
    );
    let cancelled = 0,
      returned = false;
    const running = fixture
      .run(
        () => ({
          kind: "isolation_probe",
          cancel: async () => {
            cancelled++;
            return {
              status: "requested",
              reason: "cancellation_requested",
              cancellationRequested: true,
              processTerminationObserved: false,
            };
          },
          start: (input) => {
            input.callbacks?.onCommandSubmitting?.(
              "create_isolation_probe",
              fixture.target(),
            );
            return { kind: "isolation_probe", status: "started", completion };
          },
        }),
        controller.signal,
      )
      .then((result) => {
        returned = true;
        return result;
      });
    if (!preAborted) controller.abort();
    await Promise.resolve();
    assert.equal(cancelled, 1);
    assert.equal(returned, false);
    assert.equal(fixture.events.includes("host"), false);
    assert.ok(finish);
    finish({
      kind: "isolation_probe",
      status: "cancelled",
      reason: "fixture_cancelled",
      creationAttempted: false,
      containerId: null,
      facts: null,
      resourceSnapshot: fixture.planned.snapshot,
      processCompletionConfirmed: true,
      cleanupConfirmed: true,
      cancelled: true,
    });
    const result = await running;
    assert.equal(result.status, "blocked");
    assert.equal(result.hostCleanupCompleted, true);
    controller.signal.dispatchEvent(new Event("abort"));
    assert.equal(cancelled, 1);
  }
});

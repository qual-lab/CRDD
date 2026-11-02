/**
 * 通常Attemptの共通DI接続を有限の技術境界で反証する。
 * @responsibility 五資源・九操作・通知・一次失敗・元結果相関の搬送を確認する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 実入力構築とAdapter本文。実Process・Docker・AIは使用しない。
 * @boundary DI共通Owner自体の保証はDIの共通Lifecycle試験で確認する。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import * as di from "../../../docker-isolation/src/index.ts";
import * as boundary from "../../src/attempt/operations.ts";
import { PURPOSES } from "../../src/attempt/constants.ts";
import type { AttemptPlan, IsolationRuntime } from "../../src/attempt/types.ts";
import { attemptPlan } from "../fixtures/attempt-plan.ts";

/** 本番と同じ入力構築を実行し、共通DIだけを有限代役へ置換する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
function fixture() {
  const source = readFileSync(
    new URL("../../src/attempt/operations.ts", import.meta.url),
    "utf8",
  );
  const value = attemptPlan();
  const plan = boundary.prepareAttempt(
    { randomBytes: (size) => Buffer.alloc(size, 1) },
    {
      kind: "attempt",
      purpose: "probe",
      selection: value.executionSelection,
      target: {
        provider: value.provider,
        operationId: value.operationId,
        grantRef: value.grantRef,
        workspaceSourcePath: "C:/synthetic/work",
        temporarySourcePath: "C:/synthetic/tmp",
        providerHomeSourcePath: value.providerHomeSourcePath,
        providerHomeIdentityHash: value.providerHomeIdentityHash,
        providerHomeProtectionHash: value.providerHomeProtectionHash,
        localUserBindingHash: value.localUserBindingHash,
        stableLogicalHomeBindingHash: value.stableLogicalHomeBindingHash,
        activeMountCapability: value.activeMountCapability,
      },
    },
  );
  assert.ok(plan);
  let request: di.IsolationRequest | null = null;
  let calls = 0;
  let failure: di.IsolationExecutionResult["failure"] = null;
  let snapshot: di.ResourceSnapshot | null = null;
  const context = {
    ...di,
    ...boundary,
    Object,
    WeakMap,
    PURPOSES,
    prepareIsolation: (input: di.IsolationRequest) => {
      request = input;
      return {};
    },
    executeIsolation: (
      _prepared: unknown,
      callbacks: di.IsolationCallbacks,
    ): di.IsolationExecution => {
      calls++;
      assert.ok(request);
      const current = request;
      snapshot = Object.freeze({
        resources: Object.freeze(
          current.resources.map((resource, index) =>
            Object.freeze({
              key: resource.key,
              identity: Object.freeze({
                kind: resource.kind,
                dockerId: String(index + 1).repeat(64),
                name: resource.name,
                ownershipLabel: resource.ownershipLabel,
              }),
              request: "issued" as const,
              configuration: Object.freeze({
                image: resource.kind === "container" ? resource.image : null,
                command: null,
                environmentNames: null,
                mounts: null,
                networks: null,
                internal:
                  resource.kind === "network" ? resource.internal : null,
              }),
            }),
          ),
        ),
      });
      const resources = snapshot;
      const completion = Promise.resolve().then(
        async (): Promise<di.IsolationExecutionResult> => {
          if (failure?.notification === "onNotIssued") {
            const step = current.steps.find(
              (step) => step.key === failure?.stepKey,
            );
            assert.ok(step);
            callbacks.onNotIssued?.(step);
          } else if (!failure) {
            for (const step of current.steps) {
              await callbacks.onSubmitting?.(step);
              if (step.action === "create")
                await callbacks.onCreated?.(step, resources);
              else if (step.action === "run") {
                await callbacks.onStarted?.(step);
                const response = {
                  status: 0,
                  signal: null,
                  stdout: "synthetic",
                  stderr: "",
                  outputExceeded: false,
                };
                await callbacks.onObserved?.(step, response, 1, null);
                await callbacks.onCompleted?.(step, response);
              }
            }
          }
          return {
            failure,
            resources,
            cancellationRequested: false,
            processTerminationConfirmed: true,
            notificationDeliveryConfirmed: true,
            callbackRegistrationReleased: true,
            cleanup: {
              confirmed: true,
              configCleanupConfirmed: true,
              observations: resources.resources.map((resource) => ({
                key: resource.key,
                observation: "absent",
              })),
            },
          };
        },
      );
      return {
        completion,
        cancel: async () => ({
          cancellationRequested: true,
          processTerminationObserved: true,
        }),
      };
    },
  };
  const bind = runInNewContext(
    `${sourceDeclaration(source, "createIsolationRequest")}\n${sourceDeclaration(source, "bindIsolationRuntime")}\nbindIsolationRuntime`,
    context,
  ) as (
    plan: AttemptPlan,
    paths: di.DockerIsolationRuntimeOptions["paths"],
  ) => Omit<IsolationRuntime, "acquireHomeLease">;
  return {
    plan,
    bound: bind(plan, {
      tmp: "C:/synthetic/tmp",
      management: "C:/synthetic/management",
    }),
    request: () => request,
    snapshot: () => snapshot,
    calls: () => calls,
    fail: (value: NonNullable<di.IsolationExecutionResult["failure"]>) => {
      failure = value;
    },
  };
}

/** 実構成と元結果だけを共通DIの一生涯へ結合する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("通常Attemptは五資源・九操作を共通DIへ一回接続し元Snapshotを返す", async () => {
  const f = fixture(),
    recovery = {},
    management = {};
  const events: string[] = [];
  assert.ok(f.bound.startExecution);
  const execution = f.bound.startExecution(f.plan, recovery, management, {
    onCommandSubmitting: (key) => {
      events.push(key);
    },
  });
  const result = await execution.completion;
  assert.equal(f.calls(), 1);
  assert.equal(f.request()?.resources.length, 5);
  assert.deepEqual(
    Array.from(f.request()?.steps.map((step) => step.key) ?? []),
    Array.from(PURPOSES),
  );
  assert.deepEqual(events, Array.from(PURPOSES));
  assert.strictEqual(result.resourceSnapshot, f.snapshot());
  assert.equal(result.resourceObservations?.length, 5);
  assert.equal(result.cleanup.confirmed, true);
  const primary = f.request()?.steps.at(-1);
  assert.equal(primary?.action, "run");
  if (primary?.action === "run") {
    assert.equal(primary.timeoutMs, 300_000);
    assert.equal(primary.deadlineOrigin, "started");
  }
  assert.ok(
    f.bound.verifyCleanupOutcome?.(
      result.cleanup,
      f.plan,
      recovery,
      management,
    ),
  );
  assert.equal(
    f.bound.verifyCleanupOutcome?.(
      { ...result.cleanup },
      f.plan,
      recovery,
      management,
    ),
    null,
  );
  assert.equal(
    f.bound.verifyCleanupOutcome?.(
      result.cleanup,
      { ...f.plan },
      recovery,
      management,
    ),
    null,
  );
  assert.equal(
    f.bound.verifyCleanupOutcome?.(result.cleanup, f.plan, {}, management),
    null,
  );
  assert.equal(
    f.bound.verifyCleanupOutcome?.(result.cleanup, f.plan, recovery, {}),
    null,
  );
});

/** Handle取得と応答観測は技術Ownerが報告した実際の段階を保持する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("通常Attemptは共通DIの一次失敗と未発行通知名を推測で変更しない", async () => {
  for (const stage of ["start", "wait", "notification"] as const) {
    const f = fixture();
    f.fail({
      stepKey: "create_provider",
      stage,
      reason: "fixed_failure",
      kind: "threw",
      notification: stage === "notification" ? "onNotIssued" : null,
      commandHandleObtained: stage !== "start",
      responseObserved: stage === "notification",
      exceptionCode: "unknown",
    });
    assert.ok(f.bound.startExecution);
    const result = await f.bound.startExecution(f.plan, {}, {}, {}).completion;
    assert.equal(
      result.failure?.stage,
      stage === "notification"
        ? "gate"
        : stage === "start"
          ? "command_start"
          : "command_wait",
    );
    assert.equal(result.failure?.commandHandleObtained, stage !== "start");
    assert.equal(result.failure?.responseObserved, stage === "notification");
    if (stage === "notification")
      assert.equal(result.failure?.gate, "onCommandNotIssued");
  }
});

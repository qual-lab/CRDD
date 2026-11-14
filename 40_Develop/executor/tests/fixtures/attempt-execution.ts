/**
 * Executorの有限DI Producerを単独試験と上位接続試験へ提供する。
 * @responsibility 元の準備・通知・取消・結果と独立したCase状態だけを所有する。
 * @trace ERB-UT-023
 * @boundary 試験限定。EM規則・耐久保存・実Process・Dockerを所有しない。
 */
import assert from "node:assert/strict";
import * as di from "../../../docker-isolation/src/index.ts";
import type { LockResult } from "../../../lock/src/index.ts";
import * as boundary from "../../src/lifecycle/attempt.ts";
import { PURPOSES } from "../../src/lifecycle/attempt.ts";
import { attemptPlan } from "./attempt-plan.ts";

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
export function createAttemptExecutionFixture() {
  const classification = Object.freeze({
    category: "completed" as const,
    stdoutBytes: 9,
    stderrBytes: 0,
  });
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
        stableLogicalHomeBindingHash: value.stableLogicalHomeBindingHash,
        activeMountCapability: value.activeMountCapability,
      },
    },
    { tmp: "C:/synthetic/tmp", management: "C:/synthetic/management" },
  );
  assert.ok(plan);
  let request: di.IsolationRequest | null = null;
  let calls = 0;
  let failure: di.IsolationExecutionResult["failure"] = null;
  let snapshot: di.ResourceSnapshot | null = null;
  let initialSnapshot: di.ResourceSnapshot | null = null;
  let commandFailure: {
    key: string;
    code: "PROCESS_FAILURE" | "ETIMEDOUT";
  } | null = null;
  let releases = 0;
  const events: string[] = [];
  let prepareRejected = false;
  let invocationFailed = false;
  let transform = (
    value: di.IsolationExecutionResult,
  ): di.IsolationExecutionResult => value;
  const context = {
    ...di,
    ...boundary,
    Object,
    WeakMap,
    PURPOSES,
    prepareIsolation: (input: di.IsolationRequest) => {
      request = input;
      if (prepareRejected) return null;
      initialSnapshot = Object.freeze({
        resources: Object.freeze(
          input.resources.map((resource) =>
            Object.freeze({
              key: resource.key,
              identity: Object.freeze({
                kind: resource.kind,
                name: resource.name,
                ownershipLabel: resource.ownershipLabel,
                dockerId: null,
              }),
              request: "not_issued" as const,
              configuration: Object.freeze({
                image: null,
                command: null,
                environmentNames: null,
                mounts: null,
                networks: null,
                internal: null,
              }),
            }),
          ),
        ),
      });
      return { resources: initialSnapshot };
    },
    executeIsolation: (
      _prepared: unknown,
      callbacks: di.IsolationCallbacks = {},
    ): di.IsolationExecution => {
      calls++;
      if (invocationFailed) throw Error("synthetic_invocation_failure");
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
      const completedResources = snapshot;
      assert.ok(initialSnapshot);
      let resources = failure ? snapshot : initialSnapshot;
      snapshot = resources;
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
              if (step.action === "create") {
                resources = Object.freeze({
                  resources: Object.freeze(
                    resources.resources.map((resource) => {
                      if (resource.key !== step.resource) return resource;
                      const observed = completedResources.resources.find(
                        (completed) => completed.key === resource.key,
                      );
                      assert.ok(observed);
                      return observed;
                    }),
                  ),
                });
                snapshot = resources;
                await callbacks.onCreated?.(step, resources);
              } else if (step.action === "run") {
                await callbacks.onStarted?.(step);
                const response = {
                  status: 0,
                  signal: null,
                  stdout:
                    step.key === "start_subscription_auth_probe_attached"
                      ? JSON.stringify({
                          loggedIn: true,
                          authMethod: "claude.ai",
                          apiProvider: "firstParty",
                          forcedLoginMethod: "claudeai",
                          subscriptionType: "max",
                        })
                      : JSON.stringify({
                          type: "result",
                          subtype: "success",
                          is_error: false,
                          num_turns: 1,
                          total_cost_usd: 0,
                          structured_output: { status: true },
                        }),
                  stderr: "",
                  outputExceeded: false,
                };
                const commandResult = {
                  observation:
                    commandFailure?.key === step.key ? null : response,
                  elapsedMs: 1,
                  errorCode:
                    commandFailure?.key === step.key
                      ? commandFailure.code
                      : null,
                  classification:
                    commandFailure?.key === step.key
                      ? { category: "deadline_exceeded" as const }
                      : classification,
                  exitClass: "zero" as const,
                };
                try {
                  await callbacks.onObserved?.(step, commandResult);
                  if (commandResult.observation !== null)
                    await callbacks.onCompleted?.(step, {
                      ...commandResult,
                      observation: commandResult.observation,
                    });
                } catch {
                  failure = {
                    stepKey: step.key,
                    stage: "notification",
                    reason: "docker_isolation_notification_failed",
                    notification: "onObserved",
                    kind: "threw",
                    commandHandleObtained: true,
                    responseObserved: commandResult.observation !== null,
                    exceptionCode: null,
                  };
                  break;
                }
              }
            }
          }
          return transform({
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
          });
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
  const management = {};
  const reference = {
    recoveryId: `docker-task.${plan.stableLogicalHomeBindingHash}.${"b".repeat(64)}.${"c".repeat(64)}`,
    recoveryCapability: {},
  };
  let currentControl: unknown = null;
  const state = {
    controls: new WeakMap(),
    acquireHomeLease: () => ({
      status: "acquired" as const,
      lock: {
        assertLive: () => true,
        release: () => {
          releases++;
          events.push("home");
          return true;
        },
      },
    }),
    prepareIsolation: context.prepareIsolation as (
      request: di.IsolationRequest,
    ) => di.PreparedIsolation | null,
    executeIsolation: context.executeIsolation,
  };
  return {
    plan,
    releases: () => releases,
    commandFailure: (key: string, code: "PROCESS_FAILURE" | "ETIMEDOUT") => {
      commandFailure = { key, code };
    },
    events,
    rejectPrepare: () => {
      prepareRejected = true;
    },
    failInvocation: () => {
      invocationFailed = true;
    },
    transform: (value: typeof transform) => {
      transform = value;
    },
    startWithAcquisition: (
      outcome: LockResult<{ assertLive(): boolean; release(): boolean }>,
    ) =>
      boundary.start(
        { ...state, callbacks: {}, acquireHomeLease: () => outcome },
        plan,
        management,
        reference,
      ),
    run: (
      callbacks: import("../../src/lifecycle/types.ts").AttemptCallbacks = {},
    ) => {
      const started = boundary.start(
        { ...state, callbacks },
        plan,
        management,
        reference,
      );
      assert.equal(started.status, "started");
      if (started.status !== "started") throw Error("test_start_blocked");
      currentControl = started.controlCapability;
      return started.completion;
    },
    cancel: () => boundary.cancel(state, currentControl, management),
    request: () => request,
    snapshot: () => snapshot,
    initialSnapshot: () => initialSnapshot,
    calls: () => calls,
    classification: () => classification,
    fail: (value: NonNullable<di.IsolationExecutionResult["failure"]>) => {
      failure = value;
    },
  };
}

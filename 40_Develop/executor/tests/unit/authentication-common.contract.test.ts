/**
 * 認証の固定構成と共通DI生涯への接続を反証する。
 * @responsibility 両Provider・二操作の構成、通知停止、Snapshotと終了条件を確認する。
 * @trace ARCH-000010
 * @level UT
 * @scope 共通DIの有限代役のみ。実Docker・実AI・認証情報・Filesystem操作はない。
 * @boundary 公開Executor→認証固有構成→共通技術契約。物理終了はDI試験の責務。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  captureIsolationCleanupRequest,
  captureIsolationRequest,
  plannedResourceSnapshot,
} from "../../../docker-isolation/src/execution/preparation.ts";
import type {
  IsolationCallbacks,
  IsolationExecutionResult,
  IsolationRequest,
  PreparedIsolation,
  ResourceSnapshot,
  ResourceTarget,
} from "../../../docker-isolation/src/index.ts";
import * as original from "../../../docker-isolation/src/index.ts";

/** 同じRoot入口の全認証構成と、通知拒否・未終了の負例を確認する。
 * @responsibility 当該Caseの入力・通知・技術結果の対応を確認する。
 * @trace ERB-UT-023
 * @precondition 当該Caseの有限代役又はRepository内の新品試験領域だけを使用する。
 * @stimulus Case名に示す正常・境界・失敗条件を同じ実装へ与える。
 * @observation 同じ呼出しの返却値・元実ID・要求順序と終了条件を観測する。
 * @oracle Case内の独立期待値と一致し、未確認を成功へ補完しない。
 * @cleanup 登録した代役を復元し、所有するPromiseと新品試験資源の終了を確認する。
 * @boundary ERB-UT-023=Direct Boundary: 明示したSource接続と有限技術境界。実AI・Dockerの成立を主張しない。
 */
test("認証は上位管理領域と共通DIを使い非秘密Snapshotを返す", async (t) => {
  const owners = new WeakMap<object, IsolationRequest>();
  let mode = "normal",
    prepareCalls = 0,
    runCalls = 0;
  const requests: IsolationRequest[] = [];
  const cleanupRequests: ResourceTarget<"snapshot">[] = [];
  const capabilityInputs: unknown[][] = [];
  t.mock.module("../../../docker-isolation/src/index.ts", {
    namedExports: {
      ...original,
      describeIsolationCapabilities(...args: ["codex" | "claude", unknown?]) {
        capabilityInputs.push(args);
        return original.describeIsolationCapabilities(args[0], args[1]);
      },
      cleanupIsolation(
        input: ResourceTarget<"snapshot">,
        callbacks: IsolationCallbacks = {},
      ) {
        const request = captureIsolationCleanupRequest(input);
        cleanupRequests.push(request);
        return {
          cancel: async () => ({
            cancellationRequested: true,
            processTerminationObserved: true,
          }),
          completion: Promise.resolve().then(
            async (): Promise<IsolationExecutionResult> => {
              let confirmed = true;
              try {
                for (const key of request.cleanupOrder) {
                  await callbacks.onCleanupSubmitting?.(key);
                  await callbacks.onCleanupCompleted?.(key);
                }
              } catch {
                confirmed = false;
              }
              return {
                failure: null,
                resources: request.resources,
                cancellationRequested: false,
                processTerminationConfirmed: true,
                notificationDeliveryConfirmed: confirmed,
                callbackRegistrationReleased: true,
                cleanup: {
                  confirmed,
                  configCleanupConfirmed: confirmed,
                  observations: [],
                },
              };
            },
          ),
        };
      },
      prepareIsolation(input: IsolationRequest): PreparedIsolation | null {
        prepareCalls++;
        const request = captureIsolationRequest(input);
        requests.push(request);
        const prepared = { resources: plannedResourceSnapshot(request) };
        owners.set(prepared, request);
        return prepared;
      },
      executeIsolation(
        prepared: PreparedIsolation,
        callbacks: IsolationCallbacks,
      ) {
        const request = owners.get(prepared);
        assert.ok(request);
        const probe = request.resources.find((r) => r.key === "probe");
        const codex =
          probe?.kind === "container" &&
          probe.image ===
            original.describeIsolationCapabilities("codex").assets
              .fixedImageDigest;
        let cancelled = false;
        return {
          cancel: async () => {
            cancelled = true;
            return {
              cancellationRequested: true,
              processTerminationObserved: mode !== "unknown",
            };
          },
          completion: Promise.resolve().then(
            async (): Promise<IsolationExecutionResult> => {
              let resources: ResourceSnapshot = prepared.resources;
              let failure: IsolationExecutionResult["failure"] = null;
              try {
                for (const step of request.steps) {
                  await callbacks.onSubmitting?.(step);
                  if (step.action === "create") {
                    resources = {
                      resources: resources.resources.map((r, i) =>
                        r.key === step.resource
                          ? {
                              ...r,
                              request: "issued" as const,
                              identity: {
                                ...r.identity,
                                dockerId: (i + 1).toString(16).repeat(64),
                              },
                            }
                          : r,
                      ),
                    };
                    await callbacks.onCreated?.(step, resources);
                  }
                  if (step.action === "run") runCalls++;
                  callbacks.onCompleted?.(step, {
                    status:
                      step.key === "start_probe_attached" &&
                      ["unconfirmed", "contradiction"].includes(mode)
                        ? 1
                        : 0,
                    signal: null,
                    outputExceeded: false,
                    stdout: codex
                      ? ""
                      : mode === "unconfirmed"
                        ? JSON.stringify({ loggedIn: false })
                        : JSON.stringify({
                            loggedIn: true,
                            authMethod: "claude.ai",
                            apiProvider: "firstParty",
                            subscriptionType: "max",
                            forcedLoginMethod: "claudeai",
                          }),
                    stderr: !codex
                      ? ""
                      : mode === "unconfirmed"
                        ? "Not logged in"
                        : "Logged in using ChatGPT",
                  });
                }
              } catch {
                failure = {
                  stepKey: null,
                  stage: "notification",
                  reason: "docker_isolation_notification_failed",
                  notification: "onCreated",
                  kind: "threw",
                  commandHandleObtained: true,
                  responseObserved: true,
                  exceptionCode: null,
                };
              }
              if (mode !== "unknown")
                for (const key of request.cleanupOrder) {
                  if (
                    resources.resources.find((r) => r.key === key)?.request ===
                    "not_issued"
                  )
                    continue;
                  await callbacks.onCleanupSubmitting?.(key);
                  await callbacks.onCleanupCompleted?.(key);
                }
              return {
                failure,
                resources,
                cancellationRequested: cancelled,
                processTerminationConfirmed: mode !== "unknown",
                notificationDeliveryConfirmed: !failure,
                callbackRegistrationReleased: true,
                cleanup: {
                  confirmed: mode !== "unknown",
                  configCleanupConfirmed: mode !== "unknown",
                  observations: [],
                },
              };
            },
          ),
        };
      },
    },
  });
  const { createExecutor, cleanupResources } = await import(
    "../../src/index.ts"
  );
  for (const provider of ["codex", "claude"] as const)
    for (const action of ["status", "login"] as const) {
      mode = "normal";
      const before = prepareCalls;
      const request = {
        kind: "authentication" as const,
        provider,
        action,
        providerHomeSourcePath: `C:\\runtime\\ProviderHomes\\${provider}`,
        suffix: "a".repeat(16),
        proxyToken: action === "login" ? "b".repeat(64) : null,
      };
      const executor = createExecutor(request, {
        managementDirectory: "C:\\runtime\\management",
      });
      assert.ok(executor);
      assert.equal(
        prepareCalls,
        before,
        "管理領域取得前のFactoryはDI実体を取得しない",
      );
      const start = executor.start({});
      assert.equal(start.status, "started");
      assert.ok(start.status === "started");
      const result = await start.completion;
      assert.equal(
        result.status,
        "completed",
        `${provider}/${action}:${result.reason}`,
      );
      assert.equal(result.cleanupConfirmed, true);
      assert.equal(result.authenticationConfirmed, true);
      assert.ok(result.resourceSnapshot);
      assert.equal(
        JSON.stringify(result.resourceSnapshot).includes("b".repeat(64)),
        false,
      );
      assert.equal(
        result.resourceSnapshot.resources.length,
        action === "login" ? 5 : 1,
      );
      const input = requests.at(-1);
      assert.ok(input);
      assert.equal(input.managementDirectory, "C:\\runtime\\management");
      assert.equal(input.unreceiptedAbsence, "observe");
      assert.ok(
        input.resources.every(
          (r) =>
            r.kind !== "container" ||
            r.mounts.every((m) => m.target === "/provider-home"),
        ),
      );
      const probe = input.resources.find((r) => r.key === "probe");
      assert.ok(probe?.kind === "container");
      assert.equal(probe.network, null);
      assert.equal(probe.mounts[0]?.readOnly, true);
      if (action === "login") {
        const login = input.steps.find((s) => s.key === "start_login_attached");
        assert.ok(login?.action === "run");
        assert.equal(login.mode, "interactive");
        assert.equal(login.timeoutMs, null);
        const configuration = input.resources.find((r) => r.key === "login");
        assert.ok(configuration?.kind === "container");
        assert.equal(configuration.tty, true);
        assert.deepEqual(
          Object.keys(configuration.environment).filter((k) =>
            k.includes("PROXY"),
          ),
          ["HTTPS_PROXY"],
        );
      }
      assert.equal(executor.start({}).status, "blocked");
      const recovery = await cleanupResources({
        kind: "authentication",
        request,
        managementDirectory: "C:\\runtime\\management",
        resources: executor.recordProjection.resources,
      });
      assert.equal(recovery.confirmed, true);
      const cleanup = cleanupRequests.at(-1);
      assert.ok(cleanup);
      assert.equal(cleanup.unreceiptedAbsence, "observe");
      assert.equal(
        cleanup.resources.resources.length,
        executor.recordProjection.resources.length,
      );
      assert.equal(cleanup.discovery.length, 0);
      assert.ok(
        cleanup.resources.resources.every(
          (r) => r.request === "unknown" && r.identity.dockerId === null,
        ),
      );
    }
  for (const provider of ["codex", "claude"] as const)
    for (mode of ["receipt", "unknown", "unconfirmed", "contradiction"]) {
      const before = runCalls;
      const executor = createExecutor(
        {
          kind: "authentication",
          provider,
          action: "status",
          providerHomeSourcePath: `C:\\runtime\\ProviderHomes\\${provider}`,
          suffix: "a".repeat(16),
          proxyToken: null,
        },
        { managementDirectory: "C:\\runtime\\management" },
      );
      assert.ok(executor);
      const start = executor.start({
        callbacks: {
          onResourceCreated: () => {
            if (mode === "receipt") throw Error("save_failed");
          },
        },
      });
      assert.ok(start.status === "started");
      const result = await start.completion;
      assert.equal(
        result.status,
        mode === "unconfirmed" ? "completed" : "blocked",
      );
      if (mode === "receipt") {
        assert.equal(runCalls, before);
        assert.equal(
          result.reason,
          "provider_authentication_resource_receipt_unconfirmed",
        );
      }
      if (mode === "unknown") {
        assert.equal(result.cleanupConfirmed, false);
        assert.equal(result.processCompletionConfirmed, false);
      }
      if (mode === "unconfirmed")
        assert.equal(result.authenticationStatus, "unconfirmed");
      if (mode === "contradiction") {
        assert.equal(result.authenticationStatus, "unknown");
        assert.equal(result.authenticationConfirmed, false);
        assert.equal(
          result.reason,
          "provider_authentication_start_probe_attached_failed",
        );
      }
      assert.ok(result.resourceSnapshot?.resources[0]?.identity.dockerId);
    }
  let effects = 0;
  const valid = {
    kind: "authentication" as const,
    provider: "codex" as const,
    action: "status" as const,
    providerHomeSourcePath: "C:\\runtime\\ProviderHomes\\codex",
    suffix: "a".repeat(16),
    proxyToken: null,
  };
  const coercion = {
    toString() {
      effects++;
      return "a".repeat(16);
    },
  };
  for (const request of [
    { ...valid, suffix: coercion },
    { ...valid, suffix: 7 },
    { ...valid, providerHomeSourcePath: coercion },
    new Proxy(valid, {}),
  ])
    assert.equal(
      createExecutor(request as never, {
        managementDirectory: "C:\\runtime\\management",
      }),
      null,
    );
  const getter = Object.defineProperty({}, "managementDirectory", {
    get() {
      effects++;
      return "C:\\runtime\\management";
    },
  });
  for (const options of [
    getter,
    new Proxy({ managementDirectory: "x" }, {}),
    { managementDirectory: 7 },
    { managementDirectory: "x", extra: true },
  ])
    assert.equal(createExecutor(valid, options as never), null);
  assert.equal(effects, 0);
  assert.ok(capabilityInputs.length > 0);
  assert.ok(capabilityInputs.every((args) => args.length === 1));
});

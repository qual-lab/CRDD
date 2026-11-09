/**
 * Probe固有構成と共通DI入口の結合を検証する。
 * @packageDocumentation
 * @responsibility 固定構成の搬送・必要通知・結果解釈と取消の一次理由を反証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope 有限DI代役のみ。Process・Filesystem・実AI・Dockerは操作しない。
 * @boundary 公開createExecutor→確定技術構成→共通DI。物理終了はDI契約試験が所有する。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type {
  IsolationCallbacks,
  IsolationExecutionResult,
  IsolationRequest,
  PreparedIsolation,
  ResourceSnapshot,
} from "../../../docker-isolation/src/index.ts";
import * as original from "../../../docker-isolation/src/index.ts";

/**
 * 有限DI代役に対するProbe構成・通知・取消・結果の接続を反証する。
 * @responsibility 有限DI代役に対するProbe構成・通知・取消・結果の接続を反証する。
 * @trace ERB-UT-023
 * @precondition 共通DI入口をModule代役へ置換する。
 * @stimulus 正常・故障・通知拒否・取消・終了不明を与える。
 * @observation 構成、通知順、取消件数、終端理由と回収状態。
 * @oracle 不明を成功にせず、同じ実行へ取消と回収結果を接続する。
 * @cleanup 全completionを待ちModule代役をTestContextで復元する。
 * @boundary ERB-UT-023=N/A: 型・合成値・有限依存の検査。実AI・Docker・保存なし。
 */
test("固定Probeは共通技術入口で構成・通知・取消・終了・回収を維持する", async (t) => {
  const id = "a".repeat(64),
    probeId = "12345678-1234-4234-8234-123456789abc";
  const events: string[] = [];
  let mode = "normal",
    changed = false,
    delivered: unknown = null,
    cancel: () => unknown = () => undefined,
    cancelCalls = 0;
  const owners = new WeakMap<object, IsolationRequest>();
  const mounts = {
    management: "management",
    workspace: "workspace",
    providerHome: "home",
    tmp: "tmp",
  };
  const goodOutput = JSON.stringify({
    marker: "crdd-coordinator-isolation-v1",
    allowed_writes: { workspace: true, "provider-home": true, tmp: true },
    runtime_paths_absent: true,
    credential_names_absent: true,
    network_blocked: true,
    home_isolated: true,
    tmp_isolated: true,
  });
  /**
   * 作成要求と実ID取得の段階を表す非秘密Snapshotを構築する。
   * @responsibility 作成要求と実ID取得の段階を表す非秘密Snapshotを構築する。
   * @trace ERB-UT-023
   * @precondition 固定の単一資源要求と発行・ID取得状態を渡す。
   * @stimulus 状態に応じてrequestとdockerIdを設定する。
   * @observation 返却SnapshotのIdentityと発行区分。
   * @oracle 未発行・実ID欠測・取得済みを別々に表す。
   * @cleanup N/A: 合成値だけでDocker操作なし。
   * @boundary ERB-UT-023=N/A: 型・合成値・有限依存の検査。実AI・Docker・保存なし。
   */
  function snapshot(
    request: IsolationRequest,
    issued: boolean,
    known: boolean,
  ): ResourceSnapshot {
    const r = request.resources[0];
    assert.ok(r);
    return Object.freeze({
      resources: [
        {
          key: r.key,
          identity: {
            kind: r.kind,
            dockerId: known ? id : null,
            name: r.name,
            ownershipLabel: r.ownershipLabel,
          },
          request: issued ? "issued" : "not_issued",
          configuration: {
            image: r.kind === "container" ? r.image : null,
            command: null,
            environmentNames: null,
            mounts: null,
            networks: null,
            internal: null,
          },
        },
      ],
    });
  }
  t.mock.module("../../../docker-isolation/src/index.ts", {
    namedExports: {
      ...original,
      prepareIsolation(request: IsolationRequest): PreparedIsolation | null {
        assert.equal(request.managementDirectory, "management");
        assert.equal(request.resources.length, 1);
        const r = request.resources[0];
        assert.ok(r?.kind === "container");
        assert.equal(r.name, `crdd-coordinator-probe-${probeId}`);
        assert.equal(r.ownershipLabel, `crdd.coordinator.probe=${probeId}`);
        assert.equal(r.image, original.describeIsolationConfiguration().image);
        assert.equal(r.network, null);
        assert.equal(r.entrypoint, "python");
        assert.equal(r.user, "65532:65532");
        assert.deepEqual(r.mounts, [
          {
            source: "workspace",
            target: "/operation/workspace",
            readOnly: false,
          },
          {
            source: "home",
            target: "/operation/provider-home",
            readOnly: false,
          },
          { source: "tmp", target: "/operation/tmp", readOnly: false },
        ]);
        assert.deepEqual(r.environment, {
          HOME: "/operation/provider-home",
          TMPDIR: "/operation/tmp",
        });
        assert.equal(r.argv[0], "-c");
        assert.match(r.argv[1] ?? "", /network_blocked/u);
        assert.equal(request.steps[1]?.timeoutMs, 30_000);
        assert.ok(request.steps[1]?.action === "run");
        assert.equal(request.steps[1].deadlineOrigin, "request");
        assert.equal(request.verifyLabelAbsence, true);
        assert.equal(request.unreceiptedAbsence, "retain");
        const prepared = { resources: snapshot(request, false, false) };
        owners.set(prepared, request);
        return prepared;
      },
      executeIsolation(
        prepared: PreparedIsolation,
        callbacks: IsolationCallbacks = {},
      ) {
        const request = owners.get(prepared);
        assert.ok(request, "元準備だけを同じOwnerへ渡す");
        if (mode === "identity_changed" && changed)
          throw Error("directory_changed");
        let cancelled = false;
        const completion = Promise.resolve().then(
          async (): Promise<IsolationExecutionResult> => {
            let resources = prepared.resources,
              cleanup = true,
              terminated = true,
              failure: IsolationExecutionResult["failure"] = null,
              delivery = true;
            const create = request.steps[0],
              run = request.steps[1];
            assert.ok(create && run);
            try {
              if (mode.startsWith("binding_")) {
                cleanup = false;
                throw Error("preparation");
              }
              if (mode === "engine") throw Error("engine");
              await callbacks.onSubmitting?.(create);
              events.push("create");
              resources = snapshot(request, true, mode !== "unknown");
              if (mode === "unknown") {
                cleanup = false;
                throw Error("unknown");
              }
              events.push("inspect");
              if (mode === "inspect") throw Error("inspect");
              await callbacks.onCreated?.(create, resources);
              events.push("run");
              if (mode === "cancel") {
                cancel();
                cancel();
                await Promise.resolve();
              }
              if (!cancelled)
                callbacks.onObserved?.(run, {
                  observation: {
                    status:
                      mode === "normal" || mode === "input_changed" ? 0 : 7,
                    signal: null,
                    stdout:
                      mode === "normal" || mode === "input_changed"
                        ? goodOutput
                        : "",
                    stderr: "",
                    outputExceeded: false,
                  },
                  elapsedMs: 1,
                  errorCode: null,
                  classification: {
                    category:
                      mode === "normal" || mode === "input_changed"
                        ? "completed"
                        : "nonzero_exit",
                    stdoutBytes:
                      mode === "normal" || mode === "input_changed"
                        ? Buffer.byteLength(goodOutput, "utf8")
                        : 0,
                    stderrBytes: 0,
                  },
                  exitClass:
                    mode === "normal" || mode === "input_changed"
                      ? "zero"
                      : "other_nonzero",
                });
              if (mode === "close") terminated = false;
              if (mode === "changed") changed = true;
            } catch (error) {
              delivery = !events.includes("receipt") && mode !== "intent";
              failure = {
                notification: null,
                kind: "command_failed",
                commandHandleObtained: events.includes("create"),
                responseObserved: mode !== "unknown",
                exceptionCode: null,
                stepKey: create.key,
                stage: mode.startsWith("binding_")
                  ? "preparation"
                  : mode === "intent" ||
                      mode === "receipt" ||
                      mode === "promise"
                    ? "notification"
                    : "observation",
                reason:
                  mode === "engine"
                    ? "docker_isolation_engine_unconfirmed"
                    : error instanceof Error && error.message === "preparation"
                      ? "docker_isolation_preparation_failed"
                      : "docker_isolation_command_failed",
              };
            }
            if (resources.resources[0]?.identity.dockerId && terminated) {
              events.push("cleanup");
              if (mode === "late_cancel") {
                cancel();
                await Promise.resolve();
              }
              cleanup = cleanup && mode !== "cleanup" && !changed;
            } else if (resources.resources[0]?.request !== "not_issued")
              cleanup = false;
            return {
              failure,
              resources,
              cancellationRequested: cancelled,
              processTerminationConfirmed: terminated,
              notificationDeliveryConfirmed: delivery,
              callbackRegistrationReleased: true,
              cleanup: {
                confirmed: cleanup,
                configCleanupConfirmed: cleanup,
                observations: [],
              },
            };
          },
        );
        return {
          cancel: async () => {
            cancelCalls++;
            cancelled = true;
            return {
              cancellationRequested: true,
              processTerminationObserved: mode !== "close",
            };
          },
          completion,
        };
      },
    },
  });
  const { createExecutor } = await import("../../src/index.ts");
  for (mode of [
    "normal",
    "intent",
    "receipt",
    "promise",
    "unknown",
    "engine",
    "inspect",
    "close",
    "cleanup",
    "cancel",
    "changed",
    "late_cancel",
    "pre_cancel",
    "identity_changed",
    "input_changed",
    "prepare_throw",
    "prepare_invalid",
    "binding_mkdir1",
    "binding_mkdir2",
    "binding_environment",
  ]) {
    events.length = 0;
    changed = false;
    delivered = null;
    cancelCalls = 0;
    const input = {
      ...mounts,
      management: mode === "prepare_invalid" ? "" : mounts.management,
    };
    const executor = createExecutor(
      { kind: "isolation_probe", probeId },
      {
        ...{ mounts: mode === "prepare_throw" ? new Proxy(input, {}) : input },
        settings: Object.freeze({
          windowsDirectory: "C:\\Windows",
          userHomeDirectory: "C:\\Users\\test",
        }),
      },
    );
    if (mode === "prepare_throw" || mode === "prepare_invalid") {
      assert.equal(executor, null);
      assert.equal(events.length, 0);
      continue;
    }
    assert.ok(executor, mode);
    if (mode === "identity_changed") changed = true;
    if (mode === "input_changed") input.workspace = "replacement";
    cancel = () => executor.cancel();
    if (mode === "pre_cancel") await executor.cancel();
    const start = executor.start({
      callbacks: {
        onCommandSubmitting: () => {
          events.push("intent");
          if (mode === "intent") throw Error("save");
        },
        onResourceCreated: (actual) => {
          assert.equal(actual, id);
          events.push("receipt");
          if (mode === "receipt") throw Error("save");
          if (mode === "promise")
            return Promise.reject(Error("reject")) as never;
        },
        onCompleted: (result) => {
          delivered = result;
          throw Error("passive");
        },
      },
    });
    if (mode === "pre_cancel" || mode === "identity_changed") {
      assert.equal(start.status, "blocked");
      assert.equal(start.completion, null);
      assert.deepEqual(events, []);
    } else {
      assert.ok(start.status === "started", mode);
      const result = await start.completion;
      assert.equal(delivered, result);
      assert.equal(result.kind, "isolation_probe");
      assert.equal(
        result.status,
        mode === "normal" || mode === "input_changed"
          ? "completed"
          : mode === "cancel"
            ? "cancelled"
            : "blocked",
        mode,
      );
      if (mode === "late_cancel") {
        assert.equal(result.reason, "docker_isolation_probe_failed");
        assert.equal(result.cancelled, true);
      }
      if (mode === "cancel") {
        assert.equal(result.cleanupConfirmed, true);
        assert.equal(cancelCalls, 1);
      }
      if (mode.startsWith("binding_")) {
        assert.equal(result.creationAttempted, false);
        assert.deepEqual(events, []);
        assert.equal(result.cleanupConfirmed, false);
      }
      if (mode === "unknown") {
        assert.equal(result.containerId, null);
        assert.equal(result.cleanupConfirmed, false);
        assert.deepEqual(events, ["intent", "create"]);
      }
      if (mode === "intent") assert.deepEqual(events, ["intent"]);
      if (["receipt", "promise", "inspect"].includes(mode)) {
        assert.equal(events.includes("run"), false);
        assert.equal(result.containerId, id);
        assert.equal(events.includes("cleanup"), true);
      }
      if (mode === "close") {
        assert.equal(events.includes("cleanup"), false);
        assert.equal(result.processCompletionConfirmed, false);
      }
      if (["cleanup", "changed"].includes(mode))
        assert.equal(result.cleanupConfirmed, false);
      assert.ok(result.resourceSnapshot);
    }
    assert.equal(executor.start({}).status, "blocked");
    assert.deepEqual(await executor.cancel(), {
      status: "blocked",
      reason: "invalid",
    });
  }
  let settingReads = 0;
  const getterOptions = Object.defineProperty({ mounts }, "settings", {
    get() {
      settingReads++;
      throw Error("getter");
    },
  });
  assert.equal(
    createExecutor(
      { kind: "isolation_probe", probeId },
      getterOptions as never,
    ),
    null,
  );
  assert.equal(settingReads, 0);
  await new Promise<void>((resolve) => setImmediate(resolve));
});

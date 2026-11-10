/**
 * 公式Desktop運用の受付・通知・取消・解放を実Machineで検証する。
 * @responsibility 保存拒否と技術的な完了・回収を分離する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 一操作。実Docker・Native・外部AIなし。
 * @boundary 再起動入口→実Machine→有限CLI代役。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  restartDesktopForVerification,
  type RestartInput,
  type DockerEnvironmentRestartEvent,
} from "../../src/docker-desktop/restart.ts";
import { createDockerRestartMachineForVerification } from "../../src/docker-desktop/restart-state.ts";
import type { DesktopOperations } from "../../src/docker-desktop/types.ts";

function fixture(change = "") {
  const calls: string[] = [];
  const events: DockerEnvironmentRestartEvent[] = [];
  const controller = new AbortController();
  let stopped = false,
    closed = false,
    engine: "ready" | "known_unavailable" = "ready";
  const desktop: DesktopOperations = {
    verify: () => !closed,
    async command(action) {
      calls.push(action);
      if (action === "stop") {
        stopped = true;
        engine = "known_unavailable";
      }
      if (action === "start") engine = "ready";
      return {
        issued: true,
        completed: true,
        cleanupConfirmed: true,
        status: stopped ? "stopped" : "running",
      };
    },
    async close() {
      calls.push("close");
      closed = true;
      return change !== "close";
    },
  };
  const input: RestartInput = {
    requestId: "a".repeat(64),
    signal: controller.signal,
    verifyBoundary: () => change !== "boundary",
    onRequesting() {
      calls.push("intent");
      if (change === "intent") throw Error("fixture");
    },
    onEvent(event) {
      events.push(event);
      if (change === "notification") throw Error("fixture");
    },
  };
  const dependencies: Parameters<typeof restartDesktopForVerification>[1] = {
    platform: "win32",
    async acquire() {
      calls.push("acquire");
      return {
        operations: change === "unavailable" ? null : desktop,
        cleanupConfirmed: true,
      };
    },
    createMachine(operations, boundary, signal, accepted, attempted) {
      return createDockerRestartMachineForVerification({
        desktop: operations,
        boundary,
        signal,
        ...(accepted ? { onRequestAccepted: accepted } : {}),
        ...(attempted ? { onRequestAttempted: attempted } : {}),
        observeEngine: () => engine,
        observeBackend: () => (stopped ? "stopped" : "running"),
        containersAbsent: () => true,
        now: () => 0,
        wait: async () => {},
      });
    },
    now: () => 0,
  };
  return { input, dependencies, calls, events, controller, desktop };
}

test("通知が元Requestを変更しても捕捉済みSignalをCLIへ渡す", async () => {
  const f = fixture();
  const replacement = new AbortController();
  const request = {
    ...f.input,
    onRequesting() {
      request.signal = replacement.signal;
    },
  };
  const acquire = f.dependencies.acquire;
  let received: AbortSignal | null = null;
  const result = await restartDesktopForVerification(request, {
    ...f.dependencies,
    acquire(signal) {
      received = signal;
      return acquire(signal);
    },
  });
  assert.equal(received, f.controller.signal);
  assert.equal(result.status, "completed");
});
test("不正入力はgetter・取得・保存を呼ばず拒否する", async () => {
  const f = fixture();
  let reads = 0;
  const bad = Object.defineProperty({ ...f.input }, "requestId", {
    enumerable: true,
    get() {
      reads++;
      throw Error("getter");
    },
  });
  for (const value of [
    null,
    bad,
    new Proxy(f.input, {}),
    { ...f.input, extra: true },
    { ...f.input, signal: {} },
  ]) {
    const result = await restartDesktopForVerification(
      value as RestartInput,
      f.dependencies,
    );
    assert.equal(result.reason, "docker_restart_input_invalid");
    assert.equal(result.request, "not_issued");
  }
  assert.equal(reads, 0);
  assert.deepEqual(f.calls, []);
});
test("必須intent完了後だけCLIへ進み、解放後に終端を通知する", async () => {
  const f = fixture();
  const result = await restartDesktopForVerification(f.input, f.dependencies);
  assert.equal(result.status, "completed");
  assert.equal(result.cleanupConfirmed, true);
  assert.equal(result.delivery, "confirmed");
  assert.deepEqual(f.calls.slice(0, 2), ["intent", "acquire"]);
  assert.equal(f.calls.at(-1), "close");
  assert.deepEqual(
    f.events.map((x) => x.event),
    ["request_accepted", "settled"],
  );
});
for (const change of [
  "intent",
  "boundary",
  "unavailable",
  "close",
  "notification",
]) {
  test("停止・通知・回収の失敗を混同しない: " + change, async () => {
    const f = fixture(change);
    const result = await restartDesktopForVerification(f.input, f.dependencies);
    assert.equal(result.status, "blocked");
    if (change === "intent" || change === "boundary")
      assert.equal(f.calls.includes("acquire"), false);
    if (change === "unavailable") assert.equal(f.calls.includes("stop"), false);
    if (change === "close") {
      assert.equal(result.cleanupConfirmed, false);
      assert.equal(result.restartCompleted, false);
    }
    if (change === "notification") assert.equal(result.delivery, "unknown");
  });
}
test("開始前取消はintent・取得とも発行しない", async () => {
  const f = fixture();
  f.controller.abort();
  const result = await restartDesktopForVerification(f.input, f.dependencies);
  assert.equal(result.status, "blocked");
  assert.deepEqual(f.calls, []);
});
test("取得待機中取消は遅延取得した資源を解放するまで返さない", async () => {
  const f = fixture();
  let resolve:
    | ((value: Awaited<ReturnType<typeof f.dependencies.acquire>>) => void)
    | null = null;
  const acquired = new Promise<
    Awaited<ReturnType<typeof f.dependencies.acquire>>
  >((r) => {
    resolve = r;
  });
  const output = restartDesktopForVerification(f.input, {
    ...f.dependencies,
    acquire: () => acquired,
  });
  f.controller.abort();
  const fulfill = resolve as unknown as (
    value: Awaited<ReturnType<typeof f.dependencies.acquire>>,
  ) => void;
  fulfill({ operations: f.desktop, cleanupConfirmed: true });
  const result = await output;
  assert.equal(result.restartCompleted, false);
  assert.deepEqual(f.calls, ["intent", "close"]);
});
test("不正な非同期保存通知を成功・未処理Rejectにしない", async () => {
  const f = fixture();
  const result = await restartDesktopForVerification(
    {
      ...f.input,
      onRequesting: () => Promise.reject(Error("fixture")),
    } as unknown as RestartInput,
    f.dependencies,
  );
  assert.equal(result.status, "blocked");
  assert.equal(f.calls.includes("acquire"), false);
  await new Promise((r) => setImmediate(r));
});
test("取得途中清掃不明を未取得の成功清掃に変換しない", async () => {
  const f = fixture();
  for (const operations of [null, f.desktop]) {
    const result = await restartDesktopForVerification(f.input, {
      ...f.dependencies,
      acquire: async () => ({ operations, cleanupConfirmed: false }),
    });
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.cleanupFailure, "docker_restart_cleanup_unconfirmed");
    assert.equal(f.calls.includes("stop"), false);
  }
});

test("取得例外の清掃を未取得成功へ補完しない", async () => {
  const f = fixture();
  const result = await restartDesktopForVerification(f.input, {
    ...f.dependencies,
    acquire: async () => {
      throw Error("acquisition unknown");
    },
  });
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(f.calls.includes("stop"), false);
});

/**
 * 公式CLIの停止・状態・起動とEngine/WSLの独立したGateを検証する。
 * @responsibility Process不存在を模擬せず、CLI契約と観測不明を区別する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 実Machineと有限CLI代役。実Docker・Native・外部AIなし。
 * @boundary Desktop Machine→公式CLI操作・Engine/WSL観測の代役。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { getEventListeners } from "node:events";
import { createDockerRestartMachineForVerification } from "../../src/docker-desktop/restart-state.ts";
import type { DesktopOperations } from "../../src/docker-desktop/types.ts";

function fixture(change = "") {
  const calls: string[] = [];
  const controller = new AbortController();
  let live = true,
    closed = false,
    stopped = false;
  let engine: "ready" | "known_unavailable" | "unknown" = "ready";
  let backend: "running" | "stopped" | "unknown" = "running";
  const desktop: DesktopOperations = {
    verify: () => live && !closed && change !== "trust",
    async command(action) {
      calls.push(action);
      if (action === "status")
        return {
          issued: true,
          completed: true,
          cleanupConfirmed: true,
          status:
            change === "status" ? "unknown" : stopped ? "stopped" : "running",
        };
      if (action === "stop") {
        if (change === "unissued" || change === "stop")
          return {
            issued: change !== "unissued",
            completed: false,
            cleanupConfirmed: true,
            status: "unknown",
          };
        if (!change.startsWith("delayed")) {
          stopped = true;
          engine = change === "engine-residual" ? "ready" : "known_unavailable";
          backend = change === "backend-residual" ? "running" : "stopped";
        }
      }
      if (action === "start") engine = change === "start" ? "unknown" : "ready";
      return {
        issued: true,
        completed: true,
        cleanupConfirmed: true,
        status: "unknown",
      };
    },
    async close() {
      calls.push("close");
      closed = true;
      return change !== "close";
    },
  };
  const machine = createDockerRestartMachineForVerification({
    desktop,
    signal: controller.signal,
    boundary: () => live,
    observeEngine: () => engine,
    observeBackend: () => backend,
    containersAbsent: () => change !== "containers",
    now: () => 0,
    async wait() {
      calls.push("wait");
      if (change === "delayed-cancel") controller.abort();
      if (change === "delayed-lock") live = false;
      if (change === "delayed-success") {
        stopped = true;
        engine = "known_unavailable";
        backend = "stopped";
      }
    },
  });
  return { machine, calls, controller };
}

test("同期stop後にstatus・Engine・WSLを確認し、一回だけstartする", async () => {
  const f = fixture();
  assert.equal(await f.machine.stop(), "stopped");
  assert.equal(await f.machine.start(), "ready");
  assert.equal(await f.machine.release(), true);
  assert.equal(f.calls.filter((x) => x === "stop").length, 1);
  assert.equal(f.calls.filter((x) => x === "start").length, 1);
  assert.equal(f.calls.at(-1), "close");
  assert.equal(getEventListeners(f.controller.signal, "abort").length, 0);
});
for (const change of [
  "trust",
  "status",
  "containers",
  "stop",
  "unissued",
  "engine-residual",
  "backend-residual",
  "delayed-timeout",
  "delayed-cancel",
  "delayed-lock",
]) {
  test("停止未確認ではstartしない: " + change, async () => {
    const f = fixture(change);
    assert.equal(await f.machine.stop(), "unknown");
    assert.equal(await f.machine.start(), "unknown");
    await f.machine.release();
    assert.equal(f.calls.includes("start"), false);
    assert.ok(f.calls.filter((x) => x === "stop").length <= 1);
    assert.equal(getEventListeners(f.controller.signal, "abort").length, 0);
  });
}
test("停止後の状態遷移はstopの再送なしで有界待機する", async () => {
  const f = fixture("delayed-success");
  assert.equal(await f.machine.stop(), "stopped");
  assert.equal(f.calls.filter((x) => x === "stop").length, 1);
  assert.equal(f.machine.getEffectOutcomeUnknown(), false);
  await f.machine.release();
});
test("起動後Engine未確認・操作資源回収失敗を成功にしない", async () => {
  const f = fixture("start");
  assert.equal(await f.machine.stop(), "stopped");
  assert.equal(await f.machine.start(), "unknown");
  assert.equal(f.machine.getStartFailure(), "readiness_timeout");
  await f.machine.release();
  const g = fixture("close");
  await g.machine.stop();
  assert.equal(await g.machine.release(), false);
});

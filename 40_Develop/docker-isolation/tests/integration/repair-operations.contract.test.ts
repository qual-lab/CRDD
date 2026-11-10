/**
 * 公式停止・WSL停止・Directory退避の独立Gateを検証する。
 * @responsibility Process不存在を模擬せず、部分退避・再出現を成功にしない。
 * @trace ERB-IT-014
 * @level IT
 * @scope 有限代役のみ。実Docker・Native・外部AIなし。
 * @boundary 実修復技術操作→CLI・Directory・Engine/WSL代役。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createDockerDesktopRepairOperations } from "../../src/docker-desktop/repair-operations.ts";
import {
  actions,
  decodeRepairCheckpoint,
} from "../../src/docker-desktop/validation.ts";
import type {
  DesktopOperations,
  DirectoryIdentity,
  RepairCheckpoint,
} from "../../src/docker-desktop/types.ts";

/** 失敗起動後は初回stop_backendの記録を現在停止の証拠にしない。 @trace ERB-IT-014 */
for (const backend of ["running", "unknown", "stopped"] as const) {
  test(`失敗起動後のDirectory処置は現在Backendを再観測する: ${backend}`, async () => {
    const f = fixture();
    const identities = {
      initial: { dev: "1", ino: "31", birthtimeNs: "3" },
      failed: { dev: "1", ino: "32", birthtimeNs: "3" },
      auxiliary: { dev: "1", ino: "33", birthtimeNs: "3" },
    };
    const checkpoint: RepairCheckpoint = {
      ...f.checkpoint,
      directories: {
        primary: {
          expected: identities.initial,
          source: { state: "absent", identity: null },
          retained: { state: "present", identity: identities.initial },
        },
        failed: {
          expected: identities.failed,
          source: { state: "present", identity: identities.failed },
          retained: { state: "absent", identity: null },
        },
        auxiliary: {
          expected: identities.auxiliary,
          source: { state: "present", identity: identities.auxiliary },
          retained: { state: "absent", identity: null },
        },
      },
      stale: "retained",
    };
    let backendReads = 0;
    const operations = createDockerDesktopRepairOperations(
      {
        verify: () => true,
        command: async () => ({
          issued: true,
          completed: true,
          cleanupConfirmed: true,
          status: "stopped",
        }),
        close: async () => true,
      },
      {
        verify: () => true,
        observe(purpose) {
          return {
            source:
              purpose === "initial"
                ? { state: "confirmed_absent", identity: null }
                : { state: "present", identity: identities[purpose] },
            retained:
              purpose === "initial"
                ? { state: "present", identity: identities.initial }
                : { state: "confirmed_absent", identity: null },
          };
        },
        lock: (purpose) => identities[purpose],
        retain: () => {
          assert.fail("precondition only");
        },
      },
      new AbortController().signal,
      () => true,
      {
        engine: () => ({ state: "known_unavailable", cleanup: "confirmed" }),
        backend: () => {
          backendReads++;
          return backend;
        },
        terminateBackend: () => {
          assert.fail("no new stop action");
        },
        wait: async () => "ready",
      },
    );
    const result = await operations.technical.precondition(
      "retain_failed_runtime",
      checkpoint,
    );
    assert.equal(result, backend === "stopped" ? "proceed" : "unknown");
    assert.ok(backendReads > 0);
  });
}

function fixture(fault = "") {
  const calls: string[] = [];
  let stopped = false,
    retained = false,
    live = true;
  const controller = new AbortController();
  const id: DirectoryIdentity = { dev: "1", ino: "11", birthtimeNs: "111" };
  const other: DirectoryIdentity = { dev: "1", ino: "22", birthtimeNs: "222" };
  const raw = {
    actions: Object.fromEntries(
      actions.map((name) => [
        name,
        { intent: "not_saved", request: "not_issued", result: "unobserved" },
      ]),
    ),
    directories: {
      primary: {
        expected: id,
        source: { state: "present", identity: id },
        retained: { state: "absent", identity: null },
      },
      failed: {
        expected: null,
        source: { state: "unobserved", identity: null },
        retained: { state: "absent", identity: null },
      },
      auxiliary: {
        expected: null,
        source: { state: "unobserved", identity: null },
        retained: { state: "absent", identity: null },
      },
    },
    engine: "unavailable",
    hostSafety: "safe",
    stale: "absent",
    cleanup: "pending",
    cleanupFailure: null,
  };
  const checkpoint = decodeRepairCheckpoint(raw);
  assert.ok(checkpoint);
  const desktop: DesktopOperations = {
    verify: () => fault !== "trust" && live,
    async command(action) {
      calls.push(action);
      if (action === "stop") {
        if (fault !== "stop") stopped = true;
        if (fault === "owner") live = false;
      }
      return {
        issued: fault !== "not-issued",
        completed: fault !== "stop" && fault !== "not-issued",
        cleanupConfirmed: fault !== "cleanup",
        status:
          fault === "status" ? "unknown" : stopped ? "stopped" : "running",
      };
    },
    close: async () => true,
  };
  const access: Parameters<typeof createDockerDesktopRepairOperations>[1] = {
    verify: () => fault !== "directory",
    observe() {
      return {
        source:
          retained && fault !== "reappear"
            ? { state: "confirmed_absent" as const, identity: null }
            : { state: "present" as const, identity: retained ? other : id },
        retained: retained
          ? { state: "present" as const, identity: id }
          : { state: "confirmed_absent" as const, identity: null },
      };
    },
    lock: () => id,
    retain() {
      calls.push("rename");
      retained = true;
      return {
        issued: true,
        confirmation: fault === "rename" ? "unknown" : "confirmed",
        staleState: "retained",
      };
    },
  };
  const operations = createDockerDesktopRepairOperations(
    desktop,
    access,
    controller.signal,
    () => live,
    {
      engine: () => ({ state: "known_unavailable", cleanup: "confirmed" }),
      backend: () => (fault === "backend" ? "unknown" : "stopped"),
      terminateBackend: () => ({ issued: false, confirmation: "not_issued" }),
      wait: async () => "ready",
    },
  );
  return {
    operations,
    checkpoint,
    calls,
    controller,
    setStopped() {
      stopped = true;
    },
  };
}
test("stopは同期CLI完了と停止statusを別々に確認する", async () => {
  const f = fixture();
  assert.equal(
    await f.operations.technical.precondition("stop_runtime", f.checkpoint),
    "proceed",
  );
  const result = await f.operations.technical.execute(
    "stop_runtime",
    f.checkpoint,
  );
  assert.equal(result.issued, true);
  assert.equal(result.confirmation, "confirmed");
  assert.equal(f.calls.filter((v) => v === "stop").length, 1);
  assert.equal(f.calls.at(-1), "status");
});
for (const fault of [
  "stop",
  "not-issued",
  "status",
  "cleanup",
  "owner",
  "directory",
  "trust",
]) {
  test("停止の不成立・現在許可喪失では退避へ進まない: " + fault, async () => {
    const f = fixture(fault);
    const result = await f.operations.technical.execute(
      "stop_runtime",
      f.checkpoint,
    );
    assert.notEqual(result.confirmation, "confirmed");
    assert.equal(f.calls.includes("rename"), false);
  });
}
for (const fault of ["", "backend", "rename", "reappear"]) {
  test(
    "退避後の実体・元再出現・Backend不明を区別する: " + (fault || "normal"),
    async () => {
      const f = fixture(fault);
      f.setStopped();
      const checkpoint: RepairCheckpoint = {
        ...f.checkpoint,
        actions: {
          ...f.checkpoint.actions,
          stop_runtime: {
            intent: "saved",
            request: "issued",
            result: "confirmed",
          },
          stop_backend: {
            intent: "saved",
            request: "issued",
            result: "confirmed",
          },
        },
      };
      const result = await f.operations.technical.execute(
        "retain_runtime",
        checkpoint,
      );
      assert.equal(
        result.confirmation,
        fault === ""
          ? "confirmed"
          : fault === "backend"
            ? "not_issued"
            : "unknown",
      );
      if (fault === "backend") assert.equal(f.calls.includes("rename"), false);
      if (fault === "reappear" || fault === "rename")
        assert.deepEqual(result.observation, checkpoint);
    },
  );
}

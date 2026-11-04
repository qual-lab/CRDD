/**
 * 既存資源APIの単一Container接続を非Dockerで確認する。
 * @packageDocumentation
 * @responsibility 元構成・取消Signal・三値観測と回収を同じ実Executor本文へ結合する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 有限DI代役のみ。実AI・Docker・Filesystem操作なし。
 * @boundary 上位対象→Executor資源API→DI。
 */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import * as isolation from "../../../docker-isolation/src/index.ts";
import type { ResourceTarget } from "../../src/index.ts";

/**
 * 単一Containerの診断・回収を同じ構成と同じ取消Signalへ結合する。
 * @responsibility 不存在と不明を区別し、明示取消後の処置を止める。
 * @trace ERB-IT-014
 * @precondition DI Moduleをimport前に有限代役へ置換する。
 * @stimulus present・absent・unknown、回収、明示取消。
 * @observation 引数参照・CLI確認回数・操作順。
 * @oracle 元構成を使用し、cleanupは先行inspectなしでも再照合へ渡す。
 * @cleanup mock解除。実資源なし。
 * @boundary ERB-IT-014=Direct Boundary: 指定済みIdentityからDIの技術操作への搬送。
 */
test("既存資源APIは単一Containerを用途判断なしで観測・回収する", async () => {
  const configuration = Object.freeze({
    id: "a".repeat(64),
    name: "crdd-coordinator-probe-fixture",
    ownershipLabel: "crdd.coordinator.probe=fixture",
  });
  const controller = new AbortController();
  let absent = false,
    present = true,
    closed = false,
    checks = 0;
  const calls: string[] = [];
  const lower = mock.module(
    new URL("../../../docker-isolation/src/index.ts", import.meta.url).href,
    {
      namedExports: {
        ...isolation,
        inspectIsolation: (target: ResourceTarget<"container">) => {
          target.signal?.throwIfAborted();
          assert.equal(target.managementDirectory, "management");
          assert.equal(target.configuration, configuration);
          checks++;
          calls.push("inspect");
          return {
            observation: absent ? "absent" : present ? "present" : "unknown",
            runningConfirmed: !absent && present,
            snapshot: !absent && present ? { resources: [] } : null,
          };
        },
        cleanupIsolation: (target: ResourceTarget<"container">) => {
          target.signal?.throwIfAborted();
          assert.equal(target.configuration, configuration);
          assert.equal(target.signal, controller.signal);
          checks++;
          calls.push("cleanup");
          closed = true;
          return { confirmed: true, reason: "docker_probe_absence_confirmed" };
        },
      },
    },
  );
  try {
    const api = await import("../../src/lifecycle/cleanup.ts");
    const target: ResourceTarget<"container"> = {
      kind: "container",
      configuration,
      managementDirectory: "management",
      signal: controller.signal,
    };
    assert.deepEqual(api.inspectResources(target), {
      observation: "present",
      runningConfirmed: true,
      snapshot: { resources: [] },
    });
    present = false;
    assert.equal(api.inspectResources(target).observation, "unknown");
    absent = true;
    assert.equal(api.inspectResources(target).observation, "absent");
    calls.length = 0;
    assert.equal(api.cleanupResources(target).confirmed, true);
    assert.deepEqual(calls, ["cleanup"]);
    assert.equal(closed, true);
    assert.ok(checks > 0);
    controller.abort();
    calls.length = 0;
    assert.throws(() => api.inspectResources(target), { name: "AbortError" });
    assert.throws(() => api.cleanupResources(target), { name: "AbortError" });
    assert.equal(calls.length, 0);
    assert.equal(Object.hasOwn(target, "assertOwner"), false);
  } finally {
    lower.restore();
  }
});

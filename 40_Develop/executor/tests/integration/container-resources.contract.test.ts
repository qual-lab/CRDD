/**
 * 既存資源APIの単一Container接続を非Dockerで確認する。
 * @packageDocumentation
 * @responsibility 元構成・現在Owner・三値観測と回収を同じ実Executor本文へ結合する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 有限DI代役のみ。実AI・Docker・Filesystem操作なし。
 * @boundary 上位対象→Executor資源API→DI。
 */
import assert from "node:assert/strict";
import test, { mock } from "node:test";
import * as isolation from "../../../docker-isolation/src/index.ts";
import type { ContainerResourceTarget } from "../../src/index.ts";

/**
 * 単一Containerの診断・回収を同じ構成とfresh Ownerへ結合する。
 * @responsibility 不存在と不明を区別し、Owner喪失後の処置を止める。
 * @trace ERB-IT-014
 * @precondition DI Moduleをimport前に有限代役へ置換する。
 * @stimulus present・absent・unknown、回収、Owner喪失。
 * @observation 引数参照・CLI確認回数・操作順。
 * @oracle 元構成を使用し、cleanupは先行inspectなしでも再照合へ渡す。
 * @cleanup mock解除。実資源なし。
 */
test("既存資源APIは単一Containerを用途判断なしで観測・回収する", async () => {
  const configuration = isolation.describeDockerProbeConfiguration(
    "legacy_recovery",
    { id: "a".repeat(64), probeId: "fixture" },
    { workspace: "w", providerHome: "h", tmp: "t" },
  );
  let live = true,
    absent = false,
    present = true,
    closed = false,
    checks = 0;
  const calls: string[] = [];
  const lower = mock.module(
    new URL("../../../docker-isolation/src/index.ts", import.meta.url).href,
    {
      namedExports: {
        ...isolation,
        createDockerProbeRuntimeBinding: (read: () => string) => {
          assert.equal(read(), "management");
          return {
            environment: () => ({}),
            verifyCli: () => {
              checks++;
              return "fixed";
            },
          };
        },
        observeDockerContainerAbsence: (
          binding: { verifyCli: () => string },
          identity: object,
        ) => {
          binding.verifyCli();
          calls.push("absence");
          assert.deepEqual(identity, {
            id: configuration.id,
            name: configuration.name,
            ownershipLabel: configuration.ownershipLabel,
          });
          return { status: absent ? "confirmed" : "blocked" };
        },
        inspectDockerContainer: (
          binding: { verifyCli: () => string },
          expected: object,
        ) => {
          binding.verifyCli();
          calls.push("inspect");
          assert.equal(expected, configuration);
          return present ? { runningConfirmed: true } : null;
        },
        cleanupDockerContainer: (
          binding: { verifyCli: () => string },
          expected: object,
          owner: () => boolean,
        ) => {
          binding.verifyCli();
          assert.equal(owner(), true);
          calls.push("cleanup");
          assert.equal(expected, configuration);
          closed = true;
          return { confirmed: true, reason: "docker_probe_absence_confirmed" };
        },
      },
    },
  );
  try {
    const api = await import("../../src/resources/execute.ts");
    const target: ContainerResourceTarget = {
      kind: "container",
      configuration,
      managementDirectory: "management",
      assertOwner: () => live,
    };
    assert.deepEqual(api.inspectResources(target), {
      observation: "present",
      runningConfirmed: true,
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
    live = false;
    calls.length = 0;
    assert.throws(() => api.inspectResources(target), /owner_unconfirmed/u);
    assert.throws(() => api.cleanupResources(target), /owner_unconfirmed/u);
    assert.equal(calls.length, 0);
    let unhandled = 0;
    const onUnhandled = () => {
      unhandled++;
    };
    process.on("unhandledRejection", onUnhandled);
    try {
      for (const nth of [1, 2, 3])
        for (const mode of ["reject", "late", "pending"]) {
          let ownerCalls = 0;
          const invalid = {
            ...target,
            assertOwner: () => {
              if (++ownerCalls !== nth) return true;
              return mode === "reject"
                ? Promise.reject(Error("owner"))
                : mode === "late"
                  ? new Promise((_resolve, reject) =>
                      setImmediate(() => reject(Error("late"))),
                    )
                  : new Promise(() => {});
            },
          } as unknown as ContainerResourceTarget;
          calls.length = 0;
          assert.throws(
            () => api.cleanupResources(invalid),
            /owner_unconfirmed/u,
          );
          assert.equal(calls.includes("cleanup"), false);
          if (nth === 1) assert.equal(calls.length, 0);
        }
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(unhandled, 0);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  } finally {
    lower.restore();
  }
});

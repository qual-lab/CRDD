/**
 * 修復Machine試験の固定入力と有限技術代役を共有する。
 * @responsibility DIの値契約だけで入力・通知・処置counterを構築し、Domain保存実装に依存しない。
 * @trace ERB-IT-014
 * @boundary 試験内のメモリ値のみ。実Docker・Filesystem処置・保存Authorityは扱わない。
 */
import assert from "node:assert/strict";
import type { executeRepairSteps } from "../../src/docker-desktop/repair.ts";
import type { RepairCheckpoint } from "../../src/docker-desktop/types.ts";
import {
  decodeRepairCheckpoint,
  validateRepairCheckpointTransition,
} from "../../src/docker-desktop/validation.ts";

export const repairActionNames = [
  "stop_runtime",
  "stop_backend",
  "retain_runtime",
  "start_runtime",
  "stop_failed_runtime",
  "retain_failed_runtime",
  "retain_auxiliary_runtime",
  "restart_runtime",
] as const;

/**
 * 一つの未処置slotへ到達する固定状態と技術境界を作る。
 * @responsibility 各試験の効果・通知・観測counterを独立させる。
 * @trace ERB-IT-014
 * @precondition 前処置は明示不要、継続時の初回起動だけ確認済み。
 * @stimulus prefixとEngine最終状態を指定する。
 * @observation 実codecが受理した状態と模擬counter。
 * @oracle 固定八操作以外を発行せず、全通知の遷移を実validatorで検査する。
 * @cleanup N/A: メモリ値のみ。
 * @boundary 合成技術境界。実OSの成立は主張しない。
 */
export function createRepairMachineFixture(prefix = 0, continuation = false) {
  const checkpoint = decodeRepairCheckpoint({
    actions: Object.fromEntries(
      repairActionNames.map((name, index) => [
        name,
        (index === 3 || (index === 2 && continuation)) && prefix >= 4
          ? { intent: "saved", request: "issued", result: "confirmed" }
          : {
              intent: "not_saved",
              request: "not_issued",
              result: index < prefix ? "not_required" : "unobserved",
            },
      ]),
    ),
    directories: Object.fromEntries(
      ["primary", "failed", "auxiliary"].map((name) => [
        name,
        {
          expected:
            name === "primary" && continuation && prefix >= 4
              ? { dev: "1", ino: "4", birthtimeNs: "3" }
              : null,
          source: { state: "absent", identity: null },
          retained:
            name === "primary" && continuation && prefix >= 4
              ? {
                  state: "present",
                  identity: { dev: "1", ino: "4", birthtimeNs: "3" },
                }
              : { state: "absent", identity: null },
        },
      ]),
    ),
    engine: "unavailable",
    stale: continuation && prefix >= 4 ? "retained" : "absent",
    hostSafety: "safe",
    cleanup: "pending",
    cleanupFailure: null,
  });
  assert.ok(checkpoint);
  const controller = new AbortController();
  const calls = {
    observe: 0,
    precondition: [] as string[],
    execute: [] as string[],
    notifications: [] as RepairCheckpoint[],
    engine: 0,
  };
  let saved = checkpoint;
  const input = {
    checkpoint,
    signal: controller.signal,
    canIssueEffect: (): unknown => true,
    onCheckpoint: (next: RepairCheckpoint): void => {
      assert.ok(validateRepairCheckpointTransition(saved, next));
      calls.notifications.push(next);
      saved = next;
      return;
    },
  };
  const technical: Parameters<typeof executeRepairSteps>[1] = {
    observe: async (value, phase) => {
      calls.observe++;
      if (phase === "failed_launch") {
        const bound = decodeRepairCheckpoint({
          ...value,
          directories: {
            ...value.directories,
            ...Object.fromEntries(
              [
                ["failed", "7"],
                ["auxiliary", "8"],
              ].map(([purpose, ino]) => {
                const identity = { dev: "1", ino, birthtimeNs: "3" };
                return [
                  purpose,
                  {
                    expected: identity,
                    source: { state: "present", identity },
                    retained: { state: "absent", identity: null },
                  },
                ];
              }),
            ),
          },
        });
        assert.ok(bound);
        return bound;
      }
      return {
        ...value,
        engine:
          value.actions.restart_runtime.result === "confirmed" ||
          (!continuation && value.actions.start_runtime.result === "confirmed")
            ? "ready"
            : value.engine,
      };
    },
    precondition: async (action) => {
      calls.precondition.push(action);
      return "proceed";
    },
    execute: async (action, value) => {
      calls.execute.push(action);
      const purpose =
        action === "retain_runtime"
          ? "primary"
          : action === "retain_failed_runtime"
            ? "failed"
            : action === "retain_auxiliary_runtime"
              ? "auxiliary"
              : null;
      const id = (purpose && value.directories[purpose].expected) ?? {
        dev: "1",
        ino: String(repairActionNames.indexOf(action) + 1),
        birthtimeNs: "3",
      };
      const observation = purpose
        ? decodeRepairCheckpoint({
            ...value,
            stale: "retained",
            directories: {
              ...value.directories,
              [purpose]: {
                expected: id,
                source: { state: "absent", identity: null },
                retained: { state: "present", identity: id },
              },
            },
          })
        : value;
      assert.ok(observation);
      return { issued: true, confirmation: "confirmed", observation };
    },
    awaitEngine: async (stage, value) => {
      calls.engine++;
      assert.ok(decodeRepairCheckpoint(value));
      assert.ok(Object.isFrozen(value));
      if (stage === "after_initial_start")
        assert.equal(value.actions.start_runtime.result, "confirmed");
      else assert.equal(value.actions.restart_runtime.result, "confirmed");
      return continuation && stage === "after_initial_start"
        ? {
            state: "startup_timeout",
            continuation: { engine: "transient_unavailable" },
          }
        : { state: "ready", continuation: null };
    },
  };
  return { input, technical, controller, calls, saved: () => saved };
}

/**
 * 修復Machineの九処置と保存切断窓を反証する。
 * @packageDocumentation
 * @responsibility 純粋checkpointと本番順序を結合し、実OS操作とは区別する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 内部Machineと模擬技術境界。実Docker・Native・Provider要求0。
 * @boundary ERB-IT-014=Direct Boundary: 修復Machine→保存通知／技術Adapter。
 */
import {
  decodeDockerRuntimeRepairCheckpoint as decode,
  dockerRuntimeRepairCheckpointIsSettled,
  type DockerRuntimeRepairCheckpoint as Checkpoint,
} from "../../../domain-model/src/index.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInThisContext } from "node:vm";
import { types } from "node:util";
import test from "node:test";
import { runDockerRuntimeRepairMachine as run } from "../../src/docker-desktop/repair.ts";
import { validateDockerRuntimeRepairCheckpointTransition as transition } from "../../../domain-model/src/index.ts";

const names = [
  "stop_runtime",
  "terminate_runtime",
  "stop_backend",
  "retain_runtime",
  "start_runtime",
  "stop_failed_runtime",
  "retain_failed_runtime",
  "retain_auxiliary_runtime",
  "restart_runtime",
] as const;

/**
 * 指定した保存故障へ実際に一度到達したことを必須断言する。
 * @responsibility 条件付きOracleによる注入未到達の見逃しを防ぐ。
 * @trace ERB-IT-014
 * @precondition 当該Caseの通知位置と注入記録を独立に取得済み。
 * @stimulus 対象slotと保存段階を期待値として渡す。
 * @observation 到達位置、対象、段階、注入回数。
 * @oracle 注入位置が正数で記録一件の対象・段階が一致する。
 * @cleanup N/A: 値検査のみ。
 * @boundary 試験故障注入と必須到達Oracle。
 */
function assertCheckpointFaultReached(
  rejectedAt: number,
  injections: { action: string; stage: string }[],
  action: string,
  stage: string,
) {
  assert.ok(rejectedAt > 0, "checkpoint_fault_not_reached");
  assert.deepEqual(injections, [{ action, stage }]);
}

/**
 * 一つの未処置slotへ到達する固定状態と技術境界を作る。
 * @responsibility 各試験の効果・通知・観測counterを独立させる。
 * @trace ERB-IT-014
 * @precondition 前処置は明示不要、継続時の初回起動だけ確認済み。
 * @stimulus prefixとEngine最終状態を指定する。
 * @observation 実codecが受理した状態と模擬counter。
 * @oracle 固定九操作以外を発行せず、全通知の遷移を実validatorで検査する。
 * @cleanup N/A: メモリ値のみ。
 * @boundary 合成技術境界。実OSの成立は主張しない。
 */
function fixture(prefix = 0, continuation = false) {
  const checkpoint = decode({
    actions: Object.fromEntries(
      names.map((name, index) => [
        name,
        (index === 4 || (index === 3 && continuation)) && prefix >= 5
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
            name === "primary" && continuation && prefix >= 5
              ? { dev: "1", ino: "4", birthtimeNs: "3" }
              : null,
          source: { state: "absent", identity: null },
          retained:
            name === "primary" && continuation && prefix >= 5
              ? {
                  state: "present",
                  identity: { dev: "1", ino: "4", birthtimeNs: "3" },
                }
              : { state: "absent", identity: null },
        },
      ]),
    ),
    engine: "unavailable",
    stale: continuation && prefix >= 5 ? "retained" : "absent",
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
    notifications: [] as Checkpoint[],
    engine: 0,
  };
  let saved = checkpoint;
  const input = {
    checkpoint,
    signal: controller.signal,
    canIssueEffect: (): unknown => true,
    canRecordCheckpoint: (): unknown => true,
    onCheckpoint: (next: Checkpoint): unknown => {
      assert.ok(transition(saved, next));
      calls.notifications.push(next);
      saved = next;
      return true;
    },
  };
  const technical: Parameters<typeof run>[1] = {
    observe: async (value, phase) => {
      calls.observe++;
      if (phase === "failed_launch") {
        const bound = decode({
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
      const id = {
        dev: "1",
        ino: String(names.indexOf(action) + 1),
        birthtimeNs: "3",
      };
      const observation = purpose
        ? decode({
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
      assert.ok(decode(value));
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

/**
 * 通常五処置と既知失敗後四処置を同じMachineで完結する。
 * @responsibility 九slotと最終cleanup未確定を共同確認する。
 * @trace ERB-IT-014
 * @precondition 模擬前提は常にproceed、発行結果は確認済み。
 * @stimulus 通常起動成功と初回既知未起動を実行する。
 * @observation 発行順、二段保存と凍結結果。
 * @oracle 通常5／継続9、全slot終端、cleanup pendingのまま。
 * @cleanup N/A: 模擬境界だけ。
 * @boundary 実Writer／Native取得・回収は別試験。
 */
test("修復Machine: 通常五処置と限定継続四処置", async () => {
  for (const continuation of [false, true]) {
    const f = fixture(0, continuation);
    const observed = await run(f.input, f.technical);
    assert.equal(observed.status, "recovered");
    assert.equal(observed.primaryFailure, null);
    assert.equal(observed.checkpointConfirmed, true);
    assert.deepEqual(f.calls.execute, continuation ? names : names.slice(0, 5));
    assert.ok(dockerRuntimeRepairCheckpointIsSettled(observed.checkpoint));
    assert.equal(observed.checkpoint?.cleanup, "pending");
    assert.ok(Object.isFrozen(observed.checkpoint));
    for (const name of f.calls.execute as (typeof names)[number][]) {
      assert.deepEqual(
        f.calls.notifications
          .filter((value) => value.actions[name].intent === "saved")
          .slice(0, 3)
          .map((value) => value.actions[name]),
        [
          { intent: "saved", request: "not_issued", result: "unobserved" },
          { intent: "saved", request: "issued", result: "unobserved" },
          { intent: "saved", request: "issued", result: "confirmed" },
        ],
      );
    }
  }
});

/**
 * 九処置それぞれの三保存境界と取消を反証する。
 * @responsibility 拒否後の通知・発行、fresh再発行と事実喪失を検出する。
 * @trace ERB-IT-014
 * @precondition 前処置が終端した正規checkpoint。
 * @stimulus 意図／発行／結果の保存拒否、意図後／発行後取消を与える。
 * @observation 当該発行counter、通知回数、返却と元耐久値間の合法遷移。
 * @oracle 拒否後の追加要求0、発行後は未発行・不要へ戻さない。
 * @cleanup N/A: AbortControllerとメモリ値だけ。
 * @boundary 本番Machineと模擬保存通知。
 */
test("修復Machine: 九slotの保存拒否・取消とfresh切断窓", async () => {
  for (const [index, name] of names.entries()) {
    for (const stage of [
      "intent",
      "issued",
      "result",
      "intent_throw",
      "issued_throw",
      "result_throw",
      "intent_cancel",
      "intent_boundary",
      "effect_cancel",
    ] as const) {
      const f = fixture(index, index >= 5);
      const record = f.input.onCheckpoint;
      let rejectedAt = -1;
      let notifications = 0;
      let permitted = true;
      const injections: { action: string; stage: string }[] = [];
      f.input.canIssueEffect = () => permitted;
      f.input.onCheckpoint = (next) => {
        notifications++;
        const action = next.actions[name];
        const here =
          action.intent === "saved" &&
          (stage.startsWith("intent") &&
          stage !== "intent_cancel" &&
          stage !== "intent_boundary"
            ? action.request === "not_issued"
            : stage.startsWith("issued")
              ? action.request === "issued" && action.result === "unobserved"
              : stage.startsWith("result")
                ? action.result === "confirmed"
                : false);
        if (here) {
          rejectedAt = notifications;
          injections.push({
            action: name,
            stage: stage.replace(/_throw$/u, ""),
          });
          if (stage.endsWith("_throw")) throw new Error("checkpoint failure");
          return false;
        }
        const accepted = record(next);
        if (
          stage === "intent_cancel" &&
          action.intent === "saved" &&
          action.request === "not_issued"
        ) {
          injections.push({ action: name, stage });
          f.controller.abort();
        }
        if (
          stage === "intent_boundary" &&
          action.intent === "saved" &&
          action.request === "not_issued"
        ) {
          injections.push({ action: name, stage });
          permitted = false;
        }
        return accepted;
      };
      const execute = f.technical.execute;
      const technical = {
        ...f.technical,
        execute: async (...args: Parameters<typeof execute>) => {
          const value = await execute(...args);
          if (stage === "effect_cancel") {
            injections.push({ action: args[0], stage });
            f.controller.abort();
          }
          return value;
        },
      };
      const observed = await run(f.input, technical);
      assert.equal(f.calls.observe, index < 5 ? 1 : 2);
      assert.ok(f.calls.precondition.every((action) => action === name));
      assert.equal(
        f.calls.precondition.length,
        stage.startsWith("intent") ? 1 : 2,
      );
      assert.equal(f.calls.engine, index < 5 ? 0 : 1);
      assert.equal(
        f.calls.execute.length,
        stage.startsWith("intent") ? 0 : 1,
        `${name}:${stage}`,
      );
      if (
        stage === "intent_cancel" ||
        stage === "intent_boundary" ||
        stage === "effect_cancel"
      ) {
        assert.deepEqual(injections, [{ action: name, stage }]);
        assert.equal(
          observed.status,
          stage === "intent_boundary" ? "incomplete" : "cancelled",
        );
        assert.equal(
          observed.reason,
          stage === "intent_boundary"
            ? "runtime_repair_boundary_unavailable"
            : "runtime_repair_cancelled",
        );
      } else {
        assertCheckpointFaultReached(
          rejectedAt,
          injections,
          name,
          stage.replace(/_throw$/u, ""),
        );
        assert.equal(notifications, rejectedAt);
        assert.equal(observed.reason, "runtime_repair_state_unavailable");
        assert.equal(observed.checkpointConfirmed, false);
        assert.ok(transition(f.saved(), observed.checkpoint));
      }
      if (stage === "effect_cancel") {
        assert.equal(observed.status, "cancelled");
        assert.equal(observed.checkpoint?.actions[name].request, "issued");
        assert.equal(observed.checkpoint?.actions[name].result, "confirmed");
      }
    }
    for (const slot of [
      { intent: "saved", request: "not_issued", result: "unobserved" },
      { intent: "saved", request: "issued", result: "unobserved" },
      { intent: "saved", request: "issued", result: "unknown" },
      { intent: "saved", request: "unknown", result: "unknown" },
    ]) {
      const f = fixture(index, index >= 5);
      const checkpoint = decode({
        ...f.input.checkpoint,
        actions: { ...f.input.checkpoint.actions, [name]: slot },
      });
      assert.ok(checkpoint);
      const observed = await run({ ...f.input, checkpoint }, f.technical);
      assert.equal(observed.reason, "runtime_repair_effect_unknown");
      assert.equal(f.calls.observe, 0);
      assert.equal(f.calls.precondition.length, 0);
      assert.equal(f.calls.execute.length, 0);
      assert.equal(f.calls.notifications.length, 0);
      assert.equal(f.calls.engine, 0);
    }
  }
});

/**
 * 九処置の明示不要、未発行失敗、発行不明と例外を分ける。
 * @responsibility 発行拒否を不要へ変換せず、不明結果後の追加発行を止める。
 * @trace ERB-IT-014
 * @precondition 各slot前まで終端した合成状態。
 * @stimulus 前提不要／不明、実発行なし／不明／例外、発行後保存Owner喪失。
 * @observation 目的slot、発行回数、通知回数、停止理由。
 * @oracle 明示不要だけnot_required、失敗や不明は成功へ昇格しない。
 * @cleanup N/A: 実資源なし。
 * @boundary Machineと合成技術結果。
 */
test("修復Machine: 九slotの不要と未発行失敗・不明を分離する", async () => {
  for (const [index, name] of names.entries()) {
    for (const mode of [
      "not_required",
      "precondition_unknown",
      "not_issued",
      "unknown",
      "issued_unknown",
      "throw",
      "record_lost",
    ] as const) {
      const f = fixture(index, index >= 5);
      const execute = f.technical.execute;
      let attempts = 0;
      let permitRecord = true;
      let notifications = 0;
      const record = f.input.onCheckpoint;
      f.input.onCheckpoint = (value) => {
        notifications++;
        return record(value);
      };
      f.input.canRecordCheckpoint = () => permitRecord;
      const observed = await run(f.input, {
        ...f.technical,
        precondition: async (action) =>
          action !== name
            ? "unknown"
            : mode === "not_required"
              ? "not_required"
              : mode === "precondition_unknown"
                ? "unknown"
                : "proceed",
        execute: async (action, value) => {
          attempts++;
          if (mode === "throw") throw new Error("effect failure");
          if (mode === "record_lost") {
            const effect = await execute(action, value);
            permitRecord = false;
            return effect;
          }
          return {
            issued:
              mode === "not_issued" ? false : mode === "unknown" ? null : true,
            confirmation: mode === "not_issued" ? "not_issued" : "unknown",
            observation: value,
          };
        },
      });
      assert.equal(
        attempts,
        mode === "not_required" || mode === "precondition_unknown" ? 0 : 1,
        `${name}:${mode}`,
      );
      const slot = observed.checkpoint?.actions[name];
      assert.ok(slot);
      assert.equal(slot.result === "not_required", mode === "not_required");
      if (mode === "not_issued") {
        assert.equal(slot.request, "not_issued");
        assert.equal(slot.result, "unobserved");
      }
      if (mode === "unknown" || mode === "issued_unknown" || mode === "throw") {
        assert.equal(slot.result, "unknown");
        assert.equal(observed.primaryFailure, "runtime_repair_effect_unknown");
      }
      if (mode === "record_lost") {
        assert.equal(slot.request, "unknown");
        assert.equal(notifications, index < 5 ? 2 : 4);
        assert.equal(observed.checkpointConfirmed, false);
      }
      if (mode !== "not_required")
        assert.notEqual(observed.status, "recovered");
    }
  }
});

/**
 * 初回起動後のEngine五分類と通知戻り値の境界を確認する。
 * @responsibility 生Engine分類・期限だけで追加四処置を発火しない。
 * @trace ERB-IT-014
 * @precondition 初回五処置は確認済み。
 * @stimulus Engine分類と同期通知の偽値・非同期・例外を与える。
 * @observation 追加発行counter、一次失敗、getter実行0。
 * @oracle 明示readyだけ通常終端へ進み、継続条件なしの分類だけでは以降0。
 * @cleanup N/A: 模擬境界、拒否Promiseは本体が消費する。
 * @boundary 技術分類と用途固定通知。
 */
test("修復Machine: Engine五分類と不正通知", async () => {
  for (const state of [
    "ready",
    "known_unavailable",
    "transient_unavailable",
    "startup_timeout",
    "unknown",
  ] as const) {
    const f = fixture(5);
    const observed = await run(f.input, {
      ...f.technical,
      awaitEngine: async () => ({ state, continuation: null }),
    });
    assert.equal(f.calls.execute.length, 0);
    assert.equal(observed.engineObservation, state);
    assert.equal(
      observed.status,
      state === "ready" ? "recovered" : "incomplete",
    );
    assert.equal(observed.primaryFailure, null);
  }
  let traps = 0;
  // biome-ignore lint/suspicious/noThenProperty: 不正通知のthen getterを実行しない反証。
  const thenable = Object.defineProperty({}, "then", {
    get() {
      traps++;
      throw new Error("getter");
    },
  });
  for (const onCheckpoint of [
    () => false,
    () => {
      throw new Error("failure");
    },
    () => Promise.reject(new Error("rejected")),
    async () => true,
    () => thenable,
    new Proxy(() => true, {
      apply() {
        traps++;
        return true;
      },
    }),
  ]) {
    const f = fixture();
    const observed = await run({ ...f.input, onCheckpoint }, f.technical);
    assert.equal(observed.reason, "runtime_repair_state_unavailable");
    assert.equal(f.calls.execute.length, 0);
  }
  assert.equal(traps, 0);
});

/**
 * 起動待ちの元分類と限定継続のfresh判定を分離する。
 * @responsibility 期限だけの継続・別段階の判定再利用を拒否する。
 * @trace ERB-IT-014
 * @precondition 初回起動と元世代退避は確認済みの模擬checkpoint。
 * @stimulus 五分類、継続の生Engine二分類、先行処置不足と再起動後の不正継続値。
 * @observation stage、checkpoint、追加処置数、保存Engine分類。
 * @oracle 初回timeout＋完全判定だけ追加四処置、transientをknownへ変換しない。
 * @cleanup N/A: 合成技術境界だけ。
 * @boundary Machine→段階付きEngine待機Adapter。実fresh条件は後続Adapter試験。
 */
test("修復Machine: 待機段階と非永続の限定継続判定を分離する", async () => {
  for (const state of [
    "ready",
    "known_unavailable",
    "transient_unavailable",
    "startup_timeout",
    "unknown",
  ] as const) {
    for (const engine of [
      "known_unavailable",
      "transient_unavailable",
    ] as const) {
      const f = fixture(5, true);
      const stages: string[] = [];
      const result = await run(f.input, {
        ...f.technical,
        awaitEngine: async (stage, checkpoint) => {
          stages.push(stage);
          assert.ok(decode(checkpoint));
          if (stage === "after_initial_start") {
            assert.equal(checkpoint.actions.start_runtime.result, "confirmed");
            return { state, continuation: { engine } };
          }
          assert.equal(checkpoint.actions.restart_runtime.result, "confirmed");
          return { state: "ready", continuation: null };
        },
      });
      assert.equal(f.calls.execute.length, state === "startup_timeout" ? 4 : 0);
      assert.deepEqual(
        stages,
        state === "startup_timeout"
          ? ["after_initial_start", "after_continuation_restart"]
          : ["after_initial_start"],
      );
      if (state === "startup_timeout") {
        assert.equal(result.status, "recovered");
        const entered = f.calls.notifications.find(
          (value) => value.actions.stop_failed_runtime.intent === "saved",
        );
        assert.equal(entered?.engine, "unknown");
      } else assert.equal(result.status, "incomplete");
    }
  }
  for (const missing of ["start_runtime", "retain_runtime"] as const) {
    const f = fixture(5, true);
    const checkpoint = decode({
      ...f.input.checkpoint,
      actions: {
        ...f.input.checkpoint.actions,
        [missing]: {
          intent: "not_saved",
          request: "not_issued",
          result: "not_required",
        },
      },
    });
    assert.ok(checkpoint);
    const result = await run(
      { ...f.input, checkpoint },
      {
        ...f.technical,
        awaitEngine: async () => ({
          state: "startup_timeout",
          continuation: { engine: "transient_unavailable" },
        }),
      },
    );
    assert.equal(result.status, "incomplete");
    assert.equal(f.calls.execute.length, 0);
  }
  const f = fixture(5, true);
  const result = await run(f.input, {
    ...f.technical,
    awaitEngine: async (stage) =>
      stage === "after_initial_start"
        ? {
            state: "startup_timeout",
            continuation: { engine: "transient_unavailable" },
          }
        : { state: "ready", continuation: { engine: "known_unavailable" } },
  });
  assert.equal(f.calls.execute.length, 4);
  assert.equal(result.status, "incomplete");
  assert.equal(result.engineObservation, "unknown");
});

/**
 * 両世代の保存確定が停止意図と発行に先行することを確認する。
 * @responsibility 観測または保存省略の変異を同じOracleで拒否する。
 * @trace ERB-IT-014
 * @input runner: 実Machineまたはメモリ変異。
 * @returns N/A: assertion。
 * @precondition 模擬技術境界と実codecを使用する。
 * @postcondition 両世代保存、停止意図、発行の順序が成立する。
 * @effect 模擬処置と保存通知のみ。
 * @failure 順序・Identity・最終結果差は失敗。
 * @invariant 初回timeoutはknownへ変換しない。
 * @boundary failed_launch観測と保存Owner。
 * @security 実Docker・Native操作0。
 * @concurrency 一つの模擬実行へ閉じる。
 * @stimulus failedGenerationを持つfixtureで処置前checkpoint通知を捕捉する。
 * @observation stop intentより前に保存したfailed/auxiliaryのbinding列。
 * @oracle 退避実体の対応を保存しないまま停止処置へ進まない。
 * @cleanup 有限通知とfixtureを破棄し実Directoryは変更しない。
 */
async function assertFailedGenerationSaved(runner: typeof run) {
  const f = fixture(5, true);
  const order: string[] = [];
  const record = f.input.onCheckpoint;
  f.input.onCheckpoint = (checkpoint) => {
    const result = record(checkpoint);
    if (checkpoint.directories.failed.expected !== null) {
      assert.notEqual(checkpoint.directories.auxiliary.expected, null);
      if (checkpoint.actions.stop_failed_runtime.intent === "not_saved") {
        assert.equal(checkpoint.engine, "unknown");
        order.push("bound");
      } else if (
        checkpoint.actions.stop_failed_runtime.request === "not_issued"
      )
        order.push("intent");
    }
    return result;
  };
  const result = await runner(f.input, {
    ...f.technical,
    execute: async (action, checkpoint) => {
      if (action === "stop_failed_runtime") {
        order.push("effect");
        assert.deepEqual(f.saved().directories.failed.expected, {
          dev: "1",
          ino: "7",
          birthtimeNs: "3",
        });
        assert.deepEqual(f.saved().directories.auxiliary.expected, {
          dev: "1",
          ino: "8",
          birthtimeNs: "3",
        });
      }
      return f.technical.execute(action, checkpoint);
    },
  });
  assert.equal(result.status, "recovered");
  assert.deepEqual(order.slice(0, 3), ["bound", "intent", "effect"]);
}

/**
 * 起動失敗後の両世代を処置前に一度固定する。
 * @responsibility 欠測・すり替え・拒否・取消・freshからの誤発行を防ぐ。
 * @trace ERB-IT-014
 * @precondition 模擬Adapterと実Machineを結合する。
 * @stimulus 両世代観測と各失敗窓、観測／保存省略変異。
 * @observation 通知順、Identity、停止意図、追加発行回数。
 * @oracle 正常だけ保存→意図→発行、他は追加Effect0。
 * @cleanup N/A: メモリ試験のみ。
 * @boundary 実Adapterのfresh照合・部分再開は未成立。
 */
test("修復Machine: failed-launchの両世代を保存してから追加処置へ進む", async () => {
  await assertFailedGenerationSaved(run);
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/docker-desktop/repair.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace("export async function", "async function");
  for (const [before, after] of [
    ['await observe("failed_launch")', "true"],
    [
      "return publish(observed);",
      'return phase === "failed_launch" ? true : publish(observed);',
    ],
  ] as const) {
    assert.equal(source.split(before).length, 2);
    const mutant = runInThisContext(
      `(function(decode, transition, types){${source.replace(before, after)}; return runDockerRuntimeRepairMachine;})`,
    )(decode, transition, types) as typeof run;
    await assert.rejects(() => assertFailedGenerationSaved(mutant));
  }
  for (const mode of [
    "missing_failed",
    "missing_auxiliary",
    "alias",
    "primary_changed",
    "engine_changed",
    "current_binding",
    "save_rejected",
    "save_cancel",
    "save_owner_lost",
    "observe_cancel",
    "observe_owner_lost",
  ]) {
    const f = fixture(5, true);
    let phaseCalls = 0,
      issue = true;
    f.input.canIssueEffect = () => issue;
    const record = f.input.onCheckpoint;
    f.input.onCheckpoint = (checkpoint) => {
      if (checkpoint.directories.failed.expected !== null) {
        if (mode === "save_rejected") return false;
        if (mode === "save_cancel") f.controller.abort();
        if (mode === "save_owner_lost") issue = false;
      }
      return record(checkpoint);
    };
    const result = await run(f.input, {
      ...f.technical,
      observe: async (checkpoint, phase) => {
        const value = await f.technical.observe(
          checkpoint,
          mode === "current_binding" ? "failed_launch" : phase,
        );
        if (phase !== "failed_launch") return value;
        phaseCalls++;
        if (mode === "observe_cancel") f.controller.abort();
        if (mode === "observe_owner_lost") issue = false;
        const directories = { ...value.directories };
        if (mode === "missing_failed")
          directories.failed = checkpoint.directories.failed;
        if (mode === "missing_auxiliary")
          directories.auxiliary = checkpoint.directories.auxiliary;
        if (mode === "alias") directories.auxiliary = directories.failed;
        if (mode === "primary_changed")
          directories.primary = directories.failed;
        return {
          ...value,
          directories,
          engine: mode === "engine_changed" ? "unavailable" : value.engine,
        };
      },
    });
    assert.equal(phaseCalls, mode === "current_binding" ? 0 : 1, mode);
    assert.equal(f.calls.execute.length, 0, mode);
    assert.equal(
      result.checkpoint?.actions.stop_failed_runtime.intent,
      "not_saved",
      mode,
    );
    assert.notEqual(result.status, "recovered", mode);
    if (mode === "save_cancel" || mode === "save_owner_lost") {
      const checkpoint = result.checkpoint;
      assert.ok(checkpoint);
      const next = fixture(5, true);
      const resumed = await run({ ...next.input, checkpoint }, next.technical);
      assert.equal(resumed.reason, "runtime_repair_recovered");
      assert.equal(next.calls.observe, 2);
      assert.deepEqual(next.calls.execute, names.slice(5));
      assert.equal(next.calls.engine, 1);
    }
  }
});

/**
 * Engineの初期値と継続四処置の分岐を別々に反証する。
 * @responsibility readyを通常五処置の前提代用や追加処置許可にしない。
 * @trace ERB-IT-014
 * @precondition 技術preconditionを固定し、初期Engine／Host安全性だけ変更する。
 * @stimulus 初期ready・unknownと、初回起動後readyかつHost安全性unknownを与える。
 * @observation 通常五処置の前提回数、継続発行、最終状態。
 * @oracle 通常処置はfresh前提を使い、ready後は追加四処置0。
 * @cleanup N/A: 合成境界だけ。
 * @boundary Engine観測と処置選択。
 */
test("修復Machine: 初期Engineと追加四処置の分岐を混同しない", async () => {
  const ready = fixture();
  const readyCheckpoint = decode({
    ...ready.input.checkpoint,
    engine: "ready",
  });
  assert.ok(readyCheckpoint);
  const completed = await run(
    { ...ready.input, checkpoint: readyCheckpoint },
    ready.technical,
  );
  assert.equal(completed.status, "recovered");
  assert.deepEqual(ready.calls.execute, names.slice(0, 5));
  assert.deepEqual(
    ready.calls.precondition,
    names.slice(0, 5).flatMap((name) => [name, name]),
  );

  const unknown = fixture();
  const unknownCheckpoint = decode({
    ...unknown.input.checkpoint,
    engine: "unknown",
  });
  assert.ok(unknownCheckpoint);
  const refused = await run(
    { ...unknown.input, checkpoint: unknownCheckpoint },
    {
      ...unknown.technical,
      precondition: async () => "unknown",
    },
  );
  assert.equal(refused.status, "incomplete");
  assert.equal(refused.primaryFailure, null);
  assert.equal(unknown.calls.execute.length, 0);

  const host = fixture(5);
  const hostCheckpoint = decode({
    ...host.input.checkpoint,
    hostSafety: "unknown",
  });
  assert.ok(hostCheckpoint);
  const remaining = await run(
    { ...host.input, checkpoint: hostCheckpoint },
    host.technical,
  );
  assert.equal(remaining.status, "incomplete");
  assert.equal(host.calls.execute.length, 0);
  assert.equal(host.calls.precondition.length, 0);
  for (const name of names.slice(5))
    assert.equal(remaining.checkpoint?.actions[name].result, "unobserved");
});

/**
 * 発行後の不正観測を耐久元版由来のunknownとして一度通知する。
 * @responsibility 不正な結果を破棄するだけで発行事実を失わない。
 * @trace ERB-IT-014
 * @precondition 各九slotの前処置が終端した正規状態。
 * @stimulus decode不正、action／cleanup変更、実体遷移違反、例外とOwner喪失を与える。
 * @observation unknown通知回数、耐久元版、返却と保存確認。
 * @oracle Owner生存は通知1、喪失は0、返却は常に合法unknownと一次失敗。
 * @cleanup N/A: メモリ内だけ。
 * @boundary 合成発行結果と保存通知。
 */
test("修復Machine: 不正Effect観測でもunknownを保存する", async () => {
  for (const [index, name] of names.entries()) {
    for (const fault of [
      "decode",
      "action",
      "cleanup",
      "transition",
      "throw",
    ] as const) {
      for (const ownerAlive of [false, true]) {
        const f = fixture(index, index >= 5);
        const expected = { dev: "1", ino: "999", birthtimeNs: "3" };
        const checkpoint = decode({
          ...f.input.checkpoint,
          directories: {
            ...f.input.checkpoint.directories,
            primary: {
              expected,
              source:
                index >= 5
                  ? { state: "absent", identity: null }
                  : { state: "present", identity: expected },
              retained:
                index >= 5
                  ? { state: "present", identity: expected }
                  : { state: "absent", identity: null },
            },
          },
        });
        assert.ok(checkpoint);
        let durable = checkpoint;
        let beforeEffect = checkpoint;
        let effectStarted = false;
        let effects = 0;
        let unknownNotifications = 0;
        const observed = await run(
          {
            ...f.input,
            checkpoint,
            canRecordCheckpoint: () => !effectStarted || ownerAlive,
            onCheckpoint: (next) => {
              assert.ok(transition(durable, next));
              if (next.actions[name].result === "unknown")
                unknownNotifications++;
              durable = next;
              return true;
            },
          },
          {
            ...f.technical,
            execute: async (_action, value) => {
              effects++;
              beforeEffect = durable;
              effectStarted = true;
              if (fault === "throw") throw new Error("effect result lost");
              const replacement = { ...expected, ino: "1000" };
              const observation =
                fault === "decode"
                  ? { ...value, extra: true }
                  : fault === "action"
                    ? {
                        ...value,
                        actions: {
                          ...value.actions,
                          [name]: {
                            ...value.actions[name],
                            result: "not_required",
                          },
                        },
                      }
                    : fault === "cleanup"
                      ? { ...value, cleanup: "confirmed" }
                      : {
                          ...value,
                          directories: {
                            ...value.directories,
                            primary: {
                              expected: replacement,
                              source:
                                index >= 5
                                  ? { state: "absent", identity: null }
                                  : { state: "present", identity: replacement },
                              retained:
                                index >= 5
                                  ? { state: "present", identity: replacement }
                                  : { state: "absent", identity: null },
                            },
                          },
                        };
              if (fault !== "decode") assert.ok(decode(observation));
              return {
                issued: true,
                confirmation: "confirmed",
                observation: observation as Checkpoint,
              };
            },
          },
        );
        assert.equal(effects, 1);
        assert.equal(f.calls.observe, index < 5 ? 1 : 2);
        assert.equal(
          unknownNotifications,
          ownerAlive ? 1 : 0,
          `${name}:${fault}:${ownerAlive}`,
        );
        assert.equal(observed.status, "failed");
        assert.equal(observed.primaryFailure, "runtime_repair_effect_unknown");
        assert.equal(observed.checkpointConfirmed, ownerAlive);
        assert.equal(observed.checkpoint?.actions[name].request, "unknown");
        assert.equal(observed.checkpoint?.actions[name].result, "unknown");
        assert.ok(transition(beforeEffect, observed.checkpoint));
        assert.equal(durable === beforeEffect, !ownerAlive);
        assert.equal(f.calls.engine, index < 5 ? 0 : 1);
        assert.equal(f.calls.precondition.length, 2);
      }
    }
  }
});

/**
 * issued通知を消した実本文のメモリ変異を到達Oracleで拒否する。
 * @responsibility 注入未到達でも試験が成功する問題を反証する。
 * @trace ERB-IT-014
 * @precondition 本番Sourceを読取り、型とimportだけを評価用に除く。
 * @stimulus issued通知の一箇所だけを実行しない変異を同じCaseへ渡す。
 * @observation 元版の注入到達と変異版の必須Oracle拒否。
 * @oracle 同じassertCheckpointFaultReachedが元版を受理し変異版を拒否する。
 * @cleanup N/A: Source・Filesystemを書換えずメモリ評価だけ。
 * @boundary 本番順序の負対照。実Native／Writerではない。
 */
test("修復Machine: issued通知省略は故障注入の必須到達Oracleが拒否する", async () => {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/docker-desktop/repair.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace("export async function", "async function");
  const mutant = source.replace("if (!publish(issuedCandidate))", "if (false)");
  assert.notEqual(mutant, source);
  for (const [index, name] of names.entries()) {
    for (const text of [source, mutant]) {
      const runner = runInThisContext(
        `(function(decode, transition, types){${text}; return runDockerRuntimeRepairMachine;})`,
      )(decode, transition, types) as typeof run;
      const f = fixture(index, index >= 5);
      const injections: { action: string; stage: string }[] = [];
      let notifications = 0;
      let rejectedAt = -1;
      f.input.onCheckpoint = (next) => {
        notifications++;
        if (
          next.actions[name].request === "issued" &&
          next.actions[name].result === "unobserved"
        ) {
          rejectedAt = notifications;
          injections.push({ action: name, stage: "issued" });
          return false;
        }
        return true;
      };
      await runner(f.input, f.technical);
      if (text === source)
        assertCheckpointFaultReached(rejectedAt, injections, name, "issued");
      else
        assert.throws(
          () =>
            assertCheckpointFaultReached(
              rejectedAt,
              injections,
              name,
              "issued",
            ),
          /checkpoint_fault_not_reached/u,
        );
    }
  }
});

/**
 * 値として合法でも再入場契約外の保存形を拒否する。
 * @responsibility paired実体と確定prefixの新入口を直接反証する。
 * @trace ERB-IT-014
 * @precondition 実Machineの世代固定通知から正規切断点を捕捉する。
 * @stimulus 片側固定・三ID alias・先行不足・追加gap・実体欠測。
 * @observation 実decoder成功、全技術counter、通知と入力全文。
 * @oracle 実処理は全counter0、guard無効化変異は同じ観測開始0断言で失敗。
 * @cleanup Source不変更、メモリ評価だけ。
 * @boundary 値のSchema適合と実行再入場契約を区別する。
 */
test("修復Machine: 不正fresh部分継続は観測開始前に拒否する", async () => {
  const seed = fixture(5, true);
  const captured: Checkpoint[] = [];
  seed.input.onCheckpoint = (value) => {
    if (value.directories.failed.expected !== null) {
      captured.push(value);
      return false;
    }
    return true;
  };
  await run(seed.input, seed.technical);
  assert.equal(captured.length, 1);
  const base = captured[0];
  assert.ok(base);
  const primaryId = base.directories.primary.expected;
  assert.ok(primaryId);
  const absent = { state: "absent", identity: null };
  const untouched = {
    intent: "not_saved",
    request: "not_issued",
    result: "unobserved",
  };
  const notRequired = { ...untouched, result: "not_required" };
  const candidates = [
    {
      ...base,
      directories: {
        ...base.directories,
        auxiliary: { expected: null, source: absent, retained: absent },
      },
    },
    {
      ...base,
      directories: {
        ...base.directories,
        ...Object.fromEntries(
          ["failed", "auxiliary"].map((key) => [
            key,
            {
              expected: primaryId,
              source: { state: "present", identity: primaryId },
              retained: absent,
            },
          ]),
        ),
      },
    },
    { ...base, actions: { ...base.actions, start_runtime: untouched } },
    { ...base, actions: { ...base.actions, start_runtime: notRequired } },
    {
      ...base,
      actions: { ...base.actions, retain_auxiliary_runtime: notRequired },
    },
    {
      ...base,
      directories: {
        ...base.directories,
        failed: { ...base.directories.failed, source: absent },
      },
    },
  ];
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/docker-desktop/repair.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace("export async function", "async function");
  const guard = "resumingContinuation && !canResumeRepairContinuation(current)";
  assert.equal(source.split(guard).length, 2);
  const mutant = runInThisContext(
    `(function(decode, transition, types){${source.replace(guard, "false")}; return runDockerRuntimeRepairMachine;})`,
  )(decode, transition, types) as typeof run;
  for (const [index, candidate] of candidates.entries()) {
    const checkpoint = decode(candidate);
    assert.ok(checkpoint, `candidate_decode:${index}`);
    /**
     * 不正candidate checkpointが初回の技術観測へ進まないことを確認する。
     * @responsibility 不正candidate checkpointが初回の技術観測へ進まないことを確認する。
     * @trace ERB-IT-014
     * @precondition 正常対照から作った不正checkpointとrunner。
     * @stimulus 同じinputへ候補を渡す。
     * @observation 観測・通知・許可・execute・engineの到達数とJSON本文。
     * @oracle 拒否後すべて未到達で元checkpointも不変。
     * @cleanup N/A: fixture内の計数と値だけ。
     * @boundary 修復Machineへの入力境界で実修復を起動しない。
     */
    const verify = async (runner: typeof run) => {
      const f = fixture(5, true);
      const before = JSON.stringify(checkpoint);
      const result = await runner({ ...f.input, checkpoint }, f.technical);
      assert.equal(f.calls.observe, 0, `fresh_observation_started:${index}`);
      assert.deepEqual(f.calls.notifications, []);
      assert.deepEqual(f.calls.precondition, []);
      assert.deepEqual(f.calls.execute, []);
      assert.equal(f.calls.engine, 0);
      assert.notEqual(result.status, "recovered");
      assert.equal(JSON.stringify(checkpoint), before);
    };
    await verify(run);
    await assert.rejects(() => verify(mutant), /fresh_observation_started/u);
  }
});

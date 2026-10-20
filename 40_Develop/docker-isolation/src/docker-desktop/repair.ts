/**
 * 固定九処置の修復順序と保存通知を所有する。
 * @packageDocumentation
 * @responsibility 技術処置と保存意図を結合し、保存失敗・取消後の追加発行を止める。
 * @trace ARCH-000008
 * @boundary Package内部。Native取得・回収、上位状態・Path・保存実装は所有しない。
 */
import { types } from "node:util";
import {
  decodeDockerRuntimeRepairCheckpoint as decode,
  validateDockerRuntimeRepairCheckpointTransition as transition,
  type DockerRuntimeRepairCheckpoint as Checkpoint,
} from "./repair-state.ts";
import type { DockerRepairEngineState } from "./engine.ts";

const actions = [
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
 * 内部Machineの固定入力。
 * @responsibility 新処置許可と発生事実の保存Owner生存を分離する。
 * @trace ARCH-000008
 * @shape checkpoint、取消、二種類の同期確認、同期保存通知。
 * @invariant 保存済み意図をfreshでの再発行許可にしない。
 * @boundary 内部runtimeとMachine。
 * @security Native Session・任意Path・保存実装を含めない。
 * @compatibility Root非公開。
 */
type MachineInput = Readonly<{
  checkpoint: Checkpoint;
  signal: AbortSignal;
  canIssueEffect: () => unknown;
  canRecordCheckpoint: () => unknown;
  onCheckpoint: (checkpoint: Checkpoint) => unknown;
}>;

/**
 * 固定修復Adapterの技術観測と処置。
 * @responsibility 既存技術操作だけを内部試験で差替え可能にする。
 * @trace ARCH-000008
 * @shape fresh観測、九処置の前提・発行結果、Engine待機。
 * @invariant preconditionだけが明示不要を返し、発行失敗を不要にしない。
 * @boundary DI内部のMachineと用途固定Adapter。
 * @security 公開入力として任意の実行処理を受け付けない。
 * @compatibility Native lifecycleは外側runtimeが所有。
 */
type TechnicalBoundary = Readonly<{
  observe: (
    checkpoint: Checkpoint,
    phase: "current" | "failed_launch",
  ) => Promise<Checkpoint>;
  precondition: (
    action: (typeof actions)[number],
    checkpoint: Checkpoint,
  ) => Promise<"proceed" | "not_required" | "unknown">;
  execute: (
    action: (typeof actions)[number],
    checkpoint: Checkpoint,
  ) => Promise<
    Readonly<{
      issued: boolean | null;
      confirmation: "confirmed" | "not_issued" | "unknown";
      observation: Checkpoint;
    }>
  >;
  awaitEngine: (
    stage: "after_initial_start" | "after_continuation_restart",
    checkpoint: Checkpoint,
  ) => Promise<
    Readonly<{
      state: DockerRepairEngineState;
      continuation: Readonly<{
        engine: "known_unavailable" | "transient_unavailable";
      }> | null;
    }>
  >;
}>;

/**
 * 技術順序の終了と未保存事実を返す。
 * @responsibility 未完了観測と一次終端失敗を区別する。
 * @trace ARCH-000008
 * @shape checkpoint、保存確認、状態、固定理由、一次失敗とEngine分類。
 * @invariant cleanup pendingの返却を資源回収完了にしない。
 * @boundary Machineから外側runtimeへ戻る値。
 * @security 生Session・Path・例外本文は返さない。
 * @compatibility 上位outcomeの確定ではない。
 */
type MachineResult = Readonly<{
  checkpoint: Checkpoint | null;
  checkpointConfirmed: boolean;
  status: "recovered" | "incomplete" | "failed" | "cancelled";
  reason:
    | "runtime_repair_recovered"
    | "runtime_repair_state_unavailable"
    | "runtime_repair_boundary_unavailable"
    | "runtime_repair_observation_unknown"
    | "runtime_repair_effect_unknown"
    | "runtime_repair_cancelled";
  primaryFailure: "runtime_repair_effect_unknown" | null;
  engineObservation: DockerRepairEngineState | null;
}>;

/**
 * 同期の厳密trueだけを確認として消費する。
 * @responsibility Proxy・非同期・thenable・例外を許可へ昇格しない。
 * @trace ARCH-000008
 * @input callback: 同期確認、argument: 通知時だけの技術値。
 * @returns 同期trueだけtrue。
 * @precondition callbackの用途は本Module内で固定。
 * @postcondition Promise拒否を消費し、thenable getterは実行しない。
 * @effect 同期callback一回だけ。
 * @failure 不正値・throwはfalse。
 * @invariant 拒否後の再通知を行わない。
 * @boundary 上位保存確認と下位順序。
 * @security 関数Proxyとasync関数は実行しない。
 * @concurrency awaitしない。
 */
function confirm(callback: unknown, argument?: Checkpoint): boolean {
  if (
    typeof callback !== "function" ||
    types.isProxy(callback) ||
    types.isAsyncFunction(callback)
  )
    return false;
  try {
    const value: unknown =
      argument === undefined ? callback() : callback(argument);
    if (types.isPromise(value))
      void Promise.prototype.then.call(
        value,
        () => undefined,
        () => undefined,
      );
    return value === true;
  } catch {
    return false;
  }
}

/**
 * 保存済みの限定継続形が閉集合へ属するか検査する。
 * @responsibility paired実体と確定prefix以外からの再入場を拒否する。
 * @trace ARCH-000008
 * @input checkpoint: 実codecで復号済みの現在値。
 * @returns 既知形だけtrue。処置許可ではない。
 * @precondition cleanupとunknown gateは呼出し側も確認する。
 * @postcondition 元値を変更しない。
 * @effect N/A: 値検査のみ。
 * @failure 片側固定・alias・gap・先行不足はfalse。
 * @invariant timeout markerや過去観測から現在許可を作らない。
 * @boundary 再入場値と現在技術観測の前。
 * @security fresh実体照合を代替しない。
 * @concurrency N/A: 同期処理。
 */
function canResumeRepairContinuation(checkpoint: Checkpoint): boolean {
  const { primary, failed, auxiliary } = checkpoint.directories;
  if (
    !primary.expected ||
    !failed.expected ||
    !auxiliary.expected ||
    new Set(
      [primary.expected, failed.expected, auxiliary.expected].map((id) =>
        JSON.stringify(id),
      ),
    ).size !== 3 ||
    checkpoint.hostSafety !== "safe" ||
    primary.retained.state !== "present" ||
    checkpoint.actions.retain_runtime.result !== "confirmed" ||
    checkpoint.actions.start_runtime.result !== "confirmed" ||
    !actions
      .slice(0, 5)
      .every((name) =>
        ["confirmed", "not_required"].includes(checkpoint.actions[name].result),
      )
  )
    return false;
  let suffix = false;
  for (const name of actions.slice(5)) {
    const action = checkpoint.actions[name];
    if (["confirmed", "not_required"].includes(action.result)) {
      if (suffix) return false;
    } else {
      if (
        action.intent !== "not_saved" ||
        action.request !== "not_issued" ||
        action.result !== "unobserved"
      )
        return false;
      suffix = true;
    }
  }
  for (const purpose of ["failed", "auxiliary"] as const) {
    const action =
      purpose === "failed"
        ? "retain_failed_runtime"
        : "retain_auxiliary_runtime";
    const pair = checkpoint.directories[purpose];
    if (checkpoint.actions[action].result === "confirmed") {
      if (pair.source.state !== "absent" || pair.retained.state !== "present")
        return false;
    } else if (
      pair.source.state !== "present" ||
      pair.retained.state !== "absent"
    )
      return false;
  }
  return true;
}

/**
 * 固定九処置を保存意図から結果まで直列実行する。
 * @responsibility 新規発行の許可、事実保存、未確定意図と既発行の扱いを分離する。
 * @trace ARCH-000008
 * @input input: 保存済み技術値と確認、technical: 内部用途固定Adapter。
 * @returns 凍結技術結果。cleanup確定や上位outcomeは含まない。
 * @precondition runtimeが同じNative子と対象実体へAdapterを固定済み。
 * @postcondition 通知失敗後・取消後の新技術Effectは0。
 * @effect 固定Adapterの観測と最大九処置、用途限定保存通知。
 * @failure 保存拒否・不明発行・観測不能・取消を区別する。
 * @invariant freshの保存済み意図・unknownを再発行せず、実行済みを不要へ戻さない。
 * @boundary 上位保存Ownerと下位技術順序。Native取得・joinは外側。
 * @security Rootへ公開せず、任意コマンド・Pathを受けない。
 * @concurrency 一つの呼出しだけで直列化し、返却後通知0。
 */
export async function runDockerRuntimeRepairMachine(
  input: MachineInput,
  technical: TechnicalBoundary,
): Promise<MachineResult> {
  let current = decode(input.checkpoint);
  let saved = current;
  let notificationFailed = false;
  let engineObservation: DockerRepairEngineState | null = null;
  /**
   * 新処置の現在許可を同期確認する。
   * @responsibility 取消後の新規発行を拒否する。
   * @trace ARCH-000008
   * @input N/A: 同じ呼出しの取消と許可確認を捕捉。
   * @returns 未取消かつ同期許可trueだけtrue。
   * @precondition runtimeが現在許可を固定済み。
   * @postcondition 保存Owner生存とは区別する。
   * @effect 現在許可callbackのみ。
   * @failure 失効・例外はfalse。
   * @invariant 取消から発行許可を再生しない。
   * @boundary 上位許可と技術発行。
   * @security Authorityを生成しない。
   * @concurrency 同期待機なし。
   */
  const issueAllowed = () =>
    !input.signal.aborted && confirm(input.canIssueEffect);
  /**
   * 現在の技術値と保存成否を分けて凍結する。
   * @responsibility 未保存値を耐久確定と表示しない。
   * @trace ARCH-000008
   * @input status、reason、primaryFailure: 固定終了分類。
   * @returns 不変のMachine結果。
   * @precondition 技術値は実codecで捕捉済み。
   * @postcondition 上位outcomeを確定しない。
   * @effect N/A: 値生成のみ。
   * @failure N/A: 生例外を含めない固定値。
   * @invariant cleanupを成功へ補完しない。
   * @boundary Machineと外側runtime。
   * @security Path・Sessionを公開しない。
   * @concurrency N/A: 共有状態なし。
   */
  const result = (
    status: MachineResult["status"],
    reason: MachineResult["reason"],
    primaryFailure: MachineResult["primaryFailure"] = null,
  ): MachineResult =>
    Object.freeze({
      checkpoint: current,
      checkpointConfirmed:
        current !== null && !notificationFailed && current === saved,
      status,
      reason,
      primaryFailure,
      engineObservation,
    });
  /**
   * 取消と現在許可喪失を区別して停止する。
   * @responsibility 境界拒否を発行失敗へ読み替えない。
   * @trace ARCH-000008
   * @input N/A: 捕捉した取消値。
   * @returns 現在値を保持した固定結果。
   * @precondition 新処置をまだ発行していない境界。
   * @postcondition 一次失敗を作らない。
   * @effect N/A: 値生成のみ。
   * @failure N/A: 固定分類だけ。
   * @invariant 既存事実を未発行へ戻さない。
   * @boundary 許可確認と返却。
   * @security 新Authorityなし。
   * @concurrency N/A: 同期処理。
   */
  const stopped = () =>
    result(
      input.signal.aborted ? "cancelled" : "incomplete",
      input.signal.aborted
        ? "runtime_repair_cancelled"
        : "runtime_repair_boundary_unavailable",
    );
  /**
   * 合法な技術候補を一度だけ同期通知する。
   * @responsibility 通知失敗をstickyにし後続通知を拒否する。
   * @trace ARCH-000008
   * @input candidate: 次の技術観測。
   * @returns 合法遷移・保存Owner・同期通知が全成立した場合だけtrue。
   * @precondition 同じ呼出しの保存Ownerを利用する。
   * @postcondition 確定値と未保存事実を分離する。
   * @effect 用途限定の保存通知だけ。
   * @failure 不正候補・生存不明・通知拒否はfalse。
   * @invariant 失敗した通知を再利用しない。
   * @boundary 技術checkpointと上位Writer。
   * @security 保存先・処置内容を指定しない。
   * @concurrency 同期直列で待機しない。
   */
  const publish = (candidate: unknown): boolean => {
    if (notificationFailed || !current) return false;
    const next = decode(candidate);
    if (!next || !transition(current, next)) {
      notificationFailed = true;
      return false;
    }
    current = next;
    if (
      !confirm(input.canRecordCheckpoint) ||
      !confirm(input.onCheckpoint, next)
    ) {
      notificationFailed = true;
      return false;
    }
    saved = current;
    return true;
  };
  /**
   * 一つの固定処置slotだけを更新候補へ置換する。
   * @responsibility 他slotと技術観測を保持する。
   * @trace ARCH-000008
   * @input action: 固定九用途、value: その処置の次値。
   * @returns 未検証候補またはnull。
   * @precondition 呼出し後に実codecと遷移検査へ通す。
   * @postcondition 元値を変更しない。
   * @effect N/A: 値生成のみ。
   * @failure 元状態なしはnull。
   * @invariant 保存・実処置の成立を生成しない。
   * @boundary 局所値の候補構成。
   * @security 任意用途を受け付けない。
   * @concurrency N/A: 同期処理。
   */
  const replaceAction = (
    action: (typeof actions)[number],
    value: Checkpoint["actions"][typeof action],
  ) =>
    current
      ? { ...current, actions: { ...current.actions, [action]: value } }
      : null;
  /**
   * 耐久元版から合法な不明結果を再導出する。
   * @responsibility 発行後の保存拒否を未発行へ戻さない。
   * @trace ARCH-000008
   * @input action: 発行または発行結果が不明な固定slot。
   * @returns 耐久元版から合法に遷移できるunknown候補、またはnull。
   * @precondition 同じ呼出しの意図保存を確認済み。
   * @postcondition 最後に確認した保存元版は不変更。
   * @effect N/A: メモリ内だけ。
   * @failure 不正候補はnullとして確定を主張しない。
   * @invariant 実行済みをnot_requiredにしない。
   * @boundary 未保存事実と耐久元版。
   * @security 再発行Authorityを生成しない。
   * @concurrency N/A: 同期処理。
   */
  const uncertain = (action: (typeof actions)[number]) => {
    if (!saved) return null;
    const prior = saved.actions[action];
    return decode({
      ...saved,
      actions: {
        ...saved.actions,
        [action]: {
          intent: "saved",
          request: prior.request === "issued" ? "issued" : "unknown",
          result: "unknown",
        },
      },
    });
  };
  /**
   * 技術観測だけを捕捉して保存通知へ渡す。
   * @responsibility 観測Adapterから処置slotやcleanupを書換えさせない。
   * @trace ARCH-000008
   * @input phase: 通常観測または初回起動失敗世代の固定。
   * @returns 観測・許可再確認・保存通知が成立すればtrue。
   * @precondition Native取得は外側runtimeが所有する。
   * @postcondition 許可喪失後に通知へ進まない。
   * @effect 読取り観測と用途限定通知。
   * @failure 不正値・観測不能・通知拒否はfalse。
   * @invariant 観測から発行事実を捏造しない。
   * @boundary 固定技術Adapterと保存Owner。
   * @security 任意Pathを受け取らない。
   * @concurrency await後に現在許可を再確認する。
   */
  const observe = async (
    phase: "current" | "failed_launch",
    requireReady = false,
  ): Promise<boolean> => {
    if (!current || !issueAllowed()) return false;
    const observed = decode(await technical.observe(current, phase));
    if (
      !observed ||
      JSON.stringify(observed.actions) !== JSON.stringify(current.actions) ||
      observed.cleanup !== current.cleanup ||
      observed.cleanupFailure !== current.cleanupFailure ||
      (requireReady &&
        (observed.engine !== "ready" || observed.hostSafety !== "safe")) ||
      !issueAllowed()
    )
      return false;
    if (phase === "current") {
      for (const purpose of ["failed", "auxiliary"] as const)
        if (
          JSON.stringify(observed.directories[purpose].expected) !==
          JSON.stringify(current.directories[purpose].expected)
        )
          return false;
    } else {
      const pair = [
        observed.directories.failed,
        observed.directories.auxiliary,
      ];
      if (
        current.engine !== "unknown" ||
        current.directories.failed.expected !== null ||
        current.directories.auxiliary.expected !== null ||
        pair.some(
          (directory) =>
            directory.expected === null ||
            directory.source.state !== "present" ||
            directory.retained.state !== "absent",
        ) ||
        new Set(
          [
            current.directories.primary.expected,
            ...pair.map((d) => d.expected),
          ].map((identity) => JSON.stringify(identity)),
        ).size !== 3 ||
        JSON.stringify(observed) !==
          JSON.stringify({
            ...current,
            directories: {
              ...current.directories,
              failed: observed.directories.failed,
              auxiliary: observed.directories.auxiliary,
            },
          })
      )
        return false;
    }
    return publish(observed);
  };
  /**
   * 待機後のreadyを現在実体の再観測後にだけ保存する。
   * @responsibility Engine応答だけを耐久readyへ昇格しない。
   * @trace ARCH-000008
   * @input N/A: 同じ待機結果と現在checkpoint。
   * @returns 再観測・保存が成功した場合だけtrue。
   * @precondition 呼出し側が待機後の現在許可を確認済み。
   * @postcondition 失敗時ready非保存。
   * @effect 固定current観測と既存保存通知。
   * @failure 欠測・不明・失効・拒否はfalse。
   * @invariant actions・cleanup・expectedを再bindしない。
   * @boundary Engine待機と終端観測。
   * @security 実体やProcessの事実を捏造しない。
   * @concurrency 観測await前後の許可確認はobserveが所有する。
   */
  const recordEngineObservation = async () => {
    if (engineObservation === "ready") return observe("current", true);
    return publish({
      ...current,
      engine:
        engineObservation === "known_unavailable" ? "unavailable" : "unknown",
    });
  };
  if (current?.cleanup !== "pending" || current.cleanupFailure !== null)
    return result("incomplete", "runtime_repair_state_unavailable");
  // freshでは、保存済み意図と実発行の間のcrash窓を未発行と推定しない。
  for (const action of actions) {
    const prior = current.actions[action];
    if (prior.result === "unknown" || prior.request === "unknown")
      return result(
        "failed",
        "runtime_repair_effect_unknown",
        "runtime_repair_effect_unknown",
      );
    if (prior.intent === "saved" && prior.result === "unobserved") {
      current = uncertain(action);
      return result(
        "failed",
        "runtime_repair_effect_unknown",
        "runtime_repair_effect_unknown",
      );
    }
  }
  const resumingContinuation =
    current.directories.failed.expected !== null ||
    current.directories.auxiliary.expected !== null;
  if (resumingContinuation && !canResumeRepairContinuation(current))
    return result("incomplete", "runtime_repair_state_unavailable");
  try {
    if (!issueAllowed()) return stopped();
    if (!(await observe("current")))
      return notificationFailed
        ? result("incomplete", "runtime_repair_state_unavailable")
        : stopped();
    if (
      resumingContinuation &&
      current?.engine === "ready" &&
      Object.values(current.actions)
        .slice(5)
        .some(
          (action) => !["confirmed", "not_required"].includes(action.result),
        )
    )
      return result("incomplete", "runtime_repair_observation_unknown");
    let continuationObserved = resumingContinuation;
    let continuationEngineWaited = false;
    for (const [index, action] of actions.entries()) {
      if (!current)
        return result("incomplete", "runtime_repair_state_unavailable");
      const prior = current.actions[action];
      if (prior.result === "confirmed" || prior.result === "not_required")
        continue;
      if (!issueAllowed()) return stopped();
      if (index >= 5 && !continuationObserved) {
        const waited = await technical.awaitEngine(
          "after_initial_start",
          current,
        );
        engineObservation = waited.state;
        if (!issueAllowed()) return stopped();
        if (
          waited.continuation !== null &&
          engineObservation !== "startup_timeout"
        )
          return result("incomplete", "runtime_repair_observation_unknown");
        const continuationReady =
          engineObservation === "startup_timeout" &&
          waited.continuation !== null &&
          ["known_unavailable", "transient_unavailable"].includes(
            waited.continuation.engine,
          ) &&
          current.actions.start_runtime.result === "confirmed" &&
          current.actions.retain_runtime.result === "confirmed" &&
          current.directories.primary.expected !== null &&
          current.directories.primary.retained.state === "present";
        const engine =
          engineObservation === "ready"
            ? "ready"
            : engineObservation === "known_unavailable"
              ? "unavailable"
              : "unknown";
        if (!(await recordEngineObservation()))
          return result(
            "incomplete",
            notificationFailed
              ? "runtime_repair_state_unavailable"
              : "runtime_repair_observation_unknown",
          );
        if (engine !== "ready" && !continuationReady)
          return result("incomplete", "runtime_repair_observation_unknown");
        if (continuationReady) {
          if (
            Object.values(current?.actions ?? {})
              .slice(5)
              .some((value) => value.request !== "not_issued") ||
            !(await observe("failed_launch"))
          )
            return result(
              "incomplete",
              notificationFailed
                ? "runtime_repair_state_unavailable"
                : "runtime_repair_observation_unknown",
            );
          if (!issueAllowed()) return stopped();
        }
        continuationObserved = true;
      }
      const unnecessary = index >= 5 && current.engine === "ready";
      const precondition = unnecessary
        ? "not_required"
        : await technical.precondition(action, current);
      if (!issueAllowed()) return stopped();
      if (precondition === "not_required") {
        if (
          !publish(replaceAction(action, { ...prior, result: "not_required" }))
        )
          return result("incomplete", "runtime_repair_state_unavailable");
        continue;
      }
      if (precondition !== "proceed")
        return result("incomplete", "runtime_repair_observation_unknown");
      if (
        !publish(
          replaceAction(action, {
            intent: "saved",
            request: "not_issued",
            result: "unobserved",
          }),
        )
      )
        return result("incomplete", "runtime_repair_state_unavailable");
      // 同じ呼出しの意図保存後でも、現在許可と技術前提を再確認する。
      if (!issueAllowed()) return stopped();
      const repeatedPrecondition = await technical.precondition(
        action,
        current,
      );
      if (!issueAllowed()) return stopped();
      if (repeatedPrecondition !== "proceed")
        return result("incomplete", "runtime_repair_observation_unknown");
      let effect: Awaited<ReturnType<TechnicalBoundary["execute"]>>;
      let observed: Checkpoint | null;
      try {
        effect = await technical.execute(action, current);
        observed = decode(effect.observation);
      } catch {
        const unknown = uncertain(action);
        if (unknown === null || !publish(unknown)) current = unknown;
        return result(
          "failed",
          "runtime_repair_effect_unknown",
          "runtime_repair_effect_unknown",
        );
      }
      if (
        !observed ||
        JSON.stringify(observed.actions) !== JSON.stringify(current.actions) ||
        observed.cleanup !== current.cleanup ||
        observed.cleanupFailure !== current.cleanupFailure ||
        !transition(current, observed)
      ) {
        const unknown = uncertain(action);
        if (unknown === null || !publish(unknown)) current = unknown;
        return result(
          "failed",
          "runtime_repair_effect_unknown",
          "runtime_repair_effect_unknown",
        );
      }
      if (effect.issued === false && effect.confirmation === "not_issued")
        return result("incomplete", "runtime_repair_boundary_unavailable");
      const issued = effect.issued === true;
      const issuedCandidate = {
        ...observed,
        actions: {
          ...observed.actions,
          [action]: {
            intent: "saved",
            request: issued ? "issued" : "unknown",
            result: issued ? "unobserved" : "unknown",
          },
        },
      };
      if (!publish(issuedCandidate)) {
        current = uncertain(action);
        return result("incomplete", "runtime_repair_state_unavailable");
      }
      if (!issued)
        return result(
          "failed",
          "runtime_repair_effect_unknown",
          "runtime_repair_effect_unknown",
        );
      const confirmed = effect.confirmation === "confirmed";
      if (
        !publish(
          replaceAction(action, {
            intent: "saved",
            request: "issued",
            result: confirmed ? "confirmed" : "unknown",
          }),
        )
      ) {
        current = uncertain(action);
        return result("incomplete", "runtime_repair_state_unavailable");
      }
      if (!confirmed)
        return result(
          "failed",
          "runtime_repair_effect_unknown",
          "runtime_repair_effect_unknown",
        );
      if (!issueAllowed()) return stopped();
      if (index === 8) {
        continuationEngineWaited = true;
        const waited = await technical.awaitEngine(
          "after_continuation_restart",
          current,
        );
        engineObservation =
          waited.continuation === null ? waited.state : "unknown";
        if (!issueAllowed()) return stopped();
        if (!(await recordEngineObservation()))
          return result(
            "incomplete",
            notificationFailed
              ? "runtime_repair_state_unavailable"
              : "runtime_repair_observation_unknown",
          );
      }
    }
    if (
      current?.actions.restart_runtime.result === "confirmed" &&
      current.engine !== "ready" &&
      !continuationEngineWaited
    ) {
      if (!issueAllowed()) return stopped();
      const waited = await technical.awaitEngine(
        "after_continuation_restart",
        current,
      );
      engineObservation =
        waited.continuation === null ? waited.state : "unknown";
      if (!issueAllowed()) return stopped();
      if (!(await recordEngineObservation()))
        return result(
          "incomplete",
          notificationFailed
            ? "runtime_repair_state_unavailable"
            : "runtime_repair_observation_unknown",
        );
    }
    return current?.engine === "ready" && current.hostSafety === "safe"
      ? result("recovered", "runtime_repair_recovered")
      : result("incomplete", "runtime_repair_observation_unknown");
  } catch {
    return input.signal.aborted
      ? stopped()
      : result("incomplete", "runtime_repair_observation_unknown");
  }
}

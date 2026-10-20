/**
 * 修復Machineを同じNative子と固定Docker操作へ接続する。
 * @packageDocumentation
 * @responsibility OS固有の前提・発行・結果と観測回収不明を下位へ閉じる。
 * @trace ARCH-000008
 * @boundary DI内部。保存Owner・Root・上位の復旧判断を所有しない。
 */
import type { DockerDesktopRepairNativeHelperSession as Session } from "../../../platform-access/src/index.ts";
import type { createDockerDesktopRepairDirectoryAccess } from "./runtime-directory.ts";
import {
  decodeDockerRuntimeRepairCheckpoint as decode,
  type DockerRuntimeRepairCheckpoint as Checkpoint,
} from "./repair-checkpoint.ts";
import type { runDockerRuntimeRepairMachine } from "./repair-machine.ts";
import {
  observeDockerDesktopRepairEngine,
  awaitDockerRepairEngine,
} from "./engine-state.ts";
import {
  observeDockerRuntimeBackendState,
  terminateDockerDesktopBackendForRepair,
} from "./backend-state.ts";

/**
 * 同じScopeへ固定済みのDirectory技術境界。
 * @responsibility 任意PathをAdapterへ渡さない。
 * @trace ARCH-000008
 * @shape 既存factoryの非null返値。
 * @invariant 対象を再構成しない。
 * @boundary DI内部。
 * @security 処置許可ではない。
 * @compatibility 最新factoryだけ。
 */
type Access = Pick<
  NonNullable<ReturnType<typeof createDockerDesktopRepairDirectoryAccess>>,
  "scopeSha256" | "verify" | "observe" | "lock" | "retain"
>;
/**
 * Machineの固定九用途契約。
 * @responsibility Adapterの入出力を既存契約に一致させる。
 * @trace ARCH-000008
 * @shape Machine第二引数。
 * @invariant 公開契約を重複定義しない。
 * @boundary DI内部。
 * @security 任意命令を追加しない。
 * @compatibility 同じMachineだけ。
 */
type Technical = Parameters<typeof runDockerRuntimeRepairMachine>[1];
/**
 * 保存済み期待実体または未固定値。
 * @responsibility 実体型を既存checkpointへ従属させる。
 * @trace ARCH-000008
 * @shape dev・ino・birthtimeNsまたはnull。
 * @invariant nullを一致と解釈しない。
 * @boundary 保存値と技術観測。
 * @security Authorityではない。
 * @compatibility 最新checkpointだけ。
 */
type Identity = Checkpoint["directories"]["primary"]["expected"];
/**
 * 同じ用途の元と退避先の現在観測。
 * @responsibility 不存在と観測不能を維持する。
 * @trace ARCH-000008
 * @shape Directory Accessの非null観測対。
 * @invariant Pathを別入力にしない。
 * @boundary 固定Filesystem境界。
 * @security 名前だけで一致にしない。
 * @compatibility 最新factoryだけ。
 */
type Pair = NonNullable<ReturnType<Access["observe"]>>;

/**
 * 固定三値のDirectory実体を比較する。
 * @responsibility null同士を実体一致にしない。
 * @trace ARCH-000008
 * @input left、right: 内部codecまたはDirectory Accessの実体値。
 * @returns 非nullの三値一致だけtrue。
 * @precondition 値は既存の閉じた観測境界から得る。
 * @postcondition 元値を変更しない。
 * @effect N/A: 値比較のみ。
 * @failure 欠測はfalse。
 * @invariant 名前・Hashで実体を代用しない。
 * @boundary 内部技術観測。
 * @security 処置許可を発行しない。
 * @concurrency N/A: 同期処理。
 */
function sameIdentity(left: Identity, right: Identity) {
  return (
    left !== null &&
    right !== null &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs
  );
}

/**
 * 同じ子と固定対象へ九処置の技術Adapterを閉じ込める。
 * @responsibility 実観測を前提・発行・結果へ接続し回収不明を保持する。
 * @trace ARCH-000008
 * @input session、directories: 同取得の境界。signal、canIssue: 現在許可。observations: 内部試験境界。
 * @returns 固定技術Adapterと純粋cleanup Reader。
 * @precondition 外側runtimeが同じNative子の取得・joinを所有する。
 * @postcondition 許可喪失後の新Effect0、発行事実は取消後も返す。
 * @effect 固定Engine、Backend、Native、Directory観測と限定処置。
 * @failure 不明前提はunknown、発行後不明は未発行へ戻さない。
 * @invariant Root公開・新Store・新Lock・汎用コマンドは追加しない。
 * @boundary DI内部のMachineと既存OS技術処理。
 * @security 任意Path・argv・上位保存callbackを受けない。
 * @concurrency 読取りawaitは前後で境界を照合し、Effect await後は取得済み結果を返して後続Effectだけ停止する。
 */
export function createDockerDesktopRepairOperations(
  session: Session,
  directories: Access,
  signal: AbortSignal,
  canIssue: () => boolean,
  observations: Readonly<{
    engine: typeof observeDockerDesktopRepairEngine;
    backend: typeof observeDockerRuntimeBackendState;
    terminateBackend: typeof terminateDockerDesktopBackendForRepair;
    wait: typeof awaitDockerRepairEngine;
  }> = {
    engine: observeDockerDesktopRepairEngine,
    backend: observeDockerRuntimeBackendState,
    terminateBackend: terminateDockerDesktopBackendForRepair,
    wait: awaitDockerRepairEngine,
  },
) {
  let cleanupFailure: "observation_cleanup_unknown" | null = null;
  /**
   * 同じ呼出しの新Effect許可を確認する。
   * @responsibility sticky不明・取消・Native喪失を発行へ進めない。
   * @trace ARCH-000008
   * @input N/A: 捕捉した境界のみ。
   * @returns 全条件成立だけtrue。
   * @precondition 外側の確認は同期boolean。
   * @postcondition 確認callback後にも取消を照合する。
   * @effect 現在許可の読取り。
   * @failure 例外はfalse。
   * @invariant 失効を回復しない。
   * @boundary 内部許可と技術処置。
   * @security Authorityを生成しない。
   * @concurrency 同期確認。
   */
  const live = () => {
    try {
      return (
        cleanupFailure === null &&
        !signal.aborted &&
        session.assertLive() &&
        canIssue() === true &&
        !signal.aborted &&
        session.assertLive()
      );
    } catch {
      return false;
    }
  };
  /**
   * 同Artifactと捕捉済みScopeをfresh確認する。
   * @responsibility await中の失効を処置前に検出する。
   * @trace ARCH-000008
   * @input N/A: 同Sessionと同Directory Access。
   * @returns 全条件成立だけtrue。
   * @precondition 読取りのみ。
   * @postcondition Artifact不明を不要に変えない。
   * @effect Native検証とScope読取り。
   * @failure 不明・失効はfalse。
   * @invariant 別Sessionを取得しない。
   * @boundary 同Native子と固定対象。
   * @security Artifactの署名資格を新設しない。
   * @concurrency await前後を確認。
   */
  const boundary = async () =>
    live() &&
    (await session.verifyArtifacts()) === "verified" &&
    live() &&
    directories.verify();
  /**
   * Engine結果とその観測回収を同時に確認する。
   * @responsibility cleanup不明をreadyや未起動に隠さない。
   * @trace ARCH-000008
   * @input N/A: 固定観測。
   * @returns 回収確認済みの元分類。
   * @precondition 新観測の現在許可がある。
   * @postcondition 一度不明ならReaderへ残す。
   * @effect 固定CLIとpipe観測。
   * @failure 回収不明・失効は固定例外。
   * @invariant 後着成功で不明を消さない。
   * @boundary Engine観測とAdapter停止。
   * @security 生出力を搬送しない。
   * @concurrency 同期OS観測は有界だが即時取消ではない。
   */
  const engine = () => {
    if (!live()) throw new Error("repair_boundary_unavailable");
    const result = observations.engine();
    if (result.cleanup !== "confirmed") {
      cleanupFailure = "observation_cleanup_unknown";
      throw new Error("repair_observation_cleanup_unknown");
    }
    if (!live()) throw new Error("repair_boundary_unavailable");
    return result.state;
  };
  /**
   * 保存した実体が元だけを占有し退避先がないことを照合する。
   * @responsibility 同名の別実体を処置しない。
   * @trace ARCH-000008
   * @input pair: 現在観測、expected: 保存済み実体。
   * @returns 両条件成立だけtrue。
   * @precondition pairは同じAccessで取得。
   * @postcondition 観測を変更しない。
   * @effect N/A: 比較のみ。
   * @failure 欠測はfalse。
   * @invariant 不明を不存在へ畳まない。
   * @boundary 元と退避先の実体。
   * @security 削除許可なし。
   * @concurrency N/A: 同期比較。
   */
  const sourceMatches = (pair: Pair | null, expected: Identity) =>
    pair !== null &&
    pair.source.state === "present" &&
    sameIdentity(pair.source.identity, expected) &&
    pair.retained.state === "confirmed_absent";
  /**
   * 保存した実体が退避済みであることを照合する。
   * @responsibility 旧退避実体を別世代と混同しない。
   * @trace ARCH-000008
   * @input pair: 現在観測、expected: 保存済み実体。
   * @returns 退避先一致だけtrue。
   * @precondition 元の現在Path存在は別途判定する。
   * @postcondition 旧元Pathの不存在を推定しない。
   * @effect N/A: 比較のみ。
   * @failure 欠測・差はfalse。
   * @invariant 新runを旧primaryへ上書きしない。
   * @boundary 退避先と保存世代。
   * @security 処置権限なし。
   * @concurrency N/A: 同期比較。
   */
  const retainedMatches = (pair: Pair | null, expected: Identity) =>
    pair !== null &&
    pair.retained.state === "present" &&
    sameIdentity(pair.retained.identity, expected);
  /**
   * 初回timeout後の完全freshな継続対象を取得する。
   * @responsibility 両lock・新旧実体・同じ子を一組で再確認する。
   * @trace ARCH-000008
   * @input checkpoint: 初回起動・退避を確認済みの値。
   * @returns 両対象と生Engine分類、またはnull。
   * @precondition 追加Effectは未発行。
   * @postcondition 永続化や停止は行わない。
   * @effect 固定読取り観測だけ。
   * @failure 一条件でも不明・不一致はnull。
   * @invariant transientをknownへ変換しない。
   * @boundary 初回失敗と追加停止の前提。
   * @security 別Pathへ探索しない。
   * @concurrency Native await後に同Scopeを再確認する。
   */
  const failedLaunch = async (checkpoint: Checkpoint) => {
    if (!(await boundary())) return null;
    const state = engine();
    if (state !== "known_unavailable" && state !== "transient_unavailable")
      return null;
    const processes = await session.inspectProcesses();
    if (!live() || !directories.verify() || processes === "unknown")
      return null;
    const original = directories.observe("initial");
    const failed = directories.observe("failed");
    const auxiliary = directories.observe("auxiliary");
    if (
      !retainedMatches(original, checkpoint.directories.primary.expected) ||
      !failed ||
      !auxiliary ||
      failed.source.state !== "present" ||
      auxiliary.source.state !== "present" ||
      !sourceMatches(failed, failed.source.identity) ||
      !sourceMatches(auxiliary, auxiliary.source.identity) ||
      sameIdentity(
        failed.source.identity,
        checkpoint.directories.primary.expected,
      ) ||
      sameIdentity(failed.source.identity, auxiliary.source.identity) ||
      sameIdentity(
        auxiliary.source.identity,
        checkpoint.directories.primary.expected,
      ) ||
      !sameIdentity(directories.lock("failed"), failed.source.identity) ||
      !sameIdentity(directories.lock("auxiliary"), auxiliary.source.identity) ||
      !live()
    )
      return null;
    if (
      !sourceMatches(directories.observe("failed"), failed.source.identity) ||
      !sourceMatches(
        directories.observe("auxiliary"),
        auxiliary.source.identity,
      ) ||
      !retainedMatches(
        directories.observe("initial"),
        checkpoint.directories.primary.expected,
      ) ||
      !live()
    )
      return null;
    return { state, failed, auxiliary };
  };
  const technical: Technical = {
    observe: async (checkpoint, phase) => {
      if (phase === "failed_launch") {
        const fresh = await failedLaunch(checkpoint);
        if (!fresh) throw new Error("repair_failed_launch_unknown");
        const directoriesValue = { ...checkpoint.directories };
        for (const purpose of ["failed", "auxiliary"] as const) {
          const pair = fresh[purpose];
          directoriesValue[purpose] = {
            expected: pair.source.identity,
            source: { state: "present", identity: pair.source.identity },
            retained: { state: "absent", identity: null },
          };
        }
        const value = decode({ ...checkpoint, directories: directoriesValue });
        if (!value) throw new Error("repair_failed_launch_unknown");
        return value;
      }
      if (!(await boundary())) throw new Error("repair_boundary_unavailable");
      const state = engine();
      const processes = await session.inspectProcesses();
      if (
        !live() ||
        !directories.verify() ||
        processes === "unknown" ||
        (state === "ready" && processes !== "verified")
      )
        throw new Error("repair_observation_unknown");
      const pair = directories.observe("initial");
      if (!pair) throw new Error("repair_observation_unknown");
      const samples: {
        purpose: "initial" | "failed" | "auxiliary";
        pair: Pair;
      }[] = [{ purpose: "initial", pair }];
      if (state === "ready" && pair.source.state !== "present")
        throw new Error("repair_generation_unknown");
      const prior = checkpoint.directories.primary;
      const expected = prior.expected ?? pair.source.identity;
      let primary = prior;
      if (
        retainedMatches(pair, expected) &&
        pair.source.state !== "unknown" &&
        !sameIdentity(pair.source.identity, expected)
      ) {
        // 旧元の不存在は保存済み事実。現在Pathが空だという新観測ではない。
        if (prior.source.state !== "absent")
          throw new Error("repair_generation_unknown");
        primary = {
          ...prior,
          retained: { state: "present", identity: expected },
        };
      } else if (sourceMatches(pair, expected)) {
        primary = {
          expected,
          source: { state: "present", identity: expected },
          retained: { state: "absent", identity: null },
        };
      } else throw new Error("repair_generation_unknown");
      const dirs = { ...checkpoint.directories, primary };
      if (dirs.failed.expected !== null || dirs.auxiliary.expected !== null) {
        const ids = [
          dirs.primary.expected,
          dirs.failed.expected,
          dirs.auxiliary.expected,
        ];
        const restarted =
          checkpoint.actions.restart_runtime.result === "confirmed";
        if (
          restarted &&
          pair.source.state === "present" &&
          ids.some((id) => sameIdentity(id, pair.source.identity))
        )
          throw new Error("repair_generation_unknown");
        for (const purpose of ["failed", "auxiliary"] as const) {
          const priorPair = dirs[purpose];
          const observed = directories.observe(purpose);
          if (!observed) throw new Error("repair_generation_unknown");
          samples.push({ purpose, pair: observed });
          const action =
            purpose === "failed"
              ? "retain_failed_runtime"
              : "retain_auxiliary_runtime";
          if (checkpoint.actions[action].result === "confirmed") {
            if (
              !retainedMatches(observed, priorPair.expected) ||
              !observed ||
              observed.source.state === "unknown" ||
              (restarted
                ? observed.source.state === "present" &&
                  ids.some((id) => sameIdentity(id, observed.source.identity))
                : observed.source.state !== "confirmed_absent")
            )
              throw new Error("repair_generation_unknown");
            // 旧元不存在は保存済み事実であり、再起動後の同名Path不存在ではない。
          } else if (!sourceMatches(observed, priorPair.expected))
            throw new Error("repair_generation_unknown");
        }
      }
      const retained = Object.values(dirs).some(
        (d) => d.retained.state === "present",
      );
      const absent = Object.values(dirs).every(
        (d) => d.retained.state === "absent",
      );
      if (
        state === "ready" &&
        ((await session.verifyArtifacts()) !== "verified" ||
          !live() ||
          engine() !== "ready")
      )
        throw new Error("repair_observation_unknown");
      for (const sample of samples) {
        const again = directories.observe(sample.purpose);
        // 同じfactoryの閉じた三値DTOを比較し、保存前の新世代すり替えも拒否する。
        if (!again || JSON.stringify(again) !== JSON.stringify(sample.pair))
          throw new Error("repair_generation_unknown");
      }
      if (!live() || !directories.verify())
        throw new Error("repair_boundary_unavailable");
      const value = decode({
        ...checkpoint,
        directories: dirs,
        engine:
          state === "ready"
            ? "ready"
            : state === "known_unavailable"
              ? "unavailable"
              : "unknown",
        stale: retained ? "retained" : absent ? "absent" : "unknown",
        hostSafety: "safe",
      });
      if (!value) throw new Error("repair_observation_unknown");
      return value;
    },
    precondition: async (action, checkpoint) => {
      if (!(await boundary())) return "unknown";
      // Repair06は公式停止命令を持たない。実失敗のfallbackではない。
      if (action === "stop_runtime") return "not_required";
      const state = engine();
      const processes = await session.inspectProcesses();
      if (!live() || !directories.verify() || processes === "unknown")
        return "unknown";
      const original = directories.observe("initial");
      const originalSource = sourceMatches(
        original,
        checkpoint.directories.primary.expected,
      );
      const originalRetained = retainedMatches(
        original,
        checkpoint.directories.primary.expected,
      );
      if (
        state === "ready" &&
        processes === "verified" &&
        (originalSource ||
          (originalRetained &&
            original?.source.state === "present" &&
            !sameIdentity(
              original.source.identity,
              checkpoint.directories.primary.expected,
            )))
      )
        return "not_required";
      if (action === "terminate_runtime")
        return state === "known_unavailable" && originalSource
          ? processes === "absent"
            ? "not_required"
            : "proceed"
          : "unknown";
      if (action === "stop_backend") {
        if (
          state !== "known_unavailable" ||
          processes !== "absent" ||
          !originalSource
        )
          return "unknown";
        const backend = observations.backend();
        return !live()
          ? "unknown"
          : backend === "stopped"
            ? "not_required"
            : backend === "running"
              ? "proceed"
              : "unknown";
      }
      if (action === "retain_runtime")
        return state === "known_unavailable" &&
          processes === "absent" &&
          originalSource &&
          ["confirmed", "not_required"].includes(
            checkpoint.actions.stop_backend.result,
          ) &&
          observations.backend() === "stopped" &&
          live()
          ? "proceed"
          : "unknown";
      if (action === "start_runtime")
        return state === "known_unavailable" &&
          processes === "absent" &&
          originalRetained &&
          original?.source.state === "confirmed_absent"
          ? "proceed"
          : "unknown";
      if (!originalRetained) return "unknown";
      const failed = directories.observe("failed"),
        auxiliary = directories.observe("auxiliary");
      const failedSource = sourceMatches(
        failed,
        checkpoint.directories.failed.expected,
      );
      const auxiliarySource = sourceMatches(
        auxiliary,
        checkpoint.directories.auxiliary.expected,
      );
      if (action === "stop_failed_runtime")
        return (state === "known_unavailable" ||
          state === "transient_unavailable") &&
          failedSource &&
          auxiliarySource &&
          sameIdentity(
            directories.lock("failed"),
            checkpoint.directories.failed.expected,
          ) &&
          sameIdentity(
            directories.lock("auxiliary"),
            checkpoint.directories.auxiliary.expected,
          ) &&
          live()
          ? processes === "absent"
            ? "not_required"
            : "proceed"
          : "unknown";
      if (state !== "known_unavailable" || processes !== "absent")
        return "unknown";
      if (action === "retain_failed_runtime")
        return failedSource &&
          auxiliarySource &&
          sameIdentity(
            directories.lock("failed"),
            checkpoint.directories.failed.expected,
          ) &&
          sameIdentity(
            directories.lock("auxiliary"),
            checkpoint.directories.auxiliary.expected,
          ) &&
          live()
          ? "proceed"
          : "unknown";
      if (action === "retain_auxiliary_runtime")
        return retainedMatches(
          failed,
          checkpoint.directories.failed.expected,
        ) &&
          failed?.source.state === "confirmed_absent" &&
          auxiliarySource &&
          sameIdentity(
            directories.lock("auxiliary"),
            checkpoint.directories.auxiliary.expected,
          ) &&
          live()
          ? "proceed"
          : "unknown";
      return action === "restart_runtime" &&
        retainedMatches(failed, checkpoint.directories.failed.expected) &&
        retainedMatches(auxiliary, checkpoint.directories.auxiliary.expected) &&
        failed?.source.state === "confirmed_absent" &&
        auxiliary?.source.state === "confirmed_absent"
        ? "proceed"
        : "unknown";
    },
    execute: async (action, checkpoint) => {
      const unissued = {
        issued: false,
        confirmation: "not_issued" as const,
        observation: checkpoint,
      };
      if (
        (await technical.precondition(action, checkpoint)) !== "proceed" ||
        !live() ||
        !directories.verify()
      )
        return unissued;
      if (action === "terminate_runtime" || action === "stop_failed_runtime") {
        const result = await session.terminateProcesses();
        return {
          issued:
            result === "terminated" || result === "partial_or_unknown"
              ? true
              : result === "absent" || result === "not_issued_unknown"
                ? false
                : null,
          confirmation:
            result === "terminated"
              ? "confirmed"
              : result === "absent"
                ? "not_issued"
                : "unknown",
          observation: checkpoint,
        };
      }
      if (action === "stop_backend")
        return { ...observations.terminateBackend(), observation: checkpoint };
      if (action === "start_runtime" || action === "restart_runtime") {
        const result = await session.launchDesktop();
        return {
          issued:
            result === "started" || result === "partial_or_unknown"
              ? true
              : result === "not_started"
                ? false
                : null,
          confirmation:
            result === "started"
              ? "confirmed"
              : result === "not_started"
                ? "not_issued"
                : "unknown",
          observation: checkpoint,
        };
      }
      const purpose =
        action === "retain_runtime"
          ? "primary"
          : action === "retain_failed_runtime"
            ? "failed"
            : action === "retain_auxiliary_runtime"
              ? "auxiliary"
              : null;
      if (!purpose) return unissued;
      const target = purpose === "primary" ? "initial" : purpose;
      const expected = checkpoint.directories[purpose].expected;
      const result = directories.retain(target, expected);
      const pair = directories.observe(target);
      const confirmed =
        result.confirmation === "confirmed" &&
        retainedMatches(pair, expected) &&
        pair?.source.state === "confirmed_absent";
      const observation = confirmed
        ? decode({
            ...checkpoint,
            stale: "retained",
            directories: {
              ...checkpoint.directories,
              [purpose]: {
                expected,
                source: { state: "absent", identity: null },
                retained: { state: "present", identity: expected },
              },
            },
          })
        : null;
      return {
        issued: result.issued,
        confirmation:
          confirmed && observation
            ? "confirmed"
            : result.confirmation === "not_issued"
              ? "not_issued"
              : "unknown",
        observation: observation ?? checkpoint,
      };
    },
    awaitEngine: async (stage, checkpoint) => {
      if (!(await boundary())) return { state: "unknown", continuation: null };
      let notify = () => {};
      const stopped = new Promise<void>((resolve) => {
        notify = resolve;
      });
      signal.addEventListener("abort", notify, { once: true });
      try {
        const state = await observations.wait(engine, () => !live(), stopped);
        if (!live()) return { state: "unknown", continuation: null };
        if (stage === "after_initial_start" && state === "startup_timeout") {
          const fresh = await failedLaunch(checkpoint);
          return {
            state,
            continuation: fresh ? { engine: fresh.state } : null,
          };
        }
        return { state, continuation: null };
      } finally {
        signal.removeEventListener("abort", notify);
      }
    },
  };
  return Object.freeze({
    technical: Object.freeze(technical),
    cleanupFailure: () => cleanupFailure,
  });
}

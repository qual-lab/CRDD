/**
 * 公式CLI操作の生涯と、終了後の固定退避物回収・保持照合を所有する。
 * @packageDocumentation
 * @responsibility CLIの取消・終了と、指定基点の固定対象回収を分離する。
 * @trace ARCH-000008
 * @boundary 元Sessionは同子を回収し、終了後回収・保持照合は新Repair Sessionを取得しない。現在の許可と真正Writerは上位Ownerが所有する。
 */
import { acquireDesktopOperations } from "./command.ts";
import { types } from "node:util";
import {
  type IsolationSettings,
  captureIsolationSettings,
} from "../docker-cli/environment.ts";
import {
  observeDockerDesktopRepairEngine,
  awaitDockerRepairEngine,
} from "./engine.ts";
import {
  observeBackendState,
  terminateDockerDesktopBackendForRepair,
} from "./backend.ts";
import {
  decodeRepairCheckpoint,
  isRepairCheckpointSettled,
  prepareRepairSessionCheckpoint,
} from "./validation.ts";
import type {
  RepairCheckpoint,
  RepairRetentionTargets,
  DesktopOperations,
  DesktopAcquisition,
} from "./types.ts";
import { executeRepairSteps, type RepairMachineResult } from "./repair.ts";
import { createDockerDesktopRepairDirectoryAccess } from "./directory.ts";
import { createDockerDesktopRepairOperations } from "./repair-operations.ts";

/**
 * 一回の修復準備と事実通知の内部入力。
 * @responsibility 初回取得と既存操作再入場の期待相関を分ける。
 * @trace ARCH-000008
 * @shape nonce、取消、再入場値、現在確認と二通知。
 * @invariant 相関Hashは処置許可や上位Ownerを証明しない。
 * @boundary 固定Sessionの公開入力。技術依存差替えは内部限定。
 * @security Path、任意命令、保存実装を含めない。
 * @compatibility 最新checkpointだけ。
 */
export interface RepairCallbacks {
  onPrepared(checkpoint: RepairCheckpoint): void;
  onCheckpoint(value: RepairCheckpoint): void;
}

/**
 * 修復の相関・取消・借用元生存と事実通知を結合する。
 * @responsibility 保存結果を受け取らず、同じ修復の技術入力だけを保持する。
 * @trace ARCH-000008
 * @shape nonce、元checkpoint、Signal、生存観測と同期void通知。
 * @invariant 永続保存はCoordinatorが所有する。
 * @boundary 上位Ownerから固定修復Sessionへの入力。
 * @security 任意Path・OS処置・Store操作を含めない。
 * @compatibility checkpointのSchemaとexact相関は不変。
 */
export type RepairInput = Readonly<{
  operationNonce: string;
  signal: AbortSignal;
  resume: RepairCheckpoint | null;
  canIssueEffect: () => unknown;
}> &
  RepairCallbacks;

/**
 * 修復Sessionの技術結果。上位の永続保存確定を意味しない。
 * @responsibility 一次結果・CLI終了・観測資源終了とcheckpoint候補を分離する。
 * @trace ARCH-000008
 * @shape 準備分類、Machine、CLI終了、checkpoint候補。
 * @invariant finalCheckpointConfirmedは常にfalse。保存Ownerだけが確定する。
 * @boundary DIの固定修復Sessionから上位へ返す技術結果。
 * @security 生Session・Path・秘密情報を含めない。
 * @compatibility 既存の無名結果と同形で、値やSchemaを変更しない。
 */
export type RepairResult = Readonly<{
  preparation: "input_rejected" | "boundary_unavailable" | "prepared";
  machine: RepairMachineResult | null;
  lifecycle: Readonly<{
    failure: "cancelled" | "operations_unavailable" | "execution_failed" | null;
    cleanupConfirmed: boolean;
    observationCleanupFailure: "observation_cleanup_unknown" | null;
  }> | null;
  checkpoint: RepairCheckpoint | null;
  finalCheckpointConfirmed: false;
}>;

/**
 * 固定三用途のDirectory観測入力。
 * @responsibility 元修復相関と現在の読取り許可を結合する。
 * @trace ARCH-000008
 * @shape nonce・checkpoint・Signalと同期Query。
 * @invariant 保持判断や任意Pathを含めない。
 * @boundary 上位から固定Directoryの二読取り。
 * @security 保存値だけで現在の許可を復元しない。
 * @compatibility 既存の閉field入力と同形である。
 */
export type DirectoryInspectionInput = Readonly<{
  operationNonce: string;
  checkpoint: RepairCheckpoint;
  signal: AbortSignal;
  canObserve: () => unknown;
}>;

/**
 * 今回の要求発行と現在の不存在を区別する技術結果。
 * @responsibility 発行履歴のunknownと実体の観測不能を別々に保持する。
 * @trace ARCH-000008
 * @shape 三値のrequestと二値のabsence。
 * @invariant 現在不存在から過去の発行不明を補完しない。
 * @boundary 固定Directory処置から上位保存。
 * @security 完了値を別対象の処置許可へ流用しない。
 * @compatibility 既存の返却値をそのまま表す明示型である。
 */
export type DirectoryCleanupResult = Readonly<{
  request: "not_issued" | "issued" | "unknown";
  absence: "confirmed_absent" | "unknown";
}>;

/**
 * 公式CLI・共通wx排他・初期化済み所在から修復Sessionを組み立てる。
 * @responsibility 任意の技術境界を受け取らず実Adapterへ接続する。
 * @trace ARCH-000008
 * @input value: 同exact操作の技術入力と保存確認。
 * @returns CLI close後の技術結果と未保存候補。
 * @precondition 上位の真正Root・Revision・排他・意図保存は別途必要。
 * @postcondition 入力拒否時はCLI要求0、取得後拒否は同じ操作のclose。
 * @effect 公式CLI検証、wx取得、明示所在の実体観測、実修復。
 * @failure 準備不能は新処置0で停止し生Pathを返さない。
 * @invariant 同じArtifact値・H・nonce・Sessionを全接続で維持する。
 * @boundary 固定SessionだけをPackage Rootへ公開し、真正Writer／CLIは上位が接続する。
 * @security 環境変数・旧State Root・任意Pathへfallbackしない。
 * @concurrency Usingの入力検査後にだけ取得し、準備await後も現在許可を照合する。
 */
export async function runRepairSession(
  value: RepairInput,
  settings: IsolationSettings,
): Promise<RepairResult> {
  settings = captureIsolationSettings(settings);
  if (!settings.desktop) throw Error("docker_desktop_settings_unavailable");
  const local = settings.desktop.userDataDirectory;
  return runRepairSessionWithDependencies(value, {
    acquire: async (signal) => acquireDesktopOperations(settings, signal),
    prepare: async (desktop, nonce, signal, live) => {
      if (!live()) return null;
      const directories = createDockerDesktopRepairDirectoryAccess(
        local,
        nonce,
      );
      if (!directories || !live() || !directories.verify()) return null;
      return createDockerDesktopRepairOperations(
        desktop,
        directories,
        signal,
        live,
        {
          engine: () => observeDockerDesktopRepairEngine(settings),
          backend: () => observeBackendState(settings),
          terminateBackend: () =>
            terminateDockerDesktopBackendForRepair(settings),
          wait: awaitDockerRepairEngine,
        },
      );
    },
  });
}

/**
 * 終了済み修復の固定一用途を回収する入力。
 * @responsibility 元Hを相関だけに使い現在の処置許可と分離する。
 * @trace ARCH-000008
 * @shape 元nonce／checkpoint、用途、取消、保存意図を含む現在確認。
 * @invariant Path・代替Adapter・新Sessionを受け取らない。
 * @boundary 上位保存Ownerと固定回収composition。
 * @security canIssueEffectは同用途の意図保存・読戻し・排他解放も確認する。
 * @compatibility 現行の終了済み修復だけ。
 */
export type RepairDisposalInput = Readonly<{
  operationNonce: string;
  checkpoint: RepairCheckpoint;
  purpose: "primary" | "failed" | "auxiliary";
  signal: AbortSignal;
  canIssueEffect: () => unknown;
}>;

/**
 * 元修復の終了後、同じ固定対象だけを回収へ接続する。
 * @responsibility 固定対象のfresh一致と用途の保存意図確認後だけ物理回収する。
 * @trace ARCH-000008
 * @input value: 元修復相関、終了checkpoint、固定用途と現在Owner確認。
 * @returns 今回要求の到達と現在不存在。保存確定は返さない。
 * @precondition 上位が同exact操作の回収判断・用途意図の保存と解放を確認済み。
 * @postcondition 元checkpointを変更せず、新しいDesktop操作を取得しない。
 * @effect 明示所在の実体読取り、条件成立時だけ旧target回収。
 * @failure 入力・終了・実体・現在許可不明はDriver0。部分処置はunknownを保持。
 * @invariant 元H・保存値だけで現在Authorityを復元しない。
 * @boundary 固定公開composition→内部factory／Driver。真正Writerは上位所有。
 * @security 任意Path・Command・新Store／Lock・再起動を提供しない。
 * @concurrency Driver待機後にもDirectory実体・取消・現在Ownerを再確認する。
 */
export async function cleanupRepairDirectory(
  value: RepairDisposalInput,
  settings: IsolationSettings,
): Promise<DirectoryCleanupResult> {
  let handedOff = false;
  const unavailable = Object.freeze({
    request: "not_issued",
    absence: "unknown",
  } as const);
  try {
    settings = captureIsolationSettings(settings);
    if (!settings.desktop) return unavailable;
    const fields = repairData(value, [
      "operationNonce",
      "checkpoint",
      "purpose",
      "signal",
      "canIssueEffect",
    ]);
    const checkpoint = decodeRepairCheckpoint(fields?.checkpoint);
    if (
      !fields ||
      !checkpoint ||
      ![fields.operationNonce].every(
        (hash) => typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash),
      ) ||
      !["primary", "failed", "auxiliary"].includes(fields.purpose as string) ||
      types.isProxy(fields.signal) ||
      !(fields.signal instanceof AbortSignal) ||
      checkpoint.cleanup !== "confirmed" ||
      checkpoint.cleanupFailure !== null ||
      checkpoint.engine !== "ready" ||
      checkpoint.hostSafety !== "safe" ||
      checkpoint.stale !== "retained" ||
      !isRepairCheckpointSettled(checkpoint) ||
      fields.signal.aborted ||
      !confirmRepair(fields.canIssueEffect)
    )
      return unavailable;
    const signal = fields.signal;
    if (signal.aborted || !confirmRepair(fields.canIssueEffect))
      return unavailable;
    const local = settings.desktop.userDataDirectory;
    const directories = createDockerDesktopRepairDirectoryAccess(
      local,
      fields.operationNonce,
    );
    if (!directories) return unavailable;
    const purpose = fields.purpose as "primary" | "failed" | "auxiliary";
    handedOff = true;
    return await directories.dispose(
      purpose === "primary" ? "initial" : purpose,
      checkpoint.directories[purpose].expected,
      () =>
        !signal.aborted &&
        directories.verify() &&
        confirmRepair(fields.canIssueEffect),
    );
  } catch {
    return handedOff
      ? Object.freeze({ request: "unknown", absence: "unknown" } as const)
      : unavailable;
  }
}

/**
 * 固定保持先を処置せず元修復の実体と再照合する。
 * @responsibility 消失・別実体・観測不能を保持引渡しの肯定へ変換しない。
 * @trace ARCH-000008
 * @input value: 元nonce、終端checkpoint、取消、同期現在確認。
 * @returns 全三用途を二読取りした凍結照合値、または失敗のnull。
 * @precondition 上位が明示保持の意思と同じ現在操作を確認する。
 * @postcondition 入力を変更せず、新しいDesktop操作を取得しない。
 * @effect 明示所在の実体・固定三対象の読取りだけ。
 * @failure 元結果不正、失効、観測差、保持物消失は全体null。
 * @invariant 用途内nullは元から保持不要かつ二回の明示不存在だけ。
 * @boundary 固定公開読取り→既存Directory factory。保存・期限・終了は上位所有。
 * @security 任意Path・依存差替え・削除・再起動・保存能力を公開しない。
 * @concurrency 各読取り前後に同じ取消・Owner・Directory実体を再確認する。
 */
export function observeRepairDirectories(
  value: DirectoryInspectionInput,
  settings: IsolationSettings,
): RepairRetentionTargets | null {
  try {
    settings = captureIsolationSettings(settings);
    if (!settings.desktop) return null;
    const fields = repairData(value, [
      "operationNonce",
      "checkpoint",
      "signal",
      "canObserve",
    ]);
    const checkpoint = decodeRepairCheckpoint(fields?.checkpoint);
    if (
      !fields ||
      !checkpoint ||
      ![fields.operationNonce].every(
        (hash) => typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash),
      ) ||
      types.isProxy(fields.signal) ||
      !(fields.signal instanceof AbortSignal) ||
      checkpoint.cleanup !== "confirmed" ||
      checkpoint.cleanupFailure !== null ||
      checkpoint.engine !== "ready" ||
      checkpoint.hostSafety !== "safe" ||
      checkpoint.stale !== "retained" ||
      !isRepairCheckpointSettled(checkpoint) ||
      fields.signal.aborted ||
      !confirmRepair(fields.canObserve)
    )
      return null;
    const signal = fields.signal;
    if (signal.aborted || !confirmRepair(fields.canObserve)) return null;
    const local = settings.desktop.userDataDirectory;
    const access = createDockerDesktopRepairDirectoryAccess(
      local,
      fields.operationNonce,
    );
    if (!access) return null;
    const targets: {
      -readonly [P in keyof RepairRetentionTargets]: RepairRetentionTargets[P];
    } = { primary: null, failed: null, auxiliary: null };
    for (let pass = 0; pass < 2; pass++) {
      for (const purpose of ["primary", "failed", "auxiliary"] as const) {
        if (
          signal.aborted ||
          !confirmRepair(fields.canObserve) ||
          !access.verify()
        )
          return null;
        const pair = checkpoint.directories[purpose];
        const action =
          checkpoint.actions[
            purpose === "primary"
              ? "retain_runtime"
              : purpose === "failed"
                ? "retain_failed_runtime"
                : "retain_auxiliary_runtime"
          ];
        const observed = access.observe(
          purpose === "primary" ? "initial" : purpose,
        );
        if (
          !observed ||
          signal.aborted ||
          !confirmRepair(fields.canObserve) ||
          !access.verify()
        )
          return null;
        if (pair.retained.state === "present") {
          const expected = pair.expected;
          const retained = pair.retained.identity;
          const fresh = observed.retained.identity;
          if (
            action.intent !== "saved" ||
            action.request !== "issued" ||
            action.result !== "confirmed" ||
            !expected ||
            !retained ||
            observed.retained.state !== "present" ||
            !fresh ||
            !(["dev", "ino", "birthtimeNs"] as const).every(
              (key) =>
                expected[key] === retained[key] && expected[key] === fresh[key],
            )
          )
            return null;
          targets[purpose] = Object.freeze({ ...expected });
        } else if (
          pair.retained.state !== "absent" ||
          action.request !== "not_issued" ||
          action.result !== "not_required" ||
          observed.retained.state !== "confirmed_absent"
        )
          return null;
      }
    }
    return Object.freeze(targets);
  } catch {
    return null;
  }
}

/**
 * 閉じたown data propertyを一度だけ捕捉する。
 * @responsibility getterやProxyを取得前に拒否する。
 * @trace ARCH-000008
 * @input value: 未信頼値、keys: 内部固定集合。
 * @returns own data値、またはnull。
 * @precondition keysは内部契約。
 * @postcondition 元objectを再参照しない。
 * @effect N/A: 値検査のみ。
 * @failure 余剰・欠落・accessor・Proxyはnull。
 * @invariant 欠落を既定値で補わない。
 * @boundary 入力と捕捉値。
 * @security trapを実行しない。
 * @concurrency N/A: 同期検査。
 */
function repairData(value: unknown, keys: readonly string[]) {
  if (
    !value ||
    typeof value !== "object" ||
    types.isProxy(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    return null;
  const fields = Object.getOwnPropertyDescriptors(value);
  if (
    Reflect.ownKeys(fields).length !== keys.length ||
    keys.some(
      (key) => !Object.hasOwn(fields, key) || !("value" in (fields[key] ?? {})),
    )
  )
    return null;
  return Object.fromEntries(keys.map((key) => [key, fields[key]?.value]));
}

/**
 * 現在境界の同期trueと事実通知の同期voidを用途別に確認する。
 * @responsibility 非同期確認を保存・発行許可へ変換しない。
 * @trace ARCH-000008
 * @input callback: 内部用途を固定した通知、value: 通知値。
 * @returns 境界観測は同期true、事実通知は同期undefinedのみ。
 * @precondition callback用途は同呼出しで固定。
 * @postcondition Promise拒否を消費しthenableは実行しない。
 * @effect 同期callback一回。
 * @failure 不正関数・例外・用途に不一致の戻り値はfalse。
 * @invariant async関数・関数Proxyは実行0。
 * @boundary 上位確認と内部runtime。
 * @security 生例外を返さない。
 * @concurrency awaitしない。
 */
function confirmRepair(callback: unknown, value?: unknown): boolean {
  if (
    typeof callback !== "function" ||
    types.isProxy(callback) ||
    types.isAsyncFunction(callback)
  )
    return false;
  try {
    const result: unknown = value === undefined ? callback() : callback(value);
    if (types.isPromise(result))
      void Promise.prototype.then.call(
        result,
        () => undefined,
        () => undefined,
      );
    return value === undefined ? result === true : result === undefined;
  } catch {
    return false;
  }
}

/**
 * 初回の未処置checkpointを構成する。
 * @responsibility 実観測を捏造せず補助子の取得だけをpendingにする。
 * @trace ARCH-000008
 * @input N/A: 固定初期値。
 * @returns 実codecで受理したcheckpoint。
 * @precondition wx取得後の準備通知だけで使用。
 * @postcondition 全処置・実体が未観測。
 * @effect N/A: 値生成。
 * @failure 内部固定値不正はnull。
 * @invariant 未観測を不存在へ補完しない。
 * @boundary 初回準備と保存Owner。
 * @security 実行Authorityを持たない。
 * @concurrency N/A: 共有状態なし。
 */
function initialRepairCheckpoint() {
  return decodeRepairCheckpoint({
    actions: Object.fromEntries(
      [
        "stop_runtime",
        "stop_backend",
        "retain_runtime",
        "start_runtime",
        "stop_failed_runtime",
        "retain_failed_runtime",
        "retain_auxiliary_runtime",
        "restart_runtime",
      ].map((name) => [
        name,
        { intent: "not_saved", request: "not_issued", result: "unobserved" },
      ]),
    ),
    directories: Object.fromEntries(
      ["primary", "failed", "auxiliary"].map((name) => [
        name,
        {
          expected: null,
          source: { state: "unobserved", identity: null },
          retained: { state: "unobserved", identity: null },
        },
      ]),
    ),
    engine: "unobserved",
    stale: "unknown",
    hostSafety: "unknown",
    cleanup: "pending",
    cleanupFailure: null,
  });
}

/**
 * 公式CLI操作の取得からwx解放までを同じ修復要求で所有する。
 * @responsibility 必須通知完了前のEffectを止め、close後に最終候補を構築する。
 * @trace ARCH-000008
 * @boundary 実Filesystem／CLIは本番構成が接続する。依存差替えは内部試験だけ。
 */
export async function runRepairSessionWithDependencies(
  value: RepairInput,
  dependencies: Readonly<{
    acquire: (signal: AbortSignal) => Promise<DesktopAcquisition>;
    prepare: (
      desktop: DesktopOperations,
      nonce: string,
      signal: AbortSignal,
      canIssueEffect: () => boolean,
    ) => Promise<Readonly<{
      technical: Parameters<typeof executeRepairSteps>[1];
      cleanupFailure: () => "observation_cleanup_unknown" | null;
    }> | null>;
  }>,
): Promise<RepairResult> {
  const rejected: RepairResult = {
    preparation: "input_rejected",
    machine: null,
    lifecycle: null,
    checkpoint: null,
    finalCheckpointConfirmed: false,
  };
  const fields = repairData(value, [
    "operationNonce",
    "signal",
    "resume",
    "canIssueEffect",
    "onPrepared",
    "onCheckpoint",
  ]);
  if (
    !fields ||
    typeof fields.operationNonce !== "string" ||
    !/^[a-f0-9]{64}$/u.test(fields.operationNonce) ||
    types.isProxy(fields.signal) ||
    !(fields.signal instanceof AbortSignal) ||
    ![fields.canIssueEffect, fields.onPrepared, fields.onCheckpoint].every(
      (f) => typeof f === "function",
    )
  )
    return rejected;
  const resume =
    fields.resume === null ? null : decodeRepairCheckpoint(fields.resume);
  if (
    fields.resume !== null &&
    (resume?.cleanup !== "confirmed" ||
      resume.cleanupFailure !== null ||
      Object.values(resume.actions).some(
        (action) =>
          action.request === "unknown" ||
          action.result === "unknown" ||
          (action.intent === "saved" && action.result === "unobserved"),
      ))
  )
    return rejected;
  const input = fields as RepairInput;
  const signal = input.signal;
  let desktop: DesktopOperations | null = null;
  let cleanupConfirmed = true;
  let failure: NonNullable<RepairResult["lifecycle"]>["failure"] = null;
  let preparation: RepairResult["preparation"] = "boundary_unavailable";
  let machine: RepairMachineResult | null = null;
  let checkpoint: RepairCheckpoint | null = null;
  let observationCleanupFailure: "observation_cleanup_unknown" | null = null;
  let observeCleanup: (() => unknown) | null = null;
  const live = () =>
    !signal.aborted &&
    desktop !== null &&
    desktop.verify() &&
    confirmRepair(input.canIssueEffect) &&
    !signal.aborted &&
    desktop.verify();
  try {
    if (signal.aborted || !confirmRepair(input.canIssueEffect))
      failure = signal.aborted ? "cancelled" : "operations_unavailable";
    else {
      cleanupConfirmed = false;
      const acquired = await dependencies.acquire(signal);
      desktop = acquired.operations;
      cleanupConfirmed = acquired.cleanupConfirmed;
      if (!desktop || !cleanupConfirmed)
        failure = signal.aborted ? "cancelled" : "operations_unavailable";
      else if (live()) {
        const prepared = await dependencies.prepare(
          desktop,
          input.operationNonce,
          signal,
          live,
        );
        if (prepared) observeCleanup = prepared.cleanupFailure;
        if (prepared && live() && prepared.cleanupFailure() === null) {
          checkpoint = resume
            ? prepareRepairSessionCheckpoint(resume)
            : initialRepairCheckpoint();
          if (
            checkpoint &&
            live() &&
            confirmRepair(input.onPrepared, checkpoint)
          ) {
            preparation = "prepared";
            machine = await executeRepairSteps(
              {
                checkpoint,
                canIssueEffect: live,
                signal,
                onCheckpoint(next) {
                  checkpoint = decodeRepairCheckpoint(next);
                  if (
                    !live() ||
                    !checkpoint ||
                    !confirmRepair(input.onCheckpoint, checkpoint) ||
                    !live()
                  )
                    throw Error("repair_checkpoint_unconfirmed");
                },
              },
              prepared.technical,
            );
            checkpoint = decodeRepairCheckpoint(machine.checkpoint);
          }
        }
      }
    }
  } catch {
    failure = signal.aborted ? "cancelled" : "execution_failed";
  } finally {
    if (desktop) {
      try {
        cleanupConfirmed = (await desktop.close()) && cleanupConfirmed;
      } catch {
        cleanupConfirmed = false;
      }
    }
    if (observeCleanup) {
      try {
        if (observeCleanup() !== null)
          observationCleanupFailure = "observation_cleanup_unknown";
      } catch {
        observationCleanupFailure = "observation_cleanup_unknown";
      }
    }
    if (signal.aborted) failure ??= "cancelled";
  }
  if (checkpoint)
    checkpoint = decodeRepairCheckpoint({
      ...checkpoint,
      cleanup:
        cleanupConfirmed && observationCleanupFailure === null
          ? "confirmed"
          : "unknown",
      cleanupFailure:
        checkpoint.cleanupFailure ??
        observationCleanupFailure ??
        (cleanupConfirmed ? null : "operation_cleanup_unknown"),
    });
  return Object.freeze({
    preparation,
    machine,
    checkpoint,
    finalCheckpointConfirmed: false,
    lifecycle: { failure, cleanupConfirmed, observationCleanupFailure },
  });
}

/**
 * 修復Native子の生涯と、終了後の固定退避物回収・保持照合を所有する。
 * @packageDocumentation
 * @responsibility 元Sessionの取消・終了と、終了後の同Scope回収を分離する。
 * @trace ARCH-000008
 * @boundary 元Sessionは同子を回収し、終了後回収・保持照合は新Repair Sessionを取得しない。現在の許可と真正Writerは上位Ownerが所有する。
 */
import {
  decodeDockerRuntimeRepairCheckpoint as decode,
  dockerRuntimeRepairCheckpointIsSettled,
  type DockerRuntimeRepairCheckpoint as Checkpoint,
  type DockerRuntimeRepairRetentionTargets,
} from "../../../domain-model/src/index.ts";
import type {
  DockerDesktopRepairNativeHelperOutcome,
  DockerDesktopRepairNativeHelperSession,
  DockerDesktopRepairHelperReleaseOutcome,
} from "../../../platform-access/src/index.ts";
import { types } from "node:util";
import {
  dockerDesktopDistributionRoot,
  describeDockerRuntimeArtifactTrustContract,
} from "../docker-cli/trust.ts";
import { prepareDockerRuntimeRepairSessionCheckpoint } from "../../../domain-model/src/index.ts";
import { runDockerRuntimeRepairMachine } from "./repair.ts";
import { startDockerDesktopRepairHelper } from "../../../platform-access/src/index.ts";
import { createDockerDesktopRepairDirectoryAccess } from "./directory.ts";
import { createDockerDesktopRepairOperations } from "./repair-operations.ts";
import {
  observePlatformAccessArtifactCandidate,
  observeWindowsLocalAppDataDirectory,
  observeNativeArtifact,
} from "../../../platform-access/src/index.ts";

/**
 * 一回の修復準備と保存通知の内部入力。
 * @responsibility 初回取得と既存操作再入場の期待相関を分ける。
 * @trace ARCH-000008
 * @shape nonce、取消、再入場値、現在確認と二通知。
 * @invariant 相関Hashは処置許可や上位Ownerを証明しない。
 * @boundary 固定Sessionの公開入力。技術依存差替えは内部限定。
 * @security Path、任意命令、保存実装を含めない。
 * @compatibility 最新checkpointだけ。
 */
export type DockerRuntimeRepairInput = Readonly<{
  operationNonce: string;
  signal: AbortSignal;
  resume: Readonly<{
    ownerBindingSha256: string;
    scopeSha256: string;
    checkpoint: Checkpoint;
  }> | null;
  canIssueEffect: () => unknown;
  canRecordCheckpoint: () => unknown;
  onPrepared: (
    value: Readonly<{
      ownerBindingSha256: string;
      scopeSha256: string;
      checkpoint: Checkpoint;
    }>,
  ) => unknown;
  onCheckpoint: (value: Checkpoint) => unknown;
}>;

/**
 * 固定配布物・同じNative子・KnownFolderから修復Sessionを組み立てる。
 * @responsibility 任意の技術境界を受け取らず実Adapterへ接続する。
 * @trace ARCH-000008
 * @input value: 同exact操作の技術入力と保存確認。
 * @returns Native join後の技術結果と未保存候補。
 * @precondition 上位の真正Root・Revision・排他・意図保存は別途必要。
 * @postcondition 入力拒否時はArtifact観測・Native取得0、取得後拒否は同子abort／join。
 * @effect 固定Artifact観測、Repair Native取得、KnownFolderとScope観測、実修復。
 * @failure 準備不能は新処置0で停止し生Pathを返さない。
 * @invariant 同じArtifact値・H・nonce・Sessionを全接続で維持する。
 * @boundary 固定SessionだけをPackage Rootへ公開し、真正Writer／CLIは上位が接続する。
 * @security 環境変数・旧State Root・任意Pathへfallbackしない。
 * @concurrency Usingの入力検査後にだけ取得し、準備await後も現在許可を照合する。
 */
export async function runDockerRuntimeRepairSession(
  value: DockerRuntimeRepairInput,
) {
  let artifact: NonNullable<
    ReturnType<typeof observePlatformAccessArtifactCandidate>["artifact"]
  > | null = null;
  return runDockerRuntimeRepairSessionUsing(value, {
    acquire: async () => {
      const candidate = observePlatformAccessArtifactCandidate(
        dockerDesktopDistributionRoot,
      );
      if (candidate.status !== "candidate" || candidate.artifact === null)
        return Object.freeze({
          status: "unavailable" as const,
          session: null,
          ownerBindingSha256: null,
        });
      artifact = Object.freeze({ ...candidate.artifact });
      return startDockerDesktopRepairHelper(
        artifact,
        describeDockerRuntimeArtifactTrustContract().policySha256,
      );
    },
    prepare: async (session, owner, nonce, signal, live) => {
      if (!artifact || !live()) return null;
      const local = observeWindowsLocalAppDataDirectory();
      if (local === null || !live()) return null;
      const directories = createDockerDesktopRepairDirectoryAccess(
        local,
        nonce,
        owner,
        artifact.sha256,
      );
      if (
        !directories ||
        !live() ||
        (await session.verifyArtifacts()) !== "verified" ||
        !live() ||
        !directories.verify()
      )
        return null;
      return Object.freeze({
        scopeSha256: directories.scopeSha256,
        ...createDockerDesktopRepairOperations(
          session,
          directories,
          signal,
          live,
        ),
      });
    },
  });
}

/**
 * 終了済み修復の固定一用途を回収する入力。
 * @responsibility 元Hを相関だけに使い現在の処置許可と分離する。
 * @trace ARCH-000008
 * @shape 元nonce／H／Scope／checkpoint、用途、取消、保存意図を含む現在確認。
 * @invariant Path・代替Adapter・新Sessionを受け取らない。
 * @boundary 上位保存Ownerと固定回収composition。
 * @security canIssueEffectは同用途の意図保存・読戻し・排他解放も確認する。
 * @compatibility 現行の終了済み修復だけ。
 */
export type DockerRuntimeRepairDisposalInput = Readonly<{
  operationNonce: string;
  ownerBindingSha256: string;
  scopeSha256: string;
  checkpoint: Checkpoint;
  purpose: "primary" | "failed" | "auxiliary";
  signal: AbortSignal;
  canIssueEffect: () => unknown;
}>;

/**
 * 元修復の終了後、同じ固定対象だけを回収へ接続する。
 * @responsibility 元Scopeのfresh一致と用途の保存意図確認後だけ物理回収する。
 * @trace ARCH-000008
 * @input value: 元修復相関、終了checkpoint、固定用途と現在Owner確認。
 * @returns 今回要求の到達と現在不存在。保存確定は返さない。
 * @precondition 上位が同exact操作の回収判断・用途意図の保存と解放を確認済み。
 * @postcondition 元checkpointを変更せず、新Repair Native Sessionを取得しない。
 * @effect 固定Artifact／KnownFolder／Scope読取り、条件成立時だけ旧target回収。
 * @failure 入力・終了・Scope・現在許可不明はDriver0。部分処置はunknownを保持。
 * @invariant 元H・保存値だけで現在Authorityを復元しない。
 * @boundary 固定公開composition→内部factory／Driver。真正Writerは上位所有。
 * @security 任意Path・Command・新Store／Lock・再起動を提供しない。
 * @concurrency Driver待機後にもArtifact・Scope・取消・現在Ownerを再確認する。
 */
export async function disposeDockerRuntimeRepairDirectory(
  value: DockerRuntimeRepairDisposalInput,
) {
  let handedOff = false;
  const unavailable = Object.freeze({
    request: "not_issued",
    absence: "unknown",
  } as const);
  try {
    const fields = repairData(value, [
      "operationNonce",
      "ownerBindingSha256",
      "scopeSha256",
      "checkpoint",
      "purpose",
      "signal",
      "canIssueEffect",
    ]);
    const checkpoint = decode(fields?.checkpoint);
    if (
      !fields ||
      !checkpoint ||
      ![
        fields.operationNonce,
        fields.ownerBindingSha256,
        fields.scopeSha256,
      ].every(
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
      !dockerRuntimeRepairCheckpointIsSettled(checkpoint) ||
      fields.signal.aborted ||
      !confirmRepair(fields.canIssueEffect)
    )
      return unavailable;
    const signal = fields.signal;
    const artifact = observeNativeArtifact(dockerDesktopDistributionRoot);
    if (!artifact || signal.aborted || !confirmRepair(fields.canIssueEffect))
      return unavailable;
    const local = observeWindowsLocalAppDataDirectory();
    if (local === null) return unavailable;
    const directories = createDockerDesktopRepairDirectoryAccess(
      local,
      fields.operationNonce,
      fields.ownerBindingSha256,
      artifact.artifact.sha256,
    );
    if (!directories || directories.scopeSha256 !== fields.scopeSha256)
      return unavailable;
    const purpose = fields.purpose as "primary" | "failed" | "auxiliary";
    handedOff = true;
    return await directories.dispose(
      purpose === "primary" ? "initial" : purpose,
      checkpoint.directories[purpose].expected,
      () =>
        !signal.aborted &&
        observeNativeArtifact(
          dockerDesktopDistributionRoot,
          artifact.identitySha256,
        ) !== null &&
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
 * @input value: 元nonce／H／Scope、終端checkpoint、取消、同期現在確認。
 * @returns 全三用途を二読取りした凍結照合値、または失敗のnull。
 * @precondition 上位が明示保持の意思と同じ現在操作を確認する。
 * @postcondition 入力を変更せず、新Repair Native Sessionを取得しない。
 * @effect 固定Artifact・KnownFolder・Scope・固定三対象の読取りだけ。
 * @failure 元結果不正、失効、観測差、保持物消失は全体null。
 * @invariant 用途内nullは元から保持不要かつ二回の明示不存在だけ。
 * @boundary 固定公開読取り→既存Directory factory。保存・期限・終了は上位所有。
 * @security 任意Path・依存差替え・削除・再起動・保存能力を公開しない。
 * @concurrency 各読取り前後に同じ取消・Owner・Artifact・Scopeを再確認する。
 */
export function observeDockerRuntimeRepairRetention(
  value: Readonly<{
    operationNonce: string;
    ownerBindingSha256: string;
    scopeSha256: string;
    checkpoint: Checkpoint;
    signal: AbortSignal;
    canObserve: () => unknown;
  }>,
): DockerRuntimeRepairRetentionTargets | null {
  try {
    const fields = repairData(value, [
      "operationNonce",
      "ownerBindingSha256",
      "scopeSha256",
      "checkpoint",
      "signal",
      "canObserve",
    ]);
    const checkpoint = decode(fields?.checkpoint);
    if (
      !fields ||
      !checkpoint ||
      ![
        fields.operationNonce,
        fields.ownerBindingSha256,
        fields.scopeSha256,
      ].every(
        (hash) => typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash),
      ) ||
      types.isProxy(fields.signal) ||
      !(fields.signal instanceof AbortSignal) ||
      checkpoint.cleanup !== "confirmed" ||
      checkpoint.cleanupFailure !== null ||
      checkpoint.engine !== "ready" ||
      checkpoint.hostSafety !== "safe" ||
      checkpoint.stale !== "retained" ||
      !dockerRuntimeRepairCheckpointIsSettled(checkpoint) ||
      fields.signal.aborted ||
      !confirmRepair(fields.canObserve)
    )
      return null;
    const signal = fields.signal;
    const artifact = observeNativeArtifact(dockerDesktopDistributionRoot);
    if (!artifact || signal.aborted || !confirmRepair(fields.canObserve))
      return null;
    const local = observeWindowsLocalAppDataDirectory();
    if (local === null) return null;
    const access = createDockerDesktopRepairDirectoryAccess(
      local,
      fields.operationNonce,
      fields.ownerBindingSha256,
      artifact.artifact.sha256,
    );
    if (!access || access.scopeSha256 !== fields.scopeSha256) return null;
    const targets: {
      -readonly [P in keyof DockerRuntimeRepairRetentionTargets]: DockerRuntimeRepairRetentionTargets[P];
    } = { primary: null, failed: null, auxiliary: null };
    for (let pass = 0; pass < 2; pass++) {
      for (const purpose of ["primary", "failed", "auxiliary"] as const) {
        if (
          signal.aborted ||
          !confirmRepair(fields.canObserve) ||
          !observeNativeArtifact(
            dockerDesktopDistributionRoot,
            artifact.identitySha256,
          ) ||
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
          !observeNativeArtifact(
            dockerDesktopDistributionRoot,
            artifact.identitySha256,
          ) ||
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
 * 保存確認を同期trueだけに限定する。
 * @responsibility 非同期確認を保存・発行許可へ変換しない。
 * @trace ARCH-000008
 * @input callback: 内部用途を固定した通知、value: 通知値。
 * @returns 同期trueのみ。
 * @precondition callback用途は同呼出しで固定。
 * @postcondition Promise拒否を消費しthenableは実行しない。
 * @effect 同期callback一回。
 * @failure 不正関数・例外・非trueはfalse。
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
    return result === true;
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
 * @precondition Native子取得後の準備通知だけで使用。
 * @postcondition 全処置・実体が未観測。
 * @effect N/A: 値生成。
 * @failure 内部固定値不正はnull。
 * @invariant 未観測を不存在へ補完しない。
 * @boundary 初回準備と保存Owner。
 * @security 実行Authorityを持たない。
 * @concurrency N/A: 共有状態なし。
 */
function initialRepairCheckpoint() {
  return decode({
    actions: Object.fromEntries(
      [
        "stop_runtime",
        "terminate_runtime",
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
 * 同じNative子、準備保存、実Machineを内部で接続する。
 * @responsibility 保存拒否前の処置0と、join後の未保存候補を分離する。
 * @trace ARCH-000008
 * @input value: 固定入力、dependencies: DI内部の取得・準備境界。
 * @returns 準備分類、実Machine結果、Native結果と未保存checkpoint候補。
 * @precondition 上位のRoot・改訂・排他・未終端確認は別途必要。
 * @postcondition join後のcallback 0、最終候補は未保存として返す。
 * @effect 内部取得、準備、保存通知、実Machine、同子回収。
 * @failure 入力拒否・準備拒否・Native失敗を別々に返す。
 * @invariant cleanupだけをjoin結果で更新しMachine一次結果を変更しない。
 * @boundary DI内部依存接続。技術依存は固定wrapperが組み立て、真正保存Ownerは上位が所有する。
 * @security 任意AdapterをRoot公開しない。
 * @concurrency await前後と通知後に生存・取消・現在許可を照合する。
 */
export async function runDockerRuntimeRepairSessionUsing(
  value: DockerRuntimeRepairInput,
  dependencies: Readonly<{
    acquire: () => Promise<DockerDesktopRepairNativeHelperOutcome>;
    prepare: (
      session: DockerDesktopRepairNativeHelperSession,
      owner: string,
      nonce: string,
      signal: AbortSignal,
      canIssueEffect: () => boolean,
    ) => Promise<Readonly<{
      scopeSha256: string;
      technical: Parameters<typeof runDockerRuntimeRepairMachine>[1];
      cleanupFailure: () => "observation_cleanup_unknown" | null;
    }> | null>;
  }>,
): Promise<
  Readonly<{
    preparation:
      | "input_rejected"
      | "boundary_unavailable"
      | "correlation_mismatch"
      | "prepared";
    machine: Awaited<ReturnType<typeof runDockerRuntimeRepairMachine>> | null;
    lifecycle: Readonly<{
      failure: RepairSessionResult<unknown>["failure"];
      cleanup: DockerDesktopRepairHelperReleaseOutcome;
      observationCleanupFailure: "observation_cleanup_unknown" | null;
    }> | null;
    checkpoint: Checkpoint | null;
    finalCheckpointConfirmed: false;
    ownerBindingSha256: string | null;
    scopeSha256: string | null;
  }>
> {
  type MachineResult = Awaited<
    ReturnType<typeof runDockerRuntimeRepairMachine>
  >;
  let preparation:
    | "input_rejected"
    | "boundary_unavailable"
    | "correlation_mismatch"
    | "prepared" = "input_rejected";
  let savedCheckpoint: Checkpoint | null = null;
  let ownerBindingSha256: string | null = null;
  let scopeSha256: string | null = null;
  let observationCleanupFailure: "observation_cleanup_unknown" | null = null;
  let inspectObservationCleanup: (() => unknown) | null = null;
  /**
   * 同じAdapterの観測回収不明をstickyに捕捉する。
   * @responsibility 後着Native成功で観測失敗を消さない。
   * @trace ARCH-000008
   * @input N/A: prepareが固定した局所値Readerだけ。
   * @returns N/A: 呼出し内の固定失敗値を更新する。
   * @precondition Readerは新観測や処置を行わない。
   * @postcondition 一度不明なら同呼出しで解除しない。
   * @effect メモリ内Readerだけ。
   * @failure 不正関数・非同期・throwは観測回収不明。
   * @invariant 既保存失敗より強い優先順位を持たない。
   * @boundary Adapterとruntimeの最終統合。
   * @security 任意のthenableを実行しない。
   * @concurrency awaitせずjoin後も値だけを読む。
   */
  function recordObservationCleanup() {
    if (
      inspectObservationCleanup === null ||
      observationCleanupFailure !== null
    )
      return;
    try {
      if (
        types.isProxy(inspectObservationCleanup) ||
        types.isAsyncFunction(inspectObservationCleanup)
      )
        throw new Error();
      const result = inspectObservationCleanup();
      if (types.isPromise(result))
        void Promise.prototype.then.call(
          result,
          () => undefined,
          () => undefined,
        );
      if (result !== null)
        observationCleanupFailure = "observation_cleanup_unknown";
    } catch {
      observationCleanupFailure = "observation_cleanup_unknown";
    }
  }
  const fields = repairData(value, [
    "operationNonce",
    "signal",
    "resume",
    "canIssueEffect",
    "canRecordCheckpoint",
    "onPrepared",
    "onCheckpoint",
  ]);
  let input: DockerRuntimeRepairInput | null = null;
  if (
    fields &&
    typeof fields.operationNonce === "string" &&
    /^[a-f0-9]{64}$/u.test(fields.operationNonce) &&
    !types.isProxy(fields.signal) &&
    fields.signal instanceof AbortSignal &&
    [
      fields.canIssueEffect,
      fields.canRecordCheckpoint,
      fields.onPrepared,
      fields.onCheckpoint,
    ].every((callback) => typeof callback === "function")
  ) {
    let resume: DockerRuntimeRepairInput["resume"] = null;
    if (fields.resume !== null) {
      const prior = repairData(fields.resume, [
        "ownerBindingSha256",
        "scopeSha256",
        "checkpoint",
      ]);
      const checkpoint = decode(prior?.checkpoint);
      if (
        prior &&
        checkpoint &&
        [prior.ownerBindingSha256, prior.scopeSha256].every(
          (hash) => typeof hash === "string" && /^[a-f0-9]{64}$/u.test(hash),
        ) &&
        checkpoint.cleanup === "confirmed" &&
        checkpoint.cleanupFailure === null &&
        Object.values(checkpoint.actions).every(
          (action) =>
            action.request !== "unknown" &&
            action.result !== "unknown" &&
            !(action.intent === "saved" && action.result === "unobserved"),
        )
      ) {
        resume = Object.freeze({
          ownerBindingSha256: prior.ownerBindingSha256 as string,
          scopeSha256: prior.scopeSha256 as string,
          checkpoint,
        });
      } else
        return Object.freeze({
          preparation,
          machine: null,
          lifecycle: null,
          checkpoint: null,
          finalCheckpointConfirmed: false as const,
          ownerBindingSha256,
          scopeSha256,
        });
    }
    input = Object.freeze({ ...fields, resume }) as DockerRuntimeRepairInput;
  }
  if (!input)
    return Object.freeze({
      preparation,
      machine: null,
      lifecycle: null,
      checkpoint: null,
      finalCheckpointConfirmed: false as const,
      ownerBindingSha256,
      scopeSha256,
    });
  const captured = input;
  preparation = "boundary_unavailable";
  if (captured.signal.aborted || !confirmRepair(captured.canIssueEffect))
    return Object.freeze({
      preparation,
      machine: null,
      lifecycle: null,
      checkpoint: null,
      finalCheckpointConfirmed: false as const,
      ownerBindingSha256,
      scopeSha256,
    });
  const lifecycle = await ownDockerRepairNativeSession<MachineResult | null>(
    captured.signal,
    dependencies.acquire,
    async (session, owner, signal) => {
      /**
       * 同じ子と現在の処置許可を再照合する。
       * @responsibility awaitと保存通知後の失効を止める。
       * @trace ARCH-000008
       * @input N/A: 捕捉済み子・signal・確認。
       * @returns 三条件すべて成立時だけtrue。
       * @precondition Native取得済み。
       * @postcondition 生存不明は許可しない。
       * @effect 固定生存と現在許可の確認。
       * @failure 失効・取消はfalse。
       * @invariant Hashから許可を作らない。
       * @boundary 準備とMachine開始。
       * @security 新Authorityなし。
       * @concurrency 同期確認。
       */
      const live = () => {
        if (signal.aborted || !session.assertLive()) return false;
        const allowed = confirmRepair(captured.canIssueEffect);
        return allowed && session.assertLive() && !signal.aborted;
      };
      if (!live()) return { value: null, abortRequired: true };
      const prepared = await dependencies.prepare(
        session,
        owner,
        captured.operationNonce,
        signal,
        live,
      );
      if (prepared) {
        inspectObservationCleanup = prepared.cleanupFailure;
        recordObservationCleanup();
      }
      if (
        !live() ||
        !prepared ||
        observationCleanupFailure !== null ||
        typeof prepared.scopeSha256 !== "string" ||
        !/^[a-f0-9]{64}$/u.test(prepared.scopeSha256)
      )
        return { value: null, abortRequired: true };
      if (
        captured.resume &&
        (captured.resume.ownerBindingSha256 !== owner ||
          captured.resume.scopeSha256 !== prepared.scopeSha256)
      ) {
        preparation = "correlation_mismatch";
        return { value: null, abortRequired: true };
      }
      ownerBindingSha256 = owner;
      scopeSha256 = prepared.scopeSha256;
      const checkpoint = captured.resume
        ? prepareDockerRuntimeRepairSessionCheckpoint(
            captured.resume.checkpoint,
          )
        : initialRepairCheckpoint();
      if (
        !checkpoint ||
        !live() ||
        !confirmRepair(captured.canRecordCheckpoint) ||
        !live() ||
        !confirmRepair(
          captured.onPrepared,
          Object.freeze({ ownerBindingSha256: owner, scopeSha256, checkpoint }),
        )
      )
        return { value: null, abortRequired: true };
      savedCheckpoint = checkpoint;
      preparation = "prepared";
      if (!live()) return { value: null, abortRequired: true };
      const machine = await runDockerRuntimeRepairMachine(
        {
          checkpoint,
          signal,
          canIssueEffect: live,
          canRecordCheckpoint: captured.canRecordCheckpoint,
          onCheckpoint: captured.onCheckpoint,
        },
        prepared.technical,
      );
      recordObservationCleanup();
      return {
        value: machine,
        abortRequired:
          !machine.checkpointConfirmed ||
          observationCleanupFailure !== null ||
          machine.status === "failed" ||
          machine.status === "cancelled",
      };
    },
  );
  recordObservationCleanup();
  const machine = lifecycle.value;
  const last = machine ? decode(machine.checkpoint) : savedCheckpoint;
  const checkpoint = last
    ? decode({
        ...last,
        cleanup:
          observationCleanupFailure !== null
            ? "unknown"
            : lifecycle.cleanup.cleanup,
        cleanupFailure:
          last.cleanupFailure ??
          observationCleanupFailure ??
          (lifecycle.cleanup.cleanup === "unknown"
            ? "helper_cleanup_unknown"
            : lifecycle.cleanup.protocol === "failed"
              ? "helper_protocol_failed"
              : null),
      })
    : null;
  return Object.freeze({
    preparation,
    machine,
    lifecycle: Object.freeze({
      failure: lifecycle.failure,
      cleanup: lifecycle.cleanup,
      observationCleanupFailure,
    }),
    checkpoint,
    finalCheckpointConfirmed: false as const,
    ownerBindingSha256,
    scopeSha256,
  });
}

/**
 * 修復実行とNative回収の個別結果。
 * @responsibility 一次結果を回収失敗で上書きしない。
 * @trace ARCH-000008
 * @shape 実行値、停止理由、回収分類。
 * @invariant valueの存在を回収成功へ読み替えない。
 * @boundary 内部の修復composition。
 * @security Sessionと秘密値を返さない。
 * @compatibility Root非公開。
 */
type RepairSessionResult<T> = Readonly<{
  value: T | null;
  failure:
    | "cancelled"
    | "helper_unavailable"
    | "helper_failed"
    | "execution_failed"
    | null;
  cleanup: DockerDesktopRepairHelperReleaseOutcome;
}>;

/**
 * 用途固定の修復実行を同じNative子の生涯内へ閉じる。
 * @responsibility 遅延取得、取消、Native喪失、正常終了の全経路でjoinする。
 * @trace ARCH-000008
 * @input signal: 人間取消。acquire: 内部固定取得。execute: 同じ子へ固定する内部修復。
 * @returns 一次結果と回収結果の不変値。
 * @precondition 呼出し側が入力・Scope・現在Ownerを取得前に検査済み。
 * @postcondition 取得した子のclose完了を待ち、通知購読を解除して返す。
 * @effect 固定取得、内部修復、同じ子のabortまたはrelease。
 * @failure 取得throw・Native失敗・実行throw・回収不明を分離する。
 * @invariant Native失敗を人間取消として返さず、closeの再試行をしない。
 * @boundary DI内部の試験可能な取得・生涯管理。任意処理をRootへ公開しない。
 * @security 生Sessionを上位Consumerへ渡さない。
 * @concurrency 取消中の遅延取得も待ち、終了後の通知を無効化する。
 */
export async function ownDockerRepairNativeSession<T>(
  signal: AbortSignal,
  acquire: () => Promise<DockerDesktopRepairNativeHelperOutcome>,
  execute: (
    session: DockerDesktopRepairNativeHelperSession,
    ownerBindingSha256: string,
    signal: AbortSignal,
  ) => Promise<Readonly<{ value: T; abortRequired: boolean }>>,
): Promise<RepairSessionResult<T>> {
  const controller = new AbortController();
  let ended = false;
  let stopReason: "cancelled" | "helper_failed" | null = null;
  let unsubscribe: (() => void) | null = null;
  let session: DockerDesktopRepairNativeHelperSession | null = null;
  let closePromise: Promise<DockerDesktopRepairHelperReleaseOutcome> | null =
    null;
  let value: T | null = null;
  let failure: RepairSessionResult<T>["failure"] = null;
  let abortRequired = true;
  let cleanup: DockerDesktopRepairHelperReleaseOutcome = Object.freeze({
    cleanup: "confirmed",
    protocol: "not_applicable",
  });
  /**
   * 人間取消だけを内部signalへ搬送する。
   * @responsibility 終了後の通知を無効化する。
   * @trace ARCH-000008
   * @input N/A: 捕捉済みsignal。
   * @returns N/A: 通知のみ。
   * @precondition 実行中だけ有効。
   * @postcondition 新処置を停止する。
   * @effect 内部signalのabort。
   * @failure N/A: 状態通知のみ。
   * @invariant Native失敗分類を変更しない。
   * @boundary 外部取消と内部Machine。
   * @security Authorityを生成しない。
   * @concurrency ended後はEffect 0。
   */
  function cancel() {
    if (!ended) {
      stopReason ??= "cancelled";
      controller.abort();
    }
  }
  /**
   * Native喪失を人間取消と区別して停止する。
   * @responsibility 同じ子の失敗だけを記録する。
   * @trace ARCH-000008
   * @input N/A: 用途固定購読。
   * @returns N/A: 内部状態更新のみ。
   * @precondition session取得済み。
   * @postcondition 後続処置を停止する。
   * @effect 内部signalのabort。
   * @failure N/A: 固定通知。
   * @invariant ended後に結果を変更しない。
   * @boundary Native生存と修復実行。
   * @security 生出力を保存しない。
   * @concurrency 同期通知にも対応する。
   */
  function failNative() {
    if (!ended) {
      stopReason ??= "helper_failed";
      controller.abort();
    }
  }
  signal.addEventListener("abort", cancel, { once: true });
  try {
    if (signal.aborted) {
      cancel();
      failure = stopReason;
    } else {
      const acquired = await acquire();
      session = acquired.session;
      if (
        acquired.status !== "acquired" ||
        !session ||
        !acquired.ownerBindingSha256 ||
        !/^[a-f0-9]{64}$/u.test(acquired.ownerBindingSha256)
      ) {
        failure = stopReason ?? "helper_unavailable";
        cleanup = Object.freeze({
          cleanup:
            acquired.status === "cleanup_unknown" ||
            acquired.status === "acquired"
              ? "unknown"
              : "confirmed",
          protocol:
            acquired.status === "protocol_failed" ? "failed" : "not_applicable",
        });
      } else {
        unsubscribe = session.onFailureDetected(failNative);
        if (!session.assertLive()) failNative();
        if (!controller.signal.aborted) {
          const executed = await execute(
            session,
            acquired.ownerBindingSha256,
            controller.signal,
          );
          value = executed.value;
          abortRequired = executed.abortRequired;
        }
        failure = stopReason;
      }
    }
  } catch {
    failure ??= stopReason ?? "execution_failed";
    if (!session)
      cleanup = Object.freeze({
        cleanup: "unknown",
        protocol: "not_applicable",
      });
  } finally {
    if (session) {
      try {
        closePromise ??=
          abortRequired || controller.signal.aborted || failure !== null
            ? session.abort()
            : session.release();
        cleanup = await closePromise;
      } catch {
        cleanup = Object.freeze({ cleanup: "unknown", protocol: "failed" });
      }
      failure ??= stopReason;
    }
    ended = true;
    signal.removeEventListener("abort", cancel);
    try {
      unsubscribe?.();
    } catch {
      cleanup = Object.freeze({ cleanup: "unknown", protocol: "failed" });
    }
    unsubscribe = null;
    session = null;
  }
  return Object.freeze({
    value,
    failure,
    cleanup: Object.freeze({ ...cleanup }),
  });
}

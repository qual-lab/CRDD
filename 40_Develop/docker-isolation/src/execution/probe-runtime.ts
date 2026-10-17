/**
 * 固定診断profileの確認・作成・実行・取消の技術境界を所有する。
 * @packageDocumentation
 * @responsibility 固定payload・期限・所有Handle終端を集約し、上位の保存を跨いで実行を自動開始しない。
 * @trace ARCH-000008
 * @boundary Coordinatorのprofile選択と固定Docker要求。
 */
import {
  executeDockerProbeCommand,
  planDockerProbeCommand,
} from "./probe-command.ts";
import {
  classifyDockerProbeCancellation,
  classifyDockerProbeExecution,
  normalizeContainerCreation,
} from "./probe-result.ts";
import { inspectDockerProbeContainer } from "./probe-container.ts";
import {
  startDockerProbeAttachedProcess,
  type DockerAttachedProcess,
} from "./attached-process.ts";
import type { CommandExecution } from "./command-result.ts";
import { types as utilTypes } from "node:util";
import fs from "node:fs";
import path from "node:path";
import {
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "./cli-trust.ts";
import { createDockerCliEnvironment } from "./cli-environment.ts";

/**
 * 固定診断の選択名。
 * @responsibility 通常診断・四故障・取消の閉集合を定義する。
 * @trace ARCH-000008
 * @shape 六つの固定文字列。
 * @invariant 任意payloadやtimeoutを入力にしない。
 * @boundary 上位の試験選択と下位技術構成。
 * @security 選択名自体は実行許可ではない。
 * @compatibility 既存の四故障名を維持する。
 */
export type DockerProbeProfile =
  | "normal"
  | "timeout"
  | "output_limit"
  | "invalid_output"
  | "nonzero_exit"
  | "cancellation";

/**
 * 固定要求が借用する既存CLI・環境の確認。
 * @responsibility Host記録・保存Ownerを受け取らない。
 * @trace ARCH-000008
 * @shape 既存固定同期要求と同じBinding。
 * @invariant 新しい管理状態を作らない。
 * @boundary 実行直前のCLIと環境。
 * @security この型からAuthorityを発行しない。
 * @compatibility 既存要求のCLI再確認を維持する。
 */
type ProbeBinding = Parameters<typeof executeDockerProbeCommand>[0];

/**
 * Probeの同操作CLIと固定環境を構成する。
 * @responsibility OS差とCLI同一性を下位に閉じ、上位の同期所在読取りを一回だけ接続する。
 * @trace ARCH-000008
 * @input readManagement: 検証済みmanagementの同期読取り。
 * @returns 同じsnapshotを各要求前に検証する固定binding。
 * @precondition 上位がHost所有と各Effect前のMount現在性を確認する。
 * @postcondition readManagementと上位Capabilityを返却closureへ保持しない。
 * @effect CLI実体を観測し、検証済みmanagement内の固定二領域を作成する。
 * @failure platform、CLI、所在、環境の順で拒否し、読取り例外は元の理由を維持する。
 * @invariant 新しいRegistry・Lock・回復状態・実行Authorityを生成しない。
 * @boundary 上位の所在観測と下位の固定Docker要求。
 * @security 任意CLI・環境・platform・Process primitiveを入力にしない。
 * @concurrency 同期生成し、要求ごとに同snapshotをfresh検証する。
 */
export function createDockerProbeRuntimeBinding(
  readManagement: () => string,
): ProbeBinding {
  if (process.platform !== "win32")
    throw new Error("docker_backend_platform_unsupported");
  let snapshot: ReturnType<typeof observeTrustedDockerCli>;
  try {
    snapshot = observeTrustedDockerCli();
  } catch {
    throw new Error("docker_cli_untrusted");
  }
  const management = readManagement();
  if (utilTypes.isPromise(management))
    void Promise.prototype.then.call(management, undefined, () => undefined);
  if (
    typeof management !== "string" ||
    !management ||
    !path.isAbsolute(management) ||
    path.resolve(management) !== management
  )
    throw new Error("owned_operation_mount_replaced");
  const dockerConfig = path.join(management, "docker-config");
  const dockerHome = path.join(management, "docker-home");
  fs.mkdirSync(dockerConfig, { recursive: true });
  fs.mkdirSync(dockerHome, { recursive: true });
  const environment = createDockerCliEnvironment({ dockerConfig, dockerHome });
  if (!environment) throw new Error("docker_runtime_environment_unavailable");
  return Object.freeze({
    verifyCli: () => {
      try {
        return verifyTrustedDockerCliSnapshot(snapshot);
      } catch {
        throw new Error("docker_cli_untrusted");
      }
    },
    environment: () => environment,
  });
}

/**
 * 現在性確認から受ける三つの借用Path。
 * @responsibility 上位の保存・Host能力を含めず所在だけを搬送する。
 * @trace ARCH-000008
 * @shape workspace、providerHome、tmpの三文字列。
 * @invariant 同じ実行の途中でPath集合を拡張しない。
 * @boundary 上位の現在性確認と下位の構成観測。
 * @security Path利用権限は上位が確認する。
 * @compatibility 既存三mountだけを維持する。
 */
type ProbeMounts = Readonly<{
  workspace: string;
  providerHome: string;
  tmp: string;
}>;

/**
 * 現在性確認の同期返値を捕捉し初期三Pathとの一致を確認する。
 * @responsibility Promise・Proxy・accessor・欠測を成功にしない。
 * @trace ARCH-000008
 * @input value: 同期三Path、baseline: 初回捕捉値。
 * @returns 凍結した三Path。
 * @precondition callbackの利用権限判定は上位が実施する。
 * @postcondition 初回以外のPath差では後続要求を止める。
 * @effect N/A: 値の検査だけ。
 * @failure 不正・差替えはowned_operation_mount_replaced。
 * @invariant getterを呼ばずown dataだけを読む。
 * @boundary 上位読取りと固定inspect期待値。
 * @security Pathや例外本文を返さない。
 * @concurrency await後は毎回新しい値を検査する。
 */
function captureCurrentProbeMounts(
  value: unknown,
  baseline?: ProbeMounts,
): ProbeMounts {
  if (
    !value ||
    typeof value !== "object" ||
    utilTypes.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null)
  )
    throw new Error("owned_operation_mount_replaced");
  const keys = ["workspace", "providerHome", "tmp"] as const;
  if (Reflect.ownKeys(value).length !== keys.length)
    throw new Error("owned_operation_mount_replaced");
  const captured = Object.create(null) as Record<(typeof keys)[number], string>;
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      !descriptor ||
      !Object.hasOwn(descriptor, "value") ||
      typeof descriptor.value !== "string" ||
      !descriptor.value ||
      (baseline && descriptor.value !== baseline[key])
    )
      throw new Error("owned_operation_mount_replaced");
    captured[key] = descriptor.value;
  }
  return Object.freeze(captured);
}

/**
 * 一つの所有Promiseを期限まで待ち監視Timerを必ず解除する。
 * @responsibility 期限後の通知で確定済み結果を巻き戻さない。
 * @trace ARCH-000008
 * @input promise、timeoutMs、fallback: 固定技術群が決める値。
 * @returns 期限内結果または固定代替値。
 * @precondition 対象Handleのjoin責任は呼出し元に残る。
 * @postcondition Timerを残さない。
 * @effect 有界Timerを一件登録する。
 * @failure Promise拒否は呼出し元の失敗処置へ伝播。
 * @invariant timeoutをProcess終了証明にしない。
 * @boundary ローカル待機と所有Process観測。
 * @security 新しい処置Authorityを作らない。
 * @concurrency 一回のraceとfinally解除。
 */
async function awaitProbeObservation<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * 固定取消の失敗を許可済み理由だけへ限定する。
 * @responsibility callbackやCLI例外の本文を公開しない。
 * @trace ARCH-000008
 * @input error: 観測した失敗。
 * @returns 既存取消理由または固定一般理由。
 * @precondition 技術群内のcatchで使う。
 * @postcondition 未知例外を成功にしない。
 * @effect N/A: 値分類だけ。
 * @failure N/A: 未知値は一般理由へ分類する。
 * @invariant candidateは例外理由として受理しない。
 * @boundary 内部失敗と閉じた診断。
 * @security 例外本文・Pathは返さない。
 * @concurrency 同期分類だけ。
 */
function probeCancellationFailure(error: unknown): string {
  const known = new Set([
    "docker_backend_platform_unsupported",
    "docker_cli_untrusted",
    "docker_container_identity_unknown",
    "docker_container_security_profile_mismatch",
    "dynamic_fake_provider_cancellation_ready_unconfirmed",
    "dynamic_fake_provider_cancellation_not_requested",
    "dynamic_fake_provider_cancellation_grace_exceeded",
    "dynamic_fake_provider_cancellation_acknowledgement_invalid",
    "dynamic_fake_provider_cancellation_termination_invalid",
    "owned_operation_mount_identity_required",
    "owned_operation_mount_capability_required",
    "owned_operation_mount_replaced",
  ]);
  const message =
    error && typeof error === "object"
      ? Object.getOwnPropertyDescriptor(error, "message")?.value
      : null;
  return typeof message === "string" && known.has(message)
    ? message
    : "dynamic_fake_provider_cancellation_verification_failed";
}

const PROBE_MARKER = "crdd-coordinator-isolation-v1";
const NORMAL_SOURCE = `
import json, os, pathlib, socket, sys
result={"marker":"${PROBE_MARKER}","allowed_writes":{},"runtime_paths_absent":True,"credential_names_absent":True,"network_blocked":False,"home_isolated":False,"tmp_isolated":False}
for name in ("workspace","provider-home","tmp"):
    target=pathlib.Path("/operation")/name/".coordinator-probe"
    try:
        target.write_text(name,encoding="utf-8"); result["allowed_writes"][name]=target.read_text(encoding="utf-8")==name; target.unlink()
    except Exception: result["allowed_writes"][name]=False
result["runtime_paths_absent"]=all(not pathlib.Path("/runtime",name).exists() for name in ("events","projection","management"))
credential_names={"ANTHROPIC_API_KEY","CLAUDE_CODE_OAUTH_TOKEN","CODEX_API_KEY","CODEX_ACCESS_TOKEN","GH_TOKEN","GITHUB_TOKEN","GIT_ASKPASS","OPENAI_API_KEY","SSH_AUTH_SOCK"}
result["credential_names_absent"]=credential_names.isdisjoint(os.environ)
result["home_isolated"]=os.environ.get("HOME")=="/operation/provider-home"
result["tmp_isolated"]=os.environ.get("TMPDIR")=="/operation/tmp"
sock=socket.socket(socket.AF_INET,socket.SOCK_STREAM); sock.settimeout(0.5)
try: sock.connect(("1.1.1.1",443))
except OSError: result["network_blocked"]=True
finally: sock.close()
print(json.dumps(result,separators=(",",":")))
sys.exit(0 if all(result["allowed_writes"].values()) and all([result["runtime_paths_absent"],result["credential_names_absent"],result["network_blocked"],result["home_isolated"],result["tmp_isolated"]]) else 3)
`;
const CANCELLATION_SOURCE = `
import json, signal, sys, time
marker="crdd-coordinator-cancellation-v1"
def cancelled(_signal,_frame):
    print(json.dumps({"marker":marker,"state":"cancelled"},separators=(",",":")),flush=True)
    sys.exit(42)
signal.signal(signal.SIGTERM,cancelled)
print(json.dumps({"marker":marker,"state":"ready"},separators=(",",":")),flush=True)
while True: time.sleep(0.05)
`;
const PROFILES = Object.freeze({
  normal: Object.freeze({ source: NORMAL_SOURCE, timeoutMs: 30_000 }),
  timeout: Object.freeze({
    source: "import time; time.sleep(2)",
    timeoutMs: 250,
  }),
  output_limit: Object.freeze({
    source: "print('x'*70000)",
    timeoutMs: 10_000,
  }),
  invalid_output: Object.freeze({
    source: "print('not-json')",
    timeoutMs: 10_000,
  }),
  nonzero_exit: Object.freeze({
    source: "import sys; sys.exit(7)",
    timeoutMs: 10_000,
  }),
  cancellation: Object.freeze({
    source: CANCELLATION_SOURCE,
    timeoutMs: 5_000,
  }),
} satisfies Record<
  DockerProbeProfile,
  Readonly<{ source: string; timeoutMs: number }>
>);

/**
 * 固定選択名だけから診断構成を得る。
 * @responsibility 継承名・未知名を要求前に拒否する。
 * @trace ARCH-000008
 * @input profile: 固定選択名。
 * @returns 凍結済み技術構成。
 * @precondition 上位が用途を選択する。
 * @postcondition payloadを入力から採用しない。
 * @effect N/A: 固定値の読取りだけ。
 * @failure 未知選択名は例外。
 * @invariant catalogを変更しない。
 * @boundary 選択名と固定構成。
 * @security prototypeのPropertyを選択しない。
 * @concurrency 同期読取りだけ。
 */
function profileSpecification(profile: DockerProbeProfile) {
  if (typeof profile !== "string" || !Object.hasOwn(PROFILES, profile))
    throw new Error("docker_probe_profile_invalid");
  return PROFILES[profile];
}

/**
 * 固定profileの作成引数を既存plannerから投影する。
 * @responsibility 固定payload選択だけを所有しargv組立規則を複製しない。
 * @trace ARCH-000008
 * @input profile、probeId、mounts: 三つの許可済みPath。
 * @returns 凍結された既存create argv。
 * @precondition Path利用の判断は上位が行う。
 * @postcondition CLI・Filesystem要求を発行しない。
 * @effect N/A: 固定値からの純粋な計画。
 * @failure 未知profileと不正入力は例外。
 * @invariant 任意payload・timeout・Imageを入力にしない。
 * @boundary 上位profile選択と下位の固定作成構成。
 * @security 戻り値は実行Authorityではない。
 * @concurrency 呼出し内の固定値だけを返す。
 */
export function planDockerProbeCreation(
  profile: DockerProbeProfile,
  probeId: string,
  mounts: ProbeMounts,
) {
  return planDockerProbeCommand({
    purpose: "create",
    probeId,
    mounts,
    source: profileSpecification(profile).source,
  });
}

/**
 * 固定profileからinspect・回収の期待構成を投影する。
 * @responsibility 上位へPython本文の選択責任を持ち込まない。
 * @trace ARCH-000008
 * @input profile: 必須の現行profileまたは明示legacy_recovery、identity、mounts。
 * @returns 実ID・Probe相関・固定payload候補・三Path。
 * @precondition legacy_recoveryは旧record採用箇所だけが明示する。
 * @postcondition 欠測profileを候補集合へ補完しない。
 * @effect N/A: 値の固定投影だけ。
 * @failure 不正profile・三Pathは例外。
 * @invariant legacyは固定六候補だけで、任意候補を入力にしない。
 * @boundary 上位の所有相関とDIの構成照合。
 * @security 構成投影を観測成功・回収Authorityと同一視しない。
 * @concurrency Pathと候補を呼出し内で凍結する。
 */
export function describeDockerProbeConfiguration(
  profile: DockerProbeProfile | "legacy_recovery",
  identity: Readonly<{ id: string; probeId: string }>,
  mounts: ProbeMounts,
) {
  const sources =
    profile === "legacy_recovery"
      ? Object.values(PROFILES).map((item) => item.source)
      : [profileSpecification(profile).source];
  return Object.freeze({
    id: identity.id,
    probeId: identity.probeId,
    sourceCandidates: Object.freeze(sources),
    mounts: captureCurrentProbeMounts(mounts),
  });
}

/**
 * 診断開始前に既存version応答のLinux肯定だけを確認する。
 * @responsibility Engineの未知・非Linuxを成功へ補完しない。
 * @trace ARCH-000008
 * @input binding: 既存CLI確認と限定環境。
 * @returns 既存成功条件のboolean。
 * @precondition Host submission前に呼ぶ。
 * @postcondition Host記録・createを発行しない。
 * @effect 固定version要求一回。
 * @failure CLI例外は上位へ伝播する。
 * @invariant JSON版の別観測へ置換しない。
 * @boundary Docker応答と上位の開始判断。
 * @security 任意Engineやargvを受けない。
 * @concurrency 同期完了後だけ返す。
 */
export function observeDockerProbeEngine(binding: ProbeBinding): boolean {
  const execution = executeDockerProbeCommand(
    binding,
    { purpose: "version" },
    10_000,
  );
  return (
    !execution.error &&
    execution.status === 0 &&
    execution.stdout.trim() === "linux"
  );
}

/**
 * 固定profileから診断Containerを一度だけ作成する。
 * @responsibility 作成と開始を分離し、実IDの応答だけを返す。
 * @trace ARCH-000008
 * @input binding、profile、probeId、mounts: 三つの許可済みPath。
 * @returns 完全実IDのconfirmed、または既存unknown理由。
 * @precondition 上位がID未確定の回復記録を保存済み。
 * @postcondition ID入り保存とstartを自動発行しない。
 * @effect 固定create一回、30秒以内。
 * @failure 不正入力は要求前例外。作成応答不明はblocked。
 * @invariant 名前探索・推測ID・再createを行わない。
 * @boundary 上位保存の間にあるDocker作成要求。
 * @security 任意payload・追加mountを入力から採用しない。
 * @concurrency 同期一要求だけ。
 */
export function createDockerProbeContainer(
  binding: ProbeBinding,
  profile: DockerProbeProfile,
  probeId: string,
  mounts: Readonly<{ workspace: string; providerHome: string; tmp: string }>,
) {
  const specification = profileSpecification(profile);
  return Object.freeze(
    normalizeContainerCreation(
      executeDockerProbeCommand(
        binding,
        {
          purpose: "create",
          probeId,
          mounts,
          source: specification.source,
        },
        30_000,
      ),
    ),
  );
}

/**
 * 保存後の固定診断を完了まで実行し閉じた事実へ変換する。
 * @responsibility profileの期限・実要求・時計測を同じ呼出しへ閉じる。
 * @trace ARCH-000008
 * @input binding、profile、containerId: 構成確認済みの実ID。
 * @returns 生出力を含まない実行事実。
 * @precondition 上位がexact ID保存・fresh構成・現在mountを確認済み。
 * @postcondition create・Host保存・回収を自動発行しない。
 * @effect 固定start --attach一回、profile期限まで待機する。
 * @failure 取消profileは要求前拒否。CLI例外は伝播する。
 * @invariant 計測はCLI確認を含む既存の開始・終了位置を維持する。
 * @boundary 上位保存後の実行判断とDocker同期実行。
 * @security 任意argv・payload・期限を入力にしない。
 * @concurrency 同期完了後だけ事実を返す。
 */
export function runDockerProbeToCompletion(
  binding: ProbeBinding,
  profile: DockerProbeProfile,
  containerId: string,
) {
  const specification = profileSpecification(profile);
  if (profile === "cancellation")
    throw new Error("docker_probe_profile_invalid");
  const startedAt = performance.now();
  const execution = executeDockerProbeCommand(
    binding,
    { purpose: "start_attached", containerId },
    specification.timeoutMs,
  );
  const elapsedMs = Math.max(0, Math.round(performance.now() - startedAt));
  return classifyDockerProbeExecution(execution, elapsedMs);
}

/**
 * 保存済み固定Probeの取消をattachから終端joinまで所有する。
 * @responsibility 三地点の現在性・固定要求・元失敗と終端事実を分けて返す。
 * @trace ARCH-000008
 * @input binding、identity: 実IDとProbe名、readCurrentMounts: 同期三Path読取り。
 * @returns 生出力なしの取消候補、一次失敗、post確認、attach終端事実。
 * @precondition 上位がexact IDを保存済み。callbackは現在の所有確認後だけ三Pathを返す。
 * @postcondition 取得済みHandleは失敗後もjoinし、Host処置は呼ばない。
 * @effect 固定inspect、attach、SIGTERMと所有Handleの必要な終端。
 * @failure 元失敗を保持し、join不明は最終理由だけを上書きする。
 * @invariant 不明時の前進0と補償終端を区別する。各待機・SIGTERMは5秒。
 * @boundary Coordinatorの保存後判断とDocker技術実行。
 * @security 任意payload・argv・Writer・Host tokenを受けない。
 * @concurrency await後はfresh所有確認、遅延通知で失敗を巻き戻さない。
 */
export async function runDockerProbeCancellation(
  binding: ProbeBinding,
  identity: Readonly<{ id: string; probeId: string }>,
  readCurrentMounts: () => ProbeMounts,
) {
  const id = identity.id,
    probeId = identity.probeId;
  let controller: DockerAttachedProcess | null = null;
  let observation = classifyDockerProbeCancellation({}, -1, false);
  let reason = "dynamic_fake_provider_cancellation_verification_failed";
  let primaryFailure: string | null = null;
  let postRunMountVerified = false;
  let attachProcessTerminationObserved = false;
  let attachProcessTerminationRequestCount = 0;
  try {
    const initial = captureCurrentProbeMounts(readCurrentMounts());
    const expected = {
      id,
      probeId,
      sourceCandidates: [CANCELLATION_SOURCE],
      mounts: initial,
    };
    if (!inspectDockerProbeContainer(binding, expected))
      throw new Error("docker_container_security_profile_mismatch");
    controller = startDockerProbeAttachedProcess(
      binding,
      id,
      '{"marker":"crdd-coordinator-cancellation-v1","state":"ready"}\n',
    );
    const ready = await awaitProbeObservation(controller.ready, 5_000, false);
    if (!ready) {
      const failure = "dynamic_fake_provider_cancellation_ready_unconfirmed";
      try {
        await controller.terminateAndWait();
      } catch {
        // 一次失敗はready未確認。終端成立はfinallyで別に判定する。
      }
      throw new Error(failure);
    }
    const runningMounts = captureCurrentProbeMounts(
      readCurrentMounts(),
      initial,
    );
    if (
      inspectDockerProbeContainer(binding, {
        ...expected,
        mounts: runningMounts,
      })?.runningConfirmed !== true
    )
      throw new Error("dynamic_fake_provider_cancellation_ready_unconfirmed");
    const startedAt = performance.now();
    const cancellation = executeDockerProbeCommand(
      binding,
      { purpose: "terminate", containerId: id },
      5_000,
    );
    const execution = await awaitProbeObservation<
      CommandExecution & { error?: Error }
    >(controller.completion, 5_000, {
      error: Object.assign(new Error("cancellation timeout"), {
        code: "ETIMEDOUT",
      }),
      status: null,
      signal: null,
      stdout: "",
      stderr: "",
      outputExceeded: false,
    });
    if (
      Object.getOwnPropertyDescriptor(execution.error ?? {}, "code")?.value ===
        "ETIMEDOUT" ||
      execution.outputExceeded
    ) {
      try {
        await controller.terminateAndWait();
      } catch {
        // 元executionを保持し、猶予はjoin試行後まで計測する。
      }
    }
    const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
    observation = classifyDockerProbeCancellation(execution, elapsed, true);
    reason = observation.reason;
    if (
      cancellation.error ||
      cancellation.status !== 0 ||
      execution.outputExceeded ||
      observation.status !== "candidate"
    )
      throw new Error(reason);
    const postMounts = captureCurrentProbeMounts(readCurrentMounts(), initial);
    if (
      !inspectDockerProbeContainer(binding, { ...expected, mounts: postMounts })
    )
      throw new Error("owned_operation_mount_replaced");
    postRunMountVerified = true;
  } catch (error) {
    primaryFailure = probeCancellationFailure(error);
    reason = primaryFailure;
  } finally {
    if (controller) {
      try {
        const joined = await controller.terminateAndWait();
        attachProcessTerminationObserved =
          joined !== null && controller.isClosed();
      } catch {
        attachProcessTerminationObserved = false;
      }
      try {
        attachProcessTerminationRequestCount =
          controller.getTerminationRequestCount();
      } catch {
        attachProcessTerminationObserved = false;
      }
      if (!attachProcessTerminationObserved)
        reason = "dynamic_fake_provider_attach_process_termination_unconfirmed";
    }
  }
  return Object.freeze({
    observation,
    status:
      primaryFailure === null &&
      postRunMountVerified &&
      attachProcessTerminationObserved
        ? ("candidate" as const)
        : ("blocked" as const),
    reason,
    primaryFailure,
    postRunMountVerified,
    attachProcessTerminationObserved,
    attachProcessTerminationRequestCount,
  });
}

/**
 * 固定取消Probeを回復試験用の稼働残存として開始する。
 * @responsibility 保存後のfresh構成・一回start・fresh Running肯定を閉じる。
 * @trace ARCH-000008
 * @input binding、identity: 実IDとProbe名、readCurrentMounts: 同期三Path読取り。
 * @returns Running肯定だけ。
 * @precondition 上位が実IDを保存済み。
 * @postcondition 成功時も失敗時もremoveやHost清掃を発行しない。
 * @effect 固定inspect二回とstart一回、要求期限10秒。
 * @failure 構成不明・start失敗・Running不明は例外。
 * @invariant 不明をreadyにしない。
 * @boundary 保存済み所有対象と意図的な稼働残存。
 * @security 任意payload・対象名による探索を受けない。
 * @concurrency start前後で同じ三Pathを確認する。
 */
export function startDockerProbeResidue(
  binding: ProbeBinding,
  identity: Readonly<{ id: string; probeId: string }>,
  readCurrentMounts: () => ProbeMounts,
) {
  const id = identity.id,
    probeId = identity.probeId;
  const initial = captureCurrentProbeMounts(readCurrentMounts());
  const expected = {
    id,
    probeId,
    sourceCandidates: [CANCELLATION_SOURCE],
    mounts: initial,
  };
  if (!inspectDockerProbeContainer(binding, expected))
    throw new Error("docker_container_security_profile_mismatch");
  const started = executeDockerProbeCommand(
    binding,
    { purpose: "start", containerId: id },
    10_000,
  );
  if (started.error || started.status !== 0)
    throw new Error("dynamic_fake_provider_recoverable_start_failed");
  const mounts = captureCurrentProbeMounts(readCurrentMounts(), initial);
  if (
    inspectDockerProbeContainer(binding, { ...expected, mounts })
      ?.runningConfirmed !== true
  )
    throw new Error("dynamic_fake_provider_recoverable_not_running");
  return Object.freeze({ runningConfirmed: true as const });
}

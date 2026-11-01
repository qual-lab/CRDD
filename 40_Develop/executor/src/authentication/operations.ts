/**
 * AIツール認証固有の構成・実行と技術回収を所有する。
 * @responsibility 保存通知を待ち、同じPlanのProcess終了・資源回収を上位判断から分離する。
 * @trace ARCH-000010
 */

import { types } from "node:util";
import {
  type AiProvider,
  describeProviderAuthentication,
  evaluateProviderAuthentication,
} from "../../../ai-adapter/src/index.ts";
import {
  createDockerAuthenticationRuntimeFactory,
  type DockerAuthenticationCommand,
  type DockerAuthenticationExecution,
  type DockerAuthenticationPlan,
  type DockerAuthenticationRuntime,
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
  describeDockerProxyTopology,
  planDockerAuthenticationCommands,
  planDockerAuthenticationResourceRecovery,
} from "../../../docker-isolation/src/index.ts";
import type { AuthenticationCallbacks } from "../lifecycle/callbacks.ts";
import { executeLifecycle } from "../lifecycle/execute.ts";
import type {
  Authentication,
  AuthenticationCleanupResult,
  AuthenticationCompletionResult,
  AuthenticationExecutor,
  AuthenticationPlan,
  AuthenticationProjection,
  AuthenticationRequest,
  AuthenticationResult,
} from "./types.ts";

const authenticationTechnicalPlans = new WeakMap<
  object,
  DockerAuthenticationPlan
>();

/**
 * 準備済み認証を共通Lifecycleへ接続する。
 * @responsibility 同じRuntimeで実行・清掃をjoinし、終了不明を上位へ保持する。
 * @trace ARCH-000010
 * @input authentication: 同じ技術構成の操作。
 * @returns 一回のstartとcancel。構成不成立はnull。
 * @effect start後だけ実行と清掃。保存・Home Lock解放は行わない。
 * @failure 終了不明は追加操作を止め清掃未確認で返す。
 * @invariant 清掃前に完了を返さず、取消でも現在Owner確認を省略しない。
 */
export function bindAuthenticationLifecycle(
  authentication: Authentication | null,
): AuthenticationExecutor | null {
  if (!authentication) return null;
  const controller = new AbortController();
  let started = false;
  return Object.freeze<AuthenticationExecutor>({
    recordProjection: authentication.projection,
    start(context, callbacks = {}) {
      if (started) throw Error("provider_authentication_already_started");
      started = true;
      const signal = context.signal
        ? AbortSignal.any([context.signal, controller.signal])
        : controller.signal;
      let result: AuthenticationResult = {
        reason: "provider_authentication_process_completion_unconfirmed",
        authenticationStatus: "unknown",
        authenticationConfirmed: false,
        providerEffectIssued: false,
        processCompletionConfirmed: false,
      };
      let cleanup: AuthenticationCleanupResult = {
        confirmed: false,
        processCompletionConfirmed: false,
      };
      return Object.freeze({
        completion: executeLifecycle(
          {
            async execute() {
              result = await authentication.execute(
                signal,
                context.assertOwner,
                callbacks,
              );
            },
            async cleanup() {
              if (authentication.isProcessCompletionConfirmed())
                cleanup = await authentication.cleanup(
                  context.readResources,
                  context.assertOwner,
                  callbacks,
                );
            },
            createResult(
              _context,
              _failure,
              failed,
            ): AuthenticationCompletionResult {
              const reason =
                result.reason !== "provider_authentication_completed"
                  ? result.reason
                  : failed
                    ? "provider_authentication_process_completion_unconfirmed"
                    : signal.aborted
                      ? "provider_authentication_cancelled"
                      : result.reason;
              return Object.freeze({
                ...result,
                reason,
                processCompletionConfirmed:
                  !failed &&
                  result.processCompletionConfirmed &&
                  cleanup.processCompletionConfirmed,
                cleanupConfirmed: !failed && cleanup.confirmed,
              });
            },
          },
          context,
        ),
      });
    },
    cancel() {
      controller.abort();
    },
  });
}

/**
 * Provider認証の固定Docker Planを構築する。
 *
 * @responsibility 認証Effectを固定Image、限定Egressおよび専用Provider Homeだけへ制限する。
 * @trace ARCH-000010
 * @input providerHomeSourcePath: 検証済み専用Provider Homeの絶対Path、suffix: Logical Provider Home Identity由来hex
 * @returns 検証済み入力では固定Plan、不正入力ではnullを返す。
 * @precondition providerHomeSourcePathはPlatform Accessが選択Userから導いたPathである。
 * @postcondition PlanにRepository mount、host network、API keyまたは任意Commandを含めない。
 * @effect N/A: Plan生成だけを行う。
 * @failure 不正Path、suffixまたは固定配布契約の不一致をnullへ閉じる。
 * @invariant 選択Providerの公式CLI認証とnetwork-noneの事後Probeだけを許可する。
 * @boundary Host Docker CLIへ渡す引数の生成境界。
 * @security Provider Home Pathを結果以外へ公開せず、秘密値を読まない。
 * @concurrency 同じLogical Provider Homeは安定suffixとKernel Lockで単一Lifecycleへ直列化する。
 */
export function prepareAuthenticationPlan<A extends "status" | "login">(
  provider: AiProvider,
  action: A,
  providerHomeSourcePath: string,
  suffix: string,
  proxyToken: A extends "login" ? string : null,
): AuthenticationPlan<A> | null {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (action !== "status" && action !== "login") ||
    !/^[a-f0-9]{16}$/u.test(suffix) ||
    typeof providerHomeSourcePath !== "string" ||
    providerHomeSourcePath.length === 0 ||
    /[\0\r\n,]/u.test(providerHomeSourcePath) ||
    (action === "login"
      ? typeof proxyToken !== "string" || !/^[a-f0-9]{64}$/u.test(proxyToken)
      : proxyToken !== null)
  )
    return null;
  const cli = describeProviderAuthentication(provider);
  const locations = describeDockerProviderExecutionLocations(provider, "probe");
  const environment = Object.freeze({
    ...("environment" in cli ? cli.environment : {}),
    ...("homeEnvironmentVariable" in cli
      ? { [cli.homeEnvironmentVariable]: locations.providerHomeDirectory }
      : {}),
  });
  const providerImageDigest =
    describeDockerProviderAssets(provider).fixedImageDigest;
  const probeContainerName = `crdd-auth-${suffix}`;
  const ownershipLabel = `crdd.coordinator.authentication=${suffix}`;
  const common = {
    provider,
    action,
    providerHomeSourcePath,
    providerImageDigest,
    ownershipLabel,
    probeContainerName,
  };
  if (!/^sha256:[a-f0-9]{64}$/u.test(providerImageDigest)) return null;
  if (action === "status") {
    const technicalPlan = planDockerAuthenticationCommands({
      action: "status",
      providerHomeSourcePath,
      providerImageDigest,
      ownershipLabel,
      probeContainerName,
      authenticationCli: { statusArgv: cli.statusArgv, environment },
    });
    const plan = Object.freeze({
      ...common,
      commands: technicalPlan.commands,
      ownershipCommands: technicalPlan.ownershipCommands,
      cleanupCommands: technicalPlan.cleanupCommands,
      absenceCommands: technicalPlan.absenceCommands,
    }) as AuthenticationPlan<A>;
    authenticationTechnicalPlans.set(plan, technicalPlan);
    return plan;
  }
  const egress = describeDockerProxyTopology(provider);
  const proxyImageDigest = egress.imageDigest;
  if (
    !/^sha256:[a-f0-9]{64}$/u.test(proxyImageDigest) ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false ||
    typeof proxyToken !== "string"
  )
    return null;
  const internalNetworkName = `crdd-internal-${suffix}`;
  const egressNetworkName = `crdd-egress-${suffix}`;
  const proxyContainerName = `crdd-proxy-${suffix}`;
  const loginContainerName = `crdd-${provider}-${suffix}`;
  const technicalPlan = planDockerAuthenticationCommands({
    action: "login",
    providerHomeSourcePath,
    providerImageDigest,
    proxyImageDigest,
    ownershipLabel,
    probeContainerName,
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    loginContainerName,
    proxyToken,
    proxyPort: egress.containerPort,
    proxyProfile: provider,
    authenticationCli: {
      loginArgv: cli.loginArgv,
      statusArgv: cli.statusArgv,
      environment,
    },
  });
  const plan = Object.freeze({
    ...common,
    proxyImageDigest,
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    loginContainerName,
    commands: technicalPlan.commands,
    ownershipCommands: technicalPlan.ownershipCommands,
    cleanupCommands: technicalPlan.cleanupCommands,
    absenceCommands: technicalPlan.absenceCommands,
  }) as AuthenticationPlan<A>;
  authenticationTechnicalPlans.set(plan, technicalPlan);
  return plan;
}

/** 元Planに結合したDI構成だけを内部実行へ返す。
 * @responsibility 計画のコピーを実行所属へ昇格しない。
 * @trace ARCH-000010
 * @input plan: 元の技術準備値。
 * @returns 同じPlanのDI構成又はnull。
 * @precondition 内部の準備関数が元Planを登録している。
 * @postcondition 公開IDからPlanを復元しない。
 * @effect N/A: 既存の短命Mapを照会するだけ。
 * @failure コピー・未登録はnull。
 * @invariant 処置許可や保存成立を発行しない。
 * @boundary 内部準備とDI結合。
 * @security Root APIからは公開しない。
 * @concurrency 同じProcessの元参照だけを扱う。
 */
export function getAuthenticationTechnicalPlan(
  plan: AuthenticationPlan,
): DockerAuthenticationPlan | null {
  return authenticationTechnicalPlans.get(plan) ?? null;
}

/**
 * 必須の同期通知を完了させる。
 * @responsibility 戻り値ACKを受けず、誤Promiseの拒否を捕捉して次Effectを止める。
 * @trace ARCH-000010
 * @input notify: 同用途の通知、argument: 非秘密な通知値。
 * @returns N/A: 正常完了だけを表す。
 * @precondition 上位が必要な保存を通知の正常return前に完了する。
 * @postcondition 非同期の保存完了を推測しない。
 * @effect 登録済み通知のみ。
 * @failure throw・値返却・Promiseで停止する。
 * @invariant 保存結果をBooleanとして解釈しない。
 * @boundary 技術実行と保存Owner。
 * @security 生出力・Proxy tokenを渡さない。
 * @concurrency 同期直列で一回呼び、既知PromiseのRejectを消費する。
 */
function notifyAuthentication(
  notify: ((...args: never[]) => void) | undefined,
  argument?: unknown,
): void {
  if (!notify) return;
  if (types.isAsyncFunction(notify))
    throw Error("provider_authentication_notification_unconfirmed");
  const result: unknown = Reflect.apply(
    notify,
    undefined,
    argument === undefined ? [] : [argument],
  );
  if (result !== undefined) {
    if (types.isPromise(result))
      void Promise.prototype.then.call(
        result,
        () => undefined,
        () => undefined,
      );
    throw Error("provider_authentication_notification_unconfirmed");
  }
}

/**
 * 一つの認証構成を準備し、既存DIへ閉じた実行を返す。
 * @responsibility 固定Image・Home・通信条件を結合し永続状態を持たない。
 * @trace ARCH-000010
 * @input request: 選定済みProvider、操作とHome。
 * @returns 認証の資源投影と実行・回収、又は入力拒否null。
 * @precondition Home選定と現在の許可は上位が所有する。
 * @postcondition 準備だけではDocker要求を発行しない。
 * @effect 有効入力だけ既存DIのCLI実体・最小環境を読取り確認する。Docker要求は実行時だけ。
 * @failure 固定計画が成立しない場合null。実行後の終了不明はstickyに拒否する。
 * @invariant Workspace・Repositoryを認証へ接続しない。
 * @boundary 上位記録と固定認証技術処理。
 * @security 任意Runner・認証値・保存実装を公開入力にしない。
 * @concurrency 同じPlanのDI Runtimeと終了観測を全Commandで共有する。
 */
export function createAuthentication(
  request: AuthenticationRequest,
): Authentication | null {
  let runtime: DockerAuthenticationRuntime | null = null;
  let factory:
    | ((plan: DockerAuthenticationPlan) => DockerAuthenticationRuntime)
    | null = null;
  const prepared = createAuthenticationUsing(
    request,
    async (command, live, plan) => {
      const technical = getAuthenticationTechnicalPlan(plan);
      if (!technical) throw Error("docker_authentication_plan_unbound");
      if (!factory) throw Error("docker_authentication_runtime_unavailable");
      runtime ??= factory(technical);
      const result = await runtime.execute(command, live);
      if (
        command.purpose.startsWith("observe_") &&
        result.resourceConfigurationConfirmed === true
      )
        return Object.freeze({
          ...result,
          stdout: plan.ownershipLabel.split("=")[1] ?? "",
        });
      return result.error?.message === "docker_execution_permit_lost"
        ? Object.freeze({ ...result, error: Error("provider_home_lock_lost") })
        : result;
    },
  );
  if (!prepared) return null;
  try {
    factory = createDockerAuthenticationRuntimeFactory();
  } catch {
    throw Error("provider_authentication_docker_boundary_unavailable");
  }
  return prepared;
}
/**
 * Docker資源名を正規表現literalへ変換する。
 *
 * @responsibility 固定資源名をstderr exact照合で安全に使用できる形へ変換する。
 * @trace ARCH-000010
 * @input value: 固定Planから得たDocker資源名
 * @returns 正規表現meta文字をescapeした文字列を返す。
 * @precondition valueはCommand末尾から取得した文字列である。
 * @postcondition 返却値を正規表現へ埋めても元文字列のliteral一致になる。
 * @effect N/A: 入力文字列だけを変換する。
 * @failure N/A: 任意文字列を決定論的にescapeする。
 * @invariant 文字を削除または意味変換しない。
 * @boundary Docker資源Identityとstderr parserの表現境界。
 * @security 正規表現注入を防ぐ。
 * @concurrency N/A: 共有状態を変更しない同期変換である。
 */
function escapeRegularExpression(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

/**
 * Docker結果が対象資源の明示不存在を示すか判定する。
 *
 * @responsibility exit、stdout、stderrおよびexact資源名の積で不存在を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input command: 不存在確認Command、result: その実行観測
 * @returns 明示不存在をすべて確認した場合だけtrueを返す。
 * @precondition commandは固定PlanのabsenceCommands要素である。
 * @postcondition 観測不能、任意stdoutまたは別資源の結果を不存在へ畳まない。
 * @effect N/A: 入力値だけを読み取る。
 * @failure 不正結果や未知形式はfalseへ閉じる。
 * @invariant status 1と固定stderrの両方を必要とする。
 * @boundary Docker CLI観測から資源不存在Domain判定への境界。
 * @security stderr全体を公開せず固定形式だけを判定する。
 * @concurrency N/A: 共有状態を変更しない同期判定である。
 */
function explicitDockerAbsence(
  command: DockerAuthenticationCommand,
  result: DockerAuthenticationExecution,
) {
  const normalizedStdout = result.stdout.trim();
  if (
    result.error ||
    result.signal !== null ||
    result.status !== 1 ||
    (normalizedStdout.length !== 0 && normalizedStdout !== "[]")
  )
    return false;
  const resourceName = command.argv.at(-1);
  if (!resourceName) return false;
  const exactName = escapeRegularExpression(resourceName);
  const normalized = result.stderr.trim();
  if (command.purpose.includes("network"))
    return new RegExp(
      `^(?:Error response from daemon: )?(?:network ${exactName} not found|No such network: ${exactName})$`,
      "u",
    ).test(normalized);
  return new RegExp(
    `^(?:(?:Error response from daemon|Error): )?No such (?:object|container): ${exactName}$`,
    "u",
  ).test(normalized);
}

/**
 * 固定認証資源を各操作の保存通知後に照合・回収する。
 * @responsibility 実IDと名前の不存在を分離し、保存不明・終了不明では次Effectを止める。
 * @trace ARCH-000010
 * @input plan: 固定操作列、run/select: 内部技術接続、assertOwner/processConfirmed: 現在確認、callbacks: 同期通知。
 * @returns 資源回収とProcess終了の個別結果。
 * @precondition 上位がHome排他と現在の回収対象を確認済み。
 * @postcondition 保存やHome解放を技術成功へ補完しない。
 * @effect 固定inspect/remove/absenceをDIで逐次実行する。
 * @failure 所有不一致・保存拒否・終了不明・観測不能は未確認。
 * @invariant 現在Ownerと操作前後通知を省略しない。
 * @boundary 固定認証Runtimeと上位保存通知。
 * @security 既知実IDと名前の双方を照合し生出力を返さない。
 * @concurrency 同じRuntimeで一操作ずつ完了し次へ進む。
 */
async function cleanupAuthentication(
  plan: AuthenticationPlan,
  run: (
    command: DockerAuthenticationCommand,
    live: () => boolean,
  ) => Promise<DockerAuthenticationExecution>,
  select: (index: number) => Readonly<{
    ownershipCommand: DockerAuthenticationCommand;
    cleanupCommand: DockerAuthenticationCommand | null;
    absenceCommand: DockerAuthenticationCommand;
    identityAbsenceCommand?: DockerAuthenticationCommand;
  }> | null,
  assertOwner: () => boolean,
  processConfirmed: () => boolean,
  callbacks: AuthenticationCallbacks,
): Promise<AuthenticationCleanupResult> {
  let cleanupConfirmed = true,
    processCompletionConfirmed = true,
    recordingConfirmed = true;
  /**
   * 一つの回収操作の通知・終了観測を結合する。
   * @responsibility 終了不明後にidle通知や次処置を発行しない。
   * @trace ARCH-000010
   * @input command: 同じPlanの固定操作。
   * @returns 同じProcessの終了観測。
   * @precondition 現在Home OwnerとProcess終了を確認済み。
   * @postcondition 保存・終了不明は呼出し内でstickyに保持する。
   * @effect 操作前後通知と固定DI一要求。
   * @failure 保存拒否、許可喪失、終了不明は例外。
   * @invariant 次Effect前に必要通知が完了する。
   * @boundary 回収ループと同じ技術Runtime。
   * @security 任意Commandを上位から受け取らない。
   * @concurrency 直列実行で同じRecord相関を維持する。
   */
  async function execute(
    command: DockerAuthenticationCommand,
  ): Promise<DockerAuthenticationExecution> {
    if (!assertOwner() || !recordingConfirmed || !processCompletionConfirmed)
      throw Error("provider_authentication_cleanup_stopped");
    try {
      notifyAuthentication(callbacks.onCommandSubmitting, command.purpose);
    } catch {
      recordingConfirmed = false;
      throw Error("provider_authentication_cleanup_intent_unconfirmed");
    }
    let result: DockerAuthenticationExecution;
    try {
      result = await run(command, assertOwner);
    } catch {
      processCompletionConfirmed = false;
      throw Error("provider_authentication_process_completion_unconfirmed");
    }
    if (result.processCompletionConfirmed === false) {
      processCompletionConfirmed = false;
      throw Error("provider_authentication_process_completion_unconfirmed");
    }
    if (!assertOwner()) {
      recordingConfirmed = false;
      throw Error("provider_authentication_cleanup_permit_lost");
    }
    try {
      notifyAuthentication(callbacks.onCommandCompleted);
    } catch {
      recordingConfirmed = false;
      throw Error("provider_authentication_cleanup_settlement_unconfirmed");
    }
    return result;
  }
  for (let index = 0; index < plan.cleanupCommands.length; index += 1) {
    if (!assertOwner() || !recordingConfirmed || !processCompletionConfirmed)
      break;
    const selected = select(index);
    if (!selected) {
      cleanupConfirmed = false;
      break;
    }
    const {
      ownershipCommand,
      cleanupCommand,
      absenceCommand,
      identityAbsenceCommand,
    } = selected;
    try {
      const ownership = await execute(ownershipCommand);
      const alreadyAbsent = explicitDockerAbsence(ownershipCommand, ownership);
      if (alreadyAbsent && !identityAbsenceCommand) continue;
      if (
        !alreadyAbsent &&
        (ownership.error ||
          ownership.signal !== null ||
          ownership.status !== 0 ||
          ownership.stderr.trim().length !== 0 ||
          ownership.stdout.trim() !== plan.ownershipLabel.split("=")[1])
      ) {
        cleanupConfirmed = false;
        continue;
      }
      if (!alreadyAbsent) {
        if (!cleanupCommand) {
          cleanupConfirmed = false;
          continue;
        }
        const removed = await execute(cleanupCommand);
        if (removed.error || removed.signal !== null || removed.status !== 0)
          cleanupConfirmed = false;
      }
    } catch {
      cleanupConfirmed = false;
    }
    if (!assertOwner() || !recordingConfirmed || !processCompletionConfirmed)
      break;
    try {
      if (identityAbsenceCommand) {
        const identityResult = await execute(identityAbsenceCommand);
        if (!explicitDockerAbsence(identityAbsenceCommand, identityResult))
          cleanupConfirmed = false;
      }
      const result = await execute(absenceCommand);
      if (!explicitDockerAbsence(absenceCommand, result))
        cleanupConfirmed = false;
    } catch {
      cleanupConfirmed = false;
    }
  }
  return Object.freeze({
    confirmed:
      cleanupConfirmed &&
      recordingConfirmed &&
      processCompletionConfirmed &&
      assertOwner() &&
      processConfirmed(),
    processCompletionConfirmed:
      processCompletionConfirmed && processConfirmed(),
  });
}

/**
 * 同じ認証生涯の外部実行境界だけを有限試験で置換する。
 * @responsibility 本番の順序・通知・sticky終了拒否を同じ本文で検証する。
 * @trace ARCH-000010
 * @input request: 固定入力、run: 内部の実行境界、select: 試験専用回収選択。
 * @returns 本番と同じ型付き認証操作。
 * @precondition Rootは固定DI実装だけを渡し、任意境界はscripts/testsに限定する。
 * @postcondition 保存・Home Lock・Registryを作らない。
 * @effect 本番では固定DI、試験では有限代役。
 * @failure 同期通知不成立と終了不明は次Effectを停止する。
 * @invariant 試験注入点を通常Rootへexportしない。
 * @boundary Executor内部の技術試験接続。
 * @security 生出力はAI Adapter解析にだけ使い上位へ返さない。
 * @concurrency 一つのPlanと終了状態を同じ呼出し群へ保持する。
 */
export function createAuthenticationUsing(
  request: AuthenticationRequest,
  run: (
    command: DockerAuthenticationCommand,
    live: () => boolean,
    plan: AuthenticationPlan,
  ) => Promise<DockerAuthenticationExecution>,
  select?: (
    plan: AuthenticationPlan,
    index: number,
  ) => Readonly<{
    ownershipCommand: DockerAuthenticationCommand;
    cleanupCommand: DockerAuthenticationCommand | null;
    absenceCommand: DockerAuthenticationCommand;
    identityAbsenceCommand?: DockerAuthenticationCommand;
  }> | null,
  processConfirmed?: () => boolean,
): Authentication | null {
  if (!request || (request.action !== "login" && request.action !== "status"))
    return null;
  let plan: AuthenticationPlan | null;
  try {
    plan =
      request.action === "login"
        ? prepareAuthenticationPlan(
            request.provider,
            "login",
            request.providerHomeSourcePath,
            request.suffix,
            request.proxyToken as string,
          )
        : prepareAuthenticationPlan(
            request.provider,
            "status",
            request.providerHomeSourcePath,
            request.suffix,
            request.proxyToken as null,
          );
  } catch {
    return null;
  }
  if (!plan) return null;
  const prepared = plan;
  let processUnsettled = false;
  const currentProcess = () =>
    !processUnsettled && (processConfirmed?.() ?? true);
  const command = async (
    value: DockerAuthenticationCommand,
    live: () => boolean,
  ) => {
    if (!currentProcess())
      throw Error("docker_authentication_process_completion_unconfirmed");
    try {
      const result = await run(value, live, prepared);
      if (result.processCompletionConfirmed === false) processUnsettled = true;
      return result;
    } catch (error) {
      processUnsettled = true;
      throw error;
    }
  };
  const projection: AuthenticationProjection = Object.freeze({
    provider: prepared.provider,
    action: prepared.action,
    ownershipLabel: prepared.ownershipLabel,
    resources: Object.freeze(
      prepared.absenceCommands.map((value) => {
        const name = value.argv.at(-1);
        if (!name)
          throw Error("docker_authentication_resource_name_unconfirmed");
        return Object.freeze({
          kind: value.purpose.includes("network")
            ? ("network" as const)
            : ("container" as const),
          name,
          dockerId: null,
        });
      }),
    ),
  });
  return Object.freeze<Authentication>({
    projection,
    isProcessCompletionConfirmed: currentProcess,
    async execute(
      signal,
      assertOwner,
      callbacks = {},
    ): Promise<AuthenticationResult> {
      if (!currentProcess())
        return {
          reason: "provider_authentication_process_completion_unconfirmed",
          authenticationStatus: "unknown",
          authenticationConfirmed: false,
          providerEffectIssued: false,
          processCompletionConfirmed: false,
        };
      let reason = "provider_authentication_completed";
      let authenticationStatus: AuthenticationResult["authenticationStatus"] =
        "unknown";
      let authenticationConfirmed = false,
        providerEffectIssued = false;
      try {
        for (const value of prepared.commands) {
          if (signal?.aborted) {
            reason = "provider_authentication_cancelled";
            break;
          }
          if (!assertOwner()) {
            reason = "provider_authentication_provider_home_lock_lost";
            break;
          }
          try {
            notifyAuthentication(callbacks.onCommandSubmitting, value.purpose);
          } catch {
            reason = "provider_authentication_command_intent_unconfirmed";
            break;
          }
          providerEffectIssued = true;
          let result: DockerAuthenticationExecution;
          try {
            result = await command(
              value,
              () => !signal?.aborted && assertOwner(),
            );
          } catch {
            reason = "provider_authentication_process_completion_unconfirmed";
            break;
          }
          if (!currentProcess()) {
            reason = "provider_authentication_process_completion_unconfirmed";
            break;
          }
          if (!assertOwner()) {
            reason = "provider_authentication_provider_home_lock_lost";
            break;
          }
          if (value.purpose.startsWith("create_")) {
            try {
              if (
                result.resourceCreationConfirmed !== true ||
                !result.resourceReceipt
              )
                throw Error("receipt_unconfirmed");
              notifyAuthentication(
                callbacks.onResourceCreated,
                result.resourceReceipt,
              );
            } catch {
              reason = "provider_authentication_resource_receipt_unconfirmed";
              break;
            }
          }
          try {
            notifyAuthentication(callbacks.onCommandCompleted);
          } catch {
            reason = "provider_authentication_command_settlement_unconfirmed";
            break;
          }
          const statusObservation =
            prepared.action === "status" &&
            value.purpose === "start_probe_attached" &&
            !result.error &&
            result.signal === null &&
            (result.status === 0 || result.status === 1)
              ? evaluateProviderAuthentication(
                  prepared.provider,
                  describeProviderAuthentication(prepared.provider).offering,
                  result.stdout,
                  result.stderr,
                  "execution",
                )
              : null;
          const notLoggedIn =
            result.status === 1 && statusObservation?.status === "unconfirmed";
          if (
            result.error ||
            result.signal !== null ||
            (result.status !== 0 && !notLoggedIn)
          ) {
            reason =
              result.error?.message === "provider_home_lock_lost"
                ? "provider_authentication_provider_home_lock_lost"
                : `provider_authentication_${value.purpose}_failed`;
            break;
          }
          if (value.purpose === "start_probe_attached") {
            const observed =
              statusObservation ??
              evaluateProviderAuthentication(
                prepared.provider,
                describeProviderAuthentication(prepared.provider).offering,
                result.stdout,
                result.stderr,
                prepared.action === "login" ? "login" : "execution",
              );
            authenticationStatus = observed.status;
            if (
              observed.status !== "confirmed" &&
              !(
                prepared.action === "status" &&
                observed.status === "unconfirmed"
              )
            ) {
              reason = "provider_authentication_not_confirmed";
              break;
            }
            authenticationConfirmed = observed.status === "confirmed";
          }
        }
      } catch {
        reason = "provider_authentication_failed_closed";
      }
      return Object.freeze({
        reason,
        authenticationStatus,
        authenticationConfirmed,
        providerEffectIssued,
        processCompletionConfirmed: currentProcess(),
      });
    },
    async cleanup(
      readResources,
      assertOwner,
      callbacks = {},
    ): Promise<AuthenticationCleanupResult> {
      if (!currentProcess())
        return { confirmed: false, processCompletionConfirmed: false };
      return cleanupAuthentication(
        prepared,
        command,
        (index) => {
          if (select) return select(prepared, index);
          const receipt = readResources()?.[index],
            absence = prepared.absenceCommands[index];
          const technical = getAuthenticationTechnicalPlan(prepared);
          if (!receipt || !absence || !technical) return null;
          return receipt.dockerId === null
            ? {
                ownershipCommand: absence,
                cleanupCommand: null,
                absenceCommand: absence,
              }
            : planDockerAuthenticationResourceRecovery(
                technical,
                receipt.name,
                receipt.dockerId,
              );
        },
        assertOwner,
        currentProcess,
        callbacks,
      );
    },
  });
}

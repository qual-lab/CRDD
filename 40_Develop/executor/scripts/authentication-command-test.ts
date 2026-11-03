/**
 * 明示実境界試験だけが使う認証Command接続。
 * @responsibility 作成途中・別Process再入場の試験を本番公開APIから分離する。
 * @trace ARCH-000010
 * @boundary scripts/tests専用。呼出し自体は計画を結合し、runだけが実Dockerを操作する。
 */

import { describeDockerProxyTopology } from "../../docker-isolation/src/network/policy.ts";
import {
  type AiProvider,
  describeProviderAuthentication,
  evaluateProviderAuthentication,
} from "../../ai-adapter/src/index.ts";
import { describeIsolationConfiguration } from "../../docker-isolation/src/index.ts";
import {
  cleanupDockerAuthenticationResources,
  createDockerAuthenticationRuntimeFactory,
  type DockerAuthenticationCommand,
  type DockerAuthenticationExecution,
  type DockerAuthenticationPlan,
  type DockerAuthenticationRuntime,
  planDockerAuthenticationCommands,
  planDockerAuthenticationResourceRecovery,
} from "../../docker-isolation/tests/support/authentication.ts";
import {
  captureAuthenticationResources,
  notifyAuthentication,
} from "../src/authentication/operations.ts";
import type {
  AuthenticationCallbacks,
  AuthenticationCleanupResult,
  AuthenticationCompletionResult,
  AuthenticationProjection,
  AuthenticationRequest,
  AuthenticationResult,
} from "../src/authentication/types.ts";
import { executeLifecycle } from "../src/lifecycle/execute.ts";
import { createLifecycleOperations } from "../src/lifecycle/operations.ts";
import type { Executor } from "../src/lifecycle/types.ts";

/**
 * 一つの認証構成に結び付いた実行・回収。
 * @responsibility 同じDI Runtimeと終了不明のsticky拒否を維持する。
 * @trace ARCH-000010
 * @shape 資源投影、実行、確定した資源情報による回収と終了観測。
 * @invariant 保存・権限発行・Home Lockの取得解放を所有しない。
 * @boundary Coordinatorと固定認証技術処理。
 * @security 上位Ownerや保存状態の逆照会を行わず、実資源をDIで照合する。
 * @compatibility 使い捨てContainerを維持し、通常Attemptと同居・再利用しない。
 */
export interface Authentication {
  readonly projection: AuthenticationProjection;
  readonly resources: AuthenticationProjection["resources"];
  execute(
    signal: AbortSignal | undefined,
    callbacks?: AuthenticationCallbacks,
  ): Promise<AuthenticationResult>;
  cleanup(
    resources: AuthenticationProjection["resources"] | null,
    signal?: AbortSignal,
    callbacks?: AuthenticationCallbacks,
  ): Promise<AuthenticationCleanupResult>;
  isProcessCompletionConfirmed(): boolean;
}

/**
 * DIに結合する内部固定Plan。
 * @responsibility 認証条件と元Commandの相関をExecutor内へ閉じる。
 * @trace ARCH-000010
 * @shape Provider、操作、Home、Image、所有Labelと固定操作列。
 * @invariant 公開RootからCommandを渡さない。
 * @boundary 内部準備とDI認証Runtime。
 * @security Workspaceや任意コマンドを許可しない。
 * @compatibility 既存の固定Planと同じ技術値。
 */
export type AuthenticationPlan<
  A extends "status" | "login" = "status" | "login",
> = Readonly<{
  provider: AiProvider;
  action: A;
  providerHomeSourcePath: string;
  providerImageDigest: string;
  ownershipLabel: string;
  probeContainerName: string;
  commands: readonly DockerAuthenticationCommand[];
  ownershipCommands: readonly DockerAuthenticationCommand[];
  cleanupCommands: readonly DockerAuthenticationCommand[];
  absenceCommands: readonly DockerAuthenticationCommand[];
}> &
  (A extends "login"
    ? Readonly<{
        proxyImageDigest: string;
        internalNetworkName: string;
        egressNetworkName: string;
        proxyContainerName: string;
        loginContainerName: string;
      }>
    : object);

const authenticationTechnicalPlans = new WeakMap<
  object,
  DockerAuthenticationPlan
>();

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
  const locations = describeIsolationConfiguration(provider).locations.primary;
  const environment = Object.freeze({
    ...("environment" in cli ? cli.environment : {}),
    ...("homeEnvironmentVariable" in cli
      ? { [cli.homeEnvironmentVariable]: locations.providerHomeDirectory }
      : {}),
  });
  const providerImageDigest =
    describeIsolationConfiguration(provider).assets.fixedImageDigest;
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
        result.resourceIdentityConfirmed === true
      )
        return Object.freeze({
          ...result,
          stdout: plan.ownershipLabel.split("=")[1] ?? "",
        });
      return result;
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
 * 同じ認証生涯の外部実行境界だけを有限試験で置換する。
 * @responsibility 本番の順序・通知・sticky終了拒否を同じ本文で検証する。
 * @trace ARCH-000010
 * @input request: 固定入力、run: 内部の実行境界、processConfirmed: 同じ技術Processの終了観測。
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
  const technical = getAuthenticationTechnicalPlan(prepared);
  if (!technical) return null;
  const projection: AuthenticationProjection = Object.freeze({
    provider: prepared.provider,
    action: prepared.action,
    ownershipLabel: prepared.ownershipLabel,
    resources: technical.resources,
  });
  let resources = projection.resources;
  return Object.freeze<Authentication>({
    projection,
    isProcessCompletionConfirmed: currentProcess,
    get resources() {
      return resources;
    },
    async execute(signal, callbacks = {}): Promise<AuthenticationResult> {
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
          try {
            notifyAuthentication(callbacks.onCommandSubmitting, value.purpose);
          } catch {
            reason = "provider_authentication_command_intent_unconfirmed";
            break;
          }
          providerEffectIssued = true;
          let result: DockerAuthenticationExecution;
          try {
            result = await command(value, () => !signal?.aborted);
          } catch {
            reason = "provider_authentication_process_completion_unconfirmed";
            break;
          }
          if (!currentProcess()) {
            reason = "provider_authentication_process_completion_unconfirmed";
            break;
          }
          if (
            value.purpose.startsWith("create_") &&
            !(
              result.error?.message === "docker_execution_permit_lost" &&
              !result.resourceReceipt
            )
          ) {
            try {
              if (
                result.resourceCreationConfirmed !== true ||
                !result.resourceReceipt
              )
                throw Error("receipt_unconfirmed");
              const receipt = Object.freeze({ ...result.resourceReceipt });
              const original = resources.find(
                (resource) => resource.name === receipt.name,
              );
              if (!original) throw Error("receipt_resource_mismatch");
              const captured = captureAuthenticationResources(
                resources,
                resources.map((resource) =>
                  resource.name === receipt.name
                    ? { ...resource, dockerId: receipt.dockerId }
                    : resource,
                ),
              );
              if (!captured) throw Error("receipt_invalid");
              resources = captured;
              notifyAuthentication(callbacks.onResourceCreated, receipt);
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
              result.error?.message === "docker_execution_permit_lost"
                ? "provider_authentication_cancelled"
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
      suppliedResources,
      signal,
      callbacks = {},
    ): Promise<AuthenticationCleanupResult> {
      if (!currentProcess())
        return { confirmed: false, processCompletionConfirmed: false };
      const technical = getAuthenticationTechnicalPlan(prepared);
      if (!technical)
        return {
          confirmed: false,
          processCompletionConfirmed: currentProcess(),
        };
      return cleanupDockerAuthenticationResources(
        technical,
        command,
        suppliedResources,
        signal,
        currentProcess(),
        callbacks,
      );
    },
  });
}
/**
 * 作成途中の資源を限定試験が直接確認するための接続を作る。
 * @responsibility 既存DIの元計画と実ID照合を維持する。
 * @trace ARCH-000010
 * @input plan: 試験専用の元固定Plan。
 * @returns 元計画に閉じたrunと実IDの回収計画選択。
 * @precondition 実行側が別途明示許可された限定試験である。
 * @postcondition 本番RootやCoordinatorへ任意Command実行を公開しない。
 * @effect Factoryで既存CLIを読取り確認し、runで固定DI処理を行う。
 * @failure コピーPlan・終了不明は追加処置を拒否する。
 * @invariant 終了不明を試験側で成功へ変換しない。
 * @boundary 自己生成試験資源と既存DI。
 * @security 生出力は試験Oracle内へ限定し保存しない。
 * @concurrency 元PlanのRuntimeを再利用する。
 */
export function createAuthenticationCommandTestRuntime(
  plan: AuthenticationPlan,
) {
  const technical = getAuthenticationTechnicalPlan(plan);
  if (!technical) throw Error("authentication_test_plan_unbound");
  const runtime = createDockerAuthenticationRuntimeFactory()(technical);
  let unsettled = false;
  return {
    async run(
      command: DockerAuthenticationCommand,
      live: () => boolean,
      expected: AuthenticationPlan,
    ): Promise<DockerAuthenticationExecution> {
      if (expected !== plan || unsettled)
        throw Error("authentication_test_runtime_unavailable");
      const result = await runtime.execute(command, live);
      unsettled ||= !result.processCompletionConfirmed;
      return command.purpose.startsWith("observe_") &&
        result.resourceIdentityConfirmed
        ? { ...result, stdout: plan.ownershipLabel.split("=")[1] ?? "" }
        : result;
    },
    recoveryCommands(
      receipts: AuthenticationProjection["resources"],
      expected: AuthenticationPlan,
      index: number,
    ) {
      if (expected !== plan || unsettled) return null;
      const receipt = receipts[index],
        absenceCommand = plan.absenceCommands[index];
      if (!receipt || !absenceCommand) return null;
      return receipt.dockerId === null
        ? {
            ownershipCommand: absenceCommand,
            cleanupCommand: null,
            absenceCommand,
          }
        : planDockerAuthenticationResourceRecovery(
            technical,
            receipt.name,
            receipt.dockerId,
          );
    },
  };
}

/**
 * 準備済み認証を共通Lifecycleへ接続する。
 * @responsibility 同じRuntimeで実行・清掃をjoinし、終了不明を上位へ保持する。
 * @trace ARCH-000010
 * @input authentication: 同じ技術構成の操作。
 * @returns 一回のstartとcancel。構成不成立はnull。
 * @effect start後だけ実行と清掃。保存・Home Lock解放は行わない。
 * @failure 終了不明は追加操作を止め清掃未確認で返す。
 * @invariant 清掃前に完了を返さず、取消でも技術終了と回収確認を省略しない。
 */
export function bindAuthenticationLifecycle(
  authentication: Authentication | null,
): Executor<"authentication"> | null {
  if (!authentication) return null;
  const lifecycle = createLifecycleOperations();
  return Object.freeze<Executor<"authentication">>({
    kind: "authentication",
    recordProjection: authentication.projection,
    start(context) {
      const callbacks = context.callbacks ?? {};
      if (!lifecycle.start(context.signal))
        return Object.freeze({
          kind: "authentication",
          status: "blocked",
          reason: lifecycle.cancellationRequested
            ? "provider_authentication_cancelled"
            : "provider_authentication_already_started",
          completion: null,
        });
      const signal = lifecycle.signal;
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
        kind: "authentication",
        status: "started",
        completion: executeLifecycle(
          {
            async execute() {
              result = await authentication.execute(signal, callbacks);
            },
            shouldCleanup: () => authentication.isProcessCompletionConfirmed(),
            async cleanup() {
              cleanup = await authentication.cleanup(
                authentication.resources,
                undefined,
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
              const final: AuthenticationCompletionResult = Object.freeze({
                ...result,
                kind: "authentication",
                status:
                  !failed &&
                  cleanup.confirmed &&
                  result.processCompletionConfirmed &&
                  cleanup.processCompletionConfirmed
                    ? reason === "provider_authentication_cancelled"
                      ? "cancelled"
                      : reason === "provider_authentication_completed"
                        ? "completed"
                        : "blocked"
                    : "blocked",
                reason,
                processCompletionConfirmed:
                  !failed &&
                  result.processCompletionConfirmed &&
                  cleanup.processCompletionConfirmed,
                cleanupConfirmed: !failed && cleanup.confirmed,
                resourceSnapshot: null,
              });
              return final;
            },
            onCompleted: (result) => callbacks.onCompleted?.(result),
          },
          context,
          lifecycle,
        ),
      });
    },
    async cancel() {
      return lifecycle.cancel();
    },
  });
}

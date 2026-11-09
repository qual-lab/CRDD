/**
 * 認証の構成・必要通知と結果解釈を所有する。
 * @packageDocumentation
 * @responsibility 上位の判断・永続化とDIの技術実行を再実装しない。
 * @trace ARCH-000008
 */
import { types } from "node:util";
import {
  getAuthenticationDefinition,
  parseProviderResult,
} from "../../../ai-adapter/src/index.ts";
import {
  type IsolationSettings,
  describeIsolationConfiguration,
  executeIsolation,
  type IsolationExecution,
  type IsolationRequest,
  prepareIsolation,
} from "../../../docker-isolation/src/index.ts";
import { createLifecycleControl } from "./execute.ts";
import type {
  ResourcePreparation,
  Executor,
  AuthenticationCallbacks,
  AuthenticationCompletionResult,
  AuthenticationProjection,
  AuthenticationRequest,
  AuthenticationResult,
} from "./types.ts";

/**
 * 認証固有のHome・通信・対話条件を共通DI入力へ固定する。
 * @responsibility Docker生涯を再実装せず、login/statusの構成差だけを所有する。
 * @trace ARCH-000010
 * @input request: 選択済み認証要求。managementDirectory: 上位確定の借用管理領域。
 * @returns 固定資源と分岐・再送のない操作列。不正要求は例外。
 * @effect N/A: 値構築だけ。
 * @invariant Workspace・Repository・既定Docker設定を使用しない。
 */
function authenticationIsolationRequest(
  request: AuthenticationRequest,
  managementDirectory: string,
): IsolationRequest {
  if (!request || typeof request !== "object" || types.isProxy(request))
    throw Error("provider_authentication_input_invalid");
  if (Reflect.ownKeys(request).length !== 6)
    throw Error("provider_authentication_input_invalid");
  for (const key of Reflect.ownKeys(request)) {
    if (
      ![
        "kind",
        "provider",
        "action",
        "providerHomeSourcePath",
        "suffix",
        "proxyToken",
      ].includes(String(key)) ||
      !("value" in (Object.getOwnPropertyDescriptor(request, key) ?? {}))
    )
      throw Error("provider_authentication_input_invalid");
  }
  if (
    request.kind !== "authentication" ||
    typeof managementDirectory !== "string" ||
    managementDirectory.length === 0 ||
    typeof request.providerHomeSourcePath !== "string" ||
    request.providerHomeSourcePath.length === 0 ||
    /[\0\r\n,]/u.test(request.providerHomeSourcePath) ||
    typeof request.suffix !== "string" ||
    (request.provider !== "codex" && request.provider !== "claude") ||
    (request.action !== "status" && request.action !== "login") ||
    !/^[a-f0-9]{16}$/u.test(request.suffix) ||
    (request.action === "login"
      ? typeof request.proxyToken !== "string" ||
        !/^[a-f0-9]{64}$/u.test(request.proxyToken)
      : request.proxyToken !== null)
  )
    throw Error("provider_authentication_input_invalid");
  const cli = getAuthenticationDefinition(request.provider);
  const capabilities = describeIsolationConfiguration(request.provider);
  const locations = capabilities.locations.primary;
  const environment = {
    ...("environment" in cli ? cli.environment : {}),
    ...("homeEnvironmentVariable" in cli
      ? { [cli.homeEnvironmentVariable]: locations.providerHomeDirectory }
      : {}),
  };
  const label = `crdd.coordinator.authentication=${request.suffix}`;
  const image = capabilities.assets.fixedImageDigest;
  const probe = {
    kind: "container",
    key: "probe",
    name: `crdd-auth-${request.suffix}`,
    ownershipLabel: label,
    image,
    argv: cli.statusArgv,
    environment: { HOME: "/provider-home", ...environment },
    mounts: [
      {
        source: request.providerHomeSourcePath,
        target: "/provider-home",
        readOnly: true,
      },
    ],
    network: null,
    networkAlias: null,
    user: "65534:65534",
    workingDirectory: null,
    entrypoint: null,
    tmpfsBytes: null,
    interactive: false,
    tty: false,
    init: false,
    seccomp: null,
  } as const satisfies IsolationRequest["resources"][number];
  const resources: IsolationRequest["resources"][number][] = [];
  const steps: IsolationRequest["steps"][number][] = [];
  if (request.action === "login") {
    const topology = capabilities.proxy;
    if (!request.proxyToken)
      throw Error("provider_authentication_input_invalid");
    resources.push(
      {
        kind: "network",
        key: "internal_network",
        name: `crdd-internal-${request.suffix}`,
        ownershipLabel: label,
        internal: true,
      },
      {
        kind: "network",
        key: "egress_network",
        name: `crdd-egress-${request.suffix}`,
        ownershipLabel: label,
        internal: false,
      },
      {
        ...probe,
        key: "proxy",
        name: `crdd-proxy-${request.suffix}`,
        image: topology.imageDigest,
        argv: [],
        environment: {},
        mounts: [],
        network: "internal_network",
        networkAlias: "proxy",
        tmpfsBytes: 16_777_216,
      },
      {
        ...probe,
        key: "login",
        name: `crdd-${request.provider}-${request.suffix}`,
        argv: cli.loginArgv,
        environment: {
          HOME: "/provider-home",
          ...environment,
          TMPDIR: "/tmp",
        },
        mounts: [
          {
            source: request.providerHomeSourcePath,
            target: "/provider-home",
            readOnly: false,
          },
        ],
        network: "internal_network",
        workingDirectory: "/work",
        tmpfsBytes: 33_554_432,
        interactive: true,
        tty: true,
      },
    );
    for (const key of ["internal_network", "egress_network", "proxy"])
      steps.push({
        key: `create_${key}`,
        action: "create",
        resource: key,
        timeoutMs: 30_000,
      });
    steps.push(
      {
        key: "connect_proxy_egress",
        action: "connect",
        resource: "proxy",
        network: "egress_network",
        timeoutMs: 30_000,
      },
      {
        key: "start_proxy",
        action: "run",
        resource: "proxy",
        mode: "detached",
        stdin: null,
        timeoutMs: 30_000,
        stdoutLimitBytes: 1_048_576,
        stderrLimitBytes: 1_048_576,
        acceptedExitCodes: [0],
        deadlineOrigin: "request",
      },
      {
        key: "create_login",
        action: "create",
        resource: "login",
        timeoutMs: 30_000,
      },
      {
        key: "start_login_attached",
        action: "run",
        resource: "login",
        mode: "interactive",
        stdin: null,
        timeoutMs: null,
        stdoutLimitBytes: 1_048_576,
        stderrLimitBytes: 1_048_576,
        acceptedExitCodes: [0],
        deadlineOrigin: "request",
      },
    );
  }
  resources.push(probe);
  steps.push(
    {
      key: "create_probe",
      action: "create",
      resource: "probe",
      timeoutMs: 30_000,
    },
    {
      key: "start_probe_attached",
      action: "run",
      resource: "probe",
      mode: "captured",
      stdin: null,
      timeoutMs: 30_000,
      stdoutLimitBytes: 1_048_576,
      stderrLimitBytes: 1_048_576,
      acceptedExitCodes: request.action === "status" ? [0, 1] : [0],
      deadlineOrigin: "request",
    },
  );
  return {
    ...(request.action === "login"
      ? {
          proxy: {
            resource: "proxy",
            clients: ["login"],
            profile: request.provider,
            token: request.proxyToken as string,
            additionalHosts: null,
            environmentMode: "https" as const,
          },
        }
      : {}),
    managementDirectory,
    resources,
    steps,
    cleanupOrder:
      request.action === "login"
        ? ["probe", "login", "proxy", "internal_network", "egress_network"]
        : ["probe"],
    setupTimeoutMs: 30_000,
    unreceiptedAbsence: "observe",
    verifyLabelAbsence: false,
  };
}

/**
 * 上位確定の管理領域を使う認証を、共通DI生涯へ結合する。
 * @responsibility 認証結果だけを解釈し、Process・Receipt・回収はDIの元Ownerへ委譲する。
 * @trace ARCH-000010
 * @input request: 固定認証要求。managementDirectory: 上位が保持する短命設定の管理領域。
 * @returns 一回のExecutor。準備不成立はnull。
 * @effect 準備時は読取りだけ。Dockerはstart後だけ。
 * @failure 必要通知失敗・終了不明・回収未確認は成功にしない。
 * @invariant 生出力・認証値を結果やSnapshotへ含めない。
 */
export function createAuthenticationExecutor(
  request: AuthenticationRequest,
  managementDirectory: string,
  settings: IsolationSettings,
): Executor<"authentication"> | null {
  if (
    !settings ||
    typeof settings !== "object" ||
    types.isProxy(settings) ||
    Reflect.ownKeys(settings).length !== 2
  )
    return null;
  const windows = Object.getOwnPropertyDescriptor(settings, "windowsDirectory");
  const home = Object.getOwnPropertyDescriptor(settings, "userHomeDirectory");
  if (
    !windows ||
    !("value" in windows) ||
    typeof windows.value !== "string" ||
    !home ||
    !("value" in home) ||
    typeof home.value !== "string"
  )
    return null;
  settings = Object.freeze({
    windowsDirectory: windows.value,
    userHomeDirectory: home.value,
  });
  let input: IsolationRequest;
  try {
    input = authenticationIsolationRequest(request, managementDirectory);
    request = Object.freeze({
      kind: "authentication",
      provider: request.provider,
      action: request.action,
      providerHomeSourcePath: request.providerHomeSourcePath,
      suffix: request.suffix,
      proxyToken: request.proxyToken,
    });
  } catch {
    return null;
  }
  const lifecycle = createLifecycleControl();
  const projection: AuthenticationProjection = Object.freeze({
    provider: request.provider,
    action: request.action,
    ownershipLabel: `crdd.coordinator.authentication=${request.suffix}`,
  });
  return Object.freeze<Executor<"authentication">>({
    kind: "authentication",
    recordProjection: projection,
    start(context) {
      if (!lifecycle.start(context.signal))
        return Object.freeze({
          kind: "authentication",
          status: "blocked",
          reason: lifecycle.cancellationRequested
            ? "provider_authentication_cancelled"
            : "provider_authentication_already_started",
          completion: null,
        });
      const callbacks: AuthenticationCallbacks = context.callbacks ?? {};
      let reason = "provider_authentication_completed";
      let authenticationStatus: AuthenticationResult["authenticationStatus"] =
        "unknown";
      let authenticationConfirmed = false;
      let session: IsolationExecution;
      const required = (
        notify: ((...args: never[]) => void) | undefined,
        failed: string,
        ...values: unknown[]
      ) => {
        try {
          notifyAuthentication(notify, ...values);
        } catch (error) {
          if (reason === "provider_authentication_completed") reason = failed;
          throw error;
        }
      };
      try {
        const prepared = prepareIsolation(input, settings);
        if (!prepared)
          throw Error("provider_authentication_preparation_failed");
        let resources: ResourcePreparation = Object.freeze({
          snapshot: prepared.resources,
          cleanup: Object.freeze({
            cleanupOrder: input.cleanupOrder,
            setupTimeoutMs: input.setupTimeoutMs,
            unreceiptedAbsence: input.unreceiptedAbsence,
            verifyLabelAbsence: input.verifyLabelAbsence,
          }),
        });
        session = executeIsolation(prepared, {
          onSubmitting: (step) =>
            required(
              callbacks.onCommandSubmitting,
              "provider_authentication_command_intent_unconfirmed",
              step.key,
              resources,
              step.resource,
            ),
          onNotIssued: (step) =>
            required(
              callbacks.onCommandNotIssued,
              "provider_authentication_command_settlement_unconfirmed",
              step.key,
              resources,
              step.resource,
            ),
          onResourceIdentified: (key, snapshot) => {
            resources = Object.freeze({ ...resources, snapshot });
            if (!callbacks.onResourceIdentified)
              throw Error(
                "provider_authentication_resource_receipt_unconfirmed",
              );
            required(
              callbacks.onResourceIdentified,
              "provider_authentication_resource_receipt_unconfirmed",
              key,
              resources,
            );
          },
          onCreated: (step, snapshot) => {
            resources = Object.freeze({ ...resources, snapshot });
            const resource = snapshot.resources.find(
              (r) => r.key === step.resource,
            );
            if (!resource?.identity.dockerId)
              throw Error(
                "provider_authentication_resource_receipt_unconfirmed",
              );
            required(
              callbacks.onResourceCreated,
              "provider_authentication_resource_receipt_unconfirmed",
              Object.freeze({
                key: step.resource,
                name: resource.identity.name,
                dockerId: resource.identity.dockerId,
              }),
              resources,
            );
          },
          onCompleted: (step, commandResult) => {
            const result = commandResult.observation;
            required(
              callbacks.onCommandCompleted,
              "provider_authentication_command_settlement_unconfirmed",
            );
            if (step.key !== "start_probe_attached") return;
            const observed = parseProviderResult(
              getAuthenticationDefinition(
                request.provider,
                request.action === "login" ? "login" : "execution",
              ),
              {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: result.status,
              },
            );
            if (
              result.status !== 0 &&
              !(
                request.action === "status" &&
                result.status === 1 &&
                observed.status === "unconfirmed"
              )
            ) {
              reason = "provider_authentication_start_probe_attached_failed";
              throw Error(reason);
            }
            authenticationStatus = observed.status;
            authenticationConfirmed = observed.status === "confirmed";
            if (
              !authenticationConfirmed &&
              !(
                request.action === "status" && observed.status === "unconfirmed"
              )
            ) {
              reason = "provider_authentication_not_confirmed";
              throw Error(reason);
            }
          },
          onCleanupSubmitting: (key) =>
            required(
              callbacks.onCommandSubmitting,
              "provider_authentication_command_intent_unconfirmed",
              `remove_${key}`,
              resources,
              key,
            ),
          onCleanupCompleted: () =>
            required(
              callbacks.onCommandCompleted,
              "provider_authentication_command_settlement_unconfirmed",
            ),
        });
        lifecycle.bind(session);
      } catch {
        lifecycle.finish();
        return Object.freeze({
          kind: "authentication",
          status: "blocked",
          reason: "provider_authentication_docker_boundary_unavailable",
          completion: null,
        });
      }
      return Object.freeze({
        kind: "authentication",
        status: "started",
        completion: session.completion
          .then(
            (technical) => {
              try {
                const resultSource = technical;
                if (!resultSource)
                  throw Error("provider_authentication_completion_unconfirmed");
                if (reason === "provider_authentication_completed") {
                  if (!resultSource.processTerminationConfirmed)
                    reason =
                      "provider_authentication_process_completion_unconfirmed";
                  else if (lifecycle.cancellationRequested)
                    reason = "provider_authentication_cancelled";
                  else if (resultSource.failure)
                    reason = `provider_authentication_${resultSource.failure.stepKey ?? "preparation"}_failed`;
                }
                const result: AuthenticationCompletionResult = Object.freeze({
                  kind: "authentication",
                  reason,
                  authenticationStatus,
                  authenticationConfirmed,
                  providerEffectIssued: resultSource.resources.resources.some(
                    (r) => r.request !== "not_issued",
                  ),
                  processCompletionConfirmed:
                    resultSource.processTerminationConfirmed,
                  cleanupConfirmed: resultSource.cleanup.confirmed,
                  resourceSnapshot: resultSource.resources,
                  resourceObservations: resultSource.cleanup.observations,
                  status:
                    resultSource.cleanup.confirmed &&
                    resultSource.processTerminationConfirmed
                      ? reason === "provider_authentication_cancelled"
                        ? "cancelled"
                        : reason === "provider_authentication_completed"
                          ? "completed"
                          : "blocked"
                      : "blocked",
                });
                return result;
              } finally {
                lifecycle.finish();
              }
            },
            (failure: unknown) => {
              lifecycle.finish();
              throw failure;
            },
          )
          .then((result) => {
            try {
              const pending = callbacks.onCompleted?.(result);
              if (pending) void pending.catch(() => {});
            } catch {
              /* 任意通知は確定結果を変更しない。 */
            }
            return result;
          }),
      });
    },
    cancel: () => lifecycle.cancel(),
  });
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
export function notifyAuthentication(
  notify: ((...args: never[]) => void) | undefined,
  ...arguments_: unknown[]
): void {
  if (!notify) return;
  if (types.isAsyncFunction(notify))
    throw Error("provider_authentication_notification_unconfirmed");
  const result: unknown = Reflect.apply(notify, undefined, arguments_);
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

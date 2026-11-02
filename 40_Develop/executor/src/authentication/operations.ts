/**
 * AIツール認証固有の構成・実行と技術回収を所有する。
 * @responsibility 保存通知を待ち、同じPlanのProcess終了・資源回収を上位判断から分離する。
 * @trace ARCH-000010
 */

import { types } from "node:util";
import {
  describeProviderAuthentication,
  evaluateProviderAuthentication,
} from "../../../ai-adapter/src/index.ts";
import {
  cleanupIsolation,
  describeIsolationCapabilities,
  executeIsolation,
  type IsolationExecution,
  type IsolationRequest,
  prepareIsolation,
} from "../../../docker-isolation/src/index.ts";
import { createLifecycleOperations } from "../lifecycle/operations.ts";
import type {
  AuthenticationResourceTarget,
  Executor,
} from "../lifecycle/types.ts";
import type {
  AuthenticationCallbacks,
  AuthenticationCleanupResult,
  AuthenticationCompletionResult,
  AuthenticationProjection,
  AuthenticationRequest,
  AuthenticationResult,
  DockerAuthenticationResources,
} from "./types.ts";

/**
 * 認証再入場の確定Receiptを、通常と同じDI Cleanupへ搬送する。
 * @responsibility 認証の固定対象だけを選び、技術的な照合・削除・不存在を再実装しない。
 * @trace ARCH-000010
 * @input target: 同じHome Lock下で上位が確定した資源・管理所在・通知。
 * @returns Process終了と技術回収の個別結果。
 * @effect DI共通回収だけ。login・statusの実行は発行しない。
 * @failure ID欠測は正規不存在観測だけを許し、名前だけで削除しない。
 */
export async function cleanupAuthenticationResources(
  target: AuthenticationResourceTarget,
): Promise<AuthenticationCleanupResult> {
  let session: IsolationExecution | null = null;
  const stop = () => {
    void session?.cancel().catch(() => {});
  };
  try {
    target.signal?.throwIfAborted();
    const input = authenticationIsolationRequest(
      target.request,
      target.managementDirectory,
    );
    const expected = input.cleanupOrder.map((key) => {
      const resource = input.resources.find((r) => r.key === key);
      if (!resource) throw Error("provider_authentication_resource_missing");
      return Object.freeze({
        kind: resource.kind,
        name: resource.name,
        dockerId: null,
      });
    });
    const receipts = captureAuthenticationResources(expected, target.resources);
    if (!receipts)
      return { confirmed: false, processCompletionConfirmed: false };
    const callbacks = target.callbacks ?? {};
    session = cleanupIsolation(
      {
        managementDirectory: target.managementDirectory,
        resources: {
          resources: input.cleanupOrder.map((key, i) => {
            const receipt = receipts[i];
            if (!receipt)
              throw Error("provider_authentication_resource_missing");
            return {
              key,
              identity: {
                ...receipt,
                ownershipLabel: input.resources[0]?.ownershipLabel ?? "",
              },
              request:
                receipt.dockerId === null
                  ? ("unknown" as const)
                  : ("issued" as const),
              configuration: {
                image: null,
                command: null,
                environmentNames: null,
                mounts: null,
                networks: null,
                internal: null,
              },
            };
          }),
        },
        cleanupOrder: input.cleanupOrder,
        setupTimeoutMs: 30_000,
        unreceiptedAbsence: "observe",
        verifyLabelAbsence: false,
        discovery: [],
        previouslyAbsent: [],
      },
      {
        onCleanupSubmitting: (key) =>
          notifyAuthentication(callbacks.onCommandSubmitting, `remove_${key}`),
        onCleanupCompleted: () =>
          notifyAuthentication(callbacks.onCommandCompleted),
      },
    );
    target.signal?.addEventListener("abort", stop, { once: true });
    if (target.signal?.aborted) stop();
    const result = await session.completion;
    return Object.freeze({
      confirmed: result.cleanup.confirmed,
      processCompletionConfirmed: result.processTerminationConfirmed,
      resourceSnapshot: result.resources,
    });
  } catch {
    return Object.freeze({
      confirmed: false,
      processCompletionConfirmed: false,
    });
  } finally {
    target.signal?.removeEventListener("abort", stop);
  }
}

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
  const cli = describeProviderAuthentication(request.provider);
  const capabilities = describeIsolationCapabilities(request.provider);
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
    if (
      !topology.providerNetworkInternal ||
      topology.providerDirectExternalNetwork ||
      !request.proxyToken
    )
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
        environment: {
          CRDD_PROXY_AUTH: request.proxyToken,
          CRDD_PROXY_PROFILE: request.provider,
        },
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
          HTTPS_PROXY: `http://crdd:${request.proxyToken}@proxy:${topology.containerPort}`,
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
): Executor<"authentication"> | null {
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
  const lifecycle = createLifecycleOperations();
  const projection: AuthenticationProjection = Object.freeze({
    provider: request.provider,
    action: request.action,
    ownershipLabel: `crdd.coordinator.authentication=${request.suffix}`,
    resources: Object.freeze(
      input.cleanupOrder.map((key) => {
        const resource = input.resources.find((r) => r.key === key);
        if (!resource) throw Error("provider_authentication_resource_missing");
        return Object.freeze({
          kind: resource.kind,
          name: resource.name,
          dockerId: null,
        });
      }),
    ),
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
        value?: unknown,
      ) => {
        try {
          notifyAuthentication(notify, value);
        } catch (error) {
          if (reason === "provider_authentication_completed") reason = failed;
          throw error;
        }
      };
      try {
        const prepared = prepareIsolation(input);
        if (!prepared)
          throw Error("provider_authentication_preparation_failed");
        session = executeIsolation(prepared, {
          onSubmitting: (step) =>
            required(
              callbacks.onCommandSubmitting,
              "provider_authentication_command_intent_unconfirmed",
              step.key,
            ),
          onCreated: (step, snapshot) => {
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
                name: resource.identity.name,
                dockerId: resource.identity.dockerId,
              }),
            );
          },
          onCompleted: (step, result) => {
            required(
              callbacks.onCommandCompleted,
              "provider_authentication_command_settlement_unconfirmed",
            );
            if (step.key !== "start_probe_attached") return;
            const observed = evaluateProviderAuthentication(
              request.provider,
              describeProviderAuthentication(request.provider).offering,
              result.stdout,
              result.stderr,
              request.action === "login" ? "login" : "execution",
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
            ),
          onCleanupCompleted: () =>
            required(
              callbacks.onCommandCompleted,
              "provider_authentication_command_settlement_unconfirmed",
            ),
        });
        lifecycle.bindCancellation(
          async () => (await session.cancel()).processTerminationObserved,
        );
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
        completion: (async () => {
          try {
            const technical = await session.completion;
            if (reason === "provider_authentication_completed") {
              if (!technical.processTerminationConfirmed)
                reason =
                  "provider_authentication_process_completion_unconfirmed";
              else if (lifecycle.cancellationRequested)
                reason = "provider_authentication_cancelled";
              else if (technical.failure)
                reason = `provider_authentication_${technical.failure.stepKey ?? "preparation"}_failed`;
            }
            const result: AuthenticationCompletionResult = Object.freeze({
              kind: "authentication",
              reason,
              authenticationStatus,
              authenticationConfirmed,
              providerEffectIssued: technical.resources.resources.some(
                (r) => r.request !== "not_issued",
              ),
              processCompletionConfirmed: technical.processTerminationConfirmed,
              cleanupConfirmed: technical.cleanup.confirmed,
              resourceSnapshot: technical.resources,
              status:
                technical.cleanup.confirmed &&
                technical.processTerminationConfirmed
                  ? reason === "provider_authentication_cancelled"
                    ? "cancelled"
                    : reason === "provider_authentication_completed"
                      ? "completed"
                      : "blocked"
                  : "blocked",
            });
            lifecycle.finish();
            try {
              const pending = callbacks.onCompleted?.(result);
              if (pending) void pending.catch(() => {});
            } catch {
              /* 任意通知は結果を変更しない。 */
            }
            return result;
          } finally {
            lifecycle.finish();
          }
        })(),
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
 * 元認証計画と同じ資源列だけを通常データとして捕捉する。
 * @responsibility 欠測、順序・名前差、accessor、Proxyと不正IDを拒否する。
 * @trace ARCH-000010
 * @input expected: 元の資源列。value: 開始時又は再入場時のReceipt列。
 * @returns 入れ子を含め固定した元構成のReceipt列、又はnull。
 * @effect N/A: own-dataの読取りだけ。
 * @failure 分類不能・不一致はnull。
 * @invariant indexだけで別資源を結合しない。
 */
export function captureAuthenticationResources(
  expected: DockerAuthenticationResources,
  value: unknown,
): DockerAuthenticationResources | null {
  if (
    !Array.isArray(value) ||
    types.isProxy(value) ||
    value.length !== expected.length
  )
    return null;
  const captured = [];
  for (let index = 0; index < expected.length; index++) {
    const original = expected[index];
    if (!original) return null;
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    const item: unknown =
      descriptor && Object.hasOwn(descriptor, "value")
        ? descriptor.value
        : null;
    if (!item || typeof item !== "object" || types.isProxy(item)) return null;
    const fields = Object.getOwnPropertyDescriptors(item);
    if (
      Reflect.ownKeys(fields).length !== 3 ||
      ["kind", "name", "dockerId"].some(
        (key) => !fields[key] || !Object.hasOwn(fields[key], "value"),
      )
    )
      return null;
    const kind: unknown = fields.kind?.value,
      name: unknown = fields.name?.value,
      dockerId: unknown = fields.dockerId?.value;
    if (
      kind !== original.kind ||
      name !== original.name ||
      (dockerId !== null &&
        (typeof dockerId !== "string" || !/^[a-f0-9]{64}$/u.test(dockerId)))
    )
      return null;
    captured.push(
      Object.freeze({ kind: original.kind, name: original.name, dockerId }),
    );
  }
  return Object.freeze(captured);
}

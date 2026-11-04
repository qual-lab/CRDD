/**
 * 固定合成Probe固有の作成構成・実行・結果解釈を所有する。
 * @packageDocumentation
 * @responsibility 上位保存の通知を挟み、DIの技術観測だけを返す。
 * @trace ARCH-000008
 * @boundary 保存・Host終了判断は上位、Docker実操作はDI。永続化しない。
 */

import { types } from "node:util";
import {
  describeIsolationConfiguration,
  executeIsolation,
  type IsolationExecution,
  type IsolationExecutionResult,
  type PreparedIsolation,
  prepareIsolation,
} from "../../../docker-isolation/src/index.ts";
import { executeLifecycle } from "../lifecycle/execute.ts";
import { createLifecycleOperations } from "../lifecycle/operations.ts";
import type { Executor, StartInput } from "../lifecycle/types.ts";
import { describeIsolationProbeProfile } from "./configuration.ts";
import { classifyIsolationProbeExecution } from "./result.ts";
import type {
  IsolationProbeMounts,
  IsolationProbeOptions,
  IsolationProbeProfile,
  IsolationProbeRequest,
  IsolationProbeResult,
} from "./types.ts";

/**
 * 上位の同期保存通知を呼び、誤った非同期返却を許可にしない。
 * @responsibility ACKや新しい通知基盤を追加せず、必要保存の完了境界を維持する。
 * @trace ARCH-000008
 * @input callback: 保存を完了してreturnする通知。value: 作成実ID。
 * @returns 正常完了だけ。
 * @precondition 未登録は独立実行で保存不要な場合だけ利用する。
 * @postcondition 誤PromiseのRejectを捕捉し、次Effectを止める。
 * @effect 登録通知一回。
 * @failure throw・async・値返却を拒否する。
 * @invariant 正常returnを実資源観測の代用にしない。
 * @boundary Executor通知と上位保存。
 * @security Command・所在・Credentialを通知しない。
 * @concurrency 同期通知だけを受け付ける。
 */
function notify(
  callback: ((value: string) => void) | undefined,
  value: string,
): void {
  if (!callback) return;
  if (types.isAsyncFunction(callback))
    throw new Error("docker_probe_notification_invalid");
  const result: unknown = callback(value);
  if (result !== undefined) {
    if (types.isPromise(result))
      void Promise.prototype.then.call(result, undefined, () => undefined);
    throw new Error("docker_probe_notification_invalid");
  }
}

/**
 * 固定Probeの構成と一回の技術生涯を結合する。
 * @responsibility 実IDを通知失敗でも保持し、既知資源だけを補償回収する。
 * @trace ARCH-000008
 * @input request: 固定相関。options: 固定四所在。profile: 内部検証専用選択。
 * @returns startとcancelを持つ一回のExecutor、不正相関はnull。
 * @precondition 上位が保存・Owner・Mount利用許可を所有する。
 * @postcondition 構成だけではDockerを呼ばず、完了は回収確認まで待つ。
 * @effect start後だけ固定Container操作。保存・Host処置は行わない。
 * @failure 作成不明は再作成せず、終了不明は回収成功にしない。
 * @invariant 任意Profileを製品Requestで公開しない。実IDなしで削除しない。
 * @boundary 既存createExecutor入口とDIの固定Probe。
 * @security Provider・Model・Repository本文・Networkを要求しない。
 * @concurrency 一回start、同じSignalの取消、待機後もDIが元Directory実体を再確認する。
 */
export function createIsolationProbe(
  request: IsolationProbeRequest,
  options: IsolationProbeOptions,
  profile: Exclude<IsolationProbeProfile, "cancellation"> = "normal",
): Executor<"isolation_probe"> | null {
  if (
    !request ||
    typeof request !== "object" ||
    types.isProxy(request) ||
    !options ||
    typeof options !== "object" ||
    types.isProxy(options)
  )
    return null;
  const probeId = Object.getOwnPropertyDescriptor(request, "probeId")?.value;
  if (
    Object.getOwnPropertyDescriptor(request, "kind")?.value !==
      "isolation_probe" ||
    Reflect.ownKeys(request).length !== 2 ||
    Reflect.ownKeys(options).length !== 1 ||
    typeof probeId !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
      probeId,
    )
  )
    return null;
  let prepared: PreparedIsolation | null;
  try {
    const mounts = captureMounts(
      Object.getOwnPropertyDescriptor(options, "mounts")?.value,
    );
    const specification = describeIsolationProbeProfile(profile);
    prepared = prepareIsolation({
      managementDirectory: mounts.management,
      resources: [
        {
          kind: "container",
          key: "probe",
          name: `crdd-coordinator-probe-${probeId}`,
          ownershipLabel: `crdd.coordinator.probe=${probeId}`,
          image: describeIsolationConfiguration().image,
          argv: ["-c", specification.source],
          environment: {
            HOME: "/operation/provider-home",
            TMPDIR: "/operation/tmp",
          },
          mounts: [
            {
              source: mounts.workspace,
              target: "/operation/workspace",
              readOnly: false,
            },
            {
              source: mounts.providerHome,
              target: "/operation/provider-home",
              readOnly: false,
            },
            { source: mounts.tmp, target: "/operation/tmp", readOnly: false },
          ],
          network: null,
          networkAlias: null,
          user: "65532:65532",
          workingDirectory: "/operation/workspace",
          entrypoint: "python",
          tmpfsBytes: null,
          interactive: false,
          tty: false,
          init: false,
          seccomp: null,
        },
      ],
      steps: [
        {
          key: "create_isolation_probe",
          action: "create",
          resource: "probe",
          timeoutMs: 30_000,
        },
        {
          key: "execute_isolation_probe",
          action: "run",
          resource: "probe",
          mode: "captured",
          stdin: null,
          timeoutMs: specification.timeoutMs,
          stdoutLimitBytes: 64 * 1024,
          stderrLimitBytes: 64 * 1024,
          acceptedExitCodes: [0, 7],
          deadlineOrigin: "request",
        },
      ],
      cleanupOrder: ["probe"],
      setupTimeoutMs: 10_000,
      unreceiptedAbsence: "retain",
      verifyLabelAbsence: true,
    });
  } catch {
    return null;
  }
  if (!prepared) return null;
  const original = prepared;
  const lifecycle = createLifecycleOperations();
  return Object.freeze<Executor<"isolation_probe">>({
    kind: "isolation_probe",
    start(input: StartInput<"isolation_probe">) {
      if (!lifecycle.start())
        return Object.freeze({
          kind: "isolation_probe",
          status: "blocked",
          reason: lifecycle.cancellationRequested
            ? "docker_probe_start_cancelled"
            : "docker_probe_already_started",
          completion: null,
        });
      const callbacks = input.callbacks ?? {};
      let facts: IsolationProbeResult["facts"] = null;
      let observedBeforeCancellation = false;
      let notificationFailure: string | null = null;
      let session: IsolationExecution;
      try {
        if (
          !callbacks ||
          typeof callbacks !== "object" ||
          types.isProxy(callbacks)
        )
          throw Error("docker_probe_notification_invalid");
        for (const key of Reflect.ownKeys(callbacks)) {
          const descriptor = Object.getOwnPropertyDescriptor(callbacks, key);
          if (
            ![
              "onCommandSubmitting",
              "onResourceCreated",
              "onCompleted",
            ].includes(String(key)) ||
            !descriptor ||
            !("value" in descriptor) ||
            typeof descriptor.value !== "function"
          )
            throw Error("docker_probe_notification_invalid");
        }
        session = executeIsolation(original, {
          onSubmitting(step) {
            if (step.action === "create") {
              try {
                notify(callbacks.onCommandSubmitting, "create_isolation_probe");
              } catch (error) {
                notificationFailure =
                  error instanceof Error &&
                  error.message === "docker_probe_notification_invalid"
                    ? error.message
                    : "docker_isolation_probe_failed";
                throw error;
              }
            }
          },
          onCreated(step, snapshot) {
            const id = snapshot.resources.find((r) => r.key === step.resource)
              ?.identity.dockerId;
            if (!id) throw Error("docker_container_identity_unknown");
            try {
              notify(callbacks.onResourceCreated, id);
            } catch (error) {
              notificationFailure =
                error instanceof Error &&
                error.message === "docker_probe_notification_invalid"
                  ? error.message
                  : "docker_isolation_probe_failed";
              throw error;
            }
          },
          onObserved(step, commandResult) {
            const {
              observation: result,
              elapsedMs,
              errorCode: code,
            } = commandResult;
            if (step.action !== "run") return;
            observedBeforeCancellation = !lifecycle.cancellationRequested;
            facts = classifyIsolationProbeExecution(
              {
                ...(result ?? {
                  status: null,
                  signal: null,
                  stdout: "",
                  stderr: "",
                }),
                ...(code
                  ? {
                      error: Object.assign(
                        new Error("probe transport failure"),
                        { code },
                      ),
                    }
                  : {}),
              },
              elapsedMs,
            );
          },
        });
        lifecycle.bindCancellation(
          async () => (await session.cancel()).processTerminationObserved,
        );
      } catch {
        lifecycle.finish();
        return Object.freeze({
          kind: "isolation_probe",
          status: "blocked",
          reason: "docker_probe_preparation_failed",
          completion: null,
        });
      }
      let technical: IsolationExecutionResult | null = null;
      return Object.freeze({
        kind: "isolation_probe",
        status: "started",
        completion: executeLifecycle(
          {
            async execute() {
              technical = await session.completion;
            },
            createResult(_context, _failure, failed): IsolationProbeResult {
              const result = technical as IsolationExecutionResult | null;
              const observedFacts = facts as IsolationProbeResult["facts"];
              const resource = result?.resources.resources.find(
                (r) => r.key === "probe",
              );
              const containerId = resource?.identity.dockerId ?? null;
              const creationAttempted =
                resource?.request !== undefined &&
                resource.request !== "not_issued";
              const cleanupConfirmed = result?.cleanup.confirmed === true;
              const processCompletionConfirmed =
                result?.processTerminationConfirmed === true;
              const reason =
                notificationFailure ??
                (!processCompletionConfirmed
                  ? "dynamic_fake_provider_attach_process_termination_unconfirmed"
                  : observedBeforeCancellation &&
                      observedFacts?.isolation.status === "blocked"
                    ? observedFacts.isolation.reason
                    : lifecycle.cancellationRequested
                      ? "docker_probe_start_cancelled"
                      : result?.failure?.reason ===
                          "docker_isolation_engine_unconfirmed"
                        ? "local_docker_desktop_linux_engine_required"
                        : result?.failure?.reason ===
                            "docker_isolation_directory_changed"
                          ? "owned_operation_mount_replaced"
                          : creationAttempted && containerId === null
                            ? "docker_container_identity_unknown"
                            : observedFacts?.isolation.status === "blocked"
                              ? observedFacts.isolation.reason
                              : result?.failure
                                ? "docker_isolation_probe_failed"
                                : !cleanupConfirmed
                                  ? "docker_probe_cleanup_failed"
                                  : (observedFacts?.isolation.reason ??
                                    "docker_isolation_probe_failed"));
              return Object.freeze({
                kind: "isolation_probe",
                status:
                  !failed && cleanupConfirmed && processCompletionConfirmed
                    ? reason === "docker_probe_start_cancelled"
                      ? "cancelled"
                      : !result?.failure &&
                          observedFacts?.isolation.status === "confirmed"
                        ? "completed"
                        : "blocked"
                    : "blocked",
                reason,
                creationAttempted,
                containerId,
                facts: observedFacts,
                resourceSnapshot: result?.resources ?? null,
                cleanupConfirmed,
                processCompletionConfirmed,
                cancelled: lifecycle.cancellationRequested,
              });
            },
            onCompleted: (result) => callbacks.onCompleted?.(result),
          },
          undefined,
          lifecycle,
        ),
      });
    },
    cancel: () => lifecycle.cancel(),
  });
}

/**
 * 同じ四所在の通常dataだけを固定し、後発の入力変更を採用しない。
 * @responsibility QueryのPromise・Proxy・accessorをEffect前に拒否する。
 * @trace ARCH-000008
 * @input value: 上位が利用許可を確認した固定所在値。
 * @returns 所在四文字列の独立した不変値。
 * @precondition 所在の利用許可・実体確認は上位とDIが所有する。
 * @postcondition 呼出し側の可変Objectへの参照を保持しない。
 * @effect N/A: 値検査だけ。
 * @failure 欠測・余分field・非同期値は固定理由で拒否する。
 * @invariant 新しい所在・Path権限を発行しない。
 * @boundary 上位Queryと技術操作。
 * @security getterを実行せず秘密値を通知しない。
 * @concurrency await後も同じ検査を適用する。
 */
function captureMounts(value: unknown): IsolationProbeMounts {
  if (types.isPromise(value))
    void Promise.prototype.then.call(value, undefined, () => undefined);
  if (!value || typeof value !== "object" || types.isProxy(value))
    throw new Error("owned_operation_mount_replaced");
  const keys = ["management", "workspace", "providerHome", "tmp"] as const;
  if (Reflect.ownKeys(value).length !== keys.length)
    throw new Error("owned_operation_mount_replaced");
  const result = { management: "", workspace: "", providerHome: "", tmp: "" };
  for (const key of keys) {
    const item = Object.getOwnPropertyDescriptor(value, key)?.value;
    if (typeof item !== "string" || !item)
      throw new Error("owned_operation_mount_replaced");
    result[key] = item;
  }
  return Object.freeze(result);
}

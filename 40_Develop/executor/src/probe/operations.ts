/**
 * 固定合成Probe固有の作成構成・実行・結果解釈を所有する。
 * @packageDocumentation
 * @responsibility 上位保存の通知を挟み、DIの技術観測だけを返す。
 * @trace ARCH-000008
 * @boundary 保存・Host終了判断は上位、Docker実操作はDI。永続化しない。
 */

import { types } from "node:util";
import {
  cleanupDockerContainer,
  createDockerProbeContainer,
  createDockerProbeRuntimeBinding,
  type DockerProbeProfile,
  describeDockerProbeConfiguration,
  inspectDockerContainer,
  observeDockerProbeEngine,
  runDockerProbeAsync,
} from "../../../docker-isolation/src/index.ts";
import { executeLifecycle } from "../lifecycle/execute.ts";
import { createLifecycleOperations } from "../lifecycle/operations.ts";
import type { Executor, StartInput } from "../lifecycle/types.ts";
import type {
  IsolationProbeOptions,
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
 * @input request: 固定相関。options: 現在所在Query。profile: 内部検証専用選択。
 * @returns startとcancelを持つ一回のExecutor、不正相関はnull。
 * @precondition 上位が保存・Owner・Mount利用許可を所有する。
 * @postcondition 構成だけではDockerを呼ばず、完了は回収確認まで待つ。
 * @effect start後だけ固定Container操作。保存・Host処置は行わない。
 * @failure 作成不明は再作成せず、終了不明は回収成功にしない。
 * @invariant 任意Profileを製品Requestで公開しない。実IDなしで削除しない。
 * @boundary 既存createExecutor入口とDIの固定Probe。
 * @security Provider・Model・Repository本文・Networkを要求しない。
 * @concurrency 一回start、同じSignalの取消、await後は現在所在を再確認する。
 */
export function createIsolationProbe(
  request: IsolationProbeRequest,
  options: IsolationProbeOptions,
  profile: Exclude<DockerProbeProfile, "cancellation"> = "normal",
): Executor<"isolation_probe"> | null {
  if (
    !request ||
    typeof request !== "object" ||
    !options ||
    typeof options !== "object" ||
    types.isProxy(request) ||
    types.isProxy(options)
  )
    return null;
  const probeId = Object.getOwnPropertyDescriptor(request, "probeId")?.value;
  const read = Object.getOwnPropertyDescriptor(options, "readMounts")?.value;
  if (
    Object.getOwnPropertyDescriptor(request, "kind")?.value !==
      "isolation_probe" ||
    Reflect.ownKeys(request).length !== 2 ||
    Reflect.ownKeys(options).length !== 1
  )
    return null;
  if (
    typeof probeId !== "string" ||
    typeof read !== "function" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(
      probeId,
    )
  )
    return null;
  const lifecycle = createLifecycleOperations();
  return Object.freeze<Executor<"isolation_probe">>({
    kind: "isolation_probe",
    start(input: StartInput<"isolation_probe">) {
      const callbacks = input.callbacks ?? {};
      if (!lifecycle.start())
        return Object.freeze({
          kind: "isolation_probe",
          status: "blocked",
          reason: "docker_probe_already_started",
          completion: null,
        });
      try {
        if (
          !callbacks ||
          typeof callbacks !== "object" ||
          types.isProxy(callbacks)
        )
          throw new Error("docker_probe_notification_invalid");
        for (const key of Reflect.ownKeys(callbacks)) {
          const descriptor = Object.getOwnPropertyDescriptor(callbacks, key);
          if (
            (key !== "onCommandSubmitting" &&
              key !== "onResourceCreated" &&
              key !== "onCompleted") ||
            !descriptor ||
            !("value" in descriptor) ||
            typeof descriptor.value !== "function"
          )
            throw new Error("docker_probe_notification_invalid");
        }
      } catch (error) {
        lifecycle.finish();
        throw error;
      }
      return Object.freeze({
        kind: "isolation_probe",
        status: "started",
        completion: execute().finally(() => lifecycle.finish()),
      });
      async function execute(): Promise<IsolationProbeResult> {
        let containerId: string | null = null;
        let creationAttempted = false,
          cleanupConfirmed = false,
          processCompletionConfirmed = true;
        let facts: IsolationProbeResult["facts"] = null;
        let reason: string | null = null;
        const initial = captureMounts(read());
        const readMounts = () => {
          const current = captureMounts(read());
          if (
            Object.keys(initial).some(
              (key) =>
                current[key as keyof typeof current] !==
                initial[key as keyof typeof initial],
            )
          )
            throw new Error("owned_operation_mount_replaced");
          return current;
        };
        const cli = createDockerProbeRuntimeBinding(
          () => readMounts().management,
        );
        return executeLifecycle(
          {
            async execute() {
              try {
                if (lifecycle.signal.aborted)
                  throw new Error("docker_probe_start_cancelled");
                if (!observeDockerProbeEngine(cli)) {
                  reason = "local_docker_desktop_linux_engine_required";
                  return;
                }
                notify(callbacks.onCommandSubmitting, "create_isolation_probe");
                if (lifecycle.signal.aborted)
                  throw new Error("docker_probe_start_cancelled");
                const mounts = readMounts();
                creationAttempted = true;
                const creation = createDockerProbeContainer(
                  cli,
                  profile,
                  probeId,
                  {
                    workspace: mounts.workspace,
                    providerHome: mounts.providerHome,
                    tmp: mounts.tmp,
                  },
                );
                if (creation.status !== "confirmed") {
                  reason = "docker_container_identity_unknown";
                } else {
                  containerId = creation.id;
                  notify(callbacks.onResourceCreated, containerId);
                  if (lifecycle.signal.aborted)
                    throw new Error("docker_probe_start_cancelled");
                  const current = readMounts();
                  const expected = describeDockerProbeConfiguration(
                    profile,
                    { id: containerId, probeId },
                    {
                      workspace: current.workspace,
                      providerHome: current.providerHome,
                      tmp: current.tmp,
                    },
                  );
                  if (!inspectDockerContainer(cli, expected))
                    throw new Error(
                      "docker_container_security_profile_mismatch",
                    );
                  readMounts();
                  processCompletionConfirmed = false;
                  const execution = await runDockerProbeAsync(
                    cli,
                    profile,
                    containerId,
                    lifecycle.signal,
                  );
                  processCompletionConfirmed =
                    execution.processCompletionConfirmed;
                  facts = execution.facts;
                  readMounts();
                  reason = !processCompletionConfirmed
                    ? "dynamic_fake_provider_attach_process_termination_unconfirmed"
                    : execution.cancelled
                      ? "docker_probe_start_cancelled"
                      : facts.isolation.reason;
                }
              } catch (error) {
                const message = error instanceof Error ? error.message : "";
                reason = [
                  "owned_operation_mount_replaced",
                  "docker_probe_start_cancelled",
                  "docker_container_security_profile_mismatch",
                  "docker_probe_notification_invalid",
                ].includes(message)
                  ? message
                  : "docker_isolation_probe_failed";
              }
            },
            shouldCleanup: () => processCompletionConfirmed,
            async cleanup() {
              if (containerId) {
                try {
                  const current = readMounts();
                  const cleanup = cleanupDockerContainer(
                    cli,
                    describeDockerProbeConfiguration(
                      profile,
                      { id: containerId, probeId },
                      {
                        workspace: current.workspace,
                        providerHome: current.providerHome,
                        tmp: current.tmp,
                      },
                    ),
                  );
                  cleanupConfirmed = cleanup.confirmed;
                  if (!cleanupConfirmed) reason = cleanup.reason;
                } catch {
                  cleanupConfirmed = false;
                  reason = "docker_probe_cleanup_failed";
                }
              }
            },
            createResult(_context, _failure, failed) {
              if (failed) reason ??= "docker_isolation_probe_failed";
              const final: IsolationProbeResult = Object.freeze({
                kind: "isolation_probe",
                status:
                  !failed && cleanupConfirmed && processCompletionConfirmed
                    ? reason === "docker_probe_start_cancelled"
                      ? "cancelled"
                      : facts?.isolation.status === "confirmed" &&
                          reason === facts.isolation.reason
                        ? "completed"
                        : "blocked"
                    : "blocked",
                reason,
                creationAttempted,
                containerId,
                facts,
                cleanupConfirmed,
                processCompletionConfirmed,
                cancelled: lifecycle.signal.aborted,
              });
              return final;
            },
            onCompleted: (result) => callbacks.onCompleted?.(result),
          },
          undefined,
          lifecycle,
        );
      }
    },
    async cancel(_input) {
      return lifecycle.cancel();
    },
  });
}

/**
 * 同じ四所在の通常dataだけを固定し、後発の入力変更を採用しない。
 * @responsibility QueryのPromise・Proxy・accessorをEffect前に拒否する。
 * @trace ARCH-000008
 * @input value: 上位が現在Owner確認後に返す所在値。
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
function captureMounts(value: unknown): Readonly<{
  management: string;
  workspace: string;
  providerHome: string;
  tmp: string;
}> {
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

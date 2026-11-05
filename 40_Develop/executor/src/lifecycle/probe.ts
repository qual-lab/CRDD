/**
 * 隔離診断の固定構成・通知と三値結果を解釈する。
 * @packageDocumentation
 * @responsibility 上位の判断・永続化とDIの技術実行を再実装しない。
 * @trace ARCH-000008
 */
import type {
  IsolationProbeProfile,
  IsolationProbeFacts,
  Executor,
  StartInput,
  IsolationProbeMounts,
  IsolationProbeOptions,
  IsolationProbeRequest,
  IsolationProbeResult,
} from "./types.ts";
import {
  type IsolationCommandResult,
  describeIsolationConfiguration,
  executeIsolation,
  type IsolationExecution,
  type IsolationExecutionResult,
  type PreparedIsolation,
  prepareIsolation,
} from "../../../docker-isolation/src/index.ts";
import { types } from "node:util";
import { createLifecycleControl } from "./execute.ts";

type ProbeExecutionObservation = Partial<
  Pick<
    NonNullable<IsolationCommandResult["observation"]>,
    "signal" | "status" | "stderr" | "stdout"
  >
> &
  Readonly<{ error?: Error }>;

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
  IsolationProbeProfile,
  Readonly<{ source: string; timeoutMs: number }>
>);

/** 固定profileを選び、任意Scriptへのfallbackを行わない。 */
export function describeIsolationProbeProfile(
  profile: IsolationProbeProfile,
): Readonly<{ source: string; timeoutMs: number }> {
  if (typeof profile !== "string" || !Object.hasOwn(PROFILES, profile))
    throw Error("docker_probe_profile_invalid");
  return PROFILES[profile];
}

/** JSON出力の閉じたfield集合を検査する。 */
function isProbeJsonRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

/**
 * 診断の完了観測を既存の隔離判定と実行事実へ分類する。
 * @responsibility 生出力を返さず、判定理由・計測・終了値を保持する。
 * @trace ARCH-000008
 * @input execution: 元のProcess観測、elapsedMs: 同じ呼出しの実測値。
 * @returns 隔離判定と後続lifecycle評価に必要な閉事実。
 * @precondition 本番ではDIの所有要求から得た観測を使う。
 * @postcondition 値分類を資源不存在やHost清掃へ昇格しない。
 * @effect N/A: 純粋分類だけ。
 * @failure 期限・容量・不正JSON・非0・Signal・時間不正を区別する。
 * @invariant 既存の理由優先順と30秒の計測評価上限を維持する。
 * @boundary 捕捉出力と上位への最小事実。
 * @security stdout／stderr本文と例外本文を返さない。
 * @concurrency 同期分類だけ。
 */
export function classifyIsolationProbeExecution(
  execution: ProbeExecutionObservation,
  elapsedMs: number,
): IsolationProbeFacts {
  const code =
    execution.error && typeof execution.error === "object"
      ? Object.getOwnPropertyDescriptor(execution.error, "code")?.value
      : undefined;
  const timedOut = code === "ETIMEDOUT";
  const outputExceeded = code === "ENOBUFS";
  const stdoutBytes =
    typeof execution.stdout === "string"
      ? Buffer.byteLength(execution.stdout, "utf8")
      : 0;
  const stderrBytes =
    typeof execution.stderr === "string"
      ? Buffer.byteLength(execution.stderr, "utf8")
      : 0;
  let reason: string;
  let confirmed = false;
  if (timedOut) reason = "docker_isolation_probe_timeout";
  else if (outputExceeded) reason = "docker_isolation_probe_output_too_large";
  else if (
    execution.error ||
    execution.status !== 0 ||
    typeof execution.stdout !== "string"
  )
    reason = "docker_isolation_probe_failed";
  else if (stdoutBytes > 64 * 1024)
    reason = "docker_isolation_probe_output_too_large";
  else {
    try {
      const parsed: unknown = JSON.parse(execution.stdout.trim());
      const record = isProbeJsonRecord(parsed, [
        "marker",
        "allowed_writes",
        "runtime_paths_absent",
        "credential_names_absent",
        "network_blocked",
        "home_isolated",
        "tmp_isolated",
      ])
        ? parsed
        : null;
      const writes =
        record &&
        isProbeJsonRecord(record.allowed_writes, [
          "workspace",
          "provider-home",
          "tmp",
        ])
          ? record.allowed_writes
          : null;
      confirmed =
        record?.marker === PROBE_MARKER &&
        writes?.workspace === true &&
        writes?.["provider-home"] === true &&
        writes?.tmp === true &&
        record.runtime_paths_absent === true &&
        record.credential_names_absent === true &&
        record.network_blocked === true &&
        record.home_isolated === true &&
        record.tmp_isolated === true;
      reason = confirmed
        ? "docker_fake_provider_isolation_confirmed"
        : "docker_isolation_probe_assertion_failed";
    } catch {
      reason = "docker_isolation_probe_invalid_output";
    }
  }
  const validElapsed =
    Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= 30_000;
  const exactEnvelope =
    !execution.error &&
    execution.status === 0 &&
    (execution.signal === null || execution.signal === undefined) &&
    typeof execution.stdout === "string" &&
    typeof execution.stderr === "string" &&
    stdoutBytes <= 64 * 1024 &&
    stderrBytes <= 64 * 1024;
  return Object.freeze({
    isolation: Object.freeze({
      status: confirmed ? ("confirmed" as const) : ("blocked" as const),
      reason,
    }),
    lifecycleStatus:
      validElapsed && exactEnvelope && confirmed
        ? ("candidate" as const)
        : ("blocked" as const),
    lifecycleReason: timedOut
      ? "dynamic_fake_provider_deadline_exceeded"
      : outputExceeded
        ? "dynamic_fake_provider_output_limit_exceeded"
        : !validElapsed
          ? "dynamic_fake_provider_elapsed_invalid"
          : !exactEnvelope
            ? "dynamic_fake_provider_execution_envelope_invalid"
            : confirmed
              ? "dynamic_fake_provider_result_observed"
              : reason,
    elapsedMs: validElapsed ? elapsedMs : null,
    stdoutBytes,
    stderrBytes,
    exitCode: typeof execution.status === "number" ? execution.status : null,
    signal: typeof execution.signal === "string" ? execution.signal : null,
    timedOut,
  });
}

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
  const lifecycle = createLifecycleControl();
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
        lifecycle.bind(session);
      } catch {
        lifecycle.finish();
        return Object.freeze({
          kind: "isolation_probe",
          status: "blocked",
          reason: "docker_probe_preparation_failed",
          completion: null,
        });
      }
      function createResult(
        technical: IsolationExecutionResult | null,
        failed: boolean,
      ): IsolationProbeResult {
        const result = technical;
        const observedFacts = facts as IsolationProbeResult["facts"];
        const resource = result?.resources.resources.find(
          (r) => r.key === "probe",
        );
        const containerId = resource?.identity.dockerId ?? null;
        const creationAttempted =
          resource?.request !== undefined && resource.request !== "not_issued";
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
      }
      return Object.freeze({
        kind: "isolation_probe",
        status: "started",
        completion: session.completion
          .then(
            (technical) => {
              try {
                return createResult(technical, false);
              } finally {
                lifecycle.finish();
              }
            },
            () => {
              try {
                return createResult(null, true);
              } finally {
                lifecycle.finish();
              }
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

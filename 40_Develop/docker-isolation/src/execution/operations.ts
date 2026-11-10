/**
 * 三用途が共有する一回のDocker技術実行を所有する。
 * @responsibility 準備・通知・Process・取消・Receipt・回収・完了を同じOwnerへ閉じる。
 * @trace ARCH-000008
 */
import fs from "node:fs";
import path from "node:path";
import { types } from "node:util";
import { cleanupContainerResources } from "../cleanup/container.ts";
import { cleanupResourceIdentity } from "../cleanup/operations.ts";
import {
  type DockerRecoveryCommandResult,
  dockerResourceIdentityMatches,
  explicitDockerResourceAbsence,
  snapshotObservedDockerResource,
} from "../cleanup/resource.ts";
import type {
  ContainerResourceTarget,
  DirectoryResourceCleanupTarget,
  ResourceSnapshot,
  ResourceTarget,
  ResourceCleanupResult,
} from "../cleanup/types.ts";
import {
  createDockerCliConfig,
  observeDockerDirectoryIdentity,
  observeDockerProtectedMountIdentity,
  verifyDockerCliConfig,
} from "../docker-cli/config.ts";
import {
  type IsolationSettings,
  captureIsolationSettings,
  createDockerProcessEnvironment,
} from "../docker-cli/environment.ts";
import {
  type DockerCliTrustSnapshot,
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "../docker-cli/trust.ts";
import {
  type DirectoryCleanupResult,
  cleanupRepairDirectory,
} from "../docker-desktop/repair-session.ts";
import {
  type OwnedCommandHandle,
  startOwnedWindowsProcess,
} from "../process/start.ts";
import {
  captureIsolationCleanupRequest,
  captureIsolationRequest,
  containerCreation,
  inspectIsolationResourceConfiguration,
  plannedResourceSnapshot,
} from "./preparation.ts";
import {
  type CommandObservation,
  type IsolationCommandResult,
  classifyDockerCommandException,
  classifyDockerCommandExecution,
  classifyDockerProcessExit,
} from "./result.ts";
import type {
  IsolationCallbacks,
  IsolationCleanupRequest,
  IsolationExecution,
  IsolationExecutionResult,
  IsolationFailure,
  IsolationRequest,
  IsolationStep,
  PreparedIsolation,
} from "./types.ts";

export { inspectIsolation } from "../cleanup/resources.ts";

const DOCKER_EXECUTABLE =
  "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe";
const ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";
const TERMINATION_GRACE_MS = 5_000;

/** 同一Processの短命な準備と一回使用だけを保持する。永続台帳は作らない。 */
class IsolationPreparation implements PreparedIsolation {
  readonly resources: ResourceSnapshot;
  readonly request: IsolationRequest;
  readonly cli: DockerCliTrustSnapshot;
  readonly environment: Readonly<Record<string, string>>;
  readonly directories: readonly Readonly<{
    path: string;
    identity: string;
    protectedFile: boolean;
  }>[];
  readonly cleanupOnly: boolean;
  readonly previouslyAbsent: readonly string[];
  #used = false;

  constructor(
    value: IsolationRequest | IsolationCleanupRequest,
    settings: IsolationSettings,
    cleanupOnly = false,
  ) {
    settings = captureIsolationSettings(settings);
    this.cleanupOnly = cleanupOnly;
    if (cleanupOnly) {
      const cleanup = captureIsolationCleanupRequest(
        value as IsolationCleanupRequest,
      );
      this.request = Object.freeze({
        managementDirectory: cleanup.managementDirectory,
        resources: [],
        steps: [],
        cleanupOrder: cleanup.cleanupOrder,
        setupTimeoutMs: cleanup.setupTimeoutMs,
        unreceiptedAbsence: cleanup.unreceiptedAbsence,
        verifyLabelAbsence: cleanup.verifyLabelAbsence,
      });
      this.resources = cleanup.resources;
      this.previouslyAbsent = cleanup.previouslyAbsent;
    } else {
      this.request = captureIsolationRequest(value as IsolationRequest);
      this.resources = plannedResourceSnapshot(this.request);
      this.previouslyAbsent = [];
    }
    const request = this.request;
    this.cli = observeTrustedDockerCli(settings);
    this.environment = createDockerProcessEnvironment(settings);
    if (
      !this.environment.SystemRoot ||
      !fs
        .statSync(path.win32.join(this.environment.SystemRoot, "System32"))
        .isDirectory()
    )
      throw Error("docker_effect_working_directory_unavailable");
    const locations = new Map<string, boolean>([
      [request.managementDirectory, false],
    ]);
    for (const resource of request.resources)
      if (resource.kind === "container")
        for (const mount of resource.mounts) {
          const protectedFile = mount.target === "/work/.git" && mount.readOnly;
          locations.set(
            mount.source,
            (locations.get(mount.source) ?? true) && protectedFile,
          );
        }
    this.directories = Object.freeze(
      [...locations].map(([directory, protectedFile]) =>
        Object.freeze({
          path: directory,
          protectedFile,
          identity: protectedFile
            ? observeDockerProtectedMountIdentity(directory)
            : observeDockerDirectoryIdentity(directory),
        }),
      ),
    );
    for (const key of [
      "request",
      "cli",
      "environment",
      "directories",
      "cleanupOnly",
      "previouslyAbsent",
    ] as const)
      Object.defineProperty(this, key, { enumerable: false });
    Object.freeze(this);
  }

  /** 同じ準備済み隔離の二重実行を拒否し、最初の実行だけを消費済みにする。 */
  take(): void {
    if (this.#used) throw Error("docker_isolation_already_started");
    this.#used = true;
  }

  /** Directory Identityと信頼済みDocker CLIを再確認し、変化は実行前に拒否する。 */
  verify(): void {
    for (const directory of this.directories)
      if (
        (directory.protectedFile
          ? observeDockerProtectedMountIdentity(directory.path)
          : observeDockerDirectoryIdentity(directory.path)) !==
        directory.identity
      )
        throw Error("docker_isolation_directory_changed");
    verifyTrustedDockerCliSnapshot(this.cli);
  }
}
Object.freeze(IsolationPreparation.prototype);
Object.freeze(IsolationPreparation);

/**
 * 構成と元CLI・Directory実体を捕捉する。Docker資源やconfigは作らない。
 * @responsibility 外部待機前に入力の後発変更を分離する。
 * @trace ARCH-000008
 * @input request: Executorが確定した技術構成。
 * @returns 同Processの短命準備、不正又は観測不能ならnull。
 * @effect CLIとFilesystemの読取りだけ。
 * @failure 準備拒否ではDocker要求0。
 * @invariant Snapshotやコピーから実行を復元しない。
 */
export function prepareIsolation(
  request: IsolationRequest,
  settings: IsolationSettings,
): PreparedIsolation | null {
  try {
    return new IsolationPreparation(request, settings);
  } catch {
    return null;
  }
}

/**
 * 共通技術順序を一回だけ実行し、取消・終了・回収を完了結果へ接続する。
 * @responsibility Providerの意味を持たず、確定した構成を実行する。
 * @trace ARCH-000008
 * @input prepared: 元準備。callbacks: 必要通知と同期結果解釈。
 * @returns 取消と一回のCompletion。
 * @effect 返却後だけ固定Docker CLI・所有Process・限定回収を発行する。
 * @failure 開始時再検証の失敗を同じCompletionの一次停止点へ保持し、回収未確認と分離する。元準備以外・二重使用は同期拒否。
 * @invariant 通知失敗後の前進、終了不明での削除、Cleanup前の完了を禁止する。
 */
export function executeIsolation(
  prepared: PreparedIsolation,
  callbacks: IsolationCallbacks = {},
): IsolationExecution {
  if (!(prepared instanceof IsolationPreparation) || prepared.cleanupOnly)
    throw Error("docker_isolation_preparation_invalid");
  return runIsolation(prepared, callbacks);
}

/**
 * 単独回収も通常実行と同じProcess・Receipt・終了・回収Ownerで扱う。
 * @responsibility 保存された元Snapshotを固定し、任意Path削除や再実行を追加しない。
 * @trace ARCH-000008
 * @input request: 元資源・管理所在・ID欠測時だけの完全構成。callbacks: 必要通知。
 * @returns 同じ取消とCompletion。開始前検査不成立は例外。
 * @effect 返却後の観測・元ID回収だけ。
 * @invariant inspectの先行実行を要件にせず、実行Stepを発行しない。
 */
export function cleanupIsolation(
  request: ResourceTarget<"directory", "cleanup">,
  settings: import("../docker-cli/environment.ts").IsolationSettings,
): Promise<ResourceCleanupResult<"directory">>;
export function cleanupIsolation(
  request: ResourceTarget<"container">,
  settings: import("../docker-cli/environment.ts").IsolationSettings,
): ResourceCleanupResult<"container">;
export function cleanupIsolation(
  request: ResourceTarget<"snapshot", "cleanup">,
  settings: import("../docker-cli/environment.ts").IsolationSettings,
  callbacks?: IsolationCallbacks,
): IsolationExecution;
export function cleanupIsolation(
  request:
    | IsolationCleanupRequest
    | ContainerResourceTarget
    | DirectoryResourceCleanupTarget,
  settings: import("../docker-cli/environment.ts").IsolationSettings,
  callbacks: IsolationCallbacks = {},
):
  | IsolationExecution
  | Readonly<{ confirmed: boolean; reason: string }>
  | Promise<DirectoryCleanupResult> {
  if (
    request &&
    typeof request === "object" &&
    !types.isProxy(request) &&
    Object.getOwnPropertyDescriptor(request, "kind")?.value ===
      "docker_runtime_directory"
  )
    return cleanupRepairDirectory(
      (request as DirectoryResourceCleanupTarget).input,
      settings,
    );
  if (
    request &&
    typeof request === "object" &&
    !types.isProxy(request) &&
    Object.getOwnPropertyDescriptor(request, "kind")?.value === "container"
  )
    return cleanupContainerResources(
      request as ContainerResourceTarget,
      settings,
    );
  return runIsolation(
    new IsolationPreparation(
      request as IsolationCleanupRequest,
      settings,
      true,
    ),
    callbacks,
  );
}

/** 元準備に閉じた共通の技術生涯。用途ごとの生涯制御を持たない。 */
function runIsolation(
  prepared: IsolationPreparation,
  callbacks: IsolationCallbacks,
): IsolationExecution {
  prepared.take();
  const owner = prepared;
  const input = prepared.request;
  let notices: IsolationCallbacks | null = callbacks;
  let snapshot = prepared.resources;
  let cancelled = false,
    finished = false,
    cleaning = false;
  let failure: IsolationFailure | null = null;
  let step: IsolationStep | null = null;
  let stage: IsolationFailure["stage"] = "preparation";
  let notification: keyof IsolationCallbacks | null = null;
  let commandHandleObtained = false,
    responseObserved = false;
  let exceptionCode: string | null = null;
  let failureKind: IsolationFailure["kind"] = "command_failed";
  let delivered = true,
    notified = false,
    terminated = true;
  let active: OwnedCommandHandle | null = null;
  let config: Readonly<{ directory: string; identity: string }> | null = null;
  let configStarted = false;
  let observedElapsedMs = 0;
  let observedErrorCode: "ETIMEDOUT" | "ENOBUFS" | "PROCESS_FAILURE" | null =
    null;
  const handles = new Set<OwnedCommandHandle>();
  const terminations = new WeakMap<OwnedCommandHandle, Promise<boolean>>();
  const connections = new Map<string, string[]>();
  const definitions = new Map(input.resources.map((r) => [r.key, r]));
  let signalCancellation: () => void = () => undefined;
  const cancellation = new Promise<null>((resolve) => {
    signalCancellation = () => resolve(null);
  });

  /** 最初の失敗だけを固定し、自由文を公開結果へ含めない。 */
  function fail(reason: string): void {
    failure ??= Object.freeze({
      stepKey: step?.key ?? null,
      stage,
      reason,
      notification,
      commandHandleObtained,
      responseObserved,
      exceptionCode,
      kind: failureKind,
    });
  }

  /** 元Handleの終端要求を一回化し、終了確認を要求受付と分離する。 */
  function terminate(handle: OwnedCommandHandle): Promise<boolean> {
    let pending = terminations.get(handle);
    if (!pending) {
      pending = Promise.resolve()
        .then(() => handle.terminateAndWait(TERMINATION_GRACE_MS))
        .catch(() => false);
      terminations.set(handle, pending);
    }
    return pending;
  }

  /** 必要通知は待機し、同期通知の誤Promiseは捕捉して後続Effectを止める。 */
  async function notice(
    name: keyof IsolationCallbacks,
    args: readonly unknown[],
    synchronous = false,
  ): Promise<void> {
    const callback = notices?.[name];
    if (!callback) return;
    notified = true;
    const previous = stage;
    stage = "notification";
    notification = name;
    failureKind = "threw";
    try {
      if (synchronous && types.isAsyncFunction(callback)) {
        failureKind = "invalid_return";
        throw Error("docker_isolation_notification_invalid");
      }
      const value: unknown = Reflect.apply(callback, undefined, args);
      if (synchronous && value !== undefined) {
        failureKind = "invalid_return";
        void Promise.resolve(value).catch(() => {});
        throw Error("docker_isolation_notification_invalid");
      }
      if (!synchronous && (await value) !== undefined) {
        failureKind = "invalid_return";
        throw Error("docker_isolation_notification_invalid");
      }
      stage = previous;
      notification = null;
      failureKind = "command_failed";
    } catch (error) {
      delivered = false;
      exceptionCode = classifyDockerCommandException(error);
      fail("docker_isolation_notification_failed");
      throw Error("docker_isolation_notification_failed");
    }
  }

  /** 各要求直前に元CLI・Directory・自作configを再確認する。 */
  function verify(): void {
    owner.verify();
    if (config) verifyDockerCliConfig(config.directory, config.identity);
  }

  /** 一つの所有Processを開始・待機・joinし、生Handleを外へ返さない。 */
  async function command(
    argv: readonly string[],
    timeoutMs: number | null,
    stdin: string | null = null,
    interactive = false,
    stdoutLimitBytes = 1_048_576,
    stderrLimitBytes = 1_048_576,
    onStarted?: () => Promise<void>,
    createdResourceKey?: string,
    deadlineOrigin: "request" | "started" = "request",
  ): Promise<CommandObservation | null> {
    if (!terminated)
      throw Error("docker_isolation_process_termination_unconfirmed");
    verify();
    const executionConfig = config;
    if (!executionConfig) throw Error("docker_isolation_config_missing");
    if (cancelled && (!cleaning || owner.cleanupOnly)) return null;
    const systemRoot = owner.environment.SystemRoot;
    if (!systemRoot) throw Error("docker_effect_working_directory_unavailable");
    if (createdResourceKey) update(createdResourceKey, null, "unknown");
    const startedAt = performance.now();
    stage = "start";
    commandHandleObtained = false;
    responseObserved = false;
    exceptionCode = null;
    const handle = startOwnedWindowsProcess(
      DOCKER_EXECUTABLE,
      ["--host", ENGINE, "--config", executionConfig.directory, ...argv],
      owner.environment,
      stdin,
      {
        workingDirectory: path.win32.join(systemRoot, "System32"),
        interactive,
        stdoutLimitBytes,
        stderrLimitBytes,
      },
    );
    commandHandleObtained = true;
    stage = "wait";
    if (createdResourceKey) update(createdResourceKey, null, "issued");
    handles.add(handle);
    active = handle;
    let result: CommandObservation | null = null;
    let acceptStartNotice = true;
    let startNotice: Promise<void> | null = null;
    let startNoticeFailed = false;
    let rejectStartNotice: () => void = () => undefined;
    const startFailure = new Promise<null>((resolve) => {
      rejectStartNotice = () => resolve(null);
    });
    try {
      if (
        onStarted &&
        deadlineOrigin === "started" &&
        !(await handle.started(TERMINATION_GRACE_MS))
      ) {
        failureKind = "start_unconfirmed";
        throw Error("docker_isolation_start_unconfirmed");
      }
      let waitFailed = false;
      const pending = handle.wait(timeoutMs ?? 2_147_483_647).catch(() => {
        waitFailed = true;
        return null;
      });
      if (onStarted && deadlineOrigin === "started") await onStarted();
      else if (onStarted) {
        // 開始観測は要求起算のwaitと並行し、期限を延長しない。
        void handle.started(TERMINATION_GRACE_MS).then(
          (started) => {
            if (!started || !acceptStartNotice) return;
            startNotice = onStarted().catch(() => {
              startNoticeFailed = true;
              rejectStartNotice();
            });
          },
          () => undefined,
        );
      }
      result = cleaning
        ? await pending
        : await Promise.race([pending, cancellation, startFailure]);
      acceptStartNotice = false;
      if (startNotice) await startNotice;
      if (startNoticeFailed)
        throw Error("docker_isolation_notification_failed");
      responseObserved = result !== null;
      observedElapsedMs = Math.max(
        0,
        Math.round(performance.now() - startedAt),
      );
      observedErrorCode = waitFailed
        ? "PROCESS_FAILURE"
        : result?.outputExceeded
          ? "ENOBUFS"
          : result === null && !cancelled
            ? "ETIMEDOUT"
            : null;
    } finally {
      acceptStartNotice = false;
      const closed = handle.closed() || (await terminate(handle));
      terminated &&= closed;
      if (closed) handles.delete(handle);
      if (active === handle) active = null;
    }
    if (result === null && handle.closed())
      result = await handle.wait(1).catch(() => null);
    responseObserved ||= result !== null;
    return result;
  }

  /** 固定inspectの単一JSON以外を観測値へ昇格しない。 */
  async function inspect(
    kind: "container" | "network" | "image",
    id: string,
  ): Promise<unknown> {
    const result = await command([kind, "inspect", id], input.setupTimeoutMs);
    stage = "observation";
    if (
      result?.status !== 0 ||
      observedErrorCode !== null ||
      !terminated ||
      result.signal ||
      result.stderr ||
      result.outputExceeded
    )
      throw Error("docker_isolation_inspect_unconfirmed");
    const parsed: unknown = JSON.parse(result.stdout);
    if (!Array.isArray(parsed) || parsed.length !== 1)
      throw Error("docker_isolation_inspect_unconfirmed");
    return parsed[0];
  }

  /** 発行事実を保持してから通知し、通知失敗でも元IDを失わない。 */
  function update(
    key: string,
    dockerId: string | null,
    request: ResourceSnapshot["resources"][number]["request"],
  ): void {
    snapshot = Object.freeze({
      resources: Object.freeze(
        snapshot.resources.map((r) =>
          r.key === key
            ? Object.freeze({
                ...r,
                identity: Object.freeze({ ...r.identity, dockerId }),
                request,
              })
            : r,
        ),
      ),
    });
  }

  /** 同じ観測から完全構成検査と非秘密投影を構築する。 */
  async function observe(key: string): Promise<void> {
    const definition = definitions.get(key),
      resource = snapshot.resources.find((r) => r.key === key);
    if (!definition || !resource?.identity.dockerId)
      throw Error("docker_isolation_receipt_missing");
    const id = resource.identity.dockerId;
    const value = await inspect(definition.kind, id);
    const identity = {
      kind: definition.kind,
      dockerId: id,
      expectedName: definition.name,
      ownershipLabel: definition.ownershipLabel,
    };
    if (!dockerResourceIdentityMatches(value, identity))
      throw Error("docker_isolation_identity_mismatch");
    let image: Readonly<Record<string, unknown>> | null = null;
    if (definition.kind === "container") {
      const metadata = await inspect("image", definition.image);
      if (
        !metadata ||
        typeof metadata !== "object" ||
        !("Config" in metadata) ||
        !metadata.Config ||
        typeof metadata.Config !== "object"
      )
        throw Error("docker_isolation_image_unconfirmed");
      const record = metadata as Record<string, unknown>;
      if (
        definition.image.startsWith("sha256:")
          ? record.Id !== definition.image
          : !Array.isArray(record.RepoDigests) ||
            !record.RepoDigests.includes(definition.image)
      )
        throw Error("docker_isolation_image_unconfirmed");
      image = metadata.Config as Record<string, unknown>;
    }
    const configurationFailure = inspectIsolationResourceConfiguration(
      definition,
      value,
      image,
      connections.get(key) ?? [],
    );
    if (configurationFailure) throw Error(configurationFailure);
    const observed = snapshotObservedDockerResource(value, key, identity);
    if (!observed) throw Error("docker_isolation_snapshot_unconfirmed");
    snapshot = Object.freeze({
      resources: Object.freeze(
        snapshot.resources.map((r) =>
          r.key === key
            ? (Object.freeze({
                ...observed.resources[0],
                request: r.request,
              }) as ResourceSnapshot["resources"][number])
            : r,
        ),
      ),
    });
  }

  /** 元資源だけを共通回収へ接続し、終了不明・必要通知失敗では削除しない。 */
  async function cleanup(): Promise<IsolationExecutionResult["cleanup"]> {
    cleaning = true;
    const observations: Array<
      IsolationExecutionResult["cleanup"]["observations"][number]
    > = [];
    let cleanupStopped = false;
    for (const key of input.cleanupOrder) {
      let r = snapshot.resources.find((r) => r.key === key);
      if (!r) throw Error("docker_isolation_resource_missing");
      let observation: "not_requested" | "absent" | "unknown" =
        r.request === "not_issued" ? "not_requested" : "unknown";
      if (
        !cleanupStopped &&
        !(cancelled && owner.cleanupOnly) &&
        r.request !== "not_issued" &&
        terminated
      ) {
        try {
          await notice("onCleanupSubmitting", [key]);
          const originalIdMissing = r.identity.dockerId === null;
          const identity = r.identity;
          if (originalIdMissing) {
            const list = async (...filters: string[]) => {
              const result = await command(
                [
                  identity.kind,
                  "ls",
                  ...(identity.kind === "container" ? ["--all"] : []),
                  "--no-trunc",
                  ...filters.flatMap((f) => ["--filter", f]),
                  "--format",
                  "{{.ID}}",
                ],
                input.setupTimeoutMs,
              );
              if (
                result?.status !== 0 ||
                result.signal ||
                result.stderr ||
                result.outputExceeded ||
                observedErrorCode ||
                !terminated
              )
                throw Error("docker_isolation_discovery_unconfirmed");
              const ids = result.stdout.trim()
                ? result.stdout.trim().split(/\r?\n/u)
                : [];
              if (
                ids.length > 1 ||
                ids.some((id) => !/^[a-f0-9]{64}$/u.test(id))
              )
                throw Error("docker_isolation_discovery_unconfirmed");
              return ids;
            };
            const name =
              r.identity.kind === "container"
                ? `name=^/${r.identity.name}$`
                : `name=^${r.identity.name}$`;
            const byName = await list(name),
              byOwner = await list(name, `label=${r.identity.ownershipLabel}`);
            if (
              byName.length !== byOwner.length ||
              (byName.length === 1 && byName[0] !== byOwner[0])
            )
              throw Error("docker_isolation_discovery_unconfirmed");
            const found =
              byName.length === 1 &&
              byOwner.length === 1 &&
              byName[0] === byOwner[0]
                ? byName[0]
                : null;
            if (found) {
              const value = await inspect(r.identity.kind, found);
              if (
                !dockerResourceIdentityMatches(value, {
                  kind: identity.kind,
                  dockerId: found,
                  expectedName: identity.name,
                  ownershipLabel: identity.ownershipLabel,
                })
              )
                throw Error("docker_isolation_discovery_unconfirmed");
              {
                update(key, found, r.request);
                const observed = snapshotObservedDockerResource(value, key, {
                  kind: r.identity.kind,
                  dockerId: found,
                  expectedName: r.identity.name,
                  ownershipLabel: r.identity.ownershipLabel,
                });
                if (observed?.resources[0])
                  snapshot = Object.freeze({
                    resources: Object.freeze(
                      snapshot.resources.map((item) =>
                        item.key === key
                          ? Object.freeze({
                              ...(observed
                                .resources[0] as ResourceSnapshot["resources"][number]),
                              request: item.request,
                            })
                          : item,
                      ),
                    ),
                  });
                if (!notices?.onResourceIdentified) {
                  stage = "notification";
                  notification = "onResourceIdentified";
                  failureKind = "threw";
                  fail("docker_isolation_identification_notification_required");
                  throw Error(
                    "docker_isolation_identification_notification_required",
                  );
                }
                await notice("onResourceIdentified", [key, snapshot]);
                r = snapshot.resources.find((item) => item.key === key);
                if (!r) throw Error("docker_isolation_resource_missing");
              }
            }
          }
          if (!r.identity.dockerId) {
            if (input.unreceiptedAbsence === "observe") {
              const result = await command(
                [r.identity.kind, "inspect", r.identity.name],
                input.setupTimeoutMs,
              );
              if (
                result &&
                !result.outputExceeded &&
                observedErrorCode === null &&
                terminated &&
                explicitDockerResourceAbsence(
                  result,
                  r.identity.kind,
                  r.identity.name,
                )
              )
                observation = "absent";
            }
            await notice("onCleanupCompleted", [key]);
            observations.push(Object.freeze({ key, observation }));
            continue;
          }
          const dockerId = r.identity.dockerId;
          const absent = await cleanupResourceIdentity(
            async (argv) => {
              const result = await command(argv, input.setupTimeoutMs);
              return {
                status: result?.status ?? null,
                signal: result?.signal ?? null,
                stdout: result?.stdout ?? "",
                stderr: result?.stderr ?? "",
                error:
                  !result ||
                  result.outputExceeded ||
                  observedErrorCode !== null ||
                  !terminated
                    ? Error("docker_isolation_cleanup_unconfirmed")
                    : null,
              } satisfies DockerRecoveryCommandResult;
            },
            {
              kind: r.identity.kind,
              dockerId,
              expectedName: r.identity.name,
              ownershipLabel: r.identity.ownershipLabel,
            },
            undefined,
            owner.previouslyAbsent.includes(key),
          );
          if (absent) observation = "absent";
          else if (owner.previouslyAbsent.includes(key)) cleanupStopped = true;
          await notice("onCleanupCompleted", [key]);
        } catch {
          observation = "unknown";
          cleanupStopped = true;
        }
      }
      observations.push(Object.freeze({ key, observation }));
    }
    if (
      input.verifyLabelAbsence &&
      terminated &&
      !cleanupStopped &&
      observations.every((r) => r.observation !== "unknown")
    ) {
      for (const resource of snapshot.resources.filter(
        (r) => r.request !== "not_issued",
      )) {
        try {
          const result = await command(
            [
              resource.identity.kind,
              "ls",
              ...(resource.identity.kind === "container" ? ["--all"] : []),
              "--no-trunc",
              "--filter",
              `label=${resource.identity.ownershipLabel}`,
              "--format",
              "{{.ID}}",
            ],
            input.setupTimeoutMs,
          );
          if (
            result?.status !== 0 ||
            result.signal ||
            result.stderr ||
            result.stdout.trim() ||
            result.outputExceeded ||
            observedErrorCode !== null ||
            !terminated
          )
            throw Error("docker_isolation_label_absence_unconfirmed");
        } catch {
          const current = observations.findIndex((r) => r.key === resource.key);
          if (current >= 0)
            observations[current] = Object.freeze({
              key: resource.key,
              observation: "unknown",
            });
        }
      }
    }
    try {
      await notice("onResourcesClosed", [
        snapshot,
        Object.freeze([...observations]),
      ]);
    } catch {
      /* 必要通知のFailureを保持し、自作configの終了確認は続ける。 */
    }
    let configCleanupConfirmed = !configStarted;
    if (
      config &&
      terminated &&
      (owner.cleanupOnly ||
        observations.every((r) => r.observation !== "unknown"))
    ) {
      try {
        verify();
        if (fs.readdirSync(config.directory).length !== 0)
          throw Error("docker_isolation_config_nonempty");
        fs.rmdirSync(config.directory);
        try {
          fs.lstatSync(config.directory);
          configCleanupConfirmed = false;
        } catch (error) {
          configCleanupConfirmed =
            (error as NodeJS.ErrnoException)?.code === "ENOENT";
        }
      } catch {
        configCleanupConfirmed = false;
      }
    }
    return Object.freeze({
      confirmed:
        terminated &&
        configCleanupConfirmed &&
        observations.every((r) => r.observation !== "unknown"),
      configCleanupConfirmed,
      observations: Object.freeze(observations),
    });
  }

  const completion = Promise.resolve().then(
    async (): Promise<IsolationExecutionResult> => {
      try {
        verify();
        if (
          !cancelled &&
          (input.steps.length > 0 ||
            snapshot.resources.some((r) => r.request !== "not_issued"))
        ) {
          configStarted = true;
          config = createDockerCliConfig(input.managementDirectory);
          const engine = await command(
            ["version", "--format", "{{.Server.Os}}"],
            input.setupTimeoutMs,
          );
          if (
            engine?.status !== 0 ||
            engine.signal ||
            engine.outputExceeded ||
            engine.stdout.trim() !== "linux" ||
            !terminated ||
            observedErrorCode !== null
          )
            throw Error("docker_isolation_engine_unconfirmed");
          for (const current of input.steps) {
            step = current;
            if (cancelled) break;
            stage = "notification";
            await notice("onSubmitting", [current]);
            if (cancelled) {
              await notice("onNotIssued", [current]);
              break;
            }
            const definition = definitions.get(current.resource);
            if (!definition) throw Error("docker_isolation_resource_missing");
            let argv: readonly string[];
            stage = "start";
            if (current.action === "create") {
              argv =
                definition.kind === "network"
                  ? [
                      "network",
                      "create",
                      "--driver=bridge",
                      ...(definition.internal ? ["--internal"] : []),
                      "--label",
                      definition.ownershipLabel,
                      definition.name,
                    ]
                  : containerCreation(
                      definition,
                      definition.network
                        ? (definitions.get(definition.network)?.name ?? null)
                        : null,
                    );
              if (definition.kind === "container")
                connections.set(definition.key, [
                  definition.network
                    ? (definitions.get(definition.network)?.name ?? "")
                    : "none",
                ]);
            } else {
              const resource = snapshot.resources.find(
                (r) => r.key === current.resource,
              );
              if (!resource?.identity.dockerId)
                throw Error("docker_isolation_receipt_missing");
              if (current.action === "connect") {
                const network = snapshot.resources.find(
                  (r) => r.key === current.network,
                );
                if (!network?.identity.dockerId)
                  throw Error("docker_isolation_receipt_missing");
                argv = [
                  "network",
                  "connect",
                  network.identity.dockerId,
                  resource.identity.dockerId,
                ];
              } else {
                await observe(current.resource);
                if (cancelled) break;
                argv = [
                  "start",
                  ...(current.mode !== "detached" ? ["--attach"] : []),
                  ...(current.mode === "interactive" ? ["--interactive"] : []),
                  ...(current.mode === "captured" && current.stdin !== null
                    ? ["--interactive"]
                    : []),
                  resource.identity.dockerId,
                ];
              }
            }
            stage = "wait";
            const run = current.action === "run" ? current : null;
            const result = await command(
              argv,
              current.timeoutMs,
              run?.stdin ?? null,
              run?.mode === "interactive",
              run?.stdoutLimitBytes,
              run?.stderrLimitBytes,
              run && run.mode !== "detached"
                ? () => notice("onStarted", [current], true)
                : undefined,
              current.action === "create" ? current.resource : undefined,
              run?.deadlineOrigin,
            );
            stage = "observation";
            if (
              current.action === "create" &&
              result?.status === 0 &&
              !result.signal &&
              !result.outputExceeded &&
              /^[a-f0-9]{64}$/u.test(result.stdout.trim())
            )
              update(current.resource, result.stdout.trim(), "issued");
            if (cancelled && current.action !== "create") break;
            const commandResult: IsolationCommandResult = Object.freeze({
              observation: result,
              elapsedMs: observedElapsedMs,
              errorCode: observedErrorCode,
              classification: classifyDockerCommandExecution(result),
              exitClass: classifyDockerProcessExit(result),
            });
            await notice("onObserved", [current, commandResult], true);
            if (!terminated)
              throw Error("docker_isolation_process_termination_unconfirmed");
            if (
              !result ||
              observedErrorCode !== null ||
              result.outputExceeded ||
              result.signal ||
              (!run && result.stderr.trim().length !== 0) ||
              !(run?.acceptedExitCodes ?? [0]).includes(result.status ?? -1)
            )
              throw Error("docker_isolation_command_failed");
            if (current.action === "create") {
              // 作成Receiptは構成検査成功ではない。既知IDを先に上位へ渡す。
              const dockerId = snapshot.resources.find(
                (r) => r.key === current.resource,
              )?.identity.dockerId;
              if (
                typeof dockerId !== "string" ||
                !/^[a-f0-9]{64}$/u.test(dockerId)
              )
                throw Error("docker_isolation_receipt_missing");
              await notice("onCreated", [current, snapshot]);
              if (cancelled) break;
              await observe(current.resource);
            } else if (current.action === "connect") {
              const network = definitions.get(current.network);
              if (!network) throw Error("docker_isolation_resource_missing");
              connections.set(current.resource, [
                ...(connections.get(current.resource) ?? []),
                network.name,
              ]);
              await observe(current.resource);
            }
            if (cancelled) break;
            await notice("onCompleted", [current, commandResult], true);
          }
        }
      } catch (error) {
        exceptionCode = classifyDockerCommandException(error);
        fail(
          error instanceof Error && /^docker_[a-z_]+$/u.test(error.message)
            ? error.message
            : "docker_isolation_execution_failed",
        );
      }
      for (const handle of handles) {
        const closed = await terminate(handle);
        terminated = terminated && closed;
        if (handle.closed()) handles.delete(handle);
      }
      terminated &&= handles.size === 0;
      let outcome: IsolationExecutionResult["cleanup"];
      try {
        outcome = await cleanup();
      } catch {
        outcome = Object.freeze({
          confirmed: false,
          configCleanupConfirmed: false,
          observations: Object.freeze([]),
        });
      }
      notices = null;
      finished = true;
      active = null;
      return Object.freeze({
        failure,
        resources: snapshot,
        cancellationRequested: cancelled,
        processTerminationConfirmed: terminated,
        notificationDeliveryConfirmed: notified ? delivered : null,
        callbackRegistrationReleased: notices === null,
        cleanup: outcome,
      });
    },
  );
  return Object.freeze({
    async cancel() {
      if (finished)
        return Object.freeze({
          cancellationRequested: false,
          processTerminationObserved: terminated,
        });
      const first = !cancelled;
      cancelled = true;
      signalCancellation();
      const handle = active;
      return Object.freeze({
        cancellationRequested: first,
        processTerminationObserved: !handle
          ? terminated
          : cleaning
            ? terminated && handle.closed()
            : await terminate(handle),
      });
    },
    completion,
  });
}

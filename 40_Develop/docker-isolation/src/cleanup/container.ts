/**
 * Containerの現在観測・実ID回収と三軸不存在を共通処理へ接続する。
 * @packageDocumentation
 * @responsibility 作成構成の再照合と技術結果だけを所有し用途・保存・回復判断を知らない。
 * @trace ARCH-000008
 * @boundary 検証済み技術構成と固定Docker要求。
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { dockerResourceLocatorIsValid } from "./validation.ts";
import path from "node:path";
import { types } from "node:util";
import { observeDockerDirectoryIdentity } from "../docker-cli/config.ts";
import {
  type IsolationSettings,
  captureIsolationSettings,
  createDockerCliEnvironment,
} from "../docker-cli/environment.ts";
import {
  type DockerCliTrustSnapshot,
  observeTrustedDockerCli,
  verifyTrustedDockerCliSnapshot,
} from "../docker-cli/trust.ts";
import { captureDockerProcessEnvironment } from "../process/environment.ts";
import {
  type DockerContainerConfigurationExpectation,
  dockerContainerConfigurationMatches,
} from "./configuration.ts";
import {
  type DockerRecoveryCommandResult,
  dockerResourceIdentityMatches,
  inspectObservedDockerResource,
  removeObservedDockerResource,
  snapshotObservedDockerResource,
} from "./resource.ts";
import type {
  ContainerResourceInspection,
  ContainerResourceTarget,
  ResourceSnapshot,
} from "./types.ts";

/**
 * 固定CLIと限定環境を借用する。
 * @responsibility 保存・用途・実行許可を含めない。
 * @trace ARCH-000008
 * @shape CLI現在確認と環境読取り。
 * @invariant 任意argvを公開しない。
 * @boundary 既存の実行Binding。
 * @security CLI確認は要求直前に実施する。
 */
export type DockerContainerBinding = Readonly<{
  verifyCli: () => string;
  environment: () => Readonly<Record<string, string>>;
}>;

/**
 * 同期Container観測・回収の固定CLIと借用管理所在を結合する。
 * @responsibility 用途・payloadを持たず、元DirectoryとCLIの現在実体を各要求前に照合する。
 * @trace ARCH-000008
 * @input management: 上位が確定し処置中保持する管理Directory。
 * @returns 固定CLI確認と限定環境だけの技術接続。
 * @effect 既存docker-config／docker-homeを管理領域内に取得する。終了は従来の上位Host清掃が所有する。
 * @failure 未対応OS・CLI不明・所在不正・差替え・環境不明は拒否する。
 * @invariant Probeの意味・保存・自動再送・新しい排他を持たない。
 */
export function createDockerContainerBinding(
  management: string,
  settings: IsolationSettings,
): DockerContainerBinding {
  settings = captureIsolationSettings(settings);
  if (process.platform !== "win32")
    throw Error("docker_backend_platform_unsupported");
  let snapshot: DockerCliTrustSnapshot;
  try {
    snapshot = observeTrustedDockerCli(settings);
  } catch {
    throw Error("docker_cli_untrusted");
  }
  if (
    typeof management !== "string" ||
    !management ||
    !path.isAbsolute(management) ||
    path.resolve(management) !== management
  )
    throw Error("owned_operation_mount_replaced");
  const original = observeDockerDirectoryIdentity(management);
  const dockerConfig = path.join(management, "docker-config"),
    dockerHome = path.join(management, "docker-home");
  fs.mkdirSync(dockerConfig, { recursive: true });
  fs.mkdirSync(dockerHome, { recursive: true });
  const environment = createDockerCliEnvironment(settings, {
    dockerConfig,
    dockerHome,
  });
  if (!environment) throw Error("docker_runtime_environment_unavailable");
  return Object.freeze({
    verifyCli: () => {
      if (observeDockerDirectoryIdentity(management) !== original)
        throw Error("owned_operation_mount_replaced");
      try {
        return verifyTrustedDockerCliSnapshot(snapshot);
      } catch {
        throw Error("docker_cli_untrusted");
      }
    },
    environment: () => environment,
  });
}

/**
 * 通常dataのfieldを一回捕捉する。
 * @responsibility Proxy・accessor・余剰fieldを要求前に拒否する。
 * @trace ARCH-000008
 * @input value: 技術入力、keys: 宣言済みfield。
 * @returns own dataの写し。
 * @effect N/A: 局所値だけ。
 * @failure 不正形は例外。
 * @invariant getterを呼ばない。
 */
function fields(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    types.isProxy(value) ||
    (Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null) ||
    Reflect.ownKeys(value).length !== keys.length
  )
    throw Error("docker_container_projection_invalid");
  const result: Record<string, unknown> = Object.create(null);
  for (const key of keys) {
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !("value" in d) || !d.enumerable)
      throw Error("docker_container_projection_invalid");
    result[key] = d.value;
  }
  return result;
}

/**
 * 操作対象の実ID・名前・所有Labelを固定する。
 * @responsibility filterへ任意式を搬送しない。
 * @trace ARCH-000008
 * @input value: 同じ作成構成の三識別値。
 * @returns 捕捉済みIdentity。
 * @effect N/A: 値検査だけ。
 * @failure 不正値は要求0で停止。
 * @invariant 識別値だけを削除権限にしない。
 */
function identity(
  value: unknown,
): Readonly<{ id: string; name: string; ownershipLabel: string }> {
  const v = fields(value, ["id", "name", "ownershipLabel"]);
  if (
    typeof v.id !== "string" ||
    !/^[a-f0-9]{64}$/u.test(v.id) ||
    typeof v.name !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/u.test(v.name) ||
    typeof v.ownershipLabel !== "string" ||
    !dockerResourceLocatorIsValid("container", v.name, v.ownershipLabel)
  )
    throw Error("docker_container_projection_invalid");
  return Object.freeze({
    id: v.id,
    name: v.name,
    ownershipLabel: v.ownershipLabel,
  });
}

/**
 * 作成構成を後発変更から分離する。
 * @responsibility 構成の欠測・動的値を拒否し通常dataへ固定する。
 * @trace ARCH-000008
 * @input value: 作成時の技術構成。
 * @returns 固定した同じ構成。
 * @effect N/A: 値捕捉だけ。
 * @failure 不正形は要求前に例外。
 * @invariant 新しい実行条件を補完しない。
 */
function captureExpectation(
  value: unknown,
): DockerContainerConfigurationExpectation {
  const v = fields(value, [
    "id",
    "name",
    "ownershipLabel",
    "image",
    "user",
    "entrypoint",
    "commands",
    "mounts",
  ]);
  const captured = identity({
    id: v.id,
    name: v.name,
    ownershipLabel: v.ownershipLabel,
  });
  const array = (input: unknown): readonly string[] => {
    if (
      !Array.isArray(input) ||
      types.isProxy(input) ||
      !input.length ||
      input.length > 64 ||
      Reflect.ownKeys(input).length !== input.length + 1
    )
      throw Error("docker_container_projection_invalid");
    const result: string[] = [];
    for (let i = 0; i < input.length; i++) {
      const d = Object.getOwnPropertyDescriptor(input, String(i));
      if (
        !d ||
        !("value" in d) ||
        typeof d.value !== "string" ||
        d.value.includes("\0")
      )
        throw Error("docker_container_projection_invalid");
      result.push(d.value);
    }
    return Object.freeze(result);
  };
  if (
    typeof v.image !== "string" ||
    !/^.+@sha256:[a-f0-9]{64}$/u.test(v.image) ||
    typeof v.user !== "string" ||
    !/^[0-9]+:[0-9]+$/u.test(v.user) ||
    !Array.isArray(v.commands) ||
    types.isProxy(v.commands) ||
    !v.commands.length ||
    v.commands.length > 64 ||
    Reflect.ownKeys(v.commands).length !== v.commands.length + 1 ||
    !v.mounts ||
    typeof v.mounts !== "object" ||
    types.isProxy(v.mounts)
  )
    throw Error("docker_container_projection_invalid");
  const commands: (readonly string[])[] = [];
  for (let i = 0; i < v.commands.length; i++) {
    const d = Object.getOwnPropertyDescriptor(v.commands, String(i));
    if (!d || !("value" in d))
      throw Error("docker_container_projection_invalid");
    commands.push(array(d.value));
  }
  const mounts: Record<
    string,
    Readonly<{ source: string; readWrite: boolean }>
  > = Object.create(null);
  const keys = Reflect.ownKeys(v.mounts);
  if (!keys.length || keys.length > 64)
    throw Error("docker_container_projection_invalid");
  for (const key of keys) {
    if (typeof key !== "string" || !/^\/[a-zA-Z0-9/_.-]+$/u.test(key))
      throw Error("docker_container_projection_invalid");
    const d = Object.getOwnPropertyDescriptor(v.mounts, key);
    if (!d || !("value" in d))
      throw Error("docker_container_projection_invalid");
    const mount = fields(d.value, ["source", "readWrite"]);
    if (
      typeof mount.source !== "string" ||
      !mount.source ||
      mount.source.includes("\0") ||
      typeof mount.readWrite !== "boolean"
    )
      throw Error("docker_container_projection_invalid");
    mounts[key] = Object.freeze({
      source: mount.source,
      readWrite: mount.readWrite,
    });
  }
  return Object.freeze({
    ...captured,
    image: v.image,
    user: v.user,
    entrypoint: array(v.entrypoint),
    commands: Object.freeze(commands),
    mounts: Object.freeze(mounts),
  });
}

/**
 * 固定資源操作だけを限定環境で発行する。
 * @responsibility CLI現在確認と同じ既存Engine・64KiB上限を維持する。
 * @trace ARCH-000008
 * @input binding: 既存接続、argv: Module内部構築のみ。
 * @returns 同期要求の元結果。
 * @effect 固定Docker要求。
 * @failure 例外・Signal・出力失敗を保持する。
 * @invariant shellと親環境を使わない。
 */
function run(
  binding: DockerContainerBinding,
  argv: readonly string[],
): DockerRecoveryCommandResult {
  const environment = captureDockerProcessEnvironment(binding.environment());
  const executable = binding.verifyCli();
  const r = spawnSync(
    executable,
    ["-H", "npipe:////./pipe/dockerDesktopLinuxEngine", ...argv],
    {
      encoding: "utf8",
      windowsHide: true,
      shell: false,
      timeout: 10_000,
      maxBuffer: 64 * 1024,
      env: environment,
    },
  );
  return {
    status: r.status,
    signal: r.signal,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
    error: r.error ?? null,
  };
}

/**
 * 同じ構成の現在実体とRunning肯定を観測する。
 * @responsibility 共通inspect処理を使い用途専用の観測を持たない。
 * @trace ARCH-000008
 * @input binding: 同じCLI接続、expected: 元構成。
 * @returns 一致時のRunning肯定、又はnull。
 * @effect fresh inspectとMount realpath。
 * @failure 欠測・構成差・観測不能はnull。
 * @invariant falseを不存在に変換しない。
 */
export function inspectDockerContainer(
  binding: DockerContainerBinding,
  expected:
    | DockerContainerConfigurationExpectation
    | Pick<
        DockerContainerConfigurationExpectation,
        "id" | "name" | "ownershipLabel"
      >,
): Readonly<{ runningConfirmed: boolean; snapshot: ResourceSnapshot }> | null {
  if (!expected || typeof expected !== "object" || types.isProxy(expected))
    throw Error("docker_container_projection_invalid");
  const configuration =
    Reflect.ownKeys(expected).length === 3
      ? null
      : captureExpectation(expected);
  const captured = configuration ?? identity(expected);
  const observed = inspectObservedDockerResource(
    (argv) => run(binding, argv),
    "container",
    captured.id,
    64 * 1024,
  );
  if (
    configuration
      ? !dockerContainerConfigurationMatches(observed, configuration)
      : !dockerResourceIdentityMatches(observed, {
          kind: "container",
          dockerId: captured.id,
          expectedName: captured.name,
          ownershipLabel: captured.ownershipLabel,
        })
  )
    return null;
  const snapshot = snapshotObservedDockerResource(observed, captured.name, {
    kind: "container",
    dockerId: captured.id,
    expectedName: captured.name,
    ownershipLabel: captured.ownershipLabel,
  });
  if (!snapshot) return null;
  const state = Object.getOwnPropertyDescriptor(
    observed as object,
    "State",
  )?.value;
  return Object.freeze({
    snapshot,
    runningConfirmed:
      !!state &&
      typeof state === "object" &&
      Object.getOwnPropertyDescriptor(state, "Running")?.value === true,
  });
}

/**
 * 同じ実ID・名前・Labelの三軸不存在を観測する。
 * @responsibility 空の成功応答と不明を区別する。
 * @trace ARCH-000008
 * @input binding: 同じ接続、target: 三識別値。
 * @returns 三軸成立時のみconfirmed。
 * @effect 固定一覧三回。
 * @failure 不明・残存はblocked。
 * @invariant 削除を発行しない。
 */
export function observeDockerContainerAbsence(
  binding: DockerContainerBinding,
  target: Readonly<{ id: string; name: string; ownershipLabel: string }>,
) {
  const c = identity(target);
  const results = [
    `id=${c.id}`,
    `name=^/${c.name}$`,
    `label=${c.ownershipLabel}`,
  ].map((filter) =>
    run(binding, [
      "container",
      "ls",
      "--all",
      "--quiet",
      "--no-trunc",
      "--filter",
      filter,
    ]),
  );
  const confirmed = results.every(
    (r) =>
      r.status === 0 &&
      !r.signal &&
      !r.error &&
      r.stderr === "" &&
      r.stdout.trim() === "",
  );
  return Object.freeze({
    status: confirmed ? "confirmed" : "blocked",
    reason: confirmed
      ? "docker_probe_absence_confirmed"
      : "docker_probe_absence_unconfirmed",
  });
}

/**
 * freshな元実ID・名前・所有Label一致後の実IDだけを回収する。
 * @responsibility 観測後の明示取消確認と三軸不存在を維持する。
 * @trace ARCH-000008
 * @input binding、expected: 元構成、signal: 任意の明示取消。
 * @returns 削除と三軸不存在成立時のみconfirmed。
 * @effect inspect、実ID rm、三軸一覧。
 * @failure 不一致・明示取消・削除不明・残存は失敗。
 * @invariant 名前やLabelだけでは削除しない。
 */
export function cleanupDockerContainer(
  binding: DockerContainerBinding,
  expected:
    | DockerContainerConfigurationExpectation
    | Pick<
        DockerContainerConfigurationExpectation,
        "id" | "name" | "ownershipLabel"
      >,
  signal?: AbortSignal,
) {
  if (!expected || typeof expected !== "object" || types.isProxy(expected))
    throw Error("docker_container_projection_invalid");
  const captured = identity({
    id: Object.getOwnPropertyDescriptor(expected, "id")?.value,
    name: Object.getOwnPropertyDescriptor(expected, "name")?.value,
    ownershipLabel: Object.getOwnPropertyDescriptor(expected, "ownershipLabel")
      ?.value,
  });
  if (
    !dockerResourceIdentityMatches(
      inspectObservedDockerResource(
        (argv) => run(binding, argv),
        "container",
        captured.id,
        64 * 1024,
      ),
      {
        kind: "container",
        dockerId: captured.id,
        expectedName: captured.name,
        ownershipLabel: captured.ownershipLabel,
      },
    )
  )
    return Object.freeze({
      confirmed: false,
      reason: "docker_container_identity_mismatch",
    });
  if (signal?.aborted)
    return Object.freeze({
      confirmed: false,
      reason: "docker_resource_cleanup_cancelled",
    });
  const confirmed = removeObservedDockerResource(
    (argv) => run(binding, argv),
    "container",
    captured.id,
    () =>
      observeDockerContainerAbsence(binding, {
        id: captured.id,
        name: captured.name,
        ownershipLabel: captured.ownershipLabel,
      }).status === "confirmed",
  );
  return Object.freeze({
    confirmed,
    reason: confirmed
      ? "docker_probe_absence_confirmed"
      : "docker_probe_cleanup_failed",
  });
}

/**
 * 単一Containerの同期観測を技術Ownerで完結する。
 * @responsibility 三軸不存在を先に観測し、不明時だけ元構成の実体観測へ進む。
 * @trace ARCH-000008
 * @input target: 元識別・構成、限定管理領域、任意取消。
 * @returns 存在三値・稼働肯定・非秘密Snapshot。
 * @effect 固定Docker読取りのみ。
 * @failure 不明を不存在へ変換しない。
 */
export function inspectContainerResources(
  target: ContainerResourceTarget,
  settings: IsolationSettings,
): ContainerResourceInspection {
  const binding = containerRuntime(target, settings),
    c = target.configuration;
  const absent = observeDockerContainerAbsence(binding, {
    id: c.id,
    name: c.name,
    ownershipLabel: c.ownershipLabel,
  });
  if (absent.status === "confirmed")
    return Object.freeze({
      observation: "absent",
      runningConfirmed: false,
      snapshot: null,
    });
  const present = inspectDockerContainer(binding, c);
  return Object.freeze({
    observation: present ? "present" : "unknown",
    runningConfirmed: present?.runningConfirmed === true,
    snapshot: present?.snapshot ?? null,
  });
}

/**
 * 元識別を同じ固定Container回収へ接続する。
 * @responsibility 同期性と各要求直前の取消確認を維持する。
 * @trace ARCH-000008
 * @input target: 上位で確定した技術対象。
 * @returns 元の回収結果。
 * @effect 実体照合・実ID削除・三軸不存在観測。
 * @failure 未確認は成功へ畳まない。
 */
export function cleanupContainerResources(
  target: ContainerResourceTarget,
  settings: IsolationSettings,
): Readonly<{ confirmed: boolean; reason: string }> {
  return cleanupDockerContainer(
    containerRuntime(target, settings),
    target.configuration,
    target.signal,
  );
}

/**
 * 単一Containerの限定接続を現在の取消状態へ結合する。
 * @responsibility CLI要求ごとに取消を確認し、用途・保存判断は持たない。
 * @trace ARCH-000008
 * @input target: 同じ管理所在と取消Signal。
 * @returns 内部の固定CLI接続。
 * @effect 既存CLI信頼観測。
 * @failure 不正入力・取消・CLI不明は例外。
 */
function containerRuntime(
  target: ContainerResourceTarget,
  settings: IsolationSettings,
): DockerContainerBinding {
  if (types.isProxy(target)) throw Error("resource_target_invalid");
  target.signal?.throwIfAborted();
  const binding = createDockerContainerBinding(
    target.managementDirectory,
    settings,
  );
  return Object.freeze({
    environment: binding.environment,
    verifyCli: () => {
      target.signal?.throwIfAborted();
      return binding.verifyCli();
    },
  });
}

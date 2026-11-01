/**
 * Containerの現在観測・実ID回収と三軸不存在を共通処理へ接続する。
 * @packageDocumentation
 * @responsibility 作成構成の再照合と技術結果だけを所有し用途・保存・回復判断を知らない。
 * @trace ARCH-000008
 * @boundary 検証済み技術構成と固定Docker要求。
 */
import { spawnSync } from "node:child_process";
import { types } from "node:util";
import { captureDockerProcessEnvironment } from "../process/environment.ts";
import {
  dockerContainerConfigurationMatches,
  type DockerContainerConfigurationExpectation,
} from "./configuration.ts";
import {
  inspectObservedDockerResource,
  removeObservedDockerResource,
  type DockerRecoveryCommandResult,
} from "./resource.ts";

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
    !/^[a-zA-Z0-9_.-]+=[a-zA-Z0-9_.-]+$/u.test(v.ownershipLabel)
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
  expected: DockerContainerConfigurationExpectation,
): Readonly<{ runningConfirmed: boolean }> | null {
  const captured = captureExpectation(expected);
  const observed = inspectObservedDockerResource(
    (argv) => run(binding, argv),
    "container",
    captured.id,
    64 * 1024,
  );
  if (!dockerContainerConfigurationMatches(observed, captured)) return null;
  const state = Object.getOwnPropertyDescriptor(
    observed as object,
    "State",
  )?.value;
  return Object.freeze({
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
 * fresh構成一致後の実IDだけを回収する。
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
  expected: DockerContainerConfigurationExpectation,
  signal?: AbortSignal,
) {
  const captured = captureExpectation(expected);
  if (!inspectDockerContainer(binding, captured))
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

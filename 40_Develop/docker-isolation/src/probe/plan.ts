/**
 * 隔離診断の固定Docker操作と短命Process実行を所有する。
 * @responsibility 診断Scenarioの意味を持たず、閉じた操作からargvを構築する。
 * @trace ARCH-000008
 */
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import path from "node:path";
import { types as utilTypes } from "node:util";
import { captureDockerProcessEnvironment } from "../process/environment.ts";

const ENGINE = "npipe:////./pipe/dockerDesktopLinuxEngine";

/**
 * Probeの固定技術構成と相関付き資源名を記述する。
 * @responsibility 作成・inspect・回復記録が同じImage／Name／Labelを参照する正本を持つ。
 * @trace ARCH-000008
 * @input probeId: 上位が所有する同じ診断相関。
 * @returns 固定Image、名前、Label、保存用Engine名と技術profile。
 * @precondition 実行時のID合法性と所有確認は各要求入口が別途行う。
 * @postcondition 所在・認証情報・実行許可を含めない。
 * @effect N/A: 固定値と文字列の投影のみ。
 * @failure N/A: 実観測や処置を実行しない。
 * @invariant この記述を資源存在・Authority・回収成立へ昇格しない。
 * @boundary DI技術構成と上位の既存保存形式。
 * @security 戻り値は実行Capabilityではない。
 * @concurrency N/A: 同期の不変値。
 */
export function describeDockerProbeResource(probeId: string) {
  return Object.freeze({
    image: IMAGE,
    name: `crdd-coordinator-probe-${probeId}`,
    label: `crdd.coordinator.probe=${probeId}`,
    labelName: "crdd.coordinator.probe",
    engine: "docker_desktop_linux_named_pipe",
    runtimeProfile: Object.freeze({
      backend: "docker_desktop_linux",
      endpoint: "local_named_pipe",
      dockerCliTrust:
        "fixed_path_valid_windows_authenticode_docker_inc_and_operation_snapshot",
      imagePinnedByDigest: true,
      networkMode: "none",
    }),
  });
}
const IMAGE =
  "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";

/**
 * 診断の閉じた技術操作入力。
 * @responsibility 任意Docker argv・Image・Filter・Mount destinationを受け取らない。
 * @trace ARCH-000008
 * @shape purpose別に実ID、Probe相関、借用Mount、限定Scriptを持つ。
 * @invariant 削除と開始は実IDだけを対象とする。
 * @boundary 上位の検査済み診断と下位Process。
 * @security Scriptは固定診断のpayloadであり上位Authorityを代替しない。
 * @compatibility 既存Probeの固定引数を保持する。
 */
export type DockerProbeCommand =
  | Readonly<{ purpose: "version" }>
  | Readonly<{
      purpose:
        | "inspect"
        | "list_id"
        | "remove"
        | "start"
        | "start_attached"
        | "terminate";
      containerId: string;
    }>
  | Readonly<{ purpose: "list_name"; probeId: string }>
  | Readonly<{ purpose: "list_label"; probeId: string }>
  | Readonly<{
      purpose: "create";
      probeId: string;
      source: string;
      mounts: Readonly<{
        workspace: string;
        providerHome: string;
        tmp: string;
      }>;
    }>;

/**
 * 固定診断操作からDocker argvを構築する。
 * @responsibility 固定Engine、隔離構成、Filterと実IDをEffect前に検査する。
 * @trace ARCH-000008
 * @input command: 閉じた用途別技術投影。
 * @returns 固定Engineを含む凍結argv。
 * @precondition MountとScriptの利用許可は上位が検査する。
 * @postcondition 入力不正では部分argvを返さない。
 * @effect N/A: Process内の構築だけ。
 * @failure 不正用途・ID・所在・payloadは例外。
 * @invariant Caller supplied argvへのfallbackなし。
 * @boundary 検査済み技術投影とDocker引数。
 * @security shell・追加Mount・特権・Networkを入力から選択できない。
 * @concurrency 入力を同じ呼出しで固定し後発変更を搬送しない。
 */
export function planDockerProbeCommand(
  command: DockerProbeCommand,
): readonly string[] {
  if (
    command === null ||
    typeof command !== "object" ||
    utilTypes.isProxy(command) ||
    (Object.getPrototypeOf(command) !== Object.prototype &&
      Object.getPrototypeOf(command) !== null) ||
    Reflect.ownKeys(command).some(
      (key) =>
        typeof key !== "string" ||
        !("value" in (Object.getOwnPropertyDescriptor(command, key) ?? {})),
    )
  )
    throw new Error("docker_probe_command_invalid");
  const allowed =
    command.purpose === "version"
      ? ["purpose"]
      : command.purpose === "create"
        ? ["purpose", "probeId", "source", "mounts"]
        : command.purpose === "list_name" || command.purpose === "list_label"
          ? ["purpose", "probeId"]
          : ["purpose", "containerId"];
  if (
    Object.keys(command).some((key) => !allowed.includes(key)) ||
    allowed.some((key) => !Object.hasOwn(command, key))
  )
    throw new Error("docker_probe_command_invalid");
  let args: string[];
  if (command.purpose === "version")
    args = ["version", "--format", "{{.Server.Os}}"];
  else if (
    command.purpose === "create" ||
    command.purpose === "list_name" ||
    command.purpose === "list_label"
  ) {
    if (
      typeof command.probeId !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9-]{0,63}$/u.test(command.probeId)
    )
      throw new Error("docker_probe_identity_invalid");
    const resource = describeDockerProbeResource(command.probeId);
    const name = resource.name;
    if (command.purpose === "list_name" || command.purpose === "list_label") {
      args = [
        "container",
        "ls",
        "--all",
        "--quiet",
        "--no-trunc",
        "--filter",
        command.purpose === "list_name"
          ? `name=^/${name}$`
          : `label=${resource.label}`,
      ];
    } else {
      const mountInput = command.mounts;
      if (
        mountInput === null ||
        typeof mountInput !== "object" ||
        utilTypes.isProxy(mountInput) ||
        (Object.getPrototypeOf(mountInput) !== Object.prototype &&
          Object.getPrototypeOf(mountInput) !== null) ||
        Reflect.ownKeys(mountInput).some(
          (key) =>
            typeof key !== "string" ||
            !["workspace", "providerHome", "tmp"].includes(key) ||
            !(
              "value" in
              (Object.getOwnPropertyDescriptor(mountInput, key) ?? {})
            ),
        )
      )
        throw new Error("docker_probe_mount_invalid");
      if (
        typeof command.source !== "string" ||
        Buffer.byteLength(command.source) > 1_048_576 ||
        command.source.includes("\0")
      )
        throw new Error("docker_probe_payload_invalid");
      const mounts = [
        [command.mounts.workspace, "/operation/workspace"],
        [command.mounts.providerHome, "/operation/provider-home"],
        [command.mounts.tmp, "/operation/tmp"],
      ] as const;
      for (const [source] of mounts)
        if (
          typeof source !== "string" ||
          !path.isAbsolute(source) ||
          /[,\r\n\0]/u.test(source)
        )
          throw new Error("docker_probe_mount_invalid");
      args = [
        "create",
        "--pull=never",
        "--network=none",
        "--read-only",
        "--name",
        name,
        "--label",
        resource.label,
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--user=65532:65532",
        "--workdir=/operation/workspace",
        "--env",
        "HOME=/operation/provider-home",
        "--env",
        "TMPDIR=/operation/tmp",
        ...mounts.flatMap(([source, destination]) => [
          "--mount",
          `type=bind,src=${source},dst=${destination}`,
        ]),
        "--entrypoint",
        "python",
        resource.image,
        "-c",
        command.source,
      ];
    }
  } else {
    if (
      typeof command.containerId !== "string" ||
      !/^[a-f0-9]{64}$/u.test(command.containerId)
    )
      throw new Error("docker_probe_container_id_invalid");
    switch (command.purpose) {
      case "inspect":
        args = ["container", "inspect", command.containerId];
        break;
      case "list_id":
        args = [
          "container",
          "ls",
          "--all",
          "--quiet",
          "--no-trunc",
          "--filter",
          `id=${command.containerId}`,
        ];
        break;
      case "remove":
        args = ["container", "rm", "--force", command.containerId];
        break;
      case "start":
        args = ["start", command.containerId];
        break;
      case "start_attached":
        args = ["start", "--attach", command.containerId];
        break;
      case "terminate":
        args = [
          "container",
          "kill",
          "--signal",
          "SIGTERM",
          command.containerId,
        ];
        break;
      default:
        throw new Error("docker_probe_purpose_invalid");
    }
  }
  return Object.freeze(["-H", ENGINE, ...args]);
}

/**
 * 固定診断操作をfresh CLI確認後に同期実行する。
 * @responsibility 起動要求と結果／errorを区別して上位へ返す。
 * @trace ARCH-000008
 * @input binding: 固定CLIと最小環境観測。command: 固定用途。timeoutMs: 有界観測期限。
 * @returns 元ProcessのStatus／Signal／error／限定出力。
 * @precondition 資源構成、Mount、Authorityは上位が確認済み。
 * @postcondition errorや空出力を成功／不存在へ分類しない。
 * @effect 固定Docker CLIをshellなしで一度実行する。
 * @failure 構成・環境・CLI不正は開始前拒否、Process失敗は元結果で返す。
 * @invariant Resource／Recoveryの耐久Stateを追加しない。
 * @boundary Windows同期Processと診断Owner。
 * @security 固定Engine、64KiB出力上限、限定環境、shell=false。
 * @concurrency 同じ呼出しの入力snapshotと最終CLI確認を実行直前に行う。
 */
export function executeDockerProbeCommand(
  binding: Readonly<{
    verifyCli: () => string;
    environment: () => Readonly<Record<string, string>>;
  }>,
  command: DockerProbeCommand,
  timeoutMs: number,
): SpawnSyncReturns<string> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 600_000)
    throw new Error("docker_probe_timeout_invalid");
  const argv = planDockerProbeCommand(command);
  const environment = captureDockerProcessEnvironment(binding.environment());
  const executable = binding.verifyCli();
  return spawnSync(executable, [...argv], {
    encoding: "utf8",
    windowsHide: true,
    shell: false,
    timeout: timeoutMs,
    maxBuffer: 64 * 1024,
    env: environment,
  });
}

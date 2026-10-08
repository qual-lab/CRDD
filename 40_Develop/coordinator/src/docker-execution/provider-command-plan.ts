/**
 * Docker準備候補の固定コマンド組立てを所有する。
 *
 * @responsibility Provider固有CLI記述を受け取り、認証・Network・Proxy・実行の既存順序へ固定する。
 * @trace ARCH-000015
 */
import type {
  ProviderDockerCommand,
  ProviderDockerCommandPlanInput,
} from "./types.ts";

const PROVIDER_HOME_DESTINATION = "/provider-home";

/**
 * Dockerへ渡す固定bind Mount文字列を構築する。
 *
 * @responsibility 区切り文字と制御文字を拒否し、private伝播のbind記述を生成する。
 * @trace ARCH-000015
 * @input source: 検証済みHost Path。destination: 呼出し側の固定Container Path。
 * @returns bind記述、または不正なsourceに対するnull。
 * @precondition Pathの実体・所有・Root照合は呼出し側が完了している。
 * @postcondition 空値、comma、NUL、CR、LFを受理しない。
 * @effect N/A: 文字列生成だけでMountを発行しない。
 * @failure sourceの禁止文字をnullで拒否する。
 * @invariant 文字列検査をPath実体やAuthorityの証明にしない。
 * @boundary Host PathとDocker bind引数の間。
 * @security 生成値は内部計画に限定し公開しない。
 * @concurrency N/A: 同期局所処理である。
 */
export function createProviderDockerMount(source: string, destination: string) {
  if (
    source.length === 0 ||
    source.includes(",") ||
    source.includes("\0") ||
    source.includes("\r") ||
    source.includes("\n")
  ) {
    return null;
  }
  return `type=bind,src=${source},dst=${destination},bind-propagation=rprivate`;
}

/**
 * 目的とargvを凍結したDockerコマンド値を構築する。
 *
 * @responsibility 引数配列をコピーし、後続の参照変更を防ぐ。
 * @trace ARCH-000015
 * @input purpose: 固定コマンド目的。argv: 組立て済み引数列。
 * @returns 凍結したProviderDockerCommand。
 * @precondition 組立てOwnerが目的と引数を固定している。
 * @postcondition 返却Objectとコピーしたargvがともに凍結される。
 * @effect N/A: 局所値の生成だけでProcessを起動しない。
 * @failure N/A: 入力の受理判定を所有しない。
 * @invariant 元のargv参照を返却値へ保存しない。
 * @boundary N/A: 同期の局所値生成である。
 * @security 内部引数の公開やAuthority発行を行わない。
 * @concurrency N/A: 共有非同期状態を所有しない。
 */
function createCommand(
  purpose: string,
  argv: readonly string[],
): ProviderDockerCommand {
  return Object.freeze({ purpose, argv: Object.freeze([...argv]) });
}

/**
 * 両ProviderのDockerコマンドを固定順序で組み立てる。
 *
 * @responsibility 共通Container・Network・Proxy引数と、検証済みProvider固有記述の搬送を所有する。
 * @trace ARCH-000015
 * @input input: 照合済み資源名、Mount、CLI、環境および固定起動条件。
 * @returns 凍結された九コマンドと各argv。
 * @precondition 呼出し側がModel、Authority、Mountと固定配布物を照合済みである。
 * @postcondition 認証、二Network、Proxy、Provider、開始の既存順序を維持する。
 * @effect N/A: 引数配列の生成だけを行い、Docker要求を発行しない。
 * @failure N/A: 入力の受理判定は準備Ownerが所有する。
 * @invariant Prompt本文はargvへ含めず、Reviewer Workspaceだけreadonlyにする。
 * @boundary Coordinatorの準備OwnerとDocker実行Ownerの計画境界。
 * @security non-root、read-only、cap-dropとno-new-privilegesを共通に固定する。
 * @concurrency N/A: Storeや共有非同期処理を所有しない。
 */
export function buildProviderDockerCommandPlan(
  input: ProviderDockerCommandPlanInput,
): readonly ProviderDockerCommand[] {
  const {
    provider,
    authContainerName,
    providerContainerName,
    proxyContainerName,
    internalNetworkName,
    egressNetworkName,
    ownershipLabel,
    providerImageDigest,
    proxyImageDigest,
    providerHomeMount,
    tmpMount,
    workspaceMount,
    proxyToken,
    providerEnvironmentEntries,
    authenticationEnvironmentArguments,
    authenticationArgv: authenticationArguments,
    providerArgv: providerArguments,
    interactive: isInteractive,
    taskRole,
    initRequired,
    executorSeccompProfile,
  } = input;
  return Object.freeze([
    createCommand("create_subscription_auth_probe", [
      "create",
      "--pull=never",
      "--network=none",
      "--read-only",
      "--name",
      authContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=32",
      "--user=65534:65534",
      "--env",
      `HOME=${PROVIDER_HOME_DESTINATION}`,
      ...authenticationEnvironmentArguments,
      "--mount",
      `${providerHomeMount},readonly`,
      providerImageDigest,
      ...authenticationArguments,
    ]),
    createCommand("start_subscription_auth_probe_attached", [
      "start",
      "--attach",
      authContainerName,
    ]),
    createCommand("create_internal_network", [
      "network",
      "create",
      "--driver=bridge",
      "--internal",
      "--label",
      ownershipLabel,
      internalNetworkName,
    ]),
    createCommand("create_egress_network", [
      "network",
      "create",
      "--driver=bridge",
      "--label",
      ownershipLabel,
      egressNetworkName,
    ]),
    createCommand("create_proxy", [
      "create",
      "--pull=never",
      "--network",
      internalNetworkName,
      "--network-alias",
      "proxy",
      "--read-only",
      "--name",
      proxyContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      "--pids-limit=64",
      "--user=65534:65534",
      "--tmpfs",
      "/tmp:rw,noexec,nosuid,size=16777216",
      "--env",
      `CRDD_PROXY_AUTH=${proxyToken}`,
      "--env",
      `CRDD_PROXY_PROFILE=${provider}`,
      proxyImageDigest,
    ]),
    createCommand("connect_proxy_egress", [
      "network",
      "connect",
      egressNetworkName,
      proxyContainerName,
    ]),
    createCommand("create_provider", [
      "create",
      ...(initRequired ? ["--init"] : []),
      ...(isInteractive ? ["--interactive"] : []),
      "--pull=never",
      "--network",
      internalNetworkName,
      "--read-only",
      "--name",
      providerContainerName,
      "--label",
      ownershipLabel,
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
      ...(executorSeccompProfile
        ? [`--security-opt=seccomp=${executorSeccompProfile}`]
        : []),
      "--pids-limit=64",
      "--user=65534:65534",
      "--workdir=/work",
      ...providerEnvironmentEntries,
      "--mount",
      providerHomeMount,
      "--mount",
      tmpMount,
      ...(workspaceMount !== null
        ? [
            "--mount",
            taskRole === "reviewer"
              ? `${workspaceMount},readonly`
              : workspaceMount,
          ]
        : []),
      providerImageDigest,
      ...providerArguments,
    ]),
    createCommand("start_proxy", ["start", proxyContainerName]),
    createCommand("start_provider_attached", [
      "start",
      "--attach",
      ...(isInteractive ? ["--interactive"] : []),
      providerContainerName,
    ]),
  ]);
}

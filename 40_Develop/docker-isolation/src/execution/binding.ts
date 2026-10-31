/**
 * 検証済みCLI記述へ固定Image・Network・Mount意図を結合する。
 * @packageDocumentation
 * @responsibility Provider CLIを再定義せず、用途別の固定隔離配置を所有する。
 * @trace ARCH-000015
 */
import type { DockerNetworkPolicy } from "../network/policy.ts";
import { describeDockerProviderAssets } from "../image/assets.ts";
import { describeDockerProxyTopology } from "../network/policy.ts";
import {
  createDockerAuthenticationEnvironment,
  projectDockerProxyConfiguration,
  codexAdviceProviderInitRequired,
  type DockerIsolationCommandInput,
} from "./plan.ts";

/**
 * CLI記述をDocker構成へ結合する技術入力。
 * @responsibility TaskやAuthorityではなく資源・所在・実行記述を受ける。
 * @trace ARCH-000008
 * @shape 用途、CLI、資源、Mount、Policyとcreate又はverify。
 * @invariant 初回Tokenと元Commandはどちらか一方。
 * @boundary ExecutorとDocker技術計画。
 * @security 本文・管理Capability・Recovery参照を含めない。
 * @compatibility 既存の固定九Commandを維持する。
 */
export type ProviderCommandBinding = Readonly<{
  provider: "codex" | "claude";
  purpose: "task" | "advice" | "probe";
  role: "executor" | "reviewer" | null;
  execution: Readonly<{
    provider: "codex" | "claude";
    argv: readonly string[];
    environment: Readonly<Record<string, string>>;
  }>;
  authentication: Readonly<{
    argv: readonly string[];
    homeEnvironmentVariable: string | null;
  }>;
  resources: Pick<
    DockerIsolationCommandInput,
    | "authenticationContainerName"
    | "executionContainerName"
    | "proxyContainerName"
    | "internalNetworkName"
    | "egressNetworkName"
    | "ownershipLabel"
    | "executionImageDigest"
    | "proxyImageDigest"
  >;
  homeSourcePath: string;
  temporarySourcePath: string;
  workspace: DockerIsolationCommandInput["workspace"];
  networkPolicy: DockerNetworkPolicy | null;
}> &
  (
    | Readonly<{ mode: "create"; proxyToken: string; commands?: never }>
    | Readonly<{
        mode: "verify";
        commands: readonly Readonly<{
          purpose: string;
          argv: readonly string[];
        }>[];
        proxyToken?: never;
      }>
  );

/**
 * 初回構築と再照合で同じDocker構成を組み立てる。
 * @responsibility Image・Proxy・Mount・認証環境・Seccompの規則を集約する。
 * @trace ARCH-000008
 * @input 検証済みCLI記述と有限な技術値。
 * @returns 正規構成又はnull。
 * @precondition Provider仕様・現在Authority・操作相関は上位が確認する。
 * @postcondition 構成から起動・認証・清掃成功を推定しない。
 * @effect N/A: 値の組立のみ。乱数・Process・Dockerを発行しない。
 * @failure 不正Token・Digest・用途・Mount条件は拒否する。
 * @invariant createとverifyで別の組立規則を持たない。
 * @boundary Executorの一試行結合とDocker技術構成。
 * @security 元Command照合はAuthority検査を代替しない。
 * @concurrency N/A: 共有状態やLockを持たない。
 */
export function bindProviderCommand(
  input: ProviderCommandBinding,
): DockerIsolationCommandInput | null {
  if (
    input.execution.provider !== input.provider ||
    !["task", "advice", "probe"].includes(input.purpose)
  )
    return null;
  const assets = describeDockerProviderAssets(input.provider);
  const egress = describeDockerProxyTopology(input.provider);
  const expectedImage =
    input.purpose === "advice" && input.provider === "codex"
      ? describeDockerProviderAssets("codex").adviceIdentity.fixedImageDigest
      : assets.fixedImageDigest;
  if (
    assets.fixedDigestImageRequired !== true ||
    egress.providerNetworkInternal !== true ||
    egress.providerDirectExternalNetwork !== false ||
    egress.proxyNetworks.length !== 2 ||
    input.resources.executionImageDigest !== expectedImage ||
    input.resources.proxyImageDigest !== egress.imageDigest ||
    (input.networkPolicy !== null &&
      input.networkPolicy.provider !== input.provider)
  )
    return null;
  if (
    input.purpose === "task"
      ? (input.role !== "executor" && input.role !== "reviewer") ||
        !input.workspace ||
        input.workspace.readOnly !== (input.role === "reviewer")
      : input.role !== null || input.workspace !== null
  )
    return null;
  let token: string;
  if (input.mode === "create") {
    if (Object.hasOwn(input, "commands")) return null;
    token = input.proxyToken;
  } else if (input.mode === "verify") {
    if (Object.hasOwn(input, "proxyToken")) return null;
    const proxy = projectDockerProxyConfiguration(
      input.commands,
      input.resources.proxyImageDigest,
    );
    if (
      !proxy ||
      proxy.profile !== input.provider ||
      JSON.stringify(proxy.networkPolicy) !==
        JSON.stringify(input.networkPolicy)
    )
      return null;
    token = proxy.token;
  } else return null;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/u.test(token)) return null;
  const environment = createDockerAuthenticationEnvironment(
    input.authentication.homeEnvironmentVariable,
  );
  if (!environment) return null;
  const seccompProfile =
    input.provider === "codex" &&
    input.purpose === "task" &&
    input.role === "executor"
      ? {
          sha256:
            describeDockerProviderAssets("codex").identity
              .executorSeccompProfileSha256,
          bytes:
            describeDockerProviderAssets("codex").identity
              .executorSeccompProfileBytes,
        }
      : null;
  return {
    ...input.resources,
    homeSourcePath: input.homeSourcePath,
    temporarySourcePath: input.temporarySourcePath,
    workspace: input.workspace,
    authentication: { argv: input.authentication.argv, environment },
    execution: {
      argv: input.execution.argv,
      environment: input.execution.environment,
      interactive: input.purpose !== "probe",
      initRequired: codexAdviceProviderInitRequired(
        input.purpose === "advice"
          ? "workbench_advice"
          : input.purpose === "task"
            ? "isolated_task"
            : "boolean_probe",
        input.resources.executionImageDigest,
      ),
      seccompProfile,
    },
    proxy: {
      profile: input.provider,
      token,
      port: egress.containerPort,
      extendedProxyEnvironment: input.provider === "codex",
      networkPolicy: input.networkPolicy,
    },
  };
}

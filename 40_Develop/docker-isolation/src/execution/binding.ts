/**
 * 検証済みCLI記述へ固定Image・Network・Mount意図を結合する。
 * @packageDocumentation
 * @responsibility Provider CLIを再定義せず、隔離配置とそのHashを所有する。
 * @trace ARCH-000015
 */
import { createHash } from "node:crypto";
import type { ProviderAdvicePlan } from "../../../ai-adapter/src/index.ts";
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
/**
 * Provider実行仕様を隔離環境の固定構成へ結合した値。
 * @responsibility Image・通信・Mount条件を同じCommandとして運ぶ。
 * @trace ARCH-000015
 * @shape ProviderAdvicePlanと固定Image・Network・非共有条件。
 * @invariant RepositoryとWorkspaceをMountしない。
 * @boundary AI Adapterの実行仕様とDocker実行構成。
 * @security 型だけで認可済み又は実行可能とは扱わない。
 * @compatibility 移管前のCommand fieldとHash順序を維持する。
 */
export type AdviceCommand = ProviderAdvicePlan &
  Readonly<{
    fixedImageDigest: string;
    networkPolicy: DockerNetworkPolicy | null;
    providerHomeMountRequired: true;
    repositoryMounted: false;
    workspaceMountRequired: false;
  }>;
/**
 * Provider Commandの完全性Hashを生成する。
 *
 * @responsibility Provider実行に影響する全宣言値を決定論的SHA-256へ固定する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input command: 検証対象のProvider Command。
 * @returns 小文字16進SHA-256、直列化不能時はnullを返す。
 * @precondition commandは上位計画から渡されるが完全性は未確定である。
 * @postcondition 同じ宣言値には同じHashを返す。
 * @effect N/A: 局所計算だけを行う。
 * @failure 直列化失敗をnullへ閉じる。
 * @invariant Prompt本文をCommand Hashへ含めない。
 * @boundary Provider Command宣言とRuntime Packet Identityの間。
 * @security 任意Objectのgetter例外を外へ公開しない。
 * @concurrency N/A: 共有状態を変更しない同期処理である。
 */
export function hashAdviceCommand(command: AdviceCommand) {
  try {
    return createHash("sha256")
      .update(
        JSON.stringify({
          contract: command.contract,
          contractRevision: command.contractRevision,
          provider: command.provider,
          command: command.command,
          argv: command.argv,
          environment: command.environment,
          fixedImageDigest: command.fixedImageDigest,
          networkPolicy: command.networkPolicy,
          modelIdentifier: command.modelIdentifier,
          identifierKind: command.identifierKind,
          catalogIdentity: command.catalogIdentity,
          reasoningEffort: command.reasoningEffort,
          promptTransport: command.promptTransport,
          resultTransport: command.resultTransport,
          providerHomeMountRequired: command.providerHomeMountRequired,
          repositoryMounted: command.repositoryMounted,
          workspaceMountRequired: command.workspaceMountRequired,
          toolsAllowed: command.toolsAllowed,
          sessionPersistenceAllowed: command.sessionPersistenceAllowed,
        }),
        "utf8",
      )
      .digest("hex");
  } catch {
    return null;
  }
}

/**
 * CLI計画を助言Packetの既存技術契約へ結合する。
 * @responsibility Imageと非共有条件の所有を上位に閉じる。
 * @trace ARCH-000015
 * @input plan: AI Adapterが生成した検証済み助言CLI計画。
 * @returns 固定ImageとMount意図を結合した同じ閉じたCommand。
 * @precondition 信頼した構成側がDocker側の実行位置で生成している。
 * @postcondition CLI引数・環境・Modelを改変しない。
 * @effect N/A: 不変値の構築だけ。
 * @failure N/A: 対応Providerの固定データだけを利用する。
 * @invariant 取得を実Image検証や送信許可にしない。
 * @boundary ProviderのCLI記述と隔離実行の技術相関。
 * @security Prompt・秘密・Host Rootを追加しない。
 * @concurrency N/A: 同期値だけ。
 */
export function bindAdviceCommand(
  plan: ProviderAdvicePlan,
  networkPolicy: DockerNetworkPolicy | null = null,
): AdviceCommand {
  return Object.freeze({
    ...plan,
    networkPolicy,
    fixedImageDigest:
      plan.provider === "codex"
        ? describeDockerProviderAssets("codex").adviceIdentity.fixedImageDigest
        : describeDockerProviderAssets("claude").fixedImageDigest,
    providerHomeMountRequired: true as const,
    repositoryMounted: false as const,
    workspaceMountRequired: false as const,
  });
}

/**
 * 固定Image・配置・通信能力の静的な値契約。
 * @responsibility 実物観測・認証・実行許可とは独立した構成だけを定義する。
 * @trace ARCH-000008
 */
import type { DockerNetworkPolicyResult } from "../network/policy.ts";

/**
 * 固定Proxyの配置を表す。
 * @responsibility Digestとport・更新禁止の構成値を共有する。
 * @trace ARCH-000008
 * @shape imageDigest、containerPort、二つのfalse設定。
 * @invariant 設定値だけで実行時の強制成立を証明しない。
 * @boundary 固定資産Ownerと静的構成。
 * @security 認証情報・Host Path・任意命令を含めない。
 * @compatibility 既存の固定値と禁止設定を維持する。
 */
type DockerProxyAssets = Readonly<{
  imageDigest: string;
  containerPort: 8080;
  runtimePullAllowed: false;
  autoUpdateAllowed: false;
}>;

/**
 * 共通の固定Image条件を表す。
 * @responsibility 既存のImageとProxyの配置条件を共有する。
 * @trace ARCH-000008
 * @shape Proxy、Image Digest、固定Digest必須と更新禁止。
 * @invariant Imageの存在・署名・起動可能性を型から推定しない。
 * @boundary 不変metadataと技術構成。
 * @security Runtimeの任意Image受付を追加しない。
 * @compatibility 既存の配置fieldを維持する。
 */
type DockerImageAssets = Readonly<{
  proxy: DockerProxyAssets;
  fixedDigestImageRequired: true;
  fixedImageDigest: string;
  autoUpdateAllowed: false;
  runtimePullAllowed: false;
}>;

/**
 * インストール済み実行物の差だけを表す。
 * @responsibility Provider別の実在する固定配置を結合する。
 * @trace ARCH-000008
 * @shape 共通Image条件と各実行物Identity。Codexだけ既存別Imageを持つ。
 * @invariant 用途Lifecycleと実行許可を所有しない。
 * @boundary Image内配置とExecutorの構成選択。
 * @security 認証情報・任意Path・任意実行を受け付けない。
 * @compatibility 既存Image・版・Seccomp材料を変更しない。
 */
export type DockerProviderAssetMap = {
  codex: DockerImageAssets &
    Readonly<{
      identity: Readonly<{
        executablePath: string;
        exactVersion: string;
        executorSeccompProfileSha256: string;
        executorSeccompProfileBytes: number;
      }>;
      adviceIdentity: Readonly<{
        exactVersion: string;
        executablePath: string;
        fixedImageDigest: string;
      }>;
    }>;
  claude: DockerImageAssets &
    Readonly<{
      identity: Readonly<{ executablePath: string; exactVersion: string }>;
    }>;
};

/**
 * CLI構築に必要なImage内の固定配置を表す。
 * @responsibility 実行物と設定・Schema・Homeの所在を搬送する。
 * @trace ARCH-000008
 * @shape commandPath、workingDirectory、Home、Schemaと設定Path。
 * @invariant Host上の任意所在やMount許可ではない。
 * @boundary DI配置とAI Adapterへの値結合。
 * @security Host秘密・共有資源への能力を含めない。
 * @compatibility 既存のImage内Pathを維持する。
 */
export type DockerExecutionLocations = Readonly<{
  commandPath: string;
  workingDirectory: "/work";
  providerHomeDirectory: "/provider-home";
  resultSchemaPath: string;
  executorSchemaPath: string;
  reviewerSchemaPath: string;
  taskSettingsPath: string;
  managedSettingsPath: string;
}>;

/**
 * 固定Proxyの技術構成を表す。
 * @responsibility Image・port・固定Hostと二Network条件を搬送する。
 * @trace ARCH-000008
 * @shape Provider、固定Proxy、内部Networkと直接外部通信禁止。
 * @invariant 実効追加Hostは一回のPolicyにだけ属する。
 * @boundary 静的構成と実行時Proxyの技術強制。
 * @security この値だけで接続やDNS安全性を肯定しない。
 * @compatibility 既存Topologyの値と強制条件を維持する。
 */
export type DockerProxyTopology = Readonly<{
  provider: "codex" | "claude";
  proxyProfile: "codex" | "claude";
  containerPort: 8080;
  imageDigest: string;
  allowedHostnames: readonly string[];
  providerNetwork: "operation_internal";
  providerNetworkInternal: true;
  providerDirectExternalNetwork: false;
  proxyNetworks: readonly string[];
  dockerSocketMounted: false;
  hostNetworkModeAllowed: false;
  localFallbackAllowed: false;
  enforcement: "fixed_digest_proxy_runtime_validation_required";
}>;

/**
 * 配置記述に共通するProxyと通信条件を表す。
 * @responsibility metadataとPolicy成立判定を同一視しない。
 * @trace ARCH-000008
 * @shape proxyとready又はblockedのnetworkPolicy。
 * @invariant metadataがあってもPolicy不成立を保持する。
 * @boundary 純粋Catalogと構成・同意の利用側。
 * @security 通信許可・Authorityを発行しない。
 * @compatibility 既存Policyの返却値を再構成しない。
 */
type IsolationCapabilityDetails = Readonly<{
  proxy: DockerProxyTopology;
  networkPolicy: DockerNetworkPolicyResult;
}>;

/**
 * 実在する配置差と識別子の対応を表す。
 * @responsibility Codexの二配置とClaudeの単一配置を区別する。
 * @trace ARCH-000008
 * @shape ProviderごとのAssetsと配置slot、共通の技術条件。
 * @invariant Claudeに架空の別Imageを追加しない。
 * @boundary 固定配置と型付きCatalog結果。
 * @security 識別子は認証・実行能力ではない。
 * @compatibility 元配置の対応を維持する。
 */
type IsolationCapabilityMap = {
  runtime: Readonly<{
    image: string;
    engine: "docker_desktop_linux_named_pipe";
    runtimeProfile: Readonly<{
      backend: "docker_desktop_linux";
      endpoint: "local_named_pipe";
      dockerCliTrust: "fixed_path_valid_windows_authenticode_docker_inc_and_operation_snapshot";
      imagePinnedByDigest: true;
      networkMode: "none";
    }>;
  }>;
  codex: IsolationCapabilityDetails &
    Readonly<{
      provider: "codex";
      assets: DockerProviderAssetMap["codex"];
      locations: Readonly<{
        primary: DockerExecutionLocations;
        alternate: DockerExecutionLocations;
      }>;
    }>;
  claude: IsolationCapabilityDetails &
    Readonly<{
      provider: "claude";
      assets: DockerProviderAssetMap["claude"];
      locations: Readonly<{ primary: DockerExecutionLocations }>;
    }>;
};

/**
 * 配置識別子に対応する静的Catalog結果を表す。
 * @responsibility 型引数でAssetsと配置の相関を保持する。
 * @trace ARCH-000008
 * @shape 指定配置の値。省略時は両配置のUnion。
 * @invariant networkPolicyの成立は利用側が独立して判定する。
 * @boundary DIの純粋情報取得と利用側構成。
 * @security 稼働状態・認証・実行許可を表さない。
 * @compatibility 既存固定値の相関だけをまとめる。
 */
export type IsolationCapabilities<
  P extends keyof IsolationCapabilityMap = keyof IsolationCapabilityMap,
> = IsolationCapabilityMap[P];

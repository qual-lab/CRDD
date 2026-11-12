/**
 * Docker内に配置するProvider実行物・Image・設定の現在の同一性を定義する。
 * @packageDocumentation
 * @responsibility 配置と固定資産を所有し、ProviderのCLI解釈や認証・実行許可を生成しない。
 * @trace ARCH-000008
 */
import type {
  IsolationConfiguration,
  DockerExecutionLocations,
  DockerImageProfile,
  DockerProviderAssetMap,
} from "./types.ts";

export const DIAGNOSTIC_IMAGE =
  "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047";

const PROXY = Object.freeze({
  imageDigest:
    "sha256:4270d4dc5c3cddd9733712eb202309a51250b858a53e68882889edc88f413766",
  containerPort: 8080,
  runtimePullAllowed: false,
  autoUpdateAllowed: false,
} as const);
const CODEX = Object.freeze({
  proxy: PROXY,
  identity: {
    executablePath: "/opt/crdd/providers/codex/0.164.0/codex",
    exactVersion: "0.164.0",
    executorSeccompProfileSha256:
      "01e577dd6fc81e04987af29b05389e9432dc0623a66aa435fd2f31f2b1070b95",
    executorSeccompProfileBytes: 16703,
  },
  alternateIdentity: {
    exactVersion: "0.164.0",
    executablePath: "/opt/crdd/providers/codex/0.164.0/codex",
    fixedImageDigest:
      "sha256:112a73d8576b6aa3e04db76b5fee98a0f5636f5ca539ef039aa555ccd9b76de3",
  },
  fixedDigestImageRequired: true,
  fixedImageDigest:
    "sha256:9f585128d400a0537679df549c91917940880044588517c66943af915dec4349",
  autoUpdateAllowed: false,
  runtimePullAllowed: false,
} as const);
const CLAUDE = Object.freeze({
  proxy: PROXY,
  identity: {
    executablePath: "/opt/crdd/providers/claude/2.1.310/claude",
    exactVersion: "2.1.310",
  },
  fixedDigestImageRequired: true,
  fixedImageDigest:
    "sha256:612433b71c4af3dfb135c00daad64f0ef897f86e0251b4da558715fdfde9c51f",
  autoUpdateAllowed: false,
  runtimePullAllowed: false,
} as const);
Object.freeze(CODEX.identity);
Object.freeze(CODEX.alternateIdentity);
Object.freeze(CLAUDE.identity);

/** 固定Imageが許可する技術条件。用途分類・実行許可は持たない。 */
const IMAGE_PROFILES: Readonly<Record<string, DockerImageProfile>> =
  Object.freeze({
    [CODEX.fixedImageDigest]: Object.freeze({
      user: "65534:65534",
      entrypoints: Object.freeze([null]),
      externalNetwork: false,
    }),
    [CODEX.alternateIdentity.fixedImageDigest]: Object.freeze({
      user: "65534:65534",
      entrypoints: Object.freeze([null]),
      externalNetwork: false,
    }),
    [CLAUDE.fixedImageDigest]: Object.freeze({
      user: "65534:65534",
      entrypoints: Object.freeze([null]),
      externalNetwork: false,
    }),
    [PROXY.imageDigest]: Object.freeze({
      user: "65534:65534",
      entrypoints: Object.freeze([null]),
      externalNetwork: true,
    }),
    [DIAGNOSTIC_IMAGE]: Object.freeze({
      user: "65532:65532",
      entrypoints: Object.freeze([null, "python"]),
      externalNetwork: false,
    }),
  });

/**
 * 固定Digestに対応する技術制約を取得する。
 * @responsibility User・Entrypoint・外向き接続条件を固定資産の同じ正本へ結合する。
 * @trace ARCH-000008
 * @input image: 固定Imageのexact参照。
 * @returns 許可済み制約。未知Imageはnull。
 * @effect N/A: 不変Catalogの読取りだけ。
 * @failure 未知値を既定Profileへ補完しない。
 * @invariant Image存在・利用許可は発行しない。
 */
export function resolveDockerImageProfile(
  image: string,
): DockerImageProfile | null {
  return Object.hasOwn(IMAGE_PROFILES, image)
    ? (IMAGE_PROFILES[image] ?? null)
    : null;
}

/**
 * Provider配置の固定資産を取得する。
 * @responsibility 同じAsset情報を計画時とEffect直前の照合へ提供する。
 * @trace ARCH-000008
 * @input provider: 配置済みProvider識別子。
 * @returns 現在の固定Imageと実行物の同一性記述。
 * @precondition 信頼した構成側から利用する。
 * @postcondition Image・Hash・配置を更新しない。
 * @effect N/A: 固定値の取得だけ。
 * @failure 未知Providerは固定例外。
 * @invariant 取得を実物検証・署名・認証・実行許可へ昇格しない。
 * @boundary Docker配置と技術構成の内部結合。
 * @security 秘密・Host Path・上位Authorityなし。
 * @concurrency N/A: 不変データのみ。
 */
export function describeDockerProviderAssets<
  P extends keyof DockerProviderAssetMap,
>(provider: P): DockerProviderAssetMap[P];
export function describeDockerProviderAssets(
  provider: keyof DockerProviderAssetMap,
): DockerProviderAssetMap[keyof DockerProviderAssetMap] {
  if (provider !== "codex" && provider !== "claude")
    throw new Error("docker_provider_assets_invalid");
  return provider === "codex" ? CODEX : CLAUDE;
}

/**
 * CLI引数生成へ渡す実行位置だけを返す。
 * @responsibility 実行Path・Schema・Home・設定の配置を一箇所から結合する。
 * @trace ARCH-000008
 * @input providerと固定Image Profile。
 * @returns Image・Mountを含まない実行位置データ。
 * @precondition 検証済みの固定Imageを使う信頼した構成側だけ。
 * @postcondition 引数の文字列置換・Image取得・CLI実行を行わない。
 * @effect N/A: 固定値の投影だけ。
 * @failure 不明Provider・Profileは固定例外。
 * @invariant このデータを外部要求やCatalogから上書きさせない。
 * @boundary Docker配置OwnerからCLI引数生成への値境界。
 * @security Host秘密・実Root・Authorityを含まない。
 * @concurrency N/A: 同期不変値。
 */
export function describeDockerProviderExecutionLocations(
  provider: "codex" | "claude",
  profile: "primary" | "alternate",
): DockerExecutionLocations {
  if (
    (provider !== "codex" && provider !== "claude") ||
    !["primary", "alternate"].includes(profile) ||
    (provider === "claude" && profile === "alternate")
  )
    throw new Error("docker_provider_locations_invalid");
  return Object.freeze({
    commandPath:
      provider === "codex"
        ? profile === "alternate"
          ? CODEX.alternateIdentity.executablePath
          : CODEX.identity.executablePath
        : CLAUDE.identity.executablePath,
    workingDirectory: "/work",
    providerHomeDirectory: "/provider-home",
    resultSchemaPath: "/etc/crdd/codex-result-schema.json",
    executorSchemaPath: "/etc/crdd/codex-executor-result-schema.json",
    reviewerSchemaPath: "/etc/crdd/codex-reviewer-result-schema.json",
    taskSettingsPath: "/etc/crdd/claude-task-settings.json",
    managedSettingsPath: "/etc/claude-code/managed-settings.json",
  });
}

/**
 * 固定Image・配置・Proxy固定設定を返す。
 * @responsibility 各値の正本を再定義せず、実行構築前に同じ固定定義を提供する。
 * @trace ARCH-000008
 * @input provider: 固定配置識別子。未指定時は固定診断環境の記述。
 * @returns 非秘密の構成記述。Image・実行位置・Proxyの固定構成。
 * @precondition Repository選定・実行Authorityは利用側が所有する。
 * @postcondition 元入力を保持せず、Engine・Image存在・認証状態を判定しない。
 * @effect N/A: 固定値取得と固定値の合成のみ。
 * @failure 未知Providerは固定例外。
 * @invariant Assets取得を実行可能性や通信許可へ昇格しない。
 * @security Secret・Host Path・任意Image・任意argvを入力又は返却へ追加しない。
 * @concurrency Cache・状態・非同期処理を持たない。
 */
export function describeIsolationConfiguration(): IsolationConfiguration<"runtime">;
export function describeIsolationConfiguration<P extends "codex" | "claude">(
  provider: P,
): IsolationConfiguration<P>;
export function describeIsolationConfiguration(
  provider?: "codex" | "claude",
): IsolationConfiguration {
  if (provider === undefined)
    return Object.freeze({
      image: DIAGNOSTIC_IMAGE,
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
  if (provider !== "codex" && provider !== "claude")
    throw Error("docker_isolation_configuration_invalid");
  const primary = describeDockerProviderExecutionLocations(provider, "primary");
  const common = { proxy: describeDockerProviderAssets(provider).proxy };
  return provider === "codex"
    ? Object.freeze({
        ...common,
        provider,
        assets: describeDockerProviderAssets(provider),
        locations: Object.freeze({
          primary,
          alternate: describeDockerProviderExecutionLocations(
            provider,
            "alternate",
          ),
        }),
      })
    : Object.freeze({
        ...common,
        provider,
        assets: describeDockerProviderAssets(provider),
        locations: Object.freeze({ primary }),
      });
}

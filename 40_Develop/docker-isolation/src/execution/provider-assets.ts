/**
 * Docker内に配置するProvider実行物・Image・設定の現在の同一性を定義する。
 * @packageDocumentation
 * @responsibility 配置と固定資産を所有し、ProviderのCLI解釈や認証・実行許可を生成しない。
 * @trace ARCH-000008
 */
const CODEX = Object.freeze({
  identity: {
    targetPlatform: "linux-x64-musl",
    executablePath: "/opt/crdd/providers/codex/0.149.1/codex",
    exactVersion: "0.149.1",
    releaseTag: "rust-v0.149.1",
    releaseCommit: "ff29a44391deccde0aba0f8390337d7f3c319ea4",
    archiveSha256:
      "e24fb784c7d71140d67afb620f56e9137496cf7f6c9e19217fa3666dcf306278",
    archiveBytes: 99479490,
    binarySha256:
      "73dc5888888f411c1f0fa7b81d866e721dcc86b527ce8e3b2cf4708661e823ba",
    binaryBytes: 258227840,
    sigstoreBundleSha256:
      "1976d459060cac4638f481b72142271d8bbd821abebd72555145b83b2bf3e85e",
    sigstoreIdentity:
      "https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.149.1",
    sigstoreIssuer: "https://token.actions.githubusercontent.com",
    bwrapArchiveSha256:
      "7b0604dc48a487e25dae35a1f200aaf125666c5c8ef73bc913e915cebc86ce7b",
    bwrapArchiveBytes: 261611,
    bwrapBinaryPath: "/opt/crdd/providers/codex/0.149.1/codex-resources/bwrap",
    bwrapBinarySha256:
      "01fb705f067bd5365b63d8ad2323a61c8d007733ca5e649437e086f3fb9935d8",
    bwrapBinaryBytes: 529776,
    bwrapSigstoreBundleSha256:
      "2c8b6f67a874ecb25e231366302386450775266220c08d98625408171c0d0238",
    bwrapSigstoreIdentity:
      "https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.149.1",
    bwrapSigstoreIssuer: "https://token.actions.githubusercontent.com",
    executorSeccompProfilePath:
      "40_Develop/docker-isolation/runtime/codex-executor-seccomp.json",
    executorSeccompProfileSha256:
      "01e577dd6fc81e04987af29b05389e9432dc0623a66aa435fd2f31f2b1070b95",
    executorSeccompProfileBytes: 16703,
    executorSeccompBaselineCommit: "c3065211177705ada59a9ccf8b5c182f286f8c97",
    executorSeccompBaselineSha256:
      "536529b665dd0972c37bfb569f5d4ac8a53592e7b00752bc39ff063ca9864c74",
    fixedImageDigest:
      "sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c",
    fixedImageBytes: 145299281,
    executorSchemaSha256:
      "daf04adf5282157984b43559298a82f1ab16de837cfb5f6cc929805390f776ce",
    reviewerSchemaSha256:
      "09e8592838b1642f738eee07fb2c1b366dc25d6a3e842dbb0649930c94a25df8",
    imageBuildDefinition:
      "40_Develop/docker-isolation/runtime/codex-provider.Dockerfile",
    releaseUrl: "https://github.com/openai/codex/releases/tag/rust-v0.149.1",
  },
  adviceIdentity: {
    exactVersion: "0.159.2",
    sourceCommit: "ff6aec96948b70d94983af2641a6b67c94faeff5",
    sourceArchiveSha256:
      "b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a",
    officialCliUnmodified: true,
    executablePath: "/opt/crdd/providers/codex/0.159.2/codex",
    binarySha256:
      "1748767b230ebfc3d4ab7e4e254920d0c0ad9691fd8c11f190e7d44511a4a92e",
    hostExecutablePath:
      "/opt/crdd/providers/codex/0.159.2/codex-code-mode-host",
    hostBinarySha256:
      "5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03",
    bwrapBinaryPath: "/opt/crdd/providers/codex/0.159.2/codex-resources/bwrap",
    bwrapBinarySha256:
      "01fb705f067bd5365b63d8ad2323a61c8d007733ca5e649437e086f3fb9935d8",
    fixedImageDigest:
      "sha256:4f35a6542ee0b412714d558bc38e578bcea00490ec2a1f02f02b88c1226f924e",
    imageBuildDefinition:
      "40_Develop/docker-isolation/runtime/codex-advice-provider.Dockerfile",
    imageBuildDefinitionSha256:
      "92bc2fc6498fee09f745b1710fdb7ada7f868ef06b44d27499d6f6343407e29a",
  },
  fixedDigestImageRequired: true,
  fixedImageDigest:
    "sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c",
  autoUpdateAllowed: false,
  runtimePullAllowed: false,
} as const);
const CLAUDE = Object.freeze({
  identity: {
    targetPlatform: "linux-x64",
    executablePath: "/opt/crdd/providers/claude/2.1.220/claude",
    exactVersion: "2.1.220",
    upstreamCommit: "4073f59596e272f39393db4f96abc5f4b10eff21",
    binarySha256:
      "674f61f20ff306f3100cf9200e4c36c4b70278b5bef2884549819b942a89c863",
    binaryBytes: 275012592,
    manifestUrl:
      "https://downloads.claude.ai/claude-code-releases/2.1.220/manifest.json",
  },
  fixedDigestImageRequired: true,
  fixedImageDigest:
    "sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a",
  managedSettingsSha256:
    "736c1447df695f074743f52564eefd4f9f8d8850737657d54a1f3d6052151ee8",
  taskSettingsSha256:
    "1924f4754c93793668056446ee68e3cd1b0f45dd38db6b137c5aa43441599ca1",
  fixedImageBytes: 129732853,
  autoUpdateAllowed: false,
  runtimePullAllowed: false,
} as const);
Object.freeze(CODEX.identity);
Object.freeze(CODEX.adviceIdentity);
Object.freeze(CLAUDE.identity);

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
export function describeDockerProviderAssets<P extends "codex" | "claude">(
  provider: P,
): P extends "codex" ? typeof CODEX : typeof CLAUDE {
  if (provider !== "codex" && provider !== "claude")
    throw new Error("docker_provider_assets_invalid");
  return (provider === "codex" ? CODEX : CLAUDE) as P extends "codex"
    ? typeof CODEX
    : typeof CLAUDE;
}
/**
 * CLI引数生成へ渡す実行位置だけを返す。
 * @responsibility 実行Path・Schema・Home・設定の配置を一箇所から結合する。
 * @trace ARCH-000008
 * @input providerと用途。
 * @returns Image・Mountを含まない実行位置データ。
 * @precondition 検証済みの固定Imageを使う信頼した構成側だけ。
 * @postcondition 引数の文字列置換・Image取得・CLI実行を行わない。
 * @effect N/A: 固定値の投影だけ。
 * @failure 不明Provider・用途は固定例外。
 * @invariant このデータを外部要求やCatalogから上書きさせない。
 * @boundary Docker配置OwnerからCLI引数生成への値境界。
 * @security Host秘密・実Root・Authorityを含まない。
 * @concurrency N/A: 同期不変値。
 */
export function describeDockerProviderExecutionLocations(
  provider: "codex" | "claude",
  purpose: "task" | "probe" | "advice",
) {
  if (
    (provider !== "codex" && provider !== "claude") ||
    !["task", "probe", "advice"].includes(purpose)
  )
    throw new Error("docker_provider_locations_invalid");
  return Object.freeze({
    commandPath:
      provider === "codex"
        ? purpose === "advice"
          ? CODEX.adviceIdentity.executablePath
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

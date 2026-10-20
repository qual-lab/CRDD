/**
 * Docker内に配置するProvider実行物・Image・設定の現在の同一性を定義する。
 * @packageDocumentation
 * @responsibility 配置と固定資産を所有し、ProviderのCLI解釈や認証・実行許可を生成しない。
 * @trace ARCH-000008
 */
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
    executablePath: "/opt/crdd/providers/codex/0.149.1/codex",
    exactVersion: "0.149.1",
    executorSeccompProfileSha256:
      "01e577dd6fc81e04987af29b05389e9432dc0623a66aa435fd2f31f2b1070b95",
    executorSeccompProfileBytes: 16703,
  },
  adviceIdentity: {
    exactVersion: "0.159.2",
    executablePath: "/opt/crdd/providers/codex/0.159.2/codex",
    fixedImageDigest:
      "sha256:4f35a6542ee0b412714d558bc38e578bcea00490ec2a1f02f02b88c1226f924e",
  },
  fixedDigestImageRequired: true,
  fixedImageDigest:
    "sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c",
  autoUpdateAllowed: false,
  runtimePullAllowed: false,
} as const);
const CLAUDE = Object.freeze({
  proxy: PROXY,
  identity: {
    executablePath: "/opt/crdd/providers/claude/2.1.220/claude",
    exactVersion: "2.1.220",
  },
  fixedDigestImageRequired: true,
  fixedImageDigest:
    "sha256:ddd766072db6e69f55efb11fc3e82b401542cb5583c179f56aac4004f4ea317a",
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

/**
 * Workbench助言に使う未改造の公式Codexの固定配布Identityを所有する。
 *
 * @packageDocumentation
 * @responsibility 通常Taskを変更せず助言向け公式CLIとHostの配置Identityを固定する。
 * @trace ARCH-000010
 * @boundary 助言Command、配布検証とRecoveryが参照する固定配布境界。
 * @effect N/A: 固定値だけを公開し、配布物の取得や実行を行わない。
 * @security Identity一致だけを認証、資源回収またはE2E成立の証明にしない。
 */

const CODEX_ADVICE_DISTRIBUTION_IDENTITY = Object.freeze({
  exactVersion: "0.159.2",
  sourceCommit: "ff6aec96948b70d94983af2641a6b67c94faeff5",
  sourceArchiveSha256:
    "b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a",
  officialCliUnmodified: true,
  executablePath: "/opt/crdd/providers/codex/0.159.2/codex",
  binarySha256:
    "1748767b230ebfc3d4ab7e4e254920d0c0ad9691fd8c11f190e7d44511a4a92e",
  hostExecutablePath: "/opt/crdd/providers/codex/0.159.2/codex-code-mode-host",
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
});

/**
 * 助言専用の固定配布Identityを返す。
 *
 * @responsibility 同じ公式CLI、Host、既存bwrapとImageを全利用側へ渡す。
 * @trace ARCH-000010
 * @input N/A: 呼出し側が配布Identityを上書きする入力を受け取らない。
 * @returns 凍結済みの専用配布Identity。
 * @precondition N/A: 実行時入力を持たない。
 * @postcondition 通常Executor／Reviewerの配布Identityを変更しない。
 * @effect N/A: 固定Objectを返すだけである。
 * @failure N/A: 外部観測や可変入力を持たない。
 * @invariant 公式CLIにCRDDの起動Patchを適用しない。
 * @boundary 助言専用配布の所有者と利用側の間。
 * @security 値の取得を実配布物の検証や実行許可と同一視しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function describeCodexAdviceDistributionIdentity() {
  return CODEX_ADVICE_DISTRIBUTION_IDENTITY;
}

export const DISTRIBUTION_IDENTITY = Object.freeze({
  targetPlatform: "linux-x64-musl",
  executablePath: "/opt/crdd/providers/codex/0.149.1/codex",
  exactVersion: "0.149.1",
  releaseTag: "rust-v0.149.1",
  releaseCommit: "ff29a44391deccde0aba0f8390337d7f3c319ea4",
  archiveSha256:
    "e24fb784c7d71140d67afb620f56e9137496cf7f6c9e19217fa3666dcf306278",
  archiveBytes: 99_479_490,
  binarySha256:
    "73dc5888888f411c1f0fa7b81d866e721dcc86b527ce8e3b2cf4708661e823ba",
  binaryBytes: 258_227_840,
  sigstoreBundleSha256:
    "1976d459060cac4638f481b72142271d8bbd821abebd72555145b83b2bf3e85e",
  sigstoreIdentity:
    "https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.149.1",
  sigstoreIssuer: "https://token.actions.githubusercontent.com",
  bwrapArchiveSha256:
    "7b0604dc48a487e25dae35a1f200aaf125666c5c8ef73bc913e915cebc86ce7b",
  bwrapArchiveBytes: 261_611,
  bwrapBinaryPath: "/opt/crdd/providers/codex/0.149.1/codex-resources/bwrap",
  bwrapBinarySha256:
    "01fb705f067bd5365b63d8ad2323a61c8d007733ca5e649437e086f3fb9935d8",
  bwrapBinaryBytes: 529_776,
  bwrapSigstoreBundleSha256:
    "2c8b6f67a874ecb25e231366302386450775266220c08d98625408171c0d0238",
  bwrapSigstoreIdentity:
    "https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.149.1",
  bwrapSigstoreIssuer: "https://token.actions.githubusercontent.com",
  executorSeccompProfilePath:
    "40_Develop/docker-isolation/runtime/codex-executor-seccomp.json",
  executorSeccompProfileSha256:
    "01e577dd6fc81e04987af29b05389e9432dc0623a66aa435fd2f31f2b1070b95",
  executorSeccompProfileBytes: 16_703,
  executorSeccompBaselineCommit: "c3065211177705ada59a9ccf8b5c182f286f8c97",
  executorSeccompBaselineSha256:
    "536529b665dd0972c37bfb569f5d4ac8a53592e7b00752bc39ff063ca9864c74",
  fixedImageDigest:
    "sha256:e7fefafffd4b96614811b2d51b9704d3280e4995c358ed5e25ec795215dbd45c",
  fixedImageBytes: 145_299_281,
  executorSchemaSha256:
    "daf04adf5282157984b43559298a82f1ab16de837cfb5f6cc929805390f776ce",
  reviewerSchemaSha256:
    "09e8592838b1642f738eee07fb2c1b366dc25d6a3e842dbb0649930c94a25df8",
  imageBuildDefinition:
    "40_Develop/docker-isolation/runtime/codex-provider.Dockerfile",
  releaseUrl: "https://github.com/openai/codex/releases/tag/rust-v0.149.1",
});
export const distributionBinding = Object.freeze({
  identity: DISTRIBUTION_IDENTITY,
  fixedDigestImageRequired: true,
  fixedImageDigest: DISTRIBUTION_IDENTITY.fixedImageDigest,
  fixedImageBytes: DISTRIBUTION_IDENTITY.fixedImageBytes,
  autoUpdateAllowed: false,
  runtimePullAllowed: false,
});
export const DISTRIBUTION_VERIFICATION = Object.freeze({
  githubReleaseArchiveDigestMatched: true,
  extractedBinaryDigestMatchedRekorBody: true,
  sigstoreBlobSignatureVerified: true,
  sigstoreCertificateIdentityMatched: true,
  bundledBwrapDigestMatchedRekorBody: true,
  bundledBwrapSigstoreBlobSignatureVerified: true,
  bundledBwrapCertificateIdentityMatched: true,
  fixedImageBuiltFromExactBinary: true,
  fixedImageBuiltFromExactBundledBwrap: true,
  fixedImageBundledBwrapProbePassed: true,
  fixedImageBundledBwrapSelectedUnderNoNetworkProbe: true,
  executorSeccompProfileDigestMatched: true,
  executorSeccompProfileAllowsOnlyRequiredSandboxSyscalls: true,
  fixedImageNoNetworkVersionProbePassed: true,
  fixedImageNonRootSchemaReadPassed: true,
  subscriptionBooleanRequestPassed: true,
  subscriptionBooleanRequestExitCode: 0,
  subscriptionBooleanRequestResult: Object.freeze({ status: true }),
  subscriptionBooleanRequestModel: "gpt-5.6-sol",
  subscriptionBooleanRequestEffort: "low",
  subscriptionBooleanRequestSandbox: "read-only",
  subscriptionBooleanRequestContainerResidue: 0,
  subscriptionBooleanRequestNetworkResidue: 0,
  isolatedTaskCompatibilityModel: "gpt-5.5",
  isolatedTaskCodeModeHostDisabled: true,
  isolatedTaskShellVerificationPassed: true,
  isolatedTaskExactCandidateContentPassed: true,
  isolatedTaskContainerResidue: 0,
  isolatedTaskNetworkResidue: 0,
  isolatedTaskVerifiedAt: "2026-08-30",
  verifiedAt: "2026-08-25",
});

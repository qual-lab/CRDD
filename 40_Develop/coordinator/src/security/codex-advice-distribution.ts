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
    "40_Develop/coordinator/runtime/codex-advice-provider.Dockerfile",
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
 * @precondition N/A: 固定値の読取りに外部条件はない。
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

/**
 * 公式助言Imageと未解決の旧助言Imageにinitを要求する。
 *
 * @responsibility 起動計画、Effect直前検査と耐久Recoveryで同じinit適用条件を使う。
 * @trace ARCH-000010
 * @input operationMode: 実行方式、imageDigest: 固定Image Identity。
 * @returns 助言方式と現行または回復対象の旧Imageが一致する場合だけtrue。
 * @precondition 呼出し側がcreate_provider以外へ適用しない。
 * @postcondition 通常TaskとClaude助言へ波及させず、旧exact Recoveryの構成を保持する。
 * @effect N/A: 固定Identityを比較するだけである。
 * @failure N/A: 不一致はfalseとして返す。
 * @invariant 専用Imageであることを名前やtagから推測しない。
 * @boundary Provider作成とexactな終了後検査・Recoveryの共通境界。
 * @security 戻り値は削除Authorityではなく構成上の必要条件だけを示す。
 * @concurrency N/A: 同期の純粋比較である。
 */
export function codexAdviceProviderInitRequired(
  operationMode: string,
  imageDigest: string | null,
) {
  return (
    operationMode === "workbench_advice" &&
    (imageDigest === CODEX_ADVICE_DISTRIBUTION_IDENTITY.fixedImageDigest ||
      imageDigest ===
        "sha256:843db607376a454cb7c901e76d4da1d168d6e384912366448df3363b42624d36")
  );
}

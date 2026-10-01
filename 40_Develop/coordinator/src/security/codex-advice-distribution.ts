/**
 * Workbench読取り助言専用Codexの固定配布Identityを所有する。
 *
 * @packageDocumentation
 * @responsibility 通常Taskの公式CLIから、最小起動Patch付き助言CLIと公式Hostを分離する。
 * @trace ARCH-000010
 * @boundary 助言Command、配布検証とRecoveryが参照する固定配布境界。
 * @effect N/A: 固定値だけを公開し、配布物の取得や実行を行わない。
 * @security Identity一致だけを認証、資源回収またはE2E成立の証明にしない。
 */

const identity = Object.freeze({
  exactVersion: "0.159.2",
  sourceCommit: "ff6aec96948b70d94983af2641a6b67c94faeff5",
  sourceArchiveSha256:
    "b749fadee5cc236dff4cd0fc076cc4e08840937529ea71bca2928e233755712a",
  startupPatchSha256:
    "1fbd4d98e20e2a4a7c106f7f417129e061297fba65b7ef521969e40ef847faeb",
  resolvedLockSha256:
    "e85460a5c2a1f92d73ca0a40219c846f6a10d729f3186667485372c3aa82cfbf",
  executablePath: "/opt/crdd/providers/codex-advice/0.159.2/codex-advice",
  binarySha256:
    "366286511b5d8d4d804ca9a7539eb7be7f6ea38f083bf5629e7b12ca828ba1b3",
  hostExecutablePath:
    "/opt/crdd/providers/codex-advice/0.159.2/codex-code-mode-host",
  hostBinarySha256:
    "5b2c075ac2380fa04d76d7313fbc044d29c8d0a0d0b9138415acd4610211ca03",
  bwrapBinaryPath:
    "/opt/crdd/providers/codex-advice/0.159.2/codex-resources/bwrap",
  bwrapBinarySha256:
    "07bc720e15a730d717e81b42acb3b95049803360738115c6f6c59830accef7c2",
  fixedImageDigest:
    "sha256:843db607376a454cb7c901e76d4da1d168d6e384912366448df3363b42624d36",
  imageBuildDefinition:
    "40_Develop/coordinator/runtime/codex-advice-provider.Dockerfile",
  imageBuildDefinitionSha256:
    "3438a2779bbf858f810d17d44f53425e70e3421babda9209af65480e9da351f6",
});

/**
 * 助言専用の固定配布Identityを返す。
 *
 * @responsibility 同じ専用CLI、Host、bwrap、SourceとImageを全利用側へ渡す。
 * @trace ARCH-000010
 * @input N/A: 呼出し側が配布Identityを上書きする入力を受け取らない。
 * @returns 凍結済みの専用配布Identity。
 * @precondition N/A: 固定値の読取りに外部条件はない。
 * @postcondition 通常Executor／Reviewerの配布Identityを変更しない。
 * @effect N/A: 固定Objectを返すだけである。
 * @failure N/A: 外部観測や可変入力を持たない。
 * @invariant 専用実行物を公式未変更CLIと表示しない。
 * @boundary 助言専用配布の所有者と利用側の間。
 * @security 値の取得を実配布物の検証や実行許可と同一視しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function describeCodexAdviceDistributionIdentity() {
  return identity;
}

/**
 * 助言専用ImageのProviderコンテナだけにinitを要求する。
 *
 * @responsibility 起動計画、Effect直前検査と耐久Recoveryで同じinit適用条件を使う。
 * @trace ARCH-000010
 * @input operationMode: 実行方式、imageDigest: 固定Image Identity。
 * @returns 助言方式と専用Imageが両方一致する場合だけtrue。
 * @precondition 呼出し側がcreate_provider以外へ適用しない。
 * @postcondition 通常Task、Claude助言と旧Imageへinit要求を波及させない。
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
    imageDigest === identity.fixedImageDigest
  );
}

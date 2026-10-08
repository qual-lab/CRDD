/**
 * Docker準備候補の資源名と秘密乱数の値生成を所有する。
 *
 * @responsibility 両Providerの同じ乱数検査とContainer・Networkの命名条件を保持する。
 * @trace ARCH-000015
 */
import type {
  ProviderDockerRandomSource,
  ProviderDockerResourceNames,
} from "./types.ts";

/**
 * 所定byte数のBufferから内部計画用のhex値を生成する。
 *
 * @responsibility 乱数取得結果の型と長さを確認する。
 * @trace ARCH-000015
 * @input state: 呼出し側の乱数Owner。bytes: 固定取得長。
 * @returns hex値、または型・長さ不一致に対するnull。
 * @precondition bytesは準備Ownerが8または32へ固定する。
 * @postcondition 取得結果を一回だけ検査し、受理時だけhexへ変換する。
 * @effect 呼出し側が所有する乱数生成を一回呼ぶ。Docker・Filesystem要求は発行しない。
 * @failure Buffer以外またはbyte長不一致をnullで拒否する。取得例外は呼出し側へ伝播する。
 * @invariant 不正な取得値を切詰め・補完しない。
 * @boundary 乱数OwnerとDocker準備値の間。
 * @security Proxy Tokenへ利用する値を公開結果やログへ渡さない。
 * @concurrency N/A: 同期取得だけでStoreを所有しない。
 */
export function createProviderDockerRandomHex(
  state: ProviderDockerRandomSource,
  bytes: number,
): string | null {
  const value = state.randomBytes(bytes);
  return Buffer.isBuffer(value) && value.byteLength === bytes
    ? value.toString("hex")
    : null;
}

/**
 * 照合済みProvider HomeからDocker資源名を生成する。
 *
 * @responsibility Homeの64桁hex検査、既存prefixと63文字上限を所有する。
 * @trace ARCH-000015
 * @input provider: 固定Provider。providerHomeIdentityHash: Home Identity。suffix: 取得済み8byteのhex。
 * @returns 五資源名と所有label、または不正Home・過大名に対するnull。
 * @precondition suffixは同じ準備Ownerの乱数検査に成功している。
 * @postcondition Provider名はHome Hash先頭16桁へ、他の資源とlabelはsuffixへ結合する。
 * @effect N/A: 局所文字列の生成だけを行う。
 * @failure Home形式不正または63文字を超える資源名をnullで拒否する。
 * @invariant 名前やlabelを実資源所有の証明として扱わない。
 * @boundary 準備IdentityとDocker資源名の間。
 * @security HashとsuffixからAuthorityを生成せず、削除許可にも利用しない。
 * @concurrency N/A: 同期計算であり資源の取得・排他を行わない。
 */
export function createProviderDockerResourceNames(
  provider: "codex" | "claude",
  providerHomeIdentityHash: string,
  suffix: string,
): ProviderDockerResourceNames | null {
  const internalNetworkName = `crdd-internal-${suffix}`;
  const egressNetworkName = `crdd-egress-${suffix}`;
  const proxyContainerName = `crdd-proxy-${suffix}`;
  const authContainerName = `crdd-auth-${suffix}`;
  if (!/^[a-f0-9]{64}$/u.test(providerHomeIdentityHash)) return null;
  const providerContainerName = `crdd-${provider}-${providerHomeIdentityHash.slice(0, 16)}`;
  if (
    [
      internalNetworkName,
      egressNetworkName,
      proxyContainerName,
      authContainerName,
      providerContainerName,
    ].some((value) => value.length > 63)
  )
    return null;
  return {
    internalNetworkName,
    egressNetworkName,
    proxyContainerName,
    authContainerName,
    providerContainerName,
    ownershipLabel: `crdd.coordinator.runtime=${suffix}`,
  };
}

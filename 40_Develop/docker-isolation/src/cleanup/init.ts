/**
 * Docker inspectのInit指定を固定構成と照合する。
 *
 * @responsibility Init必須と明示指定なしのwire表現を通常清掃と回復で同じ意味に解釈する。
 * @trace ARCH-000008
 */

/**
 * Init指定の観測値が対象資源の構成条件を満たすか判定する。
 *
 * @responsibility Dockerの省略可能なInit fieldを、不正構造やInit必須の欠測と区別する。
 * @trace ARCH-000008
 * @input hostConfig: JSONから読んだHostConfig、isInitRequired: 固定起動計画がInitを要求するか。
 * @returns 有効なHostConfig上でInit指定条件が一致する場合だけtrue。
 * @precondition 呼出し側が同じ資源のIdentityと他の隔離条件を別途照合する。
 * @postcondition 必須対象はown propertyのtrueのみ、対象外は未記載・null・falseのみ受理する。
 * @effect N/A: 渡された値を読み取るだけで外部操作を発行しない。
 * @failure 不正構造、継承field、accessorまたは不正値はfalseで拒否する。
 * @invariant 未記載とnullは明示指定なしを表し、実効的な非init稼働の証明にしない。
 * @boundary Docker inspectのJSON表現と清掃・回復の構成検査の境界。
 * @security 戻り値だけから削除Authorityや資源回収完了を発行しない。
 * @concurrency N/A: 局所値の同期判定で共有状態を持たない。
 */
export function dockerContainerInitObservationMatches(
  hostConfig: unknown,
  isInitRequired: boolean,
) {
  if (
    hostConfig === null ||
    typeof hostConfig !== "object" ||
    Array.isArray(hostConfig) ||
    (Object.getPrototypeOf(hostConfig) !== Object.prototype &&
      Object.getPrototypeOf(hostConfig) !== null)
  )
    return false;
  const descriptor = Object.getOwnPropertyDescriptor(hostConfig, "Init");
  if (!descriptor) return !isInitRequired && !("Init" in hostConfig);
  if (!("value" in descriptor)) return false;
  return isInitRequired
    ? descriptor.value === true
    : descriptor.value === null || descriptor.value === false;
}

/**
 * 契約移行で観測するConsumerを定義する。
 *
 * @responsibility Consumer Identity、役割、使用契約および固定Snapshotを同じ観測へ結合する。
 * @trace ARCH-000002
 * @shape MigrationConsumerObservationが持つ閉包判定Propertyを定義する。
 * @invariant 一つの観測は一つのSnapshotとContractだけを表す。
 * @boundary Producer／Consumer／公開／署名／Release／Recoveryと移行完成Gateの境界。
 * @security Pathや秘密値を持たず安定Identityだけを扱う。
 * @compatibility role語彙を追加する場合はClosure必須集合も同時改訂する。
 */
export type MigrationConsumerObservation = Readonly<{
  consumerId: string;
  role: "producer" | "consumer" | "public" | "signed" | "release" | "recovery";
  contractId: string;
  snapshotId: string;
}>;

/**
 * 固定Snapshot上のSystem移行Closureを検査する。
 *
 * @responsibility 宣言済みConsumer、公開・署名・Release・Recovery経路、契約およびSnapshotの完全一致を判定する。
 * @trace ARCH-000002
 * @input snapshotId: 固定Snapshot、contractId: 新契約、declaredConsumerIds: 宣言集合、observations: 実観測集合。
 * @returns completeまたは不足分類を持つblocked結果を返す。
 * @precondition Identity入力は固定候補から取得する。
 * @postcondition completeは未処置Consumer、旧契約利用、別Snapshot混入がすべて0の場合だけ返す。
 * @effect N/A: 観測集合を比較するだけで公開、署名、ReleaseまたはRecovery Effectを発行しない。
 * @failure 不正入力、集合差、旧契約または混在Snapshotを構造化blockedへ変換する。
 * @invariant 宣言だけのConsumerを実観測済みにしない。
 * @boundary 変更元→全Consumer→公開・署名・Release・Recovery→System Closure Gate。
 * @security Consumerの安定Identity以外を結果へ含めない。
 * @concurrency 同じ固定Snapshotから得た宣言と観測だけを一回の判定へ渡す。
 */
export function inspectMigrationSystemClosure(
  snapshotId: string,
  contractId: string,
  declaredConsumerIds: readonly string[],
  observations: readonly MigrationConsumerObservation[],
): Readonly<{
  status: "complete" | "blocked";
  reason: string;
  missingConsumerIds: readonly string[];
  undeclaredConsumerIds: readonly string[];
  oldContractConsumerIds: readonly string[];
  mixedSnapshotConsumerIds: readonly string[];
}> {
  const declaredConsumers = [...new Set(declaredConsumerIds)].sort();
  const observedConsumers = [
    ...new Set(observations.map((entry) => entry.consumerId)),
  ].sort();
  const base = {
    missingConsumerIds: Object.freeze(
      declaredConsumers.filter((id) => !observedConsumers.includes(id)),
    ),
    undeclaredConsumerIds: Object.freeze(
      observedConsumers.filter((id) => !declaredConsumers.includes(id)),
    ),
    oldContractConsumerIds: Object.freeze(
      observations
        .filter((entry) => entry.contractId !== contractId)
        .map((entry) => entry.consumerId)
        .sort(),
    ),
    mixedSnapshotConsumerIds: Object.freeze(
      observations
        .filter((entry) => entry.snapshotId !== snapshotId)
        .map((entry) => entry.consumerId)
        .sort(),
    ),
  };
  const requiredRoles = ["public", "signed", "release", "recovery"] as const;
  const rolesComplete = requiredRoles.every((role) =>
    observations.some((entry) => entry.role === role),
  );
  const isComplete =
    Boolean(snapshotId) &&
    Boolean(contractId) &&
    declaredConsumers.length > 0 &&
    base.missingConsumerIds.length === 0 &&
    base.undeclaredConsumerIds.length === 0 &&
    base.oldContractConsumerIds.length === 0 &&
    base.mixedSnapshotConsumerIds.length === 0 &&
    rolesComplete;
  return Object.freeze({
    status: isComplete ? "complete" : "blocked",
    reason: isComplete
      ? "migration_system_closure_complete"
      : "migration_system_closure_incomplete",
    ...base,
  });
}

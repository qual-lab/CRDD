/**
 * 固定Snapshot上の契約移行System Closureを検証する。
 *
 * @packageDocumentation
 * @responsibility 全Consumer、公開、署名、Release、Recovery経路の同一契約・同一Snapshot成立を検証する。
 * @trace RCM-ST-012
 * @level ST
 * @scope version-control、migration、consumer-closure、release、recovery
 * @boundary RCM-ST-012=System/E2E: 変更元→全Consumer→公開・署名・Release・Recovery。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectMigrationSystemClosure,
  type MigrationConsumerObservation,
} from "../../src/index.ts";

const SNAPSHOT_ID = "snapshot-1";
const CONTRACT_ID = "contract-v2";
const OBSERVATIONS: readonly MigrationConsumerObservation[] = Object.freeze([
  {
    consumerId: "producer",
    role: "producer",
    contractId: CONTRACT_ID,
    snapshotId: SNAPSHOT_ID,
  },
  {
    consumerId: "runtime",
    role: "consumer",
    contractId: CONTRACT_ID,
    snapshotId: SNAPSHOT_ID,
  },
  {
    consumerId: "public-cli",
    role: "public",
    contractId: CONTRACT_ID,
    snapshotId: SNAPSHOT_ID,
  },
  {
    consumerId: "signed-runtime",
    role: "signed",
    contractId: CONTRACT_ID,
    snapshotId: SNAPSHOT_ID,
  },
  {
    consumerId: "release",
    role: "release",
    contractId: CONTRACT_ID,
    snapshotId: SNAPSHOT_ID,
  },
  {
    consumerId: "recovery",
    role: "recovery",
    contractId: CONTRACT_ID,
    snapshotId: SNAPSHOT_ID,
  },
]);
const declaredConsumerIds = OBSERVATIONS.map((entry) => entry.consumerId);

/**
 * 同じ固定Snapshotで全宣言Consumerが新契約へ閉じることを検証する。
 * @responsibility 正常Closureと旧契約、別Snapshot、未処置Consumerの反例を一つの完成Gateで判定する。
 * @trace RCM-ST-012
 * @precondition Producer、全Consumer、公開、署名、Release、Recoveryを宣言する。
 * @stimulus 正常集合と旧契約、別Snapshot、観測欠落をClosure Gateへ渡す。
 * @observation Consumer集合、契約、Snapshot、未処置および混入件数を観測する。
 * @oracle 正常集合だけcompleteとなり、各反例は旧利用・混在・不足を特定してblockedとなる。
 * @cleanup 読取り専用判定のため移行Effectと残存資源は0である。
 * @boundary RCM-ST-012=System/E2E: 変更元→全Consumer→公開・署名・Release・Recovery。
 */
test("全Consumerを同じ固定Snapshotと新契約でSystem Closureする", () => {
  const complete = inspectMigrationSystemClosure(
    SNAPSHOT_ID,
    CONTRACT_ID,
    declaredConsumerIds,
    OBSERVATIONS,
  );
  const oldContract = inspectMigrationSystemClosure(
    SNAPSHOT_ID,
    CONTRACT_ID,
    declaredConsumerIds,
    OBSERVATIONS.map((entry) =>
      entry.consumerId === "recovery"
        ? { ...entry, contractId: "contract-v1" }
        : entry,
    ),
  );
  const mixedSnapshot = inspectMigrationSystemClosure(
    SNAPSHOT_ID,
    CONTRACT_ID,
    declaredConsumerIds,
    OBSERVATIONS.map((entry) =>
      entry.consumerId === "signed-runtime"
        ? { ...entry, snapshotId: "snapshot-2" }
        : entry,
    ),
  );
  const missing = inspectMigrationSystemClosure(
    SNAPSHOT_ID,
    CONTRACT_ID,
    declaredConsumerIds,
    OBSERVATIONS.filter((entry) => entry.consumerId !== "public-cli"),
  );
  assert.equal(complete.status, "complete");
  assert.deepEqual(complete.missingConsumerIds, []);
  assert.deepEqual(oldContract.oldContractConsumerIds, ["recovery"]);
  assert.deepEqual(mixedSnapshot.mixedSnapshotConsumerIds, ["signed-runtime"]);
  assert.deepEqual(missing.missingConsumerIds, ["public-cli"]);
  assert.deepEqual(
    [oldContract, mixedSnapshot, missing].map((entry) => entry.status),
    ["blocked", "blocked", "blocked"],
  );
});

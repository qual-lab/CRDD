/**
 * 実境界試験が保存済みDI Snapshotを参照する。
 * @responsibility 製品の回収Ownerではなく試験の構成Oracleだけを所有する。
 * @trace ERB-IT-014
 * @boundary 試験専用。Docker処置・保存・Authorityを発行しない。
 */

import type { CoordinatorStateTaskOperation } from "../../../execution-model/src/index.ts";

export function readRecoveryResourceSnapshots(
  operation: CoordinatorStateTaskOperation,
) {
  if (!operation.resources) throw Error("resource_snapshot_missing");
  return operation.resources.snapshot.resources;
}

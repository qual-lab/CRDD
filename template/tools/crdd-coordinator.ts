#!/usr/bin/env node

/**
 * 配布RepositoryからCoordinatorを起動する。
 *
 * @responsibility 配布入口を同じCRDD改訂版のCoordinator起動境界へ接続する。
 * @trace ARCH-000004
 */

// CRDDをcloneまたはsubmoduleで導入した利用者向けの安定したCoordinator入口。
// 実行契約と署名対象の本体は、同じCRDD改訂版に含まれる共通起動入口が所有する。
import "../../40_Develop/coordinator/bin/launch.ts";

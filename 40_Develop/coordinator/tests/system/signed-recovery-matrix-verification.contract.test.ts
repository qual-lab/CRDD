/**
 * coordinator:system:signed-recovery-matrix-verificationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:signed-recovery-matrix-verificationが所有する検証責務を実行する。
 * @trace PRL-ST-004
 * @level ST
 * @scope signed、recovery、matrix、verification
 * @boundary PRL-ST-004=System/E2E: 公開入口→Runtime→耐久Store→回復再入場
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  describeSignedRecoveryMatrixContract,
  SIGNED_RECOVERY_MATRIX_CONTRACT,
  SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
} from "../../scripts/verify-signed-recovery-matrix.ts";

/**
 * 署名Recovery Matrixは通常Task入力へFault注入面を追加しないを検証する。
 *
 * @responsibility 署名Recovery Matrixは通常Task入力へFault注入面を追加しないの合否判定を所有する。
 * @trace PRL-ST-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名Recovery Matrixは通常Task入力へFault注入面を追加しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-004=System/E2E: 公開入口→Runtime→耐久Store→回復再入場
 */
test("署名Recovery Matrixは通常Task入力へFault注入面を追加しない", () => {
  const contract = describeSignedRecoveryMatrixContract();
  assert.equal(contract.contract, SIGNED_RECOVERY_MATRIX_CONTRACT);
  assert.equal(
    contract.contractRevision,
    SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
  );
  assert.equal(contract.normalTaskSchemaChanged, false);
  assert.equal(contract.publicScenarioArgumentsAllowed, false);
  assert.equal(
    contract.parentLoss,
    "real_child_process_termination_then_fresh_recovery",
  );
  assert.deepEqual(contract.fixedScenarios, [
    "nonzero_exit",
    "timeout",
    "output_limit",
    "invalid_output",
    "cancel",
    "parent_process_loss_then_fresh_recovery",
    "cleanup_observation_unknown_then_recover",
  ]);
  assert.equal(contract.providerCredentialAllowed, false);
  assert.equal(contract.providerNetworkAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.paidApiFallbackAllowed, false);
});

/**
 * 公開CLIは引数なし以外を固定JSONでEffect前に拒否するを検証する。
 *
 * @responsibility 公開CLIは引数なし以外を固定JSONでEffect前に拒否するの合否判定を所有する。
 * @trace PRL-ST-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開CLIは引数なし以外を固定JSONでEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-004=System/E2E: 公開入口→Runtime→耐久Store→回復再入場
 */
test("公開CLIは引数なし以外を固定JSONでEffect前に拒否する", () => {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve("scripts/verify-signed-recovery-matrix.ts"),
      "--scenario",
      "timeout",
    ],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 2);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "blocked");
  assert.equal(output.reason, "signed_recovery_matrix_arguments_invalid");
  assert.equal(output.cleanupConfirmed, false);
  assert.equal(output.manualRecoveryRequired, false);
  assert.equal(output.rawProviderOutputReported, false);
  assert.equal(output.hostPathReported, false);
  assert.equal(output.credentialReported, false);
});

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  describeSignedRecoveryMatrixContract,
  SIGNED_RECOVERY_MATRIX_CONTRACT,
  SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
} from "../../scripts/verify-signed-recovery-matrix.ts";

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

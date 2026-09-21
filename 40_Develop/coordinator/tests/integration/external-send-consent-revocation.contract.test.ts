/**
 * coordinator:integration:external-send-consent-revocationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:external-send-consent-revocationが所有する検証責務を実行する。
 * @trace EST-IT-004
 * @level IT
 * @scope external、send、consent、revocation
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT,
  runExternalSendConsentRevocation,
} from "../../scripts/revoke-external-send-consent.ts";

/**
 * 明示取消は完了と手動回復をPath・Credentialなしで分離するを検証する。
 *
 * @responsibility 明示取消は完了と手動回復をPath・Credentialなしで分離するの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示取消は完了と手動回復をPath・Credentialなしで分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("明示取消は完了と手動回復をPath・Credentialなしで分離する", () => {
  assert.deepEqual(
    runExternalSendConsentRevocation(() =>
      Object.freeze({ status: "revoked" as const }),
    ),
    {
      contract: EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT,
      contractRevision: 1,
      status: "completed",
      reason: "external_send_consent_revoked",
      manualRecoveryRequired: false,
      rawPathReported: false,
      credentialReported: false,
    },
  );
  assert.equal(
    runExternalSendConsentRevocation(() =>
      Object.freeze({ status: "recovery_required" as const }),
    ).manualRecoveryRequired,
    true,
  );
});

/**
 * 取消CLIは任意引数をEffect前に拒否するを検証する。
 *
 * @responsibility 取消CLIは任意引数をEffect前に拒否するの合否判定を所有する。
 * @trace EST-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 取消CLIは任意引数をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: Application要求→Policy→Provider Adapter
 */
test("取消CLIは任意引数をEffect前に拒否する", () => {
  const result = spawnSync(
    process.execPath,
    [path.resolve("scripts/revoke-external-send-consent.ts"), "unexpected"],
    { cwd: path.resolve("."), encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 64);
  assert.equal(
    JSON.parse(result.stdout).reason,
    "external_send_consent_revocation_arguments_invalid",
  );
});

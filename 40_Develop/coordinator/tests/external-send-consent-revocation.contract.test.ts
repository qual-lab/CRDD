import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";

import {
  EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT,
  runExternalSendConsentRevocation,
} from "../scripts/revoke-external-send-consent.ts";

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

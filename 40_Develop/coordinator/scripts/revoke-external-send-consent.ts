import path from "node:path";
import { fileURLToPath } from "node:url";

import { revokeRuntimeOwnedExternalSendConsent } from "../src/security/external-send-consent-runtime.ts";

export const EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT =
  "crdd-coordinator/external-send-consent-revocation";
export const EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT_REVISION = 1;

export function runExternalSendConsentRevocation(
  revoke: typeof revokeRuntimeOwnedExternalSendConsent = revokeRuntimeOwnedExternalSendConsent,
) {
  const result = revoke();
  return result.status === "revoked"
    ? Object.freeze({
        contract: EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT,
        contractRevision: EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT_REVISION,
        status: "completed" as const,
        reason: "external_send_consent_revoked",
        manualRecoveryRequired: false,
        rawPathReported: false,
        credentialReported: false,
      })
    : Object.freeze({
        contract: EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT,
        contractRevision: EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT_REVISION,
        status: "blocked" as const,
        reason: "external_send_consent_manual_recovery_required",
        manualRecoveryRequired: true,
        rawPathReported: false,
        credentialReported: false,
      });
}

async function main() {
  if (process.argv.length !== 2)
    throw new Error("external_send_consent_revocation_arguments_invalid");
  const result = runExternalSendConsentRevocation();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.status === "completed" ? 0 : 2;
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stdout.write(
      `${JSON.stringify(
        {
          contract: EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT,
          contractRevision: EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT_REVISION,
          status: "blocked",
          reason:
            error instanceof Error &&
            error.message ===
              "external_send_consent_revocation_arguments_invalid"
              ? error.message
              : "external_send_consent_revocation_failed_closed",
          manualRecoveryRequired: false,
          rawPathReported: false,
          credentialReported: false,
        },
        null,
        2,
      )}\n`,
    );
    process.exitCode =
      error instanceof Error &&
      error.message === "external_send_consent_revocation_arguments_invalid"
        ? 64
        : 2;
  });
}

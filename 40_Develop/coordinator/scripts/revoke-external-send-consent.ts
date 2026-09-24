/**
 * revoke-external-send-consentに属する責務をまとめる。
 *
 * @responsibility runExternalSendConsentRevocationを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000015
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { revokeRuntimeOwnedExternalSendConsent } from "../src/security/external-send-consent-runtime.ts";

export const EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT =
  "crdd-coordinator/external-send-consent-revocation";
export const EXTERNAL_SEND_CONSENT_REVOCATION_CONTRACT_REVISION = 1;

/**
 * External Send Consent Revocationを実行する。
 *
 * @responsibility External Send Consent Revocationの実行条件、Effect範囲、終了結果の境界を所有する。
 * @trace ARCH-000015
 * @input revoke: typeof revokeRuntimeOwnedExternalSendConsent
 * @returns runExternalSendConsentRevocationの計算結果を返す。
 * @precondition 「revoke: typeof revokeRuntimeOwnedExternalSendConsent」がrunExternalSendConsentRevocationの入力契約を満たす。
 * @postcondition runExternalSendConsentRevocationの責務を完了した結果だけを返す。
 * @effect N/A: runExternalSendConsentRevocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: runExternalSendConsentRevocationは独自の失敗分岐を所有しない。
 * @invariant runExternalSendConsentRevocationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: runExternalSendConsentRevocationはProcess内の同一Subsystemで完結する。
 * @security N/A: runExternalSendConsentRevocationはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: runExternalSendConsentRevocationは共有非同期状態を持たない同期処理である。
 */
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

/**
 * revoke-external-send-consentのCommand処理を開始する。
 *
 * @responsibility revoke-external-send-consentの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns N/A: mainは戻り値を返さない。
 * @precondition 「N/A: 実行時引数を受け取らない。」がmainの入力契約を満たす。
 * @postcondition mainの責務を完了して呼出し元へ制御を戻す。
 * @effect mainは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure mainは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

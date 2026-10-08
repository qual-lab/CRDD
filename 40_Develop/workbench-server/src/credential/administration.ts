/**
 * WorkbenchのConnection Credential管理Application。
 *
 * @packageDocumentation
 * @responsibility 検証済み管理Access ContextからCredentialの発行・更新・失効・ローテーション操作を提供する。
 * @trace ARCH-000013
 * @boundary Workbench Client ModelとCROS Credential Applicationの境界。
 * @effect 明示操作時だけCredential Registryを一回更新し得る。
 * @security 生Tokenは発行・ローテーション直後の結果にだけ保持し、一覧や永続Recordへ含めない。
 */
import {
  issueConnectionCredential,
  revokeConnectionCredential,
  rotateConnectionCredential,
  type ConnectionCredentialIssueResult,
  type ConnectionCredentialProfile,
  type ConnectionCredentialRegistry,
  type ConnectionCredentialRotationResult,
  type RequestAccessContext,
  updateConnectionCredentialAccess,
} from "../../../cros/src/index.ts";

export type CredentialAdministration = Readonly<{
  registry: ConnectionCredentialRegistry;
  access: RequestAccessContext;
}>;

export type CredentialAdministrationResult = Readonly<{
  status: "completed" | "blocked";
  reason: string;
  token: string | null;
}>;

/**
 * Credential管理Formを一つのCROS Credential操作へ変換する。
 *
 * @responsibility 許可済み操作と固定入力だけをCROS Credential Applicationへ渡す。
 * @trace ARCH-000013
 * @input administrationにRegistryと管理Access Context、formに上限確認済みForm値を受け取る。
 * @returns 操作結果と一度だけ表示可能なTokenを返す。
 * @precondition CSRF相当Tokenは呼出し側で照合済みである。
 * @postcondition completedだけがRegistry Effectを持ち、Tokenは発行・ローテーション成功時だけ存在する。
 * @effect Credential Registryを最大一回更新する。
 * @failure 未知操作、不正Profileまたは不正Workspace入力を例外で拒否する。
 * @invariant Profileを保存済み実効権限の代替として利用しない。
 * @boundary Workbench Browser Form→CROS Credential Application。
 * @security FormからVerifier、salt、任意Registry Pathまたは生Tokenを受け取らない。
 * @concurrency Registry revision競合をCROS結果として返し、自動再試行しない。
 */
export function executeCredentialAdministrationAction(
  administration: CredentialAdministration,
  form: URLSearchParams,
): CredentialAdministrationResult {
  const operation = form.get("operation");
  if (operation === "issue") {
    const profile = requireProfile(form.get("profile"));
    return publicResult(
      issueConnectionCredential(
        administration.registry,
        administration.access,
        { profile },
      ),
    );
  }
  const credentialId = form.get("credentialId") ?? "";
  if (credentialId.length === 0)
    throw new Error("workbench_credential_id_missing");
  if (operation === "revoke")
    return publicResult(
      revokeConnectionCredential(
        administration.registry,
        administration.access,
        credentialId,
      ),
    );
  if (operation === "rotate")
    return publicResult(
      rotateConnectionCredential(
        administration.registry,
        administration.access,
        credentialId,
      ),
    );
  if (operation === "update_access") {
    const workspaceIds = (form.get("workspaceIds") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    return publicResult(
      updateConnectionCredentialAccess(
        administration.registry,
        administration.access,
        credentialId,
        {
          workspaceIds,
          systemAdmin: form.get("systemAdmin") === "true",
        },
      ),
    );
  }
  throw new Error("workbench_credential_operation_invalid");
}

function requireProfile(value: string | null): ConnectionCredentialProfile {
  if (
    value === "administrator" ||
    value === "management" ||
    value === "developer"
  )
    return value;
  throw new Error("workbench_credential_profile_invalid");
}

/**
 * CROS Credential結果をWorkbench一時結果へ縮小する。
 *
 * @responsibility 異なるCredential操作結果から状態、理由および一度表示Tokenだけを取り出す。
 * @trace ARCH-000013
 * @input CROS Credential Applicationの公開結果を受け取る。
 * @returns Workbench表示用の固定結果を返す。
 * @precondition resultは公開契約を満たす。
 * @postcondition Metadata、Verifier、saltおよびRegistry内容を含まない。
 * @effect N/A: 値を投影するだけである。
 * @failure N/A: 公開結果の共通fieldだけを使用する。
 * @invariant Tokenが存在しない結果へTokenを生成しない。
 * @boundary CROS Credential結果とWorkbench一時表示状態の境界。
 * @security 生Tokenは発行・ローテーション結果からだけ受け取る。
 * @concurrency N/A: 共有状態を持たない。
 */
function publicResult(
  result:
    | ConnectionCredentialIssueResult
    | ConnectionCredentialRotationResult
    | Readonly<{ status: "completed" | "blocked"; reason: string }>,
): CredentialAdministrationResult {
  return Object.freeze({
    status: result.status,
    reason: result.reason,
    token: "token" in result ? result.token : null,
  });
}

/**
 * WorkbenchのConnection Credential管理Surface。
 *
 * @packageDocumentation
 * @responsibility 検証済み管理Access ContextからCredentialの一覧・発行・更新・失効・ローテーションを提供する。
 * @trace ARCH-000013
 * @boundary Workbench Browser FormとCROS Credential Applicationの境界。
 * @effect 明示操作時だけCredential Registryを一回更新し得る。
 * @security 生Tokenは発行・ローテーション直後の結果にだけ保持し、一覧や永続Recordへ含めない。
 */
import {
  issueConnectionCredential,
  listConnectionCredentials,
  revokeConnectionCredential,
  rotateConnectionCredential,
  type ConnectionCredentialIssueResult,
  type ConnectionCredentialProfile,
  type ConnectionCredentialRegistry,
  type ConnectionCredentialRotationResult,
  type RequestAccessContext,
  updateConnectionCredentialAccess,
} from "../../cros/src/index.ts";

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

/**
 * Credential管理Panelを安全なHTMLへ投影する。
 *
 * @responsibility 管理可否、Credential Metadata、明示Grantおよび一度表示Tokenを区別して表示する。
 * @trace ARCH-000013
 * @input administration、操作Tokenおよび直前の一時結果を受け取る。
 * @returns Credential管理PanelのHTML断片を返す。
 * @precondition administrationのAccess Contextは起動前に認証済みである。
 * @postcondition 未構成時はRepository単体利用を維持し、構成時もVerifierとsaltを表示しない。
 * @effect N/A: Registry Snapshotを読みHTML文字列を構築するだけである。
 * @failure Registry一覧を取得できない場合は管理不可として表示する。
 * @invariant Credential件数とIdentityはsystemAdmin=trueのAccess Contextにだけ表示する。
 * @boundary CROS Credential Metadata→Workbench Browser表示。
 * @security 全表示値をescapeし、生Tokenはresultに存在する一回だけ表示する。
 * @concurrency 一回の一覧Snapshotだけを同じPanelへ使用する。
 */
export function renderCredentialAdministration(
  administration: CredentialAdministration | undefined,
  actionToken: string,
  result: CredentialAdministrationResult | null,
): string {
  if (administration === undefined)
    return '<article class="panel wide" id="credential-administration"><header><div><p class="eyebrow">CROS administration</p><h2>接続資格の管理</h2></div><span>Not configured</span></header><p class="empty-state">Repository単体利用ではCredentialは不要です。Remote CROSの管理接続が構成された場合だけ、ここにCredential管理を表示します。</p></article>';
  const listed = listConnectionCredentials(
    administration.registry,
    administration.access,
  );
  if (listed.status === "blocked")
    return '<article class="panel wide" id="credential-administration"><header><div><p class="eyebrow">CROS administration</p><h2>接続資格の管理</h2></div><span>Unavailable</span></header><p class="empty-state">現在の接続資格にはCredential管理Capabilityがありません。Credentialの存在や件数は表示しません。</p></article>';
  const notice =
    result === null
      ? ""
      : `<section class="operation-result" data-status="${escapeHtml(result.status)}"><strong>${escapeHtml(result.status)}</strong> ${escapeHtml(result.reason)}${result.token === null ? "" : `<div class="one-time-token"><span>このTokenは今回だけ表示されます。今すぐ安全な方法で利用者へ渡してください。</span><code>${escapeHtml(result.token)}</code></div>`}</section>`;
  const rows = listed.credentials
    .map(
      (credential) =>
        `<tr><td><code>${escapeHtml(credential.credentialId)}</code></td><td>${escapeHtml(credential.profile)}</td><td>${credential.workspaceIds.length === 0 ? "N/A" : credential.workspaceIds.map(escapeHtml).join("<br>")}</td><td>${credential.systemAdmin ? "Yes" : "No"}</td><td>${credential.revoked ? "Revoked" : "Active"}</td><td><form method="post" action="/connection-credentials/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="credentialId" value="${escapeHtml(credential.credentialId)}"><label>Workspaces<input name="workspaceIds" value="${escapeHtml(credential.workspaceIds.join(", "))}"></label><label class="confirm"><input type="checkbox" name="systemAdmin" value="true"${credential.systemAdmin ? " checked" : ""}>System admin</label><button name="operation" value="update_access" type="submit">Update</button><button name="operation" value="rotate" type="submit"${credential.revoked ? " disabled" : ""}>Rotate</button><button name="operation" value="revoke" type="submit"${credential.revoked ? " disabled" : ""}>Revoke</button></form></td></tr>`,
    )
    .join("");
  return `<article class="panel wide" id="credential-administration"><header><div><p class="eyebrow">CROS administration</p><h2>接続資格の管理</h2></div><span>${listed.credentials.length} credentials</span></header>${notice}<form class="credential-issue" method="post" action="/connection-credentials/action"><input type="hidden" name="actionToken" value="${escapeHtml(actionToken)}"><input type="hidden" name="operation" value="issue"><label>Profile<select name="profile"><option value="developer">Developer</option><option value="management">Management</option><option value="administrator">Administrator</option></select></label><p>Profileは発行時の初期値です。実効権限は保存されたWorkspace GrantとSystem Adminで決まります。</p><button type="submit">Issue credential</button></form><div class="table-scroll"><table><thead><tr><th>Credential</th><th>Profile</th><th>Workspaces</th><th>Admin</th><th>Status</th><th>Actions</th></tr></thead><tbody>${rows}</tbody></table></div></article>`;
}

/**
 * Profile入力を固定Credential Profileへ制限する。
 *
 * @responsibility 外部Form値から閉じたProfile型だけを返す。
 * @trace ARCH-000013
 * @input valueに未信頼のForm値を受け取る。
 * @returns administrator、management、developerのいずれかを返す。
 * @precondition N/A: nullを含む外部入力を受け付ける。
 * @postcondition 固定集合外の値を返さない。
 * @effect N/A: 値を判定するだけである。
 * @failure 未知値を例外で拒否する。
 * @invariant Profile集合を動的入力で拡張しない。
 * @boundary Browser FormとCredential Profile型の境界。
 * @security 不明Profileから権限を生成しない。
 * @concurrency N/A: 共有状態を持たない。
 */
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

/**
 * Credential管理表示TextをHTMLとして安全に符号化する。
 *
 * @responsibility Registry由来Textと一度表示TokenをMarkupとして解釈させない。
 * @trace ARCH-000013
 * @input valueに表示Textを受け取る。
 * @returns HTML特殊文字をEntityへ変換したTextを返す。
 * @precondition valueは実行可能Markupとして扱わない文字列である。
 * @postcondition ampersand、angle bracket、quoteを生で残さない。
 * @effect N/A: 文字列を変換するだけである。
 * @failure N/A: 全文字列を決定論的に変換する。
 * @invariant 表示文字の意味順序を変えない。
 * @boundary Credential MetadataとBrowser HTMLの境界。
 * @security Script、ElementまたはAttributeの注入を防ぐ。
 * @concurrency N/A: 同期的な純粋変換である。
 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

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
import { createElement, type ReactElement } from "react";

import {
  ActionTokenInput,
  EmptyState,
  WorkbenchPanel,
} from "./presentation/workbench-components.ts";

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
 * Credential管理Panelを安全なReact要素へ投影する。
 *
 * @responsibility 管理可否、Credential Metadata、明示Grantおよび一度表示Tokenを区別して表示する。
 * @trace ARCH-000013
 * @input administration、操作Tokenおよび直前の一時結果を受け取る。
 * @returns Credential管理PanelのReact要素を返す。
 * @precondition administrationのAccess Contextは起動前に認証済みである。
 * @postcondition 未構成時はRepository単体利用を維持し、構成時もVerifierとsaltを表示しない。
 * @effect N/A: Registry SnapshotからReact要素を構築するだけである。
 * @failure Registry一覧を取得できない場合は管理不可として表示する。
 * @invariant Credential件数とIdentityはsystemAdmin=trueのAccess Contextにだけ表示する。
 * @boundary CROS Credential Metadata→Workbench Browser表示。
 * @security ReactのText escapingを使用し、生Tokenはresultに存在する一回だけ表示する。
 * @concurrency 一回の一覧Snapshotだけを同じPanelへ使用する。
 */
export function renderCredentialAdministration(
  administration: CredentialAdministration | undefined,
  actionToken: string,
  result: CredentialAdministrationResult | null,
): ReactElement {
  if (administration === undefined)
    return createElement(
      WorkbenchPanel,
      {
        id: "credential-administration",
        eyebrow: "CROS administration",
        title: "接続資格の管理",
        status: "Not configured",
      },
      createElement(
        EmptyState,
        null,
        "Repository単体利用ではCredentialは不要です。Remote CROSの管理接続が構成された場合だけ、ここにCredential管理を表示します。",
      ),
    );
  const listed = listConnectionCredentials(
    administration.registry,
    administration.access,
  );
  if (listed.status === "blocked")
    return createElement(
      WorkbenchPanel,
      {
        id: "credential-administration",
        eyebrow: "CROS administration",
        title: "接続資格の管理",
        status: "Unavailable",
      },
      createElement(
        EmptyState,
        null,
        "現在の接続資格にはCredential管理Capabilityがありません。Credentialの存在や件数は表示しません。",
      ),
    );
  const notice =
    result === null
      ? null
      : createElement(
          "section",
          { className: "operation-result", "data-status": result.status },
          createElement("strong", null, result.status),
          ` ${result.reason}`,
          result.token === null
            ? null
            : createElement(
                "div",
                { className: "one-time-token" },
                createElement(
                  "span",
                  null,
                  "このTokenは今回だけ表示されます。今すぐ安全な方法で利用者へ渡してください。",
                ),
                createElement("code", null, result.token),
              ),
        );
  const credentialRows = listed.credentials.map((credential) => {
    const actions = createElement(
      "form",
      { method: "post", action: "/connection-credentials/action" },
      createElement(ActionTokenInput, { value: actionToken }),
      createElement("input", {
        type: "hidden",
        name: "credentialId",
        value: credential.credentialId,
      }),
      createElement(
        "label",
        null,
        "Workspaces",
        createElement("input", {
          name: "workspaceIds",
          defaultValue: credential.workspaceIds.join(", "),
        }),
      ),
      createElement(
        "label",
        { className: "confirm" },
        createElement("input", {
          type: "checkbox",
          name: "systemAdmin",
          value: "true",
          defaultChecked: credential.systemAdmin,
        }),
        "System admin",
      ),
      createElement(
        "button",
        { name: "operation", value: "update_access", type: "submit" },
        "Update",
      ),
      createElement(
        "button",
        {
          name: "operation",
          value: "rotate",
          type: "submit",
          disabled: credential.revoked,
        },
        "Rotate",
      ),
      createElement(
        "button",
        {
          name: "operation",
          value: "revoke",
          type: "submit",
          disabled: credential.revoked,
        },
        "Revoke",
      ),
    );
    return createElement(
      "tr",
      { key: credential.credentialId },
      createElement(
        "td",
        null,
        createElement("code", null, credential.credentialId),
      ),
      createElement("td", null, credential.profile),
      createElement(
        "td",
        null,
        credential.workspaceIds.length === 0
          ? "N/A"
          : credential.workspaceIds.map((workspaceId) =>
              createElement("div", { key: workspaceId }, workspaceId),
            ),
      ),
      createElement("td", null, credential.systemAdmin ? "Yes" : "No"),
      createElement("td", null, credential.revoked ? "Revoked" : "Active"),
      createElement("td", null, actions),
    );
  });
  return createElement(
    WorkbenchPanel,
    {
      id: "credential-administration",
      eyebrow: "CROS administration",
      title: "接続資格の管理",
      status: `${listed.credentials.length} credentials`,
    },
    notice,
    createElement(
      "form",
      {
        className: "credential-issue",
        method: "post",
        action: "/connection-credentials/action",
      },
      createElement(ActionTokenInput, { value: actionToken }),
      createElement("input", {
        type: "hidden",
        name: "operation",
        value: "issue",
      }),
      createElement(
        "label",
        null,
        "Profile",
        createElement(
          "select",
          { name: "profile" },
          createElement("option", { value: "developer" }, "Developer"),
          createElement("option", { value: "management" }, "Management"),
          createElement("option", { value: "administrator" }, "Administrator"),
        ),
      ),
      createElement(
        "p",
        null,
        "Profileは発行時の初期値です。実効権限は保存されたWorkspace GrantとSystem Adminで決まります。",
      ),
      createElement("button", { type: "submit" }, "Issue credential"),
    ),
    createElement(
      "div",
      { className: "table-scroll" },
      createElement(
        "table",
        null,
        createElement(
          "thead",
          null,
          createElement(
            "tr",
            null,
            ...[
              "Credential",
              "Profile",
              "Workspaces",
              "Admin",
              "Status",
              "Actions",
            ].map((value) => createElement("th", { key: value }, value)),
          ),
        ),
        createElement("tbody", null, ...credentialRows),
      ),
    ),
  );
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

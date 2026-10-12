/**
 * 現在Roleと操作対象から固定管理分担を判定する。
 *
 * @responsibility 管理の許可・拒否・入力不明を純粋に分け、内容権限やHost信頼を判定へ混ぜない。
 * @trace ARCH-000013
 */
import { types } from "node:util";

/**
 * 最小ユーザーに割り当てる一つの管理Role。
 *
 * @responsibility 採用済み三Roleの識別値を所有する。
 * @trace ARCH-000013
 * @shape developer、manager、administratorのliteral union。
 * @invariant 一ユーザーの現在Roleは一つで、Credential別の追加Roleを作らない。
 * @boundary Access Managementの固定管理判定。
 * @security 値だけでは認証・対象存在・実行Authorityを証明しない。
 * @compatibility 旧management Profileとは別の新Role契約である。
 */
export type AccessRole = "developer" | "manager" | "administrator";

/**
 * 固定管理判定に必要な操作とRole対象だけを表す。
 *
 * @responsibility 9 Role分担表を11認可要求種別へ対応させ、操作別の必須対象を閉じる。
 * @trace ARCH-000013
 * @shape 操作識別子と登録予定Role、変更前後Roleまたは対象Roleのdiscriminated union。
 * @invariant Host交換・初期化・Credential値・可変内容設定を含めない。
 * @boundary 通常管理の現在認可に用いる純粋な入力。
 * @security 対象の実在・userId結合・現在状態は呼出し側が別に確認する。
 * @compatibility 内部Package契約であり、HTTP／MCPの公開Schemaではない。
 */
export type ManagementRequest =
  | Readonly<{ operation: "registerUser"; plannedRole: AccessRole }>
  | Readonly<{ operation: "updateUserName"; targetRole: AccessRole }>
  | Readonly<{
      operation: "changeUserRole";
      currentRole: AccessRole;
      nextRole: AccessRole;
    }>
  | Readonly<{ operation: "updateRoleContentAccess"; targetRole: AccessRole }>
  | Readonly<{
      operation:
        | "registerRepository"
        | "unregisterRepository"
        | "updateExposure"
        | "manageAiProfiles"
        | "issueCredential"
        | "revokeCredential"
        | "exchangeCredentials";
    }>;

/**
 * 固定分担だけの許可、拒否、入力不正を区別する。
 *
 * @responsibility 形式不正を権限不足に畳まず、判定値から実行Authorityを発行しない。
 * @trace ARCH-000013
 * @shape allowed、denied、invalidのliteral union。
 * @invariant allowedは固定管理分担の成立だけを示す。
 * @boundary 通常管理の処置前判定。
 * @security 保存、鍵発行、内容閲覧、Host交換をこの値だけで許可しない。
 * @compatibility Source内部の判定結果で、公開read結果とは別である。
 */
export type ManagementPermission = "allowed" | "denied" | "invalid";

/**
 * 管理要求の対象制約を含む固定Role判定を行う。
 *
 * @responsibility administrator専用境界とmanagerの通常管理範囲を、操作固有対象から判定する。
 * @trace ARCH-000013
 * @input 現要求で解決したactorRoleと、操作別の閉じたrequest。
 * @returns 固定分担のallowed、deniedまたは入力不正のinvalid。
 * @precondition 呼出し側は認証・現在改訂・対象存在を別に確認する。値の形式は本関数も検査する。
 * @postcondition 不明Role、余分field、accessor、Proxyを許可へ丸めない。
 * @effect N/A: 値を読む同期計算だけで、Filesystem・資格・Repositoryを操作しない。
 * @failure 不正入力はinvalid、有効入力の固定権限不足はdenied。外部故障を所有しない。
 * @invariant 内容権限設定、対象Identity、Host信頼をRoleの固定分担へ転用しない。
 * @boundary 通常管理の純粋判定と、現在認証・保存・実操作の呼出し側の境界。
 * @security allowedはCapabilityではない。処置時には現在認可と操作固有条件を再確認する。
 * @concurrency N/A: 共有状態を持たず、古いRoleの再利用可否は呼出し側が判定する。
 */
export function evaluateManagementPermission(
  actorRole: unknown,
  request: unknown,
): ManagementPermission {
  if (!isAccessRole(actorRole)) return "invalid";
  if (request === null || typeof request !== "object" || types.isProxy(request))
    return "invalid";
  const prototype = Object.getPrototypeOf(request);
  if (prototype !== Object.prototype && prototype !== null) return "invalid";
  const descriptors = Object.getOwnPropertyDescriptors(request);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some((key) => typeof key !== "string")) return "invalid";
  if (
    Object.values(descriptors).some(
      (descriptor) => !Object.hasOwn(descriptor, "value"),
    )
  )
    return "invalid";
  const operation: unknown = descriptors.operation?.value;
  let targetRequiresAdministrator = false;
  let expectedKeys: readonly string[];
  switch (operation) {
    case "registerUser": {
      const plannedRole: unknown = descriptors.plannedRole?.value;
      if (!isAccessRole(plannedRole)) return "invalid";
      expectedKeys = ["operation", "plannedRole"];
      targetRequiresAdministrator = plannedRole === "administrator";
      break;
    }
    case "updateUserName":
    case "updateRoleContentAccess": {
      const targetRole: unknown = descriptors.targetRole?.value;
      if (!isAccessRole(targetRole)) return "invalid";
      expectedKeys = ["operation", "targetRole"];
      targetRequiresAdministrator =
        operation === "updateRoleContentAccess" &&
        targetRole === "administrator";
      break;
    }
    case "changeUserRole": {
      const currentRole: unknown = descriptors.currentRole?.value;
      const nextRole: unknown = descriptors.nextRole?.value;
      if (!isAccessRole(currentRole) || !isAccessRole(nextRole))
        return "invalid";
      expectedKeys = ["operation", "currentRole", "nextRole"];
      targetRequiresAdministrator =
        currentRole === "administrator" || nextRole === "administrator";
      break;
    }
    case "registerRepository":
    case "unregisterRepository":
    case "updateExposure":
    case "manageAiProfiles":
      expectedKeys = ["operation"];
      break;
    case "issueCredential":
    case "revokeCredential":
    case "exchangeCredentials":
      expectedKeys = ["operation"];
      targetRequiresAdministrator = true;
      break;
    default:
      return "invalid";
  }
  if (
    keys.length !== expectedKeys.length ||
    keys.some((key) => !expectedKeys.includes(key as string))
  )
    return "invalid";
  if (actorRole === "developer") return "denied";
  if (actorRole === "manager" && targetRequiresAdministrator) return "denied";
  return "allowed";
}

/**
 * 値が採用済み三Roleの識別子か判定する。
 *
 * @responsibility 未知Roleを既定Roleへ変換せず拒否する。
 * @trace ARCH-000013
 * @input 信頼していないRole値。
 * @returns 三Roleのいずれかである場合だけtrue。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 入力を変更・正規化しない。
 * @effect N/A: primitiveの等値比較だけを行う。
 * @failure N/A: 値比較に外部故障はない。
 * @invariant management等の旧識別子を互換受理しない。
 * @boundary 同FileのRole形式検査。
 * @security Roleの実在・認証・現在性は確認しない。
 * @concurrency N/A: 共有状態を持たない。
 */
function isAccessRole(value: unknown): value is AccessRole {
  return (
    value === "developer" || value === "manager" || value === "administrator"
  );
}

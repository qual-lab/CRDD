/**
 * 固定Roleと管理操作の入力を検査する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { types } from "node:util";
import type { AccessRole } from "../role/types.ts";
import type { ManagementPermission } from "./types.ts";

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
    case "updateUserName": {
      const targetRole: unknown = descriptors.targetRole?.value;
      if (!isAccessRole(targetRole)) return "invalid";
      expectedKeys = ["operation", "targetRole"];
      targetRequiresAdministrator = targetRole === "administrator";
      break;
    }
    case "updateUserRole": {
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
    case "manageAiProfiles":
    case "openManagementSession":
      expectedKeys = ["operation"];
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
 * Role値を固定三Roleへ限定する。
 * @responsibility 旧語彙・未知値を既定Roleへ変換しない。
 * @trace ARCH-000013
 * @input 信頼しないRole値。
 * @returns 採用済み三Roleの場合だけtrue。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 暗黙変換しない。
 * @effect N/A: primitive比較だけ。
 * @failure 不正値はfalse。
 * @invariant Role内容設定を固定管理許可にしない。
 * @boundary 通常管理のRole入力。
 * @security 認証・Authorityはこの値から作らない。
 * @concurrency N/A: 局所値だけ。
 */
export function isAccessRole(value: unknown): value is AccessRole {
  return (
    value === "developer" || value === "manager" || value === "administrator"
  );
}

const accessRoles = ["developer", "manager", "administrator"] as const;

/** 現在観測されたロールの管理画面向け表示許可。実操作は別に再認可する。 */
export function describeManagementPermissions(role: AccessRole) {
  return {
    openSession:
      evaluateManagementPermission(role, {
        operation: "openManagementSession",
      }) === "allowed",
    registerRoles: accessRoles.filter(
      (plannedRole) =>
        evaluateManagementPermission(role, {
          operation: "registerUser",
          plannedRole,
        }) === "allowed",
    ),
    registerRepository:
      evaluateManagementPermission(role, {
        operation: "registerRepository",
      }) === "allowed",
    unregisterRepository:
      evaluateManagementPermission(role, {
        operation: "unregisterRepository",
      }) === "allowed",
  };
}

export function canRenewUserInvitation(
  role: AccessRole,
  hasAccountLinks: boolean,
) {
  return role === "administrator" && !hasAccountLinks;
}

export function describeUserManagementPermissions(
  role: AccessRole,
  targetRole: AccessRole,
  hasAccountLinks: boolean,
) {
  return {
    rename:
      evaluateManagementPermission(role, {
        operation: "updateUserName",
        targetRole,
      }) === "allowed",
    changeRoles: accessRoles.filter(
      (nextRole) =>
        nextRole !== targetRole &&
        evaluateManagementPermission(role, {
          operation: "updateUserRole",
          currentRole: targetRole,
          nextRole,
        }) === "allowed",
    ),
    renewInvitation: canRenewUserInvitation(role, hasAccountLinks),
  };
}

/**
 * ユーザーとRole内容範囲の通常変更を同じ現在状態から組み立てる。
 * @responsibility 入力・現在認証・固定管理許可・対象照合を所有し、保存を行わない。
 * @trace ARCH-000013
 */
import { types } from "node:util";
import {
  type AccessRole,
  evaluateManagementPermission,
} from "../access/management-permission.ts";
import { resolveCredentialAuthentication } from "../credential/authentication.ts";
import type { AccessManagementState } from "../state/parse.ts";

/**
 * 通常管理4操作の内部入力を表す。
 * @responsibility 操作別に必要な値を区別する。
 * @trace ARCH-000013
 * @shape 登録、名前変更、Role変更、内容範囲更新の判別共用体。
 * @invariant 外部値は検査前のunknownで、資格・保存状態を含めない。
 * @boundary AM内部の専用保存入口と純粋な変更判断。
 * @security 入力だけでは現在認可を成立させない。
 * @compatibility 通常管理4操作だけ。鍵・登録接続・公開設定は含まない。
 */
export type UserRoleChange =
  | { operation: "registerUser"; username: unknown; plannedRole: unknown }
  | { operation: "updateUserName"; userId: unknown; username: unknown }
  | {
      operation: "changeUserRole";
      userId: unknown;
      currentRole: unknown;
      nextRole: unknown;
    }
  | {
      operation: "updateRoleContentAccess";
      targetRole: unknown;
      workspaceIds: unknown;
    };

/**
 * 現在管理許可と対象照合を通過した変更候補を表す。
 * @responsibility 登録UUID生成前の固定長候補と変更対象を結合する。
 * @trace ARCH-000013
 * @shape 所有済みnext状態、登録有無、対象userId。
 * @invariant 登録placeholderは採用Identityではなく保存・公開しない。
 * @boundary 同じLock区間の保存Ownerだけが使用する。
 * @security 内部Snapshotを含むためPackage Rootへ公開しない。
 * @compatibility 完了初期化の通常更新だけ。
 */
export type PreparedUserRoleChange = {
  next: AccessManagementState;
  registersUser: boolean;
  userId: string | null;
};

/**
 * 表示名を既存状態Schemaと同じ条件で検査する。
 * @responsibility 空・暗黙正規化・制御文字を受理しない。
 * @trace ARCH-000013
 * @input 信頼しない表示名。
 * @returns 正規化不要な1〜128文字の場合だけtrue。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 値を変更せず、objectを文字列化しない。
 * @effect N/A: primitiveの同期検査だけ。
 * @failure 不正値はfalse。
 * @invariant 同名ユーザーを禁止する新条件を追加しない。
 * @boundary 通常ユーザー管理の入力検査。
 * @security getter・toStringを実行しない。
 * @concurrency N/A: 局所値だけ。
 */
function isUserName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 256 &&
    value === value.trim() &&
    [...value].length >= 1 &&
    [...value].length <= 128 &&
    !/[\p{Cc}\p{Cs}]/u.test(value)
  );
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
function isRole(value: unknown): value is AccessRole {
  return (
    value === "developer" || value === "manager" || value === "administrator"
  );
}

/**
 * 固定内容範囲を共有しない配列へ検査・複製する。
 * @responsibility Proxy・accessor・余分field・未知値・重複を拒否する。
 * @trace ARCH-000013
 * @input 信頼しない内容範囲配列。
 * @returns 所有済みdevelopment／management集合、またはnull。
 * @precondition N/A: 任意値を受ける。
 * @postcondition 入力配列の変更を候補へ伝播しない。
 * @effect N/A: descriptor検査と局所配列生成だけ。
 * @failure 不正値はnull。
 * @invariant 欠測を空集合へ補完しない。
 * @boundary Role内容設定の入力と内部状態。
 * @security getter・Proxy trapを実行しない。
 * @concurrency 同期で所有値へ確定する。
 */
function readWorkspaceIds(
  value: unknown,
): ("development" | "management")[] | null {
  if (types.isProxy(value) || !Array.isArray(value)) return null;
  const length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isInteger(length) || length < 0 || length > 2) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== length + 1) return null;
  const result: ("development" | "management")[] = [];
  for (let index = 0; index < length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !Object.hasOwn(descriptor, "value")) return null;
    const item: unknown = descriptor.value;
    if (item !== "development" && item !== "management") return null;
    if (result.includes(item)) return null;
    result.push(item);
  }
  return result;
}

/**
 * 同じ現在状態で管理認可と対象を確認し変更候補を作る。
 * @responsibility 変更前認可を使い、意図したUser／Role fieldだけを変える。
 * @trace ARCH-000013
 * @input 鍵、完全検査済み現在状態、内部4操作入力、期待改訂、受付UUID。
 * @returns 所有済み候補または非開示拒否のnull。
 * @precondition 保存Ownerが同じLock内で読み取ったSnapshotだけを渡す。
 * @postcondition 入力状態・資格・初回・未解決交換・Repository登録・Exposureを変更しない。
 * @effect N/A: 認証計算とメモリ候補だけ。乱数・保存なし。
 * @failure 未認証・固定分担拒否・途中初回・対象差・不正入力はnull。
 * @invariant managerによるadministrator名変更は許可し、Role変更は許可しない。
 * @boundary 操作固有判断と物理保存の境界。
 * @security 返却Snapshotは保存Owner限定。古い認証DTOをAuthorityにしない。
 * @concurrency 同期Lock区間内で現在認可を再評価する。
 */
export function prepareUserRoleChange(
  token: string,
  current: AccessManagementState,
  change: UserRoleChange,
  expectedRevision: number,
  operationId: string,
): PreparedUserRoleChange | null {
  const actor = resolveCredentialAuthentication(token, current);
  if (!actor || current.initialization.stage !== "completed") return null;
  if (
    current.revision !== expectedRevision ||
    current.operationId === operationId
  )
    return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = operationId;
  let userId: string | null = null;
  if (change.operation === "registerUser") {
    if (!isUserName(change.username) || !isRole(change.plannedRole))
      return null;
    if (
      evaluateManagementPermission(actor.role, {
        operation: "registerUser",
        plannedRole: change.plannedRole,
      }) !== "allowed"
    )
      return null;
    next.users.push({
      userId: "00000000-0000-4000-8000-000000000000",
      username: change.username,
      role: change.plannedRole,
    });
  } else if (change.operation === "updateRoleContentAccess") {
    if (!isRole(change.targetRole)) return null;
    const workspaceIds = readWorkspaceIds(change.workspaceIds);
    const target = next.roleContentAccess.find(
      (item) => item.role === change.targetRole,
    );
    if (
      !workspaceIds ||
      !target ||
      evaluateManagementPermission(actor.role, {
        operation: change.operation,
        targetRole: change.targetRole,
      }) !== "allowed"
    )
      return null;
    target.workspaceIds = workspaceIds;
  } else {
    if (typeof change.userId !== "string") return null;
    const target = next.users.find((item) => item.userId === change.userId);
    if (!target) return null;
    userId = target.userId;
    if (change.operation === "updateUserName") {
      if (
        !isUserName(change.username) ||
        evaluateManagementPermission(actor.role, {
          operation: change.operation,
          targetRole: target.role,
        }) !== "allowed"
      )
        return null;
      target.username = change.username;
    } else {
      if (
        !isRole(change.nextRole) ||
        change.currentRole !== target.role ||
        evaluateManagementPermission(actor.role, {
          operation: change.operation,
          currentRole: target.role,
          nextRole: change.nextRole,
        }) !== "allowed"
      )
        return null;
      target.role = change.nextRole;
    }
  }
  return { next, registersUser: change.operation === "registerUser", userId };
}

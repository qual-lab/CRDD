/**
 * 共有AI Profile管理の現在権限を解決する。
 * @responsibility 現在資格とRoleだけを確認し、Catalog内容・保存を所有しない。
 * @trace ARCH-000013
 */
import type { FilesystemStoreRoot } from "../../../domain-model/src/index.ts";
import { authenticateNormalConnection } from "../state/file-store.ts";
import { evaluateManagementPermission } from "./management-permission.ts";

/**
 * 現在Roleの許可・拒否と認証状態の観測不能を分ける。
 * @responsibility 認証不成立をdeveloper拒否に畳まず、非秘密の判定だけを返す。
 * @trace ARCH-000013
 * @shape allowed、denied、unavailableの閉じた判定値。
 * @invariant Catalog存在・User・Role・改訂・資格材料を含めない。
 * @boundary AM現在認可からProfile管理Consumer。
 * @security 値は次要求へ再利用可能なCapabilityではない。
 * @compatibility 旧systemAdmin契約へfallbackしない。
 */
export type AiProfileManagementAccess = "allowed" | "denied" | "unavailable";

/**
 * 一要求の共有Profile管理可否を現在資格から解決する。
 * @responsibility 初回完了済みの現在資格・Roleを同じ管理改訂から照合する。
 * @trace ARCH-000013
 * @input 既存保存Ownerが検証した管理Rootと要求専用Bearer。
 * @returns manager／administratorはallowed、developerはdenied、認証・状態未確認はunavailable。
 * @precondition 呼出し元は完全入力検査・開始前取消を確認する。
 * @postcondition AM Lock解放確認後だけ判定を返し、Catalogには触れない。
 * @effect 既存通常認証の状態読取り・Lock・KDF・確認済み短命材料清掃のみ。
 * @failure 失効・不正資格・初回未完了・保存／解放不明はunavailable。
 * @invariant 管理許可から内容権限・鍵操作・Provider実行を生成しない。
 * @boundary AM通常認証→純粋Role判定。Catalog操作はConsumer側の別Owner。
 * @security Token・内部Path・本人情報を結果へ渡さない。
 * @concurrency 要求毎に再観測し、認可後のRole変更は次要求へ反映する。二Storeの原子性は保証しない。
 */
export function resolveAiProfileManagementAccess(
  root: FilesystemStoreRoot,
  token: string,
): AiProfileManagementAccess {
  const authentication = authenticateNormalConnection(root, token);
  if (authentication.status !== "completed") return "unavailable";
  const permission = evaluateManagementPermission(
    authentication.snapshot.role,
    {
      operation: "manageAiProfiles",
    },
  );
  return permission === "invalid" ? "unavailable" : permission;
}

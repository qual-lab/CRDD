/**
 * CROSのProfile管理権限と操作入力を所有する。
 *
 * @responsibility 管理権限をContent Grantから分離し、既存AI Adapter管理へ閉じた入力を渡す。
 * @trace ARCH-000010
 * @trace ARCH-000013
 */
import {
  validateAiProfileDefinition,
  type AiProfileCatalogAdministration,
  type AiProfileCatalogMutation,
} from "../../../ai-adapter/src/index.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import type { RequestAccessContext } from "../access/credential.ts";

/**
 * 現在の管理権限に限り既存Catalog操作を返す。
 *
 * @responsibility 管理能力とRepository Content参照を分離する。
 * @trace ARCH-000010
 * @trace ARCH-000013
 * @input access: 現在認証の結果、administration: CROS Ownerの操作。
 * @returns 管理操作、非管理または未構成ならnull。
 * @precondition accessは当該RequestのCredential検証で取得済み。
 * @postcondition 非管理主体へ操作とStoreの存在を渡さない。
 * @effect N/A: StoreとContent Snapshotを読まない。
 * @failure 非管理と未構成は同じnull。
 * @invariant Content GrantからsystemAdminを生成しない。
 * @boundary CROS認証結果とProfile管理能力の境界。
 * @security TokenとCatalog内容を取得しない。
 * @concurrency 現在RequestのAccessだけを使用する。
 */
export function resolveCrosAiProfileAdministration(
  access: RequestAccessContext,
  administration: AiProfileCatalogAdministration | undefined,
): AiProfileCatalogAdministration | null {
  return access.systemAdmin ? (administration ?? null) : null;
}

/**
 * Profile管理入力を既存AI AdapterのMutationへ固定する。
 *
 * @responsibility 操作別fieldと構造を検査し、語彙検査をAI Adapterへ委譲する。
 * @trace ARCH-000010
 * @trace ARCH-000013
 * @input value: 未信頼の操作入力。
 * @returns 所有済みMutation、不正ならnull。
 * @precondition N/A: 未信頼値を受け付ける。
 * @postcondition 操作、改訂、Profileまたは削除確認だけを保持する。
 * @effect N/A: Storeを呼ばない。
 * @failure 未知field、型またはProfile構造不正はnull。
 * @invariant Modelの登録可否と改訂競合はCatalog管理が決定する。
 * @boundary HTTP／MCP入力とCatalog操作の境界。
 * @security Proxy／accessorと任意実行fieldを受理しない。
 * @concurrency 同期取得した値を固定する。
 */
export function parseCrosAiProfileMutation(
  value: unknown,
): AiProfileCatalogMutation | null {
  const deletion = snapshotPlainRecord(
    value,
    new Set(["operation", "expectedRevision", "profileId", "confirmed"]),
  );
  if (
    deletion?.operation === "delete" &&
    Number.isSafeInteger(deletion.expectedRevision) &&
    Number(deletion.expectedRevision) >= 0 &&
    typeof deletion.profileId === "string" &&
    /^PROFILE-[0-9]{6,}$/u.test(deletion.profileId) &&
    typeof deletion.confirmed === "boolean"
  ) {
    return Object.freeze({
      operation: "delete",
      expectedRevision: Number(deletion.expectedRevision),
      profileId: deletion.profileId,
      confirmed: deletion.confirmed,
    });
  }
  const change = snapshotPlainRecord(
    value,
    new Set(["operation", "expectedRevision", "profile"]),
  );
  if (
    !change ||
    !["create", "update"].includes(change.operation as string) ||
    !Number.isSafeInteger(change.expectedRevision) ||
    Number(change.expectedRevision) < 0
  )
    return null;
  const profile = validateAiProfileDefinition(change.profile);
  return profile === null
    ? null
    : Object.freeze({
        operation: change.operation as "create" | "update",
        expectedRevision: Number(change.expectedRevision),
        profile,
      });
}

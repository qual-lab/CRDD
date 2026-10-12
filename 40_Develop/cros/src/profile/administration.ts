/**
 * CROSのProfile管理権限を所有する。
 *
 * @responsibility 管理権限をContent Grantから分離し、既存AI Adapter管理へ閉じた入力を渡す。
 * @trace ARCH-000010
 * @trace ARCH-000013
 */
import type { AiProfileCatalogAdministration } from "../../../ai-adapter/src/index.ts";
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

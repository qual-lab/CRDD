/**
 * Repository別AI選択と同梱技術Catalogを表示へ投影する。
 * @responsibility 設定の不在・拒否と技術対応を現在の認証・実行可否から分離する。
 * @trace ARCH-000012
 * @trace ARCH-000010
 * @boundary 検証済みRepositoryとBrowser向け非秘密Read Model。
 * @effect 設定Fileだけを読み、初期設定やProvider処理を開始しない。
 * @security Credential・Home・Host Pathを返さない。
 */
import {
  getAiModelCatalog,
  type AiModelCatalogSnapshot,
} from "../../../../ai-adapter/src/index.ts";
import {
  readRepositoryAiSelection,
  type AiSelectionReadResult,
} from "../../../../domain-model/src/index.ts";
import type { VerifiedRepositoryRoot } from "../../../../version-control/src/index.ts";

/**
 * 技術Catalogと当該Repositoryの設定観測を保持する。
 * @responsibility 未設定を既定Modelで補完しない。
 * @trace ARCH-000012
 * @shape catalogとselection。
 * @invariant 技術対応は現在認証又はAuthorityの証明ではない。
 * @boundary ServerからBrowserへの表示値。
 * @security 秘密・絶対Pathなし。
 * @compatibility 新形式専用。
 */
export type WorkbenchAiSelectionSurface = Readonly<{
  catalog: AiModelCatalogSnapshot;
  selection: AiSelectionReadResult;
}>;

/**
 * 現在RepositoryのAI設定を再観測する。
 * @responsibility 選択Rootの設定だけを技術Catalogとともに返す。
 * @trace ARCH-000012
 * @input root: 検証済みRepository能力。
 * @returns 設定観測と同梱技術Catalog。
 * @precondition 共有利用時は呼出し元が現在認可を確認済み。
 * @postcondition File不存在を保持する。
 * @effect 一つの設定Fileの読取りのみ。
 * @failure 不明はblockedのまま返す。
 * @invariant Host Catalogへfallbackしない。
 * @boundary 専門OwnerとWorkbench投影。
 * @security 認証状態を推定しない。
 * @concurrency 一回の読取りSnapshotを利用する。
 */
export function readWorkbenchAiSelectionSurface(
  root: VerifiedRepositoryRoot,
): WorkbenchAiSelectionSurface {
  return Object.freeze({
    catalog: getAiModelCatalog(),
    selection: readRepositoryAiSelection(root, getAiModelCatalog().catalog),
  });
}

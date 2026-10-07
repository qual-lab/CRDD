/**
 * AI Profile Catalogの限定管理Application。
 *
 * @packageDocumentation
 * @responsibility 登録済みAdapter／Modelだけを使うProfileの作成、更新、確認付き削除を不変Catalog Snapshotへ反映する。
 * @trace ARCH-000010
 * @boundary Workbench等の管理入口とOwner別Catalog Storeの境界。
 * @effect 検証済み候補だけをCatalog Storeへ採用する。
 * @security Adapter、実行Path、Credentialおよび任意引数の管理を提供しない。
 */
import type {
  AiProfileCatalog,
  AiProfileCatalogAdministration,
  AiProfileCatalogMutation,
  AiProfileCatalogMutationResult,
  AiProfileCatalogStore,
  AiProfileDefinition,
} from "../catalog/types.ts";

/**
 * Owner別Catalog StoreへProfile限定の管理操作を接続する。
 *
 * @responsibility Profile Identity、操作種別、削除確認および改訂競合をCatalog全体の採用前に評価する。
 * @trace ARCH-000010
 * @input store: RepositoryまたはCROS Ownerの検証済みCatalog Store。
 * @returns 現在Snapshotの取得と限定Mutation実行を持つApplication。
 * @precondition storeは一つのOwnerに固定され、Snapshot採用を直列化する。
 * @postcondition completed時だけRevisionが一つ進み、rejected時はSnapshotを変更しない。
 * @effect execute成功時にOwner別Catalog Snapshotを一件追加する。
 * @failure Profile重複、不在、未確認削除、不正Catalogまたは改訂競合をrejectedで返す。
 * @invariant Adapter集合を変更せず、Profile以外のCatalog Propertyを保持する。
 * @boundary 管理CommandとCatalog Storeの境界。
 * @security Profile操作からAdapter、Authority、Credentialまたは実行引数を発行しない。
 * @concurrency expectedRevisionが同時更新の上書きを拒否する。
 */
export function createAiProfileCatalogAdministration(
  store: AiProfileCatalogStore,
): AiProfileCatalogAdministration {
  return Object.freeze({
    snapshot: store.snapshot,
    execute: (mutation) => executeMutation(store, mutation),
  });
}

/**
 * 一件のProfile MutationをCatalog候補へ変換して採用する。
 *
 * @responsibility 操作固有の存在条件を評価し、Storeの閉じたSchema検証へ候補を渡す。
 * @trace ARCH-000010
 * @input store: 採用先Store、mutation: Profile限定操作。
 * @returns completedまたは理由付きrejected結果。
 * @precondition mutationは型契約を満たすが、Profile内容を信頼済みとは扱わない。
 * @postcondition completed時のSnapshotは操作内容を一度だけ反映する。
 * @effect Store adoptを最大一回呼び出す。
 * @failure 操作条件またはCatalog検証に失敗した場合はEffect 0で拒否する。
 * @invariant Adapter定義とCatalog契約改訂版を変更しない。
 * @boundary Profile MutationとCatalog全体採用の境界。
 * @security 未登録Adapter／ModelはStore検証で拒否し、未知Propertyを追加しない。
 * @concurrency MutationのexpectedRevisionをStoreへそのまま渡す。
 */
function executeMutation(
  store: AiProfileCatalogStore,
  mutation: AiProfileCatalogMutation,
): AiProfileCatalogMutationResult {
  const current = store.snapshot();
  if (mutation.expectedRevision !== current.revision)
    return rejected("revision_conflict", current);
  const index = current.catalog.profiles.findIndex(
    (profile) =>
      profile.profileId ===
      (mutation.operation === "delete"
        ? mutation.profileId
        : mutation.profile.profileId),
  );
  if (mutation.operation === "create" && index !== -1)
    return rejected("profile_already_exists", current);
  if (mutation.operation !== "create" && index === -1)
    return rejected("profile_not_found", current);
  if (mutation.operation === "delete" && !mutation.confirmed)
    return rejected("profile_delete_confirmation_required", current);

  const profiles: readonly AiProfileDefinition[] =
    mutation.operation === "create"
      ? [...current.catalog.profiles, mutation.profile]
      : mutation.operation === "update"
        ? current.catalog.profiles.map((profile, profileIndex) =>
            profileIndex === index ? mutation.profile : profile,
          )
        : current.catalog.profiles.filter(
            (_, profileIndex) => profileIndex !== index,
          );
  const candidate: AiProfileCatalog = {
    ...current.catalog,
    profiles,
  };
  const adoption = store.adopt({
    expectedRevision: mutation.expectedRevision,
    candidate,
  });
  if (adoption.status === "rejected")
    return rejected(adoption.reason, adoption.snapshot);
  return Object.freeze({
    status: "completed",
    reason:
      mutation.operation === "create"
        ? "profile_created"
        : mutation.operation === "update"
          ? "profile_updated"
          : "profile_deleted",
    snapshot: adoption.snapshot,
  });
}

/**
 * Profile管理の拒否結果を一貫した形へ固定する。
 *
 * @responsibility 拒否理由と変更されていない現在Snapshotを結合する。
 * @trace ARCH-000010
 * @input reason: 拒否理由、snapshot: 現在Snapshot。
 * @returns rejected管理結果。
 * @precondition snapshotはStoreから取得した現在値である。
 * @postcondition 入力Snapshotを変更せず返す。
 * @effect N/A: 結果Objectを作るだけである。
 * @failure N/A: 閉じた理由集合だけを受け取る。
 * @invariant 拒否をcompletedへ変換しない。
 * @boundary Store拒否と管理利用側の境界。
 * @security 内部Pathまたは候補内容を理由へ含めない。
 * @concurrency N/A: 共有状態を変更しない。
 */
function rejected(
  reason: AiProfileCatalogMutationResult["reason"],
  snapshot: ReturnType<AiProfileCatalogStore["snapshot"]>,
): AiProfileCatalogMutationResult {
  return Object.freeze({ status: "rejected", reason, snapshot });
}

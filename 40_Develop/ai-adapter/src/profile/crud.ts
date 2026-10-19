/**
 * AI Profileの登録・更新・削除と操作結果の相関を検証する。
 *
 * @responsibility 登録済みAdapter／Modelだけを使うProfileの作成、更新、確認付き削除を不変Catalog Snapshotへ反映する。
 * @trace ARCH-000010
 * @boundary Workbench等の管理入口とOwner別Catalog Storeの境界。
 * @effect 検証済み候補だけをCatalog Storeへ採用する。
 * @security Adapter、実行Path、Credentialおよび任意引数の管理を提供しない。
 */
import type { AiProfileCatalog } from "../catalog/types.ts";
import type { AiProfileDefinition } from "./types.ts";
import type {
  AiProfileCatalogSnapshot,
  AiProfileCatalogStore,
} from "../storage/store.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import {
  validateAiProfileCatalog,
  validateAiProfileDefinition,
} from "../catalog/validation.ts";

/**
 * Profile操作の結果と保存後Snapshotを共同検査する。
 *
 * @responsibility 操作・理由・改訂・対象値の矛盾を公開成功へ変換しない。
 * @trace ARCH-000010
 * @input mutation: 実行した操作、raw: 一回の管理結果。
 * @returns validの所有済み結果又は相関不正を示すblocked結果。
 * @precondition mutationは閉じた入力検査を通過している。
 * @postcondition 成功は改訂増加と対象反映、拒否は理由固有の状態を満たす。
 * @effect N/A: 結果だけを検査しStoreを再読取りしない。
 * @failure 不正field、実行可能Property、矛盾した理由・改訂・対象はblocked。
 * @invariant 保存の巻戻しと暗黙再Mutationを行わない。
 * @boundary Catalog管理Ownerと利用側の公開結果。
 * @security Proxy／accessorを評価せずCatalogを所有値へ固定する。
 * @concurrency 同期取得した一回の結果だけを使用する。
 */
export function validateAiProfileMutationResult(
  mutation: AiProfileCatalogMutation,
  raw: unknown,
): AiProfileMutationValidationResult {
  const record = snapshotPlainRecord(
    raw,
    new Set(["status", "reason", "snapshot"]),
  );
  if (
    record?.status === "unknown" &&
    record.snapshot === null &&
    (record.reason === "ai_profile_catalog_read_failed" ||
      record.reason === "ai_profile_catalog_save_unconfirmed")
  )
    return Object.freeze({
      status: "valid",
      error: null,
      value: Object.freeze({
        status: "unknown",
        reason: record.reason,
        snapshot: null,
      }),
    });
  const observed = snapshotPlainRecord(
    record?.snapshot,
    new Set(["revision", "catalog"]),
  );
  if (
    !record ||
    !observed ||
    !Number.isSafeInteger(observed.revision) ||
    Number(observed.revision) < 0
  )
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_mutation_result_invalid",
    });
  const catalog = validateAiProfileCatalog(observed.catalog).value;
  if (!catalog)
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_mutation_result_invalid",
    });
  const revision = Number(observed.revision);
  const id =
    mutation.operation === "delete"
      ? mutation.profileId
      : mutation.profile.profileId;
  const target = catalog.profiles.find((item) => item.profileId === id);
  if (record.status === "completed") {
    const reason =
      mutation.operation === "create"
        ? "profile_created"
        : mutation.operation === "update"
          ? "profile_updated"
          : "profile_deleted";
    if (record.reason !== reason || revision !== mutation.expectedRevision + 1)
      return Object.freeze({
        status: "blocked",
        value: null,
        error: "ai_profile_mutation_result_invalid",
      });
    if (mutation.operation === "delete") {
      if (!mutation.confirmed || target)
        return Object.freeze({
          status: "blocked",
          value: null,
          error: "ai_profile_mutation_result_invalid",
        });
    } else {
      const profile = validateAiProfileDefinition(mutation.profile).value;
      if (
        !profile ||
        !target ||
        JSON.stringify(profile) !== JSON.stringify(target)
      )
        return Object.freeze({
          status: "blocked",
          value: null,
          error: "ai_profile_mutation_result_invalid",
        });
    }
  } else if (record.status === "rejected") {
    if (record.reason === "revision_conflict") {
      if (revision === mutation.expectedRevision)
        return Object.freeze({
          status: "blocked",
          value: null,
          error: "ai_profile_mutation_result_invalid",
        });
    } else {
      if (revision !== mutation.expectedRevision)
        return Object.freeze({
          status: "blocked",
          value: null,
          error: "ai_profile_mutation_result_invalid",
        });
      if (record.reason === "profile_already_exists") {
        if (mutation.operation !== "create" || !target)
          return Object.freeze({
            status: "blocked",
            value: null,
            error: "ai_profile_mutation_result_invalid",
          });
      } else if (record.reason === "profile_not_found") {
        if (mutation.operation === "create" || target)
          return Object.freeze({
            status: "blocked",
            value: null,
            error: "ai_profile_mutation_result_invalid",
          });
      } else if (record.reason === "profile_delete_confirmation_required") {
        if (mutation.operation !== "delete" || mutation.confirmed || !target)
          return Object.freeze({
            status: "blocked",
            value: null,
            error: "ai_profile_mutation_result_invalid",
          });
      } else if (record.reason === "catalog_invalid") {
        if (mutation.operation === "create" ? !!target : !target)
          return Object.freeze({
            status: "blocked",
            value: null,
            error: "ai_profile_mutation_result_invalid",
          });
        if (mutation.operation === "delete" && !mutation.confirmed)
          return Object.freeze({
            status: "blocked",
            value: null,
            error: "ai_profile_mutation_result_invalid",
          });
      } else
        return Object.freeze({
          status: "blocked",
          value: null,
          error: "ai_profile_mutation_result_invalid",
        });
    }
  } else
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_mutation_result_invalid",
    });
  return Object.freeze({
    status: "valid",
    error: null,
    value:
      record.status === "completed"
        ? Object.freeze({
            status: "completed",
            reason: record.reason as Extract<
              AiProfileCatalogMutationResult,
              { status: "completed" }
            >["reason"],
            snapshot: Object.freeze({ revision, catalog }),
          })
        : Object.freeze({
            status: "rejected",
            reason: record.reason as Extract<
              AiProfileCatalogMutationResult,
              { status: "rejected" }
            >["reason"],
            snapshot: Object.freeze({ revision, catalog }),
          }),
  });
}

/**
 * Owner別Catalog StoreへProfile限定の管理操作を接続する。
 *
 * @responsibility Profile Identity、操作種別、削除確認および改訂競合をCatalog全体の採用前に評価する。
 * @trace ARCH-000010
 * @input store: RepositoryまたはCROS Ownerの検証済みCatalog Store。
 * @returns 現在Snapshotの取得とProfile限定Mutationの実行操作。
 * @precondition storeは一つのOwnerに固定され、Snapshot採用を直列化する。
 * @postcondition completedは次Revisionの確認済み反映、rejectedはSnapshot不変更、unknownは保存済みの可能性を保持する。
 * @effect execute成功時にOwner別Catalog Snapshotを一件追加する。
 * @failure 操作条件不成立はrejected、読取り失敗又は保存確定不能はSnapshot欠測のunknownで返す。
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
 * @returns completed、理由付きrejected又はSnapshot欠測のunknown結果。
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
  const read = store.snapshot();
  if (read.status !== "read")
    return Object.freeze({
      status: "unknown",
      reason: "ai_profile_catalog_read_failed",
      snapshot: null,
    });
  const current = read.value;
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
        : current.catalog.profiles.toSpliced(index, 1);
  const candidate: AiProfileCatalog = {
    ...current.catalog,
    profiles,
  };
  const adoption = store.adopt({
    expectedRevision: mutation.expectedRevision,
    candidate,
  });
  if (adoption.status === "unknown")
    return Object.freeze({
      status: "unknown",
      reason: adoption.reason,
      snapshot: null,
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
  reason: Extract<
    AiProfileCatalogMutationResult,
    { status: "rejected" }
  >["reason"],
  snapshot: AiProfileCatalogSnapshot,
): AiProfileCatalogMutationResult {
  return Object.freeze({ status: "rejected", reason, snapshot });
}

/**
 * Profile管理入力を既存AI AdapterのMutationへ固定する。
 *
 * @responsibility 操作別fieldと構造を検査し、語彙検査を同じCatalog Ownerへ接続する。
 * @trace ARCH-000010
 * @input value: 未信頼の操作入力。
 * @returns validの所有済みMutation又は固定拒否理由付きのblocked結果。
 * @precondition N/A: 未信頼値を受け付ける。
 * @postcondition 操作、改訂、Profileまたは削除確認だけを保持する。
 * @effect N/A: Storeを呼ばない。
 * @failure 未知field、型またはProfile構造不正はblocked。
 * @invariant Modelの登録可否と改訂競合はCatalog管理が決定する。
 * @boundary HTTP／MCP入力とCatalog操作の境界。
 * @security Proxy／accessorと任意実行fieldを受理しない。
 * @concurrency 同期取得した値を固定する。
 */
export function parseAiProfileCatalogMutation(
  value: unknown,
): AiProfileMutationParseResult {
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
      status: "valid",
      error: null,
      value: Object.freeze({
        operation: "delete",
        expectedRevision: Number(deletion.expectedRevision),
        profileId: deletion.profileId,
        confirmed: deletion.confirmed,
      }),
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
    return Object.freeze({
      status: "blocked",
      value: null,
      error: "ai_profile_mutation_invalid",
    });
  const profile = validateAiProfileDefinition(change.profile).value;
  return profile === null
    ? Object.freeze({
        status: "blocked",
        value: null,
        error: "ai_profile_mutation_invalid",
      })
    : Object.freeze({
        status: "valid",
        error: null,
        value: Object.freeze({
          operation: change.operation as "create" | "update",
          expectedRevision: Number(change.expectedRevision),
          profile,
        }),
      });
}

/**
 * 期待改訂を伴うProfile作成・更新・確認付き削除の入力を表す。
 * @responsibility 期待改訂を伴うProfile作成・更新・確認付き削除の入力を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/crud.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileCatalogMutation =
  | Readonly<{
      operation: "create" | "update";
      expectedRevision: number;
      profile: AiProfileDefinition;
    }>
  | Readonly<{
      operation: "delete";
      expectedRevision: number;
      profileId: string;
      confirmed: boolean;
    }>;

/**
 * Profile操作の結果理由と操作後Snapshotを表す。
 * @responsibility Profile操作の結果理由と操作後Snapshotを表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/crud.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileCatalogMutationResult =
  | Readonly<{
      status: "unknown";
      reason:
        | "ai_profile_catalog_read_failed"
        | "ai_profile_catalog_save_unconfirmed";
      snapshot: null;
    }>
  | Readonly<{
      status: "completed";
      reason: "profile_created" | "profile_updated" | "profile_deleted";
      snapshot: AiProfileCatalogSnapshot;
    }>
  | Readonly<{
      status: "rejected";
      reason:
        | "profile_already_exists"
        | "profile_not_found"
        | "profile_delete_confirmation_required"
        | "catalog_invalid"
        | "revision_conflict";
      snapshot: AiProfileCatalogSnapshot;
    }>;

/**
 * Profile内容の取得と限定操作を利用側へ提供する契約を表す。
 * @responsibility Profile内容の取得と限定操作を利用側へ提供する契約を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/crud.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileCatalogAdministration = Readonly<{
  snapshot: AiProfileCatalogStore["snapshot"];
  execute: (
    mutation: AiProfileCatalogMutation,
  ) => AiProfileCatalogMutationResult;
}>;
/**
 * 管理入力の解析値又は固定拒否理由。
 * @responsibility 成功値と固定拒否理由又は観測不能を型で区別する。
 * @trace ARCH-000010
 * @shape 状態で値と欠測を絞り込める読取り専用の直和型。
 * @invariant 型だけで認証、実行、保存又は回収の成立を主張しない。
 * @boundary AI Profile APIと直接利用側の値契約。
 * @security 秘密値、内部Path及び操作Authorityを含めない。
 * @compatibility 通信Envelopeと保存Schemaを変更せず、内部戻り値だけを移行する。
 */
export type AiProfileMutationParseResult = Readonly<
  | { status: "valid"; value: AiProfileCatalogMutation; error: null }
  | { status: "blocked"; value: null; error: "ai_profile_mutation_invalid" }
>;
/**
 * 管理結果の相関確認値又は固定拒否理由。
 * @responsibility 成功値と固定拒否理由又は観測不能を型で区別する。
 * @trace ARCH-000010
 * @shape 状態で値と欠測を絞り込める読取り専用の直和型。
 * @invariant 型だけで認証、実行、保存又は回収の成立を主張しない。
 * @boundary AI Profile APIと直接利用側の値契約。
 * @security 秘密値、内部Path及び操作Authorityを含めない。
 * @compatibility 通信Envelopeと保存Schemaを変更せず、内部戻り値だけを移行する。
 */
export type AiProfileMutationValidationResult = Readonly<
  | { status: "valid"; value: AiProfileCatalogMutationResult; error: null }
  | {
      status: "blocked";
      value: null;
      error: "ai_profile_mutation_result_invalid";
    }
>;

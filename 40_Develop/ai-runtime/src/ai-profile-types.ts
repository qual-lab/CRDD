/**
 * AI Profile設定契約で使用する型を定義する。
 *
 * @responsibility Adapter、Profile、解決要求、利用可能性を閉じた型契約として所有する。
 * @trace ARCH-000010
 * @shape 設定値と実行時観測を混同しない型境界を固定する。
 * @invariant 秘密値、任意実行Path、任意CLI引数を設定型へ含めない。
 * @boundary AI Runtime公開境界と利用側の間のデータ契約。
 * @security Profile設定から実行AuthorityまたはCredentialを発行しない。
 * @compatibility contractRevisionごとに解釈可能なPropertyだけを公開する。
 */

export type AiProvider = "codex" | "claude";
export type AiSelectionRole =
  | "coordinator"
  | "executor"
  | "independent_reviewer"
  | "result_integration";
export type AiModelTier = "preferred" | "upper_allowed";
export type AiReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

export type AiAdapterDefinition = Readonly<{
  adapterId: string;
  provider: AiProvider;
  offering: "chatgpt_subscription_oauth" | "claude_max";
  authorityOrigin: string;
  allowedModelIds: readonly string[];
  allowedReasoningEfforts: readonly AiReasoningEffort[];
}>;

export type AiProfileDefinition = Readonly<{
  profileId: string;
  adapterId: string;
  family: string;
  exactModelId: string;
  selectionRoles: readonly AiSelectionRole[];
  modelTiers: readonly AiModelTier[];
  speedMode: "normal";
  billingMode: "subscription_oauth";
  defaultReasoningEffort: AiReasoningEffort;
  compatibilityReason: string | null;
}>;

export type AiProfileCatalog = Readonly<{
  contract: "crdd/ai-profile-catalog";
  contractRevision: 1;
  adapters: readonly AiAdapterDefinition[];
  profiles: readonly AiProfileDefinition[];
}>;

export type AiProfileResolutionRequest = Readonly<{
  provider: AiProvider;
  family: string;
  role: AiSelectionRole;
  modelTier: AiModelTier;
  speedMode: "normal";
  billingMode: "subscription_oauth";
}>;

export type ResolvedAiProfile = Readonly<
  AiProfileDefinition & {
    provider: AiProvider;
    offering: AiAdapterDefinition["offering"];
    authorityOrigin: string;
    allowedReasoningEfforts: readonly AiReasoningEffort[];
    selectionRole: AiSelectionRole;
    modelTier: AiModelTier;
  }
>;

export type ResolvedAiProfileIdentity = Readonly<
  AiProfileDefinition & {
    provider: AiProvider;
    offering: AiAdapterDefinition["offering"];
    authorityOrigin: string;
    allowedReasoningEfforts: readonly AiReasoningEffort[];
  }
>;

export type AiProfileAvailabilityObservation = Readonly<{
  adapterRegistered: boolean;
  hostAvailable: boolean | null;
  authenticated: boolean | null;
  executionAuthorized: boolean | null;
}>;

export type AiProfileAvailability = Readonly<
  AiProfileAvailabilityObservation & {
    status: "available" | "unavailable" | "unknown";
    reasons: readonly string[];
  }
>;

export type AiProfileCatalogSnapshot = Readonly<{
  revision: number;
  catalog: AiProfileCatalog;
}>;

export type AiProfileCatalogAdoptionRequest = Readonly<{
  expectedRevision: number;
  candidate: unknown;
}>;

export type AiProfileCatalogAdoptionResult =
  | Readonly<{
      status: "adopted";
      revision: number;
      snapshot: AiProfileCatalogSnapshot;
    }>
  | Readonly<{
      status: "rejected";
      reason: "catalog_invalid" | "revision_conflict";
      revision: number;
      snapshot: AiProfileCatalogSnapshot;
    }>;

export type AiProfileCatalogRegistry = Readonly<{
  snapshot: () => AiProfileCatalogSnapshot;
  adopt: (
    request: AiProfileCatalogAdoptionRequest,
  ) => AiProfileCatalogAdoptionResult;
}>;

export type AiProfileCatalogStore = Readonly<{
  snapshot: () => AiProfileCatalogSnapshot;
  adopt: (
    request: AiProfileCatalogAdoptionRequest,
  ) => AiProfileCatalogAdoptionResult;
}>;

export type AiProfileCatalogStoreAdapterResult = Readonly<
  | {
      status: "ready";
      reason: "ai_profile_catalog_store_ready";
      store: AiProfileCatalogStore;
    }
  | {
      status: "blocked";
      reason: "ai_profile_catalog_storage_root_invalid";
      store: null;
    }
>;

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

export type AiProfileCatalogMutationResult = Readonly<{
  status: "completed" | "rejected";
  reason:
    | "profile_created"
    | "profile_updated"
    | "profile_deleted"
    | "profile_already_exists"
    | "profile_not_found"
    | "profile_delete_confirmation_required"
    | "catalog_invalid"
    | "revision_conflict";
  snapshot: AiProfileCatalogSnapshot;
}>;

export type AiProfileCatalogAdministration = Readonly<{
  snapshot: () => AiProfileCatalogSnapshot;
  execute: (
    mutation: AiProfileCatalogMutation,
  ) => AiProfileCatalogMutationResult;
}>;

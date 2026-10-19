/**
 * Profileの定義・選択条件と解決値の型を定義する。
 *
 * @responsibility 実利用される値契約だけを所有し、実行・保存・認可を開始しない。
 * @trace ARCH-000010
 */
import type {
  AiProvider,
  AiReasoningEffort,
  AiAdapterDefinition,
} from "../provider/types.ts";
/**
 * Profileを利用する調整・実行・独立レビュー・結果統合の役割を表す。
 * @responsibility Profileを利用する調整・実行・独立レビュー・結果統合の役割を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiSelectionRole =
  | "coordinator"
  | "executor"
  | "independent_reviewer"
  | "result_integration";

/**
 * Profile選定で使う優先候補と上位許容候補の区分を表す。
 * @responsibility Profile選定で使う優先候補と上位許容候補の区分を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiModelTier = "preferred" | "upper_allowed";

/**
 * Model・用途・速度・課金・推論強度を束ねたProfile定義を表す。
 * @responsibility Model・用途・速度・課金・推論強度を束ねたProfile定義を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
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

/**
 * Provider・Family・Role・Tierで候補を検索する条件を表す。
 * @responsibility Provider・Family・Role・Tierで候補を検索する条件を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileResolutionRequest = Readonly<{
  provider: AiProvider;
  family: string;
  role: AiSelectionRole;
  modelTier: AiModelTier;
  speedMode: "normal";
  billingMode: "subscription_oauth";
}>;

/**
 * 検索条件と対応Adapterを結合した選択済みProfileを表す。
 * @responsibility 検索条件と対応Adapterを結合した選択済みProfileを表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
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

/**
 * 安定Profile IDから結合したProvider実行設定を表す。
 * @responsibility 安定Profile IDから結合したProvider実行設定を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type ResolvedAiProfileIdentity = Readonly<
  AiProfileDefinition & {
    provider: AiProvider;
    offering: AiAdapterDefinition["offering"];
    authorityOrigin: string;
    allowedReasoningEfforts: readonly AiReasoningEffort[];
  }
>;

/**
 * 登録・Host・認証・実行許可の四つの観測値を表す。
 * @responsibility 登録・Host・認証・実行許可の四つの観測値を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileAvailabilityObservation = Readonly<{
  adapterRegistered: boolean;
  hostAvailable: boolean | null;
  authenticated: boolean | null;
  executionAuthorized: boolean | null;
}>;

/**
 * 四軸の観測値と表示状態・理由を表す。
 * @responsibility 四軸の観測値と表示状態・理由を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary profile/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProfileAvailability = Readonly<
  AiProfileAvailabilityObservation & {
    status: "available" | "unavailable" | "unknown";
    reasons: readonly string[];
  }
>;

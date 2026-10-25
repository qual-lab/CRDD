/**
 * 技術CatalogのModel・用途・Effortと選定結果の型を定義する。
 *
 * @responsibility 実利用される値契約だけを所有し、実行・保存・認可を開始しない。
 * @trace ARCH-000010
 */
import type { AiProvider, AiReasoningEffort } from "../provider/types.ts";

/**
 * Model識別子と確認済みの実行対応を表す。
 * @responsibility 役割別の推奨ではなくProviderへ渡す識別子・用途・Effortの対応を保持する。
 * @trace ARCH-000010
 * @shape ProviderとModel識別子で一意となる不変値。
 * @invariant aliasを解決後の固定版とみなさず、用途とEffortの直積だけを対応範囲とする。
 * @boundary 技術カタログとRepository別AI選択。
 * @security 対応の宣言は認証・実行Authority・現在利用可能性ではない。
 * @compatibility 新形式のみを表し、旧Profileの役割・Tierを持たない。
 */
export type AiModelDefinition = Readonly<{
  provider: AiProvider;
  modelIdentifier: string;
  identifierKind: "exact" | "alias";
  supportedEfforts: readonly AiReasoningEffort[];
  supportedPurposes: readonly ("advice" | "task")[];
  compatibilityReason: "gpt_5_6_task_not_verified_in_current_runtime" | null;
}>;

/**
 * 選択可能な技術構成のカタログを表す。
 * @responsibility Provider・Model・用途・Effortの一意な技術正本を保持する。
 * @trace ARCH-000010
 * @shape 固定契約とModel定義集合。
 * @invariant 役割既定値・Tier・ログイン状態・Repository設定を含めない。
 * @boundary AI Adapterと選定利用側。
 * @security 秘密値・Host Path・操作許可を含めない。
 * @compatibility 旧Catalogはこの新形式として読まない。
 */
export type AiModelCatalog = Readonly<{
  contract: "crdd/ai-model-catalog";
  contractRevision: 1;
  models: readonly AiModelDefinition[];
}>;

/**
 * 一回の実行へ適用できる技術構成を表す。
 * @responsibility 選択した識別子の意味を用途・Effortとともに固定する。
 * @trace ARCH-000010
 * @shape Modelの識別方式と一つの用途・Effort。
 * @invariant Provider aliasをexactModelIdへ読み替えない。
 * @boundary 技術検証とCoordinatorの選定固定。
 * @security 値の妥当性だけで実行を許可しない。
 * @compatibility 新形式の実行選定値である。
 */
export type AiModelSelection = Readonly<{
  provider: AiProvider;
  modelIdentifier: string;
  identifierKind: "exact" | "alias";
  reasoningEffort: AiReasoningEffort;
  purpose: "advice" | "task";
}>;

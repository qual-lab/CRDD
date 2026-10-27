/**
 * Repository別AI選択設定の共有値契約。
 * @packageDocumentation
 * @responsibility 希望設定・役割・分類と内容Identityを所有し、技術Catalogや実行を所有しない。
 * @trace ARCH-000004
 * @boundary 秘密値・実行Authorityを含めない設定データ。
 */
/**
 * v0.22の固定した五つの作業上の役割。
 * @responsibility アクセス管理のロールとは異なるAIの担当を表す。
 * @trace ARCH-000004
 * @shape 五つのliteralの和。
 * @invariant ユーザー定義の作業分類を役割へ昇格しない。
 * @boundary Repository設定とTask計画。
 * @security 権限・認証・Tool許可ではない。
 * @compatibility 新形式の固定集合。
 */
export type AiSelectionRole =
  | "coordinator"
  | "executor"
  | "independent_reviewer"
  | "result_integration"
  | "advice";

/**
 * Repositoryが希望する一つのModelとEffort。
 * @responsibility 技術カタログを参照する値だけを保持する。
 * @trace ARCH-000004
 * @shape Provider、Model識別子、Effort。
 * @invariant 既定値やfallbackを内部に持たない。
 * @boundary 設定と技術検査。
 * @security CLI引数・Path・Secretを持たない。
 * @compatibility 新設定JSONの選択値。
 */
export type AiSelectionChoice = Readonly<{
  provider: "codex" | "claude";
  model: string;
  effort: "low" | "medium" | "high" | "xhigh" | "max";
}>;

/**
 * 五役割の既定値と任意分類・分類別上書きを保持する。
 * @responsibility Repositoryごとの希望を一つの設定正本へまとめる。
 * @trace ARCH-000004
 * @shape 固定契約、役割既定値、分類辞書、部分上書き辞書。
 * @invariant revisionはSchema版であり保存CAS世代ではない。
 * @boundary 設定保存と選定処理。
 * @security Authority・認証・外部送信同意を含めない。
 * @compatibility 旧Profile形式を含めない。
 */
export type AiSelectionConfig = Readonly<{
  contract: "crdd/ai-selection";
  revision: 1;
  roleDefaults: Readonly<Record<AiSelectionRole, AiSelectionChoice>>;
  workTypes: Readonly<Record<string, Readonly<{ label: string }>>>;
  overrides: Readonly<
    Partial<
      Record<AiSelectionRole, Readonly<Record<string, AiSelectionChoice>>>
    >
  >;
}>;

/**
 * 内容Identityとともに検証されたRepository設定。
 * @responsibility 書式差でなく意味が一致する設定を同じHashへ固定する。
 * @trace ARCH-000004
 * @shape 不変設定と正規化本文SHA-256。
 * @invariant 元入力の後発変更を含めない。
 * @boundary 設定読取り・CAS・Task選定。
 * @security Hashは認可又は署名ではない。
 * @compatibility 旧Profile改訂と同じ値へ読み替えない。
 */
export type AiSelectionSnapshot = Readonly<{
  config: AiSelectionConfig;
  identity: string;
}>;

/** 設定の参照検査に必要な、信頼したHostから渡す非秘密Catalog投影。 */
export type AiSelectionCatalog = Readonly<{
  models: readonly Readonly<{
    provider: AiSelectionChoice["provider"];
    modelIdentifier: string;
    supportedEfforts: readonly AiSelectionChoice["effort"][];
    supportedPurposes: readonly ("advice" | "task")[];
  }>[];
}>;

/**
 * 一つのTaskが使う編集担当と独立レビュー担当の固定選定。
 * @responsibility 複数stageが同じ受付時設定を共有する相関を所有する。
 * @trace ARCH-000004
 * @shape executorとreviewerの完全な選定値。
 * @invariant 設定・Catalog・作業分類が同じ組だけを受理する。
 * @boundary Objective・Task・Operationの値搬送と保存。
 * @security 同じProviderでも実行Contextの独立性は実行Ownerが別に保証する。
 * @compatibility 旧Profileや再選定を含めない。
 */
export type TaskExecutionSelections = Readonly<{
  executor: ExecutionSelection;
  reviewer: ExecutionSelection;
}>;

/**
 * 今回選ばれた技術構成と選定元。
 * @responsibility 具体構成・設定Identity・役割・分類を一つの不変結果へ固定する。
 * @trace ARCH-000004
 * @shape 技術選定と選定元の直和。
 * @invariant aliasを解決後の具体版へ変えず、進行中設定を再解釈しない。
 * @boundary 選定と実行・耐久記録。
 * @security 選定結果は実行Authorityではない。
 * @compatibility 新方式の実行入力である。
 */
export type ExecutionSelection = AiModelSelection &
  Readonly<{
    catalogIdentity: string;
    configIdentity: string;
    role: AiSelectionRole;
    workType: string | null;
    source: "explicit" | "work_type_override" | "role_default";
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
/**
 * Provider識別子・推論強度と実行位置の共有型を定義する。
 *
 * @responsibility 実利用される値契約だけを所有し、実行・保存・認可を開始しない。
 * @trace ARCH-000010
 */

/**
 * 対応するCodex／Claudeの識別値を表す。
 * @responsibility 対応するCodex／Claudeの識別値を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary provider/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiProvider = "codex" | "claude";

/**
 * Catalogで選択可能な推論強度の値を表す。
 * @responsibility Catalogで選択可能な推論強度の値を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary provider/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiReasoningEffort = "low" | "medium" | "high" | "xhigh" | "max";

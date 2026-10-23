/**
 * Repository別AI選択と一回の選定結果を表す。
 * @responsibility 役割・作業分類・設定優先順位の値契約だけを所有する。
 * @trace ARCH-000004
 * @boundary Repository設定とCoordinatorの実行準備。
 * @effect N/A: 型宣言だけ。
 * @security 役割・分類から実行Authorityを発行しない。
 */
import type {
  AiModelSelection,
  AiProvider,
  AiReasoningEffort,
} from "../../../ai-adapter/src/index.ts";

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
  provider: AiProvider;
  model: string;
  effort: AiReasoningEffort;
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

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

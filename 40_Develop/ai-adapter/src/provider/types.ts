/**
 * Provider・Model選定・結果診断・実行位置の共有値契約を定義する。
 * @packageDocumentation
 * @responsibility 技術値の型だけを所有し、保存・認可・起動は行わない。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @boundary AI Adapterと技術仕様を使う利用側の型境界。
 */

/**
 * CLI引数生成へ信頼した構成側が渡す実行位置を表す。
 * @responsibility CLIの配置値だけを受け、Image・Mount・起動許可を持たない。
 * @trace ARCH-000010
 * @shape 任意の実行Path・作業位置・Provider Home・Schema／設定位置。
 * @invariant 省略時はCLI名と相対ファイル名による記述であり実行許可ではない。
 * @boundary 構成OwnerとProvider固有の引数生成。
 * @security Catalog・外部要求から任意Pathを受付ける契約ではない。
 * @compatibility 配置方式・OS・Containerに依存しない値契約。
 */
export type ProviderExecutionLocations = Readonly<{
  commandPath?: string;
  workingDirectory?: string;
  providerHomeDirectory?: string;
  resultSchemaPath?: string;
  executorSchemaPath?: string;
  reviewerSchemaPath?: string;
  taskSettingsPath?: string;
  managedSettingsPath?: string;
}>;

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
 * 拒否したTurn metadataの有無・型・有限数値だけを表す。
 * @responsibility 未信頼文字列・Object本文を診断へ複製しない。
 * @trace ARCH-000015
 * @shape 欠落を区別する固定型名と、有限数値を正規化した短い文字列表記又はnull。
 * @invariant 観測値は受理判定や実行許可を変更しない。
 * @boundary Provider出力の抽出と上位の一次失敗診断。
 * @security 数値以外の実値・生Envelopeを含めない。
 * @compatibility 既存結果への任意の診断追加。
 */
export type ProviderTurnCountDiagnostic = Readonly<{
  valueType:
    | "missing"
    | "null"
    | "boolean"
    | "number"
    | "string"
    | "array"
    | "object";
  numberText: string | null;
}>;

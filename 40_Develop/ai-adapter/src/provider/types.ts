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

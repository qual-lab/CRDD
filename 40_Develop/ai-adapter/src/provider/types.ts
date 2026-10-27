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

/**
 * 履歴保持設定と読取り結果の値契約。
 * @responsibility 履歴保持設定と読取り結果の値契約だけを所有する。
 * @trace ARCH-000011
 */
/**
 * 一つのツール所有者の期間設定を固定する。
 * @responsibility 非秘密の期間だけを収集する。
 * @trace ARCH-000011
 * @shape schemaRevisionとhistoryRetentionDays。
 * @invariant 期間は正の安全な整数でミリ秒変換できる。
 * @boundary Repository設定。
 * @security AuthorityやPathを含めない。
 * @compatibility 設定File不存在だけ30日、存在するFileは全Property必須。
 */
export type ToolRuntimeConfig = Readonly<{
  schemaRevision: 1;
  historyRetentionDays: number;
}>;

/**
 * 設定の観測成功と停止を区別する。
 * @responsibility 不正設定を既定値へ畳まない。
 * @trace ARCH-000011
 * @shape readyはsourceとconfig、blockedはreason。
 * @invariant blockedは期間を返さない。
 * @boundary 設定読取りの公開結果。
 * @security 設定本文とPathを失敗理由へ複製しない。
 * @compatibility 不存在だけがdefaultとなる。
 */
export type ToolRuntimeConfigResult =
  | Readonly<{
      status: "ready";
      source: "default" | "file";
      config: ToolRuntimeConfig;
    }>
  | Readonly<{ status: "blocked"; reason: "tool_runtime_config_invalid" }>;

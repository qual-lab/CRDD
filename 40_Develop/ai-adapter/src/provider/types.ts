/**
 * Providerと登録Adapterの共有型を定義する。
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
 * Provider・Offeringと許可Model／推論強度の登録定義を表す。
 * @responsibility Provider・Offeringと許可Model／推論強度の登録定義を表すが、実行・保存・認可の成立を型だけでは保証しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyとliteral値を持つ読取り専用契約。
 * @invariant 改訂・選択・観測の意味は呼出し元と処理Ownerで照合する。
 * @boundary provider/types.tsと既存公開API利用側の値契約。
 * @security 秘密値や操作Authorityを発行しない。
 * @compatibility 既存の型名・Property・値域を維持する。
 */
export type AiAdapterDefinition = Readonly<{
  adapterId: string;
  provider: AiProvider;
  offering: "chatgpt_subscription_oauth" | "claude_max";
  authorityOrigin: string;
  allowedModelIds: readonly string[];
  allowedReasoningEfforts: readonly AiReasoningEffort[];
}>;

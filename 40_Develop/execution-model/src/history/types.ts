/**
 * 実行履歴・記録退役の保存値と操作契約を定義する。
 * @responsibility 保存Schemaを変更せず、完成操作と検査が共有する型の正本を持つ。
 * @trace ARCH-000008
 */

/**
 * 終了要約の固定値を定義する。
 *
 * @responsibility 自由記述を持たない履歴の値契約を所有する。
 * @trace ARCH-000004
 * @shape id、occurredAt、outcome、primaryFailure、cleanup。
 * @invariant 制御状態やAuthorityを含まない。
 * @boundary 履歴保存境界。
 * @security Prompt、秘密値、Pathを許可しない。
 * @compatibility 試行契約であり現在のPortを置換しない。
 */
export type HistoryRow = Readonly<{
  id: string;
  occurredAt: string;
  outcome: "completed" | "failed" | "cancelled";
  primaryFailure:
    | null
    | "execution"
    | "storage"
    | "delivery"
    | "cleanup"
    | "cancel";
  cleanup: "confirmed" | "unknown" | "not_required";
}>;

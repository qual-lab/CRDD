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

/**
 * 全行Decoderが検査した履歴本文と相関値。
 * @responsibility 元行と行Hash・要約Hash・任意の保持期限を同じ履歴Ownerで保持する。
 * @trace ARCH-000008
 * @invariant 実保存又は回復Authorityの証明にはしない。
 */
export type HistoryEntry = Readonly<{
  line: string;
  occurredAt: string;
  recoveryId: string;
  lineSha256: string;
  summarySha256: string;
  reviewAfter?: string;
}>;

/**
 * 同じ現在Stateが参照する履歴と必須行の照合条件。
 * @responsibility Stateの参照投影をHistoryの保持規則へ渡す内部値契約。
 * @trace ARCH-000008
 * @invariant requiredRowsはconfirmedによらず全件照合する。
 */
export type HistoryRetentionReferences = Readonly<{
  protectedRecoveries: ReadonlySet<string>;
  requiredRows: readonly Readonly<{
    recoveryId: string;
    lineSha256: string;
    summarySha256: string | null;
  }>[];
}>;

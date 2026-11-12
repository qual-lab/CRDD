/**
 * 保持日数設定の閉形式・数値検査。
 * @responsibility 設定固有の値・検査・操作を所有する。
 * @trace ARCH-000011
 */
const DAY_MS = 86_400_000;

/**
 * Propertyの過不足を拒否する。
 * @responsibility JSON値の閉集合を確認する。
 * @trace ARCH-000011
 * @input JSON値と必須Property集合。
 * @returns 検証済みObject。
 * @precondition 未検証のJSON値。
 * @postcondition 全Keyが一致する。
 * @effect N/A: 局所値のみ。
 * @failure 不一致で例外。
 * @invariant 未知Propertyを無視しない。
 * @boundary JSON入力。
 * @security 許可外設定を採用しない。
 * @concurrency N/A: 同期処理。
 */
export function closed(
  value: unknown,
  keys: readonly string[],
): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("shape");
  const record = value as Record<string, unknown>;
  if (
    JSON.stringify(Object.keys(record).sort()) !==
    JSON.stringify([...keys].sort())
  )
    throw new Error("keys");
  return record;
}

/**
 * 期間を安全なミリ秒へ変換できる正整数として確認する。
 * @responsibility 数値の意味を固定する。
 * @trace ARCH-000011
 * @input ComponentのJSON値。
 * @returns 不変の期間設定。
 * @precondition 未検証値。
 * @postcondition 期間は正の安全な整数。
 * @effect N/A: 局所値のみ。
 * @failure 不正値で例外。
 * @invariant 任意の件数上限を期間へ持ち込まない。
 * @boundary 設定値。
 * @security 不正値を既定値にしない。
 * @concurrency N/A: 同期処理。
 */
export function component(value: unknown) {
  const days = value;
  if (
    typeof days !== "number" ||
    !Number.isSafeInteger(days) ||
    days <= 0 ||
    !Number.isSafeInteger(days * DAY_MS)
  )
    throw new Error("days");
  return days;
}

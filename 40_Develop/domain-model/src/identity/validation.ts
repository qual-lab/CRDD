/**
 * 要求主体IDの値契約だけを所有する。
 * @responsibility AM等の既存IDと明示したローカルメール主体を検査する。
 * @trace ARCH-000004
 * @boundary 入力値だけ。認証・OS観測・設定取得・永続化を行わない。
 */
const LOCAL_EMAIL_PREFIX = "local.email.";

/** 明示メールからローカル主体IDを組み立てる。本人認証や正規化は行わない。 */
export function createLocalPrincipalId(email: unknown): string | null {
  if (
    typeof email !== "string" ||
    email.length > 254 ||
    !/^[^\s@<>\\\u0000-\u001f\u007f]+@[^\s@<>\\\u0000-\u001f\u007f]+$/u.test(
      email,
    )
  )
    return null;
  return `${LOCAL_EMAIL_PREFIX}${email}`;
}

/** 主体の形式だけを確認する。予約prefixから既存形式へfallbackしない。 */
export function isPrincipalId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.startsWith(LOCAL_EMAIL_PREFIX))
    return (
      createLocalPrincipalId(value.slice(LOCAL_EMAIL_PREFIX.length)) === value
    );
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value);
}

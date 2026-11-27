/**
 * 廃止済み接続鍵の拒否・旧状態保全を検証する合成入力。
 * @boundary テスト専用。製品入口・実資格・既存保存先には接続しない。
 */
import crypto from "node:crypto";

/** 旧照合値に対応する一時的な試験用鍵と旧フィールドを作る。 */
export function createRetiredCredentialFixture() {
  const credentialId = crypto.randomBytes(12).toString("hex");
  const secret = crypto.randomBytes(32).toString("base64url");
  const salt = crypto.randomBytes(16);
  const tokenVerifier = crypto
    .scryptSync(secret, salt, 32, { N: 16_384, r: 8, p: 1, maxmem: 33_554_432 })
    .toString("hex");
  return Object.freeze({
    credentialId,
    tokenSalt: salt.toString("hex"),
    tokenVerifier,
    token: `cros.v1.${credentialId}.${secret}`,
  });
}

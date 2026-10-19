/**
 * 鍵材料の生成・形式読取り・Verifier照合を所有する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import crypto from "node:crypto";
import type { AccessManagementState } from "../storage/types.ts";
import type { CredentialMaterial } from "./types.ts";

const PREFIX = "cros.v1";

const SCRYPT_OPTIONS = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 33554432,
});

const ID = /^[0-9a-f]{24}$/u;

const SALT = /^[0-9a-f]{32}$/u;

const VERIFIER = /^[0-9a-f]{64}$/u;

const SECRET = /^[A-Za-z0-9_-]{43}$/u;

/**
 * 固定scryptで秘密値の照合値を導出する。
 * @responsibility Nodeの暗黙既定値ではなく採用済みパラメータへ結合する。
 * @trace ARCH-000013
 * @input 32byteのbase64url Secretと16byteのhex salt。
 * @returns 32byteの照合値。
 * @precondition 呼出側が固定生成形式または厳密形式検査を済ませる。
 * @postcondition 入力を保存・変更しない。
 * @effect N/A: 同期CPU計算のみ。
 * @failure 暗号Runtime例外は発行側へ伝播し、照合側は拒否へ閉じる。
 * @invariant N16384/r8/p1/maxmem33554432と32byte出力を固定する。
 * @boundary Node crypto。
 * @security Secretは返値に含めない。
 * @concurrency N/A: 共有状態なし。
 */
function deriveVerifier(secret: string, salt: string): Buffer {
  return crypto.scryptSync(
    secret,
    Buffer.from(salt, "hex"),
    32,
    SCRYPT_OPTIONS,
  );
}

/**
 * 保存前の短命鍵と照合値を一回生成する。
 * @responsibility ID・Secret・saltの乱数生成を既存方式へ合わせる。
 * @trace ARCH-000013
 * @input N/A: 内部発行Ownerだけが呼ぶ。
 * @returns 一回配送用鍵と保存用照合値。
 * @precondition 呼出側が現在認可・対象・期待改訂・容量を確認済み。
 * @postcondition 保存・発行確定・配送成功を主張しない。
 * @effect Node暗号乱数を12/32/16byte生成する。
 * @failure 乱数・KDF故障は呼出側で段階別未完了にする。
 * @invariant Role・Grant・期限・履歴・資格別権限を生成しない。
 * @boundary AM内部発行準備とNode crypto。
 * @security 生鍵は短命メモリだけに保持する。
 * @concurrency 保存Ownerの既存Lock内で呼ぶ。独自Lockは作らない。
 */
export function createCredentialMaterial(): CredentialMaterial {
  const credentialId = crypto.randomBytes(12).toString("hex");
  const secret = crypto.randomBytes(32).toString("base64url");
  const tokenSalt = crypto.randomBytes(16).toString("hex");
  const tokenVerifier = deriveVerifier(secret, tokenSalt).toString("hex");
  return Object.freeze({
    credentialId,
    tokenSalt,
    tokenVerifier,
    token: `${PREFIX}.${credentialId}.${secret}`,
  });
}

/**
 * 外部入力の鍵から非秘密の資格IDだけを読む。
 * @responsibility 厳密な発行形式を検査してから資格検索へ渡す。
 * @trace ARCH-000013
 * @input 信頼しないtoken文字列。
 * @returns 固定24hexの資格ID、またはnull。
 * @precondition N/A: primitive型も検査する。
 * @postcondition 不正入力では暗号計算・暗黙変換を行わない。
 * @effect N/A: メモリ内検査だけ。
 * @failure 不正prefix・長さ・文字・区切り・非canonical Secretはnull。
 * @invariant IDは認証・Authorityではない。
 * @boundary Bearer入力と内部資格検索。
 * @security Secret・存在有無・資格状態を返さない。
 * @concurrency N/A: 共有状態なし。
 */
export function readCredentialId(token: string): string | null {
  if (typeof token !== "string" || token.length !== 76) return null;
  const parts = token.split(".");
  const id = parts[2];
  const secret = parts[3];
  if (
    parts.length !== 4 ||
    `${parts[0]}.${parts[1]}` !== PREFIX ||
    !id ||
    !ID.test(id) ||
    !secret ||
    !SECRET.test(secret)
  )
    return null;
  const decoded = Buffer.from(secret, "base64url");
  return decoded.length === 32 && decoded.toString("base64url") === secret
    ? id
    : null;
}

/**
 * 鍵を一つの保存済み照合値へ照合する。
 * @responsibility 資格の実在・失効・User・Role認可とは別に秘密一致だけを判定する。
 * @trace ARCH-000013
 * @input tokenと検査済みSnapshotから取り出した資格照合field。
 * @returns 固定形式・同ID・Secret一致の場合だけtrue。
 * @precondition recordは内部Schema検査済みの所有JSON値。
 * @postcondition 入力・保存状態を変更しない。
 * @effect 固定scryptと同長byteのtimingSafeEqualだけ。
 * @failure 不正形式・不一致・暗号故障はfalse。
 * @invariant trueから資格有効・認可・配送を推定しない。
 * @boundary Node暗号Runtimeと内部認証Owner。
 * @security 比較前にsalt／Verifier長を検査し、秘密値を公開しない。
 * @concurrency N/A: 保存・共有状態を所有しない。
 */
export function verifyCredentialToken(
  token: string,
  record: Pick<
    AccessManagementState["credentials"][number],
    "credentialId" | "tokenSalt" | "tokenVerifier"
  >,
): boolean {
  try {
    if (
      readCredentialId(token) !== record.credentialId ||
      !ID.test(record.credentialId) ||
      !SALT.test(record.tokenSalt) ||
      !VERIFIER.test(record.tokenVerifier)
    )
      return false;
    const secret = token.split(".")[3];
    if (!secret) return false;
    const actual = deriveVerifier(secret, record.tokenSalt);
    const expected = Buffer.from(record.tokenVerifier, "hex");
    return (
      actual.length === expected.length &&
      crypto.timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

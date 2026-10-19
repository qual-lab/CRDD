/**
 * 固定鍵生成方式とNode暗号境界を検証する。
 * @packageDocumentation
 * @responsibility 技術照合の成功を保存・認可・配送成立と分離する。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @level IT
 * @scope access-management/credential、生成形式・KDF・拒否
 * @boundary Node crypto。実Host・実鍵・保存・外部通信なし。
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  createCredentialMaterial,
  readCredentialId,
  verifyCredentialToken,
} from "../../../src/credential/token.ts";

/**
 * 固定乱数で旧方式と明示KDFの一致を確認する。
 * @responsibility 旧暗黙既定と新固定optionsを比較し形式を実測する。
 * @trace RFD-IT-017
 * @precondition 非秘密の固定fixtureだけを使用する。
 * @stimulus 12/32/16byteの固定生成値で一回生成・照合する。
 * @observation 乱数要求長・scrypt options・旧方式とのbyte一致。
 * @oracle cros.v1形式と旧方式に一致し、保存・配送は行わない。
 * @cleanup Node関数差替えを必ず復元する。
 * @boundary Node crypto直接境界。
 */
test("固定鍵形式と旧scrypt方式に一致する", () => {
  const random = crypto.randomBytes;
  const scrypt = crypto.scryptSync;
  const lengths: number[] = [];
  const options: unknown[] = [];
  const secret = Buffer.alloc(32, 32).toString("base64url");
  const salt = Buffer.alloc(16, 16).toString("hex");
  const legacy = scrypt(secret, Buffer.from(salt, "hex"), 32).toString("hex");
  assert.equal(
    legacy,
    "16efaa95dab9304b35e9ad63e97cd2dcd4987d4caa2a03ee975054eeb95dacd5",
  );
  crypto.randomBytes = ((size: number) => {
    lengths.push(size);
    return Buffer.alloc(size, size);
  }) as typeof crypto.randomBytes;
  crypto.scryptSync = (password, inputSalt, length, option) => {
    options.push(option);
    return scrypt(password, inputSalt, length, option);
  };
  try {
    const result = createCredentialMaterial();
    assert.deepEqual(lengths, [12, 32, 16]);
    assert.equal(result.credentialId, Buffer.alloc(12, 12).toString("hex"));
    assert.equal(result.tokenSalt, salt);
    assert.equal(result.tokenVerifier, legacy);
    assert.equal(result.token, `cros.v1.${result.credentialId}.${secret}`);
    assert.equal(readCredentialId(result.token), result.credentialId);
    assert.equal(verifyCredentialToken(result.token, result), true);
    assert.ok(
      options.every(
        (option) =>
          JSON.stringify(option) ===
          JSON.stringify({ N: 16384, r: 8, p: 1, maxmem: 33554432 }),
      ),
    );
    assert.equal(options.length, 2);
  } finally {
    crypto.randomBytes = random;
    crypto.scryptSync = scrypt;
  }
});

/**
 * 不正形式を暗号計算前に拒否し不一致・故障を閉じる。
 * @responsibility 長さ違いを比較へ渡さず、暗黙変換を実行しない。
 * @trace RFD-IT-017
 * @trace RFD-IT-018
 * @precondition Process内で生成した自己試験鍵を使用する。
 * @stimulus prefix・ID・Secret・salt・Verifierを改変しRuntime故障を注入する。
 * @observation KDF・比較呼出件数とboolean結果。
 * @oracle 不正形式はKDF/比較0。不一致・暗号故障はfalse、秘密値出力0。
 * @cleanup 差替えを復元し、外部作成物は持たない。
 * @boundary Node cryptoと未信頼token入力。
 */
test("不正鍵はKDF前拒否し不一致と暗号故障を成功にしない", () => {
  const material = createCredentialMaterial();
  const scrypt = crypto.scryptSync;
  const compare = crypto.timingSafeEqual;
  let derivations = 0;
  let comparisons = 0;
  crypto.scryptSync = (password, salt, length, options) => {
    derivations++;
    return scrypt(password, salt, length, options);
  };
  crypto.timingSafeEqual = (a, b) => {
    comparisons++;
    return compare(a, b);
  };
  try {
    for (const token of [
      "",
      material.token.replace("cros.v1", "cros.v2"),
      `${material.token}.x`,
      material.token.slice(0, -1),
      material.token.toUpperCase(),
      {},
    ]) {
      assert.equal(readCredentialId(token as string), null);
      assert.equal(verifyCredentialToken(token as string, material), false);
      assert.equal(derivations, 0);
      assert.equal(comparisons, 0);
    }
    for (const record of [
      { ...material, tokenSalt: "0" },
      { ...material, tokenVerifier: "0" },
      { ...material, tokenSalt: "g".repeat(32) },
      { ...material, tokenVerifier: "g".repeat(64) },
      { ...material, credentialId: "0".repeat(24) },
    ]) {
      assert.equal(verifyCredentialToken(material.token, record), false);
      assert.equal(derivations, 0);
      assert.equal(comparisons, 0);
    }
    const wrong = `cros.v1.${material.credentialId}.${Buffer.alloc(32, 0).toString("base64url")}`;
    assert.equal(verifyCredentialToken(wrong, material), false);
    assert.equal(derivations, 1);
    assert.equal(comparisons, 1);
    crypto.scryptSync = () => {
      throw new Error("injected");
    };
    assert.equal(verifyCredentialToken(material.token, material), false);
  } finally {
    crypto.scryptSync = scrypt;
    crypto.timingSafeEqual = compare;
  }
});

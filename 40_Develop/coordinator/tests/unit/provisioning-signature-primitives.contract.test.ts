/**
 * coordinator:unit:provisioning-signature-primitivesの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:provisioning-signature-primitivesが所有する検証責務を実行する。
 * @trace AIT-UT-011
 * @level UT
 * @scope provisioning、signature、primitives
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";

import {
  PROVISIONING_SIGNATURE_INPUT_LIMITS,
  canonicalizeProvisioningJsonValueCandidate,
  describeProvisioningSignaturePrimitivesContract,
  inspectProvisioningEd25519SpkiCandidate,
  inspectProvisioningP256SpkiCandidate,
  verifyProvisioningEd25519Base64urlCandidate,
  verifyProvisioningEd25519PrimitiveCandidate,
  verifyProvisioningP256Base64urlCandidate,
} from "../../src/security/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate } from "../support/test-support.ts";

const RFC_8032_PUBLIC_KEY =
  "d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a";
const RFC_8032_SIGNATURE =
  "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155" +
  "5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b";
const ED25519_SPKI_PREFIX = "302a300506032b6570032100";
const P256_ORDER = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);

/**
 * lowSP256のTest準備責務を実行する。
 *
 * @responsibility lowSP256がTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-011
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus lowSP256を呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
function lowSP256(signature: Uint8Array) {
  const result = Buffer.from(signature);
  const s = BigInt(`0x${result.subarray(32).toString("hex")}`);
  if (s > P256_ORDER >> 1n) {
    const normalized = (P256_ORDER - s).toString(16).padStart(64, "0");
    Buffer.from(normalized, "hex").copy(result, 32);
  }
  return result;
}

/**
 * spkiのTest準備責務を実行する。
 *
 * @responsibility spkiがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-UT-011
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus spkiを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
function spki() {
  return Buffer.from(`${ED25519_SPKI_PREFIX}${RFC_8032_PUBLIC_KEY}`, "hex");
}

/**
 * RFC 8785のprimitive、再帰sortおよびUnicode非正規化を固定するを検証する。
 *
 * @responsibility RFC 8785のprimitive、再帰sortおよびUnicode非正規化を固定するの合否判定を所有する。
 * @trace AIT-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RFC 8785のprimitive、再帰sortおよびUnicode非正規化を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
test("RFC 8785のprimitive、再帰sortおよびUnicode非正規化を固定する", () => {
  const result = canonicalizeProvisioningJsonValueCandidate({
    numbers: [
      333333333.33333329, 1e30, 4.5, 2e-3, 0.000000000000000000000000001,
    ],
    string: '€$\u000f\nA\'B"\\"/',
    literals: [null, true, false],
  });
  assertCanonicalCandidate(result);
  assert.equal(
    result.canonicalBytes.toString("utf8"),
    '{"literals":[null,true,false],"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],' +
      '"string":"€$\\u000f\\nA\'B\\"\\\\\\"/"}',
  );

  const sorted = canonicalizeProvisioningJsonValueCandidate({
    "€": "Euro Sign",
    "\r": "Carriage Return",
    דּ: "Hebrew Letter Dalet With Dagesh",
    "1": "One",
    "😀": "Emoji: Grinning Face",
    "\u0080": "Control",
    ö: "Latin Small Letter O With Diaeresis",
  });
  assertCanonicalCandidate(sorted);
  assert.equal(
    sorted.canonicalBytes.toString("utf8"),
    '{"\\r":"Carriage Return","1":"One","":"Control","ö":"Latin Small Letter O With Diaeresis","€":"Euro Sign","😀":"Emoji: Grinning Face","דּ":"Hebrew Letter Dalet With Dagesh"}',
  );
  const composed = canonicalizeProvisioningJsonValueCandidate({ value: "é" });
  const decomposed = canonicalizeProvisioningJsonValueCandidate({
    value: "e\u0301",
  });
  assertCanonicalCandidate(composed);
  assertCanonicalCandidate(decomposed);
  assert.notEqual(composed.canonicalHash, decomposed.canonicalHash);
});

/**
 * JCS値Coreは非plain、動的入力、循環、lone surrogate、非有限数とbudget超過を拒否するを検証する。
 *
 * @responsibility JCS値Coreは非plain、動的入力、循環、lone surrogate、非有限数とbudget超過を拒否するの合否判定を所有する。
 * @trace AIT-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus JCS値Coreは非plain、動的入力、循環、lone surrogate、非有限数とbudget超過を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
test("JCS値Coreは非plain、動的入力、循環、lone surrogate、非有限数とbudget超過を拒否する", () => {
  let getterCalls = 0;
  const accessor = {};
  Object.defineProperty(accessor, "value", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return "x";
    },
  });
  let proxyCalls = 0;
  const raw = { value: "x" };
  const proxy = new Proxy(raw, {
    ownKeys() {
      proxyCalls += 1;
      return ["value"];
    },
  });
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  const symbol = Object.assign({ value: "x" }, { [Symbol("extra")]: true });
  for (const value of [
    accessor,
    proxy,
    cycle,
    symbol,
    Object.assign(Object.create({}), { value: "x" }),
    { value: "\ud800" },
    { value: Number.NaN },
    { value: Infinity },
    { value: 1n },
    { value: "x".repeat(PROVISIONING_SIGNATURE_INPUT_LIMITS.stringBytes + 1) },
    ["x".repeat(60_000), "y".repeat(60_000), "z".repeat(60_000)],
  ])
    assert.equal(
      canonicalizeProvisioningJsonValueCandidate(value).status,
      "blocked",
    );
  assert.equal(getterCalls, 0);
  assert.equal(proxyCalls, 0);
});

/**
 * JCS値Coreは循環だけを拒否し非循環の共有参照を出現ごとに展開するを検証する。
 *
 * @responsibility JCS値Coreは循環だけを拒否し非循環の共有参照を出現ごとに展開するの合否判定を所有する。
 * @trace AIT-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus JCS値Coreは循環だけを拒否し非循環の共有参照を出現ごとに展開するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
test("JCS値Coreは循環だけを拒否し非循環の共有参照を出現ごとに展開する", () => {
  const sharedObject = Object.assign(Object.create(null), { x: 1 });
  const sharedValues = [sharedObject, 2];
  const aliased = {
    objectLeft: sharedObject,
    objectRight: sharedObject,
    arrayLeft: sharedValues,
    arrayRight: sharedValues,
  };
  const duplicated = {
    objectLeft: Object.assign(Object.create(null), { x: 1 }),
    objectRight: Object.assign(Object.create(null), { x: 1 }),
    arrayLeft: [Object.assign(Object.create(null), { x: 1 }), 2],
    arrayRight: [Object.assign(Object.create(null), { x: 1 }), 2],
  };
  const aliasResult = canonicalizeProvisioningJsonValueCandidate(aliased);
  const duplicateResult =
    canonicalizeProvisioningJsonValueCandidate(duplicated);
  assertCanonicalCandidate(aliasResult);
  assertCanonicalCandidate(duplicateResult);
  assert.equal(
    Buffer.compare(aliasResult.canonicalBytes, duplicateResult.canonicalBytes),
    0,
  );
  assert.equal(aliasResult.canonicalHash, duplicateResult.canonicalHash);

  const indirectObject: Record<string, unknown> = {};
  const indirectValues = [indirectObject];
  indirectObject.back = indirectValues;
  assert.equal(
    canonicalizeProvisioningJsonValueCandidate(indirectObject).status,
    "blocked",
  );

  const repeated = { value: null };
  const withinNodeBudgetAliases = Array(2_047).fill(repeated);
  const beyondNodeBudgetAliases = Array(2_048).fill(repeated);
  assert.equal(
    withinNodeBudgetAliases.length < PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes,
    true,
  );
  assert.equal(
    beyondNodeBudgetAliases.length < PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes,
    true,
  );
  assert.equal(
    withinNodeBudgetAliases.every((item) => item === repeated),
    true,
  );
  assert.equal(
    beyondNodeBudgetAliases.every((item) => item === repeated),
    true,
  );
  assert.equal(
    canonicalizeProvisioningJsonValueCandidate(withinNodeBudgetAliases).status,
    "candidate",
  );
  assert.equal(
    canonicalizeProvisioningJsonValueCandidate(beyondNodeBudgetAliases).reason,
    "provisioning_jcs_budget_exceeded",
  );
});

/**
 * JCSはnodeとcanonical byteの境界を全descriptor展開と巨大token生成より前に閉じるを検証する。
 *
 * @responsibility JCSはnodeとcanonical byteの境界を全descriptor展開と巨大token生成より前に閉じるの合否判定を所有する。
 * @trace AIT-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus JCSはnodeとcanonical byteの境界を全descriptor展開と巨大token生成より前に閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
test("JCSはnodeとcanonical byteの境界を全descriptor展開と巨大token生成より前に閉じる", () => {
  const maximumObject: Record<string, null> = {};
  for (
    let index = 0;
    index < PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes - 1;
    index += 1
  ) {
    maximumObject[`p${String(index).padStart(4, "0")}`] = null;
  }
  assert.equal(
    canonicalizeProvisioningJsonValueCandidate(maximumObject).status,
    "candidate",
  );
  maximumObject.overflow = null;
  assert.equal(
    canonicalizeProvisioningJsonValueCandidate(maximumObject).reason,
    "provisioning_jcs_budget_exceeded",
  );

  assert.equal(
    canonicalizeProvisioningJsonValueCandidate(
      Array(PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes - 1).fill(null),
    ).status,
    "candidate",
  );
  assert.equal(
    canonicalizeProvisioningJsonValueCandidate(
      Array(PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes).fill(null),
    ).reason,
    "provisioning_jcs_budget_exceeded",
  );
  const sparseValues: unknown[] = [];
  sparseValues.length = PROVISIONING_SIGNATURE_INPUT_LIMITS.nodes - 1;
  assert.equal(
    canonicalizeProvisioningJsonValueCandidate(sparseValues).status,
    "blocked",
  );

  const exact = canonicalizeProvisioningJsonValueCandidate({
    a: "x".repeat(65_536),
    b: "y".repeat(65_521),
  });
  assertCanonicalCandidate(exact);
  assert.equal(
    exact.canonicalBytes.length,
    PROVISIONING_SIGNATURE_INPUT_LIMITS.canonicalBytes,
  );
  assert.equal(
    canonicalizeProvisioningJsonValueCandidate({
      a: "x".repeat(65_536),
      b: "y".repeat(65_522),
    }).reason,
    "provisioning_jcs_budget_exceeded",
  );
  assert.equal(
    canonicalizeProvisioningJsonValueCandidate({
      escaped: "\u0000".repeat(21_845),
    }).reason,
    "provisioning_jcs_budget_exceeded",
  );
});

/**
 * RFC 8410 Ed25519 SPKIだけを受理しexact DERのdigestを候補化するを検証する。
 *
 * @responsibility RFC 8410 Ed25519 SPKIだけを受理しexact DERのdigestを候補化するの合否判定を所有する。
 * @trace AIT-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RFC 8410 Ed25519 SPKIだけを受理しexact DERのdigestを候補化するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
test("RFC 8410 Ed25519 SPKIだけを受理しexact DERのdigestを候補化する", () => {
  const result = inspectProvisioningEd25519SpkiCandidate(spki());
  assert.equal(result.status, "candidate");
  assert.equal(
    result.spkiSha256Digest.toString("hex"),
    "06e3fd8fda29bb60ab59557de61edb0aecdb231134be30e75b455f8e1b792fa9",
  );
  assert.equal("keyId" in result, false);
  assert.equal("spkiDer" in result, false);
  assert.equal(result.runtimeAuthorityConferred, false);

  const nullParameters = Buffer.from(
    `302c300706032b65700500032100${RFC_8032_PUBLIC_KEY}`,
    "hex",
  );
  const trailing = Buffer.concat([spki(), Buffer.from([0])]);
  for (const value of [
    Buffer.from(RFC_8032_PUBLIC_KEY, "hex"),
    nullParameters,
    trailing,
    Buffer.from("not-der"),
    new Uint8Array(spki()),
    Buffer.alloc(129),
  ])
    assert.equal(
      inspectProvisioningEd25519SpkiCandidate(value).status,
      "blocked",
    );
});

/**
 * RFC 8032 vectorの個別署名一致だけをcandidateにし改変を拒否するを検証する。
 *
 * @responsibility RFC 8032 vectorの個別署名一致だけをcandidateにし改変を拒否するの合否判定を所有する。
 * @trace AIT-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RFC 8032 vectorの個別署名一致だけをcandidateにし改変を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
test("RFC 8032 vectorの個別署名一致だけをcandidateにし改変を拒否する", () => {
  const input = {
    spkiDer: spki(),
    message: Buffer.alloc(0),
    signature: Buffer.from(RFC_8032_SIGNATURE, "hex"),
  };
  const result = verifyProvisioningEd25519PrimitiveCandidate(input);
  assert.equal(result.status, "candidate");
  assert.equal(result.cryptographicMatch, true);
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);

  const changedSignature = Buffer.from(input.signature);
  changedSignature[0] = (changedSignature[0] ?? 0) ^ 1;
  assert.equal(
    verifyProvisioningEd25519PrimitiveCandidate({
      ...input,
      signature: changedSignature,
    }).reason,
    "provisioning_ed25519_cryptographic_mismatch",
  );
  assert.equal(
    verifyProvisioningEd25519PrimitiveCandidate({
      ...input,
      message: Buffer.from([0]),
    }).status,
    "blocked",
  );
  assert.equal(
    verifyProvisioningEd25519PrimitiveCandidate({
      ...input,
      signature: Buffer.alloc(63),
    }).status,
    "blocked",
  );
  assert.equal(
    verifyProvisioningEd25519PrimitiveCandidate({ ...input, extra: true })
      .status,
    "blocked",
  );

  let getterCalls = 0;
  const accessor = { ...input };
  Object.defineProperty(accessor, "message", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return Buffer.alloc(0);
    },
  });
  assert.equal(
    verifyProvisioningEd25519PrimitiveCandidate(accessor).status,
    "blocked",
  );
  assert.equal(getterCalls, 0);
});

/**
 * RFC 4648のpaddingなしbase64url署名だけを内部復号して個別検証するを検証する。
 *
 * @responsibility RFC 4648のpaddingなしbase64url署名だけを内部復号して個別検証するの合否判定を所有する。
 * @trace AIT-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus RFC 4648のpaddingなしbase64url署名だけを内部復号して個別検証するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
test("RFC 4648のpaddingなしbase64url署名だけを内部復号して個別検証する", () => {
  const signatureBase64url = Buffer.from(RFC_8032_SIGNATURE, "hex").toString(
    "base64url",
  );
  assert.equal(signatureBase64url.length, 86);
  const input = {
    spkiDer: spki(),
    message: Buffer.alloc(0),
    signatureBase64url,
  };
  const result = verifyProvisioningEd25519Base64urlCandidate(input);
  assert.equal(result.status, "candidate");
  assert.equal(result.cryptographicMatch, true);
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal("signature" in result, false);
  assert.equal("signatureBase64url" in result, false);

  const noncanonicalPadBits = `${signatureBase64url.slice(0, -1)}x`;
  assert.equal(
    Buffer.from(noncanonicalPadBits, "base64url").equals(
      Buffer.from(signatureBase64url, "base64url"),
    ),
    true,
  );
  for (const value of [
    `${signatureBase64url}=`,
    signatureBase64url.slice(1),
    `${signatureBase64url.slice(0, -1)}+`,
    `${signatureBase64url.slice(0, -1)} `,
    noncanonicalPadBits,
  ]) {
    const blockedResult = verifyProvisioningEd25519Base64urlCandidate({
      ...input,
      signatureBase64url: value,
    });
    assert.equal(
      blockedResult.reason,
      "provisioning_ed25519_base64url_input_invalid",
    );
    assert.equal("signatureBase64url" in blockedResult, false);
  }
  const changedSignature = Buffer.from(RFC_8032_SIGNATURE, "hex");
  changedSignature[0] = (changedSignature[0] ?? 0) ^ 1;
  assert.equal(
    verifyProvisioningEd25519Base64urlCandidate({
      ...input,
      signatureBase64url: changedSignature.toString("base64url"),
    }).reason,
    "provisioning_ed25519_cryptographic_mismatch",
  );

  let getterCalls = 0;
  const accessor = { ...input };
  Object.defineProperty(accessor, "signatureBase64url", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return signatureBase64url;
    },
  });
  assert.equal(
    verifyProvisioningEd25519Base64urlCandidate(accessor).status,
    "blocked",
  );
  assert.equal(
    verifyProvisioningEd25519Base64urlCandidate({ ...input, extra: true })
      .status,
    "blocked",
  );
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const proxy = new Proxy(input, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(input);
    },
  });
  assert.equal(
    verifyProvisioningEd25519Base64urlCandidate(proxy).status,
    "blocked",
  );
  assert.equal(proxyCalls, 0);
});

/**
 * P-256 SPKIと固定P1363署名をhardware-backed installation key候補に限定するを検証する。
 *
 * @responsibility P-256 SPKIと固定P1363署名をhardware-backed installation key候補に限定するの合否判定を所有する。
 * @trace AIT-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus P-256 SPKIと固定P1363署名をhardware-backed installation key候補に限定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
test("P-256 SPKIと固定P1363署名をhardware-backed installation key候補に限定する", () => {
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spkiDer = pair.publicKey.export({ format: "der", type: "spki" });
  const message = Buffer.from("p256 provisioning primitive");
  const signature = lowSP256(
    sign("sha256", message, {
      key: pair.privateKey,
      dsaEncoding: "ieee-p1363",
    }),
  );
  const signatureBase64url = signature.toString("base64url");
  assert.equal(spkiDer.length, 91);
  assert.equal(signatureBase64url.length, 86);
  const inspected = inspectProvisioningP256SpkiCandidate(spkiDer);
  assert.equal(inspected.status, "candidate");
  assert.equal(inspected.spkiSha256Digest.length, 32);
  const verified = verifyProvisioningP256Base64urlCandidate({
    spkiDer,
    message,
    signatureBase64url,
  });
  assert.equal(verified.status, "candidate");
  assert.equal(verified.cryptographicMatch, true);
  assert.equal(verified.runtimeAuthorityConferred, false);
  assert.equal(
    verifyProvisioningP256Base64urlCandidate({
      spkiDer,
      message: Buffer.from("changed"),
      signatureBase64url,
    }).status,
    "blocked",
  );
  assert.equal(inspectProvisioningP256SpkiCandidate(spki()).status, "blocked");
  assert.equal(
    verifyProvisioningP256Base64urlCandidate({
      spkiDer,
      message,
      signatureBase64url: `${signatureBase64url}=`,
    }).status,
    "blocked",
  );
  const highS = Buffer.from(signature);
  const s = BigInt(`0x${highS.subarray(32).toString("hex")}`);
  Buffer.from((P256_ORDER - s).toString(16).padStart(64, "0"), "hex").copy(
    highS,
    32,
  );
  assert.equal(
    verifyProvisioningP256Base64urlCandidate({
      spkiDer,
      message,
      signatureBase64url: highS.toString("base64url"),
    }).reason,
    "provisioning_p256_signature_noncanonical",
  );
});

/**
 * 公開contractはprimitiveと未決の統合Trust境界を分離するを検証する。
 *
 * @responsibility 公開contractはprimitiveと未決の統合Trust境界を分離するの合否判定を所有する。
 * @trace AIT-UT-011
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開contractはprimitiveと未決の統合Trust境界を分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: 署名PrimitiveとPublisher検証規則は外部実行境界を持たない。
 */
test("公開contractはprimitiveと未決の統合Trust境界を分離する", () => {
  assert.deepEqual(describeProvisioningSignaturePrimitivesContract(), {
    contract: "crdd-coordinator/provisioning-signature-primitives",
    contractRevision: 1,
    jcsValueCanonicalization: "implemented_candidate_rfc_8785",
    rawJsonDuplicateKeyDecoder: "not_implemented",
    ed25519SpkiDerInspection: "implemented_candidate_rfc_8410",
    spkiSha256Digest: "implemented_candidate_not_key_id_encoding",
    ed25519PrimitiveVerification: "implemented_candidate_rfc_8032",
    ed25519SignatureBase64url: "implemented_candidate_rfc_4648_unpadded",
    p256SpkiDerInspection: "implemented_candidate_sec1_rfc_5480",
    p256PrimitiveVerification: "implemented_candidate_ecdsa_sha256_ieee_p1363",
    p256SignatureBase64url:
      "implemented_candidate_low_s_ieee_p1363_rfc_4648_unpadded",
    keyIdEncoding: "implemented_candidate_in_provisioning_record_pure_core",
    payloadSignatureEnvelopeTopology:
      "payload_and_multiple_signatures_separated_target",
    crddDomainSeparationFraming:
      "implemented_candidate_in_provisioning_record_pure_core",
    provisioningRecordPayloadSchema:
      "implemented_candidate_in_provisioning_record_pure_core",
    multiSignatureEnvelopeSchema:
      "implemented_candidate_in_provisioning_record_pure_core",
    multiSignatureAcceptanceRule:
      "implemented_candidate_in_provisioning_record_pure_core",
    multiSignatureAcceptancePolicy:
      "one_or_more_trusted_non_revoked_valid_and_no_unknown_revoked_duplicate_or_invalid_target",
    offlineBundledTrustEvaluation: "required_target_not_implemented",
    embeddedTrustAnchorSet:
      "candidate_codec_only_untrusted_input_in_provisioning_record_pure_core",
    revocationManifest:
      "candidate_codec_only_untrusted_input_in_provisioning_record_pure_core",
    aggregateRecordVerifier:
      "candidate_cryptographic_condition_only_in_provisioning_record_pure_core",
    existingCanonicalContractsMigratedToJcs: false,
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
});

import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import type { KeyObject } from "node:crypto";
import test from "node:test";

import {
  PROVISIONING_RECORD_DOMAIN_PREFIX_ASCII,
  PROVISIONING_RECORD_PURE_CORE_LIMITS,
  buildProvisioningRecordDomainMessageCandidate,
  compileProvisioningRecordEnvelopeCandidate,
  compileProvisioningRevocationManifestCandidate,
  compileProvisioningTrustAnchorSetCandidate,
  decodeProvisioningRecordEnvelopeCandidate,
  decodeProvisioningRevocationManifestCandidate,
  decodeProvisioningTrustAnchorSetCandidate,
  describeProvisioningRecordPureCoreContract,
  verifyProvisioningRecordAggregateCandidate,
} from "../src/security/provisioning-record-pure-core.ts";
import {
  assertCanonicalCandidate,
  assertDomainMessageCandidate,
  assertPresent,
  assertRecord,
} from "./test-support.ts";

const P256_ORDER = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);

function lowSP256(signature: Uint8Array) {
  const result = Buffer.from(signature);
  const s = BigInt(`0x${result.subarray(32).toString("hex")}`);
  if (s > P256_ORDER >> 1n) {
    Buffer.from((P256_ORDER - s).toString(16).padStart(64, "0"), "hex").copy(
      result,
      32,
    );
  }
  return result;
}

function fixture() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const spkiDer = publicKey.export({ format: "der", type: "spki" });
  const keyId = createHash("sha256").update(spkiDer).digest("hex");
  const payload = {
    contract: "crdd-coordinator/provisioning-record",
    contractRevision: 1,
    recordId: "1".repeat(32),
    recordRevision: 1,
    previousRecordHash: null,
    platformScopeId: "2".repeat(32),
    provisionerIdentityHash: "3".repeat(64),
    provisionerEnrollmentId: "4".repeat(32),
    authorityRootAbsolutePath:
      process.platform === "win32"
        ? "C:\\CRDD-Authority"
        : "/var/lib/crdd-authority",
    authorityRootIdentityHash: "5".repeat(64),
    authorityRootProtectionHash: "6".repeat(64),
    runtimePrincipalModes: [
      "local_interactive_selected_user",
      "server_dedicated_service_account",
    ],
    trustEpoch: 1,
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-06-30T00:00:00.000Z",
  };
  const domain = buildProvisioningRecordDomainMessageCandidate(payload);
  assertDomainMessageCandidate(domain);
  const envelope = {
    contract: "crdd-coordinator/provisioning-record-envelope",
    contractRevision: 1,
    payload,
    signatures: [
      {
        keyId,
        algorithm: "ECDSA-P256-SHA256",
        signature: lowSP256(
          sign("sha256", domain.message, {
            key: privateKey,
            dsaEncoding: "ieee-p1363",
          }),
        ).toString("base64url"),
      },
    ],
  };
  const keyset = {
    contract: "crdd-coordinator/provisioning-trust-anchor-set",
    contractRevision: 1,
    trustEpoch: 1,
    keys: [
      {
        keyId,
        algorithm: "ECDSA-P256-SHA256",
        spkiDer: spkiDer.toString("base64url"),
        enrollmentCaId: "7".repeat(32),
        notBefore: "2025-12-01T00:00:00.000Z",
        notAfter: "2026-12-01T00:00:00.000Z",
      },
    ],
  };
  const revocations = {
    contract: "crdd-coordinator/provisioning-revocation-manifest",
    contractRevision: 1,
    trustEpoch: 1,
    revocationRevision: 1,
    revoked: [],
  };
  return { privateKey, spkiDer, keyId, payload, envelope, keyset, revocations };
}

function compiled(f: ReturnType<typeof fixture>) {
  const envelope = compileProvisioningRecordEnvelopeCandidate(f.envelope);
  const keyset = compileProvisioningTrustAnchorSetCandidate(f.keyset);
  const revocations = compileProvisioningRevocationManifestCandidate(
    f.revocations,
  );
  assertCanonicalCandidate(envelope);
  assertCanonicalCandidate(keyset);
  assertCanonicalCandidate(revocations);
  return { envelope, keyset, revocations };
}

function signingEntry(
  payload: Record<string, unknown>,
  privateKey: KeyObject,
  keyId: string,
) {
  const domain = buildProvisioningRecordDomainMessageCandidate(payload);
  assertDomainMessageCandidate(domain);
  return {
    keyId,
    algorithm: "ECDSA-P256-SHA256",
    signature: lowSP256(
      sign("sha256", domain.message, {
        key: privateKey,
        dsaEncoding: "ieee-p1363",
      }),
    ).toString("base64url"),
  };
}

function decodedStatus(
  decoder: (raw: unknown) => unknown,
  raw: unknown,
): unknown {
  const result = decoder(raw);
  assertRecord(result);
  return result.status;
}

test("domain framing、key ID、4成果物のrevision 1を単一contractとして固定する", () => {
  const f = fixture();
  const domain = buildProvisioningRecordDomainMessageCandidate(f.payload);
  assertDomainMessageCandidate(domain);
  const prefix = Buffer.from(PROVISIONING_RECORD_DOMAIN_PREFIX_ASCII, "ascii");
  assert.equal(
    PROVISIONING_RECORD_DOMAIN_PREFIX_ASCII,
    "CRDD\0PROVISIONING-RECORD\0V1\0",
  );
  assert.equal(
    prefix.toString("hex"),
    "435244440050524f564953494f4e494e472d5245434f524400563100",
  );
  assert.equal(domain.message.subarray(0, prefix.length).equals(prefix), true);
  assert.equal(
    domain.message.readBigUInt64BE(prefix.length),
    BigInt(domain.message.length - prefix.length - 8),
  );
  domain.message.fill(0);
  const nextDomain = buildProvisioningRecordDomainMessageCandidate(f.payload);
  assertDomainMessageCandidate(nextDomain);
  assert.equal(
    nextDomain.message.subarray(0, prefix.length).equals(prefix),
    true,
  );
  assert.match(f.keyId, /^[a-f0-9]{64}$/u);
  assert.deepEqual(describeProvisioningRecordPureCoreContract(), {
    contractRevision: 1,
    recordContract: "crdd-coordinator/provisioning-record",
    envelopeContract: "crdd-coordinator/provisioning-record-envelope",
    trustAnchorSetContract: "crdd-coordinator/provisioning-trust-anchor-set",
    revocationManifestContract:
      "crdd-coordinator/provisioning-revocation-manifest",
    domainFraming:
      "implemented_candidate_fixed_prefix_uint64be_length_jcs_payload",
    keyIdEncoding: "implemented_candidate_spki_der_sha256_lowercase_hex_64",
    recordSignatureAlgorithm: "ECDSA-P256-SHA256",
    recordSignatureEncoding: "low-S-IEEE-P1363-64-byte-unpadded-base64url",
    recordPayloadCodec: "implemented_candidate",
    multiSignatureEnvelopeCodec: "implemented_candidate",
    trustAnchorSetCodec: "implemented_candidate_untrusted_input",
    revocationManifestCodec: "implemented_candidate_untrusted_input",
    aggregateCryptographicCondition:
      "implemented_candidate_fail_closed_all_entries",
    runtimeOwnedBundledTrustSelection: "not_implemented",
    rollbackResistantTrustFloor: "not_implemented",
    filesystemRead: "not_implemented",
    lifecyclePersistence: "not_implemented",
    filesystemEffectIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
  });
});

test("各codecはcanonical bytesだけをround-tripし、非canonical raw JSONを拒否する", () => {
  const f = fixture();
  const values = compiled(f);
  const codecs: Array<readonly [unknown, (raw: unknown) => unknown]> = [
    [values.envelope, decodeProvisioningRecordEnvelopeCandidate],
    [values.keyset, decodeProvisioningTrustAnchorSetCandidate],
    [values.revocations, decodeProvisioningRevocationManifestCandidate],
  ];
  for (const [result, decode] of codecs) {
    assertCanonicalCandidate(result);
    assert.equal(decodedStatus(decode, result.canonicalBytes), "candidate");
    assert.equal(
      decodedStatus(
        decode,
        Buffer.concat([result.canonicalBytes, Buffer.from("\n")]),
      ),
      "blocked",
    );
    assert.equal(
      decodedStatus(
        decode,
        Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), result.canonicalBytes]),
      ),
      "blocked",
    );
    assert.equal(
      decodedStatus(decode, new Uint8Array(result.canonicalBytes)),
      "blocked",
    );
  }
  const duplicate = Buffer.from(
    '{"contract":"crdd-coordinator/provisioning-revocation-manifest",' +
      '"contract":"crdd-coordinator/provisioning-revocation-manifest","contractRevision":1,' +
      '"revocationRevision":1,"revoked":[],"trustEpoch":1}',
  );
  assert.equal(
    decodeProvisioningRevocationManifestCandidate(duplicate).status,
    "blocked",
  );
});

test("exact schemaはextra、accessor、Proxy、revision、並び、上限をfail closedにする", () => {
  const f = fixture();
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate({ ...f.envelope, extra: true })
      .status,
    "blocked",
  );
  const accessor = { ...f.envelope };
  let getterCalls = 0;
  Object.defineProperty(accessor, "payload", {
    enumerable: true,
    get() {
      getterCalls += 1;
      return f.payload;
    },
  });
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate(accessor).status,
    "blocked",
  );
  assert.equal(getterCalls, 0);
  let proxyCalls = 0;
  const proxy = new Proxy(f.envelope, {
    ownKeys() {
      proxyCalls += 1;
      return Reflect.ownKeys(f.envelope);
    },
  });
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate(proxy).status,
    "blocked",
  );
  assert.equal(proxyCalls, 0);
  let coercionCalls = 0;
  const dynamicId = {
    [Symbol.toPrimitive]() {
      coercionCalls += 1;
      return "1".repeat(32);
    },
    toString() {
      coercionCalls += 1;
      return "1".repeat(32);
    },
  };
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate({
      ...f.envelope,
      payload: { ...f.payload, recordId: dynamicId },
    }).status,
    "blocked",
  );
  assert.equal(coercionCalls, 0);
  const customArray = Object.setPrototypeOf([...f.envelope.signatures], null);
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate({
      ...f.envelope,
      signatures: customArray,
    }).status,
    "blocked",
  );
  const indexedAccessorEntries = [...f.envelope.signatures];
  let indexedGetterCalls = 0;
  Object.defineProperty(indexedAccessorEntries, "0", {
    enumerable: true,
    configurable: true,
    get() {
      indexedGetterCalls += 1;
      return f.envelope.signatures[0];
    },
  });
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate({
      ...f.envelope,
      signatures: indexedAccessorEntries,
    }).status,
    "blocked",
  );
  assert.equal(indexedGetterCalls, 0);
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate({
      ...f.envelope,
      signatures: Object.freeze([...f.envelope.signatures]),
    }).status,
    "candidate",
  );
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate({
      ...f.envelope,
      contractRevision: 2,
    }).status,
    "blocked",
  );
  assert.equal(
    compileProvisioningTrustAnchorSetCandidate({
      ...f.keyset,
      keys: [...f.keyset.keys, f.keyset.keys[0]],
    }).status,
    "blocked",
  );
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate({
      ...f.envelope,
      signatures: Array(
        PROVISIONING_RECORD_PURE_CORE_LIMITS.signatures + 1,
      ).fill(f.envelope.signatures[0]),
    }).status,
    "blocked",
  );
  assert.equal(
    compileProvisioningTrustAnchorSetCandidate({
      ...f.keyset,
      keys: Array(PROVISIONING_RECORD_PURE_CORE_LIMITS.keys + 1).fill(
        f.keyset.keys[0],
      ),
    }).status,
    "blocked",
  );
  assert.equal(
    compileProvisioningTrustAnchorSetCandidate({
      ...f.keyset,
      keys: [
        {
          ...f.keyset.keys[0],
          keyId: "8".repeat(64),
        },
      ],
    }).status,
    "blocked",
  );
  const firstKey = f.keyset.keys[0];
  assertPresent(firstKey);
  for (const spkiDer of [
    "A".repeat(121),
    "A".repeat(123),
    "A".repeat(1_000_000),
    `${firstKey.spkiDer}=`,
  ]) {
    assert.equal(
      compileProvisioningTrustAnchorSetCandidate({
        ...f.keyset,
        keys: [{ ...firstKey, spkiDer }],
      }).status,
      "blocked",
    );
  }
  assert.equal(
    compileProvisioningRecordEnvelopeCandidate({
      ...f.envelope,
      payload: { ...f.payload, expiresAt: "2026-07-01T00:00:00.001Z" },
    }).status,
    "blocked",
  );
  assert.equal(
    compileProvisioningRevocationManifestCandidate({
      ...f.revocations,
      revoked: Array(PROVISIONING_RECORD_PURE_CORE_LIMITS.revocations + 1).fill(
        {
          keyId: "8".repeat(64),
          revokedAt: "2026-01-01T00:00:00.000Z",
          reasonCode: "test",
        },
      ),
    }).status,
    "blocked",
  );
});

test("複数署名は全entryが既知・期間内・正常な場合だけ候補になる", () => {
  const first = fixture();
  const secondPair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const secondSpki = secondPair.publicKey.export({
    format: "der",
    type: "spki",
  });
  const secondKeyId = createHash("sha256").update(secondSpki).digest("hex");
  const entries = [
    {
      keyId: first.keyId,
      privateKey: first.privateKey,
      spkiDer: first.spkiDer,
      enrollmentCaId: "7".repeat(32),
    },
    {
      keyId: secondKeyId,
      privateKey: secondPair.privateKey,
      spkiDer: secondSpki,
      enrollmentCaId: "8".repeat(32),
    },
  ].sort((left, right) => left.keyId.localeCompare(right.keyId));
  const envelope = {
    ...first.envelope,
    signatures: entries.map((entry) =>
      signingEntry(first.payload, entry.privateKey, entry.keyId),
    ),
  };
  const keyset = {
    ...first.keyset,
    keys: entries.map((entry) => ({
      keyId: entry.keyId,
      algorithm: "ECDSA-P256-SHA256",
      spkiDer: entry.spkiDer.toString("base64url"),
      enrollmentCaId: entry.enrollmentCaId,
      notBefore: "2025-12-01T00:00:00.000Z",
      notAfter: "2026-12-01T00:00:00.000Z",
    })),
  };
  const envelopeBytes =
    compileProvisioningRecordEnvelopeCandidate(envelope).canonicalBytes;
  const trustAnchorSetBytes =
    compileProvisioningTrustAnchorSetCandidate(keyset).canonicalBytes;
  const revocationManifestBytes =
    compileProvisioningRevocationManifestCandidate(
      first.revocations,
    ).canonicalBytes;
  const input = {
    envelopeBytes,
    trustAnchorSetBytes,
    revocationManifestBytes,
    evaluationTime: "2026-03-01T00:00:00.000Z",
  };
  assert.equal(
    verifyProvisioningRecordAggregateCandidate(input).verifiedSignatureCount,
    2,
  );

  const invalidEntries = envelope.signatures.map((entry) => ({ ...entry }));
  const last = invalidEntries.at(-1);
  assertPresent(last);
  last.signature = `${last.signature.startsWith("A") ? "B" : "A"}${last.signature.slice(1)}`;
  const invalidEnvelope = compileProvisioningRecordEnvelopeCandidate({
    ...envelope,
    signatures: invalidEntries,
  });
  assert.equal(invalidEnvelope.status, "candidate");
  assert.equal(
    verifyProvisioningRecordAggregateCandidate({
      ...input,
      envelopeBytes: invalidEnvelope.canonicalBytes,
    }).reason,
    "provisioning_record_aggregate_signature_invalid",
  );
});

test("aggregate候補は全署名が既知・非失効・期間内・正常な場合だけ通す", () => {
  const f = fixture();
  const values = compiled(f);
  const input = {
    envelopeBytes: values.envelope.canonicalBytes,
    trustAnchorSetBytes: values.keyset.canonicalBytes,
    revocationManifestBytes: values.revocations.canonicalBytes,
    evaluationTime: "2026-03-01T00:00:00.000Z",
  };
  const result = verifyProvisioningRecordAggregateCandidate(input);
  assert.equal(result.status, "candidate");
  assert.equal(result.cryptographicConditionSatisfied, true);
  assert.equal(result.verifiedSignatureCount, 1);
  assert.equal(result.runtimeAuthorityConferred, false);
  assert.equal(result.runtimeCapabilityIssued, false);
  assert.equal(result.filesystemEffectIssued, false);
  assert.equal("payload" in result, false);
  assert.equal("keyId" in result, false);
  assert.equal("signature" in result, false);
  assert.equal("canonicalBytes" in result, false);

  const revoked = {
    ...f.revocations,
    revoked: [
      {
        keyId: f.keyId,
        revokedAt: "2026-02-01T00:00:00.000Z",
        reasonCode: "key_compromise",
      },
    ],
  };
  const revokedBytes =
    compileProvisioningRevocationManifestCandidate(revoked).canonicalBytes;
  assert.equal(
    verifyProvisioningRecordAggregateCandidate({
      ...input,
      revocationManifestBytes: revokedBytes,
    }).reason,
    "provisioning_record_aggregate_revoked_key",
  );
  for (const revokedAt of [
    "2026-02-28T23:59:59.999Z",
    "2026-03-01T00:00:00.000Z",
    "2026-03-02T00:00:00.000Z",
  ]) {
    const temporalRevocation = compileProvisioningRevocationManifestCandidate({
      ...f.revocations,
      revoked: [{ keyId: f.keyId, revokedAt, reasonCode: "key_compromise" }],
    });
    assert.equal(
      verifyProvisioningRecordAggregateCandidate({
        ...input,
        revocationManifestBytes: temporalRevocation.canonicalBytes,
      }).reason,
      "provisioning_record_aggregate_revoked_key",
    );
  }
  assert.equal(
    verifyProvisioningRecordAggregateCandidate({
      ...input,
      evaluationTime: "2027-01-01T00:00:00.000Z",
    }).status,
    "blocked",
  );
});

test("unknown、改変、epoch差、余分な不正署名を無視せず全体拒否する", () => {
  const f = fixture();
  const unknownId = "8".repeat(64);
  const unknownEnvelope = {
    ...f.envelope,
    signatures: [{ ...f.envelope.signatures[0], keyId: unknownId }],
  };
  const unknownCompiled =
    compileProvisioningRecordEnvelopeCandidate(unknownEnvelope);
  assert.equal(unknownCompiled.status, "candidate");
  const values = compiled(f);
  const base = {
    envelopeBytes: unknownCompiled.canonicalBytes,
    trustAnchorSetBytes: values.keyset.canonicalBytes,
    revocationManifestBytes: values.revocations.canonicalBytes,
    evaluationTime: "2026-03-01T00:00:00.000Z",
  };
  assert.equal(
    verifyProvisioningRecordAggregateCandidate(base).reason,
    "provisioning_record_aggregate_unknown_key",
  );

  const originalSignature = f.envelope.signatures[0];
  assertPresent(originalSignature);
  const changed = { ...originalSignature };
  changed.signature = `${changed.signature.startsWith("A") ? "B" : "A"}${changed.signature.slice(1)}`;
  const changedEnvelope = compileProvisioningRecordEnvelopeCandidate({
    ...f.envelope,
    signatures: [changed],
  });
  assert.equal(
    verifyProvisioningRecordAggregateCandidate({
      ...base,
      envelopeBytes: changedEnvelope.canonicalBytes,
    }).reason,
    "provisioning_record_aggregate_signature_invalid",
  );

  const epoch = compileProvisioningRevocationManifestCandidate({
    ...f.revocations,
    trustEpoch: 2,
  });
  assert.equal(
    verifyProvisioningRecordAggregateCandidate({
      ...base,
      envelopeBytes: values.envelope.canonicalBytes,
      revocationManifestBytes: epoch.canonicalBytes,
    }).reason,
    "provisioning_record_aggregate_trust_epoch_mismatch",
  );
});

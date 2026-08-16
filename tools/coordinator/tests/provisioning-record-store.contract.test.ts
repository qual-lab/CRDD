import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildProvisioningRecordDomainMessageCandidate,
  compileProvisioningRecordEnvelopeCandidate,
} from "../src/security/provisioning-record-pure-core.ts";
import {
  PROVISIONING_RECORDS_DIRECTORY,
  PROVISIONING_RECORD_STORAGE_DIRECTORY,
  describeProvisioningRecordStoreContract,
  loadCurrentProvisioningRecordCandidate,
  persistCurrentProvisioningRecordForEffect,
} from "../src/security/provisioning-record-store.ts";
import {
  assertCanonicalCandidate,
  assertDomainMessageCandidate,
} from "./test-support.ts";

const P256_ORDER = BigInt(
  "0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
);

function lowS(signature: Uint8Array) {
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

function envelopeBytes() {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const spki = publicKey.export({ format: "der", type: "spki" });
  const keyId = createHash("sha256").update(spki).digest("hex");
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
  const compiled = compileProvisioningRecordEnvelopeCandidate({
    contract: "crdd-coordinator/provisioning-record-envelope",
    contractRevision: 1,
    payload,
    signatures: [
      {
        keyId,
        algorithm: "ECDSA-P256-SHA256",
        signature: lowS(
          sign("sha256", domain.message, {
            key: privateKey,
            dsaEncoding: "ieee-p1363",
          }),
        ).toString("base64url"),
      },
    ],
  });
  assertCanonicalCandidate(compiled);
  return compiled.canonicalBytes;
}

function storageFixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-record-store-"));
  const root = path.join(parent, PROVISIONING_RECORD_STORAGE_DIRECTORY);
  fs.mkdirSync(path.join(root, PROVISIONING_RECORDS_DIRECTORY), {
    recursive: true,
  });
  return { parent, root };
}

test("immutable Recordとatomic current pointerを保存して再読取りする", () => {
  const fixture = storageFixture();
  try {
    const bytes = envelopeBytes();
    const persisted = persistCurrentProvisioningRecordForEffect(
      fixture.root,
      bytes,
    );
    assert.equal(persisted.status, "candidate");
    assert.equal(persisted.persistenceCompleted, true);
    const loaded = loadCurrentProvisioningRecordCandidate(fixture.root);
    assert.equal(loaded.status, "candidate");
    assert.equal(loaded.recordHash, persisted.recordHash);
    assert.equal(
      persistCurrentProvisioningRecordForEffect(fixture.root, bytes).status,
      "candidate",
    );
    assert.equal(
      persistCurrentProvisioningRecordForEffect(fixture.root, envelopeBytes())
        .reason,
      "provisioning_record_store_lineage_invalid",
    );
    assert.equal(loaded.runtimeAuthorityConferred, false);
    assert.equal(JSON.stringify(loaded).includes(fixture.root), false);
  } finally {
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

test("pending、改変currentおよび不正Rootをfail closedにする", () => {
  const fixture = storageFixture();
  try {
    const contract = describeProvisioningRecordStoreContract();
    assert.equal(
      contract.recordLayout,
      "immutable_content_addressed_envelope_hash_json",
    );
    fs.writeFileSync(path.join(fixture.root, "current.json.pending"), "{}", {
      flag: "wx",
    });
    const pending = loadCurrentProvisioningRecordCandidate(fixture.root);
    assert.equal(pending.status, "blocked");
    assert.equal(pending.recoveryRequired, true);
    assert.equal(
      persistCurrentProvisioningRecordForEffect(fixture.parent, envelopeBytes())
        .status,
      "blocked",
    );
  } finally {
    fs.rmSync(fixture.parent, { recursive: true, force: true });
  }
});

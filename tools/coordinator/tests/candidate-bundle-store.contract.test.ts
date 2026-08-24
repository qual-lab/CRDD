import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  describeCandidateBundleStoreContract,
  discardRuntimeOwnedCandidateBundle,
  persistRuntimeOwnedCandidateBundle,
  publishRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
} from "../src/security/candidate-bundle-store.ts";

const persistencePolicy = Object.freeze({
  candidatePersistenceAllowed: true,
  candidateRetentionHours: 24,
  informationClassification: "public",
});

function bundle(content = Buffer.from("state=after\n", "utf8")) {
  return Object.freeze({
    schema: "crdd-coordinator-candidate-bundle/v1",
    baseCommit: "1".repeat(40),
    baseTree: "2".repeat(40),
    baseManifestHash: "3".repeat(64),
    patchHash: "4".repeat(64),
    contentManifestHash: "5".repeat(64),
    allowedPathsHash: "6".repeat(64),
    changedPaths: Object.freeze(["fixture.txt"]),
    entries: Object.freeze([
      Object.freeze({
        relativePath: "fixture.txt",
        operation: "upsert",
        byteLength: content.byteLength,
        sha256: createHash("sha256").update(content).digest("hex"),
        contentBase64: content.toString("base64"),
      }),
    ]),
  });
}

test("承認済みCandidate bundleをopaque IDで読出し、明示Discardする", () => {
  const persisted = persistRuntimeOwnedCandidateBundle(
    bundle(),
    persistencePolicy,
  );
  assert.equal(persisted?.status, "staged");
  assert.match(
    persisted?.candidateRecoveryId ?? "",
    /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
  );
  assert.equal(
    readRuntimeOwnedCandidateBundle(persisted?.candidateRecoveryId),
    null,
  );
  const published = publishRuntimeOwnedCandidateBundle(
    persisted?.candidateRecoveryId,
  );
  assert.equal(published?.status, "published");
  const exported = readRuntimeOwnedCandidateBundle(published?.candidateId);
  assert.equal(exported?.status, "exported");
  assert.deepEqual(exported?.bundle.changedPaths, ["fixture.txt"]);
  assert.equal(
    Buffer.from(
      exported?.bundle.entries[0]?.contentBase64 ?? "",
      "base64",
    ).toString("utf8"),
    "state=after\n",
  );
  assert.deepEqual(discardRuntimeOwnedCandidateBundle(published?.candidateId), {
    status: "discarded",
  });
  assert.equal(readRuntimeOwnedCandidateBundle(published?.candidateId), null);
});

test("不正ID、内容Hash不一致、Schema逸脱をCandidateへ昇格しない", () => {
  assert.equal(readRuntimeOwnedCandidateBundle("candidate.invalid"), null);
  assert.equal(
    persistRuntimeOwnedCandidateBundle(
      { ...bundle(), unknown: true },
      persistencePolicy,
    ),
    null,
  );
  const persisted = persistRuntimeOwnedCandidateBundle(
    bundle(),
    persistencePolicy,
  );
  assert.ok(persisted);
  const storageId = persisted.candidateRecoveryId.split(".")[1];
  assert.ok(storageId);
  const target = path.join(
    fs.realpathSync.native(os.tmpdir()),
    "crdd-coordinator-candidates-v2",
    `staged-${storageId}.json`,
  );
  fs.appendFileSync(target, " ");
  assert.equal(
    publishRuntimeOwnedCandidateBundle(persisted.candidateRecoveryId),
    null,
  );
  fs.rmSync(target);
  const secret = Buffer.from(`token=sk-${"A".repeat(24)}\n`, "utf8");
  assert.equal(
    persistRuntimeOwnedCandidateBundle(bundle(secret), persistencePolicy),
    null,
  );
});

test("公開契約はlocal transient storeと非canonical Effectを固定する", () => {
  const contract = describeCandidateBundleStoreContract();
  assert.equal(contract.contractRevision, 2);
  assert.equal(contract.canonicalRepositoryWriteAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.hostPathReported, false);
});

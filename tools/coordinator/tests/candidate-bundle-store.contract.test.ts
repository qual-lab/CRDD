import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  describeCandidateBundleStoreContract,
  discardRuntimeOwnedCandidateBundle,
  persistRuntimeOwnedCandidateBundle,
  readRuntimeOwnedCandidateBundle,
} from "../src/security/candidate-bundle-store.ts";

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
        sha256:
          "612c399441323734303c3165be20e25e6119ec2397974e936b947237641b5e23",
        contentBase64: content.toString("base64"),
      }),
    ]),
  });
}

test("承認済みCandidate bundleをopaque IDで読出し、明示Discardする", () => {
  const persisted = persistRuntimeOwnedCandidateBundle(bundle());
  assert.equal(persisted?.status, "persisted");
  assert.match(
    persisted?.candidateId ?? "",
    /^candidate\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
  );
  const exported = readRuntimeOwnedCandidateBundle(persisted?.candidateId);
  assert.equal(exported?.status, "exported");
  assert.deepEqual(exported?.bundle.changedPaths, ["fixture.txt"]);
  assert.equal(
    Buffer.from(
      exported?.bundle.entries[0]?.contentBase64 ?? "",
      "base64",
    ).toString("utf8"),
    "state=after\n",
  );
  assert.deepEqual(discardRuntimeOwnedCandidateBundle(persisted?.candidateId), {
    status: "discarded",
  });
  assert.equal(readRuntimeOwnedCandidateBundle(persisted?.candidateId), null);
});

test("不正ID、内容Hash不一致、Schema逸脱をCandidateへ昇格しない", () => {
  assert.equal(readRuntimeOwnedCandidateBundle("candidate.invalid"), null);
  assert.equal(
    persistRuntimeOwnedCandidateBundle({ ...bundle(), unknown: true }),
    null,
  );
  const persisted = persistRuntimeOwnedCandidateBundle(bundle());
  assert.ok(persisted);
  const storageId = persisted.candidateId.split(".")[1];
  assert.ok(storageId);
  const target = path.join(
    fs.realpathSync.native(os.tmpdir()),
    "crdd-coordinator-candidates-v1",
    `candidate-${storageId}.json`,
  );
  fs.appendFileSync(target, " ");
  assert.equal(readRuntimeOwnedCandidateBundle(persisted.candidateId), null);
  fs.rmSync(target);
});

test("公開契約はlocal transient storeと非canonical Effectを固定する", () => {
  const contract = describeCandidateBundleStoreContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.canonicalRepositoryWriteAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.hostPathReported, false);
});

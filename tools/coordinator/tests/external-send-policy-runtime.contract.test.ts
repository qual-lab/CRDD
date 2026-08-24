import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { parseUnambiguousJsonDocument } from "../src/security/claude-structured-result.ts";
import {
  compileExternalSendPolicyCandidate,
  describeExternalSendPolicyRuntimeContract,
  EXTERNAL_SEND_POLICY_FILE,
} from "../src/security/external-send-policy-runtime.ts";

const revision = "1".repeat(40);
const fileHash = "2".repeat(64);

function policy() {
  const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
  return parseUnambiguousJsonDocument(
    fs.readFileSync(
      path.join(repositoryRoot, EXTERNAL_SEND_POLICY_FILE),
      "utf8",
    ),
  );
}

test("Repository所有Policyへ分類・Provider別処理境界・Candidate保持を固定する", () => {
  const compiled = compileExternalSendPolicyCandidate(
    policy(),
    revision,
    fileHash,
  );
  assert.ok(compiled);
  assert.equal(compiled.sourceRevision, revision);
  assert.equal(compiled.sourceFileHash, fileHash);
  assert.equal(compiled.informationClassification, "public");
  assert.equal(compiled.decisionAuthority, "authenticated_local_user");
  assert.equal(compiled.candidatePersistenceAllowed, true);
  assert.equal(compiled.destinations.length, 2);
  assert.match(compiled.policyHash, /^[0-9a-f]{64}$/u);
});

test("未知field・Provider欠落・不正保持期間・順序差をPolicyへ昇格しない", () => {
  const valid = policy() as Record<string, unknown>;
  for (const invalid of [
    { ...valid, unknown: true },
    { ...valid, candidateRetentionHours: 0 },
    {
      ...valid,
      destinations: [
        ...(valid.destinations as unknown[]).slice(1),
        (valid.destinations as unknown[])[0],
      ],
    },
    { ...valid, destinations: (valid.destinations as unknown[]).slice(0, 1) },
  ]) {
    assert.equal(
      compileExternalSendPolicyCandidate(invalid, revision, fileHash),
      null,
    );
  }
});

test("公開契約は開始Commitの固定Policy fileと不明時停止を保持する", () => {
  const contract = describeExternalSendPolicyRuntimeContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.fixedRepositoryFile, EXTERNAL_SEND_POLICY_FILE);
  assert.equal(contract.source, "exact_bound_repository_commit");
  assert.equal(contract.unknownPolicy, "blocked");
  assert.equal(contract.hostPathReported, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  describeCodexStructuredResultContract,
  normalizeCodexStructuredResult,
} from "../../src/security/codex-structured-result.ts";

test("Codexの単一exact Resultだけを正規化する", () => {
  const result = normalizeCodexStructuredResult('{"status":true}\n');
  assert.equal(result.status, "confirmed");
  assert.deepEqual(result.normalizedResult, { status: true });
  assert.equal(result.rawOutputReported, false);
});

test("false・余分なkey・重複key・複数documentを拒否する", () => {
  for (const raw of [
    '{"status":false}',
    '{"status":true,"extra":true}',
    '{"status":true,"status":false}',
    '{"status":true}{"status":true}',
    "not-json",
  ]) {
    assert.equal(normalizeCodexStructuredResult(raw).status, "blocked");
  }
});

test("公開契約はraw出力非公開とbyte上限を固定する", () => {
  const contract = describeCodexStructuredResultContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.duplicateKeysAllowed, false);
  assert.equal(contract.maximumBytes, 16_384);
  assert.equal(contract.rawOutputReported, false);
});

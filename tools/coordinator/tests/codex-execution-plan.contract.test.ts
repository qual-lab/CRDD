import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  describeCodexExecutionPlanContract,
  planCodexReadOnlyProbe,
} from "../src/security/codex-execution-plan.ts";

test("公式Codex artifactとSubscription限定のread-only計画を固定する", () => {
  const plan = planCodexReadOnlyProbe({
    provider: "codex",
    mode: "read_only_probe",
    effort: "low",
  });
  assert.equal(plan.status, "candidate");
  assert.equal(plan.exactModel, "gpt-5.6-sol");
  assert.equal(plan.effort, "low");
  assert.equal(plan.environment.CODEX_HOME, "/provider-home");
  assert.equal(plan.apiKeyAllowed, false);
  assert.equal(plan.paidApiFallbackAllowed, false);
  assert.equal(plan.argv.includes("--ignore-user-config"), true);
  assert.equal(plan.argv.includes("--ignore-rules"), true);
  assert.equal(plan.argv.includes("danger-full-access"), false);
  assert.equal(plan.repositoryMounted, false);
});

test("effort・Provider・shape差をEffect前に拒否する", () => {
  for (const candidate of [
    { provider: "claude", mode: "read_only_probe", effort: "low" },
    { provider: "codex", mode: "task", effort: "low" },
    { provider: "codex", mode: "read_only_probe", effort: "xhigh" },
    {
      provider: "codex",
      mode: "read_only_probe",
      effort: "low",
      extra: true,
    },
  ]) {
    assert.equal(planCodexReadOnlyProbe(candidate).status, "blocked");
  }
});

test("Codex Structured Output Schemaはboolean型を明示したexact形に固定する", () => {
  const schema = JSON.parse(
    fs.readFileSync(
      new URL("../runtime/codex-result-schema.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(schema, {
    type: "object",
    properties: { status: { type: "boolean", const: true } },
    required: ["status"],
    additionalProperties: false,
  });
});

test("公開契約はSigstore検証と通常速度・API課金禁止を明示する", () => {
  const contract = describeCodexExecutionPlanContract();
  assert.equal(contract.contractRevision, 1);
  assert.equal(contract.distributionVerification.sigstoreBlobSignatureVerified, true);
  assert.equal(contract.distributionVerification.sigstoreCertificateIdentityMatched, true);
  assert.equal(contract.authentication, "existing_chatgpt_subscription_oauth_only");
  assert.equal(contract.apiKeyAllowed, false);
  assert.equal(contract.paidApiFallbackAllowed, false);
  assert.equal(contract.speedMode, "normal_only");
  assert.deepEqual(contract.efforts, ["low", "medium", "high"]);
  assert.equal(
    contract.distributionVerification.subscriptionBooleanRequestPassed,
    true,
  );
  assert.deepEqual(
    contract.distributionVerification.subscriptionBooleanRequestResult,
    { status: true },
  );
});

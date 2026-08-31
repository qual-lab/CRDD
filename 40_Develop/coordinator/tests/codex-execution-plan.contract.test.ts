import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  describeCodexExecutionPlanContract,
  planCodexIsolatedTask,
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
  assert.equal(plan.argv.includes("features.respect_system_proxy=true"), true);
  assert.equal(plan.argv.includes("features.code_mode_host=false"), false);
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

test("一般Taskはroot denyとRole別workspace権限をstdin計画へ固定する", () => {
  const executor = planCodexIsolatedTask({
    provider: "codex",
    mode: "isolated_task",
    effort: "low",
    taskRole: "executor",
  });
  const reviewer = planCodexIsolatedTask({
    provider: "codex",
    mode: "isolated_task",
    effort: "high",
    taskRole: "reviewer",
  });
  assert.equal(executor.status, "candidate");
  assert.equal(executor.exactModel, "gpt-5.5");
  assert.equal(executor.workspaceMountMode, "read_write");
  assert.equal(reviewer.status, "candidate");
  assert.equal(reviewer.exactModel, "gpt-5.5");
  assert.equal(reviewer.workspaceMountMode, "read_only");
  for (const plan of [executor, reviewer]) {
    assert.equal(plan.taskPromptTransport, "stdin_only");
    assert.equal(plan.taskPromptInArgvAllowed, false);
    assert.equal(plan.commandNetworkAccessAllowed, false);
    assert.equal(plan.webSearchAllowed, false);
    assert.equal(plan.providerHomeCommandReadAllowed, false);
    assert.equal(plan.argv.at(-1), "-");
    assert.equal(plan.argv.includes("--sandbox"), false);
    assert.equal(
      plan.argv.includes("features.respect_system_proxy=true"),
      true,
    );
    assert.equal(plan.argv.includes("features.code_mode_host=false"), true);
    assert.equal(plan.argv.includes("features.shell_tool=true"), true);
    assert.equal(plan.argv.includes("features.unified_exec=true"), true);
    assert.equal(
      plan.argv.some((value) => value.includes('filesystem={":root"="deny"')),
      true,
    );
    assert.equal(
      plan.argv.some((value) =>
        value.includes('"/opt/crdd/providers/codex/0.149.1/codex"="read"'),
      ),
      true,
    );
  }
});

test("一般Task SchemaはExecutorとReviewerのexact出力を分離する", () => {
  const executor = JSON.parse(
    fs.readFileSync(
      new URL("../runtime/codex-executor-result-schema.json", import.meta.url),
      "utf8",
    ),
  );
  const reviewer = JSON.parse(
    fs.readFileSync(
      new URL("../runtime/codex-reviewer-result-schema.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(executor.required, [
    "status",
    "summary",
    "changedPaths",
    "verification",
  ]);
  assert.deepEqual(reviewer.required, ["decision", "summary", "findings"]);
  assert.deepEqual(reviewer.properties.findings.items.required, [
    "severity",
    "path",
    "category",
    "criterionNumber",
    "message",
  ]);
  assert.equal(executor.additionalProperties, false);
  assert.equal(reviewer.additionalProperties, false);
  assert.equal("uniqueItems" in executor.properties.changedPaths, false);
});

test("Codex Structured Output Schemaは公式対応部分集合だけを搬送する", () => {
  const schemaPaths = [
    "../runtime/codex-result-schema.json",
    "../runtime/codex-executor-result-schema.json",
    "../runtime/codex-reviewer-result-schema.json",
  ];
  const unsupportedKeywords = new Set([
    "allOf",
    "dependentRequired",
    "dependentSchemas",
    "if",
    "then",
    "else",
    "not",
    "patternProperties",
    "uniqueItems",
  ]);
  function assertSupportedSubset(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) assertSupportedSubset(item);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      assert.equal(
        unsupportedKeywords.has(key),
        false,
        `Codex Structured Output Schema keyword is unsupported: ${key}`,
      );
      assertSupportedSubset(child);
    }
  }
  for (const schemaPath of schemaPaths) {
    assertSupportedSubset(
      JSON.parse(fs.readFileSync(new URL(schemaPath, import.meta.url), "utf8")),
    );
  }
});

test("公開契約はSigstore検証と通常速度・API課金禁止を明示する", () => {
  const contract = describeCodexExecutionPlanContract();
  assert.equal(contract.contractRevision, 6);
  assert.equal(
    contract.distributionVerification.sigstoreBlobSignatureVerified,
    true,
  );
  assert.equal(
    contract.distributionVerification.sigstoreCertificateIdentityMatched,
    true,
  );
  assert.equal(
    contract.distributionVerification.bundledBwrapSigstoreBlobSignatureVerified,
    true,
  );
  assert.equal(
    contract.distributionVerification.bundledBwrapCertificateIdentityMatched,
    true,
  );
  assert.equal(
    contract.distributionVerification
      .fixedImageBundledBwrapSelectedUnderNoNetworkProbe,
    true,
  );
  assert.equal(
    contract.authentication,
    "existing_chatgpt_subscription_oauth_only",
  );
  assert.equal(contract.apiKeyAllowed, false);
  assert.equal(contract.paidApiFallbackAllowed, false);
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(contract.preferredModelFamily, "sol");
  assert.equal(contract.readOnlyProbeExactModel, "gpt-5.6-sol");
  assert.equal(contract.isolatedTaskExactModel, "gpt-5.5");
  assert.equal(
    contract.outboundProxyPolicy,
    "official_cli_respect_system_proxy_required",
  );
  assert.deepEqual(contract.efforts, ["low", "medium", "high"]);
  assert.equal(
    contract.distributionVerification.subscriptionBooleanRequestPassed,
    true,
  );
  assert.deepEqual(
    contract.distributionVerification.subscriptionBooleanRequestResult,
    { status: true },
  );
  assert.equal(
    contract.distributionVerification.isolatedTaskCompatibilityModel,
    "gpt-5.5",
  );
  assert.equal(
    contract.distributionVerification.isolatedTaskShellVerificationPassed,
    true,
  );
});

test("固定Codex imageは公式署名済みbwrapを隣接配置して内部Sandboxを維持する", () => {
  const contract = describeCodexExecutionPlanContract();
  assert.deepEqual(
    {
      archiveSha256: contract.distributionIdentity.bwrapArchiveSha256,
      archiveBytes: contract.distributionIdentity.bwrapArchiveBytes,
      binaryPath: contract.distributionIdentity.bwrapBinaryPath,
      binarySha256: contract.distributionIdentity.bwrapBinarySha256,
      binaryBytes: contract.distributionIdentity.bwrapBinaryBytes,
      bundleSha256: contract.distributionIdentity.bwrapSigstoreBundleSha256,
      identity: contract.distributionIdentity.bwrapSigstoreIdentity,
      issuer: contract.distributionIdentity.bwrapSigstoreIssuer,
    },
    {
      archiveSha256:
        "7b0604dc48a487e25dae35a1f200aaf125666c5c8ef73bc913e915cebc86ce7b",
      archiveBytes: 261_611,
      binaryPath: "/opt/crdd/providers/codex/0.149.1/codex-resources/bwrap",
      binarySha256:
        "01fb705f067bd5365b63d8ad2323a61c8d007733ca5e649437e086f3fb9935d8",
      binaryBytes: 529_776,
      bundleSha256:
        "2c8b6f67a874ecb25e231366302386450775266220c08d98625408171c0d0238",
      identity:
        "https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.149.1",
      issuer: "https://token.actions.githubusercontent.com",
    },
  );
  const dockerfile = fs.readFileSync(
    new URL("../runtime/codex-provider.Dockerfile", import.meta.url),
    "utf8",
  );
  assert.equal(
    dockerfile.includes(
      "COPY --chown=65534:65534 --chmod=0555 bwrap /opt/crdd/providers/codex/0.149.1/codex-resources/bwrap",
    ),
    true,
  );
  assert.equal(dockerfile.includes("dangerously-bypass"), false);
  assert.equal(dockerfile.includes("codex-code-mode-host"), false);
});

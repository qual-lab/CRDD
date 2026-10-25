/**
 * coordinator:integration:codex-execution-planの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:codex-execution-planが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @level IT
 * @scope codex、execution、plan
 * @boundary ERB-IT-001=Direct Boundary: Adapter→実CLI・Process・Container
 */
import { planProviderExecution } from "../../../ai-adapter/src/index.ts";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  projectCodexExecutionBoundary,
  describeProviderExecution,
  describeProviderAuthentication,
} from "../../../ai-adapter/src/index.ts";
import { describeDockerProviderExecutionLocations } from "../../../docker-isolation/src/index.ts";
import { describeDockerProviderAssets } from "../../../docker-isolation/src/index.ts";

import buildInputs from "../../../docker-isolation/images/build-inputs.json" with {
  type: "json",
};

/**
 * Codex固有の診断分類と不正入力拒否を確認する。
 * @responsibility 承認優先順と最初のsandbox値を固定する。
 * @trace ERB-IT-001
 * @precondition Docker包装を含まない非秘密の引数を使う。
 * @stimulus 固定組合せと不正配列をAI Adapter公開入口へ渡す。
 * @observation 非秘密の二分類とgetter呼出数。
 * @oracle 承認優先順・欠測分類を維持し、不正値は空配列相当に閉じる。
 * @cleanup N/A: 外部Effectなし。
 * @boundary ERB-IT-001=Direct Boundary: Coordinator試験→AI Adapter公開API。
 */
test("Codex境界診断はpayloadの承認優先順と最初のsandbox値を保持する", () => {
  for (const [argv, approvalModeConfigured, sandboxModeConfigured] of [
    [[], "other", "implicit"],
    [
      ["--approve-for-me", 'approval_policy="never"', "--sandbox", "read-only"],
      "approve_for_me",
      "read_only",
    ],
    [['approval_policy="never"'], "never", "implicit"],
    [["--sandbox"], "other", "implicit"],
    [["--sandbox", "other", "--sandbox", "read-only"], "other", "other"],
    [["--sandbox=read-only"], "other", "implicit"],
  ] as const)
    assert.deepEqual(projectCodexExecutionBoundary(argv), {
      approvalModeConfigured,
      sandboxModeConfigured,
    });
  let reads = 0;
  const accessor = Object.defineProperty([], "0", {
    enumerable: true,
    get() {
      reads += 1;
      return "--approve-for-me";
    },
  });
  for (const input of [null, [12], new Proxy([], {}), accessor])
    assert.deepEqual(projectCodexExecutionBoundary(input), {
      approvalModeConfigured: "other",
      sandboxModeConfigured: "implicit",
    });
  assert.equal(reads, 0);
  const maximum = ["--approve-for-me", ...Array(255).fill("value")];
  assert.deepEqual(projectCodexExecutionBoundary(maximum), {
    approvalModeConfigured: "approve_for_me",
    sandboxModeConfigured: "implicit",
  });
  assert.deepEqual(projectCodexExecutionBoundary([...maximum, "extra"]), {
    approvalModeConfigured: "other",
    sandboxModeConfigured: "implicit",
  });
});

/**
 * 公式Codex artifactとSubscription限定のread-only計画を固定するを検証する。
 *
 * @responsibility 公式Codex artifactとSubscription限定のread-only計画を固定するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公式Codex artifactとSubscription限定のread-only計画を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("公式Codex artifactとSubscription限定のread-only計画を固定する", () => {
  const authentication = describeProviderAuthentication("codex");
  assert.deepEqual(authentication.loginArgv, ["login", "--device-auth"]);
  assert.deepEqual(authentication.statusArgv, ["login", "status"]);
  assert.equal(authentication.offering, "chatgpt_subscription_oauth");
  assert.equal(authentication.authorityOrigin, "https://chatgpt.com");
  assert.ok(Object.isFrozen(authentication));
  assert.ok(Object.isFrozen(authentication.loginArgv));
  assert.ok(Object.isFrozen(authentication.statusArgv));
  const plan =
    planProviderExecution(
      {
        provider: "codex",
        purpose: "probe",
        input: {
          provider: "codex",
          mode: "read_only_probe",
          effort: "low",
        },
      },
      describeDockerProviderExecutionLocations("codex", "probe"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
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
});

/**
 * Executor計画が宣言するSeccomp identityは実配布資産と一致するを検証する。
 *
 * @responsibility Executor計画が宣言するSeccomp identityは実配布資産と一致するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Executor計画が宣言するSeccomp identityは実配布資産と一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Executor計画が宣言するSeccomp identityは実配布資産と一致する", () => {
  const bytes = fs.readFileSync(
    new URL(
      "../../../docker-isolation/src/execution/codex-executor-seccomp.json",
      import.meta.url,
    ),
  );
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    describeDockerProviderAssets("codex").identity.executorSeccompProfileSha256,
  );
  assert.equal(
    bytes.length,
    describeDockerProviderAssets("codex").identity.executorSeccompProfileBytes,
  );
});

/**
 * effort・Provider・shape差をEffect前に拒否するを検証する。
 *
 * @responsibility effort・Provider・shape差をEffect前に拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus effort・Provider・shape差をEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
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
    assert.equal(
      planProviderExecution(
        {
          provider: "codex",
          purpose: "probe",
          input: candidate,
        },
        describeDockerProviderExecutionLocations("codex", "probe"),
      ).status,
      "blocked",
    );
  }
});

/**
 * Codex Structured Output Schemaはboolean型を明示したexact形に固定するを検証する。
 *
 * @responsibility Codex Structured Output Schemaはboolean型を明示したexact形に固定するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex Structured Output Schemaはboolean型を明示したexact形に固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex Structured Output Schemaはboolean型を明示したexact形に固定する", () => {
  const schema = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../ai-adapter/src/codex/codex-result.json",
        import.meta.url,
      ),
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

/**
 * 一般Taskはroot denyとRole別workspace権限をstdin計画へ固定するを検証する。
 *
 * @responsibility 一般Taskはroot denyとRole別workspace権限をstdin計画へ固定するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 一般Taskはroot denyとRole別workspace権限をstdin計画へ固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("一般Taskはroot denyとRole別workspace権限をstdin計画へ固定する", () => {
  const executor =
    planProviderExecution(
      {
        provider: "codex",
        purpose: "task",
        modelSelection: {
          provider: "codex",
          modelIdentifier: "gpt-5.5",
          identifierKind: "exact",
          reasoningEffort: "low",
        },
        input: {
          provider: "codex",
          mode: "isolated_task",
          effort: "low",
          taskRole: "executor",
        },
      },
      describeDockerProviderExecutionLocations("codex", "task"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  const reviewer =
    planProviderExecution(
      {
        provider: "codex",
        purpose: "task",
        modelSelection: {
          provider: "codex",
          modelIdentifier: "gpt-5.5",
          identifierKind: "exact",
          reasoningEffort: "high",
        },
        input: {
          provider: "codex",
          mode: "isolated_task",
          effort: "high",
          taskRole: "reviewer",
        },
      },
      describeDockerProviderExecutionLocations("codex", "task"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  assert.equal(executor.status, "candidate");
  assert.equal(executor.exactModel, "gpt-5.5");

  assert.equal(executor.approvalMode, "automatic_review_workspace_write");
  assert.equal(executor.argv.includes("--approve-for-me"), true);
  assert.equal(executor.argv.includes("--sandbox"), false);
  assert.equal(executor.argv.includes('approval_policy="never"'), false);
  assert.equal(executor.argv.includes("--json"), true);
  assert.equal(reviewer.status, "candidate");
  assert.equal(reviewer.exactModel, "gpt-5.5");

  assert.equal(reviewer.approvalMode, "never_read_only");
  assert.equal(reviewer.argv.includes("--approve-for-me"), false);
  assert.equal(
    reviewer.argv[reviewer.argv.indexOf("--sandbox") + 1],
    "read-only",
  );
  assert.equal(reviewer.argv.includes('approval_policy="never"'), true);
  for (const plan of [executor, reviewer]) {
    assert.equal(plan.taskPromptTransport, "stdin_only");
    assert.equal(plan.taskPromptInArgvAllowed, false);
    assert.equal(plan.commandNetworkAccessAllowed, false);
    assert.equal(plan.webSearchAllowed, false);
    assert.equal(plan.providerHomeCommandReadAllowed, false);
    assert.equal(plan.argv.at(-1), "-");
    assert.equal(plan.argv.includes("--sandbox"), plan.taskRole === "reviewer");
    assert.equal(
      plan.argv.includes("features.respect_system_proxy=true"),
      true,
    );
    assert.equal(plan.argv.includes("features.code_mode_host=false"), true);
    assert.equal(
      plan.argv.includes(
        `features.shell_tool=${plan.taskRole === "executor" ? "true" : "false"}`,
      ),
      true,
    );
    assert.equal(
      plan.argv.includes(
        `features.unified_exec=${plan.taskRole === "executor" ? "true" : "false"}`,
      ),
      true,
    );
    assert.equal(
      plan.argv.some((value) => value.includes('filesystem={":root"="deny"')),
      true,
    );
    assert.equal(
      plan.argv.some((value) =>
        value.includes('"/opt/crdd/providers/codex/0.164.0/codex"="read"'),
      ),
      true,
    );
  }
});

/**
 * 一般Task SchemaはExecutorとReviewerのexact出力を分離するを検証する。
 *
 * @responsibility 一般Task SchemaはExecutorとReviewerのexact出力を分離するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 一般Task SchemaはExecutorとReviewerのexact出力を分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("一般Task SchemaはExecutorとReviewerのexact出力を分離する", () => {
  const executor = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../ai-adapter/src/codex/codex-executor-result.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const reviewer = JSON.parse(
    fs.readFileSync(
      new URL(
        "../../../ai-adapter/src/codex/codex-reviewer-result.json",
        import.meta.url,
      ),
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

/**
 * Codex Structured Output Schemaは公式対応部分集合だけを搬送するを検証する。
 *
 * @responsibility Codex Structured Output Schemaは公式対応部分集合だけを搬送するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Codex Structured Output Schemaは公式対応部分集合だけを搬送するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("Codex Structured Output Schemaは公式対応部分集合だけを搬送する", () => {
  const schemaPaths = [
    "../../../ai-adapter/src/codex/codex-result.json",
    "../../../ai-adapter/src/codex/codex-executor-result.json",
    "../../../ai-adapter/src/codex/codex-reviewer-result.json",
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
  /**
   * assertSupportedSubsetのTest準備責務を実行する。
   *
   * @responsibility assertSupportedSubsetがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace ERB-IT-001
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus assertSupportedSubsetを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
   */
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

/**
 * CLI公開契約は通常速度・API課金禁止を明示し配布検証を持たないを検証する。
 *
 * @responsibility CLI公開契約は通常速度・API課金禁止を明示し配布検証を持たないの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CLI公開契約は通常速度・API課金禁止を明示し配布検証を持たないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("CLI公開契約は通常速度・API課金禁止を明示し配布検証を持たない", () => {
  const contract = describeProviderExecution("codex");
  assert.equal(contract.contractRevision, 16);
  assert.equal("distributionVerification" in contract, false);
  assert.equal("distributionIdentity" in contract, false);

  assert.equal(
    describeDockerProviderAssets("codex").identity.executorSeccompProfileSha256,
    "01e577dd6fc81e04987af29b05389e9432dc0623a66aa435fd2f31f2b1070b95",
  );
  assert.equal(
    buildInputs.codex.identity.executorSeccompBaselineCommit,
    "c3065211177705ada59a9ccf8b5c182f286f8c97",
  );
  assert.equal(
    contract.authentication,
    "existing_chatgpt_subscription_oauth_only",
  );
  assert.equal(contract.apiKeyAllowed, false);
  assert.equal(contract.paidApiFallbackAllowed, false);
  assert.equal(contract.speedMode, "normal_only");
  assert.equal(Object.hasOwn(contract, "preferredModelFamily"), false);
  assert.equal(contract.readOnlyProbeExactModel, "gpt-5.6-sol");
  assert.deepEqual(contract.isolatedTaskExactModels, [
    "gpt-5.5",
    "gpt-6.1-sol",
  ]);
  assert.equal(
    contract.isolatedTask.structuredEventTransport,
    "fixed_cli_jsonl_v0_164_0",
  );

  assert.equal(
    contract.outboundProxyPolicy,
    "official_cli_respect_system_proxy_required",
  );
  assert.deepEqual(contract.efforts, ["low", "medium", "high"]);
});

/**
 * 固定Codex imageはbwrapとExecutor用の限定seccomp境界を固定するを検証する。
 *
 * @responsibility 固定Codex imageはbwrapとExecutor用の限定seccomp境界を固定するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Codex imageはbwrapとExecutor用の限定seccomp境界を固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: coordinator Test Source→対象契約
 */
test("固定Codex imageはbwrapとExecutor用の限定seccomp境界を固定する", () => {
  assert.deepEqual(
    {
      archiveSha256: buildInputs.codex.identity.bwrapArchiveSha256,
      archiveBytes: buildInputs.codex.identity.bwrapArchiveBytes,
      binaryPath: buildInputs.codex.identity.bwrapBinaryPath,
      binarySha256: buildInputs.codex.identity.bwrapBinarySha256,
      binaryBytes: buildInputs.codex.identity.bwrapBinaryBytes,
      bundleSha256: buildInputs.codex.identity.bwrapSigstoreBundleSha256,
      identity: buildInputs.codex.identity.bwrapSigstoreIdentity,
      issuer: buildInputs.codex.identity.bwrapSigstoreIssuer,
    },
    {
      archiveSha256:
        "60cd1c139823eabac2e4544cc75081d02af5100cfd276efa378dd48a123e109d",
      archiveBytes: 254_551,
      binaryPath: "/opt/crdd/providers/codex/0.164.0/codex-resources/bwrap",
      binarySha256:
        "3a81c19ad10a70436529c58e77898e2a447abe80167f813fc20ec34bd9eafdeb",
      binaryBytes: 513_520,
      bundleSha256:
        "b570206b836642f7299e9735792452de8eb162a155f942e0c839899dd38d6aba",
      identity:
        "https://github.com/openai/codex/.github/workflows/rust-release.yml@refs/tags/rust-v0.164.0",
      issuer: "https://token.actions.githubusercontent.com",
    },
  );
  const dockerfile = fs.readFileSync(
    new URL(
      "../../../docker-isolation/images/codex-provider.Dockerfile",
      import.meta.url,
    ),
    "utf8",
  );
  assert.equal(
    dockerfile.includes(
      "COPY --chown=0:0 --chmod=0555 bwrap /opt/crdd/providers/codex/0.164.0/codex-resources/bwrap",
    ),
    true,
  );
  assert.equal(dockerfile.includes("dangerously-bypass"), false);
  const executor =
    planProviderExecution(
      {
        provider: "codex",
        purpose: "task",
        modelSelection: {
          provider: "codex",
          modelIdentifier: "gpt-5.5",
          identifierKind: "exact",
          reasoningEffort: "low",
        },
        input: {
          provider: "codex",
          mode: "isolated_task",
          effort: "low",
          taskRole: "executor",
        },
      },
      describeDockerProviderExecutionLocations("codex", "task"),
    ).plan ?? assert.fail("provider_execution_plan_not_ready");
  if (executor.status !== "candidate") assert.fail(executor.reason);
  assert.equal(
    executor.argv.includes("--dangerously-bypass-approvals-and-sandbox"),
    false,
  );
  assert.equal(dockerfile.includes("codex-code-mode-host"), true);
});

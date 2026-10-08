/**
 * Workbench AI Provider Adapterの固定選択契約を検証する。
 *
 * @packageDocumentation
 * @responsibility exact Profile伝播、Provider分岐、Effect前拒否およびfallback禁止を検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Provider非依存Adapterと固定Fake Executorの局所境界。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  providerProfileMatchesExecutionIdentity,
  providerProfileSupportsExecution,
  normalizeProviderExactModelId,
  prepareProviderFixedEnvironment,
} from "../../../../ai-adapter/src/index.ts";
import { CODEX_FORBIDDEN_ENVIRONMENT_NAMES } from "../../../../ai-adapter/src/index.ts";
import { CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES } from "../../../../ai-adapter/src/index.ts";
import type { ResolvedAiProfileIdentity } from "../../../../ai-adapter/src/catalog/types.ts";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  resolveAiProfileById,
} from "../../../../ai-adapter/src/catalog/resolve.ts";
import { prepareWorkbenchAiAdviceTask } from "../../../src/workbench-ai/advice-task.ts";
import { createWorkbenchAiProviderAdapter } from "../../../src/workbench-ai/provider-adapter.ts";

const profile = resolveAiProfileById(
  DEFAULT_AI_PROFILE_CATALOG,
  "PROFILE-100001",
);
if (profile === null) throw new Error("test_profile_required");
const prepared = prepareWorkbenchAiAdviceTask({
  profileId: profile.profileId,
  prompt: "現在状態を説明する",
  projection: [
    {
      reference: "PROJECT_CONTEXT.md",
      content: "# Project Context\n",
      sha256:
        "f2e9caaf190981cfb75bb7e6ff59e7609b79b8e79280a721701dc88cfcef607d",
    },
  ],
});
if (prepared.status !== "prepared" || prepared.taskPacket === null)
  throw new Error("test_task_packet_required");

/**
 * 移管後のProfile検査が両Providerの正常値と単項目反例を保持する。
 *
 * @responsibility Provider／Offering、Role、Model、推論強度とexact Identityの検査を独立に反証する。
 * @trace ERB-UT-023
 * @precondition 既定CatalogのCodexとClaude coordinator Profileを解決する。
 * @stimulus 正常Profileと一項目だけが異なる候補をAI Adapterへ渡す。
 * @observation 純粋な二検査の真偽値と入力の不変性を取得する。
 * @oracle 正常値だけを受理し、各不一致を拒否して入力を変更しない。
 * @cleanup N/A: Processや外部資源を生成しない。
 * @boundary ERB-UT-023=Direct Boundary: Coordinator Consumer→AI Adapter Profile照合
 */
test("Profile照合の移管は両Providerの正常値と全五項目反例を保持する", () => {
  for (const profileId of ["PROFILE-100001", "PROFILE-200001"]) {
    const resolved = resolveAiProfileById(
      DEFAULT_AI_PROFILE_CATALOG,
      profileId,
    );
    assert.notEqual(resolved, null);
    const candidate = resolved as ResolvedAiProfileIdentity;
    const identity = Object.freeze({
      profileId: candidate.profileId,
      provider: candidate.provider,
      exactModelId: candidate.exactModelId,
      reasoningEffort: candidate.defaultReasoningEffort,
      offering: candidate.offering,
    });
    assert.equal(
      providerProfileSupportsExecution(candidate, "coordinator"),
      true,
    );
    assert.equal(
      providerProfileMatchesExecutionIdentity(candidate, identity),
      true,
    );
    for (const mutation of [
      { selectionRoles: [] },
      { exactModelId: "" },
      { allowedReasoningEfforts: [] },
      {
        offering:
          candidate.provider === "codex"
            ? "claude_max"
            : "chatgpt_subscription_oauth",
      },
    ]) {
      assert.equal(
        providerProfileSupportsExecution(
          Object.freeze({
            ...candidate,
            ...mutation,
          }) as ResolvedAiProfileIdentity,
          "coordinator",
        ),
        false,
      );
    }
    for (const mutation of [
      { profileId: "PROFILE-999999" },
      {
        provider:
          candidate.provider === "codex"
            ? ("claude" as const)
            : ("codex" as const),
      },
      { exactModelId: "different-model" },
      {
        reasoningEffort:
          "different-effort" as typeof candidate.defaultReasoningEffort,
      },
      {
        offering:
          candidate.provider === "codex"
            ? ("claude_max" as const)
            : ("chatgpt_subscription_oauth" as const),
      },
    ]) {
      assert.equal(
        providerProfileMatchesExecutionIdentity(candidate, {
          ...identity,
          ...mutation,
        }),
        false,
      );
    }
    assert.equal(
      providerProfileMatchesExecutionIdentity(
        { ...candidate, allowedReasoningEfforts: [] },
        identity,
      ),
      false,
    );
    assert.equal(candidate.profileId, profileId);
    assert.ok(Object.isFrozen(candidate));
  }
});

/**
 * exact Codex Profileを変更せず一つのExecutorへ渡すを検証する。
 *
 * @responsibility exact Codex Profileを変更せず一つのExecutorへ渡すを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus exact Codex Profileを変更せず一つのExecutorへ渡すの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("exact Codex Profileを変更せず一つのExecutorへ渡す", async () => {
  let codexInput: unknown = null;
  let claudeCalls = 0;
  const adapter = createWorkbenchAiProviderAdapter({
    codex: async (input) => {
      codexInput = input;
      return Object.freeze({
        status: "blocked" as const,
        reason: "fixture_completed",
        rawOutput: null,
        providerEffectIssued: false,
        cleanupConfirmed: true,
      });
    },
    claude: async () => {
      claudeCalls += 1;
      throw new Error("unreachable");
    },
  });
  const result = await adapter(
    Object.freeze({
      taskPacket: prepared.taskPacket,
      catalogRevision: 1,
      profile,
    }),
    new AbortController().signal,
  );
  assert.equal(result.reason, "fixture_completed");
  assert.equal(typeof codexInput, "object");
  const { providerCommand, ...flatInput } = codexInput as Record<
    string,
    unknown
  >;
  assert.deepEqual(flatInput, {
    contract: "crdd-coordinator/workbench-ai-advice-execution-plan",
    contractRevision: 1,
    mode: "workbench_advice",
    catalogRevision: 1,
    provider: profile.provider,
    providerPrompt: prepared.taskPacket.providerPrompt,
    taskHash: prepared.taskPacket.taskHash,
    projectionHash: prepared.taskPacket.projectionHash,
    profileId: profile.profileId,
    exactModelId: profile.exactModelId,
    reasoningEffort: profile.defaultReasoningEffort,
    offering: profile.offering,
    promptTransport: "stdin",
    repositoryMounted: false,
    workspaceMounted: false,
    toolsAllowed: false,
    sessionPersistenceAllowed: false,
    apiKeyFallbackAllowed: false,
    paidApiFallbackAllowed: false,
  });
  assert.deepEqual(
    {
      provider: (providerCommand as { provider: unknown }).provider,
      exactModelId: (providerCommand as { exactModelId: unknown }).exactModelId,
      reasoningEffort: (providerCommand as { reasoningEffort: unknown })
        .reasoningEffort,
      repositoryMounted: (providerCommand as { repositoryMounted: unknown })
        .repositoryMounted,
      workspaceMountRequired: (
        providerCommand as { workspaceMountRequired: unknown }
      ).workspaceMountRequired,
      toolsAllowed: (providerCommand as { toolsAllowed: unknown }).toolsAllowed,
    },
    {
      provider: "codex",
      exactModelId: profile.exactModelId,
      reasoningEffort: profile.defaultReasoningEffort,
      repositoryMounted: false,
      workspaceMountRequired: false,
      toolsAllowed: false,
    },
  );
  assert.equal(claudeCalls, 0);
});

/**
 * Profile契約不整合を全Executor Effect前に拒否するを検証する。
 *
 * @responsibility Profile契約不整合を全Executor Effect前に拒否するを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus Profile契約不整合を全Executor Effect前に拒否するの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("Profile契約不整合を全Executor Effect前に拒否する", async () => {
  let calls = 0;
  const adapter = createWorkbenchAiProviderAdapter({
    codex: async () => {
      calls += 1;
      throw new Error("unreachable");
    },
    claude: async () => {
      calls += 1;
      throw new Error("unreachable");
    },
  });
  const result = await adapter(
    Object.freeze({
      taskPacket: prepared.taskPacket,
      catalogRevision: 1,
      profile: Object.freeze({
        ...profile,
        offering: "claude_max" as const,
      }),
    }),
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.reason, "workbench_ai_provider_profile_invalid");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(calls, 0);
});

/**
 * TaskのProfile不一致はCoordinatorで停止する。
 *
 * @responsibility Profile検査の移管後もTask対応をCoordinatorが所有することを確認する。
 * @trace ERB-UT-023
 * @precondition 正常Profileと異なるProfile IDのTaskを用意する。
 * @stimulus Provider Adapterへ不一致Taskを渡す。
 * @observation 公開拒否結果と両Executorの呼出し数を取得する。
 * @oracle Profile検査が正常でもTask不一致を拒否し、Executorを呼ばない。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary ERB-UT-023=Direct Boundary: Task Identity→Coordinator Provider Adapter
 */
test("Task Profile不一致はAI Adapter移管後もExecutor Effect前に拒否する", async () => {
  let calls = 0;
  const adapter = createWorkbenchAiProviderAdapter({
    codex: async () => {
      calls += 1;
      throw new Error("unreachable");
    },
    claude: async () => {
      calls += 1;
      throw new Error("unreachable");
    },
  });
  const result = await adapter(
    {
      taskPacket: { ...prepared.taskPacket, profileId: "PROFILE-999999" },
      catalogRevision: 1,
      profile,
    },
    new AbortController().signal,
  );
  assert.equal(result.reason, "workbench_ai_provider_profile_invalid");
  assert.equal(result.providerEffectIssued, false);
  assert.equal(calls, 0);
});

/**
 * Model構文と固定環境の移管が既存の受理・拒否集合を保持する。
 *
 * @responsibility 文字数境界、禁止名全数、値の不正、順序と一回取得を反証する。
 * @trace ERB-UT-023
 * @precondition 両Providerの固定禁止集合と局所環境候補を使用する。
 * @stimulus 正常値、境界値、禁止名、非文字列とNULを純粋検査へ渡す。
 * @observation Model結果、環境組の順序、取得回数と入力不変性を確認する。
 * @oracle 既存構文と禁止集合に一致し、同じSnapshotを一回だけ取得して返す。
 * @cleanup N/A: 環境変数やProcessを実際には変更しない。
 * @boundary ERB-UT-023=Direct Boundary: Coordinator計画→AI Adapter固定値検査
 */
test("Modelと固定環境の単一移管は構文境界・禁止集合・一回取得を保持する", () => {
  for (const model of ["gpt-5.5", "claude-opus-4.8", "a".repeat(128)]) {
    assert.equal(normalizeProviderExactModelId(model), model);
  }
  for (const model of [
    "",
    "a".repeat(129),
    "GPT-5.5",
    " gpt-5.5",
    "gpt 5.5",
    "gpt\0",
    "-gpt",
    "gpt/5.5",
  ]) {
    assert.equal(normalizeProviderExactModelId(model), null);
  }
  for (const [provider, forbiddenNames] of [
    ["codex", CODEX_FORBIDDEN_ENVIRONMENT_NAMES],
    ["claude", CLAUDE_FORBIDDEN_ENVIRONMENT_NAMES],
  ] as const) {
    const environment = Object.freeze({
      PROVIDER_HOME: "/provider-home",
      FIXED_EMPTY: "",
      FIXED_VALUE: "value",
    });
    assert.deepEqual(
      prepareProviderFixedEnvironment(provider, environment),
      Object.entries(environment),
    );
    assert.deepEqual(prepareProviderFixedEnvironment(provider, {}), []);
    for (const name of forbiddenNames) {
      assert.equal(
        prepareProviderFixedEnvironment(provider, { [name]: "forbidden" }),
        null,
      );
    }
    assert.equal(
      prepareProviderFixedEnvironment(provider, { FIXED: "nul\0value" }),
      null,
    );
    assert.equal(
      prepareProviderFixedEnvironment(provider, {
        FIXED: 1,
      } as unknown as Record<string, string>),
      null,
    );
    let reads = 0;
    const accessor = Object.defineProperty({}, "FIXED", {
      enumerable: true,
      get: () => {
        reads += 1;
        return "snapshot";
      },
    });
    assert.deepEqual(prepareProviderFixedEnvironment(provider, accessor), [
      ["FIXED", "snapshot"],
    ]);
    assert.equal(reads, 1);
    assert.deepEqual(environment, {
      PROVIDER_HOME: "/provider-home",
      FIXED_EMPTY: "",
      FIXED_VALUE: "value",
    });
  }
});

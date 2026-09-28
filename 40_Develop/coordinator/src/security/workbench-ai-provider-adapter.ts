/**
 * Workbench読取り助言を固定Provider実行境界へ振り分ける。
 *
 * @packageDocumentation
 * @responsibility 解決済みProfileのProvider、Modelおよび推論強度を変更せずProvider固有Executorへ渡す。
 * @trace ARCH-000010 ARCH-000015
 * @boundary Workbench AI DispatchとCodex／Claude固定実行境界の間。
 * @effect 選択された一つのProvider Executorだけを最大一回呼び出す。
 * @security 任意実行Path、任意CLI引数、API Key fallbackおよび自動Provider切替を受理しない。
 */
import type {
  WorkbenchAiAdviceProviderAdapter,
  WorkbenchAiAdviceProviderInput,
  WorkbenchAiAdviceProviderOutcome,
} from "./workbench-ai-advice-dispatch-runtime.ts";
import {
  prepareWorkbenchAiAdviceExecutionPlan,
  type WorkbenchAiAdviceExecutionPlan,
  type WorkbenchAiProviderExecutionInput,
} from "./workbench-ai-advice-execution-plan.ts";

export const WORKBENCH_AI_PROVIDER_ADAPTER_CONTRACT =
  "crdd-coordinator/workbench-ai-provider-adapter";
export const WORKBENCH_AI_PROVIDER_ADAPTER_CONTRACT_REVISION = 1;

export type { WorkbenchAiProviderExecutionInput };

export type WorkbenchAiProviderExecutor = (
  executionPlan: WorkbenchAiAdviceExecutionPlan,
  cancellationSignal: AbortSignal,
) => Promise<WorkbenchAiAdviceProviderOutcome>;

export type WorkbenchAiProviderExecutors = Readonly<{
  codex: WorkbenchAiProviderExecutor;
  claude: WorkbenchAiProviderExecutor;
}>;

/**
 * Workbench専用Provider Adapterを生成する。
 *
 * @responsibility exact ProfileをProvider固有Executorへ写像し、別Provider、別Modelまたは別推論強度への暗黙切替を防ぐ。
 * @trace ARCH-000010 ARCH-000015
 * @input executors: CodexとClaudeの固定実行境界。
 * @returns Workbench AI Dispatchへ注入できるProvider Adapter。
 * @precondition 各Executorは固定配布物、Subscription認証、取消およびcleanup契約を所有する。
 * @postcondition 選択ProfileのProviderに対応するExecutorだけが同じTask Identityで呼び出される。
 * @effect 一依頼につき選択Provider Executorを最大一回呼び出す。
 * @failure Profile契約不整合はExecutor Effect前にblockedで返す。
 * @invariant Provider、Model、推論強度およびOfferingをfallbackで変更しない。
 * @boundary Provider非依存DispatchとProvider固有実行境界の間。
 * @security API Key、任意Command、任意PathおよびProvider生設定を入力へ含めない。
 * @concurrency 共有選択状態を持たず、呼出し入力だけでExecutorを決定する。
 */
export function createWorkbenchAiProviderAdapter(
  executors: WorkbenchAiProviderExecutors,
): WorkbenchAiAdviceProviderAdapter {
  return async (
    input: WorkbenchAiAdviceProviderInput,
    cancellationSignal: AbortSignal,
  ) => {
    if (!profileExecutionIsValid(input))
      return Object.freeze({
        status: "blocked" as const,
        reason: "workbench_ai_provider_profile_invalid",
        rawOutput: null,
        providerEffectIssued: false,
        cleanupConfirmed: true,
      });
    const executionInput = Object.freeze({
      catalogRevision: input.catalogRevision,
      provider: input.profile.provider,
      providerPrompt: input.taskPacket.providerPrompt,
      taskHash: input.taskPacket.taskHash,
      projectionHash: input.taskPacket.projectionHash,
      profileId: input.profile.profileId,
      exactModelId: input.profile.exactModelId,
      reasoningEffort: input.profile.defaultReasoningEffort,
      offering: input.profile.offering,
    });
    const prepared = prepareWorkbenchAiAdviceExecutionPlan(
      executionInput,
      input.profile,
    );
    if (prepared.status !== "prepared" || prepared.executionPlan === null)
      return Object.freeze({
        status: "blocked" as const,
        reason: "workbench_ai_advice_execution_plan_invalid",
        rawOutput: null,
        providerEffectIssued: false,
        cleanupConfirmed: true,
      });
    return input.profile.provider === "codex"
      ? executors.codex(prepared.executionPlan, cancellationSignal)
      : executors.claude(prepared.executionPlan, cancellationSignal);
  };
}

/**
 * Workbench Provider Adapterの公開契約を返す。
 *
 * @responsibility Provider選択、Profile伝播、fallback禁止およびExecutor責務を利用側へ示す。
 * @trace ARCH-000010 ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns revision 1の固定契約。
 * @precondition N/A: 定数だけを参照する。
 * @postcondition 実装と試験が同じProvider選択条件を参照できる。
 * @effect N/A: 固定値を返すだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Profile外のProvider、Modelおよび推論強度を選ばない。
 * @boundary 公開契約と利用側の境界。
 * @security API Key fallbackと自動Provider切替を許可しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function describeWorkbenchAiProviderAdapterContract() {
  return Object.freeze({
    contract: WORKBENCH_AI_PROVIDER_ADAPTER_CONTRACT,
    contractRevision: WORKBENCH_AI_PROVIDER_ADAPTER_CONTRACT_REVISION,
    providers: Object.freeze(["codex", "claude"] as const),
    exactProfilePropagationRequired: true,
    automaticProviderFallbackAllowed: false,
    automaticModelFallbackAllowed: false,
    apiKeyFallbackAllowed: false,
    providerExecutorOwnsRuntimeLifecycle: true,
  });
}

/**
 * 解決済みProfileが一回送信Executorへ渡せる閉じた契約か判定する。
 *
 * @responsibility Task/Profile対応、Role、Model、推論強度およびOfferingの整合をEffect前に確認する。
 * @trace ARCH-000010 ARCH-000015
 * @input input: Workbench AI Provider入力。
 * @returns Profile実行条件をすべて満たす場合だけtrue。
 * @precondition DispatchがTaskとProfile Identityの基本一致を確認済みである。
 * @postcondition trueでもProvider Effect Authorityや認証成立は主張しない。
 * @effect N/A: 読取りだけを行う。
 * @failure 不整合をfalseとして返す。
 * @invariant 許可集合外のModelまたは推論強度をcoerceしない。
 * @boundary 解決済みProfileとProvider固有Executorの境界。
 * @security coordinator RoleとSubscription Offering以外を送信対象へ昇格しない。
 * @concurrency N/A: 共有状態を変更しない同期検査である。
 */
function profileExecutionIsValid(input: WorkbenchAiAdviceProviderInput) {
  return (
    input.taskPacket.profileId === input.profile.profileId &&
    input.profile.selectionRoles.includes("coordinator") &&
    input.profile.exactModelId.length > 0 &&
    input.profile.allowedReasoningEfforts.includes(
      input.profile.defaultReasoningEffort,
    ) &&
    ((input.profile.provider === "codex" &&
      input.profile.offering === "chatgpt_subscription_oauth") ||
      (input.profile.provider === "claude" &&
        input.profile.offering === "claude_max"))
  );
}

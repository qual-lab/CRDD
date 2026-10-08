/**
 * Workbench助言計画をProvider Runtime lifecycleへ接続する。
 *
 * @packageDocumentation
 * @responsibility 標準入力送信、取消、cleanup確認およびRuntime抽出済み助言JSONの受理を一つの助言実行Lifecycleへ閉じる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @boundary Workbench Provider Adapterと署名Provider Runtime lifecycleの間。
 * @effect 注入されたRuntime Portを通じて選択Providerを最大一回実行する。
 * @security Repository非共有の検証済みCommand PlanとPromptだけをRuntime Portへ渡し、生Provider出力を公開しない。
 */
import type { WorkbenchAiAdviceProviderOutcome } from "./advice-dispatch.ts";
import type { WorkbenchAiAdviceExecutionPlan } from "./advice-execution-plan.ts";

export const WORKBENCH_AI_ADVICE_PROVIDER_EXECUTOR_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-provider-executor";
export const WORKBENCH_AI_ADVICE_PROVIDER_EXECUTOR_CONTRACT_REVISION = 1;

/**
 * Workbench助言Provider ExecutorのRuntime接続境界で使用するWorkbenchAiAdviceRuntimeResultの構造を固定する。
 *
 * @responsibility Workbench助言Provider ExecutorのRuntime接続境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceRuntimeResult = Readonly<
  | {
      status: "completed";
      reason: null;
      adviceJson: string;
      providerEffectIssued: true;
      cleanupConfirmed: true;
    }
  | {
      status: "blocked";
      reason: string;
      adviceJson: null;
      providerEffectIssued: boolean;
      cleanupConfirmed: boolean;
    }
>;

/**
 * Workbench助言Provider ExecutorのRuntime接続境界で使用するWorkbenchAiAdviceRuntimePortの構造を固定する。
 *
 * @responsibility Workbench助言Provider ExecutorのRuntime接続境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceRuntimePort = (
  executionPlan: WorkbenchAiAdviceExecutionPlan,
  cancellationSignal: AbortSignal,
) => Promise<WorkbenchAiAdviceRuntimeResult>;

/**
 * Workbench助言用Provider Executorを生成する。
 *
 * @responsibility 検証済み計画だけをRuntimeへ渡し、cleanup後にRuntimeが抽出した共通助言JSONだけを受理する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input runtime: 署名Provider Runtime lifecycleを所有するPort。
 * @returns Provider Adapterへ注入できるExecutor。
 * @precondition runtimeはProcess、Network、取消およびcleanupを所有する。
 * @postcondition completed時はRuntimeが抽出済みの助言JSONだけをrawOutputへ格納する。
 * @effect Executor呼出しごとにruntimeを最大一回呼び出す。
 * @failure 事前取消、Plan不整合、Runtime拒否、cleanup未確認または出力不正をblockedで返す。
 * @invariant Provider、Model、推論強度およびPromptを変更しない。
 * @boundary Provider非依存AdapterとProvider Runtime lifecycleの間。
 * @security Repository、Workspace、ToolまたはSessionを許す計画をEffect前に拒否し、生出力を公開しない。
 * @concurrency Runtime呼出しごとに受け取ったAbortSignalだけを使用し共有状態を持たない。
 */
export function createWorkbenchAiAdviceProviderExecutor(
  runtime: WorkbenchAiAdviceRuntimePort,
) {
  return async (
    executionPlan: WorkbenchAiAdviceExecutionPlan,
    cancellationSignal: AbortSignal,
  ): Promise<WorkbenchAiAdviceProviderOutcome> => {
    if (cancellationSignal.aborted)
      return blocked(
        "workbench_ai_advice_cancelled_before_provider_effect",
        false,
        true,
      );
    if (!safePlan(executionPlan))
      return blocked("workbench_ai_advice_runtime_plan_invalid", false, true);

    let result: WorkbenchAiAdviceRuntimeResult;
    try {
      result = await runtime(executionPlan, cancellationSignal);
    } catch {
      return blocked("workbench_ai_advice_runtime_failed_closed", true, false);
    }
    if (
      result.status !== "completed" ||
      result.adviceJson === null ||
      !result.providerEffectIssued ||
      !result.cleanupConfirmed
    )
      return blocked(
        result.reason ?? "workbench_ai_advice_runtime_incomplete",
        result.providerEffectIssued,
        result.cleanupConfirmed,
      );

    return Object.freeze({
      status: "completed" as const,
      reason: null,
      rawOutput: result.adviceJson,
      providerEffectIssued: true as const,
      cleanupConfirmed: true as const,
    });
  };
}

/**
 * 実行計画が助言専用の非共有境界を維持するか判定する。
 *
 * @responsibility 外部Effect直前に上位計画とProvider CommandのIdentity・禁止条件を再照合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input plan: Workbench助言実行計画。
 * @returns Effect発行可能な閉じた計画の場合だけtrue。
 * @precondition planはProvider Adapterから渡されるが信頼済みと仮定しない。
 * @postcondition trueの場合はProvider、Model、推論強度、共有境界が一致する。
 * @effect N/A: 値比較だけを行う。
 * @failure 不整合をfalseとして返す。
 * @invariant boolean条件から新しいAuthorityを生成しない。
 * @boundary 検証済み計画と外部Effectの直前境界。
 * @security Repository、Workspace、Tool、SessionまたはFallbackを許す計画を拒否する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function safePlan(plan: WorkbenchAiAdviceExecutionPlan) {
  return (
    plan.mode === "workbench_advice" &&
    plan.providerCommand.provider === plan.provider &&
    plan.providerCommand.exactModelId === plan.exactModelId &&
    plan.providerCommand.reasoningEffort === plan.reasoningEffort &&
    plan.providerCommand.promptTransport === "stdin_only" &&
    plan.providerCommand.repositoryMounted === false &&
    plan.providerCommand.workspaceMountRequired === false &&
    plan.providerCommand.toolsAllowed === false &&
    plan.providerCommand.sessionPersistenceAllowed === false &&
    plan.repositoryMounted === false &&
    plan.workspaceMounted === false &&
    plan.toolsAllowed === false &&
    plan.sessionPersistenceAllowed === false &&
    plan.apiKeyFallbackAllowed === false &&
    plan.paidApiFallbackAllowed === false
  );
}

/**
 * Provider Executorの拒否結果を生成する。
 *
 * @responsibility Effect発行とcleanup状態を失わず、生出力なしの公開結果へ閉じる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input reason: 拒否理由、providerEffectIssued: Effect発行有無、cleanupConfirmed: cleanup確認結果。
 * @returns rawOutputを含まないblocked結果。
 * @precondition reasonは秘密値やProvider本文を含まない。
 * @postcondition rawOutputは常にnullである。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant Effect発行済みを未発行へ畳まない。
 * @boundary 内部Runtime結果と公開Provider Outcomeの間。
 * @security 生Provider出力を返さない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function blocked(
  reason: string,
  providerEffectIssued: boolean,
  cleanupConfirmed: boolean,
): WorkbenchAiAdviceProviderOutcome {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    rawOutput: null,
    providerEffectIssued,
    cleanupConfirmed,
  });
}

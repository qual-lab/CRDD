/**
 * Workbench読取り助言を同じ単発Provider Runtimeへ接続する。
 *
 * @packageDocumentation
 * @responsibility 解決済みProfileを検査し、Provider・Model・推論強度を変えず同じRuntimeへexact計画を一回渡す。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @boundary Workbench AI DispatchとCodex／Claude固定実行境界の間。
 * @effect 選択された一つのProvider Executorだけを最大一回呼び出す。
 * @security 任意実行Path、任意CLI引数、API Key fallbackおよび自動Provider切替を受理しない。
 */
import { providerProfileSupportsExecution } from "../../../ai-adapter/src/index.ts";
import type {
  WorkbenchAiAdviceProviderAdapter,
  WorkbenchAiAdviceProviderInput,
  WorkbenchAiAdviceProviderOutcome,
} from "./advice-dispatch.ts";
import {
  prepareWorkbenchAiAdviceExecutionPlan,
  type WorkbenchAiAdviceExecutionPlan,
  type WorkbenchAiProviderExecutionInput,
} from "./advice-execution-plan.ts";

export const WORKBENCH_AI_PROVIDER_ADAPTER_CONTRACT =
  "crdd-coordinator/workbench-ai-provider-adapter";
export const WORKBENCH_AI_PROVIDER_ADAPTER_CONTRACT_REVISION = 1;

export type { WorkbenchAiProviderExecutionInput };

/**
 * Workbench専用Provider Adapterを生成する。
 *
 * @responsibility exact Profileから計画を作り、単一Runtimeへの搬送前に非共有条件とProvider・Model・推論強度を確認する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input runtime: 解決済みProvider計画を一度だけ実行する共通境界。
 * @returns Workbench AI Dispatchへ注入できるProvider Adapter。
 * @precondition runtimeは固定配布物、Subscription認証、取消およびcleanup契約を所有する。
 * @postcondition 同じTask Identityと選択Profileの計画でruntimeを最大一回呼び出す。
 * @effect 一依頼につき選択Provider Executorを最大一回呼び出す。
 * @failure Profile契約不整合はExecutor Effect前にblockedで返す。
 * @invariant Provider、Model、推論強度およびOfferingをfallbackで変更しない。
 * @boundary Provider非依存DispatchとProvider固有実行境界の間。
 * @security API Key、任意Command、任意PathおよびProvider生設定を入力へ含めない。
 * @concurrency 共有選択状態を持たず、呼出し入力だけでExecutorを決定する。
 */
export function createWorkbenchAiProviderAdapter(
  runtime: WorkbenchAiAdviceRuntimePort,
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
      networkPolicy: input.networkPolicy,
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
    return executeAdvicePlan(
      runtime,
      prepared.executionPlan,
      cancellationSignal,
    );
  };
}

/**
 * Workbench Provider Adapterの公開契約を返す。
 *
 * @responsibility Provider選択、Profile伝播、fallback禁止およびExecutor責務を利用側へ示す。
 * @trace ARCH-000010
 * @trace ARCH-000015
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
 * @trace ARCH-000010
 * @trace ARCH-000015
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
    providerProfileSupportsExecution(input.profile, "coordinator")
  );
}
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
 * 検証した助言計画を同じ単発Runtimeへ一度だけ渡す。
 *
 * @responsibility 検証済み計画だけをRuntimeへ渡し、cleanup後にRuntimeが抽出した共通助言JSONだけを受理する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input runtime: 用途固定の単発Runtime、executionPlan: exact助言計画、cancellationSignal: 元の取消Signal。
 * @returns Promise<WorkbenchAiAdviceProviderOutcome>として終了・Effect・cleanupの相関結果を返す。
 * @precondition runtimeはProcess、Network、取消およびcleanupを所有する。
 * @postcondition completed時はRuntimeが抽出済みの助言JSONだけをrawOutputへ格納する。
 * @effect Executor呼出しごとにruntimeを最大一回呼び出す。
 * @failure 事前取消、Plan不整合、Runtime拒否、cleanup未確認または出力不正をblockedで返す。
 * @invariant Provider、Model、推論強度およびPromptを変更しない。
 * @boundary Provider非依存AdapterとProvider Runtime lifecycleの間。
 * @security Repository、Workspace、ToolまたはSessionを許す計画をEffect前に拒否し、生出力を公開しない。
 * @concurrency Runtime呼出しごとに受け取ったAbortSignalだけを使用し共有状態を持たない。
 */
async function executeAdvicePlan(
  runtime: WorkbenchAiAdviceRuntimePort,
  executionPlan: WorkbenchAiAdviceExecutionPlan,
  cancellationSignal: AbortSignal,
): Promise<WorkbenchAiAdviceProviderOutcome> {
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

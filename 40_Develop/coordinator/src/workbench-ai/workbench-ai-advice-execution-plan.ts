/**
 * Workbench読取り助言をProvider実行へ渡す直前の閉じた実行計画を生成する。
 *
 * @packageDocumentation
 * @responsibility Catalogで固定されたProvider、Model、推論強度とTask Identityを、Repository非共有の一回実行計画へ変換する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @boundary Workbench Provider AdapterとProvider固有Executorの間。
 * @effect N/A: 実行計画を生成するだけでProvider Effectを発行しない。
 * @security Promptは標準入力だけで搬送し、Repository、Workspace、Tool、Session、API Key fallbackを許可しない。
 */
import type {
  AiReasoningEffort,
  ResolvedAiProfileIdentity,
} from "../../../ai-runtime/src/ai-profile-types.ts";
import {
  planWorkbenchAiAdviceProviderCommand,
  type WorkbenchAiAdviceProviderCommand,
} from "./workbench-ai-advice-provider-command.ts";

export const WORKBENCH_AI_ADVICE_EXECUTION_PLAN_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-execution-plan";
export const WORKBENCH_AI_ADVICE_EXECUTION_PLAN_CONTRACT_REVISION = 1;

const SHA256 = /^[a-f0-9]{64}$/u;
const EXECUTION_INPUT_KEYS = Object.freeze([
  "catalogRevision",
  "exactModelId",
  "offering",
  "profileId",
  "projectionHash",
  "provider",
  "providerPrompt",
  "reasoningEffort",
  "taskHash",
]);

/**
 * Workbench助言の固定Provider実行計画で使用するWorkbenchAiProviderExecutionInputの構造を固定する。
 *
 * @responsibility Workbench助言の固定Provider実行計画が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiProviderExecutionInput = Readonly<{
  catalogRevision: number;
  provider: "codex" | "claude";
  providerPrompt: string;
  taskHash: string;
  projectionHash: string;
  profileId: string;
  exactModelId: string;
  reasoningEffort: AiReasoningEffort;
  offering: "chatgpt_subscription_oauth" | "claude_max";
}>;

/**
 * Workbench助言の固定Provider実行計画で使用するWorkbenchAiAdviceExecutionPlanの構造を固定する。
 *
 * @responsibility Workbench助言の固定Provider実行計画が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceExecutionPlan = Readonly<{
  contract: typeof WORKBENCH_AI_ADVICE_EXECUTION_PLAN_CONTRACT;
  contractRevision: typeof WORKBENCH_AI_ADVICE_EXECUTION_PLAN_CONTRACT_REVISION;
  mode: "workbench_advice";
  catalogRevision: number;
  provider: WorkbenchAiProviderExecutionInput["provider"];
  profileId: string;
  exactModelId: string;
  reasoningEffort: WorkbenchAiProviderExecutionInput["reasoningEffort"];
  offering: WorkbenchAiProviderExecutionInput["offering"];
  providerPrompt: string;
  promptTransport: "stdin";
  taskHash: string;
  projectionHash: string;
  repositoryMounted: false;
  workspaceMounted: false;
  toolsAllowed: false;
  sessionPersistenceAllowed: false;
  apiKeyFallbackAllowed: false;
  paidApiFallbackAllowed: false;
  providerCommand: WorkbenchAiAdviceProviderCommand;
}>;

/**
 * Workbench助言の固定Provider実行計画で使用するWorkbenchAiAdviceExecutionPlanPreparationの構造を固定する。
 *
 * @responsibility Workbench助言の固定Provider実行計画が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceExecutionPlanPreparation = Readonly<
  | {
      status: "prepared";
      reason: null;
      executionPlan: WorkbenchAiAdviceExecutionPlan;
    }
  | {
      status: "blocked";
      reason: "workbench_ai_advice_execution_plan_invalid";
      executionPlan: null;
    }
>;

/**
 * Workbench読取り助言の固定実行計画を生成する。
 *
 * @responsibility Catalogと完全一致する実行IdentityだけをRepository非共有・標準入力搬送の計画へ変換する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: Provider Adapterが生成した閉じた実行入力、catalog: 採用済みAI Profile Catalog。
 * @returns 検証済み実行計画、またはEffect前の拒否結果。
 * @precondition catalogは呼出し側が指定する改訂に対応する候補である。
 * @postcondition preparedの場合もProvider Effect Authority、認証成立または実行完了を主張しない。
 * @effect N/A: 入力検査と固定値生成だけを行う。
 * @failure Catalog不一致、未知Property、不正HashまたはProvider境界不整合をblockedで返す。
 * @invariant Provider、Model、推論強度、OfferingおよびTask Identityを補完・変更しない。
 * @boundary 検証済みProfile IdentityとProvider固有実行境界の間。
 * @security Repository、Workspace、Tool、Session、API Keyおよび有料Fallbackを計画上で禁止する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function prepareWorkbenchAiAdviceExecutionPlan(
  input: WorkbenchAiProviderExecutionInput,
  profile: ResolvedAiProfileIdentity,
): WorkbenchAiAdviceExecutionPlanPreparation {
  const keys = Object.keys(input).sort();
  if (
    keys.length !== EXECUTION_INPUT_KEYS.length ||
    !keys.every((key, index) => key === EXECUTION_INPUT_KEYS[index]) ||
    !Number.isSafeInteger(input.catalogRevision) ||
    input.catalogRevision < 0 ||
    input.providerPrompt.trim().length === 0 ||
    !SHA256.test(input.taskHash) ||
    !SHA256.test(input.projectionHash)
  )
    return blocked();

  if (
    !profile.selectionRoles.includes("coordinator") ||
    profile.profileId !== input.profileId ||
    profile.provider !== input.provider ||
    profile.exactModelId !== input.exactModelId ||
    profile.defaultReasoningEffort !== input.reasoningEffort ||
    profile.offering !== input.offering ||
    !profile.allowedReasoningEfforts.includes(input.reasoningEffort)
  )
    return blocked();

  return Object.freeze({
    status: "prepared" as const,
    reason: null,
    executionPlan: Object.freeze({
      contract: WORKBENCH_AI_ADVICE_EXECUTION_PLAN_CONTRACT,
      contractRevision: WORKBENCH_AI_ADVICE_EXECUTION_PLAN_CONTRACT_REVISION,
      mode: "workbench_advice" as const,
      catalogRevision: input.catalogRevision,
      provider: input.provider,
      profileId: input.profileId,
      exactModelId: input.exactModelId,
      reasoningEffort: input.reasoningEffort,
      offering: input.offering,
      providerPrompt: input.providerPrompt,
      promptTransport: "stdin" as const,
      taskHash: input.taskHash,
      projectionHash: input.projectionHash,
      repositoryMounted: false as const,
      workspaceMounted: false as const,
      toolsAllowed: false as const,
      sessionPersistenceAllowed: false as const,
      apiKeyFallbackAllowed: false as const,
      paidApiFallbackAllowed: false as const,
      providerCommand: planWorkbenchAiAdviceProviderCommand({
        provider: input.provider,
        exactModelId: input.exactModelId,
        reasoningEffort: input.reasoningEffort,
      }),
    }),
  });
}

/**
 * Workbench助言実行計画の拒否結果を生成する。
 *
 * @responsibility すべての計画不整合をEffect 0の同一公開結果へ閉じる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input N/A: 固定拒否結果だけを生成する。
 * @returns 実行計画を含まないblocked結果。
 * @precondition N/A: 呼出し条件を持たない。
 * @postcondition executionPlanは常にnullである。
 * @effect N/A: 固定値を生成するだけである。
 * @failure N/A: この関数自身は失敗分岐を持たない。
 * @invariant 不正入力の詳細や秘密値を公開理由へ含めない。
 * @boundary 内部検証理由と公開拒否結果の境界。
 * @security Prompt、Profile詳細およびHashを結果へ複製しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function blocked(): WorkbenchAiAdviceExecutionPlanPreparation {
  return Object.freeze({
    status: "blocked" as const,
    reason: "workbench_ai_advice_execution_plan_invalid" as const,
    executionPlan: null,
  });
}

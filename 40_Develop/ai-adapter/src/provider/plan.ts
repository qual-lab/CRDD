/**
 * 用途別Provider実行の共通計画と公開型を所有する。
 * @responsibility 用途・Providerの振分けと計画結果を所有し、起動・認可・回収を行わない。
 * @trace ARCH-000010
 * @trace ARCH-000015
 */
import type { AiProvider, AiReasoningEffort } from "./types.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";
import { validateProviderModelId } from "../profile/validation.ts";
import {
  planCodexAdviceCommand,
  planCodexIsolatedTask,
  planCodexReadOnlyProbe,
  describeCodexExecutionPlanContract,
} from "../codex/plan.ts";
import {
  planClaudeAdviceCommand,
  planClaudeIsolatedTask,
  planClaudeReadOnlyProbe,
  buildClaudeExecutionArguments,
  planClaudeTaskTurnBudget,
  describeClaudeExecutionPlanContract,
} from "../claude/plan.ts";
import type { ProviderExecutionLocations } from "./types.ts";

export const PROVIDER_ADVICE_COMMAND_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-provider-command";
export const PROVIDER_ADVICE_COMMAND_CONTRACT_REVISION = 1;

/**
 * Provider計画で使う選定済みModelと推論強度を表す。
 *
 * @responsibility 用途共通のProvider・Model・推論強度を保持し、選定のAuthorityを発行しない。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderModelSelection = Readonly<{
  provider: "codex" | "claude";
  exactModelId: string;
  reasoningEffort: AiReasoningEffort;
}>;

/**
 * Workbench助言のProvider Command境界で使用するProviderAdvicePlanの構造を固定する。
 *
 * @responsibility Workbench助言のProvider Command境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type ProviderAdvicePlan = Readonly<{
  contract: typeof PROVIDER_ADVICE_COMMAND_CONTRACT;
  contractRevision: typeof PROVIDER_ADVICE_COMMAND_CONTRACT_REVISION;
  provider: "codex" | "claude";
  command: string;
  argv: readonly string[];
  environment: Readonly<Record<string, string>>;
  exactModelId: string;
  reasoningEffort: AiReasoningEffort;
  promptTransport: "stdin_only";
  resultTransport: "codex_cli_jsonl" | "claude_json_envelope";
  toolsAllowed: false;
  sessionPersistenceAllowed: false;
}>;

/**
 * Providerごとの固定実行定義を表す。
 * @responsibility 対応Providerの配布・制約記述を型付きで提供する。
 * @trace ARCH-000010
 * @shape Provider引数に対応する既存の不変定義。
 * @invariant 定義取得を現在の認証・実行成立とみなさない。
 * @boundary 共通APIと固定CLI定義。
 * @security 実行Authority・秘密値を含めない。
 * @compatibility 既存describe結果のfieldと値を維持する。
 */
export type ProviderExecutionDefinition<P extends AiProvider = AiProvider> =
  P extends "codex"
    ? ReturnType<typeof describeCodexExecutionPlanContract>
    : ReturnType<typeof describeClaudeExecutionPlanContract>;

/**
 * Providerの固定実行条件を取得する。
 * @responsibility 固定Provider識別から対応する不変定義を選ぶ。
 * @trace ARCH-000010
 * @input provider: 対応する識別子。
 * @returns 固定配布・実行制約の定義。
 * @precondition 対応するProviderを指定する。
 * @postcondition 定義の内容や実資源を変更しない。
 * @effect N/A: 固定定義を返すだけ。
 * @failure 不明Providerは固定エラーで拒否する。
 * @invariant 不明ProviderをClaudeへ配送しない。
 * @boundary 利用側とProvider固有定義。
 * @security 認証値・起動許可を返さない。
 * @concurrency N/A: 同期で共有可変状態なし。
 */
export function describeProviderExecution<P extends AiProvider>(
  provider: P,
): ProviderExecutionDefinition<P> {
  if (provider !== "codex" && provider !== "claude")
    throw new Error("provider_execution_provider_invalid");
  return (
    provider === "codex"
      ? describeCodexExecutionPlanContract()
      : describeClaudeExecutionPlanContract()
  ) as ProviderExecutionDefinition<P>;
}

/**
 * Provider実行の用途を表す。
 * @responsibility 用途・Providerの対応を型境界へ保持する。
 * @trace ARCH-000010
 * @shape 閉じた用途と状態で識別する読取り専用契約。
 * @invariant 計画は実行許可ではない。
 * @boundary AI Adapterと計画利用側。
 * @security 秘密値・実行Authorityを含めない。
 * @compatibility 内部計画の既存引数・制約を維持する。
 */

export type ProviderExecutionPurpose = "advice" | "task" | "probe";

/**
 * Providerと用途ごとの成功計画を対応付ける。
 * @responsibility 用途・Providerの対応を型境界へ保持する。
 * @trace ARCH-000010
 * @shape 閉じた用途と状態で識別する読取り専用契約。
 * @invariant 計画は実行許可ではない。
 * @boundary AI Adapterと計画利用側。
 * @security 秘密値・実行Authorityを含めない。
 * @compatibility 内部計画の既存引数・制約を維持する。
 */

type ProviderPlans = {
  codex: {
    advice: ProviderAdvicePlan & Readonly<{ provider: "codex" }>;
    task: Extract<
      ReturnType<typeof planCodexIsolatedTask>,
      { status: "candidate" }
    >;
    probe: Extract<
      ReturnType<typeof planCodexReadOnlyProbe>,
      { status: "candidate" }
    >;
  };
  claude: {
    advice: ProviderAdvicePlan & Readonly<{ provider: "claude" }>;
    task: Extract<
      ReturnType<typeof planClaudeIsolatedTask>,
      { status: "candidate" }
    >;
    probe: Extract<
      ReturnType<typeof planClaudeReadOnlyProbe>,
      { status: "candidate" }
    >;
  };
};

/**
 * Provider実行計画へ渡す用途別入力を表す。
 * @responsibility 用途・Providerの対応を型境界へ保持する。
 * @trace ARCH-000010
 * @shape 閉じた用途と状態で識別する読取り専用契約。
 * @invariant 計画は実行許可ではない。
 * @boundary AI Adapterと計画利用側。
 * @security 秘密値・実行Authorityを含めない。
 * @compatibility 内部計画の既存引数・制約を維持する。
 */

export type ProviderExecutionInput<
  P extends AiProvider = AiProvider,
  K extends ProviderExecutionPurpose = ProviderExecutionPurpose,
> = K extends "advice"
  ? Readonly<{
      provider: P;
      purpose: K;
      input: ProviderModelSelection;
      resultSchema: Readonly<Record<string, unknown>>;
    }>
  : Readonly<{
      provider: P;
      purpose: K;
      input: unknown;
      modelSelection?: ProviderModelSelection;
    }>;

/**
 * Providerと用途で識別できる成功計画を表す。
 * @responsibility 用途・Providerの対応を型境界へ保持する。
 * @trace ARCH-000010
 * @shape 閉じた用途と状態で識別する読取り専用契約。
 * @invariant 計画は実行許可ではない。
 * @boundary AI Adapterと計画利用側。
 * @security 秘密値・実行Authorityを含めない。
 * @compatibility 内部計画の既存引数・制約を維持する。
 */

export type ProviderExecutionPlan<
  P extends AiProvider = AiProvider,
  K extends ProviderExecutionPurpose = ProviderExecutionPurpose,
> = ProviderPlans[P][K];

/**
 * 生成できた計画と拒否理由を区別する。
 * @responsibility 用途・Providerの対応を型境界へ保持する。
 * @trace ARCH-000010
 * @shape 閉じた用途と状態で識別する読取り専用契約。
 * @invariant 計画は実行許可ではない。
 * @boundary AI Adapterと計画利用側。
 * @security 秘密値・実行Authorityを含めない。
 * @compatibility 内部計画の既存引数・制約を維持する。
 */

export type ProviderExecutionPlanResult<
  P extends AiProvider = AiProvider,
  K extends ProviderExecutionPurpose = ProviderExecutionPurpose,
> =
  | Readonly<{
      status: "ready";
      plan: ProviderExecutionPlan<P, K>;
      error: null;
    }>
  | Readonly<{
      status: "blocked";
      plan: null;
      error: Readonly<{
        provider: AiProvider | null;
        reason: ProviderPlanningReason;
      }>;
    }>;

/**
 * 計画生成の固定拒否理由を表す。
 * @responsibility 内部生成処理の理由と共通境界の拒否を閉じた型へ保つ。
 * @trace ARCH-000010
 * @shape Provider固有blocked結果から導出するUnion。
 * @invariant 自由文を拒否理由へ入れない。
 * @boundary 公開計画結果と利用側。
 * @security Provider本文・Pathを含めない。
 * @compatibility 既存Provider理由値は維持する。
 */
export type ProviderPlanningReason =
  | Extract<
      | ReturnType<typeof planCodexIsolatedTask>
      | ReturnType<typeof planCodexReadOnlyProbe>
      | ReturnType<typeof planClaudeIsolatedTask>
      | ReturnType<typeof planClaudeReadOnlyProbe>,
      { status: "blocked" }
    >["reason"]
  | "provider_execution_input_invalid"
  | "provider_execution_selection_mismatch";

/**
 * Provider固有のTask範囲評価結果を表す。
 * @responsibility ClaudeのTurn予算とCodexの非適用を区別する。
 * @trace ARCH-000010
 * @shape Providerごとの候補又は拒否結果。
 * @invariant 非適用を確認済みTurn数へ補完しない。
 * @boundary Task準備前検査と結果受理上限。
 * @security 実行許可を発行しない。
 * @compatibility 既存Claude予算の計算と理由を維持する。
 */
export type ProviderTaskScopeResult<P extends AiProvider = AiProvider> =
  | Readonly<{ status: "blocked"; reason: "provider_execution_input_invalid" }>
  | (P extends "claude"
      ? ReturnType<typeof planClaudeTaskTurnBudget>
      : Readonly<{
          status: "candidate";
          maximumTurns: null;
          hardMaximumTurns: null;
        }>);

/**
 * Task範囲からProvider固有の予算条件を評価する。
 * @responsibility 準備前と結果解析で同じ受理上限を提供する。
 * @trace ARCH-000010
 * @input provider、役割、検証対象Task範囲。
 * @returns Provider別の予算又は拒否。
 * @precondition Providerは対応する識別子である。
 * @postcondition Task入力を変更しない。
 * @effect N/A: 値の検査だけを行う。
 * @failure Claudeの不正範囲・分割必要条件を既存理由で拒否する。
 * @invariant CodexへClaude固有の制限を追加しない。
 * @boundary 共通Task入口とProvider固有の制約。
 * @security 起動・再試行・回収を開始しない。
 * @concurrency N/A: 同期の純粋評価。
 */
export function evaluateProviderTaskScope<P extends AiProvider>(
  provider: P,
  taskRole: unknown,
  taskWorkload: unknown,
): ProviderTaskScopeResult<P> {
  if (
    (provider !== "codex" && provider !== "claude") ||
    (taskRole !== "executor" && taskRole !== "reviewer")
  )
    return Object.freeze({
      status: "blocked",
      reason: "provider_execution_input_invalid",
    });
  return (
    provider === "claude"
      ? planClaudeTaskTurnBudget(taskRole, taskWorkload)
      : Object.freeze({
          status: "candidate",
          maximumTurns: null,
          hardMaximumTurns: null,
        })
  ) as ProviderTaskScopeResult<P>;
}

/**
 * 用途とProviderを照合して実行計画を生成する。
 * @responsibility 用途別の安全条件を維持し、固定コマンド計画へ結合する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input request: Provider、用途、検証対象入力、助言Schema又は実行Model選定。
 * @returns 成功計画又は理由を持つ拒否。
 * @precondition 呼出し側が選定のAuthorityを所有する。
 * @postcondition Providerの引数・環境と構成側が指定した実行位置を計画へ保持する。
 * @effect N/A: 値だけを生成する。
 * @failure 不正Provider・用途・入力・選定を拒否する。
 * @invariant 計画生成を実起動・認証・回収の成立へ昇格しない。
 * @boundary 共通計画入口とProvider固有生成処理。
 * @security Prompt、任意Path、実行許可を生成しない。
 * @concurrency N/A: 純粋な同期処理。
 */
export function planProviderExecution<
  P extends AiProvider,
  K extends ProviderExecutionPurpose,
>(
  request: ProviderExecutionInput<P, K>,
  locations: ProviderExecutionLocations = {},
): ProviderExecutionPlanResult<P, K> {
  const snapshot =
    snapshotPlainRecord(
      request,
      new Set(["provider", "purpose", "input", "resultSchema"]),
    ) ??
    snapshotPlainRecord(
      request,
      new Set(["provider", "purpose", "input", "modelSelection"]),
    ) ??
    snapshotPlainRecord(request, new Set(["provider", "purpose", "input"]));
  if (
    !snapshot ||
    (snapshot.provider !== "codex" && snapshot.provider !== "claude")
  ) {
    return Object.freeze({
      status: "blocked",
      plan: null,
      error: Object.freeze({
        provider: null,
        reason: "provider_execution_input_invalid",
      }),
    });
  }
  const provider = snapshot.provider;
  const purpose = snapshot.purpose;
  if (
    (provider !== "codex" && provider !== "claude") ||
    (purpose !== "advice" && purpose !== "task" && purpose !== "probe")
  ) {
    return Object.freeze({
      status: "blocked",
      plan: null,
      error: Object.freeze({
        provider,
        reason: "provider_execution_input_invalid",
      }),
    });
  }
  if (purpose === "advice") {
    const advice = snapshot as ProviderExecutionInput<P, "advice">;
    const selection = snapshotPlainRecord(
      advice.input,
      new Set(["provider", "exactModelId", "reasoningEffort"]),
    );
    if (
      "modelSelection" in advice ||
      !selection ||
      selection.provider !== provider ||
      typeof selection.exactModelId !== "string" ||
      !validateProviderModelId(selection.exactModelId).value ||
      !["low", "medium", "high", "xhigh", "max"].includes(
        selection.reasoningEffort as string,
      ) ||
      !advice.resultSchema
    ) {
      return Object.freeze({
        status: "blocked",
        plan: null,
        error: Object.freeze({
          provider,
          reason: "provider_execution_input_invalid",
        }),
      });
    }
    const command =
      provider === "codex"
        ? planCodexAdviceCommand(selection as ProviderModelSelection, locations)
        : planClaudeAdviceCommand(
            selection as ProviderModelSelection,
            advice.resultSchema,
            locations,
          );
    const plan = Object.freeze({
      contract: PROVIDER_ADVICE_COMMAND_CONTRACT,
      contractRevision: PROVIDER_ADVICE_COMMAND_CONTRACT_REVISION,
      ...command,
    });
    return Object.freeze({
      status: "ready",
      plan: plan as ProviderExecutionPlan<P, K>,
      error: null,
    });
  }
  const execution = snapshot as ProviderExecutionInput<P, "task" | "probe">;
  if ("resultSchema" in execution)
    return Object.freeze({
      status: "blocked",
      plan: null,
      error: Object.freeze({
        provider,
        reason: "provider_execution_input_invalid",
      }),
    });
  const generated =
    provider === "codex"
      ? purpose === "task"
        ? planCodexIsolatedTask(execution.input, locations)
        : planCodexReadOnlyProbe(execution.input, locations)
      : purpose === "task"
        ? planClaudeIsolatedTask(execution.input, locations)
        : planClaudeReadOnlyProbe(execution.input, locations);
  if (generated.status !== "candidate") {
    return Object.freeze({
      status: "blocked",
      plan: null,
      error: Object.freeze({ provider, reason: generated.reason }),
    });
  }
  const modelSelection =
    execution.modelSelection === undefined
      ? null
      : snapshotPlainRecord(
          execution.modelSelection,
          new Set(["provider", "exactModelId", "reasoningEffort"]),
        );
  if (
    execution.modelSelection !== undefined &&
    (!modelSelection ||
      modelSelection.provider !== provider ||
      typeof modelSelection.exactModelId !== "string" ||
      !validateProviderModelId(modelSelection.exactModelId).value ||
      !["low", "medium", "high", "xhigh", "max"].includes(
        modelSelection.reasoningEffort as string,
      ) ||
      ("effort" in generated &&
        generated.effort !== modelSelection.reasoningEffort) ||
      (generated.provider === "codex" &&
        generated.exactModel !== modelSelection.exactModelId))
  ) {
    return Object.freeze({
      status: "blocked",
      plan: null,
      error: Object.freeze({
        provider,
        reason: "provider_execution_selection_mismatch",
      }),
    });
  }
  const plan =
    provider === "claude" && modelSelection
      ? Object.freeze({
          ...generated,
          argv: buildClaudeExecutionArguments(
            modelSelection.exactModelId as string,
            modelSelection.reasoningEffort as string,
            generated.argv,
          ),
        })
      : generated;
  return Object.freeze({
    status: "ready",
    plan: plan as ProviderExecutionPlan<P, K>,
    error: null,
  });
}

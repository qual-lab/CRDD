/**
 * Workbench読取り助言のProvider固有コマンド計画を生成する。
 *
 * @packageDocumentation
 * @responsibility Catalogで確定したModelと推論強度を、署名Runtime内の固定Provider配布物へ接続する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @boundary Provider非依存の助言実行計画とCodex／Claude CLIの間。
 * @effect N/A: コマンド候補を生成するだけでProcessやNetworkを操作しない。
 * @security Promptは標準入力だけで搬送し、Repository、Workspace、Tool、SessionおよびFallbackを許可しない。
 */
import type { AiReasoningEffort } from "../catalog/types.ts";
import { describeClaudeExecutionPlanContract } from "../claude/index.ts";
import { describeCodexAdviceDistributionIdentity } from "../codex/index.ts";

export const WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT =
  "crdd-coordinator/workbench-ai-advice-provider-command";
export const WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT_REVISION = 1;

/**
 * Workbench助言のProvider Command境界で使用するWorkbenchAiAdviceProviderCommandInputの構造を固定する。
 *
 * @responsibility Workbench助言のProvider Command境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceProviderCommandInput = Readonly<{
  provider: "codex" | "claude";
  exactModelId: string;
  reasoningEffort: AiReasoningEffort;
}>;

/**
 * Workbench助言のProvider Command境界で使用するWorkbenchAiAdviceProviderCommandの構造を固定する。
 *
 * @responsibility Workbench助言のProvider Command境界が受け渡す値、状態および制約を一つの型契約として保持する。
 * @trace ARCH-000010
 * @shape 宣言されたPropertyだけを持つ閉じた型として扱う。
 * @invariant Identity、状態およびAuthorityを暗黙に読み替えない。
 * @boundary 本ModuleとConsumerの型境界。
 * @security 秘密値または未許可のPathを公開値へ追加しない。
 * @compatibility 変更時は全Consumer、Schemaおよび契約試験を同時更新する。
 */

export type WorkbenchAiAdviceProviderCommand = Readonly<{
  contract: typeof WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT;
  contractRevision: typeof WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT_REVISION;
  provider: "codex" | "claude";
  command: string;
  argv: readonly string[];
  environment: Readonly<Record<string, string>>;
  fixedImageDigest: string;
  exactModelId: string;
  reasoningEffort: AiReasoningEffort;
  promptTransport: "stdin_only";
  resultTransport: "codex_cli_jsonl" | "claude_json_envelope";
  providerHomeMountRequired: true;
  repositoryMounted: false;
  workspaceMountRequired: false;
  toolsAllowed: false;
  sessionPersistenceAllowed: false;
}>;

/**
 * Workbench助言用の固定Providerコマンドを導出する。
 *
 * @responsibility Providerごとの固定配布物、CLI引数、環境置換および出力搬送を閉じた計画にする。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: Catalog検証済みProvider、exact Model、推論強度。resultSchema: 呼出し側が所有する結果Schema。
 * @returns Repository非共有のProviderコマンド計画。
 * @precondition 呼出し側がProfile Catalogとの完全一致を確認済みである。
 * @postcondition Prompt本文、Repository Pathおよび任意CLI引数をargvへ含めない。
 * @effect N/A: 固定値と入力値から計画を生成するだけである。
 * @failure N/A: 閉じたProvider Unionを全件処理する。
 * @invariant Provider、Modelおよび推論強度をFallbackで変更しない。
 * @boundary Workbench助言計画と署名Provider Runtimeの間。
 * @security Tool、Web検索、MCP、Plugin、Memory、SessionおよびWorkspace共有を無効化する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
export function planWorkbenchAiAdviceProviderCommand(
  input: WorkbenchAiAdviceProviderCommandInput,
  resultSchema: Readonly<Record<string, unknown>>,
): WorkbenchAiAdviceProviderCommand {
  return input.provider === "codex"
    ? planCodexAdviceCommand(input)
    : planClaudeAdviceCommand(input, resultSchema);
}

/**
 * Codex向け助言コマンドを生成する。
 *
 * @responsibility 固定Codex配布物へToolなし・標準入力・JSONL出力の一回助言を割り当てる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: Codex Profile Identity。
 * @returns Codex助言コマンド計画。
 * @precondition input.providerはcodexである。
 * @postcondition argv末尾は標準入力を示す`-`で、Prompt本文を含まない。
 * @effect N/A: コマンド計画を生成するだけである。
 * @failure N/A: Catalog検証済み入力だけを受け取る。
 * @invariant 固定Image Digestと助言専用CLI Pathを呼出し側入力で変更しない。
 * @boundary Workbench助言とCodex CLIの間。
 * @security Filesystem Tool、Web、MCP、Plugin、MemoryおよびSubagentを無効化する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function planCodexAdviceCommand(
  input: WorkbenchAiAdviceProviderCommandInput,
): WorkbenchAiAdviceProviderCommand {
  const distribution = describeCodexAdviceDistributionIdentity();
  return Object.freeze({
    contract: WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT,
    contractRevision: WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT_REVISION,
    provider: "codex" as const,
    command: distribution.executablePath,
    argv: Object.freeze([
      "exec",
      "--ephemeral",
      "--ignore-user-config",
      "--ignore-rules",
      "--strict-config",
      "--model",
      input.exactModelId,
      "--config",
      `model_reasoning_effort="${input.reasoningEffort}"`,
      "--config",
      "suppress_unstable_features_warning=true",
      "--config",
      "features.respect_system_proxy=true",
      "--config",
      "features.code_mode=true",
      "--config",
      "features.code_mode_host={enabled=true,disable_in_process_fallback=true}",
      "--config",
      "features.code_mode_interrupt=true",
      "--config",
      "features.code_mode_only=true",
      "--config",
      "features.shell_tool=false",
      "--config",
      "features.unified_exec=false",
      "--config",
      'approval_policy="never"',
      "--config",
      'web_search="disabled"',
      "--config",
      "features.plugins=false",
      "--config",
      "features.memories=false",
      "--config",
      "features.multi_agent=false",
      "--config",
      "features.multi_agent_v2=false",
      "--config",
      "memories.generate_memories=false",
      "--config",
      "memories.use_memories=false",
      "--config",
      "project_doc_max_bytes=0",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "--json",
      "--color",
      "never",
      "-",
    ]),
    environment: Object.freeze({
      CODEX_HOME: "/provider-home",
      CODEX_DISABLE_AUTO_UPDATE: "1",
    }),
    fixedImageDigest: distribution.fixedImageDigest,
    exactModelId: input.exactModelId,
    reasoningEffort: input.reasoningEffort,
    promptTransport: "stdin_only" as const,
    resultTransport: "codex_cli_jsonl" as const,
    providerHomeMountRequired: true as const,
    repositoryMounted: false as const,
    workspaceMountRequired: false as const,
    toolsAllowed: false as const,
    sessionPersistenceAllowed: false as const,
  });
}

/**
 * Claude向け助言コマンドを生成する。
 *
 * @responsibility 固定Claude配布物へToolなし・標準入力・Schema付きJSON出力の一回助言を割り当てる。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @input input: Claude Profile Identity。resultSchema: Coordinatorの固定助言結果Schema。
 * @returns Claude助言コマンド計画。
 * @precondition input.providerはclaudeである。
 * @postcondition Prompt本文はargvへ含めず、標準入力からだけ受け取る。
 * @effect N/A: コマンド計画を生成するだけである。
 * @failure N/A: Catalog検証済み入力だけを受け取る。
 * @invariant 固定Image Digestと公式CLI Pathを変更しない。
 * @boundary Workbench助言とClaude CLIの間。
 * @security Built-in Tool、MCP、Chrome、Slash CommandおよびSession保存を無効化する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function planClaudeAdviceCommand(
  input: WorkbenchAiAdviceProviderCommandInput,
  resultSchema: Readonly<Record<string, unknown>>,
): WorkbenchAiAdviceProviderCommand {
  const contract = describeClaudeExecutionPlanContract();
  return Object.freeze({
    contract: WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT,
    contractRevision: WORKBENCH_AI_ADVICE_PROVIDER_COMMAND_CONTRACT_REVISION,
    provider: "claude" as const,
    command: contract.readOnlyProbe.command,
    argv: Object.freeze([
      "--model",
      input.exactModelId,
      "--effort",
      input.reasoningEffort,
      "--safe-mode",
      "--setting-sources=",
      "--strict-mcp-config",
      "--mcp-config",
      '{"mcpServers":{}}',
      "--no-chrome",
      "--json-schema",
      JSON.stringify(resultSchema),
      "-p",
      "--output-format",
      "json",
      "--max-turns",
      "2",
      "--no-session-persistence",
      "--permission-mode",
      "dontAsk",
      "--tools=",
      "--disallowedTools",
      "Bash,WebFetch,WebSearch,Task,NotebookEdit,mcp__*",
      "--disable-slash-commands",
      "--prompt-suggestions",
      "false",
    ]),
    environment: contract.readOnlyProbe.environment,
    fixedImageDigest:
      contract.readOnlyProbe.distributionBinding.fixedImageDigest,
    exactModelId: input.exactModelId,
    reasoningEffort: input.reasoningEffort,
    promptTransport: "stdin_only" as const,
    resultTransport: "claude_json_envelope" as const,
    providerHomeMountRequired: true as const,
    repositoryMounted: false as const,
    workspaceMountRequired: false as const,
    toolsAllowed: false as const,
    sessionPersistenceAllowed: false as const,
  });
}

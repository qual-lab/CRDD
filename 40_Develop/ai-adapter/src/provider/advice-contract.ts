/**
 * 読取り助言のProviderコマンド契約を定義する。
 *
 * @responsibility 共通の入力・結果型と既存の契約Identityを保持し、Providerや実行環境を起動しない。
 * @trace ARCH-000010
 * @trace ARCH-000015
 */
import type { AiReasoningEffort } from "../catalog/types.ts";

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

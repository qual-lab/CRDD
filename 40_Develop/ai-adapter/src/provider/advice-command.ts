/**
 * 読取り助言の共通Providerコマンド計画を生成する。
 *
 * @responsibility Catalogで確定したModelと推論強度を、固定Provider配布物へ接続する。
 * @trace ARCH-000010
 * @trace ARCH-000015
 * @boundary Provider非依存の助言実行計画とCodex／Claude CLIの間。
 * @effect N/A: コマンド候補を生成するだけでProcessやNetworkを操作しない。
 * @security Promptは標準入力だけで搬送し、Repository、Workspace、Tool、SessionおよびFallbackを許可しない。
 */
import { planCodexAdviceCommand } from "../codex/execution-plan.ts";
import { planClaudeAdviceCommand } from "../claude/execution-plan.ts";
import type {
  WorkbenchAiAdviceProviderCommandInput,
  WorkbenchAiAdviceProviderCommand,
} from "./advice-contract.ts";

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
 * @boundary Workbench助言計画と固定Provider配布物の間。
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

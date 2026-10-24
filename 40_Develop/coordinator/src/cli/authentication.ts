/**
 * Provider認証の端末条件と表示を扱う。
 * @responsibility CLIの入力・出力と取消Listenerだけを所有し、正式APIへ接続する。
 * @trace ARCH-000004
 */

import {
  authenticateProvider,
  getAuthenticationStatus,
  PROVIDER_AUTHENTICATION_INPUT_NOTICE,
  isSupportedNodeRuntime as isSupportedCoordinatorNodeRuntime,
} from "../api.ts";
import { bindTaskCliCancellationSignals } from "./cancellation.ts";
/**
 * 共通認証コマンドの文法・端末・取消・表示を接続する。
 * @responsibility 認証の意味・Home選択・回収は正式APIへ委譲する。
 * @trace ARCH-000004
 * @input args: status/login、Provider、statusだけに許可する任意の--json。
 * @returns 表示と終了値の設定。
 * @precondition 一回のCLI受付から呼ぶ。
 * @postcondition 不正入力・端末不足ではAPIを呼ばない。
 * @effect 検査後の正式認証API、Signal登録と出力。
 * @failure 文法は64、操作未完了は2。未知の回収を成功化しない。
 * @invariant 通常Task・Repository・APIキーへ接続しない。
 * @boundary Process端末と正式API。
 * @security loginの生対話は下位がTTYへ直接接続する。
 * @concurrency 一回取消・操作待機後のListener解除を維持する。
 */
export async function runAuthenticationCommand(
  args: readonly string[],
): Promise<void> {
  if (args.length === 1 && ["--help", "help", "-h"].includes(args[0] ?? "")) {
    process.stdout.write(
      "auth status codex|claude [--json] : 通信なしの認証状態確認\nauth login codex|claude : 専用Homeへの公式対話ログイン（--json非対応）\n",
    );
    process.exitCode = 0;
    return;
  }
  const [action, provider, format] = args;
  const invalid =
    args.length < 2 ||
    args.length > 3 ||
    (action !== "status" && action !== "login") ||
    (provider !== "codex" && provider !== "claude") ||
    (format !== undefined && (format !== "--json" || action !== "status"));
  if (
    invalid ||
    !isSupportedCoordinatorNodeRuntime(process.versions.node) ||
    (action === "login" &&
      (process.stdin.isTTY !== true || process.stdout.isTTY !== true))
  ) {
    const reason = invalid
      ? "provider_authentication_arguments_invalid"
      : !isSupportedCoordinatorNodeRuntime(process.versions.node)
        ? "coordinator_node_version_unsupported"
        : "provider_authentication_interactive_terminal_required";
    process.stderr.write(`${reason}\n`);
    process.exitCode = 64;
    return;
  }
  const controller = new AbortController();
  const binding = bindTaskCliCancellationSignals(async () =>
    controller.abort(),
  );
  let result: Readonly<Record<string, unknown>>;
  let signalsReleased = false;
  try {
    if (binding.status !== "bound") {
      result = {
        status: "blocked",
        reason: "provider_authentication_signal_binding_failed",
        cleanupConfirmed: false,
        manualRecoveryRequired: true,
      };
    } else {
      if (action === "login")
        process.stderr.write(
          "表示されたProvider公式手順だけを完了してください。秘密値をチャットへ貼らないでください。\n" +
            PROVIDER_AUTHENTICATION_INPUT_NOTICE +
            "\n",
        );
      result = await (action === "status"
        ? getAuthenticationStatus
        : authenticateProvider)({ provider }, controller.signal);
    }
  } catch {
    result = {
      status: "blocked",
      reason: "provider_authentication_entry_failed",
      cleanupConfirmed: false,
      manualRecoveryRequired: true,
    };
  } finally {
    try {
      signalsReleased = binding.unbind().status === "released";
    } catch {
      signalsReleased = false;
    }
    if (!signalsReleased) {
      process.stderr.write("provider_authentication_signal_release_failed\n");
      process.exitCode = 2;
    }
  }
  if (!signalsReleased)
    result = {
      ...result,
      status: "blocked",
      cliCleanupConfirmed: false,
      cliReason: "provider_authentication_signal_release_failed",
    };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (process.exitCode !== 2)
    process.exitCode = result.status === "completed" ? 0 : 2;
}

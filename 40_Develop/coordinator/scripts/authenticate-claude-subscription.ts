/**
 * Claude専用Provider Homeの対話再認証入口を提供する。
 *
 * @responsibility 署名済み配布、選択UserのProvider Home観測、対話端末および認証Lifecycleを接続する。
 * @trace ARCH-000004
 * @trace ARCH-000010
 * @trace ARCH-000015
 */
import {
  authenticateClaudeSubscription,
  CLAUDE_SUBSCRIPTION_AUTHENTICATION_INPUT_NOTICE,
} from "../src/security/claude-subscription-authentication.ts";
import {
  consumeRuntimeOwnedProviderHomeMountSourceCapability,
  consumeRuntimeOwnedProviderHomeObservationCapability,
  inspectRuntimeOwnedWindowsProviderHomeCandidate,
} from "../src/security/provider-home-windows-adapter.ts";

if (process.stdin.isTTY !== true || process.stdout.isTTY !== true) {
  process.stderr.write("claude_authentication_interactive_terminal_required\n");
  process.exitCode = 64;
} else {
  const observed = inspectRuntimeOwnedWindowsProviderHomeCandidate(
    "claude",
    new Date().toISOString(),
  );
  if (observed.status !== "candidate") {
    process.stderr.write(`${observed.reason}\n`);
    process.exitCode = 2;
  } else {
    const consumed = consumeRuntimeOwnedProviderHomeObservationCapability(
      observed.observationCapability,
    );
    const stableLogicalHomeBindingHash =
      consumed?.stableLogicalHomeBindingHash ?? null;
    const source = consumed
      ? consumeRuntimeOwnedProviderHomeMountSourceCapability(
          consumed.providerHomeMountSourceCapability,
          "claude",
        )
      : null;
    if (!source || !stableLogicalHomeBindingHash) {
      process.stderr.write("claude_authentication_provider_home_unavailable\n");
      process.exitCode = 2;
    } else {
      process.stdout.write(
        "Claude Maxの認証画面を開きます。表示された公式手順だけを完了してください。秘密値はCRDDへ保存・表示しません。\n" +
          `${CLAUDE_SUBSCRIPTION_AUTHENTICATION_INPUT_NOTICE}\n`,
      );
      const result = await authenticateClaudeSubscription(
        source,
        stableLogicalHomeBindingHash,
      );
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = result.status === "completed" ? 0 : 2;
    }
  }
}

#!/usr/bin/env node
/**
 * Visual Previewを実Processへ接続する薄いCLI入口。
 * @responsibility 単一受付の起動と失敗結果の標準Error・終了値を接続する。
 * @trace ARCH-000003
 */
import { runVisualPreviewCommand } from "../src/cli/command.ts";

void runVisualPreviewCommand().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      contract: "crdd/visual-preview/v1",
      status: "blocked",
      reason: error instanceof Error ? error.message : "visual_preview_failed",
    })}\n`,
  );
  process.exitCode = 1;
});

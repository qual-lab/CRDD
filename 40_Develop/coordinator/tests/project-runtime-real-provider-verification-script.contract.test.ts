import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const source = fs.readFileSync(
  fileURLToPath(
    new URL(
      "../scripts/verify-project-runtime-real-providers.ts",
      import.meta.url,
    ),
  ),
  "utf8",
);

test("最終Project Runtime E2Eは公開MCP子Processを使用する", () => {
  assert.match(source, /spawn\(/u);
  assert.match(source, /"mcp",\s*"--stdio"/u);
  assert.match(source, /actualChildProcess:\s*true/u);
  assert.doesNotMatch(source, /runMcpProjectRuntimeStdio/u);
  assert.doesNotMatch(source, /DevelopmentMeasurementSession/u);
});

test("正常終了後のclean観測をRecovery settlement実行へ読み替えない", () => {
  assert.match(source, /inspectRuntimeOwnedDockerTaskRecoveryState/u);
  assert.match(source, /recoverySettlementExercised:\s*false/u);
});

test("取消はProvider選定後の親EOFと正本不変を要求する", () => {
  assert.match(source, /coordinator_selection_before_provider_effect/u);
  assert.match(source, /cancellationChild\.stdin\.end\(\)/u);
  assert.match(source, /cancellationResult\?\.status,\s*"cancelled"/u);
  assert.match(source, /CANCELLATION_MARKER[\s\S]*BASE/u);
});

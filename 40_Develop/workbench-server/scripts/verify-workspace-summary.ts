/**
 * 承認済みのDirect一Taskの最初の説明文を、終了後に端末で一度だけ確認する。
 * @packageDocumentation
 * @responsibility 試験専用観測をconsumer import前に設置し、元Taskと子Process終了を維持する。
 * @trace ERB-IT-021
 * @security 本文をFile・Log・公開APIへ保存しない。端末scrollback残存は明示承認対象。
 */
if (
  process.argv.slice(2).join(" ") !== "--external-send-and-summary-confirmed" ||
  !process.stdin.isTTY ||
  !process.stdout.isTTY
) {
  process.stderr.write(
    "合成Directと説明文の端末表示への明示承認・対話端末が必要です。\n",
  );
  process.exitCode = 64;
} else {
  const { installTaskSummaryObservation } = await import(
    "../../executor/scripts/task-summary-observation.ts"
  );
  const observation = installTaskSummaryObservation();
  try {
    process.argv.splice(
      2,
      process.argv.length - 2,
      "--external-send-confirmed-direct-diagnostic",
    );
    const { verificationResult } = await import("./verify-workspace-ai.ts");
    const outcome = observation.finish(verificationResult, (text) => {
      process.stdout.write(
        `\n未信頼のProvider説明文（故障の証明ではありません）:\n${text}\n`,
      );
    });
    process.stdout.write(
      `${JSON.stringify({ instrumentedDiagnostic: true, summaryInspection: outcome })}\n`,
    );
    if (!outcome.displayed) process.exitCode = 2;
  } finally {
    observation.close();
  }
}
export {};

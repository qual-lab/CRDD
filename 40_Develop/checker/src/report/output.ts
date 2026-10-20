/**
 * 通常文書検査のレポートを指定出力先へ表示する。
 *
 * @responsibility 既存JSON・Summary・人間表示とcallback発行順を所有する。
 * @trace ARCH-000001
 * @boundary 完成済みレポートと呼出し元が指定した出力callbackの境界。
 * @effect 指定callbackへ文字列を渡す。Filesystem保存・時刻取得は行わない。
 * @security 表示成功から検査範囲の完全性・品質Pass・保存成立を推定しない。
 */
import type { DocumentReport } from "./types.ts";

/**
 * 既存の表示モードでレポートを搬送する。
 *
 * @responsibility 入力Objectを再構築せず、文字列と発行粒度を維持する。
 * @trace ARCH-000001
 * @input report: 検査側が確定したレポート。options: jsonとsummary。writeOutput: 出力先。
 * @returns void。終了codeは返さない。
 * @precondition Reportの集計・順序・観測状態は検査側で確定済みである。
 * @postcondition 指定モードの既存出力列を順番に発行する。
 * @effect 出力callbackだけを呼ぶ。ファイル・履歴・保存先を所有しない。
 * @failure callbackまたはJSON変換の例外をそのまま伝播し、後続出力を止める。
 * @invariant Reportを変更せず、未知・null・重複を補完しない。
 * @boundary Process非依存の整形と呼出し元の出力Effectの境界。
 * @security 新しい認可・合否・終了判断を作らない。
 * @concurrency 同期発行。共有状態・Process・Lockを持たない。
 */
export function writeDocumentReport(
  report: DocumentReport,
  options: Readonly<{ json: boolean; summary: boolean }>,
  writeOutput: (value: string) => void,
): void {
  const { findings, references, metrics } = report;
  if (options.json && options.summary) {
    writeOutput(`${JSON.stringify(report, null, 2)}\n`);
  } else if (options.json) {
    writeOutput(`${JSON.stringify(findings, null, 2)}\n`);
  } else {
    for (const item of findings)
      writeOutput(
        `${item.severity.toUpperCase().padEnd(7)} ${item.code.padEnd(28)} ${item.path}: ${item.message}\n`,
      );
    writeOutput(
      `CRDD check: ${metrics.errors} error(s), ${metrics.warnings} warning(s)\n`,
    );
    if (options.summary) {
      writeOutput(
        `Mode=${report.check_mode}; Markdown=${metrics.markdown_files_checked}/${metrics.markdown_files_discovered}; local links=${metrics.local_links_checked}; anchors=${metrics.anchors_checked}; stable IDs=${metrics.stable_ids_observed}; ${report.duration_ms} ms\n`,
      );
      writeOutput(`Executed=${report.executed_at}\n`);
      writeOutput(
        `Repository=${report.repository_mode}; discovery=${report.discovery_source}; git_failure=${report.discovery_git_failure ?? "none"}\n`,
      );
      writeOutput(`Unchecked=${JSON.stringify(report.unchecked)}\n`);
      if (references) writeOutput(`${JSON.stringify(references, null, 2)}\n`);
    }
  }
}

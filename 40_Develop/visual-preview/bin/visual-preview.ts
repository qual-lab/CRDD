#!/usr/bin/env node

/**
 * Visual PreviewのCLI入口。
 *
 * @responsibility Repository相対RootとPortを受付け、Visual Previewの開始・停止結果を構造化表示する。
 * @trace ARCH-000003
 */
import { startVisualPreview } from "../src/index.ts";

/**
 * CLI引数から指定Optionの値を取得する。
 *
 * @responsibility `--name value`形式の単一値Optionを重複なく解決する。
 * @trace ARCH-000003
 * @input argumentValuesにCLI引数、nameにOption名を受け取る。
 * @returns 未指定ならundefined、指定済みなら値を返す。
 * @precondition nameは`--`で始まる固定Option名である。
 * @postcondition 引数配列を変更せず値だけを返す。
 * @effect N/A: Process内の引数を読むだけである。
 * @failure 値欠落または重複時はErrorを投げる。
 * @invariant 最初の値だけを暗黙採用しない。
 * @boundary CLI Argument境界。
 * @security 未知Optionを値として解釈しない。
 * @concurrency N/A: 起動時の同期処理である。
 */
function readOption(
  argumentValues: readonly string[],
  name: string,
): string | undefined {
  const indexes = argumentValues.flatMap((value, index) =>
    value === name ? [index] : [],
  );
  if (indexes.length > 1) throw new Error("visual_preview_option_duplicated");
  const index = indexes[0];
  if (index === undefined) return undefined;
  const value = argumentValues[index + 1];
  if (value === undefined || value.startsWith("--"))
    throw new Error("visual_preview_option_value_required");
  return value;
}

/**
 * Visual Preview CLIを実行する。
 *
 * @responsibility 公開Rootを検証してListenerを開始し、signal時に同じHandleを終了する。
 * @trace ARCH-000003
 * @input N/A: process.argvとprocess.cwdを使用する。
 * @returns CLI Lifecycle完了を表すPromiseを返す。
 * @precondition `--root`はRepository相対Path、`--port`は0から65535である。
 * @postcondition 正常終了時はListenerと所有Connectionが残らない。
 * @effect localhost Listenerを開始し、UI成果物を読取る。
 * @failure 入力不正または起動失敗を構造化Errorと終了値1で返す。
 * @invariant Absolute Pathを標準出力または標準Errorへ表示しない。
 * @boundary CLI、Repository Filesystemおよびlocalhost HTTP境界。
 * @security 外部Bind、書込み、Credential受付およびDirectory一覧を提供しない。
 * @concurrency SIGINTとSIGTERMの競合を一回のcloseへ畳む。
 */
async function main(): Promise<void> {
  const argumentValues = process.argv.slice(2);
  const known = new Set(["--root", "--port"]);
  for (let index = 0; index < argumentValues.length; index += 2) {
    const name = argumentValues[index];
    if (name === undefined || !known.has(name))
      throw new Error("visual_preview_option_unknown");
  }
  const rootRelativePath =
    readOption(argumentValues, "--root") ?? "04_UI/Details/Visual";
  const portValue = readOption(argumentValues, "--port");
  const port = portValue === undefined ? 0 : Number(portValue);
  const handle = await startVisualPreview({
    workingDirectory: process.cwd(),
    rootRelativePath,
    port,
  });
  process.stdout.write(
    `${JSON.stringify({
      contract: handle.contract,
      status: "ready",
      baseUrl: handle.baseUrl,
      healthUrl: handle.healthUrl,
      readOnly: true,
    })}\n`,
  );
  await new Promise<void>((resolve) => {
    let isStopping = false;
    const stop = () => {
      if (isStopping) return;
      isStopping = true;
      void handle.close().finally(resolve);
    };
    process.once("SIGINT", stop);
    process.once("SIGTERM", stop);
  });
  process.stdout.write(
    `${JSON.stringify({
      contract: handle.contract,
      status: "closed",
      listenerRemaining: false,
    })}\n`,
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${JSON.stringify({
      contract: "crdd/visual-preview/v1",
      status: "blocked",
      reason: error instanceof Error ? error.message : "visual_preview_failed",
    })}\n`,
  );
  process.exitCode = 1;
});

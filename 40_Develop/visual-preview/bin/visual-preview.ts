#!/usr/bin/env node

/**
 * Visual PreviewのCLI入口。
 *
 * @responsibility Repository相対RootとPortを受付け、Visual Previewの開始・停止結果を構造化表示する。
 * @trace ARCH-000003
 */
import { startVisualPreview, verifyBrowserZoom } from "../src/index.ts";

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
 * Comma区切りOptionを空要素のない値一覧へ変換する。
 *
 * @responsibility CLIのDocument一覧とZoom倍率一覧を共通形式で解析する。
 * @trace ARCH-000003
 * @input valueにComma区切り文字列、reasonに不正時の理由を受け取る。
 * @returns Trim済みの一件以上の値を返す。
 * @precondition valueはreadOptionで単一値として解決済みである。
 * @postcondition 入力文字列を変更せず新しい配列を返す。
 * @effect N/A: Process内文字列だけを解析する。
 * @failure 空文字列または空要素があれば指定reasonのErrorを投げる。
 * @invariant 空要素を暗黙に除外しない。
 * @boundary CLI文字列表現と検証要求配列の境界。
 * @security 制御文字を含む値は後続のPath・数値検証へ渡さない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function parseList(value: string, reason: string): readonly string[] {
  const items = value.split(",").map((item) => item.trim());
  if (
    items.length === 0 ||
    items.some(
      (item) => item.length === 0 || /[\u0000-\u001f\u007f]/u.test(item),
    )
  )
    throw new Error(reason);
  return items;
}

/**
 * 実Browser Zoom検証Commandを実行する。
 *
 * @responsibility CLI Optionを全数検証し、構造化された実Browser測定結果を出力する。
 * @trace ARCH-000003
 * @input argumentValuesに`verify-zoom`後のCLI引数を受け取る。
 * @returns 検証とcleanup完了時に解決するPromiseを返す。
 * @precondition `--root`、`--documents`、`--zooms`は単一値Optionとして指定する。
 * @postcondition 成功・不適合をJSONで一回出力し、不適合時は終了値2を設定する。
 * @effect localhost Preview、専用Browser ProfileおよびHeadless Chromeを一時的に使用する。
 * @failure 入力・起動・観測失敗は呼出し側へErrorを返す。
 * @invariant 狭幅Viewportを実Browser Zoomの代替結果として出力しない。
 * @boundary CLI、Repository、localhost HTTP、Chromiumおよび標準出力の統合境界。
 * @security Absolute Path、DevTools EndpointまたはProfile Pathを出力しない。
 * @concurrency 対象条件を逐次実行し、Profileを共有しない。
 */
async function runZoomVerification(
  argumentValues: readonly string[],
): Promise<void> {
  const known = new Set([
    "--root",
    "--documents",
    "--zooms",
    "--width",
    "--height",
    "--browser",
  ]);
  for (let index = 0; index < argumentValues.length; index += 2) {
    const name = argumentValues[index];
    if (name === undefined || !known.has(name))
      throw new Error("visual_zoom_option_unknown");
  }
  const rootRelativePath = readOption(argumentValues, "--root");
  const documentValue = readOption(argumentValues, "--documents");
  if (rootRelativePath === undefined || documentValue === undefined)
    throw new Error("visual_zoom_required_option_missing");
  const zoomValues = parseList(
    readOption(argumentValues, "--zooms") ?? "1,2,4",
    "visual_zoom_factors_invalid",
  ).map(Number);
  const browserExecutablePath = readOption(argumentValues, "--browser");
  const result = await verifyBrowserZoom({
    workingDirectory: process.cwd(),
    rootRelativePath,
    documentPaths: parseList(documentValue, "visual_zoom_documents_invalid"),
    zoomFactors: zoomValues,
    windowSize: {
      width: Number(readOption(argumentValues, "--width") ?? "1280"),
      height: Number(readOption(argumentValues, "--height") ?? "960"),
    },
    ...(browserExecutablePath === undefined ? {} : { browserExecutablePath }),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "passed") process.exitCode = 2;
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
  const allArguments = process.argv.slice(2);
  if (allArguments[0] === "verify-zoom") {
    await runZoomVerification(allArguments.slice(1));
    return;
  }
  const argumentValues =
    allArguments[0] === "serve" ? allArguments.slice(1) : allArguments;
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

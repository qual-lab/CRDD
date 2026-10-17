/**
 * docker-isolation:unit:backend-stateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility docker-isolation:unit:backend-stateが所有する検証責務を実行する。
 * @trace ERB-UT-034
 * @level UT
 * @scope docker、wsl、state
 * @boundary ERB-UT-034=N/A: 固定一覧の純粋分類は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyDockerBackendLists,
  type WslListCompletion,
} from "../../../src/desktop/backend-state.ts";

/**
 * 成功した一覧Processの固定結果を構築する。
 *
 * @responsibility 純粋分類へ渡す成功結果を決定論的に構築する。
 * @trace ERB-UT-034
 * @precondition 固定試験入力のbytesを受け取る。
 * @stimulus stdoutを成功結果へ格納する。
 * @observation 返却したProcess結果を観測する。
 * @oracle statusは0、signalはnull、stderrは空である。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary ERB-UT-034=N/A: 固定一覧の純粋分類は外部実行境界を持たない。
 */
const completed = (stdout: Uint8Array): WslListCompletion => ({
  status: 0,
  signal: null,
  stdout,
  stderr: Buffer.alloc(0),
});
/**
 * listのTest準備責務を実行する。
 *
 * @responsibility listがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-UT-034
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus listを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-034=N/A: 固定一覧の純粋分類は外部実行境界を持たない。
 */
const list = (value: string, encoding: BufferEncoding = "utf16le") =>
  completed(Buffer.from(value, encoding));
const registered = list("docker-desktop\r\nUbuntu\r\n");
const empty = completed(Buffer.alloc(0));

/**
 * observes stopped only with successful registered and running listsを検証する。
 *
 * @responsibility observes stopped only with successful registered and running listsの合否判定を所有する。
 * @trace ERB-UT-034
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus observes stopped only with successful registered and running listsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-034=N/A: 固定一覧の純粋分類は外部実行境界を持たない。
 */
test("observes stopped only with successful registered and running lists", () => {
  for (const encoding of ["utf16le", "utf8"] as const) {
    const names = list("docker-desktop\r\nUbuntu\r\n", encoding);
    assert.equal(classifyDockerBackendLists(names, empty), "stopped");
    assert.equal(
      classifyDockerBackendLists(names, list("Ubuntu\n", encoding)),
      "stopped",
    );
    assert.equal(
      classifyDockerBackendLists(names, list("docker-desktop\n", encoding)),
      "running",
    );
  }
  assert.equal(
    classifyDockerBackendLists(list("\ufeffdocker-desktop\r\n"), empty),
    "stopped",
  );
  assert.equal(
    classifyDockerBackendLists(list("\ufeffdocker-desktop\r\n", "utf8"), empty),
    "stopped",
  );
});
/**
 * failed or incomplete processes are never empty successful listsを検証する。
 *
 * @responsibility failed or incomplete processes are never empty successful listsの合否判定を所有する。
 * @trace ERB-UT-034
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus failed or incomplete processes are never empty successful listsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-034=N/A: 固定一覧の純粋分類は外部実行境界を持たない。
 */
test("failed or incomplete processes are never empty successful lists", () => {
  for (const change of [
    { status: 1 },
    { status: null },
    { signal: "SIGTERM" },
    { error: new Error("failure") },
    { stderr: Buffer.from("warning") },
    { stdout: Buffer.alloc(65_537) },
  ]) {
    assert.equal(
      classifyDockerBackendLists(registered, { ...empty, ...change }),
      "unknown",
    );
    assert.equal(
      classifyDockerBackendLists({ ...registered, ...change }, empty),
      "unknown",
    );
  }
});
/**
 * rejects malformed encoding and unsupported linesを検証する。
 *
 * @responsibility rejects malformed encoding and unsupported linesの合否判定を所有する。
 * @trace ERB-UT-034
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus rejects malformed encoding and unsupported linesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-034=N/A: 固定一覧の純粋分類は外部実行境界を持たない。
 */
test("rejects malformed encoding and unsupported lines", () => {
  const invalidSamples = [
    Buffer.from([0xff]),
    Buffer.from([0xff, 0xfe, 0x61]),
    Buffer.from([0xfe, 0xff, 0, 0x61]),
    Buffer.from([0xc0, 0xaf]),
    Buffer.from([0x00, 0xd8]),
    Buffer.from("Ubuntu\0", "utf8"),
  ];
  for (const bytes of invalidSamples)
    assert.equal(
      classifyDockerBackendLists(registered, completed(bytes)),
      "unknown",
    );
  for (const text of [
    "\n",
    "Ubuntu\n\n",
    "* Ubuntu\n",
    " Ubuntu\n",
    "Ubuntu \n",
    "Ubuntu\r",
    "Ubuntu\nubuntu\n",
    "Ubuntu:Running\n",
    "あ\n",
    "x".repeat(129),
    "Ubuntu\ufeff\n",
  ])
    assert.equal(classifyDockerBackendLists(registered, list(text)), "unknown");
});
/**
 * requires docker registration and running subset consistencyを検証する。
 *
 * @responsibility requires docker registration and running subset consistencyの合否判定を所有する。
 * @trace ERB-UT-034
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus requires docker registration and running subset consistencyの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-UT-034=N/A: 固定一覧の純粋分類は外部実行境界を持たない。
 */
test("requires docker registration and running subset consistency", () => {
  assert.equal(classifyDockerBackendLists(empty, empty), "unknown");
  assert.equal(classifyDockerBackendLists(list("Ubuntu\n"), empty), "unknown");
  assert.equal(
    classifyDockerBackendLists(registered, list("Other\n")),
    "unknown",
  );
  assert.equal(
    classifyDockerBackendLists(list("docker-desktop\nDOCKER-DESKTOP\n"), empty),
    "unknown",
  );
});

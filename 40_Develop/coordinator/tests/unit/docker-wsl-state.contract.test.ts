/**
 * coordinator:unit:docker-wsl-stateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-wsl-stateが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope docker、wsl、state
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  observeDockerWslState,
  type WslListCompletion,
} from "../../src/security/docker-wsl-state.ts";

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
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus listを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
const list = (value: string, encoding: BufferEncoding = "utf16le") =>
  completed(Buffer.from(value, encoding));
const registered = list("docker-desktop\r\nUbuntu\r\n");
const empty = completed(Buffer.alloc(0));

/**
 * observes stopped only with successful registered and running listsを検証する。
 *
 * @responsibility observes stopped only with successful registered and running listsの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus observes stopped only with successful registered and running listsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("observes stopped only with successful registered and running lists", () => {
  for (const encoding of ["utf16le", "utf8"] as const) {
    const names = list("docker-desktop\r\nUbuntu\r\n", encoding);
    assert.equal(observeDockerWslState(names, empty), "stopped");
    assert.equal(
      observeDockerWslState(names, list("Ubuntu\n", encoding)),
      "stopped",
    );
    assert.equal(
      observeDockerWslState(names, list("docker-desktop\n", encoding)),
      "running",
    );
  }
  assert.equal(
    observeDockerWslState(list("\ufeffdocker-desktop\r\n"), empty),
    "stopped",
  );
  assert.equal(
    observeDockerWslState(list("\ufeffdocker-desktop\r\n", "utf8"), empty),
    "stopped",
  );
});
/**
 * failed or incomplete processes are never empty successful listsを検証する。
 *
 * @responsibility failed or incomplete processes are never empty successful listsの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus failed or incomplete processes are never empty successful listsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
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
      observeDockerWslState(registered, { ...empty, ...change }),
      "unknown",
    );
    assert.equal(
      observeDockerWslState({ ...registered, ...change }, empty),
      "unknown",
    );
  }
});
/**
 * rejects malformed encoding and unsupported linesを検証する。
 *
 * @responsibility rejects malformed encoding and unsupported linesの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus rejects malformed encoding and unsupported linesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
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
      observeDockerWslState(registered, completed(bytes)),
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
    assert.equal(observeDockerWslState(registered, list(text)), "unknown");
});
/**
 * requires docker registration and running subset consistencyを検証する。
 *
 * @responsibility requires docker registration and running subset consistencyの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus requires docker registration and running subset consistencyの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("requires docker registration and running subset consistency", () => {
  assert.equal(observeDockerWslState(empty, empty), "unknown");
  assert.equal(observeDockerWslState(list("Ubuntu\n"), empty), "unknown");
  assert.equal(observeDockerWslState(registered, list("Other\n")), "unknown");
  assert.equal(
    observeDockerWslState(list("docker-desktop\nDOCKER-DESKTOP\n"), empty),
    "unknown",
  );
});

/**
 * coordinator:unit:authority-root-path-lexicalの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:authority-root-path-lexicalが所有する検証責務を実行する。
 * @trace RFD-UT-006
 * @level UT
 * @scope authority、root、path、lexical
 * @boundary RFD-UT-006=N/A: Project・Repository・Binding・Grant・Exposure・改訂版要否の判定規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { compileFunction } from "node:vm";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";

import {
  isSupportedPosixAbsolutePathCandidate,
  isSupportedWindowsAbsolutePathCandidate,
} from "../../../src/lifecycle/environment.ts";

/**
 * Windows absolute Pathの保守的字句subsetをOS非依存に判定するを検証する。
 *
 * @responsibility Windows absolute Pathの保守的字句subsetをOS非依存に判定するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows absolute Pathの保守的字句subsetをOS非依存に判定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows absolute Pathの保守的字句subsetをOS非依存に判定する", () => {
  for (const candidate of ["C:\\", "C:\\ProgramData", "D:\\通常\\CRDD"]) {
    assert.equal(isSupportedWindowsAbsolutePathCandidate(candidate), true);
  }
  for (const invalid of [
    "c:\\ProgramData",
    "C:/ProgramData",
    "C:\\ProgramData\\",
    "C:\\ProgramData\\\\CRDD",
    "C:\\ProgramData\\.\\CRDD",
    "C:\\ProgramData\\..\\CRDD",
    "C:\\ProgramData\\bad.",
    "C:\\ProgramData\\bad ",
    "C:\\ProgramData\\CON",
    "C:\\ProgramData\\nul.txt",
    "C:\\ProgramData\\COM¹.log",
    "C:\\ProgramData\\CON .txt",
    "C:\\ProgramData\\COM1 .log",
    "C:\\ProgramData\\LPT¹ .x",
    "C:\\ProgramData\\CONıN$",
    "C:\\ProgramData\\CONıN$ .txt",
    "C:\\ProgramData\\CLOCK$.log",
    "C:\\ProgramData\\bad\ud800name",
    "C:\\ProgramData\\bad\udc00name",
    "C:\\ProgramData\\bad:name",
    "C:\\ProgramData\\bad\u007f",
  ]) {
    assert.equal(isSupportedWindowsAbsolutePathCandidate(invalid), false);
  }
  assert.equal(
    isSupportedWindowsAbsolutePathCandidate("C:\\ProgramData\\CONSOLE.txt"),
    true,
  );
  assert.equal(
    isSupportedWindowsAbsolutePathCandidate("C:\\ProgramData\\MixedCase"),
    true,
  );
});

/**
 * 予約名比較用の限定大文字写像を全件固定するを検証する。
 *
 * @responsibility 予約名比較用の限定大文字写像を全件固定するの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 予約名比較用の限定大文字写像を全件固定するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("予約名比較用の限定大文字写像を全件固定する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/lifecycle/environment.ts", import.meta.url),
    "utf8",
  );
  const uppercase = compileFunction(
    `${[
      "RESERVED_NAME_SPECIAL_UPPERCASE_MAPPINGS",
      "reservedNameSpecialUppercaseMapping",
      "reservedNameLimitedUppercase",
    ]
      .map((name) => sourceDeclaration(source, name))
      .join("\n")}
    return reservedNameLimitedUppercase;`,
  )() as (value: string) => string;
  assert.deepEqual(
    Array.from("abcdefghijklmnopqrstuvwxyz", uppercase),
    Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ"),
  );
  for (const [from, to] of [
    ["ß", "SS"],
    ["ı", "I"],
    ["ſ", "S"],
    ["K", "K"],
    ["ﬀ", "FF"],
    ["ﬁ", "FI"],
    ["ﬂ", "FL"],
    ["ﬃ", "FFI"],
    ["ﬄ", "FFL"],
    ["ﬅ", "ST"],
    ["ﬆ", "ST"],
  ] as const) {
    assert.equal(uppercase(from), to);
  }
  assert.equal(uppercase("é"), "é");
  assert.equal(uppercase("e\u0301"), "E\u0301");
});

/**
 * POSIX absolute Path判定をWindows候補と独立させるを検証する。
 *
 * @responsibility POSIX absolute Path判定をWindows候補と独立させるの合否判定を所有する。
 * @trace RFD-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus POSIX absolute Path判定をWindows候補と独立させるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RFD-UT-006=Direct Boundary: coordinator Test Source→対象契約
 */
test("POSIX absolute Path判定をWindows候補と独立させる", () => {
  assert.equal(isSupportedPosixAbsolutePathCandidate("/var/lib/crdd"), true);
  assert.equal(isSupportedPosixAbsolutePathCandidate("/"), true);
  assert.equal(isSupportedPosixAbsolutePathCandidate("var/lib/crdd"), false);
  assert.equal(isSupportedPosixAbsolutePathCandidate("/var/lib/crdd/"), false);
});

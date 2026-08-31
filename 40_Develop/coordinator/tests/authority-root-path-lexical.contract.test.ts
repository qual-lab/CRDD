import assert from "node:assert/strict";
import test from "node:test";

import {
  describeAuthorityRootPathLexicalContract,
  isSupportedPosixAbsolutePathCandidate,
  isSupportedWindowsAbsolutePathCandidate,
} from "../src/security/authority-root-path-lexical.ts";

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

test("予約名比較用の限定大文字写像を全件固定する", () => {
  const contract = describeAuthorityRootPathLexicalContract();
  assert.deepEqual(
    contract.asciiLowercaseMappings,
    Array.from({ length: 26 }, (unusedValue, index) => {
      void unusedValue;
      return [
        String.fromCodePoint(0x61 + index),
        String.fromCodePoint(0x41 + index),
      ];
    }),
  );
  assert.deepEqual(contract.specialMappings, [
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
  ]);
  assert.equal(
    contract.windowsReservedNameComparison,
    "repository_owned_limited_uppercase_mapping",
  );
  assert.equal(contract.unicodeNormalizationApplied, false);
  assert.equal(contract.illFormedUtf16Accepted, false);
});

test("POSIX absolute Path判定をWindows候補と独立させる", () => {
  assert.equal(isSupportedPosixAbsolutePathCandidate("/var/lib/crdd"), true);
  assert.equal(isSupportedPosixAbsolutePathCandidate("/"), true);
  assert.equal(isSupportedPosixAbsolutePathCandidate("var/lib/crdd"), false);
  assert.equal(isSupportedPosixAbsolutePathCandidate("/var/lib/crdd/"), false);
});

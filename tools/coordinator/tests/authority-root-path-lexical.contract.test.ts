import assert from "node:assert/strict";
import test from "node:test";

import {
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
    "C:\\ProgramData\\bad:name",
    "C:\\ProgramData\\bad\u007f",
  ]) {
    assert.equal(isSupportedWindowsAbsolutePathCandidate(invalid), false);
  }
  assert.equal(
    isSupportedWindowsAbsolutePathCandidate("C:\\ProgramData\\CONSOLE.txt"),
    true,
  );
});

test("POSIX absolute Path判定をWindows候補と独立させる", () => {
  assert.equal(isSupportedPosixAbsolutePathCandidate("/var/lib/crdd"), true);
  assert.equal(isSupportedPosixAbsolutePathCandidate("/"), true);
  assert.equal(isSupportedPosixAbsolutePathCandidate("var/lib/crdd"), false);
  assert.equal(isSupportedPosixAbsolutePathCandidate("/var/lib/crdd/"), false);
});

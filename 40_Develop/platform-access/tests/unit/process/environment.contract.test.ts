/**
 * Host記録補助子の固定環境を検証する。
 * @packageDocumentation
 * @responsibility canonical親と最小環境の結合・不明拒否を検査する。
 * @trace PRL-UT-006
 * @level UT
 * @scope Host補助子の環境構築。
 * @boundary 本番本文と模擬Filesystem。実OS所在・ACL観測ではない。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";

/**
 * 同値入口の統合後もOS選択とProfile付与の実差分を保つ。
 * @trace PRL-UT-006
 * @precondition 本番の環境選択本文と合成OS・所在観測を結合する。
 * @stimulus Windows／非Windows、Profile有無、所在欠測を与える。
 * @observation 返却値と基礎環境へ渡した追加値。
 * @oracle 固定Windowsを空環境へfallbackせず、Profile要求時だけ検証済み値を付与する。
 * @cleanup N/A: 実Process・Filesystemを使用しない。
 */
test("共通子環境はOS固定とProfile付与だけを分岐する", () => {
  const source = readFileSync(
    new URL("../../../src/process/environment.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export function createChildProcessEnvironment(",
  );
  assert.ok(start > 0);
  const end = source.indexOf("\n/**", start);
  assert.ok(end > start);
  const body = stripTypeScriptTypes(
    source.slice(start, end).replace(/^export /u, ""),
  );
  for (const actualPlatform of ["win32", "linux"]) {
    let profile: string | null = "C:\\Users\\observed";
    const additions: unknown[] = [];
    const create = runInNewContext(`(${body})`, {
      process: { platform: actualPlatform },
      fixedWindowsEnvironment: (extra: Record<string, string>) => {
        additions.push(extra);
        return actualPlatform === "win32"
          ? Object.freeze({ SystemRoot: "C:\\Windows", ...extra })
          : null;
      },
      observedWindowsUserProfileFromOs: () => profile,
    }) as (options?: {
      platform?: NodeJS.Platform;
      userProfile?: boolean;
    }) => Readonly<Record<string, string>> | null;
    assert.equal(Object.keys(create({ platform: "linux" }) ?? {}).length, 0);
    assert.equal(create({ platform: "linux", userProfile: true }), null);
    const neutral = create({ platform: "win32" });
    if (actualPlatform === "win32") {
      assert.equal(neutral?.SystemRoot, "C:\\Windows");
      assert.equal(neutral?.USERPROFILE, undefined);
      assert.equal(
        create({ platform: "win32", userProfile: true })?.USERPROFILE,
        profile,
      );
      assert.equal(Object.isFrozen(create()), true);
      profile = null;
      assert.equal(create({ userProfile: true }), null);
    } else {
      assert.equal(neutral, null);
      assert.equal(create({ platform: "win32", userProfile: true }), null);
      assert.equal(Object.keys(create() ?? {}).length, 0);
    }
    assert.ok(
      additions.every((value) =>
        Object.keys(value as object).every((key) => key === "USERPROFILE"),
      ),
    );
  }
});

/**
 * Host専用環境が作成Ownerと同じ親候補だけを搬送することを確認する。
 *
 * @responsibility 空TMP／TEMP、自由Path、別場所fallbackと一般環境の変更を防ぐ。
 * @trace PRL-UT-006
 * @precondition 現Sourceの環境構成bodyを純値・合成metadataへ接続する。
 * @stimulus 正常、基礎環境欠落、相対・UNC・NUL、metadataとrealpath失敗、型・reparse差を与える。
 * @observation TMP／TEMP、他fieldの不変性、nullと依存呼出回数。
 * @oracle 正常だけ同じcanonical親を両fieldへ設定し、全不正例はfallbackなしでnull。
 * @cleanup N/A: memory上の依存だけ。実Filesystemを変更しない。
 * @boundary 本番関数bodyのUT。Win32所在・ACL・元対象親の実照合は別ITへ残す。
 */
test("Host専用環境はcanonical親を両一時fieldへ結び不明を補完しない", () => {
  const source = readFileSync(
    new URL("../../../src/process/environment.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export function createWindowsHostTerminalHelperEnvironment(",
  );
  assert.ok(start > 0);
  const end = source.indexOf("\n/**", start);
  assert.ok(end > start);
  const body = stripTypeScriptTypes(
    source.slice(start, end).replace(/^export /u, ""),
  );
  const base = Object.freeze({
    TMP: "",
    TEMP: "",
    USERPROFILE: "C:\\Users\\fixture",
    ALL_PROXY: "",
  });
  for (const scenario of [
    "normal",
    "base_missing",
    "relative",
    "unc",
    "nul",
    "root",
    "candidate_file",
    "candidate_reparse",
    "metadata_throw",
    "realpath_throw",
    "canonical_unc",
    "canonical_root",
    "canonical_relative",
    "parent_file",
    "parent_reparse",
  ]) {
    let calls = 0;
    const candidate =
      scenario === "relative"
        ? "relative"
        : scenario === "unc"
          ? "\\\\server\\temp"
          : scenario === "nul"
            ? "C:\\tmp\0"
            : scenario === "root"
              ? "C:\\"
              : "C:\\temp-candidate";
    const canonical =
      scenario === "canonical_unc"
        ? "\\\\server\\temp"
        : scenario === "canonical_root"
          ? "C:\\"
          : scenario === "canonical_relative"
            ? "relative"
            : "C:\\canonical-temp";
    const evaluate = runInNewContext(`(${body})`, {
      createChildProcessEnvironment: () =>
        scenario === "base_missing" ? null : base,
      os: {
        tmpdir: () => {
          calls += 1;
          return candidate;
        },
      },
      path,
      fs: {
        realpathSync: () => {
          if (scenario === "realpath_throw")
            throw new Error("fixture_realpath_unknown");
          return canonical;
        },
        lstatSync: (value: string) => {
          if (scenario === "metadata_throw")
            throw new Error("fixture_metadata_unknown");
          const isCandidate = value === candidate;
          return {
            isDirectory: () =>
              scenario !== (isCandidate ? "candidate_file" : "parent_file"),
            isSymbolicLink: () =>
              scenario ===
              (isCandidate ? "candidate_reparse" : "parent_reparse"),
          };
        },
      },
    }) as () => Readonly<Record<string, string>> | null;
    const actual = evaluate();
    if (scenario === "normal") {
      assert.ok(actual);
      assert.equal(actual.TMP, canonical);
      assert.equal(actual.TEMP, canonical);
      assert.equal(actual.USERPROFILE, base.USERPROFILE);
      assert.equal(actual.ALL_PROXY, base.ALL_PROXY);
      assert.equal(Object.isFrozen(actual), true);
    } else assert.equal(actual, null, scenario);
    assert.equal(calls, scenario === "base_missing" ? 0 : 1);
    assert.equal(base.TMP, "");
    assert.equal(base.TEMP, "");
  }
});

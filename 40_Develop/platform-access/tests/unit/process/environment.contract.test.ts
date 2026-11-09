/**
 * 共通子Process環境のOS選択とProfile条件を検証する。
 * @packageDocumentation
 * @responsibility OS固定・Profile付与・観測不能時の拒否を検査する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 共通子Processの環境構築。
 * @boundary 本番本文と模擬Filesystem。実OS所在・ACL観測ではない。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
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
    const create = runInNewContext(`(${body}\n)`, {
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

/**
 * 認証管理Directoryの自作・終了境界を確認する。
 * @responsibility 既存・差替え・非空・観測不能を元実体や不存在へ補完しない。
 * @trace ERB-UT-016
 * @level UT
 * @scope 実関数本文とメモリ内Filesystem代役。実Directory・AI・Docker・保持物を操作しない。
 * @packageDocumentation
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";

/**
 * 固定子のexclusive作成と元実体・空・明示不存在を反証する。
 * @responsibility 認証管理領域は自作した元の空Directoryだけを終了する
 * @trace ERB-UT-016
 * @precondition 実関数本文とメモリ内Filesystem代役。実Directory・AI・Docker・保持物を操作しない。
 * @stimulus 認証管理領域は自作した元の空Directoryだけを終了するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証管理領域は自作した元の空Directoryだけを終了するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証管理領域は自作した元の空Directoryだけを終了する", () => {
  const source = fs.readFileSync(
    new URL("../../src/lifecycle/authentication.ts", import.meta.url),
    "utf8",
  );
  const recordPath = `C:\\runtime\\Recovery\\provider-authentication\\codex.${"a".repeat(64)}.json`;
  const prefix = path.win32.basename(recordPath, ".json") + ".management-";
  const parent = path.win32.dirname(recordPath);
  const directory = path.win32.join(parent, prefix + "b".repeat(32));
  let state = "absent",
    nonempty = false,
    parentLink = false,
    lstatUnknown = false,
    parentIno = 4n;
  let generations = [
    path.win32.basename(recordPath, ".json") + ".management",
    prefix + "c".repeat(32),
  ];
  const effects: string[] = [];
  /**
   * inodeとlink属性を持つ合成metadataを構築する。
   * @responsibility inodeとlink属性を持つ合成metadataを構築する
   * @trace ERB-UT-016
   * @precondition 実関数本文とメモリ内Filesystem代役。実Directory・AI・Docker・保持物を操作しない。
   * @stimulus inodeとlink属性を持つ合成metadataを構築する。
   * @observation 構築した候補、有限応答または検出した例外。
   * @oracle 呼出し元の対照試験へ固定入力・観測を渡し、実処理の成功を捏造しない。
   * @cleanup 実資源の所有は呼出し元Caseに残し、構築した合成値自体に解放処理はない。
   * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
   */
  const metadata = (ino: bigint, link = false) => ({
    dev: 1n,
    ino,
    birthtimeNs: 3n,
    isDirectory: () => true,
    isSymbolicLink: () => link,
  });
  const api = runInNewContext(
    `${sourceDeclaration(source, "createAuthenticationManagementDirectory")}\n${sourceDeclaration(source, "removeAuthenticationManagementDirectory")}\n({create:createAuthenticationManagementDirectory,remove:removeAuthenticationManagementDirectory})`,
    {
      path,
      Object,
      fs: {
        realpathSync: (value: string) => value,
        lstatSync: (value: string) => {
          if (value === parent) return metadata(parentIno, parentLink);
          assert.equal(value, directory);
          if (lstatUnknown)
            throw Object.assign(Error("unavailable"), { code: "EACCES" });
          if (state === "absent")
            throw Object.assign(Error("absent"), { code: "ENOENT" });
          return metadata(state === "replacement" ? 9n : 2n);
        },
        mkdirSync: (value: string, options: { recursive: boolean }) => {
          assert.equal(value, directory);
          assert.equal(options.recursive, false);
          if (state !== "absent")
            throw Object.assign(Error("existing"), { code: "EEXIST" });
          effects.push("mkdir");
          state = "original";
        },
        readdirSync: (value: string) =>
          value === parent
            ? generations
            : nonempty
              ? ["docker-cli-config"]
              : [],
        rmdirSync: (value: string) => {
          assert.equal(value, directory);
          effects.push("rmdir");
          state = "absent";
        },
      },
    },
  ) as {
    create(
      record: { recordPath: string },
      directory: string,
    ): { directory: string; assertCurrent(): boolean } | null;
    remove(owned: { directory: string; assertCurrent(): boolean }): boolean;
  };
  const owned = api.create({ recordPath }, directory);
  assert.ok(owned);
  assert.equal(owned.directory, directory);
  assert.equal(owned.assertCurrent(), true);
  assert.deepEqual(effects, ["mkdir"]);
  assert.equal(api.create({ recordPath }, directory), null, "既存を採用しない");
  nonempty = true;
  assert.equal(api.remove(owned), false);
  nonempty = false;
  state = "replacement";
  assert.equal(owned.assertCurrent(), false);
  assert.equal(api.remove(owned), false);
  state = "original";
  lstatUnknown = true;
  assert.equal(api.remove(owned), false);
  lstatUnknown = false;
  parentIno = 5n;
  assert.equal(owned.assertCurrent(), false);
  assert.equal(api.remove(owned), false);
  parentIno = 4n;
  assert.equal(api.remove(owned), true);
  assert.deepEqual(effects, ["mkdir", "rmdir"]);
  parentLink = true;
  assert.equal(api.create({ recordPath }, directory), null);
  parentLink = false;
  assert.equal(
    api.create({ recordPath }, path.win32.join(parent, "unknown")),
    null,
  );
  generations = Array.from(
    { length: 96 },
    (_, index) => prefix + index.toString(16).padStart(32, "0"),
  );
  assert.equal(api.create({ recordPath }, directory), null);
  assert.deepEqual(effects, ["mkdir", "rmdir"]);
});

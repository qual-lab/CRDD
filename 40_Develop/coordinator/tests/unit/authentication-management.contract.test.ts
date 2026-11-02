/**
 * 認証管理Directoryの自作・終了境界を確認する。
 * @responsibility 既存・差替え・非空・観測不能を元実体や不存在へ補完しない。
 * @trace ARCH-000010
 * @level UT
 * @scope 実関数本文とメモリ内Filesystem代役。実Directory・AI・Docker・保持物を操作しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";

/** 固定子のexclusive作成と元実体・空・明示不存在を反証する。 */
test("認証管理領域は自作した元の空Directoryだけを終了する", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/authority.ts", import.meta.url),
    "utf8",
  );
  const recordPath = `C:\\runtime\\Recovery\\provider-authentication\\codex.${"a".repeat(64)}.json`;
  const directory = recordPath.replace(/\.json$/u, ".management");
  let state = "absent",
    nonempty = false,
    parentLink = false,
    lstatUnknown = false;
  const effects: string[] = [];
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
          if (value === path.win32.dirname(recordPath))
            return metadata(4n, parentLink);
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
        readdirSync: () => (nonempty ? ["docker-cli-config"] : []),
        rmdirSync: (value: string) => {
          assert.equal(value, directory);
          effects.push("rmdir");
          state = "absent";
        },
      },
    },
  ) as {
    create(record: {
      recordPath: string;
    }): { directory: string; identity: string } | null;
    remove(owned: { directory: string; identity: string }): boolean;
  };
  const owned = api.create({ recordPath });
  assert.ok(owned);
  assert.equal(owned.directory, directory);
  assert.deepEqual(effects, ["mkdir"]);
  assert.equal(api.create({ recordPath }), null, "既存を採用しない");
  nonempty = true;
  assert.equal(api.remove(owned), false);
  nonempty = false;
  state = "replacement";
  assert.equal(api.remove(owned), false);
  state = "original";
  lstatUnknown = true;
  assert.equal(api.remove(owned), false);
  lstatUnknown = false;
  assert.equal(api.remove(owned), true);
  assert.deepEqual(effects, ["mkdir", "rmdir"]);
  parentLink = true;
  assert.equal(api.create({ recordPath }), null);
  assert.deepEqual(effects, ["mkdir", "rmdir"]);
});

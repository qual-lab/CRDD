/**
 * 保存Identityの単一配置観測と次の呼出しでの再観測を実Filesystemで検証する。
 * @responsibility exact Capability、差替え拒否、観測間・呼出し間の鮮度を確認する。
 * @trace RFD-IT-001
 * @trace RFD-IT-002
 * @level IT
 * @scope 自己生成RepositoryとWorktreeだけ。外部AI・Dockerなし。
 * @boundary Version Controlの内部観測とPackage公開結果。
 * @packageDocumentation
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import * as publicApi from "../../src/index.ts";
import { getRepository } from "../../src/repository/location.ts";
import { readRepositoryStorageIdentity } from "../../src/repository/revision.ts";

/**
 * 内外のGit設定を引き継がず自己生成Repositoryだけを準備する。
 * @responsibility 試験所有のRootだけへ固定のGit準備操作を発行する。
 * @trace RFD-IT-001
 * @precondition cwdは同じ試験が所有するRoot。
 * @stimulus 固定のローカルGit操作だけ。
 * @observation Gitの終了値と有界な標準出力。
 * @oracle 異常終了は試験失敗にする。
 * @cleanup 呼出し元がfixture全体を回収する。
 * @boundary 合成RepositoryとローカルGit Process。
 */
function storageIdentityGit(cwd: string, args: readonly string[]) {
  return execFileSync(
    "git",
    [
      "-C",
      cwd,
      "-c",
      "core.hooksPath=NUL",
      "-c",
      "commit.gpgSign=false",
      ...args,
    ],
    {
      encoding: "utf8",
      windowsHide: true,
      timeout: 15_000,
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(([key]) => !/^GIT_/iu.test(key)),
        ),
        GIT_CONFIG_GLOBAL: "NUL",
        GIT_CONFIG_SYSTEM: "NUL",
      },
    },
  ).trim();
}

/**
 * normal／linkedの実Gitと、exact清掃対象を作る。
 * @responsibility 試験ごとの独立したRootとCapabilityを用意する。
 * @trace RFD-IT-001
 * @precondition Repository-local試験Rootだけを使用する。
 * @stimulus 空Commitと必要時だけ専用Worktreeを作成する。
 * @observation 元Root・common config・Capability。
 * @oracle 初期検証が不成立なら試験を停止する。
 * @cleanup enclosing fixtureだけを削除し不存在を確認する。
 * @boundary Repository-local試験領域と本番Root検証。
 */
function storageIdentityFixture(t: test.TestContext, linked = false) {
  const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
  fs.mkdirSync(parent, { recursive: true });
  const area = fs.mkdtempSync(path.join(parent, "storage-revalidation-"));
  t.after(() => {
    assert.equal(path.dirname(fs.realpathSync.native(area)), parent);
    fs.rmSync(area, { recursive: true, force: true });
    assert.equal(fs.existsSync(area), false);
  });
  const primary = path.join(area, "primary");
  fs.mkdirSync(primary);
  storageIdentityGit(primary, [
    "init",
    "--quiet",
    "--template=",
    "--initial-branch=main",
  ]);
  fs.mkdirSync(path.join(primary, ".git/info"));
  fs.writeFileSync(path.join(primary, ".git/info/exclude"), "");
  storageIdentityGit(primary, [
    "-c",
    "user.name=Test",
    "-c",
    "user.email=test@example.invalid",
    "commit",
    "--allow-empty",
    "-m",
    "synthetic",
  ]);
  const root = linked ? path.join(area, "linked") : primary;
  if (linked)
    storageIdentityGit(primary, ["worktree", "add", "--detach", root]);
  const verified = getRepository(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") throw Error("fixture_root_invalid");
  return {
    root,
    area,
    capability: verified.capability,
    config: path.join(primary, ".git/config"),
  };
}

/**
 * 一回のIdentity観測が一つの配置読取りで閉じ、別呼出しでは再観測する。
 * @responsibility 公開shapeを維持した単一観測と偽Capability拒否を反証する。
 * @trace RFD-IT-001
 * @precondition 通常Repositoryと専用linked worktreeを実Gitで準備する。
 * @stimulus normal／linked、同一呼出し反復、偽Capability、不正化・同一内容でのGit実体置換と復帰。
 * @observation configの実open回数、公開shapeとIdentity。
 * @oracle 各正常観測は一open、不正入力は零、旧値のcacheなし。
 * @cleanup FS代役をfinallyで復元しfixtureを回収する。
 * @boundary 本番保存Identity観測とFilesystem読取り。
 */
test("保存Identityはnormal／linkedを一つの配置観測で確認し公開APIを増やさない", (t) => {
  assert.equal(
    Object.hasOwn(publicApi, "observeVerifiedRepositoryLayout"),
    false,
  );
  for (const linked of [false, true]) {
    const fixture = storageIdentityFixture(t, linked);
    const original = fs.openSync;
    let opens = 0;
    fs.openSync = ((...args: Parameters<typeof original>) => {
      if (String(args[0]) === fixture.config) opens++;
      return Reflect.apply(original, fs, args);
    }) as typeof original;
    try {
      const before = readRepositoryStorageIdentity(fixture.capability);
      assert.ok(before);
      assert.equal(opens, 1);
      assert.deepEqual(Object.keys(before).sort(), [
        "repositoryForm",
        "repositoryIdentity",
        "repositoryInstanceIdentity",
      ]);
      assert.equal(Object.isFrozen(before), true);
      assert.equal(before.repositoryForm, linked ? "linked" : "primary");
      opens = 0;
      assert.deepEqual(
        readRepositoryStorageIdentity(fixture.capability),
        before,
      );
      assert.equal(opens, 1);
      opens = 0;
      assert.equal(
        readRepositoryStorageIdentity({ ...fixture.capability }),
        null,
      );
      assert.equal(opens, 0);
      const config = fs.readFileSync(fixture.config);
      try {
        fs.writeFileSync(fixture.config, "[extensions]\nunsupported=true\n");
        assert.equal(readRepositoryStorageIdentity(fixture.capability), null);
      } finally {
        fs.writeFileSync(fixture.config, config);
      }
      assert.deepEqual(
        readRepositoryStorageIdentity(fixture.capability),
        before,
      );
      if (!linked) {
        const marker = path.dirname(fixture.config);
        const retired = path.join(fixture.area, "retired-between-reads");
        fs.renameSync(marker, retired);
        try {
          fs.cpSync(retired, marker, { recursive: true });
          const swapped = readRepositoryStorageIdentity(fixture.capability);
          assert.ok(swapped);
          assert.notEqual(
            swapped.repositoryIdentity,
            before.repositoryIdentity,
          );
          assert.equal(
            swapped.repositoryInstanceIdentity,
            before.repositoryInstanceIdentity,
          );
        } finally {
          fs.rmSync(marker, { recursive: true, force: true });
          fs.renameSync(retired, marker);
        }
        opens = 0;
        assert.deepEqual(
          readRepositoryStorageIdentity(fixture.capability),
          before,
        );
        assert.equal(opens, 1);
      }
    } finally {
      fs.openSync = original;
    }
  }
});

/**
 * 配置観測中に実体・配置・観測可能性が変われば受理しない。
 * @responsibility 同じ配置観測内の実体差と、完全復帰後の再成立を確認する。
 * @trace RFD-IT-002
 * @precondition 同じCapabilityで正常な保存Identityを取得済みとする。
 * @stimulus 配置観測が設定を開いた後のRoot、commonDir、kind、reparse、不明への変更。
 * @observation null拒否と、完全復帰後の同じCapabilityの再成立。
 * @oracle 変更途中の値は返さず、永続的な失効状態も追加しない。
 * @cleanup 観測代役と実体をfinallyで復元し、所有fixtureだけを回収する。
 * @boundary 同一配置観測内の構造再照合と実Filesystemの差替え。
 */
test("保存Identityは配置観測中の差替え・reparse・観測不能を拒否する", (t) => {
  for (const scenario of [
    "root",
    "common",
    "kind",
    "reparse",
    "unknown",
  ] as const) {
    const fixture = storageIdentityFixture(t);
    const before = readRepositoryStorageIdentity(fixture.capability);
    assert.ok(before);
    const original = fs.lstatSync;
    const open = fs.openSync;
    let configurationOpened = false;
    let injected = false;
    let restore = () => {};
    fs.openSync = ((...args: Parameters<typeof open>) => {
      if (String(args[0]) === fixture.config) configurationOpened = true;
      return Reflect.apply(open, fs, args);
    }) as typeof open;
    Object.defineProperty(fs, "lstatSync", {
      value: ((...args: Parameters<typeof original>) => {
        if (
          String(args[0]) === fixture.root &&
          configurationOpened &&
          !injected
        ) {
          injected = true;
          const retired = path.join(fixture.area, "retired");
          if (scenario === "unknown")
            throw Error("synthetic_observation_unavailable");
          if (scenario === "root" || scenario === "reparse") {
            fs.renameSync(fixture.root, retired);
            if (scenario === "root")
              fs.cpSync(retired, fixture.root, { recursive: true });
            else fs.symlinkSync(retired, fixture.root, "junction");
            restore = () => {
              if (scenario === "reparse") fs.unlinkSync(fixture.root);
              else fs.rmSync(fixture.root, { recursive: true, force: true });
              fs.renameSync(retired, fixture.root);
            };
          } else {
            const marker = path.join(fixture.root, ".git");
            fs.renameSync(marker, retired);
            if (scenario === "common")
              fs.cpSync(retired, marker, { recursive: true });
            else fs.writeFileSync(marker, `gitdir: ${retired}\n`);
            restore = () => {
              fs.rmSync(marker, { recursive: true, force: true });
              fs.renameSync(retired, marker);
            };
          }
        }
        return Reflect.apply(original, fs, args);
      }) as typeof original,
    });
    try {
      assert.equal(
        readRepositoryStorageIdentity(fixture.capability),
        null,
        scenario,
      );
      assert.equal(injected, true, scenario);
    } finally {
      fs.openSync = open;
      Object.defineProperty(fs, "lstatSync", { value: original });
      restore();
    }
    assert.deepEqual(
      readRepositoryStorageIdentity(fixture.capability),
      before,
      scenario,
    );
  }
});

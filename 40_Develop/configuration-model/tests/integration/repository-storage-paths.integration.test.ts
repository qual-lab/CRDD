/**
 * 設定の固定配置・実体・Ignore・Reader境界を検証する。
 * @packageDocumentation
 * @responsibility 汎用Runtime領域を再公開せずconfig固有の保証を保持する。
 * @trace RDL-IT-001
 * @level IT
 * @scope Configuration保存、VC Root、Filesystem。
 * @boundary 自己生成Repository-local Fixtureのみ。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import {
  getRepository,
  getRepositoryFromWorkingDirectory,
} from "../../../version-control/src/index.ts";
import {
  configurationPaths,
  ensureConfigurationDirectory,
  observeConfigurationDirectory,
} from "../../src/storage/configuration-directory.ts";
import {
  readStableFileSnapshot,
  sameStableFileIdentity,
} from "../../src/storage/file-snapshot.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
/**
 * WindowsのFile ID表現を上限付き保存Readerへ接続する。
 * @responsibility 上位bit・欠測・不正範囲・読取り中の別実体を区別する。
 * @trace RDL-IT-001
 * @precondition Repository内の自己生成Fileだけを使用する。
 * @stimulus lstatとfstatに同じ符号付き64bit表現または不正値を返す。
 * @observation 読取り結果、正規化したIDと拒否例外を観測する。
 * @oracle 同じFile IDだけを受理し欠測・範囲外・別実体を拒否する。
 * @cleanup mockを復元し専用Rootを回収する。
 * @boundary Domain保存Reader→Filesystem。
 */
test("Windowsの上位bit付きFile IDで保存Readerの同一性確認を維持する", {
  skip: process.platform !== "win32",
}, (t) => {
  const parent = path.join(repositoryRoot, ".crdd/tests");
  fs.mkdirSync(parent, { recursive: true });
  const root = fs.mkdtempSync(path.join(parent, "bounded-id-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "state.json");
  fs.writeFileSync(file, '{"state":"ready"}');
  const expected = BigInt.asUintN(
    64,
    fs.lstatSync(file, { bigint: true }).ino | (1n << 63n),
  );
  let invalid: bigint | null = null;
  let changed = false;
  for (const name of ["lstatSync", "fstatSync"] as const) {
    const original = fs[name];
    t.mock.method(fs, name, (...args: unknown[]) => {
      const metadata = Reflect.apply(original, fs, args) as fs.BigIntStats;
      if (typeof metadata.ino === "bigint") {
        metadata.ino = invalid ?? BigInt.asIntN(64, metadata.ino | (1n << 63n));
        if (changed && name === "fstatSync") metadata.ino ^= 1n;
      }
      return metadata;
    });
  }
  const observed = readStableFileSnapshot(file);
  assert.equal(observed.identity.ino, expected);
  assert.equal(observed.bytes.toString(), '{"state":"ready"}');
  const signed = { ...observed.identity, ino: BigInt.asIntN(64, expected) };
  assert.equal(sameStableFileIdentity(signed, observed.identity), true);
  assert.equal(sameStableFileIdentity(observed.identity, signed), true);
  assert.equal(
    sameStableFileIdentity(signed, {
      ...observed.identity,
      ino: expected ^ 1n,
    }),
    false,
  );
  for (const field of [
    "dev",
    "birthtimeNs",
    "ctimeNs",
    "mtimeNs",
    "size",
    "mode",
  ] as const) {
    assert.equal(
      sameStableFileIdentity(signed, {
        ...observed.identity,
        [field]: observed.identity[field] + 1n,
      }),
      false,
    );
  }
  assert.equal(
    sameStableFileIdentity(
      { ...signed, ino: -(1n << 63n) - 1n },
      {
        ...observed.identity,
        ino: (1n << 63n) - 1n,
      },
    ),
    false,
  );
  changed = true;
  assert.throws(() => readStableFileSnapshot(file), /file_snapshot_changed/);
  changed = false;
  for (const value of [0n, -(1n << 63n) - 1n]) {
    invalid = value;
    assert.throws(() => readStableFileSnapshot(file), /file_snapshot_invalid/);
  }
});

/** 設定だけの自己生成Rootを作り、mock復元後に同じ実体を回収する。 @trace RDL-IT-001 */
function fixture(t: TestContext, git = true) {
  const directory = createRepositoryTestDirectory("configuration-boundary-");
  const root = directory.path;
  t.after(() => {
    t.mock.restoreAll();
    directory.cleanup();
  });
  if (git) {
    fs.mkdirSync(path.join(root, ".git", "info"), { recursive: true });
    fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
    fs.writeFileSync(
      path.join(root, ".git", "config"),
      "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
    );
  }
  return root;
}

/** configの観測は作成と分離し、不明・置換・Linkを保持する。 @trace RDL-IT-001 */
test("設定Ownerの観測は不存在・境界置換・観測不能をEffect0で区別する", (t) => {
  const root = fixture(t);
  const verified = getRepository(root);
  if (verified.status !== "completed") assert.fail("fixture_invalid");
  const initial = fs.readdirSync(root);
  assert.equal(
    observeConfigurationDirectory(verified.capability).status,
    "not_observed",
  );
  assert.deepEqual(fs.readdirSync(root), initial);
  assert.equal(
    observeConfigurationDirectory({ ...verified.capability }).status,
    "blocked",
  );
  const runtime = path.join(root, ".crdd"),
    config = path.join(runtime, "config");
  fs.writeFileSync(runtime, "not-directory");
  assert.equal(
    observeConfigurationDirectory(verified.capability).status,
    "blocked",
  );
  assert.equal(fs.readFileSync(runtime, "utf8"), "not-directory");
  fs.unlinkSync(runtime);
  const linkTarget = path.join(root, "link-target");
  fs.mkdirSync(linkTarget);
  fs.symlinkSync(
    linkTarget,
    runtime,
    process.platform === "win32" ? "junction" : "dir",
  );
  assert.equal(
    observeConfigurationDirectory(verified.capability).status,
    "blocked",
  );
  assert.deepEqual(fs.readdirSync(linkTarget), []);
  fs.unlinkSync(runtime);
  fs.rmdirSync(linkTarget);
  fs.mkdirSync(runtime);
  assert.equal(
    observeConfigurationDirectory(verified.capability).status,
    "not_observed",
  );
  fs.mkdirSync(config);
  const first = observeConfigurationDirectory(verified.capability);
  if (first.status !== "ready") assert.fail("first_invalid");
  assert.equal(first.effectIssued, false);
  assert.equal(first.directory, config);
  assert.equal(Object.hasOwn(first, "root"), false);
  assert.match(first.boundaryIdentity, /^[a-f0-9]{64}$/u);
  const old = path.join(root, "prior-config");
  fs.renameSync(config, old);
  fs.mkdirSync(config);
  const replaced = observeConfigurationDirectory(verified.capability);
  assert.equal(replaced.status, "ready");
  if (replaced.status === "ready")
    assert.notEqual(replaced.boundaryIdentity, first.boundaryIdentity);
  const stat = fs.lstatSync,
    mkdir = fs.mkdirSync;
  let creates = 0;
  t.mock.method(fs, "mkdirSync", (...args: Parameters<typeof fs.mkdirSync>) => {
    creates++;
    return mkdir(...args);
  });
  t.mock.method(fs, "lstatSync", (target: fs.PathLike, ...args: unknown[]) => {
    if ([runtime, config].includes(path.resolve(String(target))))
      throw Object.assign(new Error("unobservable"), { code: "EACCES" });
    return Reflect.apply(stat, fs, [target, ...args]);
  });
  const unknown = observeConfigurationDirectory(verified.capability);
  assert.equal(unknown.status, "blocked");
  if (unknown.status === "blocked")
    assert.equal(
      unknown.reason,
      "repository_runtime_data_area_observation_failed",
    );
  assert.equal(creates, 0);
});

/** 私有配置は設定だけを返し、他OwnerのPath集合を含めない。 @trace RDL-IT-001 */
test("検証済みRepository Rootだけから設定の固定配置を解決する", () => {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed") assert.fail("fixture_invalid");
  assert.deepEqual(configurationPaths(verified.capability), {
    repositoryRoot,
    root: path.join(repositoryRoot, ".crdd"),
    config: path.join(repositoryRoot, ".crdd", "config"),
  });
  assert.equal(configurationPaths({} as never), null);
});

/** 既存Ignoreを確定してからconfigだけを準備する。 @trace RDL-IT-001 */
test("設定保存は固定configだけを作成し既存内容を保持する", (t) => {
  const root = fixture(t),
    verified = getRepository(root);
  if (verified.status !== "completed") assert.fail("fixture_invalid");
  assert.deepEqual(ensureConfigurationDirectory(verified.capability), {
    status: "ready",
    repositoryRoot: root,
    directory: path.join(root, ".crdd", "config"),
  });
  assert.equal(
    fs.readFileSync(path.join(root, ".git", "info", "exclude"), "utf8"),
    ".crdd/\n",
  );
  const sentinel = path.join(root, ".crdd", "config", "existing.json");
  fs.writeFileSync(sentinel, "preserved");
  assert.equal(
    ensureConfigurationDirectory(verified.capability)?.status,
    "ready",
  );
  assert.equal(fs.readFileSync(sentinel, "utf8"), "preserved");
  assert.deepEqual(fs.readdirSync(path.join(root, ".crdd")), ["config"]);
});

/** Ignore出版の不明を未実施へ戻さず設定作成0で返す。 @trace RDL-IT-001 */
test("IgnoreのEffect不明をnullへ畳まず設定Directoryを作らない", (t) => {
  const root = fixture(t),
    verified = getRepository(root);
  if (verified.status !== "completed") assert.fail("fixture_invalid");
  const rename = fs.renameSync,
    open = fs.openSync;
  const exclude = path.join(root, ".git", "info", "exclude");
  let replaced = false;
  t.mock.method(
    fs,
    "renameSync",
    (...args: Parameters<typeof fs.renameSync>) => {
      const result = rename(...args);
      if (args[1] === exclude) replaced = true;
      return result;
    },
  );
  t.mock.method(fs, "openSync", (...args: Parameters<typeof fs.openSync>) => {
    if (replaced && args[0] === exclude)
      throw Object.assign(new Error("synthetic_readback_unavailable"), {
        code: "EIO",
      });
    return open(...args);
  });
  const result = ensureConfigurationDirectory(verified.capability);
  assert.equal(result?.status, "blocked");
  if (result?.status !== "blocked") assert.fail("blocked_required");
  assert.equal(result.effectStateUnknown, true);
  assert.equal(result.retryAllowed, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.match(result.recoveryReference ?? "", /^repository-local-ignore\./u);
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
});

/** Repositoryの子DirectoryをRoot能力に昇格しない。 @trace RDL-IT-001 */
test("Repositoryの子DirectoryはRoot Capabilityとして拒否する", () => {
  assert.deepEqual(getRepository(import.meta.dirname), {
    status: "blocked",
    reason: "repository_root_invalid",
    capability: null,
  });
});

/** 任意Rootと汎用領域APIを公開しない。 @trace RDL-IT-001 */
test("任意Directoryと旧汎用Root入口からPath能力を取得できない", async (t) => {
  assert.equal(getRepository(fixture(t, false)).status, "blocked");
  const api = await import("../../src/index.ts");
  for (const name of [
    "resolveRepositoryRuntimeDataPathsFromValidatedRoot",
    "resolveBundledRepositoryRuntimeDataPathsForProtectedSigning",
    "resolveRepositoryRuntimeDataPathsForInternalUse",
    "resolveRepositoryRuntimeDataPaths",
  ])
    assert.equal(Object.hasOwn(api, name), false, name);
});

/** Linkを通った起動Directoryから別Rootへ正規化しない。 @trace RDL-IT-001 */
test("junction経由のWorking DirectoryはRepository Rootへ正規化せず拒否する", (t) => {
  const root = fixture(t, false),
    alias = path.join(root, "repository-alias");
  try {
    fs.symlinkSync(repositoryRoot, alias, "junction");
    assert.deepEqual(
      getRepositoryFromWorkingDirectory(
        path.join(alias, "40_Develop", "configuration-model"),
      ),
      {
        status: "blocked",
        reason: "repository_root_invalid",
        capability: null,
      },
    );
  } finally {
    if (fs.existsSync(alias)) fs.unlinkSync(alias);
  }
});

/** 廃止領域の受付自体を公開せずEffect入口を残さない。 @trace RDL-IT-001 */
test("廃止verification Areaに新規Effectや互換aliasを発行しない", async () => {
  const api = await import("../../src/index.ts");
  for (const name of [
    "ensureRepositoryRuntimeDataArea",
    "observeRepositoryRuntimeDataArea",
    "requireReadyRepositoryRuntimeDataArea",
  ])
    assert.equal(Object.hasOwn(api, name), false, name);
});

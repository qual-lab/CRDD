/**
 * AI Profile CatalogのOwner別耐久Storeを検証する。
 *
 * @packageDocumentation
 * @responsibility Repository単体とCROSの設定Owner分離、改訂競合、不変Snapshotおよび再読取りを直接境界で検証する。
 * @trace RCM-IT-005
 * @level IT
 * @scope ai-profile、repository-config、cros-config、immutable-snapshot
 * @boundary RCM-IT-005=Direct Boundary: Runtime Root Resolver→Catalog Store→Filesystem
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { resolveCrosRuntimeRoots } from "../../../domain-model/src/index.ts";
import { defaultAiProfileCatalog } from "../../src/catalog/resolve.ts";
import {
  createHostAiProfileCatalogStore,
  createRepositoryAiProfileCatalogStore,
} from "../../src/storage/store.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * 保存段階の故障を型付き結果と実Fileの両方で確認する。
 * @responsibility 読取り失敗を空値、公開後故障を未保存へ丸めない。
 * @trace RCM-IT-005
 * @precondition Repository内の自己生成Git fixtureだけを使う。
 * @stimulus 読取り・書込み開始・公開後読戻し・staging清掃を一箇所ずつ失敗させる。
 * @observation 結果状態、段階、Snapshot欠測と公開Fileの存在を観測する。
 * @oracle read失敗はblocked、adopt失敗はunknown、公開後はFileが残っても成功にしない。
 * @cleanup mockを復元し、今回のfixtureだけ回収して不存在を確認する。
 * @boundary RCM-IT-005=Direct Boundary: Store→Node Filesystem
 */
test("Store故障は欠測と保存確定不能を区別し、自動再保存しない", async (context) => {
  const testsRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testsRoot, { recursive: true });
  for (const mode of [
    "read",
    "observe",
    "write",
    "verify",
    "cleanup",
  ] as const) {
    const fixture = await mkdtemp(path.join(testsRoot, "ai-profile-failure-"));
    initializeGitRepository(fixture);
    const adapter = createRepositoryAiProfileCatalogStore(fixture);
    assert.ok(adapter.store);
    const directory = path.join(
      fixture,
      ".crdd",
      "config",
      "ai-profile-catalog",
    );
    if (mode === "read") await mkdir(directory, { recursive: true });
    const method =
      mode === "observe"
        ? "lstatSync"
        : mode === "read"
          ? "readdirSync"
          : mode === "write"
            ? "openSync"
            : mode === "verify"
              ? "readFileSync"
              : "unlinkSync";
    const original = fs[method];
    let faults = 0;
    let writeOpens = 0;
    const openObserver =
      mode === "observe"
        ? context.mock.method(
            fs,
            "openSync",
            new Proxy(fs.openSync, {
              apply(target, receiver, args) {
                if (
                  typeof args[0] === "string" &&
                  args[0].startsWith(directory)
                )
                  writeOpens++;
                return Reflect.apply(target, receiver, args);
              },
            }),
          )
        : null;
    const mocked = context.mock.method(
      fs,
      method,
      new Proxy(original, {
        apply(target, receiver, args) {
          if (typeof args[0] === "string" && args[0].startsWith(directory)) {
            faults++;
            throw Object.assign(new Error("fixture-private-path-secret"), {
              code: "EACCES",
            });
          }
          return Reflect.apply(target, receiver, args);
        },
      }),
    );
    syncBuiltinESMExports();
    try {
      if (mode === "read" || mode === "observe") {
        assert.deepEqual(adapter.store.snapshot(), {
          status: "blocked",
          value: null,
          error: "ai_profile_catalog_read_failed",
        });
      }
      const outcome = adapter.store.adopt({
        expectedRevision: 0,
        candidate: defaultAiProfileCatalog,
      });
      assert.equal(outcome.status, "unknown");
      if (outcome.status !== "unknown") assert.fail("unknown required");
      assert.equal(outcome.phase, mode === "observe" ? "read" : mode);
      assert.equal(outcome.snapshot, null);
      assert.equal(outcome.revision, null);
      assert.equal(JSON.stringify(outcome).includes("fixture-private"), false);
      assert.equal(
        fs.existsSync(path.join(directory, "catalog-0000000001.json")),
        mode === "verify" || mode === "cleanup",
      );
      assert.equal(faults, mode === "read" || mode === "observe" ? 2 : 1);
      if (mode === "observe") assert.equal(writeOpens, 0);
    } finally {
      mocked.mock.restore();
      openObserver?.mock.restore();
      syncBuiltinESMExports();
      await rm(fixture, { recursive: true, force: true });
      assert.equal(fs.existsSync(fixture), false);
    }
  }
});

/**
 * CROS Catalogの親とCatalog自身のLinkを構成時・利用時に拒否する。
 * @responsibility 認証済み操作でも固定config境界を越えて保存しないことを反証する。
 * @trace RCM-IT-005
 * @precondition 自己生成Host候補と外部target代役を同じ所有fixtureに置く。
 * @stimulus 親Link、Catalog Link、構成後のCatalog Link差替えを与える。
 * @observation blockedまたはsnapshot/adopt例外、target内容と一覧を比較する。
 * @oracle 全反例でCatalog出版0、target byte不変、不存在を空成功にしない。
 * @cleanup exact自己生成fixtureを回収し不存在を確認する。
 * @boundary CROS config Resolver→既存Store Owner→Filesystem。
 */
test("CROS Catalogは親Linkと構成後のCatalog Linkを拒否する", async () => {
  const parent = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  for (const mode of ["parent", "catalog", "after-ready"] as const) {
    const directory = await mkdtemp(
      path.join(parent, "ai-profile-root-boundary-"),
    );
    try {
      const target = path.join(directory, "target");
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, "marker.txt"), "unchanged");
      const input =
        process.platform === "win32"
          ? {
              platform: "win32" as const,
              publisher: "qual-lab",
              application: "cros" as const,
              trustDomainId: "local-test",
              localAppData: directory,
            }
          : {
              platform: "linux" as const,
              publisher: "qual-lab",
              application: "cros" as const,
              trustDomainId: "local-test",
              homeDirectory: directory,
              xdgConfigHome: directory,
              xdgStateHome: path.join(directory, "state"),
            };
      const roots = resolveCrosRuntimeRoots(input);
      assert.ok(roots);
      const catalog = path.join(roots.config, "ai-profile-catalog");
      if (mode === "parent") {
        fs.symlinkSync(target, path.join(directory, "qual-lab"), "junction");
        assert.equal(createHostAiProfileCatalogStore(input).status, "blocked");
      } else {
        fs.mkdirSync(roots.config, { recursive: true });
        if (mode === "catalog") {
          fs.symlinkSync(target, catalog, "junction");
          assert.equal(
            createHostAiProfileCatalogStore(input).status,
            "blocked",
          );
        } else {
          const adapter = createHostAiProfileCatalogStore(input);
          assert.equal(adapter.status, "ready");
          assert.ok(adapter.store);
          fs.symlinkSync(target, catalog, "junction");
          assert.equal(adapter.store?.snapshot().status, "blocked");
          assert.equal(
            adapter.store?.adopt({
              expectedRevision: 0,
              candidate: defaultAiProfileCatalog,
            })?.status,
            "unknown",
          );
        }
      }
      assert.deepEqual(fs.readdirSync(target), ["marker.txt"]);
      assert.equal(
        fs.readFileSync(path.join(target, "marker.txt"), "utf8"),
        "unchanged",
      );
    } finally {
      assert.equal(path.dirname(directory), parent);
      assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
      await rm(directory, { recursive: true });
      assert.equal(fs.existsSync(directory), false);
    }
  }
});

/**
 * CROS Catalogの観測不能と不足chain作成中のLink置換を反証する。
 * @responsibility 異常を既定値や保存成功に変換せず、候補本文の書込みを止める。
 * @trace RCM-IT-005
 * @precondition 自己生成Rootと同期Filesystem故障注入。
 * @stimulus lstatのEACCESとmkdir直後の親junction置換を与える。
 * @observation Store拒否／例外、書込みopen数、target markerと一覧。
 * @oracle 観測不能は空成功0、置換後Catalog出版0、target不変。
 * @cleanup Node組込みExportをfinallyで復元し、fixtureだけ回収する。
 * @boundary CROS Storeの観測・Directory作成・出版前境界。
 */
test("CROS Catalogは観測不能と作成中のLink置換で本文を書かない", async () => {
  const parent = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  for (const mode of ["unknown", "replacement"] as const) {
    const directory = await mkdtemp(
      path.join(parent, "ai-profile-root-failure-"),
    );
    const originalLstat = fs.lstatSync,
      originalMkdir = fs.mkdirSync,
      originalOpen = fs.openSync;
    try {
      const target = path.join(directory, "target");
      fs.mkdirSync(target);
      fs.writeFileSync(path.join(target, "marker.txt"), "unchanged");
      const input =
        process.platform === "win32"
          ? {
              platform: "win32" as const,
              publisher: "qual-lab",
              application: "cros" as const,
              trustDomainId: "local-test",
              localAppData: directory,
            }
          : {
              platform: "linux" as const,
              publisher: "qual-lab",
              application: "cros" as const,
              trustDomainId: "local-test",
              homeDirectory: directory,
              xdgConfigHome: directory,
              xdgStateHome: path.join(directory, "state"),
            };
      const roots = resolveCrosRuntimeRoots(input);
      assert.ok(roots);
      const adapter = createHostAiProfileCatalogStore(input);
      assert.equal(adapter.status, "ready");
      assert.ok(adapter.store);
      let writeOpens = 0,
        isFaultObserved = false;
      fs.openSync = ((
        file: fs.PathLike,
        flags: string | number,
        permissions?: fs.Mode,
      ) => {
        if (typeof flags === "string" && /[wa]/u.test(flags)) writeOpens++;
        return originalOpen(file, flags, permissions);
      }) as typeof fs.openSync;
      if (mode === "unknown") {
        Object.defineProperty(fs, "lstatSync", {
          value: ((file: fs.PathLike, options?: fs.StatOptions) => {
            if (String(file) === roots.config) {
              isFaultObserved = true;
              throw Object.assign(new Error("synthetic_lstat_unavailable"), {
                code: "EACCES",
              });
            }
            return originalLstat(file, options);
          }) as typeof fs.lstatSync,
        });
      } else {
        fs.mkdirSync = ((
          file: fs.PathLike,
          options?: fs.MakeDirectoryOptions,
        ) => {
          const result = originalMkdir(file, options);
          if (String(file) === path.join(directory, "qual-lab")) {
            isFaultObserved = true;
            fs.rmdirSync(String(file));
            fs.symlinkSync(target, String(file), "junction");
          }
          return result;
        }) as typeof fs.mkdirSync;
      }
      syncBuiltinESMExports();
      if (mode === "unknown") {
        assert.equal(createHostAiProfileCatalogStore(input).status, "blocked");
        assert.equal(adapter.store?.snapshot().status, "blocked");
      }
      assert.equal(
        adapter.store?.adopt({
          expectedRevision: 0,
          candidate: defaultAiProfileCatalog,
        })?.status,
        "unknown",
      );
      assert.equal(isFaultObserved, true);
      assert.equal(writeOpens, 0);
      assert.deepEqual(fs.readdirSync(target), ["marker.txt"]);
      assert.equal(
        fs.readFileSync(path.join(target, "marker.txt"), "utf8"),
        "unchanged",
      );
    } finally {
      Object.defineProperty(fs, "lstatSync", { value: originalLstat });
      fs.mkdirSync = originalMkdir;
      fs.openSync = originalOpen;
      syncBuiltinESMExports();
      assert.equal(path.dirname(directory), parent);
      assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
      await rm(directory, { recursive: true });
      assert.equal(fs.existsSync(directory), false);
    }
  }
});

/**
 * 初期Catalogを別Node Processで読み込み、破損時の起動停止を検証する。
 *
 * @responsibility 同梱JSONの欠落、構文不正とSchema不正を旧値へのfallbackにしないことを反証する。
 * @trace RCM-IT-005
 * @precondition 現行catalog.tsをRepository-localの独立Fixtureへ複製する。
 * @stimulus 正常、欠落、構文不正およびSchema不正のJSONで順にModuleを読み込む。
 * @observation 子Process終了、Signal、成功markerと期待する停止理由を観測する。
 * @oracle 正常だけmarkerを返し、不正三条件は非0で停止する。
 * @cleanup exactな作成済みFixtureをfinallyで削除する。
 * @boundary RCM-IT-005=Direct Boundary: bundled Catalog→Node JSON loader→Schema validator。
 */
test("同梱JSONの欠落・構文不正・Schema不正はModule起動を停止する", async () => {
  const testsRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testsRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testsRoot, "ai-profile-default-"));
  const sourceRoot = path.resolve(import.meta.dirname, "../../src/catalog");
  const jsonPath = path.join(fixture, "default-catalog.json");
  try {
    const source = await readFile(
      path.join(sourceRoot, "validation.ts"),
      "utf8",
    );
    const dependency = '"../../../domain-model/src/index.ts"';
    assert.equal(source.split(dependency).length, 2);
    await writeFile(
      path.join(fixture, "validation.ts"),
      source.replace(
        dependency,
        JSON.stringify(
          pathToFileURL(
            path.join(
              repositoryRoot,
              "40_Develop",
              "domain-model",
              "src",
              "index.ts",
            ),
          ).href,
        ),
      ),
    );
    await copyFile(
      path.join(sourceRoot, "resolve.ts"),
      path.join(fixture, "catalog.ts"),
    );
    await writeFile(path.join(fixture, "package.json"), '{"type":"module"}');
    for (const scenario of ["normal", "missing", "syntax", "schema"] as const) {
      if (scenario === "normal") {
        await copyFile(path.join(sourceRoot, "default-catalog.json"), jsonPath);
      } else if (scenario === "missing") {
        await rm(jsonPath);
      } else {
        await writeFile(
          jsonPath,
          scenario === "syntax" ? "{" : '{"contract":"invalid"}',
        );
      }
      const result = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          'import { defaultAiProfileCatalog } from "./catalog.ts"; if (defaultAiProfileCatalog.profiles.length > 0) console.log("CATALOG_LOADED");',
        ],
        {
          cwd: fixture,
          windowsHide: true,
          encoding: "utf8",
          timeout: 10_000,
          maxBuffer: 16_384,
        },
      );
      assert.equal(result.error, undefined);
      assert.equal(result.signal, null);
      if (scenario === "normal") {
        assert.equal(result.status, 0);
        assert.equal(result.stdout.trim(), "CATALOG_LOADED");
      } else {
        assert.equal(result.status, 1);
        assert.equal(result.stdout, "");
        assert.match(
          result.stderr,
          scenario === "missing"
            ? /ERR_MODULE_NOT_FOUND/u
            : scenario === "syntax"
              ? /SyntaxError/u
              : /ai_profile_default_catalog_invalid/u,
        );
      }
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * 試験Fixture内に最小Git Repositoryを作成する。
 *
 * @responsibility Repository Root Resolverが検証できる隔離済み設定Ownerを構築する。
 * @trace RCM-IT-005
 * @precondition fixtureはRepository-local `.crdd/tests`配下である。
 * @stimulus `git init`をshellなしで実行する。
 * @observation Command終了状態を観測する。
 * @oracle 非0終了を試験失敗にする。
 * @cleanup 呼出し側がfixture全体を削除する。
 * @boundary RCM-IT-005=Direct Boundary: AI Adapter Test Source→対象契約
 */
function initializeGitRepository(fixture: string): void {
  execFileSync("git", ["init", "--initial-branch=main"], {
    cwd: fixture,
    windowsHide: true,
    stdio: "ignore",
  });
}

/**
 * Repository単体とCROSが同じSchemaを別Snapshot列として保存することを検証する。
 *
 * @responsibility Ownerごとの現在値、Revisionおよび再読取りを物理分離する。
 * @trace RCM-IT-005
 * @precondition 二つの検証済みRuntime Rootを用意する。
 * @stimulus 異なるCatalog Candidateを各StoreへRevision 0から採用する。
 * @observation 採用結果、再生成StoreのSnapshotおよび競合結果を観測する。
 * @oracle 各OwnerはRevision 1の固有値を保持し、古いRevisionからの再採用を拒否する。
 * @cleanup Repository-local試験Root全体を削除する。
 * @boundary RCM-IT-005=Direct Boundary: AI Adapter Test Source→対象契約
 */
test("Repository単体とCROSは同じSchemaを別Ownerとして耐久保存する", async () => {
  const testsRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testsRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testsRoot, "ai-profile-store-"));
  const repository = path.join(fixture, "repository");
  const crosRoot = path.join(fixture, "cros-root");
  await mkdir(repository, { recursive: true });
  initializeGitRepository(repository);
  const repositoryCatalog = withCompatibilityReason("repository-owner");
  const crosCatalog = withCompatibilityReason("cros-owner");
  try {
    const repositoryAdapter = createRepositoryAiProfileCatalogStore(repository);
    assert.equal(repositoryAdapter.status, "ready");
    assert.ok(repositoryAdapter.store);
    assert.equal(repositoryAdapter.store.snapshot().value?.revision, 0);
    const repositoryAdoption = repositoryAdapter.store.adopt({
      expectedRevision: 0,
      candidate: repositoryCatalog,
    });
    assert.equal(repositoryAdoption.status, "adopted");

    const crosInput = Object.freeze({
      platform: "win32" as const,
      trustDomainId: "shared",
      publisher: "qual-lab",
      application: "cros" as const,
      localAppData: crosRoot,
    });
    const crosAdapter = createHostAiProfileCatalogStore(crosInput);
    assert.equal(crosAdapter.status, "ready");
    assert.ok(crosAdapter.store);
    const crosAdoption = crosAdapter.store.adopt({
      expectedRevision: 0,
      candidate: crosCatalog,
    });
    assert.equal(crosAdoption.status, "adopted");

    const reopenedRepository =
      createRepositoryAiProfileCatalogStore(repository);
    const reopenedCros = createHostAiProfileCatalogStore(crosInput);
    assert.equal(reopenedRepository.store?.snapshot().value?.revision, 1);
    assert.equal(
      reopenedRepository.store?.snapshot().value?.catalog.profiles[0]
        ?.compatibilityReason,
      "repository-owner",
    );
    assert.equal(reopenedCros.store?.snapshot().value?.revision, 1);
    assert.equal(
      reopenedCros.store?.snapshot().value?.catalog.profiles[0]
        ?.compatibilityReason,
      "cros-owner",
    );

    const conflict = repositoryAdapter.store.adopt({
      expectedRevision: 0,
      candidate: crosCatalog,
    });
    assert.equal(conflict.status, "rejected");
    if (conflict.status === "rejected")
      assert.equal(conflict.reason, "revision_conflict");
    assert.equal(
      repositoryAdapter.store.snapshot().value?.catalog.profiles[0]
        ?.compatibilityReason,
      "repository-owner",
    );
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * 不正CatalogをFilesystem Effect前に拒否することを検証する。
 *
 * @responsibility 秘密値等の未知PropertyをStoreへ保存しないことを反証する。
 * @trace RCM-IT-005
 * @precondition 空のRepository Catalog Storeを構成する。
 * @stimulus top-levelに未知`secret` Propertyを持つCandidateを採用する。
 * @observation 拒否理由と現在Revisionを観測する。
 * @oracle catalog_invalidかつRevision 0のままである。
 * @cleanup Repository-local試験Root全体を削除する。
 * @boundary RCM-IT-005=Direct Boundary: AI Adapter Test Source→対象契約
 */
test("不正Catalogは耐久Snapshotを作成する前に拒否する", async () => {
  const testsRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testsRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testsRoot, "ai-profile-invalid-"));
  initializeGitRepository(fixture);
  try {
    const adapter = createRepositoryAiProfileCatalogStore(fixture);
    assert.equal(adapter.status, "ready");
    assert.ok(adapter.store);
    const result = adapter.store.adopt({
      expectedRevision: 0,
      candidate: { ...defaultAiProfileCatalog, secret: "not-allowed" },
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected")
      assert.equal(result.reason, "catalog_invalid");
    assert.equal(adapter.store.snapshot().value?.revision, 0);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

/**
 * 既定Catalogの先頭ProfileだけへOwner識別用の非秘密理由を設定する。
 *
 * @responsibility 同一SchemaのOwner別値を試験で識別できるCandidateへ変換する。
 * @trace RCM-IT-005
 * @input reason: 非秘密のCompatibility説明。
 * @returns 検証可能なAI Profile Catalog候補。
 * @precondition 既定Catalogに一件以上のProfileが存在する。
 * @stimulus Owner識別用の非秘密理由を一件目へ設定する。
 * @observation 生成したCandidateのProfile集合を観測する。
 * @oracle 一件目の理由だけが変わり、Adapter定義とIdentityは維持される。
 * @cleanup N/A: 外部資源を生成しない。
 * @postcondition Adapter定義とProfile Identityを変更しない。
 * @effect N/A: 新しいPlain Dataを構築するだけである。
 * @failure N/A: 既定Catalogを固定入力とする。
 * @invariant 秘密値と実行Pathを追加しない。
 * @boundary RCM-IT-005=Direct Boundary: AI Adapter Test Source→対象契約
 */
function withCompatibilityReason(reason: string): unknown {
  return {
    ...defaultAiProfileCatalog,
    profiles: defaultAiProfileCatalog.profiles.map((profile, index) =>
      index === 0 ? { ...profile, compatibilityReason: reason } : profile,
    ),
  };
}

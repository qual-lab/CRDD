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
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/repository-location.ts";
import {
  DEFAULT_AI_PROFILE_CATALOG,
  createCrosAiProfileCatalogStore,
  createRepositoryAiProfileCatalogStore,
} from "../../src/profile/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

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
  const jsonPath = path.join(fixture, "default-ai-profile-catalog.json");
  try {
    await copyFile(
      path.join(sourceRoot, "catalog.ts"),
      path.join(fixture, "catalog.ts"),
    );
    await writeFile(path.join(fixture, "package.json"), '{"type":"module"}');
    for (const scenario of ["normal", "missing", "syntax", "schema"] as const) {
      if (scenario === "normal") {
        await copyFile(
          path.join(sourceRoot, "default-ai-profile-catalog.json"),
          jsonPath,
        );
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
          'import { DEFAULT_AI_PROFILE_CATALOG } from "./catalog.ts"; if (DEFAULT_AI_PROFILE_CATALOG.profiles.length > 0) console.log("CATALOG_LOADED");',
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
 * @boundary RCM-IT-005=Direct Boundary: ai-runtime Test Source→対象契約
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
 * @boundary RCM-IT-005=Direct Boundary: ai-runtime Test Source→対象契約
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
    assert.equal(repositoryAdapter.store.snapshot().revision, 0);
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
    const crosAdapter = createCrosAiProfileCatalogStore(crosInput);
    assert.equal(crosAdapter.status, "ready");
    assert.ok(crosAdapter.store);
    const crosAdoption = crosAdapter.store.adopt({
      expectedRevision: 0,
      candidate: crosCatalog,
    });
    assert.equal(crosAdoption.status, "adopted");

    const reopenedRepository =
      createRepositoryAiProfileCatalogStore(repository);
    const reopenedCros = createCrosAiProfileCatalogStore(crosInput);
    assert.equal(reopenedRepository.store?.snapshot().revision, 1);
    assert.equal(
      reopenedRepository.store?.snapshot().catalog.profiles[0]
        ?.compatibilityReason,
      "repository-owner",
    );
    assert.equal(reopenedCros.store?.snapshot().revision, 1);
    assert.equal(
      reopenedCros.store?.snapshot().catalog.profiles[0]?.compatibilityReason,
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
      repositoryAdapter.store.snapshot().catalog.profiles[0]
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
 * @boundary RCM-IT-005=Direct Boundary: ai-runtime Test Source→対象契約
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
      candidate: { ...DEFAULT_AI_PROFILE_CATALOG, secret: "not-allowed" },
    });
    assert.equal(result.status, "rejected");
    if (result.status === "rejected")
      assert.equal(result.reason, "catalog_invalid");
    assert.equal(adapter.store.snapshot().revision, 0);
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
 * @boundary RCM-IT-005=Direct Boundary: ai-runtime Test Source→対象契約
 */
function withCompatibilityReason(reason: string): unknown {
  return {
    ...DEFAULT_AI_PROFILE_CATALOG,
    profiles: DEFAULT_AI_PROFILE_CATALOG.profiles.map((profile, index) =>
      index === 0 ? { ...profile, compatibilityReason: reason } : profile,
    ),
  };
}

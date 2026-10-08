/**
 * runtime-data:integration:repository-pathsの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility runtime-data:integration:repository-pathsが所有する検証責務を実行する。
 * @trace RDL-IT-001
 * @level IT
 * @scope runtime-data、repository-root、path
 * @boundary RDL-IT-001=Adjacent 1 Block: Repository Root・Runtime Root→Filesystem Writer
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { ensureRepositoryRuntimeDataArea } from "../../src/storage/ensure-area.ts";
import {
  observeRepositoryRuntimeDataArea,
  resolveRepositoryRuntimeDataPaths,
} from "../../src/repository/resolve-storage-paths.ts";
import type { RepositoryRuntimeArea } from "../../src/repository/types.ts";
import {
  RepositoryRuntimeDataAreaBlockedError,
  requireReadyRepositoryRuntimeDataArea,
} from "../../src/repository/require-storage-area.ts";
import { ensureRepositoryRuntimeDataAreaWithAdapter } from "../../src/storage/ensure-area.ts";
import {
  verifyRepositoryRoot,
  verifyRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * Owner観測はRootを公開せず不存在と置換・観測障害を区別する。
 * @responsibility area単位の読み取り専用APIを直接Filesystemで反証する。
 * @trace RDL-IT-001
 * @precondition 検証済み現在Repositoryのtests領域に孤立Git fixtureを作る。
 * @stimulus 不存在、既存area、Root型不正、area置換、観測障害を与える。
 * @observation 状態、不透明Identity、実Directory内容、Ignore不存在を観測する。
 * @oracle ENOENTだけがnot_observed、異なる既存Directoryは別Identity、観測不能はblocked。
 * @cleanup exact fixture Rootを清掃し終了後不存在を確認する。
 * @boundary RDL-IT-001=Direct Boundary: Owner observer→VCS／Filesystem metadata
 */
test("Owner読取り観測は不存在・境界置換・観測不能をEffect0で区別する", (t) => {
  const current = verifyRepositoryRoot(repositoryRoot);
  if (current.status !== "completed") throw new Error("fixture_root_invalid");
  const testArea = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataArea(current.capability, "tests"),
    "fixture_area_invalid",
  );
  const root = fs.mkdtempSync(
    path.join(testArea.directory, "runtime-area-observation-"),
  );
  t.after(() => {
    assert.equal(path.dirname(root), testArea.directory);
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  });
  fs.mkdirSync(path.join(root, ".git", "info"), { recursive: true });
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\n");
  fs.writeFileSync(
    path.join(root, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const verified = verifyRepositoryRoot(root);
  if (verified.status !== "completed") throw new Error("fixture_invalid");
  const initialEntries = fs.readdirSync(root);
  assert.deepEqual(
    observeRepositoryRuntimeDataArea(
      verified.capability,
      "execution-intelligence",
    ),
    {
      status: "not_observed",
      reason: "repository_runtime_data_area_absent",
      effectIssued: false,
    },
  );
  assert.deepEqual(fs.readdirSync(root), initialEntries);
  assert.equal(
    fs.existsSync(path.join(root, ".git", "info", "exclude")),
    false,
  );
  assert.equal(
    observeRepositoryRuntimeDataArea(
      { ...verified.capability },
      "execution-intelligence",
    ).status,
    "blocked",
  );
  const runtimeRoot = path.join(root, ".crdd");
  fs.mkdirSync(runtimeRoot);
  assert.equal(
    observeRepositoryRuntimeDataArea(
      verified.capability,
      "execution-intelligence",
    ).status,
    "not_observed",
  );
  const paths = resolveRepositoryRuntimeDataPaths(verified.capability);
  if (!paths) throw new Error("paths_invalid");
  const area = paths.executionIntelligence;
  fs.mkdirSync(area);
  const first = observeRepositoryRuntimeDataArea(
    verified.capability,
    "execution-intelligence",
  );
  assert.equal(first.status, "ready");
  if (first.status !== "ready") throw new Error("first_invalid");
  assert.equal(first.effectIssued, false);
  assert.equal(first.directory, area);
  assert.equal(Object.hasOwn(first, "root"), false);
  assert.match(first.boundaryIdentity, /^[0-9a-f]{64}$/u);
  const runtimePrior = path.join(root, "runtime-prior");
  fs.renameSync(runtimeRoot, runtimePrior);
  fs.writeFileSync(runtimeRoot, "not-a-directory");
  const invalid = observeRepositoryRuntimeDataArea(
    verified.capability,
    "execution-intelligence",
  );
  assert.equal(invalid.status, "blocked");
  if (invalid.status === "blocked")
    assert.equal(
      invalid.reason,
      "repository_runtime_data_area_boundary_invalid",
    );
  fs.unlinkSync(runtimeRoot);
  fs.renameSync(runtimePrior, runtimeRoot);
  const prior = path.join(root, "area-prior");
  fs.renameSync(area, prior);
  fs.mkdirSync(area);
  const replaced = observeRepositoryRuntimeDataArea(
    verified.capability,
    "execution-intelligence",
  );
  assert.equal(replaced.status, "ready");
  if (replaced.status === "ready")
    assert.notEqual(replaced.boundaryIdentity, first.boundaryIdentity);
  const original = fs.lstatSync;
  Reflect.set(fs, "lstatSync", ((target: fs.PathLike, ...args: unknown[]) => {
    if (path.resolve(String(target)) === path.resolve(area))
      throw Object.assign(new Error("unobservable"), { code: "EACCES" });
    return Reflect.apply(original, fs, [target, ...args]);
  }) as typeof fs.lstatSync);
  try {
    const unknown = observeRepositoryRuntimeDataArea(
      verified.capability,
      "execution-intelligence",
    );
    assert.equal(unknown.status, "blocked");
    if (unknown.status === "blocked")
      assert.equal(
        unknown.reason,
        "repository_runtime_data_area_observation_failed",
      );
  } finally {
    Reflect.set(fs, "lstatSync", original);
  }
  assert.equal(
    fs.existsSync(path.join(root, ".git", "info", "exclude")),
    false,
  );
});

/**
 * 検証済みRepository Rootだけから全Repository-local Pathを解決する。
 * @responsibility Root能力から名前付きPathへの搬送を検証する。
 * @trace RDL-IT-001
 * @precondition 現在のRepositoryの検証済みRootを使用する。
 * @stimulus 公開Path resolverへ同じRoot能力を渡す。
 * @observation 名前付きPathとRoot一致を観測する。
 * @oracle 全Pathが宣言済みRepository内の領域へ一致する。
 * @cleanup N/A: 読取り確認のみで新しい資源を作成しない。
 * @boundary RDL-IT-001=Direct Boundary: Root能力→名前付きPath
 */
test("検証済みRepository Rootだけから全Repository-local Pathを解決する", () => {
  const verification = verifyRepositoryRoot(repositoryRoot);
  assert.equal(verification.status, "completed");
  if (verification.status !== "completed") return;
  const paths = resolveRepositoryRuntimeDataPaths(verification.capability);
  assert.equal(Object.hasOwn(paths ?? {}, "root"), false);
  assert.equal(
    path.dirname(paths?.config ?? ""),
    path.join(repositoryRoot, ".crdd"),
  );
  assert.equal(
    paths?.externalSendPolicy,
    path.join(repositoryRoot, ".crdd", "config", "external-send-policy.json"),
  );
  assert.deepEqual(paths?.allowedTopLevelAreas, [
    "config",
    "orchestrator",
    "coordinator",
    "execution-intelligence",
    "candidates",
    "release",
    "communication",
    "tests",
    "tmp",
  ]);
  assert.equal(
    paths?.coordinator,
    path.join(repositoryRoot, ".crdd", "coordinator"),
  );
});

/**
 * Consumerはraw Rootではなく名前付き領域だけを作成・検証するを検証する。
 *
 * @responsibility Consumerはraw Rootではなく名前付き領域だけを作成・検証するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Consumerはraw Rootではなく名前付き領域だけを作成・検証するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Consumerはraw Rootではなく名前付き領域だけを作成・検証する", (t) => {
  const isolatedRepository = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-data-area-"),
  );
  t.after(() =>
    fs.rmSync(isolatedRepository, { recursive: true, force: true }),
  );
  fs.mkdirSync(path.join(isolatedRepository, ".git", "info"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(isolatedRepository, ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  fs.writeFileSync(
    path.join(isolatedRepository, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const verification = verifyRepositoryRoot(isolatedRepository);
  assert.equal(verification.status, "completed");
  if (verification.status !== "completed") return;
  const area = ensureRepositoryRuntimeDataArea(
    verification.capability,
    "tests",
  );
  assert.deepEqual(area, {
    status: "ready",
    repositoryRoot: isolatedRepository,
    directory: path.join(isolatedRepository, ".crdd", "tests"),
  });
  assert.equal(
    fs.readFileSync(
      path.join(isolatedRepository, ".git", "info", "exclude"),
      "utf8",
    ),
    ".crdd/\n",
  );
});

/**
 * IgnoreのEffect不明をnullへ畳まずRuntime Data領域を作らないを検証する。
 *
 * @responsibility IgnoreのEffect不明をnullへ畳まずRuntime Data領域を作らないの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus IgnoreのEffect不明をnullへ畳まずRuntime Data領域を作らないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
 */
test("IgnoreのEffect不明をnullへ畳まずRuntime Data領域を作らない", (t) => {
  const isolatedRepository = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-data-ignore-unknown-"),
  );
  t.after(() =>
    fs.rmSync(isolatedRepository, { recursive: true, force: true }),
  );
  fs.mkdirSync(path.join(isolatedRepository, ".git", "info"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(isolatedRepository, ".git", "HEAD"),
    "ref: refs/heads/main\n",
  );
  fs.writeFileSync(
    path.join(isolatedRepository, ".git", "config"),
    "[core]\n\trepositoryformatversion = 0\n\tbare = false\n",
  );
  const verification = verifyRepositoryRoot(isolatedRepository);
  assert.equal(verification.status, "completed");
  if (verification.status !== "completed") return;
  const result = ensureRepositoryRuntimeDataAreaWithAdapter(
    verification.capability,
    "tests",
    () =>
      Object.freeze({
        status: "blocked" as const,
        reason: "repository_local_ignore_update_blocked" as const,
        effectIssued: true,
        effectConfirmation: "unknown" as const,
        cleanupConfirmed: true,
      }),
  );
  assert.equal(result?.status, "blocked");
  if (result?.status !== "blocked") return;
  assert.equal(result.effectStateUnknown, true);
  assert.equal(result.retryAllowed, false);
  assert.match(result.recoveryReference ?? "", /^repository-local-ignore\./u);
  assert.equal(fs.existsSync(path.join(isolatedRepository, ".crdd")), false);
  assert.throws(
    () =>
      requireReadyRepositoryRuntimeDataArea(
        result,
        "runtime_data_area_invalid",
      ),
    (error) => {
      assert.ok(error instanceof RepositoryRuntimeDataAreaBlockedError);
      assert.equal(error.effectStateUnknown, true);
      assert.equal(error.cleanupConfirmed, true);
      assert.equal(error.retryAllowed, false);
      assert.equal(error.recoveryReference, result.recoveryReference);
      return true;
    },
  );
});

/**
 * Repositoryの子DirectoryはRoot Capabilityとして拒否するを検証する。
 *
 * @responsibility Repositoryの子DirectoryはRoot Capabilityとして拒否するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repositoryの子DirectoryはRoot Capabilityとして拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
 */
test("Repositoryの子DirectoryはRoot Capabilityとして拒否する", () => {
  assert.deepEqual(verifyRepositoryRoot(import.meta.dirname), {
    status: "blocked",
    reason: "repository_root_invalid",
    capability: null,
  });
});

/**
 * 任意Directoryと非公開のraw Root入口からPath能力を取得できないを検証する。
 *
 * @responsibility 任意Directoryと非公開のraw Root入口からPath能力を取得できないの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 任意Directoryと非公開のraw Root入口からPath能力を取得できないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
 */
test("任意Directoryと非公開のraw Root入口からPath能力を取得できない", async (t) => {
  const arbitrary = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-root-"),
  );
  t.after(() => fs.rmSync(arbitrary, { recursive: true, force: true }));
  assert.equal(verifyRepositoryRoot(arbitrary).status, "blocked");
  const publicApi = await import("../../src/index.ts");
  assert.equal(
    "resolveRepositoryRuntimeDataPathsFromValidatedRoot" in publicApi,
    false,
  );
  assert.equal(
    "resolveBundledRepositoryRuntimeDataPathsForProtectedSigning" in publicApi,
    false,
  );
  assert.equal(
    "resolveRepositoryRuntimeDataPathsForInternalUse" in publicApi,
    false,
  );
});

/**
 * junction経由のWorking DirectoryはRepository Rootへ正規化せず拒否するを検証する。
 *
 * @responsibility junction経由のWorking DirectoryはRepository Rootへ正規化せず拒否するの合否判定を所有する。
 * @trace RDL-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus junction経由のWorking DirectoryはRepository Rootへ正規化せず拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RDL-IT-001=Direct Boundary: runtime-data Test Source→対象契約
 */
test("junction経由のWorking DirectoryはRepository Rootへ正規化せず拒否する", () => {
  const boundaryRoot = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "runtime-data-root-boundary",
  );
  const alias = path.join(boundaryRoot, "repository-alias");
  fs.mkdirSync(boundaryRoot, { recursive: true });
  try {
    fs.symlinkSync(repositoryRoot, alias, "junction");
    assert.deepEqual(
      verifyRepositoryRootFromWorkingDirectory(
        path.join(alias, "40_Develop", "domain-model"),
      ),
      {
        status: "blocked",
        reason: "repository_root_invalid",
        capability: null,
      },
    );
  } finally {
    if (fs.existsSync(alias)) fs.unlinkSync(alias);
    fs.rmSync(boundaryRoot, { recursive: true });
  }
});

/**
 * 廃止verification Areaはaliasや新規作成へ変換せずEffect前に拒否する。
 *
 * @responsibility 許可Area集合の除去と読取り／作成の拒否を確認する。
 * @trace RDL-IT-001
 * @precondition 現在RepositoryのRootを検証できる。
 * @stimulus 廃止Area名を不正入力としてOwnerのensure／observeへ渡す。
 * @observation 返却状態、EffectとRuntime Rootのentryを取得する。
 * @oracle projectionにverificationなし、ensureは既存拒否null、observeはblocked、entry不変。
 * @cleanup N/A: 不正AreaへFilesystem変更を発行しない。
 * @boundary RDL-IT-001=Direct Boundary: 廃止Area要求→Owner拒否
 */
test("廃止verification Areaに新規Effectや互換aliasを発行しない", () => {
  const root = verifyRepositoryRoot(repositoryRoot);
  if (root.status !== "completed") throw new Error("fixture_root_invalid");
  const paths = resolveRepositoryRuntimeDataPaths(root.capability);
  assert.ok(paths);
  assert.equal(Object.hasOwn(paths, "verification"), false);
  const previousEntries = fs.readdirSync(path.dirname(paths.tests));
  const area = "verification" as unknown as RepositoryRuntimeArea;
  const ensured = ensureRepositoryRuntimeDataArea(root.capability, area);
  assert.equal(ensured, null);
  const observed = observeRepositoryRuntimeDataArea(root.capability, area);
  assert.equal(observed.status, "blocked");
  assert.equal(observed.effectIssued, false);
  assert.deepEqual(fs.readdirSync(path.dirname(paths.tests)), previousEntries);
});

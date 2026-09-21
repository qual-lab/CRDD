/**
 * coordinator:integration:repository-root-resolutionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:repository-root-resolutionが所有する検証責務を実行する。
 * @trace RFD-IT-001
 * @level IT
 * @scope repository、root、resolution
 * @boundary Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  describeRepositoryLocationContract,
  REPOSITORY_LOCATION_CONTRACT,
  REPOSITORY_LOCATION_CONTRACT_REVISION,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "../../../version-control/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * repository root resolution binds a package working directory to the project rootを検証する。
 *
 * @responsibility repository root resolution binds a package working directory to the project rootの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus repository root resolution binds a package working directory to the project rootの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("repository root resolution binds a package working directory to the project root", () => {
  assert.equal(
    resolveVerifiedRepositoryRootFromWorkingDirectory(import.meta.dirname),
    fs.realpathSync.native(repositoryRoot),
  );
  assert.equal(
    resolveVerifiedRepositoryRootFromWorkingDirectory(repositoryRoot),
    fs.realpathSync.native(repositoryRoot),
  );
});

/**
 * repository root resolution does not walk past an invalid nested Git boundaryを検証する。
 *
 * @responsibility repository root resolution does not walk past an invalid nested Git boundaryの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus repository root resolution does not walk past an invalid nested Git boundaryの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("repository root resolution does not walk past an invalid nested Git boundary", (t) => {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-root-boundary-"));
  const nested = path.join(outer, "nested", "package");
  fs.mkdirSync(nested, { recursive: true });
  fs.writeFileSync(path.join(outer, ".git"), "invalid\n", "utf8");
  t.after(() => fs.rmSync(outer, { recursive: true, force: true }));

  assert.throws(
    () => resolveVerifiedRepositoryRootFromWorkingDirectory(nested),
    /repository_boundary_invalid/u,
  );
});

/**
 * repository root resolution fails closed when no Git boundary existsを検証する。
 *
 * @responsibility repository root resolution fails closed when no Git boundary existsの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus repository root resolution fails closed when no Git boundary existsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("repository root resolution fails closed when no Git boundary exists", () => {
  // A temporary directory inside this checkout inherits its Git boundary.
  // Inspect the volume root without creating files outside the repository.
  const target = path.parse(fs.realpathSync.native(repositoryRoot)).root;
  assert.equal(
    fs.existsSync(path.join(target, ".git")),
    false,
    "This integration case requires a volume root without a Git boundary",
  );
  assert.throws(
    () => resolveVerifiedRepositoryRootFromWorkingDirectory(target),
    /verified_repository_root_required/u,
  );
});

/**
 * repository root resolution contract exposes no pathを検証する。
 *
 * @responsibility repository root resolution contract exposes no pathの合否判定を所有する。
 * @trace RFD-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus repository root resolution contract exposes no pathの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: 開始Path→Version Control Adapter→Repository Manifest
 */
test("repository root resolution contract exposes no path", () => {
  const contract = describeRepositoryLocationContract();
  assert.equal(contract.contract, REPOSITORY_LOCATION_CONTRACT);
  assert.equal(
    contract.contractRevision,
    REPOSITORY_LOCATION_CONTRACT_REVISION,
  );
  assert.equal(contract.workingDirectoryIsRepositoryAuthority, false);
  assert.equal(contract.invalidNestedBoundaryTraversalAllowed, false);
  assert.equal(contract.pathReported, false);
  assert.equal(JSON.stringify(contract).includes(repositoryRoot), false);
});

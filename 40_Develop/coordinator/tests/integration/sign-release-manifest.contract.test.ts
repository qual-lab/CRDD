/**
 * coordinator:integration:sign-release-manifestの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:sign-release-manifestが所有する検証責務を実行する。
 * @trace AIT-IT-008
 * @trace AIT-IT-009
 * @level IT
 * @scope sign、release、manifest
 * @boundary AIT-IT-008=Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果 / AIT-IT-009=Adjacent 1 Block: Signer結果→Coordinator配置契約
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { mock } from "node:test";
import { pathToFileURL } from "node:url";

import {
  beginReleaseStagingManifestSession,
  describeReleaseStagingManifestContract,
  placeReleaseStagingManifestCandidate,
  ReleaseStagingManifestError,
} from "../../scripts/release-staging-manifest.ts";
import {
  signReleaseManifest as consumeReleaseManifestPreflightAuthorization,
  preflightReleaseManifest,
  readReleasePrivateKeyPathFromEnvironmentFile,
  resolveReleasePrivateKeyPath,
} from "../../scripts/sign-release-manifest.ts";
import {
  diagnoseRuntimeDistributionFilesystemForVerification,
  inspectFixedDevelopmentCoordinatorPackageCandidate,
  inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate,
  verifyInstalledCoordinatorPackageCandidate,
} from "../../src/platform-access/platform-provisioner-package-filesystem.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../../src/diagnostics/provisioning-signature-primitives.ts";
import { validateArtifactSignatureResult } from "../../../artifact-signing/src/index.ts";
import { createFixedRuntimeSigningFixture } from "../fixtures/fixed-runtime-signing-fixture.ts";

const TEST_PASSPHRASE = "test-only-release-signing-passphrase";
const coordinatorRoot = path.resolve(import.meta.dirname, "../..");
const repositoryRoot = path.resolve(coordinatorRoot, "../..");
const releaseStagingRoot = path.join(repositoryRoot, ".crdd", "tmp");

/**
 * Signer結果が配置責務を含まない閉じた値契約であることを検証する。
 *
 * @responsibility Artifact SigningとCoordinatorの責務境界を余剰field反例で確認する。
 * @trace AIT-IT-009
 * @precondition 正常な署名結果とManifest Path、配置、公開fieldを混入した反例を用意する。
 * @stimulus 各値をArtifact Signature Result Schemaへ入力する。
 * @observation 受理したfield集合と拒否結果を観測する。
 * @oracle 三つの署名fieldだけを受理し、意味固有fieldを一つでも含む値を拒否する。
 * @cleanup N/A: 外部Effectまたは永続資源を作成しない。
 * @boundary AIT-IT-009=Direct Boundary: coordinator Test Source→対象契約
 */
test("Signer結果はManifest生成・配置・公開fieldを所有しない", () => {
  const valid = {
    algorithm: "Ed25519",
    keyId: "a".repeat(64),
    signature: "A".repeat(86),
  } as const;
  assert.deepEqual(validateArtifactSignatureResult(valid), valid);
  for (const forbidden of [
    { manifestRelativePath: "manifest.json" },
    { placementStatus: "created" },
    { published: false },
  ]) {
    assert.throws(
      () => validateArtifactSignatureResult({ ...valid, ...forbidden }),
      /artifact_signing_signature_result_invalid/u,
    );
  }
});

type ContractTestManifestOptions = Parameters<
  typeof preflightReleaseManifest
>[0] &
  Readonly<{ passphrase: string }>;

/**
 * signReleaseManifestのTest準備責務を実行する。
 *
 * @responsibility signReleaseManifestがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus signReleaseManifestを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
function signReleaseManifest(options: ContractTestManifestOptions) {
  const { passphrase, ...preflightOptions } = options;
  const preflight = preflightReleaseManifest(preflightOptions);
  return consumeReleaseManifestPreflightAuthorization(
    preflight.authorization,
    passphrase,
  );
}

/**
 * 署名鍵PathだけをGit管理外envから一意に解決するを検証する。
 *
 * @responsibility 署名鍵PathだけをGit管理外envから一意に解決するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名鍵PathだけをGit管理外envから一意に解決するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名鍵PathだけをGit管理外envから一意に解決する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-signing-env-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const keyPath = path.join(root, "release-private.pem");
  const environmentPath = path.join(root, ".env");
  fs.writeFileSync(keyPath, "path-resolution-fixture", "utf8");
  fs.writeFileSync(
    environmentPath,
    `UNRELATED=value\nCRDD_RELEASE_PRIVATE_KEY_PATH="${keyPath}"\n`,
    "utf8",
  );
  assert.equal(
    readReleasePrivateKeyPathFromEnvironmentFile(environmentPath),
    keyPath,
  );

  fs.writeFileSync(
    environmentPath,
    `CRDD_RELEASE_PRIVATE_KEY_PATH=${keyPath}\nCRDD_RELEASE_PRIVATE_KEY_PATH=${keyPath}\n`,
    "utf8",
  );
  assert.throws(
    () => readReleasePrivateKeyPathFromEnvironmentFile(environmentPath),
    /release_manifest_private_key_environment_invalid/u,
  );

  fs.writeFileSync(
    environmentPath,
    "CRDD_RELEASE_PRIVATE_KEY_PATH=relative-key.pem\n",
    "utf8",
  );
  assert.throws(
    () => readReleasePrivateKeyPathFromEnvironmentFile(environmentPath),
    /release_manifest_private_key_environment_invalid/u,
  );

  fs.writeFileSync(
    environmentPath,
    `${`CRDD_RELEASE_PRIVATE_KEY_PATH=${path.join(root, "missing.pem")}`}\n`,
    "utf8",
  );
  assert.equal(
    readReleasePrivateKeyPathFromEnvironmentFile(environmentPath),
    path.join(root, "missing.pem"),
  );
});

/**
 * 明示した鍵Pathはenvを読まず、両入口とも後続の共通preflightへ渡すを検証する。
 *
 * @responsibility 明示した鍵Pathはenvを読まず、両入口とも後続の共通preflightへ渡すの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 明示した鍵Pathはenvを読まず、両入口とも後続の共通preflightへ渡すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("明示した鍵Pathはenvを読まず、両入口とも後続の共通preflightへ渡す", () => {
  const explicit = path.resolve("external-release-private.pem");
  assert.equal(
    resolveReleasePrivateKeyPath(explicit, path.resolve("missing-.env-crdd")),
    explicit,
  );
  assert.throws(
    () =>
      resolveReleasePrivateKeyPath(
        undefined,
        path.resolve("missing-.env-crdd"),
      ),
    /release_manifest_private_key_environment_invalid/u,
  );
});

/**
 * 期限なしは明示指定だけを受け、CLIの排他違反とundefinedを秘密入力前に拒否するを検証する。
 *
 * @responsibility 期限なしは明示指定だけを受け、CLIの排他違反とundefinedを秘密入力前に拒否するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 期限なしは明示指定だけを受け、CLIの排他違反とundefinedを秘密入力前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("期限なしは明示指定だけを受け、CLIの排他違反とundefinedを秘密入力前に拒否する", () => {
  const options = {
    distributionRoot: repositoryRoot,
    privateKeyPath: path.join(
      repositoryRoot,
      ".crdd",
      "test-key-never-read.pem",
    ),
    passphrase: "test-only-never-read",
    crddVersion: "v0.18.0",
    releaseSequence: 1,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    issuedAt: "2026-09-01T00:00:00.000Z",
    expiresAt: null,
  };
  const { passphrase: omittedPassphrase, ...preflightOnlyOptions } = options;
  let accessorReadCount = 0;
  const accessorOptions = { ...preflightOnlyOptions };
  Object.defineProperty(accessorOptions, "expiresAt", {
    enumerable: true,
    configurable: true,
    get() {
      accessorReadCount += 1;
      return null;
    },
  });
  assert.throws(
    () => preflightReleaseManifest(accessorOptions),
    /release_manifest_options_invalid/u,
  );
  assert.equal(accessorReadCount, 0);
  assert.throws(
    () => preflightReleaseManifest(new Proxy(preflightOnlyOptions, {})),
    /release_manifest_options_invalid/u,
  );
  assert.throws(
    () =>
      preflightReleaseManifest({
        ...preflightOnlyOptions,
        unrecognizedOption: "must-not-be-ignored",
      } as never),
    /release_manifest_options_invalid/u,
  );
  for (const [operation, input] of [
    [signReleaseManifest, options],
    [preflightReleaseManifest, preflightOnlyOptions],
  ] as const) {
    assert.throws(
      () => Reflect.apply(operation, undefined, [input]),
      /release_manifest_distribution_root_invalid/u,
    );
    assert.throws(
      () =>
        Reflect.apply(operation, undefined, [
          { ...input, expiresAt: undefined },
        ]),
      /release_manifest_time_invalid/u,
    );
    const missing = { ...input };
    Reflect.deleteProperty(missing, "expiresAt");
    assert.throws(
      () => Reflect.apply(operation, undefined, [missing]),
      /release_manifest_options_invalid/u,
    );
  }
  const args = [
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "--distribution-root",
    options.distributionRoot,
    "--private-key",
    options.privateKeyPath,
    "--crdd-version",
    options.crddVersion,
    "--release-sequence",
    "1",
    "--crdd-commit",
    options.crddCommit,
    "--crdd-tree",
    options.crddTree,
    "--issued-at",
    options.issuedAt,
  ];
  for (const [expiryArguments, reason] of [
    [["--no-expiry"], "release_manifest_distribution_root_invalid"],
    [
      ["--expires-at", "2027-09-01T00:00:00.000Z"],
      "release_manifest_distribution_root_invalid",
    ],
    [[], "release_manifest_arguments_invalid"],
    [["--no-expiry", "--no-expiry"], "release_manifest_arguments_invalid"],
    [
      ["--no-expiry", "--expires-at", "2027-09-01T00:00:00.000Z"],
      "release_manifest_arguments_invalid",
    ],
    [["--expires-at", "null"], "release_manifest_time_invalid"],
    [["--no-expiry", "true"], "release_manifest_arguments_invalid"],
  ] as const) {
    const result = spawnSync(process.execPath, [...args, ...expiryArguments], {
      encoding: "utf8",
      input: "test-only-not-a-release-secret\n",
      shell: false,
      windowsHide: true,
      timeout: 5_000,
    });
    assert.equal(result.status, 1);
    assert.equal(result.error, undefined);
    assert.equal(result.stdout, "");
    assert.equal(result.stderr, `${reason}\n`);
  }
  assert.equal(fs.existsSync(options.privateKeyPath), false);
});

/**
 * uniqueReleaseCandidateのTest準備責務を実行する。
 *
 * @responsibility uniqueReleaseCandidateがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus uniqueReleaseCandidateを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
function uniqueReleaseCandidate(prefix: string, fixedSignature = false) {
  fs.mkdirSync(releaseStagingRoot, { recursive: true });
  const value = path.join(
    releaseStagingRoot,
    fixedSignature
      ? "signature"
      : `${prefix}-${randomBytes(8).toString("hex")}`,
  );
  fs.mkdirSync(value);
  const work = path.join(value, "work");
  fs.mkdirSync(work);
  /**
   * 試験が終了した後に自己生成した操作Directoryだけを回収する。
   *
   * @responsibility 個別fixtureのwork回収と親Directory回収を別々に確認する。
   * @trace AIT-IT-008
   * @precondition このhelperがvalueとworkを作成し、試験側がworkを清掃する。
   * @stimulus 試験終了hookからworkの不存在を確認し、空のvalueを削除する。
   * @observation workとvalueの存在状態、および非再帰Directory削除の結果。
   * @oracle workが存在しない場合だけvalueを削除し、削除後もvalueが存在しない。
   * @cleanup 自己生成した空の親Directoryだけを回収し、隣接fixtureを触らない。
   * @boundary Repository-local tmp内の試験Directory。実署名・Runtime起動は行わない。
   */
  test.after(() => {
    assert.equal(fs.existsSync(work), false);
    fs.rmdirSync(value);
    assert.equal(fs.existsSync(value), false);
  });
  return work;
}

/**
 * runtimeDistributionFixtureのTest準備責務を実行する。
 *
 * @responsibility runtimeDistributionFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus runtimeDistributionFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
function runtimeDistributionFixture(prefix: string) {
  const distributionRoot = uniqueReleaseCandidate(prefix);
  for (const component of [
    "ai-runtime",
    "artifact-signing",
    "coordinator",
    "cros",
    "mcp",
    "project-operation",
    "project-runtime",
    "execution-intelligence",
    "runtime-data",
    "version-control",
  ] as const) {
    fs.cpSync(
      path.join(repositoryRoot, "40_Develop", component),
      path.join(distributionRoot, "40_Develop", component),
      {
        recursive: true,
        filter: (entry) => {
          assert.equal(fs.lstatSync(entry).isSymbolicLink(), false);
          const name = path.basename(entry);
          return name !== "node_modules" && name !== "tests";
        },
      },
    );
  }
  fs.mkdirSync(path.join(distributionRoot, "template", "tools"), {
    recursive: true,
  });
  for (const launcher of ["crdd-coordinator.ts", "crdd-mcp.ts"] as const) {
    fs.copyFileSync(
      path.join(repositoryRoot, "template", "tools", launcher),
      path.join(distributionRoot, "template", "tools", launcher),
    );
  }
  const nativeTarget = path.join(
    distributionRoot,
    "template",
    "tools",
    "coordinator",
    "windows-x64",
    "crdd-platform-access.exe",
  );
  fs.mkdirSync(path.dirname(nativeTarget), { recursive: true });
  fs.copyFileSync(
    path.join(
      repositoryRoot,
      "template",
      "tools",
      "coordinator",
      "windows-x64",
      "crdd-platform-access.exe",
    ),
    nativeTarget,
  );
  return distributionRoot;
}

/**
 * production署名sourceはTrust差替え、検証skipまたはtest hookを持たないを検証する。
 *
 * @responsibility production署名sourceはTrust差替え、検証skipまたはtest hookを持たないの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus production署名sourceはTrust差替え、検証skipまたはtest hookを持たないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("production署名sourceはTrust差替え、検証skipまたはtest hookを持たない", () => {
  const forbiddenNames = [
    "ContractTestTrust",
    "signReleaseManifestForContractTest",
    "skipCommitTreeBinding",
    "skipReleaseIdentityBinding",
    "beforeSignature",
    "afterManifestWrite",
    "expectedSignerSpkiDer",
  ];
  const forbiddenPatterns = [
    /ContractTest/u,
    /ForContractTest/u,
    /skip[A-Z][A-Za-z]+(?:Binding|Validation)/u,
    /(?:before|after)[A-Z][A-Za-z]+(?:Hook|Write|Signature)/u,
  ];
  for (const relativeRoot of ["scripts", "src", "bin"] as const) {
    const files = fs.readdirSync(path.join(coordinatorRoot, relativeRoot), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const source = fs.readFileSync(
        path.join(entry.parentPath, entry.name),
        "utf8",
      );
      for (const identifier of forbiddenNames) {
        assert.equal(
          source.includes(identifier),
          false,
          `${relativeRoot}/${entry.name}: ${identifier}`,
        );
      }
      for (const pattern of forbiddenPatterns) {
        assert.equal(
          pattern.test(source),
          false,
          `${relativeRoot}/${entry.name}: ${pattern.source}`,
        );
      }
    }
  }

  const stagingImporters: string[] = [];
  for (const relativeRoot of ["scripts", "src", "bin"] as const) {
    const files = fs.readdirSync(path.join(coordinatorRoot, relativeRoot), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of files) {
      if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
      const source = fs.readFileSync(
        path.join(entry.parentPath, entry.name),
        "utf8",
      );
      if (source.includes('from "./release-staging-manifest.ts"')) {
        stagingImporters.push(
          path
            .relative(coordinatorRoot, path.join(entry.parentPath, entry.name))
            .replaceAll("\\", "/"),
        );
      }
    }
  }
  assert.deepEqual(stagingImporters.sort(), [
    "scripts/sign-release-manifest.ts",
  ]);

  const signerSource = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "utf8",
  );
  assert.equal(signerSource.includes('from "node:child_process"'), false);
  assert.equal(
    /(?:execFile|spawn)Sync\(\s*["']git["']/u.test(signerSource),
    false,
  );
  assert.match(signerSource, /inspectRepositoryFixedSnapshot/u);
  assert.match(
    signerSource,
    /inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate\(\s*distributionRoot,\s*options\.crddVersion === "v0\.21\.0" \? "v0\.21" : "current",?\s*\)/u,
  );
  assert.equal(
    signerSource.includes(
      "inspectPlatformProvisionerPackageFilesystemCandidate",
    ),
    false,
  );
});

/**
 * SHA-256 CRDD Release Identityはpassphrase利用とFilesystem観測より前に明示拒否するを検証する。
 *
 * @responsibility SHA-256 CRDD Release Identityはpassphrase利用とFilesystem観測より前に明示拒否するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus SHA-256 CRDD Release Identityはpassphrase利用とFilesystem観測より前に明示拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("SHA-256 CRDD Release Identityはpassphrase利用とFilesystem観測より前に明示拒否する", () => {
  assert.throws(
    () =>
      signReleaseManifest({
        distributionRoot: "fixture-distribution-root-not-read",
        privateKeyPath: "fixture-private-key-not-read",
        passphrase: "fixture-passphrase-not-read",
        crddVersion: "v0.18.0",
        releaseSequence: 1,
        crddCommit: "a".repeat(64),
        crddTree: "b".repeat(64),
        issuedAt: "2026-08-25T00:00:00.000Z",
        expiresAt: "2027-08-25T00:00:00.000Z",
      }),
    /release_manifest_git_object_format_unsupported/u,
  );

  const cli = spawnSync(
    process.execPath,
    [
      path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
      "--distribution-root",
      "fixture-distribution-root-not-read",
      "--private-key",
      "fixture-private-key-not-read",
      "--crdd-version",
      "v0.18.0",
      "--release-sequence",
      "1",
      "--crdd-commit",
      "a".repeat(64),
      "--crdd-tree",
      "b".repeat(64),
      "--issued-at",
      "2026-08-25T00:00:00.000Z",
      "--expires-at",
      "2027-08-25T00:00:00.000Z",
    ],
    {
      encoding: "utf8",
      input: "",
      shell: false,
      timeout: 2_000,
      windowsHide: true,
    },
  );
  assert.equal(cli.status, 1);
  assert.equal(cli.stdout, "");
  assert.equal(cli.stderr, "release_manifest_git_object_format_unsupported\n");
});

/**
 * Release公開引数はpassphrase入力とFilesystem観測より前に完全検証するを検証する。
 *
 * @responsibility Release公開引数はpassphrase入力とFilesystem観測より前に完全検証するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Release公開引数はpassphrase入力とFilesystem観測より前に完全検証するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("Release公開引数はpassphrase入力とFilesystem観測より前に完全検証する", () => {
  const base = {
    distributionRoot: path.resolve("fixture-distribution-root-not-read"),
    privateKeyPath: path.resolve("fixture-private-key-not-read"),
    passphrase: "fixture-passphrase-not-read",
    crddVersion: "v0.18.0",
    releaseSequence: 1,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    issuedAt: "2026-08-26T02:39:49.000Z",
    expiresAt: "2026-08-27T02:39:49.000Z",
  };
  for (const [override, reason] of [
    [
      { distributionRoot: "fixture-distribution-root-not-read" },
      "release_manifest_distribution_root_invalid",
    ],
    [
      { privateKeyPath: "fixture-private-key-not-read" },
      "release_manifest_private_key_path_invalid",
    ],
    [{ releaseSequence: 0 }, "release_manifest_release_sequence_invalid"],
    [{ crddVersion: "0.18.0" }, "release_manifest_crdd_version_invalid"],
    [{ issuedAt: "2026-08-26T02:39:49Z" }, "release_manifest_time_invalid"],
    [{ issuedAt: "2026-08-26T02:39:49.00Z" }, "release_manifest_time_invalid"],
    [
      { issuedAt: "2026-08-26T02:39:49.000+00:00" },
      "release_manifest_time_invalid",
    ],
    [{ issuedAt: "2026-02-30T00:00:00.000Z" }, "release_manifest_time_invalid"],
    [
      { expiresAt: "2026-08-26T02:39:49.000Z" },
      "release_manifest_validity_window_invalid",
    ],
    [
      { expiresAt: "2026-08-26T02:39:48.999Z" },
      "release_manifest_validity_window_invalid",
    ],
  ] as const) {
    assert.throws(
      () => signReleaseManifest({ ...base, ...override }),
      (error: unknown) => error instanceof Error && error.message === reason,
    );
  }

  const cli = spawnSync(
    process.execPath,
    [
      path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
      "--distribution-root",
      path.resolve("fixture-distribution-root-not-read"),
      "--private-key",
      path.resolve("fixture-private-key-not-read"),
      "--crdd-version",
      "v0.18.0",
      "--release-sequence",
      "1",
      "--crdd-commit",
      "a".repeat(40),
      "--crdd-tree",
      "b".repeat(40),
      "--issued-at",
      "2026-08-26T02:39:49Z",
      "--expires-at",
      "2026-08-27T02:39:49.000Z",
    ],
    {
      encoding: "utf8",
      input: "passphrase-must-not-be-read\n",
      shell: false,
      timeout: 2_000,
      windowsHide: true,
    },
  );
  assert.equal(cli.status, 1);
  assert.equal(cli.stdout, "");
  assert.equal(cli.stderr, "release_manifest_time_invalid\n");
});

/**
 * Release stagingの非秘密検査はpassphrase入力より前に完了するを検証する。
 *
 * @responsibility Release stagingの非秘密検査はpassphrase入力より前に完了するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Release stagingの非秘密検査はpassphrase入力より前に完了するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("Release stagingの非秘密検査はpassphrase入力より前に完了する", () => {
  const cli = spawnSync(
    process.execPath,
    [
      path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
      "--distribution-root",
      path.resolve(coordinatorRoot, "../.."),
      "--private-key",
      path.resolve("fixture-private-key-must-not-be-read"),
      "--crdd-version",
      "v0.18.0",
      "--release-sequence",
      "1",
      "--crdd-commit",
      "a".repeat(40),
      "--crdd-tree",
      "b".repeat(40),
      "--issued-at",
      "2026-08-26T02:39:49.000Z",
      "--expires-at",
      "2026-08-27T02:39:49.000Z",
    ],
    {
      encoding: "utf8",
      input: "passphrase-must-not-be-read\n",
      shell: false,
      timeout: 2_000,
      windowsHide: true,
    },
  );
  assert.equal(cli.status, 1);
  assert.equal(cli.stdout, "");
  assert.equal(cli.stderr, "release_manifest_distribution_root_invalid\n");
});

/**
 * Runtime依存閉包の欠落を秘密鍵読取りより前の署名preflightで拒否するを検証する。
 *
 * @responsibility Runtime依存閉包の欠落を秘密鍵読取りより前の署名preflightで拒否するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime依存閉包の欠落を秘密鍵読取りより前の署名preflightで拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("Runtime依存閉包の欠落を秘密鍵読取りより前の署名preflightで拒否する", () => {
  const cases = [
    "40_Develop/coordinator/bin/coordinator.ts",
    "40_Develop/coordinator/src/cli/interactive-console-reader.ts",
    "40_Develop/coordinator/src/host-runtime/candidate-store-lock-worker.ts",
    "40_Develop/coordinator/src/host-runtime/host-operation-lock-supervisor.ts",
    "40_Develop/coordinator/scripts/verify-signed-recovery-matrix.ts",
    "template/tools/crdd-mcp.ts",
    "40_Develop/mcp/package.json",
    "40_Develop/project-runtime/src/index.ts",
    "40_Develop/runtime-data/package.json",
    "40_Develop/runtime-data/src/index.ts",
  ] as const;
  for (const relativePath of cases) {
    const distributionRoot = runtimeDistributionFixture("contract-closure");
    const privateKeyPath = path.join(
      distributionRoot,
      "private-key-must-not-be-read.pem",
    );
    try {
      const complete =
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
          distributionRoot,
        );
      assert.equal(
        complete.status,
        "candidate",
        `${relativePath}: ${JSON.stringify(complete)} ${JSON.stringify(diagnoseRuntimeDistributionFilesystemForVerification(distributionRoot))}`,
      );
      fs.unlinkSync(path.join(distributionRoot, ...relativePath.split("/")));
      const incomplete =
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
          distributionRoot,
        );
      assert.equal(incomplete.status, "blocked", relativePath);
      assert.equal(incomplete.runtimeAuthorityConferred, false, relativePath);
      assert.equal(incomplete.effectAuthorizationIssued, false, relativePath);
      assert.throws(
        () =>
          preflightReleaseManifest({
            distributionRoot,
            privateKeyPath,
            crddVersion: "v0.20.0",
            releaseSequence: 20,
            crddCommit: "a".repeat(40),
            crddTree: "b".repeat(40),
            issuedAt: "2026-09-06T00:00:00.000Z",
            expiresAt: "2027-09-06T00:00:00.000Z",
          }),
        /release_manifest_package_observation_failed/u,
        relativePath,
      );
      assert.equal(fs.existsSync(privateKeyPath), false);
      const cli = spawnSync(
        process.execPath,
        [
          path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
          "--distribution-root",
          distributionRoot,
          "--private-key",
          privateKeyPath,
          "--crdd-version",
          "v0.20.0",
          "--release-sequence",
          "20",
          "--crdd-commit",
          "a".repeat(40),
          "--crdd-tree",
          "b".repeat(40),
          "--issued-at",
          "2026-09-06T00:00:00.000Z",
          "--expires-at",
          "2027-09-06T00:00:00.000Z",
        ],
        {
          encoding: "utf8",
          input: "passphrase-must-not-be-read\n",
          shell: false,
          timeout: 5_000,
          windowsHide: true,
        },
      );
      assert.equal(cli.status, 1, relativePath);
      assert.equal(cli.stdout, "", relativePath);
      assert.equal(
        cli.stderr,
        "release_manifest_package_observation_failed\n",
        relativePath,
      );
    } finally {
      fs.rmSync(distributionRoot, { recursive: true, force: true });
    }
  }
});

/**
 * 実行primitive閉包の代表違反を全公開Consumerと署名CLIで秘密入力前に拒否するを検証する。
 *
 * @responsibility 実行primitive閉包の代表違反を全公開Consumerと署名CLIで秘密入力前に拒否するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 実行primitive閉包の代表違反を全公開Consumerと署名CLIで秘密入力前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("実行primitive閉包の代表違反を全公開Consumerと署名CLIで秘密入力前に拒否する", async () => {
  const cases = [
    {
      name: "capability_acquisition",
      relativePath: "40_Develop/coordinator/src/index.ts",
      source: 'import { spawn } from "node:child_process";\n',
    },
    {
      name: "node_self_classification",
      relativePath:
        "40_Develop/coordinator/src/docker-runtime/docker-owned-process.ts",
      source: 'spawn(process["argv0"], ["./unregistered-child.ts"]);\n',
    },
    {
      name: "lifecycle_consumer",
      relativePath:
        "40_Develop/coordinator/src/docker-runtime/docker-owned-process.ts",
      source:
        'import { runInteractiveConsoleReaderLifecycle } from "../cli/interactive-console-reader-lifecycle-internal.ts"; void runInteractiveConsoleReaderLifecycle;\n',
    },
    {
      name: "loader_namespace",
      relativePath:
        "40_Develop/coordinator/src/host-runtime/candidate-store-kernel-lock.ts",
      source:
        'import * as moduleBuiltin from "node:module"; void moduleBuiltin.createRequire;\n',
    },
    {
      name: "loader_bracket",
      relativePath:
        "40_Develop/coordinator/src/host-runtime/candidate-store-kernel-lock.ts",
      source: 'void process["getBuiltinModule"]?.("node:child_process");\n',
    },
    {
      name: "loader_reconstructed",
      relativePath:
        "40_Develop/coordinator/src/host-runtime/candidate-store-kernel-lock.ts",
      source: 'void import(["node:", "child_", "process"].join(""));\n',
    },
    {
      name: "external_process_conditional_target",
      relativePath:
        "40_Develop/coordinator/src/candidate/candidate-store-windows-adapter.ts",
      source:
        "spawnSync(selectedExecutable || process.argv0, [], { shell: false });\n",
    },
    {
      name: "injected_wrapper_property_call",
      relativePath:
        "40_Develop/coordinator/src/docker-runtime/docker-effect-runtime.ts",
      source:
        "dependencies.startProcess(process.execPath, [], createDockerProcessEnvironment(), null);\n",
    },
  ] as const;
  for (const scenario of cases) {
    const distributionRoot = runtimeDistributionFixture(
      scenario.name.replaceAll("_", "-"),
    );
    const privateKeyPath = path.join(
      distributionRoot,
      "private-key-must-not-be-read.pem",
    );
    try {
      const baseline =
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
          distributionRoot,
        );
      assert.equal(
        baseline.status,
        "candidate",
        `${scenario.name}: ${JSON.stringify(baseline)} ${JSON.stringify(diagnoseRuntimeDistributionFilesystemForVerification(distributionRoot))}`,
      );
      fs.appendFileSync(
        path.join(distributionRoot, ...scenario.relativePath.split("/")),
        scenario.source,
      );
      const observed =
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
          distributionRoot,
        );
      assert.equal(observed.status, "blocked", scenario.name);
      assert.equal(observed.runtimeAuthorityConferred, false, scenario.name);
      assert.equal(observed.effectAuthorizationIssued, false, scenario.name);
      if (scenario.name === "capability_acquisition") {
        const fixed = inspectFixedDevelopmentCoordinatorPackageCandidate({
          distributionRoot,
          expectedPackageContentRootSha256: baseline.packageContentRootSha256,
        });
        assert.equal(fixed.status, "blocked");
        assert.equal(fixed.runtimeAuthorityConferred, false);
        assert.equal(fixed.effectAuthorizationIssued, false);
        const installed = verifyInstalledCoordinatorPackageCandidate({
          distributionRoot,
          evaluationTime: "2026-09-06T00:00:00.000Z",
          expectedRelease: {
            manifestHash: "a".repeat(64),
            releaseSequence: 20,
            crddVersion: "v0.20.0",
            crddCommit: "b".repeat(40),
            crddTree: "c".repeat(40),
            packageContentRootSha256: "d".repeat(64),
            runtimeExecutionIdentitySha256: "e".repeat(64),
          },
        });
        assert.equal(installed.status, "blocked");
        assert.equal(installed.runtimeAuthorityConferred, false);
        assert.equal(installed.effectAuthorizationIssued, false);
        const copiedModuleUrl = pathToFileURL(
          path.join(
            distributionRoot,
            "40_Develop",
            "coordinator",
            "src",
            "platform-access",
            "platform-provisioner-package-filesystem.ts",
          ),
        );
        copiedModuleUrl.searchParams.set(
          "closure",
          randomBytes(8).toString("hex"),
        );
        const copiedImplementation: typeof import("../../src/platform-access/platform-provisioner-package-filesystem.ts") =
          await import(copiedModuleUrl.href);
        const issued =
          copiedImplementation.issueRuntimeOwnedVerifiedCoordinatorPackageCapability(
            { evaluationTime: "2026-09-06T00:00:00.000Z" },
          );
        assert.equal(issued.capability, null);
        assert.equal(issued.verification.status, "blocked");
        assert.equal(issued.verification.runtimeAuthorityConferred, false);
        assert.equal(issued.verification.effectAuthorizationIssued, false);
        const publicResults = JSON.stringify([fixed, installed, issued]);
        assert.equal(publicResults.includes(distributionRoot), false);
        assert.equal(publicResults.includes("child_process"), false);
        assert.equal(publicResults.includes("spawn"), false);
      }
      const input = {
        distributionRoot,
        privateKeyPath,
        crddVersion: "v0.20.0",
        releaseSequence: 20,
        crddCommit: "a".repeat(40),
        crddTree: "b".repeat(40),
        issuedAt: "2026-09-06T00:00:00.000Z",
        expiresAt: "2027-09-06T00:00:00.000Z",
      } as const;
      assert.throws(
        () => preflightReleaseManifest(input),
        /release_manifest_package_observation_failed/u,
        scenario.name,
      );
      assert.equal(fs.existsSync(privateKeyPath), false, scenario.name);
      const cli = spawnSync(
        process.execPath,
        [
          path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
          "--distribution-root",
          distributionRoot,
          "--private-key",
          privateKeyPath,
          "--crdd-version",
          "v0.20.0",
          "--release-sequence",
          "20",
          "--crdd-commit",
          "a".repeat(40),
          "--crdd-tree",
          "b".repeat(40),
          "--issued-at",
          "2026-09-06T00:00:00.000Z",
          "--expires-at",
          "2027-09-06T00:00:00.000Z",
        ],
        {
          encoding: "utf8",
          input: "passphrase-must-not-be-read\n",
          shell: false,
          timeout: 5_000,
          windowsHide: true,
        },
      );
      assert.equal(cli.status, 1, scenario.name);
      assert.equal(cli.stdout, "", scenario.name);
      assert.equal(
        cli.stderr,
        "release_manifest_package_observation_failed\n",
        scenario.name,
      );
    } finally {
      fs.rmSync(distributionRoot, { recursive: true, force: true });
    }
  }
});

/**
 * Release署名RootはRepository-localの単一candidate directoryだけを受理するを検証する。
 *
 * @responsibility Release署名RootはRepository-localの単一candidate directoryだけを受理するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Release署名RootはRepository-localの単一candidate directoryだけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle 許可外Root、Git markerのfile・directory・dangling link・EACCESを署名前に拒否する。
 * @cleanup 作成したmarkerと所有候補をfinallyで回収し、EACCES mockを復元する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("Release署名RootはRepository-localのsignature/workだけを受理する", () => {
  const candidate = uniqueReleaseCandidate("contract-root", true);
  const outside = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-signing-root-outside-"),
  );
  const arbitraryLocal = path.join(
    repositoryRoot,
    ".crdd",
    "tests",
    "sign-release-manifest-invalid",
  );
  const nested = path.join(candidate, "nested");
  try {
    fs.mkdirSync(arbitraryLocal, { recursive: true });
    fs.mkdirSync(nested, { recursive: true });
    for (const distributionRoot of [
      outside,
      repositoryRoot,
      path.join(repositoryRoot, ".crdd"),
      releaseStagingRoot,
      path.dirname(candidate),
      arbitraryLocal,
      nested,
    ]) {
      assert.throws(
        () =>
          signReleaseManifest({
            distributionRoot,
            privateKeyPath: path.resolve("fixture-private-key-not-read"),
            passphrase: "fixture-passphrase-not-read",
            crddVersion: "v0.18.0",
            releaseSequence: 1,
            crddCommit: "a".repeat(40),
            crddTree: "b".repeat(40),
            issuedAt: "2026-08-26T02:39:49.000Z",
            expiresAt: "2026-08-27T02:39:49.000Z",
          }),
        /release_manifest_distribution_root_invalid/u,
      );
    }
    const gitMarker = path.join(candidate, ".git");
    for (const markerKind of ["file", "directory"] as const) {
      if (markerKind === "file")
        fs.writeFileSync(gitMarker, "fixture", { flag: "wx" });
      else fs.mkdirSync(gitMarker);
      assert.throws(
        () =>
          preflightReleaseManifest({
            distributionRoot: candidate,
            privateKeyPath: path.resolve("fixture-private-key-not-read"),
            crddVersion: "v0.22.0",
            releaseSequence: 1,
            crddCommit: "a".repeat(40),
            crddTree: "b".repeat(40),
            issuedAt: "2026-10-06T00:00:00.000Z",
            expiresAt: "2027-10-06T00:00:00.000Z",
          }),
        /release_manifest_distribution_root_invalid/u,
      );
      if (markerKind === "file") fs.unlinkSync(gitMarker);
      else fs.rmdirSync(gitMarker);
    }
    fs.symlinkSync(
      path.join(candidate, "missing-git-target"),
      gitMarker,
      "junction",
    );
    try {
      assert.equal(fs.existsSync(gitMarker), false);
      assert.throws(
        () =>
          preflightReleaseManifest({
            distributionRoot: candidate,
            privateKeyPath: path.resolve("fixture-private-key-not-read"),
            crddVersion: "v0.22.0",
            releaseSequence: 1,
            crddCommit: "a".repeat(40),
            crddTree: "b".repeat(40),
            issuedAt: "2026-10-06T00:00:00.000Z",
            expiresAt: "2027-10-06T00:00:00.000Z",
          }),
        /release_manifest_distribution_root_invalid/u,
      );
    } finally {
      fs.unlinkSync(gitMarker);
    }
    const originalLstat = fs.lstatSync;
    const deniedMarker = mock.method(
      fs,
      "lstatSync",
      (...args: Parameters<typeof fs.lstatSync>) => {
        if (args[0] === gitMarker)
          throw Object.assign(new Error("marker denied"), { code: "EACCES" });
        return Reflect.apply(originalLstat, fs, args);
      },
    );
    try {
      assert.throws(
        () =>
          preflightReleaseManifest({
            distributionRoot: candidate,
            privateKeyPath: path.resolve("fixture-private-key-not-read"),
            crddVersion: "v0.22.0",
            releaseSequence: 1,
            crddCommit: "a".repeat(40),
            crddTree: "b".repeat(40),
            issuedAt: "2026-10-06T00:00:00.000Z",
            expiresAt: "2027-10-06T00:00:00.000Z",
          }),
        /release_manifest_distribution_root_invalid/u,
      );
    } finally {
      deniedMarker.mock.restore();
    }
  } finally {
    fs.rmSync(candidate, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
    fs.rmSync(arbitraryLocal, { recursive: true, force: true });
  }
});

/**
 * 偽造または再利用したP検査能力は秘密値処理と署名Effectの前に拒否するを検証する。
 *
 * @responsibility 偽造または再利用したP検査能力は秘密値処理と署名Effectの前に拒否するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 偽造または再利用したP検査能力は秘密値処理と署名Effectの前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("偽造または再利用したP検査能力は秘密値処理と署名Effectの前に拒否する", () => {
  const forged = Object.freeze({
    contract: "crdd-coordinator/release-manifest-preflight-authorization",
    contractRevision: 1,
  });
  assert.throws(
    () =>
      Reflect.apply(consumeReleaseManifestPreflightAuthorization, undefined, [
        forged,
        "must-not-be-consumed",
      ]),
    /release_manifest_preflight_authorization_invalid/u,
  );
});

/**
 * ephemeralEnvelopeBytesのTest準備責務を実行する。
 *
 * @responsibility ephemeralEnvelopeBytesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus ephemeralEnvelopeBytesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
function ephemeralEnvelopeBytes() {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const payload = Buffer.from("CRDD test-only placement envelope", "utf8");
  const signature = sign(null, payload, privateKey).toString("base64url");
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" });
  const canonical = canonicalizeProvisioningJsonValueCandidate({
    contract: "crdd-test/release-manifest-placement-envelope",
    contractRevision: 1,
    payload: payload.toString("base64url"),
    publicKey: publicKeyDer.toString("base64url"),
    signature,
  });
  assert.equal(canonical.status, "candidate");
  assert.ok("canonicalBytes" in canonical);
  return canonical.canonicalBytes;
}

/**
 * placementFixtureのTest準備責務を実行する。
 *
 * @responsibility placementFixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus placementFixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
function placementFixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-placement-flow-"));
  const distributionRoot = path.join(parent, "distribution");
  const executablePath = path.join(
    distributionRoot,
    "template",
    "tools",
    "coordinator",
    "windows-x64",
    "crdd-platform-access.exe",
  );
  const manifestPath = path.join(
    distributionRoot,
    "template",
    "tools",
    "coordinator",
    "coordinator-package-manifest.json",
  );
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  fs.writeFileSync(executablePath, "fixed-test-platform-access-binary");
  const observation = beginReleaseStagingManifestSession(distributionRoot);
  assert.ok(observation);
  return {
    parent,
    distributionRoot,
    executablePath,
    manifestPath,
    token: observation.token,
    canonicalBytes: ephemeralEnvelopeBytes(),
  };
}

/**
 * withFsyncMutationのTest準備責務を実行する。
 *
 * @responsibility withFsyncMutationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus withFsyncMutationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
function withFsyncMutation(
  mutation: (descriptor: number) => void,
  operation: () => void,
) {
  const originalFsyncSync = fs.fsyncSync;
  fs.fsyncSync = ((descriptor: number) => {
    originalFsyncSync(descriptor);
    mutation(descriptor);
  }) as typeof fs.fsyncSync;
  try {
    operation();
  } finally {
    fs.fsyncSync = originalFsyncSync;
  }
}

/**
 * assertStagingFailureのTest準備責務を実行する。
 *
 * @responsibility assertStagingFailureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus assertStagingFailureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
function assertStagingFailure(
  operation: () => void,
  isEffectExpected: boolean,
  shouldExpectDiscard: boolean,
) {
  try {
    operation();
    assert.fail("release staging failure was required");
  } catch (error) {
    assert.ok(error instanceof ReleaseStagingManifestError);
    assert.equal(error.releaseStagingFilesystemEffectIssued, isEffectExpected);
    assert.equal(error.stagingRootMustBeDiscarded, shouldExpectDiscard);
  }
}

/**
 * Platform Access成果物欠落ではRelease staging sessionを開始しないを検証する。
 *
 * @responsibility Platform Access成果物欠落ではRelease staging sessionを開始しないの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Platform Access成果物欠落ではRelease staging sessionを開始しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("Platform Access成果物欠落ではRelease staging sessionを開始しない", () => {
  const parent = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-staging-missing-"),
  );
  try {
    assert.equal(
      beginReleaseStagingManifestSession(path.join(parent, "distribution")),
      null,
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

/**
 * 署名Authorityを持たない配置helperは同一fdのcanonical byteを再確認するを検証する。
 *
 * @responsibility 署名Authorityを持たない配置helperは同一fdのcanonical byteを再確認するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 署名Authorityを持たない配置helperは同一fdのcanonical byteを再確認するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("署名Authorityを持たない配置helperは同一fdのcanonical byteを再確認する", () => {
  const value = placementFixture();
  try {
    const result = placeReleaseStagingManifestCandidate(
      value.token,
      value.canonicalBytes,
    );
    assert.equal(result.status, "placed");
    assert.equal(result.releaseStagingFilesystemEffectIssued, true);
    assert.equal(result.stagingRootMustBeDiscarded, false);
    assert.equal(result.runtimeFilesystemEffectIssued, false);
    assert.equal(result.provisioningFilesystemEffectIssued, false);
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.runtimeCapabilityIssued, false);
    assert.deepEqual(describeReleaseStagingManifestContract(), {
      contract: "crdd-coordinator/release-staging-manifest",
      contractRevision: 2,
      manifestRelativePath:
        "template/tools/coordinator/coordinator-package-manifest.json",
      releaseStagingManifestWrite: "implemented_explicit_signing_effect",
      releaseStagingFilesystemEffectIssuedOnSuccess: true,
      failedAfterCreateRequiresStagingRootDiscard: true,
      runtimeFilesystemEffectIssued: false,
      provisioningFilesystemEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      productionRuntimeImportAllowed: false,
    });
    assert.deepEqual(fs.readFileSync(value.manifestPath), value.canonicalBytes);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

/**
 * manifestの同長上書き、短縮および追記をcreatedへ流用しないを検証する。
 *
 * @responsibility manifestの同長上書き、短縮および追記をcreatedへ流用しないの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus manifestの同長上書き、短縮および追記をcreatedへ流用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("manifestの同長上書き、短縮および追記をcreatedへ流用しない", {
  concurrency: false,
}, () => {
  const mutations = [
    (descriptor: number, bytes: Buffer) => {
      fs.writeSync(
        descriptor,
        Buffer.alloc(bytes.length, 0x78),
        0,
        bytes.length,
        0,
      );
    },
    (descriptor: number, bytes: Buffer) => {
      fs.ftruncateSync(descriptor, bytes.length - 1);
    },
    (descriptor: number, bytes: Buffer) => {
      fs.writeSync(descriptor, Buffer.from("x"), 0, 1, bytes.length);
    },
  ];
  for (const mutate of mutations) {
    const value = placementFixture();
    try {
      assertStagingFailure(
        () =>
          withFsyncMutation(
            (descriptor) => mutate(descriptor, value.canonicalBytes),
            () =>
              void placeReleaseStagingManifestCandidate(
                value.token,
                value.canonicalBytes,
              ),
          ),
        true,
        true,
      );
      assert.equal(fs.existsSync(value.manifestPath), true);
    } finally {
      fs.rmSync(value.parent, { recursive: true, force: true });
    }
  }
});

/**
 * manifest Path、Release DirectoryまたはPlatform Access成果物の配置後差を拒否して自動削除しないを検証する。
 *
 * @responsibility manifest Path、Release DirectoryまたはPlatform Access成果物の配置後差を拒否して自動削除しないの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus manifest Path、Release DirectoryまたはPlatform Access成果物の配置後差を拒否して自動削除しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("manifest Path、Release DirectoryまたはPlatform Access成果物の配置後差を拒否して自動削除しない", {
  concurrency: false,
}, () => {
  const cases = [
    (value: ReturnType<typeof placementFixture>) => {
      fs.renameSync(value.manifestPath, `${value.manifestPath}.original`);
      fs.writeFileSync(value.manifestPath, value.canonicalBytes);
    },
    (value: ReturnType<typeof placementFixture>) => {
      const releaseDirectory = path.dirname(value.manifestPath);
      fs.renameSync(releaseDirectory, `${releaseDirectory}-original`);
      fs.mkdirSync(releaseDirectory);
    },
    (value: ReturnType<typeof placementFixture>) => {
      fs.writeFileSync(value.executablePath, "replacement");
    },
  ];
  for (const mutate of cases) {
    const value = placementFixture();
    try {
      assertStagingFailure(
        () =>
          withFsyncMutation(
            () => mutate(value),
            () =>
              void placeReleaseStagingManifestCandidate(
                value.token,
                value.canonicalBytes,
              ),
          ),
        true,
        true,
      );
      assert.equal(
        fs.existsSync(value.manifestPath) ||
          fs.existsSync(`${value.manifestPath}.original`) ||
          fs.existsSync(
            path.join(
              `${path.dirname(value.manifestPath)}-original`,
              path.basename(value.manifestPath),
            ),
          ),
        true,
      );
    } finally {
      fs.rmSync(value.parent, { recursive: true, force: true });
    }
  }
});

/**
 * 偽造tokenと既存manifestをRelease staging成功へ流用しないを検証する。
 *
 * @responsibility 偽造tokenと既存manifestをRelease staging成功へ流用しないの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 偽造tokenと既存manifestをRelease staging成功へ流用しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約
 */
test("偽造tokenと既存manifestをRelease staging成功へ流用しない", () => {
  const canonicalBytes = ephemeralEnvelopeBytes();
  assertStagingFailure(
    () => void placeReleaseStagingManifestCandidate({}, canonicalBytes),
    false,
    false,
  );

  const value = placementFixture();
  try {
    fs.writeFileSync(value.manifestPath, canonicalBytes);
    assertStagingFailure(
      () =>
        void placeReleaseStagingManifestCandidate(value.token, canonicalBytes),
      false,
      true,
    );
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

/**
 * 固定公開鍵に対応しない秘密鍵ではmanifestを生成しないを検証する。
 *
 * @responsibility 固定公開鍵に対応しない秘密鍵ではmanifestを生成しないの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定公開鍵に対応しない秘密鍵ではmanifestを生成しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle 正常P後のRuntime・Native差替えはSで秘密鍵open 0・Manifest不存在・能力再利用拒否となる。復元後の非固定鍵も従来どおり拒否する。
 * @cleanup 差替えbytesとopen mockをfinallyで復元し、所有fixtureを回収する。
 * @boundary AIT-IT-008=Direct Boundary: coordinator Test Source→対象契約。実署名は対象外。
 */
test("固定公開鍵に対応しない秘密鍵ではmanifestを生成しない", async () => {
  const fixture = createFixedRuntimeSigningFixture();
  const {
    source,
    distributionRoot,
    commit: crddCommit,
    tree: crddTree,
  } = fixture;
  const privateKeyPath = path.join(
    path.dirname(source),
    "crdd-release-v1-private.pem",
  );
  try {
    const signingModule: typeof import("../../scripts/sign-release-manifest.ts") =
      await import(
        pathToFileURL(
          path.join(
            source,
            "40_Develop",
            "coordinator",
            "scripts",
            "sign-release-manifest.ts",
          ),
        ).href
      );
    const { privateKey } = generateKeyPairSync("ed25519");
    fs.writeFileSync(
      privateKeyPath,
      privateKey.export({
        type: "pkcs8",
        format: "pem",
        cipher: "aes-256-cbc",
        passphrase: TEST_PASSPHRASE,
      }),
      { flag: "wx" },
    );
    const manifestPath = path.join(
      distributionRoot,
      "template/tools/coordinator/coordinator-package-manifest.json",
    );
    for (const relativePath of [
      "40_Develop/coordinator/bin/coordinator.ts",
      "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
    ]) {
      const authorization = signingModule.preflightReleaseManifest({
        distributionRoot,
        privateKeyPath,
        crddVersion: "v0.22.0",
        releaseSequence: 20,
        crddCommit,
        crddTree,
        issuedAt: "2026-09-07T00:00:00.000Z",
        expiresAt: "2027-09-07T00:00:00.000Z",
      }).authorization;
      const target = path.join(distributionRoot, relativePath);
      const originalBytes = fs.readFileSync(target);
      fs.writeFileSync(
        target,
        Buffer.concat([
          originalBytes,
          Buffer.from("\n// changed after preflight\n"),
        ]),
      );
      const originalOpen = fs.openSync;
      let privateKeyOpens = 0;
      const keyObserver = mock.method(
        fs,
        "openSync",
        (...args: Parameters<typeof fs.openSync>) => {
          if (args[0] === privateKeyPath) {
            privateKeyOpens += 1;
            throw new Error("private key must not be opened");
          }
          return Reflect.apply(originalOpen, fs, args);
        },
      );
      try {
        assert.throws(
          () =>
            signingModule.signReleaseManifest(authorization, TEST_PASSPHRASE),
          /release_manifest_(?:package_observation_failed|runtime_execution_identity_invalid|runtime_provenance_mismatch)/u,
        );
        assert.equal(privateKeyOpens, 0);
        assert.throws(() => fs.lstatSync(manifestPath), { code: "ENOENT" });
        assert.throws(
          () =>
            signingModule.signReleaseManifest(authorization, TEST_PASSPHRASE),
          /release_manifest_preflight_authorization_invalid/u,
        );
        assert.equal(privateKeyOpens, 0);
      } finally {
        keyObserver.mock.restore();
        fs.writeFileSync(target, originalBytes);
      }
    }
    const preflight = signingModule.preflightReleaseManifest({
      distributionRoot,
      privateKeyPath,
      crddVersion: "v0.22.0",
      releaseSequence: 20,
      crddCommit,
      crddTree,
      issuedAt: "2026-09-07T00:00:00.000Z",
      expiresAt: "2027-09-07T00:00:00.000Z",
    });
    assert.throws(
      () =>
        signingModule.signReleaseManifest(
          preflight.authorization,
          TEST_PASSPHRASE,
        ),
      /release_manifest_private_key_not_pinned/u,
    );
    assert.throws(
      () =>
        signingModule.signReleaseManifest(
          preflight.authorization,
          TEST_PASSPHRASE,
        ),
      /release_manifest_preflight_authorization_invalid/u,
    );
    assert.equal(
      fs.existsSync(
        path.join(
          distributionRoot,
          "template",
          "tools",
          "coordinator",
          "coordinator-package-manifest.json",
        ),
      ),
      false,
    );
  } finally {
    fixture.cleanup();
  }
});

/**
 * 共通fixtureは全祖先のalias、型不正、観測不能を最初の書込み前に拒否する。
 * @responsibility Root境界の拒否と書込み0を独立に確認する。
 * @trace AIT-IT-008
 * @precondition 実Rootを変更せずmetadataだけを局所置換する。
 * @stimulus Root、.crdd、testsの各境界にlink、非Directory、EACCESを与える。
 * @observation mkdir、mkdtemp、writeFileの呼出し回数。
 * @oracle 全反例で構築を拒否し三つの書込み呼出し0。
 * @cleanup 全mockをfinallyで復元し、実物を変更しない。
 * @boundary AIT-IT-008: fixture→Filesystem metadata。実署名は対象外。
 */
test("固定Runtime fixtureは不正祖先を全書込み前に拒否する", () => {
  const originalLstat = fs.lstatSync;
  for (const boundary of [
    repositoryRoot,
    path.join(repositoryRoot, ".crdd"),
    path.join(repositoryRoot, ".crdd", "tests"),
  ]) {
    for (const fault of ["link", "file", "canonical", "unknown"] as const) {
      const calls = { mkdir: 0, mkdtemp: 0, write: 0 };
      const lstat = mock.method(
        fs,
        "lstatSync",
        (...args: Parameters<typeof fs.lstatSync>) => {
          if (args[0] === boundary && fault !== "canonical") {
            if (fault === "unknown")
              throw Object.assign(new Error("unobservable"), {
                code: "EACCES",
              });
            return {
              isDirectory: () => fault !== "file",
              isSymbolicLink: () => fault === "link",
            } as never;
          }
          return Reflect.apply(originalLstat, fs, args);
        },
      );
      const mkdir = mock.method(fs, "mkdirSync", () => {
        calls.mkdir += 1;
        throw new Error("write_must_not_run");
      });
      const originalRealpath = fs.realpathSync.native;
      const realpath = mock.method(
        fs.realpathSync,
        "native",
        (...args: Parameters<typeof fs.realpathSync.native>) => {
          if (fault === "canonical" && args[0] === boundary)
            return `${boundary}-alias`;
          return Reflect.apply(originalRealpath, fs.realpathSync, args);
        },
      );
      const mkdtemp = mock.method(fs, "mkdtempSync", () => {
        calls.mkdtemp += 1;
        throw new Error("write_must_not_run");
      });
      const write = mock.method(fs, "writeFileSync", () => {
        calls.write += 1;
        throw new Error("write_must_not_run");
      });
      try {
        assert.throws(() => createFixedRuntimeSigningFixture());
        assert.deepEqual(calls, { mkdir: 0, mkdtemp: 0, write: 0 });
      } finally {
        write.mock.restore();
        mkdtemp.mock.restore();
        mkdir.mock.restore();
        lstat.mock.restore();
        realpath.mock.restore();
      }
    }
  }
});

/**
 * 明示不存在の祖先だけを親から非再帰作成し再観測する。
 * @responsibility ENOENTと作成順・再観測を検証する。
 * @trace AIT-IT-008
 * @precondition .crddとtestsの不存在をmockで与え、実Directoryは変更しない。
 * @stimulus 各mkdir後だけmetadataを正常へ切り替える。
 * @observation 作成対象、options、再観測回数とfixture作成へ進む順序。
 * @oracle Rootを作らず.crdd→testsの非再帰作成後にmkdtempへ到達し、file writeは0。
 * @cleanup 全mockをfinallyで復元する。
 * @boundary AIT-IT-008: fixture→Filesystem metadata／Directory作成。実署名は対象外。
 */
test("固定Runtime fixtureはENOENT祖先だけを段階作成し再観測する", () => {
  const originalLstat = fs.lstatSync;
  const crdd = path.join(repositoryRoot, ".crdd");
  const tests = path.join(crdd, "tests");
  const created: string[] = [];
  const reread = new Set<string>();
  let writes = 0;
  const lstat = mock.method(
    fs,
    "lstatSync",
    (...args: Parameters<typeof fs.lstatSync>) => {
      if (args[0] === crdd || args[0] === tests) {
        if (!created.includes(args[0]))
          throw Object.assign(new Error("absent"), { code: "ENOENT" });
        reread.add(args[0]);
      }
      return Reflect.apply(originalLstat, fs, args);
    },
  );
  const mkdir = mock.method(
    fs,
    "mkdirSync",
    (target: fs.PathLike, options?: unknown) => {
      assert.equal(options, undefined);
      assert.equal(target, created.length === 0 ? crdd : tests);
      created.push(target as string);
    },
  );
  const mkdtemp = mock.method(fs, "mkdtempSync", () => {
    throw new Error("stop_after_prewrite_validation");
  });
  const write = mock.method(fs, "writeFileSync", () => {
    writes += 1;
  });
  try {
    assert.throws(
      () => createFixedRuntimeSigningFixture(),
      /stop_after_prewrite_validation/u,
    );
    assert.deepEqual(created, [crdd, tests]);
    assert.deepEqual([...reread], [crdd, tests]);
    assert.equal(writes, 0);
  } finally {
    write.mock.restore();
    mkdtemp.mock.restore();
    mkdir.mock.restore();
    lstat.mock.restore();
  }
});

/**
 * fixture構築失敗でもexact自己生成runだけを回収する。
 * @responsibility 初回素材write失敗と回収後不存在を確認する。
 * @trace AIT-IT-008
 * @precondition 正常祖先と既存Runtime入力を使い、owned run内のwriteだけ失敗させる。
 * @stimulus mkdtempで生成したexact親配下のwriteを拒否する。
 * @observation 構築拒否、親run不存在、tests親の保全。
 * @oracle 同じ生成runだけを回収し、元入力や隣接範囲へ広げない。
 * @cleanup mockをfinallyで復元する。fixture内部の失敗回収を観測する。
 * @boundary AIT-IT-008: fixture→Repository-local tests。署名や秘密生成なし。
 */
test("固定Runtime fixtureは素材write失敗のexact runを回収する", () => {
  const originalMkdtemp = fs.mkdtempSync;
  const originalWrite = fs.writeFileSync;
  let owned = "";
  const mkdtemp = mock.method(
    fs,
    "mkdtempSync",
    (...args: Parameters<typeof fs.mkdtempSync>) => {
      const result = Reflect.apply(originalMkdtemp, fs, args);
      owned = String(result);
      return result;
    },
  );
  const write = mock.method(
    fs,
    "writeFileSync",
    (...args: Parameters<typeof fs.writeFileSync>) => {
      if (typeof args[0] === "string" && args[0].startsWith(owned + path.sep))
        throw new Error("fixture_write_failed");
      return Reflect.apply(originalWrite, fs, args);
    },
  );
  try {
    assert.throws(
      () => createFixedRuntimeSigningFixture(),
      /fixture_write_failed/u,
    );
    assert.equal(
      path.dirname(owned),
      path.join(repositoryRoot, ".crdd", "tests"),
    );
    assert.equal(fs.existsSync(owned), false);
    assert.equal(fs.lstatSync(path.dirname(owned)).isDirectory(), true);
  } finally {
    write.mock.restore();
    mkdtemp.mock.restore();
  }
});

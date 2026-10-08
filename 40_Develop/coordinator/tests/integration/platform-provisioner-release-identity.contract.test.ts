/**
 * coordinator:integration:platform-provisioner-release-identityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:platform-provisioner-release-identityが所有する検証責務を実行する。
 * @trace AIT-IT-002
 * @level IT
 * @scope platform、provisioner、release、identity
 * @boundary AIT-IT-002=Related 2 Blocks: Manifest・実行集合・Native成果物→Trust判定
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

import {
  gitFixedSnapshotAdapter,
  inspectRepositoryFixedSnapshot,
  readFixedSnapshotFile,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
} from "../../src/diagnostics/platform-access-release.ts";
import {
  canonicalPackageFileContent,
  inspectRuntimeDistributionSigningFilesCandidate,
} from "../../src/platform-access/package-verification.ts";

import {
  describePlatformProvisionerReleaseIdentityContract,
  inspectPlatformProvisionerReleaseIdentityCandidate,
  inspectPlatformProvisionerRuntimeGitProvenanceCandidate,
} from "../../src/platform-access/release-identity.ts";

/**
 * 選択Runtime集合のGit出所と非Runtime除外を実Git objectで検証する。
 * @responsibility 固定Blob、配布閉包、Nativeの結合と拒否を反証する。
 * @trace AIT-IT-002
 * @precondition 現行Source閉包を読取り、Repository-local試験Rootだけを使用する。
 * @stimulus 非秘密fixtureの選択byte、固定Tree、Capability、欠落を変更する。
 * @observation 出所候補結果とEffect、非選択文書の無影響を観測する。
 * @oracle 一致時だけcandidate、不一致時blockedでAuthorityとEffectは常にfalse。
 * @cleanup 所有するexact試験Rootを確認して回収する。
 * @boundary AIT-IT-002=Related 2 Blocks: Git Snapshot→Runtime閉包→出所判定
 */
test("選択Runtime Git出所は全Tree不要で閉包とNativeの混入を拒否する", (t) => {
  const repository = path.resolve(
    fileURLToPath(new URL("../../../../", import.meta.url)),
  );
  const observed = inspectRuntimeDistributionSigningFilesCandidate(repository);
  assert.equal(observed.status, "candidate");
  if (observed.status !== "candidate") return;
  const testsRoot = path.join(repository, ".crdd", "tests");
  fs.mkdirSync(testsRoot, { recursive: true });
  assert.equal(fs.realpathSync.native(testsRoot), testsRoot);
  const verificationOperation = fs.mkdtempSync(
    path.join(testsRoot, "git-provenance-"),
  );
  t.after(() => {
    assert.equal(path.dirname(verificationOperation), testsRoot);
    assert.equal(
      fs.realpathSync.native(verificationOperation),
      verificationOperation,
    );
    fs.rmSync(verificationOperation, { recursive: true, force: true });
    assert.equal(fs.existsSync(verificationOperation), false);
  });
  const source = path.join(verificationOperation, "source");
  const distribution = path.join(verificationOperation, "distribution");
  fs.mkdirSync(path.join(source, ".git", "objects"), { recursive: true });
  fs.mkdirSync(path.join(source, ".git", "refs", "heads"), { recursive: true });
  fs.writeFileSync(
    path.join(source, ".git", "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  fs.writeFileSync(
    path.join(source, ".git", "HEAD"),
    "ref: refs/heads/fixture\n",
  );
  const contents = new Map<string, Buffer>();
  for (const file of observed.files) {
    const bytes = fs.readFileSync(
      path.join(repository, ...file.path.split("/")),
    );
    contents.set(file.path, bytes);
    const target = path.join(distribution, ...file.path.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }
  contents.set(
    PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
    Buffer.from("native-fixture\0", "utf8"),
  );
  const nativePath = path.join(
    distribution,
    ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
  );
  fs.mkdirSync(path.dirname(nativePath), { recursive: true });
  fs.writeFileSync(
    nativePath,
    contents.get(PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH) ?? Buffer.alloc(0),
  );
  /**
   * 固定試験Git objectをRepository-local fixtureだけへ生成する。
   * @responsibility 実Git Blob・Tree・Commitの非秘密入力を構築する。
   * @trace AIT-IT-002
   * @precondition sourceは本Test所有Rootである。
   * @stimulus object typeとbytesをGit形式へ符号化する。
   * @observation object IDを返す。
   * @oracle Version Controlの既存Readerで読めるGit objectである。
   * @cleanup 外側Testがexact Rootを回収する。
   * @boundary AIT-IT-002=Direct Boundary: fixture→Git object Reader
   */
  function writeObject(type: "blob" | "tree" | "commit", bytes: Buffer) {
    const encoded = Buffer.concat([
      Buffer.from(`${type} ${bytes.length}\0`, "ascii"),
      bytes,
    ]);
    const oid = createHash("sha1").update(encoded).digest("hex");
    const directory = path.join(source, ".git", "objects", oid.slice(0, 2));
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, oid.slice(2)), deflateSync(encoded));
    return oid;
  }
  /**
   * 選択Pathの階層だけから固定Treeを構築する。
   * @responsibility 全Repositoryを展開せず閉包のGit出所を構築する。
   * @trace AIT-IT-002
   * @precondition contentsは相対Pathと非秘密bytesの集合である。
   * @stimulus prefix配下のfileと子DirectoryをGit順序で符号化する。
   * @observation Tree object IDを返す。
   * @oracle 既存Readerが選択fileを読み取れる。
   * @cleanup 外側Testがexact Rootを回収する。
   * @boundary AIT-IT-002=Direct Boundary: fixture→Git Tree Reader
   */
  function writeTree(prefix: string): string {
    const entries = new Map<string, Readonly<{ mode: string; oid: string }>>();
    for (const [relative, bytes] of contents) {
      if (!relative.startsWith(prefix)) continue;
      const remainder = relative.slice(prefix.length);
      const slash = remainder.indexOf("/");
      if (slash < 0)
        entries.set(remainder, {
          mode: "100644",
          oid: writeObject("blob", bytes),
        });
      else {
        const name = remainder.slice(0, slash);
        if (!entries.has(name))
          entries.set(name, {
            mode: "40000",
            oid: writeTree(`${prefix}${name}/`),
          });
      }
    }
    const orderedEntries = [...entries].sort(([left, a], [right, b]) =>
      Buffer.compare(
        Buffer.from(`${left}${a.mode === "40000" ? "/" : ""}`),
        Buffer.from(`${right}${b.mode === "40000" ? "/" : ""}`),
      ),
    );
    return writeObject(
      "tree",
      Buffer.concat(
        orderedEntries.flatMap(([name, entry]) => [
          Buffer.from(`${entry.mode} ${name}\0`, "utf8"),
          Buffer.from(entry.oid, "hex"),
        ]),
      ),
    );
  }
  const crddTree = writeTree("");
  const crddCommit = writeObject(
    "commit",
    Buffer.from(
      `tree ${crddTree}\nauthor CRDD Test <test@example.invalid> 0 +0000\ncommitter CRDD Test <test@example.invalid> 0 +0000\n\nfixture\n`,
    ),
  );
  fs.writeFileSync(
    path.join(source, ".git", "refs", "heads", "fixture"),
    `${crddCommit}\n`,
  );
  const verified = verifyRepositoryRoot(source);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  assert.equal(
    inspectRepositoryFixedSnapshot(verified.capability, crddCommit)
      ?.snapshotIdentity,
    crddTree,
  );
  assert.equal(
    inspectRuntimeDistributionSigningFilesCandidate(distribution).status,
    "candidate",
  );
  assert.ok(beginPlatformAccessArtifactSigningObservation(distribution));
  for (const [relative, bytes] of contents) {
    const fixed = readFixedSnapshotFile(
      verified.capability,
      crddCommit,
      relative,
      gitFixedSnapshotAdapter,
      64 * 1024 * 1024,
    );
    assert.ok(fixed, relative);
    assert.equal(fixed.relativePath, relative);
    assert.ok(
      canonicalPackageFileContent(relative, fixed.bytes).equals(
        canonicalPackageFileContent(relative, bytes),
      ),
      relative,
    );
  }
  const input = {
    repositoryRoot: verified.capability,
    distributionRoot: distribution,
    crddCommit,
    crddTree,
  };
  const success =
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate(input);
  assert.equal(success.status, "candidate");
  assert.equal(success.filesystemEffectIssued, false);
  assert.equal(success.runtimeCapabilityIssued, false);
  assert.equal(JSON.stringify(success).includes(verificationOperation), false);
  fs.writeFileSync(
    path.join(distribution, "README.md"),
    "unsigned non-runtime document\n",
  );
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate(input).status,
    "candidate",
  );
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate({
      ...input,
      crddTree: "0".repeat(40),
    }).status,
    "blocked",
  );
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate({
      ...input,
      repositoryRoot: { contract: verified.capability.contract },
    }).status,
    "blocked",
  );
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate({
      ...input,
      crddCommit: "0".repeat(40),
    }).status,
    "blocked",
  );
  const runtimePath = observed.files.find((file) =>
    file.path.endsWith(".ts"),
  )?.path;
  assert.ok(runtimePath);
  const target = path.join(distribution, ...runtimePath.split("/"));
  const original = fs.readFileSync(target);
  fs.writeFileSync(
    target,
    original.toString("utf8").replace(/\r?\n/gu, "\r\n"),
  );
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate(input).status,
    "candidate",
  );
  fs.writeFileSync(target, original);
  fs.appendFileSync(target, "\n// altered selected runtime\n");
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate(input).status,
    "blocked",
  );
  fs.writeFileSync(target, original);
  fs.writeFileSync(nativePath, "changed-native");
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate(input).status,
    "blocked",
  );
  fs.writeFileSync(
    nativePath,
    contents.get(PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH) ?? Buffer.alloc(0),
  );
  fs.rmSync(target);
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate(input).status,
    "blocked",
  );
  fs.writeFileSync(target, original);
  let getterCalls = 0;
  const accessor = Object.defineProperty({ ...input }, "crddTree", {
    get() {
      getterCalls += 1;
      return crddTree;
    },
  });
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate(accessor).status,
    "blocked",
  );
  assert.equal(getterCalls, 0);
  const originalBlob = Buffer.concat([
    Buffer.from(`blob ${original.length}\0`, "ascii"),
    original,
  ]);
  const blobId = createHash("sha1").update(originalBlob).digest("hex");
  const blobPath = path.join(
    source,
    ".git",
    "objects",
    blobId.slice(0, 2),
    blobId.slice(2),
  );
  const objectBytes = fs.readFileSync(blobPath);
  fs.rmSync(blobPath);
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate(input).status,
    "blocked",
  );
  fs.writeFileSync(blobPath, objectBytes);
  fs.rmSync(nativePath);
  assert.equal(
    inspectPlatformProvisionerRuntimeGitProvenanceCandidate(input).status,
    "blocked",
  );
});

/**
 * objectIdのTest準備責務を実行する。
 *
 * @responsibility objectIdがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus objectIdを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
function objectId(type: "blob" | "tree", bytes: Buffer) {
  return createHash("sha1")
    .update(Buffer.from(`${type} ${bytes.length}\0`, "ascii"))
    .update(bytes)
    .digest();
}

/**
 * treeのTest準備責務を実行する。
 *
 * @responsibility treeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus treeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
function tree(entries: ReadonlyArray<readonly [string, string, Buffer]>) {
  const bytes = Buffer.concat(
    entries.flatMap(([mode, name, oid]) => [
      Buffer.from(`${mode} ${name}\0`, "utf8"),
      oid,
    ]),
  );
  return objectId("tree", bytes);
}

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-release-tree-"));
  fs.mkdirSync(path.join(root, ".crdd", "config"), { recursive: true });
  fs.mkdirSync(path.join(root, "90_Release"));
  fs.mkdirSync(
    path.join(root, "template", "tools", "coordinator", "windows-x64"),
    { recursive: true },
  );
  fs.mkdirSync(path.join(root, "nested"));
  const alpha = Buffer.from("alpha\n", "utf8");
  const beta = Buffer.from("beta\n", "utf8");
  const release = Buffer.from("release\n", "utf8");
  const platformAccess = Buffer.from("binary", "utf8");
  const externalSendPolicy = Buffer.from('{"policy":true}\n', "utf8");
  fs.writeFileSync(path.join(root, ".git"), "gitdir: fixed-metadata\n");
  fs.writeFileSync(path.join(root, "alpha.txt"), alpha);
  fs.writeFileSync(
    path.join(root, ".crdd", "config", "external-send-policy.json"),
    externalSendPolicy,
  );
  fs.writeFileSync(path.join(root, "nested", "beta.txt"), beta);
  fs.writeFileSync(path.join(root, "90_Release", "readme.txt"), release);
  fs.writeFileSync(
    path.join(
      root,
      "template",
      "tools",
      "coordinator",
      "coordinator-package-manifest.json",
    ),
    "{}",
  );
  fs.writeFileSync(
    path.join(
      root,
      "template",
      "tools",
      "coordinator",
      "windows-x64",
      "crdd-platform-access.exe",
    ),
    platformAccess,
  );
  const toolTargetTree = tree([
    ["100644", "crdd-platform-access.exe", objectId("blob", platformAccess)],
  ]);
  const coordinatorToolTree = tree([["40000", "windows-x64", toolTargetTree]]);
  const toolsTree = tree([["40000", "coordinator", coordinatorToolTree]]);
  const templateTree = tree([["40000", "tools", toolsTree]]);
  const releaseTree = tree([
    ["100644", "readme.txt", objectId("blob", release)],
  ]);
  const nestedTree = tree([["100644", "beta.txt", objectId("blob", beta)]]);
  const crddConfigTree = tree([
    [
      "100644",
      "external-send-policy.json",
      objectId("blob", externalSendPolicy),
    ],
  ]);
  const crddMetadataTree = tree([["40000", "config", crddConfigTree]]);
  const rootTree = tree([
    ["40000", ".crdd", crddMetadataTree],
    ["40000", "90_Release", releaseTree],
    ["100644", "alpha.txt", objectId("blob", alpha)],
    ["40000", "nested", nestedTree],
    ["40000", "template", templateTree],
  ]).toString("hex");
  return { root, rootTree };
}

/**
 * 配布Root全体をGit Treeへ再計算し後置manifestと管理metadataだけを除外するを検証する。
 *
 * @responsibility 配布Root全体をGit Treeへ再計算し後置manifestと管理metadataだけを除外するの合否判定を所有する。
 * @trace AIT-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布Root全体をGit Treeへ再計算し後置manifestと管理metadataだけを除外するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("配布Root全体をGit Treeへ再計算し後置manifestと管理metadataだけを除外する", () => {
  const value = fixture();
  try {
    const result = inspectPlatformProvisionerReleaseIdentityCandidate(
      value.root,
      value.rootTree,
    );
    assert.equal(result.status, "candidate");
    assert.equal(result.crddTree, value.rootTree);
    assert.equal(result.distributionFileCount, 5);
    assert.equal(result.manifestExcludedFromSignedGitTree, true);
    assert.equal(result.platformAccessExecutableIncludedInSignedGitTree, true);
    assert.equal(result.gitMetadataExcludedFromSignedGitTree, true);
    assert.equal(result.trackedRuntimeSettingIncludedInSignedGitTree, true);
    assert.equal(result.releaseIdentityRuntimeOwned, false);
    assert.equal("distributionRoot" in result, false);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * Root .crddの追跡設定だけを含めRuntime状態を除外するを検証する。
 *
 * @responsibility Root .crddの追跡設定だけを含めRuntime状態を除外するの合否判定を所有する。
 * @trace AIT-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Root .crddの追跡設定だけを含めRuntime状態を除外するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Root .crddの追跡設定だけを含めRuntime状態を除外する", () => {
  const value = fixture();
  try {
    fs.writeFileSync(
      path.join(value.root, ".crdd", "runtime-state.json"),
      "{}\n",
    );
    const result = inspectPlatformProvisionerReleaseIdentityCandidate(
      value.root,
      value.rootTree,
    );
    assert.equal(result.status, "candidate");
    assert.equal(result.runtimeMetadataExcludedFromSignedGitTree, true);

    fs.renameSync(
      path.join(value.root, ".crdd"),
      path.join(value.root, ".crdd-copy"),
    );
    assert.equal(
      inspectPlatformProvisionerReleaseIdentityCandidate(
        value.root,
        value.rootTree,
      ).status,
      "blocked",
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * 配布fileの変更、追加および不正Treeを拒否するを検証する。
 *
 * @responsibility 配布fileの変更、追加および不正Treeを拒否するの合否判定を所有する。
 * @trace AIT-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布fileの変更、追加および不正Treeを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("配布fileの変更、追加および不正Treeを拒否する", () => {
  const mutations: Array<(root: string) => void> = [
    (root) => {
      fs.writeFileSync(path.join(root, "alpha.txt"), "changed\n");
    },
    (root) => {
      fs.writeFileSync(path.join(root, "extra.txt"), "extra\n");
    },
  ];
  for (const mutate of mutations) {
    const value = fixture();
    try {
      mutate(value.root);
      assert.equal(
        inspectPlatformProvisionerReleaseIdentityCandidate(
          value.root,
          value.rootTree,
        ).status,
        "blocked",
      );
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  }
  assert.equal(
    inspectPlatformProvisionerReleaseIdentityCandidate("relative", "not-a-tree")
      .status,
    "blocked",
  );
});

/**
 * 配布TreeはRepository textのLF／CRLFを同一視しNative byte差を拒否するを検証する。
 *
 * @responsibility 配布TreeはRepository textのLF／CRLFを同一視しNative byte差を拒否するの合否判定を所有する。
 * @trace AIT-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布TreeはRepository textのLF／CRLFを同一視しNative byte差を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("配布TreeはRepository textのLF／CRLFを同一視しNative byte差を拒否する", () => {
  const value = fixture();
  try {
    fs.writeFileSync(path.join(value.root, "alpha.txt"), "alpha\r\n");
    assert.equal(
      inspectPlatformProvisionerReleaseIdentityCandidate(
        value.root,
        value.rootTree,
      ).status,
      "candidate",
    );
    fs.writeFileSync(
      path.join(
        value.root,
        "template",
        "tools",
        "coordinator",
        "windows-x64",
        "crdd-platform-access.exe",
      ),
      "binary\r\n",
    );
    assert.equal(
      inspectPlatformProvisionerReleaseIdentityCandidate(
        value.root,
        value.rootTree,
      ).status,
      "blocked",
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * 配布TreeはNULを含む非exe binaryを改行正規化しないを検証する。
 *
 * @responsibility 配布TreeはNULを含む非exe binaryを改行正規化しないの合否判定を所有する。
 * @trace AIT-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布TreeはNULを含む非exe binaryを改行正規化しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("配布TreeはNULを含む非exe binaryを改行正規化しない", () => {
  const value = fixture();
  try {
    const binaryPath = path.join(value.root, "binary.dat");
    fs.writeFileSync(binaryPath, Buffer.from([0x00, 0x0d, 0x0a]));
    assert.equal(
      inspectPlatformProvisionerReleaseIdentityCandidate(
        value.root,
        value.rootTree,
      ).status,
      "blocked",
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * 固定Platform Access成果物の欠落を署名対象Tree成立と誤認しないを検証する。
 *
 * @responsibility 固定Platform Access成果物の欠落を署名対象Tree成立と誤認しないの合否判定を所有する。
 * @trace AIT-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Platform Access成果物の欠落を署名対象Tree成立と誤認しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("固定Platform Access成果物の欠落を署名対象Tree成立と誤認しない", () => {
  const value = fixture();
  try {
    fs.rmSync(
      path.join(
        value.root,
        "template",
        "tools",
        "coordinator",
        "windows-x64",
        "crdd-platform-access.exe",
      ),
    );
    const result = inspectPlatformProvisionerReleaseIdentityCandidate(
      value.root,
      value.rootTree,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.platformAccessExecutableIncludedInSignedGitTree, false);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * Release Identity contractはTree一致をEffectおよびrollbackから分離するを検証する。
 *
 * @responsibility Release Identity contractはTree一致をEffectおよびrollbackから分離するの合否判定を所有する。
 * @trace AIT-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Release Identity contractはTree一致をEffectおよびrollbackから分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("Release Identity contractはTree一致をEffectおよびrollbackから分離する", () => {
  const contract = describePlatformProvisionerReleaseIdentityContract();
  assert.equal(contract.contractRevision, 3);
  assert.deepEqual(contract.hashAlgorithms, ["SHA-1", "SHA-256"]);
  assert.equal(
    contract.manifestExcludedFromSignedGitTree,
    "template/tools/coordinator/coordinator-package-manifest.json",
  );
  assert.equal(
    contract.platformAccessExecutableIncludedInSignedGitTree,
    "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
  );
  assert.equal(
    contract.signedCrddTreeComparison,
    "implemented_candidate_non_authoritative",
  );
  assert.equal(
    contract.runtimeMetadataInDistribution,
    "tracked_external_send_policy_included_and_other_exact_root_crdd_children_excluded",
  );
  assert.equal(contract.runtimeCapabilityIssued, false);
});
/**
 * 配布Treeの読込競合はHashと権限を発行せず対象descriptorを閉じるを検証する。
 *
 * @responsibility 配布Treeの読込競合はHashと権限を発行せず対象descriptorを閉じるの合否判定を所有する。
 * @trace AIT-IT-002
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布Treeの読込競合はHashと権限を発行せず対象descriptorを閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
 */
test("配布Treeの読込競合はHashと権限を発行せず対象descriptorを閉じる", (t) => {
  for (const failure of [
    "short-read",
    "opened-identity",
    "after-mtime",
    "path-identity",
  ] as const) {
    const value = fixture();
    const target = path.join(value.root, "alpha.txt");
    try {
      const bytes = fs.readFileSync(target);
      /**
       * inspectのTest準備責務を実行する。
       *
       * @responsibility inspectがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
       * @trace AIT-IT-002
       * @precondition 呼出し元Test Caseが必要な入力を渡す。
       * @stimulus inspectを呼び出す。
       * @observation 返却値、生成fixtureまたは観測値を取得する。
       * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
       * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
       * @boundary AIT-IT-002=Direct Boundary: coordinator Test Source→対象契約
       */
      const inspect = () =>
        inspectPlatformProvisionerReleaseIdentityCandidate(
          value.root,
          value.rootTree,
        );
      assert.equal(inspect().status, "candidate");
      const originalOpen = fs.openSync;
      const originalRead = fs.readSync;
      const originalStat = fs.fstatSync;
      const originalLstat = fs.lstatSync;
      const originalClose = fs.closeSync;
      let targetDescriptor: number | null = null;
      let openCount = 0;
      let closeCount = 0;
      let statCount = 0;
      let readCount = 0;
      let mutationCount = 0;
      try {
        t.mock.method(fs, "openSync", ((
          ...args: Parameters<typeof fs.openSync>
        ) => {
          const descriptor = Reflect.apply(originalOpen, fs, args);
          if (args[0] === target) {
            targetDescriptor = descriptor;
            openCount += 1;
          }
          return descriptor;
        }) as typeof fs.openSync);
        t.mock.method(fs, "readSync", ((
          ...args: Parameters<typeof fs.readSync>
        ) => {
          if (args[0] === targetDescriptor) {
            readCount += 1;
            if (failure === "short-read") {
              mutationCount += 1;
              return 0;
            }
          }
          return Reflect.apply(originalRead, fs, args);
        }) as typeof fs.readSync);
        t.mock.method(fs, "fstatSync", ((
          ...args: Parameters<typeof fs.fstatSync>
        ) => {
          const metadata = Reflect.apply(
            originalStat,
            fs,
            args,
          ) as fs.BigIntStats;
          if (args[0] === targetDescriptor) {
            statCount += 1;
            if (failure === "opened-identity" && statCount === 1) {
              mutationCount += 1;
              return { ...metadata, ino: metadata.ino + 1n };
            }
            if (failure === "after-mtime" && statCount === 2) {
              mutationCount += 1;
              return { ...metadata, mtimeNs: metadata.mtimeNs + 1n };
            }
          }
          return metadata;
        }) as typeof fs.fstatSync);
        t.mock.method(fs, "lstatSync", ((
          ...args: Parameters<typeof fs.lstatSync>
        ) => {
          const metadata = Reflect.apply(
            originalLstat,
            fs,
            args,
          ) as fs.BigIntStats;
          if (
            args[0] === target &&
            targetDescriptor !== null &&
            statCount === 2 &&
            failure === "path-identity"
          ) {
            mutationCount += 1;
            return { ...metadata, ino: metadata.ino + 1n };
          }
          return metadata;
        }) as typeof fs.lstatSync);
        t.mock.method(fs, "closeSync", ((descriptor: number) => {
          if (descriptor === targetDescriptor) closeCount += 1;
          originalClose(descriptor);
        }) as typeof fs.closeSync);
        const result = inspect();
        assert.equal(result.status, "blocked", failure);
        assert.equal(
          result.reason,
          "platform_provisioner_release_identity_invalid",
        );
        assert.equal(result.crddTree, null);
        assert.equal(result.runtimeAuthorityConferred, false);
        assert.equal(result.runtimeCapabilityIssued, false);
        assert.equal(result.filesystemEffectIssued, false);
        assert.equal(result.networkEffectIssued, false);
        assert.equal(openCount, 1);
        assert.equal(closeCount, 1);
        assert.equal(mutationCount, 1);
        assert.equal(statCount, failure === "opened-identity" ? 1 : 2);
        assert.equal(readCount, failure === "opened-identity" ? 0 : 1);
      } finally {
        t.mock.restoreAll();
      }
      assert.deepEqual(fs.readFileSync(target), bytes);
      assert.equal(inspect().status, "candidate");
    } finally {
      fs.rmSync(value.root, { recursive: true, force: true });
    }
  }
});

/**
 * 配布観測の件数境界と容量上限を独立して確認する。
 *
 * @responsibility 旧2048件境界を越えた配布を収容し、4097件または64MiB超過を拒否する。
 * @trace AIT-IT-002
 * @precondition Repository-localの一時Rootだけを使用する。
 * @stimulus 2048、2049、4096、4097件および容量超過を入力する。
 * @observation 件数、Tree一致、拒否結果とAuthority非発行を確認する。
 * @oracle 4096件までは期待Treeへ一致し、件数または容量超過は拒否する。
 * @cleanup 検証済み一時Rootを削除し不存在を確認する。
 * @boundary Filesystem観測から非Authorityの配布Identity判定まで。
 */
test("配布観測は4096件までを収容し件数と64MiBの超過を拒否する", () => {
  const temporaryRoot = path.resolve(
    import.meta.dirname,
    "../../../..",
    ".crdd",
    "tmp",
  );
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const root = fs.mkdtempSync(path.join(temporaryRoot, "release-budget-"));
  const entries: Array<readonly [string, string, Buffer]> = [];
  try {
    assert.equal(fs.realpathSync.native(root), root);
    for (const count of [2048, 2049, 4096, 4097]) {
      while (entries.length < count) {
        const name = `file-${String(entries.length).padStart(4, "0")}.txt`;
        fs.writeFileSync(path.join(root, name), "", { flag: "wx" });
        entries.push(["100644", name, objectId("blob", Buffer.alloc(0))]);
      }
      const expectedTree = tree(entries).toString("hex");
      const result = inspectPlatformProvisionerReleaseIdentityCandidate(
        root,
        expectedTree,
      );
      assert.equal(result.status, count <= 4096 ? "candidate" : "blocked");
      assert.equal(result.runtimeAuthorityConferred, false);
      assert.equal(result.runtimeCapabilityIssued, false);
      if (count <= 4096) {
        assert.equal(result.crddTree, expectedTree);
        assert.equal(result.distributionFileCount, count);
      }
    }
    for (const [, name] of entries) fs.unlinkSync(path.join(root, name));
    const oversizedPath = path.join(root, "oversized.bin");
    const descriptor = fs.openSync(oversizedPath, "wx");
    try {
      fs.ftruncateSync(descriptor, 64 * 1024 * 1024 + 1);
    } finally {
      fs.closeSync(descriptor);
    }
    const oversizedTree = tree([
      [
        "100644",
        "oversized.bin",
        objectId("blob", fs.readFileSync(oversizedPath)),
      ],
    ]).toString("hex");
    assert.equal(
      inspectPlatformProvisionerReleaseIdentityCandidate(root, oversizedTree)
        .status,
      "blocked",
    );
    assert.equal(
      describePlatformProvisionerReleaseIdentityContract()
        .maximumDistributionFiles,
      4096,
    );
    assert.equal(
      describePlatformProvisionerReleaseIdentityContract()
        .maximumDistributionBytes,
      64 * 1024 * 1024,
    );
  } finally {
    assert.ok(root.startsWith(`${temporaryRoot}${path.sep}release-budget-`));
    assert.equal(fs.realpathSync.native(root), root);
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  }
});

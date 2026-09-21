/**
 * coordinator:integration:platform-provisioner-release-identityの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:platform-provisioner-release-identityが所有する検証責務を実行する。
 * @trace AIT-IT-001
 * @level IT
 * @scope platform、provisioner、release、identity
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  describePlatformProvisionerReleaseIdentityContract,
  inspectPlatformProvisionerReleaseIdentityCandidate,
} from "../../src/security/platform-provisioner-release-identity.ts";

/**
 * objectIdのTest準備責務を実行する。
 *
 * @responsibility objectIdがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus objectIdを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus treeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布Root全体をGit Treeへ再計算し後置manifestと管理metadataだけを除外するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Root .crddの追跡設定だけを含めRuntime状態を除外するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布fileの変更、追加および不正Treeを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布TreeはRepository textのLF／CRLFを同一視しNative byte差を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布TreeはNULを含む非exe binaryを改行正規化しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Platform Access成果物の欠落を署名対象Tree成立と誤認しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Release Identity contractはTree一致をEffectおよびrollbackから分離するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
 * @trace AIT-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 配布Treeの読込競合はHashと権限を発行せず対象descriptorを閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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
       * @trace AIT-IT-001
       * @precondition 呼出し元Test Caseが必要な入力を渡す。
       * @stimulus inspectを呼び出す。
       * @observation 返却値、生成fixtureまたは観測値を取得する。
       * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
       * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
       * @boundary Adjacent 1 Block: Artifact Observer→Trust Evaluator→Policy
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

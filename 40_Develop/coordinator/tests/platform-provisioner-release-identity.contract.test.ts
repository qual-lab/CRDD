import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  describePlatformProvisionerReleaseIdentityContract,
  inspectPlatformProvisionerReleaseIdentityCandidate,
} from "../src/security/platform-provisioner-release-identity.ts";

function objectId(type: "blob" | "tree", bytes: Buffer) {
  return createHash("sha1")
    .update(Buffer.from(`${type} ${bytes.length}\0`, "ascii"))
    .update(bytes)
    .digest();
}

function tree(entries: ReadonlyArray<readonly [string, string, Buffer]>) {
  const bytes = Buffer.concat(
    entries.flatMap(([mode, name, oid]) => [
      Buffer.from(`${mode} ${name}\0`, "utf8"),
      oid,
    ]),
  );
  return objectId("tree", bytes);
}

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-release-tree-"));
  fs.mkdirSync(path.join(root, "90_Release"));
  fs.mkdirSync(
    path.join(root, "90_Release", "platform-access", "x86_64-pc-windows-msvc"),
    { recursive: true },
  );
  fs.mkdirSync(
    path.join(root, "90_Release", "coordinator", "x86_64-pc-windows-msvc"),
    { recursive: true },
  );
  fs.mkdirSync(path.join(root, "nested"));
  const alpha = Buffer.from("alpha\n", "utf8");
  const beta = Buffer.from("beta\n", "utf8");
  const release = Buffer.from("release\n", "utf8");
  fs.writeFileSync(path.join(root, "alpha.txt"), alpha);
  fs.writeFileSync(path.join(root, "nested", "beta.txt"), beta);
  fs.writeFileSync(path.join(root, "90_Release", "readme.txt"), release);
  fs.writeFileSync(
    path.join(root, "90_Release", "coordinator-package-manifest.json"),
    "{}",
  );
  fs.writeFileSync(
    path.join(
      root,
      "90_Release",
      "platform-access",
      "x86_64-pc-windows-msvc",
      "crdd-platform-access.exe",
    ),
    "binary",
  );
  fs.writeFileSync(
    path.join(
      root,
      "90_Release",
      "coordinator",
      "x86_64-pc-windows-msvc",
      "coordinator.exe",
    ),
    "native-supervisor",
  );
  const releaseTree = tree([
    ["100644", "readme.txt", objectId("blob", release)],
  ]);
  const nestedTree = tree([["100644", "beta.txt", objectId("blob", beta)]]);
  const rootTree = tree([
    ["40000", "90_Release", releaseTree],
    ["100644", "alpha.txt", objectId("blob", alpha)],
    ["40000", "nested", nestedTree],
  ]).toString("hex");
  return { root, rootTree };
}

test("配布Root全体をGit Treeへ再計算し後置manifestとRust成果物を除外する", () => {
  const value = fixture();
  try {
    const result = inspectPlatformProvisionerReleaseIdentityCandidate(
      value.root,
      value.rootTree,
    );
    assert.equal(result.status, "candidate");
    assert.equal(result.crddTree, value.rootTree);
    assert.equal(result.distributionFileCount, 3);
    assert.equal(result.postCheckoutManifestExcludedFromGitTree, true);
    assert.equal(
      result.postCheckoutPlatformAccessExecutableExcludedFromGitTree,
      true,
    );
    assert.equal(
      result.postCheckoutNativeProvisionSupervisorExecutableExcludedFromGitTree,
      true,
    );
    assert.equal(result.releaseIdentityRuntimeOwned, false);
    assert.equal("distributionRoot" in result, false);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

test("配布fileの変更、追加、Git metadataおよび不正Treeを拒否する", () => {
  const mutations: Array<(root: string) => void> = [
    (root) => {
      fs.writeFileSync(path.join(root, "alpha.txt"), "changed\n");
    },
    (root) => {
      fs.writeFileSync(path.join(root, "extra.txt"), "extra\n");
    },
    (root) => {
      fs.mkdirSync(path.join(root, ".git"));
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

test("Release Identity contractはTree一致をEffectおよびrollbackから分離する", () => {
  const contract = describePlatformProvisionerReleaseIdentityContract();
  assert.equal(contract.contractRevision, 2);
  assert.deepEqual(contract.hashAlgorithms, ["SHA-1", "SHA-256"]);
  assert.equal(
    contract.postCheckoutManifestExcludedFromGitTree,
    "90_Release/coordinator-package-manifest.json",
  );
  assert.equal(
    contract.postCheckoutPlatformAccessExecutableExcludedFromGitTree,
    "90_Release/platform-access/x86_64-pc-windows-msvc/crdd-platform-access.exe",
  );
  assert.equal(
    contract.postCheckoutNativeProvisionSupervisorExecutableExcludedFromGitTree,
    "90_Release/coordinator/x86_64-pc-windows-msvc/coordinator.exe",
  );
  assert.equal(
    contract.signedCrddTreeComparison,
    "implemented_candidate_non_authoritative",
  );
  assert.equal(contract.runtimeCapabilityIssued, false);
});
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

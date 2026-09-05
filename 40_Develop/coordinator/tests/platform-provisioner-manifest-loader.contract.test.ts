import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  loadHistoricalReleaseManifestEnvelopeForVerification,
  loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerification,
  inspectPlatformProvisionerManifestFileCandidate,
  loadPlatformProvisionerManifestEnvelopeForVerification,
} from "../src/security/platform-provisioner-manifest-loader.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../src/security/provisioning-signature-primitives.ts";

function fixtureEnvelope() {
  return {
    contract: "crdd-coordinator/platform-provisioner-package-manifest-envelope",
    contractRevision: 2,
    payload: { fixture: true },
    signatures: [
      {
        keyId: "0".repeat(64),
        algorithm: "Ed25519",
        signature: "A".repeat(86),
      },
    ],
  };
}

test("旧revision 2 manifestは旧固定Pathからだけ履歴確認用に読込する", () => {
  const canonical = canonicalizeProvisioningJsonValueCandidate(
    fixtureEnvelope(),
  );
  assert.equal(canonical.status, "candidate");
  if (canonical.status !== "candidate") return;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-manifest-v2-"));
  try {
    const legacy = path.join(root, "90_Release");
    fs.mkdirSync(legacy, { recursive: true });
    fs.writeFileSync(
      path.join(legacy, "coordinator-package-manifest.json"),
      canonical.canonicalBytes,
    );
    assert.deepEqual(
      loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerification(root)
        .envelope,
      fixtureEnvelope(),
    );
    assert.deepEqual(
      loadHistoricalReleaseManifestEnvelopeForVerification(root).envelope,
      fixtureEnvelope(),
    );
    assert.throws(() =>
      loadPlatformProvisionerManifestEnvelopeForVerification(root),
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("履歴Recoveryは新旧manifest配置のexact一方だけを受理する", () => {
  const canonical = canonicalizeProvisioningJsonValueCandidate(
    fixtureEnvelope(),
  );
  assert.equal(canonical.status, "candidate");
  if (canonical.status !== "candidate") return;
  withDistribution(canonical.canonicalBytes, (root) => {
    assert.deepEqual(
      loadHistoricalReleaseManifestEnvelopeForVerification(root).envelope,
      fixtureEnvelope(),
    );
    const historical = path.join(root, "90_Release");
    fs.mkdirSync(historical, { recursive: true });
    fs.writeFileSync(
      path.join(historical, "coordinator-package-manifest.json"),
      canonical.canonicalBytes,
    );
    assert.throws(() =>
      loadHistoricalReleaseManifestEnvelopeForVerification(root),
    );
  });
  const emptyRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-historical-manifest-empty-"),
  );
  try {
    assert.throws(() =>
      loadHistoricalReleaseManifestEnvelopeForVerification(emptyRoot),
    );
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});

test("履歴Recoveryの全producerは新旧配置のexact-one loaderへ接続する", () => {
  for (const relativePath of [
    "src/security/docker-desktop-runtime-repair.ts",
    "src/security/docker-recovery-runtime-internal.ts",
  ]) {
    const source = fs.readFileSync(
      path.resolve(import.meta.dirname, "..", relativePath),
      "utf8",
    );
    assert.match(
      source,
      /loadHistoricalReleaseManifestEnvelopeForVerification/u,
    );
    assert.doesNotMatch(
      source,
      /loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerification/u,
    );
  }
});

function withDistribution(
  bytes: Buffer,
  verify: (distributionRoot: string) => void,
) {
  const distributionRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-manifest-loader-"),
  );
  try {
    const toolDistributionDirectory = path.join(
      distributionRoot,
      "template",
      "tools",
      "coordinator",
    );
    fs.mkdirSync(toolDistributionDirectory, { recursive: true });
    fs.writeFileSync(
      path.join(toolDistributionDirectory, "coordinator-package-manifest.json"),
      bytes,
    );
    verify(distributionRoot);
  } finally {
    fs.rmSync(distributionRoot, { recursive: true, force: true });
  }
}

test("固定Pathのcanonical manifest bytesだけを安定読込する", () => {
  const canonical = canonicalizeProvisioningJsonValueCandidate(
    fixtureEnvelope(),
  );
  assert.equal(canonical.status, "candidate");
  if (canonical.status !== "candidate") return;
  withDistribution(canonical.canonicalBytes, (distributionRoot) => {
    const inspected =
      inspectPlatformProvisionerManifestFileCandidate(distributionRoot);
    assert.equal(inspected.status, "candidate");
    assert.equal(inspected.canonicalManifestEncodingConfirmed, true);
    const loaded =
      loadPlatformProvisionerManifestEnvelopeForVerification(distributionRoot);
    assert.deepEqual(loaded.envelope, fixtureEnvelope());
    assert.equal("bytes" in loaded, false);
  });
});

test("非canonical JSON、BOM、相対Rootおよび欠落manifestを拒否する", () => {
  withDistribution(
    Buffer.from(`${JSON.stringify(fixtureEnvelope())}\n`),
    (root) => {
      assert.equal(
        inspectPlatformProvisionerManifestFileCandidate(root).status,
        "blocked",
      );
    },
  );
  withDistribution(
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("{}")]),
    (root) => {
      assert.equal(
        inspectPlatformProvisionerManifestFileCandidate(root).status,
        "blocked",
      );
    },
  );
  assert.equal(
    inspectPlatformProvisionerManifestFileCandidate("relative").status,
    "blocked",
  );
  const emptyRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-manifest-empty-"),
  );
  try {
    assert.equal(
      inspectPlatformProvisionerManifestFileCandidate(emptyRoot).status,
      "blocked",
    );
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});
test("manifestの読込競合はHashと権限を発行せず対象descriptorを閉じる", (t) => {
  for (const failure of [
    "short-read",
    "opened-identity",
    "after-mtime",
    "path-identity",
  ] as const) {
    const canonical = canonicalizeProvisioningJsonValueCandidate(
      fixtureEnvelope(),
    );
    assert.equal(canonical.status, "candidate");
    if (canonical.status !== "candidate") return;
    withDistribution(canonical.canonicalBytes, (root) => {
      const target = path.join(
        root,
        "template",
        "tools",
        "coordinator",
        "coordinator-package-manifest.json",
      );
      const bytes = fs.readFileSync(target);
      const inspect = () =>
        inspectPlatformProvisionerManifestFileCandidate(root);
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
          "platform_provisioner_manifest_file_invalid",
        );
        assert.equal(result.manifestFileSha256, null);
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
    });
  }
});

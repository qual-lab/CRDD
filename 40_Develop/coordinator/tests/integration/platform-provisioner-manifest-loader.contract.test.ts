/**
 * coordinator:integration:platform-provisioner-manifest-loaderの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:platform-provisioner-manifest-loaderが所有する検証責務を実行する。
 * @trace AIT-IT-008
 * @level IT
 * @scope platform、provisioner、manifest、loader
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
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
} from "../../src/security/platform-provisioner-manifest-loader.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../../src/security/provisioning-signature-primitives.ts";

/**
 * fixtureEnvelopeのTest準備責務を実行する。
 *
 * @responsibility fixtureEnvelopeがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureEnvelopeを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
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

/**
 * 旧revision 2 manifestは旧固定Pathからだけ履歴確認用に読込するを検証する。
 *
 * @responsibility 旧revision 2 manifestは旧固定Pathからだけ履歴確認用に読込するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 旧revision 2 manifestは旧固定Pathからだけ履歴確認用に読込するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
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

/**
 * 履歴Recoveryは新旧manifest配置のexact一方だけを受理するを検証する。
 *
 * @responsibility 履歴Recoveryは新旧manifest配置のexact一方だけを受理するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 履歴Recoveryは新旧manifest配置のexact一方だけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
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

/**
 * 履歴Recoveryの全producerは新旧配置のexact-one loaderへ接続するを検証する。
 *
 * @responsibility 履歴Recoveryの全producerは新旧配置のexact-one loaderへ接続するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 履歴Recoveryの全producerは新旧配置のexact-one loaderへ接続するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
test("履歴Recoveryの全producerは新旧配置のexact-one loaderへ接続する", () => {
  for (const relativePath of [
    "src/security/docker-desktop-runtime-repair.ts",
    "src/security/docker-recovery-runtime-internal.ts",
  ]) {
    const source = fs.readFileSync(
      path.resolve(import.meta.dirname, "../..", relativePath),
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

/**
 * withDistributionのTest準備責務を実行する。
 *
 * @responsibility withDistributionがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace AIT-IT-008
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus withDistributionを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
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

/**
 * 固定Pathのcanonical manifest bytesだけを安定読込するを検証する。
 *
 * @responsibility 固定Pathのcanonical manifest bytesだけを安定読込するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Pathのcanonical manifest bytesだけを安定読込するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
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

/**
 * 非canonical JSON、BOM、相対Rootおよび欠落manifestを拒否するを検証する。
 *
 * @responsibility 非canonical JSON、BOM、相対Rootおよび欠落manifestを拒否するの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 非canonical JSON、BOM、相対Rootおよび欠落manifestを拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
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
/**
 * manifestの読込競合はHashと権限を発行せず対象descriptorを閉じるを検証する。
 *
 * @responsibility manifestの読込競合はHashと権限を発行せず対象descriptorを閉じるの合否判定を所有する。
 * @trace AIT-IT-008
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus manifestの読込競合はHashと権限を発行せず対象descriptorを閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
 */
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
      /**
       * inspectのTest準備責務を実行する。
       *
       * @responsibility inspectがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
       * @trace AIT-IT-008
       * @precondition 呼出し元Test Caseが必要な入力を渡す。
       * @stimulus inspectを呼び出す。
       * @observation 返却値、生成fixtureまたは観測値を取得する。
       * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
       * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
       * @boundary Direct Boundary: Key Capability→Secret Buffer observer→Signer→Publisher結果
       */
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

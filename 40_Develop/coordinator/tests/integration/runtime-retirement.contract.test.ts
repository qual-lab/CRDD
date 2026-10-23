/**
 * 退役したRuntime署名方式を通常実行へ再導入しない。
 *
 * @packageDocumentation
 * @responsibility 旧入口の物理不存在と現在の利用側の非依存を確認する。
 * @trace ERB-IT-004
 * @level IT
 * @scope 現在Checkoutの旧18Pathと通常入口・Task・NativeのSource。
 * @boundary 前提配置だけ。歴史Evidenceや実隔離の成立は判定しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const retiredRuntimeFiles = [
  "scripts/generate-release-key.ts",
  "scripts/prepare-release-runtime.ts",
  "scripts/prepare-release-candidate.ts",
  "scripts/sign-release-terminal.ts",
  "scripts/sign-release-manifest.ts",
  "scripts/promote-release-manifest.ts",
  "scripts/release-staging-manifest.ts",
  "scripts/release-manifest-promotion.ts",
  "scripts/check-runtime-capability-graph.ts",
  "src/platform-access/package-verification.ts",
  "src/platform-access/manifest-loader.ts",
  "src/platform-access/manifest-trust.ts",
  "src/platform-access/release-trust.ts",
  "src/platform-access/policy-identity.ts",
  "src/platform-access/signature-primitives.ts",
  "src/platform-access/key-storage-policy.ts",
  "src/platform-access/package-gate.ts",
  "src/platform-access/release-identity.ts",
] as const;

/**
 * 廃止した署名Tool・Manifest／配布graphを現在Treeに残さない。
 *
 * @responsibility 名前だけ隠した旧実装を通常Sourceとして保持しない。
 * @trace ERB-IT-004
 * @precondition 現在Checkoutを読み取れる。
 * @stimulus 固定18Pathをlstatする。
 * @observation 各Pathの明示的ENOENT。
 * @oracle 観測不能を不存在へ丸めず、他のerrorでは失敗する。
 * @cleanup N/A: 読取りだけ。
 * @boundary 現在Treeだけが対象でGit履歴・過去Evidenceは変更しない。
 */
test("旧Runtime署名方式の十八入口は現在Treeに存在しない", () => {
  for (const relative of retiredRuntimeFiles) {
    assert.throws(
      () =>
        fs.lstatSync(new URL(["../../", relative].join(""), import.meta.url)),
      { code: "ENOENT" },
      relative,
    );
  }
});

/**
 * 通常入口とTask／Nativeが旧署名資格・履歴loaderを使わない。
 *
 * @responsibility 旧module削除後も現在Sourceへの再導入反証を維持する。
 * @trace ERB-IT-004
 * @precondition 実際の現在Sourceを読み取る。
 * @stimulus 固定した通常利用側の旧import・旧API名を確認する。
 * @observation 旧依存の不存在。
 * @oracle 現在Sourceの非依存を確認し、実起動やEffect 0の証明へ拡張しない。
 * @cleanup N/A: 読取りだけ。
 * @boundary 利用側の配置回帰。任意Sourceの安全性の証明ではない。
 */
test("現在の通常入口・Task回復・Nativeは旧署名資格と履歴loaderへ依存しない", () => {
  for (const relative of [
    "bin/coordinator.ts",
    "src/cli/command.ts",
    "src/index.ts",
    "src/execution/recovery.ts",
    "src/execution/diagnostics.ts",
    "src/execution/authority.ts",
    "src/execution/authority.ts",
  ]) {
    const source = fs.readFileSync(
      new URL(["../../", relative].join(""), import.meta.url),
      "utf8",
    );
    assert.doesNotMatch(
      source,
      /(?:package-verification|manifest-loader|manifest-trust|release-trust|policy-identity|signature-primitives|key-storage-policy|package-gate|release-identity)\.ts/u,
      relative,
    );
    assert.doesNotMatch(
      source,
      /issueRuntimeOwnedVerifiedCoordinatorPackageCapability|consumeRuntimeOwnedVerifiedCoordinatorPackageCapability|revokeRuntimeOwnedVerifiedCoordinatorPackageCapability|createIsolatedVerifiedPackageCapabilityStateCandidate|loadHistoricalReleaseManifestEnvelopeForVerification|loadHistoricalV2PlatformProvisionerManifestEnvelopeForVerification/u,
      relative,
    );
  }
});

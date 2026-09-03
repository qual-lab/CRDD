import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  beginReleaseManifestPromotionSession,
  describeReleaseManifestPromotionContract,
  discardPromotedReleaseManifestBytes,
  promoteReleaseManifestBytes,
  ReleaseManifestPromotionError,
} from "../scripts/release-manifest-promotion.ts";
import { promoteVerifiedReleaseManifest } from "../scripts/promote-release-manifest.ts";

const manifestRelativePath = path.join(
  "template",
  "tools",
  "coordinator",
  "coordinator-package-manifest.json",
);

function fixture(bytes = Buffer.from('{"exact":true}', "utf8")) {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-promotion-"));
  const sourceRoot = path.join(parent, "source");
  const destinationRoot = path.join(parent, "destination");
  const sourceManifest = path.join(sourceRoot, manifestRelativePath);
  const destinationManifest = path.join(destinationRoot, manifestRelativePath);
  fs.mkdirSync(path.dirname(sourceManifest), { recursive: true });
  fs.mkdirSync(path.dirname(destinationManifest), { recursive: true });
  fs.writeFileSync(sourceManifest, bytes);
  return {
    parent,
    sourceRoot,
    destinationRoot,
    sourceManifest,
    destinationManifest,
    bytes,
  };
}

test("署名済みManifestを不透明なbyte列として末尾改変なく昇格する", () => {
  const value = fixture();
  try {
    const session = beginReleaseManifestPromotionSession(
      value.sourceRoot,
      value.destinationRoot,
    );
    assert.ok(session);
    const result = promoteReleaseManifestBytes(session.token);
    assert.equal(result.status, "promoted");
    assert.equal(result.byteLength, value.bytes.length);
    assert.deepEqual(fs.readFileSync(value.destinationManifest), value.bytes);
    assert.equal(discardPromotedReleaseManifestBytes(session.token), true);
    assert.equal(fs.existsSync(value.destinationManifest), false);
    assert.deepEqual(describeReleaseManifestPromotionContract(), {
      contract: "crdd-coordinator/release-manifest-promotion",
      contractRevision: 1,
      manifestRelativePath:
        "template/tools/coordinator/coordinator-package-manifest.json",
      sourceTreatment: "opaque_stable_bytes",
      destinationWrite: "exclusive_same_bytes_and_hash",
      partialWriteCleanup: "exact_owned_file_only",
      postconditionFailureCleanup: "exact_unchanged_promoted_file_only",
      textParsingOrSerializationDuringPromotion: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    });
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("既存の昇格先、偽造token、または開始後に変わったsourceをEffect前に拒否する", () => {
  const existing = fixture();
  try {
    fs.writeFileSync(existing.destinationManifest, "existing");
    assert.equal(
      beginReleaseManifestPromotionSession(
        existing.sourceRoot,
        existing.destinationRoot,
      ),
      null,
    );
    assert.throws(
      () => promoteReleaseManifestBytes({}),
      (error: unknown) =>
        error instanceof ReleaseManifestPromotionError &&
        !error.repositoryFilesystemEffectIssued &&
        error.cleanupConfirmed,
    );
  } finally {
    fs.rmSync(existing.parent, { recursive: true, force: true });
  }

  const changed = fixture();
  try {
    const session = beginReleaseManifestPromotionSession(
      changed.sourceRoot,
      changed.destinationRoot,
    );
    assert.ok(session);
    fs.writeFileSync(changed.sourceManifest, '{"changed":true}');
    assert.throws(
      () => promoteReleaseManifestBytes(session.token),
      (error: unknown) =>
        error instanceof ReleaseManifestPromotionError &&
        !error.repositoryFilesystemEffectIssued &&
        error.cleanupConfirmed,
    );
    assert.equal(fs.existsSync(changed.destinationManifest), false);
  } finally {
    fs.rmSync(changed.parent, { recursive: true, force: true });
  }
});

test("自身が書いたsource prefixだけが残る失敗はexactな所有fileを回収する", {
  concurrency: false,
}, () => {
  const value = fixture(Buffer.from('{"long":"fixed-source-bytes"}', "utf8"));
  const originalWriteSync = fs.writeSync;
  try {
    const session = beginReleaseManifestPromotionSession(
      value.sourceRoot,
      value.destinationRoot,
    );
    assert.ok(session);
    let writes = 0;
    fs.writeSync = ((
      descriptor: number,
      buffer: Buffer,
      offset: number,
      length: number,
      position: number,
    ) => {
      writes += 1;
      if (writes === 1) {
        const partialLength = Math.max(1, Math.floor(length / 2));
        return originalWriteSync(
          descriptor,
          buffer,
          offset,
          partialLength,
          position,
        );
      }
      return 0;
    }) as unknown as typeof fs.writeSync;
    assert.throws(
      () => promoteReleaseManifestBytes(session.token),
      (error: unknown) =>
        error instanceof ReleaseManifestPromotionError &&
        error.repositoryFilesystemEffectIssued &&
        error.cleanupConfirmed,
    );
    assert.equal(fs.existsSync(value.destinationManifest), false);
  } finally {
    fs.writeSync = originalWriteSync;
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("昇格中に内容を変えられたfileは削除せずcleanup未確認にする", {
  concurrency: false,
}, () => {
  const value = fixture(Buffer.from('{"long":"fixed-source-bytes"}', "utf8"));
  const originalFsyncSync = fs.fsyncSync;
  try {
    const session = beginReleaseManifestPromotionSession(
      value.sourceRoot,
      value.destinationRoot,
    );
    assert.ok(session);
    let mutated = false;
    fs.fsyncSync = ((descriptor: number) => {
      originalFsyncSync(descriptor);
      if (!mutated) {
        mutated = true;
        fs.writeSync(descriptor, Buffer.from("x"), 0, 1, value.bytes.length);
      }
    }) as typeof fs.fsyncSync;
    assert.throws(
      () => promoteReleaseManifestBytes(session.token),
      (error: unknown) =>
        error instanceof ReleaseManifestPromotionError &&
        error.repositoryFilesystemEffectIssued &&
        !error.cleanupConfirmed,
    );
    assert.equal(fs.existsSync(value.destinationManifest), true);
  } finally {
    fs.fsyncSync = originalFsyncSync;
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

test("production昇格入口はGit CLIやtext再serializeを使わず署名・Tree・Native・HEADを再検証する", () => {
  assert.equal(typeof promoteVerifiedReleaseManifest, "function");
  const source = fs.readFileSync(
    path.resolve(import.meta.dirname, "../scripts/promote-release-manifest.ts"),
    "utf8",
  );
  assert.doesNotMatch(source, /node:child_process|\b(?:spawn|execFile)Sync\b/u);
  assert.doesNotMatch(source, /JSON\.stringify\([^\n]*envelope|writeFileSync/u);
  for (const required of [
    "verifyHistoricalPlatformProvisionerManifestCandidate",
    "inspectVerifiedNativeDistributionCandidate",
    "inspectPlatformProvisionerReleaseIdentityCandidate",
    "inspectRepositoryIdentityCandidate",
    "beginReleaseManifestPromotionSession",
    "promoteReleaseManifestBytes",
    "discardPromotedReleaseManifestBytes",
  ])
    assert.equal(source.includes(required), true, required);
});

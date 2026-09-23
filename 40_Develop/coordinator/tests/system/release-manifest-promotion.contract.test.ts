/**
 * coordinator:system:release-manifest-promotionの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility 署名済み固定SnapshotからManifest昇格と明示破棄までのSystem契約を検証する。
 * @trace AIT-ST-010
 * @level ST
 * @scope release、signed-snapshot、manifest、promotion、discard、recovery
 * @boundary AIT-ST-010=System/E2E: 単一Snapshot→署名済みDistribution→Manifest配置→promotion→明示破棄
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  executeVerifiedReleaseManifestPromotionForVerification,
  resolveReleaseManifestPromotionTopologyForVerification,
} from "../../scripts/promote-release-manifest.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "../..");
const repositoryRoot = path.resolve(coordinatorRoot, "../..");
const manifestRelativePath = path.join(
  "template",
  "tools",
  "coordinator",
  "coordinator-package-manifest.json",
);
const isReleaseManifestPresent = fs.existsSync(
  path.join(repositoryRoot, manifestRelativePath),
);
const manifestCarrierOnlySkipReason = isReleaseManifestPresent
  ? false
  : "Source AではRelease manifestを保持せず、Manifest-only Commit Bで実行する。";

type PromotionFixture = Readonly<{
  parent: string;
  destinationRoot: string;
  candidateRoot: string;
  candidateManifest: string;
  destinationManifest: string;
  evaluationTime: string;
  manifestBytes: Buffer;
  manifestSha256: string;
}>;

/**
 * 現行の署名済みManifestが指す固定Commitを一時Repositoryと候補へ再構成する。
 *
 * @responsibility 秘密鍵を使わず、署名済み固定Snapshotと配置先Repositoryを決定論的に用意する。
 * @trace AIT-ST-010
 * @precondition Repositoryの現行Manifestが参照するCommitとTreeがGit履歴に存在する。
 * @stimulus Manifest payloadのCommitを一時Repositoryと候補Directoryへ展開する。
 * @observation Snapshot Identity、Manifest bytes、Hash、候補Pathおよび配置先Pathを返す。
 * @oracle 候補はManifestが参照する固定Commitに現行署名済みManifestだけを加えたDistributionになる。
 * @cleanup 呼出し元がparent以下を再帰削除する。
 * @boundary AIT-ST-010=System/E2E: Git履歴→固定Distribution→一時Repository
 */
function fixture(): PromotionFixture {
  const envelope = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, manifestRelativePath), "utf8"),
  ) as { payload: { crddCommit: string; issuedAt: string; expiresAt: string } };
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-release-system-"));
  const destinationRoot = path.join(parent, "repository");
  execFileSync(
    "C:\\Program Files\\Git\\cmd\\git.exe",
    ["clone", "--quiet", "--no-checkout", repositoryRoot, destinationRoot],
    { windowsHide: true, stdio: "ignore" },
  );
  execFileSync(
    "C:\\Program Files\\Git\\cmd\\git.exe",
    [
      "-C",
      destinationRoot,
      "checkout",
      "--quiet",
      "--detach",
      envelope.payload.crddCommit,
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  const candidateRoot = path.join(
    destinationRoot,
    ".crdd",
    "release",
    "candidate-system",
  );
  const archive = path.join(parent, "candidate.tar");
  fs.mkdirSync(candidateRoot, { recursive: true });
  execFileSync(
    "C:\\Program Files\\Git\\cmd\\git.exe",
    [
      "-C",
      repositoryRoot,
      "archive",
      "--format=tar",
      `--output=${archive}`,
      envelope.payload.crddCommit,
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  execFileSync("tar", ["-xf", archive, "-C", candidateRoot], {
    windowsHide: true,
    stdio: "ignore",
  });
  const manifestBytes = fs.readFileSync(
    path.join(repositoryRoot, manifestRelativePath),
  );
  const candidateManifest = path.join(candidateRoot, manifestRelativePath);
  fs.mkdirSync(path.dirname(candidateManifest), { recursive: true });
  fs.writeFileSync(candidateManifest, manifestBytes, { flag: "wx" });
  return Object.freeze({
    parent,
    destinationRoot,
    candidateRoot,
    candidateManifest,
    destinationManifest: path.join(destinationRoot, manifestRelativePath),
    evaluationTime: envelope.payload.issuedAt,
    manifestBytes,
    manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
  });
}

/**
 * 署名済み固定Snapshotを同一file objectで昇格し明示破棄後は最終Pathだけを残す。
 *
 * @responsibility 正常な署名済みDistributionの昇格、同一file object、Hash一致および明示破棄を検証する。
 * @trace AIT-ST-010
 * @precondition 署名済みManifestが指す固定Commitから候補と配置先Repositoryを構成する。
 * @stimulus 実運用CompositionでManifestを昇格し、その後に候補Directoryを明示破棄する。
 * @observation Snapshot、Manifest Hash、file identity、配置Effect、staging状態および破棄後状態を観測する。
 * @oracle 昇格時は候補と最終Pathが同一file objectかつ同一Hashで、破棄後は最終Pathだけが残る。
 * @cleanup 一時Repository全体を削除する。
 * @boundary AIT-ST-010=System/E2E: 署名済みDistribution→promotion→明示破棄
 */
test("署名済み固定Snapshotを昇格し明示破棄後は最終Pathだけを残す", {
  skip: manifestCarrierOnlySkipReason,
}, () => {
  const value = fixture();
  try {
    const result = executeVerifiedReleaseManifestPromotionForVerification(
      value.candidateRoot,
      value.destinationRoot,
      value.evaluationTime,
    );
    assert.equal(result.status, "promoted");
    assert.equal(result.manifestFileSha256, value.manifestSha256);
    assert.equal(result.repositoryFilesystemEffectIssued, true);
    assert.equal(
      result.stagingManifestDisposition,
      "retained_for_explicit_staging_discard",
    );
    const source = fs.lstatSync(value.candidateManifest, { bigint: true });
    const destination = fs.lstatSync(value.destinationManifest, {
      bigint: true,
    });
    assert.equal(source.dev, destination.dev);
    assert.equal(source.ino, destination.ino);
    assert.deepEqual(
      fs.readFileSync(value.destinationManifest),
      value.manifestBytes,
    );

    fs.rmSync(value.candidateRoot, { recursive: true });
    assert.equal(fs.existsSync(value.candidateRoot), false);
    assert.deepEqual(
      fs.readFileSync(value.destinationManifest),
      value.manifestBytes,
    );
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

/**
 * 対象欠落と別Snapshot混入を配置Effect前に拒否する。
 *
 * @responsibility 署名対象集合の欠落と固定Snapshotの途中変更を正常昇格へ畳まない。
 * @trace AIT-ST-010
 * @precondition 正常な署名済み固定Snapshotを二組構成する。
 * @stimulus 一方は対象Fileを削除し、他方は対象Fileを書き換えて昇格を要求する。
 * @observation 拒否理由、最終Manifest不存在および候補残存を観測する。
 * @oracle 両反例を拒否し、配置先Manifest Effect 0のまま候補を回復判断用に保持する。
 * @cleanup 各一時Repository全体を削除する。
 * @boundary AIT-ST-010=System/E2E: 署名対象集合／Snapshot整合→promotion Gate
 */
test("対象欠落と別Snapshot混入を配置Effect前に拒否する", {
  skip: manifestCarrierOnlySkipReason,
}, () => {
  for (const mode of ["missing", "mixed"] as const) {
    const value = fixture();
    try {
      const target = path.join(
        value.candidateRoot,
        "40_Develop",
        "coordinator",
        "src",
        "index.ts",
      );
      if (mode === "missing") fs.rmSync(target);
      else fs.appendFileSync(target, "\n// mixed snapshot\n");
      assert.throws(
        () =>
          executeVerifiedReleaseManifestPromotionForVerification(
            value.candidateRoot,
            value.destinationRoot,
            value.evaluationTime,
          ),
        /release_manifest_promotion_/u,
      );
      assert.equal(fs.existsSync(value.destinationManifest), false);
      assert.equal(fs.existsSync(value.candidateManifest), true);
    } finally {
      fs.rmSync(value.parent, { recursive: true, force: true });
    }
  }
});

/**
 * 配置先外の候補Rootを公開昇格Topologyとして受理しない。
 *
 * @responsibility Distribution Root差を候補配置Effect前に拒否する。
 * @trace AIT-ST-010
 * @precondition 署名済み候補と配置先Repositoryを構成する。
 * @stimulus 候補を配置先のRepository-local staging外へ移したTopologyを解決する。
 * @observation Topology拒否と配置先Manifest不存在を観測する。
 * @oracle Repository-local staging外の候補を拒否し配置Effectを発行しない。
 * @cleanup 一時Repository全体を削除する。
 * @boundary AIT-ST-010=System/E2E: Distribution Root→公開promotion入口
 */
test("配置先外の候補Rootを公開昇格Topologyとして受理しない", {
  skip: manifestCarrierOnlySkipReason,
}, () => {
  const value = fixture();
  try {
    const outside = path.join(value.parent, "outside-candidate");
    fs.renameSync(value.candidateRoot, outside);
    assert.throws(
      () =>
        resolveReleaseManifestPromotionTopologyForVerification(
          outside,
          value.destinationRoot,
        ),
      /release_manifest_promotion_execution_source_invalid/u,
    );
    assert.equal(fs.existsSync(value.destinationManifest), false);
  } finally {
    fs.rmSync(value.parent, { recursive: true, force: true });
  }
});

/**
 * coordinator:integration:platform-access-releaseの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:platform-access-releaseが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @level IT
 * @scope platform、access、release
 * @boundary Direct Boundary: Adapter→実CLI・Process・Container
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  beginPlatformAccessArtifactSigningObservation,
  describePlatformAccessReleaseContract,
  observePlatformAccessReleaseArtifactCandidate,
  verifyPlatformAccessArtifactSigningObservation,
} from "../../src/security/platform-access-release.ts";

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Adapter→実CLI・Process・Container
 */
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-platform-release-"));
  const executablePath = path.join(
    root,
    ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
  );
  fs.mkdirSync(path.dirname(executablePath), { recursive: true });
  const bytes = Buffer.from("fixed-platform-access-binary", "ascii");
  fs.writeFileSync(executablePath, bytes);
  return { root, executablePath, bytes };
}

/**
 * 固定release PathのRust成果物を同一handleでHashへ結合するを検証する。
 *
 * @responsibility 固定release PathのRust成果物を同一handleでHashへ結合するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定release PathのRust成果物を同一handleでHashへ結合するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Adapter→実CLI・Process・Container
 */
test("固定release PathのRust成果物を同一handleでHashへ結合する", () => {
  const value = fixture();
  try {
    const observed = observePlatformAccessReleaseArtifactCandidate(value.root);
    assert.equal(observed.status, "candidate");
    assert.equal(observed.artifact?.byteLength, value.bytes.length);
    assert.equal(
      observed.artifact?.sha256,
      createHash("sha256").update(value.bytes).digest("hex"),
    );
    assert.equal(observed.absolutePathReported, false);
    const signingObservation = beginPlatformAccessArtifactSigningObservation(
      value.root,
    );
    assert.notEqual(signingObservation, null);
    assert.equal(
      signingObservation &&
        verifyPlatformAccessArtifactSigningObservation(
          signingObservation.token,
        ),
      true,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * 欠落fileおよび署名観測後のfileとRoot置換を拒否するを検証する。
 *
 * @responsibility 欠落fileおよび署名観測後のfileとRoot置換を拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 欠落fileおよび署名観測後のfileとRoot置換を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Adapter→実CLI・Process・Container
 */
test("欠落fileおよび署名観測後のfileとRoot置換を拒否する", () => {
  const value = fixture();
  try {
    const observed = observePlatformAccessReleaseArtifactCandidate(value.root);
    assert.equal(observed.status, "candidate");
    const signingObservation = beginPlatformAccessArtifactSigningObservation(
      value.root,
    );
    assert.notEqual(signingObservation, null);
    fs.writeFileSync(value.executablePath, "changed");
    assert.equal(
      signingObservation &&
        verifyPlatformAccessArtifactSigningObservation(
          signingObservation.token,
        ),
      false,
    );
    fs.rmSync(value.executablePath);
    assert.equal(
      observePlatformAccessReleaseArtifactCandidate(value.root).status,
      "blocked",
    );
    const replacement = `${value.root}-replacement`;
    fs.renameSync(value.root, replacement);
    fs.mkdirSync(value.root);
    assert.equal(
      signingObservation &&
        verifyPlatformAccessArtifactSigningObservation(
          signingObservation.token,
        ),
      false,
    );
    fs.rmSync(value.root, { recursive: true, force: true });
    fs.renameSync(replacement, value.root);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * release contractは固定targetと非公開process境界を示すを検証する。
 *
 * @responsibility release contractは固定targetと非公開process境界を示すの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus release contractは固定targetと非公開process境界を示すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: Adapter→実CLI・Process・Container
 */
test("release contractは固定targetと非公開process境界を示す", () => {
  const contract = describePlatformAccessReleaseContract();
  assert.equal(
    contract.artifactRelativePath,
    PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  );
  assert.equal(contract.target, "x86_64-pc-windows-msvc");
  assert.equal(contract.protocolRevision, 3);
  assert.equal(contract.signedManifestBinding, "implemented_candidate");
  assert.equal(contract.pathEnvironmentLookup, false);
  assert.equal(contract.artifactObservationFilesystemEffectIssued, false);
  assert.equal(contract.runtimeAuthorityConferred, false);
  assert.equal(contract.runtimeCapabilityIssued, false);
});

/**
 * platform-access:integration:artifact-identity-observationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility platform-access:integration:artifact-identity-observationが所有する検証責務を実行する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope platform、access、artifact、identity-observation
 * @boundary ERB-IT-001／ERB-IT-002=Direct Boundary: Platform Access Node公開入口→実Filesystem観測。合成バイナリを使用し実Nativeは実行しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import test from "node:test";
import * as platformAccess from "../../src/index.ts";

import {
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
  beginPlatformAccessArtifactObservation,
  beginPlatformAccessBootstrapObservation,
  PLATFORM_ACCESS_TARGET,
  PLATFORM_ACCESS_PROTOCOL_REVISION,
  observePlatformAccessArtifactCandidate,
  verifyPlatformAccessArtifactObservation,
} from "../../src/index.ts";

/**
 * fixtureのTest準備責務を実行する。
 *
 * @responsibility fixtureがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus fixtureを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001／ERB-IT-002=Direct Boundary: Platform Access Test Source→実FilesystemのArtifact同一性観測
 */
function fixture() {
  const repositoryRoot = fileURLToPath(new URL("../../../..", import.meta.url));
  const testsRoot = path.join(repositoryRoot, ".crdd", "tests");
  for (const directory of [path.join(repositoryRoot, ".crdd"), testsRoot]) {
    if (!fs.existsSync(directory)) fs.mkdirSync(directory);
    assert.equal(fs.lstatSync(directory).isSymbolicLink(), false);
    assert.equal(fs.lstatSync(directory).isDirectory(), true);
    assert.equal(fs.realpathSync.native(directory), directory);
  }
  const root = fs.mkdtempSync(path.join(testsRoot, "native-artifact-"));
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
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→実FilesystemのArtifact同一性観測
 */
test("固定release PathのRust成果物を同一handleでHashへ結合する", () => {
  const value = fixture();
  try {
    const observed = observePlatformAccessArtifactCandidate(value.root);
    assert.equal(observed.status, "candidate");
    assert.equal(observed.artifact?.byteLength, value.bytes.length);
    assert.equal(
      observed.artifact?.sha256,
      createHash("sha256").update(value.bytes).digest("hex"),
    );
    assert.equal(observed.absolutePathReported, false);
    const artifactObservation = beginPlatformAccessArtifactObservation(
      value.root,
    );
    assert.notEqual(artifactObservation, null);
    assert.equal(
      artifactObservation &&
        verifyPlatformAccessArtifactObservation(artifactObservation.token),
      true,
    );
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * 通常Bootstrap確認を固定Hashと元観測tokenへ限定する。
 * @responsibility Gitのない試験Rootでも固定実物だけを受理し、差替えを拒否する。
 * @trace ERB-IT-001
 * @precondition Repository内の自己生成Rootと採用済みNativeを使う。
 * @stimulus 合成bytes、固定実物、欠落、同長変更、Root置換を与える。
 * @observation helper結果と同tokenの再確認結果を読む。
 * @oracle 固定Hashだけ受理し、内容差・欠落・Root差は拒否する。
 * @cleanup 自己生成Rootだけを回収する。
 * @boundary PA固定Bootstrap確認→実Filesystem。Native起動なし。
 */
test("通常Bootstrapは固定実物だけを受理しGitやHEADを要求しない", () => {
  const value = fixture();
  const moved = `${value.root}-moved`;
  try {
    assert.equal(beginPlatformAccessBootstrapObservation(value.root), null);
    const repositoryRoot = fileURLToPath(
      new URL("../../../..", import.meta.url),
    );
    const bytes = fs.readFileSync(
      path.join(
        repositoryRoot,
        ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
      ),
    );
    fs.writeFileSync(value.executablePath, bytes);
    assert.equal(fs.existsSync(path.join(value.root, ".git")), false);
    const observed = beginPlatformAccessBootstrapObservation(value.root);
    assert.ok(observed);
    assert.equal(verifyPlatformAccessArtifactObservation(observed.token), true);
    const changed = Buffer.from(bytes);
    changed[0] = (changed[0] ?? 0) ^ 1;
    fs.writeFileSync(value.executablePath, changed);
    assert.equal(beginPlatformAccessBootstrapObservation(value.root), null);
    assert.equal(
      verifyPlatformAccessArtifactObservation(observed.token),
      false,
    );
    fs.writeFileSync(value.executablePath, bytes);
    const replacement = beginPlatformAccessBootstrapObservation(value.root);
    assert.ok(replacement);
    fs.renameSync(value.root, moved);
    fs.mkdirSync(value.root);
    assert.equal(
      verifyPlatformAccessArtifactObservation(replacement.token),
      false,
    );
    assert.equal(beginPlatformAccessBootstrapObservation(value.root), null);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
    fs.rmSync(moved, { recursive: true, force: true });
  }
});

/**
 * 欠落fileおよびArtifact観測後のfileとRoot置換を拒否するを検証する。
 *
 * @responsibility 欠落fileおよびArtifact観測後のfileとRoot置換を拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 欠落fileおよびArtifact観測後のfileとRoot置換を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Test Source→実FilesystemのArtifact同一性観測
 */
test("欠落fileおよびArtifact観測後のfileとRoot置換を拒否する", () => {
  const value = fixture();
  try {
    const observed = observePlatformAccessArtifactCandidate(value.root);
    assert.equal(observed.status, "candidate");
    const artifactObservation = beginPlatformAccessArtifactObservation(
      value.root,
    );
    assert.notEqual(artifactObservation, null);
    fs.writeFileSync(value.executablePath, "changed");
    assert.equal(
      artifactObservation &&
        verifyPlatformAccessArtifactObservation(artifactObservation.token),
      false,
    );
    fs.rmSync(value.executablePath);
    assert.equal(
      observePlatformAccessArtifactCandidate(value.root).status,
      "blocked",
    );
    const replacement = `${value.root}-replacement`;
    fs.renameSync(value.root, replacement);
    fs.mkdirSync(value.root);
    assert.equal(
      artifactObservation &&
        verifyPlatformAccessArtifactObservation(artifactObservation.token),
      false,
    );
    fs.rmSync(value.root, { recursive: true, force: true });
    fs.renameSync(replacement, value.root);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * Artifact公開契約の固定target・Protocol・公開集合とAuthority非発行を検証する。
 *
 * @responsibility Artifact同一性観測の公開集合と非Authority境界を判定する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Root公開集合と合成Native成果物の同一性観測結果を取得する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Platform Access Node公開入口→実FilesystemのArtifact同一性観測
 */
test("Artifact公開契約は固定target・Protocol・用途固定公開集合とAuthority非発行を維持する", () => {
  assert.deepEqual(
    Object.keys(platformAccess).sort(),
    [
      "PLATFORM_ACCESS_EXECUTABLE_MAXIMUM_BYTES",
      "PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH",
      "PLATFORM_ACCESS_PROTOCOL_REVISION",
      "PLATFORM_ACCESS_RUST_TOOLCHAIN",
      "PLATFORM_ACCESS_TARGET",
      "WINDOWS_CHILD_ENVIRONMENT_CONTRACT",
      "WINDOWS_CHILD_ENVIRONMENT_CONTRACT_REVISION",
      "WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE",
      "beginPlatformAccessArtifactObservation",
      "beginPlatformAccessBootstrapObservation",
      "createInteractiveConsoleReaderEnvironment",
      "createWindowsHostOperationSupervisorEnvironment",
      "createWindowsHostTerminalHelperEnvironment",
      "createWindowsNativeHelperEnvironment",
      "createWindowsNodeConsoleReaderEnvironment",
      "createWindowsPowerShellAuthenticodeEnvironment",
      "deriveWindowsSystemDrive",
      "describeWindowsChildEnvironmentContract",
      "observePlatformAccessArtifactCandidate",
      "observeSystemWindowsDirectory",
      "observeWindowsFilesystemEntry",
      "observeWindowsLocalAppDataDirectory",
      "startWindowsChildTreeTermination",
      "verifyPlatformAccessArtifactObservation",
    ].sort(),
  );
  assert.equal(PLATFORM_ACCESS_TARGET, "x86_64-pc-windows-msvc");
  assert.equal(PLATFORM_ACCESS_PROTOCOL_REVISION, 3);
  const value = fixture();
  try {
    const observed = observePlatformAccessArtifactCandidate(value.root);
    assert.equal(observed.runtimeAuthorityConferred, false);
    assert.equal(observed.runtimeCapabilityIssued, false);
    assert.equal(observed.filesystemEffectIssued, false);
    assert.equal("signedManifestBinding" in observed, false);
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
  }
});

/**
 * 偽Snapshotと不正Rootから観測結果やAuthorityを生成しない。
 * @responsibility opaqueな元Snapshotだけを再照合する境界を反証する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 自己生成Native fixtureと元観測がある。
 * @stimulus 元tokenのコピー・継承・空objectと不正Rootを渡す。
 * @observation 再照合結果、候補状態、公開field。
 * @oracle 元tokenだけ成立し、偽tokenと不正Rootは拒否、権限発行と絶対Path公開0。
 * @cleanup finallyでexact自己生成Rootを削除し不存在を確認する。
 * @boundary 公開Node APIと固定Filesystem観測。
 */
test("偽tokenと不正Rootを拒否しHashからAuthorityを発行しない", () => {
  const value = fixture();
  try {
    const observation = beginPlatformAccessArtifactObservation(value.root);
    assert.ok(observation);
    assert.equal(
      verifyPlatformAccessArtifactObservation(observation.token),
      true,
    );
    for (const token of [
      {},
      { ...observation.token },
      Object.create(observation.token),
      observation,
    ]) {
      assert.equal(verifyPlatformAccessArtifactObservation(token), false);
    }
    for (const root of [null, {}, "", "relative", "C:\\invalid\0root"]) {
      assert.equal(beginPlatformAccessArtifactObservation(root), null);
      const rejected = observePlatformAccessArtifactCandidate(root);
      assert.equal(rejected.status, "blocked");
      assert.equal(rejected.runtimeAuthorityConferred, false);
      assert.equal(rejected.runtimeCapabilityIssued, false);
      assert.equal(rejected.absolutePathReported, false);
    }
  } finally {
    fs.rmSync(value.root, { recursive: true, force: true });
    assert.equal(fs.existsSync(value.root), false);
  }
});

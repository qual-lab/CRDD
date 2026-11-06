/**
 * 固定技術構成の公開範囲とI/O不在を確認する。
 * @responsibility Image・実行位置を正本から取得しPolicy・Host同意を公開しない。
 * @trace ERB-UT-023
 * @level UT
 * @scope 固定構成のみ。実AI・Docker・Filesystem操作なし。
 * @boundary 実物・認証・通信許可の成立は対象外。
 * @packageDocumentation
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import * as imageAssets from "../../src/image/assets.ts";
import { describeIsolationConfiguration } from "../../src/index.ts";

/**
 * 両配置の実在する差と取得時I/O零を確認する。
 * @responsibility 固定構成と稼働可能性を混同しない。
 * @trace ERB-UT-023
 * @precondition import完了後にI/Oを拒否代役へ置換する。
 * @stimulus 両配置、無引数診断構成と未知Provider。
 * @observation 元値、凍結、I/O回数、Policy fieldの不存在。
 * @oracle 元Imageと配置を保持し、Policyと追加Hostを公開しない。
 * @cleanup 代役を試験終了時に解除する。
 * @boundary 純粋構成の確認。実環境の成立は別検証。
 */
test("固定構成はImage・配置だけを返しPolicy生成や実観測を含めない", (t) => {
  assert.equal(
    describeIsolationConfiguration,
    imageAssets.describeIsolationConfiguration,
  );
  let io = 0;
  /**
   * 予定外の依存呼出しを例外として検出する。
   * @responsibility 予定外の依存呼出しを例外として検出する
   * @trace ERB-UT-023
   * @precondition 固定構成のみ。実AI・Docker・Filesystem操作なし。
   * @stimulus 予定外の依存呼出しを例外として検出する。
   * @observation 構築した候補、有限応答または検出した例外。
   * @oracle 呼出し元の対照試験へ固定入力・観測を渡し、実処理の成功を捏造しない。
   * @cleanup 実資源の所有は呼出し元Caseに残し、構築した合成値自体に解放処理はない。
   * @boundary 実物・認証・通信許可の成立は対象外。
   */
  const unexpected = () => {
    io++;
    throw Error("unexpected_io");
  };
  t.mock.method(childProcess, "spawn", unexpected);
  t.mock.method(childProcess, "spawnSync", unexpected);
  t.mock.method(fs, "readFileSync", unexpected);
  t.mock.method(fs, "statSync", unexpected);
  t.mock.method(fs, "lstatSync", unexpected);
  for (const provider of ["codex", "claude"] as const) {
    const value = describeIsolationConfiguration(provider);
    assert.equal(
      value.assets,
      imageAssets.describeDockerProviderAssets(provider),
    );
    assert.deepEqual(
      value.locations.primary,
      imageAssets.describeDockerProviderExecutionLocations(provider, "primary"),
    );
    assert.equal(value.proxy, value.assets.proxy);
    assert.equal(Object.hasOwn(value, "networkPolicy"), false);
    assert.equal(Object.hasOwn(value, "additionalHosts"), false);
    assert.equal(Object.hasOwn(value.proxy, "allowedHostnames"), false);
    assert.ok(Object.isFrozen(value) && Object.isFrozen(value.locations));
    if (value.provider === "codex") {
      assert.deepEqual(
        value.locations.alternate,
        imageAssets.describeDockerProviderExecutionLocations(
          "codex",
          "alternate",
        ),
      );
      assert.notEqual(
        value.assets.fixedImageDigest,
        value.assets.alternateIdentity.fixedImageDigest,
      );
    } else {
      assert.equal(Object.hasOwn(value.locations, "alternate"), false);
      assert.equal(Object.hasOwn(value.assets, "alternateIdentity"), false);
    }
  }
  const diagnostic = describeIsolationConfiguration();
  assert.match(diagnostic.image, /@sha256:[a-f0-9]{64}$/u);
  assert.equal(diagnostic.runtimeProfile.networkMode, "none");
  for (const invalid of [null, "other", new Proxy({}, {})]) {
    assert.throws(
      () => describeIsolationConfiguration(invalid as never),
      /docker_isolation_configuration_invalid/u,
    );
  }
  assert.equal(io, 0);
});

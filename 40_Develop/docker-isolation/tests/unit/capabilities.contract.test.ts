/**
 * 固定技術構成の公開範囲とI/O不在を確認する。
 * @responsibility Image・実行位置を正本から取得しPolicy・Host同意を公開しない。
 * @trace ERB-UT-023
 * @level UT
 * @scope 固定構成のみ。実AI・Docker・Filesystem操作なし。
 * @boundary 実物・認証・通信許可の成立は対象外。
 */
import assert from "node:assert/strict";
import childProcess from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import {
  describeDockerProviderAssets,
  describeDockerProviderExecutionLocations,
} from "../../src/image/assets.ts";
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
  let io = 0;
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
    assert.equal(value.assets, describeDockerProviderAssets(provider));
    assert.deepEqual(
      value.locations.primary,
      describeDockerProviderExecutionLocations(provider, "primary"),
    );
    assert.equal(value.proxy, value.assets.proxy);
    assert.equal(Object.hasOwn(value, "networkPolicy"), false);
    assert.equal(Object.hasOwn(value, "additionalHosts"), false);
    assert.equal(Object.hasOwn(value.proxy, "allowedHostnames"), false);
    assert.ok(Object.isFrozen(value) && Object.isFrozen(value.locations));
    if (value.provider === "codex") {
      assert.deepEqual(
        value.locations.alternate,
        describeDockerProviderExecutionLocations("codex", "alternate"),
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

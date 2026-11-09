/**
 * Docker専用環境と共通OS観測の責務境界を確認する。
 * @packageDocumentation
 * @responsibility 用途固定の環境構成と観測不能時の停止を検証する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 固定観測値、別Node試験Process。Docker・Provider・実Native操作0。
 * @boundary Docker Isolation→Platform Accessの観測差替え境界。実OS成立は上位実環境試験へ保持。
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { runInNewContext } from "node:vm";
import * as dockerTrustOperations from "../../src/docker-cli/trust.ts";
import * as dockerIsolation from "../../src/index.ts";

/**
 * 署名確認用投影が共通環境の欠測を補完しないことを反証する。
 * @responsibility 共通環境の選択条件と専用五項目への投影を確認する。
 * @trace ERB-IT-001
 * @precondition 本番関数本文を合成の共通環境へ接続する。
 * @stimulus 基礎環境null、Windows所在欠測、Profile欠測、余分な親設定を与える。
 * @observation 選択引数、返却keyと凍結状態、元環境の不変性。
 * @oracle 欠測時はnull、正常時は固定五項目のみで親設定を搬送しない。
 * @cleanup N/A: メモリ内のみ。Process・Filesystem書込みは行わない。
 * @boundary 投影部分の局所反証。実OSの成立を主張しない。
 */
test("署名確認環境は共通観測の欠測を補完せず固定五項目だけ返す", () => {
  const source = readFileSync(
    new URL("../../src/docker-cli/environment.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export function createWindowsPowerShellAuthenticodeEnvironment(",
  );
  assert.ok(start > 0);
  const body = stripTypeScriptTypes(
    source.slice(start).replace(/^export /u, ""),
  );
  for (const base of [
    null,
    Object.freeze({ USERPROFILE: "D:\\Users\\fixture" }),
    Object.freeze({ SystemRoot: "D:\\Windows" }),
    Object.freeze({
      SystemRoot: "D:\\Windows",
      USERPROFILE: "D:\\Users\\fixture",
      PATH: "ambient-injected",
      NODE_OPTIONS: "ambient-injected",
    }),
  ]) {
    let calls = 0;
    const create = runInNewContext(`(${body}\n)`, {
      path,
      createChildProcessEnvironment: (options: object) => {
        calls += 1;
        assert.deepEqual(JSON.parse(JSON.stringify(options)), {
          platform: "win32",
          userProfile: true,
        });
        return base;
      },
    }) as () => Readonly<Record<string, string>> | null;
    const actual = create();
    assert.equal(calls, 1);
    if (!base || !("SystemRoot" in base) || !("USERPROFILE" in base)) {
      assert.equal(actual, null);
    } else {
      assert.ok(actual);
      assert.equal(Object.keys(actual).length, 5);
      assert.equal(Object.isFrozen(actual), true);
      assert.equal("NODE_OPTIONS" in actual, false);
      assert.equal(
        Object.getOwnPropertyDescriptor(base, "PATH")?.value,
        "ambient-injected",
      );
      assert.notEqual(actual.PATH, "ambient-injected");
    }
  }
});

/**
 * Docker実行物の固定Trust契約と既存Native Policy Hashの一致を確認する。
 * @responsibility 更新許容と操作中同一性を、通常Runtime署名Gateと区別して検証する。
 * @trace ERB-IT-001
 * @precondition 固定公開APIだけを読み、実環境検証は実行しない。
 * @stimulus 契約を取得し、既存ProtocolのPolicy本文からHashを独立計算する。
 * @observation 契約の全fieldと凍結状態を観測する。
 * @oracle 出所検査は維持し、操作をまたぐ版・Hash固定は要求しない。
 * @cleanup N/A: Process・Filesystem・Docker資源を作成しない。
 * @boundary Package Root→固定契約。実Publisher検査や実操作の成立は主張しない。
 */
test("実行物Trustは既存Policy Hashと操作内実体固定を維持する", () => {
  const contract = dockerTrustOperations.describeDockerArtifactTrustContract();
  assert.deepEqual(contract, {
    policySha256: createHash("sha256")
      .update(
        "CRDD_DOCKER_RESTART_TRUST_V1|official-fixed-paths|Docker Inc|cache-only|deny-write-delete|optional-dev-envs",
        "ascii",
      )
      .digest("hex"),
    officialFixedPathsRequired: true,
    publisherOrganization: "Docker Inc",
    authenticodeRequired: true,
    revocationMode: "cache_only",
    exactVersionRequired: false,
    exactHashRequiredAcrossOperations: false,
    sameIdentityAndHashRequiredWithinOperation: true,
  });
  assert.equal(Object.isFrozen(contract), true);
});

/**
 * 固定構成と三観測不能を別Processで反証する。
 * @responsibility null pair、絶対Path、NUL、署名確認の固定五項目、元環境不変と不明時の停止を判定する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 既存の用途固定PA観測だけをfixture内で差し替える。
 * @stimulus 正常、Console不能、Native不能、Drive不能の四状態を与える。
 * @observation fixtureのassertion、exit／signal、固定結果を取得する。
 * @oracle 公開集合は宣言と完全一致し、不正入力は観測前拒否、正常だけ固定構成、不能時にambient fallbackしない。
 * @cleanup 同期子Processの終了を確認し、File・Docker・Provider資源は作成しない。
 * @boundary 固定Node fixture→実環境構成関数。OS観測自体の実測とは区別する。
 */
test("Docker環境は固定四項目と用途別Driveを構成し観測不能を補完しない", () => {
  const expectedExports = ["prepareIsolation", "executeIsolation"].sort();
  const actualExports = Object.keys(dockerIsolation).sort();
  expectedExports.push(
    "describeIsolationConfiguration",
    "inspectDockerEnvironment",
    "restartDockerEnvironment",
    "cleanupIsolation",
    "inspectIsolation",
  );
  expectedExports.sort();
  assert.deepEqual(actualExports, expectedExports);
  assert.throws(() =>
    assert.deepEqual(
      [...actualExports, "unexpectedExport"].sort(),
      expectedExports,
    ),
  );
  assert.throws(() =>
    assert.deepEqual(actualExports.slice(1), expectedExports),
  );
  for (const scenario of [
    "normal",
    "console_unknown",
    "native_unknown",
    "drive_unknown",
  ]) {
    const observed = spawnSync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        fileURLToPath(
          new URL("../fixtures/cli-environment.ts", import.meta.url),
        ),
        scenario,
      ],
      {
        shell: false,
        encoding: "utf8",
        timeout: 5_000,
        maxBuffer: 64 * 1024,
        windowsHide: true,
      },
    );
    assert.equal(observed.error, undefined);
    assert.equal(observed.signal, null);
    assert.equal(observed.status, 0, observed.stderr);
    assert.deepEqual(JSON.parse(observed.stdout), {
      scenario,
      fixedEnvironmentVerified: true,
      realNativeOrDockerIssued: false,
    });
  }
});

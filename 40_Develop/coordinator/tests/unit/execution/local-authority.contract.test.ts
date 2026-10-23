/**
 * Local Personal許可元の現在Operation結合を検証する。
 *
 * @packageDocumentation
 * @responsibility 署名非依存、毎回のOperation確認、Profile結合と期限を固定する。
 * @trace PRL-UT-006
 * @level UT
 * @scope local、personal、authority、operation
 * @boundary PRL-UT-006=N/A: 許可判定は局所依存とProcess内の値に閉じる。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { reverifyAuthorityBeforeProviderLaunch } from "../../../src/execution/authority.ts";
import {
  createIsolatedLocalPersonalAuthorityRuntimeCandidate,
  describeLocalPersonalAuthorityRuntimeContract,
} from "../../../src/execution/authority.ts";

/**
 * 署名資格なしで全6 Profileを現在Operationへ結合する。
 *
 * @responsibility 現在Operationと許可元生成の境界を検証する。
 * @trace PRL-UT-006
 * @precondition 固定したBindingと局所依存を使用する。
 * @stimulus 全Profileを生成し、既存の起動前検査へ渡してcacheを再読する。
 * @observation 返却Source、Operation確認回数と値の相関を観測する。
 * @oracle Profile／Provider／Home／Egressの結合を保ち各loadで一回確認する。
 * @cleanup N/A: Process内の値だけを使用し外部資源を作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Operation確認→許可元生成。
 */
test("署名資格なしで全6 Profileを現在Operationへ結合する", () => {
  const management = Object.freeze({});
  let calls = 0;
  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: Date.now,
    verifyOperation: (binding, capability) => {
      calls += 1;
      return capability === management && binding.operationId === "OP-123456";
    },
  });
  for (const profileId of describeLocalPersonalAuthorityRuntimeContract()
    .profiles) {
    const provider = profileId.startsWith("PROFILE-1") ? "codex" : "claude";
    const binding = Object.freeze({
      operationId: "OP-123456",
      provider,
      profileId,
    });
    const source = runtime.load(binding, management);
    assert.ok(source);
    const verified = reverifyAuthorityBeforeProviderLaunch(
      source.profile,
      source.bundle,
      {
        ...binding,
        scopeId: `SCOPE-${profileId.slice("PROFILE-".length)}`,
        providerHomeMountGrantRef: "PHMGRANT-123456",
      },
    );
    assert.equal(verified.status, "candidate");
    assert.equal(verified.verification.provider, provider);
    assert.equal(verified.verification.profileId, profileId);
    assert.equal(verified.verification.operationId, binding.operationId);
    assert.equal(runtime.load(binding, management), source);
  }
  assert.equal(calls, 12);
});

/**
 * 期限内cacheでも偽管理参照・別Operation・失効を拒否する。
 *
 * @responsibility 現在Operationと許可元生成の境界を検証する。
 * @trace PRL-UT-006
 * @precondition 固定したBindingと局所依存を使用する。
 * @stimulus 同じcache keyへ不正参照と失効を与える。
 * @observation 返却Source、Operation確認回数と値の相関を観測する。
 * @oracle 拒否時はSourceを返さず確認を省略しない。
 * @cleanup N/A: Process内の値だけを使用し外部資源を作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Operation確認→許可元生成。
 */
test("期限内cacheでも偽管理参照・別Operation・失効を拒否する", () => {
  const management = Object.freeze({});
  const binding = Object.freeze({
    operationId: "OP-123456",
    provider: "claude",
    profileId: "PROFILE-200001",
  });
  let current = true;
  let calls = 0;
  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: Date.now,
    verifyOperation: (candidate, capability) => {
      calls += 1;
      return (
        current &&
        capability === management &&
        candidate.operationId === binding.operationId
      );
    },
  });
  assert.ok(runtime.load(binding, management));
  for (const invalid of [undefined, null, {}, new Proxy({}, {})])
    assert.equal(runtime.load(binding, invalid), null);
  assert.equal(
    runtime.load({ ...binding, operationId: "OP-654321" }, management),
    null,
  );
  current = false;
  assert.equal(runtime.load(binding, management), null);
  assert.equal(calls, 7);
});

/**
 * Operation確認はstrict trueだけを受理する。
 *
 * @responsibility 現在Operationと許可元生成の境界を検証する。
 * @trace PRL-UT-006
 * @precondition 固定したBindingと局所依存を使用する。
 * @stimulus 非boolean・false・例外を返す依存へ正規Bindingを渡す。
 * @observation 返却Source、Operation確認回数と値の相関を観測する。
 * @oracle 各依存を一回呼び不正結果をcacheや許可へ昇格しない。
 * @cleanup N/A: Process内の値だけを使用し外部資源を作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Operation確認→許可元生成。
 */
test("Operation確認はstrict trueだけを受理する", () => {
  const binding = {
    operationId: "OP-123456",
    provider: "claude",
    profileId: "PROFILE-200001",
  };
  for (const result of [false, undefined, null, 1, "true", Object.freeze({})]) {
    let calls = 0;
    const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
      wallNow: Date.now,
      verifyOperation: () => {
        calls += 1;
        return result as unknown as boolean;
      },
    });
    assert.equal(runtime.load(binding, {}), null);
    assert.equal(calls, 1);
  }
  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: Date.now,
    verifyOperation: () => {
      throw new Error("operation_observation_unknown");
    },
  });
  assert.equal(runtime.load(binding, {}), null);
});

/**
 * 不正Bindingと時計は許可元を生成しない。
 *
 * @responsibility 現在Operationと許可元生成の境界を検証する。
 * @trace PRL-UT-006
 * @precondition 固定したBindingと局所依存を使用する。
 * @stimulus Provider差・未知Profile・不正Operationと時計不正を与える。
 * @observation 返却Source、Operation確認回数と値の相関を観測する。
 * @oracle Sourceを返さず時計不正ではOperation確認も発行しない。
 * @cleanup N/A: Process内の値だけを使用し外部資源を作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Operation確認→許可元生成。
 */
test("不正Bindingと時計は許可元を生成しない", () => {
  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: Date.now,
    verifyOperation: () => true,
  });
  for (const binding of [
    {
      operationId: "OP-123456",
      provider: "codex",
      profileId: "PROFILE-200001",
    },
    {
      operationId: "OP-123456",
      provider: "claude",
      profileId: "PROFILE-999999",
    },
    { operationId: "invalid", provider: "claude", profileId: "PROFILE-200001" },
  ])
    assert.equal(runtime.load(binding, {}), null);
  for (const clock of [
    () => Number.NaN,
    () => -1,
    () => Infinity,
    () => {
      throw new Error("clock_unknown");
    },
  ]) {
    let calls = 0;
    const invalidClock = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
      wallNow: clock,
      verifyOperation: () => {
        calls += 1;
        return true;
      },
    });
    assert.equal(
      invalidClock.load(
        {
          operationId: "OP-123456",
          provider: "claude",
          profileId: "PROFILE-200001",
        },
        {},
      ),
      null,
    );
    assert.equal(calls, 0);
  }
});

/**
 * 許可元cacheは30秒境界で再生成する。
 *
 * @responsibility 現在Operationと許可元生成の境界を検証する。
 * @trace PRL-UT-006
 * @precondition 固定したBindingと局所依存を使用する。
 * @stimulus 同じBindingを期限直前と期限到達時に読む。
 * @observation 返却Source、Operation確認回数と値の相関を観測する。
 * @oracle 期限前だけ同じSourceを返し全読取りでOperationを再確認する。
 * @cleanup N/A: Process内の値だけを使用し外部資源を作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Operation確認→許可元生成。
 */
test("許可元cacheは30秒境界で再生成する", () => {
  let now = Date.now();
  let calls = 0;
  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: () => now,
    verifyOperation: () => {
      calls += 1;
      return true;
    },
  });
  const binding = {
    operationId: "OP-123456",
    provider: "codex",
    profileId: "PROFILE-100002",
  };
  const first = runtime.load(binding, {});
  assert.ok(first);
  now += 29_999;
  assert.equal(runtime.load(binding, {}), first);
  now += 1;
  const second = runtime.load(binding, {});
  assert.ok(second);
  assert.notEqual(second, first);
  assert.equal(calls, 3);
});

/**
 * 本番のOperation照合と開発Context追加条件の順序を固定する。
 *
 * @responsibility 本番組立ての同じ関数本文で開発条件の省略・誤受理を反証する。
 * @trace PRL-UT-006
 * @precondition 現在Sourceから一意に特定した本番の確認本文を局所依存へ接続する。
 * @stimulus 正規Operation、別Operation、偽管理参照と開発Contextの各状態を与える。
 * @observation 依存の呼出し順、Source返却とwarm cacheの拒否を確認する。
 * @oracle 実Operation照合が先で、Context存在時だけstrict trueが必要となる。
 * @cleanup N/A: 自己Sourceの読取りと局所値だけを使用し外部Effectを発行しない。
 * @boundary PRL-UT-006=Direct Boundary: 本番確認本文→許可元の局所判断。
 */
test("本番確認はOperation一致の後だけ開発Contextを照合する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/execution/authority.ts", import.meta.url),
    "utf8",
  );
  const matches = [
    ...source.matchAll(
      /verifyOperation: \(binding, managementCapability\) => \{([\s\S]*?)\n[ ]{4}\},/gu,
    ),
  ];
  assert.equal(matches.length, 1);
  const management = Object.freeze({});
  const binding = {
    operationId: "OP-123456",
    provider: "claude",
    profileId: "PROFILE-200001",
  };
  let currentOperationId = binding.operationId;
  let mode:
    | "normal"
    | "active"
    | "expired"
    | "nonboolean"
    | "throw"
    | "unknown" = "normal";
  const events: string[] = [];
  const verifyOperation = vm.runInNewContext(
    `(binding, managementCapability) => {${matches[0]?.[1]}}`,
    {
      verifyOwnedOperationManagementCapability: (capability: unknown) => {
        events.push("operation");
        assert.equal(capability, management);
        return { operationId: currentOperationId };
      },
      inspectRuntimeOwnedDevelopmentOperationContext: (capability: unknown) => {
        events.push("context");
        assert.equal(capability, management);
        if (mode === "unknown") throw new Error("context_unknown");
        if (mode === "normal") return null;
        return {
          checkNewWork: () => {
            events.push("new_work");
            if (mode === "throw") throw new Error("development_check_unknown");
            return mode === "active" ? true : mode === "nonboolean" ? 1 : false;
          },
        };
      },
    },
  ) as (candidate: typeof binding, capability: unknown) => boolean;
  const runtime = createIsolatedLocalPersonalAuthorityRuntimeCandidate({
    wallNow: Date.now,
    verifyOperation,
  });
  assert.ok(runtime.load(binding, management));
  assert.deepEqual(events.splice(0), ["operation", "context"]);
  for (const next of [
    "active",
    "expired",
    "nonboolean",
    "throw",
    "unknown",
  ] as const) {
    mode = next;
    assert.equal(runtime.load(binding, management) !== null, next === "active");
    assert.deepEqual(
      events.splice(0),
      next === "unknown"
        ? ["operation", "context"]
        : ["operation", "context", "new_work"],
    );
  }
  mode = "normal";
  currentOperationId = "OP-654321";
  assert.equal(runtime.load(binding, management), null);
  assert.deepEqual(events.splice(0), ["operation"]);
  currentOperationId = binding.operationId;
  assert.equal(runtime.load(binding, {}), null);
  assert.deepEqual(events, ["operation"]);
});

/**
 * 現在契約は署名非必須と既存許可範囲を固定する。
 *
 * @responsibility 現在Operationと許可元生成の境界を検証する。
 * @trace PRL-UT-006
 * @precondition 固定したBindingと局所依存を使用する。
 * @stimulus 公開契約を取得する。
 * @observation 返却Source、Operation確認回数と値の相関を観測する。
 * @oracle 改訂2・署名非必須とProvider Effect非所有を明示する。
 * @cleanup N/A: Process内の値だけを使用し外部資源を作成しない。
 * @boundary PRL-UT-006=Direct Boundary: Operation確認→許可元生成。
 */
test("現在契約は署名非必須と既存許可範囲を固定する", () => {
  const contract = describeLocalPersonalAuthorityRuntimeContract();
  assert.equal(contract.contractRevision, 2);
  assert.equal(contract.trustProfile, "local_personal_t1_t2");
  assert.equal(contract.releaseTrust, "not_required_for_runtime_authority");
  assert.equal(
    contract.operationBinding,
    "runtime_owned_exact_operation_profile_provider",
  );
  assert.equal(contract.externalAuthorityRootRequired, false);
  assert.equal(contract.managedAuthorityProfileSupported, false);
  assert.equal(contract.providerEffectAllowed, false);
});

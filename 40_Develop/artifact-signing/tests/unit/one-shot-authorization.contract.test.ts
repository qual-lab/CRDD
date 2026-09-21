/**
 * 一回利用Authorization Stateを単体検証する。
 *
 * @packageDocumentation
 * @responsibility 未使用、消費済み、失敗および競合要求で一件だけが消費できることを検証する。
 * @trace AIT-UT-012
 * @level UT
 * @scope one-shot-authorization
 * @boundary AIT-UT-012=N/A: Process内の同期状態機械だけを検証する。
 */
import assert from "node:assert/strict";
import test from "node:test";

import { createOneShotAuthorizationState } from "../../src/one-shot-authorization.ts";

/**
 * Authorizationを一回だけ消費し再利用要求では保護対象を返さないことを検証する。
 *
 * @responsibility 未使用から消費済みへの遷移と失敗後の再利用拒否を確認する。
 * @trace AIT-UT-012
 * @precondition 一つのTokenと読取り回数を持つ固定fixtureを登録する。
 * @stimulus 同じTokenを二回消費する。
 * @observation 成功値、拒否理由および保護対象の利用回数を観測する。
 * @oracle 最初の要求だけが成功し、二回目は同じ理由で拒否される。
 * @cleanup N/A: WeakMap内のTokenはTest終了後に到達不能となる。
 * @boundary AIT-UT-012=N/A: Process内の同期状態遷移である。
 */
test("Authorizationを一回だけ消費し再利用要求では保護対象を返さない", () => {
  const state = createOneShotAuthorizationState<object, () => string>(
    "authorization_invalid",
  );
  const token = {};
  let reads = 0;
  state.register(token, () => {
    reads += 1;
    return "protected";
  });
  assert.equal(state.consume(token)(), "protected");
  assert.equal(reads, 1);
  assert.throws(() => state.consume(token), /authorization_invalid/);
  assert.equal(reads, 1);
});

/**
 * 競合する消費要求の勝者を一件に限定することを検証する。
 *
 * @responsibility 同じEvent Loop turnへ投入した複数要求が同じTokenを重複消費しないことを確認する。
 * @trace AIT-UT-012
 * @precondition 一つの登録済みTokenを二つのPromise要求が共有する。
 * @stimulus 二つの要求から同じTokenを消費する。
 * @observation 成功件数、失敗件数および保護対象の利用回数を観測する。
 * @oracle 成功一件、失敗一件となり、保護対象の利用回数は一回である。
 * @cleanup N/A: WeakMap内のTokenはTest終了後に到達不能となる。
 * @boundary AIT-UT-012=N/A: Process内の同期状態遷移である。
 */
test("競合する消費要求の勝者を一件に限定する", async () => {
  const state = createOneShotAuthorizationState<object, () => void>(
    "authorization_invalid",
  );
  const token = {};
  let reads = 0;
  state.register(token, () => {
    reads += 1;
  });
  const attempts = await Promise.allSettled([
    Promise.resolve().then(() => state.consume(token)()),
    Promise.resolve().then(() => state.consume(token)()),
  ]);
  assert.equal(
    attempts.filter(({ status }) => status === "fulfilled").length,
    1,
  );
  assert.equal(
    attempts.filter(({ status }) => status === "rejected").length,
    1,
  );
  assert.equal(reads, 1);
});

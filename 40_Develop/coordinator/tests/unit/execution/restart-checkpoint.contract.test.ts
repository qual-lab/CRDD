/**
 * 単一再起動checkpointの全組合せと保存遷移を反証する。
 * @packageDocumentation
 * @responsibility 値の完成相関とID不変を実Host保証から分離して確認する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 再起動現在値の純粋なHash・復号・遷移。
 * @boundary N/A: メモリ内だけ。実処置・Writer・排他を実行しない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  createDockerRestartRequestId,
  decodeDockerRestartCheckpoint,
  isDockerRestartCheckpointSettled,
  validateDockerRestartCheckpointTransition,
} from "../../../src/execution/restart-checkpoint.ts";

const repositoryBinding = "a".repeat(64);
const identitySha256 = "b".repeat(64);
const recoveryId = `docker-task.${"c".repeat(64)}.${"d".repeat(64)}.${identitySha256}`;
const scopeSha256 = "e".repeat(64);
const requestId = createDockerRestartRequestId(
  repositoryBinding,
  identitySha256,
  recoveryId,
  scopeSha256,
);
assert.ok(requestId);
const initial = {
  requestId,
  scopeSha256,
  request: "not_issued",
  cleanup: "not_required",
  result: null,
};

/**
 * 要求Hashが元操作と固定Scopeに結合し秘密やAuthorityを含まないことを確認する。
 * @responsibility 独立した固定envelopeのHashと四入力の差を反証する。
 * @trace PRL-UT-006
 * @precondition 固定非秘密Hashをメモリ内に用意する。
 * @stimulus 正常入力と別結合・不正文法を渡す。
 * @observation Hashまたはnull。
 * @oracle 独立Hashに一致し、別入力では不一致または拒否する。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary N/A: 純粋なHash計算。
 */
test("再起動要求Hashは元操作・Repository・Scopeへ固定する", () => {
  const expected = createHash("sha256")
    .update(
      JSON.stringify({
        schema: "crdd-coordinator/docker-restart-request/v1",
        purpose: "docker_restart",
        repositoryBinding,
        identitySha256,
        recoveryId,
        scopeSha256,
      }),
    )
    .digest("hex");
  assert.equal(requestId, expected);
  assert.notEqual(
    createDockerRestartRequestId(
      "f".repeat(64),
      identitySha256,
      recoveryId,
      scopeSha256,
    ),
    requestId,
  );
  assert.notEqual(
    createDockerRestartRequestId(
      repositoryBinding,
      identitySha256,
      recoveryId,
      "f".repeat(64),
    ),
    requestId,
  );
  assert.equal(
    createDockerRestartRequestId(
      repositoryBinding,
      "f".repeat(64),
      recoveryId,
      scopeSha256,
    ),
    null,
  );
  assert.equal(
    createDockerRestartRequestId(
      repositoryBinding,
      identitySha256,
      "invalid",
      scopeSha256,
    ),
    null,
  );
});

/**
 * 正本の閉じた交差制約を全48組合せで確認する。
 * @responsibility 不正なcompletedと清掃不要の偽装を拒否する。
 * @trace PRL-UT-006
 * @precondition 要求四値・回収四値・結果三値を用意する。
 * @stimulus 全直積とhostile構造を復号する。
 * @observation 固定Snapshotまたはnullとgetter呼出し回数。
 * @oracle 正本の許容表だけ受理し、hostile値の処理は呼ばない。
 * @cleanup N/A: メモリ内だけ。
 * @boundary N/A: 保存構造の局所検査。
 */
test("再起動checkpointは48組合せとhostile値を区別する", () => {
  const allowed = new Set([
    "not_issued/not_required/null",
    "not_issued/not_required/blocked",
    "unknown/pending/null",
    "unknown/pending/blocked",
    "unknown/confirmed/null",
    "unknown/confirmed/blocked",
    "unknown/unknown/blocked",
    "issued/pending/null",
    "issued/pending/blocked",
    "issued/confirmed/null",
    "issued/confirmed/blocked",
    "issued/unknown/blocked",
    "confirmed/pending/null",
    "confirmed/pending/blocked",
    "confirmed/confirmed/null",
    "confirmed/confirmed/completed",
    "confirmed/confirmed/blocked",
    "confirmed/unknown/blocked",
  ]);
  for (const request of ["not_issued", "unknown", "issued", "confirmed"])
    for (const cleanup of ["not_required", "pending", "confirmed", "unknown"])
      for (const status of ["null", "completed", "blocked"]) {
        const value = {
          ...initial,
          request,
          cleanup,
          result:
            status === "null"
              ? null
              : {
                  status,
                  reason: "docker_restart_test",
                  request,
                  effectOutcomeUnknown: !["not_issued", "confirmed"].includes(
                    request,
                  ),
                },
        };
        assert.equal(
          decodeDockerRestartCheckpoint(value) !== null,
          allowed.has(`${request}/${cleanup}/${status}`),
          `${request}/${cleanup}/${status}`,
        );
      }
  let calls = 0;
  const getter = Object.defineProperty({ ...initial }, "request", {
    enumerable: true,
    get() {
      calls++;
      return "not_issued";
    },
  });
  const proxy = new Proxy(initial, {
    ownKeys() {
      calls++;
      return [];
    },
  });
  for (const invalid of [
    getter,
    proxy,
    { ...initial, extra: true },
    { ...initial, result: undefined },
    { ...initial, requestId: "invalid" },
  ])
    assert.equal(decodeDockerRestartCheckpoint(invalid), null);
  assert.equal(calls, 0);
});

/**
 * 一操作一要求とblocked後の回収だけの進行を検証する。
 * @responsibility 結果と相関の置換、過去unknownの未発行化を拒否する。
 * @trace PRL-UT-006
 * @precondition 同じ要求の初回・発行前・受付・終端値を用意する。
 * @stimulus 正常列と禁止された差替え・再入場を比較する。
 * @observation 純粋な遷移判定。
 * @oracle 初回はnot_issuedだけ、terminal不変、blocked後は回収だけが進む。
 * @cleanup N/A: 外部資源を作成しない。
 * @boundary N/A: 値比較だけ。実行許可や実回収は証明しない。
 */
test("再起動の結果確定と回収更新を別の単調遷移にする", () => {
  const pending = { ...initial, request: "unknown", cleanup: "pending" };
  const accepted = { ...pending, request: "issued" };
  const confirmed = {
    ...accepted,
    request: "confirmed",
    cleanup: "confirmed",
    result: {
      status: "completed",
      reason: "docker_restart_settled",
      request: "confirmed",
      effectOutcomeUnknown: false,
    },
  };
  assert.equal(validateDockerRestartCheckpointTransition(null, initial), true);
  assert.equal(validateDockerRestartCheckpointTransition(null, pending), false);
  assert.equal(
    validateDockerRestartCheckpointTransition(initial, pending),
    true,
  );
  assert.equal(
    validateDockerRestartCheckpointTransition(pending, accepted),
    true,
  );
  assert.equal(
    validateDockerRestartCheckpointTransition(accepted, pending),
    false,
    "受付既知を結果不明へ降格しない",
  );
  assert.equal(
    validateDockerRestartCheckpointTransition(accepted, confirmed),
    true,
  );
  assert.equal(
    validateDockerRestartCheckpointTransition(pending, initial),
    false,
  );
  assert.equal(
    validateDockerRestartCheckpointTransition(confirmed, null),
    false,
  );
  for (const replacement of [
    { ...confirmed, requestId: "f".repeat(64) },
    { ...confirmed, scopeSha256: "f".repeat(64) },
    { ...confirmed, result: { status: "blocked", reason: "replaced" } },
    { ...confirmed, result: null },
  ])
    assert.equal(
      validateDockerRestartCheckpointTransition(confirmed, replacement),
      false,
    );
  const blocked = {
    ...pending,
    result: {
      status: "blocked",
      reason: "docker_restart_cancelled",
      request: "unknown",
      effectOutcomeUnknown: true,
    },
  };
  assert.equal(
    validateDockerRestartCheckpointTransition(pending, blocked),
    true,
  );
  assert.equal(
    validateDockerRestartCheckpointTransition(blocked, {
      ...blocked,
      cleanup: "confirmed",
    }),
    true,
  );
  assert.equal(
    validateDockerRestartCheckpointTransition(blocked, {
      ...blocked,
      cleanup: "unknown",
    }),
    true,
  );
  assert.equal(
    validateDockerRestartCheckpointTransition(blocked, {
      ...confirmed,
      result: blocked.result,
    }),
    false,
  );
  assert.equal(
    validateDockerRestartCheckpointTransition(blocked, confirmed),
    false,
  );
});

/**
 * 上位unknownと確定未発行・発行済み既知失敗を分けて終端許可を検査する。
 * @responsibility 再起動失敗を成功へ変換せず、残るEffectと回収の不明がない形だけ受理する。
 * @trace PRL-UT-006
 * @precondition 固定要求とScopeを持つメモリ上のcheckpoint。
 * @stimulus 最終観測の全直積、欠測・余剰・hostile構造と後着変更を与える。
 * @observation 復号・終端許可・遷移拒否とgetter呼出し0。
 * @oracle blockedの追加形は回収confirmed・Effect不明falseと、unknown／最終not_issuedまたはissued／最終issuedの一致だけ。
 * @cleanup N/A: メモリのみ。
 * @boundary 値契約だけ。実Writer・資源不存在・Task成功を証明しない。
 */
test("再起動の未発行・発行済み既知失敗をunknownと分けて終了できる", () => {
  const base = {
    ...initial,
    request: "unknown",
    cleanup: "confirmed",
    result: {
      status: "blocked",
      reason: "docker_restart_stop_unconfirmed",
      request: "not_issued",
      effectOutcomeUnknown: false,
    },
  };
  assert.equal(isDockerRestartCheckpointSettled(null), true);
  assert.equal(isDockerRestartCheckpointSettled(initial), true);
  assert.equal(isDockerRestartCheckpointSettled(base), true);
  for (const request of ["not_issued", "unknown", "issued", "confirmed"])
    for (const cleanup of ["not_required", "pending", "confirmed", "unknown"])
      for (const finalRequest of [
        "not_issued",
        "unknown",
        "issued",
        "confirmed",
      ])
        for (const effectOutcomeUnknown of [true, false]) {
          const value = {
            ...base,
            request,
            cleanup,
            result: {
              ...base.result,
              request: finalRequest,
              effectOutcomeUnknown,
            },
          };
          const expected =
            cleanup === "confirmed" &&
            !effectOutcomeUnknown &&
            ((request === "unknown" && finalRequest === "not_issued") ||
              (request === "issued" && finalRequest === "issued") ||
              (request === "confirmed" && finalRequest === "confirmed"));
          assert.equal(
            isDockerRestartCheckpointSettled(value),
            expected,
            JSON.stringify(value),
          );
        }
  const prior = { ...base, cleanup: "pending", result: null };
  assert.equal(validateDockerRestartCheckpointTransition(prior, base), true);
  for (const [field, value] of Object.entries({
    status: "completed",
    reason: "changed",
    request: "unknown",
    effectOutcomeUnknown: true,
  }))
    assert.equal(
      validateDockerRestartCheckpointTransition(base, {
        ...base,
        result: { ...base.result, [field]: value },
      }),
      false,
    );
  let calls = 0;
  const getter = Object.defineProperty({ ...base.result }, "request", {
    enumerable: true,
    get() {
      calls++;
      return "not_issued";
    },
  });
  const proxy = new Proxy(base.result, {
    ownKeys() {
      calls++;
      return [];
    },
  });
  for (const result of [
    { status: "blocked", reason: "docker_restart_stop_unconfirmed" },
    { ...base.result, request: undefined },
    { ...base.result, effectOutcomeUnknown: undefined },
    { ...base.result, effectOutcomeUnknown: "false" },
    { ...base.result, extra: true },
    getter,
    proxy,
  ]) {
    assert.equal(decodeDockerRestartCheckpoint({ ...base, result }), null);
    assert.equal(isDockerRestartCheckpointSettled({ ...base, result }), false);
  }
  assert.equal(calls, 0);
  for (const result of [
    { ...base.result, status: "completed", request: "unknown" },
    {
      ...base.result,
      status: "completed",
      request: "confirmed",
      effectOutcomeUnknown: true,
    },
  ])
    assert.equal(
      decodeDockerRestartCheckpoint({ ...base, request: "confirmed", result }),
      null,
    );
});

/**
 * Effect不明の拒否を省略した本文を同じ終了Oracleで検出する。
 * @responsibility 型や理由だけの肯定対照で安全条件の欠落を見逃さない。
 * @trace PRL-UT-006
 * @precondition 本番判定の一意な関数本文と実decoderを使う。
 * @stimulus Effect不明拒否の一節だけをメモリ内で除去する。
 * @observation 元判定falseと変異判定true。
 * @oracle 同じ不成立期待値が変異本文を拒否する。
 * @cleanup N/A: Sourceや外部状態を変更しない。
 * @boundary 純粋な判定の感度。実資源の保証ではない。
 */
test("再起動終了判定はEffect不明条件の省略を検出する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/execution/restart-checkpoint.ts", import.meta.url),
    "utf8",
  );
  const marker = "export function isDockerRestartCheckpointSettled(";
  assert.equal(source.split(marker).length, 2);
  const body = source
    .slice(source.indexOf(marker))
    .replace("export function", "function");
  const guard = " ||\n    checkpoint.result.effectOutcomeUnknown !== false";
  assert.equal(body.split(guard).length, 2);
  const changed = stripTypeScriptTypes(body.replace(guard, ""));
  const mutant = runInNewContext(
    `${changed}; isDockerRestartCheckpointSettled`,
    { decodeDockerRestartCheckpoint },
  ) as typeof isDockerRestartCheckpointSettled;
  const value = {
    ...initial,
    request: "unknown",
    cleanup: "confirmed",
    result: {
      status: "blocked",
      reason: "docker_restart_stop_unconfirmed",
      request: "not_issued",
      effectOutcomeUnknown: true,
    },
  };
  assert.equal(isDockerRestartCheckpointSettled(value), false);
  assert.equal(mutant(value), true);
  assert.throws(() => assert.equal(mutant(value), false));
});

/**
 * coordinator:unit:docker-host-transition-stateの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-host-transition-stateが所有する検証責務を実行する。
 * @trace PRL-UT-006
 * @level UT
 * @scope docker、host、transition、state
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { validateDockerHostTransitionLineage } from "../../src/security/docker-host-transition-state.ts";

const ROOT_NAME = "crdd-coordinator-doctor-fixture";
const NONCE = "01234567-89ab-cdef-0123-456789abcdef";

/**
 * canonicalのTest準備責務を実行する。
 *
 * @responsibility canonicalがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus canonicalを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function canonical(value: unknown) {
  return `${JSON.stringify(value)}\n`;
}

/**
 * tokenのTest準備責務を実行する。
 *
 * @responsibility tokenがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus tokenを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function token(record: unknown) {
  const hash = createHash("sha256").update(canonical(record)).digest("hex");
  return `host.${ROOT_NAME}.${NONCE}.${hash}`;
}

/**
 * intentのTest準備責務を実行する。
 *
 * @responsibility intentがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus intentを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
function intent() {
  const recordBefore = Object.freeze({
    schema: "crdd-coordinator-host-recovery/v1",
    rootName: ROOT_NAME,
    state: "docker_submission_started",
    childIdentities: Object.freeze({}),
  });
  const successor = Object.freeze({ ...recordBefore, state: "host_only" });
  return Object.freeze({
    currentToken: token(recordBefore),
    expectedToken: token(successor),
    rootName: ROOT_NAME,
    nonce: NONCE,
    currentState: "docker_submission_started",
    nextState: "host_only",
    recordBefore,
  });
}

/**
 * Host intentはcurrent recordから決定論的successor tokenだけを受理するを検証する。
 *
 * @responsibility Host intentはcurrent recordから決定論的successor tokenだけを受理するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host intentはcurrent recordから決定論的successor tokenだけを受理するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("Host intentはcurrent recordから決定論的successor tokenだけを受理する", () => {
  const accepted = validateDockerHostTransitionLineage(intent(), "host_only");
  assert.equal(accepted.current.nonce, NONCE);
  assert.equal(
    accepted.expected.recordHash,
    token({
      ...intent().recordBefore,
      state: "host_only",
    })
      .split(".")
      .at(-1),
  );
});

/**
 * 同nonce別state、偽currentState、誤nextStateを第三状態として拒否するを検証する。
 *
 * @responsibility 同nonce別state、偽currentState、誤nextStateを第三状態として拒否するの合否判定を所有する。
 * @trace PRL-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 同nonce別state、偽currentState、誤nextStateを第三状態として拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-006=N/A: Task状態遷移とAuthority判定は外部実行境界を持たない。
 */
test("同nonce別state、偽currentState、誤nextStateを第三状態として拒否する", () => {
  const valid = intent();
  const alternate = Object.freeze({
    ...valid.recordBefore,
    state: "docker_absent_confirmed",
  });
  for (const candidate of [
    { ...valid, expectedToken: token(alternate) },
    { ...valid, currentState: "host_only" },
    { ...valid, nextState: "docker_absent_confirmed" },
    { ...valid, recordBefore: { ...valid.recordBefore, extra: true } },
  ])
    assert.throws(
      () => validateDockerHostTransitionLineage(candidate, "host_only"),
      /docker_task_recovery_host_transition_mismatch/u,
    );
});

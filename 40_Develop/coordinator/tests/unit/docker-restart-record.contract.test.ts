/**
 * coordinator:unit:docker-restart-recordの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:docker-restart-recordが所有する検証責務を実行する。
 * @trace ERP-UT-006
 * @level UT
 * @scope docker、restart、record
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  createDockerRestartRecord,
  type DockerRestartBinding,
  dockerRestartPhases,
  parseDockerRestartRecord,
  validateDockerRestartRecordChain,
} from "../../src/security/docker-restart-record.ts";

const hash = "a".repeat(64);
const binding: DockerRestartBinding = {
  recoveryId: `docker-task.${hash}.${hash}.${hash}`,
  operationNonce: hash,
  runtimeExecutionIdentitySha256: hash,
  localUserBindingHash: hash,
  runtimeStateIdentityHash: hash,
  runtimeStateProtectionHash: hash,
  stableLogicalHomeBindingHash: hash,
  pendingSubmissionSha256: hash,
};
/**
 * chainのTest準備責務を実行する。
 *
 * @responsibility chainがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace ERP-UT-006
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus chainを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
function chain() {
  const records: Buffer[] = [];
  for (const phase of dockerRestartPhases)
    records.push(createDockerRestartRecord(binding, phase, records.at(-1)));
  return records;
}
/**
 * canonical restart records validate every complete prefix without granting authorityを検証する。
 *
 * @responsibility canonical restart records validate every complete prefix without granting authorityの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus canonical restart records validate every complete prefix without granting authorityの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("canonical restart records validate every complete prefix without granting authority", () => {
  const records = chain();
  for (let length = 1; length <= records.length; length++)
    assert.equal(
      validateDockerRestartRecordChain(records.slice(0, length), binding)
        ?.length,
      length,
    );
  assert.equal(
    parseDockerRestartRecord(records[4] as Buffer)?.phase,
    "settled",
  );
});
/**
 * closed record rejects malformed, noncanonical and unbounded bytesを検証する。
 *
 * @responsibility closed record rejects malformed, noncanonical and unbounded bytesの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus closed record rejects malformed, noncanonical and unbounded bytesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("closed record rejects malformed, noncanonical and unbounded bytes", () => {
  const first = chain()[0] as Buffer;
  for (const bytes of [
    Buffer.alloc(0),
    Buffer.alloc(65_537),
    Buffer.from("{}\n"),
    Buffer.from("[]\n"),
    Buffer.from([255]),
    first.subarray(0, first.length - 1),
    Buffer.concat([first, Buffer.from("\n")]),
    Buffer.from(first.toString().replace('"sequence":0', '"sequence": 0')),
  ])
    assert.equal(parseDockerRestartRecord(bytes), null);
  const value = JSON.parse(first.toString());
  for (const key of Object.keys(value)) {
    const altered = { ...value };
    delete altered[key];
    assert.equal(
      parseDockerRestartRecord(Buffer.from(`${JSON.stringify(altered)}\n`)),
      null,
    );
  }
  assert.equal(
    parseDockerRestartRecord(
      Buffer.from(`${JSON.stringify({ ...value, extra: true })}\n`),
    ),
    null,
  );
});
/**
 * record rejects all changed field types and malformed hashesを検証する。
 *
 * @responsibility record rejects all changed field types and malformed hashesの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus record rejects all changed field types and malformed hashesの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("record rejects all changed field types and malformed hashes", () => {
  const value = JSON.parse((chain()[0] as Buffer).toString());
  for (const key of Object.keys(value))
    assert.equal(
      parseDockerRestartRecord(
        Buffer.from(`${JSON.stringify({ ...value, [key]: [] })}\n`),
      ),
      null,
    );
  for (const key of Object.keys(binding).filter((key) => key !== "recoveryId"))
    assert.throws(() =>
      createDockerRestartRecord(
        { ...binding, [key]: "A".repeat(64) },
        "stop_intent",
      ),
    );
  assert.throws(() =>
    createDockerRestartRecord(
      { ...binding, operationNonce: "b".repeat(64) },
      "stop_intent",
    ),
  );
});
/**
 * chain rejects missing, duplicate, reordered, foreign and digest-modified recordsを検証する。
 *
 * @responsibility chain rejects missing, duplicate, reordered, foreign and digest-modified recordsの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus chain rejects missing, duplicate, reordered, foreign and digest-modified recordsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("chain rejects missing, duplicate, reordered, foreign and digest-modified records", () => {
  const records = chain();
  assert.equal(validateDockerRestartRecordChain([], binding), null);
  assert.equal(
    validateDockerRestartRecordChain(records.slice(1), binding),
    null,
  );
  assert.equal(
    validateDockerRestartRecordChain(
      [records[0] as Buffer, records[0] as Buffer],
      binding,
    ),
    null,
  );
  assert.equal(
    validateDockerRestartRecordChain([...records].reverse(), binding),
    null,
  );
  assert.equal(
    validateDockerRestartRecordChain(records, {
      ...binding,
      pendingSubmissionSha256: "b".repeat(64),
    }),
    null,
  );
  const wrongDigest = Buffer.from(
    (records[1] as Buffer)
      .toString()
      .replace(
        /"previousRecordSha256":"[a-f0-9]{64}"/u,
        `"previousRecordSha256":"${hash}"`,
      ),
  );
  assert.notEqual(parseDockerRestartRecord(wrongDigest), null);
  assert.equal(
    validateDockerRestartRecordChain(
      [records[0] as Buffer, wrongDigest],
      binding,
    ),
    null,
  );
});
/**
 * generation cannot skip a phase or mix bindingsを検証する。
 *
 * @responsibility generation cannot skip a phase or mix bindingsの合否判定を所有する。
 * @trace ERP-UT-006
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus generation cannot skip a phase or mix bindingsの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERP-UT-006=N/A: Canonical Eventの検査・Identity生成規則は外部実行境界を持たない。
 */
test("generation cannot skip a phase or mix bindings", () => {
  const records = chain();
  assert.throws(() => createDockerRestartRecord(binding, "ready", records[0]));
  assert.throws(() => createDockerRestartRecord(binding, "stopped"));
  assert.throws(() =>
    createDockerRestartRecord(binding, "stop_intent", records[0]),
  );
  assert.throws(() =>
    createDockerRestartRecord(
      { ...binding, localUserBindingHash: "b".repeat(64) },
      "stopped",
      records[0],
    ),
  );
});

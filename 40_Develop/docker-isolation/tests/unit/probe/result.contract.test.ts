/**
 * 診断Probeの作成ID・三軸不存在・完了応答の純粋分類を検証する。
 * @packageDocumentation
 * @responsibility 欠測・失敗・残存を不存在へ補完しないことを反証する。
 * @trace ERB-UT-038
 * @level UT
 * @scope 値分類だけ。実Process・Docker・Host保存は含まない。
 * @boundary N/A: 同Process内の固定観測値。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import {
  classifyDockerProbeExecution,
  classifyDockerProbeCancellation,
  normalizeContainerCreation,
  normalizeContainerAbsence,
} from "../../../src/index.ts";

/**
 * 固定取消の要求・猶予・ack・終了値を独立期待値へ照合する。
 * @responsibility 元の優先順と閉じた返値を保証する。
 * @trace ERB-UT-038
 * @precondition 値分類だけを実行する。
 * @stimulus 正常、要求なし、猶予境界、余分出力、stderr、非42、Signal、error。
 * @observation reason、候補状態、時間・容量・終了事実、キー集合。
 * @oracle 既知12fieldだけを返し、要求なし→猶予→ack→終了値の順で拒否する。
 * @cleanup N/A: メモリだけ。
 * @boundary 同Processの純粋値分類。
 */
test("取消分類は固定ackと42終了だけを候補にし元の失敗優先順を維持する", () => {
  const stdout =
    '{"marker":"crdd-coordinator-cancellation-v1","state":"ready"}\n{"marker":"crdd-coordinator-cancellation-v1","state":"cancelled"}\n';
  const execution = { status: 42, signal: null, stdout, stderr: "" };
  const result = classifyDockerProbeCancellation(execution, 5_000, true);
  assert.deepEqual(result, {
    status: "candidate",
    reason: "dynamic_fake_provider_cancellation_candidate",
    cancellationRequested: true,
    cancellationSignalRequested: "SIGTERM",
    readyObserved: true,
    cancellationAcknowledged: true,
    processTerminationObserved: true,
    graceElapsedMs: 5_000,
    stdoutBytes: Buffer.byteLength(stdout),
    stderrBytes: 0,
    exitCode: 42,
    signal: null,
  });
  assert.equal(Object.isFrozen(result), true);
  for (const grace of [-1, 5_001, 0.5, Number.NaN]) {
    assert.equal(
      classifyDockerProbeCancellation(execution, grace, false).reason,
      "dynamic_fake_provider_cancellation_not_requested",
    );
    assert.equal(
      classifyDockerProbeCancellation(
        { ...execution, stdout: "bad", status: 7 },
        grace,
        true,
      ).reason,
      "dynamic_fake_provider_cancellation_grace_exceeded",
    );
  }
  for (const changed of [
    { ...execution, stdout: `${stdout}\n` },
    { ...execution, stderr: "bad" },
    { ...execution, stdout: "x".repeat(65_537) },
    {},
  ])
    assert.equal(
      classifyDockerProbeCancellation(changed, 0, true).reason,
      "dynamic_fake_provider_cancellation_acknowledgement_invalid",
    );
  for (const changed of [
    { ...execution, status: 0 },
    { ...execution, status: 7 },
    { ...execution, signal: "SIGKILL" as const },
    { ...execution, signal: "SIGTERM" as const },
    { ...execution, error: new Error("private") },
  ])
    assert.equal(
      classifyDockerProbeCancellation(changed, 0, true).reason,
      "dynamic_fake_provider_cancellation_termination_invalid",
    );
});

/**
 * 作成応答の完全IDと成功条件を移管前と同じ形で確認する。
 * @responsibility 作成結果不明を架空IDへ補完しない。
 * @trace ERB-UT-038
 * @precondition 部分的なCLI観測値だけを入力する。
 * @stimulus 正常、空白、不正ID、欠測、error、非0を与える。
 * @observation status、ID、固定reason、入力の不変性。
 * @oracle errorなし・終了値0・完全64桁IDだけconfirmed。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 純粋分類。
 */
test("Probe作成は完全IDと元の成功条件だけで分類する", () => {
  const id = "a".repeat(64);
  for (const stdout of [id, ` \r\n${id}\n `]) {
    const input = Object.freeze({ status: 0, stdout });
    assert.deepEqual(normalizeContainerCreation(input), {
      status: "confirmed",
      id,
    });
    assert.equal(input.stdout, stdout);
  }
  for (const input of [
    {},
    { status: 0 },
    { status: 0, stdout: "" },
    { status: 0, stdout: "a".repeat(63) },
    { status: 0, stdout: "A".repeat(64) },
    { status: 0, stdout: `${id}\n${id}` },
    { status: 1, stdout: id },
    { status: null, stdout: id },
    { status: 0, stdout: id, error: new Error("fixture") },
  ])
    assert.deepEqual(normalizeContainerCreation(Object.freeze(input)), {
      status: "blocked",
      reason: "docker_container_identity_unknown",
    });
});

/**
 * 各応答の観測失敗と残存を三軸それぞれで拒否する。
 * @responsibility 一軸だけの成功から全資源不存在を推定しない。
 * @trace ERB-UT-038
 * @precondition ID／名前／Label応答を独立した固定値で作る。
 * @stimulus 各一軸へ残存、重複、不正ID、欠測、error、非0とUTF-8境界を与える。
 * @observation 三入力からのstatusとreason。
 * @oracle 三軸全成功かつ空だけconfirmed。64KiBは受理、超過は拒否。
 * @cleanup N/A: 外部資源なし。
 * @boundary N/A: 純粋分類。実不存在の証明ではない。
 */
test("Probe不存在は三軸の欠測とUTF-8容量境界を成功へ補完しない", () => {
  const empty = Object.freeze({ status: 0, stdout: "" });
  const expected = {
    status: "confirmed",
    reason: "docker_probe_absence_confirmed",
  };
  const actual = normalizeContainerAbsence(empty, empty, empty);
  assert.deepEqual(actual, expected);
  assert.throws(() =>
    assert.deepEqual({ ...actual, reason: "changed_reason" }, expected),
  );
  const full = `${"　".repeat(21_845)} `;
  assert.equal(Buffer.byteLength(full), 65_536);
  const faults = [
    {},
    { status: 0 },
    { status: 1, stdout: "" },
    { status: 0, stdout: "", error: new Error("fixture") },
    { status: 0, stdout: "a".repeat(64) },
    { status: 0, stdout: `${"a".repeat(64)}\n${"a".repeat(64)}` },
    { status: 0, stdout: "invalid" },
    { status: 0, stdout: `${full} ` },
  ];
  for (let axis = 0; axis < 3; axis++) {
    const valid: Parameters<typeof normalizeContainerAbsence> = [
      empty,
      empty,
      empty,
    ];
    valid[axis] = { status: 0, stdout: full };
    assert.deepEqual(
      normalizeContainerAbsence(valid[0], valid[1], valid[2]),
      expected,
    );
    for (const fault of faults) {
      const input: Parameters<typeof normalizeContainerAbsence> = [
        empty,
        empty,
        empty,
      ];
      input[axis] = Object.freeze(fault);
      assert.deepEqual(normalizeContainerAbsence(...input), {
        status: "blocked",
        reason: "docker_probe_absence_unconfirmed",
      });
    }
  }
});

/**
 * 実分類本文の一軸省略を独立した残存Oracleで検出する。
 * @responsibility 三軸のeveryが一軸でも省略された退行を見逃さない。
 * @trace ERB-UT-038
 * @precondition 実公開関数本文を使い、ID集合への局所変換だけ代役とする。
 * @stimulus ID／名前／Labelそれぞれの軸を意図的に無視する。
 * @observation 省略軸だけに残存がある結果。
 * @oracle 全軸の独立期待はblockedであり、省略変異はそれに反する。
 * @cleanup N/A: VM内の値だけ。
 * @boundary N/A: private parser・実CLI・Filesystemは証明しない。
 */
test("三軸の省略変異を同じ残存Oracleで拒否する", () => {
  const source = normalizeContainerAbsence.toString();
  assert.ok(source.includes("sets.every("));
  for (let axis = 0; axis < 3; axis++) {
    const mutant = runInNewContext(
      `(${source.replace("sets.every(", `sets.filter((_,index)=>index!==${axis}).every(`)})`,
      {
        Set,
        normalizedIdSet: (value: { stdout: string }) =>
          new Set(value.stdout ? [value.stdout] : []),
      },
    ) as typeof normalizeContainerAbsence;
    const empty = { status: 0, stdout: "" };
    const input: Parameters<typeof normalizeContainerAbsence> = [
      empty,
      empty,
      empty,
    ];
    input[axis] = { status: 0, stdout: "a".repeat(64) };
    assert.equal(normalizeContainerAbsence(...input).status, "blocked");
    assert.throws(() => assert.equal(mutant(...input).status, "blocked"));
  }
});

/**
 * 生出力分類の理由優先順と独立したlifecycle条件を反証する。
 * @responsibility 隔離結果の肯定をSignal・経過時間・stderrの成功へ転用しない。
 * @trace ERB-UT-038
 * @precondition 正常JSONを独立に構成する。
 * @stimulus 正常、期限、容量、非0、不正JSON、余分field、Signal、時間不正。
 * @observation 隔離reasonとlifecycle reason／status。
 * @oracle 元の優先順を保持し、生出力本文を返さない。
 * @cleanup N/A: 値分類だけ。
 * @boundary 捕捉観測値→DI分類。実Process終了の証明ではない。
 */
test("Probe完了分類は既存の理由優先順と閉じた事実を保持する", () => {
  const payload = {
    marker: "crdd-coordinator-isolation-v1",
    allowed_writes: { workspace: true, "provider-home": true, tmp: true },
    runtime_paths_absent: true,
    credential_names_absent: true,
    network_blocked: true,
    home_isolated: true,
    tmp_isolated: true,
  };
  const execution = {
    status: 0,
    signal: null,
    stdout: JSON.stringify(payload),
    stderr: "",
  };
  const fixtures = [
    [
      { error: Object.assign(new Error("fixture"), { code: "ETIMEDOUT" }) },
      "docker_isolation_probe_timeout",
      "dynamic_fake_provider_deadline_exceeded",
    ],
    [
      { error: Object.assign(new Error("fixture"), { code: "ENOBUFS" }) },
      "docker_isolation_probe_output_too_large",
      "dynamic_fake_provider_output_limit_exceeded",
    ],
    [
      { status: 7 },
      "docker_isolation_probe_failed",
      "dynamic_fake_provider_execution_envelope_invalid",
    ],
    [
      { stdout: "invalid" },
      "docker_isolation_probe_invalid_output",
      "docker_isolation_probe_invalid_output",
    ],
    [
      { stdout: JSON.stringify({ ...payload, extra: true }) },
      "docker_isolation_probe_assertion_failed",
      "docker_isolation_probe_assertion_failed",
    ],
    [
      { stdout: "x".repeat(65537) },
      "docker_isolation_probe_output_too_large",
      "dynamic_fake_provider_execution_envelope_invalid",
    ],
    [
      { signal: "SIGTERM" as const },
      "docker_fake_provider_isolation_confirmed",
      "dynamic_fake_provider_execution_envelope_invalid",
    ],
    [
      { stderr: "x".repeat(65537) },
      "docker_fake_provider_isolation_confirmed",
      "dynamic_fake_provider_execution_envelope_invalid",
    ],
  ] as const;
  for (const [changes, isolationReason, lifecycleReason] of fixtures) {
    const result = classifyDockerProbeExecution(
      { ...execution, ...changes },
      5,
    );
    assert.equal(result.isolation.reason, isolationReason);
    assert.equal(result.lifecycleReason, lifecycleReason);
    assert.equal(result.lifecycleStatus, "blocked");
    assert.equal(
      "stdout" in result || "stderr" in result || "error" in result,
      false,
    );
  }
  for (const elapsed of [-1, 30001, 0.5, Number.NaN]) {
    const result = classifyDockerProbeExecution(execution, elapsed);
    assert.equal(result.isolation.status, "confirmed");
    assert.equal(
      result.lifecycleReason,
      "dynamic_fake_provider_elapsed_invalid",
    );
    assert.equal(result.elapsedMs, null);
  }
});

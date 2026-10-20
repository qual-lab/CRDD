/**
 * 診断Probeの作成ID・三軸不存在・完了応答を分類する。
 * @packageDocumentation
 * @responsibility CLI観測値の純粋分類を所有し、Host状態と回復Authorityは扱わない。
 * @trace ARCH-000008
 * @boundary Process内の観測値。実Docker観測・削除は行わない。
 */
import type { SpawnSyncReturns } from "node:child_process";

const MAX_OUTPUT_BYTES = 64 * 1024;
const PROBE_MARKER = "crdd-coordinator-isolation-v1";

/**
 * 固定取消の出力・終了値・猶予時間を閉じた事実へ分類する。
 * @responsibility 取消候補と実資源回収の成立を分離する。
 * @trace ARCH-000008
 * @input execution: Process観測、graceElapsedMs: 実計測、isCancellationRequested: 要求事実。
 * @returns 生出力を持たない取消候補。
 * @precondition SIGTERMの実発行とHandle終端は呼出し元が別に観測する。
 * @postcondition 値分類からContainer不存在やHost清掃を主張しない。
 * @effect N/A: 入力値だけの分類。
 * @failure 欠測・出力差・終了差・猶予超過は既存の理由でblocked。
 * @invariant 要求なし→猶予→出力→終了値の理由優先順を維持する。
 * @boundary 下位Process観測と機密を含まない技術事実。
 * @security stdout・stderr本文や例外本文を返さない。
 * @concurrency 同期分類だけ。
 */
export function classifyDockerProbeCancellation(
  execution: DockerExecution,
  graceElapsedMs: number,
  isCancellationRequested: boolean,
) {
  const ready = '{"marker":"crdd-coordinator-cancellation-v1","state":"ready"}';
  const acknowledged =
    '{"marker":"crdd-coordinator-cancellation-v1","state":"cancelled"}';
  const stdout = typeof execution.stdout === "string" ? execution.stdout : "";
  const stderr = typeof execution.stderr === "string" ? execution.stderr : "";
  const stdoutBytes = Buffer.byteLength(stdout, "utf8");
  const stderrBytes = Buffer.byteLength(stderr, "utf8");
  const validGrace =
    Number.isSafeInteger(graceElapsedMs) &&
    graceElapsedMs >= 0 &&
    graceElapsedMs <= 5_000;
  const exactOutput =
    stdout === `${ready}\n${acknowledged}\n` &&
    stderr === "" &&
    stdoutBytes <= MAX_OUTPUT_BYTES &&
    stderrBytes <= MAX_OUTPUT_BYTES;
  const exactTermination =
    !execution.error &&
    execution.status === 42 &&
    (execution.signal === null || execution.signal === undefined);
  const candidate =
    isCancellationRequested && validGrace && exactOutput && exactTermination;
  return Object.freeze({
    status: candidate ? ("candidate" as const) : ("blocked" as const),
    reason: candidate
      ? "dynamic_fake_provider_cancellation_candidate"
      : !isCancellationRequested
        ? "dynamic_fake_provider_cancellation_not_requested"
        : !validGrace
          ? "dynamic_fake_provider_cancellation_grace_exceeded"
          : !exactOutput
            ? "dynamic_fake_provider_cancellation_acknowledgement_invalid"
            : "dynamic_fake_provider_cancellation_termination_invalid",
    cancellationRequested: isCancellationRequested,
    cancellationSignalRequested: isCancellationRequested
      ? ("SIGTERM" as const)
      : null,
    readyObserved: stdout.startsWith(`${ready}\n`),
    cancellationAcknowledged: candidate,
    processTerminationObserved: candidate,
    graceElapsedMs: validGrace ? graceElapsedMs : null,
    stdoutBytes,
    stderrBytes,
    exitCode: typeof execution.status === "number" ? execution.status : null,
    signal: typeof execution.signal === "string" ? execution.signal : null,
  });
}

/**
 * 診断CLI応答の分類入力。
 * @responsibility 欠測fieldを成功へ補完せず受ける。
 * @trace ARCH-000008
 * @shape Node同期Process観測の部分値。
 * @invariant 実資源やAuthorityを保持しない。
 * @boundary CLI観測と値分類。
 * @security 生出力を診断へ公開する許可を含まない。
 * @compatibility 移管元の入力形を維持する。
 */
type DockerExecution = Partial<
  Pick<
    SpawnSyncReturns<string>,
    "error" | "signal" | "status" | "stderr" | "stdout"
  >
>;

/**
 * Container Idが有効か判定する。
 *
 * @responsibility Container Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000008
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidContainerIdの入力契約を満たす。
 * @postcondition validContainerIdの責務を完了した結果だけを返す。
 * @effect N/A: validContainerIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validContainerIdは独自の失敗分岐を所有しない。
 * @invariant validContainerIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validContainerIdはProcess内の同一Subsystemで完結する。
 * @security validContainerIdはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: validContainerIdは共有非同期状態を持たない同期処理である。
 */
function validContainerId(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value.trim());
}

/**
 * Container Creationを固定Schemaへ正規化する。
 *
 * @responsibility Container Creationの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input execution: DockerExecution
 * @returns | Readonly<{ status: "confirmed"; id: string }> | Readonly<{ status: "blocked"; reason: "docker_container_identity_unknown"; }>を返す。
 * @precondition 「execution: DockerExecution」がnormalizeContainerCreationの入力契約を満たす。
 * @postcondition normalizeContainerCreationの責務を完了した結果だけを返す。
 * @effect N/A: normalizeContainerCreationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeContainerCreationは独自の失敗分岐を所有しない。
 * @invariant normalizeContainerCreationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeContainerCreationはProcess内の同一Subsystemで完結する。
 * @security normalizeContainerCreationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeContainerCreationは共有非同期状態を持たない同期処理である。
 */
export function normalizeContainerCreation(execution: DockerExecution):
  | Readonly<{ status: "confirmed"; id: string }>
  | Readonly<{
      status: "blocked";
      reason: "docker_container_identity_unknown";
    }> {
  if (
    execution?.error ||
    execution?.status !== 0 ||
    !validContainerId(execution?.stdout)
  ) {
    return { status: "blocked", reason: "docker_container_identity_unknown" };
  }
  return { status: "confirmed", id: execution.stdout.trim() };
}

/**
 * Id Setを固定Schemaへ正規化する。
 *
 * @responsibility Id Setの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input execution: DockerExecution
 * @returns Set<string> | nullを返す。
 * @precondition 「execution: DockerExecution」がnormalizedIdSetの入力契約を満たす。
 * @postcondition normalizedIdSetの責務を完了した結果だけを返す。
 * @effect N/A: normalizedIdSetは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizedIdSetは独自の失敗分岐を所有しない。
 * @invariant normalizedIdSetは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizedIdSetはProcess内の同一Subsystemで完結する。
 * @security normalizedIdSetはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizedIdSetは共有非同期状態を持たない同期処理である。
 */
function normalizedIdSet(execution: DockerExecution): Set<string> | null {
  if (
    execution?.error ||
    execution?.status !== 0 ||
    typeof execution?.stdout !== "string" ||
    Buffer.byteLength(execution.stdout, "utf8") > MAX_OUTPUT_BYTES
  )
    return null;
  const lines = execution.stdout
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    lines.some((line) => !validContainerId(line)) ||
    new Set(lines).size !== lines.length
  )
    return null;
  return new Set(lines);
}

/**
 * Container Absenceを固定Schemaへ正規化する。
 *
 * @responsibility Container Absenceの入力検証、正規化規則、不正値の拒否境界を所有する。
 * @trace ARCH-000008
 * @input idExecution: DockerExecution、nameExecution: DockerExecution、labelExecution: DockerExecution
 * @returns normalizeContainerAbsenceの計算結果を返す。
 * @precondition 「idExecution: DockerExecution、nameExecution: DockerExecution、labelExecution: DockerExecution」がnormalizeContainerAbsenceの入力契約を満たす。
 * @postcondition normalizeContainerAbsenceの責務を完了した結果だけを返す。
 * @effect N/A: normalizeContainerAbsenceは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizeContainerAbsenceは独自の失敗分岐を所有しない。
 * @invariant normalizeContainerAbsenceは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizeContainerAbsenceはProcess内の同一Subsystemで完結する。
 * @security normalizeContainerAbsenceはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizeContainerAbsenceは共有非同期状態を持たない同期処理である。
 */
export function normalizeContainerAbsence(
  idExecution: DockerExecution,
  nameExecution: DockerExecution,
  labelExecution: DockerExecution,
) {
  const sets = [idExecution, nameExecution, labelExecution].map(
    normalizedIdSet,
  );
  const isConfirmed = sets.every((set) => set instanceof Set && set.size === 0);
  return isConfirmed
    ? { status: "confirmed", reason: "docker_probe_absence_confirmed" }
    : { status: "blocked", reason: "docker_probe_absence_unconfirmed" };
}

/**
 * JSONで得た閉じた診断Recordかを確認する。
 * @responsibility 余分なfield・配列・nullを結果一致へ採用しない。
 * @trace ARCH-000008
 * @input value: JSON.parseの結果、keys: 許可field。
 * @returns 許可fieldだけのRecordかどうか。
 * @precondition 入力はこのModuleのJSON.parseから得る。
 * @postcondition 入力を変更しない。
 * @effect N/A: 値の確認だけ。
 * @failure 不正なJSON形はfalse。
 * @invariant 不足fieldの意味は後続のtrue照合で拒否する。
 * @boundary 診断JSONと固定結果。
 * @security 任意objectやcallbackを実行しない。
 * @concurrency 同期確認だけ。
 */
function isProbeJsonRecord(
  value: unknown,
  keys: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

/**
 * 診断の完了観測を既存の隔離判定と実行事実へ分類する。
 * @responsibility 生出力を返さず、判定理由・計測・終了値を保持する。
 * @trace ARCH-000008
 * @input execution: 元のProcess観測、elapsedMs: 同じ呼出しの実測値。
 * @returns 隔離判定と後続lifecycle評価に必要な閉事実。
 * @precondition 本番ではDIの所有要求から得た観測を使う。
 * @postcondition 値分類を資源不存在やHost清掃へ昇格しない。
 * @effect N/A: 純粋分類だけ。
 * @failure 期限・容量・不正JSON・非0・Signal・時間不正を区別する。
 * @invariant 既存の理由優先順と30秒の計測評価上限を維持する。
 * @boundary 捕捉出力と上位への最小事実。
 * @security stdout／stderr本文と例外本文を返さない。
 * @concurrency 同期分類だけ。
 */
export function classifyDockerProbeExecution(
  execution: DockerExecution,
  elapsedMs: number,
) {
  const code =
    execution.error && typeof execution.error === "object"
      ? Object.getOwnPropertyDescriptor(execution.error, "code")?.value
      : undefined;
  const timedOut = code === "ETIMEDOUT";
  const outputExceeded = code === "ENOBUFS";
  const stdoutBytes =
    typeof execution.stdout === "string"
      ? Buffer.byteLength(execution.stdout, "utf8")
      : 0;
  const stderrBytes =
    typeof execution.stderr === "string"
      ? Buffer.byteLength(execution.stderr, "utf8")
      : 0;
  let reason: string;
  let confirmed = false;
  if (timedOut) reason = "docker_isolation_probe_timeout";
  else if (outputExceeded) reason = "docker_isolation_probe_output_too_large";
  else if (
    execution.error ||
    execution.status !== 0 ||
    typeof execution.stdout !== "string"
  )
    reason = "docker_isolation_probe_failed";
  else if (stdoutBytes > 64 * 1024)
    reason = "docker_isolation_probe_output_too_large";
  else {
    try {
      const parsed: unknown = JSON.parse(execution.stdout.trim());
      const record = isProbeJsonRecord(parsed, [
        "marker",
        "allowed_writes",
        "runtime_paths_absent",
        "credential_names_absent",
        "network_blocked",
        "home_isolated",
        "tmp_isolated",
      ])
        ? parsed
        : null;
      const writes =
        record &&
        isProbeJsonRecord(record.allowed_writes, [
          "workspace",
          "provider-home",
          "tmp",
        ])
          ? record.allowed_writes
          : null;
      confirmed =
        record?.marker === PROBE_MARKER &&
        writes?.workspace === true &&
        writes?.["provider-home"] === true &&
        writes?.tmp === true &&
        record.runtime_paths_absent === true &&
        record.credential_names_absent === true &&
        record.network_blocked === true &&
        record.home_isolated === true &&
        record.tmp_isolated === true;
      reason = confirmed
        ? "docker_fake_provider_isolation_confirmed"
        : "docker_isolation_probe_assertion_failed";
    } catch {
      reason = "docker_isolation_probe_invalid_output";
    }
  }
  const validElapsed =
    Number.isSafeInteger(elapsedMs) && elapsedMs >= 0 && elapsedMs <= 30_000;
  const exactEnvelope =
    !execution.error &&
    execution.status === 0 &&
    (execution.signal === null || execution.signal === undefined) &&
    typeof execution.stdout === "string" &&
    typeof execution.stderr === "string" &&
    stdoutBytes <= 64 * 1024 &&
    stderrBytes <= 64 * 1024;
  return Object.freeze({
    isolation: Object.freeze({
      status: confirmed ? ("confirmed" as const) : ("blocked" as const),
      reason,
    }),
    lifecycleStatus:
      validElapsed && exactEnvelope && confirmed
        ? ("candidate" as const)
        : ("blocked" as const),
    lifecycleReason: timedOut
      ? "dynamic_fake_provider_deadline_exceeded"
      : outputExceeded
        ? "dynamic_fake_provider_output_limit_exceeded"
        : !validElapsed
          ? "dynamic_fake_provider_elapsed_invalid"
          : !exactEnvelope
            ? "dynamic_fake_provider_execution_envelope_invalid"
            : confirmed
              ? "dynamic_fake_provider_result_observed"
              : reason,
    elapsedMs: validElapsed ? elapsedMs : null,
    stdoutBytes,
    stderrBytes,
    exitCode: typeof execution.status === "number" ? execution.status : null,
    signal: typeof execution.signal === "string" ? execution.signal : null,
    timedOut,
  });
}

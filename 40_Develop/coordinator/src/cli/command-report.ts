/**
 * command-reportに属する責務をまとめる。
 *
 * @responsibility SafeCommandReportを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000003
 */
/**
 * command-reportで使用するSafe Command Reportの値契約を定義する。
 *
 * @responsibility Safe Command ReportのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000003
 * @shape SafeCommandReportが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SafeCommandReportで宣言した値と責務の対応を維持する。
 * @boundary N/A: SafeCommandReportの宣言は外部境界を開かない。
 * @security N/A: SafeCommandReportはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SafeCommandReportの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SafeCommandReport = Readonly<{
  command: string;
  status: string;
  reason: string;
  filesystemEffectIssued?: boolean;
  cleanupConfirmed?: boolean;
  effectStateUnknown?: boolean;
  recoveryIdentityAmbiguous?: boolean;
  candidateId?: string | null;
  expiresAtMs?: number | null;
  manualRecoveryRequired?: boolean;
  processRestartRequired?: boolean;
  hostRecoveryId?: string | null;
  hostRecoveryIds?: readonly string[];
  dockerRecoveryId?: string | null;
  dockerRecoveryIds?: readonly string[];
  candidateRecoveryId?: string | null;
  candidateRecoveryIds?: readonly string[];
  candidateStoreRecoveryId?: string | null;
  candidateStoreRecoveryIds?: readonly string[];
}>;

const COMMAND_LABELS: Readonly<Record<string, string>> = Object.freeze({
  task: "依頼の実行",
  candidate: "候補の操作",
  "candidate export": "候補の書き出し",
  "candidate discard": "候補の破棄",
  "candidate recover-store": "候補保存領域の回復",
});
const STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  completed: "処理完了",
  blocked: "停止",
  exported: "書き出し完了",
  discarded: "破棄完了",
  recovered: "回復完了",
});
const REASON_EXPLANATIONS: Readonly<Record<string, string>> = Object.freeze({
  task_arguments_invalid: "依頼の起動引数を確認してください。",
  task_request_invalid_json: "依頼のJSON形式を確認してください。",
  candidate_arguments_invalid: "候補操作の引数を確認してください。",
  coordinator_task_release_verification_required:
    "検証済みの配布物が必要です。通常利用者がRelease秘密鍵を入力する必要はありません。",
  coordinator_task_workload_split_required:
    "依頼が一回の作業量上限を超えています。範囲を分割してください。",
  provider_turn_limit_exceeded:
    "Providerの実行回数上限に達しました。依頼範囲を確認してください。自動再試行はしません。",
  provider_process_exit_nonzero:
    "Providerの処理が正常終了しませんでした。原因を推測して再実行しません。",
  coordinator_task_cancellation_protocol_failed_cleanup_confirmed:
    "取消の制御に不整合がありました。資源回収とProcess再起動の情報を確認してください。",
  coordinator_task_host_generation_protocol_failed_cleanup_confirmed:
    "実行世代の制御に不整合がありました。資源回収の情報を確認してください。",
  candidate_not_available_or_integrity_unconfirmed:
    "候補を取得できないか、同一性を確認できません。",
});
const CANDIDATE_ID_PATTERN = /^candidate\.[0-9a-f]{64}\.[0-9a-f]{64}$/u;
const HOST_RECOVERY_ID_PATTERN = /^host\.[a-zA-Z0-9._-]+$/u;
const DOCKER_RECOVERY_ID_PATTERN =
  /^(?:docker\.crdd-coordinator-doctor-[A-Za-z0-9_-]+\.[0-9a-f-]{36}\.[0-9a-f-]{36}\.[0-9a-f]{64}|docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64})$/u;
const CANDIDATE_RECOVERY_ID_PATTERN =
  /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u;
const STORE_RECOVERY_ID_PATTERN = /^candidate-store-recovery\.[0-9a-f]{64}$/u;

/**
 * Fixed Labelを対応表から取得する。
 *
 * @responsibility Fixed Labelの検索Key、既定値、未検出結果境界を所有する。
 * @trace ARCH-000003
 * @input labels: Readonly<Record<string, string>>、value: unknown
 * @returns lookupFixedLabelの計算結果を返す。
 * @precondition 「labels: Readonly<Record<string, string>>、value: unknown」がlookupFixedLabelの入力契約を満たす。
 * @postcondition lookupFixedLabelの責務を完了した結果だけを返す。
 * @effect N/A: lookupFixedLabelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: lookupFixedLabelは独自の失敗分岐を所有しない。
 * @invariant lookupFixedLabelは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: lookupFixedLabelはProcess内の同一Subsystemで完結する。
 * @security N/A: lookupFixedLabelはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: lookupFixedLabelは共有非同期状態を持たない同期処理である。
 */
function lookupFixedLabel(
  labels: Readonly<Record<string, string>>,
  value: unknown,
) {
  return typeof value === "string" && Object.hasOwn(labels, value)
    ? labels[value]
    : undefined;
}
/**
 * Reported Booleanの公開契約を記述する。
 *
 * @responsibility Reported Booleanの公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000003
 * @input value: unknown
 * @returns describeReportedBooleanの計算結果を返す。
 * @precondition 「value: unknown」がdescribeReportedBooleanの入力契約を満たす。
 * @postcondition describeReportedBooleanの責務を完了した結果だけを返す。
 * @effect N/A: describeReportedBooleanは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeReportedBooleanは独自の失敗分岐を所有しない。
 * @invariant describeReportedBooleanは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeReportedBooleanはProcess内の同一Subsystemで完結する。
 * @security N/A: describeReportedBooleanはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeReportedBooleanは共有非同期状態を持たない同期処理である。
 */
function describeReportedBoolean(value: unknown) {
  return value === true ? "あり" : value === false ? "なし" : "未確認";
}
/**
 * 回復 Idsを収集する。
 *
 * @responsibility 回復 Idsの収集範囲、重複排除、欠落時の結果境界を所有する。
 * @trace ARCH-000003
 * @input single: unknown、multiple: unknown、pattern: RegExp
 * @returns collectRecoveryIdsの計算結果を返す。
 * @precondition 「single: unknown、multiple: unknown、pattern: RegExp」がcollectRecoveryIdsの入力契約を満たす。
 * @postcondition collectRecoveryIdsの責務を完了した結果だけを返す。
 * @effect N/A: collectRecoveryIdsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: collectRecoveryIdsは独自の失敗分岐を所有しない。
 * @invariant collectRecoveryIdsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: collectRecoveryIdsはProcess内の同一Subsystemで完結する。
 * @security N/A: collectRecoveryIdsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: collectRecoveryIdsは共有非同期状態を持たない同期処理である。
 */
function collectRecoveryIds(
  single: unknown,
  multiple: unknown,
  pattern: RegExp,
) {
  return [
    ...new Set([single, ...(Array.isArray(multiple) ? multiple : [])]),
  ].filter(
    (value): value is string =>
      typeof value === "string" && pattern.test(value),
  );
}

/**
 * Safe Human Command Reportを人間向け表示へ整形する。
 *
 * @responsibility Safe Human Command Reportの入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000003
 * @input report: SafeCommandReport
 * @returns renderSafeHumanCommandReportの計算結果を返す。
 * @precondition 「report: SafeCommandReport」がrenderSafeHumanCommandReportの入力契約を満たす。
 * @postcondition renderSafeHumanCommandReportの責務を完了した結果だけを返す。
 * @effect N/A: renderSafeHumanCommandReportは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: renderSafeHumanCommandReportは独自の失敗分岐を所有しない。
 * @invariant renderSafeHumanCommandReportは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: renderSafeHumanCommandReportはProcess内の同一Subsystemで完結する。
 * @security N/A: renderSafeHumanCommandReportはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: renderSafeHumanCommandReportは共有非同期状態を持たない同期処理である。
 */
export function renderSafeHumanCommandReport(report: SafeCommandReport) {
  const commandLabel =
    lookupFixedLabel(COMMAND_LABELS, report.command) ?? "操作不明";
  const statusLabel =
    lookupFixedLabel(STATUS_LABELS, report.status) ?? "判定不能";
  const lines = [`Coordinator：${commandLabel} — ${statusLabel}`];
  const isCompletedTask =
    report.command === "task" && report.status === "completed";
  const isCompletedCandidateOperation =
    (report.command === "candidate export" && report.status === "exported") ||
    (report.command === "candidate discard" && report.status === "discarded") ||
    (report.command === "candidate recover-store" &&
      report.status === "recovered");
  if (isCompletedTask) {
    lines.push(
      "候補の作成・検証が完了しました。正本への採用・公開は別の判断です。",
    );
  } else if (isCompletedCandidateOperation) {
    lines.push("対象の操作が完了しました。正本への採用・公開を意味しません。");
  } else {
    const explanation = lookupFixedLabel(REASON_EXPLANATIONS, report.reason);
    lines.push(
      explanation ??
        "詳しい原因はこの表示から確定できません。実行担当者が機械向け結果を確認してください。",
    );
    if (explanation) lines.push(`診断コード: ${report.reason}`);
  }
  lines.push(
    `ファイル操作の発行: ${describeReportedBoolean(report.filesystemEffectIssued)}`,
    `資源回収: ${report.cleanupConfirmed === true ? "確認済み" : "未確認"}`,
    `手動回復の必要性: ${describeReportedBoolean(report.manualRecoveryRequired)}`,
    `Process再起動の必要性: ${describeReportedBoolean(report.processRestartRequired)}`,
  );
  if (report.effectStateUnknown === true)
    lines.push("実行した操作の状態が不明です。");
  if (report.recoveryIdentityAmbiguous === true)
    lines.push("回復対象を一意に確認できません。");
  const recoveryGroups = [
    {
      label: "Host回復ID",
      ids: collectRecoveryIds(
        report.hostRecoveryId,
        report.hostRecoveryIds,
        HOST_RECOVERY_ID_PATTERN,
      ),
    },
    {
      label: "Docker回復ID",
      ids: collectRecoveryIds(
        report.dockerRecoveryId,
        report.dockerRecoveryIds,
        DOCKER_RECOVERY_ID_PATTERN,
      ),
    },
    {
      label: "候補回復ID",
      ids: collectRecoveryIds(
        report.candidateRecoveryId,
        report.candidateRecoveryIds,
        CANDIDATE_RECOVERY_ID_PATTERN,
      ),
    },
    {
      label: "候補保存領域の回復ID",
      ids: collectRecoveryIds(
        report.candidateStoreRecoveryId,
        report.candidateStoreRecoveryIds,
        STORE_RECOVERY_ID_PATTERN,
      ),
    },
  ];
  const hasRecoveryIds = recoveryGroups.some((group) => group.ids.length > 0);
  const isRecoveryUncertain =
    report.manualRecoveryRequired !== false ||
    report.cleanupConfirmed !== true ||
    report.effectStateUnknown === true ||
    report.recoveryIdentityAmbiguous === true ||
    hasRecoveryIds;
  if (report.processRestartRequired === true) {
    lines.push(
      "次の操作: 現在のProcessを再利用せず、Coordinator Runtimeを再起動してください。回復義務は再起動だけでは解消しません。",
    );
  }
  for (const group of recoveryGroups) {
    for (const id of group.ids) lines.push(`${group.label}: ${id}`);
  }
  if (hasRecoveryIds) {
    lines.push(
      "次の操作: 上記IDを保持し、対象に対応する回復手順へ進んでください。IDの表示だけで回復実行が許可されたとは扱いません。",
    );
  } else if (
    report.manualRecoveryRequired === true ||
    report.effectStateUnknown === true ||
    report.recoveryIdentityAmbiguous === true
  ) {
    lines.push(
      "次の操作: 実行担当者へ引き渡してください。確認済みの回復IDがないため、推測した削除や再試行は行わないでください。",
    );
  }
  if (
    typeof report.candidateId === "string" &&
    CANDIDATE_ID_PATTERN.test(report.candidateId)
  ) {
    lines.push(`候補ID: ${report.candidateId}`);
    const expiry = report.expiresAtMs;
    if (
      typeof expiry === "number" &&
      Number.isSafeInteger(expiry) &&
      expiry >= 0 &&
      expiry <= 8_640_000_000_000_000
    ) {
      lines.push(`候補の書き出し期限: ${new Date(expiry).toISOString()}`);
    } else {
      lines.push("候補の書き出し期限: 未確認");
    }
    if (
      isCompletedTask &&
      !isRecoveryUncertain &&
      report.processRestartRequired === false
    ) {
      lines.push(
        `候補を確認する: coordinator candidate export --candidate-id ${report.candidateId} --json`,
        `候補を破棄する: coordinator candidate discard --candidate-id ${report.candidateId}`,
      );
    } else if (!isCompletedCandidateOperation) {
      lines.push(
        "候補操作は案内しません。結果・回復・再起動の状態を確認してから判断してください。",
      );
    }
  }
  return `${lines.join("\n")}\n`;
}

/**
 * Command Report 契約の公開契約を記述する。
 *
 * @responsibility Command Report 契約の公開field、非公開境界、互換性を所有する。
 * @trace ARCH-000003
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeCommandReportContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeCommandReportContractの入力契約を満たす。
 * @postcondition describeCommandReportContractの責務を完了した結果だけを返す。
 * @effect N/A: describeCommandReportContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeCommandReportContractは独自の失敗分岐を所有しない。
 * @invariant describeCommandReportContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeCommandReportContractはProcess内の同一Subsystemで完結する。
 * @security N/A: describeCommandReportContractはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: describeCommandReportContractは共有非同期状態を持たない同期処理である。
 */
export function describeCommandReportContract() {
  return Object.freeze({
    humanProjection:
      "status_reason_effect_candidate_expiry_recovery_identifiers_manual_recovery_and_runtime_owned_process_restart_only",
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

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
  activate: "有効化",
  disable: "無効化",
  provision: "実行環境の準備",
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
  runtime_activation_effect_not_implemented: "この有効化操作は未接続です。",
  runtime_disable_effect_not_implemented: "この無効化操作は未接続です。",
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

function lookupFixedLabel(
  labels: Readonly<Record<string, string>>,
  value: unknown,
) {
  return typeof value === "string" && Object.hasOwn(labels, value)
    ? labels[value]
    : undefined;
}
function describeReportedBoolean(value: unknown) {
  return value === true ? "あり" : value === false ? "なし" : "未確認";
}
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

export function describeCommandReportContract() {
  return Object.freeze({
    humanProjection:
      "status_reason_effect_candidate_expiry_recovery_identifiers_manual_recovery_and_runtime_owned_process_restart_only",
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

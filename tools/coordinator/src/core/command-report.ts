export type SafeCommandReport = Readonly<{
  command: string;
  status: string;
  reason: string;
  filesystemEffectIssued?: boolean;
  candidateId?: string | null;
  expiresAtMs?: number | null;
  manualRecoveryRequired?: boolean;
  hostRecoveryId?: string | null;
  dockerRecoveryId?: string | null | undefined;
  dockerRecoveryIds?: readonly string[] | undefined;
  candidateRecoveryId?: string | null;
  candidateStoreRecoveryId?: string | null;
}>;

export function renderSafeHumanCommandReport(report: SafeCommandReport) {
  const lines = [
    `Coordinator ${report.command}: ${report.status}`,
    `- reason: ${report.reason}`,
    `- filesystem effect issued: ${report.filesystemEffectIssued === true ? "yes" : "no"}`,
  ];
  if (
    typeof report.candidateId === "string" &&
    /^candidate\.[0-9a-f]{64}\.[0-9a-f]{64}$/u.test(report.candidateId)
  ) {
    lines.push(`- candidate ID: ${report.candidateId}`);
    const expiresAtMs = report.expiresAtMs;
    if (Number.isSafeInteger(expiresAtMs) && Number(expiresAtMs) >= 0) {
      lines.push(
        `- candidate export expires at: ${new Date(Number(expiresAtMs)).toISOString()}`,
      );
    }
    lines.push(
      `- next: coordinator candidate export --candidate-id ${report.candidateId} --json`,
      `- discard: coordinator candidate discard --candidate-id ${report.candidateId}`,
    );
  }
  const recoveryFields = [
    ["host recovery ID", report.hostRecoveryId, /^host\.[a-zA-Z0-9._-]+$/u],
    [
      "Docker recovery ID",
      report.dockerRecoveryId,
      /^(?:docker\.crdd-coordinator-doctor-[A-Za-z0-9_-]+\.[0-9a-f-]{36}\.[0-9a-f-]{36}\.[0-9a-f]{64}|docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64})$/u,
    ],
    [
      "Candidate recovery ID",
      report.candidateRecoveryId,
      /^candidate-recovery\.[0-9a-f]{64}\.[0-9a-f]{64}$/u,
    ],
    [
      "Candidate Store recovery ID",
      report.candidateStoreRecoveryId,
      /^candidate-store-recovery\.[0-9a-f]{64}$/u,
    ],
  ] as const;
  const dockerRecoveryIds = [
    ...(Array.isArray(report.dockerRecoveryIds)
      ? report.dockerRecoveryIds
      : []),
    ...(typeof report.dockerRecoveryId === "string"
      ? [report.dockerRecoveryId]
      : []),
  ].filter((value, index, values) => values.indexOf(value) === index);
  for (const recoveryId of dockerRecoveryIds) {
    if (
      /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
        recoveryId,
      )
    ) {
      lines.push(
        `- Docker recovery ID: ${recoveryId}`,
        `- next: coordinator doctor --recover-isolation ${recoveryId}`,
      );
    }
  }
  for (const [label, value, pattern] of recoveryFields) {
    if (typeof value === "string" && pattern.test(value)) {
      if (label === "Docker recovery ID" && dockerRecoveryIds.includes(value))
        continue;
      lines.push(`- ${label}: ${value}`);
      if (label === "host recovery ID") {
        lines.push(
          "- next: restart Coordinator Runtime before starting another task",
          "- next: retain this exact host recovery ID for the signed recovery entry or runtime operator; recovery is not promised when identity evidence is inconsistent",
        );
      }
    }
  }
  const hasActionableRecoveryId = lines.some((line) =>
    line.includes(" recovery ID:"),
  );
  if (report.manualRecoveryRequired === true && !hasActionableRecoveryId) {
    lines.push(
      "- next: restart Coordinator Runtime before starting another task",
      "- next: escalate to the runtime operator because no authenticated actionable recovery ID is available",
    );
  }
  lines.push(
    `- manual recovery required: ${report.manualRecoveryRequired === true ? "yes" : "no"}`,
  );
  return `${lines.join("\n")}\n`;
}

export function describeCommandReportContract() {
  return Object.freeze({
    humanProjection:
      "status_reason_effect_candidate_expiry_recovery_identifiers_and_manual_recovery_only",
    rawProviderOutputReported: false,
    hostPathReported: false,
    credentialReported: false,
  });
}

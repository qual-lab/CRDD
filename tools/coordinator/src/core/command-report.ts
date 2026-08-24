export type SafeCommandReport = Readonly<{
  command: string;
  status: string;
  reason: string;
  filesystemEffectIssued?: boolean;
  candidateId?: string | null;
  expiresAtMs?: number | null;
  manualRecoveryRequired?: boolean;
  hostRecoveryId?: string | null;
  dockerRecoveryId?: string | null;
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
      /^docker\.[a-zA-Z0-9._-]+$/u,
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
  for (const [label, value, pattern] of recoveryFields) {
    if (typeof value === "string" && pattern.test(value)) {
      lines.push(`- ${label}: ${value}`);
    }
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

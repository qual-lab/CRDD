import { types as utilTypes } from "node:util";

function plainRecord(value: unknown): Readonly<Record<string, unknown>> | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    utilTypes.isProxy(value)
  )
    return null;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function plainArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) && !utilTypes.isProxy(value) ? value : [];
}

export function renderDockerRecoveryDoctorReport(
  report: unknown,
  shouldOutputJson: boolean,
) {
  const reportValue = plainRecord(report);
  if (!reportValue || typeof reportValue.status !== "string")
    throw new Error("diagnostic_failed");
  if (shouldOutputJson) {
    const isRepairReport =
      reportValue.contract === "crdd-coordinator/docker-desktop-runtime-repair";
    const repairSucceeded =
      isRepairReport &&
      ["closed_retained", "closed_historical_effect_unknown_retained"].includes(
        reportValue.status,
      ) &&
      reportValue.nativeHelperCleanupConfirmed === true &&
      reportValue.newRepairPermitted === true;
    return Object.freeze({
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      exitCode: (isRepairReport
        ? repairSucceeded
          ? [reportValue.status]
          : []
        : ["ready", "recovered"]
      ).includes(reportValue.status)
        ? 0
        : 2,
    });
  }
  if (
    reportValue.contract === "crdd-coordinator/docker-desktop-runtime-repair"
  ) {
    const tri = (value: unknown) =>
      value === true ? "yes" : value === false ? "no" : "unknown";
    const lines = [`Coordinator Docker Desktop repair: ${reportValue.status}`];
    if (
      typeof reportValue.reason === "string" &&
      /^[a-z0-9_]{1,128}$/u.test(reportValue.reason)
    )
      lines.push(`- reason: ${reportValue.reason}`);
    if (
      typeof reportValue.repairId === "string" &&
      /^docker-desktop-repair\.[a-f0-9]{32}$/u.test(reportValue.repairId)
    )
      lines.push(`- repair ID: ${reportValue.repairId}`);
    lines.push(`- Docker Engine ready: ${tri(reportValue.engineReady)}`);
    lines.push(
      `- Process Effect issued: ${tri(reportValue.processEffectIssued)}`,
    );
    lines.push(
      `- Process Effect confirmation: ${
        ["not_issued", "confirmed", "unknown"].includes(
          String(reportValue.processEffectConfirmation),
        )
          ? String(reportValue.processEffectConfirmation)
          : "unknown"
      }`,
    );
    lines.push(
      `- Filesystem Effect issued: ${tri(reportValue.filesystemEffectIssued)}`,
    );
    lines.push(
      `- Filesystem Effect confirmation: ${
        ["not_issued", "confirmed", "unknown"].includes(
          String(reportValue.filesystemEffectConfirmation),
        )
          ? String(reportValue.filesystemEffectConfirmation)
          : "unknown"
      }`,
    );
    lines.push(
      `- stale runtime evidence: ${
        ["absent", "retained", "unknown"].includes(
          String(reportValue.staleRuntimeDirectory),
        )
          ? String(reportValue.staleRuntimeDirectory)
          : "unknown"
      }`,
    );
    lines.push(`- deletion performed: no`);
    lines.push(
      `- evidence state: ${
        ["preserved", "not_preserved", "unknown"].includes(
          String(reportValue.evidenceState),
        )
          ? String(reportValue.evidenceState)
          : "unknown"
      }`,
    );
    lines.push(
      `- native helper cleanup confirmed: ${tri(
        reportValue.nativeHelperCleanupConfirmed,
      )}`,
    );
    lines.push(
      `- new repair permitted: ${tri(reportValue.newRepairPermitted)}`,
    );
    if (
      reportValue.status === "recovered_pending_close" &&
      typeof reportValue.repairId === "string" &&
      /^docker-desktop-repair\.[a-f0-9]{32}$/u.test(reportValue.repairId)
    ) {
      lines.push(
        "- next: no directory was deleted; explicitly accept retained evidence to close this repair record",
      );
      lines.push(
        `- command: coordinator doctor --close-docker-desktop-runtime-repair ${reportValue.repairId}`,
      );
    } else if (
      reportValue.manualRecoveryRequired === true ||
      reportValue.operatorActionRequired === true
    ) {
      lines.push(
        "- next: stop new repair attempts and contact the Runtime operator",
      );
      lines.push(
        "- retained evidence and stage records must not be deleted or renamed manually",
      );
      if (
        [
          "docker_desktop_repair_record_capacity_unavailable",
          "docker_desktop_repair_operation_capacity_unavailable",
        ].includes(String(reportValue.reason))
      )
        lines.push(
          "- capacity: do not retry, delete, or compact repair records",
        );
    } else if (reportValue.status === "closed_retained") {
      lines.push(
        "- result: repair record closed; stale runtime evidence remains intentionally retained",
      );
    } else if (
      reportValue.status === "closed_historical_effect_unknown_retained"
    ) {
      lines.push(
        "- result: repair record closed; no stale runtime directory was observed; historical Process Effect uncertainty and repair records remain intentionally retained",
      );
    }
    return Object.freeze({
      stdout: `${lines.join("\n")}\n`,
      exitCode:
        [
          "closed_retained",
          "closed_historical_effect_unknown_retained",
        ].includes(reportValue.status) &&
        reportValue.nativeHelperCleanupConfirmed === true &&
        reportValue.newRepairPermitted === true
          ? 0
          : 2,
    });
  }
  const lines = [`Coordinator environment: ${reportValue.status}`];
  if (
    typeof reportValue.reason === "string" &&
    /^[a-z0-9_]{1,128}$/u.test(reportValue.reason)
  )
    lines.push(`- reason: ${reportValue.reason}`);
  if (
    typeof reportValue.recoveryId === "string" &&
    /^(?:host\.[A-Za-z0-9._-]+|docker\.crdd-coordinator-doctor-[A-Za-z0-9_-]+\.[0-9a-f-]{36}\.[0-9a-f-]{36}\.[0-9a-f]{64}|docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64})$/u.test(
      reportValue.recoveryId,
    )
  ) {
    lines.push(`- recovery ID: ${reportValue.recoveryId}`);
    if (reportValue.manualRecoveryRequired === true) {
      lines.push(
        "- next: stop new tasks and provide this recovery ID to the Runtime operator; do not remove a resource by name or label alone",
      );
    } else
      lines.push(
        `- next: coordinator doctor --recover-isolation ${reportValue.recoveryId}`,
      );
  }
  if (reportValue.manualRecoveryRequired === true) {
    lines.push("- recovery: automatic recovery stopped");
    lines.push(
      reportValue.evidenceState === "preserved"
        ? "- recovery evidence: preserved"
        : reportValue.evidenceState === "not_preserved"
          ? "- recovery evidence: not preserved"
          : "- recovery evidence: preservation unknown",
    );
    if (typeof reportValue.recoveryId !== "string")
      lines.push(
        "- next: stop new tasks and provide the reason and recovery evidence state to the Runtime operator; no reusable recovery ID is available, and a resource must not be removed by name or label alone",
      );
  }
  const providers = plainRecord(reportValue.providers);
  for (const [name, providerValue] of Object.entries(providers ?? {})) {
    const provider = plainRecord(providerValue);
    lines.push(
      `- ${name}: ${provider?.located === true ? "located" : "not found"}; active probe not executed`,
    );
  }
  if (reportValue.credentials) lines.push("- credential values recorded: no");
  const filesystem = plainRecord(reportValue.filesystem);
  if (typeof filesystem?.enforcement === "string")
    lines.push(`- filesystem enforcement: ${filesystem.enforcement}`);
  const egress = plainRecord(reportValue.egress);
  if (typeof egress?.providerAllowlist === "string")
    lines.push(`- provider egress allowlist: ${egress.providerAllowlist}`);
  const runtimeRootEvaluation = plainRecord(reportValue.runtimeRootEvaluation);
  if (typeof runtimeRootEvaluation?.status === "string")
    lines.push(
      `- runtime root request: ${runtimeRootEvaluation.status}; activation not performed`,
    );
  const recovery = plainRecord(reportValue.recovery);
  if (recovery?.manualRecoveryRequired === true) {
    const recoveryReason =
      typeof recovery.reason === "string" ? recovery.reason : "unknown";
    lines.push(
      `- recovery: automatic recovery ID unavailable; manual safety action required (${recoveryReason})`,
    );
  } else if (
    recovery?.required === true &&
    typeof recovery.recoveryId === "string"
  )
    lines.push(
      "- recovery: run doctor --recover-isolation with the returned recovery ID",
    );
  const dockerTaskRecovery = plainRecord(reportValue.dockerTaskRecovery);
  const dockerRecoveryIds = plainArray(
    dockerTaskRecovery?.dockerRecoveryIds,
  ).filter(
    (value): value is string =>
      typeof value === "string" &&
      /^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(value),
  );
  if (dockerRecoveryIds.length > 0) {
    lines.push(`- Docker Task recoveries: ${dockerRecoveryIds.length}`);
    for (const dockerRecoveryId of dockerRecoveryIds) {
      lines.push(`  - recovery ID: ${dockerRecoveryId}`);
      lines.push(
        `    next: coordinator doctor --recover-isolation ${dockerRecoveryId}`,
      );
    }
  }
  const blockers = plainArray(reportValue.blockers);
  lines.push(`- blockers: ${blockers.length}`);
  for (const blockerValue of blockers) {
    const blocker = plainRecord(blockerValue);
    if (typeof blocker?.id === "string" && typeof blocker.reason === "string")
      lines.push(`  - ${blocker.id}: ${blocker.reason}`);
  }
  return Object.freeze({
    stdout: `${lines.join("\n")}\n`,
    exitCode: ["ready", "recovered"].includes(reportValue.status) ? 0 : 2,
  });
}

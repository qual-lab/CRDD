import { renderDockerRecoveryDoctorReport } from "./docker-recovery-command-report.ts";

export type DockerDesktopRepairDoctorCommand = Readonly<{
  json: boolean;
  repairDockerDesktopRuntime: boolean;
  closeDockerDesktopRepairId: string | null;
}>;

type DockerDesktopRepairDoctorHandlers = Readonly<{
  repair: () => Promise<unknown>;
  close: (repairId: string) => Promise<unknown>;
}>;

export async function dispatchDockerDesktopRepairDoctorCommand(
  command: DockerDesktopRepairDoctorCommand,
  handlers: DockerDesktopRepairDoctorHandlers,
) {
  let report: unknown;
  try {
    report = command.repairDockerDesktopRuntime
      ? await handlers.repair()
      : command.closeDockerDesktopRepairId !== null
        ? await handlers.close(command.closeDockerDesktopRepairId)
        : null;
  } catch {
    report = Object.freeze({
      contract: "crdd-coordinator/docker-desktop-runtime-repair",
      contractRevision: 4,
      status: "blocked",
      reason: "docker_desktop_repair_dispatch_failed_closed",
      deletionPerformed: false,
      pathReported: false,
      credentialReported: false,
      providerEffectIssued: false,
    });
  }
  return report === null
    ? null
    : renderDockerRecoveryDoctorReport(report, command.json);
}

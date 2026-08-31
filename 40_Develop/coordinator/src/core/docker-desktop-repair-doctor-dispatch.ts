import { renderDockerRecoveryDoctorReport } from "./docker-recovery-command-report.ts";
import {
  DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT,
  DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION,
  type DockerDesktopRuntimeRepairReport,
} from "../security/docker-desktop-runtime-repair.ts";

export type DockerDesktopRepairDoctorCommand = Readonly<{
  json: boolean;
  repairDockerDesktopRuntime: boolean;
  closeDockerDesktopRepairId: string | null;
  adoptDockerDesktopRepairId?: string;
  historicalReleaseRoot?: string;
}>;

type DockerDesktopRepairDoctorHandlers = Readonly<{
  repair: () => Promise<DockerDesktopRuntimeRepairReport>;
  close: (repairId: string) => Promise<DockerDesktopRuntimeRepairReport>;
  adopt?: (
    repairId: string,
    originRoot: string,
  ) => Promise<DockerDesktopRuntimeRepairReport>;
}>;

function failedClosedReport(): DockerDesktopRuntimeRepairReport {
  return Object.freeze({
    contract: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT,
    contractRevision: DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION,
    status: "blocked",
    reason: "docker_desktop_repair_dispatch_failed_closed",
    repairId: null,
    operationState: null,
    manualRecoveryRequired: true,
    processEffectIssued: null,
    processEffectConfirmation: "unknown",
    filesystemEffectIssued: null,
    filesystemEffectConfirmation: "unknown",
    engineReady: null,
    staleRuntimeDirectory: "unknown",
    evidenceState: "unknown",
    disposition: "unknown",
    nativeHelperCleanupConfirmed: null,
    effectStateUnknown: true,
    operatorActionRequired: true,
    newRepairPermitted: false,
    deletionPerformed: false,
    pathReported: false,
    credentialReported: false,
    providerEffectIssued: false,
  });
}

export async function dispatchDockerDesktopRepairDoctorCommand(
  command: DockerDesktopRepairDoctorCommand,
  handlers: DockerDesktopRepairDoctorHandlers,
) {
  let report: DockerDesktopRuntimeRepairReport | null;
  try {
    report =
      command.adoptDockerDesktopRepairId !== undefined
        ? handlers.adopt &&
          command.historicalReleaseRoot !== undefined &&
          !command.repairDockerDesktopRuntime &&
          command.closeDockerDesktopRepairId === null
          ? await handlers.adopt(
              command.adoptDockerDesktopRepairId,
              command.historicalReleaseRoot,
            )
          : failedClosedReport()
        : command.repairDockerDesktopRuntime
          ? await handlers.repair()
          : command.closeDockerDesktopRepairId !== null
            ? await handlers.close(command.closeDockerDesktopRepairId)
            : null;
  } catch {
    report = failedClosedReport();
  }
  return report === null
    ? null
    : renderDockerRecoveryDoctorReport(report, command.json);
}

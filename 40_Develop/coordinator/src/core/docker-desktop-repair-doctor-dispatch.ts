import {
  DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT,
  DOCKER_DESKTOP_RUNTIME_REPAIR_CONTRACT_REVISION,
  type DockerDesktopRuntimeRepairReport,
} from "../security/docker-desktop-runtime-repair.ts";
import { renderDockerRecoveryDoctorReport } from "./docker-recovery-command-report.ts";

/**
 * DockerDesktopRepairDoctorCommandが扱う値の構造を表す。
 *
 * @responsibility DockerDesktopRepairDoctorCommandに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairDoctorCommandが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairDoctorCommandで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairDoctorCommandの宣言は外部境界を開かない。
 * @security N/A: DockerDesktopRepairDoctorCommandはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerDesktopRepairDoctorCommandの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type DockerDesktopRepairDoctorCommand = Readonly<{
  json: boolean;
  repairDockerDesktopRuntime: boolean;
  closeDockerDesktopRepairId: string | null;
  adoptDockerDesktopRepairId?: string;
  repairReleaseRoot?: string;
}>;

/**
 * DockerDesktopRepairDoctorHandlersが扱う値の構造を表す。
 *
 * @responsibility DockerDesktopRepairDoctorHandlersに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000008
 * @shape DockerDesktopRepairDoctorHandlersが表すProperty、識別子およびRelationを型として固定する。
 * @invariant DockerDesktopRepairDoctorHandlersで宣言した値と責務の対応を維持する。
 * @boundary N/A: DockerDesktopRepairDoctorHandlersの宣言は外部境界を開かない。
 * @security N/A: DockerDesktopRepairDoctorHandlersはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility DockerDesktopRepairDoctorHandlersの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type DockerDesktopRepairDoctorHandlers = Readonly<{
  repair: () => Promise<DockerDesktopRuntimeRepairReport>;
  close: (repairId: string) => Promise<DockerDesktopRuntimeRepairReport>;
  adopt?: (
    repairId: string,
    originRoot: string,
  ) => Promise<DockerDesktopRuntimeRepairReport>;
}>;

/**
 * failedClosedReportの処理を実行する。
 *
 * @responsibility failedClosedReportに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input N/A: 実行時引数を受け取らない。
 * @returns DockerDesktopRuntimeRepairReportを返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がfailedClosedReportの入力契約を満たす。
 * @postcondition failedClosedReportの責務を完了した結果だけを返す。
 * @effect N/A: failedClosedReportは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: failedClosedReportは独自の失敗分岐を所有しない。
 * @invariant failedClosedReportは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: failedClosedReportはProcess内の同一Subsystemで完結する。
 * @security N/A: failedClosedReportはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: failedClosedReportは共有非同期状態を持たない同期処理である。
 */
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

/**
 * dispatchDockerDesktopRepairDoctorCommandの処理を実行する。
 *
 * @responsibility dispatchDockerDesktopRepairDoctorCommandに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000008
 * @input command: DockerDesktopRepairDoctorCommand、handlers: DockerDesktopRepairDoctorHandlers
 * @returns dispatchDockerDesktopRepairDoctorCommandの計算結果を返す。
 * @precondition 「command: DockerDesktopRepairDoctorCommand、handlers: DockerDesktopRepairDoctorHandlers」がdispatchDockerDesktopRepairDoctorCommandの入力契約を満たす。
 * @postcondition dispatchDockerDesktopRepairDoctorCommandの責務を完了した結果だけを返す。
 * @effect N/A: dispatchDockerDesktopRepairDoctorCommandは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure dispatchDockerDesktopRepairDoctorCommandは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant dispatchDockerDesktopRepairDoctorCommandは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: dispatchDockerDesktopRepairDoctorCommandはProcess内の同一Subsystemで完結する。
 * @security N/A: dispatchDockerDesktopRepairDoctorCommandはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency dispatchDockerDesktopRepairDoctorCommandは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
export async function dispatchDockerDesktopRepairDoctorCommand(
  command: DockerDesktopRepairDoctorCommand,
  handlers: DockerDesktopRepairDoctorHandlers,
) {
  let report: DockerDesktopRuntimeRepairReport | null;
  try {
    report =
      command.adoptDockerDesktopRepairId !== undefined
        ? handlers.adopt &&
          command.repairReleaseRoot !== undefined &&
          !command.repairDockerDesktopRuntime &&
          command.closeDockerDesktopRepairId === null
          ? await handlers.adopt(
              command.adoptDockerDesktopRepairId,
              command.repairReleaseRoot,
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

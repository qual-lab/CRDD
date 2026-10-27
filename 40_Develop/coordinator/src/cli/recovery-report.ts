/**
 * 回復診断の結果をCLIのJSON／人間向け表示へ投影する。
 *
 * @responsibility 回復診断の非秘密結果をCLIの表示形式へ投影する。
 * @trace ARCH-000003
 */
import { types as utilTypes } from "node:util";
import { classifyDoctorOperationInitializationFailure } from "../execution/diagnostics.ts";

/**
 * Doctor Command 失敗を人間向け表示へ整形する。
 *
 * @responsibility Doctor Command 失敗の入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns renderDoctorCommandFailureの計算結果を返す。
 * @precondition 「error: unknown」がrenderDoctorCommandFailureの入力契約を満たす。
 * @postcondition renderDoctorCommandFailureの責務を完了した結果だけを返す。
 * @effect N/A: renderDoctorCommandFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: renderDoctorCommandFailureは独自の失敗分岐を所有しない。
 * @invariant renderDoctorCommandFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: renderDoctorCommandFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: renderDoctorCommandFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: renderDoctorCommandFailureは共有非同期状態を持たない同期処理である。
 */
export function renderDoctorCommandFailure(error: unknown) {
  const doctorCreation = classifyDoctorOperationInitializationFailure(error);
  const message = error instanceof Error ? error.message : null;
  const reason =
    typeof message === "string" && /^[a-z0-9_]+$/u.test(message)
      ? message
      : "diagnostic_failed";
  return Object.freeze({
    exitCode: 2,
    json: `${JSON.stringify(
      doctorCreation
        ? { status: "blocked", ...doctorCreation }
        : { status: "blocked", reason },
    )}\n`,
    human: doctorCreation
      ? `Coordinator診断は停止しました: ${doctorCreation.reason}; 手動回復が必要です; ホスト回復ID: ${doctorCreation.hostRecoveryId ?? "取得できません"}\n`
      : `Coordinator診断に失敗しました: ${reason}\n`,
  });
}

/**
 * 記録をPlain Dataとして検証する。
 *
 * @responsibility 記録の許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000003
 * @input value: unknown
 * @returns Readonly<Record<string, unknown>> | nullを返す。
 * @precondition 「value: unknown」がplainRecordの入力契約を満たす。
 * @postcondition plainRecordの責務を完了した結果だけを返す。
 * @effect N/A: plainRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainRecordは独自の失敗分岐を所有しない。
 * @invariant plainRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: plainRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: plainRecordは共有非同期状態を持たない同期処理である。
 */
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

/**
 * ArrayをPlain Dataとして検証する。
 *
 * @responsibility Arrayの許可Property、入れ子値、拒否境界を所有する。
 * @trace ARCH-000003
 * @input value: unknown
 * @returns readonly unknown[]を返す。
 * @precondition 「value: unknown」がplainArrayの入力契約を満たす。
 * @postcondition plainArrayの責務を完了した結果だけを返す。
 * @effect N/A: plainArrayは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: plainArrayは独自の失敗分岐を所有しない。
 * @invariant plainArrayは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: plainArrayはProcess内の同一Subsystemで完結する。
 * @security N/A: plainArrayはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: plainArrayは共有非同期状態を持たない同期処理である。
 */
function plainArray(value: unknown): readonly unknown[] {
  return Array.isArray(value) && !utilTypes.isProxy(value) ? value : [];
}

/**
 * Docker 回復 Doctor Reportを人間向け表示へ整形する。
 *
 * @responsibility Docker 回復 Doctor Reportの入力値、表示規則、機密を含めない出力境界を所有する。
 * @trace ARCH-000003
 * @input report: unknown、shouldOutputJson: boolean
 * @returns renderDockerRecoveryDoctorReportの計算結果を返す。
 * @precondition 「report: unknown、shouldOutputJson: boolean」がrenderDockerRecoveryDoctorReportの入力契約を満たす。
 * @postcondition renderDockerRecoveryDoctorReportの責務を完了した結果だけを返す。
 * @effect N/A: renderDockerRecoveryDoctorReportは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure renderDockerRecoveryDoctorReportは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant renderDockerRecoveryDoctorReportは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: renderDockerRecoveryDoctorReportはProcess内の同一Subsystemで完結する。
 * @security N/A: renderDockerRecoveryDoctorReportはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: renderDockerRecoveryDoctorReportは共有非同期状態を持たない同期処理である。
 */
export function renderDockerRecoveryDoctorReport(
  report: unknown,
  shouldOutputJson: boolean,
) {
  const reportValue = plainRecord(report);
  const statusDescriptor =
    reportValue && Object.getOwnPropertyDescriptor(reportValue, "status");
  const contractDescriptor =
    reportValue && Object.getOwnPropertyDescriptor(reportValue, "contract");
  if (
    !reportValue ||
    !statusDescriptor ||
    !("value" in statusDescriptor) ||
    typeof statusDescriptor.value !== "string" ||
    typeof reportValue.status !== "string" ||
    (contractDescriptor && !("value" in contractDescriptor))
  )
    throw new Error("diagnostic_failed");
  const contract = contractDescriptor?.value;
  if (contract === "crdd-coordinator/current-runtime-repair") {
    const fields = [
      "contract",
      "status",
      "reason",
      "recoveryId",
      "finalCheckpointConfirmed",
      "outcomeConfirmed",
      "retentionConfirmed",
      "historyConfirmed",
      "completionConfirmed",
      "nativeCleanupConfirmed",
      "cliCleanupConfirmed",
      "cliCleanupReason",
      "retentionReviewAfter",
    ] as const;
    if (
      fields.some((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(reportValue, key);
        return !descriptor || !("value" in descriptor);
      })
    )
      throw new Error("diagnostic_failed");
    const safe = Object.fromEntries(
      fields.map((key) => [
        key,
        Object.getOwnPropertyDescriptor(reportValue, key)?.value,
      ]),
    );
    const reasons = [
      "runtime_repair_recovered",
      "runtime_repair_failed_closed",
      "runtime_repair_boundary_unavailable",
      "runtime_repair_state_unavailable",
      "runtime_repair_observation_unknown",
      "runtime_repair_effect_unknown",
      "runtime_repair_cancelled",
      "runtime_repair_cleanup_unknown",
      "runtime_repair_cancellation_binding_failed",
    ];
    if (
      !["observed", "blocked"].includes(safe.status) ||
      !reasons.includes(safe.reason) ||
      (safe.recoveryId !== null &&
        (typeof safe.recoveryId !== "string" ||
          !/^docker-runtime-repair\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
            safe.recoveryId,
          ))) ||
      fields.slice(4, 11).some((key) => typeof safe[key] !== "boolean") ||
      (safe.retentionReviewAfter !== null &&
        (typeof safe.retentionReviewAfter !== "string" ||
          !Number.isFinite(Date.parse(safe.retentionReviewAfter)) ||
          new Date(Date.parse(safe.retentionReviewAfter)).toISOString() !==
            safe.retentionReviewAfter)) ||
      safe.retentionConfirmed !== (safe.retentionReviewAfter !== null) ||
      (safe.cliCleanupConfirmed
        ? safe.cliCleanupReason !== null
        : safe.cliCleanupReason !== "runtime_repair_cli_cleanup_unconfirmed") ||
      (safe.completionConfirmed &&
        (safe.status !== "observed" ||
          safe.reason !== "runtime_repair_recovered" ||
          !safe.historyConfirmed ||
          safe.recoveryId === null)) ||
      (safe.retentionConfirmed &&
        !safe.completionConfirmed &&
        safe.status === "observed" &&
        (!safe.outcomeConfirmed ||
          !safe.finalCheckpointConfirmed ||
          !safe.nativeCleanupConfirmed)) ||
      (safe.historyConfirmed && safe.recoveryId === null)
    )
      throw new Error("diagnostic_failed");
    const recovered =
      safe.status === "observed" &&
      safe.reason === "runtime_repair_recovered" &&
      safe.recoveryId !== null;
    const completeState =
      recovered && safe.completionConfirmed && safe.historyConfirmed;
    const retained =
      recovered &&
      !safe.completionConfirmed &&
      safe.retentionConfirmed &&
      safe.historyConfirmed &&
      safe.outcomeConfirmed &&
      safe.finalCheckpointConfirmed &&
      safe.nativeCleanupConfirmed;
    const awaitingDisposition =
      recovered &&
      !safe.completionConfirmed &&
      !safe.retentionConfirmed &&
      !safe.historyConfirmed &&
      safe.outcomeConfirmed &&
      safe.finalCheckpointConfirmed &&
      safe.nativeCleanupConfirmed;
    const stopped =
      safe.reason !== "runtime_repair_recovered" && !safe.completionConfirmed;
    if (!(completeState || retained || awaitingDisposition || stopped))
      throw new Error("diagnostic_failed");
    const completed = completeState && safe.cliCleanupConfirmed;
    return Object.freeze({
      stdout: shouldOutputJson
        ? `${JSON.stringify(safe, null, 2)}\n`
        : [
            `Coordinator Docker実行環境の修復: ${completed ? (safe.retentionConfirmed ? "保持引渡し完了" : "完了") : awaitingDisposition ? "技術修復済み・保持判断待ち" : retained ? "保持済み・終了整理待ち" : "停止・確認待ち"}`,
            `- 理由: ${safe.reason}`,
            ...(safe.recoveryId === null
              ? []
              : [`- 回復ID: ${safe.recoveryId}`]),
            `- 履歴保存: ${safe.historyConfirmed ? "確認済み" : "未確認"}`,
            `- 現在状態の終了整理: ${safe.completionConfirmed ? "確認済み" : "未確認"}`,
            ...(safe.retentionReviewAfter === null
              ? []
              : [
                  `- 保持の見直し期限: ${safe.retentionReviewAfter}`,
                  "- 期限までに保持物の削除または保持延長を判断してください。期限だけで自動削除は行いません。",
                ]),
            `- CLI後片付け: ${safe.cliCleanupConfirmed ? "確認済み" : "未確認"}`,
            ...(safe.cliCleanupReason === null
              ? []
              : [`- CLI後片付けの停止理由: ${safe.cliCleanupReason}`]),
            "",
          ].join("\n"),
      exitCode: completed ? 0 : 2,
    });
  }
  if (contract === "crdd-coordinator/current-task-recovery") {
    const fields = [
      "contract",
      "status",
      "reason",
      "recoveryId",
      "dockerCleanupConfirmed",
      "hostCleanupConfirmed",
      "locksReleased",
      "historyConfirmed",
      "deliveryPending",
      "operationRetained",
      "operationRemovalConfirmed",
      "taskRecoveryCompleted",
      "cleanupReason",
      "cliCleanupConfirmed",
      "cliCleanupReason",
    ] as const;
    if (
      fields.some((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(reportValue, key);
        return descriptor && !("value" in descriptor);
      })
    )
      throw new Error("diagnostic_failed");
    const safe = Object.fromEntries(
      fields.map((key) => [
        key,
        Object.getOwnPropertyDescriptor(reportValue, key)?.value ?? null,
      ]),
    );
    if (
      !["blocked", "recovered", "awaiting_delivery"].includes(safe.status) ||
      typeof safe.reason !== "string" ||
      !/^[a-z0-9_]{1,160}$/u.test(safe.reason) ||
      (safe.recoveryId !== null &&
        (typeof safe.recoveryId !== "string" ||
          !/^docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64}$/u.test(
            safe.recoveryId,
          ))) ||
      fields
        .slice(4)
        .some((key) =>
          key === "cleanupReason" || key === "cliCleanupReason"
            ? safe[key] !== null &&
              (typeof safe[key] !== "string" ||
                !/^[a-z0-9_]{1,160}$/u.test(safe[key]))
            : key === "operationRetained" && safe[key] === null
              ? false
              : typeof safe[key] !== "boolean",
        )
    )
      throw new Error("diagnostic_failed");
    const technical =
      safe.dockerCleanupConfirmed &&
      safe.hostCleanupConfirmed &&
      safe.locksReleased &&
      safe.historyConfirmed &&
      safe.cleanupReason === null;
    const recovered =
      technical &&
      safe.status === "recovered" &&
      safe.reason === "docker_task_recovery_completed" &&
      !safe.deliveryPending &&
      safe.operationRetained === false &&
      safe.operationRemovalConfirmed &&
      safe.taskRecoveryCompleted;
    const pending =
      technical &&
      safe.status === "awaiting_delivery" &&
      safe.reason === "docker_task_recovery_durable_acceptance_pending" &&
      safe.deliveryPending &&
      safe.operationRetained === true &&
      !safe.operationRemovalConfirmed &&
      !safe.taskRecoveryCompleted;
    const blocked =
      safe.status === "blocked" &&
      !safe.operationRemovalConfirmed &&
      !safe.taskRecoveryCompleted &&
      safe.operationRetained !== false &&
      ![
        "docker_task_recovery_completed",
        "docker_task_recovery_durable_acceptance_pending",
      ].includes(safe.reason);
    const valid =
      (blocked || recovered || pending) &&
      (safe.cliCleanupConfirmed
        ? safe.cliCleanupReason === null
        : safe.cliCleanupReason !== null);
    if (!valid) throw new Error("diagnostic_failed");
    return Object.freeze({
      stdout: shouldOutputJson
        ? `${JSON.stringify(safe, null, 2)}\n`
        : [
            `Coordinator Task回復: ${recovered ? "完了" : pending ? "技術回収済み・Task側の受領待ち" : "停止"}`,
            `- 理由: ${safe.reason}`,
            ...(safe.recoveryId === null
              ? []
              : [`- 回復ID: ${safe.recoveryId}`]),
            `- Task回復完了: ${safe.taskRecoveryCompleted ? "はい" : "いいえ"}`,
            `- CLI後片付け: ${safe.cliCleanupConfirmed ? "確認済み" : "未確認"}`,
            ...(safe.cleanupReason === null
              ? []
              : [`- 資源解放の停止理由: ${safe.cleanupReason}`]),
            ...(safe.cliCleanupReason === null
              ? []
              : [`- CLIの停止理由: ${safe.cliCleanupReason}`]),
            "",
          ].join("\n"),
      exitCode: (recovered || pending) && safe.cliCleanupConfirmed ? 0 : 2,
    });
  }
  if (contract === "crdd-coordinator/docker-restart-for-recovery") {
    const isCompleted =
      reportValue.status === "completed" &&
      reportValue.restartCompleted === true &&
      reportValue.cleanupConfirmed === true &&
      reportValue.taskRecoveryCompleted === false;
    return Object.freeze({
      stdout: shouldOutputJson
        ? `${JSON.stringify(report, null, 2)}\n`
        : `${[
            `Dockerの検証付き再起動: ${isCompleted ? "完了" : "停止"}`,
            "Taskの復旧・再実行は行っていません。",
            isCompleted
              ? "次の操作: 同じRepositoryで同じ復旧IDを指定して recovery resume を実行してください。作成結果不明は別途停止する場合があります。"
              : "次の操作: 保存された停止理由と残存記録を確認してください。再起動を繰り返さないでください。",
            `理由: ${typeof reportValue.reason === "string" && /^[a-z0-9_]{1,128}$/u.test(reportValue.reason) ? reportValue.reason : "unconfirmed"}`,
            `資源回収: ${reportValue.cleanupConfirmed === true ? "確認済み" : "未確認"}`,
          ].join("\n")}\n`,
      exitCode: isCompleted ? 0 : 2,
    });
  }
  if (shouldOutputJson) {
    const isRepairReport =
      contract === "crdd-coordinator/docker-desktop-runtime-repair";
    const isRepairSucceeded =
      isRepairReport &&
      [
        "closed_retained",
        "closed_historical_effect_unknown_retained",
        "historical_closed_retained",
      ].includes(reportValue.status) &&
      reportValue.nativeHelperCleanupConfirmed === true &&
      reportValue.newRepairPermitted === true;
    return Object.freeze({
      stdout: `${JSON.stringify(report, null, 2)}\n`,
      exitCode: (isRepairReport
        ? isRepairSucceeded
          ? [reportValue.status]
          : []
        : ["ready", "recovered"]
      ).includes(reportValue.status)
        ? 0
        : 2,
    });
  }
  if (contract === "crdd-coordinator/docker-desktop-runtime-repair") {
    const tri = (value: unknown) =>
      value === true ? "はい" : value === false ? "いいえ" : "未確認";
    const lines = [`Coordinator Docker Desktop復旧: ${reportValue.status}`];
    if (
      typeof reportValue.reason === "string" &&
      /^[a-z0-9_]{1,128}$/u.test(reportValue.reason)
    )
      lines.push(`- 理由: ${reportValue.reason}`);
    if (
      typeof reportValue.repairId === "string" &&
      /^docker-desktop-repair\.[a-f0-9]{32}$/u.test(reportValue.repairId)
    )
      lines.push(`- 復旧ID: ${reportValue.repairId}`);
    lines.push(`- Docker Engineの準備完了: ${tri(reportValue.engineReady)}`);
    lines.push(
      `- Docker Engine起動所要時間（参考値）: ${
        typeof reportValue.engineStartupDurationMs === "number" &&
        Number.isFinite(reportValue.engineStartupDurationMs) &&
        reportValue.engineStartupDurationMs >= 0
          ? `${Math.round(reportValue.engineStartupDurationMs)} ms`
          : "未計測"
      }`,
    );
    lines.push(`- プロセス操作の発行: ${tri(reportValue.processEffectIssued)}`);
    lines.push(
      `- プロセス操作の確認状態: ${
        ["not_issued", "confirmed", "unknown"].includes(
          String(reportValue.processEffectConfirmation),
        )
          ? String(reportValue.processEffectConfirmation)
          : "unknown"
      }`,
    );
    lines.push(
      `- ファイルシステム操作の発行: ${tri(reportValue.filesystemEffectIssued)}`,
    );
    lines.push(
      `- ファイルシステム操作の確認状態: ${
        ["not_issued", "confirmed", "unknown"].includes(
          String(reportValue.filesystemEffectConfirmation),
        )
          ? String(reportValue.filesystemEffectConfirmation)
          : "unknown"
      }`,
    );
    lines.push(
      `- 退避した実行時フォルダの状態: ${
        ["absent", "retained", "unknown"].includes(
          String(reportValue.staleRuntimeDirectory),
        )
          ? String(reportValue.staleRuntimeDirectory)
          : "unknown"
      }`,
    );
    lines.push(`- 削除の実行: なし`);
    lines.push(
      `- 復旧根拠の保持状態: ${
        ["preserved", "not_preserved", "unknown"].includes(
          String(reportValue.evidenceState),
        )
          ? String(reportValue.evidenceState)
          : "unknown"
      }`,
    );
    lines.push(
      `- ネイティブ補助プロセスの資源回収確認: ${tri(
        reportValue.nativeHelperCleanupConfirmed,
      )}`,
    );
    lines.push(
      `- 新しい復旧操作の許可: ${tri(reportValue.newRepairPermitted)}`,
    );
    if (
      [
        "recovered_pending_close",
        "historical_recovered_pending_close",
      ].includes(reportValue.status) &&
      typeof reportValue.repairId === "string" &&
      /^docker-desktop-repair\.[a-f0-9]{32}$/u.test(reportValue.repairId)
    ) {
      lines.push(
        "- 次の操作: 旧形式の復旧記録です。根拠と対象を保持したまま、フロントAIの移行手順で確認してください。現在の修復IDへ自動変換しません。",
      );
    } else if (
      reportValue.manualRecoveryRequired === true ||
      reportValue.operatorActionRequired === true
    ) {
      lines.push(
        "- 次の操作: 新しい復旧の試行を止め、Runtime運用担当者へ連絡してください。",
      );
      lines.push(
        "- 保持した根拠や段階記録を手動で削除・改名しないでください。",
      );
      if (
        [
          "docker_desktop_repair_record_capacity_unavailable",
          "docker_desktop_repair_operation_capacity_unavailable",
        ].includes(String(reportValue.reason))
      )
        lines.push(
          "- 復旧記録の上限: 再試行や復旧記録の削除・圧縮をしないでください。",
        );
    } else if (reportValue.status === "historical_closed_retained") {
      lines.push(
        "- 結果: 現在のDocker正常状態を確認し、旧版の復旧記録を保持したまま終了しました。",
      );
      lines.push(
        "- 過去の不明な操作は再実行せず、不明だった事実も変更していません。",
      );
      lines.push(
        reportValue.staleRuntimeDirectory === "retained"
          ? "- 退避フォルダ: 元の実体を保持しています。"
          : "- 退避フォルダ: 不存在を確認しました。旧記録は保持しています。",
      );
    } else if (reportValue.status === "closed_retained") {
      lines.push(
        reportValue.staleRuntimeDirectory === "absent"
          ? "- 結果: 復旧記録を終了しました。退避した実行時フォルダは残っていません。復旧記録と確認済みのホスト操作履歴は意図的に保持しています。"
          : "- 結果: 復旧記録を終了しました。退避した実行時フォルダの根拠は意図的に保持しています。",
      );
    } else if (
      reportValue.status === "closed_historical_effect_unknown_retained"
    ) {
      lines.push(
        "- 結果: 復旧記録を終了しました。退避した実行時フォルダは観測されていません。過去のプロセス操作が不明だった事実と復旧記録は意図的に保持しています。",
      );
    }
    return Object.freeze({
      stdout: `${lines.join("\n")}\n`,
      exitCode:
        [
          "closed_retained",
          "closed_historical_effect_unknown_retained",
          "historical_closed_retained",
        ].includes(reportValue.status) &&
        reportValue.nativeHelperCleanupConfirmed === true &&
        reportValue.newRepairPermitted === true
          ? 0
          : 2,
    });
  }
  const lines = [`Coordinator環境診断: ${reportValue.status}`];
  if (
    typeof reportValue.reason === "string" &&
    /^[a-z0-9_]{1,128}$/u.test(reportValue.reason)
  )
    lines.push(`- 理由: ${reportValue.reason}`);
  if (
    typeof reportValue.recoveryId === "string" &&
    /^(?:host\.[A-Za-z0-9._-]+|docker\.crdd-coordinator-doctor-[A-Za-z0-9_-]+\.[0-9a-f-]{36}\.[0-9a-f-]{36}\.[0-9a-f]{64}|docker-task\.[a-f0-9]{64}\.[a-f0-9]{64}\.[a-f0-9]{64})$/u.test(
      reportValue.recoveryId,
    )
  ) {
    lines.push(`- 回復ID: ${reportValue.recoveryId}`);
    if (reportValue.manualRecoveryRequired === true) {
      lines.push(
        "- 次の操作: 新しいタスクを止め、この回復IDをRuntime運用担当者へ渡してください。名前やラベルだけを根拠に資源を削除しないでください。",
      );
    } else
      lines.push(
        `- 次の操作: coordinator recovery resume ${reportValue.recoveryId}`,
      );
  }
  if (reportValue.manualRecoveryRequired === true) {
    lines.push("- 回復: 自動回復は停止しました。");
    lines.push(
      reportValue.evidenceState === "preserved"
        ? "- 回復根拠: 保持済み"
        : reportValue.evidenceState === "not_preserved"
          ? "- 回復根拠: 保持されていません"
          : "- 回復根拠: 保持状況は未確認",
    );
    if (typeof reportValue.recoveryId !== "string")
      lines.push(
        "- 次の操作: 新しいタスクを止め、理由と回復根拠の保持状況をRuntime運用担当者へ渡してください。再利用できる回復IDは取得できていません。名前やラベルだけを根拠に資源を削除しないでください。",
      );
  }
  const providers = plainRecord(reportValue.providers);
  for (const [name, providerValue] of Object.entries(providers ?? {})) {
    const provider = plainRecord(providerValue);
    lines.push(
      `- ${name}: ${provider?.located === true ? "実行ファイルを検出" : "実行ファイルが見つかりません"}; 実行による確認は行っていません。`,
    );
  }
  if (reportValue.credentials) lines.push("- 認証情報の値の記録: なし");
  const filesystem = plainRecord(reportValue.filesystem);
  if (typeof filesystem?.enforcement === "string")
    lines.push(`- ファイルシステム制約の強制状態: ${filesystem.enforcement}`);
  const egress = plainRecord(reportValue.egress);
  if (typeof egress?.providerAllowlist === "string")
    lines.push(`- Provider外部送信先の許可リスト: ${egress.providerAllowlist}`);
  const runtimeRootEvaluation = plainRecord(reportValue.runtimeRootEvaluation);
  if (typeof runtimeRootEvaluation?.status === "string")
    lines.push(
      `- Runtimeルートの評価: ${runtimeRootEvaluation.status}; 状態変更は行っていません。`,
    );
  const recovery = plainRecord(reportValue.recovery);
  if (recovery?.manualRecoveryRequired === true) {
    const recoveryReason =
      typeof recovery.reason === "string" ? recovery.reason : "unknown";
    lines.push(
      `- 回復: 自動回復用のIDを取得できません。手動で安全を確認する対応が必要です (${recoveryReason})。`,
    );
  } else if (
    recovery?.required === true &&
    typeof recovery.recoveryId === "string"
  )
    lines.push(
      "- 回復: 返された回復IDを指定して recovery resume を実行してください。",
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
    lines.push(`- Dockerタスクの回復対象数: ${dockerRecoveryIds.length}`);
    for (const dockerRecoveryId of dockerRecoveryIds) {
      lines.push(`  - 回復ID: ${dockerRecoveryId}`);
      lines.push(
        `    次の操作: coordinator recovery resume ${dockerRecoveryId}`,
      );
    }
  }
  const blockers = plainArray(reportValue.blockers);
  lines.push(`- 実行を妨げる事項: ${blockers.length}`);
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

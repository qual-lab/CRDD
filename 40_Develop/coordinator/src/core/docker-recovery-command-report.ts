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
  if (
    reportValue.contract === "crdd-coordinator/docker-desktop-runtime-repair"
  ) {
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
        "- 次の操作: フォルダは削除していません。根拠を保持することを明示的に了承して、この復旧記録を終了してください。",
      );
      lines.push(
        `- コマンド: coordinator doctor --close-docker-desktop-runtime-repair ${reportValue.repairId}`,
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
        `- 次の操作: coordinator doctor --recover-isolation ${reportValue.recoveryId}`,
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
      "- 回復: 返された回復IDを指定して doctor --recover-isolation を実行してください。",
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
        `    次の操作: coordinator doctor --recover-isolation ${dockerRecoveryId}`,
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

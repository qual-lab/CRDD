/**
 * 自己生成Native終端fixtureの返却判定を正式試験へ保持する。
 *
 * @packageDocumentation
 * @responsibility 旧Ownerの閉schema、固定観測値、拒否理由と未検証範囲を保持する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @level IT
 * @scope target、save、capacity、current、cold、rename、publication、disposition、known-file。
 * @boundary 未署名Native試験のpacketのみ。実Recovery、Provider、履歴診断へ接続しない。
 */

/**
 * 正式入口が選択できる自己生成fixtureを限定する。
 *
 * @responsibility 通常回帰へ移す有限集合だけを表す。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 履歴読取りと保持対象mutationを含めない。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
export type NativeTerminalFixtureKind =
  | "target"
  | "save"
  | "capacity"
  | "current"
  | "cold"
  | "rename"
  | "publication"
  | "disposition"
  | "known-file";

/**
 * target fixtureの既往成功条件を保持する。
 *
 * @responsibility targetの返却schemaと観測結果を一括照合する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 欠落、未知field、不一致と未確認closeを拒否し、production未接続を維持する。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function validateTargetPacket(value: unknown): boolean {
  const verificationOperation = "target.261004.9da03fb1.r3";
  const native =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const fields = [
    "contract",
    "contractRevision",
    "run",
    "observed",
    "phase",
    "normalObservations",
    "createdEntities",
    "cleanupEntities",
    "replacementsCreated",
    "replacementsCleaned",
    "replacementCleanupModelCases",
    "settlementModelCases",
    "checkedCloses",
    "checkedClosesConfirmed",
    "fixturePresence",
    "maximumMarkerVerified",
    "settlementModelVerified",
    "rejections",
    "recordSaves",
    "productionIntegrationVerified",
    "osFaultInjectionVerified",
  ];
  const rows = Array.isArray(native?.rejections)
    ? (native.rejections as Record<string, unknown>[])
    : [];
  const isNativeVerified =
    native !== null &&
    Object.keys(native).length === fields.length &&
    Object.keys(native).every((key) => fields.includes(key)) &&
    native.contract === "crdd-native/terminal-target-fixture" &&
    native.contractRevision === 2 &&
    native.run === verificationOperation &&
    native.observed === true &&
    native.phase === "complete" &&
    native.normalObservations === 6 &&
    native.createdEntities === 11 &&
    native.cleanupEntities === 11 &&
    native.replacementsCreated === 8 &&
    native.replacementsCleaned === 8 &&
    native.replacementCleanupModelCases === 3 &&
    native.settlementModelCases === 4 &&
    native.checkedClosesConfirmed === true &&
    typeof native.checkedCloses === "number" &&
    native.checkedCloses > 0 &&
    native.fixturePresence === "absent" &&
    native.maximumMarkerVerified === true &&
    native.settlementModelVerified === true &&
    native.recordSaves === 0 &&
    native.productionIntegrationVerified === false &&
    native.osFaultInjectionVerified === false &&
    rows.length === 164 &&
    rows.every((row, rowIndex) => {
      if (rowIndex < 77) {
        const position =
          rowIndex < 72
            ? Math.floor(rowIndex / 6)
            : rowIndex === 72
              ? null
              : rowIndex === 73
                ? 4
                : 11;
        const expectedReason =
          rowIndex < 66
            ? "terminal_target_known_mismatch"
            : rowIndex < 72 || rowIndex >= 74
              ? "terminal_known_file_known_mismatch"
              : rowIndex === 72
                ? "terminal_target_known_user_mismatch"
                : "terminal_target_known_marker_mismatch";
        return (
          row !== null &&
          typeof row === "object" &&
          Object.keys(row).length === 5 &&
          row.reason === expectedReason &&
          row.operationReason === expectedReason &&
          row.position === position &&
          row.handlesAcquired === 9 &&
          Array.isArray(row.closes) &&
          row.closes.length === 9 &&
          row.closes.every((closed) => closed === true)
        );
      }
      const index = rowIndex - 77;
      const position =
        index >= 69 && index < 85
          ? 3 + Math.floor((index - 69) / 2)
          : index >= 85
            ? 4
            : null;
      const expectedReason =
        index < 68
          ? "terminal_target_known_mismatch"
          : index === 68
            ? "terminal_target_known_name_mismatch"
            : index >= 85
              ? "terminal_length_invalid"
              : (index - 69) % 2 === 0
                ? "terminal_open_failed"
                : "terminal_target_type_invalid";
      const count =
        index < 68 || index >= 85
          ? 8
          : index === 68
            ? 0
            : Number(position) - ((index - 69) % 2 === 0 ? 3 : 2);
      return (
        row !== null &&
        typeof row === "object" &&
        Object.keys(row).length === 5 &&
        row.reason === expectedReason &&
        row.operationReason === expectedReason &&
        row.position === position &&
        row.handlesAcquired === count &&
        Array.isArray(row.closes) &&
        row.closes.length === count &&
        row.closes.every((closed) => closed === true)
      );
    });

  return Boolean(isNativeVerified);
}

/**
 * save fixtureの既往成功条件を保持する。
 *
 * @responsibility saveの返却schemaと観測結果を一括照合する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 欠落、未知field、不一致と未確認closeを拒否し、production未接続を維持する。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function validateSavePacket(value: unknown): boolean {
  const verificationOperation = "save.261003.c8d1092a.r1";
  const native =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const fields = [
    "contract",
    "contractRevision",
    "run",
    "status",
    "phase",
    "directoryCreated",
    "workerJoined",
    "savesVerified",
    "rejectionsVerified",
    "inventoriesVerified",
    "cleanupFiles",
    "cleanupDirectories",
    "checkedClosesConfirmed",
    "fixturePresence",
    "saves",
    "rejections",
    "inventories",
    "closes",
    "productionIntegrationVerified",
    "osFaultInjectionVerified",
  ];
  const isParsed =
    native !== null &&
    Object.keys(native).length === fields.length &&
    Object.keys(native).every((key) => fields.includes(key)) &&
    native.contract === "crdd-native/terminal-save-fixture" &&
    native.contractRevision === 1 &&
    native.run === verificationOperation &&
    ["observed", "unconfirmed"].includes(String(native.status)) &&
    typeof native.phase === "string";
  const rows =
    isParsed && Array.isArray(native?.saves)
      ? (native.saves as Record<string, unknown>[])
      : [];
  const rejectedEntries =
    isParsed && Array.isArray(native?.rejections)
      ? (native.rejections as Record<string, unknown>[])
      : [];
  const inventories =
    isParsed && Array.isArray(native?.inventories)
      ? (native.inventories as Record<string, unknown>[])
      : [];
  const closes =
    isParsed && Array.isArray(native?.closes)
      ? (native.closes as Record<string, unknown>[])
      : [];
  const reasons = [
    "terminal_capacity_timeout",
    "terminal_record_already_present",
    "terminal_open_failed",
    "terminal_inventory_unknown_entry",
    "terminal_inventory_size_invalid",
    "terminal_inventory_not_file",
  ];
  const isNativeVerified =
    isParsed &&
    native?.status === "observed" &&
    native.phase === "complete" &&
    native.directoryCreated === true &&
    native.workerJoined === true &&
    native.savesVerified === 3 &&
    native.rejectionsVerified === 6 &&
    native.inventoriesVerified === 2 &&
    native.cleanupFiles === 7 &&
    native.cleanupDirectories === 2 &&
    native.checkedClosesConfirmed === true &&
    native.fixturePresence === "absent" &&
    native.productionIntegrationVerified === false &&
    native.osFaultInjectionVerified === false &&
    rows.length === 3 &&
    rows.every(
      (r) =>
        r !== null &&
        typeof r === "object" &&
        [
          "enumerationComplete",
          "stageCreated",
          "writeIssued",
          "flushIssued",
          "renameIssued",
          "stageAbsent",
          "publicVerified",
          "readerClose",
          "writerClose",
          "recordClose",
          "capacityAction",
          "capacityRelease",
          "capacityClose",
        ].every((key) => r[key] === true) &&
        r.readersOpened === r.readersClosed &&
        (r.searchClose === true ||
          (r.searchAcquired === false && r.searchClose === null)),
    ) &&
    rows[0]?.beforeEntries === 0 &&
    rows[0]?.beforeBytes === 0 &&
    rows[1]?.beforeEntries === 4 &&
    rows[1]?.beforeBytes === 8198 &&
    rows[2]?.beforeEntries === 6 &&
    rows[2]?.beforeBytes === 8201 &&
    rejectedEntries.length === reasons.length &&
    rejectedEntries.every(
      (r, i) =>
        r !== null &&
        typeof r === "object" &&
        r.reason === reasons[i] &&
        r.recordPresent === false &&
        r.capacityClose === true &&
        r.capacityAction === (i !== 0) &&
        r.capacityRelease === (i === 0 ? null : true),
    ) &&
    inventories.length === 2 &&
    inventories.every(
      (i) =>
        i !== null &&
        typeof i === "object" &&
        i.complete === true &&
        i.searchClose === true &&
        i.readersOpened === i.readersClosed,
    ) &&
    inventories[0]?.entries === 4 &&
    inventories[0]?.bytes === 8198 &&
    inventories[1]?.entries === 7 &&
    inventories[1]?.bytes === 8202 &&
    closes.length > 0 &&
    closes.every(
      (c) => c !== null && typeof c === "object" && c.confirmed === true,
    );

  return Boolean(isNativeVerified);
}

/**
 * capacity fixtureの既往成功条件を保持する。
 *
 * @responsibility capacityの返却schemaと観測結果を一括照合する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 欠落、未知field、不一致と未確認closeを拒否し、production未接続を維持する。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function validateCapacityPacket(
  value: unknown,
  permissionMode?: "before" | "after",
): boolean {
  if (permissionMode !== "before" && permissionMode !== "after") return false;
  const verificationOperation = `capacity.261003.c8d1092a.r3-${permissionMode}`;
  const packet =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const fields = [
    "contract",
    "run",
    "phase",
    "permissionMode",
    "gateOperationReason",
    "combinedFailureCases",
    "priorRejectionVerified",
    "observed",
    "directoryCreated",
    "cleanupIssued",
    "cleanupDirectoryCount",
    "fixturePresence",
    "actualRecordSaves",
    "receipts",
    "closes",
  ];
  const receiptFields = [
    "createIssued",
    "handleAcquired",
    "waitResult",
    "ownershipAcquired",
    "actionStarted",
    "releaseConfirmed",
    "closeConfirmed",
  ];
  const isParsed =
    packet !== null &&
    Object.keys(packet).length === fields.length &&
    Object.keys(packet).every((key) => fields.includes(key)) &&
    packet.contract === "crdd-native/terminal-capacity-fixture" &&
    packet.run === verificationOperation &&
    typeof packet.phase === "string" &&
    packet.permissionMode === permissionMode &&
    (packet.gateOperationReason === null ||
      packet.gateOperationReason ===
        "terminal_capacity_prior_settlement_unknown") &&
    Number.isInteger(packet.combinedFailureCases) &&
    Number(packet.combinedFailureCases) >= 0 &&
    Number(packet.combinedFailureCases) <= 4 &&
    typeof packet.priorRejectionVerified === "boolean" &&
    typeof packet.observed === "boolean" &&
    typeof packet.directoryCreated === "boolean" &&
    typeof packet.cleanupIssued === "boolean" &&
    Number.isInteger(packet.cleanupDirectoryCount) &&
    Number(packet.cleanupDirectoryCount) >= 0 &&
    Number(packet.cleanupDirectoryCount) <= 3 &&
    ["absent", "present", "unknown"].includes(String(packet.fixturePresence)) &&
    packet.actualRecordSaves === 0 &&
    Array.isArray(packet.receipts) &&
    packet.receipts.length <= 7 &&
    packet.receipts.every((value: unknown) => {
      if (value === null || typeof value !== "object") return false;
      const r = value as Record<string, unknown>;
      return (
        Object.keys(r).length === receiptFields.length &&
        Object.keys(r).every((key) => receiptFields.includes(key)) &&
        [
          r.createIssued,
          r.handleAcquired,
          r.ownershipAcquired,
          r.actionStarted,
        ].every((v) => typeof v === "boolean") &&
        (r.waitResult === null ||
          (Number.isInteger(r.waitResult) &&
            Number(r.waitResult) >= 0 &&
            Number(r.waitResult) <= 4294967295)) &&
        [r.releaseConfirmed, r.closeConfirmed].every(
          (v) => v === null || typeof v === "boolean",
        )
      );
    }) &&
    Array.isArray(packet.closes) &&
    packet.closes.length <= 32 &&
    packet.closes.every((value: unknown) => {
      if (value === null || typeof value !== "object") return false;
      const r = value as Record<string, unknown>;
      return (
        Object.keys(r).length === 2 &&
        typeof r.owner === "string" &&
        typeof r.confirmed === "boolean"
      );
    });
  const gate =
    isParsed && Array.isArray(packet?.receipts)
      ? (packet.receipts[6] as Record<string, unknown>)
      : null;
  const isNativeVerified =
    isParsed &&
    packet?.observed === true &&
    packet.phase === "completed" &&
    packet.combinedFailureCases === 4 &&
    packet.priorRejectionVerified === true &&
    packet.gateOperationReason ===
      (permissionMode === "before"
        ? "terminal_capacity_prior_settlement_unknown"
        : null) &&
    gate !== null &&
    gate.handleAcquired === true &&
    gate.waitResult === 0 &&
    gate.ownershipAcquired === true &&
    gate.actionStarted === (permissionMode === "after") &&
    gate.releaseConfirmed === true &&
    gate.closeConfirmed === true &&
    packet.directoryCreated === true &&
    packet.cleanupIssued === true &&
    packet.cleanupDirectoryCount === 3 &&
    packet.fixturePresence === "absent" &&
    Array.isArray(packet.receipts) &&
    packet.receipts.length === 7 &&
    Array.isArray(packet.closes) &&
    packet.closes.length > 0 &&
    packet.closes.every((r: Record<string, unknown>) => r.confirmed === true);

  return Boolean(isNativeVerified);
}

/**
 * current fixtureの既往成功条件を保持する。
 *
 * @responsibility currentの返却schemaと観測結果を一括照合する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 欠落、未知field、不一致と未確認closeを拒否し、production未接続を維持する。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function validateCurrentPacket(value: unknown): boolean {
  const packet =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const fields = [
    "contract",
    "contractRevision",
    "run",
    "status",
    "phase",
    "currentReadsVerified",
    "rejectionChecksVerified",
    "sameBytesReplacementDistinguished",
    "fixtureRenameIssued",
    "checkedClosesConfirmed",
    "closeResults",
    "cleanupIssuedCount",
    "fixturePresence",
    "unexpectedMutationEffectIssued",
    "historicalReceiptRestored",
    "productionIntegrationVerified",
    "callerDurableReentryVerified",
    "schemaBindingVerified",
    "osFaultInjectionVerified",
    "strictDeadlineClaimed",
  ];
  const owners = [
    "identity_reader",
    "token_impersonation",
    "token_primary",
    "stage",
    "collision_fixture",
    "current_reader",
    "rejected_reader",
    "replacement_stage",
    "strict_rejection",
    "replacement_reader",
    "directory",
    "unexpected_mutation_open",
  ];
  const phases = [
    "preflight",
    "tokens",
    "create",
    "current_read",
    "rejections",
    "replacement",
    "close",
    "cleanup",
    "complete",
    "stage_destination_absence",
    "stage_write_open",
    "stage_delete_open",
    "stage_remove",
    "stage_rename_no_replace",
    "public_destination_absence",
    "public_write_open",
    "public_delete_open",
    "public_remove",
    "public_rename_no_replace",
  ];

  /**
   * 個別close行の形を固定する。
   *
   * @responsibility 未知Owner・余分field・非booleanを拒否する。
   * @trace ERB-IT-001
   * @trace ERB-IT-002
   * @trace ERB-IT-003
   * @precondition 解析済み未知JSON。
   * @stimulus key・Owner・型を照合する。
   * @observation 形の一致だけ。
   * @oracle 形の一致を実closeの成功にしない。
   * @cleanup N/A: 純粋判定。
   * @boundary Native packet→Owner。
   */
  function closeRow(value: unknown): boolean {
    if (value === null || typeof value !== "object") return false;
    const row = value as Record<string, unknown>;
    return (
      Object.keys(row).length === 2 &&
      Object.keys(row).every((key) => key === "owner" || key === "confirmed") &&
      typeof row.owner === "string" &&
      owners.includes(row.owner) &&
      typeof row.confirmed === "boolean"
    );
  }

  const isParsedPacket =
    packet !== null &&
    Object.keys(packet).length === fields.length &&
    Object.keys(packet).every((key) => fields.includes(key)) &&
    packet.contract === "crdd-native/terminal-current-candidate-fixture" &&
    packet.contractRevision === 1 &&
    packet.run === "current.261003.73c9d18f.r1" &&
    ["observed", "unconfirmed"].includes(String(packet.status)) &&
    phases.includes(String(packet.phase)) &&
    [
      "currentReadsVerified",
      "rejectionChecksVerified",
      "cleanupIssuedCount",
    ].every(
      (key) =>
        Number.isInteger(packet[key]) &&
        Number(packet[key]) >= 0 &&
        Number(packet[key]) <= 8,
    ) &&
    [
      "sameBytesReplacementDistinguished",
      "fixtureRenameIssued",
      "checkedClosesConfirmed",
      "unexpectedMutationEffectIssued",
    ].every((key) => typeof packet[key] === "boolean") &&
    [
      "historicalReceiptRestored",
      "productionIntegrationVerified",
      "callerDurableReentryVerified",
      "schemaBindingVerified",
      "osFaultInjectionVerified",
      "strictDeadlineClaimed",
    ].every((key) => packet[key] === false) &&
    ["absent", "present", "unknown"].includes(String(packet.fixturePresence)) &&
    Array.isArray(packet.closeResults) &&
    packet.closeResults.length <= 128 &&
    packet.closeResults.every(closeRow);
  const isNativeVerified =
    isParsedPacket &&
    packet?.status === "observed" &&
    packet.phase === "complete" &&
    packet.currentReadsVerified === 2 &&
    packet.rejectionChecksVerified === 7 &&
    packet.sameBytesReplacementDistinguished === true &&
    packet.fixtureRenameIssued === true &&
    packet.checkedClosesConfirmed === true &&
    packet.unexpectedMutationEffectIssued === false &&
    packet.cleanupIssuedCount === 8 &&
    packet.fixturePresence === "absent" &&
    Array.isArray(packet.closeResults) &&
    packet.closeResults.length > 0 &&
    packet.closeResults.every((row) => closeRow(row) && row.confirmed === true);

  return Boolean(isNativeVerified);
}

/**
 * cold fixtureの既往成功条件を保持する。
 *
 * @responsibility coldの返却schemaと観測結果を一括照合する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 欠落、未知field、不一致と未確認closeを拒否し、production未接続を維持する。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function validateColdPacket(value: unknown): boolean {
  const packet =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const fields = [
    "contract",
    "contractRevision",
    "run",
    "status",
    "phase",
    "preparedFreshReadVerified",
    "publishedFreshReadVerified",
    "rejectionChecksVerified",
    "modeledDecisionChecksVerified",
    "directoryRejected",
    "checkedClosesConfirmed",
    "closeResults",
    "workers",
    "cleanupIssuedCount",
    "fixturePresence",
    "unexpectedMutationEffectIssued",
    "productionIntegrationVerified",
    "callerDurableReentryVerified",
    "osFaultInjectionVerified",
    "strictDeadlineClaimed",
  ];
  const phases = [
    "preflight",
    "fixture_absence",
    "tokens",
    "fixture_create",
    "record_create",
    "directory_close",
    "workers",
    "fresh_reader",
    "stage_destination_absence",
    "stage_write_open",
    "stage_delete_open",
    "stage_remove",
    "stage_rename_no_replace",
    "public_destination_absence",
    "public_write_open",
    "public_delete_open",
    "public_remove",
    "public_rename_no_replace",
    "rejections",
    "decision_models",
    "cleanup_file",
    "cleanup_directory",
    "complete",
  ];
  const booleanFields = [
    "preparedFreshReadVerified",
    "publishedFreshReadVerified",
    "rejectionChecksVerified",
    "modeledDecisionChecksVerified",
    "directoryRejected",
    "checkedClosesConfirmed",
    "unexpectedMutationEffectIssued",
  ];
  const closeOwners = [
    "identity_reader",
    "token_impersonation",
    "token_primary",
    "record_close",
    "directory_close",
    "collision_fixture",
    "cold_reader",
    "rejection_reader",
    "unexpected_mutation_open",
  ];
  /**
   * Nativeの閉じた行構造を検査する。
   *
   * @responsibility 形の検査を実観測の成功やAuthorityへ昇格しない。
   * @trace ERB-IT-001
   * @trace ERB-IT-002
   * @trace ERB-IT-003
   * @precondition 解析済み未知JSONだけ。
   * @stimulus 固定keyと型を照合する。
   * @observation nullable exit、role、close値。
   * @oracle 余分/欠落fieldと未知値を拒否する。
   * @cleanup N/A: 純粋な検査だけ。
   * @boundary Native packet→Node Owner。
   */
  function closedRow(value: unknown, kind: "close" | "worker"): boolean {
    if (value === null || typeof value !== "object") return false;
    const row = value as Record<string, unknown>;
    const keys =
      kind === "close"
        ? ["owner", "confirmed"]
        : ["role", "state", "exitCode", "cleanupConfirmed"];
    if (
      Object.keys(row).length !== keys.length ||
      !Object.keys(row).every((key) => keys.includes(key))
    )
      return false;
    if (kind === "close")
      return (
        typeof row.owner === "string" &&
        closeOwners.includes(row.owner) &&
        typeof row.confirmed === "boolean"
      );
    return (
      ["prepared", "published"].includes(String(row.role)) &&
      [
        "start_created_failed",
        "start_not_created",
        "exited",
        "cancelled",
        "timeout",
        "observation_failed",
      ].includes(String(row.state)) &&
      (row.exitCode === null ||
        (Number.isInteger(row.exitCode) &&
          Number(row.exitCode) >= 0 &&
          Number(row.exitCode) <= 4294967295)) &&
      typeof row.cleanupConfirmed === "boolean"
    );
  }
  const isPacketParsed =
    packet !== null &&
    Object.keys(packet).length === fields.length &&
    Object.keys(packet).every((key) => fields.includes(key)) &&
    packet.contract === "crdd-native/terminal-cold-observation-fixture" &&
    packet.contractRevision === 1 &&
    packet.run === "cold.261003.219b9b53.r1" &&
    ["observed", "unconfirmed"].includes(String(packet.status)) &&
    phases.includes(String(packet.phase)) &&
    booleanFields.every((key) => typeof packet[key] === "boolean") &&
    Number.isInteger(packet.cleanupIssuedCount) &&
    Number(packet.cleanupIssuedCount) >= 0 &&
    Number(packet.cleanupIssuedCount) <= 6 &&
    ["absent", "present", "unknown"].includes(String(packet.fixturePresence)) &&
    [
      "productionIntegrationVerified",
      "callerDurableReentryVerified",
      "osFaultInjectionVerified",
      "strictDeadlineClaimed",
    ].every((key) => packet[key] === false) &&
    Array.isArray(packet.closeResults) &&
    packet.closeResults.length <= 128 &&
    packet.closeResults.every((row) => closedRow(row, "close")) &&
    Array.isArray(packet.workers) &&
    packet.workers.length <= 2 &&
    packet.workers.every((row) => closedRow(row, "worker"));
  const workers = Array.isArray(packet?.workers)
    ? (packet.workers as Record<string, unknown>[])
    : [];
  const closes = Array.isArray(packet?.closeResults)
    ? (packet.closeResults as Record<string, unknown>[])
    : [];
  const isNativeReplyVerified =
    isPacketParsed &&
    packet?.status === "observed" &&
    packet.phase === "complete" &&
    [
      "preparedFreshReadVerified",
      "publishedFreshReadVerified",
      "rejectionChecksVerified",
      "modeledDecisionChecksVerified",
      "directoryRejected",
      "checkedClosesConfirmed",
    ].every((key) => packet[key] === true) &&
    packet.cleanupIssuedCount === 6 &&
    packet.fixturePresence === "absent" &&
    packet.unexpectedMutationEffectIssued === false &&
    closes.length > 0 &&
    closes.every((row) => row.confirmed === true) &&
    workers.length === 2 &&
    workers[0]?.role === "prepared" &&
    workers[0]?.state === "exited" &&
    workers[0]?.exitCode === 71 &&
    workers[0]?.cleanupConfirmed === true &&
    workers[1]?.role === "published" &&
    workers[1]?.state === "exited" &&
    workers[1]?.exitCode === 72 &&
    workers[1]?.cleanupConfirmed === true;

  return Boolean(isNativeReplyVerified);
}

/**
 * rename fixtureの既往成功条件を保持する。
 *
 * @responsibility renameの返却schemaと観測結果を一括照合する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 欠落、未知field、不一致と未確認closeを拒否し、production未接続を維持する。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function validateRenamePacket(value: unknown): boolean {
  const packet =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const phases = [
    "preflight",
    "fixture_absence",
    "tokens",
    "fixture_create",
    "directory_open",
    "collision_fixture_create",
    "stage_create",
    "same_handle_rename",
    "stage_absence_while_held",
    "public_readback_while_held",
    "public_destination_absence",
    "public_write_open",
    "public_delete_open",
    "public_remove",
    "public_rename_no_replace",
    "collision_stage_create",
    "collision_rename",
    "created_names",
    "collision_close",
    "stage_close",
    "directory_close",
    "cleanup_file",
    "cleanup_directory",
    "complete",
  ];
  const fields = [
    "contract",
    "status",
    "phase",
    "osError",
    "maximumBytes",
    "noReplaceVerified",
    "heldMutationRejected",
    "allCheckedClosesConfirmed",
    "closeResults",
    "cleanupIssuedCount",
    "unexpectedMutationEffectIssued",
    "fixturePresence",
    "productionIntegrationVerified",
    "renameNtStatus",
    "collisionNtStatus",
    "renameIssued",
    "collisionRenameIssued",
    "stageAbsentWhileHeldVerified",
  ];
  const closeOwners = [
    "identity_reader",
    "token_impersonation",
    "token_primary",
    "collision_fixture",
    "unexpected_mutation_open",
    "rename_reader",
    "collision_close",
    "stage_close",
    "directory_close",
  ];
  const isPacketParsed =
    packet !== null &&
    Object.keys(packet).length === fields.length &&
    Object.keys(packet).every((key) => fields.includes(key)) &&
    packet.contract === "crdd-native/terminal-rename-candidate-fixture" &&
    (packet.status === "observed" || packet.status === "unconfirmed") &&
    typeof packet.phase === "string" &&
    phases.includes(packet.phase) &&
    (packet.osError === null ||
      (Number.isInteger(packet.osError) &&
        Number(packet.osError) >= 0 &&
        Number(packet.osError) <= 4294967295)) &&
    packet.maximumBytes === 8192 &&
    typeof packet.noReplaceVerified === "boolean" &&
    typeof packet.heldMutationRejected === "boolean" &&
    (packet.allCheckedClosesConfirmed === null ||
      typeof packet.allCheckedClosesConfirmed === "boolean") &&
    Number.isInteger(packet.cleanupIssuedCount) &&
    Number(packet.cleanupIssuedCount) >= 0 &&
    Number(packet.cleanupIssuedCount) <= 4 &&
    typeof packet.unexpectedMutationEffectIssued === "boolean" &&
    ["present", "absent", "unknown"].includes(String(packet.fixturePresence)) &&
    packet.productionIntegrationVerified === false &&
    (packet.renameNtStatus === null ||
      (Number.isInteger(packet.renameNtStatus) &&
        Number(packet.renameNtStatus) >= -2147483648 &&
        Number(packet.renameNtStatus) <= 2147483647)) &&
    (packet.collisionNtStatus === null ||
      (Number.isInteger(packet.collisionNtStatus) &&
        Number(packet.collisionNtStatus) >= -2147483648 &&
        Number(packet.collisionNtStatus) <= 2147483647)) &&
    typeof packet.renameIssued === "boolean" &&
    typeof packet.collisionRenameIssued === "boolean" &&
    typeof packet.stageAbsentWhileHeldVerified === "boolean" &&
    Array.isArray(packet.closeResults) &&
    packet.closeResults.length <= 64 &&
    packet.closeResults.every((item: unknown) => {
      if (item === null || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return (
        Object.keys(row).length === 2 &&
        Object.keys(row).every((key) => ["owner", "confirmed"].includes(key)) &&
        typeof row.owner === "string" &&
        closeOwners.includes(row.owner) &&
        typeof row.confirmed === "boolean"
      );
    });
  const isNativeReplyVerified =
    isPacketParsed &&
    packet?.status === "observed" &&
    packet.phase === "complete" &&
    packet.osError === null &&
    packet.noReplaceVerified === true &&
    packet.heldMutationRejected === true &&
    packet.allCheckedClosesConfirmed === true &&
    packet.cleanupIssuedCount === 4 &&
    packet.renameIssued === true &&
    packet.collisionRenameIssued === true &&
    packet.renameNtStatus === 0 &&
    packet.collisionNtStatus === -1073741771 &&
    packet.stageAbsentWhileHeldVerified === true &&
    packet.unexpectedMutationEffectIssued === false &&
    packet.fixturePresence === "absent" &&
    Array.isArray(packet.closeResults) &&
    packet.closeResults.length > 0 &&
    packet.closeResults.every(
      (row: Record<string, unknown>) => row.confirmed === true,
    );

  return Boolean(isNativeReplyVerified);
}

/**
 * publication fixtureの既往成功条件を保持する。
 *
 * @responsibility publicationの返却schemaと観測結果を一括照合する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 欠落、未知field、不一致と未確認closeを拒否し、production未接続を維持する。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function validatePublicationPacket(value: unknown): boolean {
  const packet =
    value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const phases = [
    "preflight",
    "fixture_absence",
    "tokens",
    "fixture_create",
    "directory_open",
    "collision_fixture_create",
    "stage_create",
    "stage_publish",
    "stage_destination_absence",
    "stage_write_open",
    "stage_delete_open",
    "stage_remove",
    "stage_rename_no_replace",
    "public_destination_absence",
    "public_write_open",
    "public_delete_open",
    "public_remove",
    "public_rename_no_replace",
    "repeated_publish",
    "collision_stage_create",
    "collision_publish",
    "invalid_input_rejection",
    "created_names",
    "collision_close",
    "stage_close",
    "directory_close",
    "cleanup_file",
    "cleanup_directory",
    "complete",
  ];
  const fields = [
    "contract",
    "status",
    "phase",
    "osError",
    "maximumBytes",
    "noReplaceVerified",
    "heldMutationRejected",
    "allCheckedClosesConfirmed",
    "closeResults",
    "cleanupIssuedCount",
    "unexpectedMutationEffectIssued",
    "fixturePresence",
    "productionIntegrationVerified",
    "stageAbsenceWhileHeldVerified",
    "recordReceipt",
    "collisionReceipt",
  ];
  const closeOwners = [
    "identity_reader",
    "token_impersonation",
    "token_primary",
    "collision_fixture",
    "unexpected_mutation_open",
    "collision_close",
    "stage_close",
    "directory_close",
    "collision_source_close",
    "stage_reader_close",
    "stage_source_close",
  ];
  /**
   * 私有receiptの閉じた形を成功補完せず確認する。
   *
   * @responsibility 未取得、既知falseと確認不明を区別する。
   * @trace ERB-IT-001
   * @trace ERB-IT-002
   * @precondition Native packet解析後の未知値だけを受け取る。
   * @stimulus 固定field、型、参照と返却値を照合する。
   * @observation bool、nullable closeとNTSTATUS、未取得null。
   * @oracle 形の受理だけで公開・清掃成功を判定しない。
   * @cleanup N/A: 局所検査だけ。
   * @boundary Native receipt→Node Owner。
   */
  function isReceipt(value: unknown): boolean {
    if (value === null) return true;
    if (typeof value !== "object") return false;
    const row = value as Record<string, unknown>;
    const fields = [
      "reference",
      "stageCreated",
      "writeIssued",
      "flushIssued",
      "renameIssued",
      "renameNtStatus",
      "stageAbsenceVerified",
      "publicationVerified",
      "readerCloseConfirmed",
      "recordHandleCloseConfirmed",
      "handleCloseConfirmed",
    ];
    return (
      Object.keys(row).length === fields.length &&
      Object.keys(row).every((key) => fields.includes(key)) &&
      typeof row.reference === "string" &&
      /^host-terminal\.[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(
        row.reference,
      ) &&
      [
        "stageCreated",
        "writeIssued",
        "flushIssued",
        "renameIssued",
        "stageAbsenceVerified",
        "publicationVerified",
      ].every((key) => typeof row[key] === "boolean") &&
      (row.renameNtStatus === null ||
        (Number.isInteger(row.renameNtStatus) &&
          Number(row.renameNtStatus) >= -2147483648 &&
          Number(row.renameNtStatus) <= 2147483647)) &&
      [
        "readerCloseConfirmed",
        "recordHandleCloseConfirmed",
        "handleCloseConfirmed",
      ].every((key) => row[key] === null || typeof row[key] === "boolean")
    );
  }
  const record =
    packet?.recordReceipt !== null && typeof packet?.recordReceipt === "object"
      ? (packet.recordReceipt as Record<string, unknown>)
      : null;
  const collision =
    packet?.collisionReceipt !== null &&
    typeof packet?.collisionReceipt === "object"
      ? (packet.collisionReceipt as Record<string, unknown>)
      : null;
  const isPacketParsed =
    packet !== null &&
    Object.keys(packet).length === fields.length &&
    Object.keys(packet).every((key) => fields.includes(key)) &&
    packet.contract === "crdd-native/terminal-rename-publication-fixture" &&
    (packet.status === "observed" || packet.status === "unconfirmed") &&
    typeof packet.phase === "string" &&
    phases.includes(packet.phase) &&
    (packet.osError === null ||
      (Number.isInteger(packet.osError) &&
        Number(packet.osError) >= 0 &&
        Number(packet.osError) <= 4294967295)) &&
    packet.maximumBytes === 8192 &&
    typeof packet.noReplaceVerified === "boolean" &&
    typeof packet.heldMutationRejected === "boolean" &&
    (packet.allCheckedClosesConfirmed === null ||
      typeof packet.allCheckedClosesConfirmed === "boolean") &&
    Number.isInteger(packet.cleanupIssuedCount) &&
    Number(packet.cleanupIssuedCount) >= 0 &&
    Number(packet.cleanupIssuedCount) <= 4 &&
    typeof packet.unexpectedMutationEffectIssued === "boolean" &&
    ["present", "absent", "unknown"].includes(String(packet.fixturePresence)) &&
    packet.productionIntegrationVerified === false &&
    typeof packet.stageAbsenceWhileHeldVerified === "boolean" &&
    isReceipt(packet.recordReceipt) &&
    isReceipt(packet.collisionReceipt) &&
    Array.isArray(packet.closeResults) &&
    packet.closeResults.length <= 64 &&
    packet.closeResults.every((item: unknown) => {
      if (item === null || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return (
        Object.keys(row).length === 2 &&
        Object.keys(row).every((key) => ["owner", "confirmed"].includes(key)) &&
        typeof row.owner === "string" &&
        closeOwners.includes(row.owner) &&
        typeof row.confirmed === "boolean"
      );
    });
  const isNativeReplyVerified =
    isPacketParsed &&
    packet?.status === "observed" &&
    packet.phase === "complete" &&
    packet.osError === null &&
    packet.noReplaceVerified === true &&
    packet.heldMutationRejected === true &&
    packet.allCheckedClosesConfirmed === true &&
    packet.cleanupIssuedCount === 4 &&
    packet.stageAbsenceWhileHeldVerified === true &&
    record !== null &&
    record.reference === "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3001" &&
    record.stageCreated === true &&
    record.writeIssued === true &&
    record.flushIssued === true &&
    record.renameIssued === true &&
    record.renameNtStatus === 0 &&
    record.stageAbsenceVerified === true &&
    record.publicationVerified === true &&
    record.readerCloseConfirmed === true &&
    record.recordHandleCloseConfirmed === true &&
    record.handleCloseConfirmed === true &&
    collision !== null &&
    collision.reference ===
      "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3002" &&
    collision.stageCreated === true &&
    collision.writeIssued === true &&
    collision.flushIssued === true &&
    collision.renameIssued === true &&
    collision.renameNtStatus === -1073741771 &&
    collision.stageAbsenceVerified === false &&
    collision.publicationVerified === false &&
    collision.readerCloseConfirmed === null &&
    collision.recordHandleCloseConfirmed === true &&
    collision.handleCloseConfirmed === true &&
    packet.unexpectedMutationEffectIssued === false &&
    packet.fixturePresence === "absent" &&
    Array.isArray(packet.closeResults) &&
    packet.closeResults.length > 0 &&
    packet.closeResults.every(
      (row: Record<string, unknown>) => row.confirmed === true,
    );

  return Boolean(isNativeReplyVerified);
}

/**
 * Native観測行の既知fieldだけを受理する。
 *
 * @responsibility dispositionとknown-fileの閉じたJSON objectを確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 配列、null、未知fieldと欠落fieldを拒否する。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function isClosedPacket(
  value: unknown,
  fields: readonly string[],
): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    Object.keys(value).every((key) => fields.includes(key))
  );
}

/**
 * dispositionの要求結果と明示不存在を照合する。
 *
 * @responsibility 非空拒否、reader保持、世代再取得、終了後不存在を混同せず判定する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 拒否一件と受理九件、明示不存在十件、全close確認を要求する。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function validateDispositionPacket(value: unknown): boolean {
  const fields = [
    "contract",
    "status",
    "phase",
    "attempts",
    "closes",
    "directAbsenceCount",
    "nonemptyRejected",
    "readerPendingNotAbsence",
    "generationReacquired",
    "parentRemoved",
    "productionIntegrationVerified",
    "legacyRootsTouched",
  ];
  if (!isClosedPacket(value, fields)) return false;
  const closeOwners = [
    "impersonation",
    "primary",
    "identity_reader",
    "extra",
    "child",
    "root",
    "marker_writer",
    "marker_reader",
    "generation",
    "reacquired_generation",
    "parent_chain",
  ];
  return (
    value.contract === "crdd-native/terminal-disposition-fixture" &&
    value.status === "observed" &&
    value.phase === "completed" &&
    value.directAbsenceCount === 10 &&
    [
      "nonemptyRejected",
      "readerPendingNotAbsence",
      "generationReacquired",
      "parentRemoved",
    ].every((key) => value[key] === true) &&
    value.productionIntegrationVerified === false &&
    value.legacyRootsTouched === false &&
    Array.isArray(value.attempts) &&
    value.attempts.length === 10 &&
    value.attempts.every(
      (row: unknown, index: number) =>
        isClosedPacket(row, ["accepted", "osError"]) &&
        row.accepted === (index !== 0) &&
        row.osError === (index === 0 ? 145 : null),
    ) &&
    Array.isArray(value.closes) &&
    value.closes.length > 0 &&
    value.closes.length <= 128 &&
    value.closes.every(
      (row: unknown) =>
        isClosedPacket(row, ["owner", "confirmed"]) &&
        typeof row.owner === "string" &&
        closeOwners.includes(row.owner) &&
        row.confirmed === true,
    )
  );
}

/**
 * known-fileの同一handle観測と自己生成対象の終了条件を照合する。
 *
 * @responsibility 通常観測、既知Identity拒否、内容・長さ・競合・型の拒否とreparse未観測を区別する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle Rustのcreation_unavailableを維持し、未観測をreparse拒否成立にしない。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
function validateKnownFilePacket(value: unknown): boolean {
  const fields = [
    "contract",
    "status",
    "normalVerified",
    "rejections",
    "reparseResult",
    "reparseCreationOsError",
    "compatibleReaderObserved",
    "closes",
    "directRootAbsence",
    "nonUseVerified",
    "twelveEntityProtocolVerified",
    "productionRecoveryVerified",
    "legacyRootsTouched",
  ];
  if (!isClosedPacket(value, fields)) return false;
  const reasons = [
    "missing",
    "known_identity",
    "terminal_known_file_content_invalid",
    "terminal_known_file_length_invalid",
    "terminal_known_file_length_invalid",
    "hardlink",
    "write_competition",
    "delete_competition",
    "directory",
  ];
  const closeOwners = [
    "impersonation",
    "primary",
    "identity_reader",
    "normal_reader",
    "known_reader",
    "mismatched_known_reader",
    "rejected_reader",
    "hardlink_reader",
    "competitor",
    "compatible_observation_reader",
    "compatible_reader",
    "directory_reader",
    "reparse_reader",
    "workspace_guard",
  ];
  const isReparseVerified =
    value.reparseResult === "rejected" && value.reparseCreationOsError === null;
  const isReparseUnavailable =
    value.reparseResult === "creation_unavailable" &&
    Number.isInteger(value.reparseCreationOsError) &&
    Number(value.reparseCreationOsError) >= 0 &&
    Number(value.reparseCreationOsError) <= 2147483647;
  if (isReparseVerified) reasons.push("reparse");
  return (
    value.contract === "crdd-native/terminal-known-file-fixture" &&
    value.status === "observed" &&
    value.normalVerified === true &&
    value.compatibleReaderObserved === true &&
    value.directRootAbsence === true &&
    [
      "nonUseVerified",
      "twelveEntityProtocolVerified",
      "productionRecoveryVerified",
      "legacyRootsTouched",
    ].every((key) => value[key] === false) &&
    (isReparseVerified || isReparseUnavailable) &&
    Array.isArray(value.rejections) &&
    value.rejections.length === reasons.length &&
    value.rejections.every(
      (reason: unknown, index: number) => reason === reasons[index],
    ) &&
    Array.isArray(value.closes) &&
    value.closes.length > 0 &&
    value.closes.length <= 128 &&
    value.closes.every(
      (row: unknown) =>
        isClosedPacket(row, ["owner", "confirmed"]) &&
        typeof row.owner === "string" &&
        closeOwners.includes(row.owner) &&
        row.confirmed === true,
    )
  );
}

/**
 * 正式Native終端fixtureのpacket判定を有限選択する。
 *
 * @responsibility 選択したfixtureの固定判定だけを呼び、解析不能shapeを拒否する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Native試験から解析した未知packetを受け取る。
 * @stimulus 固定schemaと既往Ownerの成功条件へ照合する。
 * @observation packet内の観測値、拒否理由、closeとcleanup結果。
 * @oracle 各既往判定を保持する。known-fileのreparse未観測はpacket値として呼出側へ残る。
 * @cleanup N/A: 同期の純粋判定で資源を取得しない。
 * @boundary Native返却packetの判定だけ。Process終端・入力不変・物理不存在は実行Ownerが確認する。
 */
export function validateNativeTerminalFixture(
  kind: NativeTerminalFixtureKind,
  packet: unknown,
  mode?: "before" | "after",
): boolean {
  try {
    switch (kind) {
      case "target":
        return validateTargetPacket(packet);
      case "save":
        return validateSavePacket(packet);
      case "capacity":
        return validateCapacityPacket(packet, mode);
      case "current":
        return validateCurrentPacket(packet);
      case "cold":
        return validateColdPacket(packet);
      case "rename":
        return validateRenamePacket(packet);
      case "publication":
        return validatePublicationPacket(packet);
      case "disposition":
        return validateDispositionPacket(packet);
      case "known-file":
        return validateKnownFilePacket(packet);
      default:
        return false;
    }
  } catch {
    return false;
  }
}

/**
 * Native終端fixtureの閉packet判定を永続回帰で確認する。
 *
 * @packageDocumentation
 * @responsibility Rustが生成する返却schemaと実測正常値を固定し、不正形状と保証低下を拒否する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @level IT
 * @scope 自己生成fixture九種の返却packet。履歴診断と実OS動作は含めない。
 * @boundary Native返却契約と正式TypeScript判定の接続。旧verification実物への依存なし。
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  type NativeTerminalFixtureKind,
  validateNativeTerminalFixture,
} from "../fixtures/native-terminal-oracles.ts";

/**
 * Rustの対象一式fixtureが記録する拒否行を固定する。
 *
 * @responsibility 既知12対象、ユーザー・marker・file属性、旧11対象と欠落・型・長さの拒否母集団を作る。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition N/A: 純粋な固定fixture判定で外部資源を使わない。
 * @stimulus 固定packetと契約を破る単一変更を判定入口へ渡す。
 * @observation 判定入口のboolean返却。
 * @oracle filesystem/host_record.rsのterminal_target_fixtureが生成する164行と同じ理由・位置・handle数を保持する。
 * @cleanup N/A: メモリ内の同期判定だけ。
 * @boundary 未知JSON値からpacket判定まで。OS観測とProcess終端は対象外。
 */
function targetRejectionFixture(): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const cases: [string, number | null, number][] = [
    ["terminal_target_known_mismatch", 0, 9],
    ["terminal_target_known_mismatch", 0, 9],
    ["terminal_target_known_mismatch", 0, 9],
    ["terminal_target_known_mismatch", 0, 9],
    ["terminal_target_known_mismatch", 0, 9],
    ["terminal_target_known_mismatch", 0, 9],
    ["terminal_target_known_mismatch", 1, 9],
    ["terminal_target_known_mismatch", 1, 9],
    ["terminal_target_known_mismatch", 1, 9],
    ["terminal_target_known_mismatch", 1, 9],
    ["terminal_target_known_mismatch", 1, 9],
    ["terminal_target_known_mismatch", 1, 9],
    ["terminal_target_known_mismatch", 2, 9],
    ["terminal_target_known_mismatch", 2, 9],
    ["terminal_target_known_mismatch", 2, 9],
    ["terminal_target_known_mismatch", 2, 9],
    ["terminal_target_known_mismatch", 2, 9],
    ["terminal_target_known_mismatch", 2, 9],
    ["terminal_target_known_mismatch", 3, 9],
    ["terminal_target_known_mismatch", 3, 9],
    ["terminal_target_known_mismatch", 3, 9],
    ["terminal_target_known_mismatch", 3, 9],
    ["terminal_target_known_mismatch", 3, 9],
    ["terminal_target_known_mismatch", 3, 9],
    ["terminal_target_known_mismatch", 4, 9],
    ["terminal_target_known_mismatch", 4, 9],
    ["terminal_target_known_mismatch", 4, 9],
    ["terminal_target_known_mismatch", 4, 9],
    ["terminal_target_known_mismatch", 4, 9],
    ["terminal_target_known_mismatch", 4, 9],
    ["terminal_target_known_mismatch", 5, 9],
    ["terminal_target_known_mismatch", 5, 9],
    ["terminal_target_known_mismatch", 5, 9],
    ["terminal_target_known_mismatch", 5, 9],
    ["terminal_target_known_mismatch", 5, 9],
    ["terminal_target_known_mismatch", 5, 9],
    ["terminal_target_known_mismatch", 6, 9],
    ["terminal_target_known_mismatch", 6, 9],
    ["terminal_target_known_mismatch", 6, 9],
    ["terminal_target_known_mismatch", 6, 9],
    ["terminal_target_known_mismatch", 6, 9],
    ["terminal_target_known_mismatch", 6, 9],
    ["terminal_target_known_mismatch", 7, 9],
    ["terminal_target_known_mismatch", 7, 9],
    ["terminal_target_known_mismatch", 7, 9],
    ["terminal_target_known_mismatch", 7, 9],
    ["terminal_target_known_mismatch", 7, 9],
    ["terminal_target_known_mismatch", 7, 9],
    ["terminal_target_known_mismatch", 8, 9],
    ["terminal_target_known_mismatch", 8, 9],
    ["terminal_target_known_mismatch", 8, 9],
    ["terminal_target_known_mismatch", 8, 9],
    ["terminal_target_known_mismatch", 8, 9],
    ["terminal_target_known_mismatch", 8, 9],
    ["terminal_target_known_mismatch", 9, 9],
    ["terminal_target_known_mismatch", 9, 9],
    ["terminal_target_known_mismatch", 9, 9],
    ["terminal_target_known_mismatch", 9, 9],
    ["terminal_target_known_mismatch", 9, 9],
    ["terminal_target_known_mismatch", 9, 9],
    ["terminal_target_known_mismatch", 10, 9],
    ["terminal_target_known_mismatch", 10, 9],
    ["terminal_target_known_mismatch", 10, 9],
    ["terminal_target_known_mismatch", 10, 9],
    ["terminal_target_known_mismatch", 10, 9],
    ["terminal_target_known_mismatch", 10, 9],
    ["terminal_known_file_known_mismatch", 11, 9],
    ["terminal_known_file_known_mismatch", 11, 9],
    ["terminal_known_file_known_mismatch", 11, 9],
    ["terminal_known_file_known_mismatch", 11, 9],
    ["terminal_known_file_known_mismatch", 11, 9],
    ["terminal_known_file_known_mismatch", 11, 9],
    ["terminal_target_known_user_mismatch", null, 9],
    ["terminal_target_known_marker_mismatch", 4, 9],
    ["terminal_known_file_known_mismatch", 11, 9],
    ["terminal_known_file_known_mismatch", 11, 9],
    ["terminal_known_file_known_mismatch", 11, 9],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_mismatch", null, 8],
    ["terminal_target_known_name_mismatch", null, 0],
    ["terminal_open_failed", 3, 0],
    ["terminal_target_type_invalid", 3, 1],
    ["terminal_open_failed", 4, 1],
    ["terminal_target_type_invalid", 4, 2],
    ["terminal_open_failed", 5, 2],
    ["terminal_target_type_invalid", 5, 3],
    ["terminal_open_failed", 6, 3],
    ["terminal_target_type_invalid", 6, 4],
    ["terminal_open_failed", 7, 4],
    ["terminal_target_type_invalid", 7, 5],
    ["terminal_open_failed", 8, 5],
    ["terminal_target_type_invalid", 8, 6],
    ["terminal_open_failed", 9, 6],
    ["terminal_target_type_invalid", 9, 7],
    ["terminal_open_failed", 10, 7],
    ["terminal_target_type_invalid", 10, 8],
    ["terminal_length_invalid", 4, 8],
    ["terminal_length_invalid", 4, 8],
  ];
  for (const [reason, position, handlesAcquired] of cases)
    rows.push({
      reason,
      operationReason: reason,
      position,
      handlesAcquired,
      closes: Array.from({ length: handlesAcquired }, () => true),
    });
  return rows;
}

/**
 * Rustschemaと既往実測に一致する正常packetを固定する。
 *
 * @responsibility 九種類と容量before/afterの正常返却を外部ファイルなしで保持する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition N/A: 純粋な固定fixture判定で外部資源を使わない。
 * @stimulus 固定packetと契約を破る単一変更を判定入口へ渡す。
 * @observation 判定入口のboolean返却。
 * @oracle schema、run、固定理由、数量、close、cleanupとproduction未接続の値を保持する。
 * @cleanup N/A: メモリ内の同期判定だけ。
 * @boundary 未知JSON値からpacket判定まで。OS観測とProcess終端は対象外。
 */
const packetFixtures: Record<string, Record<string, unknown>> = {
  disposition: {
    contract: "crdd-native/terminal-disposition-fixture",
    status: "observed",
    phase: "completed",
    attempts: [
      {
        accepted: false,
        osError: 145,
      },
      {
        accepted: true,
        osError: null,
      },
      {
        accepted: true,
        osError: null,
      },
      {
        accepted: true,
        osError: null,
      },
      {
        accepted: true,
        osError: null,
      },
      {
        accepted: true,
        osError: null,
      },
      {
        accepted: true,
        osError: null,
      },
      {
        accepted: true,
        osError: null,
      },
      {
        accepted: true,
        osError: null,
      },
      {
        accepted: true,
        osError: null,
      },
    ],
    closes: [
      {
        owner: "impersonation",
        confirmed: true,
      },
      {
        owner: "primary",
        confirmed: true,
      },
    ],
    directAbsenceCount: 10,
    nonemptyRejected: true,
    readerPendingNotAbsence: true,
    generationReacquired: true,
    parentRemoved: true,
    productionIntegrationVerified: false,
    legacyRootsTouched: false,
  },
  "capacity-before": {
    contract: "crdd-native/terminal-capacity-fixture",
    run: "capacity.261003.c8d1092a.r3-before",
    phase: "completed",
    permissionMode: "before",
    gateOperationReason: "terminal_capacity_prior_settlement_unknown",
    combinedFailureCases: 4,
    priorRejectionVerified: true,
    observed: true,
    directoryCreated: true,
    cleanupIssued: true,
    cleanupDirectoryCount: 3,
    fixturePresence: "absent",
    actualRecordSaves: 0,
    receipts: [
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 258,
        ownershipAcquired: false,
        actionStarted: false,
        releaseConfirmed: null,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 0,
        ownershipAcquired: true,
        actionStarted: true,
        releaseConfirmed: true,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 0,
        ownershipAcquired: true,
        actionStarted: true,
        releaseConfirmed: true,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: null,
        ownershipAcquired: false,
        actionStarted: false,
        releaseConfirmed: null,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: false,
        waitResult: null,
        ownershipAcquired: false,
        actionStarted: false,
        releaseConfirmed: null,
        closeConfirmed: null,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 128,
        ownershipAcquired: true,
        actionStarted: false,
        releaseConfirmed: true,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 0,
        ownershipAcquired: true,
        actionStarted: false,
        releaseConfirmed: true,
        closeConfirmed: true,
      },
    ],
    closes: [
      {
        owner: "token_impersonation",
        confirmed: true,
      },
      {
        owner: "token_primary",
        confirmed: true,
      },
    ],
  },
  "capacity-after": {
    contract: "crdd-native/terminal-capacity-fixture",
    run: "capacity.261003.c8d1092a.r3-after",
    phase: "completed",
    permissionMode: "after",
    gateOperationReason: null,
    combinedFailureCases: 4,
    priorRejectionVerified: true,
    observed: true,
    directoryCreated: true,
    cleanupIssued: true,
    cleanupDirectoryCount: 3,
    fixturePresence: "absent",
    actualRecordSaves: 0,
    receipts: [
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 258,
        ownershipAcquired: false,
        actionStarted: false,
        releaseConfirmed: null,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 0,
        ownershipAcquired: true,
        actionStarted: true,
        releaseConfirmed: true,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 0,
        ownershipAcquired: true,
        actionStarted: true,
        releaseConfirmed: true,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: null,
        ownershipAcquired: false,
        actionStarted: false,
        releaseConfirmed: null,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: false,
        waitResult: null,
        ownershipAcquired: false,
        actionStarted: false,
        releaseConfirmed: null,
        closeConfirmed: null,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 128,
        ownershipAcquired: true,
        actionStarted: false,
        releaseConfirmed: true,
        closeConfirmed: true,
      },
      {
        createIssued: true,
        handleAcquired: true,
        waitResult: 0,
        ownershipAcquired: true,
        actionStarted: true,
        releaseConfirmed: true,
        closeConfirmed: true,
      },
    ],
    closes: [
      {
        owner: "token_impersonation",
        confirmed: true,
      },
      {
        owner: "token_primary",
        confirmed: true,
      },
    ],
  },
  save: {
    contract: "crdd-native/terminal-save-fixture",
    contractRevision: 1,
    run: "save.261003.c8d1092a.r1",
    status: "observed",
    phase: "complete",
    directoryCreated: true,
    workerJoined: true,
    savesVerified: 3,
    rejectionsVerified: 6,
    inventoriesVerified: 2,
    cleanupFiles: 7,
    cleanupDirectories: 2,
    checkedClosesConfirmed: true,
    fixturePresence: "absent",
    saves: [
      {
        reference: "host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec3001",
        beforeEntries: 0,
        beforeBytes: 0,
        readersOpened: 0,
        readersClosed: 0,
        enumerationComplete: true,
        searchAcquired: true,
        searchClose: true,
        stageCreated: true,
        writeIssued: true,
        flushIssued: true,
        renameIssued: true,
        stageAbsent: true,
        publicVerified: true,
        readerClose: true,
        writerClose: true,
        recordClose: true,
        capacityAction: true,
        capacityRelease: true,
        capacityClose: true,
      },
      {
        reference: "host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec3004",
        beforeEntries: 4,
        beforeBytes: 8198,
        readersOpened: 4,
        readersClosed: 4,
        enumerationComplete: true,
        searchAcquired: true,
        searchClose: true,
        stageCreated: true,
        writeIssued: true,
        flushIssued: true,
        renameIssued: true,
        stageAbsent: true,
        publicVerified: true,
        readerClose: true,
        writerClose: true,
        recordClose: true,
        capacityAction: true,
        capacityRelease: true,
        capacityClose: true,
      },
      {
        reference: "host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec3006",
        beforeEntries: 6,
        beforeBytes: 8201,
        readersOpened: 6,
        readersClosed: 6,
        enumerationComplete: true,
        searchAcquired: true,
        searchClose: true,
        stageCreated: true,
        writeIssued: true,
        flushIssued: true,
        renameIssued: true,
        stageAbsent: true,
        publicVerified: true,
        readerClose: true,
        writerClose: true,
        recordClose: true,
        capacityAction: true,
        capacityRelease: true,
        capacityClose: true,
      },
    ],
    rejections: [
      {
        reference: "host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec3008",
        reason: "terminal_capacity_timeout",
        recordPresent: false,
        inventoryPresent: false,
        capacityAction: false,
        capacityRelease: null,
        capacityClose: true,
      },
      {
        reference: "host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec3004",
        reason: "terminal_record_already_present",
        recordPresent: false,
        inventoryPresent: true,
        capacityAction: true,
        capacityRelease: true,
        capacityClose: true,
      },
      {
        reference: "host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec3006",
        reason: "terminal_open_failed",
        recordPresent: false,
        inventoryPresent: true,
        capacityAction: true,
        capacityRelease: true,
        capacityClose: true,
      },
      {
        reference: "host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec3007",
        reason: "terminal_inventory_unknown_entry",
        recordPresent: false,
        inventoryPresent: true,
        capacityAction: true,
        capacityRelease: true,
        capacityClose: true,
      },
      {
        reference: "host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec3007",
        reason: "terminal_inventory_size_invalid",
        recordPresent: false,
        inventoryPresent: true,
        capacityAction: true,
        capacityRelease: true,
        capacityClose: true,
      },
      {
        reference: "host-terminal.c8d1092a-f1e6-4e78-89ab-93d4a9ec3008",
        reason: "terminal_inventory_not_file",
        recordPresent: false,
        inventoryPresent: true,
        capacityAction: true,
        capacityRelease: true,
        capacityClose: true,
      },
    ],
    inventories: [
      {
        entries: 4,
        bytes: 8198,
        readersOpened: 4,
        readersClosed: 4,
        complete: true,
        searchClose: true,
      },
      {
        entries: 7,
        bytes: 8202,
        readersOpened: 7,
        readersClosed: 7,
        complete: true,
        searchClose: true,
      },
    ],
    closes: [
      {
        role: "token_impersonation",
        confirmed: true,
      },
      {
        role: "token_primary",
        confirmed: true,
      },
    ],
    productionIntegrationVerified: false,
    osFaultInjectionVerified: false,
  },
  "known-file": {
    contract: "crdd-native/terminal-known-file-fixture",
    status: "observed",
    normalVerified: true,
    rejections: [
      "missing",
      "known_identity",
      "terminal_known_file_content_invalid",
      "terminal_known_file_length_invalid",
      "terminal_known_file_length_invalid",
      "hardlink",
      "write_competition",
      "delete_competition",
      "directory",
      "reparse",
    ],
    reparseResult: "rejected",
    reparseCreationOsError: null,
    compatibleReaderObserved: true,
    closes: [
      {
        owner: "impersonation",
        confirmed: true,
      },
      {
        owner: "primary",
        confirmed: true,
      },
    ],
    directRootAbsence: true,
    nonUseVerified: false,
    twelveEntityProtocolVerified: false,
    productionRecoveryVerified: false,
    legacyRootsTouched: false,
  },
  current: {
    contract: "crdd-native/terminal-current-candidate-fixture",
    contractRevision: 1,
    run: "current.261003.73c9d18f.r1",
    status: "observed",
    phase: "complete",
    currentReadsVerified: 2,
    rejectionChecksVerified: 7,
    sameBytesReplacementDistinguished: true,
    fixtureRenameIssued: true,
    checkedClosesConfirmed: true,
    closeResults: [
      {
        owner: "identity_reader",
        confirmed: true,
      },
      {
        owner: "token_impersonation",
        confirmed: true,
      },
    ],
    cleanupIssuedCount: 8,
    fixturePresence: "absent",
    unexpectedMutationEffectIssued: false,
    historicalReceiptRestored: false,
    productionIntegrationVerified: false,
    callerDurableReentryVerified: false,
    schemaBindingVerified: false,
    osFaultInjectionVerified: false,
    strictDeadlineClaimed: false,
  },
  cold: {
    contract: "crdd-native/terminal-cold-observation-fixture",
    contractRevision: 1,
    run: "cold.261003.219b9b53.r1",
    status: "observed",
    phase: "complete",
    preparedFreshReadVerified: true,
    publishedFreshReadVerified: true,
    rejectionChecksVerified: true,
    modeledDecisionChecksVerified: true,
    directoryRejected: true,
    checkedClosesConfirmed: true,
    closeResults: [
      {
        owner: "identity_reader",
        confirmed: true,
      },
      {
        owner: "token_impersonation",
        confirmed: true,
      },
    ],
    workers: [
      {
        role: "prepared",
        state: "exited",
        exitCode: 71,
        cleanupConfirmed: true,
      },
      {
        role: "published",
        state: "exited",
        exitCode: 72,
        cleanupConfirmed: true,
      },
    ],
    cleanupIssuedCount: 6,
    fixturePresence: "absent",
    unexpectedMutationEffectIssued: false,
    productionIntegrationVerified: false,
    callerDurableReentryVerified: false,
    osFaultInjectionVerified: false,
    strictDeadlineClaimed: false,
  },
  rename: {
    contract: "crdd-native/terminal-rename-candidate-fixture",
    status: "observed",
    phase: "complete",
    osError: null,
    renameNtStatus: 0,
    collisionNtStatus: -1073741771,
    renameIssued: true,
    collisionRenameIssued: true,
    stageAbsentWhileHeldVerified: true,
    maximumBytes: 8192,
    noReplaceVerified: true,
    heldMutationRejected: true,
    allCheckedClosesConfirmed: true,
    closeResults: [
      {
        owner: "identity_reader",
        confirmed: true,
      },
      {
        owner: "token_impersonation",
        confirmed: true,
      },
    ],
    cleanupIssuedCount: 4,
    unexpectedMutationEffectIssued: false,
    fixturePresence: "absent",
    productionIntegrationVerified: false,
  },
  publication: {
    contract: "crdd-native/terminal-rename-publication-fixture",
    status: "observed",
    phase: "complete",
    osError: null,
    maximumBytes: 8192,
    noReplaceVerified: true,
    heldMutationRejected: true,
    allCheckedClosesConfirmed: true,
    closeResults: [
      {
        owner: "identity_reader",
        confirmed: true,
      },
      {
        owner: "token_impersonation",
        confirmed: true,
      },
    ],
    cleanupIssuedCount: 4,
    unexpectedMutationEffectIssued: false,
    fixturePresence: "absent",
    productionIntegrationVerified: false,
    stageAbsenceWhileHeldVerified: true,
    recordReceipt: {
      reference: "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3001",
      stageCreated: true,
      writeIssued: true,
      flushIssued: true,
      renameIssued: true,
      renameNtStatus: 0,
      stageAbsenceVerified: true,
      publicationVerified: true,
      readerCloseConfirmed: true,
      recordHandleCloseConfirmed: true,
      handleCloseConfirmed: true,
    },
    collisionReceipt: {
      reference: "host-terminal.219b9b53-f1e6-4e78-89ab-93d4a9ec3002",
      stageCreated: true,
      writeIssued: true,
      flushIssued: true,
      renameIssued: true,
      renameNtStatus: -1073741771,
      stageAbsenceVerified: false,
      publicationVerified: false,
      readerCloseConfirmed: null,
      recordHandleCloseConfirmed: true,
      handleCloseConfirmed: true,
    },
  },
  target: {
    contract: "crdd-native/terminal-target-fixture",
    contractRevision: 2,
    run: "target.261004.9da03fb1.r3",
    observed: true,
    phase: "complete",
    normalObservations: 6,
    createdEntities: 11,
    cleanupEntities: 11,
    replacementsCreated: 8,
    replacementsCleaned: 8,
    replacementCleanupModelCases: 3,
    settlementModelCases: 4,
    checkedCloses: 89,
    checkedClosesConfirmed: true,
    fixturePresence: "absent",
    maximumMarkerVerified: true,
    settlementModelVerified: true,
    recordSaves: 0,
    productionIntegrationVerified: false,
    osFaultInjectionVerified: false,
  },
};
assert.ok(packetFixtures.target);
packetFixtures.target.rejections = targetRejectionFixture();

/**
 * 変更が別の試験へ伝播しないpacket複製を作る。
 *
 * @responsibility 異常刺激ごとに独立したJSON相当値を保持する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition N/A: 純粋な固定fixture判定で外部資源を使わない。
 * @stimulus 固定packetと契約を破る単一変更を判定入口へ渡す。
 * @observation 判定入口のboolean返却。
 * @oracle 元の正常fixtureを変えず同じfieldと行を複製する。
 * @cleanup N/A: メモリ内の同期判定だけ。
 * @boundary 未知JSON値からpacket判定まで。OS観測とProcess終端は対象外。
 */
function packetCopy(key: string): Record<string, unknown> {
  const fixture = packetFixtures[key];
  assert.ok(fixture);
  return structuredClone(fixture);
}

/**
 * 異常刺激を与える固定packet行を確認して取得する。
 *
 * @responsibility 配列や行の欠落を試験準備失敗として区別する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition 独立複製した正常packetだけを受け取る。
 * @stimulus 指定したfieldと行位置を読む。
 * @observation 配列内のobject行。
 * @oracle 欠落、非配列、非objectをassertionで拒否する。
 * @cleanup N/A: メモリ内参照だけ。
 * @boundary N/A: 同一processの固定fixture。
 */
function packetRow(
  packet: Record<string, unknown>,
  field: string,
  position: number,
): Record<string, unknown> {
  const rows = packet[field];
  assert.ok(Array.isArray(rows));
  const row: unknown = rows[position];
  assert.ok(row !== null && typeof row === "object" && !Array.isArray(row));
  return row as Record<string, unknown>;
}

/**
 * 正式有限fixture集合の正常値と閉schemaを確認する。
 *
 * @responsibility 未知値、未知field、欠落field、誤runと誤契約を正常fixtureから区別する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition N/A: 純粋な固定fixture判定で外部資源を使わない。
 * @stimulus 固定packetと契約を破る単一変更を判定入口へ渡す。
 * @observation 判定入口のboolean返却。
 * @oracle 十正常入力は受理し、各field欠落と誤契約、誤run、余分field、非objectは拒否する。
 * @cleanup N/A: メモリ内の同期判定だけ。
 * @boundary 未知JSON値からpacket判定まで。OS観測とProcess終端は対象外。
 */
test("Native terminal packet oracle preserves all finite fixture schemas", () => {
  for (const [key, packet] of Object.entries(packetFixtures)) {
    const kind = (
      key.startsWith("capacity-") ? "capacity" : key
    ) as NativeTerminalFixtureKind;
    const mode =
      key === "capacity-before"
        ? "before"
        : key === "capacity-after"
          ? "after"
          : undefined;
    assert.equal(validateNativeTerminalFixture(kind, packet, mode), true, key);
    for (const invalid of [
      null,
      [],
      {},
      true,
      1,
      "packet",
      { ...packet, contract: "unknown" },
      { ...packet, unexpected: true },
    ])
      assert.equal(
        validateNativeTerminalFixture(kind, invalid, mode),
        false,
        key,
      );
    for (const field of Object.keys(packet)) {
      const malformed = packetCopy(key);
      delete malformed[field];
      assert.equal(
        validateNativeTerminalFixture(kind, malformed, mode),
        false,
        `${key} missing ${field}`,
      );
    }
    if ("run" in packet)
      assert.equal(
        validateNativeTerminalFixture(
          kind,
          { ...packet, run: "wrong-run" },
          mode,
        ),
        false,
        key,
      );
    for (const field of ["status", "phase", "fixturePresence"])
      if (field in packet)
        assert.equal(
          validateNativeTerminalFixture(
            kind,
            { ...packet, [field]: "unknown" },
            mode,
          ),
          false,
          `${key} ${field}`,
        );
    for (const field of [
      "productionIntegrationVerified",
      "productionRecoveryVerified",
      "nonUseVerified",
      "legacyRootsTouched",
      "osFaultInjectionVerified",
      "callerDurableReentryVerified",
      "schemaBindingVerified",
      "strictDeadlineClaimed",
      "historicalReceiptRestored",
      "twelveEntityProtocolVerified",
    ])
      if (field in packet)
        assert.equal(
          validateNativeTerminalFixture(
            kind,
            { ...packet, [field]: true },
            mode,
          ),
          false,
          `${key} ${field}`,
        );
  }
});

/**
 * 拒否理由・位置・数量・closeの相関を破るpacketを拒否する。
 *
 * @responsibility 成功表示だけでは検証母集団と資源終端を代用できないことを確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition N/A: 純粋な固定fixture判定で外部資源を使わない。
 * @stimulus 固定packetと契約を破る単一変更を判定入口へ渡す。
 * @observation 判定入口のboolean返却。
 * @oracle 行削除、誤reason、誤位置、未確認close、誤数量と容量mode不一致を拒否する。
 * @cleanup N/A: メモリ内の同期判定だけ。
 * @boundary 未知JSON値からpacket判定まで。OS観測とProcess終端は対象外。
 */
test("Native terminal packet oracle rejects correlated observation failures", () => {
  const target = packetCopy("target");
  const targetRows = target.rejections as Record<string, unknown>[];
  for (const position of [0, 66, 72, 73, 74, 77, 145, 146, 161, 162, 163]) {
    const bad = packetCopy("target");
    packetRow(bad, "rejections", position).operationReason = "wrong";
    assert.equal(validateNativeTerminalFixture("target", bad), false);
  }
  targetRows.pop();
  assert.equal(validateNativeTerminalFixture("target", target), false);
  assert.equal(
    validateNativeTerminalFixture("target", {
      ...packetFixtures.target,
      normalObservations: 3,
    }),
    false,
  );
  const save = packetCopy("save");
  packetRow(save, "saves", 1).beforeBytes = 8197;
  assert.equal(validateNativeTerminalFixture("save", save), false);
  const rejectedSave = packetCopy("save");
  packetRow(rejectedSave, "rejections", 0).capacityRelease = true;
  assert.equal(validateNativeTerminalFixture("save", rejectedSave), false);
  const cold = packetCopy("cold");
  packetRow(cold, "workers", 1).exitCode = 71;
  assert.equal(validateNativeTerminalFixture("cold", cold), false);
  const publication = packetCopy("publication");
  (
    publication.collisionReceipt as Record<string, unknown>
  ).publicationVerified = true;
  assert.equal(
    validateNativeTerminalFixture("publication", publication),
    false,
  );
  for (const key of [
    "capacity-before",
    "capacity-after",
    "current",
    "cold",
    "rename",
    "publication",
    "disposition",
    "known-file",
  ]) {
    const kind = (
      key.startsWith("capacity-") ? "capacity" : key
    ) as NativeTerminalFixtureKind;
    const mode =
      key === "capacity-before"
        ? "before"
        : key === "capacity-after"
          ? "after"
          : undefined;
    const bad = packetCopy(key);
    const field = "closeResults" in bad ? "closeResults" : "closes";
    packetRow(bad, field, 0).confirmed = false;
    assert.equal(validateNativeTerminalFixture(kind, bad, mode), false, key);
    const unknown = packetCopy(key);
    packetRow(unknown, field, 0).unexpected = true;
    assert.equal(
      validateNativeTerminalFixture(kind, unknown, mode),
      false,
      key,
    );
  }
  assert.equal(
    validateNativeTerminalFixture(
      "capacity",
      packetFixtures["capacity-before"],
      "after",
    ),
    false,
  );
  assert.equal(
    validateNativeTerminalFixture("capacity", packetFixtures["capacity-after"]),
    false,
  );
  const disposition = packetCopy("disposition");
  packetRow(disposition, "attempts", 0).accepted = true;
  assert.equal(
    validateNativeTerminalFixture("disposition", disposition),
    false,
  );
});

/**
 * known-fileのreparse拒否と作成不可を区別して維持する。
 *
 * @responsibility Rust既存仕様の未観測を正常拒否成立へ昇格せず返却値へ残す。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition N/A: 純粋な固定fixture判定で外部資源を使わない。
 * @stimulus 固定packetと契約を破る単一変更を判定入口へ渡す。
 * @observation 判定入口のboolean返却。
 * @oracle creation_unavailableは理由行なしとOSエラー付きだけを受理し、矛盾した値を拒否する。
 * @cleanup N/A: メモリ内の同期判定だけ。
 * @boundary 未知JSON値からpacket判定まで。OS観測とProcess終端は対象外。
 */
test("Native known-file oracle preserves explicit reparse not-observed outcome", () => {
  const unavailable = packetCopy("known-file");
  unavailable.reparseResult = "creation_unavailable";
  unavailable.reparseCreationOsError = 1314;
  (unavailable.rejections as string[]).pop();
  assert.equal(validateNativeTerminalFixture("known-file", unavailable), true);
  assert.equal(unavailable.reparseResult, "creation_unavailable");
  assert.equal(
    validateNativeTerminalFixture("known-file", {
      ...unavailable,
      reparseCreationOsError: null,
    }),
    false,
  );
  assert.equal(
    validateNativeTerminalFixture("known-file", {
      ...unavailable,
      reparseResult: "rejected",
    }),
    false,
  );
  assert.equal(
    validateNativeTerminalFixture("known-file", {
      ...unavailable,
      rejections: [...(unavailable.rejections as string[]), "reparse"],
    }),
    false,
  );
});

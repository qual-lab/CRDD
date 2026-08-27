import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  canCreateDockerDesktopRepairOperation,
  createDockerDesktopRepairOperation,
  describeDockerDesktopRepairRecordStoreContract,
  hasDockerDesktopRepairRecordCapacity,
  inventoryDockerDesktopRepairOperations,
  persistDockerDesktopRepairStage,
  type DockerDesktopRepairLedgerSnapshot,
  type DockerDesktopRepairOperation,
} from "../src/security/docker-desktop-repair-record-store.ts";

function fixture(t: TestContext) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-docker-repair-record-"),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const runtimeStateRoot = path.join(root, "RuntimeState");
  const localAppData = path.join(root, "LocalAppData");
  fs.mkdirSync(runtimeStateRoot);
  fs.mkdirSync(path.join(localAppData, "Docker"), { recursive: true });
  const boundary = Object.freeze({
    runtimeStateRoot,
    runtimeStateIdentityHash: "1".repeat(64),
    runtimeStateProtectionHash: "2".repeat(64),
    localUserBindingHash: "3".repeat(64),
    runtimeStateBindingHash: "4".repeat(64),
    dockerPolicySha256: "5".repeat(64),
    crddManifestHash: "6".repeat(64),
    crddReleaseSequence: 1,
    crddTree: "7".repeat(40),
    packageContentRootSha256: "8".repeat(64),
    localAppData,
  });
  const ledger = Object.freeze({
    processEffects: Object.freeze([]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued" as const,
    filesystemEffects: Object.freeze([]),
    filesystemEffectIssued: false,
    filesystemEffectConfirmation: "not_issued" as const,
    engineReady: false,
    staleState: "absent" as const,
    hostSafety: "safe" as const,
    evidenceState: "not_preserved" as const,
    disposition: "not_applicable" as const,
    liveRunIdentity: null,
  });
  return Object.freeze({ boundary, ledger, runtimeStateRoot });
}

function ledgerForRecord(ledger: DockerDesktopRepairOperation["ledger"]) {
  const lastRecordWriteIndex = ledger.filesystemEffects.findLastIndex(
    (entry) => entry.action === "record_write",
  );
  const filesystemEffects = ledger.filesystemEffects.map((entry, index) =>
    entry.action === "record_write" &&
    index === lastRecordWriteIndex &&
    entry.confirmation === "unknown"
      ? Object.freeze({ ...entry, confirmation: "confirmed" as const })
      : entry,
  );
  filesystemEffects.push(
    Object.freeze({
      sequence: filesystemEffects.length,
      action: "record_write" as const,
      phase: "settled" as const,
      issued: true,
      confirmation: "unknown" as const,
    }),
  );
  return Object.freeze({
    ...ledger,
    evidenceState:
      lastRecordWriteIndex >= 0 ? ("preserved" as const) : ledger.evidenceState,
    filesystemEffects: Object.freeze(filesystemEffects),
    filesystemEffectIssued: true as const,
    filesystemEffectConfirmation: "unknown" as const,
  });
}

function persistRecord(
  boundary: Parameters<typeof persistDockerDesktopRepairStage>[0],
  operation: Parameters<typeof persistDockerDesktopRepairStage>[1],
  stage: Parameters<typeof persistDockerDesktopRepairStage>[2],
  ledger: Parameters<typeof persistDockerDesktopRepairStage>[3],
) {
  return persistDockerDesktopRepairStage(
    boundary,
    operation,
    stage,
    ledgerForRecord(ledger),
  );
}

function persistHostEffect(
  boundary: Parameters<typeof persistDockerDesktopRepairStage>[0],
  operation: DockerDesktopRepairOperation,
  kind: "process" | "filesystem",
  action:
    | "official_shutdown"
    | "native_termination"
    | "wsl_termination"
    | "runtime_directory_rename"
    | "desktop_launch",
  observed: Readonly<{
    issued: boolean;
    confirmation: "confirmed" | "not_issued";
  }>,
) {
  const key = kind === "process" ? "processEffects" : "filesystemEffects";
  const issuedKey =
    kind === "process" ? "processEffectIssued" : "filesystemEffectIssued";
  const confirmationKey =
    kind === "process"
      ? "processEffectConfirmation"
      : "filesystemEffectConfirmation";
  const entries = operation.ledger[key];
  const intentLedger = Object.freeze({
    ...operation.ledger,
    [key]: Object.freeze([
      ...entries,
      Object.freeze({
        sequence: entries.length,
        action,
        phase: "intent_recorded" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]),
    [issuedKey]: entries.some((entry) => entry.issued === true) ? true : null,
    [confirmationKey]: "unknown",
  });
  const intent = persistRecord(
    boundary,
    operation,
    operation.stage,
    intentLedger,
  );
  assert.ok(intent);
  const settledEntries = intent.ledger[key].map((entry) =>
    entry.action === action
      ? Object.freeze({
          ...entry,
          phase: "settled" as const,
          ...observed,
        })
      : entry,
  );
  const allEntries =
    kind === "process"
      ? settledEntries
      : settledEntries.filter((entry) => entry.action !== "record_write");
  const aggregateIssued = allEntries.some((entry) => entry.issued === true)
    ? true
    : allEntries.some((entry) => entry.issued === null)
      ? null
      : false;
  const aggregateConfirmation = allEntries.some(
    (entry) => entry.confirmation === "unknown",
  )
    ? "unknown"
    : aggregateIssued
      ? "confirmed"
      : "not_issued";
  const settledLedger = Object.freeze({
    ...intent.ledger,
    [key]: Object.freeze(settledEntries),
    [issuedKey]: aggregateIssued,
    [confirmationKey]: aggregateConfirmation,
  });
  const settled = persistRecord(
    boundary,
    intent,
    operation.stage,
    settledLedger,
  );
  assert.ok(settled);
  return settled;
}

function persistNativeKnownAbsent(
  boundary: Parameters<typeof persistDockerDesktopRepairStage>[0],
  operation: DockerDesktopRepairOperation,
) {
  const observed = persistRecord(
    boundary,
    operation,
    "prepared",
    Object.freeze({
      ...operation.ledger,
      processEffects: Object.freeze([
        ...operation.ledger.processEffects,
        Object.freeze({
          sequence: operation.ledger.processEffects.length,
          action: "native_termination" as const,
          phase: "settled" as const,
          issued: false,
          confirmation: "not_issued" as const,
        }),
      ]),
      processEffectIssued: true,
      processEffectConfirmation: "confirmed" as const,
    }),
  );
  assert.ok(observed);
  return observed;
}

test("repair recordは順序・hash chain・境界identityを保持して再構成できる", (t) => {
  const { boundary, ledger } = fixture(t);
  let operation: DockerDesktopRepairOperation =
    createDockerDesktopRepairOperation(
      boundary,
      Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
      ledger,
    );
  const prepared = persistRecord(boundary, operation, "prepared", ledger);
  assert.ok(prepared);
  operation = persistHostEffect(
    boundary,
    prepared,
    "process",
    "official_shutdown",
    {
      issued: true,
      confirmation: "confirmed",
    },
  );
  operation = persistNativeKnownAbsent(boundary, operation);
  operation = persistHostEffect(
    boundary,
    operation,
    "process",
    "wsl_termination",
    {
      issued: true,
      confirmation: "confirmed",
    },
  );
  const stopped = persistRecord(
    boundary,
    operation,
    "processes_stopped",
    operation.ledger,
  );
  assert.ok(stopped);
  operation = persistHostEffect(
    boundary,
    stopped,
    "filesystem",
    "runtime_directory_rename",
    { issued: true, confirmation: "confirmed" },
  );
  const renamed = persistRecord(
    boundary,
    operation,
    "renamed",
    Object.freeze({ ...operation.ledger, staleState: "retained" as const }),
  );
  assert.ok(renamed);
  operation = persistHostEffect(
    boundary,
    renamed,
    "process",
    "desktop_launch",
    {
      issued: true,
      confirmation: "confirmed",
    },
  );
  const pendingLedger = Object.freeze({
    ...operation.ledger,
    engineReady: true,
    staleState: "retained" as const,
    evidenceState: "preserved" as const,
    disposition: "pending_human_decision" as const,
    liveRunIdentity: Object.freeze({ dev: "9", ino: "8", birthtimeNs: "7" }),
  });
  const pending = persistRecord(
    boundary,
    operation,
    "recovered_pending_disposition",
    pendingLedger,
  );
  assert.ok(pending);
  const closed = persistRecord(
    boundary,
    pending,
    "closed_retained",
    Object.freeze({
      ...pending.ledger,
      disposition: "retained_by_human_decision" as const,
    }),
  );
  assert.ok(closed);
  operation = closed;
  const inventory = inventoryDockerDesktopRepairOperations(boundary);
  assert.equal(inventory.status, "verified");
  assert.equal(inventory.operations.length, 1);
  assert.equal(inventory.operations[0]?.stage, "closed_retained");
  assert.equal(inventory.operations[0]?.operationId, operation.operationId);
});

test("renamed後の自然回復はlaunch発行を捏造せずactual Storeへ保存する", (t) => {
  const { boundary, ledger } = fixture(t);
  const created = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const prepared = persistRecord(boundary, created, "prepared", ledger);
  assert.ok(prepared);
  let operation = persistHostEffect(
    boundary,
    prepared,
    "process",
    "official_shutdown",
    { issued: true, confirmation: "confirmed" },
  );
  operation = persistNativeKnownAbsent(boundary, operation);
  operation = persistHostEffect(
    boundary,
    operation,
    "process",
    "wsl_termination",
    { issued: true, confirmation: "confirmed" },
  );
  const stopped = persistRecord(
    boundary,
    operation,
    "processes_stopped",
    operation.ledger,
  );
  assert.ok(stopped);
  operation = persistHostEffect(
    boundary,
    stopped,
    "filesystem",
    "runtime_directory_rename",
    { issued: true, confirmation: "confirmed" },
  );
  const renamed = persistRecord(
    boundary,
    operation,
    "renamed",
    Object.freeze({ ...operation.ledger, staleState: "retained" as const }),
  );
  assert.ok(renamed);
  const recoveredLedger = Object.freeze({
    ...renamed.ledger,
    processEffects: Object.freeze([
      ...renamed.ledger.processEffects,
      Object.freeze({
        sequence: renamed.ledger.processEffects.length,
        action: "observed_desktop_recovery" as const,
        phase: "settled" as const,
        issued: false,
        confirmation: "not_issued" as const,
      }),
    ]),
    engineReady: true,
    staleState: "retained" as const,
    hostSafety: "safe" as const,
    evidenceState: "preserved" as const,
    disposition: "pending_human_decision" as const,
    liveRunIdentity: Object.freeze({ dev: "9", ino: "8", birthtimeNs: "7" }),
  });
  const pending = persistRecord(
    boundary,
    renamed,
    "recovered_pending_disposition",
    recoveredLedger,
  );
  assert.ok(pending);
  assert.equal(
    pending.ledger.processEffects.some(
      (entry) => entry.action === "desktop_launch",
    ),
    false,
  );
  assert.equal(
    inventoryDockerDesktopRepairOperations(boundary).status,
    "verified",
  );
});

test("改ざん・欠落・foreign entryはinventory unknownとしてFail Closedにする", (t) => {
  const { boundary, ledger, runtimeStateRoot } = fixture(t);
  const operation = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const prepared = persistRecord(boundary, operation, "prepared", ledger);
  assert.ok(prepared);
  const record = path.join(
    prepared.operationDirectory,
    "repair-00-prepared.json",
  );
  fs.appendFileSync(record, " ");
  assert.equal(
    inventoryDockerDesktopRepairOperations(boundary).status,
    "unknown",
  );

  fs.rmSync(prepared.operationDirectory, { recursive: true, force: true });
  fs.mkdirSync(path.join(runtimeStateRoot, "docker-desktop-repair-foreign"));
  assert.equal(
    inventoryDockerDesktopRepairOperations(boundary).status,
    "unknown",
  );
});

test("record storeは削除せず明示close後もEvidenceを保持する", () => {
  const contract = describeDockerDesktopRepairRecordStoreContract();
  assert.equal(contract.staleDirectoryDeletion, false);
  assert.equal(contract.closedRetainedRequiresExplicitHumanCommand, true);
  assert.equal(contract.unfinishedOperationBlocksNewRepair, true);
});

test("record／operation容量はEffectや65件目directoryの前に判定できる", (t) => {
  const { boundary, ledger } = fixture(t);
  const operation = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  assert.equal(
    hasDockerDesktopRepairRecordCapacity(
      Object.freeze({ ...operation, sequence: 21 }),
      2,
    ),
    true,
  );
  assert.equal(
    hasDockerDesktopRepairRecordCapacity(
      Object.freeze({ ...operation, sequence: 22 }),
      2,
    ),
    false,
  );
  assert.equal(
    hasDockerDesktopRepairRecordCapacity(
      Object.freeze({ ...operation, sequence: 22 }),
      1,
    ),
    true,
  );
  assert.equal(
    hasDockerDesktopRepairRecordCapacity(
      Object.freeze({ ...operation, sequence: 23 }),
      1,
    ),
    false,
  );
  assert.equal(canCreateDockerDesktopRepairOperation(boundary), true);
  for (let index = 0; index < 64; index += 1) {
    const retained = createDockerDesktopRepairOperation(
      boundary,
      Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
      ledger,
    );
    assert.ok(persistRecord(boundary, retained, "prepared", ledger));
  }
  assert.equal(canCreateDockerDesktopRepairOperation(boundary), false);
  const sixtyFifth = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  assert.equal(persistRecord(boundary, sixtyFifth, "prepared", ledger), null);
  assert.equal(fs.existsSync(sixtyFifth.operationDirectory), false);
});

test("Effect ledgerは既知のissued事実を後退させず旧rev2／rev3を暗黙移行しない", (t) => {
  const { boundary, ledger } = fixture(t);
  const created = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const prepared = persistRecord(boundary, created, "prepared", ledger);
  assert.ok(prepared);
  const issued = Object.freeze({
    ...ledger,
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "native_termination",
        phase: "settled",
        issued: true,
        confirmation: "confirmed" as const,
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed" as const,
  });
  assert.equal(persistRecord(boundary, prepared, "prepared", issued), null);

  const record = path.join(
    prepared.operationDirectory,
    "repair-00-prepared.json",
  );
  const old = JSON.parse(fs.readFileSync(record, "utf8")) as Record<
    string,
    unknown
  >;
  for (const revision of [2, 3]) {
    old.schema = `crdd-coordinator/docker-desktop-repair-record/v${revision}`;
    old.contractRevision = revision;
    fs.writeFileSync(record, `${JSON.stringify(old)}\n`, "utf8");
    assert.equal(
      inventoryDockerDesktopRepairOperations(boundary).status,
      "unknown",
    );
  }
});

test("既知Effect後の自然回復は発行済み事実を保持したno-stale stageへ接続する", (t) => {
  const { boundary, ledger } = fixture(t);
  const created = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const prepared = persistRecord(boundary, created, "prepared", ledger);
  assert.ok(prepared);
  let effected = persistHostEffect(
    boundary,
    prepared,
    "process",
    "official_shutdown",
    { issued: true, confirmation: "confirmed" },
  );
  effected = persistNativeKnownAbsent(boundary, effected);
  effected = persistHostEffect(
    boundary,
    effected,
    "process",
    "wsl_termination",
    { issued: true, confirmation: "confirmed" },
  );
  const stopped = persistRecord(
    boundary,
    effected,
    "processes_stopped",
    effected.ledger,
  );
  assert.ok(stopped);
  const pendingLedger = Object.freeze({
    ...stopped.ledger,
    processEffects: Object.freeze([
      ...stopped.ledger.processEffects,
      Object.freeze({
        sequence: stopped.ledger.processEffects.length,
        action: "observed_desktop_recovery",
        phase: "settled",
        issued: false,
        confirmation: "not_issued" as const,
      }),
    ]),
    processEffectConfirmation: "confirmed" as const,
    engineReady: true,
    staleState: "absent" as const,
    disposition: "known_effect_recovery_pending_human_decision" as const,
    liveRunIdentity: Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
  });
  const pending = persistRecord(
    boundary,
    stopped,
    "no_stale_known_effect_recovery_pending",
    pendingLedger,
  );
  assert.ok(pending);
  assert.equal(pending.ledger.processEffectIssued, true);
  assert.equal(pending.ledger.processEffectConfirmation, "confirmed");
  assert.equal(
    inventoryDockerDesktopRepairOperations(boundary).status,
    "verified",
  );
});

test("writerはreader非互換Effectを永続化しない", (t) => {
  const { boundary, ledger } = fixture(t);
  const created = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const incompatible = Object.freeze({
    ...ledger,
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "official_shutdown" as const,
        phase: "settled" as const,
        issued: false,
        confirmation: "unknown" as const,
      }),
    ]),
    processEffectIssued: false,
    processEffectConfirmation: "not_issued" as const,
  });
  assert.equal(
    persistRecord(boundary, created, "prepared", incompatible),
    null,
  );
  assert.equal(fs.existsSync(created.operationDirectory), false);
});

test("validatorはHost Effect初出settled・不足stage・rename二系列を拒否する", (t) => {
  const { boundary, ledger } = fixture(t);
  const created = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const invalidInitialWrite = Object.freeze({
    ...ledger,
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write" as const,
        phase: "settled" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]),
    filesystemEffectIssued: null,
    filesystemEffectConfirmation: "unknown" as const,
  });
  assert.equal(
    persistDockerDesktopRepairStage(
      boundary,
      created,
      "prepared",
      invalidInitialWrite,
    ),
    null,
  );
  const directSettled = Object.freeze({
    ...ledger,
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "official_shutdown" as const,
        phase: "settled" as const,
        issued: true,
        confirmation: "confirmed" as const,
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed" as const,
  });
  assert.equal(
    persistRecord(boundary, created, "prepared", directSettled),
    null,
  );

  const prepared = persistRecord(boundary, created, "prepared", ledger);
  assert.ok(prepared);
  assert.equal(
    persistRecord(boundary, prepared, "processes_stopped", prepared.ledger),
    null,
  );

  for (const action of ["native_termination", "wsl_termination"] as const) {
    const invalidPrefix: DockerDesktopRepairLedgerSnapshot = Object.freeze({
      ...prepared.ledger,
      processEffects: Object.freeze([
        Object.freeze({
          sequence: 0,
          action,
          phase: "intent_recorded" as const,
          issued: null,
          confirmation: "unknown" as const,
        }),
      ]),
      processEffectIssued: null,
      processEffectConfirmation: "unknown" as const,
    });
    assert.equal(
      persistRecord(boundary, prepared, "prepared", invalidPrefix),
      null,
    );
  }

  const shutdownIntentLedger = Object.freeze({
    ...prepared.ledger,
    processEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "official_shutdown" as const,
        phase: "intent_recorded" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]),
    processEffectIssued: null,
    processEffectConfirmation: "unknown" as const,
  });
  for (const mutation of [
    { engineReady: true as const },
    { staleState: "unknown" as const },
    { hostSafety: "manual_recovery_required" as const },
    { disposition: "pending_human_decision" as const },
    {
      liveRunIdentity: Object.freeze({ dev: "4", ino: "5", birthtimeNs: "6" }),
    },
  ])
    assert.equal(
      persistRecord(
        boundary,
        prepared,
        "prepared",
        Object.freeze({ ...shutdownIntentLedger, ...mutation }),
      ),
      null,
    );
  const invalidEvidence = ledgerForRecord(shutdownIntentLedger);
  assert.equal(
    persistDockerDesktopRepairStage(
      boundary,
      prepared,
      "prepared",
      Object.freeze({ ...invalidEvidence, evidenceState: "unknown" }),
    ),
    null,
  );
  const shutdownIntent = persistRecord(
    boundary,
    prepared,
    "prepared",
    shutdownIntentLedger,
  );
  assert.ok(shutdownIntent);
  const observationAfterUnsettled = Object.freeze({
    ...shutdownIntent.ledger,
    processEffects: Object.freeze([
      ...shutdownIntent.ledger.processEffects,
      Object.freeze({
        sequence: 1,
        action: "historical_process_reconciliation" as const,
        phase: "settled" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]),
  });
  assert.equal(
    persistRecord(
      boundary,
      shutdownIntent,
      "prepared",
      observationAfterUnsettled,
    ),
    null,
  );

  let stoppedPrefix = persistHostEffect(
    boundary,
    prepared,
    "process",
    "official_shutdown",
    { issued: true, confirmation: "confirmed" },
  );
  stoppedPrefix = persistNativeKnownAbsent(boundary, stoppedPrefix);
  stoppedPrefix = persistHostEffect(
    boundary,
    stoppedPrefix,
    "process",
    "wsl_termination",
    { issued: true, confirmation: "confirmed" },
  );
  const stopped = persistRecord(
    boundary,
    stoppedPrefix,
    "processes_stopped",
    stoppedPrefix.ledger,
  );
  assert.ok(stopped);
  const renamedEffect = persistHostEffect(
    boundary,
    stopped,
    "filesystem",
    "runtime_directory_rename",
    { issued: true, confirmation: "confirmed" },
  );
  const renamed = persistRecord(
    boundary,
    renamedEffect,
    "renamed",
    Object.freeze({
      ...renamedEffect.ledger,
      staleState: "retained" as const,
    }),
  );
  assert.ok(renamed);
  const bothRenameSeries = Object.freeze({
    ...renamed.ledger,
    filesystemEffects: Object.freeze([
      ...renamed.ledger.filesystemEffects,
      Object.freeze({
        sequence: renamed.ledger.filesystemEffects.length,
        action: "observed_runtime_directory_rename" as const,
        phase: "settled" as const,
        issued: true,
        confirmation: "confirmed" as const,
      }),
    ]),
  });
  assert.equal(
    persistRecord(boundary, renamed, "renamed", bothRenameSeries),
    null,
  );
});

test("K/Nは非発行settlementとunknown reconciliationを単一Recordへ固定する", (t) => {
  const { boundary, ledger } = fixture(t);
  const created = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const prepared = persistRecord(boundary, created, "prepared", ledger);
  assert.ok(prepared);
  const shutdown = persistHostEffect(
    boundary,
    prepared,
    "process",
    "official_shutdown",
    { issued: true, confirmation: "confirmed" },
  );
  const nativeIntentLedger = Object.freeze({
    ...shutdown.ledger,
    processEffects: Object.freeze([
      ...shutdown.ledger.processEffects,
      Object.freeze({
        sequence: shutdown.ledger.processEffects.length,
        action: "native_termination" as const,
        phase: "intent_recorded" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "unknown" as const,
  });
  const nativeIntent = persistRecord(
    boundary,
    shutdown,
    "prepared",
    nativeIntentLedger,
  );
  assert.ok(nativeIntent);
  const settlementOnly = Object.freeze({
    ...nativeIntent.ledger,
    processEffects: Object.freeze(
      nativeIntent.ledger.processEffects.map((entry) =>
        entry.action === "native_termination"
          ? Object.freeze({
              ...entry,
              phase: "settled" as const,
              issued: false,
              confirmation: "not_issued" as const,
            })
          : entry,
      ),
    ),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed" as const,
  });
  const knownAbsent = persistRecord(
    boundary,
    nativeIntent,
    "prepared",
    settlementOnly,
  );
  assert.ok(knownAbsent);
  const createdUnknown = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "4", ino: "5", birthtimeNs: "6" }),
    ledger,
  );
  const preparedUnknown = persistRecord(
    boundary,
    createdUnknown,
    "prepared",
    ledger,
  );
  assert.ok(preparedUnknown);
  const shutdownUnknown = persistHostEffect(
    boundary,
    preparedUnknown,
    "process",
    "official_shutdown",
    { issued: true, confirmation: "confirmed" },
  );
  const nativeIntentUnknownLedger = Object.freeze({
    ...shutdownUnknown.ledger,
    processEffects: Object.freeze([
      ...shutdownUnknown.ledger.processEffects,
      Object.freeze({
        sequence: shutdownUnknown.ledger.processEffects.length,
        action: "native_termination" as const,
        phase: "intent_recorded" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "unknown" as const,
  });
  const nativeIntentUnknown = persistRecord(
    boundary,
    shutdownUnknown,
    "prepared",
    nativeIntentUnknownLedger,
  );
  assert.ok(nativeIntentUnknown);
  const settlementUnknown = Object.freeze({
    ...nativeIntentUnknown.ledger,
    processEffects: Object.freeze(
      nativeIntentUnknown.ledger.processEffects.map((entry) =>
        entry.action === "native_termination"
          ? Object.freeze({
              ...entry,
              phase: "settled" as const,
              issued: false,
              confirmation: "not_issued" as const,
            })
          : entry,
      ),
    ),
    processEffectIssued: true,
    processEffectConfirmation: "confirmed" as const,
  });
  const atomic = Object.freeze({
    ...settlementUnknown,
    processEffects: Object.freeze([
      ...settlementUnknown.processEffects,
      Object.freeze({
        sequence: settlementOnly.processEffects.length,
        action: "process_quiescence_reconciliation" as const,
        phase: "settled" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]),
    processEffectIssued: true,
    processEffectConfirmation: "unknown" as const,
  });
  const persisted = persistRecord(
    boundary,
    nativeIntentUnknown,
    "prepared",
    atomic,
  );
  assert.ok(persisted);
  assert.equal(
    inventoryDockerDesktopRepairOperations(boundary).status,
    "verified",
  );
  const illegalWsl = Object.freeze({
    ...persisted.ledger,
    processEffects: Object.freeze([
      ...persisted.ledger.processEffects,
      Object.freeze({
        sequence: persisted.ledger.processEffects.length,
        action: "wsl_termination" as const,
        phase: "intent_recorded" as const,
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]),
  });
  assert.equal(
    persistRecord(boundary, persisted, "prepared", illegalWsl),
    null,
  );
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  createDockerDesktopRepairOperation,
  describeDockerDesktopRepairRecordStoreContract,
  inventoryDockerDesktopRepairOperations,
  persistDockerDesktopRepairStage,
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
    filesystemEffects: Object.freeze([
      Object.freeze({
        sequence: 0,
        action: "record_write",
        phase: "settled",
        issued: true,
        confirmation: "confirmed" as const,
      }),
    ]),
    filesystemEffectIssued: true,
    filesystemEffectConfirmation: "confirmed" as const,
    engineReady: false,
    staleState: "absent" as const,
    hostSafety: "safe" as const,
    evidenceState: "preserved" as const,
    disposition: "not_applicable" as const,
    liveRunIdentity: null,
  });
  return Object.freeze({ boundary, ledger, runtimeStateRoot });
}

test("repair recordは順序・hash chain・境界identityを保持して再構成できる", (t) => {
  const { boundary, ledger } = fixture(t);
  let operation: DockerDesktopRepairOperation =
    createDockerDesktopRepairOperation(
      boundary,
      Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
      ledger,
    );
  for (const stage of [
    "prepared",
    "processes_stopped",
    "renamed",
    "recovered_pending_disposition",
    "closed_retained",
  ] as const) {
    const nextLedger = Object.freeze({
      ...ledger,
      processEffects:
        stage === "prepared"
          ? Object.freeze([])
          : Object.freeze([
              Object.freeze({
                sequence: 0,
                action: "native_termination",
                phase: "settled",
                issued: true,
                confirmation: "confirmed" as const,
              }),
            ]),
      processEffectIssued: stage !== "prepared",
      processEffectConfirmation:
        stage === "prepared" ? ("not_issued" as const) : ("confirmed" as const),
      engineReady:
        stage === "recovered_pending_disposition" ||
        stage === "closed_retained",
      staleState:
        stage === "recovered_pending_disposition" || stage === "closed_retained"
          ? ("retained" as const)
          : ("absent" as const),
      disposition:
        stage === "recovered_pending_disposition"
          ? ("pending_human_decision" as const)
          : stage === "closed_retained"
            ? ("retained_by_human_decision" as const)
            : ("not_applicable" as const),
      liveRunIdentity:
        stage === "recovered_pending_disposition" || stage === "closed_retained"
          ? Object.freeze({ dev: "9", ino: "8", birthtimeNs: "7" })
          : null,
    });
    const next = persistDockerDesktopRepairStage(
      boundary,
      operation,
      stage,
      nextLedger,
    );
    assert.ok(next);
    operation = next;
  }
  const inventory = inventoryDockerDesktopRepairOperations(boundary);
  assert.equal(inventory.status, "verified");
  assert.equal(inventory.operations.length, 1);
  assert.equal(inventory.operations[0]?.stage, "closed_retained");
  assert.equal(inventory.operations[0]?.operationId, operation.operationId);
});

test("改ざん・欠落・foreign entryはinventory unknownとしてFail Closedにする", (t) => {
  const { boundary, ledger, runtimeStateRoot } = fixture(t);
  const operation = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const prepared = persistDockerDesktopRepairStage(
    boundary,
    operation,
    "prepared",
    ledger,
  );
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

test("Effect ledgerは既知のissued事実を後退させず旧rev2／rev3を暗黙移行しない", (t) => {
  const { boundary, ledger } = fixture(t);
  const created = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const prepared = persistDockerDesktopRepairStage(
    boundary,
    created,
    "prepared",
    ledger,
  );
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
  const stopped = persistDockerDesktopRepairStage(
    boundary,
    prepared,
    "processes_stopped",
    issued,
  );
  assert.ok(stopped);
  assert.equal(
    persistDockerDesktopRepairStage(
      boundary,
      stopped,
      "processes_stopped",
      ledger,
    ),
    null,
  );

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

test("後続Effect不明は既知issuedを保持した追記としてno-stale stageへ接続する", (t) => {
  const { boundary, ledger } = fixture(t);
  const created = createDockerDesktopRepairOperation(
    boundary,
    Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
    ledger,
  );
  const prepared = persistDockerDesktopRepairStage(
    boundary,
    created,
    "prepared",
    ledger,
  );
  assert.ok(prepared);
  const stoppedLedger = Object.freeze({
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
  const stopped = persistDockerDesktopRepairStage(
    boundary,
    prepared,
    "processes_stopped",
    stoppedLedger,
  );
  assert.ok(stopped);
  const pendingLedger = Object.freeze({
    ...stoppedLedger,
    processEffects: Object.freeze([
      ...stoppedLedger.processEffects,
      Object.freeze({
        sequence: 1,
        action: "historical_process_reconciliation",
        phase: "settled",
        issued: null,
        confirmation: "unknown" as const,
      }),
    ]),
    processEffectConfirmation: "unknown" as const,
    engineReady: true,
    staleState: "absent" as const,
    disposition: "historical_effect_unknown_pending_human_decision" as const,
    liveRunIdentity: Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
  });
  const pending = persistDockerDesktopRepairStage(
    boundary,
    stopped,
    "no_stale_historical_effect_unknown_pending",
    pendingLedger,
  );
  assert.ok(pending);
  assert.equal(pending.ledger.processEffectIssued, true);
  assert.equal(pending.ledger.processEffectConfirmation, "unknown");
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
    persistDockerDesktopRepairStage(
      boundary,
      created,
      "prepared",
      incompatible,
    ),
    null,
  );
  assert.equal(fs.existsSync(created.operationDirectory), false);
});

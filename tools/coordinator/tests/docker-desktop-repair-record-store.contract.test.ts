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
    localAppData,
  });
  const ledger = Object.freeze({
    processEffectIssued: false,
    filesystemEffectIssued: true,
    engineReady: false,
    staleState: "absent" as const,
    hostSafety: "safe" as const,
    evidenceState: "preserved" as const,
    disposition: "not_applicable" as const,
    nativeHelperCleanupConfirmed: true,
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
    const next = persistDockerDesktopRepairStage(
      boundary,
      operation,
      stage,
      ledger,
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

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";

import {
  canCreateDockerDesktopRepairOperation,
  classifyDockerDesktopRepairResume,
  createDockerDesktopRepairOperation,
  type DockerDesktopRepairHistoryVerifier,
  type DockerDesktopRepairLedgerSnapshot,
  type DockerDesktopRepairOperation,
  describeDockerDesktopRepairRecordStoreContract,
  hasDockerDesktopRepairRecordCapacity,
  inspectDockerDesktopRepairHistoricalOperation,
  inventoryDockerDesktopRepairOperations,
  parseDockerDesktopRepairDirectoryName,
  persistDockerDesktopRepairHistoricalAdoption,
  persistDockerDesktopRepairHistoricalClosure,
  persistDockerDesktopRepairStage,
} from "../../src/security/docker-desktop-repair-record-store.ts";
import { inspectDockerRecoveryRootSnapshotWithLock } from "../../src/security/docker-recovery-runtime-internal.ts";

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
    runtimeExecutionIdentitySha256: "8".repeat(64),
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

test("Desktop修復の実Store記録はDocker Task inventoryと共存し原記録を保持する", (t) => {
  const base = fixture(t);
  const operation = createDockerDesktopRepairOperation(
    base.boundary,
    { dev: "1", ino: "2", birthtimeNs: "3" },
    base.ledger,
  );
  const saved = persistRecord(
    base.boundary,
    operation,
    "prepared",
    base.ledger,
  );
  assert.ok(saved);
  const snapshot = () =>
    fs.readdirSync(saved.operationDirectory).map((name) => {
      const target = path.join(saved.operationDirectory, name);
      return [
        name,
        fs.lstatSync(target).isDirectory()
          ? fs.readdirSync(target)
          : fs.readFileSync(target).toString("hex"),
      ];
    });
  const beforeEntries = snapshot();
  const result = inspectDockerRecoveryRootSnapshotWithLock(
    {
      rootPath: base.runtimeStateRoot,
      runtimeStateIdentityHash: base.boundary.runtimeStateIdentityHash,
      runtimeStateProtectionHash: base.boundary.runtimeStateProtectionHash,
      localUserBindingHash: base.boundary.localUserBindingHash,
      stableLogicalHomeBindingHash: "a".repeat(64),
    },
    () => Object.freeze({ release: () => true }),
  );
  assert.equal(result.status, "completed", JSON.stringify(result));
  assert.equal(result.reason, "docker_task_runtime_state_clean");
  assert.deepEqual(result.dockerRecoveryIds, []);
  assert.deepEqual(snapshot(), beforeEntries);
  assert.equal(
    inventoryDockerDesktopRepairOperations(base.boundary).operations[0]?.stage,
    "prepared",
  );
});

test("Desktop修復Directory名は正規の閉集合だけを認識する", () => {
  assert.equal(
    parseDockerDesktopRepairDirectoryName(
      `docker-desktop-repair-${"a".repeat(32)}`,
    ),
    "a".repeat(32),
  );
  for (const name of [
    null,
    "docker-desktop-repair-",
    `docker-desktop-repair-${"A".repeat(32)}`,
    `docker-desktop-repair-${"a".repeat(31)}`,
    `docker-desktop-repair-${"a".repeat(32)}.json`,
    `docker-desktop-repair-${"a".repeat(32)}/child`,
  ]) {
    assert.equal(parseDockerDesktopRepairDirectoryName(name), null);
  }
});

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

function historyFixture(t: TestContext) {
  const base = fixture(t);
  const created = createDockerDesktopRepairOperation(
    base.boundary,
    { dev: "1", ino: "2", birthtimeNs: "3" },
    base.ledger,
  );
  const original = persistRecord(
    base.boundary,
    created,
    "prepared",
    base.ledger,
  );
  assert.ok(original);
  const currentBoundary = {
    ...base.boundary,
    crddReleaseSequence: 2,
    crddManifestHash: "a".repeat(64),
    runtimeExecutionIdentitySha256: "c".repeat(64),
  };
  const originManifest = { fixture: "origin" };
  const adoptingManifest = { fixture: "adopting" };
  // Crypto is tested with real Ed25519 envelopes in trust-core tests. This
  // verifier seam limits the store tests to already-verified release tuples.
  const verifyHistory: DockerDesktopRepairHistoryVerifier = (value) => {
    const target =
      JSON.stringify(value) === JSON.stringify(originManifest)
        ? base.boundary
        : JSON.stringify(value) === JSON.stringify(adoptingManifest)
          ? currentBoundary
          : null;
    return (
      target && {
        manifestHash: target.crddManifestHash,
        releaseSequence: target.crddReleaseSequence,
        runtimeExecutionIdentitySha256: target.runtimeExecutionIdentitySha256,
        crddTree: "d".repeat(40),
        packageContentRootSha256: "e".repeat(64),
      }
    );
  };
  return {
    ...base,
    original,
    currentBoundary,
    originManifest,
    adoptingManifest,
    verifyHistory,
  };
}

function historyPreparationPath(
  operationDirectory: string,
  targetName: string,
) {
  return path.join(
    operationDirectory,
    `.crdd-history-${createHash("sha256").update(targetName).digest("hex")}.prepare`,
  );
}

function leaveHistoryPublicationState(
  operationDirectory: string,
  targetName: string,
  state: "prepare_only" | "published_residue" | "foreign_copy",
) {
  const target = path.join(operationDirectory, targetName);
  const preparation = historyPreparationPath(operationDirectory, targetName);
  if (state === "foreign_copy") fs.copyFileSync(target, preparation);
  else fs.linkSync(target, preparation);
  if (state === "prepare_only") fs.unlinkSync(target);
  return { target, preparation };
}

test("revision 4の終了前修復記録は署名済み旧releaseの履歴としてのみ再構成できる", (t) => {
  const base = fixture(t);
  const created = createDockerDesktopRepairOperation(
    base.boundary,
    { dev: "1", ino: "2", birthtimeNs: "3" },
    base.ledger,
  );
  const current = persistRecord(
    base.boundary,
    created,
    "prepared",
    base.ledger,
  );
  assert.ok(current);
  const recordPath = path.join(
    current.operationDirectory,
    "repair-00-prepared.json",
  );
  const parsed = JSON.parse(fs.readFileSync(recordPath, "utf8"));
  const { runtimeExecutionIdentitySha256: removedValue, ...legacy } = parsed;
  fs.writeFileSync(
    recordPath,
    `${JSON.stringify({
      ...legacy,
      contractRevision: 4,
      crddTree: "a".repeat(40),
      packageContentRootSha256: "b".repeat(64),
    })}\n`,
  );
  const nextBoundary = {
    ...base.boundary,
    crddManifestHash: "c".repeat(64),
    crddReleaseSequence: 2,
    runtimeExecutionIdentitySha256: "d".repeat(64),
  };
  const originManifest = { release: "v0.18.0" };
  const verifyHistory: DockerDesktopRepairHistoryVerifier = (value) =>
    value === originManifest
      ? {
          manifestHash: base.boundary.crddManifestHash,
          releaseSequence: base.boundary.crddReleaseSequence,
          runtimeExecutionIdentitySha256: null,
          crddTree: "a".repeat(40),
          packageContentRootSha256: "b".repeat(64),
        }
      : null;
  assert.equal(
    inventoryDockerDesktopRepairOperations(nextBoundary, verifyHistory).status,
    "unknown",
  );
  const inspected = inspectDockerDesktopRepairHistoricalOperation(
    nextBoundary,
    current.repairId,
    originManifest,
    verifyHistory,
  );
  assert.equal(inspected?.repairId, current.repairId);
  assert.equal(inspected?.stage, "prepared");
});

test("historical adoption keeps original bytes, ID and stage; ordinary current-version inventory stays strict", (t) => {
  const value = historyFixture(t);
  const originalPath = path.join(
    value.original.operationDirectory,
    "repair-00-prepared.json",
  );
  const before = fs.readFileSync(originalPath);
  assert.equal(
    inventoryDockerDesktopRepairOperations(value.currentBoundary).status,
    "unknown",
  );
  const inspected = inspectDockerDesktopRepairHistoricalOperation(
    value.currentBoundary,
    value.original.repairId,
    value.originManifest,
    value.verifyHistory,
  );
  assert.deepEqual(inspected, value.original);
  const adopted = persistDockerDesktopRepairHistoricalAdoption(
    value.currentBoundary,
    value.original,
    value.originManifest,
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(adopted?.history);
  assert.equal(adopted.repairId, value.original.repairId);
  assert.equal(adopted.stage, "prepared");
  assert.deepEqual(adopted.ledger, value.original.ledger);
  assert.equal(adopted.history.closed, false);
  assert.equal(
    classifyDockerDesktopRepairResume(adopted).state,
    "observe_current",
  );
  assert.equal(
    persistRecord(value.currentBoundary, adopted, "prepared", adopted.ledger),
    null,
  );
  assert.equal(fs.readFileSync(originalPath).equals(before), true);
  assert.deepEqual(
    persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      value.original,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    ),
    adopted,
  );
  const inventory = inventoryDockerDesktopRepairOperations(
    value.currentBoundary,
    value.verifyHistory,
  );
  assert.equal(inventory.status, "verified");
  assert.deepEqual(inventory.operations, [adopted]);
  // A production caller cannot select the fixture's signer via the receipt.
  assert.equal(
    inventoryDockerDesktopRepairOperations(value.currentBoundary).status,
    "unknown",
  );
});

for (const state of ["prepare_only", "published_residue"] as const) {
  test(`修復履歴adoptionは公開途中の${state}から同じID・byteへ再入場する`, (t) => {
    const value = historyFixture(t);
    const adopted = persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      value.original,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(adopted);
    const publication = leaveHistoryPublicationState(
      adopted.operationDirectory,
      "historical-adoption.json",
      state,
    );
    assert.equal(
      inventoryDockerDesktopRepairOperations(
        value.currentBoundary,
        value.verifyHistory,
      ).status,
      "unknown",
    );
    const resumed = persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      value.original,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(resumed?.history);
    assert.equal(resumed.repairId, value.original.repairId);
    assert.equal(fs.existsSync(publication.target), true);
    assert.equal(fs.existsSync(publication.preparation), false);
    assert.equal(
      inventoryDockerDesktopRepairOperations(
        value.currentBoundary,
        value.verifyHistory,
      ).status,
      "verified",
    );
  });
}

test("修復履歴adoptionはbyteが同じでも別fileのprepareを削除せず拒否する", (t) => {
  const value = historyFixture(t);
  const adopted = persistDockerDesktopRepairHistoricalAdoption(
    value.currentBoundary,
    value.original,
    value.originManifest,
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(adopted);
  const publication = leaveHistoryPublicationState(
    adopted.operationDirectory,
    "historical-adoption.json",
    "foreign_copy",
  );
  const beforeTarget = fs.readFileSync(publication.target);
  const beforePrepare = fs.readFileSync(publication.preparation);
  assert.equal(
    persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      value.original,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    ),
    null,
  );
  assert.equal(fs.readFileSync(publication.target).equals(beforeTarget), true);
  assert.equal(
    fs.readFileSync(publication.preparation).equals(beforePrepare),
    true,
  );
});

for (const mutation of ["partial", "directory", "unknown_name"] as const) {
  test(`修復履歴は不正prepareを変更せず拒否する: ${mutation}`, (t) => {
    const value = historyFixture(t);
    const adopted = persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      value.original,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(adopted);
    const preparation =
      mutation === "unknown_name"
        ? path.join(
            adopted.operationDirectory,
            `.crdd-history-${"f".repeat(64)}.prepare`,
          )
        : historyPreparationPath(
            adopted.operationDirectory,
            "historical-adoption.json",
          );
    if (mutation === "directory") fs.mkdirSync(preparation);
    else fs.writeFileSync(preparation, "{");
    assert.equal(
      persistDockerDesktopRepairHistoricalAdoption(
        value.currentBoundary,
        value.original,
        value.originManifest,
        value.adoptingManifest,
        value.verifyHistory,
      ),
      null,
    );
    assert.equal(fs.existsSync(preparation), true);
    assert.equal(
      inventoryDockerDesktopRepairOperations(
        value.currentBoundary,
        value.verifyHistory,
      ).status,
      "unknown",
    );
  });
}

test("historical inspection refuses every changed host/user/protection/policy binding and future releases", (t) => {
  const value = historyFixture(t);
  for (const field of [
    "runtimeStateIdentityHash",
    "runtimeStateProtectionHash",
    "localUserBindingHash",
    "runtimeStateBindingHash",
    "dockerPolicySha256",
  ] as const) {
    assert.equal(
      inspectDockerDesktopRepairHistoricalOperation(
        { ...value.currentBoundary, [field]: "f".repeat(64) },
        value.original.repairId,
        value.originManifest,
        value.verifyHistory,
      ),
      null,
      field,
    );
  }
  assert.equal(
    inspectDockerDesktopRepairHistoricalOperation(
      { ...value.currentBoundary, crddReleaseSequence: 0 },
      value.original.repairId,
      value.originManifest,
      value.verifyHistory,
    ),
    null,
  );
  assert.equal(
    inspectDockerDesktopRepairHistoricalOperation(
      { ...value.currentBoundary, crddReleaseSequence: 1 },
      value.original.repairId,
      value.originManifest,
      value.verifyHistory,
    ),
    null,
  );
  assert.equal(
    inspectDockerDesktopRepairHistoricalOperation(
      value.currentBoundary,
      "docker-desktop-repair.../other",
      value.originManifest,
      value.verifyHistory,
    ),
    null,
  );
  assert.equal(
    persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      value.original,
      value.originManifest,
      value.originManifest,
      value.verifyHistory,
    ),
    null,
  );
  assert.deepEqual(fs.readdirSync(value.original.operationDirectory).sort(), [
    "docker-config",
    "repair-00-prepared.json",
  ]);
});

for (const mutation of [
  "tip",
  "count",
  "origin",
  "adopting",
  "extra",
  "partial",
  "original-bytes",
  "extra-record",
] as const) {
  test(`historical receipt or chain mutation fails closed: ${mutation}`, (t) => {
    const value = historyFixture(t);
    const adopted = persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      value.original,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(adopted);
    const target = path.join(
      adopted.operationDirectory,
      "historical-adoption.json",
    );
    const receipt = JSON.parse(fs.readFileSync(target, "utf8"));
    if (mutation === "tip") receipt.originalTipSha256 = "0".repeat(64);
    if (mutation === "count") receipt.originalRecordCount += 1;
    if (mutation === "origin") receipt.originManifest = { fixture: "adopting" };
    if (mutation === "adopting")
      receipt.adoptingManifest = { fixture: "unknown" };
    if (mutation === "extra") receipt.extra = true;
    fs.writeFileSync(
      target,
      mutation === "partial" ? "{" : `${JSON.stringify(receipt)}\n`,
    );
    if (mutation === "original-bytes")
      fs.appendFileSync(
        path.join(adopted.operationDirectory, "repair-00-prepared.json"),
        "\n",
      );
    if (mutation === "extra-record")
      fs.writeFileSync(
        path.join(adopted.operationDirectory, "repair-01-prepared.json"),
        "{}\n",
      );
    assert.equal(
      inventoryDockerDesktopRepairOperations(
        value.currentBoundary,
        value.verifyHistory,
      ).status,
      "unknown",
    );
    assert.equal(
      persistDockerDesktopRepairHistoricalAdoption(
        value.currentBoundary,
        value.original,
        value.originManifest,
        value.adoptingManifest,
        value.verifyHistory,
      ),
      null,
    );
    assert.equal(fs.existsSync(target), true);
  });
}

test("historical closure is a separate exact receipt and never changes the original ledger", (t) => {
  const value = historyFixture(t);
  const adopted = persistDockerDesktopRepairHistoricalAdoption(
    value.currentBoundary,
    value.original,
    value.originManifest,
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(adopted);
  const observation = {
    liveRunIdentity: { dev: "9", ino: "8", birthtimeNs: "7" },
    staleState: "retained" as const,
  };
  const closed = persistDockerDesktopRepairHistoricalClosure(
    value.currentBoundary,
    adopted,
    observation,
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(closed?.history?.closed);
  assert.equal(closed.stage, value.original.stage);
  assert.deepEqual(closed.ledger, value.original.ledger);
  assert.equal(classifyDockerDesktopRepairResume(closed).state, "terminal");
  assert.deepEqual(
    persistDockerDesktopRepairHistoricalClosure(
      value.currentBoundary,
      adopted,
      observation,
      value.adoptingManifest,
      value.verifyHistory,
    ),
    closed,
  );
  assert.equal(
    persistDockerDesktopRepairHistoricalClosure(
      value.currentBoundary,
      adopted,
      { ...observation, staleState: "absent" },
      value.adoptingManifest,
      value.verifyHistory,
    ),
    null,
  );
  const closurePath = path.join(
    adopted.operationDirectory,
    "historical-closure.json",
  );
  const receipt = JSON.parse(fs.readFileSync(closurePath, "utf8"));
  receipt.adoptionSha256 = "0".repeat(64);
  fs.writeFileSync(closurePath, `${JSON.stringify(receipt)}\n`);
  assert.equal(
    inventoryDockerDesktopRepairOperations(
      value.currentBoundary,
      value.verifyHistory,
    ).status,
    "unknown",
  );
});

test("終了済み引継ぎ履歴は同一ユーザーの再ログオン後も読めるが旧操作を再開しない", (t) => {
  const value = historyFixture(t);
  const adopted = persistDockerDesktopRepairHistoricalAdoption(
    value.currentBoundary,
    value.original,
    value.originManifest,
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(adopted);
  const nextBoundary = {
    ...value.currentBoundary,
    localUserBindingHash: "d".repeat(64),
  };
  assert.equal(
    inventoryDockerDesktopRepairOperations(nextBoundary, value.verifyHistory)
      .status,
    "unknown",
  );
  const closed = persistDockerDesktopRepairHistoricalClosure(
    value.currentBoundary,
    adopted,
    {
      liveRunIdentity: { dev: "9", ino: "8", birthtimeNs: "7" },
      staleState: "retained",
    },
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(closed);
  const snapshot = () =>
    fs
      .readdirSync(closed.operationDirectory)
      .filter((name) => name.endsWith(".json"))
      .map((name) => [
        name,
        fs
          .readFileSync(path.join(closed.operationDirectory, name))
          .toString("hex"),
      ]);
  const beforeEntries = snapshot();
  const inventory = inventoryDockerDesktopRepairOperations(
    nextBoundary,
    value.verifyHistory,
  );
  assert.equal(inventory.status, "verified");
  assert.equal(inventory.operations[0]?.repairId, closed.repairId);
  assert.equal(inventory.operations[0]?.history?.closed, true);
  assert.equal(inventory.operations[0]?.history?.currentSessionBound, false);
  const completed = inventory.operations[0];
  assert.ok(completed);
  assert.deepEqual(classifyDockerDesktopRepairResume(completed), {
    state: "terminal",
    action: null,
    nextStage: null,
  });
  assert.equal(
    persistRecord(nextBoundary, closed, "prepared", closed.ledger),
    null,
  );
  for (const field of [
    "runtimeStateIdentityHash",
    "runtimeStateProtectionHash",
    "runtimeStateBindingHash",
    "dockerPolicySha256",
  ] as const) {
    assert.equal(
      inventoryDockerDesktopRepairOperations(
        { ...nextBoundary, [field]: "f".repeat(64) },
        value.verifyHistory,
      ).status,
      "unknown",
      field,
    );
  }
  assert.deepEqual(snapshot(), beforeEntries);
});

test("修復履歴のsession handoffは8件で閉じ、9件目を記録せず拒否する", (t) => {
  const value = historyFixture(t);
  let operation = persistDockerDesktopRepairHistoricalAdoption(
    value.currentBoundary,
    value.original,
    value.originManifest,
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(operation);
  const boundaries = Array.from({ length: 9 }, (_unused, index) => ({
    ...value.currentBoundary,
    localUserBindingHash: createHash("sha256")
      .update(`desktop-session-${index}`)
      .digest("hex"),
  }));
  for (const boundary of boundaries.slice(0, 8)) {
    operation = persistDockerDesktopRepairHistoricalAdoption(
      boundary,
      operation as DockerDesktopRepairOperation,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(operation);
  }
  const priorValues = fs.readdirSync(value.original.operationDirectory).sort();
  assert.equal(
    persistDockerDesktopRepairHistoricalAdoption(
      boundaries[8] ?? value.currentBoundary,
      operation as DockerDesktopRepairOperation,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    ),
    null,
  );
  assert.deepEqual(
    fs.readdirSync(value.original.operationDirectory).sort(),
    priorValues,
  );
  assert.equal(
    priorValues.filter((name) =>
      /^historical-handoff-[0-9]{2}\.json$/u.test(name),
    ).length,
    8,
  );
});

for (const targetKind of ["handoff", "closure"] as const) {
  for (const state of ["prepare_only", "published_residue"] as const) {
    test(`修復履歴${targetKind}は公開途中の${state}からexact receiptへ収束する`, (t) => {
      const value = historyFixture(t);
      const adopted = persistDockerDesktopRepairHistoricalAdoption(
        value.currentBoundary,
        value.original,
        value.originManifest,
        value.adoptingManifest,
        value.verifyHistory,
      );
      assert.ok(adopted);
      const nextBoundary = {
        ...value.currentBoundary,
        localUserBindingHash: "d".repeat(64),
      };
      const handed = persistDockerDesktopRepairHistoricalAdoption(
        nextBoundary,
        adopted,
        value.originManifest,
        value.adoptingManifest,
        value.verifyHistory,
      );
      assert.ok(handed);
      const observation = {
        liveRunIdentity: { dev: "9", ino: "8", birthtimeNs: "7" },
        staleState: "retained" as const,
      };
      const completed =
        targetKind === "closure"
          ? persistDockerDesktopRepairHistoricalClosure(
              nextBoundary,
              handed,
              observation,
              value.adoptingManifest,
              value.verifyHistory,
            )
          : handed;
      assert.ok(completed);
      const targetName =
        targetKind === "closure"
          ? "historical-closure.json"
          : "historical-handoff-00.json";
      const publication = leaveHistoryPublicationState(
        completed.operationDirectory,
        targetName,
        state,
      );
      assert.equal(
        inventoryDockerDesktopRepairOperations(
          nextBoundary,
          value.verifyHistory,
        ).status,
        "unknown",
      );
      const resumed =
        targetKind === "closure"
          ? persistDockerDesktopRepairHistoricalClosure(
              nextBoundary,
              handed,
              observation,
              value.adoptingManifest,
              value.verifyHistory,
            )
          : persistDockerDesktopRepairHistoricalAdoption(
              nextBoundary,
              adopted,
              value.originManifest,
              value.adoptingManifest,
              value.verifyHistory,
            );
      assert.ok(resumed);
      assert.equal(fs.existsSync(publication.target), true);
      assert.equal(fs.existsSync(publication.preparation), false);
      assert.equal(
        inventoryDockerDesktopRepairOperations(
          nextBoundary,
          value.verifyHistory,
        ).status,
        "verified",
      );
    });
  }
}

test("修復履歴の公開済みtargetと同一fileの準備残存は対象限定persistだけが収束する", (t) => {
  const value = historyFixture(t);
  const adopted = persistDockerDesktopRepairHistoricalAdoption(
    value.currentBoundary,
    value.original,
    value.originManifest,
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(adopted);
  const publication = leaveHistoryPublicationState(
    adopted.operationDirectory,
    "historical-adoption.json",
    "published_residue",
  );
  assert.equal(
    inventoryDockerDesktopRepairOperations(
      value.currentBoundary,
      value.verifyHistory,
    ).status,
    "unknown",
  );
  const resumed = persistDockerDesktopRepairHistoricalAdoption(
    value.currentBoundary,
    value.original,
    value.originManifest,
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(resumed);
  assert.equal(fs.existsSync(publication.preparation), false);
});

test("本番の回復可能な公開は実行時のfs差替えを注入面にせず固定依存で残存を収束する", (t) => {
  const value = historyFixture(t);
  const adopted = persistDockerDesktopRepairHistoricalAdoption(
    value.currentBoundary,
    value.original,
    value.originManifest,
    value.adoptingManifest,
    value.verifyHistory,
  );
  assert.ok(adopted);
  const publication = leaveHistoryPublicationState(
    adopted.operationDirectory,
    "historical-adoption.json",
    "published_residue",
  );
  const unlinkSync = fs.unlinkSync;
  let injectedCalls = 0;
  try {
    fs.unlinkSync = ((target: fs.PathLike) => {
      injectedCalls += 1;
      if (
        path.resolve(String(target)) === path.resolve(publication.preparation)
      )
        throw new Error("injected_history_prepare_unlink_failure");
      return unlinkSync(target);
    }) as typeof fs.unlinkSync;
    assert.ok(
      persistDockerDesktopRepairHistoricalAdoption(
        value.currentBoundary,
        value.original,
        value.originManifest,
        value.adoptingManifest,
        value.verifyHistory,
      ),
    );
    assert.equal(fs.existsSync(publication.target), true);
    assert.equal(fs.existsSync(publication.preparation), false);
    assert.equal(injectedCalls, 0);
  } finally {
    fs.unlinkSync = unlinkSync;
  }
});

for (const mutation of ["self", "cycle", "branch", "skip"] as const) {
  test(`修復履歴session handoffは${mutation}連鎖を拒否する`, (t) => {
    const value = historyFixture(t);
    const adopted = persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      value.original,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(adopted);
    const secondBoundary = {
      ...value.currentBoundary,
      localUserBindingHash: "d".repeat(64),
    };
    const first = persistDockerDesktopRepairHistoricalAdoption(
      secondBoundary,
      adopted,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(first);
    const thirdBoundary = {
      ...value.currentBoundary,
      localUserBindingHash: "e".repeat(64),
    };
    const second = persistDockerDesktopRepairHistoricalAdoption(
      thirdBoundary,
      first,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(second);
    const firstPath = path.join(
      second.operationDirectory,
      "historical-handoff-00.json",
    );
    const secondPath = path.join(
      second.operationDirectory,
      "historical-handoff-01.json",
    );
    if (mutation === "skip") {
      fs.renameSync(
        firstPath,
        path.join(second.operationDirectory, "historical-handoff-02.json"),
      );
    } else {
      const receipt = JSON.parse(
        fs.readFileSync(mutation === "self" ? firstPath : secondPath, "utf8"),
      );
      if (mutation === "self")
        receipt.toLocalUserBindingHash = receipt.fromLocalUserBindingHash;
      if (mutation === "cycle")
        receipt.toLocalUserBindingHash =
          value.currentBoundary.localUserBindingHash;
      if (mutation === "branch") receipt.previousHandoffSha256 = "f".repeat(64);
      fs.writeFileSync(
        mutation === "self" ? firstPath : secondPath,
        `${JSON.stringify(receipt)}\n`,
      );
    }
    assert.equal(
      inventoryDockerDesktopRepairOperations(thirdBoundary, value.verifyHistory)
        .status,
      "unknown",
    );
  });
}

for (const mutation of [
  "handoff_downgrade",
  "handoff_same_sequence_different_release",
  "closure_downgrade",
] as const) {
  test(`修復履歴はRelease単調性違反を拒否する: ${mutation}`, (t) => {
    const value = historyFixture(t);
    const release3Manifest = { fixture: "release-3" };
    const release3OtherManifest = { fixture: "release-3-other" };
    const release4Manifest = { fixture: "release-4" };
    const releases = new Map<
      string,
      ReturnType<DockerDesktopRepairHistoryVerifier>
    >([
      [
        JSON.stringify(value.originManifest),
        value.verifyHistory(value.originManifest),
      ],
      [
        JSON.stringify(value.adoptingManifest),
        value.verifyHistory(value.adoptingManifest),
      ],
      [
        JSON.stringify(release3Manifest),
        {
          manifestHash: "3".repeat(64),
          releaseSequence: 3,
          runtimeExecutionIdentitySha256: "b".repeat(64),
          crddTree: "3".repeat(40),
          packageContentRootSha256: "3".repeat(64),
        },
      ],
      [
        JSON.stringify(release3OtherManifest),
        {
          manifestHash: "7".repeat(64),
          releaseSequence: 3,
          runtimeExecutionIdentitySha256: "7".repeat(64),
          crddTree: "7".repeat(40),
          packageContentRootSha256: "7".repeat(64),
        },
      ],
      [
        JSON.stringify(release4Manifest),
        {
          manifestHash: "4".repeat(64),
          releaseSequence: 4,
          runtimeExecutionIdentitySha256: "9".repeat(64),
          crddTree: "4".repeat(40),
          packageContentRootSha256: "4".repeat(64),
        },
      ],
    ]);
    const verifyHistory: DockerDesktopRepairHistoryVerifier = (manifest) =>
      releases.get(JSON.stringify(manifest)) ?? null;
    const adopted = persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      value.original,
      value.originManifest,
      value.adoptingManifest,
      verifyHistory,
    );
    assert.ok(adopted);
    const release3Boundary = {
      ...value.currentBoundary,
      crddManifestHash: "3".repeat(64),
      crddReleaseSequence: 3,
      runtimeExecutionIdentitySha256: "b".repeat(64),
      localUserBindingHash: "d".repeat(64),
    };
    const first = persistDockerDesktopRepairHistoricalAdoption(
      release3Boundary,
      adopted,
      value.originManifest,
      release3Manifest,
      verifyHistory,
    );
    assert.ok(first);
    const release4Boundary = {
      ...release3Boundary,
      crddManifestHash: "4".repeat(64),
      crddReleaseSequence: 4,
      runtimeExecutionIdentitySha256: "9".repeat(64),
      localUserBindingHash: "e".repeat(64),
    };
    const second = persistDockerDesktopRepairHistoricalAdoption(
      release4Boundary,
      first,
      value.originManifest,
      release4Manifest,
      verifyHistory,
    );
    assert.ok(second);
    if (mutation === "closure_downgrade") {
      const closed = persistDockerDesktopRepairHistoricalClosure(
        release4Boundary,
        second,
        {
          liveRunIdentity: { dev: "9", ino: "8", birthtimeNs: "7" },
          staleState: "retained",
        },
        release4Manifest,
        verifyHistory,
      );
      assert.ok(closed);
      const closurePath = path.join(
        closed.operationDirectory,
        "historical-closure.json",
      );
      const receipt = JSON.parse(fs.readFileSync(closurePath, "utf8"));
      receipt.closingManifest = value.adoptingManifest;
      fs.writeFileSync(closurePath, `${JSON.stringify(receipt)}\n`);
    } else {
      const handoffPath = path.join(
        second.operationDirectory,
        "historical-handoff-01.json",
      );
      const receipt = JSON.parse(fs.readFileSync(handoffPath, "utf8"));
      receipt.adoptingManifest =
        mutation === "handoff_downgrade"
          ? value.adoptingManifest
          : release3OtherManifest;
      fs.writeFileSync(handoffPath, `${JSON.stringify(receipt)}\n`);
    }
    assert.equal(
      inventoryDockerDesktopRepairOperations(release4Boundary, verifyHistory)
        .status,
      "unknown",
    );
  });
}

for (const mutation of [
  "missing",
  "partial",
  "extra",
  "repair-id",
  "adoption-hash",
  "signature",
  "release-order",
  "first-login-invalid",
  "later-login-different",
  "mixed-pending",
] as const) {
  test(`再ログオン後の終了履歴読取りは不正・未終了状態を拒否する: ${mutation}`, (t) => {
    const value = historyFixture(t);
    const original = persistHostEffect(
      value.boundary,
      value.original,
      "process",
      "official_shutdown",
      { issued: true, confirmation: "confirmed" },
    );
    if (mutation === "mixed-pending") {
      const pending = createDockerDesktopRepairOperation(
        value.boundary,
        { dev: "4", ino: "5", birthtimeNs: "6" },
        value.ledger,
      );
      assert.ok(
        persistRecord(value.boundary, pending, "prepared", value.ledger),
      );
    }
    const adopted = persistDockerDesktopRepairHistoricalAdoption(
      value.currentBoundary,
      original,
      value.originManifest,
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(adopted);
    const closed = persistDockerDesktopRepairHistoricalClosure(
      value.currentBoundary,
      adopted,
      {
        liveRunIdentity: { dev: "9", ino: "8", birthtimeNs: "7" },
        staleState: "retained",
      },
      value.adoptingManifest,
      value.verifyHistory,
    );
    assert.ok(closed);
    const closurePath = path.join(
      closed.operationDirectory,
      "historical-closure.json",
    );
    const receipt = JSON.parse(fs.readFileSync(closurePath, "utf8"));
    if (mutation === "extra") receipt.extra = true;
    if (mutation === "repair-id")
      receipt.repairId = `docker-desktop-repair.${"f".repeat(32)}`;
    if (mutation === "adoption-hash") receipt.adoptionSha256 = "f".repeat(64);
    if (mutation === "signature")
      receipt.closingManifest = { fixture: "unknown" };
    if (mutation === "release-order")
      receipt.closingManifest = value.originManifest;
    fs.writeFileSync(
      closurePath,
      mutation === "partial" ? "{" : `${JSON.stringify(receipt)}\n`,
    );
    if (mutation === "missing") fs.unlinkSync(closurePath);
    if (
      mutation === "first-login-invalid" ||
      mutation === "later-login-different"
    ) {
      const recordPath = path.join(
        closed.operationDirectory,
        mutation === "first-login-invalid"
          ? "repair-00-prepared.json"
          : "repair-02-prepared.json",
      );
      const record = JSON.parse(fs.readFileSync(recordPath, "utf8"));
      record.localUserBindingHash =
        mutation === "first-login-invalid" ? "invalid" : "d".repeat(64);
      fs.writeFileSync(recordPath, `${JSON.stringify(record)}\n`);
      // Keep the chain and both receipt anchors valid: only the login differs.
      let tip = "0".repeat(64);
      const recordNames = fs
        .readdirSync(closed.operationDirectory)
        .filter((name) => /^repair-\d\d-/u.test(name))
        .sort();
      for (const name of recordNames) {
        const target = path.join(closed.operationDirectory, name);
        const entry = JSON.parse(fs.readFileSync(target, "utf8"));
        entry.previousRecordSha256 = tip;
        const bytes = Buffer.from(`${JSON.stringify(entry)}\n`);
        fs.writeFileSync(target, bytes);
        tip = createHash("sha256").update(bytes).digest("hex");
      }
      const adoptionPath = path.join(
        closed.operationDirectory,
        "historical-adoption.json",
      );
      const adoptionReceipt = JSON.parse(fs.readFileSync(adoptionPath, "utf8"));
      adoptionReceipt.originalTipSha256 = tip;
      const adoptionBytes = Buffer.from(`${JSON.stringify(adoptionReceipt)}\n`);
      fs.writeFileSync(adoptionPath, adoptionBytes);
      receipt.adoptionSha256 = createHash("sha256")
        .update(adoptionBytes)
        .digest("hex");
      fs.writeFileSync(closurePath, `${JSON.stringify(receipt)}\n`);
    }
    const inventory = inventoryDockerDesktopRepairOperations(
      { ...value.currentBoundary, localUserBindingHash: "d".repeat(64) },
      value.verifyHistory,
    );
    assert.equal(inventory.status, "unknown");
    assert.deepEqual(inventory.operations, []);
  });
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
    issued: boolean | null;
    confirmation: "confirmed" | "not_issued" | "unknown";
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
  const nextBoundary = { ...boundary, localUserBindingHash: "d".repeat(64) };
  const nextInventory = inventoryDockerDesktopRepairOperations(nextBoundary);
  assert.equal(nextInventory.status, "verified");
  assert.deepEqual(nextInventory.operations, inventory.operations);
  assert.equal(classifyDockerDesktopRepairResume(closed).state, "terminal");
  assert.equal(
    persistRecord(nextBoundary, closed, "prepared", closed.ledger),
    null,
  );
  const laterReleaseBoundary = {
    ...nextBoundary,
    crddManifestHash: "e".repeat(64),
    crddReleaseSequence: 2,
    runtimeExecutionIdentitySha256: "f".repeat(64),
  };
  const originManifest = { release: "origin" };
  const adoptingManifest = { release: "current" };
  const verifyHistory: DockerDesktopRepairHistoryVerifier = (value) => {
    const selected =
      JSON.stringify(value) === JSON.stringify(originManifest)
        ? boundary
        : JSON.stringify(value) === JSON.stringify(adoptingManifest)
          ? laterReleaseBoundary
          : null;
    return selected
      ? {
          manifestHash: selected.crddManifestHash,
          releaseSequence: selected.crddReleaseSequence,
          runtimeExecutionIdentitySha256:
            selected.runtimeExecutionIdentitySha256,
          crddTree: "a".repeat(40),
          packageContentRootSha256: "b".repeat(64),
        }
      : null;
  };
  const historical = inspectDockerDesktopRepairHistoricalOperation(
    laterReleaseBoundary,
    closed.repairId,
    originManifest,
    verifyHistory,
  );
  assert.equal(historical?.stage, "closed_retained");
  const adoptedAfterRelogin = persistDockerDesktopRepairHistoricalAdoption(
    laterReleaseBoundary,
    historical as DockerDesktopRepairOperation,
    originManifest,
    adoptingManifest,
    verifyHistory,
  );
  assert.equal(
    adoptedAfterRelogin?.history?.currentSessionBound,
    true,
    JSON.stringify(
      fs
        .readdirSync(closed.operationDirectory)
        .map((name) => [
          name,
          fs.statSync(path.join(closed.operationDirectory, name)).isFile()
            ? fs.readFileSync(
                path.join(closed.operationDirectory, name),
                "utf8",
              )
            : "directory",
        ]),
    ),
  );
  assert.equal(adoptedAfterRelogin?.history?.closed, false);
  const historicallyClosed = persistDockerDesktopRepairHistoricalClosure(
    laterReleaseBoundary,
    adoptedAfterRelogin as DockerDesktopRepairOperation,
    {
      liveRunIdentity: closed.ledger.liveRunIdentity as NonNullable<
        DockerDesktopRepairLedgerSnapshot["liveRunIdentity"]
      >,
      staleState: "retained",
    },
    adoptingManifest,
    verifyHistory,
  );
  assert.equal(historicallyClosed?.history?.closed, true);
  assert.equal(
    inventoryDockerDesktopRepairOperations(laterReleaseBoundary, verifyHistory)
      .status,
    "verified",
  );
  assert.equal(
    inventoryDockerDesktopRepairOperations(boundary).status,
    "unknown",
  );
  assert.equal(
    inventoryDockerDesktopRepairOperations(nextBoundary).status,
    "unknown",
  );
  assert.equal(
    inventoryDockerDesktopRepairOperations(laterReleaseBoundary, verifyHistory)
      .status,
    "verified",
  );
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
  const contract = describeDockerDesktopRepairRecordStoreContract();
  assert.equal(contract.normalPathRecordCount, 15);
  assert.equal(contract.recordLimit, 24);
  assert.equal(contract.recordLimitKind, "defensive_hard_cap");
  assert.equal(contract.recoveryMarginIsSemanticReachabilityClaim, false);
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

test("unknown Host Effectはknown recovery stageへ昇格せずhistorical stageだけへ閉じる", async (t) => {
  for (const unknownAction of [
    "official_shutdown",
    "native_termination",
    "wsl_termination",
  ] as const) {
    await t.test(unknownAction, (caseContext) => {
      const { boundary, ledger } = fixture(caseContext);
      const created = createDockerDesktopRepairOperation(
        boundary,
        Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" }),
        ledger,
      );
      let current = persistRecord(boundary, created, "prepared", ledger);
      assert.ok(current);
      const ordered = [
        "official_shutdown",
        "native_termination",
        "wsl_termination",
      ] as const;
      for (const action of ordered) {
        current = persistHostEffect(
          boundary,
          current,
          "process",
          action,
          action === unknownAction
            ? { issued: true, confirmation: "unknown" }
            : { issued: true, confirmation: "confirmed" },
        );
        if (action === unknownAction) break;
      }
      const observationLedger = Object.freeze({
        ...current.ledger,
        processEffects: Object.freeze([
          ...current.ledger.processEffects,
          Object.freeze({
            sequence: current.ledger.processEffects.length,
            action: "observed_desktop_recovery" as const,
            phase: "settled" as const,
            issued: false,
            confirmation: "not_issued" as const,
          }),
        ]),
      });
      const observed = persistRecord(
        boundary,
        current,
        "prepared",
        observationLedger,
      );
      assert.ok(observed);
      const knownLedger = Object.freeze({
        ...observed.ledger,
        engineReady: true,
        staleState: "absent" as const,
        hostSafety: "safe" as const,
        evidenceState: "preserved" as const,
        disposition: "known_effect_recovery_pending_human_decision" as const,
        liveRunIdentity: observed.runIdentity,
      });
      assert.equal(
        persistRecord(
          boundary,
          observed,
          "no_stale_known_effect_recovery_pending",
          knownLedger,
        ),
        null,
      );
      const historicalLedger = Object.freeze({
        ...knownLedger,
        disposition:
          "historical_effect_unknown_pending_human_decision" as const,
      });
      const pending = persistRecord(
        boundary,
        observed,
        "no_stale_historical_effect_unknown_pending",
        historicalLedger,
      );
      assert.ok(pending);
      const nextBoundary = {
        ...boundary,
        localUserBindingHash: "d".repeat(64),
      };
      assert.equal(
        inventoryDockerDesktopRepairOperations(nextBoundary).status,
        "unknown",
      );
      const closed = persistRecord(
        boundary,
        pending,
        "closed_historical_effect_unknown_retained",
        {
          ...pending.ledger,
          disposition: "historical_effect_unknown_retained_by_human_decision",
        },
      );
      assert.ok(closed);
      const recordPaths = fs
        .readdirSync(closed.operationDirectory)
        .filter((name) => name.endsWith(".json"));
      const snapshot = () =>
        recordPaths.map((name) =>
          fs
            .readFileSync(path.join(closed.operationDirectory, name))
            .toString("hex"),
        );
      const beforeEntries = snapshot();
      assert.deepEqual(
        inventoryDockerDesktopRepairOperations(nextBoundary).operations,
        [closed],
      );
      assert.deepEqual(classifyDockerDesktopRepairResume(closed), {
        state: "terminal",
        action: null,
        nextStage: null,
      });
      assert.equal(closed.ledger.processEffectConfirmation, "unknown");
      assert.equal(
        persistRecord(nextBoundary, closed, "prepared", closed.ledger),
        null,
      );
      assert.deepEqual(snapshot(), beforeEntries);
    });
  }
});

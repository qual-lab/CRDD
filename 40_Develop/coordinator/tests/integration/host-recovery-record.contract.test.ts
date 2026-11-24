/**
 * Host作成・Receipt・回復をEM正本と実Filesystemで確認する。
 * @packageDocumentation
 * @responsibility 作成前記録、固定参照、実体照合、保存不明と回収再入場を検証する。
 * @trace ERB-IT-003
 * @trace PRL-IT-013
 * @trace RFD-IT-013
 * @level IT
 * @scope 自己生成Repository-local領域と検証子Process。実AI・Dockerは使用しない。
 * @boundary Coordinator Host Lifecycle→EM Writer・共通Lock・Node Filesystem。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createRepositoryTestDirectory } from "../../../execution-model/tests/support/repository-test-directory.ts";

const modules = {
  operation: new URL("../../src/lifecycle/host.ts", import.meta.url).href,
  model: new URL("../../../execution-model/src/index.ts", import.meta.url).href,
  recoveryRepository: new URL(
    "../support/recovery-repository.ts",
    import.meta.url,
  ).href,
  repository: new URL("../../../version-control/src/index.ts", import.meta.url)
    .href,
  fixture: new URL(
    "../../../execution-model/tests/support/resource-operation.ts",
    import.meta.url,
  ).href,
  assertions: new URL("../support/contract-assertions.ts", import.meta.url)
    .href,
};
// 不変のSourceだけを一回準備する。各ケースはProcess・Map・Owner・保存先を共有しない。
const worker = `
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { mock } from "node:test";
import { syncBuiltinESMExports } from "node:module";
import childProcess, { execFileSync } from "node:child_process";
import * as operation from ${JSON.stringify(modules.operation)};
import { readState, applyResourceEvent, applyResourceCleanup, saveOperationCheckpoint, saveOperationStart, saveRecoveryCheckpoint } from ${JSON.stringify(modules.model)};
import { prepareFixtureRecovery } from ${JSON.stringify(modules.recoveryRepository)};
import { restartRequestIdFixture } from ${JSON.stringify(modules.assertions)};
import { getRepository, resolveVerifiedRepositoryRoot, readRepositorySnapshot, createWorktree } from ${JSON.stringify(modules.repository)};
import { createResourceOperationFixture, createResourceBookFixture } from ${JSON.stringify(modules.fixture)};
const root = process.argv[2], scenario = process.argv[3];
const git = (at, ...args) => execFileSync("git", ["-C", at, "-c", "user.name=CRDD Test", "-c", "user.email=test@example.invalid", "-c", "commit.gpgsign=false", ...args], {encoding: "utf8", windowsHide: true});
const gitStarts = {};
const measureGit = (phase, invoke) => {
  gitStarts[phase] = 0;
  const spawn = childProcess.spawnSync;
  const counter = mock.method(childProcess, "spawnSync", (command, ...args) => {
    if (["git", "git.exe"].includes(path.basename(String(command)).toLowerCase())) gitStarts[phase]++;
    return spawn(command, ...args);
  });
  syncBuiltinESMExports();
  try { return invoke(); }
  finally { counter.mock.restore(); syncBuiltinESMExports(); }
};
if (scenario.startsWith("git_")) {
  git(root, "init", "--quiet");
  git(root, "config", "user.name", "CRDD Test");
  git(root, "config", "user.email", "test@example.invalid");
  git(root, "config", "core.autocrlf", "false");
  fs.mkdirSync(path.join(root, "src"));
  fs.writeFileSync(path.join(root, "src", "a.txt"), "head");
  fs.writeFileSync(path.join(root, "src", "gone.txt"), "deleted");
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\\nignored.txt\\n");
  git(root, "add", "."); git(root, "commit", "--quiet", "-m", "seed");
  if (scenario === "git_merge_conflict") {
    const original = git(root, "branch", "--show-current").trim();
    git(root, "switch", "-c", "fixture-incoming");
    fs.writeFileSync(path.join(root, "src", "a.txt"), "incoming");
    git(root, "commit", "-am", "incoming");
    git(root, "switch", original);
  }
} else if (scenario !== "crash_reentry") {
fs.mkdirSync(path.join(root, ".git", "refs", "heads"), { recursive: true });
fs.mkdirSync(path.join(root, ".git", "info"));
fs.writeFileSync(path.join(root, ".git", "info", "exclude"), ".crdd/\\n");
fs.writeFileSync(path.join(root, ".git", "config"), "[core]\\nrepositoryformatversion = 0\\nbare = false\\n");
fs.writeFileSync(path.join(root, ".git", "HEAD"), "ref: refs/heads/main\\n");
fs.writeFileSync(path.join(root, ".git", "refs", "heads", "main"), "1".repeat(40)+"\\n");
}
const located = getRepository(root);
assert.equal(located.status, "completed");
const repository = located.capability;
let current = true;
const input = { root: repository, purpose: scenario === "probe" ? "isolation_probe" : "task",
  recordingCurrent: () => current && resolveVerifiedRepositoryRoot(repository) === root };
const stateFile = path.join(root, ".crdd", "execution-model", "state.json");
const read = () => {
  const value = readState(prepareFixtureRecovery(repository), { scope: "recovery" });
  assert.equal(value.status, "completed", JSON.stringify(value));
  assert.equal(value.lockReleased, true);
  return value.value;
};
const host = () => {
  const values = read().snapshot.operations.filter(item => item.kind === "host_operation");
  assert.equal(values.length, 1);
  return values[0];
};
const mkdir = fs.mkdirSync.bind(fs), rename = fs.renameSync.bind(fs);
const open = fs.openSync.bind(fs), readFile = fs.readFileSync.bind(fs);
let faultObserved = false;
if (scenario === "crash_after_root") {
  mock.method(fs, "mkdirSync", (candidate, ...args) => {
    const result = mkdir(candidate, ...args);
    if (/^OP-[0-9]+$/.test(path.basename(String(candidate)))) {
      process.stdout.write(JSON.stringify({ scenario, recoveryId: host().recoveryId })); process.exit(73);
    }
    return result;
  });
} else if (scenario === "crash_after_child_receipt") {
  mock.method(fs, "renameSync", (source, destination) => {
    const candidate = String(destination) === stateFile ? JSON.parse(readFile(source, "utf8")) : null;
    const record = candidate?.operations.find(item => item.kind === "host_operation");
    const result = rename(source, destination);
    if (record && Object.keys(record.childIdentities).length === 1) {
      process.stdout.write(JSON.stringify({ scenario, recoveryId: record.recoveryId })); process.exit(73);
    }
    return result;
  });
}
syncBuiltinESMExports();
if (scenario === "crash_reentry") {
  const record = JSON.parse(readFile(stateFile, "utf8")).operations.find(item => item.kind === "host_operation");
  assert.ok(record);
  assert.match(record.recoveryId, /^host-operation\\.OP-[0-9]{6,}$/);
  assert.equal(record.phase, "preparing");
  const currentState = readState(prepareFixtureRecovery(repository), { scope: "recovery" });
  if (currentState.status === "completed") {
    assert.equal(currentState.lockReleased, true);
    assert.equal(currentState.value.snapshot.operations.find(item => item.kind === "host_operation").recoveryId, record.recoveryId);
  } else {
    assert.equal(currentState.reason, "coordinator_state_lock_unavailable");
    assert.equal(currentState.lockReleased, false);
  }
  assert.equal(operation.acquireHostOperationRecoveryGeneration(repository, record.recoveryId, input.recordingCurrent), null);
  assert.equal(fs.existsSync(path.join(root, ".crdd", "coordinator", record.operationId)), true);
} else if (scenario === "current_rejected" || scenario === "foreign_repository_input") {
  if (scenario === "current_rejected") current = false;
  assert.throws(() => operation.createOwnedOperationDirectories(scenario === "foreign_repository_input" ? { ...input, root: path.dirname(root) } : input));
  assert.equal(fs.existsSync(path.join(root, ".crdd")), false);
} else if (scenario === "abort_before_root") {
  const controller = new AbortController(); controller.abort();
  assert.throws(() => operation.createOwnedOperationDirectories({ ...input, signal: controller.signal }));
  assert.equal(host().cleanup, "confirmed");
  assert.equal(fs.existsSync(path.join(root, ".crdd", "coordinator", host().operationId)), false);
} else if (["root_receipt_failure", "child_receipt_failure", "checkpoint_rename_failure", "creation_mkdir_failure"].includes(scenario)) {
  if (scenario === "creation_mkdir_failure") {
    mock.method(fs, "mkdirSync", (candidate, ...args) => {
      if (!faultObserved && /^OP-[0-9]+$/.test(path.basename(String(candidate)))) {
        faultObserved = true; throw Object.assign(Error("synthetic mkdir failure"), { code: "EACCES" });
      }
      return mkdir(candidate, ...args);
    });
  } else {
    mock.method(fs, "renameSync", (source, destination) => {
      if (String(destination) === stateFile) {
        const candidate = JSON.parse(readFile(source, "utf8"));
        const record = candidate.operations.find(item => item.kind === "host_operation");
        const selected = record?.rootIdentity && (scenario === "child_receipt_failure"
          ? Object.keys(record.childIdentities).length === 1
          : Object.keys(record.childIdentities).length === 0);
        if (!faultObserved && selected) {
          faultObserved = true;
          if (scenario === "checkpoint_rename_failure") rename(source, destination);
          throw Object.assign(Error("synthetic publish failure"), { code: "EIO" });
        }
      }
      return rename(source, destination);
    });
  }
  syncBuiltinESMExports();
  let failure;
  try { operation.createOwnedOperationDirectories(input); } catch (error) { failure = error; }
  assert.ok(failure);
  assert.equal(faultObserved, true);
  const classified = operation.classifyOwnedOperationDirectoryCreationFailure(failure);
  assert.ok(classified);
  if (scenario !== "creation_mkdir_failure") {
    assert.match(classified.hostRecoveryId, /^host-operation\\.OP-[0-9]{6,}$/);
    assert.equal(classified.cleanupConfirmed, false);
    const durable = JSON.parse(readFile(stateFile, "utf8")).operations.find(item => item.kind === "host_operation");
    assert.ok(durable);
    assert.equal(classified.hostRecoveryId, durable.recoveryId);
    assert.equal(fs.existsSync(path.join(root, ".crdd", "coordinator", durable.operationId)), true);
  } else {
    assert.equal(classified.cleanupConfirmed, true);
    assert.equal(classified.hostRecoveryId, null);
    assert.equal(host().cleanup, "confirmed");
  }
  mock.restoreAll(); syncBuiltinESMExports();
} else {
  const owned = operation.createOwnedOperationDirectories(input);
  const mount = operation.createOwnedMountCapability(owned);
  const context = operation.createOwnedOperationContextCapability(owned);
  const management = operation.createOwnedOperationManagementCapability(context, mount);
  const recoveryId = operation.getOwnedHostRecoveryId(owned);
  assert.equal(recoveryId, host().recoveryId);
  assert.equal(owned.root, path.join(root, ".crdd", "coordinator", host().operationId));
  assert.equal(Object.keys(host().childIdentities).length, 6);
  assert.equal(host().phase, "active");
  assert.equal(fs.existsSync(path.join(owned.root, ".coordinator-owned")), false);
  assert.equal("hostPaths" in host(), false);
  if (scenario === "git_unsettled_task" || scenario === "git_unsettled_restart") {
    const bound = operation.bindRepositoryOperation(management, root);
    assert.ok(bound);
    const identity = { ...createResourceOperationFixture().identity,
      operationId: host().operationId, repositoryBinding: read().snapshot.repositoryBinding };
    const started = saveOperationStart(operation.operationStartInput(management, () => null), JSON.stringify(identity) + "\\n");
    assert.equal(started.startSaved, true, JSON.stringify(started));
    if (scenario === "git_unsettled_restart") {
      const frame = createResourceBookFixture(identity.ownershipLabel, "planned", ["create_provider"]);
      const record = request => { const result = saveOperationCheckpoint(operation.operationStateInput(management), started.recoveryId, request); assert.equal(result.snapshotConfirmed && result.lockReleased, true, JSON.stringify(result)); };
      record({kind: "resource", value: {event: "submission", key: "create_provider", snapshot: frame.snapshot, cleanup: frame.cleanup}});
      const notIssued = saveRecoveryCheckpoint(operation.operationStateInput(management), started.recoveryId, null, {
        kind: "resource_not_issued", purpose: "create_provider"
      });
      assert.equal(notIssued.snapshotConfirmed && notIssued.lockReleased, true, JSON.stringify(notIssued));
      const original = read().snapshot.operations.find(item => item.kind === "docker_task");
      record({kind: "lifecycle", value: {phase: "settling", lease: "released", execution: {...original.execution, ownerEffect: "disabled"}, primaryFailure: null, outcome: null, summarySha256: null}});
      const requestId = restartRequestIdFixture(identity.repositoryBinding, original.identitySha256, started.recoveryId, "f".repeat(64));
      assert.ok(requestId);
      const checkpoint = {requestId, scopeSha256: "f".repeat(64), request: "not_issued", cleanup: "not_required", result: null};
      record({kind: "restart", value: checkpoint});
      record({kind: "restart", value: {...checkpoint, request: "unknown", cleanup: "pending"}});
      const state = read().operationStates.find(item => item.kind === "docker_task");
      assert.equal(state.resourcesSettled, true); assert.equal(state.restartSettled, false);
    }
    assert.throws(() => operation.cleanupOwnedOperationDirectories(owned));
    assert.equal(fs.existsSync(owned.root), true);
    assert.equal(host().cleanup, "not_requested");
    const task = read().snapshot.operations.find(item => item.kind === "docker_task");
    assert.equal(task.lease, scenario === "git_unsettled_restart" ? "released" : "held"); assert.equal(task.execution.ownerEffect, scenario === "git_unsettled_restart" ? "disabled" : "active");
    process.stdout.write(JSON.stringify({scenario, complete: true})); process.exit(0);
  }
  if (scenario.startsWith("git_")) {
    let executionTree = root;
    let head = readRepositorySnapshot(repository).revisionIdentity;
    if (scenario === "git_reference_conflict") {
      const initial = host();
      const name = "refs/heads/crdd/operation/" + initial.operationId + "/baseline";
      const write = (item) => {
        const observed = read();
        const result = saveOperationCheckpoint(
          {root: {directory: root}, revalidate: () => true}, recoveryId,
          { kind: "host_operation", value: {
            operation: {...initial, git: [item]},
            expectedVersion: {revision: observed.snapshot.revision, payloadSha256: observed.payloadSha256},
          } },
        );
        assert.equal(result.snapshotConfirmed && result.lockReleased, true, JSON.stringify(result));
      };
      const planned = {name, commitId: null, temporary: null, request: "not_issued", cleanup: "pending"};
      write(planned);
      write({...planned, commitId: head, request: "unknown"});
      write({...planned, commitId: head, request: "confirmed"});
      const foreign = git(root, "commit-tree", "HEAD^{tree}", "-p", head, "-m", "foreign-ref").trim();
      git(root, "update-ref", name, foreign);
      assert.equal(await operation.abandonOwnedHostOperationGenerationLock(management), true);
      let generation = operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent);
      assert.ok(generation);
      assert.equal(operation.recoverOwnedOperationDirectories(recoveryId, generation).status, "blocked");
      assert.equal(git(root, "rev-parse", name).trim(), foreign);
      assert.equal(operation.releaseHostOperationRecoveryGeneration(generation), true);
      git(root, "update-ref", name, head, foreign);
      generation = operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent);
      assert.ok(generation);
      assert.equal(operation.recoverOwnedOperationDirectories(recoveryId, generation).status, "recovered");
      assert.equal(operation.releaseHostOperationRecoveryGeneration(generation), true);
      assert.equal(git(root, "for-each-ref", "--format=%(refname)", name).trim(), "");
      process.stdout.write(JSON.stringify({scenario, complete: true})); process.exit(0);
    }
    const linked = scenario === "git_linked" || scenario === "git_merge_conflict";
    if (linked) {
      fs.mkdirSync(path.join(root, ".crdd", "tests"), {recursive: true});
      const created = createWorktree(repository, {relativePath: ".crdd/tests/linked", branch: "fixture-linked", baseCommit: head});
      assert.equal(created.status, "completed", JSON.stringify(created));
      executionTree = path.join(root, ".crdd", "tests", "linked");
    }
    if (scenario === "git_merge_conflict") {
      fs.writeFileSync(path.join(executionTree, "src", "a.txt"), "local");
      git(executionTree, "commit", "-am", "local");
      head = git(executionTree, "rev-parse", "HEAD").trim();
      assert.throws(() => git(executionTree, "merge", "fixture-incoming"), {status: 1});
      assert.match(git(executionTree, "status", "--porcelain"), /^UU /m);
    }
    const mergeHead = scenario === "git_merge_conflict"
      ? git(executionTree, "rev-parse", "MERGE_HEAD").trim()
      : null;
    fs.writeFileSync(path.join(executionTree, "src", "a.txt"), "start-dirty");
    fs.writeFileSync(path.join(executionTree, "src", "untracked.txt"), "start-untracked");
    fs.writeFileSync(path.join(executionTree, "src", "untracked-gone.txt"), "start-untracked");
    fs.writeFileSync(path.join(executionTree, "ignored.txt"), "ignored");
    const indexBefore = git(executionTree, "ls-files", "--stage");
    const objectsBefore = git(root, "count-objects", "-v");
    const bound = operation.bindRepositoryOperation(management, root);
    assert.ok(bound);
    const start = measureGit("admission", () => operation.bindExecutionWorkspace(bound.repositoryBindingCapability, management, mount, ["src/"], {workspaceId: linked ? "fixture" : null, ownerRepositoryRoot: root, executionTree, baseCommit: head, head}));
    assert.equal(start?.status, "materialized");
    assert.equal(gitStarts.admission, 0);
    fs.writeFileSync(path.join(executionTree, "src", "a.txt"), "candidate");
    fs.unlinkSync(path.join(executionTree, "src", "gone.txt"));
    fs.unlinkSync(path.join(executionTree, "src", "untracked-gone.txt"));
    fs.writeFileSync(path.join(executionTree, ".env"), "hidden path");
    fs.mkdirSync(path.join(executionTree, "src", ".env.local"));
    fs.writeFileSync(path.join(executionTree, "src", ".env.local", "config"), "hidden directory");
    fs.mkdirSync(path.join(executionTree, "nested"));
    fs.writeFileSync(path.join(executionTree, "nested", ".git"), "gitdir: other");
    fs.writeFileSync(path.join(executionTree, "nested", "source.txt"), "independent repository");
    fs.writeFileSync(path.join(executionTree, "ignored.txt"), "OPENAI_API_KEY=synthetic-fixture-value");
    // 外側のState読取りreadと同じブロックで再宣言すると、前段の参照が未初期化になる。
    const prepareReviewer = () => operation.prepareReviewerWorkspace(bound.repositoryBindingCapability, management, mount);
    const reviewed = measureGit("reviewer", prepareReviewer);
    assert.equal(gitStarts.reviewer, 0);
    assert.equal(host().git, undefined);
    assert.equal(git(root, "count-objects", "-v"), objectsBefore);
    assert.equal(reviewed?.workspaceReview, true);
    assert.equal(reviewed.withheldFileCount, 1);
    assert.deepEqual(reviewed.files, []);
    const live = operation.readOwnedReviewerWorkspace(management, reviewed.candidateSnapshotId);
    assert.equal(live.directory, executionTree);
    assert.deepEqual(live.masks.map(({relativePath, kind}) => relativePath + ":" + kind).sort(), [".env:file", "ignored.txt:file", "nested:directory", "src/.env.local:directory"]);
    const refreshed = prepareReviewer();
    assert.equal(refreshed?.workspaceReview, true);
    assert.equal(operation.readOwnedReviewerWorkspace(management, reviewed.candidateSnapshotId), null);
    assert.equal(fs.readFileSync(path.join(executionTree, ".env"), "utf8"), "hidden path");
    const sensitiveName = path.join(executionTree, "OPENAI_API_KEY=synthetic-fixture-value");
    fs.writeFileSync(sensitiveName, "hidden name");
    assert.equal(prepareReviewer(), null);
    assert.equal(operation.readOwnedReviewerWorkspace(management, refreshed.candidateSnapshotId), null);
    fs.unlinkSync(sensitiveName);
    assert.equal(git(executionTree, "rev-parse", "HEAD").trim(), head);
    assert.equal(git(executionTree, "ls-files", "--stage"), indexBefore);
    if (mergeHead !== null)
      assert.equal(git(executionTree, "rev-parse", "MERGE_HEAD").trim(), mergeHead);
    operation.cleanupOwnedOperationDirectories(owned);
    assert.equal(host().phase, "terminal");
    assert.equal(host().git, undefined);
    assert.equal(git(root, "for-each-ref", "--format=%(refname)", "refs/heads/crdd/operation/").trim(), "");
    assert.equal(fs.existsSync(owned.root), false);
    process.stdout.write(JSON.stringify({ scenario, complete: true, gitStarts }));
    process.exit(0);
  } else if (scenario === "normal") {
    operation.cleanupOwnedOperationDirectories(owned);
    assert.equal(fs.existsSync(owned.root), false);
    assert.equal(host().phase, "terminal"); assert.equal(host().cleanup, "confirmed");
  } else if (scenario === "probe") {
    const snapshot = { resources: [{ key: "probe", identity: { kind: "container", dockerId: null,
      name: "crdd-fixture-probe", ownershipLabel: "crdd.coordinator.probe=fixture" },
      request: "not_issued", configuration: { image: null, command: null, environmentNames: null, mounts: null, networks: null, internal: null } }] };
    const cleanup = { cleanupOrder: ["probe"], setupTimeoutMs: 1000, unreceiptedAbsence: "retain", verifyLabelAbsence: true };
    let book = applyResourceEvent(null, { event: "submission", key: "probe", snapshot, cleanup });
    assert.ok(book); operation.recordOwnedHostResources(management, book);
    assert.throws(() => operation.cleanupOwnedOperationDirectories(owned));
    assert.equal(fs.existsSync(owned.root), true);
    const receipt = { resources: snapshot.resources.map(item => ({ ...item, request: "issued",
      identity: { ...item.identity, dockerId: "a".repeat(64) } })) };
    book = applyResourceEvent(book, { event: "receipt", key: "probe", snapshot: receipt, cleanup });
    assert.ok(book); operation.recordOwnedHostResources(management, book);
    const observed = operation.readOwnedHostOperation(management);
    book = applyResourceCleanup(book, receipt, [{ key: "probe", observation: "absent" }],
      { recoveryId, previousPayloadSha256: observed.payloadSha256 });
    assert.ok(book); operation.recordOwnedHostResources(management, book);
    operation.cleanupOwnedOperationDirectories(owned);
    assert.equal(host().resources.checkpoints[0].observation, "absent");
    assert.equal(host().phase, "terminal");
  } else if (scenario === "management_replaced") {
    assert.equal(await operation.abandonOwnedHostOperationGenerationLock(management), true);
    const first = operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent);
    assert.ok(first);
    assert.equal(operation.borrowHostRecoveryManagementDirectory(recoveryId, {}), null);
    assert.equal(operation.borrowHostRecoveryManagementDirectory("host-operation.OP-999999", first), null);
    const borrowed = operation.borrowHostRecoveryManagementDirectory(recoveryId, first);
    assert.ok(borrowed); assert.equal(borrowed.assertCurrent(), true);
    assert.equal(operation.releaseHostOperationRecoveryGeneration(first), true);
    assert.equal(borrowed.assertCurrent(), false);
    const second = operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent);
    assert.ok(second);
    const currentBorrow = operation.borrowHostRecoveryManagementDirectory(recoveryId, second);
    assert.ok(currentBorrow); assert.equal(currentBorrow.assertCurrent(), true);
    const selected = owned.directories.management, retained = path.join(root, "retained-management");
    fs.renameSync(selected, retained); fs.mkdirSync(selected);
    assert.equal(currentBorrow.assertCurrent(), false);
    assert.equal(operation.borrowHostRecoveryManagementDirectory(recoveryId, second), null);
    assert.equal(fs.existsSync(retained), true);
    fs.rmdirSync(selected); fs.renameSync(retained, selected);
    assert.equal(currentBorrow.assertCurrent(), true);
    assert.equal(operation.recoverOwnedOperationDirectories(recoveryId, second).status, "recovered");
    assert.equal(operation.releaseHostOperationRecoveryGeneration(second), true);
    assert.equal(currentBorrow.assertCurrent(), false);
  } else if (["root_replaced", "child_replaced"].includes(scenario)) {
    const selected = scenario === "root_replaced" ? owned.root :
      scenario === "management_replaced" ? owned.directories.management : owned.directories.workspace;
    const retained = path.join(root, "retained-original");
    fs.renameSync(selected, retained); fs.mkdirSync(selected);
    assert.throws(() => operation.cleanupOwnedOperationDirectories(owned));
    assert.equal(fs.existsSync(selected), true);
    assert.equal(fs.existsSync(retained), true);
    assert.equal(host().cleanup, "not_requested");
    fs.rmSync(selected, { recursive: true }); fs.renameSync(retained, selected);
    operation.cleanupOwnedOperationDirectories(owned);
    assert.equal(host().cleanup, "confirmed");
  } else if (scenario === "unknown_child") {
    const unknown = path.join(owned.root, "unknown-entry");
    fs.mkdirSync(unknown);
    assert.throws(() => operation.cleanupOwnedOperationDirectories(owned));
    assert.equal(fs.existsSync(unknown), true);
    fs.rmdirSync(unknown); operation.cleanupOwnedOperationDirectories(owned);
  } else if (scenario === "active_reentry") {
    assert.equal(operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent), null);
    operation.cleanupOwnedOperationDirectories(owned);
  } else if (scenario.startsWith("missing_pending_")) {
    assert.equal(await operation.abandonOwnedHostOperationGenerationLock(management), true);
    fs.rmSync(owned.root, { recursive: true });
    const generation = operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent);
    assert.ok(generation);
    const remove = fs.rmSync.bind(fs);
    let rootDeletes = 0; const stages = [];
    mock.method(fs, "rmSync", (target, ...args) => { if (String(target) === owned.root) rootDeletes++; return remove(target, ...args); });
    mock.method(fs, "renameSync", (from, to) => {
      const candidate = String(to) === stateFile ? JSON.parse(readFile(from, "utf8")) : null;
      const entry = candidate?.operations.find(item => item.kind === "host_operation");
      if (entry?.cleanup === "pending" && scenario === "missing_pending_refused") { faultObserved = true; throw Error("pending_refused"); }
      const result = rename(from, to);
      if (entry) stages.push(entry.cleanup);
      if (entry?.cleanup === "pending" && scenario === "missing_pending_throw") { faultObserved = true; throw Error("pending_result_unknown"); }
      if (entry?.cleanup === "pending" && scenario === "missing_pending_owner_lost") { faultObserved = true; current = false; }
      return result;
    }); syncBuiltinESMExports();
    const result = operation.recoverOwnedOperationDirectories(recoveryId, generation);
    assert.equal(result.status, "blocked", JSON.stringify(result)); assert.equal(rootDeletes, 0); assert.equal(faultObserved, true);
    mock.restoreAll(); syncBuiltinESMExports(); current = true;
    const after = JSON.parse(readFile(stateFile, "utf8")).operations.find(item => item.kind === "host_operation");
    assert.equal(after.recoveryId, recoveryId); assert.notEqual(after.cleanup, "confirmed"); assert.notEqual(after.phase, "terminal");
    assert.equal(fs.existsSync(owned.root), false);
    assert.equal(operation.releaseHostOperationRecoveryGeneration(generation), true);
  } else if (scenario === "missing_root_reentry" || scenario === "unreadable_state") {
    assert.equal(await operation.abandonOwnedHostOperationGenerationLock(management), true);
    if (scenario === "missing_root_reentry") fs.rmSync(owned.root, { recursive: true });
    if (scenario === "unreadable_state") {
      mock.method(fs, "openSync", (candidate, ...args) => {
        if (String(candidate) === stateFile) throw Object.assign(Error("unobservable"), { code: "EACCES" });
        return open(candidate, ...args);
      }); syncBuiltinESMExports();
      assert.equal(operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent), null);
      assert.equal(fs.existsSync(owned.root), true);
      mock.restoreAll(); syncBuiltinESMExports();
    }
    const generation = operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent);
    assert.ok(generation);
    let removedRoot = 0; const savedCleanup = []; const removeRoot = fs.rmSync.bind(fs);
    if (scenario === "missing_root_reentry") {
      mock.method(fs, "rmSync", (target, ...args) => { if (String(target) === owned.root) removedRoot++; return removeRoot(target, ...args); });
      mock.method(fs, "renameSync", (from, to) => { if (String(to) === stateFile) savedCleanup.push(JSON.parse(readFile(from, "utf8")).operations.find(item => item.kind === "host_operation").cleanup); return rename(from, to); });
      syncBuiltinESMExports();
    }
    const result = operation.recoverOwnedOperationDirectories(recoveryId, generation);
    assert.equal(result.status, "recovered", JSON.stringify(result));
    if (scenario === "missing_root_reentry") { assert.equal(removedRoot, 0); assert.deepEqual(savedCleanup, ["pending", "confirmed"]); mock.restoreAll(); syncBuiltinESMExports(); }
    assert.equal(operation.releaseHostOperationRecoveryGeneration(generation), true);
    assert.equal(host().cleanup, "confirmed"); assert.equal(fs.existsSync(owned.root), false);
  } else if (scenario === "foreign_reference") {
    assert.equal(await operation.abandonOwnedHostOperationGenerationLock(management), true);
    assert.equal(operation.acquireHostOperationRecoveryGeneration(repository, "host-operation.OP-999999", input.recordingCurrent), null);
    const generation = operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent);
    assert.ok(generation);
    assert.equal(operation.recoverOwnedOperationDirectories("host-operation.OP-999999", generation).status, "blocked");
    assert.equal(fs.existsSync(owned.root), true);
    assert.equal(operation.recoverOwnedOperationDirectories(recoveryId, generation).status, "recovered");
    assert.equal(operation.releaseHostOperationRecoveryGeneration(generation), true);
  } else if (scenario === "terminal_reentry") {
    operation.cleanupOwnedOperationDirectories(owned);
    const generation = operation.acquireHostOperationRecoveryGeneration(repository, recoveryId, input.recordingCurrent);
    assert.ok(generation);
    assert.equal(operation.recoverOwnedOperationDirectories(recoveryId, generation).status, "recovered");
    assert.equal(operation.releaseHostOperationRecoveryGeneration(generation), true);
    assert.equal(host().phase, "terminal");
  }
}
process.stdout.write(JSON.stringify({ scenario, complete: true,
  ...(scenario === "crash_reentry" ? { recoveryId: JSON.parse(readFile(stateFile, "utf8")).operations.find(item => item.kind === "host_operation").recoveryId } : {}) }));
`;

/**
 * 新方式の実体・保存境界を独立した子Processごとに反証する。
 * @responsibility 保存不明を成功へ変換せず、別実体・別参照を削除しないことを確認する。
 * @trace ERB-IT-003
 * @trace PRL-IT-013
 * @precondition 不変worker本文のみ共有し、Repository・Map・Owner・故障は各Caseで独立。
 * @trace RFD-IT-013
 * @stimulus 正常・Probe、開始拒否、取消、作成／保存故障、実体置換、欠測、現在Owner、再入場。
 * @observation 実State・Root・Receipt・固定回復ID・実Lockと子の終了。
 * @oracle 不明は保持。確認済みの場合だけ同じRootを清掃・終端保存する。
 * @cleanup 全子の同期終了後、検証済み自己生成Rootだけを既存fixtureで回収する。
 * @boundary 実EM／共通Lock／Filesystem。技術資源は合成値で、Docker不存在を主張しない。
 */
for (const scenario of [
  "normal",
  "probe",
  "current_rejected",
  "abort_before_root",
  "root_receipt_failure",
  "child_receipt_failure",
  "creation_mkdir_failure",
  "checkpoint_rename_failure",
  "root_replaced",
  "child_replaced",
  "unknown_child",
  "missing_root_reentry",
  "management_replaced",
  "active_reentry",
  "unreadable_state",
  "foreign_reference",
  "terminal_reentry",
  "foreign_repository_input",
  "crash_after_root",
  "crash_after_child_receipt",
  "git_main",
  "git_linked",
  "git_merge_conflict",
  "git_reference_conflict",
  "git_unsettled_task",
  "git_unsettled_restart",
  "missing_pending_refused",
  "missing_pending_throw",
  "missing_pending_owner_lost",
]) {
  test(`Host Windows: EM Host記録と実体の閉包: ${scenario}`, (sub) => {
    const directory = createRepositoryTestDirectory("host-em-transition-");
    sub.after(directory.cleanup);
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-", directory.path, scenario],
      {
        input: worker,
        encoding: "utf8",
        windowsHide: true,
        timeout: scenario.startsWith("git_") ? 180_000 : 30_000,
      },
    );
    assert.equal(result.error?.message, undefined, result.stderr);
    assert.equal(result.signal, null);
    if (scenario.startsWith("crash_")) {
      assert.equal(result.status, 73, result.stderr);
      assert.match(
        JSON.parse(result.stdout).recoveryId,
        /^host-operation\.OP-[0-9]{6,}$/u,
      );
      const recovery = spawnSync(
        process.execPath,
        ["--input-type=module", "-", directory.path, "crash_reentry"],
        { input: worker, encoding: "utf8", windowsHide: true, timeout: 30_000 },
      );
      assert.equal(recovery.error, undefined);
      assert.equal(recovery.signal, null);
      assert.equal(recovery.status, 0, recovery.stderr);
      assert.deepEqual(JSON.parse(recovery.stdout), {
        scenario: "crash_reentry",
        complete: true,
        recoveryId: JSON.parse(result.stdout).recoveryId,
      });
    } else {
      assert.equal(result.status, 0, result.stderr);
      const { gitStarts, ...outcome } = JSON.parse(result.stdout);
      assert.deepEqual(outcome, { scenario, complete: true });
      if (gitStarts && Object.hasOwn(gitStarts, "reviewer"))
        sub.diagnostic(`Git starts: ${JSON.stringify(gitStarts)}`);
    }
  });
}

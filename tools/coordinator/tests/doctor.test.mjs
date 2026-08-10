import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CHECK_STATUS,
  REQUIRED_CHECK_IDS,
  discoverCommand,
  evaluateReadiness,
  runDoctor
} from "../src/core/doctor.mjs";
import {
  cleanupOwnedOperationDirectories,
  createOwnedMountCapability,
  createOperationDirectories,
  createOwnedOperationDirectories,
  createProviderEnvironment,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy,
  verifyOwnedMountCapability
} from "../src/security/execution-environment.mjs";
import {
  dockerCreateArgumentsForFixture,
  evaluateDockerCliCandidateForFixture,
  normalizeContainerAbsence,
  normalizeContainerCreation,
  normalizeDockerIsolationResult,
  recoverDockerIsolationProbe,
  validateContainerInspect
} from "../src/security/docker-isolation.mjs";

function confirmedChecks() {
  return REQUIRED_CHECK_IDS.map((id) => ({ id, status: "confirmed", reason: null }));
}

test("Provider環境は通常HomeとCredential環境を継承しない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-env-test-"));
  try {
    const directories = createOperationDirectories(root);
    const environment = createProviderEnvironment({
      PATH: "test-path",
      HOME: "/normal/home",
      USERPROFILE: "C:\\Users\\normal",
      OPENAI_API_KEY: "secret",
      ANTHROPIC_API_KEY: "secret",
      SSH_AUTH_SOCK: "agent"
    }, directories);
    assert.equal(environment.HOME, directories.providerHome);
    assert.equal(environment.USERPROFILE, directories.providerHome);
    assert.equal(environment.TEMP, directories.tmp);
    assert.deepEqual(credentialEnvironmentNamesPresent(environment), []);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("ProviderはRuntime管理領域の書込み主体ではない", () => {
  const directories = {
    root: "/state/OP-1",
    providerHome: "/state/OP-1/provider-home",
    workspace: "/state/OP-1/workspace",
    tmp: "/state/OP-1/tmp",
    events: "/state/OP-1/events",
    projection: "/state/OP-1/projection",
    management: "/state/OP-1/management"
  };
  const policy = describeFilesystemPolicy(directories);
  assert.deepEqual(policy.coordinatorRuntime.write, [directories.events, directories.projection, directories.management]);
  assert.deepEqual(policy.providerProcess.write, [directories.workspace, directories.providerHome, directories.tmp]);
  assert.deepEqual(policy.providerProcess.deny, [directories.events, directories.projection, directories.management]);
  assert.equal(policy.credentialBroker.exposeCredentialStorePathToProvider, false);
});

test("全必須checkがconfirmedの場合だけpure集約はReadyを返す", () => {
  assert.equal(evaluateReadiness(confirmedChecks()).status, "ready");
  for (const status of CHECK_STATUS.filter((value) => value !== "confirmed")) {
    const checks = confirmedChecks();
    checks[0] = { ...checks[0], status, reason: `fixture_${status}` };
    assert.equal(evaluateReadiness(checks).status, "blocked");
  }
  for (const id of REQUIRED_CHECK_IDS) {
    const checks = confirmedChecks();
    const target = checks.find((item) => item.id === id);
    target.status = "unknown";
    target.reason = "fixture_unknown";
    assert.equal(evaluateReadiness(checks).status, "blocked", id);
  }
});

test("欠落、重複、未知および不正なcheckをfail closedにする", () => {
  const missing = confirmedChecks().slice(1);
  assert.equal(evaluateReadiness(missing).status, "blocked");
  const duplicate = [...confirmedChecks(), confirmedChecks()[0]];
  assert.equal(evaluateReadiness(duplicate).status, "blocked");
  const unknown = [...confirmedChecks(), { id: "unknown", status: "confirmed" }];
  assert.equal(evaluateReadiness(unknown).status, "blocked");
  const invalid = confirmedChecks();
  invalid[0] = { ...invalid[0], status: "pass" };
  assert.equal(evaluateReadiness(invalid).status, "blocked");
});

test("Providerごとの必須checkを片側だけ成立させてもReadyにならない", () => {
  const checks = confirmedChecks();
  const target = checks.find((item) => item.id === "provider.claude.authentication");
  target.status = "unknown";
  target.reason = "authentication_not_evaluated";
  const result = evaluateReadiness(checks);
  assert.equal(result.status, "blocked");
  assert.equal(result.blockers.some((item) => item.id === target.id), true);
});

test("passive discoveryはPATHをFilesystem APIで調べ絶対Pathを返さない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-discovery-test-"));
  try {
    fs.writeFileSync(path.join(root, "codex.cmd"), "not executed", "utf8");
    const result = discoverCommand("codex", {
      platform: "win32",
      environment: { PATH: root, PATHEXT: ".EXE;.CMD;.BAT" }
    });
    assert.equal(result.located, true);
    assert.equal(result.candidateCount, 1);
    assert.deepEqual(result.formats, ["cmd"]);
    assert.equal(JSON.stringify(result).includes(root), false);
    assert.equal("version" in result, false);
    assert.equal("path" in result, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("複数形式のProvider候補を実行せず集約する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-discovery-many-"));
  try {
    fs.writeFileSync(path.join(root, "claude.exe"), "not executed", "utf8");
    fs.writeFileSync(path.join(root, "claude.bat"), "not executed", "utf8");
    const result = discoverCommand("claude", {
      platform: "win32",
      environment: { PATH: root, PATHEXT: ".EXE;.CMD;.BAT" }
    });
    assert.equal(result.candidateCount, 2);
    assert.deepEqual(result.formats, ["bat", "exe"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("owned childだけを削除しtemporary parentとsiblingを保持する", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-parent-test-"));
  const sibling = path.join(parent, "keep.txt");
  fs.writeFileSync(sibling, "keep", "utf8");
  try {
    const owned = createOwnedOperationDirectories(parent);
    const root = owned.root;
    cleanupOwnedOperationDirectories(owned);
    assert.equal(fs.existsSync(root), false);
    assert.equal(fs.readFileSync(sibling, "utf8"), "keep");
    assert.equal(fs.existsSync(parent), true);
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /identity_required/u);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("所有IdentityがないPathをcleanupしない", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-unowned-test-"));
  const content = path.join(parent, "keep.txt");
  fs.writeFileSync(content, "keep", "utf8");
  try {
    assert.throws(() => cleanupOwnedOperationDirectories({ root: parent, parent: path.dirname(parent) }));
    assert.equal(fs.readFileSync(content, "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("正しいprefixを持つ既存directoryでも偽owned objectでは削除しない", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-fake-owner-"));
  const target = fs.mkdtempSync(path.join(parent, "crdd-coordinator-doctor-"));
  const content = path.join(target, "keep.txt");
  fs.writeFileSync(content, "keep", "utf8");
  try {
    assert.throws(() => cleanupOwnedOperationDirectories({ root: target, parent }), /identity_required/u);
    assert.equal(fs.readFileSync(content, "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("owned objectのpublic Pathを書き換えても別directoryを削除しない", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-mutated-owner-"));
  const other = path.join(parent, "other");
  fs.mkdirSync(other);
  fs.writeFileSync(path.join(other, "keep.txt"), "keep", "utf8");
  try {
    const owned = createOwnedOperationDirectories(parent);
    owned.root = other;
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /replaced/u);
    assert.equal(fs.readFileSync(path.join(other, "keep.txt"), "utf8"), "keep");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("owned childを同名の別directoryへ置換してもreplacementを削除しない", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-replaced-owner-"));
  try {
    const owned = createOwnedOperationDirectories(parent);
    const original = `${owned.root}-original`;
    fs.renameSync(owned.root, original);
    fs.mkdirSync(owned.root);
    const replacementContent = path.join(owned.root, "replacement.txt");
    const originalContent = path.join(original, "original.txt");
    fs.writeFileSync(replacementContent, "replacement", "utf8");
    fs.writeFileSync(originalContent, "original", "utf8");
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /replaced/u);
    assert.equal(fs.readFileSync(replacementContent, "utf8"), "replacement");
    assert.equal(fs.readFileSync(originalContent, "utf8"), "original");
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("owned childをjunctionへ置換した場合は対象を削除しない", (t) => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-linked-owner-"));
  try {
    const owned = createOwnedOperationDirectories(parent);
    const original = `${owned.root}-original`;
    const target = path.join(parent, "junction-target");
    fs.renameSync(owned.root, original);
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "keep.txt"), "keep", "utf8");
    try {
      fs.symlinkSync(target, owned.root, process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) {
        t.skip(`link fixture unavailable: ${error.code}`);
        return;
      }
      throw error;
    }
    assert.throws(() => cleanupOwnedOperationDirectories(owned), /replaced/u);
    assert.equal(fs.readFileSync(path.join(target, "keep.txt"), "utf8"), "keep");
    assert.equal(fs.existsSync(original), true);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("production doctorはpassiveかつ未実装境界をReadyにしない", () => {
  const report = runDoctor();
  const serialized = JSON.stringify(report);
  assert.equal(report.diagnosticMode, "passive_preflight");
  assert.equal(report.status, "blocked");
  assert.equal(report.providers.codex.version, undefined);
  assert.equal(report.providers.codex.path, undefined);
  assert.equal(report.checks.some((item) => item.id === "execution.filesystem" && item.status === "not_implemented"), true);
  assert.equal(report.checks.some((item) => item.id === "execution.credential_isolation" && item.status === "not_implemented"), true);
  assert.equal(report.checks.some((item) => item.id === "execution.egress" && item.status === "not_implemented"), true);
  assert.equal(report.checks.some((item) => item.id.endsWith(".active_probe") && item.status === "not_implemented"), true);
  assert.equal(serialized.includes("OPENAI_API_KEY="), false);
  assert.equal(serialized.includes("ANTHROPIC_API_KEY="), false);
});

test("Docker隔離Probeは固定Digestと最小権限を使う", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-docker-args-"));
  try {
    const directories = createOperationDirectories(root);
    const args = dockerCreateArgumentsForFixture(directories, "test-id");
    assert.deepEqual(args.slice(0, 2), ["-H", "npipe:////./pipe/dockerDesktopLinuxEngine"]);
    assert.equal(args.includes("--network=none"), true);
    assert.equal(args.includes("--read-only"), true);
    assert.equal(args.includes("--cap-drop=ALL"), true);
    assert.equal(args.includes("--security-opt=no-new-privileges"), true);
    assert.equal(args.includes("crdd-coordinator-probe-test-id"), true);
    assert.equal(args.includes("crdd.coordinator.probe=test-id"), true);
    assert.equal(args.some((value) => value.startsWith("python@sha256:")), true);
    const mounts = args.flatMap((value, index) => value === "--mount" ? [args[index + 1]] : []);
    assert.equal(mounts.some((value) => value.includes("events")), false);
    assert.equal(mounts.some((value) => value.includes("projection")), false);
    assert.equal(mounts.some((value) => value.includes("management")), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Docker隔離Probe結果は全境界成立時だけconfirmedになる", () => {
  const complete = {
    marker: "crdd-coordinator-isolation-v1",
    allowed_writes: { workspace: true, "provider-home": true, tmp: true },
    runtime_paths_absent: true,
    credential_names_absent: true,
    network_blocked: true,
    home_isolated: true,
    tmp_isolated: true
  };
  assert.equal(normalizeDockerIsolationResult({ status: 0, stdout: JSON.stringify(complete) }).status, "confirmed");
  for (const key of ["runtime_paths_absent", "credential_names_absent", "network_blocked", "home_isolated", "tmp_isolated"]) {
    assert.equal(normalizeDockerIsolationResult({ status: 0, stdout: JSON.stringify({ ...complete, [key]: false }) }).status, "blocked", key);
  }
  assert.equal(normalizeDockerIsolationResult({ status: 0, stdout: "not-json" }).status, "blocked");
  assert.equal(normalizeDockerIsolationResult({ status: 1, stdout: JSON.stringify(complete) }).status, "blocked");
});

test("Docker mount capabilityはfactory所有objectだけを受理しchild置換を拒否する", () => {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-mount-capability-"));
  try {
    const owned = createOwnedOperationDirectories(parent);
    assert.throws(() => createOwnedMountCapability({ directories: owned.directories }), /identity_required/u);
    const capability = createOwnedMountCapability(owned);
    const verified = verifyOwnedMountCapability(capability);
    owned.directories.workspace = parent;
    assert.equal(verifyOwnedMountCapability(capability).workspace, verified.workspace);
    const original = `${verified.workspace}-original`;
    fs.renameSync(verified.workspace, original);
    fs.mkdirSync(verified.workspace);
    assert.throws(() => verifyOwnedMountCapability(capability), /replaced/u);
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }
});

test("Docker CLI候補は固定root、非link実体、承認Hashの全一致だけを受理する", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-docker-cli-"));
  try {
    const executable = path.join(root, "docker.exe");
    fs.writeFileSync(executable, "trusted fixture", "utf8");
    const sha256 = createHash("sha256").update(fs.readFileSync(executable)).digest("hex").toUpperCase();
    assert.equal(evaluateDockerCliCandidateForFixture({ installRoot: root, executableName: "docker.exe", sha256 }), true);
    assert.equal(evaluateDockerCliCandidateForFixture({ installRoot: root, executableName: "docker.exe", sha256: "0".repeat(64) }), false);
    const linked = path.join(root, "linked.exe");
    try { fs.symlinkSync(executable, linked, "file"); }
    catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error?.code)) return t.skip(`link fixture unavailable: ${error.code}`);
      throw error;
    }
    assert.equal(evaluateDockerCliCandidateForFixture({ installRoot: root, executableName: "linked.exe", sha256 }), false);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

function secureInspectFixture(id, probeId, mounts) {
  const probeSource = dockerCreateArgumentsForFixture(mounts, probeId).at(-1);
  return {
    Id: id,
    Name: `/crdd-coordinator-probe-${probeId}`,
    Config: {
      Labels: { "crdd.coordinator.probe": probeId },
      Image: "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
      User: "65532:65532",
      Entrypoint: ["python"],
      Cmd: ["-c", probeSource]
    },
    HostConfig: { NetworkMode: "none", ReadonlyRootfs: true, Privileged: false, PidsLimit: 64, CapDrop: ["ALL"], CapAdd: null, Devices: [], SecurityOpt: ["no-new-privileges"] },
    Mounts: [
      { Type: "bind", Source: mounts.workspace, Destination: "/operation/workspace", RW: true },
      { Type: "bind", Source: mounts.providerHome, Destination: "/operation/provider-home", RW: true },
      { Type: "bind", Source: mounts.tmp, Destination: "/operation/tmp", RW: true }
    ]
  };
}

test("container inspectはIdentityと全Security属性の一致を要求する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-inspect-"));
  try {
    const directories = createOperationDirectories(root);
    const id = "a".repeat(64);
    const probeId = "00000000-0000-4000-8000-000000000000";
    const inspect = secureInspectFixture(id, probeId, directories);
    assert.equal(validateContainerInspect(inspect, { id, probeId, mounts: directories }), true);
    for (const mutate of [
      (value) => { value.Id = "b".repeat(64); },
      (value) => { value.HostConfig.NetworkMode = "host"; },
      (value) => { value.HostConfig.Privileged = true; },
      (value) => { value.Mounts.push({ Type: "bind", Source: root, Destination: "/extra", RW: true }); }
    ]) {
      const changed = structuredClone(inspect);
      mutate(changed);
      assert.equal(validateContainerInspect(changed, { id, probeId, mounts: directories }), false);
    }
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test("Fake Probe recoveryはcaller指定Pathや不正tokenを受理しない", () => {
  const result = recoverDockerIsolationProbe("C:\\workspace\\not-owned");
  assert.equal(result.status, "blocked");
  assert.equal(JSON.stringify(result).includes("C:\\workspace"), false);
});

test("container createとabsence確認はtimeout、malformed ID、残留をfail closedにする", () => {
  assert.equal(normalizeContainerCreation({ status: 0, stdout: `${"a".repeat(64)}\n` }).status, "confirmed");
  assert.equal(normalizeContainerCreation({ status: 0, stdout: "not-an-id" }).status, "blocked");
  assert.equal(normalizeContainerCreation({ status: null, error: { code: "ETIMEDOUT" }, stdout: "" }).status, "blocked");
  assert.equal(normalizeContainerAbsence({ status: 1 }, { status: 0, stdout: "" }).status, "confirmed");
  assert.equal(normalizeContainerAbsence({ status: 0 }, { status: 0, stdout: "" }).status, "blocked");
  assert.equal(normalizeContainerAbsence({ status: 1 }, { status: 0, stdout: "still-present" }).status, "blocked");
  assert.equal(normalizeContainerAbsence({ status: 1 }, { status: 1, stdout: "" }).status, "blocked");
});

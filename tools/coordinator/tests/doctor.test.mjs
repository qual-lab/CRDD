import assert from "node:assert/strict";
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
  createOperationDirectories,
  createOwnedOperationDirectories,
  createProviderEnvironment,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy
} from "../src/security/execution-environment.mjs";

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

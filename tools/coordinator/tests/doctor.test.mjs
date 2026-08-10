import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { evaluateProviderGate, probeCommand, runDoctor } from "../src/core/doctor.mjs";
import {
  createOperationDirectories,
  createProviderEnvironment,
  credentialEnvironmentNamesPresent,
  describeFilesystemPolicy
} from "../src/security/execution-environment.mjs";

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
    assert.equal(environment.OPENAI_API_KEY, undefined);
    assert.equal(environment.ANTHROPIC_API_KEY, undefined);
    assert.equal(environment.SSH_AUTH_SOCK, undefined);
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

  assert.deepEqual(policy.providerProcess.write, [
    directories.workspace,
    directories.providerHome,
    directories.tmp
  ]);
  assert.deepEqual(policy.coordinatorRuntime.write, [
    directories.events,
    directories.projection,
    directories.management
  ]);
  assert.deepEqual(policy.providerProcess.deny, [
    directories.events,
    directories.projection,
    directories.management
  ]);
  assert.equal(policy.credentialBroker.exposeCredentialStorePathToProvider, false);
});

test("commandが見つからない場合は実行可能と推定しない", () => {
  const runner = () => ({ status: 1, stdout: "", stderr: "" });
  const result = probeCommand("missing", { runner, platform: "linux" });

  assert.equal(result.located, false);
  assert.equal(result.runnable, false);
  assert.equal(result.reason, "command_not_found");
});

test("Provider GateはFilesystemまたはEgressを強制できなければ閉じる", () => {
  const provider = { located: true, runnable: true };
  const result = evaluateProviderGate(provider, {
    filesystem: false,
    credentials: true,
    providerEgress: false
  });

  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers, [
    "filesystem_boundary_not_enforced",
    "provider_egress_allowlist_not_enforced"
  ]);
});

test("全強制境界とProvider起動が成立した場合だけGateを開く", () => {
  const provider = { located: true, runnable: true };
  const result = evaluateProviderGate(provider, {
    filesystem: true,
    credentials: true,
    providerEgress: true
  });

  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test("doctorはCredential値を記録せず、未実装境界をReadyにしない", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "coordinator-doctor-test-"));
  const runner = (command, args) => {
    if (command === "git" && args[0] === "rev-parse" && args[1] === "HEAD") {
      return { status: 0, stdout: "commit\n", stderr: "" };
    }
    if (command === "git" && args[0] === "rev-parse") {
      return { status: 0, stdout: "tree\n", stderr: "" };
    }
    if (command === "git" && args[0] === "status") {
      return { status: 0, stdout: "", stderr: "" };
    }
    if (command === "which") {
      return { status: 0, stdout: `/usr/bin/${args[0]}\n`, stderr: "" };
    }
    return { status: 0, stdout: `${command} 1.0\n`, stderr: "" };
  };

  const report = runDoctor({
    cwd: root,
    environment: {
      PATH: "/usr/bin",
      OPENAI_API_KEY: "do-not-record"
    },
    platform: "linux",
    probeRoot: path.join(root, "probe"),
    runner
  });

  assert.equal(report.status, "blocked");
  assert.deepEqual(report.credentials.detectedNames, ["OPENAI_API_KEY"]);
  assert.deepEqual(report.credentials.forwardedNames, []);
  assert.equal(JSON.stringify(report).includes("do-not-record"), false);
  assert.equal(report.credentials.environmentFiltered, true);
  assert.equal(report.credentials.enforcement, "not_implemented");
  for (const provider of Object.values(report.providers)) {
    assert.equal(provider.gate.blockers.includes("credential_isolation_not_enforced"), true);
  }
  assert.equal(report.filesystem.enforcement, "not_implemented");
  assert.equal(report.egress.providerAllowlist, "not_implemented");
  assert.deepEqual(report.filesystem.policy.coordinatorRuntime.write, [
    "events",
    "projection",
    "management"
  ]);
  assert.equal(JSON.stringify(report).includes(root), false);
  fs.rmSync(root, { recursive: true, force: true });
});

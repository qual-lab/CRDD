import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  describeAuthorityRootContract,
  selectAuthorityRootCandidate
} from "../src/security/authority-root-profile.mjs";

function request(overrides = {}) {
  return {
    cliOverride: null,
    environmentOverride: null,
    activationIntent: "explicit_activate_request",
    ...overrides
  };
}

test("Authority RootはCLI、環境の順で明示絶対Pathだけを候補化する", () => {
  const cli = path.resolve("authority-cli");
  const environment = path.resolve("authority-environment");
  const cliResult = selectAuthorityRootCandidate(request({ cliOverride: cli, environmentOverride: environment }));
  assert.equal(cliResult.status, "candidate");
  assert.equal(cliResult.selection.source, "cli_override");
  assert.equal(cliResult.selection.absolutePathReported, false);
  assert.equal(JSON.stringify(cliResult).includes(cli), false);

  const environmentResult = selectAuthorityRootCandidate(request({ environmentOverride: environment }));
  assert.equal(environmentResult.status, "candidate");
  assert.equal(environmentResult.selection.source, "environment_override");
  assert.equal(JSON.stringify(environmentResult).includes(environment), false);
});

test("Authority RootにOS暗黙値、相対Pathまたはenable診断intentを使わない", () => {
  assert.equal(selectAuthorityRootCandidate(request()).reason, "authority_root_explicit_path_required");
  assert.equal(selectAuthorityRootCandidate(request({ cliOverride: "relative" })).reason,
    "authority_root_override_invalid");
  assert.equal(selectAuthorityRootCandidate(request({
    cliOverride: path.resolve("authority"),
    activationIntent: "explicit_enable_request"
  })).reason, "authority_activation_intent_invalid");
});

test("Authority Root入力のaccessor、Proxy、余分fieldおよび欠落fieldを拒否する", () => {
  const absolute = path.resolve("authority");
  let getterCalls = 0;
  const accessor = request({ cliOverride: absolute });
  Object.defineProperty(accessor, "cliOverride", {
    enumerable: true,
    get() { getterCalls += 1; return absolute; }
  });
  assert.equal(selectAuthorityRootCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const raw = request({ cliOverride: absolute });
  const proxied = new Proxy(raw, { ownKeys() { proxyCalls += 1; return Reflect.ownKeys(raw); } });
  assert.equal(selectAuthorityRootCandidate(proxied).status, "blocked");
  assert.equal(proxyCalls, 0);
  assert.equal(selectAuthorityRootCandidate({ ...raw, extra: true }).status, "blocked");
  const { activationIntent: omitted, ...missing } = raw;
  assert.equal(omitted, "explicit_activate_request");
  assert.equal(selectAuthorityRootCandidate(missing).status, "blocked");
});

test("Authority Root contractは共有外部Trust Rootと未実装Path境界を示す", () => {
  const contract = describeAuthorityRootContract();
  assert.equal(contract.defaultPath, null);
  assert.equal(contract.osImplicitDefaultAllowed, false);
  assert.equal(contract.sharedAcrossRepositories, true);
  assert.equal(contract.runtimeRootMayContainAuthorityBundle, false);
  assert.equal(contract.providerMountAllowed, false);
  assert.equal(contract.runtimePathAdapter, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
});

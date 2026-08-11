import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  DEFAULT_REPOSITORY_RUNTIME_DIRECTORY,
  describeRuntimeRootContract,
  selectRuntimeRootCandidate
} from "../src/security/runtime-root-profile.mjs";

const repositoryRoot = path.resolve("fixture-repository");
const cliRoot = path.resolve("fixture-runtime-cli");
const environmentRoot = path.resolve("fixture-runtime-environment");

function input(overrides = {}) {
  return {
    repositoryRoot,
    cliOverride: null,
    environmentOverride: null,
    activationIntent: null,
    ...overrides
  };
}

test("既定RootはRepository配下の固定directory候補にする", () => {
  const result = selectRuntimeRootCandidate(input({ activationIntent: "explicit_enable_request" }));
  assert.equal(result.status, "candidate");
  assert.equal(result.selection.source, "repository_default");
  assert.equal(result.selection.repositoryRelativeDefault, DEFAULT_REPOSITORY_RUNTIME_DIRECTORY);
  assert.equal(result.selection.customRootSelected, false);
  assert.equal(result.selection.absolutePathReported, false);
  assert.equal(result.runtimeCapabilityIssued, false);
});

test("CLI、環境、Repository既定の順でRoot候補を選ぶ", () => {
  const environment = selectRuntimeRootCandidate(input({
    environmentOverride: environmentRoot,
    activationIntent: "explicit_enable_request"
  }));
  assert.equal(environment.selection.source, "environment_override");
  assert.equal(environment.selection.repositoryRelativeDefault, null);

  const cli = selectRuntimeRootCandidate(input({
    cliOverride: cliRoot,
    environmentOverride: environmentRoot,
    activationIntent: "explicit_enable_request"
  }));
  assert.equal(cli.selection.source, "cli_override");
});

test("Directoryやoverrideの存在だけでは機能を有効化しない", () => {
  for (const candidate of [
    input(),
    input({ cliOverride: cliRoot }),
    input({ environmentOverride: environmentRoot })
  ]) {
    const result = selectRuntimeRootCandidate(candidate);
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "runtime_feature_not_enabled");
    assert.equal(result.activationState, "disabled");
    assert.equal(result.runtimeCapabilityIssued, false);
  }
});

test("相対Path、NUL、長すぎるPathおよび未知activationを拒否する", () => {
  assert.equal(selectRuntimeRootCandidate(input({ repositoryRoot: "relative" })).reason,
    "runtime_root_input_invalid");
  assert.equal(selectRuntimeRootCandidate(input({ cliOverride: "relative" })).reason,
    "runtime_root_override_invalid");
  assert.equal(selectRuntimeRootCandidate(input({ environmentOverride: `${environmentRoot}\0bad` })).reason,
    "runtime_root_override_invalid");
  assert.equal(selectRuntimeRootCandidate(input({ environmentOverride: `${environmentRoot}\nbad` })).reason,
    "runtime_root_override_invalid");
  assert.equal(selectRuntimeRootCandidate(input({ cliOverride: path.resolve("a".repeat(4_096)) })).reason,
    "runtime_root_override_invalid");
  assert.equal(selectRuntimeRootCandidate(input({ activationIntent: "enabled" })).reason,
    "runtime_activation_intent_invalid");
});

test("Root入力のaccessorとProxyを実行せずblockedへ閉じる", () => {
  let getterCalls = 0;
  const accessor = input();
  Object.defineProperty(accessor, "repositoryRoot", {
    enumerable: true,
    get() { getterCalls += 1; return repositoryRoot; }
  });
  assert.equal(selectRuntimeRootCandidate(accessor).status, "blocked");
  assert.equal(getterCalls, 0);

  let proxyCalls = 0;
  const target = input();
  const proxy = new Proxy(target, {
    ownKeys() { proxyCalls += 1; return Reflect.ownKeys(target); }
  });
  assert.equal(selectRuntimeRootCandidate(proxy).status, "blocked");
  assert.equal(proxyCalls, 0);
});

test("Root選択Coreはignore、Path保護、activationまたはCapabilityを成立させない", () => {
  const contract = describeRuntimeRootContract();
  assert.equal(contract.featureDefault, "disabled");
  assert.equal(contract.cliOverrideIntegration, "not_implemented");
  assert.equal(contract.environmentOverrideIntegration, "not_implemented");
  assert.equal(contract.explicitEnableRequired, true);
  assert.equal(contract.directoryExistenceActivates, false);
  assert.equal(contract.overrideActivates, false);
  assert.equal(contract.gitIgnoreIsSecurityBoundary, false);
  assert.equal(contract.candidateRevisionIncludesRuntimeRoot, false);
  assert.equal(contract.operationInputIncludesRuntimeRoot, false);
  assert.equal(contract.providerMountAllowed, false);
  assert.equal(contract.disableSemantics, "stop_new_operations");
  assert.equal(contract.disableImplementation, "not_implemented");
  assert.equal(contract.disableDeletesStoredData, false);
  assert.equal(contract.runtimeDataDeletion, "not_implemented");
  assert.equal(contract.runtimePathAdapter, "not_implemented");
  assert.equal(contract.activationRecordPersistence, "not_implemented");
  assert.equal(contract.runtimeCapabilityIssued, false);
});

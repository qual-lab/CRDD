import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import {
  createRuntimeLocalTypeScriptWorker,
  runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver,
  spawnRuntimeLocalTypeScriptChild,
} from "../../src/core/runtime-local-typescript-child-entrypoints.ts";
import { createDevelopmentMeasurementConstraints } from "../../src/security/development-measurement-constraints.ts";
import {
  assertReleaseSigningConsumerClosureForVerification,
  assertRuntimePackageCapabilityConsumerGraphForVerification,
  assertRuntimeSourceDeclaredGraphBoundaryForVerification,
  assertRuntimeSourceModuleBoundaryForVerification,
  assertVerificationToolCapabilityGraphForVerification,
  consumeRuntimeOwnedVerifiedCoordinatorPackageCapability,
  createIsolatedVerifiedPackageCapabilityStateCandidate,
  describePlatformProvisionerPackageFilesystemContract,
  inspectBundledCoordinatorPackageFilesystemCandidate,
  inspectFixedDevelopmentCoordinatorPackageCandidate,
  inspectPlatformProvisionerPackageFilesystemCandidate,
  inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate,
  inspectVerifiedNativeDistributionCandidate,
  issueRuntimeOwnedVerifiedCoordinatorPackageCapability,
  releaseSigningProtectedPathDiagnosticForVerification,
  runtimePackageCapabilityConsumerGraphDiagnosticForVerification,
  verifyBundledCoordinatorPackageCandidate,
} from "../../src/security/platform-provisioner-package-filesystem.ts";
import {
  calculateRuntimeExecutionIdentityCandidate,
  PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_DOMAIN,
  PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
  PLATFORM_PROVISIONER_MANIFEST_REVISION,
} from "../../src/security/platform-provisioner-trust-core.ts";
import { canonicalizeProvisioningJsonValueCandidate } from "../../src/security/provisioning-signature-primitives.ts";
import { assertCanonicalCandidate } from "../support/test-support.ts";

const developmentFixtureRoots = new Set<string>();
const coordinatorRoot = path.resolve(import.meta.dirname, "../..");

test("restart machineのWSL対象とDocker観測引数は閉集合で保持する", () => {
  const sourcePath = "src/security/docker-restart-machine.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  assert.equal((source.match(/\bspawnSync\s*\(/gu) ?? []).length, 2);
  assert.doesNotMatch(
    source,
    /terminateWsl|terminateProcesses|--terminate|--shutdown/u,
  );
  assert.match(source, /session\.stopDesktop\(\)/u);
  for (const [from, to] of [
    ["--list", "--terminate"],
    ["--no-trunc", "--all"],
    ["--running", "--shutdown"],
  ] as const) {
    assert.ok(source.includes(from));
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          source.replace(from, to),
        ),
      /runtime_dependency_child_process_unbound/u,
    );
  }
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        sourcePath,
        `${source}\nfunction terminateWsl() { return spawnSync("wsl.exe", ["--terminate", "docker-desktop"]); }\n`,
      ),
    /runtime_dependency_child_process_unbound/u,
  );
});

test("Native repair/restart spawnは同じ署名観測所有者と閉じた引数集合を要求する", () => {
  const sourcePath = "src/security/docker-desktop-repair-native-helper.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  const flag = "--docker-desktop-restart-helper";
  assert.ok(source.includes(flag));
  assert.doesNotMatch(source, /--docker-desktop-repair-helper/u);
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        sourcePath,
        source.replace(flag, "--unauthorized-helper"),
      ),
    /runtime_dependency_child_process_unbound/u,
  );
});

function verificationToolSources() {
  const scriptsRoot = path.join(coordinatorRoot, "scripts");
  const sources: Record<string, string> = {};
  const visit = (root: string, relativeRoot: string) => {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const relative = `${relativeRoot}/${entry.name}`;
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) {
        visit(absolute, relative);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".ts"))
        sources[relative] = fs.readFileSync(absolute, "utf8");
    }
  };
  visit(scriptsRoot, "scripts");
  return sources;
}

function runtimeTypeScriptSources() {
  const sources: Record<string, string> = {};
  const visit = (root: string, relativeRoot: string) => {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const relative = `${relativeRoot}/${entry.name}`;
      const absolute = path.join(root, entry.name);
      if (entry.isDirectory()) {
        visit(absolute, relative);
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".ts"))
        sources[relative] = fs.readFileSync(absolute, "utf8");
    }
  };
  for (const root of ["bin", "src", "scripts"])
    visit(path.join(coordinatorRoot, root), root);
  visit(
    path.resolve(coordinatorRoot, "../project-runtime/src"),
    "40_Develop/project-runtime/src",
  );
  return sources;
}
function removeDevelopmentFixture(root: string) {
  assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
  assert.equal(fs.realpathSync.native(root), root);
  fs.rmSync(root, { recursive: true, force: true });
  developmentFixtureRoots.delete(root);
}

after(() => {
  for (const root of developmentFixtureRoots) removeDevelopmentFixture(root);
});

test("local TypeScript子wrapperはroleとkindを実行前に検証し、targetを外へ公開しない", () => {
  assert.throws(
    () => spawnRuntimeLocalTypeScriptChild("unknown" as never, [], {}),
    /runtime_local_typescript_child_entrypoint_unknown/u,
  );
  assert.throws(
    () =>
      spawnRuntimeLocalTypeScriptChild("candidate_store_lock_worker", [], {}),
    /runtime_local_typescript_child_entrypoint_kind_mismatch/u,
  );
  assert.throws(
    () =>
      spawnRuntimeLocalTypeScriptChild("host_operation_lock_supervisor", [], {
        shell: true,
      }),
    /runtime_local_typescript_child_spawn_shell_forbidden/u,
  );
  assert.throws(
    () =>
      createRuntimeLocalTypeScriptWorker("host_operation_lock_supervisor", {}),
    /runtime_local_typescript_child_entrypoint_kind_mismatch/u,
  );
  assert.throws(
    () => createRuntimeLocalTypeScriptWorker("unknown" as never, {}),
    /runtime_local_typescript_child_entrypoint_unknown/u,
  );
  assert.throws(
    () =>
      createRuntimeLocalTypeScriptWorker("candidate_store_lock_worker", {
        eval: true,
      }),
    /runtime_local_typescript_child_worker_eval_forbidden/u,
  );
  const projectionTokens =
    runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver();
  assert.equal(projectionTokens.length, 4);
  assert.equal(
    projectionTokens.every(
      (entrypoint) =>
        Object.isFrozen(entrypoint) &&
        !("url" in entrypoint) &&
        !("filePath" in entrypoint) &&
        !("relativePath" in entrypoint),
    ),
    true,
  );
});

function developmentFixture(omittedEntrypoint: string | null = null) {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-development-package-"),
  );
  developmentFixtureRoots.add(root);
  const distributionRoot = path.join(root, "distribution");
  const packageRoot = path.join(distributionRoot, "40_Develop", "coordinator");
  const repositoryRoot = path.resolve(coordinatorRoot, "../..");
  for (const relative of [
    "40_Develop/coordinator/package.json",
    "40_Develop/coordinator/bin",
    "40_Develop/coordinator/src",
    "40_Develop/coordinator/scripts",
    "40_Develop/mcp/package.json",
    "40_Develop/mcp/src",
    "40_Develop/project-runtime/package.json",
    "40_Develop/project-runtime/src",
    "40_Develop/execution-intelligence/package.json",
    "40_Develop/execution-intelligence/src",
    "template/tools",
    "README.md",
  ]) {
    const source = path.join(repositoryRoot, ...relative.split("/"));
    const target = path.join(distributionRoot, ...relative.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.cpSync(source, target, { recursive: true });
  }
  fs.rmSync(
    path.join(
      distributionRoot,
      "template",
      "tools",
      "coordinator",
      "coordinator-package-manifest.json",
    ),
    { force: true },
  );
  const oracleRoot = path.join(root, "oracle");
  fs.cpSync(distributionRoot, oracleRoot, { recursive: true });
  function git(...args: string[]) {
    const result = spawnSync("git", ["-C", oracleRoot, ...args], {
      encoding: "utf8",
      shell: false,
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  }
  git("init", "--quiet");
  git("-c", "core.autocrlf=false", "add", "--force", "--", ".");
  const expectedCrddTree = git("write-tree");
  const observed =
    inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
      distributionRoot,
    );
  assert.equal(observed.status, "candidate", JSON.stringify(observed));
  if (omittedEntrypoint)
    fs.unlinkSync(path.join(packageRoot, omittedEntrypoint));
  return {
    root,
    distributionRoot,
    packageRoot,
    input: {
      distributionRoot,
      expectedPackageContentRootSha256: observed.packageContentRootSha256,
    },
    expectedCrddTree,
    cleanup() {
      removeDevelopmentFixture(root);
    },
  };
}

test("開発版はRuntime依存閉包を実体照合し、署名・実行Authorityを発行しない", () => {
  const fixture = developmentFixture();
  try {
    const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(result.status, "candidate", JSON.stringify(result));
    assert.equal(result.executionSourceKind, "fixed_development_candidate");
    assert.equal(result.entrypoints.length, 5);
    assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
    assert.equal(result.releaseIdentityRuntimeOwned, false);
    assert.equal(result.crddDistributionConfirmed, false);
    assert.equal(result.runtimeCapabilityIssued, false);
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.filesystemEffectIssued, false);
    assert.equal(result.networkEffectIssued, false);
    assert.equal(JSON.stringify(result).includes(fixture.root), false);
    const repeated = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(repeated.status, "candidate");
    assert.equal(repeated.sourceIdentitySha256, result.sourceIdentitySha256);
    const previousRoot = path.join(fixture.root, "previous");
    fs.renameSync(fixture.distributionRoot, previousRoot);
    fs.cpSync(previousRoot, fixture.distributionRoot, { recursive: true });
    const replaced = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(replaced.status, "candidate");
    assert.notEqual(replaced.sourceIdentitySha256, result.sourceIdentitySha256);
  } finally {
    fixture.cleanup();
  }
});

test("実行能力を持たないchild_processのtype-only importはRuntime候補を失効させない", () => {
  const fixture = developmentFixture();
  try {
    fs.appendFileSync(
      path.join(
        fixture.packageRoot,
        "src",
        "security",
        "candidate-store-kernel-lock.ts",
      ),
      [
        'import type { ChildProcess } from "node:child_process";',
        'import { type SpawnOptions } from "node:child_process";',
        'export type { ChildProcessWithoutNullStreams } from "node:child_process";',
        'export { type WorkerOptions } from "node:worker_threads";',
        "export type FixtureChild = ChildProcess;",
        "export type FixtureOptions = SpawnOptions;",
        "",
      ].join("\n"),
    );
    const result =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
        fixture.distributionRoot,
      );
    assert.equal(result.status, "candidate", JSON.stringify(result));
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.effectAuthorizationIssued, false);
  } finally {
    fixture.cleanup();
  }
});

test("type-only star再公開は実行能力として扱わず、value star再公開だけを拒否する", () => {
  assert.doesNotThrow(() =>
    assertRuntimeSourceModuleBoundaryForVerification(
      "src/index.ts",
      [
        'export type * from "node:child_process";',
        'export type * as ChildTypes from "node:child_process";',
        'export type * from "node:worker_threads";',
        'import { type Module } from "node:module";',
        'export { type Module as NodeModule } from "node:module";',
        "",
      ].join("\n"),
    ),
  );
  assert.throws(
    () =>
      assertRuntimeSourceModuleBoundaryForVerification(
        "src/index.ts",
        'export * from "node:child_process";\n',
      ),
    /runtime_dependency_child_process_unbound/u,
  );
});

test("loader能力のnamespace・bracket取得と文字列再構成を直接の理由で拒否する", () => {
  for (const source of [
    'import * as moduleBuiltin from "node:module"; void moduleBuiltin.createRequire;\n',
    'import moduleBuiltin from "node:module"; void moduleBuiltin;\n',
    'export { createRequire } from "node:module";\n',
    'void process["getBuiltinModule"]?.("node:child_process");\n',
    'void process?.["getBuiltinModule"]?.("node:child_process");\n',
    'void import(["node:", "child_", "process"].join(""));\n',
  ]) {
    assert.throws(
      () =>
        assertRuntimeSourceModuleBoundaryForVerification(
          "src/security/loader-attack.ts",
          source,
        ),
      /runtime_dependency_(?:child_process|loader)_unbound/u,
    );
  }
});

test("宣言済みProcess利用側は実ソースのcall・scope・引数から完全一致を要求する", () => {
  const sourcePath = "src/security/candidate-store-windows-adapter.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  for (const mutated of [
    source.replace(
      "spawnSync(selectedExecutable, [], {",
      "spawnSync(selectedExecutable || process.argv0, [], {",
    ),
    source.replace('import { spawnSync } from "node:child_process";', ""),
    source.replace(
      "spawnSync(selectedExecutable, [], {",
      "spawnSync((selectedExecutable = process.argv0), [], {",
    ),
    source
      .replace(
        "const selectedExecutable =",
        "if (false) { const selectedExecutable =",
      )
      .replace(
        "const execution = spawnSync(selectedExecutable, [], {",
        "}\n  const execution = spawnSync(selectedExecutable, [], {",
      ),
  ]) {
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          mutated,
        ),
      /runtime_dependency_child_process_unbound/u,
    );
  }
});

test("検証Toolの全Sourceと実Process起動点を独立グラフとして完全一致させる", () => {
  const sources = verificationToolSources();
  assert.doesNotThrow(() =>
    assertVerificationToolCapabilityGraphForVerification(sources),
  );

  const missing = { ...sources };
  delete missing["scripts/check-dynamic-fake-provider-coverage.ts"];
  assert.throws(
    () => assertVerificationToolCapabilityGraphForVerification(missing),
    /runtime_dependency_capability_graph_mismatch/u,
  );

  const changedOptions = { ...sources };
  changedOptions["scripts/check-dynamic-fake-provider-coverage.ts"] =
    sources["scripts/check-dynamic-fake-provider-coverage.ts"]?.replace(
      "timeout: 120_000,",
      "timeout: 1,",
    ) ?? "";
  assert.throws(
    () => assertVerificationToolCapabilityGraphForVerification(changedOptions),
    /runtime_dependency_child_process_unbound/u,
  );

  const unknown = { ...sources };
  unknown["scripts/nested/unregistered-process.ts"] =
    'import { spawnSync } from "node:child_process";\nspawnSync(process.execPath, ["--version"], { shell: false });\n';
  assert.throws(
    () => assertVerificationToolCapabilityGraphForVerification(unknown),
    /runtime_dependency_child_process_unbound/u,
  );

  const loaderResultReplaced = { ...sources };
  loaderResultReplaced["scripts/verify-project-runtime-real-providers.ts"] =
    sources["scripts/verify-project-runtime-real-providers.ts"]?.replace(
      "const native =\n    nativeModule.verifyBundledCoordinatorPackageFromFixedManifestCandidate({",
      'const native = Object.freeze({ status: "candidate", reason: "decoy" });\n    void nativeModule.verifyBundledCoordinatorPackageFromFixedManifestCandidate({',
    ) ?? "";
  assert.throws(
    () =>
      assertVerificationToolCapabilityGraphForVerification(
        loaderResultReplaced,
      ),
    /runtime_dependency_capability_flow_unbound/u,
  );
});

test("Process wrapper注入後のproperty callと内部lifecycle callを利用側閉包へ含める", () => {
  const dockerPath = "src/security/docker-effect-runtime.ts";
  const dockerSource = fs.readFileSync(
    path.join(coordinatorRoot, dockerPath),
    "utf8",
  );
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        dockerPath,
        dockerSource.replace(
          "dependencies.startProcess(\n      DOCKER_CLI_EXECUTABLE,",
          "dependencies.startProcess(\n      process.execPath,",
        ),
      ),
    /runtime_dependency_child_process_unbound/u,
  );

  const lifecyclePath = "src/core/interactive-console.ts";
  const lifecycleSource = fs.readFileSync(
    path.join(coordinatorRoot, lifecyclePath),
    "utf8",
  );
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        lifecyclePath,
        lifecycleSource.replace(
          "runInteractiveConsoleReaderLifecycle(",
          "Promise.resolve(",
        ),
      ),
    /runtime_dependency_child_lifecycle_unbound/u,
  );
  assert.throws(
    () =>
      assertRuntimeSourceDeclaredGraphBoundaryForVerification(
        lifecyclePath,
        lifecycleSource.replace(
          "return runInteractiveConsoleReaderLifecycle(",
          "if (false) return runInteractiveConsoleReaderLifecycle(",
        ),
      ),
    /runtime_dependency_capability_flow_unbound/u,
  );
});

test("非同期子Processは同期完了・所有保持・lifecycle移管のいずれかを証明する", () => {
  const cases = [
    {
      path: "src/core/runtime-local-typescript-child-entrypoints.ts",
      mutate: (source: string) =>
        source.replace(
          "return spawn(process.execPath,",
          "spawn(process.execPath,",
        ),
    },
    {
      path: "src/security/docker-owned-process.ts",
      mutate: (source: string) =>
        source.replace('child.once("spawn",', 'child.on("spawn",'),
    },
    {
      path: "src/security/docker-desktop-repair-native-helper.ts",
      mutate: (source: string) =>
        source.replace("const created =", "const ignored ="),
    },
  ];
  for (const target of cases) {
    const source = fs.readFileSync(
      path.join(coordinatorRoot, target.path),
      "utf8",
    );
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          target.path,
          target.mutate(source),
        ),
      /runtime_dependency_child_process_ownership_unbound/u,
    );
  }
});

test("配布観測から開発・署名・導入・Capability利用側までを実ソースから閉じる", () => {
  const sourcePath = "src/security/platform-provisioner-package-filesystem.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  for (const mutated of [
    source.replace(
      "const observed = observeRuntimeDistribution(root.realPath);",
      "const observed = observePackage(root.realPath);",
    ),
    source.replace(
      "const reverified = verifyInstalledCoordinatorPackageCandidate(request);",
      "const reverified = release;",
    ),
    source.replace(
      "const verification =\n    verifyBundledCoordinatorPackageFromFixedManifestCandidate(input);",
      "const verification = verifyBundledCoordinatorPackageCandidate(input);",
    ),
    source
      .replace(
        "const observed = observeRuntimeDistribution(root.realPath);",
        "const observed = observePackage(root.realPath);",
      )
      .replace(
        "const manifestPath = path.join(",
        "void observeRuntimeDistribution(root.realPath);\n    const manifestPath = path.join(",
      ),
  ]) {
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          mutated,
        ),
      /runtime_dependency_(?:public_consumer|capability_flow)_unbound/u,
    );
  }
});

test("Runtime Package Capabilityの宣言集合と全実利用側を完全一致させる", () => {
  const sources = runtimeTypeScriptSources();
  assert.doesNotThrow(() =>
    assertRuntimePackageCapabilityConsumerGraphForVerification(sources),
  );

  const missing = { ...sources };
  missing["src/composition/project-runtime-composition-root.ts"] =
    sources["src/composition/project-runtime-composition-root.ts"]?.replace(
      "revokeRuntimeExecutionAuthorization:\n      revokeRuntimeOwnedVerifiedCoordinatorPackageCapability,",
      "revokeRuntimeExecutionAuthorization: () => false,",
    ) ?? "";
  assert.throws(
    () => assertRuntimePackageCapabilityConsumerGraphForVerification(missing),
    /runtime_dependency_consumer_graph_mismatch/u,
  );

  const additional = { ...sources };
  additional["src/security/coordinator-task-runtime.ts"] =
    sources["src/security/coordinator-task-runtime.ts"]?.replace(
      "!consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(",
      "!consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(consumeRuntimeOwnedVerifiedCoordinatorPackageCapability({}),) && !consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(",
    ) ?? "";
  assert.throws(
    () =>
      assertRuntimePackageCapabilityConsumerGraphForVerification(additional),
    /runtime_dependency_consumer_graph_mismatch/u,
  );
});

test("旧修復と新再起動のRuntime Identityは所有関数ごとにCanonical検証値を要求する", () => {
  const sources = runtimeTypeScriptSources();
  const sourcePath = "src/security/docker-recovery-runtime-internal.ts";
  const source = sources[sourcePath];
  assert.ok(source);
  for (const owner of [
    "recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart",
    "prepareRuntimeOwnedDockerRestart",
    "recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart",
  ]) {
    const start = source.indexOf(`export function ${owner}(`);
    assert.ok(start >= 0);
    const suffix = source.slice(start);
    const altered =
      source.slice(0, start) +
      suffix.replace(
        /runtimeExecutionIdentitySha256:\s*verification\.runtimeExecutionIdentitySha256/u,
        "runtimeExecutionIdentitySha256: callerIdentity",
      );
    assert.notEqual(altered, source);
    assert.throws(
      () =>
        assertRuntimePackageCapabilityConsumerGraphForVerification({
          ...sources,
          [sourcePath]: altered,
        }),
      /assurance_consumer:recovery_runtime_identity:shape/u,
    );
  }
});

test("実行能力の反証は利用側伝播の意図したphaseで拒否する", () => {
  const sources = runtimeTypeScriptSources();
  const cases = [
    {
      phase: "consumer_import",
      path: "src/composition/project-runtime-composition-root.ts",
      from: "issueRuntimeOwnedVerifiedCoordinatorPackageCapability,",
      to: "issueRuntimeOwnedVerifiedCoordinatorPackageCapability as issueCapability,",
    },
    {
      phase: "consumer_handoff",
      path: "src/security/project-runtime-execution-authorization-adapter.ts",
      from: "value: capability,",
      to: "value: { ...capability },",
    },
    {
      phase: "consumer_handoff",
      path: "src/security/project-runtime-execution-authorization-adapter.ts",
      from: 'reason: "project_runtime_execution_authorization_revoked",\n              value: null,',
      to: 'reason: "project_runtime_execution_authorization_revoked",\n              value: capability,',
    },
    {
      phase: "consumer_handoff",
      path: "40_Develop/project-runtime/src/application/project-runtime-execution.ts",
      from: "? issuedAuthorization.value\n              : null;",
      to: "? {}\n              : null;",
    },
    {
      phase: "consumer_handoff",
      path: "40_Develop/project-runtime/src/application/project-runtime-execution.ts",
      from: "runtimeExecutionCapability,\n            taskRequest:",
      to: "runtimeExecutionCapability: {},\n            taskRequest:",
    },
    {
      phase: "consumer_import",
      path: "src/security/coordinator-task-runtime.ts",
      from: "!consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(\n      verifiedPackageCapability,",
      to: "!decoy.consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(\n      verifiedPackageCapability,",
    },
    {
      phase: "consumer_handoff",
      path: "src/security/coordinator-task-runtime.ts",
      from: "  if (\n    !consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(",
      to: "  void productionRuntime.start(rawRequest, repositoryRoot, new Date().toISOString(), recoveryCorrelationId);\n  if (\n    !consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(",
    },
    {
      phase: "assurance_consumer",
      path: "scripts/promote-release-manifest.ts",
      from: "expectedRelease: release.expected,",
      to: "expectedRelease: { ...release.expected },",
    },
    {
      phase: "assurance_consumer",
      path: "scripts/promote-release-manifest.ts",
      from: "sourceCommit: release.expected.crddCommit,",
      to: "sourceCommit: release.expected.crddTree,",
    },
    {
      phase: "assurance_consumer",
      path: "src/security/docker-recovery-runtime-internal.ts",
      from: "crddManifestHash: verification.manifestHash,",
      to: 'crddManifestHash: "forged",',
    },
    {
      phase: "assurance_consumer",
      path: "src/security/docker-recovery-runtime-internal.ts",
      from: "runtimeExecutionIdentitySha256:\n          verification.runtimeExecutionIdentitySha256,",
      to: 'runtimeExecutionIdentitySha256: "forged",',
    },
  ] as const;
  for (const scenario of cases) {
    const mutated = { ...sources };
    const before = mutated[scenario.path] ?? "";
    mutated[scenario.path] = before.replace(scenario.from, scenario.to);
    assert.notEqual(mutated[scenario.path], before, scenario.path);
    const result =
      runtimePackageCapabilityConsumerGraphDiagnosticForVerification(mutated);
    assert.equal(result.status, "blocked");
    assert.equal(result.phase, scenario.phase, result.reason);
    assert.equal(
      result.publicReason,
      "platform_provisioner_runtime_dependency_consumer_graph_mismatch",
    );
    assert.equal(result.runtimeExecution, "not_performed");
    assert.throws(
      () => assertRuntimePackageCapabilityConsumerGraphForVerification(mutated),
      /platform_provisioner_runtime_dependency_consumer_graph_mismatch/u,
    );
  }
});

test("署名入口は配布観測結果を秘密入力前の検査と署名結果へ同じflowで伝播する", () => {
  const source = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertReleaseSigningConsumerClosureForVerification(source),
  );
  for (const mutated of [
    source.replace(
      "preflightReleaseManifest(options);",
      "void preflightReleaseManifest;",
    ),
    source.replace(
      "packageContentRootSha256: packageObservation.packageContentRootSha256,",
      "packageContentRootSha256: compiled.payload.packageContentRootSha256,",
    ),
    source.replace(
      'const passphrase = await readHiddenLine("Release key passphrase: ");',
      'const passphrase = "not-observed";',
    ),
    source.replace(
      "compilePlatformProvisionerManifestPayloadCandidate,",
      "compilePlatformProvisionerManifestPayloadCandidate as compilePayload,",
    ),
    source.replace(
      'signature: signature.toString("base64url"),',
      'signature: "forged",',
    ),
    source.replace(
      "payload: compiled.payload,",
      "payload: { ...compiled.payload },",
    ),
  ])
    assert.throws(
      () => assertReleaseSigningConsumerClosureForVerification(mutated),
      /runtime_dependency_signing_consumer_unbound/u,
    );
});

test("署名の保護対象flowを同名decoy・事前Effect・条件付き証明で迂回できない", () => {
  const source = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "utf8",
  );
  const mutations = [
    `function main() {}\n${source}`,
    `function decoy() { function signReleaseManifest() {} }\n${source}`,
    `await main();\n${source}`,
    `readHiddenLine("before-main");\n${source}`,
    `fs["readFileSync"]("before-main");\n${source}`,
    `Reflect.get(fs, "readFileSync")("before-main");\n${source}`,
    `class BeforeMain { static value = readHiddenLine("before-main"); }\n${source}`,
    `[0].map(() => readHiddenLine("before-main"));\n${source}`,
    source.replace(
      "async function main() {",
      'async function main(value = readHiddenLine("before-main")) {',
    ),
    source.replace(
      "preflightReleaseManifest(options);",
      "if (false) preflightReleaseManifest(options);",
    ),
  ];
  for (const mutated of mutations)
    assert.throws(
      () => assertReleaseSigningConsumerClosureForVerification(mutated),
      /runtime_dependency_signing_consumer_unbound/u,
    );
});

test("署名の反証は意図した保護phaseで最初に拒否しEffect経路へ到達させない", () => {
  const source = fs.readFileSync(
    path.join(coordinatorRoot, "scripts", "sign-release-manifest.ts"),
    "utf8",
  );
  const cases = [
    {
      phase: "binding_use",
      mutate: (value: string) =>
        value.replace(
          "async function main() {",
          "async function main() {\n  const readHiddenLine = () => Promise.resolve('forged');",
        ),
    },
    {
      phase: "binding_use",
      mutate: (value: string) =>
        `class HiddenPrompt { static value = readHiddenLine('forged'); }\n${value}`,
    },
    {
      phase: "call_graph",
      mutate: (value: string) =>
        value.replace(
          "const preflight = preflightReleaseManifest(options);",
          "const preflight = false ? preflightReleaseManifest(options) : preflightReleaseManifest(options);",
        ),
    },
    {
      phase: "binding_use",
      mutate: (value: string) =>
        value.replace(
          "const preflight = preflightReleaseManifest(options);",
          "const early = await readHiddenLine('early');\n  void early;\n  const preflight = preflightReleaseManifest(options);",
        ),
    },
    {
      phase: "call_graph",
      mutate: (value: string) =>
        value.replace(
          "preflight.authorization, passphrase",
          "{ ...preflight.authorization }, passphrase",
        ),
    },
  ] as const;
  for (const scenario of cases) {
    const mutated = scenario.mutate(source);
    assert.notEqual(mutated, source);
    const result =
      releaseSigningProtectedPathDiagnosticForVerification(mutated);
    assert.equal(result.status, "blocked");
    assert.equal(result.phase, scenario.phase, result.reason);
    assert.equal(
      result.publicReason,
      "platform_provisioner_runtime_dependency_signing_consumer_unbound",
    );
    assert.equal(result.runtimeExecution, "not_performed");
    assert.throws(
      () => assertReleaseSigningConsumerClosureForVerification(mutated),
      /platform_provisioner_runtime_dependency_signing_consumer_unbound/u,
    );
  }
});

test("公開結果はCanonical観測値を欠落・再解釈・混合せず投影する", () => {
  const sourcePath = "src/security/platform-provisioner-package-filesystem.ts";
  const source = fs.readFileSync(
    path.join(coordinatorRoot, sourcePath),
    "utf8",
  );
  assert.doesNotThrow(() =>
    assertRuntimeSourceDeclaredGraphBoundaryForVerification(sourcePath, source),
  );
  for (const mutated of [
    source.replace(
      "packageName: observed.observation.packageName,",
      "packageName: observed.observation.packageVersion,",
    ),
    source.replace(
      "packageContentRootSha256: observed.contentRoot.packageContentRootSha256,",
      'packageContentRootSha256: observed.contentRoot.packageContentRootSha256 ?? "",',
    ),
    source.replace(
      "packageByteLength: observed.packageByteLength,",
      "packageByteLength: observed.packageByteLength, additional: true,",
    ),
  ])
    assert.throws(
      () =>
        assertRuntimeSourceDeclaredGraphBoundaryForVerification(
          sourcePath,
          mutated,
        ),
      /runtime_dependency_capability_flow_unbound/u,
    );
});

test("利用者向けCoordinatorまたはMCP Launcherの欠落をRuntime候補として受理しない", () => {
  for (const launcher of ["crdd-coordinator.ts", "crdd-mcp.ts"]) {
    const fixture = developmentFixture();
    try {
      fs.unlinkSync(
        path.join(fixture.distributionRoot, "template", "tools", launcher),
      );
      const result =
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
          fixture.distributionRoot,
        );
      assert.equal(result.status, "blocked");
      assert.equal(result.runtimeAuthorityConferred, false);
    } finally {
      fixture.cleanup();
    }
  }
});

test("Tree一致だけで起動entrypointの不足を受理しない", () => {
  const fixture = developmentFixture("src/core/interactive-console-reader.ts");
  try {
    const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "development_package_observation_failed");
  } finally {
    fixture.cleanup();
  }
});

test("新しいlocal TypeScript子entrypoint宣言の必須Registry登録漏れを受理しない", () => {
  const fixture = developmentFixture();
  try {
    fs.appendFileSync(
      path.join(
        fixture.packageRoot,
        "src",
        "core",
        "runtime-local-typescript-child-entrypoints.ts",
      ),
      'declareLocalTypeScriptChildEntrypoint("candidate_store_lock_worker", "worker", "../security/unregistered-child.ts", import.meta.url,);\n',
    );
    fs.writeFileSync(
      path.join(
        fixture.packageRoot,
        "src",
        "security",
        "unregistered-child.ts",
      ),
      "export {};\n",
    );
    const result =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
        fixture.distributionRoot,
      );
    assert.equal(result.status, "blocked");
    assert.equal(result.runtimeAuthorityConferred, false);
    assert.equal(result.effectAuthorizationIssued, false);
  } finally {
    fixture.cleanup();
  }
});

for (const scenario of [
  "variable_declaration",
  "template_declaration",
  "direct_url",
  "direct_worker",
  "direct_process_exec",
  "registered_without_declaration",
  "declared_without_use",
  "use_without_declaration",
  "variable_use",
  "template_use",
  "duplicate_path",
  "wrong_wrapper_kind",
  "worker_namespace",
  "worker_dynamic_import",
  "bare_worker_threads",
  "same_name_local_function",
  "wrapper_alias_import",
  "wrapper_reexport",
  "wrapper_function_value",
  "process_alias",
  "reflect_exec_path",
  "concatenated_url",
  "observer_projection_import",
  "recovery_direct_spawn",
  "old_caller_factory",
  "direct_fork",
  "process_argv0",
  "process_argv_index_zero",
  "process_argv_at_zero",
  "literal_node",
  "literal_node_exe",
  "worker_reexport",
  "worker_require",
  "wrapper_type_import",
  "query_specifier",
  "fragment_specifier",
  "percent_encoded_specifier",
  "child_process_reexport_bridge",
  "child_process_require",
  "fork_function_value",
  "fork_parenthesized",
  "fork_call",
  "fork_apply",
  "fork_bind",
  "fork_reflect_apply",
  "parenthesized_node_target",
  "optional_node_target",
  "node_variable_target",
  "argv0_variable_target",
  "query_process_target",
  "fragment_process_target",
  "percent_process_target",
  "encoded_separator_process_target",
  "unused_unknown_owner_spawn",
  "unused_known_owner_primitive",
  "unused_fork_import",
  "immediate_create_require",
  "parenthesized_loader",
  "loader_call",
  "process_builtin_loader",
  "worker_process_builtin_loader",
  "bracket_argv0_allowed_owner",
  "bracket_argv_index_allowed_owner",
  "internal_lifecycle_sibling_import",
  "internal_lifecycle_reexport",
  "internal_lifecycle_dynamic_import",
  "internal_lifecycle_alias_import",
  "escaped_child_process_specifier",
  "template_worker_threads_specifier",
  "optional_bracket_argv0_allowed_owner",
  "semicolonless_value_reexport",
  "concatenated_dynamic_import",
  "create_require_namespace",
  "start_owned_process_sibling_import",
  "absolute_node_allowed_owner",
] as const) {
  test(`local TypeScript子entrypointの宣言・利用迂回を拒否する: ${scenario}`, () => {
    const fixture = developmentFixture();
    try {
      const declarationModule = path.join(
        fixture.packageRoot,
        "src",
        "core",
        "runtime-local-typescript-child-entrypoints.ts",
      );
      const consumer = path.join(
        fixture.packageRoot,
        "src",
        "security",
        "candidate-store-kernel-lock.ts",
      );
      if (scenario === "variable_declaration")
        fs.appendFileSync(
          declarationModule,
          'const extraChild = "../security/unregistered-child.ts"; declareLocalTypeScriptChildEntrypoint("candidate_store_lock_worker", "worker", extraChild, import.meta.url);\n',
        );
      if (scenario === "template_declaration")
        fs.appendFileSync(
          declarationModule,
          'declareLocalTypeScriptChildEntrypoint("candidate_store_lock_worker", "worker", `../security/unregistered-child.ts`, import.meta.url);\n',
        );
      if (scenario === "direct_url")
        fs.appendFileSync(
          consumer,
          'new URL("./unregistered-child.ts", import.meta.url);\n',
        );
      if (scenario === "direct_worker")
        fs.appendFileSync(
          consumer,
          'import { Worker as ThreadWorker } from "node:worker_threads"; new ThreadWorker(new URL("./unregistered-child.ts", import.meta.url));\n',
        );
      if (scenario === "direct_process_exec")
        fs.appendFileSync(
          consumer,
          'spawn(process["execPath"], ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "registered_without_declaration") {
        const source = fs.readFileSync(declarationModule, "utf8");
        fs.writeFileSync(
          declarationModule,
          source.replace(
            [
              "  declareLocalTypeScriptChildEntrypoint(",
              '    "host_operation_lock_supervisor",',
              '    "spawn",',
              '    "../security/host-operation-lock-supervisor.ts",',
              "    import.meta.url,",
              "  ),",
              "",
            ].join("\n"),
            "",
          ),
        );
        assert.notEqual(
          fs.readFileSync(declarationModule, "utf8"),
          source,
          scenario,
        );
      }
      if (scenario === "declared_without_use") {
        const source = fs.readFileSync(consumer, "utf8");
        fs.writeFileSync(
          consumer,
          source.replace(
            '      "host_operation_lock_supervisor",',
            '      "candidate_store_lock_worker",',
          ),
        );
        assert.notEqual(fs.readFileSync(consumer, "utf8"), source, scenario);
      }
      if (scenario === "use_without_declaration") {
        const source = fs.readFileSync(declarationModule, "utf8");
        fs.writeFileSync(
          declarationModule,
          source.replace(
            [
              "  declareLocalTypeScriptChildEntrypoint(",
              '    "host_operation_lock_supervisor",',
              '    "spawn",',
              '    "../security/host-operation-lock-supervisor.ts",',
              "    import.meta.url,",
              "  ),",
              "",
            ].join("\n"),
            "",
          ),
        );
        assert.notEqual(
          fs.readFileSync(declarationModule, "utf8"),
          source,
          scenario,
        );
      }
      if (scenario === "variable_use")
        fs.appendFileSync(
          consumer,
          'const childRole = "candidate_store_lock_worker"; createRuntimeLocalTypeScriptWorker(childRole, {});\n',
        );
      if (scenario === "template_use")
        fs.appendFileSync(
          consumer,
          "createRuntimeLocalTypeScriptWorker(`candidate_store_lock_worker`, {});\n",
        );
      if (scenario === "duplicate_path") {
        const source = fs.readFileSync(declarationModule, "utf8");
        fs.writeFileSync(
          declarationModule,
          source.replace(
            '"./interactive-console-reader.ts"',
            '"../security/host-operation-lock-supervisor.ts"',
          ),
        );
      }
      if (scenario === "wrong_wrapper_kind")
        fs.appendFileSync(
          consumer,
          'spawnRuntimeLocalTypeScriptChild(spawn, "candidate_store_lock_worker", [], {});\n',
        );
      if (scenario === "worker_namespace")
        fs.appendFileSync(
          consumer,
          'import * as threads from "node:worker_threads"; new threads.Worker("./unregistered-child.ts");\n',
        );
      if (scenario === "worker_dynamic_import")
        fs.appendFileSync(
          consumer,
          'const threads = await import("node:worker_threads"); new threads.Worker("./unregistered-child.ts");\n',
        );
      if (scenario === "bare_worker_threads")
        fs.appendFileSync(
          consumer,
          'import { Worker } from "worker_threads"; new Worker("./unregistered-child.ts");\n',
        );
      if (scenario === "same_name_local_function")
        fs.appendFileSync(
          consumer,
          "function createRuntimeLocalTypeScriptWorker() {}\n",
        );
      if (scenario === "wrapper_alias_import")
        fs.appendFileSync(
          consumer,
          'import { createRuntimeLocalTypeScriptWorker as createWorker } from "../core/runtime-local-typescript-child-entrypoints.ts"; createWorker("candidate_store_lock_worker", {});\n',
        );
      if (scenario === "wrapper_reexport")
        fs.appendFileSync(
          consumer,
          'export { createRuntimeLocalTypeScriptWorker } from "../core/runtime-local-typescript-child-entrypoints.ts";\n',
        );
      if (scenario === "wrapper_function_value")
        fs.appendFileSync(
          consumer,
          "const factory = createRuntimeLocalTypeScriptWorker; void factory;\n",
        );
      if (scenario === "process_alias")
        fs.appendFileSync(
          consumer,
          'const runtimeProcess = process; spawn(runtimeProcess.execPath, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "reflect_exec_path")
        fs.appendFileSync(
          consumer,
          'spawn(Reflect.get(process, "execPath"), ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "concatenated_url")
        fs.appendFileSync(
          consumer,
          'new URL("./unregistered-child." + "ts", import.meta.url);\n',
        );
      if (scenario === "observer_projection_import")
        fs.appendFileSync(
          consumer,
          'import { runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver } from "../core/runtime-local-typescript-child-entrypoints.ts"; runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver();\n',
        );
      if (scenario === "recovery_direct_spawn")
        fs.appendFileSync(
          path.join(
            fixture.packageRoot,
            "scripts",
            "verify-signed-recovery-matrix.ts",
          ),
          'spawn(process.execPath, ["./verify-signed-recovery-matrix.ts"]);\n',
        );
      if (scenario === "old_caller_factory")
        fs.appendFileSync(
          consumer,
          'spawnRuntimeLocalTypeScriptChild(spawn, "host_operation_lock_supervisor", [], {});\n',
        );
      if (scenario === "direct_fork")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; fork("./unregistered-child.ts");\n',
        );
      if (scenario === "process_argv0")
        fs.appendFileSync(
          consumer,
          'import { spawn } from "node:child_process"; spawn(process.argv0, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "process_argv_index_zero")
        fs.appendFileSync(
          consumer,
          'import { spawn } from "node:child_process"; spawn(process.argv[0], ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "process_argv_at_zero")
        fs.appendFileSync(
          consumer,
          'import { spawn } from "node:child_process"; spawn(process.argv.at(0), ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "literal_node")
        fs.appendFileSync(
          consumer,
          'import { spawn } from "node:child_process"; spawn("node", ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "literal_node_exe")
        fs.appendFileSync(
          consumer,
          'import { execFile } from "node:child_process"; execFile("node.exe", ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "worker_reexport")
        fs.appendFileSync(
          consumer,
          'export { Worker } from "node:worker_threads";\n',
        );
      if (scenario === "worker_require")
        fs.appendFileSync(
          consumer,
          'const threads = require("node:worker_threads"); void threads.Worker;\n',
        );
      if (scenario === "wrapper_type_import")
        fs.appendFileSync(
          consumer,
          'import { type createRuntimeLocalTypeScriptWorker } from "../core/runtime-local-typescript-child-entrypoints.ts";\n',
        );
      if (scenario === "query_specifier")
        fs.appendFileSync(consumer, 'import "./unregistered-child.ts?raw";\n');
      if (scenario === "fragment_specifier")
        fs.appendFileSync(
          consumer,
          'import "./unregistered-child.ts#child";\n',
        );
      if (scenario === "percent_encoded_specifier")
        fs.appendFileSync(consumer, 'import "./unregistered%2Dchild.ts";\n');
      if (scenario === "child_process_reexport_bridge") {
        fs.writeFileSync(
          path.join(fixture.packageRoot, "src", "security", "child-bridge.ts"),
          'export { spawn as launch } from "node:child_process";\n',
        );
        fs.appendFileSync(
          consumer,
          'import { launch } from "./child-bridge.ts"; launch(process.argv0, ["./unregistered-child.ts"]);\n',
        );
      }
      if (scenario === "child_process_require")
        fs.appendFileSync(
          consumer,
          'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); const child = load("node:child_process"); child.spawn(process.argv0, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "fork_function_value")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; const launch = fork; void launch;\n',
        );
      if (scenario === "fork_parenthesized")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; (fork)("./unregistered-child.ts");\n',
        );
      if (scenario === "fork_call")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; fork.call(undefined, "./unregistered-child.ts");\n',
        );
      if (scenario === "fork_apply")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; fork.apply(undefined, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "fork_bind")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; const launch = fork.bind(undefined); void launch;\n',
        );
      if (scenario === "fork_reflect_apply")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process"; Reflect.apply(fork, undefined, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "parenthesized_node_target")
        fs.appendFileSync(
          declarationModule,
          'spawn((process.argv0), ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "optional_node_target")
        fs.appendFileSync(
          declarationModule,
          'spawn(process?.argv0, ["./unregistered-child.ts"]);\n',
        );
      if (scenario === "node_variable_target")
        fs.appendFileSync(
          declarationModule,
          'const unboundNodeTarget = "./unregistered-child.ts"; spawn("node", [unboundNodeTarget]);\n',
        );
      if (scenario === "argv0_variable_target")
        fs.appendFileSync(
          declarationModule,
          'const unboundArgvTarget = "./unregistered-child.ts"; spawn(process.argv0, [unboundArgvTarget]);\n',
        );
      if (
        [
          "query_process_target",
          "fragment_process_target",
          "percent_process_target",
          "encoded_separator_process_target",
        ].includes(scenario)
      ) {
        const target =
          scenario === "query_process_target"
            ? "./unregistered-child.ts?run"
            : scenario === "fragment_process_target"
              ? "./unregistered-child.ts#run"
              : scenario === "percent_process_target"
                ? "./unregistered-child.%74%73"
                : "./nested%2Funregistered-child.ts";
        fs.appendFileSync(
          declarationModule,
          `import { fileURLToPath } from "node:url"; spawn(process.argv0, [fileURLToPath(new URL("${target}", import.meta.url))]);\n`,
        );
      }
      if (scenario === "unused_unknown_owner_spawn")
        fs.appendFileSync(
          path.join(fixture.packageRoot, "src", "index.ts"),
          'import { spawn } from "node:child_process";\n',
        );
      if (scenario === "unused_known_owner_primitive")
        fs.appendFileSync(
          consumer,
          'import { execFile } from "node:child_process";\n',
        );
      if (scenario === "unused_fork_import")
        fs.appendFileSync(
          consumer,
          'import { fork } from "node:child_process";\n',
        );
      if (scenario === "immediate_create_require")
        fs.appendFileSync(
          consumer,
          'import { createRequire } from "node:module"; const child = createRequire(import.meta.url)("node:child_process"); void child;\n',
        );
      if (scenario === "parenthesized_loader")
        fs.appendFileSync(
          consumer,
          'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); const child = (load)("node:child_process"); void child;\n',
        );
      if (scenario === "loader_call")
        fs.appendFileSync(
          consumer,
          'import { createRequire } from "node:module"; const load = createRequire(import.meta.url); const child = load.call(undefined, "node:child_process"); void child;\n',
        );
      if (scenario === "process_builtin_loader")
        fs.appendFileSync(
          consumer,
          'const child = process.getBuiltinModule?.("node:child_process"); void child;\n',
        );
      if (scenario === "worker_process_builtin_loader")
        fs.appendFileSync(
          consumer,
          "const threads = process.getBuiltinModule?.(`node:worker_threads`); void threads;\n",
        );
      if (
        scenario === "bracket_argv0_allowed_owner" ||
        scenario === "bracket_argv_index_allowed_owner" ||
        scenario === "optional_bracket_argv0_allowed_owner"
      ) {
        const owner = path.join(
          fixture.packageRoot,
          "src",
          "security",
          "docker-owned-process.ts",
        );
        fs.writeFileSync(
          owner,
          [
            'import { spawn } from "node:child_process";',
            scenario === "bracket_argv0_allowed_owner"
              ? 'spawn(process["argv0"], ["./unregistered-child.ts"]);'
              : scenario === "bracket_argv_index_allowed_owner"
                ? 'spawn(process.argv["0"], ["./unregistered-child.ts"]);'
                : 'spawn(process?.["argv0"], ["./unregistered-child.ts"]);',
            "",
          ].join("\n"),
        );
        fs.appendFileSync(
          path.join(fixture.packageRoot, "src", "index.ts"),
          'import "./security/docker-owned-process.ts";\n',
        );
        fs.writeFileSync(
          path.join(
            fixture.packageRoot,
            "src",
            "security",
            "unregistered-child.ts",
          ),
          "export {};\n",
        );
      }
      if (
        [
          "internal_lifecycle_sibling_import",
          "internal_lifecycle_reexport",
          "internal_lifecycle_dynamic_import",
          "internal_lifecycle_alias_import",
        ].includes(scenario)
      ) {
        const sibling = path.join(
          fixture.packageRoot,
          "src",
          "security",
          "docker-owned-process.ts",
        );
        const importSource =
          scenario === "internal_lifecycle_reexport"
            ? 'export { runInteractiveConsoleReaderLifecycle } from "../core/interactive-console-reader-lifecycle-internal.ts";\n'
            : scenario === "internal_lifecycle_dynamic_import"
              ? 'void import("../core/interactive-console-reader-lifecycle-internal.ts");\n'
              : scenario === "internal_lifecycle_alias_import"
                ? 'import { runInteractiveConsoleReaderLifecycle as run } from "../core/interactive-console-reader-lifecycle-internal.ts"; void run;\n'
                : 'import { runInteractiveConsoleReaderLifecycle } from "../core/interactive-console-reader-lifecycle-internal.ts"; void runInteractiveConsoleReaderLifecycle;\n';
        fs.writeFileSync(sibling, importSource);
        fs.writeFileSync(
          path.join(
            fixture.packageRoot,
            "src",
            "core",
            "interactive-console-reader-lifecycle-internal.ts",
          ),
          "export function runInteractiveConsoleReaderLifecycle() {}\n",
        );
        fs.appendFileSync(
          path.join(fixture.packageRoot, "src", "index.ts"),
          'import "./security/docker-owned-process.ts";\n',
        );
      }
      if (scenario === "escaped_child_process_specifier")
        fs.appendFileSync(
          consumer,
          'const protectedModule = "node:\\u0063hild_process"; void protectedModule;\n',
        );
      if (scenario === "template_worker_threads_specifier")
        fs.appendFileSync(
          consumer,
          "const protectedModule = `node:worker_threads`; void protectedModule;\n",
        );
      if (scenario === "semicolonless_value_reexport")
        fs.appendFileSync(
          consumer,
          'import type { ChildProcess } from "node:child_process"\nexport { spawn } from "node:child_process"\n',
        );
      if (scenario === "concatenated_dynamic_import")
        fs.appendFileSync(
          consumer,
          'const protectedName = "node:" + "child_process"; void import(protectedName);\n',
        );
      if (scenario === "create_require_namespace")
        fs.appendFileSync(
          consumer,
          'import * as moduleBuiltin from "node:module"; const load = moduleBuiltin.createRequire(import.meta.url); void load("node:child_process");\n',
        );
      if (scenario === "start_owned_process_sibling_import") {
        fs.writeFileSync(
          path.join(
            fixture.packageRoot,
            "src",
            "security",
            "docker-owned-process.ts",
          ),
          "export function startOwnedProcess() {}\n",
        );
        fs.appendFileSync(
          consumer,
          'import { startOwnedProcess } from "./docker-owned-process.ts"; void startOwnedProcess;\n',
        );
      }
      if (scenario === "absolute_node_allowed_owner") {
        const owner = path.join(
          fixture.packageRoot,
          "src",
          "security",
          "docker-owned-process.ts",
        );
        fs.writeFileSync(
          owner,
          [
            'import { spawn } from "node:child_process";',
            'export function startOwnedProcess() { return spawn("C:\\\\Program Files\\\\nodejs\\\\node.exe", ["./unregistered-child.ts"]); }',
            "",
          ].join("\n"),
        );
        fs.appendFileSync(
          path.join(fixture.packageRoot, "src", "index.ts"),
          'import "./security/docker-owned-process.ts";\n',
        );
      }
      const directBoundaryExpectations = new Map<
        string,
        Readonly<{ relativePath: string; reason: RegExp }>
      >([
        [
          "unused_unknown_owner_spawn",
          {
            relativePath: "src/index.ts",
            reason: /runtime_dependency_child_process_unbound/u,
          },
        ],
        ...[
          "unused_known_owner_primitive",
          "unused_fork_import",
          "immediate_create_require",
          "parenthesized_loader",
          "loader_call",
          "process_builtin_loader",
          "escaped_child_process_specifier",
          "semicolonless_value_reexport",
          "concatenated_dynamic_import",
          "create_require_namespace",
          "start_owned_process_sibling_import",
        ].map(
          (name) =>
            [
              name,
              {
                relativePath: "src/security/candidate-store-kernel-lock.ts",
                reason: /runtime_dependency_child_process_unbound/u,
              },
            ] as const,
        ),
        [
          "absolute_node_allowed_owner",
          {
            relativePath: "src/security/docker-owned-process.ts",
            reason: /runtime_dependency_child_process_unbound/u,
          },
        ],
        ...[
          "worker_process_builtin_loader",
          "template_worker_threads_specifier",
        ].map(
          (name) =>
            [
              name,
              {
                relativePath: "src/security/candidate-store-kernel-lock.ts",
                reason: /runtime_dependency_child_worker_unbound/u,
              },
            ] as const,
        ),
        ...[
          "bracket_argv0_allowed_owner",
          "bracket_argv_index_allowed_owner",
          "optional_bracket_argv0_allowed_owner",
        ].map(
          (name) =>
            [
              name,
              {
                relativePath: "src/security/docker-owned-process.ts",
                reason: /runtime_dependency_child_process_unbound/u,
              },
            ] as const,
        ),
        ...[
          "internal_lifecycle_sibling_import",
          "internal_lifecycle_reexport",
          "internal_lifecycle_dynamic_import",
          "internal_lifecycle_alias_import",
        ].map(
          (name) =>
            [
              name,
              {
                relativePath: "src/security/docker-owned-process.ts",
                reason: /runtime_dependency_child_lifecycle_unbound/u,
              },
            ] as const,
        ),
      ]);
      const directExpectation = directBoundaryExpectations.get(scenario);
      if (directExpectation) {
        const source = fs.readFileSync(
          path.join(fixture.packageRoot, directExpectation.relativePath),
          "utf8",
        );
        assert.throws(
          () =>
            assertRuntimeSourceModuleBoundaryForVerification(
              directExpectation.relativePath,
              source,
            ),
          directExpectation.reason,
          scenario,
        );
      }
      if (
        scenario === "variable_declaration" ||
        scenario === "template_declaration" ||
        scenario === "direct_url" ||
        scenario === "child_process_reexport_bridge" ||
        scenario === "child_process_require" ||
        scenario === "fork_parenthesized" ||
        scenario === "fork_call" ||
        scenario === "fork_apply" ||
        scenario === "fork_bind" ||
        scenario === "fork_reflect_apply" ||
        scenario === "parenthesized_node_target" ||
        scenario === "optional_node_target" ||
        scenario === "node_variable_target" ||
        scenario === "argv0_variable_target" ||
        scenario === "query_process_target" ||
        scenario === "fragment_process_target" ||
        scenario === "percent_process_target" ||
        scenario === "encoded_separator_process_target"
      )
        fs.writeFileSync(
          path.join(
            fixture.packageRoot,
            "src",
            "security",
            "unregistered-child.ts",
          ),
          "export {};\n",
        );
      const result =
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
          fixture.distributionRoot,
        );
      assert.equal(result.status, "blocked", scenario);
      assert.equal(result.runtimeAuthorityConferred, false, scenario);
      assert.equal(result.effectAuthorizationIssued, false, scenario);
      if (directExpectation) {
        const fixed = inspectFixedDevelopmentCoordinatorPackageCandidate(
          fixture.input,
        );
        assert.equal(fixed.status, "blocked", scenario);
        assert.equal(fixed.runtimeAuthorityConferred, false, scenario);
      }
    } finally {
      fixture.cleanup();
    }
  });
}

test("内部lifecycleまたはProcess wrapperを正規leafから再転送しない", () => {
  const interactiveSource = fs.readFileSync(
    path.join(coordinatorRoot, "src", "core", "interactive-console.ts"),
    "utf8",
  );
  assert.throws(
    () =>
      assertRuntimeSourceModuleBoundaryForVerification(
        "src/core/interactive-console.ts",
        `${interactiveSource}\nexport { runInteractiveConsoleReaderLifecycle };\n`,
      ),
    /runtime_dependency_child_lifecycle_unbound/u,
  );

  const dockerEffectSource = fs.readFileSync(
    path.join(coordinatorRoot, "src", "security", "docker-effect-runtime.ts"),
    "utf8",
  );
  assert.throws(
    () =>
      assertRuntimeSourceModuleBoundaryForVerification(
        "src/security/docker-effect-runtime.ts",
        `${dockerEffectSource}\nconst leakedStartProcess = startOwnedProcess; void leakedStartProcess;\n`,
      ),
    /runtime_dependency_child_process_unbound/u,
  );
});

for (const target of ["package", "expected_package"] as const) {
  test(`開発版の${target}差替えを拒否する`, () => {
    const fixture = developmentFixture();
    try {
      const input = { ...fixture.input };
      if (target === "package")
        fs.appendFileSync(
          path.join(fixture.packageRoot, "bin", "coordinator.ts"),
          "// changed\n",
        );
      if (target === "expected_package")
        input.expectedPackageContentRootSha256 = "d".repeat(64);
      const result = inspectFixedDevelopmentCoordinatorPackageCandidate(input);
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, "development_package_identity_mismatch");
      assert.equal(result.runtimeAuthorityConferred, false);
    } finally {
      fixture.cleanup();
    }
  });
}

test("Runtime依存外の文書変更は開発Source Identityを失効させない", () => {
  const fixture = developmentFixture();
  try {
    const initial = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(initial.status, "candidate");
    fs.appendFileSync(
      path.join(fixture.distributionRoot, "README.md"),
      "changed\n",
    );
    const changed = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(changed.status, "candidate");
    assert.equal(changed.sourceIdentitySha256, initial.sourceIdentitySha256);
  } finally {
    fixture.cleanup();
  }
});

test("開発版へ混入した署名manifestをReleaseへ昇格しない", () => {
  const fixture = developmentFixture();
  try {
    const target = path.join(
      fixture.distributionRoot,
      "template/tools/coordinator/coordinator-package-manifest.json",
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "not a trusted artifact");
    const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "development_package_release_artifact_present");
  } finally {
    fixture.cleanup();
  }
});

for (const relativePath of [
  "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
]) {
  test(`開発Sourceと別に検証する${relativePath}をSource Identityへ混在させない`, () => {
    const fixture = developmentFixture();
    try {
      const target = path.join(fixture.distributionRoot, relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "not a trusted artifact");
      const result = inspectFixedDevelopmentCoordinatorPackageCandidate(
        fixture.input,
      );
      assert.equal(result.status, "candidate");
    } finally {
      fixture.cleanup();
    }
  });
}

test("開発版のRoot alias、入力getterと追加keyを拒否し、Git metadataだけをTreeから除外する", () => {
  const fixture = developmentFixture();
  try {
    let getterCalls = 0;
    const accessor = Object.defineProperty(
      { ...fixture.input },
      "expectedCrddTree",
      {
        get() {
          getterCalls += 1;
          return fixture.expectedCrddTree;
        },
      },
    );
    for (const input of [
      accessor,
      { ...fixture.input, extra: true },
      { ...fixture.input, distributionRoot: "relative" },
    ]) {
      assert.equal(
        inspectFixedDevelopmentCoordinatorPackageCandidate(input).status,
        "blocked",
      );
    }
    assert.equal(getterCalls, 0);
    const alias = path.join(fixture.root, "alias");
    fs.symlinkSync(
      fixture.distributionRoot,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.equal(
      inspectFixedDevelopmentCoordinatorPackageCandidate({
        ...fixture.input,
        distributionRoot: alias,
      }).status,
      "blocked",
    );
    fs.mkdirSync(path.join(fixture.distributionRoot, ".git"));
    assert.equal(
      inspectFixedDevelopmentCoordinatorPackageCandidate(fixture.input).status,
      "candidate",
    );
  } finally {
    fixture.cleanup();
  }
});

test("実体観測と開始枠を結合し、準備待機後のRoot差替えで消費を拒否する", async () => {
  const fixture = developmentFixture();
  try {
    const initial = inspectFixedDevelopmentCoordinatorPackageCandidate(
      fixture.input,
    );
    assert.equal(initial.status, "candidate");
    // Identity component only: this test does not supply human approval or
    // exercise the not-yet-connected production execution boundary.
    const observe = () => {
      const current = inspectFixedDevelopmentCoordinatorPackageCandidate(
        fixture.input,
      );
      return current.status === "candidate"
        ? {
            bindingSha256: current.sourceIdentitySha256,
            wallTimeMs: 100,
            monotonicTimeMs: 100,
          }
        : null;
    };
    const scopeSha256 = "1".repeat(64);
    const constraints = createDevelopmentMeasurementConstraints(
      {
        bindingSha256: initial.sourceIdentitySha256,
        expiresAtMs: 1_100,
        tasks: [
          { scopeSha256, executor: "codex", reviewer: "claude" },
          {
            scopeSha256: "2".repeat(64),
            executor: "claude",
            reviewer: "codex",
          },
        ],
      },
      observe(),
    );
    assert.ok(constraints);
    const task = constraints.reserveTask(scopeSha256, observe());
    assert.equal(task.status, "recorded");
    const invocation = constraints.reserveInvocation(
      task.value,
      "codex",
      "executor",
      observe(),
    );
    assert.equal(invocation.status, "recorded");
    await Promise.resolve().then(() => {
      const previousRoot = path.join(fixture.root, "previous");
      fs.renameSync(fixture.distributionRoot, previousRoot);
      fs.cpSync(previousRoot, fixture.distributionRoot, { recursive: true });
    });
    const result = constraints.consumeInvocation(
      invocation.value,
      task.value,
      "codex",
      "executor",
      observe(),
    );
    assert.deepEqual(result, {
      status: "blocked",
      reason: "identity_mismatch",
    });
    assert.equal(
      constraints.settleInvocation(invocation.value).status,
      "recorded",
    );
    assert.equal(
      constraints.settleTask(task.value, "finished").status,
      "recorded",
    );
    assert.equal(constraints.inspect().productionAuthorityConferred, false);
  } finally {
    fixture.cleanup();
  }
});

test("署名済みPlatform Access観測は開発版Rootや自己申告の署名状態を拒否する", () => {
  const fixture = developmentFixture();
  try {
    const request = {
      distributionRoot: fixture.distributionRoot,
      evaluationTime: "2026-08-30T00:00:00.000Z",
      expectedRelease: {
        manifestHash: "1".repeat(64),
        releaseSequence: 1,
        crddVersion: "v0.18.0",
        crddCommit: "2".repeat(40),
        crddTree: fixture.expectedCrddTree,
        packageContentRootSha256:
          fixture.input.expectedPackageContentRootSha256,
      },
    };
    assert.equal(
      inspectVerifiedNativeDistributionCandidate(request).status,
      "blocked",
    );
    assert.equal(
      inspectVerifiedNativeDistributionCandidate({
        ...request,
        nativeReleaseSignatureVerified: true,
      }).status,
      "blocked",
    );
    let getterCalls = 0;
    const invalid = Object.defineProperty({ ...request }, "expectedRelease", {
      get() {
        getterCalls += 1;
        return request.expectedRelease;
      },
    });
    assert.equal(
      inspectVerifiedNativeDistributionCandidate(invalid).status,
      "blocked",
    );
    assert.equal(getterCalls, 0);
    assert.equal(
      inspectVerifiedNativeDistributionCandidate(null).status,
      "blocked",
    );
    assert.equal(
      inspectFixedDevelopmentCoordinatorPackageCandidate(fixture.input).status,
      "candidate",
    );
  } finally {
    fixture.cleanup();
  }
});

test("Task package capabilityは偽造・不正入力・再利用を受理しない", () => {
  const issued = issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
    evaluationTime: "not-a-time",
    callerRoot: "C:\\caller-selected",
  });
  assert.equal(issued.capability, null);
  const forged = Object.freeze({});
  assert.equal(
    consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(forged),
    false,
  );
  assert.equal(
    consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(forged),
    false,
  );
});

test("Package Capability状態機械はfresh exact Identityを一度だけ受理する", () => {
  const state = createIsolatedVerifiedPackageCapabilityStateCandidate();
  const identity = Object.freeze({
    manifestHash: "1".repeat(64),
    releaseSequence: 19,
    runtimeExecutionIdentitySha256: "4".repeat(64),
    interactiveConsoleReaderArtifactSha256: "5".repeat(64),
  });
  const capability = state.issue(identity, 1_000);
  assert.equal(state.consume(capability, identity, 1_001), true);
  assert.equal(state.consume(capability, identity, 1_002), false);
  const stale = state.issue(identity, 1_000);
  assert.equal(state.consume(stale, identity, 6_000), false);
  for (const key of Object.keys(identity)) {
    const changed = Object.freeze({
      ...identity,
      [key]:
        key === "releaseSequence"
          ? 20
          : "6".repeat(String(identity[key as keyof typeof identity]).length),
    });
    const mismatched = state.issue(identity, 1_000);
    assert.equal(state.consume(mismatched, changed, 1_001), false, key);
  }
  const isolated = state.issue(identity, 1_000);
  assert.equal(
    consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(isolated),
    false,
  );
  assert.equal(state.runtimeAuthorityIssued, false);
  assert.equal(state.productionConsumerCompatible, false);
});

function frame(payload: Record<string, unknown>) {
  const canonical = canonicalizeProvisioningJsonValueCandidate(payload);
  assertCanonicalCandidate(canonical);
  const length = Buffer.alloc(8);
  length.writeBigUInt64BE(BigInt(canonical.canonicalBytes.length));
  return Buffer.concat([
    Buffer.from(PLATFORM_PROVISIONER_MANIFEST_DOMAIN, "ascii"),
    length,
    canonical.canonicalBytes,
  ]);
}

function signedManifest(
  packageContentRootSha256: string,
  revision = PLATFORM_PROVISIONER_MANIFEST_REVISION,
  expiresAt: string | null = "2027-08-15T00:00:00.000Z",
) {
  const signer = generateKeyPairSync("ed25519");
  const spki = signer.publicKey.export({ format: "der", type: "spki" });
  const executionFields = {
    packageName: "@qual-lab/crdd-coordinator",
    packageVersion: "0.0.0-development",
    packageContentRootSha256,
    rootProtectionPolicySha256: "2".repeat(64),
    keyStoragePolicySha256: "3".repeat(64),
    platformAccessArtifact: {
      relativePath:
        "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
      target: "x86_64-pc-windows-msvc",
      protocolRevision: 3,
      rustToolchain: "1.94.1",
      byteLength: 1024,
      sha256: "4".repeat(64),
    },
  };
  const runtimeIdentity =
    calculateRuntimeExecutionIdentityCandidate(executionFields);
  assert.equal(runtimeIdentity.status, "candidate");
  const payload = {
    contract: PLATFORM_PROVISIONER_MANIFEST_CONTRACT,
    contractRevision: revision,
    ...executionFields,
    crddVersion: "v0.18.0",
    releaseSequence: 18,
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    runtimeExecutionIdentitySha256:
      runtimeIdentity.runtimeExecutionIdentitySha256,
    issuedAt: "2026-08-15T00:00:00.000Z",
    expiresAt,
  };
  return {
    input: {
      manifestEnvelope: {
        contract: PLATFORM_PROVISIONER_MANIFEST_ENVELOPE_CONTRACT,
        contractRevision: revision,
        payload,
        signatures: [
          {
            keyId: createHash("sha256").update(spki).digest("hex"),
            algorithm: "Ed25519",
            signature: sign(null, frame(payload), signer.privateKey).toString(
              "base64url",
            ),
          },
        ],
      },
      evaluationTime: "2026-08-16T00:00:00.000Z",
      expectedCrddVersion: payload.crddVersion,
      expectedCrddCommit: payload.crddCommit,
      expectedCrddTree: payload.crddTree,
    },
  };
}

test("固定Coordinator packageをPath非公開で一覧化する", () => {
  const result = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(result.status, "candidate");
  assert.equal(result.packageName, "@qual-lab/crdd-coordinator");
  assert.equal(result.runtimeOwnedPackageRoot, true);
  assert.equal(result.stableFilesystemIdentityObserved, true);
  assert.equal(typeof result.permissionPolicyConfirmed, "boolean");
  if (process.platform === "win32") {
    assert.equal(result.permissionPolicyConfirmed, false);
  }
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.effectAuthorizationIssued, false);
  assert.equal("files" in result, false);
  assert.equal("packageRoot" in result, false);
  assert.equal("path" in result, false);
});

test("Host Operation Supervisor sourceは再帰Package inventoryのexact non-link fileである", () => {
  const entrypoint = path.resolve(
    import.meta.dirname,
    "../../src/security/host-operation-lock-supervisor.ts",
  );
  const metadata = fs.lstatSync(entrypoint);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.isSymbolicLink(), false);
  assert.equal(fs.realpathSync.native(entrypoint), entrypoint);
  const packageCandidate =
    inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(packageCandidate.status, "candidate");
  assert.equal(typeof packageCandidate.packageContentRootSha256, "string");
});

test("caller選択Rootは非Authorityのまま内容変更をcontent rootへ反映する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-package-observation-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: { "./cli": "./bin/coordinator.ts" },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 1;\n",
    );
    const first = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    assert.equal(first.runtimeOwnedPackageRoot, false);
    assert.equal(first.runtimeCapabilityIssued, false);
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 2;\n",
    );
    const second = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(second.status, "candidate");
    assert.notEqual(
      first.packageContentRootSha256,
      second.packageContentRootSha256,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("文書・試験はRuntime Execution Identityへ入らず、実行sourceは必ず入る", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-execution-set-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.mkdirSync(path.join(root, "tests"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: { "./cli": "./bin/coordinator.ts" },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(path.join(root, "README.md"), "first\n");
    fs.writeFileSync(path.join(root, "tests", "fixture.ts"), "first\n");
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 1;\n",
    );
    const first = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    fs.writeFileSync(path.join(root, "README.md"), "second\n");
    fs.writeFileSync(path.join(root, "tests", "fixture.ts"), "second\n");
    const documentationOnly =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(documentationOnly.status, "candidate");
    assert.equal(
      documentationOnly.packageContentRootSha256,
      first.packageContentRootSha256,
    );
    fs.writeFileSync(
      path.join(root, "src", "entry.ts"),
      "export const value = 2;\n",
    );
    const runtimeChanged =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(runtimeChanged.status, "candidate");
    assert.notEqual(
      runtimeChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("責務分離後のRuntime componentを静的依存閉包として実行Identityへ含める", () => {
  const fixture = developmentFixture();
  const root = fixture.distributionRoot;
  try {
    const coordinatorRoot = path.join(root, "40_Develop", "coordinator");
    const projectRuntimeRoot = path.join(
      root,
      "40_Develop",
      "project-runtime",
      "src",
    );
    const projectRuntimePackagePath = path.join(
      root,
      "40_Develop",
      "project-runtime",
      "package.json",
    );
    const projectRuntimeMetadata = JSON.parse(
      fs.readFileSync(projectRuntimePackagePath, "utf8"),
    ) as Record<string, unknown>;
    const valuePath = path.join(
      projectRuntimeRoot,
      "public-contract",
      "integration-result.ts",
    );
    const unusedCoordinatorPath = path.join(
      coordinatorRoot,
      "src",
      "unused-production.ts",
    );
    fs.writeFileSync(
      unusedCoordinatorPath,
      "export const unusedProduction = 1;\n",
    );
    const unusedSiblingPath = path.join(
      projectRuntimeRoot,
      "core",
      "unused-sibling.ts",
    );
    fs.writeFileSync(unusedSiblingPath, "export const unusedSibling = 1;\n");
    const first =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    const originalSiblingValue = fs.readFileSync(valuePath, "utf8");
    fs.writeFileSync(
      valuePath,
      [
        'import { spawnRuntimeLocalTypeScriptChild } from "../../../coordinator/src/core/runtime-local-typescript-child-entrypoints.ts";',
        'spawnRuntimeLocalTypeScriptChild("interactive_console_reader", [], {});',
        "export const value = 1;",
        "",
      ].join("\n"),
    );
    assert.equal(
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root)
        .status,
      "candidate",
    );
    for (const bypass of [
      'import { Worker as ThreadWorker } from "node:worker_threads";\nnew ThreadWorker("./child.ts");\nexport const value = 1;\n',
      "const runtimeProcess = process;\nvoid runtimeProcess.execPath;\nexport const value = 1;\n",
    ]) {
      fs.writeFileSync(valuePath, bypass);
      assert.equal(
        inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root)
          .status,
        "blocked",
        bypass,
      );
    }
    fs.writeFileSync(valuePath, originalSiblingValue);
    fs.writeFileSync(
      path.join(root, "README.md"),
      "not in the runtime execution closure\n",
    );
    const documentationOnly =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(documentationOnly.status, "candidate");
    assert.equal(
      documentationOnly.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify({ ...projectRuntimeMetadata, type: "commonjs" }),
    );
    const incompatibleMetadata =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(incompatibleMetadata.status, "blocked");
    assert.equal(incompatibleMetadata.runtimeAuthorityConferred, false);
    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify(projectRuntimeMetadata),
    );

    fs.rmSync(projectRuntimePackagePath);
    const missingMetadata =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(missingMetadata.status, "blocked");
    assert.equal(missingMetadata.runtimeAuthorityConferred, false);
    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify(projectRuntimeMetadata),
    );

    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify({ ...projectRuntimeMetadata, version: "0.0.1" }),
    );
    const metadataChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(metadataChanged.status, "candidate");
    assert.notEqual(
      metadataChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );
    fs.writeFileSync(
      projectRuntimePackagePath,
      JSON.stringify(projectRuntimeMetadata),
    );

    fs.writeFileSync(unusedSiblingPath, "export const unusedSibling = 2;\n");
    const unusedSiblingChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(unusedSiblingChanged.status, "candidate");
    assert.notEqual(
      unusedSiblingChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      unusedCoordinatorPath,
      "export const unusedProduction = 2;\n",
    );
    const unusedCoordinatorChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(unusedCoordinatorChanged.status, "candidate");
    assert.notEqual(
      unusedCoordinatorChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.appendFileSync(
      path.join(root, "template", "tools", "crdd-mcp.ts"),
      "// public launcher changed\n",
    );
    const launcherChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(launcherChanged.status, "candidate");
    assert.notEqual(
      launcherChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.appendFileSync(valuePath, "// changed runtime dependency\n");
    const dependencyChanged =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(dependencyChanged.status, "candidate");
    assert.notEqual(
      dependencyChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      path.join(coordinatorRoot, "src", "index.ts"),
      'export { value } from "../../untrusted-component/src/index.ts";\n',
    );
    const outside =
      inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(root);
    assert.equal(outside.status, "blocked");
    assert.equal(outside.runtimeAuthorityConferred, false);
  } finally {
    fixture.cleanup();
  }
});

test("非正規表記または実行集合外へのrelative importを署名候補へ含めず拒否する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-runtime-dependency-boundary-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: { "./cli": "./bin/coordinator.ts" },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(root, "outside.ts"),
      "export const value = 1;\n",
    );
    for (const specifier of [
      "../../outside.ts",
      "..\\..\\outside.ts",
      ".%2e/.%2e/outside.ts",
      "../../outside.ts?candidate=1",
      "../../outside.ts#candidate",
    ]) {
      fs.writeFileSync(
        path.join(root, "src", "entry.ts"),
        `export { value } from ${JSON.stringify(specifier)};\n`,
      );
      const result = inspectPlatformProvisionerPackageFilesystemCandidate(root);
      assert.equal(result.status, "blocked", specifier);
      assert.equal(result.runtimeAuthorityConferred, false, specifier);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("共通Launcherの署名・4経路・Recovery入口と静的依存だけを実行Identityへ含める", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-launch-closure-"));
  try {
    for (const directory of ["bin", "src", "scripts"]) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: { "./cli": "./bin/coordinator.ts" },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(root, "bin", "launch.ts"),
      [
        'import "../src/entry.ts";',
        'await import("./coordinator.ts");',
        'await import("../scripts/verify-signed-route-matrix.ts");',
        'await import("../scripts/verify-signed-recovery-matrix.ts");',
        'await import("../scripts/sign-release-manifest.ts");',
        'await import("../scripts/promote-release-manifest.ts");',
        "const target = new URL(plan.entryRelativePath, import.meta.url);",
        "process.argv = [process.execPath, fileURLToPath(target), ...plan.forwardedArgs];",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(path.join(root, "bin", "coordinator.ts"), "export {};\n");
    fs.writeFileSync(path.join(root, "src", "entry.ts"), "export {};\n");
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-route-matrix.ts"),
      'import "./verify-signed-general-task.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-general-task.ts"),
      "export const route = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-recovery-matrix.ts"),
      'import "./recovery-helper.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "recovery-helper.ts"),
      "export const recovery = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "sign-release-manifest.ts"),
      'import "./signing-helper.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "signing-helper.ts"),
      "export const signing = 1;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "promote-release-manifest.ts"),
      'import "./release-manifest-promotion.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "release-manifest-promotion.ts"),
      "export const promotion = 1;\n",
    );
    const unrelated = path.join(root, "scripts", "unrelated.ts");
    fs.writeFileSync(unrelated, "export const unrelated = 1;\n");

    const first = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(first.status, "candidate");
    const launcherPath = path.join(root, "bin", "launch.ts");
    const canonicalLauncher = fs.readFileSync(launcherPath, "utf8");
    fs.writeFileSync(
      launcherPath,
      canonicalLauncher.replace(
        "fileURLToPath(target)",
        "fileURLToPath(otherTarget)",
      ),
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
    fs.writeFileSync(launcherPath, canonicalLauncher);
    fs.writeFileSync(unrelated, "export const unrelated = 2;\n");
    const unrelatedChanged =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(unrelatedChanged.status, "candidate");
    assert.equal(
      unrelatedChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      path.join(root, "scripts", "recovery-helper.ts"),
      "export const recovery = 2;\n",
    );
    const dependencyChanged =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(dependencyChanged.status, "candidate");
    assert.notEqual(
      dependencyChanged.packageContentRootSha256,
      first.packageContentRootSha256,
    );

    fs.writeFileSync(
      path.join(root, "scripts", "recovery-helper.ts"),
      'const target = "./late-bound.ts";\nawait import(target);\n',
    );
    const unboundDynamic =
      inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(unboundDynamic.status, "blocked");
    assert.equal(unboundDynamic.runtimeAuthorityConferred, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("実行Identityのmodule構文を字句解析し、コメント・非relative・未束縛dynamicによる閉包回避を拒否する", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-module-lexer-"));
  try {
    for (const directory of ["bin", "src", "scripts"]) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: { "./cli": "./bin/coordinator.ts" },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(
      path.join(root, "bin", "launch.ts"),
      [
        'await import("./coordinator.ts");',
        'await import("../scripts/verify-signed-route-matrix.ts");',
        'await import("../scripts/verify-signed-recovery-matrix.ts");',
        'await import("../scripts/sign-release-manifest.ts");',
        'await import("../scripts/promote-release-manifest.ts");',
        "",
      ].join("\n"),
    );
    fs.writeFileSync(path.join(root, "bin", "coordinator.ts"), "export {};\n");
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-route-matrix.ts"),
      'import "./verify-signed-general-task.ts";\n',
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-general-task.ts"),
      "export const task = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "verify-signed-recovery-matrix.ts"),
      "export const recovery = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "sign-release-manifest.ts"),
      "export const sign = true;\n",
    );
    fs.writeFileSync(
      path.join(root, "scripts", "promote-release-manifest.ts"),
      "export const promote = true;\n",
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "candidate",
    );

    const launcher = path.join(root, "bin", "launch.ts");
    const canonicalLauncher = fs.readFileSync(launcher, "utf8");
    fs.writeFileSync(
      launcher,
      `${canonicalLauncher}await import("../scripts/unlisted.ts");\n`,
    );
    fs.writeFileSync(path.join(root, "scripts", "unlisted.ts"), "export {};\n");
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
    fs.writeFileSync(
      launcher,
      canonicalLauncher.replace(
        'await import("../scripts/sign-release-manifest.ts");\n',
        "",
      ),
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
    fs.writeFileSync(launcher, canonicalLauncher);

    const target = path.join(root, "scripts", "verify-signed-general-task.ts");
    for (const source of [
      'import/*comment*/("../../tests/helper.ts");\n',
      'import value from "external-package";\n',
      'import value from "C:/outside.ts";\n',
      'import value from "file:///outside.ts";\n',
      'import value from "fs";\n',
      'import value from "node:not-a-builtin";\n',
      'const target = new URL("./late.ts", import.meta.url);\nawait import(target.href);\n',
    ]) {
      fs.writeFileSync(target, source);
      const result = inspectPlatformProvisionerPackageFilesystemCandidate(root);
      assert.equal(result.status, "blocked", source);
      assert.equal(result.runtimeAuthorityConferred, false, source);
    }

    fs.writeFileSync(
      target,
      'import/*comment*/ value from/*comment*/ "node:path";\nexport { value as task };\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "candidate",
    );

    for (const source of [
      'import { spawn } from "node:child_process";\nspawn(process.execPath, ["./late-child.ts"]);\n',
      'import * as childProcess from "node:child_process";\nchildProcess.spawn(process.execPath, ["./late-child.ts"]);\n',
      'import childProcess from "node:child_process";\nchildProcess.spawn(process.execPath, ["./late-child.ts"]);\n',
      'const childProcess = await import("node:child_process");\nchildProcess.spawn(process.execPath, ["./late-child.ts"]);\n',
      'import { fork } from "node:child_process";\nfork("./late-child.ts");\n',
      'import { Worker } from "node:worker_threads";\nnew Worker(new URL("./late-child.ts", import.meta.url));\n',
      'import { fork } from "node:child_process";\nconst target = "./late-child.ts";\nfork(target);\n',
      'import { fork as launchChild } from "node:child_process";\nconst target = "./late-child.ts";\nlaunchChild(target);\n',
      'import { spawn } from "node:child_process";\nconst argv = [fileURLToPath(import.meta.url)];\nspawn(process.execPath, argv);\n',
      'import { spawn } from "node:child_process";\nconst launch = spawn;\nlaunch(process.execPath, [fileURLToPath(import.meta.url)]);\n',
      'import { spawn } from "node:child_process";\n(spawn)(process.execPath, [fileURLToPath(import.meta.url)]);\n',
      'import { spawnSync } from "node:child_process";\nspawnSync(process.execPath, ["./late-child.ts"]);\n',
      'import { execFile } from "node:child_process";\nexecFile(process.execPath, ["./late-child.ts"]);\n',
      'import { execFileSync } from "node:child_process";\nexecFileSync(process.execPath, ["./late-child.ts"]);\n',
      'import { spawn as launchSelf } from "node:child_process";\nimport { fileURLToPath } from "node:url";\nlaunchSelf(process.execPath, [fileURLToPath(import.meta.url)]);\n',
    ]) {
      fs.writeFileSync(target, source);
      const result = inspectPlatformProvisionerPackageFilesystemCandidate(root);
      assert.equal(result.status, "blocked", source);
      assert.equal(result.runtimeAuthorityConferred, false, source);
    }

    const childTarget = path.join(root, "scripts", "late-child.ts");
    fs.writeFileSync(childTarget, "export const child = true;\n");
    fs.writeFileSync(
      target,
      'import { fork as launchChild } from "node:child_process";\nlaunchChild("./late-child.ts");\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );

    fs.writeFileSync(
      target,
      'import path from "node:path";\nimport { spawnSync } from "node:child_process";\nspawnSync(path.join(process.env.SystemRoot ?? "C:\\\\Windows", "System32", "taskkill.exe",), ["/PID", "1", "/T", "/F"]);\n',
    );
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Repository textのLFとCRLFは同じ正本内容として検証し、意味差分は拒否する", () => {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-package-line-ending-"),
  );
  try {
    fs.mkdirSync(path.join(root, "src"));
    const metadata = JSON.stringify({
      name: "@qual-lab/crdd-coordinator",
      version: "0.0.0-development",
      private: true,
      type: "module",
      exports: { "./cli": "./bin/coordinator.ts" },
      scripts: {},
      engines: {},
      devDependencies: {},
    });
    fs.writeFileSync(path.join(root, "package.json"), `${metadata}\n`);
    const entrypoint = path.join(root, "src", "entry.ts");
    fs.writeFileSync(entrypoint, "export const value = 1;\nexport {};\n");
    const lf = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(lf.status, "candidate");
    fs.writeFileSync(entrypoint, "export const value = 1;\r\nexport {};\r\n");
    const crlf = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(crlf.status, "candidate");
    assert.equal(crlf.packageContentRootSha256, lf.packageContentRootSha256);
    fs.writeFileSync(entrypoint, "export const value = 2;\r\nexport {};\r\n");
    const changed = inspectPlatformProvisionerPackageFilesystemCandidate(root);
    assert.equal(changed.status, "candidate");
    assert.notEqual(
      changed.packageContentRootSha256,
      lf.packageContentRootSha256,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("Coordinator packageはexact CLI-only exports境界を必須にする", () => {
  for (const exportsValue of [
    undefined,
    {},
    { "./cli": "./bin/coordinator.ts", "./internal": "./src/internal.ts" },
    { "./cli": "./src/security/docker-recovery-runtime-internal.ts" },
  ]) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-package-exports-boundary-"),
    );
    try {
      const metadata: Record<string, unknown> = {
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        scripts: {},
        engines: {},
        devDependencies: {},
      };
      if (exportsValue !== undefined) metadata.exports = exportsValue;
      fs.writeFileSync(
        path.join(root, "package.json"),
        JSON.stringify(metadata),
      );
      assert.equal(
        inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
        "blocked",
      );
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("入れ子directoryの走査中にentryを追加・削除・型変更しても安定inventoryへ流用しない", () => {
  for (const scenario of ["add", "remove", "replace_type"] as const) {
    const root = fs.mkdtempSync(
      path.join(os.tmpdir(), "crdd-package-directory-race-"),
    );
    const sourceRoot = path.join(root, "src");
    fs.mkdirSync(sourceRoot);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "@qual-lab/crdd-coordinator",
        version: "0.0.0-development",
        private: true,
        type: "module",
        exports: { "./cli": "./bin/coordinator.ts" },
        scripts: {},
        engines: {},
        devDependencies: {},
      }),
    );
    fs.writeFileSync(path.join(sourceRoot, "entry.ts"), "export {};");
    const changedPath = path.join(sourceRoot, "changed.ts");
    if (scenario !== "add") fs.writeFileSync(changedPath, "export {};");
    const originalRead = fs.readSync;
    const originalLstat = fs.lstatSync;
    const sourceRootMetadata = fs.lstatSync(sourceRoot, { bigint: true });
    let isChanged = false;
    Reflect.set(fs, "lstatSync", (target: fs.PathLike, ...args: unknown[]) =>
      target === sourceRoot
        ? sourceRootMetadata
        : Reflect.apply(originalLstat, fs, [target, ...args]),
    );
    Reflect.set(fs, "readSync", (descriptor: number, ...args: unknown[]) => {
      const byteLength = Reflect.apply(originalRead, fs, [descriptor, ...args]);
      if (!isChanged && byteLength > 0) {
        isChanged = true;
        if (scenario === "add") {
          fs.writeFileSync(changedPath, "export {};");
        } else {
          fs.rmSync(changedPath);
          if (scenario === "replace_type") fs.mkdirSync(changedPath);
        }
      }
      return byteLength;
    });
    try {
      assert.equal(
        inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
        "blocked",
      );
    } finally {
      Reflect.set(fs, "readSync", originalRead);
      Reflect.set(fs, "lstatSync", originalLstat);
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

test("同梱manifestは固定Release鍵以外の署名を拒否する", () => {
  const observation = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(observation.status, "candidate");
  assert.equal(typeof observation.packageContentRootSha256, "string");
  const fixture = signedManifest(observation.packageContentRootSha256);
  const result = verifyBundledCoordinatorPackageCandidate(fixture.input);
  assert.equal(result.status, "blocked");
  assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
  assert.equal(result.crddDistributionConfirmed, false);
  assert.equal(result.effectAuthorizationIssued, false);
  assert.equal("files" in result, false);
  assert.equal("signature" in result, false);
  assert.equal("releaseSignerSpkiDer" in result, false);
});

test("期限なしmanifestも固定Release鍵と配布結合を迂回できない", () => {
  const observed = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(observed.status, "candidate");
  const value = signedManifest(
    observed.packageContentRootSha256,
    PLATFORM_PROVISIONER_MANIFEST_REVISION,
    null,
  );
  for (const evaluationTime of [
    "2026-08-16T00:00:00.000Z",
    "2099-01-01T00:00:00.000Z",
  ]) {
    const result = verifyBundledCoordinatorPackageCandidate({
      ...value.input,
      evaluationTime,
    });
    assert.equal(result.status, "blocked");
    assert.equal(result.runtimeOwnedReleaseTrustConfirmed, false);
    assert.equal(result.crddDistributionConfirmed, false);
    assert.equal(result.effectAuthorizationIssued, false);
  }
});

test("不正Root、Release Identity不一致およびpackage metadataをfail closedにする", () => {
  assert.equal(
    inspectPlatformProvisionerPackageFilesystemCandidate(null).status,
    "blocked",
  );
  const observation = inspectBundledCoordinatorPackageFilesystemCandidate();
  assert.equal(observation.status, "candidate");
  assert.equal(typeof observation.packageContentRootSha256, "string");
  const fixture = signedManifest(observation.packageContentRootSha256);
  fixture.input.expectedCrddCommit = "c".repeat(40);
  assert.equal(
    verifyBundledCoordinatorPackageCandidate(fixture.input).status,
    "blocked",
  );

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-package-invalid-"));
  try {
    fs.writeFileSync(path.join(root, "package.json"), "{}");
    assert.equal(
      inspectPlatformProvisionerPackageFilesystemCandidate(root).status,
      "blocked",
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("package Filesystem contractは観測をTrustおよびEffectから分離する", () => {
  const contract = describePlatformProvisionerPackageFilesystemContract();
  assert.equal(contract.contractRevision, 6);
  assert.equal(
    contract.runtimeExecutionSet,
    "closed_public_launchers_coordinator_package_and_transitively_reached_sibling_sources_with_package_metadata",
  );
  assert.equal(
    contract.requiredArtifactResolution,
    "single_distribution_root_relative_registry_atomically_resolved_non_nullable_and_consumed_without_path_reinterpretation",
  );
  assert.equal(
    contract.localNodeChildEntrypointRegistration,
    "declared_role_kind_path_actual_canonical_wrapper_call_sites_and_required_registry_exactly_match_with_runtime_kind_validation",
  );
  const source = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      "../../src/security/platform-provisioner-package-filesystem.ts",
    ),
    "utf8",
  );
  assert.equal(source.includes("observed.observation.files.find"), false);
  assert.equal(source.includes("DEVELOPMENT_ENTRYPOINTS"), false);
  assert.equal(source.includes("developmentEntrypoints"), false);
  assert.equal(
    contract.runtimeOwnedPackageFilesystemRead,
    "implemented_candidate_without_permission_authority",
  );
  assert.equal(
    contract.runtimeOwnedCrddReleaseIdentitySelection,
    "implemented_fixed_manifest_signature_and_runtime_execution_identity_candidate",
  );
  assert.equal(
    contract.runtimeOwnedReleaseTrustSelection,
    "implemented_single_ed25519_anchor_pinned",
  );
  assert.equal(
    contract.ownerAndPermissionPolicyVerification,
    "posix_implemented_candidate_windows_effective_access_not_implemented",
  );
  assert.equal(
    contract.windowsSystemAndAdministratorsWriteRuntimeReadAclVerification,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.releaseTrustModel,
    "qual_lab_ed25519_single_active_key_pinned_in_verified_crdd_release",
  );
  assert.equal(
    contract.signedManifestPath,
    "template/tools/coordinator/coordinator-package-manifest.json",
  );
  assert.equal(
    contract.releaseTrustAnchorConfiguration,
    "configured_immutable_source_literal",
  );
  assert.equal(
    contract.policyIdentityBinding,
    "owned_root_protection_and_key_storage_policy_hashes_required",
  );
  assert.equal(
    contract.effectController,
    "not_implemented_effective_access_required",
  );
  assert.equal(
    contract.taskGateAuthority,
    "held_alone_grants_no_operation_console_filesystem_provider_or_network_authority",
  );
  assert.equal(
    contract.processPoisonGate,
    "before_manifest_package_filesystem_observation",
  );
  assert.equal(
    contract.releaseIdentityRollbackFloorPersistence,
    "implemented_candidate",
  );
  assert.equal(
    contract.releaseIdentityRollbackFloorTransition,
    "implemented_candidate",
  );
  assert.equal(
    contract.unsignedOrModifiedCheckoutCanAuthorizeProvisioningEffect,
    false,
  );
  assert.equal(
    contract.repositoryContainedOfficialReleaseCanAuthorizeProvisioningEffect,
    true,
  );
  assert.equal(contract.nativeArtifactsInSignedGitTree, true);
  assert.equal(contract.exactRootGitMetadataExcludedFromSignedGitTree, true);
  assert.equal(contract.runtimeCapabilityIssued, false);
  assert.equal(contract.filesystemEffectIssued, false);
});

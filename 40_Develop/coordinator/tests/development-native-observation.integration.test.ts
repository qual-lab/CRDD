import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test, { mock } from "node:test";
import { fileURLToPath } from "node:url";

const targets = [
  "codex",
  "claude",
  "store",
  "store-init",
  "state",
  "state-init",
];
const scenarios = [
  "normal",
  "pre-artifact",
  "post-artifact",
  "post-source",
  "post-native",
  "post-repository",
  "native-null",
  "native-throw",
  "environment",
  "unknown-context",
  "cancel",
  "expiry",
  "cleanup-cancel",
  "cleanup-expiry",
];

async function runProbe(target: string, scenario: string) {
  const realNow = Date.now;
  let simulatedTime: number | null = null;
  mock.method(Date, "now", () => simulatedTime ?? realNow());
  const root = path.resolve(
    fileURLToPath(new URL("../../..", import.meta.url)),
  );
  const artifact = Object.freeze({
    relativePath:
      "template/tools/coordinator/windows-x64/crdd-platform-access.exe",
    target: "x86_64-pc-windows-msvc",
    protocolRevision: 3,
    rustToolchain: "1.94.1-x86_64-pc-windows-msvc",
    byteLength: 1,
    sha256: "1".repeat(64),
  });
  let nativeCalls = 0;
  let spawnCalls = 0;
  let artifactCalls = 0;
  let isArmed = false;
  const verifications: object[] = [];
  const management = Object.freeze({});
  const repositoryBinding = Object.freeze({});
  const moduleUrl = (name: string) =>
    new URL(`../src/security/${name}.ts`, import.meta.url).href;
  await mock.module(moduleUrl("repository-operation-runtime"), {
    namedExports: {
      inspectRepositoryIdentityCandidate: () => ({
        commit:
          isArmed && spawnCalls > 0 && scenario === "post-repository"
            ? "9".repeat(40)
            : "a".repeat(40),
        tree: "b".repeat(40),
      }),
      borrowRuntimeOwnedRepositorySource: (
        repository: object,
        operation: object,
      ) =>
        repository === repositoryBinding && operation === management
          ? {
              operationId: "fixture-operation",
              repositoryRoot: root,
              revision: "a".repeat(40),
            }
          : null,
    },
  });
  await mock.module(moduleUrl("execution-environment"), {
    namedExports: {
      verifyOwnedOperationManagementCapability: (operation: object) => {
        assert.equal(operation, management);
        return { operationId: "fixture-operation" };
      },
    },
  });
  await mock.module(moduleUrl("platform-provisioner-package-filesystem"), {
    namedExports: {
      inspectFixedDevelopmentCoordinatorPackageCandidate: () => ({
        status: "candidate",
        sourceIdentitySha256:
          isArmed && spawnCalls > 0 && scenario === "post-source"
            ? "9".repeat(64)
            : "2".repeat(64),
      }),
      inspectVerifiedNativeDistributionCandidate: () => {
        nativeCalls += 1;
        if (isArmed && scenario === "native-throw")
          throw new Error("private_observation_failure");
        if (isArmed && scenario === "native-null") return { status: "blocked" };
        const verification = Object.freeze({
          status: "candidate",
          nativeIdentitySha256:
            isArmed && spawnCalls > 0 && scenario === "post-native"
              ? "9".repeat(64)
              : "3".repeat(64),
          platformAccessArtifact: artifact,
        });
        verifications.push(verification);
        return verification;
      },
      verifyBundledCoordinatorPackageFromFixedManifestCandidate: () => {
        throw new Error("development_must_not_fallback");
      },
    },
  });
  await mock.module(
    new URL("../src/core/windows-child-environment.ts", import.meta.url).href,
    {
      namedExports: {
        createWindowsNativeHelperEnvironment: () =>
          scenario === "environment" ? null : Object.freeze({}),
        WINDOWS_NATIVE_HELPER_ENVIRONMENT_PROVENANCE: "test_only",
      },
    },
  );
  await mock.module(moduleUrl("platform-access-release"), {
    namedExports: {
      PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH: artifact.relativePath,
      observePlatformAccessReleaseArtifactCandidate: () => {
        artifactCalls += 1;
        const isMismatch =
          (scenario === "pre-artifact" && artifactCalls === 1) ||
          (scenario === "post-artifact" && artifactCalls === 2);
        return {
          status: "candidate",
          artifact: isMismatch
            ? { ...artifact, sha256: "9".repeat(64) }
            : artifact,
        };
      },
      beginPlatformAccessArtifactSigningObservation: () => ({
        artifact,
        token: Object.freeze({}),
      }),
      verifyPlatformAccessArtifactSigningObservation: () => true,
    },
  });
  await mock.module("node:child_process", {
    namedExports: {
      spawnSync: (
        _executable: string,
        argv: string[],
        options: { input: Buffer; shell: boolean },
      ) => {
        spawnCalls += 1;
        assert.deepEqual(argv, []);
        assert.equal(options.shell, false);
        // The real request encoder and response validator share this fixed native wire contract.
        const bytes = Buffer.alloc(182);
        bytes.write("CRDDHO02", 0, "ascii");
        bytes.writeUInt16LE(3, 8);
        assert.equal(options.input.length, 76);
        bytes[10] = options.input[10] ?? 0;
        bytes[11] = 1;
        options.input.copy(bytes, 12, 12, 44);
        bytes.writeUInt16LE(100, 44);
        bytes.writeUInt32LE(0x83, 46);
        bytes.writeUInt32LE(0x1ff, 50);
        for (let n = 0; n < 4; n += 1)
          bytes.fill(n + 1, 54 + n * 32, 86 + n * 32);
        return {
          pid: 123,
          status: 0,
          signal: null,
          stdout: bytes,
          stderr: Buffer.alloc(0),
        };
      },
    },
  });
  const session = await import(
    "../src/security/development-measurement-session.ts"
  );
  const provider = await import(
    "../src/security/provider-home-windows-adapter.ts"
  );
  const store = await import(
    "../src/security/candidate-store-windows-adapter.ts"
  );
  const tasks = ["codex", "claude"].map((executor) => ({
    frontProvider: executor === "codex" ? "claude" : "codex",
    requestedExecutorProvider: executor,
    objective: "Bounded fixture",
    acceptanceCriteria: ["Expected content"],
    allowedPaths: ["fixture.txt"],
    readPaths: ["fixture.txt"],
    workClass: "bounded_implementation",
    planState: "complete",
    risk: "low",
    difficulty: "low",
    decisionImpact: "limited",
    isLocalCandidateOnly: true,
    hasUnresolvedDirection: false,
    requiresCrossContextAlignment: false,
  }));
  const expiresAtMs = Date.now() + 60_000;
  const admitted =
    await session.requestRuntimeOwnedDevelopmentMeasurementSession(
      {
        repositoryRoot: root,
        expectedCommit: "a".repeat(40),
        expectedTree: "b".repeat(40),
        expectedPackageContentRootSha256: "c".repeat(64),
        nativeDistributionRoot: path.join(root, ".crdd", "native-fixture"),
        expectedNativeRelease: {
          manifestHash: "d".repeat(64),
          releaseSequence: 1,
          crddVersion: "v0.18.0",
          crddCommit: "e".repeat(40),
          crddTree: "f".repeat(40),
          packageContentRootSha256: "1".repeat(64),
          runtimeExecutionIdentitySha256: "5".repeat(64),
        },
        tasks,
        expiresAtMs,
      },
      new AbortController().signal,
    );
  assert.ok(admitted.capability);
  const boundary = session.reserveRuntimeOwnedDevelopmentMeasurementTask(
    admitted.capability,
    tasks[0],
    root,
  );
  assert.ok(boundary);
  assert.equal(boundary.bindOperation(management, repositoryBinding), true);
  const cleanupContext =
    session.inspectRuntimeOwnedDevelopmentOperationContext(
      management,
    )?.cleanupContext;
  assert.ok(cleanupContext);
  const context =
    scenario === "unknown-context"
      ? {}
      : scenario.startsWith("cleanup-")
        ? cleanupContext
        : boundary.context;
  if (scenario === "normal") {
    const first = session.borrowRuntimeOwnedDevelopmentNativeObservation(
      context,
      false,
    );
    const second = session.borrowRuntimeOwnedDevelopmentNativeObservation(
      context,
      false,
    );
    assert.ok(first && second);
    assert.equal(Reflect.get(first, "verification"), verifications.at(-2));
    assert.equal(Reflect.get(second, "verification"), verifications.at(-1));
    assert.notEqual(
      Reflect.get(first, "verification"),
      Reflect.get(second, "verification"),
    );
  }
  if (scenario.endsWith("cancel")) {
    assert.equal(
      session.cancelRuntimeOwnedDevelopmentMeasurementSession(
        admitted.capability,
      ),
      true,
    );
  }
  if (scenario.endsWith("expiry")) simulatedTime = expiresAtMs + 1;
  nativeCalls = 0;
  isArmed = true;
  const now = new Date().toISOString();
  const result =
    target === "codex" || target === "claude"
      ? provider.inspectRuntimeOwnedWindowsProviderHomeCandidate(
          target,
          now,
          context,
        )
      : target.startsWith("store")
        ? store.inspectRuntimeOwnedWindowsCandidateStore(
            target.endsWith("-init"),
            now,
            context,
          )
        : store.inspectRuntimeOwnedWindowsRuntimeState(
            target.endsWith("-init"),
            now,
            context,
          );
  const shouldReturnCandidate =
    scenario === "normal" ||
    (scenario.startsWith("cleanup-") && !target.endsWith("-init"));
  assert.equal(result.status, shouldReturnCandidate ? "candidate" : "blocked");
  if (shouldReturnCandidate) {
    assert.equal(
      nativeCalls,
      2,
      "one fresh pre-borrow and one fresh post-borrow; no adapter duplicate",
    );
    assert.equal(spawnCalls, 1);
    assert.equal(result.artifactVerifiedBeforeAndAfter, true);
    const capability =
      "observationCapability" in result
        ? result.observationCapability
        : result.rootCapability;
    assert.ok(capability);
  } else {
    const isAfterSpawn = scenario.startsWith("post-");
    assert.equal(spawnCalls, isAfterSpawn ? 1 : 0);
    assert.equal(result.manualRecoveryRequired, isAfterSpawn);
    const capability =
      "observationCapability" in result
        ? result.observationCapability
        : result.rootCapability;
    assert.equal(capability, null);
  }
  const adapterNativeCalls = nativeCalls;
  assert.equal(
    session.cancelRuntimeOwnedDevelopmentMeasurementSession(
      admitted.capability,
    ),
    true,
  );
  assert.equal(
    session.borrowRuntimeOwnedDevelopmentNativeObservation(
      boundary.context,
      false,
    ),
    null,
  );
  process.stdout.write(
    JSON.stringify({ target, scenario, adapterNativeCalls, spawnCalls }),
  );
}

if (process.argv[2] === "--probe") {
  await runProbe(process.argv[3] ?? "", process.argv[4] ?? "");
} else {
  for (const target of targets)
    for (const scenario of scenarios) {
      test(`本番sessionとnative Adapterの結合: ${target} / ${scenario}`, (context) => {
        if (process.platform !== "win32") {
          context.skip("Windows native adapter");
          return;
        }
        const result = spawnSync(
          process.execPath,
          [
            "--experimental-test-module-mocks",
            "--no-warnings",
            fileURLToPath(import.meta.url),
            "--probe",
            target,
            scenario,
          ],
          { encoding: "utf8", shell: false, timeout: 15_000 },
        );
        assert.equal(result.status, 0, result.stderr);
        assert.deepEqual(
          [
            JSON.parse(result.stdout).target,
            JSON.parse(result.stdout).scenario,
          ],
          [target, scenario],
        );
      });
    }
}

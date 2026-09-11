import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  createWindowsDockerCliEnvironment,
  createWindowsNativeHelperEnvironment,
} from "../../src/core/windows-child-environment.ts";
import { inspectRuntimeOwnedDockerTaskRecoveryState } from "../../src/security/docker-recovery-runtime.ts";
import { resolveProjectRuntimePlatformAdapter } from "../../../project-runtime/src/index.ts";
import {
  createProjectRuntimeWindowsPlatformAdapter,
  observeProjectRuntimePlatformFamily,
} from "../../src/security/project-runtime-windows-platform-adapter.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "../../src/security/provider-home-windows-adapter.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../src/security/repository-root-resolution.ts";
import { compileWindowsRootObservationCandidate } from "../../src/security/root-observation.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "../..");

function rootObservation() {
  const entityCount = 3;
  return {
    allOwnersTrusted: true,
    entityCount,
    filesystemClass: "local",
    objectBirthtimeNanoseconds: "1700000000000000000",
    objectDeviceId: "1234",
    objectFileId: "5678",
    otherWriteAceCount: 0,
    reparsePointCount: 0,
    rootDaclProtected: true,
    rootRole: "runtime",
    runtimeDenyAceCount: 0,
    runtimePrincipalIdentityHash: "a".repeat(64),
    runtimePrincipalBinding: "selected_local_user_binding_caller_claim",
    runtimeReadExecuteEntityCount: entityCount,
    runtimeRootInheritanceRuleCount: 1,
    runtimeWriteEntityCount: entityCount,
  };
}

function operations(boundary: string): Readonly<Record<string, unknown>> {
  const adapter = createProjectRuntimeWindowsPlatformAdapter();
  const group = (
    adapter.operations as Readonly<Record<string, Readonly<object> | undefined>>
  )[boundary];
  assert.ok(group, boundary);
  return group as Readonly<Record<string, unknown>>;
}

test("Windows AdapterはPlatform契約の宣言と実操作を一致させる", () => {
  const adapter = createProjectRuntimeWindowsPlatformAdapter();
  assert.deepEqual(adapter.describe(), {
    contract: "crdd-coordinator/project-runtime-platform-contract",
    contractRevision: 1,
    platformFamily: "windows",
    supportedBoundaries: ["principal_provider_home", "lock_lease"],
    satisfiedGuarantees: {
      principal_provider_home: [
        "selected_principal_identity",
        "stable_provider_home_identity",
        "owner_writer_protection",
        "non_link_chain",
      ],
      lock_lease: [
        "os_exclusivity",
        "owner_generation",
        "owner_liveness",
        "non_time_only_takeover",
      ],
      filesystem_repository: [
        "repository_root_identity",
        "bounded_path_resolution",
      ],
      process_cancellation: ["environment"],
      container_host: ["cleanup"],
      runtime_root_recovery: [
        "managed_root",
        "protection",
        "resource_identity",
      ],
    },
    authorityGeneration: "none",
    unsupportedPlatformFallback: "none",
  });
  assert.deepEqual(Object.keys(adapter.operations).sort(), [
    "container_host",
    "filesystem_repository",
    "lock_lease",
    "principal_provider_home",
    "process_cancellation",
    "runtime_root_recovery",
  ]);
});

test("現在ProcessのPlatform familyは閉じた観測として返る", () => {
  assert.deepEqual(observeProjectRuntimePlatformFamily(), {
    status: "observed",
    platformFamily: "windows",
  });
});

test("Lease owner観測は現在Process・不存在・不正入力を区別する", () => {
  const observe = operations("lock_lease").observeLeaseOwner as (
    value: unknown,
  ) => Readonly<Record<string, unknown>>;
  assert.deepEqual(
    observe({ ownerProcessId: process.pid, ownerGeneration: "owner-a" }),
    {
      status: "alive",
      ownerProcessId: process.pid,
      ownerGeneration: "owner-a",
    },
  );
  assert.equal(
    observe({ ownerProcessId: 2_147_483_647, ownerGeneration: "owner-a" })
      .status,
    "absent",
  );
  assert.deepEqual(observe({ ownerProcessId: 0, ownerGeneration: "owner-a" }), {
    status: "unknown",
    ownerProcessId: 0,
    ownerGeneration: "invalid",
  });
});

test("Windows Adapterは完成保証だけを解決し、部分抽出境界を対応済みにしない", () => {
  const adapter = createProjectRuntimeWindowsPlatformAdapter();
  const supported = resolveProjectRuntimePlatformAdapter(
    "windows",
    [adapter],
    ["principal_provider_home", "lock_lease"],
  );
  assert.equal(supported.status, "resolved");
  assert.deepEqual(
    resolveProjectRuntimePlatformAdapter(
      "windows",
      [adapter],
      [
        "filesystem_repository",
        "process_cancellation",
        "container_host",
        "runtime_root_recovery",
      ],
    ),
    {
      status: "blocked",
      reason: "platform_boundary_unsupported",
      unsupportedBoundaries: [
        "filesystem_repository",
        "process_cancellation",
        "container_host",
        "runtime_root_recovery",
      ],
    },
  );
});

test("Repository Root解決は既存実装と同じ受理・拒否を閉結果で返す", () => {
  const group = operations("filesystem_repository");
  const resolveRepositoryRoot = group.resolveRepositoryRoot as (
    workingDirectory: unknown,
  ) => Readonly<Record<string, unknown>>;
  const resolved = resolveRepositoryRoot(coordinatorRoot);
  assert.deepEqual(resolved, {
    status: "resolved",
    repositoryRoot:
      resolveVerifiedRepositoryRootFromWorkingDirectory(coordinatorRoot),
  });
  for (const invalid of ["relative/path", "", 7, null, "C:\\path\u0000"])
    assert.deepEqual(resolveRepositoryRoot(invalid), {
      status: "blocked",
      reason: "repository_working_directory_invalid",
    });
});

test("子Process環境の導出は既存Profileと同一の値を閉結果で返す", () => {
  const group = operations("process_cancellation");
  const deriveChildEnvironment = group.deriveChildEnvironment as (
    request: unknown,
  ) => Readonly<Record<string, unknown>>;
  const nativeDirect = createWindowsNativeHelperEnvironment();
  const nativeRouted = deriveChildEnvironment({ profile: "native_helper" });
  if (nativeDirect === null)
    assert.deepEqual(nativeRouted, {
      status: "blocked",
      reason: "windows_child_environment_unavailable",
    });
  else
    assert.deepEqual(nativeRouted, {
      status: "derived",
      profile: "native_helper",
      environment: nativeDirect,
    });
  const dockerDirect = createWindowsDockerCliEnvironment({
    dockerConfig: "C:\\docker-config",
    dockerHome: "C:\\docker-home",
  });
  assert.deepEqual(
    deriveChildEnvironment({
      profile: "docker_cli",
      dockerConfig: "C:\\docker-config",
      dockerHome: "C:\\docker-home",
    }),
    {
      status: "derived",
      profile: "docker_cli",
      environment: dockerDirect,
    },
  );
  for (const invalid of [
    null,
    {},
    { profile: "unknown_profile" },
    { profile: "native_helper", extra: true },
    { profile: "docker_cli", dockerConfig: "C:\\only-config" },
    {
      profile: "docker_cli",
      dockerConfig: "C:\\only-config",
      dockerHome: null,
    },
    { profile: "docker_cli", dockerConfig: null, dockerHome: "C:\\only-home" },
    { profile: "docker_cli", dockerConfig: 7, dockerHome: "C:\\home" },
  ])
    assert.deepEqual(deriveChildEnvironment(invalid), {
      status: "blocked",
      reason: "windows_child_environment_request_invalid",
    });
});

test("Runtime Root保護観測は既存実装と同一のHash候補・拒否を返す", () => {
  const group = operations("runtime_root_recovery");
  const compileRootObservationCandidate =
    group.compileRootObservationCandidate as (
      rawObservation: unknown,
    ) => Readonly<Record<string, unknown>>;
  assert.deepEqual(
    compileRootObservationCandidate(rootObservation()),
    compileWindowsRootObservationCandidate(rootObservation()),
  );
  assert.deepEqual(
    compileRootObservationCandidate({}),
    compileWindowsRootObservationCandidate({}),
  );
});

test("Provider Home観測は既存実装と同一の閉じた拒否を返す", () => {
  const group = operations("principal_provider_home");
  const observeProviderHomeCandidate = group.observeProviderHomeCandidate as (
    provider: unknown,
    evaluationTime: unknown,
  ) => Readonly<Record<string, unknown>>;
  for (const [provider, evaluationTime] of [
    [42, "2026-09-02T00:00:00.000Z"],
    ["unknown-provider", "2026-09-02T00:00:00.000Z"],
    ["codex", "not-a-time"],
  ] as const)
    assert.deepEqual(
      observeProviderHomeCandidate(provider, evaluationTime),
      inspectRuntimeOwnedWindowsProviderHomeCandidate(provider, evaluationTime),
    );
});

test("Container Host回復状態の観測は既存実装と同じ分類を返す", () => {
  const group = operations("container_host");
  const observeContainerHostRecoveryState =
    group.observeContainerHostRecoveryState as () => Readonly<
      Record<string, unknown>
    >;
  const routed = observeContainerHostRecoveryState();
  const direct = inspectRuntimeOwnedDockerTaskRecoveryState();
  assert.deepEqual(routed, direct);
});

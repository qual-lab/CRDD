/**
 * coordinator:unit:project-runtime-windows-platform-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:project-runtime-windows-platform-adapterが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope project、runtime、windows、platform、adapter
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { compileWindowsRootObservationCandidate } from "../../src/security/root-observation.ts";

const coordinatorRoot = path.resolve(import.meta.dirname, "../..");

/**
 * rootObservationのTest準備責務を実行する。
 *
 * @responsibility rootObservationがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus rootObservationを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * operationsのTest準備責務を実行する。
 *
 * @responsibility operationsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace PRL-UT-014
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus operationsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
function operations(boundary: string): Readonly<Record<string, unknown>> {
  const adapter = createProjectRuntimeWindowsPlatformAdapter();
  const group = (
    adapter.operations as Readonly<Record<string, Readonly<object> | undefined>>
  )[boundary];
  assert.ok(group, boundary);
  return group as Readonly<Record<string, unknown>>;
}

/**
 * Windows AdapterはPlatform契約の宣言と実操作を一致させるを検証する。
 *
 * @responsibility Windows AdapterはPlatform契約の宣言と実操作を一致させるの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows AdapterはPlatform契約の宣言と実操作を一致させるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * 現在ProcessのPlatform familyは閉じた観測として返るを検証する。
 *
 * @responsibility 現在ProcessのPlatform familyは閉じた観測として返るの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 現在ProcessのPlatform familyは閉じた観測として返るの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
test("現在ProcessのPlatform familyは閉じた観測として返る", () => {
  assert.deepEqual(observeProjectRuntimePlatformFamily(), {
    status: "observed",
    platformFamily: "windows",
  });
});

/**
 * Lease owner観測は現在Process・不存在・不正入力を区別するを検証する。
 *
 * @responsibility Lease owner観測は現在Process・不存在・不正入力を区別するの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Lease owner観測は現在Process・不存在・不正入力を区別するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * Windows Adapterは完成保証だけを解決し、部分抽出境界を対応済みにしないを検証する。
 *
 * @responsibility Windows Adapterは完成保証だけを解決し、部分抽出境界を対応済みにしないの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Windows Adapterは完成保証だけを解決し、部分抽出境界を対応済みにしないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * Repository Root解決は既存実装と同じ受理・拒否を閉結果で返すを検証する。
 *
 * @responsibility Repository Root解決は既存実装と同じ受理・拒否を閉結果で返すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository Root解決は既存実装と同じ受理・拒否を閉結果で返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * 子Process環境の導出は既存Profileと同一の値を閉結果で返すを検証する。
 *
 * @responsibility 子Process環境の導出は既存Profileと同一の値を閉結果で返すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 子Process環境の導出は既存Profileと同一の値を閉結果で返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * Runtime Root保護観測は既存実装と同一のHash候補・拒否を返すを検証する。
 *
 * @responsibility Runtime Root保護観測は既存実装と同一のHash候補・拒否を返すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Runtime Root保護観測は既存実装と同一のHash候補・拒否を返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * Provider Home観測は既存実装と同一の閉じた拒否を返すを検証する。
 *
 * @responsibility Provider Home観測は既存実装と同一の閉じた拒否を返すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Provider Home観測は既存実装と同一の閉じた拒否を返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

/**
 * Container Host回復状態の観測は既存実装と同じ分類を返すを検証する。
 *
 * @responsibility Container Host回復状態の観測は既存実装と同じ分類を返すの合否判定を所有する。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Container Host回復状態の観測は既存実装と同じ分類を返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary N/A: Project Runtime Application Portは外部実行境界を持たない。
 */
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

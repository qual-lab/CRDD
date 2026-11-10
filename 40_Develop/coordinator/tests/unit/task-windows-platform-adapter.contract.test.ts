/**
 * coordinator:unit:task-windows-platform-adapterの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:unit:task-windows-platform-adapterが所有する検証責務を実行する。
 * @trace PRL-UT-014
 * @level UT
 * @scope project、runtime、windows、platform、adapter
 * @boundary PRL-UT-014=N/A: Coordinator Application Portは外部実行境界を持たない。
 */
import { observeLeaseOwner } from "../../src/execution/kernel-lock.ts";
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveCoordinatorPlatformAdapter } from "../../src/execution/diagnostics.ts";
import { createCoordinatorWindowsPlatformAdapter } from "../../src/execution/diagnostics.ts";
import { inspectRuntimeOwnedWindowsProviderHomeCandidate } from "../../src/execution/authority.ts";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { compileWindowsRootObservationCandidate } from "../../src/execution/authority.ts";

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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
function operations(boundary: string): Readonly<Record<string, unknown>> {
  const adapter = createCoordinatorWindowsPlatformAdapter();
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows AdapterはPlatform契約の宣言と実操作を一致させる", () => {
  const adapter = createCoordinatorWindowsPlatformAdapter();
  assert.deepEqual(adapter.describe(), {
    contract: "crdd-coordinator/orchestrator-platform-contract",
    contractRevision: 2,
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
    "filesystem_repository",
    "lock_lease",
    "principal_provider_home",
    "runtime_root_recovery",
  ]);
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows Adapterは完成保証だけを解決し、部分抽出境界を対応済みにしない", () => {
  const adapter = createCoordinatorWindowsPlatformAdapter();
  const supported = resolveCoordinatorPlatformAdapter(
    "windows",
    [adapter],
    ["principal_provider_home", "lock_lease"],
  );
  assert.equal(supported.status, "resolved");
  assert.deepEqual(
    resolveCoordinatorPlatformAdapter(
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @responsibility 廃止した環境導出口を復活させず、取消境界を未対応として拒否する。
 * @trace PRL-UT-014
 * @precondition Windows Adapterと既存resolverだけを使う。
 * @stimulus 取消境界を要求する。
 * @observation 操作group・保証宣言の不存在とblocked。
 * @oracle 操作集合が空でも対応済みにならない。
 * @cleanup メモリだけ。Native・子Processを起動しない。
 */
test("旧子環境導出を公開せず取消境界を未対応で拒否する", () => {
  const adapter = createCoordinatorWindowsPlatformAdapter();
  assert.equal(
    Object.hasOwn(adapter.operations, "process_cancellation"),
    false,
  );
  assert.equal(
    Object.hasOwn(
      adapter.describe().satisfiedGuarantees,
      "process_cancellation",
    ),
    false,
  );
  assert.deepEqual(
    resolveCoordinatorPlatformAdapter(
      "windows",
      [adapter],
      ["process_cancellation"],
    ),
    {
      status: "blocked",
      reason: "platform_boundary_unsupported",
      unsupportedBoundaries: ["process_cancellation"],
    },
  );
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Provider Home観測は既存実装と同一の閉じた拒否を返す", () => {
  const group = operations("principal_provider_home");
  const observeProviderHomeCandidate = group.observeProviderHomeCandidate as (
    provider: unknown,
  ) => Readonly<Record<string, unknown>>;
  for (const provider of [42, "unknown-provider", null])
    assert.deepEqual(
      observeProviderHomeCandidate(provider),
      inspectRuntimeOwnedWindowsProviderHomeCandidate(provider),
    );
});

/**
 * Coordinatorの未使用な旧Container観測候補を撤去する。
 *
 * @responsibility 旧観測だけからContainer保証の部分成立を主張しない。
 * @trace PRL-UT-014
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 現在のAdapter公開集合と保証を観測する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-UT-014=Direct Boundary: coordinator Test Source→対象契約
 */
test("Container Hostの旧全域観測を公開せず未対応境界を成立扱いしない", () => {
  const adapter = createCoordinatorWindowsPlatformAdapter();
  assert.equal("container_host" in adapter.operations, false);
  assert.equal(
    "container_host" in adapter.describe().satisfiedGuarantees,
    false,
  );
  assert.equal(
    adapter
      .describe()
      .supportedBoundaries.some(
        (boundary: string) => boundary === "container_host",
      ),
    false,
  );
});

/**
 * 不正PIDはOS要求を発行しない。
 * @responsibility 入力拒否をProcess観測前に固定する。
 * @trace PRL-UT-014
 * @precondition Process.killを呼出し記録へ置換する。
 * @stimulus 不正PIDと正のPIDを渡す。
 * @observation 返却状態、呼出し回数とsignal。
 * @oracle 不正値はunknown・0要求、正のPIDはSignal 0だけ。
 * @cleanup Test mockを復元する。
 * @boundary PRL-UT-014=Direct Boundary: PID入力→Process API。
 */
test("PID検査は不正値でOS観測0、正常値でSignal 0だけを発行する", (t) => {
  const kill = t.mock.method(process, "kill", () => true);
  for (const pid of [null, undefined, "1", 0, -1, 1.5, NaN, Infinity, {}])
    assert.equal(
      observeLeaseOwner({ ownerProcessId: pid, ownerGeneration: "owner-a" })
        .status,
      "unknown",
    );
  assert.equal(kill.mock.callCount(), 0);
  assert.equal(
    observeLeaseOwner({
      ownerProcessId: process.pid,
      ownerGeneration: "owner-a",
    }).status,
    "alive",
  );
  assert.deepEqual(kill.mock.calls[0]?.arguments, [process.pid, 0]);
});

/**
 * 不存在と観測不能を分ける。
 * @responsibility OS失敗の閉じた分類を維持する。
 * @trace PRL-UT-014
 * @precondition Process.killを固定失敗へ置換する。
 * @stimulus ESRCH、EPERM、その他の失敗を注入する。
 * @observation 各状態。
 * @oracle ESRCHだけabsent、他はunknown。
 * @cleanup Test mockを復元する。
 * @boundary PRL-UT-014=Direct Boundary: OS失敗→観測結果。
 */
test("ESRCHだけを不存在としEPERMと未知の失敗をunknownへ残す", (t) => {
  let failure: unknown;
  t.mock.method(process, "kill", () => {
    throw failure;
  });
  for (const [error, expected] of [
    [{ code: "ESRCH" }, "absent"],
    [{ code: "EPERM" }, "unknown"],
    [{ code: "EACCES" }, "unknown"],
    [new Error("synthetic"), "unknown"],
    [null, "unknown"],
  ] as const) {
    failure = error;
    assert.equal(
      observeLeaseOwner({
        ownerProcessId: process.pid,
        ownerGeneration: "owner-a",
      }).status,
      expected,
    );
  }
});

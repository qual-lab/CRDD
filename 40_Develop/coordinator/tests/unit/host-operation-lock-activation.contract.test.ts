/**
 * 共有回復Directoryの初期化失敗とHost清掃前の保持検査を検証する。
 *
 * @packageDocumentation
 * @responsibility 非Authority依存で初期化・失効・回収不明と共有Directory非削除を反証する。
 * @trace PRL-UT-006
 * @level UT
 * @scope coordinator、host-operation-lock、activation、shared-host-recovery-directory
 * @boundary PRL-UT-006=Direct Boundary: Test→Host Lock取得settlement
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import { runInNewContext } from "node:vm";
import { recoverDockerIsolationProbe } from "../../src/execution/diagnostics.ts";
import { createIsolatedSharedHostRecoveryDirectoryCandidate } from "../../src/execution/operation.ts";

/**
 * 共有Directoryの初期化と不明分類を局所依存で確認する。
 *
 * @responsibility mkdirだけのEEXIST合流、fresh検証、全失敗の保持を確認する。
 * @trace PRL-UT-006
 * @precondition 実Filesystem・Process・本番Capabilityを使わない。
 * @stimulus 存在観測、mkdir、検証の各段階へ成功・競合・失敗を与える。
 * @observation 依存呼出し順、返却Identity、InitializationFailure分類を記録する。
 * @oracle 検証済み結果だけを返し、不明時は清掃未確認・回復IDなしを保持する。
 * @cleanup N/A: 同期局所値だけであり、削除依存・I/O・handleを持たない。
 * @boundary PRL-UT-006=Direct Boundary: Test依存→本番共有初期化settlement
 */
test("共有回復DirectoryはOperation失敗で削除せず、競合後もfresh検証する", async (t) => {
  const existsError = Object.assign(new Error("exists"), { code: "EEXIST" });
  const cases: ReadonlyArray<{
    name: string;
    before: "present" | "confirmed_absent" | "unknown";
    observationError?: Error;
    creationError?: Error;
    validationError?: Error;
    succeeds: boolean;
    calls: string[];
  }> = [
    {
      name: "既存の検証成功",
      before: "present",
      succeeds: true,
      calls: ["observe", "validate"],
    },
    {
      name: "作成後の検証成功",
      before: "confirmed_absent",
      succeeds: true,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "mkdir存在競合後の検証成功",
      before: "confirmed_absent",
      creationError: existsError,
      succeeds: true,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "初期観測unknown",
      before: "unknown",
      succeeds: false,
      calls: ["observe"],
    },
    {
      name: "初期観測throw",
      before: "present",
      observationError: new Error("observation_failed"),
      succeeds: false,
      calls: ["observe"],
    },
    {
      name: "mkdir結果不明",
      before: "confirmed_absent",
      creationError: new Error("create_unknown"),
      succeeds: false,
      calls: ["observe", "create"],
    },
    {
      name: "mkdir後Identity取得throw",
      before: "confirmed_absent",
      validationError: new Error("identity_unknown"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "既存Directory検証失敗",
      before: "present",
      validationError: new Error("untrusted_directory"),
      succeeds: false,
      calls: ["observe", "validate"],
    },
    {
      name: "EEXIST後のPath不一致",
      before: "confirmed_absent",
      creationError: existsError,
      validationError: new Error("path_mismatch"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "EEXIST後のreparse拒否",
      before: "confirmed_absent",
      creationError: existsError,
      validationError: new Error("reparse_rejected"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "EEXIST後Identity取得throw",
      before: "confirmed_absent",
      creationError: existsError,
      validationError: new Error("identity_unknown"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "EEXIST後の検証unknown",
      before: "confirmed_absent",
      creationError: existsError,
      validationError: new Error("validation_unknown"),
      succeeds: false,
      calls: ["observe", "create", "validate"],
    },
    {
      name: "検証で発生したEEXISTは合流しない",
      before: "present",
      validationError: existsError,
      succeeds: false,
      calls: ["observe", "validate"],
    },
  ];
  for (const condition of cases) {
    /**
     * 指定した共有初期化条件の結果と呼出し順を確認する。
     *
     * @responsibility 存在通知だけの成功化と、失敗時の清掃確認trueへの既定化を拒否する。
     * @trace PRL-UT-006
     * @precondition 各conditionが成功または一つの失敗段階を指定する。
     * @stimulus 同じ本番settlementへ非Authority依存を一回渡す。
     * @observation 呼出し順、同じ返却Identity、清掃未確認とnull回復ID。
     * @oracle conditionの固定期待値と一致し、削除・marker・Root依存が存在しない。
     * @cleanup N/A: 局所同期値だけであり、実資源を生成しない。
     * @boundary PRL-UT-006=Direct Boundary: Test依存→共有初期化settlement
     */
    await t.test(condition.name, () => {
      const calls: string[] = [];
      const directory = Object.freeze({
        directory: "non-authority-fixture",
        identity: Object.freeze({ dev: 1n, ino: 2n, birthtimeNs: 3n }),
      });
      const candidate = createIsolatedSharedHostRecoveryDirectoryCandidate({
        observe: () => {
          calls.push("observe");
          if (condition.observationError) throw condition.observationError;
          return condition.before;
        },
        create: () => {
          calls.push("create");
          if (condition.creationError) throw condition.creationError;
        },
        validate: () => {
          calls.push("validate");
          if (condition.validationError) throw condition.validationError;
          return directory;
        },
      });
      assert.equal(candidate.productionAuthority, false);
      if (condition.succeeds) {
        assert.equal(candidate.initialize(), directory);
      } else {
        let failure: unknown = null;
        assert.throws(
          () => {
            try {
              candidate.initialize();
            } catch (error) {
              failure = error;
              throw error;
            }
          },
          { message: "host_recovery_initialization_failed" },
        );
        assert.deepEqual(candidate.classifyFailure(failure), {
          cleanupConfirmed: false,
          hostRecoveryId: null,
        });
      }
      assert.deepEqual(calls, condition.calls);
    });
  }
});

/**
 * 本番の診断回復関数へ非Authorityの局所依存を与える。
 *
 * @responsibility 本番関数のbodyを複製・書換えず、解析・取得・対象読取り・利用・解放の順序を観測する。
 * @trace PRL-UT-006
 * @precondition 現在importした関数のbodyだけを使用し、OSとDockerへ接続しない。
 * @stimulus 指定した一つの依存失敗を同じ本番bodyへ与える。
 * @observation 依存の呼出順、同一排他Object、返却理由とexact参照。
 * @oracle 未取得ではDocker利用0、成功以前に解放確認、失敗でも取得済み排他を一回処置する。
 * @cleanup N/A: VMと局所値のみで、実handle・timer・Processを生成しない。
 * @boundary PRL-UT-006=Direct Boundary: 局所依存→本番診断回復body
 */
function createProbeRecoveryOrderingFixture(
  fault:
    | "none"
    | "token"
    | "generation"
    | "parent"
    | "acquire"
    | "acquire_throw"
    | "record"
    | "docker"
    | "release"
    | "binding"
    | "host_nonce",
) {
  const events: string[] = [];
  const generation = Object.freeze({});
  const hostNonce = "4fdc962b-51d0-4e90-8ec6-7c37374213b5";
  const rootName = `crdd-coordinator-doctor-${hostNonce}`;
  const context = {
    parseDockerProbeRecoveryToken: (reference: unknown) => {
      assert.equal(reference, "exact-probe-reference");
      events.push("parse");
      if (fault === "token") throw new Error("token_invalid");
      return {
        rootName:
          fault === "generation" ? "crdd-coordinator-doctor-fixture" : rootName,
        nonce: "a074ebad-e48b-4241-9f43-4399f042cf0c",
      };
    },
    os: { tmpdir: () => "fixed-parent" },
    fs: {
      realpathSync: (value: unknown) => {
        assert.equal(value, "fixed-parent");
        events.push("parent");
        if (fault === "parent") throw new Error("parent_unknown");
        return "fixed-parent";
      },
    },
    path: {
      isAbsolute: () => true,
      resolve: (value: unknown) => value,
      basename: () => rootName,
      dirname: () => "fixed-parent",
      join: (parent: unknown, name: unknown) => {
        assert.equal(parent, "fixed-parent");
        assert.equal(name, rootName);
        return `fixed-parent/${rootName}`;
      },
    },
    loadDockerProbeRecoveryRecord: () => {
      events.push("read");
      if (fault === "record") throw new Error("read_unknown");
      return {
        parsed: { rootName },
        children: { management: "fixed-management" },
        record: {
          rootName,
          hostRecoveryId: "exact-host-reference",
          probeId: "fixed-probe",
          container: { id: "fixed-container" },
        },
      };
    },
    parseHostRecoveryToken: () => ({
      rootName: fault === "binding" ? "other-root" : rootName,
      nonce:
        fault === "host_nonce"
          ? "a074ebad-e48b-4241-9f43-4399f042cf0c"
          : hostNonce,
    }),
    acquireHostOperationRecoveryGenerationByIdentity: (
      root: unknown,
      nonce: unknown,
    ) => {
      assert.equal(root, `fixed-parent/${rootName}`);
      assert.equal(nonce, hostNonce);
      events.push("acquire");
      if (fault === "acquire_throw") throw new Error("acquire_unknown");
      return fault === "acquire" ? null : generation;
    },
    releaseHostOperationRecoveryGeneration: (owner: unknown) => {
      assert.equal(owner, generation);
      events.push("release");
      return fault !== "release";
    },
    requireDockerProbeRecoveryMounts: () => ({
      workspace: "w",
      providerHome: "h",
      tmp: "t",
    }),
    describeDockerProbeConfiguration: () => ({}),
    absenceCapabilities: new WeakMap(),
    verifyHostOperationRecoveryGeneration: () => {},
    inspectResources: () => {
      events.push("docker");
      if (fault === "docker") throw Error("docker_unknown");
      return { observation: "absent", runningConfirmed: false, snapshot: null };
    },
    cleanupResources: () => {
      throw Error("unexpected_cleanup");
    },
    observeContainerAbsence: () => Object.freeze({}),
    confirmDockerAbsence: () => {
      events.push("confirm");
      return { hostRecoveryId: "exact-current-host-reference" };
    },
    recoverOwnedOperationDirectories: (reference: unknown, owner: unknown) => {
      assert.equal(reference, "exact-current-host-reference");
      assert.equal(owner, generation);
      events.push("cleanup");
      return { status: "recovered", reason: "fixed_cleanup_complete" };
    },
    normalizeHostCleanupResult: () => ({
      status: "recovered",
      reason: "docker_probe_recovery_completed",
      recoveryId: null,
      hostCleanupCompleted: true,
      cleanup: "confirmed",
      retainOperationDirectories: false,
    }),
    normalizeFailure: () => "fixed_dependency_failure",
  };
  const recover = runInNewContext(
    `(${recoverDockerIsolationProbe.toString()})`,
    context,
    { timeout: 1_000 },
  ) as typeof recoverDockerIsolationProbe;
  return { events, recover };
}

/**
 * 診断回復の対象排他をDocker利用前から最終解放まで維持する。
 *
 * @responsibility 三種の回復経路で共用するHost排他への診断回復接続を反証する。
 * @trace PRL-UT-006
 * @precondition 非Authority依存と現在の本番関数bodyを使用する。
 * @stimulus 正常、入力／世代／親不正、取得null／throw、記録不明、二種のHost結合差、Docker失敗と解放不明を与える。
 * @observation 十一経路の順序、返却状態、exact参照、清掃確認field。
 * @oracle 未取得では対象読取り0・Docker0。HostとProbeのnonceを分け、取得後は同じOwnerを清掃へ渡して一回解放する。
 * @cleanup N/A: 実OS・Docker・Filesystem資源は生成しない。
 * @boundary PRL-UT-006=Direct Boundary: 本番診断回復body→局所依存
 */
test("診断回復は対象排他を先に取得し同じOwnerを清掃・解放へ渡す", () => {
  const normal = createProbeRecoveryOrderingFixture("none");
  assert.equal(
    normal.recover(
      "exact-probe-reference",
      "fixed-parent/crdd-coordinator-doctor-4fdc962b-51d0-4e90-8ec6-7c37374213b5",
    ).status,
    "recovered",
  );
  assert.deepEqual(normal.events, [
    "parse",
    "parent",
    "acquire",
    "read",
    "read",
    "docker",
    "read",
    "confirm",
    "cleanup",
    "release",
  ]);
  for (const fault of [
    "token",
    "generation",
    "parent",
    "acquire",
    "acquire_throw",
    "record",
    "docker",
    "release",
    "binding",
    "host_nonce",
  ] as const) {
    const fixture = createProbeRecoveryOrderingFixture(fault);
    const result = fixture.recover(
      "exact-probe-reference",
      "fixed-parent/crdd-coordinator-doctor-4fdc962b-51d0-4e90-8ec6-7c37374213b5",
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.hostCleanupCompleted, false);
    assert.equal(
      result.recoveryId,
      fault === "release"
        ? "exact-current-host-reference"
        : "exact-probe-reference",
    );
    assert.equal(
      fixture.events.filter((event) => event === "release").length,
      ["token", "generation", "parent", "acquire", "acquire_throw"].includes(
        fault,
      )
        ? 0
        : 1,
    );
    if (
      ["token", "generation", "parent", "acquire", "acquire_throw"].includes(
        fault,
      )
    )
      assert.equal(fixture.events.includes("read"), false);
    if (fault !== "release" && fault !== "docker")
      assert.equal(fixture.events.includes("docker"), false);
    if (fault === "release") {
      assert.ok("cleanup" in result);
      assert.ok("retainOperationDirectories" in result);
      assert.equal(result.cleanup, "unconfirmed");
      assert.equal(result.retainOperationDirectories, true);
    }
  }
});

/**
 * Host清掃の破壊Effect前に元世代の保持確認を通ることを検査する。
 * @trace PRL-UT-006
 * @boundary 本番関数bodyと有限依存。Filesystem・Docker・子Processは使わない。
 */
test("Host清掃は待機後のLock不一致を読取り・削除より前に拒否する", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/operation.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    sourceDeclaration(source, "removeOwnedOperationRootForCleanup"),
  );
  const owned = {},
    identity = { root: "fixed-root", hostRecovery: { nonce: "fixed-nonce" } };
  let checks = 0,
    effects = 0;
  const cleanup = runInNewContext(
    `${body}\nremoveOwnedOperationRootForCleanup`,
    {
      ownedIdentity: () => identity,
      isObject: () => true,
      ownedOperationGeneration: (
        _owned: object,
        _identity: object,
        allowRetired?: boolean,
      ) => {
        assert.equal(_owned, owned);
        assert.equal(_identity, identity);
        assert.notEqual(allowRetired, true);
        checks++;
        throw new Error("owned_operation_generation_liveness_lost");
      },
      errorMessage: (error: Error) => error.message,
      fs: {
        realpathSync: () => {
          effects++;
        },
        rmSync: () => {
          effects++;
        },
      },
    },
  ) as (owned: object) => void;
  assert.throws(() => cleanup(owned), /owned_operation_directory_replaced/);
  assert.equal(checks, 1);
  assert.equal(effects, 0);
});

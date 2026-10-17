/**
 * coordinator:system:signed-recovery-matrix-verificationの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:system:signed-recovery-matrix-verificationが所有する検証責務を実行する。
 * @trace PRL-ST-004
 * @level ST
 * @scope signed、recovery、matrix、verification
 * @boundary PRL-ST-004=System/E2E: 公開入口→Runtime→耐久Store→回復再入場
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";

import {
  describeSignedRecoveryMatrixContract,
  SIGNED_RECOVERY_MATRIX_CONTRACT,
  SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
} from "../../scripts/verify-signed-recovery-matrix.ts";

/**
 * 固定Worker回復Matrixは通常Task入力へFault注入面を追加しないことを検証する。
 *
 * @responsibility 固定Worker回復Matrixが通常Task入力へFault注入面を追加しないことの合否判定を所有する。
 * @trace PRL-ST-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 固定Worker回復Matrixの契約説明を取得する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("固定Worker回復Matrixは通常Task入力へFault注入面を追加しない", () => {
  const contract = describeSignedRecoveryMatrixContract();
  assert.equal(contract.contract, SIGNED_RECOVERY_MATRIX_CONTRACT);
  assert.equal(
    contract.contractRevision,
    SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
  );
  assert.equal(contract.normalTaskSchemaChanged, false);
  assert.equal(contract.publicScenarioArgumentsAllowed, false);
  assert.equal(
    contract.parentLoss,
    "real_child_process_termination_then_fresh_recovery",
  );
  assert.deepEqual(contract.fixedScenarios, [
    "nonzero_exit",
    "timeout",
    "output_limit",
    "invalid_output",
    "cancel",
    "parent_process_loss_then_fresh_recovery",
    "cleanup_observation_unknown_then_recover",
  ]);
  assert.equal(contract.providerCredentialAllowed, false);
  assert.equal(contract.providerNetworkAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.paidApiFallbackAllowed, false);
  assert.equal(contract.signatureRequired, false);
  assert.equal(contract.packageVerification, "not_required");
  assert.equal(contract.contractRevision, 2);
});

/**
 * 回復試験の実本文が署名資格なしで同じ七形へ進むことを確認する。
 * @responsibility Node拒否、実行順序と回復失敗の公開結果を独立した期待値で照合する。
 * @trace PRL-ST-004
 * @precondition 実Script本文と既存固定シナリオを読み取れる。
 * @stimulus 対応／未対応Node、回復失敗、一般例外、Node判定の省略と後置を与える。
 * @observation 呼出し順序、結果field、exact回復IDを観測する。
 * @oracle 未対応時のEffectは0、対応時は七形、失敗は非成功のままIDを保持する。
 * @cleanup N/A: VM内の模擬シナリオだけで、実Docker／Host資源を作らない。
 * @boundary Script入口→既存シナリオの呼出し。実シナリオの成立とは区別する。
 */
test("回復Matrixは署名資格を要求せずNode境界と七形を保持する", async () => {
  const source = fs.readFileSync(
    new URL("../../scripts/verify-signed-recovery-matrix.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(
    source,
    /package-verification\.ts|issueRuntimeOwnedVerifiedCoordinatorPackageCapability|qualLabManifestCryptographicMatch|verifySignedPackagePrerequisite/u,
  );
  const classBody = source.slice(
    source.indexOf("class RecoveryMatrixFailure"),
    source.indexOf("\n/**", source.indexOf("class RecoveryMatrixFailure")),
  );
  const blockedBody = source.slice(
    source.indexOf("function blocked("),
    source.indexOf("\n/**", source.indexOf("function blocked(")),
  );
  const start = source.indexOf(
    "export async function runSignedRecoveryMatrixVerification()",
  );
  const body = source
    .slice(start, source.indexOf("\n/**", start))
    .replace("export ", "");
  const nodeCheck =
    '  if (!isSupportedCoordinatorNodeRuntime(process.versions.node))\n    return blocked("signed_recovery_matrix_node_version_unsupported");\n';
  assert.equal(body.split(nodeCheck).length, 2);
  /**
   * 実本文を閉じた模擬環境で評価する。
   * @responsibility 呼出し母集団と公開結果を実際のScript本文へ結合する。
   * @trace PRL-ST-004
   * @precondition 本文のNode判定位置を一意に確認済み。
   * @stimulus 対応状態と失敗形を固定する。
   * @observation シナリオ呼出し順序と結果を返す。
   * @oracle 実外部Effectを使わず本文の条件を観測する。
   * @cleanup N/A: VM局所値のみ。
   * @boundary VM内のScript本文と固定模擬依存。
   */
  const evaluate = async (
    candidate: string,
    supported: boolean,
    failure: "none" | "recovery" | "general" = "none",
  ) => {
    const events: string[] = [];
    let injected: unknown;
    const context = {
      SIGNED_RECOVERY_MATRIX_CONTRACT,
      SIGNED_RECOVERY_MATRIX_CONTRACT_REVISION,
      MINIMUM_COORDINATOR_NODE_VERSION: "24.12.0",
      process: { versions: { node: "24.19.0" } },
      isSupportedCoordinatorNodeRuntime: (version: string) => {
        assert.equal(version, "24.19.0");
        events.push("node");
        return supported;
      },
      verifyDynamicFakeProviderFailures: () => {
        events.push("failures");
        return {
          scenarios: [
            "nonzero_exit",
            "timeout",
            "output_limit",
            "invalid_output",
          ].map((scenario) => ({
            scenario,
            status: "verified",
            reason: "fixed",
            cleanup: true,
            residualOperationDirectory: false,
          })),
        };
      },
      verifyDynamicFakeProviderCancellation: async () => {
        events.push("cancel");
        return {
          status: "verified",
          reason: "fixed",
          cleanup: true,
          residualOperationDirectory: false,
        };
      },
      verifyCleanupUnknownThenRecover: async () => {
        events.push("cleanup");
        if (injected) throw injected;
        return { scenario: "cleanup_observation_unknown_then_recover" };
      },
      verifyParentLossThenRecover: async () => {
        events.push("parent");
        return { scenario: "parent_process_loss_then_fresh_recovery" };
      },
    };
    const compiled = stripTypeScriptTypes(
      `${classBody}\n${blockedBody}\n${candidate}\n({ run: runSignedRecoveryMatrixVerification, Failure: RecoveryMatrixFailure });`,
    );
    const actual = runInNewContext(compiled, context) as {
      run: () => Promise<Record<string, unknown>>;
      Failure: new (reason: string, id: string, manual: boolean) => Error;
    };
    const id = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
    if (failure === "recovery")
      injected = new actual.Failure("fixed_recovery_failed", id, true);
    if (failure === "general") injected = new Error("not a public reason");
    const result = JSON.parse(JSON.stringify(await actual.run()));
    if (!supported) {
      assert.deepEqual(events, ["node"]);
      assert.equal(result.status, "blocked");
      assert.equal(
        result.reason,
        "signed_recovery_matrix_node_version_unsupported",
      );
      assert.equal(result.cleanupConfirmed, false);
    } else if (failure === "none") {
      assert.deepEqual(events, [
        "node",
        "failures",
        "cancel",
        "cleanup",
        "parent",
      ]);
      assert.equal(result.status, "completed");
      assert.equal(result.contractRevision, 2);
      assert.equal(result.packageVerification, "not_required");
      assert.equal(result.signatureRequired, false);
      assert.deepEqual(
        result.scenarios.map((item: { scenario: string }) => item.scenario),
        [
          "nonzero_exit",
          "timeout",
          "output_limit",
          "invalid_output",
          "cancel",
          "cleanup_observation_unknown_then_recover",
          "parent_process_loss_then_fresh_recovery",
        ],
      );
    } else {
      assert.deepEqual(events, ["node", "failures", "cancel", "cleanup"]);
      assert.deepEqual(result, {
        contract: SIGNED_RECOVERY_MATRIX_CONTRACT,
        contractRevision: 2,
        status: "blocked",
        reason:
          failure === "recovery"
            ? "fixed_recovery_failed"
            : "signed_recovery_matrix_failed_closed",
        cleanupConfirmed: false,
        manualRecoveryRequired: failure === "recovery",
        rawProviderOutputReported: false,
        hostPathReported: false,
        credentialReported: false,
        ...(failure === "recovery" ? { recoveryId: id } : {}),
      });
    }
  };
  await evaluate(body, false);
  await evaluate(body, true);
  await evaluate(body, true, "recovery");
  await evaluate(body, true, "general");
  await assert.rejects(
    evaluate(body.replace(nodeCheck, ""), false),
    assert.AssertionError,
  );
  await assert.rejects(
    evaluate(
      body
        .replace(nodeCheck, "")
        .replace(
          "    const failures = verifyDynamicFakeProviderFailures();",
          `    const failures = verifyDynamicFakeProviderFailures();\n${nodeCheck}`,
        ),
      false,
    ),
    assert.AssertionError,
  );
});

/**
 * 回復試験の両子モードでRoot生成前のNode拒否を確認する。
 * @responsibility 子入口の判定順序と署名なしの既存残存生成への接続を照合する。
 * @trace PRL-ST-004
 * @precondition 実Script本文を読み取れる。
 * @stimulus 両モードの対応／未対応Nodeと判定省略・Root後への後置を与える。
 * @observation 判定・Root・残存生成・出力・待機の順序を観測する。
 * @oracle 未対応ではRoot生成0、対応時だけ既存処理へ到達する。
 * @cleanup N/A: 子Processや実Rootは作らずVM内で待機を代役にする。
 * @boundary 内部子入口→Rootと残存生成。実回復の成功は主張しない。
 */
test("回復Matrixの両子モードはRoot生成前にNodeを拒否する", async () => {
  const source = fs.readFileSync(
    new URL("../../scripts/verify-signed-recovery-matrix.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("async function runInternalResidueChild(");
  const body = source.slice(start, source.indexOf("\n/**", start));
  const checkStart = body.indexOf("  if (!isSupportedCoordinatorNodeRuntime(");
  const rootStart = body.indexOf(
    "  const owned = createOwnedOperationDirectories();",
  );
  assert.ok(checkStart > 0 && rootStart > checkStart);
  const check = body.slice(checkStart, rootStart);
  /**
   * 実子入口を固定した局所環境で照合する。
   * @responsibility 判定前Effectの有無と二モードの待機差を観測する。
   * @trace PRL-ST-004
   * @precondition Node判定範囲とRoot生成点が一意。
   * @stimulus 本文候補、対応状態と子モードを渡す。
   * @observation 呼出し順序、出力と終了code。
   * @oracle 未対応でRoot0、対応でRootと残存生成が各一回。
   * @cleanup N/A: VM局所値のみ。
   * @boundary 実本文→模擬Root／残存生成。
   */
  const evaluate = async (
    candidate: string,
    supported: boolean,
    wait: boolean,
  ) => {
    const events: string[] = [];
    let output = "";
    const owned = Object.freeze({ root: "owned-test-root" });
    const childProcess = {
      versions: { node: "24.19.0" },
      exitCode: undefined as number | undefined,
      stdout: {
        write: (value: string) => {
          events.push("output");
          output += value;
        },
      },
    };
    const compiled = stripTypeScriptTypes(
      `${candidate}\nrunInternalResidueChild;`,
    );
    const run = runInNewContext(compiled, {
      process: childProcess,
      CHILD_READY_CONTRACT:
        "crdd-coordinator/signed-recovery-matrix-parent-loss-child",
      isSupportedCoordinatorNodeRuntime: (version: string) => {
        assert.equal(version, "24.19.0");
        events.push("node");
        return supported;
      },
      createOwnedOperationDirectories: () => {
        events.push("root");
        return owned;
      },
      createDynamicFakeProviderRecoverableResidue: (value: unknown) => {
        assert.equal(value, owned);
        events.push("residue");
        return {
          status: "ready",
          reason: "fixed",
          recoveryId: "exact-test-id",
          manualRecoveryRequired: true,
        };
      },
      setInterval: () => {
        events.push("wait");
        throw new Error("fixed_wait_boundary");
      },
    }) as (wait: boolean) => Promise<void>;
    if (supported && wait)
      await assert.rejects(run(wait), /fixed_wait_boundary/u);
    else {
      let failure: unknown;
      try {
        await run(wait);
      } catch (error) {
        failure = error;
      }
      assert.equal(failure, undefined);
    }
    const result = JSON.parse(output);
    if (!supported) {
      assert.deepEqual(events, ["node", "output"]);
      assert.deepEqual(result, {
        contract: "crdd-coordinator/signed-recovery-matrix-parent-loss-child",
        status: "blocked",
        reason: "signed_recovery_matrix_node_version_unsupported",
      });
      assert.equal(childProcess.exitCode, 2);
    } else {
      assert.deepEqual(events, [
        "node",
        "root",
        "residue",
        "output",
        ...(wait ? ["wait"] : []),
      ]);
      assert.equal(childProcess.exitCode, undefined);
      assert.deepEqual(result, {
        contract: "crdd-coordinator/signed-recovery-matrix-parent-loss-child",
        status: "ready",
        reason: "fixed",
        recoveryId: "exact-test-id",
        operationRoot: "owned-test-root",
        manualRecoveryRequired: true,
      });
    }
  };
  for (const wait of [false, true]) {
    await evaluate(body, false, wait);
    await evaluate(body, true, wait);
    await assert.rejects(
      evaluate(body.replace(check, ""), false, wait),
      assert.AssertionError,
    );
    const moved = body
      .replace(check, "")
      .replace(
        "  const owned = createOwnedOperationDirectories();",
        `  const owned = createOwnedOperationDirectories();\n${check}`,
      );
    await assert.rejects(evaluate(moved, false, wait), assert.AssertionError);
  }
});

/**
 * 公開CLIは引数なし以外を固定JSONでEffect前に拒否するを検証する。
 *
 * @responsibility 公開CLIは引数なし以外を固定JSONでEffect前に拒否するの合否判定を所有する。
 * @trace PRL-ST-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 公開CLIは引数なし以外を固定JSONでEffect前に拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-ST-004=Direct Boundary: coordinator Test Source→対象契約
 */
test("公開CLIは引数なし以外を固定JSONでEffect前に拒否する", () => {
  const result = spawnSync(
    process.execPath,
    [
      path.resolve("scripts/verify-signed-recovery-matrix.ts"),
      "--scenario",
      "timeout",
    ],
    {
      cwd: path.resolve("."),
      encoding: "utf8",
      windowsHide: true,
    },
  );
  assert.equal(result.status, 2);
  const output = JSON.parse(result.stdout);
  assert.equal(output.status, "blocked");
  assert.equal(output.reason, "signed_recovery_matrix_arguments_invalid");
  assert.equal(output.cleanupConfirmed, false);
  assert.equal(output.manualRecoveryRequired, false);
  assert.equal(output.rawProviderOutputReported, false);
  assert.equal(output.hostPathReported, false);
  assert.equal(output.credentialReported, false);
});

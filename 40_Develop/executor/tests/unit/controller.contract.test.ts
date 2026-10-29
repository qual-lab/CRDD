/**
 * Controller終端の状態・清掃・結果公開の共同条件を反証する。
 * @packageDocumentation
 * @responsibility 元回復参照と五清掃条件の終端投影を検査する。
 * @trace ERB-IT-004
 * @level UT
 * @scope 実宣言の純粋な値投影。実Process・Docker・保存なし。
 * @boundary Executor Controllerの終端結果。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";

/**
 * 五つの清掃条件の全組合せと三終端状態を照合する。
 * @responsibility 一条件の欠測も成功や結果公開へ丸めないことを反証する。
 * @trace ERB-IT-004
 * @precondition 実Controllerの純粋な終端投影宣言だけを構文木から抽出する。
 * @stimulus 32組合せとcompleted／blocked／cancelledを渡す。
 * @observation 状態、元回復参照、本文とHash、回復Capabilityを照合する。
 * @oracle 全条件成立時だけ清掃確定し、本文公開はさらにcompletedを要する。
 * @cleanup N/A: 実Process、保存、Dockerを操作しない。
 * @boundary ERB-IT-004=Direct Boundary: Controller終端の相関不変条件。
 */
test("終端結果は五清掃条件の全32組合せと三状態を混同しない", () => {
  const source = readFileSync(
    new URL("../../src/attempt/controller.ts", import.meta.url),
    "utf8",
  );
  const project = runInNewContext(
    `${sourceDeclaration(source, "createFinalResult")}\ncreateFinalResult`,
  ) as (...args: unknown[]) => Record<string, unknown>;
  const keys = [
    "processTreeTerminationConfirmed",
    "containersAbsent",
    "networksAbsent",
    "mountLeaseReleased",
    "recoveryCompleted",
  ] as const;
  const value = Object.freeze({ synthetic: true });
  const capability = Object.freeze({});
  for (let bits = 0; bits < 32; bits++) {
    const flags = Object.fromEntries(
      keys.map((key, index) => [key, !!(bits & (1 << index))]),
    );
    for (const status of ["completed", "blocked", "cancelled"] as const) {
      const result = project(
        status,
        null,
        { operationId: "OP-000001", selectionRecordId: "selection" },
        "exact-recovery",
        {
          ...flags,
          providerRequestStarted: true,
          cancellationRequested: status === "cancelled",
          resultSha256: "hash",
          resultBytes: 4,
          normalizedResult: value,
          subscriptionAuthConfirmed: true,
          recoveryFinalizationCapability: capability,
        },
      );
      const clean = bits === 31;
      assert.equal(result.cleanupConfirmed, clean);
      assert.equal(result.status, clean ? status : "blocked");
      assert.equal(result.recoveryId, clean ? null : "exact-recovery");
      assert.equal(result.manualRecoveryRequired, !clean);
      assert.equal(
        result.normalizedResult,
        clean && status === "completed" ? value : null,
      );
      assert.equal(
        result.resultSha256,
        clean && status === "completed" ? "hash" : null,
      );
      assert.equal(result.resultBytes, clean && status === "completed" ? 4 : 0);
      assert.equal(
        result.recoveryFinalizationCapability,
        clean ? capability : null,
      );
      assert.equal(result.rawOutputReported, false);
    }
  }
});

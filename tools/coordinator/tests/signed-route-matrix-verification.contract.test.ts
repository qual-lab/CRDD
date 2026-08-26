import assert from "node:assert/strict";
import test from "node:test";

import {
  describeSignedRouteMatrixVerificationContract,
  runSignedRouteMatrixVerification,
} from "../scripts/verify-signed-route-matrix.ts";

function completed(route: string) {
  return Object.freeze({
    status: "completed" as const,
    route,
    cleanupConfirmed: true,
    manualRecoveryRequired: false,
    canonicalRepositoryChanged: false,
  });
}

test("4経路をcross-provider優先で順番に実測し全cleanup後だけ完了する", async () => {
  const seen: string[] = [];
  const result = await runSignedRouteMatrixVerification(process.cwd(), (async (
    _root,
    _dependencies,
    route,
  ) => {
    assert.ok(route);
    seen.push(route);
    return completed(route);
  }) as typeof import("../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification);
  assert.equal(result.status, "completed");
  assert.deepEqual(seen, ["forward", "reverse", "same-codex", "same-claude"]);
  assert.equal(result.completedRouteCount, 4);
  assert.equal(result.cleanupConfirmed, true);
});

test("最初の未完了経路で停止し既知cleanup状態を失わない", async () => {
  const seen: string[] = [];
  const result = await runSignedRouteMatrixVerification(process.cwd(), (async (
    _root,
    _dependencies,
    route,
  ) => {
    assert.ok(route);
    seen.push(route);
    return route === "reverse"
      ? Object.freeze({
          status: "blocked" as const,
          cleanupConfirmed: false,
          manualRecoveryRequired: true,
          canonicalRepositoryChanged: false,
        })
      : completed(route);
  }) as typeof import("../scripts/verify-signed-general-task.ts").runSignedGeneralTaskVerification);
  assert.equal(result.status, "blocked");
  assert.deepEqual(seen, ["forward", "reverse"]);
  assert.equal(result.completedRouteCount, 1);
  assert.equal(result.manualRecoveryRequired, true);
});

test("公開契約は4経路、初期同意再利用、Candidate破棄と課金禁止を固定する", () => {
  const contract = describeSignedRouteMatrixVerificationContract();
  assert.deepEqual(contract.routes, [
    "forward",
    "reverse",
    "same-codex",
    "same-claude",
  ]);
  assert.equal(contract.canonicalRepositoryEffectAllowed, false);
  assert.equal(contract.apiKeyFallbackAllowed, false);
  assert.equal(contract.additionalPurchaseAllowed, false);
});

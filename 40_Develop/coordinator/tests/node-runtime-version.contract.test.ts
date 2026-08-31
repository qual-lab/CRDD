import assert from "node:assert/strict";
import test from "node:test";

import {
  assertSupportedCoordinatorNodeRuntime,
  describeCoordinatorNodeRuntimeVersionContract,
  isSupportedCoordinatorNodeRuntime,
} from "../src/core/node-runtime-version.ts";

test("Node 24.12.0以上だけをCoordinator保守Runtime候補にする", () => {
  for (const value of ["24.12.0", "24.19.0", "25.0.0"]) {
    assert.equal(isSupportedCoordinatorNodeRuntime(value), true);
    assert.doesNotThrow(() => assertSupportedCoordinatorNodeRuntime(value));
  }
  for (const value of [
    "24.11.9",
    "23.99.99",
    "v24.12.0",
    "24.12",
    "24.12.0-pre",
    "01.2.3",
    null,
    Object.freeze({}),
  ]) {
    assert.equal(isSupportedCoordinatorNodeRuntime(value), false);
    assert.throws(
      () => assertSupportedCoordinatorNodeRuntime(value),
      /coordinator_node_version_unsupported/u,
    );
  }
});

test("Node version境界はEffect前Fail ClosedとPATH非Authorityを公開する", () => {
  const contract = describeCoordinatorNodeRuntimeVersionContract();
  assert.equal(contract.minimumVersion, "24.12.0");
  assert.match(contract.checkTiming, /before_interactive_input/u);
  assert.equal(contract.pathLookupAuthority, false);
  assert.equal(contract.unsupportedRuntimeFallbackAllowed, false);
});

import assert from "node:assert/strict";
import test from "node:test";

import { nativeBootstrapEffectReport } from "../scripts/check-native-bootstrap-pe.ts";

test("native PE runnerは固定result報告と実process Network未検証を分離する", () => {
  assert.deepEqual(nativeBootstrapEffectReport(), {
    reportedResult: {
      observationAttempted: false,
      workerSpawnAttempts: 0,
      processEffectIssued: false,
      helperProcessSpawned: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
    },
    staticPeDirectNetworkImports: 0,
    bootstrapProcessNetworkEffect: "not_verified",
    dependencyNetwork: "prohibited_by_cargo_frozen",
  });
});

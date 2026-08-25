import assert from "node:assert/strict";
import test from "node:test";

import { isExactDockerRuntimeStateMutationBoundary } from "../src/security/docker-runtime-state-binding.ts";

const RECOVERY_ID = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
const BINDING = Object.freeze({
  rootPath: "C:\\RuntimeState",
  runtimeStateIdentityHash: "d".repeat(64),
  runtimeStateProtectionHash: "e".repeat(64),
  localUserBindingHash: "f".repeat(64),
  runtimeStateBindingHash: "1".repeat(64),
});

test("RuntimeState mutationはRoot、保護、選択userとRecovery IDの完全一致だけを受理する", () => {
  assert.equal(
    isExactDockerRuntimeStateMutationBoundary(
      BINDING,
      BINDING,
      Object.freeze([RECOVERY_ID]),
      RECOVERY_ID,
    ),
    true,
  );
});

test("Root差替え、別selected-user、別bindingと欠落Recovery IDを拒否する", () => {
  for (const [key, value] of [
    ["rootPath", "D:\\RuntimeState"],
    ["runtimeStateIdentityHash", "2".repeat(64)],
    ["runtimeStateProtectionHash", "3".repeat(64)],
    ["localUserBindingHash", "4".repeat(64)],
    ["runtimeStateBindingHash", "5".repeat(64)],
  ] as const) {
    assert.equal(
      isExactDockerRuntimeStateMutationBoundary(
        BINDING,
        Object.freeze({ ...BINDING, [key]: value }),
        Object.freeze([RECOVERY_ID]),
        RECOVERY_ID,
      ),
      false,
      key,
    );
  }
  assert.equal(
    isExactDockerRuntimeStateMutationBoundary(
      BINDING,
      BINDING,
      Object.freeze([]),
      RECOVERY_ID,
    ),
    false,
  );
});

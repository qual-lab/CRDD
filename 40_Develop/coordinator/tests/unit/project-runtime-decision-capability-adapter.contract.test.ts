import assert from "node:assert/strict";
import test from "node:test";

import { createProjectRuntimeDecisionCapabilityAdapter } from "../../src/security/project-runtime-decision-capability-adapter.ts";

test("判断Capability Adapterは秘密値とHashを別の値として発行する", () => {
  const adapter = createProjectRuntimeDecisionCapabilityAdapter();
  const first = adapter.issue();
  const second = adapter.issue();
  assert.notEqual(first.secret, first.hash);
  assert.equal(adapter.hash(first.secret), first.hash);
  assert.notEqual(first.secret, second.secret);
  assert.notEqual(first.hash, second.hash);
});

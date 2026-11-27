/**
 * Lock受付をファイルシステムに触れずに検証する。
 * @trace ERB-UT-040 ARCH-000008
 * @level UT
 * @boundary ファイルシステムの代役。ファイルと記述子を作らない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { acquireLock } from "../../src/index.ts";

test("不正なLock要求は実体観測前に理由を固定して拒否する", (t) => {
  const observe = t.mock.method(fs, "lstatSync", () => {
    throw new Error("unexpected_observation");
  });
  const open = t.mock.method(fs, "openSync", () => {
    throw new Error("unexpected_lock_open");
  });
  const expected = {
    status: "blocked",
    reason: "lock_input_invalid",
    reference: null,
    cleanupConfirmed: true,
    descriptorClosed: true,
  };
  const valid = {
    directory: process.cwd(),
    name: "state.lock",
    identity: "state:fixture",
  };
  for (const patch of [
    { directory: "relative" },
    { name: "state.txt" },
    { identity: "" },
    { identity: "with spaces" },
  ]) {
    assert.deepEqual(acquireLock({ ...valid, ...patch }), expected);
  }
  assert.equal(observe.mock.callCount(), 0);
  assert.deepEqual(acquireLock(valid), expected);
  assert.deepEqual(
    observe.mock.calls.map(({ arguments: args }) => args),
    [[valid.directory, { bigint: true }]],
  );
  assert.equal(open.mock.callCount(), 0);
});

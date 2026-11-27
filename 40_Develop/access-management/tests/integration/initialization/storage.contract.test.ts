/**
 * 現行Readerは旧初回状態を再開せず、旧材料を保持する。
 * @trace RFD-IT-024
 * @trace RFD-IT-025
 * @boundary 実FilesystemとAMの保存ロック。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  readCurrentAccess,
  readHostInitializationState,
} from "../../../src/index.ts";
import {
  readAccessManagementState,
  updateAccessManagementState,
} from "../../../src/storage/store.ts";
import { fixture, seedRetiredInitialCredential } from "../storage/fixture.ts";

test("旧初回状態・付随する保存材料は再入場で変更されない", (t) => {
  const f = fixture(t);
  const { token, data } = seedRetiredInitialCredential(f);
  const current = path.join(f.directory, "access-management.json");
  const pending = path.join(f.directory, "access-management.pending.json");
  const replace = path.join(f.directory, "access-management.replace.json");
  fs.writeFileSync(pending, "legacy-pending");
  fs.writeFileSync(replace, "legacy-replace");
  const before = fs.readdirSync(f.directory);
  assert.equal(readHostInitializationState(f.root).status, "unknown");
  assert.equal(readCurrentAccess(f.root, token as never).status, "unavailable");
  assert.equal(readAccessManagementState(f.root).status, "unavailable");
  const update = updateAccessManagementState(f.root, 3, () =>
    assert.fail("旧状態を更新しない"),
  );
  assert.equal(update.status, "unavailable");
  assert.equal(update.publication, "not_attempted");
  assert.deepEqual(fs.readFileSync(current), data);
  assert.equal(fs.readFileSync(pending, "utf8"), "legacy-pending");
  assert.equal(fs.readFileSync(replace, "utf8"), "legacy-replace");
  assert.deepEqual(fs.readdirSync(f.directory), before);
});

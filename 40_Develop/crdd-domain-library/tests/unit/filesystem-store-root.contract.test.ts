/**
 * Filesystem Store Root CapabilityのPath境界を検証する。
 *
 * @packageDocumentation
 * @responsibility Root内の相対Pathだけを許可し、Root外・絶対Path・Link親を拒否する。
 * @trace RFD-UT-006
 * @level UT
 * @scope filesystem-store-root、path-authority、link-boundary
 * @boundary Application Store→Filesystem Path。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  createFilesystemStoreRoot,
  resolveFilesystemStorePath,
} from "../../src/filesystem-store-root/index.ts";

/**
 * Root外とLink経由のPathを拒否する。
 * @responsibility Store Root CapabilityがFilesystem Authorityを文字列入力へ拡大しないことを確認する。
 * @trace RFD-UT-006
 * @precondition 実Directory、外部DirectoryおよびRoot内Junctionを用意する。
 * @stimulus 正常相対Path、親移動、絶対PathおよびJunction配下を解決する。
 * @observation 戻りPathと拒否例外を観測する。
 * @oracle 正常PathだけがRoot配下へ解決され、他はすべて拒否される。
 * @cleanup 一時DirectoryとJunctionを削除する。
 * @boundary Filesystem Root Capability→Resolved Store Path。
 */
test("Root外・絶対Path・Link親を拒否する", (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "crdd-store-root-"));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, "root");
  const outside = path.join(base, "outside");
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  const capability = createFilesystemStoreRoot(root);
  assert.ok(capability);
  assert.equal(
    resolveFilesystemStorePath(capability, "state/value.json"),
    path.join(root, "state", "value.json"),
  );
  assert.throws(() => resolveFilesystemStorePath(capability, "../outside/x"));
  assert.throws(() => resolveFilesystemStorePath(capability, outside));
  const linked = path.join(root, "linked");
  fs.symlinkSync(outside, linked, "junction");
  assert.throws(() =>
    resolveFilesystemStorePath(capability, "linked/value.json"),
  );
});

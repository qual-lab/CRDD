/**
 * 認証・AIを起動せず、現行DI作成と元Snapshot保存後のProcess終了を構成する。
 * @responsibility 本番認証構成のcreate/connectだけを使い、元IDの再入場回収を親へ渡す。
 * @trace ERB-IT-017
 * @level IT
 * @scope 明示選択されたWindows Process Gate専用。通常の認証E2Eではない。
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  prepareIsolation,
  executeIsolation,
} from "../../../docker-isolation/src/index.ts";
import type { ResourceSnapshot } from "../../../docker-isolation/src/index.ts";
import {
  authenticationResourceFixture,
  prepareAuthenticationProjection,
} from "../support/authentication.ts";
import {
  createProviderAuthenticationDependencies,
  createProviderAuthenticationRecoveryRecord,
} from "../../src/execution/authority.ts";

const [directory, hash] = process.argv.slice(2);
assert.ok(directory && hash && /^[a-f0-9]{64}$/u.test(hash));
const repository = fileURLToPath(new URL("../../../../", import.meta.url)),
  parent = fs.realpathSync(path.join(repository, ".crdd", "tests"));
assert.equal(path.dirname(fs.realpathSync(directory)), parent);
assert.ok(path.basename(directory).startsWith("claude-authentication-record-"));
const home = path.join(directory, "ProviderHomes", "claude"),
  token = randomBytes(32).toString("hex"),
  management = path.join(directory, "management");
fs.mkdirSync(management);
const projection = prepareAuthenticationProjection(
  "claude",
  "login",
  home,
  hash.slice(0, 16),
  token,
);
assert.ok(projection);
const record = createProviderAuthenticationRecoveryRecord(
  home,
  hash,
  projection,
);
assert.ok(record);
const material = authenticationResourceFixture(
  "claude",
  "login",
  home,
  hash.slice(0, 16),
  token,
  management,
);
const input = {
  ...material.request,
  steps: material.request.steps.filter((step) => step.action !== "run"),
};
const prepared = prepareIsolation(input);
assert.ok(prepared);
const deps = createProviderAuthenticationDependencies(),
  lock = deps.acquireProviderHomeLock(hash);
assert.ok(lock);
assert.equal(deps.beginRecovery(record), "created");
let snapshot: ResourceSnapshot = prepared.resources;
const last = input.steps.at(-1);
assert.ok(last?.action === "create");
const session = executeIsolation(prepared, {
  onSubmitting: (step) => {
    assert.ok(lock.assertLive());
    assert.equal(
      deps.setRecoveryCommandState(
        record,
        "in_flight",
        step.key,
        { snapshot, cleanup: material.cleanup },
        step.resource,
      ),
      true,
    );
  },
  onCreated: (step, value) => {
    snapshot = value;
    assert.ok(lock.assertLive());
    assert.equal(
      deps.recordResource(record, {
        event: "receipt",
        key: step.resource,
        snapshot,
        cleanup: material.cleanup,
      }),
      true,
    );
    if (step.key === last.key) {
      assert.equal(deps.setRecoveryCommandState(record, "idle", null), true);
      const released = lock.release();
      assert.equal(released, true);
      fs.writeSync(
        1,
        `${JSON.stringify({ completed: true, lockReleased: released })}\n`,
      );
      // 作成・Receipt保存・idle後のProcess喪失。DIの通常Cleanupへは戻らない。
      process.exit(0);
    }
  },
  onCompleted: () => {
    assert.equal(deps.setRecoveryCommandState(record, "idle", null), true);
  },
});
await session.completion;
throw Error("fixture_did_not_reach_saved_resource_exit");

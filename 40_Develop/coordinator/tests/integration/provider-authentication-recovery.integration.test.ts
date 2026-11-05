/**
 * 新Snapshot形式の認証記録と別Process再入場を確認する。
 * @responsibility 初期Intent・Receipt・元回復参照・Kernel Owner喪失の保存条件を維持する。
 * @trace ERB-IT-017
 * @level IT
 * @scope 通常Caseは新品Repository内の記録だけ。Windows Process Gateは明示選択時だけ。
 * @boundary 実Docker・実AIは使用しない。Process Gateは既存の明示入口で選択する。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createRepositoryTestDirectory } from "../../../domain-model/tests/support/repository-test-directory.ts";
import {
  authenticationResourceFixture,
  createAuthenticationFixture,
  prepareAuthenticationProjection,
} from "../support/authentication.ts";
import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../../src/execution/kernel-lock.ts";
import {
  authenticateProvider,
  beginProviderAuthenticationRecovery,
  createProviderAuthenticationRecoveryRecord,
  readProviderAuthenticationResources,
  recordProviderAuthenticationResource,
  setProviderAuthenticationRecoveryCommandState,
  settleProviderAuthenticationRecovery,
} from "../../src/execution/authority.ts";

test("認証記録はactiveの操作を保持しsettled後だけ次操作へ切り替わる", () => {
  const root = createRepositoryTestDirectory("provider-auth-transition-"),
    hash = randomBytes(32).toString("hex"),
    suffix = hash.slice(0, 16),
    token = "b".repeat(64);
  try {
    for (const provider of ["codex", "claude"] as const) {
      const home = path.join(root.path, "ProviderHomes", provider);
      const statusPlan = prepareAuthenticationProjection(
        provider,
        "status",
        home,
        suffix,
        null,
      );
      const loginPlan = prepareAuthenticationProjection(
        provider,
        "login",
        home,
        suffix,
        token,
      );
      assert.ok(statusPlan && loginPlan);
      const status = createProviderAuthenticationRecoveryRecord(
          home,
          hash,
          statusPlan,
        ),
        login = createProviderAuthenticationRecoveryRecord(
          home,
          hash,
          loginPlan,
        );
      assert.ok(status && login);
      assert.equal(status.recordPath, login.recordPath);
      assert.equal(beginProviderAuthenticationRecovery(status), "created");
      const before = fs.readFileSync(status.recordPath, "utf8");
      assert.deepEqual(beginProviderAuthenticationRecovery(login), {
        status: "prior_action_active",
        recoveryId: status.recoveryId,
      });
      assert.equal(fs.readFileSync(status.recordPath, "utf8"), before);
      const material = authenticationResourceFixture(
        provider,
        "status",
        home,
        suffix,
        null,
        path.join(root.path, "management"),
      );
      assert.equal(
        setProviderAuthenticationRecoveryCommandState(
          status,
          "in_flight",
          "create_probe",
          material,
          "probe",
        ),
        false,
        "Request全体を保存イベントへ混入しない",
      );
      const frame = { snapshot: material.snapshot, cleanup: material.cleanup };
      assert.equal(
        setProviderAuthenticationRecoveryCommandState(
          status,
          "in_flight",
          "create_probe",
          frame,
          "probe",
        ),
        true,
      );
      assert.equal(
        readProviderAuthenticationResources(status),
        null,
        "in-flightをidleの未要求へ丸めない",
      );
      assert.equal(
        recordProviderAuthenticationResource(status, {
          event: "not_issued",
          key: "probe",
        }),
        true,
      );
      assert.equal(settleProviderAuthenticationRecovery(status), true);
      assert.equal(beginProviderAuthenticationRecovery(login), "created");
      assert.equal(readProviderAuthenticationResources(login)?.resources, null);
      assert.equal(readProviderAuthenticationResources(status), null);
    }
  } finally {
    root.cleanup();
  }
});

test("作成Receiptは同じIntentの元Snapshotに保存し別key・別ID・旧版を拒否する", () => {
  const root = createRepositoryTestDirectory("provider-auth-receipt-"),
    hash = randomBytes(32).toString("hex"),
    home = path.join(root.path, "ProviderHomes", "claude");
  try {
    const plan = prepareAuthenticationProjection(
      "claude",
      "login",
      home,
      hash.slice(0, 16),
      "b".repeat(64),
    );
    assert.ok(plan);
    const record = createProviderAuthenticationRecoveryRecord(home, hash, plan);
    assert.ok(record);
    const material = authenticationResourceFixture(
      "claude",
      "login",
      home,
      hash.slice(0, 16),
      "b".repeat(64),
      path.join(root.path, "management"),
    );
    const frame = { snapshot: material.snapshot, cleanup: material.cleanup };
    const receipt = {
      ...frame,
      snapshot: {
        resources: frame.snapshot.resources.map((r) =>
          r.key === "probe"
            ? {
                ...r,
                request: "issued",
                identity: { ...r.identity, dockerId: "c".repeat(64) },
              }
            : r,
        ),
      },
      event: "receipt",
      key: "probe",
    };
    assert.equal(beginProviderAuthenticationRecovery(record), "created");
    assert.equal(recordProviderAuthenticationResource(record, receipt), false);
    assert.equal(
      setProviderAuthenticationRecoveryCommandState(
        record,
        "in_flight",
        "create_probe",
        frame,
        "probe",
      ),
      true,
    );
    assert.equal(
      recordProviderAuthenticationResource(record, {
        ...receipt,
        key: "login",
      }),
      false,
    );
    assert.equal(recordProviderAuthenticationResource(record, receipt), true);
    assert.equal(
      recordProviderAuthenticationResource(record, {
        ...receipt,
        snapshot: {
          resources: receipt.snapshot.resources.map((r) =>
            r.key === "probe"
              ? { ...r, identity: { ...r.identity, dockerId: "d".repeat(64) } }
              : r,
          ),
        },
      }),
      false,
    );
    assert.equal(
      setProviderAuthenticationRecoveryCommandState(record, "idle", null),
      true,
    );
    assert.equal(
      readProviderAuthenticationResources(
        record,
      )?.resources?.snapshot.resources.find((r) => r.key === "probe")?.identity
        .dockerId,
      "c".repeat(64),
    );
    assert.equal(
      recordProviderAuthenticationResource(record, {
        event: "cleanup",
        snapshot: receipt.snapshot,
        observations: receipt.snapshot.resources.map((r) => ({
          key: r.key,
          observation: r.key === "probe" ? "absent" : "not_requested",
        })),
      }),
      true,
    );
    assert.equal(settleProviderAuthenticationRecovery(record), true);
    assert.equal(beginProviderAuthenticationRecovery(record), "created");
    const previous = JSON.parse(fs.readFileSync(record.recordPath, "utf8"));
    fs.writeFileSync(
      record.recordPath,
      JSON.stringify({ ...previous, contractRevision: 1 }),
    );
    assert.equal(readProviderAuthenticationResources(record), null);
    assert.equal(beginProviderAuthenticationRecovery(record), "unknown");
  } finally {
    root.cleanup();
  }
});

async function waitForFixtureEvent(
  output: () => string,
  event: string,
  timeoutMilliseconds = 10_000,
) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    for (const line of output().split(/\r?\n/u)) {
      if (!line.trim()) continue;
      try {
        const value = JSON.parse(line) as Record<string, unknown>;
        if (value.event === event) return value;
      } catch {
        // 部分行は次のpollで再評価する。
      }
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`fixture_event_timeout:${event}`);
}

async function waitForFixtureExit(
  child: ReturnType<typeof spawn>,
  stderr: () => string,
  timeoutMilliseconds = 10_000,
) {
  if (child.exitCode !== null) return child.exitCode;
  return await new Promise<number | null>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill();
      reject(new Error(`fixture_exit_timeout:${stderr()}`));
    }, timeoutMilliseconds);
    child.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });
}

test("Windows Process Gate: 認証は初回Intent前のProcess喪失から同じ記録へ再入場する", async (t) => {
  const root = createRepositoryTestDirectory("provider-auth-process-"),
    hash = randomBytes(32).toString("hex"),
    home = path.join(root.path, "ProviderHomes", "claude"),
    token = "b".repeat(64);
  fs.mkdirSync(home, { recursive: true });
  try {
    const fixture = fileURLToPath(
      new URL(
        "../fixtures/provider-authentication-recovery-owner.ts",
        import.meta.url,
      ),
    );
    const child = spawnSync(
      process.execPath,
      [fixture, hash, home, hash.slice(0, 16), token],
      { encoding: "utf8", windowsHide: true, timeout: 15000 },
    );
    assert.equal(child.status, 0, child.stderr);
    const f = await createAuthenticationFixture(t);
    const result = await authenticateProvider("claude", "login", home, hash, {
      ...f.dependencies,
      randomHex: () => token,
      acquireProviderHomeLock: acquireRuntimeOwnedLogicalProviderHomeKernelLock,
      beginRecovery: beginProviderAuthenticationRecovery,
      setRecoveryCommandState: setProviderAuthenticationRecoveryCommandState,
      recordResource: recordProviderAuthenticationResource,
      readResources: readProviderAuthenticationResources,
      completeRecovery: settleProviderAuthenticationRecovery,
    });
    assert.equal(result.status, "completed", JSON.stringify(result));
    assert.equal(f.f.ids.size, 0);
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
    assert.equal(
      JSON.parse(fs.readFileSync(record.recordPath, "utf8")).state,
      "settled",
    );
  } finally {
    t.mock.restoreAll();
    root.cleanup();
  }
});

test("Windows Process Gate: 認証はCommand中のOwner喪失後にfresh Effectを発行しない", async (t) => {
  const root = createRepositoryTestDirectory("provider-auth-owner-"),
    hash = randomBytes(32).toString("hex"),
    home = path.join(root.path, "ProviderHomes", "claude"),
    token = "b".repeat(64);
  fs.mkdirSync(home, { recursive: true });
  let output = "",
    error = "";
  const child = spawn(
    process.execPath,
    [
      "--experimental-test-module-mocks",
      fileURLToPath(
        new URL(
          "../fixtures/provider-authentication-command-owner.ts",
          import.meta.url,
        ),
      ),
      hash,
      home,
      token,
    ],
    { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] },
  );
  child.stdout?.on("data", (chunk) => {
    output += String(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    error += String(chunk);
  });
  try {
    const started = await waitForFixtureEvent(() => output, "in_flight");
    assert.equal(started.recoveryId, `provider-auth.claude.login.${hash}`);
    child.stdin?.write("LOSE\n");
    await waitForFixtureEvent(() => output, "lock_lost");
    const f = await createAuthenticationFixture(t);
    const result = await authenticateProvider("claude", "login", home, hash, {
      ...f.dependencies,
      randomHex: () => token,
      acquireProviderHomeLock: acquireRuntimeOwnedLogicalProviderHomeKernelLock,
      beginRecovery: beginProviderAuthenticationRecovery,
      setRecoveryCommandState: setProviderAuthenticationRecoveryCommandState,
      recordResource: recordProviderAuthenticationResource,
      readResources: readProviderAuthenticationResources,
      completeRecovery: settleProviderAuthenticationRecovery,
    });
    assert.equal(
      result.reason,
      "provider_authentication_prior_command_in_flight",
    );
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(f.f.calls.length, 0);
    child.stdin?.write("FINISH\n");
    const closed = await waitForFixtureEvent(() => output, "result");
    assert.equal(closed.receiptCallCount, 0);
    assert.equal(closed.recoveryCallCount, 0);
    assert.equal(await waitForFixtureExit(child, () => error), 0);
  } finally {
    if (child.exitCode === null) {
      child.kill();
      await waitForFixtureExit(child, () => error);
    }
    t.mock.restoreAll();
    root.cleanup();
  }
});

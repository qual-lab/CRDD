/**
 * coordinator:integration:claude-subscription-authentication-recoveryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Claude再認証の耐久Intentと別Process Kernel Lock再入場を検証する。
 * @trace ERB-IT-017
 * @level IT
 * @scope coordinator、claude-authentication、recovery、kernel-lock
 * @boundary ERB-IT-017=Integration: Filesystem耐久記録とWindows Named Pipe Kernel Lock境界
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../../src/security/candidate-store-kernel-lock.ts";
import {
  authenticateClaudeSubscription,
  beginClaudeSubscriptionAuthenticationRecovery,
  createClaudeSubscriptionAuthenticationPlan,
  createClaudeSubscriptionAuthenticationRecoveryRecord,
  setClaudeSubscriptionAuthenticationRecoveryCommandState,
  settleClaudeSubscriptionAuthenticationRecovery,
} from "../../src/security/claude-subscription-authentication.ts";

const hash = randomBytes(32).toString("hex");
const suffix = hash.slice(0, 16);
const token = "b".repeat(64);

/**
 * Docker不存在を表す固定stderrを構築する。
 *
 * @responsibility 再認証fixtureの資源種別と固定不存在文を対応付ける。
 * @trace ERB-IT-017
 * @precondition purposeは固定認証Planの確認用途である。
 * @stimulus purposeから対象資源名とDocker不存在文を導く。
 * @observation NetworkまたはContainer用の固定stderrを返す。
 * @oracle 実装が受理するexact不存在形式と一致する。
 * @cleanup N/A: 外部資源を作成しない純粋fixtureである。
 * @boundary ERB-IT-017=Integration: Docker stderr fixture境界
 */
function absenceError(purpose: string) {
  const resource = purpose.includes("network")
    ? purpose.includes("internal")
      ? `crdd-internal-${suffix}`
      : `crdd-egress-${suffix}`
    : purpose.includes("probe")
      ? `crdd-auth-${suffix}`
      : purpose.includes("login")
        ? `crdd-claude-${suffix}`
        : `crdd-proxy-${suffix}`;
  return purpose.includes("network")
    ? `Error response from daemon: network ${resource} not found`
    : `Error: No such container: ${resource}`;
}

/**
 * 子ProcessのJSON行Eventが現れるまで待機する。
 *
 * @responsibility 別Process Fixtureの段階通知を順序付きで待ち、無期限待機を防ぐ。
 * @trace ERB-IT-017
 * @precondition outputへ子Process stdoutが追記される。
 * @stimulus 期待Event名と待機上限を指定する。
 * @observation JSON行を逐次解析し、対象Eventを観測する。
 * @oracle 対象Eventを返し、上限内に現れなければ失敗する。
 * @cleanup Timerを各poll後に解放する。
 * @boundary ERB-IT-017=Integration: 親子Process標準出力境界
 */
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

/**
 * 子Process終了を上限付きで待機する。
 *
 * @responsibility Fixtureの終了Codeと残存stderrを親試験へ返す。
 * @trace ERB-IT-017
 * @precondition childは開始済みである。
 * @stimulus exitまたはerror Eventを待つ。
 * @observation exit Codeとstderrを観測する。
 * @oracle 上限内の終了Codeを返し、起動失敗またはTimeoutを失敗とする。
 * @cleanup Timeoutを終了時に解除する。
 * @boundary ERB-IT-017=Integration: 親子Process lifecycle境界
 */
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

/**
 * 別Process喪失後に同じRecovery IDとKernel Lockで再入場することを検証する。
 *
 * @responsibility 実Filesystem記録と実Kernel LockのProcess喪失後契約を検証する。
 * @trace ERB-IT-017
 * @precondition Repository-local試験一時Root内に専用Provider Homeを作成する。
 * @stimulus 子ProcessがLockとactive Intentを作成して解放処理なしで終了し、親Processが再入場する。
 * @observation 子終了、active記録、親Lock取得、cleanup順序、settled記録を観測する。
 * @oracle 同じRecovery IDで旧資源を処置して新規Lifecycleを完了し、記録をsettledへ閉じる。
 * @cleanup 試験専用Rootをfinallyで削除する。
 * @boundary ERB-IT-017=Integration: 別Process・Filesystem・Named Pipe境界
 */
test("Claude再認証はProcess喪失後に耐久Intentから再入場する", async () => {
  const root = path.resolve(
    "..",
    "..",
    ".crdd",
    "tmp",
    `claude-auth-${process.pid}`,
  );
  const providerHome = path.join(root, "ProviderHomes", "claude");
  fs.mkdirSync(providerHome, { recursive: true });
  const ownerFixture = fileURLToPath(
    new URL(
      "../fixtures/claude-subscription-authentication-recovery-owner.ts",
      import.meta.url,
    ),
  );
  try {
    const child = spawnSync(
      process.execPath,
      [ownerFixture, hash, providerHome, suffix, token],
      {
        cwd: path.dirname(ownerFixture),
        env: {},
        encoding: "utf8",
        shell: false,
        windowsHide: true,
        timeout: 15_000,
      },
    );
    assert.equal(child.status, 0, child.stderr);

    const purposes: string[] = [];
    const commandStateTransitions: Readonly<{
      state: "idle" | "in_flight";
      purpose: string | null;
    }>[] = [];
    const result = await authenticateClaudeSubscription(providerHome, hash, {
      randomHex: () => token,
      acquireProviderHomeLock: acquireRuntimeOwnedLogicalProviderHomeKernelLock,
      beginRecovery: beginClaudeSubscriptionAuthenticationRecovery,
      setRecoveryCommandState: (record, state, purpose) => {
        const isUpdated =
          setClaudeSubscriptionAuthenticationRecoveryCommandState(
            record,
            state,
            purpose,
          );
        if (isUpdated)
          commandStateTransitions.push(Object.freeze({ state, purpose }));
        return isUpdated;
      },
      completeRecovery: settleClaudeSubscriptionAuthenticationRecovery,
      run: async (command) => {
        purposes.push(command.purpose);
        return {
          status: command.purpose.startsWith("confirm_") ? 1 : 0,
          signal: null,
          stdout: command.purpose.startsWith("observe_")
            ? `${suffix}\n`
            : command.purpose === "start_probe_attached"
              ? JSON.stringify({
                  loggedIn: true,
                  authMethod: "claude.ai",
                  apiProvider: "firstParty",
                  subscriptionType: "max",
                })
              : "",
          stderr: command.purpose.startsWith("confirm_")
            ? absenceError(command.purpose)
            : "",
        };
      },
    });
    assert.equal(result.status, "completed");
    assert.equal(result.recoveryId, null);
    assert.equal(
      purposes.filter((value) => value === "create_internal_network").length,
      1,
    );
    const plan = createClaudeSubscriptionAuthenticationPlan(
      providerHome,
      suffix,
      token,
    );
    assert.ok(plan);
    assert.equal(commandStateTransitions.length, plan.commands.length * 2);
    for (const [index, command] of plan.commands.entries()) {
      assert.deepEqual(commandStateTransitions[index * 2], {
        state: "in_flight",
        purpose: command.purpose,
      });
      assert.deepEqual(commandStateTransitions[index * 2 + 1], {
        state: "idle",
        purpose: null,
      });
    }
    assert.ok(plan.commands.some((command) => command.interactive));
    assert.ok(plan.commands.some((command) => !command.interactive));
    const record = createClaudeSubscriptionAuthenticationRecoveryRecord(
      providerHome,
      hash,
      plan,
    );
    assert.ok(record);
    const stored = JSON.parse(fs.readFileSync(record.recordPath, "utf8")) as {
      state?: unknown;
    };
    assert.equal(stored.state, "settled");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 旧Commandの終了状態が不明な世代へfresh Ownerが再入場しないことを検証する。
 *
 * @responsibility 別Processが残したin-flight Command Barrierを新しいDocker Effectより前に強制する。
 * @trace ERB-IT-017
 * @precondition 子Processが同じProvider Homeへactiveかつin-flightの耐久記録を残して終了する。
 * @stimulus fresh Processが同じProvider Homeの再認証を開始する。
 * @observation Docker Adapter呼出し、公開Recovery ID、cleanupおよびEffect不明を観測する。
 * @oracle fresh ProcessはDocker Effect 0で停止し、同じRecovery IDと手動回復義務を保持する。
 * @cleanup 試験専用Rootをfinallyで削除する。
 * @boundary ERB-IT-017=Integration: 別Process・耐久Command世代Barrier
 */
test("Claude再認証は本番Command中のOwner喪失後にfresh Effectを発行しない", async () => {
  const inFlightHash = randomBytes(32).toString("hex");
  const root = path.resolve(
    "..",
    "..",
    ".crdd",
    "tmp",
    `claude-auth-in-flight-${process.pid}`,
  );
  const providerHome = path.join(root, "ProviderHomes", "claude");
  fs.mkdirSync(providerHome, { recursive: true });
  const commandOwnerFixture = fileURLToPath(
    new URL(
      "../fixtures/claude-subscription-authentication-command-owner.ts",
      import.meta.url,
    ),
  );
  let childOutput = "";
  let childError = "";
  let child: ReturnType<typeof spawn> | null = null;
  try {
    child = spawn(
      process.execPath,
      [commandOwnerFixture, inFlightHash, providerHome, token],
      {
        cwd: path.dirname(commandOwnerFixture),
        env: {},
        shell: false,
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      childOutput += chunk;
    });
    child.stderr?.on("data", (chunk: string) => {
      childError += chunk;
    });
    const inFlight = await waitForFixtureEvent(() => childOutput, "in_flight");
    assert.equal(inFlight.recoveryId, `claude-auth.${inFlightHash}`);
    assert.equal(inFlight.purpose, "create_internal_network");
    child.stdin?.write("LOSE\n");
    const lockLost = await waitForFixtureEvent(() => childOutput, "lock_lost");
    assert.equal(lockLost.recoveryId, `claude-auth.${inFlightHash}`);

    let dockerEffectCount = 0;
    const result = await authenticateClaudeSubscription(
      providerHome,
      inFlightHash,
      {
        randomHex: () => token,
        acquireProviderHomeLock:
          acquireRuntimeOwnedLogicalProviderHomeKernelLock,
        beginRecovery: beginClaudeSubscriptionAuthenticationRecovery,
        setRecoveryCommandState:
          setClaudeSubscriptionAuthenticationRecoveryCommandState,
        completeRecovery: settleClaudeSubscriptionAuthenticationRecovery,
        run: async () => {
          dockerEffectCount += 1;
          throw new Error("unexpected_effect");
        },
      },
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "claude_authentication_prior_command_in_flight",
    );
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.providerEffectIssued, false);
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.effectStateUnknown, true);
    assert.equal(result.recoveryId, `claude-auth.${inFlightHash}`);
    assert.equal(dockerEffectCount, 0);
    child.stdin?.write("FINISH\n");
    const fixtureResult = await waitForFixtureEvent(
      () => childOutput,
      "result",
    );
    assert.equal(
      fixtureResult.reason,
      "claude_authentication_provider_home_lock_lost",
    );
    assert.equal(fixtureResult.cleanupConfirmed, false);
    assert.equal(await waitForFixtureExit(child, () => childError), 0);
  } finally {
    if (child && child.exitCode === null) child.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * coordinator:integration:claude-subscription-authentication-recoveryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility Provider共通の操作別耐久Intent、元回復参照と別Process Kernel Lock再入場を検証する。
 * @trace ERB-IT-017
 * @level IT
 * @scope coordinator、provider-authentication、status、login、recovery、kernel-lock
 * @boundary ERB-IT-017=Integration: Filesystem耐久記録とWindows Named Pipe Kernel Lock境界
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { acquireRuntimeOwnedLogicalProviderHomeKernelLock } from "../../src/execution/kernel-lock.ts";
import {
  authenticateProvider,
  beginProviderAuthenticationRecovery,
  createProviderAuthenticationPlan,
  createProviderAuthenticationRecoveryRecord,
  readProviderAuthenticationResources,
  recordProviderAuthenticationResource,
  setProviderAuthenticationRecoveryCommandState,
  settleProviderAuthenticationRecovery,
} from "../../src/execution/authority.ts";

const hash = randomBytes(32).toString("hex");
const suffix = hash.slice(0, 16);
const token = "b".repeat(64);

/**
 * 操作切替が同じHomeの旧回復Identityを再利用しないことを確認する。
 * @responsibility activeを保持し、settledだけをpending経由で次の操作へ置換する。
 * @trace ERB-IT-017
 * @precondition Repository-local合成Rootと実Filesystemだけを使う。
 * @stimulus statusのIntent、login要求、settledとloginの新規Intentを順に与える。
 * @observation 正本JSON、回復参照、pending不存在と旧操作からの更新拒否。
 * @oracle 未終了statusは元参照で停止し、終了後loginは五資源に切り替わる。
 * @cleanup 自己生成Rootだけをfinallyで削除する。
 * @boundary ERB-IT-017=Integration: 単一Home回復記録の操作切替。
 */
test("共通認証は旧操作activeを元参照で保持しsettledだけを次操作へ置換する", () => {
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const root = path.join(
    repository,
    ".crdd",
    "tests",
    `provider-auth-transition-${randomBytes(8).toString("hex")}`,
  );
  try {
    for (const provider of ["codex", "claude"] as const) {
      const home = path.join(root, "ProviderHomes", provider);
      const statusPlan = createProviderAuthenticationPlan(
        provider,
        "status",
        home,
        suffix,
        null,
      );
      const loginPlan = createProviderAuthenticationPlan(
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
      );
      const login = createProviderAuthenticationRecoveryRecord(
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
      assert.equal(
        setProviderAuthenticationRecoveryCommandState(
          status,
          "in_flight",
          "create_probe",
        ),
        true,
      );
      assert.deepEqual(beginProviderAuthenticationRecovery(login), {
        status: "prior_action_active",
        recoveryId: status.recoveryId,
      });
      assert.equal(
        setProviderAuthenticationRecoveryCommandState(status, "idle", null),
        true,
      );
      assert.equal(settleProviderAuthenticationRecovery(status), true);
      assert.equal(beginProviderAuthenticationRecovery(login), "created");
      const current = JSON.parse(fs.readFileSync(login.recordPath, "utf8"));
      assert.equal(current.action, "login");
      assert.equal(current.resources.length, 5);
      assert.equal(current.recoveryId, login.recoveryId);
      assert.equal(fs.existsSync(`${login.recordPath}.pending`), false);
      assert.equal(settleProviderAuthenticationRecovery(status), false);
      assert.equal(settleProviderAuthenticationRecovery(login), true);
    }
  } finally {
    assert.ok(
      path
        .resolve(root)
        .startsWith(path.resolve(repository, ".crdd", "tests") + path.sep),
    );
    fs.rmSync(root, { recursive: true, force: true });
  }
});

/**
 * 作成Receiptを元Intentへ保存し、状態更新後も同じ実IDを保持する。
 * @responsibility 保存・読戻しと不正なReceipt拒否を実Filesystemで検証する。
 * @trace ERB-IT-017
 * @precondition Repository-localの専用試験Rootだけを使用する。
 * @stimulus 固定Planから記録を作り、作成Intent、Receipt、idle、settledを順に処置する。
 * @observation 各結果と保存JSONの五資源実IDを読む。
 * @oracle 別用途・別名・別IDを拒否し、元実IDはidleとsettled後も変わらない。
 * @cleanup 試験専用Rootをfinallyで削除する。
 * @boundary ERB-IT-017=Integration: 既存回復記録の保存・読戻し。
 */
test("Claude認証の作成Receiptは元Intentだけへ保存され状態遷移で失われない", () => {
  const repository = fileURLToPath(new URL("../../../../", import.meta.url));
  const root = path.join(
    repository,
    ".crdd",
    "tests",
    `claude-auth-receipt-${randomBytes(8).toString("hex")}`,
  );
  const home = path.join(root, "ProviderHomes", "claude");
  const plan = createProviderAuthenticationPlan(
    "claude",
    "login",
    home,
    suffix,
    token,
  );
  assert.ok(plan);
  const record = createProviderAuthenticationRecoveryRecord(home, hash, plan);
  assert.ok(record);
  const id = "c".repeat(64);
  try {
    assert.equal(beginProviderAuthenticationRecovery(record), "created");
    assert.equal(
      recordProviderAuthenticationResource(record, plan.probeContainerName, id),
      false,
    );
    assert.equal(
      setProviderAuthenticationRecoveryCommandState(
        record,
        "in_flight",
        "create_probe",
      ),
      true,
    );
    assert.equal(
      recordProviderAuthenticationResource(record, plan.loginContainerName, id),
      false,
    );
    assert.equal(
      recordProviderAuthenticationResource(
        record,
        plan.probeContainerName,
        "invalid",
      ),
      false,
    );
    assert.equal(
      recordProviderAuthenticationResource(record, plan.probeContainerName, id),
      true,
    );
    assert.equal(
      recordProviderAuthenticationResource(
        record,
        plan.probeContainerName,
        "d".repeat(64),
      ),
      false,
    );
    assert.equal(
      setProviderAuthenticationRecoveryCommandState(record, "idle", null),
      true,
    );
    assert.equal(
      readProviderAuthenticationResources(record)?.[0]?.dockerId,
      id,
    );
    assert.equal(settleProviderAuthenticationRecovery(record), true);
    assert.equal(
      JSON.parse(fs.readFileSync(record.recordPath, "utf8")).resources[0]
        .dockerId,
      id,
    );
    assert.equal(readProviderAuthenticationResources(record), null);
    assert.equal(beginProviderAuthenticationRecovery(record), "created");
    assert.equal(
      readProviderAuthenticationResources(record)?.[0]?.dockerId,
      null,
    );
    const previous = JSON.parse(fs.readFileSync(record.recordPath, "utf8"));
    fs.writeFileSync(
      record.recordPath,
      JSON.stringify({ ...previous, contractRevision: 2 }),
    );
    assert.equal(readProviderAuthenticationResources(record), null);
    assert.equal(beginProviderAuthenticationRecovery(record), "unknown");
  } finally {
    assert.ok(
      path
        .resolve(root)
        .startsWith(path.resolve(repository, ".crdd", "tests") + path.sep),
    );
    fs.rmSync(root, { recursive: true, force: true });
  }
});

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
 * @boundary ERB-IT-017=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-017=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-017=Direct Boundary: coordinator Test Source→対象契約
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
 * @boundary ERB-IT-017=Direct Boundary: coordinator Test Source→対象契約
 */
test("Windows Process Gate: Claude再認証はProcess喪失後に耐久Intentから再入場する", async () => {
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
      "../fixtures/provider-authentication-recovery-owner.ts",
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
    const result = await authenticateProvider(
      "claude",
      "login",
      providerHome,
      hash,
      {
        randomHex: () => token,
        acquireProviderHomeLock:
          acquireRuntimeOwnedLogicalProviderHomeKernelLock,
        beginRecovery: beginProviderAuthenticationRecovery,
        recordCreatedResource: () => true,
        recoveryCommands: (_record, plan, index) => {
          const ownershipCommand = plan.ownershipCommands[index];
          const cleanupCommand = plan.cleanupCommands[index];
          const absenceCommand = plan.absenceCommands[index];
          return ownershipCommand && cleanupCommand && absenceCommand
            ? { ownershipCommand, cleanupCommand, absenceCommand }
            : null;
        },
        setRecoveryCommandState: (record, state, purpose) => {
          const isUpdated = setProviderAuthenticationRecoveryCommandState(
            record,
            state,
            purpose,
          );
          if (isUpdated)
            commandStateTransitions.push(Object.freeze({ state, purpose }));
          return isUpdated;
        },
        completeRecovery: settleProviderAuthenticationRecovery,
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
      },
    );
    assert.equal(result.status, "completed");
    assert.equal(result.recoveryId, null);
    assert.equal(
      purposes.filter((value) => value === "create_internal_network").length,
      1,
    );
    const plan = createProviderAuthenticationPlan(
      "claude",
      "login",
      providerHome,
      suffix,
      token,
    );
    assert.ok(plan);
    const recoveryPurposes = plan.ownershipCommands.flatMap(
      (command, index) => {
        const cleanup = plan.cleanupCommands[index];
        const absence = plan.absenceCommands[index];
        assert.ok(cleanup && absence);
        return [command.purpose, cleanup.purpose, absence.purpose];
      },
    );
    const expectedPurposes = [
      ...recoveryPurposes,
      ...plan.commands.map((command) => command.purpose),
      ...recoveryPurposes,
    ];
    assert.deepEqual(purposes, expectedPurposes);
    assert.equal(commandStateTransitions.length, expectedPurposes.length * 2);
    for (const [index, purpose] of expectedPurposes.entries()) {
      assert.deepEqual(commandStateTransitions[index * 2], {
        state: "in_flight",
        purpose,
      });
      assert.deepEqual(commandStateTransitions[index * 2 + 1], {
        state: "idle",
        purpose: null,
      });
    }
    assert.ok(plan.commands.some((command) => command.interactive));
    assert.ok(plan.commands.some((command) => !command.interactive));
    const record = createProviderAuthenticationRecoveryRecord(
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
 * @boundary ERB-IT-017=Direct Boundary: coordinator Test Source→対象契約
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
      "../fixtures/provider-authentication-command-owner.ts",
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
    assert.equal(
      inFlight.recoveryId,
      `provider-auth.claude.login.${inFlightHash}`,
    );
    assert.equal(inFlight.purpose, "create_internal_network");
    child.stdin?.write("LOSE\n");
    const lockLost = await waitForFixtureEvent(() => childOutput, "lock_lost");
    assert.equal(
      lockLost.recoveryId,
      `provider-auth.claude.login.${inFlightHash}`,
    );

    let dockerEffectCount = 0;
    const result = await authenticateProvider(
      "claude",
      "login",
      providerHome,
      inFlightHash,
      {
        randomHex: () => token,
        acquireProviderHomeLock:
          acquireRuntimeOwnedLogicalProviderHomeKernelLock,
        beginRecovery: beginProviderAuthenticationRecovery,
        recordCreatedResource: () => true,
        recoveryCommands: (_record, plan, index) => {
          const ownershipCommand = plan.ownershipCommands[index];
          const cleanupCommand = plan.cleanupCommands[index];
          const absenceCommand = plan.absenceCommands[index];
          return ownershipCommand && cleanupCommand && absenceCommand
            ? { ownershipCommand, cleanupCommand, absenceCommand }
            : null;
        },
        setRecoveryCommandState: setProviderAuthenticationRecoveryCommandState,
        completeRecovery: settleProviderAuthenticationRecovery,
        run: async () => {
          dockerEffectCount += 1;
          throw new Error("unexpected_effect");
        },
      },
    );
    assert.equal(result.status, "blocked");
    assert.equal(
      result.reason,
      "provider_authentication_prior_command_in_flight",
    );
    assert.equal(result.cleanupConfirmed, false);
    assert.equal(result.providerEffectIssued, false);
    assert.equal(result.manualRecoveryRequired, true);
    assert.equal(result.effectStateUnknown, true);
    assert.equal(
      result.recoveryId,
      `provider-auth.claude.login.${inFlightHash}`,
    );
    assert.equal(dockerEffectCount, 0);
    child.stdin?.write("FINISH\n");
    const fixtureResult = await waitForFixtureEvent(
      () => childOutput,
      "result",
    );
    assert.equal(
      fixtureResult.reason,
      "provider_authentication_provider_home_lock_lost",
    );
    assert.equal(fixtureResult.cleanupConfirmed, false);
    assert.equal(fixtureResult.receiptCallCount, 0);
    assert.equal(fixtureResult.recoveryCallCount, 0);
    assert.equal(await waitForFixtureExit(child, () => childError), 0);
  } finally {
    if (child && child.exitCode === null) child.kill();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

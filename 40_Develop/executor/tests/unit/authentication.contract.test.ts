/**
 * 上位保存なしで認証の技術生涯と通知停止条件を確認する。
 * @responsibility 両Providerのstatus/login、各通知拒否、終了不明を実本文で反証する。
 * @trace ERB-UT-016
 * @level UT
 * @scope 固定DI Planと有限Command代役。実AI・Docker・認証情報は使わない。
 * @boundary 純粋準備・結果解析・通知順序・技術回収。実環境の成立は主張しない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import { createAuthenticationUsing } from "../../src/authentication/operations.ts";
import type { ExecutorCallbacks } from "../../src/index.ts";

/** 本番FactoryのDI結果搬送も通し、旧Lock理由への変換再導入を反証する。 */
test("認証FactoryはDIの明示取消をHome Lock喪失へ変換しない", async () => {
  const source = fs.readFileSync(
    new URL("../../src/authentication/operations.ts", import.meta.url),
    "utf8",
  );
  const factory = runInNewContext(
    `${sourceDeclaration(source, "createAuthentication")};createAuthentication`,
    {
      createAuthenticationUsing,
      getAuthenticationTechnicalPlan: () => ({}),
      createDockerAuthenticationRuntimeFactory: () => () => ({
        execute: async () => ({
          status: null,
          signal: null,
          stdout: "",
          stderr: "",
          error: Error("docker_execution_permit_lost"),
          processCompletionConfirmed: true,
        }),
      }),
    },
  );
  const auth = factory({
    kind: "authentication",
    provider: "codex",
    action: "status",
    providerHomeSourcePath: "C:\\runtime\\ProviderHomes\\codex",
    suffix: "a".repeat(16),
    proxyToken: null,
  });
  assert.ok(auth);
  assert.equal(
    (await auth.execute(undefined)).reason,
    "provider_authentication_cancelled",
  );
});

/** 明示取消とProcess終了不明を分け、Lock喪失へ誤変換しない。 */
test("認証のDI取消は取消理由を返し終了不明を成功へ補完しない", async () => {
  for (const provider of ["codex", "claude"] as const)
    for (const confirmed of [true, false]) {
      let calls = 0;
      const auth = createAuthenticationUsing(
        {
          kind: "authentication",
          provider,
          action: "status",
          providerHomeSourcePath: `C:\\runtime\\ProviderHomes\\${provider}`,
          suffix: "a".repeat(16),
          proxyToken: null,
        },
        async () => {
          calls++;
          return {
            status: null,
            signal: null,
            stdout: "",
            stderr: "",
            error: Error("docker_execution_permit_lost"),
            processCompletionConfirmed: confirmed,
          };
        },
      );
      assert.ok(auth);
      const result = await auth.execute(undefined);
      assert.equal(
        result.reason,
        confirmed
          ? "provider_authentication_cancelled"
          : "provider_authentication_process_completion_unconfirmed",
      );
      assert.equal(result.processCompletionConfirmed, confirmed);
      assert.equal(result.authenticationConfirmed, false);
      assert.equal(calls, 1);
      if (!confirmed) {
        assert.equal((await auth.cleanup(auth.resources)).confirmed, false);
        assert.equal(calls, 1);
      }
    }
});

/** Receipt通知不成立やProcess終了不明を、資源採用や後続処置へ補完しない。 */
test("認証はReceipt通知完了後だけ実IDを保持し終了不明で回収を発行しない", async () => {
  for (const mode of ["receipt_rejected", "process_unknown"] as const) {
    let calls = 0;
    const auth = createAuthenticationUsing(
      {
        kind: "authentication",
        provider: "codex",
        action: "status",
        providerHomeSourcePath: "C:\\runtime\\ProviderHomes\\codex",
        suffix: "a".repeat(16),
        proxyToken: null,
      },
      async (command) => {
        calls++;
        return {
          status: 0,
          signal: null,
          stdout: "",
          stderr: "",
          processCompletionConfirmed: mode !== "process_unknown",
          resourceCreationConfirmed: true,
          resourceReceipt: {
            name: command.argv[command.argv.indexOf("--name") + 1] ?? "",
            dockerId: "c".repeat(64),
          },
        };
      },
    );
    assert.ok(auth);
    const result = await auth.execute(undefined, {
      onResourceCreated: () => {
        throw Error("receipt_not_saved");
      },
    });
    assert.equal(result.processCompletionConfirmed, mode !== "process_unknown");
    assert.equal(
      auth.resources.every((resource) => resource.dockerId === null),
      true,
    );
    const afterExecute = calls;
    const invalid = auth.resources.map((resource) => ({
      ...resource,
      name: "foreign",
    }));
    assert.equal((await auth.cleanup(invalid)).confirmed, false);
    assert.equal(calls, afterExecute);
    if (mode === "process_unknown") {
      assert.equal((await auth.cleanup(auth.resources)).confirmed, false);
      assert.equal(calls, afterExecute);
    }
  }
});

/**
 * 認証と通常Taskを混同せず、独立した使い捨て条件を検査する。
 * @responsibility 通知順序と三値解析を同じ固定計画へ接続する。
 * @trace ERB-UT-016
 * @precondition 実Processは取得せず、全実行をメモリ内へ置換する。
 * @stimulus 両Providerとstatus/loginを実行する。
 * @observation CLI・mount・通知列・結果・技術終了。
 * @oracle create前通知→Receipt→idle、statusは通信なし・Home読取り専用。
 * @cleanup 全不存在を代役で観測し、外部資源は作らない。
 */
test("認証単独は四構成で通知・三値解析・回収を維持する", async () => {
  for (const provider of ["codex", "claude"] as const)
    for (const action of ["status", "login"] as const) {
      const events: string[] = [];
      const auth = createAuthenticationUsing(
        {
          kind: "authentication",
          provider,
          action,
          providerHomeSourcePath: `C:\\runtime\\ProviderHomes\\${provider}`,
          suffix: "a".repeat(16),
          proxyToken: action === "login" ? "b".repeat(64) : null,
        },
        async (command) => {
          events.push(command.purpose);
          assert.equal(
            command.argv.some((value) => value.includes("dst=/work,")),
            false,
          );
          const create = command.purpose.startsWith("create_");
          const nameAt = command.argv.indexOf("--name");
          const name =
            nameAt >= 0
              ? (command.argv[nameAt + 1] ?? "")
              : (command.argv.at(-1) ?? "");
          const absence =
            command.purpose.startsWith("confirm_") ||
            command.purpose.startsWith("observe_");
          if (action === "status" && create) {
            assert.ok(command.argv.includes("--network=none"));
            assert.ok(
              command.argv.some(
                (value) =>
                  value.includes("/provider-home") &&
                  value.endsWith(",readonly"),
              ),
            );
          }
          return {
            status: absence ? 1 : 0,
            signal: null,
            stdout: absence
              ? "[]"
              : command.purpose === "start_probe_attached" &&
                  provider === "claude"
                ? JSON.stringify({
                    loggedIn: true,
                    authMethod: "claude.ai",
                    apiProvider: "firstParty",
                    subscriptionType: "max",
                    forcedLoginMethod: "claudeai",
                  })
                : "",
            stderr: absence
              ? command.purpose.includes("network")
                ? `Error response from daemon: network ${name} not found`
                : `Error: No such container: ${name}`
              : command.purpose === "start_probe_attached" &&
                  provider === "codex"
                ? "Logged in using ChatGPT"
                : "",
            processCompletionConfirmed: true,
            ...(create
              ? {
                  resourceCreationConfirmed: true,
                  resourceReceipt: { name, dockerId: "c".repeat(64) },
                }
              : {}),
          };
        },
      );
      assert.ok(auth);
      const callbacks: ExecutorCallbacks<"authentication"> = {
        onCommandSubmitting: (purpose) => {
          events.push(`intent:${purpose}`);
        },
        onResourceCreated: () => {
          events.push("receipt");
        },
        onCommandCompleted: () => {
          events.push("idle");
        },
      };
      const result = await auth.execute(
        new AbortController().signal,
        callbacks,
      );
      assert.equal(result.authenticationStatus, "confirmed");
      assert.equal(result.processCompletionConfirmed, true);
      assert.ok(events[0]?.startsWith("intent:create_"));
      assert.equal(events[2], "receipt");
      assert.equal(events[3], "idle");
      const cleanup = await auth.cleanup(auth.resources, undefined, callbacks);
      assert.equal(cleanup.confirmed, true);
    }
});

/** 通知先のthrowと誤Promiseを次Effectへ進む許可にしない。 */
test("認証通知の失敗は発行前に停止し非同期Rejectも捕捉する", async () => {
  for (const fail of [
    () => {
      throw Error("save_failed");
    },
    () => Promise.reject(Error("save_failed")),
    () => new Promise<void>(() => {}),
  ]) {
    let effects = 0;
    const auth = createAuthenticationUsing(
      {
        kind: "authentication",
        provider: "codex",
        action: "status",
        providerHomeSourcePath: "C:\\runtime\\ProviderHomes\\codex",
        suffix: "a".repeat(16),
        proxyToken: null,
      },
      async () => {
        effects++;
        return {
          status: 0,
          signal: null,
          stdout: "",
          stderr: "",
          processCompletionConfirmed: true,
        };
      },
    );
    assert.ok(auth);
    const result = await auth.execute(undefined, {
      onCommandSubmitting: fail,
    });
    assert.equal(
      result.reason,
      "provider_authentication_command_intent_unconfirmed",
    );
    assert.equal(effects, 0);
    await new Promise((resolve) => setImmediate(resolve));
  }
});

/** Process終了不明の後は、同じ構成を使っても追加要求を発行しない。 */
test("認証の終了不明は同じ技術生涯でstickyに保持する", async () => {
  let effects = 0;
  const auth = createAuthenticationUsing(
    {
      kind: "authentication",
      provider: "claude",
      action: "status",
      providerHomeSourcePath: "C:\\runtime\\ProviderHomes\\claude",
      suffix: "a".repeat(16),
      proxyToken: null,
    },
    async () => {
      effects++;
      return {
        status: null,
        signal: null,
        stdout: "",
        stderr: "",
        processCompletionConfirmed: false,
      };
    },
  );
  assert.ok(auth);
  const first = await auth.execute(undefined);
  assert.equal(first.processCompletionConfirmed, false);
  const count = effects;
  const cleanup = await auth.cleanup(auth.resources, undefined);
  assert.equal(cleanup.processCompletionConfirmed, false);
  const second = await auth.execute(undefined);
  assert.equal(second.processCompletionConfirmed, false);
  assert.equal(effects, count);
});

/** DIの作成証拠が欠ける場合、通知先の任意成功でReceiptを補完しない。 */
test("認証は作成Receipt欠測をidleや次操作へ進めない", async () => {
  let issued = 0,
    receipts = 0,
    idle = 0;
  const auth = createAuthenticationUsing(
    {
      kind: "authentication",
      provider: "codex",
      action: "status",
      providerHomeSourcePath: "C:\\runtime\\ProviderHomes\\codex",
      suffix: "a".repeat(16),
      proxyToken: null,
    },
    async () => {
      issued++;
      return {
        status: 0,
        signal: null,
        stdout: "a".repeat(64),
        stderr: "",
        processCompletionConfirmed: true,
        resourceCreationConfirmed: true,
      };
    },
  );
  assert.ok(auth);
  const result = await auth.execute(undefined, {
    onResourceCreated: () => {
      receipts++;
    },
    onCommandCompleted: () => {
      idle++;
    },
  });
  assert.equal(
    result.reason,
    "provider_authentication_resource_receipt_unconfirmed",
  );
  assert.equal(issued, 1);
  assert.equal(receipts, 0);
  assert.equal(idle, 0);
});

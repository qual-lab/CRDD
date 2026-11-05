/**
 * 認証の上位保存・Home排他・再入場を実共通Lifecycleで確認する。
 * @responsibility 旧Command代役・Receipt補完を使わず、判断・保存と技術事実を接続する。
 * @trace ERB-UT-016
 * @level UT
 * @scope 実Coordinator／Executor／DIと有限外部CLI・メモリ記録。実Docker・AIは使わない。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { createAuthenticationFixture } from "../support/authentication.ts";
import {
  authenticateProvider,
  PROVIDER_AUTHENTICATION_INPUT_NOTICE,
} from "../../src/execution/authority.ts";
import {
  authenticateProvider as authenticateFromApi,
  getAuthenticationStatus,
} from "../../src/api.ts";
import { evaluateProviderAuthentication } from "../../../ai-adapter/src/authentication/result.ts";
const STABLE_LOGICAL_HOME_BINDING_HASH = "a".repeat(64);

test("上位認証は両Providerのstatus/loginでIntent・Receipt・最終保存を完了する", async (t) => {
  for (const provider of ["codex", "claude"] as const)
    for (const action of ["status", "login"] as const)
      await t.test(`${provider}:${action}`, async (t) => {
        const f = await createAuthenticationFixture(t, provider, action),
          result = await f.run();
        assert.equal(result.status, "completed", JSON.stringify(result));
        assert.equal(result.cleanupConfirmed, true);
        assert.equal(f.f.ids.size, 0);
        assert.equal(f.record?.state, "settled");
        assert.ok(f.record?.resources);
        assert.ok(
          f.record.resources.checkpoints.every(
            (item) =>
              item.receiptSource !== null && item.observation === "absent",
          ),
        );
        assert.ok(
          f.events.indexOf("receipt") >
            f.events.findIndex((event) =>
              event.startsWith("in_flight:create_"),
            ),
        );
        assert.ok(f.events.indexOf("settle") > f.events.lastIndexOf("cleanup"));
      });
});

test("必須保存の各拒否を後続Effect又は保存成功へ変換しない", async (t) => {
  for (const phase of [
    "intent",
    "receipt",
    "idle",
    "cleanup",
    "settle",
    "release",
  ] as const)
    await t.test(phase, async (t) => {
      const f = await createAuthenticationFixture(t);
      const deps = {
        ...f.dependencies,
        setRecoveryCommandState: (
          ...args: Parameters<typeof f.dependencies.setRecoveryCommandState>
        ) =>
          (phase === "intent" && args[1] === "in_flight") ||
          (phase === "idle" && args[1] === "idle")
            ? false
            : f.dependencies.setRecoveryCommandState(...args),
        recordResource: (
          record: Parameters<typeof f.dependencies.recordResource>[0],
          event: unknown,
        ) => {
          const kind = (event as { event: string }).event;
          return (phase === "receipt" && kind === "receipt") ||
            (phase === "cleanup" && kind === "cleanup")
            ? false
            : f.dependencies.recordResource(record, event);
        },
        completeRecovery:
          phase === "settle" ? () => false : f.dependencies.completeRecovery,
      };
      if (phase === "release") f.releaseConfirmed = false;
      const result = await authenticateProvider(
        "claude",
        "login",
        f.home,
        f.hash,
        deps,
      );
      assert.equal(result.status, "blocked", phase);
      assert.equal(result.cleanupConfirmed, false, phase);
      if (phase === "intent")
        assert.equal(
          f.f.calls.some((argv) => argv.includes("create")),
          false,
        );
      if (phase === "receipt" || phase === "idle") {
        assert.equal(f.record?.commandState, "in_flight");
        assert.equal(f.events.includes("settle"), false);
      }
    });
});

test("認証準備例外とHome競合は実行前に停止し解放不明も保持する", async (t) => {
  for (const mode of ["prepare", "release", "busy"] as const)
    await t.test(mode, async (t) => {
      const f = await createAuthenticationFixture(t);
      if (mode === "release") f.releaseConfirmed = false;
      const result = await authenticateProvider(
        "claude",
        "login",
        f.home,
        f.hash,
        {
          ...f.dependencies,
          ...(mode === "busy"
            ? { acquireProviderHomeLock: () => null }
            : {
                createAuthentication: () => {
                  throw Error("synthetic_prepare_failed");
                },
              }),
        },
      );
      assert.equal(result.status, "blocked");
      assert.equal(f.f.calls.length, 0);
      assert.equal(
        f.events.filter((e) => e === "release").length,
        mode === "busy" ? 0 : 1,
      );
      if (mode === "release") assert.equal(result.cleanupConfirmed, false);
    });
});

test("認証は正規未ログイン・未知出力・回収不明を区別する", async (t) => {
  for (const provider of ["codex", "claude"] as const)
    for (const action of ["status", "login"] as const)
      for (const mode of ["not_logged_in", "unknown", "cleanup"] as const)
        await t.test(`${provider}:${action}:${mode}`, async (t) => {
          const f = await createAuthenticationFixture(t, provider, action);
          if (mode === "cleanup") f.f.configObservation = "EACCES";
          else
            f.f.observation = {
              status: 0,
              signal: null,
              stdout:
                provider === "claude" && mode === "not_logged_in"
                  ? '{"loggedIn":false}'
                  : "",
              stderr:
                provider === "codex" && mode === "not_logged_in"
                  ? "Not logged in"
                  : "",
              outputExceeded: false,
            };
          const result = await f.run();
          assert.equal(
            result.cleanupConfirmed,
            mode !== "cleanup",
            JSON.stringify(result),
          );
          if (mode !== "cleanup") {
            assert.ok("authenticationConfirmed" in result);
            assert.equal(result.authenticationConfirmed, false);
          }
          if (mode === "unknown" || mode === "cleanup" || action === "login")
            assert.equal(result.status, "blocked");
          else assert.equal(result.status, "completed");
        });
});

test("既存active記録は元回復参照を保持し不明読取りでfresh実行しない", async (t) => {
  for (const mode of [
    "in_flight",
    "read_unknown",
    "prior_action",
    "idle_before_intent",
  ] as const)
    await t.test(mode, async (t) => {
      const f = await createAuthenticationFixture(t);
      assert.equal((await f.run()).status, "completed");
      const previous = f.record;
      assert.ok(previous);
      f.seed({
        ...previous,
        state: "active",
        resources: mode === "idle_before_intent" ? null : previous.resources,
        commandState: mode === "in_flight" ? "in_flight" : "idle",
        commandPurpose: mode === "in_flight" ? "create_probe" : null,
        ...(mode === "prior_action"
          ? {
              action: "status" as const,
              recoveryId: `provider-auth.claude.status.${f.hash}`,
            }
          : {}),
      });
      f.resetLease();
      const calls = f.f.calls.length;
      const result = await authenticateProvider(
        "claude",
        "login",
        f.home,
        f.hash,
        mode === "read_unknown"
          ? { ...f.dependencies, readResources: () => null }
          : f.dependencies,
      );
      if (mode === "idle_before_intent") {
        assert.equal(result.status, "completed", JSON.stringify(result));
        assert.ok(f.f.calls.length > calls);
      } else {
        assert.equal(result.status, "blocked");
        assert.equal(f.f.calls.length, calls);
        assert.ok("recoveryId" in result);
      }
    });
});

test("技術Completion直前のHome Owner喪失は最終記録・settleを発行しない", async (t) => {
  const f = await createAuthenticationFixture(t);
  let finalRecords = 0,
    settles = 0;
  const result = await authenticateProvider("claude", "login", f.home, f.hash, {
    ...f.dependencies,
    createAuthentication: (request, options) => {
      const executor = f.dependencies.createAuthentication(request, options);
      assert.ok(executor);
      return {
        ...executor,
        start(input) {
          const started = executor.start(input);
          if (started.status !== "started") return started;
          return {
            ...started,
            completion: started.completion.then((value) => {
              assert.equal(value.cleanupConfirmed, true);
              f.live = false;
              return value;
            }),
          };
        },
      };
    },
    recordResource: (record, event) => {
      if ((event as { event: string }).event === "cleanup") finalRecords++;
      return f.dependencies.recordResource(record, event);
    },
    completeRecovery: () => {
      settles++;
      return true;
    },
  });
  assert.equal(result.status, "blocked");
  assert.ok("recoveryId" in result);
  assert.equal(result.recoveryId, f.record?.recoveryId);
  assert.equal(finalRecords, 0);
  assert.equal(settles, 0);
  assert.equal(f.f.ids.size, 0);
  assert.equal(f.record?.state, "active");
});

test("通知中の上位Owner喪失後はidle・settledと後続実行へ進めない", async (t) => {
  const f = await createAuthenticationFixture(t),
    deps = {
      ...f.dependencies,
      recordResource: (
        record: Parameters<typeof f.dependencies.recordResource>[0],
        event: unknown,
      ) => {
        const saved = f.dependencies.recordResource(record, event);
        if ((event as { event: string }).event === "receipt") f.live = false;
        return saved;
      },
    };
  const result = await authenticateProvider(
    "claude",
    "login",
    f.home,
    f.hash,
    deps,
  );
  assert.equal(result.status, "blocked");
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(f.record?.state, "active");
  assert.equal(f.record?.commandState, "in_flight");
  assert.equal(f.events.includes("settle"), false);
});

/**
 * 正式APIの不正要求と事前取消を実技術観測の前に拒否する。
 * @responsibility Home Path・任意引数・accessorを公開要求へ通さない。
 * @trace ERB-UT-016
 * @precondition 不正値または取消済みの要求だけを利用する。
 * @stimulus Proxy、getter、余剰Key、不正Providerと取消を与える。
 * @observation 拒否結果とgetterの実行数。
 * @oracle input_invalid又はcancelledでEffectなし、getter 0。
 * @cleanup N/A: 実認証・Docker・Home観測を発行しない。
 * @boundary ERB-UT-016=Unit: 正式認証要求の閉形式。
 */
test("正式認証APIは秘密Path・accessor・不正Providerと事前取消を拒否する", async () => {
  let hooks = 0;
  const getter = {
    get provider() {
      hooks += 1;
      return "codex";
    },
  };
  const ownSignal = new AbortController().signal;
  Object.defineProperty(ownSignal, "aborted", {
    get() {
      hooks += 1;
      return false;
    },
  });
  const invalidSignals = [
    null,
    { aborted: false },
    {
      get aborted() {
        hooks += 1;
        return false;
      },
    },
    new Proxy(new AbortController().signal, {
      get() {
        hooks += 1;
        return false;
      },
    }),
    Object.create(AbortSignal.prototype),
    ownSignal,
  ];
  for (const operation of [getAuthenticationStatus, authenticateFromApi]) {
    for (const signal of invalidSignals) {
      const result = await operation(
        { provider: "codex" },
        signal as AbortSignal,
      );
      assert.equal(result.reason, "provider_authentication_signal_invalid");
      assert.equal(result.providerEffectIssued, false);
    }
    for (const request of [
      null,
      { provider: "other" },
      { provider: "codex", home: "fixture" },
      getter,
      new Proxy(
        { provider: "codex" },
        {
          ownKeys() {
            hooks += 1;
            return ["provider"];
          },
        },
      ),
    ]) {
      const result = await operation(
        request as Parameters<typeof operation>[0],
      );
      assert.equal(result.reason, "provider_authentication_input_invalid");
      assert.equal(result.providerEffectIssued, false);
    }
    const controller = new AbortController();
    controller.abort();
    assert.equal(
      (await operation({ provider: "codex" }, controller.signal)).reason,
      "provider_authentication_cancelled",
    );
  }
  for (const signal of invalidSignals) {
    const result = await authenticateProvider(
      "codex",
      "status",
      "C:\\fixture\\ProviderHomes\\codex",
      STABLE_LOGICAL_HOME_BINDING_HASH,
      undefined,
      signal as AbortSignal,
    );
    assert.equal(result.reason, "provider_authentication_signal_invalid");
    assert.equal(result.providerEffectIssued, false);
  }
  assert.equal(hooks, 0);
});

/**
 * 秘密code入力前の固定案内が非表示と一回入力を明示することを検証する。
 *
 * @responsibility Human-only認証の誤った重複入力を防ぐ表示契約を検証する。
 * @trace ERB-UT-016
 * @precondition 案内は秘密値を受け取らない固定文字列である。
 * @stimulus 公開された入力案内を取得する。
 * @observation 非表示、一度だけ、結果まで再入力しないという三条件を観測する。
 * @oracle 三条件が同じ案内に存在し、秘密code値やProvider出力を補間しない。
 * @cleanup N/A: 固定文字列の検査で外部資源を作らない。
 * @boundary ERB-UT-016=Direct Boundary: coordinator Test Source→対象契約
 */
test("再認証は秘密codeの非表示と一回入力を事前案内する", () => {
  assert.match(PROVIDER_AUTHENTICATION_INPUT_NOTICE, /画面に表示されません/u);
  assert.match(PROVIDER_AUTHENTICATION_INPUT_NOTICE, /一度だけ貼り付け/u);
  assert.match(
    PROVIDER_AUTHENTICATION_INPUT_NOTICE,
    /結果が出るまで再入力しない/u,
  );
});

/**
 * 分離したClaude認証判定が四つの成立条件を保持することを検証する。
 *
 * @responsibility Provider固有の出力解釈を実行・回収の成功条件と混同しない。
 * @trace ERB-UT-016
 * @precondition 入力は未信頼なProbe出力文字列である。
 * @stimulus 正常値、各Propertyの不一致、欠落および不正JSONを渡す。
 * @observation 固定四条件の一致時だけtrueとなることを観測する。
 * @oracle 部分成立、別認証方式、別Offeringおよび解析不能を受理しない。
 * @cleanup N/A: 純粋判定だけを呼び外部資源を作成しない。
 * @boundary ERB-UT-016=Direct Boundary: Coordinator試験からAI AdapterのProbe判定。
 */
test("認証Probe判定は四条件の完全一致だけを受理する", () => {
  const confirmed = {
    loggedIn: true,
    authMethod: "claude.ai",
    apiProvider: "firstParty",
    subscriptionType: "max",
  };
  assert.equal(
    evaluateProviderAuthentication(
      "claude",
      "claude_max",
      JSON.stringify(confirmed),
      "",
      "login",
    ).status,
    "confirmed",
  );
  for (const [key, value] of Object.entries(confirmed)) {
    const missing = { ...confirmed } as Record<string, unknown>;
    delete missing[key];
    assert.notEqual(
      evaluateProviderAuthentication(
        "claude",
        "claude_max",
        JSON.stringify(missing),
        "",
        "login",
      ).status,
      "confirmed",
    );
    assert.notEqual(
      evaluateProviderAuthentication(
        "claude",
        "claude_max",
        JSON.stringify({
          ...confirmed,
          [key]: typeof value === "boolean" ? false : "other",
        }),
        "",
        "login",
      ).status,
      "confirmed",
    );
  }
  for (const invalid of ["", "not-json", "null", "[]", "{}"]) {
    assert.equal(
      evaluateProviderAuthentication(
        "claude",
        "claude_max",
        invalid,
        "",
        "login",
      ).status,
      "unknown",
    );
  }
  assert.equal(
    evaluateProviderAuthentication(
      "claude",
      "claude_max",
      JSON.stringify({ loggedIn: false }),
      "",
      "login",
    ).status,
    "unconfirmed",
  );
  assert.equal(
    evaluateProviderAuthentication(
      "claude",
      "chatgpt_subscription_oauth",
      JSON.stringify(confirmed),
      "",
      "login",
    ).status,
    "unknown",
  );
  assert.equal(
    evaluateProviderAuthentication(
      "claude",
      "claude_max",
      JSON.stringify(confirmed),
      "",
      "execution",
    ).status,
    "unknown",
  );
  assert.equal(
    evaluateProviderAuthentication(
      "claude",
      "claude_max",
      JSON.stringify({ ...confirmed, forcedLoginMethod: "claudeai" }),
      "",
      "execution",
    ).status,
    "confirmed",
  );
  assert.equal(
    evaluateProviderAuthentication(
      "claude",
      "claude_max",
      '{"loggedIn":true,"loggedIn":false}',
      "",
      "login",
    ).status,
    "unknown",
  );
});

/**
 * Provider別の正規出力を同じ認証三値へ変換する。
 * @responsibility 未認証と未知出力を分け、生出力や認証方式を他Providerへ流用しない。
 * @trace ERB-UT-016
 * @precondition 合成文字列だけを使う。
 * @stimulus 正規出力、改行、既知警告、未知stderr、混在・重複・別認証方式を与える。
 * @observation 共通のstatusとreasonだけを読む。
 * @oracle 正規否定だけがunconfirmed、未知・混在出力はunknown。
 * @cleanup N/A: 純粋変換。
 * @boundary ERB-UT-016=Unit: AI Adapterの認証出力変換。
 */
test("認証出力はProvider差を共通三値へ閉じ、未知出力を未認証に丸めない", () => {
  const warning =
    "WARNING: proceeding, even though we could not create PATH aliases: Read-only file system (os error 30)";
  for (const [stdout, stderr, expected] of [
    ["", "Logged in using ChatGPT\n", "confirmed"],
    ["", "Not logged in\n", "unconfirmed"],
    ["", "Not logged in\r\n", "unconfirmed"],
    ["Not logged in\n", "", "unknown"],
    ["Not logged in\n", `${warning}\n`, "unknown"],
    ["", `${warning}\nNot logged in\n`, "unconfirmed"],
    ["", "Not logged in\nunknown warning\n", "unknown"],
    ["Not logged in", "unknown error", "unknown"],
    ["Not logged in", "Not logged in", "unknown"],
    ["", "Logged in using an API key", "unknown"],
    ["", "Error: Not logged in", "unknown"],
    ["", "Not logged in\0", "unknown"],
    ["", "Not logged in\r", "unknown"],
    ["", "Not logged in\n\n", "unknown"],
  ] as const) {
    const result = evaluateProviderAuthentication(
      "codex",
      "chatgpt_subscription_oauth",
      stdout,
      stderr,
    );
    assert.equal(result.status, expected);
    if (expected === "unconfirmed")
      assert.equal(result.reason, "subscription_auth_not_logged_in");
  }
  for (const [stdout, stderr, expected] of [
    ['{"loggedIn":false}', "", "unconfirmed"],
    ['{"loggedIn":false}', "unknown error", "unknown"],
    ['{"loggedIn":true,"loggedIn":false}', "", "unknown"],
    ["Not logged in", "", "unknown"],
  ] as const) {
    const result = evaluateProviderAuthentication(
      "claude",
      "claude_max",
      stdout,
      stderr,
    );
    assert.equal(result.status, expected);
    if (expected === "unconfirmed")
      assert.equal(result.reason, "subscription_auth_not_logged_in");
  }
  assert.equal(
    evaluateProviderAuthentication("codex", "claude_max", "", "Not logged in")
      .status,
    "unknown",
  );
});

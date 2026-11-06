/**
 * 認証の用途差分と共通DI Lifecycleを実宣言で確認する。
 * @responsibility 旧Command Adapterを介さず開始・取消・通知・元Snapshot・終了不明を反証する。
 * @trace ERB-UT-016
 * @level UT
 * @scope 共通DIの有限CLI・Process・Directory代役。実AI・Docker・認証値を使用しない。
 * @packageDocumentation
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { setImmediate } from "node:timers/promises";
import { createIsolationFixture } from "../../../docker-isolation/tests/support/isolation.ts";
import { captureIsolationRequest } from "../../../docker-isolation/src/execution/preparation.ts";
import type { IsolationRequest } from "../../../docker-isolation/src/index.ts";

/**
 * 実認証構成を実共通DIへ接続し、外部Processの端だけを有限化する。
 * @responsibility このSuiteの合成依存と初期入力を構築する
 * @trace ERB-UT-016
 * @precondition 共通DIの有限CLI・Process・Directory代役。実AI・Docker・認証値を使用しない。
 * @stimulus このSuiteの合成依存と初期入力を構築する。
 * @observation 構築した候補、有限応答または検出した例外。
 * @oracle 呼出し元の対照試験へ固定入力・観測を渡し、実処理の成功を捏造しない。
 * @cleanup 実資源の所有は呼出し元Caseに残し、構築した合成値自体に解放処理はない。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
async function fixture(
  t: TestContext,
  provider: "codex" | "claude",
  action: "status" | "login" = "status",
) {
  const f = await createIsolationFixture(t);
  const original = await import("../../../docker-isolation/src/index.ts");
  f.observation = {
    status: 0,
    signal: null,
    stdout:
      provider === "claude"
        ? JSON.stringify({
            loggedIn: true,
            authMethod: "claude.ai",
            apiProvider: "firstParty",
            forcedLoginMethod: "claudeai",
            subscriptionType: "max",
          })
        : "",
    stderr: provider === "codex" ? "Logged in using ChatGPT" : "",
    outputExceeded: false,
  };
  t.mock.module("../../../docker-isolation/src/index.ts", {
    namedExports: {
      ...original,
      prepareIsolation: (request: IsolationRequest) => {
        f.useRequest(captureIsolationRequest(request), provider);
        return f.api.prepareIsolation(request);
      },
      executeIsolation: f.api.executeIsolation,
    },
  });
  const {
    createAuthenticationExecutor,
  }: typeof import("../../src/lifecycle/authentication.ts") = await import(
    new URL(
      "../../src/lifecycle/authentication.ts?case=" + Math.random(),
      import.meta.url,
    ).href
  );
  const executor = createAuthenticationExecutor(
    {
      kind: "authentication",
      provider,
      action,
      providerHomeSourcePath: "C:\\fixture\\home",
      suffix: "a".repeat(16),
      proxyToken: action === "login" ? "b".repeat(64) : null,
    },
    f.request.managementDirectory,
  );
  assert.ok(executor);
  return { f, executor };
}

/**
 * 両Provider・両操作で開始から技術回収まで同じOwnerを通る。
 * @responsibility 認証の四構成は元Snapshot・通知順序・共通Cleanupを維持する
 * @trace ERB-UT-016
 * @precondition 共通DIの有限CLI・Process・Directory代役。実AI・Docker・認証値を使用しない。
 * @stimulus 認証の四構成は元Snapshot・通知順序・共通Cleanupを維持するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証の四構成は元Snapshot・通知順序・共通Cleanupを維持するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証の四構成は元Snapshot・通知順序・共通Cleanupを維持する", async (t) => {
  for (const provider of ["codex", "claude"] as const)
    for (const action of ["status", "login"] as const)
      await t.test(provider + ":" + action, async (t) => {
        const { f, executor } = await fixture(t, provider, action);
        const events: string[] = [];
        const started = executor.start({
          callbacks: {
            onCommandSubmitting: (purpose) => {
              events.push("intent:" + purpose);
            },
            onResourceCreated: (receipt) => {
              assert.ok(events.includes("intent:create_" + receipt.key));
              events.push("receipt:" + receipt.key);
            },
            onCommandCompleted: () => {
              events.push("completed");
            },
          },
        });
        assert.equal(started.status, "started", JSON.stringify(started));
        assert.ok(started.status === "started");
        const result = await started.completion;
        assert.equal(
          result.authenticationConfirmed,
          true,
          JSON.stringify(result),
        );
        assert.equal(result.cleanupConfirmed, true);
        assert.equal(result.processCompletionConfirmed, true);
        assert.equal(
          result.resourceSnapshot?.resources.length,
          action === "login" ? 5 : 1,
        );
        assert.equal(f.ids.size, 0);
        assert.equal(executor.start({}).status, "blocked");
        assert.equal((await executor.cancel()).status, "blocked");
      });
});

/**
 * 事前取消済みインスタンスを開始し直さない。
 * @responsibility 認証は開始前取消と外部事前中断でProcess要求0を維持する
 * @trace ERB-UT-016
 * @precondition 共通DIの有限CLI・Process・Directory代役。実AI・Docker・認証値を使用しない。
 * @stimulus 認証は開始前取消と外部事前中断でProcess要求0を維持するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証は開始前取消と外部事前中断でProcess要求0を維持するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証は開始前取消と外部事前中断でProcess要求0を維持する", async (t) => {
  for (const external of [false, true])
    await t.test(String(external), async (t) => {
      const { f, executor } = await fixture(t, "codex");
      const signal = new AbortController();
      if (external) signal.abort();
      else await executor.cancel();
      const started = executor.start(external ? { signal: signal.signal } : {});
      assert.equal(started.status, "blocked");
      assert.equal(f.calls.length, 0);
      assert.equal(executor.start({}).status, "blocked");
    });
});

/**
 * Receipt失敗は後続Effect停止と元実IDの保持を両立する。
 * @responsibility 認証のReceipt通知拒否は次Effectを止め元実IDと技術回収を返す
 * @trace ERB-UT-016
 * @precondition 共通DIの有限CLI・Process・Directory代役。実AI・Docker・認証値を使用しない。
 * @stimulus 認証のReceipt通知拒否は次Effectを止め元実IDと技術回収を返すの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証のReceipt通知拒否は次Effectを止め元実IDと技術回収を返すという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証のReceipt通知拒否は次Effectを止め元実IDと技術回収を返す", async (t) => {
  const { f, executor } = await fixture(t, "claude", "login");
  const started = executor.start({
    callbacks: {
      onResourceCreated: () => {
        throw Error("save_failed");
      },
    },
  });
  assert.ok(started.status === "started");
  const result = await started.completion;
  assert.equal(result.status, "blocked");
  assert.equal(result.authenticationConfirmed, false);
  assert.equal(result.cleanupConfirmed, true);
  assert.ok(
    result.resourceSnapshot?.resources.some(
      (r) => r.identity.dockerId !== null,
    ),
  );
  assert.equal(f.startedCalls, 0);
  assert.equal(f.ids.size, 0);
});

/**
 * 必須同期通知の例外・非同期返却をいずれも発行前に拒否する。
 * @responsibility 認証の発行前通知はthrow・Reject・非voidで次Effectへ進まない
 * @trace ERB-UT-016
 * @precondition 共通DIの有限CLI・Process・Directory代役。実AI・Docker・認証値を使用しない。
 * @stimulus 認証の発行前通知はthrow・Reject・非voidで次Effectへ進まないの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証の発行前通知はthrow・Reject・非voidで次Effectへ進まないという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証の発行前通知はthrow・Reject・非voidで次Effectへ進まない", async (t) => {
  for (const mode of ["throw", "reject", "value"] as const)
    await t.test(mode, async (t) => {
      const { f, executor } = await fixture(t, "codex");
      /**
       * noticeで認証の用途差分と共通DI Lifecycleを実宣言で確認する。。
       * @responsibility noticeで認証の用途差分と共通DI Lifecycleを実宣言で確認する。
       * @trace ERB-UT-016
       * @precondition 共通DIの有限CLI・Process・Directory代役。実AI・Docker・認証値を使用しない。
       * @stimulus noticeで認証の用途差分と共通DI Lifecycleを実宣言で確認する。。
       * @observation 構築した候補、有限応答または検出した例外。
       * @oracle 呼出し元の対照試験へ固定入力・観測を渡し、実処理の成功を捏造しない。
       * @cleanup 実資源の所有は呼出し元Caseに残し、構築した合成値自体に解放処理はない。
       * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
       */
      const notice = () => {
        if (mode === "throw") throw Error("intent_failed");
        if (mode === "reject") return Promise.reject(Error("intent_failed"));
        return true;
      };
      const started = executor.start({
        callbacks: { onCommandSubmitting: notice as () => void },
      });
      assert.ok(started.status === "started");
      const result = await started.completion;
      assert.equal(result.status, "blocked");
      assert.equal(f.ids.size, 0);
      assert.equal(
        f.calls.some((argv) => argv.includes("create")),
        false,
      );
      await Promise.resolve();
    });
});

/**
 * 物理回収失敗で一次通知失敗を成功へ置換しない。
 * @responsibility 認証はconfig終了不明でも元Receipt通知失敗とIDを保持する
 * @trace ERB-UT-016
 * @precondition 共通DIの有限CLI・Process・Directory代役。実AI・Docker・認証値を使用しない。
 * @stimulus 認証はconfig終了不明でも元Receipt通知失敗とIDを保持するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証はconfig終了不明でも元Receipt通知失敗とIDを保持するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証はconfig終了不明でも元Receipt通知失敗とIDを保持する", async (t) => {
  const { f, executor } = await fixture(t, "claude");
  f.configObservation = "EACCES";
  const started = executor.start({
    callbacks: {
      onResourceCreated: () => {
        throw Error("save_failed");
      },
    },
  });
  assert.ok(started.status === "started");
  const result = await started.completion;
  assert.equal(result.cleanupConfirmed, false);
  assert.equal(result.authenticationConfirmed, false);
  assert.equal(result.processCompletionConfirmed, true);
  assert.equal(
    result.reason,
    "provider_authentication_resource_receipt_unconfirmed",
  );
  assert.ok(
    result.resourceSnapshot?.resources.some(
      (r) => r.identity.dockerId !== null,
    ),
  );
});

/**
 * 取消要求の受理とProcess終了・Cleanupの最終事実を区別する。
 * @responsibility 認証の実行中取消は終了確認と未確認を分ける
 * @trace ERB-UT-016
 * @precondition 共通DIの有限CLI・Process・Directory代役。実AI・Docker・認証値を使用しない。
 * @stimulus 認証の実行中取消は終了確認と未確認を分けるの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle 認証の実行中取消は終了確認と未確認を分けるという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("認証の実行中取消は終了確認と未確認を分ける", async (t) => {
  for (const termination of [false, true])
    await t.test(String(termination), async (t) => {
      const { f, executor } = await fixture(t, "codex");
      f.pendingRun = true;
      f.processTermination = termination;
      const started = executor.start({});
      assert.ok(started.status === "started");
      for (let i = 0; i < 30 && f.startedCalls === 0; i++) await setImmediate();
      assert.ok(f.startedCalls > 0);
      const cancelled = await executor.cancel();
      const result = await started.completion;
      assert.equal(cancelled.status, "requested");
      assert.ok(cancelled.status === "requested");
      assert.equal(cancelled.cancellationRequested, true);
      assert.equal(
        result.reason,
        termination
          ? "provider_authentication_cancelled"
          : "provider_authentication_process_completion_unconfirmed",
      );
      assert.equal(result.processCompletionConfirmed, termination);
      assert.equal(result.cleanupConfirmed, termination);
      assert.equal(f.ids.size === 0, termination);
    });
});

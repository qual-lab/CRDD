/**
 * 修復Native子の所有と終了待機を反証する。
 * @packageDocumentation
 * @responsibility 遅延取得、取消、Native失敗と回収不明を分離する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 内部生涯管理。実Docker・Native・外部AI要求0。
 * @boundary 実Session所有処理と有限Native代役。実Processの終了証明とは区別する。
 */
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInThisContext } from "node:vm";
import { getEventListeners } from "node:events";
import { types } from "node:util";
import { runDockerRuntimeRepairMachine } from "../../src/docker-desktop/repair.ts";
import { ownDockerRepairNativeSession as run } from "../../src/docker-desktop/repair-session.ts";
import { runDockerRuntimeRepairSessionUsing as runSession } from "../../src/docker-desktop/repair-session.ts";
import {
  validateDockerRuntimeRepairCheckpointTransition as transition,
  decodeDockerRuntimeRepairCheckpoint as decode,
  prepareDockerRuntimeRepairSessionCheckpoint,
  type DockerRuntimeRepairCheckpoint as Checkpoint,
} from "../../src/docker-desktop/repair-state.ts";
import type { DockerDesktopRepairNativeHelperSession as Session } from "../../../platform-access/src/index.ts";

/**
 * 同じ子のclose回数と通知解除を観測する。
 * @responsibility 模擬子の生涯だけを構築する。
 * @trace ERB-IT-014
 * @input close: 終了待機の模擬境界。
 * @returns 子と回数、遅延失敗通知。
 * @precondition 実Processを作成しない。
 * @postcondition 全closeを同じ観測へ集約する。
 * @effect 局所カウンタのみ。
 * @failure 試験assertionで判定する。
 * @invariant 実OS状態を主張しない。
 * @boundary 内部runtimeと模擬Native。
 * @security 認証情報なし。
 * @concurrency 失敗通知を明示的に駆動する。
 * @stimulus 正常・失敗・取消に対応するSession購読と終了代役を生成する。
 * @observation abort/release/unsubscribe回数と返却cleanup/protocol。
 * @oracle 同じSessionの終了分類を検証でき、二重closeを計数できる。
 * @cleanup 実資源なし。呼出し元が購読解除と一回終了を確認する。
 */
function fixture(
  close = async () => ({
    cleanup: "confirmed" as const,
    protocol: "completed" as const,
  }),
) {
  let listener = () => {};
  const counts = { abort: 0, release: 0, unsubscribe: 0 };
  const session: Session = {
    assertLive: () => true,
    onFailureDetected: (callback) => {
      listener = callback;
      return () => {
        counts.unsubscribe++;
      };
    },
    failureDetected: new Promise(() => {}),
    verifyArtifacts: async () => "verified",
    inspectProcesses: async () => "absent",
    terminateProcesses: async () => "absent",
    launchDesktop: async () => "not_started",
    abort: async () => {
      counts.abort++;
      return close();
    },
    release: async () => {
      counts.release++;
      return close();
    },
  };
  return {
    session,
    counts,
    fail: () => listener(),
    acquire: async () => ({
      status: "acquired" as const,
      session,
      ownerBindingSha256: "a".repeat(64),
    }),
  };
}

/**
 * 実Machineへ接続する模擬準備境界を構成する。
 * @responsibility 同じ子と保存値の相関を観測する。
 * @trace ERB-IT-014
 * @input N/A: 固定相関。
 * @returns 内部入力、模擬技術、到達counter。
 * @precondition 実OSを操作しない。
 * @postcondition 通知候補を実validatorへ通す。
 * @effect 局所counterのみ。
 * @failure 不正遷移はassertion失敗。
 * @invariant 模擬観測を実資源の証明にしない。
 * @boundary Native生涯・準備保存・実Machine。
 * @security Path・秘密値なし。
 * @concurrency 同じ入力と子だけを使う。
 * @stimulus 固定inputとprepare/save/observe代役を実runSessionへ結合する。
 * @observation 準備回数・checkpoint・executeと保存候補。
 * @oracle 実Machineへの接続と最終候補の未保存を区別できる。
 * @cleanup 模擬Nativeをjoinし購読解除を確認する。
 */
function sessionFixture() {
  const f = fixture();
  const counts = {
    acquire: 0,
    prepare: 0,
    prepared: 0,
    observe: 0,
    checkpoint: 0,
    execute: 0,
  };
  let saved: Checkpoint | null = null;
  const input: Parameters<typeof runSession>[0] = {
    operationNonce: "1".repeat(64),
    signal: new AbortController().signal,
    resume: null,
    canIssueEffect: () => true,
    canRecordCheckpoint: () => true,
    onPrepared: (value) => {
      counts.prepared++;
      saved = value.checkpoint;
      return true;
    },
    onCheckpoint: (value) => {
      counts.checkpoint++;
      assert.ok(saved);
      assert.equal(transition(saved, value), true);
      saved = value;
      return true;
    },
  };
  const dependencies: Parameters<typeof runSession>[1] = {
    acquire: async () => {
      counts.acquire++;
      return f.acquire();
    },
    prepare: async (session, owner, nonce) => {
      counts.prepare++;
      assert.equal(session, f.session);
      assert.equal(owner, "a".repeat(64));
      assert.equal(nonce, input.operationNonce);
      return {
        scopeSha256: "b".repeat(64),
        cleanupFailure: () => null,
        technical: {
          observe: async (checkpoint) => {
            counts.observe++;
            return {
              ...checkpoint,
              engine: "ready",
              hostSafety: "safe",
              stale: "absent",
              directories: Object.fromEntries(
                Object.entries(checkpoint.directories).map(
                  ([name, directory]) => [
                    name,
                    {
                      ...directory,
                      source: { state: "absent", identity: null },
                      retained: { state: "absent", identity: null },
                    },
                  ],
                ),
              ) as Checkpoint["directories"],
            };
          },
          precondition: async () => "not_required",
          execute: async () => {
            counts.execute++;
            throw new Error("unexpected effect");
          },
          awaitEngine: async () => ({ state: "ready", continuation: null }),
        },
      };
    },
  };
  return {
    ...f,
    nativeCounts: f.counts,
    input,
    dependencies,
    counts,
    saved: () => saved,
  };
}

/**
 * 初回・clean再入場の実Machine接続を検査する。
 * @responsibility 準備保存前処置と最終cleanupの未保存を確認する。
 * @trace ERB-IT-014
 * @input 初回と同じH／Scopeの回収済みcheckpoint。
 * @returns N/A: assertion。
 * @precondition 模擬Nativeと実Machine。
 * @postcondition 準備一回、全通知合法、final候補未保存。
 * @effect 模擬観測とcallbackのみ。
 * @failure 相関・遷移・回数差は失敗。
 * @invariant 正常結果を実修復の証明にしない。
 * @boundary 準備とMachineとjoin。
 * @security 実Docker 0。
 * @concurrency 最終join後の通知0。
 * @stimulus 初回実行後、同じH/Scopeの回収済みcheckpointで再入場する。
 * @observation 準備一回、合法通知、保存済みpendingと最終候補。
 * @oracle 両経路ともrecoveredでも最終cleanup候補を保存済みと誤認しない。
 * @cleanup 同じSessionの終了と通知解除をfixtureで確認する。
 */
test("修復接続: 初回とclean再入場を実Machineへ結びfinal候補を未保存で返す", async () => {
  const f = sessionFixture();
  const result = await runSession(f.input, f.dependencies);
  assert.equal(result.preparation, "prepared");
  assert.equal(result.machine?.status, "recovered");
  assert.equal(result.lifecycle?.cleanup.cleanup, "confirmed");
  assert.equal(result.checkpoint?.cleanup, "confirmed");
  assert.equal(result.finalCheckpointConfirmed, false);
  assert.equal(f.saved()?.cleanup, "pending");
  assert.equal(f.counts.prepared, 1);
  assert.equal(f.counts.prepare, 1);
  assert.ok(f.counts.checkpoint > 0);
  assert.equal(f.counts.execute, 0);
  assert.ok(result.checkpoint);
  const next = sessionFixture();
  const resumed = await runSession(
    {
      ...next.input,
      resume: {
        ownerBindingSha256: "a".repeat(64),
        scopeSha256: "b".repeat(64),
        checkpoint: result.checkpoint,
      },
    },
    next.dependencies,
  );
  assert.equal(resumed.machine?.status, "recovered");
  assert.equal(next.counts.prepared, 1);
  assert.equal(next.saved()?.cleanup, "pending");
});

/**
 * 観測回収不明をNative回収と別に最終候補へ集約する。
 * @responsibility 後着Native成功・失敗で観測失敗を消さない。
 * @trace ERB-IT-014
 * @input 発行前／発行後の観測不明、Native回収三分類。
 * @returns N/A: assertion。
 * @precondition 模擬技術と実Machine。
 * @postcondition 不明後のEffect0、最終callback0、候補未保存。
 * @effect 模擬処置のみ。
 * @failure reason・回数・cleanup相関差は失敗。
 * @invariant 一次Effect失敗とcleanup失敗を別に保持する。
 * @boundary 同Adapterのsticky値、Machine、Native join、最終候補。
 * @security 実OS操作0。
 * @concurrency 内部signalと現在確認を同じ準備へ結合する。
 * @stimulus 観測回収不明の前後へNative回収三分類を与える。
 * @observation 一次失敗、cleanup候補、Effectと後着通知の数。
 * @oracle Native成功でも観測不明を消さずfresh処置を拒否する。
 * @cleanup 取得した同Sessionをabort/joinして購読を解除する。
 */
test("修復接続: 観測cleanup不明はNative回収で消さずfreshを拒否する", async () => {
  for (const stage of ["before_effect", "after_effect"] as const) {
    for (const cleanup of [
      { cleanup: "confirmed", protocol: "completed" },
      { cleanup: "confirmed", protocol: "failed" },
      { cleanup: "unknown", protocol: "failed" },
    ] as const) {
      const f = sessionFixture();
      let observationFailed = false,
        effects = 0,
        lateNotifications = 0;
      Object.defineProperty(f.session, "abort", {
        value: async () => {
          f.nativeCounts.abort++;
          return cleanup;
        },
      });
      const result = await runSession(
        {
          ...f.input,
          onCheckpoint: (value) => {
            if (observationFailed) lateNotifications++;
            return f.input.onCheckpoint(value);
          },
        },
        {
          ...f.dependencies,
          prepare: async (session, owner, nonce, signal, live) => {
            assert.notEqual(signal, f.input.signal);
            assert.equal(signal.aborted, false);
            assert.equal(live(), true);
            const prepared = await f.dependencies.prepare(
              session,
              owner,
              nonce,
              signal,
              live,
            );
            assert.ok(prepared);
            return {
              ...prepared,
              cleanupFailure: () =>
                observationFailed ? "observation_cleanup_unknown" : null,
              technical: {
                ...prepared.technical,
                observe: async (checkpoint, phase) => {
                  if (stage === "before_effect") {
                    observationFailed = true;
                    throw new Error("observation cleanup unknown");
                  }
                  return prepared.technical.observe(checkpoint, phase);
                },
                precondition: async (action) =>
                  action === "stop_runtime" ? "proceed" : "not_required",
                execute: async () => {
                  effects++;
                  observationFailed = true;
                  throw new Error("effect result unavailable");
                },
              },
            };
          },
        },
      );
      assert.equal(effects, stage === "after_effect" ? 1 : 0);
      assert.equal(lateNotifications, stage === "after_effect" ? 1 : 0);
      assert.equal(
        result.machine?.primaryFailure,
        stage === "after_effect" ? "runtime_repair_effect_unknown" : null,
      );
      assert.equal(
        result.lifecycle?.observationCleanupFailure,
        "observation_cleanup_unknown",
      );
      assert.deepEqual(result.lifecycle?.cleanup, cleanup);
      assert.equal(result.checkpoint?.cleanup, "unknown");
      assert.equal(
        result.checkpoint?.cleanupFailure,
        "observation_cleanup_unknown",
      );
      assert.equal(result.finalCheckpointConfirmed, false);
      assert.equal(f.nativeCounts.abort, 1);
      assert.equal(f.nativeCounts.release, 0);
      assert.ok(transition(f.saved(), result.checkpoint));
      const next = sessionFixture();
      assert.ok(result.checkpoint);
      const rejected = await runSession(
        {
          ...next.input,
          resume: {
            ownerBindingSha256: "a".repeat(64),
            scopeSha256: "b".repeat(64),
            checkpoint: result.checkpoint,
          },
        },
        next.dependencies,
      );
      assert.equal(rejected.preparation, "input_rejected");
      assert.equal(next.counts.acquire, 0);
    }
  }
});

/**
 * 準備返却時点の観測回収不明を同じOracleで検査する。
 * @responsibility 取消や準備拒否による回収事実の取り落しを検出する。
 * @trace ERB-IT-014
 * @input connection: 実接続またはメモリ変異、cancel: 返却直前取消。
 * @returns N/A: assertion。
 * @precondition 模擬Nativeと実Runtime接続を使用し、Machine開始前で停止する。
 * @postcondition 全通知・Machine・Effect0、同じ子をabort一回。
 * @effect 模擬準備と局所取消だけ。
 * @failure 理由・候補・回数差は失敗。
 * @invariant 準備未成立でも観測回収不明を保持する。
 * @boundary prepare返却と準備拒否。
 * @security 実OS・外部AI操作0。
 * @concurrency prepare返却直前の取消を明示的に駆動する。
 * @stimulus prepareにcleanup失敗を返し、必要なら直前取消を入れる。
 * @observation 固定理由・観測/保存/execute0とabort一回。
 * @oracle 準備拒否や取消より先に観測cleanup不明を保持する。
 * @cleanup 同じ模擬子をabortし後続通知を解除する。
 */
async function assertPreparationCleanupUnknown(
  connection: typeof runSession,
  cancel: boolean,
) {
  const f = sessionFixture();
  const controller = new AbortController();
  const result = await connection(
    { ...f.input, signal: controller.signal },
    {
      ...f.dependencies,
      prepare: async (...args) => {
        const prepared = await f.dependencies.prepare(...args);
        assert.ok(prepared);
        if (cancel) controller.abort();
        return {
          ...prepared,
          cleanupFailure: () => "observation_cleanup_unknown" as const,
        };
      },
    },
  );
  assert.equal(result.preparation, "boundary_unavailable");
  assert.equal(
    result.lifecycle?.observationCleanupFailure,
    "observation_cleanup_unknown",
    "prepare_cleanup_reason",
  );
  assert.equal(result.lifecycle?.failure, cancel ? "cancelled" : null);
  assert.equal(result.machine, null);
  assert.equal(result.checkpoint, null);
  assert.equal(result.finalCheckpointConfirmed, false);
  assert.equal(f.counts.prepare, 1);
  assert.equal(f.counts.prepared, 0);
  assert.equal(f.counts.observe, 0);
  assert.equal(f.counts.checkpoint, 0);
  assert.equal(f.counts.execute, 0);
  assert.equal(f.nativeCounts.abort, 1);
  assert.equal(f.nativeCounts.release, 0);
}

/**
 * 準備拒否より先に観測回収不明を捕捉することを反証する。
 * @responsibility prepare直後の未捕捉経路を通常・取消の双方で防ぐ。
 * @trace ERB-IT-014
 * @input 通常返却、直前取消と捕捉順序変異。
 * @returns N/A: assertion。
 * @precondition 変異はメモリ内だけ。
 * @postcondition 実接続成功、同Oracleで順序変異を拒否する。
 * @effect 模擬準備とSource読取りだけ。
 * @failure 変異位置不一致・Oracle受理は失敗。
 * @invariant 実Sourceを変更しない。
 * @boundary 準備事実と取消分類。
 * @security 実Docker・認証情報なし。
 * @concurrency 各条件を独立した子で評価する。
 * @stimulus 捕捉順を遅らせた変異と実接続へ通常・取消を与える。
 * @observation 実接続の成功と順序変異へのassertion拒否。
 * @oracle 同じOracleがprepare返却直後のcleanup不明を検出する。
 * @cleanup メモリ変異と模擬Sessionを破棄する。実Source不変更。
 */
test("修復接続: prepare返却時のcleanup不明は準備拒否・取消より先に捕捉する", async () => {
  const source = fs
    .readFileSync(
      new URL("../../src/docker-desktop/repair-session.ts", import.meta.url),
      "utf8",
    )
    .replaceAll("\r\n", "\n");
  const capture = `      if (prepared) {
        inspectObservationCleanup = prepared.cleanupFailure;
        recordObservationCleanup();
      }
`;
  const later = "      if (\n        captured.resume &&";
  assert.equal(source.split(capture).length, 2);
  assert.equal(source.split(later).length, 2);
  const mutant = repairConnectionMutant(
    source.replace(capture, "").replace(later, capture + later),
  );
  for (const cancel of [false, true]) {
    await assertPreparationCleanupUnknown(runSession, cancel);
    await assert.rejects(() => assertPreparationCleanupUnknown(mutant, cancel));
  }
});

/**
 * 不正再入場と準備拒否の処置0を検査する。
 * @responsibility 取得前拒否、相関不一致、通知拒否を区別する。
 * @trace ERB-IT-014
 * @input cleanup・処置窓・H／Scope差・同期確認不成立。
 * @returns N/A: assertion。
 * @precondition 正常対照から候補を導出する。
 * @postcondition 拒否後Machine通知0、取得済み子はabort一回。
 * @effect 模擬境界のみ。
 * @failure counter不一致は失敗。
 * @invariant unknownをfresh処置許可にしない。
 * @boundary 入力、準備保存、Machine開始。
 * @security getterとProxyを実行しない。
 * @concurrency 準備中・保存中の取消も含む。
 * @stimulus 不正checkpoint、取得前拒否、準備保存拒否を個別に与える。
 * @observation 取得・通知・executeと取得済み子abortの回数。
 * @oracle 拒否後Machine未開始、unknownをfresh許可へ変換しない。
 * @cleanup 取得済みの同じ子だけをabortしjoinする。
 */
test("修復接続: 不正再入場と準備保存拒否はMachine開始前に止まる", async () => {
  const baseline = sessionFixture();
  const complete = (await runSession(baseline.input, baseline.dependencies))
    .checkpoint;
  assert.ok(complete);
  for (const checkpoint of [
    { ...complete, cleanup: "pending" },
    { ...complete, cleanup: "unknown" },
    { ...complete, cleanupFailure: "helper_protocol_failed" },
    {
      ...complete,
      actions: {
        ...complete.actions,
        stop_runtime: {
          intent: "saved",
          request: "not_issued",
          result: "unobserved",
        },
      },
    },
    {
      ...complete,
      actions: {
        ...complete.actions,
        stop_runtime: {
          intent: "saved",
          request: "unknown",
          result: "unknown",
        },
      },
    },
  ]) {
    const f = sessionFixture();
    const result = await runSession(
      {
        ...f.input,
        resume: {
          ownerBindingSha256: "a".repeat(64),
          scopeSha256: "b".repeat(64),
          checkpoint: checkpoint as Checkpoint,
        },
      },
      f.dependencies,
    );
    assert.equal(result.preparation, "input_rejected");
    assert.equal(result.lifecycle, null);
    assert.equal(f.counts.acquire, 0);
  }
  for (const field of ["ownerBindingSha256", "scopeSha256"] as const) {
    const f = sessionFixture();
    const result = await runSession(
      {
        ...f.input,
        resume: {
          ownerBindingSha256: "a".repeat(64),
          scopeSha256: "b".repeat(64),
          checkpoint: complete,
          [field]: "c".repeat(64),
        },
      },
      f.dependencies,
    );
    assert.equal(result.preparation, "correlation_mismatch");
    assert.equal(result.machine, null);
    assert.equal(f.counts.prepared, 0);
    assert.equal(f.counts.observe, 0);
    assert.equal(f.nativeCounts.abort, 1);
  }
  for (const mode of [
    "false",
    "throw",
    "promise",
    "async",
    "cancel",
    "native",
  ] as const) {
    const f = sessionFixture();
    const controller = new AbortController();
    let preparedCalls = 0;
    const result = await runSession(
      {
        ...f.input,
        signal: controller.signal,
        onPrepared:
          mode === "async"
            ? async () => {
                preparedCalls++;
                return true;
              }
            : () => {
                preparedCalls++;
                if (mode === "throw") throw new Error();
                if (mode === "promise") return Promise.resolve(true);
                if (mode === "cancel") {
                  controller.abort();
                  return true;
                }
                if (mode === "native") {
                  f.fail();
                  return true;
                }
                return false;
              },
      },
      f.dependencies,
    );
    assert.equal(result.machine, null);
    assert.equal(f.counts.observe, 0);
    assert.equal(f.counts.checkpoint, 0);
    assert.equal(f.nativeCounts.abort, 1);
    assert.equal(preparedCalls, mode === "async" ? 0 : 1);
  }
});

/**
 * 本文の接続変異をメモリ内だけで作る。
 * @responsibility 実Sourceを変更せず同じOracleを反証する。
 * @trace ERB-IT-014
 * @input source: 読取り済み本文。
 * @returns 内部接続関数。
 * @precondition 変異箇所は呼出し元で一意性確認済み。
 * @postcondition 実ファイル不変更。
 * @effect 同Realm内の試験評価だけ。
 * @failure 構文・生成失敗は試験失敗。
 * @invariant 元の実Machineとcodecを注入する。
 * @boundary 接続本文と負対照。
 * @security 実OS・外部AIへ接続しない。
 * @concurrency N/A: 局所評価。
 * @stimulus 本番接続SourceからImport/Exportだけを除き型を消す。
 * @observation 既存Machine・decoder・checkpoint準備を結合したrunner。
 * @oracle Source抽出が成立しなければ停止し、変異だけを同じOracleへ渡す。
 * @cleanup VMとSource変異をメモリ内で破棄する。
 */
function repairConnectionMutant(source: string): typeof runSession {
  const stripped = stripTypeScriptTypes(
    source
      .replace(/import[\s\S]*?from "[^"]+";/gu, "")
      .replaceAll("export function", "function")
      .replaceAll("export async function", "async function"),
  );
  return runInThisContext(
    `((types, decode, prepareDockerRuntimeRepairSessionCheckpoint, runDockerRuntimeRepairMachine) => { ${stripped}; return runDockerRuntimeRepairSessionUsing; })`,
  )(
    types,
    decode,
    prepareDockerRuntimeRepairSessionCheckpoint,
    runDockerRuntimeRepairMachine,
  ) as typeof runSession;
}

/**
 * 準備済み技術境界から一処置の意図・発行・確認までを検査する。
 * @responsibility 全不要化・通知二重化が接続成功へ紛れることを防ぐ。
 * @trace ERB-IT-014
 * @input 一slotのproceedと模擬confirmed処置、許可喪失、接続変異。
 * @returns N/A: assertion。
 * @precondition 実Machineを使用し実Dockerは使用しない。
 * @postcondition 正常execute1、拒否execute0、全通知合法。
 * @effect 模擬処置だけ。
 * @failure 到達・回数・保存列不一致は失敗。
 * @invariant 保存済みpendingと未保存cleanup候補を区別する。
 * @boundary 準備、実Machine、技術処置、join。
 * @security 実Effect0。
 * @concurrency 保存後の処置許可単独喪失を含む。
 * @stimulus 一slotの正常・拒否・許可喪失と通知二重化変異を実行する。
 * @observation execute0/1、意図・発行・確認列、全通知の合法性。
 * @oracle 実接続は成立し同じOracleが不要化・二重化変異を拒否する。
 * @cleanup 模擬Native終了を待機し通知解除を確認する。
 */
test("修復接続: 一処置の搬送と通知一回性を同Oracleで反証する", async () => {
  const oracle = async (
    runner: typeof runSession,
    mode: "normal" | "reject" | "lost",
  ) => {
    const f = sessionFixture();
    let allowed = true;
    let preparedCalls = 0;
    let effectCalls = 0;
    const sequence: string[] = [];
    /**
     * stop_runtimeのcheckpoint遷移を重複なしで記録する。
     * @responsibility stop_runtimeのcheckpoint遷移を重複なしで記録する。
     * @trace ERB-IT-014
     * @precondition 同一slotのcheckpoint通知列。
     * @stimulus action値を結合し直前値と異なるときだけ追加する。
     * @observation 意図・発行・確認の順序列。
     * @oracle 保存前処置や重複通知を独立期待列で検出する。
     * @cleanup N/A: 局所の文字列配列のみ。
     * @boundary 実Runtime通知と有限処置。実OS操作なし。
     */
    const record = (checkpoint: Checkpoint) => {
      const value = Object.values(checkpoint.actions.stop_runtime).join(":");
      if (sequence.at(-1) !== value) sequence.push(value);
    };
    const result = await runner(
      {
        ...f.input,
        canIssueEffect: () => allowed,
        onPrepared: (value) => {
          preparedCalls++;
          if (mode === "reject") return false;
          record(value.checkpoint);
          if (mode === "lost") allowed = false;
          return f.input.onPrepared(value);
        },
        onCheckpoint: (value) => {
          record(value);
          return f.input.onCheckpoint(value);
        },
      },
      {
        ...f.dependencies,
        prepare: async (...args) => {
          const prepared = await f.dependencies.prepare(...args);
          assert.ok(prepared);
          return {
            ...prepared,
            technical: {
              ...prepared.technical,
              precondition: async (action) =>
                action === "stop_runtime" ? "proceed" : "not_required",
              execute: async (action, checkpoint) => {
                assert.equal(action, "stop_runtime");
                effectCalls++;
                return {
                  issued: true,
                  confirmation: "confirmed",
                  observation: checkpoint,
                };
              },
            },
          };
        },
      },
    );
    assert.equal(preparedCalls, 1);
    assert.equal(effectCalls, mode === "normal" ? 1 : 0);
    if (mode === "normal") {
      assert.equal(result.machine?.status, "recovered");
      assert.deepEqual(sequence, [
        "not_saved:not_issued:unobserved",
        "saved:not_issued:unobserved",
        "saved:issued:unobserved",
        "saved:issued:confirmed",
      ]);
      assert.equal(f.nativeCounts.release, 1);
    } else {
      assert.equal(result.machine, null);
      assert.equal(f.counts.observe, 0);
      assert.equal(f.counts.checkpoint, 0);
      assert.equal(f.nativeCounts.abort, 1);
    }
    if (mode !== "reject") {
      assert.equal(result.preparation, "prepared");
      assert.equal(f.saved()?.cleanup, "pending");
      assert.equal(result.checkpoint?.cleanup, "confirmed");
      assert.equal(result.finalCheckpointConfirmed, false);
      assert.equal(result.lifecycle?.failure, null);
    }
  };
  for (const mode of ["normal", "reject", "lost"] as const)
    await oracle(runSession, mode);
  const source = fs.readFileSync(
    new URL("../../src/docker-desktop/repair-session.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.split("prepared.technical,").length, 2);
  const noEffect = repairConnectionMutant(
    source.replace(
      "prepared.technical,",
      '{ ...prepared.technical, precondition: async () => "not_required" },',
    ),
  );
  await assert.rejects(() => oracle(noEffect, "normal"), assert.AssertionError);
  assert.equal(source.split("captured.onPrepared,").length, 2);
  const duplicate = repairConnectionMutant(
    source.replace(
      "captured.onPrepared,",
      "(argument: Parameters<RepairInput['onPrepared']>[0]) => { captured.onPrepared(argument); return captured.onPrepared(argument); },",
    ),
  );
  await assert.rejects(
    () => oracle(duplicate, "normal"),
    assert.AssertionError,
  );
});

/**
 * 準備awaitと同期確認内の失効、hostile入力を検査する。
 * @responsibility 準備後の通知・Machine到達を個別に観測する。
 * @trace ERB-IT-014
 * @input prepare中取消・Native喪失・保存Owner喪失と不正通知。
 * @returns N/A: assertion。
 * @precondition 実Processを使わない。
 * @postcondition 拒否点以後の通知・観測0、同子abort1。
 * @effect 模擬signalとcounterのみ。
 * @failure getter・Proxy・到達不一致は失敗。
 * @invariant 処置許可確認中の取消をtrueへ昇格しない。
 * @boundary 未信頼入力、非同期準備、保存前確認。
 * @security hostile getterとapply trapは0。
 * @concurrency await後と同期callback後を確認する。
 * @stimulus prepare待機中・保存確認中の取消やNative喪失とhostile値を与える。
 * @observation 拒否後の観測・通知0、getter/Proxy到達数。
 * @oracle 喪失や不正値をtrueへ昇格せず同じ子を一回abortする。
 * @cleanup 同Sessionをjoinし登録購読を解除する。
 */
test("修復接続: 準備中喪失とhostile値では後続通知0", async () => {
  for (const mode of [
    "prepare_cancel",
    "prepare_native",
    "record_cancel",
    "record_false",
  ] as const) {
    const f = sessionFixture();
    const controller = new AbortController();
    const result = await runSession(
      {
        ...f.input,
        signal: controller.signal,
        canRecordCheckpoint: () => {
          if (mode === "record_cancel") controller.abort();
          return mode !== "record_false";
        },
      },
      {
        ...f.dependencies,
        prepare: async (...args) => {
          const prepared = await f.dependencies.prepare(...args);
          if (mode === "prepare_cancel") controller.abort();
          if (mode === "prepare_native") f.fail();
          return prepared;
        },
      },
    );
    assert.equal(f.counts.prepare, 1);
    assert.equal(f.counts.prepared, 0);
    assert.equal(f.counts.observe, 0);
    assert.equal(result.machine, null);
    assert.equal(f.nativeCounts.abort, 1);
  }
  let traps = 0;
  for (const mode of ["getter", "input_proxy", "signal_proxy"] as const) {
    const f = sessionFixture();
    let input: Parameters<typeof runSession>[0] = { ...f.input };
    if (mode === "getter")
      Object.defineProperty(input, "operationNonce", {
        get() {
          traps++;
          return f.input.operationNonce;
        },
      });
    if (mode === "input_proxy")
      input = new Proxy(input, {
        getPrototypeOf() {
          traps++;
          return Object.prototype;
        },
      });
    if (mode === "signal_proxy")
      input = {
        ...input,
        signal: new Proxy(input.signal, {
          getPrototypeOf() {
            traps++;
            return AbortSignal.prototype;
          },
        }),
      };
    assert.equal(
      (await runSession(input, f.dependencies)).preparation,
      "input_rejected",
    );
    assert.equal(f.counts.acquire, 0);
  }
  for (const mode of ["thenable", "function_proxy"] as const) {
    const f = sessionFixture();
    let preparedCalls = 0;
    const onPrepared =
      mode === "thenable"
        ? () => {
            preparedCalls++;
            // biome-ignore lint/suspicious/noThenProperty: 不正thenableのgetterを実行しない負例。
            return Object.defineProperty({}, "then", {
              get() {
                traps++;
                return () => {};
              },
            });
          }
        : new Proxy(
            () => {
              preparedCalls++;
              return true;
            },
            {
              apply() {
                traps++;
                return true;
              },
            },
          );
    assert.equal(
      (await runSession({ ...f.input, onPrepared }, f.dependencies)).machine,
      null,
    );
    assert.equal(f.counts.observe, 0);
    assert.equal(f.nativeCounts.abort, 1);
    assert.equal(preparedCalls, mode === "thenable" ? 1 : 0);
  }
  assert.equal(traps, 0);
});

/**
 * 取消前と取得待ち中の取消を検査する。
 * @responsibility 遅れて取得した子のjoin省略を検出する。
 * @trace ERB-IT-014
 * @input 取消済みsignalと遅延取得。
 * @returns N/A: assertion。
 * @precondition 模擬取得だけ。
 * @postcondition execute 0、同じ子abort 1。
 * @effect 模擬callbackのみ。
 * @failure 回数不一致は失敗。
 * @invariant 取消を取得失敗へ畳まない。
 * @boundary 取得待機と取消。
 * @security 実Effect 0。
 * @concurrency 遅延closeの完了まで返却しない。
 * @stimulus 事前取消と取得Promise保留後の取消を別々に駆動する。
 * @observation 取得数・execute0・同じ子abortと待機の完了順。
 * @oracle 遅れて取得した子の終了まで返らず取消を取得失敗へ畳まない。
 * @cleanup 遅延closeを解決して同じ子をjoinする。
 */
test("修復生涯: 取消中に遅れて取得した同じ子を終了待機する", async () => {
  const controller = new AbortController();
  controller.abort();
  let acquisitions = 0;
  const early = await run(
    controller.signal,
    async () => {
      acquisitions++;
      throw new Error();
    },
    async () => {
      throw new Error();
    },
  );
  assert.equal(early.failure, "cancelled");
  assert.equal(acquisitions, 0);
  const next = new AbortController();
  let finish!: () => void;
  const f = fixture(async () => {
    await new Promise<void>((resolve) => {
      finish = resolve;
    });
    return { cleanup: "confirmed", protocol: "completed" };
  });
  let acquire!: (value: Awaited<ReturnType<typeof f.acquire>>) => void;
  let executed = 0;
  let settled = false;
  const pending = run(
    next.signal,
    () =>
      new Promise((resolve) => {
        acquire = resolve;
      }),
    async () => {
      executed++;
      return { value: 1, abortRequired: false };
    },
  ).then((value) => {
    settled = true;
    return value;
  });
  next.abort();
  acquire(await f.acquire());
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(settled, false);
  assert.equal(f.counts.abort, 1);
  finish();
  assert.equal((await pending).failure, "cancelled");
  assert.equal(executed, 0);
  assert.deepEqual(f.counts, { abort: 1, release: 0, unsubscribe: 1 });
});

/**
 * 一次結果と失敗・回収の分離を検査する。
 * @responsibility Native失敗の取消誤分類とclose重複を検出する。
 * @trace ERB-IT-014
 * @input 正常、Native失敗、実行失敗、回収失敗の組合せ。
 * @returns N/A: assertion。
 * @precondition 模擬Nativeのみ。
 * @postcondition 同じ子close 1、解除後通知無効。
 * @effect 模擬通知のみ。
 * @failure 分類・回数不一致は失敗。
 * @invariant 実行値を回収結果で破壊しない。
 * @boundary 実行と回収。
 * @security 実OS操作0。
 * @concurrency 終了後の遅延通知も送る。
 * @stimulus 正常・Native失敗・実行例外・close例外を組み合わせる。
 * @observation 一次value/reason、abort/releaseの別計数と遅延通知。
 * @oracle 元実行値を保ちclose一回、解除後の通知を無効にする。
 * @cleanup 同じ模擬子の終了と購読解除を確認する。
 */
test("修復生涯: 正常releaseとNative失敗abortを分離する", async () => {
  for (const mode of ["normal", "native", "throw", "close_throw"] as const) {
    const f = fixture(async () => {
      if (mode === "close_throw") throw new Error();
      return { cleanup: "confirmed", protocol: "completed" };
    });
    const result = await run(
      new AbortController().signal,
      f.acquire,
      async (session, owner, signal) => {
        assert.equal(session, f.session);
        assert.equal(owner, "a".repeat(64));
        if (mode === "native") {
          f.fail();
          assert.equal(signal.aborted, true);
        }
        if (mode === "throw") throw new Error();
        return { value: "primary", abortRequired: false };
      },
    );
    assert.equal(f.counts.abort + f.counts.release, 1);
    assert.equal(f.counts.abort, mode === "native" || mode === "throw" ? 1 : 0);
    assert.equal(
      f.counts.release,
      mode === "normal" || mode === "close_throw" ? 1 : 0,
    );
    assert.equal(f.counts.unsubscribe, 1);
    assert.equal(
      result.failure,
      mode === "native"
        ? "helper_failed"
        : mode === "throw"
          ? "execution_failed"
          : null,
    );
    assert.equal(
      result.cleanup.cleanup,
      mode === "close_throw" ? "unknown" : "confirmed",
    );
    assert.equal(result.value, mode === "throw" ? null : "primary");
    f.fail();
    assert.equal(f.counts.abort + f.counts.release, 1);
  }
});

/**
 * 最初の停止理由と終了後の通知無効化を検査する。
 * @responsibility 分類上書きと終了gate欠落を直接反証する。
 * @trace ERB-IT-014
 * @input 遅延取得、通知順序、終了gate無効変異。
 * @returns N/A: assertion。
 * @precondition 実Process・Docker操作0。
 * @postcondition 最初の停止理由を保持し、終了後内部signal変更0。
 * @effect 模擬購読と取消のみ。
 * @failure 回数・分類・signal差は失敗。
 * @invariant 回収不明を一次値で隠さない。
 * @boundary 内部runtimeの取得と終了。
 * @security Sourceはメモリ変異だけで実ファイルを変更しない。
 * @concurrency 遅延取得・順序違いを明示駆動する。
 * @stimulus 取得分類と通知順序を変え、終了gate/解除欠落の変異も実行する。
 * @observation 最初の停止理由・同じ参照・終了後SignalとListener数。
 * @oracle first-wins理由を保持し同Oracleで終了gate欠落を拒否する。
 * @cleanup 監視用Signal wrapperを復元し同Sessionをjoinする。
 */
test("修復生涯: first-wins理由と終了gateを独立Oracleで反証する", async () => {
  for (const status of [
    "unavailable",
    "protocol_failed",
    "cleanup_unknown",
    "acquired",
  ] as const) {
    const controller = new AbortController();
    const pending = run(
      controller.signal,
      async () => {
        controller.abort();
        return { status, session: null, ownerBindingSha256: null };
      },
      async () => {
        assert.fail("execute forbidden");
      },
    );
    assert.equal((await pending).failure, "cancelled");
  }
  for (const first of ["cancelled", "helper_failed"] as const) {
    const controller = new AbortController();
    const f = fixture();
    const result = await run(controller.signal, f.acquire, async () => {
      if (first === "cancelled") {
        controller.abort();
        f.fail();
      } else {
        f.fail();
        controller.abort();
      }
      return { value: 7, abortRequired: false };
    });
    assert.equal(result.failure, first);
    assert.deepEqual(f.counts, { abort: 1, release: 0, unsubscribe: 1 });
  }
  for (const protocol of ["completed", "failed"] as const) {
    const f = fixture();
    const session = {
      ...f.session,
      abort: async () => {
        f.counts.abort++;
        return { cleanup: "unknown" as const, protocol };
      },
    };
    const result = await run(
      new AbortController().signal,
      async () => ({
        status: "acquired",
        session,
        ownerBindingSha256: "a".repeat(64),
      }),
      async () => ({ value: 9, abortRequired: true }),
    );
    assert.equal(result.value, 9);
    assert.equal(result.failure, null);
    assert.deepEqual(result.cleanup, { cleanup: "unknown", protocol });
    assert.deepEqual(f.counts, { abort: 1, release: 0, unsubscribe: 1 });
  }
  /**
   * first-winsと終了後監視解除を同一Oracleで反証する。
   * @responsibility first-winsと終了後監視解除を同一Oracleで反証する。
   * @trace ERB-IT-014
   * @precondition 実runnerまたは終了gate/解除を無効化した変異。
   * @stimulus 取消順序を駆動しSignal購読数を前後で取得する。
   * @observation 一次理由、signal、同じ子の回収と購読解除数。
   * @oracle 元理由保持・同じ子の終了・Listener解除が全部成立する。
   * @cleanup 取り付けたSignal観測代役を復元して同じSessionを終了する。
   * @boundary 取消とNative Sessionの有限代役。実Processは生成しない。
   */
  const oracle = async (runner: typeof run) => {
    const controller = new AbortController();
    const initialListeners = getEventListeners(
      controller.signal,
      "abort",
    ).length;
    const f = fixture();
    let internal: AbortSignal | null = null;
    let notifications = 0;
    let added = 0;
    let removed = 0;
    const add = controller.signal.addEventListener.bind(controller.signal);
    const remove = controller.signal.removeEventListener.bind(
      controller.signal,
    );
    controller.signal.addEventListener = (
      ...args: Parameters<AbortSignal["addEventListener"]>
    ) => {
      added++;
      return add(...args);
    };
    controller.signal.removeEventListener = (
      ...args: Parameters<AbortSignal["removeEventListener"]>
    ) => {
      removed++;
      return remove(...args);
    };
    await runner(
      controller.signal,
      f.acquire,
      async (_session, _owner, signal) => {
        internal = signal;
        signal.addEventListener("abort", () => {
          notifications++;
        });
        return { value: 1, abortRequired: false };
      },
    );
    assert.equal(added, 1);
    assert.equal(removed, 1);
    assert.equal(
      getEventListeners(controller.signal, "abort").length,
      initialListeners,
    );
    assert.equal((internal as AbortSignal | null)?.aborted, false);
    f.fail();
    controller.abort();
    assert.equal((internal as AbortSignal | null)?.aborted, false);
    assert.equal(notifications, 0);
  };
  await oracle(run);
  const source = fs.readFileSync(
    new URL("../../src/docker-desktop/repair-session.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.split("ended = true;").length, 2);
  const mutant = stripTypeScriptTypes(
    source
      .replace("ended = true;", "ended = false;")
      .replace(/import[\s\S]*?from "[^"]+";/gu, "")
      .replaceAll("export function", "function")
      .replaceAll("export async function", "async function"),
  );
  const mutated = runInThisContext(
    `(() => { ${mutant}; return ownDockerRepairNativeSession; })()`,
  ) as typeof run;
  await assert.rejects(() => oracle(mutated), assert.AssertionError);
  assert.equal(
    source.split('signal.removeEventListener("abort", cancel);').length,
    2,
  );
  const noRemoval = stripTypeScriptTypes(
    source
      .replace(
        'signal.removeEventListener("abort", cancel);',
        'signal.removeEventListener("abort", () => undefined);',
      )
      .replace(/import[\s\S]*?from "[^"]+";/gu, "")
      .replaceAll("export function", "function")
      .replaceAll("export async function", "async function"),
  );
  const removalMutant = runInThisContext(
    `(() => { ${noRemoval}; return ownDockerRepairNativeSession; })()`,
  ) as typeof run;
  await assert.rejects(() => oracle(removalMutant), assert.AssertionError);
});

/**
 * 取得分類と同期のNative喪失を検査する。
 * @responsibility null Sessionを一律に回収成功とする誤りを検出する。
 * @trace ERB-IT-014
 * @input 四取得分類、取得例外、購読時の同期失敗。
 * @returns N/A: assertion。
 * @precondition 実Processを使わない。
 * @postcondition 実行不可経路のexecute 0。
 * @effect 局所模擬だけ。
 * @failure 分類不一致は失敗。
 * @invariant protocol失敗とcleanup不明を分離する。
 * @boundary Native取得と修復開始。
 * @security 外部送信0。
 * @concurrency 購読登録中の通知にも対応する。
 * @stimulus 四つの取得分類、取得例外と購読時の同期失敗を与える。
 * @observation 回収分類・execute0と一次理由。
 * @oracle null Sessionを一律cleanup成功にせずprotocol/cleanup失敗を分ける。
 * @cleanup 取得したSessionがある場合だけ同じ対象を終了する。
 */
test("修復生涯: 取得不能の回収分類と同期失敗を保持する", async () => {
  for (const status of [
    "unavailable",
    "protocol_failed",
    "cleanup_unknown",
    "acquired",
  ] as const) {
    let executed = 0;
    const result = await run(
      new AbortController().signal,
      async () => ({ status, session: null, ownerBindingSha256: null }),
      async () => {
        executed++;
        return { value: 1, abortRequired: false };
      },
    );
    assert.equal(executed, 0);
    assert.equal(result.failure, "helper_unavailable");
    assert.equal(
      result.cleanup.cleanup,
      status === "cleanup_unknown" || status === "acquired"
        ? "unknown"
        : "confirmed",
    );
    assert.equal(
      result.cleanup.protocol,
      status === "protocol_failed" ? "failed" : "not_applicable",
    );
  }
  const thrown = await run(
    new AbortController().signal,
    async () => {
      throw new Error();
    },
    async () => {
      throw new Error();
    },
  );
  assert.equal(thrown.cleanup.cleanup, "unknown");
  const f = fixture();
  let executed = 0;
  const session = {
    ...f.session,
    onFailureDetected: (callback: () => void) => {
      callback();
      return () => {
        f.counts.unsubscribe++;
      };
    },
  };
  const result = await run(
    new AbortController().signal,
    async () => ({
      status: "acquired",
      session,
      ownerBindingSha256: "a".repeat(64),
    }),
    async () => {
      executed++;
      return { value: 1, abortRequired: false };
    },
  );
  assert.equal(result.failure, "helper_failed");
  assert.equal(executed, 0);
  assert.deepEqual(f.counts, { abort: 1, release: 0, unsubscribe: 1 });
});

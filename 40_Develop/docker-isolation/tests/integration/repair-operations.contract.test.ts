/**
 * 固定修復Adapterと実Machineの接続を検証する。
 * @packageDocumentation
 * @responsibility OS技術境界だけを模擬し、前提・発行・記録の搬送を確認する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 実Docker・Native・外部AI要求0。実Directory factoryは別契約試験。
 * @boundary 実修復Adapter・Machineと有限OS代役。実Host修復の成立は主張しない。
 */
import {
  decodeDockerRuntimeRepairCheckpoint as decode,
  type DockerRuntimeRepairCheckpoint as Checkpoint,
} from "../../../domain-model/src/index.ts";
import assert from "node:assert/strict";
import test from "node:test";
import { getEventListeners } from "node:events";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInThisContext } from "node:vm";
import { types } from "node:util";
import {
  dockerDesktopDistributionRoot,
  describeDockerRuntimeArtifactTrustContract,
} from "../../src/docker-cli/trust.ts";
import { runDockerRuntimeRepairMachine } from "../../src/docker-desktop/repair.ts";
import { createDockerDesktopRepairOperations as operations } from "../../src/docker-desktop/repair-operations.ts";
import { runDockerRuntimeRepairSessionUsing as run } from "../../src/docker-desktop/repair-session.ts";
import {
  validateDockerRuntimeRepairCheckpointTransition as transition,
  prepareDockerRuntimeRepairSessionCheckpoint,
} from "../../src/docker-desktop/repair-state.ts";
import type { DockerDesktopRepairNativeHelperSession as Session } from "../../../platform-access/src/index.ts";

/**
 * 三対象・同Native子・Engineの模擬実境界を構成する。
 * @responsibility 実Adapterの全前提と操作を差替えず、最下位だけ観測可能にする。
 * @trace ERB-IT-014
 * @input continuation: 初回起動がtimeoutするか。
 * @returns 実Runtime実行入口と模擬境界の観測値。
 * @precondition 実OS要求を発行しない。
 * @postcondition 保存候補は実validatorへ通す。
 * @effect 局所状態・counterのみ。
 * @failure 不正遷移はassertion失敗。
 * @invariant 模擬正常を実Docker修復の証明にしない。
 * @boundary 実Adapterと最下位Native／Directory／Engine。
 * @security Path・資格・秘密値なし。
 * @concurrency 同じsignalとSessionだけを利用する。
 * @stimulus 継続有無を選び固定Runtimeと通知callbackを組み立てる。
 * @observation checkpoint・source/failed/auxiliary identityとcallback到達列。
 * @oracle 同じfixtureで正常と故障を比べ、処置順・保存順の差を検出できる。
 * @cleanup 技術操作は有限代役だけで、実DirectoryやProcessを作らない。
 */
function fixture(continuation = false, createOperations = operations) {
  type Identity = NonNullable<Checkpoint["directories"]["primary"]["expected"]>;
  const identity = (ino: string): Identity => ({
    dev: "1",
    ino,
    birthtimeNs: "3",
  });
  const original = identity("1"),
    failed = identity("2"),
    auxiliary = identity("3");
  const controller = new AbortController();
  const state = {
    engine: "known_unavailable" as
      | "ready"
      | "known_unavailable"
      | "transient_unavailable"
      | "unknown",
    processes: "verified" as "verified" | "absent" | "unknown",
    backend: "running" as "running" | "stopped" | "unknown",
    source: original as Identity | null,
    auxiliary: null as Identity | null,
    retained: { initial: null, failed: null, auxiliary: null } as Record<
      "initial" | "failed" | "auxiliary",
      Identity | null
    >,
    artifact: true,
    scope: true,
    permission: true,
    cleanupUnknown: false,
    lockFailure: "" as string,
    sameGeneration: false,
    wrongRetained: false,
    cancelAfterTerminate: false,
    launchGeneration: 0,
    cancelDuringWait: false,
    cleanupDuringWait: false,
    waitReadyAfterRestart: false,
    stoppedDrift: "none" as "none" | "engine" | "process",
    termination: "terminated" as Awaited<
      ReturnType<Session["terminateProcesses"]>
    >,
    launching: "started" as Awaited<ReturnType<Session["launchDesktop"]>>,
  };
  const calls = {
    verify: 0,
    inspect: 0,
    terminate: 0,
    backend: 0,
    launch: 0,
    abort: 0,
    release: 0,
    engine: 0,
    wait: 0,
    retain: [] as string[],
    lock: [] as string[],
    events: [] as string[],
    saved: [] as Checkpoint[],
    phases: [] as string[],
    driftInjected: 0,
    prepared: 0,
    acquire: 0,
    precondition: [] as string[],
    waitStages: [] as string[],
  };
  let signal: AbortSignal | null = null;
  let saved: Checkpoint | null = null;
  let resume: Parameters<typeof run>[0]["resume"] = null;
  let onSave: (value: Checkpoint) => void = () => {};
  let afterWait: () => void = () => {};
  const session: Session = {
    assertLive: () => true,
    failureDetected: new Promise(() => {}),
    onFailureDetected: () => () => {},
    verifyArtifacts: async () => {
      calls.verify++;
      return state.artifact ? "verified" : "unknown";
    },
    inspectProcesses: async () => {
      calls.inspect++;
      return state.processes;
    },
    terminateProcesses: async () => {
      calls.terminate++;
      calls.events.push("terminate");
      if (state.termination !== "terminated") return state.termination;
      state.processes = "absent";
      state.engine = "known_unavailable";
      if (calls.terminate === 2 && state.stoppedDrift !== "none") {
        calls.driftInjected++;
        if (state.stoppedDrift === "engine")
          state.engine = "transient_unavailable";
        else state.processes = "verified";
      }
      if (state.cancelAfterTerminate) controller.abort();
      return "terminated";
    },
    launchDesktop: async () => {
      calls.launch++;
      calls.events.push("launch");
      if (state.launching !== "started") return state.launching;
      state.launchGeneration++;
      state.processes = "verified";
      state.source = state.sameGeneration
        ? original
        : state.launchGeneration === 1
          ? failed
          : identity("4");
      state.auxiliary =
        state.launchGeneration === 1 ? auxiliary : identity("5");
      state.engine =
        continuation && state.launchGeneration === 1
          ? "transient_unavailable"
          : "ready";
      if (state.wrongRetained) state.retained.initial = identity("9");
      return "started";
    },
    abort: async () => {
      calls.abort++;
      return { cleanup: "confirmed", protocol: "completed" };
    },
    release: async () => {
      calls.release++;
      return { cleanup: "confirmed", protocol: "completed" };
    },
  };
  const access: Parameters<typeof operations>[1] = {
    scopeSha256: "b".repeat(64),
    verify: () => state.scope,
    observe: (purpose) => {
      const source = purpose === "auxiliary" ? state.auxiliary : state.source;
      const retained = state.retained[purpose];
      return {
        source: source
          ? { state: "present", identity: source }
          : { state: "confirmed_absent", identity: null },
        retained: retained
          ? { state: "present", identity: retained }
          : { state: "confirmed_absent", identity: null },
      };
    },
    lock: (purpose) => {
      calls.lock.push(purpose);
      return state.lockFailure === purpose
        ? null
        : purpose === "auxiliary"
          ? state.auxiliary
          : state.source;
    },
    retain: (purpose, expected) => {
      calls.retain.push(purpose);
      calls.events.push(`retain:${purpose}`);
      const source = purpose === "auxiliary" ? state.auxiliary : state.source;
      assert.deepEqual(source, expected);
      assert.equal(state.retained[purpose], null);
      assert.equal(state.processes, "absent");
      assert.equal(state.engine, "known_unavailable");
      state.retained[purpose] = source;
      if (purpose === "auxiliary") state.auxiliary = null;
      else state.source = null;
      return {
        issued: true,
        confirmation: "confirmed",
        staleState: "retained",
      };
    },
  };
  /**
   * 同じ模擬最下位境界を実Operationsへ渡す。
   * @responsibility 組立て試験と既存回数Oracleで同じ境界を共用する。
   * @trace ERB-IT-014
   * @input 同Session、Access、内部signal、live。
   * @returns 実Adapter。
   * @precondition 同じfixtureだけ。
   * @postcondition 外部signalを内部signalへ代用しない。
   * @effect 局所counterのみ。
   * @failure 相関差はassertion。
   * @invariant 実Adapterの前提と処置を差替えない。
   * @boundary 試験最下位境界。
   * @security 実OS要求0。
   * @concurrency 同内部signalのlistenerを観測する。
   */
  const connectOperations: typeof operations = (
    sameSession,
    sameAccess,
    internalSignal,
    live,
  ) => {
    assert.equal(sameSession, session);
    assert.equal(sameAccess, access);
    assert.notEqual(internalSignal, controller.signal);
    signal = internalSignal;
    const adapter = createOperations(session, access, internalSignal, live, {
      engine: () => {
        calls.engine++;
        return {
          state: state.engine,
          cleanup: state.cleanupUnknown ? "unknown" : "confirmed",
        };
      },
      backend: () => state.backend,
      terminateBackend: () => {
        calls.backend++;
        calls.events.push("backend");
        state.backend = "stopped";
        return { issued: true, confirmation: "confirmed" };
      },
      wait: async (observe, shouldStop) => {
        calls.wait++;
        assert.equal(getEventListeners(internalSignal, "abort").length, 1);
        assert.equal(shouldStop(), false);
        if (state.cancelDuringWait) {
          controller.abort();
          assert.equal(shouldStop(), true);
          return "unknown";
        }
        if (state.cleanupDuringWait) state.cleanupUnknown = true;
        if (state.waitReadyAfterRestart && state.launchGeneration >= 2)
          state.engine = "ready";
        const observed = observe();
        afterWait();
        return observed === "ready" || observed === "unknown"
          ? observed
          : "startup_timeout";
      },
    });
    return {
      ...adapter,
      technical: {
        ...adapter.technical,
        observe: async (checkpoint, phase) => {
          calls.phases.push(phase);
          return adapter.technical.observe(checkpoint, phase);
        },
        precondition: async (action, checkpoint) => {
          calls.precondition.push(action);
          return adapter.technical.precondition(action, checkpoint);
        },
        awaitEngine: async (stage, checkpoint) => {
          calls.waitStages.push(stage);
          return adapter.technical.awaitEngine(stage, checkpoint);
        },
      },
    };
  };
  /**
   * 同じ修復fixtureのcheckpointと通知を実Runtimeへ渡す。
   * @responsibility 同じ修復fixtureのcheckpointと通知を実Runtimeへ渡す。
   * @trace ERB-IT-014
   * @precondition 固定nonce・resume・取消Signalと有限操作代役。
   * @stimulus 指定runnerへinputと観測callbackを結合する。
   * @observation 保存列、通知、結果と操作回数。
   * @oracle 既存Owner確認と保存順に一致しなければ拒否する。
   * @cleanup 模擬Sessionのrelease/abortと通知解除を親Caseが確認する。
   * @boundary 実Runtime・Machineと有限技術代役。実Dockerなし。
   */
  const execute = (runtime: typeof run = run) =>
    runtime(
      {
        operationNonce: "1".repeat(64),
        signal: controller.signal,
        resume,
        canIssueEffect: () => state.permission,
        canRecordCheckpoint: () => true,
        onPrepared: (value) => {
          calls.prepared++;
          saved = value.checkpoint;
          return true;
        },
        onCheckpoint: (value) => {
          assert.ok(transition(saved, value));
          saved = value;
          calls.saved.push(value);
          if (
            value.directories.failed.expected &&
            value.actions.stop_failed_runtime.intent === "not_saved"
          )
            calls.events.push("bound");
          onSave(value);
          return true;
        },
      },
      {
        acquire: async () => {
          calls.acquire++;
          return {
            status: "acquired",
            session,
            ownerBindingSha256: "a".repeat(64),
          };
        },
        prepare: async (sameSession, owner, nonce, internalSignal, live) => {
          assert.equal(sameSession, session);
          assert.equal(owner, "a".repeat(64));
          assert.equal(nonce, "1".repeat(64));
          const adapter = connectOperations(
            session,
            access,
            internalSignal,
            live,
          );
          return { ...adapter, scopeSha256: access.scopeSha256 };
        },
      },
    );
  return {
    state,
    calls,
    controller,
    execute,
    session,
    access,
    connectOperations,
    setResume: (
      checkpoint: Checkpoint,
      owner = "a".repeat(64),
      scope = "b".repeat(64),
    ) => {
      resume = { checkpoint, ownerBindingSha256: owner, scopeSha256: scope };
    },
    signal: () => signal,
    onSave: (callback: typeof onSave) => {
      onSave = callback;
    },
    afterWait: (callback: typeof afterWait) => {
      afterWait = callback;
    },
  };
}

/**
 * 固定本番組立てを実Operations・Machineへ接続する。
 * @responsibility 同Artifact／Root／Session／Scopeの搬送を観測する。
 * @trace ERB-IT-014
 * @input continuation、fault: 正常と拒否条件、source: メモリ変異用本文。
 * @returns 技術結果・同fixture・組立て観測。
 * @precondition Source読取り後、import境界だけを局所差替えする。
 * @postcondition 実Source不変更、最下位以外の処理を実行する。
 * @effect 局所評価と模擬境界だけ。
 * @failure 対応しない引数や順序はassertion失敗として観測する。
 * @invariant 実Native・実Filesystemの成立は主張しない。
 * @boundary 固定本番組立てと既存下位境界。
 * @security Pathは固定試験値だけ。
 * @concurrency 同じ内部signalを実Runtimeが所有する。
 * @stimulus 本番の修復接続へ有限Artifact・Native・Owner境界を結合して実行する。
 * @observation 取得、factory生成、Directory観測とcheckpoint通知の計数。
 * @oracle 実compositionの到達列を独立期待へ一致させる。
 * @cleanup 同じ模擬Native Sessionをjoinし通知を解除する。
 */
async function productionComposition(
  continuation = false,
  fault = "none",
  source?: string,
) {
  const f = fixture(continuation);
  const events: string[] = [];
  const counts = {
    artifact: 0,
    acquire: 0,
    folder: 0,
    factory: 0,
    operations: 0,
  };
  const artifact = Object.freeze({
    relativePath: "fixed-native.exe",
    target: "windows-x64",
    protocolRevision: 6,
    rustToolchain: "fixed",
    byteLength: 42,
    sha256: "c".repeat(64),
  });
  const local = "C:\\Users\\fixture\\AppData\\Local";
  const body = stripTypeScriptTypes(
    source ??
      fs.readFileSync(
        new URL("../../src/docker-desktop/repair-session.ts", import.meta.url),
        "utf8",
      ),
  )
    .replace(/import[\s\S]*?from "[^"]+";/gu, "")
    .replaceAll("export function", "function")
    .replaceAll("export async function", "async function");
  const result = await f.execute(async (input, dependencies) => {
    const main = runInThisContext(
      `((describeDockerRuntimeArtifactTrustContract, types, decode, prepareDockerRuntimeRepairSessionCheckpoint, runDockerRuntimeRepairMachine, dockerDesktopDistributionRoot, observePlatformAccessArtifactCandidate, startDockerDesktopRepairHelper, observeWindowsLocalAppDataDirectory, createDockerDesktopRepairDirectoryAccess, createDockerDesktopRepairOperations) => { ${body}; return runDockerRuntimeRepairSession; })`,
    )(
      describeDockerRuntimeArtifactTrustContract,
      types,
      decode,
      prepareDockerRuntimeRepairSessionCheckpoint,
      runDockerRuntimeRepairMachine,
      dockerDesktopDistributionRoot,
      (root: unknown) => {
        counts.artifact++;
        events.push("artifact");
        assert.equal(root, dockerDesktopDistributionRoot);
        if (fault === "artifact_blocked")
          return { status: "blocked", artifact: null };
        return { status: "candidate", artifact };
      },
      async (observed: unknown) => {
        counts.acquire++;
        events.push("acquire");
        assert.equal(Object.isFrozen(observed), true);
        assert.deepEqual(observed, artifact);
        if (fault === "acquire_throw") throw new Error("acquire");
        return dependencies.acquire();
      },
      () => {
        counts.folder++;
        events.push("folder");
        if (fault === "folder_throw") throw new Error("folder");
        if (fault === "folder_null") return null;
        if (fault === "folder_cancel") f.controller.abort();
        if (fault === "folder_owner_lost") f.state.permission = false;
        return local;
      },
      (folder: unknown, nonce: unknown, owner: unknown, hash: unknown) => {
        counts.factory++;
        events.push("factory");
        assert.equal(folder, local);
        assert.equal(nonce, input.operationNonce);
        assert.equal(owner, "a".repeat(64));
        assert.equal(hash, artifact.sha256);
        if (fault === "factory_null") return null;
        if (fault === "factory_cancel") f.controller.abort();
        if (fault === "verify_failure") f.state.artifact = false;
        if (fault === "scope_failure") f.state.scope = false;
        if (fault === "verify_cancel" || fault === "verify_owner_lost") {
          const verify = f.session.verifyArtifacts;
          Object.defineProperty(f.session, "verifyArtifacts", {
            value: async () => {
              const observed = await verify();
              if (fault === "verify_cancel") f.controller.abort();
              else f.state.permission = false;
              return observed;
            },
          });
        }
        const verify = f.access.verify;
        Object.defineProperty(f.access, "verify", {
          value: () => {
            events.push("scope_verified");
            return verify();
          },
        });
        const verifyArtifact = f.session.verifyArtifacts;
        Object.defineProperty(f.session, "verifyArtifacts", {
          value: async () => {
            events.push("artifact_verified");
            return verifyArtifact();
          },
        });
        return f.access;
      },
      (
        session: Session,
        access: Parameters<typeof operations>[1],
        signal: AbortSignal,
        live: () => boolean,
      ) => {
        counts.operations++;
        events.push("operations");
        assert.equal(session, f.session);
        assert.equal(access, f.access);
        assert.notEqual(signal, input.signal);
        assert.equal(signal.aborted, false);
        assert.equal(live(), true);
        return f.connectOperations(session, access, signal, live);
      },
    ) as (value: unknown) => ReturnType<typeof run>;
    if (fault === "cancel_before_start") f.controller.abort();
    return main(
      fault === "invalid"
        ? { ...input, operationNonce: "invalid" }
        : fault === "fresh_invalid"
          ? { ...input, resume: {} }
          : input,
    );
  });
  return { result, f, events, counts };
}

/**
 * 本番組立ての肯定結果を既存の発行回数と照合する。
 * @responsibility 固定引数のすり替えを同じOracleで拒否する。
 * @trace ERB-IT-014
 * @input value: 実組立て結果、continuation: 限定継続の期待。
 * @returns N/A: assertion。
 * @precondition productionCompositionの同fixture。
 * @postcondition 同じ子を正常回収し全技術処置へ到達する。
 * @effect N/A: 観測値検査。
 * @failure 未接続・相関差は失敗。
 * @invariant 模擬組立てを実Docker成立へ拡張しない。
 * @boundary 本番組立てと回数Oracle。
 * @security 秘密値を扱わない。
 * @concurrency N/A: 終了後の値検査。
 * @stimulus 実compositionのcompletionを待機して保存列を照合する。
 * @observation recovered結果と取得・観測・通知の正確な回数。
 * @oracle 初回と継続の実接続が同じ本番処理を通り、余分なfactoryを生成しない。
 * @cleanup completion後の同Session終了を確認する。
 */
function assertProductionComposition(
  value: Awaited<ReturnType<typeof productionComposition>>,
  continuation: boolean,
) {
  assert.equal(
    value.result.machine?.status,
    "recovered",
    "production_composition_incomplete",
  );
  assert.deepEqual(value.counts, {
    artifact: 1,
    acquire: 1,
    folder: 1,
    factory: 1,
    operations: 1,
  });
  assert.deepEqual(value.events.slice(0, 7), [
    "artifact",
    "acquire",
    "folder",
    "factory",
    "artifact_verified",
    "scope_verified",
    "operations",
  ]);
  assert.equal(value.f.calls.terminate, continuation ? 2 : 1);
  assert.equal(value.f.calls.launch, continuation ? 2 : 1);
  assert.equal(value.f.calls.backend, 1);
  assert.deepEqual(
    value.f.calls.retain,
    continuation ? ["initial", "failed", "auxiliary"] : ["initial"],
  );
  assert.equal(value.f.calls.release, 1);
  assert.equal(value.f.calls.abort, 0);
  assert.equal(value.result.finalCheckpointConfirmed, false);
}

/**
 * 固定本番組立ての搬送・拒否・準備失効を反証する。
 * @responsibility 任意依存のseamだけで本番接続を成立扱いしない。
 * @trace ERB-IT-014
 * @precondition 同じ実Source本文を使いimport境界だけ差替える。
 * @stimulus 通常／継続、各取得・準備拒否、引数すり替え変異。
 * @observation 捕捉順・回数・同子join・通知／Effect0。
 * @oracle 正常だけ同Artifact同Scopeで全接続へ到達する。
 * @cleanup 同じRuntimeが模擬子を回収する。
 * @boundary 真正Writer／CLI・実Native一体確認は別Gate。
 */
test("修復本番組立て: 同Artifact・H・nonce・Scopeを実Adapterまで固定する", async () => {
  for (const continuation of [false, true])
    assertProductionComposition(
      await productionComposition(continuation),
      continuation,
    );
  for (const fault of [
    "invalid",
    "cancel_before_start",
    "fresh_invalid",
    "artifact_blocked",
    "acquire_throw",
    "folder_throw",
    "folder_null",
    "folder_cancel",
    "folder_owner_lost",
    "factory_null",
    "factory_cancel",
    "verify_failure",
    "scope_failure",
    "verify_cancel",
    "verify_owner_lost",
  ]) {
    const value = await productionComposition(false, fault);
    assert.equal(value.counts.operations, 0, fault);
    assert.equal(value.f.calls.prepared, 0, fault);
    assert.equal(value.f.calls.saved.length, 0, fault);
    assert.equal(value.f.calls.terminate, 0, fault);
    assert.equal(value.f.calls.backend, 0, fault);
    assert.equal(value.f.calls.launch, 0, fault);
    assert.deepEqual(value.f.calls.retain, [], fault);
    if (["invalid", "cancel_before_start", "fresh_invalid"].includes(fault))
      assert.deepEqual(
        value.counts,
        { artifact: 0, acquire: 0, folder: 0, factory: 0, operations: 0 },
        fault,
      );
    if (
      fault.startsWith("folder") ||
      fault.startsWith("factory") ||
      fault.startsWith("verify") ||
      fault === "scope_failure"
    ) {
      assert.equal(value.f.calls.abort, 1, fault);
      assert.equal(value.f.calls.release, 0, fault);
    }
  }
  const source = fs
    .readFileSync(
      new URL("../../src/docker-desktop/repair-session.ts", import.meta.url),
      "utf8",
    )
    .replaceAll("\r\n", "\n");
  const location = "        nonce,\n        owner,";
  assert.equal(source.split(location).length, 2);
  const mutant = source.replace(
    location,
    '        "f".repeat(64),\n        owner,',
  );
  await assert.rejects(
    async () =>
      assertProductionComposition(
        await productionComposition(false, "none", mutant),
        false,
      ),
    /production_composition_incomplete/u,
  );
  const check = '(await session.verifyArtifacts()) !== "verified" ||';
  assert.equal(source.split(check).length, 2);
  const skipped = source.replace(check, "false ||");
  const value = await productionComposition(false, "verify_failure", skipped);
  assert.throws(() => assert.equal(value.counts.operations, 0));
});

/**
 * 実Adapter経由の通常起動と失敗後継続を確認する。
 * @responsibility 未実装操作を全不要で通過させない。
 * @trace ERB-IT-014
 * @precondition 模擬最下位境界と実Adapter／Machine／Runtime。
 * @stimulus 初回readyとtimeout後の継続成功。
 * @observation 各操作の回数・順序・Identity・同子回収・listener。
 * @oracle 通常4Effect、継続8Effect、同じ子release1、全通知合法。
 * @cleanup 模擬子を同Runtimeで回収する。
 * @boundary 真正Writer・実Dockerは別Gate。
 */
test("修復実操作接続: 通常起動と初回失敗後継続を同子・同対象で搬送する", async () => {
  for (const continuation of [false, true]) {
    const f = fixture(continuation);
    const result = await f.execute();
    assert.equal(result.machine?.status, "recovered");
    assert.equal(result.checkpoint?.cleanup, "confirmed");
    assert.equal(f.calls.terminate, continuation ? 2 : 1);
    assert.equal(f.calls.backend, 1);
    assert.equal(f.calls.launch, continuation ? 2 : 1);
    assert.deepEqual(
      f.calls.retain,
      continuation ? ["initial", "failed", "auxiliary"] : ["initial"],
    );
    assert.equal(f.calls.wait, continuation ? 2 : 1);
    assert.equal(f.calls.release, 1);
    assert.equal(f.calls.abort, 0);
    assert.equal(
      result.machine?.checkpoint?.actions.stop_runtime.result,
      "not_required",
    );
    const signal = f.signal();
    assert.ok(signal);
    assert.equal(getEventListeners(signal, "abort").length, 0);
    if (continuation) {
      assert.ok(
        f.calls.events.indexOf("bound") <
          f.calls.events.lastIndexOf("terminate"),
      );
      assert.deepEqual(result.checkpoint?.directories.failed.expected, {
        dev: "1",
        ino: "2",
        birthtimeNs: "3",
      });
      assert.deepEqual(result.checkpoint?.directories.auxiliary.expected, {
        dev: "1",
        ino: "3",
        birthtimeNs: "3",
      });
    }
  }
});

/**
 * 不明前提と保存後失効を実Adapterで停止する。
 * @responsibility 意図保存成功を無条件の実処置許可にしない。
 * @trace ERB-IT-014
 * @precondition 実Adapterの前提とexecuteを差替えない。
 * @stimulus 各fresh条件の欠落、意図後失効、発行後取消。
 * @observation 最下位要求回数と保存した発行事実。
 * @oracle 不明後の新Effect0、既発行結果は保持する。
 * @cleanup 同子abortまたはreleaseを外側Runtimeが待つ。
 * @boundary 実OS故障の再現ではなく接続契約。
 */
test("修復実操作接続: 両lock・世代・cleanup不明と意図後失効で新Effectを止める", async () => {
  for (const mode of [
    "failed_lock",
    "auxiliary_lock",
    "same_generation",
    "wrong_retained",
  ] as const) {
    const f = fixture(true);
    if (mode === "failed_lock") f.state.lockFailure = "failed";
    if (mode === "auxiliary_lock") f.state.lockFailure = "auxiliary";
    if (mode === "same_generation") f.state.sameGeneration = true;
    if (mode === "wrong_retained") f.state.wrongRetained = true;
    const result = await f.execute();
    assert.equal(f.calls.launch, 1, mode);
    assert.equal(f.calls.terminate, 1, mode);
    assert.deepEqual(f.calls.retain, ["initial"], mode);
    assert.notEqual(result.machine?.status, "recovered", mode);
  }
  for (const mode of ["artifact", "scope", "permission", "cleanup"] as const) {
    const f = fixture();
    f.onSave((checkpoint) => {
      if (checkpoint.actions.terminate_runtime.intent === "saved") {
        if (mode === "artifact") f.state.artifact = false;
        if (mode === "scope") f.state.scope = false;
        if (mode === "permission") f.state.permission = false;
        if (mode === "cleanup") f.state.cleanupUnknown = true;
      }
    });
    const result = await f.execute();
    assert.equal(f.calls.terminate, 0);
    assert.equal(f.calls.backend, 0);
    assert.equal(f.calls.launch, 0);
    assert.deepEqual(f.calls.retain, []);
    assert.notEqual(result.machine?.status, "recovered");
    if (mode === "cleanup") {
      assert.equal(
        result.lifecycle?.observationCleanupFailure,
        "observation_cleanup_unknown",
      );
      assert.equal(result.checkpoint?.cleanup, "unknown");
    }
  }
  const f = fixture();
  f.state.cancelAfterTerminate = true;
  const result = await f.execute();
  assert.equal(f.calls.terminate, 1);
  assert.equal(f.calls.backend, 0);
  assert.equal(result.machine?.status, "cancelled");
  assert.deepEqual(result.checkpoint?.actions.terminate_runtime, {
    intent: "saved",
    request: "issued",
    result: "confirmed",
  });
  assert.equal(f.calls.abort, 1);
  assert.equal(f.calls.release, 0);
});

/**
 * 保存済みの部分継続を新Sessionから再開する。
 * @responsibility 完了済み処置の再発行と初回待機の繰返しを検出する。
 * @trace ERB-IT-014
 * @precondition 両世代の保存後、処置境界で旧Ownerの発行許可を失う。
 * @stimulus 世代保存と追加四処置の各確定後に同exact値で再入場する。
 * @observation 残りの物理Effect、待機段階、三Identity、同子回収。
 * @oracle 未完了の接尾処置だけを一度実行し、再起動確定済みなら待機だけ。
 * @cleanup 新旧Sessionを各Runtimeが回収する。
 * @boundary 上位Writerと実OSではなく、実Adapter／Machine／Runtimeの接続。
 */
test("修復実操作接続: 同exact部分継続は完了済み処置を再発行しない", async () => {
  const cuts = [
    "bound",
    "stop_failed_runtime",
    "retain_failed_runtime",
    "retain_auxiliary_runtime",
    "restart_runtime",
  ] as const;
  const suffixes = [
    ["terminate", "retain:failed", "retain:auxiliary", "launch"],
    ["retain:failed", "retain:auxiliary", "launch"],
    ["retain:auxiliary", "launch"],
    ["launch"],
    [],
  ];
  for (const [index, cut] of cuts.entries()) {
    const first = fixture(true);
    let interrupted = 0;
    first.onSave((checkpoint) => {
      const reached =
        cut === "bound"
          ? checkpoint.directories.failed.expected !== null &&
            checkpoint.actions.stop_failed_runtime.intent === "not_saved"
          : checkpoint.actions[cut].result === "confirmed";
      if (reached && interrupted === 0) {
        interrupted++;
        first.state.permission = false;
      }
    });
    const stopped = await first.execute();
    assert.equal(interrupted, 1, cut);
    assert.notEqual(stopped.machine?.status, "recovered", cut);
    assert.equal(stopped.checkpoint?.cleanup, "confirmed", cut);
    const checkpoint = decode(stopped.checkpoint);
    assert.ok(checkpoint, cut);
    const next = fixture(true);
    Object.assign(next.state, first.state, {
      permission: true,
      retained: { ...first.state.retained },
    });
    assert.notEqual(next.session, first.session);
    if (cut === "restart_runtime") {
      next.state.engine = "transient_unavailable";
      next.state.waitReadyAfterRestart = true;
    }
    next.setResume(checkpoint);
    const result = await next.execute();
    assert.equal(result.machine?.status, "recovered", cut);
    assert.equal(result.checkpoint?.cleanup, "confirmed", cut);
    assert.deepEqual(
      next.calls.events.filter((event) => event !== "bound"),
      suffixes[index],
      cut,
    );
    assert.deepEqual(
      next.calls.waitStages,
      ["after_continuation_restart"],
      cut,
    );
    assert.ok(
      next.calls.phases.every((phase) => phase === "current"),
      cut,
    );
    assert.equal(next.calls.backend, 0, cut);
    assert.equal(next.calls.release + next.calls.abort, 1, cut);
    for (const key of ["primary", "failed", "auxiliary"] as const)
      assert.deepEqual(
        result.checkpoint?.directories[key].expected,
        checkpoint.directories[key].expected,
        `${cut}:${key}`,
      );
    if (cut === "restart_runtime") {
      assert.deepEqual(next.calls.precondition, []);
      const hot = fixture(true);
      Object.assign(hot.state, first.state, {
        permission: true,
        retained: { ...first.state.retained },
      });
      hot.setResume(checkpoint);
      const hotResult = await hot.execute();
      assert.equal(hotResult.machine?.status, "recovered");
      assert.deepEqual(hot.calls.precondition, []);
      assert.deepEqual(hot.calls.waitStages, []);
      assert.deepEqual(hot.calls.events, []);
      assert.equal(hot.calls.release, 1);
    }
  }
});

/**
 * 起動待機の成功後にも現在実体を確認する。
 * @responsibility Engine単独のreadyから修復成功を推定しない。
 * @trace ERB-IT-014
 * @precondition 実Adapter／Machine／Runtimeの通常起動。
 * @stimulus ready返却直後にProcess・Directory・保持物・Scopeを失効させる。
 * @observation 最終状態と後続Effect、障害注入回数。
 * @oracle 起動済み事実を保持しつつready確定と追加Effectを拒否する。
 * @cleanup 同じSessionを一回回収する。
 * @boundary 待機結果と最終実体観測の間。
 */
test("修復実操作接続: ready待機後の実体喪失は成功へ確定しない", async () => {
  for (const mode of [
    "process_absent",
    "process_unknown",
    "source_absent",
    "source_alias",
    "retained_changed",
    "engine",
    "artifact",
    "scope",
    "permission",
    "cancel",
  ] as const) {
    const f = fixture();
    let injected = 0;
    f.afterWait(() => {
      injected++;
      if (mode === "process_absent") f.state.processes = "absent";
      if (mode === "process_unknown") f.state.processes = "unknown";
      if (mode === "source_absent") f.state.source = null;
      if (mode === "source_alias") f.state.source = f.state.retained.initial;
      if (mode === "retained_changed")
        f.state.retained.initial = { dev: "1", ino: "99", birthtimeNs: "3" };
      if (mode === "engine") f.state.engine = "known_unavailable";
      if (mode === "artifact") f.state.artifact = false;
      if (mode === "scope") f.state.scope = false;
      if (mode === "permission") f.state.permission = false;
      if (mode === "cancel") f.controller.abort();
    });
    const result = await f.execute();
    assert.equal(injected, 1, mode);
    assert.notEqual(result.machine?.status, "recovered", mode);
    assert.notEqual(result.checkpoint?.engine, "ready", mode);
    assert.equal(
      result.checkpoint?.actions.start_runtime.result,
      "confirmed",
      mode,
    );
    assert.equal(f.calls.launch, 1, mode);
    assert.equal(f.calls.terminate, 1, mode);
    assert.deepEqual(f.calls.retain, ["initial"], mode);
    assert.equal(f.calls.release + f.calls.abort, 1, mode);
  }
});

/**
 * 最終ready観測中の別世代への差替えを拒否する。
 * @responsibility 両観測が旧世代と異なるだけでは同一性を保証しない。
 * @trace ERB-IT-014
 * @precondition 起動待機成功後、二度のDirectory観測を通る。
 * @stimulus 一回目の観測後に別の新Identityへ変更する。
 * @observation 注入到達と最終修復状態。
 * @oracle 注入一回、ready保存なし、追加Effectなし。
 * @cleanup 同Sessionを一回回収する。
 * @boundary Directoryの初回取得と再照合。
 */
test("修復実操作接続: ready最終観測中の新世代差替えを拒否する", async () => {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/docker-desktop/repair-operations.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace("export function", "function");
  const guard = "JSON.stringify(again) !== JSON.stringify(sample.pair)";
  assert.equal(source.split(guard).length, 2);
  const mutant = runInThisContext(
    `(function(decode){${source.replace(guard, "false")}; return createDockerDesktopRepairOperations;})`,
  )(decode) as typeof operations;
  /**
   * 停止後に元Directory実体が変わった場合の拒否を確認する。
   * @responsibility 停止後に元Directory実体が変わった場合の拒否を確認する。
   * @trace ERB-IT-014
   * @precondition 同じfixtureと実operations生成関数。
   * @stimulus 一回だけ初期待機後のsource identityを差し替える。
   * @observation 再観測列、結果と新世代処置回数。
   * @oracle 実体差を検出してunsafeな二回目処置へ進まない。
   * @cleanup fixture内の観測代役を終了して破棄する。
   * @boundary 実operations接続の故障刺激。Host Directoryを変更しない。
   */
  const verify = async (createOperations: typeof operations) => {
    const f = fixture(false, createOperations);
    const observe = f.access.observe;
    let armed = false;
    let injected = 0;
    f.afterWait(() => {
      armed = true;
    });
    /**
     * 停止待機後の一観測だけへ別実体を注入する。
     * @responsibility 停止待機後の一観測だけへ別実体を注入する。
     * @trace ERB-IT-014
     * @precondition 元observeとswap未発行flag。
     * @stimulus 実観測を得てから選択点のinoを一回変更する。
     * @observation swap回数とsource identity。
     * @oracle 未変更の正常対照を保持し選択点の実体差だけを反証する。
     * @cleanup N/A: 観測値のメモリ差替えのみ。
     * @boundary Filesystem観測の代役で実Directoryを差し替えない。
     */
    const observeWithSwap: typeof observe = (purpose) => {
      const pair = observe(purpose);
      if (armed && purpose === "initial" && injected === 0) {
        injected++;
        f.state.source = { dev: "1", ino: "98", birthtimeNs: "3" };
      }
      return pair;
    };
    assert.equal(
      Reflect.defineProperty(f.access, "observe", { value: observeWithSwap }),
      true,
    );
    const result = await f.execute();
    assert.equal(injected, 1);
    assert.notEqual(
      result.machine?.status,
      "recovered",
      "new_generation_swap_accepted",
    );
    assert.notEqual(result.checkpoint?.engine, "ready");
    assert.equal(f.calls.launch, 1);
    assert.equal(f.calls.terminate, 1);
    assert.deepEqual(f.calls.retain, ["initial"]);
    assert.equal(f.calls.release + f.calls.abort, 1);
  };
  await verify(operations);
  await assert.rejects(() => verify(mutant), /new_generation_swap_accepted/u);
});

/**
 * Native結果分類と待機中停止を実接続で確認する。
 * @responsibility 不明を未発行成功・不要へ変換しない。
 * @trace ERB-IT-014
 * @precondition 実Adapter／Machine／Runtimeと模擬最下位境界。
 * @stimulus 全Native失敗分類、待機中取消と観測回収不明。
 * @observation issued・result、後続Effect、購読残存。
 * @oracle 元分類を保持し後続発行0、待機購読0。
 * @cleanup 同じ子の回収を確認する。
 * @boundary 実Native protocolの分類自体は既存契約試験。
 */
test("修復実操作接続: Native不明と待機中停止を未発行成功へ丸めない", async () => {
  for (const termination of [
    "absent",
    "not_issued_unknown",
    "partial_or_unknown",
    "unknown",
  ] as const) {
    const f = fixture();
    f.state.termination = termination;
    const result = await f.execute();
    const slot = result.checkpoint?.actions.terminate_runtime;
    assert.equal(f.calls.terminate, 1);
    assert.equal(f.calls.backend, 0);
    assert.equal(
      slot?.request,
      termination === "absent"
        ? "not_issued"
        : termination === "partial_or_unknown"
          ? "issued"
          : "unknown",
    );
    assert.equal(
      slot?.result,
      termination === "absent" ? "unobserved" : "unknown",
    );
    assert.notEqual(result.machine?.status, "recovered");
  }
  for (const launching of [
    "not_started",
    "partial_or_unknown",
    "unknown",
  ] as const) {
    const f = fixture();
    f.state.launching = launching;
    const result = await f.execute();
    const slot = result.checkpoint?.actions.start_runtime;
    assert.equal(f.calls.launch, 1);
    assert.equal(f.calls.wait, 0);
    assert.equal(
      slot?.request,
      launching === "not_started"
        ? "not_issued"
        : launching === "partial_or_unknown"
          ? "issued"
          : "unknown",
    );
    assert.equal(
      slot?.result,
      launching === "not_started" ? "unobserved" : "unknown",
    );
  }
  for (const mode of ["cancel", "cleanup"] as const) {
    const f = fixture(true);
    if (mode === "cancel") f.state.cancelDuringWait = true;
    else f.state.cleanupDuringWait = true;
    const result = await f.execute();
    assert.equal(f.calls.wait, 1);
    assert.equal(f.calls.launch, 1);
    assert.equal(f.calls.terminate, 1);
    assert.deepEqual(f.calls.retain, ["initial"]);
    assert.equal(result.checkpoint?.actions.start_runtime.result, "confirmed");
    const signal = f.signal();
    assert.ok(signal);
    assert.equal(getEventListeners(signal, "abort").length, 0);
    if (mode === "cleanup") {
      assert.equal(
        result.lifecycle?.observationCleanupFailure,
        "observation_cleanup_unknown",
      );
      assert.equal(result.checkpoint?.cleanup, "unknown");
      assert.equal(f.calls.abort, 1);
    } else assert.equal(result.machine?.status, "cancelled");
  }
});

/**
 * 確定した停止応答と現在の静止観測を分離する。
 * @responsibility 停止成功だけで追加退避へ進む変異を検出する。
 * @trace ERB-IT-014
 * @input createOperations: 実Adapterまたはメモリ変異、drift: 停止後の反例軸。
 * @returns N/A: assertion。
 * @precondition 実Runtime／Machine、最下位停止応答confirmed。
 * @postcondition 停止事実を保持し、両追加退避と再起動を発行しない。
 * @effect 模擬境界のみ。
 * @failure 注入未到達・回数・保存結果差は失敗。
 * @invariant 新観測の不成立で過去停止をunknownへ戻さない。
 * @boundary Native応答と退避前のfresh観測。
 * @security 実Docker要求0。
 * @concurrency 二回目の停止の直後だけ一回注入する。
 * @stimulus 停止確認後にEngineまたはProcess状態だけを差し替える。
 * @observation terminate/launch回数と保持された初期Directory。
 * @oracle 再起動後の旧停止観測を再利用せず、意図保存で停止する。
 * @cleanup 模擬Sessionを終了し実Desktopは変更しない。
 */
async function assertStoppedDriftRejected(
  createOperations: typeof operations,
  drift: "engine" | "process",
) {
  const f = fixture(true, createOperations);
  f.state.stoppedDrift = drift;
  const result = await f.execute();
  assert.equal(f.calls.driftInjected, 1, "stopped_drift_not_reached");
  assert.equal(f.calls.terminate, 2);
  assert.equal(f.calls.launch, 1);
  assert.deepEqual(
    f.calls.retain,
    ["initial"],
    "stopped_drift_retention_issued",
  );
  assert.equal(result.machine?.status, "incomplete");
  assert.deepEqual(result.checkpoint?.actions.stop_failed_runtime, {
    intent: "saved",
    request: "issued",
    result: "confirmed",
  });
  const confirmedAt = f.calls.saved.findIndex(
    (checkpoint) =>
      checkpoint.actions.stop_failed_runtime.result === "confirmed",
  );
  assert.ok(confirmedAt >= 0);
  assert.ok(
    f.calls.saved
      .slice(confirmedAt)
      .every(
        (checkpoint) =>
          checkpoint.actions.stop_failed_runtime.result === "confirmed",
      ),
  );
  assert.equal(
    result.checkpoint?.actions.retain_failed_runtime.intent,
    "not_saved",
  );
  assert.equal(
    result.checkpoint?.actions.retain_auxiliary_runtime.intent,
    "not_saved",
  );
  assert.equal(result.checkpoint?.actions.restart_runtime.intent, "not_saved");
}

/**
 * 継続停止後のEngine・Process静止条件を独立に反証する。
 * @responsibility confirmed応答と現在の退避可能状態を混同しない。
 * @trace ERB-IT-014
 * @precondition 実Adapterとガード除去メモリ変異を同じOracleへ渡す。
 * @stimulus Engine transient／Process absent、Engine known／Process verified。
 * @observation 注入一回、追加退避0、停止確定値の保持。
 * @oracle 実処理は拒否し、ガード除去変異は同Oracleで失敗する。
 * @cleanup 実Sourceを変更しない。
 * @boundary 退避前の二軸fresh条件。
 */
test("修復実操作接続: 停止confirmedでもEngine未静止・Process残存なら退避しない", async () => {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/docker-desktop/repair-operations.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace("export function", "function");
  const guard = 'state !== "known_unavailable" || processes !== "absent"';
  assert.equal(source.split(guard).length, 2);
  const mutant = runInThisContext(
    `(function(decode){${source.replace(guard, "false")}; return createDockerDesktopRepairOperations;})`,
  )(decode) as typeof operations;
  for (const drift of ["engine", "process"] as const) {
    await assertStoppedDriftRejected(operations, drift);
    await assert.rejects(
      () => assertStoppedDriftRejected(mutant, drift),
      /stopped_drift_retention_issued/u,
    );
  }
});

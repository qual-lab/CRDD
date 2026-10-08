/**
 * caller記録の実Filesystemと同一Process排他を検証する。
 *
 * @packageDocumentation
 * @responsibility 独立bytes、同参照衝突、容量停止とProcess喪失後の再取得を観測する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @level IT
 * @scope 自己生成Repository内caller記録とWindows named pipe。Native公開・実残存は対象外。
 * @boundary Repository内caller保存、子Node ProcessとWindows IPC。
 */
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { compileFunction, runInNewContext } from "node:vm";
import { ensureRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";
import { resolveRepositoryRuntimeDataPaths } from "../../../domain-model/src/index.ts";
import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  type HostTerminalCheckpointPreparation,
  prepareHostTerminalRecoveryCheckpoint,
  prepareKnownFileHostTerminalRecoveryCheckpoint,
  publishHostTerminalRecoveryCheckpoint,
  publishKnownFileHostTerminalRecoveryCheckpoint,
  readHostTerminalCallerCheckpoint,
  readHostTerminalRecoveryCheckpoint,
  readKnownFileHostTerminalCallerCheckpoint,
  readKnownFileHostTerminalRecoveryCheckpoint,
  saveHostTerminalCallerCheckpoint,
  saveKnownFileHostTerminalCallerCheckpoint,
} from "../../src/host-execution/terminal-caller-checkpoint.ts";
import { acquireHostTerminalCallerLease } from "../../src/host-execution/terminal-caller-lease.ts";
import {
  type EncodedKnownFixtureHostTerminalIntent,
  encodeHostTerminalIntent,
  encodeKnownFixtureHostTerminalIntent,
  resolveHostTerminalLegacyGeneration,
} from "../../src/host-execution/terminal-record.ts";
import {
  createHostTerminalReadRequest,
  createHostTerminalSaveRequest,
} from "../../src/host-execution/terminal-windows-adapter.ts";
import { snapshotPlainRecord } from "../../../domain-model/src/index.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");

/**
 * Native接続前後のcaller reader終了不明を同参照へ保持する。
 *
 * @responsibility 本番bridgeを実caller readerへ接続し、具体的な終了理由と部分結果の消失を反証する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 自己生成Repositoryにcaller記録を保存する。Native移送だけをVM内で代替する。
 * @stimulus 保存／読戻しそれぞれで最初・二度目のreader close後にthrow、または正常終了を与える。
 * @observation 同参照、固定理由、Native呼出し数、保持した部分結果とEffect。
 * @oracle 終了不明は具体理由のblocked。前段ではNative 0、後段では部分結果と既発行Effectを保持する。
 * @cleanup 実descriptorを閉じてから合成throwする。差替えを復元し、自己生成Rootだけを清掃する。
 * @boundary Native実保存、旧Host Root、Process操作とAuthorityは試験対象外。
 */
test("Host Windows: caller接続は前後のreader終了未確認理由を保持する", async (context) => {
  const source = fs.readFileSync(
    new URL(
      "../../src/host-execution/terminal-caller-checkpoint.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const start = source.indexOf(
    "function connectHostTerminalRecoveryCheckpoint(",
  );
  const end = source.indexOf("\n/**", start);
  assert.ok(start >= 0 && end > start);
  assert.equal(
    source.indexOf(
      "function connectHostTerminalRecoveryCheckpoint(",
      start + 1,
    ),
    -1,
  );
  const functionSource = stripTypeScriptTypes(source.slice(start, end));
  for (const mode of ["save", "read"] as const) {
    for (const phase of ["before", "after", "normal"] as const) {
      const fixture = createFixture();
      const base = intentFixture();
      const nonce = randomUUID();
      const encoded = encodeHostTerminalIntent({
        ...base.intent,
        target: {
          ...base.intent.target,
          root: {
            ...base.intent.target.root,
            name: `crdd-coordinator-doctor-${nonce}`,
          },
          marker: {
            ...base.intent.target.marker,
            name: `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
          },
        },
      });
      const initial = await saveHostTerminalCallerCheckpoint(
        fixture.capability,
        encoded.intent,
        encoded.intent.bindings,
        new AbortController().signal,
      );
      assert.equal(initial.status, "saved");
      const paths = resolveRepositoryRuntimeDataPaths(fixture.capability);
      assert.ok(paths);
      const canonical = path.join(
        paths.coordinator,
        "recovery",
        "host-terminal",
        `${encoded.intent.reference}.json`,
      );
      const originalOpen = fs.openSync;
      const originalClose = fs.closeSync;
      const readerDescriptors = new Set<number>();
      let closeCalls = 0;
      let nativeCalls = 0;
      const nativeResult = Object.freeze({
        status: mode === "save" ? "saved" : "observed",
        reference: encoded.intent.reference,
        processEffectIssued: true,
        recordEffectIssued: mode === "save",
        helperExitConfirmed: true,
        receipt: Object.freeze([1]),
      });
      try {
        context.mock.method(
          fs,
          "openSync",
          (...args: Parameters<typeof fs.openSync>) => {
            const fd = originalOpen(...args);
            if (args[0] === canonical && args[1] === "r")
              readerDescriptors.add(fd);
            return fd;
          },
        );
        context.mock.method(fs, "closeSync", (fd: number) => {
          originalClose(fd);
          if (!readerDescriptors.delete(fd)) return;
          closeCalls += 1;
          if (
            (phase === "before" && closeCalls === 1) ||
            (phase === "after" && closeCalls === 2)
          )
            throw new Error("injected_close_unconfirmed");
        });
        const bridge = runInNewContext(`(${functionSource})`, {
          Error,
          REFERENCE: /^host-terminal\.[a-f0-9-]{36}$/u,
          snapshotPlainRecord: (value: unknown) => value,
          readHostTerminalCallerCheckpoint,
          createHostTerminalSaveRequest,
          createHostTerminalReadRequest,
          saveHostTerminalWindowsRecord: () => {
            nativeCalls += 1;
            return nativeResult;
          },
          readHostTerminalWindowsRecord: () => {
            nativeCalls += 1;
            return nativeResult;
          },
        }) as (...args: unknown[]) => {
          status: string;
          reason: string;
          reference: string | null;
          callerVerifiedBeforeAndAfter: boolean;
          recordEffectIssued: boolean | null;
          processEffectIssued: boolean | null;
          nativeSave: unknown;
          nativeRead: unknown;
        };
        const result = bridge(
          fixture.capability,
          encoded.intent.reference,
          encoded.intent.bindings,
          mode,
          "synthetic-evaluation",
          new AbortController().signal,
        );
        assert.equal(result.reference, encoded.intent.reference);
        assert.equal(
          result.status,
          phase === "normal" ? "completed" : "blocked",
        );
        assert.equal(result.callerVerifiedBeforeAndAfter, phase === "normal");
        assert.equal(closeCalls, phase === "before" ? 1 : 2);
        assert.equal(nativeCalls, phase === "before" ? 0 : 1);
        assert.equal(result.processEffectIssued, phase !== "before");
        assert.equal(
          result.recordEffectIssued,
          mode === "save" && phase !== "before",
        );
        assert.equal(
          mode === "save" ? result.nativeSave : result.nativeRead,
          phase === "before" ? null : nativeResult,
        );
        if (phase !== "normal")
          assert.equal(
            result.reason,
            "host_terminal_caller_reader_close_unconfirmed",
          );
      } finally {
        context.mock.restoreAll();
      }
      const observed = readHostTerminalCallerCheckpoint(
        fixture.capability,
        encoded.intent.reference,
        encoded.intent.bindings,
      );
      assert.equal(observed.serialized, encoded.serialized);
      cleanupFixture(fixture);
    }
  }
});

/**
 * caller readerの故障枝を同じ保存本体で反証する。
 *
 * @responsibility close未確認の搬送と存在後ENOENTの新規保存禁止を確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition 自己生成Repositoryだけを使い、依存差替えは各保存Promise終端まで保持する。
 * @stimulus 既存／新規reader close、readとclose共同失敗、存在後open／stat消失を模す。
 * @observation 同参照、終了確認、Effect、stage作成要求数、元bytesとdescriptor close回数。
 * @oracle close未確認はblocked／false、存在後消失は追加記録Effect 0。正常closeだけsaved。
 * @cleanup 実descriptorは一回閉じてから合成throw。finallyで差替えを復元し、成功後だけfixture清掃。
 * @boundary 実OS close故障ではなく、実Filesystem上の試験限定障害注入である。
 */
test("Host Windows: caller reader故障は同参照と終端未確認を失わない", async (context) => {
  for (const mode of [
    "existing_close",
    "published_close",
    "read_and_close",
    "open_missing",
    "stat_missing",
    "normal_close",
    "standalone_close",
  ] as const) {
    const fixture = createFixture();
    const encoded = intentFixture();
    const signal = new AbortController().signal;
    if (mode !== "published_close") {
      const initial = await saveHostTerminalCallerCheckpoint(
        fixture.capability,
        encoded.intent,
        encoded.intent.bindings,
        signal,
      );
      assert.equal(initial.status, "saved");
    }
    const paths = resolveRepositoryRuntimeDataPaths(fixture.capability);
    assert.ok(paths);
    const directory = path.join(paths.coordinator, "recovery", "host-terminal");
    const canonical = path.join(directory, `${encoded.intent.reference}.json`);
    const stage = path.join(directory, `${encoded.intent.reference}.stage`);
    const originalOpen = fs.openSync;
    const originalClose = fs.closeSync;
    const originalRead = fs.readSync;
    const originalStat = fs.lstatSync;
    let readerFd: number | null = null;
    let readerCloseCalls = 0;
    let stageOpenCalls = 0;
    let canonicalStatCalls = 0;
    try {
      context.mock.method(
        fs,
        "openSync",
        (...args: Parameters<typeof fs.openSync>) => {
          if (args[0] === stage) stageOpenCalls += 1;
          if (
            args[0] === canonical &&
            args[1] === "r" &&
            mode === "open_missing"
          )
            throw Object.assign(new Error("injected_open_missing"), {
              code: "ENOENT",
            });
          const fd = originalOpen(...args);
          if (args[0] === canonical && args[1] === "r") readerFd = fd;
          return fd;
        },
      );
      context.mock.method(fs, "closeSync", (fd: number) => {
        originalClose(fd);
        if (fd !== readerFd) return;
        readerCloseCalls += 1;
        if (mode.endsWith("close") && mode !== "normal_close")
          throw new Error("injected_close_unconfirmed");
      });
      context.mock.method(
        fs,
        "readSync",
        (...args: Parameters<typeof fs.readSync>) => {
          if (args[0] === readerFd && mode === "read_and_close")
            throw new Error("injected_read_failure");
          return Reflect.apply(originalRead, fs, args);
        },
      );
      context.mock.method(
        fs,
        "lstatSync",
        (...args: Parameters<typeof fs.lstatSync>) => {
          if (args[0] === canonical) {
            canonicalStatCalls += 1;
            if (mode === "stat_missing" && canonicalStatCalls === 2)
              throw Object.assign(new Error("injected_stat_missing"), {
                code: "ENOENT",
              });
          }
          return Reflect.apply(originalStat, fs, args);
        },
      );
      if (mode === "standalone_close") {
        assert.throws(
          () =>
            readHostTerminalCallerCheckpoint(
              fixture.capability,
              encoded.intent.reference,
              encoded.intent.bindings,
            ),
          /host_terminal_caller_reader_close_unconfirmed/u,
        );
      } else {
        const result = await saveHostTerminalCallerCheckpoint(
          fixture.capability,
          encoded.intent,
          encoded.intent.bindings,
          signal,
        );
        assert.equal(result.reference, encoded.intent.reference, mode);
        assert.equal(result.leaseCloseConfirmed, true, mode);
        if (mode === "normal_close") {
          assert.equal(result.status, "saved");
          assert.equal(result.handlesCloseConfirmed, true);
        } else if (mode === "open_missing" || mode === "stat_missing") {
          assert.equal(result.status, "blocked", mode);
          assert.equal(result.recordEffectIssued, false, mode);
          assert.equal(result.handlesCloseConfirmed, true, mode);
          assert.equal(stageOpenCalls, 0, mode);
        } else {
          assert.equal(result.status, "blocked", mode);
          assert.equal(
            result.reason,
            "host_terminal_caller_reader_close_unconfirmed",
            mode,
          );
          assert.equal(result.handlesCloseConfirmed, false, mode);
          assert.equal(
            result.recordEffectIssued,
            mode === "published_close",
            mode,
          );
        }
      }
      assert.equal(
        readerCloseCalls,
        mode === "open_missing" || mode === "stat_missing" ? 0 : 1,
        mode,
      );
    } finally {
      context.mock.restoreAll();
    }
    assert.equal(fs.readFileSync(canonical, "utf8"), encoded.serialized, mode);
    assert.throws(() => fs.lstatSync(stage), { code: "ENOENT" });
    cleanupFixture(fixture);
  }
});

/**
 * 現在Repository内に使い捨ての独立Git Rootを準備する。
 *
 * @responsibility 試験書込み先を明示したRepository-local tests領域へ限定する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition 現在Repository Rootが検証できる。
 * @stimulus 新UUID Directoryへgit initとIgnore宣言を作る。
 * @observation 検証済みfixture capabilityとRoot世代。
 * @oracle 外側Repositoryのtests領域内でRootが一意に検証できる。
 * @cleanup 成功時だけcleanupFixtureで自己生成Rootを確認して削除する。失敗時は保持。
 * @boundary OS一時Rootと実Host残存へ書き込まない。
 */
function createFixture() {
  const outer = verifyRepositoryRoot(repositoryRoot);
  assert.equal(outer.status, "completed");
  if (outer.status !== "completed") throw new Error("test_root_unverified");
  const area = ensureRepositoryRuntimeDataArea(outer.capability, "tests");
  assert.equal(area?.status, "ready");
  if (area?.status !== "ready") throw new Error("test_area_unready");
  const root = path.join(area.directory, `host-caller-${randomUUID()}`);
  fs.mkdirSync(root);
  const initialized = spawnSync(
    "git",
    ["-c", "init.defaultBranch=main", "init", "--quiet", root],
    { cwd: repositoryRoot, encoding: "utf8", timeout: 5_000, maxBuffer: 4_096 },
  );
  assert.equal(initialized.status, 0);
  fs.writeFileSync(path.join(root, ".gitignore"), ".crdd/\n", { flag: "wx" });
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed")
    throw new Error("fixture_root_unverified");
  return {
    root,
    capability: verified.capability,
    identity: fs.lstatSync(root, { bigint: true }),
    parent: area.directory,
  };
}

/**
 * 成功した自己生成fixtureだけを限定清掃する。
 *
 * @responsibility 検証したRoot世代と用途限定親の包含を削除直前に再確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition 全Oracleが成立したcreateFixtureの戻り値。
 * @stimulus exact Rootの再確認後にそのRootだけを再帰削除する。
 * @observation Rootの直接ENOENT。
 * @oracle 親・兄弟・既存記録を対象にせず、自己生成Rootが不存在。
 * @cleanup 本関数が自己生成fixtureの清掃Ownerである。
 * @boundary 現在Repositoryのtests領域だけ。
 */
function cleanupFixture(fixture: ReturnType<typeof createFixture>) {
  const resolved = fs.realpathSync(fixture.root);
  const parent = fs.realpathSync(fixture.parent);
  const current = fs.lstatSync(fixture.root, { bigint: true });
  assert.equal(path.dirname(resolved), parent);
  assert.equal(resolved, fixture.root);
  assert.equal(current.isDirectory() && !current.isSymbolicLink(), true);
  assert.equal(current.dev, fixture.identity.dev);
  assert.equal(current.ino, fixture.identity.ino);
  assert.equal(current.birthtimeNs, fixture.identity.birthtimeNs);
  fs.rmSync(resolved, { recursive: true });
  assert.throws(() => fs.lstatSync(resolved), { code: "ENOENT" });
}

/**
 * 実観測ではない完全intent fixtureを作る。
 *
 * @responsibility caller保存の形状と期待結合を独立した固定値で準備する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition N/A: 実Host資源を入力にしない。
 * @stimulus UUIDと十一の区別可能な整数Identityを作る。
 * @observation codecで正規化したintent。
 * @oracle 固定形状に一致するが、実由来・非使用・Authorityは主張しない。
 * @cleanup N/A: memoryだけ。
 * @boundary Native・実Host snapshotへ接続しない。
 */
function intentFixture() {
  const identities = Array.from({ length: 11 }, (_entry, index) => ({
    volumeSerial: 1,
    fileIndexHigh: 0,
    fileIndexLow: index + 1,
    creationTimeHigh: 1,
    creationTimeLow: 2,
    attributes: index === 4 ? 0x80 : 0x10,
  }));
  return encodeHostTerminalIntent({
    contract: "crdd-coordinator/host-terminal-intent",
    contractRevision: 2,
    reference: `host-terminal.${randomUUID()}`,
    producer: {
      kind: "human_orphan_cleanup",
      selectionSnapshotSha256: "a".repeat(64),
      originalReferenceUnknownReason: "original_reference_unconfirmed",
    },
    bindings: {
      runtimeSha256: "b".repeat(64),
      repositorySha256: "c".repeat(64),
      selectedUserSha256: "d".repeat(64),
    },
    target: {
      parentIdentity: identities[0],
      recoveryDirectoryIdentity: identities[1],
      terminalDirectoryIdentity: identities[2],
      root: {
        name: "crdd-coordinator-doctor-caller-fixture",
        identity: identities[3],
      },
      marker: {
        name: `host-${"e".repeat(64)}.json`,
        identity: identities[4],
        sha256: "f".repeat(64),
      },
      children: Object.fromEntries(
        [
          "workspace",
          "provider-home",
          "tmp",
          "events",
          "projection",
          "management",
        ].map((name, index) => [name, identities[index + 5]]),
      ),
    },
    cleanupOrder: ["root_absence", "marker_absence", "lease_terminal"],
  });
}

/**
 * 十二実体のcaller保存・読戻しを自己生成Repositoryで確認する。
 *
 * @responsibility 完全file情報、同参照衝突、クラス差、取消と非置換を実記録へ接続する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition Repository-localの新UUID fixtureと独立合成十二実体。
 * @stimulus 実保存・fresh読戻し・一致再入場、準備bodyからの同参照保存、別内容、旧形式と取消を与える。
 * @observation 同参照、正規bytes、全file条件、Effect、lease終了とstage不存在。
 * @oracle 正常・一致だけsaved。差異や混用で既存bytesを変更せず終了する。
 * @cleanup 全assert成立後に世代・包含を確認した自己生成Rootだけを削除し不存在確認する。
 * @boundary 実caller Filesystem／IPCのみ。Native正常保存、旧Host残存、Providerは対象外。
 */
test("Host Windows: 既知file callerは十二実体を保持し旧形式と混用しない", async () => {
  const fixture = createFixture();
  const base = intentFixture().intent;
  const nonce = randomUUID();
  const encoded = encodeKnownFixtureHostTerminalIntent({
    ...base,
    contractRevision: 3,
    resourceClass: "known_fixture_host_only_v1",
    target: {
      ...base.target,
      root: { ...base.target.root, name: `crdd-coordinator-doctor-${nonce}` },
      marker: {
        ...base.target.marker,
        name: `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
      },
      knownFile: {
        parent: "workspace",
        name: "fixture.txt",
        identity: {
          volumeSerial: 1,
          fileIndexHigh: 0,
          fileIndexLow: 12,
          creationTimeHigh: 1,
          creationTimeLow: 2,
          attributes: 0x80,
        },
        byteLength: 7,
        linkCount: 1,
        sha256:
          "be9351741a8155d01fd028d158546f1005e73ceeb0bb2d093335feac4144e450",
      },
    },
    cleanupOrder: [
      "file_absence",
      "root_absence",
      "marker_absence",
      "lease_terminal",
    ],
  });
  const signal = new AbortController().signal;
  const saved = await saveKnownFileHostTerminalCallerCheckpoint(
    fixture.capability,
    encoded.intent,
    encoded.intent.bindings,
    signal,
  );
  assert.equal(saved.status, "saved");
  assert.equal(saved.reference, encoded.intent.reference);
  assert.equal(saved.recordEffectIssued, true);
  assert.equal(saved.handlesCloseConfirmed, true);
  assert.equal(saved.leaseCloseConfirmed, true);
  const observed = readKnownFileHostTerminalCallerCheckpoint(
    fixture.capability,
    encoded.intent.reference,
    encoded.intent.bindings,
  );
  assert.deepEqual(observed, encoded);
  assert.equal(observed.intent.target.knownFile.identity.fileIndexLow, 12);
  const paths = resolveRepositoryRuntimeDataPaths(fixture.capability);
  assert.ok(paths);
  const directory = path.join(paths.coordinator, "recovery", "host-terminal");
  const canonical = path.join(directory, `${encoded.intent.reference}.json`);
  const bytes = fs.readFileSync(canonical);
  const source = fs.readFileSync(
    new URL(
      "../../src/host-execution/terminal-caller-checkpoint.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const start = source.indexOf(
    "async function prepareTerminalRecoveryCheckpoint<",
  );
  const end = source.indexOf("\n/**", start);
  assert.ok(start >= 0 && end > start);
  const prepare = compileFunction(
    `return (${stripTypeScriptTypes(source.slice(start, end))});`,
    [
      "snapshotPlainRecord",
      "REFERENCE",
      "resolveHostTerminalLegacyGeneration",
      "resolveRepositoryRuntimeDataPaths",
      "createHash",
    ],
  )(
    snapshotPlainRecord,
    /^host-terminal\.[a-f0-9-]{36}$/u,
    resolveHostTerminalLegacyGeneration,
    resolveRepositoryRuntimeDataPaths,
    createHash,
  ) as (
    ...args: unknown[]
  ) => Promise<
    HostTerminalCheckpointPreparation<EncodedKnownFixtureHostTerminalIntent>
  >;
  const preparedReference = `host-terminal.${randomUUID()}`;
  const target = encoded.intent.target;
  const snapshot = {
    identities: [
      target.parentIdentity,
      target.recoveryDirectoryIdentity,
      target.terminalDirectoryIdentity,
      target.root.identity,
      target.marker.identity,
      target.children.workspace,
      target.children["provider-home"],
      target.children.tmp,
      target.children.events,
      target.children.projection,
      target.children.management,
      target.knownFile.identity,
    ],
    markerSha256: target.marker.sha256,
    selectedUserSha256: encoded.intent.bindings.selectedUserSha256,
    knownFile: {
      byteLength: target.knownFile.byteLength,
      linkCount: target.knownFile.linkCount,
      sha256: target.knownFile.sha256,
    },
  };
  for (const isRepeated of [false, true]) {
    const prepared = await prepare(
      fixture.capability,
      {
        reference: preparedReference,
        rootName: target.root.name,
        markerName: target.marker.name,
        bindings: encoded.intent.bindings,
      },
      0,
      signal,
      {},
      () => ({ nonceHex: "01".repeat(32) }),
      () => ({
        status: "observed",
        reason: "fixture_observation",
        knownObservation: { snapshot },
        processEffectIssued: false,
        helperExitConfirmed: true,
      }),
      encodeKnownFixtureHostTerminalIntent,
      saveKnownFileHostTerminalCallerCheckpoint,
      true,
    );
    assert.equal(prepared.status, "prepared");
    assert.ok(prepared.intent && prepared.checkpoint);
    assert.equal(prepared.reference, preparedReference);
    assert.equal(prepared.checkpoint.recordEffectIssued, !isRepeated);
    assert.equal(prepared.checkpoint.leaseCloseConfirmed, true);
    assert.deepEqual(
      readKnownFileHostTerminalCallerCheckpoint(
        fixture.capability,
        preparedReference,
        encoded.intent.bindings,
      ),
      prepared.intent,
    );
    assert.equal(
      prepared.intent.intent.target.knownFile.identity.fileIndexLow,
      12,
    );
    assert.throws(
      () => fs.lstatSync(path.join(directory, `${preparedReference}.stage`)),
      { code: "ENOENT" },
    );
  }
  const repeated = await saveKnownFileHostTerminalCallerCheckpoint(
    fixture.capability,
    observed.intent,
    encoded.intent.bindings,
    signal,
  );
  assert.equal(repeated.status, "saved");
  assert.equal(repeated.recordEffectIssued, false);
  assert.equal(repeated.leaseCloseConfirmed, true);
  const conflict = await saveKnownFileHostTerminalCallerCheckpoint(
    fixture.capability,
    {
      ...encoded.intent,
      target: {
        ...encoded.intent.target,
        knownFile: {
          ...encoded.intent.target.knownFile,
          identity: {
            ...encoded.intent.target.knownFile.identity,
            fileIndexLow: 13,
          },
        },
      },
    },
    encoded.intent.bindings,
    signal,
  );
  assert.equal(conflict.status, "blocked");
  assert.equal(conflict.reason, "host_terminal_caller_conflict");
  assert.equal(conflict.recordEffectIssued, false);
  assert.equal(conflict.leaseCloseConfirmed, true);
  assert.throws(() =>
    readHostTerminalCallerCheckpoint(
      fixture.capability,
      encoded.intent.reference,
      encoded.intent.bindings,
    ),
  );
  const oldCollision = await saveHostTerminalCallerCheckpoint(
    fixture.capability,
    { ...base, reference: encoded.intent.reference },
    encoded.intent.bindings,
    signal,
  );
  assert.equal(oldCollision.status, "blocked");
  assert.equal(oldCollision.recordEffectIssued, false);
  assert.equal(oldCollision.leaseCloseConfirmed, true);
  for (const connect of [
    publishKnownFileHostTerminalRecoveryCheckpoint,
    readKnownFileHostTerminalRecoveryCheckpoint,
  ]) {
    const result = connect(
      fixture.capability,
      encoded.intent.reference,
      encoded.intent.bindings,
      new Date().toISOString(),
      signal,
      {},
    );
    assert.equal(result.status, "blocked");
    assert.equal(result.reason, "host_terminal_development_context_invalid");
    assert.equal(result.reference, encoded.intent.reference);
    assert.equal(result.callerVerifiedBeforeAndAfter, true);
    assert.equal(result.processEffectIssued, false);
    assert.equal(result.recordEffectIssued, false);
    assert.equal(result.cleanupAuthorized, false);
  }
  const cancelled = new AbortController();
  cancelled.abort();
  const cancelledSave = await saveKnownFileHostTerminalCallerCheckpoint(
    fixture.capability,
    encoded.intent,
    encoded.intent.bindings,
    cancelled.signal,
  );
  assert.equal(cancelledSave.status, "blocked");
  assert.equal(cancelledSave.reference, encoded.intent.reference);
  assert.equal(cancelledSave.administrativeEffectIssued, false);
  assert.equal(cancelledSave.recordEffectIssued, false);
  assert.equal(cancelledSave.leaseCloseConfirmed, true);
  assert.deepEqual(fs.readFileSync(canonical), bytes);
  assert.throws(
    () =>
      fs.lstatSync(path.join(directory, `${encoded.intent.reference}.stage`)),
    { code: "ENOENT" },
  );
  cleanupFixture(fixture);
});

/**
 * Native保存接続がcaller canonicalのfresh読取りを必須にする。
 *
 * @responsibility saved Objectの自己申告や欠落・不正bytesからNative要求へ進まない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition 自己生成Repositoryと独立した正規intent。Native Contextは意図的に無効。
 * @stimulus 未保存、正常caller、binding差、取消、canonical破損を公開接続へ渡す。
 * @observation 同参照、前後caller確認、Native結果、Process/記録Effectと元bytes。
 * @oracle 正常callerだけNative前検証へ到達するが無効Contextで停止。その他は読取り段階で停止。
 * @cleanup 全Oracle成立後、自己生成Rootだけを限定清掃する。
 * @boundary Repository内実Filesystem→保存Adapterの取得前拒否。実Native保存は対象外。
 */
test("Host Windows: Native保存接続は同参照callerのfresh完全bytesを必要とする", async () => {
  const fixture = createFixture();
  const encoded = intentFixture();
  const signal = new AbortController().signal;
  /**
   * 同じfixture・参照・期待結合で保存接続を呼び出す。
   *
   * @responsibility 前提状態だけを変え、Native取得前の判定を比較する。
   * @trace ERB-IT-001
   * @trace ERB-IT-002
   * @trace ERB-IT-003
   * @precondition 自己生成Repositoryと固定intent、無効な開発Context。
   * @stimulus 現在のcaller記録で公開接続を一回呼び出す。
   * @observation 参照・前後確認・Native結果とEffect。
   * @oracle 欠落または破損時はNative取得前に停止する。
   * @cleanup 呼出し元が全Oracle後にfixtureだけを回収する。
   * @boundary Repository caller→Native保存Adapterの取得前。
   */
  const invoke = () =>
    publishHostTerminalRecoveryCheckpoint(
      fixture.capability,
      encoded.intent.reference,
      encoded.intent.bindings,
      new Date().toISOString(),
      signal,
      {},
    );
  const missing = invoke();
  assert.equal(missing.status, "blocked");
  assert.equal(missing.reference, encoded.intent.reference);
  assert.equal(missing.nativeSave, null);
  assert.equal(missing.recordEffectIssued, false);
  assert.equal(
    (
      await saveHostTerminalCallerCheckpoint(
        fixture.capability,
        encoded.intent,
        encoded.intent.bindings,
        signal,
      )
    ).status,
    "saved",
  );
  const ready = invoke();
  assert.equal(ready.status, "blocked");
  assert.equal(ready.reason, "host_terminal_development_context_invalid");
  assert.equal(ready.callerVerifiedBeforeAndAfter, true);
  assert.equal(ready.reference, encoded.intent.reference);
  assert.equal(ready.nativeSave?.nativeSave, null);
  assert.equal(ready.processEffectIssued, false);
  assert.equal(ready.recordEffectIssued, false);
  assert.equal(ready.cleanupAuthorized, false);
  const readback = readHostTerminalRecoveryCheckpoint(
    fixture.capability,
    encoded.intent.reference,
    encoded.intent.bindings,
    new Date().toISOString(),
    signal,
    {},
  );
  assert.equal(readback.status, "blocked");
  assert.equal(readback.reference, encoded.intent.reference);
  assert.equal(readback.callerVerifiedBeforeAndAfter, true);
  assert.equal(
    readback.nativeRead?.reason,
    "host_terminal_development_context_invalid",
  );
  assert.equal(readback.processEffectIssued, false);
  assert.equal(readback.recordEffectIssued, false);
  assert.equal(readback.cleanupAuthorized, false);
  const mismatch = publishHostTerminalRecoveryCheckpoint(
    fixture.capability,
    encoded.intent.reference,
    { ...encoded.intent.bindings, runtimeSha256: "e".repeat(64) },
    new Date().toISOString(),
    signal,
    {},
  );
  assert.equal(mismatch.nativeSave, null);
  assert.equal(mismatch.recordEffectIssued, false);
  const aborted = new AbortController();
  aborted.abort();
  const cancelled = publishHostTerminalRecoveryCheckpoint(
    fixture.capability,
    encoded.intent.reference,
    encoded.intent.bindings,
    new Date().toISOString(),
    aborted.signal,
    {},
  );
  assert.equal(cancelled.reason, "host_terminal_publication_cancelled");
  assert.equal(cancelled.nativeSave, null);
  assert.equal(
    readHostTerminalCallerCheckpoint(
      fixture.capability,
      encoded.intent.reference,
      encoded.intent.bindings,
    ).serialized,
    encoded.serialized,
  );
  const paths = resolveRepositoryRuntimeDataPaths(fixture.capability);
  assert.ok(paths);
  const canonical = path.join(
    paths.coordinator,
    "recovery",
    "host-terminal",
    `${encoded.intent.reference}.json`,
  );
  fs.writeFileSync(canonical, "{", { flag: "r+" });
  fs.truncateSync(canonical, 1);
  const broken = invoke();
  assert.equal(broken.nativeSave, null);
  assert.equal(broken.recordEffectIssued, false);
  assert.equal(broken.reference, encoded.intent.reference);
  const brokenRead = readHostTerminalRecoveryCheckpoint(
    fixture.capability,
    encoded.intent.reference,
    encoded.intent.bindings,
    new Date().toISOString(),
    signal,
    {},
  );
  assert.equal(brokenRead.nativeRead, null);
  assert.equal(brokenRead.processEffectIssued, false);
  assert.equal(brokenRead.reference, encoded.intent.reference);
  assert.equal(fs.readFileSync(canonical, "utf8"), "{");
  assert.throws(
    () =>
      fs.lstatSync(
        path.join(path.dirname(canonical), `${encoded.intent.reference}.stage`),
      ),
    { code: "ENOENT" },
  );
  cleanupFixture(fixture);
});

/**
 * 観測・保存の準備入口が不正な前提をEffect前に拒否することを確認する。
 *
 * @responsibility 未検証Root、期待結合、取消と実行Contextを保存開始へ通さない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition 自己生成Repositoryと固定intent fixture。無効開発ContextによりNativeを起動しない。
 * @stimulus 正規要求、偽Repository、ゼロHash、取消済みSignal、未知fieldとAccessorを準備入口へ渡す。
 * @observation 取得済み参照、観測・保存結果、管理／記録Effectとcaller Directory不存在。
 * @oracle 有効参照は拒否後も保持し、Nativeまたは保存前に停止する。Accessorを実行しない。
 * @cleanup 全Oracle成立後に自己生成Rootだけを限定清掃する。
 * @boundary 前提拒否の確認だけで、実Native正常接続・承認・清掃の成功は主張しない。
 */
test("Host Windows: 回復記録の準備は不正な前提で保存を開始しない", async () => {
  const fixture = createFixture();
  const encoded = intentFixture();
  const nonce = randomUUID();
  const input = {
    reference: encoded.intent.reference,
    rootName: `crdd-coordinator-doctor-${nonce}`,
    markerName: `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
    bindings: encoded.intent.bindings,
  };
  const cancelled = new AbortController();
  cancelled.abort();
  let accessorCalls = 0;
  for (const [repository, value, signal, reason, expectedReference] of [
    [
      fixture.capability,
      input,
      new AbortController().signal,
      "host_terminal_development_context_invalid",
      input.reference,
    ],
    [
      {} as typeof fixture.capability,
      input,
      new AbortController().signal,
      "host_terminal_preparation_repository_invalid",
      input.reference,
    ],
    [
      fixture.capability,
      { ...input, markerName: `host-${"e".repeat(64)}.json` },
      new AbortController().signal,
      "host_terminal_preparation_generation_invalid",
      input.reference,
    ],
    [
      fixture.capability,
      { ...input, rootName: "crdd-coordinator-doctor-caller-fixture" },
      new AbortController().signal,
      "host_terminal_preparation_generation_invalid",
      input.reference,
    ],
    [
      fixture.capability,
      {
        ...input,
        bindings: { ...input.bindings, runtimeSha256: "0".repeat(64) },
      },
      new AbortController().signal,
      "host_terminal_preparation_bindings_invalid",
      input.reference,
    ],
    [
      fixture.capability,
      input,
      cancelled.signal,
      "host_terminal_preparation_cancelled",
      input.reference,
    ],
    [
      fixture.capability,
      { ...input, extra: true },
      new AbortController().signal,
      "host_terminal_preparation_input_invalid",
      null,
    ],
    [
      fixture.capability,
      Object.defineProperty({ ...input }, "bindings", {
        enumerable: true,
        get() {
          accessorCalls += 1;
          throw new Error("accessor_must_not_run");
        },
      }),
      new AbortController().signal,
      "host_terminal_preparation_input_invalid",
      null,
    ],
  ] as const) {
    for (const prepare of [
      prepareHostTerminalRecoveryCheckpoint,
      prepareKnownFileHostTerminalRecoveryCheckpoint,
    ]) {
      const result = await prepare(repository, value, 0, signal, {});
      assert.equal(result.status, "blocked");
      assert.equal(result.reason, reason);
      assert.equal(result.reference, expectedReference);
      assert.equal(result.checkpoint, null);
      assert.equal(result.intent, null);
      assert.equal(result.administrativeEffectIssued, false);
      assert.equal(result.recordEffectIssued, false);
      assert.equal(result.processEffectIssued, false);
      assert.equal(result.observation?.processEffectIssued ?? false, false);
      assert.equal(result.runtimeAuthorityIssued, false);
      assert.equal(result.cleanupAuthorized, false);
    }
  }
  assert.equal(accessorCalls, 0);
  const paths = resolveRepositoryRuntimeDataPaths(fixture.capability);
  assert.ok(paths);
  assert.throws(
    () =>
      fs.lstatSync(path.join(paths.coordinator, "recovery", "host-terminal")),
    { code: "ENOENT" },
  );
  cleanupFixture(fixture);
});

/**
 * 保存・同参照再読取りと衝突拒否を実境界で確認する。
 *
 * @responsibility 完全bytesを独立取得し、差異と部分stageを修復しないことを確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition 自己生成fixture Repositoryと完全intent。
 * @stimulus 保存、反復保存、異なるbytes、期待binding差、部分stageを与える。
 * @observation 返却Effect、完全bytes、stage／canonical実体と再取得。
 * @oracle 保存は同参照、反復は記録Effectなし。差異は既存bytes不変、部分stageは保持。
 * @cleanup 全Oracle成立後だけ自己生成Rootを限定削除する。
 * @boundary caller保存だけでNative保存・清掃成立を主張しない。
 */
test("Host Windows: caller checkpointは同参照と独立bytesを保持する", async () => {
  const fixture = createFixture();
  const encoded = intentFixture();
  const signal = new AbortController().signal;
  const preCancelled = new AbortController();
  preCancelled.abort();
  const cancelledSave = await saveHostTerminalCallerCheckpoint(
    fixture.capability,
    encoded.intent,
    encoded.intent.bindings,
    preCancelled.signal,
  );
  assert.equal(cancelledSave.status, "blocked");
  assert.equal(cancelledSave.reason, "host_terminal_caller_lease_unavailable");
  assert.equal(cancelledSave.administrativeEffectIssued, false);
  assert.equal(cancelledSave.recordEffectIssued, false);
  assert.equal(cancelledSave.leaseCloseConfirmed, true);
  const saved = await saveHostTerminalCallerCheckpoint(
    fixture.capability,
    encoded.intent,
    encoded.intent.bindings,
    signal,
  );
  assert.deepEqual(saved, {
    status: "saved",
    reason: "host_terminal_caller_checkpoint_saved",
    reference: encoded.intent.reference,
    administrativeEffectIssued: true,
    recordEffectIssued: true,
    handlesCloseConfirmed: true,
    leaseCloseConfirmed: true,
    runtimeDataBlock: null,
  });
  assert.deepEqual(
    readHostTerminalCallerCheckpoint(
      fixture.capability,
      encoded.intent.reference,
      encoded.intent.bindings,
    ),
    encoded,
  );
  const readerUrl = pathToFileURL(
    path.resolve(
      import.meta.dirname,
      "../../src/host-execution/terminal-caller-checkpoint.ts",
    ),
  ).href;
  const rootUrl = pathToFileURL(
    path.resolve(import.meta.dirname, "../../../version-control/src/index.ts"),
  ).href;
  const readCode = `import {readHostTerminalCallerCheckpoint} from ${JSON.stringify(readerUrl)}; import {verifyRepositoryRoot} from ${JSON.stringify(rootUrl)}; const r=verifyRepositoryRoot(${JSON.stringify(fixture.root)}); if(r.status!=='completed') process.exit(3); const c=readHostTerminalCallerCheckpoint(r.capability,${JSON.stringify(encoded.intent.reference)},${JSON.stringify(encoded.intent.bindings)}); process.stdout.write(JSON.stringify({reference:c.intent.reference,sha256:c.sha256}));`;
  const freshRead = spawnSync(
    process.execPath,
    ["--input-type=module", "--eval", readCode],
    {
      cwd: fixture.root,
      encoding: "utf8",
      timeout: 5_000,
      maxBuffer: 1_024,
      windowsHide: true,
    },
  );
  assert.equal(freshRead.status, 0);
  assert.deepEqual(JSON.parse(freshRead.stdout), {
    reference: encoded.intent.reference,
    sha256: encoded.sha256,
  });
  const repeated = await saveHostTerminalCallerCheckpoint(
    fixture.capability,
    encoded.intent,
    encoded.intent.bindings,
    signal,
  );
  assert.equal(repeated.status, "saved");
  assert.equal(repeated.recordEffectIssued, false);
  const conflict = await saveHostTerminalCallerCheckpoint(
    fixture.capability,
    {
      ...encoded.intent,
      producer: {
        ...encoded.intent.producer,
        selectionSnapshotSha256: "0".repeat(64),
      },
    },
    encoded.intent.bindings,
    signal,
  );
  assert.equal(conflict.status, "blocked");
  assert.equal(conflict.reason, "host_terminal_caller_conflict");
  assert.equal(conflict.reference, encoded.intent.reference);
  assert.equal(conflict.recordEffectIssued, false);
  assert.throws(
    () =>
      readHostTerminalCallerCheckpoint(
        fixture.capability,
        encoded.intent.reference,
        { ...encoded.intent.bindings, runtimeSha256: "0".repeat(64) },
      ),
    /binding_mismatch/u,
  );
  const directory = path.join(
    resolveRepositoryRuntimeDataPaths(fixture.capability)?.coordinator ?? "",
    "recovery",
    "host-terminal",
  );
  const partial = intentFixture();
  fs.writeFileSync(
    path.join(directory, `${partial.intent.reference}.stage`),
    "{",
    { flag: "wx" },
  );
  const blocked = await saveHostTerminalCallerCheckpoint(
    fixture.capability,
    partial.intent,
    partial.intent.bindings,
    signal,
  );
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.reference, partial.intent.reference);
  assert.equal(
    fs.readFileSync(
      path.join(directory, `${partial.intent.reference}.stage`),
      "utf8",
    ),
    "{",
  );
  assert.throws(
    () =>
      fs.lstatSync(path.join(directory, `${partial.intent.reference}.json`)),
    { code: "ENOENT" },
  );
  assert.deepEqual(
    readHostTerminalCallerCheckpoint(
      fixture.capability,
      encoded.intent.reference,
      encoded.intent.bindings,
    ),
    encoded,
  );
  cleanupFixture(fixture);
});

/**
 * 未知inventoryと容量境界で新記録を拒否する。
 *
 * @responsibility 未評価entryを無視した計数と既存参照の読取り停止を防ぐ。
 * @trace ERB-IT-002
 * @precondition 一つの正常checkpointを持つ自己生成fixture。
 * @stimulus 未知entryと物理1023entryを順に与える。
 * @observation 新記録Effect、停止理由、既存bytesと読取り。
 * @oracle 2entry分の予約ができない場合に新記録0。既存参照は読める。
 * @cleanup 全Oracle成立後だけ自己生成Rootを限定削除する。
 * @boundary Native容量・全producerの新Root受付はこの試験の対象外。
 */
test("Host Windows: caller checkpointは未知inventoryと容量超過を拒否する", async () => {
  const fixture = createFixture();
  const first = intentFixture();
  const signal = new AbortController().signal;
  assert.equal(
    (
      await saveHostTerminalCallerCheckpoint(
        fixture.capability,
        first.intent,
        first.intent.bindings,
        signal,
      )
    ).status,
    "saved",
  );
  const directory = path.join(
    resolveRepositoryRuntimeDataPaths(fixture.capability)?.coordinator ?? "",
    "recovery",
    "host-terminal",
  );
  const foreign = path.join(directory, "unknown.fixture");
  fs.writeFileSync(foreign, "x", { flag: "wx" });
  const next = intentFixture();
  const unknown = await saveHostTerminalCallerCheckpoint(
    fixture.capability,
    next.intent,
    next.intent.bindings,
    signal,
  );
  assert.equal(unknown.reason, "host_terminal_caller_inventory_unknown");
  assert.equal(unknown.recordEffectIssued, false);
  fs.unlinkSync(foreign);
  for (let index = 0; index < 1_022; index++)
    fs.writeFileSync(
      path.join(directory, `host-terminal.${randomUUID()}.stage`),
      "",
      { flag: "wx" },
    );
  const full = await saveHostTerminalCallerCheckpoint(
    fixture.capability,
    next.intent,
    next.intent.bindings,
    signal,
  );
  assert.equal(full.reason, "host_terminal_caller_capacity_exceeded");
  assert.equal(full.recordEffectIssued, false);
  assert.deepEqual(
    readHostTerminalCallerCheckpoint(
      fixture.capability,
      first.intent.reference,
      first.intent.bindings,
    ),
    first,
  );
  cleanupFixture(fixture);
});

/**
 * 別Process競合と所有Process喪失後の再取得を観測する。
 *
 * @responsibility 別Supervisorの生存ではなく同じNode所有pipeを排他根拠にする。
 * @trace ERB-IT-002
 * @trace ERB-IT-003
 * @precondition 自己生成Repository capability。子Processはpipe取得だけを行う。
 * @stimulus 同時取得、取得前取消、子Nodeの取得と強制終了後の再取得。
 * @observation 各取得・close、子stdoutの閉結果と実close。
 * @oracle 同時二Ownerは取得不能。子close確認後はlock file削除なしで再取得できる。
 * @cleanup 自己生成子Nodeを終了確認し、全Oracle成立後にfixture Rootを限定削除する。
 * @boundary 子NodeはProvider、Docker、Filesystem保存または別子Processを作らない。
 */
test("Host Windows: caller mutation leaseは競合を拒否しProcess喪失で解放される", async () => {
  const fixture = createFixture();
  const signal = new AbortController().signal;
  const first = acquireHostTerminalCallerLease(fixture.capability, signal);
  assert.equal((await first.acquired).status, "acquired");
  const second = acquireHostTerminalCallerLease(fixture.capability, signal);
  assert.notEqual((await second.acquired).status, "acquired");
  assert.equal((await second.release()).serverCloseObserved, true);
  assert.equal(first.isHeld(), true);
  assert.equal((await first.release()).status, "closed");
  const cancelled = new AbortController();
  cancelled.abort();
  const inactive = acquireHostTerminalCallerLease(
    fixture.capability,
    cancelled.signal,
  );
  assert.equal((await inactive.acquired).status, "not_acquired");
  assert.equal((await inactive.release()).status, "not_started");
  const pendingCancel = new AbortController();
  const pending = acquireHostTerminalCallerLease(
    fixture.capability,
    pendingCancel.signal,
  );
  pendingCancel.abort();
  assert.notEqual((await pending.acquired).status, "acquired");
  assert.equal((await pending.release()).serverCloseObserved, true);
  const leaseUrl = pathToFileURL(
    path.resolve(
      import.meta.dirname,
      "../../src/host-execution/terminal-caller-lease.ts",
    ),
  ).href;
  const rootUrl = pathToFileURL(
    path.resolve(import.meta.dirname, "../../../version-control/src/index.ts"),
  ).href;
  const code = `import {acquireHostTerminalCallerLease} from ${JSON.stringify(leaseUrl)}; import {verifyRepositoryRoot} from ${JSON.stringify(rootUrl)}; const r=verifyRepositoryRoot(${JSON.stringify(fixture.root)}); if(r.status!=='completed') process.exit(3); const l=acquireHostTerminalCallerLease(r.capability,new AbortController().signal); const a=await l.acquired; process.stdout.write(JSON.stringify(a)+'\\n');`;
  const child = spawn(
    process.execPath,
    ["--input-type=module", "--eval", code],
    { cwd: fixture.root, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );
  const ended = new Promise<void>((resolve, reject) => {
    child.once("close", () => resolve());
    child.once("error", reject);
  });
  let output = "";
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("fixture_child_timeout")),
        5_000,
      );
      child.stdout.on("data", (outputChunk: Buffer) => {
        output += outputChunk.toString("utf8");
        if (output.length > 1_024) {
          clearTimeout(timer);
          reject(new Error("fixture_output_limit"));
        } else if (output.includes("\n")) {
          clearTimeout(timer);
          resolve();
        }
      });
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    assert.deepEqual(JSON.parse(output.trim()), { status: "acquired" });
    const contender = acquireHostTerminalCallerLease(
      fixture.capability,
      signal,
    );
    assert.notEqual((await contender.acquired).status, "acquired");
    await contender.release();
  } finally {
    child.kill();
    await ended;
  }
  const fresh = acquireHostTerminalCallerLease(fixture.capability, signal);
  assert.equal((await fresh.acquired).status, "acquired");
  assert.equal((await fresh.release()).status, "closed");
  cleanupFixture(fixture);
});

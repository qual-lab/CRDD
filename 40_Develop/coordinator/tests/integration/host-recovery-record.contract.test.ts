/**
 * 明示親でのHost初期化失敗・Process消失とHost／Probe記録を確認する。
 * @packageDocumentation
 * @responsibility 初期化失敗とProcess消失、OS tmp探索なしの記録読取り・拒否・不存在を実境界で確認する。
 * @trace ERB-IT-003
 * @trace PRL-IT-013
 * @level IT
 * @scope 自己生成Repository-local試験領域、初期化子Process、Host／Probe tokenとmarker。Probe記録試験はDockerを使用しない。
 * @boundary ERB-IT-003／PRL-IT-013=Direct Boundary: 明示親のHost初期化・Process消失・記録Reader→実Process／Filesystem。
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import {
  requireReadyRepositoryRuntimeDataArea,
  ensureRepositoryRuntimeDataAreaFromWorkingDirectory,
} from "../../../domain-model/src/index.ts";
import {
  writeDockerProbeRecoveryRecord,
  loadDockerProbeRecoveryRecord,
  parseDockerProbeRecoveryToken,
  classifyDockerProbeRecoveryChildren,
  requireDockerProbeRecoveryMounts,
  formatDockerIsolationRecoveryToken,
  isDockerIsolationRecoveryIdCandidate,
} from "../../../docker-isolation/src/index.ts";
import {
  formatHostRecoveryToken,
  parseHostRecoveryToken,
} from "../../src/execution/result.ts";
import {
  loadHostRecoveryRecordByToken,
  observeHostRecoveryCleanup,
} from "../../src/execution/recovery.ts";
import {
  createOwnedOperationDirectories,
  classifyOwnedOperationDirectoryCreationFailure,
  createOwnedOperationContextCapability,
  createOwnedMountCapability,
  createOwnedOperationManagementCapability,
  abandonOwnedHostOperationGenerationLock,
  activateOwnedHostOperationGenerationLock,
  recoverOwnedOperationDirectories,
  cleanupOwnedOperationDirectories,
  cleanupOwnedOperationDirectoriesAsync,
  acquireHostOperationRecoveryGeneration,
  releaseHostOperationRecoveryGeneration,
  borrowHostRecoveryManagementDirectory,
  beginOwnedDockerSubmissionRecovery,
  verifyOwnedOperationManagementCapability,
  confirmOwnedDockerAbsenceForRecovery,
  transitionHostRecoveryState,
  getOwnedHostRecoveryId,
  getOwnedHostRecoveryIdByManagementCapability,
} from "../../src/execution/operation.ts";

/**
 * 移管したHost遷移の三分岐とmarker確定・adopt順を実本文で確認する。
 * @responsibility Rootと旧stateの拒否、null Capability時の明示Root境界を検証する。
 * @trace ERB-IT-003
 * @precondition 現行実関数本文にHost／Filesystem代役を結合する。
 * @stimulus begin、cancel、absent、Root差、不正遷移と旧state差を与える。
 * @observation 委譲引数、marker全文、Hash、renameとadoptの順序。
 * @oracle 三分岐は同じ同期順、拒否は保存0、null Capabilityはadopt0。
 * @cleanup N/A: メモリだけ。実Hostの成立は別Caseで確認する。
 * @boundary ERB-IT-003=Direct Boundary: 移管実本文とHost／保存代役。
 */
test("Host状態遷移の移管本文は三分岐と保存・adopt順を維持する", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/operation.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf("export function transitionHostRecoveryState("),
    end = source.indexOf("\nexport const CREDENTIAL_ENV_NAMES", begin);
  assert.ok(begin >= 0 && end > begin);
  const body = stripTypeScriptTypes(source.slice(begin, end)).replace(
    "export function",
    "function",
  );
  const root = path.resolve("fixture-host-root"),
    marker = path.join(root, "marker.json");
  const capability = Object.freeze({}),
    calls: unknown[][] = [];
  let state = "docker_submission_started";
  const transition = runInNewContext(`${body};transitionHostRecoveryState`, {
    path,
    createHash,
    randomUUID: () => "fixed-save",
    transitionOwnedDockerSubmissionState: (...args: unknown[]) => {
      calls.push(["delegate", ...args]);
      return "delegated";
    },
    verifyOwnedMountCapability: (value: unknown) => {
      assert.equal(value, capability);
      calls.push(["verify"]);
      return { management: path.join(root, "management") };
    },
    loadHostRecoveryRecordByToken: (token: string, selectedRoot: string) => {
      calls.push(["load", token, selectedRoot]);
      return {
        record: { schema: "fixture-schema", state, untouched: "retained" },
        marker,
        parsed: { rootName: "root", nonce: "nonce" },
      };
    },
    formatHostRecoveryToken,
    fs: {
      writeFileSync: (...args: unknown[]) => calls.push(["write", ...args]),
      renameSync: (...args: unknown[]) => calls.push(["rename", ...args]),
    },
    adoptOwnedHostRecoveryRecordTransition: (...args: unknown[]) =>
      calls.push(["adopt", ...args]),
  }) as typeof transitionHostRecoveryState;
  assert.equal(
    transition("old", "host_only", "docker_submission_started", capability),
    "delegated",
  );
  assert.deepEqual(calls, [["delegate", capability, "old", "begin"]]);
  calls.length = 0;
  assert.equal(
    transition("old", "docker_submission_started", "host_only", capability),
    "delegated",
  );
  assert.deepEqual(calls, [["delegate", capability, "old", "cancel"]]);
  for (const selectedCapability of [capability, null]) {
    calls.length = 0;
    const bytes = `${JSON.stringify({ schema: "fixture-schema", state: "docker_absent_confirmed", untouched: "retained" })}\n`;
    const token = formatHostRecoveryToken(
      "root",
      "nonce",
      createHash("sha256").update(bytes).digest("hex"),
    );
    assert.equal(
      transition(
        "old",
        "docker_submission_started",
        "docker_absent_confirmed",
        selectedCapability,
        root,
      ),
      token,
    );
    const expected = [
      ...(selectedCapability === null ? [] : [["verify"]]),
      ["load", "old", root],
      [
        "write",
        `${marker}.fixed-save.tmp`,
        bytes,
        { encoding: "utf8", flag: "wx", mode: 0o600 },
      ],
      ["rename", `${marker}.fixed-save.tmp`, marker],
      ...(selectedCapability === null
        ? []
        : [["adopt", capability, "old", token]]),
    ];
    assert.deepEqual(JSON.parse(JSON.stringify(calls)), expected);
  }
  for (const [expected, next, selectedRoot, currentState, reason] of [
    [
      "host_only",
      "docker_absent_confirmed",
      root,
      "host_only",
      "host_recovery_state_invalid",
    ],
    [
      "docker_submission_started",
      "docker_absent_confirmed",
      `${root}-other`,
      "docker_submission_started",
      "host_recovery_root_mismatch",
    ],
    [
      "docker_submission_started",
      "docker_absent_confirmed",
      root,
      "host_only",
      "host_recovery_state_invalid",
    ],
  ] as const) {
    calls.length = 0;
    state = currentState;
    assert.throws(
      () => transition("old", expected, next, capability, selectedRoot),
      { message: reason },
    );
    assert.equal(
      calls.some(
        ([kind]) => kind === "write" || kind === "rename" || kind === "adopt",
      ),
      false,
    );
  }
  calls.length = 0;
  assert.throws(
    () =>
      transition(
        "old",
        "docker_submission_started",
        "docker_absent_confirmed",
        null,
      ),
    { message: "host_recovery_root_mismatch" },
  );
  assert.deepEqual(calls, []);
});

/**
 * 移管先の公開内部関数を実Hostの開始・取消・不存在確定へ接続する。
 * @responsibility importされた実関数と元Capabilityのmarker更新・清掃を確認する。
 * @trace ERB-IT-003
 * @precondition Repository-local自己生成領域と実Host世代排他を使用する。
 * @stimulus begin／cancel／begin／absentを同じOwnerで行う。
 * @observation marker全文・token Hash・元Capability更新と最後の不存在。
 * @oracle 各状態が同じmarkerへ保存され、Root差の拒否で本文不変、通常清掃が完了する。
 * @cleanup 自己生成Hostを正式清掃した後に空の専用親を削除する。
 * @boundary ERB-IT-003=Direct Boundary: 実Host／Filesystem。Docker不存在は合成前提であり実Docker回復は対象外。
 */
test("Host Windows: 移管したProbe Host遷移は実markerと元Capabilityを更新する", async () => {
  const parent = fs.mkdtempSync(
    path.join(hostInitializationTestDirectory(), "probe-transition-"),
  );
  const owned = createOwnedOperationDirectories(parent),
    mount = createOwnedMountCapability(owned);
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    mount,
  );
  let marker: string | null = null;
  let primaryFailure: unknown = null;
  let completedToken: string | null = null;
  try {
    assert.equal(
      await activateOwnedHostOperationGenerationLock(management),
      "activated",
    );
    let token = getOwnedHostRecoveryId(owned);
    for (const [beforeState, afterState] of [
      ["host_only", "docker_submission_started"],
      ["docker_submission_started", "host_only"],
      ["host_only", "docker_submission_started"],
      ["docker_submission_started", "docker_absent_confirmed"],
    ] as const) {
      const before = loadHostRecoveryRecordByToken(token, owned.root);
      marker = before.marker;
      if (afterState === "docker_absent_confirmed") {
        assert.throws(
          () =>
            transitionHostRecoveryState(
              token,
              beforeState,
              afterState,
              mount,
              `${owned.root}-other`,
            ),
          { message: "host_recovery_root_mismatch" },
        );
        assert.equal(fs.readFileSync(marker, "utf8"), before.serialized);
      }
      token = transitionHostRecoveryState(
        token,
        beforeState,
        afterState,
        mount,
        owned.root,
      );
      const bytes = `${JSON.stringify({ ...before.record, state: afterState })}\n`;
      assert.equal(fs.readFileSync(marker, "utf8"), bytes);
      assert.equal(
        token,
        formatHostRecoveryToken(
          before.parsed.rootName,
          before.parsed.nonce,
          createHash("sha256").update(bytes).digest("hex"),
        ),
      );
      assert.equal(
        getOwnedHostRecoveryIdByManagementCapability(management),
        token,
      );
      assert.equal(
        loadHostRecoveryRecordByToken(token, owned.root).record.state,
        afterState,
      );
    }
    completedToken = token;
  } catch (error) {
    primaryFailure = error;
  }
  let cleanupFailure: unknown = null;
  try {
    if (completedToken !== null) {
      assert.equal(
        await abandonOwnedHostOperationGenerationLock(management),
        true,
      );
      assert.equal(
        recoverOwnedOperationDirectories(completedToken, null, owned.root)
          .status,
        "recovered",
      );
    } else {
      await cleanupOwnedOperationDirectoriesAsync(owned);
    }
  } catch (cleanupError) {
    cleanupFailure = cleanupError;
    try {
      assert.equal(
        await abandonOwnedHostOperationGenerationLock(management),
        true,
      );
    } catch (releaseError) {
      cleanupFailure = new AggregateError(
        [cleanupError, releaseError],
        "Host試験の清掃と世代解放失敗",
      );
    }
  }
  if (primaryFailure !== null && cleanupFailure !== null)
    throw new AggregateError(
      [primaryFailure, cleanupFailure],
      "Host試験の一次失敗と清掃失敗",
    );
  if (cleanupFailure !== null) throw cleanupFailure;
  assertHostInitializationFixtureAbsent(owned.root);
  if (marker !== null) assertHostInitializationFixtureAbsent(marker);
  fs.rmdirSync(path.join(parent, "crdd-coordinator-recovery-v1"));
  fs.rmdirSync(parent);
  assertHostInitializationFixtureAbsent(parent);
  if (primaryFailure !== null) throw primaryFailure;
});

/**
 * Host初期化試験の書込み範囲をRepository内へ固定する。
 * @responsibility 既存resolverで検証したtests領域だけを親として返す。
 * @trace PRL-IT-013
 * @precondition 現RepositoryのRootを一意に解決できる。
 * @stimulus tests用途の既存領域を取得する。
 * @observation 検証済みdirectory。
 * @oracle OS一時領域や兄弟Repositoryへ書き込まない。
 * @cleanup 各Caseが自己生成した子だけを回収する。
 * @boundary Repository Root resolverと実Filesystem。
 */
function hostInitializationTestDirectory(): string {
  return requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "host_initialization_test",
  ).directory;
}

/**
 * 自己生成Host初期化fixtureの明示的な不存在を確認する。
 * @responsibility 観測不能を不存在へ丸めない。
 * @trace PRL-IT-013
 * @precondition targetは当該Caseの自己生成物である。
 * @stimulus lstatで再観測する。
 * @observation ENOENTまたは別の観測結果。
 * @oracle ENOENTだけを不存在として受理する。
 * @cleanup N/A: 読取りだけ。
 * @boundary 実Filesystem観測。
 */
function assertHostInitializationFixtureAbsent(target: string): void {
  assert.throws(() => fs.lstatSync(target), { code: "ENOENT" });
}

/**
 * 移管した実Probe記録を初回保存から確定ID・再読取りまで照合する。
 * @responsibility 記録bytes・Hash・実体境界と部分欠測の意味を保持する。
 * @trace ERB-IT-003
 * @precondition 自己生成Repository-local親と固定時計を使う。Host Authorityは発行しない。
 * @stimulus null／確定ID保存、token四軸、記録差・実体差・子欠測・未知子を与える。
 * @observation 保存全文、旧／新token、現在の子集合とmount拒否。
 * @oracle 独立期待bytesと一致し、Hash／同対象照合不能は拒否、任意欠測を必須四用途へ補完しない。
 * @cleanup 自己生成親内のfixtureだけを回収し、最後に不存在を確認する。
 * @boundary ERB-IT-003=Direct Boundary: Probe実Writer→実Reader→Filesystem。Docker／Providerは不使用。
 */
test("Host Windows: Probe記録の実保存と読取りはbytes・token・実体・部分欠測を維持する", (t) => {
  const parent = fs.mkdtempSync(
    path.join(hostInitializationTestDirectory(), "probe-record-"),
  );
  const rootName = `crdd-coordinator-doctor-${randomUUID()}`,
    root = path.join(parent, rootName);
  fs.mkdirSync(root);
  const names = [
    "workspace",
    "provider-home",
    "tmp",
    "events",
    "projection",
    "management",
  ] as const;
  for (const name of names) fs.mkdirSync(path.join(root, name));
  const mounts = {
    workspace: path.join(root, "workspace"),
    providerHome: path.join(root, "provider-home"),
    tmp: path.join(root, "tmp"),
    events: path.join(root, "events"),
    projection: path.join(root, "projection"),
    management: path.join(root, "management"),
  };
  const marker = path.join(mounts.management, "docker-probe-recovery-v1.json");
  const probeId = randomUUID(),
    nonce = randomUUID(),
    host = "host-fixture-reference";
  const fixedTime = "2026-10-17T00:00:00.000Z";
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse(fixedTime) });
  /**
   * Readerを使わず実statから独立した期待実体を作る。
   * @responsibility 生成記録自身を期待値として再利用しない。
   * @trace ERB-IT-003
   * @precondition 対象は当該Case内のDirectory。
   * @stimulus bigint statを読む。
   * @observation 三実体値。
   * @oracle dev／ino／birthtimeNsを十進文字列へ直接投影する。
   * @cleanup N/A: 読取りのみ。
   * @boundary 試験期待値と実Filesystem。
   */
  const expectedIdentity = (target: string) => {
    const value = fs.lstatSync(target, { bigint: true });
    return {
      dev: String(value.dev),
      ino: String(value.ino),
      birthtimeNs: String(value.birthtimeNs),
    };
  };
  const children = Object.fromEntries(
    names.map((name) => [name, expectedIdentity(path.join(root, name))]),
  );
  let previousToken: string | null = null;
  try {
    for (const id of [null, "a".repeat(64)]) {
      const expected = {
        schema: "crdd-coordinator-docker-recovery/v1",
        probeId,
        nonceHash: createHash("sha256").update(nonce).digest("hex"),
        rootName,
        rootIdentity: expectedIdentity(root),
        childIdentities: children,
        container: {
          id,
          name: `crdd-coordinator-probe-${probeId}`,
          label: `crdd.coordinator.probe=${probeId}`,
        },
        engine: "docker_desktop_linux_named_pipe",
        image:
          "python@sha256:d67a7b66b989ad6b6d6b10d428dcc5e0bfc3e5f88906e67d490c4d3daac57047",
        hostRecoveryId: host,
        createdAt: fixedTime,
      };
      const bytes = `${JSON.stringify(expected)}\n`,
        hash = createHash("sha256").update(bytes).digest("hex");
      const token = writeDockerProbeRecoveryRecord(
        mounts,
        probeId,
        nonce,
        host,
        id,
      );
      assert.equal(fs.readFileSync(marker, "utf8"), bytes);
      assert.equal(token, `docker.${rootName}.${probeId}.${nonce}.${hash}`);
      assert.equal(isDockerIsolationRecoveryIdCandidate(token), true);
      assert.deepEqual(parseDockerProbeRecoveryToken(token), {
        rootName,
        probeId,
        nonce,
        recordHash: hash,
      });
      const loaded = loadDockerProbeRecoveryRecord(token, root);
      assert.deepEqual(loaded.record, expected);
      assert.deepEqual(requireDockerProbeRecoveryMounts(loaded), mounts);
      if (previousToken !== null)
        assert.throws(() => loadDockerProbeRecoveryRecord(previousToken, root));
      previousToken = token;
    }
    assert.ok(previousToken);
    const token = previousToken,
      bytes = fs.readFileSync(marker, "utf8"),
      record = JSON.parse(bytes);
    for (const wrong of [
      formatDockerIsolationRecoveryToken(
        `${rootName}-other`,
        probeId,
        nonce,
        "0".repeat(64),
      ),
      formatDockerIsolationRecoveryToken(
        rootName,
        randomUUID(),
        nonce,
        createHash("sha256").update(bytes).digest("hex"),
      ),
      formatDockerIsolationRecoveryToken(
        rootName,
        probeId,
        randomUUID(),
        createHash("sha256").update(bytes).digest("hex"),
      ),
      formatDockerIsolationRecoveryToken(
        rootName,
        probeId,
        nonce,
        "0".repeat(64),
      ),
    ])
      assert.throws(() => loadDockerProbeRecoveryRecord(wrong, root));
    assert.throws(() => loadDockerProbeRecoveryRecord(token, `${root}-other`));
    assert.equal(isDockerIsolationRecoveryIdCandidate("host.fixture"), false);
    assert.throws(() => parseHostRecoveryToken(token));
    for (const change of [
      { schema: "other" },
      { probeId: randomUUID() },
      { nonceHash: "0".repeat(64) },
      {
        rootIdentity: {
          ...record.rootIdentity,
          ino: String(BigInt(record.rootIdentity.ino) + 1n),
        },
      },
      { container: { ...record.container, id: 1 } },
    ]) {
      const changed = `${JSON.stringify({ ...record, ...change })}\n`;
      fs.writeFileSync(marker, changed);
      const changedToken = formatDockerIsolationRecoveryToken(
        rootName,
        probeId,
        nonce,
        createHash("sha256").update(changed).digest("hex"),
      );
      assert.throws(() => loadDockerProbeRecoveryRecord(changedToken, root));
    }
    fs.writeFileSync(marker, `${bytes} `);
    assert.throws(() => loadDockerProbeRecoveryRecord(token, root));
    fs.writeFileSync(marker, bytes);
    const unknown = path.join(root, "unknown");
    fs.writeFileSync(unknown, "fixture");
    assert.throws(
      () => loadDockerProbeRecoveryRecord(token, root),
      /docker_recovery_unknown_child/u,
    );
    fs.unlinkSync(unknown);
    const originalLstat = fs.lstatSync;
    const observation = t.mock.method(fs, "lstatSync", ((
      ...args: Parameters<typeof fs.lstatSync>
    ) => {
      if (String(args[0]) === mounts.tmp)
        throw Object.assign(new Error("fixture-unobserved"), {
          code: "EACCES",
        });
      return Reflect.apply(originalLstat, fs, args);
    }) as typeof fs.lstatSync);
    try {
      assert.throws(
        () => classifyDockerProbeRecoveryChildren(root, record.childIdentities),
        { code: "EACCES" },
      );
    } finally {
      observation.mock.restore();
    }
    const complete = loadDockerProbeRecoveryRecord(token, root);
    for (const name of names) {
      const target = path.join(root, name),
        held = path.join(parent, `held-${name}`);
      fs.renameSync(target, held);
      try {
        const classified = classifyDockerProbeRecoveryChildren(
          root,
          record.childIdentities,
        );
        assert.equal(classified.present.includes(name), false);
        const partialMountInput = {
          ...complete,
          present: new Set(classified.present),
        };
        if (["workspace", "provider-home", "tmp", "management"].includes(name))
          assert.throws(
            () => requireDockerProbeRecoveryMounts(partialMountInput),
            /docker_recovery_mount_missing/u,
          );
        else
          assert.deepEqual(
            requireDockerProbeRecoveryMounts(partialMountInput),
            mounts,
          );
        if (name === "management")
          assert.throws(() => loadDockerProbeRecoveryRecord(token, root));
        else {
          const partial = loadDockerProbeRecoveryRecord(token, root);
          if (["workspace", "provider-home", "tmp"].includes(name))
            assert.throws(
              () => requireDockerProbeRecoveryMounts(partial),
              /docker_recovery_mount_missing/u,
            );
          else
            assert.deepEqual(requireDockerProbeRecoveryMounts(partial), mounts);
        }
        fs.mkdirSync(target);
        if (name === "management")
          fs.writeFileSync(
            path.join(target, "docker-probe-recovery-v1.json"),
            bytes,
          );
        assert.throws(
          () => loadDockerProbeRecoveryRecord(token, root),
          /docker_recovery_child_replaced/u,
        );
        if (name === "management")
          fs.unlinkSync(path.join(target, "docker-probe-recovery-v1.json"));
        fs.rmdirSync(target);
        fs.writeFileSync(target, "wrong-kind");
        assert.throws(
          () =>
            classifyDockerProbeRecoveryChildren(root, record.childIdentities),
          /docker_recovery_child_replaced/u,
        );
        fs.unlinkSync(target);
        fs.symlinkSync(
          held,
          target,
          process.platform === "win32" ? "junction" : "dir",
        );
        assert.throws(
          () =>
            classifyDockerProbeRecoveryChildren(root, record.childIdentities),
          /docker_recovery_child_replaced/u,
        );
        fs.unlinkSync(target);
      } finally {
        if (fs.existsSync(target)) fs.rmSync(target, { recursive: true });
        fs.renameSync(held, target);
      }
    }
    fs.unlinkSync(marker);
    fs.mkdirSync(marker);
    assert.throws(
      () => loadDockerProbeRecoveryRecord(token, root),
      /docker_recovery_record_replaced/u,
    );
    fs.rmdirSync(marker);
    fs.writeFileSync(marker, bytes);
    const heldRoot = path.join(parent, "held-root");
    fs.renameSync(root, heldRoot);
    try {
      fs.mkdirSync(root);
      fs.mkdirSync(mounts.management);
      fs.writeFileSync(marker, bytes);
      assert.throws(
        () => loadDockerProbeRecoveryRecord(token, root),
        /docker_recovery_root_replaced/u,
      );
      fs.rmSync(root, { recursive: true });
    } finally {
      if (fs.existsSync(root)) fs.rmSync(root, { recursive: true });
      fs.renameSync(heldRoot, root);
    }
    const invalidRoot = path.join(parent, "invalid-prefix"),
      invalidManagement = path.join(invalidRoot, "management");
    fs.mkdirSync(invalidRoot);
    fs.mkdirSync(invalidManagement);
    assert.throws(
      () =>
        writeDockerProbeRecoveryRecord(
          { ...mounts, management: invalidManagement },
          probeId,
          nonce,
          host,
        ),
      /docker_recovery_boundary_failed/u,
    );
    assert.deepEqual(fs.readdirSync(invalidManagement), []);
    const alias = path.join(parent, "crdd-coordinator-doctor-alias");
    fs.symlinkSync(
      root,
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
    try {
      assert.throws(
        () =>
          writeDockerProbeRecoveryRecord(
            { ...mounts, management: path.join(alias, "management") },
            probeId,
            nonce,
            host,
          ),
        /docker_recovery_boundary_failed/u,
      );
      assert.deepEqual(fs.readdirSync(mounts.management), [
        "docker-probe-recovery-v1.json",
      ]);
    } finally {
      fs.unlinkSync(alias);
    }
    assert.deepEqual(loadDockerProbeRecoveryRecord(token, root).record, record);
    assert.deepEqual(fs.readdirSync(mounts.management), [
      "docker-probe-recovery-v1.json",
    ]);
  } finally {
    assert.equal(path.dirname(parent), hostInitializationTestDirectory());
    fs.rmSync(parent, { recursive: true });
    assertHostInitializationFixtureAbsent(parent);
  }
});

/**
 * Operation Directory生成primitiveはEffect前失敗とrollback確認済み失敗をopaque分類するを検証する。
 *
 * @responsibility Operation Directory生成primitiveはEffect前失敗とrollback確認済み失敗をopaque分類するの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Operation Directory生成primitiveはEffect前失敗とrollback確認済み失敗をopaque分類するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Effect前失敗とrollback確認済み失敗はclean、共有保存場所不正は清掃未確認・IDなしで保持する。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Windows: Operation Directory生成primitiveはEffect前失敗とrollback確認済み失敗をopaque分類する", () => {
  const missingParent = path.join(
    hostInitializationTestDirectory(),
    `crdd-missing-operation-parent-${Date.now()}-${process.pid}`,
  );
  assert.throws(
    () => createOwnedOperationDirectories(missingParent),
    (error) => {
      assert.deepEqual(classifyOwnedOperationDirectoryCreationFailure(error), {
        cleanupConfirmed: true,
        manualRecoveryRequired: false,
        hostRecoveryId: null,
      });
      return true;
    },
  );

  const parent = fs.mkdtempSync(
    path.join(
      hostInitializationTestDirectory(),
      "crdd-operation-creation-failure-test-",
    ),
  );
  try {
    fs.writeFileSync(path.join(parent, "crdd-coordinator-recovery-v1"), "x");
    assert.throws(
      () => createOwnedOperationDirectories(parent),
      (error) => {
        assert.deepEqual(
          classifyOwnedOperationDirectoryCreationFailure(error),
          {
            cleanupConfirmed: false,
            manualRecoveryRequired: true,
            hostRecoveryId: null,
          },
        );
        return true;
      },
    );
    assert.equal(
      fs.readFileSync(
        path.join(parent, "crdd-coordinator-recovery-v1"),
        "utf8",
      ),
      "x",
    );
    assert.deepEqual(
      fs
        .readdirSync(parent)
        .filter((name) => name.startsWith("crdd-coordinator-doctor-")),
      [],
    );
  } finally {
    fs.rmSync(parent, { recursive: true, force: true });
  }

  const postMarkerParent = fs.mkdtempSync(
    path.join(
      hostInitializationTestDirectory(),
      "crdd-operation-post-marker-failure-test-",
    ),
  );
  const originalMkdirSync = fs.mkdirSync;
  try {
    fs.mkdirSync = ((target: fs.PathLike, options?: unknown) => {
      if (path.basename(String(target)) === "management")
        throw new Error("fixture_post_marker_child_creation_failed");
      return originalMkdirSync(target, options as never);
    }) as typeof fs.mkdirSync;
    assert.throws(
      () => createOwnedOperationDirectories(postMarkerParent),
      (error) => {
        assert.deepEqual(
          classifyOwnedOperationDirectoryCreationFailure(error),
          {
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            hostRecoveryId: null,
          },
        );
        return true;
      },
    );
  } finally {
    fs.mkdirSync = originalMkdirSync;
  }
  assert.deepEqual(
    fs
      .readdirSync(postMarkerParent)
      .filter((name) => name.startsWith("crdd-coordinator-doctor-")),
    [],
  );
  assert.deepEqual(
    fs.readdirSync(path.join(postMarkerParent, "crdd-coordinator-recovery-v1")),
    [],
  );
  fs.rmSync(postMarkerParent, { recursive: true, force: true });
});

/**
 * Operation初期化中のProcess消失は耐久Intentから自動回復または手動回復へ閉じるを検証する。
 *
 * @responsibility Operation初期化中のProcess消失は耐久Intentから自動回復または手動回復へ閉じるの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Operation初期化中のProcess消失は耐久Intentから自動回復または手動回復へ閉じるの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Windows: Operation初期化中のProcess消失は耐久Intentから自動回復または手動回復へ閉じる", () => {
  const parent = fs.mkdtempSync(
    path.join(hostInitializationTestDirectory(), "host-initialization-crash-"),
  );
  const parentIdentity = fs.lstatSync(parent, { bigint: true });

  const moduleUrl = pathToFileURL(
    path.resolve(import.meta.dirname, "../../src/execution/operation.ts"),
  ).href;
  /**
   * runCrashのTest準備責務を実行する。
   *
   * @responsibility runCrashがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace PRL-IT-013
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus runCrashを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
   */
  const runCrash = (phase: "before_root" | "after_root") => {
    const source = `
      const fs = (await import("node:fs")).default;
      const path = (await import("node:path")).default;
      const phase = process.argv[1];
      const parent = process.argv[2];
      const originalMkdirSync = fs.mkdirSync;
      const originalLstatSync = fs.lstatSync;
      let ownedRootCreated = false;
      fs.mkdirSync = function (target, ...args) {
        if (
          phase === "before_root" &&
          path.basename(String(target)).startsWith("crdd-coordinator-doctor-")
        ) {
          fs.writeSync(1, JSON.stringify({ phase, pid: process.pid }) + "\\n");
          process.kill(process.pid, "SIGKILL");
        }
        const result = originalMkdirSync.call(this, target, ...args);
        if (path.basename(String(target)).startsWith("crdd-coordinator-doctor-"))
          ownedRootCreated = true;
        return result;
      };
      fs.lstatSync = function (target, ...args) {
        if (
          phase === "after_root" &&
          ownedRootCreated &&
          path.basename(String(target)).startsWith("crdd-coordinator-doctor-")
        ) {
          fs.writeSync(1, JSON.stringify({ phase, pid: process.pid }) + "\\n");
          process.kill(process.pid, "SIGKILL");
        }
        return originalLstatSync.call(this, target, ...args);
      };
      const host = await import(${JSON.stringify(moduleUrl)});
      host.createOwnedOperationDirectories(parent);
      process.exit(90);
    `;
    const child = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "-e", source, phase, parent],
      { windowsHide: true, encoding: "utf8", timeout: 15_000 },
    );
    assert.equal(child.error, undefined);
    assert.equal(child.signal, null);
    assert.equal(child.status, 1, child.stderr);
    assert.deepEqual(JSON.parse(child.stdout), { phase, pid: child.pid });
    const currentParent = fs.lstatSync(parent, { bigint: true });
    assert.equal(currentParent.dev, parentIdentity.dev);
    assert.equal(currentParent.ino, parentIdentity.ino);
    assert.equal(currentParent.birthtimeNs, parentIdentity.birthtimeNs);
    const recoveryDirectory = path.join(parent, "crdd-coordinator-recovery-v1");
    const markers = fs
      .readdirSync(recoveryDirectory)
      .filter((name) => /^host-[a-f0-9]{64}\.json$/u.test(name));
    assert.equal(markers.length, 1);
    const marker = path.join(recoveryDirectory, markers[0] ?? "");
    const serialized = fs.readFileSync(marker, "utf8");
    const record = JSON.parse(serialized) as {
      state: string;
      rootName: string;
      rootIdentity: unknown;
      childIdentities: Record<string, unknown>;
    };
    assert.equal(record.state, "initializing");
    assert.equal(record.rootIdentity, null);
    assert.deepEqual(record.childIdentities, {});
    const nonce = record.rootName.slice("crdd-coordinator-doctor-".length);
    const token = `host.${record.rootName}.${nonce}.${createHash("sha256").update(serialized).digest("hex")}`;
    return Object.freeze({ marker, record, token });
  };

  const beforeRoot = runCrash("before_root");
  assert.deepEqual(
    recoverOwnedOperationDirectories(
      beforeRoot.token,
      null,
      path.join(fs.realpathSync(parent), beforeRoot.record.rootName),
    ),
    {
      status: "recovered",
      reason: "host_root_already_absent",
      recoveryId: null,
    },
  );
  assertHostInitializationFixtureAbsent(beforeRoot.marker);

  const afterRoot = runCrash("after_root");
  const root = path.join(parent, afterRoot.record.rootName);
  const rootIdentity = fs.lstatSync(root, { bigint: true });
  assert.deepEqual(
    recoverOwnedOperationDirectories(afterRoot.token, null, root),
    {
      status: "blocked",
      reason: "host_recovery_initialization_root_identity_unknown",
      recoveryId: afterRoot.token,
    },
  );
  const currentRootIdentity = fs.lstatSync(root, { bigint: true });
  assert.equal(currentRootIdentity.dev, rootIdentity.dev);
  assert.equal(currentRootIdentity.ino, rootIdentity.ino);
  assert.equal(currentRootIdentity.birthtimeNs, rootIdentity.birthtimeNs);
  fs.rmSync(root, { recursive: true, force: false });
  fs.rmSync(afterRoot.marker);
  assertHostInitializationFixtureAbsent(root);
  assertHostInitializationFixtureAbsent(afterRoot.marker);
  fs.rmSync(parent, { recursive: true, force: false });
  assertHostInitializationFixtureAbsent(parent);
});

/**
 * Operation初期化の同期I/O不明は全資源閉包をcleanへ戻さないを検証する。
 *
 * @responsibility Operation初期化の同期I/O不明は全資源閉包をcleanへ戻さないの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Operation初期化の同期I/O不明は全資源閉包をcleanへ戻さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Windows: Operation初期化の同期I/O不明は全資源閉包をcleanへ戻さない", () => {
  const runFault = (
    fault:
      | "initial_marker_identity"
      | "root_identity"
      | "host_only_temporary_identity",
  ) => {
    const parent = fs.mkdtempSync(
      path.join(hostInitializationTestDirectory(), `crdd-operation-${fault}-`),
    );
    const originalOpenSync = fs.openSync;
    const originalFstatSync = fs.fstatSync;
    const originalMkdirSync = fs.mkdirSync;
    const originalLstatSync = fs.lstatSync;
    const mutableFs = fs as unknown as {
      openSync: typeof fs.openSync;
      fstatSync: typeof fs.fstatSync;
      mkdirSync: typeof fs.mkdirSync;
      lstatSync: typeof fs.lstatSync;
    };
    const temporaryHandles = new Set<number>();
    let rootCreated = false;
    let initialMarkerHandle: number | null = null;
    let reportedRecoveryId: string | null = null;
    try {
      mutableFs.openSync = ((target: fs.PathLike, ...args: unknown[]) => {
        const handle = originalOpenSync(
          target,
          ...(args as Parameters<typeof fs.openSync> extends [
            unknown,
            ...infer R,
          ]
            ? R
            : never),
        );
        const text = String(target);
        if (/host-[a-f0-9]{64}\.json$/u.test(text))
          initialMarkerHandle = handle;
        if (text.endsWith(".tmp")) temporaryHandles.add(handle);
        return handle;
      }) as typeof fs.openSync;
      mutableFs.fstatSync = ((handle: number, options?: unknown) => {
        if (
          (fault === "initial_marker_identity" &&
            handle === initialMarkerHandle) ||
          (fault === "host_only_temporary_identity" &&
            temporaryHandles.has(handle))
        )
          throw Object.assign(
            new Error("fixture_identity_observation_unknown"),
            {
              code: "EACCES",
            },
          );
        return originalFstatSync(handle, options as never);
      }) as typeof fs.fstatSync;
      mutableFs.mkdirSync = ((target: fs.PathLike, options?: unknown) => {
        const result = originalMkdirSync(target, options as never);
        if (
          path.basename(String(target)).startsWith("crdd-coordinator-doctor-")
        )
          rootCreated = true;
        return result;
      }) as typeof fs.mkdirSync;
      mutableFs.lstatSync = ((target: fs.PathLike, options?: unknown) => {
        if (
          fault === "root_identity" &&
          rootCreated &&
          path.basename(String(target)).startsWith("crdd-coordinator-doctor-")
        )
          throw Object.assign(new Error("fixture_root_observation_unknown"), {
            code: "EACCES",
          });
        return originalLstatSync(target, options as never);
      }) as typeof fs.lstatSync;
      assert.throws(
        () => createOwnedOperationDirectories(parent),
        (error) => {
          const classified =
            classifyOwnedOperationDirectoryCreationFailure(error);
          assert.ok(classified);
          assert.equal(classified.cleanupConfirmed, false);
          assert.equal(classified.manualRecoveryRequired, true);
          reportedRecoveryId = classified.hostRecoveryId;
          return true;
        },
      );
    } finally {
      mutableFs.openSync = originalOpenSync;
      mutableFs.fstatSync = originalFstatSync;
      mutableFs.mkdirSync = originalMkdirSync;
      mutableFs.lstatSync = originalLstatSync;
    }
    const recoveryDirectory = path.join(parent, "crdd-coordinator-recovery-v1");
    assert.equal(fs.readdirSync(recoveryDirectory).length > 0, true);
    if (fault === "initial_marker_identity") {
      assert.equal(reportedRecoveryId, null);
    } else {
      assert.match(reportedRecoveryId ?? "", /^host\./u);
      const parsed = parseHostRecoveryToken(reportedRecoveryId);
      assert.ok(parsed);
      const marker = path.join(
        recoveryDirectory,
        `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`,
      );
      const serialized = fs.readFileSync(marker, "utf8");
      const loaded = loadHostRecoveryRecordByToken(
        reportedRecoveryId,
        path.join(parent, parsed.rootName),
      );
      assert.equal(loaded.serialized, serialized);
      assert.deepEqual(loaded.parsed, parsed);
      assert.equal(
        createHash("sha256").update(serialized).digest("hex"),
        parsed.recordHash,
      );
      assert.equal(
        (JSON.parse(serialized) as { rootName: string }).rootName,
        parsed.rootName,
      );
    }
    if (fault !== "initial_marker_identity")
      assert.equal(
        fs
          .readdirSync(parent)
          .some((name) => name.startsWith("crdd-coordinator-doctor-")),
        true,
      );
    if (fault === "host_only_temporary_identity")
      assert.equal(
        fs.readdirSync(recoveryDirectory).some((name) => name.endsWith(".tmp")),
        true,
      );
    fs.rmSync(parent, { recursive: true, force: false });
    assertHostInitializationFixtureAbsent(parent);
  };

  runFault("initial_marker_identity");
  runFault("root_identity");
  runFault("host_only_temporary_identity");
});

/**
 * Host Recovery recordのrename後観測失敗は実在するsuccessor IDだけを返すを検証する。
 *
 * @responsibility Host Recovery recordのrename後観測失敗は実在するsuccessor IDだけを返すの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Recovery recordのrename後観測失敗は実在するsuccessor IDだけを返すの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Windows: Host Recovery recordのrename後観測失敗は実在するsuccessor IDだけを返す", () => {
  const parent = fs.mkdtempSync(
    path.join(
      hostInitializationTestDirectory(),
      "crdd-operation-rename-observation-",
    ),
  );
  const originalRenameSync = fs.renameSync;
  const mutableFs = fs as unknown as { renameSync: typeof fs.renameSync };
  let renamedThenFailed = false;
  try {
    mutableFs.renameSync = ((oldPath: fs.PathLike, newPath: fs.PathLike) => {
      originalRenameSync(oldPath, newPath);
      if (
        String(oldPath).endsWith(".tmp") &&
        /host-[a-f0-9]{64}\.json$/u.test(String(newPath))
      ) {
        renamedThenFailed = true;
        throw new Error("fixture_post_rename_observation_unknown");
      }
    }) as typeof fs.renameSync;
    assert.throws(
      () => createOwnedOperationDirectories(parent),
      (error) => {
        const classified =
          classifyOwnedOperationDirectoryCreationFailure(error);
        assert.ok(classified);
        assert.equal(classified.cleanupConfirmed, false);
        assert.equal(classified.manualRecoveryRequired, true);
        assert.match(classified.hostRecoveryId ?? "", /^host\./u);
        const parsed = parseHostRecoveryToken(classified.hostRecoveryId);
        assert.ok(parsed);
        const marker = path.join(
          parent,
          "crdd-coordinator-recovery-v1",
          `host-${createHash("sha256").update(parsed.nonce).digest("hex")}.json`,
        );
        const serialized = fs.readFileSync(marker, "utf8");
        assert.equal(
          createHash("sha256").update(serialized).digest("hex"),
          parsed.recordHash,
        );
        assert.equal(
          (JSON.parse(serialized) as { state: string }).state,
          "host_only",
        );
        return true;
      },
    );
    assert.equal(renamedThenFailed, true);
  } finally {
    mutableFs.renameSync = originalRenameSync;
    fs.rmSync(parent, { recursive: true, force: false });
  }
  assertHostInitializationFixtureAbsent(parent);
});

/**
 * Host Recovery recordが同一bytesの別identityへ置換された場合はIDを返さないを検証する。
 *
 * @responsibility Host Recovery recordが同一bytesの別identityへ置換された場合はIDを返さないの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Host Recovery recordが同一bytesの別identityへ置換された場合はIDを返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Windows: Host Recovery recordが同一bytesの別identityへ置換された場合はIDを返さない", () => {
  const parent = fs.mkdtempSync(
    path.join(
      hostInitializationTestDirectory(),
      "crdd-operation-rename-replacement-",
    ),
  );
  const originalRenameSync = fs.renameSync;
  const mutableFs = fs as unknown as { renameSync: typeof fs.renameSync };
  let replacementIssued = false;
  try {
    mutableFs.renameSync = ((oldPath: fs.PathLike, newPath: fs.PathLike) => {
      originalRenameSync(oldPath, newPath);
      if (
        !replacementIssued &&
        String(oldPath).endsWith(".tmp") &&
        /host-[a-f0-9]{64}\.json$/u.test(String(newPath))
      ) {
        replacementIssued = true;
        const serialized = fs.readFileSync(newPath, "utf8");
        const replacement = `${String(newPath)}.replacement`;
        fs.writeFileSync(replacement, serialized, { mode: 0o600 });
        originalRenameSync(replacement, newPath);
        throw new Error("fixture_post_rename_identity_replaced");
      }
    }) as typeof fs.renameSync;
    assert.throws(
      () => createOwnedOperationDirectories(parent),
      (error) => {
        const classified =
          classifyOwnedOperationDirectoryCreationFailure(error);
        assert.ok(classified);
        assert.equal(classified.cleanupConfirmed, false);
        assert.equal(classified.manualRecoveryRequired, true);
        assert.equal(classified.hostRecoveryId, null);
        return true;
      },
    );
    assert.equal(replacementIssued, true);
  } finally {
    mutableFs.renameSync = originalRenameSync;
    fs.rmSync(parent, { recursive: true, force: false });
  }
  assertHostInitializationFixtureAbsent(parent);
});

/**
 * outer rollbackは現在のinitial markerを再検証できないとcached IDを返さないを検証する。
 *
 * @responsibility outer rollbackは現在のinitial markerを再検証できないとcached IDを返さないの合否判定を所有する。
 * @trace PRL-IT-013
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus outer rollbackは現在のinitial markerを再検証できないとcached IDを返さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary PRL-IT-013=Direct Boundary: coordinator Test Source→対象契約
 */
test("Host Windows: outer rollbackは現在のinitial markerを再検証できないとcached IDを返さない", () => {
  for (const fault of [
    "delete_then_throw",
    "identity_replacement",
    "marker_observation_unknown",
  ] as const) {
    const parent = fs.mkdtempSync(
      path.join(
        hostInitializationTestDirectory(),
        `crdd-operation-outer-${fault}-`,
      ),
    );
    const originalMkdirSync = fs.mkdirSync;
    const originalRmSync = fs.rmSync;
    const originalLstatSync = fs.lstatSync;
    const originalRenameSync = fs.renameSync;
    const mutableFs = fs as unknown as {
      mkdirSync: typeof fs.mkdirSync;
      rmSync: typeof fs.rmSync;
      lstatSync: typeof fs.lstatSync;
    };
    let isRootCreationRejected = false;
    let markerFaultIssued = false;
    try {
      mutableFs.mkdirSync = ((target: fs.PathLike, options?: unknown) => {
        if (
          path.basename(String(target)).startsWith("crdd-coordinator-doctor-")
        ) {
          isRootCreationRejected = true;
          throw new Error("fixture_root_creation_rejected");
        }
        return originalMkdirSync(target, options as never);
      }) as typeof fs.mkdirSync;
      mutableFs.rmSync = ((target: fs.PathLike, options?: unknown) => {
        if (
          fault === "delete_then_throw" &&
          isRootCreationRejected &&
          /host-[a-f0-9]{64}\.json$/u.test(String(target))
        ) {
          originalRmSync(target, options as never);
          markerFaultIssued = true;
          throw new Error("fixture_marker_delete_observation_unknown");
        }
        return originalRmSync(target, options as never);
      }) as typeof fs.rmSync;
      mutableFs.lstatSync = ((target: fs.PathLike, options?: unknown) => {
        if (
          isRootCreationRejected &&
          /host-[a-f0-9]{64}\.json$/u.test(String(target))
        ) {
          if (fault === "marker_observation_unknown") {
            markerFaultIssued = true;
            throw Object.assign(
              new Error("fixture_marker_observation_unknown"),
              {
                code: "EACCES",
              },
            );
          }
          if (fault === "identity_replacement" && !markerFaultIssued) {
            markerFaultIssued = true;
            const serialized = fs.readFileSync(target, "utf8");
            const replacement = `${String(target)}.replacement`;
            fs.writeFileSync(replacement, serialized, { mode: 0o600 });
            originalRenameSync(replacement, target);
          }
        }
        return originalLstatSync(target, options as never);
      }) as typeof fs.lstatSync;
      assert.throws(
        () => createOwnedOperationDirectories(parent),
        (error) => {
          const classified =
            classifyOwnedOperationDirectoryCreationFailure(error);
          assert.ok(classified);
          assert.equal(classified.cleanupConfirmed, false);
          assert.equal(classified.manualRecoveryRequired, true);
          assert.equal(classified.hostRecoveryId, null, fault);
          return true;
        },
      );
      assert.equal(markerFaultIssued, true);
    } finally {
      mutableFs.mkdirSync = originalMkdirSync;
      mutableFs.rmSync = originalRmSync;
      mutableFs.lstatSync = originalLstatSync;
      fs.rmSync(parent, { recursive: true, force: false });
    }
    assertHostInitializationFixtureAbsent(parent);
  }
});

/**
 * 自己生成した親のHost記録を刺激し、全試験物を回収する。
 * @responsibility 元Rootとtokenの相関、保存親の固定と記録の保全を検証する。
 * @trace ERB-IT-003
 * @precondition Repository-local tests Rootを既存resolverで取得する。
 * @stimulus 非既定親、Root削除、別名／親欠落、Hash／Root名改変、marker／親linkを与える。
 * @observation Reader返却Root、固定例外、元本文と残存。
 * @oracle 元Rootだけ正常、Root不存在でもmarker読取り可能、不正値は探索・書込み0。
 * @cleanup 自己生成fixtureをfinallyで削除し、既存のtests内容は変更しない。
 * @boundary ERB-IT-003=Direct Boundary: 明示RootのReader→実Filesystem。
 */
test("Host Windows: Host記録は明示Rootの親へ固定しRoot不存在と読取不能を分ける", () => {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "host_record_test",
  );
  const parent = fs.mkdtempSync(path.join(area.directory, "host-record-"));
  const nonce = randomUUID(),
    name = `crdd-coordinator-doctor-${nonce}`;
  const root = path.join(parent, name);
  const directory = path.join(parent, "crdd-coordinator-recovery-v1");
  const marker = path.join(
    directory,
    `host-${createHash("sha256").update(nonce).digest("hex")}.json`,
  );
  const serialized = `${JSON.stringify({ schema: "crdd-coordinator-host-recovery/v1", rootName: name, nonce, state: "host_only" })}\n`;
  const token = formatHostRecoveryToken(
    name,
    nonce,
    createHash("sha256").update(serialized).digest("hex"),
  );
  try {
    fs.mkdirSync(root);
    fs.mkdirSync(directory);
    fs.writeFileSync(marker, serialized);
    const loaded = loadHostRecoveryRecordByToken(token, root);
    assert.equal(loaded.parent, parent);
    assert.equal(loaded.marker, marker);
    assert.equal(loaded.serialized, serialized);
    assert.deepEqual(observeHostRecoveryCleanup(token, root), {
      root: "present",
      marker: "present",
      markerPath: marker,
    });
    fs.rmdirSync(root);
    assert.deepEqual(observeHostRecoveryCleanup(token, root), {
      root: "absent",
      marker: "present",
      markerPath: marker,
    });
    assert.equal(
      loadHostRecoveryRecordByToken(token, root).serialized,
      serialized,
    );
    for (const invalid of [
      null,
      undefined,
      name,
      path.join(parent, "crdd-coordinator-doctor-other"),
    ])
      assert.throws(
        () => loadHostRecoveryRecordByToken(token, invalid),
        /host_recovery_root_mismatch/u,
      );
    assert.throws(
      () =>
        loadHostRecoveryRecordByToken(
          token,
          path.join(parent, "missing", name),
        ),
      /ENOENT/u,
    );
    fs.writeFileSync(marker, `${serialized} `);
    assert.throws(
      () => loadHostRecoveryRecordByToken(token, root),
      /host_recovery_record_mismatch/u,
    );
    const wrong = `${JSON.stringify({ schema: "crdd-coordinator-host-recovery/v1", rootName: "crdd-coordinator-doctor-other", nonce })}\n`;
    fs.writeFileSync(marker, wrong);
    const wrongToken = formatHostRecoveryToken(
      name,
      nonce,
      createHash("sha256").update(wrong).digest("hex"),
    );
    assert.throws(
      () => loadHostRecoveryRecordByToken(wrongToken, root),
      /host_recovery_record_mismatch/u,
    );
    fs.writeFileSync(marker, serialized);
    const original = path.join(parent, "original-marker.json");
    fs.renameSync(marker, original);
    fs.symlinkSync(original, marker, "file");
    assert.throws(
      () => loadHostRecoveryRecordByToken(token, root),
      /host_recovery_record_replaced/u,
    );
    fs.unlinkSync(marker);
    fs.renameSync(original, marker);
    const link = path.join(parent, "linked-parent");
    fs.symlinkSync(parent, link, "junction");
    assert.throws(
      () => loadHostRecoveryRecordByToken(token, path.join(link, name)),
      /host_recovery_parent_untrusted/u,
    );
    fs.rmdirSync(link);
    assert.equal(fs.readFileSync(marker, "utf8"), serialized);
    assert.equal(
      observeHostRecoveryCleanup(token, path.join(parent, "other")).root,
      "unknown",
    );
    fs.unlinkSync(marker);
    assert.deepEqual(observeHostRecoveryCleanup(token, root), {
      root: "absent",
      marker: "absent",
      markerPath: marker,
    });
    const lstat = fs.lstatSync;
    try {
      Reflect.set(fs, "lstatSync", ((
        target: fs.PathLike,
        ...args: unknown[]
      ) => {
        if (target === root)
          throw Object.assign(new Error("observation unavailable"), {
            code: "EACCES",
          });
        return Reflect.apply(lstat, fs, [target, ...args]);
      }) as typeof fs.lstatSync);
      assert.equal(observeHostRecoveryCleanup(token, root).root, "unknown");
      assert.equal(observeHostRecoveryCleanup(token, root).marker, "unknown");
    } finally {
      Reflect.set(fs, "lstatSync", lstat);
    }
  } finally {
    fs.rmSync(parent, { recursive: true });
    assert.equal(fs.existsSync(parent), false);
    if (fs.readdirSync(area.directory).length === 0)
      fs.rmdirSync(area.directory);
  }
});

/**
 * 非既定親の実creator・Reader・世代排他・清掃を同じRootへ接続する。
 * @responsibility 元Owner終了後のHost再入場と物理清掃を確認する。
 * @trace ERB-IT-003
 * @precondition Repository-local親、実Host所有領域と既存OS排他を使用する。
 * @stimulus 現Owner生存中の再入場拒否、Owner解放後のexact再入場を実行する。
 * @observation marker本文、再入場結果、元Rootとmarkerの不存在。
 * @oracle 生存中はblocked・本文不変、Owner終了後は同Rootだけrecovered、残存0。
 * @cleanup 生存Ownerは既存通常清掃で解放し、自己生成親だけを最後に削除する。
 * @boundary ERB-IT-003=Direct Boundary: creator→実世代排他／記録→実Filesystem清掃。
 */
test("Host Windows: 非既定親のHostは元Owner終了後だけ同Rootで回復する", async () => {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "host_record_test",
  );
  const parent = fs.mkdtempSync(path.join(area.directory, "host-actual-"));
  const owned = createOwnedOperationDirectories(parent);
  let abandoned = false;
  try {
    const management = createOwnedOperationManagementCapability(
      createOwnedOperationContextCapability(owned),
      createOwnedMountCapability(owned),
    );
    const loaded = loadHostRecoveryRecordByToken(
      owned.hostRecoveryId,
      owned.root,
    );
    assert.equal(loaded.parent, parent);
    assert.equal(
      await activateOwnedHostOperationGenerationLock(management),
      "activated",
    );
    const refused = recoverOwnedOperationDirectories(
      owned.hostRecoveryId,
      null,
      owned.root,
    );
    assert.equal(refused.status, "blocked");
    assert.equal(fs.readFileSync(loaded.marker, "utf8"), loaded.serialized);
    assert.equal(
      await abandonOwnedHostOperationGenerationLock(management),
      true,
    );
    abandoned = true;
    const recovered = recoverOwnedOperationDirectories(
      owned.hostRecoveryId,
      null,
      owned.root,
    );
    assert.equal(recovered.status, "recovered");
    assert.equal(fs.existsSync(owned.root), false);
    assert.equal(fs.existsSync(loaded.marker), false);
  } finally {
    if (!abandoned) cleanupOwnedOperationDirectories(owned);
    fs.rmSync(parent, { recursive: true });
    assert.equal(fs.existsSync(parent), false);
    if (fs.readdirSync(area.directory).length === 0)
      fs.rmdirSync(area.directory);
  }
});

/**
 * Host回復世代から記録済みmanagement実体だけを借用する。
 * @responsibility 旧management復元なしで元Root・token・子実体の現在性を反証する。
 * @trace ERB-IT-003
 * @precondition 自己生成Hostと実Windows世代排他を使い、Docker要求は発行しない。
 * @stimulus started世代、コピー・旧token、marker改変、management差替えと世代解放を与える。
 * @observation 借用値、再確認false、元markerと隣接試験物の保全。
 * @oracle genuine保持中の同じ実体だけ借用し、欠測・差替え・解放後はnull／false。
 * @cleanup 全世代排他を解放した後、自己生成親だけを削除する。
 * @boundary ERB-IT-003=Direct Boundary: 回復世代→実marker／管理Directory。
 */
test("Host Windows: 管理領域の借用は同じstarted世代と実体を要求する", async () => {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "host_record_test",
  );
  const parent = fs.mkdtempSync(path.join(area.directory, "host-borrow-"));
  const owned = createOwnedOperationDirectories(parent);
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    createOwnedMountCapability(owned),
  );
  let generation: object | null = null;
  let abandoned = false;
  try {
    const beforeToken = owned.hostRecoveryId;
    assert.equal(
      await activateOwnedHostOperationGenerationLock(management),
      "activated",
    );
    const token = beginOwnedDockerSubmissionRecovery(
      management,
      verifyOwnedOperationManagementCapability(management).operationId,
    );
    assert.equal(
      await abandonOwnedHostOperationGenerationLock(management),
      true,
    );
    abandoned = true;
    generation = acquireHostOperationRecoveryGeneration(token, owned.root);
    assert.ok(generation);
    assert.equal(borrowHostRecoveryManagementDirectory(token, {}), null);
    assert.equal(
      borrowHostRecoveryManagementDirectory(beforeToken, generation),
      null,
    );
    const borrowed = borrowHostRecoveryManagementDirectory(token, generation);
    assert.ok(borrowed);
    assert.equal(borrowed.directory, path.join(owned.root, "management"));
    assert.equal(borrowed.assertCurrent(), true);
    const loaded = loadHostRecoveryRecordByToken(token, owned.root);
    fs.writeFileSync(loaded.marker, `${loaded.serialized} `);
    assert.equal(borrowed.assertCurrent(), false);
    assert.equal(
      borrowHostRecoveryManagementDirectory(token, generation),
      null,
    );
    fs.writeFileSync(loaded.marker, loaded.serialized);
    const retained = path.join(owned.root, "retained-management");
    fs.renameSync(borrowed.directory, retained);
    fs.mkdirSync(borrowed.directory);
    assert.equal(borrowed.assertCurrent(), false);
    assert.equal(
      borrowHostRecoveryManagementDirectory(token, generation),
      null,
    );
    fs.rmdirSync(borrowed.directory);
    fs.renameSync(retained, borrowed.directory);
    assert.equal(borrowed.assertCurrent(), true);
    assert.equal(releaseHostOperationRecoveryGeneration(generation), true);
    generation = null;
    assert.equal(borrowed.assertCurrent(), false);
    assert.equal(fs.readFileSync(loaded.marker, "utf8"), loaded.serialized);
  } finally {
    if (generation) releaseHostOperationRecoveryGeneration(generation);
    if (!abandoned) cleanupOwnedOperationDirectories(owned);
    assert.equal(path.dirname(parent), area.directory);
    fs.rmSync(parent, { recursive: true });
    assert.equal(fs.existsSync(parent), false);
    if (fs.readdirSync(area.directory).length === 0)
      fs.rmdirSync(area.directory);
  }
});

/**
 * 事前計算したtokenで別ProcessのHost記録更新・再取得を確認する。
 * @responsibility 同世代のmarker更新、旧token拒否と新tokenの再確認・清掃を実Filesystemで検証する。
 * @trace ERB-IT-003
 * @precondition 自己生成Hostと実Windows世代排他を使用する。Docker資源不存在は合成前提である。
 * @stimulus Kernel排他だけ解放し旧Operation登録を保持した同Processの拒否と、別Processのabsent遷移後の世代再取得を確認する。
 * @observation 全marker本文、token Hash、旧参照拒否、新世代保持、Rootとmarker不存在。
 * @oracle 同Processの遷移は拒否・本文不変。別Processではexpected本文だけを採用し、旧token拒否・再遷移なしで同Rootを回収する。
 * @cleanup 全世代排他を解放し、自己生成親だけを削除する。
 * @boundary ERB-IT-003=Direct Boundary: Host遷移→実marker／世代排他／Filesystem清掃。実Docker回復は対象外。
 */
test("Host Windows: absent遷移の再入場は事前計算したexact tokenへ固定する", async () => {
  const area = requireReadyRepositoryRuntimeDataArea(
    ensureRepositoryRuntimeDataAreaFromWorkingDirectory(
      import.meta.dirname,
      "tests",
    ),
    "host_record_test",
  );
  const parent = fs.mkdtempSync(path.join(area.directory, "host-transition-"));
  const owned = createOwnedOperationDirectories(parent);
  const management = createOwnedOperationManagementCapability(
    createOwnedOperationContextCapability(owned),
    createOwnedMountCapability(owned),
  );
  let abandoned = false;
  try {
    assert.equal(
      await activateOwnedHostOperationGenerationLock(management),
      "activated",
    );
    const token = beginOwnedDockerSubmissionRecovery(
      management,
      verifyOwnedOperationManagementCapability(management).operationId,
    );
    const before = loadHostRecoveryRecordByToken(token, owned.root);
    const expectedBytes = `${JSON.stringify({ ...before.record, state: "docker_absent_confirmed" })}\n`;
    const expectedToken = formatHostRecoveryToken(
      before.parsed.rootName,
      before.parsed.nonce,
      createHash("sha256").update(expectedBytes).digest("hex"),
    );
    assert.equal(
      await abandonOwnedHostOperationGenerationLock(management),
      true,
    );
    abandoned = true;
    assert.equal(fs.readFileSync(before.marker, "utf8"), before.serialized);
    const sameProcessGeneration = acquireHostOperationRecoveryGeneration(
      token,
      owned.root,
    );
    assert.ok(sameProcessGeneration);
    try {
      assert.throws(
        () =>
          confirmOwnedDockerAbsenceForRecovery(token, sameProcessGeneration),
        /host_recovery_generation_active/u,
      );
      assert.equal(fs.readFileSync(before.marker, "utf8"), before.serialized);
      assert.equal(
        loadHostRecoveryRecordByToken(token, owned.root).serialized,
        before.serialized,
      );
    } finally {
      assert.equal(
        releaseHostOperationRecoveryGeneration(sameProcessGeneration),
        true,
      );
    }
    const worker = spawnSync(
      process.execPath,
      [
        "-e",
        `(async () => {
        const assert = (await import('node:assert/strict')).default;
        const fs = (await import('node:fs')).default;
        const [ownerUrl, recordUrl, root, oldToken, expectedToken, expectedBytes] = process.argv.slice(1);
        const owner = await import(ownerUrl);
        const record = await import(recordUrl);
        let generation = null;
        try {
          assert.throws(() => owner.confirmOwnedDockerAbsenceForRecovery(oldToken, {}));
          generation = owner.acquireHostOperationRecoveryGeneration(oldToken, root);
          assert.ok(generation);
          const before = record.loadHostRecoveryRecordByToken(oldToken, root);
          assert.equal(owner.confirmOwnedDockerAbsenceForRecovery(oldToken, generation), expectedToken);
          const after = record.loadHostRecoveryRecordByToken(expectedToken, root);
          assert.equal(after.serialized, expectedBytes);
          assert.equal(after.marker, before.marker);
          assert.equal(after.parsed.nonce, before.parsed.nonce);
          owner.verifyHostOperationRecoveryGeneration(generation, root, before.parsed.nonce);
          assert.throws(() => record.loadHostRecoveryRecordByToken(oldToken, root));
          assert.throws(() => owner.confirmOwnedDockerAbsenceForRecovery(expectedToken, generation));
          assert.equal(fs.readFileSync(after.marker, 'utf8'), expectedBytes);
          assert.equal(owner.releaseHostOperationRecoveryGeneration(generation), true);
          generation = null;
          assert.equal(owner.acquireHostOperationRecoveryGeneration(oldToken, root), null);
          generation = owner.acquireHostOperationRecoveryGeneration(expectedToken, root);
          assert.ok(generation);
          assert.equal(fs.readFileSync(after.marker, 'utf8'), expectedBytes);
          assert.equal(owner.recoverOwnedOperationDirectories(expectedToken, generation, root).status, 'recovered');
          assert.equal(fs.existsSync(root), false);
          assert.equal(fs.existsSync(after.marker), false);
          assert.equal(owner.releaseHostOperationRecoveryGeneration(generation), true);
          generation = null;
          process.stdout.write('host_transition_verified');
        } finally {
          if (generation) assert.equal(owner.releaseHostOperationRecoveryGeneration(generation), true);
        }
      })().catch(() => { process.stderr.write('host_transition_unconfirmed'); process.exitCode = 1; });`,
        pathToFileURL(
          path.resolve(import.meta.dirname, "../../src/execution/operation.ts"),
        ).href,
        pathToFileURL(
          path.resolve(import.meta.dirname, "../../src/execution/recovery.ts"),
        ).href,
        owned.root,
        token,
        expectedToken,
        expectedBytes,
      ],
      { encoding: "utf8", timeout: 20_000, windowsHide: true },
    );
    assert.equal(worker.error, undefined);
    assert.equal(worker.signal, null);
    assert.equal(worker.status, 0, worker.stderr);
    assert.equal(worker.stdout, "host_transition_verified");
    assert.equal(fs.existsSync(owned.root), false);
    assert.equal(fs.existsSync(before.marker), false);
  } finally {
    if (!abandoned) cleanupOwnedOperationDirectories(owned);
    assert.equal(path.dirname(parent), area.directory);
    fs.rmSync(parent, { recursive: true });
    assert.equal(fs.existsSync(parent), false);
    if (fs.readdirSync(area.directory).length === 0)
      fs.rmdirSync(area.directory);
  }
});

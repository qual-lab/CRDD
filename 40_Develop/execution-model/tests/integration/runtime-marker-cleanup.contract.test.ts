/**
 * 出版済み現在状態のmarker単独清掃を固定保存境界で反証する。
 * @packageDocumentation
 * @responsibility 正規本文保全、処置前拒否、処置後不明と排他解放を個別に確認する。
 * @trace ERB-IT-014
 * @trace PRL-IT-011
 * @level IT
 * @scope 本番清掃本文と既存Root／Kernel／Filesystem primitiveの固定模擬。
 * @boundary ERB-IT-014=Direct Boundary: 現在保存Owner→保存marker。
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runInNewContext } from "node:vm";
import type { Lock } from "../../../lock/src/index.ts";
import { getRepository } from "../../../version-control/src/index.ts";
import { completeStatePublication } from "../../src/state/crud.ts";
import {
  decodeStateSnapshot,
  EXECUTION_STATE_SCHEMA,
  encodeStateValue,
} from "../../src/state/validation.ts";
import {
  acquireExecutionStateLock,
  acquireStorageOwner,
  observeExecutionRecoveryRepository,
  storageLockFailure,
} from "../../src/storage/lock.ts";
import {
  ensureRepositoryExecutionDataAreaFromWorkingDirectory,
  readStorageSnapshotOwned,
  requireReadyRepositoryExecutionDataArea,
  sameStableFileIdentity,
} from "../../src/storage/store.ts";
import { createRepositoryTestDirectory } from "../support/repository-test-directory.ts";
import { sourceDeclaration } from "../support/source-declaration.ts";

/**
 * markerだけの清掃を、保存本文・実体・取得／解放の全停止点で確認する。
 * @responsibility 同じ保存物でも置換を拒否し、既知の削除を後続失敗で消さない。
 * @trace ERB-IT-014
 * @precondition 本番関数本文を型除去し、同じ固定保存Ownerへ結合する。
 * @stimulus 正常／不存在、pending、不正、link、置換、処置前後例外と排他失敗。
 * @observation unlink回数、保存物全文、処置・保全・解放の各field。
 * @oracle 正規currentと同じRepo markerだけ一回処置し、例外を成功・Task完了へ畳まない。
 * @cleanup N/A: 模擬Filesystemだけを使い外部資源を生成しない。
 * @boundary ERB-IT-014=Direct Boundary: 保存marker清掃→既存primitive。
 */
test("現在保存marker: exact処置・全文保全・停止と解放の相関", () => {
  const source = fs.readFileSync(
    new URL("../../src/state/crud.ts", import.meta.url),
    "utf8",
  );
  const body = sourceDeclaration(source, "completeStatePublication");
  for (const scenario of [
    "normal",
    "no_marker",
    "no_history",
    "root_invalid",
    "root_changed",
    "area_absent",
    "area_unknown",
    "boundary_changed",
    "current_absent",
    "current_invalid",
    "history_invalid",
    "marker_foreign",
    "pending_state",
    "pending_history",
    "unknown_file",
    "state_link",
    "history_link",
    "marker_link",
    "state_hardlink",
    "history_hardlink",
    "marker_hardlink",
    "identity_changed",
    "bytes_changed",
    "lock_unavailable",
    "lock_write",
    "lock_close",
    "lock_throw",
    "lock_dead",
    "release_false",
    "release_throw",
    "unlink_before_throw",
    "unlink_after_throw",
    "post_observation_unknown",
    "post_identity_changed",
  ] as const) {
    const root = path.resolve("marker-fixture"),
      directory = path.join(root, ".crdd", "domain-model");
    const binding = "a".repeat(64),
      capability = Object.freeze({});
    const stateBytes = Buffer.from(
      `${encodeStateValue({ schema: EXECUTION_STATE_SCHEMA, revision: 1, repositoryBindingId: null, intakeEpoch: null, intakeBindings: [], projects: [], managedExecutions: [], workspaces: [], queueEntries: [], leaseEvidence: [], leaseIntents: [], results: [], historyPending: [], decisions: [], blockers: [], previous: null, repositoryBinding: binding, operations: [], unresolvedRecoveries: [] })}\n`,
    );
    const files = new Map<string, Buffer>([
      [
        "state.json",
        scenario === "current_invalid" ? Buffer.from("invalid") : stateBytes,
      ],
      [
        "history.jsonl",
        Buffer.from(scenario === "history_invalid" ? "invalid" : "history"),
      ],
      [
        "state.lock",
        Buffer.from(
          `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: scenario === "marker_foreign" ? "b".repeat(64) : binding })}\n`,
        ),
      ],
    ]);
    if (scenario === "no_marker") files.delete("state.lock");
    if (scenario === "no_history") files.delete("history.jsonl");
    if (scenario === "current_absent") files.delete("state.json");
    if (scenario === "pending_state")
      files.set("state.pending.json", Buffer.from("pending"));
    if (scenario === "pending_history")
      files.set("history.pending.jsonl", Buffer.from("pending"));
    if (scenario === "unknown_file")
      files.set("unknown", Buffer.from("unknown"));
    const before = new Map(files),
      reads = new Map<string, number>();
    let areaCalls = 0,
      validations = 0,
      unlinks = 0,
      releases = 0,
      removed = false;
    /**
     * 模擬Fileの実体とlink観測を固定する。
     * @responsibility 読取り前後の同bytes別実体とlink差を生成する。
     * @trace ERB-IT-014
     * @precondition nameは模擬File集合への局所参照。
     * @stimulus 同じFile名と故障点を渡す。
     * @observation Filesystem primitive相当の固定metadataを返す。
     * @oracle 由来不明・欠測はENOENT、明示置換は異なるinodeとなる。
     * @cleanup N/A: 外部資源を持たない。
     * @boundary ERB-IT-014=Direct Boundary: 模擬File→実体比較。
     */
    const metadata = (name: string) => {
      const bytes = files.get(name);
      if (!bytes) throw Object.assign(new Error("absent"), { code: "ENOENT" });
      const subject =
        name === "state.json"
          ? "state"
          : name === "state.lock"
            ? "marker"
            : "history";
      const changed =
        name === "state.json" &&
        ((scenario === "identity_changed" && (reads.get(name) ?? 0) >= 2) ||
          (scenario === "post_identity_changed" && removed));
      return {
        dev: 1n,
        ino: BigInt(
          (name === "state.json" ? 1 : name === "state.lock" ? 2 : 3) +
            (changed ? 20 : 0),
        ),
        birthtimeNs: 1n,
        ctimeNs: 1n,
        mtimeNs: 1n,
        size: BigInt(bytes.length),
        mode: 0o100600n,
        nlink: scenario === `${subject}_hardlink` ? 2n : 1n,
        isFile: () => true,
        isSymbolicLink: () => scenario === `${subject}_link`,
      };
    };
    const result = runInNewContext(
      `${body}; completeStatePublication(capability)`,
      {
        capability,
        Buffer,
        Map,
        Object,
        JSON,
        path,
        sameStableFileIdentity,
        decodeStateSnapshot: decodeStateSnapshot,
        decodeHistoryRows: (bytes: Buffer) =>
          bytes.toString() === "history" ? [] : null,
        observeExecutionRecoveryRepository: (input: unknown) => {
          assert.equal(input, capability);
          return scenario === "root_invalid"
            ? null
            : {
                repositoryRoot: root,
                repositoryBinding: binding,
                revalidate() {
                  validations++;
                  return !(scenario === "root_changed" && validations >= 3);
                },
              };
        },
        storageLockFailure,
        acquireExecutionStateLock: (input: string) => {
          assert.equal(input, binding);
          if (scenario === "lock_throw") throw new Error("fixture");
          if (
            ["lock_unavailable", "lock_write", "lock_close"].includes(scenario)
          )
            return {
              status: "blocked",
              reason:
                scenario === "lock_unavailable"
                  ? "lock_exists"
                  : "lock_initialization_failed",
              reference: null,
              cleanupConfirmed: scenario === "lock_unavailable",
              descriptorClosed: scenario !== "lock_close",
            };
          return {
            status: "acquired",
            lock: {
              assertLive: () => scenario !== "lock_dead",
              release() {
                releases++;
                if (scenario === "release_throw") throw new Error("fixture");
                return scenario !== "release_false";
              },
            },
          };
        },
        getRepository: (input: string) => {
          assert.equal(input, root);
          return { status: "completed", capability };
        },
        observeRepositoryExecutionDataArea: () => {
          areaCalls++;
          if (scenario === "area_absent") return { status: "not_observed" };
          if (
            scenario === "area_unknown" ||
            (scenario === "post_observation_unknown" && removed)
          )
            return { status: "blocked" };
          return {
            status: "ready",
            repositoryRoot: root,
            directory,
            boundaryIdentity:
              scenario === "boundary_changed" && areaCalls >= 3
                ? "changed"
                : "same",
          };
        },
        readStableFileSnapshot: (file: string) => {
          const name = path.basename(file),
            count = (reads.get(name) ?? 0) + 1;
          reads.set(name, count);
          const bytes = files.get(name);
          assert.ok(bytes);
          return {
            bytes:
              scenario === "bytes_changed" &&
              name === "state.json" &&
              count >= 3
                ? Buffer.concat([bytes, Buffer.from(" ")])
                : Buffer.from(bytes),
            identity: metadata(name),
          };
        },
        fs: {
          readdirSync: (input: string) => {
            assert.equal(input, directory);
            return [...files.keys()];
          },
          lstatSync: (file: string) => metadata(path.basename(file)),
          unlinkSync: (file: string) => {
            assert.equal(file, path.join(directory, "state.lock"));
            unlinks++;
            if (scenario === "unlink_before_throw") throw new Error("fixture");
            files.delete("state.lock");
            removed = true;
            if (scenario === "unlink_after_throw") throw new Error("fixture");
          },
        },
      },
    ) as {
      status: string;
      markerRemoved: boolean;
      markerAbsentConfirmed: boolean;
      storageConfirmed: boolean;
      filesystemEffectIssued: boolean;
      lockReleased: boolean;
      reason: string;
      cleanupReason: string | null;
    };
    const successful = ["normal", "no_marker", "no_history"].includes(scenario);
    const afterUnlink =
      (successful && scenario !== "no_marker") ||
      [
        "release_false",
        "release_throw",
        "unlink_after_throw",
        "post_observation_unknown",
        "post_identity_changed",
      ].includes(scenario);
    const issued = afterUnlink || scenario === "unlink_before_throw";
    const storageConfirmed =
      successful || ["release_false", "release_throw"].includes(scenario);
    const released = ![
      "lock_unavailable",
      "lock_write",
      "lock_close",
      "lock_throw",
      "release_false",
      "release_throw",
    ].includes(scenario);
    const absentConfirmed =
      storageConfirmed || scenario === "unlink_after_throw";
    assert.deepEqual(
      { ...result },
      {
        status: successful ? "completed" : "blocked",
        reason: storageConfirmed
          ? released
            ? scenario === "no_marker"
              ? "coordinator_state_marker_absent"
              : "coordinator_state_marker_cleanup_confirmed"
            : "coordinator_state_lock_release_unconfirmed"
          : scenario === "lock_close"
            ? "coordinator_state_lock_descriptor_close_unconfirmed"
            : scenario === "lock_write"
              ? "coordinator_state_lock_initialization_failed"
              : scenario === "lock_unavailable"
                ? "coordinator_state_lock_unavailable"
                : "coordinator_state_marker_cleanup_unconfirmed",
        markerRemoved: afterUnlink,
        markerAbsentConfirmed: absentConfirmed,
        storageConfirmed,
        filesystemEffectIssued: issued,
        lockReleased: released,
        cleanupReason: released
          ? null
          : "coordinator_state_lock_release_unconfirmed",
      },
      scenario,
    );
    assert.equal(unlinks, issued ? 1 : 0, scenario);
    assert.equal(
      releases,
      [
        "root_invalid",
        "lock_unavailable",
        "lock_write",
        "lock_close",
        "lock_throw",
      ].includes(scenario)
        ? 0
        : 1,
      scenario,
    );
    for (const [name, bytes] of before)
      if (name !== "state.lock")
        assert.deepEqual(files.get(name), bytes, scenario);
    assert.equal(
      files.has("state.lock"),
      before.has("state.lock") && !afterUnlink,
      scenario,
    );
  }
});

/**
 * 実RepositoryとKernel排他で、保存markerだけの処置を確認する。
 * @responsibility 現在SchemaとRootから同じmarkerだけを処置し、記録やTask結果を生成しない。
 * @trace ERB-IT-014
 * @trace PRL-IT-011
 * @precondition 自己生成Repository内だけを使用するWindows Host試験。
 * @stimulus marker不存在／正規／foreign、pending、使用中、処置後例外とhardlink、同Owner反復readと偽造・コピー・解放済みOwner。
 * @observation 実unlink、不存在、保存本文・inode、Kernel競合と解放。
 * @oracle 未確定時は停止、既知の削除は保持、fresh再入場の追加処置0。借用中の再取得・解放0、外側一回解放とstate bytes不変。
 * @cleanup 全spyとKernel排他をfinallyで戻し、自己生成Rootだけを回収する。
 * @boundary ERB-IT-014=Direct Boundary: 保存marker清掃→実Filesystem／Kernel。
 * @boundary PRL-IT-011=Direct Boundary: 保存Owner→同Kernel借用Reader。
 */
test("Host Windows: 現在保存markerだけの実処置と再入場", {
  skip: process.platform !== "win32",
}, () => {
  const ownedDirectory = createRepositoryTestDirectory("current-marker-tests-");
  const area = { directory: ownedDirectory.path };
  const root = fs.mkdtempSync(path.join(area.directory, "current-marker-"));
  const unlink = fs.unlinkSync;
  let held: Lock | null = null;
  try {
    execFileSync("git", ["init", "--quiet", root], { windowsHide: true });
    execFileSync(
      "git",
      [
        "-C",
        root,
        "-c",
        "user.name=CRDD Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--allow-empty",
        "--quiet",
        "-m",
        "fixture",
      ],
      { windowsHide: true },
    );
    const verified = getRepository(root);
    assert.equal(verified.status, "completed");
    assert.ok(verified.capability);
    const repository = observeExecutionRecoveryRepository(verified.capability);
    assert.ok(repository);
    const storage = requireReadyRepositoryExecutionDataArea(
      ensureRepositoryExecutionDataAreaFromWorkingDirectory(
        root,
        "domain-model",
      ),
      "marker_storage",
    );
    const state = path.join(storage.directory, "state.json"),
      marker = path.join(storage.directory, "state.lock"),
      pending = path.join(storage.directory, "state.pending.json");
    const bytes = Buffer.from(
      `${encodeStateValue({ schema: EXECUTION_STATE_SCHEMA, revision: 1, repositoryBindingId: null, intakeEpoch: null, intakeBindings: [], projects: [], managedExecutions: [], workspaces: [], queueEntries: [], leaseEvidence: [], leaseIntents: [], results: [], historyPending: [], decisions: [], blockers: [], previous: null, repositoryBinding: repository.repositoryBinding, operations: [], unresolvedRecoveries: [] })}\n`,
    );
    const markerBytes = Buffer.from(
      `${JSON.stringify({ schema: "crdd-coordinator/state-lock/v1", repositoryBinding: repository.repositoryBinding })}\n`,
    );
    fs.writeFileSync(state, bytes, { flag: "wx" });
    const before = fs.lstatSync(state, { bigint: true });
    const absent = completeStatePublication(verified.capability);
    assert.equal(absent.status, "completed");
    assert.equal(absent.filesystemEffectIssued, false);
    fs.writeFileSync(marker, markerBytes, { flag: "wx" });
    const cleaned = completeStatePublication(verified.capability);
    assert.equal(cleaned.status, "completed");
    assert.equal(cleaned.markerRemoved, true);
    assert.equal(cleaned.storageConfirmed, true);
    assert.equal(cleaned.lockReleased, true);
    assert.throws(() => fs.lstatSync(marker), { code: "ENOENT" });
    const fresh = completeStatePublication(verified.capability);
    assert.equal(fresh.status, "completed");
    assert.equal(fresh.filesystemEffectIssued, false);
    fs.writeFileSync(marker, "foreign", { flag: "wx" });
    assert.equal(
      completeStatePublication(verified.capability).filesystemEffectIssued,
      false,
    );
    assert.equal(fs.readFileSync(marker, "utf8"), "foreign");
    fs.unlinkSync(marker);
    fs.writeFileSync(marker, markerBytes, { flag: "wx" });
    fs.writeFileSync(pending, "pending", { flag: "wx" });
    assert.equal(
      completeStatePublication(verified.capability).status,
      "blocked",
    );
    assert.equal(fs.readFileSync(pending, "utf8"), "pending");
    assert.deepEqual(fs.readFileSync(marker), markerBytes);
    fs.unlinkSync(pending);
    const heldAcquisition = acquireExecutionStateLock(
      repository.repositoryBinding,
      repository.repositoryRoot,
    );
    assert.ok(heldAcquisition.status === "acquired");
    held = heldAcquisition.lock;
    assert.ok(held);
    assert.equal(held.assertLive(), true);
    const busy = completeStatePublication(verified.capability);
    assert.equal(busy.status, "blocked");
    assert.equal(busy.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(marker), markerBytes);
    assert.equal(held.release(), true);
    held = null;
    const alias = path.join(root, "marker-hardlink");
    fs.linkSync(marker, alias);
    const hardlink = completeStatePublication(verified.capability);
    assert.equal(hardlink.status, "blocked");
    assert.equal(hardlink.filesystemEffectIssued, false);
    assert.deepEqual(fs.readFileSync(alias), markerBytes);
    fs.unlinkSync(alias);
    let attempts = 0;
    fs.unlinkSync = (file) => {
      const result = unlink(file);
      if (file === marker) {
        attempts++;
        throw new Error("fixture after unlink");
      }
      return result;
    };
    const afterThrow = completeStatePublication(verified.capability);
    fs.unlinkSync = unlink;
    assert.equal(attempts, 1);
    assert.equal(afterThrow.status, "blocked");
    assert.equal(afterThrow.markerRemoved, true);
    assert.equal(afterThrow.markerAbsentConfirmed, true);
    assert.equal(afterThrow.storageConfirmed, false);
    assert.equal(afterThrow.lockReleased, true);
    assert.equal(
      completeStatePublication(verified.capability).status,
      "completed",
    );
    assert.deepEqual(fs.readFileSync(state), bytes);
    assert.equal(
      sameStableFileIdentity(before, fs.lstatSync(state, { bigint: true })),
      true,
    );
    assert.deepEqual(fs.readdirSync(storage.directory), ["state.json"]);
    const ownerAcquisition = acquireStorageOwner(root);
    assert.ok(ownerAcquisition.status === "completed");
    const owner = ownerAcquisition.value;
    try {
      assert.equal(owner.assertLive(), true);
      for (let read = 0; read < 2; read++) {
        const observed = readStorageSnapshotOwned(owner);
        assert.equal(observed.status, "completed");
        assert.equal(observed.lockReleased, false);
        assert.ok("ownerHeld" in observed && observed.ownerHeld);
        assert.equal(
          observed.value?.payloadSha256,
          decodeStateSnapshot(bytes, repository.repositoryBinding)
            ?.payloadSha256,
        );
      }
      assert.equal(acquireStorageOwner(root).status, "blocked");
      let invoked = false;
      const fake = new Proxy(
        {},
        {
          get() {
            invoked = true;
            throw new Error("untrusted owner");
          },
        },
      );
      assert.equal(readStorageSnapshotOwned(fake).status, "blocked");
      assert.equal(readStorageSnapshotOwned({ ...owner }).status, "blocked");
      assert.equal(invoked, false);
      assert.equal(owner.assertLive(), true);
    } finally {
      assert.equal(owner.release(), true);
    }
    assert.equal(owner.assertLive(), false);
    assert.equal(owner.release(), false);
    assert.equal(readStorageSnapshotOwned(owner).status, "blocked");
    const nextOwnerAcquisition = acquireStorageOwner(root);
    assert.ok(nextOwnerAcquisition.status === "completed");
    const nextOwner = nextOwnerAcquisition.value;
    assert.equal(nextOwner.release(), true);
    assert.deepEqual(fs.readFileSync(state), bytes);
  } finally {
    fs.unlinkSync = unlink;
    if (held) assert.equal(held.release(), true);
    assert.equal(path.dirname(root), area.directory);
    fs.rmSync(root, { recursive: true });
    assert.throws(() => fs.lstatSync(root), { code: "ENOENT" });
    ownedDirectory.cleanup();
  }
});

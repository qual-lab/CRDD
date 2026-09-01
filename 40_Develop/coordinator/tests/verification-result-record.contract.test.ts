import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { TestContext } from "node:test";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { deflateSync } from "node:zlib";
import { createSignedRouteMatrixCliFailureResult } from "../scripts/verify-signed-route-matrix.ts";
import {
  projectVerificationResult,
  runRecordedVerification,
} from "../src/core/verification-result-record.ts";
import {
  formatDockerIsolationRecoveryToken,
  isDockerIsolationRecoveryIdCandidate,
} from "../src/security/docker-isolation.ts";
import { formatHostRecoveryToken } from "../src/security/host-recovery-record.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const packageRoot = path.resolve(import.meta.dirname, "..");
function fixture(t: TestContext) {
  const parent = path.join(repositoryRoot, ".crdd", "test-tmp");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const root = fs.mkdtempSync(path.join(parent, "verification-record-"));
  t.after(() => {
    assert.ok(root.startsWith(`${parent}${path.sep}`));
    fs.rmSync(root, { recursive: true, force: true });
    assert.equal(fs.existsSync(root), false);
  });
  const git = path.join(root, ".git");
  fs.mkdirSync(path.join(git, "info"), { recursive: true });
  fs.writeFileSync(
    path.join(git, "config"),
    "[core]\nrepositoryformatversion = 0\nbare = false\n",
  );
  function object(type: string, body: string) {
    const bytes = Buffer.from(`${type} ${Buffer.byteLength(body)}\0${body}`);
    const hash = createHash("sha1").update(bytes).digest("hex");
    const target = path.join(git, "objects", hash.slice(0, 2), hash.slice(2));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, deflateSync(bytes));
    return hash;
  }
  const tree = object("tree", "");
  const commit = object(
    "commit",
    `tree ${tree}\nauthor Test <test@example.invalid> 0 +0000\ncommitter Test <test@example.invalid> 0 +0000\n\nfixture\n`,
  );
  fs.writeFileSync(path.join(git, "HEAD"), `${commit}\n`);
  fs.writeFileSync(path.join(root, ".gitignore"), "/.crdd/\n");
  return root;
}
function store(root: string) {
  return path.join(root, ".crdd", "verification-results");
}
function resultPath(root: string, id: string | null) {
  assert.ok(id);
  return path.join(store(root), id, "result.json");
}
const SUCCESS = Object.freeze({
  status: "completed",
  reason: "signed_route_matrix_completed",
  cleanupConfirmed: true,
  manualRecoveryRequired: false,
});
const failure = () =>
  createSignedRouteMatrixCliFailureResult("runner_exception");

test("既知値だけ保存し、自由文・秘密風文字列・getter・proxyを実行しない", () => {
  let wasGetterCalled = false;
  const id = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
  const projected = projectVerificationResult({
    status: "completed",
    reason: "secret_password_value",
    message: "PRIVATE_MESSAGE",
    dockerRecoveryId: id,
    dockerRecoveryIds: [id, "PRIVATE_TOKEN"],
    get cleanupConfirmed() {
      wasGetterCalled = true;
      return true;
    },
    attemptedRouteCount: Infinity,
    results: [
      {
        status: "blocked",
        reason: "provider_turn_limit_exceeded",
        output: "PRIVATE_OUTPUT",
      },
    ],
  });
  assert.equal(projected.reason, "unknown");
  assert.equal(projected.cleanupConfirmed, null);
  assert.equal(projected.attemptedRouteCount, null);
  assert.equal(projected.recoveryFieldsComplete, false);
  assert.deepEqual(projected.dockerRecoveryIds, [id]);
  assert.equal(wasGetterCalled, false);
  assert.doesNotMatch(JSON.stringify(projected), /PRIVATE|secret_password/u);
  assert.equal(
    projectVerificationResult(
      new Proxy(
        {},
        {
          getPrototypeOf() {
            throw new Error("must not execute");
          },
        },
      ),
    ).status,
    "unknown",
  );
  assert.equal(
    projectVerificationResult({ results: Array(13).fill(SUCCESS) })
      .resultsComplete,
    false,
  );
});

test("配布Identityと作業対象Execution Identityと経路不一致分類を別々に保存する", () => {
  const projected = projectVerificationResult({
    status: "blocked",
    reason: "signed_route_matrix_incomplete",
    validationFailure: "execution_identity_mismatch",
    crddCommit: "a".repeat(40),
    crddTree: "b".repeat(40),
    executionCommit: "c".repeat(40),
    executionTree: "d".repeat(40),
    results: [
      {
        status: "blocked",
        reason: "signed_general_task_execution_repository_changed",
        executionCommit: "c".repeat(40),
        executionTree: "d".repeat(40),
      },
    ],
  });
  assert.equal(projected.validationFailure, "execution_identity_mismatch");
  assert.equal(projected.crddCommit, "a".repeat(40));
  assert.equal(projected.crddTree, "b".repeat(40));
  assert.equal(projected.executionCommit, "c".repeat(40));
  assert.equal(projected.executionTree, "d".repeat(40));
  const child = (projected.results as readonly Record<string, unknown>[])[0];
  assert.equal(
    child?.reason,
    "signed_general_task_execution_repository_changed",
  );
  assert.equal(child?.executionCommit, "c".repeat(40));
  assert.equal(child?.executionTree, "d".repeat(40));
});

test("subdirectoryからも最寄りRepositoryへ開始・終了を別記録し、元結果を変更しない", async (t) => {
  const root = fixture(t);
  const cwd = path.join(root, "package");
  fs.mkdirSync(cwd);
  const outcome = await runRecordedVerification(
    "routes",
    cwd,
    async () => SUCCESS,
    failure,
  );
  assert.equal(outcome.exitCode, 0);
  assert.equal(outcome.result, SUCCESS);
  assert.equal(outcome.recordingOutcome, "saved");
  assert.equal(fs.existsSync(path.join(cwd, ".crdd")), false);
  const target = resultPath(root, outcome.recordId);
  const record = JSON.parse(fs.readFileSync(target, "utf8"));
  assert.equal(record.summary.cleanupConfirmed, true);
  assert.equal(record.authorityConferred, false);
  assert.equal(record.repositoryRevisionIsExecutionVersion, false);
  assert.equal(record.executionOutcome, "returned");
  const completion = JSON.parse(
    fs.readFileSync(path.join(path.dirname(target), "complete.json"), "utf8"),
  );
  assert.equal(completion.recordId, record.recordId);
  assert.equal(completion.startedAt, record.startedAt);
  assert.equal(
    completion.resultSha256,
    createHash("sha256").update(fs.readFileSync(target)).digest("hex"),
  );
  assert.equal(
    fs.existsSync(path.join(path.dirname(target), "started.json")),
    true,
  );
  assert.doesNotMatch(fs.readFileSync(target, "utf8"), /PRIVATE|test@example/u);
});

test("実formatter由来のprobe／hostとTaskの回復IDを値を変えずに記録する", () => {
  const nonce = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const digest = "a".repeat(64);
  const probe = formatDockerIsolationRecoveryToken(
    "crdd-coordinator-doctor-test",
    nonce,
    nonce,
    digest,
  );
  assert.equal(isDockerIsolationRecoveryIdCandidate(probe), true);
  for (const id of [
    probe,
    formatHostRecoveryToken("crdd-coordinator-doctor-test", nonce, digest),
    `docker-task.${digest}.${digest}.${digest}`,
  ]) {
    const result = projectVerificationResult({ recoveryId: id });
    assert.equal(result.recoveryId, id);
    assert.equal(result.recoveryFieldsComplete, true);
  }
  for (const id of [
    "PRIVATE_RECOVERY_SECRET",
    `docker.${"a".repeat(2048)}`,
    probe.replace(digest, "not-a-hash"),
  ]) {
    const result = projectVerificationResult({ recoveryId: id });
    assert.equal(result.recoveryId, null);
    assert.equal(result.recoveryFieldsComplete, false);
    assert.equal(isDockerIsolationRecoveryIdCandidate(id), false);
  }
});

test("実行が停止・例外でも記録し、保存成功を実行成功へ変えない", async (t) => {
  const root = fixture(t);
  const blocked = createSignedRouteMatrixCliFailureResult("arguments_invalid");
  const returned = await runRecordedVerification(
    "routes",
    root,
    async () => blocked,
    failure,
  );
  assert.equal(returned.exitCode, 2);
  assert.equal(returned.recordingOutcome, "saved");
  let wasFailureHandled = false;
  const thrown = await runRecordedVerification(
    "routes",
    root,
    async () => {
      throw new Error("PRIVATE_EXCEPTION");
    },
    () => {
      wasFailureHandled = true;
      return failure();
    },
  );
  assert.equal(wasFailureHandled, true);
  assert.equal(thrown.executionOutcome, "threw");
  const text = fs.readFileSync(resultPath(root, thrown.recordId), "utf8");
  assert.doesNotMatch(text, /PRIVATE_EXCEPTION/u);
  assert.equal(JSON.parse(text).summary.effectStateUnknown, true);
});

test("不正Git境界・保存先link・開始書込み失敗なら検証callbackを呼ばない", async (t) => {
  const root = fixture(t);
  const foreign = path.join(root, "foreign");
  fs.mkdirSync(foreign);
  fs.symlinkSync(foreign, path.join(root, ".crdd"), "junction");
  let wasVerificationCalled = false;
  const executeVerification = async () => {
    wasVerificationCalled = true;
    return SUCCESS;
  };
  assert.equal(
    (
      await runRecordedVerification(
        "routes",
        root,
        executeVerification,
        failure,
      )
    ).recordingOutcome,
    "start_failed",
  );
  assert.deepEqual(fs.readdirSync(foreign), []);
  fs.unlinkSync(path.join(root, ".crdd"));
  fs.writeFileSync(path.join(foreign, ".git"), "invalid");
  assert.equal(
    (
      await runRecordedVerification(
        "routes",
        foreign,
        executeVerification,
        failure,
      )
    ).recordingOutcome,
    "start_failed",
  );
  const original = fs.writeFileSync;
  const mock = t.mock.method(
    fs,
    "writeFileSync",
    (...args: Parameters<typeof fs.writeFileSync>) => {
      if (typeof args[0] === "number") throw new Error("injected_disk_failure");
      return original(...args);
    },
  );
  assert.equal(
    (
      await runRecordedVerification(
        "routes",
        root,
        executeVerification,
        failure,
      )
    ).recordingOutcome,
    "start_failed",
  );
  mock.mock.restore();
  assert.equal(wasVerificationCalled, false);
});

test("実行成功後の保存衝突・directory置換は上書きせず、実行結果と区別する", async (t) => {
  const root = fixture(t);
  const outcome = await runRecordedVerification(
    "routes",
    root,
    async () => {
      const id = fs.readdirSync(store(root))[0];
      assert.ok(id);
      fs.writeFileSync(path.join(store(root), id, "result.json"), "existing");
      return SUCCESS;
    },
    failure,
  );
  assert.equal(outcome.exitCode, 2);
  assert.equal(outcome.recordingOutcome, "finish_failed");
  assert.equal(outcome.result?.cleanupConfirmed, true);
  assert.equal(
    fs.readFileSync(resultPath(root, outcome.recordId), "utf8"),
    "existing",
  );
  const other = fixture(t);
  const replaced = await runRecordedVerification(
    "routes",
    other,
    async () => {
      const id = fs.readdirSync(store(other))[0];
      assert.ok(id);
      const target = path.join(store(other), id);
      fs.renameSync(target, `${target}-retained`);
      fs.mkdirSync(target);
      return SUCCESS;
    },
    failure,
  );
  assert.equal(replaced.recordingOutcome, "finish_failed");
  assert.equal(fs.existsSync(resultPath(other, replaced.recordId)), false);
});

test("終了記録の短読・読戻し差・file同定差は実行結果を保持して保存失敗にする", async (t) => {
  for (const mutation of ["short_read", "readback_bytes", "file_identity"]) {
    const root = fixture(t);
    const openSync = fs.openSync;
    const readSync = fs.readSync;
    const lstatSync = fs.lstatSync;
    const closeSync = fs.closeSync;
    let resultDescriptor: number | null = null;
    let injectionCalls = 0;
    let closeCalls = 0;
    let startedBytes: Buffer | null = null;
    let restoreMocks = () => {};
    let outcome: Awaited<ReturnType<typeof runRecordedVerification>>;
    try {
      outcome = await runRecordedVerification(
        "routes",
        root,
        async () => {
          const id = fs.readdirSync(store(root))[0];
          assert.ok(id);
          startedBytes = fs.readFileSync(
            path.join(store(root), id, "started.json"),
          );
          const openMock = t.mock.method(
            fs,
            "openSync",
            (...args: Parameters<typeof fs.openSync>) => {
              const descriptor = openSync(...args);
              if (args[0] === path.join(store(root), id, "result.json"))
                resultDescriptor = descriptor;
              return descriptor;
            },
          );
          const readMock = t.mock.method(
            fs,
            "readSync",
            (...readArguments: unknown[]) => {
              if (
                readArguments[0] !== resultDescriptor ||
                mutation === "file_identity"
              )
                return Reflect.apply(readSync, fs, readArguments) as number;
              injectionCalls += 1;
              if (mutation === "short_read") return 0;
              const count = Reflect.apply(
                readSync,
                fs,
                readArguments,
              ) as number;
              const buffer = readArguments[1];
              assert.ok(Buffer.isBuffer(buffer));
              assert.ok(count > 0);
              buffer[0] = (buffer[0] ?? 0) ^ 1;
              return count;
            },
          );
          const statMock = t.mock.method(
            fs,
            "lstatSync",
            (...statArguments: unknown[]) => {
              const stats = Reflect.apply(lstatSync, fs, statArguments);
              if (
                mutation === "file_identity" &&
                statArguments[0] === path.join(store(root), id, "result.json")
              ) {
                injectionCalls += 1;
                Object.defineProperty(stats, "ino", { value: stats.ino + 1n });
              }
              return stats;
            },
          );
          const closeMock = t.mock.method(
            fs,
            "closeSync",
            (descriptor: number) => {
              if (descriptor === resultDescriptor) closeCalls += 1;
              return closeSync(descriptor);
            },
          );
          restoreMocks = () => {
            openMock.mock.restore();
            readMock.mock.restore();
            statMock.mock.restore();
            closeMock.mock.restore();
          };
          return SUCCESS;
        },
        failure,
      );
    } finally {
      restoreMocks();
    }
    assert.equal(injectionCalls, 1, mutation);
    assert.equal(closeCalls, 1, mutation);
    assert.equal(outcome.recordingOutcome, "finish_failed");
    assert.equal(outcome.executionOutcome, "returned");
    assert.equal(outcome.result, SUCCESS);
    assert.equal(outcome.exitCode, 2);
    const directory = path.dirname(resultPath(root, outcome.recordId));
    assert.equal(fs.existsSync(path.join(directory, "complete.json")), false);
    assert.deepEqual(
      fs.readFileSync(path.join(directory, "started.json")),
      startedBytes,
    );
  }
});

test("同時runは別UUIDへ保存し、容量に異物・未完了記録も数える", async (t) => {
  const root = fixture(t);
  const outcomes = await Promise.all(
    Array.from({ length: 4 }, () =>
      runRecordedVerification("routes", root, async () => SUCCESS, failure),
    ),
  );
  assert.equal(new Set(outcomes.map((value) => value.recordId)).size, 4);
  for (const outcome of outcomes)
    assert.equal(outcome.recordingOutcome, "saved");
  for (let i = 4; i < 256; i++)
    fs.writeFileSync(path.join(store(root), `partial-${i}`), "partial");
  let wasVerificationCalled = false;
  const full = await runRecordedVerification(
    "routes",
    root,
    async () => {
      wasVerificationCalled = true;
      return SUCCESS;
    },
    failure,
  );
  assert.equal(full.recordingOutcome, "start_failed");
  assert.equal(wasVerificationCalled, false);
  assert.equal(fs.readdirSync(store(root)).length, 256);
});

test("実子が開始後に終了してもstartedが残り、成功記録は生成しない", (t) => {
  const root = fixture(t);
  const entry = path.join(root, "abrupt-exit.ts");
  const moduleUrl = pathToFileURL(
    path.join(packageRoot, "src/core/verification-result-record.ts"),
  ).href;
  fs.writeFileSync(
    entry,
    `import { runRecordedVerification } from ${JSON.stringify(moduleUrl)};\nawait runRecordedVerification('routes', process.cwd(), async () => process.exit(31), () => ({}));\n`,
  );
  const child = spawnSync(process.execPath, [entry], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
    timeout: 30_000,
  });
  assert.equal(child.status, 31, child.stderr);
  const ids = fs.readdirSync(store(root));
  assert.equal(ids.length, 1);
  assert.ok(ids[0]);
  assert.deepEqual(fs.readdirSync(path.join(store(root), ids[0])), [
    "started.json",
  ]);
});

test("終了記録のflush失敗は保存成功にせず、byte上限も緩和しない", async (t) => {
  const root = fixture(t);
  let restore = () => {};
  const flushFailure = await runRecordedVerification(
    "routes",
    root,
    async () => {
      const mocked = t.mock.method(fs, "fsyncSync", () => {
        throw new Error("injected_flush_failure");
      });
      restore = () => mocked.mock.restore();
      return SUCCESS;
    },
    failure,
  );
  restore();
  assert.equal(flushFailure.recordingOutcome, "finish_failed");
  assert.equal(flushFailure.result?.cleanupConfirmed, true);
  assert.equal(
    fs.existsSync(
      path.join(
        path.dirname(resultPath(root, flushFailure.recordId)),
        "complete.json",
      ),
    ),
    false,
  );
  const ids = Array.from(
    { length: 16 },
    (_value, i) =>
      `docker-task.${i.toString(16).padStart(64, "0")}.${"b".repeat(64)}.${"c".repeat(64)}`,
  );
  const large = await runRecordedVerification(
    "routes",
    root,
    async () => ({
      ...SUCCESS,
      results: Array.from({ length: 12 }, () => ({
        ...SUCCESS,
        dockerRecoveryIds: ids,
      })),
    }),
    failure,
  );
  assert.equal(large.recordingOutcome, "finish_failed");
  assert.equal(fs.existsSync(resultPath(root, large.recordId)), false);
});

test("公開Recovery入口は端末出力を変えず、未署名の停止も最終記録へ接続する", (t) => {
  const root = fixture(t);
  const child = spawnSync(
    process.execPath,
    [path.join(packageRoot, "bin/launch.ts"), "verify-recovery"],
    { cwd: root, encoding: "utf8", windowsHide: true, timeout: 30_000 },
  );
  assert.equal(child.status, 2, child.stderr);
  const result = JSON.parse(child.stdout);
  assert.equal(result.status, "blocked");
  assert.match(child.stderr, /最終結果を保存しました/u);
  const ids = fs.readdirSync(store(root));
  assert.equal(ids.length, 1);
  assert.equal(
    JSON.parse(fs.readFileSync(resultPath(root, ids[0] ?? null), "utf8"))
      .summary.status,
    "blocked",
  );
});

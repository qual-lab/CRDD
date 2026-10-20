/**
 * Docker Desktop修復の固定Host操作を外部Effectなしで反証する。
 * @packageDocumentation
 * @responsibility 固定対象・要求搬送・発行分類とDirectory前後観測を確認する。
 * @trace ERB-IT-001
 * @trace ERB-IT-014
 * @level IT
 * @scope 本番関数本文と模擬Filesystem／Process境界。
 * @boundary ERB-IT-001=Direct Boundary: 修復技術処理→固定Host境界。
 * @boundary ERB-IT-014=Direct Boundary: 固定退避処理→前後のFilesystem観測。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { types as utilTypes } from "node:util";
import { runInNewContext } from "node:vm";
import * as publicApi from "../../src/index.ts";
import { isSupportedWindowsAbsolutePathCandidate } from "../../../coordinator/src/authority/root-path-lexical.ts";
import {
  retainDockerDesktopRepairRunDirectory,
  retainDockerDesktopRepairContinuationDirectory,
  createDockerDesktopRepairDirectoryAccess,
} from "../../src/desktop/runtime-directory.ts";

const operationId = "a".repeat(32);
const localAppData = "C:\\Users\\fixture\\AppData\\Local";
const identity = { dev: "1", ino: "2", birthtimeNs: "3" };
const unknown = {
  issued: null,
  confirmation: "unknown",
  staleState: "unknown",
};

/**
 * 実際の内部exportから固定Filesystem接続へ到達することを確認する。
 * @responsibility 本文抽出試験だけで本番接続を推定しない。
 * @trace ERB-IT-001
 * @precondition 実ModuleとNode Filesystemの局所差替えを使う。
 * @stimulus 初回runとSecrets Engineの固定退避を呼ぶ。
 * @observation 導出された両Path、rename一回と結果。
 * @oracle mockしたFilesystemだけへ固定Pathを渡し、実ファイル変更0。
 * @cleanup Test hookがNode Filesystemを復元する。
 * @boundary ERB-IT-001=Related 2 Blocks: 内部API→固定FS接続。
 */
test("本番内部exportは固定Directory処置へ接続する", (t) => {
  if (process.platform !== "win32") return;
  const metadata = fs.lstatSync(import.meta.dirname, { bigint: true });
  const expectedIdentity = {
    dev: String(metadata.dev),
    ino: String(metadata.ino),
    birthtimeNs: String(metadata.birthtimeNs),
  };
  let moved = false;
  let source = "",
    target = "";
  let moves = 0;
  t.mock.method(fs, "lstatSync", (value: string) => {
    if ((value === target && !moved) || (value === source && moved))
      throw Object.assign(new Error("absent"), { code: "ENOENT" });
    assert.ok([source, target, path.win32.dirname(source)].includes(value));
    return metadata;
  });
  t.mock.method(fs, "renameSync", (from: string, to: string) => {
    assert.equal(from, source);
    assert.equal(to, target);
    moved = true;
    moves++;
  });
  for (const purpose of ["initial_run", "secrets_engine"] as const) {
    moved = false;
    source =
      purpose === "initial_run"
        ? path.win32.join(localAppData, "Docker", "run")
        : path.win32.join(localAppData, "docker-secrets-engine");
    target = `${source}.crdd-stale-${operationId}`;
    const result =
      purpose === "initial_run"
        ? retainDockerDesktopRepairRunDirectory(
            localAppData,
            operationId,
            expectedIdentity,
          )
        : retainDockerDesktopRepairContinuationDirectory(
            localAppData,
            operationId,
            purpose,
            expectedIdentity,
          );
    assert.deepEqual(result, {
      issued: true,
      confirmation: "confirmed",
      staleState: "retained",
    });
  }
  assert.equal(moves, 2);
});

/**
 * 内部技術操作が独立したRoot公開入口にならないことを確認する。
 * @responsibility 暫定内部compositionを完成した公開修復APIと誤認しない。
 * @trace ERB-IT-001
 * @precondition 本番Package Rootを読み込む。
 * @stimulus 対象の内部関数名を照合する。
 * @observation 公開exportの存在。
 * @oracle 列挙した全関数がRoot公開集合にない。
 * @cleanup N/A: 読取りだけ。
 * @boundary ERB-IT-001=Direct Boundary: Package公開集合。
 */
test("修復Host操作は独立したRoot APIとして公開しない", () => {
  assert.equal(typeof publicApi.runDockerRuntimeRepairSession, "function");
  for (const name of [
    "requestDockerDesktopOfficialShutdown",
    "terminateDockerDesktopBackendForRepair",
    "retainDockerDesktopRepairRunDirectory",
    "retainDockerDesktopRepairContinuationDirectory",
    "observeDockerDesktopRepairScope",
    "createDockerDesktopRepairDirectoryAccess",
    "createDockerDesktopRepairOperations",
    "runDockerRuntimeRepairSessionUsing",
    "dockerDesktopDistributionRoot",
  ])
    assert.equal(name in publicApi, false);
});

/**
 * lock肯定結果の返却Identityを同じOracleで検査する。
 * @responsibility 下位観測を実行しても結果を捨てる退行を拒否する。
 * @trace ERB-IT-014
 * @precondition 呼出し側が固定Filesystemと既知lockを準備済み。
 * @stimulus 対象用途と期待実体を渡す。
 * @observation factoryから返る実体Identity。
 * @oracle Realm差を除いた三値が期待実体へ一致する。
 * @cleanup N/A: 呼出し元が模擬境界を回収する。
 * @boundary 固定Directoryアクセスの返却値。
 */
function assertRepairDirectoryLockResult(
  access: NonNullable<
    ReturnType<typeof createDockerDesktopRepairDirectoryAccess>
  >,
  purpose: "initial" | "failed" | "auxiliary",
  expected: typeof identity,
) {
  assert.deepEqual(
    JSON.parse(JSON.stringify(access.lock(purpose))),
    expected,
    "factory_lock_identity",
  );
}

/**
 * 固定Directory APIの読取り・退避を実Module経由で確認する。
 * @responsibility 同じScopeと実Filesystem要求を結合する。
 * @trace ERB-IT-014
 * @precondition 本番Moduleと局所Filesystem差替え。
 * @stimulus 三用途の正常・不明・入力拒否とlock結果破棄変異。
 * @observation Path、entry、open、前後実体、renameと返却Identity。
 * @oracle 正常だけ固定対象へrenameしlock結果を捨てる変異を拒否する。
 * @cleanup mockを復元。実変更0。
 * @boundary 固定Scopeと実Filesystem接続。
 */
test("修復Directoryアクセスは同じScope対象だけを観測・退避する", (t) => {
  if (process.platform !== "win32") return;
  const metadata = fs.lstatSync(import.meta.dirname, { bigint: true });
  const expected = {
    dev: String(metadata.dev),
    ino: String(metadata.ino),
    birthtimeNs: String(metadata.birthtimeNs),
  };
  const nonce = "1".repeat(64);
  const encoded = Buffer.from(
    JSON.stringify({ operationNonce: nonce }),
    "utf8",
  );
  const length = Buffer.alloc(4);
  length.writeUInt32LE(encoded.length);
  const id = createHash("sha256")
    .update("crdd/docker-desktop-repair-directory/v1", "ascii")
    .update(Buffer.from([0]))
    .update(length)
    .update(encoded)
    .digest("hex")
    .slice(0, 32);
  let source = "",
    target = "",
    parent = "";
  let moved = false,
    targetExists = false,
    scopeChanged = false,
    moves = 0;
  let locked = false,
    opens = 0,
    closes = 0;
  const requests: string[] = [],
    lockRequests: string[] = [];
  t.mock.method(fs, "lstatSync", (value: string) => {
    requests.push(value);
    assert.ok([localAppData, source, target, parent].includes(value));
    if (value === localAppData && scopeChanged)
      throw new Error("scope changed");
    if (
      (value === source && moved) ||
      (value === target && !moved && !targetExists)
    )
      throw Object.assign(new Error("absent"), { code: "ENOENT" });
    return metadata;
  });
  t.mock.method(fs.realpathSync, "native", (value: string) => {
    assert.equal(value, localAppData);
    return localAppData;
  });
  t.mock.method(fs, "renameSync", (from: string, to: string) => {
    assert.equal(from, source);
    assert.equal(to, target);
    moves++;
    moved = true;
  });
  t.mock.method(fs, "readdirSync", (value: string) => {
    lockRequests.push(value);
    assert.equal(value, source);
    return locked
      ? [
          {
            name: "entry.sock",
            isDirectory: () => false,
            isSymbolicLink: () => false,
          },
        ]
      : [];
  });
  t.mock.method(fs, "openSync", (value: string, flags: string) => {
    opens++;
    assert.equal(value, path.win32.join(source, "entry.sock"));
    assert.equal(flags, "r");
    throw Object.assign(new Error("known lock"), { code: "EACCES" });
  });
  t.mock.method(fs, "closeSync", () => {
    closes++;
    assert.fail("no acquired handle");
  });
  const access = createDockerDesktopRepairDirectoryAccess(
    localAppData,
    nonce,
    "2".repeat(64),
    "3".repeat(64),
  );
  assert.ok(access);
  assert.ok(Object.isFrozen(access));
  for (const purpose of ["initial", "failed", "auxiliary"] as const) {
    source =
      purpose === "auxiliary"
        ? path.win32.join(localAppData, "docker-secrets-engine")
        : path.win32.join(localAppData, "Docker", "run");
    parent = path.win32.dirname(source);
    target = `${source}.crdd-stale-${id}${purpose === "failed" ? "-restart" : ""}`;
    moved = false;
    targetExists = false;
    const observed = access.observe(purpose);
    assert.equal(observed?.source.state, "present");
    assert.equal(observed?.retained.state, "confirmed_absent");
    assert.equal(access.lock(purpose), null);
    assert.equal(lockRequests.at(-1), source);
    locked = true;
    const requestStart = requests.length,
      entryStart = lockRequests.length,
      openStart = opens,
      moveStart = moves;
    assertRepairDirectoryLockResult(access, purpose, expected);
    assert.deepEqual(lockRequests.slice(entryStart), [source, source]);
    assert.equal(
      requests.slice(requestStart).filter((value) => value === source).length,
      2,
    );
    assert.equal(opens, openStart + 1);
    assert.equal(closes, 0);
    assert.equal(moves, moveStart);
    locked = false;
    const before = moves;
    assert.deepEqual(access.retain(purpose, expected), {
      issued: true,
      confirmation: "confirmed",
      staleState: "retained",
    });
    assert.equal(moves, before + 1);
    assert.equal(access.observe(purpose)?.source.state, "confirmed_absent");
    assert.equal(access.observe(purpose)?.retained.state, "present");
    moved = false;
    targetExists = true;
    assert.deepEqual(access.retain(purpose, expected), {
      issued: false,
      confirmation: "not_issued",
      staleState: purpose === "initial" ? "retained" : "unknown",
    });
    assert.equal(moves, before + 1);
  }
  const moduleSource = fs.readFileSync(
    new URL("../../src/desktop/runtime-directory.ts", import.meta.url),
    "utf8",
  );
  const returned =
    "return observeDockerRuntimeDirectoryLock(scope.targets[purpose].source);";
  assert.equal(moduleSource.split(returned).length, 2);
  const body = stripTypeScriptTypes(
    moduleSource
      .replace(
        returned,
        "observeDockerRuntimeDirectoryLock(scope.targets[purpose].source); return null;",
      )
      .replace(/^import[\s\S]*?;\r?\n/gmu, "")
      .replace(/^export /gmu, ""),
  );
  const factory = runInNewContext(
    `${body}; createDockerDesktopRepairDirectoryAccess`,
    { fs, createHash, Buffer, path, utilTypes, process: { platform: "win32" } },
  ) as typeof createDockerDesktopRepairDirectoryAccess;
  const discarded = factory(
    localAppData,
    nonce,
    "2".repeat(64),
    "3".repeat(64),
  );
  assert.ok(discarded);
  locked = true;
  const openStart = opens;
  assert.throws(
    () => assertRepairDirectoryLockResult(discarded, "auxiliary", expected),
    /factory_lock_identity/u,
  );
  assert.equal(opens, openStart + 1);
  locked = false;
  let traps = 0;
  const reads = requests.length;
  assert.deepEqual(
    access.retain(
      "initial",
      new Proxy(expected, {
        ownKeys() {
          traps++;
          return [];
        },
      }),
    ),
    unknown,
  );
  assert.equal(requests.length, reads);
  assert.equal(traps, 0);
  assert.equal(access.observe("other" as "initial"), null);
  assert.equal(access.lock("other" as "initial"), null);
  assert.deepEqual(access.retain("other" as "initial", expected), unknown);
  assert.equal(requests.length, reads);
  const before = moves;
  scopeChanged = true;
  assert.equal(access.verify(), false);
  assert.equal(access.observe("initial"), null);
  assert.equal(access.lock("initial"), null);
  assert.deepEqual(access.retain("initial", expected), unknown);
  assert.equal(moves, before);
});

/**
 * realpathの要求先と回数を独立に検査する。
 * @responsibility lstatだけの観測範囲検査を全FS検査へ昇格しない。
 * @trace ERB-IT-014
 * @precondition 代役が全realpath要求を記録済み。
 * @stimulus 期待Localと要求回数を渡す。
 * @observation 全要求先と件数。
 * @oracle Local以外を一件でも読んだ場合は失敗。
 * @cleanup N/A: 値検査だけ。
 * @boundary 試験の読取り範囲Oracle。
 */
function assertLocalRealpathRequests(
  requests: string[],
  root: string,
  count: number,
) {
  assert.equal(requests.length, count, "scope_realpath_count");
  for (const target of requests)
    assert.equal(
      target.toLocaleLowerCase("en-US"),
      root.toLocaleLowerCase("en-US"),
      "scope_realpath_target",
    );
}

/**
 * 修復Scopeの固定材料、byte encodingと一回捕捉した対象を確認する。
 * @responsibility 可変Docker親実体をScopeへ固定せず、Local親の観測不明を拒否する。
 * @trace ERB-IT-014
 * @precondition 本番Module本文と模擬Local親の読取りだけ。
 * @stimulus 同材料、各材料差、Path表現差、親変更・不明・不正入力を与える。
 * @observation Hash、下位32桁ID、固定targets、全Filesystem要求。
 * @oracle 独立UTF-8長付き期待Hashと一致し、未知親・不正値は準備拒否。
 * @cleanup N/A: 実Filesystem／Native／Docker変更0。
 * @boundary 修復Scope読取りの合成Filesystem境界。
 */
test("修復Scopeは安定Localだけへ結合し固定targetsを共有する", () => {
  const source = stripTypeScriptTypes(
    fs.readFileSync(
      new URL("../../src/desktop/runtime-directory.ts", import.meta.url),
      "utf8",
    ),
  )
    .replace(/^import[\s\S]*?;\r?\n/gmu, "")
    .replace(/^export /gmu, "");
  const canonical = "C:\\Users\\使用者\\AppData\\Local";
  const nonce = "1".repeat(64),
    owner = "2".repeat(64),
    artifact = "3".repeat(64);
  const stable = { dev: "1", ino: "2", birthtimeNs: "3" };
  const data = Buffer.from(JSON.stringify({ operationNonce: nonce }), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32LE(data.length);
  const directoryId = createHash("sha256")
    .update("crdd/docker-desktop-repair-directory/v1", "ascii")
    .update(Buffer.from([0]))
    .update(length)
    .update(data)
    .digest("hex")
    .slice(0, 32);
  const run = path.win32.join(canonical, "Docker", "run");
  const secrets = path.win32.join(canonical, "docker-secrets-engine");
  const targets = {
    initial: {
      source: run,
      target: `${run}.crdd-stale-${directoryId}`,
      parent: path.win32.dirname(run),
    },
    failed: {
      source: run,
      target: `${run}.crdd-stale-${directoryId}-restart`,
      parent: path.win32.dirname(run),
    },
    auxiliary: {
      source: secrets,
      target: `${secrets}.crdd-stale-${directoryId}`,
      parent: canonical,
    },
  };
  const payload = {
    protocol: "CRDDDR06",
    operationNonce: nonce,
    ownerBindingSha256: owner,
    artifactSha256: artifact,
    localAppData: { path: canonical, identity: stable },
    targets,
  };
  const bytes = Buffer.from(JSON.stringify(payload), "utf8");
  assert.ok(bytes.length > JSON.stringify(payload).length);
  const header = Buffer.alloc(4);
  header.writeUInt32LE(bytes.length);
  const expected = createHash("sha256")
    .update("crdd/docker-desktop-repair-scope/v1", "ascii")
    .update(Buffer.from([0]))
    .update(header)
    .update(bytes)
    .digest("hex");
  const mutant = source.replace(
    "length.writeUInt32LE(bytes.length)",
    "length.writeUInt32LE(JSON.stringify(payload).length)",
  );
  assert.notEqual(mutant, source);
  for (const changed of [false, true]) {
    for (const scenario of [
      "normal",
      "case",
      "prefix",
      "nonce",
      "owner",
      "artifact",
      "identity",
      "path",
      "changed",
      "link",
      "file",
      "unknown",
      "realpath_unknown",
      "alias",
      "non_windows",
      "invalid",
      "proxy",
      "getter",
    ] as const) {
      let reads = 0,
        traps = 0;
      const realpaths: string[] = [];
      const root =
        scenario === "path"
          ? canonical.replace("使用者", "別利用者")
          : canonical;
      const functions = runInNewContext(
        `${changed ? mutant : source}; ({scope:observeDockerDesktopRepairScope})`,
        {
          Buffer,
          path,
          utilTypes,
          createHash,
          process: { platform: scenario === "non_windows" ? "linux" : "win32" },
          fs: {
            lstatSync(target: string) {
              reads++;
              // Docker親やrunが存在しなくても、Scopeはそこを観測しない。
              assert.equal(
                target.toLocaleLowerCase("en-US"),
                root.toLocaleLowerCase("en-US"),
              );
              if (scenario === "unknown") throw new Error("unobserved");
              return {
                dev: 1n,
                ino:
                  scenario === "identity" ||
                  (scenario === "changed" && reads > 1)
                    ? 99n
                    : 2n,
                birthtimeNs: 3n,
                isDirectory: () => scenario !== "file",
                isSymbolicLink: () => scenario === "link",
              };
            },
            realpathSync: {
              native(target: string) {
                realpaths.push(target);
                if (scenario === "realpath_unknown")
                  throw new Error("unobserved");
                return scenario === "alias"
                  ? `${root}Other`
                  : scenario === "prefix"
                    ? `\\\\?\\${root}`
                    : root;
              },
            },
          },
        },
      ) as {
        scope: (...values: unknown[]) => {
          scopeSha256: string;
          directoryId: string;
          targets: unknown;
        } | null;
      };
      const result = functions.scope(
        scenario === "case"
          ? root.replace("Users", "users")
          : scenario === "invalid"
            ? "C:\\..\\invalid"
            : root,
        scenario === "nonce" ? "4".repeat(64) : nonce,
        scenario === "owner"
          ? "5".repeat(64)
          : scenario === "proxy"
            ? new Proxy(
                {},
                {
                  get() {
                    traps++;
                    return owner;
                  },
                },
              )
            : scenario === "getter"
              ? {
                  get value() {
                    traps++;
                    return owner;
                  },
                }
              : owner,
        scenario === "artifact" ? "6".repeat(64) : artifact,
      );
      assert.equal(traps, 0);
      assertLocalRealpathRequests(
        realpaths,
        root,
        [
          "non_windows",
          "invalid",
          "proxy",
          "getter",
          "link",
          "file",
          "unknown",
        ].includes(scenario)
          ? 0
          : 1,
      );
      if (
        [
          "changed",
          "link",
          "file",
          "unknown",
          "realpath_unknown",
          "alias",
          "non_windows",
          "invalid",
          "proxy",
          "getter",
        ].includes(scenario)
      ) {
        assert.equal(result, null, scenario);
        if (["non_windows", "invalid", "proxy", "getter"].includes(scenario)) {
          assert.equal(reads, 0);
          assert.equal(realpaths.length, 0);
        }
      } else {
        assert.ok(result);
        if (["normal", "case", "prefix"].includes(scenario)) {
          assert.equal(result.scopeSha256 === expected, !changed, scenario);
          assert.equal(result.directoryId, directoryId);
          assert.deepEqual(JSON.parse(JSON.stringify(result.targets)), targets);
          assert.ok(Object.isFrozen(result.targets));
        } else assert.notEqual(result.scopeSha256, expected);
        assert.match(result.directoryId, /^[a-f0-9]{32}$/u);
        if (scenario === "nonce")
          assert.notEqual(result.directoryId, directoryId);
        else assert.equal(result.directoryId, directoryId);
        assert.equal(reads, 2);
      }
    }
  }
  const wrongRealpath = source.replace(
    ".native(localAppData)",
    '.native(path.win32.join(localAppData, "Docker"))',
  );
  assert.notEqual(wrongRealpath, source);
  for (const text of [source, wrongRealpath]) {
    const realpaths: string[] = [];
    const functions = runInNewContext(
      `${text}; ({scope:observeDockerDesktopRepairScope})`,
      {
        Buffer,
        path,
        utilTypes,
        createHash,
        process: { platform: "win32" },
        fs: {
          lstatSync() {
            return {
              dev: 1n,
              ino: 2n,
              birthtimeNs: 3n,
              isDirectory: () => true,
              isSymbolicLink: () => false,
            };
          },
          realpathSync: {
            native(target: string) {
              realpaths.push(target);
              return canonical;
            },
          },
        },
      },
    ) as { scope: (...args: unknown[]) => unknown };
    assert.ok(functions.scope(canonical, nonce, owner, artifact));
    if (text === source) assertLocalRealpathRequests(realpaths, canonical, 1);
    else
      assert.throws(
        () => assertLocalRealpathRequests(realpaths, canonical, 1),
        /scope_realpath_target/u,
      );
  }
});

/**
 * Docker backend停止の固定コマンドと発行分類を確認する。
 * @responsibility 環境欠落時の要求0と要求後不明を区別する。
 * @trace ERB-IT-001
 * @precondition 本番関数本文と模擬Processだけを使う。
 * @stimulus 正常、環境欠落、pidなし、非0、signal、error、spawn例外。
 * @observation executable／argv／全optionsと返却値。
 * @oracle 固定対象だけを一回発行し、結果不明を停止完了にしない。
 * @cleanup N/A: 実WSL・Dockerを操作しない。
 * @boundary ERB-IT-001=Direct Boundary: backend停止→固定Process要求。
 */
test("backend修復停止は固定環境・argv・上限と発行分類を保つ", () => {
  const source = fs.readFileSync(
    new URL("../../src/desktop/backend-state.ts", import.meta.url),
    "utf8",
  );
  const start = source.indexOf(
    "export function terminateDockerDesktopBackendForRepair(",
  );
  const end = source.indexOf("/**", start);
  assert.ok(start >= 0 && end > start);
  const body = stripTypeScriptTypes(
    source.slice(start, end).replace("export function", "function"),
  );
  for (const scenario of [
    "normal",
    "environment_missing",
    "root_missing",
    "pid_missing",
    "nonzero",
    "signal",
    "error",
    "throw",
  ]) {
    let calls = 0;
    const environment =
      scenario === "environment_missing"
        ? null
        : scenario === "root_missing"
          ? {}
          : { SystemRoot: "C:\\Windows", PATH: "fixed" };
    const stop = runInNewContext(
      `${body}; terminateDockerDesktopBackendForRepair`,
      {
        path,
        createWindowsNativeHelperEnvironment: () => environment,
        spawnSync(executable: string, argv: string[], options: object) {
          calls++;
          assert.equal(executable, "C:\\Windows\\System32\\wsl.exe");
          assert.deepEqual(Array.from(argv), ["--terminate", "docker-desktop"]);
          assert.deepEqual(JSON.parse(JSON.stringify(options)), {
            env: environment,
            shell: false,
            windowsHide: true,
            encoding: "buffer",
            timeout: 15000,
            maxBuffer: 16384,
          });
          if (scenario === "throw") throw new Error("spawn fixture");
          return {
            pid: scenario === "pid_missing" ? undefined : 123,
            status: scenario === "nonzero" ? 1 : 0,
            signal: scenario === "signal" ? "SIGTERM" : null,
            error: scenario === "error" ? new Error("private") : undefined,
          };
        },
      },
    ) as () => unknown;
    if (scenario === "throw") assert.throws(stop, /spawn fixture/u);
    else {
      const unissued = [
        "environment_missing",
        "root_missing",
        "pid_missing",
      ].includes(scenario);
      assert.deepEqual(JSON.parse(JSON.stringify(stop())), {
        issued: !unissued,
        confirmation: unissued
          ? "not_issued"
          : scenario === "normal"
            ? "confirmed"
            : "unknown",
      });
    }
    assert.equal(
      calls,
      scenario === "environment_missing" || scenario === "root_missing" ? 0 : 1,
    );
  }
});

/**
 * 固定Directory退避の入力捕捉と前後実体確認を反証する。
 * @responsibility 初回とContinuationの退避先既存時の違いを維持する。
 * @trace ERB-IT-001
 * @trace ERB-IT-014
 * @precondition 本番Module本文と模擬Filesystemのみ。
 * @stimulus 三用途、元／先の不存在・不明・別実体、差替え、link、file、rename例外。
 * @observation 導出Path、lstatとrenameの回数、独立期待結果。
 * @oracle 正常だけ一回renameし、前後不明を成功や不存在へ丸めない。
 * @cleanup N/A: 実ファイルを作成・変更しない。
 * @boundary ERB-IT-014=Direct Boundary: 退避処理→固定Filesystem対象。
 * @boundary ERB-IT-001=Direct Boundary: 修復操作→固定Pathと実体照合。
 */
test("固定三用途の退避は入力・同一実体・事後不存在を必須とする", () => {
  const source = fs.readFileSync(
    new URL("../../src/desktop/runtime-directory.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    source
      .replace(/^import .*;\r?$/gmu, "")
      .replaceAll("export function", "function"),
  );
  for (const purpose of [
    "initial_run",
    "failed_launch_run",
    "secrets_engine",
  ] as const) {
    for (const scenario of [
      "normal",
      "source_absent",
      "source_unknown",
      "source_other",
      "source_link",
      "source_file",
      "target_same",
      "target_other",
      "target_unknown",
      "parent_unknown",
      "parent_changed",
      "parent_after_changed",
      "parent_after_unknown",
      "source_changed",
      "target_appeared",
      "rename_throw",
      "after_unknown",
      "source_remains",
      "after_other",
      "non_windows",
      "relative",
      "unc",
      "root",
      "noncanonical",
      "bad_id",
      "bad_identity",
      "getter",
      "proxy",
      "extra",
    ]) {
      const parent =
        purpose === "secrets_engine"
          ? localAppData
          : path.win32.join(localAppData, "Docker");
      const base =
        purpose === "secrets_engine" ? "docker-secrets-engine" : "run";
      const from = path.win32.join(parent, base);
      const to = path.win32.join(
        parent,
        `${base}.crdd-stale-${operationId}${purpose === "failed_launch_run" ? "-restart" : ""}`,
      );
      let reads = 0,
        moves = 0,
        sourceReads = 0,
        targetReads = 0,
        parentReads = 0,
        traps = 0;
      const other = { ...identity, ino: "9" };
      const fakeFs = {
        lstatSync(target: string, options: unknown) {
          reads++;
          assert.deepEqual(JSON.parse(JSON.stringify(options)), {
            bigint: true,
          });
          let observed = identity;
          if (target === from) {
            sourceReads++;
            if (
              scenario === "source_absent" ||
              (moves && scenario !== "source_remains")
            )
              throw Object.assign(new Error("absent"), { code: "ENOENT" });
            if (scenario === "source_unknown")
              throw Object.assign(new Error("unknown"), { code: "EACCES" });
            if (
              scenario === "source_other" ||
              (scenario === "source_changed" && sourceReads > 1)
            )
              observed = other;
          } else if (target === to) {
            targetReads++;
            if (
              scenario === "target_unknown" ||
              (moves && scenario === "after_unknown")
            )
              throw Object.assign(new Error("unknown"), { code: "EIO" });
            if (
              !moves &&
              !["target_same", "target_other"].includes(scenario) &&
              !(scenario === "target_appeared" && targetReads > 1)
            )
              throw Object.assign(new Error("absent"), { code: "ENOENT" });
            if (
              scenario === "target_other" ||
              (moves && scenario === "after_other")
            )
              observed = other;
          } else {
            assert.equal(target, parent);
            parentReads++;
            if (scenario === "parent_unknown") throw new Error("parent");
            if (scenario === "parent_after_unknown" && parentReads === 3)
              throw new Error("parent after");
            if (scenario === "parent_after_changed" && parentReads === 3)
              observed = other;
            if (scenario === "parent_changed" && parentReads > 1)
              observed = other;
          }
          return {
            dev: BigInt(observed.dev),
            ino: BigInt(observed.ino),
            birthtimeNs: BigInt(observed.birthtimeNs),
            isDirectory: () => !(target === from && scenario === "source_file"),
            isSymbolicLink: () => target === from && scenario === "source_link",
          };
        },
        renameSync(actualFrom: string, actualTo: string) {
          assert.equal(actualFrom, from);
          assert.equal(actualTo, to);
          moves++;
          if (scenario === "rename_throw") throw new Error("rename");
        },
      };
      const functions = runInNewContext(
        `${body}; ({run:retainDockerDesktopRepairRunDirectory,continuation:retainDockerDesktopRepairContinuationDirectory})`,
        {
          fs: fakeFs,
          Buffer,
          path,
          utilTypes,
          process: { platform: scenario === "non_windows" ? "linux" : "win32" },
        },
      ) as {
        run: (...args: unknown[]) => unknown;
        continuation: (...args: unknown[]) => unknown;
      };
      let expectedIdentity: unknown = identity;
      if (scenario === "bad_identity")
        expectedIdentity = { ...identity, dev: "0" };
      if (scenario === "extra") expectedIdentity = { ...identity, extra: true };
      if (scenario === "getter")
        expectedIdentity = {
          ...identity,
          get ino() {
            traps++;
            return "2";
          },
        };
      if (scenario === "proxy")
        expectedIdentity = new Proxy(identity, {
          ownKeys() {
            traps++;
            return [];
          },
        });
      const local =
        scenario === "relative"
          ? "relative"
          : scenario === "unc"
            ? "\\\\server\\share"
            : scenario === "root"
              ? "C:\\"
              : scenario === "noncanonical"
                ? `${localAppData}\\..\\Local`
                : localAppData;
      const id = scenario === "bad_id" ? "../outside" : operationId;
      const observed =
        purpose === "initial_run"
          ? functions.run(local, id, expectedIdentity)
          : functions.continuation(local, id, purpose, expectedIdentity);
      const expected =
        scenario === "normal"
          ? { issued: true, confirmation: "confirmed", staleState: "retained" }
          : [
                "after_unknown",
                "source_remains",
                "after_other",
                "parent_after_changed",
                "parent_after_unknown",
              ].includes(scenario)
            ? { issued: true, confirmation: "unknown", staleState: "unknown" }
            : ["target_same", "target_other"].includes(scenario)
              ? {
                  issued: false,
                  confirmation: "not_issued",
                  staleState:
                    scenario === "target_same" && purpose === "initial_run"
                      ? "retained"
                      : "unknown",
                }
              : unknown;
      assert.deepEqual(
        JSON.parse(JSON.stringify(observed)),
        expected,
        `${purpose}/${scenario}`,
      );
      assert.equal(
        moves,
        [
          "normal",
          "rename_throw",
          "after_unknown",
          "source_remains",
          "after_other",
          "parent_after_changed",
          "parent_after_unknown",
        ].includes(scenario)
          ? 1
          : 0,
        `${purpose}/${scenario}`,
      );
      assert.equal(traps, 0);
      if (
        [
          "non_windows",
          "relative",
          "unc",
          "root",
          "noncanonical",
          "bad_id",
          "bad_identity",
          "getter",
          "proxy",
          "extra",
        ].includes(scenario)
      )
        assert.equal(reads, 0);
      if (
        scenario === "parent_after_changed" ||
        scenario === "parent_after_unknown"
      ) {
        const mutatedBody = body.replace(
          /parentAfter.identity !== null\s*&&\s*sameDirectoryIdentity\(parent.identity, parentAfter.identity\)/u,
          "true",
        );
        assert.notEqual(mutatedBody, body);
        reads = moves = sourceReads = targetReads = parentReads = 0;
        const mutated = runInNewContext(
          `${mutatedBody}; ({run:retainDockerDesktopRepairRunDirectory,continuation:retainDockerDesktopRepairContinuationDirectory})`,
          {
            fs: fakeFs,
            Buffer,
            path,
            utilTypes,
            process: { platform: "win32" },
          },
        ) as typeof functions;
        const result =
          purpose === "initial_run"
            ? mutated.run(local, id, expectedIdentity)
            : mutated.continuation(local, id, purpose, expectedIdentity);
        assert.throws(() =>
          assert.deepEqual(JSON.parse(JSON.stringify(result)), expected),
        );
        assert.equal(moves, 1);
      }
    }
  }
});

/**
 * 下位Path字句条件を既存の上位契約と同じ値母集合で照合する。
 * @responsibility 修復用途のRoot拒否だけを追加し、不正値でFSへ到達しないことを確認する。
 * @trace ERB-IT-001
 * @precondition 上位predicateは試験入力としてのみ使い、Runtime逆依存は追加しない。
 * @stimulus ADS、末尾文字、予約名、制御文字、UTF-16と長さ境界、正常Unicodeを渡す。
 * @observation 字句判定とFilesystem／rename件数。
 * @oracle 上位条件かつ非Rootと一致し、不正値はFS0。
 * @cleanup N/A: 模擬Filesystemだけを使用する。
 * @boundary ERB-IT-001=Direct Boundary: 内部Path判定→Filesystem直前。
 */
test("LocalAppData字句条件は既存契約と一致し不正値はFS0", () => {
  const source = fs.readFileSync(
    new URL("../../src/desktop/runtime-directory.ts", import.meta.url),
    "utf8",
  );
  const body = stripTypeScriptTypes(
    source
      .replace(/^import .*;\r?$/gmu, "")
      .replaceAll("export function", "function"),
  );
  const paths: unknown[] = [
    localAppData,
    "C:\\正常\\作業",
    "C:\\emoji-😀",
    "C:\\ordinary.name",
    "C:\\",
    "c:\\Users\\fixture",
    "relative",
    "\\\\server\\share",
    "C:\\name:stream",
    "C:\\name.",
    "C:\\name ",
    "C:\\CON",
    "C:\\con.txt",
    "C:\\LPT¹",
    "C:\\CONIN$",
    "C:\\com1 .txt",
    "C:\\LPTı",
    "C:\\CONOUT$",
    "C:\\name\t",
    "C:\\name\u007f",
    "C:\\name\ud800",
    "C:\\name?",
    "C:\\name|",
    "C:\\name*",
    "C:\\name<",
    'C:\\name"',
    "C:\\name/child",
    "C:\\parent\\..\\child",
    "C:\\x\\",
    `C:\\${"x".repeat(4093)}`,
    `C:\\${"x".repeat(4094)}`,
    `C:\\${"界".repeat(1365)}`,
    undefined,
    null,
    12,
    new String(localAppData),
  ];
  for (const value of paths) {
    let reads = 0,
      moves = 0;
    const functions = runInNewContext(
      `${body}; ({guard:isRepairLocalAppDataPath,run:retainDockerDesktopRepairRunDirectory})`,
      {
        Buffer,
        path,
        utilTypes,
        process: { platform: "win32" },
        fs: {
          lstatSync() {
            reads++;
            throw new Error("unobserved");
          },
          renameSync() {
            moves++;
          },
        },
      },
    ) as {
      guard: (value: unknown) => boolean;
      run: (...args: unknown[]) => unknown;
    };
    const valid =
      isSupportedWindowsAbsolutePathCandidate(value) &&
      value !== path.win32.parse(value).root;
    assert.equal(functions.guard(value), valid, String(value));
    assert.deepEqual(
      JSON.parse(JSON.stringify(functions.run(value, operationId, identity))),
      unknown,
    );
    assert.equal(reads, valid ? 1 : 0);
    assert.equal(moves, 0);
  }
});

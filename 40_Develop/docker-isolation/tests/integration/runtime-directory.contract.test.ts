/**
 * Runtime Directoryロック観測の移管元と同じ反証を実行する。
 * @packageDocumentation
 * @responsibility 親実体・entry差・既知拒否だけの観測成立を確認する。
 * @trace ERB-IT-001
 * @level IT
 * @scope Docker Runtime Directoryの読取り観測。
 * @boundary ERB-IT-001=Direct Boundary: 下位固定観測と依存差替え。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as publicApi from "../../src/index.ts";
import { observeDockerRuntimeDirectoryLockUsingDependencies } from "../../src/docker-desktop/directory.ts";
const RUN_IDENTITY = Object.freeze({ dev: "1", ino: "2", birthtimeNs: "3" });

/**
 * 公開Rootの固定FS接続と非公開seamの境界を確認する。
 * @responsibility 実wrapperが依存差替えを受けず、同じ安定ロック判定へ接続することを確認する。
 * @trace ERB-IT-001
 * @precondition 既存Directoryの実lstatとNode組込みFSの局所差替えを使う。
 * @stimulus 安定親と既知拒否、未知拒否、close失敗を渡す。
 * @observation 公開結果、open／close件数と公開集合。
 * @oracle 既知拒否だけ識別子、その他はnull、内部seamは非公開。
 * @cleanup 組込みFSの差替えをTest hookで復元する。実ファイル変更0。
 * @boundary ERB-IT-001=Related 2 Blocks: 公開Root→固定FS接続→技術観測。
 */
test("公開Rootは固定FS観測だけを提供する", (t) => {
  assert.equal(
    "observeDockerRuntimeDirectoryLockUsingDependencies" in publicApi,
    false,
  );
  assert.equal("awaitDockerRepairEngineUsing" in publicApi, false);
  if (process.platform !== "win32") {
    assert.equal(
      publicApi.observeDockerRuntimeDirectoryLock("C:\\Docker\\run"),
      null,
    );
    return;
  }
  const observed = fs.lstatSync(import.meta.dirname, { bigint: true });
  t.mock.method(fs, "lstatSync", () => observed);
  t.mock.method(
    fs,
    "readdirSync",
    () =>
      [
        {
          name: "endpoint.sock",
          isDirectory: () => false,
          isSymbolicLink: () => true,
        },
      ] as fs.Dirent[],
  );
  let mode: "known" | "unknown" | "close_failure" = "known";
  let errorCode = "EACCES";
  let opens = 0,
    closes = 0;
  t.mock.method(fs, "openSync", () => {
    opens++;
    if (mode === "close_failure") return 1;
    throw Object.assign(new Error("fixture"), {
      code: mode === "known" ? errorCode : "EIO",
    });
  });
  t.mock.method(fs, "closeSync", () => {
    closes++;
    throw Object.assign(new Error("fixture"), { code: errorCode });
  });
  assert.deepEqual(
    publicApi.observeDockerRuntimeDirectoryLock("C:\\Docker\\run"),
    {
      dev: String(observed.dev),
      ino: String(observed.ino),
      birthtimeNs: String(observed.birthtimeNs),
    },
  );
  mode = "unknown";
  assert.equal(
    publicApi.observeDockerRuntimeDirectoryLock("C:\\Docker\\run"),
    null,
  );
  mode = "close_failure";
  for (const code of ["EIO", "EACCES", "EBUSY", "EPERM"]) {
    errorCode = code;
    const beforeOpen = opens,
      beforeClose = closes;
    assert.equal(
      publicApi.observeDockerRuntimeDirectoryLock("C:\\Docker\\run"),
      null,
      code,
    );
    assert.equal(opens - beforeOpen, 1, code);
    assert.equal(closes - beforeClose, 1, code);
  }
  mode = "known";
  for (const code of ["EACCES", "EBUSY", "EPERM"]) {
    errorCode = code;
    const beforeOpen = opens,
      beforeClose = closes;
    assert.ok(
      publicApi.observeDockerRuntimeDirectoryLock("C:\\Docker\\run"),
      code,
    );
    assert.equal(opens - beforeOpen, 1, code);
    assert.equal(closes - beforeClose, 0, code);
  }
});

/**
 * 未対応環境の本番wrapperがFSへ到達しないことを確認する。
 * @responsibility OS差を上位へ戻さず下位入口で拒否する。
 * @trace ERB-IT-001
 * @precondition 本番wrapper本文を独立VMで実行する。
 * @stimulus Linuxと未知OSを与え、FSと内部観測を監視する。
 * @observation null結果と全呼出し件数。
 * @oracle lstat・readdir・open・close・内部観測がすべて0。
 * @cleanup N/A: VM内だけで実FS操作0。
 * @boundary ERB-IT-001=Related 2 Blocks: 公開wrapper→環境判定→観測。
 */
test("未対応OSではDirectory観測のFS要求を発行しない", () => {
  const source = fs.readFileSync(
    new URL("../../src/docker-desktop/directory.ts", import.meta.url),
    "utf8",
  );
  const begin = source.indexOf(
    "export function observeDockerRuntimeDirectoryLock(",
  );
  assert.ok(begin >= 0);
  const body = stripTypeScriptTypes(
    source.slice(begin).replace("export function", "function"),
  );
  for (const platform of ["linux", "unknown"]) {
    let calls = 0;
    const run = runInNewContext(`${body}; observeDockerRuntimeDirectoryLock`, {
      process: { platform },
      fs: new Proxy(
        {},
        {
          get() {
            calls++;
            throw new Error("unexpected_fs");
          },
        },
      ),
      observeDockerRuntimeDirectoryLockUsingDependencies: () => {
        calls++;
        throw new Error("unexpected_observation");
      },
    }) as (directory: string) => unknown;
    assert.equal(run("C:\\Docker\\run"), null);
    assert.equal(calls, 0);
  }
});

/**
 * Docker runtime directoryのlock観測は特定socket名に依存せず、境界変化を拒否するを検証する。
 *
 * @responsibility Docker runtime directoryのlock観測は特定socket名に依存せず、境界変化を拒否するの合否判定を所有する。
 * @trace ERB-IT-001
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Docker runtime directoryのlock観測は特定socket名に依存せず、境界変化を拒否するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary ERB-IT-001=Direct Boundary: Docker Isolation Test Source→対象契約
 */
test("Docker runtime directoryのlock観測は特定socket名に依存せず、境界変化を拒否する", () => {
  const entries = [
    { name: "sailor-ingest.sock", isDirectory: false, isSymbolicLink: false },
    {
      name: "userAnalyticsOtlpHttp.sock",
      isDirectory: false,
      isSymbolicLink: false,
    },
  ] as const;
  const observe = (
    overrides: Partial<
      Parameters<typeof observeDockerRuntimeDirectoryLockUsingDependencies>[1]
    > = {},
  ) =>
    observeDockerRuntimeDirectoryLockUsingDependencies("C:\\Docker\\run", {
      identityAt: () => RUN_IDENTITY,
      readEntries: () => entries,
      probeEntry: (target) => {
        if (target.endsWith("sailor-ingest.sock"))
          throw Object.assign(new Error("locked"), { code: "EACCES" });
      },
      ...overrides,
    });
  assert.deepEqual(observe(), RUN_IDENTITY);
  assert.deepEqual(
    observe({
      readEntries: () =>
        entries.map((entry) => ({ ...entry, isSymbolicLink: true })),
      probeEntry: () => {
        throw Object.assign(new Error("locked Windows AF_UNIX endpoint"), {
          code: "EACCES",
        });
      },
    }),
    RUN_IDENTITY,
  );
  assert.equal(
    observe({
      probeEntry: () => undefined,
    }),
    null,
  );
  assert.equal(
    observe({
      readEntries: () =>
        Array.from({ length: 65 }, (_unusedEntry, index) => ({
          name: `socket-${index}`,
          isDirectory: false,
          isSymbolicLink: false,
        })),
    }),
    null,
  );
  assert.equal(
    observe({
      readEntries: () => [
        { name: "nested", isDirectory: true, isSymbolicLink: false },
      ],
    }),
    null,
  );
  assert.equal(
    observe({
      readEntries: () =>
        entries.map((entry) => ({ ...entry, isSymbolicLink: true })),
      probeEntry: () => {
        throw Object.assign(new Error("unexpected observation failure"), {
          code: "EINVAL",
        });
      },
    }),
    null,
  );
  assert.equal(
    observe({
      identityAt: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return calls === 1 ? RUN_IDENTITY : { ...RUN_IDENTITY, ino: "99" };
        };
      })(),
    }),
    null,
  );
  assert.equal(
    observe({
      readEntries: (() => {
        let calls = 0;
        return () => {
          calls += 1;
          return calls === 1
            ? entries
            : [{ ...entries[0], name: "replaced.sock" }];
        };
      })(),
    }),
    null,
  );
});

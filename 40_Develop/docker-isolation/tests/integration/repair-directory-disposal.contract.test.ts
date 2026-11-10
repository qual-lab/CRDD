/**
 * 固定退避Root全体のNode削除と、前後のRoot境界を検証する。
 * @packageDocumentation
 * @responsibility 要求前拒否、部分失敗、処理中取消と不存在を区別する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 新品Repository-local Filesystemと有限代役。実Docker・過去保持物は対象外。
 * @boundary 実Driver→Node再帰削除、固定factory→内部Driver。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import test from "node:test";
import { types } from "node:util";
import { runInNewContext } from "node:vm";
import { createRepositoryTestDirectory } from "../../../domain-model/tests/support/repository-test-directory.ts";

const driverText = fs.readFileSync(
  new URL("../../src/docker-desktop/dispose.ts", import.meta.url),
  "utf8",
);
const driverBody = stripTypeScriptTypes(
  driverText
    .slice(driverText.indexOf("function readDirectory"))
    .replace(/^export /gmu, ""),
);
type Result = {
  request: "issued" | "not_issued";
  absence: "confirmed_absent" | "unknown";
};
type Expected = { dev: string; ino: string; birthtimeNs: string };
function driver(filesystem: unknown, wait: () => Promise<void>) {
  return runInNewContext(`${driverBody}; disposeDockerRepairDirectory`, {
    fs: filesystem,
    path,
    types,
    setImmediate: wait,
  }) as (
    targets: { source: string; target: string },
    expected: Expected | null,
    boundary: () => unknown,
  ) => Promise<Result>;
}

/**
 * Node標準のtree削除で外側の内容を巻き込まず、深さ・件数の旧制限を持たないことを確認する。
 * @responsibility Linkを含む新品Rootだけを消し、sourceとその内容を保全する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition Repository-local新品領域だけ。Windowsで実行する。
 * @stimulus 深さ10・260file・外側へのjunction／symlink／hardlinkとRoot自体のjunction。
 * @observation Root不存在、外側内容と処置結果。
 * @oracle 通常Rootだけ回収し、RootのLinkは要求0。Nativeは呼ばない。
 * @cleanup fixtureが今回Rootの同実体だけを回収する。
 * @boundary Node実Filesystem。特殊Socket実物・敵対差替えは未検証。
 */
test("Host Windows: 退避Root全体のNode削除は外側のLink先を巻き込まない", {
  skip: process.platform !== "win32",
}, async (t) => {
  const fixture = createRepositoryTestDirectory(
    "recursive-directory-disposal-",
  );
  t.after(() => fixture.cleanup());
  const source = path.join(fixture.path, "run");
  const target = path.join(fixture.path, "run.crdd-stale-" + "a".repeat(32));
  fs.mkdirSync(source);
  fs.writeFileSync(path.join(source, "preserved"), "source");
  let nested = target;
  for (let i = 0; i < 10; i++) nested = path.join(nested, "nested");
  fs.mkdirSync(nested, { recursive: true });
  for (let i = 0; i < 260; i++)
    fs.writeFileSync(path.join(nested, `value-${i}`), "owned");
  fs.symlinkSync(source, path.join(target, "junction"), "junction");
  fs.symlinkSync(
    path.join(source, "preserved"),
    path.join(target, "symlink"),
    "file",
  );
  fs.linkSync(path.join(source, "preserved"), path.join(target, "hardlink"));
  const stat = fs.lstatSync(target, { bigint: true });
  const expected = {
    dev: String(stat.dev),
    ino: String(stat.ino),
    birthtimeNs: String(stat.birthtimeNs),
  };
  const run = driver(
    fs,
    () => new Promise<void>((resolve) => setImmediate(resolve)),
  );
  const result = await run({ source, target }, expected, () => true);
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    request: "issued",
    absence: "confirmed_absent",
  });
  assert.throws(() => fs.lstatSync(target), { code: "ENOENT" });
  assert.equal(
    fs.readFileSync(path.join(source, "preserved"), "utf8"),
    "source",
  );
  assert.equal(fs.statSync(path.join(source, "preserved")).nlink, 1);
  const absent = await run({ source, target }, expected, () => true);
  assert.deepEqual(JSON.parse(JSON.stringify(absent)), {
    request: "not_issued",
    absence: "confirmed_absent",
  });
  fs.symlinkSync(source, target, "junction");
  const rejected = await run({ source, target }, expected, () => true);
  assert.deepEqual(JSON.parse(JSON.stringify(rejected)), {
    request: "not_issued",
    absence: "unknown",
  });
  assert.equal(
    fs.readFileSync(path.join(source, "preserved"), "utf8"),
    "source",
  );
});

/**
 * 一回のrm要求の前後境界と失敗履歴を、実Driver本文で確認する。
 * @responsibility unknown・部分失敗を未発行や完了へ畳まない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 固定Windows Pathとメモリ内代役のみ。
 * @stimulus Root差・許可不明・削除失敗・後観測失敗と途中取消。
 * @observation rm引数・呼出回数・結果・Completion確定時点。
 * @oracle 前拒否は要求0、後失敗はissued/unknown、rm未完了中は返却しない。
 * @cleanup 全Promiseを試験中にsettle。外部Effectなし。
 * @boundary 実Driver→有限Filesystem代役。
 */
test("Root回収は一回のrmを待ち、部分失敗と途中取消を成功にしない", async () => {
  const parent = "C:\\fixture\\Docker",
    source = parent + "\\run",
    target = parent + "\\run.crdd-stale-" + "a".repeat(32);
  for (const scenario of [
    "normal",
    "absent",
    "absent_source_unknown",
    "wrong_expected",
    "no_expected",
    "parent_unknown",
    "root_unknown",
    "source_unknown",
    "root_link",
    "alias",
    "wrong_parent",
    "cancel_before",
    "guard_throw",
    "guard_promise",
    "guard_rejected",
    "root_changed",
    "parent_changed",
    "source_changed",
    "rm_failure",
    "partial_failure",
    "reappeared",
    "post_unknown",
    "parent_after",
    "source_after",
    "cancel_during",
  ]) {
    const entries = new Map([
      [parent, 1n],
      [source, 2n],
      [target, scenario === "alias" ? 2n : 3n],
    ]);
    if (scenario.startsWith("absent")) entries.delete(target);
    let permitted = true,
      calls = 0,
      partial = false,
      finished = false;
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = driver(
      {
        lstatSync: (value: string) => {
          if (
            (scenario === "parent_unknown" && value === parent) ||
            (scenario === "root_unknown" && value === target) ||
            (["source_unknown", "absent_source_unknown"].includes(scenario) &&
              value === source) ||
            (scenario === "post_unknown" && calls > 0)
          )
            throw Object.assign(new Error("fixture_unknown"), {
              code: "EACCES",
            });
          const ino = entries.get(value);
          if (!ino)
            throw Object.assign(new Error("fixture_absent"), {
              code: "ENOENT",
            });
          return {
            dev: 1n,
            ino,
            birthtimeNs: 3n,
            isDirectory: () => true,
            isSymbolicLink: () => scenario === "root_link" && value === target,
          };
        },
        realpathSync: { native: (value: string) => value },
        promises: {
          rm: async (value: string, options: unknown) => {
            assert.equal(value, target);
            assert.deepEqual(JSON.parse(JSON.stringify(options)), {
              recursive: true,
              force: false,
              maxRetries: 0,
            });
            calls++;
            if (scenario === "cancel_during") await held;
            if (scenario === "rm_failure") throw new Error("fixture_rm");
            if (scenario === "partial_failure") {
              partial = true;
              throw new Error("fixture_partial");
            }
            entries.delete(target);
            if (scenario === "reappeared") entries.set(target, 999n);
            if (scenario === "parent_after") entries.set(parent, 999n);
            if (scenario === "source_after") entries.set(source, 999n);
          },
        },
      },
      async () => {
        if (scenario === "root_changed") entries.set(target, 999n);
        if (scenario === "parent_changed") entries.set(parent, 999n);
        if (scenario === "source_changed") entries.set(source, 999n);
        if (scenario === "cancel_before") permitted = false;
      },
    );
    const completion = run(
      {
        source,
        target: scenario === "wrong_parent" ? "C:\\other\\target" : target,
      },
      scenario === "no_expected"
        ? null
        : {
            dev: "1",
            ino: scenario === "wrong_expected" ? "999" : "3",
            birthtimeNs: "3",
          },
      () => {
        if (scenario === "guard_throw") throw new Error("fixture_guard");
        if (scenario === "guard_promise") return Promise.resolve(true);
        if (scenario === "guard_rejected")
          return Promise.reject(new Error("fixture_rejected"));
        return permitted;
      },
    ).then((result) => {
      finished = true;
      return result;
    });
    if (scenario === "cancel_during") {
      await new Promise<void>((resolve) => setImmediate(resolve));
      assert.equal(calls, 1);
      permitted = false;
      assert.equal(finished, false);
      release();
    }
    const result = await completion;
    const issued = [
      "normal",
      "rm_failure",
      "partial_failure",
      "reappeared",
      "post_unknown",
      "parent_after",
      "source_after",
      "cancel_during",
    ].includes(scenario);
    assert.equal(calls, issued ? 1 : 0, scenario);
    assert.deepEqual(
      JSON.parse(JSON.stringify(result)),
      {
        request: issued ? "issued" : "not_issued",
        absence: ["normal", "absent", "absent_source_unknown"].includes(
          scenario,
        )
          ? "confirmed_absent"
          : "unknown",
      },
      scenario,
    );
    assert.equal(
      entries.get(source),
      scenario === "source_changed" || scenario === "source_after" ? 999n : 2n,
      scenario,
    );
    if (scenario === "partial_failure") assert.equal(partial, true);
  }
});

/**
 * 固定factoryの三用途が同じ導出値だけをDriverへ渡すことを確認する。
 * @responsibility 任意Path入力と不正実体・Proxyを回収能力へ昇格しない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 実factory／Scope本文と模擬Local Directory観測。
 * @stimulus 三用途・不正用途・Accessor実体を渡す。
 * @observation Driverへ渡すsource／target・expected・現在Scope callback。
 * @oracle 三用途は同nonce由来の別target。不正値はDriver到達0。
 * @cleanup N/A: 実Filesystem／Process Effect 0。
 * @boundary ERB-IT-001／ERB-IT-002=Direct Boundary: 実factory→模擬Driver。
 */
test("回収factoryは三つの固定対象だけを接続する", async () => {
  const sourceText = fs.readFileSync(
    new URL("../../src/docker-desktop/directory.ts", import.meta.url),
    "utf8",
  );
  const start = sourceText.indexOf("type RepairDirectoryRetention");
  assert.ok(start > 0);
  const body = stripTypeScriptTypes(
    sourceText.slice(start).replace(/^export /gmu, ""),
  );
  const calls: { source: string; target: string }[] = [];
  const factory = runInNewContext(
    `${body}; createDockerDesktopRepairDirectoryAccess`,
    {
      Buffer,
      path,
      createHash,
      types,
      process: { platform: "win32" },
      fs: {
        lstatSync: () => ({
          dev: 1n,
          ino: 2n,
          birthtimeNs: 3n,
          isDirectory: () => true,
          isSymbolicLink: () => false,
        }),
        realpathSync: { native: (value: string) => value },
      },
      disposeDockerRepairDirectory: async (
        targets: { source: string; target: string },
        expected: unknown,
        boundary: () => unknown,
      ) => {
        assert.equal(boundary(), true);
        assert.deepEqual(JSON.parse(JSON.stringify(expected)), {
          dev: "1",
          ino: "3",
          birthtimeNs: "3",
        });
        calls.push({ ...targets });
        return { request: "not_issued", absence: "confirmed_absent" };
      },
    },
  ) as (...args: unknown[]) => {
    dispose: (
      purpose: unknown,
      expected: unknown,
      canIssue: () => unknown,
    ) => Promise<unknown>;
  };
  const access = factory(
    "C:\\fixture\\Local",
    "a".repeat(64),
    "b".repeat(64),
    "c".repeat(64),
  );
  for (const purpose of ["initial", "failed", "auxiliary"])
    await access.dispose(
      purpose,
      { dev: "1", ino: "3", birthtimeNs: "3" },
      () => true,
    );
  assert.equal(calls.length, 3);
  assert.equal(calls[0]?.source, "C:\\fixture\\Local\\Docker\\run");
  assert.equal(calls[1]?.source, calls[0]?.source);
  assert.equal(calls[2]?.source, "C:\\fixture\\Local\\docker-secrets-engine");
  const primary = calls[0]?.target;
  assert.ok(primary);
  assert.match(primary, /\\run\.crdd-stale-[a-f0-9]{32}$/u);
  assert.equal(calls[1]?.target, `${primary}-restart`);
  assert.equal(
    calls[2]?.target,
    `C:\\fixture\\Local\\docker-secrets-engine.crdd-stale-${primary.slice(-32)}`,
  );
  let traps = 0;
  const proxy = new Proxy(
    { dev: "1", ino: "3", birthtimeNs: "3" },
    {
      get() {
        traps++;
        throw new Error("trap");
      },
    },
  );
  await access.dispose("initial", proxy, () => true);
  await access.dispose(
    "other",
    { dev: "1", ino: "3", birthtimeNs: "3" },
    () => true,
  );
  assert.equal(calls.length, 3);
  assert.equal(traps, 0);
});

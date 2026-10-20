/**
 * 固定旧targetの回収を実本文と模擬Filesystem境界で検証する。
 * @packageDocumentation
 * @responsibility 型・実体・Scope不明の削除0と部分要求後の不明を区別する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @level IT
 * @scope 内部Driverと固定factoryの接続。保存・Session・実Hostは別確認。
 * @boundary ERB-IT-001／ERB-IT-002=Direct Boundary: 実Driver→模擬Node／Native観測・削除。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";

/**
 * 試験内の物理entryを模擬する。
 * @responsibility NativeとNodeで別単位の観測を供給する。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @shape 種別と擬似inodeだけ。
 * @invariant 実PathやOS資源を生成しない。
 * @boundary メモリ内だけ。
 * @security Authorityを保持しない。
 * @compatibility 本試験の固定種別だけ。
 */
type FixtureEntry = {
  kind: "directory" | "file" | "socket" | "unknown";
  ino: bigint;
  links?: number;
  attributes?: number;
  tag?: number;
};

/**
 * 回収の全preflightと処置・後観測を独立した要求列で検査する。
 * @responsibility 初期拒否と部分成功を同じEffect 0へ畳まない。
 * @trace ERB-IT-001
 * @trace ERB-IT-002
 * @precondition 実Driver本文、固定Windows PathとメモリFSだけ。
 * @stimulus 正常型、未知型・実体差・上限、取消、削除失敗・追加entry・後観測不明。
 * @observation 全unlink／rmdir対象、列挙close、要求状態と不存在。
 * @oracle 正常だけ全対象不存在。初期不明は要求0、要求後失敗はissued／unknown。
 * @cleanup N/A: 実Filesystem／Process Effect 0。
 * @boundary ERB-IT-001／ERB-IT-002=Direct Boundary: 実Driverと模擬外部境界。
 */
test("固定退避物の回収は全preflight・fresh実体・現在許可を必要とする", async () => {
  const sourceText = fs.readFileSync(
    new URL("../../src/docker-desktop/dispose.ts", import.meta.url),
    "utf8",
  );
  const begin = sourceText.indexOf("const maximumEntries");
  assert.ok(begin > 0);
  const body = stripTypeScriptTypes(
    sourceText.slice(begin).replace(/^export /gmu, ""),
  );
  const parent = "C:\\fixture\\Docker",
    source = `${parent}\\run`,
    root = `${parent}\\run.crdd-stale-${"a".repeat(32)}`;
  /**
   * 同じ固定Oracleを正常本文と一意変異へ適用する。
   * @responsibility 変異に合わせて期待を変更しない。
   * @trace ERB-IT-001
   * @trace ERB-IT-002
   * @input program: 実本文または一箇所変異。
   * @returns 全ケースの独立期待が一致したとき完了。
   * @precondition 実境界を使わない。
   * @stimulus 正常・不存在・親差替え・Owner喪失・観測不明を独立入力で実行する。
   * @observation 処置要求列、返却値と残存状態。
   * @oracle ケース固有の独立期待を変異前後で維持する。
   * @cleanup N/A: 模擬Filesystem内で完結する。
   * @postcondition 各ケースのメモリを分離する。
   * @effect 模擬要求と局所Assertionだけ。
   * @failure 期待差はAssertion失敗。
   * @invariant 同じ要求列と残存期待を使う。
   * @boundary 実Driver本文と模擬Filesystem。
   * @security 実削除0。
   * @concurrency 各ケースを直列実行する。
   */
  const runCases = async (program: string) => {
    for (const scenario of [
      "normal",
      "empty",
      "absent",
      "absent_source_unknown",
      "absent_source_noncanonical",
      "absent_native_unknown",
      "absent_node_present",
      "absent_node_denied",
      "absent_parent_changed",
      "absent_parent_native_changed",
      "absent_owner_lost",
      "absent_owner_throw",
      "wrong_expected",
      "no_expected",
      "unknown_tag",
      "hardlink",
      "root_type",
      "source_same",
      "parent_unknown",
      "source_unknown",
      "source_noncanonical",
      "guard_false",
      "guard_throw",
      "guard_promise",
      "guard_rejected_promise",
      "guard_thenable",
      "native_name_rejected",
      "junction",
      "device",
      "directory_socket",
      "late_identity",
      "late_tag",
      "late_links",
      "late_ancestor",
      "late_intermediate",
      "cancel_preflight",
      "cancel_after_effect",
      "source_change",
      "root_change",
      "delete_throw",
      "post_unknown",
      "entry_added",
      "close_fail",
      "entry_limit",
      "depth_limit",
    ]) {
      const entries = new Map<string, FixtureEntry>([
        [parent, { kind: "directory", ino: 1n }],
        [source, { kind: "directory", ino: 2n }],
        [root, { kind: "directory", ino: 3n }],
      ]);
      if (
        ![
          "empty",
          "absent",
          "entry_limit",
          "depth_limit",
          "late_intermediate",
        ].includes(scenario)
      ) {
        entries.set(`${root}\\value`, {
          kind: scenario === "unknown_tag" ? "unknown" : "file",
          ino: 4n,
          links: scenario === "hardlink" ? 2 : 1,
        });
        entries.set(`${root}\\empty`, { kind: "directory", ino: 5n });
        entries.set(`${root}\\endpoint.sock`, { kind: "socket", ino: 6n });
      }
      if (scenario === "late_intermediate") {
        entries.set(`${root}\\nested`, { kind: "directory", ino: 7n });
        entries.set(`${root}\\nested\\leaf`, { kind: "file", ino: 8n });
      }
      if (scenario === "entry_limit")
        for (let index = 0; index < 256; index++)
          entries.set(`${root}\\file-${index}`, {
            kind: "file",
            ino: BigInt(index + 10),
          });
      if (scenario === "depth_limit") {
        let current = root;
        for (let depth = 0; depth < 9; depth++) {
          current += "\\child";
          entries.set(current, { kind: "directory", ino: BigInt(depth + 10) });
        }
      }
      if (scenario.startsWith("absent") && scenario !== "absent_node_present")
        entries.delete(root);
      if (scenario === "root_type")
        entries.set(root, { kind: "unknown", ino: 3n });
      if (scenario === "source_same")
        entries.set(source, { kind: "directory", ino: 3n });
      if (scenario === "native_name_rejected") {
        entries.delete(`${root}\\value`);
        entries.set(`${root}\\foo.`, { kind: "file", ino: 4n });
      }
      if (["junction", "device", "directory_socket"].includes(scenario))
        entries.set(`${root}\\value`, {
          kind: scenario === "device" ? "file" : "directory",
          ino: 4n,
          attributes: scenario === "device" ? 0x40 : 0x410,
          tag:
            scenario === "junction"
              ? 0xa0000003
              : scenario === "device"
                ? 0
                : 0x80000023,
        });
      let allowed = true,
        yields = 0,
        effects = 0,
        opens = 0,
        closes = 0;
      let sourceReads = 0,
        parentNativeReads = 0,
        ownerReads = 0;
      const calls: [string, string][] = [];
      const run = runInNewContext(`${program}; disposeDockerRepairDirectory`, {
        path,
        types: utilTypes,
        yieldToOwner: async () => {
          yields++;
          if (scenario === "late_intermediate" && yields === 4)
            entries.set(`${root}\\nested`, { kind: "directory", ino: 999n });
          if (yields === 5) {
            const leaf = entries.get(`${root}\\endpoint.sock`);
            if (["late_identity", "late_tag", "late_links"].includes(scenario))
              assert.ok(leaf);
            if (leaf) {
              if (scenario === "late_identity") leaf.ino = 999n;
              if (scenario === "late_tag") leaf.tag = 0x80000024;
              if (scenario === "late_links") leaf.links = 2;
            }
          }
          if (scenario === "late_ancestor" && effects === 1)
            entries.set(`${root}\\empty`, { kind: "directory", ino: 888n });
          if (
            scenario === "cancel_preflight" ||
            (scenario === "cancel_after_effect" && effects > 0)
          )
            allowed = false;
          if (scenario === "source_change")
            entries.set(source, { kind: "directory", ino: 8n });
          if (scenario === "root_change")
            entries.set(root, { kind: "directory", ino: 8n });
        },
        observeWindowsFilesystemEntry(target: string) {
          if (target === source) sourceReads++;
          if (target === parent) parentNativeReads++;
          if (target === root && scenario === "absent_node_present")
            return { status: "confirmed_absent" };
          if (target === root && scenario === "absent_native_unknown")
            return null;
          if (target === root && scenario === "absent_parent_changed")
            entries.set(parent, { kind: "directory", ino: 999n });
          if (scenario === "native_name_rejected" && target.endsWith("foo."))
            return null;
          if (
            (scenario === "parent_unknown" && target === parent) ||
            (["source_unknown", "absent_source_unknown"].includes(scenario) &&
              target === source) ||
            (scenario === "post_unknown" && effects > 0)
          )
            return null;
          const entry = entries.get(target);
          if (!entry) return { status: "confirmed_absent" };
          return {
            status: "present",
            attributes:
              entry.attributes ??
              (entry.kind === "directory"
                ? 16
                : entry.kind === "socket" || entry.kind === "unknown"
                  ? 0x420
                  : 32),
            reparseTag:
              entry.tag ??
              (entry.kind === "socket"
                ? 0x80000023
                : entry.kind === "unknown"
                  ? 0x80000024
                  : 0),
            identity: {
              volumeSerialNumber: 77,
              fileIndex:
                scenario === "absent_parent_native_changed" &&
                target === parent &&
                parentNativeReads > 1
                  ? "999"
                  : String(entry.ino),
              creationTime: "99999",
            },
            linkCount: entry.links ?? 1,
          };
        },
        fs: {
          lstatSync(target: string) {
            if (target === source) sourceReads++;
            if (target === root && scenario === "absent_node_denied")
              throw Object.assign(new Error("fixture_denied"), {
                code: "EACCES",
              });
            const entry = entries.get(target);
            if (!entry)
              throw Object.assign(new Error("fixture_absent"), {
                code: "ENOENT",
              });
            if (entry.kind === "socket")
              throw Object.assign(new Error("fixture_socket"), {
                code: "EACCES",
              });
            return {
              dev: 1n,
              ino: entry.ino,
              birthtimeNs: 3n,
              isDirectory: () => entry.kind === "directory",
              isSymbolicLink: () => entry.kind === "unknown",
            };
          },
          realpathSync: {
            native: (target: string) => {
              if (target === source) sourceReads++;
              return target === source &&
                ["source_noncanonical", "absent_source_noncanonical"].includes(
                  scenario,
                )
                ? `${target}-redirected`
                : target;
            },
          },
          opendirSync(target: string) {
            opens++;
            const names = Array.from(entries.keys())
              .filter((entry) => path.win32.dirname(entry) === target)
              .map((entry) => path.win32.basename(entry));
            let index = 0;
            return {
              readSync: () =>
                index < names.length ? { name: names[index++] } : null,
              closeSync: () => {
                closes++;
                if (scenario === "close_fail") throw new Error("fixture_close");
              },
            };
          },
          unlinkSync(target: string) {
            calls.push(["unlink", target]);
            effects++;
            if (scenario === "delete_throw") throw new Error("fixture_unlink");
            assert.ok(entries.has(target));
            entries.delete(target);
            if (scenario === "entry_added")
              entries.set(`${root}\\new-entry`, { kind: "unknown", ino: 20n });
          },
          rmdirSync(target: string) {
            calls.push(["rmdir", target]);
            effects++;
            assert.equal(
              Array.from(entries.keys()).some(
                (entry) => path.win32.dirname(entry) === target,
              ),
              false,
            );
            assert.ok(entries.has(target));
            entries.delete(target);
          },
        },
      }) as (
        targets: unknown,
        expected: unknown,
        boundary: () => unknown,
      ) => Promise<unknown>;
      const result = await run(
        { source, target: root },
        scenario === "no_expected"
          ? null
          : {
              dev: "1",
              ino: scenario === "wrong_expected" ? "999" : "3",
              birthtimeNs: "3",
            },
        () => {
          ownerReads++;
          if (scenario === "absent_owner_lost" && ownerReads > 1) return false;
          if (scenario === "absent_owner_throw" && ownerReads > 1)
            throw new Error("fixture_owner_lost");
          if (scenario === "guard_throw") throw new Error("fixture_guard");
          if (scenario === "guard_promise") return Promise.resolve(true);
          if (scenario === "guard_rejected_promise")
            return Promise.reject(new Error("fixture_rejection"));
          if (scenario === "guard_thenable")
            // biome-ignore lint/suspicious/noThenProperty: thenableのgetterを実行せず拒否する負例。
            return Object.defineProperty({}, "then", {
              get() {
                throw new Error("must_not_run");
              },
            });
          return scenario !== "guard_false" && allowed;
        },
      );
      const completed = [
        "normal",
        "empty",
        "absent",
        "absent_source_unknown",
        "absent_source_noncanonical",
      ].includes(scenario);
      const attempted = [
        "normal",
        "empty",
        "cancel_after_effect",
        "delete_throw",
        "post_unknown",
        "entry_added",
        "late_ancestor",
      ].includes(scenario);
      assert.deepEqual(
        JSON.parse(JSON.stringify(result)),
        {
          request: attempted ? "issued" : "not_issued",
          absence: completed ? "confirmed_absent" : "unknown",
        },
        scenario,
      );
      assert.ok(Object.isFrozen(result));
      if (
        ["absent_source_unknown", "absent_source_noncanonical"].includes(
          scenario,
        )
      )
        assert.equal(sourceReads, 0, scenario);
      assert.equal(opens, closes, scenario);
      assert.equal(calls.length > 0, attempted, scenario);
      assert.ok(
        calls.every(
          ([, target]) => target === root || target.startsWith(`${root}\\`),
        ),
        scenario,
      );
      assert.ok(entries.has(source) && entries.has(parent), scenario);
      if (completed) assert.equal(entries.has(root), false, scenario);
      if (scenario === "normal")
        assert.deepEqual(calls, [
          ["unlink", `${root}\\endpoint.sock`],
          ["rmdir", `${root}\\empty`],
          ["unlink", `${root}\\value`],
          ["rmdir", root],
        ]);
      if (scenario === "entry_added")
        assert.ok(entries.has(`${root}\\new-entry`));
      if (scenario === "late_intermediate") {
        assert.deepEqual(calls, []);
        assert.deepEqual(
          Array.from(entries.keys()).sort(),
          [
            parent,
            source,
            root,
            `${root}\\nested`,
            `${root}\\nested\\leaf`,
          ].sort(),
        );
        assert.equal(entries.get(`${root}\\nested\\leaf`)?.ino, 8n);
      }
      if (
        [
          "cancel_after_effect",
          "delete_throw",
          "post_unknown",
          "entry_added",
          "late_ancestor",
        ].includes(scenario)
      ) {
        assert.deepEqual(
          calls,
          [["unlink", `${root}\\endpoint.sock`]],
          scenario,
        );
        assert.deepEqual(
          Array.from(entries.keys()).sort(),
          [
            parent,
            source,
            root,
            `${root}\\value`,
            `${root}\\empty`,
            ...(scenario === "delete_throw" ? [`${root}\\endpoint.sock`] : []),
            ...(scenario === "entry_added" ? [`${root}\\new-entry`] : []),
          ].sort(),
          scenario,
        );
      }
    }
  };
  await runCases(body);
  const noAncestor = body.replace("!ancestorsMatch(node.target) ||", "");
  assert.notEqual(noAncestor, body);
  await assert.rejects(() => runCases(noAncestor), assert.AssertionError);
  const noPermission = body.replace("return value === true;", "return true;");
  assert.notEqual(noPermission, body);
  await assert.rejects(() => runCases(noPermission), assert.AssertionError);
  const ancestorIdentity = `!sameNative(
            observeWindowsFilesystemEntry(directory),
            expectedNode.observed,
          )`;
  assert.equal(body.split(ancestorIdentity).length, 2);
  await assert.rejects(
    () => runCases(body.replace(ancestorIdentity, "false")),
    assert.AssertionError,
  );
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
      utilTypes,
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

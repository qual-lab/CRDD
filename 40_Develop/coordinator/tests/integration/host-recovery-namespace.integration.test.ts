/**
 * 共有境界の初期化搬送と停止時の部分結果を局所確認する。
 *
 * @packageDocumentation
 * @responsibility Native出所拒否、mode相関、部分作成と不明を同じ本体で反証する。
 * @trace ERB-IT-003
 * @level IT
 * @scope 固定frameとNative出所境界の局所搬送。実Native・実OS作成は別の未確認条件。
 * @boundary Native搬送Adapterを非Authorityのmemory依存で確認する。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import test from "node:test";
import { runInNewContext } from "node:vm";

/**
 * 本番作成入口の保護検証順序と失敗移送を同じ本体で確認する。
 *
 * @responsibility 出所拒否後のRoot作成と、下位負例の早期拒否への置換を防ぐ。
 * @trace ERB-IT-003
 * @precondition 現本体Sourceと非Authority依存のみ。実共有領域を使用しない。
 * @stimulus Windows正常・初期化停止・親不正・下位失敗と非Windowsを与える。
 * @observation 初期化→生成の順序、opaque失敗分類、渡した親。
 * @oracle Windows停止は生成0・清掃未確認・IDなし。非Windowsは既存primitiveだけ。
 * @cleanup N/A: 実OS Effectなし。
 * @boundary 通常作成Owner→出所照合初期化Adapter／下位primitiveの局所接続。
 */
test("通常producerはWindows保護検証をRoot・marker生成より先に行う", () => {
  const source = readFileSync(
    new URL("../../src/execution/operation.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /createDirectories: createProtectedRuntimeOwnedOperationDirectories,/u,
  );
  const body = sourceDeclaration(
    source,
    "createProtectedRuntimeOwnedOperationDirectories",
  );
  for (const scenario of [
    "normal",
    "blocked",
    "bad_parent",
    "primitive_failure",
    "non_windows",
  ]) {
    const events: string[] = [];
    const root = Object.freeze({ fixture: "owned" });
    const primitiveFailure = new Error("fixture_root_creation_failed");
    let classification: {
      cleanupConfirmed: boolean;
      hostRecoveryId: string | null;
    } | null = null;
    const executeAdapter = runInNewContext(`(${body})`, {
      process: { platform: scenario === "non_windows" ? "linux" : "win32" },
      fs: {
        realpathSync: () => "C:\\fixture\\parent",
        lstatSync: () => ({
          isDirectory: () => scenario !== "bad_parent",
          isSymbolicLink: () => false,
        }),
      },
      os: { tmpdir: () => "C:\\fixture\\parent" },
      initializeWindowsHostRecordNamespace: (parent: string) => {
        events.push("initialize");
        assert.equal(parent, "C:\\fixture\\parent");
        return { status: scenario === "blocked" ? "blocked" : "initialized" };
      },
      createOwnedOperationDirectories: (parent?: string) => {
        events.push("create");
        assert.equal(
          parent,
          scenario === "non_windows" ? undefined : "C:\\fixture\\parent",
        );
        if (scenario === "primitive_failure") throw primitiveFailure;
        return root;
      },
      fail: (
        cause: unknown,
        cleanupConfirmed: boolean,
        hostRecoveryId: string | null,
      ) => {
        classification = { cleanupConfirmed, hostRecoveryId };
        throw cause;
      },
    }) as () => unknown;
    if (["blocked", "bad_parent", "primitive_failure"].includes(scenario)) {
      assert.throws(executeAdapter);
      if (scenario === "primitive_failure") {
        assert.equal(classification, null);
      } else {
        assert.deepEqual(classification, {
          cleanupConfirmed: scenario === "bad_parent",
          hostRecoveryId: null,
        });
      }
    } else {
      assert.equal(executeAdapter(), root);
    }
    assert.deepEqual(
      events,
      scenario === "bad_parent"
        ? []
        : scenario === "blocked"
          ? ["initialize"]
          : scenario === "non_windows"
            ? ["create"]
            : ["initialize", "create"],
    );
  }
});

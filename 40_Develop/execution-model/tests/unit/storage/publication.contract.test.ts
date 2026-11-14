/**
 * 保存調停の短命証拠と借用Owner接続を確認する。
 * @responsibility 証拠の寿命とEffect保存を有限依存で反証する。
 * @trace ERB-UT-024
 * @level UT
 * @scope Storage内部の一回保存接続。物理保存の成立とは区別する。
 * @boundary Source読取りとVM内だけ。実AI・Docker・保持物は操作しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../support/source-declaration.ts";

const source = fs.readFileSync(
  new URL("../../../src/storage/publication.ts", import.meta.url),
  "utf8",
);
const recovery = stripTypeScriptTypes(
  sourceDeclaration(source, "publishRecoveryState"),
).replace("export function", "function");

/**
 * 四用途の証拠を一回のWriter接続後に失効する。
 * @responsibility 意味側へMapや可変証拠を返さない接続を確認する。
 * @trace ERB-UT-024
 * @precondition 閉じた四用途と有限Writer代役。
 * @stimulus 保存成功・保存例外・初期化部分失敗とOwner失効を与える。
 * @observation 証拠の登録・削除、保存要求、初期化Effect、callback寿命。
 * @oracle Writerは一回、全終了で証拠消去、初期化Effectを失わない。
 * @cleanup VMのMapを破棄する。
 * @boundary 調停接続のみ。CAS・一回consume自体は実保存試験で確認する。
 */
test("保存調停は四用途の証拠を一回接続し全終了で失効する", () => {
  for (const kind of [
    "runtime_repair",
    "current_completion",
    "current_history",
    "authentication_unknown_closure",
  ]) {
    for (const mode of ["saved", "writer_throw", "initialization_partial"]) {
      const settlements = new Map(),
        initializations = new Map();
      let writes = 0,
        initialized = 0,
        live = true;
      let observedContext: object | null = null;
      let revalidate: (() => boolean) | null = null;
      const execute = runInNewContext(recovery + "; publishRecoveryState", {
        settlements,
        initializations,
        prepareStateInitialization: (context: object) => {
          initialized++;
          initializations.set(context, {});
          return {
            status: mode === "initialization_partial" ? "blocked" : "prepared",
            effectIssued: true,
            lockReleased: true,
          };
        },
        writeStateSnapshot: (
          _owner: unknown,
          repository: { revalidate: () => boolean } | null,
          _bytes: unknown,
          settlement: {
            currentHistory?: object;
            currentCompletion?: object;
          } | null,
          _unissued: unknown,
          _host: unknown,
          repair: object | undefined,
        ) => {
          if (!repository)
            return {
              status: "blocked",
              snapshotConfirmed: false,
              filesystemEffectIssued: false,
              lockReleased: true,
            };
          writes++;
          observedContext =
            repair ??
            settlement?.currentHistory ??
            settlement?.currentCompletion ??
            null;
          assert.ok(observedContext);
          const binding = settlements.get(observedContext);
          assert.ok(binding);
          if (
            kind === "current_history" ||
            kind === "authentication_unknown_closure"
          )
            assert.equal(repository.revalidate(), false);
          binding.used = true;
          assert.equal(repository.revalidate(), true);
          revalidate = repository.revalidate;
          if (mode === "writer_throw") throw Error("synthetic");
          return {
            status: "completed",
            snapshotConfirmed: true,
            filesystemEffectIssued: false,
            lockReleased: true,
          };
        },
      });
      const result = execute({
        kind,
        repository: { revalidate: () => live },
        recoveryId: "exact",
        before: kind === "runtime_repair" ? null : Buffer.from("before"),
        candidate: Buffer.from("candidate"),
        assertOwner: () => live,
        ...(kind === "runtime_repair" ? { purpose: "checkpoint" } : {}),
        ...(kind === "current_completion" || kind === "current_history"
          ? { operationKind: "runtime_repair", historyFile: null }
          : {}),
        ...(kind === "current_history"
          ? {
              stage: "checkpoint",
              pendingHistoryFile: null,
              retentionDays: null,
            }
          : {}),
        ...(kind === "authentication_unknown_closure"
          ? { observations: [] }
          : {}),
      });
      const partial =
        kind === "runtime_repair" && mode === "initialization_partial";
      assert.equal(writes, partial ? 0 : 1);
      assert.equal(initialized, kind === "runtime_repair" ? 1 : 0);
      assert.equal(result.filesystemEffectIssued, kind === "runtime_repair");
      assert.equal(settlements.size, 0);
      assert.equal(initializations.size, 0);
      if (
        kind === "current_history" ||
        kind === "authentication_unknown_closure"
      ) {
        assert.ok(revalidate);
        assert.equal(Reflect.apply(revalidate, undefined, []), false);
      }
      live = false;
    }
  }
});

/**
 * 不明用途は証拠登録・初期化・保存より前に拒否する。
 * @responsibility 内部Requestを任意保存Authorityへ広げない。
 * @trace ERB-UT-024
 * @precondition 不明用途・用途混在の有限入力。
 * @stimulus 不正kind・purpose・stage・operationKindを与える。
 * @observation MapとEffect境界の呼出し数。
 * @oracle 登録・初期化・実保存は0。
 * @cleanup メモリだけを破棄する。
 * @boundary Storage内部受付。Root公開は追加しない。
 */
test("保存調停は不明用途と用途混在をEffect前に拒否する", () => {
  const execute = runInNewContext(recovery + "; publishRecoveryState", {
    settlements: { set: () => assert.fail("proof issued") },
    prepareStateInitialization: () => assert.fail("initialization issued"),
    writeStateSnapshot: (_owner: unknown, repository: unknown) => {
      assert.equal(repository, null);
      return { status: "blocked" };
    },
  });
  for (const request of [
    { kind: "unknown" },
    { kind: "runtime_repair", purpose: "history" },
    { kind: "current_completion", operationKind: "unknown" },
    {
      kind: "current_history",
      operationKind: "runtime_repair",
      stage: "unknown",
    },
    {
      kind: "current_completion",
      operationKind: "runtime_repair",
      purpose: "checkpoint",
    },
    { kind: "authentication_unknown_closure", stage: "confirmed" },
  ])
    assert.equal(execute(request).status, "blocked");
});

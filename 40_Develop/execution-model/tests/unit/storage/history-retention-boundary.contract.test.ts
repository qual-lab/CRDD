/**
 * 履歴保存の保持値とOwner再検証をEMの所有境界で検証する。
 * @packageDocumentation
 * @responsibility 履歴完成保存・一回Context・保持値の拒否とRepository現在性を確認する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 非秘密の合成値と製品宣言の局所評価だけ。
 * @boundary EMの保持値・保存制御と有限VC観測。物理保存・実資源の成立ではない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { types } from "node:util";
import { compileFunction } from "node:vm";
import { readHistoryRetentionDays } from "../../../src/storage/lock.ts";
import { sourceDeclaration } from "../../support/source-declaration.ts";

test("保存起点と保持設定を分けた確認は同じ観測を繰り返さない", () => {
  const checks: string[] = [];
  let current = true;
  let configured = 30;
  const repository = {
    historyRetentionDays: 30,
    revalidate(days?: number) {
      assert.equal(days, undefined);
      checks.push("root");
      return current;
    },
    revalidateRetention(days: number) {
      checks.push("retention");
      return configured === days;
    },
  };
  assert.equal(readHistoryRetentionDays(repository), 30);
  assert.deepEqual(checks.splice(0), ["root", "retention"]);
  configured = 31;
  assert.equal(readHistoryRetentionDays(repository), null);
  assert.deepEqual(checks.splice(0), ["root", "retention"]);
  current = false;
  assert.equal(readHistoryRetentionDays(repository), null);
  assert.deepEqual(checks.splice(0), ["root"]);
});

/**
 * 完成履歴保存が段階・対象・Owner・累積Effectを内部で確認する。
 * @responsibility 一段公開を使わず、実Sourceの有限Reader/Writer列を反証する。
 * @trace PRL-UT-006
 * @precondition 現行History宣言と非秘密の合成値だけを用いる。
 * @stimulus 初回/再入場/no-op、段階差・別Identity、各保存/最終解放の故障。
 * @observation Reader/Writer回数、段階、履歴確認、累積EffectとLock。
 * @oracle 失敗後の再試行0、確認前成功0、前段Effectの喪失0。
 * @cleanup N/A: 有限の局所VMだけ。
 * @boundary 実保存・実Lockの成立は実Filesystem試験へ分離する。
 */
test("履歴完成保存は最大二保存を一回のLockに閉じる", () => {
  const source = fs.readFileSync(
    new URL("../../../src/history/crud.ts", import.meta.url),
    "utf8",
  );
  // コードだけを共有し、段階・Owner・故障counterは各条件に閉じる。
  const createHistoryOperation = compileFunction(
    stripTypeScriptTypes(sourceDeclaration(source, "saveRecoveryHistory")) +
      "; return saveRecoveryHistory;",
    [
      "Buffer",
      "readStateSnapshot",
      "writeStateSnapshot",
      "publishRecoveryState",
      "acquireStorageOwnerForRepository",
      "readHistoryRetentionDays",
      "prepareRepairHistoryPublication",
    ],
  );
  for (const mode of [
    "normal",
    "resume",
    "confirmed",
    "first_failure",
    "second_failure",
    "first_throw",
    "second_throw",
    "resume_reader_failure",
    "release_unknown",
    "release_throw",
    "owner_lost_after_release",
    "reader_throw",
    "continuation_unavailable",
    "continuation_retention_unavailable",
    "owner_lost",
    "wrong_kind",
  ] as const) {
    let reads = 0,
      writes = 0,
      acquisitions = 0,
      releases = 0,
      ownerLive = true;
    const lockOwner = {
      release() {
        releases++;
        if (mode === "release_throw") throw new Error("release_unknown");
        if (mode === "owner_lost_after_release") ownerLive = false;
        return mode !== "release_unknown";
      },
    };
    let stage: "checkpoint" | "publish" | "confirmed" =
      mode === "resume" || mode === "resume_reader_failure"
        ? "publish"
        : mode === "confirmed"
          ? "confirmed"
          : "checkpoint";
    const operation = createHistoryOperation(
      Buffer,
      (...input: unknown[]) => {
        assert.equal(input.at(-1), lockOwner);
        reads++;
        if (mode === "reader_throw") throw new Error("read_unknown");
        const failed = mode === "resume_reader_failure";
        return {
          status: failed ? "blocked" : "completed",
          reason: "observed",
          ownerHeld: true,
          lockReleased: false,
          value: {
            snapshot: {
              revision: reads,
              operations: [
                {
                  kind: "docker_repair",
                  recoveryId: "id",
                  identityJson: "identity",
                  history: { confirmed: stage === "confirmed" },
                },
              ],
            },
            payloadSha256: "hash",
          },
          currentHistoryPublication: {
            operationKind: "docker_repair",
            stage,
            needsWrite: stage !== "confirmed",
            before: Buffer.from("before"),
            candidate: Buffer.from("candidate"),
            historyFile: null,
            pendingHistoryFile: null,
            retentionDays: 30,
          },
        };
      },
      () => ({
        status: "blocked",
        reason: "refused",
        snapshotConfirmed: false,
        lockReleased: true,
        filesystemEffectIssued: false,
      }),
      (
        input: {
          stage: string;
          assertOwner: () => boolean;
          retentionDays: number;
          before: Buffer;
          candidate: Buffer;
        },
        borrowed: unknown,
      ) => {
        assert.equal(borrowed, lockOwner);
        writes++;
        assert.equal(input.assertOwner(), true);
        assert.equal(input.retentionDays, 30);
        if (writes === 2) {
          assert.equal(input.stage, "publish");
          assert.equal(input.before.toString(), "candidate");
          assert.equal(input.candidate.toString(), "continued");
        }
        if (
          (mode === "first_throw" && writes === 1) ||
          (mode === "second_throw" && writes === 2)
        )
          throw new Error("write_unknown");
        if (
          (mode === "first_failure" && writes === 1) ||
          (mode === "second_failure" && writes === 2)
        )
          return {
            status: "blocked",
            snapshotConfirmed: false,
            lockReleased: true,
            filesystemEffectIssued: false,
          };
        stage = input.stage === "checkpoint" ? "publish" : "confirmed";
        if (mode === "owner_lost") ownerLive = false;
        return {
          status: "completed",
          revision: 2,
          payloadSha256: "hash",
          snapshotConfirmed: true,
          lockReleased: true,
          filesystemEffectIssued: true,
        };
      },
      () => {
        acquisitions++;
        return { status: "completed", value: lockOwner };
      },
      () => (mode === "continuation_retention_unavailable" ? null : 30),
      (checkpoint: Buffer) => {
        assert.equal(checkpoint.toString(), "candidate");
        return mode === "continuation_unavailable"
          ? null
          : { snapshotBytes: Buffer.from("continued") };
      },
    );
    const result = operation(
      {},
      "id",
      () => ownerLive,
      mode === "wrong_kind" ? "unknown" : "docker_repair",
    );
    const success = ["normal", "resume", "confirmed"].includes(mode);
    assert.equal(result.status, success ? "completed" : "blocked", mode);
    assert.equal(result.historyConfirmed, success, mode);
    assert.equal(
      writes,
      [
        "wrong_kind",
        "confirmed",
        "reader_throw",
        "resume_reader_failure",
      ].includes(mode)
        ? 0
        : mode === "resume" ||
            [
              "first_failure",
              "first_throw",
              "continuation_unavailable",
              "continuation_retention_unavailable",
              "owner_lost",
            ].includes(mode)
          ? 1
          : 2,
      mode,
    );
    assert.equal(
      result.filesystemEffectIssued,
      mode === "first_throw"
        ? null
        : ![
            "confirmed",
            "first_failure",
            "wrong_kind",
            "reader_throw",
            "resume_reader_failure",
          ].includes(mode),
      mode,
    );
    assert.equal(
      result.lockReleased,
      mode !== "release_unknown" && mode !== "release_throw",
      mode,
    );
    assert.equal(acquisitions, mode === "wrong_kind" ? 0 : 1, mode);
    assert.equal(releases, acquisitions, mode);
    assert.equal(reads, mode === "wrong_kind" ? 0 : 1, mode);
  }
});

/**
 * 私有出版Contextの保持設定・一回消費・失効を現行Writer接続で確認する。
 * @responsibility Mapを上位へ公開せず、保持日数と元Ownerの現在性を結合する。
 * @trace PRL-UT-006
 * @precondition 現行publication宣言と有限Writerだけ。
 * @stimulus used前後、保持設定変更、Owner失効を与える。
 * @observation revalidate引数、Context削除、遅延callback拒否。
 * @oracle 同日数と現在Ownerが揃う一回だけ許可する。
 * @cleanup N/A: 局所Mapのみ。
 * @boundary 物理保存の成立は示さない。
 */
test("履歴出版の一回Contextは保持日数と元Ownerの現在性を結合する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/storage/store.ts", import.meta.url),
    "utf8",
  );
  const settlements = new WeakMap<object, { used: boolean }>(),
    initializations = new WeakMap();
  let currentDays = 30,
    ownerLive = true,
    repositoryCurrent = true,
    split = false,
    calls = 0,
    key: object | null = null;
  let late: ((days?: number) => boolean) | null = null;
  const received: (number | undefined)[] = [];
  const observations: string[] = [];
  const publish = compileFunction(
    stripTypeScriptTypes(sourceDeclaration(source, "publishRecoveryState")) +
      "; return publishRecoveryState;",
    [
      "Object",
      "settlements",
      "initializations",
      "writeStateSnapshot",
      "readHistoryRetentionDays",
    ],
  )(
    Object,
    settlements,
    initializations,
    (
      _before: unknown,
      bound: {
        revalidate: (
          days?: number,
          includeUnscopedRevalidation?: true,
        ) => boolean;
      } | null,
      _candidate: unknown,
      admission: { currentHistory: object } | null,
    ) => {
      if (!bound) return { status: "blocked", filesystemEffectIssued: false };
      calls++;
      key = admission?.currentHistory ?? null;
      assert.ok(key);
      const binding = settlements.get(key);
      assert.ok(binding);
      late = bound.revalidate;
      if (split) {
        assert.equal(bound.revalidate(30, true), false);
        assert.deepEqual(observations.splice(0), []);
        binding.used = true;
        assert.equal(bound.revalidate(30, true), true);
        assert.deepEqual(observations.splice(0), [
          "owner",
          "current",
          "settings",
        ]);
        ownerLive = false;
        assert.equal(bound.revalidate(30, true), false);
        assert.deepEqual(observations.splice(0), ["owner"]);
        ownerLive = true;
        repositoryCurrent = false;
        assert.equal(bound.revalidate(30, true), false);
        assert.deepEqual(observations.splice(0), ["owner", "current"]);
        return { status: "blocked", filesystemEffectIssued: false };
      }
      assert.equal(bound.revalidate(30), false);
      binding.used = true;
      assert.equal(bound.revalidate(30), true);
      currentDays = 31;
      assert.equal(bound.revalidate(30), false);
      currentDays = 30;
      ownerLive = false;
      assert.equal(bound.revalidate(30), false);
      assert.deepEqual(received, [30, 30]);

      observations.length = 0;
      const allChecks = ["current", "owner", "settings"];
      ownerLive = true;
      assert.equal(bound.revalidate(30, true), true);
      assert.deepEqual(observations.splice(0), allChecks);
      repositoryCurrent = false;
      assert.equal(bound.revalidate(30, true), false);
      assert.deepEqual(observations.splice(0), ["current"]);
      repositoryCurrent = true;
      ownerLive = false;
      assert.equal(bound.revalidate(30, true), false);
      assert.deepEqual(observations.splice(0), ["current", "owner"]);
      ownerLive = true;
      currentDays = 31;
      assert.equal(bound.revalidate(30, true), false);
      assert.deepEqual(observations.splice(0), allChecks);
      return { status: "blocked", filesystemEffectIssued: false };
    },
    readHistoryRetentionDays,
  );
  const request = {
    kind: "current_history",
    operationKind: "docker_task",
    repository: {
      revalidate: (...args: [days?: number]) => {
        assert.equal(args.length, 1);
        const [days] = args;
        received.push(days);
        observations.push(days === undefined ? "current" : "settings");
        return days === undefined ? repositoryCurrent : days === currentDays;
      },
    },
    recoveryId: "id",
    before: Buffer.from("before"),
    candidate: Buffer.from("candidate"),
    stage: "publish",
    historyFile: null,
    pendingHistoryFile: null,
    retentionDays: 30,
    assertOwner: () => {
      observations.push("owner");
      return ownerLive;
    },
  };
  publish(request);
  assert.equal(calls, 1);
  assert.ok(key);
  assert.equal(settlements.has(key), false);
  ownerLive = true;
  assert.ok(late);
  assert.equal((late as (days: number) => boolean)(30), false);
  split = true;
  currentDays = 30;
  observations.length = 0;
  publish({
    ...request,
    repository: {
      ...request.repository,
      historyRetentionDays: 30,
      revalidateRetention(days: number) {
        observations.push("settings");
        return days === currentDays;
      },
    },
  });
  assert.equal(calls, 2);
  assert.ok(key);
  assert.equal(settlements.has(key), false);
});

/**
 * @trace PRL-UT-006
 * @precondition 非正数・小数・安全範囲外と正規30日を使用する。
 * @stimulus EMの実保持値検査へ直接渡す。
 * @observation callback回数と日数又はnull。
 * @oracle 不正な日数を再検証やEffectへ渡さず元Owner拒否も保持する。
 * @cleanup N/A: メモリ内のみ。
 * @boundary 実行モデル自身の値契約。
 */
test("保持値の意味検査と元Ownerの拒否を維持する", () => {
  let calls = 0;
  for (const historyRetentionDays of [
    null,
    0,
    -1,
    0.5,
    Infinity,
    Number.MAX_SAFE_INTEGER,
  ])
    assert.equal(
      readHistoryRetentionDays({
        historyRetentionDays,
        revalidate: () => {
          calls++;
          return true;
        },
      }),
      null,
    );
  assert.equal(calls, 0);
  assert.equal(
    readHistoryRetentionDays({
      historyRetentionDays: 30,
      revalidate: (days) => {
        calls++;
        assert.equal(days, 30);
        return false;
      },
    }),
    null,
  );
  assert.equal(calls, 1);
});

/**
 * @trace PRL-UT-006
 * @precondition EMの実Repository観測宣言と有限のVC観測を用いる。
 * @stimulus 通常Root・履歴Context、設定変更、元Revisionの変化を与える。
 * @observation Repository現在性と期待日数の上位搬送。
 * @oracle Root／Revision検査を残したまま履歴枝だけ設定現在性を要求する。
 * @cleanup N/A: 実Filesystem・Gitを変更しない。
 * @boundary Repository観測と設定観測は別責務。実Root検証の成立は主張しない。
 */
test("EMのRepository観測は保持日数を転送し通常照合とRevision条件を維持する", () => {
  const source = fs.readFileSync(
    new URL("../../../src/storage/lock.ts", import.meta.url),
    "utf8",
  );
  let revision = "a".repeat(40);
  const initialRevision = revision;
  const binding = "fixture-physical-binding";
  const bindingChecks: (string | undefined)[] = [];
  const factories = compileFunction(
    stripTypeScriptTypes(
      [
        "data",
        "synchronous",
        "observeExecutionStorageRepository",
        "observeExecutionRecoveryRepository",
      ]
        .map((name) => sourceDeclaration(source, name))
        .join("\n"),
    ) +
      "\nreturn {observeExecutionStorageRepository,observeExecutionRecoveryRepository};",
    ["types", "readExecutionStorageBinding"],
  )(types, (directory: string, expectedBinding?: string) => {
    assert.equal(directory, "C:/synthetic-unused");
    bindingChecks.push(expectedBinding);
    return binding;
  }) as {
    observeExecutionStorageRepository: (value: object) => {
      revalidate: (days?: number) => boolean;
      historyRetentionDays: number | null;
    };
    observeExecutionRecoveryRepository: (value: object) => {
      revalidate: (days?: number) => boolean;
      historyRetentionDays: number | null;
    };
  };
  let currentDays = 30;
  let policyChecks = 0;
  const input = {
    purpose: "recovery",
    root: { directory: "C:/synthetic-unused" },
    historyRetentionDays: 30,
    revalidate: (days?: number) => {
      if (revision !== initialRevision) return false;
      if (days === undefined) return true;
      policyChecks++;
      return days === currentDays;
    },
  };
  const normal = factories.observeExecutionStorageRepository({
    directory: "C:/synthetic-unused",
  });
  assert.equal(normal.revalidate(), true);
  assert.deepEqual(bindingChecks.splice(0), [undefined, binding]);
  assert.equal(policyChecks, 0);
  assert.equal(readHistoryRetentionDays(normal), null);
  const bound = factories.observeExecutionRecoveryRepository(input);
  assert.equal(bound.revalidate(), true);
  assert.deepEqual(bindingChecks.splice(0), [undefined, binding]);
  assert.equal(policyChecks, 0);
  assert.equal(readHistoryRetentionDays(bound), 30);
  assert.equal(policyChecks, 1);
  currentDays = 31;
  assert.equal(readHistoryRetentionDays(bound), null);
  revision = "b".repeat(40);
  assert.equal(bound.revalidate(), false);
});

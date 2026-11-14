/**
 * 保持設定の上位搬送と履歴枝の同期再検証を検証する。
 * @packageDocumentation
 * @responsibility 通常Accessと履歴処置の設定要件を分け、旧再読取り位置へ期待日数を搬送する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 非秘密の合成値と製品宣言の局所評価だけ。
 * @boundary モデルの値検査と上位Consumerの設定現在性。物理保存・実資源の成立ではない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { types } from "node:util";
import { compileFunction } from "node:vm";
import { readHistoryRetentionDays } from "../../../src/storage/lock.ts";
import { sourceDeclaration } from "../../support/source-declaration.ts";

type Policy =
  | {
      status: "ready";
      source: "default" | "file";
      config: { historyRetentionDays: number };
    }
  | { status: "blocked" };
type HistoryInput = {
  root: object;
  historyRetentionDays: number | null;
  revalidate: (days?: number) => boolean;
};

/**
 * 完成履歴保存が段階・対象・Owner・累積Effectを内部で確認する。
 * @responsibility 一段公開を使わず、実Sourceの有限Reader/Writer列を反証する。
 * @trace PRL-UT-006
 * @precondition 現行History宣言と非秘密の合成値だけを用いる。
 * @stimulus 初回/再入場/no-op、段階差・別Identity、各保存/最終観測の故障。
 * @observation Reader/Writer回数、段階、履歴確認、累積EffectとLock。
 * @oracle 失敗後の再試行0、確認前成功0、前段Effectの喪失0。
 * @cleanup N/A: 有限の局所VMだけ。
 * @boundary 実保存・実Lockの成立は実Filesystem試験へ分離する。
 */
test("履歴完成保存は最大二保存とfresh確認を一回の操作へ閉じる", () => {
  const source = fs.readFileSync(
    new URL("../../../src/history/crud.ts", import.meta.url),
    "utf8",
  );
  for (const mode of [
    "normal",
    "resume",
    "confirmed",
    "first_failure",
    "second_failure",
    "first_throw",
    "second_throw",
    "reader_failure",
    "reader_release",
    "reader_throw",
    "changed_identity",
    "unchanged_stage",
    "owner_lost",
    "wrong_kind",
  ] as const) {
    let reads = 0,
      writes = 0,
      ownerLive = true;
    let stage: "checkpoint" | "publish" | "confirmed" =
      mode === "resume"
        ? "publish"
        : mode === "confirmed"
          ? "confirmed"
          : "checkpoint";
    const operation = compileFunction(
      stripTypeScriptTypes(sourceDeclaration(source, "saveRecoveryHistory")) +
        "; return saveRecoveryHistory;",
      [
        "Buffer",
        "readStateSnapshot",
        "writeStateSnapshot",
        "publishRecoveryState",
      ],
    )(
      Buffer,
      () => {
        reads++;
        if (mode === "reader_throw" && reads === 3)
          throw new Error("read_unknown");
        const failed =
          ["reader_failure", "reader_release"].includes(mode) && reads === 3;
        const actual =
          mode === "unchanged_stage" && reads === 2 ? "checkpoint" : stage;
        return {
          status: failed ? "blocked" : "completed",
          reason: "observed",
          lockReleased: !(mode === "reader_release" && reads === 3),
          value: {
            snapshot: {
              revision: reads,
              operations: [
                {
                  kind: "runtime_repair",
                  recoveryId: "id",
                  identityJson:
                    mode === "changed_identity" && reads === 2
                      ? "other"
                      : "identity",
                  history: { confirmed: actual === "confirmed" },
                },
              ],
            },
            payloadSha256: "hash",
          },
          currentHistoryPublication: {
            operationKind: "runtime_repair",
            stage: actual,
            needsWrite: actual !== "confirmed",
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
      (input: {
        stage: string;
        assertOwner: () => boolean;
        retentionDays: number;
      }) => {
        writes++;
        assert.equal(input.assertOwner(), true);
        assert.equal(input.retentionDays, 30);
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
          snapshotConfirmed: true,
          lockReleased: true,
          filesystemEffectIssued: true,
        };
      },
    );
    const result = operation(
      {},
      "id",
      () => ownerLive,
      mode === "wrong_kind" ? "unknown" : "runtime_repair",
    );
    const success = ["normal", "resume", "confirmed"].includes(mode);
    assert.equal(result.status, success ? "completed" : "blocked", mode);
    assert.equal(result.historyConfirmed, success, mode);
    assert.equal(
      writes,
      mode === "wrong_kind" || mode === "confirmed"
        ? 0
        : mode === "resume" ||
            [
              "first_failure",
              "first_throw",
              "changed_identity",
              "unchanged_stage",
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
        : !["confirmed", "first_failure", "wrong_kind"].includes(mode),
      mode,
    );
    assert.equal(
      result.lockReleased,
      ![
        "reader_release",
        "reader_throw",
        "first_throw",
        "second_throw",
      ].includes(mode),
      mode,
    );
    if (success) assert.equal(reads, writes + 1, mode);
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
    new URL("../../../src/storage/publication.ts", import.meta.url),
    "utf8",
  );
  const settlements = new WeakMap<object, { used: boolean }>(),
    initializations = new WeakMap();
  let currentDays = 30,
    ownerLive = true,
    calls = 0,
    key: object | null = null;
  let late: ((days?: number) => boolean) | null = null;
  const received: (number | undefined)[] = [];
  const publish = compileFunction(
    stripTypeScriptTypes(sourceDeclaration(source, "publishRecoveryState")) +
      "; return publishRecoveryState;",
    ["Object", "settlements", "initializations", "writeStateSnapshot"],
  )(
    Object,
    settlements,
    initializations,
    (
      _before: unknown,
      bound: { revalidate: (days?: number) => boolean } | null,
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
      assert.equal(bound.revalidate(30), false);
      binding.used = true;
      assert.equal(bound.revalidate(30), true);
      currentDays = 31;
      assert.equal(bound.revalidate(30), false);
      currentDays = 30;
      ownerLive = false;
      assert.equal(bound.revalidate(30), false);
      return { status: "blocked", filesystemEffectIssued: false };
    },
  );
  publish({
    kind: "current_history",
    operationKind: "runtime_repair",
    repository: {
      revalidate: (days?: number) => {
        received.push(days);
        return days === currentDays;
      },
    },
    recoveryId: "id",
    before: Buffer.from("before"),
    candidate: Buffer.from("candidate"),
    stage: "publish",
    historyFile: null,
    pendingHistoryFile: null,
    retentionDays: 30,
    assertOwner: () => ownerLive,
  });
  assert.equal(calls, 1);
  assert.deepEqual(received, [30, 30]);
  assert.ok(key);
  assert.equal(settlements.has(key), false);
  ownerLive = true;
  assert.ok(late);
  assert.equal((late as (days: number) => boolean)(30), false);
});

/**
 * 実Consumer宣言を有限の設定観測へ接続する。
 * @responsibility 新getConfig実装を代用せず実際の値搬送・再検証分岐を評価する。
 * @trace PRL-UT-006
 * @precondition 合成設定Readerだけを渡す。
 * @stimulus Source宣言を読み取り独立関数を構築する。
 * @observation 返却Context、観測回数、元Owner再検証。
 * @oracle 通常引数では設定再観測しない。
 * @cleanup N/A: メモリ内のみ。
 * @boundary 上位ConsumerからEMへの値搬送。
 */
function consumer(read: () => Policy) {
  const source = fs.readFileSync(
    new URL(
      "../../../../coordinator/src/execution/persistence.ts",
      import.meta.url,
    ),
    "utf8",
  );
  return compileFunction(
    stripTypeScriptTypes(
      ["historyRepositoryInput", "withHistoryRetention"]
        .map((name) => sourceDeclaration(source, name))
        .join("\n"),
    ) + "\nreturn {historyRepositoryInput,withHistoryRetention};",
    ["readCoordinatorConfig"],
  )(read) as {
    historyRepositoryInput: (root: object) => HistoryInput;
    withHistoryRetention: (context: {
      root: object;
      revalidate: () => boolean;
    }) => HistoryInput;
  };
}

/**
 * @trace PRL-UT-006
 * @precondition ready・30日の合成設定を使用する。
 * @stimulus 通常再検証、履歴再検証、同値のFile設定への切替を行う。
 * @observation 設定Reader回数と保持値。
 * @oracle 通常呼出しの追加読取り0、履歴だけfresh確認。同値のsource差は拒否しない。
 * @cleanup N/A: メモリ内のみ。
 * @boundary 保持日数の値と現在性。
 */
test("保持日数は履歴枝でだけ再観測し同値のdefaultとFileを区別しない", () => {
  let reads = 0;
  let source: "default" | "file" = "default";
  const api = consumer(() => {
    reads++;
    return { status: "ready", source, config: { historyRetentionDays: 30 } };
  });
  const input = api.historyRepositoryInput({});
  assert.equal(reads, 1);
  assert.equal(input.revalidate(), true);
  assert.equal(reads, 1);
  assert.equal(readHistoryRetentionDays(input), 30);
  assert.equal(reads, 2);
  source = "file";
  assert.equal(readHistoryRetentionDays(input), 30);
  assert.equal(reads, 3);
});

/**
 * @trace PRL-UT-006
 * @precondition 初回設定はblocked、元Ownerは現在である。
 * @stimulus 通常再検証と履歴枝を比較する。
 * @observation 元Owner検査と設定観測の回数、返却値。
 * @oracle 設定不正だけで通常Accessを停止せず、履歴では日数を補完しない。
 * @cleanup N/A: メモリ内のみ。
 * @boundary 追加設定要件の適用範囲。
 */
test("不正設定は非履歴Accessを停止せず履歴ではdefaultへ戻さない", () => {
  let reads = 0;
  let ownerChecks = 0;
  const api = consumer(() => {
    reads++;
    return { status: "blocked" };
  });
  const input = api.withHistoryRetention({
    root: {},
    revalidate: () => {
      ownerChecks++;
      return true;
    },
  });
  assert.equal(input.historyRetentionDays, null);
  assert.equal(input.revalidate(), true);
  assert.equal(reads, 1);
  assert.equal(ownerChecks, 1);
  assert.equal(readHistoryRetentionDays(input), null);
  assert.equal(reads, 1);
});

/**
 * @trace PRL-UT-006
 * @precondition 初回設定はready・30日。
 * @stimulus 処理途中に31日、blocked又は読取り例外へ変える。
 * @observation 履歴枝の拒否又は元例外、通常再検証の結果。
 * @oracle 保持設定の変更・観測不能を履歴成功へ変換しない。
 * @cleanup N/A: メモリ内のみ。
 * @boundary 履歴Effect直前の現在性。
 */
test("保持日数の途中変更と不正化を同じ再検証位置で拒否する", () => {
  let policy: Policy = {
    status: "ready",
    source: "file",
    config: { historyRetentionDays: 30 },
  };
  let failure: Error | null = null;
  const api = consumer(() => {
    if (failure) throw failure;
    return policy;
  });
  const input = api.historyRepositoryInput({});
  policy = {
    status: "ready",
    source: "file",
    config: { historyRetentionDays: 31 },
  };
  assert.equal(readHistoryRetentionDays(input), null);
  policy = { status: "blocked" };
  assert.equal(readHistoryRetentionDays(input), null);
  failure = new Error("synthetic_config_read_failed");
  assert.throws(
    () => readHistoryRetentionDays(input),
    (error) => error === failure,
  );
  assert.equal(input.revalidate(), true);
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
  const observed = () => ({
    repositoryForm: "main",
    repositoryIdentity: "one",
    repositoryInstanceIdentity: "instance",
    revisionIdentity: revision,
  });
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
    [
      "types",
      "createHash",
      "resolveVerifiedRepositoryRoot",
      "readRepositoryStorageIdentity",
      "readRepositoryRevision",
    ],
  )(types, createHash, () => "C:/synthetic-unused", observed, observed) as {
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
    root: {},
    historyRetentionDays: 30,
    revalidate: (days?: number) => {
      policyChecks++;
      return days === currentDays;
    },
  };
  const normal = factories.observeExecutionStorageRepository({});
  assert.equal(normal.revalidate(), true);
  assert.equal(policyChecks, 0);
  assert.equal(readHistoryRetentionDays(normal), null);
  const bound = factories.observeExecutionRecoveryRepository(input);
  assert.equal(bound.revalidate(), true);
  assert.equal(policyChecks, 0);
  assert.equal(readHistoryRetentionDays(bound), 30);
  assert.equal(policyChecks, 1);
  currentDays = 31;
  assert.equal(readHistoryRetentionDays(bound), null);
  revision = "b".repeat(40);
  assert.equal(bound.revalidate(), false);
});

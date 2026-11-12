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
import fs from "node:fs";
import { createHash } from "node:crypto";
import { stripTypeScriptTypes } from "node:module";
import { types } from "node:util";
import { compileFunction } from "node:vm";
import test from "node:test";
import { readHistoryRetentionDays } from "../../../src/storage/runtime-repository.ts";
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
    new URL("../../../src/storage/runtime-repository.ts", import.meta.url),
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
        "observeRuntimeStorageRepository",
        "observeRuntimeRecoveryRepository",
      ]
        .map((name) => sourceDeclaration(source, name))
        .join("\n"),
    ) +
      "\nreturn {observeRuntimeStorageRepository,observeRuntimeRecoveryRepository};",
    [
      "types",
      "createHash",
      "resolveVerifiedRepositoryRoot",
      "readRepositoryStorageIdentity",
      "readRepositoryRevision",
    ],
  )(types, createHash, () => "C:/synthetic-unused", observed, observed) as {
    observeRuntimeStorageRepository: (value: object) => {
      revalidate: (days?: number) => boolean;
      historyRetentionDays: number | null;
    };
    observeRuntimeRecoveryRepository: (value: object) => {
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
  const normal = factories.observeRuntimeStorageRepository({});
  assert.equal(normal.revalidate(), true);
  assert.equal(policyChecks, 0);
  assert.equal(readHistoryRetentionDays(normal), null);
  const bound = factories.observeRuntimeRecoveryRepository(input);
  assert.equal(bound.revalidate(), true);
  assert.equal(policyChecks, 0);
  assert.equal(readHistoryRetentionDays(bound), 30);
  assert.equal(policyChecks, 1);
  currentDays = 31;
  assert.equal(readHistoryRetentionDays(bound), null);
  revision = "b".repeat(40);
  assert.equal(bound.revalidate(), false);
});

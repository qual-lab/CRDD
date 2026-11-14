/**
 * 履歴保存へ渡す保持設定と同期再検証をCoordinatorの所有境界で確認する。
 * @packageDocumentation
 * @responsibility 通常Accessと履歴処置を区別し、設定現在性・Owner・例外を保持する。
 * @trace PRL-UT-006
 * @level UT
 * @scope 自己Sourceと非秘密の合成設定。保存・実資源の操作は行わない。
 * @boundary Coordinatorの保持設定搬送。日数自体の値検査はEMが所有する。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import { compileFunction } from "node:vm";
import { sourceDeclaration } from "../../../../execution-model/tests/support/source-declaration.ts";

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

// 不変コードだけを一回準備し、設定ReaderとOwnerは各試験で独立させる。
const source = fs.readFileSync(
  new URL("../../../src/execution/persistence.ts", import.meta.url),
  "utf8",
);
const createConsumer = compileFunction(
  stripTypeScriptTypes(
    ["historyRepositoryInput", "withHistoryRetention"]
      .map((name) => sourceDeclaration(source, name))
      .join("\n"),
  ) + "\nreturn {historyRepositoryInput,withHistoryRetention};",
  ["readCoordinatorConfig"],
);

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
  return createConsumer(read) as {
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
  assert.equal(input.historyRetentionDays, 30);
  assert.equal(input.revalidate(30), true);
  assert.equal(reads, 2);
  source = "file";
  assert.equal(input.historyRetentionDays, 30);
  assert.equal(input.revalidate(30), true);
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
  assert.equal(input.revalidate(30), false);
  assert.equal(ownerChecks, 2);
  assert.equal(reads, 2);
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
  assert.equal(input.historyRetentionDays, 30);
  assert.equal(input.revalidate(30), false);
  policy = { status: "blocked" };
  assert.equal(input.historyRetentionDays, 30);
  assert.equal(input.revalidate(30), false);
  failure = new Error("synthetic_config_read_failed");
  assert.throws(
    () => input.revalidate(30),
    (error) => error === failure,
  );
  assert.equal(input.revalidate(), true);
});

/**
 * 保存Sourceの依存閉包を同じ試験内に組み立てる。
 * @packageDocumentation
 * @responsibility Module移管後も故障注入を内部Lock・I/Oへ届け、製品の判定本文を共有する。
 * @trace ERB-IT-014
 * @level IT
 * @scope 実保存を確認する自己生成Repositoryの試験補助。
 * @boundary 製品Sourceは読取りのみ。実Filesystem・Kernelの操作は呼出しCaseが所有する。
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { types } from "node:util";
import { runInThisContext } from "node:vm";
import * as sharedLock from "../../../lock/src/index.ts";
import * as versionControl from "../../../version-control/src/index.ts";
import * as attemptOperations from "../../src/attempt/operations.ts";
import * as attemptValidation from "../../src/attempt/validation.ts";
import * as decisionValidation from "../../src/decision/validation.ts";
import * as historyOperations from "../../src/history/operations.ts";
import * as historyValidation from "../../src/history/validation.ts";
import * as domain from "../../src/index.ts";
import * as objectiveValidation from "../../src/objective/validation.ts";
import * as stateValues from "../../src/state/types.ts";
import * as stateValidation from "../../src/state/validation.ts";
import * as stateOperations from "../../src/state/operations.ts";
import * as taskValidation from "../../src/task/validation.ts";
import * as taskOperations from "../../src/task/operations.ts";
import * as objectiveOperations from "../../src/objective/operations.ts";
import * as workspaceValidation from "../../src/workspace/validation.ts";

const unchangedSource = (source: string) => source;
let preparedSource: Readonly<{
  source: string;
  body: string;
  exports: readonly string[];
  declarations: ReadonlySet<string>;
}> | null = null;
// 未束縛コードだけを保持する。fixtureのMap・依存値・Owner・保存物は保持しない。
const factories = new Map<
  string,
  (...args: unknown[]) => ReturnType<typeof createRuntimeStorageSourceFixture>
>();

/**
 * 現行の実Writer・Lock・固定I/Oを一つの同期依存閉包へ接続する。
 * @responsibility 一つのfixture内でMapを一実体としてReader／Writerで共有する。
 * @trace ERB-IT-014
 * @precondition 許可した合成試験だけから呼び、差替えを観測したい境界へ限定する。
 * @stimulus 型・import／export構文を除き、既存と同じ依存を注入する。
 * @observation 現行保存Moduleと同じ関数集合を返す。
 * @oracle 判定本文を代替実装に変えず、未指定の依存は現行の実装を使用する。
 * @cleanup Caseが全Owner・試験物を終了し、試験用閉包はProcess内だけで破棄する。
 * @boundary 試験内の組立て。製品singleton成立の根拠にはせず、製品API・保存形式・永続Registryを追加しない。
 */
export function createRuntimeStorageSourceFixture(
  transform: (source: string) => string = unchangedSource,
  overrides: Readonly<Record<string, unknown>> = {},
): typeof import("../../src/storage/publication.ts") &
  typeof import("../../src/state/crud.ts") &
  typeof import("../../src/attempt/crud.ts") &
  typeof import("../../src/decision/crud.ts") &
  typeof import("../../src/history/crud.ts") &
  typeof import("../../src/objective/crud.ts") &
  typeof import("../../src/task/crud.ts") &
  typeof import("../../src/workspace/crud.ts") &
  typeof import("../../src/storage/store.ts") &
  typeof import("../../src/storage/lock.ts") {
  const prepared = prepareRuntimeStorageSource();
  const normal = transform === unchangedSource;
  const body = normal
    ? prepared.body
    : transform(prepared.source).replace(
        /^class ExecutionStorageBlockedError[\s\S]*?^\}\r?\n/gmu,
        "",
      );
  const dependencies = {
    createHash,
    randomUUID,
    fs,
    path,
    types,
    ...domain,
    ...versionControl,
    ...sharedLock,
    ...attemptValidation,
    ...attemptOperations,
    ...decisionValidation,
    ...historyValidation,
    ...historyOperations,
    ...objectiveValidation,
    ...taskValidation,
    ...taskOperations,
    ...objectiveOperations,
    ...workspaceValidation,
    ...stateValidation,
    ...stateOperations,
    ...stateValues,
    ...overrides,
  };
  const declarations = normal
    ? prepared.declarations
    : new Set(
        [
          ...body.matchAll(/^(?:function|const|let|class) ([A-Za-z0-9_]+)/gm),
        ].map((match) => match[1]),
      );
  const entries = Object.entries(dependencies).filter(
    ([name]) => !declarations.has(name),
  );
  const overriddenFunctions = Object.keys(overrides).filter(
    (name) =>
      declarations.has(name) &&
      new RegExp(`^function ${name}\\(`, "m").test(body),
  );
  const names = entries.map(([name]) => name);
  const signature = JSON.stringify([names, overriddenFunctions]);
  let factory = normal ? factories.get(signature) : undefined;
  if (!factory) {
    factory = runInThisContext(
      `(function(__fixtureOverrides,${names.join(",")}){${body};${overriddenFunctions.map((name) => `${name}=__fixtureOverrides[${JSON.stringify(name)}];`).join("\n")}return {${prepared.exports.join(",")}};})`,
    ) as (
      ...args: unknown[]
    ) => ReturnType<typeof createRuntimeStorageSourceFixture>;
    // 評価失敗を正常準備として保持しない。変異コードも登録しない。
    const fixture = factory(overrides, ...entries.map(([, value]) => value));
    if (normal) factories.set(signature, factory);
    return fixture;
  }
  return factory(overrides, ...entries.map(([, value]) => value));
}

/**
 * 固定10Sourceの読取りと型除去だけを一度準備する。
 * @responsibility 変異前本文・元export一覧・通常本文の宣言名を保持し、実行値を保持しない。
 * @trace ERB-IT-014
 * @precondition 同じ試験Process中に製品Sourceを編集しない。
 * @stimulus 最初のfixture生成で固定Sourceを読む。
 * @observation 加工済み文字列と宣言名だけを返す。
 * @oracle 変異は毎回適用し、fixtureのMap初期化は共有しない。
 * @cleanup 不変の準備は試験Process終了とともに破棄する。
 * @boundary 読取りだけ。保存物・製品状態を生成しない。
 */
function prepareRuntimeStorageSource() {
  if (preparedSource) return preparedSource;
  const files = [
    "../../src/storage/store.ts",
    "../../src/storage/lock.ts",
    "../../src/state/crud.ts",
    "../../src/storage/publication.ts",
    "../../src/attempt/crud.ts",
    "../../src/decision/crud.ts",
    "../../src/history/crud.ts",
    "../../src/objective/crud.ts",
    "../../src/task/crud.ts",
    "../../src/workspace/crud.ts",
  ];
  const sources = files.map((file) =>
    fs.readFileSync(new URL(file, import.meta.url), "utf8"),
  );
  assertUniqueFiles(files);
  const exports = sources.flatMap((source) =>
    [
      ...source.matchAll(
        /^export\s+(?:function|const|class)\s+([A-Za-z0-9_]+)/gm,
      ),
    ].map((match) => match[1] as string),
  );
  const source = sources
    .map((text) =>
      stripTypeScriptTypes(text)
        .replace(/^import[\s\S]*?;\r?\n/gmu, "")
        .replace(/^export\s+/gmu, ""),
    )
    .join("\n");
  const body = source.replace(
    /^class ExecutionStorageBlockedError[\s\S]*?^\}\r?\n/gmu,
    "",
  );
  preparedSource = Object.freeze({
    source,
    body,
    exports: Object.freeze(exports),
    declarations: new Set(
      [...body.matchAll(/^(?:function|const|let|class) ([A-Za-z0-9_]+)/gm)].map(
        (match) => match[1] as string,
      ),
    ),
  });
  return preparedSource;
}

/**
 * 同一Mapを持つSourceの二重展開を試験補助側で拒否する。
 * @responsibility 一つのfixtureで一つのSourceを複数回評価しない。
 * @trace ERB-IT-014
 * @precondition 同一閉包へ展開する実Source一覧を受け取る。
 * @stimulus Source Pathの重複を照合する。
 * @observation 重複時の例外。
 * @oracle 異なるMap実体を同名で二重生成しない。
 * @cleanup N/A: 配列値だけ。
 * @boundary 試験の依存閉包組立て。
 */
function assertUniqueFiles(files: readonly string[]) {
  if (new Set(files).size !== files.length)
    throw Error("duplicate_fixture_source");
}

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
import * as versionControl from "../../../version-control/src/index.ts";
import * as domain from "../../src/index.ts";
import * as definitionCandidates from "../../src/objective/crud.ts";
import * as plainData from "../../src/plain-data/snapshot.ts";
import * as kernel from "../../src/storage/runtime-kernel-lock.ts";
import * as storageRepository from "../../src/storage/runtime-repository.ts";
import * as stateResults from "../../src/storage/runtime-result.ts";
import { assertRuntimeStateInitializationBoundary } from "../../src/storage/ensure-area.ts";
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
  transform: (source: string) => string = (source) => source,
  overrides: Readonly<Record<string, unknown>> = {},
): typeof import("../../src/storage/runtime-store.ts") {
  const files = [
    "../../src/storage/runtime-lock.ts",
    "../../src/storage/state.ts",
    "../../src/storage/runtime-history.ts",
    "../../src/storage/runtime-store.ts",
  ];
  const sources = files.map((file) =>
    fs.readFileSync(new URL(file, import.meta.url), "utf8"),
  );
  const exports = [
    ...(sources[3] ?? "").matchAll(
      /^export\s+(?:function|const)\s+([A-Za-z0-9_]+)/gm,
    ),
  ].map((match) => match[1]);
  const body = transform(
    sources
      .map((source) =>
        stripTypeScriptTypes(source)
          .replace(/^import[\s\S]*?;\r?\n/gmu, "")
          .replace(/^export\s+/gmu, ""),
      )
      .join("\n"),
  );
  const dependencies = {
    createHash,
    randomUUID,
    fs,
    path,
    types,
    ...domain,
    ...versionControl,
    ...storageRepository,
    ...stateResults,
    ...plainData,
    ...definitionCandidates,
    assertRuntimeStateInitializationBoundary,
    decodeCoordinatorStateSnapshot: domain.decodeRuntimeDomainSnapshot,
    exactRecordKeys: domain.hasRuntimeStateRecordKeys,
    digest: domain.hashRuntimeStateValueText,
    plainObject: domain.isRuntimeStateObject,
    exactKeys: domain.hasRuntimeStateKeys,
    ...kernel,
    borrowRuntimeOwnedCoordinatorStorageRepository:
      storageRepository.observeRuntimeStorageRepository,
    borrowRuntimeOwnedCoordinatorRecoveryRepository:
      storageRepository.observeRuntimeRecoveryRepository,
    borrowRuntimeOwnedCoordinatorStateRepository:
      storageRepository.observeRuntimeExecutionRepository,
    verifyRuntimeOwnedDockerUnissuedNotice:
      storageRepository.verifyRuntimeStorageUnissuedNotice,
    ...overrides,
  };
  const declarations = new Set(
    [...body.matchAll(/^(?:function|const|let|class) ([A-Za-z0-9_]+)/gm)].map(
      (match) => match[1],
    ),
  );
  const entries = Object.entries(dependencies).filter(
    ([name]) => !declarations.has(name),
  );
  const fixture = runInThisContext(
    `(function(${entries.map(([name]) => name).join(",")}){${body};return {${exports.join(",")}};})`,
  )(...entries.map(([, value]) => value));
  return fixture;
}

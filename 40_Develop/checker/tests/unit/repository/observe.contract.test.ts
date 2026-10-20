/**
 * Repository観測の既存境界を検証する。
 *
 * @packageDocumentation
 * @responsibility 不存在・観測不能・字句包含・構成要素の観測順を区別する。
 * @trace RCM-UT-001
 * @trace RCM-UT-002
 * @level UT
 * @scope repository、observe
 * @boundary RCM-UT-001=N/A: 字句演算と同期metadata差替え。 / RCM-UT-002=N/A: 非ENOENTの同一例外伝播。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  isWithin,
  lstatIfPresent,
  pathContainsSymbolicLink,
} from "../../../src/repository/observe.ts";

/**
 * 字句境界の現行判定を検証する。
 *
 * @responsibility 同一・子・外部・二点で始まる子名の既存結果を保持する。
 * @trace RCM-UT-001
 * @precondition 実在を必要としない絶対Pathを用意する。
 * @stimulus 二引数の包含判定を呼ぶ。
 * @observation booleanを取得する。
 * @oracle 同一と通常の子だけtrueで、実体確認を行わない。
 * @cleanup N/A: 資源を作らない。
 * @boundary RCM-UT-001=N/A: 字句演算のみ。
 */
test("字句包含は同一・子・外部と二点名の既存判定を維持する", () => {
  const root = path.resolve("lexical-root");
  assert.equal(isWithin(root, root), true);
  assert.equal(isWithin(root, path.join(root, "child", "file")), true);
  assert.equal(isWithin(root, path.resolve(root, "..", "sibling")), false);
  assert.equal(isWithin(root, path.dirname(root)), false);
  assert.equal(isWithin(root, path.join(root, "..name")), false);
});

/**
 * 不存在と観測失敗を検証する。
 *
 * @responsibility 取得Statsの同一性とENOENT限定変換、他のthrowの同一性を固定する。
 * @trace RCM-UT-002
 * @precondition 同期metadata境界だけを差し替える。
 * @stimulus Stats返却・ENOENT・他code・codeなしのthrowを与える。
 * @observation 戻り値とthrowしたObjectを取得する。
 * @oracle ENOENTだけnull、それ以外は元の値をそのままthrowする。
 * @cleanup TestContextが差替えを復元する。
 * @boundary RCM-UT-002=N/A: 局所差替えで例外経路を固定する。
 */
test("lstatはENOENTだけを不存在とし他の観測失敗を伝播する", (t) => {
  const stats = fs.lstatSync(fileURLToPath(import.meta.url));
  const stat = t.mock.method(fs, "lstatSync", () => stats);
  assert.equal(lstatIfPresent("target"), stats);
  for (const failure of [
    { code: "ENOENT" },
    { code: "ENOTDIR" },
    { code: "EACCES" },
    { code: 1 },
    null,
    "failure",
  ]) {
    stat.mock.mockImplementation(() => {
      throw failure;
    });
    if (failure && typeof failure === "object" && failure.code === "ENOENT") {
      assert.equal(lstatIfPresent("target"), null);
    } else {
      assert.throws(
        () => lstatIfPresent("target"),
        (error) => error === failure,
      );
    }
  }
});

/**
 * 構成要素の観測順と途中停止を検証する。
 *
 * @responsibility Root非観測、Linkの即時検出、不存在と失敗の区別を保持する。
 * @trace RCM-UT-001
 * @trace RCM-UT-002
 * @precondition Rootと二段の子Path、同期metadata差替えを用意する。
 * @stimulus 通常・Link・途中不存在・観測失敗を切り替える。
 * @observation 呼出し順、boolean、throwの同一性を確認する。
 * @oracle Rootを読まず構成要素順に読み、途中停止後の観測を発行しない。
 * @cleanup TestContextが差替えを復元する。
 * @boundary RCM-UT-001=N/A: 同期metadataの局所差替え。 / RCM-UT-002=N/A: 観測失敗の同一伝播。
 */
test("Link観測はRootを除き順に読み途中で停止する", (t) => {
  const root = path.resolve("observe-root");
  const child = path.join(root, "child");
  const target = path.join(child, "file");
  const stats = fs.lstatSync(fileURLToPath(import.meta.url));
  let isLinked = false;
  t.mock.method(stats, "isSymbolicLink", () => isLinked);
  const observedPaths: string[] = [];
  let failure: { code: string } | null = null;
  t.mock.method(fs, "lstatSync", (file: fs.PathLike) => {
    observedPaths.push(String(file));
    if (failure) throw failure;
    return stats;
  });
  for (const value of [root, path.dirname(root), path.join(root, "..name")]) {
    assert.equal(pathContainsSymbolicLink(root, value), false);
  }
  assert.deepEqual(observedPaths, []);
  assert.equal(pathContainsSymbolicLink(root, target), false);
  assert.deepEqual(observedPaths.splice(0), [child, target]);
  isLinked = true;
  assert.equal(pathContainsSymbolicLink(root, target), true);
  assert.deepEqual(observedPaths.splice(0), [child]);
  isLinked = false;
  failure = { code: "ENOENT" };
  assert.equal(pathContainsSymbolicLink(root, target), false);
  assert.deepEqual(observedPaths.splice(0), [child]);
  failure = { code: "EACCES" };
  assert.throws(
    () => pathContainsSymbolicLink(root, target),
    (error) => error === failure,
  );
  assert.deepEqual(observedPaths, [child]);
});

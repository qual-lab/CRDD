/**
 * coordinator:integration:development-package-scriptsの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility coordinator:integration:development-package-scriptsが所有する検証責務を実行する。
 * @trace RCM-IT-009
 * @level IT
 * @scope coordinator、development-toolchain、platform-access
 * @boundary Related 2 Blocks: launcher→検証済みCRDD基準版Root→実装正本→package依存Graph→Capability別公開export→代表利用側
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const coordinatorRoot = path.resolve(import.meta.dirname, "../..");

/**
 * scriptsのTest準備責務を実行する。
 *
 * @responsibility scriptsがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-009
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus scriptsを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: launcher→検証済みCRDD基準版Root→実装正本→package依存Graph→Capability別公開export→代表利用側
 */
function scripts(): Record<string, string> {
  const value: unknown = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  );
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const scripts = Reflect.get(value, "scripts");
  assert.ok(scripts && typeof scripts === "object" && !Array.isArray(scripts));
  return scripts as Record<string, string>;
}

/**
 * CoordinatorのLintはWarningを検査失敗にするを検証する。
 *
 * @responsibility CoordinatorのLintはWarningを検査失敗にするの合否判定を所有する。
 * @trace RCM-IT-009
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus CoordinatorのLintはWarningを検査失敗にするの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: launcher→検証済みCRDD基準版Root→実装正本→package依存Graph→Capability別公開export→代表利用側
 */
test("CoordinatorのLintはWarningを検査失敗にする", () => {
  assert.equal(scripts().lint, "biome lint ../.. --error-on-warnings");
});

/**
 * Platform Accessの開発入口は固定Cargo commandだけを使うを検証する。
 *
 * @responsibility Platform Accessの開発入口は固定Cargo commandだけを使うの合否判定を所有する。
 * @trace RCM-IT-009
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Platform Accessの開発入口は固定Cargo commandだけを使うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Related 2 Blocks: launcher→検証済みCRDD基準版Root→実装正本→package依存Graph→Capability別公開export→代表利用側
 */
test("Platform Accessの開発入口は固定Cargo commandだけを使う", () => {
  const actual = scripts();
  assert.deepEqual(
    Object.fromEntries(
      [
        "platform-access:build",
        "platform-access:coverage",
        "platform-access:format:check",
        "platform-access:lint",
        "platform-access:test",
        "platform-access:worker-build",
        "platform-access:worker-lint",
      ].map((name) => [name, actual[name]]),
    ),
    {
      "platform-access:build": "npm run platform-access:worker-build",
      "platform-access:coverage":
        "node ./scripts/check-platform-access-coverage.ts",
      "platform-access:format:check":
        "cargo fmt --manifest-path ../platform-access/Cargo.toml --check",
      "platform-access:lint": "npm run platform-access:worker-lint",
      "platform-access:test":
        "cargo +1.94.1-x86_64-pc-windows-msvc test --manifest-path ../platform-access/Cargo.toml --frozen --all-features --target x86_64-pc-windows-msvc",
      "platform-access:worker-build":
        "cargo +1.94.1-x86_64-pc-windows-msvc build --manifest-path ../platform-access/Cargo.toml --frozen --release --target x86_64-pc-windows-msvc --bin crdd-platform-access",
      "platform-access:worker-lint":
        "cargo +1.94.1-x86_64-pc-windows-msvc clippy --manifest-path ../platform-access/Cargo.toml --frozen --target x86_64-pc-windows-msvc --bin crdd-platform-access -- -D warnings",
    },
  );
});

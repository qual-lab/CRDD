import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const coordinatorRoot = path.resolve(import.meta.dirname, "../..");

function scripts(): Record<string, string> {
  const value: unknown = JSON.parse(
    fs.readFileSync(path.join(coordinatorRoot, "package.json"), "utf8"),
  );
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  const scripts = Reflect.get(value, "scripts");
  assert.ok(scripts && typeof scripts === "object" && !Array.isArray(scripts));
  return scripts as Record<string, string>;
}

test("CoordinatorのLintはWarningを検査失敗にする", () => {
  assert.equal(scripts().lint, "biome lint ../.. --error-on-warnings");
});

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

/**
 * 設定モデルの公開集合とModel間の独立性を固定する。
 * @packageDocumentation
 * @responsibility 採用した24 Symbolをliteral期待へ固定し、汎用Helperの再公開を拒否する。
 * @trace RCM-UT-001
 * @level UT
 * @scope Root、型宣言、Package公開metadata、Source import。
 * @boundary 読取りと同期値比較だけ。保存・AI・Dockerなし。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as configuration from "../../src/index.ts";

const values = [
  "EXTERNAL_SEND_POLICY_RELATIVE_PATH",
  "REPOSITORY_MANIFEST_RELATIVE_PATH",
  "inspectAiSelectionChoice",
  "readCoordinatorConfig",
  "readExecutionIntelligenceConfig",
  "readNetworkPolicy",
  "readRepositoryAiSelection",
  "readRepositoryManifest",
  "saveRepositoryAiSelection",
  "validateAiSelectionConfig",
] as const;
const types = [
  "AiSelectionCatalog",
  "AiSelectionChoice",
  "AiSelectionConfig",
  "AiSelectionConfigResult",
  "AiSelectionReadResult",
  "AiSelectionRole",
  "AiSelectionSaveResult",
  "AiSelectionSnapshot",
  "NetworkPolicy",
  "NetworkPolicyReadResult",
  "RepositoryManifest",
  "RepositoryManifestReadResult",
  "ToolRuntimeConfig",
  "ToolRuntimeConfigResult",
] as const;

/** 完成した設定操作と主要契約だけをRootから公開する。 @trace RCM-UT-001 */
test("設定Rootは採用した10値・14型と単一公開入口だけを提供する", () => {
  assert.deepEqual(Object.keys(configuration).sort(), [...values].sort());
  assert.equal(
    Object.hasOwn(configuration, "inspectRepositoryManifest"),
    false,
  );
  const source = fs.readFileSync(
    new URL("../../src/index.ts", import.meta.url),
    "utf8",
  );
  const exportedTypes = [
    ...source.matchAll(/export type\s*\{([^}]+)\}/gu),
  ].flatMap((match) =>
    (match[1] ?? "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean),
  );
  assert.deepEqual(exportedTypes.sort(), [...types].sort());
  const metadata = JSON.parse(
    fs.readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
  );
  assert.deepEqual(metadata.exports, { ".": "./src/index.ts" });
});

/** Type・deep import・再exportでも他Modelへの依存を作らない。 @trace RCM-UT-001 */
test("設定Sourceは他Model・旧Domainのimportや再exportを持たない", () => {
  const pending = [fileURLToPath(new URL("../../src/", import.meta.url))];
  while (pending.length) {
    const directory = pending.pop();
    assert.ok(directory);
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) pending.push(file);
      else if (entry.name.endsWith(".ts")) {
        const source = fs.readFileSync(file, "utf8");
        assert.doesNotMatch(
          source,
          /(?:from\s*|import\s*\()(["'])[^"']*(?:domain-model|document-model|execution-model)\/src\//u,
          file,
        );
      }
    }
  }
});

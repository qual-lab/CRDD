/**
 * 同梱技術CatalogのModule読込み失敗を検証する。
 * @packageDocumentation
 * @responsibility JSON欠落・構文不正・Schema不正を旧設定へのfallbackにしない。
 * @trace RCM-IT-005
 * @level IT
 * @scope 技術CatalogとNode Module loader。旧Profile Storeは存在しない。
 * @boundary RCM-IT-005=Direct Boundary: 同梱JSON→検証→Module初期化。
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * 初期Catalogを別Node Processで読み込み、破損時の起動停止を検証する。
 *
 * @responsibility 同梱JSONの欠落、構文不正とSchema不正を旧値へのfallbackにしないことを反証する。
 * @trace RCM-IT-005
 * @precondition 現行resolve.ts／validation.tsをRepository-localの独立Fixtureへ複製する。
 * @stimulus 正常、欠落、構文不正およびSchema不正のJSONで順にModuleを読み込む。
 * @observation 子Process終了、Signal、成功markerと期待する停止理由を観測する。
 * @oracle 正常だけmarkerを返し、不正三条件は非0で停止する。
 * @cleanup exactな作成済みFixtureをfinallyで削除する。
 * @boundary RCM-IT-005=Direct Boundary: bundled Catalog→Node JSON loader→Schema validator。
 */
test("同梱JSONの欠落・構文不正・Schema不正はModule起動を停止する", async () => {
  const testsRoot = path.join(repositoryRoot, ".crdd", "tests");
  await mkdir(testsRoot, { recursive: true });
  const fixture = await mkdtemp(path.join(testsRoot, "ai-model-catalog-"));
  const sourceRoot = path.resolve(import.meta.dirname, "../../src/catalog");
  try {
    const source = await readFile(
      path.join(sourceRoot, "validation.ts"),
      "utf8",
    );
    const dependency = '"../../../domain-model/src/index.ts"';
    // 型importと実行時importの両方を同じ正式Ownerへ向ける。
    assert.equal(source.split(dependency).length, 3);
    await writeFile(
      path.join(fixture, "validation.ts"),
      source.replaceAll(
        dependency,
        JSON.stringify(
          pathToFileURL(
            path.join(
              repositoryRoot,
              "40_Develop",
              "domain-model",
              "src",
              "index.ts",
            ),
          ).href,
        ),
      ),
    );
    const resolver = await readFile(
      path.join(sourceRoot, "resolve.ts"),
      "utf8",
    );
    assert.equal(resolver.split(dependency).length, 3);
    await writeFile(
      path.join(fixture, "catalog.ts"),
      resolver.replaceAll(
        dependency,
        JSON.stringify(
          pathToFileURL(
            path.join(repositoryRoot, "40_Develop/domain-model/src/index.ts"),
          ).href,
        ),
      ),
    );
    await writeFile(path.join(fixture, "package.json"), '{"type":"module"}');
    for (const catalogFile of ["model-catalog.json"] as const) {
      for (const scenario of [
        "normal",
        "missing",
        "syntax",
        "schema",
      ] as const) {
        for (const file of ["model-catalog.json"]) {
          await copyFile(path.join(sourceRoot, file), path.join(fixture, file));
        }
        const jsonPath = path.join(fixture, catalogFile);
        if (scenario === "missing") {
          await rm(jsonPath);
        } else if (scenario !== "normal") {
          await writeFile(
            jsonPath,
            scenario === "syntax" ? "{" : '{"contract":"invalid"}',
          );
        }
        const result = spawnSync(
          process.execPath,
          [
            "--input-type=module",
            "-e",
            'import { getAiModelCatalog } from "./catalog.ts"; if (getAiModelCatalog().catalog.models.length > 0) console.log("CATALOG_LOADED");',
          ],
          {
            cwd: fixture,
            windowsHide: true,
            encoding: "utf8",
            timeout: 10_000,
            maxBuffer: 16_384,
          },
        );
        assert.equal(result.error, undefined);
        assert.equal(result.signal, null);
        if (scenario === "normal") {
          assert.equal(result.status, 0);
          assert.equal(result.stdout.trim(), "CATALOG_LOADED");
        } else {
          assert.equal(result.status, 1);
          assert.equal(result.stdout, "");
          assert.match(
            result.stderr,
            scenario === "missing"
              ? /ERR_MODULE_NOT_FOUND/u
              : scenario === "syntax"
                ? /SyntaxError/u
                : /ai_model_default_catalog_invalid/u,
          );
        }
      }
    }
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

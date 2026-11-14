/**
 * 同梱技術CatalogとProvider応答内容の独立した境界を検証する。
 * @packageDocumentation
 * @responsibility Catalogの起動拒否、Domain非依存、応答の閉形式・固定Schemaを検査する。
 * @trace RCM-IT-005
 * @level IT
 * @scope 技術Catalog、Module loader、応答閉形式、固定SchemaとDomain非依存。保存・実AIなし。
 * @boundary RCM-IT-005=Direct Boundary: 同梱JSONの初期化とProvider応答の内容正規化・技術計画。
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
import test from "node:test";
import { pathToFileURL } from "node:url";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * 移管した応答内容の拒否理由と固定Schemaを反証する。
 * @responsibility 移管で内容・拒否理由・Schemaを変えない。実配置との計画連携はCoが検証する。
 * @trace RCM-IT-005
 * @precondition 合成Object・JSONだけを使用する。
 * @stimulus 正常、欠測、余剰、動的値、所見不正、許可外参照を渡す。
 * @observation exact結果、getter呼出し零とSchema bytes。
 * @oracle 全拒否理由と基準版のSchemaを維持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary AI Adapterの内容正規化と固定Schema。利用側の配置連携はCoordinator試験が所有する。
 */
test("応答内容は全拒否理由と基準版のSchemaを維持する", async () => {
  const api = {
    ...(await import("../../src/provider/plan.ts")),
    ...(await import("../../src/provider/task-result.ts")),
    ...(await import("../../src/provider/advice-result.ts")),
  };
  const { createHash } = await import("node:crypto");
  const edit = {
    status: "completed",
    summary: "Synthetic",
    changedPaths: ["source.ts"],
    verification: ["checked"],
  };
  const finding = {
    severity: "medium",
    path: "source.ts",
    category: "implementation_defect",
    criterionNumber: 1,
    message: "Synthetic",
  };
  const review = {
    decision: "changes_requested",
    summary: "Synthetic",
    findings: [finding],
  };
  const reasons = new Set<string>();
  let calls = 0;
  const candidates: unknown[] = [
    null,
    [],
    0,
    {},
    edit,
    review,
    { ...review, decision: "approved", findings: [] },
    Object.create({ inherited: true }),
    new Proxy(review, {
      ownKeys() {
        calls++;
        throw Error("must_not_read");
      },
    }),
  ];
  for (const base of [edit, review]) {
    candidates.push({ ...base, extra: true });
    for (const key of Object.keys(base)) {
      const missing = { ...base } as Record<string, unknown>;
      delete missing[key];
      candidates.push(missing);
      candidates.push(
        Object.defineProperty({ ...base }, key, {
          get() {
            calls++;
            return "injected";
          },
          enumerable: true,
        }),
      );
      for (const bad of [null, 0, "", [], {}, true])
        candidates.push({ ...base, [key]: bad });
    }
  }
  for (const path of [
    "../outside",
    "/absolute",
    "C:/outside",
    "a/../b",
    "",
    "a\u0000b",
  ])
    candidates.push(
      { ...edit, changedPaths: [path] },
      { ...review, findings: [{ ...finding, path }] },
    );
  candidates.push(
    { ...edit, changedPaths: ["a", "A"] },
    { ...edit, changedPaths: new Array(1001).fill("a") },
    { ...review, findings: [] },
    { ...review, findings: new Array(65).fill(finding) },
    { ...review, decision: "approved" },
  );
  for (const key of Object.keys(finding))
    for (const bad of [null, 0, "", [], {}, true])
      candidates.push({ ...review, findings: [{ ...finding, [key]: bad }] });
  candidates.push({
    ...review,
    findings: [
      Object.defineProperty({ ...finding }, "message", {
        get() {
          calls++;
          return "injected";
        },
        enumerable: true,
      }),
    ],
  });
  for (const value of candidates)
    for (const role of ["executor", "reviewer", "unknown"] as const) {
      const inputRole = role as "executor" | "reviewer";
      const actual = api.inspectTaskResultContent(value, inputRole);
      if (actual.normalizedResult)
        assert.ok(Object.isFrozen(actual.normalizedResult));
      else reasons.add(actual.reason);
    }
  assert.equal(calls, 0);
  assert.deepEqual(
    [...reasons].sort(),
    [
      "provider_task_result_input_invalid",
      "provider_task_executor_shape_invalid",
      "provider_task_reviewer_shape_invalid",
      "provider_task_reviewer_keys_invalid",
      "provider_task_reviewer_decision_invalid",
      "provider_task_reviewer_summary_invalid",
      "provider_task_reviewer_findings_invalid",
      "provider_task_reviewer_finding_invalid",
      "provider_task_reviewer_decision_inconsistent",
    ].sort(),
  );
  const copied = api.inspectTaskResultContent(edit, "executor");
  edit.changedPaths.push("later.ts");
  assert.ok(
    copied.normalizedResult && "changedPaths" in copied.normalizedResult,
  );
  assert.deepEqual(copied.normalizedResult.changedPaths, ["source.ts"]);
  assert.ok(Object.isFrozen(copied.normalizedResult.changedPaths));

  const item = { text: "Synthetic", references: ["synthetic"] };
  const advice = {
    status: "completed",
    facts: [item],
    sharedAnalysis: [item],
    additionalInferences: [item],
    nextOptions: [item],
  };
  const raws: unknown[] = [
    null,
    "",
    "{",
    JSON.stringify(advice),
    JSON.stringify({ ...advice, status: "blocked" }),
    '{"status":"completed","status":"duplicate"}',
    JSON.stringify(advice) + JSON.stringify(advice),
    "x".repeat(65537),
  ];
  for (const key of Object.keys(advice)) {
    const missing = { ...advice } as Record<string, unknown>;
    delete missing[key];
    raws.push(JSON.stringify(missing));
    for (const bad of [
      null,
      0,
      "",
      [],
      {},
      [item, item],
      [{ text: "x", references: [] }],
      [{ text: "x", references: ["outside"] }],
    ])
      raws.push(JSON.stringify({ ...advice, [key]: bad }));
  }
  raws.push(JSON.stringify({ ...advice, extra: true }));
  const adviceReasons = new Set<string>();
  for (const raw of raws)
    for (const allowed of [["synthetic"], [], ["synthetic", "synthetic"]]) {
      const actual = api.parseAdviceResult(raw, allowed);
      if (!actual.normalizedResult) adviceReasons.add(actual.reason);
      else {
        assert.ok(Object.isFrozen(actual.normalizedResult));
        assert.ok(Object.isFrozen(actual.normalizedResult.facts));
        assert.ok(
          Object.isFrozen(actual.normalizedResult.facts[0]?.references),
        );
      }
    }
  assert.deepEqual(
    [...adviceReasons].sort(),
    ["input", "schema", "identity", "items"]
      .map((n) => `workbench_ai_advice_result_${n}_invalid`)
      .sort(),
  );
  const schema = api.describeAdviceResultSchema();
  // a7618c6d0の承認済み容量上限撤去後の固定Schema。形状・必須条件はHash全体で保持する。
  assert.equal(
    createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
    "d7ff3776a632ae48419ad57b9570215a756fdfbd26b26ec90e3e41a7240dcac4",
  );
});

/**
 * Domainを解決できない新品Processで公開Rootの独立性を確認する。
 * @responsibility 間接importを含めたDomain逆依存の再混入を拒否する。
 * @trace RCM-IT-005
 * @precondition 読取り専用の新品Node Processだけを使用する。
 * @stimulus Domain解決を拒否するhookを登録してAI Adapter Rootをimportする。
 * @observation 終了値と固定marker。
 * @oracle DomainをロードせずCatalogを利用できる。
 * @cleanup 子Processの正常closeを確認し、生成物は作らない。
 * @boundary 実AI・認証・Docker・保存は対象外。
 */
test("公開RootはDomain Modelを解決できなくても利用できる", () => {
  const entry = pathToFileURL(
    path.join(repositoryRoot, "40_Develop/ai-adapter/src/index.ts"),
  ).href;
  const source = `import { registerHooks } from 'node:module';
    registerHooks({resolve(s,c,next){const r=next(s,c);if(['domain-model','document-model','execution-model','configuration-model'].some(name=>r.url.includes('/'+name+'/')))throw Error('domain_forbidden');return r;}});
    const api=await import(${JSON.stringify(entry)});
    if(api.getModelCatalog().catalog.models.length===0)throw Error('catalog_empty');
    console.log('DOMAIN_FREE');`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", source],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), "DOMAIN_FREE");
});

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
    const projectDependencies = (input: string) => {
      for (const owner of [
        "domain-model",
        "document-model",
        "execution-model",
        "configuration-model",
      ])
        assert.equal(input.includes(owner), false);
      let projected = input;
      for (const name of ["types.ts", "input.ts"]) {
        const dependency = JSON.stringify(`../provider/${name}`);
        assert.equal(input.includes(dependency), true);
        projected = projected.replaceAll(
          dependency,
          JSON.stringify(
            pathToFileURL(path.join(sourceRoot, "../provider", name)).href,
          ),
        );
      }
      return projected;
    };
    await writeFile(
      path.join(fixture, "validation.ts"),
      projectDependencies(source),
    );
    const resolver = await readFile(
      path.join(sourceRoot, "resolve.ts"),
      "utf8",
    );
    await writeFile(
      path.join(fixture, "catalog.ts"),
      projectDependencies(resolver),
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
            'try { const { getModelCatalog } = await import("./catalog.ts"); if (getModelCatalog().catalog.models.length > 0) console.log("CATALOG_LOADED"); } catch (error) { process.stderr.write(String(error.code ?? error.name) + ": " + error.message + "\\n"); process.exitCode = 1; }',
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
          assert.equal(
            result.status,
            1,
            JSON.stringify({ scenario, stderr: result.stderr }),
          );
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

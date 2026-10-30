/**
 * 同梱技術CatalogとProvider応答内容の独立した境界を検証する。
 * @packageDocumentation
 * @responsibility Catalogの起動拒否、Domain非依存、応答の閉形式・固定Schema／Command Hashを検査する。
 * @trace RCM-IT-005
 * @level IT
 * @scope 技術Catalog、Module loader、応答閉形式、固定Schema／Command HashとDomain非依存。保存・実AIなし。
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
import { pathToFileURL } from "node:url";
import test from "node:test";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  import.meta.dirname,
);

/**
 * 移管した応答内容の拒否理由と固定Schemaを反証する。
 * @responsibility 移管で内容・拒否理由・SchemaとCommand Hashを変えない。
 * @trace RCM-IT-005
 * @precondition 合成Object・JSONだけを使用する。
 * @stimulus 正常、欠測、余剰、動的値、所見不正、許可外参照を渡す。
 * @observation exact結果、getter呼出し零、Schema bytesとCommand Hash。
 * @oracle 全拒否理由と基準版のSchema／Command Hashを維持する。
 * @cleanup N/A: 外部資源なし。
 * @boundary AI Adapterの内容正規化と利用側の計画境界。
 */
test("応答内容は全拒否理由と基準版のSchema・Command Hashを維持する", async () => {
  const api = await import("../../src/index.ts");
  const { createHash } = await import("node:crypto");
  const docker = await import("../../../docker-isolation/src/index.ts");
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
  assert.equal(
    createHash("sha256").update(JSON.stringify(schema)).digest("hex"),
    "e07a0664795c7db8387927bf9c63fb565f7ec4e105f897d2ecf972d4dac27ff2",
  );
  for (const provider of ["codex", "claude"] as const) {
    const request = {
      provider,
      purpose: "advice" as const,
      modelSelection: {
        provider,
        modelIdentifier: provider === "codex" ? "gpt-6.1-sol" : "opus",
        reasoningEffort: "medium" as const,
        identifierKind:
          provider === "codex" ? ("exact" as const) : ("alias" as const),
      },
    };
    const locations = docker.describeDockerProviderExecutionLocations(
      provider,
      "advice",
    );
    const plan = api.planProviderExecution(
      { ...request, resultSchema: schema },
      locations,
    ).plan;
    assert.ok(plan && "toolsAllowed" in plan);
    const bound = docker.bindAdviceCommand(plan, null);
    assert.ok(bound);
    assert.equal(
      docker.hashAdviceCommand(bound),
      provider === "codex"
        ? "7cde0ed8f4796a2406566dcc2bc7fcdede23d187b9c66907456a1d5e243afff0"
        : "9dfafa7a9e4d6d8bed189a960ba2c6882c6235243d41a2883aefb3db50d18578",
    );
  }
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
    registerHooks({resolve(s,c,next){const r=next(s,c);if(r.url.includes('/domain-model/'))throw Error('domain_forbidden');return r;}});
    const api=await import(${JSON.stringify(entry)});
    if(api.getAiModelCatalog().catalog.models.length===0)throw Error('catalog_empty');
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
 * Domainの保存契約がAI Adapterなしで開始できることを確認する。
 * @responsibility 発行理由と保存受理理由の一致を依存逆転なしで固定する。
 * @trace RCM-IT-005
 * @precondition DomainとAI Adapterは別々の新品Nodeで評価する。
 * @stimulus AI Adapterを解決拒否してDomainをimportし、保存理由集合を取得する。
 * @observation 終了値・閉じた文字列配列。
 * @oracle AIなしでDomainを開始でき、理由集合はAI Adapterの発行契約とexact一致する。
 * @cleanup 子の正常終了を確認し、生成物は作らない。
 * @boundary 保存処理・外部AI・Dockerは起動しない。
 */
test("Domain保存契約はAI Adapterを解決せず同じ拒否理由を保持する", async () => {
  const entry = pathToFileURL(
    path.join(repositoryRoot, "40_Develop/domain-model/src/index.ts"),
  ).href;
  const source = `import { registerHooks } from 'node:module';
    registerHooks({resolve(s,c,next){const r=next(s,c);if(r.url.includes('/ai-adapter/'))throw Error('ai_adapter_forbidden');return r;}});
    const api=await import(${JSON.stringify(entry)});
    console.log(JSON.stringify(api.PROVIDER_ADVICE_OUTPUT_REASONS));`;
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", source],
    { encoding: "utf8", timeout: 15000, windowsHide: true },
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  const adapter = await import("../../src/index.ts");
  assert.deepEqual(
    JSON.parse(result.stdout),
    adapter.PROVIDER_ADVICE_OUTPUT_REASONS,
  );
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
      assert.equal(input.includes("domain-model"), false);
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
            'try { const { getAiModelCatalog } = await import("./catalog.ts"); if (getAiModelCatalog().catalog.models.length > 0) console.log("CATALOG_LOADED"); } catch (error) { process.stderr.write(String(error.code ?? error.name) + ": " + error.message + "\\n"); process.exitCode = 1; }',
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

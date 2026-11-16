/**
 * 成果物モデル検査の決定性と不正入力のIssue保持を検証する。
 *
 * @packageDocumentation
 * @responsibility Source・Schema順の検査と関係GraphのIssueを、表示へ変換する前のモデルで検証する。
 * @trace RCM-UT-001
 * @trace RCM-UT-002
 * @level UT
 * @scope artifact、schema、graph、determinism
 * @boundary RCM-UT-001=N/A: Domain内の同期処理。 / RCM-UT-002=N/A: Domain内の同期処理。
 */
import assert from "node:assert/strict";
import test from "node:test";
import type { ArtifactModel } from "../../../src/index.ts";
import { inspectDocumentRelations, parseArtifact } from "../../../src/index.ts";

const requirementSchema = Object.freeze({
  id: "requirement-definition",
  matches: () => true,
  requiredProperties: ["artifactType", "canonicalId", "status"] as const,
  requiredSections: ["Checklist"] as const,
  allowedStatuses: ["Canonical"] as const,
});

/**
 * 同じ入力を二回検査して同じ構造化結果と順序を返すことを検証する。
 *
 * @responsibility Domain成果物検査の決定性を検証し、実行順や共有状態による結果差を検出する。
 * @trace RCM-UT-001
 * @precondition 同じSchemaと同じMarkdown入力を二回渡す。
 * @stimulus 独立した二回のDomain成果物検査実行を行う。
 * @observation Artifact、IssueおよびRelationの構造化結果と順序を比較する。
 * @oracle 二回の結果が完全一致し、Checkerが意味の採否を追加しない。
 * @cleanup N/A: Process内の不変入力だけを使用する。
 * @boundary RCM-UT-001=N/A: Domain内の純粋な検査。
 */
test("Domain成果物検査は同じ入力へ決定的な結果を返す", () => {
  const input = {
    sources: [
      {
        path: "01_Discovery/Definitions/REQ-000001/requirement.md",
        content: `# REQ-000001 Sample

成果物種別: Discovery定義
要求ID: \`REQ-000001\`
状態: Canonical

## Checklist

- [x] Requirementを確認した
`,
      },
    ],
    schemas: [requirementSchema],
  };

  const first = parseArtifactModels(input);
  const second = parseArtifactModels(input);
  assert.deepEqual(second, first);
  assert.deepEqual(first.issues, []);
});

/**
 * 必須情報の欠落を理由と位置付きIssueとして返すことを検証する。
 *
 * @responsibility 不正入力や未確認状態をPassへ丸めず、決定論的なIssueとして公開する境界を検証する。
 * @trace RCM-UT-002
 * @precondition Canonical ID、状態およびChecklistを欠くDiscovery定義を渡す。
 * @stimulus 不完全なfixtureをDomain成果物検査で検査する。
 * @observation 中立Issueのkind、locationおよびreasonを確認する。
 * @oracle 必須情報ごとのIssueを返し、Issue 0件または暗黙補完にならない。
 * @cleanup N/A: Process内の不変入力だけを使用する。
 * @boundary RCM-UT-002=N/A: Domain内の純粋な検査。
 */
test("Domain成果物検査は未確認状態をPassへ丸めない", () => {
  const result = parseArtifactModels({
    sources: [
      {
        path: "01_Discovery/Definitions/unknown/requirement.md",
        content: "# Incomplete Requirement\n\n成果物種別: Discovery定義\n",
      },
    ],
    schemas: [requirementSchema],
  });

  assert.ok(result.issues.length >= 3);
  assert.ok(
    result.issues.every(
      ({ kind, location, reason }) =>
        kind.length > 0 &&
        location.path === "01_Discovery/Definitions/unknown/requirement.md" &&
        reason.length > 0,
    ),
  );
  assert.ok(
    result.issues.some(
      ({ kind }) => kind === "artifact.schema.property-missing",
    ),
  );
  assert.ok(
    result.issues.some(
      ({ kind }) => kind === "artifact.schema.section-missing",
    ),
  );
});

/**
 * 公開Parseとモデル間評価から試験用の観測列を組み立てる。
 * @responsibility Source順・Schema順の局所Issueの後にGraph Issueを連結する。
 * @trace RCM-UT-002
 * @precondition 取得済みの固定SourceとSchemaだけを使う。
 * @stimulus 完成受付と既存の横断評価へ渡す。
 * @observation 部分モデルと全診断。
 * @oracle 呼出し側の既存期待値で件数・順序・内容を照合する。
 * @cleanup N/A: 局所値のみ。
 */
function parseArtifactModels(
  input: Readonly<{
    sources: ReadonlyArray<Parameters<typeof parseArtifact>[0]>;
    schemas?: NonNullable<Parameters<typeof parseArtifact>[1]>["schemas"];
  }>,
) {
  const parsed = input.sources.map((source) =>
    parseArtifact(
      source,
      input.schemas === undefined ? {} : { schemas: input.schemas },
    ),
  );
  const artifacts = parsed.map((outcome) => outcome.result);
  return {
    artifacts,
    issues: [
      ...parsed.flatMap((outcome) => outcome.issues),
      ...inspectDocumentRelations({ kind: "artifact_relations", artifacts }),
    ],
  };
}

/**
 * 完成ParseのSchema順・一回適用と例外を検証する。
 * @responsibility 旧Schema能力を非公開化によって失わず、未適用Schemaを実行しない。
 * @trace RCM-UT-002
 * @precondition 順序記録用のSchemaと二つの独立Source。
 * @stimulus Source順に完成Parseを呼び、callback故障も渡す。
 * @observation callback列・Issue列・部分モデルと元例外。
 * @oracle Source順・Schema順を保持し、例外を成功へ丸めない。
 * @cleanup N/A: 局所値のみ。
 */
test("完成ParseはSchemaの順序・回数・部分モデルと例外を保持する", () => {
  const calls: string[] = [];
  const sources = [
    { path: "one.md", content: "# One" },
    { path: "two.md", content: "# Two" },
  ];
  const schemas = ["first", "second"].map((id) => ({
    id,
    matches: (artifact: ArtifactModel) => {
      calls.push(`${artifact.source.path}:${id}`);
      return id === "first";
    },
    requiredSections: ["Missing"],
  }));
  const results = sources.map((source) => parseArtifact(source, { schemas }));
  assert.deepEqual(calls, [
    "one.md:first",
    "one.md:second",
    "two.md:first",
    "two.md:second",
  ]);
  assert.deepEqual(
    results.map((result) =>
      result.issues.map((issue) => issue.details.schemaId),
    ),
    [["first"], ["first"]],
  );
  assert.ok(
    results.every(
      (result) =>
        result.status === "partial" &&
        result.result.source.content.startsWith("# "),
    ),
  );
  const failure = new Error("schema_callback_failed");
  const firstSource = sources[0];
  assert.ok(firstSource);
  assert.throws(
    () =>
      parseArtifact(firstSource, {
        schemas: [
          {
            id: "fault",
            matches: () => {
              throw failure;
            },
          },
        ],
      }),
    (error) => error === failure,
  );
});

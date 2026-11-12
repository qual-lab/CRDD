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
import {
  inspectArtifactSources,
  type ArtifactSchema,
} from "../../../src/index.ts";
const requirementSchema: ArtifactSchema = Object.freeze({
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

  const first = inspectArtifactSources(input);
  const second = inspectArtifactSources(input);
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
  const result = inspectArtifactSources({
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

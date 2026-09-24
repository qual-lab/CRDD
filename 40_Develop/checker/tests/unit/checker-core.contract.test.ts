/**
 * Checker Coreの決定性と未確認状態の保持を検証する。
 *
 * @packageDocumentation
 * @responsibility 外部実行境界を使わず、同じ入力の決定的な検査結果と不正入力の明示的なFindingを検証する。
 * @trace RCM-UT-001
 * @trace RCM-UT-002
 * @level UT
 * @scope checker、core、determinism、finding
 * @boundary RCM-UT-001=N/A: Checker Core内の同期処理。 / RCM-UT-002=N/A: Checker Core内の同期処理。
 */
import assert from "node:assert/strict";
import test from "node:test";

import type { ArtifactSchema } from "../../../crdd-domain-library/src/artifact/index.ts";
import { runCheckerPipeline } from "../../src/pipeline/checker-pipeline.ts";

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
 * @responsibility Checker Coreの決定性を検証し、実行順や共有状態による結果差を検出する。
 * @trace RCM-UT-001
 * @precondition 同じSchemaと同じMarkdown入力を二回渡す。
 * @stimulus 独立した二回のChecker Pipeline実行を行う。
 * @observation Artifact、FindingおよびRelationの構造化結果と順序を比較する。
 * @oracle 二回の結果が完全一致し、Checkerが意味の採否を追加しない。
 * @cleanup N/A: Process内の不変入力だけを使用する。
 * @boundary RCM-UT-001=N/A: Checker Core内の同期処理。
 */
test("Checker Coreは同じ入力へ決定的な結果を返す", () => {
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

  const first = runCheckerPipeline(input);
  const second = runCheckerPipeline(input);
  assert.deepEqual(second, first);
  assert.deepEqual(first.findings, []);
});

/**
 * 必須情報の欠落を理由と位置付きFindingとして返すことを検証する。
 *
 * @responsibility 不正入力や未確認状態をPassへ丸めず、決定論的なFindingとして公開する境界を検証する。
 * @trace RCM-UT-002
 * @precondition Canonical ID、状態およびChecklistを欠くDiscovery定義を渡す。
 * @stimulus 不完全なfixtureをChecker Pipelineで検査する。
 * @observation Findingのcode、path、ruleおよびmessageを記録する。
 * @oracle 必須情報ごとのFindingを返し、Finding 0件または暗黙補完にならない。
 * @cleanup N/A: Process内の不変入力だけを使用する。
 * @boundary RCM-UT-002=N/A: Checker Core内の同期処理。
 */
test("Checker Coreは未確認状態をPassへ丸めない", () => {
  const result = runCheckerPipeline({
    sources: [
      {
        path: "01_Discovery/Definitions/unknown/requirement.md",
        content: "# Incomplete Requirement\n\n成果物種別: Discovery定義\n",
      },
    ],
    schemas: [requirementSchema],
  });

  assert.ok(result.findings.length >= 3);
  assert.ok(
    result.findings.every(
      ({ code, path, rule, message }) =>
        code.length > 0 &&
        path === "01_Discovery/Definitions/unknown/requirement.md" &&
        rule.length > 0 &&
        message.length > 0,
    ),
  );
  assert.ok(
    result.findings.some(
      ({ code }) => code === "artifact-schema-property-missing",
    ),
  );
  assert.ok(
    result.findings.some(
      ({ code }) => code === "artifact-schema-section-missing",
    ),
  );
});

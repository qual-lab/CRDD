/**
 * 品質状態の中立Issueと既存診断の対応を検証する。
 *
 * @packageDocumentation
 * @responsibility readiness別の全fieldと未知kind拒否を、実Domain結果から確認する。
 * @trace RCM-UT-001
 * @trace RCM-UT-002
 * @level UT
 * @scope quality-state、diagnostic、conversion
 * @boundary RCM-UT-001=N/A: Checker Core内の同期処理。 / RCM-UT-002=N/A: Checker Core内の同期処理。
 */
import { mapQualityDesignStateIssueToFinding } from "../../../src/report/quality.ts";

import assert from "node:assert/strict";
import test from "node:test";
import {
  inspectArtifactSources,
  inspectQualityDesignStates,
} from "../../../../domain-model/src/index.ts";

/**
 * 品質状態Issueを両readinessの既存Findingへ変換することを検証する。
 *
 * @responsibility Domain検査との本番接続とcode・文言・Path・順序の維持を確認する。
 * @trace RCM-UT-001
 * @precondition Canonical・Draft・欠落のSourceを既存成果物検査へ渡す。
 * @stimulus 既存Domainの品質状態を検査して用途別の診断へ変換する。
 * @observation Findings全fieldを取得する。
 * @oracle 両readinessとも既存の期待Finding列と完全一致する。
 * @cleanup N/A: 共有登録・外部資源を作成しない。
 * @boundary RCM-UT-001=N/A: CoreとDomain間の同期処理だけを扱う。
 */
test("品質設計状態検査は両readinessの既存Findingを維持する", () => {
  for (const readiness of ["Quality Design Ready", "Quality Ready"] as const) {
    const result = inspectArtifactSources({
      sources: [
        {
          path: "07_Quality/canonical.md",
          content:
            "# Canonical\n状態: v0.22.0 Canonical（Released Baseline: v0.21.0）",
        },
        { path: "07_Quality/draft.md", content: "# Draft\n状態: Draft" },
        { path: "07_Quality/missing.md", content: "# Missing" },
      ],
    });
    assert.deepEqual(
      inspectQualityDesignStates(result.artifacts).map((issue) =>
        mapQualityDesignStateIssueToFinding(issue, readiness),
      ),
      ["07_Quality/draft.md", "07_Quality/missing.md"].map((path) => ({
        severity: "error",
        code: "quality-design-artifact-state-invalid",
        path,
        rule: "quality.design-artifact-canonical-state",
        message: `${readiness} requires every Quality design root, Analysis, and Definition artifact to declare Canonical state.`,
      })),
    );
  }
});

/**
 * 未知の品質Issueを診断へ丸めず拒否する。
 *
 * @responsibility 表示変換の未知kind拒否を確認する。
 * @trace RCM-UT-002
 * @precondition 未知kindを持つ中立Issueを使う。
 * @stimulus 品質状態の本番変換へ渡す。
 * @observation 例外の理由を取得する。
 * @oracle unknown_quality_design_state_issueを返す。
 * @cleanup N/A: 同期的な局所値だけを使う。
 * @boundary RCM-UT-002=N/A: Process内の純粋な変換。
 */
test("品質状態変換は未知Issueを拒否する", () =>
  assert.throws(
    () =>
      mapQualityDesignStateIssueToFinding(
        {
          kind: "unexpected",
          targetIdentity: "fixture",
          location: { path: "fixture.md" },
          reason: "fixture",
          details: {},
        },
        "Quality Ready",
      ),
    /unknown_quality_design_state_issue:unexpected/u,
  ));

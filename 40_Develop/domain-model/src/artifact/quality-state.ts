/**
 * 与えられた品質設計成果物のCanonical状態を検査する。
 *
 * @responsibility 状態表記の既存正規化とCanonical必須条件を中立Issueへ変換する。
 * @trace ARCH-000008
 * @boundary N/A: 解析済みArtifactModelだけを受け、外部観測やCheckerへの依存を持たない。
 * @effect N/A: 入力を変更せず、共有状態・外部I/Oを扱わない。
 * @security 対象集合やreadinessの妥当性・認可・品質全体の成立を判定しない。
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactModel } from "./types.ts";

/**
 * 品質設計の状態文字列から版表記とReleased Baseline句を除く。
 *
 * @responsibility 先頭の版、末尾の全角括弧句、trimの既存適用順を維持する。
 * @trace ARCH-000008
 * @input state: 判定する状態文字列。
 * @returns Canonical判定用の状態文字列。
 * @precondition stateは文字列である。
 * @postcondition 正規化後の文字列だけを返す。
 * @effect N/A: 文字列の局所計算だけを行う。
 * @failure N/A: 独自の失敗分岐を持たない。
 * @invariant 入力や共有状態を変更しない。
 * @boundary N/A: 同一Process内の純粋計算である。
 * @security 正規化は品質の成立や認可を意味しない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
function normalizeQualityDesignState(state: string): string {
  return state
    .replace(/^v\d+\.\d+\.\d+\s+/u, "")
    .replace(/（Released Baseline:[^）]+）$/u, "")
    .trim();
}

/**
 * 指定された各成果物にCanonical状態を要求する。
 *
 * @responsibility 欠落・非Canonicalを一成果物一Issueで返し、入力順を維持する。
 * @trace ARCH-000008
 * @input artifacts: 呼出し元が検査対象として選んだ解析済み成果物集合。
 * @returns 不一致のDomainIssue列。元statusとnormalizedStatusを分離して返す。
 * @precondition 対象集合の選択とreadinessの適用判断は呼出し元が所有する。
 * @postcondition 正規化後がCanonical以外の成果物だけを入力順に返す。
 * @effect N/A: 入力の読取りと局所的な配列構築だけを行う。
 * @failure 欠落または非CanonicalをIssueで返し、例外や正常値へ丸めない。
 * @invariant 入力Artifact・集合・共有状態を変更しない。
 * @boundary N/A: 解析済みモデル間の純粋計算である。
 * @security 空のIssue列は与えられた集合の状態条件だけを表し、品質全体の完成を表さない。
 * @concurrency N/A: 共有可変状態を持たない同期処理である。
 */
export function inspectQualityDesignStates(
  artifacts: readonly ArtifactModel[],
): readonly DomainIssue[] {
  const issues: DomainIssue[] = [];
  for (const artifact of artifacts) {
    const normalizedStatus = normalizeQualityDesignState(artifact.status ?? "");
    if (normalizedStatus !== "Canonical")
      issues.push({
        kind: "artifact.quality-design.state-invalid",
        targetIdentity: artifact.canonicalId ?? artifact.sourceLocation.path,
        location: artifact.sourceLocation,
        reason: "canonical_state_required",
        details: { status: artifact.status, normalizedStatus },
      });
  }
  return issues;
}

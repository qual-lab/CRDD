/**
 * Discovery探索分析・要求定義・採用要求入口の既読本文を扱う。
 * @responsibility 必須構造・Placeholder・探索参照・Checklistの既存条件を所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import { inspectEvaluatedChecklist } from "./checklist.ts";
import { createPhaseChecklistItems } from "./phase-checklists.ts";

/**
 * Discovery要求定義の構造とChecklistを検査する。
 * @responsibility 生本文の限定条件を構造・Checklistの順序付き中立Issueへ変換する。
 * @trace ARCH-000008
 * @input source: 取得済み本文と位置。requirementId: 列挙元の期待REQ ID。
 * @returns 構造とChecklistの順序付きIssue列。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 構造不正でもChecklist検査を継続する。
 * @effect N/A: 既読本文と局所配列だけを扱う同期検査。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 最初のEXP参照・生本文・既存見出しと受理条件を維持する。
 * @boundary N/A: 同一Process内の本文検査。
 * @security EXP実在・状態・参照一意性・意味重複や品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectDiscoveryDefinition(
  source: ArtifactSource,
  requirementId: string,
): readonly DomainIssue[] {
  const definition = source.content;
  const issues: DomainIssue[] = [];
  const { discoveryRequirementChecklistItemTexts } =
    createPhaseChecklistItems();
  const requiredDefinitionSections = [
    "## 対象と利用状況",
    "## 解く問題と望ましい変化",
    "## 採用理由と比較",
    "## 成立条件",
    "## 検証意図",
    "## 関係",
  ];
  const hasPlaceholder =
    /REQ-XXXXXX|EXP-XXXXXX|UX-XXXXXX|TODO|TBD|（要求名）|（探索名）/u.test(
      definition,
    );
  const sourceRelation = definition.match(
    /元の探索記録: \[(EXP-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/(EXP-[0-9]{6})\/exploration\.md\)/u,
  );
  if (
    !definition.includes(`要求ID: \`${requirementId}\``) ||
    !definition.includes("成果物種別: Discovery定義") ||
    !definition.includes("## 要求") ||
    requiredDefinitionSections.some(
      (heading) => !definition.includes(heading),
    ) ||
    !/## (?:制約|失敗・リスク・制約)/u.test(definition) ||
    !/## (?:工程引渡し|UXへの引き渡し)/u.test(definition) ||
    hasPlaceholder ||
    !sourceRelation ||
    sourceRelation[1] !== sourceRelation[2]
  )
    issues.push({
      kind: "artifact.discovery.definition-contract-invalid",
      targetIdentity: requirementId,
      location: { path: source.path },
      reason: "definition-contract-invalid",
      details: {},
    });
  const checklistError = inspectEvaluatedChecklist(
    definition,
    discoveryRequirementChecklistItemTexts,
  );
  if (checklistError)
    issues.push({
      kind: "artifact.discovery.definition-checklist-invalid",
      targetIdentity: requirementId,
      location: { path: source.path },
      reason: "definition-checklist-invalid",
      details: { checklistFailure: checklistError },
    });
  return issues;
}

/**
 * Discovery探索分析の構造とChecklistを検査する。
 * @responsibility 成果物種別・期待EXP IDと評価済みChecklistを順序付きIssueへ変換する。
 * @trace ARCH-000008
 * @input source: 既読本文と位置。explorationId: 列挙元の期待EXP ID。
 * @returns 構造、Checklistの順序付き中立Issue列。
 * @precondition 呼出し元が対象を選択し本文を取得している。
 * @postcondition 構造不正でもChecklistを検査する。
 * @effect N/A: 既読本文と局所配列だけを扱う同期検査。
 * @failure 解析例外を伝播し不足を補完しない。
 * @invariant 構造の生本文判定と可視Checklistの受理条件を維持する。
 * @boundary N/A: 同一Process内の本文検査。
 * @security 参照実在・採用・品質全体の成立を保証しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function inspectDiscoveryAnalysis(
  source: ArtifactSource,
  explorationId: string,
): readonly DomainIssue[] {
  const analysis = source.content;
  const issues: DomainIssue[] = [];
  const { discoveryExplorationChecklistItemTexts } =
    createPhaseChecklistItems();
  if (
    !analysis.includes("成果物種別: Discovery分析") ||
    !analysis.includes(`探索ID: \`${explorationId}\``)
  )
    issues.push({
      kind: "artifact.discovery.analysis-contract-invalid",
      targetIdentity: explorationId,
      location: { path: source.path },
      reason: "analysis-contract-invalid",
      details: {},
    });
  const checklistError = inspectEvaluatedChecklist(
    analysis,
    discoveryExplorationChecklistItemTexts,
  );
  if (checklistError)
    issues.push({
      kind: "artifact.discovery.analysis-checklist-invalid",
      targetIdentity: explorationId,
      location: { path: source.path },
      reason: "analysis-checklist-invalid",
      details: { checklistFailure: checklistError },
    });
  return issues;
}

/**
 * Discovery入口の採用要求行からID集合を解析する。
 * @responsibility 生本文の行条件と最初のREQ IDのSet化を所有する。
 * @trace ARCH-000008
 * @input markdown: 呼出し元が取得した入口の生本文。
 * @returns 採用要求ID集合。
 * @precondition 呼出し元が従来の観測位置で本文を取得している。
 * @postcondition コメント・Fenceを新たに除去せず重複IDをSetへ畳む。
 * @effect N/A: 局所文字列と集合だけを扱う同期解析。
 * @failure 文字列操作の例外を伝播する。
 * @invariant 行頭のREQ形式・要求採用セル・最初のIDだけを認識する。
 * @boundary N/A: 既読本文の解析。
 * @security 要求の採用判断そのものを行わず、実在・品質成立を保証しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function parseAdoptedDiscoveryRequirements(
  markdown: string,
): ReadonlySet<string> {
  return new Set(
    markdown
      .split(/\r?\n/u)
      .filter(
        (line) =>
          /^\| (?:`|\[)REQ-[0-9]{6}/u.test(line) &&
          line.includes("| 要求採用 |"),
      )
      .map((line) => line.match(/REQ-[0-9]{6}/u)?.[0])
      .filter((value): value is string => Boolean(value)),
  );
}

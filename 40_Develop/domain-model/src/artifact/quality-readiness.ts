/**
 * Quality文書の有限状態を検査する。
 * @responsibility 取得済み値の意味だけを所有し、Filesystem観測と診断表示は所有しない。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import { omitMarkdownCommentsAndFencedCode } from "./markdown.ts";
/**
 * Quality Centerの有限状態を解析し、Ready分岐の条件を返す。
 * @responsibility Quality Centerの有限状態を解析し、Ready分岐の条件を返す。
 * @trace ARCH-000008
 * @input qualityCenter: 生本文。qualityCenterPath: 診断位置。
 * @returns 正規化状態、既知状態・Design Ready・Quality Readyの判定とIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 本文から解析できない状態をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityCenterState(
  qualityCenter: string,
  qualityCenterPath: string,
) {
  const issues: DomainIssue[] = [];

  const qualityCenterState =
    qualityCenter.match(/^状態:\s*(.+?)\s*$/mu)?.[1] ?? "";
  const normalizedQualityState = qualityCenterState
    .replace(/^v\d+\.\d+\.\d+\s+/u, "")
    .replace(/（Released Baseline:[^）]+）$/u, "")
    .trim();
  const qualityStateKinds = [
    "Quality Design Under Review — Reality Audit Blocked",
    "Quality Design Ready — Reality Audit Pending",
    "Quality Ready",
  ] as const;
  const isQualityStateKnown = qualityStateKinds.some(
    (state) => state === normalizedQualityState,
  );
  if (!isQualityStateKnown)
    issues.push({
      kind: "artifact.quality-analysis.state-invalid",
      targetIdentity: qualityCenterPath,
      location: { path: qualityCenterPath },
      reason: "state-invalid",
      details: {},
    });
  const isQualityDesignReady =
    normalizedQualityState === "Quality Design Ready — Reality Audit Pending";
  const isQualityReady = normalizedQualityState === "Quality Ready";

  return {
    normalizedQualityState,
    isQualityStateKnown,
    isQualityDesignReady,
    isQualityReady,
    issues,
  };
}

/**
 * Quality CenterとReality Auditの状態対を照合する。
 * @responsibility Quality CenterとReality Auditの状態対を照合する。
 * @trace ARCH-000008
 * @input realityAuditState: 観測した状態。realityAuditPath／qualityCenterPath: 診断位置。center: 同じCenter解析結果。
 * @returns Reality状態不正と状態対不一致のIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 未知Reality状態・不一致をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectQualityRealityState(
  realityAuditState: string,
  realityAuditPath: string,
  qualityCenterPath: string,
  center: ReturnType<typeof inspectQualityCenterState>,
) {
  const {
    normalizedQualityState,
    isQualityStateKnown,
    isQualityDesignReady,
    isQualityReady,
  } = center;
  const issues: DomainIssue[] = [];

  const allowedRealityAuditStates = [
    "Blocked — Quality Design Review Pending",
    "Pending — Not Started",
    "In Progress",
    "Complete",
  ] as const;
  if (!allowedRealityAuditStates.some((state) => state === realityAuditState))
    issues.push({
      kind: "artifact.quality-analysis.reality-audit-state-invalid",
      targetIdentity: realityAuditPath,
      location: { path: realityAuditPath },
      reason: "reality-audit-state-invalid",
      details: {},
    });
  const isRealityStateAllowedForCenter =
    (normalizedQualityState ===
      "Quality Design Under Review — Reality Audit Blocked" &&
      realityAuditState === "Blocked — Quality Design Review Pending") ||
    (isQualityDesignReady &&
      ["Pending — Not Started", "In Progress"].includes(realityAuditState)) ||
    (isQualityReady && realityAuditState === "Complete");
  if (isQualityStateKnown && !isRealityStateAllowedForCenter)
    issues.push({
      kind: "artifact.quality-analysis.state-reality-audit-state-mismatch",
      targetIdentity: qualityCenterPath,
      location: { path: qualityCenterPath },
      reason: "state-reality-audit-state-mismatch",
      details: {},
    });

  return { issues };
}

/**
 * Readyを妨げる可視ChecklistのOPEN・FAIL・未確認項目を検出する。
 * @responsibility Readyを妨げる可視ChecklistのOPEN・FAIL・未確認項目を検出する。
 * @trace ARCH-000008
 * @input content: 読取り済み本文。
 * @returns 可視ChecklistにOPEN・FAIL・未確認項目があればtrue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 例外を伝播する。Issueや品質全体の成立は返さない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function hasQualityOpenChecklist(content: string): boolean {
  const visible = omitMarkdownCommentsAndFencedCode(content);
  const checklist = visible.match(/^## Checklist\s*$([\s\S]*)$/mu)?.[1] ?? "";
  return /^- (?:OPEN|FAIL):/mu.test(checklist) || /^- \[ \]/mu.test(checklist);
}

/**
 * 検証・是正表の意味を検査する。
 * @responsibility 取得済み本文を解析し、中立Issueと観測件数を返す。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import { parseMarkdownTableRow, isMarkdownTableSeparator } from "./markdown.ts";
import { omitMarkdownFencedCode } from "./anchors.ts";
/**
 * 分岐網羅表の件数・範囲・実測率の算術を検査する。
 * @responsibility 分岐網羅表の件数・範囲・実測率の算術を検査する。
 * @trace ARCH-000008
 * @input artifact: 生本文と診断位置。
 * @returns numericRowsCheckedと、非数値・範囲・件数・率の不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正値と算術条件をIssueで返し、解析例外を伝播する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectBranchCoverageTable(artifact: ArtifactSource) {
  const issues: DomainIssue[] = [];
  const sourcePath = artifact.path;
  let numericRowsChecked = 0;
  const lines = omitMarkdownFencedCode(artifact.content).split(/\r?\n/u);
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headers = parseMarkdownTableRow(lines[index] as string);
    if (!headers) continue;
    const numeratorIndex = headers.findIndex((header) =>
      ["到達分岐数（分子）", "Covered Branches (Numerator)"].includes(header),
    );
    const denominatorIndex = headers.findIndex((header) =>
      ["対象分岐数（分母）", "Total Branches (Denominator)"].includes(header),
    );
    const percentageIndex = headers.findIndex((header) =>
      ["実測率", "Measured Rate"].includes(header),
    );
    if (
      numeratorIndex < 0 ||
      denominatorIndex < 0 ||
      percentageIndex < 0 ||
      !isMarkdownTableSeparator(lines[index + 1] as string, headers.length)
    ) {
      continue;
    }
    for (let row = index + 2; row < lines.length; row += 1) {
      const cells = parseMarkdownTableRow(lines[row] as string);
      if (!cells) break;
      const values = [
        cells[numeratorIndex] ?? "",
        cells[denominatorIndex] ?? "",
        cells[percentageIndex] ?? "",
      ].map((value) => value.trim()) as [string, string, string];
      if (values.every((value) => value === "")) continue;
      const marker =
        /^(?:N\/A|TBD|Not Applicable|Not Measured|対象外|未測定)$/iu;
      if (values.filter(Boolean).every((value) => marker.test(value))) {
        continue;
      }
      const countPattern = /^-?\d+(?:,\d{3})*$/u;
      const percentagePattern = /^-?\d+(?:\.\d+)?%?$/u;
      if (
        !countPattern.test(values[0]) ||
        !countPattern.test(values[1]) ||
        !percentagePattern.test(values[2])
      ) {
        issues.push({
          kind: "artifact.document-rule.branch-coverage-value",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "branch-coverage-value",
          details: { value0: String(row + 1) },
        });
        continue;
      }
      const numerator = Number(values[0].replaceAll(",", ""));
      const denominator = Number(values[1].replaceAll(",", ""));
      const percentage = Number(
        values[2].replaceAll(",", "").replace(/%$/u, ""),
      );
      numericRowsChecked += 1;
      if (
        !Number.isInteger(numerator) ||
        !Number.isInteger(denominator) ||
        numerator < 0 ||
        denominator <= 0 ||
        percentage < 0 ||
        percentage > 100
      ) {
        issues.push({
          kind: "artifact.document-rule.branch-coverage-range",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "branch-coverage-range",
          details: { value0: String(row + 1) },
        });
        continue;
      }
      if (numerator > denominator) {
        issues.push({
          kind: "artifact.document-rule.branch-coverage-count",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "branch-coverage-count",
          details: {
            value0: String(row + 1),
            value1: String(numerator),
            value2: String(denominator),
          },
        });
      }
      const expected = (numerator / denominator) * 100;
      if (Math.abs(expected - percentage) > 0.11) {
        issues.push({
          kind: "artifact.document-rule.branch-coverage-percentage",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "branch-coverage-percentage",
          details: {
            value0: String(row + 1),
            value1: String(numerator),
            value2: String(denominator),
            value3: String(expected.toFixed(2)),
            value4: String(percentage),
          },
        });
      }
    }
  }

  return { numericRowsChecked, issues };
}
/**
 * 是正表の状態・解決条件・阻害条件と必要値を検査する。
 * @responsibility 是正表の状態・解決条件・阻害条件と必要値を検査する。
 * @trace ARCH-000008
 * @input artifact: 生本文と診断位置。
 * @returns remediationRowsCheckedと、状態・解決・阻害条件のIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正条件をIssueで返し、解析例外を伝播する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectRemediationTable(artifact: ArtifactSource) {
  const issues: DomainIssue[] = [];
  const sourcePath = artifact.path;
  let remediationRowsChecked = 0;
  const remediationHeaderAliases = {
    progress: ["処置進捗", "Remediation Progress"],
    blocker: ["阻害状態", "Remediation Blocker State", "Blocker State"],
    resolution: ["解消判定", "Remediation Resolution Verdict", "Resolution"],
    acceptance: ["受入条件", "Acceptance"],
    oracle: ["判定方法", "Oracle"],
    evidence: ["根拠", "Evidence"],
    review: ["独立再レビュー", "Independent Review"],
    current: ["現在状態への反映", "Current Projection"],
    blockerReason: ["阻害理由", "Blocker Reason"],
    requiredInput: ["必要事項", "Required Input"],
    owner: ["担当責任者", "Owner"],
    restart: ["再開条件", "Restart Condition"],
  };
  /**
   * current-profileで使用するRemediation Columnの値契約を定義する。
   *
   * @responsibility Remediation ColumnのProperty、Identity、状態制約を型境界として所有する。
   * @trace ARCH-000008
   * @shape RemediationColumnが表すProperty、識別子およびRelationを型として固定する。
   * @invariant RemediationColumnで宣言した値と責務の対応を維持する。
   * @boundary N/A: RemediationColumnの宣言は外部境界を開かない。
   * @security N/A: RemediationColumnはAuthority、秘密値または信頼判断を扱わない。
   * @compatibility RemediationColumnの利用側は宣言済みPropertyと型制約だけへ依存する。
   */
  type RemediationColumn = keyof typeof remediationHeaderAliases;
  const remediationPlaceholder =
    /^(?:|[-—–]|N\/A|TBD|TODO|None|なし|未定|未取得|未確認|対象外)$/iu;

  const lines = omitMarkdownFencedCode(artifact.content).split(/\r?\n/u);
  for (let index = 0; index < lines.length - 2; index += 1) {
    const headers = parseMarkdownTableRow(lines[index] as string);
    if (!headers) continue;
    const column = (name: RemediationColumn): number =>
      headers.findIndex((header) =>
        remediationHeaderAliases[name].includes(header),
      );
    const progressIndex = column("progress");
    const blockerIndex = column("blocker");
    const resolutionIndex = column("resolution");
    const stateColumnIndexes = [progressIndex, blockerIndex, resolutionIndex];
    const stateColumnCount = stateColumnIndexes.filter(
      (target) => target >= 0,
    ).length;
    let precedingHeading = "";
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (/^\s*#{1,6}\s+/u.test(lines[previous] as string)) {
        precedingHeading = lines[previous] as string;
        break;
      }
    }
    const hasExplicitRemediationContext =
      /(?:是正|remediation)/iu.test(precedingHeading) ||
      headers.some((header) =>
        ["是正対象", "Remediation Target"].includes(header),
      );
    if (
      (stateColumnCount !== 3 &&
        !(stateColumnCount >= 1 && hasExplicitRemediationContext)) ||
      !isMarkdownTableSeparator(lines[index + 1] as string, headers.length)
    ) {
      continue;
    }
    const stateColumns: Array<readonly [RemediationColumn, number]> = [
      ["progress", progressIndex],
      ["blocker", blockerIndex],
      ["resolution", resolutionIndex],
    ];
    const missingStateColumns = stateColumns.filter(([, target]) => target < 0);
    if (missingStateColumns.length > 0) {
      issues.push({
        kind: "artifact.document-rule.remediation-state-columns-missing",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "remediation-state-columns-missing",
        details: {
          value0: String(index + 1),
          value1: String(
            missingStateColumns
              .map(([name]) => remediationHeaderAliases[name][0])
              .join(", "),
          ),
        },
      });
    }
    const optionalColumns = new Map<RemediationColumn, number>();
    for (const name of Object.keys(remediationHeaderAliases)) {
      if (name in remediationHeaderAliases) {
        const knownName =
          name === "progress" ||
          name === "blocker" ||
          name === "resolution" ||
          name === "acceptance" ||
          name === "oracle" ||
          name === "evidence" ||
          name === "review" ||
          name === "current" ||
          name === "blockerReason" ||
          name === "requiredInput" ||
          name === "owner" ||
          name === "restart"
            ? name
            : null;
        if (knownName !== null)
          optionalColumns.set(knownName, column(knownName));
      }
    }
    for (let row = index + 2; row < lines.length; row += 1) {
      const cells = parseMarkdownTableRow(lines[row] as string);
      if (!cells) break;
      if (cells.every((cell) => cell === "")) continue;
      remediationRowsChecked += 1;
      const progress = progressIndex >= 0 ? (cells[progressIndex] ?? "") : "";
      const blocker = blockerIndex >= 0 ? (cells[blockerIndex] ?? "") : "";
      const resolution =
        resolutionIndex >= 0 ? (cells[resolutionIndex] ?? "") : "";
      const location = `line ${row + 1}`;
      if (/^fixed$/iu.test(progress) || /^fixed$/iu.test(resolution)) {
        issues.push({
          kind: "artifact.document-rule.ambiguous-remediation-state",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "ambiguous-remediation-state",
          details: { value0: String(location) },
        });
      }
      if (
        progressIndex >= 0 &&
        !["Identified", "Planned", "Applied", "Self-checked"].includes(progress)
      ) {
        issues.push({
          kind: "artifact.document-rule.remediation-progress-value",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "remediation-progress-value",
          details: { value0: String(location) },
        });
      }
      if (blockerIndex >= 0 && !["None", "Blocked"].includes(blocker)) {
        issues.push({
          kind: "artifact.document-rule.remediation-blocker-value",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "remediation-blocker-value",
          details: { value0: String(location) },
        });
      }
      if (resolutionIndex >= 0 && !["Open", "Resolved"].includes(resolution)) {
        issues.push({
          kind: "artifact.document-rule.remediation-resolution-value",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "remediation-resolution-value",
          details: { value0: String(location) },
        });
      }
      const requireValues = (
        names: readonly RemediationColumn[],
        code: string,
        shouldRequireValues: boolean,
      ): void => {
        if (!shouldRequireValues) return;
        const missingNames = names.filter((name) => {
          const targetIndex = optionalColumns.get(name) ?? -1;
          return (
            targetIndex < 0 ||
            remediationPlaceholder.test(cells[targetIndex] ?? "")
          );
        });
        if (missingNames.length > 0) {
          issues.push({
            kind: `artifact.document-rule.${code}`,
            targetIdentity: sourcePath,
            location: { path: sourcePath },
            reason: code,
            details: {
              value0: String(location),
              value1: String(
                missingNames
                  .map((name) => remediationHeaderAliases[name][0])
                  .join(", "),
              ),
            },
          });
        }
      };
      requireValues(
        ["acceptance", "oracle", "evidence", "review", "current"],
        "premature-remediation-resolution",
        resolution === "Resolved",
      );
      if (
        resolution === "Resolved" &&
        (progress !== "Self-checked" || blocker !== "None")
      ) {
        issues.push({
          kind: "artifact.document-rule.inconsistent-remediation-state",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "inconsistent-remediation-state",
          details: { value0: String(location) },
        });
      }
      requireValues(
        ["blockerReason", "requiredInput", "owner", "restart"],
        "incomplete-remediation-blocker",
        blocker === "Blocked",
      );
    }
  }

  return { remediationRowsChecked, issues };
}

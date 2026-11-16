/**
 * 変更文書の構造・ひな型・案内集合を検査する。
 * @responsibility 取得済みCHG文書の限定条件と中立Issueを所有する。
 * @trace ARCH-000008
 */
import type { DocumentIssue } from "../artifact/types.ts";
import type { ChangeDocument, ChangeIndex } from "./types.ts";

/**
 * 変更定義の観測済み配置・別取得Header・集約Identityを照合する。
 * @responsibility Change専用の配置意味を所有しPath探索は行わない。
 * @trace ARCH-000008
 * @input request: Callerが選んだ位置と取得済み内容。
 * @returns 旧位置で配送する中立Issue。
 * @effect N/A: 値比較のみ。
 * @failure 未知kindを拒否する。
 */
export function inspectChangePlacement(
  request:
    | Readonly<{ kind: "filename"; path: string }>
    | Readonly<{
        kind: "evidence";
        heading: ChangeDocument;
        identity: ChangeDocument;
      }>
    | Readonly<{
        kind: "unrecognized";
        path: string;
        repositoryMode: string;
        patterns: readonly string[];
      }>
    | Readonly<{
        kind: "aggregate";
        document: ChangeDocument;
        aggregateName: string;
      }>,
): readonly DocumentIssue[] {
  let reason: string;
  let file: string;
  let details: DocumentIssue["details"] = {};
  switch (request.kind) {
    case "filename":
      if (!/^CHG-[^.]+\.md$/u.test(request.path.split("/").at(-1) ?? ""))
        return [];
      reason = "legacy-change-trace-layout";
      file = request.path;
      break;
    case "evidence":
      if (!(request.identity.changeId && request.heading.hasStandardHeading))
        return [];
      reason = "change-trace-placement-evidence";
      file = request.heading.source.path;
      break;
    case "unrecognized":
      reason = "change-trace-placement";
      file = request.path;
      details = {
        repositoryMode: request.repositoryMode,
        patterns: request.patterns.join(", "),
      };
      break;
    case "aggregate": {
      const id = request.aggregateName.match(/^CHG-(?:[0-9]{6}|XXXXXX)/u)?.[0];
      if (id && request.document.changeId && id === request.document.changeId)
        return [];
      reason = "change-trace-aggregate-identity-mismatch";
      file = request.document.source.path;
      break;
    }
    default:
      throw new Error("unknown_change_placement_kind");
  }
  return [
    {
      kind: `artifact.change.${reason}`,
      targetIdentity: file,
      location: { path: file },
      reason,
      details,
    },
  ];
}
/**
 * Canonical変更文書の影響区画とPhase条件を検査する。
 * @responsibility Canonical変更文書の影響区画とPhase条件を検査する。
 * @input document: 捕捉済みの本文・見出し・影響行・収束表と期待Identity。
 * @returns 既存順の中立Issue列。
 * @precondition Parserが同じ取得本文から構造を捕捉済みである。
 * @postcondition 影響見出し不一致だけは後続を打ち切り、不正Blockでは続行する。
 * @trace ARCH-000008
 * @effect N/A: 入力と局所値だけを扱う純粋な同期検査。
 * @failure 入力の実行時例外を伝播し、不正を成功へ補完しない。
 * @invariant 現行の生本文・正規表現・検査順と受理条件を維持する。
 * @boundary N/A: 取得済み変更文書のモデル検査。
 * @security 認可・採用・移行完了や品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function validateChangeDocument(
  document: ChangeDocument,
): readonly DocumentIssue[] {
  const source = document.source;
  const aggregateId =
    document.expectedIdentity ?? document.changeId ?? source.path;
  if (document.mode === "template")
    return isTemplateInvalid(document)
      ? [
          {
            kind: "artifact.change.template-invalid",
            targetIdentity: aggregateId,
            location: { path: source.path },
            reason: "template-invalid",
            details: {},
          },
        ]
      : [];
  const issues: DocumentIssue[] = [];
  const impactHeadings = document.impactHeadings;
  if (impactHeadings.length !== 1) {
    issues.push({
      kind: "artifact.change.impact-files-section-mismatch",
      targetIdentity: aggregateId,
      location: { path: source.path },
      reason: "impact-files-section-mismatch",
      details: {},
    });
    return issues;
  }
  const impactLines = document.impactBlock
    ? document.impactLines.map((line) => line.text)
    : undefined;
  const impactLinePattern =
    /^- (?:\[[^\]]+\]\([^)]+\)|`[^`]+`（(?:削除|削除または旧Path)）|`[^`]+` → \[[^\]]+\]\([^)]+\))$/u;
  if (
    !impactLines ||
    impactLines.length === 0 ||
    impactLines.some((line) => !impactLinePattern.test(line))
  ) {
    issues.push({
      kind: "artifact.change.impact-files-contract-invalid",
      targetIdentity: aggregateId,
      location: { path: source.path },
      reason: "impact-files-contract-invalid",
      details: {},
    });
  }
  if (document.legacyImpactHeadings.length > 0) {
    issues.push({
      kind: "artifact.change.legacy-impact-heading",
      targetIdentity: aggregateId,
      location: { path: source.path },
      reason: "legacy-impact-heading",
      details: {},
    });
  }
  if (Number.parseInt(aggregateId.slice(4), 10) >= 80) {
    const phasedChangeHeadings = [
      "## Phase／Gateと途中拡張",
      "### 適用判断",
      "### PhaseとGate",
      "### 途中拡張の記録",
      "### 途中見直しの記録",
    ];
    const phasedChangeTableHeaders = [
      "| 評価対象 | 判定 | 理由 |",
      "| Phase | 目的 | 変更範囲 | 検証 | Gate／通過条件 | 状態 |",
      "| Finding／契機 | 同じIntentと判断した理由 | 追加Phase／範囲 | Gate・完了条件への影響 | 追加確認／人間判断 | 処置 |",
      "| 契機 | 崩れた前提／旧判断 | 改訂後のPhase／Gate | 再実行する検証 | 不変範囲 | 処置 |",
      "| 評価対象 | 判定 | 内容／理由 | 参照／再評価契機 |",
    ];
    const requiredConvergenceEvaluations = new Set([
      "非自明な変更としての収束確認",
      "変更する契約母集団",
      "既知の利用側母集団と対象別の予定処置",
      "安全上重要な層間搬送",
      "保護対象Effect／Recoveryの耐久Authority",
      "残存資源／Recovery／Authority義務を伴う取得transaction",
      "発火例／非発火例／境界例／情報不足例",
      "定義・発火条件・判定不能・正式結果の分離",
      "固定前の実差分照合",
      "根拠の主張軸（入口形態）",
      "根拠の主張軸（観測基盤）",
      "根拠の主張軸（成果物Identity）",
      "根拠の主張軸（lifecycle）",
      "未解消の不一致",
    ]);
    const convergenceRows = document.convergenceRows.map((row) => row.cells);
    const convergenceNames = convergenceRows.map((cells) => cells[0] ?? "");
    const isConvergenceEvaluationInvalid =
      convergenceRows.length !== requiredConvergenceEvaluations.size ||
      new Set(convergenceNames).size !== requiredConvergenceEvaluations.size ||
      [...requiredConvergenceEvaluations].some(
        (item) => !convergenceNames.includes(item),
      ) ||
      convergenceRows.some(
        (cells) =>
          cells.length !== 4 ||
          !["Applicable", "N/A", "OPEN"].includes(cells[1] ?? "") ||
          !cells[2] ||
          !cells[3],
      );
    if (
      phasedChangeHeadings.some(
        (heading) => !document.lines.some((line) => line.text === heading),
      ) ||
      phasedChangeTableHeaders.some(
        (header) => !document.lines.some((line) => line.text === header),
      ) ||
      !document.lines.some((line) =>
        line.text.includes("## 固定前の収束確認"),
      ) ||
      isConvergenceEvaluationInvalid ||
      !document.lines.some((line) =>
        /^\| Phase／Gate \| (?:`?Applicable`?|`?N\/A`?) \| \S.*\|$/mu.test(
          line.text,
        ),
      )
    )
      issues.push({
        kind: "artifact.change.phase-gate-contract-incomplete",
        targetIdentity: aggregateId,
        location: { path: source.path },
        reason: "phase-gate-contract-incomplete",
        details: {},
      });
  }

  return issues;
}
/**
 * 変更ひな型の必須構造が不正かを判定する。
 * @responsibility 変更ひな型の必須構造が不正かを判定する。
 * @input document: 捕捉済みのひな型行。
 * @returns 既存のひな型条件に違反すればtrue。
 * @precondition 呼出し元がひな型の存在と対象を確認している。
 * @postcondition Canonical本文の条件へ統合せず既存のひな型条件だけを返す。
 * @trace ARCH-000008
 * @effect N/A: 入力と局所値だけを扱う純粋な同期検査。
 * @failure 入力の実行時例外を伝播し、不正を成功へ補完しない。
 * @invariant 現行の生本文・正規表現・検査順と受理条件を維持する。
 * @boundary N/A: 取得済み変更文書のモデル検査。
 * @security 認可・採用・移行完了や品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
function isTemplateInvalid(document: ChangeDocument): boolean {
  return (
    !document.lines.some((line) => /^### 影響ファイル$/mu.test(line.text)) ||
    !document.lines.some((line) =>
      /^<summary>全ファイルを表示<\/summary>$/mu.test(line.text),
    ) ||
    document.lines.some((line) => /^### 主な反映ファイル$/mu.test(line.text)) ||
    !document.lines.some((line) =>
      /^\| Phase／Gate適用判断 \|/mu.test(line.text),
    ) ||
    !document.lines.some((line) =>
      /^## Phase／Gateと途中拡張$/mu.test(line.text),
    ) ||
    !document.lines.some((line) => /^### 適用判断$/mu.test(line.text)) ||
    !document.lines.some((line) => /^### PhaseとGate$/mu.test(line.text)) ||
    !document.lines.some((line) => /^### 途中拡張の記録$/mu.test(line.text)) ||
    !document.lines.some((line) =>
      /^### 途中見直しの記録$/mu.test(line.text),
    ) ||
    !document.lines.some((line) => /^## 固定前の収束確認$/mu.test(line.text)) ||
    !document.lines.some((line) => /^## 変更経路の計画$/mu.test(line.text)) ||
    !document.lines.some((line) =>
      /^- 適用判定: `<Applicable／N\/A: 理由／OPEN: 理由・確認先・再評価契機>`$/mu.test(
        line.text,
      ),
    ) ||
    document.lines.some((line) =>
      /## 変更経路の計画（非自明な変更で該当する場合）/u.test(line.text),
    ) ||
    !document.lines.some((line) =>
      /^\| 評価対象 \| 判定 \| 理由 \|$/mu.test(line.text),
    ) ||
    !document.lines.some((line) =>
      /^\| 評価対象 \| 判定 \| 内容／理由 \| 参照／再評価契機 \|$/mu.test(
        line.text,
      ),
    ) ||
    !document.lines.some((line) =>
      /^\| Phase \| 目的 \| 変更範囲 \| 検証 \| Gate／通過条件 \| 状態 \|$/mu.test(
        line.text,
      ),
    ) ||
    !document.lines.some((line) =>
      /^\| Finding／契機 \| 同じIntentと判断した理由 \| 追加Phase／範囲 \| Gate・完了条件への影響 \| 追加確認／人間判断 \| 処置 \|$/mu.test(
        line.text,
      ),
    ) ||
    !document.lines.some((line) =>
      /^\| 契機 \| 崩れた前提／旧判断 \| 改訂後のPhase／Gate \| 再実行する検証 \| 不変範囲 \| 処置 \|$/mu.test(
        line.text,
      ),
    )
  );
}
/**
 * 案内自身のリンク重複だけを検査する。
 * @responsibility 実在ID集合を参照せず、一文書内の不正を返す。
 * @trace ARCH-000008
 */
export function validateChangeIndex(
  index: ChangeIndex,
): readonly DocumentIssue[] {
  const ids = index.entries.map((entry) => entry.identity);
  return new Set(ids).size === ids.length
    ? []
    : [
        {
          kind: "artifact.change.navigation-population-mismatch",
          targetIdentity: index.source.path,
          location: { path: index.source.path },
          reason: "navigation-population-mismatch",
          details: {},
        },
      ];
}

/**
 * 変更案内と観測済み変更IDの被覆を比較する。
 * @responsibility 取得済みモデルから既存順の中立Issueを返す。
 * @trace ARCH-000008
 * @input request: 変更案内モデルと既存観測のID列。
 * @returns 既存条件に対応するIssue列。局所重複は重ねない。
 * @precondition 実体観測は呼出し元が完了している。
 * @postcondition 入力を変更せず、本文やFilesystemを再取得しない。
 * @effect N/A: 同期的な値比較。
 * @failure 比較例外を伝播し、不明を補完しない。
 * @invariant 短絡・診断順と既存の対象範囲を維持する。
 * @boundary 同一Process内の工程意味検査。
 * @security 実在・認可・全品質の成立を保証しない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function inspectChangeNavigation(
  request: Readonly<{
    index: ChangeIndex;
    observedChangeIds: readonly string[];
  }>,
): readonly DocumentIssue[] {
  const indexedIds = request.index.entries
    .map((entry) => entry.identity)
    .sort();
  const uniqueIndexedIds = new Set(indexedIds);
  // 単体重複はParseが一件返す。追加すると旧一件診断を二重化する。
  if (indexedIds.length !== uniqueIndexedIds.size) return [];
  if (
    request.observedChangeIds.length === uniqueIndexedIds.size &&
    request.observedChangeIds.every((id) => uniqueIndexedIds.has(id))
  )
    return [];
  return [
    {
      kind: "artifact.change.navigation-population-mismatch",
      targetIdentity: request.index.source.path,
      location: { path: request.index.source.path },
      reason: "navigation-population-mismatch",
      details: {},
    },
  ];
}

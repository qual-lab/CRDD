/**
 * 変更文書の構造・ひな型・案内集合を検査する。
 * @responsibility 取得済みCHG文書の限定条件と中立Issueを所有する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
/**
 * 変更記録HeaderのIDと標準見出しを解析する。
 * @responsibility IDと見出しを独立に解析し、読取りや配置判断は所有しない。
 * @trace ARCH-000008
 * @input header: 呼出し元が取得した先頭40行。
 * @returns changeIdとhasStandardHeading。ID欠落はnull。
 * @precondition Headerの取得範囲は呼出し元が選択する。
 * @postcondition 最初のIDと見出し文法の一致だけを返す。
 * @effect N/A: 文字列解析のみ。
 * @failure 解析例外を伝播し、欠落IDを推測しない。
 * @invariant 正規表現・大小文字・改行の既存受理条件を維持する。
 * @boundary N/A: 同一Process内の値処理。
 * @security 配置・所有・実在を保証しない。
 * @concurrency N/A: 共有状態を持たない。
 */
export function parseChangeTraceHeader(header: string) {
  return {
    changeId:
      header.match(
        /^(?:Change ID|変更(?:トレース)?ID|change_id)\s*[:：]\s*`?(CHG-[A-Za-z0-9-]+)/imu,
      )?.[1] || null,
    hasStandardHeading:
      /^#\s*(?:Change Trace(?=$|[:：(（])|変更トレース(?=$|[:：(（]))/imu.test(
        header,
      ),
  };
}
/**
 * Canonical変更文書の影響区画とPhase条件を検査する。
 * @responsibility Canonical変更文書の影響区画とPhase条件を検査する。
 * @input source: 生本文と位置。aggregateId: 列挙元のCHG ID。
 * @returns 既存順の中立Issue列。
 * @precondition 本文取得済みで、aggregateIdは列挙元のCHG-NNNNNNである。
 * @postcondition 影響見出し不一致だけは後続を打ち切り、不正Blockでは続行する。
 * @trace ARCH-000008
 * @effect N/A: 入力と局所値だけを扱う純粋な同期検査。
 * @failure 入力の実行時例外を伝播し、不正を成功へ補完しない。
 * @invariant 現行の生本文・正規表現・検査順と受理条件を維持する。
 * @boundary N/A: 取得済み変更文書のモデル検査。
 * @security 認可・採用・移行完了や品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function inspectChangeDocument(
  source: ArtifactSource,
  aggregateId: string,
): readonly DomainIssue[] {
  const change = source.content;
  const issues: DomainIssue[] = [];
  const impactHeadings = change.match(/^### 影響ファイル$/gmu) ?? [];
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
  const impactBlock = change.match(
    /^### 影響ファイル\r?\n\r?\n<details>\r?\n<summary>全ファイルを表示<\/summary>\r?\n([\s\S]*?)\r?\n<\/details>$/mu,
  )?.[1];
  const impactLines = impactBlock
    ?.split(/\r?\n/u)
    .filter((line) => line.trim().length > 0);
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
  if (/^### 主な反映ファイル$/mu.test(change)) {
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
    const convergenceBody =
      change.match(
        /^## 固定前の収束確認\s*$([\s\S]*?)(?=^##\s|(?![\s\S]))/mu,
      )?.[1] ?? "";
    const convergenceRows = convergenceBody
      .split(/\r?\n/u)
      .filter((line) => /^\| [^|-]/u.test(line))
      .slice(1)
      .map((line) =>
        line
          .split("|")
          .slice(1, -1)
          .map((cell) => cell.trim()),
      );
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
        (heading) => !change.split(/\r?\n/u).includes(heading),
      ) ||
      phasedChangeTableHeaders.some(
        (header) => !change.split(/\r?\n/u).includes(header),
      ) ||
      !change.includes("## 固定前の収束確認") ||
      isConvergenceEvaluationInvalid ||
      !/^\| Phase／Gate \| (?:`?Applicable`?|`?N\/A`?) \| \S.*\|$/mu.test(
        change,
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
 * @input changeTemplate: 取得済みの生ひな型本文。
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
export function isChangeTemplateInvalid(changeTemplate: string): boolean {
  return (
    !/^### 影響ファイル$/mu.test(changeTemplate) ||
    !/^<summary>全ファイルを表示<\/summary>$/mu.test(changeTemplate) ||
    /^### 主な反映ファイル$/mu.test(changeTemplate) ||
    !/^\| Phase／Gate適用判断 \|/mu.test(changeTemplate) ||
    !/^## Phase／Gateと途中拡張$/mu.test(changeTemplate) ||
    !/^### 適用判断$/mu.test(changeTemplate) ||
    !/^### PhaseとGate$/mu.test(changeTemplate) ||
    !/^### 途中拡張の記録$/mu.test(changeTemplate) ||
    !/^### 途中見直しの記録$/mu.test(changeTemplate) ||
    !/^## 固定前の収束確認$/mu.test(changeTemplate) ||
    !/^## 変更経路の計画$/mu.test(changeTemplate) ||
    !/^- 適用判定: `<Applicable／N\/A: 理由／OPEN: 理由・確認先・再評価契機>`$/mu.test(
      changeTemplate,
    ) ||
    /## 変更経路の計画（非自明な変更で該当する場合）/u.test(changeTemplate) ||
    !/^\| 評価対象 \| 判定 \| 理由 \|$/mu.test(changeTemplate) ||
    !/^\| 評価対象 \| 判定 \| 内容／理由 \| 参照／再評価契機 \|$/mu.test(
      changeTemplate,
    ) ||
    !/^\| Phase \| 目的 \| 変更範囲 \| 検証 \| Gate／通過条件 \| 状態 \|$/mu.test(
      changeTemplate,
    ) ||
    !/^\| Finding／契機 \| 同じIntentと判断した理由 \| 追加Phase／範囲 \| Gate・完了条件への影響 \| 追加確認／人間判断 \| 処置 \|$/mu.test(
      changeTemplate,
    ) ||
    !/^\| 契機 \| 崩れた前提／旧判断 \| 改訂後のPhase／Gate \| 再実行する検証 \| 不変範囲 \| 処置 \|$/mu.test(
      changeTemplate,
    )
  );
}
/**
 * 変更案内の指定区画と実在ID集合の不一致を判定する。
 * @responsibility 変更案内の指定区画と実在ID集合の不一致を判定する。
 * @input index: 生案内本文。aggregateIds: 実在確認済みのCHG ID列。
 * @returns 重複・不足・余剰があればtrue。
 * @precondition 呼出し元が列挙・実在確認と案内本文取得を完了している。
 * @postcondition 最初の指定コメント区画だけを参照し重複をSetへ隠さない。
 * @trace ARCH-000008
 * @effect N/A: 入力と局所値だけを扱う純粋な同期検査。
 * @failure 入力の実行時例外を伝播し、不正を成功へ補完しない。
 * @invariant 現行の生本文・正規表現・検査順と受理条件を維持する。
 * @boundary N/A: 取得済み変更文書のモデル検査。
 * @security 認可・採用・移行完了や品質全体の成立を発行しない。
 * @concurrency N/A: 呼出し間の共有可変状態を持たない。
 */
export function isChangeNavigationInvalid(
  index: string,
  aggregateIds: readonly string[],
): boolean {
  const aggregateIndex =
    index.match(
      /<!-- crdd-change-aggregate-index:start -->([\s\S]*?)<!-- crdd-change-aggregate-index:end -->/u,
    )?.[1] ?? "";
  const indexedIds = [
    ...aggregateIndex.matchAll(/\.\/Changes\/(CHG-[0-9]{6})\/change\.md/gu),
  ]
    .map((match) => match[1])
    .sort();
  const uniqueIndexedIds = new Set(indexedIds);

  return (
    indexedIds.length !== uniqueIndexedIds.size ||
    aggregateIds.length !== uniqueIndexedIds.size ||
    aggregateIds.some((id) => !uniqueIndexedIds.has(id))
  );
}

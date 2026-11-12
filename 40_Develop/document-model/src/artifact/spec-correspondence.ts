/**
 * UI／SPEC定義対応の根拠と固定改訂・閉包を検査する。
 * @responsibility 既読本文の共有Context・八観点根拠・改訂一致から中立Issueを生成する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import { parseMarkdownTableRow, isMarkdownTableSeparator } from "./markdown.ts";
/**
 * 正規のUI／SPEC対応表行を表す。
 * @responsibility 既存の正規行から取得した対象IDと未検査Cellを保持する。
 * @trace ARCH-000008
 * @shape uiId、specId、cells。
 * @invariant Cell数不足を補完せず、本文read後の検査へ渡す。
 * @boundary N/A: 対応表行の値モデル。
 * @security IDは対象参照であり認可や存在証明ではない。
 * @compatibility 既存の厳密なリンク行正規表現と単純Pipe分割を維持する。
 */
export type SpecCorrespondencePair = Readonly<{
  uiId: string;
  specId: string;
  cells: readonly string[];
}>;

/**
 * 対応根拠の最初の表を既存列条件で抽出する。
 * @responsibility 対応根拠の最初の表を既存列条件で抽出する。
 * @trace ARCH-000008
 * @input content: 可視本文。headers: 列名。
 * @returns 一致する連続表行。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 最初のHeaderと直後のSeparatorを要求し、列数が変われば打ち切る。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
const tableRows = (content: string, headers: readonly string[]): string[][] => {
  const lines = content.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => {
    const cells = parseMarkdownTableRow(line);
    return (
      cells !== null &&
      cells.length === headers.length &&
      cells.every((cell, index) => cell === headers[index])
    );
  });
  if (
    headerIndex < 0 ||
    !isMarkdownTableSeparator(lines[headerIndex + 1] ?? "", headers.length)
  )
    return [];
  const rows: string[][] = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = parseMarkdownTableRow(lines[index] as string);
    if (cells === null || cells.length !== headers.length) break;
    rows.push(cells);
  }
  return rows;
};

/**
 * 対応根拠の指定Sectionを抽出する。
 * @responsibility 対応根拠の指定Sectionを抽出する。
 * @trace ARCH-000008
 * @input source: 可視本文。heading: 期待見出し。
 * @returns 最初の一致から次の第二階層見出しまでの本文。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 既存の見出し境界と最初の一致を維持する。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
const sectionBody = (source: string, heading: string): string => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return (
    source.match(
      new RegExp(`^${escaped}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "mu"),
    )?.[1] ?? ""
  );
};

const EXPECTED_HEADER =
  "| UI | SPEC | Shared UX／IA Context | Coverage分類 | 確認した観点 | 結果 | Gap Owner／人間判断 | Evidence |";

const evidenceHeadings = {
  State: ["## 状態と表示差", "## 振る舞い・状態・結果"],
  Trigger: ["## 操作とFeedback", "## 契機・事前条件・Authority"],
  Result: ["## 操作とFeedback", "## 振る舞い・状態・結果"],
  Failure: ["## 操作とFeedback", "## 失敗・回復・副作用"],
  Recovery: ["## 状態と表示差", "## 失敗・回復・副作用"],
  Authority: ["## 制約", "## 契機・事前条件・Authority"],
  Visibility: ["## 表示面と情報の優先順位", "## 受入条件と検証義務"],
  Constraint: ["## 制約", "## 制約"],
} as const;
/**
 * 対応根拠の比較文字列を正規化する。
 * @responsibility 対応根拠の比較文字列を正規化する。
 * @trace ARCH-000008
 * @input value: 根拠または本文。
 * @returns NFKCと既存記号除去・小文字化した値。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 既存の除去文字集合を追加・削除しない。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
const normalizeEvidenceText = (value: string): string =>
  value
    .normalize("NFKC")
    .replace(/[\s`*_[\]()（）「」『』、。・／/:：;；,.!?！？→←|+-]/gu, "")
    .toLowerCase();
/**
 * 根拠が対象Sectionの四文字連続部分を含むか確認する。
 * @responsibility 根拠が対象Sectionの四文字連続部分を含むか確認する。
 * @trace ARCH-000008
 * @input fact: 根拠記述。sourceSection: 対象Section。
 * @returns 既存の部分一致があればtrue。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 正規化後の最低四文字条件と任意位置の連続一致を維持する。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
const hasSourcePhrase = (fact: string, sourceSection: string): boolean => {
  const normalizedFact = normalizeEvidenceText(fact);
  const normalizedSource = normalizeEvidenceText(sourceSection);
  if (normalizedFact.length < 4 || normalizedSource.length < 4) return false;
  const width = Math.min(4, normalizedFact.length);
  for (let index = 0; index <= normalizedFact.length - width; index += 1)
    if (normalizedSource.includes(normalizedFact.slice(index, index + width)))
      return true;
  return false;
};

/**
 * 対応表の対象改訂値からDefinition集合Fingerprintを解析する。
 * @responsibility 対応表の対象改訂値からDefinition集合Fingerprintを解析する。
 * @trace ARCH-000008
 * @input correspondence: 可視化済み対応表本文。
 * @returns 記録されたSHA-256、またはundefined。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 対象改訂版表の最初の一致と小文字hex64桁条件を維持する。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseSpecCorrespondenceRevision(
  correspondence: string,
): string | undefined {
  const targetRevision =
    tableRows(correspondence, ["項目", "対象"]).find(
      ([item]) => item === "対象改訂版",
    )?.[1] ?? "";
  const recordedDefinitionFingerprint = targetRevision.match(
    /UI／SPEC Definition集合 SHA-256: ([0-9a-f]{64})/u,
  )?.[1];

  return recordedDefinitionFingerprint;
}
/**
 * 正規対応行からUI／SPEC参照と未検査Cellを解析する。
 * @responsibility 正規対応行からUI／SPEC参照と未検査Cellを解析する。
 * @trace ARCH-000008
 * @input line: 対応表の一行。
 * @returns 正規行の値モデル、またはnull。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 一般表へ受理を広げず、Cell不足もここでは拒否しない。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseSpecCorrespondencePair(
  line: string,
): SpecCorrespondencePair | null {
  const row = line.match(
    /^\| \[(UI-[0-9]{6})\]\(\.\.\/04_UI\/Definitions\/\1\/ui_definition\.md\) \| \[(SPEC-[0-9]{6})\]\(Definitions\/\2\/spec_definition\.md\) \|/u,
  );

  if (!row) return null;
  const cells = line
    .split("|")
    .slice(1, -1)
    .map((cell) => cell.trim());

  return { uiId: row[1] as string, specId: row[2] as string, cells };
}
/**
 * 一つの定義対応について共有Contextと八観点根拠を検査する。
 * @responsibility 一つの定義対応について共有Contextと八観点根拠を検査する。
 * @trace ARCH-000008
 * @input pair: 正規対応行。correspondence: 可視対応表。uiSource、specSource: 既読可視定義本文。
 * @returns 不整合flagと実際に評価した理由出現列。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 八行・八観点条件とevery短絡を維持し、未訪問の理由を加えない。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectSpecCorrespondencePairEvidence(
  pair: SpecCorrespondencePair,
  correspondence: string,
  uiSource: string,
  specSource: string,
): Readonly<{ invalid: boolean; reasons: readonly string[] }> {
  const cells = pair.cells;
  const expectedShared = new Set<string>();
  const correspondenceReasons: string[] = [];
  let isEvidenceInvalid = false;
  const uiFormal = sectionBody(uiSource, "## 正式入力と変換根拠");
  const specFormal = sectionBody(specSource, "## 正式入力と変換根拠");
  const uiContext = new Set(uiFormal.match(/(?:UX|IA)-[0-9]{6}/gu) ?? []);
  const specContext = new Set(specFormal.match(/(?:UX|IA)-[0-9]{6}/gu) ?? []);
  for (const id of uiContext) if (specContext.has(id)) expectedShared.add(id);
  const recordedShared = new Set(
    (cells[2] as string).match(/(?:UX|IA)-[0-9]{6}/gu) ?? [],
  );
  const evidenceAnchor = `#${pair.uiId.toLowerCase()}${pair.specId.toLowerCase()}`;
  const evidenceSection = sectionBody(
    correspondence,
    `### ${pair.uiId}／${pair.specId}`,
  );
  const evidenceRows = tableRows(evidenceSection, [
    "観点",
    "UI側の根拠",
    "SPEC側の根拠",
    "判定",
    "理由",
  ]);
  const expectedLenses = new Set([
    "State",
    "Trigger",
    "Result",
    "Failure",
    "Recovery",
    "Authority",
    "Visibility",
    "Constraint",
  ]);
  const isEvidenceValid =
    evidenceRows.length === 8 &&
    new Set(evidenceRows.map(([lens]) => lens)).size === 8 &&
    evidenceRows.every((values) => {
      const [lens, uiEvidence, specEvidence, result, reason] = values as [
        string,
        string,
        string,
        string,
        string,
      ];
      correspondenceReasons.push(reason);
      const concreteReason = reason.match(
        /^UI事実（(UI-[0-9]{6})）「(.+)」／SPEC事実（(SPEC-[0-9]{6})）「(.+)」／対応: (.+)$/u,
      );
      const headings = evidenceHeadings[lens as keyof typeof evidenceHeadings];
      const uiFact = concreteReason?.[2] ?? "";
      const specFact = concreteReason?.[4] ?? "";
      const uiTitle =
        uiSource.match(/^#\s+UI-[0-9]{6}\s+(.+)$/mu)?.[1]?.trim() ?? "";
      const specTitle =
        specSource.match(/^#\s+SPEC-[0-9]{6}\s+(.+)$/mu)?.[1]?.trim() ?? "";
      const hasInvalidFactSyntax =
        /…|\[[^\]]*\]|^(?:上記|同上|題名|見出し)$/u.test(uiFact) ||
        /…|\[[^\]]*\]|^(?:上記|同上|題名|見出し)$/u.test(specFact);
      return (
        expectedLenses.has(lens) &&
        uiEvidence.includes(pair.uiId) &&
        uiEvidence.includes("#") &&
        specEvidence.includes(pair.specId) &&
        specEvidence.includes("#") &&
        /^(?:一致|N\/A)$/u.test(result) &&
        concreteReason?.[1] === pair.uiId &&
        concreteReason?.[3] === pair.specId &&
        uiFact.trim().length >= 4 &&
        specFact.trim().length >= 4 &&
        (concreteReason?.[5]?.trim().length ?? 0) >= 4 &&
        !hasInvalidFactSyntax &&
        normalizeEvidenceText(uiFact) !== normalizeEvidenceText(uiTitle) &&
        normalizeEvidenceText(specFact) !== normalizeEvidenceText(specTitle) &&
        headings !== undefined &&
        hasSourcePhrase(uiFact, sectionBody(uiSource, headings[0])) &&
        hasSourcePhrase(specFact, sectionBody(specSource, headings[1])) &&
        !/^(?:表示状態と振る舞い状態|操作と発火条件|結果を利用者|失敗理由を正常状態|回復要否と次の行動|操作可能性とEffect権限|開示・不足・観測不能|片側で共通制約)/u.test(
          reason,
        )
      );
    });
  if (
    cells.length !== 8 ||
    cells.some((cell) => cell.length === 0) ||
    cells[3] !== "Shared" ||
    !(cells[4] as string).includes("8観点") ||
    !/^(?:作成者確認済み|Gap|N\/A)$/u.test(cells[5] as string) ||
    !(cells[7] as string).includes(evidenceAnchor) ||
    expectedShared.size !== recordedShared.size ||
    [...expectedShared].some((id) => !recordedShared.has(id)) ||
    !isEvidenceValid
  )
    isEvidenceInvalid = true;
  return { invalid: isEvidenceInvalid, reasons: correspondenceReasons };
}
/**
 * 対応表全体の閉包・根拠・固定改訂を検査する。
 * @responsibility 対応表全体の閉包・根拠・固定改訂を検査する。
 * @trace ARCH-000008
 * @input request: 可視本文、対応出現列、訪問理由列、期待集合、行不整合flag、記録／実測Fingerprint。
 * @returns 閉包→根拠→改訂の既存順による中立Issue。
 * @precondition 対象本文は呼出し元が取得済みで、指定した本文は可視化済み。
 * @postcondition 入力を変更せず既存の出現順と短絡条件を維持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、不足する本文やCellを補完しない。
 * @invariant 理由件数は期待関係数の八倍で比較し、重複と改訂不一致を別Issueにする。
 * @boundary N/A: 同一Process内の定義対応根拠検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectSpecCorrespondence(
  request: Readonly<{
    artifact: ArtifactSource;
    pairs: readonly string[];
    reasons: readonly string[];
    expectedPairs: ReadonlySet<string>;
    hasInvalidPairEvidence: boolean;
    recordedFingerprint: string | undefined;
    actualFingerprint: string;
  }>,
): DomainIssue[] {
  const correspondence = request.artifact.content;
  const correspondencePairs = request.pairs;
  const correspondenceReasons = request.reasons;
  const registryUiPairs = request.expectedPairs;
  const recordedDefinitionFingerprint = request.recordedFingerprint;
  const actualDefinitionFingerprint = request.actualFingerprint;
  const isCorrespondenceRevisionInvalid =
    recordedDefinitionFingerprint === undefined ||
    recordedDefinitionFingerprint !== actualDefinitionFingerprint;
  let isCorrespondenceEvidenceInvalid =
    request.hasInvalidPairEvidence ||
    !correspondence.includes("## 1. レビュー対象") ||
    !correspondence.includes(EXPECTED_HEADER);
  const issues: DomainIssue[] = [];
  if (
    correspondenceReasons.length !== registryUiPairs.size * 8 ||
    new Set(correspondenceReasons).size !== correspondenceReasons.length
  )
    isCorrespondenceEvidenceInvalid = true;
  const correspondenceSet = new Set(correspondencePairs);
  if (
    correspondencePairs.length !== correspondenceSet.size ||
    [...registryUiPairs].some((pair) => !correspondenceSet.has(pair)) ||
    [...correspondenceSet].some((pair) => !registryUiPairs.has(pair))
  )
    issues.push({
      kind: "artifact.spec.correspondence-closure-mismatch",
      targetIdentity: request.artifact.path,
      location: { path: request.artifact.path },
      reason: "correspondence-closure-mismatch",
      details: {},
    });
  if (isCorrespondenceEvidenceInvalid)
    issues.push({
      kind: "artifact.spec.correspondence-evidence-invalid",
      targetIdentity: request.artifact.path,
      location: { path: request.artifact.path },
      reason: "correspondence-evidence-invalid",
      details: {},
    });
  if (isCorrespondenceRevisionInvalid)
    issues.push({
      kind: "artifact.spec.correspondence-revision-invalid",
      targetIdentity: request.artifact.path,
      location: { path: request.artifact.path },
      reason: "correspondence-revision-invalid",
      details: {
        recorded: recordedDefinitionFingerprint ?? null,
        actual: actualDefinitionFingerprint,
      },
    });
  return issues;
}

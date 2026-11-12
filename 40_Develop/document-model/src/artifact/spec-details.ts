/**
 * UI／SPEC Detailの対応と下流照合に用いる本文モデルを解析する。
 * @responsibility 既読本文のID対応・Relation出現列を保持する。
 * @trace ARCH-000008
 */
import {
  omitMarkdownCommentsAndFencedCode,
  parseMarkdownTableRow,
} from "./markdown.ts";
import type { ArtifactSource } from "./types.ts";
import type { DomainIssue } from "../outcome.ts";

/**
 * UI Detailの画面・Part対応を解析する。
 * @responsibility UI Definitionごとの最後の有効行を対応先とする。
 * @trace ARCH-000008
 * @input content: 取得済みUI Detail本文。
 * @returns UI IDからSCR／PRTへの対応。
 * @precondition 対象本文は呼出し元が取得済み。
 * @postcondition 同じUIの後続有効行で上書きし、入力を変更しない。
 * @effect N/A: 局所値だけを扱う同期解析。
 * @failure 解析例外は呼出し元へ伝播する。
 * @invariant 第1列の完全UI IDと第5列の最初のSCR／PRTだけを採用する。
 * @boundary N/A: 同一Process内の本文解析。
 * @security 実在・認可・品質成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseUiDetailBindings(
  content: string,
): Map<string, Readonly<{ scr: string; prt: string }>> {
  const bindings = new Map<string, Readonly<{ scr: string; prt: string }>>();
  for (const line of omitMarkdownCommentsAndFencedCode(content).split(
    /\r?\n/u,
  )) {
    const cells = parseMarkdownTableRow(line);
    const ui = cells?.[0]?.match(/^UI-[0-9]{6}$/u)?.[0];
    const scr = cells?.[4]?.match(/SCR-[0-9]{6}/u)?.[0];
    const prt = cells?.[4]?.match(/PRT-[0-9]{6}/u)?.[0];
    if (ui && scr && prt) bindings.set(ui, { scr, prt });
  }
  return bindings;
}

/**
 * Screen本文からUI／SPEC Detail関係の出現列を解析する。
 * @responsibility Screenの対象UIと行内の最初のRelation／BHVを対応付ける。
 * @trace ARCH-000008
 * @input content: 取得済みScreen本文。screenId: 列挙したScreen Directory名。
 * @returns Relation・BHV・UI・SPEC・SCRの順序付きtuple列。
 * @precondition 本文とDirectory名は呼出し元が取得済み。
 * @postcondition 出現順と重複を保持し、対象UI不在なら空列を返す。
 * @effect N/A: 局所値だけを扱う同期解析。
 * @failure 解析例外は呼出し元へ伝播する。
 * @invariant SCRは本文から補完せず、SPECはRelation末尾から導出する。
 * @boundary N/A: 同一Process内の本文解析。
 * @security 実在・認可・品質成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseSpecScreenRelations(
  content: string,
  screenId: string,
): string[] {
  const source = omitMarkdownCommentsAndFencedCode(content);
  const sourceUi = source.match(/対象UI Definition:\s*\[?(UI-[0-9]{6})/u)?.[1];
  if (!sourceUi) return [];
  const relations: string[] = [];
  for (const line of source.split(/\r?\n/u)) {
    const cells = parseMarkdownTableRow(line);
    if (!cells) continue;
    const relationKey = cells[0]?.match(/PRT-[0-9]{6}\.spec-[0-9]{6}/u)?.[0];
    const bhv = cells[4]?.match(/BHV-[0-9]{6}/u)?.[0];
    if (!relationKey || !bhv) continue;
    relations.push(
      `${relationKey}|${bhv}|${sourceUi}|SPEC-${relationKey.slice(-6)}|${screenId}`,
    );
  }
  return relations;
}

/**
 * Detail対応表から関係の出現列を解析する。
 * @responsibility 固定列から最初のSCR・Relation・BHV・UI・SPECを抽出する。
 * @trace ARCH-000008
 * @input content: コメントとCodeを除去済みのDetail対応表本文。
 * @returns Relation・BHV・UI・SPEC・SCRの順序付きtuple列。
 * @precondition 対象本文は呼出し元が取得済み。
 * @postcondition 完全な対応行だけを出現順・重複保持で返す。
 * @effect N/A: 局所値だけを扱う同期解析。
 * @failure 解析例外は呼出し元へ伝播する。
 * @invariant 第1列にSCRとRelation、第2〜4列にBHV・UI・SPECを要求する。
 * @boundary N/A: 同一Process内の本文解析。
 * @security 実在・認可・品質成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
function parseSpecDetailCorrespondence(content: string): string[] {
  const relations: string[] = [];
  for (const line of content.split(/\r?\n/u)) {
    const cells = parseMarkdownTableRow(line);
    if (!cells) continue;
    const scr = cells[0]?.match(/SCR-[0-9]{6}/u)?.[0];
    const relationKey = cells[0]?.match(/PRT-[0-9]{6}\.spec-[0-9]{6}/u)?.[0];
    const bhv = cells[1]?.match(/BHV-[0-9]{6}/u)?.[0];
    const ui = cells[2]?.match(/UI-[0-9]{6}/u)?.[0];
    const spec = cells[3]?.match(/SPEC-[0-9]{6}/u)?.[0];
    if (scr && relationKey && bhv && ui && spec)
      relations.push(`${relationKey}|${bhv}|${ui}|${spec}|${scr}`);
  }
  return relations;
}

/**
 * SPEC Detailの定義被覆とBHV対応を検査する。
 * @responsibility 不正な表でも抽出可能なBHV対応を保持して中立Issueを返す。
 * @trace ARCH-000008
 * @input artifact: 生本文と位置。definitionIds: 現在のSPEC定義集合。
 * @returns 後勝ちのBHV対応と被覆Issue。
 * @precondition 本文と定義集合は呼出し元が取得済み。
 * @postcondition 表行の重複と集合の欠落を区別し入力を変更しない。
 * @effect N/A: 局所値だけを扱う同期解析。
 * @failure 解析例外は呼出し元へ伝播する。
 * @invariant 行検査より先にBHVを抽出し、既存の短絡条件順を維持する。
 * @boundary N/A: 同一Process内の本文解析。
 * @security 実在・認可・品質成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectSpecDetailIndex(
  artifact: ArtifactSource,
  definitionIds: ReadonlySet<string>,
): { behaviors: Map<string, string>; issues: DomainIssue[] } {
  const source = omitMarkdownCommentsAndFencedCode(artifact.content);
  const rows = source
    .split(/\r?\n/u)
    .map((line) => parseMarkdownTableRow(line))
    .filter((cells): cells is string[] =>
      Boolean(cells?.[0]?.match(/^SPEC-[0-9]{6}$/u)),
    );
  const ids = rows.map((cells) => cells[0] as string);
  const behaviorIds = new Set<string>();
  const behaviors = new Map<string, string>();
  for (const cells of rows) {
    const behaviorId = cells[3]?.match(/BHV-[0-9]{6}/u)?.[0];
    if (behaviorId) behaviorIds.add(behaviorId);
    if (behaviorId) behaviors.set(cells[0] as string, behaviorId);
  }
  const issues: DomainIssue[] = [];
  if (
    rows.some(
      (cells) =>
        cells.length !== 5 ||
        cells[2] !== "Applicable／Covered" ||
        !/BHV-[0-9]{6}/u.test(cells[3] as string) ||
        (cells[4] as string).trim().length === 0,
    ) ||
    ids.length !== new Set(ids).size ||
    ids.length !== definitionIds.size ||
    ids.some((id) => !definitionIds.has(id)) ||
    [...definitionIds].some((id) => !ids.includes(id)) ||
    behaviorIds.size !== definitionIds.size ||
    !source.includes("状態: Canonical")
  ) {
    issues.push({
      kind: "artifact.spec.detail-current-coverage-invalid",
      targetIdentity: artifact.path,
      location: { path: artifact.path },
      reason: "detail-current-coverage-invalid",
      details: {},
    });
  }
  return { behaviors, issues };
}

/**
 * Detail対応表とScreen関係の双方向被覆を検査する。
 * @responsibility 状態文言・出現重複・集合一致とDefinition対応数を照合する。
 * @trace ARCH-000008
 * @input artifact: 可視本文と位置。expectedTuples: 期待関係。screenRelations: Screen出現列。definitionPairCount: 重複除去したDefinition対応数。
 * @returns 既存の対応状態条件を満たさない場合の中立Issue。
 * @precondition 本文のコメントとCodeは除去済みで、対象集合は呼出し元が取得済み。
 * @postcondition 同数の誤差し替えを拒否し、入力と出現列を変更しない。
 * @effect N/A: 局所値だけを扱う同期解析。
 * @failure 解析例外は呼出し元へ伝播する。
 * @invariant 状態文言と両方向被覆、重複と件数条件を維持する。
 * @boundary N/A: 同一Process内の本文解析。
 * @security 実在・認可・品質成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectSpecDetailCorrespondence(
  artifact: ArtifactSource,
  expectedTuples: ReadonlySet<string>,
  screenRelations: readonly string[],
  definitionPairCount: number,
): DomainIssue[] {
  const screenSet = new Set(screenRelations);
  const hasScreenRelationMismatch =
    screenRelations.length !== screenSet.size ||
    screenSet.size !== expectedTuples.size ||
    [...screenSet].some((tuple) => !expectedTuples.has(tuple)) ||
    [...expectedTuples].some((tuple) => !screenSet.has(tuple));
  const rows = parseSpecDetailCorrespondence(artifact.content);
  const tuples = new Set(rows);
  if (
    !artifact.content.includes("状態: Pass") ||
    !artifact.content.includes("Definition対応とDetail対応を分けた") ||
    !artifact.content.includes("UIからBHVへのCoverageを全件評価した") ||
    !artifact.content.includes("BHVからUIへのCoverageを全件評価した") ||
    hasScreenRelationMismatch ||
    rows.length !== tuples.size ||
    tuples.size !== expectedTuples.size ||
    [...tuples].some((tuple) => !expectedTuples.has(tuple)) ||
    [...expectedTuples].some((tuple) => !tuples.has(tuple)) ||
    expectedTuples.size !== definitionPairCount
  ) {
    return [
      {
        kind: "artifact.spec.detail-correspondence-state-invalid",
        targetIdentity: artifact.path,
        location: { path: artifact.path },
        reason: "detail-correspondence-state-invalid",
        details: {},
      },
    ];
  }
  return [];
}

/**
 * ARCH／QA定義のDetail所有関係を表す。
 * @responsibility UI・SPEC所有集合と担当Relationの出現を下流検査へ渡す。
 * @trace ARCH-000008
 * @shape uiIds、specIds、relations、hasDuplicateRelations。
 * @invariant 定義IDは集合化するが、Relationは別行重複も含む出現列を保持する。
 * @boundary N/A: 取得済み可視本文の値モデル。
 * @security 所有者の実在や認可を発行しない。
 * @compatibility 列内の最初のID・厳密な担当行頭という既存条件を維持する。
 */
export type SpecDetailDefinitionOwnership = Readonly<{
  uiIds: ReadonlySet<string>;
  specIds: ReadonlySet<string>;
  relations: readonly string[];
  hasDuplicateRelations: boolean;
}>;
/**
 * Architecture領域の所属とDetail所有関係を表す。
 * @responsibility 最初のTraceability参照行による所属と全担当Relationを渡す。
 * @trace ARCH-000008
 * @shape architectureIds、relations、hasDuplicateRelations。
 * @invariant 所属ARCHは集合、Relationは出現列、重複flagは行内判定を表す。
 * @boundary N/A: 取得済み可視本文の値モデル。
 * @security 領域や所有者の実在・認可を発行しない。
 * @compatibility 後続の参照行から所属を補完せず、既存抽出条件を維持する。
 */
export type SpecDetailAreaOwnership = Readonly<{
  architectureIds: ReadonlySet<string>;
  relations: readonly string[];
  hasDuplicateRelations: boolean;
}>;
/**
 * 中央Traceの後勝ち対応と元の出現情報を表す。
 * @responsibility ARCH／QAのRelation対応と重複を別々の根拠で下流へ渡す。
 * @trace ARCH-000008
 * @shape architectureRelations、qualityRelations、architectureRows、qualityRows、hasDuplicateRelations。
 * @invariant Mapは後勝ちだが元の行数・Owner／Area重複を失わず、空Areaも保持する。
 * @boundary N/A: 取得済み中央表の値モデル。
 * @security 全体品質やOwnerの認可を発行しない。
 * @compatibility ARCH六列／QA五列の既存条件を維持する。
 */
export type SpecDetailCentralTrace = Readonly<{
  architectureRelations: ReadonlyMap<
    string,
    Readonly<{
      bhv: string;
      owners: ReadonlySet<string>;
      mode: string;
      areas: ReadonlySet<string>;
    }>
  >;
  qualityRelations: ReadonlyMap<
    string,
    Readonly<{ bhv: string; owners: ReadonlySet<string>; mode: string }>
  >;
  architectureRows: number;
  qualityRows: number;
  hasDuplicateRelations: boolean;
}>;
/**
 * 観測済みDetail関係・定義・領域・件数の下流被覆検査入力を表す。
 * @responsibility 既読モデルと観測済み値を純粋な被覆検査へ渡す。
 * @trace ARCH-000008
 * @shape path、relations、architectureDefinitions、qualityDefinitions、areas、central、issued、quality、combined本文、定義件数。
 * @invariant Owner／Area名は列挙Directory名であり、未観測値を空値で補完しない。
 * @boundary N/A: 観測Ownerから意味検査への値搬送。
 * @security Reader・Filesystem操作・認可・実行Authorityを含まない。
 * @compatibility combined本文includesとQA側のIDサイズ比較、UI Directory件数を維持する。
 */
export type SpecDetailDownstreamRequest = Readonly<{
  path: string;
  relations: ReadonlyMap<
    string,
    Readonly<{ bhv: string; ui: string; spec: string; scr: string }>
  >;
  architectureDefinitions: readonly Readonly<{
    owner: string;
    ownership: SpecDetailDefinitionOwnership;
  }>[];
  qualityDefinitions: readonly Readonly<{
    owner: string;
    ownership: SpecDetailDefinitionOwnership;
  }>[];
  areas: readonly Readonly<{
    area: string;
    ownership: SpecDetailAreaOwnership;
  }>[];
  central: SpecDetailCentralTrace;
  issued: Readonly<{
    screens: ReadonlySet<string>;
    parts: ReadonlySet<string>;
    behaviors: ReadonlySet<string>;
  }>;
  quality: Readonly<{
    screens: ReadonlySet<string>;
    parts: ReadonlySet<string>;
    behaviors: ReadonlySet<string>;
  }>;
  architectureDefinitionsCombined: string;
  qualityDefinitionsCombined: string;
  uiDefinitionCount: number;
  specDefinitionCount: number;
}>;
/**
 * ARCH／QA定義のUI・SPEC所有と担当Relation出現を解析する。
 * @responsibility ARCH／QA定義のUI・SPEC所有と担当Relation出現を解析する。
 * @trace ARCH-000008
 * @input content: 可視化済み定義本文。
 * @returns 定義所有集合・Relation出現列・行内重複。
 * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
 * @postcondition 入力を変更せず、既存の出現順・集合条件を保持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
 * @invariant 第1列のSCR／BHVと第2列の最初のUI／SPECだけを関連付ける。
 * @boundary N/A: 同一Process内のDetail意味モデル。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseSpecDetailDefinitionOwnership(
  content: string,
): SpecDetailDefinitionOwnership {
  const uiIds = new Set<string>();
  const specIds = new Set<string>();
  const relations: string[] = [];
  let hasDuplicateRelations = false;
  for (const line of content.split(/\r?\n/u)) {
    const cells = parseMarkdownTableRow(line);
    if (cells) {
      const ui = cells[1]?.match(/UI-[0-9]{6}/u)?.[0];
      const spec = cells[1]?.match(/SPEC-[0-9]{6}/u)?.[0];
      if (ui && /SCR-[0-9]{6}/u.test(cells[0] ?? "")) uiIds.add(ui);
      if (spec && /BHV-[0-9]{6}/u.test(cells[0] ?? "")) specIds.add(spec);
    }
    if (!line.startsWith("担当Interaction Relation:")) continue;
    const keys = [...line.matchAll(/PRT-[0-9]{6}\.spec-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    relations.push(...keys);
    if (keys.length !== new Set(keys).size) hasDuplicateRelations = true;
  }
  return { uiIds, specIds, relations, hasDuplicateRelations };
}
/**
 * Architecture領域の所属と担当Relation出現を解析する。
 * @responsibility Architecture領域の所属と担当Relation出現を解析する。
 * @trace ARCH-000008
 * @input content: 可視化済み領域本文。
 * @returns 所属ARCH集合・Relation出現列・行内重複。
 * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
 * @postcondition 入力を変更せず、既存の出現順・集合条件を保持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
 * @invariant Traceabilityリンク名を含む最初の行だけを所属根拠とする。
 * @boundary N/A: 同一Process内のDetail意味モデル。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseSpecDetailAreaOwnership(
  content: string,
): SpecDetailAreaOwnership {
  const ownerLine = content
    .split(/\r?\n/u)
    .find((line) =>
      line.includes("[UI／SPEC Detail Architecture Traceability]"),
    );
  const architectureIds = new Set(
    [...(ownerLine ?? "").matchAll(/ARCH-[0-9]{6}/gu)].map((match) => match[0]),
  );
  const relations: string[] = [];
  let hasDuplicateRelations = false;
  for (const line of content.split(/\r?\n/u)) {
    if (!line.startsWith("担当Interaction Relation:")) continue;
    const keys = [...line.matchAll(/PRT-[0-9]{6}\.spec-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    relations.push(...keys);
    if (keys.length !== new Set(keys).size) hasDuplicateRelations = true;
  }
  return { architectureIds, relations, hasDuplicateRelations };
}
/**
 * Architecture／Quality中央Traceの後勝ち対応を解析する。
 * @responsibility Architecture／Quality中央Traceの後勝ち対応を解析する。
 * @trace ARCH-000008
 * @input architectureDetailTrace、qualityDetailAnalysis: 可視化済み中央本文。
 * @returns 後勝ちMap・元行数・重複判定。
 * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
 * @postcondition 入力を変更せず、既存の出現順・集合条件を保持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
 * @invariant ARCH六列／QA五列を要求し、Areaの空文字を除去しない。
 * @boundary N/A: 同一Process内のDetail意味モデル。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseSpecDetailCentralTrace(
  architectureDetailTrace: string,
  qualityDetailAnalysis: string,
): SpecDetailCentralTrace {
  const architectureCentralRelations = new Map<
    string,
    Readonly<{
      bhv: string;
      owners: Set<string>;
      mode: string;
      areas: Set<string>;
    }>
  >();
  let architectureCentralRelationRows = 0;
  let qualityCentralRelationRows = 0;
  let hasDuplicateCentralRelation = false;
  for (const line of architectureDetailTrace.split(/\r?\n/u)) {
    const cells = parseMarkdownTableRow(line);
    const relationKey = cells?.[0]?.match(/PRT-[0-9]{6}\.spec-[0-9]{6}/u)?.[0];
    const bhv = cells?.[1]?.match(/BHV-[0-9]{6}/u)?.[0];
    if (!cells || !relationKey || !bhv || cells.length !== 6) continue;
    architectureCentralRelationRows += 1;
    const ownerRows = [...(cells[2] as string).matchAll(/ARCH-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    const areaRows = (cells[4] as string)
      .split("、")
      .map((item) => item.trim());
    if (
      architectureCentralRelations.has(relationKey) ||
      ownerRows.length !== new Set(ownerRows).size ||
      areaRows.length !== new Set(areaRows).size
    )
      hasDuplicateCentralRelation = true;
    architectureCentralRelations.set(relationKey, {
      bhv,
      owners: new Set(ownerRows),
      mode: cells[3] as string,
      areas: new Set(areaRows),
    });
  }
  const qualityCentralRelations = new Map<
    string,
    Readonly<{ bhv: string; owners: Set<string>; mode: string }>
  >();
  for (const line of qualityDetailAnalysis.split(/\r?\n/u)) {
    const cells = parseMarkdownTableRow(line);
    const relationKey = cells?.[0]?.match(/PRT-[0-9]{6}\.spec-[0-9]{6}/u)?.[0];
    const bhv = cells?.[1]?.match(/BHV-[0-9]{6}/u)?.[0];
    if (!cells || !relationKey || !bhv || cells.length !== 5) continue;
    qualityCentralRelationRows += 1;
    const ownerRows = [...(cells[2] as string).matchAll(/QA-[0-9]{6}/gu)].map(
      (match) => match[0],
    );
    if (
      qualityCentralRelations.has(relationKey) ||
      ownerRows.length !== new Set(ownerRows).size
    )
      hasDuplicateCentralRelation = true;
    qualityCentralRelations.set(relationKey, {
      bhv,
      owners: new Set(ownerRows),
      mode: cells[3] as string,
    });
  }

  return {
    architectureRelations: architectureCentralRelations,
    qualityRelations: qualityCentralRelations,
    architectureRows: architectureCentralRelationRows,
    qualityRows: qualityCentralRelationRows,
    hasDuplicateRelations: hasDuplicateCentralRelation,
  };
}
/**
 * UI／SPEC Detailの下流Owner・領域・中央関係と被覆を検査する。
 * @responsibility UI／SPEC Detailの下流Owner・領域・中央関係と被覆を検査する。
 * @trace ARCH-000008
 * @input request: 解析済み関係、所有者、領域、中央表、観測済み本文と件数。
 * @returns 従来の下流被覆条件を満たさない場合の中立Issue。
 * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
 * @postcondition 入力を変更せず、既存の出現順・集合条件を保持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
 * @invariant Single／Shared／Joint、別行重複、Areaの各Owner被覆と既存の件数／includes条件を維持する。
 * @boundary N/A: 同一Process内のDetail意味モデル。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectSpecDetailDownstream(
  request: SpecDetailDownstreamRequest,
): DomainIssue[] {
  const expectedDetailRelations = request.relations;
  const architectureCentralRelations = request.central.architectureRelations;
  const qualityCentralRelations = request.central.qualityRelations;
  const architectureCentralRelationRows = request.central.architectureRows;
  const qualityCentralRelationRows = request.central.qualityRows;
  const hasDuplicateCentralRelation = request.central.hasDuplicateRelations;
  const issuedScreenIds = request.issued.screens;
  const issuedPartIds = request.issued.parts;
  const issuedBehaviorIds = request.issued.behaviors;
  const qualityScreenIds = request.quality.screens;
  const qualityPartIds = request.quality.parts;
  const qualityBehaviorIds = request.quality.behaviors;
  const architectureDefinitionsCombined =
    request.architectureDefinitionsCombined;
  const qualityDefinitionsCombined = request.qualityDefinitionsCombined;
  const currentUiDefinitionCount = request.uiDefinitionCount;
  /**
   * 二つのOwner集合が完全一致するか確認する。
   * @responsibility 二つのOwner集合が完全一致するか確認する。
   * @trace ARCH-000008
   * @input left、right: 比較する集合。
   * @returns 要素数と要素がすべて一致する場合true。
   * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
   * @postcondition 入力を変更せず、既存の出現順・集合条件を保持する。
   * @effect N/A: 取得済み値だけを扱う同期処理。
   * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
   * @invariant 要素数だけで一致を推定しない。
   * @boundary N/A: 同一Process内のDetail意味モデル。
   * @security 実在・認可・品質全体の成立を発行しない。
   * @concurrency N/A: 共有可変状態を持たない。
   */
  const sameSet = (
    left: ReadonlySet<string>,
    right: ReadonlySet<string>,
  ): boolean =>
    left.size === right.size && [...left].every((item) => right.has(item));
  /**
   * Relationまたは定義とOwnerを局所集合へ追加する。
   * @responsibility Relationまたは定義とOwnerを局所集合へ追加する。
   * @trace ARCH-000008
   * @input target: 局所Map。key: 対象ID。owner: 列挙されたOwner名。
   * @returns なし。
   * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
   * @postcondition 指定した局所Mapの対象集合へOwnerを追加する。同じOwnerはSetで重複除去する。
   * @effect 呼出し元が所有する局所Map／Setを更新し、外部Effectはない。
   * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
   * @invariant 同じOwnerの重複はSetへ畳み、出現数は別途保持する。
   * @boundary N/A: 同一Process内のDetail意味モデル。
   * @security 実在・認可・品質全体の成立を発行しない。
   * @concurrency N/A: 共有可変状態を持たない。
   */
  const addOwner = (
    target: Map<string, Set<string>>,
    key: string,
    owner: string,
  ): void => {
    const owners = target.get(key) ?? new Set<string>();
    owners.add(owner);
    target.set(key, owners);
  };
  const architectureUiOwners = new Map<string, Set<string>>();
  const architectureSpecOwners = new Map<string, Set<string>>();
  const architectureRelationOwners = new Map<string, Set<string>>();
  const architectureAreaOwners = new Map<string, Set<string>>();
  const qualityUiOwners = new Map<string, Set<string>>();
  const qualitySpecOwners = new Map<string, Set<string>>();
  const qualityRelationOwners = new Map<string, Set<string>>();
  const areasByArchitecture = new Map<string, Set<string>>();
  let architectureRelationAssignmentRows = 0;
  let architectureAreaAssignmentRows = 0;
  let qualityRelationAssignmentRows = 0;
  let hasDuplicateRelationAssignment = false;
  for (const { owner, ownership } of request.architectureDefinitions) {
    for (const ui of ownership.uiIds) addOwner(architectureUiOwners, ui, owner);
    for (const spec of ownership.specIds)
      addOwner(architectureSpecOwners, spec, owner);
    for (const key of ownership.relations)
      addOwner(architectureRelationOwners, key, owner);
    architectureRelationAssignmentRows += ownership.relations.length;
    if (ownership.hasDuplicateRelations) hasDuplicateRelationAssignment = true;
  }
  for (const { area, ownership } of request.areas) {
    for (const owner of ownership.architectureIds)
      addOwner(areasByArchitecture, owner, area);
    for (const key of ownership.relations)
      addOwner(architectureAreaOwners, key, area);
    architectureAreaAssignmentRows += ownership.relations.length;
    if (ownership.hasDuplicateRelations) hasDuplicateRelationAssignment = true;
  }
  for (const { owner, ownership } of request.qualityDefinitions) {
    for (const ui of ownership.uiIds) addOwner(qualityUiOwners, ui, owner);
    for (const spec of ownership.specIds)
      addOwner(qualitySpecOwners, spec, owner);
    for (const key of ownership.relations)
      addOwner(qualityRelationOwners, key, owner);
    qualityRelationAssignmentRows += ownership.relations.length;
    if (ownership.hasDuplicateRelations) hasDuplicateRelationAssignment = true;
  }
  /**
   * Relation別Owner集合の要素数を合計する。
   * @responsibility Relation別Owner集合の要素数を合計する。
   * @trace ARCH-000008
   * @input assignments: Relation別Owner集合。
   * @returns Owner集合の総要素数。
   * @precondition 呼出し元が本文を可視化し、対象の観測を完了している。
   * @postcondition 入力を変更せず、既存の出現順・集合条件を保持する。
   * @effect N/A: 取得済み値だけを扱う同期処理。
   * @failure 解析例外を伝播し、観測不能を空値へ変換しない。
   * @invariant 同一Ownerの重複をSetの要素数として数える。
   * @boundary N/A: 同一Process内のDetail意味モデル。
   * @security 実在・認可・品質全体の成立を発行しない。
   * @concurrency N/A: 共有可変状態を持たない。
   */
  const ownerAssignmentCount = (
    assignments: Map<string, Set<string>>,
  ): number =>
    [...assignments.values()].reduce((total, owners) => total + owners.size, 0);
  let hasRelationClosureMismatch = false;
  for (const [relationKey, relation] of expectedDetailRelations) {
    const uiArchitecture = architectureUiOwners.get(relation.ui) ?? new Set();
    const specArchitecture =
      architectureSpecOwners.get(relation.spec) ?? new Set();
    const commonArchitecture = new Set(
      [...uiArchitecture].filter((owner) => specArchitecture.has(owner)),
    );
    const expectedArchitectureOwners = commonArchitecture.size
      ? commonArchitecture
      : new Set([...uiArchitecture, ...specArchitecture]);
    const expectedArchitectureMode =
      commonArchitecture.size === 0
        ? "Joint"
        : commonArchitecture.size === 1
          ? "Single"
          : "Shared";
    const allowedAreas = new Set<string>();
    for (const owner of expectedArchitectureOwners)
      for (const area of areasByArchitecture.get(owner) ?? [])
        allowedAreas.add(area);
    const expectedAreas =
      architectureAreaOwners.get(relationKey) ?? new Set<string>();
    const hasInvalidAreaAssignment =
      expectedAreas.size === 0 ||
      [...expectedAreas].some((area) => !allowedAreas.has(area)) ||
      [...expectedArchitectureOwners].some(
        (owner) =>
          ![...(areasByArchitecture.get(owner) ?? [])].some((area) =>
            expectedAreas.has(area),
          ),
      );
    const architectureCentral = architectureCentralRelations.get(relationKey);
    const uiQuality = qualityUiOwners.get(relation.ui) ?? new Set();
    const specQuality = qualitySpecOwners.get(relation.spec) ?? new Set();
    const commonQuality = new Set(
      [...uiQuality].filter((owner) => specQuality.has(owner)),
    );
    const expectedQualityOwners = commonQuality.size
      ? commonQuality
      : new Set([...uiQuality, ...specQuality]);
    const expectedQualityMode =
      commonQuality.size === 0
        ? "Joint"
        : commonQuality.size === 1
          ? "Single"
          : "Shared";
    const qualityCentral = qualityCentralRelations.get(relationKey);
    if (
      !architectureCentral ||
      architectureCentral.bhv !== relation.bhv ||
      architectureCentral.mode !== expectedArchitectureMode ||
      !sameSet(architectureCentral.owners, expectedArchitectureOwners) ||
      !sameSet(architectureCentral.areas, expectedAreas) ||
      hasInvalidAreaAssignment ||
      !sameSet(
        architectureRelationOwners.get(relationKey) ?? new Set(),
        expectedArchitectureOwners,
      ) ||
      !qualityCentral ||
      qualityCentral.bhv !== relation.bhv ||
      qualityCentral.mode !== expectedQualityMode ||
      !sameSet(qualityCentral.owners, expectedQualityOwners) ||
      !sameSet(
        qualityRelationOwners.get(relationKey) ?? new Set(),
        expectedQualityOwners,
      )
    )
      hasRelationClosureMismatch = true;
  }

  const allIssuedIds = [
    ...issuedScreenIds,
    ...issuedPartIds,
    ...issuedBehaviorIds,
  ];
  if (
    issuedScreenIds.size !== currentUiDefinitionCount ||
    issuedPartIds.size !== currentUiDefinitionCount ||
    issuedBehaviorIds.size !== request.specDefinitionCount ||
    qualityScreenIds.size !== issuedScreenIds.size ||
    qualityPartIds.size !== issuedPartIds.size ||
    qualityBehaviorIds.size !== issuedBehaviorIds.size ||
    allIssuedIds.some(
      (id) =>
        !architectureDefinitionsCombined.includes(id) ||
        !qualityDefinitionsCombined.includes(id),
    ) ||
    architectureCentralRelations.size !== expectedDetailRelations.size ||
    qualityCentralRelations.size !== expectedDetailRelations.size ||
    !sameSet(
      new Set(architectureAreaOwners.keys()),
      new Set(expectedDetailRelations.keys()),
    ) ||
    architectureCentralRelationRows !== architectureCentralRelations.size ||
    qualityCentralRelationRows !== qualityCentralRelations.size ||
    architectureRelationAssignmentRows !==
      ownerAssignmentCount(architectureRelationOwners) ||
    architectureAreaAssignmentRows !==
      ownerAssignmentCount(architectureAreaOwners) ||
    qualityRelationAssignmentRows !==
      ownerAssignmentCount(qualityRelationOwners) ||
    hasDuplicateRelationAssignment ||
    hasDuplicateCentralRelation ||
    hasRelationClosureMismatch
  )
    return [
      {
        kind: "artifact.spec.detail-downstream-coverage-invalid",
        targetIdentity: request.path,
        location: { path: request.path },
        reason: "detail-downstream-coverage-invalid",
        details: {},
      },
    ];
  return [];
}

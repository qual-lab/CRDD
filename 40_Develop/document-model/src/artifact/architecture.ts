/**
 * Architecture分析・定義とDetail引渡しの本文モデルを検査する。
 * @responsibility 取得済み本文の正式入力・九観点・統合責務・引渡し条件を中立Issueへ変換する。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource, ChecklistFailure } from "./types.ts";
import { parseMarkdownTableRow, isMarkdownTableSeparator } from "./markdown.ts";
/**
 * Architecture本文で抽出した関係と検査結果を表す。
 * @responsibility 不正本文でもRelation出現と中立Issueを後続へ渡す。
 * @trace ARCH-000008
 * @shape relations、issues。
 * @invariant Relationの出現順と重複を保持し、Checklist理由を置換しない。
 * @boundary N/A: 取得済みArchitecture本文の値モデル。
 * @security 実在・認可・工程全体の成立を発行しない。
 * @compatibility 現行の分析／定義本文の受理条件を維持する。
 */
export type ArchitectureBodyModel = Readonly<{
  relations: readonly string[];
  issues: readonly DomainIssue[];
}>;
/**
 * Architectureの指定Sectionを解析する。
 * @responsibility Architectureの指定Sectionを解析する。
 * @trace ARCH-000008
 * @input source: 可視本文。heading: 対象見出し。
 * @returns 最初の一致から次の第二階層見出しまでの本文。
 * @precondition 呼出し元が対象の可視本文を取得している。
 * @postcondition 最初の見出し区画だけを返し、一致しなければ空文字を返す。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 最初の一致と既存見出し境界を維持する。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
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

/**
 * Architectureの固定列表を解析する。
 * @responsibility Architectureの固定列表を解析する。
 * @trace ARCH-000008
 * @input source: 可視本文。expectedHeaders: 列名。
 * @returns 固定列の行、または構造不正時null。
 * @precondition 呼出し元が対象の可視本文と期待列名を取得している。
 * @postcondition 固定列の連続行を返し、列数不正を空の正常表へ畳まない。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 最初のHeader／Separatorを要求し、途中の列数不一致はnullで返す。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
const exactMarkdownTable = (
  source: string,
  expectedHeaders: readonly string[],
): string[][] | null => {
  const lines = source.split(/\r?\n/u);
  const headerIndex = lines.findIndex((line) => {
    const cells = parseMarkdownTableRow(line);
    return (
      cells?.length === expectedHeaders.length &&
      cells.every((cell, index) => cell === expectedHeaders[index])
    );
  });
  if (
    headerIndex < 0 ||
    !isMarkdownTableSeparator(
      lines[headerIndex + 1] ?? "",
      expectedHeaders.length,
    )
  )
    return null;
  const rows: string[][] = [];
  for (let index = headerIndex + 2; index < lines.length; index += 1) {
    const cells = parseMarkdownTableRow(lines[index] as string);
    if (!cells) break;
    if (cells.length !== expectedHeaders.length) return null;
    rows.push(cells);
  }
  return rows;
};

/**
 * UI／SPEC観点別のArchitecture分析本文を検査する。
 * @responsibility UI／SPEC観点別のArchitecture分析本文を検査する。
 * @trace ARCH-000008
 * @input artifact: 可視本文と位置。kind、id: 観測した分析種別とID。isArchitectureReadyStatus: 観測したReady状態。checklistError: 二回目readのChecklist理由。
 * @returns Relation出現列と中立Issue。
 * @precondition 可視本文と二回目read由来のChecklist理由を呼出し元が取得済み。
 * @postcondition 入力を変更せず、不正本文からも抽出した関係を保持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 九観点の語彙・Human Input・入力境界・Ready時OPENFAIL拒否を維持する。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureAnalysis(
  artifact: ArtifactSource,
  kind: "UI" | "SPEC",
  id: string,
  isArchitectureReadyStatus: boolean,
  checklistError: ChecklistFailure | null,
): ArchitectureBodyModel {
  const source = artifact.content;
  const issues: DomainIssue[] = [];
  const inputSection = sectionBody(source, "## 1. 正式入力");
  const expectedInput =
    kind === "UI"
      ? `../../../04_UI/Definitions/${id}/ui_definition.md`
      : `../../../05_SPEC/Definitions/${id}/spec_definition.md`;
  const forbiddenInput =
    kind === "UI"
      ? /01_Discovery|02_UX|03_IA|05_SPEC|40_Develop/u
      : /01_Discovery|02_UX|03_IA|04_UI|40_Develop/u;
  const requiredHeadings =
    kind === "UI"
      ? [
          "## 2. Architectureへ引き継ぐUI契約",
          "## 3. Architecture観点の分析",
          "## 4. Architecture処置",
          "## 5. SPEC観点との統合時に確認すること",
        ]
      : [
          "## 2. Architectureへ引き継ぐSPEC契約",
          "## 3. Architecture観点の分析",
          "## 4. Architecture処置",
          "## 5. UI観点との統合時に確認すること",
        ];
  const evaluation = sectionBody(source, "### 観点別評価");
  const requiredEvaluationRows = [
    "Responsibility",
    "Boundary／Component／Interface",
    "Data／State Ownership",
    "Failure／Recovery",
    "Security／Trust",
    "Quality Constraint",
    "Human Input",
    "Open／Gap",
    "Verification Intent",
  ];
  const evaluationRows = exactMarkdownTable(evaluation, [
    "観点",
    "判定",
    "根拠・引渡し",
  ]);
  const evaluationDecisions: Readonly<Record<string, readonly string[]>> = {
    Responsibility: ["評価済み", "OPEN", "FAIL"],
    "Boundary／Component／Interface": ["評価済み", "OPEN", "FAIL"],
    "Data／State Ownership": ["評価済み", "OPEN", "FAIL"],
    "Failure／Recovery": ["評価済み", "OPEN", "FAIL"],
    "Security／Trust": ["評価済み", "OPEN", "FAIL"],
    "Quality Constraint": ["評価済み", "OPEN", "FAIL"],
    "Human Input": ["なし", "継承あり", "OPEN"],
    "Open／Gap": ["なし", "上流確認を継承", "OPEN", "FAIL"],
    "Verification Intent": ["評価済み", "OPEN", "FAIL"],
  };
  const isEvaluationContractValid =
    evaluationRows !== null &&
    evaluationRows.length === requiredEvaluationRows.length &&
    requiredEvaluationRows.every((name) => {
      const matches = evaluationRows.filter(([row]) => row === name);
      return (
        matches.length === 1 &&
        (evaluationDecisions[name] ?? []).includes(
          (matches[0] as string[])[1] as string,
        ) &&
        ((matches[0] as string[])[2] as string).trim().length > 0
      );
    });
  const checklistBody = sectionBody(source, "## Checklist");
  const hasBlockingChecklistResult = /^- (?:OPEN|FAIL): /mu.test(checklistBody);
  const disposition = sectionBody(source, "## 4. Architecture処置");
  const relations = [
    ...disposition.matchAll(
      /\]\(\.\.\/\.\.\/Definitions\/(ARCH-[0-9]{6})\/architecture_definition\.md\)/gu,
    ),
  ].map((match) => `${id}|${match[1]}`);
  if (
    !source.includes(`成果物種別: Architecture分析（${kind}観点）`) ||
    !source.includes(`分析単位: \u0060${id}\u0060`) ||
    !inputSection.includes(expectedInput) ||
    forbiddenInput.test(inputSection) ||
    !requiredHeadings.every((heading) => source.includes(heading)) ||
    !isEvaluationContractValid ||
    !evaluation.includes("Human Inputの判断者") ||
    relations.length === 0 ||
    new Set(relations).size !== relations.length ||
    (isArchitectureReadyStatus && hasBlockingChecklistResult) ||
    checklistError
  )
    issues.push({
      kind: "artifact.architecture.analysis-contract-invalid",
      targetIdentity: id,
      location: { path: artifact.path },
      reason: "analysis-contract-invalid",
      details: { checklistFailure: checklistError },
    });
  return { relations, issues };
}
/**
 * Architecture定義の統合責務本文を検査する。
 * @responsibility Architecture定義の統合責務本文を検査する。
 * @trace ARCH-000008
 * @input artifact: 可視本文と位置。identity: Directory由来ID。isArchitectureReadyStatus: 観測したReady状態。checklistError: 二回目readのChecklist理由。
 * @returns Relation出現列と中立Issue。
 * @precondition 可視本文と二回目read由来のChecklist理由を呼出し元が取得済み。
 * @postcondition 入力を変更せず、不正本文からも抽出した関係を保持する。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 両分析入力・未確認表の完全被覆・構造・Placeholder・Ready時OPENFAIL条件を維持する。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureDefinition(
  artifact: ArtifactSource,
  identity: string,
  isArchitectureReadyStatus: boolean,
  checklistError: ChecklistFailure | null,
): ArchitectureBodyModel {
  const source = artifact.content;
  const issues: DomainIssue[] = [];
  const uiSection = sectionBody(source, "## 2. UI観点の入力");
  const specSection = sectionBody(source, "## 3. SPEC観点の入力");
  const relations = [
    ...`${uiSection}\n${specSection}`.matchAll(
      /\[((?:UI|SPEC)-[0-9]{6})\]\(\.\.\/\.\.\/Analysis\/\1\/architecture_analysis\.md\)/gu,
    ),
  ].map((match) => `${match[1]}|${identity}`);
  const requiredHeadings = [
    "## 1. 責務と境界",
    "## 2. UI観点の入力",
    "## 3. SPEC観点の入力",
    "## 4. 両観点の統合判断",
    "## 5. 構造と依存方向",
    "## 6. データ・状態・Interface",
    "## 7. 失敗・回復・観測",
    "## 8. 品質・保護・運用",
    "## 9. 互換性・移行・成立済み能力",
    "## 10. 実装と検証への引き渡し",
    "## 11. 情報源と現行照合",
  ];
  const unknownSection = sectionBody(
    source,
    "### 未確認事項・人間判断・戻り条件",
  );
  const definitionInputIds = new Set(
    [uiSection, specSection]
      .flatMap((inputSection) => [
        ...inputSection.matchAll(/\[((?:UI|SPEC)-[0-9]{6})\]\(/gu),
      ])
      .map((match) => match[1] as string),
  );
  const unknownRows = exactMarkdownTable(unknownSection, [
    "入力",
    "継承する未確認事項",
    "判断者",
    "現在判定",
    "再評価契機",
  ]);
  const unknownInputIds = unknownRows?.map((cells) => cells[0] as string) ?? [];
  const isUnknownContractValid =
    unknownRows !== null &&
    unknownRows.length === definitionInputIds.size &&
    unknownRows.every(
      (cells) =>
        cells.every((cell) => cell.trim().length > 0) &&
        definitionInputIds.has(cells[0] as string),
    ) &&
    new Set(unknownInputIds).size === unknownInputIds.length &&
    [...definitionInputIds].every((id) => unknownInputIds.includes(id));
  const checklistBody = sectionBody(source, "## Checklist");
  const hasBlockingChecklistResult = /^- (?:OPEN|FAIL): /mu.test(checklistBody);
  const requiredStructures = [
    "| 状態Owner |",
    "| 所有する責務 |",
    "| 所有しない責務 |",
    "| 主な外部境界 |",
    "| 入力 | 観点 | State Owner | Authority | Effect／非該当 | Failure Boundary | Lifecycle |",
    "| 入力 | State Owner | Authority | Effect／非該当 |",
    "| 入力 | 保護する失敗境界 | 検証意図 |",
    "| 基準版Capability | 旧Owner／現行照合先 | 新Owner | 保持状態 | Evidence | Gap／移行 |",
  ];
  const hasPlaceholderOnlySection = requiredHeadings.some((heading) => {
    const body = sectionBody(source, heading).trim();
    const firstParagraph = body.split(/\n\s*\n/u)[0]?.trim() ?? "";
    return /^(?:責務|統合|構造|状態|失敗|品質|移行|引渡し|照合)[。.]?$/u.test(
      firstParagraph,
    );
  });
  if (
    !source.includes("成果物種別: Architecture定義") ||
    !source.includes(`Architecture ID: \u0060${identity}\u0060`) ||
    !requiredHeadings.every((heading) => source.includes(heading)) ||
    !requiredStructures.every((fragment) => source.includes(fragment)) ||
    !isUnknownContractValid ||
    !unknownSection.includes("Architecture固有の追加人間判断") ||
    hasPlaceholderOnlySection ||
    !/UI-[0-9]{6}/u.test(uiSection) ||
    !/SPEC-[0-9]{6}/u.test(specSection) ||
    (isArchitectureReadyStatus && hasBlockingChecklistResult) ||
    checklistError
  )
    issues.push({
      kind: "artifact.architecture.definition-contract-invalid",
      targetIdentity: identity,
      location: { path: artifact.path },
      reason: "definition-contract-invalid",
      details: { checklistFailure: checklistError },
    });
  return { relations, issues };
}
/**
 * ArchitectureのDefinition／Areaひな型にDetail引渡し構造があるか検査する。
 * @responsibility ArchitectureのDefinition／Areaひな型にDetail引渡し構造があるか検査する。
 * @trace ARCH-000008
 * @input artifact: 可視本文と位置。kind: 定義または領域という固定の二用途。
 * @returns 既存引渡し条件に違反する中立Issue。
 * @precondition 呼出し元が対象ひな型の可視本文を取得している。
 * @postcondition 入力を変更せず、用途別の構造不整合だけを返す。
 * @effect N/A: 取得済み値だけを扱う同期処理。
 * @failure 解析例外を伝播し、本文の欠落を補完しない。
 * @invariant 見出しと表Headerの既存文字列条件だけを確認する。
 * @boundary N/A: 同一Process内のArchitecture本文意味検査。
 * @security 実在・認可・品質全体の成立を発行しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectArchitectureDetailTemplate(
  artifact: ArtifactSource,
  kind: "definition" | "area",
): DomainIssue[] {
  const source = artifact.content;
  const isTemplateInvalid =
    kind === "definition"
      ? !source.includes("### 4.1 UI／SPEC Detailの配置制約") ||
        !source.includes(
          "| Detail Source | Source Definition | SCR／PRT／Interaction／BHV | Relation／N:N | Coverage | 未解決Gap／戻し先 |",
        )
      : !source.includes("## 上流UI／SPEC Detailとの関係") ||
        !source.includes(
          "| Detail Source | UI／SPEC Definition | この領域が担当するSCR／PRT／Interaction／BHV | Relation状態 | 未解決Gap／戻し先 |",
        );
  if (!isTemplateInvalid) return [];
  const reason =
    kind === "definition"
      ? "detail-relation-contract-missing"
      : "detail-owner-mapping-missing";
  return [
    {
      kind: `artifact.architecture.${reason}`,
      targetIdentity: artifact.path,
      location: { path: artifact.path },
      reason,
      details: {},
    },
  ];
}

/**
 * 横断モデル登録の検査結果と、取得対象の順序を表す。
 * @responsibility 登録節の不在と固定五文書の取得対象を区別する。
 * @trace ARCH-000008
 * @shape files、issues。
 * @invariant 登録節が空なら取得対象は空、存在すれば固定五文書順。
 * @boundary N/A: 可視本文から導く値モデル。
 * @security Fileの実在・認可・Ready成立を保証しない。
 * @compatibility 既存の空Section時の観測停止を維持する。
 */
export type ArchitectureCrossModelIndex = Readonly<{
  files: readonly string[];
  issues: readonly DomainIssue[];
}>;

/**
 * 横断モデルの固定文書と要求構造を定義する。
 * @responsibility 現行Architecture五文書の見出しと構造断片を所有する。
 * @trace ARCH-000008
 */
const architectureCrossModels: ReadonlyArray<{
  file: string;
  headings: readonly string[];
  sectionStructures: ReadonlyArray<readonly [string, readonly string[]]>;
}> = [
  {
    file: "02_Component_and_Responsibility_Model.md",
    headings: [
      "## 2. 全体ブロック図",
      "## 3. Component責務表",
      "## 5. QAへ渡す検証単位",
    ],
    sectionStructures: [
      ["## 2. 全体ブロック図", ["```text"]],
      [
        "## 3. Component責務表",
        [
          "| Component | 含むArchitecture定義 | 状態Owner | 所有すること | 所有しないこと |",
        ],
      ],
    ],
  },
  {
    file: "03_Boundary_and_Interface_Model.md",
    headings: [
      "## 2. 境界表",
      "## 3. 型とPortの関係",
      "## 4. 主要なブロック間シーケンス",
      "## 6. Qualityへの引渡し",
    ],
    sectionStructures: [
      [
        "## 2. 境界表",
        ["| 境界 | 呼出し側 | 受け側 | 越えるもの | 越えないもの | 不明時 |"],
      ],
      ["## 3. 型とPortの関係", ["```text"]],
      [
        "## 5. Schema責務",
        ["| 情報 | Canonical Owner | Writer | Reader | 所有禁止 |"],
      ],
    ],
  },
  {
    file: "04_Runtime_and_Data_Flow_Model.md",
    headings: [
      "## 2. 主要データフロー",
      "## 3. 横断状態遷移",
      "## 4. 概念Entity関係",
      "## 6. Qualityへの引渡し",
    ],
    sectionStructures: [
      ["## 2. 主要データフロー", ["<<E", "(P", "[(D"]],
      [
        "## 3. 横断状態遷移",
        [
          "[S",
          "| 現在状態 | 契機 | 事前条件 | 処置 | Effect | 次状態 | 失敗時 | cleanup・Recovery | 終了後観測 |",
        ],
      ],
      ["## 4. 概念Entity関係", ["[ER"]],
      ["## 5. 整合条件", ["| 対象 | 必須の相関 | 禁止する畳み込み |"]],
    ],
  },
  {
    file: "05_Failure_Recovery_and_Resilience_Model.md",
    headings: [
      "## 2. 故障と回復の全体図",
      "## 3. Failure Matrix",
      "## 4. 回復の不変条件",
      "## 6. Qualityへの引渡し",
    ],
    sectionStructures: [
      ["## 2. 故障と回復の全体図", ["```text"]],
      [
        "## 3. Failure Matrix",
        ["| 故障領域 | 対象Component | 守る対象 | 即時処置 | 回復／終了条件 |"],
      ],
    ],
  },
  {
    file: "06_Deployment_and_Execution_Model.md",
    headings: [
      "## 2. 論理配置図",
      "## 3. 実行単位とResource",
      "## 4. 段階的な結合単位",
      "## 5. Reality Auditへの引渡し",
      "## 6. Qualityへの引渡し",
    ],
    sectionStructures: [
      ["## 2. 論理配置図", ["```text"]],
      [
        "## 3. 実行単位とResource",
        ["| 論理単位 | 主なResource | 並行性の境界 | 終了条件 |"],
      ],
      ["## 4. 段階的な結合単位", ["| 段階 | 主な目的 | 対象境界 |"]],
      [
        "## 5. Reality Auditへの引渡し",
        ["| 照合対象 | 確認すること | 参照先 |"],
      ],
    ],
  },
];

/**
 * Architecture横断モデルの登録節を検査する。
 * @responsibility 空SectionのIssueと、存在時だけの固定取得順を返す。
 * @trace ARCH-000008
 * @input artifact: 取得済み登録本文と位置。
 * @returns 固定文書名列と中立Issue。
 * @precondition 本文は呼出し元が可視化している。
 * @postcondition 空Sectionでは取得対象を返さない。
 * @effect N/A: 同期的な値検査。
 * @failure 解析例外を伝播する。
 * @invariant Ready状態にかかわらず同じ条件を使用する。
 * @boundary N/A: 取得済み文書モデル。
 * @security 実在確認やFile読取りを行わない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function inspectArchitectureCrossModelIndex(
  artifact: ArtifactSource,
): ArchitectureCrossModelIndex {
  if (
    sectionBody(artifact.content, "## Architecture横断モデル").trim().length !==
    0
  )
    return {
      files: architectureCrossModels.map((model) => model.file),
      issues: [],
    };
  return {
    files: [],
    issues: [
      {
        kind: "artifact.architecture.cross-model-section-missing",
        targetIdentity: artifact.path,
        location: { path: artifact.path },
        reason: "cross-model-section-missing",
        details: {},
      },
    ],
  };
}

/**
 * 横断モデル文書の登録・見出し・構造断片を検査する。
 * @responsibility 可視本文とFence保持本文を既存の異なる条件で検査する。
 * @trace ARCH-000008
 * @input artifact: 可視本文と位置。file: 固定文書名。index: 可視登録本文。structureContent: コメント除去済みFence保持本文。
 * @returns 不整合時の中立Issue。
 * @precondition 二つの本文表現は呼出し元の同じ一回の読取りに由来する。
 * @postcondition 入力を変更せず既存の部分文字列条件だけを評価する。
 * @effect N/A: 同期的な値検査。
 * @failure 未知の固定文書名と解析例外を拒否する。
 * @invariant 必須見出しと構造Sectionの集合を相互補完しない。
 * @boundary N/A: 取得済み文書モデル。
 * @security 実在・認可・図の構文妥当性を保証しない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function inspectArchitectureCrossModel(
  artifact: ArtifactSource,
  file: string,
  index: string,
  structureContent: string,
): DomainIssue[] {
  const model = architectureCrossModels.find(
    (candidate) => candidate.file === file,
  );
  if (!model) throw new Error("unknown_architecture_cross_model");
  const crossModelSection = sectionBody(index, "## Architecture横断モデル");
  if (
    crossModelSection.includes(`](${model.file})`) &&
    model.headings.every((heading) => artifact.content.includes(heading)) &&
    model.sectionStructures.every(([heading, structures]) => {
      const body = sectionBody(structureContent, heading);
      return structures.every((structure) => body.includes(structure));
    })
  )
    return [];
  return [
    {
      kind: "artifact.architecture.cross-model-contract-invalid",
      targetIdentity: file,
      location: { path: artifact.path },
      reason: "cross-model-contract-invalid",
      details: {},
    },
  ];
}

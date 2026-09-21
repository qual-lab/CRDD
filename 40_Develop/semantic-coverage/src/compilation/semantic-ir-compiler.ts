import crypto from "node:crypto";

import type {
  DomainIssue,
  DomainOutcome,
} from "../../../crdd-domain-library/src/index.ts";

/**
 * Semantic IRへ変換するCanonical文書Snapshotを表す。
 *
 * @responsibility 変換入力のPathと同一時点の本文を一つの値として保持する。
 * @trace ARCH-000008
 * @shape SemanticSourceDocumentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticSourceDocumentで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticSourceDocumentの宣言は外部境界を開かない。
 * @security N/A: SemanticSourceDocumentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticSourceDocumentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticSourceDocument = Readonly<{
  path: string;
  source: string;
}>;

/**
 * Architecture Detailsから明示的に抽出した一つの意味要素を表す。
 *
 * @responsibility 意味Key、Architecture Relation、検証要否および根拠節を保持する。
 * @trace ARCH-000008
 * @shape SemanticIrMeaningが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticIrMeaningで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticIrMeaningの宣言は外部境界を開かない。
 * @security N/A: SemanticIrMeaningはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticIrMeaningの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticIrMeaning = Readonly<{
  semanticKey: string;
  kind: string;
  statement: string;
  archIds: readonly string[];
  verification: "required" | "not-applicable";
  sourceSection: string;
  notApplicableReason: string | null;
}>;

/**
 * 一つのSubsystemから決定論的に生成した意味要素集合を表す。
 *
 * @responsibility 入力文書IdentityとHashを意味要素集合へ結合する。
 * @trace ARCH-000008
 * @shape SemanticIrが表すProperty、識別子およびRelationを型として固定する。
 * @invariant SemanticIrで宣言した値と責務の対応を維持する。
 * @boundary N/A: SemanticIrの宣言は外部境界を開かない。
 * @security N/A: SemanticIrはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility SemanticIrの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type SemanticIr = Readonly<{
  contract: "crdd/semantic-ir-pilot";
  contractRevision: 0;
  stability: "pilot";
  subsystem: string;
  sourceDocument: string;
  sourceSha256: string;
  meanings: readonly SemanticIrMeaning[];
}>;

const expectedHeaders = [
  "Semantic Key",
  "種別",
  "要求する意味",
  "Architecture定義",
  "検証要否",
  "根拠節",
  "N/A理由",
] as const;

/**
 * Markdown表の一行を意味抽出前のCell列へ分解する。
 *
 * @responsibility 行境界を維持したまま外側DelimiterとCell余白だけを除く。
 * @trace ARCH-000008
 * @input line: string
 * @returns string[]を返す。
 * @precondition line: stringがparseTableRowの入力契約を満たす。
 * @postcondition parseTableRowの責務を完了した結果だけを返す。
 * @effect N/A: parseTableRowは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: parseTableRowは独自の失敗分岐を所有しない。
 * @invariant parseTableRowは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: parseTableRowはProcess内の同一Subsystemで完結する。
 * @security N/A: parseTableRowはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: parseTableRowは共有非同期状態を持たない同期処理である。
 */
function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/u, "")
    .replace(/\|$/u, "")
    .split("|")
    .map((cell) => cell.trim());
}

/**
 * 一つのInline Code値から囲み記号を除去する。
 *
 * @responsibility Inline Code以外を値として受理せず構造不一致を保持する。
 * @trace ARCH-000008
 * @input value: string
 * @returns string | nullを返す。
 * @precondition value: stringがunwrapCodeの入力契約を満たす。
 * @postcondition unwrapCodeの責務を完了した結果だけを返す。
 * @effect N/A: unwrapCodeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: unwrapCodeは独自の失敗分岐を所有しない。
 * @invariant unwrapCodeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: unwrapCodeはProcess内の同一Subsystemで完結する。
 * @security N/A: unwrapCodeはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: unwrapCodeは共有非同期状態を持たない同期処理である。
 */
function unwrapCode(value: string): string | null {
  const match = /^`([^`]+)`$/u.exec(value);
  return match?.[1] ?? null;
}

/**
 * Semantic Coverageで共有する構造化Issueを生成する。
 *
 * @responsibility 理由、対象Identity、LocationおよびDetailを同じIssueへ結合する。
 * @trace ARCH-000008
 * @input kind: string、path: string、reason: string、details: DomainIssue["details"]、targetIdentity
 * @returns DomainIssueを返す。
 * @precondition kind: string、path: string、reason: string、details: DomainIssue["details"]、targetIdentityがsemanticDomainIssueの入力契約を満たす。
 * @postcondition semanticDomainIssueの責務を完了した結果だけを返す。
 * @effect N/A: semanticDomainIssueは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: semanticDomainIssueは独自の失敗分岐を所有しない。
 * @invariant semanticDomainIssueは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: semanticDomainIssueはProcess内の同一Subsystemで完結する。
 * @security N/A: semanticDomainIssueはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: semanticDomainIssueは共有非同期状態を持たない同期処理である。
 */
export function semanticDomainIssue(
  kind: string,
  path: string,
  reason: string,
  details: DomainIssue["details"] = {},
  targetIdentity = path,
): DomainIssue {
  return {
    kind,
    targetIdentity,
    location: { path },
    reason,
    details,
  };
}

/**
 * Architecture Detailsの明示表を検証してSemantic IRへ変換する。
 *
 * @responsibility 自由文を推測せず、契約どおりのMeaningだけを完全または不正として返す。
 * @trace ARCH-000008
 * @input sourceDocument: SemanticSourceDocument、subsystem: string、architectureDefinitionIds: ReadonlySet<string>
 * @returns DomainOutcome<SemanticIr>を返す。
 * @precondition sourceDocument: SemanticSourceDocument、subsystem: string、architectureDefinitionIds: ReadonlySet<string>がcompileSemanticIrの入力契約を満たす。
 * @postcondition compileSemanticIrの責務を完了した結果だけを返す。
 * @effect N/A: compileSemanticIrは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure 欠落、重複、未解決Architectureまたは不正なN/Aを部分IRへ畳まない。
 * @invariant 完全な結果の全Meaningは実在Architectureと根拠節へ接続する。
 * @boundary N/A: compileSemanticIrはProcess内の同一Subsystemで完結する。
 * @security N/A: compileSemanticIrはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: compileSemanticIrは共有非同期状態を持たない同期処理である。
 */
export function compileSemanticIr(
  sourceDocument: SemanticSourceDocument,
  subsystem: string,
  architectureDefinitionIds: ReadonlySet<string>,
): DomainOutcome<SemanticIr> {
  const lines = sourceDocument.source.split(/\r?\n/u);
  const headingIndex = lines.findIndex((line) =>
    /^#{2,3}\s+.*機械生成する意味要素\s*$/u.test(line),
  );
  if (headingIndex < 0)
    return {
      status: "invalid",
      result: null,
      issues: [
        semanticDomainIssue(
          "ir.source.table-missing",
          sourceDocument.path,
          "source_heading_missing",
          { missingPart: "heading" },
        ),
      ],
    };

  const tableStart = lines.findIndex(
    (line, index) => index > headingIndex && line.trim().startsWith("|"),
  );
  if (tableStart < 0)
    return {
      status: "invalid",
      result: null,
      issues: [
        semanticDomainIssue(
          "ir.source.table-missing",
          sourceDocument.path,
          "source_table_missing",
          { missingPart: "table" },
        ),
      ],
    };
  const headers = parseTableRow(lines[tableStart] ?? "");
  if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders))
    return {
      status: "invalid",
      result: null,
      issues: [
        semanticDomainIssue(
          "ir.source.header-invalid",
          sourceDocument.path,
          "source_header_does_not_match_contract",
        ),
      ],
    };

  const separators = parseTableRow(lines[tableStart + 1] ?? "");
  if (
    separators.length !== expectedHeaders.length ||
    separators.some((cell) => !/^:?-{3,}:?$/u.test(cell))
  )
    return {
      status: "invalid",
      result: null,
      issues: [
        semanticDomainIssue(
          "ir.source.separator-invalid",
          sourceDocument.path,
          "source_separator_invalid",
        ),
      ],
    };

  const issues: DomainIssue[] = [];
  const meanings: SemanticIrMeaning[] = [];
  const semanticKeys = new Set<string>();
  for (let index = tableStart + 2; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim().startsWith("|")) break;
    const cells = parseTableRow(line);
    if (cells.length !== expectedHeaders.length) {
      issues.push(
        semanticDomainIssue(
          "ir.source.row-invalid",
          sourceDocument.path,
          "source_row_cell_count_invalid",
          { row: index + 1, cellCount: cells.length },
        ),
      );
      continue;
    }
    const semanticKey = unwrapCode(cells[0] ?? "");
    const kind = unwrapCode(cells[1] ?? "");
    const statement = cells[2] ?? "";
    const archIds = [...(cells[3] ?? "").matchAll(/`(ARCH-[0-9]{6})`/gu)]
      .map((match) => match[1])
      .filter((id): id is string => Boolean(id));
    const verificationValue = unwrapCode(cells[4] ?? "");
    const sourceSection = unwrapCode(cells[5] ?? "");
    const notApplicableReason = cells[6] === "—" ? null : (cells[6] ?? null);

    if (!semanticKey?.startsWith(`${subsystem}.`))
      issues.push(
        semanticDomainIssue(
          "ir.meaning.key-invalid",
          sourceDocument.path,
          "meaning_key_not_in_subsystem_namespace",
          { row: index + 1, subsystem },
        ),
      );
    else if (semanticKeys.has(semanticKey))
      issues.push(
        semanticDomainIssue(
          "ir.meaning.key-duplicate",
          sourceDocument.path,
          "meaning_key_not_unique",
          { semanticKey },
          semanticKey,
        ),
      );
    else semanticKeys.add(semanticKey);
    if (!kind || !/^[a-z][a-z0-9-]*$/u.test(kind))
      issues.push(
        semanticDomainIssue(
          "ir.meaning.kind-invalid",
          sourceDocument.path,
          "meaning_kind_shape_invalid",
          { row: index + 1 },
        ),
      );
    if (!statement)
      issues.push(
        semanticDomainIssue(
          "ir.meaning.statement-missing",
          sourceDocument.path,
          "meaning_statement_missing",
          { row: index + 1 },
        ),
      );
    if (archIds.length === 0)
      issues.push(
        semanticDomainIssue(
          "ir.meaning.architecture-id-missing",
          sourceDocument.path,
          "architecture_identity_missing",
          { row: index + 1 },
        ),
      );
    for (const archId of archIds) {
      if (!architectureDefinitionIds.has(archId))
        issues.push(
          semanticDomainIssue(
            "ir.meaning.architecture-id-unresolved",
            sourceDocument.path,
            "architecture_identity_unresolved",
            { archId },
            archId,
          ),
        );
    }
    const verification =
      verificationValue === "Required"
        ? "required"
        : verificationValue === "N/A"
          ? "not-applicable"
          : null;
    if (!verification)
      issues.push(
        semanticDomainIssue(
          "ir.meaning.verification-invalid",
          sourceDocument.path,
          "verification_value_not_supported",
          { row: index + 1 },
        ),
      );
    if (
      verification === "not-applicable" &&
      (!notApplicableReason || notApplicableReason.length === 0)
    )
      issues.push(
        semanticDomainIssue(
          "ir.meaning.not-applicable-reason-missing",
          sourceDocument.path,
          "not_applicable_reason_missing",
          { row: index + 1 },
        ),
      );
    if (
      !sourceSection ||
      !lines.some((candidate) => candidate.trim() === sourceSection)
    )
      issues.push(
        semanticDomainIssue(
          "ir.meaning.source-section-unresolved",
          sourceDocument.path,
          "source_section_unresolved",
          { row: index + 1 },
        ),
      );

    if (
      semanticKey &&
      kind &&
      statement &&
      archIds.length > 0 &&
      verification &&
      sourceSection
    )
      meanings.push({
        semanticKey,
        kind,
        statement,
        archIds: [...new Set(archIds)].sort(),
        verification,
        sourceSection,
        notApplicableReason,
      });
  }

  if (meanings.length === 0)
    issues.push(
      semanticDomainIssue(
        "ir.source.meanings-empty",
        sourceDocument.path,
        "source_has_no_meaning_rows",
      ),
    );
  if (issues.length > 0) return { status: "invalid", result: null, issues };

  return {
    status: "complete",
    result: {
      contract: "crdd/semantic-ir-pilot",
      contractRevision: 0,
      stability: "pilot",
      subsystem,
      sourceDocument: sourceDocument.path,
      sourceSha256: crypto
        .createHash("sha256")
        .update(sourceDocument.source, "utf8")
        .digest("hex"),
      meanings: meanings.sort((left, right) =>
        left.semanticKey.localeCompare(right.semanticKey),
      ),
    },
    issues: [],
  };
}

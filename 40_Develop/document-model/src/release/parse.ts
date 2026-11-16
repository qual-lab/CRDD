/**
 * READMEとCHANGELOGの完成受付を提供する。
 * @responsibility 本文と出典を捕捉し、Stable版との比較はSemanticへ委ねる。
 * @trace ARCH-000008
 */
import {
  captureDocumentSections,
  captureDocumentTableRows,
  parseMarkdownFences,
  readCanonicalDocumentHeader,
} from "../artifact/markdown.ts";
import { parseMarkdownArtifact } from "../artifact/parse-markdown.ts";
import type {
  ArtifactSource,
  DocumentText,
  MarkdownFenceLine,
  ParseResult,
} from "../artifact/types.ts";
import type {
  CanonicalDocument,
  Changelog,
  ChangelogRelease,
  Readme,
} from "./types.ts";
import { validateCanonicalDocument, validateChangelog } from "./validation.ts";

/**
 * 取得済みREADMEを内容モデルへ解析する。
 * @responsibility 先頭Header・全raw本文・先頭20行の異なる観測断面を保持する。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。
 * @returns Readmeと単体Issue。版欠測だけでは新たなIssueを生成しない。
 * @precondition File取得と適用判断は利用側が完了している。
 * @postcondition 最初の意味行で版を採用できなくても後続を探さない。
 * @effect N/A: 取得済み値のみ。
 * @failure 解析例外を伝播し、版や公開状態を推測しない。
 * @invariant BOM・Fence・Anchor・太字行skip・raw先頭20行を維持する。
 * @boundary 文書単体の解析と公開対象版との比較。
 * @security completeは内容捕捉の完了であり、版適合や公開許可を示さない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function parseReadme(
  source: ArtifactSource,
): ParseResult<Readme> & Readonly<{ result: Readme }> {
  const captured = { path: source.path, content: source.content };
  const markdown = parseMarkdownFences(
    captured.content.replace(/^\uFEFF/u, "").split(/\r?\n/u),
  );
  const outsideFenceLines = markdown.entries
    .filter((entry) => entry.outside)
    .map((entry) => ({
      text: entry.text,
      location: { path: captured.path, line: entry.index + 1 },
    }));
  let hasTitle = false;
  let selectedHeader: DocumentText | null = null;
  let version: string | null = null;
  for (const entry of outsideFenceLines) {
    const line = entry.text;
    if (line.trim() === "" || /^<a id="[^"]+"><\/a>$/u.test(line)) continue;
    if (!hasTitle && /^#\s+\S/u.test(line)) {
      hasTitle = true;
      continue;
    }
    if (/^\*\*[^*]+\*\*[ \t]*$/u.test(line)) continue;
    selectedHeader = entry;
    const match = line.match(
      /^(?:Version|Status):[ \t]*(?:\*\*(v[0-9][^\s*]*)(?:[ \t]+[^*]*)?\*\*|(v[0-9][^\s*]*)(?:[ \t]+[^*]*)?)[ \t]*$/u,
    );
    version = match?.[1] ?? match?.[2] ?? null;
    break;
  }
  const header = captured.content.split(/\r?\n/u).slice(0, 20).join("\n");
  const candidateDeclarations = Array.from(
    header.matchAll(/\bCandidate\b|^Released Baseline:/gmu),
    (match) => ({
      text: match[0],
      location: {
        path: captured.path,
        line: header.slice(0, match.index).split("\n").length,
      },
    }),
  );
  const result: Readme = {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    rawLines: captured.content.split(/\r?\n/u).map((text, index) => ({
      text,
      location: { path: captured.path, line: index + 1 },
    })),
    outsideFenceLines,
    selectedHeader,
    version,
    releaseHeader: { text: header, location: { path: captured.path, line: 1 } },
    candidateDeclarations,
    english: captureDocumentSections(captured, "English"),
    japanese: captureDocumentSections(captured, "日本語"),
  };
  return { status: "complete", result, issues: [] };
}

/**
 * CHANGELOG全体を捕捉し、指定版の文書内規則を検査する。
 * @responsibility 全履歴の保持と現行診断範囲を分け、Fenceの構造を一回捕捉する。
 * @trace ARCH-000008
 * @input source: 取得済みraw本文。options.version: 文書内の診断対象版。
 * @returns Changelogと従来順の局所Issue。
 * @precondition 対象版は利用側が明示し、最新版を自動推定しない。
 * @postcondition 診断対象外の版も内容として保持し、過去版へ検査を拡大しない。
 * @effect N/A: 取得済み値のみ。
 * @failure 解析例外を伝播し、欠測や不正宣言を推測で補完しない。
 * @invariant Fence外・閉じたyaml／yml・先頭境界・診断順を維持する。
 * @boundary 文書内の構造・宣言と外部Stable版との比較。
 * @security 宣言・completeを移行採用や公開許可へ昇格しない。
 * @concurrency N/A: 共有可変状態なし。
 */
export function parseChangelog(
  source: ArtifactSource,
  options: Readonly<{ version: string }>,
): ParseResult<Changelog> & Readonly<{ result: Changelog }> {
  const captured = { path: source.path, content: source.content };
  const lines = captured.content.split(/\r?\n/u);
  const markdown = parseMarkdownFences(lines);
  const outsideEntries = markdown.entries.filter((entry) => entry.outside);
  const offsets = [
    0,
    ...Array.from(
      captured.content.matchAll(/\r?\n/gu),
      (match) => match.index + match[0].length,
    ),
  ];
  const asText = (entry: MarkdownFenceLine): DocumentText => ({
    text: entry.text,
    location: { path: captured.path, line: entry.index + 1 },
  });
  const sectionBody = (start: number, end: number): DocumentText => ({
    text: captured.content.slice(
      offsets[start + 1] ?? captured.content.length,
      offsets[end] ?? captured.content.length,
    ),
    location: { path: captured.path, line: Math.min(start + 2, lines.length) },
  });
  const declarations = (
    section: Readonly<{
      start: number;
      end: number;
      entries: readonly MarkdownFenceLine[];
    }>,
    key: string,
    validValues: readonly string[],
  ):
    | Readonly<{
        valid: false;
        reason: string;
        attempts: readonly DocumentText[];
      }>
    | Readonly<{
        valid: true;
        value: string;
        attempts: readonly DocumentText[];
      }> => {
    const attempts: string[] = [];
    const observations: DocumentText[] = [];
    for (const entry of section.entries.filter(
      (candidate) => candidate.outside,
    )) {
      const match = entry.text.match(
        new RegExp(`^\\s*[-*+]\\s+\`${key}:\\s*([^\`]*)\`\\s*$`, "u"),
      );
      if (match) {
        attempts.push((match[1] as string).trim());
        observations.push({
          text: entry.text,
          location: { path: captured.path, line: entry.index + 1 },
        });
      }
    }
    const yamlFences = markdown.fences.filter(
      (fence) =>
        fence.start >= section.start &&
        fence.start < section.end &&
        ["yaml", "yml"].includes(fence.language),
    );
    const hasUnclosedYaml = yamlFences.some((fence) => !fence.closed);
    for (const fence of yamlFences.filter((candidate) => candidate.closed)) {
      for (const entry of fence.contents) {
        const match = entry.text.match(
          new RegExp(`^\\s*${key}:\\s*([^#\\s]+)\\s*(?:#.*)?$`, "u"),
        );
        if (match) {
          attempts.push((match[1] as string).trim());
          observations.push({
            text: entry.text,
            location: { path: captured.path, line: entry.index + 1 },
          });
        }
      }
    }
    if (hasUnclosedYaml) {
      return {
        valid: false,
        reason: "unclosed-yaml-fence",
        attempts: observations,
      };
    }
    if (attempts.length !== 1 || !validValues.includes(attempts[0] as string)) {
      return {
        valid: false,
        reason: attempts.length === 0 ? "missing" : "invalid-or-multiple",
        attempts: observations,
      };
    }
    return {
      valid: true,
      value: attempts[0] as string,
      attempts: observations,
    };
  };

  const requiredMigrationMarkers: Readonly<
    Record<string, readonly (readonly [RegExp, string])[]>
  > = {
    English: [
      [/^\s*[-*+]\s+Required(?:\s+for\s+[^:]+)?:/u, "Required"],
      [/^\s*[-*+]\s+Conditional(?:\s+[^:]+)?:/u, "Conditional"],
      [/^\s*[-*+]\s+Not required(?: for adopting projects)?:/u, "Not required"],
      [/^\s*[-*+]\s+Rollback \/ recovery:/u, "Rollback / recovery"],
      [/^\s*[-*+]\s+Known risk if deferred:/u, "Known risk if deferred"],
      [/^\s*[-*+]\s+Verification:/u, "Verification"],
      [/^\s*[-*+]\s+Known limitation:/u, "Known limitation"],
    ],
    日本語: [
      [/^\s*[-*+]\s+(?:[^:]+で)?必須:/u, "必須"],
      [/^\s*[-*+]\s+条件付き(?:[^:]*)?:/u, "条件付き"],
      [/^\s*[-*+]\s+(?:不要|採用プロジェクトでは不要):/u, "不要"],
      [/^\s*[-*+]\s+(?:復旧|切戻し／復旧):/u, "復旧"],
      [/^\s*[-*+]\s+延期時の既知リスク:/u, "延期時の既知リスク"],
      [/^\s*[-*+]\s+検証:/u, "検証"],
      [/^\s*[-*+]\s+既知の(?:制限|限界):/u, "既知の制限"],
    ],
  };

  const languages = Object.entries(requiredMigrationMarkers).map(
    ([name, patterns]) => {
      const starts = outsideEntries.filter(
        (entry) => entry.text === `## ${name}`,
      );
      const sections = starts.map((languageHeading) => {
        const languageStart = languageHeading.index;
        const languageEnd =
          outsideEntries.find(
            (entry) =>
              entry.index > languageStart && /^##\s+/u.test(entry.text),
          )?.index ?? lines.length;
        const headings = outsideEntries.filter(
          (entry) =>
            entry.index > languageStart &&
            entry.index < languageEnd &&
            /^###\s+/u.test(entry.text),
        );
        const releases = headings.map((heading): ChangelogRelease => {
          const releaseStart = heading.index;
          const releaseEnd =
            headings.find((entry) => entry.index > releaseStart)?.index ??
            languageEnd;
          const section = {
            start: releaseStart,
            end: releaseEnd,
            entries: markdown.entries.filter(
              (entry) =>
                entry.index >= releaseStart && entry.index < releaseEnd,
            ),
          };
          const outside = section.entries.filter((entry) => entry.outside);
          return {
            heading: asText(heading),
            body: sectionBody(releaseStart, releaseEnd),
            outsideLines: outside.map(asText),
            migrationRequired: declarations(section, "migration_required", [
              "true",
              "false",
            ]),
            changeClassification: declarations(
              section,
              "change_classification",
              [
                "editorial",
                "clarification",
                "additive",
                "normative",
                "breaking",
              ],
            ),
            migrationNotes: patterns.map(([pattern, label]) => ({
              label,
              evidence: outside
                .filter((entry) => {
                  const match = entry.text.match(pattern);
                  return Boolean(
                    match && entry.text.slice(match[0].length).trim(),
                  );
                })
                .map(asText),
            })),
          };
        });
        return {
          heading: asText(languageHeading),
          body: sectionBody(languageStart, languageEnd),
          releases,
        };
      });
      return {
        name,
        sections,
        selectedReleases:
          sections.length === 1
            ? (sections[0]?.releases ?? []).filter((release) =>
                release.heading.text.startsWith(`### ${options.version} `),
              )
            : [],
      };
    },
  );
  const result: Changelog = {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    rawLines: lines.map((text, index) => ({
      text,
      location: { path: captured.path, line: index + 1 },
    })),
    selectedVersion: options.version,
    languages,
  };
  const issues = validateChangelog(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

/**
 * 正本文書familyの全文・共通Header・局所不備を受け付ける。
 * @responsibility 取得済み断面からだけ宣言を捕捉し、集合相関はSemanticへ委ねる。
 * @trace ARCH-000008
 * @input source: 取得済み原文と相対Path。Header観測では元の限定断面だけを渡す。
 * @returns 全文・出典付きのCanonicalDocumentと局所Issue。
 * @precondition 取得範囲・文書の所在・文脈は利用側が確定している。
 * @postcondition 欠測や本文を推測補完せず、渡された内容だけを保持する。
 * @effect N/A: 同期値処理のみ。
 * @failure 解析例外は伝播し、不備でも部分内容を返す。
 * @invariant 状態だけtrimし、Candidate三形式の優先順とraw状態宣言を維持する。
 * @boundary 共通Headerを持つ文書familyと文書集合・公開版の比較。
 * @security 工程固有本文の検査済み・公開許可・Tag実在を示さない。
 * @concurrency N/A: 共有状態なし。
 */
export function parseCanonicalDocument(
  source: ArtifactSource,
): ParseResult<CanonicalDocument> & Readonly<{ result: CanonicalDocument }> {
  const captured = { path: source.path, content: source.content };
  const header = readCanonicalDocumentHeader(captured.content);
  const headerIndex = header
    ? captured.content
        .replace(/^\uFEFF/u, "")
        .split(/\r?\n/u)
        .indexOf(header.split("\n")[0] as string)
    : -1;
  if (header && headerIndex < 0)
    throw new Error("canonical_header_source_missing");
  const result: CanonicalDocument = {
    artifact: parseMarkdownArtifact(captured),
    source: captured,
    tableRows: captureDocumentTableRows(captured),
    rawLines: captured.content.split(/\r?\n/u).map((text, index) => ({
      text,
      location: { path: captured.path, line: index + 1 },
    })),
    header: header
      ? {
          text: header,
          location: { path: captured.path, line: headerIndex + 1 },
        }
      : null,
    version: header.match(/^Version:\s*(v[0-9]\S*)\s*$/m)?.[1] ?? null,
    status: header.match(/^Status:\s*(\S.*)\s*$/m)?.[1]?.trim() ?? null,
    releasedBaseline:
      header.match(/^Released Baseline:\s*(v[0-9]\S*)\s*$/m)?.[1] ?? null,
    candidateVersion:
      captured.content.match(/^Status: Candidate \((v[^,、)\s]+)/mu)?.[1] ??
      captured.content.match(/^状態: Candidate（(v[^,、）\s]+)/mu)?.[1] ??
      captured.content.match(
        /^Version: \*\*(v[^*\s]+) Candidate\*\*$/mu,
      )?.[1] ??
      null,
    releaseStates: Array.from(
      captured.content.matchAll(
        /^状態: `(?:Ready for Release Handoff|Released)`$/gmu,
      ),
      (match) => ({
        text: match[0],
        location: {
          path: captured.path,
          line: captured.content.slice(0, match.index).split("\n").length,
        },
      }),
    ),
  };
  const issues = validateCanonicalDocument(result);
  return { status: issues.length ? "partial" : "complete", result, issues };
}

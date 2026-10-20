/**
 * リリース文書の意味を検査する。
 * @responsibility 取得済み本文を解析し、中立Issueと観測件数を返す。
 * @trace ARCH-000008
 */
import type { DomainIssue } from "../outcome.ts";
import type { ArtifactSource } from "./types.ts";
import { parseMarkdownFences } from "./markdown.ts";
import type { MarkdownFenceLine } from "./types.ts";
/**
 * current-profileで使用するRelease Sectionの値契約を定義する。
 *
 * @responsibility Release SectionのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape ReleaseSectionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ReleaseSectionで宣言した値と責務の対応を維持する。
 * @boundary N/A: ReleaseSectionの宣言は外部境界を開かない。
 * @security N/A: ReleaseSectionはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ReleaseSectionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ReleaseSection = Readonly<{
  start: number;
  end: number;
  entries: MarkdownFenceLine[];
}>;

/**
 * CHANGELOGの現行版・二言語節・移行宣言と必要説明を検査する。
 * @responsibility CHANGELOGの現行版・二言語節・移行宣言と必要説明を検査する。
 * @trace ARCH-000008
 * @input artifact: CHANGELOG生本文と診断位置。currentVersion: 検査する版。
 * @returns 二言語節、移行宣言・分類・必要説明のIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不正条件はIssue。旧処理で解析を続けられない入力の例外は伝播する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectChangelogRelease(
  artifact: ArtifactSource,
  currentVersion: string,
) {
  const issues: DomainIssue[] = [];
  const sourcePath = artifact.path;
  const lines = artifact.content.split(/\r?\n/u);
  // Parse isFenced code once so headings, declarations, and migration-note
  // categories all use the same Markdown structure boundary. Only fence-free
  // lines and data inside a closed yaml/yml fence can be semantic inputs.
  const markdown = parseMarkdownFences(lines);
  const outsideEntries = markdown.entries.filter((entry) => entry.outside);
  const releaseSections = (
    languageHeading: string,
  ): Readonly<{
    languageCount: number;
    releases: ReleaseSection[];
  }> => {
    const languageStarts = outsideEntries.filter(
      (entry) => entry.text === `## ${languageHeading}`,
    );
    if (languageStarts.length !== 1) {
      return { languageCount: languageStarts.length, releases: [] };
    }
    const languageStart = (languageStarts[0] as MarkdownFenceLine).index;
    let languageEnd = lines.length;
    for (const entry of outsideEntries) {
      if (entry.index > languageStart && /^##\s+/u.test(entry.text)) {
        languageEnd = entry.index;
        break;
      }
    }
    const starts = outsideEntries
      .filter(
        (entry) =>
          entry.index > languageStart &&
          entry.index < languageEnd &&
          entry.text.startsWith(`### ${currentVersion} `),
      )
      .map((entry) => entry.index);
    const releases = starts.map((releaseStart) => {
      let releaseEnd = languageEnd;
      for (const entry of outsideEntries) {
        if (
          entry.index > releaseStart &&
          entry.index < languageEnd &&
          /^###\s+/u.test(entry.text)
        ) {
          releaseEnd = entry.index;
          break;
        }
      }
      return {
        start: releaseStart,
        end: releaseEnd,
        entries: markdown.entries.filter(
          (entry) => entry.index >= releaseStart && entry.index < releaseEnd,
        ),
      };
    });
    return { languageCount: 1, releases };
  };
  // Only a complete bullet inline-code declaration or a key inside a closed
  // yaml/yml fence is data. Prose, block quotes, other fences, and prior
  // release sections are intentionally not declarations.
  const declarations = (
    section: ReleaseSection,
    key: string,
    validValues: readonly string[],
  ):
    | Readonly<{ valid: false; reason: string }>
    | Readonly<{ valid: true; value: string }> => {
    const attempts: string[] = [];
    for (const entry of section.entries.filter(
      (candidate) => candidate.outside,
    )) {
      const match = entry.text.match(
        new RegExp(`^\\s*[-*+]\\s+\`${key}:\\s*([^\`]*)\`\\s*$`, "u"),
      );
      if (match) attempts.push((match[1] as string).trim());
    }
    const yamlFences = markdown.fences.filter(
      (fence) =>
        fence.start >= section.start &&
        fence.start < section.end &&
        ["yaml", "yml"].includes(fence.language),
    );
    if (yamlFences.some((fence) => !fence.closed)) {
      return { valid: false, reason: "unclosed-yaml-fence" };
    }
    for (const fence of yamlFences) {
      for (const entry of fence.contents) {
        const match = entry.text.match(
          new RegExp(`^\\s*${key}:\\s*([^#\\s]+)\\s*(?:#.*)?$`, "u"),
        );
        if (match) attempts.push((match[1] as string).trim());
      }
    }
    if (attempts.length !== 1 || !validValues.includes(attempts[0] as string)) {
      return {
        valid: false,
        reason: attempts.length === 0 ? "missing" : "invalid-or-multiple",
      };
    }
    return { valid: true, value: attempts[0] as string };
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
  const sections: Record<string, ReleaseSection> = {};
  for (const languageHeading of Object.keys(requiredMigrationMarkers)) {
    const located = releaseSections(languageHeading);
    if (located.languageCount !== 1) {
      issues.push({
        kind: "artifact.document-rule.current-changelog-release-missing",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "current-changelog-release-missing",
        details: {
          value0: String(languageHeading),
          value1: String(located.languageCount),
        },
      });
      continue;
    }
    if (located.releases.length !== 1) {
      issues.push({
        kind: "artifact.document-rule.current-changelog-release-missing-1",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "current-changelog-release-missing",
        details: {
          value0: String(languageHeading),
          value1: String(currentVersion),
          value2: String(located.releases.length),
        },
      });
      continue;
    }
    sections[languageHeading] = located.releases[0] as ReleaseSection;
  }
  const migration: Record<string, string> = {};
  for (const [languageHeading, section] of Object.entries(sections)) {
    const parsed = declarations(section, "migration_required", [
      "true",
      "false",
    ]);
    if (!parsed.valid) {
      issues.push({
        kind: "artifact.document-rule.migration-status-undetermined",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "migration-status-undetermined",
        details: {
          value0: String(languageHeading),
          value1: String(currentVersion),
          value2: String(parsed.reason),
        },
      });
      continue;
    }
    migration[languageHeading] = parsed.value;
  }
  if (
    Object.keys(migration).length === 2 &&
    migration.English !== migration.日本語
  ) {
    issues.push({
      kind: "artifact.document-rule.migration-status-mismatch",
      targetIdentity: sourcePath,
      location: { path: sourcePath },
      reason: "migration-status-mismatch",
      details: {
        value0: String(migration.English),
        value1: String(migration.日本語),
      },
    });
  } else if (migration.English === "true" && migration.日本語 === "true") {
    const classifications: Record<string, string> = {};
    for (const [languageHeading, section] of Object.entries(sections)) {
      const parsed = declarations(section, "change_classification", [
        "editorial",
        "clarification",
        "additive",
        "normative",
        "breaking",
      ]);
      if (!parsed.valid) {
        issues.push({
          kind: "artifact.document-rule.migration-status-undetermined-1",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "migration-status-undetermined",
          details: {
            value0: String(languageHeading),
            value1: String(currentVersion),
            value2: String(parsed.reason),
          },
        });
        continue;
      }
      classifications[languageHeading] = parsed.value;
    }
    if (
      Object.keys(classifications).length === 2 &&
      classifications.English !== classifications.日本語
    ) {
      issues.push({
        kind: "artifact.document-rule.migration-status-mismatch-1",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "migration-status-mismatch",
        details: {
          value0: String(classifications.English),
          value1: String(classifications.日本語),
        },
      });
    }
    for (const [languageHeading, markers] of Object.entries(
      requiredMigrationMarkers,
    )) {
      const section = sections[languageHeading] as ReleaseSection;
      const sectionLines = section.entries
        .filter((entry) => entry.outside)
        .map((entry) => entry.text);
      const missingMarkers = markers
        .filter(
          ([pattern]) =>
            !sectionLines.some((line) => {
              const match = line.match(pattern);
              return Boolean(match && line.slice(match[0].length).trim());
            }),
        )
        .map(([, label]) => label);
      if (missingMarkers.length === 0) continue;
      issues.push({
        kind: "artifact.document-rule.migration-note-incomplete",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "migration-note-incomplete",
        details: {
          value0: String(languageHeading),
          value1: String(currentVersion),
          value2: String(missingMarkers.join(", ")),
        },
      });
    }
  }

  return { issues };
}

/**
 * Candidate表示Headerの既存三形式から版を解析する。
 * @responsibility Candidate表示Headerの既存三形式から版を解析する。
 * @trace ARCH-000008
 * @input header: 先頭から取得したMarkdown表示Header。
 * @returns 既存三形式の最初の版文字列、またはnull。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 解析例外を伝播する。未一致はnullでありIssueは生成しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseCandidateVersionHeader(header: string): string | null {
  return (
    header.match(/^Status: Candidate \((v[^,、)\s]+)/mu)?.[1] ??
    header.match(/^状態: Candidate（(v[^,、）\s]+)/mu)?.[1] ??
    header.match(/^Version: \*\*(v[^*\s]+) Candidate\*\*$/mu)?.[1] ??
    null
  );
}
/**
 * READMEの先頭可視Headerから版を解析する。
 * @responsibility READMEの先頭可視Headerから版を解析する。
 * @trace ARCH-000008
 * @input content: README生本文。
 * @returns 最初の可視Headerが表す版、またはnull。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 解析例外を伝播する。未一致はnullでありIssueは生成しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function parseReadmeVersion(content: string): string | null {
  const markdown = parseMarkdownFences(
    content.replace(/^\uFEFF/u, "").split(/\r?\n/u),
  );
  let hasTitle = false;
  for (const entry of markdown.entries) {
    if (!entry.outside) continue;
    const line = entry.text;
    if (line.trim() === "" || /^<a id="[^"]+"><\/a>$/u.test(line)) continue;
    if (!hasTitle && /^#\s+\S/u.test(line)) {
      hasTitle = true;
      continue;
    }
    if (/^\*\*[^*]+\*\*[ \t]*$/u.test(line)) continue;
    const match = line.match(
      /^(?:Version|Status):[ \t]*(?:\*\*(v[0-9][^\s*]*)(?:[ \t]+[^*]*)?\*\*|(v[0-9][^\s*]*)(?:[ \t]+[^*]*)?)[ \t]*$/u,
    );
    return match?.[1] ?? match?.[2] ?? null;
  }
  return null;
}
/**
 * 正本文書の版・Candidate状態・Released Baselineの相関を検査する。
 * @responsibility 正本文書の版・Candidate状態・Released Baselineの相関を検査する。
 * @trace ARCH-000008
 * @input versionedDocuments: 位置と版の組。canonicalDocumentStates: 位置・版・状態・Baselineの観測列。
 * @returns 版集合、CandidateのReleased BaselineとIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致はIssueで返す。既存のBaseline取得不能例外は伝播する。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectCanonicalDocumentVersions(
  versionedDocuments: readonly (readonly [string, string])[],
  canonicalDocumentStates: readonly Readonly<{
    file: string;
    version: string | null;
    status: string | null;
    releasedBaseline: string | null;
  }>[],
) {
  const issues: DomainIssue[] = [];
  const versions = new Set(versionedDocuments.map(([, version]) => version));
  if (versions.size > 1) {
    for (const [file, version] of versionedDocuments) {
      issues.push({
        kind: "artifact.document-identity.version-mismatch",
        targetIdentity: file,
        location: { path: file },
        reason: "version-mismatch",
        details: {
          value0: String(version),
          value1: String(JSON.stringify([...versions].sort())),
        },
      });
    }
  }
  const candidateDocuments = canonicalDocumentStates.filter(
    ({ status }) => status === "Candidate",
  );
  for (const { file, status, releasedBaseline } of canonicalDocumentStates) {
    if (status !== "Candidate" && releasedBaseline) {
      issues.push({
        kind: "artifact.document-identity.released-baseline-outside-candidate",
        targetIdentity: file,
        location: { path: file },
        reason: "released-baseline-outside-candidate",
        details: { value0: String(status ?? "missing") },
      });
    }
  }
  let candidateReleasedBaseline: string | null = null;
  if (candidateDocuments.length > 0) {
    if (candidateDocuments.length !== canonicalDocumentStates.length) {
      for (const { file, status } of canonicalDocumentStates) {
        issues.push({
          kind: "artifact.document-identity.candidate-status-mismatch",
          targetIdentity: file,
          location: { path: file },
          reason: "candidate-status-mismatch",
          details: { value0: String(status ?? "missing") },
        });
      }
    }
    const baselines = new Set(
      candidateDocuments
        .map(({ releasedBaseline }) => releasedBaseline)
        .filter((value): value is string => typeof value === "string"),
    );
    if (
      baselines.size !== 1 ||
      candidateDocuments.some(({ releasedBaseline }) => !releasedBaseline)
    ) {
      for (const { file, releasedBaseline } of candidateDocuments) {
        issues.push({
          kind: "artifact.document-identity.candidate-released-baseline-mismatch",
          targetIdentity: file,
          location: { path: file },
          reason: "candidate-released-baseline-mismatch",
          details: {
            value0: String(releasedBaseline ?? "missing"),
            value1: String(JSON.stringify([...baselines].sort())),
          },
        });
      }
    } else {
      const [releasedBaseline] = baselines;
      if (releasedBaseline === undefined) {
        throw new Error("candidate_released_baseline_missing");
      }
      candidateReleasedBaseline = releasedBaseline;
      if (versions.has(releasedBaseline)) {
        for (const { file } of candidateDocuments) {
          issues.push({
            kind: "artifact.document-identity.candidate-version-equals-released-baseline",
            targetIdentity: file,
            location: { path: file },
            reason: "candidate-version-equals-released-baseline",
            details: { value0: String(candidateReleasedBaseline) },
          });
        }
      }
    }
  }

  return { versions, candidateReleasedBaseline, issues };
}

/**
 * Stable版の正本文書集合が同じ版とStable状態で揃うことを検査する。
 * @responsibility Stable版の正本文書集合が同じ版とStable状態で揃うことを検査する。
 * @trace ARCH-000008
 * @input canonicalDocumentStates: 文書位置・版・状態の観測列。stableVersion: 期待するStable版。
 * @returns Stable版・状態に揃わない文書のIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectStableCanonicalDocuments(
  canonicalDocumentStates: readonly Readonly<{
    file: string;
    version: string | null;
    status: string | null;
  }>[],
  stableVersion: string,
) {
  const issues: DomainIssue[] = [];
  for (const document of canonicalDocumentStates) {
    if (document.status === "Stable" && document.version === stableVersion) {
      continue;
    }
    issues.push({
      kind: "artifact.stable-release.stable-release-canonical-status-mismatch",
      targetIdentity: document.file,
      location: { path: document.file },
      reason: "stable-release-canonical-status-mismatch",
      details: { value0: String(stableVersion) },
    });
  }

  return { issues };
}
/**
 * Stable版READMEの版表示とCandidate残留を検査する。
 * @responsibility Stable版READMEの版表示とCandidate残留を検査する。
 * @trace ARCH-000008
 * @input artifact: README生本文と位置。stableVersion: 期待するStable版。
 * @returns 版表示不足・Candidate残留のIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectStableReadme(
  artifact: ArtifactSource,
  stableVersion: string,
) {
  const issues: DomainIssue[] = [];
  const readme = artifact.content,
    readmePath = artifact.path;
  if (!readme.includes(`Version: **${stableVersion}**`)) {
    issues.push({
      kind: "artifact.stable-release.stable-release-readme-version-mismatch",
      targetIdentity: readmePath,
      location: { path: readmePath },
      reason: "stable-release-readme-version-mismatch",
      details: { value0: String(stableVersion) },
    });
  }
  const readmeHeader = readme.split(/\r?\n/u).slice(0, 20).join("\n");
  if (/\bCandidate\b|^Released Baseline:/mu.test(readmeHeader)) {
    issues.push({
      kind: "artifact.stable-release.stable-release-readme-candidate-residue",
      targetIdentity: readmePath,
      location: { path: readmePath },
      reason: "stable-release-readme-candidate-residue",
      details: {},
    });
  }

  return { issues };
}
/**
 * Stable版CHANGELOGの二言語見出しと日付の一致を検査する。
 * @responsibility Stable版CHANGELOGの二言語見出しと日付の一致を検査する。
 * @trace ARCH-000008
 * @input artifact: CHANGELOG生本文と位置。stableVersion: 期待するStable版。
 * @returns 二見出し・共有日付の条件不一致Issue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返す。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectStableChangelog(
  artifact: ArtifactSource,
  stableVersion: string,
) {
  const issues: DomainIssue[] = [];
  const changelog = artifact.content,
    changelogPath = artifact.path;
  const escapedStableVersion = stableVersion.replace(
    /[.*+?^${}()|[\]\\]/gu,
    "\\$&",
  );
  const releaseHeadingMatches = [
    ...changelog.matchAll(
      new RegExp(
        `^### ${escapedStableVersion} — (\\d{4}-\\d{2}-\\d{2})$`,
        "gmu",
      ),
    ),
  ];
  const releaseDates = new Set(
    releaseHeadingMatches.map((match) => match[1]).filter(Boolean),
  );
  if (releaseHeadingMatches.length !== 2 || releaseDates.size !== 1) {
    issues.push({
      kind: "artifact.stable-release.stable-release-changelog-bilingual-closure-mismatch",
      targetIdentity: changelogPath,
      location: { path: changelogPath },
      reason: "stable-release-changelog-bilingual-closure-mismatch",
      details: {
        value0: String(stableVersion),
        value1: String(releaseHeadingMatches.length),
        value2: String(releaseDates.size),
      },
    });
  }

  return { issues };
}
/**
 * Stable版のMarkdown Headerと変更記録からCandidate残留・公開状態を検査する。
 * @responsibility Stable版のMarkdown Headerと変更記録からCandidate残留・公開状態を検査する。
 * @trace ARCH-000008
 * @input header: 取得済み先頭16行。file: Repository相対位置。stableVersion: 期待する版。stableTagCommit: 観測済みTag Commitまたはnull。
 * @returns Candidate残留・変更記録の未準備・Tag以前の公開主張のIssue。
 * @precondition 必要な本文と集合は呼出し元が取得している。
 * @postcondition 入力を変更せず、追加のFile読取りを行わない。
 * @effect N/A: 同期的な値処理だけを行う。
 * @failure 不一致をIssueで返す。Tag未観測を存在ありへ補完しない。
 * @invariant 旧本文条件と短絡評価順を維持する。
 * @boundary N/A: Process内の文書意味検査。
 * @security 認可、実在、実行許可または品質全体の成立を保証しない。
 * @concurrency N/A: 共有可変状態を持たない。
 */
export function inspectStableReleaseHeader(
  header: string,
  file: string,
  stableVersion: string,
  stableTagCommit: string | null,
) {
  const issues: DomainIssue[] = [];
  if (parseCandidateVersionHeader(header) === stableVersion) {
    issues.push({
      kind: "artifact.stable-release.stable-release-candidate-residue",
      targetIdentity: file,
      location: { path: file },
      reason: "stable-release-candidate-residue",
      details: { value0: String(stableVersion) },
    });
  }
  const isChangeTraceForStableRelease =
    /^99_Roadmap\/Changes\/CHG-[0-9]{6}\/change\.md$/u.test(file);
  if (!isChangeTraceForStableRelease) return { issues };
  if (!header.includes(`対象版: \`${stableVersion}\``)) return { issues };
  const isReadyForRelease = /^状態: `Ready for Release Handoff`$/mu.test(
    header,
  );
  const released = /^状態: `Released`$/mu.test(header);
  if (!isReadyForRelease && !released) {
    issues.push({
      kind: "artifact.stable-release.stable-release-change-trace-not-ready",
      targetIdentity: file,
      location: { path: file },
      reason: "stable-release-change-trace-not-ready",
      details: { value0: String(stableVersion) },
    });
  }
  if (released && stableTagCommit === null) {
    issues.push({
      kind: "artifact.stable-release.stable-release-change-trace-premature-release",
      targetIdentity: file,
      location: { path: file },
      reason: "stable-release-change-trace-premature-release",
      details: { value0: String(stableVersion) },
    });
  }
  return { issues };
}

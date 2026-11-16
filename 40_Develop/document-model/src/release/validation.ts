/**
 * リリース文書の意味を検査する。
 * @responsibility 取得済み本文を解析し、中立Issueと観測件数を返す。
 * @trace ARCH-000008
 */

import type { DocumentIssue } from "../artifact/types.ts";
import type {
  CanonicalDocument,
  Changelog,
  ChangelogRelease,
} from "./types.ts";
/**
 * 指定版のCHANGELOG文書内契約を捕捉済み内容から検査する。
 * @responsibility 言語・版節数・宣言・二言語相関・必要説明の既存順を所有する。
 * @trace ARCH-000008
 * @input changelog: Parserが捕捉した全節と明示した診断対象版。
 * @returns 文書単体の中立Issue。
 * @effect N/A: モデル値だけを扱い、原文やFileを再解析しない。
 * @failure 既存の不正理由を保持し、不足を補完しない。
 * @invariant 診断対象外の過去版を新たに合否判定しない。
 */
export function validateChangelog(
  changelog: Changelog,
): readonly DocumentIssue[] {
  const issues: DocumentIssue[] = [];
  const sourcePath = changelog.source.path;
  const currentVersion = changelog.selectedVersion;
  const sections: Record<string, ChangelogRelease> = {};
  for (const located of changelog.languages) {
    const languageHeading = located.name;
    if (located.sections.length !== 1) {
      issues.push({
        kind: "artifact.document-rule.current-changelog-release-missing",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "current-changelog-release-missing",
        details: {
          value0: String(languageHeading),
          value1: String(located.sections.length),
        },
      });
      continue;
    }
    if (located.selectedReleases.length !== 1) {
      issues.push({
        kind: "artifact.document-rule.current-changelog-release-missing-1",
        targetIdentity: sourcePath,
        location: { path: sourcePath },
        reason: "current-changelog-release-missing",
        details: {
          value0: String(languageHeading),
          value1: String(currentVersion),
          value2: String(located.selectedReleases.length),
        },
      });
      continue;
    }
    sections[languageHeading] = located.selectedReleases[0] as ChangelogRelease;
  }
  const migration: Record<string, string> = {};
  for (const [languageHeading, section] of Object.entries(sections)) {
    const parsed = section.migrationRequired;
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
      const parsed = section.changeClassification;
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
    for (const language of changelog.languages) {
      const languageHeading = language.name;
      const section = sections[languageHeading] as ChangelogRelease;
      const missingMarkers = section.migrationNotes
        .filter((note) => note.evidence.length === 0)
        .map((note) => note.label);
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

  return issues;
}

/**
 * 正本文書だけで判断できるBaseline処置を検査する。
 * @responsibility 単体で確定するBaseline欠測・自己同一・用途外宣言を返す。
 * @trace ARCH-000008
 * @input document: 捕捉済みの正本文書モデル。
 * @returns 旧契約の中立Issue。
 * @effect N/A: モデル値のみ。
 * @failure 不備を補完しない。
 */
export function validateCanonicalDocument(
  document: CanonicalDocument,
): readonly DocumentIssue[] {
  if (document.status === "Candidate") {
    if (!document.releasedBaseline) {
      return [
        {
          kind: "artifact.document-identity.candidate-released-baseline-mismatch",
          targetIdentity: document.source.path,
          location: { path: document.source.path },
          reason: "candidate-released-baseline-mismatch",
          details: { value0: "missing", value1: "[]" },
        },
      ];
    }
    if (document.version === document.releasedBaseline) {
      return [
        {
          kind: "artifact.document-identity.candidate-version-equals-released-baseline",
          targetIdentity: document.source.path,
          location: { path: document.source.path },
          reason: "candidate-version-equals-released-baseline",
          details: { value0: document.releasedBaseline },
        },
      ];
    }
    return [];
  }
  if (!document.releasedBaseline) return [];
  return [
    {
      kind: "artifact.document-identity.released-baseline-outside-candidate",
      targetIdentity: document.source.path,
      location: { path: document.source.path },
      reason: "released-baseline-outside-candidate",
      details: { value0: String(document.status ?? "missing") },
    },
  ];
}

/**
 * リリース文書の意味を検査する。
 * @responsibility 取得済み内容モデルの単体条件・版集合・Stable観測との整合を検査する。
 * @trace ARCH-000008
 */

import type { DocumentIssue, ParseResult } from "../artifact/types.ts";
import type {
  CanonicalDocument,
  Changelog,
  ChangelogRelease,
  ReleaseConsistencyRequest,
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

/**
 * 正本文書の解析結果から版・Candidate相関とStable観測候補を導出する。
 * @responsibility 並行する手製DTOを受けず、実モデルの同じ断面から集合と診断を構築する。
 * @trace ARCH-000008
 * @input documents: 同じ取得から構築された正本文書のParse結果列。
 * @returns 版集合・Candidate Baseline・Stable候補版と順序付きIssue。
 * @precondition 取得・Root・文書列挙・適用範囲は利用側が所有する。
 * @postcondition 版不一致→局所Baseline不備→Candidate相関の順を維持する。
 * @effect N/A: モデル値だけを扱う。
 * @failure 既存の候補版取得不能を例外とし、欠測を補完しない。
 * @invariant Stable候補は純粋な宣言の相関であり、official／scope／Gitを観測しない。
 * @boundary 完成Parseと文書集合の関係評価。
 * @security 候補版や空Issueを品質成立・公開・実行許可へ昇格しない。
 * @concurrency N/A: 共有状態なし。
 */
export function inspectReleaseDocuments(
  documents: readonly (ParseResult<CanonicalDocument> &
    Readonly<{ result: CanonicalDocument }>)[],
): Readonly<{
  versions: ReadonlySet<string>;
  versionedDocumentCount: number;
  candidateReleasedBaseline: string | null;
  stableVersion: string | null;
  issues: readonly DocumentIssue[];
}> {
  const issues: DocumentIssue[] = [];
  const models = documents.map((document) => document.result);
  const versions = new Set(
    models.flatMap((document) =>
      document.version === null ? [] : [document.version],
    ),
  );
  if (versions.size > 1) {
    for (const document of models) {
      const { version } = document;
      if (version === null) continue;
      const file = document.source.path;
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
  const candidateDocuments = models.filter(
    ({ status }) => status === "Candidate",
  );
  // Candidate局所不備は下の集合文脈で再構成し、件数・順序・集合値を保つ。
  for (const document of documents) {
    issues.push(
      ...document.issues.filter(
        (issue) =>
          issue.kind ===
          "artifact.document-identity.released-baseline-outside-candidate",
      ),
    );
  }
  let candidateReleasedBaseline: string | null = null;
  if (candidateDocuments.length > 0) {
    if (candidateDocuments.length !== models.length) {
      for (const document of models) {
        const file = document.source.path;
        const status = document.status;
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
      for (const document of candidateDocuments) {
        const file = document.source.path;
        const releasedBaseline = document.releasedBaseline;
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
        for (const document of candidateDocuments) {
          const file = document.source.path;
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

  const stableDocuments = models.filter(
    (document) => document.status === "Stable",
  );
  let stableVersion: string | null = null;
  if (
    models.length > 1 &&
    stableDocuments.length > 0 &&
    new Set(stableDocuments.map((document) => document.version)).size === 1 &&
    stableDocuments.every((document) => document.version !== null) &&
    versions.size === 1
  ) {
    const selected = [...versions][0];
    if (selected === undefined)
      throw new Error("stable_release_version_missing");
    stableVersion = selected;
  }
  return {
    versions,
    versionedDocumentCount: models.filter(
      (document) => document.version !== null,
    ).length,
    candidateReleasedBaseline,
    stableVersion,
    issues,
  };
}

/**
 * 取得済みReleaseモデルと版・Tag観測の整合を評価する。
 * @responsibility 同じドメインの四条件を元の診断順で評価し、外部観測を開始しない。
 * @trace ARCH-000008
 * @input request: 正本集合、限定取得断面、READMEまたはCHANGELOGと観測済み版。
 * @returns 既存の診断列。空列を公開・品質Passへ昇格しない。
 * @effect N/A: 取得済みモデル値だけを扱う。
 * @failure 未知kindは拒否し、空成功や他の評価へ切り替えない。
 * @boundary Parser・Git観測・表示から独立したReleaseの値整合。
 */
export function inspectReleaseConsistency(
  request: ReleaseConsistencyRequest,
): readonly DocumentIssue[] {
  switch (request.kind) {
    case "stable_canonical_documents": {
      const issues: DocumentIssue[] = [];
      for (const document of request.documents) {
        if (
          document.status === "Stable" &&
          document.version === request.stableVersion
        ) {
          continue;
        }
        issues.push({
          kind: "artifact.stable-release.stable-release-canonical-status-mismatch",
          targetIdentity: document.source.path,
          location: { path: document.source.path },
          reason: "stable-release-canonical-status-mismatch",
          details: { value0: String(request.stableVersion) },
        });
      }

      return issues;
    }
    case "stable_release_document": {
      const issues: DocumentIssue[] = [];
      const header = request.document.source.content;
      const file = request.document.source.path;
      const stableVersion = request.stableVersion;
      const stableTagCommit = request.stableTagCommit;
      if (request.document.candidateVersion === stableVersion) {
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
      if (!isChangeTraceForStableRelease) return issues;
      if (!header.includes(`対象版: \`${stableVersion}\``)) return issues;
      const isReadyForRelease = request.document.releaseStates.some(
        (entry) => entry.text === "状態: `Ready for Release Handoff`",
      );
      const released = request.document.releaseStates.some(
        (entry) => entry.text === "状態: `Released`",
      );
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
      return issues;
    }
    case "stable_changelog": {
      const issues: DocumentIssue[] = [];
      const changelog = request.changelog.source.content,
        changelogPath = request.changelog.source.path;
      const stableVersion = request.stableVersion;
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

      return issues;
    }
    case "stable_readme": {
      const issues: DocumentIssue[] = [];
      const sourcePath = request.readme.source.path;
      if (
        !request.readme.source.content.includes(
          `Version: **${request.stableVersion}**`,
        )
      )
        issues.push({
          kind: "artifact.stable-release.stable-release-readme-version-mismatch",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "stable-release-readme-version-mismatch",
          details: { value0: String(request.stableVersion) },
        });
      if (request.readme.candidateDeclarations.length > 0)
        issues.push({
          kind: "artifact.stable-release.stable-release-readme-candidate-residue",
          targetIdentity: sourcePath,
          location: { path: sourcePath },
          reason: "stable-release-readme-candidate-residue",
          details: {},
        });
      return issues;
    }

    default:
      throw new Error("release_consistency_kind_invalid");
  }
}

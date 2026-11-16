/**
 * work-lifecycle成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */

import fs from "node:fs";
import path from "node:path";
import {
  inspectChangeNavigation,
  inspectReleaseConsistency,
  parseArchitectureIndex,
  parseCanonicalDocument,
  parseChangeDocument,
  parseChangeIndex,
  parseCommunication,
  parseSpecSequence,
  parseUiIndex,
} from "../../../document-model/src/index.ts";
import { mapChangeDomainIssueToFinding } from "../report/convert.ts";
import {
  mapStableReleaseIssueToFinding,
  mapTemplateIssueToFinding,
} from "../report/document.ts";
import type { DocumentFinding } from "../report/types.ts";
import { lstatIfPresent } from "../repository/observe.ts";

/**
 * work-lifecycle成果物を観測し、本文・関係の意味をDomainへ渡す。
 * @responsibility 工程固有の観測順・短絡・再読取りと診断の配送を所有する。
 * @trace ARCH-000001
 * @input root: 検査Root。repositoryMode: 既存の適用モード。findings: 呼出し元が所有する追記先。
 * @returns N/A: 診断をfindingsへ出現順に追記する。
 * @precondition Rootと適用モードは呼出し元が観測済みである。
 * @postcondition 本文意味を再実装せず、観測済み値をDomainへ渡す。
 * @effect Filesystemを同期読取りし、局所の診断配列へ追記する。保存・外部送信なし。
 * @failure 観測・解析例外は伝播し、それまでの診断を破棄・正常化しない。
 * @invariant 不存在時の省略、途中return、同File再読取り、診断順を維持する。
 * @boundary Repository観測とDomain本文モデルの境界。
 * @security 新しいRoot、Authority、Reader、Snapshot、Registryを作らない。
 * @concurrency 同じ起動内の同期観測。共有Lock・永続状態は持たない。
 */
export function inspectWorkLifecycleRepository(
  root: string,
  repositoryMode: string,
  findings: DocumentFinding[],
): void {
  const add = (severity: string, code: string, file: string, message: string) =>
    findings.push({ severity, code, path: file, message });
  const relative = (file: string) =>
    path.relative(root, file).replaceAll("\\", "/") || ".";
  const read = (file: string) => fs.readFileSync(file, "utf8");

  if (repositoryMode === "generic") return;
  for (const legacyPath of [
    "90_Release",
    "07_Quality/Verification_Results",
    "template/90_Release",
    "template/07_Quality/Verification_Results",
  ]) {
    if (fs.existsSync(path.join(root, legacyPath)))
      add(
        "error",
        "legacy-work-lifecycle-path-present",
        legacyPath,
        "A legacy Work Lifecycle or centralized verification-results path must not be recreated.",
      );
  }
  const changesRoot = path.join(root, "99_Roadmap", "Changes");
  const changeIndexPath = path.join(root, "99_Roadmap", "02_Changes.md");
  if (
    !lstatIfPresent(changesRoot)?.isDirectory() ||
    !fs.existsSync(changeIndexPath)
  )
    return;
  const aggregateIds = fs
    .readdirSync(changesRoot, { withFileTypes: true })
    .filter(
      (entry) => entry.isDirectory() && /^CHG-[0-9]{6}$/u.test(entry.name),
    )
    .filter((entry) =>
      lstatIfPresent(path.join(changesRoot, entry.name, "change.md"))?.isFile(),
    )
    .map((entry) => entry.name)
    .sort();
  for (const aggregateId of aggregateIds) {
    const changePath = path.join(changesRoot, aggregateId, "change.md");
    const change = read(changePath);
    for (const issue of parseChangeDocument(
      { path: relative(changePath), content: change },
      { mode: "canonical", expectedIdentity: aggregateId },
    ).issues) {
      const finding = mapChangeDomainIssueToFinding(issue);
      add(finding.severity, finding.code, finding.path, finding.message);
    }
  }
  if (repositoryMode === "official") {
    const changeTemplatePath = path.join(
      root,
      "template",
      "99_Roadmap",
      "Changes",
      "CHG-XXXXXX",
      "change.md",
    );
    if (lstatIfPresent(changeTemplatePath)?.isFile()) {
      const changeTemplate = read(changeTemplatePath);
      for (const issue of parseChangeDocument(
        { path: relative(changeTemplatePath), content: changeTemplate },
        { mode: "template" },
      ).issues) {
        const finding = mapChangeDomainIssueToFinding(issue);
        add(finding.severity, finding.code, finding.path, finding.message);
      }
      for (const [templatePath, parse] of [
        [
          path.join(root, "template", "04_UI", "01_User_Interface.md"),
          parseUiIndex,
        ],
        [
          path.join(root, "template", "06_Architecture", "01_Architecture.md"),
          parseArchitectureIndex,
        ],
      ] as const) {
        if (!lstatIfPresent(templatePath)?.isFile()) continue;
        const parsed = parse(
          { path: relative(templatePath), content: read(templatePath) },
          { mode: "template" },
        );
        for (const issue of parsed.issues.filter(
          (issue) => issue.kind === "artifact.template.authority-invalid",
        )) {
          const finding = mapTemplateIssueToFinding(issue);
          add(finding.severity, finding.code, finding.path, finding.message);
        }
      }
      for (const [templatePath, parse] of [
        [
          path.join(
            root,
            "template",
            "80_Communication",
            "01_Communication.md",
          ),
          parseCommunication,
        ],
        [
          path.join(root, "template", "05_SPEC", "04_Actor_System_Sequence.md"),
          parseSpecSequence,
        ],
      ] as const) {
        if (!lstatIfPresent(templatePath)?.isFile()) continue;
        for (const issue of parse(
          { path: relative(templatePath), content: read(templatePath) },
          { mode: "template" },
        ).issues) {
          const finding = mapTemplateIssueToFinding(issue);
          add(finding.severity, finding.code, finding.path, finding.message);
        }
      }
    }
  }
  const index = read(changeIndexPath);
  const navigation = parseChangeIndex({
    path: relative(changeIndexPath),
    content: index,
  });
  for (const issue of [
    ...navigation.issues,
    ...inspectChangeNavigation({
      index: navigation.result,
      observedChangeIds: aggregateIds,
    }),
  ]) {
    const finding = mapChangeDomainIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }

  const releaseIndexPath = path.join(root, "99_Roadmap", "03_Releases.md");
  const releasesRoot = path.join(root, "99_Roadmap", "Releases");
  if (
    !fs.existsSync(releaseIndexPath) ||
    !lstatIfPresent(releasesRoot)?.isDirectory()
  )
    return;
  const releaseIndex = read(releaseIndexPath);
  const evidencePaths: string[] = [];
  for (const version of fs.readdirSync(releasesRoot, {
    withFileTypes: true,
  })) {
    if (!version.isDirectory()) continue;
    const evidenceRoot = path.join(releasesRoot, version.name, "Evidence");
    if (!lstatIfPresent(evidenceRoot)?.isDirectory()) continue;
    for (const evidence of fs.readdirSync(evidenceRoot, {
      withFileTypes: true,
    })) {
      if (evidence.isFile())
        evidencePaths.push(
          `./Releases/${version.name}/Evidence/${evidence.name}`,
        );
    }
  }
  for (const issue of inspectReleaseConsistency({
    kind: "release_evidence_navigation",
    index: parseCanonicalDocument({
      path: relative(releaseIndexPath),
      content: releaseIndex,
    }).result,
    evidencePaths,
  })) {
    const finding = mapStableReleaseIssueToFinding(issue);
    add(finding.severity, finding.code, finding.path, finding.message);
  }
}

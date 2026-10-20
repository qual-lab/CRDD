/**
 * work-lifecycle成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */
import type { DocumentFinding } from "../report/types.ts";

import { lstatIfPresent } from "../repository/observe.ts";

import fs from "node:fs";
import path from "node:path";

import {
  inspectChangeDocument,
  isChangeTemplateInvalid,
  isChangeNavigationInvalid,
} from "../../../domain-model/src/index.ts";
import { mapChangeDomainIssueToFinding } from "../report/convert.ts";

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
    for (const issue of inspectChangeDocument(
      { path: relative(changePath), content: change },
      aggregateId,
    )) {
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
      if (isChangeTemplateInvalid(changeTemplate)) {
        add(
          "error",
          "change-impact-files-template-mismatch",
          relative(changeTemplatePath),
          "The official Change template must expose the canonical exhaustive impact-file section and the Phase/Gate/scope-extension/plan-revision evaluation contract.",
        );
      }
      for (const templatePath of [
        path.join(root, "template", "04_UI", "01_User_Interface.md"),
        path.join(root, "template", "06_Architecture", "01_Architecture.md"),
      ]) {
        if (!lstatIfPresent(templatePath)?.isFile()) continue;
        const template = read(templatePath);
        if (
          !/^維持責任者: \S+/mu.test(template) ||
          !/^基本決定権限: \S+/mu.test(template) ||
          !/^項目別例外Authority: \S+/mu.test(template) ||
          /項目の決定権限: 必要に応じて/mu.test(template)
        )
          add(
            "error",
            "mandatory-authority-evaluation-template-invalid",
            relative(templatePath),
            "The official UI and Architecture root templates must require an owner, a default authority, and an evaluated item-specific authority exception.",
          );
      }
      for (const [templatePath, requiredFragments] of [
        [
          path.join(
            root,
            "template",
            "80_Communication",
            "01_Communication.md",
          ),
          [
            "## 認知意図",
            "## 市場・採用探索",
            "## 人間対象調査",
            "適用判定: `<Applicable／N/A: 理由／OPEN: 理由・確認先・再評価契機>`",
          ],
        ],
        [
          path.join(root, "template", "05_SPEC", "04_Actor_System_Sequence.md"),
          [
            "要求、受理、Effect、結果観測および終了を全数評価し、統合する段階には理由を記録した",
          ],
        ],
      ] as const) {
        if (!lstatIfPresent(templatePath)?.isFile()) continue;
        const template = read(templatePath);
        if (
          requiredFragments.some((fragment) => !template.includes(fragment)) ||
          /## (?:認知意図|市場・採用探索)（該当する場合）/u.test(template) ||
          /必要に応じて分けた/u.test(template)
        )
          add(
            "error",
            "mandatory-applicability-template-invalid",
            relative(templatePath),
            "Conditional communication and sequence concerns must keep a visible mandatory applicability evaluation instead of a vague optional instruction.",
          );
      }
    }
  }
  const index = read(changeIndexPath);
  if (isChangeNavigationInvalid(index, aggregateIds))
    add(
      "error",
      "change-navigation-population-mismatch",
      relative(changeIndexPath),
      "The Change navigation must reference every ID-only Change aggregate exactly once and no unknown aggregate.",
    );

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
  if (
    evidencePaths.some(
      (evidencePath) => releaseIndex.split(evidencePath).length - 1 !== 1,
    )
  )
    add(
      "error",
      "release-evidence-navigation-incomplete",
      relative(releaseIndexPath),
      "Every Release-owned Evidence file must have one exact navigation link.",
    );
}

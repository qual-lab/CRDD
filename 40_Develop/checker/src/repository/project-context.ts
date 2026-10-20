/**
 * project-context成果物のRepository観測とDomain検査接続を所有する。
 * @responsibility 対象列挙・実在確認・読取り・部分診断の追記を従来順で行う。
 * @trace ARCH-000001
 */
import type { DocumentFinding } from "../report/types.ts";

import {
  lstatIfPresent,
  pathContainsSymbolicLink,
} from "../repository/observe.ts";

import fs from "node:fs";
import path from "node:path";

import { verifyRepositoryRoot } from "../../../version-control/src/index.ts";
import {
  isProjectContextProjectionInvalid,
  isProjectContextManifestIdentityInvalid,
  resolveRepositoryRuntimeDataPaths,
} from "../../../domain-model/src/index.ts";

/**
 * project-context成果物を観測し、本文・関係の意味をDomainへ渡す。
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
export function inspectProjectContextRepository(
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
  const repositoryProjectionPath = path.join(root, "PROJECT_CONTEXT.md");
  const templateProjectionPath = path.join(
    root,
    "template",
    "PROJECT_CONTEXT.md",
  );
  const hasRepositoryProjection = Boolean(
    lstatIfPresent(repositoryProjectionPath),
  );
  const hasTemplateProjection = Boolean(lstatIfPresent(templateProjectionPath));
  if (repositoryMode === "adopter" && !hasRepositoryProjection) return;
  if (
    repositoryMode === "official" &&
    !hasRepositoryProjection &&
    !hasTemplateProjection
  )
    return;
  const targets =
    repositoryMode === "official"
      ? [
          { file: repositoryProjectionPath, template: false },
          {
            file: templateProjectionPath,
            template: true,
          },
        ]
      : [{ file: repositoryProjectionPath, template: false }];
  for (const target of targets) {
    const stat = lstatIfPresent(target.file);
    if (!stat?.isFile() || pathContainsSymbolicLink(root, target.file)) {
      add(
        "error",
        "project-context-projection-missing",
        relative(target.file),
        "Repository Project Context must exist as a regular file at the repository root.",
      );
      continue;
    }
    const content = read(target.file);
    if (isProjectContextProjectionInvalid(content, target.template)) {
      add(
        "error",
        "project-context-projection-contract-invalid",
        relative(target.file),
        "Project Context must keep the three identity fields, the five ordered scenes, and the complete visible Checklist.",
      );
    }
    if (!target.template) {
      const verifiedRoot = verifyRepositoryRoot(root);
      const runtimePaths =
        verifiedRoot.status === "completed"
          ? resolveRepositoryRuntimeDataPaths(verifiedRoot.capability)
          : null;
      const manifestPath = runtimePaths?.repositoryManifest;
      if (!manifestPath) {
        add(
          "error",
          "project-context-repository-root-unverified",
          ".",
          "Project Context identity verification requires a verified Repository Root and its named Repository Manifest path.",
        );
        continue;
      }
      const manifestStat = lstatIfPresent(manifestPath);
      if (
        !manifestStat?.isFile() ||
        pathContainsSymbolicLink(root, manifestPath)
      ) {
        add(
          "error",
          "project-context-manifest-missing",
          relative(manifestPath),
          "A repository with PROJECT_CONTEXT.md must keep its Repository Manifest as a regular file.",
        );
        continue;
      }
      try {
        const manifest = JSON.parse(read(manifestPath)) as Record<
          string,
          unknown
        >;
        if (isProjectContextManifestIdentityInvalid(content, manifest))
          add(
            "error",
            "project-context-manifest-identity-mismatch",
            relative(target.file),
            "Project Context identity fields must exactly match the v2 Repository Manifest.",
          );
      } catch {
        add(
          "error",
          "project-context-manifest-invalid",
          relative(manifestPath),
          "Repository Manifest must be valid JSON before Project Context identity can be verified.",
        );
      }
    }
  }
}

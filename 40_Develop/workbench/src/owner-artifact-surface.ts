/**
 * WorkbenchのOwner Artifact読取り投影。
 *
 * @packageDocumentation
 * @responsibility Project Contextが明示するOwner Relationと固定Root Artifactを、Repository越境なしの読取りCatalogへ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @boundary Repository MarkdownとWorkbench Owner Artifact表示の境界。
 * @effect 検証済みRepository内の宣言済みMarkdownだけを読取る。
 * @security 任意Path、外部URL、親参照、Symlink／Junction越境およびCatalog外Documentを拒否する。
 */
import { lstat, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { createElement, type ReactElement } from "react";

import {
  EmptyState,
  WorkbenchPanel,
} from "./presentation/workbench-components.ts";

const MAX_ARTIFACT_BYTES = 512 * 1_024;
const FIXED_OWNER_ARTIFACTS = Object.freeze([
  "99_Roadmap/03_Releases.md",
  "99_Roadmap/01_Roadmap.md",
  "07_Quality/01_Quality_Center.md",
] as const);

/**
 * Workbenchへ公開するOwner Artifact一件の値契約。
 *
 * @responsibility 検証済み相対Path、原文titleおよび表示分類を一つのRead Modelへ閉じる。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @shape relativePath、titleおよびcategoryを表す。
 * @invariant categoryは正本の所有責務を変更せず、Workbench内の表示先だけを決める。
 * @boundary Repository ArtifactとWorkbench Catalogの型境界。
 * @security relativePathはRepository内の通常Markdownだけを指す。
 * @compatibility 新category追加時はNavigationと全表示を再評価する。
 */
export type WorkbenchOwnerArtifact = Readonly<{
  relativePath: string;
  title: string;
  category: "release_projection" | "project_plan" | "quality" | "relation";
  origin: "fixed" | "project_context";
  sourceSection: string | null;
}>;

/**
 * Workbench Owner Artifact Catalogの値契約。
 *
 * @responsibility Catalog全体の観測状態、検証済みArtifactおよび失敗理由を同じSnapshotへ閉じる。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @shape state、artifactsおよびreasonを表す。
 * @invariant unknownでは部分Artifactを完全Catalogとして公開しない。
 * @boundary Repository観測とWorkbench表示Modelの型境界。
 * @security artifactは検証済みRepository内相対Pathだけを保持する。
 * @compatibility availableの空配列だけが明示Relation 0件を意味する。
 */
export type WorkbenchOwnerArtifactCatalog = Readonly<{
  state: "available" | "unknown";
  artifacts: readonly WorkbenchOwnerArtifact[];
  reason: "owner_artifact_observation_failed" | null;
}>;

/**
 * Owner Relationと固定Root Artifactから読取りCatalogを構築する。
 *
 * @responsibility Project Contextで明示されたMarkdown Relationだけを検証済みRepository Fileへ解決する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input repositoryRootと検証済みProject Context Markdownを受け取る。
 * @returns Catalog状態、全件検証済みArtifactおよび観測不能理由を返す。
 * @precondition repositoryRootは検証済みVersion Control Rootである。
 * @postcondition availableでは全PathがRepository内の通常Fileであり、titleを取得済みである。
 * @effect 固定FileとProject Contextが宣言したMarkdown FileのMetadataおよび内容を読取る。
 * @failure 一件でも越境、Link、過大File、欠落または読取り失敗なら部分Catalogを公開しない。
 * @invariant Project Contextにない一般Repository探索やDirectory列挙を行わない。
 * @boundary Repository FilesystemとWorkbench Documentation Catalogの境界。
 * @security 外部URL、絶対Path、親参照、Symlink／Junctionおよび512KiB超過を拒否する。
 * @concurrency 独立Artifactを並行読取りし、全件成功時だけSnapshotを公開する。
 */
export async function readWorkbenchOwnerArtifactCatalog(
  repositoryRoot: string,
  projectContextMarkdown: string,
): Promise<WorkbenchOwnerArtifactCatalog> {
  const referenced = extractMarkdownRelations(projectContextMarkdown);
  const candidates = new Map<
    string,
    Readonly<{
      origin: "fixed" | "project_context";
      sourceSection: string | null;
    }>
  >();
  for (const relativePath of FIXED_OWNER_ARTIFACTS)
    candidates.set(
      relativePath,
      Object.freeze({ origin: "fixed", sourceSection: null }),
    );
  for (const relation of referenced)
    if (!candidates.has(relation.relativePath))
      candidates.set(relation.relativePath, relation);
  try {
    const artifacts = await Promise.all(
      [...candidates.entries()].sort().map(async ([relativePath, relation]) => {
        const markdown = await readVerifiedOwnerArtifact(
          repositoryRoot,
          relativePath,
        );
        return Object.freeze({
          relativePath,
          title: extractTitle(markdown, relativePath),
          origin: relation.origin,
          sourceSection: relation.sourceSection,
          category:
            relativePath === FIXED_OWNER_ARTIFACTS[0]
              ? ("release_projection" as const)
              : relativePath === FIXED_OWNER_ARTIFACTS[1]
                ? ("project_plan" as const)
                : relativePath === FIXED_OWNER_ARTIFACTS[2]
                  ? ("quality" as const)
                  : ("relation" as const),
        });
      }),
    );
    return Object.freeze({
      state: "available",
      artifacts: Object.freeze(artifacts),
      reason: null,
    });
  } catch {
    return Object.freeze({
      state: "unknown",
      artifacts: Object.freeze([]),
      reason: "owner_artifact_observation_failed",
    });
  }
}

/**
 * Catalogで許可済みのOwner Artifact本文を読取る。
 *
 * @responsibility Browser要求Pathを起動時Catalogへ照合してから同じRepository境界で原文を取得する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input repositoryRoot、Catalogおよび要求された相対Pathを受け取る。
 * @returns 許可済みMarkdown本文、未許可または観測不能ではnullを返す。
 * @precondition catalogは同じrepositoryRootから作成されている。
 * @postcondition 非null結果はCatalogに存在する通常Markdown Fileの現在本文である。
 * @effect 許可済みFile一件のMetadataと内容を読取る。
 * @failure Catalog外、変更後越境、Link、過大化、欠落または読取り失敗をnullで拒否する。
 * @invariant URL入力だけで新しいFilesystem Authorityを作らない。
 * @boundary localhost Document RouteとRepository Filesystemの境界。
 * @security exact Catalog membershipと実Path境界を再確認する。
 * @concurrency Requestごとの読取りだけを所有する。
 */
export async function readWorkbenchOwnerArtifact(
  repositoryRoot: string,
  catalog: WorkbenchOwnerArtifactCatalog,
  relativePath: string,
): Promise<string | null> {
  if (
    catalog.state !== "available" ||
    !catalog.artifacts.some(
      (artifact) => artifact.relativePath === relativePath,
    )
  )
    return null;
  return await readVerifiedOwnerArtifact(repositoryRoot, relativePath).catch(
    () => null,
  );
}

/**
 * 安定CHG IDから固定Canonical Pathの変更正本を読取る。
 *
 * @responsibility Topic／Meeting Relation Navigationを任意Path入力へ変えず、CHG正本へ接続する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input repositoryRootと未信頼なCHG ID候補を受け取る。
 * @returns 同じRepository内の検証済みCHG Markdown、形式不正・欠落・観測失敗ではnullを返す。
 * @precondition repositoryRootは検証済みVersion Control Rootである。
 * @postcondition 非null結果は`99_Roadmap/Changes/<CHG-ID>/change.md`だけから得る。
 * @effect 固定Path一件のMetadata、実Pathおよび内容を読取る。
 * @failure ID不正、Link、越境、過大、欠落または読取り失敗をnullで拒否する。
 * @invariant BrowserからFilesystem Pathを受け取らない。
 * @boundary Topic／Meeting RelationとRoadmap Change正本の読取り境界。
 * @security 六桁CHG IDを固定Pathへ変換し、一般Repository探索を行わない。
 * @concurrency Requestごとの独立読取りだけを所有する。
 */
export async function readWorkbenchChangeArtifact(
  repositoryRoot: string,
  changeId: string,
): Promise<string | null> {
  if (!/^CHG-\d{6}$/u.test(changeId)) return null;
  return await readVerifiedOwnerArtifact(
    repositoryRoot,
    `99_Roadmap/Changes/${changeId}/change.md`,
  ).catch(() => null);
}

/**
 * Owner Artifact CatalogをQualityおよびDocumentationへ投影する。
 *
 * @responsibility 固定Owner ArtifactとProject Context Relationを第二正本化せずQualityと参照先へ分けて表示する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input catalogに起動時の検証済みOwner Artifact Snapshotを受け取る。
 * @returns Browserが描画するReact要素を返す。
 * @precondition availableのartifactは全てRepository内通常Markdownである。
 * @postcondition Quality、Roadmap詳細およびRelationを同じ原文Routeへ接続する。
 * @effect N/A: React要素の構築だけを行う。
 * @failure unknownは空一覧へ畳まず、二つの面を観測不能として表示する。
 * @invariant Artifact内容、IdentityまたはRelationをWorkbenchへ複製しない。
 * @boundary Owner Artifact CatalogとBrowser表示の境界。
 * @security titleとPathはReactのText escapingを使用し、URLはCatalog内Pathだけから生成する。
 * @concurrency 起動時Catalog一件だけを同期描画する。
 */
export function renderWorkbenchOwnerArtifacts(
  catalog: WorkbenchOwnerArtifactCatalog,
  query = "",
): ReactElement {
  if (catalog.state !== "available") {
    return createElement(
      WorkbenchPanel,
      {
        id: "documentation",
        eyebrow: "Owner artifact",
        title: "Documentation and Relations",
        status: "Unknown",
      },
      createElement(
        EmptyState,
        null,
        "Owner Artifactを完全に観測できません。空または該当なしとして扱いません。",
      ),
    );
  }
  const normalizedQuery = query.trim().toLocaleLowerCase("ja");
  const relationSources = catalog.artifacts.filter(
    (artifact) =>
      artifact.category === "relation" || artifact.category === "project_plan",
  );
  const relations = relationSources.filter(
    (artifact) =>
      normalizedQuery.length === 0 ||
      artifact.title.toLocaleLowerCase("ja").includes(normalizedQuery) ||
      artifact.relativePath.toLocaleLowerCase("ja").includes(normalizedQuery),
  );
  return createElement(
    WorkbenchPanel,
    {
      id: "documentation",
      eyebrow: "Owner relations",
      title: "Documentation and Relations",
      status: `${relations.length} / ${relationSources.length} sources`,
      className: "owner-artifact-panel",
    },
    createElement(
      "p",
      { className: "scene-summary" },
      "Project Contextが現在明示するOwner RelationとProject Planの詳細正本だけを表示します。検索は起動時に検証済みのCatalog内だけで行い、Repository全体を探索しません。",
    ),
    createElement(
      "form",
      { className: "document-search", method: "get", action: "/" },
      createElement(
        "label",
        null,
        "TitleまたはPathで検索",
        createElement("input", {
          type: "search",
          name: "documentQuery",
          defaultValue: query,
          maxLength: 200,
        }),
      ),
      createElement("button", { type: "submit" }, "Search"),
    ),
    relations.length === 0
      ? createElement(
          EmptyState,
          null,
          normalizedQuery.length === 0
            ? "現在のOwner Relationは0件です。"
            : "検索条件に一致する検証済みOwner Relationはありません。",
        )
      : createElement(
          "ul",
          { className: "owner-artifact-list" },
          ...relations.map((artifact) =>
            createElement(
              "li",
              { key: artifact.relativePath },
              createElement(
                "a",
                {
                  href: `/owner-artifact?path=${encodeURIComponent(artifact.relativePath)}`,
                },
                createElement("strong", null, artifact.title),
                createElement(
                  "small",
                  null,
                  createElement("code", null, artifact.relativePath),
                ),
                createElement(
                  "small",
                  null,
                  artifact.origin === "fixed"
                    ? "Fixed owner entry"
                    : `Project Context: ${artifact.sourceSection ?? "Section unknown"}`,
                ),
              ),
            ),
          ),
        ),
  );
}

/**
 * Project Contextに明示された相対Markdown Relationを抽出する。
 *
 * @responsibility Markdown Linkから許可候補と起点H2だけを抽出し、外部・絶対・親参照を除外する。
 * @trace ARCH-000016
 * @input markdownに検証対象のProject Context本文を受け取る。
 * @returns 構文上安全な相対Markdown Path候補と起点Sectionを入力順で返す。
 * @precondition markdownを信頼済みPath一覧と仮定しない。
 * @postcondition 戻り値は`.md`終端で、Scheme、絶対Path、Backslashおよび`..`を含まない。
 * @effect N/A: 入力文字列だけを解析する。
 * @failure 不適格Linkを結果へ含めず、例外でFilesystem Effectを誘発しない。
 * @invariant Link TextまたはFragmentをPath Identityへ含めず、再帰Relationを生成しない。
 * @boundary Project Context MarkdownとOwner Artifact Path候補の境界。
 * @security URLやPathのAuthorityを生成せず、候補は後段で実Path検証する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function extractMarkdownRelations(markdown: string): readonly Readonly<{
  relativePath: string;
  origin: "project_context";
  sourceSection: string | null;
}>[] {
  const results: Readonly<{
    relativePath: string;
    origin: "project_context";
    sourceSection: string | null;
  }>[] = [];
  let sourceSection: string | null = null;
  for (const line of markdown.replace(/\r\n?/gu, "\n").split("\n")) {
    const heading = /^##\s+(.+)$/u.exec(line)?.[1]?.trim();
    if (heading !== undefined && heading.length > 0) sourceSection = heading;
    for (const match of line.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
      const target = match[1]?.split("#", 1)[0] ?? "";
      if (
        target.endsWith(".md") &&
        !target.includes("\\") &&
        !target.startsWith("/") &&
        !/^[A-Za-z][A-Za-z0-9+.-]*:/u.test(target) &&
        !target.split("/").includes("..")
      )
        results.push(
          Object.freeze({
            relativePath: target,
            origin: "project_context",
            sourceSection,
          }),
        );
    }
  }
  return Object.freeze(results);
}

/**
 * Repository内の通常Markdown Fileを上限付きで読取る。
 *
 * @responsibility 相対Path、通常File、実Path境界およびSizeを再検証して本文を取得する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input repositoryRootとCatalog候補の相対Pathを受け取る。
 * @returns 検証済みMarkdown本文を返す。
 * @precondition repositoryRootは検証済みVersion Control Rootである。
 * @postcondition 戻り値は同じRepository実Path配下の512KiB以下の通常File本文である。
 * @effect File Metadata、実Pathおよび内容を読取る。
 * @failure 不正Path、Link、越境、過大、欠落または読取り失敗を例外で拒否する。
 * @invariant Directory列挙、外部Path探索またはFile変更を行わない。
 * @boundary Repository FilesystemとWorkbench Read Modelの境界。
 * @security lexical検査とrealpath検査の両方を要求する。
 * @concurrency 一Fileの独立した読取りだけを所有する。
 */
async function readVerifiedOwnerArtifact(
  repositoryRoot: string,
  relativePath: string,
): Promise<string> {
  if (
    relativePath.length === 0 ||
    relativePath.length > 512 ||
    !relativePath.endsWith(".md") ||
    relativePath.includes("\\") ||
    path.posix.isAbsolute(relativePath) ||
    relativePath
      .split("/")
      .some((segment) => segment === ".." || segment === "")
  )
    throw new Error("workbench_owner_artifact_path_invalid");
  const rootReal = await realpath(repositoryRoot);
  const absolutePath = path.resolve(repositoryRoot, ...relativePath.split("/"));
  const fileLstat = await lstat(absolutePath);
  if (!fileLstat.isFile() || fileLstat.isSymbolicLink())
    throw new Error("workbench_owner_artifact_not_regular");
  const fileReal = await realpath(absolutePath);
  const relativeReal = path.relative(rootReal, fileReal);
  if (
    relativeReal === "" ||
    relativeReal === ".." ||
    relativeReal.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeReal)
  )
    throw new Error("workbench_owner_artifact_boundary_invalid");
  const metadata = await stat(fileReal);
  if (!metadata.isFile() || metadata.size > MAX_ARTIFACT_BYTES)
    throw new Error("workbench_owner_artifact_size_invalid");
  return await readFile(fileReal, "utf8");
}

/**
 * Markdownの第一H1を表示名へ変換する。
 *
 * @responsibility 原文の第一H1をtitleとし、欠落時だけ相対Pathへ戻す。
 * @trace ARCH-000016
 * @input markdown本文と検証済みrelativePathを受け取る。
 * @returns 空でない表示名を返す。
 * @precondition relativePathはCatalog検証済みである。
 * @postcondition H1の内容順を変えず、存在しないtitleを推測しない。
 * @effect N/A: 入力文字列だけを変換する。
 * @failure H1欠落をPath表示へ安全に縮退する。
 * @invariant H2以下をtitleとして採用しない。
 * @boundary Markdown本文とWorkbench表示名の境界。
 * @security titleをHTMLとして信頼せず、ReactのText escapingを使用する。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function extractTitle(markdown: string, relativePath: string): string {
  const title = markdown
    .split(/\r?\n/u)
    .find((line) => /^#\s+\S/u.test(line))
    ?.replace(/^#\s+/u, "")
    .trim();
  return title === undefined || title.length === 0 ? relativePath : title;
}

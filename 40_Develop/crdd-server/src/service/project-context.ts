/**
 * Local CROSの現在許可集合からPortfolioを直接読む。
 * @responsibility Host管理状態と内容Rootを分離し、MCP通信を介さず既存Ownerへ接続する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 */
import type {
  RemoteTarget,
  WorkingChanges,
} from "@qual-lab/crdd-version-control";
import { resolveVerifiedRepositoryRootFromWorkingDirectory } from "@qual-lab/crdd-version-control";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import {
  lstat,
  open,
  readdir,
  readFile,
  realpath,
  stat,
} from "node:fs/promises";
import path from "node:path";
import {
  createPortfolioProjection,
  parseMeetingMarkdown,
  parseRepositoryProjectContextMarkdown,
  parseQualityCenter,
  parseRepositoryReleaseProjectionMarkdown,
  parseTopicMarkdown,
  readRepositoryProjectContext,
  type MeetingRecord,
  type PortfolioProjection,
  type ProjectContextSource,
  type RepositoryProjectContext,
  type RepositoryQualityProjection,
  type RepositoryReleaseProjection,
  type TopicRecord,
} from "@qual-lab/crdd-document-model";
import { readRepositoryChangeSet } from "./repository.ts";

import type {
  AuthorizedRepository,
  FilesystemStoreRoot,
} from "@qual-lab/crdd-access-management";
import {
  type HostedAccessSession,
  resolveHostedRepositories,
} from "./access.ts";

export type ProjectContextTarget = Readonly<{
  repositoryId: string;
  projectId: string;
}>;

/** 起動リポジトリだけのProject ContextをHTTPとMCPで共用する。 @trace ARCH-000012 */
export async function readLocalProjectPortfolio(
  repositoryRoot: string,
  signal: AbortSignal,
  target?: ProjectContextTarget,
): Promise<PortfolioProjection> {
  if (
    signal.aborted ||
    resolveVerifiedRepositoryRootFromWorkingDirectory(repositoryRoot) !==
      repositoryRoot
  )
    throw new Error("project_context_unavailable");
  const manifest = readRepositoryManifest(repositoryRoot);
  if (manifest.status !== "ready" || signal.aborted)
    throw new Error("project_context_unavailable");
  const identity = manifest.manifest;
  if (
    target &&
    (target.repositoryId !== identity.repositoryId ||
      target.projectId !== identity.projectId)
  )
    return createPortfolioProjection([]);
  const read = readRepositoryProjectContext(repositoryRoot, identity);
  if (read.status !== "completed" || signal.aborted)
    throw new Error("project_context_unavailable");
  const current = readRepositoryManifest(repositoryRoot);
  if (
    current.status !== "ready" ||
    current.identity !== manifest.identity ||
    signal.aborted
  )
    throw new Error("project_context_unavailable");
  return createPortfolioProjection([
    {
      projectId: identity.projectId,
      repositoryId: identity.repositoryId,
      state: "complete",
      revision: "repository-current",
      context: read.context,
    },
  ]);
}

/** 一覧はProjectの要約だけを公開する。 @trace ARCH-000012 */
export function projectPortfolioList(portfolio: PortfolioProjection) {
  return {
    retainedAsSourceOfTruth: false as const,
    projects: portfolio.projects.map(({ projectId, state, sources }) => ({
      projectId,
      state,
      sourceCount: sources.length,
      repositoryIds: sources.map(({ repositoryId }) => repositoryId),
    })),
  };
}

/** CRDDとGitHub双方が許可したProject Contextだけを読む。 */
export async function readHostedProjectPortfolio(
  root: FilesystemStoreRoot,
  session: HostedAccessSession,
  signal: AbortSignal,
  target?: ProjectContextTarget,
): Promise<PortfolioProjection> {
  const access = await resolveHostedRepositories(
    root,
    session,
    signal,
    target?.repositoryId,
  );
  if (!access) return createPortfolioProjection([]);
  const repositories = target
    ? access.repositories.filter(
        ({ manifest }) => manifest.projectId === target.projectId,
      )
    : access.repositories;
  const portfolio = readAuthorizedPortfolio(
    repositories,
    access.signal,
    access.assertDirectory,
  );
  access.assertCurrent(repositories);
  return portfolio;
}

/**
 * 今回の許可集合から読取り状態を保持してPortfolioを投影する。
 * @responsibility 同じ要求の認可済み集合を変えず、Domain本文だけを読む。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input 今回AMが確認したRepository集合と所有Signal。指定時は本文直前の同一実体確認も行う。
 * @returns 認可済みの読めた本文と未確認・競合SourceのPortfolio。
 * @precondition 利用側は公開直前に同じ全集合の現在一致を確認する。
 * @postcondition 非complete Sourceに本文・Role・推測版を付けず、全体completeにしない。
 * @effect 許可済みRootの固定Context本文を読む。
 * @failure 取消・Root不成立は固定例外。文書取得・解析不能と識別情報競合は区別して保持する。
 * @invariant この投影は後続要求の認可証明ではない。
 * @boundary 今回のAM集合とDomain本文投影。
 * @security Root・Binding・資格を公開しない。
 * @concurrency AMを再取得せず同じ短命集合を使う。
 */
export function readAuthorizedPortfolio(
  repositories: readonly AuthorizedRepository[],
  signal: AbortSignal,
  assertDirectory?: (repository: AuthorizedRepository) => void,
): PortfolioProjection {
  const sources: ProjectContextSource[] = [];
  for (const repository of repositories) {
    if (signal.aborted)
      throw new Error("workbench_local_portfolio_unavailable");
    assertDirectory?.(repository);
    const read = readRepositoryProjectContext(repository.root, {
      projectId: repository.manifest.projectId,
      repositoryId: repository.manifest.repositoryId,
      repositoryRole: repository.manifest.repositoryRole,
    });
    if (read.status === "blocked")
      throw new Error("workbench_local_portfolio_unavailable");
    sources.push(
      read.status === "completed"
        ? {
            projectId: repository.manifest.projectId,
            repositoryId: repository.repositoryId,
            state: "complete",
            revision: read.revision,
            context: read.context,
          }
        : {
            projectId: repository.manifest.projectId,
            repositoryId: repository.repositoryId,
            state:
              read.status === "conflicting" ? "conflicting" : "unavailable",
            revision: null,
            context: null,
          },
    );
  }
  if (signal.aborted) throw new Error("workbench_local_portfolio_unavailable");
  return createPortfolioProjection(sources);
}

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
export type OwnerArtifact = Readonly<{
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
export type OwnerArtifactCatalog = Readonly<{
  state: "available" | "unknown";
  artifacts: readonly OwnerArtifact[];
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
 * @failure 一件でも越境、Link、欠落、読取り・close失敗なら部分Catalogを公開しない。
 * @invariant Project Contextにない一般Repository探索やDirectory列挙を行わない。
 * @boundary Repository FilesystemとWorkbench Documentation Catalogの境界。
 * @security 外部URL、絶対Path、親参照、Symlink／Junction越境を拒否する。
 * @concurrency 独立Artifactを並行読取りし、全件成功時だけSnapshotを公開する。
 */
export async function readOwnerArtifactCatalog(
  repositoryRoot: string,
  projectContextMarkdown: string,
): Promise<OwnerArtifactCatalog> {
  const { artifactReferences } = parseRepositoryProjectContextMarkdown(
    projectContextMarkdown,
  );
  return observeOwnerArtifactCatalog(repositoryRoot, artifactReferences);
}

/** 合成済みの参照候補を現在の実体で照合し、一覧を作る。 @trace ARCH-000005 */
async function observeOwnerArtifactCatalog(
  repositoryRoot: string,
  references: ReturnType<
    typeof parseRepositoryProjectContextMarkdown
  >["artifactReferences"],
  assertReadable?: () => void,
): Promise<OwnerArtifactCatalog> {
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
  for (const reference of references)
    if (!candidates.has(reference.relativePath))
      candidates.set(reference.relativePath, {
        origin: "project_context",
        sourceSection: reference.sourceSection,
      });
  try {
    const artifacts = await Promise.all(
      [...candidates.entries()].sort().map(async ([relativePath, relation]) => {
        const markdown = await readVerifiedOwnerArtifact(
          repositoryRoot,
          relativePath,
          true,
          assertReadable,
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
 * @responsibility Browser要求Pathを同じRootから検査したCatalogへ照合してから原文を取得する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input repositoryRoot、Catalogおよび要求された相対Pathを受け取る。
 * @returns 許可済みMarkdown本文、未許可または観測不能ではnullを返す。
 * @precondition catalogは同じrepositoryRootから作成されている。
 * @postcondition 非null結果はCatalogに存在する通常Markdown Fileの現在本文である。
 * @effect 許可済みFile一件のMetadataと内容を読取る。
 * @failure Catalog外、変更後越境、Link、欠落または読取り失敗をnullで拒否する。
 * @invariant URL入力だけで新しいFilesystem Authorityを作らない。
 * @boundary localhost Document RouteとRepository Filesystemの境界。
 * @security exact Catalog membershipと実Path境界を再確認する。
 * @concurrency Requestごとの読取りだけを所有する。
 */
export async function readOwnerArtifact(
  repositoryRoot: string,
  catalog: OwnerArtifactCatalog,
  relativePath: string,
  assertReadable?: () => void,
): Promise<string | null> {
  if (
    catalog.state !== "available" ||
    !catalog.artifacts.some(
      (artifact) => artifact.relativePath === relativePath,
    )
  )
    return null;
  return await readVerifiedOwnerArtifact(
    repositoryRoot,
    relativePath,
    false,
    assertReadable,
  ).catch(() => null);
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
 * @failure ID不正、Link、越境、欠落または読取り失敗をnullで拒否する。
 * @invariant BrowserからFilesystem Pathを受け取らない。
 * @boundary Topic／Meeting RelationとRoadmap Change正本の読取り境界。
 * @security 六桁CHG IDを固定Pathへ変換し、一般Repository探索を行わない。
 * @concurrency Requestごとの独立読取りだけを所有する。
 */
export async function readChangeArtifact(
  repositoryRoot: string,
  changeId: string,
  assertReadable?: () => void,
): Promise<string | null> {
  if (!/^CHG-\d{6}$/u.test(changeId)) return null;
  return await readVerifiedOwnerArtifact(
    repositoryRoot,
    `99_Roadmap/Changes/${changeId}/change.md`,
    false,
    assertReadable,
  ).catch(() => null);
}

/**
 * Repository内の通常Markdown Fileを検証して全文読取る。
 *
 * @responsibility 相対Path、通常File、実Path境界を再検証し、一覧の実体照合と本文取得を所有する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input repositoryRoot、相対Path、一覧用見出しだけを取得するかを受け取る。
 * @returns 検証済みMarkdown本文を返す。
 * @precondition repositoryRootは検証済みVersion Control Rootである。
 * @postcondition 文書の容量だけでは本文・見出しを拒否又は切り詰めない。
 * @effect File Metadata、実Pathおよび内容を読取る。
 * @failure 不正Path、Link、越境、欠落または読取り失敗を例外で拒否する。
 * @invariant Directory列挙、外部Path探索またはFile変更を行わない。
 * @boundary Repository FilesystemとWorkbench Read Modelの境界。
 * @security 一覧は開いた実体と読取り前後を照合する。本文を操作許可として使用しない。
 * @concurrency 一Fileの独立した読取りだけを所有する。
 */
async function readVerifiedOwnerArtifact(
  repositoryRoot: string,
  relativePath: string,
  titleOnly = false,
  assertReadable?: () => void,
): Promise<string> {
  if (
    relativePath.length === 0 ||
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
  if (!metadata.isFile())
    throw new Error("workbench_owner_artifact_not_regular");
  assertReadable?.();
  if (titleOnly) {
    const handle = await open(fileReal, "r");
    try {
      const before = await handle.stat();
      if (
        !before.isFile() ||
        before.dev !== metadata.dev ||
        before.ino !== metadata.ino ||
        before.size !== metadata.size
      )
        throw new Error("workbench_owner_artifact_changed");
      const bytes = Buffer.alloc(before.size);
      let offset = 0;
      while (offset < bytes.length) {
        const read = await handle.read(
          bytes,
          offset,
          bytes.length - offset,
          offset,
        );
        if (read.bytesRead === 0)
          throw new Error("workbench_owner_artifact_read_incomplete");
        offset += read.bytesRead;
      }
      const after = await handle.stat();
      const current = await lstat(fileReal);
      if (
        !after.isFile() ||
        !current.isFile() ||
        current.isSymbolicLink() ||
        [after, current].some(
          (value) =>
            value.dev !== before.dev ||
            value.ino !== before.ino ||
            value.size !== before.size ||
            value.mtimeMs !== before.mtimeMs ||
            value.ctimeMs !== before.ctimeMs,
        ) ||
        (await realpath(absolutePath)) !== fileReal
      )
        throw new Error("workbench_owner_artifact_changed");
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } finally {
      await handle.close();
    }
  }
  const markdown = await readFile(fileReal, "utf8");
  return markdown;
}

/**
 * 観測したMarkdown範囲内の第一H1を表示名へ変換する。
 *
 * @responsibility 文書全体の第一H1をtitleとし、見出しがなければ相対Pathへ戻す。
 * @trace ARCH-000016
 * @input markdown本文と検証済みrelativePathを受け取る。
 * @returns 空でない表示名を返す。
 * @precondition relativePathはCatalog検証済みである。
 * @postcondition H1の内容順を変えず、存在しないtitleを推測しない。
 * @effect N/A: 入力文字列だけを変換する。
 * @failure H1欠落をPath表示へ安全に縮退する。
 * @invariant H2以下をtitleとして採用しない。
 * @boundary Markdown本文とWorkbench表示名の境界。
 * @security titleをHTMLとして信頼せず、BrowserのText escapingを使用する。
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

/**
 * 固定Current Release ProjectionをWorkbench向けに観測する。
 *
 * @responsibility Release Projectionの欠落、不正およびFilesystem失敗を別状態として保持する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input 検証済みRepository Rootと、必要な場合は後続の読取り前に呼ぶ認可確認。
 * @returns 構造化Projectionまたは理由付き状態を返す。
 * @precondition 固定Path以外を探索しない。
 * @postcondition availableではProject Operation共通Readerを通過したProjectionを返す。
 * @effect 99_Roadmap/03_Releases.mdを一回読取る。
 * @failure 欠落はnot_configured、構造不正はrelease_projection_invalid、その他はobservation_failedとする。
 * @invariant 欠落項目を推測補完しない。
 * @boundary Repository FilesystemとProject Operation Release Readerの直接境界。
 * @security 固定Repository内Pathだけを読む。
 * @concurrency 他のSurface観測と独立して実行できる。
 */
async function readProjectPlan(
  repositoryRoot: string,
): Promise<ProjectPlanObservation> {
  try {
    const markdown = await readFile(
      path.join(repositoryRoot, "99_Roadmap", "03_Releases.md"),
      "utf8",
    );
    try {
      return Object.freeze({
        state: "available",
        projection: parseRepositoryReleaseProjectionMarkdown(markdown),
        reason: null,
      });
    } catch {
      return Object.freeze({
        state: "unknown",
        projection: null,
        reason: "release_projection_invalid",
      });
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return Object.freeze({
        state: "not_configured",
        projection: null,
        reason: null,
      });
    return Object.freeze({
      state: "unknown",
      projection: null,
      reason: "observation_failed",
    });
  }
}

/**
 * 固定Current Quality ProjectionをWorkbench向けに観測する。
 *
 * @responsibility Quality Projectionの欠落、不正およびFilesystem失敗を別状態として保持する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @input repositoryRootに検証済みRepository Rootを受け取る。
 * @returns 構造化Quality Projectionまたは理由付き状態を返す。
 * @precondition 固定Path以外を探索しない。
 * @postcondition availableではProject Operation共通Readerを通過したProjectionを返す。
 * @effect 07_Quality/01_Quality_Center.mdを一回読取る。
 * @failure 欠落はnot_configured、構造不正はquality_projection_invalid、その他はobservation_failedとする。
 * @invariant 未観測、GapまたはGateを推測補完しない。
 * @boundary Repository FilesystemとProject Operation Quality Readerの直接境界。
 * @security 固定Repository内Pathだけを読む。
 * @concurrency 他のSurface観測と独立して実行できる。
 */
async function readQuality(
  repositoryRoot: string,
): Promise<ProjectQualityObservation> {
  const relativePath = "07_Quality/01_Quality_Center.md";
  try {
    const markdown = await readFile(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    try {
      const { currentProjection } = parseQualityCenter({
        path: relativePath,
        content: markdown,
      }).result;
      if (currentProjection.status === "complete")
        return Object.freeze({
          state: "available",
          projection: currentProjection.result,
          reason: null,
        });
    } catch {
      // 既読の文書を解釈できない場合は、実体の観測失敗と区別する。
    }
    return Object.freeze({
      state: "unknown",
      projection: null,
      reason: "quality_projection_invalid",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return Object.freeze({
        state: "not_configured",
        projection: null,
        reason: null,
      });
    return Object.freeze({
      state: "unknown",
      projection: null,
      reason: "observation_failed",
    });
  }
}

/**
 * 固定Record Directoryから検証済み一覧を読取る。
 *
 * @responsibility 既知PathのDirectory状態を分類し、固定Identity Directory内の正本だけを検証済み一覧へ変換する。
 * @trace ARCH-000012
 * @input directoryPath、Identity形式、固定File名、ParserおよびIdentity取得処理を受け取る。
 * @returns 構成状態、全件検証済みRecordおよび観測不能理由を返す。
 * @precondition 呼出し側が固定allowlistからPathを構築している。
 * @postcondition availableでは対象Identity Directoryの全Recordが本文Identityと一致する。
 * @effect Filesystem Metadata、固定Directory一覧および固定Record Fileを読取る。
 * @failure 欠落はnot_configured、観測失敗またはRecord不正は理由付きunknownとする。
 * @invariant 未構成を空一覧へ、部分読取りを完全一覧へ畳まない。
 * @boundary Repository FilesystemとWorkbench Capability表示の境界。
 * @security 任意入力Pathを受け付けず、内容を公開しない。
 * @concurrency 独立したMetadata観測だけを行う。
 */
async function readRecordCollection<T>(
  directoryPath: string,
  identityPattern: RegExp,
  fileName: string,
  parse: (markdown: string) => T,
  identityOf: (record: T) => string,
  assertReadable?: () => void,
): Promise<RecordCollectionView<T>> {
  try {
    const result = await stat(directoryPath);
    if (!result.isDirectory())
      return Object.freeze({
        state: "not_configured",
        items: Object.freeze([]),
        reason: null,
      });
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    )
      return Object.freeze({
        state: "not_configured",
        items: Object.freeze([]),
        reason: null,
      });
    return Object.freeze({
      state: "unknown",
      items: Object.freeze([]),
      reason: "observation_failed",
    });
  }
  try {
    const entries = await readdir(directoryPath, { withFileTypes: true });
    const recordDirectories = entries
      .filter(
        (entry) => entry.isDirectory() && identityPattern.test(entry.name),
      )
      .sort((left, right) => left.name.localeCompare(right.name));
    if (recordDirectories.length > 0) assertReadable?.();
    const items = await Promise.all(
      recordDirectories.map(async (entry) => {
        const record = parse(
          await readFile(
            path.join(directoryPath, entry.name, fileName),
            "utf8",
          ),
        );
        if (identityOf(record) !== entry.name)
          throw new Error("project_operation_record_directory_mismatch");
        return record;
      }),
    );
    return Object.freeze({
      state: "available",
      items: Object.freeze(items),
      reason: null,
    });
  } catch {
    return Object.freeze({
      state: "unknown",
      items: Object.freeze([]),
      reason: "record_invalid",
    });
  }
}

/**
 * 検証済みRepositoryからWorkbench Project Surfaceを読取る。
 *
 * @responsibility 固定Project Contextを共通Readerへ渡し、Topic／Meetingの構成状態を同じSnapshotへ付加する。
 * @trace ARCH-000012
 * @input repositoryRootに検証済みRepository Rootを受け取る。
 * @returns Project ContextとCapability状態を持つProjectViewDataを返す。
 * @precondition repositoryRootはVersion Control境界で検証済みである。
 * @postcondition 正本、Project ContextおよびCapability Directoryを変更しない。
 * @effect Context、記録、計画・品質と、固定またはContextで参照された文書を読取る。
 * @failure Context欠落・不正またはFilesystem観測不能をErrorで拒否する。
 * @invariant Consumer固有Store、独自IdentityまたはRole外推測を作らない。
 * @boundary Repository→Project Operation Reader→Workbench Adapterの直接境界。
 * @security 共有画面では、列挙後に本文を読む前と、次の文書観測を始める前に認可を確認する。
 * @concurrency 独立した初回読取りを並行し、次の文書観測と相関してから返す。
 */
export async function readProjectViewData(
  repositoryRoot: string,
  assertReadable?: () => void,
): Promise<ProjectViewData> {
  const repository = readRepositoryChangeSet(repositoryRoot);
  const [markdown, topics, meetings, plan, quality] = await Promise.all([
    readFile(path.join(repositoryRoot, "PROJECT_CONTEXT.md"), "utf8"),
    readRecordCollection(
      path.join(repositoryRoot, "22_Topics"),
      /^TOPIC-\d{6}$/u,
      "topic.md",
      parseTopicMarkdown,
      (record) => record.topicId,
      assertReadable,
    ),
    readRecordCollection(
      path.join(repositoryRoot, "23_Meetings"),
      /^MTG-\d{6}$/u,
      "meeting.md",
      parseMeetingMarkdown,
      (record) => record.meetingId,
      assertReadable,
    ),
    readProjectPlan(repositoryRoot),
    readQuality(repositoryRoot),
  ]);
  assertReadable?.();
  const contextIntake = parseRepositoryProjectContextMarkdown(markdown);
  const context = contextIntake.result;
  if (context === null)
    throw new Error(
      contextIntake.issues.find(
        (issue) =>
          issue.kind === "artifact.project-context.projection-model-invalid",
      )?.reason ?? "project_context_scene_invalid",
    );
  const ownerArtifacts = await observeOwnerArtifactCatalog(
    repositoryRoot,
    contextIntake.artifactReferences,
    assertReadable,
  );
  return Object.freeze({
    context,
    topics,
    meetings,
    plan,
    quality,
    ownerArtifacts,
    repository,
  });
}

export type ArtifactSelection = Readonly<{
  kind: "change" | "owner";
  identity: string;
}>;

/**
 * 本文表示の用途別Queryを本文観測前に閉検査する。
 * @responsibility 種別ごとのID／Pathと今回Repository選択を分離する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input API Queryと共有modeの有無。
 * @returns 本文選択、本文以外のrouteではnull。
 * @precondition URLSearchParamsは同要求の値である。
 * @postcondition 重複・余剰・越境入力をRoot／Readerへ搬送しない。
 * @effect N/A: 同期値検査。
 * @failure 不正Queryは固定例外。
 * @invariant URL入力を認可または物理Rootへ変換しない。
 * @boundary HTTP Queryと用途限定Reader。
 * @security 外部URL・絶対Path・親参照を拒否する。
 * @concurrency N/A: 要求内の同期検査。
 */
export function readArtifactSelection(
  parameters: URLSearchParams,
  shared: boolean,
): ArtifactSelection | null {
  const routes = parameters.getAll("route");
  if (
    !routes.some((route) => route === "/change" || route === "/owner-artifact")
  )
    return null;
  const change = routes[0] === "/change",
    identityKey = change ? "id" : "path";
  const allowed = new Set(["route", "repositoryId", identityKey]);
  if (
    routes.length !== 1 ||
    parameters.getAll(identityKey).length !== 1 ||
    [...parameters.keys()].some(
      (key) => !allowed.has(key) || parameters.getAll(key).length !== 1,
    )
  )
    throw new Error("workbench_artifact_input_invalid");
  const repositoryId = parameters.get("repositoryId");
  if (
    (shared && !repositoryId) ||
    (repositoryId !== null &&
      !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(repositoryId))
  )
    throw new Error("workbench_artifact_input_invalid");
  const identity = parameters.get(identityKey) ?? "";
  if (
    change
      ? !/^CHG-\d{6}$/u.test(identity)
      : identity.length === 0 ||
        !identity.endsWith(".md") ||
        identity.startsWith("/") ||
        identity.includes("\\") ||
        identity.includes("\0") ||
        /^[A-Za-z][A-Za-z0-9+.-]*:/u.test(identity) ||
        identity.split("/").some((part) => part === ".." || part === "")
  )
    throw new Error("workbench_artifact_input_invalid");
  return Object.freeze({ kind: change ? "change" : "owner", identity });
}

/**
 * 認可済みのRepositoryで選択した本文を一度読む。
 * @responsibility 本文の種別を振り分け、欠測をnullのまま返す。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @boundary 呼出し元が対象を認可し、読取り後の取消・再認可とHTTP応答を所有する。
 */
export function readArtifactMarkdown(
  repositoryRoot: string,
  surface: ProjectViewData,
  selection: ArtifactSelection,
  assertReadable?: () => void,
): Promise<string | null> {
  return selection.kind === "change"
    ? readChangeArtifact(repositoryRoot, selection.identity, assertReadable)
    : readOwnerArtifact(
        repositoryRoot,
        surface.ownerArtifacts,
        selection.identity,
        assertReadable,
      );
}

/**
 * Portfolio継続位置を同じ検索・状態条件へ結合する。
 * @responsibility 検索条件と最後のProject IDの組を保持する。
 * @trace ARCH-000012
 * @shape 検索文字・状態・最後のProject IDの三要素。
 * @invariant Cursorだけで認可集合や観測範囲を拡張しない。
 * @boundary 要求QueryとPortfolio表示ページ。
 * @security 非Authorityの継続位置であり、Rootや資格を含めない。
 * @compatibility 既存base64url Cursorの意味と形状を維持する。
 */
type PortfolioCursor = readonly [string, string, string];

/**
 * 許可済みPortfolioを同じ検索条件の20件へ閉じる。
 * @responsibility 検索・状態条件と継続位置を相関し、未知Cursorを先頭ページへ補完しない。
 * @trace ARCH-000012
 * @input 認可済みPortfolioまたは未構成と、検索文字・状態・Cursor。
 * @returns 有界Portfolio、次Cursor、不正Cursorの明示状態。
 * @precondition 入力Portfolioの認可と観測は呼出し側Ownerが完了している。
 * @postcondition 表示件数は20以下で、次Cursorは同じ検索・状態条件へ結合する。
 * @effect N/A: 同期の絞込みと不変値生成。
 * @failure 不正CursorはcursorInvalidと空の当該ページとして返し、正常ページへ丸めない。
 * @invariant Source・不完全性を維持し、未構成を空Portfolioへ変換しない。
 * @boundary Domain投影と表示用ページ。
 * @security Cursorは表示継続位置であり、Repository認可や物理Rootを表さない。
 * @concurrency N/A: 当該要求の投影だけを同期処理する。
 */
export function createPortfolioPage(
  portfolio: PortfolioProjection | undefined,
  query: Readonly<{ query: string; state: string; cursor: string }>,
): Readonly<{
  portfolio: PortfolioProjection | null;
  nextCursor: string | null;
  cursorInvalid: boolean;
}> {
  if (portfolio === undefined)
    return Object.freeze({
      portfolio: null,
      nextCursor: null,
      cursorInvalid: false,
    });
  const normalizedQuery = query.query.toLocaleLowerCase("ja-JP");
  const filtered = portfolio.projects.filter(
    (project) =>
      (normalizedQuery.length === 0 ||
        project.projectId
          .toLocaleLowerCase("ja-JP")
          .includes(normalizedQuery)) &&
      (query.state.length === 0 || project.state === query.state),
  );
  let cursor: PortfolioCursor | null = null;
  let cursorInvalid = false;
  if (query.cursor.length > 0) {
    try {
      const value: unknown = JSON.parse(
        Buffer.from(query.cursor, "base64url").toString("utf8"),
      );
      if (
        !Array.isArray(value) ||
        value.length !== 3 ||
        !value.every((entry) => typeof entry === "string")
      )
        cursorInvalid = true;
      else {
        const decoded = value as string[];
        if (
          decoded[0] !== query.query ||
          decoded[1] !== query.state ||
          decoded[2] === undefined ||
          decoded[2].length === 0
        )
          cursorInvalid = true;
        else cursor = Object.freeze(decoded) as PortfolioCursor;
      }
    } catch {
      cursorInvalid = true;
    }
  }
  const start =
    cursor === null
      ? 0
      : filtered.findIndex((project) => project.projectId === cursor?.[2]) + 1;
  if (cursor !== null && start === 0) cursorInvalid = true;
  const projects = cursorInvalid ? [] : filtered.slice(start, start + 20);
  const last = projects.at(-1);
  const nextCursor =
    !cursorInvalid &&
    last !== undefined &&
    start + projects.length < filtered.length
      ? Buffer.from(
          JSON.stringify([query.query, query.state, last.projectId]),
          "utf8",
        ).toString("base64url")
      : null;
  return Object.freeze({
    portfolio: Object.freeze({
      ...portfolio,
      projects: Object.freeze(projects),
    }),
    nextCursor,
    cursorInvalid,
  });
}

/**
 * Workbenchが表示するRepository Capability状態を定義する。
 *
 * @responsibility 利用可能と未構成を件数0から分離する。
 * @trace ARCH-000012
 * @shape availableまたはnot_configuredの閉集合を表す。
 * @invariant not_configuredを空一覧または正常状態として扱わない。
 * @boundary Repository観測とWorkbench表示の型境界。
 * @security N/A: 構成状態だけを表す。
 * @compatibility 新状態追加時は全表示と試験を再評価する。
 */
export type WorkbenchCapabilityState =
  | "available"
  | "not_configured"
  | "unknown";

/**
 * WorkbenchのRecord集合を定義する。
 *
 * @responsibility Collection状態、検証済みItemおよび観測不能理由を同じ結果へ閉じる。
 * @trace ARCH-000012
 * @shape state、itemsおよびreasonを表す。
 * @invariant unknownでは部分Itemを完全一覧として公開しない。
 * @boundary Repository Record ReaderとWorkbench一覧表示の型境界。
 * @security reasonは内部Pathまたは非開示Identityを含まない固定値に限る。
 * @compatibility availableの空itemsだけが構成済み0件を意味する。
 */
export type RecordCollectionView<T> = Readonly<{
  state: WorkbenchCapabilityState;
  items: readonly T[];
  reason: "record_invalid" | "observation_failed" | null;
}>;

/**
 * WorkbenchのProject Surfaceを定義する。
 *
 * @responsibility 共通Project Context、Topic／MeetingおよびVersion Control観測を一つのSnapshotへ閉じる。
 * @trace ARCH-000012
 * @shape context、topics、meetingsおよびRepository観測を表す。
 * @invariant Topic／Meeting未配置を0件へ変換しない。
 * @boundary Workbench AdapterとBrowser RendererのRead Model境界。
 * @security Repository Role外のContextを追加しない。
 * @compatibility contextはProject Operation公開型をそのまま利用する。
 */
export type ProjectViewData = Readonly<{
  context: RepositoryProjectContext;
  topics: RecordCollectionView<TopicRecord>;
  meetings: RecordCollectionView<MeetingRecord>;
  plan: ProjectPlanObservation;
  quality: ProjectQualityObservation;
  ownerArtifacts: OwnerArtifactCatalog;
  repository: Readonly<{
    state: "available" | "unknown";
    changeSet: Omit<WorkingChanges, "changedPaths"> | null;
    publicationTarget: RemoteTarget | null;
    reason: "repository_root_invalid" | "observation_failed" | null;
  }>;
}>;

/**
 * Workbenchが観測したCurrent Release Projectionを定義する。
 *
 * @responsibility 利用可能、未構成および観測不能をProjection本体と同じ結果へ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape state、projectionおよびreasonを表す。
 * @invariant 未構成または観測不能を空の計画へ変換しない。
 * @boundary Repository Release ReaderとWorkbench Project Surfaceの型境界。
 * @security reasonは内部Pathを含まない固定値に限る。
 * @compatibility 状態追加時は全表示と試験を再評価する。
 */
export type ProjectPlanObservation = Readonly<{
  state: "available" | "not_configured" | "unknown";
  projection: RepositoryReleaseProjection | null;
  reason: "release_projection_invalid" | "observation_failed" | null;
}>;

/**
 * Workbenchが観測したCurrent Quality Projectionを定義する。
 *
 * @responsibility 利用可能、未構成および観測不能をQuality Projectionと同じ結果へ閉じる。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @shape state、projectionおよびreasonを表す。
 * @invariant 未構成または観測不能をQuality Readyへ変換しない。
 * @boundary Repository Quality ReaderとWorkbench Project Surfaceの型境界。
 * @security reasonは内部Pathを含まない固定値に限る。
 * @compatibility 状態追加時は全表示と試験を再評価する。
 */
export type ProjectQualityObservation = Readonly<{
  state: "available" | "not_configured" | "unknown";
  projection: RepositoryQualityProjection | null;
  reason: "quality_projection_invalid" | "observation_failed" | null;
}>;

/**
 * 観測済み本文を共通の表示契約に整える。
 * @responsibility 表示用Repositoryの採用時点と欠測の扱いは各受付に委ねる。
 * @trace ARCH-000012
 */
export function createArtifactViewResponse(
  selection: ArtifactSelection,
  markdown: string,
  repositoryId: string,
  selectedRepositoryId: string | null,
): ArtifactViewResponse {
  return {
    contract: "crdd/workbench/view/v1",
    view: "artifact",
    repositoryId,
    selectedRepositoryId,
    artifact: { ...selection, markdown },
  };
}

/**
 * 対象Projectの詳細表示を、利用側が確定したPortfolioだけから取得する。
 * @responsibility 単体と共有で同じ表示契約を使い、欠測はnullで呼出し元へ返す。
 * @trace ARCH-000012
 * @boundary 現在認可済みPortfolioに限定する。通信応答は発行しない。
 */
export function readProjectDetailResponse(
  portfolio: PortfolioProjection | null | undefined,
  projectId: string | null,
): ProjectDetailResponse | null {
  const project = portfolio?.projects.find(
    (entry) => entry.projectId === projectId,
  );
  return project === undefined
    ? null
    : {
        contract: "crdd/workbench/view/v1",
        view: "project-detail",
        project,
      };
}

/**
 * 許可済みPortfolioの一ProjectをSource別に表示するRead Model。
 * @responsibility Project Detailの開示済み値だけを運ぶ。
 * @trace ARCH-000012
 * @shape contract、viewおよびprojectで構成する。
 * @invariant viewはproject-detailである。
 * @boundary Federated PortfolioとProject Detail ScreenのJSON境界。
 * @security Principalに開示されたProject値だけを含む。
 * @compatibility contract `crdd/workbench/view/v1`のproject-detail variantである。
 */
export type ProjectDetailResponse = Readonly<{
  contract: "crdd/workbench/view/v1";
  view: "project-detail";
  project: PortfolioProjection["projects"][number];
}>;

/**
 * 選択RepositoryのOwner成果物原文を表示する閉Model。
 * @responsibility 正本本文と論理出所、戻り先の選択を搬送する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @shape repositoryIdは出所、selectedRepositoryIdは共有選択または単体のnull、artifactはkind／identity／markdown。
 * @invariant 共有選択は出所IDと一致し、本文は原文のまま。
 * @boundary 既存ReaderとBrowserのtext表示。
 * @security Root・資格・HTML実行情報を含めない。
 * @compatibility Client Model revision 1のartifact variant。
 */
export type ArtifactViewResponse = Readonly<{
  contract: "crdd/workbench/view/v1";
  view: "artifact";
  repositoryId: string;
  selectedRepositoryId: string | null;
  artifact: Readonly<{
    kind: "change" | "owner";
    identity: string;
    markdown: string;
  }>;
}>;

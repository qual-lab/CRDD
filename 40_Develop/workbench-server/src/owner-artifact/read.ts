/**
 * WorkbenchのOwner Artifact読取りApplication。
 *
 * @packageDocumentation
 * @responsibility Project Contextが明示するOwner Relationと固定Root Artifactを、Repository越境なしの読取りCatalogへ変換する。
 * @trace ARCH-000005
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @boundary Repository MarkdownとWorkbench Client Modelの境界。
 * @effect 検証済みRepository内の宣言済みMarkdownだけを読取る。
 * @security 任意Path、外部URL、親参照、Symlink／Junction越境およびCatalog外Documentを拒否する。
 */
import { lstat, open, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const MAX_ARTIFACT_BYTES = 512 * 1_024;
const MAX_ARTIFACT_TITLE_BYTES = 8 * 1_024;
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
 * @failure 一件でも越境、Link、欠落、読取り・close失敗なら部分Catalogを公開しない。
 * @invariant Project Contextにない一般Repository探索やDirectory列挙を行わない。
 * @boundary Repository FilesystemとWorkbench Documentation Catalogの境界。
 * @security 外部URL、絶対Path、親参照、Symlink／Junction越境を拒否し、見出し読取りは8KiBまで。
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
          true,
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
 * @responsibility 相対Path、通常File、実Path境界を再検証し、一覧見出しと本文の読取り上限を区別する。
 * @trace ARCH-000012
 * @trace ARCH-000016
 * @input repositoryRoot、相対Path、一覧用見出しだけを取得するかを受け取る。
 * @returns 検証済みMarkdown本文を返す。
 * @precondition repositoryRootは検証済みVersion Control Rootである。
 * @postcondition 本文は512KiB以下。一覧は先頭8KiB内の完全行だけで、掲載を本文表示可能の保証にしない。
 * @effect File Metadata、実Pathおよび内容を読取る。
 * @failure 不正Path、Link、越境、過大、欠落または読取り失敗を例外で拒否する。
 * @invariant Directory列挙、外部Path探索またはFile変更を行わない。
 * @boundary Repository FilesystemとWorkbench Read Modelの境界。
 * @security 本文はmetadata・取得本文の両方で512KiB上限。一覧は開いた実体と読取り前後を照合する。
 * @concurrency 一Fileの独立した読取りだけを所有する。
 */
async function readVerifiedOwnerArtifact(
  repositoryRoot: string,
  relativePath: string,
  titleOnly = false,
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
  if (!metadata.isFile() || (!titleOnly && metadata.size > MAX_ARTIFACT_BYTES))
    throw new Error("workbench_owner_artifact_size_invalid");
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
      const bytes = Buffer.alloc(
        Math.min(before.size, MAX_ARTIFACT_TITLE_BYTES),
      );
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
      // 上限で切れた末尾行を捨て、途中の見出しやUTF-8を表示名へ昇格しない。
      const complete =
        before.size > bytes.length
          ? bytes.subarray(0, bytes.lastIndexOf(10) + 1)
          : bytes;
      return new TextDecoder("utf-8", { fatal: true }).decode(complete);
    } finally {
      await handle.close();
    }
  }
  const markdown = await readFile(fileReal, "utf8");
  if (Buffer.byteLength(markdown, "utf8") > MAX_ARTIFACT_BYTES)
    throw new Error("workbench_owner_artifact_size_invalid");
  return markdown;
}

/**
 * 観測したMarkdown範囲内の第一H1を表示名へ変換する。
 *
 * @responsibility 先頭8KiBの完全行内で得た第一H1をtitleとし、未観測なら相対Pathへ戻す。
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

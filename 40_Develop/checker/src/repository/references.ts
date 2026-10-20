/**
 * 参照先の現在観測・固定Git履歴読取りと参照mapを所有する。
 *
 * @responsibility 元の参照解決順、短命cache、Hash照合、未観測と診断を維持する。
 * @trace ARCH-000001
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { readFixedSnapshotText } from "../../../version-control/src/index.ts";
import {
  parseMarkdownAnchors,
  parseMarkdownLinkReference,
} from "../../../domain-model/src/index.ts";
import { isWithin, pathContainsSymbolicLink, samePath } from "./observe.ts";
import type { LinkResolution, LinkRecord } from "./types.ts";
import type { DocumentReferenceMap } from "../report/types.ts";

/**
 * 現在参照と固定履歴参照を解決する起動内Readerを構築する。
 *
 * @responsibility 読取り順・例外・対象集合の既存条件を維持する。
 * @trace ARCH-000001
 * @input root: 初期確認済みRoot。repositoryMode: この時点の形態。add: 既存の診断収集先。
 * @returns 現在参照と固定履歴参照の二つの解決関数。
 * @precondition Rootの初回確認が済み、File探索をまだ開始していない。
 * @postcondition 固定履歴表と本文cacheをこのReaderの寿命だけ保持する。
 * @effect 構築時に該当する固定履歴表を同期読取りする。返却関数もFile・Git履歴を読む。書込みなし。
 * @failure 履歴表不正を既存診断へ記録し、その他の読取り失敗は元の処置で伝播する。
 * @invariant Root外・Link・基準版例外の受理集合を変更しない。
 * @boundary Checker内部の観測とCLI拒否の境界。
 * @security 観測失敗を安全と見なさない。
 * @concurrency N/A: 起動内の同期処理。
 */
export function createDocumentReferenceReader(
  root: string,
  repositoryMode: string,
  add: (severity: string, code: string, file: string, message: string) => void,
): {
  resolveLocalTarget: (source: string, raw: string) => LinkResolution;
  resolveLinkWithFixedHistory: (source: string, raw: string) => LinkRecord;
} {
  const relative = (file: string) =>
    path.relative(root, file).replaceAll("\\", "/") || ".";
  const read = (file: string) => fs.readFileSync(file, "utf8");
  /**
   * Local Targetを一意に解決する。
   *
   * @responsibility Local Targetの候補集合、解決規則、曖昧時の拒否境界を所有する。
   * @trace ARCH-000001
   * @input source: string、raw: string
   * @returns LinkResolutionを返す。
   * @precondition 「source: string、raw: string」がresolveLocalTargetの入力契約を満たす。
   * @postcondition resolveLocalTargetの責務を完了した結果だけを返す。
   * @effect 現在参照先と配布ひな型の正本候補の存在・Link境界を同期観測する。書込みなし。
   * @failure N/A: resolveLocalTargetは独自の失敗分岐を所有しない。
   * @invariant resolveLocalTargetは宣言した境界以外へEffectを拡張しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security N/A: resolveLocalTargetはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: resolveLocalTargetは共有非同期状態を持たない同期処理である。
   */
  function resolveLocalTarget(source: string, raw: string): LinkResolution {
    const parsed = parseMarkdownLinkReference(raw);
    const targetText = parsed.target;
    const anchor = parsed.anchor;
    if (/^(?:https?|mailto|tel):/i.test(targetText)) {
      return {
        external: true,
        target: null,
        anchor,
        targetText,
        decodeError: parsed.decodeError,
        outsideRoot: false,
      };
    }
    let target = targetText
      ? path.resolve(path.dirname(source), targetText)
      : source;
    if (!isWithin(root, target)) {
      return {
        external: false,
        target,
        anchor,
        targetText,
        decodeError: parsed.decodeError,
        outsideRoot: true,
        symbolicBoundary: false,
      };
    }
    if (pathContainsSymbolicLink(root, target)) {
      return {
        external: false,
        target,
        anchor,
        targetText,
        decodeError: parsed.decodeError,
        outsideRoot: false,
        symbolicBoundary: true,
      };
    }
    const templateCrdd = path.join(root, "template", "00_CRDD");
    if (
      !fs.existsSync(target) &&
      source.startsWith(path.join(root, "template") + path.sep) &&
      target.startsWith(templateCrdd + path.sep)
    ) {
      const distributedName = path.relative(templateCrdd, target);
      const canonicalTarget = path.join(root, distributedName);
      if (
        !pathContainsSymbolicLink(root, canonicalTarget) &&
        fs.existsSync(canonicalTarget)
      ) {
        target = canonicalTarget;
      }
    }
    return {
      external: false,
      target,
      anchor,
      targetText,
      decodeError: parsed.decodeError,
      outsideRoot: false,
      symbolicBoundary: pathContainsSymbolicLink(root, target),
    };
  }
  /**
   * current-profileで使用するWork Lifecycle Migration Entryの値契約を定義する。
   *
   * @responsibility Work Lifecycle Migration EntryのProperty、Identity、状態制約を型境界として所有する。
   * @trace ARCH-000001
   * @shape WorkLifecycleMigrationEntryが表すProperty、識別子およびRelationを型として固定する。
   * @invariant WorkLifecycleMigrationEntryで宣言した値と責務の対応を維持する。
   * @boundary N/A: WorkLifecycleMigrationEntryの宣言は外部境界を開かない。
   * @security N/A: WorkLifecycleMigrationEntryはAuthority、秘密値または信頼判断を扱わない。
   * @compatibility WorkLifecycleMigrationEntryの利用側は宣言済みPropertyと型制約だけへ依存する。
   */
  type WorkLifecycleMigrationEntry = Readonly<{
    source: string;
    target: string;
    sourceSha256: string;
    targetSha256: string;
    currentnessAtMigration: string;
  }>;
  /**
   * Canonical Repository Relative Pathかを判定する。
   *
   * @responsibility Canonical Repository Relative Pathの判定条件とtrue／false境界を所有する。
   * @trace ARCH-000001
   * @input value: string
   * @returns booleanを返す。
   * @precondition 「value: string」がisCanonicalRepositoryRelativePathの入力契約を満たす。
   * @postcondition isCanonicalRepositoryRelativePathの責務を完了した結果だけを返す。
   * @effect N/A: isCanonicalRepositoryRelativePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure N/A: isCanonicalRepositoryRelativePathは独自の失敗分岐を所有しない。
   * @invariant isCanonicalRepositoryRelativePathは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: isCanonicalRepositoryRelativePathはProcess内の同一Subsystemで完結する。
   * @security N/A: isCanonicalRepositoryRelativePathはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: isCanonicalRepositoryRelativePathは共有非同期状態を持たない同期処理である。
   */
  function isCanonicalRepositoryRelativePath(value: string): boolean {
    return (
      value !== "" &&
      value === value.replaceAll("\\", "/") &&
      !value.startsWith("/") &&
      !/^[A-Za-z]:/u.test(value) &&
      value
        .split("/")
        .every(
          (segment) => segment !== "" && segment !== "." && segment !== "..",
        )
    );
  }
  /**
   * Fixed History Migrationを読み込む。
   *
   * @responsibility Fixed History Migrationの読取り元、Schema検証、読取不能時の拒否境界を所有する。
   * @trace ARCH-000001
   * @input N/A: 実行時引数を受け取らない。
   * @returns Readonly<{ byCurrentPath: ReadonlyMap<string, WorkLifecycleMigrationEntry>; byHistoricalPath: ReadonlyMap<string, WorkLifecycleMigrationEntry>; sourceCommit: string | null; }>を返す。
   * @precondition 「N/A: 実行時引数を受け取らない。」がloadFixedHistoryMigrationの入力契約を満たす。
   * @postcondition loadFixedHistoryMigrationの責務を完了した結果だけを返す。
   * @effect 該当する固定履歴表を同期読取りし、不正なら既存addへ診断を渡す。File書込みなし。
   * @failure loadFixedHistoryMigrationは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant loadFixedHistoryMigrationは宣言した境界以外へEffectを拡張しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security N/A: loadFixedHistoryMigrationはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: loadFixedHistoryMigrationは共有非同期状態を持たない同期処理である。
   */
  function loadFixedHistoryMigration(): Readonly<{
    byCurrentPath: ReadonlyMap<string, WorkLifecycleMigrationEntry>;
    byHistoricalPath: ReadonlyMap<string, WorkLifecycleMigrationEntry>;
    sourceCommit: string | null;
  }> {
    const empty = {
      byCurrentPath: new Map<string, WorkLifecycleMigrationEntry>(),
      byHistoricalPath: new Map<string, WorkLifecycleMigrationEntry>(),
      sourceCommit: null,
    };
    if (repositoryMode !== "official") return empty;
    const manifestPath = path.join(
      root,
      "99_Roadmap",
      "Changes",
      "CHG-000070",
      "Evidence",
      "260912-2142_migration-map.json",
    );
    if (!fs.existsSync(manifestPath)) return empty;
    try {
      const parsed = JSON.parse(read(manifestPath)) as {
        contract?: unknown;
        entries?: unknown;
        sourceCommit?: unknown;
      };
      if (
        parsed.contract !== "crdd/work-lifecycle-migration-map" ||
        !Array.isArray(parsed.entries) ||
        typeof parsed.sourceCommit !== "string" ||
        !/^[0-9a-f]{40,64}$/iu.test(parsed.sourceCommit)
      )
        throw new Error("contract or entries is invalid");
      const byCurrentPath = new Map<string, WorkLifecycleMigrationEntry>();
      const byHistoricalPath = new Map<string, WorkLifecycleMigrationEntry>();
      const sources = new Set<string>();
      const targets = new Set<string>();
      for (const value of parsed.entries) {
        if (!value || typeof value !== "object")
          throw new Error("entry is not an object");
        const entry = value as Partial<WorkLifecycleMigrationEntry>;
        if (
          typeof entry.source !== "string" ||
          typeof entry.target !== "string" ||
          typeof entry.sourceSha256 !== "string" ||
          typeof entry.targetSha256 !== "string" ||
          typeof entry.currentnessAtMigration !== "string"
        )
          throw new Error("entry fields are invalid");
        if (
          !isCanonicalRepositoryRelativePath(entry.source) ||
          !isCanonicalRepositoryRelativePath(entry.target)
        )
          throw new Error("entry path is not canonical repository-relative");
        if (
          !/^[0-9a-f]{64}$/iu.test(entry.sourceSha256) ||
          !/^[0-9a-f]{64}$/iu.test(entry.targetSha256)
        )
          throw new Error("entry hash is invalid");
        if (
          !new Set(["current", "fixed_history"]).has(
            entry.currentnessAtMigration,
          )
        )
          throw new Error("entry currentness is invalid");
        if (sources.has(entry.source) || targets.has(entry.target))
          throw new Error("entry source or target is duplicated");
        sources.add(entry.source);
        targets.add(entry.target);
        if (
          entry.currentnessAtMigration !== "fixed_history" ||
          !entry.target.replaceAll("\\", "/").includes("/Evidence/")
        )
          continue;
        byCurrentPath.set(
          entry.target.replaceAll("\\", "/"),
          entry as WorkLifecycleMigrationEntry,
        );
        byHistoricalPath.set(
          entry.source.replaceAll("\\", "/"),
          entry as WorkLifecycleMigrationEntry,
        );
      }
      return {
        byCurrentPath,
        byHistoricalPath,
        sourceCommit: parsed.sourceCommit,
      };
    } catch (error) {
      add(
        "error",
        "fixed-history-migration-map-invalid",
        relative(manifestPath),
        error instanceof Error ? error.message : String(error),
      );
      return empty;
    }
  }
  const fixedHistoryMigration = loadFixedHistoryMigration();
  const historicalContentCache = new Map<string, string | null>();
  /**
   * historical Contentを決定する。
   *
   * @responsibility historical Contentの導出に必要な入力、判定規則、返却結果の境界を所有する。
   * @trace ARCH-000001
   * @input relativePath: string
   * @returns string | nullを返す。
   * @precondition 「relativePath: string」がhistoricalContentの入力契約を満たす。
   * @postcondition historicalContentの責務を完了した結果だけを返す。
   * @effect Version Control公開操作で固定履歴本文を読み、このReader内cacheへ結果を保持する。File書込みなし。
   * @failure N/A: historicalContentは独自の失敗分岐を所有しない。
   * @invariant historicalContentは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: historicalContentはProcess内の同一Subsystemで完結する。
   * @security N/A: historicalContentはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: historicalContentは共有非同期状態を持たない同期処理である。
   */
  function historicalContent(relativePath: string): string | null {
    if (!fixedHistoryMigration.sourceCommit) return null;
    const normalized = relativePath.replaceAll("\\", "/");
    if (historicalContentCache.has(normalized))
      return historicalContentCache.get(normalized) ?? null;
    const content = readFixedSnapshotText(
      root,
      fixedHistoryMigration.sourceCommit,
      normalized,
    );
    historicalContentCache.set(normalized, content);
    return content;
  }
  /**
   * Link With Fixed Historyを一意に解決する。
   *
   * @responsibility Link With Fixed Historyの候補集合、解決規則、曖昧時の拒否境界を所有する。
   * @trace ARCH-000001
   * @input source: string、raw: string
   * @returns LinkRecordを返す。
   * @precondition 「source: string、raw: string」がresolveLinkWithFixedHistoryの入力契約を満たす。
   * @postcondition resolveLinkWithFixedHistoryの責務を完了した結果だけを返す。
   * @effect 現在FileのHashと固定Git履歴を読取り、不一致をaddへ渡す。File書込みなし。
   * @failure N/A: resolveLinkWithFixedHistoryは独自の失敗分岐を所有しない。
   * @invariant resolveLinkWithFixedHistoryは宣言した境界以外へEffectを拡張しない。
   * @boundary FilesystemとProcess内Domain処理の境界。
   * @security N/A: resolveLinkWithFixedHistoryはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: resolveLinkWithFixedHistoryは共有非同期状態を持たない同期処理である。
   */
  function resolveLinkWithFixedHistory(
    source: string,
    raw: string,
  ): LinkRecord {
    const currentSourcePath = relative(source);
    const migration =
      fixedHistoryMigration.byCurrentPath.get(currentSourcePath);
    if (!migration)
      return {
        source,
        raw,
        fixedHistoricalReference: false,
        historicalTargetExists: false,
        historicalAnchorExists: null,
        ...resolveLocalTarget(source, raw),
      };

    const actualSha256 = createHash("sha256")
      .update(fs.readFileSync(source))
      .digest("hex");
    if (actualSha256 !== migration.targetSha256)
      add(
        "error",
        "fixed-history-content-mismatch",
        currentSourcePath,
        `Expected ${migration.targetSha256}; observed ${actualSha256}.`,
      );

    const historicalSource = path.resolve(root, migration.source);
    const historical = resolveLocalTarget(historicalSource, raw);
    if (historical.external)
      return {
        source,
        raw,
        fixedHistoricalReference: true,
        historicalTargetExists: false,
        historicalAnchorExists: null,
        ...historical,
      };
    const historicalTargetPath = relative(historical.target);
    const content = historical.outsideRoot
      ? null
      : historicalContent(historicalTargetPath);
    const successor =
      fixedHistoryMigration.byHistoricalPath.get(historicalTargetPath);
    const target = successor
      ? path.resolve(root, successor.target)
      : historical.target;
    return {
      ...historical,
      source,
      raw,
      fixedHistoricalReference: true,
      target,
      outsideRoot: !isWithin(root, target),
      symbolicBoundary:
        isWithin(root, target) && pathContainsSymbolicLink(root, target),
      historicalTargetExists: content !== null,
      historicalAnchorExists:
        content === null || historical.anchor === ""
          ? null
          : parseMarkdownAnchors(content).has(historical.anchor),
    };
  }
  return { resolveLocalTarget, resolveLinkWithFixedHistory };
}

/**
 * 指定参照先の内向き・外向き参照を既存の順序で集計する。
 *
 * @responsibility 読取り順・例外・対象集合の既存条件を維持する。
 * @trace ARCH-000001
 * @input input: 同じ起動で観測したRoot・対象・参照・基準版情報。cliError: 既存の受付拒否。
 * @returns 未指定ならnull、指定ありなら従来のDocumentReferenceMap。
 * @precondition Rootの初回確認・File探索が完了している。
 * @postcondition 入力の参照順を保持して対象を返す。
 * @effect Filesystemを同期読取りし、基準版の未検査事項を入力のuncheckedItemsへ追加する。拒否時はcliErrorを呼ぶ。File書込みなし。
 * @failure 観測失敗と拒否callbackの例外を伝播する。
 * @invariant Root外・Link・基準版例外の受理集合を変更しない。
 * @boundary Checker内部の観測とCLI拒否の境界。
 * @security 観測失敗を安全と見なさない。
 * @concurrency N/A: 起動内の同期処理。
 */
export function buildDocumentReferenceMap(
  input: Readonly<{
    root: string;
    referencesValue: string | null;
    linkRecords: readonly LinkRecord[];
    gitlinkRoots: readonly string[];
    isBaselineSubmodule: boolean;
    adoptedBaselineRoot: string | null;
    allFileSet: ReadonlySet<string>;
    uncheckedItems: Set<string>;
  }>,
  cliError: (message: string) => never,
): DocumentReferenceMap | null {
  const {
    root,
    referencesValue,
    linkRecords,
    gitlinkRoots,
    isBaselineSubmodule,
    adoptedBaselineRoot,
    allFileSet,
    uncheckedItems,
  } = input;
  const relative = (file: string) =>
    path.relative(root, file).replaceAll("\\", "/") || ".";
  const gitlinkRootFor = (target: string) =>
    gitlinkRoots.find((item) => isWithin(item, target)) ?? null;
  let referenceMap: DocumentReferenceMap | null = null;
  if (referencesValue) {
    const referenceTarget = path.resolve(root, referencesValue);
    if (!isWithin(root, referenceTarget)) {
      cliError("--references must stay under the target root.");
    }
    if (pathContainsSymbolicLink(root, referenceTarget)) {
      cliError(
        `--references must not traverse a symbolic link: ${relative(referenceTarget)}`,
      );
    }
    const referenceGitlink = gitlinkRootFor(referenceTarget);
    const referenceIsInAdoptedBaseline =
      referenceGitlink &&
      isBaselineSubmodule &&
      adoptedBaselineRoot &&
      samePath(referenceGitlink, adoptedBaselineRoot);
    if (referenceGitlink && !referenceIsInAdoptedBaseline) {
      cliError(
        `--references points into a Gitlink submodule. Run the checker with --root ${relative(referenceGitlink)} after initializing that submodule.`,
      );
    }
    if (!fs.existsSync(referenceTarget)) {
      cliError(`--references does not exist: ${referencesValue}`);
    }
    const referenceStat = fs.statSync(referenceTarget);
    if (!referenceStat.isFile() && !referenceStat.isDirectory()) {
      cliError(`--references is not a file or directory: ${referencesValue}`);
    }
    const referenceIsInBaselineSubmodule =
      isBaselineSubmodule &&
      adoptedBaselineRoot &&
      isWithin(adoptedBaselineRoot, referenceTarget);
    if (referenceStat.isFile() && !allFileSet.has(referenceTarget)) {
      if (!referenceIsInBaselineSubmodule) {
        cliError(
          `--references is outside the project file set: ${referencesValue}`,
        );
      }
    }
    if (referenceIsInBaselineSubmodule) {
      uncheckedItems.add(
        "Outbound references inside the adopted CRDD baseline submodule",
      );
    }
    const isTargetDirectory = referenceStat.isDirectory();
    const inbound = new Map<
      string,
      {
        source: string;
        count: number;
        links: Set<string>;
      }
    >();
    const outbound = new Map<
      string,
      {
        target: string;
        anchor: string | null;
        count: number;
      }
    >();
    for (const record of linkRecords) {
      if (record.external) continue;
      if (
        record.target === referenceTarget ||
        (isTargetDirectory && isWithin(referenceTarget, record.target))
      ) {
        const source = relative(record.source);
        const item = inbound.get(source) ?? {
          source,
          count: 0,
          links: new Set(),
        };
        item.count += 1;
        item.links.add(record.raw);
        inbound.set(source, item);
      }
      if (
        record.source === referenceTarget ||
        (isTargetDirectory && isWithin(referenceTarget, record.source))
      ) {
        const target = relative(record.target);
        const key = `${target}#${record.anchor}`;
        const item = outbound.get(key) ?? {
          target,
          anchor: record.anchor || null,
          count: 0,
        };
        item.count += 1;
        outbound.set(key, item);
      }
    }
    referenceMap = {
      target: relative(referenceTarget),
      inbound: [...inbound.values()].map((item) => ({
        ...item,
        links: [...item.links],
      })),
      outbound: [...outbound.values()],
    };
  }

  return referenceMap;
}

/**
 * 選択済み文書の参照先とAnchorを現在観測する。
 *
 * @responsibility 除外・履歴・入れ子境界と検査件数、既存診断の発行順を所有する。
 * @trace ARCH-000001
 * @input input: 同じ起動の対象・参照・基準版と未検査集合。add: 既存診断収集先。
 * @returns 既存定義によるlocal linkとAnchorの確認件数。
 * @precondition 参照列と検査Scopeを元の順序で構築済みである。
 * @postcondition 観測した診断を追加し、該当する未検査事項を入力Setへ記録する。
 * @effect 対象の存在・metadata・必要なMarkdown本文を同期読取りする。File書込みなし。
 * @failure 元の観測例外とadd例外を伝播し、後続の処理を発行しない。
 * @invariant 履歴参照の実在性と現在の参照先を混同しない。
 * @boundary 現在Filesystemと既に確認した固定履歴の観測結果を用途別に扱う。
 * @security 未観測・Root外・Link境界を正常な内容検証へ昇格しない。
 * @concurrency N/A: 本起動内の同期検査と短命cache。
 */
export function inspectDocumentLinks(
  input: Readonly<{
    root: string;
    linkRecords: readonly LinkRecord[];
    checkedFiles: ReadonlySet<string>;
    allFileSet: ReadonlySet<string>;
    gitlinkRoots: readonly string[];
    isBaselineSubmodule: boolean;
    adoptedBaselineRoot: string | null;
    uncheckedItems: Set<string>;
  }>,
  add: (severity: string, code: string, file: string, message: string) => void,
): { checkedLocalLinks: number; checkedAnchors: number } {
  const {
    root,
    linkRecords,
    checkedFiles,
    allFileSet,
    gitlinkRoots,
    isBaselineSubmodule,
    adoptedBaselineRoot,
    uncheckedItems,
  } = input;
  const relative = (file: string) =>
    path.relative(root, file).replaceAll("\\", "/") || ".";
  const gitlinkRootFor = (target: string) =>
    gitlinkRoots.find((item) => isWithin(item, target)) ?? null;
  const read = (file: string) => fs.readFileSync(file, "utf8");
  /**
   * 検査対象の本文を読み、DomainのAnchor解析へ渡す。
   *
   * @responsibility 既存の読取り境界と本文解析の接続を所有する。
   * @trace ARCH-000001
   * @input file: string
   * @returns Set<string>を返す。
   * @precondition 「file: string」がanchorsForの入力契約を満たす。
   * @postcondition anchorsForの責務を完了した結果だけを返す。
   * @effect 検査対象のFilesystem本文を既存read経由で読み取る。書込みは行わない。
   * @failure 読取り失敗は既存readの扱いに従い、解析成功へ丸めない。
   * @invariant anchorsForは入力から導いた結果以外の共有状態を変更しない。
   * @boundary 検査対象Fileの読取り結果をDomain公開APIへ渡す。
   * @security N/A: anchorsForはAuthority、秘密値または信頼判断を扱わない。
   * @concurrency N/A: anchorsForは共有非同期状態を持たない同期処理である。
   */
  function anchorsFor(file: string): Set<string> {
    return parseMarkdownAnchors(read(file));
  }
  const anchorCache = new Map<string, Set<string>>();
  let checkedLocalLinks = 0;
  let checkedAnchors = 0;
  for (const record of linkRecords) {
    if (!checkedFiles.has(record.source) || record.external) continue;
    const { source, raw, target, anchor } = record;
    if (record.decodeError) {
      add("warning", "malformed-link-encoding", relative(source), raw);
      uncheckedItems.add(
        `Malformed link encoding in ${relative(source)}: ${raw}`,
      );
      continue;
    }
    if (record.outsideRoot) {
      add("warning", "outside-root-link", relative(source), raw);
      uncheckedItems.add(
        `Outside-root local link from ${relative(source)}: ${raw}`,
      );
      continue;
    }
    if (record.symbolicBoundary) {
      add("warning", "symbolic-link-target", relative(source), raw);
      uncheckedItems.add(
        `Symbolic link target from ${relative(source)}: ${raw}`,
      );
      continue;
    }
    if (record.fixedHistoricalReference) {
      checkedLocalLinks += 1;
      if (anchor && record.historicalTargetExists) {
        checkedAnchors += 1;
        if (record.historicalAnchorExists === false)
          add(
            "error",
            "broken-anchor",
            relative(source),
            `${raw} -> historical #${anchor}`,
          );
      }
      continue;
    }
    const targetGitlink = gitlinkRootFor(target);
    const targetIsInAdoptedBaseline =
      targetGitlink &&
      isBaselineSubmodule &&
      adoptedBaselineRoot &&
      samePath(targetGitlink, adoptedBaselineRoot);
    if (targetGitlink && !targetIsInAdoptedBaseline) {
      add("warning", "gitlink-target-unchecked", relative(source), raw);
      uncheckedItems.add(
        `Gitlink target not inspected from ${relative(source)}: ${raw}`,
      );
      continue;
    }
    if (
      !allFileSet.has(target) &&
      fs.existsSync(target) &&
      !fs.statSync(target).isDirectory() &&
      !(
        isBaselineSubmodule &&
        adoptedBaselineRoot &&
        isWithin(adoptedBaselineRoot, target)
      )
    ) {
      add("warning", "excluded-local-link", relative(source), raw);
      uncheckedItems.add(
        `Excluded local link target from ${relative(source)}: ${raw}`,
      );
      continue;
    }
    if (!fs.existsSync(target)) {
      checkedLocalLinks += 1;
      add("error", "broken-link", relative(source), raw);
      continue;
    }
    checkedLocalLinks += 1;
    if (anchor && target.toLowerCase().endsWith(".md")) {
      checkedAnchors += 1;
      const knownAnchors = anchorCache.get(target) ?? anchorsFor(target);
      anchorCache.set(target, knownAnchors);
      if (!knownAnchors.has(anchor)) {
        add("error", "broken-anchor", relative(source), `${raw} -> #${anchor}`);
      }
    }
  }

  return { checkedLocalLinks, checkedAnchors };
}

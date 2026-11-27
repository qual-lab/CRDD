/**
 * reality-symbol-repository-observerに属する責務をまとめる。
 *
 * @responsibility RealityRepositoryObservationIssueを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000008
 */

import type { DocumentIssue } from "../artifact/types.ts";
import { discoverRealitySymbols } from "../reality-traceability/discover.ts";
import type { LoadedRealitySymbolManifest } from "../reality-traceability/manifest.ts";
import { parseRealitySymbolManifest } from "../reality-traceability/manifest.ts";
import {
  inspectTestCatalog,
  observeCatalogPath,
  type TestCatalog,
  testCatalogPath,
} from "../test-catalog/inspect.ts";
import { createFilesystemRepositoryObservationPort } from "./create-observer.ts";

/**
 * reality-symbol-repository-observerで使用するReality Repository Observation Issueの値契約を定義する。
 *
 * @responsibility Reality Repository Observation IssueのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealityRepositoryObservationIssueが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealityRepositoryObservationIssueで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealityRepositoryObservationIssueの宣言は外部境界を開かない。
 * @security N/A: RealityRepositoryObservationIssueはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealityRepositoryObservationIssueの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealityRepositoryObservationIssue = Readonly<{
  code: string;
  path: string;
  reason: string;
}>;

/**
 * reality-symbol-repository-observerで使用するReality Symbol Repository Observationの値契約を定義する。
 *
 * @responsibility Reality Symbol Repository ObservationのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000008
 * @shape RealitySymbolRepositoryObservationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RealitySymbolRepositoryObservationで宣言した値と責務の対応を維持する。
 * @boundary N/A: RealitySymbolRepositoryObservationの宣言は外部境界を開かない。
 * @security N/A: RealitySymbolRepositoryObservationはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility RealitySymbolRepositoryObservationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type RealitySymbolRepositoryObservation = Readonly<{
  manifests: readonly LoadedRealitySymbolManifest[];
  catalog: TestCatalog | null;
  catalogWarnings: readonly string[];
  knownArchIds: ReadonlySet<string>;
  knownQaIds: ReadonlySet<string>;
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>;
  domainIssues: readonly DocumentIssue[];
  repositoryIssues: readonly RealityRepositoryObservationIssue[];
}>;

/**
 * Reality Symbol Repositoryを観測する。
 *
 * @responsibility Reality Symbol Repositoryの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000008
 * @input root: 呼出し元が選んだ絶対Directory。
 * @returns RealitySymbolRepositoryObservationを返す。
 * @precondition 観測対象の選定は呼出し側が行う。
 * @postcondition observeRealitySymbolRepositoryの責務を完了した結果だけを返す。
 * @effect N/A: observeRealitySymbolRepositoryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure observeRealitySymbolRepositoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant observeRealitySymbolRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security observeRealitySymbolRepositoryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeRealitySymbolRepositoryは共有非同期状態を持たない同期処理である。
 */
export function observeRealitySymbolRepository(
  root: string | null,
  includeArchitectureWithoutOwners = true,
): RealitySymbolRepositoryObservation {
  const repository = createFilesystemRepositoryObservationPort(root);
  const repositoryIssues: RealityRepositoryObservationIssue[] = [];
  const recordIssue = (code: string, path: string, reason: string): void => {
    repositoryIssues.push({ code, path, reason });
  };
  const identities = (directoryPath: string, pattern: RegExp) => {
    const observed = repository.observeDirectory(directoryPath);
    if (observed.status !== "resolved") {
      recordIssue(
        "reality-symbol-canonical-definitions-unobservable",
        directoryPath,
        observed.reason,
      );
      return new Set<string>();
    }
    return new Set(
      observed.entries
        .filter(({ kind, name }) => kind === "directory" && pattern.test(name))
        .map(({ name }) => name),
    );
  };
  const catalogFile = repository.observeFile(testCatalogPath);
  let catalog: TestCatalog | null = null;
  let catalogWarnings: readonly string[] = [];
  if (catalogFile.status === "resolved" && root !== null) {
    let candidate: unknown;
    try {
      candidate = JSON.parse(catalogFile.source);
    } catch {
      recordIssue(
        "reality-symbol-test-catalog-json-invalid",
        testCatalogPath,
        "Invalid JSON.",
      );
    }
    if (candidate !== undefined) {
      const intake = inspectTestCatalog(root, candidate);
      catalogWarnings = intake.warnings;
      for (const failure of intake.failures)
        recordIssue(
          "reality-symbol-test-catalog-invalid",
          testCatalogPath,
          failure,
        );
      if (!intake.failures.length) catalog = candidate as TestCatalog;
    }
  } else if (
    catalogFile.status !== "resolved" &&
    (catalogFile.status === "invalid" ||
      root === null ||
      observeCatalogPath(root, testCatalogPath, new Map()) !== "missing")
  ) {
    recordIssue(
      "reality-symbol-test-catalog-unobservable",
      testCatalogPath,
      catalogFile.reason,
    );
  }

  const knownArchIds =
    includeArchitectureWithoutOwners || catalog?.owners.length
      ? identities("06_Architecture/Definitions", /^ARCH-[0-9]{6}$/u)
      : new Set<string>();
  const knownQaIds = catalog?.owners.length
    ? identities("07_Quality/Definitions", /^QA-[0-9]{6}$/u)
    : new Set<string>();
  const knownLocalTestIdsByQaId = new Map<string, ReadonlySet<string>>();
  for (const qaId of [...knownQaIds].sort()) {
    const definitionPath = `07_Quality/Definitions/${qaId}/quality_definition.md`;
    const observed = repository.observeFile(definitionPath);
    if (observed.status !== "resolved") {
      recordIssue(
        "reality-symbol-quality-definition-unobservable",
        definitionPath,
        observed.reason,
      );
      continue;
    }
    const heading = /^## [0-9]+\. 検証項目\s*$/mu.exec(observed.source);
    const remainder = heading
      ? observed.source.slice(heading.index + heading[0].length)
      : "";
    const nextHeading = remainder.search(/^##\s/mu);
    const section =
      nextHeading >= 0 ? remainder.slice(0, nextHeading) : remainder;
    const localIds = new Set<string>();
    for (const line of section.split(/\r?\n/u)) {
      const match = /^\|\s*`([^`]+)`\s*\|/u.exec(line);
      if (match?.[1]) localIds.add(match[1]);
    }
    knownLocalTestIdsByQaId.set(qaId, localIds);
  }

  const sources = [];
  for (const owner of catalog?.owners ?? []) {
    const subsystemPath = owner.root;
    const manifestPath = `${subsystemPath}/symbol.json`;
    const manifest = repository.observeFile(manifestPath);
    if (manifest.status !== "resolved") {
      const missing =
        root !== null &&
        manifest.status === "unobservable" &&
        observeCatalogPath(root, manifestPath, new Map()) === "missing";
      recordIssue(
        missing
          ? "reality-symbol-manifest-missing"
          : "reality-symbol-manifest-observation-failed",
        manifestPath,
        manifest.reason,
      );
      continue;
    }
    const symbolSources = new Map<string, string>();
    const symbolDirectories = new Set<string>();
    const observedPaths = new Set<string>();
    try {
      const validated = parseRealitySymbolManifest(
        JSON.parse(manifest.source),
        manifestPath,
      );
      for (const symbol of validated.result?.symbols ?? []) {
        if (observedPaths.has(symbol.path)) continue;
        observedPaths.add(symbol.path);
        const target = `${subsystemPath}/${symbol.path}`;
        const observed = repository.observeFile(target);
        if (observed.status === "resolved")
          symbolSources.set(symbol.path, observed.source);
        else if (
          validated.result?.symbols.some(
            (entry) =>
              entry.path === symbol.path &&
              (entry.kind === "package" || entry.kind === "module"),
          ) &&
          repository.observeDirectory(target).status === "resolved"
        )
          symbolDirectories.add(symbol.path);
      }
    } catch {
      // Domain discovery reports malformed JSON without inventing symbols.
    }
    sources.push({
      subsystem: owner.id,
      subsystemPath,
      manifestPath,
      manifestSource: manifest.source,
      symbolSources,
      symbolDirectories,
    });
  }
  const discovered = discoverRealitySymbols({
    sources,
    prerequisiteIssues: [],
  });
  return {
    manifests: discovered.result?.manifests ?? [],
    catalog,
    catalogWarnings,
    knownArchIds,
    knownQaIds,
    knownLocalTestIdsByQaId,
    domainIssues: discovered.issues,
    repositoryIssues,
  };
}

/**
 * Repositoryの実装・試験Traceを観測して診断へ接続する。
 *
 * @responsibility Root再検証とManifest・Catalogから成果物関係を構築する。Source内部は解析しない。
 * @trace ARCH-000001
 */

import {
  createRealitySymbolGraph as createDomainRealitySymbolGraph,
  createFilesystemRepositoryObservationPort,
  type LoadedRealitySymbolManifest,
  observeRealitySymbolRepository,
  parseRealityTestCatalog,
  type RealitySymbolGraph,
  type RepositoryObservationPort,
  testCatalogPath,
} from "@qual-lab/crdd-document-model";
import type { Repository } from "@qual-lab/crdd-version-control";
import { resolveVerifiedRepositoryRoot } from "@qual-lab/crdd-version-control";
import { mapRealityDomainIssueToCheckerFinding } from "../report/reality.ts";
import type { CheckerFinding, CheckerRealityFinding } from "../report/types.ts";
import { inspectRealityCoverage } from "./reality-coverage.ts";
/**
 * 固定された適用条件の後でRealityの観測と診断を行う。
 *
 * @responsibility Root・Manifest・Catalog・Graphの構造確認を行い、実行結果を推定しない。
 * @trace ARCH-000001
 * @input repositoryRoot: 適用対象Root。add: この観測の診断収集先。
 * @returns N/A: 診断をaddへ渡す。
 * @precondition 適用の初期観測と十工程の検査は呼出し元が実施済みである。
 * @postcondition 取得不能を正常化せず、既存code・rule・Path・文言を渡す。
 * @effect 台帳を一度読み、宣言された所有者のManifestと注釈を観測する。書込みなし。
 * @failure 台帳・実装の観測不能は診断に残す。
 * @invariant 登録の構造成立を試験実行・Pass・観測済みEvidenceへ昇格しない。
 * @boundary Repository・Version Control公開APIとDomainモデルの境界。
 * @security 未実行の宣言を実行済みEvidenceにしない。
 * @concurrency N/A: 同じ起動内の同期観測。
 */
export function inspectRealityRepository(
  repositoryRoot: string,
  add: (finding: CheckerFinding) => void,
  official = false,
  trackedFilePaths: readonly string[] | null = null,
): void {
  const discovery = observeRealitySymbolRepository(repositoryRoot, false);
  const manifests = discovery.manifests;
  if (discovery.catalog)
    inspectRealityCoverage(discovery.catalog, manifests, trackedFilePaths, add);
  const registeredTests = new Map(
    discovery.catalog?.tests.map((entry) => [
      entry.path,
      { owner: entry.owner, testId: entry.id },
    ]),
  );
  for (const warning of discovery.catalogWarnings)
    add({
      severity: "warning",
      code: "test-catalog-warning",
      path: testCatalogPath,
      rule: "current-profile.reality-symbol-graph",
      message: warning,
    });
  if (official && discovery.catalog) {
    const develop =
      createFilesystemRepositoryObservationPort(
        repositoryRoot,
      ).observeDirectory("40_Develop");
    if (develop.status === "resolved") {
      const roots = discovery.catalog.owners.map(({ root }) => root);
      for (const entry of develop.entries) {
        if (entry.kind !== "directory" && entry.kind !== "symbolic-link")
          continue;
        const entryPath = `40_Develop/${entry.name}`;
        if (
          roots.some(
            (root) => root === entryPath || root.startsWith(`${entryPath}/`),
          )
        )
          continue;
        add({
          severity: "warning",
          code: "reality-symbol-owner-undeclared",
          path: entryPath,
          rule: "current-profile.reality-symbol-graph",
          message:
            "No test-catalog owner declares this implementation directory.",
        });
      }
    }
  }
  const built = createRealitySymbolGraph(
    manifests,
    discovery.knownArchIds,
    discovery.knownQaIds,
    discovery.knownLocalTestIdsByQaId,
    registeredTests,
    [
      ...discovery.repositoryIssues.map(({ code, path, reason }) => ({
        code,
        path,
        message: reason,
      })),
      ...discovery.domainIssues.map(mapRealityDomainIssueToCheckerFinding),
    ],
  );
  for (const finding of [...built.findings])
    add({
      severity: "error",
      code: finding.code,
      path: finding.path,
      rule: "current-profile.reality-symbol-graph",
      message: finding.message,
    });
}

/**
 * Reality Symbol Graphを構築する。
 *
 * @responsibility Reality Symbol Graphの構築入力、生成結果、不正入力の拒否境界を所有する。
 * @trace ARCH-000001
 * @input loadedManifests: readonly LoadedRealitySymbolManifest[]、knownArchIds: ReadonlySet<string>、knownQaIds: ReadonlySet<string>、knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>、registeredTestsByPath: ReadonlyMap< string, Readonly<{ owner: string; testId: string }> > | null、prerequisiteFindings: readonly CheckerRealityFinding[]
 * @returns Readonly<{ graph: RealitySymbolGraph | null; findings: readonly CheckerRealityFinding[]; }>を返す。
 * @precondition 「loadedManifests: readonly LoadedRealitySymbolManifest[]、knownArchIds: ReadonlySet<string>、knownQaIds: ReadonlySet<string>、knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>、registeredTestsByPath: ReadonlyMap< string, Readonly<{ owner: string; testId: string }> > | null、prerequisiteFindings: readonly CheckerRealityFinding[]」がcreateRealitySymbolGraphの入力契約を満たす。
 * @postcondition createRealitySymbolGraphの責務を完了した結果だけを返す。
 * @effect N/A: createRealitySymbolGraphは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createRealitySymbolGraphは独自の失敗分岐を所有しない。
 * @invariant createRealitySymbolGraphは入力から導いた結果以外の共有状態を変更しない。
 * @boundary 中立Graph結果と既存診断の同期変換境界。
 * @security N/A: createRealitySymbolGraphはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: createRealitySymbolGraphは共有非同期状態を持たない同期処理である。
 */
export function createRealitySymbolGraph(
  loadedManifests: readonly LoadedRealitySymbolManifest[],
  knownArchIds: ReadonlySet<string>,
  knownQaIds: ReadonlySet<string>,
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>,
  registeredTestsByPath: ReadonlyMap<
    string,
    Readonly<{ owner: string; testId: string }>
  > | null,
  prerequisiteFindings: readonly CheckerRealityFinding[],
): Readonly<{
  graph: RealitySymbolGraph | null;
  findings: readonly CheckerRealityFinding[];
}> {
  if (prerequisiteFindings.length > 0)
    return { graph: null, findings: prerequisiteFindings };
  const outcome = createDomainRealitySymbolGraph(
    loadedManifests,
    knownArchIds,
    knownQaIds,
    knownLocalTestIdsByQaId,
    registeredTestsByPath,
    [],
  );
  return {
    graph: outcome.result,
    findings: outcome.issues.map(mapRealityDomainIssueToCheckerFinding),
  };
}

/**
 * Reality Symbol Manifestsを探索する。
 *
 * @responsibility Reality Symbol Manifestsの探索Root、対象母集団、未観測境界を所有する。
 * @trace ARCH-000001
 * @input capability: Repository
 * @returns Readonly<{ manifests: readonly LoadedRealitySymbolManifest[]; knownArchIds: ReadonlySet<string>; knownQaIds: ReadonlySet<string>; knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>; findings: readonly CheckerRealityFinding[]; }>を返す。
 * @precondition 「capability: Repository」がdiscoverRealitySymbolManifestsの入力契約を満たす。
 * @postcondition discoverRealitySymbolManifestsの責務を完了した結果だけを返す。
 * @effect 検証済みRepositoryのManifest・関連文書を観測する。書込みなし。
 * @failure N/A: discoverRealitySymbolManifestsは独自の失敗分岐を所有しない。
 * @invariant discoverRealitySymbolManifestsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Repository Observation／Filesystem読取りとDomain結果接続の境界。
 * @security discoverRealitySymbolManifestsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: discoverRealitySymbolManifestsは共有非同期状態を持たない同期処理である。
 */
export function discoverRealitySymbolManifests(
  capability: Repository,
): Readonly<{
  manifests: readonly LoadedRealitySymbolManifest[];
  knownArchIds: ReadonlySet<string>;
  knownQaIds: ReadonlySet<string>;
  knownLocalTestIdsByQaId: ReadonlyMap<string, ReadonlySet<string>>;
  findings: readonly CheckerRealityFinding[];
}> {
  const observed = observeRealitySymbolRepository(
    resolveVerifiedRepositoryRoot(capability),
  );
  return {
    manifests: observed.manifests,
    knownArchIds: observed.knownArchIds,
    knownQaIds: observed.knownQaIds,
    knownLocalTestIdsByQaId: observed.knownLocalTestIdsByQaId,
    findings: [
      ...observed.repositoryIssues.map(({ code, path, reason }) => ({
        code,
        path,
        message: reason,
      })),
      ...observed.domainIssues.map(mapRealityDomainIssueToCheckerFinding),
    ],
  };
}

/**
 * Registered Reality Testsを読み取る。
 *
 * @responsibility Registered Reality Testsの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000001
 * @input capability: Repository
 * @returns ReturnType<typeof readRegisteredRealityTestsFromRepository>を返す。
 * @precondition 「capability: Repository」がreadRegisteredRealityTestsの入力契約を満たす。
 * @postcondition readRegisteredRealityTestsの責務を完了した結果だけを返す。
 * @effect 検証済みRepositoryのCatalogを同期観測する。書込みなし。
 * @failure N/A: readRegisteredRealityTestsは独自の失敗分岐を所有しない。
 * @invariant readRegisteredRealityTestsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Repository Observation／Filesystem読取りとDomain結果接続の境界。
 * @security readRegisteredRealityTestsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readRegisteredRealityTestsは共有非同期状態を持たない同期処理である。
 */
export function readRegisteredRealityTests(
  capability: Repository,
): ReturnType<typeof readRegisteredRealityTestsFromRepository> {
  return readRegisteredRealityTestsFromRepository(
    createFilesystemRepositoryObservationPort(
      resolveVerifiedRepositoryRoot(capability),
    ),
  );
}

/**
 * Registered Reality Tests From Repositoryを読み取る。
 *
 * @responsibility Registered Reality Tests From Repositoryの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000001
 * @input repository: RepositoryObservationPort
 * @returns Readonly<{ testsByPath: ReadonlyMap<string, Readonly<{owner:string;testId:string}>> | null; findings: readonly CheckerRealityFinding[]; }>を返す。
 * @precondition 「repository: RepositoryObservationPort」がreadRegisteredRealityTestsFromRepositoryの入力契約を満たす。
 * @postcondition readRegisteredRealityTestsFromRepositoryの責務を完了した結果だけを返す。
 * @effect 指定されたRepository Observation PortからCatalogを一回観測する。書込みなし。
 * @failure readRegisteredRealityTestsFromRepositoryは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readRegisteredRealityTestsFromRepositoryは入力から導いた結果以外の共有状態を変更しない。
 * @boundary Repository Observation／Filesystem読取りとDomain結果接続の境界。
 * @security N/A: readRegisteredRealityTestsFromRepositoryはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readRegisteredRealityTestsFromRepositoryは共有非同期状態を持たない同期処理である。
 */
export function readRegisteredRealityTestsFromRepository(
  repository: RepositoryObservationPort,
): Readonly<{
  testsByPath: ReadonlyMap<
    string,
    Readonly<{ owner: string; testId: string }>
  > | null;
  findings: readonly CheckerRealityFinding[];
}> {
  const catalogRelativePath = testCatalogPath;
  const observation = repository.observeFile(catalogRelativePath);
  if (observation.status !== "resolved")
    return {
      testsByPath: null,
      findings: [
        {
          code:
            observation.status === "invalid"
              ? "reality-symbol-test-catalog-boundary-invalid"
              : "reality-symbol-test-catalog-unobservable",
          path: catalogRelativePath,
          message: `Test Catalog is not a repository-local regular file: ${observation.reason}.`,
        },
      ],
    };
  const outcome = parseRealityTestCatalog({
    path: catalogRelativePath,
    content: observation.source,
  });
  return {
    testsByPath: outcome.result,
    findings: outcome.issues.map(mapRealityDomainIssueToCheckerFinding),
  };
}

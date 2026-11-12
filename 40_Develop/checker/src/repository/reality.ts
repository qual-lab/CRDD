/**
 * Repositoryの実装・試験Traceを観測して診断へ接続する。
 *
 * @responsibility Root再検証とManifest・Catalogから成果物関係を構築する。Source内部は解析しない。
 * @trace ARCH-000001
 */
import { getRepository } from "../../../version-control/src/index.ts";
import {
  createRealitySymbolGraph as createDomainRealitySymbolGraph,
  type LoadedRealitySymbolManifest,
  type RealitySymbolGraph,
  observeRealitySymbolRepository,
  createFilesystemRepositoryObservationPort,
  type RepositoryObservationPort,
  inspectRealityTestCatalog,
} from "../../../document-model/src/index.ts";
import type { Repository } from "../../../version-control/src/index.ts";
import { mapRealityDomainIssueToCheckerFinding } from "../report/reality.ts";
import type { CheckerRealityFinding } from "../report/types.ts";
import type { CheckerFinding } from "../report/types.ts";
/**
 * 固定された適用条件の後でRealityの観測と診断を行う。
 *
 * @responsibility Root・Manifest・Catalog・Graphの構造確認を行い、実行結果を推定しない。
 * @trace ARCH-000001
 * @input repositoryRoot: 適用対象Root。add: この観測の診断収集先。
 * @returns N/A: 診断をaddへ渡す。
 * @precondition 適用の初期観測と十工程の検査は呼出し元が実施済みである。
 * @postcondition 取得不能を正常化せず、既存code・rule・Path・文言を渡す。
 * @effect Rootを再検証し、Manifestがある場合だけCatalogを読む。登録Pathの実体は観測するがSource本文は解析しない。書込みなし。
 * @failure Root未検証は診断、その他の既存観測例外・add例外は伝播する。
 * @invariant 登録の構造成立を試験実行・Pass・観測済みEvidenceへ昇格しない。
 * @boundary Repository・Version Control公開APIとDomainモデルの境界。
 * @security 未実行の宣言を実行済みEvidenceにしない。
 * @concurrency N/A: 同じ起動内の同期観測。
 */
export function inspectRealityRepository(
  repositoryRoot: string,
  add: (finding: CheckerFinding) => void,
): void {
  const verified = getRepository(repositoryRoot);
  if (verified.status !== "completed") {
    add({
      severity: "error",
      code: "reality-symbol-repository-root-unverified",
      path: ".",
      rule: "current-profile.reality-symbol-graph",
      message: verified.reason,
    });
    return;
  }
  const discovery = discoverRealitySymbolManifests(verified.capability);
  const testCatalog =
    discovery.manifests.length > 0
      ? readRegisteredRealityTests(verified.capability)
      : { testsByPath: new Map(), findings: [] };
  const built = createRealitySymbolGraph(
    discovery.manifests,
    discovery.knownArchIds,
    discovery.knownQaIds,
    discovery.knownLocalTestIdsByQaId,
    testCatalog.testsByPath,
    [...discovery.findings, ...testCatalog.findings],
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
  const observed = observeRealitySymbolRepository(capability);
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
    createFilesystemRepositoryObservationPort(capability),
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
  const catalogRelativePath = "07_Quality/Registry/test-catalog.json";
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
  let value: unknown;
  try {
    value = JSON.parse(observation.source);
  } catch {
    return {
      testsByPath: null,
      findings: [
        {
          code: "reality-symbol-test-catalog-unobservable",
          path: catalogRelativePath,
          message: "Test Catalog could not be read as valid JSON.",
        },
      ],
    };
  }
  const outcome = inspectRealityTestCatalog(value, catalogRelativePath);
  return {
    testsByPath: outcome.result,
    findings: outcome.issues.map(mapRealityDomainIssueToCheckerFinding),
  };
}

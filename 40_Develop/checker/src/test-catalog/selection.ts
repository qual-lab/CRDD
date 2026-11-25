/**
 * 回帰対象・静的Owner・高負荷試験の実行条件を決める。
 * @responsibility 台帳モデルを入力として保守的な変更影響と明示条件を評価し、試験を起動しない。
 * @trace ARCH-000003
 */
import type {
  TestCatalog,
  TestCatalogEntry,
  TestLevel,
} from "@qual-lab/crdd-document-model";

/**
 * test-catalogで使用するResource Intensive Test Authorityの値契約を定義する。
 *
 * @responsibility Resource Intensive Test AuthorityのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000003
 * @shape ResourceIntensiveTestAuthorityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ResourceIntensiveTestAuthorityで宣言した値と責務の対応を維持する。
 * @boundary N/A: ResourceIntensiveTestAuthorityの宣言は外部境界を開かない。
 * @security N/A: ResourceIntensiveTestAuthorityはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ResourceIntensiveTestAuthorityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ResourceIntensiveTestAuthority = Readonly<{
  authorized: boolean;
  purpose: string | null;
  environment: string | null;
  maximumDurationMinutes: number | null;
  maximumInvocations: number | null;
  maximumCredits: number | null;
  cleanup: string | null;
  stopCondition: string | null;
}>;

/**
 * Resource Intensive Test Authorityを観測する。
 *
 * @responsibility Resource Intensive Test Authorityの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000003
 * @input levels: ReadonlySet<TestLevel>、authority: ResourceIntensiveTestAuthority
 * @returns readonly string[]を返す。
 * @precondition 「levels: ReadonlySet<TestLevel>、authority: ResourceIntensiveTestAuthority」がinspectResourceIntensiveTestAuthorityの入力契約を満たす。
 * @postcondition inspectResourceIntensiveTestAuthorityの責務を完了した結果だけを返す。
 * @effect N/A: inspectResourceIntensiveTestAuthorityは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectResourceIntensiveTestAuthorityは独自の失敗分岐を所有しない。
 * @invariant inspectResourceIntensiveTestAuthorityは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectResourceIntensiveTestAuthorityはProcess内の同一Subsystemで完結する。
 * @security inspectResourceIntensiveTestAuthorityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectResourceIntensiveTestAuthorityは共有非同期状態を持たない同期処理である。
 */
export function inspectResourceIntensiveTestAuthority(
  levels: ReadonlySet<TestLevel>,
  authority: ResourceIntensiveTestAuthority,
): readonly string[] {
  if (!levels.has("performance") && !levels.has("longevity")) return [];
  const failures: string[] = [];
  if (!authority.authorized) failures.push("authorization_missing");
  if (!authority.purpose) failures.push("purpose_missing");
  if (!authority.environment) failures.push("environment_missing");
  if (
    authority.maximumDurationMinutes === null ||
    authority.maximumDurationMinutes <= 0
  )
    failures.push("duration_cap_missing");
  if (
    authority.maximumInvocations === null ||
    !Number.isInteger(authority.maximumInvocations) ||
    authority.maximumInvocations <= 0
  )
    failures.push("invocation_cap_missing");
  if (authority.maximumCredits === null || authority.maximumCredits < 0)
    failures.push("credit_cap_missing");
  if (!authority.cleanup) failures.push("cleanup_missing");
  if (!authority.stopCondition) failures.push("stop_condition_missing");
  return failures;
}

/**
 * owner For Pathを決定する。
 *
 * @responsibility owner For Pathの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input changedPath: string
 * @returns TestCatalogEntry["owner"] | nullを返す。
 * @precondition 「changedPath: string」がownerForPathの入力契約を満たす。
 * @postcondition ownerForPathの責務を完了した結果だけを返す。
 * @effect N/A: ownerForPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: ownerForPathは独自の失敗分岐を所有しない。
 * @invariant ownerForPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: ownerForPathはProcess内の同一Subsystemで完結する。
 * @security N/A: ownerForPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: ownerForPathは共有非同期状態を持たない同期処理である。
 */
function ownerForPath(changedPath: string): TestCatalogEntry["owner"] | null {
  if (changedPath.startsWith("40_Develop/access-management/"))
    return "access-management";
  if (changedPath.startsWith("40_Develop/ai-adapter/")) return "ai-adapter";
  if (changedPath.startsWith("40_Develop/coordinator/")) return "coordinator";
  if (changedPath.startsWith("40_Develop/docker-isolation/"))
    return "docker-isolation";
  if (changedPath.startsWith("40_Develop/checker/")) return "checker";
  if (changedPath.startsWith("40_Develop/visual-preview/"))
    return "visual-preview";
  if (changedPath.startsWith("40_Develop/document-model/"))
    return "document-model";
  if (changedPath.startsWith("40_Develop/execution-model/"))
    return "execution-model";
  if (changedPath.startsWith("40_Develop/configuration-model/"))
    return "configuration-model";
  if (changedPath.startsWith("40_Develop/execution-intelligence/"))
    return "execution-intelligence";
  if (changedPath.startsWith("40_Develop/executor/")) return "executor";
  if (changedPath.startsWith("40_Develop/lock/")) return "lock";
  if (changedPath.startsWith("40_Develop/crdd-server/")) return "crdd-server";
  if (changedPath.startsWith("40_Develop/version-control/"))
    return "version-control";
  if (changedPath.startsWith("40_Develop/workbench-ui/")) return "workbench-ui";
  return null;
}

/**
 * Documentation Pathかを判定する。
 *
 * @responsibility Documentation Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000003
 * @input changedPath: string
 * @returns booleanを返す。
 * @precondition 「changedPath: string」がisDocumentationPathの入力契約を満たす。
 * @postcondition isDocumentationPathの責務を完了した結果だけを返す。
 * @effect N/A: isDocumentationPathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDocumentationPathは独自の失敗分岐を所有しない。
 * @invariant isDocumentationPathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDocumentationPathはProcess内の同一Subsystemで完結する。
 * @security N/A: isDocumentationPathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isDocumentationPathは共有非同期状態を持たない同期処理である。
 */
function isDocumentationPath(changedPath: string): boolean {
  return changedPath.toLowerCase().endsWith(".md");
}

/**
 * Shared Runtime Pathかを判定する。
 *
 * @responsibility Shared Runtime Pathの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000003
 * @input changedPath: string
 * @returns booleanを返す。
 * @precondition 「changedPath: string」がisSharedRuntimePathの入力契約を満たす。
 * @postcondition isSharedRuntimePathの責務を完了した結果だけを返す。
 * @effect N/A: isSharedRuntimePathは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isSharedRuntimePathは独自の失敗分岐を所有しない。
 * @invariant isSharedRuntimePathは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isSharedRuntimePathはProcess内の同一Subsystemで完結する。
 * @security N/A: isSharedRuntimePathはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isSharedRuntimePathは共有非同期状態を持たない同期処理である。
 */
function isSharedRuntimePath(changedPath: string): boolean {
  return (
    changedPath === "07_Quality/Registry/test-catalog.json" ||
    changedPath === "biome.json" ||
    changedPath === ".node-version" ||
    changedPath === ".nvmrc"
  );
}

/**
 * applicable Consumer Bindingsを決定する。
 *
 * @responsibility applicable Consumer Bindingsの導出に必要な入力、判定規則、返却結果の境界を所有する。
 * @trace ARCH-000003
 * @input catalog: TestCatalog、changedPath: string、producerOwner: TestCatalogEntry["owner"]
 * @returns applicableConsumerBindingsの計算結果を返す。
 * @precondition 「catalog: TestCatalog、changedPath: string、producerOwner: TestCatalogEntry["owner"]」がapplicableConsumerBindingsの入力契約を満たす。
 * @postcondition applicableConsumerBindingsの責務を完了した結果だけを返す。
 * @effect N/A: applicableConsumerBindingsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: applicableConsumerBindingsは独自の失敗分岐を所有しない。
 * @invariant applicableConsumerBindingsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: applicableConsumerBindingsはProcess内の同一Subsystemで完結する。
 * @security N/A: applicableConsumerBindingsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: applicableConsumerBindingsは共有非同期状態を持たない同期処理である。
 */
function applicableConsumerBindings(
  catalog: TestCatalog,
  changedPath: string,
  producerOwner: TestCatalogEntry["owner"],
) {
  const ownerBindings = catalog.consumerBindings.filter(
    (binding) => binding.producerOwner === producerOwner,
  );
  const matchedBindings = ownerBindings.filter((binding) =>
    binding.producerPaths.some(
      (producerPath) =>
        changedPath === producerPath ||
        changedPath.startsWith(
          producerPath.endsWith("/") ? producerPath : `${producerPath}/`,
        ),
    ),
  );
  return matchedBindings.length > 0 ? matchedBindings : ownerBindings;
}

/**
 * Regression Static Ownersを選択する。
 *
 * @responsibility Regression Static Ownersの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000003
 * @input catalog: TestCatalog、changedPaths: readonly string[]、selectedEntries: readonly TestCatalogEntry[]
 * @returns readonly TestCatalogEntry["owner"][]を返す。
 * @precondition 「catalog: TestCatalog、changedPaths: readonly string[]、selectedEntries: readonly TestCatalogEntry[]」がselectRegressionStaticOwnersの入力契約を満たす。
 * @postcondition selectRegressionStaticOwnersの責務を完了した結果だけを返す。
 * @effect N/A: selectRegressionStaticOwnersは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectRegressionStaticOwnersは独自の失敗分岐を所有しない。
 * @invariant selectRegressionStaticOwnersは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectRegressionStaticOwnersはProcess内の同一Subsystemで完結する。
 * @security N/A: selectRegressionStaticOwnersはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: selectRegressionStaticOwnersは共有非同期状態を持たない同期処理である。
 */
export function selectRegressionStaticOwners(
  catalog: TestCatalog,
  changedPaths: readonly string[],
  selectedEntries: readonly TestCatalogEntry[],
): readonly TestCatalogEntry["owner"][] {
  const owners = new Set(selectedEntries.map((entry) => entry.owner));
  for (const rawPath of changedPaths) {
    const changedPath = rawPath.replaceAll("\\", "/").replace(/^\.\//u, "");
    const direct = catalog.tests.find(
      (entry) => entry.path.toLowerCase() === changedPath.toLowerCase(),
    );
    if (direct !== undefined) {
      owners.add(direct.owner);
      continue;
    }
    if (isDocumentationPath(changedPath)) {
      owners.add("checker");
      continue;
    }
    if (
      isSharedRuntimePath(changedPath) ||
      ownerForPath(changedPath) === null
    ) {
      for (const entry of catalog.tests) owners.add(entry.owner);
      continue;
    }
    const owner = ownerForPath(changedPath);
    if (owner === null) continue;
    owners.add(owner);
    for (const binding of applicableConsumerBindings(
      catalog,
      changedPath,
      owner,
    ))
      if (binding.consumerStatic) owners.add(binding.consumerOwner);
  }
  return [...owners].sort();
}

/**
 * Regression Testsを選択する。
 *
 * @responsibility Regression Testsの候補集合、選択理由、選択不能時の境界を所有する。
 * @trace ARCH-000003
 * @input catalog: TestCatalog、changedPaths: readonly string[]、levels: ReadonlySet<TestLevel>
 * @returns readonly TestCatalogEntry[]を返す。
 * @precondition 「catalog: TestCatalog、changedPaths: readonly string[]、levels: ReadonlySet<TestLevel>」がselectRegressionTestsの入力契約を満たす。
 * @postcondition selectRegressionTestsの責務を完了した結果だけを返す。
 * @effect N/A: selectRegressionTestsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: selectRegressionTestsは独自の失敗分岐を所有しない。
 * @invariant selectRegressionTestsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: selectRegressionTestsはProcess内の同一Subsystemで完結する。
 * @security N/A: selectRegressionTestsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: selectRegressionTestsは共有非同期状態を持たない同期処理である。
 */
export function selectRegressionTests(
  catalog: TestCatalog,
  changedPaths: readonly string[],
  levels: ReadonlySet<TestLevel> = new Set<TestLevel>([
    "unit",
    "integration",
    "system",
  ]),
): readonly TestCatalogEntry[] {
  const eligibleEntries = catalog.tests.filter((entry) =>
    levels.has(entry.level),
  );
  if (changedPaths.length === 0) return [];
  const selected = new Map<string, TestCatalogEntry>();

  for (const rawPath of changedPaths) {
    const changedPath = rawPath.replaceAll("\\", "/").replace(/^\.\//u, "");
    const direct = eligibleEntries.find(
      (entry) => entry.path.toLowerCase() === changedPath.toLowerCase(),
    );
    if (direct !== undefined) {
      selected.set(direct.path, direct);
      continue;
    }
    if (isSharedRuntimePath(changedPath)) {
      for (const entry of eligibleEntries) selected.set(entry.path, entry);
      continue;
    }
    if (isDocumentationPath(changedPath)) {
      for (const entry of eligibleEntries)
        if (entry.owner === "checker") selected.set(entry.path, entry);
      continue;
    }
    const owner = ownerForPath(changedPath);
    if (owner === null) {
      for (const entry of eligibleEntries) selected.set(entry.path, entry);
      continue;
    }
    const ownerEntries = eligibleEntries.filter(
      (entry) => entry.owner === owner,
    );
    for (const entry of ownerEntries) selected.set(entry.path, entry);
    for (const binding of applicableConsumerBindings(
      catalog,
      changedPath,
      owner,
    ))
      for (const testId of binding.testIds) {
        const consumerTest = eligibleEntries.find(
          (entry) => entry.id === testId,
        );
        if (consumerTest !== undefined)
          selected.set(consumerTest.path, consumerTest);
      }
  }
  return [...selected.values()].sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
  );
}

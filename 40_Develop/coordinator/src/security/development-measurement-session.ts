import { createHash } from "node:crypto";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { types as utilTypes } from "node:util";
import { createDevelopmentExecutionTiming } from "../core/development-execution-timing.ts";

import { isRuntimeProcessEffectBlocked } from "../core/runtime-process-safety-state.ts";
import { snapshotCoordinatorTaskRequest } from "./coordinator-task-request.ts";
import { createDevelopmentMeasurementConstraints } from "./development-measurement-constraints.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import {
  inspectFixedDevelopmentCoordinatorPackageCandidate,
  inspectVerifiedNativeDistributionCandidate,
} from "./platform-provisioner-package-filesystem.ts";
import {
  borrowRuntimeOwnedRepositorySource,
  inspectRepositoryIdentityCandidate,
} from "./repository-operation-runtime.ts";

const CONFIG_KEYS = new Set([
  "repositoryRoot",
  "expectedCommit",
  "expectedTree",
  "expectedPackageContentRootSha256",
  "nativeDistributionRoot",
  "expectedNativeRelease",
  "tasks",
  "expiresAtMs",
]);
const RELEASE_KEYS = new Set([
  "manifestHash",
  "releaseSequence",
  "crddVersion",
  "crddCommit",
  "crddTree",
  "packageContentRootSha256",
  "runtimeExecutionIdentitySha256",
]);
const SHA256 = /^[a-f0-9]{64}$/u;
const COMMIT = /^[a-f0-9]{40}$/u;
const MAX_DURATION_MS = 3_600_000;
const sourceDistributionRoot = path.resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);
/**
 * Providerが扱う値の構造を表す。
 *
 * @responsibility Providerに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";
/**
 * Roleが扱う値の構造を表す。
 *
 * @responsibility Roleに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Roleが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Roleで宣言した値と責務の対応を維持する。
 * @boundary N/A: Roleの宣言は外部境界を開かない。
 * @security RoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Roleの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Role = "executor" | "reviewer";
/**
 * Constraintsが扱う値の構造を表す。
 *
 * @responsibility Constraintsに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Constraintsが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Constraintsで宣言した値と責務の対応を維持する。
 * @boundary N/A: Constraintsの宣言は外部境界を開かない。
 * @security ConstraintsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Constraintsの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Constraints = NonNullable<
  ReturnType<typeof createDevelopmentMeasurementConstraints>
>;
/**
 * TaskRequestが扱う値の構造を表す。
 *
 * @responsibility TaskRequestに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape TaskRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskRequestの宣言は外部境界を開かない。
 * @security TaskRequestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskRequest = Extract<
  NonNullable<ReturnType<typeof snapshotCoordinatorTaskRequest>>,
  { status: "accepted" }
>["request"];
/**
 * Taskが扱う値の構造を表す。
 *
 * @responsibility Taskに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Taskが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Taskで宣言した値と責務の対応を維持する。
 * @boundary N/A: Taskの宣言は外部境界を開かない。
 * @security TaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Taskの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Task = Readonly<{
  request: TaskRequest;
  scopeSha256: string;
  executor: Provider;
  reviewer: Provider;
}>;
/**
 * Configurationが扱う値の構造を表す。
 *
 * @responsibility Configurationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Configurationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Configurationで宣言した値と責務の対応を維持する。
 * @boundary N/A: Configurationの宣言は外部境界を開かない。
 * @security ConfigurationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Configurationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Configuration = Readonly<{
  repositoryRoot: string;
  expectedCommit: string;
  expectedTree: string;
  expectedPackageContentRootSha256: string;
  nativeDistributionRoot: string;
  expectedNativeRelease: Readonly<Record<string, unknown>>;
  tasks: readonly Task[];
  expiresAtMs: number;
}>;
/**
 * Identityが扱う値の構造を表す。
 *
 * @responsibility Identityに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Identityが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Identityで宣言した値と責務の対応を維持する。
 * @boundary N/A: Identityの宣言は外部境界を開かない。
 * @security IdentityはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Identityの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Identity = Readonly<{
  sourceIdentitySha256: string;
  nativeIdentitySha256: string;
  repositoryIdentitySha256: string;
}>;
/**
 * NativeVerificationが扱う値の構造を表す。
 *
 * @responsibility NativeVerificationに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape NativeVerificationが表すProperty、識別子およびRelationを型として固定する。
 * @invariant NativeVerificationで宣言した値と責務の対応を維持する。
 * @boundary N/A: NativeVerificationの宣言は外部境界を開かない。
 * @security NativeVerificationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility NativeVerificationの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type NativeVerification = Extract<
  ReturnType<typeof inspectVerifiedNativeDistributionCandidate>,
  { status: "candidate" }
>;
// Only the production observer can bind a verified native result to an identity.
// The exact immutable identity may be reused inside one already-verified native
// lifecycle boundary; caller claims and isolated test identities remain invalid.
const nativeVerifications = new WeakMap<Identity, NativeVerification>();
/**
 * Dependenciesが扱う値の構造を表す。
 *
 * @responsibility Dependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Dependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Dependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: Dependenciesの宣言は外部境界を開かない。
 * @security DependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Dependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Dependencies = Readonly<{
  observe: (configuration: Configuration) => Identity | null;
  wallNow: () => number;
  monotonicNow: () => number;
  isEffectBlocked: () => boolean;
  verifyOperation: typeof verifyOwnedOperationManagementCapability;
  borrowRepository: typeof borrowRuntimeOwnedRepositorySource;
}>;
/**
 * Sessionが扱う値の構造を表す。
 *
 * @responsibility Sessionに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape Sessionが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Sessionで宣言した値と責務の対応を維持する。
 * @boundary N/A: Sessionの宣言は外部境界を開かない。
 * @security SessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Sessionの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Session = {
  timing: ReturnType<typeof createDevelopmentExecutionTiming>;
  configuration: Configuration;
  identity: Identity;
  bindingSha256: string;
  constraints: Constraints;
  signal: AbortSignal;
  closed: boolean;
};
/**
 * TaskBindingが扱う値の構造を表す。
 *
 * @responsibility TaskBindingに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape TaskBindingが表すProperty、識別子およびRelationを型として固定する。
 * @invariant TaskBindingで宣言した値と責務の対応を維持する。
 * @boundary N/A: TaskBindingの宣言は外部境界を開かない。
 * @security TaskBindingはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility TaskBindingの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type TaskBinding = {
  session: Session;
  task: Task;
  token: object;
  managementCapability: object | null;
  nativeBoundaryIdentity: Identity | null;
  cleanupBoundaryIdentity: Identity | null;
  nativeBoundaryVerified: boolean;
  cleanupBoundaryVerified: boolean;
  settled: boolean;
};

/**
 * digestの処理を実行する。
 *
 * @responsibility digestに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns digestの計算結果を返す。
 * @precondition 「value: unknown」がdigestの入力契約を満たす。
 * @postcondition digestの責務を完了した結果だけを返す。
 * @effect N/A: digestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: digestは独自の失敗分岐を所有しない。
 * @invariant digestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: digestはProcess内の同一Subsystemで完結する。
 * @security digestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: digestは共有非同期状態を持たない同期処理である。
 */
function digest(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

/**
 * snapshotTaskの処理を実行する。
 *
 * @responsibility snapshotTaskに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns Task | nullを返す。
 * @precondition 「raw: unknown」がsnapshotTaskの入力契約を満たす。
 * @postcondition snapshotTaskの責務を完了した結果だけを返す。
 * @effect N/A: snapshotTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure snapshotTaskは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant snapshotTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotTaskはProcess内の同一Subsystemで完結する。
 * @security snapshotTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotTaskは共有非同期状態を持たない同期処理である。
 */
function snapshotTask(raw: unknown): Task | null {
  try {
    const parsed = snapshotCoordinatorTaskRequest(raw);
    if (parsed?.status !== "accepted") return null;
    const request = parsed.request;
    if (Buffer.byteLength(JSON.stringify(request), "utf8") > 65_536)
      return null;
    const executor = request.requestedExecutorProvider;
    if (
      (executor !== "codex" && executor !== "claude") ||
      request.frontProvider === executor ||
      request.isLocalCandidateOnly !== true ||
      request.hasUnresolvedDirection !== false ||
      request.requiresCrossContextAlignment !== false ||
      request.workClass !== "bounded_implementation" ||
      request.planState !== "complete" ||
      request.risk !== "low" ||
      request.difficulty !== "low" ||
      request.decisionImpact !== "limited"
    )
      return null;
    const reviewer = executor === "codex" ? "claude" : "codex";
    return Object.freeze({
      request,
      executor,
      reviewer,
      scopeSha256: digest([
        "crdd-development-task/v1",
        request,
        executor,
        reviewer,
      ]),
    });
  } catch {
    return null;
  }
}

/**
 * snapshotConfigurationの処理を実行する。
 *
 * @responsibility snapshotConfigurationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns Configuration | nullを返す。
 * @precondition 「raw: unknown」がsnapshotConfigurationの入力契約を満たす。
 * @postcondition snapshotConfigurationの責務を完了した結果だけを返す。
 * @effect N/A: snapshotConfigurationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: snapshotConfigurationは独自の失敗分岐を所有しない。
 * @invariant snapshotConfigurationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: snapshotConfigurationはProcess内の同一Subsystemで完結する。
 * @security snapshotConfigurationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: snapshotConfigurationは共有非同期状態を持たない同期処理である。
 */
function snapshotConfiguration(raw: unknown): Configuration | null {
  const config = snapshotPlainRecord(raw, CONFIG_KEYS);
  if (!config) return null;
  const release = snapshotPlainRecord(
    config.expectedNativeRelease,
    RELEASE_KEYS,
  );
  const taskInputs = snapshotPlainArray(config.tasks, 2);
  if (
    !release ||
    taskInputs.status !== "ok" ||
    taskInputs.value.length !== 2 ||
    typeof config.repositoryRoot !== "string" ||
    !path.isAbsolute(config.repositoryRoot) ||
    path.normalize(config.repositoryRoot) !== config.repositoryRoot ||
    typeof config.nativeDistributionRoot !== "string" ||
    !path.isAbsolute(config.nativeDistributionRoot) ||
    path.normalize(config.nativeDistributionRoot) !==
      config.nativeDistributionRoot ||
    config.nativeDistributionRoot === sourceDistributionRoot ||
    typeof config.expectedCommit !== "string" ||
    !COMMIT.test(config.expectedCommit) ||
    typeof config.expectedTree !== "string" ||
    !COMMIT.test(config.expectedTree) ||
    typeof config.expectedPackageContentRootSha256 !== "string" ||
    !SHA256.test(config.expectedPackageContentRootSha256) ||
    typeof config.expiresAtMs !== "number" ||
    !Number.isSafeInteger(config.expiresAtMs)
  )
    return null;
  const tasks: Task[] = [];
  for (const input of taskInputs.value) {
    const task = snapshotTask(input);
    if (
      !task ||
      tasks.some(
        (existing) =>
          existing.executor === task.executor ||
          existing.scopeSha256 === task.scopeSha256,
      )
    )
      return null;
    tasks.push(task);
  }
  // The native verifier owns release-field semantics. Snapshot primitive values
  // now so caller mutation/getters cannot change what was shown to the user.
  if (
    Object.values(release).some(
      (value) => typeof value !== "string" && typeof value !== "number",
    )
  )
    return null;
  return Object.freeze({
    repositoryRoot: config.repositoryRoot,
    expectedCommit: config.expectedCommit,
    expectedTree: config.expectedTree,
    expectedPackageContentRootSha256: config.expectedPackageContentRootSha256,
    nativeDistributionRoot: config.nativeDistributionRoot,
    expectedNativeRelease: release,
    tasks: Object.freeze(tasks),
    expiresAtMs: config.expiresAtMs,
  });
}

/**
 * observeProductionの処理を実行する。
 *
 * @responsibility observeProductionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input configuration: Configuration
 * @returns Identity | nullを返す。
 * @precondition 「configuration: Configuration」がobserveProductionの入力契約を満たす。
 * @postcondition observeProductionの責務を完了した結果だけを返す。
 * @effect N/A: observeProductionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: observeProductionは独自の失敗分岐を所有しない。
 * @invariant observeProductionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: observeProductionはProcess内の同一Subsystemで完結する。
 * @security observeProductionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: observeProductionは共有非同期状態を持たない同期処理である。
 */
function observeProduction(configuration: Configuration): Identity | null {
  const repository = inspectRepositoryIdentityCandidate(
    configuration.repositoryRoot,
  );
  if (
    !repository ||
    repository.commit !== configuration.expectedCommit ||
    repository.tree !== configuration.expectedTree
  )
    return null;
  const source = inspectFixedDevelopmentCoordinatorPackageCandidate({
    distributionRoot: sourceDistributionRoot,
    expectedPackageContentRootSha256:
      configuration.expectedPackageContentRootSha256,
  });
  if (source.status !== "candidate" || !("sourceIdentitySha256" in source))
    return null;
  const native = inspectVerifiedNativeDistributionCandidate({
    distributionRoot: configuration.nativeDistributionRoot,
    evaluationTime: new Date().toISOString(),
    expectedRelease: configuration.expectedNativeRelease,
  });
  if (native.status !== "candidate") return null;
  const reobserved = inspectRepositoryIdentityCandidate(
    configuration.repositoryRoot,
  );
  if (JSON.stringify(repository) !== JSON.stringify(reobserved)) return null;
  const identity: Identity = Object.freeze({
    sourceIdentitySha256: source.sourceIdentitySha256,
    nativeIdentitySha256: native.nativeIdentitySha256,
    repositoryIdentitySha256: digest([
      "crdd-development-repository/v1",
      configuration.repositoryRoot,
      repository,
    ]),
  });
  nativeVerifications.set(identity, native);
  return identity;
}

/**
 * blockedの処理を実行する。
 *
 * @responsibility blockedに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input reason: string
 * @returns blockedの計算結果を返す。
 * @precondition 「reason: string」がblockedの入力契約を満たす。
 * @postcondition blockedの責務を完了した結果だけを返す。
 * @effect N/A: blockedは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: blockedは独自の失敗分岐を所有しない。
 * @invariant blockedは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: blockedはProcess内の同一Subsystemで完結する。
 * @security blockedはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: blockedは共有非同期状態を持たない同期処理である。
 */
function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    capability: null,
    executionSourceKind: "fixed_development_candidate" as const,
    releaseAuthorityConferred: false,
    providerEffectIssued: false,
  });
}

/**
 * createSessionRuntimeの処理を実行する。
 *
 * @responsibility createSessionRuntimeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createSessionRuntimeの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateSessionRuntimeの入力契約を満たす。
 * @postcondition createSessionRuntimeの責務を完了した結果だけを返す。
 * @effect createSessionRuntimeは外部ProcessまたはRuntime境界の操作を呼び出す。
 * @failure createSessionRuntimeは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant createSessionRuntimeは宣言した境界以外へEffectを拡張しない。
 * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
 * @security createSessionRuntimeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createSessionRuntimeは共有非同期状態を持たない同期処理である。
 */
function createSessionRuntime(dependencies: Dependencies) {
  const sessions = new WeakMap<object, Session>();
  const taskBindings = new WeakMap<object, TaskBinding>();
  const operationBindings = new WeakMap<object, TaskBinding>();
  const operationContexts = new WeakMap<object, object>();
  const invocationBindings = new WeakMap<object, TaskBinding>();
  const cleanupBindings = new WeakMap<object, TaskBinding>();
  const cleanupContexts = new WeakMap<object, object>();
  let admissionStarted = false;

  /**
   * observeの処理を実行する。
   *
   * @responsibility observeに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000004
   * @input session: Session
   * @returns observeの計算結果を返す。
   * @precondition 「session: Session」がobserveの入力契約を満たす。
   * @postcondition observeの責務を完了した結果だけを返す。
   * @effect N/A: observeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure observeは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant observeは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: observeはProcess内の同一Subsystemで完結する。
   * @security observeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: observeは共有非同期状態を持たない同期処理である。
   */
  function observe(session: Session) {
    try {
      if (
        session.signal.aborted ||
        session.closed ||
        dependencies.isEffectBlocked()
      )
        session.constraints.cancel();
      const identity = session.timing.measureIdentity(() =>
        dependencies.observe(session.configuration),
      );
      const bindingSha256 =
        identity && digest(identity) === digest(session.identity)
          ? session.bindingSha256
          : "0".repeat(64);
      const observation = {
        bindingSha256,
        wallTimeMs: dependencies.wallNow(),
        monotonicTimeMs: dependencies.monotonicNow(),
      };
      return {
        identity,
        observation,
        result: session.constraints.check(observation),
      };
    } catch {
      session.constraints.cancel();
      return null;
    }
  }

  /**
   * checkBoundSessionの処理を実行する。
   *
   * @responsibility checkBoundSessionに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000004
   * @input session: Session
   * @returns checkBoundSessionの計算結果を返す。
   * @precondition 「session: Session」がcheckBoundSessionの入力契約を満たす。
   * @postcondition checkBoundSessionの責務を完了した結果だけを返す。
   * @effect N/A: checkBoundSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure checkBoundSessionは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant checkBoundSessionは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: checkBoundSessionはProcess内の同一Subsystemで完結する。
   * @security checkBoundSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: checkBoundSessionは共有非同期状態を持たない同期処理である。
   */
  function checkBoundSession(session: Session) {
    try {
      if (
        session.signal.aborted ||
        session.closed ||
        dependencies.isEffectBlocked()
      )
        session.constraints.cancel();
      const observation = {
        bindingSha256: session.bindingSha256,
        wallTimeMs: dependencies.wallNow(),
        monotonicTimeMs: dependencies.monotonicNow(),
      };
      return {
        observation,
        result: session.constraints.check(observation),
      };
    } catch {
      session.constraints.cancel();
      return null;
    }
  }

  /**
   * operationValidの処理を実行する。
   *
   * @responsibility operationValidに対応する入力処理と結果生成を所有する。
   * @trace ARCH-000004
   * @input binding: TaskBinding
   * @returns operationValidの計算結果を返す。
   * @precondition 「binding: TaskBinding」がoperationValidの入力契約を満たす。
   * @postcondition operationValidの責務を完了した結果だけを返す。
   * @effect N/A: operationValidは入力と局所値だけを扱い、外部または共有Effectを発行しない。
   * @failure operationValidは入力不正または下位処理の失敗を呼出し側へ返す。
   * @invariant operationValidは入力から導いた結果以外の共有状態を変更しない。
   * @boundary N/A: operationValidはProcess内の同一Subsystemで完結する。
   * @security operationValidはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
   * @concurrency N/A: operationValidは共有非同期状態を持たない同期処理である。
   */
  function operationValid(binding: TaskBinding) {
    try {
      return (
        !binding.settled &&
        binding.managementCapability !== null &&
        dependencies.verifyOperation(binding.managementCapability)
          .managementScopeBound === true
      );
    } catch {
      return false;
    }
  }

  return Object.freeze({
    /**
     * requestの処理を実行する。
     *
     * @responsibility requestに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input raw: unknown、signal: AbortSignal
     * @returns requestの計算結果を返す。
     * @precondition 「raw: unknown、signal: AbortSignal」がrequestの入力契約を満たす。
     * @postcondition requestの責務を完了した結果だけを返す。
     * @effect N/A: requestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure requestは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant requestは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: requestはProcess内の同一Subsystemで完結する。
     * @security requestはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency requestは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
     */
    async request(raw: unknown, signal: AbortSignal) {
      if (admissionStarted)
        return blocked("development_measurement_admission_already_attempted");
      admissionStarted = true;
      try {
        if (
          !signal ||
          utilTypes.isProxy(signal) ||
          !(signal instanceof AbortSignal) ||
          signal.aborted ||
          dependencies.isEffectBlocked()
        )
          return blocked("development_measurement_unavailable");
        const configuration = snapshotConfiguration(raw);
        const wallTimeMs = dependencies.wallNow();
        const monotonicTimeMs = dependencies.monotonicNow();
        if (
          !configuration ||
          configuration.expiresAtMs <= wallTimeMs ||
          configuration.expiresAtMs - wallTimeMs > MAX_DURATION_MS
        )
          return blocked("development_measurement_configuration_invalid");
        const timing = createDevelopmentExecutionTiming();
        const identity = timing.measureIdentity(() =>
          dependencies.observe(configuration),
        );
        if (!identity)
          return blocked("development_measurement_identity_not_verified");
        const bindingSha256 = digest([
          "crdd-development-session/v1",
          configuration,
          identity,
        ]);
        const constraints = createDevelopmentMeasurementConstraints(
          {
            bindingSha256,
            expiresAtMs: configuration.expiresAtMs,
            tasks: configuration.tasks.map(
              ({ scopeSha256, executor, reviewer }) => ({
                scopeSha256,
                executor,
                reviewer,
              }),
            ),
          },
          { bindingSha256, wallTimeMs, monotonicTimeMs },
        );
        if (!constraints)
          return blocked("development_measurement_configuration_invalid");
        const session: Session = {
          timing,
          configuration,
          identity,
          bindingSha256,
          constraints,
          signal,
          closed: false,
        };
        const finalObservation = observe(session);
        if (
          signal.aborted ||
          dependencies.isEffectBlocked() ||
          finalObservation?.result.status !== "recorded"
        )
          return blocked("development_measurement_admission_changed");
        const capability = Object.freeze({});
        sessions.set(capability, session);
        return Object.freeze({
          status: "authorized" as const,
          capability,
          bindingSha256,
          expiresAtMs: configuration.expiresAtMs,
          executionSourceKind: "fixed_development_candidate" as const,
          releaseAuthorityConferred: false,
          providerEffectIssued: false,
        });
      } catch {
        return blocked("development_measurement_admission_failed");
      }
    },
    /**
     * reserveTaskの処理を実行する。
     *
     * @responsibility reserveTaskに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input sessionCapability: object、raw: unknown
     * @returns reserveTaskの計算結果を返す。
     * @precondition 「sessionCapability: object、raw: unknown」がreserveTaskの入力契約を満たす。
     * @postcondition reserveTaskの責務を完了した結果だけを返す。
     * @effect N/A: reserveTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveTaskは独自の失敗分岐を所有しない。
     * @invariant reserveTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveTaskはProcess内の同一Subsystemで完結する。
     * @security reserveTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveTaskは共有非同期状態を持たない同期処理である。
     */
    reserveTask(sessionCapability: object, raw: unknown) {
      const session = sessions.get(sessionCapability);
      const task = snapshotTask(raw);
      const observation = session && observe(session);
      if (!session || !task || observation?.result.status !== "recorded")
        return null;
      const reserved = session.constraints.reserveTask(
        task.scopeSha256,
        observation.observation,
      );
      if (reserved.status !== "recorded") return null;
      const capability = Object.freeze({});
      taskBindings.set(capability, {
        session,
        task,
        token: reserved.value,
        managementCapability: null,
        nativeBoundaryIdentity: null,
        cleanupBoundaryIdentity: null,
        nativeBoundaryVerified: false,
        cleanupBoundaryVerified: false,
        settled: false,
      });
      return capability;
    },
    /**
     * taskBoundaryの処理を実行する。
     *
     * @responsibility taskBoundaryに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object
     * @returns taskBoundaryの計算結果を返す。
     * @precondition 「taskCapability: object」がtaskBoundaryの入力契約を満たす。
     * @postcondition taskBoundaryの責務を完了した結果だけを返す。
     * @effect N/A: taskBoundaryは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: taskBoundaryは独自の失敗分岐を所有しない。
     * @invariant taskBoundaryは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: taskBoundaryはProcess内の同一Subsystemで完結する。
     * @security taskBoundaryはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: taskBoundaryは共有非同期状態を持たない同期処理である。
     */
    taskBoundary(taskCapability: object) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || binding.settled) return null;
      return Object.freeze({
        repositoryRoot: binding.session.configuration.repositoryRoot,
        expiresAtMs: binding.session.configuration.expiresAtMs,
        signal: binding.session.signal,
        request: binding.task.request,
        checkNewWork: () =>
          !binding.settled &&
          checkBoundSession(binding.session)?.result.status === "recorded",
      });
    },
    /**
     * bindOperationの処理を実行する。
     *
     * @responsibility bindOperationに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、managementCapability: object、repositoryBindingCapability: object
     * @returns bindOperationの計算結果を返す。
     * @precondition 「taskCapability: object、managementCapability: object、repositoryBindingCapability: object」がbindOperationの入力契約を満たす。
     * @postcondition bindOperationの責務を完了した結果だけを返す。
     * @effect N/A: bindOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure bindOperationは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant bindOperationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: bindOperationはProcess内の同一Subsystemで完結する。
     * @security bindOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: bindOperationは共有非同期状態を持たない同期処理である。
     */
    bindOperation(
      taskCapability: object,
      managementCapability: object,
      repositoryBindingCapability: object,
    ) {
      const binding = taskBindings.get(taskCapability);
      if (
        !binding ||
        binding.settled ||
        binding.managementCapability ||
        operationBindings.has(managementCapability) ||
        observe(binding.session)?.result.status !== "recorded"
      )
        return false;
      try {
        const operation = dependencies.verifyOperation(managementCapability);
        const repository = dependencies.borrowRepository(
          repositoryBindingCapability,
          managementCapability,
        );
        if (
          !repository ||
          repository.operationId !== operation.operationId ||
          repository.repositoryRoot !==
            binding.session.configuration.repositoryRoot ||
          repository.revision !== binding.session.configuration.expectedCommit
        )
          return false;
        binding.managementCapability = managementCapability;
        operationBindings.set(managementCapability, binding);
        operationContexts.set(managementCapability, taskCapability);
        const cleanupContext = Object.freeze({});
        cleanupBindings.set(cleanupContext, binding);
        cleanupContexts.set(managementCapability, cleanupContext);
        return true;
      } catch {
        return false;
      }
    },
    /**
     * checkOperationの処理を実行する。
     *
     * @responsibility checkOperationに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input managementCapability: object
     * @returns checkOperationの計算結果を返す。
     * @precondition 「managementCapability: object」がcheckOperationの入力契約を満たす。
     * @postcondition checkOperationの責務を完了した結果だけを返す。
     * @effect N/A: checkOperationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure checkOperationは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant checkOperationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: checkOperationはProcess内の同一Subsystemで完結する。
     * @security checkOperationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: checkOperationは共有非同期状態を持たない同期処理である。
     */
    checkOperation(managementCapability: object) {
      const binding = operationBindings.get(managementCapability);
      if (!binding || binding.settled) return false;
      try {
        dependencies.verifyOperation(managementCapability);
        return observe(binding.session)?.result.status === "recorded";
      } catch {
        return false;
      }
    },
    /**
     * operationContextの処理を実行する。
     *
     * @responsibility operationContextに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input managementCapability: object
     * @returns operationContextの計算結果を返す。
     * @precondition 「managementCapability: object」がoperationContextの入力契約を満たす。
     * @postcondition operationContextの責務を完了した結果だけを返す。
     * @effect N/A: operationContextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: operationContextは独自の失敗分岐を所有しない。
     * @invariant operationContextは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: operationContextはProcess内の同一Subsystemで完結する。
     * @security operationContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: operationContextは共有非同期状態を持たない同期処理である。
     */
    operationContext(managementCapability: object) {
      const binding = operationBindings.get(managementCapability);
      return binding
        ? Object.freeze({
            checkNewWork: () =>
              !binding.settled &&
              checkBoundSession(binding.session)?.result.status === "recorded",
            newWorkContext: operationContexts.get(managementCapability),
            cleanupContext: cleanupContexts.get(managementCapability),
          })
        : null;
    },
    /**
     * borrowNativeObservationの処理を実行する。
     *
     * @responsibility borrowNativeObservationに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input context: object、shouldInitializeIfMissing: boolean
     * @returns borrowNativeObservationの計算結果を返す。
     * @precondition 「context: object、shouldInitializeIfMissing: boolean」がborrowNativeObservationの入力契約を満たす。
     * @postcondition borrowNativeObservationの責務を完了した結果だけを返す。
     * @effect N/A: borrowNativeObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure borrowNativeObservationは入力不正または下位処理の失敗を呼出し側へ返す。
     * @invariant borrowNativeObservationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: borrowNativeObservationはProcess内の同一Subsystemで完結する。
     * @security borrowNativeObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: borrowNativeObservationは共有非同期状態を持たない同期処理である。
     */
    borrowNativeObservation(
      context: object,
      shouldInitializeIfMissing: boolean,
    ) {
      const session = sessions.get(context);
      const task = taskBindings.get(context);
      const cleanup = cleanupBindings.get(context);
      const binding = task ?? cleanup;
      const activeSession = session ?? binding?.session;
      if (
        !activeSession ||
        binding?.settled ||
        ((session || cleanup) && shouldInitializeIfMissing)
      )
        return null;
      try {
        let identity: Identity | null = null;
        if (session) {
          const observed = observe(session);
          if (observed?.result.status !== "recorded") return null;
          identity = observed.identity;
        }
        if (task) {
          if (!task.nativeBoundaryVerified) {
            const observed = observe(task.session);
            if (observed?.result.status !== "recorded") return null;
            identity = observed.identity;
            task.nativeBoundaryIdentity = identity;
            task.nativeBoundaryVerified = true;
          } else {
            if (checkBoundSession(task.session)?.result.status !== "recorded")
              return null;
            identity = task.nativeBoundaryIdentity;
          }
        }
        // A cleanup context permits only a read-only native observation. Its
        // owning resource lifecycle still authorizes every exact mutation.
        if (cleanup) {
          if (dependencies.isEffectBlocked()) return null;
          if (!cleanup.cleanupBoundaryVerified) {
            identity = cleanup.session.timing.measureIdentity(() =>
              dependencies.observe(cleanup.session.configuration),
            );
            if (digest(identity) !== digest(cleanup.session.identity))
              return null;
            cleanup.cleanupBoundaryIdentity = identity;
            cleanup.cleanupBoundaryVerified = true;
          } else {
            identity = cleanup.cleanupBoundaryIdentity;
          }
        }
        if (!identity) return null;
        return Object.freeze({
          identity,
          distributionRoot: activeSession.configuration.nativeDistributionRoot,
          expectedRelease: activeSession.configuration.expectedNativeRelease,
          executionSourceKind: "fixed_development_candidate" as const,
        });
      } catch {
        return null;
      }
    },
    /**
     * reserveInvocationの処理を実行する。
     *
     * @responsibility reserveInvocationに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、provider: Provider、role: Role
     * @returns reserveInvocationの計算結果を返す。
     * @precondition 「taskCapability: object、provider: Provider、role: Role」がreserveInvocationの入力契約を満たす。
     * @postcondition reserveInvocationの責務を完了した結果だけを返す。
     * @effect N/A: reserveInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: reserveInvocationは独自の失敗分岐を所有しない。
     * @invariant reserveInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: reserveInvocationはProcess内の同一Subsystemで完結する。
     * @security reserveInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: reserveInvocationは共有非同期状態を持たない同期処理である。
     */
    reserveInvocation(taskCapability: object, provider: Provider, role: Role) {
      const binding = taskBindings.get(taskCapability);
      const observed =
        binding && operationValid(binding) && observe(binding.session);
      if (!binding || !observed || observed.result.status !== "recorded")
        return null;
      const reserved = binding.session.constraints.reserveInvocation(
        binding.token,
        provider,
        role,
        observed.observation,
      );
      if (reserved.status !== "recorded") return null;
      invocationBindings.set(reserved.value, binding);
      return reserved.value;
    },
    /**
     * consumeInvocationの処理を実行する。
     *
     * @responsibility consumeInvocationに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、invocationCapability: object、provider: Provider、role: Role
     * @returns consumeInvocationの計算結果を返す。
     * @precondition 「taskCapability: object、invocationCapability: object、provider: Provider、role: Role」がconsumeInvocationの入力契約を満たす。
     * @postcondition consumeInvocationの責務を完了した結果だけを返す。
     * @effect consumeInvocationは外部ProcessまたはRuntime境界の操作を呼び出す。
     * @failure N/A: consumeInvocationは独自の失敗分岐を所有しない。
     * @invariant consumeInvocationは宣言した境界以外へEffectを拡張しない。
     * @boundary 外部ProcessまたはTransportとProcess内処理の境界。
     * @security consumeInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: consumeInvocationは共有非同期状態を持たない同期処理である。
     */
    consumeInvocation(
      taskCapability: object,
      invocationCapability: object,
      provider: Provider,
      role: Role,
    ) {
      const binding = taskBindings.get(taskCapability);
      const observed =
        binding && operationValid(binding) && observe(binding.session);
      if (
        !binding ||
        !observed ||
        observed.result.status !== "recorded" ||
        binding.session.constraints.consumeInvocation(
          invocationCapability,
          binding.token,
          provider,
          role,
          observed.observation,
        ).status !== "recorded"
      )
        return false;
      // The provider-effect boundary just completed a full identity check. All
      // native helper observations inside this invocation reuse that exact
      // binding while their adapters still verify the native artifact before
      // and after each helper process.
      binding.nativeBoundaryVerified = true;
      binding.nativeBoundaryIdentity = observed.identity;
      return true;
    },
    /**
     * settleInvocationの処理を実行する。
     *
     * @responsibility settleInvocationに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、invocationCapability: object
     * @returns settleInvocationの計算結果を返す。
     * @precondition 「taskCapability: object、invocationCapability: object」がsettleInvocationの入力契約を満たす。
     * @postcondition settleInvocationの責務を完了した結果だけを返す。
     * @effect N/A: settleInvocationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleInvocationは独自の失敗分岐を所有しない。
     * @invariant settleInvocationは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleInvocationはProcess内の同一Subsystemで完結する。
     * @security settleInvocationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleInvocationは共有非同期状態を持たない同期処理である。
     */
    settleInvocation(taskCapability: object, invocationCapability: object) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || invocationBindings.get(invocationCapability) !== binding)
        return false;
      const wasSettled =
        binding.session.constraints.settleInvocation(invocationCapability)
          .status === "recorded";
      if (wasSettled) invocationBindings.delete(invocationCapability);
      return wasSettled;
    },
    /**
     * settleInvocationAndVerifyの処理を実行する。
     *
     * @responsibility settleInvocationAndVerifyに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、invocationCapability: object
     * @returns settleInvocationAndVerifyの計算結果を返す。
     * @precondition 「taskCapability: object、invocationCapability: object」がsettleInvocationAndVerifyの入力契約を満たす。
     * @postcondition settleInvocationAndVerifyの責務を完了した結果だけを返す。
     * @effect N/A: settleInvocationAndVerifyは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleInvocationAndVerifyは独自の失敗分岐を所有しない。
     * @invariant settleInvocationAndVerifyは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleInvocationAndVerifyはProcess内の同一Subsystemで完結する。
     * @security settleInvocationAndVerifyはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleInvocationAndVerifyは共有非同期状態を持たない同期処理である。
     */
    settleInvocationAndVerify(
      taskCapability: object,
      invocationCapability: object,
    ) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || invocationBindings.get(invocationCapability) !== binding)
        return false;
      const observed = operationValid(binding) && observe(binding.session);
      const wasSettled =
        binding.session.constraints.settleInvocation(invocationCapability)
          .status === "recorded";
      if (wasSettled) invocationBindings.delete(invocationCapability);
      return Boolean(
        wasSettled && observed && observed.result.status === "recorded",
      );
    },
    /**
     * settleTaskの処理を実行する。
     *
     * @responsibility settleTaskに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input taskCapability: object、outcome: "finished" | "cleanup_unknown"
     * @returns settleTaskの計算結果を返す。
     * @precondition 「taskCapability: object、outcome: "finished" | "cleanup_unknown"」がsettleTaskの入力契約を満たす。
     * @postcondition settleTaskの責務を完了した結果だけを返す。
     * @effect N/A: settleTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: settleTaskは独自の失敗分岐を所有しない。
     * @invariant settleTaskは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: settleTaskはProcess内の同一Subsystemで完結する。
     * @security settleTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: settleTaskは共有非同期状態を持たない同期処理である。
     */
    settleTask(
      taskCapability: object,
      outcome: "finished" | "cleanup_unknown",
    ) {
      const binding = taskBindings.get(taskCapability);
      if (!binding || binding.settled) return false;
      const settled = binding.session.constraints.settleTask(
        binding.token,
        outcome,
      );
      if (settled.status !== "recorded") return false;
      binding.settled = true;
      return true;
    },
    /**
     * cancelの処理を実行する。
     *
     * @responsibility cancelに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input capability: object
     * @returns cancelの計算結果を返す。
     * @precondition 「capability: object」がcancelの入力契約を満たす。
     * @postcondition cancelの責務を完了した結果だけを返す。
     * @effect N/A: cancelは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: cancelは独自の失敗分岐を所有しない。
     * @invariant cancelは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: cancelはProcess内の同一Subsystemで完結する。
     * @security cancelはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: cancelは共有非同期状態を持たない同期処理である。
     */
    cancel(capability: object) {
      const session = sessions.get(capability);
      if (!session) return false;
      session.closed = true;
      session.constraints.cancel();
      return true;
    },
    /**
     * inspectの処理を実行する。
     *
     * @responsibility inspectに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input capability: object
     * @returns inspectの計算結果を返す。
     * @precondition 「capability: object」がinspectの入力契約を満たす。
     * @postcondition inspectの責務を完了した結果だけを返す。
     * @effect N/A: inspectは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: inspectは独自の失敗分岐を所有しない。
     * @invariant inspectは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: inspectはProcess内の同一Subsystemで完結する。
     * @security inspectはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: inspectは共有非同期状態を持たない同期処理である。
     */
    inspect(capability: object) {
      const session = sessions.get(capability);
      if (!session) return null;
      checkBoundSession(session);
      return Object.freeze({
        ...session.constraints.inspect(),
        identityObservation: session.timing.snapshot().identityObservation,
      });
    },
    /**
     * tasksの処理を実行する。
     *
     * @responsibility tasksに対応する入力処理と結果生成を所有する。
     * @trace ARCH-000004
     * @input capability: object
     * @returns tasksの計算結果を返す。
     * @precondition 「capability: object」がtasksの入力契約を満たす。
     * @postcondition tasksの責務を完了した結果だけを返す。
     * @effect N/A: tasksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
     * @failure N/A: tasksは独自の失敗分岐を所有しない。
     * @invariant tasksは入力から導いた結果以外の共有状態を変更しない。
     * @boundary N/A: tasksはProcess内の同一Subsystemで完結する。
     * @security tasksはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
     * @concurrency N/A: tasksは共有非同期状態を持たない同期処理である。
     */
    tasks(capability: object) {
      const session = sessions.get(capability);
      if (!session || observe(session)?.result.status !== "recorded")
        return null;
      return Object.freeze(
        session.configuration.tasks.map((task) => task.request),
      );
    },
  });
}

const productionRuntime = createSessionRuntime(
  Object.freeze({
    observe: observeProduction,
    wallNow: Date.now,
    monotonicNow: () => performance.now(),
    isEffectBlocked: isRuntimeProcessEffectBlocked,
    verifyOperation: verifyOwnedOperationManagementCapability,
    borrowRepository: borrowRuntimeOwnedRepositorySource,
  }),
);

/**
 * requestRuntimeOwnedDevelopmentMeasurementSessionの処理を実行する。
 *
 * @responsibility requestRuntimeOwnedDevelopmentMeasurementSessionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input raw: unknown、signal: AbortSignal
 * @returns requestRuntimeOwnedDevelopmentMeasurementSessionの計算結果を返す。
 * @precondition 「raw: unknown、signal: AbortSignal」がrequestRuntimeOwnedDevelopmentMeasurementSessionの入力契約を満たす。
 * @postcondition requestRuntimeOwnedDevelopmentMeasurementSessionの責務を完了した結果だけを返す。
 * @effect N/A: requestRuntimeOwnedDevelopmentMeasurementSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: requestRuntimeOwnedDevelopmentMeasurementSessionは独自の失敗分岐を所有しない。
 * @invariant requestRuntimeOwnedDevelopmentMeasurementSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requestRuntimeOwnedDevelopmentMeasurementSessionはProcess内の同一Subsystemで完結する。
 * @security requestRuntimeOwnedDevelopmentMeasurementSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: requestRuntimeOwnedDevelopmentMeasurementSessionは共有非同期状態を持たない同期処理である。
 */
export function requestRuntimeOwnedDevelopmentMeasurementSession(
  raw: unknown,
  signal: AbortSignal,
) {
  return productionRuntime.request(raw, signal);
}

/**
 * inspectRuntimeOwnedDevelopmentMeasurementSessionの処理を実行する。
 *
 * @responsibility inspectRuntimeOwnedDevelopmentMeasurementSessionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input capability: object
 * @returns inspectRuntimeOwnedDevelopmentMeasurementSessionの計算結果を返す。
 * @precondition 「capability: object」がinspectRuntimeOwnedDevelopmentMeasurementSessionの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedDevelopmentMeasurementSessionの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedDevelopmentMeasurementSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionはProcess内の同一Subsystemで完結する。
 * @security inspectRuntimeOwnedDevelopmentMeasurementSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedDevelopmentMeasurementSessionは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedDevelopmentMeasurementSession(
  capability: object,
) {
  return productionRuntime.inspect(capability);
}

/**
 * readRuntimeOwnedDevelopmentMeasurementTasksの処理を実行する。
 *
 * @responsibility readRuntimeOwnedDevelopmentMeasurementTasksに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input capability: object
 * @returns readRuntimeOwnedDevelopmentMeasurementTasksの計算結果を返す。
 * @precondition 「capability: object」がreadRuntimeOwnedDevelopmentMeasurementTasksの入力契約を満たす。
 * @postcondition readRuntimeOwnedDevelopmentMeasurementTasksの責務を完了した結果だけを返す。
 * @effect N/A: readRuntimeOwnedDevelopmentMeasurementTasksは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: readRuntimeOwnedDevelopmentMeasurementTasksは独自の失敗分岐を所有しない。
 * @invariant readRuntimeOwnedDevelopmentMeasurementTasksは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: readRuntimeOwnedDevelopmentMeasurementTasksはProcess内の同一Subsystemで完結する。
 * @security readRuntimeOwnedDevelopmentMeasurementTasksはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: readRuntimeOwnedDevelopmentMeasurementTasksは共有非同期状態を持たない同期処理である。
 */
export function readRuntimeOwnedDevelopmentMeasurementTasks(
  capability: object,
) {
  return productionRuntime.tasks(capability);
}

/**
 * cancelRuntimeOwnedDevelopmentMeasurementSessionの処理を実行する。
 *
 * @responsibility cancelRuntimeOwnedDevelopmentMeasurementSessionに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input capability: object
 * @returns cancelRuntimeOwnedDevelopmentMeasurementSessionの計算結果を返す。
 * @precondition 「capability: object」がcancelRuntimeOwnedDevelopmentMeasurementSessionの入力契約を満たす。
 * @postcondition cancelRuntimeOwnedDevelopmentMeasurementSessionの責務を完了した結果だけを返す。
 * @effect N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionは独自の失敗分岐を所有しない。
 * @invariant cancelRuntimeOwnedDevelopmentMeasurementSessionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionはProcess内の同一Subsystemで完結する。
 * @security cancelRuntimeOwnedDevelopmentMeasurementSessionはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: cancelRuntimeOwnedDevelopmentMeasurementSessionは共有非同期状態を持たない同期処理である。
 */
export function cancelRuntimeOwnedDevelopmentMeasurementSession(
  capability: object,
) {
  return productionRuntime.cancel(capability);
}

/**
 * borrowRuntimeOwnedDevelopmentNativeObservationの処理を実行する。
 *
 * @responsibility borrowRuntimeOwnedDevelopmentNativeObservationに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input context: object、shouldInitializeIfMissing: boolean
 * @returns borrowRuntimeOwnedDevelopmentNativeObservationの計算結果を返す。
 * @precondition 「context: object、shouldInitializeIfMissing: boolean」がborrowRuntimeOwnedDevelopmentNativeObservationの入力契約を満たす。
 * @postcondition borrowRuntimeOwnedDevelopmentNativeObservationの責務を完了した結果だけを返す。
 * @effect N/A: borrowRuntimeOwnedDevelopmentNativeObservationは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: borrowRuntimeOwnedDevelopmentNativeObservationは独自の失敗分岐を所有しない。
 * @invariant borrowRuntimeOwnedDevelopmentNativeObservationは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: borrowRuntimeOwnedDevelopmentNativeObservationはProcess内の同一Subsystemで完結する。
 * @security borrowRuntimeOwnedDevelopmentNativeObservationはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: borrowRuntimeOwnedDevelopmentNativeObservationは共有非同期状態を持たない同期処理である。
 */
export function borrowRuntimeOwnedDevelopmentNativeObservation(
  context: object,
  shouldInitializeIfMissing: boolean,
) {
  const observation = productionRuntime.borrowNativeObservation(
    context,
    shouldInitializeIfMissing,
  );
  const verification =
    observation && nativeVerifications.get(observation.identity);
  if (!observation || !verification) return null;
  // Consumed synchronously by the native adapter. The post-process borrow is
  // a separate fresh observation; this object is never used as its substitute.
  return Object.freeze({
    distributionRoot: observation.distributionRoot,
    expectedRelease: observation.expectedRelease,
    verification,
  });
}

/**
 * inspectRuntimeOwnedDevelopmentOperationContextの処理を実行する。
 *
 * @responsibility inspectRuntimeOwnedDevelopmentOperationContextに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input managementCapability: unknown
 * @returns inspectRuntimeOwnedDevelopmentOperationContextの計算結果を返す。
 * @precondition 「managementCapability: unknown」がinspectRuntimeOwnedDevelopmentOperationContextの入力契約を満たす。
 * @postcondition inspectRuntimeOwnedDevelopmentOperationContextの責務を完了した結果だけを返す。
 * @effect N/A: inspectRuntimeOwnedDevelopmentOperationContextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectRuntimeOwnedDevelopmentOperationContextは独自の失敗分岐を所有しない。
 * @invariant inspectRuntimeOwnedDevelopmentOperationContextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectRuntimeOwnedDevelopmentOperationContextはProcess内の同一Subsystemで完結する。
 * @security inspectRuntimeOwnedDevelopmentOperationContextはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: inspectRuntimeOwnedDevelopmentOperationContextは共有非同期状態を持たない同期処理である。
 */
export function inspectRuntimeOwnedDevelopmentOperationContext(
  managementCapability: unknown,
) {
  return managementCapability && typeof managementCapability === "object"
    ? productionRuntime.operationContext(managementCapability)
    : null;
}

/**
 * Internal Task facade; caller values cannot construct an admitted session.
 *
 * @responsibility reserveRuntimeOwnedDevelopmentMeasurementTaskに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input sessionCapability: object、request: unknown、repositoryRoot: unknown
 * @returns reserveRuntimeOwnedDevelopmentMeasurementTaskの計算結果を返す。
 * @precondition 「sessionCapability: object、request: unknown、repositoryRoot: unknown」がreserveRuntimeOwnedDevelopmentMeasurementTaskの入力契約を満たす。
 * @postcondition reserveRuntimeOwnedDevelopmentMeasurementTaskの責務を完了した結果だけを返す。
 * @effect N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskは独自の失敗分岐を所有しない。
 * @invariant reserveRuntimeOwnedDevelopmentMeasurementTaskは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskはProcess内の同一Subsystemで完結する。
 * @security reserveRuntimeOwnedDevelopmentMeasurementTaskはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: reserveRuntimeOwnedDevelopmentMeasurementTaskは共有非同期状態を持たない同期処理である。
 */
export function reserveRuntimeOwnedDevelopmentMeasurementTask(
  sessionCapability: object,
  request: unknown,
  repositoryRoot: unknown,
) {
  const taskCapability = productionRuntime.reserveTask(
    sessionCapability,
    request,
  );
  if (!taskCapability) return null;
  const boundary = productionRuntime.taskBoundary(taskCapability);
  if (!boundary || boundary.repositoryRoot !== repositoryRoot) {
    productionRuntime.settleTask(taskCapability, "finished");
    return null;
  }
  return Object.freeze({
    ...boundary,
    context: taskCapability,
    bindOperation: (
      managementCapability: object,
      repositoryBindingCapability: object,
    ) =>
      productionRuntime.bindOperation(
        taskCapability,
        managementCapability,
        repositoryBindingCapability,
      ),
    beginInvocation: (provider: Provider, role: Role) => {
      const invocation = productionRuntime.reserveInvocation(
        taskCapability,
        provider,
        role,
      );
      if (!invocation) return null;
      return Object.freeze({
        commandRestriction: (purpose: string) =>
          purpose === "start_provider_attached"
            ? productionRuntime.consumeInvocation(
                taskCapability,
                invocation,
                provider,
                role,
              )
            : boundary.checkNewWork(),
        settle: () => {
          return productionRuntime.settleInvocationAndVerify(
            taskCapability,
            invocation,
          );
        },
      });
    },
    finish: (outcome: "finished" | "cleanup_unknown") =>
      productionRuntime.settleTask(taskCapability, outcome),
  });
}

/**
 * Isolated capability namespace: never accepted by the production facade.
 *
 * @responsibility createIsolatedDevelopmentMeasurementSessionCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input dependencies: Dependencies
 * @returns createIsolatedDevelopmentMeasurementSessionCandidateの計算結果を返す。
 * @precondition 「dependencies: Dependencies」がcreateIsolatedDevelopmentMeasurementSessionCandidateの入力契約を満たす。
 * @postcondition createIsolatedDevelopmentMeasurementSessionCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedDevelopmentMeasurementSessionCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedDevelopmentMeasurementSessionCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedDevelopmentMeasurementSessionCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedDevelopmentMeasurementSessionCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedDevelopmentMeasurementSessionCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedDevelopmentMeasurementSessionCandidateは共有非同期状態を持たない同期処理である。
 */
export function createIsolatedDevelopmentMeasurementSessionCandidate(
  dependencies: Dependencies,
) {
  return createSessionRuntime(dependencies);
}

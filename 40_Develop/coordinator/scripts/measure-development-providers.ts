/**
 * 通常Taskの開発計測と固定Source観測を所有する。
 * @responsibility 製品の実行制御を複製せず、明示した二要求の外側時間だけを計測する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import fs, {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  opendirSync,
  openSync,
  readSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { ExecutionStorageBlockedError } from "../../execution-model/src/index.ts";
import {
  getRepository,
  resolveVerifiedRepositoryRootFromWorkingDirectory,
} from "../../version-control/src/index.ts";
import {
  runTask,
  type TaskRunResult,
  type TaskSessionContext,
} from "../src/index.ts";
import {
  RepositoryDataBlockedError,
  ensureRepositoryExecutionDataArea,
  requireReadyRepositoryExecutionDataArea,
} from "../src/lifecycle/host.ts";
import {
  snapshotJsonValue,
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../src/lifecycle/validation.ts";
import { assertSupportedCoordinatorNodeRuntime } from "../src/lifecycle/environment.ts";

/**
 * 通常Task二件を外側から計測するための局所依存。
 * @responsibility 実行・観測・時計・期限だけを既存Ownerへ接続する。
 * @trace ARCH-000004
 * @shape 通常runTaskと固定Source観測、時計、Timer。
 * @boundary 開発Scriptだけの試験接続。製品Rootへ公開しない。
 * @security 新しいAuthorityやSessionを発行しない。
 */
type Dependencies = Readonly<{
  runTask: typeof runTask;
  getRepository: typeof getRepository;
  observeSource: typeof observeRuntimeOwnedDevelopmentSource;
  now: () => number;
  wallNow: () => number;
  setTimer: typeof setTimeout;
  clearTimer: typeof clearTimeout;
}>;

const productionDependencies: Dependencies = Object.freeze({
  runTask,
  getRepository,
  observeSource: observeRuntimeOwnedDevelopmentSource,
  now: () => performance.now(),
  wallNow: Date.now,
  setTimer: setTimeout,
  clearTimer: clearTimeout,
});

/**
 * 明示した通常Task二件を順に実行し、元の最終結果を保持する。
 * @responsibility 外側の時間・取消と、通常Taskの完了待機を区別する。
 * @trace ARCH-000004
 * @input 明示Project・Principal・期限・Source期待値・通常Task二件、検証済みRootと取消。
 * @returns 各Taskの元結果、経過時間、Source前後観測と計測状態。
 * @precondition 起動できるローカル利用者が通常操作の入力を明示する。
 * @postcondition runTaskの終了・取消joinを待ち、TimerとListenerを解放する。
 * @effect 通常runTaskの保存・実行だけを発行する。再送・自動回復は追加しない。
 * @failure 不正入力は実行前拒否。開始後例外・回収不明は後続を停止する。
 * @invariant 計測成功を採用・公開・品質保証へ拡張しない。
 * @boundary 開発Scriptと通常Taskの完成操作。
 * @security 主体・Workspace・Task IDを推測生成せず、Promptを別途記録しない。
 * @concurrency 期限・外部取消は同じAbortControllerへ配送し、早期完了しない。
 */
async function executeMeasurement(
  configuration: unknown,
  repositoryRoot: string,
  signal: AbortSignal,
  dependencies: Dependencies,
) {
  const results: Array<
    Readonly<{ elapsedMs: number | null; result: TaskRunResult }>
  > = [];
  let before: ReturnType<typeof observeRuntimeOwnedDevelopmentSource> = null;
  let after: ReturnType<typeof observeRuntimeOwnedDevelopmentSource> = null;
  let reason: string | null = null;
  let cleanupConfirmed = true;
  let started = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  try {
    const fixed = snapshotPlainRecord(
      configuration,
      new Set([
        "projectId",
        "principalId",
        "expiresAtMs",
        "expectedSourceSha256",
        "tasks",
      ]),
    );
    const tasks = fixed ? snapshotPlainArray<unknown>(fixed.tasks, 2) : null;
    const remaining =
      fixed && typeof fixed.expiresAtMs === "number"
        ? fixed.expiresAtMs - dependencies.wallNow()
        : NaN;
    if (
      !fixed ||
      Object.keys(fixed).length !== 5 ||
      typeof fixed.projectId !== "string" ||
      !fixed.projectId ||
      typeof fixed.principalId !== "string" ||
      !fixed.principalId ||
      !Number.isSafeInteger(fixed.expiresAtMs) ||
      !Number.isFinite(remaining) ||
      remaining <= 0 ||
      remaining > 3_600_000 ||
      typeof fixed.expectedSourceSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(fixed.expectedSourceSha256) ||
      tasks?.status !== "ok" ||
      tasks.value.length !== 2
    )
      throw new Error("measurement_input_invalid");
    // 要求の意味検査はrunTaskのOwnerに任せ、ここでは独立捕捉と二IDの相異だけを扱う。
    const commands = tasks.value.map(
      (value) => snapshotJsonValue(value) as Record<string, unknown>,
    );
    if (
      commands.some(
        (command) =>
          !command ||
          typeof command !== "object" ||
          typeof command.requestId !== "string" ||
          !command.requestId,
      ) ||
      commands[0]?.requestId === commands[1]?.requestId
    )
      throw new Error("measurement_input_invalid");
    const repository = dependencies.getRepository(repositoryRoot);
    if (repository.status !== "completed" || !repository.capability)
      throw new Error("measurement_repository_invalid");
    before = dependencies.observeSource();
    if (!before || before.sourceSha256 !== fixed.expectedSourceSha256)
      throw new Error("measurement_source_unconfirmed");
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
    timer = dependencies.setTimer(
      cancel,
      Math.max(0, (fixed.expiresAtMs as number) - dependencies.wallNow()),
    );
    const context: TaskSessionContext = Object.freeze({
      rootCapability: repository.capability,
      projectId: fixed.projectId,
      principalId: fixed.principalId,
      consumer: "coordinator_cli",
      // 信頼されたローカル入口の閲覧・操作許可。AM認証の代替ではない。
      // 取消・期限はSignalと開始条件で扱い、終了結果の閲覧認可を失効させない。
      authorize: () => true,
    });
    for (const command of commands) {
      if (
        cancellation.signal.aborted ||
        dependencies.wallNow() >= (fixed.expiresAtMs as number)
      ) {
        reason = "measurement_cancelled_or_expired";
        break;
      }
      const startedAt = dependencies.now();
      started = true;
      const result = await dependencies.runTask(
        context,
        command,
        cancellation.signal,
      );
      started = false;
      cleanupConfirmed = cleanupConfirmed && result.cleanupConfirmed === true;
      let elapsedMs: number | null = null;
      try {
        const elapsed = dependencies.now() - startedAt;
        if (Number.isFinite(elapsed)) elapsedMs = Math.max(0, elapsed);
      } catch {
        // 時計の失敗で、既に得たTask結果・回復参照を失わせない。
      }
      results.push(
        Object.freeze({
          elapsedMs,
          result,
        }),
      );
      if (elapsedMs === null) {
        reason = "measurement_timing_unavailable";
        break;
      }
      if (
        !cleanupConfirmed ||
        result.recoveryIds?.length ||
        result.secondaryFailures.length ||
        result.status === "unknown" ||
        result.status === "cancelled"
      ) {
        reason = "measurement_task_unsettled";
        break;
      }
      // cleanな不成功は別IDの二件目と比較できる。同じTaskの再送はしない。
    }
    after = dependencies.observeSource();
    if (
      !after ||
      after.sourceSha256 !== before.sourceSha256 ||
      after.sourceIdentitySha256 !== before.sourceIdentitySha256
    )
      reason ??= "measurement_source_changed_or_unavailable";
  } catch {
    reason ??= started
      ? "measurement_execution_unconfirmed"
      : "measurement_input_or_observation_invalid";
    if (started) cleanupConfirmed = false;
  } finally {
    signal.removeEventListener("abort", cancel);
    if (timer !== undefined) dependencies.clearTimer(timer);
  }
  const completedCount = results.filter(
    (entry) => entry.result.status === "completed",
  ).length;
  return Object.freeze({
    contract: "crdd-coordinator/development-provider-measurement",
    contractRevision: 4,
    status:
      reason === null && completedCount === 2 && cleanupConfirmed
        ? "completed"
        : "blocked",
    reason:
      reason ??
      (completedCount === 2
        ? "measurement_completed"
        : "measurement_tasks_not_completed"),
    executionSourceKind: "normal_task",
    releaseAuthorityConferred: false,
    completedCount,
    results: Object.freeze(results),
    sourceBefore:
      before === null
        ? null
        : Object.freeze({
            scope: before.scope,
            sourceSha256: before.sourceSha256,
            fileCount: before.fileCount,
            totalBytes: before.totalBytes,
          }),
    sourceAfter:
      after === null
        ? null
        : Object.freeze({
            scope: after.scope,
            sourceSha256: after.sourceSha256,
            fileCount: after.fileCount,
            totalBytes: after.totalBytes,
          }),
    cleanupConfirmed,
    recoveryIds: Object.freeze([
      ...new Set(results.flatMap((entry) => entry.result.recoveryIds ?? [])),
    ]),
    manualRecoveryRequired:
      !cleanupConfirmed ||
      results.some((entry) => !!entry.result.recoveryIds?.length),
    taskRetryAllowed: false,
    timeToHumanAcceptedResultMeasured: false,
  });
}

/**
 * 通常Task二件の最終返却までを計測する。
 * @responsibility 本番の既存Task Ownerだけを使用する。
 * @trace ARCH-000004
 * @input 明示計測入力、Repository Root、取消Signal。
 * @returns 外側計測結果。
 * @effect 通常Taskへの依頼と既存保存・実行。
 * @failure executeMeasurementの閉じた失敗分類を返す。
 * @boundary 開発Script。Root公開や新Runtimeを追加しない。
 * @security ローカル入口の明示主体をそのまま伝播する。
 * @concurrency 二Taskを逐次awaitし、取消でも終了を待つ。
 */
export function runDevelopmentProviderMeasurement(
  configuration: unknown,
  repositoryRoot: string,
  signal: AbortSignal,
) {
  return executeMeasurement(
    configuration,
    repositoryRoot,
    signal,
    productionDependencies,
  );
}

/**
 * 外部実行なしで計測Scriptの拒否・取消・結果保全を反証する。
 * @responsibility 既存の試験接続だけを構成する。
 * @trace ARCH-000004
 * @input 局所試験依存。
 * @returns run。
 * @effect 試験依存以外を呼ばない。
 * @boundary Script内部の試験接続。
 * @security 本番Authorityを発行しない。
 */
export function createIsolatedDevelopmentProviderMeasurementCandidate(
  dependencies: Dependencies,
) {
  return Object.freeze({
    productionAuthority: false,
    run: (
      configuration: unknown,
      repositoryRoot: string,
      signal: AbortSignal,
    ) =>
      executeMeasurement(configuration, repositoryRoot, signal, dependencies),
  });
}

const SOURCE_SCOPE = "crdd-development-source-snapshot/v4";

const PACKAGES = [
  "access-management",
  "ai-adapter",
  "coordinator",
  "docker-isolation",
  "configuration-model",
  "document-model",
  "execution-model",
  "executor",
  "execution-intelligence",
  "lock",
  "mcp-server",
  "version-control",
] as const;

const DIRECTORIES = [
  "src",
  "bin",
  "runtime",
  "config",
  "schemas",
  "scripts",
  "policies",
] as const;

const sourceRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);

/**
 * Snapshotの観測事実を保持する。実行許可や配布元真正性は表さない。
 *
 * @responsibility 再現可能な内容Hashと同Session内の実体Hashを区別する。
 * @trace ARCH-000004
 * @shape Scope、内容Hash、実体Hash、件数とbyte数を持つ不変値。
 * @invariant 内容Hashへ絶対RootとOS上の実体番号を含めない。
 * @boundary Repository内の固定Source範囲だけを表す。
 * @security 本文・秘密値・実行Authorityを返さない。
 * @compatibility Scope版が異なるHashを同じ観測契約と解釈しない。
 */
type SourceObservation = Readonly<{
  scope: typeof SOURCE_SCOPE;
  sourceSha256: string;
  sourceIdentitySha256: string;
  fileCount: number;
  totalBytes: number;
}>;

/**
 * Directory名を列挙し、同じhandleを必ず閉じる。
 *
 * @responsibility Source診断の対象名を独自の件数上限で欠落させない。
 * @trace ARCH-000004
 * @input directory: 固定Scope内のDirectory。
 * @returns コード単位順に並べた名前集合。
 * @precondition 呼出し元がDirectory種別を確認している。
 * @postcondition 成功・失敗とも開いたhandleのcloseを一回試行する。
 * @effect Directoryを読取り専用で開閉する。
 * @failure 列挙・close失敗は例外を返す。
 * @invariant 外部への書込みと永続状態を作らない。
 * @boundary Node Directory handleの所有期間。
 * @security File名だけを内部で保持し、対象Scopeを拡張しない。
 * @concurrency 後続の二読取りが追加・欠落差を照合する。
 */
function readDirectoryNames(directory: string): string[] {
  const handle = opendirSync(directory);
  const names: string[] = [];
  try {
    for (;;) {
      const entry = handle.readSync();
      if (!entry) break;
      names.push(entry.name);
    }
    return names.sort();
  } finally {
    handle.closeSync();
  }
}

/**
 * 固定Root以下を二度読み、途中で変化したSnapshotを拒否する。
 *
 * @responsibility 通常Fileの内容とRoot・Directory・File実体の前後一致を確認する。
 * @trace ARCH-000004
 * @input root: 内部で固定したSource Root。
 * @returns 一致した不変観測値。観測不能・不一致はnull。
 * @precondition 呼出し元が観測対象Rootを固定している。
 * @postcondition 部分結果を成功値として返さない。
 * @effect Filesystemの読取りだけを行う。
 * @failure link、欠落、非通常File、読取り差を拒否する。
 * @invariant 外部へ実行許可を発行せず、内容Hashと実体Hashを分ける。
 * @boundary Node Filesystemから読取り可能な固定Sourceだけを観測する。
 * @security linkを辿らず、外部Rootを返さず、書込みを行わない。
 * @concurrency 二読取りの差を拒否するが、ロード済みModuleとの原子的同一性は保証しない。
 */
function captureDevelopmentSource(root: string): SourceObservation | null {
  try {
    const passes: string[] = [];
    let result: SourceObservation | null = null;
    for (let pass = 0; pass < 2; pass += 1) {
      const content: unknown[] = [SOURCE_SCOPE, PACKAGES, DIRECTORIES];
      const identities: unknown[] = [];
      let fileCount = 0;
      let totalBytes = 0;
      const packagesWithSource = new Set<string>();
      const pending: Array<{
        absolute: string;
        relative: string;
      }> = [];
      // Root parents are checked independently; root mtime is intentionally not
      // included because excluded .crdd/document updates do not change Source.
      for (const absolute of [root, path.join(root, "40_Develop")]) {
        const stat = lstatSync(absolute, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
        if (path.resolve(realpathSync(absolute)) !== path.resolve(absolute))
          return null;
        identities.push([
          absolute === root ? "." : "40_Develop",
          String(stat.dev),
          String(stat.ino),
          String(stat.birthtimeNs),
        ]);
      }
      for (const packageName of PACKAGES) {
        const relative = `40_Develop/${packageName}`;
        const absolute = path.join(root, "40_Develop", packageName);
        const stat = lstatSync(absolute, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
        identities.push([
          relative,
          String(stat.dev),
          String(stat.ino),
          String(stat.birthtimeNs),
        ]);
        pending.push({
          absolute: path.join(absolute, "package.json"),
          relative: `${relative}/package.json`,
        });
        for (const directory of DIRECTORIES) {
          const child = path.join(absolute, directory);
          let childStat: BigIntStats;
          try {
            childStat = lstatSync(child, { bigint: true });
          } catch (error) {
            if (
              (error as NodeJS.ErrnoException).code !== "ENOENT" ||
              directory === "src"
            )
              throw error;
            content.push([`${relative}/${directory}`, "absent"]);
            continue;
          }
          if (!childStat.isDirectory() || childStat.isSymbolicLink())
            return null;
          pending.push({
            absolute: child,
            relative: `${relative}/${directory}`,
          });
        }
      }
      while (pending.length > 0) {
        const entry = pending.pop();
        if (!entry) return null;
        const before = lstatSync(entry.absolute, { bigint: true });
        if (before.isSymbolicLink()) return null;
        if (entry.relative.endsWith("/package.json") && !before.isFile())
          return null;
        if (before.isDirectory()) {
          const names = readDirectoryNames(entry.absolute);
          content.push([entry.relative, "directory", names]);
          identities.push([
            entry.relative,
            String(before.dev),
            String(before.ino),
            String(before.birthtimeNs),
          ]);
          for (const name of names) {
            pending.push({
              absolute: path.join(entry.absolute, name),
              relative: `${entry.relative}/${name}`,
            });
          }
          continue;
        }
        if (!before.isFile() || before.nlink !== 1n) return null;
        fileCount += 1;
        const sourcePackage = entry.relative.match(
          /^40_Develop\/([^/]+)\/src\//u,
        )?.[1];
        if (sourcePackage) packagesWithSource.add(sourcePackage);
        const descriptor = openSync(
          entry.absolute,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        let bytes: Buffer;
        let identity: string;
        try {
          const opened = fstatSync(descriptor, { bigint: true });
          identity = JSON.stringify(
            [
              before.dev,
              before.ino,
              before.size,
              before.mtimeNs,
              before.ctimeNs,
              before.birthtimeNs,
              before.nlink,
            ].map(String),
          );
          const openedIdentity = JSON.stringify(
            [
              opened.dev,
              opened.ino,
              opened.size,
              opened.mtimeNs,
              opened.ctimeNs,
              opened.birthtimeNs,
              opened.nlink,
            ].map(String),
          );
          if (
            !opened.isFile() ||
            opened.nlink !== 1n ||
            openedIdentity !== identity
          )
            return null;
          const buffer = Buffer.alloc(Number(opened.size) + 1);
          let offset = 0;
          while (offset < buffer.length) {
            const count = readSync(
              descriptor,
              buffer,
              offset,
              buffer.length - offset,
              offset,
            );
            if (count === 0) break;
            offset += count;
          }
          if (offset !== Number(opened.size)) return null;
          bytes = buffer.subarray(0, offset);
          const after = fstatSync(descriptor, { bigint: true });
          if (
            JSON.stringify(
              [
                after.dev,
                after.ino,
                after.size,
                after.mtimeNs,
                after.ctimeNs,
                after.birthtimeNs,
                after.nlink,
              ].map(String),
            ) !== identity
          )
            return null;
        } finally {
          closeSync(descriptor);
        }
        const after = lstatSync(entry.absolute, { bigint: true });
        if (
          !after.isFile() ||
          after.nlink !== 1n ||
          after.isSymbolicLink() ||
          JSON.stringify(
            [
              after.dev,
              after.ino,
              after.size,
              after.mtimeNs,
              after.ctimeNs,
              after.birthtimeNs,
              after.nlink,
            ].map(String),
          ) !== identity
        )
          return null;
        totalBytes += bytes.length;
        content.push([
          entry.relative,
          bytes.length,
          createHash("sha256").update(bytes).digest("hex"),
        ]);
        identities.push([entry.relative, identity]);
      }
      if (packagesWithSource.size !== PACKAGES.length) return null;
      content.splice(
        3,
        content.length - 3,
        ...content
          .slice(3)
          .sort((a, b) =>
            JSON.stringify(a) < JSON.stringify(b)
              ? -1
              : JSON.stringify(a) > JSON.stringify(b)
                ? 1
                : 0,
          ),
      );
      identities.sort((a, b) =>
        JSON.stringify(a) < JSON.stringify(b)
          ? -1
          : JSON.stringify(a) > JSON.stringify(b)
            ? 1
            : 0,
      );
      const sourceSha256 = createHash("sha256")
        .update(JSON.stringify(content))
        .digest("hex");
      const sourceIdentitySha256 = createHash("sha256")
        .update(JSON.stringify([sourceSha256, identities]))
        .digest("hex");
      passes.push(sourceIdentitySha256);
      result = Object.freeze({
        scope: SOURCE_SCOPE,
        sourceSha256,
        sourceIdentitySha256,
        fileCount,
        totalBytes,
      });
    }
    return passes[0] === passes[1] ? result : null;
  } catch {
    return null;
  }
}

/**
 * このModule自身が属するRepositoryの開発Sourceを観測する。
 *
 * @responsibility 計測と入力生成Toolの固定Source観測入口を共有する。
 * @trace ARCH-000004
 * @input N/A: RootとScopeはModuleから固定し、呼出し元に選ばせない。
 * @returns 固定Scope全体のSnapshot観測値。不完全な観測はnull。
 * @precondition 固定Scopeの全Packageと必要Sourceが読取り可能である。
 * @postcondition 成功値は二読取りで内容・実体が一致する。
 * @effect Sourceを同期読取りする。永続状態を作らない。
 * @failure 欠落、不正実体、途中変更はnull。
 * @invariant この値は実行Authorityでも配布署名でもない。
 * @boundary 固定RepositoryのSourceのみを読み取る。
 * @security 任意Root、期待値自動補完、Source本文の公開を許さない。
 * @concurrency Snapshot観測中の差を拒否する。将来の変更不能は保証しない。
 */
export function observeRuntimeOwnedDevelopmentSource(): SourceObservation | null {
  return captureDevelopmentSource(sourceRoot);
}

/**
 * Development Measurement Entry 失敗を公開結果へ投影する。
 *
 * @responsibility Development Measurement Entry 失敗の公開field、秘匿境界、投影不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input error: unknown
 * @returns projectDevelopmentMeasurementEntryFailureの計算結果を返す。
 * @precondition 「error: unknown」がprojectDevelopmentMeasurementEntryFailureの入力契約を満たす。
 * @postcondition projectDevelopmentMeasurementEntryFailureの責務を完了した結果だけを返す。
 * @effect N/A: projectDevelopmentMeasurementEntryFailureは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: projectDevelopmentMeasurementEntryFailureは独自の失敗分岐を所有しない。
 * @invariant projectDevelopmentMeasurementEntryFailureは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: projectDevelopmentMeasurementEntryFailureはProcess内の同一Subsystemで完結する。
 * @security N/A: projectDevelopmentMeasurementEntryFailureはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: projectDevelopmentMeasurementEntryFailureは共有非同期状態を持たない同期処理である。
 */
export function projectDevelopmentMeasurementEntryFailure(error: unknown) {
  return Object.freeze(
    error instanceof ExecutionStorageBlockedError ||
      error instanceof RepositoryDataBlockedError
      ? {
          status: "blocked" as const,
          reason: error.reason,
          effectIssued: error.effectIssued,
          effectStateUnknown: error.effectStateUnknown,
          cleanupConfirmed: error.cleanupConfirmed,
          retryAllowed: error.retryAllowed,
          recoveryReference: error.recoveryReference,
        }
      : {
          status: "blocked" as const,
          reason: "measurement_entry_failed_closed",
          effectIssued: false,
          effectStateUnknown: true,
          cleanupConfirmed: false,
          retryAllowed: false,
          recoveryReference: null,
        },
  );
}

/**
 * measure-development-providersのCommand処理を開始する。
 *
 * @responsibility measure-development-providersの引数受付、終了Code、診断出力境界を所有する。
 * @trace ARCH-000004
 * @input 引数なしは既存実測、--describe-sourceは固定Sourceの読取りだけを行う。
 * @returns N/A: mainは戻り値を返さない。
 * @precondition 実測は既存の明示入力を使用し、Source照会は追加引数を許さない。
 * @postcondition mainの責務を完了して呼出し元へ制御を戻す。
 * @effect mainはFilesystemの読取りまたは書込みを実行する。
 * @failure mainは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant mainは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: mainはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency mainは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function main() {
  assertSupportedCoordinatorNodeRuntime(process.versions.node);
  if (process.argv.length === 3 && process.argv[2] === "--describe-source") {
    const observation = observeRuntimeOwnedDevelopmentSource();
    process.stdout.write(
      `${JSON.stringify(
        observation
          ? {
              status: "observed",
              scope: observation.scope,
              expectedSourceSha256: observation.sourceSha256,
              fileCount: observation.fileCount,
              totalBytes: observation.totalBytes,
              releaseAuthorityConferred: false,
              providerEffectIssued: false,
            }
          : {
              status: "blocked",
              reason: "measurement_source_observation_unavailable",
              releaseAuthorityConferred: false,
              providerEffectIssued: false,
            },
      )}\n`,
    );
    process.exitCode = observation ? 0 : 2;
    return;
  }
  if (process.argv.length !== 2)
    throw new Error("measurement_arguments_invalid");
  const root = resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd());
  const verifiedRuntimeRoot = getRepository(root);
  if (verifiedRuntimeRoot.status !== "completed")
    throw new Error("measurement_runtime_data_path_invalid");
  const testsArea = requireReadyRepositoryExecutionDataArea(
    ensureRepositoryExecutionDataArea(verifiedRuntimeRoot.capability, "tests"),
    "measurement_runtime_data_path_invalid",
  );
  const directory = path.join(testsArea.directory, "development-measurement");
  const identities = [];
  for (const target of [directory]) {
    const metadata = fs.lstatSync(target);
    if (
      !metadata.isDirectory() ||
      metadata.isSymbolicLink() ||
      fs.realpathSync.native(target) !== target
    )
      throw new Error("measurement_directory_invalid");
    identities.push({
      target,
      dev: metadata.dev,
      ino: metadata.ino,
      birthtimeMs: metadata.birthtimeMs,
    });
  }
  const inputPath = path.join(
    directory,
    "development-measurement-request.json",
  );
  const metadata = fs.lstatSync(inputPath);
  if (!metadata.isFile() || metadata.isSymbolicLink())
    throw new Error("measurement_request_invalid");
  const configuration: unknown = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const abort = new AbortController();
  const cancel = () => abort.abort();
  process.on("SIGINT", cancel);
  process.on("SIGTERM", cancel);
  try {
    const result = await runDevelopmentProviderMeasurement(
      configuration,
      root,
      abort.signal,
    );
    let outputUnconfirmed = false;
    try {
      for (const identity of identities) {
        const current = fs.lstatSync(identity.target);
        if (
          current.isSymbolicLink() ||
          !current.isDirectory() ||
          current.dev !== identity.dev ||
          current.ino !== identity.ino ||
          current.birthtimeMs !== identity.birthtimeMs ||
          fs.realpathSync.native(identity.target) !== identity.target
        )
          throw new Error("measurement_output_directory_changed");
      }
      fs.writeFileSync(
        path.join(
          directory,
          `development-measurement-result-${Date.now()}-${process.pid}.json`,
        ),
        `${JSON.stringify(result, null, 2)}\n`,
        { encoding: "utf8", flag: "wx", mode: 0o600 },
      );
    } catch {
      outputUnconfirmed = true;
    }
    const report = outputUnconfirmed
      ? Object.freeze({
          ...result,
          status: "blocked" as const,
          outputConfirmed: false,
          secondaryFailures: ["measurement_output_unconfirmed"],
        })
      : result;
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.status === "completed" ? 0 : 2;
  } finally {
    process.off("SIGINT", cancel);
    process.off("SIGTERM", cancel);
  }
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify(projectDevelopmentMeasurementEntryFailure(error))}\n`,
    );
    process.exitCode = 2;
  }
}

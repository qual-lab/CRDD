/**
 * objective-requestに属する責務をまとめる。
 *
 * @responsibility ProjectRuntimeObjectiveRequestを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../boundary/plain-data-snapshot.ts";
import { normalizeRepositoryRelativePath } from "../boundary/repository-relative-path.ts";

/**
 * objective-requestで使用するProject Runtime Objective Requestの値契約を定義する。
 *
 * @responsibility Project Runtime Objective RequestのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeObjectiveRequestが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeObjectiveRequestで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeObjectiveRequestの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeObjectiveRequestはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeObjectiveRequestの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeObjectiveRequest = Readonly<{
  requestId: string;
  projectId: string;
  milestoneId: string;
  repositoryRevision: string;
  objective: string;
  acceptanceCriteria: readonly string[];
  allowedPaths: readonly string[];
  readPaths: readonly string[];
  maximumConcurrency: number;
  maximumReplans: number;
  originLane: "interactive" | "scheduled";
  adoptResult: boolean;
  requestedExecutorProvider?: "auto" | "codex" | "claude";
  decisionCapabilityReplacement?: Readonly<{
    decisionId: string;
    replacementRequestId: string;
  }>;
}>;

/**
 * Idが有効か判定する。
 *
 * @responsibility Idの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidIdの入力契約を満たす。
 * @postcondition validIdの責務を完了した結果だけを返す。
 * @effect N/A: validIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validIdは独自の失敗分岐を所有しない。
 * @invariant validIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validIdはProcess内の同一Subsystemで完結する。
 * @security N/A: validIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validIdは共有非同期状態を持たない同期処理である。
 */
function validId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Revisionが有効か判定する。
 *
 * @responsibility Revisionの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidRevisionの入力契約を満たす。
 * @postcondition validRevisionの責務を完了した結果だけを返す。
 * @effect N/A: validRevisionは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validRevisionは独自の失敗分岐を所有しない。
 * @invariant validRevisionは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validRevisionはProcess内の同一Subsystemで完結する。
 * @security N/A: validRevisionはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validRevisionは共有非同期状態を持たない同期処理である。
 */
function validRevision(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40,64}$/u.test(value);
}

/**
 * Textが有効か判定する。
 *
 * @responsibility Textの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximum: number
 * @returns value is stringを返す。
 * @precondition 「value: unknown、maximum: number」がvalidTextの入力契約を満たす。
 * @postcondition validTextの責務を完了した結果だけを返す。
 * @effect N/A: validTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTextは独自の失敗分岐を所有しない。
 * @invariant validTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTextはProcess内の同一Subsystemで完結する。
 * @security N/A: validTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTextは共有非同期状態を持たない同期処理である。
 */
function validText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/**
 * Stringsを観測する。
 *
 * @responsibility Stringsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、maximumItems: number、maximumText: number
 * @returns readonly string[] | nullを返す。
 * @precondition 「value: unknown、maximumItems: number、maximumText: number」がinspectStringsの入力契約を満たす。
 * @postcondition inspectStringsの責務を完了した結果だけを返す。
 * @effect N/A: inspectStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectStringsは独自の失敗分岐を所有しない。
 * @invariant inspectStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectStringsは共有非同期状態を持たない同期処理である。
 */
function inspectStrings(
  value: unknown,
  maximumItems: number,
  maximumText: number,
): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, maximumItems);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.length === 0 ||
    !snapshot.value.every((entry) => validText(entry, maximumText)) ||
    new Set(
      snapshot.value.map((entry) =>
        (entry as string).replaceAll("\\", "/").toUpperCase(),
      ),
    ).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...(snapshot.value as readonly string[])]);
}

const REQUIRED_REQUEST_KEYS = Object.freeze([
  "requestId",
  "projectId",
  "milestoneId",
  "repositoryRevision",
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
  "maximumConcurrency",
  "maximumReplans",
  "originLane",
  "adoptResult",
] as const);
const OPTIONAL_REQUEST_KEYS = Object.freeze([
  "decisionCapabilityReplacement",
  "requestedExecutorProvider",
] as const);
const requestKeySets = Object.freeze(
  [0, 1, 2, 3].map(
    (mask) =>
      new Set([
        ...REQUIRED_REQUEST_KEYS,
        ...OPTIONAL_REQUEST_KEYS.filter(
          (_optional, index) => (mask & (1 << index)) !== 0,
        ),
      ]),
  ),
);

/**
 * Project Runtime Objective Requestを観測する。
 *
 * @responsibility Project Runtime Objective Requestの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns ProjectRuntimeObjectiveRequest | nullを返す。
 * @precondition 「value: unknown」がinspectProjectRuntimeObjectiveRequestの入力契約を満たす。
 * @postcondition inspectProjectRuntimeObjectiveRequestの責務を完了した結果だけを返す。
 * @effect N/A: inspectProjectRuntimeObjectiveRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectProjectRuntimeObjectiveRequestは独自の失敗分岐を所有しない。
 * @invariant inspectProjectRuntimeObjectiveRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectProjectRuntimeObjectiveRequestはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectProjectRuntimeObjectiveRequestはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectProjectRuntimeObjectiveRequestは共有非同期状態を持たない同期処理である。
 */
export function inspectProjectRuntimeObjectiveRequest(
  value: unknown,
): ProjectRuntimeObjectiveRequest | null {
  const requestSnapshot = requestKeySets.reduce<Readonly<
    Record<string, unknown>
  > | null>(
    (accepted, keys) => accepted ?? snapshotPlainRecord(value, keys),
    null,
  );
  if (!requestSnapshot) return null;
  const request: Readonly<Record<string, unknown>> = requestSnapshot;
  const acceptanceCriteria = inspectStrings(
    request.acceptanceCriteria,
    128,
    2_048,
  );
  const allowedPaths = inspectStrings(request.allowedPaths, 128, 512);
  const readPaths = inspectStrings(request.readPaths, 128, 512);
  const replacement =
    request.decisionCapabilityReplacement === undefined
      ? undefined
      : snapshotPlainRecord(
          request.decisionCapabilityReplacement,
          new Set(["decisionId", "replacementRequestId"] as const),
        );
  if (
    !validId(request.requestId) ||
    !validId(request.projectId) ||
    !validId(request.milestoneId) ||
    !validRevision(request.repositoryRevision) ||
    !validText(request.objective, 16_384) ||
    !acceptanceCriteria ||
    !allowedPaths ||
    !readPaths ||
    !allowedPaths.every(
      (candidate) => normalizeRepositoryRelativePath(candidate) !== null,
    ) ||
    !readPaths.every(
      (candidate) => normalizeRepositoryRelativePath(candidate) !== null,
    ) ||
    !Number.isSafeInteger(request.maximumConcurrency) ||
    (request.maximumConcurrency as number) < 1 ||
    (request.maximumConcurrency as number) > 5 ||
    !Number.isSafeInteger(request.maximumReplans) ||
    (request.maximumReplans as number) < 0 ||
    (request.maximumReplans as number) > 32 ||
    (request.originLane !== "interactive" &&
      request.originLane !== "scheduled") ||
    typeof request.adoptResult !== "boolean" ||
    (request.requestedExecutorProvider !== undefined &&
      request.requestedExecutorProvider !== "auto" &&
      request.requestedExecutorProvider !== "codex" &&
      request.requestedExecutorProvider !== "claude") ||
    (request.decisionCapabilityReplacement !== undefined &&
      (!replacement ||
        !validId(replacement.decisionId) ||
        !validId(replacement.replacementRequestId)))
  )
    return null;
  return Object.freeze({
    requestId: request.requestId,
    projectId: request.projectId,
    milestoneId: request.milestoneId,
    repositoryRevision: request.repositoryRevision,
    objective: request.objective,
    acceptanceCriteria,
    allowedPaths,
    readPaths,
    maximumConcurrency: request.maximumConcurrency as number,
    maximumReplans: request.maximumReplans as number,
    originLane: request.originLane,
    adoptResult: request.adoptResult,
    ...(request.requestedExecutorProvider
      ? {
          requestedExecutorProvider: request.requestedExecutorProvider as
            | "auto"
            | "codex"
            | "claude",
        }
      : {}),
    ...(replacement
      ? {
          decisionCapabilityReplacement: Object.freeze({
            decisionId: replacement.decisionId as string,
            replacementRequestId: replacement.replacementRequestId as string,
          }),
        }
      : {}),
  });
}

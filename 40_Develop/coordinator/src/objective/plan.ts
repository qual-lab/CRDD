/**
 * 実行入口の要求検査をDomainの計画検査へ接続する。
 * @packageDocumentation
 * @responsibility Coordinator要求を検査し、計画の値規則はDomainへ委譲する。
 * @trace ARCH-000004
 * @boundary 実行認可・保存・外部Effectは発行しない。
 */
import {
  inspectExecutionPlan,
  type ObjectivePlan,
} from "../../../execution-model/src/index.ts";

/**
 * 受付済み要求の範囲と、依存処理が返した計画を照合する。
 * @responsibility 要求を捕捉し直さず、未知の計画だけをDomain値検査へ接続する。
 * @trace ARCH-000004
 * @input 未信頼の計画と、既存要求受付で捕捉済みのCoordinator要求。
 * @returns 不正入力はnull。正常時だけ検査済み計画。
 * @effect 外部Effectなし。
 * @security 入力検査を実行Authorityとして扱わない。
 */
export function inspectCoordinatorObjectivePlan(
  raw: unknown,
  request: CoordinatorObjectiveRequest,
): ObjectivePlan | null {
  return inspectExecutionPlan(raw, { allowedPaths: request.allowedPaths });
}

import {
  normalizeRepositoryRelativePath,
  repositoryPathWithin,
  snapshotPlainArray,
  snapshotPlainRecord,
} from "../input/snapshot.ts";
import type { CallerTaskInput, CoordinatorObjectiveRequest } from "./types.ts";

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
function validObjectiveId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)
  );
}

/**
 * Textが有効か判定する。
 *
 * @responsibility Textの有効条件、拒否条件、判定結果境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidTextの入力契約を満たす。
 * @postcondition validTextの責務を完了した結果だけを返す。
 * @effect N/A: validTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTextは独自の失敗分岐を所有しない。
 * @invariant validTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTextはProcess内の同一Subsystemで完結する。
 * @security N/A: validTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTextは共有非同期状態を持たない同期処理である。
 */
function validText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/**
 * Stringsを観測する。
 *
 * @responsibility Stringsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown、shouldAllowEmpty
 * @returns readonly string[] | nullを返す。
 * @precondition 「value: unknown、shouldAllowEmpty」がinspectStringsの入力契約を満たす。
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
  shouldAllowEmpty = false,
): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, Number.MAX_SAFE_INTEGER);
  if (
    snapshot.status !== "ok" ||
    (!shouldAllowEmpty && snapshot.value.length === 0) ||
    !snapshot.value.every((entry) => validText(entry)) ||
    new Set(
      snapshot.value.map((entry) =>
        (entry as string).replaceAll("\\", "/").toUpperCase(),
      ),
    ).size !== snapshot.value.length
  )
    return null;
  return Object.freeze([...(snapshot.value as readonly string[])]);
}

function inspectExplicitChoice(
  candidate: unknown,
): NonNullable<CoordinatorObjectiveRequest["choice"]> | null {
  const value = snapshotPlainRecord(
    candidate,
    new Set(["provider", "model", "effort"]),
  );
  if (
    !value ||
    (value.provider !== "codex" && value.provider !== "claude") ||
    typeof value.model !== "string" ||
    !/^[a-z0-9][a-z0-9._-]{0,127}$/u.test(value.model) ||
    typeof value.effort !== "string" ||
    !["low", "medium", "high", "xhigh", "max"].includes(value.effort)
  )
    return null;
  return Object.freeze({
    provider: value.provider,
    model: value.model,
    effort: value.effort as NonNullable<
      CoordinatorObjectiveRequest["choice"]
    >["effort"],
  });
}

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
function validObjectiveRequestId(value: unknown): value is string {
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
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がvalidTextの入力契約を満たす。
 * @postcondition validTextの責務を完了した結果だけを返す。
 * @effect N/A: validTextは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: validTextは独自の失敗分岐を所有しない。
 * @invariant validTextは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: validTextはProcess内の同一Subsystemで完結する。
 * @security N/A: validTextはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: validTextは共有非同期状態を持たない同期処理である。
 */
function validObjectiveRequestText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)
  );
}

/**
 * Stringsを観測する。
 *
 * @responsibility Stringsの観測対象、取得根拠、観測不能結果の境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns readonly string[] | nullを返す。
 * @precondition 「value: unknown」がinspectStringsの入力契約を満たす。
 * @postcondition inspectStringsの責務を完了した結果だけを返す。
 * @effect N/A: inspectStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectStringsは独自の失敗分岐を所有しない。
 * @invariant inspectStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectStringsはProcess内の同一Subsystemで完結する。
 * @security N/A: inspectStringsはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: inspectStringsは共有非同期状態を持たない同期処理である。
 */
function inspectObjectiveRequestStrings(
  value: unknown,
): readonly string[] | null {
  const snapshot = snapshotPlainArray(value, Number.MAX_SAFE_INTEGER);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.length === 0 ||
    !snapshot.value.every((entry) => validObjectiveRequestText(entry)) ||
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
  "plan",
  "taskInputs",
  "intakeEpoch",
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
  "workType",
  "choice",
  "workspaceId",
] as const);

const requestKeySets = Object.freeze(
  Array.from(
    { length: 2 ** OPTIONAL_REQUEST_KEYS.length },
    (_entry, mask) => mask,
  ).map(
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
 * Coordinator Objective Requestを観測する。
 *
 * @responsibility 閉じたObjective入力を所有Snapshotへ変換し、分類と明示選択の形式を検査する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns CoordinatorObjectiveRequest | nullを返す。
 * @precondition 「value: unknown」がinspectCoordinatorObjectiveRequestの入力契約を満たす。
 * @postcondition 受理した三項目を独立Snapshotにし、省略された希望を生成しない。
 * @effect N/A: inspectCoordinatorObjectiveRequestは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: inspectCoordinatorObjectiveRequestは独自の失敗分岐を所有しない。
 * @invariant inspectCoordinatorObjectiveRequestは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: inspectCoordinatorObjectiveRequestはProcess内の同一Subsystemで完結する。
 * @security 未知field、Accessor、Proxyと不正形式を拒否する。分類参照・技術適合性は選定Resolverが別に検証する。
 * @concurrency N/A: inspectCoordinatorObjectiveRequestは共有非同期状態を持たない同期処理である。
 */
export function inspectCoordinatorObjectiveRequest(
  value: unknown,
): CoordinatorObjectiveRequest | null {
  const requestSnapshot = requestKeySets.reduce<Readonly<
    Record<string, unknown>
  > | null>(
    (accepted, keys) => accepted ?? snapshotPlainRecord(value, keys),
    null,
  );
  if (!requestSnapshot) return null;
  const request: Readonly<Record<string, unknown>> = requestSnapshot;
  const choice = Object.hasOwn(request, "choice")
    ? inspectExplicitChoice(request.choice)
    : undefined;
  const acceptanceCriteria = inspectObjectiveRequestStrings(
    request.acceptanceCriteria,
  );
  const allowedPaths = inspectObjectiveRequestStrings(request.allowedPaths);
  const readPaths = inspectObjectiveRequestStrings(request.readPaths);
  if (
    !validObjectiveRequestId(request.intakeEpoch) ||
    !validObjectiveRequestId(request.requestId) ||
    !validObjectiveRequestId(request.projectId) ||
    !validObjectiveRequestId(request.milestoneId) ||
    !validRevision(request.repositoryRevision) ||
    !validObjectiveRequestText(request.objective) ||
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
    (Object.hasOwn(request, "workType") &&
      (typeof request.workType !== "string" ||
        !/^[a-z0-9][a-z0-9._-]*$/u.test(request.workType))) ||
    choice === null ||
    (Object.hasOwn(request, "workspaceId") &&
      (typeof request.workspaceId !== "string" ||
        !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(
          request.workspaceId,
        )))
  )
    return null;
  const plan = inspectExecutionPlan(request.plan, { allowedPaths });
  if (
    !plan ||
    JSON.stringify(plan.milestoneAcceptanceCriteria) !==
      JSON.stringify(acceptanceCriteria)
  )
    return null;
  const taskInputs = inspectCallerTaskInputs(
    plan,
    request.taskInputs,
    readPaths,
  );
  if (!taskInputs) return null;
  return Object.freeze({
    plan,
    taskInputs,
    intakeEpoch: request.intakeEpoch,
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
    ...(typeof request.workType === "string"
      ? { workType: request.workType }
      : {}),
    ...(choice ? { choice } : {}),
    ...(typeof request.workspaceId === "string"
      ? { workspaceId: request.workspaceId }
      : {}),
  });
}

export const COORDINATOR_OBJECTIVE_INTAKE_CONTRACT =
  "crdd-coordinator/orchestrator-objective-intake/v2" as const;

/**
 * Task定義と実行入力を一対一で固定する。
 * @responsibility 不足・余剰・重複・範囲外を拒否し、指示を自動生成しない。
 * @trace ARCH-000004
 * @input 検査済み計画、未信頼入力、全体の読取り範囲。
 * @returns 同じ宣言順の不変入力、又はnull。
 * @effect 外部Effectなし。
 * @security Getter／Proxyを実行せず、認可や再開権限を発行しない。
 */
export function inspectCallerTaskInputs(
  plan: ObjectivePlan,
  candidate: unknown,
  readPaths: readonly string[],
): readonly CallerTaskInput[] | null {
  const entries = snapshotPlainArray(candidate, Number.MAX_SAFE_INTEGER);
  const roots = snapshotPlainArray(readPaths, Number.MAX_SAFE_INTEGER);
  if (
    entries.status !== "ok" ||
    roots.status !== "ok" ||
    entries.value.length !== plan.tasks.length ||
    roots.value.length === 0 ||
    !roots.value.every(
      (root) => typeof root === "string" && repositoryPathWithin(root, [root]),
    )
  )
    return null;
  const ids = new Set(plan.tasks.map((task) => task.id));
  const seen = new Set<string>();
  const inputs: CallerTaskInput[] = [];
  for (const entry of entries.value) {
    const input = snapshotPlainRecord(
      entry,
      new Set(["taskId", "objective", "acceptanceCriteria", "readPaths"]),
    );
    if (
      !input ||
      !validObjectiveId(input.taskId) ||
      !ids.has(input.taskId) ||
      seen.has(input.taskId) ||
      !validText(input.objective)
    )
      return null;
    const acceptanceCriteria = inspectStrings(input.acceptanceCriteria);
    const paths = inspectStrings(input.readPaths);
    if (
      !acceptanceCriteria ||
      !paths?.every((value) =>
        repositoryPathWithin(value, roots.value as readonly string[]),
      )
    )
      return null;
    seen.add(input.taskId);
    inputs.push(
      Object.freeze({
        taskId: input.taskId,
        objective: input.objective,
        acceptanceCriteria,
        readPaths: paths,
      }),
    );
  }
  return Object.freeze(inputs);
}

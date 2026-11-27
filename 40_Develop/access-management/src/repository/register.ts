/**
 * 接続登録と解除を現在認可・実体検査・保存へ接続する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { isAbsolute } from "node:path";
import { readRepositoryManifest } from "@qual-lab/crdd-configuration-model";
import {
  createFilesystemRepositoryObservationPort,
  parseRepositoryProjectContextMarkdown,
} from "@qual-lab/crdd-document-model";
import {
  evaluateManagementPermission,
  projectManagementOperationResult,
} from "../authorization/management.ts";
import {
  acceptsAccessPrincipal,
  resolveAccessPrincipal,
} from "../authorization/principal.ts";
import type { AccountAccessPrincipal } from "../authorization/types.ts";
import type { FilesystemStoreRoot } from "../initialization/root.ts";
import type { ManagementOperationOutcome } from "../permission/types.ts";
import { locked } from "../storage/lock.ts";
import {
  captureGitHostReference,
  parseAccessManagementState,
} from "../storage/parse.ts";
import {
  ATTEMPT_UUID,
  ordinaryChange,
  publishState,
  readCurrent,
  serialize,
  settlePending,
} from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import { deriveRepositoryBindingId } from "./binding.ts";
import type {
  GitHostLinkedRepository,
  RepositoryManagementResult,
} from "./types.ts";

const ROOT_CODE_UNIT_LIMIT = 32_768;

/**
 * 呼出し側が今回の登録に対して提供するディレクトリ観測。
 * @responsibility 観測済みの絶対パスと、同じ対象を再確認する処理だけを受け取る。
 * @trace ARCH-000013
 * @shape 絶対Pathの同期観測。観測不能時はnull。
 * @invariant 登録状態・権限・Git識別値を渡さない。
 * @boundary 信頼した同Processの呼出し側から登録処理への一要求限定接続。
 * @security 通信入力からコールバックを選ばない。
 * @compatibility 保存形式と公開通信契約には含めない。
 */
type ObserveRegistrationDirectory = (directory: string) => Readonly<{
  directory: string;
  isCurrent: () => boolean;
  hostedRepository?: GitHostLinkedRepository;
}> | null;

function acceptsRegistrationDirectory(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= ROOT_CODE_UNIT_LIMIT &&
    isAbsolute(value) &&
    !/[\p{Cc}\p{Cs}]/u.test(value)
  );
}

function acceptsRepositoryId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(value)
  );
}

/**
 * リポジトリの登録と解除の入力。
 * @responsibility 操作別に必要な未知値を区別する。
 * @trace ARCH-000013
 * @shape registerRepositoryとunregisterRepositoryの判別共用体。
 * @invariant 入力Pathを保存・アクセスAuthorityにしない。
 * @boundary 私有保存Ownerと操作判断。
 * @security 資格材料を含めない。
 * @compatibility Package内部入力で、Transport Schemaではない。
 */
type RepositoryRegistrationChange =
  | {
      operation: "registerRepository";
      repositoryId: unknown;
      repositoryRoot: unknown;
      observeDirectory: ObserveRegistrationDirectory;
    }
  | { operation: "unregisterRepository"; repositoryId: unknown };

/**
 * 登録変更の入力・現在対象を外部観測なしで検査する。
 * @responsibility 登録済み／未登録と明示範囲を区別する。
 * @trace ARCH-000013
 * @input 現在状態と登録・解除の入力。登録Rootは32,768 UTF-16 code unit以下。
 * @returns 有効な入力・対象ならtrue。
 * @precondition 保存Ownerが同じ現在改訂を使い、外部観測前に認可する。
 * @postcondition 入力状態と対象Repository本文を変更しない。
 * @effect N/A: 現在値の同期検査だけ。
 * @failure 不正・欠測・観測不能は拒否し、例外を成功へ変えない。
 * @invariant 登録、公開設定、内容認可、実アクセスを同一視しない。
 * @boundary 認可後precheckと外部Root観測の前境界。
 * @security 秘密・内部Pathを公開結果へ透過しない。
 * @concurrency 同期Lock区間で使い、観測後の永久保証を主張しない。
 */
function acceptsRepositoryRegistrationChange(
  current: AccessManagementState,
  change: RepositoryRegistrationChange,
): boolean {
  if (!acceptsRepositoryId(change.repositoryId)) return false;
  const existing = current.registeredRepositories.some(
    (item) => item.repositoryId === change.repositoryId,
  );
  if (change.operation === "registerRepository")
    return (
      !existing &&
      typeof change.observeDirectory === "function" &&
      acceptsRegistrationDirectory(change.repositoryRoot)
    );
  return change.operation === "unregisterRepository" && existing;
}

/** 共有登録の事前判定。競合では保存・既存材料の清掃・外部照会を行わない。 */
export function checkHostedRepositoryRegistration(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  request: Readonly<{
    repositoryId: string;
    directory: string;
    expectedRevision: number;
    operationId: string;
  }>,
): "ready" | "rejected" | "conflict" {
  const { repositoryId, directory, expectedRevision, operationId } = request;
  if (
    !acceptsAccessPrincipal(principal) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId) ||
    !acceptsRepositoryId(repositoryId) ||
    !acceptsRegistrationDirectory(directory)
  )
    return "rejected";
  const observed = locked<"ready" | "rejected" | "conflict">(root, () => {
    const current = readCurrent(root);
    const { state } = current;
    const actor = resolveAccessPrincipal(principal, state);
    let value: "ready" | "rejected" | "conflict" = "rejected";
    if (
      actor &&
      state.initialization.stage === "completed" &&
      state.operationId !== operationId &&
      evaluateManagementPermission(actor.role, {
        operation: "registerRepository",
      }) === "allowed" &&
      !state.registeredRepositories.some(
        (entry) => entry.repositoryId === repositoryId,
      )
    ) {
      if (expectedRevision < state.revision) value = "conflict";
      if (expectedRevision === state.revision) {
        settlePending(root, current, () => {});
        value = "ready";
      }
    }
    return {
      status: "completed",
      value,
      publication: "not_attempted",
      revision: state.revision,
      cleanupConfirmed: true,
    };
  });
  return observed.status === "completed" ? observed.value : "rejected";
}

/**
 * 登録RootのCanonical Identityと表示投影を照合する。
 * @responsibility 呼出し側が確認した絶対ディレクトリと固定文書を登録に対応付ける。
 * @trace ARCH-000013
 * @input 検査済み登録IDと絶対Root。固定manifestとPROJECT_CONTEXTを通常Fileとして観測する。
 * @returns 登録tupleまたはnull。
 * @precondition 保存Ownerが同じ現在改訂を使い、外部観測前に認可する。
 * @postcondition 入力状態と対象Repository本文を変更しない。
 * @effect 呼出し側のディレクトリ観測と固定manifest／PROJECT_CONTEXTの読取りだけ。
 * @failure 不正・欠測・観測不能は拒否し、例外を成功へ変えない。
 * @invariant 登録、公開設定、内容認可、実アクセスを同一視しない。
 * @boundary 認可済み登録要求とRepository観測。
 * @security 秘密・内部Pathを公開結果へ透過しない。
 * @concurrency 同期Lock区間で使い、観測後の永久保証を主張しない。
 */
function observeRegistration(
  repositoryId: string,
  repositoryRoot: string,
  observeDirectory: ObserveRegistrationDirectory,
): AccessManagementState["registeredRepositories"][number] | null {
  const location = observeDirectory(repositoryRoot);
  if (!location) return null;
  const rawReference = location.hostedRepository;
  const hostedRepository =
    rawReference === undefined
      ? undefined
      : captureGitHostReference(rawReference);
  if (hostedRepository === null) return null;
  const root = location.directory;
  const observer = createFilesystemRepositoryObservationPort(root);
  const manifestRead = readRepositoryManifest(root);
  const contextFile = observer.observeFile("PROJECT_CONTEXT.md");
  if (manifestRead.status !== "ready" || contextFile.status !== "resolved")
    return null;
  const manifest = manifestRead.manifest;
  if (manifest.repositoryId !== repositoryId) return null;
  const contextIntake = parseRepositoryProjectContextMarkdown(
    contextFile.source,
  );
  const context = contextIntake.result;
  if (context === null)
    throw new Error(
      contextIntake.issues.find(
        (issue) =>
          issue.kind === "artifact.project-context.projection-model-invalid",
      )?.reason ?? "project_context_scene_invalid",
    );
  if (
    context.projectId !== manifest.projectId ||
    context.repositoryId !== manifest.repositoryId ||
    context.repositoryRole !== manifest.repositoryRole ||
    !location.isCurrent()
  )
    return null;
  return {
    repositoryId,
    repositoryRoot: root,
    bindingId: deriveRepositoryBindingId(repositoryId, root),
    ...(hostedRepository && { hostedRepository }),
  };
}

/**
 * 認可済み登録・解除の候補を構築する。
 * @responsibility 対象登録だけを次改訂へ反映し、解除に伴う旧公開行を残さない。
 * @trace ARCH-000013
 * @input 完全現在状態、検査済み登録・解除入力、受付ID。
 * @returns 所有済み候補またはnull。
 * @precondition 保存Ownerが同じ現在改訂を使い、外部観測前に認可する。
 * @postcondition 入力状態と対象Repository本文を変更しない。
 * @effect 登録だけ固定File観測。解除はメモリ処理だけ。
 * @failure 不正・欠測・観測不能は拒否し、例外を成功へ変えない。
 * @invariant 登録、公開設定、内容認可、実アクセスを同一視しない。
 * @boundary 操作固有意味と保存Owner。
 * @security 秘密・内部Pathを公開結果へ透過しない。
 * @concurrency 同期Lock区間で使い、観測後の永久保証を主張しない。
 */
function prepareRepositoryRegistrationChange(
  current: AccessManagementState,
  change: RepositoryRegistrationChange,
  operationId: string,
): AccessManagementState | null {
  if (!acceptsRepositoryRegistrationChange(current, change)) return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = operationId;
  const id = change.repositoryId as string;
  if (change.operation === "registerRepository") {
    const registration = observeRegistration(
      id,
      change.repositoryRoot as string,
      change.observeDirectory,
    );
    if (!registration?.hostedRepository) return null;
    if (
      current.registeredRepositories.some(
        (item) => item.bindingId === registration.bindingId,
      )
    )
      return null;
    next.registeredRepositories.push(registration);
  } else {
    next.registeredRepositories = next.registeredRepositories.filter(
      (item) => item.repositoryId !== id,
    );
  }
  return next;
}

/**
 * 登録・解除の現在認可と保存を直列化する。
 * @responsibility 認可前の外部Root観測・先行材料清掃を行わない。
 * @trace ARCH-000013
 * @input Root、主体、期待改訂、受付UUID、登録・解除入力。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録以外とRepository本体を保持する。
 * @effect 既存Lock、登録時固定File観測、既存pending／replace／current出版。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
function executeRepositoryRegistration(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  expectedRevision: number,
  operationId: string,
  change: RepositoryRegistrationChange,
): RepositoryManagementResult {
  if (
    !acceptsAccessPrincipal(principal) ||
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    typeof operationId !== "string" ||
    !ATTEMPT_UUID.test(operationId)
  )
    return { status: "unavailable", reason: "management_operation_rejected" };
  let admitted = false;
  let currentPublication: "not_attempted" | "unconfirmed" | "confirmed" =
    "not_attempted";
  const result = locked(root, () => {
    let revision: number | null = null;
    let stage = "read";
    let materialsConfirmed = false;
    try {
      const current = readCurrent(root);
      revision = current.state.revision;
      stage = "authorization";
      const actor = resolveAccessPrincipal(principal, current.state);
      if (
        !actor ||
        current.state.initialization.stage !== "completed" ||
        revision < expectedRevision ||
        current.state.operationId === operationId ||
        evaluateManagementPermission(actor.role, {
          operation: change.operation,
        }) !== "allowed" ||
        !acceptsRepositoryRegistrationChange(current.state, change)
      )
        return {
          status: "unavailable" as const,
          reason: "management_operation_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      admitted = true;
      if (revision !== expectedRevision)
        return {
          status: "unavailable" as const,
          reason: "state_store_revision_conflict",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      stage = "pending";
      const settled = settlePending(root, current, () => {});
      materialsConfirmed = true;
      if (settled !== "none")
        return {
          status: "unavailable" as const,
          reason: "state_store_previous_pending_settled",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      stage = "repository_binding";
      const next = prepareRepositoryRegistrationChange(
        current.state,
        change,
        operationId,
      );
      if (!next) throw new Error("repository_binding_invalid");
      stage = "candidate";
      const parsed = parseAccessManagementState(serialize(next));
      if (
        parsed.status !== "parsed" ||
        !ordinaryChange(current.state, parsed.state)
      )
        throw new Error("repository_candidate_invalid");
      const published = publishState(root, current, parsed.state, "management");
      currentPublication = published.publication;
      return published;
    } catch {
      return {
        status: "unavailable" as const,
        reason: `state_store_${stage}_failed`,
        publication: currentPublication,
        revision,
        cleanupConfirmed: materialsConfirmed,
      };
    }
  });
  if (!admitted)
    return { status: "unavailable", reason: "management_operation_rejected" };
  if (result.status === "completed")
    return {
      status: "completed",
      operationId,
      expectedRevision,
      revision: result.value.revision,
      repositoryId: change.repositoryId as string,
      publication: "confirmed",
      cleanupConfirmed: true,
    };
  return {
    status: "unavailable",
    reason: "management_operation_unavailable",
    primaryFailure: result.reason,
    operationId,
    expectedRevision,
    observedRevision: result.revision,
    publication: currentPublication,
    cleanupConfirmed: result.cleanupConfirmed,
  };
}

/**
 * 現在manager／administratorがRepositoryを登録する。
 * @responsibility Canonical Identityと検証Rootを登録するが公開しない。
 * @trace ARCH-000013
 * @input Root、確認済みアカウント主体、期待改訂、受付UUID、Repository ID、絶対パス、呼出し側のディレクトリ観測。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録以外とRepository本体を保持する。
 * @effect 認可後の固定File読取りと既存保存。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function saveRepositoryRegistration(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
  repositoryRoot: unknown,
  observeDirectory: ObserveRegistrationDirectory,
): RepositoryManagementResult {
  return executeRepositoryRegistration(
    root,
    principal,
    expectedRevision,
    operationId,
    {
      operation: "registerRepository",
      repositoryId,
      repositoryRoot,
      observeDirectory,
    },
  );
}

/**
 * Repository登録を解除する。
 * @responsibility 旧Rootの再検査を要求せず対象管理情報だけを除去する。
 * @trace ARCH-000013
 * @input Root、確認済みアカウント主体、期待改訂、受付UUID、既存Repository ID。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録以外とRepository本体を保持する。
 * @effect AM管理状態の保存だけ。対象Repository観測・変更0。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function saveRepositoryRemoval(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
): RepositoryManagementResult {
  return executeRepositoryRegistration(
    root,
    principal,
    expectedRevision,
    operationId,
    { operation: "unregisterRepository", repositoryId },
  );
}

/**
 * 現在manager／administratorがRepositoryを登録する。
 * @responsibility Canonical Identityと検証Rootを登録するが公開しない。
 * @trace ARCH-000013
 * @input Root、確認済みアカウント主体、期待改訂、受付UUID、Repository ID、絶対パス、呼出し側のディレクトリ観測。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録以外とRepository本体を保持する。
 * @effect 認可後の固定File読取りと既存保存。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function registerRepository(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
  repositoryRoot: unknown,
  observeDirectory: ObserveRegistrationDirectory,
): ManagementOperationOutcome {
  return projectManagementOperationResult(
    saveRepositoryRegistration(
      root,
      principal,
      expectedRevision,
      operationId,
      repositoryId,
      repositoryRoot,
      observeDirectory,
    ),
  );
}

/**
 * Repository登録を解除する。
 * @responsibility 旧Rootの再検査を要求せず対象管理情報だけを除去する。
 * @trace ARCH-000013
 * @input Root、確認済みアカウント主体、期待改訂、受付UUID、既存Repository ID。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録以外とRepository本体を保持する。
 * @effect AM管理状態の保存だけ。対象Repository観測・変更0。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function unregisterRepository(
  root: FilesystemStoreRoot,
  principal: AccountAccessPrincipal,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
): ManagementOperationOutcome {
  return projectManagementOperationResult(
    saveRepositoryRemoval(
      root,
      principal,
      expectedRevision,
      operationId,
      repositoryId,
    ),
  );
}

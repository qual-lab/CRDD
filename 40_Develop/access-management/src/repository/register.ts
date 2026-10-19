/**
 * 接続登録と解除を現在認可・実体検査・保存へ接続する。
 * @packageDocumentation
 * @responsibility 既存の操作・認可・保存境界を維持し、この責務の実装を集約する。
 * @trace ARCH-000013
 */

import { isAbsolute } from "node:path";
import {
  createFilesystemRepositoryObservationPort,
  type FilesystemStoreRoot,
  inspectRepositoryManifest,
  parseRepositoryProjectContextMarkdown,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "../../../domain-model/src/index.ts";
import {
  resolveVerifiedRepositoryRoot,
  verifyRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  evaluateManagementPermission,
  projectManagementOperationResult,
} from "../authorization/management.ts";
import { resolveCredentialAuthentication } from "../credential/authentication.ts";
import { readCredentialId } from "../credential/token.ts";
import type { ManagementOperationOutcome } from "../permission/types.ts";
import { parseContentAreaIds } from "../permission/validation.ts";
import { parseAccessManagementState } from "../storage/parse.ts";
import {
  ATTEMPT_UUID,
  locked,
  ordinaryChange,
  publishState,
  readCurrent,
  serialize,
  settlePending,
} from "../storage/store.ts";
import type { AccessManagementState } from "../storage/types.ts";
import { deriveRepositoryBindingId } from "./binding.ts";
import type { RepositoryExposureManagementResult } from "./types.ts";

const ROOT_CODE_UNIT_LIMIT = 32_768;

const REGISTRATION_FILE_BYTE_LIMIT = 1_048_576;

/**
 * 登録と公開範囲の三操作入力。
 * @responsibility 操作別に必要な未知値を区別する。
 * @trace ARCH-000013
 * @shape registerRepository、unregisterRepository、updateExposureの判別共用体。
 * @invariant 入力Pathを保存・アクセスAuthorityにしない。
 * @boundary 私有保存Ownerと操作判断。
 * @security 資格材料を含めない。
 * @compatibility Package内部入力で、Transport Schemaではない。
 */
export type RepositoryExposureChange =
  | {
      operation: "registerRepository";
      repositoryId: unknown;
      repositoryRoot: unknown;
    }
  | { operation: "unregisterRepository"; repositoryId: unknown }
  | {
      operation: "updateExposure";
      repositoryId: unknown;
      workspaceIds: unknown;
    };

/**
 * 登録変更の入力・現在対象を外部観測なしで検査する。
 * @responsibility 登録済み／未登録と明示範囲を区別する。
 * @trace ARCH-000013
 * @input 現在状態と内部三操作入力。登録Rootは32,768 UTF-16 code unit以下。
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
export function acceptsRepositoryExposureChange(
  current: AccessManagementState,
  change: RepositoryExposureChange,
): boolean {
  if (
    typeof change.repositoryId !== "string" ||
    change.repositoryId.length > 128 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(change.repositoryId)
  )
    return false;
  const existing = current.registeredRepositories.some(
    (item) => item.repositoryId === change.repositoryId,
  );
  if (change.operation === "registerRepository")
    return (
      !existing &&
      typeof change.repositoryRoot === "string" &&
      change.repositoryRoot.length <= ROOT_CODE_UNIT_LIMIT &&
      isAbsolute(change.repositoryRoot) &&
      !/[\p{Cc}\p{Cs}]/u.test(change.repositoryRoot)
    );
  return (
    existing &&
    (change.operation === "unregisterRepository" ||
      parseContentAreaIds(change.workspaceIds) !== null)
  );
}

/**
 * 登録RootのCanonical Identityと表示投影を照合する。
 * @responsibility 既存VC／Domain公開APIから検証済み登録tupleだけを得る。
 * @trace ARCH-000013
 * @input 検査済み登録IDと絶対Root。固定manifestとPROJECT_CONTEXTは各1 MiB以下。
 * @returns 登録tupleまたはnull。
 * @precondition 保存Ownerが同じ現在改訂を使い、外部観測前に認可する。
 * @postcondition 入力状態と対象Repository本文を変更しない。
 * @effect Git Rootと固定manifest／PROJECT_CONTEXTの読取りだけ。
 * @failure 不正・欠測・観測不能は拒否し、例外を成功へ変えない。
 * @invariant 登録、公開設定、内容認可、実アクセスを同一視しない。
 * @boundary 認可済み登録要求とRepository観測。
 * @security 秘密・内部Pathを公開結果へ透過しない。
 * @concurrency 同期Lock区間で使い、観測後の永久保証を主張しない。
 */
function observeRegistration(
  repositoryId: string,
  repositoryRoot: string,
): AccessManagementState["registeredRepositories"][number] | null {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed") return null;
  const root = resolveVerifiedRepositoryRoot(verified.capability);
  if (root === null) return null;
  const observer = createFilesystemRepositoryObservationPort(
    verified.capability,
    REGISTRATION_FILE_BYTE_LIMIT,
  );
  const manifestFile = observer.observeFile(REPOSITORY_MANIFEST_RELATIVE_PATH);
  const contextFile = observer.observeFile("PROJECT_CONTEXT.md");
  if (manifestFile.status !== "resolved" || contextFile.status !== "resolved")
    return null;
  const manifest = inspectRepositoryManifest(JSON.parse(manifestFile.source));
  if (!manifest || manifest.repositoryId !== repositoryId) return null;
  const context = parseRepositoryProjectContextMarkdown(contextFile.source);
  if (
    context.projectId !== manifest.projectId ||
    context.repositoryId !== manifest.repositoryId ||
    context.repositoryRole !== manifest.repositoryRole ||
    resolveVerifiedRepositoryRoot(verified.capability) !== root
  )
    return null;
  return {
    repositoryId,
    repositoryRoot: root,
    bindingId: deriveRepositoryBindingId(repositoryId, root),
  };
}

/**
 * 認可済み登録・解除・Exposureの候補を構築する。
 * @responsibility 意図した登録／公開fieldだけを同じ次改訂へ変更する。
 * @trace ARCH-000013
 * @input 完全現在状態、検査済み三操作入力、受付ID。
 * @returns 所有済み候補またはnull。
 * @precondition 保存Ownerが同じ現在改訂を使い、外部観測前に認可する。
 * @postcondition 入力状態と対象Repository本文を変更しない。
 * @effect 登録だけ固定File観測。解除・Exposureはメモリ処理だけ。
 * @failure 不正・欠測・観測不能は拒否し、例外を成功へ変えない。
 * @invariant 登録、公開設定、内容認可、実アクセスを同一視しない。
 * @boundary 操作固有意味と保存Owner。
 * @security 秘密・内部Pathを公開結果へ透過しない。
 * @concurrency 同期Lock区間で使い、観測後の永久保証を主張しない。
 */
export function prepareRepositoryExposureChange(
  current: AccessManagementState,
  change: RepositoryExposureChange,
  operationId: string,
): AccessManagementState | null {
  if (!acceptsRepositoryExposureChange(current, change)) return null;
  const next = structuredClone(current);
  next.revision++;
  next.operationId = operationId;
  const id = change.repositoryId as string;
  if (change.operation === "registerRepository") {
    const registration = observeRegistration(
      id,
      change.repositoryRoot as string,
    );
    if (!registration) return null;
    if (
      current.registeredRepositories.some(
        (item) => item.bindingId === registration.bindingId,
      )
    )
      return null;
    next.registeredRepositories.push(registration);
  } else if (change.operation === "unregisterRepository") {
    next.registeredRepositories = next.registeredRepositories.filter(
      (item) => item.repositoryId !== id,
    );
    next.exposure = next.exposure.filter((item) => item.repositoryId !== id);
  } else {
    const workspaceIds = parseContentAreaIds(change.workspaceIds);
    if (!workspaceIds) return null;
    const existing = next.exposure.find((item) => item.repositoryId === id);
    if (existing) existing.workspaceIds = workspaceIds;
    else next.exposure.push({ repositoryId: id, workspaceIds });
  }
  return next;
}

/**
 * 登録・解除・公開更新の現在認可と保存を直列化する。
 * @responsibility 認可前の外部Root観測・先行材料清掃を行わない。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、内部三操作。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect 既存Lock、登録時固定File観測、既存pending／replace／current出版。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function executeRepositoryExposureMutation(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  change: RepositoryExposureChange,
): RepositoryExposureManagementResult {
  if (
    typeof token !== "string" ||
    !readCredentialId(token) ||
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
      const actor = resolveCredentialAuthentication(token, current.state);
      if (
        !actor ||
        current.state.initialization.stage !== "completed" ||
        revision !== expectedRevision ||
        current.state.operationId === operationId ||
        evaluateManagementPermission(actor.role, {
          operation: change.operation,
        }) !== "allowed" ||
        !acceptsRepositoryExposureChange(current.state, change)
      )
        return {
          status: "unavailable" as const,
          reason: "management_operation_rejected",
          publication: "not_attempted" as const,
          revision,
          cleanupConfirmed: true,
        };
      admitted = true;
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
      const next = prepareRepositoryExposureChange(
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
 * @input Root、鍵、期待改訂、受付UUID、Repository ID、絶対Root。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect 認可後の固定File読取りと既存保存。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function saveRepositoryRegistration(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
  repositoryRoot: unknown,
): RepositoryExposureManagementResult {
  return executeRepositoryExposureMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "registerRepository", repositoryId, repositoryRoot },
  );
}

/**
 * Repository登録と対応Exposureを同じ改訂で解除する。
 * @responsibility 旧Rootの再検査を要求せず対象管理情報だけを除去する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存Repository ID。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect AM管理状態の保存だけ。対象Repository観測・変更0。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function saveRepositoryRemoval(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
): RepositoryExposureManagementResult {
  return executeRepositoryExposureMutation(
    root,
    token,
    expectedRevision,
    operationId,
    { operation: "unregisterRepository", repositoryId },
  );
}

/**
 * 現在manager／administratorがRepositoryを登録する。
 * @responsibility Canonical Identityと検証Rootを登録するが公開しない。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、Repository ID、絶対Root。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect 認可後の固定File読取りと既存保存。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function registerRepository(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
  repositoryRoot: unknown,
): ManagementOperationOutcome {
  return projectManagementOperationResult(
    saveRepositoryRegistration(
      root,
      token,
      expectedRevision,
      operationId,
      repositoryId,
      repositoryRoot,
    ),
  );
}

/**
 * Repository登録と対応Exposureを同じ改訂で解除する。
 * @responsibility 旧Rootの再検査を要求せず対象管理情報だけを除去する。
 * @trace ARCH-000013
 * @input Root、鍵、期待改訂、受付UUID、既存Repository ID。
 * @returns 非秘密の対象・改訂・出版／清掃結果、または非開示拒否。
 * @precondition 完了初期化の用途限定Rootを使う内部Consumer。
 * @postcondition 対象登録／Exposure以外とRepository本体を保持する。
 * @effect AM管理状態の保存だけ。対象Repository観測・変更0。
 * @failure 認可前は固定拒否、認可後は今回の最初の失敗を返す。
 * @invariant 登録は公開ではなく、解除はTask取消ではない。
 * @boundary 通常接続管理と既存保存Owner。
 * @security 秘密・内部Root・Lock回復参照は返さない。
 * @concurrency 現在認可・期待改訂・処置を同じLockに閉じる。
 */
export function unregisterRepository(
  root: FilesystemStoreRoot,
  token: string,
  expectedRevision: number,
  operationId: string,
  repositoryId: unknown,
): ManagementOperationOutcome {
  return projectManagementOperationResult(
    saveRepositoryRemoval(
      root,
      token,
      expectedRevision,
      operationId,
      repositoryId,
    ),
  );
}

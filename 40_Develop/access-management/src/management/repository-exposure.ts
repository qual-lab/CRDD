/**
 * 登録RootとIdentityを観測し、登録・解除・公開設定の変更候補を構築する。
 * @responsibility 採用済み管理契約を既存Ownerへ接続する。
 * @trace ARCH-000013
 */
import { isAbsolute } from "node:path";
import {
  verifyRepositoryRoot,
  resolveVerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  createFilesystemRepositoryObservationPort,
  inspectRepositoryManifest,
  parseRepositoryProjectContextMarkdown,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
} from "../../../domain-model/src/index.ts";
import type { AccessManagementState } from "../state/parse.ts";
import { deriveRepositoryBindingId } from "../state/repository-binding.ts";
import { readWorkspaceIds } from "../access/workspace-range.ts";

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
      readWorkspaceIds(change.workspaceIds) !== null)
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
    const workspaceIds = readWorkspaceIds(change.workspaceIds);
    if (!workspaceIds) return null;
    const existing = next.exposure.find((item) => item.repositoryId === id);
    if (existing) existing.workspaceIds = workspaceIds;
    else next.exposure.push({ repositoryId: id, workspaceIds });
  }
  return next;
}

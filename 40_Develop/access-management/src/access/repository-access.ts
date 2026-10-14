/**
 * 現在内容認可と登録Repositoryの実体検証を接続する。
 * @responsibility 許可済み対象だけを固定manifestと既存Root検証へ渡す。
 * @trace ARCH-000013
 */
import {
  verifyRepositoryRoot,
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/index.ts";
import {
  createFilesystemRepositoryObservationPort,
  inspectRepositoryManifest,
  REPOSITORY_MANIFEST_RELATIVE_PATH,
  type RepositoryManifest,
} from "../../../domain-model/src/index.ts";
import type { AuthenticatedRequest } from "../credential/authentication.ts";
import type { AccessManagementState } from "../state/parse.ts";
import { deriveRepositoryBindingId } from "../state/repository-binding.ts";

/**
 * 同じ要求の公開前後で現在認可集合の契約値を比較する。
 * @responsibility 管理改訂・Binding・Workspace・manifestの変化を公開前に拒否する。
 * @trace ARCH-000013
 * @input 初回と再観測のAM集合結果。
 * @returns 両観測がcompletedで契約値が一致する場合だけtrue。
 * @precondition 呼出し側は既存AM APIを要求内で二回呼び、外部JSONを渡さない。
 * @postcondition 不明・改訂差・集合差を一致へ畳まない。
 * @effect N/A: 短命値の同期比較だけ。
 * @failure 観測不成立はfalse。
 * @invariant 比較結果は新Authorityや次要求の認可証明ではない。同一Pathの物理実体不変は保証しない。
 * @boundary AM現在認可集合とWorkbench／MCP公開直前。
 * @security Root・資格を比較文字列や公開結果へ追加しない。
 * @concurrency 呼出し側は再観測・比較後にSignalを再確認し、外部I/Oなしに公開または拒否する。
 */
export function sameAccessCollection(
  first: RepositoryAccessCollectionResult,
  second: RepositoryAccessCollectionResult,
): boolean {
  if (
    first.status !== "completed" ||
    second.status !== "completed" ||
    first.managementRevision !== second.managementRevision
  )
    return false;
  const normalized = [first, second].map((collection) =>
    collection.repositories
      .map((repository) => ({
        repositoryId: repository.repositoryId,
        bindingId: repository.bindingId,
        workspaceIds: [...repository.workspaceIds].sort(),
        manifest: Object.fromEntries(
          Object.entries(repository.manifest).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        ),
      }))
      .sort((a, b) =>
        a.repositoryId < b.repositoryId
          ? -1
          : a.repositoryId > b.repositoryId
            ? 1
            : 0,
      ),
  );
  return JSON.stringify(normalized[0]) === JSON.stringify(normalized[1]);
}

/**
 * 今回要求で使用する検証済みRepositoryを相関する。
 * @responsibility 管理改訂・内容範囲・登録Bindingと技術的Rootを一つに閉じる。
 * @trace ARCH-000013
 * @shape revision、repositoryId、workspaceId、bindingId、manifest、root。
 * @invariant rootは技術的能力であり、次要求の認可証明ではない。
 * @boundary AMから信頼した同Processの内容Consumerへだけ渡す。
 * @security 保存・cache・Transport応答化を禁止し、別要求は再認可する。
 * @compatibility 型による失効機構はなく、Consumer固有lifecycleの現在要求だけに使用する。
 */
export type RepositoryAccess = Readonly<{
  revision: number;
  repositoryId: string;
  workspaceId: "development" | "management";
  bindingId: string;
  manifest: RepositoryManifest;
  root: VerifiedRepositoryRoot;
}>;

/**
 * 内容要求の拒否と許可後の観測不成立を分ける。
 * @responsibility 不明時に内部Root・例外・資格を返さない。
 * @trace ARCH-000013
 * @shape completedはaccess、unavailableは固定reasonだけ。
 * @invariant 未許可対象と未登録対象の存在を区別しない。
 * @boundary Package内部利用結果。MCP／HTTPの公開DTOではない。
 * @security capabilityを外部へ返さず、解放不明ではaccessなし。
 * @compatibility 本番Consumerによる要求限定使用の検証を別途必要とする。
 */
export type RepositoryAccessResult =
  | Readonly<{ status: "completed"; access: RepositoryAccess }>
  | Readonly<{
      status: "unavailable";
      reason:
        | "repository_access_rejected"
        | "repository_access_lock_unavailable"
        | "repository_access_cleanup_pending"
        | "repository_access_observation_unknown"
        | "repository_access_release_unknown";
    }>;

/**
 * 同じ要求で許可されたRepositoryと全内容範囲を保持する。
 * @responsibility Repositoryを一意にし、複数の許可範囲を落とさない。
 * @trace ARCH-000013
 * @shape repositoryId、workspaceIds、bindingId、manifest、root。
 * @invariant 管理改訂は集合側で保持し、本文の版と混同しない。
 * @boundary 信頼した同Processの今回要求だけ。
 * @security 保存・cache・TransportへのRoot公開を禁止する。
 * @compatibility 次要求では現在認可を再評価する。
 */
export type AuthorizedRepository = Readonly<{
  repositoryId: string;
  workspaceIds: readonly ("development" | "management")[];
  bindingId: string;
  manifest: RepositoryManifest;
  root: VerifiedRepositoryRoot;
}>;

/**
 * 同改訂の許可集合と取得不能を区別する。
 * @responsibility 認証済み空集合だけを成功とし、部分観測を成功にしない。
 * @trace ARCH-000013
 * @shape completedはmanagementRevisionとrepositories、unavailableは固定reason。
 * @invariant managementRevisionはContext本文の版ではない。
 * @boundary AM内部Consumer向け。外部応答DTOではない。
 * @security 失敗時はRoot・対象一覧・資格情報を返さない。
 * @compatibility 同じ要求だけで使う短命値であり失効機構ではない。
 */
export type RepositoryAccessCollectionResult =
  | Readonly<{
      status: "completed";
      managementRevision: number;
      repositories: readonly AuthorizedRepository[];
    }>
  | Extract<RepositoryAccessResult, { status: "unavailable" }>;

/**
 * 同じ現在改訂から内容範囲と公開対象を選ぶ。
 * @responsibility 管理能力を内容権限へ転用せず、観測前に対象を絞る。
 * @trace ARCH-000013
 * @input 完全状態、同改訂の認証主体、primitive検査済みIDと範囲。
 * @returns 許可された登録tuple、またはnull。
 * @precondition 保存Ownerの同じLock内で評価する。
 * @postcondition 未許可対象へのFilesystem観測0。
 * @effect N/A: メモリ内の現在値だけを参照する。
 * @failure 初回途中・改訂不一致・範囲外・未公開・未登録は同じnull。
 * @invariant administrator固定管理能力から内容許可を補完しない。
 * @boundary 認証主体→現在Role内容範囲→Exposure→登録対象。
 * @security 非許可対象のIdentityや件数を公開しない。
 * @concurrency 要求開始時の改訂だけ。次要求は再評価する。
 */
export function selectRepositoryAccess(
  state: AccessManagementState,
  actor: AuthenticatedRequest,
  repositoryId: string,
  workspaceId: "development" | "management",
): AccessManagementState["registeredRepositories"][number] | null {
  if (
    actor.revision !== state.revision ||
    state.initialization.stage !== "completed" ||
    !actor.workspaceIds.includes(workspaceId) ||
    !state.exposure.some(
      (item) =>
        item.repositoryId === repositoryId &&
        item.workspaceIds.includes(workspaceId),
    )
  )
    return null;
  return (
    state.registeredRepositories.find(
      (item) => item.repositoryId === repositoryId,
    ) ?? null
  );
}

/**
 * 許可済み登録のRoot・Binding・Canonical manifestを再検証する。
 * @responsibility 過去の登録成功を現在の実アクセス保証へ流用しない。
 * @trace ARCH-000013
 * @input 許可済み登録tuple、現在改訂、採用済み内容範囲。
 * @returns 同要求だけの内部相関値、またはnull。
 * @precondition 現在認可と短命材料清掃を確認済みである。
 * @postcondition 固定manifestのID・Root・Bindingが一致する場合だけ能力を返す。
 * @effect 既存VC Root検証とDomain固定manifestの最大1MiB読取り。
 * @failure Root・Binding・manifestの欠測・不正・観測不能はnull。例外は保存Ownerが固定理由へ変換する。
 * @invariant PROJECT_CONTEXTの存在・内容はアクセスAuthorityにしない。
 * @boundary AM実アクセス判定→VC／Domain既存観測。
 * @security 任意Path・本文・下位例外を結果へ透過しない。
 * @concurrency 同期bounded観測。本文の取得はLock解放後のConsumerが所有する。
 */
export function observeRepositoryAccess(
  registration: AccessManagementState["registeredRepositories"][number],
  revision: number,
  workspaceId: "development" | "management",
): RepositoryAccess | null {
  const verified = verifyRepositoryRoot(registration.repositoryRoot);
  if (verified.status !== "completed") return null;
  const root = resolveVerifiedRepositoryRoot(verified.capability);
  if (
    root === null ||
    deriveRepositoryBindingId(registration.repositoryId, root) !==
      registration.bindingId
  )
    return null;
  const observer = createFilesystemRepositoryObservationPort(
    verified.capability,
    1_048_576,
  );
  const file = observer.observeFile(REPOSITORY_MANIFEST_RELATIVE_PATH);
  if (file.status !== "resolved") return null;
  const manifest = inspectRepositoryManifest(JSON.parse(file.source));
  if (
    !manifest ||
    manifest.repositoryId !== registration.repositoryId ||
    resolveVerifiedRepositoryRoot(verified.capability) !== root
  )
    return null;
  return Object.freeze({
    revision,
    repositoryId: registration.repositoryId,
    workspaceId,
    bindingId: registration.bindingId,
    manifest,
    root: verified.capability,
  });
}

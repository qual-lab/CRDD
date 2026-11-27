/**
 * CRDD Serverの非秘密公開配置設定を所有する。
 * @responsibility HTTPS Originの検査と当該Server設定読取りを同じ責務で扱う。
 * @trace ARCH-000012
 */

import {
  evaluateManagementPermission,
  readCurrentAccess,
  type FilesystemStoreRoot,
} from "@qual-lab/crdd-access-management";
import {
  resolveHostedDevelopmentAccess,
  type HostedAccessSession,
} from "./access.ts";
import { getModelCatalog, type ModelCatalog } from "@qual-lab/crdd-ai-adapter";
import {
  readRepositoryAiSelection,
  saveRepositoryAiSelection,
  validateAiSelectionConfig,
  type AiSelectionCatalog,
  type AiSelectionReadResult,
  type AiSelectionSaveResult,
} from "@qual-lab/crdd-configuration-model";
import { createHash } from "node:crypto";
import fs, { type Stats } from "node:fs";
import * as asyncFs from "node:fs/promises";
import path from "node:path";
import {
  getRepositoryFromWorkingDirectory,
  registerRepositoryLocalIgnore,
  resolveVerifiedRepositoryRoot,
  type Repository,
} from "@qual-lab/crdd-version-control";

type ServerConnection = "workbench" | "mcp";

/**
 * 認可済みのAI選定設定を保存できるようにRepositoryを準備する。
 * @responsibility Git除外と固定Directory準備をServerで行い、設定の保存は構成モデルへ委譲する。
 * @trace ARCH-000012
 * @input 選択済みRepository、対応するGit入力、再認可、受付済みCAS期待値と設定、技術Catalog。
 * @returns 保存結果、または準備失敗と元の回復参照。
 * @precondition CAS期待値はTransportで検査済み。Git操作前に設定値と現在認可を確認する。
 * @postcondition 除外確認前に設定領域を作らず、領域準備の失敗時に設定を公開しない。
 * @effect 選択RepositoryのGit除外と固定config領域の準備、設定保存。
 * @failure Git出版不明を保存前拒否に変えず、元の回復参照を保持する。
 * @invariant 既存の設定形式、Lockと設定保存時の再認可は構成モデルが所有する。
 * @boundary CRDD ServerからVC・構成モデルへの接続。
 * @security 許可されたRepository以外へ書き込まず、実体Pathや設定本文を失敗に含めない。
 * @concurrency Git除外と設定保存はそれぞれのOwnerの排他に従う。
 */
export function updateAiSelection(
  access: Awaited<ReturnType<typeof resolveAiSelectionAccess>>,
  repository: Repository,
  request: { expectedIdentity: string | null; config: unknown },
  catalog: AiSelectionCatalog,
) {
  const blocked = (reason: string): AiSelectionSaveResult =>
    Object.freeze({ status: "blocked", reason, snapshot: null });
  const checked = validateAiSelectionConfig(request.config, catalog);
  if (checked.status !== "valid") return blocked(checked.reason);
  try {
    if (!access.authorize()) return blocked("ai_selection_access_unconfirmed");
  } catch {
    return blocked("ai_selection_access_unconfirmed");
  }
  try {
    const ignore = registerRepositoryLocalIgnore(repository, ".crdd/");
    if (ignore.status !== "registered") {
      const setupFailure = Object.freeze({
        status: "blocked" as const,
        reason: "repository_runtime_data_ignore_registration_blocked" as const,
        effectIssued: ignore.effectIssued,
        effectStateUnknown: ignore.effectStateUnknown,
        effectConfirmation: ignore.effectConfirmation,
        cleanupConfirmed: ignore.cleanupConfirmed,
        retryAllowed: ignore.retryAllowed,
        recoveryReference: ignore.recoveryReference,
        repositoryPathReported: false as const,
      });
      return ignore.effectStateUnknown || !ignore.cleanupConfirmed
        ? Object.freeze({
            status: "unknown" as const,
            reason: setupFailure.reason,
            snapshot: null,
            publication: "not_published" as const,
            cleanupConfirmed: ignore.cleanupConfirmed,
            recoveryId: null,
            temporary: null,
            setupFailure,
          })
        : Object.freeze({
            status: "blocked" as const,
            reason: setupFailure.reason,
            snapshot: null,
            setupFailure,
          });
    }
    for (const directory of [
      path.join(access.repositoryRoot, ".crdd"),
      path.join(access.repositoryRoot, ".crdd", "config"),
    ]) {
      try {
        fs.mkdirSync(directory, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const metadata = fs.lstatSync(directory);
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync.native(directory) !== directory
      )
        throw new Error("runtime_data_area_boundary_invalid");
    }
  } catch {
    return Object.freeze({
      status: "unknown" as const,
      reason: "ai_selection_store_unconfirmed",
      snapshot: null,
      publication: "not_published" as const,
      cleanupConfirmed: false,
      recoveryId: null,
      temporary: null,
    });
  }
  const authorizeWrite = () => access.authorize(repository);
  return saveRepositoryAiSelection(
    access.repositoryRoot,
    {
      expectedIdentity: request.expectedIdentity,
      config: checked.value.config,
    },
    authorizeWrite,
    catalog,
  );
}

/**
 * 共有TLS終端の公開Originを閉じたHTTPS値として検査する。
 * @responsibility 外部Bindや資格を生成せず、配置用OriginとHostだけを固定する。
 * @trace ARCH-000012
 * @input 明示された非秘密の公開Origin、既存の接続種別。
 * @returns 検査済みURL、未指定時null。
 * @precondition TLS終端と内部Listener到達範囲は配置Ownerが管理する。
 * @postcondition userinfo・path・query・hash・HTTPを受理しない。
 * @effect N/A: URLの純粋検査だけ。
 * @failure 不正値は固定構成例外でListener開始前に拒否する。
 * @invariant Header一致は実TLS通信や認証の証明ではない。
 * @boundary 非秘密Server構成とHTTP Transport。
 * @security 公開OriginをClient要求から選ばない。
 * @concurrency 起動時に一つの値を固定する。
 */
export function inspectServerPublicOrigin(
  value: string | undefined,
  connection: ServerConnection,
): URL | null {
  if (value === undefined) return null;
  try {
    if (
      typeof value !== "string" ||
      !/^https:\/\/[^/\\\s@?#\u0000-\u0020\u007f]+\/?$/u.test(value)
    )
      throw new Error("invalid");
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      throw new Error("invalid");
    return parsed;
  } catch {
    throw new Error(
      connection === "mcp"
        ? "mcp_http_configuration_invalid"
        : "workbench_public_origin_invalid",
    );
  }
}

/**
 * 起動Repositoryの当該Server設定だけを読取り、公開Originを検査する。
 * @responsibility Tool単位の非秘密設定を明示CROS modeへ渡し、設定不存在はlocalhost既定とする。
 * @trace ARCH-000012
 * @input 起動時に選択したRepository内のworkingDirectory、既存の接続種別。
 * @returns 公開Originだけの閉じた非秘密構成。
 * @precondition CLIが共有起動を明示した後だけ呼ぶ。資格やHost管理Rootを読まない。
 * @postcondition 不存在以外の観測不能・余剰・重複field・不正Originを拒否する。
 * @effect 検証済みRoot内の固定設定Fileを全量読み、所有Descriptorを閉じる。
 * @failure 固定設定例外で停止し、単体fallbackや設定修復をしない。
 * @invariant 設定の存在は利用mode・認証・外部Bindを変更しない。
 * @boundary Repository-local非秘密設定とServer起動構成。
 * @security 観測時のDirectory/File linkと取得時のFile Identity不一致を拒否し、本文やPathを例外へ含めない。
 * @concurrency 取得済みDescriptorの長さ・mtime相関を検査する。取得後のPath／Directory不変は保証しない。
 */
export async function readServerConnectionConfiguration(
  workingDirectory: string,
  connection: ServerConnection,
): Promise<Readonly<{ publicOrigin?: string }>> {
  const fileName =
    connection === "mcp"
      ? "mcp-server.json"
      : connection === "workbench"
        ? "workbench-server.json"
        : null;
  if (fileName === null) throw new Error("crdd_server_connection_invalid");
  try {
    const verified = getRepositoryFromWorkingDirectory(workingDirectory);
    if (verified.status !== "completed") throw new Error("invalid");
    const area = observeRepositoryRuntimeDataArea(
      verified.capability,
      "config",
    );
    if (area.status === "not_observed") return Object.freeze({});
    if (area.status !== "ready") throw new Error("invalid");
    const config = area.directory;
    const file = path.join(config, fileName);
    let before: Stats;
    try {
      before = await asyncFs.lstat(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const currentArea = observeRepositoryRuntimeDataArea(
          verified.capability,
          "config",
        );
        if (
          currentArea.status !== "ready" ||
          currentArea.boundaryIdentity !== area.boundaryIdentity
        )
          throw new Error("invalid");
        return Object.freeze({});
      }
      throw error;
    }
    if (!before.isFile() || before.isSymbolicLink()) throw new Error("invalid");
    const handle = await asyncFs.open(file, "r");
    try {
      const opened = await handle.stat();
      if (
        opened.dev !== before.dev ||
        opened.ino !== before.ino ||
        opened.size !== before.size ||
        opened.mtimeMs !== before.mtimeMs
      )
        throw new Error("invalid");
      const buffer = Buffer.alloc(opened.size);
      let bytesRead = 0;
      while (bytesRead < buffer.length) {
        const chunk = await handle.read(
          buffer,
          bytesRead,
          buffer.length - bytesRead,
          bytesRead,
        );
        if (chunk.bytesRead === 0) throw new Error("invalid");
        bytesRead += chunk.bytesRead;
      }
      const after = await handle.stat();
      if (
        bytesRead !== opened.size ||
        after.size !== opened.size ||
        after.mtimeMs !== opened.mtimeMs
      )
        throw new Error("invalid");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, bytesRead),
      );
      if (
        !/^\s*\{\s*(?:"publicOrigin"\s*:\s*"(?:[^"\\]|\\.)*"\s*)?\}\s*$/u.test(
          text,
        )
      )
        throw new Error("invalid");
      const value = JSON.parse(text) as { publicOrigin?: string };
      const origin = inspectServerPublicOrigin(value.publicOrigin, connection);
      const currentArea = observeRepositoryRuntimeDataArea(
        verified.capability,
        "config",
      );
      if (
        currentArea.status !== "ready" ||
        currentArea.boundaryIdentity !== area.boundaryIdentity
      )
        throw new Error("invalid");
      return Object.freeze(origin ? { publicOrigin: origin.origin } : {});
    } finally {
      await handle.close();
    }
  } catch {
    throw new Error(`${connection}_server_configuration_invalid`);
  }
}

/** 明示CROS起動時に既存の非秘密設定を一回読む。 @trace ARCH-000012 */
export function readWorkbenchServerConfiguration(workingDirectory: string) {
  return readServerConnectionConfiguration(workingDirectory, "workbench");
}

/**
 * 既存Runtime領域の読取り専用観測結果を定義する。
 * @responsibility 不存在、境界不正、観測不能、検証済み既存領域を区別する。
 * @trace ARCH-000011
 * @shape readyは名前付きareaと不透明な境界Identity、他状態は閉じたreasonを持つ。
 * @invariant private Runtime RootのPathや書込みAuthorityを公開しない。
 * @boundary Runtime Data Ownerと名前付き領域の利用側。
 * @security boundaryIdentityは置換検知用の非Authority参照である。
 * @compatibility areaの作成入口とは独立した読取り専用APIである。
 */
type RepositoryRuntimeDataAreaObservation =
  | Readonly<{
      status: "ready";
      repositoryRoot: string;
      directory: string;
      boundaryIdentity: string;
      effectIssued: false;
    }>
  | Readonly<{
      status: "not_observed";
      reason: "repository_runtime_data_area_absent";
      effectIssued: false;
    }>
  | Readonly<{
      status: "blocked";
      reason:
        | "repository_runtime_data_root_capability_invalid"
        | "repository_runtime_data_area_boundary_invalid"
        | "repository_runtime_data_area_observation_failed";
      effectIssued: false;
    }>;

/**
 * private Rootと名前付き領域の既存境界をOwner内で観測する。
 * @responsibility 利用側によるParent Rootの復元を不要にし、真正不存在と観測障害を分ける。
 * @trace ARCH-000011
 * @input capability: 検証済みRepository Root能力、area: 宣言済み領域名。
 * @returns ready、not_observed、blockedの閉じた観測結果。
 * @precondition Callerは公開されたRepository Root能力を渡す。
 * @postcondition readyではRootとareaのlstat/realpath相関を確認済みである。
 * @effect Filesystem metadataとVCS境界を読む。Ignore登録、mkdir、Lock、書込みは0。
 * @failure 無効能力、link/type不正、観測障害を閉じたreasonで返す。
 * @invariant ENOENTだけをnot_observedとし、時刻やmtimeをIdentityに使わない。
 * @boundary private Runtime Rootと公開された名前付きareaの観測境界。
 * @security raw Root、秘密値、回復Authorityを公開しない。
 * @concurrency 開始・終了の不透明Identity比較で境界置換を検出できる。将来の状態を保証しない。
 */
function observeRepositoryRuntimeDataArea(
  capability: Repository,
  area: "config",
): RepositoryRuntimeDataAreaObservation {
  try {
    const repositoryRoot = resolveVerifiedRepositoryRoot(capability);
    const paths =
      repositoryRoot === null
        ? null
        : { repositoryRoot, root: path.join(repositoryRoot, ".crdd") };
    if (!paths || area !== "config")
      return Object.freeze({
        status: "blocked",
        reason: "repository_runtime_data_root_capability_invalid",
        effectIssued: false,
      });
    const directory = path.join(paths.root, "config");
    const identities: string[] = [];
    for (const target of [paths.root, directory]) {
      let metadata: fs.BigIntStats;
      try {
        metadata = fs.lstatSync(target, { bigint: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
          return Object.freeze({
            status: "not_observed",
            reason: "repository_runtime_data_area_absent",
            effectIssued: false,
          });
        throw error;
      }
      if (
        !metadata.isDirectory() ||
        metadata.isSymbolicLink() ||
        fs.realpathSync.native(target) !== target
      )
        return Object.freeze({
          status: "blocked",
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false,
        });
      const canonical = fs.lstatSync(fs.realpathSync.native(target), {
        bigint: true,
      });
      if (canonical.dev !== metadata.dev || canonical.ino !== metadata.ino)
        return Object.freeze({
          status: "blocked",
          reason: "repository_runtime_data_area_boundary_invalid",
          effectIssued: false,
        });
      identities.push(metadata.dev.toString(), metadata.ino.toString());
    }
    const boundaryIdentity = createHash("sha256")
      .update(identities.join("\0"))
      .digest("hex");
    return Object.freeze({
      status: "ready",
      repositoryRoot: paths.repositoryRoot,
      directory,
      boundaryIdentity,
      effectIssued: false,
    });
  } catch {
    return Object.freeze({
      status: "blocked",
      reason: "repository_runtime_data_area_observation_failed",
      effectIssued: false,
    });
  }
}

/**
 * 技術Catalogと当該Repositoryの設定観測を保持する。
 * @responsibility 未設定を既定Modelで補完しない。
 * @trace ARCH-000012
 * @shape catalogとselection。
 * @invariant 技術対応は現在認証又はAuthorityの証明ではない。
 * @boundary ServerからBrowserへの表示値。
 * @security 秘密・絶対Pathなし。
 * @compatibility 新形式専用。
 */
export type AiSelectionView = Readonly<{
  catalog: ModelCatalog;
  selection: AiSelectionReadResult;
}>;

/**
 * 現在RepositoryのAI設定を再観測する。
 * @responsibility 選択Rootの設定だけを技術Catalogとともに返す。
 * @trace ARCH-000012
 * @input root: 検証済みRepository能力。
 * @returns 設定観測と同梱技術Catalog。
 * @precondition 共有利用時は呼出し元が現在認可を確認済み。
 * @postcondition File不存在を保持する。
 * @effect 一つの設定Fileの読取りのみ。
 * @failure 不明はblockedのまま返す。
 * @invariant Host Catalogへfallbackしない。
 * @boundary 専門OwnerとWorkbench投影。
 * @security 認証状態を推定しない。
 * @concurrency 一回の読取りSnapshotを利用する。
 */
export function readAiSelectionView(root: string): AiSelectionView {
  const catalog = getModelCatalog();
  return Object.freeze({
    catalog,
    selection: readRepositoryAiSelection(root, catalog.catalog),
  });
}

export function canManageAiSelection(
  accessRoot: FilesystemStoreRoot,
  session: HostedAccessSession,
): boolean {
  if (session.isCurrent?.() === false) return false;
  const actor = readCurrentAccess(accessRoot, session.principal);
  return (
    actor.status === "completed" &&
    evaluateManagementPermission(actor.user.role, {
      operation: "manageAiProfiles",
    }) === "allowed"
  );
}

/**
 * 一要求の選択Repositoryと管理権限を固定する。
 * @responsibility 待機後にも同じBindingと現在許可へ再照合する。
 * @trace ARCH-000012
 * @input Root、現在の本人セッション、表示Repository ID、要求Signal。
 * @returns 検証済みRootと再照合関数。
 * @precondition 共有資格は呼出し元の入口で検査済み。
 * @postcondition 共有起動Repositoryへの暗黙fallbackなし。
 * @effect AMとRepository境界の読取りだけ。
 * @failure 未選択・不明・権限不足は例外。
 * @invariant Scope変更後は保存も公開も拒否する。
 * @boundary 現在アクセスと設定処理。
 * @security PathをClient入力に持たせない。
 * @concurrency 認可関数を保存Ownerへ渡す。
 */
export async function resolveAiSelectionAccess(
  capability: Repository,
  accessRoot: FilesystemStoreRoot | undefined,
  repositoryId: string,
  localRepositoryId: string | undefined,
  signal: AbortSignal,
  browser?: Readonly<{
    session: HostedAccessSession | null;
    // 読取りは通常セッション、書込みは元の短命管理セッションも必要。
    confirmManagement: (() => boolean) | null;
  }>,
): Promise<
  Readonly<{
    repositoryRoot: string;
    authorize: (writeRepository?: Repository) => boolean;
  }>
> {
  if (!accessRoot) {
    if (repositoryId !== localRepositoryId)
      throw new Error("ai_selection_input_invalid");
    const initial = resolveVerifiedRepositoryRoot(capability);
    if (!initial) throw new Error("ai_selection_access_unavailable");
    return {
      repositoryRoot: initial,
      authorize: (writeRepository = capability) =>
        !signal.aborted &&
        resolveVerifiedRepositoryRoot(writeRepository) === initial,
    };
  }
  if (!browser?.session) throw new Error("ai_selection_access_unavailable");
  const { session, confirmManagement } = browser;
  const permitted = () =>
    !signal.aborted &&
    confirmManagement?.() !== false &&
    canManageAiSelection(accessRoot, session);
  if (!permitted()) throw new Error("ai_selection_access_unavailable");
  const target = await resolveHostedDevelopmentAccess(
    accessRoot,
    session,
    repositoryId,
    confirmManagement !== null,
    signal,
  );
  if (!target) throw new Error("ai_selection_access_unavailable");
  return {
    repositoryRoot: target.ownerRoot,
    authorize: (repository) =>
      permitted() &&
      (repository === undefined ||
        resolveVerifiedRepositoryRoot(repository) === target.ownerRoot) &&
      target.authorize() &&
      confirmManagement?.() !== false,
  };
}

#!/usr/bin/env node
/**
 * Repository単体または同Host CROSのWorkbenchを起動する。
 * @packageDocumentation
 * @responsibility 明示modeで専門Ownerを構成し、所有ListenerをSignal終了へ結合する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @boundary 利用者TerminalとWorkbench公開API。
 * @effect localhost Listenerと既存Catalogを構成する。Provider処理は利用者の別要求だけ。
 * @security 資格を引数へ受け取らず、CROS不成立から単体へfallbackしない。
 */
import {
  readWorkbenchProjectSurface,
  startWorkbench,
  readWorkbenchServerConfiguration,
  type WorkbenchHandle,
} from "../src/index.ts";
import {
  createRepositoryAiProfileCatalogStore,
  createCrosAiProfileCatalogStore,
  createAiProfileCatalogAdministration,
} from "../../ai-adapter/src/index.ts";
import {
  resolveHostRootInput,
  readExistingHostRoot,
  readHostInitializationState,
} from "../../access-management/src/index.ts";
import { createRepositoryTaskRequests } from "../../orchestrator/src/index.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../version-control/src/index.ts";

/**
 * 単体Repositoryの既存AI・Candidateを構成してWorkbenchを起動する。
 * @responsibility 既存の単体実行Ownerを保持し、共有Host構成へ流用しない。
 * @trace ARCH-000012
 * @input 検証済みRepository Pathとport。
 * @returns 所有Workbench Handle。
 * @precondition Repository単体modeを明示選択した。
 * @postcondition 既存のRepository ProfileとAI／Candidateだけへ接続する。
 * @effect Catalog観測とlocalhost Listener起動。Provider要求は発行しない。
 * @failure Root／Catalog不成立は固定例外で停止する。
 * @invariant 設定の存在からCROSへ自動切替しない。
 * @boundary CLI構成と単体の専門Package。
 * @security 現在の送信許可と検証済みRootを実行時Ownerへ渡し、署名からAuthorityを発行しない。
 * @concurrency 起動構成は一回だけ、要求は既存Ownerへ委譲する。
 */
async function startRepositoryWorkbench(
  repositoryRoot: string,
  port: number,
): Promise<WorkbenchHandle> {
  const verified = verifyRepositoryRoot(repositoryRoot);
  if (verified.status !== "completed")
    throw new Error("verified_repository_root_required");
  const profiles = createRepositoryAiProfileCatalogStore(repositoryRoot);
  if (profiles.status !== "ready")
    throw new Error("ai_profile_catalog_store_required");
  const surface = await readWorkbenchProjectSurface(repositoryRoot);
  const aiRequests = createRepositoryTaskRequests(
    verified.capability,
    profiles.store,
    surface.context.projectId,
    "local-workbench-user",
    () =>
      resolveVerifiedRepositoryRootFromWorkingDirectory(repositoryRoot) ===
      repositoryRoot,
  );
  return startWorkbench({
    workingDirectory: repositoryRoot,
    port,
    aiRequests,
  });
}

/**
 * 明示した単体／CROS modeだけを現在Ownerへ接続する。
 * @responsibility 引数と既存Host状態を確認し、混在・観測不能を起動前に拒否する。
 * @trace ARCH-000012
 * @trace ARCH-000013
 * @input Process引数、現在Directory、固定用途Host環境。
 * @returns 起動Handle、またはHelp／拒否時のnull。
 * @precondition Nodeの標準入口から起動する。
 * @postcondition --cros時は要求ごとのAM認可とHost Catalogを構成する。
 * @effect 現在Rootと既存Host状態の観測、Catalog構成、Listener起動。
 * @failure 引数不正64、Host／起動不成立2。単体fallbackはしない。
 * @invariant 初期化・Credential発行・Provider要求を実行しない。
 * @boundary Host CLIとWorkbenchの同Process構成。
 * @security Host Pathと資格実値を表示しない。共有AIの起動Root流用なし。
 * @concurrency 一mode一Listenerだけを所有する。
 */
async function startFromCommandLine(): Promise<WorkbenchHandle | null> {
  const args = process.argv.slice(2);
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h")) {
    process.stdout.write(
      "使い方: workbench-server [--cros] [--port <port>]\n単体は現在Repository固定、--crosは既存Host設定を使用します。資格はBrowserで入力してください。\n",
    );
    return null;
  }
  const cros = args[0] === "--cros";
  const remaining = cros ? args.slice(1) : args;
  const port = remaining.length === 0 ? 0 : Number(remaining[1]);
  if (
    (remaining.length !== 0 &&
      (remaining.length !== 2 || remaining[0] !== "--port")) ||
    !Number.isInteger(port) ||
    port < 0 ||
    port > 65535
  ) {
    process.stderr.write("使い方: workbench-server [--cros] [--port <port>]\n");
    process.exitCode = 64;
    return null;
  }
  const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
    process.cwd(),
  );
  if (!cros) return startRepositoryWorkbench(repositoryRoot, port);
  const configuration = await readWorkbenchServerConfiguration(repositoryRoot);
  const input = resolveHostRootInput(process.env);
  const root = input && readExistingHostRoot(input);
  if (!input || !root)
    throw new Error("workbench_host_configuration_unavailable");
  const initialization = readHostInitializationState(root);
  if (initialization.status === "fresh" || initialization.status === "unknown")
    throw new Error("workbench_host_initialization_unavailable");
  const profiles = createCrosAiProfileCatalogStore(input);
  if (profiles.status !== "ready")
    throw new Error("workbench_host_profile_unavailable");
  return startWorkbench({
    workingDirectory: repositoryRoot,
    port,
    localAccessRoot: root,
    ...configuration,
    crosProfileAdministration: createAiProfileCatalogAdministration(
      profiles.store,
    ),
    sharedAiRequestsFactory: (root, projectId, principalId, authorize) =>
      createRepositoryTaskRequests(
        root,
        profiles.store,
        projectId,
        principalId,
        authorize,
      ),
  });
}

try {
  const handle = await startFromCommandLine();
  if (handle !== null) {
    process.stdout.write(`CROS Workbench: ${handle.publicUrl}\n`);
    /**
     * CLIが所有するListenerと進行中要求を終了する。
     * @responsibility Signalを一回のOwner closeへ結合する。
     * @trace ARCH-000012
     * @input N/A: SIGINT／SIGTERM通知。
     * @returns N/A: 所有Handleの終了を待つ。
     * @precondition 同じCLIのHandleが起動済み。
     * @postcondition 受付停止・要求join・所有Socket回収をOwnerへ委譲する。
     * @effect localhost Listenerを閉じる。
     * @failure close不成立を非0Exitへ反映する。
     * @invariant Browserを閉じたことをServer終了と同一視しない。
     * @boundary Process SignalとWorkbench lifecycle。
     * @security 他ProcessやRepositoryの資源に触れない。
     * @concurrency 再通知でもHandleの冪等closeを使用する。
     */
    async function shutdown(): Promise<void> {
      try {
        await handle?.close();
      } catch {
        process.exitCode = 2;
      }
    }
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  }
} catch (error) {
  const reason =
    error instanceof Error &&
    [
      "workbench_host_configuration_unavailable",
      "workbench_host_initialization_unavailable",
      "workbench_host_profile_unavailable",
      "workbench_server_configuration_invalid",
      "workbench_public_origin_invalid",
      "workbench_shared_access_required",
      "workbench_official_logo_unavailable",
      "workbench_client_asset_unavailable",
      "workbench_repository_root_invalid",
      "repository_working_directory_invalid",
    ].includes(error.message)
      ? error.message
      : "workbench_startup_unavailable";
  process.stderr.write(
    `WorkbenchのHost設定または起動を確認できません。単体へ切り替えず停止しました。\n理由: ${reason}\n`,
  );
  process.exitCode = 2;
}

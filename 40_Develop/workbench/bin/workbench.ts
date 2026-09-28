#!/usr/bin/env node
/**
 * CROS Workbench Production Shellを起動するCLI。
 *
 * @packageDocumentation
 * @responsibility 検証済みRepositoryからlocalhost Workbenchを起動し、Signal時に終了する。
 * @trace ARCH-000012
 * @boundary 利用者TerminalとWorkbench公開APIの境界。
 * @effect localhost Listenerを起動し、終了Signalで閉じる。
 * @security Credentialを受け取らず、公開URL以外のHost情報を表示しない。
 */
import { readWorkbenchProjectSurface, startWorkbench } from "../src/index.ts";
import { createRepositoryAiProfileCatalogStore } from "../../ai-runtime/src/index.ts";
import { createRepositoryWorkbenchCandidateApplication } from "../../coordinator/src/composition/workbench-candidate-application.ts";
import { createRepositoryWorkbenchAiRequestApplication } from "../../coordinator/src/composition/workbench-ai-repository-composition.ts";
import { createWorkbenchAiAdviceDispatchRuntime } from "../../coordinator/src/security/workbench-ai-advice-dispatch-runtime.ts";
import { createWorkbenchAiAdviceProviderExecutor } from "../../coordinator/src/security/workbench-ai-advice-provider-executor.ts";
import { createRuntimeOwnedWorkbenchAiAdviceProductionRuntime } from "../../coordinator/src/security/workbench-ai-advice-production-runtime.ts";
import { createRuntimeOwnedWorkbenchAiChangeCandidateExecutor } from "../../coordinator/src/security/workbench-ai-change-candidate-runtime.ts";
import { createWorkbenchAiProviderAdapter } from "../../coordinator/src/security/workbench-ai-provider-adapter.ts";
import { issueRuntimeOwnedVerifiedCoordinatorPackageCapability } from "../../coordinator/src/security/platform-provisioner-package-filesystem.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../version-control/src/repository-location.ts";

const repositoryRoot = resolveVerifiedRepositoryRootFromWorkingDirectory(
  process.cwd(),
);
const verifiedRepositoryRoot = verifyRepositoryRoot(repositoryRoot);
if (verifiedRepositoryRoot.status !== "completed")
  throw new Error("verified_repository_root_required");
const profileCatalogStore =
  createRepositoryAiProfileCatalogStore(repositoryRoot);
if (profileCatalogStore.status !== "ready")
  throw new Error("ai_profile_catalog_store_required");

const adviceRuntime = createRuntimeOwnedWorkbenchAiAdviceProductionRuntime(
  () =>
    issueRuntimeOwnedVerifiedCoordinatorPackageCapability({
      evaluationTime: new Date().toISOString(),
    }).capability,
);
const adviceExecutor = createWorkbenchAiAdviceProviderExecutor(adviceRuntime);
const providerAdapter = createWorkbenchAiProviderAdapter({
  codex: adviceExecutor,
  claude: adviceExecutor,
});

const aiRequestApplication = createRepositoryWorkbenchAiRequestApplication(
  verifiedRepositoryRoot.capability,
  profileCatalogStore.store,
  createWorkbenchAiAdviceDispatchRuntime(providerAdapter),
  createRuntimeOwnedWorkbenchAiChangeCandidateExecutor(
    verifiedRepositoryRoot.capability,
    profileCatalogStore.store,
  ),
);
const projectSurface = await readWorkbenchProjectSurface(repositoryRoot);
const candidateApplication = createRepositoryWorkbenchCandidateApplication(
  verifiedRepositoryRoot.capability,
  projectSurface.context.projectId,
);
const handle = await startWorkbench({
  workingDirectory: repositoryRoot,
  aiRequestApplication,
  candidateApplication,
});
process.stdout.write(`CROS Workbench: ${handle.baseUrl}\n`);

/**
 * Workbench CLIが所有するListenerを閉じる。
 *
 * @responsibility 終了Signalを一回のWorkbench closeへ変換する。
 * @trace ARCH-000012
 * @input N/A: Process Signalから起動する。
 * @returns N/A: Process終了へ進むため戻り値を利用しない。
 * @precondition Workbench Handleが起動済みである。
 * @postcondition Listenerと所有Connectionを閉じてProcessを終了する。
 * @effect localhost Listenerを終了する。
 * @failure close失敗時は非0 Exit Codeを設定する。
 * @invariant Credential、Repository内容および一時Fileを生成しない。
 * @boundary OS SignalとWorkbench lifecycleの境界。
 * @security N/A: 新しいAuthorityまたは外部送信を発行しない。
 * @concurrency 重複SignalでもHandleの冪等closeを利用する。
 */
async function shutdown(): Promise<void> {
  try {
    await handle.close();
  } catch {
    process.exitCode = 1;
  }
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

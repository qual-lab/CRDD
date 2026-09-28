/**
 * Repository単体WorkbenchのAI依頼をCoordinator Mode Routerへ実構成する。
 *
 * @packageDocumentation
 * @responsibility 検証済みRepositoryの固定Project Contextを読取り助言Task Packetへ変換し、注入された送信境界へだけ渡す。
 * @trace ARCH-000015 ARCH-000009
 * @boundary Repository Project Context、Coordinator Mode Routerおよび外部送信Adapterの境界。
 * @effect 固定Project Contextを読取り、注入されたDispatchだけが外部Effectを発行し得る。
 * @security 任意Path、Symbolic Link、投影外参照、秘密情報および変更候補の暗黙実行を許可しない。
 */
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";

import {
  resolveAiProfileById,
  type AiProfileCatalogStore,
  type AiProfileCatalogSnapshot,
  type ResolvedAiProfileIdentity,
} from "../../../ai-runtime/src/index.ts";

import {
  resolveVerifiedRepositoryRoot,
  type VerifiedRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";
import {
  createCoordinatorWorkbenchAiRequestApplication,
  type CoordinatorAiRequestExecutor,
  type CoordinatorAiRequestInput,
  type CoordinatorAiRequestResult,
} from "./workbench-ai-request-application.ts";
import {
  prepareWorkbenchAiAdviceTask,
  type WorkbenchAiAdviceTaskPacket,
} from "../security/workbench-ai-advice-task.ts";

const PROJECT_CONTEXT_REFERENCE = "PROJECT_CONTEXT.md";

/**
 * 検証済み読取り助言Task Packetを外部送信境界へ渡すPortを表す。
 *
 * @responsibility Task Packet消費後のAuthority確認、Provider実行、結果正規化およびcleanupを下位Adapterへ委譲する。
 * @trace ARCH-000015
 * @shape Task Packet、採用Catalog改訂、exact ProfileおよびcancellationSignalを受け、Coordinator AI結果を返す非同期関数である。
 * @invariant Packet生成成功だけでは外部送信Authorityを持たない。
 * @boundary Coordinator Task準備と外部送信Adapterの境界。
 * @security AdapterはPacketのtaskHash、Profileおよび許可済み参照を読み替えない。
 * @compatibility Workbench Advice Task Contract revision 1へ適合する。
 */
export type WorkbenchAiAdviceDispatchInput = Readonly<{
  taskPacket: WorkbenchAiAdviceTaskPacket;
  catalogRevision: number;
  profile: ResolvedAiProfileIdentity;
  externalSendConfirmed: boolean;
}>;

export type WorkbenchAiAdviceDispatch = (
  input: WorkbenchAiAdviceDispatchInput,
  cancellationSignal: AbortSignal,
) => Promise<CoordinatorAiRequestResult>;

/**
 * Repository単体Workbench向けCoordinator AI Applicationを生成する。
 *
 * @responsibility 読取り助言の固定Projection生成とMode Router接続を所有し、変更候補は独立Executorへ保つ。
 * @trace ARCH-000015 ARCH-000009
 * @input repositoryRootCapability: 検証済みRoot、profileCatalogStore: 採用済みCatalog Store、dispatchReadOnlyAdvice: 読取り助言送信境界、startChangeCandidate: 変更候補Executor。
 * @returns Workbench互換の開始、観測、取消Applicationを返す。
 * @precondition Root CapabilityはVersion Control境界が発行し、各Dispatchは自身のAuthorityとcleanupを所有する。
 * @postcondition 読取り助言は固定Project ContextだけをTask Packet化し、同じCatalog Snapshotからexact Profileを解決して変更候補Executorへ配送しない。
 * @effect 読取り助言時に固定Fileを一回読取り、検証後だけ注入Dispatchを最大一回呼ぶ。
 * @failure Root、File、参照、Hash、Task、Catalog SnapshotまたはProfile解決が不正なら外部Effect 0でblockedを返す。
 * @invariant Repository Root、依頼種別、Profile IDおよび投影参照を暗黙に変更しない。
 * @boundary Workbench、Repository FilesystemおよびCoordinator外部送信Adapterの境界。
 * @security 任意Path、Symbolic LinkおよびProject Context以外の暗黙読取りを拒否する。
 * @concurrency 依頼ごとの取消Signalを読取り後とDispatch前に再確認する。
 */
export function createRepositoryWorkbenchAiRequestApplication(
  repositoryRootCapability: VerifiedRepositoryRoot,
  profileCatalogStore: AiProfileCatalogStore,
  dispatchReadOnlyAdvice: WorkbenchAiAdviceDispatch,
  startChangeCandidate: CoordinatorAiRequestExecutor,
) {
  const startReadOnlyAdvice: CoordinatorAiRequestExecutor = async (
    request,
    cancellationSignal,
  ) => {
    const packet = await prepareRepositoryAdvicePacket(
      repositoryRootCapability,
      request,
      cancellationSignal,
    );
    if (packet === null)
      return blocked("coordinator_ai_advice_projection_unavailable");
    if (cancellationSignal.aborted)
      return blocked("coordinator_ai_request_cancelled");
    let catalogSnapshot: AiProfileCatalogSnapshot;
    try {
      catalogSnapshot = profileCatalogStore.snapshot();
    } catch {
      return blocked("coordinator_ai_profile_snapshot_unavailable");
    }
    const profile = resolveAiProfileById(
      catalogSnapshot.catalog,
      packet.profileId,
    );
    if (profile === null || !profile.selectionRoles.includes("coordinator"))
      return blocked("coordinator_ai_profile_not_available_for_advice");
    if (cancellationSignal.aborted)
      return blocked("coordinator_ai_request_cancelled");
    return dispatchReadOnlyAdvice(
      Object.freeze({
        taskPacket: packet,
        catalogRevision: catalogSnapshot.revision,
        profile,
        externalSendConfirmed: request.externalSendConfirmed,
      }),
      cancellationSignal,
    );
  };
  return createCoordinatorWorkbenchAiRequestApplication({
    startReadOnlyAdvice,
    startChangeCandidate,
  });
}

/**
 * 検証済みRepositoryから固定Project Context Task Packetを生成する。
 *
 * @responsibility Root再検証、固定参照、通常File、内容HashおよびTask Packet検査を一つの読取り境界へ閉じる。
 * @trace ARCH-000015 ARCH-000009
 * @input repositoryRootCapability、request、cancellationSignal。
 * @returns 検証済みTask Packet。不正、取消または観測不能時はnull。
 * @precondition requestはCoordinator Mode Routerの入力検査を通過している。
 * @postcondition Task Packetの投影は現在読取ったPROJECT_CONTEXT.md一件だけである。
 * @effect PROJECT_CONTEXT.mdのMetadata、real pathおよび本文を読取る。
 * @failure File欠落、Link、Root越境、参照不一致またはTask検証失敗はnullへ畳む。
 * @invariant File内容をlog、例外または公開失敗結果へ含めない。
 * @boundary 検証済みRepository Filesystemと外部送信前Task Packetの境界。
 * @security Project Context以外のPathを解決せず、Linkを辿らない。
 * @concurrency 読取り前後の取消を確認し、取消後にDispatchへ進まない。
 */
async function prepareRepositoryAdvicePacket(
  repositoryRootCapability: VerifiedRepositoryRoot,
  request: CoordinatorAiRequestInput,
  cancellationSignal: AbortSignal,
): Promise<WorkbenchAiAdviceTaskPacket | null> {
  if (
    cancellationSignal.aborted ||
    request.mode !== "read_only_advice" ||
    request.contextReferences.length !== 1 ||
    request.contextReferences[0] !== PROJECT_CONTEXT_REFERENCE
  )
    return null;
  const repositoryRoot = resolveVerifiedRepositoryRoot(
    repositoryRootCapability,
  );
  if (repositoryRoot === null) return null;
  const target = path.join(repositoryRoot, PROJECT_CONTEXT_REFERENCE);
  try {
    const metadata = await lstat(target);
    if (!metadata.isFile() || metadata.isSymbolicLink()) return null;
    if ((await realpath(path.dirname(target))) !== repositoryRoot) return null;
    const content = await readFile(target, "utf8");
    if (cancellationSignal.aborted) return null;
    const prepared = prepareWorkbenchAiAdviceTask({
      profileId: request.profileId,
      prompt: request.prompt,
      projection: [
        {
          reference: PROJECT_CONTEXT_REFERENCE,
          content,
          sha256: await fileContentSha256(content),
        },
      ],
    });
    return prepared.status === "prepared" ? prepared.taskPacket : null;
  } catch {
    return null;
  }
}

/**
 * 読取り内容のSHA-256をTask Packet互換形式で生成する。
 *
 * @responsibility Node標準Web CryptoでUTF-8本文のSHA-256を決定論的に生成する。
 * @trace ARCH-000015
 * @input content: PROJECT_CONTEXT.mdの読取り本文。
 * @returns 64文字の小文字16進SHA-256を返す。
 * @precondition contentは通常FileからUTF-8として読取済みである。
 * @postcondition Task Packet側の内容Hash検査と一致する。
 * @effect N/A: 局所計算だけを行う。
 * @failure Web Crypto失敗は呼出し側が投影観測不能へ畳む。
 * @invariant UTF-8以外の符号化へ変換しない。
 * @boundary N/A: Process内で完結する。
 * @security Hashを本文不存在または秘密情報不存在の証明として扱わない。
 * @concurrency Promise完了後だけTask Packet生成へ進む。
 */
async function fileContentSha256(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(hash).toString("hex");
}

/**
 * Repository AI Compositionの拒否結果を生成する。
 *
 * @responsibility 理由と空結果区分を閉じたCoordinator結果へ変換する。
 * @trace ARCH-000015
 * @input reason: 固定された公開理由。
 * @returns blocked Coordinator AI結果を返す。
 * @precondition reasonはPromptまたはFilesystem情報を含まない。
 * @postcondition 全結果区分を空にし、事実や推論を捏造しない。
 * @effect N/A: 固定Objectを生成するだけである。
 * @failure N/A: 失敗分岐を持たない。
 * @invariant raw内容、Host Pathおよび秘密値を公開しない。
 * @boundary Coordinator内部の失敗結果境界。
 * @security 入力内容を結果へ複製しない。
 * @concurrency N/A: 共有状態を持たない同期処理である。
 */
function blocked(reason: string): CoordinatorAiRequestResult {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    facts: Object.freeze([]),
    sharedAnalysis: Object.freeze([]),
    additionalInferences: Object.freeze([]),
    nextOptions: Object.freeze([]),
    candidate: null,
  });
}

/**
 * Workbench変更候補Runtimeの局所契約試験。
 *
 * @packageDocumentation
 * @responsibility 明示Path、exact Profile、未採用Candidate結果およびEffect前拒否を検証する。
 * @trace ERB-UT-023
 * @level UT
 * @scope coordinator、contract、node_process
 * @boundary Workbench AI依頼→Project Runtime Single Task Adapter
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_AI_PROFILE_CATALOG,
  type AiProfileCatalogStore,
} from "../../../ai-runtime/src/index.ts";
import { gitRepositoryRevisionAdapter } from "../../../version-control/src/index.ts";
import {
  resolveVerifiedRepositoryRootFromWorkingDirectory,
  verifyRepositoryRoot,
} from "../../../version-control/src/repository-location.ts";
import { createIsolatedWorkbenchAiChangeCandidateExecutorForDevelopment } from "../../src/workbench-ai/workbench-ai-change-candidate-runtime.ts";

const candidateId = `candidate.${"6".repeat(64)}.${"7".repeat(64)}`;
const profileStore = Object.freeze({
  snapshot: () =>
    Object.freeze({ revision: 1, catalog: DEFAULT_AI_PROFILE_CATALOG }),
  adopt: () => {
    throw new Error("not_used");
  },
}) satisfies AiProfileCatalogStore;

/**
 * verifiedRoot用の試験入力または観測処理を提供する。
 *
 * @responsibility verifiedRoot用の試験入力または観測処理を提供するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus verifiedRootの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
function verifiedRoot() {
  const root = resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd());
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed")
    throw new Error("verified_root_required");
  return verified;
}

/**
 * 明示Pathだけで未信頼・未採用Candidateを返すを検証する。
 *
 * @responsibility 明示Pathだけで未信頼・未採用Candidateを返すを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 明示Pathだけで未信頼・未採用Candidateを返すの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("明示Pathだけで未信頼・未採用Candidateを返す", async () => {
  const verified = verifiedRoot();
  let taskRequest: unknown;
  const executor =
    createIsolatedWorkbenchAiChangeCandidateExecutorForDevelopment(
      verified.capability,
      profileStore,
      Object.freeze({
        observeRevision: gitRepositoryRevisionAdapter,
        issueRuntimeCapability: () => Object.freeze({}),
        revokeRuntimeCapability: () => true,
        startTask: (request) => {
          taskRequest = request;
          return Object.freeze({
            status: "started",
            reason: "coordinator_task_started",
            controlCapability: Object.freeze({}),
            completion: Promise.resolve(
              Object.freeze({
                status: "completed",
                reason: "coordinator_task_completed",
                cleanupConfirmed: true,
                manualRecoveryRequired: false,
                processRestartRequired: false,
                candidateId,
                hostRecoveryId: null,
                dockerRecoveryId: null,
                dockerRecoveryIds: Object.freeze([]),
                candidateRecoveryId: null,
                candidateStoreRecoveryId: null,
                executorProvider: "codex",
              }),
            ),
            rawOutputReported: false,
            hostPathReported: false,
            untrustedProviderTextReported: false,
            credentialAbsenceVerified: false,
          });
        },
        cancelTask: () =>
          Promise.resolve(Object.freeze({ status: "cancelled" })),
      }),
    );
  const result = await executor(
    Object.freeze({
      mode: "change_candidate",
      profileId: "PROFILE-100003",
      prompt: "Workbenchの表示を改善する",
      contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
      allowedPaths: Object.freeze(["40_Develop/workbench/src"]),
      externalSendConfirmed: true,
    }),
    new AbortController().signal,
  );
  assert.equal(result.status, "completed");
  assert.deepEqual(result.candidate, {
    candidateId,
    disposition: "untrusted_not_adopted",
  });
  assert.deepEqual(
    (taskRequest as { allowedPaths: readonly string[] }).allowedPaths,
    ["40_Develop/workbench/src"],
  );
  assert.equal(
    (taskRequest as { requestedProfileId: string }).requestedProfileId,
    "PROFILE-100003",
  );
});

/**
 * 許可PathなしではTask Effectを発行しないを検証する。
 *
 * @responsibility 許可PathなしではTask Effectを発行しないを検証するの検証責務を所有する。
 * @trace ERB-UT-023
 * @precondition 対象契約を再現できる固定入力と依存を用意する。
 * @stimulus 許可PathなしではTask Effectを発行しないの対象操作を実行する。
 * @observation 返却値、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionがSummaryの期待条件を満たす。
 * @cleanup N/A: Process外資源を生成しない局所検証である。
 * @boundary ERB-UT-023=Direct Boundary: coordinator Test Source→対象契約
 */
test("許可PathなしではTask Effectを発行しない", async () => {
  const verified = verifiedRoot();
  let startCount = 0;
  const executor =
    createIsolatedWorkbenchAiChangeCandidateExecutorForDevelopment(
      verified.capability,
      profileStore,
      Object.freeze({
        observeRevision: gitRepositoryRevisionAdapter,
        issueRuntimeCapability: () => Object.freeze({}),
        revokeRuntimeCapability: () => true,
        startTask: () => {
          startCount += 1;
          throw new Error("must_not_start");
        },
        cancelTask: () =>
          Promise.resolve(Object.freeze({ status: "cancelled" })),
      }),
    );
  const result = await executor(
    Object.freeze({
      mode: "change_candidate",
      profileId: "PROFILE-100003",
      prompt: "変更する",
      contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
      allowedPaths: Object.freeze([]),
      externalSendConfirmed: true,
    }),
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(startCount, 0);
});

/**
 * Runtimeの送信確認拒否をWorkbenchへ同じ理由で返す。
 *
 * @responsibility 未選択Providerの拒否を結果不明へ変えず、送信確認Gateを保持する。
 * @trace ERB-UT-023
 * @precondition Repository RootとProfileは有効、Task完了値だけを固定注入する。
 * @stimulus 送信確認不可・Provider未選択の完了値を候補Executorへ返す。
 * @observation 上位結果の状態、理由、候補とCapability失効回数を観測する。
 * @oracle blockedと元理由を保持し、候補なし、失効1回である。
 * @cleanup N/A: ProviderやDocker資源を生成せず局所依存だけを使う。
 * @boundary ERB-UT-023=Direct Boundary: Task完了値→Workbench候補Executor。
 */
test("送信確認不可の未選択拒否をWorkbench結果へ保持する", async () => {
  const verified = verifiedRoot();
  let revoked = 0;
  const executor =
    createIsolatedWorkbenchAiChangeCandidateExecutorForDevelopment(
      verified.capability,
      profileStore,
      Object.freeze({
        observeRevision: gitRepositoryRevisionAdapter,
        issueRuntimeCapability: () => Object.freeze({}),
        revokeRuntimeCapability: () => {
          revoked += 1;
          return true;
        },
        startTask: () =>
          Object.freeze({
            status: "started",
            controlCapability: Object.freeze({}),
            completion: Promise.resolve(
              Object.freeze({
                status: "blocked",
                reason:
                  "coordinator_task_external_send_confirmation_unavailable",
                cleanupConfirmed: true,
                manualRecoveryRequired: false,
                processRestartRequired: false,
                candidateId: null,
                hostRecoveryId: null,
                dockerRecoveryIds: Object.freeze([]),
                candidateRecoveryId: null,
                candidateStoreRecoveryId: null,
                executorProvider: null,
              }),
            ),
          }),
        cancelTask: () =>
          Promise.resolve(Object.freeze({ status: "cancelled" })),
      }),
    );
  const result = await executor(
    Object.freeze({
      mode: "change_candidate",
      profileId: "PROFILE-100003",
      prompt: "固定候補の検証",
      contextReferences: Object.freeze(["PROJECT_CONTEXT.md"]),
      allowedPaths: Object.freeze(["40_Develop/workbench/src"]),
      externalSendConfirmed: true,
    }),
    new AbortController().signal,
  );
  assert.equal(result.status, "blocked");
  assert.equal(
    result.reason,
    "coordinator_task_external_send_confirmation_unavailable",
  );
  assert.equal(result.candidate, null);
  assert.equal(revoked, 1);
});

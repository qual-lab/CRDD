/**
 * Workbench変更候補Runtimeの局所契約試験。
 *
 * @packageDocumentation
 * @responsibility 明示Path、exact Profile、未採用Candidate結果およびEffect前拒否を検証する。
 * @trace ERB-UT-023
 * @boundary Workbench AI依頼→Project Runtime Single Task Adapter
 * @effect 固定Fake Task Runtimeだけを実行し、外部ProviderやRepository書込みを行わない。
 * @security Candidate IDを採用Authorityとして使用せず、許可Path外の入力を生成しない。
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
import { createIsolatedWorkbenchAiChangeCandidateExecutorForDevelopment } from "../../src/security/workbench-ai-change-candidate-runtime.ts";

const candidateId = `candidate.${"6".repeat(64)}.${"7".repeat(64)}`;
const profileStore = Object.freeze({
  snapshot: () =>
    Object.freeze({ revision: 1, catalog: DEFAULT_AI_PROFILE_CATALOG }),
  adopt: () => {
    throw new Error("not_used");
  },
}) satisfies AiProfileCatalogStore;

function verifiedRoot() {
  const root = resolveVerifiedRepositoryRootFromWorkingDirectory(process.cwd());
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed")
    throw new Error("verified_root_required");
  return verified;
}

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

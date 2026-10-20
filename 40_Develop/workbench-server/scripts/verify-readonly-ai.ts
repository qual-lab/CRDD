/**
 * 明示同意した一Providerの読取り助言を公開HTTPから一回検証する。
 * @responsibility 固定Profile・Context・質問、終端・回収・前後観測を結合する。
 * @trace ARCH-000015
 * @security 本文・資格を保存せず、編集・採用・再送・再起動を行わない。
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  verifyRepositoryRoot,
  gitRepositoryRevisionAdapter,
} from "../../version-control/src/index.ts";
import { createRepositoryAiProfileCatalogStore } from "../../ai-adapter/src/index.ts";
import { createRepositoryTaskRequests } from "../../orchestrator/src/index.ts";
import { startWorkbench, readWorkbenchProjectSurface } from "../src/index.ts";
import {
  createWorkbenchAiVerificationHttpClient,
  observeVerificationDockerInventory,
  assessVerificationDockerInventory,
} from "./ai-verification-http.ts";
import type { WorkbenchAiRequestSnapshot } from "../src/server/ai-request/types.ts";

/**
 * 固定の一回実行だけを受け付ける。
 * @trace ARCH-000015
 * @effect 明示同意後にloopback HTTPと一Providerを使用し、既存Ownerで回収する。
 * @failure 結果不明時は再送せず、一次失敗とclose・最終観測を分離する。
 */
async function main() {
  const args = process.argv.slice(2);
  if (
    args.length !== 3 ||
    args[0] !== "--provider" ||
    !["codex", "claude"].includes(args[1] ?? "") ||
    args[2] !== "--external-send-confirmed"
  ) {
    process.stderr.write(
      "使い方: verify-readonly-ai --provider codex|claude --external-send-confirmed\n送信先・PROJECT_CONTEXT.md・固定質問の許可を確認してから実行してください。\n",
    );
    process.exitCode = 64;
    return;
  }
  const provider = args[1];
  const root = process.cwd();
  const verified = verifyRepositoryRoot(root);
  if (verified.status !== "completed") throw new Error("root_unverified");
  const hash = (v: string | Buffer) =>
    createHash("sha256").update(v).digest("hex");
  const canonical = () => {
    const revision = gitRepositoryRevisionAdapter(root);
    if (revision === null) throw new Error("revision_unobserved");
    return {
      commit: revision.revisionIdentity,
      context: hash(readFileSync(join(root, "PROJECT_CONTEXT.md"))),
    };
  };
  const before = canonical();
  const inventory = observeVerificationDockerInventory();
  if (
    inventory === null ||
    inventory.containers.some(
      (c) => !["created", "exited", "dead"].includes(c.state),
    )
  )
    throw new Error("docker_preflight_unconfirmed");
  const profiles = createRepositoryAiProfileCatalogStore(root);
  if (profiles.status !== "ready") throw new Error("profiles_unavailable");
  const catalog = profiles.store.snapshot().value;
  if (!catalog) throw new Error("ai_profile_catalog_read_failed");
  const catalogHash = hash(JSON.stringify(catalog));
  const profileId = provider === "codex" ? "PROFILE-100001" : "PROFILE-200001";
  const profile = catalog.catalog.profiles.find(
    (p) => p.profileId === profileId,
  );
  assert.ok(profile);
  assert.equal(
    profile.exactModelId,
    provider === "codex" ? "gpt-5.6-sol" : "opus",
  );
  assert.ok(profile.selectionRoles.includes("coordinator"));
  assert.equal(
    catalog.catalog.adapters.find((a) => a.adapterId === profile.adapterId)
      ?.provider,
    provider,
  );
  const permitted = () =>
    hash(JSON.stringify(canonical())) === hash(JSON.stringify(before)) &&
    hash(JSON.stringify(profiles.store.snapshot().value)) === catalogHash;
  const surface = await readWorkbenchProjectSurface(root);
  const owner = createRepositoryTaskRequests(
    verified.capability,
    profiles.store,
    surface.context.projectId,
    "local-workbench-user",
    permitted,
  );
  const handle = await startWorkbench({
    workingDirectory: root,
    port: 0,
    aiRequests: owner,
  });
  let primaryFailure: string | null = null;
  let closeFailure: string | null = null;
  let closeConfirmed = false;
  let timedOut = false;
  let result: WorkbenchAiRequestSnapshot | null = null;
  const classify = (e: unknown) =>
    e instanceof Error && /^[a-z][a-z0-9_]+$/u.test(e.message)
      ? e.message
      : "verification_exception";
  try {
    assert.equal(permitted(), true, "profile_or_repository_changed");
    const client = await createWorkbenchAiVerificationHttpClient(
      handle.baseUrl,
    );
    const start = await client.start({
      mode: "read_only_advice",
      profileId,
      prompt:
        "PROJECT_CONTEXT.mdだけを根拠として、現在の状況を一文、残件を一件、次の候補を一件、日本語で簡潔に整理してください。確認できる事実と追加推論を区別し、参照はPROJECT_CONTEXT.mdだけを使ってください。ファイル編集やコマンド実行はしないでください。",
      contextReferences: ["PROJECT_CONTEXT.md"],
      allowedPaths: [],
      externalSendConfirmed: true,
      workspaceId: null,
    });
    if (start.status !== "accepted" || start.requestId === null)
      throw new Error("verification_start_rejected");
    const deadline = Date.now() + 10 * 60_000;
    result = await client.observe(start.requestId);
    while (
      ["accepted", "running"].includes(result.status) &&
      Date.now() < deadline
    ) {
      await delay(1500);
      result = await client.observe(start.requestId);
    }
    timedOut = ["accepted", "running"].includes(result.status);
    if (timedOut) result = await client.cancel(start.requestId);
  } catch (error) {
    primaryFailure = classify(error);
  } finally {
    try {
      await handle.close();
      closeConfirmed = true;
    } catch (error) {
      closeFailure = classify(error);
    }
  }
  let projectContextUnchanged: boolean | null = null;
  let revisionUnchanged: boolean | null = null;
  try {
    const after = canonical();
    projectContextUnchanged = before.context === after.context;
    revisionUnchanged = before.commit === after.commit;
  } catch {
    /* 欠測をfalse／不変へ畳まない。 */
  }
  const resources = assessVerificationDockerInventory(
    inventory,
    observeVerificationDockerInventory(),
    result?.cleanupConfirmed === true,
  );
  const passed =
    result?.status === "completed" &&
    result.executionStatus === "completed" &&
    !timedOut &&
    result.cleanupConfirmed === true &&
    (result.recoveryIds?.length ?? 0) === 0 &&
    (result.secondaryFailures?.length ?? 0) === 0 &&
    closeConfirmed &&
    primaryFailure === null &&
    closeFailure === null &&
    projectContextUnchanged === true &&
    revisionUnchanged === true &&
    resources.status === "verified";
  console.log(
    JSON.stringify({
      contract: "crdd/workbench-readonly-verification",
      provider,
      profileId,
      model: profile.exactModelId,
      commit: before.commit,
      baseline: {
        containers: inventory.containers.map((c) => c.id),
        networks: inventory.networks.map((n) => n.id),
      },
      result:
        result === null
          ? null
          : {
              requestId: result.requestId,
              status: result.status,
              reason: result.reason,
              executionStatus: result.executionStatus,
              primaryFailure: result.primaryFailure,
              cleanupConfirmed: result.cleanupConfirmed,
              recoveryIds: result.recoveryIds,
              secondaryFailures: result.secondaryFailures,
              resultCounts: {
                facts: result.facts.length,
                sharedAnalysis: result.sharedAnalysis.length,
                additionalInferences: result.additionalInferences.length,
                nextOptions: result.nextOptions.length,
              },
            },
      timedOut,
      primaryFailure,
      closeFailure,
      closeConfirmed,
      projectContextUnchanged,
      revisionUnchanged,
      wholeRepositoryUnchangedClaimed: false,
      resources,
      limitedProbePassed: passed,
      fullE2eVerified: false,
      rawProviderOutputReported: false,
    }),
  );
  process.exitCode = passed ? 0 : 2;
}
await main().catch(() => {
  process.stderr.write("readonly_verification_preflight_failed\n");
  process.exitCode = 2;
});

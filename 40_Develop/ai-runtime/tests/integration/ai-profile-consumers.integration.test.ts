/**
 * AI Profile CatalogからCoordinator解決とWorkbench表示までの接続を検証する。
 *
 * @packageDocumentation
 * @responsibility 同じProfile Identityと未観測状態がConsumer間で再解釈されないことを反証する。
 * @trace RCM-IT-005
 * @level IT
 * @scope ai-profile、coordinator、workbench
 * @boundary RCM-IT-005=Direct Boundary: AI Runtime Catalog→Coordinator／Workbench Consumer
 */
import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuntimeOwnedProviderModelProfile } from "../../../coordinator/src/provider/provider-model-profile-runtime.ts";
import { createDefaultWorkbenchAiProfileSurface } from "../../../workbench/src/ai-profile-surface.ts";
import { DEFAULT_AI_PROFILE_CATALOG } from "../../src/index.ts";

/**
 * CoordinatorとWorkbenchが同じProfile Identityを利用することを検証する。
 *
 * @responsibility Catalogの安定Profile IDを選択側と表示側で一致させる。
 * @trace RCM-IT-005
 * @precondition AI Runtimeの既定Catalogが検証済みである。
 * @stimulus Codex executorを解決し、WorkbenchのProfile Surfaceを構築する。
 * @observation Coordinator結果とWorkbench SurfaceのProfile ID、Model、利用可能性を観測する。
 * @oracle PROFILE-100003とgpt-5.5が両Consumerで一致し、未観測はunknownである。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-IT-005=Direct Boundary: ai-runtime Test Source→対象契約
 */
test("CoordinatorとWorkbenchは同じProfile Identityを再解釈せず利用する", () => {
  const resolved = resolveRuntimeOwnedProviderModelProfile({
    provider: "codex",
    family: "sol",
    role: "executor",
    modelTier: "preferred",
    speedMode: "normal",
    billingMode: "subscription_oauth",
  });
  assert.equal(resolved?.profileId, "PROFILE-100003");
  assert.equal(resolved?.exactModelId, "gpt-5.5");

  const surface = createDefaultWorkbenchAiProfileSurface();
  assert.strictEqual(surface.catalog, DEFAULT_AI_PROFILE_CATALOG);
  const workbenchProfile = surface.catalog.profiles.find(
    (profile) => profile.profileId === "PROFILE-100003",
  );
  assert.equal(workbenchProfile?.exactModelId, "gpt-5.5");
  const observation = surface.observations.find(
    (item) => item.profileId === "PROFILE-100003",
  );
  assert.equal(observation?.availability.hostAvailable, null);
  assert.equal(observation?.availability.authenticated, null);
});

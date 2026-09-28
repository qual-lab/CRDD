/**
 * AI Profile CatalogからCoordinator解決とWorkbench表示までの接続を検証する。
 *
 * @responsibility 同じProfile Identityと未観測状態がConsumer間で再解釈されないことを反証する。
 * @packageDocumentation
 * @trace RCM-IT-005
 * @level IT
 * @scope ai-profile、coordinator、workbench
 * @boundary RCM-IT-005=Direct Boundary: AI Runtime Catalog→Coordinator／Workbench Consumer
 */
import assert from "node:assert/strict";
import test from "node:test";

import { resolveRuntimeOwnedProviderModelProfile } from "../../../coordinator/src/security/provider-model-profile-runtime.ts";
import {
  createDefaultWorkbenchAiProfileSurface,
  renderWorkbenchAiProfiles,
} from "../../../workbench/src/ai-profile-surface.ts";
import { DEFAULT_AI_PROFILE_CATALOG } from "../../src/index.ts";

/**
 * CoordinatorとWorkbenchが同じProfile Identityを利用することを検証する。
 *
 * @responsibility Catalogの安定Profile IDを選択側と表示側で一致させる。
 * @trace RCM-IT-005
 * @precondition AI Runtimeの既定Catalogが検証済みである。
 * @stimulus Codex executorを解決し、WorkbenchのProfile一覧を描画する。
 * @observation Coordinator結果とHTMLに現れるProfile ID、Model、利用可能性を観測する。
 * @oracle PROFILE-100003とgpt-5.5が両Consumerで一致し、未観測はunknownである。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary RCM-IT-005=Direct Boundary: AI Runtime Catalog→Coordinator／Workbench Consumer
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
  const html = renderWorkbenchAiProfiles(surface);
  assert.match(html, /PROFILE-100003/u);
  assert.match(html, /gpt-5\.5/u);
  assert.match(html, /Availability<\/th>/u);
  assert.match(html, />unknown<\/td>/u);
  assert.match(html, /Configuredは実行可能を意味しません/u);
});

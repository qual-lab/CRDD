/**
 * 耐久受付直後・実行準備前のProcess終了を合成Repositoryで再現する。
 * @packageDocumentation
 * @responsibility 自動ITのaccepted保存だけを行い、本文・実行を再送しない。
 * @trace PRL-IT-013
 * @boundary Repository-localの自己生成試験領域。AI・Docker・認証なし。
 */
import assert from "node:assert/strict";
import {
  getRepository,
  readRepositoryRevision,
} from "@qual-lab/crdd-version-control";
import fs from "node:fs";
import path from "node:path";
import { selectionConfig } from "./ai-selection.ts";
import { getModelCatalog } from "@qual-lab/crdd-ai-adapter";
import { saveRepositoryAiSelection } from "@qual-lab/crdd-configuration-model";
import { createCoordinatorTaskRequests } from "../../src/lifecycle/execution.ts";
import { deriveCoordinatorRepositoryBindingId } from "../../src/lifecycle/validation.ts";

const root = process.argv[2];
const revision = process.argv[3];
assert.equal(typeof root, "string");
assert.equal(typeof revision, "string");
if (typeof root !== "string" || typeof revision !== "string")
  throw Error("fixture_arguments_required");
const parent = path.resolve(import.meta.dirname, "../../../../.crdd/tests");
assert.equal(path.dirname(root), parent);
assert.equal(fs.realpathSync.native(root), root);
assert.match(path.basename(root), /^task-acceptance-/u);
assert.match(revision, /^[0-9a-f]{40}$/u);
const repository = getRepository(root);
assert.equal(repository.status, "completed");
if (repository.status !== "completed")
  throw Error("fixture_repository_unverified");
fs.mkdirSync(path.join(root, ".crdd", "config"), { recursive: true });
assert.equal(
  saveRepositoryAiSelection(
    root,
    { expectedIdentity: null, config: selectionConfig() },
    () => true,
    getModelCatalog().catalog,
  ).status,
  "saved",
);
assert.equal(
  readRepositoryRevision(repository.capability)?.revisionIdentity,
  revision,
);
const owner = createCoordinatorTaskRequests({
  root,
  rootCapability: repository.capability,
  consumer: "workbench",
  binding: deriveCoordinatorRepositoryBindingId(root),
  projectId: "synthetic-project",
  principalId: "synthetic-user",
  authorize: () => true,
});
const accepted = await owner.start({
  requestId: "accepted-task-owner-request",
  mode: "read_only_advice",
  workType: null,
  prompt: "synthetic",
  contextReferences: ["PROJECT_CONTEXT.md"],
  allowedPaths: [],
  workspaceId: null,
});
assert.equal(accepted.status, "accepted");
fs.writeSync(1, JSON.stringify(accepted));
// Owner.closeを呼ばずProcessを終了し、次Processの既存再入場経路を試す。
process.exit(0);

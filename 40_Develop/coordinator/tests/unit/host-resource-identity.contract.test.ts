/**
 * Host復帰の資源相関を元Snapshotへ一本化したことを確認する。
 * @responsibility 資源集合欠測・別名・別操作を拒否し構成差を削除条件へ戻さない。
 * @trace ERB-UT-023
 * @level UT
 * @scope 実関数本文と有限Owner代役。実Filesystem・Docker・AI操作は行わない。
 * @packageDocumentation
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import { coordinatorTaskResourcesAreSettled } from "../../../domain-model/src/index.ts";

/**
 * 元相関と資源集合の各一軸だけを変更する。
 * @responsibility Host復帰はSnapshotの完全なkey・名前集合と元Operationを要求する
 * @trace ERB-UT-023
 * @precondition 実関数本文と有限Owner代役。実Filesystem・Docker・AI操作は行わない。
 * @stimulus Host復帰はSnapshotの完全なkey・名前集合と元Operationを要求するの対照入力・故障条件を与える。
 * @observation 返却値・例外と、このCaseが捕捉する要求／通知の記録。
 * @oracle Host復帰はSnapshotの完全なkey・名前集合と元Operationを要求するという条件をassertionで判定する。
 * @cleanup このCaseのmock／hookで今回取得した資源を終了する。合成値だけのCaseは解放不要。
 * @boundary 合成依存から本番判定への限定境界。実AI・Dockerの成立は主張しない。
 */
test("Host復帰はSnapshotの完全なkey・名前集合と元Operationを要求する", () => {
  const source = fs.readFileSync(
    new URL("../../src/execution/controller.ts", import.meta.url),
    "utf8",
  );
  const names = [
    ["create_subscription_auth_probe", "authContainerName"],
    ["create_provider", "providerContainerName"],
    ["create_proxy", "proxyContainerName"],
    ["create_internal_network", "internalNetworkName"],
    ["create_egress_network", "egressNetworkName"],
  ] as const;
  const plan = {
    provider: "claude",
    consumer: "orchestrator",
    operationId: "OP-123456",
    taskAttempt: 0,
    grantRef: "PHMGRANT-FIXTURE",
    executionSelection: { provider: "claude" },
    selectionHash: "selected",
    stableLogicalHomeBindingHash: "home",
    providerHomeIdentityHash: "identity",
    ownershipLabel: "crdd.owner=fixture",
    operationMode: "isolated_task",
    activeMountCapability: {},
    ...Object.fromEntries(names.map(([key, field]) => [field, `crdd-${key}`])),
  };
  const {
    selectionHash: _selectionHash,
    activeMountCapability: _activeMountCapability,
    ...identity
  } = plan;
  const resources = names.map(([key]) => ({
    key,
    request: "issued",
    identity: {
      kind: key.includes("network") ? "network" : "container",
      dockerId: "a".repeat(64),
      name: `crdd-${key}`,
      ownershipLabel: plan.ownershipLabel,
    },
    configuration: {
      image: "observed-image-changed",
      command: null,
      environmentNames: null,
      mounts: null,
      networks: null,
      internal: null,
    },
  }));
  const original = {
    kind: "docker_task",
    recoveryId: "exact-recovery",
    phase: "executing",
    identityJson: JSON.stringify(identity),
    host: { pendingTransitionJson: null, currentToken: "host-current" },
    resources: {
      snapshot: { resources },
      checkpoints: names.map(([key]) => ({
        key,
        submission: "intent_saved",
        receiptSource: "docker_create_result",
        observation: "absent",
        absenceEvidenceSha256: "b".repeat(64),
      })),
    },
  };
  let operation: unknown = original,
    transitions = 0;
  const capability = {},
    mount = {};
  const complete = runInNewContext(
    `${sourceDeclaration(source, "completeRuntimeOwnedCoordinatorHostSubmission")};completeRuntimeOwnedCoordinatorHostSubmission`,
    {
      readRuntimeOwnedCoordinatorStateSnapshot: () => ({
        status: "completed",
        lockReleased: true,
        value: { snapshot: { operations: [operation] } },
      }),
      borrowRuntimeOwnedCoordinatorStateRepository: () => ({
        operationId: plan.operationId,
      }),
      hashExecutionSelection: () => "selected",
      borrowOwnedHostRecoverySnapshot: () => ({
        snapshot: {
          token: "host-current",
          record: { state: "docker_submission_started" },
        },
      }),
      coordinatorTaskResourcesAreSettled,
      verifyRuntimeOwnedProviderHomeMountCompletion: (
        value: unknown,
        management: unknown,
        active: unknown,
      ) =>
        value === mount &&
        management === capability &&
        active === plan.activeMountCapability,
      transitionRuntimeOwnedCoordinatorHostSubmission: () => {
        transitions++;
        return { status: "completed", filesystemEffectIssued: true };
      },
    },
  ) as (
    management: unknown,
    recoveryId: string,
    plan: unknown,
    mount: unknown,
  ) => { status: string };
  assert.equal(
    complete(capability, "exact-recovery", plan, mount).status,
    "completed",
  );
  assert.equal(transitions, 1, "観測Image差だけではHost復帰を拒否しない");
  for (const changed of [
    null,
    { ...original.resources, snapshot: { resources: resources.slice(1) } },
    {
      ...original.resources,
      snapshot: { resources: [...resources, resources[0]] },
    },
    {
      ...original.resources,
      snapshot: {
        resources: resources.map((r, i) =>
          i === 0 ? { ...r, key: "foreign" } : r,
        ),
      },
    },
    {
      ...original.resources,
      snapshot: {
        resources: resources.map((r, i) =>
          i === 0 ? { ...r, identity: { ...r.identity, name: "foreign" } } : r,
        ),
      },
    },
  ]) {
    operation = { ...original, resources: changed };
    assert.equal(
      complete(capability, "exact-recovery", plan, mount).status,
      "blocked",
    );
  }
  operation = original;
  assert.equal(
    complete(capability, "foreign-recovery", plan, mount).status,
    "blocked",
  );
  assert.equal(
    complete(
      capability,
      "exact-recovery",
      { ...plan, stableLogicalHomeBindingHash: "foreign" },
      mount,
    ).status,
    "blocked",
  );
  assert.equal(
    complete(capability, "exact-recovery", plan, {}).status,
    "blocked",
  );
  assert.equal(transitions, 1);
});

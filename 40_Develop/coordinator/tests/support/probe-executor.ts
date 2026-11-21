/**
 * Probe上位の実本文を現Executor通知と実資源更新へ接続する。
 * @packageDocumentation
 * @responsibility 各Case独立のBookと通知列を持ち、旧Token・私有Mapを再構成しない。
 * @trace ERB-IT-004
 * @level IT
 * @scope メモリ内の上位本文とEM資源規則。実保存・Docker・AIは実行しない。
 * @boundary Coordinator通知受付→EM値更新。技術終了は有限Executor代役。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import { runInThisContext } from "node:vm";
import type {
  Executor,
  ExecutorRequest,
  IsolationProbeOptions,
} from "../../../executor/src/index.ts";
import {
  applyResourceCleanup,
  applyResourceEvent,
  type OperationResources,
} from "../../../execution-model/src/index.ts";
import { createResourceBookFixture } from "../../../execution-model/tests/support/resource-operation.ts";
import { sourceDeclaration } from "../../../execution-model/tests/support/source-declaration.ts";
import { observeExecutionCompletion } from "../../src/lifecycle/environment.ts";

const source = fs.readFileSync(
  new URL("../../src/lifecycle/environment.ts", import.meta.url),
  "utf8",
);
const body = [
  "isObject",
  "ownValue",
  "dynamicFakeLifecycleBlocked",
  "projectProbeExecutionFacts",
  "normalizeFailure",
  "isolationProbeBlocked",
  "finishPreSubmissionCleanup",
  "runDockerIsolationProbe",
]
  .map((name) => sourceDeclaration(source, name))
  .join("\n");

type ProbeFactory = (
  request: ExecutorRequest<"isolation_probe">,
  options: IsolationProbeOptions,
) => Executor<"isolation_probe"> | null;
type ProbeResult = {
  status: string;
  reason: string;
  recoveryId: string | null;
  hostCleanupCompleted: boolean;
  retainOperationDirectories: boolean;
  fakeProviderLifecycle: Record<string, unknown>;
};

/**
 * 不変Sourceのみ再利用し、Book・Owner・故障・要求列はCaseごとに生成する。
 * @responsibility 現通知による順序と停止を捕捉し、合成結果を実資源不存在の証拠にしない。
 * @trace ERB-IT-004
 * @precondition 外部Effectを発行しない有限Factoryを渡す。
 * @stimulus 必須保存・Host清掃の失敗と技術完了を注入する。
 * @observation 同期通知、実資源Book、Host処置回数と返却値。
 * @oracle 通知保存に失敗したら後続Effectを発行しない。
 * @cleanup メモリのみ。未完了Promiseは呼出し側が必ず完了させる。
 * @boundary 実上位本文と有限Executor。保存の耐久性は別の実保存試験で確認する。
 */
export function createProbeExecutionFixture(
  failAt: "submission" | "receipt" | "cleanup" | "host" | null = null,
) {
  let book: OperationResources | null = null;
  const events: string[] = [];
  const owned = {},
    mount = {},
    context = {},
    management = {};
  const mounts = Object.freeze({
    management: "management",
    workspace: "workspace",
    providerHome: "home",
    tmp: "tmp",
  });
  const planned = createResourceBookFixture(
    "crdd.coordinator.runtime=0123456789abcdef",
    "planned",
    ["probe"],
  );
  const cleanup = { ...planned.cleanup, unreceiptedAbsence: "retain" as const };
  const settings = Object.freeze({});
  const record = (next: OperationResources) => {
    const checkpoint = next.checkpoints[0];
    assert.ok(checkpoint);
    const stage =
      checkpoint.observation === "absent"
        ? "cleanup"
        : checkpoint.receiptSource
          ? "receipt"
          : checkpoint.submission === "not_issued"
            ? "not_issued"
            : "submission";
    events.push(stage);
    if (failAt === stage) throw Error("fixture_save_refused");
    book = next;
  };
  const bind = runInThisContext(
    "(dependencies)=>{const {randomUUID,getOwnedHostRecoveryId,createOwnedMountCapability,createOwnedOperationContextCapability,createOwnedOperationManagementCapability,verifyOwnedMountCapability,getIsolationSettings,readOwnedHostOperation,applyResourceEvent,applyResourceCleanup,recordOwnedHostResources,cleanupOwnedOperationDirectories,observeExecutionCompletion}=dependencies;\n" +
      body +
      "\nreturn runDockerIsolationProbe;}",
  );
  const run = bind({
    observeExecutionCompletion,
    Object,
    Error,
    Number,
    Promise,
    randomUUID: () => "12345678-1234-4234-8234-123456789abc",
    getOwnedHostRecoveryId: (value: unknown) => {
      assert.equal(value, owned);
      return "host-operation.OP-123456";
    },
    createOwnedMountCapability: (value: unknown) => {
      assert.equal(value, owned);
      return mount;
    },
    createOwnedOperationContextCapability: (value: unknown) => {
      assert.equal(value, owned);
      return context;
    },
    createOwnedOperationManagementCapability: (
      value: unknown,
      target: unknown,
    ) => {
      assert.equal(value, context);
      assert.equal(target, mount);
      return management;
    },
    verifyOwnedMountCapability: (value: unknown) => {
      assert.equal(value, mount);
      return mounts;
    },
    getIsolationSettings: () => settings,
    readOwnedHostOperation: (value: unknown) => {
      assert.equal(value, management);
      return { record: { resources: book }, payloadSha256: "a".repeat(64) };
    },
    applyResourceEvent,
    applyResourceCleanup,
    recordOwnedHostResources: (value: unknown, next: OperationResources) => {
      assert.equal(value, management);
      record(next);
    },
    cleanupOwnedOperationDirectories: (value: unknown) => {
      assert.equal(value, owned);
      events.push("host");
      if (failAt === "host") throw Error("fixture_host_failed");
    },
  }) as (
    owned: object,
    signal: AbortSignal | undefined,
    factory: ProbeFactory,
  ) => Promise<ProbeResult>;
  return {
    events,
    mounts,
    settings,
    planned,
    cleanup,
    target(snapshot = planned.snapshot) {
      return {
        managementDirectory: mounts.management,
        resources: snapshot,
        previouslyAbsent: [],
        ...cleanup,
      };
    },
    book: () => book,
    run: (factory: ProbeFactory, signal?: AbortSignal) =>
      run(owned, signal, factory),
  };
}

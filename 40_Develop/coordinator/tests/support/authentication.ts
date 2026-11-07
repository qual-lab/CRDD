/**
 * 実Coordinator認証・Executor・DIへ有限の外部境界だけを接続する。
 * @responsibility 旧Command実行・偽Receipt補完・旧Cleanup橋渡しを保持しない。
 * @trace ERB-UT-016
 * @level UT
 * @scope メモリ内記録と既存有限CLI代役。実Docker・AI・既存保持物を操作しない。
 */
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs";
import { types } from "node:util";
import { runInThisContext } from "node:vm";
import { sourceDeclaration } from "../../../domain-model/tests/support/source-declaration.ts";
import { getAuthenticationDefinition } from "../../../ai-adapter/src/index.ts";
import { describeIsolationConfiguration } from "../../../docker-isolation/src/index.ts";
import { plannedResourceSnapshot } from "../../../docker-isolation/src/execution/preparation.ts";
import type { TestContext } from "node:test";
import { createIsolationFixture } from "../../../docker-isolation/tests/support/isolation.ts";
import { captureIsolationRequest } from "../../../docker-isolation/src/execution/preparation.ts";
import type { IsolationRequest } from "../../../docker-isolation/src/index.ts";
import {
  applyCoordinatorResourceEvent,
  applyCoordinatorResourceCleanup,
} from "../../../domain-model/src/index.ts";
import type { RecordProjection } from "../../../executor/src/index.ts";
import {
  authenticateProvider,
  prepareProviderAuthentication,
  type AuthenticationRecoveryRecord,
} from "../../src/execution/authority.ts";

/** 構成だけを準備し、元投影とCoordinatorの短命結合を取得する。Docker要求はない。 */
export function prepareAuthenticationProjection(
  provider: "codex" | "claude",
  action: "status" | "login",
  home: string,
  suffix: string,
  token: string | null,
): RecordProjection<"authentication"> | null {
  return prepareProviderAuthentication(
    provider,
    action,
    home,
    suffix,
    token,
    undefined,
    path.win32.join(path.win32.dirname(path.win32.dirname(home)), "management"),
  );
}

/** 現行認証Sourceの純粋構成を、保存試験の元Snapshotへ接続する。 */
export function authenticationResourceFixture(
  provider: "codex" | "claude",
  action: "status" | "login",
  home: string,
  suffix: string,
  token: string | null,
  managementDirectory: string,
) {
  const source = fs.readFileSync(
    new URL(
      "../../../executor/src/lifecycle/authentication.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const build = runInThisContext(
    `(deps)=>{const {types,getAuthenticationDefinition,describeIsolationConfiguration}=deps;${sourceDeclaration(source, "authenticationIsolationRequest")};return authenticationIsolationRequest;}`,
  )({ types, getAuthenticationDefinition, describeIsolationConfiguration }) as (
    request: unknown,
    management: string,
  ) => IsolationRequest;
  const request = captureIsolationRequest(
    build(
      {
        kind: "authentication",
        provider,
        action,
        providerHomeSourcePath: home,
        suffix,
        proxyToken: token,
      },
      managementDirectory,
    ),
  );
  return {
    request,
    snapshot: plannedResourceSnapshot(request),
    cleanup: {
      cleanupOrder: request.cleanupOrder,
      setupTimeoutMs: request.setupTimeoutMs,
      unreceiptedAbsence: request.unreceiptedAbsence,
      verifyLabelAbsence: request.verifyLabelAbsence,
    },
  };
}

/** 外部Processだけ有限化し、保存の試験状態は現在のDomain契約で更新する。 */
export async function createAuthenticationFixture(
  t: { mock: TestContext["mock"]; after: (check: () => void) => void },
  provider: "codex" | "claude" = "claude",
  action: "status" | "login" = "login",
) {
  const f = await createIsolationFixture(t);
  const lower = await import("../../../docker-isolation/src/index.ts");
  f.observation = {
    status: 0,
    signal: null,
    stdout:
      provider === "claude"
        ? JSON.stringify({
            loggedIn: true,
            authMethod: "claude.ai",
            apiProvider: "firstParty",
            forcedLoginMethod: "claudeai",
            subscriptionType: "max",
          })
        : "",
    stderr: provider === "codex" ? "Logged in using ChatGPT" : "",
    outputExceeded: false,
  };
  t.mock.module("../../../docker-isolation/src/index.ts", {
    namedExports: {
      ...lower,
      prepareIsolation: (input: IsolationRequest) => {
        f.useRequest(captureIsolationRequest(input), provider);
        return f.api.prepareIsolation(input);
      },
      executeIsolation: f.api.executeIsolation,
      cleanupIsolation: f.api.cleanupIsolation,
    },
  });
  const {
    createAuthenticationExecutor,
  }: typeof import("../../../executor/src/lifecycle/authentication.ts") =
    await import(
      new URL(
        "../../../executor/src/lifecycle/authentication.ts?coordinator=" +
          Math.random(),
        import.meta.url,
      ).href
    );
  let current: AuthenticationRecoveryRecord | null = null,
    live = true,
    released = false,
    releaseConfirmed = true;
  // 実行側が依存例外を捕捉しても、危険な完了呼出しを試験成功へ畳まない。
  let unsettledCompletionObserved = false;
  t.after(() => {
    assert.equal(
      unsettledCompletionObserved,
      false,
      "completion_before_resource_settlement",
    );
  });
  const events: string[] = [];
  const home = `C:\\fixture\\ProviderHomes\\${provider}`,
    hash = "a".repeat(64);
  const dependencies: NonNullable<Parameters<typeof authenticateProvider>[4]> =
    {
      randomHex: (size) => "b".repeat(size * 2),
      createAuthentication: (request, options) =>
        createAuthenticationExecutor(request, options.managementDirectory),
      createManagementDirectory: () => ({
        directory: f.request.managementDirectory,
        identity: "finite-management",
      }),
      removeManagementDirectory: () => true,
      acquireProviderHomeLock: () =>
        live && !released
          ? {
              status: "acquired",
              lock: {
                assertLive: () => live && !released,
                release: () => {
                  events.push("release");
                  released = releaseConfirmed;
                  return releaseConfirmed;
                },
              },
            }
          : {
              status: "blocked",
              reason: "lock_exists",
              reference: null,
              cleanupConfirmed: true,
              descriptorClosed: true,
            },
      beginRecovery: (record) => {
        events.push("begin");
        if (current?.state === "active")
          return current.action !== record.action
            ? { status: "prior_action_active", recoveryId: current.recoveryId }
            : current.commandState === "in_flight"
              ? "existing_in_flight"
              : "existing_idle";
        current = {
          ...record,
          resources: null,
          state: "active",
          commandState: "idle",
          commandPurpose: null,
        };
        return "created";
      },
      setRecoveryCommandState: (_record, state, purpose, material, key) => {
        events.push(`${state}:${purpose}`);
        if (
          !current ||
          !live ||
          (state === "in_flight" && current.commandState !== "idle") ||
          (state === "idle" && current.commandState !== "in_flight")
        )
          return false;
        let resources = current.resources;
        if (state === "in_flight" && purpose?.startsWith("create_")) {
          resources = applyCoordinatorResourceEvent(resources, {
            ...(material as object),
            event: "submission",
            key,
          });
          if (!resources) return false;
        }
        current = {
          ...current,
          resources,
          commandState: state,
          commandPurpose: purpose,
        };
        return true;
      },
      recordResource: (_record, eventValue) => {
        const event = eventValue as {
          event: string;
          snapshot: unknown;
          observations: unknown;
        };
        events.push(event.event);
        if (!current || !live) return false;
        const resources =
          event.event === "cleanup" && current.resources
            ? applyCoordinatorResourceCleanup(
                current.resources,
                event.snapshot,
                event.observations,
                {
                  recoveryId: current.recoveryId,
                  previousPayloadSha256: createHash("sha256")
                    .update(JSON.stringify(current))
                    .digest("hex"),
                },
              )
            : applyCoordinatorResourceEvent(current.resources, event);
        if (!resources) return false;
        current = {
          ...current,
          resources,
          ...(event.event === "not_issued"
            ? { commandState: "idle" as const, commandPurpose: null }
            : {}),
        };
        return true;
      },
      readResources: () =>
        current && current.commandState === "idle"
          ? { resources: current.resources }
          : null,
      cleanupAuthentication: f.api.cleanupIsolation,
      completeRecovery: () => {
        events.push("settle");
        if (!current || !live || current.commandState !== "idle") return false;
        // 試験Oracle: 未発行又はReceipt付き不存在以外の資源で終了してはならない。
        const unsettled =
          current.resources?.checkpoints.some(
            (resource) =>
              resource.submission !== "none" &&
              resource.submission !== "not_issued" &&
              (resource.receiptSource === null ||
                resource.observation !== "absent"),
          ) ?? false;
        if (unsettled) {
          unsettledCompletionObserved = true;
          return false;
        }
        current = { ...current, state: "settled" };
        return true;
      },
    };
  return {
    f,
    dependencies,
    events,
    home,
    hash,
    get record() {
      return current;
    },
    set live(value: boolean) {
      live = value;
    },
    set releaseConfirmed(value: boolean) {
      releaseConfirmed = value;
    },
    seed(record: AuthenticationRecoveryRecord) {
      current = record;
    },
    resetLease() {
      released = false;
    },
    run: (signal?: AbortSignal) =>
      authenticateProvider(provider, action, home, hash, dependencies, signal),
  };
}

/**
 * 認証試験の既存Command代役を新しい通知境界へ接続する。
 * @responsibility 上位保存の反例を維持し、製品に旧Port互換処理を残さない。
 * @trace ERB-UT-016
 * @level UT
 * @scope 有限代役のみ。実Docker・AIを使用しない。
 * @boundary 移管前の試験入力と新しい本番オーケストレーション。
 */

import type { DockerAuthenticationCommand } from "../../../docker-isolation/src/index.ts";
import {
  bindAuthenticationLifecycle,
  createAuthenticationUsing,
  prepareAuthenticationPlan,
} from "../../../executor/src/authentication/operations.ts";
import type {
  Authentication,
  AuthenticationPlan,
} from "../../../executor/src/authentication/types.ts";
import type {
  ExecutorRequest,
  RecordProjection,
} from "../../../executor/src/index.ts";
import type { AuthenticationRecoveryRecord } from "../../src/execution/authority.ts";
import {
  authenticateProvider as authenticateActual,
  prepareProviderAuthentication as prepareActual,
} from "../../src/execution/authority.ts";

export type AuthenticationTestExecution = Readonly<{
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
  error?: Error;
  processCompletionConfirmed?: boolean;
  resourceCreationConfirmed?: boolean;
  resourceReceipt?: Readonly<{ name: string; dockerId: string }>;
}>;
export type AuthenticationTestDependencies = Readonly<{
  randomHex: (bytes: number) => string;
  run: (
    command: DockerAuthenticationCommand,
    live: () => boolean,
    plan: AuthenticationPlan & RecordProjection<"authentication">,
  ) => Promise<AuthenticationTestExecution>;
  isProcessCompletionConfirmed?: () => boolean;
  acquireProviderHomeLock: (
    hash: string,
  ) => Readonly<{ assertLive: () => boolean; release: () => boolean }> | null;
  beginRecovery: (
    record: AuthenticationRecoveryRecord,
  ) =>
    | "created"
    | "existing_idle"
    | "existing_in_flight"
    | "unknown"
    | Readonly<{ status: "prior_action_active"; recoveryId: string }>;
  setRecoveryCommandState: (
    record: AuthenticationRecoveryRecord,
    state: "idle" | "in_flight",
    purpose: string | null,
  ) => boolean;
  completeRecovery: (record: AuthenticationRecoveryRecord) => boolean;
  recordCreatedResource: (
    record: AuthenticationRecoveryRecord,
    result: AuthenticationTestExecution,
  ) => boolean;
  recoveryCommands: (
    record: AuthenticationRecoveryRecord,
    plan: AuthenticationPlan & RecordProjection<"authentication">,
    index: number,
  ) => Readonly<{
    ownershipCommand: DockerAuthenticationCommand;
    cleanupCommand: DockerAuthenticationCommand | null;
    absenceCommand: DockerAuthenticationCommand;
    identityAbsenceCommand?: DockerAuthenticationCommand;
  }> | null;
}>;

/** 既存の保存反例とCommand代役を、Executorの同じ実行・回収本文へ結合する。 */
export function authenticateProvider(
  provider: "codex" | "claude",
  action: "status" | "login",
  home: string,
  binding: string,
  dependencies?: AuthenticationTestDependencies,
  signal?: AbortSignal,
) {
  if (!dependencies)
    return authenticateActual(
      provider,
      action,
      home,
      binding,
      undefined,
      signal,
    );
  let record: AuthenticationRecoveryRecord | null = null;
  let last: AuthenticationTestExecution | null = null;
  const authentications = new WeakMap<
    ExecutorRequest<"authentication">,
    Authentication
  >();
  const projections = new WeakMap<
    AuthenticationPlan,
    AuthenticationPlan & RecordProjection<"authentication">
  >();
  const project = (
    plan: AuthenticationPlan,
  ): AuthenticationPlan & RecordProjection<"authentication"> => {
    let value = projections.get(plan);
    if (!value) {
      value = Object.freeze({ ...plan, resources: record?.resources ?? [] });
      projections.set(plan, value);
    }
    return value;
  };
  return authenticateActual(
    provider,
    action,
    home,
    binding,
    {
      randomHex: dependencies.randomHex,
      acquireProviderHomeLock: dependencies.acquireProviderHomeLock,
      beginRecovery: (value) => {
        record = value;
        return dependencies.beginRecovery(value);
      },
      setRecoveryCommandState: dependencies.setRecoveryCommandState,
      completeRecovery: dependencies.completeRecovery,
      readResources: (value) => value.resources,
      recordCreatedResource: (value, receipt) =>
        dependencies.recordCreatedResource(
          value,
          last ?? {
            status: 0,
            signal: null,
            stdout: "",
            stderr: "",
            resourceCreationConfirmed: true,
            resourceReceipt: receipt,
          },
        ),
      cleanupAuthentication: async (target) => {
        const authentication = authentications.get(target.request);
        return authentication
          ? authentication.cleanup(
              target.readResources,
              target.assertOwner,
              target.callbacks,
            )
          : { confirmed: false, processCompletionConfirmed: false };
      },
      createAuthentication: (request) => {
        const authentication = createAuthenticationUsing(
          request,
          async (command, live, plan) => {
            last = await dependencies.run(command, live, project(plan));
            const created = command.purpose.startsWith("create_");
            const at = command.argv.indexOf("--name");
            const name = at >= 0 ? command.argv[at + 1] : command.argv.at(-1);
            if (typeof name !== "string")
              throw new Error("synthetic_authentication_resource_name_missing");
            return {
              ...last,
              processCompletionConfirmed:
                last.processCompletionConfirmed !== false,
              ...(created && last.resourceCreationConfirmed === undefined
                ? {
                    resourceCreationConfirmed: true,
                    resourceReceipt: { name, dockerId: "a".repeat(64) },
                  }
                : {}),
            };
          },
          (plan, index) =>
            record
              ? dependencies.recoveryCommands(record, project(plan), index)
              : null,
          dependencies.isProcessCompletionConfirmed,
        );
        if (authentication) authentications.set(request, authentication);
        return bindAuthenticationLifecycle(authentication);
      },
    },
    signal,
  );
}

/** 技術Plan検査を試験側へ残し、記録用の元投影との結合を検証する。 */
export function createProviderAuthenticationPlan<A extends "status" | "login">(
  provider: "codex" | "claude",
  action: A,
  home: string,
  suffix: string,
  token: A extends "login" ? string : null,
): (AuthenticationPlan<A> & RecordProjection<"authentication">) | null {
  const technical = prepareAuthenticationPlan(
    provider,
    action,
    home,
    suffix,
    token,
  );
  if (!technical) return null;
  const auth = createAuthenticationUsing(
    {
      kind: "authentication",
      provider,
      action,
      providerHomeSourcePath: home,
      suffix,
      proxyToken: token,
    },
    async () => {
      throw Error("unmocked_authentication_execution");
    },
  );
  if (!auth) return null;
  const projection = Object.freeze({
    ...technical,
    ...auth.projection,
  }) as AuthenticationPlan<A> & RecordProjection<"authentication">;
  return prepareActual(provider, action, home, suffix, token, () =>
    bindAuthenticationLifecycle({
      ...auth,
      projection,
    }),
  ) as AuthenticationPlan<A> & RecordProjection<"authentication">;
}

import { createHash, randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  readInteractiveConsoleLineOutcome,
  type InteractiveConsoleReadOutcome,
  withInteractiveConsoleAsyncOutcome,
  writeInteractiveConsoleTextOutcome,
  type InteractiveConsoleTextWriteOutcome,
} from "../core/interactive-console.ts";
import {
  isRuntimeProcessEffectBlocked,
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterInteractiveCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";
import { acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome } from "./candidate-store-kernel-lock.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  persistRuntimeOwnedExternalSendConsent,
  resolveRuntimeOwnedExternalSendConsent,
} from "./external-send-consent-runtime.ts";
import { verifyRuntimeOwnedExternalSendPolicy } from "./external-send-policy-runtime.ts";
import {
  snapshotPlainArray,
  snapshotPlainRecord,
} from "./plain-data-snapshot.ts";
import { verifyRuntimeOwnedRepositoryBindingCapability } from "./repository-operation-runtime.ts";
import { containsRecognizedSecretScope } from "./secret-material-policy.ts";

export const EXTERNAL_SEND_GRANT_RUNTIME_CONTRACT =
  "crdd-coordinator/external-send-grant-runtime";
export const EXTERNAL_SEND_GRANT_RUNTIME_CONTRACT_REVISION = 15;

const GRANT_LIFETIME_MS = 1_500_000;
const SCOPE_KEYS = new Set([
  "objective",
  "acceptanceCriteria",
  "allowedPaths",
  "readPaths",
]);
const PROVIDERS = new Set(["codex", "claude"]);
const DERIVED_REMEDIATION_TRANSFER = Object.freeze({
  direction: "independent_reviewer_to_same_executor" as const,
  maximumRounds: 1,
  maximumFindings: 64,
  fields: Object.freeze([
    "severity",
    "path",
    "category",
    "criterionNumber",
    "messageSha256",
  ]),
  reviewerMessageTextForwarded: false,
  informationClassification: "same_as_original_task" as const,
});

type Provider = "codex" | "claude";
type Scope = Readonly<{
  objective: string;
  acceptanceCriteria: readonly string[];
  allowedPaths: readonly string[];
  readPaths: readonly string[];
}>;
type GrantRecord = {
  managementCapability: object;
  repositoryBindingCapability: object;
  operationId: string;
  revision: string;
  scopeHash: string;
  policyCapability: object;
  policyHash: string;
  providers: ReadonlySet<Provider>;
  consumedStages: Set<string>;
  issuedWallClockMs: number;
  issuedMonotonicMs: number;
};
type RuntimeDependencies = Readonly<{
  verifyOperation: typeof verifyOwnedOperationManagementCapability;
  verifyRepository: typeof verifyRuntimeOwnedRepositoryBindingCapability;
  verifyPolicy: typeof verifyRuntimeOwnedExternalSendPolicy;
  confirm: (
    notice: string,
    challenge: string,
    cancellationSignal: AbortSignal,
  ) => Promise<boolean | ConsoleConfirmationOutcome>;
  wallNow: () => number;
  monotonicNow: () => number;
  randomChallenge: () => string;
  resolveConsent?: typeof resolveRuntimeOwnedExternalSendConsent;
  persistConsent?: typeof persistRuntimeOwnedExternalSendConsent;
}>;
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  grants: WeakMap<object, GrantRecord>;
}>;

function normalizedStrings(
  value: unknown,
  maximum: number,
  maximumBytes: number,
) {
  const snapshot = snapshotPlainArray<string>(value, maximum);
  if (
    snapshot.status !== "ok" ||
    snapshot.value.length === 0 ||
    snapshot.value.some(
      (item) =>
        typeof item !== "string" ||
        item.length === 0 ||
        item.trim() !== item ||
        item.includes("\0") ||
        Buffer.byteLength(item, "utf8") > maximumBytes,
    )
  ) {
    return null;
  }
  return Object.freeze([...snapshot.value]);
}

function normalizedScope(rawScope: unknown): Scope | null {
  const value = snapshotPlainRecord(rawScope, SCOPE_KEYS);
  const acceptanceCriteria = value
    ? normalizedStrings(value.acceptanceCriteria, 16, 1_024)
    : null;
  const allowedPaths = value
    ? normalizedStrings(value.allowedPaths, 64, 1_024)
    : null;
  const readPaths = value
    ? normalizedStrings(value.readPaths, 64, 1_024)
    : null;
  if (
    !value ||
    typeof value.objective !== "string" ||
    value.objective.length === 0 ||
    value.objective.trim() !== value.objective ||
    value.objective.includes("\0") ||
    Buffer.byteLength(value.objective, "utf8") > 8_192 ||
    !acceptanceCriteria ||
    !allowedPaths ||
    !readPaths
  ) {
    return null;
  }
  if (
    containsRecognizedSecretScope(
      value.objective,
      acceptanceCriteria,
      allowedPaths,
      readPaths,
    )
  ) {
    return null;
  }
  return Object.freeze({
    objective: value.objective,
    acceptanceCriteria,
    allowedPaths,
    readPaths,
  });
}

export function compileExternalSendScopeHash(rawScope: unknown) {
  const scope = normalizedScope(rawScope);
  return scope
    ? createHash("sha256")
        .update("crdd-external-send-scope-v3\0")
        .update(
          JSON.stringify({
            objective: scope.objective,
            acceptanceCriteria: scope.acceptanceCriteria,
            allowedPaths: scope.allowedPaths,
            readPaths: scope.readPaths,
            derivedRemediationTransfer: DERIVED_REMEDIATION_TRANSFER,
          }),
        )
        .digest("hex")
    : null;
}

function terminalSafeJson(value: unknown) {
  return JSON.stringify(value, null, 2).replace(
    /[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu,
    (character) =>
      `\\u${character.codePointAt(0)?.toString(16).padStart(4, "0")}`,
  );
}

type ConsoleConfirmationAdapter = Readonly<{
  writeText: (outputDescriptor: number, value: string) => Promise<boolean>;
  readLine: (
    inputDescriptor: number,
    cancellationSignal: AbortSignal,
  ) => Promise<string | null>;
}>;

type ConsoleConfirmationOutcome = Readonly<{
  status:
    | "confirmed"
    | "declined_invalid"
    | "cancelled"
    | "timeout"
    | "unavailable"
    | "reader_failed"
    | "cleanup_unknown";
}>;

type ConsoleConfirmationOutcomeAdapter = Readonly<{
  writeText: (
    outputDescriptor: number,
    value: string,
  ) => Promise<boolean | InteractiveConsoleTextWriteOutcome>;
  readLine: (
    inputDescriptor: number,
    cancellationSignal: AbortSignal,
  ) => Promise<InteractiveConsoleReadOutcome>;
}>;

function textWriteOutcome(
  value: boolean | InteractiveConsoleTextWriteOutcome,
): InteractiveConsoleTextWriteOutcome {
  return typeof value === "boolean"
    ? Object.freeze({ status: value ? "completed" : "write_failed" })
    : value;
}

function isCancellationSignal(value: unknown): value is AbortSignal {
  return value instanceof AbortSignal;
}

export async function confirmInteractiveConsoleChallengeUsingAdapter(
  notice: string,
  challenge: string,
  handles: Readonly<{ input: number; output: number }>,
  cancellationSignal: AbortSignal,
  adapter: ConsoleConfirmationAdapter,
) {
  if (!isCancellationSignal(cancellationSignal) || cancellationSignal.aborted)
    return false;
  if (
    !(await adapter.writeText(
      handles.output,
      `${notice}\n外部送信を承認する場合は ${challenge} を入力してください: `,
    ))
  ) {
    return false;
  }
  if (cancellationSignal.aborted) return false;
  const line = await adapter.readLine(handles.input, cancellationSignal);
  if (line === null || cancellationSignal.aborted) return false;
  return (
    (await adapter.writeText(handles.output, "\n")) &&
    !cancellationSignal.aborted &&
    line === challenge
  );
}

export async function confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
  notice: string,
  challenge: string,
  handles: Readonly<{ input: number; output: number }>,
  cancellationSignal: AbortSignal,
  adapter: ConsoleConfirmationOutcomeAdapter,
): Promise<ConsoleConfirmationOutcome> {
  if (!isCancellationSignal(cancellationSignal) || cancellationSignal.aborted)
    return Object.freeze({ status: "cancelled" });
  const promptWrite = textWriteOutcome(
    await adapter.writeText(
      handles.output,
      `${notice}\n外部送信を承認する場合は ${challenge} を入力してください: `,
    ),
  );
  if (promptWrite.status === "cleanup_unknown")
    return Object.freeze({ status: "cleanup_unknown" });
  if (promptWrite.status !== "completed") {
    return Object.freeze({ status: "unavailable" });
  }
  let status: ConsoleConfirmationOutcome["status"] = "reader_failed";
  try {
    if (cancellationSignal.aborted) status = "cancelled";
    else {
      const read = await adapter.readLine(handles.input, cancellationSignal);
      status =
        read.status === "completed"
          ? read.line === challenge
            ? "confirmed"
            : "declined_invalid"
          : read.status;
    }
  } catch {
    status = "reader_failed";
  }
  let newlineWrite: InteractiveConsoleTextWriteOutcome;
  try {
    newlineWrite = textWriteOutcome(
      await adapter.writeText(handles.output, "\n"),
    );
  } catch {
    newlineWrite = Object.freeze({ status: "write_failed" });
  }
  if (newlineWrite.status === "cleanup_unknown") status = "cleanup_unknown";
  else if (newlineWrite.status === "write_failed" && status === "confirmed")
    status = "unavailable";
  if (cancellationSignal.aborted && status !== "cleanup_unknown")
    status = "cancelled";
  return Object.freeze({ status });
}

export async function confirmRuntimeOwnedExternalSendUsingConsole(
  notice: string,
  challenge: string,
  cancellationSignal: AbortSignal,
) {
  if (isRuntimeProcessEffectBlocked())
    return Object.freeze({ status: "cleanup_unknown" as const });
  let lockOutcome: Awaited<
    ReturnType<typeof acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome>
  >;
  try {
    lockOutcome =
      await acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome();
  } catch {
    poisonRuntimeProcessAfterInteractiveCleanupUnknown();
    return Object.freeze({ status: "cleanup_unknown" as const });
  }
  if (lockOutcome.status === "unavailable")
    return Object.freeze({ status: "unavailable" as const });
  if (lockOutcome.status === "cleanup_unknown" || !lockOutcome.lock) {
    poisonRuntimeProcessAfterInteractiveCleanupUnknown();
    return Object.freeze({ status: "cleanup_unknown" as const });
  }
  const consoleLock = lockOutcome.lock;
  let outcome: ConsoleConfirmationOutcome = Object.freeze({
    status: "reader_failed",
  });
  try {
    const wrapped = await withInteractiveConsoleAsyncOutcome((handles) =>
      confirmInteractiveConsoleChallengeOutcomeUsingAdapter(
        notice,
        challenge,
        handles,
        cancellationSignal,
        Object.freeze({
          writeText: writeInteractiveConsoleTextOutcome,
          readLine: readInteractiveConsoleLineOutcome,
        }),
      ),
    );
    outcome =
      wrapped.status === "completed" && wrapped.value
        ? wrapped.value
        : Object.freeze({
            status:
              wrapped.status === "cleanup_unknown"
                ? ("cleanup_unknown" as const)
                : wrapped.status === "unavailable"
                  ? ("unavailable" as const)
                  : ("reader_failed" as const),
          });
  } catch {
    outcome = Object.freeze({ status: "reader_failed" });
  }
  if (outcome.status === "cleanup_unknown")
    poisonRuntimeProcessAfterInteractiveCleanupUnknown();
  let isLockReleased = false;
  try {
    isLockReleased = (await consoleLock.release()) === "released";
  } catch {
    isLockReleased = false;
  }
  if (!isLockReleased || outcome.status === "cleanup_unknown") {
    poisonRuntimeProcessAfterInteractiveCleanupUnknown();
    return Object.freeze({ status: "cleanup_unknown" as const });
  }
  return outcome;
}

function createState(dependencies: RuntimeDependencies): RuntimeState {
  return Object.freeze({ dependencies, grants: new WeakMap() });
}

const productionState = createState(
  Object.freeze({
    verifyOperation: verifyOwnedOperationManagementCapability,
    verifyRepository: verifyRuntimeOwnedRepositoryBindingCapability,
    verifyPolicy: verifyRuntimeOwnedExternalSendPolicy,
    confirm: confirmRuntimeOwnedExternalSendUsingConsole,
    wallNow: Date.now,
    monotonicNow: performance.now.bind(performance),
    randomChallenge: () => randomInt(0, 1_000_000).toString().padStart(6, "0"),
    resolveConsent: resolveRuntimeOwnedExternalSendConsent,
    persistConsent: persistRuntimeOwnedExternalSendConsent,
  }),
);

async function requestGrant(
  state: RuntimeState,
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  policyCapability: unknown,
  rawScope: unknown,
  rawProviders: unknown,
  cancellationSignal: AbortSignal,
) {
  try {
    if (!isCancellationSignal(cancellationSignal) || cancellationSignal.aborted)
      return null;
    if (
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      !policyCapability ||
      typeof policyCapability !== "object" ||
      !Array.isArray(rawProviders)
    ) {
      return null;
    }
    const providers = [...new Set(rawProviders)];
    if (
      providers.length === 0 ||
      providers.some(
        (provider) => typeof provider !== "string" || !PROVIDERS.has(provider),
      )
    ) {
      return null;
    }
    const operation = state.dependencies.verifyOperation(managementCapability);
    const repository = state.dependencies.verifyRepository(
      repositoryBindingCapability,
      managementCapability,
    );
    const scope = normalizedScope(rawScope);
    const scopeHash = compileExternalSendScopeHash(rawScope);
    const policy = state.dependencies.verifyPolicy(
      policyCapability,
      managementCapability,
      repositoryBindingCapability,
    );
    const challenge = state.dependencies.randomChallenge();
    const issuedWallClockMs = state.dependencies.wallNow();
    const issuedMonotonicMs = state.dependencies.monotonicNow();
    if (
      !repository ||
      repository.operationId !== operation.operationId ||
      !scope ||
      !scopeHash ||
      !policy ||
      !/^[0-9]{6}$/u.test(challenge) ||
      !Number.isFinite(issuedWallClockMs) ||
      !Number.isFinite(issuedMonotonicMs)
    ) {
      return null;
    }
    const authorizedDestinations = policy.destinations.filter((destination) =>
      providers.includes(destination.provider),
    );
    if (authorizedDestinations.length !== providers.length) return null;
    const reusableConsent = state.dependencies.resolveConsent?.(policy);
    if (reusableConsent?.status === "recovery_required") {
      return Object.freeze({
        status: "blocked" as const,
        reason: "external_send_consent_manual_recovery_required",
        manualRecoveryRequired: true,
        externalSendAuthorized: false,
        rawContentReported: false,
        hostPathReported: false,
      });
    }
    const persistentConsentBoundary = Object.freeze({
      policyId: policy.policyId,
      policySourceFileHash: policy.sourceFileHash,
      informationClassification: policy.informationClassification,
      decisionAuthority: policy.decisionAuthority,
      providerDestinations: policy.destinations,
      localCandidatePersistence: Object.freeze({
        allowed: policy.candidatePersistenceAllowed,
        informationClassification: policy.informationClassification,
        exportLifetimeHours: policy.candidateRetentionHours,
        physicalDeletion: policy.candidatePhysicalDeletion,
      }),
      consentLifetimeDays: 180,
      apiKeyFallbackAllowed: false,
      additionalPurchaseAllowed: false,
    });
    const currentOperationPreview = Object.freeze({
      repositoryRevision: repository.revision,
      requestedProviderDestinations: authorizedDestinations,
      taskPayload: scope,
      scopeHash,
      derivedRemediationTransfer: DERIVED_REMEDIATION_TRANSFER,
      runtimeVerificationBoundary: Object.freeze({
        selectedUserDedicatedProviderHomeSession: true,
        subscriptionOfferingPreflight: true,
        exactProviderAccountOrTenantIdentity: false,
        providerTermsContent: false,
        termsAndSettingsRequireThisInteractiveHumanConfirmation: true,
      }),
    });
    const notice = [
      "Coordinator Runtime 初期外部送信設定（次の永続境界が変更・失効・取消されるまで再確認しません）",
      terminalSafeJson(persistentConsentBoundary),
      "今回の操作プレビュー（永続同意には保存しません）",
      terminalSafeJson(currentOperationPreview),
      "対象内容はProviderへ送信され、Subscription枠を消費する可能性があります。API key fallbackと追加購入は行いません。",
    ].join("\n");
    let authorizationMode:
      | "reused_initial_consent"
      | "interactive_initial_consent" = "reused_initial_consent";
    if (reusableConsent?.status !== "confirmed") {
      authorizationMode = "interactive_initial_consent";
      const rawConfirmation = await state.dependencies.confirm(
        notice,
        challenge,
        cancellationSignal,
      );
      const confirmation: ConsoleConfirmationOutcome =
        typeof rawConfirmation === "boolean"
          ? Object.freeze({
              status: rawConfirmation ? "confirmed" : "declined_invalid",
            })
          : rawConfirmation;
      if (confirmation.status !== "confirmed" || cancellationSignal.aborted) {
        return Object.freeze({
          status: "blocked" as const,
          reason:
            confirmation.status === "cleanup_unknown"
              ? "external_send_confirmation_cleanup_unknown_process_restart_required"
              : `external_send_confirmation_${
                  cancellationSignal.aborted ? "cancelled" : confirmation.status
                }`,
          manualRecoveryRequired: confirmation.status === "cleanup_unknown",
          externalSendAuthorized: false,
          rawContentReported: false,
          hostPathReported: false,
        });
      }
      if (state.dependencies.persistConsent) {
        const persisted = state.dependencies.persistConsent(policy);
        if (persisted.status !== "confirmed") {
          return Object.freeze({
            status: "blocked" as const,
            reason: "external_send_consent_manual_recovery_required",
            manualRecoveryRequired: true,
            externalSendAuthorized: false,
            rawContentReported: false,
            hostPathReported: false,
          });
        }
      }
    }
    const capability = Object.freeze({});
    state.grants.set(capability, {
      managementCapability,
      repositoryBindingCapability,
      operationId: operation.operationId,
      revision: repository.revision,
      scopeHash,
      policyCapability,
      policyHash: policy.policyHash,
      providers: new Set(providers as Provider[]),
      consumedStages: new Set(),
      issuedWallClockMs,
      issuedMonotonicMs,
    });
    return Object.freeze({
      status: "issued" as const,
      capability,
      scopeHash,
      policyHash: policy.policyHash,
      revision: repository.revision,
      providerCandidates: Object.freeze(providers),
      externalSendAuthorized: true,
      authorizationMode,
      derivedRemediationTransfer: DERIVED_REMEDIATION_TRANSFER,
      apiKeyFallbackAllowed: false,
      additionalPurchaseAllowed: false,
      rawContentReported: false,
      hostPathReported: false,
    });
  } catch {
    return null;
  }
}

function consumeGrant(
  state: RuntimeState,
  capability: unknown,
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  provider: unknown,
  taskRole: unknown,
  taskAttempt: unknown,
  rawScope: unknown,
) {
  try {
    if (
      !capability ||
      typeof capability !== "object" ||
      !managementCapability ||
      typeof managementCapability !== "object" ||
      !repositoryBindingCapability ||
      typeof repositoryBindingCapability !== "object" ||
      (provider !== "codex" && provider !== "claude") ||
      (taskRole !== "executor" && taskRole !== "reviewer") ||
      (taskAttempt !== 0 && taskAttempt !== 1)
    ) {
      return null;
    }
    const record = state.grants.get(capability);
    const repository = state.dependencies.verifyRepository(
      repositoryBindingCapability,
      managementCapability,
    );
    const wallAge = record
      ? state.dependencies.wallNow() - record.issuedWallClockMs
      : Number.NaN;
    const monotonicAge = record
      ? state.dependencies.monotonicNow() - record.issuedMonotonicMs
      : Number.NaN;
    if (
      !record ||
      record.managementCapability !== managementCapability ||
      record.repositoryBindingCapability !== repositoryBindingCapability ||
      !repository ||
      repository.operationId !== record.operationId ||
      repository.revision !== record.revision ||
      compileExternalSendScopeHash(rawScope) !== record.scopeHash ||
      !record.providers.has(provider) ||
      record.consumedStages.has(`${taskRole}:${taskAttempt}`) ||
      !Number.isFinite(wallAge) ||
      !Number.isFinite(monotonicAge) ||
      wallAge < 0 ||
      monotonicAge < 0 ||
      wallAge >= GRANT_LIFETIME_MS ||
      monotonicAge >= GRANT_LIFETIME_MS
    ) {
      return null;
    }
    record.consumedStages.add(`${taskRole}:${taskAttempt}`);
    if (record.consumedStages.size === 4) state.grants.delete(capability);
    return Object.freeze({
      status: "consumed" as const,
      operationId: record.operationId,
      revision: record.revision,
      provider,
      taskRole,
      taskAttempt,
      scopeHash: record.scopeHash,
      externalSendAuthorized: true,
    });
  } catch {
    return null;
  }
}

export function requestRuntimeOwnedExternalSendGrant(
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  policyCapability: unknown,
  rawScope: unknown,
  rawProviders: unknown,
  cancellationSignal: AbortSignal,
) {
  if (isRuntimeProcessEffectBlocked()) {
    return Promise.resolve(
      Object.freeze({
        status: "blocked" as const,
        reason: isRuntimeProcessPoisoned()
          ? ("external_send_confirmation_cleanup_unknown_process_restart_required" as const)
          : ("external_send_confirmation_runtime_cleanup_in_progress" as const),
        manualRecoveryRequired: isRuntimeProcessPoisoned(),
        externalSendAuthorized: false,
        rawContentReported: false,
        hostPathReported: false,
      }),
    );
  }
  return requestGrant(
    productionState,
    managementCapability,
    repositoryBindingCapability,
    policyCapability,
    rawScope,
    rawProviders,
    cancellationSignal,
  );
}

export function consumeRuntimeOwnedExternalSendGrant(
  capability: unknown,
  managementCapability: unknown,
  repositoryBindingCapability: unknown,
  provider: unknown,
  taskRole: unknown,
  taskAttempt: unknown,
  rawScope: unknown,
) {
  return consumeGrant(
    productionState,
    capability,
    managementCapability,
    repositoryBindingCapability,
    provider,
    taskRole,
    taskAttempt,
    rawScope,
  );
}

export function createIsolatedExternalSendGrantRuntimeCandidate(
  dependencies: RuntimeDependencies,
) {
  const state = createState(dependencies);
  return Object.freeze({
    productionAuthority: false as const,
    request: (
      managementCapability: unknown,
      repositoryBindingCapability: unknown,
      policyCapability: unknown,
      rawScope: unknown,
      rawProviders: unknown,
      cancellationSignal = new AbortController().signal,
    ) =>
      requestGrant(
        state,
        managementCapability,
        repositoryBindingCapability,
        policyCapability,
        rawScope,
        rawProviders,
        cancellationSignal,
      ),
    consume: (
      capability: unknown,
      managementCapability: unknown,
      repositoryBindingCapability: unknown,
      provider: unknown,
      taskRole: unknown,
      taskAttempt: unknown,
      rawScope: unknown,
    ) =>
      consumeGrant(
        state,
        capability,
        managementCapability,
        repositoryBindingCapability,
        provider,
        taskRole,
        taskAttempt,
        rawScope,
      ),
  });
}

export function describeExternalSendGrantRuntimeContract() {
  return Object.freeze({
    contract: EXTERNAL_SEND_GRANT_RUNTIME_CONTRACT,
    contractRevision: EXTERNAL_SEND_GRANT_RUNTIME_CONTRACT_REVISION,
    authoritySource:
      "authenticated_local_user_initial_console_confirmation_reused_for_exact_runtime_owned_boundary",
    interactiveConfirmation:
      "first_boundary_only_async_prompt_completion_exact_console_descriptor_fixed_reader_final_output_child_exit_and_console_cleanup",
    normalOperationConfirmation:
      "not_required_for_exact_unchanged_runtime_owned_consent_boundary",
    reapproval:
      "policy_boundary_change_missing_consent_different_selected_user_or_unresolved_state",
    taskStandardInputRole: "structured_transport_only",
    readerProcessEffect:
      "operation_authorized_single_use_before_workspace_provider_and_network",
    concurrentReaderExclusion: "windows_kernel_lock",
    cleanupUnknownHandling:
      "process_local_poison_restart_required_no_operation_recovery_id",
    consentRecoveryRequiredHandling:
      "manual_recovery_required_before_authority_workspace_provider_and_network",
    cleanupUnknownPoisonTiming:
      "before_console_lock_release_await_when_operation_cleanup_is_unknown",
    processPoisonGate:
      "before_external_send_reentry_package_issue_task_consume_and_all_effects",
    processPoisonReentryResult:
      "bounded_cleanup_unknown_process_restart_required_no_input_or_authority_observation",
    runtimeOwnedConsoleConfirmationPackageExported: false,
    binding: Object.freeze([
      "operation",
      "repository_identity",
      "revision",
      "task_scope_hash",
      "repository_external_send_policy_hash",
      "provider",
      "task_role",
    ]),
    maximumUses: 4,
    roleUses: Object.freeze([
      "executor:0",
      "reviewer:0",
      "executor:1",
      "reviewer:1",
    ]),
    boundedRemediationRounds: 1,
    derivedRemediationTransfer: DERIVED_REMEDIATION_TRANSFER,
    reviewerMessageTextForwarded: false,
    exactProviderAccountOrTenantIdentityVerified: false,
    providerTermsContentVerified: false,
    lifetimeMs: GRANT_LIFETIME_MS,
    callerPolicyStringAcceptedAsAuthority: false,
    apiKeyFallbackAllowed: false,
    additionalPurchaseAllowed: false,
    rawContentReported: false,
    hostPathReported: false,
  });
}

import { createHash, randomInt } from "node:crypto";
import { performance } from "node:perf_hooks";

import {
  type InteractiveConsoleReadOutcome,
  type InteractiveConsoleTextWriteOutcome,
  readInteractiveConsoleLineOutcome,
  withInteractiveConsoleAsyncOutcome,
  writeInteractiveConsoleTextOutcome,
} from "../core/interactive-console.ts";
import {
  isRuntimeProcessEffectBlocked,
  isRuntimeProcessPoisoned,
  poisonRuntimeProcessAfterInteractiveCleanupUnknown,
} from "../core/runtime-process-safety-state.ts";
import { acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome } from "./candidate-store-kernel-lock.ts";
import { verifyOwnedOperationManagementCapability } from "./execution-environment.ts";
import {
  EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
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
export const EXTERNAL_SEND_GRANT_RUNTIME_CONTRACT_REVISION = 16;

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
    "message",
    "messageSha256",
  ]),
  reviewerMessageTextForwarded:
    "bounded_untrusted_defect_claim_after_recognized_secret_screening" as const,
  informationClassification: "same_as_original_task" as const,
});

/**
 * Providerが扱う値の構造を表す。
 *
 * @responsibility Providerに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape Providerが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Providerで宣言した値と責務の対応を維持する。
 * @boundary N/A: Providerの宣言は外部境界を開かない。
 * @security ProviderはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Providerの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Provider = "codex" | "claude";
/**
 * Scopeが扱う値の構造を表す。
 *
 * @responsibility Scopeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape Scopeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant Scopeで宣言した値と責務の対応を維持する。
 * @boundary N/A: Scopeの宣言は外部境界を開かない。
 * @security ScopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility Scopeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type Scope = Readonly<{
  objective: string;
  acceptanceCriteria: readonly string[];
  allowedPaths: readonly string[];
  readPaths: readonly string[];
}>;
/**
 * GrantRecordが扱う値の構造を表す。
 *
 * @responsibility GrantRecordに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape GrantRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant GrantRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: GrantRecordの宣言は外部境界を開かない。
 * @security GrantRecordはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility GrantRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
/**
 * RuntimeDependenciesが扱う値の構造を表す。
 *
 * @responsibility RuntimeDependenciesに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape RuntimeDependenciesが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeDependenciesで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeDependenciesの宣言は外部境界を開かない。
 * @security RuntimeDependenciesはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeDependenciesの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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
/**
 * RuntimeStateが扱う値の構造を表す。
 *
 * @responsibility RuntimeStateに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape RuntimeStateが表すProperty、識別子およびRelationを型として固定する。
 * @invariant RuntimeStateで宣言した値と責務の対応を維持する。
 * @boundary N/A: RuntimeStateの宣言は外部境界を開かない。
 * @security RuntimeStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility RuntimeStateの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type RuntimeState = Readonly<{
  dependencies: RuntimeDependencies;
  grants: WeakMap<object, GrantRecord>;
}>;

/**
 * normalizedStringsの処理を実行する。
 *
 * @responsibility normalizedStringsに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: unknown、maximum: number、maximumBytes: number
 * @returns normalizedStringsの計算結果を返す。
 * @precondition 「value: unknown、maximum: number、maximumBytes: number」がnormalizedStringsの入力契約を満たす。
 * @postcondition normalizedStringsの責務を完了した結果だけを返す。
 * @effect N/A: normalizedStringsは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizedStringsは独自の失敗分岐を所有しない。
 * @invariant normalizedStringsは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizedStringsはProcess内の同一Subsystemで完結する。
 * @security normalizedStringsはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizedStringsは共有非同期状態を持たない同期処理である。
 */
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

/**
 * normalizedScopeの処理を実行する。
 *
 * @responsibility normalizedScopeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input rawScope: unknown
 * @returns Scope | nullを返す。
 * @precondition 「rawScope: unknown」がnormalizedScopeの入力契約を満たす。
 * @postcondition normalizedScopeの責務を完了した結果だけを返す。
 * @effect N/A: normalizedScopeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: normalizedScopeは独自の失敗分岐を所有しない。
 * @invariant normalizedScopeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: normalizedScopeはProcess内の同一Subsystemで完結する。
 * @security normalizedScopeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: normalizedScopeは共有非同期状態を持たない同期処理である。
 */
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

/**
 * compileExternalSendScopeHashの処理を実行する。
 *
 * @responsibility compileExternalSendScopeHashに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input rawScope: unknown
 * @returns compileExternalSendScopeHashの計算結果を返す。
 * @precondition 「rawScope: unknown」がcompileExternalSendScopeHashの入力契約を満たす。
 * @postcondition compileExternalSendScopeHashの責務を完了した結果だけを返す。
 * @effect N/A: compileExternalSendScopeHashは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: compileExternalSendScopeHashは独自の失敗分岐を所有しない。
 * @invariant compileExternalSendScopeHashは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: compileExternalSendScopeHashはProcess内の同一Subsystemで完結する。
 * @security compileExternalSendScopeHashはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: compileExternalSendScopeHashは共有非同期状態を持たない同期処理である。
 */
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

/**
 * terminalSafeJsonの処理を実行する。
 *
 * @responsibility terminalSafeJsonに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns terminalSafeJsonの計算結果を返す。
 * @precondition 「value: unknown」がterminalSafeJsonの入力契約を満たす。
 * @postcondition terminalSafeJsonの責務を完了した結果だけを返す。
 * @effect N/A: terminalSafeJsonは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: terminalSafeJsonは独自の失敗分岐を所有しない。
 * @invariant terminalSafeJsonは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: terminalSafeJsonはProcess内の同一Subsystemで完結する。
 * @security terminalSafeJsonはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: terminalSafeJsonは共有非同期状態を持たない同期処理である。
 */
function terminalSafeJson(value: unknown) {
  return JSON.stringify(value, null, 2).replace(
    /[\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu,
    (character) =>
      `\\u${character.codePointAt(0)?.toString(16).padStart(4, "0")}`,
  );
}

/**
 * ConsoleConfirmationAdapterが扱う値の構造を表す。
 *
 * @responsibility ConsoleConfirmationAdapterに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape ConsoleConfirmationAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ConsoleConfirmationAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: ConsoleConfirmationAdapterの宣言は外部境界を開かない。
 * @security ConsoleConfirmationAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ConsoleConfirmationAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
type ConsoleConfirmationAdapter = Readonly<{
  writeText: (outputDescriptor: number, value: string) => Promise<boolean>;
  readLine: (
    inputDescriptor: number,
    cancellationSignal: AbortSignal,
  ) => Promise<string | null>;
}>;

/**
 * ConsoleConfirmationOutcomeが扱う値の構造を表す。
 *
 * @responsibility ConsoleConfirmationOutcomeに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape ConsoleConfirmationOutcomeが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ConsoleConfirmationOutcomeで宣言した値と責務の対応を維持する。
 * @boundary N/A: ConsoleConfirmationOutcomeの宣言は外部境界を開かない。
 * @security ConsoleConfirmationOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ConsoleConfirmationOutcomeの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * ConsoleConfirmationOutcomeAdapterが扱う値の構造を表す。
 *
 * @responsibility ConsoleConfirmationOutcomeAdapterに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000015
 * @shape ConsoleConfirmationOutcomeAdapterが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ConsoleConfirmationOutcomeAdapterで宣言した値と責務の対応を維持する。
 * @boundary N/A: ConsoleConfirmationOutcomeAdapterの宣言は外部境界を開かない。
 * @security ConsoleConfirmationOutcomeAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @compatibility ConsoleConfirmationOutcomeAdapterの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
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

/**
 * textWriteOutcomeの処理を実行する。
 *
 * @responsibility textWriteOutcomeに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: boolean | InteractiveConsoleTextWriteOutcome
 * @returns InteractiveConsoleTextWriteOutcomeを返す。
 * @precondition 「value: boolean | InteractiveConsoleTextWriteOutcome」がtextWriteOutcomeの入力契約を満たす。
 * @postcondition textWriteOutcomeの責務を完了した結果だけを返す。
 * @effect N/A: textWriteOutcomeは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: textWriteOutcomeは独自の失敗分岐を所有しない。
 * @invariant textWriteOutcomeは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: textWriteOutcomeはProcess内の同一Subsystemで完結する。
 * @security textWriteOutcomeはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: textWriteOutcomeは共有非同期状態を持たない同期処理である。
 */
function textWriteOutcome(
  value: boolean | InteractiveConsoleTextWriteOutcome,
): InteractiveConsoleTextWriteOutcome {
  return typeof value === "boolean"
    ? Object.freeze({ status: value ? "completed" : "write_failed" })
    : value;
}

/**
 * isCancellationSignalの処理を実行する。
 *
 * @responsibility isCancellationSignalに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input value: unknown
 * @returns value is AbortSignalを返す。
 * @precondition 「value: unknown」がisCancellationSignalの入力契約を満たす。
 * @postcondition isCancellationSignalの責務を完了した結果だけを返す。
 * @effect N/A: isCancellationSignalは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isCancellationSignalは独自の失敗分岐を所有しない。
 * @invariant isCancellationSignalは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCancellationSignalはProcess内の同一Subsystemで完結する。
 * @security isCancellationSignalはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: isCancellationSignalは共有非同期状態を持たない同期処理である。
 */
function isCancellationSignal(value: unknown): value is AbortSignal {
  return value instanceof AbortSignal;
}

/**
 * confirmInteractiveConsoleChallengeUsingAdapterの処理を実行する。
 *
 * @responsibility confirmInteractiveConsoleChallengeUsingAdapterに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input notice: string、challenge: string、handles: Readonly<{ input: number; output: number }>、cancellationSignal: AbortSignal、adapter: ConsoleConfirmationAdapter
 * @returns confirmInteractiveConsoleChallengeUsingAdapterの計算結果を返す。
 * @precondition 「notice: string、challenge: string、handles: Readonly<{ input: number; output: number }>、cancellationSignal: AbortSignal、adapter: ConsoleConfirmationAdapter」がconfirmInteractiveConsoleChallengeUsingAdapterの入力契約を満たす。
 * @postcondition confirmInteractiveConsoleChallengeUsingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: confirmInteractiveConsoleChallengeUsingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: confirmInteractiveConsoleChallengeUsingAdapterは独自の失敗分岐を所有しない。
 * @invariant confirmInteractiveConsoleChallengeUsingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: confirmInteractiveConsoleChallengeUsingAdapterはProcess内の同一Subsystemで完結する。
 * @security confirmInteractiveConsoleChallengeUsingAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency confirmInteractiveConsoleChallengeUsingAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * confirmInteractiveConsoleChallengeOutcomeUsingAdapterの処理を実行する。
 *
 * @responsibility confirmInteractiveConsoleChallengeOutcomeUsingAdapterに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input notice: string、challenge: string、handles: Readonly<{ input: number; output: number }>、cancellationSignal: AbortSignal、adapter: ConsoleConfirmationOutcomeAdapter
 * @returns Promise<ConsoleConfirmationOutcome>を返す。
 * @precondition 「notice: string、challenge: string、handles: Readonly<{ input: number; output: number }>、cancellationSignal: AbortSignal、adapter: ConsoleConfirmationOutcomeAdapter」がconfirmInteractiveConsoleChallengeOutcomeUsingAdapterの入力契約を満たす。
 * @postcondition confirmInteractiveConsoleChallengeOutcomeUsingAdapterの責務を完了した結果だけを返す。
 * @effect N/A: confirmInteractiveConsoleChallengeOutcomeUsingAdapterは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure confirmInteractiveConsoleChallengeOutcomeUsingAdapterは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant confirmInteractiveConsoleChallengeOutcomeUsingAdapterは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: confirmInteractiveConsoleChallengeOutcomeUsingAdapterはProcess内の同一Subsystemで完結する。
 * @security confirmInteractiveConsoleChallengeOutcomeUsingAdapterはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency confirmInteractiveConsoleChallengeOutcomeUsingAdapterは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * confirmRuntimeOwnedOperationUsingConsoleの処理を実行する。
 *
 * @responsibility confirmRuntimeOwnedOperationUsingConsoleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input notice: string、challenge: string、cancellationSignal: AbortSignal
 * @returns confirmRuntimeOwnedOperationUsingConsoleの計算結果を返す。
 * @precondition 「notice: string、challenge: string、cancellationSignal: AbortSignal」がconfirmRuntimeOwnedOperationUsingConsoleの入力契約を満たす。
 * @postcondition confirmRuntimeOwnedOperationUsingConsoleの責務を完了した結果だけを返す。
 * @effect N/A: confirmRuntimeOwnedOperationUsingConsoleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure confirmRuntimeOwnedOperationUsingConsoleは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant confirmRuntimeOwnedOperationUsingConsoleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: confirmRuntimeOwnedOperationUsingConsoleはProcess内の同一Subsystemで完結する。
 * @security confirmRuntimeOwnedOperationUsingConsoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency confirmRuntimeOwnedOperationUsingConsoleは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
async function confirmRuntimeOwnedOperationUsingConsole(
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

/**
 * confirmRuntimeOwnedExternalSendUsingConsoleの処理を実行する。
 *
 * @responsibility confirmRuntimeOwnedExternalSendUsingConsoleに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input notice: string、challenge: string、cancellationSignal: AbortSignal
 * @returns confirmRuntimeOwnedExternalSendUsingConsoleの計算結果を返す。
 * @precondition 「notice: string、challenge: string、cancellationSignal: AbortSignal」がconfirmRuntimeOwnedExternalSendUsingConsoleの入力契約を満たす。
 * @postcondition confirmRuntimeOwnedExternalSendUsingConsoleの責務を完了した結果だけを返す。
 * @effect N/A: confirmRuntimeOwnedExternalSendUsingConsoleは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: confirmRuntimeOwnedExternalSendUsingConsoleは独自の失敗分岐を所有しない。
 * @invariant confirmRuntimeOwnedExternalSendUsingConsoleは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: confirmRuntimeOwnedExternalSendUsingConsoleはProcess内の同一Subsystemで完結する。
 * @security confirmRuntimeOwnedExternalSendUsingConsoleはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: confirmRuntimeOwnedExternalSendUsingConsoleは共有非同期状態を持たない同期処理である。
 */
export function confirmRuntimeOwnedExternalSendUsingConsole(
  notice: string,
  challenge: string,
  cancellationSignal: AbortSignal,
) {
  return confirmRuntimeOwnedOperationUsingConsole(
    notice,
    challenge,
    cancellationSignal,
  );
}

/**
 * createStateの処理を実行する。
 *
 * @responsibility createStateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input dependencies: RuntimeDependencies
 * @returns RuntimeStateを返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateStateの入力契約を満たす。
 * @postcondition createStateの責務を完了した結果だけを返す。
 * @effect N/A: createStateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createStateは独自の失敗分岐を所有しない。
 * @invariant createStateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createStateはProcess内の同一Subsystemで完結する。
 * @security createStateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createStateは共有非同期状態を持たない同期処理である。
 */
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

/**
 * requestGrantの処理を実行する。
 *
 * @responsibility requestGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、managementCapability: unknown、repositoryBindingCapability: unknown、policyCapability: unknown、rawScope: unknown、rawProviders: unknown、cancellationSignal: AbortSignal
 * @returns requestGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、managementCapability: unknown、repositoryBindingCapability: unknown、policyCapability: unknown、rawScope: unknown、rawProviders: unknown、cancellationSignal: AbortSignal」がrequestGrantの入力契約を満たす。
 * @postcondition requestGrantの責務を完了した結果だけを返す。
 * @effect N/A: requestGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure requestGrantは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant requestGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requestGrantはProcess内の同一Subsystemで完結する。
 * @security requestGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency requestGrantは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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
    const reusableConsent = state.dependencies.resolveConsent?.(
      policy,
      managementCapability,
    );
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
      runtimeExternalSendSemanticsId: EXTERNAL_SEND_RUNTIME_SEMANTICS_ID,
      derivedRemediationTransfer: DERIVED_REMEDIATION_TRANSFER,
      apiKeyFallbackAllowed: false,
      additionalPurchaseAllowed: false,
    });
    const currentOperationPreview = Object.freeze({
      repositoryRevision: repository.revision,
      requestedProviderDestinations: authorizedDestinations,
      taskPayload: scope,
      scopeHash,
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
        const persisted = state.dependencies.persistConsent(
          policy,
          managementCapability,
        );
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

/**
 * consumeGrantの処理を実行する。
 *
 * @responsibility consumeGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input state: RuntimeState、capability: unknown、managementCapability: unknown、repositoryBindingCapability: unknown、provider: unknown、taskRole: unknown、taskAttempt: unknown、rawScope: unknown
 * @returns consumeGrantの計算結果を返す。
 * @precondition 「state: RuntimeState、capability: unknown、managementCapability: unknown、repositoryBindingCapability: unknown、provider: unknown、taskRole: unknown、taskAttempt: unknown、rawScope: unknown」がconsumeGrantの入力契約を満たす。
 * @postcondition consumeGrantの責務を完了した結果だけを返す。
 * @effect N/A: consumeGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure consumeGrantは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant consumeGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeGrantはProcess内の同一Subsystemで完結する。
 * @security consumeGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeGrantは共有非同期状態を持たない同期処理である。
 */
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

/**
 * requestRuntimeOwnedExternalSendGrantの処理を実行する。
 *
 * @responsibility requestRuntimeOwnedExternalSendGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input managementCapability: unknown、repositoryBindingCapability: unknown、policyCapability: unknown、rawScope: unknown、rawProviders: unknown、cancellationSignal: AbortSignal
 * @returns requestRuntimeOwnedExternalSendGrantの計算結果を返す。
 * @precondition 「managementCapability: unknown、repositoryBindingCapability: unknown、policyCapability: unknown、rawScope: unknown、rawProviders: unknown、cancellationSignal: AbortSignal」がrequestRuntimeOwnedExternalSendGrantの入力契約を満たす。
 * @postcondition requestRuntimeOwnedExternalSendGrantの責務を完了した結果だけを返す。
 * @effect N/A: requestRuntimeOwnedExternalSendGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: requestRuntimeOwnedExternalSendGrantは独自の失敗分岐を所有しない。
 * @invariant requestRuntimeOwnedExternalSendGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: requestRuntimeOwnedExternalSendGrantはProcess内の同一Subsystemで完結する。
 * @security requestRuntimeOwnedExternalSendGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency requestRuntimeOwnedExternalSendGrantは非同期完了と失敗を一つの呼出しLifecycleへ収束させる。
 */
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

/**
 * consumeRuntimeOwnedExternalSendGrantの処理を実行する。
 *
 * @responsibility consumeRuntimeOwnedExternalSendGrantに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input capability: unknown、managementCapability: unknown、repositoryBindingCapability: unknown、provider: unknown、taskRole: unknown、taskAttempt: unknown、rawScope: unknown
 * @returns consumeRuntimeOwnedExternalSendGrantの計算結果を返す。
 * @precondition 「capability: unknown、managementCapability: unknown、repositoryBindingCapability: unknown、provider: unknown、taskRole: unknown、taskAttempt: unknown、rawScope: unknown」がconsumeRuntimeOwnedExternalSendGrantの入力契約を満たす。
 * @postcondition consumeRuntimeOwnedExternalSendGrantの責務を完了した結果だけを返す。
 * @effect N/A: consumeRuntimeOwnedExternalSendGrantは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: consumeRuntimeOwnedExternalSendGrantは独自の失敗分岐を所有しない。
 * @invariant consumeRuntimeOwnedExternalSendGrantは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: consumeRuntimeOwnedExternalSendGrantはProcess内の同一Subsystemで完結する。
 * @security consumeRuntimeOwnedExternalSendGrantはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: consumeRuntimeOwnedExternalSendGrantは共有非同期状態を持たない同期処理である。
 */
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

/**
 * createIsolatedExternalSendGrantRuntimeCandidateの処理を実行する。
 *
 * @responsibility createIsolatedExternalSendGrantRuntimeCandidateに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input dependencies: RuntimeDependencies
 * @returns createIsolatedExternalSendGrantRuntimeCandidateの計算結果を返す。
 * @precondition 「dependencies: RuntimeDependencies」がcreateIsolatedExternalSendGrantRuntimeCandidateの入力契約を満たす。
 * @postcondition createIsolatedExternalSendGrantRuntimeCandidateの責務を完了した結果だけを返す。
 * @effect N/A: createIsolatedExternalSendGrantRuntimeCandidateは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: createIsolatedExternalSendGrantRuntimeCandidateは独自の失敗分岐を所有しない。
 * @invariant createIsolatedExternalSendGrantRuntimeCandidateは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: createIsolatedExternalSendGrantRuntimeCandidateはProcess内の同一Subsystemで完結する。
 * @security createIsolatedExternalSendGrantRuntimeCandidateはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: createIsolatedExternalSendGrantRuntimeCandidateは共有非同期状態を持たない同期処理である。
 */
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

/**
 * describeExternalSendGrantRuntimeContractの処理を実行する。
 *
 * @responsibility describeExternalSendGrantRuntimeContractに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000015
 * @input N/A: 実行時引数を受け取らない。
 * @returns describeExternalSendGrantRuntimeContractの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がdescribeExternalSendGrantRuntimeContractの入力契約を満たす。
 * @postcondition describeExternalSendGrantRuntimeContractの責務を完了した結果だけを返す。
 * @effect N/A: describeExternalSendGrantRuntimeContractは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: describeExternalSendGrantRuntimeContractは独自の失敗分岐を所有しない。
 * @invariant describeExternalSendGrantRuntimeContractは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: describeExternalSendGrantRuntimeContractはProcess内の同一Subsystemで完結する。
 * @security describeExternalSendGrantRuntimeContractはAuthority、秘密値または信頼情報を責務外へ拡張・公開しない。
 * @concurrency N/A: describeExternalSendGrantRuntimeContractは共有非同期状態を持たない同期処理である。
 */
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
    reviewerMessageTextForwarded:
      "bounded_untrusted_defect_claim_after_recognized_secret_screening",
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

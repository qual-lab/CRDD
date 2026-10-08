/**
 * decision-portに属する責務をまとめる。
 *
 * @responsibility OrchestratorDecisionRecordを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * decision-portで使用するOrchestrator Decision 記録の値契約を定義する。
 *
 * @responsibility Orchestrator Decision 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorDecisionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorDecisionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorDecisionRecordの宣言は外部境界を開かない。
 * @security N/A: OrchestratorDecisionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorDecisionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorDecisionRecord = Readonly<{
  recordId: string;
  decisionId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  repositoryRevision: string;
  expectedGeneration: number;
  principalId: string;
  allowedOptions: readonly ("resume" | "cancel")[];
  capabilityHash: string;
  expiresAtEpochMs: number;
  disposition:
    | "pending"
    | "prepared"
    | "finalized"
    | "invalidated"
    | "expired"
    | "recovery_required";
  applicationId: string | null;
  selectedOption: "resume" | "cancel" | null;
  newGeneration: number | null;
  replacementRequestId: string | null;
}>;

/**
 * decision-portで使用するOrchestrator Decision Storeの値契約を定義する。
 *
 * @responsibility Orchestrator Decision StoreのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorDecisionStoreが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorDecisionStoreで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorDecisionStoreの宣言は外部境界を開かない。
 * @security N/A: OrchestratorDecisionStoreはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorDecisionStoreの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorDecisionStore = Readonly<{
  create: (record: OrchestratorDecisionRecord) => unknown;
  read: (recordId: string) => unknown;
  compareAndSet: (
    expected: OrchestratorDecisionRecord,
    next: OrchestratorDecisionRecord,
  ) => unknown;
}>;

/**
 * decision-portで使用するOrchestrator Decision 回復 Intentの値契約を定義する。
 *
 * @responsibility Orchestrator Decision 回復 IntentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorDecisionRecoveryIntentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorDecisionRecoveryIntentで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorDecisionRecoveryIntentの宣言は外部境界を開かない。
 * @security N/A: OrchestratorDecisionRecoveryIntentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorDecisionRecoveryIntentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorDecisionRecoveryIntent = Readonly<{
  recoveryId: string;
  recordId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  applicationId: string | null;
  expectedGeneration: number;
  newGeneration: number | null;
  observedDisposition: OrchestratorDecisionRecord["disposition"] | "unknown";
  unknownBoundary: string;
  disposition: "required" | "settled";
}>;

/**
 * decision-portで使用するOrchestrator Decision 回復 Storeの値契約を定義する。
 *
 * @responsibility Orchestrator Decision 回復 StoreのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorDecisionRecoveryStoreが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorDecisionRecoveryStoreで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorDecisionRecoveryStoreの宣言は外部境界を開かない。
 * @security N/A: OrchestratorDecisionRecoveryStoreはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorDecisionRecoveryStoreの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorDecisionRecoveryStore = Readonly<{
  create: (intent: OrchestratorDecisionRecoveryIntent) => unknown;
  read: (recoveryId: string) => unknown;
  compareAndSet: (
    expected: OrchestratorDecisionRecoveryIntent,
    next: OrchestratorDecisionRecoveryIntent,
  ) => unknown;
}>;

/**
 * decision-portで使用するOrchestrator Decision Portの値契約を定義する。
 *
 * @responsibility Orchestrator Decision PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape OrchestratorDecisionPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant OrchestratorDecisionPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: OrchestratorDecisionPortの宣言は外部境界を開かない。
 * @security N/A: OrchestratorDecisionPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility OrchestratorDecisionPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type OrchestratorDecisionPort = Readonly<{
  store: OrchestratorDecisionStore;
  recoveryStore?: OrchestratorDecisionRecoveryStore;
}>;

const ORCHESTRATOR_DECISION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const ORCHESTRATOR_DECISION_REVISION = /^[0-9a-f]{40,64}$/u;
const ORCHESTRATOR_DECISION_HASH = /^[0-9a-f]{64}$/u;
const orchestratorDecisionRecordKeys = [
  "allowedOptions",
  "applicationId",
  "capabilityHash",
  "decisionId",
  "disposition",
  "expectedGeneration",
  "expiresAtEpochMs",
  "milestoneId",
  "newGeneration",
  "principalId",
  "projectId",
  "queueId",
  "recordId",
  "replacementRequestId",
  "repositoryRevision",
  "selectedOption",
].sort();

/**
 * Decision Idかを判定する。
 *
 * @responsibility Decision Idの判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input value: unknown
 * @returns value is stringを返す。
 * @precondition 「value: unknown」がisDecisionIdの入力契約を満たす。
 * @postcondition isDecisionIdの責務を完了した結果だけを返す。
 * @effect N/A: isDecisionIdは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure N/A: isDecisionIdは独自の失敗分岐を所有しない。
 * @invariant isDecisionIdは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isDecisionIdはProcess内の同一Subsystemで完結する。
 * @security N/A: isDecisionIdはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isDecisionIdは共有非同期状態を持たない同期処理である。
 */
function isDecisionId(value: unknown): value is string {
  return typeof value === "string" && ORCHESTRATOR_DECISION_ID.test(value);
}

/**
 * Validate the canonical record before a persistence adapter accepts it.
 *
 * @responsibility Orchestrator Decision 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns raw is OrchestratorDecisionRecordを返す。
 * @precondition 「raw: unknown」がisOrchestratorDecisionRecordの入力契約を満たす。
 * @postcondition isOrchestratorDecisionRecordの責務を完了した結果だけを返す。
 * @effect N/A: isOrchestratorDecisionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isOrchestratorDecisionRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isOrchestratorDecisionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isOrchestratorDecisionRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: isOrchestratorDecisionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isOrchestratorDecisionRecordは共有非同期状態を持たない同期処理である。
 */
export function isOrchestratorDecisionRecord(
  raw: unknown,
): raw is OrchestratorDecisionRecord {
  try {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.getPrototypeOf(raw) !== Object.prototype ||
      Object.getOwnPropertySymbols(raw).length !== 0 ||
      Object.getOwnPropertyNames(raw).sort().join("\0") !==
        orchestratorDecisionRecordKeys.join("\0") ||
      Object.values(Object.getOwnPropertyDescriptors(raw)).some(
        (descriptor) => descriptor.get || descriptor.set,
      )
    )
      return false;
    const value = raw as OrchestratorDecisionRecord;
    return (
      isDecisionId(value.recordId) &&
      isDecisionId(value.decisionId) &&
      isDecisionId(value.projectId) &&
      isDecisionId(value.milestoneId) &&
      isDecisionId(value.queueId) &&
      ORCHESTRATOR_DECISION_REVISION.test(value.repositoryRevision) &&
      Number.isSafeInteger(value.expectedGeneration) &&
      value.expectedGeneration >= 1 &&
      isDecisionId(value.principalId) &&
      Array.isArray(value.allowedOptions) &&
      value.allowedOptions.length > 0 &&
      value.allowedOptions.every(
        (option) => option === "resume" || option === "cancel",
      ) &&
      ORCHESTRATOR_DECISION_HASH.test(value.capabilityHash) &&
      Number.isSafeInteger(value.expiresAtEpochMs) &&
      [
        "pending",
        "prepared",
        "finalized",
        "invalidated",
        "expired",
        "recovery_required",
      ].includes(value.disposition) &&
      (value.applicationId === null || isDecisionId(value.applicationId)) &&
      (value.selectedOption === null ||
        value.selectedOption === "resume" ||
        value.selectedOption === "cancel") &&
      (value.newGeneration === null ||
        (Number.isSafeInteger(value.newGeneration) &&
          value.newGeneration >= 2)) &&
      (value.replacementRequestId === null ||
        isDecisionId(value.replacementRequestId))
    );
  } catch {
    return false;
  }
}

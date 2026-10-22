/**
 * decision-portに属する責務をまとめる。
 *
 * @responsibility CoordinatorDecisionRecordを中心とする実装、型および境界を同じModuleで所有する。
 * @trace ARCH-000004
 */
/**
 * decision-portで使用するCoordinator Decision 記録の値契約を定義する。
 *
 * @responsibility Coordinator Decision 記録のProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionRecordの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionRecord = Readonly<{
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
 * decision-portで使用するCoordinator Decision Storeの値契約を定義する。
 *
 * @responsibility Coordinator Decision StoreのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionStoreが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionStoreで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionStoreの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionStoreはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionStoreの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionStore = Readonly<{
  create: (record: CoordinatorDecisionRecord) => unknown;
  read: (recordId: string) => unknown;
  compareAndSet: (
    expected: CoordinatorDecisionRecord,
    next: CoordinatorDecisionRecord,
  ) => unknown;
}>;

/**
 * decision-portで使用するCoordinator Decision 回復 Intentの値契約を定義する。
 *
 * @responsibility Coordinator Decision 回復 IntentのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionRecoveryIntentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionRecoveryIntentで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionRecoveryIntentの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionRecoveryIntentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionRecoveryIntentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionRecoveryIntent = Readonly<{
  recoveryId: string;
  recordId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  applicationId: string | null;
  expectedGeneration: number;
  newGeneration: number | null;
  observedDisposition: CoordinatorDecisionRecord["disposition"] | "unknown";
  unknownBoundary: string;
  disposition: "required" | "settled";
}>;

/**
 * decision-portで使用するCoordinator Decision 回復 Storeの値契約を定義する。
 *
 * @responsibility Coordinator Decision 回復 StoreのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionRecoveryStoreが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionRecoveryStoreで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionRecoveryStoreの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionRecoveryStoreはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionRecoveryStoreの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionRecoveryStore = Readonly<{
  create: (intent: CoordinatorDecisionRecoveryIntent) => unknown;
  read: (recoveryId: string) => unknown;
  compareAndSet: (
    expected: CoordinatorDecisionRecoveryIntent,
    next: CoordinatorDecisionRecoveryIntent,
  ) => unknown;
}>;

/**
 * decision-portで使用するCoordinator Decision Portの値契約を定義する。
 *
 * @responsibility Coordinator Decision PortのProperty、Identity、状態制約を型境界として所有する。
 * @trace ARCH-000004
 * @shape CoordinatorDecisionPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant CoordinatorDecisionPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: CoordinatorDecisionPortの宣言は外部境界を開かない。
 * @security N/A: CoordinatorDecisionPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility CoordinatorDecisionPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type CoordinatorDecisionPort = Readonly<{
  store: CoordinatorDecisionStore;
  recoveryStore?: CoordinatorDecisionRecoveryStore;
}>;

const COORDINATOR_DECISION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const COORDINATOR_DECISION_REVISION = /^[0-9a-f]{40,64}$/u;
const COORDINATOR_DECISION_HASH = /^[0-9a-f]{64}$/u;
const decisionRecordKeys = [
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
  return typeof value === "string" && COORDINATOR_DECISION_ID.test(value);
}

/**
 * Validate the canonical record before a persistence adapter accepts it.
 *
 * @responsibility Coordinator Decision 記録の判定条件とtrue／false境界を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns raw is CoordinatorDecisionRecordを返す。
 * @precondition 「raw: unknown」がisCoordinatorDecisionRecordの入力契約を満たす。
 * @postcondition isCoordinatorDecisionRecordの責務を完了した結果だけを返す。
 * @effect N/A: isCoordinatorDecisionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isCoordinatorDecisionRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isCoordinatorDecisionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isCoordinatorDecisionRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: isCoordinatorDecisionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isCoordinatorDecisionRecordは共有非同期状態を持たない同期処理である。
 */
export function isCoordinatorDecisionRecord(
  raw: unknown,
): raw is CoordinatorDecisionRecord {
  try {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.getPrototypeOf(raw) !== Object.prototype ||
      Object.getOwnPropertySymbols(raw).length !== 0 ||
      Object.getOwnPropertyNames(raw).sort().join("\0") !==
        decisionRecordKeys.join("\0") ||
      Object.values(Object.getOwnPropertyDescriptors(raw)).some(
        (descriptor) => descriptor.get || descriptor.set,
      )
    )
      return false;
    const value = raw as CoordinatorDecisionRecord;
    return (
      isDecisionId(value.recordId) &&
      isDecisionId(value.decisionId) &&
      isDecisionId(value.projectId) &&
      isDecisionId(value.milestoneId) &&
      isDecisionId(value.queueId) &&
      COORDINATOR_DECISION_REVISION.test(value.repositoryRevision) &&
      Number.isSafeInteger(value.expectedGeneration) &&
      value.expectedGeneration >= 1 &&
      isDecisionId(value.principalId) &&
      Array.isArray(value.allowedOptions) &&
      value.allowedOptions.length > 0 &&
      value.allowedOptions.every(
        (option) => option === "resume" || option === "cancel",
      ) &&
      COORDINATOR_DECISION_HASH.test(value.capabilityHash) &&
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

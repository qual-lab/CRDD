/**
 * ProjectRuntimeDecisionRecordが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeDecisionRecordに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeDecisionRecordが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeDecisionRecordで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeDecisionRecordの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeDecisionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeDecisionRecordの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeDecisionRecord = Readonly<{
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
 * ProjectRuntimeDecisionStoreが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeDecisionStoreに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeDecisionStoreが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeDecisionStoreで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeDecisionStoreの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeDecisionStoreはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeDecisionStoreの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeDecisionStore = Readonly<{
  create: (record: ProjectRuntimeDecisionRecord) => unknown;
  read: (recordId: string) => unknown;
  compareAndSet: (
    expected: ProjectRuntimeDecisionRecord,
    next: ProjectRuntimeDecisionRecord,
  ) => unknown;
}>;

/**
 * ProjectRuntimeDecisionRecoveryIntentが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeDecisionRecoveryIntentに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeDecisionRecoveryIntentが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeDecisionRecoveryIntentで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeDecisionRecoveryIntentの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeDecisionRecoveryIntentはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeDecisionRecoveryIntentの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeDecisionRecoveryIntent = Readonly<{
  recoveryId: string;
  recordId: string;
  projectId: string;
  milestoneId: string;
  queueId: string;
  applicationId: string | null;
  expectedGeneration: number;
  newGeneration: number | null;
  observedDisposition: ProjectRuntimeDecisionRecord["disposition"] | "unknown";
  unknownBoundary: string;
  disposition: "required" | "settled";
}>;

/**
 * ProjectRuntimeDecisionRecoveryStoreが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeDecisionRecoveryStoreに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeDecisionRecoveryStoreが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeDecisionRecoveryStoreで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeDecisionRecoveryStoreの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeDecisionRecoveryStoreはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeDecisionRecoveryStoreの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeDecisionRecoveryStore = Readonly<{
  create: (intent: ProjectRuntimeDecisionRecoveryIntent) => unknown;
  read: (recoveryId: string) => unknown;
  compareAndSet: (
    expected: ProjectRuntimeDecisionRecoveryIntent,
    next: ProjectRuntimeDecisionRecoveryIntent,
  ) => unknown;
}>;

/**
 * ProjectRuntimeDecisionPortが扱う値の構造を表す。
 *
 * @responsibility ProjectRuntimeDecisionPortに必要な値と制約を一つの型契約として保持する。
 * @trace ARCH-000004
 * @shape ProjectRuntimeDecisionPortが表すProperty、識別子およびRelationを型として固定する。
 * @invariant ProjectRuntimeDecisionPortで宣言した値と責務の対応を維持する。
 * @boundary N/A: ProjectRuntimeDecisionPortの宣言は外部境界を開かない。
 * @security N/A: ProjectRuntimeDecisionPortはAuthority、秘密値または信頼判断を扱わない。
 * @compatibility ProjectRuntimeDecisionPortの利用側は宣言済みPropertyと型制約だけへ依存する。
 */
export type ProjectRuntimeDecisionPort = Readonly<{
  store: ProjectRuntimeDecisionStore;
  recoveryStore?: ProjectRuntimeDecisionRecoveryStore;
}>;

const PROJECT_RUNTIME_DECISION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const PROJECT_RUNTIME_DECISION_REVISION = /^[0-9a-f]{40,64}$/u;
const PROJECT_RUNTIME_DECISION_HASH = /^[0-9a-f]{64}$/u;
const projectRuntimeDecisionRecordKeys = [
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
 * isDecisionIdの処理を実行する。
 *
 * @responsibility isDecisionIdに対応する入力処理と結果生成を所有する。
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
  return typeof value === "string" && PROJECT_RUNTIME_DECISION_ID.test(value);
}

/**
 * Validate the canonical record before a persistence adapter accepts it.
 *
 * @responsibility isProjectRuntimeDecisionRecordに対応する入力処理と結果生成を所有する。
 * @trace ARCH-000004
 * @input raw: unknown
 * @returns raw is ProjectRuntimeDecisionRecordを返す。
 * @precondition 「raw: unknown」がisProjectRuntimeDecisionRecordの入力契約を満たす。
 * @postcondition isProjectRuntimeDecisionRecordの責務を完了した結果だけを返す。
 * @effect N/A: isProjectRuntimeDecisionRecordは入力と局所値だけを扱い、外部または共有Effectを発行しない。
 * @failure isProjectRuntimeDecisionRecordは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant isProjectRuntimeDecisionRecordは入力から導いた結果以外の共有状態を変更しない。
 * @boundary N/A: isProjectRuntimeDecisionRecordはProcess内の同一Subsystemで完結する。
 * @security N/A: isProjectRuntimeDecisionRecordはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: isProjectRuntimeDecisionRecordは共有非同期状態を持たない同期処理である。
 */
export function isProjectRuntimeDecisionRecord(
  raw: unknown,
): raw is ProjectRuntimeDecisionRecord {
  try {
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      Object.getPrototypeOf(raw) !== Object.prototype ||
      Object.getOwnPropertySymbols(raw).length !== 0 ||
      Object.getOwnPropertyNames(raw).sort().join("\0") !==
        projectRuntimeDecisionRecordKeys.join("\0") ||
      Object.values(Object.getOwnPropertyDescriptors(raw)).some(
        (descriptor) => descriptor.get || descriptor.set,
      )
    )
      return false;
    const value = raw as ProjectRuntimeDecisionRecord;
    return (
      isDecisionId(value.recordId) &&
      isDecisionId(value.decisionId) &&
      isDecisionId(value.projectId) &&
      isDecisionId(value.milestoneId) &&
      isDecisionId(value.queueId) &&
      PROJECT_RUNTIME_DECISION_REVISION.test(value.repositoryRevision) &&
      Number.isSafeInteger(value.expectedGeneration) &&
      value.expectedGeneration >= 1 &&
      isDecisionId(value.principalId) &&
      Array.isArray(value.allowedOptions) &&
      value.allowedOptions.length > 0 &&
      value.allowedOptions.every(
        (option) => option === "resume" || option === "cancel",
      ) &&
      PROJECT_RUNTIME_DECISION_HASH.test(value.capabilityHash) &&
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

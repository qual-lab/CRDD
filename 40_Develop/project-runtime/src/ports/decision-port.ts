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

export type ProjectRuntimeDecisionStore = Readonly<{
  create: (record: ProjectRuntimeDecisionRecord) => unknown;
  read: (recordId: string) => unknown;
  compareAndSet: (
    expected: ProjectRuntimeDecisionRecord,
    next: ProjectRuntimeDecisionRecord,
  ) => unknown;
}>;

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

export type ProjectRuntimeDecisionRecoveryStore = Readonly<{
  create: (intent: ProjectRuntimeDecisionRecoveryIntent) => unknown;
  read: (recoveryId: string) => unknown;
  compareAndSet: (
    expected: ProjectRuntimeDecisionRecoveryIntent,
    next: ProjectRuntimeDecisionRecoveryIntent,
  ) => unknown;
}>;

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

function isDecisionId(value: unknown): value is string {
  return typeof value === "string" && PROJECT_RUNTIME_DECISION_ID.test(value);
}

/** Validate the canonical record before a persistence adapter accepts it. */
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

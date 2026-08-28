const TRACE_SCHEMA = "crdd-coordinator/runtime-traceability";
const TRACE_SCHEMA_REVISION = 1;
const VERIFICATION_KINDS = Object.freeze([
  "normal",
  "quasi_normal",
  "abnormal",
] as const);

type VerificationKind = (typeof VERIFICATION_KINDS)[number];
type TextReader = (repositoryRelativePath: string) => string | null;

type AcceptedInspection = Readonly<{
  status: "accepted";
  resources: number;
  states: number;
  transitions: number;
  invariants: number;
  verificationBindings: number;
}>;

type BlockedInspection = Readonly<{
  status: "blocked";
  reason: "runtime_traceability_invalid";
  issues: readonly string[];
}>;

export type RuntimeTraceabilityInspection =
  | AcceptedInspection
  | BlockedInspection;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((entry) => typeof entry === "string")
  );
}

function addUniqueIds(
  population: unknown,
  label: string,
  prefix: string,
  issues: string[],
): { entries: JsonRecord[]; ids: Set<string> } {
  if (!Array.isArray(population)) {
    issues.push(`${label}_population_invalid`);
    return { entries: [], ids: new Set() };
  }
  const entries: JsonRecord[] = [];
  const ids = new Set<string>();
  for (const candidate of population) {
    if (!isRecord(candidate) || typeof candidate.id !== "string") {
      issues.push(`${label}_entry_invalid`);
      continue;
    }
    if (!candidate.id.startsWith(prefix))
      issues.push(`${label}_id_invalid:${candidate.id}`);
    if (ids.has(candidate.id))
      issues.push(`${label}_id_duplicate:${candidate.id}`);
    ids.add(candidate.id);
    entries.push(candidate);
  }
  return { entries, ids };
}

function checkReferences(
  values: unknown,
  known: ReadonlySet<string>,
  label: string,
  issues: string[],
): string[] {
  if (!isStringArray(values)) {
    issues.push(`${label}_invalid`);
    return [];
  }
  for (const value of values) {
    if (!known.has(value)) issues.push(`${label}_unknown:${value}`);
  }
  return values;
}

function isSafeRepositoryPath(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 512 &&
    !value.includes("\\") &&
    !value.startsWith("/") &&
    !value.includes("\0") &&
    value
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function quotedTestNameExists(source: string, testName: string): boolean {
  const doubleQuoted = JSON.stringify(testName);
  const singleQuoted = `'${testName.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;
  return (
    source.includes(`test(${doubleQuoted}`) ||
    source.includes(`test(${singleQuoted}`)
  );
}

export function inspectCoordinatorRuntimeTraceability(
  input: unknown,
  readRepositoryText: TextReader,
): RuntimeTraceabilityInspection {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return {
      status: "blocked",
      reason: "runtime_traceability_invalid",
      issues: ["trace_root_invalid"],
    };
  }
  if (input.schema !== TRACE_SCHEMA) issues.push("trace_schema_invalid");
  if (input.schemaRevision !== TRACE_SCHEMA_REVISION)
    issues.push("trace_schema_revision_invalid");

  const resources = addUniqueIds(input.resources, "resource", "RES-", issues);
  const states = addUniqueIds(input.states, "state", "STATE-", issues);
  const transitions = addUniqueIds(
    input.transitions,
    "transition",
    "TRANS-",
    issues,
  );
  const invariants = addUniqueIds(
    input.invariants,
    "invariant",
    "INV-",
    issues,
  );
  const bindings = addUniqueIds(
    input.verificationBindings,
    "verification",
    "VER-",
    issues,
  );

  const usedResources = new Set<string>();
  const usedStates = new Set<string>();
  const usedInvariants = new Set<string>();
  const requiredKindsByTransition = new Map<string, Set<VerificationKind>>();
  for (const transition of transitions.entries) {
    const transitionId =
      typeof transition.id === "string" ? transition.id : "unknown";
    for (const state of checkReferences(
      transition.from,
      states.ids,
      `${transitionId}:from`,
      issues,
    )) {
      usedStates.add(state);
    }
    if (typeof transition.to !== "string" || !states.ids.has(transition.to)) {
      issues.push(`${transitionId}:to_unknown`);
    } else {
      usedStates.add(transition.to);
    }
    for (const field of [
      "resourcesAcquired",
      "resourcesReleased",
      "resourcesTransferred",
    ] as const) {
      for (const resource of checkReferences(
        transition[field],
        resources.ids,
        `${transitionId}:${field}`,
        issues,
      )) {
        usedResources.add(resource);
      }
    }
    for (const invariant of checkReferences(
      transition.invariants,
      invariants.ids,
      `${transitionId}:invariants`,
      issues,
    )) {
      usedInvariants.add(invariant);
    }
    if (transition.risk === "high") {
      const required = checkReferences(
        transition.requiredVerificationKinds,
        new Set(VERIFICATION_KINDS),
        `${transitionId}:requiredVerificationKinds`,
        issues,
      );
      if (required.length === 0)
        issues.push(`${transitionId}:verification_requirement_empty`);
      requiredKindsByTransition.set(
        transitionId,
        new Set(required as VerificationKind[]),
      );
    }
  }

  const observedKindsByTransition = new Map<string, Set<VerificationKind>>();
  for (const binding of bindings.entries) {
    const bindingId = typeof binding.id === "string" ? binding.id : "unknown";
    const kind = binding.kind;
    if (!VERIFICATION_KINDS.includes(kind as VerificationKind)) {
      issues.push(`${bindingId}:kind_invalid`);
      continue;
    }
    const transitionIds = checkReferences(
      binding.transitionIds,
      transitions.ids,
      `${bindingId}:transitionIds`,
      issues,
    );
    if (transitionIds.length === 0)
      issues.push(`${bindingId}:transition_population_empty`);
    for (const transitionId of transitionIds) {
      const observed =
        observedKindsByTransition.get(transitionId) ??
        new Set<VerificationKind>();
      observed.add(kind as VerificationKind);
      observedKindsByTransition.set(transitionId, observed);
    }
    for (const resource of checkReferences(
      binding.observedResources,
      resources.ids,
      `${bindingId}:observedResources`,
      issues,
    )) {
      usedResources.add(resource);
    }
    if (
      typeof binding.testPath !== "string" ||
      !isSafeRepositoryPath(binding.testPath)
    ) {
      issues.push(`${bindingId}:test_path_invalid`);
      continue;
    }
    if (typeof binding.testName !== "string" || binding.testName.length === 0) {
      issues.push(`${bindingId}:test_name_invalid`);
      continue;
    }
    const testSource = readRepositoryText(binding.testPath);
    if (testSource === null)
      issues.push(`${bindingId}:test_source_unavailable`);
    else if (!quotedTestNameExists(testSource, binding.testName)) {
      issues.push(`${bindingId}:test_name_not_found`);
    }
  }

  for (const [transitionId, requiredKinds] of requiredKindsByTransition) {
    const observedKinds =
      observedKindsByTransition.get(transitionId) ??
      new Set<VerificationKind>();
    for (const requiredKind of requiredKinds) {
      if (!observedKinds.has(requiredKind)) {
        issues.push(`${transitionId}:verification_missing:${requiredKind}`);
      }
    }
  }
  for (const resourceId of resources.ids) {
    if (!usedResources.has(resourceId))
      issues.push(`resource_orphan:${resourceId}`);
  }
  for (const stateId of states.ids) {
    if (!usedStates.has(stateId)) issues.push(`state_orphan:${stateId}`);
  }
  for (const invariantId of invariants.ids) {
    if (!usedInvariants.has(invariantId))
      issues.push(`invariant_orphan:${invariantId}`);
  }

  if (
    typeof input.architectureDocument !== "string" ||
    !isSafeRepositoryPath(input.architectureDocument)
  ) {
    issues.push("architecture_document_invalid");
  } else {
    const architecture = readRepositoryText(input.architectureDocument);
    if (architecture === null) issues.push("architecture_document_unavailable");
    else {
      for (const id of [
        ...resources.ids,
        ...states.ids,
        ...transitions.ids,
        ...invariants.ids,
      ]) {
        if (!architecture.includes(`\`${id}\``))
          issues.push(`architecture_id_missing:${id}`);
      }
    }
  }

  const uniqueIssues = [...new Set(issues)].sort();
  if (uniqueIssues.length > 0) {
    return {
      status: "blocked",
      reason: "runtime_traceability_invalid",
      issues: uniqueIssues,
    };
  }
  return {
    status: "accepted",
    resources: resources.ids.size,
    states: states.ids.size,
    transitions: transitions.ids.size,
    invariants: invariants.ids.size,
    verificationBindings: bindings.ids.size,
  };
}

const TRACE_SCHEMA = "crdd-coordinator/runtime-traceability";
const TRACE_SCHEMA_REVISION = 4;
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

const ROOT_KEYS = Object.freeze([
  "schema",
  "schemaRevision",
  "architectureDocument",
  "resources",
  "states",
  "transitions",
  "invariants",
  "verificationBoundaryByBinding",
  "verificationBindings",
]);
const RESOURCE_KEYS = Object.freeze(["id", "owner", "kind", "lifecycle"]);
const STATE_KEYS = Object.freeze([
  "id",
  "scope",
  "invocationTerminal",
  "operationTerminal",
  "description",
]);
const TRANSITION_KEYS = Object.freeze([
  "id",
  "from",
  "to",
  "invocation",
  "risk",
  "requiredVerificationKinds",
  "resourcesAcquired",
  "resourcesReleased",
  "resourcesTransferred",
  "invariants",
]);
const INVARIANT_KEYS = Object.freeze(["id", "statement"]);
const BINDING_KEYS = Object.freeze([
  "id",
  "transitionIds",
  "kind",
  "testPath",
  "testName",
  "observedResources",
  "cases",
]);
const CASE_KEYS = Object.freeze([
  "id",
  "transitionId",
  "fromState",
  "outcome",
  "expectedEndState",
  "effectObservations",
  "expectedStatus",
  "resourcePostconditions",
]);
const EFFECT_OBSERVATION_KEYS = Object.freeze(["provider", "host", "cleanup"]);
const EXPECTED_STATUSES = new Set([
  "authorized",
  "blocked",
  "completed",
  "recovery_required",
  "staged",
]);
const RESOURCE_POSTCONDITIONS = new Set([
  "absent",
  "present",
  "preserved",
  "transferred",
  "unacquired",
]);
const EVIDENCE_BOUNDARIES = new Set([
  "contract_projection",
  "actual_filesystem_process",
  "public_cli",
  "signed_e2e",
]);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: JsonRecord, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
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
  if (!hasExactKeys(input, ROOT_KEYS)) issues.push("trace_root_shape_invalid");
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

  for (const resource of resources.entries) {
    const id = typeof resource.id === "string" ? resource.id : "unknown";
    if (
      !hasExactKeys(resource, RESOURCE_KEYS) ||
      !nonEmptyText(resource.owner) ||
      !nonEmptyText(resource.kind) ||
      !nonEmptyText(resource.lifecycle)
    )
      issues.push(`${id}:resource_shape_invalid`);
  }
  const statesById = new Map<string, JsonRecord>();
  for (const state of states.entries) {
    const id = typeof state.id === "string" ? state.id : "unknown";
    if (
      !hasExactKeys(state, STATE_KEYS) ||
      (state.scope !== "task" &&
        state.scope !== "stage" &&
        state.scope !== "recovery") ||
      typeof state.invocationTerminal !== "boolean" ||
      typeof state.operationTerminal !== "boolean" ||
      !nonEmptyText(state.description)
    )
      issues.push(`${id}:state_shape_invalid`);
    if (typeof state.id === "string") statesById.set(state.id, state);
  }
  for (const invariant of invariants.entries) {
    const id = typeof invariant.id === "string" ? invariant.id : "unknown";
    if (
      !hasExactKeys(invariant, INVARIANT_KEYS) ||
      !nonEmptyText(invariant.statement)
    )
      issues.push(`${id}:invariant_shape_invalid`);
  }
  if (!isRecord(input.verificationBoundaryByBinding)) {
    issues.push("verification_boundary_population_invalid");
  } else {
    const boundaryIds = Object.keys(input.verificationBoundaryByBinding).sort();
    const bindingIds = [...bindings.ids].sort();
    if (
      boundaryIds.length !== bindingIds.length ||
      boundaryIds.some((id, index) => id !== bindingIds[index])
    )
      issues.push("verification_boundary_population_mismatch");
    for (const [id, boundary] of Object.entries(
      input.verificationBoundaryByBinding,
    )) {
      if (!EVIDENCE_BOUNDARIES.has(String(boundary)))
        issues.push(`${id}:verification_boundary_invalid`);
    }
  }

  const usedResources = new Set<string>();
  const usedStates = new Set<string>();
  const usedInvariants = new Set<string>();
  const requiredKindsByTransition = new Map<string, Set<VerificationKind>>();
  const transitionsById = new Map<string, JsonRecord>();
  for (const transition of transitions.entries) {
    const transitionId =
      typeof transition.id === "string" ? transition.id : "unknown";
    transitionsById.set(transitionId, transition);
    if (
      !hasExactKeys(transition, TRANSITION_KEYS) ||
      (transition.invocation !== "same" &&
        transition.invocation !== "recovery") ||
      transition.risk !== "high"
    )
      issues.push(`${transitionId}:transition_shape_invalid`);
    for (const state of checkReferences(
      transition.from,
      states.ids,
      `${transitionId}:from`,
      issues,
    )) {
      usedStates.add(state);
      const stateDefinition = statesById.get(state);
      if (stateDefinition?.operationTerminal === true)
        issues.push(`${transitionId}:from_operation_terminal:${state}`);
      if (
        stateDefinition?.invocationTerminal === true &&
        transition.invocation === "same"
      )
        issues.push(`${transitionId}:same_invocation_from_terminal:${state}`);
      if (
        transition.invocation === "recovery" &&
        (stateDefinition?.invocationTerminal !== true ||
          stateDefinition?.operationTerminal !== false)
      )
        issues.push(`${transitionId}:recovery_from_nonrecoverable:${state}`);
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
    const released = new Set(
      isStringArray(transition.resourcesReleased)
        ? transition.resourcesReleased
        : [],
    );
    if (
      isStringArray(transition.resourcesTransferred) &&
      transition.resourcesTransferred.some((resource) => released.has(resource))
    )
      issues.push(`${transitionId}:resource_release_transfer_overlap`);
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
  const observedKindsByTransitionAndState = new Map<
    string,
    Set<VerificationKind>
  >();
  const observedCaseTuples = new Set<string>();
  const caseIds = new Set<string>();
  for (const binding of bindings.entries) {
    const bindingId = typeof binding.id === "string" ? binding.id : "unknown";
    if (!hasExactKeys(binding, BINDING_KEYS))
      issues.push(`${bindingId}:verification_shape_invalid`);
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
    if (!Array.isArray(binding.cases) || binding.cases.length === 0) {
      issues.push(`${bindingId}:case_population_invalid`);
    } else {
      const caseTransitions = new Set<string>();
      for (const candidate of binding.cases) {
        if (!isRecord(candidate) || !hasExactKeys(candidate, CASE_KEYS)) {
          issues.push(`${bindingId}:case_shape_invalid`);
          continue;
        }
        if (
          typeof candidate.id !== "string" ||
          !candidate.id.startsWith("CASE-") ||
          caseIds.has(candidate.id)
        )
          issues.push(`${bindingId}:case_id_invalid_or_duplicate`);
        else caseIds.add(candidate.id);
        const transitionId = candidate.transitionId;
        if (
          typeof transitionId !== "string" ||
          !transitionIds.includes(transitionId)
        ) {
          issues.push(`${bindingId}:case_transition_invalid`);
          continue;
        }
        caseTransitions.add(transitionId);
        const transition = transitionsById.get(transitionId);
        const declaredFrom = new Set(
          isStringArray(transition?.from) ? transition.from : [],
        );
        const fromState = candidate.fromState;
        if (typeof fromState !== "string" || !states.ids.has(fromState))
          issues.push(`${bindingId}:case_from_state_invalid`);
        if (typeof fromState !== "string" || !declaredFrom.has(fromState))
          issues.push(`${bindingId}:case_from_state_mismatch:${transitionId}`);
        if (candidate.outcome !== "taken" && candidate.outcome !== "rejected")
          issues.push(`${bindingId}:case_outcome_invalid:${transitionId}`);
        const endState = candidate.expectedEndState;
        if (typeof endState !== "string" || !states.ids.has(endState))
          issues.push(`${bindingId}:case_end_state_invalid:${transitionId}`);
        if (candidate.outcome === "taken" && endState !== transition?.to)
          issues.push(
            `${bindingId}:case_taken_end_state_mismatch:${transitionId}`,
          );
        if (candidate.outcome === "rejected" && endState === transition?.to)
          issues.push(`${bindingId}:case_rejected_reaches_to:${transitionId}`);
        if (
          !isRecord(candidate.effectObservations) ||
          !hasExactKeys(
            candidate.effectObservations,
            EFFECT_OBSERVATION_KEYS,
          ) ||
          Object.values(candidate.effectObservations).some(
            (count) =>
              typeof count !== "number" ||
              !Number.isSafeInteger(count) ||
              count < 0 ||
              count > 4,
          )
        )
          issues.push(
            `${bindingId}:case_effect_observation_invalid:${transitionId}`,
          );
        if (!EXPECTED_STATUSES.has(String(candidate.expectedStatus)))
          issues.push(`${bindingId}:case_status_invalid:${transitionId}`);
        if (!isRecord(candidate.resourcePostconditions)) {
          issues.push(`${bindingId}:case_resource_postconditions_invalid`);
        } else {
          const transitionResources = new Set([
            ...(isStringArray(transition?.resourcesAcquired)
              ? transition.resourcesAcquired
              : []),
            ...(isStringArray(transition?.resourcesReleased)
              ? transition.resourcesReleased
              : []),
            ...(isStringArray(transition?.resourcesTransferred)
              ? transition.resourcesTransferred
              : []),
          ]);
          for (const [resource, postcondition] of Object.entries(
            candidate.resourcePostconditions,
          )) {
            if (!transitionResources.has(resource))
              issues.push(
                `${bindingId}:case_resource_not_on_transition:${resource}`,
              );
            if (!RESOURCE_POSTCONDITIONS.has(String(postcondition)))
              issues.push(
                `${bindingId}:case_resource_postcondition_invalid:${resource}`,
              );
            if (
              !isStringArray(binding.observedResources) ||
              !binding.observedResources.includes(resource)
            )
              issues.push(
                `${bindingId}:case_resource_not_observed:${resource}`,
              );
          }
        }
        if (typeof fromState === "string") {
          const key = `${transitionId}\u0000${fromState}`;
          const tuple = `${key}\u0000${kind}`;
          if (observedCaseTuples.has(tuple))
            issues.push(
              `${bindingId}:case_tuple_duplicate:${transitionId}:${fromState}:${kind}`,
            );
          else observedCaseTuples.add(tuple);
          const observed =
            observedKindsByTransitionAndState.get(key) ??
            new Set<VerificationKind>();
          observed.add(kind as VerificationKind);
          observedKindsByTransitionAndState.set(key, observed);
        }
      }
      if (
        transitionIds.some((transitionId) => !caseTransitions.has(transitionId))
      )
        issues.push(`${bindingId}:case_transition_population_incomplete`);
    }
    for (const resource of checkReferences(
      binding.observedResources,
      resources.ids,
      `${bindingId}:observedResources`,
      issues,
    )) {
      usedResources.add(resource);
      const transitionResources = new Set(
        transitionIds.flatMap((transitionId) => {
          const transition = transitionsById.get(transitionId);
          return [
            ...(isStringArray(transition?.resourcesAcquired)
              ? transition.resourcesAcquired
              : []),
            ...(isStringArray(transition?.resourcesReleased)
              ? transition.resourcesReleased
              : []),
            ...(isStringArray(transition?.resourcesTransferred)
              ? transition.resourcesTransferred
              : []),
          ];
        }),
      );
      if (!transitionResources.has(resource))
        issues.push(
          `${bindingId}:observed_resource_not_on_transition:${resource}`,
        );
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
    } else if (
      Array.isArray(binding.cases) &&
      binding.cases.some(
        (candidate) =>
          isRecord(candidate) &&
          typeof candidate.id === "string" &&
          !testSource.includes(JSON.stringify(candidate.id)),
      )
    ) {
      issues.push(`${bindingId}:test_case_id_not_found`);
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
      const transition = transitionsById.get(transitionId);
      for (const fromState of isStringArray(transition?.from)
        ? transition.from
        : []) {
        const stateKinds =
          observedKindsByTransitionAndState.get(
            `${transitionId}\u0000${fromState}`,
          ) ?? new Set<VerificationKind>();
        if (!stateKinds.has(requiredKind))
          issues.push(
            `${transitionId}:verification_case_missing:${fromState}:${requiredKind}`,
          );
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

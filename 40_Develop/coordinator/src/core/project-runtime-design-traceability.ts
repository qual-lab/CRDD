const TRACE_SCHEMA = "crdd-coordinator/project-runtime-design-traceability";
const TRACE_SCHEMA_REVISION = 1;

type JsonRecord = Record<string, unknown>;
type TextReader = (repositoryRelativePath: string) => string | null;

export type ProjectRuntimeDesignTraceabilityInspection =
  | Readonly<{
      status: "accepted";
      interfaces: number;
      persistentRecords: number;
      resources: number;
      locks: number;
      authorities: number;
      effects: number;
      stateMachines: number;
      transitions: number;
      actionBindings: number;
      invariants: number;
      failureInjections: number;
      implementationBindings: number;
      verificationBindings: number;
    }>
  | Readonly<{
      status: "blocked";
      reason: "project_runtime_design_traceability_invalid";
      issues: readonly string[];
    }>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function strings(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function population(
  value: unknown,
  label: string,
  prefix: string,
  issues: string[],
) {
  const entries: JsonRecord[] = [];
  const ids = new Set<string>();
  if (!Array.isArray(value)) {
    issues.push(`${label}_population_invalid`);
    return { entries, ids };
  }
  for (const item of value) {
    if (!isRecord(item) || !text(item.id) || !item.id.startsWith(prefix)) {
      issues.push(`${label}_entry_invalid`);
      continue;
    }
    if (ids.has(item.id)) issues.push(`${label}_id_duplicate:${item.id}`);
    ids.add(item.id);
    entries.push(item);
  }
  return { entries, ids };
}

function references(
  value: unknown,
  known: ReadonlySet<string>,
  label: string,
  issues: string[],
) {
  if (!strings(value)) {
    issues.push(`${label}_invalid`);
    return [];
  }
  for (const item of value) {
    if (!known.has(item)) issues.push(`${label}_unknown:${item}`);
  }
  return value;
}

function safePath(value: string) {
  return (
    !value.startsWith("/") &&
    !value.includes("\\") &&
    !value.includes("\0") &&
    value
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function backtickCanonicalIds(
  source: string,
  prefixes: readonly string[],
): Set<string> {
  const ids = new Set<string>();
  const pattern = /`([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)+)`/g;
  for (const match of source.matchAll(pattern)) {
    const id = match[1];
    if (id !== undefined && prefixes.some((prefix) => id.startsWith(prefix)))
      ids.add(id);
  }
  return ids;
}

function verificationTableIds(source: string): Set<string> {
  const ids = new Set<string>();
  const pattern = /^\|\s*(PR-[A-Z0-9-]+)\s*\|/gm;
  for (const match of source.matchAll(pattern)) {
    const id = match[1];
    if (id !== undefined) ids.add(id);
  }
  return ids;
}

export function inspectProjectRuntimeDesignTraceability(
  input: unknown,
  readRepositoryText: TextReader,
): ProjectRuntimeDesignTraceabilityInspection {
  const issues: string[] = [];
  if (!isRecord(input)) {
    return {
      status: "blocked",
      reason: "project_runtime_design_traceability_invalid",
      issues: ["trace_root_invalid"],
    };
  }
  if (input.schema !== TRACE_SCHEMA) issues.push("trace_schema_invalid");
  if (input.schemaRevision !== TRACE_SCHEMA_REVISION)
    issues.push("trace_schema_revision_invalid");

  const documentKeys = [
    "architectureDocument",
    "designDocument",
    "verificationDocument",
  ] as const;
  const documents = new Map<string, string>();
  for (const key of documentKeys) {
    const path = input[key];
    if (!text(path) || !safePath(path)) {
      issues.push(`${key}_invalid`);
      continue;
    }
    const source = readRepositoryText(path);
    if (source === null) issues.push(`${key}_unavailable`);
    else documents.set(key, source);
  }

  const interfaces = population(input.interfaces, "interface", "IF-", issues);
  const records = population(
    input.persistentRecords,
    "persistent_record",
    "REC-",
    issues,
  );
  const resources = population(input.resources, "resource", "RES-", issues);
  const locks = population(input.locks, "lock", "LOCK-", issues);
  const authorities = population(
    input.authorities,
    "authority",
    "AUTH-",
    issues,
  );
  const effects = population(input.effects, "effect", "EFFECT-", issues);
  const machines = population(
    input.stateMachines,
    "state_machine",
    "SM-",
    issues,
  );
  const invariants = population(input.invariants, "invariant", "INV-", issues);
  const failures = population(
    input.failureInjections,
    "failure_injection",
    "FAIL-",
    issues,
  );
  const actionBindings = population(
    input.actionBindings,
    "action_binding",
    "BIND-",
    issues,
  );
  const implementations = population(
    input.implementationBindings,
    "implementation",
    "IMPL-",
    issues,
  );
  const verifications = population(
    input.verificationBindings,
    "verification",
    "PR-",
    issues,
  );

  const designSource = documents.get("designDocument") ?? "";
  const designIds = backtickCanonicalIds(designSource, [
    "IF-",
    "REC-",
    "RES-",
    "LOCK-",
    "AUTH-",
    "EFFECT-",
    "SM-",
    "TRANS-",
    "BIND-",
    "INV-",
    "FAIL-",
    "IMPL-",
  ]);
  for (const group of [
    interfaces,
    records,
    resources,
    locks,
    authorities,
    effects,
    machines,
    invariants,
    failures,
    actionBindings,
    implementations,
  ]) {
    for (const id of group.ids) {
      if (!designIds.has(id)) issues.push(`design_document_id_missing:${id}`);
    }
  }
  const verificationSource = documents.get("verificationDocument") ?? "";
  const documentedVerificationIds = verificationTableIds(verificationSource);
  for (const id of verifications.ids) {
    if (!documentedVerificationIds.has(id))
      issues.push(`verification_document_id_missing:${id}`);
  }
  for (const id of documentedVerificationIds) {
    if (!verifications.ids.has(id))
      issues.push(`human_verification_id_unmapped:${id}`);
  }

  for (const item of interfaces.entries) {
    if (
      !text(item.owner) ||
      !["partial", "planned"].includes(String(item.status)) ||
      !text(item.implementationStage)
    )
      issues.push(`${String(item.id)}:interface_shape_invalid`);
  }
  for (const item of records.entries) {
    const durabilityRelations = [
      "before_effect_intent",
      "generation_state",
      "after_effect_result",
      "after_effect_receipt",
    ];
    if (
      !text(item.ownerInterfaceId) ||
      !interfaces.ids.has(item.ownerInterfaceId) ||
      !text(item.resourceId) ||
      !resources.ids.has(item.resourceId) ||
      !durabilityRelations.includes(String(item.durabilityRelation))
    )
      issues.push(`${String(item.id)}:persistent_record_shape_invalid`);
  }
  const humanDecisionRecord = records.entries.find(
    (item) => item.id === "REC-HUMAN-DECISION",
  );
  const requiredDecisionMeaning = [
    "decision_project_milestone_generation_revision",
    "selected_user_principal",
    "continuation_record_id",
    "decision_application_generation",
    "decision_lifecycle_state",
  ];
  const decisionMeaning =
    humanDecisionRecord !== undefined &&
    strings(humanDecisionRecord.requiredMeaning)
      ? humanDecisionRecord.requiredMeaning
      : [];
  if (
    humanDecisionRecord === undefined ||
    requiredDecisionMeaning.some(
      (meaning) => !decisionMeaning.includes(meaning),
    )
  )
    issues.push("REC-HUMAN-DECISION:continuation_lifecycle_missing");
  const continuationRecord = records.entries.find(
    (item) => item.id === "REC-DECISION-CONTINUATION",
  );
  const requiredContinuationMeaning = [
    "continuation_hash",
    "selected_user_principal",
    "decision_project_milestone_generation_revision",
    "continuation_expiry",
    "continuation_consumed_or_invalidated_state",
    "replacement_request_identity",
    "decision_application_id",
    "expected_project_generation",
    "new_project_generation",
    "application_disposition_issued_prepared_finalized_recovery_invalidated_or_expired",
  ];
  const continuationMeaning =
    continuationRecord !== undefined &&
    strings(continuationRecord.requiredMeaning)
      ? continuationRecord.requiredMeaning
      : [];
  if (
    continuationRecord === undefined ||
    continuationRecord.durabilityRelation !== "before_effect_intent" ||
    requiredContinuationMeaning.some(
      (meaning) => !continuationMeaning.includes(meaning),
    )
  )
    issues.push("REC-DECISION-CONTINUATION:protected_lifecycle_missing");
  const recoveryIntentRecord = records.entries.find(
    (item) => item.id === "REC-DECISION-RECOVERY-INTENT",
  );
  const requiredRecoveryIntentMeaning = [
    "exact_continuation_record_identity",
    "last_confirmed_disposition",
    "decision_application_id",
    "expected_project_generation",
    "new_project_generation",
    "unknown_observation_boundary",
    "recovery_identity",
    "recovery_disposition_required_or_settled",
  ];
  const recoveryIntentMeaning =
    recoveryIntentRecord !== undefined &&
    strings(recoveryIntentRecord.requiredMeaning)
      ? recoveryIntentRecord.requiredMeaning
      : [];
  if (
    recoveryIntentRecord === undefined ||
    recoveryIntentRecord.durabilityRelation !== "before_effect_intent" ||
    requiredRecoveryIntentMeaning.some(
      (meaning) => !recoveryIntentMeaning.includes(meaning),
    )
  )
    issues.push("REC-DECISION-RECOVERY-INTENT:lifecycle_missing");
  const requiredDurabilityRelations = new Map([
    ["REC-PROJECT-STATE", "generation_state"],
    ["REC-QUEUE-ENTRY", "before_effect_intent"],
    ["REC-PROJECT-LEASE", "before_effect_intent"],
    ["REC-TASK-ATTEMPT", "before_effect_intent"],
    ["REC-INTEGRATION", "after_effect_result"],
    ["REC-ADOPTION", "after_effect_receipt"],
  ]);
  for (const item of records.entries) {
    const expected = requiredDurabilityRelations.get(String(item.id));
    if (expected !== undefined && item.durabilityRelation !== expected)
      issues.push(`${String(item.id)}:durability_relation_invalid`);
  }
  for (const item of resources.entries) {
    if (!text(item.owner) || !text(item.terminalCondition))
      issues.push(`${String(item.id)}:resource_shape_invalid`);
  }
  if (!resources.ids.has("RES-DECISION-CONTINUATION"))
    issues.push("decision_continuation_resource_missing");
  const continuationResource = resources.entries.find(
    (item) => item.id === "RES-DECISION-CONTINUATION",
  );
  const requiredSecurityBindings = [
    "selected_user_principal",
    "fixed_volume",
    "non_reparse_chain",
    "owner_and_protection",
    "atomic_update",
  ];
  const securityBindings =
    continuationResource !== undefined &&
    strings(continuationResource.securityBindings)
      ? continuationResource.securityBindings
      : [];
  const requiredApplicationProtocol = [
    "absent_to_issued_and_read_back_before_raw_client_return",
    "issued_to_prepared_before_project_effect",
    "project_state_applied_and_read_back_without_protected_applied_state",
    "prepared_to_finalized_after_cross_root_reconciliation",
    "prepared_to_recovery_only_when_project_observation_unknown_and_protected_cas_readback_succeeds",
    "protected_observation_unknown_uses_separate_recovery_store_without_claiming_continuation_transition",
    "prepared_invalidation_only_after_fresh_old_unapplied_project_readback",
    "recovery_settles_finalized_for_matching_new_or_invalidated_for_verified_old_unapplied",
    "separate_recovery_intent_settles_only_after_joined_fresh_observations",
    "finalized_fresh_observation_before_queue_lease",
  ];
  const applicationProtocol =
    continuationResource !== undefined &&
    strings(continuationResource.applicationProtocol)
      ? continuationResource.applicationProtocol
      : [];
  if (
    continuationResource === undefined ||
    continuationResource.storageBoundary !==
      "os_managed_runtime_protected_root_outside_repository" ||
    continuationResource.accessMode !==
      "platform_owned_mutation_and_fresh_read_only_observation" ||
    continuationResource.invalidInputDisposition !== "unchanged" ||
    !text(continuationResource.replacement) ||
    requiredSecurityBindings.some(
      (binding) => !securityBindings.includes(binding),
    ) ||
    applicationProtocol.length !== requiredApplicationProtocol.length ||
    requiredApplicationProtocol.some(
      (step, index) => applicationProtocol[index] !== step,
    )
  )
    issues.push("RES-DECISION-CONTINUATION:protection_contract_invalid");
  const decisionRecoveryResource = resources.entries.find(
    (item) => item.id === "RES-DECISION-RECOVERY-INTENT",
  );
  const recoverySecurityBindings =
    decisionRecoveryResource !== undefined &&
    strings(decisionRecoveryResource.securityBindings)
      ? decisionRecoveryResource.securityBindings
      : [];
  if (
    decisionRecoveryResource === undefined ||
    decisionRecoveryResource.storageBoundary !==
      "separate_verified_runtime_owned_recovery_store" ||
    decisionRecoveryResource.unavailableDisposition !==
      "manual_recovery_required_effect_state_unknown_and_process_reuse_forbidden" ||
    requiredSecurityBindings.some(
      (binding) => !recoverySecurityBindings.includes(binding),
    )
  )
    issues.push("RES-DECISION-RECOVERY-INTENT:protection_contract_invalid");
  for (const item of authorities.entries) {
    if (!text(item.owner) || !text(item.scope) || !text(item.terminalCondition))
      issues.push(`${String(item.id)}:authority_shape_invalid`);
  }
  for (const item of effects.entries) {
    if (
      !text(item.owner) ||
      !text(item.effectBoundary) ||
      !text(item.observation)
    )
      issues.push(`${String(item.id)}:effect_shape_invalid`);
  }

  const lockOrders = new Set<number>();
  for (const item of locks.entries) {
    const mayNest = references(
      item.mayNest,
      locks.ids,
      `${String(item.id)}:mayNest`,
      issues,
    );
    if (
      !text(item.owner) ||
      !Number.isInteger(item.order) ||
      Number(item.order) < 1 ||
      typeof item.heldAcrossExternalWait !== "boolean" ||
      mayNest.includes(String(item.id))
    )
      issues.push(`${String(item.id)}:lock_shape_invalid`);
    if (typeof item.order === "number" && lockOrders.has(item.order))
      issues.push(`lock_order_duplicate:${String(item.order)}`);
    if (typeof item.order === "number") lockOrders.add(item.order);
  }

  const transitionIds = new Set<string>();
  const transitionModels = new Map<
    string,
    Readonly<{
      machineId: string;
      from: readonly string[];
      to: string;
      resourceIds: readonly string[];
      invariantIds: readonly string[];
    }>
  >();
  const referencedResources = new Set<string>();
  const referencedInvariants = new Set<string>();
  const referencedVerifications = new Set<string>();
  let transitionCount = 0;
  for (const machine of machines.entries) {
    const id = String(machine.id);
    if (!strings(machine.states) || !strings(machine.terminalStates)) {
      issues.push(`${id}:state_machine_shape_invalid`);
      continue;
    }
    const stateIds = new Set(machine.states);
    if (stateIds.size !== machine.states.length)
      issues.push(`${id}:state_duplicate`);
    for (const terminal of machine.terminalStates) {
      if (!stateIds.has(terminal))
        issues.push(`${id}:terminal_unknown:${terminal}`);
    }
    const outgoing = new Set<string>();
    if (!Array.isArray(machine.transitions)) {
      issues.push(`${id}:transitions_invalid`);
      continue;
    }
    for (const transition of machine.transitions) {
      transitionCount += 1;
      if (
        !isRecord(transition) ||
        !text(transition.id) ||
        !transition.id.startsWith("TRANS-")
      ) {
        issues.push(`${id}:transition_invalid`);
        continue;
      }
      if (transitionIds.has(transition.id))
        issues.push(`transition_id_duplicate:${transition.id}`);
      transitionIds.add(transition.id);
      if (!strings(transition.from) || transition.from.length === 0)
        issues.push(`${transition.id}:from_invalid`);
      else {
        for (const from of transition.from) {
          outgoing.add(from);
          if (!stateIds.has(from))
            issues.push(`${transition.id}:from_unknown:${from}`);
          if (machine.terminalStates.includes(from))
            issues.push(`${transition.id}:from_terminal:${from}`);
        }
      }
      if (!text(transition.to) || !stateIds.has(transition.to))
        issues.push(`${transition.id}:to_unknown:${String(transition.to)}`);
      if (
        strings(transition.from) &&
        text(transition.to) &&
        strings(transition.resourceIds) &&
        strings(transition.invariantIds)
      )
        transitionModels.set(transition.id, {
          machineId: id,
          from: transition.from,
          to: transition.to,
          resourceIds: transition.resourceIds,
          invariantIds: transition.invariantIds,
        });
      for (const resource of references(
        transition.resourceIds,
        resources.ids,
        `${transition.id}:resourceIds`,
        issues,
      ))
        referencedResources.add(resource);
      for (const invariant of references(
        transition.invariantIds,
        invariants.ids,
        `${transition.id}:invariantIds`,
        issues,
      ))
        referencedInvariants.add(invariant);
      const verificationIds = references(
        transition.verificationIds,
        verifications.ids,
        `${transition.id}:verificationIds`,
        issues,
      );
      if (verificationIds.length === 0)
        issues.push(`${transition.id}:verification_missing`);
      for (const verification of verificationIds)
        referencedVerifications.add(verification);
    }
    for (const state of machine.states) {
      if (!machine.terminalStates.includes(state) && !outgoing.has(state))
        issues.push(`${id}:nonterminal_without_outgoing:${state}`);
    }
  }

  for (const failure of failures.entries) {
    references(
      failure.transitionIds,
      transitionIds,
      `${String(failure.id)}:transitionIds`,
      issues,
    );
    const verificationIds = references(
      failure.verificationIds,
      verifications.ids,
      `${String(failure.id)}:verificationIds`,
      issues,
    );
    for (const verification of verificationIds)
      referencedVerifications.add(verification);
    if (!text(failure.expectedOutcome))
      issues.push(`${String(failure.id)}:expected_outcome_invalid`);
  }

  const machineDesignIds = new Set<string>([
    ...interfaces.ids,
    ...records.ids,
    ...resources.ids,
    ...locks.ids,
    ...authorities.ids,
    ...effects.ids,
    ...machines.ids,
    ...transitionIds,
    ...actionBindings.ids,
    ...invariants.ids,
    ...failures.ids,
    ...implementations.ids,
  ]);
  for (const id of designIds) {
    if (!machineDesignIds.has(id))
      issues.push(`human_design_id_unmapped:${id}`);
  }

  const transitionBindingCounts = new Map<string, number>();
  const exactActionBindings = new Map<string, JsonRecord>();
  const boundLocks = new Set<string>();
  const boundAuthorities = new Set<string>();
  const boundEffects = new Set<string>();
  for (const binding of actionBindings.entries) {
    const id = String(binding.id);
    const boundTransitionIds = references(
      binding.transitionIds,
      transitionIds,
      `${id}:transitionIds`,
      issues,
    );
    const lockIds = references(
      binding.lockIds,
      locks.ids,
      `${id}:lockIds`,
      issues,
    );
    const authorityIds = references(
      binding.authorityIds,
      authorities.ids,
      `${id}:authorityIds`,
      issues,
    );
    const effectIds = references(
      binding.effectIds,
      effects.ids,
      `${id}:effectIds`,
      issues,
    );
    const verificationIds = references(
      binding.verificationIds,
      verifications.ids,
      `${id}:verificationIds`,
      issues,
    );
    if (
      boundTransitionIds.length !== 1 ||
      authorityIds.length === 0 ||
      effectIds.length === 0 ||
      verificationIds.length === 0 ||
      !text(binding.ordering)
    )
      issues.push(`${id}:action_binding_shape_invalid`);
    for (const value of boundTransitionIds)
      transitionBindingCounts.set(
        value,
        (transitionBindingCounts.get(value) ?? 0) + 1,
      );
    const exactTransitionId = boundTransitionIds.at(0);
    if (boundTransitionIds.length === 1 && exactTransitionId !== undefined)
      exactActionBindings.set(exactTransitionId, binding);
    for (const value of lockIds) boundLocks.add(value);
    for (const value of authorityIds) boundAuthorities.add(value);
    for (const value of effectIds) boundEffects.add(value);
    for (const value of verificationIds) referencedVerifications.add(value);
  }
  for (const id of transitionIds) {
    const count = transitionBindingCounts.get(id) ?? 0;
    if (count === 0) issues.push(`transition_action_unbound:${id}`);
    if (count > 1) issues.push(`transition_action_overbound:${id}`);
  }
  for (const [transitionId, binding] of exactActionBindings) {
    const effectIds = strings(binding.effectIds) ? binding.effectIds : [];
    const authorityIds = strings(binding.authorityIds)
      ? binding.authorityIds
      : [];
    const transition = transitionModels.get(transitionId);
    if (transition === undefined) continue;
    const resumesFromRecovery = transition.from.includes("recovery_required");
    const isCancellation = transition.to === "cancelled";
    const isRecoverySettlement = resumesFromRecovery && !isCancellation;
    const isContinuationRecoverySettlement =
      isRecoverySettlement &&
      transition.machineId === "SM-DECISION-CONTINUATION";
    if (isRecoverySettlement) {
      const expectedTarget = new Map([
        ["SM-TASK", "ready"],
        ["SM-MILESTONE", "executing"],
        ["SM-QUEUE", "queued"],
      ]).get(transition.machineId);
      const validContinuationTarget =
        isContinuationRecoverySettlement &&
        ["finalized", "invalidated"].includes(transition.to) &&
        transition.invariantIds.includes("INV-DECISION-RECOVERY-SETTLEMENT") &&
        authorityIds.includes("AUTH-RECOVERY") &&
        effectIds.length === 1 &&
        effectIds[0] === "EFFECT-DECISION-CONTINUATION";
      const validOrdinaryTarget =
        !isContinuationRecoverySettlement &&
        expectedTarget !== undefined &&
        transition.to === expectedTarget &&
        transition.invariantIds.includes("INV-RECOVERY-SETTLED-BEFORE-RESUME");
      if (!validContinuationTarget && !validOrdinaryTarget)
        issues.push(`${transitionId}:recovery_resume_without_settlement`);
    }
    const ownsOrdinaryRecoveryEffect =
      isRecoverySettlement &&
      !isContinuationRecoverySettlement &&
      transition.machineId === "SM-QUEUE";
    if (effectIds.includes("EFFECT-RECOVERY") !== ownsOrdinaryRecoveryEffect)
      issues.push(
        `${String(binding.id)}:recovery_effect_applicability_invalid`,
      );
    if (
      isCancellation &&
      transition.machineId !== "SM-DECISION" &&
      !effectIds.includes("EFFECT-SINGLE-TASK")
    )
      issues.push(`${String(binding.id)}:cancellation_effect_missing`);
    const resumesFromHumanDecision =
      transition.from.includes("human_decision_required") &&
      ["executing", "leased"].includes(transition.to);
    if (resumesFromHumanDecision) {
      const receiptMissing =
        !transition.resourceIds.includes("RES-PENDING-DECISION") ||
        !transition.invariantIds.includes("INV-DECISION-RECEIPT-BEFORE-RESUME");
      const authorityMissing =
        transition.machineId === "SM-MILESTONE" &&
        !authorityIds.includes("AUTH-HUMAN-DECISION");
      if (receiptMissing || authorityMissing)
        issues.push(`${transitionId}:decision_resume_without_receipt`);
    }
    if (
      transition.machineId === "SM-DECISION" &&
      transition.to === "accepted" &&
      !authorityIds.includes("AUTH-HUMAN-DECISION")
    )
      issues.push(
        `${String(binding.id)}:decision_acceptance_authority_missing`,
      );
    if (
      transition.machineId === "SM-DECISION" &&
      ["stale", "superseded", "cancelled"].includes(transition.to) &&
      authorityIds.includes("AUTH-HUMAN-DECISION")
    )
      issues.push(`${String(binding.id)}:decision_lifecycle_authority_invalid`);
    if (
      effectIds.includes("EFFECT-CANONICAL-ADOPTION") &&
      !(
        transition.machineId === "SM-MILESTONE" &&
        transition.from.length === 1 &&
        transition.from[0] === "integrating" &&
        transition.to === "accepted"
      )
    )
      issues.push(
        `${String(binding.id)}:adoption_effect_applicability_invalid`,
      );
  }
  const decisionApplicationBindings = [
    ["TRANS-DECISION-PENDING-ACCEPTED", "root", true],
    ["TRANS-MILESTONE-DECISION-ACCEPTED-EXECUTE", "milestone", false],
  ] as const;
  for (const [
    transitionId,
    role,
    standaloneAllowed,
  ] of decisionApplicationBindings) {
    const binding = exactActionBindings.get(transitionId);
    const transition = transitionModels.get(transitionId);
    const effectIds =
      binding !== undefined && strings(binding.effectIds)
        ? binding.effectIds
        : [];
    if (
      binding === undefined ||
      binding.transactionId !== "decision_application" ||
      binding.projectionRole !== role ||
      binding.standaloneAllowed !== standaloneAllowed ||
      effectIds.length !== 1 ||
      effectIds[0] !== "EFFECT-DECISION-STATE" ||
      transition === undefined ||
      !transition.resourceIds.includes("RES-DECISION-CONTINUATION") ||
      !transition.invariantIds.includes("INV-DECISION-ATOMIC-APPLICATION")
    )
      issues.push(`${transitionId}:decision_atomic_application_invalid`);
  }
  const continuationProtocol = [
    {
      transitionId: "TRANS-CONTINUATION-ABSENT-ISSUED",
      from: ["absent"],
      to: "issued",
      authorityId: "AUTH-MILESTONE",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "issue",
      requiredResources: ["RES-DECISION-CONTINUATION"],
      requiredInvariant: "INV-DECISION-CAPABILITY-ISSUED-BEFORE-RETURN",
    },
    {
      transitionId: "TRANS-CONTINUATION-ISSUED-PREPARED",
      from: ["issued"],
      to: "prepared",
      authorityId: "AUTH-HUMAN-DECISION",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "prepare",
      requiredResources: ["RES-DECISION-CONTINUATION"],
      requiredInvariant: "INV-DECISION-CONTINUATION-PROTOCOL",
    },
    {
      transitionId: "TRANS-CONTINUATION-PREPARED-FINALIZED",
      from: ["prepared"],
      to: "finalized",
      authorityId: "AUTH-HUMAN-DECISION",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "finalize",
      requiredResources: ["RES-DECISION-CONTINUATION", "RES-PROJECT-STATE"],
      requiredInvariant: "INV-DECISION-ATOMIC-APPLICATION",
    },
    {
      transitionId: "TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY",
      from: ["prepared"],
      to: "recovery_required",
      authorityId: "AUTH-RECOVERY",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "project_unknown_recovery",
      requiredResources: [
        "RES-DECISION-CONTINUATION",
        "RES-PROJECT-STATE",
        "RES-DECISION-RECOVERY-INTENT",
      ],
      requiredInvariant: "INV-UNKNOWN-PRESERVES-RECOVERY",
    },
    {
      transitionId: "TRANS-CONTINUATION-ISSUED-INVALIDATED",
      from: ["issued"],
      to: "invalidated",
      authorityId: "AUTH-MILESTONE",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "invalidate_issued",
      requiredResources: ["RES-DECISION-CONTINUATION"],
      requiredInvariant: "INV-DECISION-CONTINUATION-PROTOCOL",
    },
    {
      transitionId: "TRANS-CONTINUATION-PREPARED-UNAPPLIED-INVALIDATED",
      from: ["prepared"],
      to: "invalidated",
      authorityId: "AUTH-MILESTONE",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "invalidate_prepared_unapplied",
      requiredResources: ["RES-DECISION-CONTINUATION", "RES-PROJECT-STATE"],
      requiredInvariant: "INV-DECISION-PREPARED-INVALIDATION-READBACK",
    },
    {
      transitionId: "TRANS-CONTINUATION-RECOVERY-FINALIZED",
      from: ["recovery_required"],
      to: "finalized",
      authorityId: "AUTH-RECOVERY",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "recover_finalize",
      requiredResources: [
        "RES-DECISION-CONTINUATION",
        "RES-PROJECT-STATE",
        "RES-PROJECT-RECOVERY-EVIDENCE",
      ],
      requiredInvariant: "INV-DECISION-RECOVERY-SETTLEMENT",
    },
    {
      transitionId: "TRANS-CONTINUATION-RECOVERY-INVALIDATED",
      from: ["recovery_required"],
      to: "invalidated",
      authorityId: "AUTH-RECOVERY",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "recover_invalidate",
      requiredResources: [
        "RES-DECISION-CONTINUATION",
        "RES-PROJECT-STATE",
        "RES-PROJECT-RECOVERY-EVIDENCE",
      ],
      requiredInvariant: "INV-DECISION-RECOVERY-SETTLEMENT",
    },
    {
      transitionId: "TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED",
      from: ["issued"],
      to: "invalidated",
      authorityId: "AUTH-RECOVERY",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "protected_recovery_invalidate_issued",
      requiredResources: [
        "RES-DECISION-CONTINUATION",
        "RES-DECISION-RECOVERY-INTENT",
      ],
      requiredInvariant: "INV-DECISION-SEPARATE-RECOVERY-INTENT",
    },
    {
      transitionId: "TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED",
      from: ["prepared"],
      to: "recovery_required",
      authorityId: "AUTH-RECOVERY",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "protected_recovery_prepare_required",
      requiredResources: [
        "RES-DECISION-CONTINUATION",
        "RES-PROJECT-STATE",
        "RES-DECISION-RECOVERY-INTENT",
      ],
      requiredInvariant: "INV-DECISION-SEPARATE-RECOVERY-INTENT",
    },
    {
      transitionId: "TRANS-CONTINUATION-ISSUED-EXPIRED",
      from: ["issued"],
      to: "expired",
      authorityId: "AUTH-MILESTONE",
      effectIds: ["EFFECT-DECISION-CONTINUATION"],
      stage: "expire",
      requiredResources: ["RES-DECISION-CONTINUATION"],
      requiredInvariant: "INV-DECISION-CONTINUATION-PROTOCOL",
    },
  ] as const;
  for (const expected of continuationProtocol) {
    const transition = transitionModels.get(expected.transitionId);
    const binding = exactActionBindings.get(expected.transitionId);
    const authorityIds =
      binding !== undefined && strings(binding.authorityIds)
        ? binding.authorityIds
        : [];
    const effectIds =
      binding !== undefined && strings(binding.effectIds)
        ? binding.effectIds
        : [];
    if (
      transition === undefined ||
      transition.machineId !== "SM-DECISION-CONTINUATION" ||
      transition.to !== expected.to ||
      transition.from.length !== expected.from.length ||
      expected.from.some((state) => !transition.from.includes(state)) ||
      expected.requiredResources.some(
        (resource) => !transition.resourceIds.includes(resource),
      ) ||
      !transition.invariantIds.includes("INV-DECISION-CONTINUATION-PROTOCOL") ||
      !transition.invariantIds.includes(expected.requiredInvariant) ||
      binding === undefined ||
      binding.protocolStage !== expected.stage ||
      !authorityIds.includes(expected.authorityId) ||
      effectIds.length !== expected.effectIds.length ||
      expected.effectIds.some((effect) => !effectIds.includes(effect))
    )
      issues.push(
        `${expected.transitionId}:decision_continuation_protocol_invalid`,
      );
  }
  const recoveryIntentProtocol = [
    {
      transitionId: "TRANS-DECISION-RECOVERY-ABSENT-REQUIRED",
      from: ["absent"],
      to: "required",
      stage: "observation_unknown_intent",
      requiredResources: ["RES-DECISION-RECOVERY-INTENT"],
    },
    {
      transitionId: "TRANS-DECISION-RECOVERY-REQUIRED-SETTLED",
      from: ["required"],
      to: "settled",
      stage: "decision_recovery_intent_settlement",
      requiredResources: [
        "RES-DECISION-RECOVERY-INTENT",
        "RES-DECISION-CONTINUATION",
        "RES-PROJECT-STATE",
      ],
    },
  ] as const;
  for (const expected of recoveryIntentProtocol) {
    const transition = transitionModels.get(expected.transitionId);
    const binding = exactActionBindings.get(expected.transitionId);
    const authorityIds =
      binding !== undefined && strings(binding.authorityIds)
        ? binding.authorityIds
        : [];
    const effectIds =
      binding !== undefined && strings(binding.effectIds)
        ? binding.effectIds
        : [];
    const freshJoinResourceIds =
      binding !== undefined && strings(binding.freshJoinResourceIds)
        ? binding.freshJoinResourceIds
        : [];
    const allowedContinuationSettlementStates =
      binding !== undefined &&
      strings(binding.allowedContinuationSettlementStates)
        ? binding.allowedContinuationSettlementStates
        : [];
    const triggerBoundaries =
      binding !== undefined && strings(binding.triggerBoundaries)
        ? binding.triggerBoundaries
        : [];
    const safeSettlementOutcomes =
      binding !== undefined && strings(binding.safeSettlementOutcomes)
        ? binding.safeSettlementOutcomes
        : [];
    const isRequiredTransition =
      expected.transitionId === "TRANS-DECISION-RECOVERY-ABSENT-REQUIRED";
    const isSettlementTransition =
      expected.transitionId === "TRANS-DECISION-RECOVERY-REQUIRED-SETTLED";
    if (
      transition === undefined ||
      transition.machineId !== "SM-DECISION-RECOVERY-INTENT" ||
      transition.to !== expected.to ||
      transition.from.length !== expected.from.length ||
      expected.from.some((state) => !transition.from.includes(state)) ||
      expected.requiredResources.some(
        (resource) => !transition.resourceIds.includes(resource),
      ) ||
      !transition.invariantIds.includes(
        "INV-DECISION-SEPARATE-RECOVERY-INTENT",
      ) ||
      (isSettlementTransition &&
        !transition.invariantIds.includes(
          "INV-DECISION-RECOVERY-SETTLEMENT",
        )) ||
      binding === undefined ||
      binding.protocolStage !== expected.stage ||
      !authorityIds.includes("AUTH-RECOVERY") ||
      effectIds.length !== 1 ||
      effectIds[0] !== "EFFECT-DECISION-RECOVERY-INTENT" ||
      (isRequiredTransition &&
        (triggerBoundaries.length !== 2 ||
          !triggerBoundaries.includes("project_observation_unknown") ||
          !triggerBoundaries.includes(
            "protected_observation_or_cas_readback_unknown",
          ) ||
          binding.protectedUnknownContinuationTransitionClaimed !== false)) ||
      (isSettlementTransition &&
        (freshJoinResourceIds.length !== 3 ||
          expected.requiredResources.some(
            (resource) => !freshJoinResourceIds.includes(resource),
          ) ||
          allowedContinuationSettlementStates.length !== 4 ||
          !allowedContinuationSettlementStates.includes("absent") ||
          !allowedContinuationSettlementStates.includes("finalized") ||
          !allowedContinuationSettlementStates.includes("invalidated") ||
          !allowedContinuationSettlementStates.includes("expired") ||
          safeSettlementOutcomes.length !== 4 ||
          !safeSettlementOutcomes.includes(
            "record_absent_raw_not_returned_project_unapplied",
          ) ||
          !safeSettlementOutcomes.includes("record_finalized_matching_new") ||
          !safeSettlementOutcomes.includes(
            "record_invalidated_verified_old_unapplied",
          ) ||
          !safeSettlementOutcomes.includes(
            "record_expired_project_unapplied",
          ) ||
          binding.continuationSettlementReadbackBeforeIntent !== true ||
          binding.intentSettlementReadbackLast !== true))
    )
      issues.push(
        `${expected.transitionId}:decision_recovery_intent_protocol_invalid`,
      );
  }
  const projectUnknownBinding = exactActionBindings.get(
    "TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY",
  );
  if (
    projectUnknownBinding === undefined ||
    projectUnknownBinding.requiredRecoveryIntentState !==
      "required_read_back" ||
    projectUnknownBinding.protectedUnknownContinuationTransitionClaimed !==
      false
  )
    issues.push(
      "TRANS-CONTINUATION-PROJECT-UNKNOWN-RECOVERY:decision_recovery_intent_precondition_invalid",
    );
  for (const transitionId of [
    "TRANS-CONTINUATION-PROTECTED-RECOVERY-ISSUED-INVALIDATED",
    "TRANS-CONTINUATION-PROTECTED-RECOVERY-PREPARED-REQUIRED",
  ]) {
    const binding = exactActionBindings.get(transitionId);
    if (
      binding === undefined ||
      binding.requiredRecoveryIntentState !== "required_read_back"
    )
      issues.push(
        `${transitionId}:decision_recovery_intent_precondition_invalid`,
      );
  }
  const queueDecisionTransition = transitionModels.get(
    "TRANS-QUEUE-DECISION-ACCEPTED-REPLAN",
  );
  const queueDecisionBinding = exactActionBindings.get(
    "TRANS-QUEUE-DECISION-ACCEPTED-REPLAN",
  );
  const queueDecisionAuthorities =
    queueDecisionBinding !== undefined &&
    strings(queueDecisionBinding.authorityIds)
      ? queueDecisionBinding.authorityIds
      : [];
  const queueDecisionEffects =
    queueDecisionBinding !== undefined &&
    strings(queueDecisionBinding.effectIds)
      ? queueDecisionBinding.effectIds
      : [];
  if (
    queueDecisionTransition === undefined ||
    queueDecisionBinding === undefined ||
    !queueDecisionTransition.from.includes("human_decision_required") ||
    queueDecisionTransition.to !== "replan_required" ||
    queueDecisionBinding.transactionId !== undefined ||
    queueDecisionAuthorities.includes("AUTH-HUMAN-DECISION") ||
    !queueDecisionAuthorities.includes("AUTH-MILESTONE") ||
    queueDecisionEffects.length !== 1 ||
    queueDecisionEffects[0] !== "EFFECT-QUEUE-STATE" ||
    !queueDecisionTransition.resourceIds.includes(
      "RES-DECISION-CONTINUATION",
    ) ||
    queueDecisionTransition.invariantIds.includes(
      "INV-DECISION-ATOMIC-APPLICATION",
    ) ||
    !queueDecisionTransition.invariantIds.includes(
      "INV-DECISION-RECEIPT-BEFORE-RESUME",
    ) ||
    !queueDecisionTransition.invariantIds.includes(
      "INV-DECISION-APPLICATION-FINALIZED-BEFORE-QUEUE",
    )
  )
    issues.push(
      "TRANS-QUEUE-DECISION-ACCEPTED-REPLAN:decision_post_commit_replan_invalid",
    );
  for (const requiredFailure of [
    "FAIL-DECISION-ATOMIC-APPLICATION",
    "FAIL-DECISION-CONTINUATION",
  ]) {
    if (!failures.ids.has(requiredFailure))
      issues.push(`decision_failure_injection_missing:${requiredFailure}`);
  }
  for (const id of locks.ids) {
    if (!boundLocks.has(id)) issues.push(`lock_action_unbound:${id}`);
  }
  for (const id of authorities.ids) {
    if (!boundAuthorities.has(id))
      issues.push(`authority_action_unbound:${id}`);
  }
  for (const id of effects.ids) {
    if (!boundEffects.has(id)) issues.push(`effect_action_unbound:${id}`);
  }

  const boundInterfaces = new Set<string>();
  for (const binding of implementations.entries) {
    const interfaceIds = references(
      binding.interfaceIds,
      interfaces.ids,
      `${String(binding.id)}:interfaceIds`,
      issues,
    );
    for (const id of interfaceIds) boundInterfaces.add(id);
    if (
      !["partial", "planned"].includes(String(binding.status)) ||
      !text(binding.stage) ||
      !strings(binding.paths)
    ) {
      issues.push(`${String(binding.id)}:implementation_shape_invalid`);
      continue;
    }
    if (binding.status === "partial" && binding.paths.length === 0)
      issues.push(`${String(binding.id)}:partial_paths_missing`);
    for (const path of binding.paths) {
      if (!safePath(path) || readRepositoryText(path) === null)
        issues.push(`${String(binding.id)}:path_unavailable:${path}`);
    }
  }
  for (const id of interfaces.ids) {
    if (!boundInterfaces.has(id)) issues.push(`interface_unbound:${id}`);
  }

  for (const binding of verifications.entries) {
    if (
      ![
        "normal",
        "quasi_normal",
        "human_decision",
        "abnormal",
        "integration",
      ].includes(String(binding.kind)) ||
      !["partial", "planned"].includes(String(binding.status)) ||
      !strings(binding.testPaths)
    ) {
      issues.push(`${String(binding.id)}:verification_shape_invalid`);
      continue;
    }
    if (binding.status === "partial" && binding.testPaths.length === 0)
      issues.push(`${String(binding.id)}:partial_test_paths_missing`);
    for (const path of binding.testPaths) {
      if (!safePath(path) || readRepositoryText(path) === null)
        issues.push(`${String(binding.id)}:test_path_unavailable:${path}`);
    }
  }

  const recordResources = new Set(
    records.entries
      .map((item) => item.resourceId)
      .filter((item): item is string => typeof item === "string"),
  );
  for (const id of resources.ids) {
    if (!referencedResources.has(id) && !recordResources.has(id))
      issues.push(`resource_orphan:${id}`);
  }
  for (const id of invariants.ids) {
    if (!referencedInvariants.has(id)) issues.push(`invariant_orphan:${id}`);
  }
  for (const id of verifications.ids) {
    if (!referencedVerifications.has(id))
      issues.push(`verification_orphan:${id}`);
  }

  if (issues.length > 0) {
    return {
      status: "blocked",
      reason: "project_runtime_design_traceability_invalid",
      issues: Object.freeze([...new Set(issues)].sort()),
    };
  }
  return Object.freeze({
    status: "accepted",
    interfaces: interfaces.entries.length,
    persistentRecords: records.entries.length,
    resources: resources.entries.length,
    locks: locks.entries.length,
    authorities: authorities.entries.length,
    effects: effects.entries.length,
    stateMachines: machines.entries.length,
    transitions: transitionCount,
    actionBindings: actionBindings.entries.length,
    invariants: invariants.entries.length,
    failureInjections: failures.entries.length,
    implementationBindings: implementations.entries.length,
    verificationBindings: verifications.entries.length,
  });
}

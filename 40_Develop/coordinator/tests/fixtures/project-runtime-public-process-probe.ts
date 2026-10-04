const mode = process.argv[2] ?? "normal";
const selectionNotice = (
  taskRole: "executor" | "reviewer",
  provider: "codex" | "claude",
) => ({
  event: "coordinator_selection_before_provider_effect",
  taskRole,
  provider,
  model: provider === "codex" ? "gpt-5.5" : "opus",
  effort: taskRole === "executor" ? "low" : "medium",
  speedMode: "normal",
  selectionReason: "fixed_test_selection",
  inputBasis:
    "caller_declared_task_attributes_plus_runtime_owned_preselection_candidate_with_deferred_provider_preflight",
  callerDeclaredAttributes: [
    "workClass",
    "planState",
    "risk",
    "difficulty",
    "decisionImpact",
  ],
  highCostSelectionAllowed: false,
});
const projection = (isCancelled: boolean) => ({
  projectId: "project-a",
  milestoneId: "milestone-a",
  generation: 1,
  milestoneState: isCancelled ? "cancelled" : "executing",
  objectiveCounts: {
    planned: 0,
    executing: 0,
    integration_pending: isCancelled ? 0 : 1,
    accepted: 0,
    returned: 0,
    blocked: 0,
    cancelled: isCancelled ? 1 : 0,
  },
  taskCounts: {
    planned: 0,
    waiting_dependency: 0,
    ready: 0,
    starting: 0,
    running: 0,
    cleanup_pending: 0,
    completed: isCancelled ? 0 : 1,
    failed: 0,
    cancelled: isCancelled ? 1 : 0,
    recovery_required: 0,
    superseded: 0,
  },
  objectiveTaskSummaries: [
    {
      objectiveId: "objective-a",
      objectiveState: isCancelled ? "cancelled" : "integration_pending",
      taskCounts: {
        planned: 0,
        waiting_dependency: 0,
        ready: 0,
        starting: 0,
        running: 0,
        cleanup_pending: 0,
        completed: isCancelled ? 0 : 1,
        failed: 0,
        cancelled: isCancelled ? 1 : 0,
        recovery_required: 0,
        superseded: 0,
      },
    },
  ],
  workProgress: isCancelled ? "in_progress" : "tasks_complete",
  qualityState: isCancelled ? "not_evaluated" : "integration_pending",
  humanDecisionRequired: false,
  recoveryRequired: false,
  nextAction: isCancelled ? "wait_for_task" : "verify_objective_integration",
});
let received = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  received += chunk;
  if (!received.includes("\n")) return;
  if (mode === "malformed") process.stdout.write("not-json\n");
  else if (mode === "overflow") process.stdout.write("x".repeat(4096));
  else {
    const request = JSON.parse(received.split(/\r?\n/u)[0] ?? "");
    const id = mode === "wrong-id" ? "wrong" : request.id;
    const isCancelled = mode === "cancelled";
    const runtimeProcessRecoveryId =
      "runtime-process.6d7cc28e-2bdf-4c1a-8714-396a4a1db5a3.restart-7fb909b959f2101c318473bf51b0c388e0fb75bf";
    const responseLine = `${JSON.stringify({
      jsonrpc: "2.0",
      id,
      result: {
        structuredContent: {
          status: "blocked",
          reason: isCancelled
            ? "project_runtime_task_recovery_required"
            : "project_runtime_acceptance_decision_required",
          contract: "crdd-coordinator/project-runtime-objective-intake/v1",
          requestId: "request-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
          projection: isCancelled ? null : projection(false),
          cleanupConfirmed: !isCancelled,
          manualRecoveryRequired: isCancelled,
          processRestartRequired: isCancelled,
          recoveryIds: isCancelled ? [runtimeProcessRecoveryId] : [],
          recoveryObligations: isCancelled
            ? [
                {
                  kind: "runtime_process",
                  recoveryId: runtimeProcessRecoveryId,
                },
              ]
            : [],
          effectState: isCancelled ? "unknown" : "settled",
        },
      },
    })}\n`;
    if (mode === "incomplete-known-prefix") {
      process.stderr.write('[Coordinator lifecycle] {"event":');
      process.stdout.write(responseLine);
      return;
    }
    if (mode === "chunked-crlf") {
      const diagnostic = Buffer.from(
        `[Coordinator selection] ${JSON.stringify(selectionNotice("executor", "codex"))}\r\n[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "executor", provider: "codex", operationId: "OP-600001" })}\r\n`,
        "utf8",
      );
      process.stderr.write(diagnostic.subarray(0, 17));
      setTimeout(() => {
        process.stderr.write(diagnostic.subarray(17));
        process.stdout.write(responseLine);
      }, 5);
      return;
    }
    if (
      mode === "boundary-diagnostics" ||
      mode === "boundary-primary-diagnostic"
    ) {
      const operationId = "OP-700001";
      process.stderr.write(
        `[Coordinator selection] ${JSON.stringify(selectionNotice("executor", "codex"))}\n`,
      );
      process.stderr.write(
        `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_boundary_configured", taskRole: "executor", provider: "codex", operationId, approvalModeConfigured: "never", sandboxModeConfigured: "read_only", workspaceMountModeConfigured: "read_only", rootFilesystemReadOnlyConfigured: true, nonRootUserConfigured: true, workdirConfigured: true })}\n`,
      );
      process.stderr.write(
        `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "executor", provider: "codex", operationId })}\n`,
      );
      process.stderr.write(
        `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_boundary_settled", taskRole: "executor", provider: "codex", operationId, providerContainerCreatedObserved: true, providerProcessStartedObserved: true, providerProcessCompletionObserved: true, providerProcessExitStatusClass: "zero", processTreeTerminationObserved: false, containersAbsentObserved: true, networksAbsentObserved: true, cleanupConfirmed: true, ...(mode === "boundary-primary-diagnostic" ? { primaryFailure: JSON.parse(process.argv[3] ?? "null") } : {}) })}\n`,
      );
      process.stdout.write(responseLine);
      return;
    }
    if (mode === "embedded-event")
      process.stderr.write(
        `diagnostic ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "executor", provider: "claude", operationId: "OP-UNTRUSTED" })}\n`,
      );
    if (mode === "malformed-known-prefix")
      process.stderr.write("[Coordinator lifecycle] {not-json}\n");
    process.stderr.write(
      `[Coordinator selection] ${JSON.stringify(selectionNotice("executor", mode === "cancelled" || mode === "parent-loss" ? "claude" : "codex"))}\n`,
    );
    const provider =
      mode === "cancelled" || mode === "parent-loss" ? "claude" : "codex";
    const operationId =
      mode === "cancelled"
        ? "OP-300001"
        : mode === "parent-loss"
          ? "OP-400001"
          : "OP-100001";
    process.stderr.write(
      `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_boundary_configured", taskRole: "executor", provider, operationId, approvalModeConfigured: "never", sandboxModeConfigured: "read_only", workspaceMountModeConfigured: "read_only", rootFilesystemReadOnlyConfigured: true, nonRootUserConfigured: true, workdirConfigured: true })}\n`,
    );
    process.stderr.write(
      `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "executor", provider, operationId })}\n`,
    );
    if (mode === "parent-loss") {
      setInterval(() => {}, 1000);
      return;
    }
    if (!isCancelled)
      process.stderr.write(
        `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_boundary_settled", taskRole: "executor", provider, operationId, providerContainerCreatedObserved: true, providerProcessStartedObserved: true, providerProcessCompletionObserved: true, providerProcessExitStatusClass: "zero", processTreeTerminationObserved: false, containersAbsentObserved: true, networksAbsentObserved: true, cleanupConfirmed: true })}\n`,
      );
    if (mode === "recovery-events") {
      const recoveryId = `docker-task.${"a".repeat(64)}.${"b".repeat(64)}.${"c".repeat(64)}`;
      for (const [index, phase] of [
        "required",
        "recovering",
        "settled",
        "acknowledged",
        "verification_resources_finalized",
        "queue_settled",
        "retry_ready",
      ].entries())
        process.stderr.write(
          `[Project Runtime recovery] ${JSON.stringify({
            event: "project_runtime_recovery_transition",
            phase,
            projectId: "project-a",
            milestoneId: "milestone-a",
            queueId: "queue-a",
            taskId: index < 5 ? "task-a" : null,
            operationId: index < 5 ? `operation-${"d".repeat(40)}` : null,
            recoveryId: index < 5 ? recoveryId : null,
            stateGeneration: index + 1,
          })}\n`,
        );
    }
    if (mode !== "cancelled")
      process.stderr.write(
        `[Coordinator selection] ${JSON.stringify(selectionNotice("reviewer", "claude"))}\n`,
      );
    if (mode !== "cancelled")
      process.stderr.write(
        `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_boundary_configured", taskRole: "reviewer", provider: "claude", operationId: "OP-100001", approvalModeConfigured: "never", sandboxModeConfigured: "read_only", workspaceMountModeConfigured: "read_only", rootFilesystemReadOnlyConfigured: true, nonRootUserConfigured: true, workdirConfigured: true })}\n`,
      );
    if (mode !== "cancelled")
      process.stderr.write(
        `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "reviewer", provider: "claude", operationId: "OP-100001" })}\n`,
      );
    if (mode !== "cancelled")
      process.stderr.write(
        `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_boundary_settled", taskRole: "reviewer", provider: "claude", operationId: "OP-100001", providerContainerCreatedObserved: true, providerProcessStartedObserved: true, providerProcessCompletionObserved: true, providerProcessExitStatusClass: "zero", processTreeTerminationObserved: false, containersAbsentObserved: true, networksAbsentObserved: true, cleanupConfirmed: true })}\n`,
      );
    process.stdout.write(responseLine);
  }
});
process.stdin.on("end", () => {
  if (mode === "nonzero") process.exitCode = 7;
});
if (mode === "ignore-eof")
  process.stdin.on("end", () => setInterval(() => {}, 1000));

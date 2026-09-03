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
const projection = (cancelled: boolean) => ({
  projectId: "project-a",
  milestoneId: "milestone-a",
  generation: 1,
  milestoneState: cancelled ? "cancelled" : "accepted",
  objectiveCounts: {
    planned: 0,
    executing: 0,
    integration_pending: 0,
    accepted: cancelled ? 0 : 1,
    blocked: 0,
    cancelled: cancelled ? 1 : 0,
  },
  taskCounts: {
    planned: 0,
    waiting_dependency: 0,
    ready: 0,
    starting: 0,
    running: 0,
    cleanup_pending: 0,
    completed: cancelled ? 0 : 1,
    failed: 0,
    cancelled: cancelled ? 1 : 0,
    recovery_required: 0,
    superseded: 0,
  },
  objectiveTaskSummaries: [
    {
      objectiveId: "objective-a",
      objectiveState: cancelled ? "cancelled" : "accepted",
      taskCounts: {
        planned: 0,
        waiting_dependency: 0,
        ready: 0,
        starting: 0,
        running: 0,
        cleanup_pending: 0,
        completed: cancelled ? 0 : 1,
        failed: 0,
        cancelled: cancelled ? 1 : 0,
        recovery_required: 0,
        superseded: 0,
      },
    },
  ],
  workProgress: cancelled ? "in_progress" : "tasks_complete",
  qualityState: cancelled ? "not_evaluated" : "accepted",
  humanDecisionRequired: false,
  recoveryRequired: false,
  nextAction: cancelled ? "wait_for_task" : "complete",
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
    const cancelled = mode === "cancelled";
    const responseLine = `${JSON.stringify({
      jsonrpc: "2.0",
      id,
      result: {
        structuredContent: {
          status: cancelled ? "cancelled" : "completed",
          reason: cancelled
            ? "project_runtime_operation_cancelled"
            : "project_runtime_milestone_accepted",
          contract: "crdd-coordinator/project-runtime-objective-intake/v1",
          requestId: "request-a",
          projectId: "project-a",
          milestoneId: "milestone-a",
          queueId: "queue-a",
          projection: projection(cancelled),
          cleanupConfirmed: true,
          manualRecoveryRequired: false,
          processRestartRequired: false,
          recoveryIds: [],
          recoveryObligations: [],
          effectState: "settled",
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
    if (mode === "embedded-event")
      process.stderr.write(
        `diagnostic ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "executor", provider: "claude", operationId: "OP-UNTRUSTED" })}\n`,
      );
    if (mode === "malformed-known-prefix")
      process.stderr.write("[Coordinator lifecycle] {not-json}\n");
    process.stderr.write(
      `[Coordinator selection] ${JSON.stringify(selectionNotice("executor", mode === "cancelled" || mode === "parent-loss" ? "claude" : "codex"))}\n`,
    );
    process.stderr.write(
      `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "executor", provider: mode === "cancelled" || mode === "parent-loss" ? "claude" : "codex", operationId: mode === "cancelled" ? "OP-300001" : mode === "parent-loss" ? "OP-400001" : "OP-100001" })}\n`,
    );
    if (mode === "parent-loss") {
      setInterval(() => {}, 1000);
      return;
    }
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
            operationId: index < 5 ? "OP-100001" : null,
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
        `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "reviewer", provider: "claude", operationId: "OP-100002" })}\n`,
      );
    process.stdout.write(responseLine);
  }
});
process.stdin.on("end", () => {
  if (mode === "nonzero") process.exitCode = 7;
});
if (mode === "ignore-eof")
  process.stdin.on("end", () => setInterval(() => {}, 1000));

const mode = process.argv[2] ?? "normal";
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
    if (mode === "embedded-event")
      process.stderr.write(
        `diagnostic ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "executor", provider: "claude", operationId: "OP-UNTRUSTED" })}\n`,
      );
    process.stderr.write(
      `[Coordinator selection] ${JSON.stringify({ event: "coordinator_selection_before_provider_effect", taskRole: "executor", provider: mode === "cancelled" ? "claude" : "codex" })}\n`,
    );
    process.stderr.write(
      `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "executor", provider: mode === "cancelled" ? "claude" : "codex", operationId: mode === "cancelled" ? "OP-300001" : "OP-100001" })}\n`,
    );
    if (mode !== "cancelled")
      process.stderr.write(
        `[Coordinator selection] ${JSON.stringify({ event: "coordinator_selection_before_provider_effect", taskRole: "reviewer", provider: "claude" })}\n`,
      );
    if (mode !== "cancelled")
      process.stderr.write(
        `[Coordinator lifecycle] ${JSON.stringify({ event: "coordinator_provider_process_started", taskRole: "reviewer", provider: "claude", operationId: "OP-100002" })}\n`,
      );
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          structuredContent: {
            status: mode === "cancelled" ? "cancelled" : "completed",
            reason:
              mode === "cancelled"
                ? "project_runtime_operation_cancelled"
                : "project_runtime_milestone_accepted",
            contract: "crdd-coordinator/project-runtime-objective-intake/v1",
            requestId: "request-a",
            projectId: "project-a",
            milestoneId: "milestone-a",
            queueId: "queue-a",
            projection: projection(mode === "cancelled"),
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
            processRestartRequired: false,
            recoveryIds: [],
            recoveryObligations: [],
            effectState: "settled",
          },
        },
      })}\n`,
    );
  }
});
process.stdin.on("end", () => {
  if (mode === "nonzero") process.exitCode = 7;
});
if (mode === "ignore-eof")
  process.stdin.on("end", () => setInterval(() => {}, 1000));

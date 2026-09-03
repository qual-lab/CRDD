const mode = process.argv[2] ?? "normal";
let received = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  received += chunk;
  if (!received.includes("\n")) return;
  if (mode === "malformed") process.stdout.write("not-json\n");
  else if (mode === "overflow") process.stdout.write("x".repeat(4096));
  else {
    const request = JSON.parse(received.split(/\r?\n/u)[0]);
    const id = mode === "wrong-id" ? "wrong" : request.id;
    process.stderr.write(
      `${JSON.stringify({ event: "coordinator_selection_before_provider_effect" })}\n`,
    );
    process.stdout.write(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id,
        result: {
          structuredContent: {
            status: mode === "cancelled" ? "cancelled" : "completed",
            reason: "project_runtime_milestone_accepted",
            cleanupConfirmed: true,
            manualRecoveryRequired: false,
          },
        },
      })}\n`,
    );
  }
});
process.stdin.on("end", () => {
  if (mode === "nonzero") process.exitCode = 7;
});
if (mode === "ignore-eof") process.stdin.on("end", () => setInterval(() => {}, 1000));

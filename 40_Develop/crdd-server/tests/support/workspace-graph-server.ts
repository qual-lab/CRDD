/** 親のメモリを引き継がないNodeで、同じServer正式受付を一件だけ実行する。 @trace PRL-IT-012 */
import assert from "node:assert/strict";
import childProcess, { spawn } from "node:child_process";
import path from "node:path";
import { mock } from "node:test";
import { fileURLToPath } from "node:url";

const [root, control, rawRequest, observeUnknown] = process.argv.slice(2);
assert.ok(root && control && rawRequest);
assert.equal(control, path.join(root, ".crdd", "parallel-fixture"));
const expected = fileURLToPath(
  new URL("../../src/service/execution-child.ts", import.meta.url),
);
const preload = new URL("./workspace-graph-child.ts", import.meta.url).href;
const children: ReturnType<typeof spawn>[] = [];
const closed: Promise<void>[] = [];
const injected = mock.module("node:child_process", {
  defaultExport: childProcess,
  namedExports: {
    ...childProcess,
    spawn: (
      executable: string,
      argv: readonly string[],
      options: Parameters<typeof spawn>[2],
    ) => {
      assert.equal(executable, process.execPath);
      assert.deepEqual(argv, [expected]);
      const child = spawn(executable, ["--import", preload, ...argv], {
        ...options,
        env: {
          ...(options?.env ?? process.env),
          CRDD_GRAPH_FIXTURE_DIRECTORY: control,
          CRDD_GRAPH_FIXTURE_UNKNOWN_PID: observeUnknown ?? "",
        },
      });
      children.push(child);
      closed.push(
        new Promise((resolve) => child.once("close", () => resolve())),
      );
      return child;
    },
  },
});
const killLiveChildren = () => {
  for (const child of children)
    if (child.exitCode === null && child.signalCode === null)
      child.kill("SIGKILL");
};
// 試験外側のtimeoutより前に当該子をjoinする。期限超過は試験成功として返さない。
let expired = false;
const deadline = setTimeout(() => {
  expired = true;
  killLiveChildren();
}, 12_000);
deadline.unref();
try {
  const { executeCoordinatorOperation } = await import(
    "../../src/service/execution.ts"
  );
  const outcome = await executeCoordinatorOperation(
    "objective",
    JSON.parse(rawRequest),
    { scope: "local", repositoryRoot: root },
    AbortSignal.timeout(10_000),
  );
  assert.equal(expired, false, "fixture_dispatch_deadline");
  assert.equal(children.length, 1);
  process.stdout.write(JSON.stringify({ pid: process.pid, outcome }));
} finally {
  clearTimeout(deadline);
  killLiveChildren();
  await Promise.all(closed);
  injected.restore();
}

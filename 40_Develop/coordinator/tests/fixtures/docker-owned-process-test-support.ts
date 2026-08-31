import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDockerProcessEnvironment,
  startOwnedProcess,
  type OwnedCommandHandle,
} from "../../src/security/docker-owned-process.ts";

const repositoryRoot = fileURLToPath(new URL("../../../../", import.meta.url));
export const ownedProcessWorker = fileURLToPath(
  new URL("./docker-owned-process-worker.ts", import.meta.url),
);

export function isProcessPresent(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

export async function waitForCondition(condition: () => boolean) {
  const deadline = Date.now() + 5_000;
  while (!condition()) {
    assert.ok(Date.now() < deadline, "fixed worker observation timed out");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

export function createOwnedProcessTreeFixture() {
  for (const target of [
    repositoryRoot,
    path.join(repositoryRoot, ".crdd"),
    path.join(repositoryRoot, ".crdd", "test-tmp"),
  ]) {
    const metadata = fs.lstatSync(target);
    assert.ok(metadata.isDirectory() && !metadata.isSymbolicLink());
  }
  const directory = fs.mkdtempSync(
    path.join(repositoryRoot, ".crdd", "test-tmp", "owned-process-"),
  );
  const readinessPath = path.join(directory, "ready.json");
  let handle: OwnedCommandHandle | null = null;
  let observedPids: number[] = [];
  return {
    start() {
      assert.equal(handle, null);
      handle = startOwnedProcess(
        process.execPath,
        [ownedProcessWorker, "tree", readinessPath],
        createDockerProcessEnvironment(),
        null,
      );
      return handle;
    },
    async ready() {
      await waitForCondition(() => {
        if (!fs.existsSync(readinessPath)) return false;
        try {
          const pids: unknown = JSON.parse(
            fs.readFileSync(readinessPath, "utf8"),
          );
          if (
            !Array.isArray(pids) ||
            pids.length !== 2 ||
            !pids.every((pid) => Number.isSafeInteger(pid) && pid > 0)
          )
            return false;
          observedPids = pids;
          return true;
        } catch {
          return false;
        }
      });
      assert.ok(observedPids.every(isProcessPresent));
      return [...observedPids];
    },
    assertAbsent() {
      assert.equal(observedPids.length, 2);
      assert.ok(observedPids.every((pid) => !isProcessPresent(pid)));
      assert.equal(handle?.closed(), true);
    },
    async dispose() {
      if (handle) assert.equal(await handle.terminateAndWait(5_000), true);
      if (observedPids.length > 0) {
        await waitForCondition(() =>
          observedPids.every((pid) => !isProcessPresent(pid)),
        );
      }
      assert.ok(
        fs.lstatSync(directory).isDirectory() &&
          !fs.lstatSync(directory).isSymbolicLink(),
      );
      fs.rmSync(directory, { recursive: true });
      assert.equal(fs.existsSync(directory), false);
    },
  };
}

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectCoordinatorRuntimeTraceability } from "../src/core/runtime-traceability.ts";

const MAXIMUM_TEXT_BYTES = 8 * 1024 * 1024;
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const tracePath =
  "tools/coordinator/runtime/coordinator-runtime-traceability.json";

function readRegularRepositoryText(
  repositoryRelativePath: string,
): string | null {
  try {
    const segments = repositoryRelativePath.split("/");
    if (
      repositoryRelativePath.length === 0 ||
      repositoryRelativePath.includes("\\") ||
      segments.some(
        (segment) => segment === "" || segment === "." || segment === "..",
      )
    ) {
      return null;
    }
    let current = repositoryRoot;
    for (const segment of segments) {
      current = path.join(current, segment);
      const stats = fs.lstatSync(current);
      if (stats.isSymbolicLink()) return null;
    }
    const resolved = fs.realpathSync.native(current);
    const relative = path.relative(repositoryRoot, resolved);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    const stats = fs.statSync(resolved);
    if (!stats.isFile() || stats.size <= 0 || stats.size > MAXIMUM_TEXT_BYTES)
      return null;
    return fs.readFileSync(resolved, "utf8");
  } catch {
    return null;
  }
}

const rawTrace = readRegularRepositoryText(tracePath);
let trace: unknown = null;
if (rawTrace !== null) {
  try {
    trace = JSON.parse(rawTrace);
  } catch {
    trace = null;
  }
}
const result = inspectCoordinatorRuntimeTraceability(
  trace,
  readRegularRepositoryText,
);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.status !== "accepted") process.exitCode = 2;

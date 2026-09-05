import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectProjectRuntimeDesignTraceability } from "../src/core/project-runtime-design-traceability.ts";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "../../..");
const TRACE_PATH =
  "40_Develop/coordinator/runtime/project-runtime-design-traceability.json";

function readRepositoryText(repositoryRelativePath: string): string | null {
  try {
    const target = path.join(
      repositoryRoot,
      ...repositoryRelativePath.split("/"),
    );
    const relative = path.relative(repositoryRoot, target);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
    const stats = fs.lstatSync(target);
    if (!stats.isFile() || stats.isSymbolicLink()) return null;
    return fs.readFileSync(target, "utf8");
  } catch {
    return null;
  }
}

let trace: unknown = null;
const source = readRepositoryText(TRACE_PATH);
if (source !== null) {
  try {
    trace = JSON.parse(source);
  } catch {
    trace = null;
  }
}
const result = inspectProjectRuntimeDesignTraceability(
  trace,
  readRepositoryText,
);
process.stdout.write(`${JSON.stringify(result)}\n`);
if (result.status !== "accepted") process.exitCode = 2;

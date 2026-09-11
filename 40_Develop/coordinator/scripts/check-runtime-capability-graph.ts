import fs from "node:fs";
import path from "node:path";

import { assertVerificationToolCapabilityGraphForVerification } from "../src/security/platform-provisioner-package-filesystem.ts";

const scriptsRoot = path.resolve(import.meta.dirname);
const sources: Record<string, string> = {};

function collectTypeScriptSources(root: string, relativeRoot: string) {
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error("runtime_capability_graph_script_link_forbidden");
    const relativePath = `${relativeRoot}/${entry.name}`;
    const absolutePath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      collectTypeScriptSources(absolutePath, relativePath);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts")) continue;
    sources[relativePath.replaceAll("\\", "/")] = fs.readFileSync(
      absolutePath,
      "utf8",
    );
  }
}

collectTypeScriptSources(scriptsRoot, "scripts");

assertVerificationToolCapabilityGraphForVerification(Object.freeze(sources));
process.stdout.write(
  `${JSON.stringify({ status: "accepted", sourceCount: Object.keys(sources).length, externalProcessCallCount: 6 })}\n`,
);

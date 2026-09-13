import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryRoot = path.resolve(packageRoot, "../..");
const source = path.join(
  packageRoot,
  "src",
  "distribution",
  "checker-version-control-runtime.ts",
);
const target = path.join(
  repositoryRoot,
  "template",
  "tools",
  "internal",
  "version-control-runtime.ts",
);
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);

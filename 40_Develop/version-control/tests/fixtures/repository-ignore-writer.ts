import fs from "node:fs";

import { resolveRepositoryGitLayout } from "../../src/git/repository-layout.ts";
import { writeRepositoryLocalExclude } from "../../src/git/repository-layout.ts";

const [repositoryRoot, entry, readyPath, startPath, resultPath] =
  process.argv.slice(2);
if (!repositoryRoot || !entry || !readyPath || !startPath || !resultPath)
  throw new Error("repository_ignore_writer_arguments_required");

const layout = resolveRepositoryGitLayout(repositoryRoot);
fs.writeFileSync(readyPath, "ready\n", { flag: "wx" });
const deadline = Date.now() + 10_000;
while (!fs.existsSync(startPath)) {
  if (Date.now() >= deadline)
    throw new Error("repository_ignore_writer_timeout");
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
}
const result = writeRepositoryLocalExclude(layout, entry);
fs.writeFileSync(resultPath, `${JSON.stringify(result)}\n`, { flag: "wx" });

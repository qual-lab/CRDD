import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type InventoryEntry = Readonly<{
  path: string;
  currentness: "current" | "fixed_history";
  currentTreeBlobOid?: string;
  [key: string]: unknown;
}>;

type Inventory = Readonly<{
  schemaRevision: number;
  populationSource: string;
  evaluatedDocumentationSetSha256: string;
  entries: readonly InventoryEntry[];
}>;

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const inventoryPath = path.join(
  repositoryRoot,
  "07_Quality",
  "07_Structured_Document_Disposition_Inventory.json",
);

function gitBlobOid(bytes: Buffer): string {
  return createHash("sha1")
    .update(Buffer.from(`blob ${bytes.length}\0`, "utf8"))
    .update(bytes)
    .digest("hex");
}

function markdownPaths(): readonly string[] {
  return execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "--", "*.md"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    },
  )
    .split(/\r?\n/u)
    .filter(Boolean)
    .sort();
}

function documentationSetHash(
  rows: readonly Readonly<{ path: string; blobOid: string }>[],
): string {
  const canonical = rows.map((row) => `${row.path}\0${row.blobOid}\n`).join("");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

const parsed: unknown = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
  throw new Error("document_disposition_inventory_invalid");
const inventory = parsed as Inventory;
if (
  inventory.schemaRevision !== 1 ||
  inventory.populationSource !== "git_worktree_markdown" ||
  !Array.isArray(inventory.entries)
)
  throw new Error("document_disposition_inventory_contract_invalid");

const paths = markdownPaths();
const entriesByPath = new Map(
  inventory.entries.map((entry) => [entry.path, entry]),
);
if (
  entriesByPath.size !== inventory.entries.length ||
  paths.length !== inventory.entries.length ||
  paths.some((item) => !entriesByPath.has(item))
)
  throw new Error("document_disposition_inventory_population_mismatch");

const rows = paths.map((relativePath) => ({
  path: relativePath,
  blobOid: gitBlobOid(fs.readFileSync(path.join(repositoryRoot, relativePath))),
}));
const updatedEntries = rows.map((row) => {
  const entry = entriesByPath.get(row.path);
  if (!entry) throw new Error("document_disposition_inventory_entry_missing");
  if (entry.currentness === "fixed_history") {
    if (entry.currentTreeBlobOid !== row.blobOid)
      throw new Error("document_disposition_fixed_history_modified");
    return entry;
  }
  return { ...entry, currentBlobOid: row.blobOid };
});
const updated = {
  ...inventory,
  evaluatedDocumentationSetSha256: documentationSetHash(rows),
  entries: updatedEntries,
};
fs.writeFileSync(inventoryPath, `${JSON.stringify(updated, null, 2)}\n`, {
  encoding: "utf8",
  flag: "w",
});
process.stdout.write(
  `${JSON.stringify({ status: "completed", markdownCount: paths.length })}\n`,
);

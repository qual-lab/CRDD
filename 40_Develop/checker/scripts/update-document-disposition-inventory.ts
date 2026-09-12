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

type MigrationEntry = Readonly<{
  source: string;
  target: string;
  sourceSha256: string;
  sourceBytes: number;
  targetSha256: string;
  targetBytes: number;
  currentnessAtMigration: "current" | "fixed_history";
}>;

type MigrationManifest = Readonly<{
  contract: "crdd/work-lifecycle-migration-map";
  contractRevision: 1;
  sourceCommit: string;
  sourceTree: string;
  transformationContract: "fixed-history-byte-preserving-v3";
  status: "migrated";
  changes: number;
  changeEvidence: number;
  verificationResults: number;
  releases: readonly string[];
  totalMoves: number;
  entries: readonly MigrationEntry[];
}>;

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const inventoryPath = path.join(
  repositoryRoot,
  "07_Quality",
  "07_Structured_Document_Disposition_Inventory.json",
);
const migrationPath = path.join(
  repositoryRoot,
  "99_Roadmap",
  "Changes",
  "CHG-000070",
  "Evidence",
  "260912-2142_migration-map.json",
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

function isCanonicalRepositoryRelativePath(value: string): boolean {
  return (
    value.length > 0 &&
    value === value.replaceAll("\\", "/") &&
    !path.posix.isAbsolute(value) &&
    !/^[a-z]:/iu.test(value) &&
    path.posix.normalize(value) === value &&
    value
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function isAllowedMigrationTarget(source: string, target: string): boolean {
  if (source === "99_Roadmap/01_Product_Roadmap.md")
    return target === "99_Roadmap/01_Roadmap.md";
  if (source === "90_Release/Changes/README.md")
    return target === "99_Roadmap/02_Changes.md";
  const change = source.match(
    /^90_Release\/Changes\/(CHG-[0-9]{6})_[^/]+\.md$/u,
  )?.[1];
  if (change) return target === `99_Roadmap/Changes/${change}/change.md`;
  if (source.startsWith("90_Release/Changes/Evidence/"))
    return /^99_Roadmap\/Changes\/CHG-[0-9]{6}\/Evidence\/[^/]+$/u.test(target);
  if (source.startsWith("07_Quality/Verification_Results/"))
    return (
      /^99_Roadmap\/Changes\/CHG-[0-9]{6}\/Evidence\/[^/]+$/u.test(target) ||
      /^99_Roadmap\/Releases\/v[0-9]+\.[0-9]+\.[0-9]+\/Evidence\/[^/]+$/u.test(
        target,
      )
    );
  const templateTargets = new Map([
    [
      "template/99_Roadmap/01_Product_Roadmap.md",
      "template/99_Roadmap/01_Roadmap.md",
    ],
    [
      "template/90_Release/Changes/CHG-XXXXXX_Template.md",
      "template/99_Roadmap/Changes/CHG-XXXXXX/change.md",
    ],
    [
      "template/90_Release/Evidence/.gitkeep",
      "template/99_Roadmap/Changes/CHG-XXXXXX/Evidence/.gitkeep",
    ],
  ]);
  return templateTargets.get(source) === target;
}

function isMigrationSourcePath(value: string): boolean {
  return (
    value === "99_Roadmap/01_Product_Roadmap.md" ||
    value === "90_Release/Changes/README.md" ||
    /^90_Release\/Changes\/CHG-[0-9]{6}_[^/]+\.md$/u.test(value) ||
    value.startsWith("90_Release/Changes/Evidence/") ||
    value.startsWith("07_Quality/Verification_Results/") ||
    value === "template/99_Roadmap/01_Product_Roadmap.md" ||
    value === "template/90_Release/Changes/CHG-XXXXXX_Template.md" ||
    value === "template/90_Release/Evidence/.gitkeep"
  );
}

function expectedCurrentness(
  relativePath: string,
): "current" | "fixed_history" {
  const migration = migrationsByTarget.get(relativePath);
  if (migration) {
    const sourceCurrentness = deriveMigrationCurrentness(migration.source);
    if (!sourceCurrentness)
      throw new Error("work_lifecycle_migration_currentness_unknown");
    if (sourceCurrentness !== migration.currentnessAtMigration)
      throw new Error("work_lifecycle_migration_currentness_mismatch");
    return sourceCurrentness;
  }
  const change = relativePath.match(
    /^99_Roadmap\/Changes\/(CHG-[0-9]{6})\/change\.md$/u,
  )?.[1];
  if (change && change !== "CHG-000057") {
    const number = Number.parseInt(change.slice(4), 10);
    if (number <= 60 && ![16, 18, 19].includes(number)) return "fixed_history";
  }
  return "current";
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
if (entriesByPath.size !== inventory.entries.length)
  throw new Error("document_disposition_inventory_population_mismatch");

const migrationRaw: unknown = JSON.parse(
  fs.readFileSync(migrationPath, "utf8"),
);
if (
  !migrationRaw ||
  typeof migrationRaw !== "object" ||
  Array.isArray(migrationRaw) ||
  (migrationRaw as Record<string, unknown>).contract !==
    "crdd/work-lifecycle-migration-map" ||
  (migrationRaw as Record<string, unknown>).contractRevision !== 1 ||
  !/^[a-f0-9]{40}$/u.test(
    String((migrationRaw as Record<string, unknown>).sourceCommit ?? ""),
  ) ||
  !/^[a-f0-9]{40}$/u.test(
    String((migrationRaw as Record<string, unknown>).sourceTree ?? ""),
  ) ||
  (migrationRaw as Record<string, unknown>).transformationContract !==
    "fixed-history-byte-preserving-v3" ||
  (migrationRaw as Record<string, unknown>).status !== "migrated" ||
  !Array.isArray((migrationRaw as { entries?: unknown }).entries)
)
  throw new Error("work_lifecycle_migration_manifest_invalid");
const migrationManifest = migrationRaw as MigrationManifest;
const migrations = migrationManifest.entries;
if (
  migrationManifest.totalMoves !== migrations.length ||
  !Number.isSafeInteger(migrationManifest.changes) ||
  !Number.isSafeInteger(migrationManifest.changeEvidence) ||
  !Number.isSafeInteger(migrationManifest.verificationResults) ||
  !Array.isArray(migrationManifest.releases) ||
  migrations.some(
    (entry) =>
      !entry ||
      typeof entry.source !== "string" ||
      typeof entry.target !== "string" ||
      !isCanonicalRepositoryRelativePath(entry.source) ||
      !isCanonicalRepositoryRelativePath(entry.target) ||
      !isAllowedMigrationTarget(entry.source, entry.target) ||
      !/^[a-f0-9]{64}$/u.test(entry.sourceSha256) ||
      !Number.isSafeInteger(entry.sourceBytes) ||
      entry.sourceBytes < 0 ||
      !/^[a-f0-9]{64}$/u.test(entry.targetSha256) ||
      !Number.isSafeInteger(entry.targetBytes) ||
      entry.targetBytes < 0 ||
      !["current", "fixed_history"].includes(entry.currentnessAtMigration),
  )
)
  throw new Error("work_lifecycle_migration_entry_invalid");
const ancestor = execFileSync(
  "git",
  ["merge-base", "--is-ancestor", migrationManifest.sourceCommit, "HEAD"],
  {
    cwd: repositoryRoot,
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore"],
  },
);
void ancestor;
const observedSourceTree = execFileSync(
  "git",
  ["show", "-s", "--format=%T", migrationManifest.sourceCommit],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  },
).trim();
if (observedSourceTree !== migrationManifest.sourceTree)
  throw new Error("work_lifecycle_migration_source_identity_invalid");
const sourceInventory = JSON.parse(
  execFileSync(
    "git",
    [
      "show",
      `${migrationManifest.sourceCommit}:07_Quality/07_Structured_Document_Disposition_Inventory.json`,
    ],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      windowsHide: true,
      stdio: ["ignore", "pipe", "ignore"],
    },
  ),
) as { entries?: readonly InventoryEntry[] };
if (!Array.isArray(sourceInventory.entries))
  throw new Error("work_lifecycle_source_disposition_invalid");
const sourceCurrentness = new Map(
  sourceInventory.entries.map((entry) => [entry.path, entry.currentness]),
);
if (sourceCurrentness.size !== sourceInventory.entries.length)
  throw new Error("work_lifecycle_source_disposition_duplicate");
function deriveMigrationCurrentness(
  source: string,
): "current" | "fixed_history" | null {
  if (path.posix.extname(source).toLowerCase() === ".md")
    return sourceCurrentness.get(source) ?? null;
  if (
    source.startsWith("90_Release/Changes/Evidence/") ||
    source.startsWith("07_Quality/Verification_Results/")
  )
    return "fixed_history";
  return "current";
}
const migrationsByTarget = new Map(
  migrations.map((entry) => [entry.target, entry]),
);
const migrationsBySource = new Map(
  migrations.map((entry) => [entry.source, entry]),
);
if (migrationsByTarget.size !== migrations.length)
  throw new Error("work_lifecycle_migration_target_duplicate");
if (migrationsBySource.size !== migrations.length)
  throw new Error("work_lifecycle_migration_source_duplicate");
const sourcePaths = execFileSync(
  "git",
  ["ls-tree", "-r", "--name-only", migrationManifest.sourceCommit],
  {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
  },
)
  .split(/\r?\n/u)
  .filter(isMigrationSourcePath);
if (
  sourcePaths.length !== migrationsBySource.size ||
  sourcePaths.some((source) => !migrationsBySource.has(source))
)
  throw new Error("work_lifecycle_migration_population_mismatch");
for (const migration of migrations) {
  const derived = deriveMigrationCurrentness(migration.source);
  const target = path.resolve(repositoryRoot, migration.target);
  if (
    derived === null ||
    derived !== migration.currentnessAtMigration ||
    target !== path.join(repositoryRoot, ...migration.target.split("/")) ||
    !target.startsWith(`${repositoryRoot}${path.sep}`) ||
    !fs.statSync(target).isFile()
  )
    throw new Error("work_lifecycle_migration_closure_invalid");
}
const observedChanges = migrations.filter((entry) =>
  /^90_Release\/Changes\/CHG-[0-9]{6}_[^/]+\.md$/u.test(entry.source),
).length;
const observedChangeEvidence = migrations.filter((entry) =>
  entry.source.startsWith("90_Release/Changes/Evidence/"),
).length;
const observedVerificationResults = migrations.filter((entry) =>
  entry.source.startsWith("07_Quality/Verification_Results/"),
).length;
const observedReleases = [
  ...new Set(
    migrations.flatMap(
      (entry) =>
        entry.target
          .match(
            /^99_Roadmap\/Releases\/(v[0-9]+\.[0-9]+\.[0-9]+)\/Evidence\//u,
          )
          ?.slice(1, 2) ?? [],
    ),
  ),
].sort();
if (
  migrationManifest.changes !== observedChanges ||
  migrationManifest.changeEvidence !== observedChangeEvidence ||
  migrationManifest.verificationResults !== observedVerificationResults ||
  JSON.stringify([...migrationManifest.releases].sort()) !==
    JSON.stringify(observedReleases)
)
  throw new Error("work_lifecycle_migration_summary_mismatch");

const rows = paths.map((relativePath) => ({
  path: relativePath,
  blobOid: gitBlobOid(fs.readFileSync(path.join(repositoryRoot, relativePath))),
}));
const updatedEntries = rows.map((row) => {
  const entry = entriesByPath.get(row.path);
  const expected = expectedCurrentness(row.path);
  if (!entry) {
    return {
      path: row.path,
      artifactRole: row.path.startsWith("99_Roadmap/Releases/")
        ? "release_record"
        : row.path.startsWith("99_Roadmap/Changes/")
          ? "release_change"
          : "other",
      currentness: expected,
      disposition: "already_structured",
      reasonCode: "existing_structure_sufficient",
      canonicalOwnerPath: row.path,
      currentBlobOid: row.blobOid,
    };
  }
  if (expected === "fixed_history") {
    const migration = migrationsByTarget.get(row.path);
    if (!migration)
      throw new Error("document_disposition_fixed_history_migration_missing");
    const targetBytes = fs.readFileSync(path.join(repositoryRoot, row.path));
    const targetSha256 = createHash("sha256").update(targetBytes).digest("hex");
    if (
      targetSha256 !== migration.targetSha256 ||
      targetBytes.length !== migration.targetBytes
    )
      throw new Error("document_disposition_fixed_history_modified");
    const sourceBytes = execFileSync(
      "git",
      ["show", `${migrationManifest.sourceCommit}:${migration.source}`],
      {
        cwd: repositoryRoot,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "buffer",
      },
    );
    if (
      createHash("sha256").update(sourceBytes).digest("hex") !==
        migration.sourceSha256 ||
      sourceBytes.length !== migration.sourceBytes
    )
      throw new Error("document_disposition_fixed_history_source_mismatch");
    const previousHistoricalIdentity =
      typeof entry.historicalIdentity === "object" &&
      entry.historicalIdentity !== null
        ? (entry.historicalIdentity as Record<string, unknown>)
        : null;
    const historicalRef =
      typeof previousHistoricalIdentity?.ref === "string"
        ? previousHistoricalIdentity.ref
        : "v0.20.0";
    const historicalRefKind =
      previousHistoricalIdentity?.refKind === "commit" ? "commit" : "tag";
    const historicalBytes = execFileSync(
      "git",
      ["show", `${historicalRef}:${migration.source}`],
      {
        cwd: repositoryRoot,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
        encoding: "buffer",
      },
    );
    return {
      ...entry,
      currentness: "fixed_history" as const,
      disposition: "fixed_original_with_structured_index",
      reasonCode: "published_bytes_preserved",
      historicalIdentity: {
        refKind: historicalRefKind,
        ref: historicalRef,
        path: migration.source,
        blobOid: gitBlobOid(historicalBytes),
      },
      currentTreeBlobOid: row.blobOid,
      currentRoute: row.path.startsWith("99_Roadmap/Releases/")
        ? "99_Roadmap/03_Releases.md"
        : "99_Roadmap/02_Changes.md",
      canonicalOwnerPath: undefined,
      currentBlobOid: undefined,
    };
  }
  if (entry.currentness === "fixed_history") {
    const migration = migrationsByTarget.get(row.path);
    if (
      !migration ||
      deriveMigrationCurrentness(migration.source) !== "current"
    )
      throw new Error(
        "document_disposition_fixed_history_reclassification_invalid",
      );
    return {
      ...entry,
      currentness: "current" as const,
      disposition: "already_structured",
      reasonCode: "existing_structure_sufficient",
      canonicalOwnerPath: row.path,
      currentBlobOid: row.blobOid,
      historicalIdentity: undefined,
      currentTreeBlobOid: undefined,
      currentRoute: undefined,
    };
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

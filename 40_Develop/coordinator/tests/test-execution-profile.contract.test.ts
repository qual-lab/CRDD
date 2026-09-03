import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const gatePrefix = "Windows Process Gate:";
const gateFiles = [
  {
    file: "coordinator-task-process.integration.test.ts",
    prefixOccurrences: 1,
    expandedCases: 2,
    expansion: /for \(const cleanupConfirmed of \[true, false\]\)/,
  },
  {
    file: "docker-owned-process.integration.test.ts",
    prefixOccurrences: 2,
    expandedCases: 3,
    expansion: /for \(const mode of \["stdout-limit", "stderr-limit"\]\)/,
  },
  {
    file: "docker-process-controller.contract.test.ts",
    prefixOccurrences: 1,
    expandedCases: 2,
    expansion: /for \(const dockerCleanupConfirmed of \[true, false\]\)/,
  },
] as const;

const packageJson = JSON.parse(
  fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { scripts?: Record<string, string> };

function discoverGateFiles(
  files: readonly string[],
  read: (file: string) => string,
) {
  return files.filter(
    (file) =>
      file !== "test-execution-profile.contract.test.ts" &&
      read(file).includes(gatePrefix),
  );
}

test("制限Process用試験と実Windows Process Gateは同じ7件の閉集合を所有する", () => {
  const scripts = packageJson.scripts ?? {};
  assert.match(
    scripts["test:restricted-process"] ?? "",
    /--test-skip-pattern=\^Windows Process Gate:/,
  );
  assert.match(
    scripts["test:windows-process"] ?? "",
    /--test-name-pattern=\^Windows Process Gate:/,
  );
  assert.equal(
    scripts.test,
    "npm run test:windows-process && npm run test:restricted-process",
  );
  assert.doesNotMatch(scripts.test ?? "", /test-(?:skip|name)-pattern/);

  let gateCount = 0;
  const testDirectory = new URL(".", import.meta.url);
  const allTestFiles = fs
    .readdirSync(testDirectory)
    .filter((file) => file.endsWith(".test.ts"));
  const allowedGateFiles = new Set(gateFiles.map(({ file }) => file));
  const discoveredGateFiles = discoverGateFiles(allTestFiles, (file) =>
    fs.readFileSync(new URL(file, testDirectory), "utf8"),
  );
  assert.deepEqual(discoveredGateFiles.sort(), [...allowedGateFiles].sort());
  for (const {
    file,
    prefixOccurrences,
    expandedCases,
    expansion,
  } of gateFiles) {
    const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
    const occurrences = source.split(gatePrefix).length - 1;
    assert.equal(occurrences, prefixOccurrences);
    assert.match(source, expansion);
    gateCount += expandedCases;
    assert.match(scripts["test:windows-process"] ?? "", new RegExp(file));
  }
  assert.equal(gateCount, 7);
});

test("未分類のWindows Process Gateを別試験ファイルへ追加すると閉集合が不一致になる", () => {
  const files = [
    "test-execution-profile.contract.test.ts",
    ...gateFiles.map(({ file }) => file),
    "unclassified-process.test.ts",
  ];
  const discovered = discoverGateFiles(files, (file) =>
    file === "unclassified-process.test.ts" ? gatePrefix : "",
  );
  assert.deepEqual(discovered, ["unclassified-process.test.ts"]);
  assert.notDeepEqual(
    discovered.sort(),
    gateFiles.map(({ file }) => file).sort(),
  );
});

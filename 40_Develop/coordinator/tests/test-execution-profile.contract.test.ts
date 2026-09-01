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
  assert.doesNotMatch(scripts.test ?? "", /test-(?:skip|name)-pattern/);

  let gateCount = 0;
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

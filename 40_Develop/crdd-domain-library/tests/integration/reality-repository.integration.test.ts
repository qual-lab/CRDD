/**
 * crdd-domain-library:integration:reality-repositoryの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility crdd-domain-library:integration:reality-repositoryが所有する検証責務を実行する。
 * @trace RFD-IT-012
 * @level IT
 * @scope domain、reality、repository、boundary
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyRepositoryRoot } from "../../../version-control/src/repository-identity/index.ts";

import {
  createRealitySymbolGraph,
  validateRealitySymbolManifest,
} from "../../src/reality-traceability/index.ts";
import { createFilesystemRepositoryObservationPort } from "../../src/repository-observation/index.ts";

/**
 * Repository観測をReality Symbol契約へ渡してGraphを構築するを検証する。
 *
 * @responsibility Repository観測をReality Symbol契約へ渡してGraphを構築するの合否判定を所有する。
 * @trace RFD-IT-012
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository観測をReality Symbol契約へ渡してGraphを構築するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary Direct Boundary: 検証済みRoot→Repository Observation Port→regular file／directory
 */
test("Repository観測をReality Symbol契約へ渡してGraphを構築する", () => {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../..",
  );
  const verified = verifyRepositoryRoot(root);
  assert.equal(verified.status, "completed");
  if (verified.status !== "completed") return;
  const observed = createFilesystemRepositoryObservationPort(
    verified.capability,
  ).observeDirectory("40_Develop/crdd-domain-library");
  assert.equal(observed.status, "resolved");

  const observedFile = createFilesystemRepositoryObservationPort(
    verified.capability,
  ).observeFile("40_Develop/crdd-domain-library/package.json");
  assert.equal(observedFile.status, "resolved");
  if (observedFile.status === "resolved")
    assert.equal(
      JSON.parse(observedFile.source).name,
      "@qual-lab/crdd-domain-library",
    );

  const manifestPath = "40_Develop/crdd-domain-library/symbol.json";
  const manifest = {
    contract: "crdd/reality-symbol-manifest",
    contractRevision: 1,
    subsystem: "fixture",
    symbols: [
      {
        symbolId: "fixture.entry",
        kind: "module",
        path: "src/index.ts",
        archIds: ["ARCH-000008"],
      },
    ],
  };
  const validated = validateRealitySymbolManifest(manifest, manifestPath);
  assert.deepEqual(validated.issues, []);
  assert.ok(validated.result);
  if (!validated.result) return;
  const result = createRealitySymbolGraph(
    [
      {
        manifestPath,
        subsystemRoot: root,
        manifest: validated.result,
      },
    ],
    new Set(["ARCH-000008"]),
    new Set(),
    new Map(),
    new Map(),
    [],
  );
  assert.deepEqual(result.issues, []);
  assert.equal(result.result?.symbolsById.has("fixture.entry"), true);
});

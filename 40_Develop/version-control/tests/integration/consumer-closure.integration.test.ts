/**
 * version-control:integration:consumer-closureの検証範囲を定義する。
 *
 * @packageDocumentation
 * @responsibility version-control:integration:consumer-closureが所有する検証責務を実行する。
 * @trace RCM-IT-004
 * @level IT
 * @scope version-control、consumer-closure
 * @boundary RCM-IT-004=Related 2 Blocks: 旧Consumer→新Contract→完成Gate
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  type ChangesResult,
  type CommitCreateRequest,
  type CommitCreateResult,
  type CommitMergeRequest,
  type CommitMergeResult,
  createCommit,
  createReference,
  mergeCommit,
  pushRepositoryRevision,
  type ReferenceCreateRequest,
  type ReferenceResult,
  type Repository,
  type RepositoryPushRequest,
} from "../../src/index.ts";
import { getRepository } from "../../src/repository/location.ts";

/**
 * publicExportNamesのTest準備責務を実行する。
 *
 * @responsibility publicExportNamesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus publicExportNamesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
function publicExportNames(source: string): readonly string[] {
  const names: string[] = [];
  for (const block of source.matchAll(
    /export\s+(?:type\s+)?\{([\s\S]*?)\}\s*from/gu,
  ))
    for (const raw of block[1]?.split(",") ?? []) {
      const normalized = raw.trim().replace(/^type\s+/u, "");
      if (normalized.length > 0)
        names.push(normalized.split(/\s+as\s+/u).at(-1) ?? normalized);
    }
  return [...new Set(names)].sort();
}

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const developRoot = path.join(repositoryRoot, "40_Develop");

/** 公開操作の入力構築・結果保持に必要なOwner型がRootから直接参照できる。 */
test("完成操作は既存の明示Request／Result型で参照できる", () => {
  const operations: {
    create: (
      repository: Repository,
      request: CommitCreateRequest,
    ) => CommitCreateResult;
    merge: (
      repository: Repository,
      request: CommitMergeRequest,
    ) => CommitMergeResult;
    push: (
      repository: Repository,
      request: RepositoryPushRequest,
    ) => ChangesResult;
    reference: (
      repository: Repository,
      request: ReferenceCreateRequest,
    ) => ReferenceResult;
  } = {
    create: createCommit,
    merge: mergeCommit,
    push: pushRepositoryRevision,
    reference: createReference,
  };
  assert.equal(operations.create, createCommit);
  assert.equal(operations.merge, mergeCommit);
  assert.equal(operations.push, pushRepositoryRevision);
  assert.equal(operations.reference, createReference);
});

/**
 * Repository Locationの公開ProjectionにGit固有語彙を出さないを検証する。
 *
 * @responsibility Repository Locationの公開ProjectionにGit固有語彙を出さないの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository Locationの公開ProjectionにGit固有語彙を出さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("Repository Locationの公開ProjectionにGit固有語彙を出さない", () => {
  const observed = getRepository(repositoryRoot);
  assert.equal(observed.status, "completed");
  assert.ok(observed.capability);
  const projection = JSON.stringify(observed.capability);
  for (const term of ["commit", "tree", "index", "worktree", "staged"])
    assert.equal(projection.toLocaleLowerCase("en-US").includes(term), false);
});

/**
 * Version Controlの公開SymbolはArchitectureの現行集合と完全一致するを検証する。
 *
 * @responsibility Version Controlの公開SymbolはArchitectureの現行集合と完全一致するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Version Controlの公開SymbolはArchitectureの現行集合と完全一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("Version Controlの公開SymbolはArchitectureの現行集合と完全一致する", () => {
  const source = fs.readFileSync(
    path.join(
      repositoryRoot,
      "40_Develop",
      "version-control",
      "src",
      "index.ts",
    ),
    "utf8",
  );
  const architecture = fs.readFileSync(
    path.join(
      repositoryRoot,
      "06_Architecture",
      "Details",
      "version-control",
      "01_Architecture.md",
    ),
    "utf8",
  );
  const section = /### 3\.1 現行公開Symbol\r?\n([\s\S]*?)\r?\n### 3\.2/u.exec(
    architecture,
  )?.[1];
  assert.ok(section, "Version Control Architectureの公開Symbol節");
  const declaredExports = [...section.matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/gu)]
    .map((match) => match[1] ?? "")
    .filter(Boolean)
    .sort();
  assert.deepEqual(publicExportNames(source), declaredExports);

  const narrowEntrypoints = [
    {
      heading: "Checker Observation",
      sourcePath: "40_Develop/version-control/src/index.ts",
    },
    {
      heading: "Repository Identity",
      sourcePath: "40_Develop/version-control/src/index.ts",
    },
  ] as const;
  for (const entrypoint of narrowEntrypoints) {
    const narrowSource = fs.readFileSync(
      path.join(repositoryRoot, entrypoint.sourcePath),
      "utf8",
    );
    const narrowSection = new RegExp(
      `#### ${entrypoint.heading}\\r?\\n([\\s\\S]*?)(?:\\r?\\n#### |\\r?\\n## 4\\.)`,
      "u",
    ).exec(architecture)?.[1];
    assert.ok(narrowSection, `${entrypoint.heading}の公開Symbol節`);
    const narrowDeclaredExports = [
      ...narrowSection.matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/gu),
    ]
      .map((match) => match[1] ?? "")
      .filter(Boolean)
      .sort();
    const rootNames = publicExportNames(narrowSource);
    for (const name of narrowDeclaredExports)
      assert.ok(rootNames.includes(name), `${entrypoint.heading}: ${name}`);
  }
});

/**
 * 配置観測と除外設定更新の所有者が分離されていることを検証する。
 *
 * @responsibility 書込み入口の単一OwnerとPackage公開APIの非拡張を確認する。
 * @trace RCM-IT-004
 * @precondition 現行PackageのSourceを読取り可能である。
 * @stimulus Layout、除外更新Adapter、Package公開入口を読み取る。
 * @observation 関数宣言、Filesystem更新呼出し、公開exportを取得する。
 * @oracle 更新入口と書込みはAdapterだけに存在し、内部primitiveをRootへ公開しない。
 * @cleanup N/A: Sourceの読取りだけで資源を生成しない。
 * @boundary RCM-IT-004=Related 2 Blocks: Layout観測→除外更新Adapter
 */
test("Git配置観測は除外更新を所有せず内部primitiveをRootへ公開しない", () => {
  const sourceRoot = path.join(developRoot, "version-control", "src");
  const layout = fs.readFileSync(
    path.join(sourceRoot, "repository/layout.ts"),
    "utf8",
  );
  const update = fs.readFileSync(
    path.join(sourceRoot, "repository/ignore.ts"),
    "utf8",
  );
  const root = fs.readFileSync(path.join(sourceRoot, "index.ts"), "utf8");
  assert.doesNotMatch(layout, /function writeRepositoryLocalExclude/u);
  assert.doesNotMatch(layout, /fs\.(?:writeSync|renameSync|unlinkSync)\(/u);
  assert.match(update, /export function writeRepositoryLocalExclude\(/u);
  assert.match(update, /fs\.renameSync\(lockPath, excludePath\)/u);
  for (const internalName of [
    "writeRepositoryLocalExclude",
    "verifyLayoutForWrite",
    "readStableFileBytes",
    "verifyEntitySnapshot",
  ]) {
    assert.ok(!publicExportNames(root).includes(internalName));
  }
});

/** VC内部の旧Candidate分類が再導入されないことを確認する。
 * @trace RCM-IT-004
 * @precondition 現行VC Sourceを読める。
 * @stimulus VC Sourceだけを走査する。
 * @observation 内部分類文字列を取得する。
 * @oracle 旧Candidate分類を含まない。
 * @cleanup N/A: Source読取りのみ。
 * @boundary VCの内部語彙。
 */
test("Version Control内部に旧Candidate分類を残さない", () => {
  for (const file of fs.globSync("**/*.ts", {
    cwd: path.join(developRoot, "version-control/src"),
  })) {
    const source = fs.readFileSync(
      path.join(developRoot, "version-control/src", file),
      "utf8",
    );
    assert.doesNotMatch(source, /["']candidate_[a-z_]+["']/u, file);
  }
});

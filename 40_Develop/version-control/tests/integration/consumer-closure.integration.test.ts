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

import { describeRepositoryLocationContract } from "../../src/repository/location.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../../../..");
const developRoot = path.join(repositoryRoot, "40_Develop");

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
  for (const block of source.matchAll(/export\s*\{([\s\S]*?)\}\s*from/gu))
    for (const raw of block[1]?.split(",") ?? []) {
      const normalized = raw.trim().replace(/^type\s+/u, "");
      if (normalized.length > 0)
        names.push(normalized.split(/\s+as\s+/u).at(-1) ?? normalized);
    }
  return [...new Set(names)].sort();
}

/**
 * 正式Rootから利用するNamed Symbolを取得する。
 *
 * @responsibility Pathではなく用途別Symbol集合からConsumerを照合する。
 * @trace RCM-IT-004
 * @precondition 読取り済みSourceを渡す。
 * @stimulus 正式Rootへのimport宣言を走査する。
 * @observation Alias前のNamed Symbolを取得する。
 * @oracle 呼出し側が固定用途集合と照合する。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary N/A: 同一Process内のSource検査である。
 */
function importedVersionControlNames(source: string): readonly string[] {
  // 宣言とliteralだけを照合する。計算されたspecifierの解決は対象外。
  const tokens: string[] = [];
  const modes: (
    | { kind: "code"; depth: number }
    | { kind: "template"; tokenIndex: number }
  )[] = [{ kind: "code", depth: -1 }];
  const codeToken =
    /\s+|\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|[A-Za-z_$][\w$]*|[\s\S]/uy;
  for (let cursor = 0; cursor < source.length; ) {
    const mode = modes.at(-1);
    assert.ok(mode);
    const character = source.charAt(cursor);
    if (mode.kind === "template") {
      if (character === "\\") {
        tokens[mode.tokenIndex] += source.slice(cursor, cursor + 2);
        cursor += 2;
      } else if (character === "`") {
        tokens[mode.tokenIndex] += "`";
        modes.pop();
        cursor += 1;
      } else if (source.startsWith("${", cursor)) {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: テンプレート構文を解析対象の文字列として保持する。
        tokens[mode.tokenIndex] += "${}";
        modes.push({ kind: "code", depth: 0 });
        cursor += 2;
      } else {
        tokens[mode.tokenIndex] += character;
        cursor += 1;
      }
      continue;
    }
    if (character === "`") {
      modes.push({ kind: "template", tokenIndex: tokens.length });
      tokens.push("`");
      cursor += 1;
      continue;
    }
    // 正規表現本文のbacktick・波括弧をテンプレート構文へ読み替えない。
    if (
      character === "/" &&
      !source.startsWith("//", cursor) &&
      !source.startsWith("/*", cursor) &&
      [
        undefined,
        "=",
        "(",
        "[",
        ",",
        ":",
        "return",
        "=>",
        "!",
        "&&",
        "||",
      ].includes(tokens.at(-1))
    ) {
      const literal = source
        .slice(cursor)
        .match(
          /^\/(?:\\[^\r\n]|\[(?:\\[^\r\n]|[^\]\\\r\n])*\]|[^/\\[\r\n])+\/[a-z]*/u,
        )?.[0];
      if (literal) {
        tokens.push(literal);
        cursor += literal.length;
        continue;
      }
    }
    codeToken.lastIndex = cursor;
    const match = codeToken.exec(source);
    assert.ok(match);
    const token = match[0];
    cursor = codeToken.lastIndex;
    if (/^\s/u.test(token) || token.startsWith("/*") || token.startsWith("//"))
      continue;
    if (mode.depth >= 0) {
      if (token === "}" && mode.depth === 0) {
        modes.pop();
        continue;
      }
      if (token === "{") mode.depth += 1;
      if (token === "}") mode.depth -= 1;
    }
    tokens.push(token);
  }
  assert.equal(modes.length, 1, "Source template expression must be closed");
  const names: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const kind = tokens[index];
    if (kind !== "import" && kind !== "export") continue;
    if (tokens[index - 1] === ".") continue;
    const next = tokens[index + 1] ?? "";
    if (next === "(" || /^["'`]/u.test(next)) {
      const literal = next === "(" ? (tokens[index + 2] ?? "") : next;
      assert.ok(
        !literal.includes("version-control/src/"),
        "Version Control Root requires a static Named import",
      );
      continue;
    }
    if (kind === "export" && !["{", "*", "type"].includes(next)) continue;
    for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
      const token = tokens[cursor];
      if (token === ";" || token === "import" || token === "export") break;
      if (token !== "from") continue;
      const literal = tokens[cursor + 1] ?? "";
      if (!/^["']/u.test(literal)) break;
      const specifier = literal.slice(1, -1);
      if (!specifier.includes("version-control/src/")) break;
      assert.ok(
        specifier.endsWith("version-control/src/index.ts"),
        "Version Control Root is the only Package entrypoint",
      );
      assert.equal(
        kind,
        "import",
        "Version Control Root re-export bypass is forbidden",
      );
      const clause = tokens.slice(index + 1, cursor).join(" ");
      assert.match(
        clause,
        /^(?:type\s+)?\{[^{}]*\}$/u,
        "Version Control Root requires a static Named import",
      );
      const bindings = clause.replace(/^type\s+/u, "").slice(1, -1);
      for (const raw of bindings.split(",")) {
        const name = raw
          .trim()
          .replace(/^type\s+/u, "")
          .split(/\s+as\s+/u)[0];
        if (name) names.push(name);
      }
      break;
    }
  }
  return [...new Set(names)].sort();
}

/**
 * 用途別Consumer抽出でNamed import以外の迂回を拒否する。
 *
 * @responsibility Aliasと型importを保持し、Namespace・動的import・再exportを未使用へ畳まない。
 * @trace RCM-IT-004
 * @precondition 固定Source文字列だけを入力する。
 * @stimulus 正式Rootへの正例と迂回宣言を解析する。
 * @observation 抽出Symbol集合と拒否例外を観測する。
 * @oracle Named Symbolは固定集合と一致し、迂回は全件拒否される。
 * @cleanup N/A: 外部資源を生成しない。
 * @boundary N/A: 同一Process内のSource検査である。
 */
test("用途別Consumer抽出はNamed importを保持しRoot迂回を拒否する", () => {
  const root = "../../../version-control/src/index.ts";
  assert.deepEqual(
    importedVersionControlNames(
      `import { verifyRepositoryRoot as verify, type VerifiedRepositoryRoot } from "${root}";\nimport type { RepositoryEntryObservation } from "${root}";`,
    ),
    [
      "RepositoryEntryObservation",
      "VerifiedRepositoryRoot",
      "verifyRepositoryRoot",
    ],
  );
  assert.deepEqual(
    importedVersionControlNames(
      `const before = 1; import/*comment*/ type { VerifiedRepositoryRoot } from/*comment*/ "${root}";`,
    ),
    ["VerifiedRepositoryRoot"],
  );
  assert.deepEqual(
    importedVersionControlNames(
      `// import { x } from "${root}";\nconst text = 'import { x } from "${root}"';`,
    ),
    [],
  );
  for (const source of [
    "const pattern = /[`{}]/u; const quotient = value / divisor;",
    'const text = `import("../../../version-control/src/repository/location.ts")`;',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: テンプレート構文を解析対象の文字列として保持する。
    'const text = `\\${import("../../../version-control/src/repository/location.ts")}`;',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: テンプレート構文を解析対象の文字列として保持する。
    "const text = `${'import(\"../../../version-control/src/repository/location.ts\")'}`;",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: テンプレート構文を解析対象の文字列として保持する。
    'const text = `${/* import("../../../version-control/src/repository/location.ts") */ 1}`;',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: テンプレート構文を解析対象の文字列として保持する。
    "const text = `${({ value: `plain ${1}` }).value}`;",
  ])
    assert.deepEqual(importedVersionControlNames(source), []);
  for (const source of [
    `import * as versionControl from "${root}";`,
    `import versionControl from "${root}";`,
    `import versionControl, { verifyRepositoryRoot } from "${root}";`,
    `const versionControl = await import("${root}");`,
    `import "${root}";`,
    `export { verifyRepositoryRoot } from "${root}";`,
    `export * from "${root}";`,
    `export * as versionControl from "${root}";`,
    'import { verifyRepositoryRoot } from "../../../version-control/src/repository/location.ts";',
    'import type { VerifiedRepositoryRoot } from "../../../version-control/src/repository/location.ts";',
    'import { verifyRepositoryRoot as verify } from "../../../version-control/src/repository/location.ts";',
    'const versionControl = await import("../../../version-control/src/repository/location.ts");',
    'export { verifyRepositoryRoot } from "../../../version-control/src/repository/location.ts";',
    'const before = 1; import { verifyRepositoryRoot } from "../../../version-control/src/repository/location.ts";',
    'import/*comment*/ { verifyRepositoryRoot } from "../../../version-control/src/repository/location.ts";',
    'import { verifyRepositoryRoot } from/*comment*/ "../../../version-control/src/repository/location.ts";',
    "const value = import(`../../../version-control/src/repository/location.ts`);",
    // biome-ignore lint/suspicious/noTemplateCurlyInString: テンプレート構文を解析対象の文字列として保持する。
    'const value = `${await import("../../../version-control/src/repository/location.ts")}`;',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: テンプレート構文を解析対象の文字列として保持する。
    'const value = `${`nested ${await import("../../../version-control/src/repository/location.ts")}`}`;',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: テンプレート構文を解析対象の文字列として保持する。
    'const value = `${({ value: await import("../../../version-control/src/repository/location.ts") }).value}`;',
  ]) {
    assert.throws(
      () => importedVersionControlNames(source),
      /Version Control Root/u,
    );
  }
});

/**
 * productionSourcesのTest準備責務を実行する。
 *
 * @responsibility productionSourcesがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
 * @trace RCM-IT-004
 * @precondition 呼出し元Test Caseが必要な入力を渡す。
 * @stimulus productionSourcesを呼び出す。
 * @observation 返却値、生成fixtureまたは観測値を取得する。
 * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
 * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
function productionSources(root: string): readonly string[] {
  const foundFiles: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "tests") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) foundFiles.push(...productionSources(target));
    else if (entry.isFile() && entry.name.endsWith(".ts"))
      foundFiles.push(target);
  }
  return foundFiles;
}

/**
 * Repository Locationの旧Ownerと重複した能力発行入口を残さないを検証する。
 *
 * @responsibility Repository Locationの旧Ownerと重複した能力発行入口を残さないの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository Locationの旧Ownerと重複した能力発行入口を残さないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("Repository Locationの旧Ownerと重複した能力発行入口を残さない", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    sourcePath,
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
  const retiredPaths = [
    "runtime-data/src/platform/repository-root-capability.ts",
    "coordinator/src/security/repository-root-resolution.ts",
    "coordinator/src/security/repository-git-layout.ts",
    "coordinator/src/security/repository-git-layout-internal.ts",
    "coordinator/src/security/git-object-reader.ts",
  ];
  for (const retiredPath of retiredPaths)
    assert.equal(
      sources.some(({ source }) => source.includes(retiredPath)),
      false,
      retiredPath,
    );

  const issuers = sources.filter(({ source }) =>
    source.includes("const REPOSITORY_LOCATION_CONTRACT ="),
  );
  assert.deepEqual(
    issuers.map(({ sourcePath }) =>
      path.relative(repositoryRoot, sourcePath).replaceAll(path.sep, "/"),
    ),
    ["40_Develop/version-control/src/repository/location.ts"],
  );
});

/**
 * 保護対象Runtimeは正式公開契約を使いGit内部実装へ直接依存しないを検証する。
 *
 * @responsibility 保護対象Runtimeは正式公開契約を使いGit内部実装へ直接依存しないの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 保護対象Runtimeは正式公開契約を使いGit内部実装へ直接依存しないの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("保護対象Runtimeは正式公開契約を使いGit内部実装へ直接依存しない", () => {
  const protectedRoots = [
    developRoot,
    path.join(repositoryRoot, "template", "tools"),
  ];
  const sources = protectedRoots
    .flatMap((root) => productionSources(root))
    .map((sourcePath) => ({
      relativePath: path
        .relative(repositoryRoot, sourcePath)
        .replaceAll(path.sep, "/"),
      source: fs.readFileSync(sourcePath, "utf8"),
    }));
  for (const { relativePath, source } of sources) {
    assert.doesNotMatch(
      source,
      /version-control\/src\/(?:checker-observation|repository-identity)\/(?:index|public-api)\.ts/u,
      `${relativePath}: retired public intermediary`,
    );
    if (!relativePath.startsWith("40_Develop/version-control/")) {
      importedVersionControlNames(source);
      assert.equal(
        /version-control\/src\/git\/(?:commit-tree|layout)\.ts/u.test(source),
        false,
        `${relativePath}: low-level Git implementation`,
      );
    }
  }
  const childConsumer = fs.readFileSync(
    path.join(
      developRoot,
      "coordinator/tests/integration/coordinator-state-runtime.contract.test.ts",
    ),
    "utf8",
  );
  assert.doesNotMatch(
    childConsumer,
    /version-control\/src\/repository\/location\.ts/u,
  );
  assert.equal(
    [
      ...childConsumer.matchAll(
        /new URL\("\.\.\/\.\.\/\.\.\/version-control\/src\/index\.ts", import\.meta\.url\)/gu,
      ),
    ].length,
    6,
    "fresh child Process uses the public Root in all six scenarios",
  );
  const mockConsumer = fs.readFileSync(
    path.join(
      developRoot,
      "orchestrator/tests/integration/docker-recovery-settlement.contract.test.ts",
    ),
    "utf8",
  );
  assert.doesNotMatch(
    mockConsumer,
    /version-control\/src\/repository\/location\.ts/u,
  );
  assert.match(
    mockConsumer,
    /t\.mock\.module\("\.\.\/\.\.\/\.\.\/version-control\/src\/index\.ts"/u,
  );
  assert.match(
    mockConsumer,
    /await import\("\.\.\/\.\.\/\.\.\/version-control\/src\/index\.ts"\)/u,
  );
});

/**
 * Fixed SnapshotとFixed Revisionの既知Consumer集合が宣言と一致するを検証する。
 *
 * @responsibility Fixed SnapshotとFixed Revisionの既知Consumer集合が宣言と一致するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Fixed SnapshotとFixed Revisionの既知Consumer集合が宣言と一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("Fixed SnapshotとFixed Revisionの既知Consumer集合が宣言と一致する", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
  /**
   * externalConsumersのTest準備責務を実行する。
   *
   * @responsibility externalConsumersがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace RCM-IT-004
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus externalConsumersを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
   */
  const externalConsumers = (pattern: RegExp) =>
    sources
      .filter(
        ({ relativePath, source }) =>
          !relativePath.startsWith("40_Develop/version-control/") &&
          pattern.test(source),
      )
      .map(({ relativePath }) => relativePath)
      .sort();

  assert.deepEqual(
    externalConsumers(
      /\b(?:inspectFixedSnapshot|readFixedSnapshotFile|materializeFixedSnapshotCandidate|inspectRepositoryFixedSnapshot|gitFixedSnapshotAdapter)\b/u,
    ),
    [
      "40_Develop/coordinator/scripts/prepare-release-runtime.ts",
      "40_Develop/coordinator/scripts/sign-release-manifest.ts",
      "40_Develop/coordinator/src/external-send/policy.ts",
      "40_Develop/coordinator/src/platform-access/package-verification.ts",
      "40_Develop/coordinator/src/platform-access/release-identity.ts",
      "40_Develop/coordinator/src/repository-operation/workspace.ts",
      "40_Develop/orchestrator/src/candidate/integration-adapter.ts",
    ],
  );
  assert.deepEqual(
    externalConsumers(
      /\b(?:observeFixedRevisionIdentity|gitFixedRevisionIdentityAdapter|observeRepositoryRevision|gitRepositoryRevisionAdapter)\b/u,
    ),
    [
      "40_Develop/coordinator/src/repository-operation/binding.ts",
      "40_Develop/coordinator/src/workbench-ai/change-candidate-executor.ts",
    ],
  );
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
  const projection = JSON.stringify(describeRepositoryLocationContract());
  for (const term of ["commit", "tree", "index", "worktree", "staged"])
    assert.equal(projection.toLocaleLowerCase("en-US").includes(term), false);
});

/**
 * Repository LocationとRepository-local Ignoreの既知Consumer集合が宣言と一致するを検証する。
 *
 * @responsibility Repository LocationとRepository-local Ignoreの既知Consumer集合が宣言と一致するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Repository LocationとRepository-local Ignoreの既知Consumer集合が宣言と一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("Repository LocationとRepository-local Ignoreの既知Consumer集合が宣言と一致する", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
  /**
   * consumersのTest準備責務を実行する。
   *
   * @responsibility consumersがTest Caseへ渡す前提状態または観測値を決定論的に構築する。
   * @trace RCM-IT-004
   * @precondition 呼出し元Test Caseが必要な入力を渡す。
   * @stimulus consumersを呼び出す。
   * @observation 返却値、生成fixtureまたは観測値を取得する。
   * @oracle 呼出し元Test Caseが期待条件を判定できる形で結果を返す。
   * @cleanup 呼出し元Test Caseまたは登録済みhookが作成資源を清掃する。
   * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
   */
  const consumers = (pattern: RegExp) =>
    sources
      .filter(
        ({ relativePath, source }) =>
          !relativePath.startsWith("40_Develop/version-control/") &&
          pattern.test(source),
      )
      .map(({ relativePath }) => relativePath)
      .sort();

  assert.deepEqual(
    consumers(
      /\b(?:verifyRepositoryRoot|verifyRepositoryRootFromWorkingDirectory|resolveVerifiedRepositoryRootFromWorkingDirectory|describeRepositoryLocationContract)\b/u,
    ),
    [
      "40_Develop/checker/src/profiles/current.ts",
      "40_Develop/checker/src/rules/reality-symbol-graph.ts",
      "40_Develop/coordinator/scripts/check-platform-access-coverage.ts",
      "40_Develop/coordinator/scripts/measure-development-providers.ts",
      "40_Develop/coordinator/scripts/prepare-codex-advice-image.ts",
      "40_Develop/coordinator/scripts/prepare-release-candidate.ts",
      "40_Develop/coordinator/scripts/promote-release-manifest.ts",
      "40_Develop/coordinator/scripts/sign-release-manifest.ts",
      "40_Develop/coordinator/scripts/verify-native-protection.ts",
      "40_Develop/coordinator/scripts/verify-native-terminal-fixtures.ts",
      "40_Develop/coordinator/scripts/verify-native-terminal-namespace.ts",
      "40_Develop/coordinator/scripts/verify-orchestrator-real-providers.ts",
      "40_Develop/coordinator/scripts/verify-signed-general-task.ts",
      "40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts",
      "40_Develop/coordinator/scripts/verify-signed-route-matrix.ts",
      "40_Develop/orchestrator/src/operation-composition.ts",
      "40_Develop/coordinator/src/cli/command.ts",
      "40_Develop/coordinator/src/diagnostics/doctor.ts",
      "40_Develop/coordinator/scripts/verification-result-record.ts",
      "40_Develop/coordinator/src/external-send/policy.ts",
      "40_Develop/coordinator/src/platform-access/package-verification.ts",
      "40_Develop/orchestrator/src/candidate/integration-adapter.ts",
      "40_Develop/orchestrator/src/cli/command.ts",
      "40_Develop/orchestrator/src/storage/current-state.ts",
      "40_Develop/orchestrator/src/storage/history.ts",
      "40_Develop/orchestrator/src/task/settle-docker-recovery.ts",
      "40_Develop/orchestrator/src/platform/windows-adapter.ts",
      "40_Develop/coordinator/src/repository-operation/binding.ts",
      "40_Develop/coordinator/src/repository-operation/workspace.ts",
      "40_Develop/coordinator/src/state-storage/settlement-store.ts",
      "40_Develop/cros/src/configuration/shared-server-file-adapter.ts",
      "40_Develop/execution-intelligence/src/store/verify-repository-root.ts",
      "40_Develop/domain-model/src/repository/resolve-storage-paths.ts",
      "40_Develop/domain-model/src/storage/ensure-area.ts",
      "40_Develop/semantic-coverage/scripts/compile-pilot.ts",
      "40_Develop/verification-runner/src/regression/stages.ts",
      "40_Develop/visual-preview/src/server.ts",
      "40_Develop/workbench-server/bin/workbench-server.ts",
      "40_Develop/workbench-server/src/project/surface.ts",
      "40_Develop/workbench-server/src/activity/observe.ts",
      "40_Develop/workbench-server/src/server.ts",
    ].sort(),
  );
  assert.deepEqual(
    consumers(
      /\b(?:registerRepositoryLocalIgnore|gitRepositoryLocalIgnoreAdapter)\b/u,
    ),
    ["40_Develop/domain-model/src/storage/ensure-area.ts"],
  );
});

/**
 * Checkerは同じ基準版RootのVersion Control公開入口だけを使うを検証する。
 *
 * @responsibility Checkerは同じ基準版RootのVersion Control公開入口だけを使うの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Checkerは同じ基準版RootのVersion Control公開入口だけを使うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("Checkerは同じ基準版RootのVersion Control公開入口だけを使う", () => {
  const checkerSource = fs.readFileSync(
    path.join(
      repositoryRoot,
      "40_Develop",
      "checker",
      "src",
      "profiles",
      "current.ts",
    ),
    "utf8",
  );
  assert.equal(checkerSource.includes('from "../../src/index.ts"'), false);
  assert.equal(
    checkerSource.includes('from "../../../version-control/src/index.ts"'),
    true,
  );
  const distributedEntry = fs.readFileSync(
    path.join(repositoryRoot, "template", "tools", "crdd-check.ts"),
    "utf8",
  );
  assert.equal(
    distributedEntry.includes(
      'import "../../40_Develop/checker/bin/checker.ts";',
    ),
    true,
  );
  assert.equal(
    fs.existsSync(
      path.join(
        repositoryRoot,
        "template",
        "tools",
        "internal",
        "version-control-runtime.ts",
      ),
    ),
    false,
  );
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
 * Local Change Setと用途別Named SymbolのConsumer集合が宣言と一致するを検証する。
 *
 * @responsibility Local Change Setと用途別Named SymbolのConsumer集合が宣言と一致するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus Local Change Setと用途別Named SymbolのConsumer集合が宣言と一致するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("Local Change Setと用途別Named SymbolのConsumer集合が宣言と一致する", () => {
  const sources = [
    ...productionSources(developRoot),
    ...productionSources(path.join(repositoryRoot, "template", "tools")),
  ].map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));

  const localChangeSetConsumers = sources
    .filter(({ source }) =>
      /\b(observeLocalChangeSet|gitLocalChangeSetAdapter)\b/u.test(source),
    )
    .map(({ relativePath }) => relativePath)
    .filter(
      (relativePath) => !relativePath.startsWith("40_Develop/version-control/"),
    )
    .sort();
  assert.deepEqual(localChangeSetConsumers, [
    "40_Develop/verification-runner/src/regression/stages.ts",
    "40_Develop/workbench-server/src/project/surface.ts",
  ]);

  const checkerObservationConsumers = sources
    .filter(({ source }) =>
      importedVersionControlNames(source).some((name) =>
        [
          "RepositoryEntryObservation",
          "observeDeclaredNestedRepositoryPaths",
          "observeNestedRepository",
          "observeRepositoryEntries",
          "readFixedSnapshotText",
          "resolveRevisionIdentity",
        ].includes(name),
      ),
    )
    .map(({ relativePath }) => relativePath)
    .sort();
  assert.deepEqual(checkerObservationConsumers, [
    "40_Develop/checker/src/profiles/current.ts",
  ]);

  const repositoryIdentityConsumers = sources
    .filter(({ source }) =>
      importedVersionControlNames(source).some((name) =>
        [
          "REPOSITORY_LOCATION_CONTRACT",
          "REPOSITORY_LOCATION_CONTRACT_REVISION",
          "VerifiedRepositoryRoot",
          "describeRepositoryLocationContract",
          "resolveVerifiedRepositoryRoot",
          "resolveVerifiedRepositoryRootFromWorkingDirectory",
          "verifyRepositoryRoot",
          "verifyRepositoryRootFromWorkingDirectory",
        ].includes(name),
      ),
    )
    .map(({ relativePath }) => relativePath)
    .sort();
  assert.deepEqual(
    repositoryIdentityConsumers,
    [
      "40_Develop/coordinator/scripts/check-platform-access-coverage.ts",
      "40_Develop/coordinator/scripts/measure-development-providers.ts",
      "40_Develop/coordinator/scripts/prepare-codex-advice-image.ts",
      "40_Develop/coordinator/scripts/prepare-release-candidate.ts",
      "40_Develop/coordinator/scripts/prepare-release-runtime.ts",
      "40_Develop/coordinator/scripts/promote-release-manifest.ts",
      "40_Develop/coordinator/scripts/sign-release-manifest.ts",
      "40_Develop/coordinator/scripts/verification-result-record.ts",
      "40_Develop/coordinator/scripts/verify-native-protection.ts",
      "40_Develop/coordinator/scripts/verify-native-terminal-fixtures.ts",
      "40_Develop/coordinator/scripts/verify-native-terminal-namespace.ts",
      "40_Develop/coordinator/scripts/verify-orchestrator-real-providers.ts",
      "40_Develop/coordinator/scripts/verify-signed-general-task.ts",
      "40_Develop/coordinator/scripts/verify-signed-reviewer-boundary.ts",
      "40_Develop/coordinator/scripts/verify-signed-route-matrix.ts",
      "40_Develop/coordinator/src/cli/command.ts",
      "40_Develop/coordinator/src/diagnostics/doctor.ts",
      "40_Develop/coordinator/src/external-send/policy.ts",
      "40_Develop/coordinator/src/host-execution/terminal-caller-checkpoint.ts",
      "40_Develop/coordinator/src/host-execution/terminal-caller-lease.ts",
      "40_Develop/coordinator/src/platform-access/release-identity.ts",
      "40_Develop/coordinator/src/repository-operation/binding.ts",
      "40_Develop/coordinator/src/repository-operation/workspace.ts",
      "40_Develop/coordinator/src/state-storage/settlement-store.ts",
      "40_Develop/coordinator/src/workbench-ai/advice-execution.ts",
      "40_Develop/coordinator/src/workbench-ai/candidate-actions.ts",
      "40_Develop/coordinator/src/workbench-ai/change-candidate-executor.ts",
      "40_Develop/coordinator/src/workbench-ai/repository-composition.ts",
      "40_Develop/execution-intelligence/src/store/events.ts",
      "40_Develop/orchestrator/src/candidate/integration-adapter.ts",
      "40_Develop/orchestrator/src/cli/command.ts",
      "40_Develop/orchestrator/src/operation-composition.ts",
      "40_Develop/orchestrator/src/platform/windows-adapter.ts",
      "40_Develop/orchestrator/src/storage/current-state.ts",
      "40_Develop/orchestrator/src/storage/history.ts",
      "40_Develop/orchestrator/src/task/settle-docker-recovery.ts",
      "40_Develop/visual-preview/src/server.ts",
      "40_Develop/workbench-server/bin/workbench-server.ts",
      "40_Develop/workbench-server/src/activity/observe.ts",
      "40_Develop/workbench-server/src/server.ts",
      "template/tools/crdd-mcp-server.ts",
      "40_Develop/checker/src/reality/test-catalog.ts",
      "40_Develop/checker/src/reality/symbol-traceability.ts",
      "40_Develop/checker/src/profiles/current.ts",
      "40_Develop/checker/src/rules/reality-symbol-graph.ts",
      "40_Develop/cros/src/configuration/shared-server-file-adapter.ts",
      "40_Develop/domain-model/src/configuration/read-tool-config.ts",
      "40_Develop/domain-model/src/repository/observe-symbols.ts",
      "40_Develop/domain-model/src/repository/create-observer.ts",
      "40_Develop/domain-model/src/repository/resolve-storage-paths.ts",
      "40_Develop/domain-model/src/repository/types.ts",
      "40_Develop/domain-model/src/storage/ensure-area.ts",
      "40_Develop/domain-model/src/storage/temporary-operation.ts",
      "40_Develop/execution-intelligence/src/store/verify-repository-root.ts",
      "40_Develop/semantic-coverage/scripts/compile-pilot.ts",
      "40_Develop/semantic-coverage/src/compilation/from-repository.ts",
      "40_Develop/semantic-coverage/src/bundle/filesystem-publisher.ts",
      "40_Develop/semantic-coverage/src/migration/inventory-legacy-fields.ts",
      "40_Develop/verification-runner/src/regression/stages.ts",
      "40_Develop/workbench-server/src/project/surface.ts",
    ].sort(),
  );
});

/**
 * 既知ConsumerはGitを再解釈せずVersion Control公開契約だけを使うを検証する。
 *
 * @responsibility 既知ConsumerはGitを再解釈せずVersion Control公開契約だけを使うの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus 既知ConsumerはGitを再解釈せずVersion Control公開契約だけを使うの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("既知ConsumerはGitを再解釈せずVersion Control公開契約だけを使う", () => {
  const consumerPaths = [
    "40_Develop/checker/src/profiles/current.ts",
    "40_Develop/checker/src/rules/reality-symbol-graph.ts",
    "40_Develop/verification-runner/src/regression/stages.ts",
  ];
  const forbiddenPatterns = [
    /node:child_process/u,
    /\b(?:spawnSync|execFileSync|execSync)\b/u,
    /\bcollectChangedPathsFromGit\b/u,
    /\b(?:gitArguments|gitCommand|gitExecutable)\b/u,
  ];
  for (const relativePath of consumerPaths) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, relativePath),
      "utf8",
    );
    for (const pattern of forbiddenPatterns)
      assert.equal(pattern.test(source), false, `${relativePath}: ${pattern}`);
  }
});

/**
 * GitによるLocal Change Set観測能力はVersion Control Adapterだけが発行するを検証する。
 *
 * @responsibility GitによるLocal Change Set観測能力はVersion Control Adapterだけが発行するの合否判定を所有する。
 * @trace RCM-IT-004
 * @precondition Test Fileが構築するfixtureと入力を使用する。
 * @stimulus GitによるLocal Change Set観測能力はVersion Control Adapterだけが発行するの対象操作を実行する。
 * @observation 結果、状態、Effectおよび終了後条件を観測する。
 * @oracle Test本文のassertionが期待条件を満たす。
 * @cleanup Test本文または登録済みhookが作成資源を清掃する。
 * @boundary RCM-IT-004=Direct Boundary: version-control Test Source→対象契約
 */
test("GitによるLocal Change Set観測能力はVersion Control Adapterだけが発行する", () => {
  const sources = productionSources(developRoot).map((sourcePath) => ({
    relativePath: path
      .relative(repositoryRoot, sourcePath)
      .replaceAll(path.sep, "/"),
    source: fs.readFileSync(sourcePath, "utf8"),
  }));
  const owners = sources
    .filter(({ source }) =>
      source.includes(
        "const gitLocalChangeSetAdapter = createGitLocalChangeSetAdapter()",
      ),
    )
    .map(({ relativePath }) => relativePath)
    .sort();
  assert.deepEqual(owners, [
    "40_Develop/version-control/src/git/local-change-set-adapter.ts",
  ]);
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
    path.join(sourceRoot, "git/layout.ts"),
    "utf8",
  );
  const update = fs.readFileSync(
    path.join(sourceRoot, "git/local-ignore-adapter.ts"),
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

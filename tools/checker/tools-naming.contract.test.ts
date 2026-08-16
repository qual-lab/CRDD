import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  isArrowFunction,
  isAsExpression,
  isArrayLiteralExpression,
  isBindingElement,
  isBinaryExpression,
  isCallExpression,
  isClassDeclaration,
  isClassExpression,
  isFunctionDeclaration,
  isFunctionExpression,
  isIdentifier,
  isInterfaceDeclaration,
  isMethodDeclaration,
  isNoSubstitutionTemplateLiteral,
  isNewExpression,
  isNonNullExpression,
  isObjectLiteralExpression,
  isParameterDeclaration,
  isParenthesizedExpression,
  isPropertyAssignment,
  isPropertyAccessExpression,
  isRegularExpressionLiteral,
  isStringLiteral,
  isSatisfiesExpression,
  isTaggedTemplateExpression,
  isTypeAliasDeclaration,
  isVariableDeclaration,
  NodeFlags,
  SyntaxKind,
  type Expression,
  type Identifier,
  type Node,
  type SourceFile,
  type VariableDeclaration,
} from "typescript/unstable/ast";
import {
  API,
  TypeFlags,
  type Checker,
  type Project,
  type Type,
} from "typescript/unstable/sync";

const checkerRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(checkerRoot, "../..");
const OWNED_ROOTS = Object.freeze([
  path.join(repositoryRoot, "tools", "checker"),
  path.join(repositoryRoot, "tools", "coordinator"),
  path.join(repositoryRoot, "template", "tools"),
]);
const PROJECT_CONFIGS = Object.freeze([
  path.join(checkerRoot, "tsconfig.json"),
  path.join(repositoryRoot, "tools", "coordinator", "tsconfig.strict.json"),
  path.join(repositoryRoot, "tools", "coordinator", "tsconfig.tests.json"),
]);
const EXPECTED_OWNED_SOURCE_COUNTS = Object.freeze({
  checkerAndTemplate: 5,
  coordinatorProduction: 38,
  coordinatorTests: 31,
  uniqueTotal: 74,
});
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/u;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/u;
const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const BOOLEAN_NAME = /^(?:is|has|can|should)[A-Z][A-Za-z0-9]*$/u;
const PLURAL_NAME = /(?:s|Children|Indices|Vertices|People|Media|Data)$/u;
const TEST_FILE =
  /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(unit|contract|integration|boundary|golden|current)\.test\.ts$/u;
const TYPESCRIPT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/u;
const MARKDOWN_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;
const RESERVED_FILE_NAMES = new Set([
  ".gitignore",
  "README.md",
  "package-lock.json",
  "package.json",
  "tsconfig.json",
  "tsconfig.strict.json",
  "tsconfig.tests.json",
]);
const retiredCheckerMjs = `crdd${"_"}check.mjs`;
const retiredCheckerTs = `crdd${"_"}check.ts`;
const retiredCheckerTestTs = `crdd${"_"}check.test.ts`;
const retiredFaultInjector = `crdd${"_"}check_fault_injector`;
const retiredThreatModel = `THREAT${"_"}MODEL.md`;
const RETIRED_REFERENCE_LITERALS = Object.freeze([
  retiredCheckerMjs,
  retiredCheckerTs,
  retiredCheckerTestTs,
  retiredFaultInjector,
  retiredThreatModel,
]);
const historicalReferenceCounts = new Map<string, number>([
  [`README.md|${retiredCheckerTs}`, 2],
  [
    `90_Release/Changes/CHG-000001_Human_Decision_Presentation.md|${retiredCheckerTs}`,
    3,
  ],
  [
    `90_Release/Changes/CHG-000001_Human_Decision_Presentation.md|${retiredCheckerTestTs}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000002_GitHub_Anchor_Checker_Correction.md|${retiredCheckerTs}`,
    3,
  ],
  [
    `90_Release/Changes/CHG-000002_GitHub_Anchor_Checker_Correction.md|${retiredCheckerTestTs}`,
    3,
  ],
  [
    `90_Release/Changes/CHG-000004_Checker_Hierarchical_Compatibility.md|${retiredCheckerTs}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000004_Checker_Hierarchical_Compatibility.md|${retiredCheckerTestTs}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md|${retiredCheckerTs}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md|${retiredCheckerTestTs}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md|${retiredFaultInjector}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000007_Multi_Location_Remediation.md|${retiredCheckerTs}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000007_Multi_Location_Remediation.md|${retiredCheckerTestTs}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000010_First_Pass_Convergence.md|${retiredCheckerTs}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000010_First_Pass_Convergence.md|${retiredCheckerTestTs}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000015_Coordinator_Runtime_1_0.md|${retiredCheckerTs}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000016_Internal_TypeScript_Migration.md|${retiredCheckerTs}`,
    4,
  ],
  [
    `90_Release/Changes/CHG-000016_Internal_TypeScript_Migration.md|${retiredCheckerTestTs}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000017_Tools_Coding_Standards.md|${retiredCheckerTs}`,
    5,
  ],
  [
    `90_Release/Changes/CHG-000017_Tools_Coding_Standards.md|${retiredCheckerTestTs}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000017_Tools_Coding_Standards.md|${retiredThreatModel}`,
    1,
  ],
]);
const REFERENCE_FILE_EXTENSIONS = new Set([
  ".json",
  ".md",
  ".ts",
  ".yaml",
  ".yml",
]);
const FORBIDDEN_BARE_IDENTIFIERS = new Set([
  "common",
  "data",
  "doThing",
  "execute",
  "helper",
  "info",
  "manager",
  "misc",
  "run",
  "util",
]);
const FIXED_CALLS = new Set([
  "BigInt",
  "Object.freeze",
  "Symbol",
  "createHash",
]);

type NamingViolation = Readonly<{
  column: number;
  file: string;
  kind: string;
  line: number;
  name: string;
  rule: string;
}>;

function collectFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      assert.equal(
        entry.isSymbolicLink(),
        false,
        `symbolic directory: ${target}`,
      );
      assert.match(entry.name, KEBAB_CASE, `folder name: ${target}`);
      files.push(...collectFiles(target));
      continue;
    }
    assert.ok(entry.isFile(), `unsupported filesystem entry: ${target}`);
    files.push(target);
  }
  return files;
}

function collectReferenceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === "Evidence"
    )
      continue;
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) {
      assert.equal(
        entry.isSymbolicLink(),
        false,
        `symbolic reference directory: ${target}`,
      );
      files.push(...collectReferenceFiles(target));
      continue;
    }
    if (!entry.isFile() || entry.name === "CHANGELOG.md") continue;
    if (REFERENCE_FILE_EXTENSIONS.has(path.extname(entry.name)))
      files.push(target);
  }
  return files;
}

function countLiteral(source: string, literal: string): number {
  let count = 0;
  let offset = source.indexOf(literal);
  while (offset !== -1) {
    count += 1;
    offset += literal.length;
    offset = source.indexOf(literal, offset);
  }
  return count;
}

function collectRetiredReferenceCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const file of collectReferenceFiles(repositoryRoot)) {
    const source = fs.readFileSync(file, "utf8");
    const relativeFile = path
      .relative(repositoryRoot, file)
      .replaceAll(path.sep, "/");
    for (const literal of RETIRED_REFERENCE_LITERALS) {
      const count = countLiteral(source, literal);
      if (count > 0) counts.set(`${relativeFile}|${literal}`, count);
    }
  }
  return counts;
}

function assertFileName(file: string): void {
  const name = path.basename(file);
  if (RESERVED_FILE_NAMES.has(name)) return;
  if (name.endsWith(".test.ts")) {
    assert.match(name, TEST_FILE, `test filename: ${file}`);
    return;
  }
  if (name.endsWith(".ts")) {
    assert.match(name, TYPESCRIPT_FILE, `TypeScript filename: ${file}`);
    return;
  }
  if (name.endsWith(".md")) {
    assert.match(name, MARKDOWN_FILE, `Markdown filename: ${file}`);
    return;
  }
  assert.fail(`unrecognized filename without an owned convention: ${file}`);
}

function isContainedPath(candidate: string, root: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function resolveOwnedSource(file: string): string {
  const stats = fs.lstatSync(file);
  assert.equal(stats.isSymbolicLink(), false, `symbolic source: ${file}`);
  assert.equal(stats.isFile(), true, `non-file source: ${file}`);
  const resolved = fs.realpathSync.native(file);
  assert.equal(
    resolved.endsWith(".d.ts"),
    false,
    `declaration source: ${resolved}`,
  );
  assert.equal(resolved.includes(`${path.sep}node_modules${path.sep}`), false);
  assert.ok(
    OWNED_ROOTS.some((root) =>
      isContainedPath(resolved, fs.realpathSync.native(root)),
    ),
    `source outside owned roots: ${resolved}`,
  );
  return resolved;
}

function isOwnedProgramFile(file: string): boolean {
  return (
    !file.endsWith(".d.ts") &&
    !file.includes(`${path.sep}node_modules${path.sep}`) &&
    OWNED_ROOTS.some((root) => isContainedPath(file, root))
  );
}

function isNullish(type: Type): boolean {
  return Boolean(type.flags & (TypeFlags.Null | TypeFlags.Undefined));
}

function nonNullishTypes(type: Type): readonly Type[] {
  const types = type.isUnionType() ? type.getTypes() : [type];
  return types.filter((candidateType) => !isNullish(candidateType));
}

function isBooleanType(type: Type): boolean {
  const types = nonNullishTypes(type);
  return (
    types.length > 0 &&
    types.every((candidateType) =>
      Boolean(
        candidateType.flags & (TypeFlags.Boolean | TypeFlags.BooleanLiteral),
      ),
    )
  );
}

function isArrayType(type: Type, checker: Checker): boolean {
  const types = nonNullishTypes(type);
  return (
    types.length > 0 &&
    types.every(
      (candidateType) =>
        !checker.isTupleType(candidateType) &&
        checker.isArrayType(candidateType),
    )
  );
}

function isFunctionInitializer(initializer: Expression | undefined): boolean {
  return Boolean(
    initializer &&
      (isArrowFunction(initializer) ||
        isFunctionExpression(initializer) ||
        isClassExpression(initializer)),
  );
}

function isFixedAggregateMember(initializer: Expression | undefined): boolean {
  if (!initializer) return false;
  if (isArrayLiteralExpression(initializer)) {
    return initializer.elements.every(
      (element) =>
        element.kind !== SyntaxKind.SpreadElement &&
        isFixedAggregateMember(element),
    );
  }
  if (isObjectLiteralExpression(initializer)) {
    return initializer.properties.every(
      (property) =>
        isPropertyAssignment(property) &&
        !property.name.getText().startsWith("[") &&
        isFixedAggregateMember(property.initializer),
    );
  }
  return isFixedInitializer(initializer);
}

function isFixedInitializer(initializer: Expression | undefined): boolean {
  if (!initializer) return false;
  if (
    initializer.kind === SyntaxKind.TrueKeyword ||
    initializer.kind === SyntaxKind.FalseKeyword ||
    initializer.kind === SyntaxKind.NullKeyword ||
    initializer.kind === SyntaxKind.NumericLiteral ||
    initializer.kind === SyntaxKind.BigIntLiteral ||
    isStringLiteral(initializer) ||
    isNoSubstitutionTemplateLiteral(initializer) ||
    isRegularExpressionLiteral(initializer)
  ) {
    return true;
  }
  if (
    isParenthesizedExpression(initializer) ||
    isAsExpression(initializer) ||
    isSatisfiesExpression(initializer) ||
    isNonNullExpression(initializer)
  ) {
    return isFixedInitializer(initializer.expression);
  }
  if (isIdentifier(initializer)) return true;
  if (isPropertyAccessExpression(initializer)) {
    return (
      (isCallExpression(initializer.expression) &&
        initializer.expression.expression.getText() ===
          "Object.getOwnPropertyDescriptor") ||
      initializer.getText().startsWith("Date.")
    );
  }
  if (isBinaryExpression(initializer)) {
    return (
      isFixedInitializer(initializer.left) &&
      isFixedInitializer(initializer.right)
    );
  }
  if (isTaggedTemplateExpression(initializer)) {
    return initializer.tag.getText() === "String.raw";
  }
  if (isNewExpression(initializer)) {
    return (
      initializer.expression.getText() === "Set" &&
      initializer.arguments?.length === 1 &&
      isArrayLiteralExpression(initializer.arguments[0]) &&
      isFixedAggregateMember(initializer.arguments[0])
    );
  }
  if (isCallExpression(initializer)) {
    const callee = initializer.expression.getText();
    if (callee === "Object.freeze") return initializer.arguments.length === 1;
    if (FIXED_CALLS.has(callee)) {
      return (
        initializer.arguments.length <= 1 &&
        initializer.arguments.every(isFixedInitializer)
      );
    }
    if (callee === "JSON.stringify") {
      return (
        initializer.arguments.length === 1 &&
        isFixedAggregateMember(initializer.arguments[0])
      );
    }
    if (callee.endsWith(".update") || callee.endsWith(".digest")) {
      return (
        isPropertyAccessExpression(initializer.expression) &&
        isFixedInitializer(initializer.expression.expression) &&
        initializer.arguments.every(isFixedInitializer)
      );
    }
  }
  return false;
}

function isModuleConstant(declaration: VariableDeclaration): boolean {
  const declarationList = declaration.parent;
  const variableStatement = declarationList?.parent;
  return Boolean(
    declarationList &&
      declarationList.kind === SyntaxKind.VariableDeclarationList &&
      declarationList.flags & NodeFlags.Const &&
      variableStatement?.kind === SyntaxKind.VariableStatement &&
      variableStatement.parent?.kind === SyntaxKind.SourceFile &&
      !isFunctionInitializer(declaration.initializer) &&
      isFixedInitializer(declaration.initializer),
  );
}

function identifierLocation(
  identifier: Identifier,
  kind: string,
  rule: string,
): NamingViolation {
  const sourceFile = identifier.getSourceFile();
  const location = sourceFile.getLineAndCharacterOfPosition(
    identifier.getStart(sourceFile),
  );
  return {
    column: location.character + 1,
    file: fs.realpathSync.native(sourceFile.fileName),
    kind,
    line: location.line + 1,
    name: identifier.text,
    rule,
  };
}

function inspectIdentifier(
  identifier: Identifier,
  kind: string,
  checker: Checker,
  isConstant: boolean,
): NamingViolation[] {
  const name = identifier.text;
  const violations: NamingViolation[] = [];
  if (FORBIDDEN_BARE_IDENTIFIERS.has(name)) {
    violations.push(
      identifierLocation(identifier, kind, "forbidden-bare-name"),
    );
  }
  if (isConstant) {
    if (!UPPER_SNAKE_CASE.test(name)) {
      violations.push(
        identifierLocation(identifier, kind, "true-constant-upper-snake-case"),
      );
    }
    return violations;
  }
  const type = checker.getTypeAtLocation(identifier);
  if (!type || type.isErrorType()) {
    violations.push(
      identifierLocation(identifier, kind, "type-classification-required"),
    );
    return violations;
  }
  if (isBooleanType(type)) {
    if (!BOOLEAN_NAME.test(name)) {
      violations.push(identifierLocation(identifier, kind, "boolean-prefix"));
    }
    return violations;
  }
  if (isArrayType(type, checker)) {
    if (!CAMEL_CASE.test(name) || !PLURAL_NAME.test(name)) {
      violations.push(
        identifierLocation(identifier, kind, "array-plural-camel-case"),
      );
    }
    return violations;
  }
  if (!CAMEL_CASE.test(name)) {
    violations.push(identifierLocation(identifier, kind, "camel-case"));
  }
  return violations;
}

function inspectBindingName(
  name: Node | undefined,
  kind: string,
  checker: Checker,
  isConstant = false,
): NamingViolation[] {
  if (!name) return [];
  if (isIdentifier(name))
    return inspectIdentifier(name, kind, checker, isConstant);
  const violations: NamingViolation[] = [];
  name.forEachChild((child) => {
    if (isBindingElement(child))
      violations.push(...inspectBindingName(child.name, "binding", checker));
  });
  return violations;
}

function inspectSourceFile(
  sourceFile: SourceFile,
  checker: Checker,
): NamingViolation[] {
  const violations: NamingViolation[] = [];
  const visit = (node: Node): void => {
    if (
      isClassDeclaration(node) ||
      isInterfaceDeclaration(node) ||
      isTypeAliasDeclaration(node)
    ) {
      if (node.name && !PASCAL_CASE.test(node.name.text)) {
        violations.push(identifierLocation(node.name, "type", "pascal-case"));
      }
    } else if (isFunctionDeclaration(node)) {
      if (node.name) {
        if (!CAMEL_CASE.test(node.name.text)) {
          violations.push(
            identifierLocation(node.name, "function", "camel-case"),
          );
        }
        if (FORBIDDEN_BARE_IDENTIFIERS.has(node.name.text)) {
          violations.push(
            identifierLocation(node.name, "function", "forbidden-bare-name"),
          );
        }
      }
    } else if (isMethodDeclaration(node) && isIdentifier(node.name)) {
      if (!CAMEL_CASE.test(node.name.text)) {
        violations.push(identifierLocation(node.name, "method", "camel-case"));
      }
      if (FORBIDDEN_BARE_IDENTIFIERS.has(node.name.text)) {
        violations.push(
          identifierLocation(node.name, "method", "forbidden-bare-name"),
        );
      }
    } else if (isVariableDeclaration(node)) {
      violations.push(
        ...inspectBindingName(
          node.name,
          "variable",
          checker,
          isModuleConstant(node),
        ),
      );
    } else if (isParameterDeclaration(node)) {
      violations.push(...inspectBindingName(node.name, "parameter", checker));
    }
    node.forEachChild(visit);
  };
  visit(sourceFile);
  return violations;
}

function collectOwnedProjects(
  api: API,
  configs: readonly string[],
): {
  projects: readonly Project[];
  snapshot: ReturnType<API["updateSnapshot"]>;
} {
  for (const config of configs)
    assert.equal(fs.existsSync(config), true, config);
  const snapshot = api.updateSnapshot({ openProjects: [...configs] });
  const projects = snapshot.getProjects();
  assert.equal(
    projects.length,
    configs.length,
    "all TypeScript projects must load",
  );
  return { projects, snapshot };
}

function inspectProjects(projects: readonly Project[]): {
  sourceFiles: ReadonlyMap<string, SourceFile>;
  violations: readonly NamingViolation[];
} {
  const sourceFiles = new Map<string, SourceFile>();
  const checkers = new Map<string, Checker>();
  for (const project of projects) {
    for (const file of project.program.getSourceFileNames()) {
      const normalizedFile = path.normalize(file);
      if (!isOwnedProgramFile(normalizedFile)) continue;
      const resolvedFile = resolveOwnedSource(normalizedFile);
      const sourceFile = project.program.getSourceFile(file);
      assert.ok(sourceFile, `source unavailable: ${file}`);
      sourceFiles.set(resolvedFile, sourceFile);
      checkers.set(resolvedFile, project.checker);
    }
  }
  const violations = [...sourceFiles.entries()].flatMap(
    ([file, sourceFile]) => {
      const checker = checkers.get(file);
      assert.ok(checker, `checker unavailable: ${file}`);
      return inspectSourceFile(sourceFile, checker);
    },
  );
  return { sourceFiles, violations };
}

function formatViolations(violations: readonly NamingViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${path.relative(repositoryRoot, violation.file)}:${violation.line}:${violation.column} ${violation.kind} ${violation.name} ${violation.rule}`,
    )
    .join("\n");
}

test("toolsのPathと型付きsource identifierは内部コーディング規約へ一致する", () => {
  const files = OWNED_ROOTS.flatMap(collectFiles);
  for (const file of files) assertFileName(file);
  const api = new API({ cwd: checkerRoot });
  try {
    const { projects, snapshot } = collectOwnedProjects(api, PROJECT_CONFIGS);
    try {
      const checkerFiles = projects[0]?.program
        .getSourceFileNames()
        .filter(
          (file) =>
            isOwnedProgramFile(file) &&
            (isContainedPath(
              file,
              path.join(repositoryRoot, "tools", "checker"),
            ) ||
              isContainedPath(
                file,
                path.join(repositoryRoot, "template", "tools"),
              )),
        );
      const productionRoot = path.join(repositoryRoot, "tools", "coordinator");
      const productionFiles = projects[1]?.program
        .getSourceFileNames()
        .filter(
          (file) =>
            isOwnedProgramFile(file) && isContainedPath(file, productionRoot),
        );
      const testProjectFiles = projects[2]?.program
        .getSourceFileNames()
        .filter(
          (file) =>
            isOwnedProgramFile(file) && isContainedPath(file, productionRoot),
        );
      assert.equal(
        checkerFiles?.length,
        EXPECTED_OWNED_SOURCE_COUNTS.checkerAndTemplate,
      );
      assert.equal(
        productionFiles?.length,
        EXPECTED_OWNED_SOURCE_COUNTS.coordinatorProduction,
      );
      assert.equal(
        testProjectFiles?.filter((file) =>
          isContainedPath(
            file,
            path.join(repositoryRoot, "tools", "coordinator", "tests"),
          ),
        ).length,
        EXPECTED_OWNED_SOURCE_COUNTS.coordinatorTests,
      );
      const { sourceFiles, violations } = inspectProjects(projects);
      assert.equal(sourceFiles.size, EXPECTED_OWNED_SOURCE_COUNTS.uniqueTotal);
      assert.equal(violations.length, 0, formatViolations(violations));
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
});

test("型付き命名classifierは構文境界の正負例を同じ規則で判定する", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-tools-naming-"),
  );
  try {
    const fixtureFile = path.join(temporaryRoot, "fixture.ts");
    const configFile = path.join(temporaryRoot, "tsconfig.json");
    fs.writeFileSync(
      fixtureFile,
      [
        "const MAX_ITEMS = 3;",
        "function validLocals(): void {",
        "  const isReady: boolean | undefined = true;",
        "  const candidatePaths: readonly string[] = [];",
        "  void isReady; void candidatePaths;",
        "}",
        "const predicate = (shouldContinue: boolean): boolean => shouldContinue;",
        "const { enabled: hasFeature } = { enabled: true };",
        "function inspectValues(values: string[]): boolean { return values.length > 0; }",
        "function invalidLocals(): void {",
        "  const invalidBoolean: boolean = true;",
        "  const invalidArray: string[] = [];",
        "  void invalidBoolean; void invalidArray;",
        "}",
        "const invalidConstant = /fixed/u;",
        "function invalidFunction(condition: boolean): boolean { return condition; }",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        compilerOptions: { strict: true, target: "ESNext" },
        files: [fixtureFile],
      }),
      "utf8",
    );
    const api = new API({ cwd: temporaryRoot });
    try {
      const snapshot = api.updateSnapshot({ openProjects: [configFile] });
      try {
        const project = snapshot.getProjects()[0];
        assert.ok(project);
        const sourceFile = project.program.getSourceFile(fixtureFile);
        assert.ok(sourceFile);
        const violations = inspectSourceFile(sourceFile, project.checker);
        assert.deepEqual(
          violations.map(({ kind, name, rule }) => ({ kind, name, rule })),
          [
            {
              kind: "variable",
              name: "invalidBoolean",
              rule: "boolean-prefix",
            },
            {
              kind: "variable",
              name: "invalidArray",
              rule: "array-plural-camel-case",
            },
            {
              kind: "variable",
              name: "invalidConstant",
              rule: "true-constant-upper-snake-case",
            },
            { kind: "parameter", name: "condition", rule: "boolean-prefix" },
          ],
        );
      } finally {
        snapshot.dispose();
      }
    } finally {
      api.close();
    }
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test("旧checker実体は現行Treeに残らない", () => {
  assert.equal(
    fs.existsSync(
      path.join(repositoryRoot, "tools", "checker", retiredCheckerTs),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(repositoryRoot, "template", "tools", retiredCheckerTs),
    ),
    false,
  );
});

test("廃止済みPathの参照は固定履歴と移行説明にだけ残る", () => {
  assert.deepEqual(
    [...collectRetiredReferenceCounts()].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
    [...historicalReferenceCounts].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
});

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  type Expression,
  type Identifier,
  isArrayLiteralExpression,
  isArrowFunction,
  isAsExpression,
  isBinaryExpression,
  isBindingElement,
  isCallExpression,
  isClassDeclaration,
  isClassExpression,
  isElementAccessExpression,
  isExportAssignment,
  isExportDeclaration,
  isFunctionDeclaration,
  isFunctionExpression,
  isGetAccessorDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isMethodDeclaration,
  isNewExpression,
  isNonNullExpression,
  isNoSubstitutionTemplateLiteral,
  isObjectLiteralExpression,
  isParameterDeclaration,
  isParenthesizedExpression,
  isPropertyAccessExpression,
  isPropertyAssignment,
  isRegularExpressionLiteral,
  isSatisfiesExpression,
  isSetAccessorDeclaration,
  isStringLiteral,
  isTaggedTemplateExpression,
  isTemplateExpression,
  isTemplateSpan,
  isTypeAliasDeclaration,
  isVariableDeclaration,
  type Node,
  NodeFlags,
  type SourceFile,
  SyntaxKind,
  type VariableDeclaration,
} from "typescript/unstable/ast";
import {
  API,
  type Checker,
  type Project,
  SymbolFlags,
  type Type,
  TypeFlags,
} from "typescript/unstable/sync";
import {
  assertExactCheckerTestPopulation,
  discoverCheckerTestFiles,
  requireCheckerTestFiles,
  type TestDiscoveryOperations,
} from "./test-discovery.ts";

const checkerRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(checkerRoot, "../..");
const pathInspectionRoots = Object.freeze([
  path.join(repositoryRoot, "40_Develop"),
  path.join(repositoryRoot, "template", "tools"),
]);
const sourceOwnershipRoots = Object.freeze([
  path.join(repositoryRoot, "40_Develop", "checker"),
  path.join(repositoryRoot, "40_Develop", "coordinator"),
  path.join(repositoryRoot, "template", "tools"),
]);
const projectConfigs = Object.freeze([
  path.join(checkerRoot, "tsconfig.json"),
  path.join(
    repositoryRoot,
    "40_Develop",
    "coordinator",
    "tsconfig.strict.json",
  ),
  path.join(repositoryRoot, "40_Develop", "coordinator", "tsconfig.tests.json"),
]);
const EXPECTED_OWNED_SOURCE_COUNTS = Object.freeze({
  checkerAndTemplate: 7,
  coordinatorProduction: 151,
  coordinatorTests: 159,
  rustPlatformAccess: 9,
  uniqueTotal: 321,
});
const KEBAB_CASE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const CAMEL_CASE = /^[a-z][A-Za-z0-9]*$/u;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/u;
const UPPER_SNAKE_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;
const BOOLEAN_AUXILIARY_PREFIXES = new Set([
  "is",
  "has",
  "can",
  "should",
  "did",
  "does",
  "was",
  "were",
  "will",
]);
const SUBJECT_BOOLEAN_SUFFIXES = new Set([
  "Active",
  "Allowed",
  "Available",
  "Complete",
  "Completed",
  "Confirmed",
  "Created",
  "Eligible",
  "Exceeded",
  "Executed",
  "Failed",
  "Issued",
  "Present",
  "Absent",
  "Recorded",
  "Released",
  "Removed",
  "Requested",
  "Required",
  "Settled",
  "Spawned",
  "Started",
  "Submitted",
  "Terminated",
  "Transferred",
  "Exists",
  "Fails",
  "Match",
  "Matches",
  "Throw",
  "Performed",
]);
const STANDALONE_BOOLEAN_NAMES = new Set([
  "released",
  "closed",
  "submitted",
  "present",
  "settled",
  "exceeded",
  "confirmed",
  "terminated",
  "exists",
]);
const PLURAL_NAME =
  /(?:s|Children|Criteria|Evidence|Indices|Inventory|Vertices|People|Media|Data)$/u;
const TECHNICAL_VECTOR_NAME = /^argv$/u;
const STANDALONE_COLLECTIVE_NAME = /^evidence$/u;
const TEST_FILE =
  /^([a-z0-9]+(?:-[a-z0-9]+)*)\.(unit|contract|integration|boundary|golden|current)\.test\.ts$/u;
const TYPESCRIPT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.ts$/u;
const RUST_FILE = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*\.rs$/u;
const MARKDOWN_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.md$/u;
const JSON_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.json$/u;
const PYTHON_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.py$/u;
const TEXT_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.txt$/u;
const POLICY_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d+\.\d+\.\d+\.policy$/u;
const DOCKERFILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.Dockerfile$/u;
const RESERVED_FILE_NAMES = new Set([
  ".gitignore",
  "Cargo.lock",
  "Cargo.toml",
  "README.md",
  "main.rs",
  "package-lock.json",
  "package.json",
  "rust-toolchain.toml",
  "tsconfig.json",
  "tsconfig.strict.json",
  "tsconfig.tests.json",
]);
const RETIRED_CHECKER_MJS = `crdd${"_"}check.mjs`;
const RETIRED_CHECKER_TS = `crdd${"_"}check.ts`;
const RETIRED_CHECKER_TEST_TS = `crdd${"_"}check.test.ts`;
const RETIRED_FAULT_INJECTOR = `crdd${"_"}check_fault_injector`;
const RETIRED_THREAT_MODEL = `THREAT${"_"}MODEL.md`;
const RETIRED_REFERENCE_LITERALS = Object.freeze([
  RETIRED_CHECKER_MJS,
  RETIRED_CHECKER_TS,
  RETIRED_CHECKER_TEST_TS,
  RETIRED_FAULT_INJECTOR,
  RETIRED_THREAT_MODEL,
]);
const historicalReferenceCounts = new Map<string, number>([
  [`README.md|${RETIRED_CHECKER_TS}`, 2],
  [
    `90_Release/Changes/CHG-000001_Human_Decision_Presentation.md|${RETIRED_CHECKER_TS}`,
    3,
  ],
  [
    `90_Release/Changes/CHG-000001_Human_Decision_Presentation.md|${RETIRED_CHECKER_TEST_TS}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000002_GitHub_Anchor_Checker_Correction.md|${RETIRED_CHECKER_TS}`,
    3,
  ],
  [
    `90_Release/Changes/CHG-000002_GitHub_Anchor_Checker_Correction.md|${RETIRED_CHECKER_TEST_TS}`,
    3,
  ],
  [
    `90_Release/Changes/CHG-000004_Checker_Hierarchical_Compatibility.md|${RETIRED_CHECKER_TS}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000004_Checker_Hierarchical_Compatibility.md|${RETIRED_CHECKER_TEST_TS}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md|${RETIRED_CHECKER_TS}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md|${RETIRED_CHECKER_TEST_TS}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000005_Gitlink_Submodule_Verification.md|${RETIRED_FAULT_INJECTOR}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000007_Multi_Location_Remediation.md|${RETIRED_CHECKER_TS}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000007_Multi_Location_Remediation.md|${RETIRED_CHECKER_TEST_TS}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000010_First_Pass_Convergence.md|${RETIRED_CHECKER_TS}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000010_First_Pass_Convergence.md|${RETIRED_CHECKER_TEST_TS}`,
    2,
  ],
  [
    `90_Release/Changes/CHG-000017_Tools_Coding_Standards.md|${RETIRED_CHECKER_TS}`,
    4,
  ],
  [
    `90_Release/Changes/CHG-000017_Tools_Coding_Standards.md|${RETIRED_CHECKER_TEST_TS}`,
    1,
  ],
  [
    `90_Release/Changes/CHG-000017_Tools_Coding_Standards.md|${RETIRED_THREAT_MODEL}`,
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
const FIXED_GLOBAL_INTRINSICS = new Set(["Date"]);
const FIXED_GLOBAL_CALLS = new Set(["BigInt", "Symbol"]);
const FIXED_GLOBAL_OBJECTS = new Set(["JSON", "Object", "String"]);
const TYPED_ARRAY_INTRINSICS = new Set([
  "BigInt64Array",
  "BigUint64Array",
  "Buffer",
  "Float32Array",
  "Float64Array",
  "Int8Array",
  "Int16Array",
  "Int32Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Uint16Array",
  "Uint32Array",
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
    if (isPlatformAccessTarget(target)) {
      assertGeneratedTargetDirectory(target);
      continue;
    }
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

function isPlatformAccessTarget(target: string): boolean {
  return (
    target ===
    path.join(repositoryRoot, "40_Develop", "platform-access", "target")
  );
}

function assertGeneratedTargetDirectory(target: string): void {
  const metadata = fs.lstatSync(target);
  assert.equal(metadata.isSymbolicLink(), false, `symbolic target: ${target}`);
  assert.equal(metadata.isDirectory(), true, `non-directory target: ${target}`);
}

function collectReferenceFiles(root: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (
      entry.name === ".git" ||
      entry.name === "node_modules" ||
      entry.name === "Evidence" ||
      (root === repositoryRoot && entry.name === ".crdd")
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
  if (name.endsWith(".rs")) {
    assert.match(name, RUST_FILE, `Rust filename: ${file}`);
    return;
  }
  if (name.endsWith(".md")) {
    assert.match(name, MARKDOWN_FILE, `Markdown filename: ${file}`);
    return;
  }
  if (name.endsWith(".json")) {
    assert.match(name, JSON_FILE, `JSON filename: ${file}`);
    return;
  }
  if (name.endsWith(".py")) {
    assert.match(name, PYTHON_FILE, `Python filename: ${file}`);
    return;
  }
  if (name.endsWith(".txt")) {
    assert.match(name, TEXT_FILE, `text filename: ${file}`);
    return;
  }
  if (name.endsWith(".policy")) {
    assert.match(name, POLICY_FILE, `policy filename: ${file}`);
    return;
  }
  if (name.endsWith(".Dockerfile")) {
    assert.match(name, DOCKERFILE, `Dockerfile name: ${file}`);
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
    sourceOwnershipRoots.some((root) =>
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
    sourceOwnershipRoots.some((root) => isContainedPath(file, root))
  );
}

function isNullish(type: Type): boolean {
  return Boolean(type.flags & (TypeFlags.Null | TypeFlags.Undefined));
}

function isAllowedBooleanName(name: string): boolean {
  if (STANDALONE_BOOLEAN_NAMES.has(name)) return true;
  if (!CAMEL_CASE.test(name)) return false;
  for (const prefix of BOOLEAN_AUXILIARY_PREFIXES) {
    const nextCharacter = name[prefix.length];
    if (
      name.startsWith(prefix) &&
      nextCharacter !== undefined &&
      /[A-Z]/u.test(nextCharacter)
    )
      return true;
  }
  for (const suffix of SUBJECT_BOOLEAN_SUFFIXES) {
    if (name.length > suffix.length && name.endsWith(suffix)) return true;
  }
  return false;
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

function isArrayType(
  type: Type,
  checker: Checker,
  activeTypeIds = new Set<number>(),
): boolean {
  const types = nonNullishTypes(type);
  if (types.length === 0) return false;
  return types.every((candidateType) => {
    if (activeTypeIds.has(candidateType.id)) {
      throw new Error(`cyclic array type classification: ${candidateType.id}`);
    }
    if (candidateType.flags & TypeFlags.TypeParameter) {
      const constraint = checker.getBaseConstraintOfType(candidateType);
      if (!constraint || constraint.isErrorType()) return false;
      const nextTypeIds = new Set(activeTypeIds).add(candidateType.id);
      return isArrayType(constraint, checker, nextTypeIds);
    }
    return (
      !checker.isTupleType(candidateType) && checker.isArrayType(candidateType)
    );
  });
}

function isFunctionInitializer(initializer: Expression | undefined): boolean {
  return Boolean(
    initializer &&
      (isArrowFunction(initializer) ||
        isFunctionExpression(initializer) ||
        isClassExpression(initializer)),
  );
}

type FixedInitializerContext = Readonly<{
  activeSymbolIds: ReadonlySet<number>;
  checker: Checker;
  sourceFile: SourceFile;
}>;

function declarationSourcePath(
  identifier: Identifier,
  checker: Checker,
): string | null {
  const locatedSymbol = checker.getSymbolAtLocation(identifier);
  const symbol = locatedSymbol
    ? locatedSymbol.flags & SymbolFlags.Alias
      ? checker.getAliasedSymbol(locatedSymbol)
      : locatedSymbol
    : undefined;
  const declaration =
    symbol?.valueDeclaration?.resolve() ?? symbol?.declarations[0]?.resolve();
  return declaration
    ? path.normalize(declaration.getSourceFile().fileName)
    : null;
}

function isGlobalIntrinsic(
  identifier: Identifier,
  checker: Checker,
  allowedNames: ReadonlySet<string>,
): boolean {
  if (!allowedNames.has(identifier.text)) return false;
  const symbol = checker.getSymbolAtLocation(identifier);
  if (!symbol) return false;
  const sourcePath = declarationSourcePath(identifier, checker);
  return sourcePath === null || sourcePath.endsWith(".d.ts");
}

function isImportedCreateHash(
  identifier: Identifier,
  checker: Checker,
): boolean {
  if (identifier.text !== "createHash") return false;
  const sourcePath = declarationSourcePath(identifier, checker);
  return Boolean(
    sourcePath?.includes(`${path.sep}@types${path.sep}node${path.sep}`) &&
      sourcePath.endsWith(`${path.sep}crypto.d.ts`),
  );
}

function isTypedArrayPrototypeSnapshot(
  expression: Expression,
  checker: Checker,
): boolean {
  if (
    !isCallExpression(expression) ||
    expression.arguments.length !== 1 ||
    !isPropertyAccessExpression(expression.expression) ||
    expression.expression.name.text !== "getPrototypeOf" ||
    !isIdentifier(expression.expression.expression) ||
    !isGlobalIntrinsic(
      expression.expression.expression,
      checker,
      FIXED_GLOBAL_OBJECTS,
    )
  )
    return false;
  const prototype = expression.arguments[0];
  if (
    !isPropertyAccessExpression(prototype) ||
    prototype.name.text !== "prototype" ||
    !isIdentifier(prototype.expression) ||
    !TYPED_ARRAY_INTRINSICS.has(prototype.expression.text)
  )
    return false;
  const sourcePath = declarationSourcePath(prototype.expression, checker);
  return Boolean(sourcePath?.endsWith(".d.ts"));
}

function isGlobalPropertyAccess(
  expression: Expression,
  objectName: string,
  propertyName: string,
  checker: Checker,
): boolean {
  return (
    isPropertyAccessExpression(expression) &&
    expression.name.text === propertyName &&
    isIdentifier(expression.expression) &&
    expression.expression.text === objectName &&
    isGlobalIntrinsic(expression.expression, checker, FIXED_GLOBAL_OBJECTS)
  );
}

function isFixedAggregateMember(
  initializer: Expression | undefined,
  context: FixedInitializerContext,
): boolean {
  if (!initializer) return false;
  if (
    isParenthesizedExpression(initializer) ||
    isAsExpression(initializer) ||
    isSatisfiesExpression(initializer) ||
    isNonNullExpression(initializer)
  ) {
    return isFixedAggregateMember(initializer.expression, context);
  }
  if (isArrayLiteralExpression(initializer)) {
    return initializer.elements.every(
      (element) =>
        element.kind !== SyntaxKind.SpreadElement &&
        isFixedAggregateMember(element, context),
    );
  }
  if (isObjectLiteralExpression(initializer)) {
    return initializer.properties.every(
      (property) =>
        isPropertyAssignment(property) &&
        !property.name.getText().startsWith("[") &&
        isFixedAggregateMember(property.initializer, context),
    );
  }
  return isFixedInitializer(initializer, context);
}

function resolvedSymbolId(
  identifier: Identifier,
  checker: Checker,
): number | null {
  const locatedSymbol = checker.getSymbolAtLocation(identifier);
  if (!locatedSymbol) return null;
  const symbol =
    locatedSymbol.flags & SymbolFlags.Alias
      ? checker.getAliasedSymbol(locatedSymbol)
      : locatedSymbol;
  return symbol?.id ?? null;
}

function isNonEscapingDirectAggregate(
  declaration: VariableDeclaration,
  checker: Checker,
): boolean {
  if (
    !declaration.initializer ||
    (!isArrayLiteralExpression(declaration.initializer) &&
      !isObjectLiteralExpression(declaration.initializer)) ||
    !isIdentifier(declaration.name)
  ) {
    return false;
  }
  const declarationList = declaration.parent;
  const variableStatement = declarationList?.parent;
  if (
    variableStatement?.kind !== SyntaxKind.VariableStatement ||
    /^export\s/u.test(variableStatement.getText(declaration.getSourceFile()))
  ) {
    return false;
  }
  const symbolId = resolvedSymbolId(declaration.name, checker);
  if (symbolId === null) return false;
  let isNonEscaping = true;
  const visit = (node: Node): void => {
    if (!isNonEscaping) return;
    if (isIdentifier(node) && resolvedSymbolId(node, checker) === symbolId) {
      if (node === declaration.name) return;
      if (node.parent?.kind === SyntaxKind.VoidExpression) return;
      if (isSafeDirectAggregateRead(node, declaration, checker)) return;
      isNonEscaping = false;
      return;
    }
    node.forEachChild(visit);
  };
  declaration.getSourceFile().forEachChild(visit);
  return isNonEscaping;
}

function directAggregateSeed(
  expression: Expression | undefined,
  context: FixedInitializerContext,
): Expression | null {
  if (!expression) return null;
  if (
    isParenthesizedExpression(expression) ||
    isAsExpression(expression) ||
    isSatisfiesExpression(expression) ||
    isNonNullExpression(expression)
  ) {
    return directAggregateSeed(expression.expression, context);
  }
  if (
    isArrayLiteralExpression(expression) ||
    isObjectLiteralExpression(expression)
  ) {
    return isFixedAggregateMember(expression, context) ? expression : null;
  }
  const frozenSeed = fixedFreezeSeed(expression, context);
  if (frozenSeed) return frozenSeed;
  return null;
}

function fixedFreezeSeed(
  expression: Expression,
  context: FixedInitializerContext,
): Expression | null {
  if (
    !isCallExpression(expression) ||
    !isGlobalPropertyAccess(
      expression.expression,
      "Object",
      "freeze",
      context.checker,
    ) ||
    expression.arguments.length !== 1
  ) {
    return null;
  }
  let argument = expression.arguments[0];
  while (
    argument &&
    (isParenthesizedExpression(argument) ||
      isAsExpression(argument) ||
      isSatisfiesExpression(argument) ||
      isNonNullExpression(argument))
  ) {
    argument = argument.expression;
  }
  if (
    !argument ||
    (!isArrayLiteralExpression(argument) &&
      !isObjectLiteralExpression(argument))
  ) {
    return null;
  }
  return isFixedAggregateMember(argument, context) ? argument : null;
}

function literalPropertyName(node: Node): string | null {
  if (isIdentifier(node) || isStringLiteral(node)) return node.text;
  if (node.kind === SyntaxKind.NumericLiteral) return node.getText();
  return null;
}

function canonicalArrayIndex(node: Expression | undefined): number | null {
  if (!node) return null;
  const text =
    node.kind === SyntaxKind.NumericLiteral
      ? node.getText()
      : isStringLiteral(node)
        ? node.text
        : null;
  if (text === null || !/^(?:0|[1-9][0-9]*)$/u.test(text)) return null;
  const index = Number(text);
  return Number.isSafeInteger(index) ? index : null;
}

function primitiveReadType(type: Type): boolean {
  const types = type.isUnionType() ? type.getTypes() : [type];
  const allowedFlags =
    TypeFlags.Boolean |
    TypeFlags.BooleanLiteral |
    TypeFlags.String |
    TypeFlags.StringLiteral |
    TypeFlags.Number |
    TypeFlags.NumberLiteral |
    TypeFlags.BigInt |
    TypeFlags.BigIntLiteral;
  return (
    types.length > 0 &&
    types.every(
      (candidateType) =>
        !candidateType.isErrorType() &&
        !(
          candidateType.flags &
          (TypeFlags.Any |
            TypeFlags.Unknown |
            TypeFlags.Never |
            TypeFlags.Null |
            TypeFlags.Undefined |
            TypeFlags.TypeParameter)
        ) &&
        Boolean(candidateType.flags & allowedFlags),
    )
  );
}

function isSafeAggregateReadBinaryOperator(kind: SyntaxKind): boolean {
  switch (kind) {
    case SyntaxKind.AmpersandAmpersandToken:
    case SyntaxKind.AmpersandToken:
    case SyntaxKind.AsteriskAsteriskToken:
    case SyntaxKind.AsteriskToken:
    case SyntaxKind.BarBarToken:
    case SyntaxKind.BarToken:
    case SyntaxKind.CaretToken:
    case SyntaxKind.EqualsEqualsEqualsToken:
    case SyntaxKind.EqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsEqualsToken:
    case SyntaxKind.ExclamationEqualsToken:
    case SyntaxKind.GreaterThanEqualsToken:
    case SyntaxKind.GreaterThanGreaterThanGreaterThanToken:
    case SyntaxKind.GreaterThanGreaterThanToken:
    case SyntaxKind.GreaterThanToken:
    case SyntaxKind.LessThanEqualsToken:
    case SyntaxKind.LessThanLessThanToken:
    case SyntaxKind.LessThanToken:
    case SyntaxKind.MinusToken:
    case SyntaxKind.PercentToken:
    case SyntaxKind.PlusToken:
    case SyntaxKind.QuestionQuestionToken:
    case SyntaxKind.SlashToken:
      return true;
    default:
      return false;
  }
}

function isExportedVariableDeclaration(
  declaration: VariableDeclaration,
  checker: Checker,
): boolean {
  if (!isIdentifier(declaration.name)) return true;
  const variableStatement = declaration.parent?.parent;
  if (variableStatement?.kind === SyntaxKind.VariableStatement) {
    let hasExportModifier = false;
    variableStatement.forEachChild((child) => {
      if (child.kind === SyntaxKind.ExportKeyword) hasExportModifier = true;
    });
    if (hasExportModifier) return true;
  }
  const declarationSymbolId = resolvedSymbolId(declaration.name, checker);
  if (declarationSymbolId === null) return true;
  let isExported = false;
  let hasUnresolvedExport = false;
  for (const statement of declaration.getSourceFile().statements) {
    if (!isExportDeclaration(statement) && !isExportAssignment(statement))
      continue;
    const visit = (node: Node): void => {
      if (isExported) return;
      if (isIdentifier(node)) {
        const exportSymbolId = resolvedSymbolId(node, checker);
        if (exportSymbolId === null) hasUnresolvedExport = true;
        if (exportSymbolId === declarationSymbolId) isExported = true;
      }
      node.forEachChild(visit);
    };
    statement.forEachChild(visit);
  }
  return isExported || hasUnresolvedExport;
}

function aggregateReadUsageNode(accessNode: Node): Node | null {
  let usageNode = accessNode;
  const visitedNodes = new Set<Node>();
  while (usageNode.parent) {
    if (visitedNodes.has(usageNode)) return null;
    visitedNodes.add(usageNode);
    const parent = usageNode.parent;
    if (
      (isParenthesizedExpression(parent) ||
        isAsExpression(parent) ||
        isSatisfiesExpression(parent) ||
        isNonNullExpression(parent)) &&
      parent.expression === usageNode
    ) {
      usageNode = parent;
      continue;
    }
    if (
      isBinaryExpression(parent) &&
      (parent.left === usageNode || parent.right === usageNode) &&
      isSafeAggregateReadBinaryOperator(parent.operatorToken.kind)
    ) {
      usageNode = parent;
      continue;
    }
    if (
      isTemplateSpan(parent) &&
      parent.expression === usageNode &&
      isTemplateExpression(parent.parent)
    ) {
      usageNode = parent.parent;
      continue;
    }
    break;
  }
  return usageNode;
}

function isAllowedAggregateReadContext(
  accessNode: Node,
  checker: Checker,
): boolean {
  const usageNode = aggregateReadUsageNode(accessNode);
  if (!usageNode) return false;
  const parent = usageNode.parent;
  if (!parent) return false;
  if (parent.kind === SyntaxKind.VoidExpression) return true;
  return (
    isVariableDeclaration(parent) &&
    isIdentifier(parent.name) &&
    parent.initializer === usageNode &&
    !isExportedVariableDeclaration(parent, checker)
  );
}

function isSafeDirectAggregateRead(
  identifier: Identifier,
  declaration: VariableDeclaration,
  checker: Checker,
): boolean {
  type Segment = Readonly<
    | { kind: "property"; name: string }
    | { argument: Expression | undefined; kind: "index" }
  >;
  const segments: Segment[] = [];
  let accessNode: Node = identifier;
  while (accessNode.parent) {
    const parent = accessNode.parent;
    if (
      isPropertyAccessExpression(parent) &&
      parent.expression === accessNode
    ) {
      if (parent.questionDotToken) return false;
      segments.push({ kind: "property", name: parent.name.text });
      accessNode = parent;
      continue;
    }
    if (isElementAccessExpression(parent) && parent.expression === accessNode) {
      if (parent.questionDotToken) return false;
      segments.push({ argument: parent.argumentExpression, kind: "index" });
      accessNode = parent;
      continue;
    }
    break;
  }
  const accessType = checker.getTypeAtLocation(accessNode);
  if (
    segments.length === 0 ||
    !accessType ||
    !primitiveReadType(accessType) ||
    !isAllowedAggregateReadContext(accessNode, checker)
  )
    return false;
  const context: FixedInitializerContext = {
    activeSymbolIds: new Set(),
    checker,
    sourceFile: declaration.getSourceFile(),
  };
  const initialSeed = directAggregateSeed(declaration.initializer, context);
  if (!initialSeed) return false;
  let current: Expression = initialSeed;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) return false;
    if (isArrayLiteralExpression(current)) {
      if (
        segment.kind === "property" &&
        segment.name === "length" &&
        index === segments.length - 1
      ) {
        return true;
      }
      if (segment.kind !== "index") return false;
      const elementIndex = canonicalArrayIndex(segment.argument);
      const element: Expression | undefined =
        elementIndex === null ? undefined : current.elements[elementIndex];
      if (!element || element.kind === SyntaxKind.SpreadElement) return false;
      current = element;
    } else if (isObjectLiteralExpression(current)) {
      if (segment.kind !== "property" && segment.kind !== "index") return false;
      const key =
        segment.kind === "property"
          ? segment.name
          : segment.argument &&
              (isStringLiteral(segment.argument) ||
                segment.argument.kind === SyntaxKind.NumericLiteral)
            ? literalPropertyName(segment.argument)
            : null;
      if (!key || ["__proto__", "constructor", "prototype"].includes(key))
        return false;
      let matchingValue: Expression | null = null;
      let matchingCount = 0;
      for (const property of current.properties) {
        if (
          isPropertyAssignment(property) &&
          literalPropertyName(property.name) === key
        ) {
          matchingValue = property.initializer;
          matchingCount += 1;
        }
      }
      if (matchingCount !== 1 || !matchingValue) return false;
      current = matchingValue;
    } else {
      return false;
    }
    if (index < segments.length - 1) {
      const nestedSeed = directAggregateSeed(current, context);
      if (!nestedSeed) return false;
      current = nestedSeed;
    }
  }
  return isFixedInitializer(current, context);
}

function isFixedModuleConstantReference(
  identifier: Identifier,
  context: FixedInitializerContext,
): boolean {
  const locatedSymbol = context.checker.getSymbolAtLocation(identifier);
  const symbol = locatedSymbol
    ? locatedSymbol.flags & SymbolFlags.Alias
      ? context.checker.getAliasedSymbol(locatedSymbol)
      : locatedSymbol
    : undefined;
  if (!symbol || context.activeSymbolIds.has(symbol.id)) return false;
  const declaration =
    symbol.valueDeclaration?.resolve() ?? symbol.declarations[0]?.resolve();
  if (!declaration || !isVariableDeclaration(declaration)) {
    return isGlobalIntrinsic(
      identifier,
      context.checker,
      FIXED_GLOBAL_INTRINSICS,
    );
  }
  const declarationSource = declaration.getSourceFile();
  const normalizedDeclarationSource = path.normalize(
    declarationSource.fileName,
  );
  if (!isOwnedProgramFile(normalizedDeclarationSource))
    return isGlobalIntrinsic(
      identifier,
      context.checker,
      FIXED_GLOBAL_INTRINSICS,
    );
  const declarationList = declaration.parent;
  const variableStatement = declarationList?.parent;
  if (
    declarationList.kind !== SyntaxKind.VariableDeclarationList ||
    !(declarationList.flags & NodeFlags.Const) ||
    variableStatement?.kind !== SyntaxKind.VariableStatement ||
    variableStatement.parent?.kind !== SyntaxKind.SourceFile ||
    isFunctionInitializer(declaration.initializer)
  ) {
    return false;
  }
  const referenceContext = {
    ...context,
    activeSymbolIds: new Set(context.activeSymbolIds).add(symbol.id),
    sourceFile: declarationSource,
  };
  const declarationInitializer = declaration.initializer;
  if (
    declarationInitializer &&
    (isArrayLiteralExpression(declarationInitializer) ||
      isObjectLiteralExpression(declarationInitializer))
  ) {
    return (
      isNonEscapingDirectAggregate(declaration, context.checker) &&
      isFixedAggregateMember(declarationInitializer, referenceContext)
    );
  }
  return isFixedInitializer(declaration.initializer, referenceContext);
}

function isOwnedFixedAggregateAccess(
  initializer: Expression,
  context: FixedInitializerContext,
): boolean {
  let root: Expression = initializer;
  while (isPropertyAccessExpression(root) || isElementAccessExpression(root)) {
    root = root.expression;
  }
  if (!isIdentifier(root)) return false;
  const locatedSymbol = context.checker.getSymbolAtLocation(root);
  const symbol = locatedSymbol
    ? locatedSymbol.flags & SymbolFlags.Alias
      ? context.checker.getAliasedSymbol(locatedSymbol)
      : locatedSymbol
    : undefined;
  const declaration =
    symbol?.valueDeclaration?.resolve() ?? symbol?.declarations[0]?.resolve();
  return Boolean(
    declaration &&
      isVariableDeclaration(declaration) &&
      directAggregateSeed(declaration.initializer, context) &&
      isSafeDirectAggregateRead(root, declaration, context.checker) &&
      isFixedModuleConstantReference(root, context),
  );
}

function isFixedCreateHashDigest(
  initializer: Expression,
  context: FixedInitializerContext,
): boolean {
  if (!isCallExpression(initializer) || initializer.arguments.length !== 1)
    return false;
  const digestAccess = initializer.expression;
  if (
    !isPropertyAccessExpression(digestAccess) ||
    digestAccess.name.text !== "digest" ||
    !isFixedInitializer(initializer.arguments[0], context)
  )
    return false;
  const updateCall = digestAccess.expression;
  if (!isCallExpression(updateCall) || updateCall.arguments.length !== 1)
    return false;
  const updateAccess = updateCall.expression;
  if (
    !isPropertyAccessExpression(updateAccess) ||
    updateAccess.name.text !== "update" ||
    !isFixedInitializer(updateCall.arguments[0], context)
  )
    return false;
  const createCall = updateAccess.expression;
  return (
    isCallExpression(createCall) &&
    createCall.arguments.length === 1 &&
    isIdentifier(createCall.expression) &&
    isImportedCreateHash(createCall.expression, context.checker) &&
    isFixedInitializer(createCall.arguments[0], context)
  );
}

function isFixedInitializer(
  initializer: Expression | undefined,
  context: FixedInitializerContext,
): boolean {
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
    return isFixedInitializer(initializer.expression, context);
  }
  if (isIdentifier(initializer))
    return isFixedModuleConstantReference(initializer, context);
  if (isPropertyAccessExpression(initializer)) {
    if (
      initializer.getText() === "Date.now" ||
      initializer.getText() === "Date.prototype.toISOString"
    ) {
      const root =
        initializer.getText() === "Date.now"
          ? initializer.expression
          : isPropertyAccessExpression(initializer.expression)
            ? initializer.expression.expression
            : initializer.expression;
      return (
        isIdentifier(root) &&
        isGlobalIntrinsic(root, context.checker, FIXED_GLOBAL_INTRINSICS)
      );
    }
    if (
      initializer.name.text === "get" &&
      isCallExpression(initializer.expression) &&
      initializer.expression.arguments.length === 2 &&
      isGlobalPropertyAccess(
        initializer.expression.expression,
        "Object",
        "getOwnPropertyDescriptor",
        context.checker,
      )
    ) {
      return (
        isTypedArrayPrototypeSnapshot(
          initializer.expression.arguments[0],
          context.checker,
        ) && isFixedInitializer(initializer.expression.arguments[1], context)
      );
    }
    if (isOwnedFixedAggregateAccess(initializer, context)) return true;
    return false;
  }
  if (isElementAccessExpression(initializer))
    return isOwnedFixedAggregateAccess(initializer, context);
  if (isBinaryExpression(initializer)) {
    return (
      isFixedInitializer(initializer.left, context) &&
      isFixedInitializer(initializer.right, context)
    );
  }
  if (isTaggedTemplateExpression(initializer)) {
    return (
      isGlobalPropertyAccess(
        initializer.tag,
        "String",
        "raw",
        context.checker,
      ) &&
      (isNoSubstitutionTemplateLiteral(initializer.template) ||
        (isTemplateExpression(initializer.template) &&
          initializer.template.templateSpans.every((span) =>
            isFixedInitializer(span.expression, context),
          )))
    );
  }
  if (isTemplateExpression(initializer)) {
    return initializer.templateSpans.every((span) =>
      isFixedInitializer(span.expression, context),
    );
  }
  if (isNewExpression(initializer)) {
    return (
      isIdentifier(initializer.expression) &&
      isGlobalIntrinsic(
        initializer.expression,
        context.checker,
        new Set(["Set"]),
      ) &&
      initializer.arguments?.length === 1 &&
      isArrayLiteralExpression(initializer.arguments[0]) &&
      isFixedAggregateMember(initializer.arguments[0], context)
    );
  }
  if (isCallExpression(initializer)) {
    const callee = initializer.expression.getText();
    if (fixedFreezeSeed(initializer, context)) return true;
    if (
      isIdentifier(initializer.expression) &&
      isGlobalIntrinsic(
        initializer.expression,
        context.checker,
        FIXED_GLOBAL_CALLS,
      )
    ) {
      return (
        initializer.arguments.length <= 1 &&
        initializer.arguments.every((argument) =>
          isFixedInitializer(argument, context),
        )
      );
    }
    if (
      isGlobalPropertyAccess(
        initializer.expression,
        "JSON",
        "stringify",
        context.checker,
      )
    ) {
      return (
        initializer.arguments.length === 1 &&
        isFixedAggregateMember(initializer.arguments[0], context)
      );
    }
    if (callee.endsWith(".digest"))
      return isFixedCreateHashDigest(initializer, context);
  }
  return false;
}

function isModuleConstant(
  declaration: VariableDeclaration,
  checker: Checker,
): boolean {
  const declarationList = declaration.parent;
  const variableStatement = declarationList?.parent;
  const isModuleScopeConst = Boolean(
    declarationList &&
      declarationList.kind === SyntaxKind.VariableDeclarationList &&
      declarationList.flags & NodeFlags.Const &&
      variableStatement?.kind === SyntaxKind.VariableStatement &&
      variableStatement.parent?.kind === SyntaxKind.SourceFile &&
      !isFunctionInitializer(declaration.initializer),
  );
  if (!isModuleScopeConst || !declaration.initializer) return false;
  const context = {
    activeSymbolIds: new Set<number>(),
    checker,
    sourceFile: declaration.getSourceFile(),
  };
  if (
    isArrayLiteralExpression(declaration.initializer) ||
    isObjectLiteralExpression(declaration.initializer)
  ) {
    return (
      isNonEscapingDirectAggregate(declaration, checker) &&
      isFixedAggregateMember(declaration.initializer, context)
    );
  }
  return isFixedInitializer(declaration.initializer, context);
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

function isUnusedUnderscoreParameter(
  identifier: Identifier,
  kind: string,
  checker: Checker,
): boolean {
  if (kind !== "parameter" || !/^_[a-z][A-Za-z0-9]*$/u.test(identifier.text))
    return false;
  const symbolId = resolvedSymbolId(identifier, checker);
  if (symbolId === null) return false;
  let referenceCount = 0;
  const visit = (node: Node): void => {
    if (isIdentifier(node) && resolvedSymbolId(node, checker) === symbolId)
      referenceCount += 1;
    node.forEachChild(visit);
  };
  visit(identifier.getSourceFile());
  return referenceCount === 1;
}

function inspectIdentifier(
  identifier: Identifier,
  kind: string,
  checker: Checker,
  isConstant: boolean,
): NamingViolation[] {
  const name = identifier.text;
  const violations: NamingViolation[] = [];
  if (isUnusedUnderscoreParameter(identifier, kind, checker)) return violations;
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
    if (!isAllowedBooleanName(name)) {
      violations.push(identifierLocation(identifier, kind, "boolean-prefix"));
    }
    return violations;
  }
  if (isArrayType(type, checker)) {
    if (
      !CAMEL_CASE.test(name) ||
      (!PLURAL_NAME.test(name) &&
        !TECHNICAL_VECTOR_NAME.test(name) &&
        !STANDALONE_COLLECTIVE_NAME.test(name))
    ) {
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
      isClassExpression(node) ||
      isInterfaceDeclaration(node) ||
      isTypeAliasDeclaration(node)
    ) {
      if (node.name && !PASCAL_CASE.test(node.name.text)) {
        violations.push(identifierLocation(node.name, "type", "pascal-case"));
      }
    } else if (isFunctionDeclaration(node) || isFunctionExpression(node)) {
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
    } else if (
      (isMethodDeclaration(node) ||
        isGetAccessorDeclaration(node) ||
        isSetAccessorDeclaration(node)) &&
      isIdentifier(node.name)
    ) {
      const isExternalOverride = node.modifiers?.some(
        (modifier) => modifier.kind === SyntaxKind.OverrideKeyword,
      );
      if (isExternalOverride) {
        node.forEachChild(visit);
        return;
      }
      const declarationKind = isMethodDeclaration(node)
        ? "method"
        : isGetAccessorDeclaration(node)
          ? "getter"
          : "setter";
      if (!CAMEL_CASE.test(node.name.text)) {
        violations.push(
          identifierLocation(node.name, declarationKind, "camel-case"),
        );
      }
      if (FORBIDDEN_BARE_IDENTIFIERS.has(node.name.text)) {
        violations.push(
          identifierLocation(node.name, declarationKind, "forbidden-bare-name"),
        );
      }
    } else if (isVariableDeclaration(node)) {
      violations.push(
        ...inspectBindingName(
          node.name,
          "variable",
          checker,
          isModuleConstant(node, checker),
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

function collectOwnedTypeScriptPaths(files: readonly string[]): Set<string> {
  return new Set(
    files
      .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"))
      .map(resolveOwnedSource),
  );
}

function collectOwnedRustPaths(files: readonly string[]): Set<string> {
  return new Set(
    files
      .filter((file) => file.endsWith(".rs"))
      .map((file) => fs.realpathSync.native(file)),
  );
}

function formatViolations(violations: readonly NamingViolation[]): string {
  return violations
    .map(
      (violation) =>
        `${path.relative(repositoryRoot, violation.file)}:${violation.line}:${violation.column} ${violation.kind} ${violation.name} ${violation.rule}`,
    )
    .join("\n");
}

test("内部実装のPathと型付きsource identifierは内部コーディング規約へ一致する", () => {
  const files = pathInspectionRoots.flatMap(collectFiles);
  for (const file of files) assertFileName(file);
  const codingStandards = fs.lstatSync(
    path.join(repositoryRoot, "06_Architecture", "99_Coding_Standards.md"),
  );
  assert.ok(codingStandards.isFile() && !codingStandards.isSymbolicLink());
  const api = new API({ cwd: checkerRoot });
  try {
    const { projects, snapshot } = collectOwnedProjects(api, projectConfigs);
    try {
      const checkerFiles = projects[0]?.program
        .getSourceFileNames()
        .filter(
          (file) =>
            isOwnedProgramFile(file) &&
            (isContainedPath(
              file,
              path.join(repositoryRoot, "40_Develop", "checker"),
            ) ||
              isContainedPath(
                file,
                path.join(repositoryRoot, "template", "tools"),
              )),
        );
      const productionRoot = path.join(
        repositoryRoot,
        "40_Develop",
        "coordinator",
      );
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
      const projectCheckerTests =
        checkerFiles
          ?.filter(
            (file) =>
              file.endsWith(".test.ts") && isContainedPath(file, checkerRoot),
          )
          .map(resolveOwnedSource) ?? [];
      assertExactCheckerTestPopulation(
        discoverCheckerTestFiles(checkerRoot),
        projectCheckerTests,
      );
      assert.equal(
        productionFiles?.length,
        EXPECTED_OWNED_SOURCE_COUNTS.coordinatorProduction,
      );
      assert.equal(
        testProjectFiles?.filter((file) =>
          isContainedPath(
            file,
            path.join(repositoryRoot, "40_Develop", "coordinator", "tests"),
          ),
        ).length,
        EXPECTED_OWNED_SOURCE_COUNTS.coordinatorTests,
      );
      const { sourceFiles, violations } = inspectProjects(projects);
      assert.equal(sourceFiles.size, EXPECTED_OWNED_SOURCE_COUNTS.uniqueTotal);
      const pathSourceFiles = collectOwnedTypeScriptPaths(files);
      assert.deepEqual(
        [...sourceFiles.keys()].sort(),
        [...pathSourceFiles].sort(),
        "every owned TypeScript Path must belong to an inspected project and vice versa",
      );
      const rustSourceFiles = collectOwnedRustPaths(files);
      assert.equal(
        rustSourceFiles.size,
        EXPECTED_OWNED_SOURCE_COUNTS.rustPlatformAccess,
      );
      const rustSourceRoots = [
        path.join(repositoryRoot, "40_Develop", "platform-access", "src"),
        path.join(repositoryRoot, "40_Develop", "platform-access", "tests"),
      ];
      const rustBuildScript = path.join(
        repositoryRoot,
        "40_Develop",
        "platform-access",
        "build.rs",
      );
      for (const rustSourceFile of rustSourceFiles) {
        assert.ok(
          rustSourceFile === rustBuildScript ||
            rustSourceRoots.some((root) =>
              isContainedPath(rustSourceFile, root),
            ),
          `Rust source outside private platform-access crate: ${rustSourceFile}`,
        );
      }
      assert.equal(violations.length, 0, formatViolations(violations));
    } finally {
      snapshot.dispose();
    }
  } finally {
    api.close();
  }
});

test("Checker試験の実行集合はnested配置を含む所有集合と完全一致する", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-checker-test-discovery-"),
  );
  try {
    const nestedRoot = path.join(temporaryRoot, "nested-subject");
    const dependencyRoot = path.join(temporaryRoot, "node_modules");
    fs.mkdirSync(nestedRoot);
    fs.mkdirSync(dependencyRoot);
    const directTest = path.join(temporaryRoot, "alpha.contract.test.ts");
    const nestedTest = path.join(nestedRoot, "beta.unit.test.ts");
    fs.writeFileSync(directTest, "", "utf8");
    fs.writeFileSync(nestedTest, "", "utf8");
    fs.writeFileSync(
      path.join(temporaryRoot, "ordinary-source.ts"),
      "",
      "utf8",
    );
    fs.writeFileSync(
      path.join(dependencyRoot, "ignored.contract.test.ts"),
      "",
      "utf8",
    );

    const discoveredTests = discoverCheckerTestFiles(temporaryRoot);
    assert.deepEqual(discoveredTests, [
      fs.realpathSync.native(directTest),
      fs.realpathSync.native(nestedTest),
    ]);
    assertExactCheckerTestPopulation(discoveredTests, discoveredTests);
    assert.strictEqual(
      requireCheckerTestFiles(discoveredTests),
      discoveredTests,
    );
    assert.throws(
      () =>
        assertExactCheckerTestPopulation(discoveredTests, [
          directTest,
          nestedTest,
          path.join(temporaryRoot, "missing.contract.test.ts"),
        ]),
      /missing from runner/u,
    );
    assert.throws(
      () => assertExactCheckerTestPopulation(discoveredTests, [directTest]),
      /missing from project/u,
    );
    assert.throws(
      () =>
        assertExactCheckerTestPopulation(
          [directTest, directTest.toUpperCase()],
          [directTest],
        ),
      /duplicate or case-colliding/u,
    );

    const emptyRoot = path.join(temporaryRoot, "empty-root");
    fs.mkdirSync(emptyRoot);
    const emptyTests = discoverCheckerTestFiles(emptyRoot);
    assert.deepEqual(emptyTests, []);
    assert.throws(() => requireCheckerTestFiles(emptyTests), /not found/u);

    const junctionTarget = path.join(temporaryRoot, "junction-target");
    fs.mkdirSync(junctionTarget);
    fs.symlinkSync(
      junctionTarget,
      path.join(temporaryRoot, "linked-tests"),
      process.platform === "win32" ? "junction" : "dir",
    );
    assert.throws(() => discoverCheckerTestFiles(temporaryRoot), /symbolic/u);
    fs.rmSync(path.join(temporaryRoot, "linked-tests"));

    const unsupportedEntry = path.join(temporaryRoot, "unsupported-entry");
    fs.writeFileSync(unsupportedEntry, "", "utf8");
    const unknownEntryOperations: TestDiscoveryOperations = {
      inspectPath: (target) =>
        target === unsupportedEntry
          ? {
              isDirectory: () => false,
              isFile: () => false,
              isSymbolicLink: () => false,
            }
          : fs.lstatSync(target),
      listNames: (target) => fs.readdirSync(target),
      resolvePath: (target) => fs.realpathSync.native(target),
    };
    assert.throws(
      () => discoverCheckerTestFiles(temporaryRoot, unknownEntryOperations),
      /Unsupported Checker test entry/u,
    );
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("Boolean predicateの文法は正本化した三つの閉集合だけを許可する", () => {
  for (const prefix of BOOLEAN_AUXILIARY_PREFIXES)
    assert.equal(isAllowedBooleanName(`${prefix}Ready`), true, prefix);
  for (const suffix of SUBJECT_BOOLEAN_SUFFIXES)
    assert.equal(isAllowedBooleanName(`subject${suffix}`), true, suffix);
  for (const standaloneName of STANDALONE_BOOLEAN_NAMES)
    assert.equal(isAllowedBooleanName(standaloneName), true, standaloneName);
  for (const invalidName of [
    "is",
    "isready",
    "subjectUnknown",
    "subjectcompleted",
    "subjectCompletedd",
    "Released",
    "release",
  ])
    assert.equal(isAllowedBooleanName(invalidName), false, invalidName);
});

test("Path classifierは不正folderと不正fileを別々に拒否する", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "crdd-tools-path-naming-"),
  );
  try {
    const invalidFolderRoot = path.join(temporaryRoot, "tools");
    const invalidFolder = path.join(invalidFolderRoot, "bad_name");
    fs.mkdirSync(invalidFolder, { recursive: true });
    fs.writeFileSync(path.join(invalidFolder, "valid-file.ts"), "", "utf8");
    assert.throws(
      () => collectFiles(invalidFolderRoot),
      /folder name/u,
      "an invalid folder must not be hidden by a valid child filename",
    );

    const invalidFileRoot = path.join(temporaryRoot, "template-tools");
    const validFolder = path.join(invalidFileRoot, "valid-folder");
    fs.mkdirSync(validFolder, { recursive: true });
    fs.writeFileSync(path.join(validFolder, "bad_name.ts"), "", "utf8");
    const invalidFiles = collectFiles(invalidFileRoot);
    assert.equal(invalidFiles.length, 1);
    assert.throws(
      () => assertFileName(invalidFiles[0]),
      /TypeScript filename/u,
      "an invalid filename must be checked independently of its folder",
    );

    const siblingPackageRoot = path.join(temporaryRoot, "sibling-package");
    fs.mkdirSync(siblingPackageRoot);
    fs.writeFileSync(
      path.join(siblingPackageRoot, "owned-module.ts"),
      "export {};\n",
      "utf8",
    );
    assert.deepEqual(
      collectFiles(siblingPackageRoot).map((file) => path.basename(file)),
      ["owned-module.ts"],
      "an unknown sibling package must still use the shared Path classifier",
    );

    for (const validArtifactName of [
      "provider-settings.json",
      "provider-egress-proxy.py",
      "general-task-verification.txt",
      "windows-docker-desktop-4.41.2.policy",
      "provider-egress-proxy.Dockerfile",
    ]) {
      assert.doesNotThrow(
        () => assertFileName(path.join(validFolder, validArtifactName)),
        `owned non-TypeScript artifact must follow its shared convention: ${validArtifactName}`,
      );
    }
    for (const [invalidArtifactName, expectedRule] of [
      ["provider_settings.json", /JSON filename/u],
      ["provider_egress_proxy.py", /Python filename/u],
      ["general_task_verification.txt", /text filename/u],
      ["windows_docker_desktop.policy", /policy filename/u],
      ["provider_egress_proxy.Dockerfile", /Dockerfile name/u],
    ] as const) {
      assert.throws(
        () => assertFileName(path.join(validFolder, invalidArtifactName)),
        expectedRule,
        `invalid non-TypeScript artifact must fail its owned convention: ${invalidArtifactName}`,
      );
    }

    const generatedTarget = path.join(temporaryRoot, "target");
    fs.mkdirSync(generatedTarget);
    assert.doesNotThrow(() => assertGeneratedTargetDirectory(generatedTarget));
    fs.rmSync(generatedTarget, { recursive: true });
    fs.writeFileSync(generatedTarget, "not a directory", "utf8");
    assert.throws(
      () => assertGeneratedTargetDirectory(generatedTarget),
      /non-directory target/u,
    );
    fs.rmSync(generatedTarget);
    const junctionTarget = path.join(temporaryRoot, "target-junction");
    const junctionDestination = path.join(temporaryRoot, "target-destination");
    fs.mkdirSync(junctionDestination);
    fs.symlinkSync(junctionDestination, junctionTarget, "junction");
    assert.throws(
      () => assertGeneratedTargetDirectory(junctionTarget),
      /symbolic target/u,
    );
  } finally {
    fs.rmSync(temporaryRoot, { force: true, recursive: true });
  }
});

test("型付き命名classifierは構文境界の正負例を同じ規則で判定する", () => {
  const temporaryRoot = fs.mkdtempSync(
    path.join(checkerRoot, ".naming-fixture-"),
  );
  try {
    const fixtureFile = path.join(temporaryRoot, "fixture.ts");
    const shadowFixtureFile = path.join(temporaryRoot, "shadow-fixture.ts");
    const configFile = path.join(temporaryRoot, "tsconfig.json");
    const fixtureTypesRoot = path.join(
      temporaryRoot,
      "node_modules",
      "@types",
      "node",
    );
    fs.mkdirSync(fixtureTypesRoot, { recursive: true });
    fs.writeFileSync(
      path.join(fixtureTypesRoot, "index.d.ts"),
      [
        '/// <reference path="crypto.d.ts" />',
        '/// <reference path="path.d.ts" />',
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixtureTypesRoot, "package.json"),
      JSON.stringify({
        name: "@types/node",
        version: "0.0.0",
        types: "index.d.ts",
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixtureTypesRoot, "crypto.d.ts"),
      [
        'declare module "node:crypto" {',
        '  interface Hash { update(value: string): Hash; digest(encoding: "hex"): string; }',
        '  export function createHash(algorithm: "sha256"): Hash;',
        "}",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixtureTypesRoot, "path.d.ts"),
      [
        'declare module "node:path" {',
        "  const path: { resolve(value: string): string };",
        "  export default path;",
        "}",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      fixtureFile,
      [
        'import path from "node:path";',
        'import { createHash } from "node:crypto";',
        "const MAX_ITEMS = 3;",
        "const FIXED_PATTERN = /fixed/u;",
        'const FIXED_SET = new Set(["fixed"]);',
        "const FIXED_TEMPLATE = String.raw`fixed`;",
        "const INTRINSIC_DATE = Date;",
        "const INTRINSIC_DATE_NOW = Date.now;",
        "const INTRINSIC_DATE_TO_ISO = Date.prototype.toISOString;",
        "const DATE_PARSE = Date.parse;",
        "const DATE_PROTOTYPE = Date.prototype;",
        'const DIRECT_FIXED_ITEMS = ["fixed"];',
        'const DIRECT_FIXED_PROFILE = { mode: "fixed" };',
        "const DIRECT_FIXED_LENGTH = DIRECT_FIXED_ITEMS.length;",
        "const DIRECT_FIXED_FIRST = DIRECT_FIXED_ITEMS[0];",
        "const DIRECT_FIXED_MODE = DIRECT_FIXED_PROFILE.mode;",
        'const HAS_DIRECT_FIXED_MODE = DIRECT_FIXED_PROFILE.mode === "fixed";',
        "const DIRECT_FIXED_TEMPLATE = `" +
          "$" +
          "{DIRECT_FIXED_PROFILE.mode}" +
          "`;",
        "const NESTED_BINARY_PROFILE = { count: 1 };",
        "const NESTED_BINARY_TOTAL = NESTED_BINARY_PROFILE.count + 1 + 1;",
        "const TEMPLATE_BINARY_PROFILE = { count: 1 };",
        "const TEMPLATE_BINARY_TEXT = `" +
          "$" +
          "{TEMPLATE_BINARY_PROFILE.count + 1}" +
          "`;",
        "const VOID_BINARY_PROFILE = { count: 1 };",
        "void (VOID_BINARY_PROFILE.count + 1);",
        'const VOID_TEMPLATE_PROFILE = { mode: "fixed" };',
        "void `" + "$" + "{VOID_TEMPLATE_PROFILE.mode}" + "`;",
        'const DIRECT_NESTED_PROFILE = { nested: { mode: "fixed" } };',
        "const DIRECT_NESTED_MODE = DIRECT_NESTED_PROFILE.nested.mode;",
        'const FROZEN_PROFILE = Object.freeze({ mode: "fixed" });',
        "const FROZEN_MODE = FROZEN_PROFILE.mode;",
        "const FROZEN_DATE = Object.freeze(Date);",
        "const FROZEN_DATE_PARSE = FROZEN_DATE.parse;",
        "const FROZEN_DATE_ALIAS = Object.freeze(INTRINSIC_DATE);",
        "const FROZEN_ALIAS_PROTOTYPE = FROZEN_DATE_ALIAS.prototype;",
        'const FROZEN_PRIMITIVE = Object.freeze("fixed");',
        'const ownedFreezeSource = { mode: "fixed" };',
        "const FROZEN_OWNED = Object.freeze(ownedFreezeSource);",
        "const TYPED_ARRAY_BYTE_LENGTH = Object.getOwnPropertyDescriptor(",
        "  Object.getPrototypeOf(Uint8Array.prototype),",
        '  "byteLength",',
        ")?.get;",
        'const FIXED_DIGEST = createHash("sha256").update("fixed").digest("hex");',
        "function validLocals(): void {",
        "  const isReady: boolean | undefined = true;",
        "  const candidatePaths: readonly string[] = [];",
        "  void isReady; void candidatePaths;",
        "}",
        "type Names = readonly string[];",
        "function aliasArrays(candidateNames: Names | null): void { void candidateNames; }",
        "function genericArrays<T extends readonly string[]>(candidateItems: T): void { void candidateItems; }",
        "function unconstrainedGeneric<T>(value: T): void { void value; }",
        "function nonArrays(tupleItem: readonly [string, number], bytes: Uint8Array, valueSet: Set<string>, valueMap: Map<string, string>): void {",
        "  void tupleItem; void bytes; void valueSet; void valueMap;",
        "}",
        "const predicate = (shouldContinue: boolean): boolean => shouldContinue;",
        "const { enabled: hasFeature } = { enabled: true };",
        "function acceptedPredicates(generationReleased: boolean, configurationMatches: boolean, didOperationThrow: boolean): void {",
        "  void generationReleased; void configurationMatches; void didOperationThrow;",
        "}",
        "function invalidPredicates(highCostSelection: boolean, internal: boolean, sameHome: boolean): void {",
        "  void highCostSelection; void internal; void sameHome;",
        "}",
        "function acceptedCollections(argv: readonly string[], acceptanceCriteria: readonly string[], evidence: readonly string[], currentInventory: readonly string[]): void {",
        "  void argv; void acceptanceCriteria; void evidence; void currentInventory;",
        "}",
        "function invalidCollections(actual: readonly string[], before: readonly string[]): void { void actual; void before; }",
        "function unusedParameter(_unusedProvider: string): void {}",
        "function usedUnderscoreParameter(_usedProvider: string): void { void _usedProvider; }",
        'const _localVariable = "invalid";',
        "void _localVariable;",
        "function inspectValues(values: string[]): boolean { return values.length > 0; }",
        "class ValidClass extends ExternalBase {",
        "  override methodName(): void {}",
        "  override BAD_OVERRIDE(): void {}",
        '  get statusValue(): string { return "ok"; }',
        "  set statusValue(value: string) { void value; }",
        "}",
        "const validFunctionExpression = function inspectFixture(): void {};",
        "const validClassExpression = class FixtureClass {};",
        'const runtimePath = path.resolve(".");',
        "const runtimeSnapshot = { path: runtimePath };",
        'const resourceHandle = createHash("sha256");',
        "const weakCache = new WeakMap<object, object>();",
        'const MUTATED_ITEMS = ["fixed"];',
        'MUTATED_ITEMS.push("changed");',
        'const NESTED_MUTATED_PROFILE = { values: ["fixed"] };',
        'NESTED_MUTATED_PROFILE.values.push("changed");',
        'const ALIASED_ITEMS = ["fixed"];',
        "const aliasItems = ALIASED_ITEMS;",
        "function consumeItems(candidateItems: readonly string[]): void { void candidateItems; }",
        'const ESCAPED_ITEMS = ["fixed"];',
        "consumeItems(ESCAPED_ITEMS);",
        'const CONSTRUCTOR_PROFILE = { mode: "fixed" };',
        "const constructorName = CONSTRUCTOR_PROFILE.constructor.name;",
        'const METHOD_PROFILE = { label: "fixed" };',
        "const methodLength = METHOD_PROFILE.toString.length;",
        'const OUT_OF_RANGE_ITEMS = ["fixed"];',
        "const outOfRangeItem = OUT_OF_RANGE_ITEMS[1];",
        'const DYNAMIC_KEY = "mode";',
        'const DYNAMIC_PROFILE = { mode: "fixed" };',
        "const dynamicMode = DYNAMIC_PROFILE[DYNAMIC_KEY];",
        'const NESTED_ESCAPE_PROFILE = { nested: { mode: "fixed" } };',
        "const nestedProfile = NESTED_ESCAPE_PROFILE.nested;",
        'const WRITE_PROFILE = { mode: "fixed" };',
        'WRITE_PROFILE.mode = "changed";',
        "const COMPOUND_PROFILE = { count: 1 };",
        "COMPOUND_PROFILE.count += 1;",
        "const LOGICAL_PROFILE = { enabled: true };",
        "LOGICAL_PROFILE.enabled &&= false;",
        "const UPDATE_PROFILE = { count: 1 };",
        "UPDATE_PROFILE.count++;",
        'const DELETE_PROFILE = { mode: "fixed" };',
        "delete DELETE_PROFILE.mode;",
        'const WRITE_ITEMS = ["fixed"];',
        'WRITE_ITEMS[0] = "changed";',
        'const LENGTH_ITEMS = ["fixed"];',
        "LENGTH_ITEMS.length = 0;",
        'const WRAPPED_WRITE_PROFILE = { mode: "fixed" };',
        '(WRAPPED_WRITE_PROFILE.mode) = "changed";',
        "function consumeMode(mode: string): void { void mode; }",
        'const CALL_PROFILE = { mode: "fixed" };',
        "consumeMode(CALL_PROFILE.mode);",
        "class ModeBox { constructor(mode: string) { void mode; } }",
        'const NEW_PROFILE = { mode: "fixed" };',
        "new ModeBox(NEW_PROFILE.mode);",
        'const RETURN_PROFILE = { mode: "fixed" };',
        "function returnMode(): string { return RETURN_PROFILE.mode; }",
        'const ARROW_PROFILE = { mode: "fixed" };',
        "const readMode = (): string => ARROW_PROFILE.mode;",
        'const EXPORT_PROFILE = { mode: "fixed" };',
        "export const exportedMode = EXPORT_PROFILE.mode;",
        "const NESTED_CALL_PROFILE = { count: 1 };",
        "consumeMode(String(NESTED_CALL_PROFILE.count + 1));",
        'const NESTED_NEW_PROFILE = { mode: "fixed" };',
        "new ModeBox(`" + "$" + "{NESTED_NEW_PROFILE.mode}" + "`);",
        "const NESTED_RETURN_PROFILE = { count: 1 };",
        "function returnNestedCount(): number { return NESTED_RETURN_PROFILE.count + 1; }",
        'const NESTED_ARROW_PROFILE = { mode: "fixed" };',
        "const readNestedMode = (): string => `" +
          "$" +
          "{NESTED_ARROW_PROFILE.mode}" +
          "`;",
        "const NESTED_EXPORT_PROFILE = { count: 1 };",
        "export const exportedCount = NESTED_EXPORT_PROFILE.count + 1;",
        "const SPECIFIER_EXPORT_PROFILE = { count: 1 };",
        "const exportedCountBySpecifier = SPECIFIER_EXPORT_PROFILE.count + 1;",
        "export { exportedCountBySpecifier };",
        'function modeTag(strings: TemplateStringsArray): string { return strings[0] ?? ""; }',
        'const TAGGED_TEMPLATE_PROFILE = { mode: "fixed" };',
        "modeTag`" + "$" + "{TAGGED_TEMPLATE_PROFILE.mode}" + "`;",
        "const CONDITIONAL_PROFILE = { enabled: true };",
        'const conditionalMode = CONDITIONAL_PROFILE.enabled ? "yes" : "no";',
        "const COMMA_PROFILE = { count: 1 };",
        "const commaMode = (COMMA_PROFILE.count, 1);",
        'const DESTRUCTURE_PROFILE = { mode: "fixed" };',
        "const [destructuredMode] = DESTRUCTURE_PROFILE.mode;",
        "const YIELD_PROFILE = { count: 1 };",
        "function* yieldCount(): Generator<number> { yield YIELD_PROFILE.count + 1; }",
        "function invalidLocals(): void {",
        "  const invalidBoolean: boolean = true;",
        "  const invalidArray: string[] = [];",
        "  void invalidBoolean; void invalidArray;",
        "}",
        "const invalidConstant = /fixed/u;",
        "function invalidFunction(condition: boolean): boolean { return condition; }",
        "function invalidNullableArray(nullableItem: readonly string[] | null): void { void nullableItem; }",
        "function invalidGenericArray<T extends readonly string[]>(genericItem: T): void { void genericItem; }",
        "const invalidNamedFunction = function BadFunction(): void {};",
        "const invalidNamedClass = class badClass {};",
        "class InvalidMembers {",
        "  BadMethod(): void {}",
        '  get BadGetter(): string { return "bad"; }',
        "  set BadSetter(value: string) { void value; }",
        "}",
        "const RUNTIME_PATH = runtimePath;",
        "const RUNTIME_FREEZE = Object.freeze(runtimeSnapshot);",
        "const FROZEN_RESOURCE = Object.freeze(resourceHandle);",
        'const RESOURCE_HANDLE = createHash("sha256");',
        "const WEAK_CACHE = new WeakMap<object, object>();",
        "const CYCLE_A = CYCLE_B;",
        "const CYCLE_B = CYCLE_A;",
        "interface ExternalShape { enabled: boolean; values: string[]; BAD_PROPERTY: boolean; }",
        "function inspectExternalShape(): void {",
        "  const externalShape: ExternalShape = { enabled: true, values: [], BAD_PROPERTY: true };",
        "  void externalShape;",
        "}",
        "void FIXED_PATTERN; void FIXED_SET; void FIXED_TEMPLATE; void INTRINSIC_DATE;",
        "void INTRINSIC_DATE_NOW; void INTRINSIC_DATE_TO_ISO; void DATE_PARSE; void DATE_PROTOTYPE;",
        "void DIRECT_FIXED_ITEMS; void DIRECT_FIXED_PROFILE; void TYPED_ARRAY_BYTE_LENGTH;",
        "void DIRECT_FIXED_LENGTH; void DIRECT_FIXED_FIRST; void DIRECT_FIXED_MODE;",
        "void HAS_DIRECT_FIXED_MODE; void DIRECT_FIXED_TEMPLATE;",
        "void NESTED_BINARY_PROFILE; void NESTED_BINARY_TOTAL; void TEMPLATE_BINARY_PROFILE; void TEMPLATE_BINARY_TEXT;",
        "void VOID_BINARY_PROFILE; void VOID_TEMPLATE_PROFILE;",
        "void DIRECT_NESTED_PROFILE; void DIRECT_NESTED_MODE; void FROZEN_PROFILE; void FROZEN_MODE;",
        "void FROZEN_DATE; void FROZEN_DATE_PARSE; void FROZEN_DATE_ALIAS; void FROZEN_ALIAS_PROTOTYPE;",
        "void FIXED_DIGEST; void validFunctionExpression; void validClassExpression;",
        "void resourceHandle; void weakCache; void aliasItems; void invalidNamedFunction; void invalidNamedClass;",
        "void MUTATED_ITEMS; void NESTED_MUTATED_PROFILE; void ALIASED_ITEMS; void ESCAPED_ITEMS;",
        "void CONSTRUCTOR_PROFILE; void constructorName; void METHOD_PROFILE; void methodLength;",
        "void OUT_OF_RANGE_ITEMS; void outOfRangeItem; void DYNAMIC_KEY; void DYNAMIC_PROFILE; void dynamicMode;",
        "void NESTED_ESCAPE_PROFILE; void nestedProfile;",
        "void FROZEN_PRIMITIVE; void ownedFreezeSource; void FROZEN_OWNED;",
        "void RUNTIME_PATH; void RUNTIME_FREEZE; void FROZEN_RESOURCE; void RESOURCE_HANDLE; void WEAK_CACHE;",
        "void WRITE_PROFILE; void COMPOUND_PROFILE; void LOGICAL_PROFILE; void UPDATE_PROFILE; void DELETE_PROFILE;",
        "void WRITE_ITEMS; void LENGTH_ITEMS; void WRAPPED_WRITE_PROFILE; void CALL_PROFILE; void NEW_PROFILE;",
        "void RETURN_PROFILE; void ARROW_PROFILE; void readMode; void EXPORT_PROFILE; void exportedMode; void ModeBox;",
        "void NESTED_CALL_PROFILE; void NESTED_NEW_PROFILE; void NESTED_RETURN_PROFILE; void NESTED_ARROW_PROFILE;",
        "void NESTED_EXPORT_PROFILE; void SPECIFIER_EXPORT_PROFILE; void exportedCountBySpecifier;",
        "void TAGGED_TEMPLATE_PROFILE; void CONDITIONAL_PROFILE; void conditionalMode; void COMMA_PROFILE; void commaMode;",
        "void DESTRUCTURE_PROFILE; void destructuredMode; void YIELD_PROFILE; void yieldCount; void readNestedMode;",
        "void CYCLE_A; void CYCLE_B; void ValidClass; void InvalidMembers;",
      ].join("\n"),
      "utf8",
    );
    const externalFixtureFile = path.join(temporaryRoot, "external.d.ts");
    fs.writeFileSync(
      externalFixtureFile,
      "declare class ExternalBase { methodName(): void; BAD_OVERRIDE(): void; }\n",
      "utf8",
    );
    fs.writeFileSync(
      shadowFixtureFile,
      [
        "export {};",
        "const Date = { now: 1 };",
        "const SHADOWED_DATE = Date;",
        "const Object = { freeze<T>(value: T): T { return value; } };",
        "const SHADOWED_FREEZE = Object.freeze({ fixed: true });",
        "function createHash(): { update(): { digest(): string } } {",
        '  return { update: () => ({ digest: () => "fake" }) };',
        "}",
        "const SHADOWED_HASH = createHash().update().digest();",
        "void SHADOWED_DATE; void SHADOWED_FREEZE; void SHADOWED_HASH;",
      ].join("\n"),
      "utf8",
    );
    fs.writeFileSync(
      configFile,
      JSON.stringify({
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          target: "ESNext",
          typeRoots: [path.join(temporaryRoot, "node_modules", "@types")],
          types: ["node"],
        },
        files: [fixtureFile, shadowFixtureFile, externalFixtureFile],
      }),
      "utf8",
    );
    const api = new API({ cwd: temporaryRoot });
    try {
      const snapshot = api.updateSnapshot({ openProjects: [configFile] });
      try {
        const project = snapshot.getProjects()[0];
        assert.ok(project);
        const fixtureSource = project.program.getSourceFile(fixtureFile);
        const shadowSource = project.program.getSourceFile(shadowFixtureFile);
        assert.ok(fixtureSource);
        assert.ok(shadowSource);
        const violations = [
          ...inspectSourceFile(fixtureSource, project.checker),
          ...inspectSourceFile(shadowSource, project.checker),
        ];
        const keyForViolation = (violation: NamingViolation): string =>
          `${path.basename(violation.file)}:${violation.line}:${violation.column}|${violation.kind}|${violation.name}|${violation.rule}`;
        const expectedKey = (
          sourcePath: string,
          name: string,
          kind: string,
          rule: string,
        ): string => {
          const sourceLines = fs
            .readFileSync(sourcePath, "utf8")
            .split(/\r?\n/u);
          const identifierPattern = new RegExp(`\\b${name}\\b`, "u");
          const declarationPattern = new RegExp(
            `\\b(?:const|let|var)\\s+${name}\\b`,
            "u",
          );
          const lineIndex = sourceLines.findIndex((line) =>
            kind === "variable"
              ? declarationPattern.test(line)
              : identifierPattern.test(line),
          );
          assert.notEqual(lineIndex, -1, `fixture identifier missing: ${name}`);
          const column = sourceLines[lineIndex]?.indexOf(name) ?? -1;
          assert.notEqual(
            column,
            -1,
            `fixture identifier column missing: ${name}`,
          );
          return `${path.basename(sourcePath)}:${lineIndex + 1}:${column + 1}|${kind}|${name}|${rule}`;
        };
        const actualViolationKeys = violations.map(keyForViolation).sort();
        const expectedViolationKeys = [
          expectedKey(fixtureFile, "DATE_PARSE", "variable", "camel-case"),
          expectedKey(fixtureFile, "DATE_PROTOTYPE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "FROZEN_DATE_PARSE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "FROZEN_ALIAS_PROTOTYPE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "FROZEN_DATE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "FROZEN_DATE_ALIAS",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "FROZEN_PRIMITIVE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "FROZEN_OWNED", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "MUTATED_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_MUTATED_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "ALIASED_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "ESCAPED_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "CONSTRUCTOR_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "METHOD_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "OUT_OF_RANGE_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(fixtureFile, "DYNAMIC_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "NESTED_ESCAPE_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "WRITE_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "COMPOUND_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "LOGICAL_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "UPDATE_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "DELETE_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "WRITE_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "LENGTH_ITEMS",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "WRAPPED_WRITE_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "CALL_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "NEW_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "RETURN_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "ARROW_PROFILE", "variable", "camel-case"),
          expectedKey(fixtureFile, "EXPORT_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "NESTED_CALL_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_NEW_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_RETURN_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_ARROW_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "NESTED_EXPORT_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "SPECIFIER_EXPORT_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "TAGGED_TEMPLATE_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            fixtureFile,
            "CONDITIONAL_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "COMMA_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "DESTRUCTURE_PROFILE",
            "variable",
            "camel-case",
          ),
          expectedKey(fixtureFile, "YIELD_PROFILE", "variable", "camel-case"),
          expectedKey(
            fixtureFile,
            "invalidBoolean",
            "variable",
            "boolean-prefix",
          ),
          expectedKey(
            fixtureFile,
            "invalidArray",
            "variable",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "highCostSelection",
            "parameter",
            "boolean-prefix",
          ),
          expectedKey(fixtureFile, "internal", "parameter", "boolean-prefix"),
          expectedKey(fixtureFile, "sameHome", "parameter", "boolean-prefix"),
          expectedKey(
            fixtureFile,
            "actual",
            "parameter",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "before",
            "parameter",
            "array-plural-camel-case",
          ),
          expectedKey(fixtureFile, "_usedProvider", "parameter", "camel-case"),
          expectedKey(
            fixtureFile,
            "_localVariable",
            "variable",
            "true-constant-upper-snake-case",
          ),
          expectedKey(
            fixtureFile,
            "invalidConstant",
            "variable",
            "true-constant-upper-snake-case",
          ),
          expectedKey(fixtureFile, "condition", "parameter", "boolean-prefix"),
          expectedKey(
            fixtureFile,
            "nullableItem",
            "parameter",
            "array-plural-camel-case",
          ),
          expectedKey(
            fixtureFile,
            "genericItem",
            "parameter",
            "array-plural-camel-case",
          ),
          expectedKey(fixtureFile, "BadFunction", "function", "camel-case"),
          expectedKey(fixtureFile, "badClass", "type", "pascal-case"),
          expectedKey(fixtureFile, "BadMethod", "method", "camel-case"),
          expectedKey(fixtureFile, "BadGetter", "getter", "camel-case"),
          expectedKey(fixtureFile, "BadSetter", "setter", "camel-case"),
          expectedKey(fixtureFile, "RUNTIME_PATH", "variable", "camel-case"),
          expectedKey(fixtureFile, "RUNTIME_FREEZE", "variable", "camel-case"),
          expectedKey(fixtureFile, "FROZEN_RESOURCE", "variable", "camel-case"),
          expectedKey(fixtureFile, "RESOURCE_HANDLE", "variable", "camel-case"),
          expectedKey(fixtureFile, "WEAK_CACHE", "variable", "camel-case"),
          expectedKey(fixtureFile, "CYCLE_A", "variable", "camel-case"),
          expectedKey(fixtureFile, "CYCLE_B", "variable", "camel-case"),
          expectedKey(shadowFixtureFile, "Date", "variable", "camel-case"),
          expectedKey(
            shadowFixtureFile,
            "SHADOWED_DATE",
            "variable",
            "camel-case",
          ),
          expectedKey(shadowFixtureFile, "Object", "variable", "camel-case"),
          expectedKey(
            shadowFixtureFile,
            "SHADOWED_FREEZE",
            "variable",
            "camel-case",
          ),
          expectedKey(
            shadowFixtureFile,
            "SHADOWED_HASH",
            "variable",
            "camel-case",
          ),
        ].sort();
        assert.deepEqual(
          actualViolationKeys,
          expectedViolationKeys,
          formatViolations(violations),
        );
        const positiveNames = [
          "candidatePaths",
          "candidateNames",
          "candidateItems",
          "value",
          "tupleItem",
          "bytes",
          "valueSet",
          "valueMap",
          "generationReleased",
          "configurationMatches",
          "didOperationThrow",
          "argv",
          "acceptanceCriteria",
          "evidence",
          "currentInventory",
          "_unusedProvider",
          "enabled",
          "values",
          "FIXED_PATTERN",
          "FIXED_SET",
          "FIXED_TEMPLATE",
          "INTRINSIC_DATE",
          "INTRINSIC_DATE_NOW",
          "INTRINSIC_DATE_TO_ISO",
          "DIRECT_FIXED_ITEMS",
          "DIRECT_FIXED_PROFILE",
          "DIRECT_FIXED_LENGTH",
          "DIRECT_FIXED_FIRST",
          "DIRECT_FIXED_MODE",
          "HAS_DIRECT_FIXED_MODE",
          "DIRECT_FIXED_TEMPLATE",
          "NESTED_BINARY_PROFILE",
          "NESTED_BINARY_TOTAL",
          "TEMPLATE_BINARY_PROFILE",
          "TEMPLATE_BINARY_TEXT",
          "VOID_BINARY_PROFILE",
          "VOID_TEMPLATE_PROFILE",
          "DIRECT_NESTED_PROFILE",
          "DIRECT_NESTED_MODE",
          "FROZEN_PROFILE",
          "FROZEN_MODE",
          "TYPED_ARRAY_BYTE_LENGTH",
          "FIXED_DIGEST",
          "runtimePath",
          "runtimeSnapshot",
          "resourceHandle",
          "ownedFreezeSource",
          "weakCache",
          "constructorName",
          "methodLength",
          "outOfRangeItem",
          "DYNAMIC_KEY",
          "dynamicMode",
          "nestedProfile",
          "inspectFixture",
          "FixtureClass",
          "methodName",
          "statusValue",
          "BAD_OVERRIDE",
          "BAD_PROPERTY",
        ];
        for (const positiveName of positiveNames) {
          assert.equal(
            violations.some((violation) => violation.name === positiveName),
            false,
            `unexpected fixture violation: ${positiveName}\n${formatViolations(violations)}`,
          );
        }
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
      path.join(repositoryRoot, "40_Develop", "checker", RETIRED_CHECKER_TS),
    ),
    false,
  );
  assert.equal(
    fs.existsSync(
      path.join(repositoryRoot, "template", "tools", RETIRED_CHECKER_TS),
    ),
    false,
  );
});

test("廃止済みPathの参照は固定履歴と移行説明にだけ残る", () => {
  const actualReferenceCounts = [...collectRetiredReferenceCounts()];
  assert.equal(
    actualReferenceCounts.some(([key]) => key.startsWith(".crdd/")),
    false,
    "repository-local runtime state must not enter the canonical reference population",
  );
  assert.deepEqual(
    actualReferenceCounts.sort(([left], [right]) => left.localeCompare(right)),
    [...historicalReferenceCounts].sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
});

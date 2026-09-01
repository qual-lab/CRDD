import { createHash } from "node:crypto";
import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COORDINATOR_LAUNCH_ENTRIES } from "../core/coordinator-launch.ts";
import {
  isRuntimeProcessEffectBlocked,
  isRuntimeProcessPoisoned,
} from "../core/runtime-process-safety-state.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";
import { loadPlatformProvisionerManifestEnvelopeForVerification } from "./platform-provisioner-manifest-loader.ts";
import { getPlatformProvisionerPolicyIdentity } from "./platform-provisioner-policy-identity.ts";
import { inspectPlatformProvisionerReleaseIdentityCandidate } from "./platform-provisioner-release-identity.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "./platform-provisioner-release-trust.ts";
import {
  calculatePlatformProvisionerPackageContentRootCandidate,
  verifyPlatformProvisionerManifestCandidate,
} from "./platform-provisioner-trust-core.ts";
import {
  isCanonicalCrddGitObjectId,
  isCanonicalCrddVersion,
} from "./release-identity-grammar.ts";

const bundledPackageRoot = fileURLToPath(new URL("../../", import.meta.url));
const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const MAXIMUM_FILES = 2_048;
const MAXIMUM_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_PACKAGE_JSON_BYTES = 64 * 1024;
const RUNTIME_EXECUTION_DIRECTORIES = Object.freeze(
  new Set(["bin", "src", "runtime", "policies"]),
);
const RUNTIME_EXECUTION_ROOT_FILES = Object.freeze(new Set(["package.json"]));
const RUNTIME_EXECUTION_LAUNCHER_PATH = "bin/launch.ts";
const VERIFY_KEYS = new Set([
  "manifestEnvelope",
  "evaluationTime",
  "expectedCrddVersion",
  "expectedCrddCommit",
  "expectedCrddTree",
]);
const VERIFY_FIXED_MANIFEST_KEYS = new Set(["evaluationTime"]);
const VERIFY_INSTALLED_KEYS = new Set([
  "distributionRoot",
  "evaluationTime",
  "expectedRelease",
]);
const EXPECTED_RELEASE_KEYS = new Set([
  "manifestHash",
  "releaseSequence",
  "crddVersion",
  "crddCommit",
  "crddTree",
  "packageContentRootSha256",
  "runtimeExecutionIdentitySha256",
]);
const DEVELOPMENT_SOURCE_KEYS = new Set([
  "distributionRoot",
  "expectedCrddTree",
  "expectedPackageContentRootSha256",
]);
const DEVELOPMENT_ENTRYPOINTS = Object.freeze([
  "bin/coordinator.ts",
  "src/core/interactive-console-reader.ts",
  "src/security/candidate-store-lock-worker.ts",
  "src/security/host-operation-lock-supervisor.ts",
]);
const CANONICAL_TEXT_FILE_SUFFIXES = Object.freeze([
  ".Dockerfile",
  ".json",
  ".policy",
  ".py",
  ".ts",
  ".txt",
]);
const VERIFIED_PACKAGE_CAPABILITY_LIFETIME_MS = 5_000;
type VerifiedPackageIdentity = Readonly<{
  manifestHash: string;
  releaseSequence: number;
  runtimeExecutionIdentitySha256: string;
  interactiveConsoleReaderArtifactSha256: string;
}>;

function sameVerifiedPackageIdentity(
  left: VerifiedPackageIdentity,
  right: VerifiedPackageIdentity,
) {
  return (
    left.manifestHash === right.manifestHash &&
    left.releaseSequence === right.releaseSequence &&
    left.runtimeExecutionIdentitySha256 ===
      right.runtimeExecutionIdentitySha256 &&
    left.interactiveConsoleReaderArtifactSha256 ===
      right.interactiveConsoleReaderArtifactSha256
  );
}

function createVerifiedPackageCapabilityState() {
  const capabilities = new WeakMap<
    object,
    Readonly<{ issuedAtMs: number; identity: VerifiedPackageIdentity }>
  >();
  return Object.freeze({
    issue: (identity: VerifiedPackageIdentity, issuedAtMs: number) => {
      const capability = Object.freeze({});
      capabilities.set(capability, Object.freeze({ identity, issuedAtMs }));
      return capability;
    },
    consume: (
      capability: unknown,
      current: VerifiedPackageIdentity | null,
      currentMs: number,
    ) => {
      if (!capability || typeof capability !== "object") return false;
      const record = capabilities.get(capability);
      capabilities.delete(capability);
      return Boolean(
        record &&
          current &&
          Number.isFinite(currentMs) &&
          currentMs - record.issuedAtMs >= 0 &&
          currentMs - record.issuedAtMs <
            VERIFIED_PACKAGE_CAPABILITY_LIFETIME_MS &&
          sameVerifiedPackageIdentity(record.identity, current),
      );
    },
  });
}

const verifiedPackageCapabilityState = createVerifiedPackageCapabilityState();

export function createIsolatedVerifiedPackageCapabilityStateCandidate() {
  const state = createVerifiedPackageCapabilityState();
  return Object.freeze({
    issue: state.issue,
    consume: state.consume,
    runtimeAuthorityIssued: false,
    productionConsumerCompatible: false,
  });
}

type EntityIdentity = Readonly<{
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  size: bigint;
  mode: bigint;
  uid: bigint;
  gid: bigint;
  mtimeNs: bigint;
  ctimeNs: bigint;
}>;

type ObservedFile = Readonly<{
  path: string;
  byteLength: number;
  sha256: string;
}>;

type PackageObservation = Readonly<{
  packageName: string;
  packageVersion: string;
  files: readonly ObservedFile[];
}>;

function blocked(reason: string) {
  return Object.freeze({
    status: "blocked" as const,
    reason,
    packageContentRootSha256: null,
    packageFileCount: null,
    packageByteLength: null,
    releaseSequence: null,
    stableFilesystemIdentityObserved: false,
    runtimeOwnedPackageRoot: false,
    permissionPolicyConfirmed: false,
    windowsWritePolicyConfirmed: false,
    runtimeOwnedReleaseTrustConfirmed: false,
    releaseIdentityRuntimeOwned: false,
    runtimeExecutionIdentityRuntimeOwned: false,
    crddDistributionConfirmed: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

function identity(
  metadata: fs.BigIntStats,
  expectedType: "file" | "directory",
) {
  const isExpected =
    expectedType === "file" ? metadata.isFile() : metadata.isDirectory();
  if (
    !isExpected ||
    metadata.isSymbolicLink() ||
    metadata.dev <= 0n ||
    metadata.ino <= 0n ||
    metadata.birthtimeNs <= 0n
  ) {
    throw new Error("platform_provisioner_package_entity_invalid");
  }
  return Object.freeze({
    dev: metadata.dev,
    ino: metadata.ino,
    birthtimeNs: metadata.birthtimeNs,
    size: metadata.size,
    mode: metadata.mode,
    uid: metadata.uid,
    gid: metadata.gid,
    mtimeNs: metadata.mtimeNs,
    ctimeNs: metadata.ctimeNs,
  });
}

function sameIdentity(left: EntityIdentity, right: EntityIdentity) {
  return (
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.size === right.size &&
    left.mode === right.mode &&
    left.uid === right.uid &&
    left.gid === right.gid &&
    left.mtimeNs === right.mtimeNs &&
    left.ctimeNs === right.ctimeNs
  );
}

function directoryIdentity(target: string) {
  const resolved = path.resolve(target);
  const before = identity(
    fs.lstatSync(resolved, { bigint: true }),
    "directory",
  );
  const real = fs.realpathSync.native(resolved);
  const after = identity(fs.lstatSync(resolved, { bigint: true }), "directory");
  if (real !== resolved || !sameIdentity(before, after)) {
    throw new Error("platform_provisioner_package_root_invalid");
  }
  return Object.freeze({ realPath: real, identity: before });
}

function verifyDirectory(
  snapshot: Readonly<{ realPath: string; identity: EntityIdentity }>,
) {
  const current = identity(
    fs.lstatSync(snapshot.realPath, { bigint: true }),
    "directory",
  );
  if (
    !sameIdentity(snapshot.identity, current) ||
    fs.realpathSync.native(snapshot.realPath) !== snapshot.realPath
  ) {
    throw new Error("platform_provisioner_package_root_changed");
  }
}

type DirectoryEntrySnapshot = Readonly<{
  name: string;
  type: "directory" | "file";
}>;

function readDirectoryEntrySnapshot(target: string) {
  const dirents = fs
    .readdirSync(target, { withFileTypes: true })
    .sort((left, right) =>
      left.name < right.name ? -1 : left.name > right.name ? 1 : 0,
    );
  const entries = dirents.map((entry): DirectoryEntrySnapshot => {
    if (entry.isSymbolicLink()) {
      throw new Error("platform_provisioner_package_link_rejected");
    }
    if (entry.isDirectory()) {
      return Object.freeze({ name: entry.name, type: "directory" });
    }
    if (entry.isFile()) {
      return Object.freeze({ name: entry.name, type: "file" });
    }
    throw new Error("platform_provisioner_package_entity_invalid");
  });
  return Object.freeze({
    dirents: Object.freeze(dirents),
    entries: Object.freeze(entries),
  });
}

function sameDirectoryEntries(
  leftEntries: readonly DirectoryEntrySnapshot[],
  rightEntries: readonly DirectoryEntrySnapshot[],
) {
  return (
    leftEntries.length === rightEntries.length &&
    leftEntries.every(
      (entry, index) =>
        entry.name === rightEntries[index]?.name &&
        entry.type === rightEntries[index]?.type,
    )
  );
}

function readStableFile(target: string, maximumBytes: number) {
  const pathBefore = identity(fs.lstatSync(target, { bigint: true }), "file");
  if (pathBefore.size < 0n || pathBefore.size > BigInt(maximumBytes)) {
    throw new Error("platform_provisioner_package_file_budget_exceeded");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  let descriptor: number | null = null;
  try {
    descriptor = fs.openSync(target, fs.constants.O_RDONLY | noFollow);
    const opened = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    if (!sameIdentity(pathBefore, opened)) {
      throw new Error("platform_provisioner_package_file_changed");
    }
    const chunks: Buffer[] = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let byteLength = 0;
    while (true) {
      const count = fs.readSync(descriptor, buffer, 0, buffer.length, null);
      if (count === 0) break;
      byteLength += count;
      if (byteLength > maximumBytes || BigInt(byteLength) > opened.size) {
        throw new Error("platform_provisioner_package_file_changed");
      }
      const bytes = buffer.subarray(0, count);
      chunks.push(Buffer.from(bytes));
    }
    const after = identity(fs.fstatSync(descriptor, { bigint: true }), "file");
    const pathAfter = identity(fs.lstatSync(target, { bigint: true }), "file");
    if (
      BigInt(byteLength) !== opened.size ||
      !sameIdentity(opened, after) ||
      !sameIdentity(opened, pathAfter) ||
      fs.realpathSync.native(target) !== target
    ) {
      throw new Error("platform_provisioner_package_file_changed");
    }
    const rawBytes = Buffer.concat(chunks);
    return Object.freeze({
      byteLength,
      sha256: createHash("sha256").update(rawBytes).digest("hex"),
      identity: opened,
      bytes: rawBytes,
    });
  } finally {
    if (descriptor !== null) fs.closeSync(descriptor);
  }
}

function isCanonicalTextPackagePath(relativePath: string) {
  return CANONICAL_TEXT_FILE_SUFFIXES.some((suffix) =>
    relativePath.endsWith(suffix),
  );
}

function canonicalPackageFileContent(relativePath: string, bytes: Buffer) {
  if (!isCanonicalTextPackagePath(relativePath)) return bytes;
  let crlfCount = 0;
  for (let index = 0; index + 1 < bytes.length; index += 1) {
    if (bytes[index] === 0x0d && bytes[index + 1] === 0x0a) crlfCount += 1;
  }
  if (crlfCount === 0) return bytes;
  const canonical = Buffer.allocUnsafe(bytes.length - crlfCount);
  let output = 0;
  for (let index = 0; index < bytes.length; index += 1) {
    if (bytes[index] === 0x0d && bytes[index + 1] === 0x0a) continue;
    canonical[output] = bytes[index] as number;
    output += 1;
  }
  return canonical;
}

type SourceToken = Readonly<{
  kind: "identifier" | "string" | "punctuation" | "number";
  value: string;
  escaped: boolean;
}>;

const CANONICAL_NODE_MODULE_SPECIFIERS = Object.freeze(
  new Set(
    builtinModules.map((name) =>
      name.startsWith("node:") ? name : `node:${name}`,
    ),
  ),
);

function isIdentifierStart(character: string | undefined) {
  return character !== undefined && /[A-Za-z_$]/u.test(character);
}

function isIdentifierPart(character: string | undefined) {
  return character !== undefined && /[A-Za-z0-9_$]/u.test(character);
}

function canStartRegularExpression(previous: SourceToken | undefined) {
  if (!previous) return true;
  if (
    previous.kind === "identifier" ||
    previous.kind === "string" ||
    previous.kind === "number"
  ) {
    return [
      "await",
      "case",
      "delete",
      "do",
      "else",
      "in",
      "instanceof",
      "new",
      "of",
      "return",
      "throw",
      "typeof",
      "void",
      "yield",
    ].includes(previous.value);
  }
  return ![")", "]", "}", "++", "--"].includes(previous.value);
}

function tokenizeTypeScriptModuleSyntax(source: string) {
  const tokens: SourceToken[] = [];
  const push = (kind: SourceToken["kind"], value: string, escaped = false) =>
    tokens.push(Object.freeze({ kind, value, escaped }));

  const scan = (start: number, stopAtTemplateExpressionEnd: boolean) => {
    let index = start;
    let braceDepth = 0;
    while (index < source.length) {
      const character = source[index] as string;
      const next = source[index + 1];
      if (/\s/u.test(character)) {
        index += 1;
        continue;
      }
      if (index === 0 && character === "#" && next === "!") {
        const lineEnd = source.indexOf("\n", index + 2);
        index = lineEnd === -1 ? source.length : lineEnd + 1;
        continue;
      }
      if (character === "/" && next === "/") {
        const lineEnd = source.indexOf("\n", index + 2);
        index = lineEnd === -1 ? source.length : lineEnd + 1;
        continue;
      }
      if (character === "/" && next === "*") {
        const commentEnd = source.indexOf("*/", index + 2);
        if (commentEnd === -1)
          throw new Error(
            "platform_provisioner_runtime_dependency_parse_failed",
          );
        index = commentEnd + 2;
        continue;
      }
      if (character === '"' || character === "'") {
        const quote = character;
        let escaped = false;
        let value = "";
        index += 1;
        let terminated = false;
        while (index < source.length) {
          const current = source[index] as string;
          if (current === "\\") {
            escaped = true;
            if (index + 1 >= source.length)
              throw new Error(
                "platform_provisioner_runtime_dependency_parse_failed",
              );
            value += source.slice(index, index + 2);
            index += 2;
            continue;
          }
          if (current === quote) {
            index += 1;
            terminated = true;
            break;
          }
          if (current === "\n" || current === "\r")
            throw new Error(
              "platform_provisioner_runtime_dependency_parse_failed",
            );
          value += current;
          index += 1;
        }
        if (!terminated)
          throw new Error(
            "platform_provisioner_runtime_dependency_parse_failed",
          );
        push("string", value, escaped);
        continue;
      }
      if (character === "`") {
        index += 1;
        let terminated = false;
        while (index < source.length) {
          const current = source[index] as string;
          if (current === "\\") {
            index += 2;
            continue;
          }
          if (current === "`") {
            index += 1;
            terminated = true;
            break;
          }
          if (current === "$" && source[index + 1] === "{") {
            index = scan(index + 2, true);
            continue;
          }
          index += 1;
        }
        if (!terminated)
          throw new Error(
            "platform_provisioner_runtime_dependency_parse_failed",
          );
        continue;
      }
      if (
        character === "/" &&
        next !== "=" &&
        canStartRegularExpression(tokens.at(-1))
      ) {
        index += 1;
        let inCharacterClass = false;
        let terminated = false;
        while (index < source.length) {
          const current = source[index] as string;
          if (current === "\\") {
            index += 2;
            continue;
          }
          if (current === "[") inCharacterClass = true;
          else if (current === "]") inCharacterClass = false;
          else if (current === "/" && !inCharacterClass) {
            index += 1;
            while (/[A-Za-z]/u.test(source[index] ?? "")) index += 1;
            terminated = true;
            break;
          } else if (current === "\n" || current === "\r") break;
          index += 1;
        }
        if (!terminated)
          throw new Error(
            "platform_provisioner_runtime_dependency_parse_failed",
          );
        continue;
      }
      if (isIdentifierStart(character)) {
        const identifierStart = index;
        index += 1;
        while (isIdentifierPart(source[index])) index += 1;
        push("identifier", source.slice(identifierStart, index));
        continue;
      }
      if (/[0-9]/u.test(character)) {
        const numberStart = index;
        index += 1;
        while (/[A-Za-z0-9_.]/u.test(source[index] ?? "")) index += 1;
        push("number", source.slice(numberStart, index));
        continue;
      }
      if (character === "{" && stopAtTemplateExpressionEnd) {
        braceDepth += 1;
      } else if (character === "}" && stopAtTemplateExpressionEnd) {
        if (braceDepth === 0) return index + 1;
        braceDepth -= 1;
      }
      const twoCharacters = source.slice(index, index + 2);
      if (["=>", "++", "--", "?.", "??", "&&", "||"].includes(twoCharacters)) {
        push("punctuation", twoCharacters);
        index += 2;
      } else {
        push("punctuation", character);
        index += 1;
      }
    }
    if (stopAtTemplateExpressionEnd)
      throw new Error("platform_provisioner_runtime_dependency_parse_failed");
    return index;
  };

  scan(0, false);
  return Object.freeze(tokens);
}

function moduleSpecifiersFromTokens(tokens: readonly SourceToken[]) {
  const specifiers: SourceToken[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind !== "identifier") continue;
    if (token.value === "import") {
      const next = tokens[index + 1];
      if (next?.value === ".") continue;
      if (next?.value === "(") {
        const specifier = tokens[index + 2];
        if (specifier?.kind !== "string" || tokens[index + 3]?.value !== ")")
          throw new Error(
            "platform_provisioner_runtime_dependency_dynamic_unbound",
          );
        specifiers.push(specifier);
        index += 3;
        continue;
      }
      if (next?.kind === "string") {
        specifiers.push(next);
        index += 1;
        continue;
      }
      let found: SourceToken | null = null;
      for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
        const candidate = tokens[cursor];
        if (candidate?.value === ";") break;
        if (candidate?.value === "=")
          throw new Error(
            "platform_provisioner_runtime_dependency_noncanonical",
          );
        if (candidate?.value === "from") {
          const value = tokens[cursor + 1];
          if (value?.kind !== "string")
            throw new Error(
              "platform_provisioner_runtime_dependency_parse_failed",
            );
          found = value;
          break;
        }
      }
      if (!found)
        throw new Error("platform_provisioner_runtime_dependency_parse_failed");
      specifiers.push(found);
    } else if (token.value === "export") {
      const first = tokens[index + 1];
      const reexportStart = first?.value === "type" ? tokens[index + 2] : first;
      if (reexportStart?.value !== "*" && reexportStart?.value !== "{")
        continue;
      for (let cursor = index + 1; cursor < tokens.length; cursor += 1) {
        const candidate = tokens[cursor];
        if (candidate?.value === ";") break;
        if (candidate?.value === "from") {
          const value = tokens[cursor + 1];
          if (value?.kind !== "string")
            throw new Error(
              "platform_provisioner_runtime_dependency_parse_failed",
            );
          specifiers.push(value);
          break;
        }
      }
    }
  }
  return Object.freeze(specifiers);
}

function tokenSequenceMatches(
  tokens: readonly SourceToken[],
  start: number,
  values: readonly string[],
) {
  return values.every(
    (value, offset) => tokens[start + offset]?.value === value,
  );
}

function scriptChildTargetFromTokens(
  relativePath: string,
  tokens: readonly SourceToken[],
  start: number,
) {
  const token = tokens[start];
  if (token?.kind === "string") {
    if (token.escaped)
      throw new Error("platform_provisioner_runtime_dependency_noncanonical");
    return canonicalRelativeModuleTarget(relativePath, token.value);
  }
  if (
    tokenSequenceMatches(tokens, start, [
      "fileURLToPath",
      "(",
      "import",
      ".",
      "meta",
      ".",
      "url",
      ")",
    ])
  ) {
    return relativePath;
  }
  if (
    tokenSequenceMatches(tokens, start, ["new", "URL", "("]) &&
    tokens[start + 3]?.kind === "string" &&
    tokenSequenceMatches(tokens, start + 4, [
      ",",
      "import",
      ".",
      "meta",
      ".",
      "url",
      ")",
    ])
  ) {
    const specifier = tokens[start + 3];
    if (!specifier || specifier.escaped)
      throw new Error("platform_provisioner_runtime_dependency_noncanonical");
    return canonicalRelativeModuleTarget(relativePath, specifier.value);
  }
  throw new Error("platform_provisioner_runtime_dependency_child_unbound");
}

type SelectedScriptProcessBindings = Readonly<{
  bindings: ReadonlyMap<string, string>;
  declarationTokenIndices: ReadonlySet<number>;
}>;

function selectedScriptProcessBindings(
  tokens: readonly SourceToken[],
): SelectedScriptProcessBindings {
  const bindings = new Map<string, string>();
  const declarationTokenIndices = new Set<number>();
  const allowedImports = new Map<string, ReadonlySet<string>>([
    [
      "node:child_process",
      new Set(["spawn", "spawnSync", "execFile", "execFileSync", "fork"]),
    ],
    ["node:worker_threads", new Set(["Worker"])],
  ]);
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== "import") continue;
    const first = tokens[index + 1];
    if (first?.value === "(") {
      const dynamicSpecifier = tokens[index + 2];
      if (
        dynamicSpecifier?.kind === "string" &&
        allowedImports.has(dynamicSpecifier.value)
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_unbound",
        );
      continue;
    }
    let fromIndex = index + 1;
    while (
      fromIndex < tokens.length &&
      tokens[fromIndex]?.value !== "from" &&
      tokens[fromIndex]?.value !== ";"
    )
      fromIndex += 1;
    if (tokens[fromIndex]?.value !== "from") continue;
    const moduleToken = tokens[fromIndex + 1];
    if (moduleToken?.kind !== "string")
      throw new Error("platform_provisioner_runtime_dependency_parse_failed");
    const allowedNames = allowedImports.get(moduleToken.value);
    if (!allowedNames) continue;
    if (first?.value === "type") continue;
    if (first?.value !== "{")
      throw new Error("platform_provisioner_runtime_dependency_child_unbound");
    let cursor = index + 2;
    while (cursor < tokens.length && tokens[cursor]?.value !== "}") {
      if (tokens[cursor]?.value === ",") {
        cursor += 1;
        continue;
      }
      const typeOnly = tokens[cursor]?.value === "type";
      if (typeOnly) cursor += 1;
      const imported = tokens[cursor];
      if (imported?.kind !== "identifier")
        throw new Error("platform_provisioner_runtime_dependency_parse_failed");
      const importedIndex = cursor;
      cursor += 1;
      let local = imported.value;
      let localIndex = importedIndex;
      if (tokens[cursor]?.value === "as") {
        const alias = tokens[cursor + 1];
        if (alias?.kind !== "identifier")
          throw new Error(
            "platform_provisioner_runtime_dependency_parse_failed",
          );
        local = alias.value;
        localIndex = cursor + 1;
        cursor += 2;
      }
      if (!typeOnly) {
        if (!allowedNames.has(imported.value))
          throw new Error(
            "platform_provisioner_runtime_dependency_child_unbound",
          );
        bindings.set(local, imported.value);
        declarationTokenIndices.add(localIndex);
      }
      if (tokens[cursor]?.value === ",") cursor += 1;
    }
    if (
      tokens[cursor]?.value !== "}" ||
      cursor + 1 !== fromIndex ||
      tokens[fromIndex + 1]?.value !== moduleToken.value
    ) {
      throw new Error("platform_provisioner_runtime_dependency_parse_failed");
    }
  }
  return Object.freeze({ bindings, declarationTokenIndices });
}

function isFixedTaskkillInvocation(
  tokens: readonly SourceToken[],
  start: number,
) {
  if (
    !(
      tokenSequenceMatches(tokens, start, [
        "path",
        ".",
        "join",
        "(",
        "process",
        ".",
        "env",
        ".",
        "SystemRoot",
        "??",
      ]) &&
      tokens[start + 10]?.kind === "string" &&
      tokenSequenceMatches(tokens, start + 11, [","]) &&
      tokens[start + 12]?.kind === "string" &&
      tokens[start + 12]?.value === "System32" &&
      tokenSequenceMatches(tokens, start + 13, [","]) &&
      tokens[start + 14]?.kind === "string" &&
      tokens[start + 14]?.value === "taskkill.exe"
    )
  )
    return false;
  const closingParenthesis =
    tokens[start + 15]?.value === "," ? start + 16 : start + 15;
  return tokenSequenceMatches(tokens, closingParenthesis, [")", ","]);
}

function selectedScriptChildModuleTargets(
  relativePath: string,
  tokens: readonly SourceToken[],
) {
  if (!relativePath.startsWith("scripts/")) return Object.freeze([]);
  const targets: string[] = [];
  const processBindings = selectedScriptProcessBindings(tokens);
  const accountedUses = new Set<number>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind !== "identifier") continue;
    const imported = processBindings.bindings.get(token.value);
    if (!imported || processBindings.declarationTokenIndices.has(index))
      continue;
    if (
      (imported === "spawn" ||
        imported === "spawnSync" ||
        imported === "execFile" ||
        imported === "execFileSync") &&
      tokenSequenceMatches(tokens, index + 1, [
        "(",
        "process",
        ".",
        "execPath",
        ",",
        "[",
      ])
    ) {
      const target = scriptChildTargetFromTokens(
        relativePath,
        tokens,
        index + 7,
      );
      if (target) targets.push(target);
      accountedUses.add(index);
    } else if (
      imported === "spawnSync" &&
      tokens[index + 1]?.value === "(" &&
      isFixedTaskkillInvocation(tokens, index + 2)
    ) {
      accountedUses.add(index);
    } else if (imported === "fork" && tokens[index + 1]?.value === "(") {
      const target = scriptChildTargetFromTokens(
        relativePath,
        tokens,
        index + 2,
      );
      if (target) targets.push(target);
      accountedUses.add(index);
    } else if (
      imported === "Worker" &&
      tokens[index - 1]?.value === "new" &&
      tokens[index + 1]?.value === "("
    ) {
      const target = scriptChildTargetFromTokens(
        relativePath,
        tokens,
        index + 2,
      );
      if (target) targets.push(target);
      accountedUses.add(index);
    } else
      throw new Error("platform_provisioner_runtime_dependency_child_unbound");
  }
  if (
    [...processBindings.bindings.keys()].some((local) =>
      tokens.some(
        (token, index) =>
          token.value === local &&
          !processBindings.declarationTokenIndices.has(index) &&
          !accountedUses.has(index),
      ),
    )
  )
    throw new Error("platform_provisioner_runtime_dependency_child_unbound");
  return Object.freeze(targets);
}

function canonicalRelativeModuleTarget(
  relativePath: string,
  specifier: string,
) {
  if (CANONICAL_NODE_MODULE_SPECIFIERS.has(specifier)) return null;
  if (!specifier.startsWith("."))
    throw new Error("platform_provisioner_runtime_dependency_noncanonical");
  if (
    specifier.includes("\\") ||
    specifier.includes("%") ||
    specifier.includes("?") ||
    specifier.includes("#") ||
    specifier.includes("//")
  ) {
    throw new Error("platform_provisioner_runtime_dependency_noncanonical");
  }
  const segments = specifier.split("/");
  let firstTargetSegment = 0;
  if (segments[0] === ".") firstTargetSegment = 1;
  else while (segments[firstTargetSegment] === "..") firstTargetSegment += 1;
  if (
    firstTargetSegment === 0 ||
    firstTargetSegment >= segments.length ||
    segments
      .slice(firstTargetSegment)
      .some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error("platform_provisioner_runtime_dependency_noncanonical");
  }
  return path.posix.normalize(
    path.posix.join(path.posix.dirname(relativePath), specifier),
  );
}

function staticRelativeModuleTargets(relativePath: string, bytes: Buffer) {
  if (!relativePath.endsWith(".ts")) return Object.freeze([]);
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const targets: string[] = [];
  let tokens: readonly SourceToken[];
  try {
    tokens = tokenizeTypeScriptModuleSyntax(source);
  } catch (error) {
    throw new Error(`${relativePath}:tokenize:${String(error)}`);
  }
  try {
    for (const specifier of moduleSpecifiersFromTokens(tokens)) {
      if (specifier.escaped)
        throw new Error("platform_provisioner_runtime_dependency_noncanonical");
      const target = canonicalRelativeModuleTarget(
        relativePath,
        specifier.value,
      );
      if (target) targets.push(target);
    }
    targets.push(...selectedScriptChildModuleTargets(relativePath, tokens));
  } catch (error) {
    throw new Error(`${relativePath}:modules:${String(error)}`);
  }
  return Object.freeze(targets);
}

function verifyLauncherEntryBindings(packageRoot: string) {
  const observed = readStableFile(
    path.join(packageRoot, ...RUNTIME_EXECUTION_LAUNCHER_PATH.split("/")),
    MAXIMUM_PACKAGE_BYTES,
  );
  const actualDependencies = new Set(
    staticRelativeModuleTargets(
      RUNTIME_EXECUTION_LAUNCHER_PATH,
      observed.bytes,
    ),
  );
  const actualEntries = new Set(
    [...actualDependencies].filter(
      (target) =>
        target.startsWith("scripts/") || target === "bin/coordinator.ts",
    ),
  );
  const expected = new Set<string>();
  for (const entry of Object.values(COORDINATOR_LAUNCH_ENTRIES)) {
    const target = canonicalRelativeModuleTarget(
      RUNTIME_EXECUTION_LAUNCHER_PATH,
      entry,
    );
    if (!target || !actualEntries.has(target))
      throw new Error("platform_provisioner_launch_entry_invalid");
    expected.add(target);
  }
  if (
    actualEntries.size !== expected.size ||
    [...actualEntries].some((target) => !expected.has(target))
  )
    throw new Error("platform_provisioner_launch_entry_invalid");
}

function collectRuntimeExecutionScriptPaths(packageRoot: string) {
  if (!fs.existsSync(path.join(packageRoot, "bin", "launch.ts"))) {
    return Object.freeze(new Set<string>());
  }
  verifyLauncherEntryBindings(packageRoot);
  const scriptPaths = new Set<string>();
  const pending: string[] = [];
  for (const entry of Object.values(COORDINATOR_LAUNCH_ENTRIES)) {
    const target = canonicalRelativeModuleTarget(
      RUNTIME_EXECUTION_LAUNCHER_PATH,
      entry,
    );
    if (!target) {
      throw new Error("platform_provisioner_launch_entry_invalid");
    }
    const rootSegment = target.split("/")[0];
    if (rootSegment === "scripts") pending.push(target);
    else if (!rootSegment || !RUNTIME_EXECUTION_DIRECTORIES.has(rootSegment)) {
      throw new Error(
        "platform_provisioner_runtime_dependency_outside_execution_set",
      );
    }
  }
  while (pending.length > 0) {
    const relative = pending.shift();
    if (!relative || scriptPaths.has(relative)) continue;
    if (relative.split("/")[0] !== "scripts") {
      throw new Error(
        "platform_provisioner_runtime_dependency_outside_execution_set",
      );
    }
    const observed = readStableFile(
      path.join(packageRoot, ...relative.split("/")),
      MAXIMUM_PACKAGE_BYTES,
    );
    scriptPaths.add(relative);
    for (const target of staticRelativeModuleTargets(
      relative,
      observed.bytes,
    )) {
      const rootSegment = target.split("/")[0];
      if (rootSegment === "scripts") pending.push(target);
      else if (
        !rootSegment ||
        !RUNTIME_EXECUTION_DIRECTORIES.has(rootSegment)
      ) {
        throw new Error(
          "platform_provisioner_runtime_dependency_outside_execution_set",
        );
      }
    }
  }
  return Object.freeze(scriptPaths);
}

function verifyStaticRuntimeModuleBoundary(
  relativePath: string,
  bytes: Buffer,
  scriptPaths: ReadonlySet<string>,
) {
  for (const target of staticRelativeModuleTargets(relativePath, bytes)) {
    const rootSegment = target.split("/")[0];
    if (
      target === ".." ||
      target.startsWith("../") ||
      !rootSegment ||
      (!RUNTIME_EXECUTION_DIRECTORIES.has(rootSegment) &&
        !(rootSegment === "scripts" && scriptPaths.has(target)))
    ) {
      throw new Error(
        "platform_provisioner_runtime_dependency_outside_execution_set",
      );
    }
  }
}

function packageEntries(
  root: Readonly<{ realPath: string; identity: EntityIdentity }>,
) {
  const scriptPaths = collectRuntimeExecutionScriptPaths(root.realPath);
  const files: string[] = [];
  const directoryInventories: Array<
    Readonly<{
      directory: Readonly<{ realPath: string; identity: EntityIdentity }>;
      entries: readonly DirectoryEntrySnapshot[];
    }>
  > = [];
  const visit = (
    directory: Readonly<{ realPath: string; identity: EntityIdentity }>,
    relativeDirectory: string,
  ) => {
    const snapshot = readDirectoryEntrySnapshot(directory.realPath);
    directoryInventories.push(
      Object.freeze({ directory, entries: snapshot.entries }),
    );
    for (const entry of snapshot.dirents) {
      if (relativeDirectory === "") {
        const included = entry.isDirectory()
          ? RUNTIME_EXECUTION_DIRECTORIES.has(entry.name) ||
            (entry.name === "scripts" && scriptPaths.size > 0)
          : RUNTIME_EXECUTION_ROOT_FILES.has(entry.name);
        if (!included) continue;
      }
      const relative = relativeDirectory
        ? `${relativeDirectory}/${entry.name}`
        : entry.name;
      if (
        (relativeDirectory === "scripts" ||
          relativeDirectory.startsWith("scripts/")) &&
        (entry.isDirectory()
          ? ![...scriptPaths].some((selected) =>
              selected.startsWith(`${relative}/`),
            )
          : !scriptPaths.has(relative))
      ) {
        continue;
      }
      const target = path.join(directory.realPath, entry.name);
      if (entry.isDirectory()) {
        const child = directoryIdentity(target);
        visit(child, relative);
      } else if (entry.isFile()) files.push(relative);
      if (files.length > MAXIMUM_FILES) {
        throw new Error("platform_provisioner_package_file_count_exceeded");
      }
    }
    verifyDirectory(directory);
  };
  visit(root, "");
  return Object.freeze({
    files: Object.freeze(files),
    directories: Object.freeze(
      directoryInventories.map((inventory) => inventory.directory),
    ),
    directoryInventories: Object.freeze(directoryInventories),
    scriptPaths,
  });
}

function packageMetadata(bytes: Buffer | null) {
  if (!bytes) throw new Error("platform_provisioner_package_metadata_invalid");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) {
    throw new Error("platform_provisioner_package_metadata_invalid");
  }
  const parsed: unknown = JSON.parse(text);
  const baseKeys = [
    "name",
    "version",
    "private",
    "type",
    "scripts",
    "engines",
    "devDependencies",
  ];
  const metadata = snapshotPlainRecord(
    parsed,
    new Set([...baseKeys, "exports"]),
  );
  const exportsValue = snapshotPlainRecord(
    metadata?.exports,
    new Set(["./cli"]),
  );
  if (
    metadata?.name !== "@qual-lab/crdd-coordinator" ||
    typeof metadata.version !== "string" ||
    metadata.private !== true ||
    metadata.type !== "module" ||
    exportsValue?.["./cli"] !== "./bin/coordinator.ts"
  ) {
    throw new Error("platform_provisioner_package_metadata_invalid");
  }
  return Object.freeze({
    packageName: metadata.name,
    packageVersion: metadata.version,
  });
}

function observePackage(packageRoot: string) {
  const root = directoryIdentity(packageRoot);
  const inventory = packageEntries(root);
  const paths = inventory.files;
  if (!paths.includes("package.json")) {
    throw new Error("platform_provisioner_package_metadata_missing");
  }
  let packageJsonBytes: Buffer | null = null;
  let packageByteLength = 0;
  const files: ObservedFile[] = [];
  const fileIdentities: EntityIdentity[] = [];
  for (const relative of paths) {
    verifyDirectory(root);
    const maximum =
      relative === "package.json"
        ? MAXIMUM_PACKAGE_JSON_BYTES
        : MAXIMUM_PACKAGE_BYTES - packageByteLength;
    if (maximum < 0) {
      throw new Error("platform_provisioner_package_budget_exceeded");
    }
    const observed = readStableFile(
      path.join(root.realPath, ...relative.split("/")),
      maximum,
    );
    packageByteLength += observed.byteLength;
    fileIdentities.push(observed.identity);
    if (packageByteLength > MAXIMUM_PACKAGE_BYTES) {
      throw new Error("platform_provisioner_package_budget_exceeded");
    }
    const canonicalBytes = canonicalPackageFileContent(
      relative,
      observed.bytes,
    );
    verifyStaticRuntimeModuleBoundary(
      relative,
      canonicalBytes,
      inventory.scriptPaths,
    );
    if (relative === "package.json") packageJsonBytes = canonicalBytes;
    files.push(
      Object.freeze({
        path: relative,
        byteLength: canonicalBytes.byteLength,
        sha256: createHash("sha256").update(canonicalBytes).digest("hex"),
      }),
    );
  }
  for (const inventoryEntry of inventory.directoryInventories) {
    verifyDirectory(inventoryEntry.directory);
    const current = readDirectoryEntrySnapshot(
      inventoryEntry.directory.realPath,
    );
    if (!sameDirectoryEntries(inventoryEntry.entries, current.entries)) {
      throw new Error("platform_provisioner_package_root_changed");
    }
  }
  const metadata = packageMetadata(packageJsonBytes);
  const observation: PackageObservation = Object.freeze({
    ...metadata,
    files: Object.freeze(files),
  });
  const contentRoot =
    calculatePlatformProvisionerPackageContentRootCandidate(observation);
  if (contentRoot.status !== "candidate") {
    throw new Error("platform_provisioner_package_content_invalid");
  }
  const isPermissionPolicyConfirmed =
    process.platform !== "win32" &&
    inventory.directories.every(
      (directory) =>
        directory.identity.uid === 0n &&
        (directory.identity.mode & 0o7777n) === 0o755n,
    ) &&
    fileIdentities.every(
      (fileIdentity) =>
        fileIdentity.uid === 0n && (fileIdentity.mode & 0o7777n) === 0o644n,
    );
  return Object.freeze({
    observation,
    packageByteLength,
    contentRoot,
    permissionPolicyConfirmed: isPermissionPolicyConfirmed,
    windowsWritePolicyConfirmed: false,
  });
}

function publicObservation(
  observed: ReturnType<typeof observePackage>,
  isRuntimeOwnedPackageRoot: boolean,
) {
  return Object.freeze({
    status: "candidate" as const,
    reason: isRuntimeOwnedPackageRoot
      ? observed.permissionPolicyConfirmed
        ? "runtime_owned_package_filesystem_observed_release_trust_and_effect_required"
        : "runtime_owned_package_filesystem_observed_release_trust_permission_and_effect_required"
      : "caller_selected_package_filesystem_observed_non_authoritative",
    packageName: observed.observation.packageName,
    packageVersion: observed.observation.packageVersion,
    packageContentRootSha256: observed.contentRoot.packageContentRootSha256,
    packageFileCount: observed.observation.files.length,
    packageByteLength: observed.packageByteLength,
    stableFilesystemIdentityObserved: true,
    runtimeOwnedPackageRoot: isRuntimeOwnedPackageRoot,
    permissionPolicyConfirmed: observed.permissionPolicyConfirmed,
    windowsWritePolicyConfirmed: observed.windowsWritePolicyConfirmed,
    runtimeOwnedReleaseTrustConfirmed: false,
    crddDistributionConfirmed: false,
    effectAuthorizationIssued: false,
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
    networkEffectIssued: false,
  });
}

export function inspectPlatformProvisionerPackageFilesystemCandidate(
  packageRoot: unknown,
) {
  try {
    if (typeof packageRoot !== "string" || packageRoot.length === 0) {
      return blocked("platform_provisioner_package_root_invalid");
    }
    return publicObservation(observePackage(packageRoot), false);
  } catch {
    return blocked("platform_provisioner_package_filesystem_invalid");
  }
}

export function inspectBundledCoordinatorPackageFilesystemCandidate() {
  try {
    return publicObservation(observePackage(bundledPackageRoot), true);
  } catch {
    return blocked("platform_provisioner_bundled_package_filesystem_invalid");
  }
}

/** Read-only identity evidence; caller-supplied expectations are not authority. */
export function inspectFixedDevelopmentCoordinatorPackageCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, DEVELOPMENT_SOURCE_KEYS);
    if (
      !input ||
      typeof input.distributionRoot !== "string" ||
      !path.isAbsolute(input.distributionRoot) ||
      path.normalize(input.distributionRoot) !== input.distributionRoot ||
      typeof input.expectedCrddTree !== "string" ||
      !isCanonicalCrddGitObjectId(input.expectedCrddTree) ||
      typeof input.expectedPackageContentRootSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(input.expectedPackageContentRootSha256)
    )
      return blocked("development_package_input_invalid");

    const root = directoryIdentity(input.distributionRoot);
    const packageRoot = path.join(root.realPath, "40_Develop", "coordinator");
    const observed = observePackage(packageRoot);
    const distribution = inspectPlatformProvisionerReleaseIdentityCandidate(
      root.realPath,
      input.expectedCrddTree,
    );
    if (
      distribution.status !== "candidate" ||
      observed.contentRoot.packageContentRootSha256 !==
        input.expectedPackageContentRootSha256
    )
      return blocked("development_package_identity_mismatch");
    // A signed manifest changes a repository-contained runtime from a
    // development source into a release distribution. Native artifacts are
    // ordinary signed-tree entries and may be present in either source kind.
    if (distribution.manifestExcludedFromSignedGitTree)
      return blocked("development_package_release_artifact_present");

    const entrypoints = DEVELOPMENT_ENTRYPOINTS.map((entrypoint) =>
      observed.observation.files.find((file) => file.path === entrypoint),
    );
    if (entrypoints.some((entrypoint) => !entrypoint))
      return blocked("development_package_entrypoint_missing");
    const reobserved = observePackage(packageRoot);
    if (
      reobserved.contentRoot.packageContentRootSha256 !==
      observed.contentRoot.packageContentRootSha256
    )
      return blocked("development_package_changed_during_observation");
    verifyDirectory(root);
    const sourceIdentitySha256 = createHash("sha256")
      .update(
        JSON.stringify([
          "crdd-development-source-identity/v1",
          root.realPath,
          root.identity.dev.toString(),
          root.identity.ino.toString(),
          root.identity.birthtimeNs.toString(),
          distribution.crddTree,
          observed.contentRoot.packageContentRootSha256,
        ]),
        "utf8",
      )
      .digest("hex");
    return Object.freeze({
      ...publicObservation(observed, false),
      reason: "fixed_development_package_observed_authorization_required",
      executionSourceKind: "fixed_development_candidate" as const,
      crddTree: distribution.crddTree,
      sourceIdentitySha256,
      entrypoints: Object.freeze(
        entrypoints.map((entrypoint) => {
          if (!entrypoint)
            throw new Error("development_package_entrypoint_missing");
          return Object.freeze({
            relativePath: entrypoint.path,
            sha256: entrypoint.sha256,
          });
        }),
      ),
      releaseIdentityRuntimeOwned: false,
      pathReported: false,
    });
  } catch {
    return blocked("development_package_observation_failed");
  }
}

export function verifyBundledCoordinatorPackageCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_KEYS);
    if (
      !input ||
      typeof input.expectedCrddVersion !== "string" ||
      !isCanonicalCrddVersion(input.expectedCrddVersion) ||
      typeof input.expectedCrddCommit !== "string" ||
      !isCanonicalCrddGitObjectId(input.expectedCrddCommit) ||
      typeof input.expectedCrddTree !== "string" ||
      !isCanonicalCrddGitObjectId(input.expectedCrddTree)
    ) {
      return blocked("platform_provisioner_bundled_package_input_invalid");
    }
    const { observed, verification } = verifyOwnedBundledManifest(
      input.manifestEnvelope,
      input.evaluationTime,
    );
    if (
      verification.status !== "candidate" ||
      verification.crddVersion !== input.expectedCrddVersion ||
      verification.crddCommit !== input.expectedCrddCommit ||
      verification.crddTree !== input.expectedCrddTree
    ) {
      return blocked(
        "platform_provisioner_bundled_package_verification_failed",
      );
    }
    return Object.freeze({
      ...publicObservation(observed, true),
      reason:
        "runtime_owned_package_filesystem_and_manifest_match_release_identity_permission_and_effect_required",
      manifestHash: verification.manifestHash,
      crddVersion: verification.crddVersion,
      releaseSequence: verification.releaseSequence,
      crddCommit: verification.crddCommit,
      crddTree: verification.crddTree,
      qualLabManifestCryptographicMatch: true,
      runtimeOwnedReleaseTrustConfirmed: true,
      platformAccessArtifact: verification.platformAccessArtifact,
    });
  } catch {
    return blocked("platform_provisioner_bundled_package_input_invalid");
  }
}

function verifyOwnedBundledManifest(
  manifestEnvelope: unknown,
  evaluationTime: unknown,
) {
  const observed = observePackage(bundledPackageRoot);
  const policyIdentity = getPlatformProvisionerPolicyIdentity();
  const verification = verifyPlatformProvisionerManifestCandidate({
    manifestEnvelope,
    releaseSignerSpkiDer: getPinnedPlatformProvisionerReleaseSignerSpkiDer(),
    observedPackageContent: observed.observation,
    evaluationTime,
  });
  if (
    verification.status !== "candidate" ||
    verification.rootProtectionPolicySha256 !==
      policyIdentity.rootProtectionPolicySha256 ||
    verification.keyStoragePolicySha256 !==
      policyIdentity.keyStoragePolicySha256
  ) {
    throw new Error("platform_provisioner_owned_manifest_verification_failed");
  }
  return Object.freeze({ observed, verification });
}

export function verifyBundledCoordinatorPackageFromFixedManifestCandidate(
  rawInput: unknown,
) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_FIXED_MANIFEST_KEYS);
    if (!input) {
      return blocked("platform_provisioner_bundled_package_input_invalid");
    }
    const loaded = loadPlatformProvisionerManifestEnvelopeForVerification(
      bundledDistributionRoot,
    );
    const { observed, verification } = verifyOwnedBundledManifest(
      loaded.envelope,
      input.evaluationTime,
    );
    const reloaded = loadPlatformProvisionerManifestEnvelopeForVerification(
      bundledDistributionRoot,
    );
    if (reloaded.manifestFileSha256 !== loaded.manifestFileSha256) {
      return blocked(
        "platform_provisioner_manifest_changed_during_verification",
      );
    }
    const interactiveConsoleReaderArtifact = observed.observation.files.find(
      (file) => file.path === "src/core/interactive-console-reader.ts",
    );
    if (!interactiveConsoleReaderArtifact) {
      return blocked("platform_provisioner_interactive_console_reader_missing");
    }
    return Object.freeze({
      ...publicObservation(observed, true),
      reason: observed.permissionPolicyConfirmed
        ? "verified_crdd_distribution_and_package_permission_effect_controller_required"
        : "verified_crdd_distribution_and_package_permission_and_effect_controller_required",
      manifestHash: verification.manifestHash,
      crddVersion: verification.crddVersion,
      releaseSequence: verification.releaseSequence,
      crddCommit: verification.crddCommit,
      crddTree: verification.crddTree,
      runtimeExecutionIdentitySha256:
        verification.runtimeExecutionIdentitySha256,
      qualLabManifestCryptographicMatch: true,
      runtimeOwnedReleaseTrustConfirmed: true,
      releaseIdentityRuntimeOwned: false,
      runtimeExecutionIdentityRuntimeOwned: true,
      crddDistributionConfirmed: true,
      interactiveConsoleReaderArtifactSha256:
        interactiveConsoleReaderArtifact.sha256,
      platformAccessArtifact: verification.platformAccessArtifact,
    });
  } catch {
    return blocked("platform_provisioner_fixed_manifest_verification_failed");
  }
}

function verifiedFixedPackageRecord(
  result: ReturnType<
    typeof verifyBundledCoordinatorPackageFromFixedManifestCandidate
  >,
) {
  if (
    result.status !== "candidate" ||
    typeof result.manifestHash !== "string" ||
    !Number.isSafeInteger(result.releaseSequence) ||
    typeof result.runtimeExecutionIdentitySha256 !== "string" ||
    typeof result.interactiveConsoleReaderArtifactSha256 !== "string" ||
    result.crddDistributionConfirmed !== true ||
    result.runtimeExecutionIdentityRuntimeOwned !== true ||
    result.runtimeOwnedReleaseTrustConfirmed !== true
  ) {
    return null;
  }
  return Object.freeze({
    manifestHash: result.manifestHash,
    releaseSequence: result.releaseSequence as number,
    runtimeExecutionIdentitySha256: result.runtimeExecutionIdentitySha256,
    interactiveConsoleReaderArtifactSha256:
      result.interactiveConsoleReaderArtifactSha256,
  });
}

export function issueRuntimeOwnedVerifiedCoordinatorPackageCapability(
  rawInput: unknown,
) {
  if (isRuntimeProcessEffectBlocked()) {
    return Object.freeze({
      verification: blocked(
        isRuntimeProcessPoisoned()
          ? "platform_provisioner_process_restart_required"
          : "platform_provisioner_runtime_cleanup_in_progress",
      ),
      capability: null,
    });
  }
  const input = snapshotPlainRecord(rawInput, VERIFY_FIXED_MANIFEST_KEYS);
  if (!input) {
    return Object.freeze({
      verification: blocked(
        "platform_provisioner_bundled_package_input_invalid",
      ),
      capability: null,
    });
  }
  const verification =
    verifyBundledCoordinatorPackageFromFixedManifestCandidate(input);
  const record = verifiedFixedPackageRecord(verification);
  if (!record) return Object.freeze({ verification, capability: null });
  const capability = verifiedPackageCapabilityState.issue(
    record,
    performance.now(),
  );
  return Object.freeze({ verification, capability });
}

export function consumeRuntimeOwnedVerifiedCoordinatorPackageCapability(
  capability: unknown,
) {
  const current = verifiedFixedPackageRecord(
    verifyBundledCoordinatorPackageFromFixedManifestCandidate({
      evaluationTime: new Date().toISOString(),
    }),
  );
  return verifiedPackageCapabilityState.consume(
    capability,
    current,
    performance.now(),
  );
}

export function verifyInstalledCoordinatorPackageCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_INSTALLED_KEYS);
    const expected =
      input &&
      snapshotPlainRecord(input.expectedRelease, EXPECTED_RELEASE_KEYS);
    if (
      !input ||
      !expected ||
      typeof input.distributionRoot !== "string" ||
      typeof expected.manifestHash !== "string" ||
      !/^[0-9a-f]{64}$/u.test(expected.manifestHash) ||
      typeof expected.releaseSequence !== "number" ||
      !Number.isSafeInteger(expected.releaseSequence) ||
      expected.releaseSequence < 1 ||
      typeof expected.crddVersion !== "string" ||
      !isCanonicalCrddVersion(expected.crddVersion) ||
      typeof expected.crddCommit !== "string" ||
      !isCanonicalCrddGitObjectId(expected.crddCommit) ||
      typeof expected.crddTree !== "string" ||
      !isCanonicalCrddGitObjectId(expected.crddTree) ||
      typeof expected.packageContentRootSha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(expected.packageContentRootSha256) ||
      typeof expected.runtimeExecutionIdentitySha256 !== "string" ||
      !/^[0-9a-f]{64}$/u.test(expected.runtimeExecutionIdentitySha256)
    ) {
      return blocked("platform_provisioner_installed_package_input_invalid");
    }
    const distributionRoot = directoryIdentity(input.distributionRoot);
    const packageRoot = path.join(
      distributionRoot.realPath,
      "40_Develop",
      "coordinator",
    );
    const observed = observePackage(packageRoot);
    const loaded = loadPlatformProvisionerManifestEnvelopeForVerification(
      distributionRoot.realPath,
    );
    const policyIdentity = getPlatformProvisionerPolicyIdentity();
    const verification = verifyPlatformProvisionerManifestCandidate({
      manifestEnvelope: loaded.envelope,
      releaseSignerSpkiDer: getPinnedPlatformProvisionerReleaseSignerSpkiDer(),
      observedPackageContent: observed.observation,
      evaluationTime: input.evaluationTime,
    });
    verifyDirectory(distributionRoot);
    if (
      verification.status !== "candidate" ||
      verification.rootProtectionPolicySha256 !==
        policyIdentity.rootProtectionPolicySha256 ||
      verification.keyStoragePolicySha256 !==
        policyIdentity.keyStoragePolicySha256 ||
      verification.manifestHash !== expected.manifestHash ||
      verification.releaseSequence !== expected.releaseSequence ||
      verification.crddVersion !== expected.crddVersion ||
      verification.crddCommit !== expected.crddCommit ||
      verification.crddTree !== expected.crddTree ||
      verification.packageContentRootSha256 !==
        expected.packageContentRootSha256 ||
      verification.runtimeExecutionIdentitySha256 !==
        expected.runtimeExecutionIdentitySha256
    ) {
      return blocked(
        "platform_provisioner_installed_package_verification_failed",
      );
    }
    return Object.freeze({
      ...publicObservation(observed, false),
      reason:
        "installed_package_matches_verified_crdd_release_effect_controller_required",
      manifestHash: verification.manifestHash,
      crddVersion: verification.crddVersion,
      releaseSequence: verification.releaseSequence,
      crddCommit: verification.crddCommit,
      crddTree: verification.crddTree,
      runtimeExecutionIdentitySha256:
        verification.runtimeExecutionIdentitySha256,
      qualLabManifestCryptographicMatch: true,
      runtimeOwnedReleaseTrustConfirmed: true,
      releaseIdentityRuntimeOwned: false,
      runtimeExecutionIdentityRuntimeOwned: true,
      crddDistributionConfirmed: true,
      platformAccessArtifact: verification.platformAccessArtifact,
    });
  } catch {
    return blocked(
      "platform_provisioner_installed_package_verification_failed",
    );
  }
}

function sameNativeArtifact(
  expected: unknown,
  observed: unknown,
  revisionKey: "protocolRevision" | "entrypointContractRevision",
) {
  const keys = new Set([
    "relativePath",
    "target",
    "rustToolchain",
    "byteLength",
    "sha256",
    revisionKey,
  ]);
  const expectedRecord = snapshotPlainRecord(expected, keys);
  const observedRecord = snapshotPlainRecord(observed, keys);
  return Boolean(
    expectedRecord &&
      observedRecord &&
      [...keys].every((key) => expectedRecord[key] === observedRecord[key]),
  );
}

/** Verifies a separate signed native distribution without executing it. */
export function inspectVerifiedNativeDistributionCandidate(rawInput: unknown) {
  try {
    const input = snapshotPlainRecord(rawInput, VERIFY_INSTALLED_KEYS);
    const expected =
      input &&
      snapshotPlainRecord(input.expectedRelease, EXPECTED_RELEASE_KEYS);
    if (
      !input ||
      !expected ||
      typeof input.distributionRoot !== "string" ||
      !path.isAbsolute(input.distributionRoot) ||
      path.normalize(input.distributionRoot) !== input.distributionRoot
    )
      return blocked("native_distribution_input_invalid");
    const root = directoryIdentity(input.distributionRoot);
    const request = { ...input, expectedRelease: expected };
    const release = verifyInstalledCoordinatorPackageCandidate(request);
    if (release.status !== "candidate")
      return blocked("native_distribution_release_not_verified");
    const worker = beginPlatformAccessArtifactSigningObservation(root.realPath);
    if (
      !worker ||
      !sameNativeArtifact(
        release.platformAccessArtifact,
        worker.artifact,
        "protocolRevision",
      ) ||
      !verifyPlatformAccessArtifactSigningObservation(worker.token)
    )
      return blocked("native_distribution_artifact_not_verified");
    const reverified = verifyInstalledCoordinatorPackageCandidate(request);
    if (reverified.status !== "candidate")
      return blocked("native_distribution_changed_during_observation");
    verifyDirectory(root);
    const nativeIdentitySha256 = createHash("sha256")
      .update(
        JSON.stringify([
          "crdd-native-distribution-identity/v1",
          root.realPath,
          root.identity.dev.toString(),
          root.identity.ino.toString(),
          root.identity.birthtimeNs.toString(),
          release.manifestHash,
          release.runtimeExecutionIdentitySha256,
          worker.artifact.sha256,
        ]),
        "utf8",
      )
      .digest("hex");
    return Object.freeze({
      status: "candidate" as const,
      reason:
        "signed_native_distribution_observed_execution_authorization_required",
      nativeIdentitySha256,
      manifestHash: release.manifestHash,
      crddTree: release.crddTree,
      runtimeExecutionIdentitySha256: release.runtimeExecutionIdentitySha256,
      nativeReleaseSignatureVerified: true,
      platformAccessArtifact: worker.artifact,
      runtimeAuthorityConferred: false,
      runtimeCapabilityIssued: false,
      filesystemEffectIssued: false,
      networkEffectIssued: false,
      processEffectIssued: false,
      pathReported: false,
    });
  } catch {
    return blocked("native_distribution_observation_failed");
  }
}

export function describePlatformProvisionerPackageFilesystemContract() {
  return Object.freeze({
    contract: "crdd-coordinator/platform-provisioner-package-filesystem",
    contractRevision: 6,
    packageRootSelection: "implemented_fixed_module_relative_candidate",
    recursiveFileInventory: "implemented_candidate",
    runtimeExecutionSet:
      "closed_bin_src_runtime_policies_and_package_json_namespace",
    stableSameHandleFileIdentityAndHash: "implemented_candidate",
    packageContentRootCalculation:
      "implemented_canonical_lf_for_declared_repository_text_and_raw_bytes_for_other_files",
    nodeModulesIncluded: false,
    developmentGitIgnoreIncluded: false,
    maximumFiles: MAXIMUM_FILES,
    maximumPackageBytes: MAXIMUM_PACKAGE_BYTES,
    runtimeOwnedPackageFilesystemRead:
      "implemented_candidate_without_permission_authority",
    runtimeOwnedCrddReleaseIdentitySelection:
      "implemented_fixed_manifest_signature_and_runtime_execution_identity_candidate",
    runtimeOwnedReleaseTrustSelection:
      "implemented_single_ed25519_anchor_pinned",
    ownerAndPermissionPolicyVerification:
      "posix_implemented_candidate_windows_effective_access_not_implemented",
    posixRootOwnedDirectory0755AndFile0644Verification: "implemented_candidate",
    windowsSystemAndAdministratorsWriteRuntimeReadAclVerification:
      "not_implemented_effective_access_required",
    unsignedOrModifiedCheckoutCanAuthorizeProvisioningEffect: false,
    repositoryContainedOfficialReleaseCanAuthorizeProvisioningEffect: true,
    releaseTrustModel:
      "qual_lab_ed25519_single_active_key_pinned_in_verified_crdd_release",
    releaseIdentityBinding:
      "runtime_execution_dependency_set_policy_and_native_artifact",
    taskRuntimeCapability:
      "single_use_process_private_exact_release_package_and_reader_identity",
    taskGateAuthority:
      "held_alone_grants_no_operation_console_filesystem_provider_or_network_authority",
    processPoisonGate: "before_manifest_package_filesystem_observation",
    policyIdentityBinding:
      "owned_root_protection_and_key_storage_policy_hashes_required",
    signedManifestPath:
      "template/tools/coordinator/coordinator-package-manifest.json",
    releaseTrustAnchorConfiguration: "configured_immutable_source_literal",
    signedManifestDistribution:
      "implemented_fixed_path_canonical_file_loader_candidate",
    signedManifestPlacement:
      "release_commit_adds_only_manifest_to_signed_parent_git_tree",
    nativeArtifactsInSignedGitTree: true,
    exactRootGitMetadataExcludedFromSignedGitTree: true,
    releaseIdentityRollbackFloorPersistence: "implemented_candidate",
    releaseIdentityRollbackFloorTransition: "implemented_candidate",
    effectController: "not_implemented_effective_access_required",
    installedReleaseReverification: "not_implemented_effective_access_required",
    runtimeAuthorityConferred: false,
    runtimeCapabilityIssued: false,
    filesystemEffectIssued: false,
  });
}

import { createHash } from "node:crypto";
import fs from "node:fs";
import { builtinModules } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { COORDINATOR_LAUNCH_ENTRIES } from "../core/coordinator-launch.ts";
import { runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver } from "../core/runtime-local-typescript-child-entrypoints.ts";
import {
  isRuntimeProcessEffectBlocked,
  isRuntimeProcessPoisoned,
} from "../core/runtime-process-safety-state.ts";
import { snapshotPlainRecord } from "./plain-data-snapshot.ts";
import {
  beginPlatformAccessArtifactSigningObservation,
  verifyPlatformAccessArtifactSigningObservation,
} from "./platform-access-release.ts";
import {
  loadPlatformProvisionerManifestEnvelopeForVerification,
  PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH,
} from "./platform-provisioner-manifest-loader.ts";
import { getPlatformProvisionerPolicyIdentity } from "./platform-provisioner-policy-identity.ts";
import { getPinnedPlatformProvisionerReleaseSignerSpkiDer } from "./platform-provisioner-release-trust.ts";
import {
  calculatePlatformProvisionerPackageContentRootCandidate,
  verifyPlatformProvisionerManifestCandidate,
} from "./platform-provisioner-trust-core.ts";
import {
  isCanonicalCrddGitObjectId,
  isCanonicalCrddVersion,
} from "./release-identity-grammar.ts";

const bundledDistributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);
const MAXIMUM_FILES = 2_048;
const MAXIMUM_PACKAGE_BYTES = 64 * 1024 * 1024;
const MAXIMUM_PACKAGE_JSON_BYTES = 64 * 1024;
const runtimeExecutionDirectories = Object.freeze(
  new Set(["bin", "src", "runtime", "policies"]),
);
const runtimeExecutionRootFiles = Object.freeze(new Set(["package.json"]));
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
  "expectedPackageContentRootSha256",
]);
const COORDINATOR_DISTRIBUTION_PREFIX = "40_Develop/coordinator/";
const runtimeLocalTypescriptChildEntrypoints =
  runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver();
const runtimeDistributionRequiredEntrypoints = Object.freeze([
  Object.freeze({
    role: "public_cli",
    distributionRelativePath: `${COORDINATOR_DISTRIBUTION_PREFIX}bin/coordinator.ts`,
  }),
  ...runtimeLocalTypescriptChildEntrypoints.map((entrypoint) =>
    Object.freeze({
      role: entrypoint.role,
      distributionRelativePath: entrypoint.distributionRelativePath,
    }),
  ),
]);
const runtimeDistributionLocalNodeChildRoles = Object.freeze(
  new Set<string>(
    runtimeLocalTypescriptChildEntrypoints.map((entrypoint) => entrypoint.role),
  ),
);
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
    revoke: (capability: unknown) => {
      if (!capability || typeof capability !== "object") return false;
      const isExisted = capabilities.has(capability);
      capabilities.delete(capability);
      return isExisted;
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
  lineBreakBefore: boolean;
}>;

const nodeChildProcessSpecifier = ["node:", "child_", "process"].join("");
const bareChildProcessSpecifier = ["child_", "process"].join("");
const nodeWorkerThreadsSpecifier = ["node:", "worker_", "threads"].join("");
const bareWorkerThreadsSpecifier = ["worker_", "threads"].join("");

const canonicalNodeModuleSpecifiers = Object.freeze(
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

function decodeStaticStringLiteral(raw: string) {
  return raw
    .replace(
      /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([0btnvfr\\'"`]))/gu,
      (_match, codePoint, unicode, hex, simple: string | undefined) => {
        if (codePoint)
          return String.fromCodePoint(Number.parseInt(codePoint, 16));
        if (unicode) return String.fromCharCode(Number.parseInt(unicode, 16));
        if (hex) return String.fromCharCode(Number.parseInt(hex, 16));
        return (
          (
            {
              "0": "\0",
              b: "\b",
              t: "\t",
              n: "\n",
              v: "\v",
              f: "\f",
              r: "\r",
              "\\": "\\",
              "'": "'",
              '"': '"',
              "`": "`",
            } as Readonly<Record<string, string>>
          )[simple ?? ""] ?? ""
        );
      },
    )
    .replace(/\\(?:\r\n|\r|\n)/gu, "")
    .replace(/\\([^0-9xu])/gu, "$1");
}

function tokenizeTypeScriptModuleSyntax(source: string) {
  const tokens: SourceToken[] = [];
  let hasLineBreakBeforeNextToken = false;
  const push = (
    kind: SourceToken["kind"],
    value: string,
    isEscaped = false,
  ) => {
    tokens.push(
      Object.freeze({
        kind,
        value,
        escaped: isEscaped,
        lineBreakBefore: hasLineBreakBeforeNextToken,
      }),
    );
    hasLineBreakBeforeNextToken = false;
  };

  const scan = (start: number, shouldStopAtTemplateExpressionEnd: boolean) => {
    let index = start;
    let braceDepth = 0;
    while (index < source.length) {
      const character = source[index] as string;
      const next = source[index + 1];
      if (/\s/u.test(character)) {
        if (character === "\n" || character === "\r")
          hasLineBreakBeforeNextToken = true;
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
        if (lineEnd !== -1) hasLineBreakBeforeNextToken = true;
        index = lineEnd === -1 ? source.length : lineEnd + 1;
        continue;
      }
      if (character === "/" && next === "*") {
        const commentEnd = source.indexOf("*/", index + 2);
        if (commentEnd === -1)
          throw new Error(
            "platform_provisioner_runtime_dependency_parse_failed",
          );
        if (/[\r\n]/u.test(source.slice(index, commentEnd + 2)))
          hasLineBreakBeforeNextToken = true;
        index = commentEnd + 2;
        continue;
      }
      if (character === '"' || character === "'") {
        const quote = character;
        let isEscaped = false;
        let value = "";
        index += 1;
        let terminated = false;
        while (index < source.length) {
          const current = source[index] as string;
          if (current === "\\") {
            isEscaped = true;
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
        push(
          "string",
          isEscaped ? decodeStaticStringLiteral(value) : value,
          isEscaped,
        );
        continue;
      }
      if (character === "`") {
        let value = "";
        let isEscaped = false;
        let hasExpression = false;
        index += 1;
        let terminated = false;
        while (index < source.length) {
          const current = source[index] as string;
          if (current === "\\") {
            isEscaped = true;
            value += source.slice(index, index + 2);
            index += 2;
            continue;
          }
          if (current === "`") {
            index += 1;
            terminated = true;
            break;
          }
          if (current === "$" && source[index + 1] === "{") {
            hasExpression = true;
            index = scan(index + 2, true);
            continue;
          }
          value += current;
          index += 1;
        }
        if (!terminated)
          throw new Error(
            "platform_provisioner_runtime_dependency_parse_failed",
          );
        if (!hasExpression)
          push(
            "string",
            isEscaped ? decodeStaticStringLiteral(value) : value,
            true,
          );
        continue;
      }
      if (
        character === "/" &&
        next !== "=" &&
        canStartRegularExpression(tokens.at(-1))
      ) {
        index += 1;
        let isInCharacterClass = false;
        let terminated = false;
        while (index < source.length) {
          const current = source[index] as string;
          if (current === "\\") {
            index += 2;
            continue;
          }
          if (current === "[") isInCharacterClass = true;
          else if (current === "]") isInCharacterClass = false;
          else if (current === "/" && !isInCharacterClass) {
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
      if (character === "{" && shouldStopAtTemplateExpressionEnd) {
        braceDepth += 1;
      } else if (character === "}" && shouldStopAtTemplateExpressionEnd) {
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
    if (shouldStopAtTemplateExpressionEnd)
      throw new Error("platform_provisioner_runtime_dependency_parse_failed");
    return index;
  };

  scan(0, false);
  return Object.freeze(tokens);
}

type ModuleDeclarationBinding = Readonly<{
  imported: string;
  local: string;
  typeOnly: boolean;
  localTokenIndex: number;
}>;

type ModuleDeclaration = Readonly<{
  kind:
    | "static_import"
    | "dynamic_import"
    | "reexport"
    | "local_export"
    | "import_meta";
  start: number;
  end: number;
  specifierIndex: number | null;
  wholeTypeOnly: boolean;
  bindings: readonly ModuleDeclarationBinding[];
}>;

function matchingTokenIndex(
  tokens: readonly SourceToken[],
  openingIndex: number,
  opening: string,
  closing: string,
) {
  if (tokens[openingIndex]?.value !== opening)
    throw new Error("platform_provisioner_runtime_dependency_parse_failed");
  let depth = 0;
  for (let index = openingIndex; index < tokens.length; index += 1) {
    if (tokens[index]?.value === opening) depth += 1;
    else if (tokens[index]?.value === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error("platform_provisioner_runtime_dependency_parse_failed");
}

function namedModuleBindings(
  tokens: readonly SourceToken[],
  openingBrace: number,
  closingBrace: number,
  isWholeTypeOnly: boolean,
) {
  const bindings: ModuleDeclarationBinding[] = [];
  let cursor = openingBrace + 1;
  while (cursor < closingBrace) {
    if (tokens[cursor]?.value === ",") {
      cursor += 1;
      continue;
    }
    const isInlineTypeOnly = tokens[cursor]?.value === "type";
    if (isInlineTypeOnly) cursor += 1;
    const imported = tokens[cursor];
    if (imported?.kind !== "identifier")
      throw new Error("platform_provisioner_runtime_dependency_parse_failed");
    cursor += 1;
    let local = imported;
    if (tokens[cursor]?.value === "as") {
      cursor += 1;
      local = tokens[cursor] as SourceToken;
      if (local?.kind !== "identifier")
        throw new Error("platform_provisioner_runtime_dependency_parse_failed");
      cursor += 1;
    }
    bindings.push(
      Object.freeze({
        imported: imported.value,
        local: local.value,
        typeOnly: isWholeTypeOnly || isInlineTypeOnly,
        localTokenIndex: tokens.indexOf(local),
      }),
    );
  }
  return Object.freeze(bindings);
}

function moduleDeclarationsFromTokens(tokens: readonly SourceToken[]) {
  const declarations: ModuleDeclaration[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind !== "identifier" || tokens[index - 1]?.value === ".")
      continue;
    if (token.value === "import") {
      const next = tokens[index + 1];
      if (next?.value === ".") {
        declarations.push(
          Object.freeze({
            kind: "import_meta",
            start: index,
            end: index + 2,
            specifierIndex: null,
            wholeTypeOnly: false,
            bindings: Object.freeze([]),
          }),
        );
        continue;
      }
      if (next?.value === "(") {
        const closing = matchingTokenIndex(tokens, index + 1, "(", ")");
        const specifierIndex =
          closing === index + 3 && tokens[index + 2]?.kind === "string"
            ? index + 2
            : null;
        declarations.push(
          Object.freeze({
            kind: "dynamic_import",
            start: index,
            end: closing,
            specifierIndex,
            wholeTypeOnly: false,
            bindings: Object.freeze([]),
          }),
        );
        index = closing;
        continue;
      }
      if (next?.kind === "string") {
        declarations.push(
          Object.freeze({
            kind: "static_import",
            start: index,
            end: index + 1,
            specifierIndex: index + 1,
            wholeTypeOnly: false,
            bindings: Object.freeze([]),
          }),
        );
        index += 1;
        continue;
      }
      let cursor = index + 1;
      const isWholeTypeOnly = tokens[cursor]?.value === "type";
      if (isWholeTypeOnly) cursor += 1;
      const bindings: ModuleDeclarationBinding[] = [];
      if (tokens[cursor]?.kind === "identifier") {
        if (tokens[cursor + 1]?.value === "=")
          throw new Error(
            "platform_provisioner_runtime_dependency_noncanonical",
          );
        bindings.push(
          Object.freeze({
            imported: "default",
            local: tokens[cursor]?.value ?? "",
            typeOnly: isWholeTypeOnly,
            localTokenIndex: cursor,
          }),
        );
        cursor += 1;
        if (tokens[cursor]?.value === ",") cursor += 1;
      }
      if (tokens[cursor]?.value === "*") {
        if (
          tokens[cursor + 1]?.value !== "as" ||
          tokens[cursor + 2]?.kind !== "identifier"
        )
          throw new Error(
            "platform_provisioner_runtime_dependency_parse_failed",
          );
        bindings.push(
          Object.freeze({
            imported: "*",
            local: tokens[cursor + 2]?.value ?? "",
            typeOnly: isWholeTypeOnly,
            localTokenIndex: cursor + 2,
          }),
        );
        cursor += 3;
      } else if (tokens[cursor]?.value === "{") {
        const closing = matchingTokenIndex(tokens, cursor, "{", "}");
        bindings.push(
          ...namedModuleBindings(tokens, cursor, closing, isWholeTypeOnly),
        );
        cursor = closing + 1;
      }
      if (
        tokens[cursor]?.value !== "from" ||
        tokens[cursor + 1]?.kind !== "string"
      )
        throw new Error("platform_provisioner_runtime_dependency_parse_failed");
      declarations.push(
        Object.freeze({
          kind: "static_import",
          start: index,
          end: cursor + 1,
          specifierIndex: cursor + 1,
          wholeTypeOnly: isWholeTypeOnly,
          bindings: Object.freeze(bindings),
        }),
      );
      index = cursor + 1;
    } else if (token.value === "export") {
      let cursor = index + 1;
      const isWholeTypeOnly = tokens[cursor]?.value === "type";
      if (isWholeTypeOnly) cursor += 1;
      if (tokens[cursor]?.value !== "*" && tokens[cursor]?.value !== "{")
        continue;
      let bindings: readonly ModuleDeclarationBinding[] = Object.freeze([]);
      if (tokens[cursor]?.value === "{") {
        const closing = matchingTokenIndex(tokens, cursor, "{", "}");
        bindings = namedModuleBindings(
          tokens,
          cursor,
          closing,
          isWholeTypeOnly,
        );
        cursor = closing + 1;
      } else {
        cursor += 1;
        if (tokens[cursor]?.value === "as") cursor += 2;
      }
      const isReexport = tokens[cursor]?.value === "from";
      if (isReexport && tokens[cursor + 1]?.kind !== "string")
        throw new Error("platform_provisioner_runtime_dependency_parse_failed");
      declarations.push(
        Object.freeze({
          kind: isReexport ? "reexport" : "local_export",
          start: index,
          end: isReexport ? cursor + 1 : cursor - 1,
          specifierIndex: isReexport ? cursor + 1 : null,
          wholeTypeOnly: isWholeTypeOnly,
          bindings,
        }),
      );
      if (isReexport) index = cursor + 1;
    }
  }
  return Object.freeze(declarations);
}

function isExactRealProviderVerificationDynamicImport(
  relativePath: string,
  tokens: readonly SourceToken[],
  declaration: ModuleDeclaration,
) {
  return (
    coordinatorRelativeSourcePath(relativePath) ===
      "scripts/verify-project-runtime-real-providers.ts" &&
    declaration.kind === "dynamic_import" &&
    tokenSequenceMatches(tokens, declaration.start, [
      "import",
      "(",
      "pathToFileURL",
      "(",
      "path",
      ".",
      "join",
      "(",
      "distributionRoot",
      ",",
      "40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts",
      ",",
      ")",
      ",",
      ")",
      ".",
      "href",
      ")",
    ]) &&
    declaration.end === declaration.start + 17
  );
}

function assertLoaderCapabilityBoundary(
  relativePath: string,
  tokens: readonly SourceToken[],
  declarations: readonly ModuleDeclaration[],
) {
  const loaderReason = (index: number) =>
    tokens
      .slice(index, index + 24)
      .some((token) => token.value === nodeWorkerThreadsSpecifier)
      ? "platform_provisioner_runtime_dependency_child_worker_unbound"
      : "platform_provisioner_runtime_dependency_child_process_unbound";
  const allowedDynamicImports = declarations.filter((declaration) =>
    isExactRealProviderVerificationDynamicImport(
      relativePath,
      tokens,
      declaration,
    ),
  );
  const isRealProviderVerification =
    coordinatorRelativeSourcePath(relativePath) ===
    "scripts/verify-project-runtime-real-providers.ts";
  if (
    allowedDynamicImports.length > 1 ||
    (isRealProviderVerification && allowedDynamicImports.length !== 1)
  )
    throw new Error("platform_provisioner_runtime_dependency_loader_unbound");
  if (isRealProviderVerification) {
    const hasCanonicalBinding = (
      specifier: string,
      imported: string,
      local: string,
    ) =>
      declarations.some(
        (declaration) =>
          declaration.kind === "static_import" &&
          declaration.specifierIndex !== null &&
          tokens[declaration.specifierIndex]?.value === specifier &&
          declaration.bindings.length === 1 &&
          declaration.bindings[0]?.imported === imported &&
          declaration.bindings[0]?.local === local &&
          !declaration.bindings[0]?.typeOnly,
      );
    const dynamic = allowedDynamicImports[0];
    const nativeModuleUses = tokens
      .map((token, index) => (token.value === "nativeModule" ? index : -1))
      .filter((index) => index >= 0);
    if (
      !dynamic ||
      !hasCanonicalBinding("node:path", "default", "path") ||
      !hasCanonicalBinding("node:url", "pathToFileURL", "pathToFileURL") ||
      !tokenSequenceMatches(tokens, dynamic.start - 5, [
        "const",
        "nativeModule",
        "=",
        "(",
        "await",
      ]) ||
      nativeModuleUses.length !== 2 ||
      !tokenSequenceMatches(tokens, nativeModuleUses[1] ?? -1, [
        "nativeModule",
        ".",
        "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
        "(",
      ]) ||
      !tokenSequenceExistsBetween(tokens, 0, dynamic.start, [
        "const",
        "distributionRoot",
        "=",
        "path",
        ".",
        "resolve",
        "(",
        "process",
        ".",
        "argv",
        "[",
        "2",
        "]",
        "??",
        "",
        ")",
      ]) ||
      !tokenSequenceExistsBetween(tokens, 0, dynamic.start, [
        "stableDirectory",
        "(",
        "distributionRoot",
        ")",
      ])
    )
      throw new Error("platform_provisioner_runtime_dependency_loader_unbound");
  }
  for (const declaration of declarations) {
    if (
      declaration.kind === "dynamic_import" &&
      declaration.specifierIndex === null &&
      !allowedDynamicImports.includes(declaration)
    )
      throw new Error(loaderReason(declaration.start));
    const specifier =
      declaration.specifierIndex === null
        ? null
        : tokens[declaration.specifierIndex]?.value;
    const isDeclarationTypeOnly =
      declaration.wholeTypeOnly ||
      (declaration.bindings.length > 0 &&
        declaration.bindings.every((binding) => binding.typeOnly));
    if (
      specifier === "node:module" &&
      !isDeclarationTypeOnly &&
      !(
        coordinatorRelativeSourcePath(relativePath) ===
          "src/security/platform-provisioner-package-filesystem.ts" &&
        declaration.kind === "static_import" &&
        declaration.bindings.length === 1 &&
        declaration.bindings[0]?.imported === "builtinModules" &&
        declaration.bindings[0]?.local === "builtinModules"
      )
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_child_process_unbound",
      );
    if (declaration.kind !== "static_import") continue;
    for (const binding of declaration.bindings) {
      if (!binding.typeOnly && binding.imported === "createRequire")
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_unbound",
        );
    }
  }
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (
      token?.kind === "identifier" &&
      (token.value === "require" ||
        token.value === "getBuiltinModule" ||
        token.value === "createRequire")
    )
      throw new Error(loaderReason(index));
    if (
      token?.kind === "string" &&
      token.value === "getBuiltinModule" &&
      tokens[index - 1]?.value === "[" &&
      tokens[index + 1]?.value === "]" &&
      (tokens[index - 2]?.value === "process" ||
        (tokens[index - 2]?.value === "?." &&
          tokens[index - 3]?.value === "process"))
    )
      throw new Error(loaderReason(index));
  }
}

function moduleSpecifiersFromTokens(
  relativePath: string,
  tokens: readonly SourceToken[],
) {
  const declarations = moduleDeclarationsFromTokens(tokens);
  assertLoaderCapabilityBoundary(relativePath, tokens, declarations);
  return Object.freeze(
    declarations.flatMap((declaration) => {
      if (
        declaration.kind === "dynamic_import" &&
        declaration.specifierIndex === null
      ) {
        if (
          isExactRealProviderVerificationDynamicImport(
            relativePath,
            tokens,
            declaration,
          )
        )
          return [];
        throw new Error(
          "platform_provisioner_runtime_dependency_dynamic_unbound",
        );
      }
      const specifier =
        declaration.specifierIndex === null
          ? null
          : tokens[declaration.specifierIndex];
      return specifier ? [specifier] : [];
    }),
  );
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
  shouldIncludeWorkerThreads = true,
): SelectedScriptProcessBindings {
  const bindings = new Map<string, string>();
  const declarationTokenIndices = new Set<number>();
  const allowedImports = new Map<string, ReadonlySet<string>>([
    [
      nodeChildProcessSpecifier,
      new Set(["spawn", "spawnSync", "execFile", "execFileSync", "fork"]),
    ],
    ...(shouldIncludeWorkerThreads
      ? ([[nodeWorkerThreadsSpecifier, new Set(["Worker"])]] as const)
      : []),
  ]);
  for (const declaration of moduleDeclarationsFromTokens(tokens)) {
    if (declaration.specifierIndex === null) continue;
    const moduleToken = tokens[declaration.specifierIndex];
    const allowedNames = allowedImports.get(moduleToken?.value ?? "");
    if (!allowedNames) continue;
    if (
      declaration.kind === "reexport" &&
      (declaration.wholeTypeOnly ||
        (declaration.bindings.length > 0 &&
          declaration.bindings.every((binding) => binding.typeOnly)))
    )
      continue;
    if (declaration.kind !== "static_import")
      throw new Error("platform_provisioner_runtime_dependency_child_unbound");
    for (const binding of declaration.bindings) {
      if (binding.typeOnly) continue;
      if (
        binding.imported === "default" ||
        binding.imported === "*" ||
        binding.local !== binding.imported ||
        !allowedNames.has(binding.imported)
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_unbound",
        );
      bindings.set(binding.local, binding.imported);
      declarationTokenIndices.add(binding.localTokenIndex);
    }
  }
  return Object.freeze({ bindings, declarationTokenIndices });
}

function assertProtectedModuleSpecifierPositions(
  tokens: readonly SourceToken[],
  protectedSpecifiers: ReadonlySet<string>,
  canonicalSpecifier: string,
  reason: string,
) {
  const allowedSpecifierIndices = new Set(
    moduleDeclarationsFromTokens(tokens).flatMap((declaration) => {
      if (
        declaration.specifierIndex === null ||
        (declaration.kind !== "static_import" &&
          !(
            declaration.kind === "reexport" &&
            (declaration.wholeTypeOnly ||
              (declaration.bindings.length > 0 &&
                declaration.bindings.every((binding) => binding.typeOnly)))
          ))
      )
        return [];
      return [declaration.specifierIndex];
    }),
  );
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind !== "string" || !protectedSpecifiers.has(token.value))
      continue;
    if (
      token.value === canonicalSpecifier &&
      !token.escaped &&
      allowedSpecifierIndices.has(index)
    )
      continue;
    throw new Error(reason);
  }
}

function assertChildProcessModuleBoundary(tokens: readonly SourceToken[]) {
  assertProtectedModuleSpecifierPositions(
    tokens,
    new Set([nodeChildProcessSpecifier, bareChildProcessSpecifier]),
    nodeChildProcessSpecifier,
    "platform_provisioner_runtime_dependency_child_process_unbound",
  );
}

type RuntimeExternalProcessCallsite = Readonly<{
  source: string;
  containingFunction: string;
  primitive: string;
  executablePrefix: readonly string[];
  argvPrefix: readonly string[];
  argumentCount: number;
  authorityProof?: readonly string[];
}>;

const runtimeExternalProcessCallsites = Object.freeze(
  [
    [
      "src/security/windows-directory-bootstrap.ts",
      "observeSystemWindowsDirectory",
      "spawnSync",
      [
        "path",
        ".",
        "join",
        "(",
        "distributionRoot",
        ",",
        ".",
        ".",
        ".",
        "PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH",
        ".",
        "split",
        "(",
        "/",
        ")",
        ",",
        ")",
      ],
      ["[", "--system-windows-directory", "]"],
      ["const", "snapshot", "="],
    ],
    [
      "src/security/docker-restart-machine.ts",
      "queryWsl",
      "spawnSync",
      ["executable"],
      [
        "kind",
        "=",
        "=",
        "=",
        "registered",
        "?",
        "[",
        "--list",
        ",",
        "--quiet",
        "]",
        ":",
        "[",
        "--list",
        ",",
        "--running",
        ",",
        "--quiet",
        "]",
      ],
      ["const", "executable", "="],
    ],
    [
      "src/security/docker-restart-machine.ts",
      "queryDockerEngine",
      "spawnSync",
      ["cli", ".", "executablePath"],
      [
        "[",
        "--host",
        ",",
        "npipe:////./pipe/dockerDesktopLinuxEngine",
        ",",
        "version",
        ",",
        "--format",
        ",",
        "{{json .Server}}",
        ",",
        "]",
      ],
      ["const", "cli", "="],
    ],
    [
      "src/security/docker-restart-machine.ts",
      "queryContainersAbsent",
      "spawnSync",
      ["cli", ".", "executablePath"],
      [
        "[",
        "--host",
        ",",
        "npipe:////./pipe/dockerDesktopLinuxEngine",
        ",",
        "container",
        ",",
        "ls",
        ",",
        "--quiet",
        ",",
        "--no-trunc",
        ",",
        "]",
      ],
      ["const", "cli", "="],
    ],
    [
      "src/core/runtime-local-typescript-child-entrypoints.ts",
      "spawnRuntimeLocalTypeScriptChild",
      "spawn",
      ["process", ".", "execPath"],
      ["[", "entrypoint", ".", "filePath"],
    ],
    [
      "src/security/candidate-store-windows-adapter.ts",
      "inspectRuntimeOwnedWindowsProtectedRoot",
      "spawnSync",
      ["selectedExecutable"],
      ["[", "]"],
      ["const", "selectedExecutable", "="],
    ],
    [
      "src/security/provider-home-windows-adapter.ts",
      "inspectRuntimeOwnedWindowsProviderHomeCandidate",
      "spawnSync",
      ["selectedExecutable"],
      ["[", "]"],
      ["const", "selectedExecutable", "="],
    ],
    [
      "src/security/docker-cli-trust.ts",
      "inspectDockerAuthenticode",
      "spawnSync",
      ["powershell"],
      ["[", "-NoLogo"],
    ],
    [
      "src/security/docker-desktop-repair-native-helper.ts",
      "acquireRuntimeOwnedDockerDesktopNativeHelper",
      "spawn",
      ["executablePath"],
      ["[", "helperMode", "]"],
      ["const", "helperMode", "="],
    ],
    [
      "src/security/docker-desktop-runtime-repair.ts",
      "observeEngine",
      "spawnSync",
      ["cli", ".", "executablePath"],
      ["[", "--host"],
      ["const", "cli", "=", "observeCurrentTrustedDockerCli", "("],
    ],
    [
      "src/security/docker-desktop-runtime-repair.ts",
      "terminateDockerWsl",
      "spawnSync",
      ["executable"],
      ["[", "--terminate"],
      ["const", "executable", "="],
    ],
    [
      "src/security/docker-owned-process.ts",
      "startOwnedProcess",
      "spawn",
      ["executable"],
      ["[", ".", ".", ".", "argv"],
    ],
    [
      "src/security/docker-owned-process.ts",
      "terminateAndWait",
      "spawn",
      ["TASKKILL_EXECUTABLE"],
      ["[", "/PID"],
    ],
    [
      "src/security/docker-isolation.ts",
      "executeDocker",
      "spawnSync",
      ["executable"],
      ["args"],
      ["const", "executable", "=", "verifyTrustedDockerCliCapability"],
    ],
    [
      "src/security/docker-isolation.ts",
      "startOwnedAttachedProcess",
      "spawn",
      ["executable"],
      ["args"],
    ],
    [
      "src/security/docker-recovery-runtime-internal.ts",
      "runRecoveryDocker",
      "spawnSync",
      ["DOCKER_CLI_EXECUTABLE"],
      ["[", "--host"],
      ["verifyRecoveryDockerCli", "(", ")"],
    ],
    [
      "scripts/check-dynamic-fake-provider-coverage.ts",
      "inspectOnce",
      "spawnSync",
      ["process", ".", "execPath"],
      ["["],
    ],
    [
      "scripts/check-platform-access-coverage.ts",
      "executeCommand",
      "spawnSync",
      ["command"],
      ["[", ".", ".", ".", "commandArguments"],
    ],
    [
      "scripts/check-platform-access-ts-coverage.ts",
      "inspectPlatformAccessTsCoverage",
      "spawnSync",
      ["process", ".", "execPath"],
      ["["],
    ],
    [
      "scripts/check-provider-authority-coverage.ts",
      "inspectOnce",
      "spawnSync",
      ["process", ".", "execPath"],
      ["["],
    ],
    [
      "scripts/check-provider-home-coverage.ts",
      "inspectOnce",
      "spawnSync",
      ["process", ".", "execPath"],
      ["["],
    ],
    [
      "scripts/verify-project-runtime-real-providers.ts",
      "startPublicMcpProcess",
      "spawn",
      ["process", ".", "execPath"],
      ["["],
    ],
    [
      "scripts/verify-signed-recovery-matrix.ts",
      "verifyParentLossThenRecover",
      "spawnSync",
      [
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
        "C:Windows",
        ",",
        "System32",
        ",",
        "taskkill.exe",
        ",",
        ")",
      ],
      ["["],
    ],
    [
      "40_Develop/execution-intelligence/src/store/verified-repository-root.ts",
      "observeExactRepositoryRoot",
      "execFileSync",
      ["git"],
      ["[", "-C"],
    ],
  ].map(
    ([
      source,
      containingFunction,
      primitive,
      executablePrefix,
      argvPrefix,
      authorityProof,
    ]) =>
      Object.freeze({
        source,
        containingFunction,
        primitive,
        executablePrefix: Object.freeze(executablePrefix),
        argvPrefix: Object.freeze(argvPrefix),
        argumentCount: 3,
        ...(authorityProof
          ? { authorityProof: Object.freeze(authorityProof) }
          : {}),
      }) as RuntimeExternalProcessCallsite,
  ),
);

type RuntimeCapabilityGraphKind = "runtime" | "verification_tool";
type ExactExternalProcessCallGraph = Readonly<{
  graph: RuntimeCapabilityGraphKind;
  source: string;
  containingFunction: string;
  primitive: string;
  occurrence: number;
  argumentShapeSha256: string;
  functionBodySha256: string;
  resultBinding: string | null;
}>;

const exactExternalProcessCalls = Object.freeze(
  [
    [
      "runtime",
      "src/security/windows-directory-bootstrap.ts",
      "observeSystemWindowsDirectory",
      "spawnSync",
      1,
      "d0718dc4405efae990f6fb8ad6b0bc39fdba7b0b524dc5fea37ae95de2887275",
      "604b0b444fdef6d7591514d60af6097c68080a2170ceae0d48ce4e8cf5bcc451",
      "result",
    ],
    [
      "runtime",
      "src/security/docker-restart-machine.ts",
      "queryWsl",
      "spawnSync",
      1,
      "2895dc58b2ac8984f4f7caa7491fcd43d8c111747ceef5e1c985e2366a1652c9",
      "d73a0d7358558169a4cfcd0b5e9d5e2a0c120e904a650cfdc5ab6a82a2f8a532",
      null,
    ],
    [
      "runtime",
      "src/security/docker-restart-machine.ts",
      "queryDockerEngine",
      "spawnSync",
      1,
      "bda32a5b8d50f7ee690c40295feb53149d77412ab3432238140247e9a7cfc993",
      "ceca34343116bad8cef083394eee464dc319efd6c01174d49b8504384f3a6e32",
      "result",
    ],
    [
      "runtime",
      "src/security/docker-restart-machine.ts",
      "queryContainersAbsent",
      "spawnSync",
      1,
      "8fd4a361488670b0d0a0235e494eaa2ee17b45f1d975dfb63214746fbefceb61",
      "ccf17e27db593206dfdef29cdaf962949c035e6ecac0a27be77388121f0bf076",
      "result",
    ],
    [
      "verification_tool",
      "scripts/check-dynamic-fake-provider-coverage.ts",
      "inspectOnce",
      "spawnSync",
      1,
      "fa326a2530eecbd1064de35a92411873f029e08266979b5f6ca4cc60c6148903",
      "3cda1dcdfd715312c9e182f7db9b5928e69bba969d8c33409b929b12639ba4af",
      "result",
    ],
    [
      "verification_tool",
      "scripts/check-platform-access-coverage.ts",
      "executeCommand",
      "spawnSync",
      1,
      "b6a5108c3c476218317e007a515489698f55b97312aea21bfa5d409df2da8759",
      "30d235c4c85913095597d7190ef2a0d47137089cd8d67326f1735ad1d93373f4",
      "result",
    ],
    [
      "verification_tool",
      "scripts/check-platform-access-ts-coverage.ts",
      "inspectPlatformAccessTsCoverage",
      "spawnSync",
      1,
      "1f91cd0a05e398cc14aed104bc44c4670362ad14c3e99df1d23f0268759cac41",
      "2156e68319534aebf4587a558bb03f2c4ddd095f7df1ed175b680ff72b20d59f",
      "result",
    ],
    [
      "verification_tool",
      "scripts/check-provider-authority-coverage.ts",
      "inspectOnce",
      "spawnSync",
      1,
      "322ed39c5de1bee92d0536797e846c14316cf12d23f4967a20fee770fa768450",
      "e064e05140f5a2f15daf3cb10fd3800cb7315b3da27eb268845393609a0c8ace",
      "result",
    ],
    [
      "verification_tool",
      "scripts/check-provider-home-coverage.ts",
      "inspectOnce",
      "spawnSync",
      1,
      "ca3c5e16992ce06bac78afb5741d30d10e255784fbcf9b8690201ea8341d5eb2",
      "b600d44cc08c47c02d10f5d442755dea9046179305d06bc9909a93cf3569b154",
      "result",
    ],
    [
      "verification_tool",
      "scripts/verify-project-runtime-real-providers.ts",
      "startPublicMcpProcess",
      "spawn",
      1,
      "e9883be43c52dc83c81aa58efa713c82954d30458bcbc987d5a4060b6a5a820e",
      "d106c87f6164952180c3e709153f378472ffd3c28fa6527f7065823f0c838628",
      null,
    ],
    [
      "runtime",
      "scripts/verify-signed-recovery-matrix.ts",
      "verifyParentLossThenRecover",
      "spawnSync",
      1,
      "e884e9b6eba53bd395a4b7c8f53092d8d2a83a734f7128441873b7a41227acf1",
      "d5d15e95389f2ec8dd17f24133e01d7fc4608f77ca8436d6a05f38ed800ee525",
      "killed",
    ],
    [
      "runtime",
      "src/core/runtime-local-typescript-child-entrypoints.ts",
      "spawnRuntimeLocalTypeScriptChild",
      "spawn",
      1,
      "0f377ab85a702ba116d4b691a1be853719d31a2090b338ae1fed37343bb42048",
      "ccd848f5da81ed311e1f92629acb9a7e50d77eeeacd1e8aff3d64e75f9fe893a",
      null,
    ],
    [
      "runtime",
      "src/security/candidate-store-windows-adapter.ts",
      "inspectRuntimeOwnedWindowsProtectedRoot",
      "spawnSync",
      1,
      "7ba14539964956eac19a4e9c86ca2e9527028f43516b33a18285d707799d141f",
      "c41302e593fb1faacea42b7c3fc914465b895be7aa6d721f8335f7edb8ea6029",
      "execution",
    ],
    [
      "runtime",
      "src/security/docker-cli-trust.ts",
      "inspectDockerAuthenticode",
      "spawnSync",
      1,
      "09c761c58f78148f769232a93aaf76c4d459ab14fdd6b5274a9f0b51fbcbdfb3",
      "2ece3abb0156af99dd93e3a70d5cac1f072f9c637215d0b5a3fb681c399eaf95",
      "result",
    ],
    [
      "runtime",
      "src/security/docker-desktop-repair-native-helper.ts",
      "acquireRuntimeOwnedDockerDesktopNativeHelper",
      "spawn",
      1,
      "7f9681a86d5eaf457e2173355a325d8dfb143891700adcf4a04f68cb87f0af25",
      "cf76fcbdb58e59faf7b42ec759376e5763d51f19110ec12e99f1d5d4b526d334",
      "child",
    ],
    [
      "runtime",
      "src/security/docker-desktop-runtime-repair.ts",
      "observeEngine",
      "spawnSync",
      1,
      "e43bc7243d4dd509d7f984d4d294b42726022e7a18601a5afd6e39a540e29c4a",
      "73f043bef230d3b4f2e1ef5e7ee8380a11f76d0a5817573d7dc0b960c31ca331",
      "result",
    ],
    [
      "runtime",
      "src/security/docker-desktop-runtime-repair.ts",
      "terminateDockerWsl",
      "spawnSync",
      1,
      "61d765d5dbbdef25253ce9b32c388f0e490b51cf5adcd0eddd386393af8d4a22",
      "3081cae733c9c0755519a23d8f2cbb291d7403cc20744f8d7d2b6c5410ae8ea4",
      "result",
    ],
    [
      "runtime",
      "src/security/docker-isolation.ts",
      "executeDocker",
      "spawnSync",
      1,
      "8a03aecddb3dfc59988189c919e653e83d398aa0378fd89b075e9f69572c93fa",
      "328d0c18c9cb398f4c20b83147df71f51964a7e9b4c6136d962c9a89240b77f3",
      null,
    ],
    [
      "runtime",
      "src/security/docker-isolation.ts",
      "startOwnedAttachedProcess",
      "spawn",
      1,
      "1ada9fda9b1fca6f673aa058621cd2c8c65cb875f12f2b51a55b2b01c791c0c0",
      "6d181739c35d711b062e01af044433f859591342ddbe769fc8390abf45ef9fe6",
      "child",
    ],
    [
      "runtime",
      "src/security/docker-owned-process.ts",
      "startOwnedProcess",
      "spawn",
      1,
      "b56524d55d9f666369d91d8187ba4b80c0a157ff0868dc927e29cb6ab207f5cd",
      "4c06970be3f200e7e8ac09106ab4f3efd667c35c696331f49955e06a96aa4b20",
      "child",
    ],
    [
      "runtime",
      "src/security/docker-owned-process.ts",
      "terminateAndWait",
      "spawn",
      1,
      "210013dfb4c54fde4ea0b895c0fa45a3d05852a377a8436c0e50cc6df16bfd24",
      "c730036777b19b8bec426664849e1a4d0b195ddcd63bb5eecafc69c6b30a092e",
      "killer",
    ],
    [
      "runtime",
      "src/security/docker-recovery-runtime-internal.ts",
      "runRecoveryDocker",
      "spawnSync",
      1,
      "096b174a1da2c11026ea6beab99a40387bf7199aacb543b4fabc509c414f8f9a",
      "2f5fc1c3ad16a830a6baac78c6247006990fe50f02b455b3efee5311698c06f8",
      "result",
    ],
    [
      "runtime",
      "src/security/provider-home-windows-adapter.ts",
      "inspectRuntimeOwnedWindowsProviderHomeCandidate",
      "spawnSync",
      1,
      "7ba14539964956eac19a4e9c86ca2e9527028f43516b33a18285d707799d141f",
      "75fe97d4efe1f052b606a12290adddb94cb7fb12eb7c53e3165fcd2803fb3c88",
      "execution",
    ],
    [
      "runtime",
      "40_Develop/execution-intelligence/src/store/verified-repository-root.ts",
      "observeExactRepositoryRoot",
      "execFileSync",
      1,
      "5e0d844c15465eab569ee204969466e374ea4bfbca4f49da5f9826e9fd5b843a",
      "2dd92e2d79454613468b1879a97bce06a43c3100f14a1c65b6afb3c01e369d7d",
      "observed",
    ],
  ].map(
    ([
      graph,
      source,
      containingFunction,
      primitive,
      occurrence,
      argumentShapeSha256,
      functionBodySha256,
      resultBinding,
    ]) =>
      Object.freeze({
        graph,
        source,
        containingFunction,
        primitive,
        occurrence,
        argumentShapeSha256,
        functionBodySha256,
        resultBinding,
      }) as ExactExternalProcessCallGraph,
  ),
);

type ExactAuditedFunctionFlow = Readonly<{
  graph: RuntimeCapabilityGraphKind;
  source: string;
  functionName: string;
  bodySha256: string;
}>;

const exactAuditedFunctionFlows = Object.freeze(
  [
    [
      "runtime",
      "src/core/interactive-console.ts",
      "readInteractiveConsoleLineOutcome",
      "a824b755243d910aaf0afc7e1de06600253fefd697430a8230cae17037d953fd",
    ],
    [
      "runtime",
      "src/security/candidate-store-kernel-lock.ts",
      "acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome",
      "d1ede2ef40a83149d1e294918de5008e44a1ee68dcd0eafac83bf5aa82638caf",
    ],
    [
      "runtime",
      "src/security/candidate-store-kernel-lock.ts",
      "acquireRuntimeOwnedHostOperationSupervisorLock",
      "cdfebf69a2b539d1c1e05982fd23e256dc66ee0cbdc6770698a6571a7a4e9e22",
    ],
    [
      "runtime",
      "src/security/docker-desktop-repair-native-helper.ts",
      "acquireRuntimeOwnedDockerDesktopNativeHelper",
      "cf76fcbdb58e59faf7b42ec759376e5763d51f19110ec12e99f1d5d4b526d334",
    ],
    [
      "runtime",
      "src/security/docker-effect-runtime.ts",
      "startCommand",
      "62348a015df5ccc9de1b7c91db7eb3f2d7b9eb2d56c95e797fd5c01025049df7",
    ],
    [
      "runtime",
      "src/security/docker-effect-runtime.ts",
      "runShort",
      "4e52250cbe16c11275ece5e6ee1a3ed48139a66c7d639116e84e011f9d14c503",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "blocked",
      "dfdb12e7113528ca75e1afda0f8c114ba2ffcb5e028babd270fda491c35f8817",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "publicObservation",
      "14cd7b5627f969fe374f4ab2838658ba890c1f213c7f0efe1820e92783539335",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate",
      "ace97426202a2140020ed9817e81715c1bcc6f767ae28cefcb614b52634f2df8",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "inspectBundledCoordinatorPackageFilesystemCandidate",
      "bd51ffe2a1d278715e1c8812b7e604d9d0345bca8d8b5112c364be6cb667be8b",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "inspectFixedDevelopmentCoordinatorPackageCandidate",
      "c3be49d003b884b45a940de5a1b590343bc7202db39c328349cbc2b4913cd4c8",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "verifyOwnedBundledManifest",
      "ce658bca729912b475ffcbddd89c2c92fcfa9eadbd5b8de4b99dafe3127f35a4",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "verifiedFixedPackageRecord",
      "7a0a8cf541157ecf26d43f68afdd7419b2ff03cd62d6387d87c2d5bed3e71c27",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "issueRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "936e6c4837f13687013d7369b0cae8e99df048b0ef9c17f7f978ba6faca31820",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "consumeRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "be02e3b122acad751fdc04dd9bce2b3577d41985aed7d59c1b1bc4fbd9c36bef",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "revokeRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "a8ee6b60c6116a981dc80210ca122f8317fb2a45d36b05422d803b08d87c727c",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "verifyInstalledCoordinatorPackageCandidate",
      "d4d9d543fbb737c1827e491dad1b448be77a73600f62dc8fb00f5214f2b05f9f",
    ],
    [
      "runtime",
      "src/security/platform-provisioner-package-filesystem.ts",
      "inspectVerifiedNativeDistributionCandidate",
      "57f7ff13ab64c0e2fbabddb33a8b40587442d28ea8c825af4af3acd4803026b2",
    ],
    [
      "runtime",
      "scripts/sign-release-manifest.ts",
      "prepareReleaseManifestCandidate",
      "d435a8bd72965a4d6b862ddea43bc5677f47167949547574a535a1b40dbf1fee",
    ],
    [
      "runtime",
      "scripts/sign-release-manifest.ts",
      "preflightReleaseManifest",
      "d757f5d1f0d233d8853fd3153180a54ffed32b0467bcb5ee5b3022972f45bfaf",
    ],
    [
      "runtime",
      "scripts/sign-release-manifest.ts",
      "signReleaseManifest",
      "cb3755246ade4c1a7e8358e5973909c3720f8c145587b037ae0fcf639c75b7c6",
    ],
    [
      "runtime",
      "scripts/sign-release-manifest.ts",
      "main",
      "a7fef8f9e2878dff7e00ccd2bd8824a6540c7947571ee93362ec418acb613bbb",
    ],
    [
      "verification_tool",
      "scripts/verify-project-runtime-real-providers.ts",
      "main",
      "4d5a581c4d3731b94ec6e0ddb34672e3f014f69dc1715f0187f1a1755a611a23",
    ],
  ].map(
    ([graph, source, functionName, bodySha256]) =>
      Object.freeze({
        graph,
        source,
        functionName,
        bodySha256,
      }) as ExactAuditedFunctionFlow,
  ),
);

const exactAuditedSemanticGraphSha256 = Object.freeze(
  new Map([
    [
      "src/core/interactive-console.ts\0readInteractiveConsoleLineOutcome",
      "bc7946d27e9093d12cb588aef1d6a61a26389a809fc23705a1501246335aed11",
    ],
    [
      "src/security/candidate-store-kernel-lock.ts\0acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome",
      "04232e397db010eddd93ede49129dfe466720cdfaa032af3272850dde6f87f8b",
    ],
    [
      "src/security/candidate-store-kernel-lock.ts\0acquireRuntimeOwnedHostOperationSupervisorLock",
      "0cb9a47490a153066b41d87d8b9393bfb6654e677b1f0b3887f3c1e897eb1013",
    ],
    [
      "src/security/docker-desktop-repair-native-helper.ts\0acquireRuntimeOwnedDockerDesktopNativeHelper",
      "ab2c10133248652d19939052c86e0833034431d5c0671746f7a0c6c6f7685ff9",
    ],
    [
      "src/security/docker-effect-runtime.ts\0startCommand",
      "403716e55c4d1da7d158c5cc80c958498f52984cad56a790dfaceda4d4bcf6f0",
    ],
    [
      "src/security/docker-effect-runtime.ts\0runShort",
      "bbc21c577a40778321e1f1ac2b358b86b39bf1479581680cd75e90d85fd93396",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0blocked",
      "513840ce7ec03df7da0ae1e4e5c38c174632ba8f3154dbe9322e9c4581e842b8",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0publicObservation",
      "635e5529715df0d1099b542e0f8d3a3ecb4b95e8a233d85cabd199dda45232d5",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate",
      "af2eca911050ed4e40f486f87e565296a6d8b4fda40cc340f3266e9502c01d31",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0inspectBundledCoordinatorPackageFilesystemCandidate",
      "62f84954cda384122b36651083fad91a8abc8b4babbadc54f4981f4ab4734af6",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0inspectFixedDevelopmentCoordinatorPackageCandidate",
      "488195180f3cea3198f349b826be78cb343c32677a3d56fee9210bd184ae0ff1",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0verifyOwnedBundledManifest",
      "a3291727157f1e5d046b35475488179166924b28443341801bf3592f59e6d972",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0verifiedFixedPackageRecord",
      "9d21b48a5d98171e0f66430b6d26a2a7edb7923f650685164bf7bcd882448514",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0issueRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "c25fab4cd57bf101ca8aa6c867aed638ef3f4e7baab4bdfa154c90233ca28aa2",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0consumeRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "211ace196613fedee3668838c9dde8643a1b647f561201713d27b4967e294fa4",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0revokeRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "9224f60e47e6b99e2109e2c2aa23cc383120fe78adfafa4b5313516bf5df9e88",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0verifyInstalledCoordinatorPackageCandidate",
      "e70c39fd3c7ddbe4f61c7244b4021ff5475862eb851a9fdeb98b8e463fcb3d5e",
    ],
    [
      "src/security/platform-provisioner-package-filesystem.ts\0inspectVerifiedNativeDistributionCandidate",
      "9754b331b9eb7a3b8a37a0c017d51188c49c0f4849a28c6f713064740fc8ee73",
    ],
    [
      "scripts/sign-release-manifest.ts\0prepareReleaseManifestCandidate",
      "043dc60de9e69bb97db94a8c16200deeb1918f59f77a4827313c536376cc8541",
    ],
    [
      "scripts/sign-release-manifest.ts\0preflightReleaseManifest",
      "31f5effed8c7b876655a6c548c335eeb1275e674e3b9008c326616ce58f65937",
    ],
    [
      "scripts/sign-release-manifest.ts\0signReleaseManifest",
      "5827d31d0a7be10358138cba862b6fbdaca73b97ac5255f37364eec384b48e5e",
    ],
    [
      "scripts/sign-release-manifest.ts\0main",
      "10c60bf189c32bdc5d9e5202f945f6ed5b9d2475d26eac9a54bcf63a96c1a2a0",
    ],
    [
      "scripts/verify-project-runtime-real-providers.ts\0main",
      "b0cce4c45b1b6d4c89f6febba4ccc5daca391a249c5786dfc665661e7e5eaaa5",
    ],
  ]),
);

const auditedExportedFunctionIdentities = Object.freeze(
  new Set([
    "src/core/interactive-console.ts\0readInteractiveConsoleLineOutcome",
    "src/security/candidate-store-kernel-lock.ts\0acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome",
    "src/security/candidate-store-kernel-lock.ts\0acquireRuntimeOwnedHostOperationSupervisorLock",
    "src/security/platform-provisioner-package-filesystem.ts\0inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate",
    "src/security/platform-provisioner-package-filesystem.ts\0inspectBundledCoordinatorPackageFilesystemCandidate",
    "src/security/platform-provisioner-package-filesystem.ts\0inspectFixedDevelopmentCoordinatorPackageCandidate",
    "src/security/platform-provisioner-package-filesystem.ts\0revokeRuntimeOwnedVerifiedCoordinatorPackageCapability",
    "src/security/platform-provisioner-package-filesystem.ts\0issueRuntimeOwnedVerifiedCoordinatorPackageCapability",
    "src/security/platform-provisioner-package-filesystem.ts\0consumeRuntimeOwnedVerifiedCoordinatorPackageCapability",
    "src/security/platform-provisioner-package-filesystem.ts\0verifyInstalledCoordinatorPackageCandidate",
    "src/security/platform-provisioner-package-filesystem.ts\0inspectVerifiedNativeDistributionCandidate",
    "scripts/sign-release-manifest.ts\0preflightReleaseManifest",
    "scripts/sign-release-manifest.ts\0signReleaseManifest",
  ]),
);

const auditedFunctionLexicalParents = Object.freeze(
  new Map([
    ["src/security/docker-effect-runtime.ts\0startCommand", "createRuntime"],
    ["src/security/docker-effect-runtime.ts\0runShort", "createRuntime"],
  ]),
);

type AsyncProcessOwnership = Readonly<{
  classification: "wrapper_return" | "immediate_owner" | "lifecycle_transfer";
  proofs: readonly (readonly string[])[];
}>;

const exactAsyncProcessOwnership = Object.freeze(
  new Map<string, AsyncProcessOwnership>([
    [
      "scripts/verify-project-runtime-real-providers.ts\0startPublicMcpProcess",
      Object.freeze({
        classification: "wrapper_return",
        proofs: Object.freeze([]),
      }),
    ],
    [
      "src/core/runtime-local-typescript-child-entrypoints.ts\0spawnRuntimeLocalTypeScriptChild",
      Object.freeze({
        classification: "wrapper_return",
        proofs: Object.freeze([]),
      }),
    ],
    [
      "src/security/docker-desktop-repair-native-helper.ts\0acquireRuntimeOwnedDockerDesktopNativeHelper",
      Object.freeze({
        classification: "lifecycle_transfer",
        proofs: Object.freeze([
          Object.freeze([
            "const",
            "created",
            "=",
            "createDockerDesktopRepairNativeHelperLifecycle",
            "(",
            "child",
            ",",
          ]),
        ]),
      }),
    ],
    [
      "src/security/docker-isolation.ts\0startOwnedAttachedProcess",
      Object.freeze({
        classification: "immediate_owner",
        proofs: Object.freeze([
          Object.freeze(["child", ".", "once", "(", "spawn"]),
          Object.freeze(["child", ".", "once", "(", "error"]),
          Object.freeze(["child", ".", "once", "(", "close"]),
        ]),
      }),
    ],
    [
      "src/security/docker-owned-process.ts\0startOwnedProcess",
      Object.freeze({
        classification: "immediate_owner",
        proofs: Object.freeze([
          Object.freeze(["child", ".", "once", "(", "spawn"]),
          Object.freeze(["child", ".", "once", "(", "error"]),
          Object.freeze(["child", ".", "once", "(", "close"]),
        ]),
      }),
    ],
    [
      "src/security/docker-owned-process.ts\0terminateAndWait",
      Object.freeze({
        classification: "immediate_owner",
        proofs: Object.freeze([
          Object.freeze(["killer", ".", "once", "(", "error"]),
          Object.freeze(["killer", ".", "once", "(", "close"]),
        ]),
      }),
    ],
  ]),
);

type ExecutableProvenance = Readonly<{
  classification:
    | "node_self"
    | "validated_local_artifact"
    | "registered_platform_helper"
    | "closed_wrapper_parameter"
    | "closed_verification_toolchain";
  proofs: readonly (readonly string[])[];
}>;

const exactExecutableProvenance = Object.freeze(
  new Map<string, ExecutableProvenance>([
    [
      "src/security/windows-directory-bootstrap.ts\0observeSystemWindowsDirectory",
      Object.freeze({
        classification: "validated_local_artifact",
        proofs: Object.freeze([
          Object.freeze([
            "beginPlatformAccessArtifactSigningObservation",
            "(",
            "distributionRoot",
            ")",
          ]),
          Object.freeze([
            "if",
            "(",
            "!",
            "snapshot",
            "||",
            "snapshot",
            ".",
            "artifact",
            ".",
            "sha256",
            "!",
            "=",
            "=",
            "BOOTSTRAP_ARTIFACT_SHA256",
            ")",
            "return",
            "null",
          ]),
        ]),
      }),
    ],
    [
      "src/security/docker-restart-machine.ts\0queryWsl",
      Object.freeze({
        classification: "registered_platform_helper",
        proofs: Object.freeze([
          Object.freeze(["createWindowsNativeHelperEnvironment", "("]),
          Object.freeze([
            "path",
            ".",
            "win32",
            ".",
            "join",
            "(",
            "env",
            ".",
            "SystemRoot",
            ",",
            "System32",
            ",",
            "wsl.exe",
          ]),
        ]),
      }),
    ],
    [
      "src/security/docker-restart-machine.ts\0queryDockerEngine",
      Object.freeze({
        classification: "registered_platform_helper",
        proofs: Object.freeze([
          Object.freeze(["const", "cli", "=", "observeTrustedDockerCli", "("]),
        ]),
      }),
    ],
    [
      "src/security/docker-restart-machine.ts\0queryContainersAbsent",
      Object.freeze({
        classification: "registered_platform_helper",
        proofs: Object.freeze([
          Object.freeze(["const", "cli", "=", "observeTrustedDockerCli", "("]),
        ]),
      }),
    ],
    ...[
      "src/core/runtime-local-typescript-child-entrypoints.ts\0spawnRuntimeLocalTypeScriptChild",
      "scripts/check-dynamic-fake-provider-coverage.ts\0inspectOnce",
      "scripts/check-platform-access-ts-coverage.ts\0inspectPlatformAccessTsCoverage",
      "scripts/check-provider-authority-coverage.ts\0inspectOnce",
      "scripts/check-provider-home-coverage.ts\0inspectOnce",
      "scripts/verify-project-runtime-real-providers.ts\0startPublicMcpProcess",
    ].map(
      (identity) =>
        [
          identity,
          Object.freeze({
            classification: "node_self" as const,
            proofs: Object.freeze([
              Object.freeze(["process", ".", "execPath"]),
            ]),
          }),
        ] as const,
    ),
    ...[
      [
        "src/security/candidate-store-windows-adapter.ts\0inspectRuntimeOwnedWindowsProtectedRoot",
        [["beginPlatformAccessArtifactSigningObservation", "("]],
      ],
      [
        "src/security/provider-home-windows-adapter.ts\0inspectRuntimeOwnedWindowsProviderHomeCandidate",
        [["beginPlatformAccessArtifactSigningObservation", "("]],
      ],
      [
        "src/security/docker-desktop-repair-native-helper.ts\0acquireRuntimeOwnedDockerDesktopNativeHelper",
        [["beginPlatformAccessArtifactSigningObservation", "("]],
      ],
      [
        "src/security/docker-cli-trust.ts\0inspectDockerAuthenticode",
        [
          [
            "const",
            "environment",
            "=",
            "createWindowsPowerShellAuthenticodeEnvironment",
          ],
          ["fs", ".", "realpathSync", ".", "native", "(", "powershell"],
        ],
      ],
      [
        "src/security/docker-desktop-runtime-repair.ts\0observeEngine",
        [["const", "cli", "=", "observeCurrentTrustedDockerCli", "("]],
      ],
      [
        "src/security/docker-desktop-runtime-repair.ts\0terminateDockerWsl",
        [
          [
            "const",
            "environment",
            "=",
            "createWindowsNativeHelperEnvironment",
            "(",
          ],
        ],
      ],
      [
        "src/security/docker-isolation.ts\0executeDocker",
        [["verifyTrustedDockerCliCapability", "(", "cliCapability", ")"]],
      ],
      [
        "src/security/docker-recovery-runtime-internal.ts\0runRecoveryDocker",
        [["verifyRecoveryDockerCli", "(", ")"]],
      ],
    ].map(
      ([identity, proofs]) =>
        [
          identity as string,
          Object.freeze({
            classification: "validated_local_artifact" as const,
            proofs: Object.freeze(
              (proofs as readonly (readonly string[])[]).map((proofTokens) =>
                Object.freeze(proofTokens),
              ),
            ),
          }),
        ] as const,
    ),
    ...[
      "src/security/docker-owned-process.ts\0startOwnedProcess",
      "src/security/docker-isolation.ts\0startOwnedAttachedProcess",
    ].map(
      (identity) =>
        [
          identity,
          Object.freeze({
            classification: "closed_wrapper_parameter" as const,
            proofs: Object.freeze([]),
          }),
        ] as const,
    ),
    [
      "scripts/check-platform-access-coverage.ts\0executeCommand",
      Object.freeze({
        classification: "closed_verification_toolchain" as const,
        proofs: Object.freeze([]),
      }),
    ],
    ...[
      "src/security/docker-owned-process.ts\0terminateAndWait",
      "scripts/verify-signed-recovery-matrix.ts\0verifyParentLossThenRecover",
      "40_Develop/execution-intelligence/src/store/verified-repository-root.ts\0observeExactRepositoryRoot",
    ].map(
      (identity) =>
        [
          identity,
          Object.freeze({
            classification: "registered_platform_helper" as const,
            proofs: Object.freeze([]),
          }),
        ] as const,
    ),
  ]),
);

const runtimeChildProcessOwnerPrimitives = new Map<
  string,
  ReadonlySet<string>
>();
for (const callsite of runtimeExternalProcessCallsites) {
  const primitives = new Set(
    runtimeChildProcessOwnerPrimitives.get(callsite.source) ?? [],
  );
  primitives.add(callsite.primitive);
  runtimeChildProcessOwnerPrimitives.set(callsite.source, primitives);
}

function coordinatorRelativeSourcePath(relativePath: string) {
  const prefix = "40_Develop/coordinator/";
  return relativePath.startsWith(prefix)
    ? relativePath.slice(prefix.length)
    : relativePath;
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
      try {
        const target = scriptChildTargetFromTokens(
          relativePath,
          tokens,
          index + 7,
        );
        if (target) targets.push(target);
        accountedUses.add(index);
      } catch {
        // Calls with a compound argv are owned by the exact external-process
        // call-site boundary rather than by the single-entrypoint projection.
      }
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
    } else if (imported === "fork" || imported === "Worker")
      throw new Error("platform_provisioner_runtime_dependency_child_unbound");
  }
  if (
    [...processBindings.bindings.entries()].some(
      ([local, imported]) =>
        (imported === "fork" || imported === "Worker") &&
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
  if (canonicalNodeModuleSpecifiers.has(specifier)) return null;
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

function declaredLocalTypeScriptChildTargets(
  relativePath: string,
  tokens: readonly SourceToken[],
) {
  const declarations: Array<
    Readonly<{ role: string; kind: "worker" | "spawn"; target: string }>
  > = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (
      tokens[index]?.kind !== "identifier" ||
      tokens[index]?.value !== "declareLocalTypeScriptChildEntrypoint"
    )
      continue;
    if (tokens[index - 1]?.value === "function") continue;
    if (
      ![
        "src/core/runtime-local-typescript-child-entrypoints.ts",
        "40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts",
      ].includes(relativePath) ||
      tokens[index + 1]?.value !== "(" ||
      tokens[index + 2]?.kind !== "string" ||
      tokens[index + 3]?.value !== "," ||
      tokens[index + 4]?.kind !== "string" ||
      tokens[index + 5]?.value !== "," ||
      tokens[index + 6]?.kind !== "string" ||
      tokens[index + 7]?.value !== "," ||
      !tokenSequenceMatches(tokens, index + 8, [
        "import",
        ".",
        "meta",
        ".",
        "url",
      ])
    )
      throw new Error("platform_provisioner_runtime_dependency_noncanonical");
    const closingIndex =
      tokens[index + 13]?.value === "," ? index + 14 : index + 13;
    if (tokens[closingIndex]?.value !== ")")
      throw new Error("platform_provisioner_runtime_dependency_noncanonical");
    const role = tokens[index + 2];
    const kind = tokens[index + 4];
    const specifier = tokens[index + 6];
    if (
      !role ||
      role.escaped ||
      !runtimeDistributionLocalNodeChildRoles.has(role.value) ||
      !kind ||
      kind.escaped ||
      (kind.value !== "worker" && kind.value !== "spawn") ||
      !specifier ||
      specifier.escaped ||
      !specifier.value.endsWith(".ts")
    )
      throw new Error("platform_provisioner_runtime_dependency_noncanonical");
    const target = canonicalRelativeModuleTarget(relativePath, specifier.value);
    if (!target)
      throw new Error("platform_provisioner_runtime_dependency_noncanonical");
    declarations.push(
      Object.freeze({ role: role.value, kind: kind.value, target }),
    );
  }
  return Object.freeze(declarations);
}

const localTypeScriptChildWrapperKinds = Object.freeze(
  new Map<string, "worker" | "spawn">([
    ["createRuntimeLocalTypeScriptWorker", "worker"],
    ["spawnRuntimeLocalTypeScriptChild", "spawn"],
  ]),
);
const localTypeScriptChildModulePaths = Object.freeze(
  new Set([
    "src/core/runtime-local-typescript-child-entrypoints.ts",
    "40_Develop/coordinator/src/core/runtime-local-typescript-child-entrypoints.ts",
  ]),
);
const localTypeScriptChildObserverPaths = Object.freeze(
  new Set([
    "src/security/platform-provisioner-package-filesystem.ts",
    "40_Develop/coordinator/src/security/platform-provisioner-package-filesystem.ts",
  ]),
);
const LOCAL_TYPESCRIPT_CHILD_REGISTRY_SNAPSHOT_NAME =
  "runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver";

function directCallArgumentStarts(
  tokens: readonly SourceToken[],
  openingParenthesis: number,
) {
  const starts: number[] = [];
  const closing = new Map([
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ]);
  const stackTokens: string[] = [];
  let isExpectingArgument = true;
  for (let index = openingParenthesis + 1; index < tokens.length; index += 1) {
    const value = tokens[index]?.value ?? "";
    if (stackTokens.length === 0 && value === ")") return Object.freeze(starts);
    if (isExpectingArgument && stackTokens.length === 0 && value !== ",") {
      starts.push(index);
      isExpectingArgument = false;
    }
    const expectedClosing = closing.get(value);
    if (expectedClosing) stackTokens.push(expectedClosing);
    else if (stackTokens.at(-1) === value) stackTokens.pop();
    else if (stackTokens.length === 0 && value === ",")
      isExpectingArgument = true;
  }
  throw new Error("platform_provisioner_runtime_dependency_parse_failed");
}

type DirectCallArgumentRange = Readonly<{ start: number; end: number }>;

function directCallArgumentRanges(
  tokens: readonly SourceToken[],
  openingParenthesis: number,
) {
  const starts = directCallArgumentStarts(tokens, openingParenthesis);
  const ranges: DirectCallArgumentRange[] = [];
  const closing = new Map([
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ]);
  const stackTokens: string[] = [];
  let argumentIndex = 0;
  for (let index = openingParenthesis + 1; index < tokens.length; index += 1) {
    const value = tokens[index]?.value ?? "";
    if (stackTokens.length === 0 && (value === "," || value === ")")) {
      const start = starts[argumentIndex];
      if (start !== undefined) {
        ranges.push(Object.freeze({ start, end: index }));
        argumentIndex += 1;
      }
      if (value === ")") return Object.freeze(ranges);
      continue;
    }
    const expectedClosing = closing.get(value);
    if (expectedClosing) stackTokens.push(expectedClosing);
    else if (stackTokens.at(-1) === value) stackTokens.pop();
  }
  throw new Error("platform_provisioner_runtime_dependency_parse_failed");
}

function exactExpressionMatches(
  tokens: readonly SourceToken[],
  range: DirectCallArgumentRange | undefined,
  expectedTokens: readonly string[],
) {
  return (
    range !== undefined &&
    range.end - range.start === expectedTokens.length &&
    tokenSequenceMatches(tokens, range.start, expectedTokens)
  );
}

function expressionContainsTopLevelAlternative(
  tokens: readonly SourceToken[],
  range: DirectCallArgumentRange,
) {
  const closing = new Map([
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ]);
  const stackTokens: string[] = [];
  for (let index = range.start; index < range.end; index += 1) {
    const value = tokens[index]?.value ?? "";
    const expectedClosing = closing.get(value);
    if (expectedClosing) stackTokens.push(expectedClosing);
    else if (stackTokens.at(-1) === value) stackTokens.pop();
    else if (
      stackTokens.length === 0 &&
      ["||", "&&", "??", "?", "=", ","].includes(value)
    )
      return true;
  }
  return false;
}

function prefixedArrayExpressionMatches(
  tokens: readonly SourceToken[],
  range: DirectCallArgumentRange | undefined,
  expectedPrefixTokens: readonly string[],
) {
  if (
    range === undefined ||
    !tokenSequenceMatches(tokens, range.start, expectedPrefixTokens)
  )
    return false;
  if (expectedPrefixTokens[0] === "[")
    return (
      tokens[range.start]?.value === "[" && tokens[range.end - 1]?.value === "]"
    );
  return range.end - range.start === expectedPrefixTokens.length;
}

function usedLocalTypeScriptChildRoleKinds(
  relativePath: string,
  tokens: readonly SourceToken[],
) {
  if (localTypeScriptChildModulePaths.has(relativePath))
    return Object.freeze([]);
  const uses: Array<Readonly<{ role: string; kind: "worker" | "spawn" }>> = [];
  const importedWrappers = new Set<string>();
  const declarationIndices = new Set<number>();
  for (const declaration of moduleDeclarationsFromTokens(tokens)) {
    const specifier =
      declaration.specifierIndex === null
        ? undefined
        : tokens[declaration.specifierIndex];
    if (specifier?.kind !== "string" || !specifier.value.startsWith("."))
      continue;
    const target = canonicalRelativeModuleTarget(relativePath, specifier.value);
    if (!target || !localTypeScriptChildModulePaths.has(target)) continue;
    if (declaration.kind !== "static_import")
      throw new Error(
        "platform_provisioner_runtime_dependency_child_use_noncanonical",
      );
    for (const binding of declaration.bindings) {
      const isWrapper = localTypeScriptChildWrapperKinds.has(binding.imported);
      const isObserverProjection =
        binding.imported === LOCAL_TYPESCRIPT_CHILD_REGISTRY_SNAPSHOT_NAME;
      if (
        binding.typeOnly ||
        binding.local !== binding.imported ||
        (!isWrapper && !isObserverProjection) ||
        (isObserverProjection &&
          !localTypeScriptChildObserverPaths.has(relativePath)) ||
        (isWrapper && localTypeScriptChildObserverPaths.has(relativePath))
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_use_noncanonical",
        );
      if (isWrapper) importedWrappers.add(binding.local);
      declarationIndices.add(binding.localTokenIndex);
    }
  }
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.kind !== "identifier") continue;
    const name = tokens[index]?.value ?? "";
    if (
      name === "runtimeLocalTypeScriptChildEntrypoint" ||
      (name === LOCAL_TYPESCRIPT_CHILD_REGISTRY_SNAPSHOT_NAME &&
        !declarationIndices.has(index) &&
        !localTypeScriptChildObserverPaths.has(relativePath))
    )
      throw new Error(
        `${relativePath}:platform_provisioner_runtime_dependency_child_use_noncanonical`,
      );
    const kind = localTypeScriptChildWrapperKinds.get(name);
    if (!kind || declarationIndices.has(index)) continue;
    if (
      !importedWrappers.has(name) ||
      tokens[index - 1]?.value === "." ||
      tokens[index + 1]?.value !== "("
    )
      throw new Error(
        `${relativePath}:platform_provisioner_runtime_dependency_child_use_noncanonical`,
      );
    const argumentStarts = directCallArgumentStarts(tokens, index + 1);
    const roleToken = argumentStarts[0];
    if (
      roleToken === undefined ||
      tokens[roleToken]?.kind !== "string" ||
      tokens[roleToken]?.escaped ||
      !runtimeDistributionLocalNodeChildRoles.has(
        tokens[roleToken]?.value ?? "",
      )
    )
      throw new Error(
        `${relativePath}:platform_provisioner_runtime_dependency_child_use_noncanonical`,
      );
    uses.push(Object.freeze({ role: tokens[roleToken]?.value ?? "", kind }));
  }
  return Object.freeze(uses);
}

function assertNoUndeclaredLocalTypeScriptImportMetaUrl(
  relativePath: string,
  tokens: readonly SourceToken[],
) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (!tokenSequenceMatches(tokens, index, ["new", "URL", "("])) continue;
    if (
      tokens[index + 3]?.kind === "string" &&
      /[?#%]/u.test(tokens[index + 3]?.value ?? "") &&
      tokens
        .slice(index + 4, index + 24)
        .some((_token, offset) =>
          tokenSequenceMatches(tokens, index + 4 + offset, [
            "import",
            ".",
            "meta",
            ".",
            "url",
          ]),
        )
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_child_url_unbound",
      );
    if (
      ["bin/launch.ts", "40_Develop/coordinator/bin/launch.ts"].includes(
        relativePath,
      ) &&
      tokenSequenceMatches(tokens, index + 3, [
        "plan",
        ".",
        "entryRelativePath",
        ",",
        "import",
        ".",
        "meta",
        ".",
        "url",
        ")",
      ])
    )
      continue;
    if (
      localTypeScriptChildModulePaths.has(relativePath) &&
      tokenSequenceMatches(tokens, index + 3, [
        "entrypoint",
        ".",
        "relativePath",
        ",",
        "import",
        ".",
        "meta",
        ".",
        "url",
        ")",
      ])
    )
      continue;
    if (
      tokens[index + 3]?.kind === "string" &&
      tokens[index + 4]?.value === "," &&
      !tokens[index + 3]?.value.endsWith(".ts")
    )
      continue;
    const hasImportMetaUrl = tokens
      .slice(index + 3, index + 24)
      .some((_token, offset) =>
        tokenSequenceMatches(tokens, index + 3 + offset, [
          "import",
          ".",
          "meta",
          ".",
          "url",
        ]),
      );
    if (hasImportMetaUrl)
      throw new Error(
        "platform_provisioner_runtime_dependency_child_url_unbound",
      );
  }
}

type InternalLifecycleCall = Readonly<{
  symbol: string;
  containingFunction: string;
  argumentPrefixes: readonly (readonly string[])[];
  beforePrefixes?: readonly (readonly string[])[];
  afterPrefixes?: readonly (readonly string[])[];
}>;

const internalLifecycleConsumers = Object.freeze(
  new Map<
    string,
    Readonly<{
      leaf: string;
      calls: readonly InternalLifecycleCall[];
    }>
  >([
    [
      "src/core/interactive-console-reader-lifecycle-internal.ts",
      Object.freeze({
        leaf: "src/core/interactive-console.ts",
        calls: Object.freeze([
          Object.freeze({
            symbol: "runInteractiveConsoleReaderLifecycle",
            containingFunction: "readInteractiveConsoleLineOutcome",
            argumentPrefixes: Object.freeze([
              Object.freeze([
                "Object",
                ".",
                "freeze",
                "(",
                "{",
                "inputDescriptor",
                "}",
              ]),
              Object.freeze(["cancellationSignal"]),
              Object.freeze(["child"]),
              Object.freeze([
                "Object",
                ".",
                "freeze",
                "(",
                "{",
                "setTimeout",
                ",",
                "clearTimeout",
                "}",
              ]),
            ]),
            beforePrefixes: Object.freeze([
              Object.freeze([
                "tty",
                ".",
                "isatty",
                "(",
                "inputDescriptor",
                ")",
              ]),
              Object.freeze([
                "child",
                "=",
                "spawnRuntimeLocalTypeScriptChild",
                "(",
                "interactive_console_reader",
              ]),
            ]),
            afterPrefixes: Object.freeze([
              Object.freeze([".", "then", "(", "(", "outcome", ")", "=>"]),
            ]),
          }),
        ]),
      }),
    ],
    [
      "src/security/candidate-store-kernel-lock-lifecycle-internal.ts",
      Object.freeze({
        leaf: "src/security/candidate-store-kernel-lock.ts",
        calls: Object.freeze([
          Object.freeze({
            symbol: "prepareInteractiveConsoleKernelLockRequest",
            containingFunction:
              "acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome",
            argumentPrefixes: Object.freeze([]),
            beforePrefixes: Object.freeze([
              Object.freeze(["const", "request", "="]),
            ]),
          }),
          Object.freeze({
            symbol: "runInteractiveConsoleKernelLockLifecycle",
            containingFunction:
              "acquireRuntimeOwnedInteractiveConsoleKernelLockOutcome",
            argumentPrefixes: Object.freeze([
              Object.freeze(["worker"]),
              Object.freeze(["request", ".", "sharedState"]),
            ]),
            beforePrefixes: Object.freeze([
              Object.freeze([
                "worker",
                "=",
                "createRuntimeLocalTypeScriptWorker",
                "(",
                "candidate_store_lock_worker",
              ]),
            ]),
          }),
          Object.freeze({
            symbol: "runHostOperationSupervisorLifecycle",
            containingFunction:
              "acquireRuntimeOwnedHostOperationSupervisorLock",
            argumentPrefixes: Object.freeze([
              Object.freeze(["request"]),
              Object.freeze(["child"]),
            ]),
            beforePrefixes: Object.freeze([
              Object.freeze([
                "child",
                "=",
                "spawnRuntimeLocalTypeScriptChild",
                "(",
                "host_operation_lock_supervisor",
              ]),
            ]),
          }),
        ]),
      }),
    ],
    [
      "src/security/docker-desktop-repair-native-helper-lifecycle-internal.ts",
      Object.freeze({
        leaf: "src/security/docker-desktop-repair-native-helper.ts",
        calls: Object.freeze([
          Object.freeze({
            symbol: "createDockerDesktopRepairNativeHelperLifecycle",
            containingFunction: "acquireRuntimeOwnedDockerDesktopNativeHelper",
            argumentPrefixes: Object.freeze([
              Object.freeze(["child"]),
              Object.freeze(["policy", ".", "policySha256"]),
              Object.freeze(["protocol"]),
            ]),
            beforePrefixes: Object.freeze([
              Object.freeze(["const", "signingObservation", "="]),
              Object.freeze(["child", "=", "spawn", "(", "executablePath"]),
            ]),
            afterPrefixes: Object.freeze([
              Object.freeze([
                "const",
                "initial",
                "=",
                "await",
                "created",
                ".",
                "waitForInitial",
              ]),
            ]),
          }),
        ]),
      }),
    ],
  ]),
);

type ProcessWrapperUse = Readonly<{
  source: string;
  containingFunction: string | null;
  prefix: readonly string[];
}>;

const processWrapperConsumers = Object.freeze(
  new Map<
    string,
    Readonly<{
      target: string;
      exported: boolean;
      uses: readonly ProcessWrapperUse[];
    }>
  >([
    [
      "startOwnedProcess",
      Object.freeze({
        target: "src/security/docker-owned-process.ts",
        exported: true,
        uses: Object.freeze([
          Object.freeze({
            source: "src/security/docker-owned-process.ts",
            containingFunction: "startOwnedWindowsProcessTreeTermination",
            prefix: Object.freeze([
              "startOwnedProcess",
              "(",
              "TASKKILL_EXECUTABLE",
              ",",
              "[",
            ]),
          }),
          Object.freeze({
            source: "src/security/docker-effect-runtime.ts",
            containingFunction: null,
            prefix: Object.freeze([
              ",",
              "startProcess",
              ":",
              "startOwnedProcess",
              ",",
            ]),
          }),
        ]),
      }),
    ],
    [
      "startOwnedAttachedProcess",
      Object.freeze({
        target: "src/security/docker-isolation.ts",
        exported: false,
        uses: Object.freeze([
          Object.freeze({
            source: "src/security/docker-isolation.ts",
            containingFunction: "startAttachedDockerCommand",
            prefix: Object.freeze([
              "startOwnedAttachedProcess",
              "(",
              "executable",
              ",",
              "[",
            ]),
          }),
          Object.freeze({
            source: "src/security/docker-isolation.ts",
            containingFunction: "verifyOwnedAttachTerminationForFixture",
            prefix: Object.freeze([
              "startOwnedAttachedProcess",
              "(",
              "process",
              ".",
              "execPath",
              ",",
              "[",
            ]),
          }),
        ]),
      }),
    ],
    [
      "executeCommand",
      Object.freeze({
        target: "scripts/check-platform-access-coverage.ts",
        exported: false,
        uses: Object.freeze([
          Object.freeze({
            source: "scripts/check-platform-access-coverage.ts",
            containingFunction: "llvmTool",
            prefix: Object.freeze(["executeCommand", "(", "rustc", ",", "["]),
          }),
          Object.freeze({
            source: "scripts/check-platform-access-coverage.ts",
            containingFunction: null,
            prefix: Object.freeze(["executeCommand", "(", "cargo", ",", "["]),
          }),
          Object.freeze({
            source: "scripts/check-platform-access-coverage.ts",
            containingFunction: null,
            prefix: Object.freeze([
              "executeCommand",
              "(",
              "llvmTool",
              "(",
              "llvm-profdata",
            ]),
          }),
          Object.freeze({
            source: "scripts/check-platform-access-coverage.ts",
            containingFunction: null,
            prefix: Object.freeze([
              "executeCommand",
              "(",
              "llvmTool",
              "(",
              "llvm-cov",
            ]),
          }),
        ]),
      }),
    ],
  ]),
);

function containingNamedFunction(
  tokens: readonly SourceToken[],
  tokenIndex: number,
) {
  const candidates: Array<
    Readonly<{
      name: string;
      opening: number;
      closing: number;
    }>
  > = [];
  const select = (name: string, opening: number, closing: number) => {
    if (tokenIndex > opening && tokenIndex < closing)
      candidates.push(Object.freeze({ name, opening, closing }));
  };
  const matchingOpening = (
    closingIndex: number,
    opening: string,
    closing: string,
  ) => {
    let depth = 0;
    for (let index = closingIndex; index >= 0; index -= 1) {
      if (tokens[index]?.value === closing) depth += 1;
      else if (tokens[index]?.value === opening) {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return null;
  };
  const arrowName = (arrowIndex: number) => {
    let cursor = arrowIndex - 1;
    if (tokens[cursor]?.value === ")") {
      const opening = matchingOpening(cursor, "(", ")");
      if (opening === null) return `anonymous@${arrowIndex}`;
      cursor = opening - 1;
    } else if (tokens[cursor]?.kind === "identifier") cursor -= 1;
    if (tokens[cursor]?.value === "async") cursor -= 1;
    if (
      (tokens[cursor]?.value === ":" || tokens[cursor]?.value === "=") &&
      tokens[cursor - 1]?.kind === "identifier"
    )
      return tokens[cursor - 1]?.value ?? `anonymous@${arrowIndex}`;
    return `anonymous@${arrowIndex}`;
  };
  for (let index = 0; index < tokenIndex; index += 1) {
    if (tokens[index]?.value === "=>") {
      const callableName = arrowName(index);
      if (callableName.startsWith("anonymous@")) continue;
      const bodyStart = index + 1;
      if (tokens[bodyStart]?.value === "{") {
        try {
          select(
            callableName,
            bodyStart,
            matchingTokenIndex(tokens, bodyStart, "{", "}"),
          );
        } catch {
          // A malformed unrelated arrow is not evidence about the protected
          // value. The protected declaration itself is checked separately.
        }
      } else {
        const closing = new Map([
          ["(", ")"],
          ["[", "]"],
          ["{", "}"],
        ]);
        const stackTokens: string[] = [];
        let end = tokens.length;
        for (let cursor = bodyStart; cursor < tokens.length; cursor += 1) {
          const value = tokens[cursor]?.value ?? "";
          const expected = closing.get(value);
          if (expected) stackTokens.push(expected);
          else if (stackTokens.at(-1) === value) stackTokens.pop();
          else if (
            stackTokens.length === 0 &&
            [",", ";", "}", ")", "]"].includes(value)
          ) {
            end = cursor;
            break;
          }
        }
        select(callableName, index, end);
      }
      continue;
    }
    if (
      tokens[index]?.kind !== "identifier" ||
      tokens[index]?.value !== "function" ||
      tokens[index + 1]?.kind !== "identifier" ||
      tokens[index + 2]?.value !== "("
    )
      continue;
    let parametersEnd: number;
    try {
      parametersEnd = matchingTokenIndex(tokens, index + 2, "(", ")");
    } catch {
      continue;
    }
    let bodyStart = parametersEnd + 1;
    while (bodyStart < tokenIndex) {
      if (
        tokens[bodyStart]?.value === "{" &&
        tokens[bodyStart - 1]?.value !== "<" &&
        tokens[bodyStart - 1]?.value !== ":"
      )
        break;
      bodyStart += 1;
    }
    if (tokens[bodyStart]?.value !== "{") continue;
    let bodyEnd: number;
    try {
      bodyEnd = matchingTokenIndex(tokens, bodyStart, "{", "}");
    } catch {
      continue;
    }
    select(tokens[index + 1]?.value ?? "", bodyStart, bodyEnd);
  }
  return (
    candidates.sort((left, right) => right.opening - left.opening)[0] ?? null
  );
}

function argumentMatchesPrefix(
  tokens: readonly SourceToken[],
  argumentStart: number | undefined,
  prefixTokens: readonly string[],
) {
  return (
    argumentStart !== undefined &&
    tokenSequenceMatches(tokens, argumentStart, prefixTokens)
  );
}

function tokenSequenceExistsBetween(
  tokens: readonly SourceToken[],
  start: number,
  end: number,
  sequenceTokens: readonly string[],
) {
  for (let index = start; index + sequenceTokens.length <= end; index += 1) {
    if (tokenSequenceMatches(tokens, index, sequenceTokens)) return true;
  }
  return false;
}

function tokenSequenceIndicesBetween(
  tokens: readonly SourceToken[],
  start: number,
  end: number,
  sequenceTokens: readonly string[],
) {
  const indices: number[] = [];
  for (let index = start; index + sequenceTokens.length <= end; index += 1) {
    if (tokenSequenceMatches(tokens, index, sequenceTokens))
      indices.push(index);
  }
  return Object.freeze(indices);
}

function containingBlockPath(
  tokens: readonly SourceToken[],
  tokenIndex: number,
) {
  const stackTokens: number[] = [];
  for (let index = 0; index < tokenIndex; index += 1) {
    if (tokens[index]?.value === "{") stackTokens.push(index);
    else if (tokens[index]?.value === "}") stackTokens.pop();
  }
  return Object.freeze(stackTokens);
}

function blockPathDominates(
  proofPathTokens: readonly number[],
  consumerPathTokens: readonly number[],
) {
  return (
    proofPathTokens.length <= consumerPathTokens.length &&
    proofPathTokens.every(
      (opening, index) => consumerPathTokens[index] === opening,
    )
  );
}

function hasUniqueDominatingProof(
  tokens: readonly SourceToken[],
  consumerIndex: number,
  sequenceTokens: readonly string[],
) {
  const consumerPathTokens = containingBlockPath(tokens, consumerIndex);
  return (
    tokenSequenceIndicesBetween(
      tokens,
      0,
      consumerIndex,
      sequenceTokens,
    ).filter(
      (proofIndex) =>
        tokens[proofIndex - 1]?.value !== "function" &&
        blockPathDominates(
          containingBlockPath(tokens, proofIndex),
          consumerPathTokens,
        ),
    ).length === 1
  );
}

function hasDominatingProof(
  tokens: readonly SourceToken[],
  consumerIndex: number,
  sequenceTokens: readonly string[],
) {
  const consumerOwner = containingNamedFunction(tokens, consumerIndex);
  return tokenSequenceIndicesBetween(
    tokens,
    0,
    consumerIndex,
    sequenceTokens,
  ).some((proofIndex) => {
    if (tokens[proofIndex - 1]?.value === "function") return false;
    const proofOwner = containingNamedFunction(tokens, proofIndex);
    if ((proofOwner?.name ?? null) !== (consumerOwner?.name ?? null))
      return false;
    return !containingBlockPath(tokens, proofIndex).some((opening) =>
      tokenSequenceMatches(tokens, opening - 4, ["if", "(", "false", ")", "{"]),
    );
  });
}

function assertInternalLifecycleConsumerBoundary(
  relativePath: string,
  tokens: readonly SourceToken[],
  shouldEnforceDeclaredGraph: boolean,
) {
  const sourcePath = coordinatorRelativeSourcePath(relativePath);
  const ownedCapability = internalLifecycleConsumers.get(sourcePath);
  if (ownedCapability && shouldEnforceDeclaredGraph) {
    for (const expected of ownedCapability.calls) {
      let declarationCount = 0;
      for (let index = 0; index < tokens.length; index += 1) {
        if (
          tokens[index]?.value === expected.symbol &&
          tokens[index - 1]?.value === "function" &&
          (tokens[index - 2]?.value === "export" ||
            (tokens[index - 2]?.value === "async" &&
              tokens[index - 3]?.value === "export"))
        )
          declarationCount += 1;
      }
      if (declarationCount !== 1)
        throw new Error(
          "platform_provisioner_runtime_dependency_child_lifecycle_unbound",
        );
    }
  }
  const importedDeclarations = new Map<string, Set<number>>();
  for (const declaration of moduleDeclarationsFromTokens(tokens)) {
    const specifier =
      declaration.specifierIndex === null
        ? undefined
        : tokens[declaration.specifierIndex];
    if (specifier?.kind !== "string" || !specifier.value.startsWith("."))
      continue;
    const resolvedTarget = canonicalRelativeModuleTarget(
      relativePath,
      specifier.value,
    );
    const target = resolvedTarget
      ? coordinatorRelativeSourcePath(resolvedTarget)
      : null;
    if (!target || !internalLifecycleConsumers.has(target)) continue;
    const capability = internalLifecycleConsumers.get(target);
    if (
      !capability ||
      declaration.kind !== "static_import" ||
      capability.leaf !== sourcePath
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_child_lifecycle_unbound",
      );
    const expectedSymbols = new Set(
      capability.calls.map((call) => call.symbol),
    );
    const declarationIndices = new Set<number>();
    for (const binding of declaration.bindings) {
      if (
        binding.typeOnly ||
        binding.imported !== binding.local ||
        !expectedSymbols.has(binding.imported)
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_lifecycle_unbound",
        );
      declarationIndices.add(binding.localTokenIndex);
    }
    if (declarationIndices.size !== expectedSymbols.size)
      throw new Error(
        "platform_provisioner_runtime_dependency_child_lifecycle_unbound",
      );
    importedDeclarations.set(target, declarationIndices);
  }
  for (const [target, capability] of internalLifecycleConsumers) {
    if (sourcePath === target) continue;
    const declarationIndices = importedDeclarations.get(target) ?? new Set();
    const observed = new Map<string, number>();
    for (let index = 0; index < tokens.length; index += 1) {
      if (tokens[index]?.kind !== "identifier") continue;
      const symbol = tokens[index]?.value ?? "";
      const call = capability.calls.find(
        (candidate) => candidate.symbol === symbol,
      );
      if (!call || declarationIndices.has(index)) continue;
      if (sourcePath !== capability.leaf)
        throw new Error(
          "platform_provisioner_runtime_dependency_child_lifecycle_unbound",
        );
      const owner = containingNamedFunction(tokens, index);
      const argumentRanges =
        tokens[index + 1]?.value === "("
          ? directCallArgumentRanges(tokens, index + 1)
          : Object.freeze([]);
      if (
        tokens[index - 1]?.value === "." ||
        tokens[index + 1]?.value !== "(" ||
        owner?.name !== call.containingFunction ||
        argumentRanges.length !== call.argumentPrefixes.length ||
        !call.argumentPrefixes.every((prefixTokens, argumentIndex) => {
          const range = argumentRanges[argumentIndex];
          return (
            range !== undefined &&
            argumentMatchesPrefix(tokens, range.start, prefixTokens) &&
            !expressionContainsTopLevelAlternative(tokens, range) &&
            (prefixTokens.length > 3 ||
              range.end - range.start === prefixTokens.length)
          );
        }) ||
        (call.beforePrefixes !== undefined &&
          !call.beforePrefixes.every((prefixTokens) =>
            hasDominatingProof(tokens, index, prefixTokens),
          )) ||
        (call.afterPrefixes !== undefined &&
          !call.afterPrefixes.every((prefixTokens) =>
            tokenSequenceExistsBetween(
              tokens,
              index + 1,
              owner?.closing ?? 0,
              prefixTokens,
            ),
          ))
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_lifecycle_unbound",
        );
      observed.set(symbol, (observed.get(symbol) ?? 0) + 1);
    }
    if (
      sourcePath === capability.leaf &&
      (shouldEnforceDeclaredGraph || declarationIndices.size > 0) &&
      (declarationIndices.size !== capability.calls.length ||
        capability.calls.some((call) => observed.get(call.symbol) !== 1))
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_child_lifecycle_unbound",
      );
  }
}

function assertProcessWrapperConsumerBoundary(
  relativePath: string,
  tokens: readonly SourceToken[],
  shouldEnforceDeclaredGraph: boolean,
) {
  const sourcePath = coordinatorRelativeSourcePath(relativePath);
  const importedIndices = new Map<string, Set<number>>();
  for (const declaration of moduleDeclarationsFromTokens(tokens)) {
    if (declaration.specifierIndex === null) continue;
    const specifier = tokens[declaration.specifierIndex];
    if (specifier?.kind !== "string" || !specifier.value.startsWith("."))
      continue;
    const resolved = canonicalRelativeModuleTarget(
      relativePath,
      specifier.value,
    );
    const target = resolved ? coordinatorRelativeSourcePath(resolved) : null;
    for (const [symbol, capability] of processWrapperConsumers) {
      if (target !== capability.target) continue;
      const relevantBindings = declaration.bindings.filter(
        (binding) => binding.imported === symbol || binding.local === symbol,
      );
      if (relevantBindings.length === 0) continue;
      const isAllowedConsumer = capability.uses.some(
        (use) => use.source === sourcePath,
      );
      if (declaration.kind !== "static_import" || !isAllowedConsumer)
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_unbound",
        );
      for (const binding of relevantBindings) {
        if (
          binding.typeOnly ||
          binding.imported !== symbol ||
          binding.local !== symbol
        )
          throw new Error(
            "platform_provisioner_runtime_dependency_child_process_unbound",
          );
        const indices = importedIndices.get(symbol) ?? new Set<number>();
        indices.add(binding.localTokenIndex);
        importedIndices.set(symbol, indices);
      }
    }
  }
  for (const [symbol, capability] of processWrapperConsumers) {
    const observed = new Map<ProcessWrapperUse, number>();
    let declarationCount = 0;
    for (let index = 0; index < tokens.length; index += 1) {
      if (
        tokens[index]?.kind !== "identifier" ||
        tokens[index]?.value !== symbol
      )
        continue;
      if (importedIndices.get(symbol)?.has(index)) continue;
      if (tokens[index - 1]?.value === "function") {
        if (
          sourcePath !== capability.target ||
          (capability.exported && tokens[index - 2]?.value !== "export") ||
          (!capability.exported && tokens[index - 2]?.value === "export")
        )
          throw new Error(
            "platform_provisioner_runtime_dependency_child_process_unbound",
          );
        declarationCount += 1;
        continue;
      }
      const owner = containingNamedFunction(tokens, index);
      const matchingTokens = capability.uses.filter((use) => {
        const symbolOffset = use.prefix.indexOf(symbol);
        return (
          use.source === sourcePath &&
          use.containingFunction === (owner?.name ?? null) &&
          symbolOffset >= 0 &&
          tokenSequenceMatches(tokens, index - symbolOffset, use.prefix)
        );
      });
      if (matchingTokens.length !== 1)
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_unbound",
        );
      const matched = matchingTokens[0] as ProcessWrapperUse;
      observed.set(matched, (observed.get(matched) ?? 0) + 1);
    }
    const expectedUses = capability.uses.filter(
      (use) => use.source === sourcePath,
    );
    if (
      (shouldEnforceDeclaredGraph &&
        sourcePath === capability.target &&
        declarationCount !== 1) ||
      (sourcePath !== capability.target &&
        expectedUses.length > 0 &&
        shouldEnforceDeclaredGraph &&
        (importedIndices.get(symbol)?.size ?? 0) !== 1) ||
      ((shouldEnforceDeclaredGraph || importedIndices.has(symbol)) &&
        expectedUses.some((use) => observed.get(use) !== 1))
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_child_process_unbound",
      );
  }
  if (
    shouldEnforceDeclaredGraph &&
    sourcePath === "src/security/docker-effect-runtime.ts"
  ) {
    const expectedOwners = new Set(["startCommand", "runShort"]);
    const observedOwners = new Set<string>();
    for (let index = 0; index < tokens.length; index += 1) {
      if (
        !tokenSequenceMatches(tokens, index, [
          "dependencies",
          ".",
          "startProcess",
          "(",
        ])
      )
        continue;
      const owner = containingNamedFunction(tokens, index);
      const argumentTokens = directCallArgumentRanges(tokens, index + 3);
      if (
        !owner ||
        !expectedOwners.has(owner.name) ||
        observedOwners.has(owner.name) ||
        argumentTokens.length !== 4 ||
        !exactExpressionMatches(tokens, argumentTokens[0], [
          "DOCKER_CLI_EXECUTABLE",
        ]) ||
        !prefixedArrayExpressionMatches(tokens, argumentTokens[1], [
          "[",
          "--host",
          ",",
          "DOCKER_ENGINE",
          ",",
          "--config",
        ]) ||
        !exactExpressionMatches(tokens, argumentTokens[2], [
          "createDockerProcessEnvironment",
          "(",
          ")",
        ]) ||
        !tokenSequenceExistsBetween(tokens, owner.opening, index, [
          "dependencies",
          ".",
          "verifyCli",
          "(",
          "context",
          ".",
          "cli",
          ")",
        ]) ||
        !tokenSequenceMatches(tokens, index - 3, ["const", "handle", "="]) ||
        !tokenSequenceExistsBetween(tokens, index, owner.closing, [
          "context",
          ".",
          "handles",
          ".",
          "add",
          "(",
          "handle",
          ")",
        ])
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_unbound",
        );
      observedOwners.add(owner.name);
    }
    if (
      observedOwners.size !== expectedOwners.size ||
      [...expectedOwners].some((owner) => !observedOwners.has(owner))
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_child_process_unbound",
      );
  }
}

function assertWorkerCreationImportBoundary(
  relativePath: string,
  tokens: readonly SourceToken[],
) {
  assertProtectedModuleSpecifierPositions(
    tokens,
    new Set([nodeWorkerThreadsSpecifier, bareWorkerThreadsSpecifier]),
    nodeWorkerThreadsSpecifier,
    "platform_provisioner_runtime_dependency_child_worker_unbound",
  );
  for (const declaration of moduleDeclarationsFromTokens(tokens)) {
    const specifier =
      declaration.specifierIndex === null
        ? undefined
        : tokens[declaration.specifierIndex];
    if (
      specifier?.kind !== "string" ||
      specifier.value !== nodeWorkerThreadsSpecifier
    )
      continue;
    const names = new Map(
      declaration.bindings.map((binding) => [
        binding.imported,
        binding.typeOnly,
      ]),
    );
    if (
      [...names.values()].every((isType) => isType) &&
      (declaration.kind === "static_import" || declaration.kind === "reexport")
    )
      continue;
    if (declaration.kind !== "static_import")
      throw new Error(
        "platform_provisioner_runtime_dependency_child_worker_unbound",
      );
    if (
      declaration.bindings.some(
        (binding) =>
          !binding.typeOnly &&
          (binding.imported === "default" ||
            binding.imported === "*" ||
            binding.local !== binding.imported),
      )
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_child_worker_unbound",
      );
    if (localTypeScriptChildModulePaths.has(relativePath)) {
      if (
        names.size !== 2 ||
        names.get("Worker") !== false ||
        names.get("WorkerOptions") !== true
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_worker_unbound",
        );
      continue;
    }
    if (
      [
        "src/security/candidate-store-lock-worker.ts",
        "40_Develop/coordinator/src/security/candidate-store-lock-worker.ts",
      ].includes(relativePath) &&
      names.size === 2 &&
      names.get("parentPort") === false &&
      names.get("workerData") === false
    )
      continue;
    throw new Error(
      "platform_provisioner_runtime_dependency_child_worker_unbound",
    );
  }
}

function assertNoUnboundRuntimeChildProcess(
  relativePath: string,
  tokens: readonly SourceToken[],
  shouldEnforceDeclaredGraph: boolean,
) {
  assertChildProcessModuleBoundary(tokens);
  const bindings = selectedScriptProcessBindings(tokens, false);
  const sourcePath = coordinatorRelativeSourcePath(relativePath);
  const exactExpectedTokens = exactExternalProcessCalls.filter(
    (callsite) => callsite.source === sourcePath,
  );
  const exactObserved = new Map<ExactExternalProcessCallGraph, number>();
  const expectedCallsites = runtimeExternalProcessCallsites.filter(
    (callsite) => callsite.source === sourcePath,
  );
  for (const imported of bindings.bindings.values()) {
    if (
      imported === "fork" ||
      !expectedCallsites.some((callsite) => callsite.primitive === imported)
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_child_process_unbound",
      );
  }
  const observedCallsites = new Map<RuntimeExternalProcessCallsite, number>();
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token?.kind !== "identifier") continue;
    const imported = bindings.bindings.get(token.value);
    if (!imported || bindings.declarationTokenIndices.has(index)) continue;
    if (tokens[index - 1]?.value === "." || tokens[index + 1]?.value !== "(")
      throw new Error(
        "platform_provisioner_runtime_dependency_child_process_unbound",
      );
    const owner = containingNamedFunction(tokens, index);
    const argumentRanges = directCallArgumentRanges(tokens, index + 1);
    const argumentShapeSha256 = createHash("sha256")
      .update(
        JSON.stringify(
          argumentRanges.map((range) =>
            tokens.slice(range.start, range.end).map((item) => item.value),
          ),
        ),
      )
      .digest("hex");
    const resultBinding =
      tokens[index - 1]?.value === "=" &&
      tokens[index - 2]?.kind === "identifier"
        ? (tokens[index - 2]?.value ?? null)
        : null;
    const functionBodySha256 = owner
      ? createHash("sha256")
          .update(
            JSON.stringify(
              tokens
                .slice(owner.opening, owner.closing + 1)
                .map((item) => item.value),
            ),
          )
          .digest("hex")
      : null;
    if (shouldEnforceDeclaredGraph) {
      const exactMatchingTokens = exactExpectedTokens.filter(
        (callsite) =>
          callsite.primitive === imported &&
          callsite.containingFunction === owner?.name &&
          callsite.argumentShapeSha256 === argumentShapeSha256 &&
          callsite.resultBinding === resultBinding,
      );
      if (exactMatchingTokens.length !== 1)
        throw new Error(
          `platform_provisioner_runtime_dependency_child_process_unbound:${sourcePath}:${owner?.name ?? "module"}:${imported}:${argumentShapeSha256}:${functionBodySha256 ?? "none"}:${resultBinding ?? "none"}`,
        );
      const exactMatched =
        exactMatchingTokens[0] as ExactExternalProcessCallGraph;
      const provenanceIdentity = `${exactMatched.source}\0${exactMatched.containingFunction}`;
      const provenance = exactExecutableProvenance.get(provenanceIdentity);
      if (!provenance)
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_executable_unbound",
        );
      const ownerEnd = owner?.closing ?? tokens.length;
      if (
        provenance.classification === "node_self" &&
        !exactExpressionMatches(tokens, argumentRanges[0], [
          "process",
          ".",
          "execPath",
        ])
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_executable_unbound",
        );
      if (
        provenance.classification !== "node_self" &&
        provenance.proofs.some(
          (proofTokens) =>
            !hasUniqueDominatingProof(tokens, index, proofTokens) &&
            !tokenSequenceExistsBetween(
              tokens,
              owner?.opening ?? 0,
              index,
              proofTokens,
            ),
        )
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_executable_unbound",
        );
      if (
        provenance.classification === "closed_wrapper_parameter" &&
        !processWrapperConsumers.has(exactMatched.containingFunction)
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_executable_unbound",
        );
      if (
        provenance.classification === "closed_verification_toolchain" &&
        !processWrapperConsumers.has("executeCommand")
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_executable_unbound",
        );
      if (exactMatched.primitive === "spawn") {
        const ownership = exactAsyncProcessOwnership.get(
          `${exactMatched.source}\0${exactMatched.containingFunction}`,
        );
        if (!ownership)
          throw new Error(
            `platform_provisioner_runtime_dependency_child_process_ownership_unbound:${exactMatched.source}:${exactMatched.containingFunction}`,
          );
        if (ownership.classification === "wrapper_return") {
          if (tokens[index - 1]?.value !== "return")
            throw new Error(
              `platform_provisioner_runtime_dependency_child_process_ownership_unbound:${exactMatched.source}:${exactMatched.containingFunction}`,
            );
        } else {
          if (!exactMatched.resultBinding)
            throw new Error(
              `platform_provisioner_runtime_dependency_child_process_ownership_unbound:${exactMatched.source}:${exactMatched.containingFunction}`,
            );
          const proofIndices = ownership.proofs.map((proofTokens) =>
            tokenSequenceIndicesBetween(
              tokens,
              index + 1,
              ownerEnd,
              proofTokens,
            ),
          );
          if (proofIndices.some((matches) => matches.length < 1))
            throw new Error(
              `platform_provisioner_runtime_dependency_child_process_ownership_unbound:${exactMatched.source}:${exactMatched.containingFunction}`,
            );
          const firstProof = Math.min(
            ...proofIndices.map((matches) => matches[0] as number),
          );
          if (
            tokenSequenceIndicesBetween(tokens, index + 1, firstProof, [
              "await",
            ]).length !== 0
          )
            throw new Error(
              `platform_provisioner_runtime_dependency_child_process_ownership_unbound:${exactMatched.source}:${exactMatched.containingFunction}`,
            );
        }
      }
      // The scope, argument, binding and ownership graph above are primary.
      // Exact body identity is retained only as supplementary tamper evidence.
      if (exactMatched.functionBodySha256 !== functionBodySha256)
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_unbound",
        );
      exactObserved.set(
        exactMatched,
        (exactObserved.get(exactMatched) ?? 0) + 1,
      );
    }
    const matchingTokens = expectedCallsites.filter(
      (callsite) =>
        callsite.primitive === imported &&
        callsite.containingFunction === owner?.name &&
        argumentRanges.length === callsite.argumentCount &&
        exactExpressionMatches(
          tokens,
          argumentRanges[0],
          callsite.executablePrefix,
        ) &&
        prefixedArrayExpressionMatches(
          tokens,
          argumentRanges[1],
          callsite.argvPrefix,
        ) &&
        (!callsite.authorityProof ||
          hasUniqueDominatingProof(tokens, index, callsite.authorityProof)),
    );
    if (matchingTokens.length !== 1)
      throw new Error(
        "platform_provisioner_runtime_dependency_child_process_unbound",
      );
    const matched = matchingTokens[0] as RuntimeExternalProcessCallsite;
    observedCallsites.set(matched, (observedCallsites.get(matched) ?? 0) + 1);
  }
  if (
    (shouldEnforceDeclaredGraph || bindings.bindings.size > 0) &&
    expectedCallsites.some((callsite) => observedCallsites.get(callsite) !== 1)
  )
    throw new Error(
      "platform_provisioner_runtime_dependency_child_process_unbound",
    );
  if (
    shouldEnforceDeclaredGraph &&
    exactExpectedTokens.some(
      (callsite) => exactObserved.get(callsite) !== callsite.occurrence,
    )
  )
    throw new Error(
      "platform_provisioner_runtime_dependency_child_process_unbound",
    );
}

export function runtimeNamedFunctionGraphSnapshotForVerification(
  relativePath: string,
  source: string | readonly SourceToken[],
  names: readonly string[],
) {
  const tokens =
    typeof source === "string"
      ? tokenizeTypeScriptModuleSyntax(source)
      : source;
  const requested = new Set(names);
  const functions: Array<
    Readonly<{
      name: string;
      bodySha256: string;
      bodyTokenCount: number;
      semanticGraphSha256: string;
      declarationOccurrence: number;
      lexicalScope: string;
      exported: boolean;
    }>
  > = [];
  const occurrences = new Map<string, number>();
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    if (
      tokens[index]?.kind !== "identifier" ||
      tokens[index]?.value !== "function" ||
      tokens[index + 1]?.kind !== "identifier" ||
      !requested.has(tokens[index + 1]?.value ?? "") ||
      tokens[index + 2]?.value !== "("
    )
      continue;
    const name = tokens[index + 1]?.value ?? "";
    const declarationOccurrence = (occurrences.get(name) ?? 0) + 1;
    occurrences.set(name, declarationOccurrence);
    const sourcePath = coordinatorRelativeSourcePath(relativePath);
    const expectedParent =
      auditedFunctionLexicalParents.get(`${sourcePath}\0${name}`) ?? null;
    const parent = containingNamedFunction(tokens, index);
    if ((parent?.name ?? null) !== expectedParent)
      throw new Error(
        `platform_provisioner_runtime_dependency_capability_graph_mismatch:${name}:scope:${parent?.name ?? "module"}`,
      );
    const isExported =
      tokens[index - 1]?.value === "export" ||
      (tokens[index - 1]?.value === "async" &&
        tokens[index - 2]?.value === "export");
    const isExpectedExported = auditedExportedFunctionIdentities.has(
      `${sourcePath}\0${name}`,
    );
    if (isExported !== isExpectedExported)
      throw new Error(
        `platform_provisioner_runtime_dependency_capability_graph_mismatch:${name}:export`,
      );
    const parametersEnd = matchingTokenIndex(tokens, index + 2, "(", ")");
    let bodyStart = parametersEnd + 1;
    while (bodyStart < tokens.length && tokens[bodyStart]?.value !== "{")
      bodyStart += 1;
    if (tokens[bodyStart]?.value !== "{")
      throw new Error(
        `platform_provisioner_runtime_dependency_parse_failed:${name}:body`,
      );
    const bodyEnd = matchingTokenIndex(tokens, bodyStart, "{", "}");
    const bodyTokens = tokens
      .slice(bodyStart, bodyEnd + 1)
      .map((token) => token.value);
    const graphNodes = bodyTokens.map((value, nodeIndex) =>
      Object.freeze({
        id: nodeIndex,
        kind: [
          "if",
          "else",
          "switch",
          "for",
          "while",
          "try",
          "catch",
          "finally",
        ].includes(value)
          ? "guard"
          : ["return", "throw"].includes(value)
            ? "completion"
            : ["const", "let", "var"].includes(value)
              ? "binding"
              : value === "await"
                ? "await"
                : value === "new"
                  ? "construct"
                  : "token",
        value,
      }),
    );
    const graphEdges: Array<
      Readonly<{ from: number; to: number; kind: string }>
    > = [];
    const delimiterStackTokens: Array<
      Readonly<{ node: number; closing: string }>
    > = [];
    const delimiterClosing = new Map([
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
    ]);
    for (let nodeIndex = 0; nodeIndex < bodyTokens.length; nodeIndex += 1) {
      if (nodeIndex > 0)
        graphEdges.push(
          Object.freeze({ from: nodeIndex - 1, to: nodeIndex, kind: "next" }),
        );
      const closing = delimiterClosing.get(bodyTokens[nodeIndex] ?? "");
      if (closing)
        delimiterStackTokens.push(Object.freeze({ node: nodeIndex, closing }));
      else if (delimiterStackTokens.at(-1)?.closing === bodyTokens[nodeIndex]) {
        const opening = delimiterStackTokens.pop();
        if (opening)
          graphEdges.push(
            Object.freeze({ from: opening.node, to: nodeIndex, kind: "pair" }),
          );
      }
      if (
        nodeIndex + 1 < bodyTokens.length &&
        bodyTokens[nodeIndex + 1] === "(" &&
        /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(bodyTokens[nodeIndex] ?? "")
      )
        graphEdges.push(
          Object.freeze({ from: nodeIndex, to: nodeIndex + 1, kind: "call" }),
        );
      if (
        ["const", "let", "var"].includes(bodyTokens[nodeIndex] ?? "") &&
        /^[A-Za-z_$][A-Za-z0-9_$]*$/u.test(bodyTokens[nodeIndex + 1] ?? "")
      )
        graphEdges.push(
          Object.freeze({
            from: nodeIndex,
            to: nodeIndex + 1,
            kind: "declares",
          }),
        );
      if (
        ["return", "throw"].includes(bodyTokens[nodeIndex] ?? "") &&
        nodeIndex + 1 < bodyTokens.length
      )
        graphEdges.push(
          Object.freeze({
            from: nodeIndex,
            to: nodeIndex + 1,
            kind: "completes_with",
          }),
        );
    }
    if (delimiterStackTokens.length !== 0)
      throw new Error(
        `platform_provisioner_runtime_dependency_parse_failed:${name}:semantic-graph`,
      );
    const semanticGraphSha256 = createHash("sha256")
      .update(
        JSON.stringify({
          scope: `${sourcePath}\0${expectedParent ?? "module"}\0${name}\0${declarationOccurrence}\0${isExported ? "exported" : "local"}`,
          nodes: graphNodes,
          edges: graphEdges,
        }),
      )
      .digest("hex");
    functions.push(
      Object.freeze({
        name,
        bodySha256: createHash("sha256")
          .update(JSON.stringify(bodyTokens))
          .digest("hex"),
        bodyTokenCount: bodyTokens.length,
        semanticGraphSha256,
        declarationOccurrence,
        lexicalScope: expectedParent ?? "module",
        exported: isExported,
      }),
    );
  }
  if (
    functions.length !== names.length ||
    names.some((name) => occurrences.get(name) !== 1)
  )
    throw new Error(
      "platform_provisioner_runtime_dependency_capability_graph_mismatch",
    );
  return Object.freeze(functions);
}

export function auditedFunctionSemanticGraphForVerification(
  relativePath: string,
  source: string,
) {
  const sourcePath = coordinatorRelativeSourcePath(relativePath);
  return runtimeNamedFunctionGraphSnapshotForVerification(
    relativePath,
    source,
    exactAuditedFunctionFlows
      .filter((flow) => flow.source === sourcePath)
      .map((flow) => flow.functionName),
  );
}

const protectedPreBodyEffectSymbols = Object.freeze(
  new Set([
    "readHiddenLine",
    "readFileSync",
    "createPrivateKey",
    "sign",
    "spawn",
    "spawnSync",
    "execFile",
    "execFileSync",
    "Worker",
  ]),
);

function assertNoAuditedPreBodyEffects(
  tokens: readonly SourceToken[],
  functionNames: ReadonlySet<string>,
) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (
      tokens[index]?.value === "function" &&
      functionNames.has(tokens[index + 1]?.value ?? "") &&
      tokens[index + 2]?.value === "("
    ) {
      const parametersEnd = matchingTokenIndex(tokens, index + 2, "(", ")");
      const parameterTokens = tokens.slice(index + 3, parametersEnd);
      if (
        parameterTokens.some((token) =>
          protectedPreBodyEffectSymbols.has(token.value),
        )
      )
        throw new Error(
          "platform_provisioner_runtime_dependency_capability_graph_mismatch",
        );
    }
    if (
      protectedPreBodyEffectSymbols.has(tokens[index]?.value ?? "") &&
      (tokens[index + 1]?.value === "(" ||
        (tokens[index - 1]?.value === "new" &&
          tokens[index + 1]?.value === "(")) &&
      containingNamedFunction(tokens, index) === null
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_capability_graph_mismatch",
      );
  }
}

function assertExactAuditedFunctionFlows(
  relativePath: string,
  tokens: readonly SourceToken[],
  shouldEnforceDeclaredGraph: boolean,
) {
  if (!shouldEnforceDeclaredGraph) return;
  const sourcePath = coordinatorRelativeSourcePath(relativePath);
  const expectedTokens = exactAuditedFunctionFlows.filter(
    (flow) => flow.source === sourcePath,
  );
  if (expectedTokens.length === 0) return;
  assertNoAuditedPreBodyEffects(
    tokens,
    new Set(expectedTokens.map((flow) => flow.functionName)),
  );
  const observedTokens = runtimeNamedFunctionGraphSnapshotForVerification(
    relativePath,
    tokens,
    expectedTokens.map((flow) => flow.functionName),
  );
  if (
    sourcePath !== "scripts/sign-release-manifest.ts" &&
    (expectedTokens.length !== observedTokens.length ||
      observedTokens.some(
        (flow) =>
          exactAuditedSemanticGraphSha256.get(`${sourcePath}\0${flow.name}`) !==
          flow.semanticGraphSha256,
      ))
  )
    throw new Error(
      "platform_provisioner_runtime_dependency_capability_flow_unbound",
    );
  // Exact body identity remains available in the returned diagnostic graph,
  // but it is evidence only. Safety acceptance is based on the structural
  // contracts above and the protected-path checks below.
}

function assertExactCapabilityGraphSourceUniverse(
  graph: RuntimeCapabilityGraphKind,
  sources: ReadonlySet<string>,
) {
  const expectedTokens = exactExternalProcessCalls.filter(
    (callsite) => callsite.graph === graph,
  );
  const expectedCount = graph === "runtime" ? 18 : 6;
  const stableIdentities = expectedTokens.map(
    (callsite) =>
      `${callsite.source}\u0000${callsite.containingFunction}\u0000${callsite.primitive}\u0000${callsite.occurrence}`,
  );
  const expectedFlowSources = exactAuditedFunctionFlows
    .filter((flow) => flow.graph === graph)
    .map((flow) => flow.source);
  const globalCallIdentities = exactExternalProcessCalls.map(
    (callsite) =>
      `${callsite.graph}\u0000${callsite.source}\u0000${callsite.containingFunction}\u0000${callsite.primitive}\u0000${callsite.occurrence}`,
  );
  const globalFlowIdentities = exactAuditedFunctionFlows.map(
    (flow) => `${flow.graph}\u0000${flow.source}\u0000${flow.functionName}`,
  );
  if (
    exactExternalProcessCalls.length !== 24 ||
    exactExecutableProvenance.size !== exactExternalProcessCalls.length ||
    exactExternalProcessCalls.some(
      (callsite) =>
        !exactExecutableProvenance.has(
          `${callsite.source}\0${callsite.containingFunction}`,
        ),
    ) ||
    exactAuditedSemanticGraphSha256.size !== exactAuditedFunctionFlows.length ||
    exactAuditedFunctionFlows.some(
      (flow) =>
        !exactAuditedSemanticGraphSha256.has(
          `${flow.source}\0${flow.functionName}`,
        ),
    ) ||
    new Set(globalCallIdentities).size !== globalCallIdentities.length ||
    new Set(globalFlowIdentities).size !== globalFlowIdentities.length ||
    expectedTokens.length !== expectedCount ||
    new Set(stableIdentities).size !== stableIdentities.length ||
    expectedTokens.some((callsite) => !sources.has(callsite.source)) ||
    expectedFlowSources.some((source) => !sources.has(source))
  )
    throw new Error(
      "platform_provisioner_runtime_dependency_capability_graph_mismatch",
    );
}

export function assertVerificationToolCapabilityGraphForVerification(
  sources: Readonly<Record<string, string>>,
) {
  const paths = Object.keys(sources).sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  for (const relativePath of paths) {
    if (!relativePath.startsWith("scripts/") || !relativePath.endsWith(".ts"))
      throw new Error(
        "platform_provisioner_runtime_dependency_capability_graph_mismatch",
      );
    staticRelativeModuleTargets(
      relativePath,
      Buffer.from(sources[relativePath] ?? "", "utf8"),
      true,
    );
  }
  assertExactCapabilityGraphSourceUniverse("verification_tool", new Set(paths));
}

function isAllowedExecPathUse(
  relativePath: string,
  tokens: readonly SourceToken[],
  index: number,
) {
  const sourcePath = coordinatorRelativeSourcePath(relativePath);
  if (
    sourcePath.startsWith("scripts/") &&
    runtimeChildProcessOwnerPrimitives.has(sourcePath) &&
    tokens[index - 2]?.value === "process" &&
    tokens[index - 1]?.value === "." &&
    tokens[index - 3]?.value === "(" &&
    runtimeChildProcessOwnerPrimitives
      .get(sourcePath)
      ?.has(tokens[index - 4]?.value ?? "")
  )
    return true;
  if (localTypeScriptChildModulePaths.has(relativePath))
    return tokenSequenceMatches(tokens, index - 2, [
      "process",
      ".",
      "execPath",
    ]);
  if (
    ["bin/launch.ts", "40_Develop/coordinator/bin/launch.ts"].includes(
      relativePath,
    )
  )
    return tokenSequenceMatches(tokens, index - 7, [
      "process",
      ".",
      "argv",
      "=",
      "[",
      "process",
      ".",
      "execPath",
      ",",
      "fileURLToPath",
      "(",
      "target",
      ")",
      ",",
    ]);
  if (
    [
      "src/security/docker-isolation.ts",
      "40_Develop/coordinator/src/security/docker-isolation.ts",
    ].includes(relativePath)
  )
    return tokenSequenceMatches(tokens, index - 4, [
      "startOwnedAttachedProcess",
      "(",
      "process",
      ".",
      "execPath",
      ",",
      "[",
      "-e",
      ",",
      "OWNED_ATTACH_FIXTURE_SOURCES",
      "[",
      "scenario",
      "]",
      "]",
      ",",
    ]);
  return false;
}

function assertNoUnboundRuntimeExecPath(
  relativePath: string,
  tokens: readonly SourceToken[],
) {
  for (let index = 0; index < tokens.length; index += 1) {
    if (tokens[index]?.value !== "execPath") continue;
    if (
      tokens[index]?.kind === "string" &&
      tokens[index - 1]?.value !== "[" &&
      !tokenSequenceMatches(tokens, index - 6, [
        "Reflect",
        ".",
        "get",
        "(",
        "process",
        ",",
        "execPath",
      ])
    )
      continue;
    if (!isAllowedExecPathUse(relativePath, tokens, index))
      throw new Error(
        "platform_provisioner_runtime_dependency_child_process_unbound",
      );
  }
}

const runtimePackageCapabilityExports = Object.freeze(
  new Set([
    "inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate",
    "inspectBundledCoordinatorPackageFilesystemCandidate",
    "inspectFixedDevelopmentCoordinatorPackageCandidate",
    "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
    "issueRuntimeOwnedVerifiedCoordinatorPackageCapability",
    "consumeRuntimeOwnedVerifiedCoordinatorPackageCapability",
    "revokeRuntimeOwnedVerifiedCoordinatorPackageCapability",
    "verifyInstalledCoordinatorPackageCandidate",
    "inspectVerifiedNativeDistributionCandidate",
  ]),
);

type RuntimePackageCapabilityConsumer = Readonly<{
  source: string;
  symbol: string;
  owner: string;
  use: "call" | "reference" | "type_query";
  occurrence: number;
}>;

function runtimePackageCapabilityConsumers(
  relativePath: string,
  tokens: readonly SourceToken[],
) {
  const source = coordinatorRelativeSourcePath(relativePath);
  if (source === "src/security/platform-provisioner-package-filesystem.ts")
    return Object.freeze([]);
  const resultTokens: RuntimePackageCapabilityConsumer[] = [];
  for (const declaration of moduleDeclarationsFromTokens(tokens)) {
    if (
      declaration.kind !== "static_import" ||
      declaration.specifierIndex === null
    )
      continue;
    const target = canonicalRelativeModuleTarget(
      relativePath,
      tokens[declaration.specifierIndex]?.value ?? "",
    );
    if (
      coordinatorRelativeSourcePath(target ?? "") !==
      "src/security/platform-provisioner-package-filesystem.ts"
    )
      continue;
    for (const binding of declaration.bindings) {
      if (
        binding.typeOnly ||
        !runtimePackageCapabilityExports.has(binding.imported)
      )
        continue;
      if (binding.local !== binding.imported)
        throw new Error(`consumer_import:${binding.imported}:alias`);
      let occurrence = 0;
      for (let index = 0; index < tokens.length; index += 1) {
        if (
          index === binding.localTokenIndex ||
          tokens[index]?.kind !== "identifier" ||
          tokens[index]?.value !== binding.local
        )
          continue;
        if (
          tokens[index - 1]?.value === "." ||
          tokens[index - 1]?.value === "?."
        )
          throw new Error(`consumer_import:${binding.imported}:property`);
        occurrence += 1;
        const owner = containingNamedFunction(tokens, index)?.name ?? "module";
        const use =
          tokens[index - 1]?.value === "typeof"
            ? "type_query"
            : tokens[index + 1]?.value === "("
              ? "call"
              : "reference";
        resultTokens.push(
          Object.freeze({
            source,
            symbol: binding.imported,
            owner,
            use,
            occurrence,
          }),
        );
      }
    }
  }
  return Object.freeze(resultTokens);
}

export function runtimePackageCapabilityConsumerGraphForVerification(
  sources: Readonly<Record<string, string>>,
) {
  return Object.freeze(
    Object.entries(sources)
      .flatMap(([relativePath, source]) =>
        runtimePackageCapabilityConsumers(
          relativePath,
          tokenizeTypeScriptModuleSyntax(source),
        ),
      )
      .sort((left, right) =>
        `${left.source}\0${left.symbol}\0${left.owner}\0${left.use}\0${left.occurrence}`.localeCompare(
          `${right.source}\0${right.symbol}\0${right.owner}\0${right.use}\0${right.occurrence}`,
          "en",
        ),
      ),
  );
}

const exactRuntimePackageCapabilityConsumers = Object.freeze(
  [
    [
      "bin/coordinator.ts",
      "issueRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "runTaskCommand",
      "call",
      1,
    ],
    [
      "scripts/promote-release-manifest.ts",
      "inspectVerifiedNativeDistributionCandidate",
      "expectedRelease",
      "call",
      1,
    ],
    [
      "scripts/promote-release-manifest.ts",
      "inspectVerifiedNativeDistributionCandidate",
      "productionComposition",
      "call",
      2,
    ],
    [
      "scripts/sign-release-manifest.ts",
      "inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate",
      "prepareReleaseManifestCandidate",
      "call",
      1,
    ],
    [
      "scripts/verify-project-runtime-real-providers.ts",
      "inspectBundledCoordinatorPackageFilesystemCandidate",
      "main",
      "call",
      1,
    ],
    [
      "scripts/verify-project-runtime-real-providers.ts",
      "inspectVerifiedNativeDistributionCandidate",
      "main",
      "call",
      1,
    ],
    [
      "scripts/verify-signed-general-task.ts",
      "issueRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "module",
      "reference",
      1,
    ],
    [
      "scripts/verify-signed-recovery-matrix.ts",
      "issueRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "verifySignedPackagePrerequisite",
      "call",
      1,
    ],
    [
      "src/composition/project-runtime-composition-root.ts",
      "issueRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "issueRuntimeExecutionAuthorization",
      "call",
      1,
    ],
    [
      "src/composition/project-runtime-composition-root.ts",
      "revokeRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "module",
      "reference",
      1,
    ],
    [
      "src/security/candidate-store-windows-adapter.ts",
      "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
      "inspectRuntimeOwnedWindowsProtectedRoot",
      "call",
      1,
    ],
    [
      "src/security/coordinator-task-runtime.ts",
      "consumeRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "startRuntimeOwnedCoordinatorTask",
      "call",
      1,
    ],
    [
      "src/security/development-measurement-session.ts",
      "inspectFixedDevelopmentCoordinatorPackageCandidate",
      "observeProduction",
      "call",
      1,
    ],
    [
      "src/security/development-measurement-session.ts",
      "inspectVerifiedNativeDistributionCandidate",
      "module",
      "type_query",
      1,
    ],
    [
      "src/security/development-measurement-session.ts",
      "inspectVerifiedNativeDistributionCandidate",
      "observeProduction",
      "call",
      2,
    ],
    [
      "src/security/docker-desktop-runtime-repair.ts",
      "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
      "preparedBoundary",
      "call",
      1,
    ],
    [
      "src/security/docker-recovery-runtime-internal.ts",
      "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
      "prepareRuntimeOwnedDockerRestart",
      "call",
      2,
    ],
    [
      "src/security/docker-recovery-runtime-internal.ts",
      "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
      "recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart",
      "call",
      3,
    ],
    [
      "src/security/docker-recovery-runtime-internal.ts",
      "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
      "recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart",
      "call",
      1,
    ],
    [
      "src/security/local-personal-authority-runtime.ts",
      "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
      "verifyRelease",
      "call",
      1,
    ],
    [
      "src/security/provider-home-windows-adapter.ts",
      "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
      "inspectRuntimeOwnedWindowsProviderHomeCandidate",
      "call",
      1,
    ],
  ].map(
    ([source, symbol, owner, use, occurrence]) =>
      Object.freeze({
        source,
        symbol,
        owner,
        use,
        occurrence,
      }) as RuntimePackageCapabilityConsumer,
  ),
);

function runtimePackageCapabilityConsumerIdentity(
  consumer: RuntimePackageCapabilityConsumer,
) {
  return `${consumer.source}\0${consumer.symbol}\0${consumer.owner}\0${consumer.use}\0${consumer.occurrence}`;
}

function assertRuntimePackageCapabilityHandoffClosure(
  sources: Readonly<Record<string, string>>,
) {
  const exact = (
    relativePath: string,
    sequenceTokens: readonly string[],
    reason: string,
  ) => {
    const source = sources[relativePath];
    if (typeof source !== "string")
      throw new Error(`consumer_handoff:${reason}:source`);
    const tokens = tokenizeTypeScriptModuleSyntax(source);
    const matches = tokenSequenceIndicesBetween(
      tokens,
      0,
      tokens.length,
      sequenceTokens,
    );
    if (matches.length !== 1)
      throw new Error(`consumer_handoff:${reason}:shape`);
    return Object.freeze({ tokens, index: matches[0] as number });
  };
  exact(
    "src/composition/project-runtime-composition-root.ts",
    [
      "issueRuntimeCapability",
      ":",
      "runtimeDependencies",
      ".",
      "issueRuntimeExecutionAuthorization",
    ],
    "composition_issue",
  );
  exact(
    "src/composition/project-runtime-composition-root.ts",
    [
      "revokeRuntimeCapability",
      ":",
      "runtimeDependencies",
      ".",
      "revokeRuntimeExecutionAuthorization",
    ],
    "composition_revoke",
  );
  exact(
    "src/security/project-runtime-execution-authorization-adapter.ts",
    [
      "const",
      "capability",
      "=",
      "dependencies",
      ".",
      "issueRuntimeCapability",
      "(",
      ")",
    ],
    "adapter_issue",
  );
  exact(
    "src/security/project-runtime-execution-authorization-adapter.ts",
    [
      "status",
      ":",
      "completed",
      "as",
      "const",
      ",",
      "reason",
      ":",
      "project_runtime_execution_authorization_issued",
      ",",
      "value",
      ":",
      "capability",
    ],
    "adapter_issue_projection",
  );
  exact(
    "src/security/project-runtime-execution-authorization-adapter.ts",
    [
      "dependencies",
      ".",
      "revokeRuntimeCapability",
      "?.",
      "(",
      "capability",
      ")",
      "=",
      "=",
      "=",
      "true",
    ],
    "adapter_revoke",
  );
  exact(
    "src/security/project-runtime-execution-authorization-adapter.ts",
    [
      "reason",
      ":",
      "project_runtime_execution_authorization_revoked",
      ",",
      "value",
      ":",
      "null",
    ],
    "adapter_revoke_projection",
  );
  exact(
    "40_Develop/project-runtime/src/application/project-runtime-execution.ts",
    [
      "const",
      "issuedAuthorization",
      "=",
      "dependencies",
      ".",
      "authorization",
      ".",
      "issue",
      "(",
    ],
    "project_runtime_issue",
  );
  exact(
    "40_Develop/project-runtime/src/application/project-runtime-execution.ts",
    [
      "const",
      "runtimeExecutionCapability",
      "=",
      "issuedAuthorization",
      ".",
      "status",
      "=",
      "=",
      "=",
      "completed",
      "?",
      "issuedAuthorization",
      ".",
      "value",
      ":",
      "null",
    ],
    "project_runtime_issue_result",
  );
  exact(
    "40_Develop/project-runtime/src/application/project-runtime-execution.ts",
    [
      "dependencies",
      ".",
      "authorization",
      ".",
      "revokeUnused",
      "(",
      "runtimeExecutionCapability",
      ",",
      ")",
    ],
    "project_runtime_revoke",
  );
  exact(
    "40_Develop/project-runtime/src/application/project-runtime-execution.ts",
    [
      "runtimeExecutionCapability",
      ",",
      "taskRequest",
      ":",
      "attempt",
      ".",
      "execution",
      ".",
      "taskRequest",
    ],
    "project_runtime_execution_handoff",
  );
  const consumed = exact(
    "src/security/coordinator-task-runtime.ts",
    [
      "consumeRuntimeOwnedVerifiedCoordinatorPackageCapability",
      "(",
      "verifiedPackageCapability",
      ",",
      ")",
    ],
    "coordinator_consume",
  );
  const firstEffect = exact(
    "src/security/coordinator-task-runtime.ts",
    ["return", "productionRuntime", ".", "start", "("],
    "coordinator_first_effect",
  );
  const allProductionStarts = tokenSequenceIndicesBetween(
    firstEffect.tokens,
    0,
    firstEffect.tokens.length,
    ["productionRuntime", ".", "start", "("],
  );
  if (
    consumed.index >= firstEffect.index ||
    allProductionStarts.length !== 1 ||
    allProductionStarts[0] !== firstEffect.index + 1 ||
    containingNamedFunction(consumed.tokens, consumed.index)?.name !==
      "startRuntimeOwnedCoordinatorTask" ||
    containingNamedFunction(firstEffect.tokens, firstEffect.index)?.name !==
      "startRuntimeOwnedCoordinatorTask"
  )
    throw new Error("consumer_handoff:coordinator_dominance");
}

function assertReleaseAssuranceConsumerClosure(
  sources: Readonly<Record<string, string>>,
) {
  const exact = (
    relativePath: string,
    sequenceTokens: readonly string[],
    reason: string,
    owners?: readonly string[],
  ) => {
    const source = sources[relativePath];
    if (typeof source !== "string")
      throw new Error(`assurance_consumer:${reason}:source`);
    const tokens = tokenizeTypeScriptModuleSyntax(source);
    const matches = tokenSequenceIndicesBetween(
      tokens,
      0,
      tokens.length,
      sequenceTokens,
    );
    if (
      owners
        ? matches.length !== owners.length ||
          owners.some(
            (owner) =>
              matches.filter(
                (index) =>
                  containingNamedFunction(tokens, index)?.name === owner,
              ).length !== 1,
          )
        : matches.length !== 1
    )
      throw new Error(`assurance_consumer:${reason}:shape`);
  };

  exact(
    "scripts/promote-release-manifest.ts",
    [
      "runtimeExecutionIdentitySha256",
      ":",
      "payload",
      ".",
      "runtimeExecutionIdentitySha256",
    ],
    "promotion_canonical_identity",
  );
  exact(
    "scripts/promote-release-manifest.ts",
    ["expectedRelease", ":", "release", ".", "expected"],
    "promotion_installed_observation",
  );
  exact(
    "scripts/promote-release-manifest.ts",
    ["sourceCommit", ":", "release", ".", "expected", ".", "crddCommit"],
    "promotion_public_result",
  );
  exact(
    "src/security/docker-recovery-runtime-internal.ts",
    ["crddManifestHash", ":", "verification", ".", "manifestHash"],
    "recovery_manifest_identity",
  );
  exact(
    "src/security/docker-recovery-runtime-internal.ts",
    [
      "runtimeExecutionIdentitySha256",
      ":",
      "verification",
      ".",
      "runtimeExecutionIdentitySha256",
    ],
    "recovery_runtime_identity",
    [
      "recoverRuntimeOwnedDockerTaskAfterVerifiedDockerDesktopRestart",
      "prepareRuntimeOwnedDockerRestart",
      "recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart",
    ],
  );
  for (const field of [
    "runtimeOwnedReleaseTrustConfirmed",
    "runtimeExecutionIdentityRuntimeOwned",
    "crddDistributionConfirmed",
  ]) {
    exact(
      "src/security/docker-recovery-runtime-internal.ts",
      ["verification", ".", field, "!", "=", "=", "true"],
      `restart_verified_${field}`,
      [
        "prepareRuntimeOwnedDockerRestart",
        "recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart",
      ],
    );
  }
  exact(
    "src/security/docker-recovery-runtime-internal.ts",
    [
      "return",
      "recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver",
      "(",
      "parsed",
      ".",
      "token",
    ],
    "restart_recovery_effect_entry",
    ["recoverRuntimeOwnedDockerTaskAfterRecordedEngineRestart"],
  );
  exact(
    "src/security/docker-recovery-runtime-internal.ts",
    [
      "const",
      "result",
      "=",
      "recoverRuntimeOwnedDockerTaskFromVerifiedRootWithObserver",
      "(",
      "parsed",
      ".",
      "token",
    ],
    "recovery_effect_entry",
  );
}

function assertExactRuntimePackageCapabilityConsumerGraph(
  sources: Readonly<Record<string, string>>,
  scope: "repository" | "runtime_distribution",
) {
  assertRuntimePackageCapabilityHandoffClosure(sources);
  assertReleaseAssuranceConsumerClosure(sources);
  const observedTokens =
    runtimePackageCapabilityConsumerGraphForVerification(sources);
  const expectedTokens = exactRuntimePackageCapabilityConsumers.filter(
    (consumer) =>
      scope === "repository" ||
      consumer.source !== "scripts/verify-project-runtime-real-providers.ts",
  );
  const observedIdentities = observedTokens.map(
    runtimePackageCapabilityConsumerIdentity,
  );
  const expectedIdentities = expectedTokens.map(
    runtimePackageCapabilityConsumerIdentity,
  );
  if (
    new Set(expectedIdentities).size !== expectedIdentities.length ||
    observedIdentities.length !== expectedIdentities.length ||
    observedIdentities.some(
      (identity, index) => identity !== expectedIdentities[index],
    )
  ) {
    const observedSet = new Set(observedIdentities);
    const expectedSet = new Set(expectedIdentities);
    const missingTokens = expectedIdentities.filter(
      (identity) => !observedSet.has(identity),
    );
    const unexpectedTokens = observedIdentities.filter(
      (identity) => !expectedSet.has(identity),
    );
    throw new Error(
      `consumer_set:mismatch:missing=${JSON.stringify(missingTokens)}:unexpected=${JSON.stringify(unexpectedTokens)}`,
    );
  }
}

export function runtimePackageCapabilityConsumerGraphDiagnosticForVerification(
  sources: Readonly<Record<string, string>>,
): ProtectedPathDiagnostic {
  try {
    assertExactRuntimePackageCapabilityConsumerGraph(sources, "repository");
    return Object.freeze({
      status: "accepted",
      phase: "consumer_graph",
      reason: "runtime_package_capability_consumer_graph_closed",
      publicReason: null,
      runtimeExecution: "not_performed",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown";
    return Object.freeze({
      status: "blocked",
      phase: reason.split(":", 1)[0] ?? "consumer_graph",
      reason,
      publicReason:
        "platform_provisioner_runtime_dependency_consumer_graph_mismatch",
      runtimeExecution: "not_performed",
    });
  }
}

export function assertRuntimePackageCapabilityConsumerGraphForVerification(
  sources: Readonly<Record<string, string>>,
) {
  const diagnostic =
    runtimePackageCapabilityConsumerGraphDiagnosticForVerification(sources);
  if (diagnostic.status === "blocked")
    throw new Error(
      `platform_provisioner_runtime_dependency_consumer_graph_mismatch:${diagnostic.reason}`,
    );
}

function assertPublicRuntimeObservationConsumerClosure(
  relativePath: string,
  tokens: readonly SourceToken[],
  shouldEnforceDeclaredGraph: boolean,
) {
  if (
    !shouldEnforceDeclaredGraph ||
    coordinatorRelativeSourcePath(relativePath) !==
      "src/security/platform-provisioner-package-filesystem.ts"
  )
    return;
  const expected = Object.freeze([
    [
      "observeRuntimeDistribution",
      "inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate",
      ["distributionRoot"],
    ],
    [
      "observeRuntimeDistribution",
      "inspectBundledCoordinatorPackageFilesystemCandidate",
      ["bundledDistributionRoot"],
    ],
    [
      "observeRuntimeDistribution",
      "inspectFixedDevelopmentCoordinatorPackageCandidate",
      ["root", ".", "realPath"],
    ],
    [
      "observeRuntimeDistribution",
      "inspectFixedDevelopmentCoordinatorPackageCandidate",
      ["root", ".", "realPath"],
    ],
    [
      "observeRuntimeDistribution",
      "verifyOwnedBundledManifest",
      ["bundledDistributionRoot"],
    ],
    [
      "observeRuntimeDistribution",
      "verifyInstalledCoordinatorPackageCandidate",
      ["distributionRoot", ".", "realPath"],
    ],
    [
      "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
      "issueRuntimeOwnedVerifiedCoordinatorPackageCapability",
      ["input"],
    ],
    [
      "verifyBundledCoordinatorPackageFromFixedManifestCandidate",
      "consumeRuntimeOwnedVerifiedCoordinatorPackageCapability",
      [
        "{",
        "evaluationTime",
        ":",
        "new",
        "Date",
        "(",
        ")",
        ".",
        "toISOString",
        "(",
        ")",
        ",",
        "}",
      ],
    ],
    [
      "verifyInstalledCoordinatorPackageCandidate",
      "inspectVerifiedNativeDistributionCandidate",
      ["request"],
    ],
    [
      "verifyInstalledCoordinatorPackageCandidate",
      "inspectVerifiedNativeDistributionCandidate",
      ["request"],
    ],
  ] as const);
  const remainingTokens = [...expected];
  const symbols = new Set(expected.map(([symbol]) => symbol));
  for (let index = 0; index < tokens.length; index += 1) {
    const symbol = tokens[index]?.value ?? "";
    if (
      tokens[index]?.kind !== "identifier" ||
      !symbols.has(symbol as never) ||
      tokens[index - 1]?.value === "function"
    )
      continue;
    if (
      tokens[index - 1]?.value === "typeof" &&
      symbol === "verifyBundledCoordinatorPackageFromFixedManifestCandidate"
    )
      continue;
    if (tokens[index - 1]?.value === "." || tokens[index + 1]?.value !== "(")
      throw new Error(
        "platform_provisioner_runtime_dependency_public_consumer_unbound",
      );
    const owner = containingNamedFunction(tokens, index)?.name ?? null;
    let ranges: readonly DirectCallArgumentRange[];
    try {
      ranges = directCallArgumentRanges(tokens, index + 1);
    } catch {
      throw new Error(
        `platform_provisioner_runtime_dependency_public_consumer_unbound:${symbol}:${index}`,
      );
    }
    const matchingIndex = remainingTokens.findIndex(
      ([expectedSymbol, expectedOwner, argument]) =>
        symbol === expectedSymbol &&
        owner === expectedOwner &&
        ranges.length === 1 &&
        exactExpressionMatches(tokens, ranges[0], argument),
    );
    if (matchingIndex < 0)
      throw new Error(
        "platform_provisioner_runtime_dependency_public_consumer_unbound",
      );
    remainingTokens.splice(matchingIndex, 1);
  }
  if (remainingTokens.length !== 0)
    throw new Error(
      "platform_provisioner_runtime_dependency_public_consumer_unbound",
    );
}

type ProtectedPathDiagnostic = Readonly<{
  status: "accepted" | "blocked";
  phase: string;
  reason: string;
  publicReason: string | null;
  runtimeExecution: "not_performed";
}>;

function namedFunctionBodyRange(
  tokens: readonly SourceToken[],
  functionName: string,
) {
  const matches: Array<Readonly<{ opening: number; closing: number }>> = [];
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    if (
      tokens[index]?.value !== "function" ||
      tokens[index + 1]?.value !== functionName ||
      tokens[index + 2]?.value !== "(" ||
      containingNamedFunction(tokens, index) !== null
    )
      continue;
    const parametersEnd = matchingTokenIndex(tokens, index + 2, "(", ")");
    let opening = parametersEnd + 1;
    while (opening < tokens.length && tokens[opening]?.value !== "{")
      opening += 1;
    if (tokens[opening]?.value !== "{") continue;
    matches.push(
      Object.freeze({
        opening,
        closing: matchingTokenIndex(tokens, opening, "{", "}"),
      }),
    );
  }
  if (matches.length !== 1)
    throw new Error(`declaration:${functionName}_not_unique`);
  return matches[0] as Readonly<{ opening: number; closing: number }>;
}

function directProtectedCall(
  tokens: readonly SourceToken[],
  symbol: string,
  owner: string,
  prefixTokens: readonly string[],
  argumentShapes: readonly (readonly string[])[],
) {
  const matches: number[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    if (
      tokens[index]?.value !== symbol ||
      tokens[index + 1]?.value !== "(" ||
      tokens[index - 1]?.value === "." ||
      (containingNamedFunction(tokens, index)?.name ?? "module") !== owner
    )
      continue;
    if (
      prefixTokens.length > index ||
      prefixTokens.some(
        (value, offset) =>
          tokens[index - prefixTokens.length + offset]?.value !== value,
      )
    )
      continue;
    const ranges = directCallArgumentRanges(tokens, index + 1);
    if (
      ranges.length === argumentShapes.length &&
      ranges.every((range, offset) =>
        exactExpressionMatches(
          tokens,
          range,
          argumentShapes[offset] as readonly string[],
        ),
      )
    )
      matches.push(index);
  }
  if (matches.length !== 1) throw new Error(`call_graph:${owner}:${symbol}`);
  return matches[0] as number;
}

function assertReleaseSigningProtectedPath(source: string) {
  const tokens = tokenizeTypeScriptModuleSyntax(source);
  const protectedImports = Object.freeze(
    new Map<string, readonly string[]>([
      ["node:crypto", ["createPrivateKey", "createPublicKey", "sign"]],
      [
        "../src/security/git-object-reader.ts",
        ["inspectGitCommitTreeCandidate"],
      ],
      ["./generate-release-key.ts", ["readHiddenLine"]],
      [
        "./release-staging-manifest.ts",
        [
          "beginReleaseStagingManifestSession",
          "placeReleaseStagingManifestCandidate",
          "verifyReleaseStagingManifestSession",
        ],
      ],
      [
        "../src/security/platform-provisioner-package-filesystem.ts",
        ["inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate"],
      ],
      [
        "../src/security/platform-provisioner-release-identity.ts",
        ["inspectPlatformProvisionerReleaseIdentityCandidate"],
      ],
      [
        "../src/security/platform-provisioner-policy-identity.ts",
        ["getPlatformProvisionerPolicyIdentity"],
      ],
      [
        "../src/security/platform-provisioner-release-trust.ts",
        ["getPinnedPlatformProvisionerReleaseSignerSpkiDer"],
      ],
      [
        "../src/security/platform-provisioner-trust-core.ts",
        [
          "compilePlatformProvisionerManifestPayloadCandidate",
          "calculateRuntimeExecutionIdentityCandidate",
        ],
      ],
      [
        "../src/security/provisioning-signature-primitives.ts",
        ["canonicalizeProvisioningJsonValueCandidate"],
      ],
    ] as const),
  );
  const protectedBindings = new Map<string, number>();
  for (const declaration of moduleDeclarationsFromTokens(tokens)) {
    if (declaration.kind !== "static_import") continue;
    const specifier =
      declaration.specifierIndex === null
        ? null
        : (tokens[declaration.specifierIndex]?.value ?? null);
    const requiredTokens =
      specifier === null ? undefined : protectedImports.get(specifier);
    for (const binding of declaration.bindings) {
      if (!requiredTokens?.includes(binding.imported as never)) continue;
      if (binding.typeOnly || binding.local !== binding.imported)
        throw new Error(`import_binding:${binding.imported}`);
      if (protectedBindings.has(binding.imported))
        throw new Error(`import_binding:${binding.imported}_duplicate`);
      protectedBindings.set(binding.imported, binding.localTokenIndex);
    }
  }
  for (const requiredTokens of protectedImports.values())
    for (const symbol of requiredTokens)
      if (!protectedBindings.has(symbol))
        throw new Error(`import_binding:${symbol}_missing`);

  const filesystemImports = moduleDeclarationsFromTokens(tokens).filter(
    (declaration) =>
      declaration.kind === "static_import" &&
      declaration.specifierIndex !== null &&
      tokens[declaration.specifierIndex]?.value === "node:fs",
  );
  if (
    filesystemImports.length !== 1 ||
    filesystemImports[0]?.bindings.length !== 1 ||
    filesystemImports[0]?.bindings[0]?.imported !== "default" ||
    filesystemImports[0]?.bindings[0]?.local !== "fs"
  )
    throw new Error("import_binding:fs");
  const filesystemBindingIndex = filesystemImports[0]?.bindings[0]
    ?.localTokenIndex as number;
  const filesystemMethodsByOwner = new Map<string, ReadonlySet<string>>([
    [
      "stableExternalFile",
      new Set([
        "lstatSync",
        "realpathSync",
        "constants",
        "openSync",
        "fstatSync",
        "readSync",
        "closeSync",
      ]),
    ],
    [
      "repositoryLocalDistributionRoot",
      new Set(["lstatSync", "realpathSync", "existsSync"]),
    ],
  ]);
  for (let index = 0; index < tokens.length; index += 1) {
    if (index === filesystemBindingIndex || tokens[index]?.value !== "fs")
      continue;
    const owner = containingNamedFunction(tokens, index)?.name ?? "module";
    const method = tokens[index + 2]?.value ?? "";
    if (
      tokens[index + 1]?.value !== "." ||
      !filesystemMethodsByOwner.get(owner)?.has(method)
    )
      throw new Error(`binding_use:fs:${owner}`);
  }

  for (const functionName of [
    "prepareReleaseManifestCandidate",
    "preflightReleaseManifest",
    "signReleaseManifest",
    "main",
  ])
    namedFunctionBodyRange(tokens, functionName);

  const permittedOwners = new Map<string, ReadonlySet<string>>([
    [
      "inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate",
      new Set(["prepareReleaseManifestCandidate"]),
    ],
    [
      "inspectPlatformProvisionerReleaseIdentityCandidate",
      new Set(["prepareReleaseManifestCandidate"]),
    ],
    ["inspectGitCommitTreeCandidate", new Set(["verifyCommitTreeBinding"])],
    [
      "getPlatformProvisionerPolicyIdentity",
      new Set(["prepareReleaseManifestCandidate"]),
    ],
    [
      "calculateRuntimeExecutionIdentityCandidate",
      new Set(["prepareReleaseManifestCandidate"]),
    ],
    [
      "compilePlatformProvisionerManifestPayloadCandidate",
      new Set(["prepareReleaseManifestCandidate"]),
    ],
    [
      "beginReleaseStagingManifestSession",
      new Set(["prepareReleaseManifestCandidate"]),
    ],
    [
      "verifyReleaseStagingManifestSession",
      new Set(["prepareReleaseManifestCandidate", "signReleaseManifest"]),
    ],
    ["readHiddenLine", new Set(["main"])],
    ["createPrivateKey", new Set(["signReleaseManifest"])],
    ["createPublicKey", new Set(["signReleaseManifest"])],
    [
      "getPinnedPlatformProvisionerReleaseSignerSpkiDer",
      new Set(["signReleaseManifest"]),
    ],
    [
      "canonicalizeProvisioningJsonValueCandidate",
      new Set(["signReleaseManifest"]),
    ],
    ["sign", new Set(["signReleaseManifest"])],
    ["placeReleaseStagingManifestCandidate", new Set(["signReleaseManifest"])],
  ]);
  const expectedProtectedImportUseCount = new Map<string, number>([
    ["inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate", 1],
    ["inspectPlatformProvisionerReleaseIdentityCandidate", 1],
    ["inspectGitCommitTreeCandidate", 1],
    ["getPlatformProvisionerPolicyIdentity", 1],
    ["calculateRuntimeExecutionIdentityCandidate", 1],
    ["compilePlatformProvisionerManifestPayloadCandidate", 1],
    ["beginReleaseStagingManifestSession", 1],
    ["verifyReleaseStagingManifestSession", 1],
    ["readHiddenLine", 1],
    ["createPrivateKey", 1],
    ["createPublicKey", 1],
    ["getPinnedPlatformProvisionerReleaseSignerSpkiDer", 1],
    ["canonicalizeProvisioningJsonValueCandidate", 1],
    ["sign", 1],
    ["placeReleaseStagingManifestCandidate", 1],
  ]);
  for (const [symbol, bindingIndex] of protectedBindings) {
    let useCount = 0;
    for (let index = 0; index < tokens.length; index += 1) {
      if (index === bindingIndex || tokens[index]?.value !== symbol) continue;
      useCount += 1;
      const owner = containingNamedFunction(tokens, index)?.name ?? "module";
      if (
        !permittedOwners.get(symbol)?.has(owner) ||
        tokens[index - 1]?.value === "." ||
        tokens[index + 1]?.value !== "("
      )
        throw new Error(`binding_use:${symbol}:${owner}`);
    }
    if (useCount !== expectedProtectedImportUseCount.get(symbol))
      throw new Error(`binding_use:${symbol}:count`);
  }

  const p = directProtectedCall(
    tokens,
    "preflightReleaseManifest",
    "main",
    ["const", "preflight", "="],
    [["options"]],
  );
  const secret = directProtectedCall(
    tokens,
    "readHiddenLine",
    "main",
    ["const", "passphrase", "=", "await"],
    [["Release key passphrase: "]],
  );
  const s = directProtectedCall(
    tokens,
    "signReleaseManifest",
    "main",
    ["const", "result", "="],
    [["preflight", ".", "authorization"], ["passphrase"]],
  );
  if (!(p < secret && secret < s)) throw new Error("dominance:p_secret_s");
  const mainInvocation = directProtectedCall(
    tokens,
    "main",
    "module",
    ["await"],
    [],
  );
  if (
    !tokenSequenceMatches(tokens, mainInvocation - 3, [
      "try",
      "{",
      "await",
      "main",
      "(",
      ")",
      ";",
      "}",
      "catch",
      "(",
    ])
  )
    throw new Error("call_graph:module:main_guard");

  const pPrepare = directProtectedCall(
    tokens,
    "prepareReleaseManifestCandidate",
    "preflightReleaseManifest",
    [],
    [["snapshot"]],
  );
  const sPrepare = directProtectedCall(
    tokens,
    "prepareReleaseManifestCandidate",
    "signReleaseManifest",
    [],
    [["options"]],
  );
  const releaseIdentity = directProtectedCall(
    tokens,
    "inspectPlatformProvisionerReleaseIdentityCandidate",
    "prepareReleaseManifestCandidate",
    ["const", "releaseIdentity", "="],
    [["distributionRoot"], ["options", ".", "crddTree"]],
  );
  const commitTree = directProtectedCall(
    tokens,
    "verifyCommitTreeBinding",
    "prepareReleaseManifestCandidate",
    [],
    [
      ["options", ".", "crddCommit"],
      ["options", ".", "crddTree"],
    ],
  );
  const stagingVerification = directProtectedCall(
    tokens,
    "verifyReleaseStagingManifestSession",
    "prepareReleaseManifestCandidate",
    [],
    [["platformAccessObservation", ".", "token"]],
  );
  const policyIdentity = directProtectedCall(
    tokens,
    "getPlatformProvisionerPolicyIdentity",
    "prepareReleaseManifestCandidate",
    ["const", "policyIdentity", "="],
    [],
  );
  const uniqueOwnedCallIndex = (
    symbol: string,
    owner: string,
    prefixTokens: readonly string[],
  ) => {
    const matches = tokenSequenceIndicesBetween(tokens, 0, tokens.length, [
      ...prefixTokens,
      symbol,
      "(",
    ]).filter(
      (index) =>
        containingNamedFunction(tokens, index + prefixTokens.length)?.name ===
        owner,
    );
    if (matches.length !== 1) throw new Error(`call_graph:${owner}:${symbol}`);
    return (matches[0] as number) + prefixTokens.length;
  };
  const runtimeIdentity = uniqueOwnedCallIndex(
    "calculateRuntimeExecutionIdentityCandidate",
    "prepareReleaseManifestCandidate",
    ["const", "runtimeExecutionIdentity", "="],
  );
  const compiledPayload = uniqueOwnedCallIndex(
    "compilePlatformProvisionerManifestPayloadCandidate",
    "prepareReleaseManifestCandidate",
    ["const", "compiled", "="],
  );
  const keyRead = directProtectedCall(
    tokens,
    "stableExternalFile",
    "signReleaseManifest",
    ["privateKeyBytes", "="],
    [["options", ".", "privateKeyPath"], ["MAXIMUM_PRIVATE_KEY_BYTES"]],
  );
  const passphrase = directProtectedCall(
    tokens,
    "signingPassphrase",
    "signReleaseManifest",
    ["const", "passphrase", "="],
    [["rawPassphrase"]],
  );
  const signature = directProtectedCall(
    tokens,
    "sign",
    "signReleaseManifest",
    ["const", "signature", "="],
    [["null"], ["compiled", ".", "message"], ["privateKey"]],
  );
  const pinnedSigner = directProtectedCall(
    tokens,
    "getPinnedPlatformProvisionerReleaseSignerSpkiDer",
    "signReleaseManifest",
    ["const", "pinnedSpki", "="],
    [],
  );
  const canonicalEnvelope = directProtectedCall(
    tokens,
    "canonicalizeProvisioningJsonValueCandidate",
    "signReleaseManifest",
    ["const", "canonical", "="],
    [["envelope"]],
  );
  const placement = directProtectedCall(
    tokens,
    "placeReleaseStagingManifestCandidate",
    "signReleaseManifest",
    ["const", "placement", "="],
    [
      ["platformAccessObservation", ".", "token"],
      ["canonical", ".", "canonicalBytes"],
    ],
  );
  if (
    !(
      releaseIdentity < commitTree &&
      commitTree < stagingVerification &&
      policyIdentity < runtimeIdentity &&
      runtimeIdentity < compiledPayload &&
      sPrepare < passphrase &&
      passphrase < keyRead &&
      keyRead < pinnedSigner &&
      keyRead < signature &&
      signature < canonicalEnvelope &&
      canonicalEnvelope < placement &&
      signature < placement
    )
  )
    throw new Error("dominance:key_signature_placement");

  const expectedLocalCalls = new Map<string, ReadonlySet<number>>([
    ["preflightReleaseManifest", new Set([p])],
    ["signReleaseManifest", new Set([s])],
    ["prepareReleaseManifestCandidate", new Set([pPrepare, sPrepare])],
    ["stableExternalFile", new Set([keyRead])],
    ["signingPassphrase", new Set([passphrase])],
    ["verifyCommitTreeBinding", new Set([commitTree])],
    ["main", new Set([mainInvocation])],
  ]);
  for (const [symbol, expectedIndices] of expectedLocalCalls) {
    const observedTokens: number[] = [];
    for (let index = 0; index < tokens.length; index += 1) {
      if (
        tokens[index]?.value === symbol &&
        tokens[index - 1]?.value !== "function"
      )
        observedTokens.push(index);
    }
    if (
      observedTokens.length !== expectedIndices.size ||
      observedTokens.some((index) => !expectedIndices.has(index))
    )
      throw new Error(`local_binding_use:${symbol}`);
  }

  const prepareRange = namedFunctionBodyRange(
    tokens,
    "prepareReleaseManifestCandidate",
  );
  const signingRange = namedFunctionBodyRange(tokens, "signReleaseManifest");
  const requireSingleFieldEdge = (
    range: Readonly<{ opening: number; closing: number }>,
    sequenceTokens: readonly string[],
    name: string,
    expectedCount = 1,
  ) => {
    if (
      tokenSequenceIndicesBetween(
        tokens,
        range.opening,
        range.closing,
        sequenceTokens,
      ).length !== expectedCount
    )
      throw new Error(`field_provenance:${name}`);
  };
  for (const [name, sequence, expectedCount] of [
    [
      "package_content_root_to_payload",
      [
        "packageContentRootSha256",
        ":",
        "packageObservation",
        ".",
        "packageContentRootSha256",
      ],
      2,
    ],
    [
      "runtime_identity_to_payload",
      [
        "runtimeExecutionIdentitySha256",
        ":",
        "runtimeExecutionIdentity",
        ".",
        "runtimeExecutionIdentitySha256",
      ],
      1,
    ],
    [
      "platform_artifact_to_payload",
      [
        "platformAccessArtifact",
        ":",
        "platformAccessObservation",
        ".",
        "platformAccessArtifact",
      ],
      2,
    ],
  ] as const)
    requireSingleFieldEdge(prepareRange, sequence, name, expectedCount);

  for (const [name, sequence] of [
    [
      "compiled_payload_to_envelope",
      ["payload", ":", "compiled", ".", "payload"],
    ],
    [
      "package_content_root_to_result",
      [
        "packageContentRootSha256",
        ":",
        "packageObservation",
        ".",
        "packageContentRootSha256",
      ],
    ],
    [
      "runtime_identity_to_result",
      [
        "runtimeExecutionIdentitySha256",
        ":",
        "compiled",
        ".",
        "payload",
        ".",
        "runtimeExecutionIdentitySha256",
      ],
    ],
    [
      "platform_artifact_to_result",
      [
        "platformAccessExecutableSha256",
        ":",
        "platformAccessObservation",
        ".",
        "platformAccessArtifact",
        ".",
        "sha256",
      ],
    ],
    [
      "signature_to_envelope",
      ["signature", ":", "signature", ".", "toString", "(", "base64url", ")"],
    ],
  ] as const)
    requireSingleFieldEdge(signingRange, sequence, name);

  assertExactAuditedFunctionFlows(
    "scripts/sign-release-manifest.ts",
    tokens,
    true,
  );
}

export function releaseSigningProtectedPathDiagnosticForVerification(
  source: string,
): ProtectedPathDiagnostic {
  try {
    assertReleaseSigningProtectedPath(source);
    return Object.freeze({
      status: "accepted",
      phase: "protected_path",
      reason: "release_signing_protected_path_closed",
      publicReason: null,
      runtimeExecution: "not_performed",
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown";
    const separator = detail.indexOf(":");
    return Object.freeze({
      status: "blocked",
      phase: separator < 0 ? "protected_path" : detail.slice(0, separator),
      reason: detail,
      publicReason:
        "platform_provisioner_runtime_dependency_signing_consumer_unbound",
      runtimeExecution: "not_performed",
    });
  }
}

export function assertReleaseSigningConsumerClosureForVerification(
  source: string,
) {
  const diagnostic =
    releaseSigningProtectedPathDiagnosticForVerification(source);
  if (diagnostic.status === "blocked")
    throw new Error(
      "platform_provisioner_runtime_dependency_signing_consumer_unbound",
    );
}

function staticRelativeModuleTargets(
  relativePath: string,
  bytes: Buffer,
  shouldEnforceDeclaredGraph = true,
) {
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
    for (const specifier of moduleSpecifiersFromTokens(relativePath, tokens)) {
      if (specifier.escaped)
        throw new Error("platform_provisioner_runtime_dependency_noncanonical");
      const target = canonicalRelativeModuleTarget(
        relativePath,
        specifier.value,
      );
      if (target) targets.push(target);
    }
    targets.push(...selectedScriptChildModuleTargets(relativePath, tokens));
    targets.push(
      ...declaredLocalTypeScriptChildTargets(relativePath, tokens).map(
        (declaration) => declaration.target,
      ),
    );
    assertNoUndeclaredLocalTypeScriptImportMetaUrl(relativePath, tokens);
    assertInternalLifecycleConsumerBoundary(
      relativePath,
      tokens,
      shouldEnforceDeclaredGraph,
    );
    assertProcessWrapperConsumerBoundary(
      relativePath,
      tokens,
      shouldEnforceDeclaredGraph,
    );
    assertWorkerCreationImportBoundary(relativePath, tokens);
    assertNoUnboundRuntimeChildProcess(
      relativePath,
      tokens,
      shouldEnforceDeclaredGraph,
    );
    assertNoUnboundRuntimeExecPath(relativePath, tokens);
    assertPublicRuntimeObservationConsumerClosure(
      relativePath,
      tokens,
      shouldEnforceDeclaredGraph,
    );
    assertExactAuditedFunctionFlows(
      relativePath,
      tokens,
      shouldEnforceDeclaredGraph,
    );
  } catch (error) {
    throw new Error(`${relativePath}:modules:${String(error)}`);
  }
  return Object.freeze(targets);
}

export function assertRuntimeSourceModuleBoundaryForVerification(
  relativePath: string,
  source: string,
) {
  staticRelativeModuleTargets(relativePath, Buffer.from(source, "utf8"), false);
}

export function assertRuntimeSourceDeclaredGraphBoundaryForVerification(
  relativePath: string,
  source: string,
) {
  staticRelativeModuleTargets(relativePath, Buffer.from(source, "utf8"), true);
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
  const shouldEnforceDeclaredGraph = fs.existsSync(
    path.join(
      packageRoot,
      "src",
      "security",
      "platform-provisioner-package-filesystem.ts",
    ),
  );
  const scriptPaths = new Set<string>();
  const pendingItems: string[] = [];
  if (fs.existsSync(path.join(packageRoot, "bin", "launch.ts"))) {
    verifyLauncherEntryBindings(packageRoot);
    for (const entry of Object.values(COORDINATOR_LAUNCH_ENTRIES)) {
      const target = canonicalRelativeModuleTarget(
        RUNTIME_EXECUTION_LAUNCHER_PATH,
        entry,
      );
      if (!target) {
        throw new Error("platform_provisioner_launch_entry_invalid");
      }
      const rootSegment = target.split("/")[0];
      if (rootSegment === "scripts") pendingItems.push(target);
      else if (!rootSegment || !runtimeExecutionDirectories.has(rootSegment)) {
        throw new Error(
          "platform_provisioner_runtime_dependency_outside_execution_set",
        );
      }
    }
  }
  if (
    fs.existsSync(
      path.join(
        packageRoot,
        "src",
        "core",
        "runtime-local-typescript-child-entrypoints.ts",
      ),
    )
  ) {
    for (const entrypoint of runtimeLocalTypescriptChildEntrypoints) {
      const target = coordinatorPackageRelativePath(
        entrypoint.distributionRelativePath,
      );
      if (target.startsWith("scripts/")) pendingItems.push(target);
    }
  }
  while (pendingItems.length > 0) {
    const relative = pendingItems.shift();
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
      shouldEnforceDeclaredGraph,
    )) {
      const rootSegment = target.split("/")[0];
      if (rootSegment === "scripts") pendingItems.push(target);
      else if (!rootSegment || !runtimeExecutionDirectories.has(rootSegment)) {
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
  shouldEnforceDeclaredGraph: boolean,
) {
  for (const target of staticRelativeModuleTargets(
    relativePath,
    bytes,
    shouldEnforceDeclaredGraph,
  )) {
    const rootSegment = target.split("/")[0];
    if (
      target === ".." ||
      target.startsWith("../") ||
      !rootSegment ||
      (!runtimeExecutionDirectories.has(rootSegment) &&
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
  const shouldEnforceDeclaredGraph = fs.existsSync(
    path.join(
      root.realPath,
      "src",
      "security",
      "platform-provisioner-package-filesystem.ts",
    ),
  );
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
        const isIncluded = entry.isDirectory()
          ? runtimeExecutionDirectories.has(entry.name) ||
            (entry.name === "scripts" && scriptPaths.size > 0)
          : runtimeExecutionRootFiles.has(entry.name);
        if (!isIncluded) continue;
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
    enforceDeclaredGraph: shouldEnforceDeclaredGraph,
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
      inventory.enforceDeclaredGraph,
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

const RUNTIME_SIBLING_COMPONENTS = Object.freeze([
  Object.freeze({
    sourcePrefix: "40_Develop/mcp/src/",
    packagePath: "40_Develop/mcp/package.json",
    packageName: "@qual-lab/crdd-mcp",
  }),
  Object.freeze({
    sourcePrefix: "40_Develop/project-runtime/src/",
    packagePath: "40_Develop/project-runtime/package.json",
    packageName: "@qual-lab/crdd-project-runtime",
  }),
  Object.freeze({
    sourcePrefix: "40_Develop/execution-intelligence/src/",
    packagePath: "40_Develop/execution-intelligence/package.json",
    packageName: "@qual-lab/crdd-execution-intelligence",
  }),
]);
const runtimeDistributionEntrypoints = Object.freeze(
  new Set(["template/tools/crdd-coordinator.ts", "template/tools/crdd-mcp.ts"]),
);

function runtimeLocalNodeChildTargets(
  observedFiles: ReadonlyMap<
    string,
    Readonly<{
      byteLength: number;
      sha256: string;
      identity: EntityIdentity;
      bytes: Buffer;
    }>
  >,
) {
  const declarations = new Map<
    string,
    Readonly<{ role: string; kind: "worker" | "spawn"; target: string }>
  >();
  const declaredTargets = new Set<string>();
  const usedRoleKinds = new Set<string>();
  for (const [relativePath, artifact] of observedFiles) {
    if (!relativePath.endsWith(".ts")) continue;
    const source = new TextDecoder("utf-8", { fatal: true }).decode(
      artifact.bytes,
    );
    const tokens = tokenizeTypeScriptModuleSyntax(source);
    for (const declaration of declaredLocalTypeScriptChildTargets(
      relativePath,
      tokens,
    )) {
      if (
        declarations.has(declaration.role) ||
        declaredTargets.has(declaration.target)
      )
        throw new Error(
          "platform_provisioner_runtime_child_entrypoint_registry_mismatch",
        );
      declarations.set(declaration.role, declaration);
      declaredTargets.add(declaration.target);
    }
    for (const use of usedLocalTypeScriptChildRoleKinds(relativePath, tokens))
      usedRoleKinds.add(`${use.role}\0${use.kind}`);
  }
  return Object.freeze({ declarations, usedRoleKinds });
}

function sameStringSet(left: ReadonlySet<string>, right: ReadonlySet<string>) {
  return (
    left.size === right.size && [...left].every((value) => right.has(value))
  );
}

function coordinatorPackageRelativePath(distributionRelativePath: string) {
  if (!distributionRelativePath.startsWith(COORDINATOR_DISTRIBUTION_PREFIX))
    throw new Error("platform_provisioner_runtime_required_artifact_invalid");
  const packageRelativePath = distributionRelativePath.slice(
    COORDINATOR_DISTRIBUTION_PREFIX.length,
  );
  if (
    packageRelativePath.length === 0 ||
    packageRelativePath.startsWith("/") ||
    path.posix.normalize(packageRelativePath) !== packageRelativePath
  )
    throw new Error("platform_provisioner_runtime_required_artifact_invalid");
  return packageRelativePath;
}

function resolveRuntimeDistributionRequiredArtifacts(
  observedFiles: ReadonlyMap<
    string,
    Readonly<{
      byteLength: number;
      sha256: string;
      identity: EntityIdentity;
      bytes: Buffer;
    }>
  >,
) {
  const observedLocalNodeChildren = runtimeLocalNodeChildTargets(observedFiles);
  const expectedLocalNodeChildren = new Map(
    runtimeLocalTypescriptChildEntrypoints.map((entrypoint) => [
      entrypoint.role,
      entrypoint,
    ]),
  );
  const expectedLocalNodeChildUses = new Set(
    runtimeLocalTypescriptChildEntrypoints.map(
      (entrypoint) => `${entrypoint.role}\0${entrypoint.kind}`,
    ),
  );
  if (
    expectedLocalNodeChildren.size !==
      observedLocalNodeChildren.declarations.size ||
    [...expectedLocalNodeChildren].some(([role, expected]) => {
      const observed = observedLocalNodeChildren.declarations.get(role);
      return (
        !observed ||
        observed.kind !== expected.kind ||
        observed.target !== expected.distributionRelativePath
      );
    }) ||
    !sameStringSet(
      expectedLocalNodeChildUses,
      observedLocalNodeChildren.usedRoleKinds,
    )
  )
    throw new Error(
      "platform_provisioner_runtime_child_entrypoint_registry_mismatch",
    );
  const resolvedByRole = new Map<
    string,
    Readonly<{
      role: string;
      distributionRelativePath: string;
      packageRelativePath: string;
      sha256: string;
    }>
  >();
  const requiredEntrypoints = runtimeDistributionRequiredEntrypoints.map(
    (entrypoint) => {
      const artifact = observedFiles.get(entrypoint.distributionRelativePath);
      if (!artifact || resolvedByRole.has(entrypoint.role))
        throw new Error(
          "platform_provisioner_runtime_required_artifact_missing",
        );
      const resolved = Object.freeze({
        role: entrypoint.role,
        distributionRelativePath: entrypoint.distributionRelativePath,
        packageRelativePath: coordinatorPackageRelativePath(
          entrypoint.distributionRelativePath,
        ),
        sha256: artifact.sha256,
      });
      resolvedByRole.set(entrypoint.role, resolved);
      return resolved;
    },
  );
  const interactiveConsoleReader = resolvedByRole.get(
    "interactive_console_reader",
  );
  if (!interactiveConsoleReader)
    throw new Error("platform_provisioner_runtime_required_artifact_missing");
  return Object.freeze({
    interactiveConsoleReader,
    requiredEntrypoints: Object.freeze(requiredEntrypoints),
  });
}

function isBundledRuntimeExecutionPath(
  relativePath: string,
  coordinatorPaths: ReadonlySet<string>,
  reachedComponentMetadata: ReadonlySet<string>,
) {
  return (
    coordinatorPaths.has(relativePath) ||
    runtimeDistributionEntrypoints.has(relativePath) ||
    reachedComponentMetadata.has(relativePath) ||
    RUNTIME_SIBLING_COMPONENTS.some((component) =>
      relativePath.startsWith(component.sourcePrefix),
    )
  );
}

function runtimeSiblingComponentForSource(relativePath: string) {
  return RUNTIME_SIBLING_COMPONENTS.find((component) =>
    relativePath.startsWith(component.sourcePrefix),
  );
}

function verifyRuntimeSiblingPackageMetadata(
  relativePath: string,
  bytes: Buffer,
) {
  const component = RUNTIME_SIBLING_COMPONENTS.find(
    (candidate) => candidate.packagePath === relativePath,
  );
  if (!component)
    throw new Error("platform_provisioner_package_metadata_invalid");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (source.charCodeAt(0) === 0xfeff)
    throw new Error("platform_provisioner_package_metadata_invalid");
  const parsed: unknown = JSON.parse(source);
  if (
    parsed === null ||
    typeof parsed !== "object" ||
    Array.isArray(parsed) ||
    Object.getPrototypeOf(parsed) !== Object.prototype
  )
    throw new Error("platform_provisioner_package_metadata_invalid");
  const metadata = parsed as Readonly<Record<string, unknown>>;
  if (
    metadata.name !== component.packageName ||
    typeof metadata.version !== "string" ||
    metadata.private !== true ||
    metadata.type !== "module"
  )
    throw new Error("platform_provisioner_package_metadata_invalid");
}

/**
 * Observe the real execution closure after Runtime responsibility separation.
 * The Coordinator remains the primary package, while sibling components are
 * included only when they are reached by canonical static imports.
 */
function observeRuntimeDistribution(distributionRootPath: string) {
  const distributionRoot = directoryIdentity(distributionRootPath);
  const developRoot = directoryIdentity(
    path.join(distributionRoot.realPath, "40_Develop"),
  );
  const coordinatorRoot = directoryIdentity(
    path.join(developRoot.realPath, "coordinator"),
  );
  const coordinatorInventory = packageEntries(coordinatorRoot);
  const coordinatorPaths = new Set(
    coordinatorInventory.files.map(
      (relative) => `40_Develop/coordinator/${relative}`,
    ),
  );
  const pendingPaths = [...coordinatorPaths, ...runtimeDistributionEntrypoints];
  const reachedComponentMetadata = new Set<string>();
  const observedFiles = new Map<
    string,
    Readonly<{
      byteLength: number;
      sha256: string;
      identity: EntityIdentity;
      bytes: Buffer;
    }>
  >();
  let packageByteLength = 0;

  while (pendingPaths.length > 0) {
    const relative = pendingPaths.shift();
    if (!relative || observedFiles.has(relative)) continue;
    const component = runtimeSiblingComponentForSource(relative);
    if (component && !reachedComponentMetadata.has(component.packagePath)) {
      reachedComponentMetadata.add(component.packagePath);
      pendingPaths.push(component.packagePath);
    }
    if (
      !isBundledRuntimeExecutionPath(
        relative,
        coordinatorPaths,
        reachedComponentMetadata,
      )
    ) {
      throw new Error(
        "platform_provisioner_runtime_dependency_outside_execution_set",
      );
    }
    const maximum =
      relative === "40_Develop/coordinator/package.json"
        ? MAXIMUM_PACKAGE_JSON_BYTES
        : MAXIMUM_PACKAGE_BYTES - packageByteLength;
    if (maximum < 0) {
      throw new Error("platform_provisioner_package_budget_exceeded");
    }
    const observed = readStableFile(
      path.join(distributionRoot.realPath, ...relative.split("/")),
      maximum,
    );
    const canonicalBytes = canonicalPackageFileContent(
      relative,
      observed.bytes,
    );
    if (reachedComponentMetadata.has(relative))
      verifyRuntimeSiblingPackageMetadata(relative, canonicalBytes);
    packageByteLength += canonicalBytes.byteLength;
    if (packageByteLength > MAXIMUM_PACKAGE_BYTES) {
      throw new Error("platform_provisioner_package_budget_exceeded");
    }
    observedFiles.set(
      relative,
      Object.freeze({
        byteLength: canonicalBytes.byteLength,
        sha256: createHash("sha256").update(canonicalBytes).digest("hex"),
        identity: observed.identity,
        bytes: canonicalBytes,
      }),
    );
    for (const target of staticRelativeModuleTargets(
      relative,
      canonicalBytes,
      true,
    )) {
      if (
        !isBundledRuntimeExecutionPath(
          target,
          coordinatorPaths,
          reachedComponentMetadata,
        )
      ) {
        throw new Error(
          "platform_provisioner_runtime_dependency_outside_execution_set",
        );
      }
      if (!observedFiles.has(target)) pendingPaths.push(target);
    }
    if (observedFiles.size > MAXIMUM_FILES) {
      throw new Error("platform_provisioner_package_file_count_exceeded");
    }
  }

  const observedCapabilitySources = new Set(
    [...observedFiles.keys()].map(coordinatorRelativeSourcePath),
  );
  assertExactCapabilityGraphSourceUniverse(
    "runtime",
    observedCapabilitySources,
  );
  assertExactRuntimePackageCapabilityConsumerGraph(
    Object.freeze(
      Object.fromEntries(
        [...observedFiles.entries()]
          .filter(([relativePath]) => relativePath.endsWith(".ts"))
          .map(([relativePath, observed]) => [
            coordinatorRelativeSourcePath(relativePath),
            new TextDecoder("utf-8", { fatal: true }).decode(observed.bytes),
          ]),
      ),
    ),
    "runtime_distribution",
  );

  const packageJson = observedFiles.get("40_Develop/coordinator/package.json");
  const metadata = packageMetadata(packageJson?.bytes ?? null);
  for (const [relative, first] of observedFiles) {
    const second = readStableFile(
      path.join(distributionRoot.realPath, ...relative.split("/")),
      MAXIMUM_PACKAGE_BYTES,
    );
    const canonicalBytes = canonicalPackageFileContent(relative, second.bytes);
    if (
      !sameIdentity(first.identity, second.identity) ||
      canonicalBytes.byteLength !== first.byteLength ||
      createHash("sha256").update(canonicalBytes).digest("hex") !== first.sha256
    ) {
      throw new Error("platform_provisioner_package_file_changed");
    }
  }
  for (const inventory of coordinatorInventory.directoryInventories) {
    verifyDirectory(inventory.directory);
    const current = readDirectoryEntrySnapshot(inventory.directory.realPath);
    if (!sameDirectoryEntries(inventory.entries, current.entries)) {
      throw new Error("platform_provisioner_package_root_changed");
    }
  }
  verifyDirectory(coordinatorRoot);
  verifyDirectory(developRoot);
  verifyDirectory(distributionRoot);

  const files = [...observedFiles.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([relative, file]) =>
      Object.freeze({
        path: relative,
        byteLength: file.byteLength,
        sha256: file.sha256,
      }),
    );
  const observation: PackageObservation = Object.freeze({
    ...metadata,
    files: Object.freeze(files),
  });
  const contentRoot =
    calculatePlatformProvisionerPackageContentRootCandidate(observation);
  if (contentRoot.status !== "candidate") {
    throw new Error("platform_provisioner_package_content_invalid");
  }
  const requiredArtifacts =
    resolveRuntimeDistributionRequiredArtifacts(observedFiles);
  return Object.freeze({
    observation,
    packageByteLength,
    contentRoot,
    requiredArtifacts,
    permissionPolicyConfirmed: false,
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

export function inspectPlatformProvisionerRuntimeDistributionFilesystemCandidate(
  distributionRoot: unknown,
) {
  try {
    if (
      typeof distributionRoot !== "string" ||
      distributionRoot.length === 0 ||
      !path.isAbsolute(distributionRoot) ||
      path.normalize(distributionRoot) !== distributionRoot
    ) {
      return blocked("platform_provisioner_distribution_root_invalid");
    }
    return publicObservation(
      observeRuntimeDistribution(distributionRoot),
      false,
    );
  } catch {
    return blocked("platform_provisioner_distribution_filesystem_invalid");
  }
}

export function inspectBundledCoordinatorPackageFilesystemCandidate() {
  try {
    return publicObservation(
      observeRuntimeDistribution(bundledDistributionRoot),
      true,
    );
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
      typeof input.expectedPackageContentRootSha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(input.expectedPackageContentRootSha256)
    )
      return blocked("development_package_input_invalid");

    const root = directoryIdentity(input.distributionRoot);
    const observed = observeRuntimeDistribution(root.realPath);
    const manifestPath = path.join(
      root.realPath,
      ...PLATFORM_PROVISIONER_MANIFEST_RELATIVE_PATH.split("/"),
    );
    let releaseManifestPresent = false;
    try {
      fs.lstatSync(manifestPath);
      releaseManifestPresent = true;
    } catch (error) {
      if (
        !error ||
        typeof error !== "object" ||
        !("code" in error) ||
        error.code !== "ENOENT"
      )
        throw error;
    }
    if (
      observed.contentRoot.packageContentRootSha256 !==
      input.expectedPackageContentRootSha256
    )
      return blocked("development_package_identity_mismatch");
    // A signed manifest changes a repository-contained runtime from a
    // development source into a release distribution. Native artifacts are
    // ordinary signed-tree entries and may be present in either source kind.
    if (releaseManifestPresent)
      return blocked("development_package_release_artifact_present");

    const entrypoints = observed.requiredArtifacts.requiredEntrypoints;
    const reobserved = observeRuntimeDistribution(root.realPath);
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
          observed.contentRoot.packageContentRootSha256,
        ]),
        "utf8",
      )
      .digest("hex");
    return Object.freeze({
      ...publicObservation(observed, false),
      reason: "fixed_development_package_observed_authorization_required",
      executionSourceKind: "fixed_development_candidate" as const,
      sourceIdentitySha256,
      entrypoints: Object.freeze(
        entrypoints.map((entrypoint) =>
          Object.freeze({
            relativePath: entrypoint.packageRelativePath,
            sha256: entrypoint.sha256,
          }),
        ),
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
  const observed = observeRuntimeDistribution(bundledDistributionRoot);
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
    const interactiveConsoleReaderArtifact =
      observed.requiredArtifacts.interactiveConsoleReader;
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

export function revokeRuntimeOwnedVerifiedCoordinatorPackageCapability(
  capability: unknown,
) {
  return verifiedPackageCapabilityState.revoke(capability);
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
    const observed = observeRuntimeDistribution(distributionRoot.realPath);
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
      "closed_public_launchers_coordinator_package_and_transitively_reached_sibling_sources_with_package_metadata",
    requiredArtifactResolution:
      "single_distribution_root_relative_registry_atomically_resolved_non_nullable_and_consumed_without_path_reinterpretation",
    localNodeChildEntrypointRegistration:
      "declared_role_kind_path_actual_canonical_wrapper_call_sites_and_required_registry_exactly_match_with_runtime_kind_validation",
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

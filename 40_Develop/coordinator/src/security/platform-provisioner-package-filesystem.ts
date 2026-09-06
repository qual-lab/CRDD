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
const RUNTIME_LOCAL_TYPESCRIPT_CHILD_ENTRYPOINTS =
  runtimeLocalTypeScriptChildRegistrySnapshotForPackageObserver();
const RUNTIME_DISTRIBUTION_REQUIRED_ENTRYPOINTS = Object.freeze([
  Object.freeze({
    role: "public_cli",
    distributionRelativePath: `${COORDINATOR_DISTRIBUTION_PREFIX}bin/coordinator.ts`,
  }),
  ...RUNTIME_LOCAL_TYPESCRIPT_CHILD_ENTRYPOINTS.map((entrypoint) =>
    Object.freeze({
      role: entrypoint.role,
      distributionRelativePath: entrypoint.distributionRelativePath,
    }),
  ),
]);
const RUNTIME_DISTRIBUTION_LOCAL_NODE_CHILD_ROLES = Object.freeze(
  new Set<string>(
    RUNTIME_LOCAL_TYPESCRIPT_CHILD_ENTRYPOINTS.map(
      (entrypoint) => entrypoint.role,
    ),
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

const NODE_CHILD_PROCESS_SPECIFIER = ["node:", "child_", "process"].join("");
const BARE_CHILD_PROCESS_SPECIFIER = ["child_", "process"].join("");
const NODE_WORKER_THREADS_SPECIFIER = ["node:", "worker_", "threads"].join("");
const BARE_WORKER_THREADS_SPECIFIER = ["worker_", "threads"].join("");

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
  let lineBreakBeforeNextToken = false;
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
        lineBreakBefore: lineBreakBeforeNextToken,
      }),
    );
    lineBreakBeforeNextToken = false;
  };

  const scan = (start: number, shouldStopAtTemplateExpressionEnd: boolean) => {
    let index = start;
    let braceDepth = 0;
    while (index < source.length) {
      const character = source[index] as string;
      const next = source[index + 1];
      if (/\s/u.test(character)) {
        if (character === "\n" || character === "\r")
          lineBreakBeforeNextToken = true;
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
        if (lineEnd !== -1) lineBreakBeforeNextToken = true;
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
          lineBreakBeforeNextToken = true;
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
  wholeTypeOnly: boolean,
) {
  const bindings: ModuleDeclarationBinding[] = [];
  let cursor = openingBrace + 1;
  while (cursor < closingBrace) {
    if (tokens[cursor]?.value === ",") {
      cursor += 1;
      continue;
    }
    const inlineTypeOnly = tokens[cursor]?.value === "type";
    if (inlineTypeOnly) cursor += 1;
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
        typeOnly: wholeTypeOnly || inlineTypeOnly,
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
      const wholeTypeOnly = tokens[cursor]?.value === "type";
      if (wholeTypeOnly) cursor += 1;
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
            typeOnly: wholeTypeOnly,
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
            typeOnly: wholeTypeOnly,
            localTokenIndex: cursor + 2,
          }),
        );
        cursor += 3;
      } else if (tokens[cursor]?.value === "{") {
        const closing = matchingTokenIndex(tokens, cursor, "{", "}");
        bindings.push(
          ...namedModuleBindings(tokens, cursor, closing, wholeTypeOnly),
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
          wholeTypeOnly,
          bindings: Object.freeze(bindings),
        }),
      );
      index = cursor + 1;
    } else if (token.value === "export") {
      let cursor = index + 1;
      const wholeTypeOnly = tokens[cursor]?.value === "type";
      if (wholeTypeOnly) cursor += 1;
      if (tokens[cursor]?.value !== "*" && tokens[cursor]?.value !== "{")
        continue;
      let bindings: readonly ModuleDeclarationBinding[] = Object.freeze([]);
      if (tokens[cursor]?.value === "{") {
        const closing = matchingTokenIndex(tokens, cursor, "{", "}");
        bindings = namedModuleBindings(tokens, cursor, closing, wholeTypeOnly);
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
          wholeTypeOnly,
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
      .some((token) => token.value === NODE_WORKER_THREADS_SPECIFIER)
      ? "platform_provisioner_runtime_dependency_child_worker_unbound"
      : "platform_provisioner_runtime_dependency_child_process_unbound";
  const allowedDynamicImports = declarations.filter((declaration) =>
    isExactRealProviderVerificationDynamicImport(
      relativePath,
      tokens,
      declaration,
    ),
  );
  if (allowedDynamicImports.length > 1)
    throw new Error("platform_provisioner_runtime_dependency_loader_unbound");
  for (const declaration of declarations) {
    if (
      declaration.kind === "dynamic_import" &&
      declaration.specifierIndex === null &&
      !allowedDynamicImports.includes(declaration)
    )
      throw new Error(loaderReason(declaration.start));
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
      (token.value === "require" || token.value === "getBuiltinModule")
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
  includeWorkerThreads = true,
): SelectedScriptProcessBindings {
  const bindings = new Map<string, string>();
  const declarationTokenIndices = new Set<number>();
  const allowedImports = new Map<string, ReadonlySet<string>>([
    [
      NODE_CHILD_PROCESS_SPECIFIER,
      new Set(["spawn", "spawnSync", "execFile", "execFileSync", "fork"]),
    ],
    ...(includeWorkerThreads
      ? ([[NODE_WORKER_THREADS_SPECIFIER, new Set(["Worker"])]] as const)
      : []),
  ]);
  for (const declaration of moduleDeclarationsFromTokens(tokens)) {
    if (declaration.specifierIndex === null) continue;
    const moduleToken = tokens[declaration.specifierIndex];
    const allowedNames = allowedImports.get(moduleToken?.value ?? "");
    if (!allowedNames) continue;
    if (
      declaration.kind === "reexport" &&
      declaration.bindings.length > 0 &&
      declaration.bindings.every((binding) => binding.typeOnly)
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
            declaration.bindings.length > 0 &&
            declaration.bindings.every((binding) => binding.typeOnly)
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
    new Set([NODE_CHILD_PROCESS_SPECIFIER, BARE_CHILD_PROCESS_SPECIFIER]),
    NODE_CHILD_PROCESS_SPECIFIER,
    "platform_provisioner_runtime_dependency_child_process_unbound",
  );
}

type RuntimeExternalProcessCallsite = Readonly<{
  source: string;
  containingFunction: string;
  primitive: string;
  executablePrefix: readonly string[];
  argvPrefix: readonly string[];
  authorityProof?: readonly string[];
}>;

const runtimeExternalProcessCallsites = Object.freeze(
  [
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
      "src/security/docker-desktop-repair-native-helper.ts",
      "acquireRuntimeOwnedDockerDesktopRepairNativeHelper",
      "spawn",
      ["executablePath"],
      ["[", "--docker-desktop-repair-helper"],
      ["const", "executablePath", "="],
    ],
    [
      "src/security/docker-desktop-runtime-repair.ts",
      "observeEngine",
      "spawnSync",
      ["cli", ".", "path"],
      ["[", "--host"],
      ["const", "cli", "="],
    ],
    [
      "src/security/docker-desktop-runtime-repair.ts",
      "officialShutdown",
      "spawnSync",
      ["cli", ".", "path"],
      ["[", "-Shutdown"],
      ["const", "cli", "="],
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
      ["DOCKER_EXECUTABLE"],
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
      ["path", ".", "join"],
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
        ...(authorityProof
          ? { authorityProof: Object.freeze(authorityProof) }
          : {}),
      }) as RuntimeExternalProcessCallsite,
  ),
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
      !RUNTIME_DISTRIBUTION_LOCAL_NODE_CHILD_ROLES.has(role.value) ||
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
const localTypeScriptChildRegistrySnapshotName =
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
  const stack: string[] = [];
  let expectingArgument = true;
  for (let index = openingParenthesis + 1; index < tokens.length; index += 1) {
    const value = tokens[index]?.value ?? "";
    if (stack.length === 0 && value === ")") return Object.freeze(starts);
    if (expectingArgument && stack.length === 0 && value !== ",") {
      starts.push(index);
      expectingArgument = false;
    }
    const expectedClosing = closing.get(value);
    if (expectedClosing) stack.push(expectedClosing);
    else if (stack.at(-1) === value) stack.pop();
    else if (stack.length === 0 && value === ",") expectingArgument = true;
  }
  throw new Error("platform_provisioner_runtime_dependency_parse_failed");
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
        binding.imported === localTypeScriptChildRegistrySnapshotName;
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
      (name === localTypeScriptChildRegistrySnapshotName &&
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
      !RUNTIME_DISTRIBUTION_LOCAL_NODE_CHILD_ROLES.has(
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
        .some((_, offset) =>
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
      .some((_, offset) =>
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
            containingFunction:
              "acquireRuntimeOwnedDockerDesktopRepairNativeHelper",
            argumentPrefixes: Object.freeze([
              Object.freeze(["child"]),
              Object.freeze(["policy", ".", "policySha256"]),
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
  let selected: Readonly<{
    name: string;
    opening: number;
    closing: number;
  }> | null = null;
  for (let index = 0; index < tokenIndex; index += 1) {
    if (
      tokens[index]?.value !== "function" ||
      tokens[index + 1]?.kind !== "identifier" ||
      tokens[index + 2]?.value !== "("
    )
      continue;
    const parametersEnd = matchingTokenIndex(tokens, index + 2, "(", ")");
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
    const bodyEnd = matchingTokenIndex(tokens, bodyStart, "{", "}");
    if (
      tokenIndex > bodyStart &&
      tokenIndex < bodyEnd &&
      (!selected || bodyStart > selected.opening)
    )
      selected = Object.freeze({
        name: tokens[index + 1]?.value ?? "",
        opening: bodyStart,
        closing: bodyEnd,
      });
  }
  return selected;
}

function argumentMatchesPrefix(
  tokens: readonly SourceToken[],
  argumentStart: number | undefined,
  prefix: readonly string[],
) {
  return (
    argumentStart !== undefined &&
    tokenSequenceMatches(tokens, argumentStart, prefix)
  );
}

function tokenSequenceExistsBetween(
  tokens: readonly SourceToken[],
  start: number,
  end: number,
  sequence: readonly string[],
) {
  for (let index = start; index + sequence.length <= end; index += 1) {
    if (tokenSequenceMatches(tokens, index, sequence)) return true;
  }
  return false;
}

function assertInternalLifecycleConsumerBoundary(
  relativePath: string,
  tokens: readonly SourceToken[],
) {
  const sourcePath = coordinatorRelativeSourcePath(relativePath);
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
      const argumentStarts =
        tokens[index + 1]?.value === "("
          ? directCallArgumentStarts(tokens, index + 1)
          : Object.freeze([]);
      if (
        tokens[index - 1]?.value === "." ||
        tokens[index + 1]?.value !== "(" ||
        owner?.name !== call.containingFunction ||
        argumentStarts.length !== call.argumentPrefixes.length ||
        !call.argumentPrefixes.every((prefix, argumentIndex) =>
          argumentMatchesPrefix(tokens, argumentStarts[argumentIndex], prefix),
        ) ||
        (call.beforePrefixes !== undefined &&
          !call.beforePrefixes.every((prefix) =>
            tokenSequenceExistsBetween(
              tokens,
              owner?.opening ?? 0,
              index,
              prefix,
            ),
          )) ||
        (call.afterPrefixes !== undefined &&
          !call.afterPrefixes.every((prefix) =>
            tokenSequenceExistsBetween(
              tokens,
              index + 1,
              owner?.closing ?? 0,
              prefix,
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
      declarationIndices.size > 0 &&
      capability.calls.some((call) => observed.get(call.symbol) !== 1)
    )
      throw new Error(
        "platform_provisioner_runtime_dependency_child_lifecycle_unbound",
      );
  }
}

function assertProcessWrapperConsumerBoundary(
  relativePath: string,
  tokens: readonly SourceToken[],
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
      const allowedConsumer = capability.uses.some(
        (use) => use.source === sourcePath,
      );
      if (declaration.kind !== "static_import" || !allowedConsumer)
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
        continue;
      }
      const owner = containingNamedFunction(tokens, index);
      const matching = capability.uses.filter((use) => {
        const symbolOffset = use.prefix.indexOf(symbol);
        return (
          use.source === sourcePath &&
          use.containingFunction === (owner?.name ?? null) &&
          symbolOffset >= 0 &&
          tokenSequenceMatches(tokens, index - symbolOffset, use.prefix)
        );
      });
      if (matching.length !== 1)
        throw new Error(
          "platform_provisioner_runtime_dependency_child_process_unbound",
        );
      const matched = matching[0] as ProcessWrapperUse;
      observed.set(matched, (observed.get(matched) ?? 0) + 1);
    }
    const expectedUses = capability.uses.filter(
      (use) => use.source === sourcePath,
    );
    if (
      (sourcePath === capability.target || importedIndices.has(symbol)) &&
      expectedUses.some((use) => observed.get(use) !== 1)
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
    new Set([NODE_WORKER_THREADS_SPECIFIER, BARE_WORKER_THREADS_SPECIFIER]),
    NODE_WORKER_THREADS_SPECIFIER,
    "platform_provisioner_runtime_dependency_child_worker_unbound",
  );
  for (const declaration of moduleDeclarationsFromTokens(tokens)) {
    const specifier =
      declaration.specifierIndex === null
        ? undefined
        : tokens[declaration.specifierIndex];
    if (
      specifier?.kind !== "string" ||
      specifier.value !== NODE_WORKER_THREADS_SPECIFIER
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
) {
  assertChildProcessModuleBoundary(tokens);
  const bindings = selectedScriptProcessBindings(tokens, false);
  const sourcePath = coordinatorRelativeSourcePath(relativePath);
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
    const argumentStarts = directCallArgumentStarts(tokens, index + 1);
    const executableStart = argumentStarts[0];
    const argvStart = argumentStarts[1];
    const matching = expectedCallsites.filter(
      (callsite) =>
        callsite.primitive === imported &&
        callsite.containingFunction === owner?.name &&
        argumentMatchesPrefix(
          tokens,
          executableStart,
          callsite.executablePrefix,
        ) &&
        argumentMatchesPrefix(tokens, argvStart, callsite.argvPrefix) &&
        (!callsite.authorityProof ||
          tokens.some((_, proofStart) =>
            tokenSequenceMatches(
              tokens,
              proofStart,
              callsite.authorityProof ?? [],
            ),
          )),
    );
    if (matching.length !== 1)
      throw new Error(
        "platform_provisioner_runtime_dependency_child_process_unbound",
      );
    const matched = matching[0] as RuntimeExternalProcessCallsite;
    observedCallsites.set(matched, (observedCallsites.get(matched) ?? 0) + 1);
  }
  if (
    bindings.bindings.size > 0 &&
    expectedCallsites.some((callsite) => observedCallsites.get(callsite) !== 1)
  )
    throw new Error(
      "platform_provisioner_runtime_dependency_child_process_unbound",
    );
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
    assertInternalLifecycleConsumerBoundary(relativePath, tokens);
    assertProcessWrapperConsumerBoundary(relativePath, tokens);
    assertWorkerCreationImportBoundary(relativePath, tokens);
    assertNoUnboundRuntimeChildProcess(relativePath, tokens);
    assertNoUnboundRuntimeExecPath(relativePath, tokens);
  } catch (error) {
    throw new Error(`${relativePath}:modules:${String(error)}`);
  }
  return Object.freeze(targets);
}

export function assertRuntimeSourceModuleBoundaryForVerification(
  relativePath: string,
  source: string,
) {
  staticRelativeModuleTargets(relativePath, Buffer.from(source, "utf8"));
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
    for (const entrypoint of RUNTIME_LOCAL_TYPESCRIPT_CHILD_ENTRYPOINTS) {
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
) {
  for (const target of staticRelativeModuleTargets(relativePath, bytes)) {
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
    RUNTIME_LOCAL_TYPESCRIPT_CHILD_ENTRYPOINTS.map((entrypoint) => [
      entrypoint.role,
      entrypoint,
    ]),
  );
  const expectedLocalNodeChildUses = new Set(
    RUNTIME_LOCAL_TYPESCRIPT_CHILD_ENTRYPOINTS.map(
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
  const requiredEntrypoints = RUNTIME_DISTRIBUTION_REQUIRED_ENTRYPOINTS.map(
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

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const MAXIMUM_ENVIRONMENT_BYTES = 8 * 1024;
const MAXIMUM_PASSPHRASE_BYTES = 1_024;

type FileIdentity = Readonly<{
  resolvedPath: string;
  dev: bigint;
  ino: bigint;
  birthtimeNs: bigint;
  size: bigint;
  mtimeNs: bigint;
}>;

export type PrivateKeyReferenceAuthorization = Readonly<{
  contract: "crdd-artifact-signing/private-key-reference-authorization";
  contractRevision: 1;
}>;

const authorizations = new WeakMap<
  PrivateKeyReferenceAuthorization,
  Readonly<{ identity: FileIdentity; consumed: boolean }>
>();

function isContainedBy(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function inspectPrivateKeyReference(
  target: string,
  prohibitedRoot: string,
  maximumBytes: number,
): FileIdentity {
  if (
    !path.isAbsolute(target) ||
    target.includes("\0") ||
    !path.isAbsolute(prohibitedRoot) ||
    prohibitedRoot.includes("\0") ||
    !Number.isSafeInteger(maximumBytes) ||
    maximumBytes < 1
  ) {
    throw new Error("artifact_signing_private_key_reference_invalid");
  }
  try {
    const resolvedPath = path.resolve(target);
    const metadata = fs.lstatSync(resolvedPath, { bigint: true });
    const realPath = fs.realpathSync.native(resolvedPath);
    const realProhibitedRoot = fs.realpathSync.native(
      path.resolve(prohibitedRoot),
    );
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      realPath !== resolvedPath ||
      metadata.size <= 0n ||
      metadata.size > BigInt(maximumBytes) ||
      isContainedBy(realProhibitedRoot, resolvedPath)
    ) {
      throw new Error("artifact_signing_private_key_reference_invalid");
    }
    return Object.freeze({
      resolvedPath,
      dev: metadata.dev,
      ino: metadata.ino,
      birthtimeNs: metadata.birthtimeNs,
      size: metadata.size,
      mtimeNs: metadata.mtimeNs,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "artifact_signing_private_key_reference_invalid"
    ) {
      throw error;
    }
    throw new Error("artifact_signing_private_key_reference_invalid");
  }
}

function sameFileIdentity(left: FileIdentity, right: FileIdentity) {
  return (
    left.resolvedPath === right.resolvedPath &&
    left.dev === right.dev &&
    left.ino === right.ino &&
    left.birthtimeNs === right.birthtimeNs &&
    left.size === right.size &&
    left.mtimeNs === right.mtimeNs
  );
}

function readStablePrivateKey(
  expected: FileIdentity,
  prohibitedRoot: string,
  maximumBytes: number,
) {
  const current = inspectPrivateKeyReference(
    expected.resolvedPath,
    prohibitedRoot,
    maximumBytes,
  );
  if (!sameFileIdentity(expected, current)) {
    throw new Error("artifact_signing_private_key_changed");
  }
  const noFollow =
    process.platform === "win32" ? 0 : (fs.constants.O_NOFOLLOW ?? 0);
  const descriptor = fs.openSync(
    expected.resolvedPath,
    fs.constants.O_RDONLY | noFollow,
  );
  let bytes: Buffer | null = null;
  let failure: unknown = null;
  try {
    const opened = fs.fstatSync(descriptor, { bigint: true });
    if (
      opened.dev !== expected.dev ||
      opened.ino !== expected.ino ||
      opened.birthtimeNs !== expected.birthtimeNs ||
      opened.size !== expected.size ||
      opened.mtimeNs !== expected.mtimeNs
    ) {
      throw new Error("artifact_signing_private_key_changed");
    }
    bytes = Buffer.alloc(Number(opened.size));
    let offset = 0;
    while (offset < bytes.length) {
      const count = fs.readSync(
        descriptor,
        bytes,
        offset,
        bytes.length - offset,
        null,
      );
      if (count === 0) break;
      offset += count;
    }
    const after = fs.fstatSync(descriptor, { bigint: true });
    const pathAfter = inspectPrivateKeyReference(
      expected.resolvedPath,
      prohibitedRoot,
      maximumBytes,
    );
    if (
      offset !== bytes.length ||
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.birthtimeNs !== opened.birthtimeNs ||
      after.size !== opened.size ||
      after.mtimeNs !== opened.mtimeNs ||
      !sameFileIdentity(expected, pathAfter)
    ) {
      throw new Error("artifact_signing_private_key_changed");
    }
  } catch (error) {
    failure = error;
  } finally {
    try {
      fs.closeSync(descriptor);
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure !== null || bytes === null) {
    bytes?.fill(0);
    throw failure ?? new Error("artifact_signing_private_key_read_failed");
  }
  return bytes;
}

export function readPrivateKeyReferenceFromEnvironmentFile(
  environmentFile: string,
  variableName: string,
) {
  let metadata: fs.Stats;
  try {
    metadata = fs.lstatSync(environmentFile);
  } catch {
    throw new Error("artifact_signing_environment_invalid");
  }
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size < 1 ||
    metadata.size > MAXIMUM_ENVIRONMENT_BYTES ||
    !/^[A-Z][A-Z0-9_]{0,127}$/u.test(variableName)
  ) {
    throw new Error("artifact_signing_environment_invalid");
  }
  const matches = fs
    .readFileSync(environmentFile, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.startsWith(`${variableName}=`));
  if (matches.length !== 1) {
    throw new Error("artifact_signing_environment_invalid");
  }
  let value = matches[0]?.slice(variableName.length + 1) ?? "";
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    value = value.slice(1, -1);
  }
  if (
    !path.isAbsolute(value) ||
    value.includes("\0") ||
    value.includes("\r") ||
    value.includes("\n")
  ) {
    throw new Error("artifact_signing_environment_invalid");
  }
  return value;
}

export function preflightPrivateKeyReference(options: {
  privateKeyPath: string;
  prohibitedRoot: string;
  maximumBytes: number;
}) {
  const identity = inspectPrivateKeyReference(
    options.privateKeyPath,
    options.prohibitedRoot,
    options.maximumBytes,
  );
  const authorization = Object.freeze({
    contract:
      "crdd-artifact-signing/private-key-reference-authorization" as const,
    contractRevision: 1 as const,
  });
  authorizations.set(
    authorization,
    Object.freeze({ identity, consumed: false }),
  );
  return authorization;
}

export function signEd25519Payload(options: {
  authorization: PrivateKeyReferenceAuthorization;
  payload: Uint8Array;
  passphrase: unknown;
  expectedPublicKeySpki: Uint8Array;
  prohibitedRoot: string;
  maximumPrivateKeyBytes: number;
}) {
  const authorized = authorizations.get(options.authorization);
  if (!authorized || authorized.consumed) {
    throw new Error("artifact_signing_private_key_authorization_invalid");
  }
  authorizations.set(
    options.authorization,
    Object.freeze({ identity: authorized.identity, consumed: true }),
  );
  if (
    typeof options.passphrase !== "string" ||
    options.passphrase.length === 0 ||
    Buffer.byteLength(options.passphrase, "utf8") > MAXIMUM_PASSPHRASE_BYTES
  ) {
    throw new Error("artifact_signing_passphrase_invalid");
  }
  const passphrase = Buffer.from(options.passphrase, "utf8");
  let privateKeyBytes: Buffer | null = null;
  try {
    privateKeyBytes = readStablePrivateKey(
      authorized.identity,
      options.prohibitedRoot,
      options.maximumPrivateKeyBytes,
    );
    const privateKey = createPrivateKey({
      key: privateKeyBytes,
      format: "pem",
      passphrase,
    });
    const signerSpki = createPublicKey(privateKey).export({
      type: "spki",
      format: "der",
    });
    const expected = Buffer.from(options.expectedPublicKeySpki);
    if (!signerSpki.equals(expected)) {
      throw new Error("artifact_signing_private_key_not_expected");
    }
    const signature = sign(null, options.payload, privateKey);
    return Object.freeze({
      algorithm: "Ed25519" as const,
      keyId: createHash("sha256").update(signerSpki).digest("hex"),
      signature: signature.toString("base64url"),
    });
  } finally {
    passphrase.fill(0);
    privateKeyBytes?.fill(0);
  }
}

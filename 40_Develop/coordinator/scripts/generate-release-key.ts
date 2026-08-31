import { createHash, generateKeyPairSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assertSupportedCoordinatorNodeRuntime } from "../src/core/node-runtime-version.ts";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const PRIVATE_KEY_FILE = "crdd-release-v1-private.pem";
const PUBLIC_KEY_FILE = "crdd-release-v1-public.spki.der";
const MINIMUM_PASSPHRASE_CHARACTERS = 20;
const MAXIMUM_PASSPHRASE_BYTES = 1_024;

function isContainedBy(parent: string, candidate: string) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function validateOutputDirectory(rawOutputDirectory: unknown) {
  if (
    typeof rawOutputDirectory !== "string" ||
    !path.isAbsolute(rawOutputDirectory) ||
    rawOutputDirectory.includes("\0")
  ) {
    throw new Error("release_key_output_directory_invalid");
  }
  const outputDirectory = path.resolve(rawOutputDirectory);
  const realRepositoryRoot = fs.realpathSync.native(repositoryRoot);
  const parent = path.dirname(outputDirectory);
  const parentMetadata = fs.lstatSync(parent);
  const realParent = fs.realpathSync.native(parent);
  if (
    !parentMetadata.isDirectory() ||
    parentMetadata.isSymbolicLink() ||
    realParent !== parent ||
    isContainedBy(realRepositoryRoot, outputDirectory) ||
    fs.existsSync(outputDirectory)
  ) {
    throw new Error("release_key_output_directory_invalid");
  }
  return outputDirectory;
}

function validatePassphrase(rawPassphrase: unknown) {
  if (
    typeof rawPassphrase !== "string" ||
    [...rawPassphrase].length < MINIMUM_PASSPHRASE_CHARACTERS ||
    Buffer.byteLength(rawPassphrase, "utf8") > MAXIMUM_PASSPHRASE_BYTES
  ) {
    throw new Error("release_key_passphrase_invalid");
  }
  return Buffer.from(rawPassphrase, "utf8");
}

export function generateReleaseKeyPair(
  rawOutputDirectory: unknown,
  rawPassphrase: unknown,
) {
  const outputDirectory = validateOutputDirectory(rawOutputDirectory);
  const passphrase = validatePassphrase(rawPassphrase);
  let isDirectoryCreated = false;
  try {
    const keyPair = generateKeyPairSync("ed25519");
    const privateKey = keyPair.privateKey.export({
      type: "pkcs8",
      format: "pem",
      cipher: "aes-256-cbc",
      passphrase,
    });
    const publicKey = keyPair.publicKey.export({ type: "spki", format: "der" });
    fs.mkdirSync(outputDirectory, { mode: 0o700 });
    isDirectoryCreated = true;
    fs.writeFileSync(path.join(outputDirectory, PRIVATE_KEY_FILE), privateKey, {
      flag: "wx",
      mode: 0o600,
    });
    fs.writeFileSync(path.join(outputDirectory, PUBLIC_KEY_FILE), publicKey, {
      flag: "wx",
      mode: 0o644,
    });
    return Object.freeze({
      status: "created" as const,
      publicKeyFile: PUBLIC_KEY_FILE,
      publicKeySpkiSha256: createHash("sha256").update(publicKey).digest("hex"),
      privateKeyStoredOutsideRepository: true,
    });
  } catch (error) {
    if (isDirectoryCreated) {
      for (const fileName of [PUBLIC_KEY_FILE, PRIVATE_KEY_FILE]) {
        const target = path.join(outputDirectory, fileName);
        if (fs.existsSync(target)) fs.unlinkSync(target);
      }
      fs.rmdirSync(outputDirectory);
    }
    throw error;
  } finally {
    passphrase.fill(0);
  }
}

export async function readHiddenLine(prompt: string) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("release_key_interactive_terminal_required");
  }
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return await new Promise<string>((resolve, reject) => {
    let value = "";
    const finish = (result: string | Error) => {
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const onEnd = () => finish(new Error("release_key_input_closed"));
    const onData = (chunk: string) => {
      for (const character of chunk) {
        if (character === "\u0003") {
          finish(new Error("release_key_cancelled"));
          return;
        }
        if (character === "\r" || character === "\n") {
          process.stdout.write("\n");
          finish(value);
          return;
        }
        if (character === "\u007f" || character === "\b") {
          value = value.slice(0, -1);
        } else if (character >= " ") {
          value += character;
        }
      }
    };
    process.stdin.on("data", onData);
    process.stdin.once("end", onEnd);
  });
}

async function main() {
  assertSupportedCoordinatorNodeRuntime(process.versions.node);
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--output") {
    throw new Error(
      'usage: & "<absolute-preverified-node-24.12+-executable>" "<absolute-crdd-source-root>\\40_Develop\\coordinator\\scripts\\generate-release-key.ts" --output "<absolute-new-directory>"',
    );
  }
  const first = await readHiddenLine("Release key passphrase: ");
  const second = await readHiddenLine("Confirm passphrase: ");
  if (first !== second) throw new Error("release_key_passphrase_mismatch");
  const result = generateReleaseKeyPair(args[1], first);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "release_key_generation_failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

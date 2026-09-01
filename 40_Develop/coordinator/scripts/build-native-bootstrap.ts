import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const NATIVE_BOOTSTRAP_TOOLCHAIN = "1.94.1-x86_64-pc-windows-msvc";
export const NATIVE_BOOTSTRAP_TARGET = "x86_64-pc-windows-msvc";
export const NATIVE_BOOTSTRAP_BUILD_ARGUMENTS = Object.freeze([
  "rustc",
  "--manifest-path",
  "Cargo.toml",
  "--frozen",
  "--release",
  "--target",
  NATIVE_BOOTSTRAP_TARGET,
  "--bin",
  "coordinator",
  "--features",
  "native-bootstrap-release",
  "--",
  "-C",
  "link-arg=/ENTRY:crdd_coordinator_entry",
  "-C",
  "link-arg=/SUBSYSTEM:CONSOLE,6.02",
  "-C",
  "link-arg=/NODEFAULTLIB",
  "-C",
  "link-arg=libcmt.lib",
  "-C",
  "link-arg=/Brepro",
]);
const PLATFORM_ACCESS_BUILD_ARGUMENTS = Object.freeze([
  "rustc",
  "--manifest-path",
  "Cargo.toml",
  "--frozen",
  "--release",
  "--target",
  NATIVE_BOOTSTRAP_TARGET,
  "--bin",
  "crdd-platform-access",
  "--",
  "-C",
  "link-arg=/Brepro",
]);
const FORBIDDEN_BUILD_ENVIRONMENT_EXACT = Object.freeze([
  "CARGO_HOME",
  "CARGO_TARGET_DIR",
  "RUSTFLAGS",
  "RUSTDOCFLAGS",
  "RUSTC",
  "RUSTDOC",
  "RUSTC_BOOTSTRAP",
  "RUSTUP_TOOLCHAIN",
  "CARGO_ENCODED_RUSTFLAGS",
  "RUSTC_WRAPPER",
  "RUSTC_WORKSPACE_WRAPPER",
]);
const FORBIDDEN_BUILD_ENVIRONMENT_PREFIXES = Object.freeze([
  "CARGO_ALIAS_",
  "CARGO_BUILD_",
  "CARGO_HTTP_",
  "CARGO_NET_",
  "CARGO_PROFILE_",
  "CARGO_REGISTRIES_",
  "CARGO_REGISTRY_",
  "CARGO_SOURCE_",
  "CARGO_TARGET_",
]);
const CHILD_ENVIRONMENT_ALLOWLIST = Object.freeze([
  "COMSPEC",
  "INCLUDE",
  "LIB",
  "LIBPATH",
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "TEMP",
  "TMP",
  "WINDIR",
]);
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const crateRoot = path.resolve(coordinatorRoot, "..", "platform-access");
const crateTargetRoot = path.join(crateRoot, "target");

function sha256File(file: string) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function exactTool(file: string) {
  const resolved = path.resolve(file);
  const metadata = fs.lstatSync(resolved, { bigint: true });
  if (
    !metadata.isFile() ||
    metadata.isSymbolicLink() ||
    metadata.size <= 0n ||
    fs.realpathSync.native(resolved) !== resolved
  )
    throw new Error("native_bootstrap_build_tool_invalid");
  return Object.freeze({
    path: resolved,
    byteLength: Number(metadata.size),
    sha256: sha256File(resolved),
  });
}

function cargoConfigCandidates(cargoHome: string) {
  const candidates: string[] = [];
  let current = crateRoot;
  while (true) {
    candidates.push(
      path.join(current, ".cargo", "config"),
      path.join(current, ".cargo", "config.toml"),
    );
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  candidates.push(
    path.join(cargoHome, "config"),
    path.join(cargoHome, "config.toml"),
  );
  return Object.freeze(candidates);
}

export function validateNativeBootstrapBuildEnvironment(
  environment: NodeJS.ProcessEnv,
) {
  const names = new Map<string, string>();
  for (const name of Object.keys(environment)) {
    const normalized = name.toUpperCase();
    const existing = names.get(normalized);
    if (
      existing !== undefined &&
      (!CHILD_ENVIRONMENT_ALLOWLIST.includes(normalized) ||
        environment[existing] !== environment[name])
    )
      throw new Error(
        `native_bootstrap_build_environment_duplicate:${normalized}`,
      );
    if (existing !== undefined) continue;
    names.set(normalized, name);
  }
  for (const normalized of names.keys()) {
    if (
      FORBIDDEN_BUILD_ENVIRONMENT_EXACT.includes(normalized) ||
      FORBIDDEN_BUILD_ENVIRONMENT_PREFIXES.some((prefix) =>
        normalized.startsWith(prefix),
      )
    )
      throw new Error(
        `native_bootstrap_build_environment_invalid:${normalized}`,
      );
  }
  return true;
}

export function inspectNativeBootstrapBuildBoundary() {
  validateNativeBootstrapBuildEnvironment(process.env);
  const userHome = path.resolve(os.homedir());
  const cargoHome = path.join(userHome, ".cargo");
  const toolchainRoot = path.join(
    userHome,
    ".rustup",
    "toolchains",
    NATIVE_BOOTSTRAP_TOOLCHAIN,
    "bin",
  );
  const cargoHomeMetadata = fs.lstatSync(cargoHome);
  if (
    !cargoHomeMetadata.isDirectory() ||
    cargoHomeMetadata.isSymbolicLink() ||
    fs.realpathSync.native(cargoHome) !== cargoHome
  )
    throw new Error("native_bootstrap_build_cargo_home_invalid");
  const configCandidates = cargoConfigCandidates(cargoHome);
  for (const candidate of configCandidates) {
    if (fs.existsSync(candidate))
      throw new Error("native_bootstrap_build_cargo_config_present");
  }
  return Object.freeze({
    cargo: exactTool(path.join(toolchainRoot, "cargo.exe")),
    rustc: exactTool(path.join(toolchainRoot, "rustc.exe")),
    cargoHome,
    cargoConfigCandidates,
    cargoConfigFilesPresent: 0,
    dependencySource: "existing_local_cargo_cache_not_supply_chain_verified",
    msvcLinkerIdentity: "not_verified",
  });
}

function childEnvironment(
  boundary: ReturnType<typeof inspectNativeBootstrapBuildBoundary>,
  targetRoot: string,
) {
  const result: NodeJS.ProcessEnv = {};
  const normalizedSource = new Map(
    Object.entries(process.env).map(([name, value]) => [
      name.toUpperCase(),
      value,
    ]),
  );
  for (const name of CHILD_ENVIRONMENT_ALLOWLIST) {
    const value = normalizedSource.get(name);
    if (value !== undefined) result[name] = value;
  }
  result.CARGO_HOME = boundary.cargoHome;
  result.CARGO_TARGET_DIR = targetRoot;
  result.RUSTC = boundary.rustc.path;
  result.CARGO_ENCODED_RUSTFLAGS =
    '--cfg\u001fcurve25519_dalek_backend="serial"';
  return result;
}

export function buildNativeBootstrap(
  targetRoot = crateTargetRoot,
  authenticodeSignerSha256 = "0".repeat(64),
) {
  if (!/^[0-9a-f]{64}$/u.test(authenticodeSignerSha256))
    throw new Error("native_bootstrap_authenticode_signer_invalid");
  const resolvedTargetRoot = path.resolve(targetRoot);
  const relative = path.relative(crateTargetRoot, resolvedTargetRoot);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("native_bootstrap_build_target_invalid");
  const boundary = inspectNativeBootstrapBuildBoundary();
  fs.mkdirSync(resolvedTargetRoot, { recursive: true });
  if (
    fs.realpathSync.native(resolvedTargetRoot) !== resolvedTargetRoot ||
    fs.lstatSync(resolvedTargetRoot).isSymbolicLink()
  )
    throw new Error("native_bootstrap_build_target_invalid");
  const buildEnvironment = childEnvironment(boundary, resolvedTargetRoot);
  const workerBuildEnvironment = childEnvironment(boundary, resolvedTargetRoot);
  const workerArguments = [...PLATFORM_ACCESS_BUILD_ARGUMENTS];
  const workerManifestIndex = workerArguments.indexOf("Cargo.toml");
  if (workerManifestIndex < 0)
    throw new Error("native_bootstrap_build_contract_invalid");
  workerArguments[workerManifestIndex] = path.join(crateRoot, "Cargo.toml");
  const workerBuild = spawnSync(boundary.cargo.path, workerArguments, {
    cwd: crateRoot,
    env: workerBuildEnvironment,
    encoding: "utf8",
    windowsHide: true,
  });
  if (workerBuild.error || workerBuild.status !== 0)
    throw new Error(
      `native_bootstrap_worker_build_failed:${workerBuild.error?.message ?? workerBuild.stderr}`,
    );
  const workerExecutable = path.join(
    resolvedTargetRoot,
    NATIVE_BOOTSTRAP_TARGET,
    "release",
    "crdd-platform-access.exe",
  );
  if (!fs.statSync(workerExecutable).isFile())
    throw new Error("native_bootstrap_worker_artifact_missing");
  buildEnvironment.CRDD_NATIVE_WORKER_SHA256 = sha256File(workerExecutable);
  // All-zero is the explicit Local Personal v1 manifest-only policy. A
  // nonzero digest opts into the additional fixed-publisher Authenticode gate.
  buildEnvironment.CRDD_AUTHENTICODE_SIGNER_SHA256 = authenticodeSignerSha256;
  const commandArguments = [...NATIVE_BOOTSTRAP_BUILD_ARGUMENTS];
  const manifestIndex = commandArguments.indexOf("Cargo.toml");
  if (manifestIndex < 0)
    throw new Error("native_bootstrap_build_contract_invalid");
  commandArguments[manifestIndex] = path.join(crateRoot, "Cargo.toml");
  const result = spawnSync(boundary.cargo.path, commandArguments, {
    cwd: crateRoot,
    env: buildEnvironment,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.error || result.status !== 0)
    throw new Error(
      `native_bootstrap_build_failed:${result.error?.message ?? result.stderr}`,
    );
  const executable = path.join(
    resolvedTargetRoot,
    NATIVE_BOOTSTRAP_TARGET,
    "release",
    "coordinator.exe",
  );
  if (!fs.statSync(executable).isFile())
    throw new Error("native_bootstrap_build_artifact_missing");
  return executable;
}

const entryArgument = process.argv[1];
if (
  entryArgument &&
  pathToFileURL(path.resolve(entryArgument)).href === import.meta.url
) {
  const signerOption = process.argv[2];
  const signer = process.argv[3];
  if (
    (signerOption !== undefined || signer !== undefined) &&
    (signerOption !== "--authenticode-signer-sha256" || signer === undefined)
  )
    throw new Error("native_bootstrap_build_arguments_invalid");
  process.stdout.write(`${buildNativeBootstrap(crateTargetRoot, signer)}\n`);
}

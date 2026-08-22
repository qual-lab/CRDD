import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const NATIVE_BOOTSTRAP_TOOLCHAIN = "1.94.1-x86_64-pc-windows-msvc";
export const NATIVE_BOOTSTRAP_TARGET = "x86_64-pc-windows-msvc";
export const NATIVE_BOOTSTRAP_BUILD_ARGUMENTS = Object.freeze([
  `+${NATIVE_BOOTSTRAP_TOOLCHAIN}`,
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
  "link-arg=/Brepro",
]);
const FORBIDDEN_BUILD_ENVIRONMENT = Object.freeze([
  "RUSTFLAGS",
  "CARGO_ENCODED_RUSTFLAGS",
  "RUSTC_WRAPPER",
  "RUSTC_WORKSPACE_WRAPPER",
  "CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER",
]);
const coordinatorRoot = path.resolve(import.meta.dirname, "..");
const crateRoot = path.resolve(coordinatorRoot, "..", "platform-access");
const crateTargetRoot = path.join(crateRoot, "target");

export function buildNativeBootstrap(targetRoot = crateTargetRoot) {
  const resolvedTargetRoot = path.resolve(targetRoot);
  const relative = path.relative(crateTargetRoot, resolvedTargetRoot);
  if (relative.startsWith("..") || path.isAbsolute(relative))
    throw new Error("native_bootstrap_build_target_invalid");
  fs.mkdirSync(resolvedTargetRoot, { recursive: true });
  if (
    fs.realpathSync.native(resolvedTargetRoot) !== resolvedTargetRoot ||
    fs.lstatSync(resolvedTargetRoot).isSymbolicLink()
  )
    throw new Error("native_bootstrap_build_target_invalid");
  const buildEnvironment = { ...process.env };
  for (const name of FORBIDDEN_BUILD_ENVIRONMENT) {
    if (buildEnvironment[name])
      throw new Error(`native_bootstrap_build_environment_invalid:${name}`);
    delete buildEnvironment[name];
  }
  buildEnvironment.CARGO_TARGET_DIR = resolvedTargetRoot;
  const commandArguments = [...NATIVE_BOOTSTRAP_BUILD_ARGUMENTS];
  const manifestIndex = commandArguments.indexOf("Cargo.toml");
  if (manifestIndex < 0)
    throw new Error("native_bootstrap_build_contract_invalid");
  commandArguments[manifestIndex] = path.join(crateRoot, "Cargo.toml");
  const result = spawnSync("cargo", commandArguments, {
    cwd: coordinatorRoot,
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
)
  process.stdout.write(`${buildNativeBootstrap()}\n`);

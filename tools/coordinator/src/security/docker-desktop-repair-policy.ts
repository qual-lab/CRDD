import { createHash } from "node:crypto";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export const WINDOWS_DOCKER_DESKTOP_REPAIR_POLICY_RELATIVE_PATH =
  "tools/coordinator/policies/windows-docker-desktop-4.41.2.policy";

const POLICY_MAGIC = "CRDD_WINDOWS_DOCKER_DESKTOP_REPAIR_POLICY_V1";
const DOCKER_DESKTOP_VERSION = "4.41.2";
const DOCKER_ENGINE_VERSION = "28.1.1";
const POLICY_FILE = fileURLToPath(
  new URL(
    "../../policies/windows-docker-desktop-4.41.2.policy",
    import.meta.url,
  ),
);
const ROLES = Object.freeze([
  "docker_cli",
  "desktop_cli",
  "launcher",
  "frontend",
  "backend",
  "build",
  "dev_envs",
] as const);

export type DockerDesktopRepairArtifactRole = (typeof ROLES)[number];
export type DockerDesktopRepairArtifact = Readonly<{
  role: DockerDesktopRepairArtifactRole;
  path: string;
  bytes: number;
  sha256: string;
}>;
export type DockerDesktopRepairPolicy = Readonly<{
  policySha256: string;
  dockerDesktopVersion: string;
  engineVersion: string;
  artifacts: ReadonlyMap<
    DockerDesktopRepairArtifactRole,
    DockerDesktopRepairArtifact
  >;
}>;

function stablePolicyBytes() {
  let handle: number | null = null;
  try {
    const before = fs.lstatSync(POLICY_FILE, { bigint: true });
    if (
      !before.isFile() ||
      before.isSymbolicLink() ||
      before.size < 1n ||
      before.size > 16_384n ||
      fs.realpathSync.native(POLICY_FILE) !== POLICY_FILE
    )
      return null;
    handle = fs.openSync(POLICY_FILE, "r");
    const opened = fs.fstatSync(handle, { bigint: true });
    if (
      opened.dev !== before.dev ||
      opened.ino !== before.ino ||
      opened.birthtimeNs !== before.birthtimeNs ||
      opened.size !== before.size
    )
      return null;
    const bytes = Buffer.alloc(Number(opened.size));
    if (fs.readSync(handle, bytes, 0, bytes.length, 0) !== bytes.length)
      return null;
    const after = fs.fstatSync(handle, { bigint: true });
    const pathAfter = fs.lstatSync(POLICY_FILE, { bigint: true });
    if (
      after.dev !== opened.dev ||
      after.ino !== opened.ino ||
      after.birthtimeNs !== opened.birthtimeNs ||
      after.size !== opened.size ||
      pathAfter.dev !== opened.dev ||
      pathAfter.ino !== opened.ino ||
      pathAfter.birthtimeNs !== opened.birthtimeNs ||
      pathAfter.size !== opened.size ||
      fs.realpathSync.native(POLICY_FILE) !== POLICY_FILE
    )
      return null;
    return bytes;
  } catch {
    return null;
  } finally {
    if (handle !== null) fs.closeSync(handle);
  }
}

export function observeRuntimeOwnedDockerDesktopRepairPolicy(): DockerDesktopRepairPolicy | null {
  const bytes = stablePolicyBytes();
  if (!bytes) return null;
  const source = bytes.toString("utf8");
  if (!source.endsWith("\n") || source.includes("\r") || source.includes("\0"))
    return null;
  const lines = source.slice(0, -1).split("\n");
  if (lines[0] !== POLICY_MAGIC || lines.length !== ROLES.length + 3)
    return null;
  const version = /^version\|([0-9]+\.[0-9]+\.[0-9]+)$/u.exec(lines[1] ?? "");
  const engine = /^engine\|([0-9]+\.[0-9]+\.[0-9]+)$/u.exec(lines[2] ?? "");
  if (
    version?.[1] !== DOCKER_DESKTOP_VERSION ||
    engine?.[1] !== DOCKER_ENGINE_VERSION
  )
    return null;
  const artifacts = new Map<
    DockerDesktopRepairArtifactRole,
    DockerDesktopRepairArtifact
  >();
  for (const line of lines.slice(3)) {
    const matched =
      /^([a-z_]+)\|(C:\\[^|\r\n]{1,512})\|([1-9][0-9]{0,11})\|([A-F0-9]{64})$/u.exec(
        line,
      );
    if (!matched) return null;
    const role = matched[1] as DockerDesktopRepairArtifactRole;
    const bytesValue = Number(matched[3]);
    if (
      !ROLES.includes(role) ||
      artifacts.has(role) ||
      !Number.isSafeInteger(bytesValue) ||
      bytesValue < 1 ||
      !matched[2] ||
      !matched[4]
    )
      return null;
    artifacts.set(
      role,
      Object.freeze({
        role,
        path: matched[2],
        bytes: bytesValue,
        sha256: matched[4],
      }),
    );
  }
  if (ROLES.some((role) => !artifacts.has(role))) return null;
  return Object.freeze({
    policySha256: createHash("sha256").update(bytes).digest("hex"),
    dockerDesktopVersion: version[1],
    engineVersion: engine[1],
    artifacts: Object.freeze(artifacts),
  });
}

export function describeDockerDesktopRepairPolicyContract() {
  return Object.freeze({
    policyRelativePath: WINDOWS_DOCKER_DESKTOP_REPAIR_POLICY_RELATIVE_PATH,
    policyMagic: POLICY_MAGIC,
    artifactRoles: ROLES,
    singleAuthorityForTypeScriptAndNativeHelper: true,
    arbitraryPolicyPathAccepted: false,
  });
}

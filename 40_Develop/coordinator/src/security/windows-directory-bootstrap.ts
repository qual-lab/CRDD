import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  beginPlatformAccessArtifactSigningObservation,
  verifyPlatformAccessArtifactSigningObservation,
  PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH,
} from "./platform-access-release.ts";

// Bootstrap trust binds the shipped helper, not a caller-observed executable.
// Updated with the Native artifact; this observation grants no Runtime authority.
const BOOTSTRAP_ARTIFACT_SHA256 =
  "9a1dc6c886a8ff4834972abb342f33fc2c018d31871ef6eb3152317eb83fcee0";
const distributionRoot = fileURLToPath(
  new URL("../../../../", import.meta.url),
);

export function observeSystemWindowsDirectory() {
  if (process.platform !== "win32") return null;
  try {
    const snapshot =
      beginPlatformAccessArtifactSigningObservation(distributionRoot);
    if (!snapshot || snapshot.artifact.sha256 !== BOOTSTRAP_ARTIFACT_SHA256)
      return null;
    const result = spawnSync(
      path.join(
        distributionRoot,
        ...PLATFORM_ACCESS_EXECUTABLE_RELATIVE_PATH.split("/"),
      ),
      ["--system-windows-directory"],
      {
        env: {},
        cwd: distributionRoot,
        shell: false,
        windowsHide: true,
        timeout: 5_000,
        maxBuffer: 65_548,
        encoding: "buffer",
      },
    );
    if (
      !verifyPlatformAccessArtifactSigningObservation(snapshot.token) ||
      result.error ||
      result.status !== 0 ||
      result.signal !== null ||
      result.stderr.length !== 0 ||
      result.stdout.length < 14 ||
      result.stdout.subarray(0, 8).toString("ascii") !== "CRDDWD01"
    )
      return null;
    const length = result.stdout.readUInt32LE(8);
    if (
      length === 0 ||
      length >= 32_768 ||
      result.stdout.length !== 12 + length * 2
    )
      return null;
    const directory = new TextDecoder("utf-16le", { fatal: true }).decode(
      result.stdout.subarray(12),
    );
    if (
      !path.win32.isAbsolute(directory) ||
      directory.includes("\0") ||
      path.win32.normalize(directory) !== directory
    )
      return null;
    return directory;
  } catch {
    return null;
  }
}

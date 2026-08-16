import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const POWERSHELL_TIMEOUT_MS = 30_000;
const POWERSHELL_OUTPUT_BYTES = 4_096;
const WINDOWS_ROOT = /^[A-Za-z]:\\Windows$/u;
const PROGRAM_DATA_SCRIPT = `
$ErrorActionPreference = 'Stop'
[Environment]::GetFolderPath([Environment+SpecialFolder]::CommonApplicationData)
`;

function powershellExecutable() {
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot || !WINDOWS_ROOT.test(systemRoot)) return null;
  const executable = path.win32.join(
    systemRoot,
    "System32",
    "WindowsPowerShell",
    "v1.0",
    "powershell.exe",
  );
  const metadata = fs.lstatSync(executable);
  return metadata.isFile() &&
    !metadata.isSymbolicLink() &&
    fs.realpathSync.native(executable) === executable
    ? executable
    : null;
}

export function discoverWindowsCommonApplicationDataForEffect() {
  try {
    if (process.platform !== "win32") return null;
    const executable = powershellExecutable();
    if (!executable) return null;
    const output = execFileSync(
      executable,
      [
        "-NoLogo",
        "-NoProfile",
        "-NonInteractive",
        "-EncodedCommand",
        Buffer.from(PROGRAM_DATA_SCRIPT, "utf16le").toString("base64"),
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        timeout: POWERSHELL_TIMEOUT_MS,
        maxBuffer: POWERSHELL_OUTPUT_BYTES,
        env: { SystemRoot: process.env.SystemRoot },
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();
    if (!path.win32.isAbsolute(output) || output.includes("\0")) return null;
    const normalized = path.win32.normalize(output);
    const metadata = fs.lstatSync(normalized);
    return metadata.isDirectory() &&
      !metadata.isSymbolicLink() &&
      fs.realpathSync.native(normalized) === normalized
      ? normalized
      : null;
  } catch {
    return null;
  }
}

export function describeWindowsCommonApplicationDataContract() {
  return Object.freeze({
    contract: "crdd-coordinator/windows-common-application-data",
    contractRevision: 1,
    source: "windows_known_folder_common_application_data",
    environmentOverride: "prohibited",
    stableNonLinkDirectoryRequired: true,
    pathDisclosure: "prohibited",
    repositoryRuntimeStateRequired: false,
    filesystemEffectIssued: false,
  });
}

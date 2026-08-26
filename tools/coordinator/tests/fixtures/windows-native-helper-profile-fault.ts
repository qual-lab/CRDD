import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const MODES = new Set([
  "user_info_error",
  "missing",
  "link",
  "realpath_mismatch",
]);
const mode = process.argv[2];
if (!mode || !MODES.has(mode) || process.argv.length !== 3) process.exit(64);

const originalUserInfo = os.userInfo;
const originalLstatSync = fs.lstatSync;
const originalRealpathNative = fs.realpathSync.native;
const originalUserProfile = process.env.USERPROFILE;
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "crdd-native-profile-fault-"),
);
const validParentProfile = path.join(temporaryRoot, "parent-profile");
const observedProfile = path.join(temporaryRoot, "observed-profile");
fs.mkdirSync(validParentProfile);
if (mode !== "missing") fs.mkdirSync(observedProfile);

let isEnvironmentNull = false;
try {
  process.env.USERPROFILE = validParentProfile;
  const baseline = originalUserInfo();
  Object.defineProperty(os, "userInfo", {
    configurable: true,
    value:
      mode === "user_info_error"
        ? () => {
            throw new Error("fixed_user_info_fault");
          }
        : () => ({ ...baseline, homedir: observedProfile }),
  });
  if (mode === "link") {
    Object.defineProperty(fs, "lstatSync", {
      configurable: true,
      value: ((candidate: fs.PathLike, options?: unknown) => {
        if (path.win32.normalize(String(candidate)) === observedProfile) {
          return {
            isDirectory: () => true,
            isSymbolicLink: () => true,
          };
        }
        return originalLstatSync(candidate, options as never);
      }) as typeof fs.lstatSync,
    });
  }
  if (mode === "realpath_mismatch") {
    Object.defineProperty(fs.realpathSync, "native", {
      configurable: true,
      value: ((candidate: fs.PathLike, options?: unknown) =>
        path.win32.normalize(String(candidate)) === observedProfile
          ? validParentProfile
          : originalRealpathNative(
              candidate,
              options as never,
            )) as typeof fs.realpathSync.native,
    });
  }
  const environmentModule = await import(
    "../../src/core/windows-child-environment.ts"
  );
  isEnvironmentNull =
    environmentModule.createWindowsNativeHelperEnvironment() === null;
} finally {
  Object.defineProperty(os, "userInfo", {
    configurable: true,
    value: originalUserInfo,
  });
  Object.defineProperty(fs, "lstatSync", {
    configurable: true,
    value: originalLstatSync,
  });
  Object.defineProperty(fs.realpathSync, "native", {
    configurable: true,
    value: originalRealpathNative,
  });
  if (originalUserProfile === undefined) delete process.env.USERPROFILE;
  else process.env.USERPROFILE = originalUserProfile;
  fs.rmSync(temporaryRoot, { recursive: true });
}

process.stdout.write(
  `${JSON.stringify({
    mode,
    environmentIsNull: isEnvironmentNull,
    parentEnvironmentFallbackUsed: false,
    cleanupConfirmed: !fs.existsSync(temporaryRoot),
  })}\n`,
);

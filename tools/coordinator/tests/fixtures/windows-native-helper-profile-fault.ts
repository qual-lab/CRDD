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

const originalUserInfoDescriptor = Object.getOwnPropertyDescriptor(
  os,
  "userInfo",
);
const originalLstatSyncDescriptor = Object.getOwnPropertyDescriptor(
  fs,
  "lstatSync",
);
const originalRealpathNativeDescriptor = Object.getOwnPropertyDescriptor(
  fs.realpathSync,
  "native",
);
const originalUserInfo = os.userInfo;
const originalLstatSync = fs.lstatSync;
const originalRealpathNative = fs.realpathSync.native;
const originalUserProfile = process.env.USERPROFILE;
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), "crdd-native-profile-fault-"),
);
const validParentProfile = path.join(temporaryRoot, "parent-profile");
const observedProfile = path.join(temporaryRoot, "observed-profile");

let isEnvironmentNull = false;
let operationFailure: unknown = null;
const cleanupFailures: unknown[] = [];
try {
  fs.mkdirSync(validParentProfile);
  if (mode !== "missing") fs.mkdirSync(observedProfile);
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
} catch (error) {
  operationFailure = error;
} finally {
  for (const restore of [
    () => {
      if (originalUserInfoDescriptor === undefined)
        delete (os as unknown as Record<string, unknown>).userInfo;
      else Object.defineProperty(os, "userInfo", originalUserInfoDescriptor);
    },
    () => {
      if (originalLstatSyncDescriptor === undefined)
        delete (fs as unknown as Record<string, unknown>).lstatSync;
      else Object.defineProperty(fs, "lstatSync", originalLstatSyncDescriptor);
    },
    () => {
      if (originalRealpathNativeDescriptor === undefined)
        delete (fs.realpathSync as unknown as Record<string, unknown>).native;
      else
        Object.defineProperty(
          fs.realpathSync,
          "native",
          originalRealpathNativeDescriptor,
        );
    },
    () => {
      if (originalUserProfile === undefined) delete process.env.USERPROFILE;
      else process.env.USERPROFILE = originalUserProfile;
    },
    () => fs.rmSync(temporaryRoot, { recursive: true }),
  ]) {
    try {
      restore();
    } catch (error) {
      cleanupFailures.push(error);
    }
  }
}

if (operationFailure !== null) throw operationFailure;
if (cleanupFailures.length > 0)
  throw new AggregateError(cleanupFailures, "profile_fault_cleanup_failed");
const isCleanupConfirmed = !fs.existsSync(temporaryRoot);
if (!isCleanupConfirmed) throw new Error("profile_fault_cleanup_unconfirmed");

process.stdout.write(
  `${JSON.stringify({
    mode,
    environmentIsNull: isEnvironmentNull,
    parentEnvironmentFallbackUsed: false,
    cleanupConfirmed: isCleanupConfirmed,
  })}\n`,
);

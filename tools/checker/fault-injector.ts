/**
 * Node.js組み込みモジュールだけでチェッカーの異常系を再現する試験用注入器。
 *
 * 本ファイルは配布用チェッカーから参照されない。子プロセスの起動時に
 * NODE_OPTIONS=--import=...として読み込み、OS障害や競合状態を決定論的に
 * 再現する。
 */

import { createRequire, syncBuiltinESMExports } from "node:module";

type StatLike = Readonly<{
  dev?: number | bigint;
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink?: () => boolean;
}>;
type SpawnResult = Readonly<{
  status: number | null;
  stdout: string;
  stderr: string | undefined;
}>;
type MutableChildProcess = {
  spawnSync: (
    command: unknown,
    arguments_?: unknown[],
    options?: unknown,
  ) => SpawnResult;
};
type MutableFs = {
  lstatSync: (value: unknown, ...rest: unknown[]) => StatLike;
  statSync: (value: unknown, ...rest: unknown[]) => StatLike;
  readdirSync: (value: unknown, ...rest: unknown[]) => unknown;
  readFileSync: (value: unknown, ...rest: unknown[]) => unknown;
};
type MutablePath = {
  resolve: (...parts: string[]) => string;
  join: (...parts: string[]) => string;
  relative: (parent: unknown, child: unknown) => string;
};

const require = createRequire(import.meta.url);
const childProcess: MutableChildProcess = require("node:child_process");
const fs: MutableFs = require("node:fs");
const path: MutablePath = require("node:path");

const fault = process.env.CRDD_CHECK_FAULT;
const target = process.env.CRDD_CHECK_FAULT_TARGET
  ? path.resolve(process.env.CRDD_CHECK_FAULT_TARGET)
  : null;
const root = process.env.CRDD_CHECK_FAULT_ROOT
  ? path.resolve(process.env.CRDD_CHECK_FAULT_ROOT)
  : null;
const originalLstatSync = fs.lstatSync;
const originalStatSync = fs.statSync;
const originalReaddirSync = fs.readdirSync;
const originalReadFileSync = fs.readFileSync;
const originalRelative = path.relative;
const originalSpawnSync = childProcess.spawnSync;
let targetLstatCalls = 0;
let targetDirectoryRead = false;

function isTarget(value: unknown): boolean {
  return target !== null && path.resolve(String(value)) === target;
}

function missingError() {
  return Object.assign(new Error("injected missing entry"), { code: "ENOENT" });
}

if (fault === "lstat-error") {
  fs.lstatSync = function injectedLstatError(
    value: unknown,
    ...rest: unknown[]
  ) {
    if (isTarget(value)) {
      throw Object.assign(new Error("injected metadata failure"), {
        code: "EACCES",
      });
    }
    return originalLstatSync(value, ...rest);
  };
}

if (fault === "lstat-missing-after-first") {
  fs.lstatSync = function injectedMissingLstat(
    value: unknown,
    ...rest: unknown[]
  ) {
    if (isTarget(value)) {
      targetLstatCalls += 1;
      if (targetLstatCalls > 1) throw missingError();
    }
    return originalLstatSync(value, ...rest);
  };
}

if (fault === "lstat-missing") {
  fs.lstatSync = function injectedAlwaysMissingLstat(
    value: unknown,
    ...rest: unknown[]
  ) {
    if (isTarget(value)) throw missingError();
    return originalLstatSync(value, ...rest);
  };
}

if (fault === "lstat-special") {
  fs.lstatSync = function injectedSpecialLstat(
    value: unknown,
    ...rest: unknown[]
  ) {
    if (isTarget(value)) {
      return {
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => false,
      };
    }
    return originalLstatSync(value, ...rest);
  };
}

if (fault === "lstat-symbolic") {
  fs.lstatSync = function injectedSymbolicLstat(
    value: unknown,
    ...rest: unknown[]
  ) {
    if (isTarget(value)) {
      return {
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => true,
      };
    }
    return originalLstatSync(value, ...rest);
  };
}

if (fault === "lstat-replaced-after-read") {
  fs.lstatSync = function injectedReplacementLstat(
    value: unknown,
    ...rest: unknown[]
  ) {
    const stat = originalLstatSync(value, ...rest);
    if (!isTarget(value) || !targetDirectoryRead) return stat;
    const replacement = Object.assign(
      Object.create(Object.getPrototypeOf(stat)),
      stat,
    );
    Object.defineProperty(replacement, "dev", {
      configurable: true,
      enumerable: true,
      value: Number(stat.dev) + 1,
    });
    return replacement;
  };
  fs.readdirSync = function injectedReplacementReaddir(
    value: unknown,
    ...rest: unknown[]
  ) {
    const entries = originalReaddirSync(value, ...rest);
    if (isTarget(value)) targetDirectoryRead = true;
    return entries;
  };
}

if (fault === "read-file-error") {
  fs.readFileSync = function injectedReadFileError(
    value: unknown,
    ...rest: unknown[]
  ) {
    if (isTarget(value)) {
      throw Object.assign(new Error("injected read failure"), {
        code: "EACCES",
      });
    }
    return originalReadFileSync(value, ...rest);
  };
}

if (fault === "stat-special") {
  fs.statSync = function injectedSpecialStat(
    value: unknown,
    ...rest: unknown[]
  ) {
    if (isTarget(value)) {
      return {
        isDirectory: () => false,
        isFile: () => false,
      };
    }
    return originalStatSync(value, ...rest);
  };
}

if (fault === "readdir-error") {
  fs.readdirSync = function injectedReaddirError(
    value: unknown,
    ...rest: unknown[]
  ) {
    if (isTarget(value)) {
      const code = process.env.CRDD_CHECK_FAULT_ERROR_CODE || "EACCES";
      throw Object.assign(new Error(`injected readdir failure: ${code}`), {
        code,
      });
    }
    return originalReaddirSync(value, ...rest);
  };
}

if (fault === "relative-outside") {
  path.relative = function injectedOutsideRelative(
    parent: unknown,
    child: unknown,
  ) {
    if (isTarget(child)) return path.join("..", "injected-outside");
    return originalRelative(parent, child);
  };
}

if (fault === "git-root-failed" || fault === "git-root-failed-no-stderr") {
  childProcess.spawnSync = function injectedGitFailure(command: unknown) {
    if (command === "git") {
      return {
        status: 2,
        stdout: "",
        stderr:
          fault === "git-root-failed"
            ? "injected permission failure"
            : undefined,
      };
    }
    throw new Error(`Unexpected command during injected failure: ${command}`);
  };
}

if (fault === "git-list-custom") {
  childProcess.spawnSync = function injectedGitList(
    command: unknown,
    arguments_: unknown[] = [],
  ) {
    if (command !== "git") {
      throw new Error(
        `Unexpected command during injected Git list: ${command}`,
      );
    }
    if (
      arguments_[0] === "config" &&
      process.env.CRDD_CHECK_FAULT_GIT_CONFIG_FAILED === "1"
    ) {
      return {
        status: 2,
        stdout: "",
        stderr: "injected Git config parse failure",
      };
    }
    if (
      arguments_[0] === "config" &&
      process.env.CRDD_CHECK_FAULT_GIT_CONFIG_OUTPUT !== undefined
    ) {
      return {
        status: 0,
        stdout: `${process.env.CRDD_CHECK_FAULT_GIT_CONFIG_OUTPUT}\0`,
        stderr: "",
      };
    }
    if (arguments_.includes("ls-files")) {
      if (arguments_.includes("--stage")) {
        const injectedStages = JSON.parse(
          process.env.CRDD_CHECK_FAULT_GIT_STAGE_JSON || "[]",
        );
        return {
          status: 0,
          stdout: `${injectedStages.join("\0")}\0`,
          stderr: "",
        };
      }
      const injectedFiles = JSON.parse(
        process.env.CRDD_CHECK_FAULT_GIT_LIST_JSON || "[]",
      );
      return {
        status: 0,
        stdout: `${injectedFiles.join("\0")}\0`,
        stderr: "",
      };
    }
    const commandRoot = path.resolve(String(arguments_[1]));
    if (commandRoot === root) {
      return { status: 0, stdout: `${root}\n`, stderr: "" };
    }
    return { status: 1, stdout: "", stderr: "not a separate Git root" };
  };
}

if (fault === "baseline-head-failed") {
  childProcess.spawnSync = function injectedBaselineHeadFailure(
    command: unknown,
    arguments_: unknown[] = [],
    options: unknown,
  ) {
    if (
      command === "git" &&
      arguments_?.[0] === "-C" &&
      isTarget(arguments_[1]) &&
      arguments_.includes("--verify") &&
      arguments_.includes("HEAD")
    ) {
      return {
        status: 2,
        stdout: "",
        stderr: "injected baseline HEAD access failure",
      };
    }
    return originalSpawnSync(command, arguments_, options);
  };
}

if (fault === "baseline-root-case-changed") {
  childProcess.spawnSync = function injectedBaselineRootCase(
    command: unknown,
    arguments_: unknown[] = [],
    options: unknown,
  ) {
    const result = originalSpawnSync(command, arguments_, options);
    if (
      command === "git" &&
      arguments_?.[0] === "-C" &&
      isTarget(arguments_[1]) &&
      arguments_.includes("--show-toplevel") &&
      result.status === 0
    ) {
      return {
        ...result,
        stdout: result.stdout.toUpperCase(),
      };
    }
    return result;
  };
}

if (fault === "git-stage-failed") {
  childProcess.spawnSync = function injectedGitStageFailure(
    command: unknown,
    arguments_: unknown[] = [],
    options: unknown,
  ) {
    if (
      command === "git" &&
      arguments_?.includes("ls-files") &&
      arguments_.includes("--stage")
    ) {
      return {
        status: 2,
        stdout: "",
        stderr: "injected Git index mode failure",
      };
    }
    return originalSpawnSync(command, arguments_, options);
  };
}

syncBuiltinESMExports();

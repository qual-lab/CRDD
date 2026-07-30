/**
 * Node.js組み込みモジュールだけでチェッカーの異常系を再現する試験用注入器。
 *
 * 本ファイルは配布用チェッカーから参照されない。子プロセスの起動時に
 * NODE_OPTIONS=--require=...として読み込み、OS障害や競合状態を決定論的に
 * 再現する。
 */

const childProcess = require("node:child_process");
const fs = require("node:fs");
const module_ = require("node:module");
const path = require("node:path");

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

function isTarget(value) {
  return target !== null && path.resolve(String(value)) === target;
}

function missingError() {
  return Object.assign(new Error("injected missing entry"), { code: "ENOENT" });
}

if (fault === "lstat-error") {
  fs.lstatSync = function injectedLstatError(value, ...rest) {
    if (isTarget(value)) {
      throw Object.assign(new Error("injected metadata failure"), {
        code: "EACCES",
      });
    }
    return originalLstatSync.call(fs, value, ...rest);
  };
}

if (fault === "lstat-missing-after-first") {
  fs.lstatSync = function injectedMissingLstat(value, ...rest) {
    if (isTarget(value)) {
      targetLstatCalls += 1;
      if (targetLstatCalls > 1) throw missingError();
    }
    return originalLstatSync.call(fs, value, ...rest);
  };
}

if (fault === "lstat-missing") {
  fs.lstatSync = function injectedAlwaysMissingLstat(value, ...rest) {
    if (isTarget(value)) throw missingError();
    return originalLstatSync.call(fs, value, ...rest);
  };
}

if (fault === "lstat-special") {
  fs.lstatSync = function injectedSpecialLstat(value, ...rest) {
    if (isTarget(value)) {
      return {
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => false,
      };
    }
    return originalLstatSync.call(fs, value, ...rest);
  };
}

if (fault === "lstat-symbolic") {
  fs.lstatSync = function injectedSymbolicLstat(value, ...rest) {
    if (isTarget(value)) {
      return {
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => true,
      };
    }
    return originalLstatSync.call(fs, value, ...rest);
  };
}

if (fault === "lstat-replaced-after-read") {
  fs.lstatSync = function injectedReplacementLstat(value, ...rest) {
    const stat = originalLstatSync.call(fs, value, ...rest);
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
  fs.readdirSync = function injectedReplacementReaddir(value, ...rest) {
    const entries = originalReaddirSync.call(fs, value, ...rest);
    if (isTarget(value)) targetDirectoryRead = true;
    return entries;
  };
}

if (fault === "read-file-error") {
  fs.readFileSync = function injectedReadFileError(value, ...rest) {
    if (isTarget(value)) {
      throw Object.assign(new Error("injected read failure"), {
        code: "EACCES",
      });
    }
    return originalReadFileSync.call(fs, value, ...rest);
  };
}

if (fault === "stat-special") {
  fs.statSync = function injectedSpecialStat(value, ...rest) {
    if (isTarget(value)) {
      return {
        isDirectory: () => false,
        isFile: () => false,
      };
    }
    return originalStatSync.call(fs, value, ...rest);
  };
}

if (fault === "readdir-error") {
  fs.readdirSync = function injectedReaddirError(value, ...rest) {
    if (isTarget(value)) {
      const code = process.env.CRDD_CHECK_FAULT_ERROR_CODE || "EACCES";
      throw Object.assign(new Error(`injected readdir failure: ${code}`), {
        code,
      });
    }
    return originalReaddirSync.call(fs, value, ...rest);
  };
}

if (fault === "relative-outside") {
  path.relative = function injectedOutsideRelative(parent, child) {
    if (isTarget(child)) return path.join("..", "injected-outside");
    return originalRelative.call(path, parent, child);
  };
}

if (fault === "git-root-failed" || fault === "git-root-failed-no-stderr") {
  childProcess.spawnSync = function injectedGitFailure(command) {
    if (command === "git") {
      return {
        status: 2,
        stdout: "",
        stderr:
          fault === "git-root-failed" ? "injected permission failure" : undefined,
      };
    }
    throw new Error(`Unexpected command during injected failure: ${command}`);
  };
}

if (fault === "git-list-custom") {
  childProcess.spawnSync = function injectedGitList(command, arguments_) {
    if (command !== "git") {
      throw new Error(`Unexpected command during injected Git list: ${command}`);
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
    const commandRoot = path.resolve(arguments_[1]);
    if (commandRoot === root) {
      return { status: 0, stdout: `${root}\n`, stderr: "" };
    }
    return { status: 1, stdout: "", stderr: "not a separate Git root" };
  };
}

if (fault === "baseline-head-failed") {
  childProcess.spawnSync = function injectedBaselineHeadFailure(
    command,
    arguments_,
    options,
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
    return originalSpawnSync.call(
      childProcess,
      command,
      arguments_,
      options,
    );
  };
}

if (fault === "baseline-root-case-changed") {
  childProcess.spawnSync = function injectedBaselineRootCase(
    command,
    arguments_,
    options,
  ) {
    const result = originalSpawnSync.call(
      childProcess,
      command,
      arguments_,
      options,
    );
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
    command,
    arguments_,
    options,
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
    return originalSpawnSync.call(
      childProcess,
      command,
      arguments_,
      options,
    );
  };
}

module_.syncBuiltinESMExports();

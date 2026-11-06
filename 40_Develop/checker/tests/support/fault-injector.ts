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
  stdout: string | Buffer;
  stderr: string | Buffer | undefined;
}>;
type MutableChildProcess = {
  spawnSync: (
    command: unknown,
    argumentValues?: unknown[],
    options?: unknown,
  ) => SpawnResult;
};
type MutableFs = {
  openSync: (value: unknown, ...restArguments: unknown[]) => number;
  lstatSync: (value: unknown, ...restArguments: unknown[]) => StatLike;
  statSync: (value: unknown, ...restArguments: unknown[]) => StatLike;
  readdirSync: (value: unknown, ...restArguments: unknown[]) => unknown;
  readFileSync: (value: unknown, ...restArguments: unknown[]) => unknown;
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
const originalOpenSync = fs.openSync;
const originalLstatSync = fs.lstatSync;
const originalStatSync = fs.statSync;
const originalReaddirSync = fs.readdirSync;
const originalReadFileSync = fs.readFileSync;
const originalRelative = path.relative;
const originalSpawnSync = childProcess.spawnSync;
let targetLstatCalls = 0;
let isTargetDirectoryRead = false;
let gitFaultInjections = 0;

function isTarget(value: unknown): boolean {
  return target !== null && path.resolve(String(value)) === target;
}

function missingError() {
  return Object.assign(new Error("injected missing entry"), { code: "ENOENT" });
}

if (fault === "lstat-error") {
  fs.lstatSync = function injectedLstatError(
    value: unknown,
    ...restArguments: unknown[]
  ) {
    if (isTarget(value)) {
      throw Object.assign(new Error("injected metadata failure"), {
        code: "EACCES",
      });
    }
    return originalLstatSync(value, ...restArguments);
  };
}

if (fault === "lstat-missing-after-first") {
  fs.lstatSync = function injectedMissingLstat(
    value: unknown,
    ...restArguments: unknown[]
  ) {
    if (isTarget(value)) {
      targetLstatCalls += 1;
      if (targetLstatCalls > 1) throw missingError();
    }
    return originalLstatSync(value, ...restArguments);
  };
}

if (fault === "lstat-missing") {
  fs.lstatSync = function injectedAlwaysMissingLstat(
    value: unknown,
    ...restArguments: unknown[]
  ) {
    if (isTarget(value)) throw missingError();
    return originalLstatSync(value, ...restArguments);
  };
}

if (fault === "lstat-special") {
  fs.lstatSync = function injectedSpecialLstat(
    value: unknown,
    ...restArguments: unknown[]
  ) {
    if (isTarget(value)) {
      return {
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => false,
      };
    }
    return originalLstatSync(value, ...restArguments);
  };
}

if (fault === "lstat-symbolic") {
  fs.lstatSync = function injectedSymbolicLstat(
    value: unknown,
    ...restArguments: unknown[]
  ) {
    if (isTarget(value)) {
      return {
        isDirectory: () => false,
        isFile: () => false,
        isSymbolicLink: () => true,
      };
    }
    return originalLstatSync(value, ...restArguments);
  };
}

if (fault === "lstat-replaced-after-read") {
  fs.lstatSync = function injectedReplacementLstat(
    value: unknown,
    ...restArguments: unknown[]
  ) {
    const stat = originalLstatSync(value, ...restArguments);
    if (!isTarget(value) || !isTargetDirectoryRead) return stat;
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
    ...restArguments: unknown[]
  ) {
    const entries = originalReaddirSync(value, ...restArguments);
    if (isTarget(value)) isTargetDirectoryRead = true;
    return entries;
  };
}

if (fault === "read-file-error") {
  fs.readFileSync = function injectedReadFileError(
    value: unknown,
    ...restArguments: unknown[]
  ) {
    if (isTarget(value)) {
      throw Object.assign(new Error("injected read failure"), {
        code: "EACCES",
      });
    }
    return originalReadFileSync(value, ...restArguments);
  };
}

if (fault === "stat-special") {
  fs.statSync = function injectedSpecialStat(
    value: unknown,
    ...restArguments: unknown[]
  ) {
    if (isTarget(value)) {
      return {
        isDirectory: () => false,
        isFile: () => false,
      };
    }
    return originalStatSync(value, ...restArguments);
  };
}

if (fault === "readdir-error") {
  fs.readdirSync = function injectedReaddirError(
    value: unknown,
    ...restArguments: unknown[]
  ) {
    if (isTarget(value)) {
      const code = process.env.CRDD_CHECK_FAULT_ERROR_CODE || "EACCES";
      throw Object.assign(new Error(`injected readdir failure: ${code}`), {
        code,
      });
    }
    return originalReaddirSync(value, ...restArguments);
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

/** 現行の固定Git起動形式からRootと実subcommandを読み、未対応形式は注入しない。 */
function gitInvocation(
  command: unknown,
  args: readonly unknown[],
  options: unknown,
): { root: string; subcommand: string; args: readonly unknown[] } | null {
  if (command !== "git") return null;
  let commandRoot =
    typeof options === "object" &&
    options !== null &&
    "cwd" in options &&
    typeof options.cwd === "string"
      ? options.cwd
      : null;
  const flags = [
    "--no-pager",
    "--no-optional-locks",
    "--literal-pathspecs",
    "--no-replace-objects",
  ];
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (typeof arg !== "string") return null;
    if (arg === "-C" || arg === "-c") {
      const value = args[++index];
      if (typeof value !== "string") return null;
      if (arg === "-C") commandRoot = value;
      continue;
    }
    if (arg.startsWith("--work-tree=")) {
      commandRoot = arg.slice("--work-tree=".length);
      continue;
    }
    if (arg.startsWith("--git-dir=") || flags.includes(arg)) continue;
    if (arg.startsWith("-") || commandRoot === null) return null;
    return {
      root: path.resolve(commandRoot),
      subcommand: arg,
      args: args.slice(index + 1),
    };
  }
  return null;
}

if (
  fault === "git-not-repository" ||
  fault === "git-list-custom" ||
  fault === "git-stage-failed"
) {
  childProcess.spawnSync = function injectedGitObservation(
    command: unknown,
    args: unknown[] = [],
    options?: unknown,
  ) {
    const invocation = gitInvocation(command, args, options);
    if (invocation?.root === root) {
      if (
        fault === "git-not-repository" &&
        invocation.subcommand === "rev-parse" &&
        invocation.args.includes("--show-toplevel")
      ) {
        gitFaultInjections += 1;
        return {
          status: 128,
          stdout: "",
          stderr: "fatal: not a git repository",
        };
      }
      if (
        fault === "git-stage-failed" &&
        invocation.subcommand === "ls-files" &&
        invocation.args.includes("--stage")
      ) {
        gitFaultInjections += 1;
        return {
          status: 2,
          stdout: "",
          stderr: "injected Git index mode failure",
        };
      }
      if (fault === "git-list-custom") {
        if (
          invocation.subcommand === "config" &&
          process.env.CRDD_CHECK_FAULT_GIT_CONFIG_FAILED === "1"
        ) {
          gitFaultInjections += 1;
          return {
            status: 2,
            stdout: "",
            stderr: "injected Git config parse failure",
          };
        }
        if (
          invocation.subcommand === "config" &&
          process.env.CRDD_CHECK_FAULT_GIT_CONFIG_OUTPUT !== undefined
        ) {
          gitFaultInjections += 1;
          return {
            status: 0,
            stdout: `${process.env.CRDD_CHECK_FAULT_GIT_CONFIG_OUTPUT}\0`,
            stderr: "",
          };
        }
        if (invocation.subcommand === "ls-files") {
          gitFaultInjections += 1;
          const source = invocation.args.includes("--stage")
            ? process.env.CRDD_CHECK_FAULT_GIT_STAGE_JSON
            : process.env.CRDD_CHECK_FAULT_GIT_LIST_JSON;
          const values = JSON.parse(source || "[]");
          return { status: 0, stdout: `${values.join("\0")}\0`, stderr: "" };
        }
      }
    }
    return originalSpawnSync(command, args, options);
  };
}

if (fault === "baseline-head-failed" && target !== null) {
  // 配置検証のO_NOFOLLOW付きopenは維持し、Revision本文観測のread-only openだけを失敗させる。
  const marker = path.join(target, ".git");
  const markerStat = originalLstatSync(marker);
  const gitDirectory = markerStat.isDirectory()
    ? marker
    : path.resolve(
        target,
        String(originalReadFileSync(marker, "utf8"))
          .trim()
          .replace(/^gitdir:\s*/u, ""),
      );
  const head = path.resolve(gitDirectory, "HEAD");
  fs.openSync = function injectedBaselineHeadOpen(
    value: unknown,
    ...args: unknown[]
  ) {
    if (path.resolve(String(value)) === head && args[0] === "r") {
      gitFaultInjections += 1;
      throw Object.assign(new Error("injected baseline HEAD access failure"), {
        code: "EACCES",
      });
    }
    return originalOpenSync(value, ...args);
  };
}

if (
  [
    "git-not-repository",
    "git-list-custom",
    "git-stage-failed",
    "baseline-head-failed",
  ].includes(fault ?? "")
) {
  process.on("exit", () => {
    process.stderr.write(
      `CRDD_TEST_GIT_FAULT:${fault}:${gitFaultInjections}\n`,
    );
  });
}

syncBuiltinESMExports();

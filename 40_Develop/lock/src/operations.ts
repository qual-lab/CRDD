/**
 * 協調する単一Hostの利用側へwx取得・同じ世代の解放を提供する。
 * @responsibility File取得、保持中の所有照合、通常解放だけを所有する。
 * @trace ARCH-000004
 * @trace ARCH-000006
 * @trace ARCH-000008
 * @trace ARCH-000011
 * @trace ARCH-000013
 * @trace ARCH-000018
 * @boundary 最終照合後の非協調ProcessによるPath置換は原子的に防止しない。
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Lock, LockReference, LockRequest, LockResult } from "./types.ts";

const RECORD_LIMIT_BYTES = 2048;
const PROCESS_IDENTITY = randomUUID();

/** 同じ通常File実体だけを照合し、Link・複数名の実体は保持の根拠にしない。 */
function matchesFile(stat: fs.BigIntStats, reference: LockReference): boolean {
  return (
    stat.isFile() &&
    !stat.isSymbolicLink() &&
    stat.nlink === 1n &&
    stat.dev.toString() === reference.fileIdentity?.device &&
    stat.ino.toString() === reference.fileIdentity?.inode
  );
}

/** 既存Directory内の固定名を検証する。Directory作成や既存Lock削除はしない。 */
function targetPath(request: LockRequest): string | null {
  try {
    if (
      !request ||
      typeof request !== "object" ||
      typeof request.directory !== "string" ||
      !path.isAbsolute(request.directory) ||
      path.resolve(request.directory) !== request.directory ||
      typeof request.name !== "string" ||
      !/^[a-zA-Z0-9.][a-zA-Z0-9._-]{0,127}\.lock$/u.test(request.name) ||
      request.name.includes("..") ||
      typeof request.identity !== "string" ||
      !/^[a-zA-Z0-9][a-zA-Z0-9:._-]{0,255}$/u.test(request.identity)
    )
      return null;
    const stat = fs.lstatSync(request.directory);
    if (
      !stat.isDirectory() ||
      stat.isSymbolicLink() ||
      fs.realpathSync.native(request.directory) !== request.directory
    )
      return null;
    return path.join(request.directory, request.name);
  } catch {
    return null;
  }
}

/**
 * wxで一度取得する。EEXIST・不明は拒否し、残存を自動回復しない。
 * @effect 新しいLock Fileだけを作成し、descriptorを保持する。
 * @concurrency 全Callerと清掃・Recoveryが同じ協調プロトコルを守ることが前提。
 */
export function acquireLock(request: LockRequest): LockResult {
  // 呼出し後に利用側が入力Objectを書き換えても同じ対象を扱う。
  request = Object.freeze({
    directory: request?.directory,
    name: request?.name,
    identity: request?.identity,
  });
  const target = targetPath(request);
  if (target === null)
    return Object.freeze({
      status: "blocked",
      reason: "lock_input_invalid",
      reference: null,
      cleanupConfirmed: true,
      descriptorClosed: true,
    });
  const generation = randomUUID();
  const directoryStat = fs.lstatSync(request.directory, { bigint: true });
  const directoryIdentity = Object.freeze({
    device: directoryStat.dev.toString(),
    inode: directoryStat.ino.toString(),
  });
  const owner = Object.freeze({
    processId: process.pid,
    processIdentity: PROCESS_IDENTITY,
  });
  const record = Buffer.from(
    `${JSON.stringify({ schema: "crdd-lock/v1", identity: request.identity, owner, generation })}\n`,
  );
  let descriptor: number;
  try {
    descriptor = fs.openSync(target, "wx", 0o600);
  } catch (error) {
    return Object.freeze({
      status: "blocked",
      reason:
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "EEXIST"
          ? "lock_exists"
          : "lock_observation_unknown",
      reference: null,
      cleanupConfirmed: Boolean(
        error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "EEXIST",
      ),
      descriptorClosed: true,
    });
  }
  let reference: LockReference = Object.freeze({
    ...request,
    owner,
    generation,
    directoryIdentity,
    fileIdentity: null,
  });
  try {
    const stat = fs.fstatSync(descriptor, { bigint: true });
    reference = Object.freeze({
      ...reference,
      fileIdentity: Object.freeze({
        device: stat.dev.toString(),
        inode: stat.ino.toString(),
      }),
    });
    if (!matchesFile(stat, reference))
      throw Error("lock_file_identity_invalid");
    fs.writeFileSync(descriptor, record);
    fs.fsyncSync(descriptor);
  } catch {
    let descriptorClosed = false;
    try {
      fs.closeSync(descriptor);
      descriptorClosed = true;
    } catch {
      /* Fileと終了不明を保全する。 */
    }
    return Object.freeze({
      status: "blocked",
      reason: "lock_initialization_failed",
      reference,
      cleanupConfirmed: false,
      descriptorClosed,
    });
  }
  let released = false;
  let descriptorOpen = true;
  const matchesPath = (): boolean => {
    try {
      if (targetPath(request) !== target) return false;
      const currentDirectory = fs.lstatSync(request.directory, {
        bigint: true,
      });
      if (
        currentDirectory.dev.toString() !== directoryIdentity.device ||
        currentDirectory.ino.toString() !== directoryIdentity.inode
      )
        return false;
      const stat = fs.lstatSync(target, { bigint: true });
      return (
        matchesFile(stat, reference) &&
        stat.size === BigInt(record.length) &&
        stat.size <= BigInt(RECORD_LIMIT_BYTES) &&
        fs.readFileSync(target).equals(record)
      );
    } catch {
      return false;
    }
  };
  const assertLive = (): boolean => {
    try {
      if (
        released ||
        !descriptorOpen ||
        !matchesFile(fs.fstatSync(descriptor, { bigint: true }), reference)
      )
        return false;
      return matchesPath();
    } catch {
      return false;
    }
  };
  const lock: Lock = Object.freeze({
    reference,
    assertLive,
    release() {
      if (released) return false;
      const matched = assertLive();
      released = true;
      try {
        fs.closeSync(descriptor);
        descriptorOpen = false;
      } catch {
        return false;
      }
      if (!matched || !matchesPath()) return false;
      // 正規Callerは保持中に置換しない。非協調の最終照合後置換は保証対象外。
      try {
        fs.rmSync(target);
        try {
          const current = fs.lstatSync(target, { bigint: true });
          // 解放直後の正当な次Ownerは削除せず、元Fileの残存と区別する。
          return (
            !matchesFile(current, reference) ||
            !fs.readFileSync(target).equals(record)
          );
        } catch (error) {
          return Boolean(
            error &&
              typeof error === "object" &&
              "code" in error &&
              error.code === "ENOENT",
          );
        }
      } catch {
        return false;
      }
    },
  });
  if (!assertLive()) {
    // 初期化直後の不一致でも不明なPathを削除しない。
    released = true;
    try {
      fs.closeSync(descriptor);
      descriptorOpen = false;
    } catch {
      /* 終了不明を返す。 */
    }
    return Object.freeze({
      status: "blocked",
      reason: "lock_initialization_failed",
      reference,
      cleanupConfirmed: false,
      descriptorClosed: !descriptorOpen,
    });
  }
  return Object.freeze({ status: "acquired", lock });
}

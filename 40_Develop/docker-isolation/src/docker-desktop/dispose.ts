/**
 * 固定修復退避Root全体の削除と不存在確認を所有する。
 * @packageDocumentation
 * @responsibility Root照合・削除要求・完了後観測を分離し、部分失敗を成功へ畳まない。
 * @trace ARCH-000008
 * @boundary DI内部の固定対象→Node Filesystem。任意Path削除をRoot公開しない。
 */
import fs from "node:fs";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { types } from "node:util";
import type { RepairCheckpoint } from "./types.ts";

/**
 * Root・親・sourceの通常Directoryまたは明示不存在を読む。
 * @responsibility 不明・明示Link・別正規PathをDirectoryへ補完しない。
 * @trace ARCH-000008
 * @effect lstat／realpath読取りのみ。
 * @failure ENOENTだけnull、その他はthrowして外側の処置を止める。
 */
function readDirectory(target: string): fs.BigIntStats | null {
  let stat: fs.BigIntStats;
  try {
    stat = fs.lstatSync(target, { bigint: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
  if (
    !stat.isDirectory() ||
    stat.isSymbolicLink() ||
    stat.dev <= 0n ||
    stat.ino <= 0n ||
    stat.birthtimeNs <= 0n ||
    fs.realpathSync
      .native(target)
      .replace(/^\\\\\?\\/u, "")
      .toLocaleLowerCase("en-US") !== target.toLocaleLowerCase("en-US")
  )
    throw new Error("repair_directory_identity_unknown");
  return stat;
}

/** 同じNode実体だけを比較し、Directory内容の更新時刻をIdentityへ含めない。 */
function sameDirectory(
  left: fs.BigIntStats | null,
  right: fs.BigIntStats | null,
): boolean {
  return left && right
    ? left.dev === right.dev &&
        left.ino === right.ino &&
        left.birthtimeNs === right.birthtimeNs
    : left === right;
}

/**
 * 固定退避Rootを照合し、一回のNode再帰削除API要求の完了を待つ。
 * @responsibility 子の用途・種類を選別せず、削除後の不存在と要求履歴を返す。
 * @trace ARCH-000008
 * @input targets: 固定factoryの同親source／target、expected: 保存済み退避Root実体、boundary: 現在許可。
 * @returns 今回の要求発行と現在不存在。不明に生Pathを含めない。
 * @precondition 上位が廃棄意図・非使用・排他と同じ対象を確認済み。
 * @postcondition rmの完了前に戻らず、要求後の例外・取消でもissuedを保持する。
 * @effect 固定targetへのrecursive rm API要求一回。maxRetries=0、force=false。
 * @failure 事前不明は要求0。部分削除・後観測・許可不明はissued／unknown。
 * @invariant 保存・新Lock・自動回復・任意Path削除を追加しない。
 * @security Root・親・sourceを直前再照合。敵対的な確認後差替えや全外側metadata不変は保証しない。
 * @concurrency 開始前は取消可能。開始後はNode処理をjoinし、途中取消・巻戻しは提供しない。
 */
export async function disposeDockerRepairDirectory(
  targets: Readonly<{ source: string; target: string }>,
  expected: RepairCheckpoint["directories"]["primary"]["expected"],
  boundary: () => unknown,
): Promise<
  Readonly<{
    request: "not_issued" | "issued";
    absence: "confirmed_absent" | "unknown";
  }>
> {
  let request: "not_issued" | "issued" = "not_issued";
  const permitted = () => {
    try {
      const value = boundary();
      if (types.isPromise(value))
        void Promise.prototype.then.call(
          value,
          () => undefined,
          () => undefined,
        );
      return value === true;
    } catch {
      return false;
    }
  };
  try {
    const parent = path.win32.dirname(targets.target);
    if (
      parent !== path.win32.dirname(targets.source) ||
      targets.source === targets.target ||
      !permitted()
    )
      return Object.freeze({ request, absence: "unknown" });
    const parentIdentity = readDirectory(parent);
    if (!parentIdentity) return Object.freeze({ request, absence: "unknown" });
    const rootIdentity = readDirectory(targets.target);
    // 無処置の不存在確認に、別Pathの現在source成立を要求しない。
    if (!rootIdentity)
      return Object.freeze({
        request,
        absence:
          readDirectory(targets.target) === null &&
          sameDirectory(readDirectory(parent), parentIdentity) &&
          permitted()
            ? "confirmed_absent"
            : "unknown",
      });
    const sourceIdentity = readDirectory(targets.source);
    if (
      !expected ||
      String(rootIdentity.dev) !== expected.dev ||
      String(rootIdentity.ino) !== expected.ino ||
      String(rootIdentity.birthtimeNs) !== expected.birthtimeNs ||
      (sourceIdentity &&
        rootIdentity.dev === sourceIdentity.dev &&
        rootIdentity.ino === sourceIdentity.ino)
    )
      return Object.freeze({ request, absence: "unknown" });
    await setImmediate();
    if (
      !permitted() ||
      !sameDirectory(readDirectory(parent), parentIdentity) ||
      !sameDirectory(readDirectory(targets.source), sourceIdentity) ||
      !sameDirectory(readDirectory(targets.target), rootIdentity) ||
      !permitted()
    )
      return Object.freeze({ request, absence: "unknown" });
    request = "issued";
    await fs.promises.rm(targets.target, {
      recursive: true,
      force: false,
      maxRetries: 0,
    });
    if (
      readDirectory(targets.target) !== null ||
      !sameDirectory(readDirectory(parent), parentIdentity) ||
      !sameDirectory(readDirectory(targets.source), sourceIdentity) ||
      !permitted()
    )
      return Object.freeze({ request, absence: "unknown" });
    return Object.freeze({ request, absence: "confirmed_absent" });
  } catch {
    return Object.freeze({ request, absence: "unknown" });
  }
}

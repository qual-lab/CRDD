/**
 * 固定修復退避先だけの有界・非再帰回収を所有する。
 * @packageDocumentation
 * @responsibility freshな実体確認と各削除要求、現在不存在を分離する。
 * @trace ARCH-000008
 * @boundary DI内部。固定factory由来の対象だけを扱いRoot公開APIにはしない。
 */
import fs from "node:fs";
import path from "node:path";
import { setImmediate } from "node:timers/promises";
import { types } from "node:util";
import {
  observeWindowsFilesystemEntry,
  type WindowsEntryObservation,
} from "../../../platform-access/src/index.ts";
import type { RepairCheckpoint } from "./types.ts";

const maximumEntries = 256;
const maximumDepth = 8;

/**
 * 同じ観測経路の実体だけを比較する局所値。
 * @responsibility Node通常実体とNative特殊端点の単位を混用しない。
 * @trace ARCH-000008
 * @invariant 経路変更・不明・不存在を同一実体にしない。
 */
type Present =
  | Readonly<{
      status: "present";
      source: "node";
      kind: "directory" | "leaf";
      stat: fs.BigIntStats;
    }>
  | Readonly<{
      status: "present";
      source: "socket";
      kind: "leaf";
      native: Extract<WindowsEntryObservation, { status: "present" }>;
    }>;
type EntryObservation = Present | Readonly<{ status: "confirmed_absent" }>;

/**
 * 同じ経路の前後実体を比較する。
 * @responsibility NodeとNativeの識別値を変換せず、欠測を一致にしない。
 * @trace ARCH-000008
 * @effect N/A: 値比較のみ。
 */
function sameEntry(
  left: EntryObservation | null,
  right: EntryObservation | null,
): boolean {
  if (left?.status !== "present" || right?.status !== "present") return false;
  if (left.source === "node" && right.source === "node")
    return (
      left.kind === right.kind &&
      left.stat.dev === right.stat.dev &&
      left.stat.ino === right.stat.ino &&
      left.stat.birthtimeNs === right.stat.birthtimeNs &&
      (left.kind === "directory" || left.stat.nlink === right.stat.nlink)
    );
  if (left.source !== "socket" || right.source !== "socket") return false;
  return (
    left.native.attributes === right.native.attributes &&
    left.native.reparseTag === right.native.reparseTag &&
    left.native.linkCount === right.native.linkCount &&
    left.native.identity.volumeSerialNumber ===
      right.native.identity.volumeSerialNumber &&
    left.native.identity.fileIndex === right.native.identity.fileIndex &&
    left.native.identity.creationTime === right.native.identity.creationTime
  );
}

/**
 * 通常実体はNodeだけで観測し、特殊候補だけ既存AF_UNIX観測へ渡す。
 * @responsibility 明示Link・hardlink・別Path・不明を通常実体へ救済しない。
 * @trace ARCH-000008
 * @input target: 固定Rootまたは検証した直下名から導出したPath。
 * @returns 実体・明示不存在、または観測不能のnull。
 * @effect lstat／realpath。権限エラーまたは非通常型に限り固定Native読取り。
 * @failure ENOENT以外の失敗を不存在へ変換しない。
 * @security raw reparse属性の網羅検査や観測後の差替え防止は保証しない。
 */
function observeEntry(target: string): EntryObservation | null {
  let stat: fs.BigIntStats | null = null;
  try {
    stat = fs.lstatSync(target, { bigint: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return Object.freeze({ status: "confirmed_absent" });
    if (code !== "EACCES" && code !== "EPERM") return null;
  }
  if (stat) {
    if (stat.isSymbolicLink()) return null;
    if (stat.isDirectory() || stat.isFile()) {
      if (
        stat.dev <= 0n ||
        stat.ino <= 0n ||
        stat.birthtimeNs <= 0n ||
        stat.nlink <= 0n ||
        (!stat.isDirectory() && stat.nlink !== 1n)
      )
        return null;
      try {
        if (
          fs.realpathSync
            .native(target)
            .replace(/^\\\\\?\\/u, "")
            .toLocaleLowerCase("en-US") !== target.toLocaleLowerCase("en-US")
        )
          return null;
      } catch {
        return null;
      }
      return Object.freeze({
        status: "present",
        source: "node",
        kind: stat.isDirectory() ? "directory" : "leaf",
        stat,
      });
    }
  }
  const native = observeWindowsFilesystemEntry(target);
  if (
    native?.status !== "present" ||
    (native.attributes & (0x40 | 0x10)) !== 0 ||
    (native.attributes & 0x400) === 0 ||
    native.reparseTag !== 0x80000023 ||
    native.linkCount !== 1
  )
    return null;
  return Object.freeze({
    status: "present",
    source: "socket",
    kind: "leaf",
    native,
  });
}

/**
 * 固定targetの残存物だけを回収し、要求事実と不存在を返す。
 * @responsibility 全preflight後に一entryずつfresh確認し、部分成功を全体成功へしない。
 * @trace ARCH-000008
 * @input targets: 固定factoryの同親source／target、expected: 保存済みRoot実体、boundary: 現在Owner／Scope確認。
 * @returns 今回の要求到達と現在不存在。不明の理由に生Pathを含めない。
 * @precondition 上位が同呼出しの意図保存・読戻し・解放と旧OwnerのEffect不能を確認済み。
 * @postcondition 元checkpoint、source、兄弟を変更せず、要求到達後の失敗はissuedを保持する。
 * @effect 固定旧target配下だけの単発unlink／空Directory rmdir。
 * @failure 初期不明は削除0。部分処置／後観測不明はabsence unknown。
 * @invariant 任意Root・再帰rm・新しい共有状態／排他を作らない。
 * @boundary Root非公開の内部技術処理。保存・Session・上位終端は別に接続する。
 * @security 親／Root／sourceを前後再確認し、明示Link・hardlink・別実体を拒否する。特殊端点だけ既知tagを要求する。
 * @concurrency entry間で取消を受付け、Native同期最大5秒中の即時取消は保証しない。
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
  /**
   * 現在許可を同期のtrueだけで確認する。
   * @responsibility Promise拒否を未処理にせず非同期許可を拒否する。
   * @trace ARCH-000008
   * @input N/A: 同呼出しのboundary。
   * @returns 同期trueだけ。
   * @precondition 固定factory由来のcallback。
   * @postcondition thenableを実行しない。
   * @effect callback一回、真正Promiseの拒否処理。
   * @failure 例外・不明・Promiseはfalse。
   * @invariant async結果を処置許可へ昇格しない。
   * @boundary 現在Ownerと物理要求。
   * @security Authorityを新設しない。
   * @concurrency 待機後・処置前に再確認する。
   */
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
      throw new Error("repair_disposal_scope_unknown");
    const parentObservation = observeEntry(parent);
    if (
      parentObservation?.status !== "present" ||
      parentObservation.source !== "node" ||
      parentObservation.kind !== "directory"
    )
      throw new Error("repair_disposal_parent_unknown");
    // 無処置の不存在確認に、別Pathの稼働中sourceの成立を要求しない。
    if (observeEntry(targets.target)?.status === "confirmed_absent") {
      try {
        fs.lstatSync(targets.target);
        throw new Error("repair_disposal_absence_mismatch");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (!sameEntry(observeEntry(parent), parentObservation) || !permitted())
        throw new Error("repair_disposal_boundary_unknown");
      return Object.freeze({ request, absence: "confirmed_absent" });
    }
    const sourceObservation = observeEntry(targets.source);
    if (
      !sourceObservation ||
      (sourceObservation.status === "present" &&
        (sourceObservation.source !== "node" ||
          sourceObservation.kind !== "directory"))
    )
      throw new Error("repair_disposal_source_unknown");
    const sourceNode =
      sourceObservation.status === "present" &&
      sourceObservation.source === "node"
        ? sourceObservation.stat
        : null;
    /**
     * 親と現在sourceの前後不変を確認する。
     * @responsibility 保存された旧target以外へ処置を広げない。
     * @trace ARCH-000008
     * @input N/A: 同呼出しの捕捉値だけ。
     * @returns 同期の全条件肯定だけtrue。
     * @precondition 初回の親／source観測が成立済み。
     * @postcondition 元観測を更新しない。
     * @effect 親・sourceのNode読取り。
     * @failure 不明・例外・Promise・差は外側で停止。
     * @invariant sourceを削除集合へ追加しない。
     * @boundary 固定Scopeと現在許可。
     * @security 異なる親・実体を拒否する。
     * @concurrency 各待機後・処置直前・処置後に使用する。
     */
    const baseGuard = () => {
      if (!permitted()) return false;
      if (!sameEntry(observeEntry(parent), parentObservation)) return false;
      const currentSource = observeEntry(targets.source);
      if (
        sourceNode
          ? !sameEntry(currentSource, sourceObservation)
          : currentSource?.status !== "confirmed_absent"
      )
        return false;
      return permitted();
    };
    if (!baseGuard()) throw new Error("repair_disposal_boundary_unknown");
    const rootObservation = observeEntry(targets.target);
    if (rootObservation?.status === "confirmed_absent") {
      try {
        fs.lstatSync(targets.target);
        throw new Error("repair_disposal_absence_mismatch");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (!baseGuard()) throw new Error("repair_disposal_boundary_unknown");
      return Object.freeze({ request, absence: "confirmed_absent" });
    }
    if (
      rootObservation?.status !== "present" ||
      rootObservation.source !== "node" ||
      rootObservation.kind !== "directory"
    )
      throw new Error("repair_disposal_root_unknown");
    const rootNode = rootObservation.stat;
    if (
      !expected ||
      String(rootNode.dev) !== expected.dev ||
      String(rootNode.ino) !== expected.ino ||
      String(rootNode.birthtimeNs) !== expected.birthtimeNs ||
      sameEntry(rootObservation, sourceObservation) ||
      (sourceNode &&
        rootNode.dev === sourceNode.dev &&
        rootNode.ino === sourceNode.ino)
    )
      throw new Error("repair_disposal_root_unknown");
    const nodes: {
      target: string;
      observed: Present;
      kind: "directory" | "leaf";
    }[] = [];
    /**
     * 有界な全対象を削除前に分類する。
     * @responsibility 未許可entryを初期検出した場合は全削除0にする。
     * @trace ARCH-000008
     * @input target: 固定Rootか実列挙した子、depth: Rootを0とする深さ。
     * @returns 全対象が許可集合内なら完了。
     * @precondition 親がNodeの通常Directory・正規Pathとして観測済み。
     * @postcondition Rootを含め256entry／深さ8を超えて処置しない。
     * @effect 有界opendir/read/closeと実体読取り、local待機だけ。
     * @failure 不明・列挙／close失敗・上限超過ではthrow。
     * @invariant Direntの型だけでは処置せず、各entryを改めて観測する。
     * @boundary 固定Root配下のpreflight。
     * @security 相対名・case重複・範囲外Pathを拒否する。
     * @concurrency entry間待機後も現在条件を確認する。
     */
    const collect = async (target: string, depth: number): Promise<void> => {
      await setImmediate();
      if (
        depth > maximumDepth ||
        nodes.length >= maximumEntries ||
        !baseGuard()
      )
        throw new Error("repair_disposal_preflight_unknown");
      const observed = observeEntry(target);
      const kind = observed?.status === "present" ? observed.kind : null;
      if (!kind || observed?.status !== "present")
        throw new Error("repair_disposal_type_unknown");
      nodes.push({ target, observed, kind });
      if (kind !== "directory") return;
      const directory = fs.opendirSync(target, { bufferSize: 32 });
      try {
        const names = new Set<string>();
        for (
          let entry = directory.readSync();
          entry;
          entry = directory.readSync()
        ) {
          const name = entry.name;
          if (
            !name ||
            name === "." ||
            name === ".." ||
            /[\\/\u0000-\u001f\u007f:<>"|?*]/u.test(name) ||
            /[. ]$/u.test(name) ||
            /^(?:CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[1-9¹²³]|LPT[1-9¹²³])(?:\.|$)/iu.test(
              name,
            ) ||
            names.has(name.toLocaleLowerCase("en-US"))
          )
            throw new Error("repair_disposal_name_unknown");
          names.add(name.toLocaleLowerCase("en-US"));
          const joined = path.win32.join(target, name);
          if (path.win32.dirname(joined) !== target)
            throw new Error("repair_disposal_name_unknown");
          await collect(joined, depth + 1);
        }
      } finally {
        directory.closeSync();
      }
    };
    await collect(targets.target, 0);
    const remaining = new Set(nodes.map((node) => node.target));
    const observedNodes = new Map(nodes.map((node) => [node.target, node]));
    /**
     * 処置経路の祖先だけを実体と直下残存名で再確認する。
     * @responsibility 途中の追加・差替えを次要求前に止める。
     * @trace ARCH-000008
     * @input target: 今回処置する既知node。
     * @returns Rootまでの祖先が一致する場合だけtrue。
     * @precondition 全preflightと固定Rootの照合済み。
     * @postcondition 既存観測と残存集合を変更しない。
     * @effect 有界列挙とNode実体読取りだけ。
     * @failure 不明・集合差・close失敗は停止。
     * @invariant Root外・未走査別枝の全域保証へ広げない。
     * @boundary 同呼出しの一時集合とFilesystem。
     * @security 各祖先の明示Link・実体差替えを拒否する。全raw reparse属性の検査は主張しない。
     * @concurrency 各待機後・要求前に使用する。
     */
    const ancestorsMatch = (target: string) => {
      let directory =
        observedNodes.get(target)?.kind === "directory"
          ? target
          : path.win32.dirname(target);
      for (;;) {
        const expectedNode = observedNodes.get(directory);
        if (
          expectedNode?.kind !== "directory" ||
          !sameEntry(observeEntry(directory), expectedNode.observed)
        )
          return false;
        const expected = new Set(
          Array.from(remaining)
            .filter(
              (entry) =>
                entry !== directory && path.win32.dirname(entry) === directory,
            )
            .map((entry) => path.win32.basename(entry)),
        );
        const handle = fs.opendirSync(directory, { bufferSize: 1 });
        try {
          for (
            let entry = handle.readSync();
            entry;
            entry = handle.readSync()
          ) {
            if (!expected.delete(entry.name)) return false;
          }
          if (expected.size !== 0) return false;
        } finally {
          handle.closeSync();
        }
        if (directory === targets.target) return true;
        directory = path.win32.dirname(directory);
      }
    };
    for (const node of nodes.reverse()) {
      await setImmediate();
      if (
        !baseGuard() ||
        !sameEntry(observeEntry(targets.target), rootObservation) ||
        !sameEntry(observeEntry(node.target), node.observed) ||
        !ancestorsMatch(node.target) ||
        !permitted()
      )
        throw new Error("repair_disposal_entry_changed");
      if (node.kind === "directory") {
        const directory = fs.opendirSync(node.target, { bufferSize: 1 });
        let empty: boolean;
        try {
          empty = directory.readSync() === null;
        } finally {
          directory.closeSync();
        }
        if (!empty || !permitted())
          throw new Error("repair_disposal_directory_changed");
        request = "issued";
        fs.rmdirSync(node.target);
      } else {
        request = "issued";
        fs.unlinkSync(node.target);
      }
      if (
        observeEntry(node.target)?.status !== "confirmed_absent" ||
        !baseGuard()
      )
        throw new Error("repair_disposal_absence_unknown");
      remaining.delete(node.target);
    }
    try {
      fs.lstatSync(targets.target);
      throw new Error("repair_disposal_absence_mismatch");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return Object.freeze({ request, absence: "confirmed_absent" });
  } catch {
    return Object.freeze({ request, absence: "unknown" });
  }
}

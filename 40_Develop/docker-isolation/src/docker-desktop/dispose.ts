/**
 * 固定修復退避先だけの有界・非再帰回収を所有する。
 * @packageDocumentation
 * @responsibility freshな実体確認と各削除要求、現在不存在を分離する。
 * @trace ARCH-000008
 * @boundary DI内部。固定factory由来の対象だけを扱いRoot公開APIにはしない。
 */
import type { DockerRuntimeRepairCheckpoint } from "../../../domain-model/src/index.ts";
import fs from "node:fs";
import path from "node:path";
import { setImmediate as yieldToOwner } from "node:timers/promises";
import { types } from "node:util";
import {
  observeWindowsFilesystemEntry,
  type WindowsEntryObservation,
} from "../../../platform-access/src/index.ts";

const maximumEntries = 256;
const maximumDepth = 8;

/**
 * Nativeのpresent観測だけを保持する内部型。
 * @responsibility 不存在・不明を実体値へ補完しない。
 * @trace ARCH-000008
 * @shape Platform Accessのpresent variant。
 * @invariant Native固有の実体単位を維持する。
 * @boundary DI内部の観測比較。
 * @security Authorityを持たない。
 * @compatibility 現行Platform Access契約だけ。
 */
type Present = Extract<WindowsEntryObservation, { status: "present" }>;

/**
 * Nativeの実体・型・tag・link数を全fieldで比較する。
 * @responsibility 観測不能同士を一致にしない。
 * @trace ARCH-000008
 * @input left、right: 同じ固定Pathの前後観測。
 * @returns 両方presentで全field一致の場合だけtrue。
 * @precondition 固定Nativeの閉じた観測値を使う。
 * @postcondition 入力と単位を変更しない。
 * @effect N/A: 値比較だけ。
 * @failure 欠測・不存在・差はfalse。
 * @invariant Node実体と混用しない。
 * @boundary DI内部。
 * @security 一致は削除許可ではない。
 * @concurrency 同期比較だけ。
 */
function sameNative(
  left: WindowsEntryObservation | null,
  right: WindowsEntryObservation | null,
): boolean {
  return (
    left?.status === "present" &&
    right?.status === "present" &&
    left.attributes === right.attributes &&
    left.reparseTag === right.reparseTag &&
    left.linkCount === right.linkCount &&
    left.identity.volumeSerialNumber === right.identity.volumeSerialNumber &&
    left.identity.fileIndex === right.identity.fileIndex &&
    left.identity.creationTime === right.identity.creationTime
  );
}

/**
 * 許可する物理entryの型だけを分類する。
 * @responsibility AF_UNIX以外のreparseやhardlinkを通常fileへfallbackしない。
 * @trace ARCH-000008
 * @input value: 固定Native観測。
 * @returns directory、leaf、または不許可のnull。
 * @precondition 対象Scope・実体・Ownerは別確認。
 * @postcondition tagや実体を補完しない。
 * @effect N/A: raw属性の分類だけ。
 * @failure 未観測・device・未知tag・非DirectoryのlinkCount不一致はnull。
 * @invariant AF_UNIXは正確なtag・非Directory・linkCount1だけ。
 * @boundary raw観測とDIの許可集合。
 * @security 型の許可だけでは削除しない。
 * @concurrency 同期比較だけ。
 */
function entryKind(
  value: WindowsEntryObservation | null,
): "directory" | "leaf" | null {
  if (value?.status !== "present" || (value.attributes & 0x40) !== 0)
    return null;
  if ((value.attributes & 0x10) !== 0)
    return value.reparseTag === 0 && (value.attributes & 0x400) === 0
      ? "directory"
      : null;
  if (value.linkCount !== 1) return null;
  return (value.reparseTag === 0 && (value.attributes & 0x400) === 0) ||
    (value.reparseTag === 0x80000023 && (value.attributes & 0x400) !== 0)
    ? "leaf"
    : null;
}

/**
 * 通常DirectoryのNode実体とcanonical Pathを観測する。
 * @responsibility link・file・不正実体・別PathをDirectoryへ補完しない。
 * @trace ARCH-000008
 * @input target: factoryが導出したPath。
 * @returns 正の実体を持つDirectory stat。
 * @precondition Runtime内で対象は固定済み。
 * @postcondition 実体の単位を変更しない。
 * @effect lstat／realpath読取りだけ。
 * @failure 不明・型差・Path差ではthrowし外側が処置を停止する。
 * @invariant Node実体はNode同士で比較する。
 * @boundary DIとFilesystem。
 * @security 任意PathをRoot APIへ公開しない。
 * @concurrency 各境界でfreshに呼ぶ。
 */
function nodeDirectory(target: string): fs.BigIntStats {
  const stat = fs.lstatSync(target, { bigint: true });
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
 * @security 親／Root／sourceを前後再確認し未知tag・hardlink・別実体を拒否する。
 * @concurrency entry間で取消を受付け、Native同期最大5秒中の即時取消は保証しない。
 */
export async function disposeDockerRepairDirectory(
  targets: Readonly<{ source: string; target: string }>,
  expected: DockerRuntimeRepairCheckpoint["directories"]["primary"]["expected"],
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
    const parentNode = nodeDirectory(parent);
    const parentNative = observeWindowsFilesystemEntry(parent);
    if (entryKind(parentNative) !== "directory")
      throw new Error("repair_disposal_parent_unknown");
    // 無処置の不存在確認に、別Pathの稼働中sourceの成立を要求しない。
    if (
      observeWindowsFilesystemEntry(targets.target)?.status ===
      "confirmed_absent"
    ) {
      try {
        fs.lstatSync(targets.target);
        throw new Error("repair_disposal_absence_mismatch");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const currentParent = nodeDirectory(parent);
      if (
        currentParent.dev !== parentNode.dev ||
        currentParent.ino !== parentNode.ino ||
        currentParent.birthtimeNs !== parentNode.birthtimeNs ||
        !sameNative(observeWindowsFilesystemEntry(parent), parentNative) ||
        !permitted()
      )
        throw new Error("repair_disposal_boundary_unknown");
      return Object.freeze({ request, absence: "confirmed_absent" });
    }
    let sourceNode: fs.BigIntStats | null;
    try {
      sourceNode = nodeDirectory(targets.source);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      sourceNode = null;
    }
    const sourceNative = observeWindowsFilesystemEntry(targets.source);
    if (
      sourceNode
        ? entryKind(sourceNative) !== "directory"
        : sourceNative?.status !== "confirmed_absent"
    )
      throw new Error("repair_disposal_source_unknown");
    /**
     * 親と現在sourceの前後不変を確認する。
     * @responsibility 保存された旧target以外へ処置を広げない。
     * @trace ARCH-000008
     * @input N/A: 同呼出しの捕捉値だけ。
     * @returns 同期の全条件肯定だけtrue。
     * @precondition 初回の親／source観測が成立済み。
     * @postcondition 元観測を更新しない。
     * @effect 親・sourceのNode／Native読取り。
     * @failure 不明・例外・Promise・差は外側で停止。
     * @invariant sourceを削除集合へ追加しない。
     * @boundary 固定Scopeと現在許可。
     * @security 異なる親・実体を拒否する。
     * @concurrency 各待機後・処置直前・処置後に使用する。
     */
    const baseGuard = () => {
      if (!permitted()) return false;
      const currentParent = nodeDirectory(parent);
      if (
        currentParent.dev !== parentNode.dev ||
        currentParent.ino !== parentNode.ino ||
        currentParent.birthtimeNs !== parentNode.birthtimeNs ||
        !sameNative(observeWindowsFilesystemEntry(parent), parentNative)
      )
        return false;
      if (sourceNode) {
        const currentSource = nodeDirectory(targets.source);
        if (
          currentSource.dev !== sourceNode.dev ||
          currentSource.ino !== sourceNode.ino ||
          currentSource.birthtimeNs !== sourceNode.birthtimeNs ||
          !sameNative(
            observeWindowsFilesystemEntry(targets.source),
            sourceNative,
          )
        )
          return false;
      } else {
        try {
          fs.lstatSync(targets.source);
          return false;
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if (
          observeWindowsFilesystemEntry(targets.source)?.status !==
          "confirmed_absent"
        )
          return false;
      }
      return permitted();
    };
    if (!baseGuard()) throw new Error("repair_disposal_boundary_unknown");
    const rootNative = observeWindowsFilesystemEntry(targets.target);
    if (rootNative?.status === "confirmed_absent") {
      try {
        fs.lstatSync(targets.target);
        throw new Error("repair_disposal_absence_mismatch");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (!baseGuard()) throw new Error("repair_disposal_boundary_unknown");
      return Object.freeze({ request, absence: "confirmed_absent" });
    }
    const rootNode = nodeDirectory(targets.target);
    if (
      !expected ||
      String(rootNode.dev) !== expected.dev ||
      String(rootNode.ino) !== expected.ino ||
      String(rootNode.birthtimeNs) !== expected.birthtimeNs ||
      entryKind(rootNative) !== "directory" ||
      sameNative(rootNative, sourceNative) ||
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
     * @precondition 親の非reparse Directory観測が成立済み。
     * @postcondition Rootを含め256entry／深さ8を超えて処置しない。
     * @effect 有界opendir/read/closeとNative読取り、local待機だけ。
     * @failure 不明・列挙／close失敗・上限超過ではthrow。
     * @invariant Node Direntの型をNative型の代用にしない。
     * @boundary 固定Root配下のpreflight。
     * @security 相対名・case重複・範囲外Pathを拒否する。
     * @concurrency entry間待機後も現在条件を確認する。
     */
    const collect = async (target: string, depth: number): Promise<void> => {
      await yieldToOwner();
      if (
        depth > maximumDepth ||
        nodes.length >= maximumEntries ||
        !baseGuard()
      )
        throw new Error("repair_disposal_preflight_unknown");
      const observed = observeWindowsFilesystemEntry(target);
      const kind = entryKind(observed);
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
            /[\\/:]/u.test(name) ||
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
     * @effect 有界列挙とNative読取りだけ。
     * @failure 不明・集合差・close失敗は停止。
     * @invariant Root外・未走査別枝の全域保証へ広げない。
     * @boundary 同呼出しの一時集合とFilesystem。
     * @security 各祖先のreparse差替えを拒否する。
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
          !sameNative(
            observeWindowsFilesystemEntry(directory),
            expectedNode.observed,
          )
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
      await yieldToOwner();
      const currentRoot = nodeDirectory(targets.target);
      if (
        !baseGuard() ||
        currentRoot.dev !== rootNode.dev ||
        currentRoot.ino !== rootNode.ino ||
        currentRoot.birthtimeNs !== rootNode.birthtimeNs ||
        !sameNative(
          observeWindowsFilesystemEntry(targets.target),
          rootNative,
        ) ||
        !sameNative(
          observeWindowsFilesystemEntry(node.target),
          node.observed,
        ) ||
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
        observeWindowsFilesystemEntry(node.target)?.status !==
          "confirmed_absent" ||
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

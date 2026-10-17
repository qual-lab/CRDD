/**
 * 開発実測が比較する固定範囲のSourceを読み取り、内容と実体を分けて観測する。
 *
 * @responsibility Sessionと実測入力生成が同じ有界Snapshot規則を使用する。
 * @trace ARCH-000004
 */
import { createHash } from "node:crypto";
import {
  type BigIntStats,
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  opendirSync,
  readSync,
  realpathSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_SCOPE = "crdd-development-source-snapshot/v1";
const PACKAGES = [
  "access-management",
  "ai-adapter",
  "artifact-signing",
  "coordinator",
  "docker-isolation",
  "domain-model",
  "execution-intelligence",
  "mcp-server",
  "orchestrator",
  "platform-access",
  "version-control",
] as const;
const DIRECTORIES = ["src", "bin", "runtime", "scripts", "policies"] as const;
const sourceRoot = path.resolve(
  fileURLToPath(new URL("../../../../", import.meta.url)),
);
const MAX_FILES = 2048;
const MAX_DIRECTORIES = 2048;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
const MAX_DEPTH = 8;

/**
 * Snapshotの観測事実を保持する。実行許可や配布元真正性は表さない。
 *
 * @responsibility 再現可能な内容Hashと同Session内の実体Hashを区別する。
 * @trace ARCH-000004
 * @shape Scope、内容Hash、実体Hash、件数とbyte数を持つ不変値。
 * @invariant 内容Hashへ絶対RootとOS上の実体番号を含めない。
 * @boundary Repository内の固定Source範囲だけを表す。
 * @security 本文・秘密値・実行Authorityを返さない。
 * @compatibility Scope版が異なるHashを同じ観測契約と解釈しない。
 */
type SourceObservation = Readonly<{
  scope: typeof SOURCE_SCOPE;
  sourceSha256: string;
  sourceIdentitySha256: string;
  fileCount: number;
  totalBytes: number;
}>;

/**
 * Directory名を上限内で列挙し、同じhandleを必ず閉じる。
 *
 * @responsibility 件数拒否より先に無制限の配列を生成しない。
 * @trace ARCH-000004
 * @input directory: 固定Scope内のDirectory。
 * @returns コード単位順に並べた最大4096名。
 * @precondition 呼出し元がDirectory種別を確認している。
 * @postcondition 成功・失敗とも開いたhandleのcloseを一回試行する。
 * @effect Directoryを読取り専用で開閉する。
 * @failure 列挙・close失敗と4097件目で例外を返す。
 * @invariant 外部への書込みと永続状態を作らない。
 * @boundary Node Directory handleの所有期間。
 * @security File名だけを内部で保持し、上限を自動拡張しない。
 * @concurrency 後続の二読取りが追加・欠落差を照合する。
 */
function readBoundedDirectoryNames(directory: string): string[] {
  const handle = opendirSync(directory);
  const names: string[] = [];
  try {
    for (;;) {
      const entry = handle.readSync();
      if (!entry) break;
      if (names.length >= MAX_FILES + MAX_DIRECTORIES)
        throw new Error("development_source_directory_limit");
      names.push(entry.name);
    }
    return names.sort();
  } finally {
    handle.closeSync();
  }
}

/**
 * 固定Root以下を二度読み、途中で変化したSnapshotを拒否する。
 *
 * @responsibility 通常Fileの内容とRoot・Directory・File実体の前後一致を確認する。
 * @trace ARCH-000004
 * @input root: 内部で固定したSource Root。
 * @returns 一致した不変観測値。観測不能・不一致・上限超過はnull。
 * @precondition 呼出し元が観測対象Rootを固定している。
 * @postcondition 部分結果を成功値として返さない。
 * @effect Filesystemの読取りだけを行う。
 * @failure link、欠落、非通常File、読取り差、上限超過を拒否する。
 * @invariant 外部へ実行許可を発行せず、内容Hashと実体Hashを分ける。
 * @boundary Node Filesystemから読取り可能な固定Sourceだけを観測する。
 * @security linkを辿らず、外部Rootを返さず、書込みを行わない。
 * @concurrency 二読取りの差を拒否するが、ロード済みModuleとの原子的同一性は保証しない。
 */
function captureDevelopmentSource(root: string): SourceObservation | null {
  try {
    const passes: string[] = [];
    let result: SourceObservation | null = null;
    for (let pass = 0; pass < 2; pass += 1) {
      const content: unknown[] = [SOURCE_SCOPE, PACKAGES, DIRECTORIES];
      const identities: unknown[] = [];
      let fileCount = 0;
      let directoryCount = 0;
      let totalBytes = 0;
      const packagesWithSource = new Set<string>();
      const pending: Array<{
        absolute: string;
        relative: string;
        depth: number;
      }> = [];
      // Root parents are checked independently; root mtime is intentionally not
      // included because excluded .crdd/document updates do not change Source.
      for (const absolute of [root, path.join(root, "40_Develop")]) {
        const stat = lstatSync(absolute, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
        if (path.resolve(realpathSync(absolute)) !== path.resolve(absolute))
          return null;
        identities.push([
          absolute === root ? "." : "40_Develop",
          String(stat.dev),
          String(stat.ino),
          String(stat.birthtimeNs),
        ]);
      }
      for (const packageName of PACKAGES) {
        const relative = `40_Develop/${packageName}`;
        const absolute = path.join(root, "40_Develop", packageName);
        const stat = lstatSync(absolute, { bigint: true });
        if (!stat.isDirectory() || stat.isSymbolicLink()) return null;
        identities.push([
          relative,
          String(stat.dev),
          String(stat.ino),
          String(stat.birthtimeNs),
        ]);
        pending.push({
          absolute: path.join(absolute, "package.json"),
          relative: `${relative}/package.json`,
          depth: 0,
        });
        for (const directory of DIRECTORIES) {
          const child = path.join(absolute, directory);
          let childStat: BigIntStats;
          try {
            childStat = lstatSync(child, { bigint: true });
          } catch (error) {
            if (
              (error as NodeJS.ErrnoException).code !== "ENOENT" ||
              directory === "src"
            )
              throw error;
            content.push([`${relative}/${directory}`, "absent"]);
            continue;
          }
          if (!childStat.isDirectory() || childStat.isSymbolicLink())
            return null;
          pending.push({
            absolute: child,
            relative: `${relative}/${directory}`,
            depth: 0,
          });
        }
      }
      while (pending.length > 0) {
        const entry = pending.pop();
        if (!entry) return null;
        const before = lstatSync(entry.absolute, { bigint: true });
        if (before.isSymbolicLink()) return null;
        if (entry.relative.endsWith("/package.json") && !before.isFile())
          return null;
        if (before.isDirectory()) {
          directoryCount += 1;
          if (directoryCount > MAX_DIRECTORIES || entry.depth > MAX_DEPTH)
            return null;
          const names = readBoundedDirectoryNames(entry.absolute);
          content.push([entry.relative, "directory", names]);
          identities.push([
            entry.relative,
            String(before.dev),
            String(before.ino),
            String(before.birthtimeNs),
          ]);
          for (const name of names) {
            pending.push({
              absolute: path.join(entry.absolute, name),
              relative: `${entry.relative}/${name}`,
              depth: entry.depth + 1,
            });
          }
          continue;
        }
        if (
          !before.isFile() ||
          before.nlink !== 1n ||
          entry.depth > MAX_DEPTH ||
          before.size > BigInt(MAX_FILE_BYTES)
        )
          return null;
        fileCount += 1;
        const sourcePackage = entry.relative.match(
          /^40_Develop\/([^/]+)\/src\//u,
        )?.[1];
        if (sourcePackage) packagesWithSource.add(sourcePackage);
        if (fileCount > MAX_FILES) return null;
        const descriptor = openSync(
          entry.absolute,
          constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
        );
        let bytes: Buffer;
        let identity: string;
        try {
          const opened = fstatSync(descriptor, { bigint: true });
          identity = JSON.stringify(
            [
              before.dev,
              before.ino,
              before.size,
              before.mtimeNs,
              before.ctimeNs,
              before.birthtimeNs,
              before.nlink,
            ].map(String),
          );
          const openedIdentity = JSON.stringify(
            [
              opened.dev,
              opened.ino,
              opened.size,
              opened.mtimeNs,
              opened.ctimeNs,
              opened.birthtimeNs,
              opened.nlink,
            ].map(String),
          );
          if (
            !opened.isFile() ||
            opened.nlink !== 1n ||
            openedIdentity !== identity
          )
            return null;
          const buffer = Buffer.alloc(Number(opened.size) + 1);
          let offset = 0;
          while (offset < buffer.length) {
            const count = readSync(
              descriptor,
              buffer,
              offset,
              buffer.length - offset,
              offset,
            );
            if (count === 0) break;
            offset += count;
          }
          if (offset !== Number(opened.size)) return null;
          bytes = buffer.subarray(0, offset);
          const after = fstatSync(descriptor, { bigint: true });
          if (
            JSON.stringify(
              [
                after.dev,
                after.ino,
                after.size,
                after.mtimeNs,
                after.ctimeNs,
                after.birthtimeNs,
                after.nlink,
              ].map(String),
            ) !== identity
          )
            return null;
        } finally {
          closeSync(descriptor);
        }
        const after = lstatSync(entry.absolute, { bigint: true });
        if (
          !after.isFile() ||
          after.nlink !== 1n ||
          after.isSymbolicLink() ||
          JSON.stringify(
            [
              after.dev,
              after.ino,
              after.size,
              after.mtimeNs,
              after.ctimeNs,
              after.birthtimeNs,
              after.nlink,
            ].map(String),
          ) !== identity
        )
          return null;
        totalBytes += bytes.length;
        if (totalBytes > MAX_TOTAL_BYTES) return null;
        content.push([
          entry.relative,
          bytes.length,
          createHash("sha256").update(bytes).digest("hex"),
        ]);
        identities.push([entry.relative, identity]);
      }
      if (packagesWithSource.size !== PACKAGES.length) return null;
      content.splice(
        3,
        content.length - 3,
        ...content
          .slice(3)
          .sort((a, b) =>
            JSON.stringify(a) < JSON.stringify(b)
              ? -1
              : JSON.stringify(a) > JSON.stringify(b)
                ? 1
                : 0,
          ),
      );
      identities.sort((a, b) =>
        JSON.stringify(a) < JSON.stringify(b)
          ? -1
          : JSON.stringify(a) > JSON.stringify(b)
            ? 1
            : 0,
      );
      const sourceSha256 = createHash("sha256")
        .update(JSON.stringify(content))
        .digest("hex");
      const sourceIdentitySha256 = createHash("sha256")
        .update(JSON.stringify([sourceSha256, identities]))
        .digest("hex");
      passes.push(sourceIdentitySha256);
      result = Object.freeze({
        scope: SOURCE_SCOPE,
        sourceSha256,
        sourceIdentitySha256,
        fileCount,
        totalBytes,
      });
    }
    return passes[0] === passes[1] ? result : null;
  } catch {
    return null;
  }
}

/**
 * このModule自身が属するRepositoryの開発Sourceを観測する。
 *
 * @responsibility Sessionと入力生成Toolの固定Source観測入口を共有する。
 * @trace ARCH-000004
 * @input N/A: RootとScopeはModuleから固定し、呼出し元に選ばせない。
 * @returns 有界Snapshotの観測値。不完全な観測はnull。
 * @precondition 固定11Packageと必要Sourceが読取り可能である。
 * @postcondition 成功値は二読取りで内容・実体が一致する。
 * @effect Sourceを同期読取りする。永続状態を作らない。
 * @failure 欠落、不正実体、途中変更、上限超過はnull。
 * @invariant この値は実行Authorityでも配布署名でもない。
 * @boundary 固定RepositoryのSourceのみを読み取る。
 * @security 任意Root、期待値自動補完、Source本文の公開を許さない。
 * @concurrency Snapshot観測中の差を拒否する。将来の変更不能は保証しない。
 */
export function observeRuntimeOwnedDevelopmentSource(): SourceObservation | null {
  return captureDevelopmentSource(sourceRoot);
}

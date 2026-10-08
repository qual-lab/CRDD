/**
 * CLI標準入力の上限付きJSON読取りと入力エラーを所有する。
 *
 * @responsibility 単一Taskと上位業務CLIに同じ入力上限・UTF-8・JSON拒否を提供する。
 * @trace ARCH-000004
 */
import fs from "node:fs";
import { parseUnambiguousJsonDocument } from "../../../ai-adapter/src/index.ts";

/**
 * UsageErrorが担う状態と操作を提供する。
 *
 * @responsibility UsageErrorに属する状態と操作の所有境界をまとめる。
 * @trace ARCH-000004
 * @construction UsageErrorの生成に必要な依存と初期状態をConstructor契約で固定する。
 * @lifecycle UsageErrorが所有する状態と資源を生成から終了まで同じInstanceで管理する。
 * @effect N/A: UsageErrorの宣言自体は実行時Effectを発行しない。
 * @failure N/A: UsageErrorの宣言自体は実行時失敗を所有しない。
 * @invariant UsageErrorで宣言した値と責務の対応を維持する。
 * @boundary N/A: UsageErrorの宣言は外部境界を開かない。
 * @security N/A: UsageErrorはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: UsageErrorは共有非同期状態を持たない同期処理である。
 */
export class UsageError extends Error {
  readonly usage = true;
}

const MAXIMUM_TASK_REQUEST_BYTES = 128 * 1024;

/**
 * Bounded Task Request From Stdinを読み取る。
 *
 * @responsibility Bounded Task Request From Stdinの読取り元、上限、読取不能時の結果境界を所有する。
 * @trace ARCH-000004
 * @input N/A: 実行時引数を受け取らない。
 * @returns readBoundedTaskRequestFromStdinの計算結果を返す。
 * @precondition 「N/A: 実行時引数を受け取らない。」がreadBoundedTaskRequestFromStdinの入力契約を満たす。
 * @postcondition readBoundedTaskRequestFromStdinの責務を完了した結果だけを返す。
 * @effect readBoundedTaskRequestFromStdinはFilesystemの読取りまたは書込みを実行する。
 * @failure readBoundedTaskRequestFromStdinは入力不正または下位処理の失敗を呼出し側へ返す。
 * @invariant readBoundedTaskRequestFromStdinは宣言した境界以外へEffectを拡張しない。
 * @boundary FilesystemとProcess内Domain処理の境界。
 * @security N/A: readBoundedTaskRequestFromStdinはAuthority、秘密値または信頼判断を扱わない。
 * @concurrency N/A: readBoundedTaskRequestFromStdinは共有非同期状態を持たない同期処理である。
 */
export function readBoundedTaskRequestFromStdin() {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const buffer = Buffer.alloc(8 * 1024);
  for (;;) {
    const readBytes = fs.readSync(0, buffer, 0, buffer.length, null);
    if (readBytes === 0) break;
    totalBytes += readBytes;
    if (totalBytes > MAXIMUM_TASK_REQUEST_BYTES) {
      throw new UsageError("task_request_too_large");
    }
    chunks.push(Buffer.from(buffer.subarray(0, readBytes)));
  }
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(
      Buffer.concat(chunks, totalBytes),
    );
  } catch {
    throw new UsageError("task_request_invalid_utf8");
  }
  const parsed = parseUnambiguousJsonDocument(source);
  if (!parsed) throw new UsageError("task_request_invalid_json");
  return parsed;
}

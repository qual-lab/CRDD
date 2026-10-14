/**
 * Workbenchの非秘密公開配置設定を所有する。
 * @responsibility HTTPS Originの検査と当該Server設定読取りを同じ責務で扱う。
 * @trace ARCH-000012
 */
import * as fs from "node:fs/promises";
import type { Stats } from "node:fs";
import path from "node:path";
import { verifyRepositoryRootFromWorkingDirectory } from "../../../version-control/src/index.ts";
import { observeRepositoryRuntimeDataArea } from "../../../domain-model/src/index.ts";

/**
 * 共有Workbenchの公開OriginをHTTPSのauthorityだけへ限定する。
 * @responsibility 禁止入力を正規化で消さず、公開HostとOriginを起動時に固定する。
 * @trace ARCH-000012
 * @input 非秘密の明示公開Origin。
 * @returns 検査済みURL、未指定時null。
 * @precondition TLS終端がClient由来案内Headerを除去・上書きする配置である。
 * @postcondition userinfo・path・query・hash・空白・HTTPを拒否する。
 * @effect N/A: 文字列とURLの純粋検査だけ。
 * @failure 固定構成例外でListener開始前に停止する。
 * @invariant 公開Originから外部Bindや認証を生成しない。
 * @boundary 配置OwnerとWorkbench Transport。
 * @security 内部Listenerへ到達するHost主体の管理は配置Ownerの前提である。
 * @concurrency 起動時の一つの値だけを使用する。
 */
export function inspectWorkbenchPublicOrigin(
  value: string | undefined,
): URL | null {
  if (value === undefined) return null;
  try {
    if (
      typeof value !== "string" ||
      !/^https:\/\/[^/\\\s@?#\u0000-\u0020\u007f]+\/?$/u.test(value)
    )
      throw new Error("invalid");
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.username ||
      parsed.password ||
      parsed.pathname !== "/" ||
      parsed.search ||
      parsed.hash
    )
      throw new Error("invalid");
    return parsed;
  } catch {
    throw new Error("workbench_public_origin_invalid");
  }
}

/**
 * 起動Repositoryの当該Server設定だけを読取り、公開Originを検査する。
 * @responsibility Tool単位の非秘密設定を明示CROS modeへ渡し、設定不存在はlocalhost既定とする。
 * @trace ARCH-000012
 * @input 起動時に選択したRepository内のworkingDirectory。
 * @returns 公開Originだけの閉じた非秘密構成。
 * @precondition CLIが--crosを明示した後だけ呼ぶ。資格やHost管理Rootを読まない。
 * @postcondition 不存在以外の観測不能・余剰・重複field・不正Originを拒否する。
 * @effect 検証済みRoot内の固定設定Fileを上限16KiBで読み、所有Descriptorを閉じる。
 * @failure 固定設定例外で停止し、単体fallbackや設定修復をしない。
 * @invariant 設定の存在は利用mode・認証・外部Bindを変更しない。
 * @boundary Repository-local非秘密設定とServer起動構成。
 * @security 観測時のDirectory/File linkと取得時のFile Identity不一致を拒否し、本文やPathを例外へ含めない。
 * @concurrency 取得済みDescriptorの長さ・mtime相関を検査する。取得後のPath／Directory不変は保証しない。
 */
export async function readWorkbenchServerConfiguration(
  workingDirectory: string,
): Promise<Readonly<{ publicOrigin?: string }>> {
  try {
    const verified = verifyRepositoryRootFromWorkingDirectory(workingDirectory);
    if (verified.status !== "completed") throw new Error("invalid");
    const area = observeRepositoryRuntimeDataArea(
      verified.capability,
      "config",
    );
    if (area.status === "not_observed") return Object.freeze({});
    if (area.status !== "ready") throw new Error("invalid");
    const config = area.directory;
    const file = path.join(config, "workbench-server.json");
    let before: Stats;
    try {
      before = await fs.lstat(file);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const currentArea = observeRepositoryRuntimeDataArea(
          verified.capability,
          "config",
        );
        if (
          currentArea.status !== "ready" ||
          currentArea.boundaryIdentity !== area.boundaryIdentity
        )
          throw new Error("invalid");
        return Object.freeze({});
      }
      throw error;
    }
    if (!before.isFile() || before.isSymbolicLink() || before.size > 16384)
      throw new Error("invalid");
    const handle = await fs.open(file, "r");
    try {
      const opened = await handle.stat();
      if (
        opened.dev !== before.dev ||
        opened.ino !== before.ino ||
        opened.size !== before.size ||
        opened.mtimeMs !== before.mtimeMs
      )
        throw new Error("invalid");
      const buffer = Buffer.alloc(16385);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      const after = await handle.stat();
      if (
        bytesRead !== opened.size ||
        after.size !== opened.size ||
        after.mtimeMs !== opened.mtimeMs
      )
        throw new Error("invalid");
      const text = new TextDecoder("utf-8", { fatal: true }).decode(
        buffer.subarray(0, bytesRead),
      );
      if (
        !/^\s*\{\s*(?:"publicOrigin"\s*:\s*"(?:[^"\\]|\\.)*"\s*)?\}\s*$/u.test(
          text,
        )
      )
        throw new Error("invalid");
      const value = JSON.parse(text) as { publicOrigin?: string };
      const origin = inspectWorkbenchPublicOrigin(value.publicOrigin);
      const currentArea = observeRepositoryRuntimeDataArea(
        verified.capability,
        "config",
      );
      if (
        currentArea.status !== "ready" ||
        currentArea.boundaryIdentity !== area.boundaryIdentity
      )
        throw new Error("invalid");
      return Object.freeze(origin ? { publicOrigin: origin.origin } : {});
    } finally {
      await handle.close();
    }
  } catch {
    throw new Error("workbench_server_configuration_invalid");
  }
}
